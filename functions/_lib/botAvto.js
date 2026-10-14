// Bot avtomatikasi (cron /api/nashr-navbati ichidan): obyekt holati o'zgarsa mijozga xabar,
// topshirilganda baho so'rovi, kunlik xulosa, javobsiz lid eslatmasi.
import { xabarYubor } from './outbox.js';
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

async function tgOk(env, chat_id, text) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }), signal: AbortSignal.timeout(10000) });
    if (r.ok) return null;
    const d = await r.json().catch(() => null);
    return `Telegram rad etdi (${r.status}${d && d.description ? ': ' + d.description : ''})`;
  } catch (e) { return `Telegram'ga ulanib bo'lmadi (${e.message})`; }
}

// Guruhga xabar yuboradi va natijani menejer/adminga bildiradi (yuborildi / yuborilmadi + sabab).
export const MUZLATISH_MATN = (nom) => `⏸ Diqqat: obyektingiz ("${esc(nom)}") bo'yicha pul mablag'i tugagani sababli qurilish jarayoni vaqtincha to'xtatildi.\n\nIshni davom ettirish uchun, iltimos, navbatdagi to'lovni amalga oshiring. To'lov qabul qilingach, ishlar darhol qayta boshlanadi. Savollar bo'lsa, menejerimiz bilan bog'laning. 🙏`;

