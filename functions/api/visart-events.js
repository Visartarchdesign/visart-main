// Cloudflare Pages Function — /api/visart-events
// VISART_YAKUNIY (moliya/qurilish ilovasi, boshqa chatda ishlab chiqilayotgan Supabase
// backend) shu endpoint'ga POST qilib, moliya/obyekt hodisalarini mijoz-bot orqali
// Telegram'ga yetkazadi (qaror #21/#22/#23, Client Manager kengaytmasi).
//
// MIJOZ_BOT_TOKEN -- mijoz-bot.js bilan BIR XIL bot tokeni ishlatiladi (bitta bot,
// bir nechta Function: mijoz-bot.js -- Telegram'dan keladigan xabarlar uchun webhook;
// visart-events.js -- VISART_YAKUNIY'dan keladigan hodisa-xabarlari uchun;
// mijoz-kunlik-xabar.js -- kunlik umumlashtirilgan hisobotni yuboradi).
//
// QAROR #22 (chat shovqinini kamaytirish): odatdagi hodisalar (xarajat, to'lov,
// paket, avans) DARHOL yuborilmaydi -- Supabase'dagi `kunlik_hodisalar`
// navbat-jadvaliga yoziladi va kuni oxirida (soat 20:00, tashqi cron orqali
// mijoz-kunlik-xabar.js chaqiriladi) BITTA umumlashtirilgan xabar sifatida
// yuboriladi. Faqat JUDA shoshilinch hodisalar `urgent: true` bilan DARHOL
// alohida yuboriladi (navbatga yozilmaydi).
//
// QAROR #23 (TAHRIRLASH, YANGI XABAR EMAS): agar keyinchalik xato ma'lumot
// (summa, matn) tuzatilsa, ESKI, allaqachon yuborilgan Telegram xabari
// o'ZGARTIRILADI (editMessageText) -- YANGI xabar YUBORILMAYDI. Buning uchun:
//   1) Har bir navbatga yozilgan hodisa javobda o'z `hodisa_id`sini oladi --
//      VISART_YAKUNIY shu ID'ni o'z yozuvi (masalan xarajat qatori) bilan birga
//      saqlab qo'yishi kerak.
//   2) Keyin shu yozuv tuzatilsa, VISART_YAKUNIY {"tuzatish_hodisa_id": <ID>,
//      "matn": "<yangi matn>"} bilan shu endpoint'ga qayta POST qiladi.
//   3) Agar hodisa hali kunlik navbatda (hali yuborilmagan) bo'lsa -- shunchaki
//      navbatdagi matn yangilanadi, Telegram'ga HECH NARSA yuborilmaydi.
//   4) Agar hodisa ALLAQACHON kunlik xabarda yuborilgan bo'lsa -- shu kunlik
//      xabar (kunlik_xabar_jurnali'dan topilgan message_id) butunlay qayta
//      hisoblanadi (shu kungi hamma hodisalar + yangi matn) va Telegram'da
//      TAHRIRLANADI (editMessageText) -- chatda yangi xabar paydo bo'lmaydi.
//
// Qo'shimcha Cloudflare Pages Environment Variables (Production + Preview):
//   VISART_EVENTS_SECRET     -- o'zingiz o'ylab topgan tasodifiy satr (VISART_YAKUNIY shu
//                                qiymatni X-Visart-Secret header'ida yuborishi kerak)
//   MOLIYA_GROUP_CHAT_ID     -- ichki moliya/xodimlar Telegram guruhining chat ID'si
//   (MIJOZ_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY -- mijoz-bot.js'da allaqachon bor)
//
// So'rov formati #1 -- YANGI hodisa:
//   POST /api/visart-events
//   Headers: X-Visart-Secret: <VISART_EVENTS_SECRET>
//   Body: { "type": "xarajat_qoshildi", "obyekt_id": "1042", "matn": "...",
//           "group": "moliya" | "obyekt", "urgent": false }
//   Javob (odatiy, urgent=false): { "ok": true, "navbatga_yozildi": true, "hodisa_id": 123 }
//   -- `hodisa_id`ni ESLAB QOLING, keyinchalik tuzatish uchun kerak bo'ladi.
//
// So'rov formati #2 -- TUZATISH (yangi xabar emas, eski xabar tahrirlanadi):
//   POST /api/visart-events
//   Body: { "tuzatish_hodisa_id": 123, "matn": "<to'g'rilangan matn>" }
//   Javob: { "ok": true, "tahrir": "navbatda_yangilandi" }           -- hali yuborilmagan edi
//       yoki { "ok": true, "tahrir": "xabar_tahrirlandi" }           -- Telegram'da tahrirlandi
//       yoki { "ok": false, "error": "jurnal_topilmadi" }            -- fallback: yangi xabar yuborildi

