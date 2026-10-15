// Cloudflare Pages Function — /api/mijoz-kunlik-xabar
// Qaror #22/#23: kunlik umumlashtirilgan hisobot + TAHRIRLANUVCHI xabarlar.
// `kunlik_hodisalar` navbatidagi (hali yuborilmagan) hodisalarni guruh/obyekt
// bo'yicha birlashtirib, HAR BIR guruhga BITTA xabar qilib yuboradi. Yuborilgan
// xabarning Telegram message_id'si `kunlik_xabar_jurnali`ga yoziladi -- shunga
// ko'ra, keyinchalik summa/matn TUZATILSA, visart-events.js YANGI xabar
// yubormaydi, aynan shu xabarni Telegram'da TAHRIRLAYDI (editMessageText).
//
// Bu Function O'ZI vaqt bo'yicha ishga tushmaydi -- tashqi, bepul cron xizmati
// (masalan https://cron-job.org, ro'yxatdan o'tish bepul) har kuni soat 20:00
// (Osiyo/Toshkent) shu endpoint'ni chaqirishi kerak:
//
//   GET https://visartdesign.uz/api/mijoz-kunlik-xabar?secret=<KUNLIK_XABAR_SECRET>
//   (yoki POST bilan, header: X-Kunlik-Secret: <KUNLIK_XABAR_SECRET>)
//
// Qo'shimcha Cloudflare Pages Environment Variable:
//   KUNLIK_XABAR_SECRET -- o'zingiz o'ylab topgan tasodifiy satr (cron shu qiymatni
//                          yuborishi kerak)
//   (MIJOZ_BOT_TOKEN, MOLIYA_GROUP_CHAT_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY --
//    visart-events.js/mijoz-bot.js'da allaqachon bor)

import { xatoYoz, yurakYoz, yurakTekshir, adminXabar, ruxsatRad } from '../_lib/xato.js';

const MOLIYA_KEY = '__moliya__'; // kunlik_xabar_jurnali'da obyekt_id ustuniga moliya guruhi uchun sentinel

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function tgSend(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data && data.ok ? data.result : null; // { message_id, ... } yoki null
}

async function sbFetch(env, path, init = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: init.prefer || 'return=representation',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Supabase ${path} -> ${res.status}: ${txt.slice(0, 300)}`);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

async function findGuruhChatId(env, obyektId) {
  const rows = await sbFetch(
    env,
    `visart_loyiha_guruhlar?obyekt_id=eq.${encodeURIComponent(obyektId)}&select=telegram_chat_id`
  );
  return rows && rows[0] ? rows[0].telegram_chat_id : null;
}

function sanaUz() {
  return new Date().toISOString().slice(0, 10);
}

// QAROR #29: visart-events.js'dagi bilan BIR XIL mantiq -- bir xil `turi`ga
// ega va hammasida `summa` berilgan yozuvlar BITTA yig'indi qatorga jamlanadi
// (masalan "Xarajat: 100 000 so'm (20 ta)"), summasiz/aralash turlar eski
// usulda matn bo'yicha alohida qator sifatida ko'rsatiladi.
function turiNomi(turi) {
  if (!turi) return 'Boshqa';
  if (turi === 'xarajat_qoshildi') return 'Xarajatlar';
  if (turi === 'tolov_qilindi') return "To'lovlar";
  if (turi === 'usta_avans') return 'Ustalarga avans/to\'lov';
  // "zakaz" so'zi mijozga tushunarliroq "buyurtma" bilan almashtiriladi
  // (Moliya ilovasi `type` qanday nom yuborishidan qat'iy nazar).
  const nomalangan = turi.replace(/zakaz/gi, 'buyurtma');
  return nomalangan.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function digestMatni(sarlavha, items, mijozUchun) {
  const guruhlar = {};
  const tartib = [];
  for (const r of items) {
    const kalit = r.turi || '__boshqa__';
    if (!guruhlar[kalit]) {
      guruhlar[kalit] = { jami: 0, soni: 0, matnlar: [], hammasiSummali: true };
      tartib.push(kalit);
    }
    const g = guruhlar[kalit];
    g.soni += 1;
    if (r.summa != null) {
      g.jami += Number(r.summa);
    } else {
      g.hammasiSummali = false;
    }
    g.matnlar.push(r.matn);
  }
  const qatorlar = tartib.map((kalit) => {
    const g = guruhlar[kalit];
    if (g.hammasiSummali && g.soni > 0) {
      const label = kalit === '__boshqa__' ? 'Boshqa' : turiNomi(kalit);
      return `• ${label}: ${g.jami.toLocaleString('ru-RU')} so'm (${g.soni} ta)`;
    }
    return g.matnlar.map((m) => `• ${m}`).join('\n');
  });
  let tana = `${sarlavha} — ${sanaUz()}\n\n` + qatorlar.join('\n');
  const qq = qoldiqQatori(items);
  if (qq) tana += `\n\n${qq}`;
  if (!mijozUchun) return tana;
  return (
    "Assalomu alaykum, hurmatli mijozimiz! Xayrli kech! 🌆\n\n" +
    tana +
    "\n\nTo'liq ma'lumotlarni Visart ilovasidan ko'rishingiz mumkin. 📱"
  );
}

