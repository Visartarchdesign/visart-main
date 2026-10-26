// POST /api/ilova-seo-yukla (multipart) -- admin ilovadan SEO agentiga rasm yuborish. Auth: Telegram initData + ADMIN_TELEGRAM_IDS.
// Rasmlar adminning bot chatiga fayl sifatida yuboriladi (file_id olish uchun), keyin botda SEO oqimi davom etadi.
import { seoIlovadan } from '../_lib/seoAgent.js';

const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? new TextEncoder().encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
}
async function tekshir(env, initData) {
  const p = new URLSearchParams(initData || '');
  const hash = p.get('hash'); if (!hash) return null;
  p.delete('hash');
  const s = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  if (hex(await hmac(await hmac('WebAppData', env.MIJOZ_BOT_TOKEN), s)) !== hash) return null;
  if (Date.now() / 1000 - Number(p.get('auth_date') || 0) > 86400) return null;
  try { return JSON.parse(p.get('user')); } catch { return null; }
}

export async function onRequestPost({ request, env }) {
  let f; try { f = await request.formData(); } catch { return J({ ok: false, error: 'forma' }, 400); }
  const u = await tekshir(env, f.get('initData'));
  const admins = String(env.ADMIN_TELEGRAM_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!u || !admins.includes(String(u.id))) return J({ ok: false, error: 'ruxsat' }, 403);
  let n = {}; try { n = JSON.parse(f.get('n') || '{}'); } catch {}
  n = { sayt: !!n.sayt, yandex: !!n.yandex, google: !!n.google, gis: !!n.gis };
  if (!Object.values(n).some(Boolean)) return J({ ok: false, error: 'Joy tanlanmadi' }, 400);
  const files = f.getAll('rasm').filter((x) => x && typeof x === 'object' && /^image\//.test(x.type || '')).slice(0, 20);
  if (!files.length) return J({ ok: false, error: 'Rasm yoq' }, 400);
  const out = [];
  for (const [i, file] of files.entries()) {
    const fd = new FormData(); fd.append('chat_id', String(u.id)); fd.append('document', file, `ilova_${Date.now()}_${i + 1}.jpg`);
    const r = await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendDocument`, { method: 'POST', body: fd, signal: AbortSignal.timeout(40000) }).then((x) => x.json()).catch(() => null);
    if (!r || !r.ok || !r.result.document) return J({ ok: false, error: `${i + 1}-rasm yuborilmadi` }, 502);
    out.push({ fid: r.result.document.file_id, mid: r.result.message_id });
  }
  try { await seoIlovadan(env, u.id, n, out); } catch (e) { return J({ ok: false, error: String(e.message || e).slice(0, 120) }, 500); }
  return J({ ok: true, soni: out.length });
}
