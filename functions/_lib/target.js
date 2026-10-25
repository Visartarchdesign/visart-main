// Targetolog agent: taklif (Claude) -> egasi tasdiqlaydi (Telegram) -> Meta'da PAUSED yaratadi -> egasi "Yoqish" bosadi
// -> kunlik nazorat/tanqidiy hisobot. Pul faqat tasdiq bilan; byudjetni o'zi hech qachon oshirmaydi.
// Env: META_AD_ACCOUNT_ID (raqam, "act_" shart emas), META_ADS_TOKEN (yo'q bo'lsa INSTAGRAM_ACCESS_TOKEN; ads_management ruxsati kerak),
//      TARGET_MAKS_KUNLIK (USD, standart 30), TARGET_LINK (standart https://t.me/visart_design_bot?start=reklama)
// Holatlar (nashr_navbati.turi='target'): tasdiq_kutilmoqda -> target_tayyor -> target_faol <-> target_pauza; bekor
import { bilimMatn } from './targetBilim.js';
import { menejerIdlari } from './botAvto.js';
import { mediaChaqir } from './media.js';

const G = 'https://graph.facebook.com/v21.0';
const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const OFFSET = { USD: 100, EUR: 100 };

const tok = (env) => env.META_ADS_TOKEN || env.INSTAGRAM_ACCESS_TOKEN;
const acc = (env) => `act_${String(env.META_AD_ACCOUNT_ID || '').replace(/^act_/, '')}`;
export const targetSozlangan = (env) => !!(env.META_AD_ACCOUNT_ID && tok(env));

async function sb(env, path, init = {}) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: init.prefer || 'return=representation' }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`sb ${path} ${r.status}`);
  const x = await r.text();
  return x ? JSON.parse(x) : null;
}
async function tg(env, chat_id, text, reply_markup) {
  const r = await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text: text.slice(0, 3900), parse_mode: 'HTML', disable_web_page_preview: true, ...(reply_markup ? { reply_markup } : {}) }), signal: AbortSignal.timeout(10000) }).catch(() => null);
  return r;
}
async function meta(env, method, path, params = {}) {
  const url = new URL(`${G}/${path}`);
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (method === 'GET') url.searchParams.set(k, val); else body.set(k, val);
  }
  url.searchParams.set('access_token', tok(env));
  const r = await fetch(url.toString(), { method, ...(method === 'GET' ? {} : { body }), signal: AbortSignal.timeout(25000) });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d || d.error) throw new Error(`Meta: ${(d && d.error && (d.error.error_user_msg || d.error.message)) || r.status}`);
  return d;
}
const offset = (env, cur) => OFFSET[cur] || Number(env.META_OFFSET) || null;
const maksKunlik = (env) => Number(env.TARGET_MAKS_KUNLIK) || 30;

async function claude(env, system, user, maxTokens = 1800, prefill = '') {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }, ...(prefill ? [{ role: 'assistant', content: prefill }] : [])] }), signal: AbortSignal.timeout(50000),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const d = await res.json();
  return (prefill + (((d.content || []).find((x) => x.type === 'text') || {}).text || '')).trim();
}
const jsonAjrat = (t) => { const m = t.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; };

// ── Menyu ──
export async function targetMenyu(env, chatId) {
  let holat = '';
  if (!targetSozlangan(env)) holat = "⚠️ Meta reklama hisobi ulanmagan: Cloudflare env'ga <code>META_AD_ACCOUNT_ID</code> (va ads_management ruxsatli token) kerak. Taklif va hisobotlarni baribir ko'rishingiz mumkin, lekin kampaniya yaratib bo'lmaydi.";
  else {
    try { const a = await meta(env, 'GET', acc(env), { fields: 'name,currency,account_status,amount_spent' }); holat = `✅ Hisob: <b>${esc(a.name)}</b> | valyuta: ${esc(a.currency)}${offset(env, a.currency) ? '' : ' ⚠️ (valyuta birligi noma\'lum -- META_OFFSET kerak)'}`; }
    catch (e) { holat = `⚠️ Meta hisobiga ulanib bo'lmadi: ${esc(e.message)}`; }
  }
  await tg(env, chatId, `🎯 <b>Targetolog agent</b>\n${holat}\n\nPul faqat sizning tasdig'ingiz bilan sarflanadi.`, { inline_keyboard: [[{ text: '🆕 Yangi taklif', callback_data: 'tg:nw' }], [{ text: '🎬 Reklama videosi', callback_data: 'tg:vd' }], [{ text: '📋 Kampaniyalar', callback_data: 'tg:ls' }, { text: '📊 Hisobot', callback_data: 'tg:rp' }]] });
}