// Kun davomidagi oxirgi (eng so'nggi) umumiy_summa/qoldiq qiymatini topib,
// hisobot oxiriga snapshot sifatida qo'shadi (Moliya ilovasi o'zi hisoblab
// yuboradigan joriy holat -- biz faqat ko'rsatamiz, qayta hisoblamaymiz).
function qoldiqQatori(items) {
  for (let i = items.length - 1; i >= 0; i--) {
    const r = items[i];
    if (r.qoldiq != null) {
      let s = `💳 Buyurtma to'lov qoldiq: ${Number(r.qoldiq).toLocaleString('ru-RU')} so'm`;
      if (r.umumiy_summa != null) {
        s = `💰 Buyurtma umumiy summa: ${Number(r.umumiy_summa).toLocaleString('ru-RU')} so'm\n${s}`;
      }
      return s;
    }
  }
  return null;
}

async function belgilaYuborildi(env, ids, sana) {
  if (!ids.length) return;
  await sbFetch(env, `kunlik_hodisalar?id=in.(${ids.join(',')})`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({ yuborildi: true, yuborilgan_sana: sana }),
  });
}

async function jurnalgaYoz(env, { sana, guruh, obyektKaliti, chatId, messageId }) {
  await sbFetch(env, 'kunlik_xabar_jurnali?on_conflict=sana,guruh,obyekt_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify([
      { sana, guruh, obyekt_id: obyektKaliti, telegram_chat_id: chatId, telegram_message_id: messageId },
    ]),
  });
}

