// Claude API zaxirasi: Anthropic so'rovi xato bersa (401/403/429/5xx, tarmoq), xuddi shu so'rovni
// Gemini'ga o'tkazib, Anthropic shaklidagi javob qaytaradi. Chaqiruvchi kod o'zgarmaydi:
//   fetch('https://api.anthropic.com/v1/messages', init)  ->  aiFetch(env, 'https://api.anthropic.com/v1/messages', init)
const GEMINI_MODEL = (env) => env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash';

function geminiQism(content) {
  if (typeof content === 'string') return [{ text: content }];
  return (content || []).map((b) => {
    if (b.type === 'text') return { text: b.text };
    if (b.type === 'image' && b.source && b.source.type === 'base64') return { inlineData: { mimeType: b.source.media_type, data: b.source.data } };
    return null;
  }).filter(Boolean);
}

async function geminiJavob(env, body, signal) {
  if (!env.GEMINI_API_KEY) return null;
  const msgs = [...(body.messages || [])];
  let prefill = '';   // Claude "assistant prefill": Gemini'da oxirgi model navbati bo'lmaydi
  if (msgs.length > 1 && msgs[msgs.length - 1].role === 'assistant') { const l = msgs.pop(); prefill = typeof l.content === 'string' ? l.content : geminiQism(l.content).map((p) => p.text || '').join(''); }
  const contents = msgs.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: geminiQism(m.content) }));
  if (prefill) contents[contents.length - 1].parts.push({ text: `\n\nJavobni aynan shu bilan boshlang: ${prefill}` });
  const req = { contents, generationConfig: { maxOutputTokens: Math.max(1024, body.max_tokens || 2048) } };
  if (body.system) req.systemInstruction = { parts: geminiQism(body.system) };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL(env)}:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req), signal,
  });
  if (!r.ok) return null;
  const d = await r.json();
  let text = (((d.candidates || [])[0] || {}).content || {}).parts?.filter((p) => p.text && !p.thought).map((p) => p.text).join('') || '';
  if (!text) return null;
  if (prefill) { const i = text.indexOf(prefill.trim()); text = i >= 0 ? text.slice(i + prefill.trim().length) : text; }
  const json = { id: 'gemini', type: 'message', role: 'assistant', model: GEMINI_MODEL(env), stop_reason: 'end_turn', content: [{ type: 'text', text }], zaxira: 'gemini' };
  return new Response(JSON.stringify(json), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function aiFetch(env, url, init = {}) {
  let res = null;
  try { res = await fetch(url, init); } catch (e) { res = null; }
  if (res && res.ok) return res;
  if (res && res.status === 400) return res;   // so'rovning o'zi noto'g'ri -- zaxira yordam bermaydi
  let body = {}; try { body = JSON.parse(init.body || '{}'); } catch (e) { /* */ }
  const z = await geminiJavob(env, body, AbortSignal.timeout(55000)).catch(() => null);
  if (z) { console.log('aiFetch: Claude', res ? res.status : 'tarmoq', '-> Gemini zaxira'); return z; }
  if (res) return res;
  throw new Error('Claude va Gemini javob bermadi');
}