const MOLIYA_KEY = '__moliya__';

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
  return data && data.ok ? data.result : null;
}

async function tgEdit(token, chatId, messageId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' }),
    signal: AbortSignal.timeout(10000),
  });
  return res.ok;
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
  const rows = await sbFetch(env, `visart_loyiha_guruhlar?obyekt_id=eq.${encodeURIComponent(obyektId)}&select=telegram_chat_id`);
  return rows && rows[0] ? rows[0].telegram_chat_id : null;
}

// QAROR #29: kunlik xabar endi har bir hodisa turini alohida QATOR qilib
// sanamaydi -- bir xil `turi`ga ega va hammasida `summa` berilgan yozuvlar
// BITTA yig'indi qatorga jamlanadi (masalan "Xarajat: 100 000 so'm (20 ta)").
// `summa`si yo'q (yoki aralash) turlar eski usulda, matn bo'yicha, alohida
// qator sifatida ko'rsatiladi (masalan "paket_tasdiqlandi" kabi summasiz
// hodisalar uchun).
function turiNomi(turi) {
  if (!turi) return 'Boshqa';
  return turi.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function digestMatni(sarlavha, sana, items) {
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
      const sarlavhaQator = `• ${label}: ${g.jami.toLocaleString('ru-RU')} so'm (${g.soni} ta)`;
      const tafsilot = g.matnlar.map((m) => `   – ${m}`).join('\n');
      return `${sarlavhaQator}\n${tafsilot}`;
    }
    return g.matnlar.map((m) => `• ${m}`).join('\n');
  });
  return `${sarlavha} — ${sana}\n\n` + qatorlar.join('\n');
}

async function navbatgaYoz(env, { type, obyekt_id, matn, group, summa }) {
  const rows = await sbFetch(env, 'kunlik_hodisalar', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify([{
      turi: type || null,
      obyekt_id: obyekt_id || null,
      matn,
      guruh: group,
      summa: summa != null ? summa : null,
    }]),
  });
  return rows && rows[0] ? rows[0].id : null;
}

