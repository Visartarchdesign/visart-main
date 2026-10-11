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
// Instagram avtomatik post (ixtiyoriy -- sozlanmasa jim o'tkazib yuboriladi):
//   INSTAGRAM_ACCESS_TOKEN         — Meta System User muddatsiz tokeni
//                                    (instagram_content_publish + pages_manage_posts
//                                    ruxsatlari bilan -- Instagram VA Facebook uchun birga ishlatiladi)
//   INSTAGRAM_BUSINESS_ACCOUNT_ID  — Instagram Business Account ID (raqamli)
//   FACEBOOK_PAGE_ID               — Facebook sahifa ID (masalan 842860749057867)
//                                    (ixtiyoriy -- sozlanmasa Facebook'ga joylash o'tkazib yuboriladi)
//   (rasm Instagram'ga faqat ochiq URL orqali yuboriladi -- shuning uchun
//   Supabase Storage'dagi "public-media" bucket'iga vaqtincha yuklanadi)
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

import { keyingiToshkent } from '../_lib/botAvto.js';
import { xatoYoz } from '../_lib/xato.js';
import { TANISH_MIJOZ, TANISH_USTA, guruhSalom, guruhBuyruq, guruhCb, maslahatYarat, maslahatTarqat } from '../_lib/guruhJamoa.js';
import { t, menejerlar, getProfil, setProfil, menyuKorsat, handleMenu, handleNarx, narxMaydonMatn, lidSavollarBoshla, handleLq, followUpQoy, handleMijozFoto, handleKontakt, handleObTanla, obyektTelBilan } from '../_lib/mijozMenyu.js';

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

const XIZMAT_RU = { arch: 'Архитектурное проектирование', interior: 'Дизайн интерьера', turnkey: 'Ремонт под ключ (архитектура + интерьер + стройка)' };
const escH = (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function xizmatKeyboard(til) {
  return {
    inline_keyboard: XIZMAT_VARIANTLARI.map(([code, label]) => [
      { text: til === 'ru' ? XIZMAT_RU[code] : label, callback_data: `xizmat:${code}` },
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

// DB'dagi qo'shimcha adminlar (bot_adminlar) env ro'yxatiga qo'shiladi -- har so'rovda 1 ta so'rov.
async function adminlarBilan(env) {
  const root = env.ADMIN_TELEGRAM_IDS || '';
  try {
    const r = await sbFetch(env, 'bot_adminlar?select=chat_id&chat_id=not.is.null');
    const ex = (r || []).map((x) => String(x.chat_id));
    return { ...env, ROOT_ADMIN_IDS: root, ADMIN_TELEGRAM_IDS: [root, ...ex].filter(Boolean).join(',') };
  } catch (e) {
    return { ...env, ROOT_ADMIN_IDS: root };
  }
}
const isRoot = (env, uid) => String(env.ROOT_ADMIN_IDS || '').split(',').map((x) => x.trim()).includes(String(uid));

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
    // Bir guruh = bitta rol: mijoz guruhi bo'lsa, ustalar roli olib tashlanadi.
    await sbFetch(env, `usta_guruhlar?telegram_chat_id=eq.${chatId}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
    await sbFetch(env, 'visart_loyiha_guruhlar', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify([{ obyekt_id: obyektId, telegram_chat_id: chatId }]),
    });
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, `✅ Bu guruh obyekt №${obyektId} uchun MIJOZ guruhi sifatida bog'landi.`);
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, TANISH_MIJOZ);
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
    await sbFetch(env, `visart_loyiha_guruhlar?telegram_chat_id=eq.${chatId}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
    await sbFetch(env, 'usta_guruhlar', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify([{ obyekt_id: obyektId, telegram_chat_id: chatId }]),
    });
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId,
      `✅ Bu guruh obyekt №${obyektId} USTALAR guruhi sifatida bog'landi.`);
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, TANISH_USTA);
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

  // Telegram albomi (media_group_id) bo'lmasa -- bu "fayl" rejimida
  // bitta-bittadan yuborilgan rasm bo'lishi mumkin (ba'zi Telegram
  // ilovalari fayllarni albom qilib yubormaydi). Shunday holatda, SHU
  // guruhdan so'nggi 3 daqiqa ichida kelgan materialga "sun'iy" umumiy
  // to'plam ID beramiz -- Senarist ularni ham bitta karusel sifatida
  // ko'ra olishi uchun.
  const haqiqiyAlbom = Boolean(msg.media_group_id);
  let mediaGroupId = msg.media_group_id || null;
  if (!mediaGroupId) {
    try {
      const sana = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      const songgi = await sbFetch(env,
        `media_arxiv?telegram_chat_id=eq.${msg.chat.id}&holat=eq.yangi&created_at=gte.${sana}&select=id,media_group_id&order=created_at.desc&limit=1`);
      const oldingi = songgi && songgi[0];
      if (oldingi) {
        if (oldingi.media_group_id) {
          mediaGroupId = oldingi.media_group_id;
        } else {
          mediaGroupId = `auto-${msg.chat.id}-${oldingi.id}`;
          await sbFetch(env, `media_arxiv?id=eq.${oldingi.id}`, {
            method: 'PATCH',
            prefer: 'return=minimal',
            body: JSON.stringify({ media_group_id: mediaGroupId }),
          }).catch(() => {});
        }
      }
    } catch (e) {
      // xato bo'lsa -- shunchaki alohida material sifatida qoladi
    }
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
      media_group_id: mediaGroupId,
    }]),
  });

  if (!haqiqiyAlbom && mediaGroupId) {
    // Albomsiz (fayl, bittalab) holat -- odamga joriy to'plam holatini
    // darhol bildiramiz.
    try {
      const toplam = await sbFetch(env,
        `media_arxiv?media_group_id=eq.${mediaGroupId}&holat=eq.yangi&select=id`);
      const son = toplam ? toplam.length : 1;
      await tgSend(env.MIJOZ_BOT_TOKEN, msg.chat.id,
        `📥 Qabul qilindi (joriy to'plamda: ${son} ta). Ketma-ket yuborishda davom eting -- 3 daqiqa ichida yuborilgan hammasi BITTA to'plam bo'ladi. Yangi/boshqa obyekt boshlamoqchi bo'lsangiz, shunchaki 3 daqiqa kutib keyin yuboring.`);
    } catch (e) {
      // e'tiborsiz -- bu faqat qulaylik xabari
    }
  } else if (haqiqiyAlbom && mediaGroupId) {
    // Haqiqiy Telegram albomi -- har bir rasm/video ALOHIDA xabar sifatida
    // keladi, shuning uchun har birida bildirishnoma yubormaymiz (spam
    // bo'lardi). Buning o'rniga: qisqa kutib (albomning qolgan a'zolari
    // odatda 1 soniya ichida yetib keladi), shu guruhda O'ZIMIZDAN KEYIN
    // boshqa yangi a'zo kelmaganini tekshiramiz -- shunda bu ALBOMNING
    // OXIRGI xabari deb hisoblab, "albom qabul qilindi" deb bitta
    // umumiy xabar yuboramiz.
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const keyingilari = await sbFetch(env,
        `media_arxiv?media_group_id=eq.${mediaGroupId}&holat=eq.yangi&telegram_message_id=gt.${msg.message_id}&select=id&limit=1`);
      if (!keyingilari || !keyingilari.length) {
        const toplam = await sbFetch(env,
          `media_arxiv?media_group_id=eq.${mediaGroupId}&holat=eq.yangi&select=id`);
        const son = toplam ? toplam.length : 1;
        await tgSend(env.MIJOZ_BOT_TOKEN, msg.chat.id,
          `✅ Albom qabul qilindi (${son} ta rasm/video). Keyingi foto/videongizni yuborishingiz mumkin.`);
      }
    } catch (e) {
      // e'tiborsiz -- bu faqat qulaylik xabari
    }
  }
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
  if (caption) form.append('caption', caption.slice(0, 1024));
  form.append('photo', new Blob([pngBuffer], { type: 'image/png' }), 'oblojka.png');
  await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(25000),
  }).catch(() => {});
}

// Bir nechta rasmni BITTA karusel post (Telegram albom) sifatida yuboradi.
// Faqat birinchi rasmga caption (sarlavha) qo'yiladi -- shu butun albomning
// tagidagi matn sifatida ko'rinadi.
async function tgSendMediaGroup(token, chatId, pngBuffers, caption) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  const media = pngBuffers.map((buf, i) => {
    const field = `foto${i}`;
    form.append(field, new Blob([buf], { type: 'image/png' }), `${field}.png`);
    return { type: 'photo', media: `attach://${field}`, ...(i === 0 && caption ? { caption: caption.slice(0, 1024) } : {}) };
  });
  form.append('media', JSON.stringify(media));
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Telegram sendMediaGroup xato: ${res.status} ${txt.slice(0, 200)}`);
  }
}

// Tasdiqlangan Senarist taklifi uchun oblojka(lar) yasab, adminga DM'da
// yuboradi. Agar taklif YAGONA rasmga tegishli bo'lsa -- 3 xil shablon
// varianti (xilma-xillik uchun). Agar taklif KARUSEL (bir nechta rasm,
// Telegram albomidan) bo'lsa -- har biriga BITTA izchil shablon qo'yilib,
// hammasi BITTA Telegram albomi sifatida yuboriladi (faqat 1-rasmda katta
// sarlavha bo'ladi). MEDIA_SERVER_URL/MEDIA_SECRET sozlanmagan bo'lsa -- jim
// e'tiborsiz qoldiradi.
// Rasmni Supabase Storage'ning ochiq ("public-media") bucket'iga yuklaydi va
// ochiq URL qaytaradi -- Instagram Graph API rasmni FAQAT ochiq URL orqali
// qabul qiladi (fayl/base64 emas). Bucket mavjud bo'lmasa, avtomatik
// yaratiladi (public: true).
async function supabasePublicUpload(env, buffer, filename) {
  const bucket = 'public-media';
  const path = `instagram/${Date.now()}-${filename}`;
  const upload = async () => fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: buffer,
    signal: AbortSignal.timeout(20000),
  });

  let res = await upload();
  if (res.status === 404 || res.status === 400) {
    // bucket mavjud emasligi mumkin -- yaratib ko'ramiz
    await fetch(`${env.SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: bucket, name: bucket, public: true }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => {});
    res = await upload();
  }
  if (!res.ok) throw new Error(`Supabase Storage yuklash xato: ${res.status}`);
  return `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

async function igFetch(path, params) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: 'POST', signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) {
    throw new Error(`Instagram API xato: ${(data && data.error && data.error.message) || res.status}`);
  }
  return data;
}

// Bir nechta PNG'ni Supabase'ga yuklab, ochiq URL'lar ro'yxatini qaytaradi --
// Instagram va Facebook ikkalasi ham shu URL'larni (qayta yuklamasdan) ishlatadi.
async function ochiqUrllarYasash(env, pngBuffers) {
  const urls = [];
  for (let i = 0; i < pngBuffers.length; i++) {
    urls.push(await supabasePublicUpload(env, pngBuffers[i], `${i}.png`));
  }
  return urls;
}

// Tayyor oblojka(lar)ni Instagram Business akkauntga avtomatik post qiladi.
// INSTAGRAM_ACCESS_TOKEN/INSTAGRAM_BUSINESS_ACCOUNT_ID sozlanmagan bo'lsa --
// jim e'tiborsiz qoldiriladi (hali ulanmagan).
async function tgSendMessageOddiy(env, chatId, text) {
  await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}

async function instagramPost(env, urls, caption, adminChatId) {
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_BUSINESS_ACCOUNT_ID) return;
  if (!urls || !urls.length) return;
  try {
    const igId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    const token = env.INSTAGRAM_ACCESS_TOKEN;
    const igCaption = (caption || '').slice(0, 2200);

    if (urls.length === 1) {
      const container = await igFetch(`${igId}/media`, {
        image_url: urls[0],
        caption: igCaption,
        access_token: token,
      });
      await igFetch(`${igId}/media_publish`, { creation_id: container.id, access_token: token });
      return;
    }

    // Karusel: har bir rasm uchun child container, so'ng umumiy container
    const childIds = [];
    for (const url of urls.slice(0, 10)) {
      const child = await igFetch(`${igId}/media`, {
        image_url: url,
        is_carousel_item: 'true',
        access_token: token,
      });
      childIds.push(child.id);
    }
    const parent = await igFetch(`${igId}/media`, {
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption: igCaption,
      access_token: token,
    });
    await igFetch(`${igId}/media_publish`, { creation_id: parent.id, access_token: token });
  } catch (e) {
    // Instagram xato bersa ham, Telegram kanalga ketgan asosiy oqimni buzmaydi --
    // lekin sababini admin'ga yozamiz, aks holda jim yo'qolib ketadi.
    if (adminChatId) {
      await tgSendMessageOddiy(env, adminChatId, `⚠️ Instagram'ga post qo'yilmadi -- ${String((e && e.message) || e)}`);
    }
  }
}

// Facebook uchun eng yaqin "optimal" ertalabki oynani hisoblaydi (Toshkent,
// UTC+5): tadqiqotga ko'ra Facebook auditoriyasi ertalab 07:00-11:30 oralig'ida
// eng faol (Instagram'dan farqli). Hozir shu oraliqda bo'lsak -- DARHOL
// (navbat ortiqcha kutish keltirmasin), aks holda eng yaqin 09:00'ga.
function keyingiFacebookVaqt() {
  const TOSHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
  const hozirToshkent = new Date(Date.now() + TOSHKENT_OFFSET_MS);
  const hozirDaqiqa = hozirToshkent.getUTCHours() * 60 + hozirToshkent.getUTCMinutes();
  const oynaBosh = 7 * 60;
  const oynaOxiri = 11 * 60 + 30;
  const maqsadDaqiqa = 9 * 60;

  if (hozirDaqiqa >= oynaBosh && hozirDaqiqa <= oynaOxiri) {
    return new Date(); // allaqachon ertalabki oyna ichidamiz -- darhol
  }
  const kunOrttirish = hozirDaqiqa > oynaOxiri ? 1 : 0; // oyna o'tib ketgan bo'lsa -- ertaga
  const sana = new Date(hozirToshkent);
  sana.setUTCDate(sana.getUTCDate() + kunOrttirish);
  sana.setUTCHours(0, maqsadDaqiqa, 0, 0);
  return new Date(sana.getTime() - TOSHKENT_OFFSET_MS);
}

// Tayyor oblojka(lar)ni Facebook sahifasiga DARHOL emas, `nashr_navbati`
// navbatiga qo'yadi -- Instagram'dan ALOHIDA, o'z ertalabki "prime window"ida
// (functions/api/nashr-navbati.js, tashqi cron orqali) chiqishi uchun.
// FACEBOOK_PAGE_ID/INSTAGRAM_ACCESS_TOKEN sozlanmagan bo'lsa -- jim
// e'tiborsiz qoldiriladi.
async function facebookPost(env, urls, caption, adminChatId) {
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.FACEBOOK_PAGE_ID) return;
  if (!urls || !urls.length) return;
  try {
    await sbFetch(env, 'nashr_navbati', {
      method: 'POST',
      body: JSON.stringify({
        turi: 'facebook_photo',
        payload: { urls, caption: (caption || '').slice(0, 5000) },
        nashr_vaqti: keyingiFacebookVaqt().toISOString(),
      }),
    });
  } catch (e) {
    // navbatga qo'yishda xato bo'lsa ham, Telegram/Instagram oqimini buzmaydi --
    // lekin sababini admin'ga yozamiz.
    if (adminChatId) {
      await tgSendMessageOddiy(env, adminChatId, `⚠️ Facebook navbatiga qo'yilmadi -- ${String((e && e.message) || e)}`);
    }
  }
}

