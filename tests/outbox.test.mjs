import test from 'node:test'; import assert from 'node:assert/strict';
import { xabarYubor, navbatniYubor } from '../functions/_lib/outbox.js';
const env = { MIJOZ_BOT_TOKEN: 't', SUPABASE_URL: 'http://s', SUPABASE_SERVICE_ROLE_KEY: 'k', ADMIN_TELEGRAM_IDS: '1' };
function qalbaki({ tg = 'ok', jadval = true } = {}) {
  const rows = []; const st = { tg, jadval, yuborilgan: 0 };
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url), m = init.method || 'GET';
    const R = (s, b) => new Response(b == null ? '' : JSON.stringify(b), { status: s });
    if (u.includes('api.telegram.org')) {
      if (st.tg === 'ok') { st.yuborilgan++; return R(200, { ok: true }); }
      if (st.tg === '429') return R(429, { ok: false, description: 'Too Many', parameters: { retry_after: 5 } });
      if (st.tg === '403') return R(403, { ok: false, description: 'bot was kicked' });
    }
    if (u.includes('xabar_navbati')) {
      if (!st.jadval) return R(404, {});
      if (m === 'POST') { const r = { id: rows.length + 1, ...JSON.parse(init.body)[0], holat: 'kutilmoqda', urinish: 0, keyingi_urinish: new Date().toISOString() }; rows.push(r); return R(201, [r]); }
      if (m === 'PATCH') { const id = +u.match(/id=eq\.(\d+)/)[1]; const r = rows.find((x) => x.id === id); Object.assign(r, JSON.parse(init.body)); return R(200, [r]); }
      if (u.includes('kalit=eq')) { const k = decodeURIComponent(u.match(/kalit=eq\.([^&]+)/)[1]); return R(200, rows.filter((x) => x.kalit === k)); }
      return R(200, rows.filter((x) => x.holat === 'kutilmoqda' && x.keyingi_urinish <= new Date().toISOString()));
    }
    return R(200, []);
  };
  return { rows, st };
}
test('muvaffaqiyatli yuborish jurnalga yoziladi', async () => {
  const { rows } = qalbaki(); const r = await xabarYubor(env, { chat_id: 5, matn: 'a' });
  assert.equal(r.holat, 'yuborildi'); assert.equal(rows[0].holat, 'yuborildi');
});
test('kalit takror yuborishni to\'sadi', async () => {
  const { st } = qalbaki(); await xabarYubor(env, { chat_id: 5, matn: 'a', kalit: 'k' });
  assert.equal((await xabarYubor(env, { chat_id: 5, matn: 'a', kalit: 'k' })).holat, 'takror'); assert.equal(st.yuborilgan, 1);
});
test('429 -> navbatda, keyin qayta yuboriladi', async () => {
  const { rows, st } = qalbaki({ tg: '429' });
  assert.equal((await xabarYubor(env, { chat_id: 5, matn: 'b' })).holat, 'navbatda');
  st.tg = 'ok'; rows[0].keyingi_urinish = new Date(Date.now() - 1000).toISOString();
  const n = await navbatniYubor(env);
  // tunda (21:00-08:00 Toshkent) navbatniYubor ataylab yubormaydi
  const hh = new Date(Date.now() + 5 * 3600e3).getUTCHours();
  if (hh >= 8 && hh < 21) { assert.equal(n.yuborildi, 1); assert.equal(rows[0].holat, 'yuborildi'); } else assert.ok(n.o_tkazildi);
});
test('403 -> xato (qayta urinilmaydi)', async () => {
  const { rows } = qalbaki({ tg: '403' }); assert.equal((await xabarYubor(env, { chat_id: 5, matn: 'c' })).holat, 'xato'); assert.equal(rows[0].holat, 'xato');
});
test('jadval yo\'q bo\'lsa ham eskicha yuboriladi', async () => {
  const { st } = qalbaki({ jadval: false }); assert.equal((await xabarYubor(env, { chat_id: 5, matn: 'd' })).holat, 'yuborildi'); assert.equal(st.yuborilgan, 1);
});
