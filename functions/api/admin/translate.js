// /api/admin/translate — o'zbekcha matnlarni ruschaga tarjima qiladi (Cloudflare Workers AI, bepul limit ichida).
// Sozlash: Cloudflare Pages -> Settings -> Functions -> Bindings -> Workers AI, o'zgaruvchi nomi: AI
import { json } from '../../_lib/auth.js';

const LLM = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MT = '@cf/meta/m2m100-1.2b';

async function translateOne(env, text) {
  if (!text || !text.trim()) return '';
  try {
    const r = await env.AI.run(LLM, {
      messages: [
        {
          role: 'system',
          content:
            "You are a professional translator for an architecture and interior design studio in Tashkent. Translate the user's Uzbek (Latin script) text into natural, fluent Russian suitable for a premium website. Keep professional terms (интерьер, фасад, рабочие чертежи, авторский надзор, под ключ). Keep numbers and units unchanged. Return ONLY the Russian translation, no quotes or comments.",
        },
        { role: 'user', content: text },
      ],
      max_tokens: 1200,
      temperature: 0.2,
    });
    const out = (r && (r.response || r.result || '')).toString().trim();
    if (out) return out;
  } catch (e) {
    /* zaxira modelga o'tamiz */
  }
  const r2 = await env.AI.run(MT, { text, source_lang: 'uz', target_lang: 'ru' });
  return (r2 && r2.translated_text ? r2.translated_text : '').trim();
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json({ ok: false, error: 'ai_not_configured' }, 500);
  try {
    const body = await request.json();
    const texts = body && typeof body.texts === 'object' ? body.texts : {};
    const out = {};
    for (const [k, v] of Object.entries(texts)) {
      out[k] = await translateOne(env, String(v || '').slice(0, 4000));
    }
    return json({ ok: true, translations: out });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}