async function oblojkaTayyorlaVaYubor(env, taklifId, adminChatId) {
  if (!env.MEDIA_SERVER_URL || !env.MEDIA_SECRET) return;
  try {
    const taklifRows = await sbFetch(env, `media_taklif?id=eq.${taklifId}&select=*`);
    const taklif = taklifRows && taklifRows[0];
    if (!taklif) return;

    const idlar = taklif.media_arxiv_idlar
      ? taklif.media_arxiv_idlar.split(',').map((s) => s.trim()).filter(Boolean)
      : [String(taklif.media_arxiv_id)];
    const title = taklif.sarlavha || (taklif.matn || '').split('\n\n')[0];
    const kanalMatni = taklif.post_matni || title;

    // Oblojka/karusel FAQAT rasmlardan. Video bo'lsa -- uni Montajchi qayta
    // ishlaydi (alohida), videodan olingan bitta kadr rasm sifatida
    // postga tushmasin.
    const turiRows = await sbFetch(env, `media_arxiv?id=in.(${idlar.join(',')})&select=id,turi`);
    const rasmIdlarSet = new Set((turiRows || []).filter((r) => r.turi === 'photo').map((r) => String(r.id)));
    const rasmIdlar = idlar.filter((id) => rasmIdlarSet.has(String(id)));
    if (!rasmIdlar.length) return;
    idlar.splice(0, idlar.length, ...rasmIdlar);

    if (idlar.length <= 1) {
      const arxivRows = await sbFetch(env, `media_arxiv?id=eq.${idlar[0]}&select=file_id`);
      const fileId = arxivRows && arxivRows[0] ? arxivRows[0].file_id : null;
      if (!fileId) return;

      const filePath = await tgGetFilePath(env.MIJOZ_BOT_TOKEN, fileId);
      if (!filePath) return;
      const base64 = await tgDownloadBase64(env.MIJOZ_BOT_TOKEN, filePath);
      if (!base64) return;

      let kanalgaPng = null;
      for (const shablon of [1, 2, 3]) {
        try {
          const png = await oblojkaYasash(env, shablon, base64, title, null);
          await tgSendPhoto(env.MIJOZ_BOT_TOKEN, adminChatId, png, `Oblojka -- ${shablon}-shablon\n\n🆔${taklifId}`);
          if (shablon === 1) kanalgaPng = png; // kanalga 1-shablon (sarlavhali) ketadi
        } catch (e) {
          // bitta shablon xato bersa ham, qolganlariga davom
        }
      }
      if (kanalgaPng) {
        await kanalgaPost(env, [kanalgaPng], kanalMatni);
        const urls = await ochiqUrllarYasash(env, [kanalgaPng]);
        await instagramPost(env, urls, kanalMatni, adminChatId);
        await facebookPost(env, urls, kanalMatni, adminChatId);
      }
      return;
    }

    // Karusel: ko'pi bilan 10 ta (Telegram albom chegarasi)
    const tanlangan = idlar.slice(0, 10);
    const arxivRows = await sbFetch(env, `media_arxiv?id=in.(${tanlangan.join(',')})&select=id,file_id`);
    const fileById = {};
    (arxivRows || []).forEach((r) => { fileById[String(r.id)] = r.file_id; });

    const buffers = [];
    for (let i = 0; i < tanlangan.length; i++) {
      const fileId = fileById[String(tanlangan[i])];
      if (!fileId) continue;
      try {
        const filePath = await tgGetFilePath(env.MIJOZ_BOT_TOKEN, fileId);
        if (!filePath) continue;
        const base64 = await tgDownloadBase64(env.MIJOZ_BOT_TOKEN, filePath);
        if (!base64) continue;
        const png = i === 0
          ? await oblojkaYasash(env, 1, base64, title, null)
          : await oblojkaYasash(env, 'karusel', base64, null, null);
        buffers.push(png);
      } catch (e) {
        // bitta rasm xato bersa ham, qolganlariga davom
      }
    }
    if (buffers.length < 2) return; // yetarli rasm yig'ilmadi

    await tgSendMediaGroup(env.MIJOZ_BOT_TOKEN, adminChatId, buffers, `🎠 Karusel tayyor -- ${title}\n\n🆔${taklifId}`);
    await kanalgaPost(env, buffers, kanalMatni);
    const urls = await ochiqUrllarYasash(env, buffers);
    await instagramPost(env, urls, kanalMatni, adminChatId);
    await facebookPost(env, urls, kanalMatni, adminChatId);
  } catch (e) {
    // jim e'tiborsiz -- oblojka ixtiyoriy qo'shimcha, asosiy tasdiqni to'xtatmaydi
  }
}

// Tayyor oblojka(lar)ni "Visart Media" kanaliga avtomat post qiladi.
// TELEGRAM_CHANNEL_ID sozlanmagan bo'lsa -- jim e'tiborsiz qoldiradi (hali
// kanal ulanmagan). Bot o'sha kanalda ADMIN (post qilish huquqi bilan)
// bo'lishi SHART, aks holda Telegram xato qaytaradi (jim yutiladi).
async function kanalgaPost(env, pngBuffers, title) {
  if (!env.TELEGRAM_CHANNEL_ID || !pngBuffers || !pngBuffers.length) return;
  try {
    if (pngBuffers.length === 1) {
      await tgSendPhoto(env.MIJOZ_BOT_TOKEN, env.TELEGRAM_CHANNEL_ID, pngBuffers[0], title);
    } else {
      await tgSendMediaGroup(env.MIJOZ_BOT_TOKEN, env.TELEGRAM_CHANNEL_ID, pngBuffers, title);
    }
  } catch (e) {
    // kanalga post xato bersa ham, admin'ga ketgan asosiy oqimni buzmaydi
  }
}

// Tasdiqlangan taklif manbasi VIDEO bo'lsa, Render'dagi Montajchiga ishga
// tushirish so'rovini yuboradi (fire-and-forget -- Render darhol 202 qaytaradi,
// og'ir ish fonda davom etib, tugagach natijani to'g'ridan-to'g'ri Telegram
// orqali adminChatId'ga yuboradi). MEDIA_SERVER_URL/MEDIA_SECRET sozlanmagan
// yoki manba rasm bo'lsa -- jim e'tiborsiz qoldiradi.
async function montajBoshlash(env, taklifId, adminChatId, korsatma) {
  if (!env.MEDIA_SERVER_URL || !env.MEDIA_SECRET) return;
  try {
    const taklifRows = await sbFetch(env, `media_taklif?id=eq.${taklifId}&select=*`);
    const taklif = taklifRows && taklifRows[0];
    if (!taklif) return;

    const arxivRows = await sbFetch(env, `media_arxiv?id=eq.${taklif.media_arxiv_id}&select=turi,asl_file_id`);
    const arxiv = arxivRows && arxivRows[0];
    if (!arxiv || !arxiv.asl_file_id) return; // rasm yoki asl video topilmadi -- montaj shart emas
    if (arxiv.turi !== 'video' && arxiv.turi !== 'video_note') return;

    const title = taklif.sarlavha || (taklif.matn || '').split('\n\n')[0];
    await fetch(`${env.MEDIA_SERVER_URL}/montaj`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Media-Secret': env.MEDIA_SECRET },
      body: JSON.stringify({ aslFileId: arxiv.asl_file_id, adminChatId, title, taklifId, korsatma }),
      // Render bepul tarifda uxlab qolgan bo'lsa, uyg'onishi 50+ soniya
      // olishi mumkin -- ulanish shu vaqt ichida o'rnatilishi uchun uzoqroq
      // timeout beramiz (aks holda so'rov Render'ga umuman YETIB BORMAYDI).
      signal: AbortSignal.timeout(55000),
    });
  } catch (e) {
    // Juda sekin bo'lsa ham -- keyingi safar qo'lda qayta urinib ko'rish mumkin.
  }
}

