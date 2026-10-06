// Cloudflare Pages Function — /api/senarist-tahlil
// Senarist agenti: "Visart Media" guruhiga tashlangan xom video/rasmlarni
// (mijoz-bot.js to'plagan `media_arxiv` jadvali) tahlil qiladi, ulardan
// ijtimoiy tarmoq uchun eng mos keladiganini tanlab, sarlavha/g'oya yozadi
// va admin DM'ga tasdiqlash uchun yuboradi (`media_taklif` jadvali).
// Tasdiqlangan taklif keyingi bosqich (Montajchi agenti) uchun navbatga
// qo'yiladi -- hozircha faqat tasdiqlash/rad etish ishlaydi.
//
// Tashqi bepul cron (cron-job.org) kuniga 1 marta chaqirishi kerak:
//   GET https://visartdesign.uz/api/senarist-tahlil?secret=<SENARIST_SECRET>
//
// Qo'shimcha Cloudflare Pages Environment Variable:
//   SENARIST_SECRET   -- o'zingiz o'ylab topgan tasodifiy satr
//   ANTHROPIC_API_KEY -- Claude API kaliti (console.anthropic.com)
//   MEDIA_GROUP_CHAT_ID -- "Visart Media" guruhining chat ID'si (/chatid orqali olinadi)
//   (MIJOZ_BOT_TOKEN, ADMIN_TELEGRAM_IDS, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY -- allaqachon bor)
//
// Kerakli Supabase jadvallari (SQL Editor'da bir marta ishga tushiring):
//   create table if not exists media_arxiv (
//     id bigint generated always as identity primary key,
//     telegram_chat_id bigint not null,
//     telegram_message_id bigint not null,
//     turi text not null,
//     izoh text,
//     file_id text,
//     asl_file_id text, -- video uchun to'liq fayl (Montajchi shundan foydalanadi)
//     media_group_id text, -- Telegram albom ID (karusel aniqlash uchun)
//     holat text not null default 'yangi',
//     created_at timestamptz not null default now()
//   );
//   create table if not exists media_taklif (
//     id bigint generated always as identity primary key,
//     matn text not null,
//     media_arxiv_id bigint, -- karuselda: birinchi (muqova) id
//     media_arxiv_idlar text, -- karuselda: vergul bilan ajratilgan barcha idlar
//     holat text not null default 'kutilmoqda',
//     created_at timestamptz not null default now()
//   );

const MODEL = 'claude-haiku-4-5-20251001';
const KAM_MATERIAL_CHEGARA = 3; // shundan kam bo'lsa, kutamiz (keyingi safar yetadi)

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
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
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Supabase ${path} -> ${res.status}: ${txt.slice(0, 300)}`);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

async function tgGetFilePath(token, fileId) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`, {
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => null);
  return data && data.ok ? data.result.file_path : null;
}

