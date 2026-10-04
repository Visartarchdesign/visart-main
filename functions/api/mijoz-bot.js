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
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Supabase ${path} -> ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.status === 204 ? null : res.json();
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

  const obyektId = (msg.text || '').replace('/obyekt', '').trim();
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
      }
      await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cq.id }),
      }).catch(() => {});
      return json({ ok: true });
    }

    const msg = update.message;
    if (!msg || !msg.text || !msg.chat) return json({ ok: true });

    // Guruh/superguruh xabarlari: FAQAT /obyekt buyrug'i qayta ishlanadi
    // (admin tekshiruvi bilan) -- shaxsiy lid-dialog oqimi guruhda ishlamaydi.
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
      if (msg.text.startsWith('/obyekt')) {
        await handleObyektBuyrugi(env, msg);
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