// Admin natija xabariga reply qilib yozgan ko'rsatmasini bajaradi: video
// bo'lsa Montajchini ko'rsatma bilan qayta ishga tushiradi, rasm/karusel
// bo'lsa Claude orqali matnni (sarlavha+post_matni) qayta yozdiradi va
// Oblojkani qaytadan yuborib qo'yadi.
async function tuzatishBajar(env, taklifId, adminChatId, korsatma) {
  try {
    const taklifRows = await sbFetch(env, `media_taklif?id=eq.${taklifId}&select=*`);
    const taklif = taklifRows && taklifRows[0];
    if (!taklif) return;
    const arxivRows = await sbFetch(env, `media_arxiv?id=eq.${taklif.media_arxiv_id}&select=turi`);
    const turi = arxivRows && arxivRows[0] ? arxivRows[0].turi : null;

    if (turi === 'video' || turi === 'video_note') {
      await tgSend(env.MIJOZ_BOT_TOKEN, adminChatId, "🔧 Ko'rsatmangiz bilan Montajchi qayta ishga tushirilmoqda...");
      await montajBoshlash(env, taklifId, adminChatId, korsatma);
      return;
    }

    await tgSend(env.MIJOZ_BOT_TOKEN, adminChatId, "🔧 Ko'rsatmangiz bilan matn qayta yozilmoqda...");
    const yangi = await claudeMatnTuzatish(env, taklif.sarlavha, taklif.post_matni, korsatma);
    if (!yangi || yangi.xato) {
      await tgSend(env.MIJOZ_BOT_TOKEN, adminChatId, `⚠️ Matnni qayta yozishda xato: ${(yangi && yangi.xato) || "noma'lum"}`);
      return;
    }
    await sbFetch(env, `media_taklif?id=eq.${taklifId}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({
        sarlavha: yangi.sarlavha,
        post_matni: yangi.post_matni,
        matn: `${yangi.sarlavha}\n\n${taklif.matn ? taklif.matn.split('\n\n').slice(1).join('\n\n') : ''}`,
      }),
    });
    await tgSendMessageKb(env, adminChatId,
      `✏️ Tuzatilgan variant:\n\n${yangi.sarlavha}\n\n${yangi.post_matni}\n\nShu holatda joylansinmi?\n\n🆔${taklifId}`,
      { inline_keyboard: [[{ text: '✅ Tasdiqlash', callback_data: `stak:${taklifId}:ok` }, { text: '❌ Rad etish', callback_data: `stak:${taklifId}:no` }]] });
  } catch (e) {
    await tgSend(env.MIJOZ_BOT_TOKEN, adminChatId, `⚠️ To'g'irlashda xato: ${String((e && e.message) || e)}`);
  }
}

async function claudeMatnTuzatish(env, oldSarlavha, oldPostMatni, korsatma) {
  if (!env.ANTHROPIC_API_KEY) return null;
  const prompt =
    "Siz Visart Design uchun ijtimoiy tarmoq matnlari yozuvchi kontent-menejersiz.\n\n" +
    `Oldingi sarlavha: "${oldSarlavha || ''}"\n` +
    `Oldingi post matni: "${oldPostMatni || ''}"\n\n` +
    `Admin shu ko'rsatmani berdi: "${korsatma}"\n\n` +
    "Shu ko'rsatmaga asosan matnni qayta yozing. Qoidalar o'zgarmas:\n" +
    "- Hech qanday faktni (raqam, joy, o'lcham) o'ylab topmang -- faqat berilgan ma'lumotlarga tayaning.\n" +
    "- Sodda, tabiiy, zamonaviy o'zbek tilida yozing (rus tilidan kalka tarjima taqiqlangan).\n" +
    "- Formatlash belgilari (**, *, __) ishlatmang. Bullet ro'yxat emas, ravon jumlalar bilan yozing.\n" +
    "- post_matni oxirida 4-6 ta tegishli hashtag bo'lsin.\n\n" +
    'JAVOBNI FAQAT shu JSON formatda qaytaring: {"sarlavha": "<yangi sarlavha>", "post_matni": "<yangi post matni>"}';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { xato: `Claude API -> ${res.status}: ${txt.slice(0, 300)}` };
    }
    const data = await res.json();
    const textBlok = (data.content || []).find((b) => b.type === 'text');
    const text = textBlok ? textBlok.text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { xato: `Claude javobi JSON emas (stop=${data.stop_reason}): ${text.slice(0, 200)}` };
    return JSON.parse(match[0]);
  } catch (e) {
    return { xato: String((e && e.message) || e) };
  }
}


// TEZKOR REJIM: admin shaxsiy chatda rasm/video yuborib, izohga erkin
// ko'rsatma yozsa -- Senarist'ni chetlab o'tib, shu materialdan post
// tayyorlanadi. Rasm: Claude izohdan sarlavha+matn yozadi va odatdagi
// "✅ Tasdiqlash" taklifi chiqadi. Video: ko'rsatma bilan darhol Montajchi
// ishga tushadi (oxirida "✅ Joylash" tasdig'i so'raladi).
async function claudeTezkorMatn(env, korsatma) {
  if (!env.ANTHROPIC_API_KEY) return { xato: 'ANTHROPIC_API_KEY yo\'q' };
  const prompt =
    "Siz Visart Design (Toshkent, arxitektura va interyer studiyasi) uchun ijtimoiy tarmoq matnlari yozuvchisiz.\n\n" +
    `Admin rasm yubordi va shunday ko'rsatma berdi: "${korsatma}"\n\n` +
    "Shu ko'rsatmaga amal qilib post tayyorlang. Qoidalar:\n" +
    "- Hech qanday faktni (raqam, joy, o'lcham, narx) o'ylab topmang -- faqat ko'rsatmadagi ma'lumotga tayaning.\n" +
    "- Sodda, tabiiy, zamonaviy o'zbek tilida yozing (rus tilidan kalka yo'q). Formatlash belgilari (**, *) yo'q.\n" +
    "- 1-qator kuchli hook, so'ng 2-3 qisqa gap, oxirida savol yoki CTA; eng oxirida 5-7 ta hashtag.\n\n" +
    'JAVOBNI FAQAT JSON: {"sarlavha": "<3-6 so\'z>", "post_matni": "<matn>"}';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return { xato: `Claude API -> ${res.status}` };
    const data = await res.json();
    const t = ((data.content || []).find((x) => x.type === 'text') || {}).text || '';
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) return { xato: `JSON emas: ${t.slice(0, 150)}` };
    return JSON.parse(m[0]);
  } catch (e) {
    return { xato: String((e && e.message) || e) };
  }
}

function mediaMalumot(msg) {
  if (msg.photo && msg.photo.length) return { turi: 'photo', fileId: msg.photo[msg.photo.length - 1].file_id, aslFileId: null };
  if (msg.video) return { turi: 'video', fileId: (msg.video.thumbnail || msg.video.thumb || {}).file_id || null, aslFileId: msg.video.file_id };
  if (msg.video_note) return { turi: 'video_note', fileId: (msg.video_note.thumbnail || msg.video_note.thumb || {}).file_id || null, aslFileId: msg.video_note.file_id };
  if (msg.document && (msg.document.mime_type || '').startsWith('image/')) return { turi: 'photo', fileId: msg.document.file_id, aslFileId: null };
  if (msg.document && (msg.document.mime_type || '').startsWith('video/')) return { turi: 'video', fileId: (msg.document.thumbnail || msg.document.thumb || {}).file_id || null, aslFileId: msg.document.file_id };
  return null;
}

// Izohsiz media: avval "bazaga yoki hozir postmi?" deb so'raladi.
async function tezkorSoraSavol(env, msg) {
  if (msg.media_group_id) {
    // Albom -- har rasm uchun so'ramaymiz, jimgina bazaga (Senarist uchun) saqlanadi.
    const m = mediaMalumot(msg);
    if (!m) return;
    await sbFetch(env, 'media_arxiv', {
      method: 'POST', prefer: 'return=minimal',
      body: JSON.stringify([{ telegram_chat_id: msg.chat.id, telegram_message_id: msg.message_id, turi: m.turi,
        asl_file_id: m.aslFileId, file_id: m.fileId, media_group_id: msg.media_group_id }]),
    }).catch(() => {});
    return;
  }
  await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: msg.chat.id,
      reply_to_message_id: msg.message_id,
      text: "Bu material nima uchun?",
      reply_markup: { inline_keyboard: [[
        { text: '📥 Bazaga (Senarist uchun)', callback_data: 'tzk:baza' },
        { text: '⚡ Hozir post', callback_data: 'tzk:hozir' },
      ]] },
    }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}

async function handleTezkorTanlov(env, cq, data) {
  const chatId = cq.message.chat.id;
  if (!isAdmin(env, cq.from && cq.from.id)) { await answerCq(env, cq.id, { text: "Ruxsat yo'q" }); return; }
  const asl = cq.message.reply_to_message;
  const m = asl && mediaMalumot(asl);
  await removeKb(env, chatId, cq.message.message_id);
  if (!m) { await answerCq(env, cq.id, { text: 'Material topilmadi' }); return; }
  const baza = data === 'tzk:baza';
  try {
    const arx = await sbFetch(env, 'media_arxiv', {
      method: 'POST', prefer: 'return=representation',
      body: JSON.stringify([{ telegram_chat_id: chatId, telegram_message_id: asl.message_id, turi: m.turi,
        asl_file_id: m.aslFileId, file_id: m.fileId, holat: baza ? 'yangi' : 'ishlangan' }]),
    });
    const aid = arx && arx[0] && arx[0].id;
    if (baza) {
      await tgSend(env.MIJOZ_BOT_TOKEN, chatId, `📥 Bazaga saqlandi (#${aid}). Senarist keyingi tahlilda ko'radi.`);
    } else {
      await tgSend(env.MIJOZ_BOT_TOKEN, chatId,
        `⚡ Izoh qoldiring: shu xabarga REPLY qilib nimani xohlasangiz yozing (masalan: "styajka tugadi, qisqa va ishonchli yoz").\n\n📎${aid}`);
    }
    await answerCq(env, cq.id, { text: baza ? 'Saqlandi' : 'Izoh yozing' });
  } catch (e) {
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, `⚠️ Xato: ${String((e && e.message) || e)}`);
  }
}

// "📎<arxiv_id>" xabariga reply qilingan izoh -- tezkor postni ishga tushiradi.
async function handleTezkorIzoh(env, chatId, arxivId, korsatma) {
  const rows = await sbFetch(env, `media_arxiv?id=eq.${arxivId}&select=*`).catch(() => null);
  const r = rows && rows[0];
  if (!r) { await tgSend(env.MIJOZ_BOT_TOKEN, chatId, '⚠️ Material topilmadi'); return; }
  await tezkorIshlat(env, chatId, r.id, r.turi, korsatma);
}

async function handleTezkor(env, msg) {
  const chatId = msg.chat.id;
  const korsatma = (msg.caption || '').trim();
  const m = mediaMalumot(msg);
  if (!m) return;
  const { turi, fileId, aslFileId } = m;
  try {
    const arx = await sbFetch(env, 'media_arxiv', {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify([{
        telegram_chat_id: chatId, telegram_message_id: msg.message_id, turi,
        izoh: korsatma, asl_file_id: aslFileId, file_id: fileId, holat: 'ishlangan',
      }]),
    });
    const arxivId = arx && arx[0] && arx[0].id;
    if (!arxivId) throw new Error('arxivga yozilmadi');

    await tezkorIshlat(env, chatId, arxivId, turi, korsatma);
  } catch (e) {
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, `⚠️ Tezkor rejimda xato: ${String((e && e.message) || e)}`);
  }
}

async function tezkorIshlat(env, chatId, arxivId, turi, korsatma) {
  try {
    if (turi === 'photo') {
      await tgSend(env.MIJOZ_BOT_TOKEN, chatId, '⚡ Tezkor rejim: matn tayyorlanmoqda...');
      const y = await claudeTezkorMatn(env, korsatma);
      if (!y || y.xato) {
        await tgSend(env.MIJOZ_BOT_TOKEN, chatId, `⚠️ Matn yozishda xato: ${(y && y.xato) || "noma'lum"}`);
        return;
      }
      const t = await sbFetch(env, 'media_taklif', {
        method: 'POST',
        prefer: 'return=representation',
        body: JSON.stringify([{
          matn: `${y.sarlavha}\n\n${korsatma}`, sarlavha: y.sarlavha, post_matni: y.post_matni,
          media_arxiv_id: arxivId, media_arxiv_idlar: String(arxivId), holat: 'kutilmoqda',
        }]),
      });
      const tid = t && t[0] && t[0].id;
      await tgSendMessageKb(env, chatId,
        `⚡ Tezkor post:\n\n📝 ${y.sarlavha}\n\n📄 Post matni:\n${y.post_matni}\n\nTuzatish uchun shu xabarga REPLY qiling.\n\n🆔${tid}`,
        { inline_keyboard: [[
          { text: '✅ Tasdiqlash', callback_data: `stak:${tid}:ok` },
          { text: '❌ Rad etish', callback_data: `stak:${tid}:no` },
        ]] });
    } else {
      const t = await sbFetch(env, 'media_taklif', {
        method: 'POST',
        prefer: 'return=representation',
        body: JSON.stringify([{
          matn: korsatma, media_arxiv_id: arxivId, media_arxiv_idlar: String(arxivId), holat: 'tasdiqlangan',
        }]),
      });
      const tid = t && t[0] && t[0].id;
      await tgSend(env.MIJOZ_BOT_TOKEN, chatId, "⚡ Tezkor rejim: ko'rsatma qabul qilindi, Montajchi ishga tushdi. Tayyor bo'lgach joylashdan oldin tasdiq so'rayman.");
      await montajBoshlash(env, tid, chatId, korsatma);
    }
  } catch (e) {
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, `⚠️ Tezkor rejimda xato: ${String((e && e.message) || e)}`);
  }
}