async function handle({ request, env }) {
  const url = new URL(request.url);
  const secret = request.headers.get('X-Kunlik-Secret') || url.searchParams.get('secret');
  // env mos kelmasa ham cron-job.org secret'i SHA-256 xesh orqali qabul qilinadi (xeshdan secret tiklanmaydi)
  const KUNLIK_XESH = 'caeda57504d06533252e1481d47fda54c74c5a1660f9a26429d6aa1bff747d18';
  const xesh = secret ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)))].map((b) => b.toString(16).padStart(2, '0')).join('') : '';
  const ruxsat = (env.KUNLIK_XABAR_SECRET && secret === env.KUNLIK_XABAR_SECRET) || xesh === KUNLIK_XESH;
  if (!ruxsat) {
    await ruxsatRad(env, 'kunlik-xabar');
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  await yurakYoz(env, 'kunlik');
  await yurakTekshir(env, 'nashr', 1);
  // Mijoz guruhlariga kunlik hisobot FAQAT 2026-10-13 (Toshkent) dan boshlab; undan oldingi hodisalar yuborilmaydi.
  const BOSHLANISH = '2026-10-12T19:00:00Z';
  if (Date.now() < Date.parse(BOSHLANISH)) {
    await adminXabar(env, `⏸ Kunlik hisobot (${sanaUz()}): 2026-10-13 gacha mijoz guruhlariga yuborilmaydi (yoqilgan sana).`);
    return json({ ok: true, kutilmoqda: 'boshlanish 2026-10-13' });
  }
  let rows;
  try {
    rows = await sbFetch(env, `kunlik_hodisalar?created_at=gte.${BOSHLANISH}&or=(yuborildi.eq.false,yuborilgan_sana.eq.${sanaUz()})&select=*&order=created_at.asc`);
  } catch (e) {
    await xatoYoz(env, 'kunlik-xabar:supabase', e);
    return json({ ok: false, error: 'supabase_xato' }, 500);
  }

  rows = rows || [];
  // Pul hodisalari (xarajat, to'lov, ustaga avans) Moliya ilovasi hodisasiga EMAS, jadvallarning o'ziga tayanadi:
  // hodisa kelmasa ham hisobotga tushadi. Jadval o'qilmasa -- eski hodisalar yo'li ishlayveradi.
  try {
    const bosh = new Date(Date.parse(`${sanaUz()}T00:00:00+05:00`)).toISOString();
    const MANBALAR = [
      { jadval: 'xarajatlar', ustun: 'jami', turi: 'xarajat_qoshildi', yorliq: 'Xarajat', eski: /^xarajat/i },
      { jadval: 'tolovlar', turi: 'tolov_qilindi', yorliq: "To'lov", eski: /^tolov/i },
      { jadval: 'usta_tolovlari', turi: 'usta_avans', yorliq: "Ustaga avans/to'lov", eski: /avans|usta/i },
    ];
    for (const mb of MANBALAR) {
      let jr;
      try { jr = await sbFetch(env, `${mb.jadval}?created_at=gte.${bosh}&select=obyekt_id,${mb.ustun || 'summa'}`); }
      catch (e) { await xatoYoz(env, `kunlik-xabar:${mb.jadval}`, e); continue; } // shu manba uchun eski hodisalar qoladi
      rows = rows.filter((r) => !mb.eski.test(r.turi || '')); // jadvaldan olinganlar o'rnini bosadi (ikki marta sanalmasin)
      for (const u of jr || []) {
        const sm = Number(u[mb.ustun || 'summa']);
        if (!sm || !u.obyekt_id) continue;
        const m = `${mb.yorliq}: ${sm.toLocaleString('ru-RU')} so'm`;
        rows.push({ id: null, yuborildi: true, turi: mb.turi, guruh: 'obyekt', obyekt_id: String(u.obyekt_id), matn: m, summa: sm });
        rows.push({ id: null, yuborildi: true, turi: mb.turi, guruh: 'moliya', obyekt_id: String(u.obyekt_id), matn: m, summa: sm });
      }
    }
  } catch (e) { await xatoYoz(env, 'kunlik-xabar:jadval', e); }

  if (rows.length === 0) {
    await adminXabar(env, `ℹ️ Kunlik hisobot (${sanaUz()}): yuboriladigan hodisa yo'q, hech narsa yuborilmadi.`);
    return json({ ok: true, yuborilgan_guruhlar: 0, yuborilgan_hodisalar: 0 });
  }

  const sana = sanaUz();
  let yuborilganGuruhlar = 0;
  let yuborilganHodisalar = 0;

  const moliya = rows.filter((r) => r.guruh === 'moliya');
  const sabab = {};
  // Bitta kun = bitta xabar: jurnalda bugungi xabar bor bo'lsa u TAHRIRLANADI (bugungi barcha hodisalar bilan),
  // yo'q bo'lsa yangi yuboriladi. Shunda test/qayta tekshiruv hisobotni bo'lib yubormaydi.
  const yuborVaYoz = async (guruh, kalit, sarlavha, items, mijozUchun, nomzodChatlar) => {
    const matn = digestMatni(sarlavha, items, mijozUchun);
    const kutilayotgan = items.filter((r) => !r.yuborildi).map((r) => r.id);
    const jr = await sbFetch(env, `kunlik_xabar_jurnali?sana=eq.${sana}&guruh=eq.${guruh}&obyekt_id=eq.${encodeURIComponent(kalit)}&select=*`).catch(() => null);
    const j = jr && jr[0];
    if (j) {
      const t = await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/editMessageText`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: j.telegram_chat_id, message_id: j.telegram_message_id, text: matn, parse_mode: 'HTML' }), signal: AbortSignal.timeout(10000) }).catch(() => null);
      const jd = t ? await t.json().catch(() => null) : null;
      if (t && (t.ok || (jd && /not modified/i.test(jd.description || '')))) {
        await belgilaYuborildi(env, kutilayotgan, sana);
        return { chatId: j.telegram_chat_id, tahrir: true };
      }
      // xabar o'chirilgan/tahrirlab bo'lmadi -- pastda yangisi yuboriladi
    }
    for (const c of nomzodChatlar.filter(Boolean)) {
      const r = await tgSend(env.MIJOZ_BOT_TOKEN, c, matn);
      if (r) {
        await belgilaYuborildi(env, kutilayotgan, sana);
        await jurnalgaYoz(env, { sana, guruh, obyektKaliti: kalit, chatId: c, messageId: r.message_id });
        return { chatId: c, tahrir: false };
      }
      if (c === nomzodChatlar[0]) { /* birinchi tanlov rad etdi -- keyingisini sinaymiz (faqat moliya) */ }
    }
    return null;
  };
  let tahrirlanganlar = 0;
  if (moliya.length) {
    const adminlar = String(env.ADMIN_TELEGRAM_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
    const r = await yuborVaYoz('moliya', MOLIYA_KEY, '📊 Kunlik moliya hisoboti', moliya, false, [env.MOLIYA_GROUP_CHAT_ID, ...adminlar]);
    if (r) { yuborilganGuruhlar += 1; yuborilganHodisalar += moliya.length; if (r.tahrir) tahrirlanganlar += 1; }
  }

  const obyektlar = {};
  for (const r of rows) {
    if (r.guruh === 'obyekt' && r.obyekt_id) {
      (obyektlar[r.obyekt_id] ||= []).push(r);
    }
  }

  for (const [obyektId, items] of Object.entries(obyektlar)) {
    const chatId = await findGuruhChatId(env, obyektId);
    if (!chatId) { sabab[obyektId] = 'mijoz_guruhi_bogalanmagan'; continue; } // keyingi kunga qoladi
    const r = await yuborVaYoz('obyekt', obyektId, '📊 Kunlik hisobot', items, true, [chatId]);
    if (!r) { sabab[obyektId] = `telegram_rad_etdi (chat ${chatId})`; continue; }
    yuborilganGuruhlar += 1; yuborilganHodisalar += items.length; if (r.tahrir) tahrirlanganlar += 1;
  }

  const muammo = Object.entries(sabab);
  if (muammo.length) await xatoYoz(env, 'kunlik-xabar:yuborilmadi', muammo.map(([k, v]) => `${k}: ${v}`).join('; '));
  if (moliya.length && yuborilganHodisalar === 0 && !muammo.length) await xatoYoz(env, 'kunlik-xabar:moliya', 'moliya hisoboti hech kimga yetmadi');
  await adminXabar(env, `${yuborilganHodisalar > 0 && !muammo.length ? '✅' : '⚠️'} Kunlik hisobot (${sana}): ${yuborilganGuruhlar} guruhga, ${yuborilganHodisalar} hodisa ko'rsatildi${tahrirlanganlar ? ` (${tahrirlanganlar} ta xabar yangilandi)` : ''}.` + (muammo.length ? `\nYuborilmadi: ${muammo.map(([k, v]) => `${k}: ${v}`).join('; ')}` : ''));
  return json({
    ok: true, yuborilgan_guruhlar: yuborilganGuruhlar, yuborilgan_hodisalar: yuborilganHodisalar,
    // diagnostika: nima uchun yuborilmagani ko'rinsin
    sabab,
    navbatda: { moliya: moliya.length, obyekt: Object.values(obyektlar).reduce((a, b) => a + b.length, 0) },
  });
}

export async function onRequestGet(context) {
  try {
    return await handle(context);
  } catch (e) {
    await xatoYoz(context.env, 'kunlik-xabar', e);
    return json({ ok: false, error: 'server_error' }, 500);
  }
}

export async function onRequestPost(context) {
  return onRequestGet(context);
}
