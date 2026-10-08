// POST /api/admin-login — login qilish, sessiya cookie o'rnatish.
import { signSession, sessionCookie, json } from '../_lib/auth.js';
import { saytXabar, kodQabulqiluvchilar, sozlanganmi } from '../_lib/tgNotify.js';
import { authGet, authSet, verifyAdminPassword, sessionEpoch, rateCheck, rateFail, rateReset } from '../_lib/adminAuth.js';

async function ogohlantir(env, request, matn) {
  try {
    if (!sozlanganmi(env)) return;
    const ip = request.headers.get('CF-Connecting-IP') || '?';
    const ua = (request.headers.get('User-Agent') || '').slice(0, 80);
    const mamlakat = (request.cf && request.cf.country) || '';
    await saytXabar(env, kodQabulqiluvchilar(env), `${matn}\n🌍 ${ip}${mamlakat ? ' (' + mamlakat + ')' : ''}\n📱 ${ua}`);
  } catch (e) { /* xabar muhim emas */ }
}

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
      try {   // noto'g'ri urinish haqida 10 daqiqada 1 martadan ko'p xabar bermaymiz
        const raw = env.DB ? await authGet(env.DB, 'login_alert') : null;
        if (!raw || Date.now() - Number(raw) > 600000) {
          if (env.DB) await authSet(env.DB, 'login_alert', String(Date.now()));
          await ogohlantir(env, request, "⚠️ Admin panelga NOTO'G'RI kirish urinishi");
        }
      } catch (e) {}
      return json({ ok: false, error: 'invalid_credentials' }, 401);
    }
    if (rl) await rateReset(env.DB, rl);
    await ogohlantir(env, request, '🔓 Admin panelga kirildi');
    const ttl = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7;
    const token = await signSession(env, username, ttl, await sessionEpoch(env));
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token, ttl) });
  } catch (e) {
    return json({ ok: false, error: 'server_error' }, 500);
  }
}