// ── Eng yaxshi organik post (kreativ uchun) ──
async function engYaxshiPost(env) {
  if (!env.INSTAGRAM_BUSINESS_ACCOUNT_ID) return null;
  const d = await meta(env, 'GET', `${env.INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`, { fields: 'id,media_type,thumbnail_url,media_url,caption,like_count,comments_count,permalink,timestamp', limit: 30 }).catch(() => null);
  const list = ((d && d.data) || []).filter((m) => m.thumbnail_url || m.media_url);
  list.sort((a, b) => (b.like_count || 0) + 3 * (b.comments_count || 0) - ((a.like_count || 0) + 3 * (a.comments_count || 0)));
  return list.slice(0, 5);
}

// ── Taklif ──
export async function targetTaklif(env, chatId) {
  if (!env.ANTHROPIC_API_KEY) return tg(env, chatId, "⚠️ ANTHROPIC_API_KEY yo'q -- taklif tuzib bo'lmaydi.");
  await tg(env, chatId, '🧠 Tahlil qilinmoqda (bilim + oldingi natijalar + eng yaxshi postlar)...');
  const [oldin, postlar] = await Promise.all([
    sb(env, "nashr_navbati?turi=eq.target&holat=neq.bekor&select=payload,holat&order=id.desc&limit=5").catch(() => []),
    engYaxshiPost(env).catch(() => null),
  ]);
  const tarix = (oldin || []).map((o) => ({ holat: o.holat, nom: o.payload && o.payload.taklif && o.payload.taklif.nom, natija: o.payload && o.payload.oxirgi_natija })).slice(0, 5);
  const sys = `Sen Visart Design'ning senior targetologi va marketologisan. Tanqidiy, raqamlarga tayanadigan, bo'rttirmaydigan. Bilimlar:\n${bilimMatn()}\nFaqat JSON qaytar.`;
  const user = `Maqsad: Toshkentda arxitektura/interyer loyiha mijozlaridan sifatli lid olish (Telegram bot orqali). Oldingi kampaniyalar: ${JSON.stringify(tarix)}. Organik eng yaxshi postlar (kreativ nomzodlari): ${JSON.stringify((postlar || []).map((p) => ({ id: p.id, tur: p.media_type, like: p.like_count, izoh: p.comments_count, matn: (p.caption || '').slice(0, 120) })))}.
JSON sxema: {"nom":str,"maqsad":str,"auditoriya":{"yosh_min":int,"yosh_max":int,"jins":"all|1|2","qiziqishlar":[str,str,str,str]},"post_id":str|null,"matn":str(<=125 belgi, o'zbekcha),"sarlavha":str(<=40),"variantlar":[{"kun_usd":num,"kunlar":int}] (aynan 3 ta, o'sib boruvchi, kun_usd 3..${maksKunlik(env)}),"kutilgan":{"ctr_pct":str,"klik_narxi_usd":str,"lid_oraliq":str},"xavflar":[str],"tanqid":str(o'z taklifingdagi eng zaif joy va uni qanday tekshirish)}`;
  let t, xom = '';
  try { xom = await claude(env, sys, user, 3000, '{'); t = jsonAjrat(xom); } catch (e) { return tg(env, chatId, `⚠️ Taklif xato: ${esc(e.message)}\n${esc(xom.slice(0, 200))}`); }
  if (!t) return tg(env, chatId, `⚠️ Taklif formati noto'g'ri (JSON topilmadi), qayta urinib ko'ring.\n${esc(xom.slice(0, 200))}`);
  if (!Array.isArray(t.variantlar) || !t.variantlar.length) {
    const arr = Object.values(t).find((x) => Array.isArray(x) && x.some((y) => y && y.kun_usd != null));
    t.variantlar = arr || [{ kun_usd: 5, kunlar: 7 }, { kun_usd: 10, kunlar: 7 }, { kun_usd: 20, kunlar: 7 }];
  }
  t.auditoriya = t.auditoriya || {}; t.nom = t.nom || 'Visart reklama'; t.matn = t.matn || ''; t.sarlavha = t.sarlavha || t.nom;
  t.auditoriya.yosh_min = Number(t.auditoriya.yosh_min) || 28; t.auditoriya.yosh_max = Number(t.auditoriya.yosh_max) || 55; t.auditoriya.qiziqishlar = t.auditoriya.qiziqishlar || ['Interior design', 'Home improvement', 'Renovation'];
  t.variantlar = t.variantlar.slice(0, 3).map((v) => ({ kun_usd: Math.min(Math.max(Number(v.kun_usd) || 5, 3), maksKunlik(env)), kunlar: Math.min(Math.max(Number(v.kunlar) || 7, 3), 30) }));
  const post = (postlar || []).find((p) => p.id === t.post_id) || (postlar || [])[0] || null;
  const row = await sb(env, 'nashr_navbati', { method: 'POST', body: JSON.stringify([{ turi: 'target', holat: 'tasdiq_kutilmoqda', nashr_vaqti: new Date().toISOString(), payload: { taklif: t, post: post ? { id: post.id, rasm: post.thumbnail_url || post.media_url, link: post.permalink } : null, chatId } }]) });
  const id = row[0].id;
  const a = t.auditoriya || {};
  const matn = `🎯 <b>${esc(t.nom)}</b>\n${esc(t.maqsad)}\n\n👥 Toshkent, ${a.yosh_min}-${a.yosh_max} yosh, ${esc(a.jins === '1' ? 'erkak' : a.jins === '2' ? 'ayol' : 'hamma')}\n🔎 Qiziqish: ${esc((a.qiziqishlar || []).join(', '))}\n\n📝 "${esc(t.sarlavha)}" — ${esc(t.matn)}\n🖼 Kreativ: ${post ? `<a href="${esc(post.permalink)}">eng yaxshi organik post</a>` : "post topilmadi (Instagram ulanmagan)"}\n\n📈 Kutilgan (taxmin): CTR ${esc((t.kutilgan || {}).ctr_pct)}, klik ${esc((t.kutilgan || {}).klik_narxi_usd)}, lid ${esc((t.kutilgan || {}).lid_oraliq)}\n⚠️ Xavflar: ${esc((t.xavflar || []).join('; '))}\n🧐 Tanqid: ${esc(t.tanqid)}\n\n💵 Byudjetni tanlang (hech narsa yoqilmaydi, avval PAUSED yaratiladi):`;
  await tg(env, chatId, matn, { inline_keyboard: [...t.variantlar.map((v, i) => [{ text: `${v.kun_usd}$/kun × ${v.kunlar} kun = ${v.kun_usd * v.kunlar}$`, callback_data: `tg:ok:${id}:${i}` }]), [{ text: '🎬 Reklama videosi (senarist+montajchi)', callback_data: 'tg:vd' }], [{ text: '❌ Bekor', callback_data: `tg:x:${id}` }]] });
}

