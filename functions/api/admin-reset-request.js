// POST /api/admin-reset-request — parolni tiklash kodini Telegram'ga yuboradi (10 daqiqa amal qiladi).
import { json } from '../_lib/auth.js';
import { saytXabar, kodQabulqiluvchilar, sozlanganmi } from '../_lib/tgNotify.js';
import { authGet, authSet, makeHash } from '../_lib/adminAuth.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB || !sozlanganmi(env)) return json({ ok: false, error: 'not_available' }, 503);
    const now = Date.now();
    // Oxirgi so'rovdan 60 soniya o'tmaguncha yangisi yuborilmaydi; soatiga 5 tadan ko'p emas.
    let st = { last: 0, hour: 0, n: 0 };
    try { const raw = await authGet(env.DB, 'reset_rl'); if (raw) st = JSON.parse(raw); } catch (e) {}
    if (now - st.last < 60000) return json({ ok: false, error: 'wait', wait: Math.ceil((60000 - (now - st.last)) / 1000) }, 429);
    if (now - st.hour > 3600000) { st.hour = now; st.n = 0; }
    if (st.n >= 5) return json({ ok: false, error: 'too_many' }, 429);
    st.last = now; st.n += 1;
    await authSet(env.DB, 'reset_rl', JSON.stringify(st));

    const buf = crypto.getRandomValues(new Uint32Array(1))[0] % 100000000;
    const code = String(buf).padStart(8, '0');
    await authSet(env.DB, 'reset_code', JSON.stringify({ h: await makeHash(code), exp: now + 10 * 60 * 1000, tries: 0 }));

    const text = `🔐 Visart Admin — parolni tiklash kodi:\n\n${code}\n\nKod 10 daqiqa amal qiladi. Agar siz so'ramagan bo'lsangiz, e'tibor bermang va parolni almashtiring.`;
    const ok = await saytXabar(env, kodQabulqiluvchilar(env), text);
    if (!ok) return json({ ok: false, error: 'send_failed' }, 502);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'server_error' }, 500);
  }
}
