// /api/admin/describe — loyiha matnlari uchun AI yordamchi (Cloudflare Workers AI).
// Rejimlar:
//   alt     — har bir rasm uchun alt-matn (UZ/RU)
//   desc    — rasmlarga qarab SEO'ga mos tavsif (UZ/RU): interyer holati, zonalar va dizayn yechimlari tahlili
//   task    — rasmlarga qarab taxminiy "dizayn vazifasi" qoralamasi (albatta tekshirish kerak)
//   polish  — foydalanuvchining xomaki eslatmasidan professional matn (vazifa yoki tavsif uchun)
// O'zbekcha matn Gemma 3 modelida to'g'ridan-to'g'ri o'zbek tilida yoziladi va ikkinchi marta tahrir qilinadi.
import { json } from '../../_lib/auth.js';

const VISION = '@cf/meta/llama-3.2-11b-vision-instruct';
const VISION_FALLBACK = '@cf/llava-hf/llava-1.5-7b-hf';
const WRITER = '@cf/google/gemma-3-12b-it';            // ko'p tilli, o'zbek tilida kuchliroq
const LLM = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const LLM_FALLBACK = '@cf/meta/llama-3.1-8b-instruct';

function b64ToBytes(b64) {
  const clean = String(b64 || '').replace(/^data:image\/\w+;base64,/, '');
  const bin = atob(clean);
  const out = new Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Model javobini matnga aylantiradi (ba'zan "response" obyekt bo'lib keladi).
function toText(r) {
  const v = r && (r.response !== undefined ? r.response : r.result !== undefined ? r.result : r.description);
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}
function clean(t) {
  return String(t || '')
    .replace(/^```[a-z]*\s*|```$/gim, '')
    .replace(/^(Tarjima|Matn|Перевод|Текст|Translation)\s*:\s*/i, '')
    .replace(/^["«“]|["»”]$/g, '')
    .trim();
}

// Rasm modeli: avval Llama 3.2 Vision, ishlamasa — LLaVA (zaxira).
async function see(env, imageB64, prompt) {
  const bytes = b64ToBytes(imageB64);
  const errors = [];
  const runLlama = async () => clean(toText(await env.AI.run(VISION, { prompt, image: bytes, max_tokens: 450, temperature: 0.2 })));
  try {
    const out = await runLlama();
    if (out) return out;
  } catch (e) {
    errors.push('llama: ' + String(e && e.message));
    if (/agree|licen|accept/i.test(String(e && e.message))) {
      try {
        await env.AI.run(VISION, { prompt: 'agree' });
        const out = await runLlama();
        if (out) return out;
      } catch (e2) { errors.push('llama-after-agree: ' + String(e2 && e2.message)); }
    }
  }
  try {
    const out = clean(toText(await env.AI.run(VISION_FALLBACK, { image: bytes, prompt, max_tokens: 400 })));
    if (out) return out;
  } catch (e) { errors.push('llava: ' + String(e && e.message)); }
  throw new Error('vision_failed: ' + errors.join(' | '));
}

// Matn yozish: models ro'yxatini ketma-ket sinaydi.
async function write(env, models, system, user, maxTokens = 900, temperature = 0.35) {
  const input = { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: maxTokens, temperature };
  let lastErr = null;
  for (const m of models) {
    try {
      const out = clean(toText(await env.AI.run(m, input)));
      if (out) return out;
    } catch (e) { lastErr = e; }
  }
  if (lastErr) throw lastErr;
  return '';
}
const UZ_MODELS = [WRITER, LLM, LLM_FALLBACK];
const RU_MODELS = [LLM, WRITER, LLM_FALLBACK];

// ── O'zbekcha uslub qo'llanmasi va namuna ──
const UZ_STYLE = `Siz arxitektura va interyer dizayn studiyasi uchun professional o'zbek tilida matn yozuvchi muharrirsiz.
Qoidalar:
- Faqat lotin yozuvida, zamonaviy imlo: o', g', sh, ch, ng (apostrof bilan).
- Gaplar tabiiy va ravon bo'lsin, 10–20 so'z. Rus yoki ingliz tilidan so'zma-so'z ko'chirilgan iboralar ishlatilmasin.
- Atamalar: interyer, eksteryer, fasad, planirovka, zonalashtirish, saqlash tizimlari, yoritish ssenariysi, pardozlash materiallari, mebel joylashuvi, ishchi chizmalar, mualliflik nazorati, 3D vizualizatsiya.
- Ohang: iliq, ishonchli, professional; mubolag'a va reklama shiorlari yo'q ("eng zo'r", "betakror" kabi so'zlardan qoching).
- Faqat berilgan ma'lumotdan foydalaning. Maydon, manzil, yil, narx, muddat yoki mijoz so'zlarini O'YLAB TOPMANG.
Namuna uslub (mazmunini emas, uslubini oling):
"Mehmonxona va oshxona yagona ochiq makonga birlashtirilgan. Neytral bej ranglar va tabiiy yog'och teksturasi xonaga iliqlik bag'ishlaydi, devorga o'rnatilgan saqlash tizimlari esa joyni tejaydi. Yoritish bir necha bosqichda rejalashtirilgan: umumiy, ish zonasi va dekorativ yorug'lik."`;

const RU_STYLE = `Вы — редактор профессиональных текстов для архитектурно-дизайнерской студии. Пишите естественным, грамотным русским языком, 10–20 слов в предложении, без рекламных штампов и преувеличений. Используйте только переданные факты; не выдумывайте площадь, адрес, год, сроки, бюджет и слова клиента.`;

const PROOF_UZ = `${UZ_STYLE}
Vazifa: quyidagi o'zbekcha matnni tahrir qiling — grammatika, imlo, so'z tartibi va tabiiylikni tuzating. Ma'noni o'zgartirmang, yangi fakt qo'shmang. Faqat tayyor matnni qaytaring, izohsiz.`;

// ── Rasm tahlili promptlari ──
const ALT_PROMPT =
  'You write image alt text for an architecture and interior design portfolio. In ONE short phrase (max 14 words) describe what is visible: type of space or building, style, key materials, colors and lighting. Do not start with "image of" or "photo of". Do not guess location, size or people. English only.';
const OBS_PROMPT =
  'You are a senior interior architect analysing a project image. Describe in concise bullet points: 1) type of space or building and its function; 2) layout and functional zones; 3) style; 4) materials, finishes and color palette; 5) furniture, built-in storage and decor; 6) lighting scenario (natural and artificial); 7) design solutions you can see and what everyday need each one serves (e.g. "open plan connects kitchen and living area for family gatherings", "full-height wardrobes maximise storage"). Only what is visible or clearly implied by the design. Do not guess location, area, client identity, price or dates. English.';

function ctxBlock(ctx) {
  return [
    `Loyiha nomi: ${String(ctx.title_uz || '').slice(0, 120)} / ${String(ctx.title_ru || '').slice(0, 120)}`,
    `Xizmat turi: ${String(ctx.type_uz || '').slice(0, 80)} / ${String(ctx.type_ru || '').slice(0, 80)}`,
    ctx.style_uz || ctx.style_ru ? `Uslub: ${String(ctx.style_uz || '').slice(0, 60)} / ${String(ctx.style_ru || '').slice(0, 60)}` : '',
    ctx.location_uz ? `Joylashuv: ${String(ctx.location_uz).slice(0, 80)}` : '',
    ctx.area ? `Maydon: ${String(ctx.area).slice(0, 10)} m²` : '',
    `Holati: ${ctx.status === 'done' ? 'amalga oshirilgan (qurilgan)' : '3D vizualizatsiya konsepti'}`,
  ].filter(Boolean).join('\n');
}

const SEO_HINT = (ctx) =>
  `SEO: matnda tabiiy holda (bir martadan, majburlamasdan) quyidagi tushunchalar uchrasin: xizmat turi ("${ctx.type_uz || 'interyer dizayn'}"), uslub (agar berilgan bo'lsa) va "Toshkent". Kalit so'zlarni takrorlab to'ldirmang.`;
const SEO_HINT_RU = (ctx) =>
  `SEO: естественно (по одному разу) упомяните тип услуги («${ctx.type_ru || 'дизайн интерьера'}»), стиль (если указан) и «Ташкент». Без переспама.`;

async function observe(env, images) {
  const obs = [];
  for (const img of images.slice(0, 3)) obs.push(await see(env, img, OBS_PROMPT));
  return obs.map((o, i) => `Rasm ${i + 1}:\n${o}`).join('\n\n');
}

async function uzThenProof(env, system, user, maxTokens) {
  const draft = await write(env, UZ_MODELS, system, user, maxTokens);
  if (!draft) return '';
  try {
    const fixed = await write(env, UZ_MODELS, PROOF_UZ, draft, maxTokens, 0.2);
    return fixed && fixed.length >= draft.length * 0.9 ? fixed : draft;
  } catch (e) { return draft; }
}

// Matn juda qisqa bo'lsa (minChars dan kam) — model bilan 2 martagacha kengaytiradi.
const MIN_DESC = 420;
async function ensureLen(env, models, text, minChars, systemExpand) {
  let out = text || '';
  for (let i = 0; i < 2 && out && out.length < minChars; i++) {
    try {
      const more = await write(env, models, systemExpand, out, 900, 0.4);
      if (more && more.length > out.length) out = more;
    } catch (e) { break; }
  }
  return out;
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json({ ok: false, error: 'ai_not_configured' }, 500);
  try {
    const body = await request.json();
    const mode = ['alt', 'desc', 'task', 'polish'].includes(body.mode) ? body.mode : 'alt';
    const ctx = body.context || {};
    const images = (Array.isArray(body.images) ? body.images : []).filter((x) => typeof x === 'string' && x.length < 2_000_000);

    // ── Alt-matn ──
    if (mode === 'alt') {
      if (!images.length) return json({ ok: false, error: 'no_images' }, 400);
      const out = [];
      for (const img of images.slice(0, 12)) {
        const en = clean(await see(env, img, ALT_PROMPT));
        const uz = await write(env, UZ_MODELS, `${UZ_STYLE}\nVazifa: inglizcha alt-matnni qisqa (14 so'zgacha), tabiiy o'zbekcha iboraga aylantiring. Faqat iborani qaytaring.`, en, 120, 0.2);
        const ru = await write(env, RU_MODELS, `${RU_STYLE}\nПереведите английский alt-текст в короткую (до 14 слов) естественную русскую фразу. Только фраза.`, en, 120, 0.2);
        out.push({ en, uz, ru });
      }
      return json({ ok: true, alts: out });
    }

    // ── Xomaki eslatmadan professional matn ──
    if (mode === 'polish') {
      const notes = String(body.notes || '').trim().slice(0, 3000);
      if (notes.length < 5) return json({ ok: false, error: 'no_notes', message: "Avval qisqa eslatma yozing" }, 400);
      const kind = body.kind === 'desc' ? 'desc' : 'task';
      const goalUz = kind === 'task'
        ? "Eslatmadan loyiha \"Vazifa\" bo'limi uchun 2–4 gapli professional matn yozing: kim uchun, asosiy talablar, qanday muammo hal qilinishi kerak edi."
        : "Eslatmadan loyiha tavsifi uchun 2 xatboshidan iborat (90–160 so'z) professional matn yozing.";
      const goalRu = kind === 'task'
        ? 'Напишите по заметкам 2–4 предложения для раздела «Задача»: для кого проект, основные требования, какую проблему нужно было решить.'
        : 'Напишите по заметкам профессиональное описание проекта: 2 абзаца, 90–160 слов.';
      const user = `${ctxBlock(ctx)}\n\nEslatma (foydalanuvchi yozgan, faqat shu faktlardan foydalaning):\n${notes}`;
      const uz = await uzThenProof(env, `${UZ_STYLE}\n${goalUz}\n${kind === 'desc' ? SEO_HINT(ctx) : ''}\nFaqat tayyor matnni qaytaring.`, user, 700);
      const ru = await write(env, RU_MODELS, `${RU_STYLE}\n${goalRu}\n${kind === 'desc' ? SEO_HINT_RU(ctx) : ''}\nТолько готовый текст.`, user, 700);
      if (!uz && !ru) return json({ ok: false, error: 'generation_failed', message: "Model bo'sh javob qaytardi" }, 502);
      return json({ ok: true, uz, ru });
    }

    if (!images.length) return json({ ok: false, error: 'no_images' }, 400);
    const observations = await observe(env, images);
    const user = `${ctxBlock(ctx)}\n\nRasmlar tahlili (arxitektor kuzatuvi):\n${observations}`;

    // ── Rasmlar bo'yicha tavsif ──
    if (mode === 'desc') {
      let uz = await uzThenProof(env,
        `${UZ_STYLE}\nVazifa: rasmlar tahlili asosida loyiha tavsifini yozing — 2 xatboshi, 150–200 so'z (kamida 900 belgi). Matn qisqa bo'lib qolmasin.\n1-xatboshi: makon, uslub, ranglar va materiallar.\n2-xatboshi: zonalashtirish, saqlash, yoritish va bu yechimlar kundalik hayotda qanday qulaylik yaratishi (dizayn yechimlarining maqsadi sifatida yozing, mijoz gaplari sifatida emas).\n${SEO_HINT(ctx)}\nFaqat tayyor matnni qaytaring, sarlavhasiz.`,
        user, 900);
      let ru = await write(env, RU_MODELS,
        `${RU_STYLE}\nНапишите описание проекта по анализу изображений: 2 абзаца, 150–200 слов (не менее 900 знаков), не сокращайте. 1-й абзац — пространство, стиль, цвета и материалы. 2-й — зонирование, хранение, освещение и какую пользу эти решения дают в повседневной жизни (как цель дизайнерских решений, а не слова клиента).\n${SEO_HINT_RU(ctx)}\nТолько готовый текст, без заголовков.`,
        user, 900);
      uz = await ensureLen(env, UZ_MODELS, uz, MIN_DESC,
        `${UZ_STYLE}\nQuyidagi tavsif juda qisqa. Uni 2 xatboshi, 150–200 so'zgacha kengaytiring: zonalashtirish, materiallar, yoritish va dizayn yechimlarining maqsadini batafsilroq yozing. Yangi fakt (maydon, joy, narx, muddat) qo'shmang. Faqat tayyor matnni qaytaring.`);
      ru = await ensureLen(env, RU_MODELS, ru, MIN_DESC,
        `${RU_STYLE}\nОписание ниже слишком короткое. Расширьте его до 2 абзацев, 150–200 слов: подробнее о зонировании, материалах, освещении и назначении решений. Не добавляйте новых фактов (площадь, адрес, цена, сроки). Только готовый текст.`);
      if (!uz && !ru) return json({ ok: false, error: 'generation_failed', message: "Model bo'sh javob qaytardi" }, 502);
      return json({ ok: true, desc_uz: uz, desc_ru: ru });
    }

    // ── Rasmlar bo'yicha taxminiy vazifa ──
    const uz = await uzThenProof(env,
      `${UZ_STYLE}\nVazifa: rasmlardagi dizayn yechimlariga qarab loyihaning ehtimoliy dizayn vazifasini 2–4 gapda yozing: makon qanday ehtiyojlar uchun loyihalangani va qaysi muammolar hal qilingani. "Loyihada ... talab qilindi / ko'zda tutildi" uslubida yozing. Aniq raqam, joy va shaxsiy ma'lumot qo'shmang.\nFaqat tayyor matnni qaytaring.`,
      user, 500);
    const ru = await write(env, RU_MODELS,
      `${RU_STYLE}\nПо дизайнерским решениям на изображениях сформулируйте вероятную задачу проекта в 2–4 предложениях: для каких потребностей спроектировано пространство и какие проблемы решены. Стиль: «В проекте требовалось… / предусматривалось…». Без цифр, адресов и личных данных. Только текст.`,
      user, 500);
    if (!uz && !ru) return json({ ok: false, error: 'generation_failed', message: "Model bo'sh javob qaytardi" }, 502);
    return json({ ok: true, uz, ru });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e && e.message) }, 500);
  }
}
