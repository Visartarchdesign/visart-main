// Cloudflare Pages Function — /api/mijoz-bot
// Mijoz-aloqa orchestrator (qaror #15, 1-servis): Lid + Sotuv (narx ko'rsatish) +
// Client Manager'ga uzatish. Telegram webhook sifatida ishlaydi.
//
// MUHIM: bu ALOHIDA, yangi bot (hozirgi sayt-forma bot'iga (contact.js) tegmaydi).
// BotFather'da /newbot bilan yangi bot yarating, keyin quyidagi sozlashni bajaring.
//
// Kerakli Cloudflare Pages Environment Variables (Production + Preview):
//   MIJOZ_BOT_TOKEN          — yangi bot tokeni (BotFather)
//   MIJOZ_BOT_SECRET         — o'zingiz o'ylab topgan tasodifiy satr (webhook tekshiruvi uchun)
//   MANAGER_CHAT_ID          — lid tugagach xabar boradigan menejer/admin chat ID
//   ADMIN_TELEGRAM_IDS       — vergul bilan ajratilgan Telegram user_id(lar) ro'yxati
//                              (masalan "123456789,987654321") — FAQAT shular
//                              guruhda /obyekt buyrug'ini bera oladi (pastga qarang)
//   SUPABASE_URL             — https://<project-ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY — Supabase service_role kaliti (faqat server tomonda, hech qachon frontend'ga chiqmaydi)
//
// Webhook o'rnatish (deploy qilingandan keyin, BIR MARTA, terminal/brauzerda):
//   https://api.telegram.org/bot<MIJOZ_BOT_TOKEN>/setWebhook?url=https://visartdesign.uz/api/mijoz-bot&secret_token=<MIJOZ_BOT_SECRET>
//
// XAVFSIZLIK (qaror #30): `/obyekt <id>` — bu buyruq guruhni Telegram'dagi shu
// guruhga bog'laydi (visart_loyiha_guruhlar), shundan keyin shu obyektga
// tegishli BARCHA mijoz-ko'rinadigan xabarlar (to'lov, progress va h.k.) shu
// guruhga oqadi. Shuning uchun buni FAQAT admin bera olishi SHART — aks holda
// guruhning istalgan a'zosi (hatto mijozning o'zi) guruhni boshqa/begona
// obyektga bog'lab, begona ma'lumotlarni ko'rib qolishi mumkin edi. Tekshiruv
// `msg.from.id`ni `ADMIN_TELEGRAM_IDS` ro'yxatiga solishtirish orqali amalga
// oshiriladi (pastda `isAdmin()`), admin bo'lmasa — bot rad etadi, hech narsa
// bog'lanmaydi.
// QAROR #24 TUZATISHI: yakuniy VISART_YAKUNIY manba kodi tekshirildi — `mijozlar`
// jadvali LID/CRM jadvali EMAS, balki obyektga bog'langan, auth.uid() orqali
// ishlaydigan MIJOZ PORTAL AKKAUNTI (login/parol bilan, bitta obyektga tegishli;
// RLS: user_id = auth.uid()). Sayt-botdan kelgan lidda hali obyekt ham, akkount ham
// yo'q — shuning uchun `mijozlar`ga yozish NOTO'G'RI bo'lardi (haqiqiy mijoz
// akkountlari bilan aralashib ketadi). Shu sababli lidlar uchun YANGI, alohida
// `lidlar` jadvali ishlatiladi (mavjud tizimga tegmaydi) — pastdagi SQL'ni
// Supabase SQL Editor'da bir marta ishga tushiring. `mijoz_dialog` jadvali ham YANGI.

const INSERT_COLUMNS = {
  ism: 'ism',
  telefon: 'telefon',
  xizmat_turi: 'xizmat_turi',
  maydon_m2: 'maydon_m2',
  manba: 'manba',
  holat: 'holat',
};

const STEPS = ['ism', 'telefon', 'xizmat', 'maydon', 'tugallandi'];

const XIZMAT_VARIANTLARI = [
  ['arch', "Arxitektura loyihalash"],
  ['interior', "Interyer dizayn"],
  ['turnkey', "Pod klyuch (arxitektura+interyer+qurilish nazorati)"],
  ['docs', "Hujjat va nazorat"],
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function tgSend(token, chatId, text, replyMarkup) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
}

function xizmatKeyboard() {
  return {
    inline_keyboard: XIZMAT_VARIANTLARI.map(([code, label]) => [
      { text: label, callback_data: `xizmat:${code}` },
    ]),
  };
}