async function tgDownloadBase64(token, filePath) {
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function claudeTahlil(env, items) {
  const content = [];
  for (const it of items) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: it.base64 } });
    content.push({
      type: 'text',
      text: `[#${it.id}] turi: ${it.turi}${it.izoh ? `, izoh: ${it.izoh}` : ''}${it.media_group_id ? `, albom: ${it.media_group_id}` : ''}`,
    });
  }
  content.push({
    type: 'text',
    text:
      "Yuqoridagi materiallar Visart Design arxitektura/dizayn studiyasining ijtimoiy tarmoq uchun xom video/rasm to'plami. " +
      "Bir xil \"albom\" qiymatiga ega elementlar BITTA Telegram xabarida (albom/media group) birga yuborilgan -- ular odatda bitta xonadon/obyektning turli burchaklari, shuning uchun ularni BITTA karusel post sifatida birga ko'rsatish mumkin.\n\n" +
      "Vazifa: eng mos keladigan BITTA variantni tanlang:\n" +
      "- Agar eng yaxshi tanlov bitta alohida (albomsiz) rasm/video bo'lsa -- \"turi\":\"single\" va \"tanlangan_idlar\" massivida FAQAT 1 ta ID.\n" +
      "- Agar eng yaxshi tanlov bitta albomga tegishli bo'lsa -- \"turi\":\"karusel\", va \"tanlangan_idlar\"ga o'sha albomdagi ENG YAXSHI rasmlarni (kamida 2, ko'pi bilan 10 ta) Instagram karusel uchun eng mos TARTIBDA joylashtiring (birinchisi -- eng jozibali \"muqova\" rasm bo'lishi kerak). Sifatsiz/takroriy/xira rasmlarni albomdan chiqarib tashlang.\n\n" +
      "MUHIM -- matn yozish qoidalari (siz bu yerda ham kontent-menejer/marketolog rolidasiz):\n" +
      "- FAKTLARNI HECH QACHON O'YLAB TOPMANG. Faqat \"izoh\" maydonida ANIQ yozilgan faktlarni (maydon m2, xona turi, uslub, manzil va h.k.) ishlating. Agar biror item uchun izoh berilmagan bo'lsa yoki aniq raqam/joy ko'rsatilmagan bo'lsa, o'sha narsa haqida HECH QANDAY raqam yoki faktni o'zingiz o'ylab yozmang -- faqat rasmda ko'rinib turgan narsalarni (ranglar, materiallar, uslub) tasvirlang. Masalan, agar hech kim \"30 m2\" demagan bo'lsa, siz ham yozmang.\n" +
      "- \"sarlavha\": qisqa (5-8 so'z), DIQQATNI TORTUVCHI, aniq -- agar izohda xona turi/o'lcham berilgan bo'lsa shuni ishlating, bo'lmasa rasmdagi uslub/xonaga asoslaning (umumiy \"Zamonaviy Uy Interyer\" kabi bo'sh iboralardan qoching).\n" +
      "- \"post_matni\": Instagram uchun TO'LIQ, nashr qilishga tayyor, TABIIY (insoniy, reklama-listicle emas) matn -- 3-5 qisqa jumla, keyin 4-6 ta tegishli hashtag. HECH QANDAY formatlash belgisi ishlatmang (**, *, __, # sarlavha uchun emas -- bular Telegram'da xom holda ko'rinadi va xunuk chiqadi), faqat oddiy matn + tabiiy joylarda 1-2 ta emoji. Punktlar/bullet ro'yxat yozmang -- ravon jumlalar bilan yozing.\n" +
      "- TIL: SODDA, TABIIY, ZAMONAVIY o'zbek tilida (lotin yozuvida) yozing -- xuddi haqiqiy odam Instagram'ga yozgandek. Rus tilidan so'zma-so'z tarjima qilingan noqulay iboralar (\"integrallashtirilgan\", \"tekhnika\" kabi) ISHLATMANG. Murakkab/kitobiy so'zlardan qoching, oddiy kundalik so'zlashuv uslubida yozing.\n" +
      "  YOMON namuna (ishlatmang): \"Integrallashtirilgan oshxona, yangi tekhnikasi bilan jihozlangan.\"\n" +
      "  YAXSHI namuna: \"Oshxona zamonaviy texnika bilan jihozlangan, hammasi qo'l ostida.\"\n\n" +
      'JAVOBNI FAQAT quyidagi JSON formatda qaytaring (boshqa hech narsa yozmang):\n' +
      '{"turi": "single" yoki "karusel", "tanlangan_idlar": [<raqam>, ...], "sarlavha": "<qisqa, aniq, jozibali sarlavha>", "post_matni": "<to\'liq Instagram posti matni, hashtaglar bilan>", "sabab": "<nega shu tanlandi, 1 jumla -- faqat admin uchun, ichki>"}',
  });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 500, messages: [{ role: 'user', content }] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Claude API -> ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.content && data.content[0] ? data.content[0].text : '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude javobi JSON emas: " + text.slice(0, 200));
  return JSON.parse(match[0]);
}

