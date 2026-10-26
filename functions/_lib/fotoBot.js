// Foto ko'prigi (bot tomoni): rasmlar navbatga yoziladi, kompyuterdagi ishchi (media-server/fotoIshchi.js) Yandex Business'ga yuklaydi.
// Holatlar (nashr_navbati.turi='foto_ish'): foto_navbat -> foto_bajar -> foto_tayyor | foto_xato.  Rejim: turi='foto_rejim' (holat 'foto_rejim').
const SAYT = 'https://visartdesign.uz';
export const TOIFALAR = { interior: 'Ichki ko\'rinish', exterior: 'Tashqi ko\'rinish', xizmat: 'Xizmatlar', kirish: 'Kirish eshigi', logo: 'Logotip' };
const HOLAT = { foto_navbat: '⏳ navbatda', foto_bajar: '⬆️ yuklanmoqda', foto_tayyor: '✅ yuborildi', foto_xato: '❌ xato' };

const sb = async (env, path, init = {}) => {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`sb ${r.status}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
};
const say = (env, chat_id, text, kb) => fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(kb ? { reply_markup: kb } : {}) }), signal: AbortSignal.timeout(10000) });
const ans = (env, id) => fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/answerCallbackQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: id }) }).catch(() => {});

export async function fotoMenu(env, chatId) {
  const rows = Object.entries(TOIFALAR).map(([k, v]) => [{ text: `📤 ${v}`, callback_data: `fg:r:${k}` }]);
  rows.push([{ text: '🌐 Saytdagi 10 ta eng yangi loyiha → Yandex', callback_data: 'fg:sayt' }]);
  rows.push([{ text: '📊 Holat', callback_data: 'fg:h' }]);
  await say(env, chatId, '📸 <b>Foto ko\'prigi</b> (Yandex Business)\nToifani tanlang, so\'ng rasmlarni <b>«Fayl»</b> qilib yuboring. Har biri navbatga tushadi, kompyuter yuklaydi va natijani shu yerga yozadi.', { inline_keyboard: rows });
}

export async function fotoRejim(env, chatId, toifa) {
  if (!TOIFALAR[toifa]) return;
  const eski = await sb(env, `nashr_navbati?turi=eq.foto_rejim&payload->>chatId=eq.${chatId}&select=id&limit=1`).catch(() => []);
  const payload = { chatId, toifa, ts: Date.now() };
  if (eski && eski[0]) await sb(env, `nashr_navbati?id=eq.${eski[0].id}`, { method: 'PATCH', body: JSON.stringify({ payload }) });
  else await sb(env, 'nashr_navbati', { method: 'POST', body: JSON.stringify([{ turi: 'foto_rejim', holat: 'foto_rejim', nashr_vaqti: new Date().toISOString(), payload }]) });
  await say(env, chatId, `📤 <b>${TOIFALAR[toifa]}</b> toifasi. Rasmlarni yuboring (60 daqiqa ichida). Tugagach: /foto`);
}

async function navbatga(env, payload) {
  const r = await sb(env, 'nashr_navbati', { method: 'POST', body: JSON.stringify([{ turi: 'foto_ish', holat: 'foto_navbat', nashr_vaqti: new Date().toISOString(), payload }]) });
  return r && r[0] && r[0].id;
}

// Admin shaxsiy chatda rasm yubordi: rejim yoqilgan bo'lsa navbatga yoziladi.
export async function fotoMedia(env, msg) {
  const chatId = msg.chat.id;
  const m = await sb(env, `nashr_navbati?turi=eq.foto_rejim&payload->>chatId=eq.${chatId}&select=payload&limit=1`).catch(() => []);
  const p = m && m[0] && m[0].payload;
  if (!p || Date.now() - p.ts > 60 * 60e3) return false;
  const fid = msg.photo ? msg.photo[msg.photo.length - 1].file_id : (msg.document && /^image\//.test(msg.document.mime_type || '') ? msg.document.file_id : null);
  if (!fid) return false;
  const id = await navbatga(env, { chatId, fileId: fid, toifa: p.toifa, manba: 'telegram' });
  await say(env, chatId, `📥 #${id} navbatga qo'shildi (${TOIFALAR[p.toifa]}). Holat: /foto → 📊`);
  return true;
}

export async function fotoSayt(env, chatId) {
  const r = await env.DB.prepare('SELECT hero_url, thumb_url, title_uz FROM projects ORDER BY id DESC LIMIT 10').all();
  const list = (r && r.results) || [];
  if (!list.length) return say(env, chatId, 'Saytda loyiha topilmadi.');
  let n = 0;
  for (const x of list) {
    const u = x.hero_url || x.thumb_url; if (!u) continue;
    await navbatga(env, { chatId, url: /^https?:/.test(u) ? u : SAYT + (u.startsWith('/') ? u : '/' + u), toifa: 'interior', nom: x.title_uz || '', manba: 'sayt' }); n++;
  }
  await say(env, chatId, `🌐 ${n} ta loyiha rasmi navbatga qo'shildi (Ichki ko'rinish). Holat: /foto → 📊`);
}

export async function fotoHolat(env, chatId) {
  const r = await sb(env, 'nashr_navbati?turi=eq.foto_ish&select=id,holat,payload&order=id.desc&limit=12').catch(() => []);
  if (!r || !r.length) return say(env, chatId, 'Navbat bo\'sh.');
  const sana = (x) => x.toLocaleString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' });
  const qator = r.map((x) => `#${x.id} ${HOLAT[x.holat] || x.holat} · ${TOIFALAR[x.payload.toifa] || x.payload.toifa}${x.payload.nom ? ' · ' + String(x.payload.nom).slice(0, 24) : ''}${x.holat === 'foto_xato' && x.payload.xato ? '\n   ↳ ' + String(x.payload.xato).slice(0, 90) : ''}`).join('\n');
  await say(env, chatId, `📊 <b>Foto navbati</b> (oxirgi ${r.length}, ${sana(new Date())})\n${qator}\n\nXato bo'lsa: /foto_qayta`, { inline_keyboard: [[{ text: '🔄 Yangilash', callback_data: 'fg:h' }]] });
}

export async function fotoQayta(env, chatId) {
  const r = await sb(env, 'nashr_navbati?turi=eq.foto_ish&holat=eq.foto_xato&select=id,payload', {}).catch(() => []);
  for (const x of r || []) await sb(env, `nashr_navbati?id=eq.${x.id}`, { method: 'PATCH', body: JSON.stringify({ holat: 'foto_navbat', payload: { ...x.payload, xato: null } }) });
  await say(env, chatId, `🔄 ${(r || []).length} ta xatoli rasm qayta navbatga qo'yildi.`);
}

export async function fotoCb(env, cq) {
  const chatId = cq.message.chat.id, p = String(cq.data).split(':');
  await ans(env, cq.id);
  if (p[1] === 'r') return fotoRejim(env, chatId, p[2]);
  if (p[1] === 'sayt') return fotoSayt(env, chatId);
  return fotoHolat(env, chatId);
}
