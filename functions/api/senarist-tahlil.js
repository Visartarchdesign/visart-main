// Cloudflare Pages Function — /api/senarist-tahlil
// Senarist agenti: "Visart Media" guruhiga tashlangan xom video/rasmlarni
// (mijoz-bot.js to'plagan `media_arxiv` jadvali) tahlil qiladi, ulardan
// ijtimoiy tarmoq uchun eng mos keladiganini tanlab, sarlavha/g'oya yozadi
// va admin DM'ga tasdiqlash uchun yuboradi (`media_taklif` jadvali).
// Tasdiqlangan taklif keyingi bosqich (Montajchi agenti) uchun navbatga
// qo'yiladi -- hozircha faqat tasdiqlash/rad etish ishlaydi.
//
// Tashqi bepul cron (cron-job.org) O'ZBEKISTON AUDITORIYASIGA MOSLANGAN,
// Visart kabi arxitektura/ekspert brendi uchun haftalik reja asosida
// chaqiradi (Toshkent vaqti, UTC+5). Admin tasdiqlagandan keyin montaj va
// Instagram/Facebook posting DARHOL ishga tushgani uchun (qo'shimcha
// kutish/navbat yo'q), cron VAQTI = AMALIY NASHR VAQTI deb olinadi -- shuning
// uchun admin shu oynalar atrofida tasdiqlashga harakat qilsin.
//
// HAFTALIK REJA (flagship = eng muhim, albatta tasdiqlanishi kerak bo'lgan kun):
//   Dushanba  -- asosiy Reel SHART EMAS, faqat Stories bilan isitish
//   Seshanba  -- 19:30 flagship Instagram Reel (eng kuchli IG oynasi, Sesh-Pay)
//   Chorshanba-- 12:15 carousel (loyiha/before-after/smeta), 18:30 2-IG oyna
//   Payshanba -- 19:30 flagship Reel (case-study/ekspert video)
//   Juma      -- 18:00 YouTube Shorts (IG flagship kunga qo'yilmaydi -- Juma/Shanba IG'da zaifroq)
//   Shanba    -- agressiv sotuv emas, Stories bilan inson qiyofali kontent
//   Yakshanba -- 10:00 YouTube uzun video (long-form uchun eng kuchli yakka slot)
//
// cron-job.org'da shu VAQTLARGA mos alohida vazifalar (har biri bir xil
// URL'ni chaqiradi -- Senarist o'zi mavjud xom materialga qarab mos
// formatni (Reel/carousel/Stories) tanlaydi):
//   Seshanba  19:30 -- cron: 30 14 * * 2
//   Chorshanba 12:15 -- cron: 15 07 * * 3
//   Chorshanba 18:30 -- cron: 30 13 * * 3
//   Payshanba 19:30 -- cron: 30 14 * * 4
//   Dushanba/Shanba 08:15 (Stories uchun yengil tekshiruv) -- cron: 15 03 * * 1,6
//   GET https://visartdesign.uz/api/senarist-tahlil?secret=<SENARIST_SECRET>
//
// Instagram Stories: Reel/carousel kuni Senarist/admin kun bo'ylab bir nechta
// Story bosqichini (ob'ektdan 1-2 kadr ertalab ~08:15, so'rov/poll ~13:00,
// asosiy post haqida teaser ~bir oz oldin, post'ni Story'ga ulash darhol
// undan keyin, savol-javob kechqurun) qo'lda ham tashlashi mumkin -- bu
// yagona "katta post" dan ko'ra tabiiyroq ko'rinadi. Montajchi (media-server/
// montaj.js) hozircha har bir tasdiqlangan Reels'ni e'lon qilgach, SHU
// DAQIQADA bir xil videoni Story sifatida ham avtomatik joylaydi (minimal,
// ishonchli bazaviy daraja); to'liq ko'p-bosqichli Story oqimi keyingi
// bosqichda alohida navbat/jadval mexanizmi bilan qo'shilishi mumkin.
//
// Facebook: hozircha Instagram bilan BIR VAQTDA (admin tasdiqlagan zahoti)
// chiqadi -- tadqiqotga ko'ra Facebook uchun ideal vaqt ertalab (Sesh-Pay
// 09:00) bo'lsa-da, buni Instagram'dan ALOHIDA kechiktirib chiqarish
// hozirgi arxitekturada (sinxron so'rov, navbat yo'q) amalga oshmaydi --
// keyingi bosqichda alohida kechiktirilgan nashr navbati qo'shilganda
// Facebook'ni ertasi kuni 09:00'ga o'tkazish mumkin bo'ladi.
//
// Telegram: kanalga e'lon qilish ham admin tasdiqlagan zahoti ketadi;
// eng mos umumiy oyna -- 20:00 (Sesh-Pay + Yak kuchliroq).
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

