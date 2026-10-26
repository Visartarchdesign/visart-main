// SEO agenti: Telegram orqali loyiha rasmlari -> agent savollari -> AI tavsif (UZ/RU) -> tasdiq -> qulay vaqtda saytga (D1 + R2) -> IndexNow.
// Qo'shimcha: domen muddati nazorati va haftalik SEO audit.
// Holatlar (nashr_navbati.turi='seo_loyiha'): seo_yig -> seo_navbat -> seo_ish -> seo_tayyor | seo_xato | seo_bekor  (cron'ning "kutilmoqda" oqimiga aralashmaydi).
import { buildValues } from './projectFields.js';
import { slugifyUz, slugifyRu, ensureUniqueSlug } from './slug.js';

const SAYT = 'https://visartdesign.uz';
const INDEXNOW_KEY = 'ae33106eb177a277e4558157b2c72776';
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const sb = async (env, path, init = {}) => {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: init.prefer || 'return=representation' }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`sb ${r.status} ${(await r.text().catch(() => '')).slice(0, 120)}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
};
const tgApi = (env, method, body) => fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) }).then((r) => r.json()).catch(() => null);
const say = (env, chat_id, text, kb) => tgApi(env, 'sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(kb ? { reply_markup: kb } : {}) });
const upd = (env, id, holat, payload) => sb(env, `nashr_navbati?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ holat, ...(payload ? { payload } : {}) }) });

const QS = [
  { k: 'category', q: '1/9. Bu qanday ish?', opt: [['Interyer', 'interior'], ['Arxitektura', 'architecture'], ['Chizmalar', 'drawings']] },
  { k: 'status', q: '2/9. Ish holati?', opt: [['Qurilgan / topshirilgan', 'done'], ['Faqat 3D loyiha', 'render']] },
  { k: 'joy', q: "3/9. Qaysi shahar yoki tumanda? Aniq manzil yozmang (masalan: Toshkent, Yunusobod).", text: true },
  { k: 'maydon', q: '4/9. Umumiy maydoni necha m²? (faqat raqam)', text: true, skip: true },
  { k: 'yil', q: '5/9. Qaysi yilgi loyiha?', opt: [['2026', '2026'], ['2025', '2025'], ['2024', '2024'], ['2023', '2023']], text: true },
  { k: 'muddat', q: "6/9. Qancha muddatda bajarilgan? (masalan: 3 oy)", text: true, skip: true },
  { k: 'uslub', q: '7/9. Uslubi?', opt: [['Zamonaviy', 'Zamonaviy'], ['Klassik', 'Klassik'], ['Neoklassik', 'Neoklassik'], ['Minimalizm', 'Minimalizm'], ['Skandinav', 'Skandinav'], ['Loft', 'Loft']], text: true },
  { k: 'vazifa', q: "8/9. Mijoz nimani xohlagan edi va qanday asosiy yechim qildingiz? (1–2 gap)", text: true, skip: true },
  { k: 'maxfiy', q: "9/9. Kadrlarda mijoz ismi, telefon, aniq manzil yoki hujjat ko'rinmaydimi?", opt: [["Ko'rinmaydi", 'ok'], ["Ko'rinadi", 'yoq']] },
];

async function aktiv(env, chatId) {
  const r = await sb(env, `nashr_navbati?turi=eq.seo_loyiha&holat=eq.seo_yig&payload->>chatId=eq.${chatId}&order=id.desc&limit=1&select=id,payload`).catch(() => []);
  return r && r[0] ? r[0] : null;
}

const NISHON = { sayt: '🌐 Sayt (portfolio)', yandex: '🗺 Yandex', google: '🗺 Google', gis: '🗺 2GIS' };
const nishonKb = (n) => ({ inline_keyboard: [Object.keys(NISHON).slice(0, 2).map((k) => ({ text: `${n[k] ? '✅' : '⬜️'} ${NISHON[k]}`, callback_data: `sg:n:${k}` })), Object.keys(NISHON).slice(2).map((k) => ({ text: `${n[k] ? '✅' : '⬜️'} ${NISHON[k]}`, callback_data: `sg:n:${k}` })), [{ text: '▶️ Davom etish', callback_data: 'sg:go' }]] });

