// Ommaviy guruhlar uchun "jim, lekin foydali" rejim: /narx /loyiha /maslahat /obuna,
// admin tasdiqlaydigan haftalik maslahat.
import { menejerIdlari, keyingiToshkent } from './botAvto.js';

const SAYT = 'https://visartdesign.uz';
const BOT = 'visart_design_bot';
const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const nom = (o) => (o && (o.uz || o.ru)) || '';
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

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
async function api(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  return r ? r.json().catch(() => null) : null;
}
const tg = (env, chat_id, text, reply_markup) => api(env, 'sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(reply_markup ? { reply_markup } : {}) });
const botKb = { inline_keyboard: [[{ text: '📝 Ariza / aniq narx', url: `https://t.me/${BOT}?start=guruh` }]] };

async function sayt() {
  try { const d = await (await fetch(`${SAYT}/api/content`, { signal: AbortSignal.timeout(6000) })).json(); return d && d.ok ? d : null; } catch (e) { return null; }
}

const TAYYOR_MASLAHAT = [
  "💡 <b>Yoritish — 3 qatlam</b>\nUmumiy (shift), vazifaviy (ish zonasi) va dekorativ (bra, led) yorug'lik. Bitta markaziy lyustra xonani yassi ko'rsatadi.",
  "💡 <b>Kichik xonani kattalashtirish</b>\nOchiq rang devor, shift bilan bir xil ohang va katta oyna. Mebelni devordan 5–10 sm uzoqroq qo'ying — xona kengroq tuyuladi.",
  "💡 <b>Remontdan oldin elektrni rejalashtiring</b>\nRozetka va chiroq nuqtalarini mebel joylashuvidan keyin belgilang. Devor yopilgandan keyin o'zgartirish 3 barobar qimmat.",
  "💡 <b>Pol va namlik</b>\nVannaxona va oshxonada pol ostiga gidroizolyatsiya shart. Plitka ostida 2 qatlam — kelajakdagi shikoyatlarning 80% oldini oladi.",
  "💡 <b>Rang tanlash</b>\nBir xonada 3 dan ortiq asosiy rang ishlatmang: 60% asosiy, 30% ikkinchi, 10% aksent.",
  "💡 <b>Shkaf va saqlash joyi</b>\nShiftgacha shkaf qo'ying: changga joy qolmaydi, saqlash hajmi 20–30% ko'proq bo'ladi.",
];

const BANNER = `${SAYT}/assets/bot-welcome.png`;
const SALOM_MATN = "<b>Visart Design</b> — arxitektura, interyer dizayn va remont (pod klyuch). Toshkent.\n\nPastdagi tugmalar orqali narxni hisoblang, ish bosqichlari va to'lov tartibi bilan tanishing. 👇\n\n💡 Haftada bir marta foydali interyer maslahati yuboriladi. O'chirish: /obunabekor";
const ASOSIY_KB = { inline_keyboard: [
  [{ text: '💰 Smeta hisoblash', callback_data: 'gk:s' }, { text: '📋 Ish bosqichlari', callback_data: 'gk:b' }],
  [{ text: "💳 To'lov bosqichlari", callback_data: 'gk:t' }, { text: '🛠 Xizmatlar', callback_data: 'gk:x' }],
  [{ text: '🖼 Loyihalar', url: `${SAYT}/#projects` }, { text: '🌐 Tarmoqlar', callback_data: 'gk:o' }],
  [{ text: '📝 Ariza qoldirish', url: `https://t.me/${BOT}?start=guruh` }],
] };

export async function guruhSalom(env, chat) {
  await sb(env, 'bot_guruhlar', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal', body: JSON.stringify([{ chat_id: chat.id, nom: chat.title || '', obuna: true }]) }).catch(() => {});
  const r = await api(env, 'sendPhoto', { chat_id: chat.id, photo: BANNER, caption: SALOM_MATN, parse_mode: 'HTML', reply_markup: ASOSIY_KB });
  if (!r || !r.ok) await tg(env, chat.id, SALOM_MATN, ASOSIY_KB);
}

// ── Guruh menyusi (bitta xabar joyida almashadi, guruhni to'ldirmaydi) ──
const BOSQICH = "📋 <b>Ish bosqichlari</b>\n\n<b>01 Konsultatsiya</b> — orzu-istak, byudjet va muddatni birga aniqlaymiz.\n<b>02 Konsept va 3D dizayn</b> — 3D ko'rinishni tayyorlab, birga tasdiqlaymiz.\n<b>03 Ishchi hujjatlar</b> — chizmalar, smeta va hisob-kitoblar.\n<b>04 Qurilish nazorati</b> — obyektga muntazam borib, loyihaga mosligini tekshiramiz.\n<b>05 Topshirish</b> — birga ko'rib chiqib, kalitni topshiramiz.";
const DEF_DIZAYN = [[40, 'Shartnoma imzolanganda (oldindan)'], [30, 'Dizayn konsepsiyasi tasdiqlanganda'], [30, "Loyiha to'liq topshirilganda"]];
const DEF_TK = [[30, 'Shartnoma imzolanganda'], [30, 'Qurilish ishlari yakunlanganda'], [30, 'Pardozlash bosqichida'], [10, 'Obyekt topshirilganda']];
const stages = (arr, def) => (arr && arr.length ? arr.map((x) => [x.pct, x.uz]) : def);
const lines = (arr) => arr.map(([p, n], i) => `${i + 1}) <b>${p}%</b> — ${esc(n)}`).join('\n');

export async function guruhCb(env, cq, data) {
  const msg = cq.message;
  await api(env, 'answerCallbackQuery', { callback_query_id: cq.id });
  const p = data.split(':');           // gk:<amal>:...
  const amal = p[1];
  const d = await sayt(); const pr = d && d.pricing;
  const back = [{ text: '⬅ Menyu', callback_data: 'gk:m' }];
  let matn = SALOM_MATN, kb = ASOSIY_KB;
  const arch = (pr && pr.architecture) || null;

  if (amal === 'b') { matn = BOSQICH; kb = { inline_keyboard: [back] }; }
  else if (amal === 't') {
    matn = `💳 <b>To'lov bosqichlari</b>\n\n<b>Loyihalash (arxitektura / interyer):</b>\n${lines(stages(pr && pr.designPaymentStages, DEF_DIZAYN))}\n\n<b>Pod klyuch (qurilish):</b>\n${lines(stages(pr && pr.paymentStages, DEF_TK))}\n\n<i>Barcha ishlar shartnoma asosida.</i>`;
    kb = { inline_keyboard: [back] };
  } else if (amal === 'x') {
    matn = "🛠 <b>Xizmatlarimiz</b>\n\n🏛 <b>Arxitektura loyihalash</b> — uy va binolar loyihasi\n🛋 <b>Interyer dizayn</b> — planirovka, 3D vizualizatsiya, ishchi chizmalar\n🔨 <b>Remont (pod klyuch)</b> — loyihadan topshirishgacha";
    kb = { inline_keyboard: [
      [{ text: 'Arxitektura', url: `${SAYT}/xizmatlar/arxitektura-loyihalash` }, { text: 'Interyer', url: `${SAYT}/xizmatlar/interyer-dizayn` }],
      [{ text: 'Pod klyuch', url: `${SAYT}/xizmatlar/pod-klyuch` }], back] };
  } else if (amal === 'o') {
    const st = (d && d.settings) || {};
    const h = (v, b) => { v = String(v || '').trim(); return v ? (/^https?:\/\//i.test(v) ? v : b + v.replace(/^@/, '')) : null; };
    const rows = [['Instagram', h(st.instagram, 'https://instagram.com/')], ['Telegram kanal', h(st.telegram, 'https://t.me/')], ['YouTube', h(st.youtube, 'https://youtube.com/@')], ['Sayt', SAYT]]
      .filter((x) => x[1]).map((x) => [{ text: x[0], url: x[1] }]);
    matn = '🌐 Bizni kuzatib boring — yangi loyihalar va jarayonlar shu yerda 👇'; kb = { inline_keyboard: [...rows, back] };
  } else if (amal === 's') {
    matn = '💰 <b>Smeta hisoblash</b>\n\nQaysi xizmat uchun?';
    kb = { inline_keyboard: [[{ text: '🏛 Arxitektura', callback_data: 'gk:a:arx' }, { text: '🛋 Interyer', callback_data: 'gk:a:int' }], [{ text: '🔨 Pod klyuch', callback_data: 'gk:a:tk' }], back] };
  } else if (amal === 'a') {
    const sv = p[2]; const pre = sv === 'arx' ? [4, 6, 8, 10, 12, 15] : [50, 80, 120, 150, 200, 300];
    matn = `💰 <b>Smeta — ${{ arx: 'Arxitektura', int: 'Interyer', tk: 'Pod klyuch' }[sv]}</b>\n\nMaydonni tanlang (${sv === 'arx' ? 'sotix' : 'm²'}):`;
    kb = { inline_keyboard: [pre.slice(0, 3).map((n) => ({ text: String(n), callback_data: `gk:r:${sv}:${n}` })), pre.slice(3).map((n) => ({ text: String(n), callback_data: `gk:r:${sv}:${n}` })), [{ text: '⬅ Orqaga', callback_data: 'gk:s' }]] };
  } else if (amal === 'r') {
    const sv = p[2], n = Number(p[3]);
    if (!pr || !arch) { matn = "Hozir narxni olib bo'lmadi."; kb = { inline_keyboard: [back] }; }
    else {
      const opts = sv === 'int' ? (pr.interior.packages || []).map((x) => [x.id, nom(x)]) : (pr.styles || []).map((x) => [x.id, nom(x)]);
      matn = `💰 <b>Smeta</b> — ${n} ${sv === 'arx' ? 'sotix' : 'm²'}\n\n${sv === 'int' ? 'Qaysi paket?' : 'Uslub darajasi?'}`;
      kb = { inline_keyboard: [opts.map(([id, nm]) => ({ text: nm, callback_data: `gk:f:${sv}:${n}:${id}` })), [{ text: '⬅ Orqaga', callback_data: `gk:a:${sv}` }]] };
    }
  } else if (amal === 'f') {
    const sv = p[2], n = Number(p[3]), id = p[4];
    const st = ((pr && pr.styles) || []).find((x) => x.id === id) || { mult: 1, uz: 'Standart' };
    let natija = '', tl = '', tolov = DEF_DIZAYN;
    if (sv === 'arx') {
      natija = `🏛 Arxitektura, ${n} sotix · ${nom(st)}\n💰 ~ <b>${fmt(arch.ratePerSotix * n * (st.mult || 1))} so'm</b> (1 qavat)\n<i>Narx turar joylar (uylar) uchun 500 m² gacha, noturar binolar uchun 300 m² gacha bo'lgan maydonga amal qiladi. Maydon oshsa, narx loyihaga qarab alohida hisoblanadi.</i>`;
      tl = pr.timelines && pr.timelines.architecture ? nom(pr.timelines.architecture) : '';
      tolov = stages(pr.designPaymentStages, DEF_DIZAYN);
    } else if (sv === 'int') {
      const pk = (pr.interior.packages || []).find((x) => x.id === id);
      natija = `🛋 Interyer, ${n} m² · ${nom(pk)}\n💰 ~ <b>${fmt((pk ? pk.rate : 0) * n)} so'm</b>`;
      const t0 = pr.timelines && pr.timelines.interior && pr.timelines.interior[id];
      tl = t0 ? nom(t0) : '';
      tolov = stages(pr.designPaymentStages, DEF_DIZAYN);
    } else {
      const tk = pr.turnkey;
      const tier = tk.areaTiers.find((x) => n <= x.maxArea) || tk.areaTiers[tk.areaTiers.length - 1];
      const mg = tk.managementTiers.find((x) => n <= x.maxArea) || tk.managementTiers[tk.managementTiers.length - 1];
      let mn = 0, mx = 0;
      for (const c of tk.components) { const t0 = tier[c.id]; if (t0) { mn += t0.min * (st.mult || 1) * n; mx += t0.max * (st.mult || 1) * n; } }
      mn *= 1 + mg.pct; mx *= 1 + mg.pct; const k = pr.usdRate || 12700;
      natija = `🔨 Pod klyuch, ${n} m² · ${nom(st)}\n💰 ~ <b>$${fmt(mn)} – $${fmt(mx)}</b> (≈ ${fmt(mn * k)} – ${fmt(mx * k)} so'm)`;
      tl = Array.isArray(pr.timelines && pr.timelines.turnkey) ? pr.timelines.turnkey.map(nom).filter(Boolean).join(' / ') : '';
      tolov = stages(pr.paymentStages, DEF_TK);
    }
    matn = `${natija}${tl ? `\n⏱ ${esc(tl)}` : ''}\n\n💳 <b>To'lov bosqichlari:</b>\n${lines(tolov)}\n\n<i>Taxminiy narx. Aniq narx — bepul konsultatsiyada.</i>`;
    kb = { inline_keyboard: [[{ text: '📝 Ariza qoldirish', url: `https://t.me/${BOT}?start=guruh` }], [{ text: '🔁 Qayta hisoblash', callback_data: 'gk:s' }, ...back]] };
  }

  if (matn.length > 1000 && msg.photo) matn = matn.slice(0, 1000);
  const body = { chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'HTML', reply_markup: kb };
  await api(env, msg.photo ? 'editMessageCaption' : 'editMessageText', msg.photo ? { ...body, caption: matn } : { ...body, text: matn, disable_web_page_preview: true });
}

async function guruhAdminmi(env, msg) {
  const uid = msg.from && msg.from.id;
  if (String(env.ADMIN_TELEGRAM_IDS || '').split(',').map((x) => x.trim()).includes(String(uid))) return true;
  const r = await api(env, 'getChatMember', { chat_id: msg.chat.id, user_id: uid });
  const st = r && r.result && r.result.status;
  return st === 'creator' || st === 'administrator';
}

// true -- buyruq shu yerda ishlandi
export async function guruhBuyruq(env, msg) {
  const m = (msg.text || '').match(/^\/(narx|loyiha|maslahat|obuna|obunabekor|menu|start)(?:@\w+)?(?:\s+(.*))?$/i);
  if (!m) return false;
  const cmd = m[1].toLowerCase(), arg = (m[2] || '').trim();
  const chatId = msg.chat.id;

  // Obyektga ulangan (ustalar / mijozlar) ishchi guruhlarda ommaviy menyu chiqmaydi
  const [u, mj] = await Promise.all([
    sb(env, `usta_guruhlar?telegram_chat_id=eq.${chatId}&select=obyekt_id&limit=1`).catch(() => []),
    sb(env, `visart_loyiha_guruhlar?telegram_chat_id=eq.${chatId}&select=obyekt_id&limit=1`).catch(() => []),
  ]);
  if ((u && u.length) || (mj && mj.length)) return true;
  if (cmd === 'menu' || cmd === 'start') { await guruhSalom(env, msg.chat); return true; }
  if (cmd === 'obuna' || cmd === 'obunabekor') {
    if (!(await guruhAdminmi(env, msg))) { await tg(env, chatId, "Bu buyruq faqat guruh adminlari uchun."); return true; }
    await sb(env, 'bot_guruhlar', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: JSON.stringify([{ chat_id: chatId, nom: msg.chat.title || '', obuna: cmd === 'obuna' }]) }).catch(() => {});
    await tg(env, chatId, cmd === 'obuna' ? "✅ Haftalik maslahat yoqildi (haftada 1 marta). O'chirish: /obunabekor" : "🔕 Haftalik maslahat o'chirildi.");
    return true;
  }
  if (cmd === 'maslahat') {
    const r = await sb(env, 'nashr_navbati?select=payload&turi=eq.guruh_maslahat&holat=eq.bajarildi&order=id.desc&limit=15').catch(() => []);
    const ro = (r || []).map((x) => x.payload && x.payload.matn).filter(Boolean);
    const pool = ro.length ? ro : TAYYOR_MASLAHAT;
    await tg(env, chatId, pool[Math.floor(Math.random() * pool.length)], botKb);
    return true;
  }
  if (cmd === 'loyiha') {
    const d = await sayt();
    const l = ((d && d.projects) || []).filter((p) => p.slug);
    if (!l.length) { await tg(env, chatId, `Loyihalarimiz: ${SAYT}/loyihalar`); return true; }
    const p = l[Math.floor(Math.random() * l.length)];
    await tg(env, chatId, `🏠 <b>${esc(nom(p.title))}</b>\nBatafsil: ${SAYT}/loyihalar/${p.slug}`, botKb);
    return true;
  }
  // /narx <maydon> [interyer|arxitektura]
  const mm = arg.match(/^(\d+(?:[.,]\d+)?)\s*(\S*)/);
  if (!mm) { await tg(env, chatId, "Masalan: <code>/narx 80 interyer</code> (m²) yoki <code>/narx 6 arxitektura</code> (sotix)"); return true; }
  const v = parseFloat(mm[1].replace(',', '.')), tur = mm[2].toLowerCase();
  const d = await sayt(); const pr = d && d.pricing;
  if (!pr) { await tg(env, chatId, "Hozir narxni olib bo'lmadi. Botda aniq narx: ", botKb); return true; }
  if (/^arx/.test(tur) && pr.architecture) {
    await tg(env, chatId, `🏛 Arxitektura loyiha, ${v} sotix:\n~ <b>${fmt(pr.architecture.ratePerSotix * v)} so'm</b> (Standart, 1 qavat)\n<i>Taxminiy. Hujjatlashtirish alohida. Narx turar joylar (uylar) uchun 500 m² gacha, noturar binolar uchun 300 m² gacha bo'lgan maydonga amal qiladi. Maydon oshsa, narx loyihaga qarab alohida hisoblanadi.</i>`, botKb);
  } else if ((!tur || /^int/.test(tur)) && pr.interior && pr.interior.packages) {
    const r = pr.interior.packages.map((x) => x.rate * v);
    await tg(env, chatId, `🛋 Interyer dizayn, ${v} m²:\n~ <b>${fmt(Math.min(...r))} – ${fmt(Math.max(...r))} so'm</b> (paketga qarab)\n<i>Taxminiy narx.</i>`, botKb);
  } else {
    await tg(env, chatId, "Pod klyuch (remont) narxi xonaga qarab hisoblanadi — botda hisoblab beraman 👇", botKb);
  }
  return true;
}

// ── Haftalik maslahat: Claude yozadi -> admin tasdiqlaydi -> obunali guruhlarga ketadi ──
export async function maslahatYarat(env) {
  if (!env.ANTHROPIC_API_KEY || !env.MIJOZ_BOT_TOKEN) return;
  const g = await sb(env, 'bot_guruhlar?select=chat_id&obuna=eq.true&limit=1').catch(() => []);
  if (!g || !g.length) return;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 400, messages: [{ role: 'user', content:
      "Toshkentdagi uy egalari uchun interyer dizayn, remont yoki arxitektura bo'yicha BITTA qisqa amaliy maslahat yoz (o'zbek tilida, lotin, 350–450 belgi). Format: birinchi qator '💡 <b>Sarlavha</b>', keyin 2–3 gap. Narx, reklama, kompaniya nomi va va'da bo'lmasin. Faqat matnning o'zini qaytar." }] }),
    signal: AbortSignal.timeout(40000),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = await res.json();
  const matn = (((data.content || []).find((x) => x.type === 'text') || {}).text || '').trim();
  if (!matn) return;
  const row = await sb(env, 'nashr_navbati', { method: 'POST', body: JSON.stringify([{ turi: 'guruh_maslahat', payload: { matn }, nashr_vaqti: new Date().toISOString(), holat: 'tasdiq_kutilmoqda' }]) });
  const id = row && row[0] && row[0].id;
  if (!id) return;
  for (const m of menejerIdlari(env)) {
    await tg(env, m, `📝 <b>Haftalik guruh maslahati — tasdiqlang</b>\n\n${matn}`, { inline_keyboard: [[
      { text: '✅ Yuborish', callback_data: `gm:ok:${id}` }, { text: '🔄 Boshqasi', callback_data: `gm:re:${id}` }, { text: '❌ Bekor', callback_data: `gm:no:${id}` }]] });
  }
}

export async function maslahatTarqat(env, id) {
  const r = await sb(env, `nashr_navbati?id=eq.${id}&holat=eq.tasdiq_kutilmoqda&select=payload`);
  const matn = r && r[0] && r[0].payload && r[0].payload.matn;
  if (!matn) return -1;
  const gl = (await sb(env, 'bot_guruhlar?select=chat_id&obuna=eq.true').catch(() => [])) || [];
  let n = 0;
  for (const g of gl) { const x = await tg(env, g.chat_id, matn, botKb); if (x && x.ok) n++; }
  await sb(env, `nashr_navbati?id=eq.${id}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ holat: 'bajarildi' }) }).catch(() => {});
  return n;
}

export async function maslahatNavbatiniTekshir(env) {
  const bor = await sb(env, 'nashr_navbati?select=id&turi=eq.maslahat_yarat&holat=eq.kutilmoqda&limit=1').catch(() => null);
  if (bor === null || bor.length) return;
  await sb(env, 'nashr_navbati', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify([{ turi: 'maslahat_yarat', payload: {}, nashr_vaqti: keyingiToshkent(10, 0), holat: 'kutilmoqda' }]) }).catch(() => {});
}
export const keyingiHafta = () => keyingiToshkent(10, 7);

// ── Obyekt guruhlariga bog'langanda tanishtiruv (mijozlar / ustalar) ──
export const TANISH_MIJOZ =
  "Assalomu alaykum, hurmatli mijozimiz! 👋\n\n" +
  "Sizni <b>Visart Design</b> oilasida ko'rganimizdan juda xursandmiz. Men — jamoamizning raqamli yordamchisi <b>Visart Design boti</b>man. Maqsadim — loyihangiz jarayonini siz uchun shaffof va qulay qilish. ✨\n\n" +
  "<b>Men nima qilaman:</b>\n" +
  "🏗 <b>Obyekt holati</b> — ish qaysi bosqichda ekanini yetkazib turaman\n" +
  "🎥 <b>Kunlik hisobot</b> — ustalar bajargan ishning foto va videolari (jamoamiz tekshirib tasdiqlagandan so'ng) shu yerga keladi\n" +
  "💳 <b>To'lovlar</b> — to'lov tasdig'i va keyingi bosqich haqida eslatmalar\n" +
  "✅ <b>Bosqich yakuni</b> — ish tugaganda xabar beraman va fikringizni so'rayman\n" +
  "💬 <b>Savollar</b> — shaxsiy chatda (@visart_design_bot) obyektingiz holati, muddat va smeta bo'yicha javob beraman\n\n" +
  "Bu guruhga faqat muhim va tasdiqlangan xabarlar yuboriladi. 🤝\n" +
  "Savolingiz bo'lsa, menejerimiz doim aloqada. Birgalikda orzuyingizdagi makonni yaratamiz! 🏡";

export const TANISH_USTA =
  "Assalomu alaykum, hurmatli ustalar! 👷‍♂️🙏\n\n" +
  "Men — <b>Visart Design</b> jamoasining yordamchi botiman. Har kungi mehnatingiz uchun oldindan rahmat: sizning xalol ishingiz loyihamizning asosi! 💪\n\n" +
  "<b>Bu guruhda qanday ishlaymiz:</b>\n" +
  "1️⃣ Bajargan ishingizning <b>video yoki rasmini</b> shu yerga tashlang\n" +
  "2️⃣ Bot so'raydi — <b>qaysi ish turi</b> (elektr, santexnika, pardoz va h.k.) — tugmani bosing\n" +
  "3️⃣ Jamoamiz ko'rib chiqadi, to'g'ri bo'lsa <b>mijozga yuboriladi</b>\n" +
  "4️⃣ Natija (yuborildi / qayta yuborish kerak) shu yerda xabar qilinadi\n\n" +
  "💬 <b>Guruh — umumiy muloqot joyi:</b> ish bo'yicha o'zaro fikr almashishingiz, savol berishingiz va bir-biringizga yordam berishingiz mumkin. Bot oddiy yozishmalarga aralashmaydi — faqat foto/video va natijalar bilan ishlaydi. Har bir hisobotning natijasini shu yerda kuzatib borasiz.\n\n" +
  "<b>Eslatma:</b>\n" +
  "• Faqat shu obyektga tegishli ish hisobotini yuboring\n" +
  "• Video/rasm aniq va yorug' bo'lsin — mijoz ko'radi\n" +
  "• Kuniga bir marta umumiy hisobot ham yetarli\n\n" +
  "Charchamang, ishingizga omad! 🛠✨";