async function tgSendMessageKb(env, chatId, text, kb) {
  await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: kb }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}

function adminIdlari(env) {
  return (env.ADMIN_TELEGRAM_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

// Senarist -- vazifa asosida TO'LIQ suratga olish ssenariysi yozadi (hali
// hech narsa suratga olinmagan, admin faqat qisqa topshiriq beradi). Oddiy
// "mavjud materialdan post tanlash" (claudeTahlil, senarist-tahlil.js) dan
// farqli -- bu YANGI kontent REJALASHTIRISH vositasi: /senariy <topshiriq>
// buyrug'i orqali chaqiriladi (faqat shaxsiy chatda, admin).
async function claudeSsenariyYoz(env, topshiriq) {
  if (!env.ANTHROPIC_API_KEY) return null;
  const prompt =
    "Siz Visart Design (Toshkent, arxitektura/interyer studiyasi) uchun ishlaydigan, marketing, SEO va barcha asosiy " +
    "ijtimoiy tarmoqlar (Instagram Reels/Stories, Telegram, YouTube Shorts, Facebook) algoritmlarini professional " +
    "darajada biladigan Senarist-strategsiz. Admin sizga aniq VAZIFA beradi, siz esa jamoa (operator/videograf) " +
    "DARHOL dalaga chiqib suratga olishi mumkin bo'lgan, TO'LIQ, amaliy ssenariy tuzasiz.\n\n" +
    `VAZIFA: "${topshiriq}"\n\n` +
    "Ssenariy quyidagi qismlardan iborat bo'lishi SHART:\n" +
    "1) FORMAT TAVSIYASI -- shu vazifa uchun ENG mos format (Reels / Stories ketma-ketligi / Karusel / Tasvir), " +
    "va NEGA aynan shu (bir jumla).\n" +
    "2) HOOK (birinchi 1-2 soniya) -- aniq, suratga olinadigan harakat/kadr tavsifi (statik kadr EMAS).\n" +
    "3) KADRLAR RO'YXATI (shot list) -- har biri: kamera burchagi/harakati, nima ko'rsatiladi, necha soniya " +
    "taxminan (jami video 20-45 soniya atrofida bo'lsin, Reels pacing).\n" +
    "4) GAPIRILADIGAN MATN (agar kerak bo'lsa) -- qisqa, tabiiy, sodda o'zbek tilida, kamera oldida aytiladigan " +
    "aniq jumlalar (so'zma-so'z). Agar bu sof vizual (gapirishsiz) video bo'lsa, bo'sh qoldiring.\n" +
    "5) EKRANDAGI MATN/SUBTITR TAKLIFI -- video ustiga chiqadigan qisqa matn bosqichlari (agar kerak bo'lsa).\n" +
    "6) MUZIKA KERAKMI -- true/false. Agar video gapirib ma'lumot berish/tushuntirish asosida bo'lsa (ovoz " +
    "o'zi diqqat markazida), odatda false (fon muzika shart emas, ovozga xalaqit beradi). Agar vizual/ritmik " +
    "(gapirishsiz, faqat chiroyli kadrlar) bo'lsa, odatda true.\n" +
    "7) CAPTION (post matni) -- 2-4 jumla, SEO kalit so'zlar (\"Toshkentda interyer dizayn\", \"arxitektura " +
    "studiyasi\" kabi qidiriladigan iboralarni tabiiy singdirib yozing, zo'rlab emas), oxirida aniq CTA.\n" +
    "8) HASHTAG REJASI -- 6-8 ta, 3 qatlamli (2-3 keng, 2-3 tor/nish, 2 mahalliy #toshkent/#uzbekistan/#visartdesign).\n" +
    "9) QAYSI TARMOQLARGA -- vazifaga qarab Instagram/Telegram/YouTube/Facebook'dan qaysilari, va qaysi " +
    "TARTIBDA, HAR BIRINI TURLI VAQTGA TARQATIB (bitta videoni bir vaqtda hammaga tashlamang -- shunda u " +
    "4 ta platformaning har birida alohida \"prime window\"ga tushadi): odatda avval Instagram Reels, so'ng " +
    "o'sha kuni Telegram'da kengroq izoh bilan, ertasi kuni ertalab Facebook'ga qayta joylash, so'ng shu " +
    "kadrlardan Stories qilib qayta ishlatish (va agar mos bo'lsa, YouTube Shorts'ga ham).\n" +
    "10) ENG YAXSHI NASHR VAQTI -- vazifa kuni qaysi haftaning kuniga to'g'ri kelishini hisobga olib, " +
    "O'ZBEKISTON auditoriyasi tadqiqotiga asoslangan HAFTALIK REJADAN tavsiya bering (Toshkent vaqti):\n" +
    "    - Instagram Reels: Seshanba yoki Payshanba 19:30 -- bular \"flagship\" kun, eng kuchli IG oynasi (18:30-21:00, Sesh-Pay eng kuchli kunlar).\n" +
    "    - Instagram carousel/post: Chorshanba 12:15 (tushlik oynasi) yoki 18:30 (kechki oyna).\n" +
    "    - Instagram Stories: kun bo'ylab bir nechta bosqich -- 08:15 (ob'ektdan 1-2 kadr), 13:00 (savol/poll), " +
    "19:15 (asosiy post haqida teaser, agar shu kuni Reel bo'lsa), 21:30 (savol-javob) -- faqat bitta \"katta\" Story emas.\n" +
    "    - Facebook: Seshanba/Payshanba ertalab 09:00 (Facebook auditoriyasi IG'dan farqli -- ertalabki soatlarda kuchliroq).\n" +
    "    - Telegram: 20:00 (Sesh-Pay va Yakshanba eng kuchli kunlar).\n" +
    "    - YouTube Shorts: Juma 18:00 (Payshanba-Shanba kuchli oyna, 16:00-20:00).\n" +
    "    - YouTube uzun video: Yakshanba 10:00 (long-form uchun eng kuchli yakka slot) yoki 19:00.\n" +
    "    - Dushanba/Shanba kunlari katta \"flagship\" Reel SHART EMAS -- faqat Stories bilan auditoriyani isitish tavsiya etiladi.\n" +
    "    ESLATMA: vaqt faqat KUCHAYTIRUVCHI omil -- birinchi 1-2 soniyadagi hook, retention va save/share " +
    "qiymati asosiy omil, to'g'ri vaqt esa shularga boshlang'ich tezlik beradi, xolos.\n\n" +
    "QOIDALAR: hech qanday o'ylab topilgan raqam/fakt yozmang (faqat vazifada aytilgan yoki umumiy dizayn " +
    "tamoyillariga tayaning); \"ajoyib/mukammal/eng yaxshi\" kabi asossiz hype so'zlardan qoching; sodda, " +
    "tabiiy, zamonaviy o'zbek tilida (lotin), rus tilidan kalka tarjima yo'q; formatlash belgilari (**, *, __) " +
    "ishlatmang.\n\n" +
    'JAVOBNI FAQAT shu JSON formatda qaytaring: {"format": "...", "hook": "...", "kadrlar": ["1) ...", "2) ..."], ' +
    '"gap_matni": "...", "ekran_matni": ["...", "..."], "muzika_kerak": true/false, "caption": "...", ' +
    '"hashtaglar": ["#...", ...], "tarmoqlar": "...", "nashr_vaqti": "..."}';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1400,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const textBlok = (data.content || []).find((b) => b.type === 'text');
    const text = textBlok ? textBlok.text : '';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch (e) {
    return null;
  }
}

function htmlEscape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function ssenariyMatnQil(sRaw) {
  if (!sRaw) return "⚠️ Ssenariy yozishda xato bo'ldi (Claude javob bermadi). Qayta urinib ko'ring.";
  // Telegram HTML parse_mode'ga yuborilgani uchun har bir maydonni escape qilamiz.
  const s = {
    format: htmlEscape(sRaw.format), tarmoqlar: htmlEscape(sRaw.tarmoqlar), nashr_vaqti: htmlEscape(sRaw.nashr_vaqti),
    hook: htmlEscape(sRaw.hook), gap_matni: htmlEscape(sRaw.gap_matni), caption: htmlEscape(sRaw.caption),
    muzika_kerak: sRaw.muzika_kerak,
    kadrlar: (sRaw.kadrlar || []).map(htmlEscape), ekran_matni: (sRaw.ekran_matni || []).map(htmlEscape),
    hashtaglar: (sRaw.hashtaglar || []).map(htmlEscape),
  };
  const kadrlar = (s.kadrlar || []).join('\n');
  const ekranMatn = (s.ekran_matni || []).join(' → ');
  const hashtaglar = (s.hashtaglar || []).join(' ');
  return (
    `🎬 SSENARIY\n\n` +
    `📐 Format: ${s.format || '-'}\n` +
    `📡 Tarmoqlar: ${s.tarmoqlar || '-'}\n` +
    `🕐 Nashr vaqti: ${s.nashr_vaqti || '-'}\n\n` +
    `🪝 Hook: ${s.hook || '-'}\n\n` +
    `🎥 Kadrlar:\n${kadrlar || '-'}\n\n` +
    (s.gap_matni ? `🗣️ Gapiriladigan matn:\n${s.gap_matni}\n\n` : '') +
    (ekranMatn ? `📝 Ekrandagi matn: ${ekranMatn}\n\n` : '') +
    `🎵 Muzika kerakmi: ${s.muzika_kerak ? 'Ha' : "Yo'q (ovoz/ma'lumot diqqat markazida)"}\n\n` +
    `📄 Caption:\n${s.caption || '-'}\n\n` +
    `#️⃣ ${hashtaglar || '-'}`
  );
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

  // Yangi foto/video keldi -- rad etishdan keyingi eslatmalar to'xtatiladi.
  await sbFetch(env, `nashr_navbati?turi=eq.usta_eslatma&holat=eq.kutilmoqda&payload->>chat_id=eq.${chatId}`, {
    method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ holat: 'bekor' }),
  }).catch(() => {});

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
async function obyektNomi(env, obyektId) {
  try {
    const o = await sbFetch(env, `obyektlar?id=eq.${encodeURIComponent(obyektId)}&select=nom`);
    return (o && o[0] && o[0].nom) || String(obyektId);
  } catch (e) { return String(obyektId); }
}

// Usta ismi Telegram nikidan emas, Moliya ilovasidagi `ustalar` jadvalidan (obyekt bo'yicha).
// Ish turiga mos mutaxassislik bo'lsa shular, aks holda obyektdagi barcha ustalar.
async function obyektUstalari(env, obyektId, kasbLabel) {
  try {
    const r = await sbFetch(env, `ustalar?obyekt_id=eq.${encodeURIComponent(obyektId)}&select=ism,mutaxassislik,holat`);
    if (!r || !r.length) return '';
    const k = String(kasbLabel || '').toLowerCase().replace(/[^a-zа-яё0-9ʻʼ'‘’ ]/gi, '').trim().split(' ')[0].slice(0, 5);
    const mos = k ? r.filter(u => String(u.mutaxassislik || '').toLowerCase().includes(k)) : [];
    return (mos.length ? mos : r).slice(0, 5).map(u => u.ism).filter(Boolean).join(', ');
  } catch (e) { return ''; }
}

async function handleUstaKategoriya(env, cq, data) {
  const [, kasbCode, groupChatIdStr, msgIdStr] = data.split(':');
  const groupChatId = groupChatIdStr;
  const origMsgId = Number(msgIdStr);
  const kasbLabel = kasbNomi(kasbCode);

  await removeKb(env, cq.message.chat.id, cq.message.message_id);
  await tgSend(env.MIJOZ_BOT_TOKEN, groupChatId, `📨 Qabul qilindi (${kasbLabel}). Admin ko'rib chiqadi — natijani shu yerga yozaman.`);
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
  const obNom = await obyektNomi(env, obyektId);
  const ustaKim = await obyektUstalari(env, obyektId, kasbLabel);

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
      body: JSON.stringify({ chat_id: adminId, text: `👷 ${obNom} — ${kasbLabel}${ustaKim ? `\n🧑‍🔧 Ushbu obyektdagi usta(lar): ${ustaKim}` : ''}\nYangi video/foto:` }),
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
function toshkentSana() {
  const d = new Date(Date.now() + 5 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

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

  // Bir nechta admin bo'lsa: birinchi qaror yakuniy, qolganlariga "allaqachon ko'rib chiqilgan"
  const kalit = `${groupChatId}:${origMsgId}`;
  try {
    const bor = await sbFetch(env, `nashr_navbati?turi=eq.usta_qaror&payload->>kalit=eq.${encodeURIComponent(kalit)}&select=id&limit=1`);
    if (bor && bor.length) { await answerCq(env, cq.id, { text: "Bu allaqachon ko'rib chiqilgan.", show_alert: true }); return; }
    await sbFetch(env, 'nashr_navbati', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify([{
      turi: 'usta_qaror', payload: { kalit, amal, admin: cq.from && cq.from.id }, nashr_vaqti: new Date().toISOString(), holat: 'bajarildi' }]) });
  } catch (e) { /* jadval xatosi -- qarorni to'xtatmaymiz */ }

  if (amal === 'uno') {
    await tgSend(env.MIJOZ_BOT_TOKEN, cq.message.chat.id, '❌ Rad etildi — mijozga yuborilmadi. Ustalarga 1 soat davomida (30 va 60-daqiqada) eslatma boradi (yangi foto/video kelsa to\'xtaydi).');
    try {
      // eski kutilayotgan eslatmalarni bekor qilib, yangisini rejalashtiramiz
      await sbFetch(env, `nashr_navbati?turi=eq.usta_eslatma&holat=eq.kutilmoqda&payload->>chat_id=eq.${groupChatId}`, {
        method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ holat: 'bekor' }),
      }).catch(() => {});
      const now = Date.now();
      await sbFetch(env, 'nashr_navbati', {
        method: 'POST', prefer: 'return=minimal',
        body: JSON.stringify([1, 2].map((k) => ({
          turi: 'usta_eslatma',
          payload: { chat_id: String(groupChatId), reply_to: origMsgId, kasb: kasbLabel, k },
          nashr_vaqti: new Date(now + k * 30 * 60 * 1000).toISOString(),
        }))),
      });
    } catch (e) { /* eslatma ixtiyoriy */ }
    await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: groupChatId,
        reply_to_message_id: origMsgId,
        text: `❌ Hurmatli ustalar, bugungi (${toshkentSana()}) ${kasbLabel} bo'yicha murojaatingiz rad etildi. Iltimos, ko'rib chiqib, foto/video hisobotni boshqatdan yuboring. 🙏`,
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
        const obNom = await obyektNomi(env, obyektId);
        await tgSend(env.MIJOZ_BOT_TOKEN, clientChatId, `🎥 ${htmlEscape(obNom)} — bugungi ${kasbLabel} ustalar kunlik hisob videosi:`);
        await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/copyMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: clientChatId, from_chat_id: groupChatId, message_id: origMsgId }),
          signal: AbortSignal.timeout(10000),
        });
        await tgSend(env.MIJOZ_BOT_TOKEN, cq.message.chat.id, '✅ Mijoz guruhiga yuborildi.');
        await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: groupChatId,
            reply_to_message_id: origMsgId,
            text: `✅ Tasdiqlandi! Bugungi (${toshkentSana()}) ${kasbLabel} bo'yicha murojaatingiz ko'rib chiqildi va mijozga yetkazildi. Ish yopildi. Rahmat, charchamang! 💪`,
          }),
          signal: AbortSignal.timeout(10000),
        }).catch(() => {});
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

