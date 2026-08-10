// POST /api/admin-login — login qilish, sessiya cookie o'rnatish.
import { signSession, sessionCookie, json } from '../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return json({ ok: false, error: 'missing_fields' }, 400);
    }
    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
      return json({ ok: false, error: 'not_configured' }, 500);
    }
    if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
      return json({ ok: false, error: 'invalid_credentials' }, 401);
    }
    const token = await signSession(env, username);
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token) });
  } catch (e) {
    return json({ ok: false, error: 'server_error' }, 500);
  }
}
