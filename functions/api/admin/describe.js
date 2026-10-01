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

async function ask(env, system, user, maxTokens = 900) {
  const input = { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: maxTokens, temperature: 0.3 };
  try {
    const r = await env.AI.run(LLM, input);
    const out = String((r && (r.response || r.result)) || '').trim();
    if (out) return out;
  } catch (e) { /* zaxira modelga o'tamiz */ }
  const r = await env.AI.run(LLM_FALLBACK, input);
  return String((r && (r.response || r.result)) || '').trim();
}

function parseJson(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}

const ALT_PROMPT =
  'You write image alt text for an architecture and interior design portfolio. In ONE short phrase (max 14 words) describe what is visible: type of space or building, style, key materials, colors and lighting. Do not start with "image of" or "photo of". Do not guess location, size or people. English only.';
const OBS_PROMPT =
  'You are an architect. List the design elements clearly visible in this image as short bullet points: type of space or building, architectural or interior style, materials and finishes, color palette, furniture and decor, lighting, notable details. Only what is visible. Do not guess location, area, client, price or dates. English.';

const TR_SYSTEM =
  'Translate the given English alt text into Russian and into Uzbek (Latin script). Natural, concise, professional interior/architecture vocabulary. Return ONLY JSON: {"ru":"...","uz":"..."}';

const DESC_SYSTEM =
  "You write portfolio project descriptions for VISART ARCHDESIGN, an architecture and interior design studio in Tashkent. Write TWO versions: Russian and Uzbek (Latin script, modern standard spelling with o' and g'). Each 110-170 words, 2 short paragraphs, warm and professional, no exaggeration. Use ONLY the visual observations and the given project title/type/style. STRICTLY do not invent facts: no area, address, district, year, timeline, budget, client details or quotes. Do not use the words 'luxury' or 'unique' more than once. Return ONLY JSON: {\"ru\":\"...\",\"uz\":\"...\"}";

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
        const en = await see(env, img, ALT_PROMPT);
        const tr = parseJson(await ask(env, TR_SYSTEM, en, 300)) || {};
        out.push({ en, ru: String(tr.ru || '').trim(), uz: String(tr.uz || '').trim() });
      }
      return json({ ok: true, alts: out });
    }

    const ctx = body.context || {};
    const observations = [];
    for (const img of images.slice(0, 3)) observations.push(await see(env, img, OBS_PROMPT));
    const user =
      `Project title (uz): ${String(ctx.title_uz || '').slice(0, 120)}\n` +
      `Project title (ru): ${String(ctx.title_ru || '').slice(0, 120)}\n` +
      `Service type: ${String(ctx.type_uz || '').slice(0, 80)} / ${String(ctx.type_ru || '').slice(0, 80)}\n` +
      `Style: ${String(ctx.style_uz || '').slice(0, 80)} / ${String(ctx.style_ru || '').slice(0, 80)}\n` +
      `Status: ${ctx.status === 'done' ? 'completed and built' : '3D visualization concept'}\n\n` +
      `Visual observations:\n${observations.map((o, i) => `Image ${i + 1}:\n${o}`).join('\n\n')}`;
    const res = parseJson(await ask(env, DESC_SYSTEM, user, 1400)) || {};
    if (!res.ru && !res.uz) return json({ ok: false, error: 'generation_failed' }, 502);
    return json({ ok: true, desc_ru: String(res.ru || '').trim(), desc_uz: String(res.uz || '').trim() });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e && e.message) }, 500);
  }
}