async function sbFetch(env, path, init = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: init.prefer || 'return=representation',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Supabase ${path} -> ${res.status}: ${txt.slice(0, 300)}`);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

function isAdmin(env, userId) {
  const raw = env.ADMIN_TELEGRAM_IDS || '';
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return ids.includes(String(userId));
}

async function handleObyektBuyrugi(env, msg) {
  const chatId = msg.chat.id;

  if (!isAdmin(env, msg.from && msg.from.id)) {
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, "⛔ Bu buyruqni faqat admin bera oladi.");
    return;
  }

  const obyektId = (msg.text || '').replace(/^\/obyekt(@\S+)?/i, '').trim();
  if (!obyektId) {
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, "Foydalanish: /obyekt <obyekt_id>");
    return;
  }

  try {
    // Shu guruh avval boshqa obyektga bog'langan bo'lishi mumkin (unique
    // telegram_chat_id) -- qayta bog'lashga ruxsat berish uchun avval eski
    // bog'lanishni o'chiramiz, keyin yangisini yozamiz.
    await sbFetch(env, `visart_loyiha_guruhlar?telegram_chat_id=eq.${chatId}`, {
      method: 'DELETE',
      prefer: 'return=minimal',
    });
    await sbFetch(env, 'visart_loyiha_guruhlar', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify([{ obyekt_id: obyektId, telegram_chat_id: chatId }]),
    });
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, `✅ Bu guruh obyekt №${obyektId}ga bog'landi.`);
  } catch (e) {
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, "⚠️ Bog'lashda xato yuz berdi, qayta urinib ko'ring.");
  }
}

// YANGI: ustalar guruhi. Admin shu buyruq bilan guruhni biror obyektning
// "ustalar" guruhi deb belgilaydi (mijoz guruhidan ALOHIDA jadval,
// usta_guruhlar). Shu guruhga tushgan har bir video/foto uchun bot avtomatik
// "Mijozga yuborilsinmi?" tasdiqlash tugmasini chiqaradi -- FAQAT admin
// bossa, o'sha video/foto shu obyektga bog'langan MIJOZ guruhiga (agar
// bog'langan bo'lsa) nusxalanadi (copyMessage).
async function handleUstalarBuyrugi(env, msg) {
  const chatId = msg.chat.id;

  if (!isAdmin(env, msg.from && msg.from.id)) {
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, "⛔ Bu buyruqni faqat admin bera oladi.");
    return;
  }

  const obyektId = (msg.text || '').replace(/^\/ustalar(@\S+)?/i, '').trim();
  if (!obyektId) {
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, "Foydalanish: /ustalar <obyekt_id>");
    return;
  }

  try {
    await sbFetch(env, `usta_guruhlar?telegram_chat_id=eq.${chatId}`, {
      method: 'DELETE',
      prefer: 'return=minimal',
    });
    await sbFetch(env, 'usta_guruhlar', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify([{ obyekt_id: obyektId, telegram_chat_id: chatId }]),
    });
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId,
      `✅ Bu guruh obyekt №${obyektId} USTALAR guruhi sifatida bog'landi.\n\n` +
      "Hurmatli ustalar! Har kungi mehnatingiz uchun oldindan rahmat — xalol ishingiz juda qadrlanadi. 🙏\n\n" +
      "Bajargan ishingiz bo'yicha video yoki rasmni shu yerga tashlab turing, biz ko'rib, mijozga yetkazamiz. Charchamang! 💪");
  } catch (e) {
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, "⚠️ Bog'lashda xato yuz berdi, qayta urinib ko'ring.");
  }
}

// YANGI: "Visart Media" guruhi. Bu yerga tashlangan har qanday xom
// video/rasm (aralash, tartibsiz) darhol javob qaytarmaydi -- shunchaki
// `media_arxiv`ga ro'yxatga olinadi (file_id bilan). Senarist agenti
// (/api/senarist-tahlil, alohida, cron orqali) keyinroq to'plangan
// materialni ko'rib, mos keladiganini tanlab, admin DM'ga taklif yuboradi.
async function handleMediaArxiv(env, msg) {
  let turi, fileId, aslFileId = null;
  if (msg.photo && msg.photo.length) {
    turi = 'photo';
    fileId = msg.photo[msg.photo.length - 1].file_id;
  } else if (msg.video) {
    turi = 'video';
    fileId = (msg.video.thumbnail || msg.video.thumb || {}).file_id || null;
    aslFileId = msg.video.file_id; // Montajchi uchun -- to'liq video
  } else if (msg.video_note) {
    turi = 'video_note';
    fileId = (msg.video_note.thumbnail || msg.video_note.thumb || {}).file_id || null;
    aslFileId = msg.video_note.file_id;
  } else if (msg.document && (msg.document.mime_type || '').startsWith('image/')) {
    // "Fayl" (siqilmagan, asl sifat) qilib yuborilgan rasm -- Telegram buni
    // alohida `document` sifatida yuboradi, `photo` emas.
    turi = 'photo';
    fileId = msg.document.file_id;
  } else if (msg.document && (msg.document.mime_type || '').startsWith('video/')) {
    turi = 'video';
    fileId = (msg.document.thumbnail || msg.document.thumb || {}).file_id || null;
    aslFileId = msg.document.file_id;
  } else {
    return;
  }
  await sbFetch(env, 'media_arxiv', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify([{
      telegram_chat_id: msg.chat.id,
      telegram_message_id: msg.message_id,
      turi,
      izoh: msg.caption || null,
      asl_file_id: aslFileId,
      file_id: fileId,
    }]),
  });
}

