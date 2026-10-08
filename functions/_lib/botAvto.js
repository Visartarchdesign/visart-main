// Bot avtomatikasi (cron /api/nashr-navbati ichidan): obyekt holati o'zgarsa mijozga xabar,
// topshirilganda baho so'rovi, kunlik xulosa, javobsiz lid eslatmasi.
const raqam = (s) => String(s || '').replace(/\D/g, '');
const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const BITDI = /tugal|topshir|yakun|bitdi|заверш|сдан|done|complete/i;

export const menejerIdlari = (env) => (env.MANAGER_CHAT_ID ? [env.MANAGER_CHAT_ID]
  : String(env.ADMIN_TELEGRAM_IDS || '').split(',').map((x) => x.trim()).filter(Boolean));

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

async function tg(env, chat_id, text, reply_markup) {
  await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', ...(reply_markup ? { reply_markup } : {}) }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}

// Toshkent vaqti bo'yicha keyingi soat:daqiqa (UTC ISO)
export function keyingiToshkent(soat, kunQosh = 0) {
  const t = new Date(Date.now() + 5 * 3600 * 1000);
  t.setUTCHours(soat, 0, 0, 0);
  let ms = t.getTime() - 5 * 3600 * 1000 + kunQosh * 864e5;
  if (ms <= Date.now()) ms += 864e5;
  return new Date(ms).toISOString();
}

// 1) Obyekt holati o'zgarsa mijozga xabar (birinchi ko'rilganda jim yoziladi)
// Holat o'zgarganda: logni yangilaydi, mijoz va menejerlarga xabar yuboradi.
// Cron (obyektKuzatuv) va webhook (/api/obyekt-holat) ikkalasi ham shuni chaqiradi.
export async function holatXabar(env, o, id, yangi, prof) {
  const eski = await sb(env, `obyekt_holat_log?select=holat&obyekt_id=eq.${encodeURIComponent(id)}`).catch(() => null);
  if (eski === null) return;                         // jadval yo'q
  if (eski.length && eski[0].holat === yangi) return; // allaqachon xabar qilingan
  if (!eski.length) await sb(env, 'obyekt_holat_log', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify([{ obyekt_id: id, holat: yangi }]) }).catch(() => {});
  else await sb(env, `obyekt_holat_log?obyekt_id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ holat: yangi, updated_at: new Date().toISOString() }) }).catch(() => {});
  const last9 = raqam(o.mijoz_tel).slice(-9);
  if (last9.length >= 9) {
    if (!prof) prof = await sb(env, 'mijoz_profil?select=chat_id,tel,til&tel=not.is.null&limit=2000').catch(() => []);
    for (const p of (prof || []).filter((x) => raqam(x.tel).slice(-9) === last9)) {
      const ru = p.til === 'ru';
      await tg(env, p.chat_id, ru
        ? `🏗 <b>${esc(o.nom)}</b>\nСтатус объекта обновлён: <b>${esc(yangi)}</b>`
        : `🏗 <b>${esc(o.nom)}</b>\nObyekt holati yangilandi: <b>${esc(yangi)}</b>`);
      if (BITDI.test(yangi)) {
        await tg(env, p.chat_id, ru ? 'Оцените, пожалуйста, нашу работу:' : 'Ishimizni baholang, iltimos:',
          { inline_keyboard: [[1, 2, 3, 4, 5].map((n) => ({ text: `${n}⭐`, callback_data: `rt:${id}:${n}`.slice(0, 64) }))] });
      }
    }
  }
  // Muzlatilgan: obyektning mijoz guruhiga to'lov eslatmasi
  if (/muzlat|заморож|frozen/i.test(yangi)) {
    const g = await sb(env, `visart_loyiha_guruhlar?obyekt_id=eq.${encodeURIComponent(id)}&select=telegram_chat_id`).catch(() => []);
    if (g && g[0]) {
      await tg(env, g[0].telegram_chat_id, `⏸ Diqqat: obyektingiz ("${esc(o.nom)}") bo'yicha pul mablag'i tugagani sababli qurilish jarayoni vaqtincha to'xtatildi.\n\nIshni davom ettirish uchun, iltimos, navbatdagi to'lovni amalga oshiring. To'lov qabul qilingach, ishlar darhol qayta boshlanadi. Savollar bo'lsa, menejerimiz bilan bog'laning. 🙏`);
    }
  }
  for (const m of menejerIdlari(env)) await tg(env, m, `🏗 Obyekt holati o'zgardi: <b>${esc(o.nom)}</b> → ${esc(yangi)}`);
}