async function tuzatishniQollash(env, { tuzatish_hodisa_id, matn, summa }) {
  const rows = await sbFetch(env, `kunlik_hodisalar?id=eq.${tuzatish_hodisa_id}&select=*`);
  const hodisa = rows && rows[0];
  if (!hodisa) return json({ ok: false, error: 'hodisa_topilmadi' }, 404);

  const patch = { matn };
  if (summa !== undefined) patch.summa = summa;

  if (!hodisa.yuborildi) {
    // Hali Telegram'ga yuborilmagan -- navbatdagi matn/summani yangilash kifoya.
    await sbFetch(env, `kunlik_hodisalar?id=eq.${tuzatish_hodisa_id}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify(patch),
    });
    return json({ ok: true, tahrir: 'navbatda_yangilandi' });
  }

  // Allaqachon yuborilgan -- avval yozuvni yangilaymiz, keyin shu kungi
  // umumiy xabarni to'liq qayta hisoblab (yangi summa bilan), Telegram'da
  // TAHRIRLAYMIZ.
  await sbFetch(env, `kunlik_hodisalar?id=eq.${tuzatish_hodisa_id}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify(patch),
  });

  const obyektKaliti = hodisa.guruh === 'moliya' ? MOLIYA_KEY : hodisa.obyekt_id;
  const jurnalRows = await sbFetch(
    env,
    `kunlik_xabar_jurnali?sana=eq.${hodisa.yuborilgan_sana}&guruh=eq.${hodisa.guruh}&obyekt_id=eq.${encodeURIComponent(obyektKaliti)}&select=*`
  );
  const jurnal = jurnalRows && jurnalRows[0];
  if (!jurnal) {
    // Kutilmagan holat -- xabar matnini topa olmadik, foydalanuvchiga ma'lum qilish uchun
    // alohida, yangi xabar yuboramiz (fallback, odatiy holatda yuz bermasligi kerak).
    const chatId = hodisa.guruh === 'moliya' ? env.MOLIYA_GROUP_CHAT_ID : await findGuruhChatId(env, hodisa.obyekt_id);
    if (chatId) await tgSend(env.MIJOZ_BOT_TOKEN, chatId, `✏️ TUZATISH: ${matn}`);
    return json({ ok: false, error: 'jurnal_topilmadi' }, 404);
  }

  const filterQs =
    hodisa.guruh === 'moliya'
      ? `yuborilgan_sana=eq.${hodisa.yuborilgan_sana}&guruh=eq.moliya`
      : `yuborilgan_sana=eq.${hodisa.yuborilgan_sana}&guruh=eq.obyekt&obyekt_id=eq.${encodeURIComponent(hodisa.obyekt_id)}`;
  const kunHodisalari = await sbFetch(env, `kunlik_hodisalar?${filterQs}&select=*&order=created_at.asc`);

  const sarlavha = hodisa.guruh === 'moliya' ? '📊 Kunlik moliya hisoboti' : '📊 Kunlik hisobot';
  const yangiMatn = digestMatni(sarlavha, jurnal.sana, kunHodisalari || []);
  const tahrirlandi = await tgEdit(env.MIJOZ_BOT_TOKEN, jurnal.telegram_chat_id, jurnal.telegram_message_id, yangiMatn);

  return json({ ok: tahrirlandi, tahrir: tahrirlandi ? 'xabar_tahrirlandi' : 'tahrir_xato' });
}

export async function onRequestPost({ request, env }) {
  try {
    const secret = request.headers.get('X-Visart-Secret');
    if (!env.VISART_EVENTS_SECRET || secret !== env.VISART_EVENTS_SECRET) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    const body = await request.json().catch(() => null);
    if (!body) return json({ ok: false, error: 'bad_request' }, 400);

    if (body.tuzatish_hodisa_id) {
      if (!body.matn) return json({ ok: false, error: 'matn_required' }, 400);
      return await tuzatishniQollash(env, {
        tuzatish_hodisa_id: body.tuzatish_hodisa_id,
        matn: body.matn,
        summa: body.summa,
      });
    }

    if (!body.matn || !body.group) {
      return json({ ok: false, error: 'bad_request' }, 400);
    }

    const { type, obyekt_id, matn, group, urgent, summa } = body;
    const prefiks = type ? `[${type}]\n` : '';

    if (urgent !== true) {
      const hodisaId = await navbatgaYoz(env, { type, obyekt_id, matn, group, summa });
      return json({ ok: hodisaId !== null, navbatga_yozildi: true, hodisa_id: hodisaId });
    }

    if (group === 'moliya') {
      if (!env.MOLIYA_GROUP_CHAT_ID) {
        return json({ ok: false, error: 'moliya_group_not_configured' }, 500);
      }
      const natija = await tgSend(env.MIJOZ_BOT_TOKEN, env.MOLIYA_GROUP_CHAT_ID, `${prefiks}${matn}`);
      return json({ ok: !!natija });
    }

    if (group === 'obyekt') {
      if (!obyekt_id) return json({ ok: false, error: 'obyekt_id_required' }, 400);
      const chatId = await findGuruhChatId(env, obyekt_id);
      if (!chatId) return json({ ok: false, error: 'guruh_topilmadi' }, 404);
      const natija = await tgSend(env.MIJOZ_BOT_TOKEN, chatId, `${prefiks}${matn}`);
      return json({ ok: !!natija });
    }

    return json({ ok: false, error: 'unknown_group' }, 400);
  } catch (e) {
    return json({ ok: false, error: 'server_error' }, 500);
  }
}