// Senarist taklifini admin DM'da tasdiqlash/rad etish. data shakli:
// "stak:<taklif_id>:ok" yoki "stak:<taklif_id>:no".
async function handleSenaristTasdiq(env, cq, data) {
  const [, taklifId, amal] = data.split(':');

  if (!isAdmin(env, cq.from && cq.from.id)) {
    await answerCq(env, cq.id, { text: 'Faqat admin tasdiqlashi mumkin.', show_alert: true });
    return;
  }

  await removeKb(env, cq.message.chat.id, cq.message.message_id);
  const holat = amal === 'ok' ? 'tasdiqlangan' : 'rad_etilgan';
  try {
    await sbFetch(env, `media_taklif?id=eq.${taklifId}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({ holat }),
    });
    await tgSend(env.MIJOZ_BOT_TOKEN, cq.message.chat.id,
      amal === 'ok' ? "✅ Taklif tasdiqlandi — montaj navbatiga qo'yildi." : '❌ Taklif rad etildi.');

    if (amal === 'ok') {
      await oblojkaTayyorlaVaYubor(env, taklifId, cq.message.chat.id);
      await montajBoshlash(env, taklifId, cq.message.chat.id);
    }
  } catch (e) {
    await tgSend(env.MIJOZ_BOT_TOKEN, cq.message.chat.id, '⚠️ Xato yuz berdi.');
  }
  await answerCq(env, cq.id);
}

// Oblojka agenti bilan bog'lanish (Render.com'dagi media-server).
async function tgGetFilePath(token, fileId) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`, { signal: AbortSignal.timeout(10000) });
  const data = await res.json().catch(() => null);
  return data && data.ok ? data.result.file_path : null;
}

async function tgDownloadBase64(token, filePath) {
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(binary);
}

async function oblojkaYasash(env, shablon, photoBase64, title, kategoriya) {
  const res = await fetch(`${env.MEDIA_SERVER_URL}/oblojka`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Media-Secret': env.MEDIA_SECRET },
    body: JSON.stringify({ shablon, photoBase64, title, kategoriya }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`media-server -> ${res.status}`);
  return res.arrayBuffer();
}

async function tgSendPhoto(token, chatId, pngBuffer, caption) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) form.append('caption', caption);
  form.append('photo', new Blob([pngBuffer], { type: 'image/png' }), 'oblojka.png');
  await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(25000),
  }).catch(() => {});
}

// Tasdiqlangan Senarist taklifi uchun 3 shablonda oblojka yasab, adminga
// DM'da yuboradi. MEDIA_SERVER_URL/MEDIA_SECRET sozlanmagan bo'lsa -- jim
// e'tiborsiz qoldiradi (hali ishga tushirilmagan bosqich).
async function oblojkaTayyorlaVaYubor(env, taklifId, adminChatId) {
  if (!env.MEDIA_SERVER_URL || !env.MEDIA_SECRET) return;
  try {
    const taklifRows = await sbFetch(env, `media_taklif?id=eq.${taklifId}&select=*`);
    const taklif = taklifRows && taklifRows[0];
    if (!taklif) return;

    const arxivRows = await sbFetch(env, `media_arxiv?id=eq.${taklif.media_arxiv_id}&select=file_id`);
    const fileId = arxivRows && arxivRows[0] ? arxivRows[0].file_id : null;
    if (!fileId) return;

    const filePath = await tgGetFilePath(env.MIJOZ_BOT_TOKEN, fileId);
    if (!filePath) return;
    const base64 = await tgDownloadBase64(env.MIJOZ_BOT_TOKEN, filePath);
    if (!base64) return;

    const title = (taklif.matn || '').split('\n\n')[0];
    for (const shablon of [1, 2, 3]) {
      try {
        const png = await oblojkaYasash(env, shablon, base64, title, null);
        await tgSendPhoto(env.MIJOZ_BOT_TOKEN, adminChatId, png, `Oblojka -- ${shablon}-shablon`);
      } catch (e) {
        // bitta shablon xato bersa ham, qolganlariga davom
      }
    }
  } catch (e) {
    // jim e'tiborsiz -- oblojka ixtiyoriy qo'shimcha, asosiy tasdiqni to'xtatmaydi
  }
}

