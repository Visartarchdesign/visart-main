// POST /api/admin/password — kirgan admin parolni almashtiradi (joriy parolni bilishi shart).
import { json, signSession, sessionCookie } from '../../_lib/auth.js';
import { authSet, makeHash, verifyAdminPassword, validatePassword } from '../../_lib/adminAuth.js';

export async function onRequestPost({ request, env }) {
  try {
    const { current, password } = await request.json();
    if (!(await verifyAdminPassword(env, String(current || '')))) return json({ ok: false, error: 'invalid_current' }, 400);
    const bad = validatePassword(password, env.ADMIN_USERNAME);
    if (bad) return json({ ok: false, error: 'weak_password', message: bad }, 400);
    const epoch = Date.now();
    await authSet(env.DB, 'admin_pw', await makeHash(password));
    await authSet(env.DB, 'session_epoch', String(epoch));
    // Joriy qurilmada chiqib ketmaslik uchun yangi sessiya beramiz.
    const ttl = 60 * 60 * 24 * 30;
    const token = await signSession(env, env.ADMIN_USERNAME, ttl, epoch);
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token, ttl) });
  } catch (e) {
    return json({ ok: false, error: 'server_error' }, 500);
  }
}