// ── Tasdiq -> Meta'da PAUSED yaratish ──
async function geoVaQiziqish(env, qiz) {
  const city = await meta(env, 'GET', 'search', { type: 'adgeolocation', q: 'Tashkent', location_types: ['city'], country_code: 'UZ', limit: 1 }).catch(() => null);
  const ints = [];
  for (const q of (qiz || []).slice(0, 5)) {
    const r = await meta(env, 'GET', 'search', { type: 'adinterest', q, limit: 1 }).catch(() => null);
    if (r && r.data && r.data[0]) ints.push({ id: r.data[0].id, name: r.data[0].name });
  }
  return { city: city && city.data && city.data[0], ints };
}

export async function targetTasdiq(env, chatId, id, i) {
  const rows = await sb(env, `nashr_navbati?id=eq.${id}&turi=eq.target&select=*`).catch(() => []);
  const q = rows && rows[0];
  if (!q || q.holat !== 'tasdiq_kutilmoqda') return tg(env, chatId, 'ℹ️ Bu taklif allaqachon ishlangan yoki topilmadi.');
  if (!targetSozlangan(env)) return tg(env, chatId, "⚠️ Meta hisobi ulanmagan (META_AD_ACCOUNT_ID). Taklif saqlandi, ulangach qayta bosing.");
  const t = q.payload.taklif, v = t.variantlar[Number(i)] || t.variantlar[0];
  if (v.kun_usd > maksKunlik(env)) return tg(env, chatId, `⛔ Kunlik limit ${maksKunlik(env)}$ dan oshmaydi.`);
  await sb(env, `nashr_navbati?id=eq.${id}&holat=eq.tasdiq_kutilmoqda`, { method: 'PATCH', body: JSON.stringify({ holat: 'bajarilmoqda' }) });
  try {
    const a = await meta(env, 'GET', acc(env), { fields: 'currency' });
    const off = offset(env, a.currency);
    if (!off) throw new Error(`valyuta ${a.currency}: META_OFFSET sozlanmagan`);
    if (a.currency !== 'USD') throw new Error(`hisob valyutasi ${a.currency}, byudjet USD'da hisoblangan -- avval USD hisob yoki konvertatsiya sozlansin`);
    const { city, ints } = await geoVaQiziqish(env, t.auditoriya.qiziqishlar);
    if (!city) throw new Error('Toshkent geolokatsiyasi topilmadi');
    const au = t.auditoriya;
    const camp = await meta(env, 'POST', `${acc(env)}/campaigns`, { name: `Visart | ${t.nom}`, objective: 'OUTCOME_TRAFFIC', status: 'PAUSED', special_ad_categories: [], buying_type: 'AUCTION' });
    const bosh = new Date(Date.now() + 3600e3), tugash = new Date(bosh.getTime() + v.kunlar * 864e5);
    const adset = await meta(env, 'POST', `${acc(env)}/adsets`, {
      name: `Toshkent ${au.yosh_min}-${au.yosh_max}`, campaign_id: camp.id, daily_budget: Math.round(v.kun_usd * off), billing_event: 'IMPRESSIONS', optimization_goal: 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP', start_time: bosh.toISOString(), end_time: tugash.toISOString(), status: 'PAUSED',
      targeting: { geo_locations: { cities: [{ key: city.key, radius: 20, distance_unit: 'kilometer' }] }, age_min: au.yosh_min, age_max: au.yosh_max, ...(au.jins === '1' || au.jins === '2' ? { genders: [Number(au.jins)] } : {}), ...(ints.length ? { flexible_spec: [{ interests: ints }] } : {}), publisher_platforms: ['instagram', 'facebook'] },
    });
    const link = env.TARGET_LINK || 'https://t.me/visart_design_bot?start=reklama';
    const link_data = { link, message: t.matn, name: t.sarlavha, call_to_action: { type: 'LEARN_MORE', value: { link } }, ...(q.payload.post && q.payload.post.rasm ? { picture: q.payload.post.rasm } : {}) };
    const creative = await meta(env, 'POST', `${acc(env)}/adcreatives`, { name: `Kreativ ${t.nom}`, object_story_spec: { page_id: env.FACEBOOK_PAGE_ID, link_data } });
    const ad = await meta(env, 'POST', `${acc(env)}/ads`, { name: `Reklama ${t.nom}`, adset_id: adset.id, creative: { creative_id: creative.id }, status: 'PAUSED' });
    await sb(env, `nashr_navbati?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ holat: 'target_tayyor', payload: { ...q.payload, tanlov: v, meta: { campaign: camp.id, adset: adset.id, ad: ad.id }, yaratildi: new Date().toISOString() } }) });
    await tg(env, chatId, `✅ Kampaniya Meta'da <b>PAUSED</b> holatda yaratildi (hali pul sarflanmaydi).\nByudjet: ${v.kun_usd}$/kun × ${v.kunlar} kun = <b>maks ${v.kun_usd * v.kunlar}$</b>.\nMeta reklama tekshiruvi (review) biroz vaqt olishi mumkin.\n\nYoqaymi?`, { inline_keyboard: [[{ text: `▶️ Yoqish (maks ${v.kun_usd * v.kunlar}$)`, callback_data: `tg:on:${id}` }], [{ text: '🗑 O\'chirish', callback_data: `tg:x:${id}` }]] });
  } catch (e) {
    await sb(env, `nashr_navbati?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ holat: 'tasdiq_kutilmoqda', xato_matni: String(e.message).slice(0, 300) }) }).catch(() => {});
    await tg(env, chatId, `⚠️ Yaratishda xato: ${esc(e.message)}\nTaklif saqlandi; muammo hal bo'lgach byudjet tugmasini qayta bosing. (Meta'da yarim yaratilgan PAUSED narsalar pul sarflamaydi.)`);
  }
}

async function holatQoy(env, m, status) { for (const id of [m.campaign, m.adset, m.ad]) await meta(env, 'POST', id, { status }); }

export async function targetYoq(env, chatId, id, yoq) {
  const rows = await sb(env, `nashr_navbati?id=eq.${id}&turi=eq.target&select=*`).catch(() => []);
  const q = rows && rows[0];
  if (!q || !q.payload.meta) return tg(env, chatId, 'ℹ️ Kampaniya topilmadi.');
  try {
    await holatQoy(env, q.payload.meta, yoq ? 'ACTIVE' : 'PAUSED');
    await sb(env, `nashr_navbati?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ holat: yoq ? 'target_faol' : 'target_pauza', payload: { ...q.payload, ...(yoq ? { yoqildi: new Date().toISOString() } : {}) } }) });
    await tg(env, chatId, yoq ? `▶️ Kampaniya yoqildi. Kunlik nazorat 09:00 da, o'rganish bosqichi 3-7 kun -- shu vaqtgacha o'zgartirmaymiz.` : '⏸ Kampaniya pauzada.', yoq ? { inline_keyboard: [[{ text: '⏸ Pauza', callback_data: `tg:off:${id}` }]] } : { inline_keyboard: [[{ text: '▶️ Yoqish', callback_data: `tg:on:${id}` }]] });
  } catch (e) { await tg(env, chatId, `⚠️ ${esc(e.message)}`); }
}