// Tasdiqlangan taklif manbasi VIDEO bo'lsa, Render'dagi Montajchiga ishga
// tushirish so'rovini yuboradi (fire-and-forget -- Render darhol 202 qaytaradi,
// og'ir ish fonda davom etib, tugagach natijani to'g'ridan-to'g'ri Telegram
// orqali adminChatId'ga yuboradi). MEDIA_SERVER_URL/MEDIA_SECRET sozlanmagan
// yoki manba rasm bo'lsa -- jim e'tiborsiz qoldiradi.
async function montajBoshlash(env, taklifId, adminChatId) {
  if (!env.MEDIA_SERVER_URL || !env.MEDIA_SECRET) return;
  try {
    const taklifRows = await sbFetch(env, `media_taklif?id=eq.${taklifId}&select=*`);
    const taklif = taklifRows && taklifRows[0];
    if (!taklif) return;

    const arxivRows = await sbFetch(env, `media_arxiv?id=eq.${taklif.media_arxiv_id}&select=turi,asl_file_id`);
    const arxiv = arxivRows && arxivRows[0];
    if (!arxiv || !arxiv.asl_file_id) return; // rasm yoki asl video topilmadi -- montaj shart emas
    if (arxiv.turi !== 'video' && arxiv.turi !== 'video_note') return;

    const title = (taklif.matn || '').split('\n\n')[0];
    await fetch(`${env.MEDIA_SERVER_URL}/montaj`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Media-Secret': env.MEDIA_SECRET },
      body: JSON.stringify({ aslFileId: arxiv.asl_file_id, adminChatId, title }),
      // Render bepul tarifda uxlab qolgan bo'lsa, uyg'onishi 50+ soniya
      // olishi mumkin -- ulanish shu vaqt ichida o'rnatilishi uchun uzoqroq
      // timeout beramiz (aks holda so'rov Render'ga umuman YETIB BORMAYDI).
      signal: AbortSignal.timeout(55000),
    });
  } catch (e) {
    // Juda sekin bo'lsa ham -- keyingi safar qo'lda qayta urinib ko'rish mumkin.
  }
}

function adminIdlari(env) {
  return (env.ADMIN_TELEGRAM_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

const USTA_KASBLAR = [
  ['malyarka', '🎨 Malyarka'],
  ['elektrik', '⚡ Elektrik'],
  ['santexnika', '🔧 Santexnika'],
  ['gisht_beton', "🧱 G'isht/beton"],
  ['yogoch', "🪵 Yog'och ishlari"],
  ['boshqa', '🧰 Boshqa'],
];

function kasbNomi(code) {
  const found = USTA_KASBLAR.find((k) => k[0] === code);
  return found ? found[1] : (code || 'Ish');
}

function kasbKeyboard(chatId, msgId) {
  const row = ([code, label]) => ({ text: label, callback_data: `ucat:${code}:${chatId}:${msgId}` });
  return {
    inline_keyboard: [
      USTA_KASBLAR.slice(0, 3).map(row),
      USTA_KASBLAR.slice(3).map(row),
    ],
  };
}

async function answerCq(env, cqId, extra) {
  await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: cqId, ...(extra || {}) }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}

async function removeKb(env, chatId, messageId) {
  await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}

// 1-bosqich: Ustalar guruhidan video/foto kelsa -- GURUHNING O'ZIDA ("qaysi
// ish turi?" tugmalari bilan) ishning turi so'raladi, hali adminga
// yuborilmaydi. Bu faqat tasnif uchun, hamma ustalar bosa oladi.
async function handleUstaMedia(env, msg) {
  const chatId = msg.chat.id;
  let obyektId = null;
  try {
    const rows = await sbFetch(env, `usta_guruhlar?telegram_chat_id=eq.${chatId}&select=obyekt_id`);
    obyektId = rows && rows[0] ? rows[0].obyekt_id : null;
  } catch (e) {
    return; // Supabase xato -- e'tiborsiz qoldiramiz
  }
  if (!obyektId) return; // bu guruh ustalar guruhi sifatida ro'yxatdan o'tmagan

  await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      reply_to_message_id: msg.message_id,
      text: 'Bu video/rasm kimga? 👇',
      reply_markup: {
        inline_keyboard: [[
          { text: '👥 Guruh uchun', callback_data: `umaq:guruh:${chatId}:${msg.message_id}` },
          { text: '👷 Prorab uchun', callback_data: `umaq:prorab:${chatId}:${msg.message_id}` },
        ]],
      },
    }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}