export async function obyektKuzatuv(env) {
  if (!env.MIJOZ_BOT_TOKEN) return { xato: 'MIJOZ_BOT_TOKEN yoq' };
  const [obs, log, prof] = await Promise.all([
    sb(env, 'obyektlar?select=id,nom,holat,mijoz_tel&limit=1000'),
    sb(env, 'obyekt_holat_log?select=obyekt_id,holat&limit=2000').catch(() => null),
    sb(env, 'mijoz_profil?select=chat_id,tel,til&tel=not.is.null&limit=2000').catch(() => []),
  ]);
  if (!log) return { xato: 'obyekt_holat_log jadvali yoq (migration_bot_avto.sql)' };
  const eski = new Map(log.map((x) => [String(x.obyekt_id), x.holat]));
  const natija = { obyektlar: (obs || []).length, yangi_logga: 0, ozgardi: [] };
  for (const o of obs || []) {
    const id = String(o.id);
    const yangi = o.holat || '';
    if (!eski.has(id)) {
      await sb(env, 'obyekt_holat_log', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify([{ obyekt_id: id, holat: yangi }]) }).catch(() => {});
      natija.yangi_logga++;
      continue;
    }
    if (eski.get(id) === yangi) continue;
    natija.ozgardi.push(`${o.nom || id}: ${eski.get(id)} → ${yangi}`);
    await holatXabar(env, o, id, yangi, prof);
  }
  return natija;
}

// 2) Kunlik xulosa (har kuni 09:00 Toshkent)
export async function kunlikXulosa(env) {
  const d1 = new Date(Date.now() - 864e5).toISOString();
  const lid = await sb(env, `lidlar?select=ism,telefon,xizmat_turi,holat&created_at=gte.${d1}`).catch(() => []) || [];
  const javobsiz = await sb(env, 'lidlar?select=id&holat=eq.yangi_lid').catch(() => []) || [];
  const navbat = await sb(env, 'nashr_navbati?select=id&holat=eq.kutilmoqda').catch(() => []) || [];
  const xato = await sb(env, `nashr_navbati?select=id&holat=eq.xato&nashr_vaqti=gte.${d1}`).catch(() => []) || [];
  const matn = `☀️ <b>Kunlik xulosa</b>\n\n🆕 Kechagi lidlar: <b>${lid.length}</b>${lid.length ? '\n' + lid.slice(0, 8).map((x) => `  • ${esc(x.ism)} ${esc(x.telefon)} — ${esc(x.xizmat_turi)}`).join('\n') : ''}\n⏳ Javob berilmagan lidlar: <b>${javobsiz.length}</b>\n🗂 Nashr navbatida: <b>${navbat.length}</b>${xato.length ? `\n⚠️ Xato bilan tugagan (24 soat): <b>${xato.length}</b>` : ''}`;
  for (const m of menejerIdlari(env)) await tg(env, m, matn);
}

// 3) Javobsiz lid eslatmasi
export async function lidEslatma(env, payload) {
  const tel = String(payload.telefon || '');
  const r = await sb(env, `lidlar?select=id&telefon=eq.${encodeURIComponent(tel)}&holat=eq.yangi_lid`).catch(() => []);
  if (!r || !r.length) return;
  for (const m of menejerIdlari(env)) {
    await tg(env, m, `⏰ Lidga hali javob berilmagan (2 soat+)\n👤 ${esc(payload.ism)} · ${esc(tel)}\n💬 <a href="tg://user?id=${payload.chat_id}">Telegramda yozish</a>`,
      { inline_keyboard: [[{ text: "✅ Bog'landim", callback_data: `ld:ok:${tel}`.slice(0, 64) }, { text: '❌ Qiziqmaydi', callback_data: `ld:no:${tel}`.slice(0, 64) }]] });
  }
}

// kunlik xulosa navbatda bo'lmasa 1 ta qo'yadi
export async function xulosaNavbatiniTekshir(env) {
  const bor = await sb(env, 'nashr_navbati?select=id&turi=eq.kunlik_xulosa&holat=eq.kutilmoqda&limit=1').catch(() => null);
  if (bor === null || bor.length) return;
  await sb(env, 'nashr_navbati', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify([{ turi: 'kunlik_xulosa', payload: {}, nashr_vaqti: keyingiToshkent(9), holat: 'kutilmoqda' }]) }).catch(() => {});
}