export async function guruhgaXabarVaHisobot(env, obyektId, nom, matn, tur, kalit) {
  const g = await sb(env, `visart_loyiha_guruhlar?obyekt_id=eq.${encodeURIComponent(obyektId)}&select=telegram_chat_id`).catch(() => null);
  let natija;
  if (!g || !g[0]) natija = "⚠️ yuborilmadi: obyektga mijoz guruhi bog'lanmagan";
  else {
    const r = await xabarYubor(env, { chat_id: g[0].telegram_chat_id, matn, tur, obyekt_id: obyektId, kalit });
    natija = r.holat === 'yuborildi' ? '✅ mijoz guruhiga yuborildi'
      : r.holat === 'navbatda' ? `⏳ hozir yuborilmadi, avtomatik qayta uriniladi (${esc(r.sabab)})`
      : r.holat === 'takror' ? 'ℹ️ bu xabar allaqachon yuborilgan, takrorlanmadi'
      : `⚠️ yuborilmadi: ${esc(r.sabab)}`;
  }
  for (const m of menejerIdlari(env)) await tg(env, m, `${tur} xabari — <b>${esc(nom)}</b>: ${natija}`);
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
  // Muzlatilgan: obyektning mijoz guruhiga to'lov eslatmasi (natija menejerga bildiriladi)
  if (/muzlat|заморож|frozen/i.test(yangi)) {
    await guruhgaXabarVaHisobot(env, id, o.nom, MUZLATISH_MATN(o.nom), '⏸ Muzlatish');
  }
  // Muzlatishdan chiqdi: mijoz guruhiga ishlar qayta boshlangani haqida xabar
  if (eski.length && /muzlat|заморож|frozen/i.test(eski[0].holat || '') && !/muzlat|заморож|frozen/i.test(yangi)) {
    await guruhgaXabarVaHisobot(env, id, o.nom, `▶️ Xushxabar: obyektingiz ("${esc(o.nom)}") bo'yicha ishlar qayta boshlandi (holat: ${esc(yangi)}). To'lov uchun rahmat! 🙏`, '▶️ Qayta boshlash');
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
      // Birinchi ko'rilganda xabar yuborilmaydi (eski obyektlarga ommaviy xabar ketmasligi uchun) -- lekin muzlatilgan bo'lsa menejerga aytamiz.
      if (/muzlat|заморож|frozen/i.test(yangi)) for (const m of menejerIdlari(env)) await tg(env, m, `⚠️ <b>${esc(o.nom)}</b> holati «${esc(yangi)}», lekin kuzatuv uni BIRINCHI marta ko'rdi, shuning uchun mijozga xabar yuborilmadi. Yuborish uchun holatni boshqasiga o'zgartirib, yana «Muzlatilgan» qiling.`);
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

// ── Balans eslatmalari ──────────────────────────────────────────────
// Balans = to'lovlar - xarajatlar (obyekt bo'yicha). BALANS_ESLATMA=on bo'lmasa mijozga YUBORILMAYDI, faqat menejerga "sinov" hisoboti boradi.
const BALANS_CHEGARALAR = [3, 2, 1]; // mln so'm
const MUZ_RE = /muzlat|заморож|frozen/i;
const sumFmt = (n) => Math.round(n).toLocaleString('ru-RU');
export const MUZLATGAN_ESLATMA = (nom) => `⏸ Hurmatli mijoz, obyektingiz ("${esc(nom)}") hozirgi kunda ham muzlatilgan holatda — mablag' yetarli emasligi sababli qurilish ishlari to'xtab turibdi.\n\nIshlarni tezroq qayta boshlash va muddatlarni surib yubormaslik uchun, iltimos, navbatdagi to'lovni amalga oshiring. To'lov qabul qilingach, jamoamiz ishni darhol davom ettiradi. Savollaringiz bo'lsa, menejerimiz doimo aloqada. 🙏`;
export const CHEGARA_ESLATMA = (nom, mln) => `💡 Hurmatli mijoz, obyektingiz ("${esc(nom)}") bo'yicha mablag' qoldig'i taxminan ${mln} million so'mgacha kamaydi.\n\nIshlar uzluksiz davom etishi va to'xtab qolmasligi uchun, iltimos, keyingi to'lovni oldindan rejalashtirib qo'ying. Rahmat! 🙏`;

async function balanslar(env) {
  const [tol, xar] = await Promise.all([
    sb(env, 'tolovlar?select=obyekt_id,summa&limit=50000'),
    sb(env, 'xarajatlar?select=obyekt_id,summa&limit=50000'),
  ]);
  const m = new Map();
  for (const x of tol || []) m.set(String(x.obyekt_id), (m.get(String(x.obyekt_id)) || 0) + (Number(x.summa) || 0));
  for (const x of xar || []) m.set(String(x.obyekt_id), (m.get(String(x.obyekt_id)) || 0) - (Number(x.summa) || 0));
  return m;
}

export async function balansEslatma(env) {
  if (!env.MIJOZ_BOT_TOKEN) return { xato: 'MIJOZ_BOT_TOKEN yoq' };
  const jonat = env.BALANS_ESLATMA === 'on';
  const tosh = new Date(Date.now() + 5 * 3600 * 1000);
  const bugun = tosh.toISOString().slice(0, 10);
  const soat = tosh.getUTCHours();
  const [obs, holatlar, bal] = await Promise.all([
    sb(env, 'obyektlar?select=id,nom,holat&limit=1000'),
    sb(env, 'balans_eslatma?select=*&limit=2000').catch(() => null),
    balanslar(env),
  ]);
  if (!holatlar) return { xato: 'balans_eslatma jadvali yoq (db/migration_balans_eslatma.sql)' };
  const h = new Map(holatlar.map((x) => [String(x.obyekt_id), x]));
  const nat = { chegara: [], muzlat: [] };
  const yoz = (id, patch) => sb(env, 'balans_eslatma', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: JSON.stringify([{ obyekt_id: id, ...patch, updated_at: new Date().toISOString() }]) }).catch(() => {});
  const yubor = async (id, nom, matn, tur) => {
    if (jonat) return guruhgaXabarVaHisobot(env, id, nom, matn, tur, `bal:${id}:${tur.slice(0, 12)}:${bugun}`);
    for (const m of menejerIdlari(env)) await tg(env, m, `🧪 SINOV (BALANS_ESLATMA=on emas, mijozga yuborilmadi) — ${tur} <b>${esc(nom)}</b>:\n\n${matn}`);
  };
  for (const o of obs || []) {
    const id = String(o.id), holat = o.holat || '', st = h.get(id) || {};
    if (BITDI.test(holat)) continue;
    const b = bal.get(id) || 0;
    if (MUZ_RE.test(holat)) {
      // kuniga 1 marta, 10:00 dan keyin; muzlatilgan kuni (birinchi ko'rilganda) o'tkazib yuboriladi
      if (!st.muzlat_sana) { await yoz(id, { muzlat_sana: bugun }); continue; }
      if (soat >= 10 && st.muzlat_sana !== bugun) {
        await yubor(id, o.nom, MUZLATGAN_ESLATMA(o.nom), '⏸ Kunlik muzlatish eslatmasi');
        await yoz(id, { muzlat_sana: bugun, chegara: null });
        nat.muzlat.push(o.nom);
      }
      continue;
    }
    // faol obyekt: chegaradan pastga tushganda (3 -> 2 -> 1 mln)
    const joriy = BALANS_CHEGARALAR.filter((c) => b <= c * 1e6 && b > 0).pop(); // eng past kesilgan chegara
    if (b > BALANS_CHEGARALAR[0] * 1e6) { if (st.chegara != null || st.muzlat_sana) await yoz(id, { chegara: null, muzlat_sana: null }); continue; }
    if (joriy && (st.chegara == null || joriy < st.chegara)) {
      await yubor(id, o.nom, CHEGARA_ESLATMA(o.nom, joriy), `💡 ${joriy} mln chegara (balans ${sumFmt(b)})`);
      await yoz(id, { chegara: joriy, muzlat_sana: null });
      nat.chegara.push(`${o.nom}: ${joriy} mln`);
    } else if (st.muzlat_sana) await yoz(id, { muzlat_sana: null });
  }
  return nat;
}