// 1.5-bosqich: "guruh uchun" yoki "prorab uchun"ligi tanlandi.
// "Guruh uchun" -- bu shunchaki ustalarning o'zaro ichki muloqoti, hech
// qayerga yuborilmaydi, media guruhning o'zida qoladi, xolos.
// "Prorab uchun" -- keyingi bosqichga o'tadi (ish turi so'raladi, keyin
// prorab/admin DM'ga tasdiqlash uchun yuboriladi).
async function handleUstaMaqsad(env, cq, data) {
  const [, maqsad, groupChatIdStr, msgIdStr] = data.split(':');
  const groupChatId = groupChatIdStr;
  const origMsgId = Number(msgIdStr);

  await removeKb(env, cq.message.chat.id, cq.message.message_id);
  await answerCq(env, cq.id);

  if (maqsad === 'guruh') {
    await tgSend(env.MIJOZ_BOT_TOKEN, groupChatId, '👥 Tushunarli, guruh uchun qoldi.');
    return;
  }

  await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: groupChatId,
      reply_to_message_id: origMsgId,
      text: "Qaysi ish turi bo'yicha hisobot? 👇",
      reply_markup: kasbKeyboard(groupChatId, origMsgId),
    }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}

// 2-bosqich: ish turi tanlandi -- GURUHDAGI tugma olib tashlanadi, va endi
// xuddi shu media har bir adminning SHAXSIY chatiga (DM) nusxalanadi,
// tasdiqlash tugmalari bilan -- faqat admin o'zi ko'radi va qaror qiladi
// (ustalar adashib boshqa rasm/video yuborib qo'yishi mumkinligi uchun).
async function handleUstaKategoriya(env, cq, data) {
  const [, kasbCode, groupChatIdStr, msgIdStr] = data.split(':');
  const groupChatId = groupChatIdStr;
  const origMsgId = Number(msgIdStr);
  const kasbLabel = kasbNomi(kasbCode);

  await removeKb(env, cq.message.chat.id, cq.message.message_id);
  await tgSend(env.MIJOZ_BOT_TOKEN, groupChatId, `Rahmat! Kategoriya: ${kasbLabel}. Admin tasdig'ini kutamiz.`);
  await answerCq(env, cq.id);

  let obyektId = null;
  try {
    const rows = await sbFetch(env, `usta_guruhlar?telegram_chat_id=eq.${groupChatId}&select=obyekt_id`);
    obyektId = rows && rows[0] ? rows[0].obyekt_id : null;
  } catch (e) {
    return;
  }
  if (!obyektId) return;

  const admins = adminIdlari(env);
  if (!admins.length) return; // ADMIN_TELEGRAM_IDS sozlanmagan -- yuboriladigan joy yo'q

  const kb = {
    inline_keyboard: [[
      { text: '✅ Mijozga yuborish', callback_data: `uok:${kasbCode}:${groupChatId}:${origMsgId}` },
      { text: '❌ Rad etish', callback_data: `uno:${kasbCode}:${groupChatId}:${origMsgId}` },
    ]],
  };

  for (const adminId of admins) {
    await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: adminId, text: `👷 Obyekt №${obyektId} — ${kasbLabel} ishi bo'yicha yangi video/foto:` }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => {});
    await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/copyMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: adminId,
        from_chat_id: groupChatId,
        message_id: origMsgId,
        reply_markup: kb,
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => {});
  }
}

