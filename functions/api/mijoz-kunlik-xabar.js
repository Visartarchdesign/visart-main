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
  await sbFetch(env, 'kunlik_xabar_jurnali', {
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
  if (!env.KUNLIK_XABAR_SECRET || secret !== env.KUNLIK_XABAR_SECRET) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  let rows;
  try {
    rows = await sbFetch(env, 'kunlik_hodisalar?yuborildi=eq.false&select=*&order=created_at.asc');
  } catch (e) {
    return json({ ok: false, error: 'supabase_xato' }, 500);
  }

  if (!rows || rows.length === 0) {
    return json({ ok: true, yuborilgan_guruhlar: 0, yuborilgan_hodisalar: 0 });
  }

  const sana = sanaUz();
  let yuborilganGuruhlar = 0;
  let yuborilganHodisalar = 0;

  const moliya = rows.filter((r) => r.guruh === 'moliya');
  if (moliya.length && env.MOLIYA_GROUP_CHAT_ID) {
    const natija = await tgSend(env.MIJOZ_BOT_TOKEN, env.MOLIYA_GROUP_CHAT_ID, digestMatni('📊 Kunlik moliya hisoboti', moliya));
    if (natija) {
      await belgilaYuborildi(env, moliya.map((r) => r.id), sana);
      await jurnalgaYoz(env, { sana, guruh: 'moliya', obyektKaliti: MOLIYA_KEY, chatId: env.MOLIYA_GROUP_CHAT_ID, messageId: natija.message_id });
      yuborilganGuruhlar += 1;
      yuborilganHodisalar += moliya.length;
    }
  }

  const obyektlar = {};
  for (const r of rows) {
    if (r.guruh === 'obyekt' && r.obyekt_id) {
      (obyektlar[r.obyekt_id] ||= []).push(r);
    }
  }

  for (const [obyektId, items] of Object.entries(obyektlar)) {
    const chatId = await findGuruhChatId(env, obyektId);
    if (!chatId) continue; // guruh hali ro'yxatdan o'tmagan -- yuborilmaydi, keyingi kunga qoladi
    const natija = await tgSend(env.MIJOZ_BOT_TOKEN, chatId, digestMatni('📊 Kunlik hisobot', items, true));
    if (natija) {
      await belgilaYuborildi(env, items.map((r) => r.id), sana);
      await jurnalgaYoz(env, { sana, guruh: 'obyekt', obyektKaliti: obyektId, chatId, messageId: natija.message_id });
      yuborilganGuruhlar += 1;
      yuborilganHodisalar += items.length;
    }
  }

  return json({ ok: true, yuborilgan_guruhlar: yuborilganGuruhlar, yuborilgan_hodisalar: yuborilganHodisalar });
}

export async function onRequestGet(context) {
  try {
    return await handle(context);
  } catch (e) {
    return json({ ok: false, error: 'server_error', detail: String(e && e.message || e) }, 500);
  }
}

export async function onRequestPost(context) {
  return onRequestGet(context);
}
