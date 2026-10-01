// /api/admin/describe — rasm(lar)ga qarab tavsif qoralamasi yoki alt-matn yozadi (Cloudflare Workers AI).
// Faqat rasmda KO'RINADIGAN narsalar yoziladi; joy, maydon, mijoz, yil kabi faktlar o'ylab topilmaydi.
import { json } from '../../_lib/auth.js';

const VISION = '@cf/meta/llama-3.2-11b-vision-instruct';
const LLM = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

function b64ToBytes(b64) {
  const clean = String(b64 || '').replace(/^data:image\/\w+;base64,/, '');
  const bin = atob(clean);
  const out = new Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function see(env, imageB64, prompt) {
  const input = { prompt, image: b64ToBytes(imageB64), max_tokens: 300, temperature: 0.2 };
  try {
    const r = await env.AI.run(VISION, input);
    return String((r && r.response) || '').trim();
  } catch (e) {
    // Birinchi marta Meta litsenziyasiga rozilik talab qilinadi — avtomatik rozilik beramiz va qayta urinamiz.
    if (/agree|licen/i.test(String(e && e.message))) {
      await env.AI.run(VISION, { prompt: 'agree' }).catch(() => {});
      const r = await env.AI.run(VISION, input);
      return String((r && r.response) || '').trim();
    }
    throw e;
  }
}

async function ask(env, system, user, maxTokens = 900) {
  const r = await env.AI.run(LLM, {
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens: maxTokens,
    temperature: 0.3,
  });
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