// 3-bosqich: admin DM'da "✅/❌" bosadi. data shakli:
// "uok:<kasb_kodi>:<ustalar_guruh_chat_id>:<asl_xabar_id>" yoki "uno:...".
// Bu DM'da (admin'ning shaxsiy chatida) kelgan callback -- shuning uchun
// guruh ID'si cq.message.chat.id'dan EMAS, data ichidan olinadi.
async function handleUstaTasdiq(env, cq, data) {
  const [amal, kasbCode, groupChatIdStr, msgIdStr] = data.split(':');
  const groupChatId = groupChatIdStr;
  const origMsgId = Number(msgIdStr);
  const kasbLabel = kasbNomi(kasbCode);

  if (!isAdmin(env, cq.from && cq.from.id)) {
    await answerCq(env, cq.id, { text: 'Faqat admin tasdiqlashi mumkin.', show_alert: true });
    return;
  }

  await removeKb(env, cq.message.chat.id, cq.message.message_id);

  if (amal === 'uno') {
    await tgSend(env.MIJOZ_BOT_TOKEN, cq.message.chat.id, '❌ Rad etildi — mijozga yuborilmadi.');
    await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: groupChatId,
        reply_to_message_id: origMsgId,
        text: "Hurmatli ustalar, yuborgan foto/videongiz rad etildi — iltimos, tekshirib qaytadan yuboring. 🙏",
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => {});
  } else {
    try {
      const rows = await sbFetch(env, `usta_guruhlar?telegram_chat_id=eq.${groupChatId}&select=obyekt_id`);
      const obyektId = rows && rows[0] ? rows[0].obyekt_id : null;
      const clientRows = obyektId
        ? await sbFetch(env, `visart_loyiha_guruhlar?obyekt_id=eq.${encodeURIComponent(obyektId)}&select=telegram_chat_id`)
        : null;
      const clientChatId = clientRows && clientRows[0] ? clientRows[0].telegram_chat_id : null;

      if (!clientChatId) {
        await tgSend(env.MIJOZ_BOT_TOKEN, cq.message.chat.id, "⚠️ Bu obyektning mijoz guruhi hali bog'lanmagan — yuborilmadi.");
      } else {
        await tgSend(env.MIJOZ_BOT_TOKEN, clientChatId, `🎥 Bugungi ${kasbLabel} ustalar kunlik hisob videosi:`);
        await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/copyMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: clientChatId, from_chat_id: groupChatId, message_id: origMsgId }),
          signal: AbortSignal.timeout(10000),
        });
        await tgSend(env.MIJOZ_BOT_TOKEN, cq.message.chat.id, '✅ Mijoz guruhiga yuborildi.');
      }
    } catch (e) {
      await tgSend(env.MIJOZ_BOT_TOKEN, cq.message.chat.id, '⚠️ Yuborishda xato yuz berdi.');
    }
  }

  await answerCq(env, cq.id);
}

async function getDialog(env, chatId) {
  const rows = await sbFetch(env, `mijoz_dialog?chat_id=eq.${chatId}&select=*`);
  return rows && rows[0] ? rows[0] : null;
}

async function upsertDialog(env, chatId, patch) {
  await sbFetch(env, 'mijoz_dialog', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify([{ chat_id: chatId, updated_at: new Date().toISOString(), ...patch }]),
  });
}

async function fetchLivePricing() {
  try {
    const res = await fetch('https://visartdesign.uz/api/content', { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    return data && data.ok ? data.pricing : null;
  } catch (e) {
    return null;
  }
}

function estimateText(pricing, xizmatCode, maydon) {
  if (!pricing) return "Hozircha narx ma'lumotini olib bo'lmadi — menejer sizga aniq narxni ayta oladi.";
  const svc = (pricing.services || []).find((s) => s.id === xizmatCode);
  if (!svc) return "Menejer tez orada aniq narxni aytib beradi.";
  if (svc.areaBased && svc.rate) {
    const total = Math.round(svc.rate * maydon);
    return `Taxminiy narx (Standart tarif): ${total.toLocaleString('ru-RU')} so'm (${maydon} m² × ${svc.rate.toLocaleString('ru-RU')} so'm/m²). Aniq narx va tarif (Premium/Lyuks) menejer bilan kelishiladi.`;
  }
  if (svc.flat) {
    return `Taxminiy narx: ${svc.flat.toLocaleString('ru-RU')} so'm. Aniq narx menejer bilan kelishiladi.`;
  }
  return "Menejer tez orada aniq narxni aytib beradi.";
}

async function handleText(env, chatId, dialog, text) {
  const step = dialog ? dialog.step : 'ism';

  if (!dialog) {
    await upsertDialog(env, chatId, { step: 'ism' });
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId,
      "Assalomu alaykum! Visart Design'ga xush kelibsiz. 👋\n\nLoyihangiz bo'yicha bir necha savol beraman, so'ng menejerimiz siz bilan bog'lanadi.\n\nIsmingiz nima?");
    return;
  }

  if (step === 'ism') {
    const ism = text.trim().slice(0, 100);
    if (ism.length < 2) {
      await tgSend(env.MIJOZ_BOT_TOKEN, chatId, "Iltimos, to'liq ismingizni yozing.");
      return;
    }
    await upsertDialog(env, chatId, { step: 'telefon', ism });
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, "Rahmat! Endi telefon raqamingizni yuboring (masalan, +998901234567).");
    return;
  }

  if (step === 'telefon') {
    const tel = text.trim();
    if (!/^\+?[\d\s().-]{9,20}$/.test(tel)) {
      await tgSend(env.MIJOZ_BOT_TOKEN, chatId, "Telefon raqami to'g'ri formatda emas. Masalan: +998901234567");
      return;
    }
    await upsertDialog(env, chatId, { step: 'xizmat', telefon: tel });
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, "Qaysi xizmat kerak?", xizmatKeyboard());
    return;
  }

  if (step === 'xizmat') {
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, "Iltimos, yuqoridagi tugmalardan birini tanlang.", xizmatKeyboard());
    return;
  }

  if (step === 'maydon') {
    const m2 = parseFloat(text.replace(',', '.').replace(/[^\d.]/g, ''));
    if (!m2 || m2 <= 0 || m2 > 100000) {
      await tgSend(env.MIJOZ_BOT_TOKEN, chatId, "Iltimos, maydonni raqamda yuboring (m², masalan: 85).");
      return;
    }
    await finishDialog(env, chatId, dialog, m2);
    return;
  }

  // step === 'tugallandi' -> erkin xabar, menejerga uzatiladi
  if (env.MANAGER_CHAT_ID) {
    await tgSend(env.MIJOZ_BOT_TOKEN, env.MANAGER_CHAT_ID,
      `✉️ Mijozdan qo'shimcha xabar (chat ${chatId}, ${dialog.ism || '—'}):\n${text}`);
  }
  await tgSend(env.MIJOZ_BOT_TOKEN, chatId, "Xabaringiz menejerga yuborildi, tez orada javob beradi.");
}

