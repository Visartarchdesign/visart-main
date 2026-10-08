// POST /api/moliya-auth — Moliya ilovasi (app.visartdesign.uz) SUPERADMIN uchun Telegram bog'lanishi:
//   {action:'login_alert', token}            -- superadmin kirganda botga ogohlantirish (token = Supabase access_token, serverda tekshiriladi)
//   {action:'reset_request', login}          -- parolni tiklash kodi botga yuboriladi (faqat superadmin login'lari uchun)
//   {action:'reset_confirm', login, code, password}
// Jadval: db/migration_moliya_reset.sql. Mijoz/prorab parollariga TEGILMAYDI (ular uchun mavjud oqim).
import { saytXabar, kodQabulqiluvchilar, sozlanganmi } from '../_lib/tgNotify.js';

const ORIGINS = ['https://app.visartdesign.uz'];
const cors = (req) => {
  const o = req.headers.get('Origin') || '';
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
};
const resp = (req, data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) } });
export const onRequestOptions = ({ request }) => new Response(null, { status: 204, headers: cors(request) });

async function sb(env, path, init = {}) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: init.prefer || 'return=representation' },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`sb ${r.status}`);
  const x = await r.text();
  return x ? JSON.parse(x) : null;
}
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const loginOk = (s) => /^[a-z0-9._-]{2,40}$/.test(s);

export async function onRequestPost({ request, env }) {
  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !sozlanganmi(env)) return resp(request, { ok: false, error: 'not_available' }, 503);
    const b = await request.json().catch(() => ({}));
    const ip = request.headers.get('CF-Connecting-IP') || '?';
    const ua = (request.headers.get('User-Agent') || '').slice(0, 80);
    const xabar = (t) => saytXabar(env, kodQabulqiluvchilar(env), `${t}\n🌍 ${ip}\n📱 ${ua}`);

    if (b.action === 'login_alert') {
      const u = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${String(b.token || '')}` }, signal: AbortSignal.timeout(8000) });
      if (!u.ok) return resp(request, { ok: false }, 401);
      const user = await u.json();
      const sa = await sb(env, `superadmins?user_id=eq.${encodeURIComponent(user.id)}&select=login`);
      if (!sa || !sa.length) return resp(request, { ok: true });   // superadmin emas -- jim
      await xabar(`🔓 Moliya ilovasiga SUPERADMIN kirdi: ${sa[0].login}`);
      return resp(request, { ok: true });
    }

    const login = String(b.login || '').trim().toLowerCase();
    if (!loginOk(login)) return resp(request, { ok: false, error: 'invalid' }, 400);
    const sa = await sb(env, `superadmins?login=eq.${encodeURIComponent(login)}&select=user_id,login`);
    const bor = !!(sa && sa.length);

    if (b.action === 'reset_request') {
      if (!bor) return resp(request, { ok: true });                     // login borligini oshkor qilmaymiz
      const old = await sb(env, `moliya_reset?login=eq.${encodeURIComponent(login)}&select=last_at`).catch(() => null);
      if (old && old[0] && Date.now() - Date.parse(old[0].last_at) < 60000) return resp(request, { ok: false, error: 'wait' }, 429);
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 100000000).padStart(8, '0');
      await sb(env, 'moliya_reset', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: JSON.stringify([{
        login, hash: await sha(`${login}:${code}:${env.SUPABASE_SERVICE_ROLE_KEY}`), exp: new Date(Date.now() + 600000).toISOString(), tries: 0, last_at: new Date().toISOString() }]) });
      const sent = await xabar(`🔐 Moliya SUPERADMIN (${login}) parolini tiklash kodi:\n\n${code}\n\nKod 10 daqiqa amal qiladi. So'ramagan bo'lsangiz e'tibor bermang.`);
      return resp(request, sent ? { ok: true } : { ok: false, error: 'send_failed' }, sent ? 200 : 502);
    }

    if (b.action === 'reset_confirm') {
      const pw = String(b.password || '');
      if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return resp(request, { ok: false, error: 'weak_password' }, 400);
      const rows = await sb(env, `moliya_reset?login=eq.${encodeURIComponent(login)}&select=hash,exp,tries`);
      const r = rows && rows[0];
      if (!bor || !r || Date.parse(r.exp) < Date.now() || r.tries >= 5) return resp(request, { ok: false, error: 'invalid_code' }, 400);
      const togri = (await sha(`${login}:${String(b.code || '').trim()}:${env.SUPABASE_SERVICE_ROLE_KEY}`)) === r.hash;
      if (!togri) {
        await sb(env, `moliya_reset?login=eq.${encodeURIComponent(login)}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ tries: r.tries + 1 }) });
        return resp(request, { ok: false, error: 'invalid_code' }, 400);
      }
      const up = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${sa[0].user_id}`, {
        method: 'PUT', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }), signal: AbortSignal.timeout(10000) });
      if (!up.ok) return resp(request, { ok: false, error: 'update_failed' }, 502);
      await sb(env, `moliya_reset?login=eq.${encodeURIComponent(login)}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
      await xabar(`✅ Moliya SUPERADMIN (${login}) paroli almashtirildi.`);
      return resp(request, { ok: true });
    }
    return resp(request, { ok: false, error: 'unknown_action' }, 400);
  } catch (e) {
    return resp(request, { ok: false, error: 'server_error' }, 500);
  }
}