export async function targetBekor(env, chatId, id) {
  const rows = await sb(env, `nashr_navbati?id=eq.${id}&turi=eq.target&select=*`).catch(() => []);
  const q = rows && rows[0];
  if (q && q.payload.meta) await holatQoy(env, q.payload.meta, 'PAUSED').catch(() => {});
  await sb(env, `nashr_navbati?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ holat: 'bekor' }) }).catch(() => {});
  await tg(env, chatId, '❌ Bekor qilindi' + (q && q.payload.meta ? " (Meta'da pauza qilindi, kerak bo'lsa Ads Manager'dan o'chiring)" : '') + '.');
}

export async function targetRoyxat(env, chatId) {
  const rows = await sb(env, "nashr_navbati?turi=eq.target&holat=in.(tasdiq_kutilmoqda,target_tayyor,target_faol,target_pauza)&select=id,holat,payload&order=id.desc&limit=8").catch(() => []);
  if (!rows || !rows.length) return tg(env, chatId, 'Kampaniya yo\'q. /target -> Yangi taklif.');
  for (const r of rows) {
    const t = r.payload.taklif || {}, v = r.payload.tanlov;
    const kb = r.holat === 'target_faol' ? [[{ text: '⏸ Pauza', callback_data: `tg:off:${r.id}` }, { text: '📊 Hisobot', callback_data: `tg:rp:${r.id}` }]] : r.holat === 'tasdiq_kutilmoqda' ? [...(t.variantlar || []).map((v, i) => [{ text: `${v.kun_usd}$/kun × ${v.kunlar} kun = ${v.kun_usd * v.kunlar}$`, callback_data: `tg:ok:${r.id}:${i}` }]), [{ text: '❌ Bekor', callback_data: `tg:x:${r.id}` }]] : [[{ text: '▶️ Yoqish', callback_data: `tg:on:${r.id}` }, { text: '🗑', callback_data: `tg:x:${r.id}` }]];
    await tg(env, chatId, `#${r.id} <b>${esc(t.nom)}</b> — ${esc(r.holat)}${v ? ` | ${v.kun_usd}$/kun × ${v.kunlar}` : ''}`, { inline_keyboard: kb });
  }
}