// Haqiqiy material yetarli bo'lmagan kunlarda, admin'ga tayyor Gemini
// rasm-generatsiya prompti yuboradi (bepul -- Gemini ilovasida qo'lda
// generatsiya qilinadi). Admin natijani "Visart Media" guruhiga ODDIY
// rasm/video sifatida tashlaydi -- mavjud `handleMediaArxiv` oqimi buni
// avtomatik qabul qiladi, hech qanday qo'shimcha kod kerak emas.
const AI_PROMPT_SHABLONLAR = [
  "Luxury minimalist living room interior, warm ambient lighting, large windows, neutral beige and walnut palette, modern architecture magazine style, photorealistic, 9:16 vertical",
  "Modern minimalist villa exterior at golden hour, clean geometric facade, large glass panels, landscaped garden, architectural photography, photorealistic, 9:16 vertical",
  "Premium modern kitchen interior, matte black and oak cabinetry, marble island, soft natural light, photorealistic, architectural digest style, 9:16 vertical",
  "Elegant master bedroom interior, soft neutral tones, statement headboard, warm evening lighting, minimalist luxury, photorealistic, 9:16 vertical",
  "Contemporary office/co-working interior, biophilic design with plants, wood and glass, natural daylight, photorealistic, 9:16 vertical",
];

// Senarist jim xato bilan to'xtab qolsa (Claude limiti, Supabase va h.k.),
// admin buni HECH QACHON bilmay, ish "sababsiz" to'xtab qolmasligi uchun
// albatta DM yuboriladi.
async function adminXabarBer(env, matn) {
  try {
    const admins = (env.ADMIN_TELEGRAM_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
    for (const adminId of admins) {
      await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: adminId, text: matn }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => {});
    }
  } catch (e) {
    // jim e'tiborsiz
  }
}

async function aiTaklifYubor(env) {
  try {
    const admins = (env.ADMIN_TELEGRAM_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!admins.length) return;
    const prompt = AI_PROMPT_SHABLONLAR[Math.floor(Math.random() * AI_PROMPT_SHABLONLAR.length)];
    const matn =
      "📸 Bugun real material yetarli emas. Postni uzmaslik uchun AI orqali rasm generatsiya qilsak bo'ladi:\n\n" +
      "1) Quyidagi promptni Gemini ilovasiga (gemini.google.com yoki telefon ilovasi) nusxa ko'chiring:\n\n" +
      `\`${prompt}\`\n\n` +
      "2) Chiqqan natijani \"Visart Media\" guruhiga ODDIY rasm sifatida tashlang -- tizim uni avtomatik qabul qilib, davom ettiradi.";
    for (const adminId of admins) {
      await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: adminId, text: matn, parse_mode: 'Markdown' }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => {});
    }
  } catch (e) {
    // jim e'tiborsiz -- bu ixtiyoriy qo'shimcha, asosiy oqimni to'xtatmaydi
  }
}

