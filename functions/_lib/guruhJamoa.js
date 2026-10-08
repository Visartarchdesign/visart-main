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

export async function guruhSalom(env, chat) {
  await sb(env, 'bot_guruhlar', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal', body: JSON.stringify([{ chat_id: chat.id, nom: chat.title || '' }]) }).catch(() => {});
  await tg(env, chat.id,
    "Salom! Men <b>Visart Design</b> boti — arxitektura, interyer va remont bo'yicha yordamchiman. 👋\n\nBuyruqlar:\n/narx 80 interyer — taxminiy narx\n/loyiha — loyiha namunasi\n/maslahat — foydali maslahat\n/obuna — haftalik maslahat (guruh admini)\n\nO'zim gapirmayman, faqat so'ralganda javob beraman.", botKb);
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
  const m = (msg.text || '').match(/^\/(narx|loyiha|maslahat|obuna|obunabekor)(?:@\w+)?(?:\s+(.*))?$/i);
  if (!m) return false;
  const cmd = m[1].toLowerCase(), arg = (m[2] || '').trim();
  const chatId = msg.chat.id;

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
    await tg(env, chatId, `🏛 Arxitektura loyiha, ${v} sotix:\n~ <b>${fmt(pr.architecture.ratePerSotix * v)} so'm</b> (Standart, 1 qavat)\n<i>Taxminiy. Hujjatlashtirish alohida.</i>`, botKb);
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
