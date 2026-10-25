// POST /api/ilova-admin — Telegram Mini App (admin ilova) API. Kirish: Telegram initData (HMAC) + ADMIN_TELEGRAM_IDS.
// Pul sarflaydigan amallar (target yoqish/byudjet) bu yerda YO'Q -- ular faqat botda tasdiqlanadi.
import { mediaChaqir } from '../_lib/media.js';

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
  const sir = await hmac('WebAppData', env.MIJOZ_BOT_TOKEN);
  if (hex(await hmac(sir, s)) !== hash) return null;
  if (Date.now() / 1000 - Number(p.get('auth_date') || 0) > 86400) return null;
  try { return JSON.parse(p.get('user')); } catch { return null; }
}
const sb = async (env, path, init = {}) => {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal', ...(init.headers || {}) }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`sb ${r.status}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
};
const q = (env, path) => sb(env, path, { headers: { Prefer: '' } }).catch(() => []);

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return J({ ok: false }, 400); }
  const u = await tekshir(env, b.initData);
  const admins = String(env.ADMIN_TELEGRAM_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!u || !admins.includes(String(u.id))) return J({ ok: false, error: 'ruxsat' }, 403);

  const a = b.amal;
  if (a === 'bosh') {
    const t0 = new Date(Date.now() + 5 * 3600e3); t0.setUTCHours(0, 0, 0, 0);
    const bugun = new Date(t0.getTime() - 5 * 3600e3).toISOString();
    const media = await fetch(`${env.MEDIA_SERVER_URL}/health`, { signal: AbortSignal.timeout(4000) }).then((r) => r.ok).catch(() => false);
    const [navbat, tayyor, faol, taklif, lid, obyekt] = await Promise.all([
      q(env, 'nashr_navbati?holat=eq.kutilmoqda&turi=in.(video_ig_tg,facebook_photo,facebook_video,instagram_story)&select=id&limit=200'),
      q(env, 'nashr_navbati?turi=eq.video_nashr&holat=eq.tasdiq_kutilmoqda&select=id&limit=200'),
      q(env, 'nashr_navbati?turi=eq.target&holat=eq.target_faol&select=id'),
      q(env, 'nashr_navbati?turi=eq.target&holat=in.(tasdiq_kutilmoqda,target_tayyor)&select=id'),
      q(env, `lidlar?created_at=gte.${encodeURIComponent(bugun)}&select=id&limit=300`),
      q(env, 'obyektlar?select=id&limit=1000'),
    ]);
    return J({ ok: true, media, navbat: navbat.length, tayyor: tayyor.length, faol: faol.length, taklif: taklif.length, lid: lid.length, obyekt: obyekt.length });
  }
  if (a === 'navbat') return J({ ok: true, rows: (await q(env, 'nashr_navbati?turi=neq.media_holat&turi=neq.target&select=id,turi,holat,nashr_vaqti,payload&order=id.desc&limit=40')).map((r) => ({ id: r.id, turi: r.turi, holat: r.holat, vaqt: r.nashr_vaqti, sarlavha: (r.payload && (r.payload.sarlavha || r.payload.matn || '')).toString().slice(0, 90) })) });
  if (a === 'tayyor') return J({ ok: true, rows: (await q(env, 'nashr_navbati?turi=eq.video_nashr&holat=eq.tasdiq_kutilmoqda&select=id,payload,created_at&order=id.desc&limit=20')).map((r) => ({ id: r.id, sarlavha: (r.payload && r.payload.sarlavha) || '', video: (r.payload && r.payload.video_url) || '', sana: String(r.created_at).slice(0, 10) })) });
  if (a === 'joylash' && b.id) { const r = await mediaChaqir(env, '/nashr', { id: String(b.id), adminChatId: u.id }, u.id); return J({ ok: !!(r && r.ok), sabab: r && r.sabab }); }
  if (a === 'bekor' && b.id) { await sb(env, `nashr_navbati?id=eq.${Number(b.id)}&turi=eq.video_nashr`, { method: 'PATCH', body: JSON.stringify({ holat: 'bekor' }) }); return J({ ok: true }); }
  if (a === 'lidlar') {
    const bot = await q(env, 'lidlar?select=ism,telefon,xizmat_turi,maydon_m2,manba,created_at&order=created_at.desc&limit=30');
    let sayt = []; try { sayt = ((await env.DB.prepare('SELECT name, phone, service, created_at FROM leads ORDER BY id DESC LIMIT 30').all()).results) || []; } catch {}
    return J({ ok: true, bot, sayt });
  }
  if (a === 'target') return J({ ok: true, rows: (await q(env, "nashr_navbati?turi=eq.target&select=id,holat,payload&order=id.desc&limit=15")).map((r) => { const t = (r.payload && r.payload.taklif) || {}, v = r.payload && r.payload.tanlov; return { id: r.id, nom: t.nom || '', holat: r.holat, kun: v ? v.kun_usd : null, kunlar: v ? v.kunlar : null }; }) });
  if (a === 'obyektlar') return J({ ok: true, rows: await q(env, 'obyektlar?select=id,nom,holat&order=id.desc&limit=60') });
  return J({ ok: false, error: 'amal' }, 400);
}