async function handle({ request, env }) {
  const url = new URL(request.url);
  const secret = request.headers.get('X-Senarist-Secret') || url.searchParams.get('secret');
  if (!env.SENARIST_SECRET || secret !== env.SENARIST_SECRET) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }
  if (!env.ANTHROPIC_API_KEY) {
    return json({ ok: false, error: 'anthropic_key_yoq' }, 500);
  }

  let rows;
  try {
    rows = await sbFetch(env, 'media_arxiv?holat=eq.yangi&select=*&order=created_at.asc&limit=15');
  } catch (e) {
    await adminXabarBer(env, `⚠️ Senarist to'xtadi: Supabase xato -- ${String((e && e.message) || e)}`);
    return json({ ok: false, error: 'supabase_xato' }, 500);
  }
  if (!rows || rows.length < KAM_MATERIAL_CHEGARA) {
    await aiTaklifYubor(env);
    return json({ ok: true, holat: 'yetarli_material_yoq', mavjud: rows ? rows.length : 0 });
  }

  const items = [];
  for (const row of rows) {
    if (!row.file_id) continue; // thumbnail yo'q video (kamdan-kam) -- tahlil qilib bo'lmaydi
    try {
      const filePath = await tgGetFilePath(env.MIJOZ_BOT_TOKEN, row.file_id);
      if (!filePath) continue;
      const base64 = await tgDownloadBase64(env.MIJOZ_BOT_TOKEN, filePath);
      if (!base64) continue;
      items.push({ id: row.id, turi: row.turi, izoh: row.izoh, media_group_id: row.media_group_id, base64 });
    } catch (e) {
      // bitta fayl xato bersa ham, qolganlariga davom
    }
  }

  if (items.length < 2) {
    return json({ ok: true, holat: 'tahlil_qilinadigan_material_kam', mavjud: items.length });
  }

  let natija;
  try {
    natija = await claudeTahlil(env, items);
  } catch (e) {
    await adminXabarBer(env, `⚠️ Senarist to'xtadi: Claude API xato (limit/kvota tugagan bo'lishi mumkin) -- ${String((e && e.message) || e)}`);
    return json({ ok: false, error: 'claude_xato' }, 500);
  }

  const tanlanganIdlar = Array.isArray(natija.tanlangan_idlar) && natija.tanlangan_idlar.length
    ? natija.tanlangan_idlar
    : (natija.tanlangan_id ? [natija.tanlangan_id] : null); // eski format bilan orqaga moslik
  if (!tanlanganIdlar || !tanlanganIdlar.length) {
    await adminXabarBer(env, "⚠️ Senarist to'xtadi: Claude hech qanday tanlov bermadi.");
    return json({ ok: false, error: 'claude_tanlov_bermadi' }, 500);
  }

  let taklifId = null;
  try {
    const inserted = await sbFetch(env, 'media_taklif', {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify([{
        matn: `${natija.sarlavha}\n\n${natija.sabab || ''}`,
        sarlavha: natija.sarlavha || null,
        post_matni: natija.post_matni || null,
        media_arxiv_id: tanlanganIdlar[0],
        media_arxiv_idlar: tanlanganIdlar.join(','),
        holat: 'kutilmoqda',
      }]),
    });
    taklifId = inserted && inserted[0] ? inserted[0].id : null;
  } catch (e) {
    await adminXabarBer(env, `⚠️ Senarist to'xtadi: taklifni bazaga yozishda xato -- ${String((e && e.message) || e)}`);
    return json({ ok: false, error: 'taklif_yozishda_xato' }, 500);
  }

  const ids = rows.map((r) => r.id);
  await sbFetch(env, `media_arxiv?id=in.(${ids.join(',')})`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({ holat: 'ishlangan' }),
  }).catch(() => {});

  const admins = (env.ADMIN_TELEGRAM_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const kb = {
    inline_keyboard: [[
      { text: '✅ Tasdiqlash', callback_data: `stak:${taklifId}:ok` },
      { text: '❌ Rad etish', callback_data: `stak:${taklifId}:no` },
    ]],
  };
  for (const adminId of admins) {
    await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: adminId,
        text: `🎬 Senarist taklifi${natija.turi === 'karusel' ? ` (${tanlanganIdlar.length} rasmli karusel)` : ''}:\n\n📝 ${natija.sarlavha}\n\n📄 Post matni:\n${natija.post_matni || '(yo\'q)'}\n\n💡 ${natija.sabab || ''}\n\n(manba: #${tanlanganIdlar.join(', #')})\n\n🆔${taklifId}`,
        reply_markup: kb,
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => {});
  }

  return json({ ok: true, taklif_id: taklifId, turi: natija.turi, tanlangan: tanlanganIdlar });
}

export async function onRequestGet(context) {
  try {
    return await handle(context);
  } catch (e) {
    await adminXabarBer(context.env, `⚠️ Senarist kutilmagan xato bilan to'xtadi: ${String((e && e.message) || e)}`);
    return json({ ok: false, error: 'server_error' }, 500);
  }
}

export async function onRequestPost(context) {
  return onRequestGet(context);
}
