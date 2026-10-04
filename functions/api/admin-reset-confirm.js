// POST /api/admin-reset-confirm — kod to'g'ri bo'lsa, yangi parolni o'rnatadi va barcha eski sessiyalarni bekor qiladi.
import { json } from '../_lib/auth.js';
import { authGet, authSet, authDel, makeHash, checkHash, validatePassword } from '../_lib/adminAuth.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) return json({ ok: false, error: 'not_available' }, 503);
    const { code, password } = await request.json();
    const bad = validatePassword(password, env.ADMIN_USERNAME);
    if (bad) return json({ ok: false, error: 'weak_password', message: bad }, 400);
    const raw = await authGet(env.DB, 'reset_code');
    if (!raw) return json({ ok: false, error: 'invalid_code' }, 400);
    const o = JSON.parse(raw);
    if (!o.exp || o.exp < Date.now() || o.tries >= 5) { await authDel(env.DB, 'reset_code'); return json({ ok: false, error: 'expired' }, 400); }
    const okCode = /^\d{8}$/.test(String(code || '')) && await checkHash(String(code), o.h);
    if (!okCode) {
      o.tries += 1;
      if (o.tries >= 5) await authDel(env.DB, 'reset_code'); else await authSet(env.DB, 'reset_code', JSON.stringify(o));
      return json({ ok: false, error: 'invalid_code' }, 400);
    }
    await authSet(env.DB, 'admin_pw', await makeHash(password));
    await authSet(env.DB, 'session_epoch', String(Date.now()));
    await authDel(env.DB, 'reset_code');
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'server_error' }, 500);
  }
}