function estimateText(pricing, xizmatCode, maydon, hujjat) {
  const yoq = "Menejer tez orada aniq narxni aytib beradi.";
  if (!pricing) return "Hozircha narx ma'lumotini olib bo'lmadi — menejer sizga aniq narxni ayta oladi.";
  const f = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (xizmatCode === 'arch' && pricing.architecture && pricing.architecture.ratePerSotix) {
    const dk = hujjat ? ((pricing.architecture.addons || []).find((a) => a.id === 'docs') || {}).flat || 0 : 0;
    const asos = pricing.architecture.ratePerSotix * maydon;
    return `Taxminiy narx (Standart, 1 qavat): ${f(asos + dk)} so'm${dk ? ` (loyiha ${f(asos)} + hujjatlashtirish ${f(dk)})` : ''}. Narx turar joy uchun 500 m² gacha, noturar bino uchun 300 m³ gacha amal qiladi; katta maydonda narx loyihaga qarab belgilanadi. Aniq narx menejer bilan kelishiladi.`;
  }
  if (xizmatCode === 'interior' && pricing.interior && pricing.interior.packages) {
    const r = pricing.interior.packages.map((x) => x.rate * maydon);
    return `Taxminiy narx: ${f(Math.min(...r))} – ${f(Math.max(...r))} so'm (paketga qarab: Standart–Lyuks). Aniq narx menejer bilan kelishiladi.`;
  }
  if (xizmatCode === 'turnkey' && pricing.turnkey) {
    const tk = pricing.turnkey;
    const tier = tk.areaTiers.find((t) => maydon <= t.maxArea) || tk.areaTiers[tk.areaTiers.length - 1];
    const mg = tk.managementTiers.find((t) => maydon <= t.maxArea) || tk.managementTiers[tk.managementTiers.length - 1];
    let mn = 0, mx = 0;
    for (const c of tk.components) { const t = tier[c.id]; if (t) { mn += t.min * maydon; mx += t.max * maydon; } }
    const k = pricing.usdRate || 12700;
    return `Taxminiy narx (Standart uslub): $${f(mn * (1 + mg.pct))} – $${f(mx * (1 + mg.pct))} (≈ ${f(mn * (1 + mg.pct) * k)} – ${f(mx * (1 + mg.pct) * k)} so'm). Aniq narx menejer bilan kelishiladi.`;
  }
  return yoq;
}

async function handleText(env, chatId, dialog, text) {
  const step = dialog ? dialog.step : 'ism';
  const til = (await getProfil(env, H, chatId)).til;

  if (!dialog) {
    await menyuKorsat(env, H, chatId, true);
    return;
  }
  if (step === 'menu') {
    await menyuKorsat(env, H, chatId, false);
    return;
  }
  if (String(step).startsWith('nx:')) {
    await narxMaydonMatn(env, H, chatId, dialog, text);
    return;
  }

  if (step === 'ism') {
    const ism = text.trim().slice(0, 100);
    if (ism.length < 2) {
      await tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'ism_q'));
      return;
    }
    await upsertDialog(env, chatId, { step: 'telefon', ism });
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'tel_q'));
    return;
  }

  if (step === 'telefon') {
    const tel = text.trim();
    if (!/^\+?[\d\s().-]{9,20}$/.test(tel)) {
      await tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'tel_xato'));
      return;
    }
    await upsertDialog(env, chatId, { step: 'xizmat', telefon: tel });
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'xizmat_q'), xizmatKeyboard(til));
    return;
  }

  if (step === 'xizmat') {
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'xizmat_tugma'), xizmatKeyboard(til));
    return;
  }

  if (step === 'maydon') {
    const m2 = parseFloat(text.replace(',', '.').replace(/[^\d.]/g, ''));
    if (!m2 || m2 <= 0 || m2 > 100000) {
      await tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'maydon_xato'));
      return;
    }
    if (dialog.xizmat_turi === 'arch') {
      await upsertDialog(env, chatId, { step: `dok:${m2}` });
      await tgSend(env.MIJOZ_BOT_TOKEN, chatId,
        til === 'ru' ? 'Нужна ли оформление документации (согласования, разрешения)?' : "Hujjatlashtirish (ruxsatnoma, kelishuvlar) ham kerakmi?",
        { inline_keyboard: [[{ text: til === 'ru' ? '✅ Да' : '✅ Ha', callback_data: 'dk:1' }, { text: til === 'ru' ? '❌ Нет' : "❌ Yo'q", callback_data: 'dk:0' }]] });
      return;
    }
    await finishDialog(env, chatId, dialog, m2);
    return;
  }

  // step === 'tugallandi' -> erkin xabar, menejerga uzatiladi
  for (const mid of menejerlar(env)) {
    await tgSend(env.MIJOZ_BOT_TOKEN, mid,
      `✉️ Mijozdan qo'shimcha xabar (chat ${chatId}, ${escH(dialog.ism || '—')}):\n${escH(text)}`);
  }
  await tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'qm'));
}

// ── ADMIN PANEL ──
async function adminTaklifQabul(env, msg, tok) {
  const chatId = msg.chat.id;
  const r = await sbFetch(env, `bot_adminlar?token=eq.${tok}&chat_id=is.null&select=id,token_exp,qoshdi`).catch(() => null);
  const row = r && r[0];
  if (!row || new Date(row.token_exp) < new Date()) {
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, "Havola eskirgan yoki ishlatilgan.");
    return;
  }
  const ism = `${msg.from.first_name || ''} ${msg.from.username ? '@' + msg.from.username : ''}`.trim();
  await sbFetch(env, `bot_adminlar?id=eq.${row.id}`, { method: 'PATCH', prefer: 'return=minimal',
    body: JSON.stringify({ chat_id: chatId, ism, token: null }) });
  await tgSend(env.MIJOZ_BOT_TOKEN, chatId, "✅ Siz admin bo'ldingiz.");
  await tgSend(env.MIJOZ_BOT_TOKEN, row.qoshdi, `✅ Yangi admin: ${escH(ism)} (<code>${chatId}</code>)`);
  await adminPanel(env, chatId);
}