export async function seoYangi(env, chatId) {
  const old = await aktiv(env, chatId);
  if (old) await upd(env, old.id, 'seo_bekor');
  const ox = await sb(env, 'nashr_navbati?turi=eq.seo_oxirgi&limit=1&select=id,payload').catch(() => []);
  const n = (ox && ox[0] && ox[0].payload && ox[0].payload.n) || { sayt: true };
  await sb(env, 'nashr_navbati', { method: 'POST', body: JSON.stringify([{ turi: 'seo_loyiha', holat: 'seo_yig', nashr_vaqti: new Date().toISOString(), payload: { chatId, step: 'qayerga', n, rasmlar: [], q: 0, j: {} } }]) });
  await say(env, chatId, "🔎 <b>SEO agenti</b>\n\nRasmlar qayerga joylansin? Tanlang (oxirgi tanlovingiz saqlanadi):", nishonKb(n));
}

async function xaritaNavbat(env, p, toifa) {
  const maps = ['yandex', 'google', 'gis'].filter((k) => p.n && p.n[k]);
  const rows = [];
  for (const pl of maps) for (const fid of p.rasmlar) rows.push({ turi: 'foto_ish', holat: 'foto_navbat', nashr_vaqti: new Date().toISOString(), payload: { chatId: p.chatId, fileId: fid, toifa, platforma: pl, manba: 'seo' } });
  if (rows.length) await sb(env, 'nashr_navbati', { method: 'POST', body: JSON.stringify(rows) });
  return { maps, soni: rows.length };
}
const TOIFA_UCHUN = { interior: 'interior', architecture: 'exterior', drawings: 'xizmat' };

export async function seoMedia(env, msg) {
  const d = await aktiv(env, msg.chat.id); if (!d || d.payload.step !== 'rasm') return false;
  const fid = msg.photo ? msg.photo[msg.photo.length - 1].file_id : (msg.document && /^image\//.test(msg.document.mime_type || '') ? msg.document.file_id : null);
  if (!fid) return false;
  // Albomdagi rasmlar bir vaqtda keladi -- poyga bo'lmasligi uchun har rasm alohida qator
  const mine = await sb(env, 'nashr_navbati', { method: 'POST', body: JSON.stringify([{ turi: 'seo_rasm', holat: 'seo_yig', nashr_vaqti: new Date().toISOString(), payload: { chatId: msg.chat.id, draft: d.id, fid, mid: msg.message_id } }]) });
  const first = await sb(env, `nashr_navbati?turi=eq.seo_rasm&holat=eq.seo_yig&payload->>draft=eq.${d.id}&order=id.asc&limit=1&select=id`).catch(() => []);
  if (first && first[0] && mine && mine[0] && first[0].id === mine[0].id) await say(env, msg.chat.id, "📷 Rasmlar qabul qilinmoqda. <b>Rasmlar tugadimi?</b> (hammasi bitta ish deb olinadi)", { inline_keyboard: [[{ text: '✅ Ha, tugadi', callback_data: 'sg:done' }, { text: "➕ Yo'q, yana bor", callback_data: 'sg:more' }]] });
  return true;
}

async function savolBer(env, chatId, p) {
  const q = QS[p.q];
  const rows = [];
  if (q.opt) for (let i = 0; i < q.opt.length; i += 3) rows.push(q.opt.slice(i, i + 3).map(([t], j) => ({ text: t, callback_data: `sg:o:${p.q}:${i + j}` })));
  if (q.skip) rows.push([{ text: "⏭ O'tkazib yuborish", callback_data: `sg:o:${p.q}:-1` }]);
  await say(env, chatId, q.q + (q.text && q.opt ? '\n<i>(tugmani bosing yoki o\'zingiz yozing)</i>' : ''), rows.length ? { inline_keyboard: rows } : undefined);
}

async function javobYoz(env, d, val) {
  const p = d.payload, q = QS[p.q];
  if (val !== null) p.j[q.k] = val;
  if (q.k === 'maxfiy' && val === 'yoq') { await upd(env, d.id, 'seo_bekor'); await say(env, p.chatId, "Loyiha to'xtatildi: maxfiy ma'lumot ko'rinib turgan kadrlarni olib tashlab, /seo dan qayta boshlang."); return; }
  p.q++;
  if (p.q < QS.length) { await sb(env, `nashr_navbati?id=eq.${d.id}`, { method: 'PATCH', body: JSON.stringify({ payload: p }) }); await savolBer(env, p.chatId, p); return; }
  p.step = 'yozish';
  await sb(env, `nashr_navbati?id=eq.${d.id}`, { method: 'PATCH', body: JSON.stringify({ payload: p }) });
  await say(env, p.chatId, '⏳ Agent rasmlarni ko\'rib chiqib, UZ/RU matn yozmoqda (30–60 soniya)…');
  await yarat(env, d.id, p);
}

async function tgFayl(env, fileId) {
  const g = await tgApi(env, 'getFile', { file_id: fileId });
  if (!g || !g.ok) throw new Error('getFile: fayl 20 MB dan katta yoki topilmadi');
  const r = await fetch(`https://api.telegram.org/file/bot${env.MIJOZ_BOT_TOKEN}/${g.result.file_path}`, { signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error('fayl yuklanmadi ' + r.status);
  return new Uint8Array(await r.arrayBuffer());
}
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
function tur(u8) {
  if (u8[0] === 0xff && u8[1] === 0xd8) return ['jpg', 'image/jpeg'];
  if (u8[1] === 0x50 && u8[2] === 0x4e) return ['png', 'image/png'];
  if (u8[0] === 0x52 && u8[8] === 0x57) return ['webp', 'image/webp'];
  return null;
}

async function claude(env, content, maxTokens = 2500) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY yoq');
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: maxTokens, messages: [{ role: 'user', content }, { role: 'assistant', content: '{' }] }), signal: AbortSignal.timeout(55000) });
  if (!r.ok) throw new Error('Claude API ' + r.status);
  const d = await r.json();
  const t = '{' + (((d.content || []).find((x) => x.type === 'text') || {}).text || '');
  const m = t.match(/\{[\s\S]*\}/); if (!m) throw new Error('JSON emas');
  return JSON.parse(m[0]);
}

