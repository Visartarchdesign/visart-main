// POST /api/admin-login — login qilish, sessiya cookie o'rnatish.
import { signSession, sessionCookie, json } from '../_lib/auth.js';
import { verifyAdminPassword, sessionEpoch, rateCheck, rateFail, rateReset } from '../_lib/adminAuth.js';

export async function onRequestPost({ request, env }) {
  try {
    const { username, password, remember } = await request.json();
    if (!username || !password) return json({ ok: false, error: 'missing_fields' }, 400);
    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) return json({ ok: false, error: 'not_configured' }, 500);

    const ip = request.headers.get('CF-Connecting-IP') || 'x';
    let rl = null;
    if (env.DB) {
      rl = await rateCheck(env.DB, ip, 'login', 8, 15 * 60);
      if (rl.blocked) return json({ ok: false, error: 'too_many', wait: rl.wait }, 429);
    }
    const userOk = String(username) === String(env.ADMIN_USERNAME);
    const passOk = await verifyAdminPassword(env, String(password)); // login noto'g'ri bo'lsa ham tekshiriladi (vaqt farqi bo'lmasin)
    if (!userOk || !passOk) {
      if (rl) await rateFail(env.DB, rl);
      return json({ ok: false, error: 'invalid_credentials' }, 401);
    }
    if (rl) await rateReset(env.DB, rl);
    const ttl = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
    const token = await signSession(env, username, ttl, await sessionEpoch(env));
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token, ttl) });
  } catch (e) {
    return json({ ok: false, error: 'server_error' }, 500);
  }
}