async function adminPanel(env, chatId) {
  // Telegram'dagi "Menu" tugmasi: admin uchun alohida buyruqlar ro'yxati
  const sm = (body) => fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/setMyCommands`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) }).catch(() => {});
  await sm({ scope: { type: 'chat', chat_id: chatId }, commands: [
    { command: 'admin', description: '🛠 Admin panel' }, { command: 'menu', description: '👁 Mijoz menyusi' }, { command: 'id', description: '🆔 Mening ID' } ] });
  await sm({ commands: [{ command: 'start', description: 'Boshlash' }, { command: 'menu', description: 'Asosiy menyu' }] });
  await tgSend(env.MIJOZ_BOT_TOKEN, chatId, '🛠 <b>Visart admin panel</b>', { inline_keyboard: [
    [{ text: '🆕 Oxirgi lidlar', callback_data: 'ap:lid' }, { text: '📊 Bugun / hafta', callback_data: 'ap:stat' }],
    [{ text: '🏗 Obyektlar', callback_data: 'ap:ob' }, { text: '🗂 Nashr navbati', callback_data: 'ap:nav' }],
    [{ text: '👁 Mijoz ko\'rinishi', callback_data: 'ap:mijoz' }, { text: '🆔 Mening ID', callback_data: 'ap:id' }],
    [{ text: '🌐 Sayt murojaatlari', callback_data: 'ap:sayt' }, { text: '🔗 Mijoz ulanishlari', callback_data: 'ap:ul' }],
    [{ text: '💡 Maslahat yaratish (test)', callback_data: 'ap:ms' }],
    [{ text: '➕ Admin qo\'shish', callback_data: 'ap:add' }, { text: '👥 Adminlar', callback_data: 'ap:list' }],
  ] });
}

async function adminPanelCb(env, cq, data) {
  const chatId = cq.message.chat.id;
  if (!isAdmin(env, cq.from && cq.from.id)) { await answerCq(env, cq.id, { text: "Ruxsat yo'q" }); return; }
  await answerCq(env, cq.id);
  const send = (x, kb) => tgSend(env.MIJOZ_BOT_TOKEN, chatId, x, kb);
  const amal = data.split(':')[1];
  const q = async (path) => (await sbFetch(env, path).catch(() => null)) || [];
  if (amal === 'add' || amal === 'list' || amal === 'del') {
    if (!isRoot(env, cq.from.id)) { await send("Admin qo'shish/o'chirish faqat asosiy adminga ruxsat."); return; }
    if (amal === 'add') {
      const tok = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
      await sbFetch(env, 'bot_adminlar', { method: 'POST', prefer: 'return=minimal',
        body: JSON.stringify([{ token: tok, token_exp: new Date(Date.now() + 864e5).toISOString(), qoshdi: cq.from.id }]) });
      await send(`➕ Yangi admin uchun havola (1 marta, 24 soat):\n\nhttps://t.me/visart_design_bot?start=adm_${tok}\n\nShu havolani yangi adminga yuboring — u bosib <b>Start</b> bossa admin bo'ladi.`);
      return;
    }
    if (amal === 'list') {
      const r = await q('bot_adminlar?select=id,chat_id,ism&chat_id=not.is.null&order=id.asc');
      const rootList = String(env.ROOT_ADMIN_IDS || '').split(',').filter(Boolean).map((x) => `• <code>${x.trim()}</code> (asosiy)`);
      await send('👥 <b>Adminlar</b>\n\n' + [...rootList, ...r.map((x) => `• ${escH(x.ism || '')} <code>${x.chat_id}</code>`)].join('\n'),
        r.length ? { inline_keyboard: r.map((x) => [{ text: `🗑 ${(x.ism || x.chat_id)}`.slice(0, 40), callback_data: `ap:del:${x.id}` }]) } : undefined);
      return;
    }
    const id = Number(data.split(':')[2]);
    if (id) await sbFetch(env, `bot_adminlar?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
    await send("🗑 Admin o'chirildi.");
    return;
  }
  if (amal === 'ul' || amal === 'uo' || amal === 'ue' || amal === 'ud' || amal === 'uy') {
    const oid = data.split(':').slice(2).join(':');
    if (amal === 'ul') {
      const r = await q('obyektlar?select=id,nom,mijoz_ism,mijoz_tel&order=id.desc&limit=20');
      await send(r.length ? "🔗 <b>Mijoz ulanishlari</b>\nObyektni tanlang — raqamni o'zgartirish yoki ulanishni o'chirish mumkin:" : 'Obyekt topilmadi.',
        r.length ? { inline_keyboard: r.map((o) => [{ text: `${o.nom || o.id} · ${o.mijoz_tel || 'ulanmagan'}`.slice(0, 48), callback_data: `ap:uo:${o.id}`.slice(0, 64) }]) } : undefined);
      return;
    }
    const o = ((await q(`obyektlar?id=eq.${encodeURIComponent(oid)}&select=id,nom,mijoz_ism,mijoz_tel`))[0]);
    if (!o) { await send('Obyekt topilmadi.'); return; }
    if (amal === 'uo') {
      await send(`🏗 <b>${escH(o.nom || o.id)}</b>\n👤 ${escH(o.mijoz_ism || '—')}\n📞 ${escH(o.mijoz_tel || 'ulanmagan')}`, { inline_keyboard: [
        [{ text: "✏️ Raqamni o'zgartirish", callback_data: `ap:ue:${o.id}`.slice(0, 64) }],
        ...(o.mijoz_tel ? [[{ text: "🗑 Ulanishni o'chirish", callback_data: `ap:ud:${o.id}`.slice(0, 64) }]] : []),
      ] });
      return;
    }
    if (amal === 'ue') {
      await send(`✏️ <b>${escH(o.nom || o.id)}</b> uchun yangi mijoz raqamini shu xabarga REPLY qilib yozing (masalan: 998901234567).\n\n🔗${o.id}`, { force_reply: true, selective: true });
      return;
    }
    if (amal === 'ud') {
      await send(`❓ <b>${escH(o.nom || o.id)}</b> obyektidan ${escH(o.mijoz_tel)} raqami o'chirilsinmi? Mijoz obyekt holatini ko'rolmay qoladi.`, { inline_keyboard: [[
        { text: "✅ Ha, o'chirish", callback_data: `ap:uy:${o.id}`.slice(0, 64) }, { text: '❌ Yo\'q', callback_data: 'ap:ul' }]] });
      return;
    }
    await sbFetch(env, `obyektlar?id=eq.${encodeURIComponent(o.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ mijoz_tel: null }) }).catch(() => {});
    await removeKb(env, chatId, cq.message.message_id);
    await send(`🗑 ${escH(o.nom || o.id)}: mijoz raqami o'chirildi, ulanish bekor qilindi.`);
    return;
  }
  if (amal === 'sayt') {
    try {
      const r = await env.DB.prepare('SELECT name, phone, service, created_at FROM leads ORDER BY id DESC LIMIT 8').all();
      const rows = (r && r.results) || [];
      await send(rows.length ? '🌐 <b>Sayt murojaatlari</b>\n\n' + rows.map((x) => `• ${escH(x.name)} · ${escH(x.phone)} · ${escH(x.service || '—')}\n  <i>${escH(String(x.created_at || '').slice(0, 16))}</i>`).join('\n') : 'Murojaatlar yo\'q.');
    } catch (e) { await send("Sayt murojaatlari bazasiga ulanib bo'lmadi (D1 'DB' bog'lanmagan)."); }
    return;
  }
  if (amal === 'ms') {
    const g = await q('bot_guruhlar?select=chat_id&obuna=eq.true&limit=1');
    if (!g.length) { await send("⚠️ Obunali guruh yo'q. Avval ommaviy guruhda <code>/obuna</code> yozing (botni guruhga qo'shib)."); return; }
    await send('⏳ Maslahat yozilmoqda…');
    await maslahatYarat(env).catch(async (e) => { await send(`⚠️ Xato: ${escH(String((e && e.message) || e).slice(0, 150))}`); });
    return;
  }
  if (amal === 'mijoz') { await menyuKorsat(env, H, chatId, false); return; }
  if (amal === 'id') { await send(`Chat ID: <code>${chatId}</code>`); return; }
  if (amal === 'lid') {
    const r = await q('lidlar?select=ism,telefon,xizmat_turi,maydon_m2,created_at&manba=eq.telegram_mijoz_bot&order=created_at.desc&limit=8');
    await send(r.length ? '🆕 <b>Oxirgi lidlar</b>\n\n' + r.map((x) => `• ${escH(x.ism)} · ${escH(x.telefon)} · ${escH(x.xizmat_turi)} ${x.maydon_m2 || ''}\n  <i>${String(x.created_at || '').slice(0, 16).replace('T', ' ')}</i>`).join('\n') : 'Lidlar yo\'q.');
    return;
  }
  if (amal === 'stat') {
    const d1 = new Date(Date.now() - 864e5).toISOString(), d7 = new Date(Date.now() - 7 * 864e5).toISOString();
    const [a, b] = await Promise.all([q(`lidlar?select=id&created_at=gte.${d1}`), q(`lidlar?select=id&created_at=gte.${d7}`)]);
    await send(`📊 Lidlar: oxirgi 24 soat — <b>${a.length}</b>, 7 kun — <b>${b.length}</b>`);
    return;
  }
  if (amal === 'ob') {
    const r = await q('obyektlar?select=nom,holat,mijoz_ism&order=id.desc&limit=12');
    await send(r.length ? '🏗 <b>Obyektlar</b>\n\n' + r.map((x) => `• ${escH(x.nom)} — ${escH(x.holat || '—')}${x.mijoz_ism ? ' (' + escH(x.mijoz_ism) + ')' : ''}`).join('\n') : 'Obyekt topilmadi.');
    return;
  }
  if (amal === 'nav') {
    const r = await q('nashr_navbati?select=turi,holat&order=id.desc&limit=10');
    await send(r.length ? '🗂 <b>Navbat (oxirgi 10)</b>\n\n' + r.map((x) => `• ${escH(x.turi)} — ${escH(x.holat)}`).join('\n') : 'Navbat bo\'sh.');
  }
}

async function handleXizmatTanlandi(env, chatId, dialog, xizmatCode) {
  const label = (XIZMAT_VARIANTLARI.find((x) => x[0] === xizmatCode) || [, xizmatCode])[1];
  await upsertDialog(env, chatId, { step: 'maydon', xizmat_turi: xizmatCode, xizmat_label: label });
  const til = (await getProfil(env, H, chatId)).til;
  const savol = xizmatCode === 'arch' ? (til === 'ru' ? 'Сколько соток участок?' : "Yer maydoni necha sotix?") : t(til, 'maydon_q');
  await tgSend(env.MIJOZ_BOT_TOKEN, chatId, `${t(til, 'tanlandi')}: ${til === 'ru' ? XIZMAT_RU[xizmatCode] || label : label}.\n\n${savol}`);
}

async function finishDialog(env, chatId, dialog, maydon, hujjat) {
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
  const narxMatni = estimateText(pricing, dialog.xizmat_turi, maydon, hujjat);

  const til = (await getProfil(env, H, chatId)).til;
  await tgSend(env.MIJOZ_BOT_TOKEN, chatId,
    `${t(til, 'qabul')(escH(dialog.ism))}\n\n${narxMatni}\n\n${t(til, 'tez')}`);
  await followUpQoy(env, H, chatId, dialog.ism, til);

  // 3) Menejerga xabar (MANAGER_CHAT_ID yoki adminlar)
  const birlik = dialog.xizmat_turi === 'arch' ? 'sotix' : 'm²';
  for (const mid of menejerlar(env)) {
    await tgSend(env.MIJOZ_BOT_TOKEN, mid,
      `🆕 Yangi lid (Telegram bot)\n\n👤 ${escH(dialog.ism)}\n📞 ${escH(dialog.telefon)}\n🛠 ${escH(dialog.xizmat_label || dialog.xizmat_turi)}\n📐 ${maydon} ${birlik}${dialog.xizmat_turi === 'arch' ? `\n📄 Hujjatlashtirish: ${hujjat ? 'ha' : "yo'q"}` : ''}\n💬 <a href="tg://user?id=${chatId}">Mijozga Telegramda yozish</a>` +
      (lidYozildi ? '' : '\n\n⚠️ Supabase lidlar jadvaliga yozishda xato — qo\'lda kiriting!'),
      { inline_keyboard: [[{ text: "✅ Bog'landim", callback_data: `ld:ok:${dialog.telefon}`.slice(0, 64) }, { text: '❌ Qiziqmaydi', callback_data: `ld:no:${dialog.telefon}`.slice(0, 64) }]] }).catch(() => {});
  }
  // Ish vaqtidan tashqari (Toshkent 09–21) bo'lsa mijozga ayting; 2 soatdan keyin javobsiz lid eslatmasi
  const soat = new Date(Date.now() + 5 * 3600 * 1000).getUTCHours();
  const tun = soat < 9 || soat >= 21;
  if (tun) {
    await tgSend(env.MIJOZ_BOT_TOKEN, chatId, til === 'ru' ? '🌙 Сейчас нерабочее время. Свяжемся с вами утром, после 9:00.' : "🌙 Hozir ish vaqtidan tashqari. Ertalab soat 9:00 dan keyin siz bilan bog'lanamiz.");
  }
  await sbFetch(env, 'nashr_navbati', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify([{
    turi: 'lid_eslatma', payload: { chat_id: chatId, ism: dialog.ism, telefon: dialog.telefon },
    nashr_vaqti: tun ? keyingiToshkent(11) : new Date(Date.now() + 2 * 3600 * 1000).toISOString(), holat: 'kutilmoqda' }]) }).catch(() => {});
}