const QOIDA = `Qoidalar:
- Faqat egasi bergan ma'lumot va rasmda ANIQ ko'ringan narsaga tayan. Narx, mijoz ismi, aniq manzil, material markasi, raqam O'YLAB TOPMA.
- O'zbekcha: sodda, tabiiy, zamonaviy (ruscha kalka yo'q). Ruscha: tabiiy, professional.
- SEO: sarlavhada asosiy kalit so'z (masalan "Zamonaviy interyer dizayn, 85 m², Toshkent"), 60 belgigacha. Tavsif 450-700 belgi: xonalar, zonalar, uslub, rang/material, yoritish, dizayn yechimi; birinchi gapda asosiy kalit so'z; "premium", "lyuks" kabi bo'sh so'zlar yo'q.
- alt matn: har rasm uchun 8-14 so'z, rasmda nima ko'ringani (xona, uslub, asosiy elementlar), kalit so'zni tabiiy kirit, "rasm" so'zini yozma.`;

async function yarat(env, id, p, tuzat) {
  try {
    const n = p.rasmlar.length;
    const idx = [...new Set([0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1])].filter((i) => i < n).slice(0, 5);
    const blocks = [];
    for (const i of idx) { const u8 = await tgFayl(env, p.rasmlar[i]); const t = tur(u8); if (t && u8.length < 4.5e6) blocks.push({ type: 'image', source: { type: 'base64', media_type: t[1], data: b64(u8) } }); }
    const j = p.j;
    const malumot = `kategoriya: ${j.category}; holat: ${j.status === 'done' ? 'qurilgan/topshirilgan' : 'faqat 3D loyiha'}; joy: ${j.joy || '-'}; maydon: ${j.maydon || '-'} m2; yil: ${j.yil || '-'}; muddat: ${j.muddat || '-'}; uslub: ${j.uslub || '-'}; mijoz vazifasi/yechim: ${j.vazifa || '-'}`;
    const prompt = (tuzat ? `Avvalgi matn:\n${JSON.stringify(p.matn)}\n\nEgasi tuzatish so'radi: "${tuzat}". Faqat shuni hisobga olib, butun JSON'ni qaytar.\n\n` : '') + `Siz Visart Design (Toshkent) saytiga yangi loyiha uchun SEO matn yozuvchisiz. Ilova qilingan rasmlar shu loyihaniki (jami ${n} ta, ko'rsatilgani ${idx.length} ta).\nEgasi bergan ma'lumot: ${malumot}\n\n${QOIDA}\n\nFAQAT JSON: {"title_uz":"","title_ru":"","type_uz":"<2-4 so'z, masalan 'Kvartira interyeri'>","type_ru":"","desc_uz":"","desc_ru":"","task_uz":"<mijoz vazifasi 1-2 gap yoki bo'sh>","task_ru":"","style_uz":"","style_ru":"","location_uz":"","location_ru":"","duration_uz":"","duration_ru":"","alts":[{"uz":"","ru":""}]}  — alts uzunligi aniq ${n} ta bo'lsin.`;
    const out = await claude(env, [...blocks, { type: 'text', text: prompt }], 4000);
    if (!out.title_uz || !out.desc_uz) throw new Error("AI to'liq matn bermadi");
    p.matn = out; p.step = 'korish';
    await sb(env, `nashr_navbati?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ payload: p }) });
    const cap = `🔎 <b>${esc(out.title_uz)}</b>\n${esc(out.type_uz)} · ${esc(out.style_uz)}${p.j.maydon ? ' · ' + esc(p.j.maydon) + ' m²' : ''}`;
    await tgApi(env, 'sendPhoto', { chat_id: p.chatId, photo: p.rasmlar[0], caption: cap, parse_mode: 'HTML' });
    await say(env, p.chatId, `<b>UZ:</b> ${esc(out.title_uz)}\n${esc(out.desc_uz)}\n\n<b>RU:</b> ${esc(out.title_ru)}\n${esc(out.desc_ru)}\n\n🖼 ${n} ta rasm, har biriga alt matn yozildi.\n🔗 <i>${SAYT}/loyihalar/${slugifyUz(out.title_uz)}</i>`, { inline_keyboard: [[{ text: '✅ Qulay vaqtda joylash', callback_data: 'sg:ok' }, { text: '⚡ Hozir', callback_data: 'sg:now' }], [{ text: '✏️ Tuzatish', callback_data: 'sg:ed' }, { text: '❌ Bekor', callback_data: 'sg:no' }]] });
  } catch (e) {
    await say(env, p.chatId, `⚠️ Matn yozishda xato: ${esc(e.message)}\nQayta urinish: /seo`);
    await upd(env, id, 'seo_xato');
  }
}

// Navbatdagi qulay slot: Toshkent 11:00, oldingi loyihadan kamida 2 kun keyin
async function slot(env) {
  const last = await sb(env, 'nashr_navbati?turi=eq.seo_loyiha&holat=in.(seo_navbat,seo_ish,seo_tayyor)&order=nashr_vaqti.desc&limit=1&select=nashr_vaqti').catch(() => []);
  const minT = Math.max(Date.now() + 30 * 60e3, last && last[0] ? new Date(last[0].nashr_vaqti).getTime() + 2 * 86400e3 - 6 * 3600e3 : 0);
  const d = new Date(minT); d.setUTCHours(6, 0, 0, 0);
  while (d.getTime() < minT) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
const tosh = (d) => new Date(d.getTime() + 5 * 3600e3).toISOString().replace('T', ' ').slice(0, 16);

export async function seoMatn(env, msg) {
  const chatId = msg.chat.id;
  const r = await sb(env, `nashr_navbati?turi=eq.seo_loyiha&holat=eq.seo_yig&payload->>chatId=eq.${chatId}&order=id.desc&limit=1&select=id,payload`).catch(() => []);
  const d = r && r[0]; if (!d) return false;
  const p = d.payload, t = (msg.text || '').trim(); if (!t) return false;
  if (p.step === 'savol') { const q = QS[p.q]; if (!q.text) return false; await javobYoz(env, d, q.k === 'maydon' ? (t.replace(/[^\d]/g, '') || t) : t); return true; }
  if (p.step === 'tuzat') { p.step = 'yozish'; await sb(env, `nashr_navbati?id=eq.${d.id}`, { method: 'PATCH', body: JSON.stringify({ payload: p }) }); await say(env, chatId, '⏳ Tuzatilmoqda…'); await yarat(env, d.id, p, t); return true; }
  return false;
}

export async function seoCb(env, cq) {
  const chatId = cq.message.chat.id, p0 = String(cq.data).split(':'), amal = p0[1];
  await tgApi(env, 'answerCallbackQuery', { callback_query_id: cq.id });
  if (amal === 'yangi') return seoYangi(env, chatId);
  if (amal === 'domen') return domenKorsat(env, chatId);
  await tgApi(env, 'editMessageReplyMarkup', { chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } });
  const d = await aktiv(env, chatId); if (!d) return say(env, chatId, 'Faol loyiha yo\'q. /seo dan boshlang.');
  const p = d.payload;
  if (amal === 'n') { const k = p0[2]; if (!NISHON[k] || p.step !== 'qayerga') return; p.n = { ...(p.n || {}), [k]: !(p.n || {})[k] }; await sb(env, `nashr_navbati?id=eq.${d.id}`, { method: 'PATCH', body: JSON.stringify({ payload: p }) }); return tgApi(env, 'editMessageReplyMarkup', { chat_id: chatId, message_id: cq.message.message_id, reply_markup: nishonKb(p.n) }); }
  if (amal === 'go') {
    if (p.step !== 'qayerga') return;
    if (!Object.values(p.n || {}).some(Boolean)) return say(env, chatId, 'Kamida bitta joyni tanlang.', nishonKb(p.n || {}));
    p.step = 'rasm'; await sb(env, `nashr_navbati?id=eq.${d.id}`, { method: 'PATCH', body: JSON.stringify({ payload: p }) });
    const ox = await sb(env, 'nashr_navbati?turi=eq.seo_oxirgi&limit=1&select=id').catch(() => []);
    if (ox && ox[0]) await sb(env, `nashr_navbati?id=eq.${ox[0].id}`, { method: 'PATCH', body: JSON.stringify({ payload: { n: p.n } }) }).catch(() => {});
    else await sb(env, 'nashr_navbati', { method: 'POST', body: JSON.stringify([{ turi: 'seo_oxirgi', holat: 'seo_sozlama', nashr_vaqti: new Date().toISOString(), payload: { n: p.n } }]) }).catch(() => {});
    const qayer = Object.keys(NISHON).filter((k) => p.n[k]).map((k) => NISHON[k]).join(', ');
    return say(env, chatId, `📍 Joylanadi: <b>${qayer}</b>\n\nRasmlarni yuboring (bir nechtasini birdan tashlashingiz mumkin). Eng yaxshi sifat uchun «Fayl» (siqmasdan) qilib yuboring.${p.n.sayt ? "\nBirinchi rasm sayt muqovasi bo'ladi." : ''}`);
  }
  if (amal === 'more') {
    await sb(env, `nashr_navbati?turi=eq.seo_rasm&holat=eq.seo_yig&payload->>draft=eq.${d.id}`, { method: 'PATCH', body: JSON.stringify({ holat: 'seo_qabul' }) }).catch(() => {});
    return say(env, chatId, "👍 Yana rasm yuboring. Tugagach yana so'rayman.");
  }
  if (amal === 'done') {
    const rr = await sb(env, `nashr_navbati?turi=eq.seo_rasm&holat=in.(seo_yig,seo_qabul)&payload->>draft=eq.${d.id}&select=id,payload&limit=60`).catch(() => []);
    p.rasmlar = (rr || []).sort((x, y) => x.payload.mid - y.payload.mid).slice(0, 20).map((x) => x.payload.fid);
    if (!p.rasmlar.length) return say(env, chatId, 'Avval rasm yuboring.');
    await sb(env, `nashr_navbati?turi=eq.seo_rasm&payload->>draft=eq.${d.id}`, { method: 'PATCH', body: JSON.stringify({ holat: 'seo_arxiv' }) }).catch(() => {});
    if (!(p.n && p.n.sayt)) {
      // Faqat xaritalarga: SEO savollari kerak emas, faqat toifa
      p.step = 'toifa'; await sb(env, `nashr_navbati?id=eq.${d.id}`, { method: 'PATCH', body: JSON.stringify({ payload: p }) });
      return say(env, chatId, `📷 ${p.rasmlar.length} ta rasm. Bu rasmlar qaysi toifaga tushsin?`, { inline_keyboard: [[{ text: "Ichki ko'rinish", callback_data: 'sg:t:interior' }, { text: "Tashqi ko'rinish", callback_data: 'sg:t:exterior' }], [{ text: 'Xizmatlar', callback_data: 'sg:t:xizmat' }]] });
    }
    p.step = 'savol'; p.q = 0; await sb(env, `nashr_navbati?id=eq.${d.id}`, { method: 'PATCH', body: JSON.stringify({ payload: p }) });
    await say(env, chatId, `📷 ${p.rasmlar.length} ta rasm. Endi bir nechta savol beraman, siz faqat javob bering.`);
    return savolBer(env, chatId, p);
  }
  if (amal === 't') {
    if (p.step !== 'toifa' || !['interior', 'exterior', 'xizmat'].includes(p0[2])) return;
    const r = await xaritaNavbat(env, p, p0[2]);
    await upd(env, d.id, 'seo_tayyor', { ...p, rasmlar: p.rasmlar.length });
    return say(env, chatId, `📥 ${r.soni} ta yuklash navbatga qo'shildi (${r.maps.map((k) => NISHON[k]).join(', ')}). Saytga <b>joylanmaydi</b>. Holat: /foto → 📊`);
  }
  if (amal === 'o') { const qi = Number(p0[2]), oi = Number(p0[3]); if (qi !== p.q || p.step !== 'savol') return; const q = QS[qi]; return javobYoz(env, d, oi < 0 ? null : q.opt[oi][1]); }
  if (amal === 'ed') { p.step = 'tuzat'; await sb(env, `nashr_navbati?id=eq.${d.id}`, { method: 'PATCH', body: JSON.stringify({ payload: p }) }); return say(env, chatId, "✏️ Nimani o'zgartiray? Yozing (masalan: «sarlavhada Yunusobodni qo'sh», «tavsifni qisqartir»)."); }
  if (amal === 'no') { await upd(env, d.id, 'seo_bekor'); return say(env, chatId, 'Bekor qilindi.'); }
  if (amal === 'ok' || amal === 'now') {
    const t = amal === 'now' ? new Date() : await slot(env);
    await sb(env, `nashr_navbati?id=eq.${d.id}`, { method: 'PATCH', body: JSON.stringify({ holat: 'seo_navbat', nashr_vaqti: t.toISOString() }) });
    const xr = (p.n && (p.n.yandex || p.n.google || p.n.gis)) ? await xaritaNavbat(env, p, TOIFA_UCHUN[(p.j && p.j.category) || 'interior'] || 'interior').catch(() => null) : null;
    if (xr && xr.soni) await say(env, chatId, `📥 Xaritalarga ham navbatga qo'shildi: ${xr.maps.map((k) => NISHON[k]).join(', ')} (${xr.soni} ta yuklash).`);
    return say(env, chatId, amal === 'now' ? '⚡ Hozir joylanadi (15 daqiqagacha). Tayyor bo\'lgach havolasini yuboraman.' : `🗓 Saytga joylanadi: <b>${tosh(t)}</b> (Toshkent). Tayyor bo'lgach havolasini yuboraman.`);
  }
}

// ── Cron: vaqti kelgan loyihani saytga yuklash ──
export async function seoNashr(env) {
  const rows = await sb(env, `nashr_navbati?turi=eq.seo_loyiha&holat=eq.seo_navbat&nashr_vaqti=lte.${encodeURIComponent(new Date().toISOString())}&order=nashr_vaqti.asc&limit=1&select=id,payload`).catch(() => []);
  const d = rows && rows[0]; if (!d) return;
  const claim = await sb(env, `nashr_navbati?id=eq.${d.id}&holat=eq.seo_navbat`, { method: 'PATCH', body: JSON.stringify({ holat: 'seo_ish' }) }).catch(() => []);
  if (!claim || !claim.length) return;
  const p = d.payload;
  try {
    if (!env.UPLOADS || !env.DB) throw new Error('R2 (UPLOADS) yoki D1 (DB) ulanmagan');
    const urls = [];
    for (let i = 0; i < p.rasmlar.length; i++) {
      const u8 = await tgFayl(env, p.rasmlar[i]); const t = tur(u8); if (!t) throw new Error(`${i + 1}-rasm formati qo'llanmaydi (JPG/PNG/WebP)`);
      const key = `uploads/${Date.now()}-${crypto.randomUUID()}.${t[0]}`;
      await env.UPLOADS.put(key, u8, { httpMetadata: { contentType: t[1] } });
      urls.push(env.R2_PUBLIC_BASE ? `${env.R2_PUBLIC_BASE.replace(/\/$/, '')}/${key}` : `/r2/${key}`);
    }
    const m = p.matn, j = p.j, alts = {};
    urls.forEach((u, i) => { alts[u] = (m.alts && m.alts[i]) || { uz: m.title_uz, ru: m.title_ru }; });
    const v = buildValues({ category: j.category || 'interior', status: j.status || 'render', title_uz: m.title_uz, title_ru: m.title_ru, type_uz: m.type_uz, type_ru: m.type_ru, desc_uz: m.desc_uz, desc_ru: m.desc_ru, task_uz: m.task_uz, task_ru: m.task_ru, style_uz: m.style_uz || j.uslub, style_ru: m.style_ru, location_uz: m.location_uz || j.joy, location_ru: m.location_ru, duration_uz: m.duration_uz || j.muddat, duration_ru: m.duration_ru, thumb_url: urls[0], hero_url: urls[0], gallery_urls: urls.slice(1), area_m2: j.maydon, year: j.yil, alts });
    v.slug = await ensureUniqueSlug(env, slugifyUz(v.title_uz), 'slug', null);
    v.slug_ru = await ensureUniqueSlug(env, slugifyRu(v.title_ru), 'slug_ru', null);
    const cols = Object.keys(v);
    const res = await env.DB.prepare(`INSERT INTO projects (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).bind(...cols.map((c) => v[c])).run();
    const link = `${SAYT}/loyihalar/${v.slug}`, linkRu = `${SAYT}/ru/proekty/${v.slug_ru}`;
    await indexNow(env, [link, linkRu, `${SAYT}/`]);
    await upd(env, d.id, 'seo_tayyor', { ...p, rasmlar: p.rasmlar.length, loyiha_id: res.meta.last_row_id, slug: v.slug });
    await say(env, p.chatId, `✅ <b>Saytga joylandi</b>\n${esc(m.title_uz)}\n\n🔗 ${link}\n🔗 ${linkRu}\n\nYandex/Bing'ga yangi sahifa haqida xabar berildi (IndexNow). Google sitemap orqali o'zi oladi.`);
  } catch (e) {
    await upd(env, d.id, 'seo_xato', p).catch(() => {});
    await say(env, p.chatId, `⚠️ Saytga joylashda xato: ${esc(e.message)}\nRasmlar saqlanib turibdi; /seo orqali qayta yuborishingiz mumkin.`);
  }
}

async function indexNow(env, urls) {
  const body = { host: 'visartdesign.uz', key: INDEXNOW_KEY, keyLocation: `${SAYT}/${INDEXNOW_KEY}.txt`, urlList: urls };
  for (const ep of ['https://api.indexnow.org/indexnow', 'https://yandex.com/indexnow']) {
    await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) }).catch(() => {});
  }
}

// ── Domen muddati ──
async function domenRow(env) {
  const r = await sb(env, 'nashr_navbati?turi=eq.domen_holat&limit=1&select=id,payload').catch(() => []);
  return r && r[0] ? r[0] : null;
}
const kunQoldi = (s) => Math.ceil((new Date(s + 'T23:59:59+05:00').getTime() - Date.now()) / 86400e3);
export async function domenSet(env, chatId, sana) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sana) || isNaN(new Date(sana))) return say(env, chatId, "Sana formati: <code>/domen 2027-03-15</code> (YYYY-MM-DD).");
  const row = await domenRow(env);
  const payload = { tugash: sana, xabar: [] };
  if (row) await sb(env, `nashr_navbati?id=eq.${row.id}`, { method: 'PATCH', body: JSON.stringify({ payload }) });
  else await sb(env, 'nashr_navbati', { method: 'POST', body: JSON.stringify([{ turi: 'domen_holat', holat: 'domen', nashr_vaqti: new Date().toISOString(), payload }]) });
  return say(env, chatId, `✅ Domen <b>visartdesign.uz</b> tugash sanasi saqlandi: <b>${sana}</b> (${kunQoldi(sana)} kun qoldi). 60, 30, 14, 7, 3, 2 va 1 kun qolganda ogohlantiraman.`);
}
export async function domenKorsat(env, chatId) {
  const row = await domenRow(env);
  if (!row || !row.payload.tugash) return say(env, chatId, "🌐 Domen tugash sanasi hali kiritilmagan. Domen sotib olingan kabinetdan (UZINFOCOM/registrator) sanani ko'rib, yozing:\n<code>/domen 2027-03-15</code>");
  const k = kunQoldi(row.payload.tugash);
  return say(env, chatId, `🌐 <b>visartdesign.uz</b>\nTugash: <b>${row.payload.tugash}</b> — ${k >= 0 ? k + ' kun qoldi' : '<b>MUDDATI O\'TGAN</b>'}`);
}
export async function domenNazorat(env) {
  const row = await domenRow(env); const admin = String(env.ADMIN_TELEGRAM_IDS || '').split(',')[0].trim(); if (!admin) return;
  if (!row || !row.payload.tugash) { const n = new Date(); if (n.getUTCDay() === 1) await say(env, admin, "🌐 Domen tugash sanasi kiritilmagan, shuning uchun uni kuzata olmayman. Sanani yozing: <code>/domen 2027-03-15</code>"); return; }
  const k = kunQoldi(row.payload.tugash), sent = row.payload.xabar || [];
  const eshik = [60, 30, 14, 7, 3, 2, 1, 0].find((e) => k <= e && !sent.includes(e));
  if (eshik === undefined) return;
  const eski = k < 0;
  await say(env, admin, `${k <= 7 ? '🚨' : '⚠️'} <b>Domen muddati!</b> visartdesign.uz ${eski ? "muddati O'TGAN" : k + ' kundan keyin tugaydi'} (${row.payload.tugash}).\nSayt va bot ishlashi uchun domenni hoziroq uzaytiring. Uzaytirgach yangi sanani yozing: <code>/domen YYYY-MM-DD</code>`);
  await sb(env, `nashr_navbati?id=eq.${row.id}`, { method: 'PATCH', body: JSON.stringify({ payload: { ...row.payload, xabar: [...sent, ...[60, 30, 14, 7, 3, 2, 1, 0].filter((e) => e >= eshik && !sent.includes(e))] } }) });
}

// ── Haftalik SEO audit (dushanba) ──
export async function seoAudit(env) {
  const admin = String(env.ADMIN_TELEGRAM_IDS || '').split(',')[0].trim(); if (!admin || !env.DB) return;
  const rows = ((await env.DB.prepare('SELECT id,title_uz,title_ru,desc_uz,desc_ru,slug,slug_ru,gallery_urls,alts_json FROM projects').all()).results) || [];
  const muammo = [];
  let altYoq = 0, tavsifYoq = 0, ruYoq = 0, slugYoq = 0;
  for (const r of rows) {
    let g = []; try { g = JSON.parse(r.gallery_urls || '[]'); } catch {} let a = {}; try { a = JSON.parse(r.alts_json || '{}'); } catch {}
    if (Object.keys(a).length < g.length + 1) altYoq++;
    if (!r.desc_uz || r.desc_uz.length < 200) tavsifYoq++;
    if (!r.title_ru || !r.desc_ru) ruYoq++;
    if (!r.slug || !r.slug_ru) slugYoq++;
  }
  const tek = async (u) => fetch(u, { signal: AbortSignal.timeout(8000) }).then((x) => x.status).catch(() => 0);
  const [sm, rb, bosh] = await Promise.all([tek(`${SAYT}/sitemap.xml`), tek(`${SAYT}/robots.txt`), tek(`${SAYT}/`)]);
  if (sm !== 200) muammo.push(`sitemap.xml: ${sm}`); if (rb !== 200) muammo.push(`robots.txt: ${rb}`); if (bosh !== 200) muammo.push(`bosh sahifa: ${bosh}`);
  const q = [];
  if (altYoq) q.push(`${altYoq} ta loyihada alt matn to'liq emas`); if (tavsifYoq) q.push(`${tavsifYoq} ta loyiha tavsifi qisqa (<200 belgi)`); if (ruYoq) q.push(`${ruYoq} ta loyihada ruscha matn yo'q`); if (slugYoq) q.push(`${slugYoq} ta loyihada URL nomi yo'q`);
  await say(env, admin, `🔎 <b>Haftalik SEO hisoboti</b>\nSaytda ${rows.length} ta loyiha.\n${muammo.length ? '🔴 ' + muammo.join('; ') + '\n' : '🟢 sitemap, robots va bosh sahifa ishlayapti\n'}${q.length ? '• ' + q.join('\n• ') : '🟢 loyiha matnlari to\'liq'}\n\nYangi loyiha qo'shish: /seo`);
}
