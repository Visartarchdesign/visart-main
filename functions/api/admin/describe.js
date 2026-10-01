// /api/admin/describe — rasm(lar)ga qarab tavsif qoralamasi yoki alt-matn yozadi (Cloudflare Workers AI).
// Faqat rasmda KO'RINADIGAN narsalar yoziladi; joy, maydon, mijoz, yil kabi faktlar o'ylab topilmaydi.
import { json } from '../../_lib/auth.js';

const VISION = '@cf/meta/llama-3.2-11b-vision-instruct';
const LLM = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const LLM_FALLBACK = '@cf/meta/llama-3.1-8b-instruct';
const VISION_FALLBACK = '@cf/llava-hf/llava-1.5-7b-hf';

function b64ToBytes(b64) {
  const clean = String(b64 || '').replace(/^data:image\/\w+;base64,/, '');
  const bin = atob(clean);
  const out = new Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Rasm modeli: avval Llama 3.2 Vision, ishlamasa — LLaVA (zaxira).
async function see(env, imageB64, prompt) {
  const bytes = b64ToBytes(imageB64);
  const errors = [];
  const runLlama = async () => {
    const r = await env.AI.run(VISION, { prompt, image: bytes, max_tokens: 300, temperature: 0.2 });
    return String((r && (r.response || r.description)) || '').trim();
  };
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
    const r = await env.AI.run(VISION_FALLBACK, { image: bytes, prompt, max_tokens: 300 });
    const out = String((r && (r.description || r.response)) || '').trim();
    if (out) return out;
  } catch (e) { errors.push('llava: ' + String(e && e.message)); }
  throw new Error('vision_failed: ' + errors.join(' | '));
}

// Model javobini matnga aylantiradi (ba'zan "response" obyekt bo'lib keladi).
function toText(r) {
  const v = r && (r.response !== undefined ? r.response : r.result !== undefined ? r.result : r.description);
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}
function clean(t) {
  return String(t || '').replace(/^```[a-z]*\s*|```$/gim, '').replace(/^["«]|["»]$/g, '').trim();
}

async function ask(env, system, user, maxTokens = 900) {
  const input = { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: maxTokens, temperature: 0.3 };
  try {
    const out = clean(toText(await env.AI.run(LLM, input)));
    if (out) return out;
  } catch (e) { /* zaxira modelga o'tamiz */ }
  return clean(toText(await env.AI.run(LLM_FALLBACK, input)));
}

const ALT_PROMPT =
  'You write image alt text for an architecture and interior design portfolio. In ONE short phrase (max 14 words) describe what is visible: type of space or building, style, key materials, colors and lighting. Do not start with "image of" or "photo of". Do not guess location, size or people. English only.';
const OBS_PROMPT =
  'You are an architect. List the design elements clearly visible in this image as short bullet points: type of space or building, architectural or interior style, materials and finishes, color palette, furniture and decor, lighting, notable details. Only what is visible. Do not guess location, area, client, price or dates. English.';

const TO_RU = 'Translate the user text into natural professional Russian (architecture / interior design vocabulary). Output ONLY the translation, no quotes, no comments.';
const TO_UZ = "Translate the user text into natural professional Uzbek in Latin script (modern spelling with o' and g'; architecture / interior design vocabulary). Output ONLY the translation, no quotes, no comments.";

const DESC_SYSTEM =
  "You write a portfolio project description in Russian for VISART ARCHDESIGN, an architecture and interior design studio in Tashkent. 110-170 words, 2 short paragraphs, warm and professional, no exaggeration. Use ONLY the visual observations and the given title/type/style. STRICTLY do not invent facts: no area, address, district, year, timeline, budget, client details or quotes. Output ONLY the description text in Russian, no headings, no quotes.";

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json({ ok: false, error: 'ai_not_configured' }, 500);
  try {
    const body = await request.json();
    const mode = body.mode === 'desc' ? 'desc' : 'alt';
    const images = (Array.isArray(body.images) ? body.images : []).filter((x) => typeof x === 'string' && x.length < 2_000_000);
    if (!images.length) return json({ ok: false, error: 'no_images' }, 400);

    if (mode === 'alt') {
      const out = [];
      for (const img of images.slice(0, 12)) {
        const en = clean(await see(env, img, ALT_PROMPT));
        const ru = await ask(env, TO_RU, en, 200);
        const uz = await ask(env, TO_UZ, en, 200);
        out.push({ en, ru, uz });
      }
      return json({ ok: true, alts: out });
    }

    const ctx = body.context || {};
    const observations = [];
    for (const img of images.slice(0, 3)) observations.push(await see(env, img, OBS_PROMPT));
    const user =
      `Project title: ${String(ctx.title_ru || ctx.title_uz || '').slice(0, 120)}\n` +
      `Service type: ${String(ctx.type_ru || ctx.type_uz || '').slice(0, 80)}\n` +
      `Style: ${String(ctx.style_ru || ctx.style_uz || '').slice(0, 80)}\n` +
      `Status: ${ctx.status === 'done' ? 'completed and built' : '3D visualization concept'}\n\n` +
      `Visual observations:\n${observations.map((o, i) => `Image ${i + 1}:\n${o}`).join('\n\n')}`;
    const ru = await ask(env, DESC_SYSTEM, user, 900);
    if (!ru) return json({ ok: false, error: 'generation_failed', message: 'Model bo\'sh javob qaytardi' }, 502);
    const uz = await ask(env, TO_UZ, ru, 1100);
    return json({ ok: true, desc_ru: ru, desc_uz: uz });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e && e.message) }, 500);
  }
}