// ── Insights / hisobot ──
async function insights(env, m, preset) {
  const d = await meta(env, 'GET', `${m.campaign}/insights`, { fields: 'spend,impressions,clicks,ctr,cpc,cpm,frequency', date_preset: preset });
  return (d.data && d.data[0]) || { spend: '0', impressions: '0', clicks: '0' };
}

export async function targetHisobot(env, chatId, id) {
  const rows = await sb(env, `nashr_navbati?turi=eq.target&holat=eq.target_faol${id ? `&id=eq.${id}` : ''}&select=*`).catch(() => []);
  if (!rows || !rows.length) return tg(env, chatId, 'Faol kampaniya yo\'q.');
  for (const q of rows) {
    try {
      const [t3, bugun] = await Promise.all([insights(env, q.payload.meta, 'last_7d'), insights(env, q.payload.meta, 'today')]);
      const kun = Math.floor((Date.now() - new Date(q.payload.yoqildi || q.payload.yaratildi).getTime()) / 864e5) + 1;
      const lid = await sb(env, `lidlar?created_at=gte.${encodeURIComponent(q.payload.yoqildi || q.payload.yaratildi)}&manba=eq.telegram_mijoz_bot&select=id`).catch(() => []);
      const raq = { kun, sarf_usd: t3.spend, kursatuv: t3.impressions, klik: t3.clicks, ctr: t3.ctr, cpc: t3.cpc, cpm: t3.cpm, chastota: t3.frequency, bugun_sarf: bugun.spend, lid_soni: (lid || []).length };
      let tahlil = '';
      try { tahlil = await claude(env, `Sen tanqidiy targetologsan. Qisqa (<=700 belgi), o'zbekcha, raqamga tayanib: holat, eng katta muammo, 1-2 aniq tavsiya. 7 kundan kam ma'lumotda "hali erta" de. Byudjetni oshirishni faqat egasi tasdig'i bilan taklif qil.\n${bilimMatn()}`, `Kampaniya: ${JSON.stringify(q.payload.taklif.nom)}, byudjet ${q.payload.tanlov.kun_usd}$/kun. Natija: ${JSON.stringify(raq)}`, 600); } catch { tahlil = '(tahlil qilib bo\'lmadi)'; }
      await sb(env, `nashr_navbati?id=eq.${q.id}`, { method: 'PATCH', body: JSON.stringify({ payload: { ...q.payload, oxirgi_natija: raq, oxirgi_hisobot: new Date().toISOString() } }) }).catch(() => {});
      await tg(env, chatId, `📊 <b>${esc(q.payload.taklif.nom)}</b> (${kun}-kun)\nSarf: ${esc(t3.spend)}$ | Ko'rsatuv: ${esc(t3.impressions)} | Klik: ${esc(t3.clicks)} | CTR: ${esc(Number(t3.ctr || 0).toFixed(2))}% | CPC: ${esc(Number(t3.cpc || 0).toFixed(2))}$ | Chastota: ${esc(Number(t3.frequency || 0).toFixed(1))}\nBotdagi barcha yangi lidlar (reklamadan ajratilmagan): <b>${raq.lid_soni}</b>\n\n🧐 ${esc(tahlil)}`, { inline_keyboard: [[{ text: '⏸ Pauza', callback_data: `tg:off:${q.id}` }, { text: '🆕 Yangi taklif', callback_data: 'tg:nw' }]] });
    } catch (e) { await tg(env, chatId, `⚠️ Hisobot xato (#${q.id}): ${esc(e.message)}`); }
  }
}