// ── GURUHNI BOG'LASH MASTERI ──
// Bot guruhga qo'shilganda (yoki adminning guruhda /guruh yozishi bilan)
// savollar FAQAT adminning shaxsiy chatiga ketadi -- guruh a'zolari
// ko'rmaydi. 1) guruh nima uchun? 2) qaysi obyekt? 3) bog'lanadi.
async function guruhMasteriBoshla(env, chat) {
  const kb = { inline_keyboard: [
    [{ text: '👥 Mijozlar guruhi (ilova yangiliklari)', callback_data: `gset:m:${chat.id}` }],
    [{ text: '👷 Ustalar guruhi (kunlik hisobot)', callback_data: `gset:u:${chat.id}` }],
    [{ text: '💬 Oddiy guruh (narx, maslahat, ariza)', callback_data: `gset:o:${chat.id}` }],
  ] };
  for (const adminId of adminIdlari(env)) {
    await tgSendMessageKb(env, adminId, `➕ Bot «${chat.title || chat.id}» guruhiga qo'shildi.\nBu guruh nima uchun?`, kb);
  }
}

async function handleGuruhMaster(env, cq, data) {
  if (!isAdmin(env, cq.from && cq.from.id)) { await answerCq(env, cq.id, { text: "Ruxsat yo'q" }); return; }
  const dmChat = cq.message.chat.id;
  const p = data.split(':');            // gset:<rol>:<guruh>  |  gobj:<rol>:<guruh>:<obyekt>
  const rol = p[1], guruhId = p[2];
  await answerCq(env, cq.id);
  await removeKb(env, dmChat, cq.message.message_id);

  if (p[0] === 'gset' && rol === 'o') {
    await sbFetch(env, `visart_loyiha_guruhlar?telegram_chat_id=eq.${guruhId}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
    await sbFetch(env, `usta_guruhlar?telegram_chat_id=eq.${guruhId}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
    let title = '';
    try { const c = await (await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/getChat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: guruhId }) })).json(); title = (c.result && c.result.title) || ''; } catch (e) { /* nom ixtiyoriy */ }
    await guruhSalom(env, { id: Number(guruhId), title });
    await tgSend(env.MIJOZ_BOT_TOKEN, dmChat, `✅ Guruh «${escH(title || guruhId)}» oddiy guruh sifatida sozlandi: salom xabari yuborildi, /narx, /loyiha, /maslahat, /obuna buyruqlari ishlaydi.`);
    return;
  }
  if (p[0] === 'gset') {
    let rows = null;
    try { rows = await sbFetch(env, 'obyektlar?select=id,nom,mijoz_ism&order=sana.desc.nullslast&limit=30'); } catch (e) { rows = null; }
    if (!rows || !rows.length) {
      await tgSend(env.MIJOZ_BOT_TOKEN, dmChat,
        `⚠️ Obyektlar ro'yxatini olib bo'lmadi. Guruhning o'zida admin sifatida yozing:\n<code>/${rol === 'm' ? 'obyekt' : 'ustalar'} &lt;ID&gt;</code>`);
      return;
    }
    const kb = { inline_keyboard: rows.map((r) => [{
      text: `${(r.nom || r.id).slice(0, 34)}${r.mijoz_ism ? ' — ' + r.mijoz_ism.slice(0, 18) : ''}`,
      callback_data: `gobj:${rol}:${guruhId}:${r.id}`.slice(0, 64),
    }]) };
    await tgSendMessageKb(env, dmChat, `Qaysi obyekt? (${rol === 'm' ? 'mijozlar' : 'ustalar'} guruhi)`, kb);
    return;
  }

  // gobj -- bog'lash
  const obyektId = p.slice(3).join(':');
  try {
    let nom = obyektId;
    const o = await sbFetch(env, `obyektlar?id=eq.${encodeURIComponent(obyektId)}&select=nom`).catch(() => null);
    if (o && o[0] && o[0].nom) nom = o[0].nom;
    await sbFetch(env, `visart_loyiha_guruhlar?telegram_chat_id=eq.${guruhId}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
    await sbFetch(env, `usta_guruhlar?telegram_chat_id=eq.${guruhId}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
    await sbFetch(env, rol === 'm' ? 'visart_loyiha_guruhlar' : 'usta_guruhlar', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify([{ obyekt_id: obyektId, telegram_chat_id: Number(guruhId) }]),
    });
    await tgSend(env.MIJOZ_BOT_TOKEN, dmChat, `✅ Tayyor: guruh «${nom}» obyektiga ${rol === 'm' ? 'MIJOZLAR' : 'USTALAR'} guruhi sifatida ulandi.`);
    await tgSend(env.MIJOZ_BOT_TOKEN, guruhId, rol === 'm' ? TANISH_MIJOZ : TANISH_USTA);
  } catch (e) {
    await tgSend(env.MIJOZ_BOT_TOKEN, dmChat, `⚠️ Bog'lashda xato: ${String((e && e.message) || e).slice(0, 200)}`);
  }
}

