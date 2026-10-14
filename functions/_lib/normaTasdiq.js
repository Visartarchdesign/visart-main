// Norma qoidalarini admin tasdiqlashi (✅/❌) + haftalik "tasdiq kutayotganlar" eslatmasi.
// Jadval (norma_qoidalari) yo'q bo'lsa hamma narsa jim o'tkazib yuboriladi -- jonli botga ta'sir qilmaydi.
import { xabarYubor } from './outbox.js';
const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const sb = async (env, path, init = {}) => {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: init.prefer || 'return=representation' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`sb ${r.status}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};
const KUTAYOTGAN = 'tasdiqlangan=eq.false&rad_etilgan=eq.false';

export function qoidaMatni(q, qoldi) {
  const qiymat = q.operator === 'between' ? `${q.qiymat_min} … ${q.qiymat_max}` : `${q.operator} ${q.qiymat_min != null ? q.qiymat_min : q.qiymat_max}`;
  return `📚 <b>Norma qoidasi #${q.id}</b>${qoldi != null ? ` (kutayotgan: ${qoldi})` : ''}\n\n` +
    `Soha: ${esc(q.soha)}${q.xona_turi ? ` · ${esc(q.xona_turi)}` : ''}\n` +
    `Parametr: <b>${esc(q.parametr)}</b>\nTalab: <b>${esc(qiymat)} ${esc(q.birlik || '')}</b>\n` +
    `Jiddiylik: ${esc(q.jiddiylik)}\n` +
    `Manba: ${esc((q.norma_manba && (q.norma_manba.kod || q.norma_manba.nom)) || '—')}, band: ${esc(q.band)}` +
    (q.izoh ? `\nIzoh: ${esc(q.izoh)}` : '');
}

// Keyingi tasdiqlanmagan qoidani ko'rsatadi
export async function normaKorsat(env, send) {
  let list, son;
  try {
    list = await sb(env, `norma_qoidalari?${KUTAYOTGAN}&order=id.asc&limit=1&select=*,norma_manba(kod,nom)`);
    son = await sb(env, `norma_qoidalari?${KUTAYOTGAN}&select=id`, { headers: {} });
  } catch (e) { await send("📚 Norma bazasi hali yaratilmagan (db/migration_bilim_bazasi.sql ni Supabase'da ishga tushiring)."); return; }
  if (!list || !list.length) { await send('✅ Tasdiqlanishi kutilayotgan norma qoidasi yo\'q.'); return; }
  const q = list[0];
  await send(qoidaMatni(q, (son || []).length), { inline_keyboard: [[
    { text: '✅ Tasdiqlash', callback_data: `ap:nqa:${q.id}` }, { text: '❌ Rad etish', callback_data: `ap:nqr:${q.id}` }, { text: '⏭ Keyingisi', callback_data: 'ap:nq' }]] });
}

// ✅ / ❌ bosilganda
export async function normaBelgila(env, id, tasdiq, admin) {
  const patch = tasdiq ? { tasdiqlangan: true } : { rad_etilgan: true };
  await sb(env, `norma_qoidalari?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ ...patch }) });
  return tasdiq ? `✅ #${id} tasdiqlandi${admin ? '' : ''}` : `❌ #${id} rad etildi`;
}

// Cron: har dushanba 10:00 (Toshkent) dan keyin bitta eslatma. Kalit bilan takror yuborilmaydi; navbat jadvali bo'lmasa umuman yubormaydi.
export async function haftalikNormaEslatma(env, adminIdlar) {
  const tosh = new Date(Date.now() + 5 * 3600e3);
  if (tosh.getUTCDay() !== 1 || tosh.getUTCHours() < 10 || !adminIdlar.length) return null;
  try {
    await sb(env, 'xabar_navbati?select=id&limit=1');               // takror himoyasi mavjudligini tekshirish
    const kut = await sb(env, `norma_qoidalari?${KUTAYOTGAN}&select=id`);
    if (!kut || !kut.length) return null;
    const hafta = tosh.toISOString().slice(0, 10);
    for (const a of adminIdlar) {
      await xabarYubor(env, { chat_id: a, tur: 'norma-hafta', kalit: `norma-hafta:${hafta}:${a}`,
        matn: `📚 Haftalik: <b>${kut.length}</b> ta norma qoidasi tasdig'ingizni kutmoqda.\nAdmin panel → 📚 Norma qoidalari.` });
    }
    return kut.length;
  } catch (e) { return null; }
}