// ── Cron (har 15 daqiqada): xavfsizlik + 09:00 hisobot ──
export async function targetNazorat(env) {
  if (!targetSozlangan(env) || !env.SUPABASE_URL) return;
  const rows = await sb(env, 'nashr_navbati?turi=eq.target&holat=eq.target_faol&select=*').catch(() => []);
  if (!rows || !rows.length) return;
  const adminlar = menejerIdlari(env);
  const tosh = new Date(Date.now() + 5 * 3600e3);
  for (const q of rows) {
    try {
      const m = q.payload.meta, limit = q.payload.tanlov.kun_usd;
      const bugun = await insights(env, m, 'today');
      if (Number(bugun.spend) > limit * 1.3) {
        await holatQoy(env, m, 'PAUSED');
        await sb(env, `nashr_navbati?id=eq.${q.id}`, { method: 'PATCH', body: JSON.stringify({ holat: 'target_pauza' }) });
        for (const a of adminlar) await tg(env, a, `🛑 <b>${esc(q.payload.taklif.nom)}</b>: bugungi sarf ${esc(bugun.spend)}$ limitdan (${limit}$) 30% dan oshdi -- avtomatik PAUZA qilindi.`);
        continue;
      }
      const oxirgi = q.payload.oxirgi_hisobot ? new Date(q.payload.oxirgi_hisobot).getTime() : 0;
      if (tosh.getUTCHours() === 9 && Date.now() - oxirgi > 20 * 3600e3) for (const a of adminlar) await targetHisobot(env, a, q.id);
      if (q.payload.tanlov && q.payload.yoqildi && Date.now() > new Date(q.payload.yoqildi).getTime() + (q.payload.tanlov.kunlar + 1) * 864e5) {
        await sb(env, `nashr_navbati?id=eq.${q.id}`, { method: 'PATCH', body: JSON.stringify({ holat: 'target_tugadi' }) });
        for (const a of adminlar) await tg(env, a, `🏁 <b>${esc(q.payload.taklif.nom)}</b> muddati tugadi. Yakuniy hisobot va keyingi taklif uchun /target.`);
      }
    } catch { /* keyingi chaqiruvda */ }
  }
}

// ── Callback dispatcher ──
export async function targetCb(env, cq) {
  const chatId = cq.message.chat.id;
  const [, act, id, arg] = String(cq.data).split(':');
  await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/answerCallbackQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: cq.id }) }).catch(() => {});
  if (act === 'nw') return targetTaklif(env, chatId);
  if (act === 'vd') { await tg(env, chatId, '🎬 Senarist ishga tushdi: reklama uchun yangi reel senariysi tayyorlanadi, tasdiqlagach montajchi yig\'adi. Tayyor video kreativ sifatida taklifga qo\'shiladi.'); return mediaChaqir(env, '/reel-senariy', { adminChatId: chatId }, chatId).catch(() => {}); }
  if (act === 'ls') return targetRoyxat(env, chatId);
  if (act === 'rp') return targetHisobot(env, chatId, id || null);
  if (act === 'ok') return targetTasdiq(env, chatId, id, arg);
  if (act === 'on') return targetYoq(env, chatId, id, true);
  if (act === 'off') return targetYoq(env, chatId, id, false);
  if (act === 'x') return targetBekor(env, chatId, id);
}