// Telegram bir xil update'ni qayta yuborishi mumkin (timeout/500). update_id
// jadvalga yoziladi; allaqachon bor bo'lsa -- takroriy. Jadval yo'q bo'lsa
// (migratsiya qilinmagan) ishlashda davom etadi.
async function takroriyUpdate(env, updateId) {
  if (!updateId) return false;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/bot_update_log`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ update_id: updateId }),
      signal: AbortSignal.timeout(4000),
    });
    return res.status === 409;
  } catch (e) {
    return false;
  }
}

const H = { tgSend, sbFetch, answerCq, upsertDialog, removeKb, getDialog };

export async function onRequestPost({ request, env }) {
  try {
    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!env.MIJOZ_BOT_SECRET || secret !== env.MIJOZ_BOT_SECRET) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }
    const update = await request.json().catch(() => null);
    if (!update) return json({ ok: true });
    if (await takroriyUpdate(env, update.update_id)) return json({ ok: true });
    env = await adminlarBilan(env);

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
      if (data.startsWith('sty:')) {
        const [, amal, qid] = data.split(':');
        if (!isAdmin(env, cq.from && cq.from.id)) { await answerCq(env, cq.id, { text: 'Faqat admin.', show_alert: true }); return json({ ok: true }); }
        const rows = await sbFetch(env, `nashr_navbati?id=eq.${encodeURIComponent(qid)}&holat=eq.tasdiq_kutilmoqda`, {
          method: 'PATCH', prefer: 'return=representation', body: JSON.stringify({ holat: amal === 'ok' ? 'kutilmoqda' : 'bekor' }) }).catch(() => null);
        await removeKb(env, cq.message.chat.id, cq.message.message_id);
        await answerCq(env, cq.id, { text: !rows || !rows.length ? "Allaqachon ko'rib chiqilgan yoki muddati o'tgan." : amal === 'ok' ? 'Tasdiqlandi — vaqtida chiqadi.' : 'Rad etildi — yangi variant tayyorlanmoqda.' });
        if (amal === 'no' && rows && rows.length && env.MEDIA_SERVER_URL && env.MEDIA_SECRET) {
          await fetch(`${env.MEDIA_SERVER_URL}/story-variant`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Media-Secret': env.MEDIA_SECRET },
            body: JSON.stringify({ id: qid, adminChatId: cq.message.chat.id }), signal: AbortSignal.timeout(8000),
          }).catch(() => {});
        }
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
      if (data === 'obr') {
        await answerCq(env, cq.id);
        const prof = await getProfil(env, H, chatId);
        await removeKb(env, chatId, cq.message.message_id);
        await tgSend(env.MIJOZ_BOT_TOKEN, chatId, prof.til === 'ru' ? 'Запрос отправлен менеджеру. Скоро подключим ваш объект. 🙏' : "So'rov menejerga yuborildi. Obyektingizni tez orada ulaymiz. 🙏");
        const obs = (await sbFetch(env, 'obyektlar?select=id,nom,mijoz_tel,mijoz_ism&order=id.desc&limit=60').catch(() => [])) || [];
        const bosh = obs.filter((o) => !String(o.mijoz_tel || '').replace(/\D/g, '')).concat(obs.filter((o) => String(o.mijoz_tel || '').replace(/\D/g, '')));
        const kb = bosh.map((o) => [{ text: `${o.nom || o.id}${o.mijoz_ism ? ' · ' + o.mijoz_ism : ''}`.slice(0, 40), callback_data: `ol:${o.id}:${chatId}` }]).filter((r) => r[0].callback_data.length <= 64).slice(0, 10);
        const kim = cq.from ? `${cq.from.first_name || ''} ${cq.from.username ? '@' + cq.from.username : ''}`.trim() : chatId;
        for (const mid of menejerlar(env)) {
          await tgSend(env.MIJOZ_BOT_TOKEN, mid, `🔗 Mijoz obyektini ulashni so'radi\n👤 ${escH(kim)}\n📞 ${prof.tel ? '+' + escH(prof.tel) : '—'}\n💬 <a href="tg://user?id=${chatId}">Telegramda yozish</a>\n\nQaysi obyekt shu mijozniki? (telefon unga yoziladi)`, { inline_keyboard: kb });
        }
        return json({ ok: true });
      }
      if (data.startsWith('ol:')) {
        if (!isAdmin(env, cq.from && cq.from.id)) { await answerCq(env, cq.id, { text: "Ruxsat yo'q" }); return json({ ok: true }); }
        const [, oid, mchat] = data.split(':');
        const prof = await getProfil(env, H, Number(mchat));
        if (!prof.tel) { await answerCq(env, cq.id, { text: 'Mijoz raqami yo\'q' }); return json({ ok: true }); }
        await sbFetch(env, `obyektlar?id=eq.${encodeURIComponent(oid)}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ mijoz_tel: '+' + prof.tel }) }).catch(() => {});
        await removeKb(env, cq.message.chat.id, cq.message.message_id);
        await answerCq(env, cq.id, { text: '✅ Ulandi' });
        await tgSend(env.MIJOZ_BOT_TOKEN, cq.message.chat.id, `✅ Obyekt ${escH(oid)} mijoz raqamiga (+${escH(prof.tel)}) ulandi.`);
        await tgSend(env.MIJOZ_BOT_TOKEN, Number(mchat), prof.til === 'ru' ? '✅ Ваш объект подключён!' : '✅ Obyektingiz ulandi!');
        await obyektTelBilan(env, H, Number(mchat), prof.tel, prof.til);
        return json({ ok: true });
      }
      if (data.startsWith('gk:')) { await guruhCb(env, cq, data); return json({ ok: true }); }
      if (data.startsWith('gm:')) {
        if (!isAdmin(env, cq.from && cq.from.id)) { await answerCq(env, cq.id, { text: "Ruxsat yo'q" }); return json({ ok: true }); }
        const [, amal, gid] = data.split(':');
        await removeKb(env, cq.message.chat.id, cq.message.message_id);
        if (amal === 'ok') {
          const n = await maslahatTarqat(env, gid);
          await answerCq(env, cq.id, { text: n < 0 ? 'Allaqachon yuborilgan' : `✅ ${n} guruhga yuborildi` });
        } else {
          await sbFetch(env, `nashr_navbati?id=eq.${gid}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ holat: 'bekor' }) }).catch(() => {});
          await answerCq(env, cq.id, { text: amal === 're' ? '🔄 Yangisi tayyorlanmoqda' : '❌ Bekor qilindi' });
          if (amal === 're') await maslahatYarat(env).catch(() => {});
        }
        return json({ ok: true });
      }
      if (data.startsWith('ld:')) {
        if (!isAdmin(env, cq.from && cq.from.id)) { await answerCq(env, cq.id, { text: "Ruxsat yo'q" }); return json({ ok: true }); }
        const [, amal, ...tl] = data.split(':');
        const tel = tl.join(':');
        const holat = amal === 'ok' ? 'boglandi' : 'qiziqmadi';
        await sbFetch(env, `lidlar?telefon=eq.${encodeURIComponent(tel)}&holat=eq.yangi_lid`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ holat }) }).catch(() => {});
        await removeKb(env, cq.message.chat.id, cq.message.message_id);
        await answerCq(env, cq.id, { text: amal === 'ok' ? "✅ Belgilandi: bog'langan" : '❌ Belgilandi: qiziqmaydi' });
        return json({ ok: true });
      }
      if (data.startsWith('rt:')) {
        const [, oid, n] = data.split(':');
        await removeKb(env, chatId, cq.message.message_id);
        await answerCq(env, cq.id, { text: '🙏' });
        const prof = await getProfil(env, H, chatId);
        await tgSend(env.MIJOZ_BOT_TOKEN, chatId, prof.til === 'ru' ? 'Спасибо за оценку! 🙏' : 'Bahoyingiz uchun rahmat! 🙏');
        const kim = cq.from ? `${cq.from.first_name || ''} ${cq.from.username ? '@' + cq.from.username : ''}`.trim() : chatId;
        for (const mid of menejerlar(env)) {
          await tgSend(env.MIJOZ_BOT_TOKEN, mid, `${Number(n) <= 3 ? '⚠️' : '⭐'} Mijoz bahosi: <b>${escH(n)}/5</b>\n🏗 Obyekt: ${escH(oid)}\n👤 ${escH(kim)}\n💬 <a href="tg://user?id=${chatId}">Telegramda yozish</a>`);
        }
        return json({ ok: true });
      }
      if (data.startsWith('dk:')) {
        await answerCq(env, cq.id);
        const cid = cq.message.chat.id;
        const dlg = await getDialog(env, cid);
        const mm = dlg && String(dlg.step).startsWith('dok:') ? parseFloat(String(dlg.step).slice(4)) : 0;
        if (mm > 0) { await removeKb(env, cid, cq.message.message_id); await finishDialog(env, cid, dlg, mm, data === 'dk:1'); }
        return json({ ok: true });
      }
      if (data.startsWith('ap:')) { await adminPanelCb(env, cq, data); return json({ ok: true }); }
      if (data.startsWith('menu:')) { await handleMenu(env, H, cq, data); return json({ ok: true }); }
      if (data.startsWith('nx')) { await handleNarx(env, H, cq, data); return json({ ok: true }); }
      if (data.startsWith('lq')) { await handleLq(env, H, cq, data); return json({ ok: true }); }
      if (data.startsWith('ob:')) { await handleObTanla(env, H, cq, data); return json({ ok: true }); }
      if (data.startsWith('gset:') || data.startsWith('gobj:')) {
        await handleGuruhMaster(env, cq, data);
        return json({ ok: true });
      }
      if (data.startsWith('tzk:')) {
        await handleTezkorTanlov(env, cq, data);
        return json({ ok: true });
      }
      if (data.startsWith('vnash:')) {
        const [, nid, qaror] = data.split(':');
        if (!isAdmin(env, cq.from && cq.from.id)) {
          await answerCq(env, cq.id, { text: 'Ruxsat yo\'q' });
          return json({ ok: true });
        }
        await removeKb(env, chatId, cq.message.message_id);
        if (qaror === 'ok') {
          await answerCq(env, cq.id, { text: 'Joylanmoqda...' });
          await fetch(`${env.MEDIA_SERVER_URL}/nashr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Media-Secret': env.MEDIA_SECRET },
            body: JSON.stringify({ id: nid, adminChatId: chatId }),
            signal: AbortSignal.timeout(55000),
          }).catch(() => {});
        } else {
          await sbFetch(env, `nashr_navbati?id=eq.${nid}`, { method: 'PATCH', body: JSON.stringify({ holat: 'bekor' }) }).catch(() => {});
          await answerCq(env, cq.id, { text: 'Bekor qilindi' });
          const rr = await sbFetch(env, `nashr_navbati?id=eq.${nid}&select=payload`).catch(() => null);
          const tid = rr && rr[0] && rr[0].payload && rr[0].payload.taklifId;
          await tgSend(env.MIJOZ_BOT_TOKEN, chatId,
            `❌ Joylash bekor qilindi. Nima to'g'rilansin?\nShu xabarga REPLY qilib yozing (masalan: "montaj qisqaroq bo'lsin", "sarlavhani o'zgartir", "izohda narx bo'lmasin") -- shu ko'rsatma bilan qayta tayyorlab, yana tasdiqqa yuboraman.${tid ? `\n\n🆔${tid}` : ''}`);
        }
        return json({ ok: true });
      }
      if (data.startsWith('montaj_retry:')) {
        const taklifId = data.split(':')[1];
        if (!isAdmin(env, cq.from && cq.from.id)) {
          await answerCq(env, cq.id, { text: "Ruxsat yo'q" });
          return json({ ok: true });
        }
        await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: cq.id, text: 'Qayta ishga tushirildi' }),
        }).catch(() => {});
        await montajBoshlash(env, taklifId, chatId);
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

    // Admin natija xabariga (oblojka/karusel/montaj/taklif) REPLY qilib matn
    // yozsa -- bu "to'g'irlash" ko'rsatmasi. Xabarning o'zida (yoki uning
    // reply_to_message'ida) yashiringan "🆔<id>" belgisidan taklifId topiladi.
    if (msg.chat.type === 'private' && msg.reply_to_message && msg.text && isAdmin(env, msg.from && msg.from.id)) {
      const manba = msg.reply_to_message.text || msg.reply_to_message.caption || '';
      const tzkMatch = manba.match(/📎(\d+)/);
      if (tzkMatch) {
        await handleTezkorIzoh(env, msg.chat.id, tzkMatch[1], msg.text);
        return json({ ok: true });
      }
      const ulMatch = manba.match(/🔗([A-Za-z0-9_-]+)/);
      if (ulMatch) {
        let d = msg.text.replace(/\D/g, '');
        if (d.length === 9) d = '998' + d;
        if (d.length < 11 || d.length > 13) { await tgSend(env.MIJOZ_BOT_TOKEN, msg.chat.id, "⚠️ Raqam noto'g'ri. Qayta urinib ko'ring: 998901234567 ko'rinishida (⬆️ xabarga reply qiling)."); return json({ ok: true }); }
        const oid = ulMatch[1];
        const boshqa = ((await sbFetch(env, 'obyektlar?select=id,nom,mijoz_tel&limit=1000').catch(() => [])) || [])
          .filter((x) => x.id !== oid && String(x.mijoz_tel || '').replace(/\D/g, '').slice(-9) === d.slice(-9));
        await sbFetch(env, `obyektlar?id=eq.${encodeURIComponent(oid)}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ mijoz_tel: '+' + d }) }).catch(() => {});
        await tgSend(env.MIJOZ_BOT_TOKEN, msg.chat.id, `✅ Raqam yangilandi: +${d}${boshqa.length ? `\n\nℹ️ Shu raqam boshqa obyektda ham bor: ${escH(boshqa.map((x) => x.nom || x.id).join(', '))} (mijoz ikkalasini ham ko'radi).` : ''}`);
        return json({ ok: true });
      }
      const taklifMatch = manba.match(/🆔(\d+)/);
      if (taklifMatch) {
        await tuzatishBajar(env, taklifMatch[1], msg.chat.id, msg.text);
        return json({ ok: true });
      }
    }

    // Bot guruhga YANGI qo'shilganda (admin uni qo'shganda) — tanishtiruv
    // xabari yuboradi: o'zi haqida va vazifasi haqida qisqa ma'lumot + rahmat.
    if (Array.isArray(msg.new_chat_members)) {
      const botId = (env.MIJOZ_BOT_TOKEN || '').split(':')[0];
      const botQoshildimi = msg.new_chat_members.some((m) => String(m.id) === botId);
      if (botQoshildimi) {
        if (isAdmin(env, msg.from && msg.from.id)) {
          await guruhMasteriBoshla(env, msg.chat);   // faqat admin qo'shganda sozlash savoli
        } else {
          await guruhSalom(env, msg.chat);   // begona guruh: adminni bezovta qilmaymiz, jim foydali rejim
        }
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

    // Oddiy mijoz shaxsiy chatda: kontakt (obyekt holati) yoki rasm-reference.
    if (msg.chat.type === 'private' && !isAdmin(env, msg.from && msg.from.id)) {
      if (msg.contact) { await handleKontakt(env, H, msg); return json({ ok: true }); }
      if (msg.photo || (msg.document && /^image\//.test(msg.document.mime_type || ''))) {
        await handleMijozFoto(env, H, msg);
        return json({ ok: true });
      }
    }

    // TEZKOR REJIM: admin shaxsiy chatda izohli rasm/video yuborsa.
    if (msg.chat.type === 'private' && isAdmin(env, msg.from && msg.from.id) && (msg.caption || '').trim() &&
        (msg.photo || msg.video || msg.video_note || hujjatRasmYokiVideo)) {
      await handleTezkor(env, msg);
      return json({ ok: true });
    }

    // Izohsiz media -- "bazaga yoki hozir postmi?" deb so'raydi.
    if (msg.chat.type === 'private' && isAdmin(env, msg.from && msg.from.id) &&
        (msg.photo || msg.video || msg.video_note || hujjatRasmYokiVideo)) {
      await tezkorSoraSavol(env, msg);
      return json({ ok: true });
    }

    // Admin shaxsiy xabarda video yuborsa (test/Montajchi uchun qo'lda sinov) --
    // file_id'ni o'zini qaytarib beradi, boshqa hech narsa qilmaydi.
    if (msg.chat.type === 'private' && msg.video && isAdmin(env, msg.from && msg.from.id)) {
      await tgSend(env.MIJOZ_BOT_TOKEN, msg.chat.id,
        `🆔 file_id: <code>${msg.video.file_id}</code>\nchat id: <code>${msg.chat.id}</code>`);
      return json({ ok: true });
    }

    if (!msg.text) return json({ ok: true });

    // /senariy <topshiriq> -- admin shaxsiy chatda, hali suratga OLINMAGAN
    // yangi kontent uchun to'liq ssenariy so'raydi (vazifa-asosida rejalashtirish).
    if (msg.chat.type === 'private' && msg.text.startsWith('/senariy') && isAdmin(env, msg.from && msg.from.id)) {
      const topshiriq = msg.text.replace(/^\/senariy/, '').trim();
      if (!topshiriq) {
        await tgSend(env.MIJOZ_BOT_TOKEN, msg.chat.id,
          "Vazifani yozing, masalan:\n<code>/senariy Yangi 120m² villa loyihasini tanishtiruvchi Reels</code>");
        return json({ ok: true });
      }
      await tgSend(env.MIJOZ_BOT_TOKEN, msg.chat.id, '✍️ Ssenariy tayyorlanmoqda...');
      const ssenariy = await claudeSsenariyYoz(env, topshiriq);
      await tgSend(env.MIJOZ_BOT_TOKEN, msg.chat.id, ssenariyMatnQil(ssenariy));
      return json({ ok: true });
    }

    // Guruh/superguruh xabarlari: FAQAT /obyekt, /ustalar, /chatid buyruqlari
    // qayta ishlanadi (admin tekshiruvi bilan) -- shaxsiy lid-dialog oqimi
    // guruhda ishlamaydi.
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
      if (await guruhBuyruq(env, msg)) {
        /* /narx /loyiha /maslahat /obuna */
      } else if (msg.text.startsWith('/obyekt')) {
        await handleObyektBuyrugi(env, msg);
      } else if (msg.text.startsWith('/ustalar')) {
        await handleUstalarBuyrugi(env, msg);
      } else if (msg.text.startsWith('/guruh') && isAdmin(env, msg.from && msg.from.id)) {
        await guruhMasteriBoshla(env, msg.chat);
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

    if (msg.chat.type === 'private' && /^\/start adm_[A-Za-z0-9]{8,}$/.test(msg.text || '')) {
      await adminTaklifQabul(env, msg, msg.text.slice(11));
      return json({ ok: true });
    }
    if (msg.text === '/id') {
      await tgSend(env.MIJOZ_BOT_TOKEN, chatId, `Sizning chat ID: <code>${chatId}</code>`);
      return json({ ok: true });
    }
    if (msg.chat.type === 'private' && isAdmin(env, msg.from && msg.from.id) &&
        (msg.text === '/start' || msg.text === '/admin' || msg.text === '/start guruh')) {
      await adminPanel(env, chatId);
      return json({ ok: true });
    }
    if (msg.text === '/start' || msg.text === '/menu' || msg.text === '/start guruh') {
      await menyuKorsat(env, H, chatId, msg.text === '/start');
      return json({ ok: true });
    }

    await handleText(env, chatId, dialog, msg.text);
    return json({ ok: true });
  } catch (e) {
    // 500 qaytarsak Telegram bir necha marta qayta yuboradi (takroriy post xavfi) -- doim 200.
    await xatoYoz(env, 'mijoz-bot', e);
    return json({ ok: true, error: 'server_error' });
  }
}