const MODEL = 'claude-sonnet-5';
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
      "- \"post_matni\" TUZILISHI (professional arxitektura-studiyalar standartiga asosan):\n" +
      "  1) OCHILISH JUMLASI -- estetikadan (\"zamonaviy\", \"chiroyli\") emas, KONKRET muammo/yechim yoki qiziq faktdan boshlang (agar izohda bor bo'lsa). Masalan umumiy \"Zamonaviy interyer\" o'rniga: \"Bu 15 m² oshxonada har bir santimetr hisobga olingan.\" -- xuddi do'stingizga qahva stoli ustida gapirayotgandek, oddiy va aniq tilda. MUHIM: Instagram feed'da \"...ko'proq\" tugmasidan oldin FAQAT taxminan 125 BELGI ko'rinadi -- shuning uchun ochilish jumlasi O'ZI ALOHIDA to'liq ma'no bersin va diqqatni ushlab tursin, qolgan matnni ochmasa ham tushunarli bo'lsin.\n" +
      "  2) 2-3 jumla -- rasmda ko'ringan va/yoki izohda aytilgan aniq xususiyatlar (material, rang, yorug'lik, funksionallik) -- lekin texnik spec-varaq kabi ro'yxat qilib emas, tabiiy hikoya jumlalari ichiga singdirib yozing.\n" +
      "  3) OXIRIDA -- chaqiriq (call-to-action), KONTENT TURIGA mos tanlang va har safar aynan bir xil jumla bilan takrorlamang: (a) haqiqiy loyiha/xizmat posti bo'lsa -- \"DM yozing\"/\"buyurtma uchun yozing\" turidagi harakatga chaqiruv; (b) foydali maslahat/ma'lumot posti bo'lsa -- \"saqlab qoying\" (keyin kerak bo'ladi) yoki \"erga/ustaga/arxitektorga yuboring\" turidagi save/share'ga undash -- arxitektura/remont kontentida odamlar buni ko'pincha turmush o'rtog'i yoki ustasiga yuboradi, shuni ANIQ nomlab eslatish (\"ustangizga yuboring\") save/share like'dan ko'ra ko'proq qiymatga ega bo'lgan Instagram algoritmik signalni kuchaytiradi -- vaziyatga qarab mos variantni tanlang.\n" +
      "  4) Keyin hashtag'lar -- 6-8 ta, UCH QATLAMLI tanlang: 2-3 ta KENG (#interyer #dizayn #architecture), 2-3 ta TOR/NISH (aniq uslub/xona turiga mos, masalan #minimalistinteryer #oshxonadizayni), 2 ta MAHALLIY (#toshkent #uzbekistan yoki #visartdesign) -- faqat bir xil keng hashtag to'plamini doim takrorlamang, mazmunga mosini tanlang.\n" +
      "  5) SEO -- post_matni ICHIGA (1-qatlamda, zo'rlab emas, tabiiy jumla ichida) odamlar qidiruvda yozadigan iboralarni singdiring (masalan \"Toshkentda interyer dizayn\", \"arxitektura studiyasi\", xona/uslub nomi) -- bu Instagram'ning ichki qidiruvida va Google'da ham topilishga yordam beradi; hashtag'larda ham xuddi shu kalit so'zlarga mos variantlarni ustun qo'ying.\n" +
      "  HECH QANDAY formatlash belgisi ishlatmang (**, *, __), bullet ro'yxat yozmang -- ravon jumlalar bilan yozing, 1-2 ta tabiiy emoji bo'lishi mumkin.\n" +
      "- TIL: SODDA, TABIIY, ZAMONAVIY o'zbek tilida (lotin yozuvida) yozing -- xuddi haqiqiy odam Instagram'ga yozgandek. Rus tilidan so'zma-so'z tarjima qilingan noqulay iboralar (\"integrallashtirilgan\", \"tekhnika\" kabi) ISHLATMANG. Murakkab/kitobiy so'zlardan qoching, oddiy kundalik so'zlashuv uslubida yozing.\n" +
      "  YOMON namuna (ishlatmang): \"Integrallashtirilgan oshxona, yangi tekhnikasi bilan jihozlangan.\"\n" +
      "  YAXSHI namuna: \"Oshxona zamonaviy texnika bilan jihozlangan, hammasi qo'l ostida.\"\n" +
      "- HECH QACHON asossiz \"hype\" sifatlardan foydalanib maqtamang -- \"ajoyib\", \"mukammal\", \"eng yaxshi\", \"betakror\", \"hayratlanarli\" kabi so'zlarni dalilsiz ishlatish professional ko'rinmaydi (bu ArchDaily/Dezeen kabi nufuzli arxitektura nashrlari qochadigan uslub) -- o'rniga KONKRET detal bilan taassurot qoldiring (masalan \"mukammal yoritilgan\" o'rniga \"tungi yoritqich stol ustidagi ishni qulay qiladi\").\n\n" +
      "- DIQQATNI TORTISH (hook) usullari -- mazmunga ENG mos keladigan BITTASINI tanlang (bir xilini ketma-ket ishlatmang, xilma-xillikka harakat qiling): (a) konkret raqam/o'lcham (\"15 m²da...\"), (b) kutilmagan qarama-qarshilik (\"Kichik xona -- katta imkoniyat\"), (c) savol (\"Oshxonangiz tor tuyuladimi?\"), (d) \"ko'pchilik xato qiladi\" turidagi qiziqish uyg'otuvchi kirish, (e) \"oldin/keyin\" yoki natija-fokusli kirish (agar izohda jarayon/natija haqida ma'lumot bo'lsa), (f) PAS (Problem-Agitate-Solution): muammoni ayting, nega bezovta qilishini ko'rsating, keyin yechimni taqdim eting, (g) \"qiziqish bo'shlig'i\" (curiosity gap) -- natijani darrov aytmasdan, o'qishga undaydigan kirish (\"Bu devordagi bitta detal xonani butunlay o'zgartirdi\"), (h) bitta ANIQ detalga e'tiborni qaratish (\"Diqqat qiling: ...\") -- faqat rasmda yoki izohda haqiqatan ko'zga tashlanadigan aniq elementni ko'rsating. Hech qaysi hook o'ylab topilgan FAKT talab qilmasligi kerak -- faqat uslub/ritorika. Umumiy/bo'sh \"Zamonaviy va qulay\" kabi klişe jumlalardan QOCHING.\n" +
      "- IMLO: matnni yozib bo'lgach o'zingiz qayta o'qing -- imlo/punktuatsiya xatosi, so'z qo'shilib ketishi yoki noto'g'ri harf ISHLATILMASLIGI SHART. Faqat to'g'ri, standart o'zbek lotin yozuvida yozing.\n\n" +
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
    body: JSON.stringify({ model: MODEL, max_tokens: 900, messages: [{ role: 'user', content }] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Claude API -> ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const textBlok = (data.content || []).find((b) => b.type === 'text');
  const text = textBlok ? textBlok.text : '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude javobi JSON emas: " + text.slice(0, 200));
  return JSON.parse(match[0]);
}

// Haqiqiy material yetarli bo'lmagan kunlarda, admin'ga tayyor Gemini
// rasm-generatsiya prompti yuboradi (bepul -- Gemini ilovasida qo'lda
// generatsiya qilinadi). Admin natijani "Visart Media" guruhiga ODDIY
// rasm/video sifatida tashlaydi -- mavjud `handleMediaArxiv` oqimi buni
// avtomatik qabul qiladi, hech qanday qo'shimcha kod kerak emas.
// MUHIM: bular HAQIQIY Visart loyihasi sifatida ko'rsatilmaydi (bu
// ishonchni buzadi) -- faqat FOYDALI MASLAHAT/MA'LUMOT postiga mos,
// MAVHUM/illyustrativ vizual g'oya. Har bir shablon: {mavzu, rasm_gipi}.
// "rasm_gipi" -- Gemini'ga beriladigan, ANIQ loyiha emas, balki konsept/
// illyustrativ uslubdagi rasm uchun prompt.
const AI_MASLAHAT_SHABLONLAR = [
  {
    mavzu: "Kichik xonani vizual kattaroq ko'rsatish usullari",
    rasm_gipi: "Minimal flat-design illustration, interior design concept icons (mirror, light, light colors), soft pastel palette, abstract (not a real room photo), 9:16 vertical",
  },
  {
    mavzu: "To'g'ri yoritish xonani qanday o'zgartiradi",
    rasm_gipi: "Abstract illustration of warm vs cold lighting concept, minimal flat design, soft gradients, architectural icons, not a real room photo, 9:16 vertical",
  },
  {
    mavzu: "Kichik byudjet bilan premium ko'rinishga erishish yo'llari",
    rasm_gipi: "Minimal flat-design illustration, budget vs premium interior concept icons, clean modern style, abstract (not a real room photo), 9:16 vertical",
  },
  {
    mavzu: "Oshxonada funksional zonalashtirish qoidalari",
    rasm_gipi: "Abstract flat-design floor plan / zoning diagram illustration, minimal modern style, not a real photo, 9:16 vertical",
  },
  {
    mavzu: "Minimalist interyerda rang tanlash qoidalari",
    rasm_gipi: "Abstract color palette illustration for interior design, minimal flat style, swatches and simple room silhouette, not a real room photo, 9:16 vertical",
  },
  {
    mavzu: "Interyer dizaynida ko'p qiladigan 5 ta xato",
    rasm_gipi: "Minimal flat-design illustration, checklist/mistake icons, interior design theme, soft modern palette, abstract (not a real room photo), 9:16 vertical",
  },
  {
    mavzu: "2026-yilda dolzarb interyer trendlari (tabiiy materiallar, issiq minimalizm)",
    rasm_gipi: "Abstract flat-design illustration of natural materials and warm minimalism trend -- wood, linen, stone texture icons, soft palette, not a real room photo, 9:16 vertical",
  },
  {
    mavzu: "Saqlash joyi (storage) kamchil xonalarda qanday ko'payadi",
    rasm_gipi: "Minimal flat-design illustration of smart storage concepts, built-in shelving icons, abstract, not a real room photo, 9:16 vertical",
  },
  {
    mavzu: "Mebel va devor rangini to'g'ri moslashtirish qoidasi",
    rasm_gipi: "Abstract color-matching illustration, furniture and wall palette swatches, minimal flat style, not a real room photo, 9:16 vertical",
  },
  {
    mavzu: "Yotoqxonada tinch uyqu uchun dizayn maslahatlari",
    rasm_gipi: "Minimal flat-design illustration, calm bedroom concept icons, soft muted palette, abstract (not a real room photo), 9:16 vertical",
  },
];

// Bir xil mavzu ketma-ket/tez-tez takrorlanmasligi uchun, sof tasodifiy
// o'rniga yil kuniga asoslangan aylanma tanlov (barcha mavzular tugamaguncha
// takrorlanmaydi).
function kunlikShablonTanla() {
  const kun = Math.floor(Date.now() / 86400000);
  return AI_MASLAHAT_SHABLONLAR[kun % AI_MASLAHAT_SHABLONLAR.length];
}

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

// Umumiy, keng tan olingan arxitektura/interyer qoidalariga asoslangan
// qisqa maslahat matnini Claude'dan so'raydi -- HECH QANDAY o'ylab
// topilgan statistika/raqam yoki "bizning loyiha" degan da'vo bo'lmasligi
// kerak, faqat umumiy va to'g'ri dizayn tamoyillari.
async function claudeMaslahatYoz(env, mavzu) {
  if (!env.ANTHROPIC_API_KEY) return null;
  const prompt =
    `Mavzu: "${mavzu}".\n\n` +
    "Visart Design (arxitektura/interyer studiyasi) Instagram sahifasi uchun qisqa, FOYDALI maslahat posti yozing.\n" +
    "QOIDALAR (qat'iy):\n" +
    "- Faqat KENG TAN OLINGAN, umumiy dizayn/arxitektura tamoyillariga tayaning (masalan: yorug'lik, ranglar, zonalashtirish haqida umumiy bilim). HECH QANDAY aniq raqam, statistika yoki \"bizning loyihada\" degan da'vo yozmang -- bu o'ylab topilgan yolg'on bo'ladi.\n" +
    "- Bu AI-konsept rasm bilan boradi, HAQIQIY Visart loyihasi sifatida taqdim etilmaydi -- shuning uchun matnda ham buni aniq loyiha deb ko'rsatmang, umumiy maslahat sifatida yozing.\n" +
    "- Birinchi jumla DIQQATNI TORTISHI kerak -- savol, kutilmagan fakt, qarama-qarshilik yoki \"qiziqish bo'shlig'i\" (natijani darrov aytmaslik) bilan boshlang, bo'sh \"Zamonaviy dizayn\" kabi klişelardan qoching. Instagram'da \"...ko'proq\" tugmasidan oldin ~125 belgi ko'rinadi -- ochilish jumlasi shu uzunlikda o'zi mustaqil ma'noga ega va diqqatni ushlaydigan bo'lsin.\n" +
    "- \"ajoyib\", \"mukammal\", \"eng yaxshi\", \"betakror\" kabi asossiz hype-sifatlardan qoching -- KONKRET maslahat/detal bilan ishontiring.\n" +
    "- OXIRIDA chaqiriq -- bu foydali-maslahat posti bo'lgani uchun odatda \"saqlab qoying\" (keyin kerak bo'lganda qaytib ko'rish uchun) yoki \"shuni biladigan tanishingizga yuboring\" turidagi save/share'ga undash eng mos keladi (sotuv chaqirug'idan ko'ra).\n" +
    "- Sodda, tabiiy o'zbek tilida, formatlash belgilarisiz (**, * yo'q), 3-5 qisqa jumla + oxirida 5-7 ta hashtag (2-3 ta keng #interyer #dizayn, 2 ta tor/mavzuga mos, 1-2 ta #visartdesign/#toshkent). Yozib bo'lgach imlo xatosiz ekanligini tekshirib chiqing.\n\n" +
    'JAVOBNI FAQAT shu JSON formatda qaytaring: {"sarlavha": "<qisqa sarlavha>", "post_matni": "<to\'liq post matni>"}';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
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

async function aiTaklifYubor(env) {
  try {
    const admins = (env.ADMIN_TELEGRAM_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!admins.length) return;
    const shablon = kunlikShablonTanla();
    const maslahat = await claudeMaslahatYoz(env, shablon.mavzu);

    const matn =
      "💡 Bugun real material yetarli emas. Postni uzmaslik uchun FOYDALI MASLAHAT formatida kontent tayyorladim (bu HAQIQIY loyiha sifatida emas, umumiy maslahat sifatida chiqadi):\n\n" +
      `📝 ${maslahat ? maslahat.sarlavha : shablon.mavzu}\n\n` +
      `📄 Post matni:\n${maslahat ? maslahat.post_matni : '(avtomatik yozilmadi, o\'zingiz yozib qo\'yishingiz mumkin)'}\n\n` +
      "Rasm uchun (MAVHUM/konseptual, haqiqiy loyiha emas -- shuning uchun aniq xona fotosi EMAS, illyustrativ uslubda):\n" +
      "1) Quyidagi promptni Gemini ilovasiga (gemini.google.com yoki telefon ilovasi) nusxa ko'chiring:\n\n" +
      `\`${shablon.rasm_gipi}\`\n\n` +
      "2) Chiqqan natijani \"Visart Media\" guruhiga shu post matni bilan birga (izoh qilib) tashlang -- tizim avtomatik qabul qilib, davom ettiradi.";
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