async function handleXizmatTanlandi(env, chatId, dialog, xizmatCode) {
  const label = (XIZMAT_VARIANTLARI.find((x) => x[0] === xizmatCode) || [, xizmatCode])[1];
  await upsertDialog(env, chatId, { step: 'maydon', xizmat_turi: xizmatCode, xizmat_label: label });
  await tgSend(env.MIJOZ_BOT_TOKEN, chatId, `Tanlandi: ${label}.\n\nObyekt maydoni necha m²?`);
}

async function finishDialog(env, chatId, dialog, maydon) {
  await upsertDialog(env, chatId, { step: 'tugallandi', maydon_m2: maydon });

  // 1) Lid sifatida Supabase'dagi YANGI `lidlar` jadvaliga yoziladi (mavjud
  // `mijozlar` jadvaliga TEGILMAYDI — u haqiqiy mijoz portal akkountlari uchun)
  let lidYozildi = true;
  try {
    await sbFetch(env, 'lidlar', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify([{
        [INSERT_COLUMNS.ism]: dialog.ism,
        [INSERT_COLUMNS.telefon]: dialog.telefon,
        [INSERT_COLUMNS.xizmat_turi]: dialog.xizmat_turi,
        [INSERT_COLUMNS.maydon_m2]: maydon,
        [INSERT_COLUMNS.manba]: 'telegram_mijoz_bot',
        [INSERT_COLUMNS.holat]: 'yangi_lid',
      }]),
    });
  } catch (e) {
    lidYozildi = false;
  }

  // 2) Narx taxmini (saytning jonli /api/content dan)
  const pricing = await fetchLivePricing();
  const narxMatni = estimateText(pricing, dialog.xizmat_turi, maydon);

  await tgSend(env.MIJOZ_BOT_TOKEN, chatId,
    `Rahmat, ${dialog.ism}! Ma'lumotlaringiz qabul qilindi.\n\n${narxMatni}\n\nMenejerimiz tez orada siz bilan bog'lanadi.`);

  // 3) Menejerga xabar
  if (env.MANAGER_CHAT_ID) {
    await tgSend(env.MIJOZ_BOT_TOKEN, env.MANAGER_CHAT_ID,
      `🆕 Yangi lid (Telegram bot)\n\n👤 ${dialog.ism}\n📞 ${dialog.telefon}\n🛠 ${dialog.xizmat_label || dialog.xizmat_turi}\n📐 ${maydon} m²\n💬 Chat: ${chatId}` +
      (lidYozildi ? '' : '\n\n⚠️ Supabase lidlar jadvaliga yozishda xato — qo\'lda kiriting!'));
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!env.MIJOZ_BOT_SECRET || secret !== env.MIJOZ_BOT_SECRET) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }
    const update = await request.json().catch(() => null);
    if (!update) return json({ ok: true });

    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const data = cq.data || '';
      if (data.startsWith('xizmat:')) {
        const dialog = await getDialog(env, chatId);
        if (dialog && dialog.step === 'xizmat') {
          await handleXizmatTanlandi(env, chatId, dialog, data.split(':')[1]);
        }
        await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: cq.id }),
        }).catch(() => {});
        return json({ ok: true });
      }
      if (data.startsWith('umaq:')) {
        await handleUstaMaqsad(env, cq, data);
        return json({ ok: true });
      }
      if (data.startsWith('ucat:')) {
        await handleUstaKategoriya(env, cq, data);
        return json({ ok: true });
      }
      if (data.startsWith('uok:') || data.startsWith('uno:')) {
        await handleUstaTasdiq(env, cq, data);
        return json({ ok: true });
      }
      if (data.startsWith('stak:')) {
        await handleSenaristTasdiq(env, cq, data);
        return json({ ok: true });
      }
      await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cq.id }),
      }).catch(() => {});
      return json({ ok: true });
    }

    const msg = update.message;
    if (!msg || !msg.chat) return json({ ok: true });

    // Bot guruhga YANGI qo'shilganda (admin uni qo'shganda) — tanishtiruv
    // xabari yuboradi: o'zi haqida va vazifasi haqida qisqa ma'lumot + rahmat.
    if (Array.isArray(msg.new_chat_members)) {
      const botId = (env.MIJOZ_BOT_TOKEN || '').split(':')[0];
      const botQoshildimi = msg.new_chat_members.some((m) => String(m.id) === botId);
      if (botQoshildimi) {
        await tgSend(env.MIJOZ_BOT_TOKEN, msg.chat.id,
          "Assalomu alaykum! 👋 Men <b>Visart Design</b>ning rasmiy yordamchi botiman.\n\n" +
          "Vazifam: shu guruhni loyihangizga bog'lash va loyiha davomidagi muhim yangiliklar — to'lov tasdig'i, bosqich yakunlanishi va boshqa yangiliklarni shu yerga avtomatik yetkazib turish.\n\n" +
          "Admin tez orada guruhni <code>/obyekt &lt;ID&gt;</code> buyrug'i bilan loyihangizga bog'laydi.\n\n" +
          "Visart jamoasi bilan ishlayotganingiz uchun minnatdorchilik bildiramiz — loyihangiz davomida doim aloqadamiz! 🏗️");
        return json({ ok: true });
      }
    }

    // Ustalar guruhidan video/foto kelsa -- matn kerak emas, darhol tasdiqlash
    // so'rovi chiqariladi (yuqoridagi handleUstaMedia o'zi guruh ro'yxatdan
    // o'tmagan bo'lsa jim e'tiborsiz qoldiradi).
    const hujjatRasmYokiVideo = msg.document && /^(image|video)\//.test(msg.document.mime_type || '');
    if ((msg.chat.type === 'group' || msg.chat.type === 'supergroup') && (msg.photo || msg.video || msg.video_note || hujjatRasmYokiVideo)) {
      if (env.MEDIA_GROUP_CHAT_ID && String(msg.chat.id) === String(env.MEDIA_GROUP_CHAT_ID)) {
        try {
          await handleMediaArxiv(env, msg);
        } catch (e) {
          // jim e'tiborsiz -- keyingi safar senarist baribir qolganlarini ko'radi
        }
      } else {
        await handleUstaMedia(env, msg);
      }
      return json({ ok: true });
    }

    if (!msg.text) return json({ ok: true });

    // Guruh/superguruh xabarlari: FAQAT /obyekt, /ustalar, /chatid buyruqlari
    // qayta ishlanadi (admin tekshiruvi bilan) -- shaxsiy lid-dialog oqimi
    // guruhda ishlamaydi.
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
      if (msg.text.startsWith('/obyekt')) {
        await handleObyektBuyrugi(env, msg);
      } else if (msg.text.startsWith('/ustalar')) {
        await handleUstalarBuyrugi(env, msg);
      } else if (msg.text.startsWith('/chatid')) {
        // Yordamchi buyruq: shu guruhning Telegram chat ID'sini ko'rsatadi
        // (masalan MOLIYA_GROUP_CHAT_ID'ni sozlash uchun). Hamma ishlata oladi,
        // maxfiy ma'lumot ochmaydi.
        await tgSend(env.MIJOZ_BOT_TOKEN, msg.chat.id, `Shu guruhning chat ID'si: <code>${msg.chat.id}</code>`);
      }
      return json({ ok: true });
    }

    const chatId = msg.chat.id;
    const dialog = await getDialog(env, chatId);

    if (msg.text === '/start') {
      await upsertDialog(env, chatId, { step: 'ism', ism: null, telefon: null, xizmat_turi: null, maydon_m2: null });
      await tgSend(env.MIJOZ_BOT_TOKEN, chatId,
        "Assalomu alaykum! Visart Design'ga xush kelibsiz. 👋\n\nIsmingiz nima?");
      return json({ ok: true });
    }

    await handleText(env, chatId, dialog, msg.text);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'server_error' }, 500);
  }
}
