// POST /api/ilova-admin — Telegram Mini App (admin ilova) API. Kirish: Telegram initData (HMAC) + ADMIN_TELEGRAM_IDS.
// Pul sarflaydigan amallar (target yoqish/byudjet) bu yerda YO'Q -- ular faqat botda tasdiqlanadi.
import { mediaChaqir, animatsiyaBuyurtma } from '../_lib/media.js';
import { normaKorsat, normaBelgila } from '../_lib/normaTasdiq.js';
import { seoHolatApp } from '../_lib/seoAgent.js';
import { direktorChat, direktorTarix, direktorYoz, vazifalarOchiq, vazifaTayyor } from '../_lib/direktor.js';

const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? new TextEncoder().encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
}
async function tekshir(env, initData) {
  const p = new URLSearchParams(initData || '');
  const hash = p.get('hash'); if (!hash) return null;
  p.delete('hash');
  const s = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const sir = await hmac('WebAppData', env.MIJOZ_BOT_TOKEN);
  if (hex(await hmac(sir, s)) !== hash) return null;
  if (Date.now() / 1000 - Number(p.get('auth_date') || 0) > 86400) return null;
  try { return JSON.parse(p.get('user')); } catch { return null; }
}
const sb = async (env, path, init = {}) => {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal', ...(init.headers || {}) }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`sb ${r.status}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
};
const q = (env, path) => sb(env, path, { headers: { Prefer: '' } }).catch(() => []);


const AGENTLAR = [
  { id: 'direktor', nom: 'Direktor', rol: 'Vazifalarni taqsimlaydi, natijani o\'zi xabar qiladi' },
  { id: 'senarist', nom: 'Senarist', rol: 'Reel va post senariylari' },
  { id: 'montajchi', nom: 'Montajchi', rol: 'Video montaj, subtitr, effektlar' },
  { id: 'smm', nom: 'SMM', rol: 'Nashr jadvali: Instagram, YouTube, Telegram, Facebook' },
  { id: 'targetolog', nom: 'Targetolog', rol: 'Reklama taklifi va nazorat' },
  { id: 'mijoz', nom: 'Mijozlar menejeri', rol: 'Lidlar, obyektlar, guruhlar' },
  { id: 'seo', nom: 'SEO agenti', rol: 'Saytga loyiha, SEO, domen muddati' },
  { id: 'nazorat', nom: 'Nazoratchi', rol: 'Tizim salomatligi va xatolar' },
  { id: 'autocad', nom: 'AutoCAD', rol: 'Chizmalar holati (keyingi bosqich)', kutish: true },
  { id: 'max', nom: '3ds Max', rol: 'Vizualizatsiya ishlari (keyingi bosqich)', kutish: true },
];
async function agentHolat(env) {
  const t0 = new Date(Date.now() + 5 * 3600e3); t0.setUTCHours(0, 0, 0, 0);
  const bugun = new Date(t0.getTime() - 5 * 3600e3).toISOString();
  const kun = new Date(Date.now() - 864e5).toISOString();
  const [nv, tk, lid, xato, media, seoR, dom] = await Promise.all([
    q(env, 'nashr_navbati?select=turi,holat,created_at&order=id.desc&limit=120'),
    q(env, 'media_taklif?holat=eq.kutilmoqda&select=id,created_at&limit=50'),
    q(env, `lidlar?created_at=gte.${encodeURIComponent(bugun)}&select=id&limit=300`),
    q(env, `bot_xatolar?created_at=gte.${encodeURIComponent(kun)}&select=id&limit=300`),
    fetch(`${env.MEDIA_SERVER_URL}/health`, { signal: AbortSignal.timeout(4000) }).then((r) => r.ok).catch(() => false),
    q(env, 'nashr_navbati?turi=eq.seo_loyiha&holat=in.(seo_yig,seo_navbat,seo_ish,seo_xato)&select=holat&limit=50'),
    q(env, 'nashr_navbati?turi=eq.domen_holat&select=payload&limit=1'),
  ]);
  const c = (f) => nv.filter(f).length;
  const yangi = (x) => Date.now() - new Date(x.created_at).getTime() < 15 * 60e3;
  const H = {};
  const bj = c((r) => r.holat === 'bajarilmoqda');
  const tay = c((r) => r.turi === 'video_nashr' && r.holat === 'tasdiq_kutilmoqda');
  H.senarist = tk.some(yangi) ? { h: 'ishlayapti', i: 'Senariy tayyorlanmoqda' } : tk.length ? { h: 'kutmoqda', i: `${tk.length} ta senariy tasdiq kutmoqda` } : { h: 'dam', i: 'Yangi buyruq kutmoqda' };
  H.montajchi = !media ? { h: 'xato', i: 'Media-server (kompyuter) o\'chiq' } : bj ? { h: 'ishlayapti', i: 'Montaj ishlanmoqda' } : tay ? { h: 'kutmoqda', i: `${tay} ta tayyor video tasdiq kutmoqda` } : { h: 'dam', i: 'Hozir bo\'sh' };
  const kut = c((r) => r.holat === 'kutilmoqda' && ['video_ig_tg', 'facebook_photo', 'facebook_video', 'instagram_story'].includes(r.turi));
  H.smm = bj ? { h: 'ishlayapti', i: 'Joylanmoqda' } : kut ? { h: 'kutmoqda', i: `Jadvalda ${kut} ta nashr` } : { h: 'dam', i: 'Jadval bo\'sh' };
  const fa = c((r) => r.holat === 'target_faol'), ta = c((r) => r.turi === 'target' && ['tasdiq_kutilmoqda', 'target_tayyor'].includes(r.holat));
  H.targetolog = fa ? { h: 'ishlayapti', i: `${fa} ta faol kampaniya` } : ta ? { h: 'kutmoqda', i: `${ta} ta taklif tasdiq kutmoqda` } : { h: 'dam', i: 'Faol kampaniya yo\'q' };
  H.mijoz = lid.length ? { h: 'ishlayapti', i: `Bugun ${lid.length} ta lid` } : { h: 'dam', i: 'Bugun yangi lid yo\'q' };
  H.nazorat = !media ? { h: 'xato', i: 'Media-server javob bermayapti' } : xato.length > 20 ? { h: 'kutmoqda', i: `24 soatda ${xato.length} ta xato` } : { h: 'ishlayapti', i: 'Hammasi joyida' + (xato.length ? ` (${xato.length} ta kichik xato)` : '') };
  const sy = seoR.filter((r) => r.holat === 'seo_yig').length, sn = seoR.filter((r) => r.holat === 'seo_navbat').length, sx = seoR.filter((r) => r.holat === 'seo_xato').length;
  const dt = dom[0] && dom[0].payload && dom[0].payload.tugash; const dk = dt ? Math.ceil((new Date(dt + 'T23:59:59+05:00').getTime() - Date.now()) / 864e5) : null;
  const dtext = dk === null ? 'Domen sanasi kiritilmagan (/domen)' : `Domen: ${dk} kun qoldi`;
  H.seo = sx || (dk !== null && dk <= 14) ? { h: 'xato', i: sx ? 'Joylashda xato bor' : dtext } : seoR.some((r) => r.holat === 'seo_ish') ? { h: 'ishlayapti', i: 'Saytga yuklanmoqda' } : sy ? { h: 'kutmoqda', i: `${sy} ta loyiha ma'lumot kutmoqda` } : sn ? { h: 'kutmoqda', i: `${sn} ta loyiha jadvalda · ${dtext}` } : { h: 'dam', i: dtext };
  const vz = await vazifalarOchiq(env);
  const ishda = Object.values(H).filter((x) => x.h === 'ishlayapti').length;
  H.direktor = vz.length ? { h: 'kutmoqda', i: `${vz.length} ta ochiq vazifa nazoratda` } : ishda ? { h: 'ishlayapti', i: `${ishda} ta agent ishlayapti, nazorat qilyapman` } : { h: 'dam', i: "Vazifa kutmoqda — menga yozing" };
  H.autocad = { h: 'dam', i: 'Keyingi bosqichda ulanadi' };
  H.max = { h: 'dam', i: 'Keyingi bosqichda ulanadi' };
  return { media, agentlar: AGENTLAR.map((a) => ({ ...a, ...H[a.id] })) };
}
async function agentChat(env, agentId, text, holat) {
  if (!env.ANTHROPIC_API_KEY) return { javob: 'ANTHROPIC_API_KEY sozlanmagan.' };
  const a = AGENTLAR.find((x) => x.id === agentId) || AGENTLAR[0];
  const ctx = holat.agentlar.map((x) => `${x.nom}: ${x.h} — ${x.i}`).join('\n');
  const prompt = `Siz Visart Design (Toshkent, arxitektura va interyer studiyasi) agent kompaniyasining "${a.nom}" agentisiz (${a.rol}). Egasi (Doston) bilan gaplashyapsiz.\nJoriy holat:\n${ctx}\n\nQoidalar: qisqa (3-5 gap), aniq o'zbekcha javob; faqat yuqoridagi holatga tayaning, raqam o'ylab topmang; o'z vakolatingizdan tashqari savolga tegishli agentni ayting. Pul sarflash va joylashni o'zingiz bajarmaysiz — egasi tasdiqlaydi.\nEgasi bajarishni so'ragan bo'lsa "amal" maydoniga bittasini yozing: reel (yangi reel senariysi), animatsiya (yangi animatsiya), aks holda null.\nFAQAT JSON: {"javob":"...","amal":null}\n\nEgasi: ${text}`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 700, messages: [{ role: 'user', content: prompt }] }), signal: AbortSignal.timeout(40000) });
    if (!r.ok) return { javob: `Claude API xatosi (${r.status}).` };
    const d = await r.json();
    const raw = '' + (((d.content || []).find((x) => x.type === 'text') || {}).text || '');
    const m = raw.match(/\{[\s\S]*\}/);
    const j = m ? JSON.parse(m[0]) : null;
    return j && j.javob ? { javob: String(j.javob).slice(0, 1200), amal: ['reel', 'animatsiya'].includes(j.amal) ? j.amal : null } : { javob: raw.slice(0, 600) };
  } catch (e) { return { javob: 'Javob olinmadi, qayta urinib ko\'ring.' }; }
}

// Ilovadagi tasdiqlar botning o'sha callback/matn yo'llaridan o'tadi (bitta mantiq, ikki joy). Webhook'ga ichki chaqiruv; natija botga ham yoziladi.
const RUXSAT = /^(stak:\d+:(ok|no)|tg:(ok:\d+:\d|on:\d+|off:\d+|x:\d+)|ap:(ms)|tg:(nw|ls|rp(:\d+)?)|yg:(ok|no)|sg:(tk:(ha|boshqa|yoq)|done|more|go|ok|now|no|ed|o:\d+:-?\d+|n:[a-z0-9]+))$/;
function botYubor(env, request, waitUntil, adminId, tur, qiymat) {
  const uid = Date.now() * 100 + Math.floor(Math.random() * 100);
  const chat = { id: Number(adminId), type: 'private' }, from = { id: Number(adminId), is_bot: false, first_name: 'Admin' };
  const upd = tur === 'cb' ? { update_id: uid, callback_query: { id: 'app' + uid, from, message: { message_id: 1, chat, date: Math.floor(Date.now() / 1000) }, chat_instance: 'app', data: qiymat } } : { update_id: uid, message: { message_id: Math.floor(Date.now() / 1000), from, chat, date: Math.floor(Date.now() / 1000), text: qiymat } };
  const p = fetch(new URL('/api/mijoz-bot', request.url).href, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': env.MIJOZ_BOT_SECRET || '' }, body: JSON.stringify(upd), signal: AbortSignal.timeout(110000) }).catch(() => {});
  if (waitUntil) waitUntil(p);
}
const MATN_RUXSAT = /^\/(yangilik|holatlar|tuzat_tugma|foto_qayta|target|domen|muzlat [^\n]{1,60}|domen \d{4}-\d{2}-\d{2})$/;
const strip = (x) => String(x || '').replace(/<\/?[a-z][^>]*>/gi, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const isRootU = (env, id) => String(env.ROOT_ADMIN_IDS || '').split(',').map((x) => x.trim()).filter(Boolean).concat(String(env.ADMIN_TELEGRAM_IDS || '').split(',')[0].trim()).includes(String(id));
async function amallarOpen(env, a, b, u) {
  if (a === 'stat') {
    const d1 = new Date(Date.now() - 864e5).toISOString(), d7 = new Date(Date.now() - 7 * 864e5).toISOString();
    const [x, y] = await Promise.all([q(env, `lidlar?select=id&created_at=gte.${d1}`), q(env, `lidlar?select=id&created_at=gte.${d7}`)]);
    let s1 = 0, s7 = 0; try { s1 = ((await env.DB.prepare("SELECT COUNT(*) c FROM leads WHERE created_at >= datetime('now','-1 day')").first()) || {}).c || 0; s7 = ((await env.DB.prepare("SELECT COUNT(*) c FROM leads WHERE created_at >= datetime('now','-7 day')").first()) || {}).c || 0; } catch {}
    return { bot24: x.length, bot7: y.length, sayt24: s1, sayt7: s7 };
  }
  if (a === 'norma') { let t = '', kb = null; await normaKorsat(env, async (m, k) => { t = strip(m); kb = k; }); const id = kb && kb.inline_keyboard && kb.inline_keyboard[0] && /ap:nqa:(\d+)/.exec(kb.inline_keyboard[0][0].callback_data); return { matn: t, id: id ? id[1] : null }; }
  if (a === 'norma_belgila' && b.id) return { matn: await normaBelgila(env, String(b.id).replace(/\D/g, ''), !!b.ok) };
  if (a === 'guruhlar') {
    const [mg, ug, ob] = await Promise.all([q(env, 'visart_loyiha_guruhlar?select=obyekt_id,telegram_chat_id'), q(env, 'usta_guruhlar?select=obyekt_id,telegram_chat_id'), q(env, 'obyektlar?select=id,nom&limit=500')]);
    const onom = new Map(ob.map((o) => [String(o.id), o.nom || o.id]));
    const nom = async (id) => { try { const c = await (await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/getChat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: id }), signal: AbortSignal.timeout(4000) })).json(); return (c.result && (c.result.title || c.result.username)) || String(id); } catch { return String(id); } };
    const all = [...mg.map((x) => ({ ...x, r: 'Mijoz' })), ...ug.map((x) => ({ ...x, r: 'Usta' }))].slice(0, 30);
    const nomlar = await Promise.all(all.map((x) => nom(x.telegram_chat_id)));
    const mset = new Set(mg.map((x) => String(x.obyekt_id))), uset = new Set(ug.map((x) => String(x.obyekt_id)));
    return { guruhlar: all.map((x, i) => ({ gid: x.telegram_chat_id, rol: x.r, nom: nomlar[i], obyekt: onom.get(String(x.obyekt_id)) || x.obyekt_id })), ulanmagan: ob.filter((o) => !mset.has(String(o.id)) || !uset.has(String(o.id))).map((o) => ({ nom: o.nom || o.id, mijoz: mset.has(String(o.id)), usta: uset.has(String(o.id)) })) };
  }
  if (a === 'guruh_uz' && b.gid) { const g = String(b.gid).replace(/[^\d-]/g, ''); await sb(env, `visart_loyiha_guruhlar?telegram_chat_id=eq.${g}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {}); await sb(env, `usta_guruhlar?telegram_chat_id=eq.${g}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {}); return {}; }
  if (a === 'ulanishlar') return { rows: await q(env, 'obyektlar?select=id,nom,mijoz_ism,mijoz_tel&order=id.desc&limit=30') };
  if (a === 'ulanish_set' && b.id) { const tel = String(b.tel || '').replace(/\D/g, ''); if (tel.length < 9) throw new Error('Raqam noto\'g\'ri'); await sb(env, `obyektlar?id=eq.${encodeURIComponent(b.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ mijoz_tel: tel }) }); return {}; }
  if (a === 'ulanish_del' && b.id) { await sb(env, `obyektlar?id=eq.${encodeURIComponent(b.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ mijoz_tel: null }) }); return {}; }
  if (a === 'adminlar') { const r = await q(env, 'bot_adminlar?select=id,chat_id,ism&chat_id=not.is.null&order=id.asc'); return { root: isRootU(env, u.id), asosiy: String(env.ROOT_ADMIN_IDS || '').split(',').filter(Boolean).map((x) => x.trim()), rows: r }; }
  if (a === 'admin_del' && b.id) { if (!isRootU(env, u.id)) throw new Error('Faqat asosiy admin'); await sb(env, `bot_adminlar?id=eq.${Number(b.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); return {}; }
  if (a === 'admin_link') { if (!isRootU(env, u.id)) throw new Error('Faqat asosiy admin'); const tok = [...crypto.getRandomValues(new Uint8Array(12))].map((x) => 'abcdefghjkmnpqrstuvwxyz23456789'[x % 31]).join(''); await sb(env, 'bot_adminlar', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ token: tok, token_exp: new Date(Date.now() + 864e5).toISOString(), qoshdi: u.id }]) }); return { link: `https://t.me/visart_design_bot?start=adm_${tok}` }; }
  if (a === 'domen') { const r = await q(env, 'nashr_navbati?turi=eq.domen_holat&select=payload&limit=1'); const t = r[0] && r[0].payload && r[0].payload.tugash; return { tugash: t || null, qoldi: t ? Math.ceil((new Date(t + 'T23:59:59+05:00').getTime() - Date.now()) / 864e5) : null }; }
  return null;
}
async function tasdiqRoyxat(env, adminId) {
  const [sen, rek, vid, seo] = await Promise.all([
    q(env, 'media_taklif?holat=eq.kutilmoqda&select=id,sarlavha,post_matni,created_at&order=id.desc&limit=10'),
    q(env, 'nashr_navbati?turi=eq.target&holat=in.(tasdiq_kutilmoqda,target_tayyor,target_faol,target_pauza)&select=id,holat,payload&order=id.desc&limit=8'),
    q(env, 'nashr_navbati?turi=eq.video_nashr&holat=eq.tasdiq_kutilmoqda&select=id,payload,created_at&order=id.desc&limit=10'),
    seoHolatApp(env, Number(adminId)).catch(() => null),
  ]);
  return {
    senariy: sen.map((r) => ({ id: r.id, sarlavha: r.sarlavha || '', matn: String(r.post_matni || '').slice(0, 900) })),
    reklama: rek.map((r) => { const t = (r.payload && r.payload.taklif) || {}, v = r.payload && r.payload.tanlov; return { id: r.id, holat: r.holat, nom: t.nom || '', maqsad: t.maqsad || '', variantlar: (t.variantlar || []).map((x) => ({ kun: x.kun_usd, kunlar: x.kunlar })), tanlov: v ? { kun: v.kun_usd, kunlar: v.kunlar } : null }; }),
    video: vid.map((r) => ({ id: r.id, sarlavha: (r.payload && r.payload.sarlavha) || '', video: (r.payload && r.payload.video_url) || '' })),
    seo,
  };
}

export async function onRequestPost({ request, env, waitUntil }) {
  let b; try { b = await request.json(); } catch { return J({ ok: false }, 400); }
  const u = await tekshir(env, b.initData);
  const admins = String(env.ADMIN_TELEGRAM_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!u || !admins.includes(String(u.id))) return J({ ok: false, error: 'ruxsat' }, 403);

  const a = b.amal;
  if (a === 'agentlar') { const h = await agentHolat(env); return J({ ok: true, ...h }); }
  if (a === 'chat' && b.text) { const h = await agentHolat(env); return J({ ok: true, ...(await agentChat(env, b.agent, String(b.text).slice(0, 800), h)) }); }
  const AMAL = ['stat','norma','norma_belgila','guruhlar','guruh_uz','ulanishlar','ulanish_set','ulanish_del','adminlar','admin_del','admin_link','domen'];
  if (AMAL.includes(a)) { try { return J({ ok: true, ...(await amallarOpen(env, a, b, u)) }); } catch (e) { return J({ ok: false, error: String((e && e.message) || e).slice(0, 120) }); } }
  if (a === 'matn_buyruq' && MATN_RUXSAT.test(String(b.text || ''))) { botYubor(env, request, waitUntil, u.id, 'text', String(b.text)); return J({ ok: true }); }
  if (a === 'tasdiq') return J({ ok: true, ...(await tasdiqRoyxat(env, u.id)) });
  if (a === 'tasdiq_amal' && RUXSAT.test(String(b.cb || ''))) { botYubor(env, request, waitUntil, u.id, 'cb', String(b.cb)); return J({ ok: true }); }
  if (a === 'tasdiq_matn' && b.text) { botYubor(env, request, waitUntil, u.id, 'text', String(b.text).slice(0, 1500)); return J({ ok: true }); }
  if (a === 'dir_tarix') return J({ ok: true, rows: await direktorTarix(env) });
  if (a === 'dir_chat' && b.text) {
    const text = String(b.text).slice(0, 800); const h = await agentHolat(env);
    const r = await direktorChat(env, text, h);
    if (!r.xato) { await direktorYoz(env, 'u', text); await direktorYoz(env, 'd', r.javob, r.taklif && r.taklif.length ? r.taklif : null); }
    return J({ ok: true, ...r });
  }
  if (a === 'vazifalar') return J({ ok: true, rows: await vazifalarOchiq(env) });
  if (a === 'vazifa_tayyor' && b.id) { await vazifaTayyor(env, b.id); return J({ ok: true }); }
  if (a === 'reel') { const r = await mediaChaqir(env, '/reel-senariy', { adminChatId: u.id }, u.id); return J({ ok: !!(r && r.ok), sabab: r && r.sabab }); }
  if (a === 'animatsiya') { await animatsiyaBuyurtma(env, u.id); return J({ ok: true }); }
  if (a === 'bosh') {
    const t0 = new Date(Date.now() + 5 * 3600e3); t0.setUTCHours(0, 0, 0, 0);
    const bugun = new Date(t0.getTime() - 5 * 3600e3).toISOString();
    const media = await fetch(`${env.MEDIA_SERVER_URL}/health`, { signal: AbortSignal.timeout(4000) }).then((r) => r.ok).catch(() => false);
    const [navbat, tayyor, faol, taklif, lid, obyekt] = await Promise.all([
      q(env, 'nashr_navbati?holat=eq.kutilmoqda&turi=in.(video_ig_tg,facebook_photo,facebook_video,instagram_story)&select=id&limit=200'),
      q(env, 'nashr_navbati?turi=eq.video_nashr&holat=eq.tasdiq_kutilmoqda&select=id&limit=200'),
      q(env, 'nashr_navbati?turi=eq.target&holat=eq.target_faol&select=id'),
      q(env, 'nashr_navbati?turi=eq.target&holat=in.(tasdiq_kutilmoqda,target_tayyor)&select=id'),
      q(env, `lidlar?created_at=gte.${encodeURIComponent(bugun)}&select=id&limit=300`),
      q(env, 'obyektlar?select=id&limit=1000'),
    ]);
    const vaz = await vazifalarOchiq(env);
    const sen = await q(env, 'media_taklif?holat=eq.kutilmoqda&select=id&limit=50');
    return J({ ok: true, senariy: sen.length, vaz, media, navbat: navbat.length, tayyor: tayyor.length, faol: faol.length, taklif: taklif.length, lid: lid.length, obyekt: obyekt.length });
  }
  if (a === 'navbat') return J({ ok: true, rows: (await q(env, 'nashr_navbati?turi=neq.media_holat&turi=neq.target&select=id,turi,holat,nashr_vaqti,payload&order=id.desc&limit=40')).map((r) => ({ id: r.id, turi: r.turi, holat: r.holat, vaqt: r.nashr_vaqti, sarlavha: (r.payload && (r.payload.sarlavha || r.payload.matn || '')).toString().slice(0, 90) })) });
  if (a === 'tayyor') return J({ ok: true, rows: (await q(env, 'nashr_navbati?turi=eq.video_nashr&holat=eq.tasdiq_kutilmoqda&select=id,payload,created_at&order=id.desc&limit=20')).map((r) => ({ id: r.id, sarlavha: (r.payload && r.payload.sarlavha) || '', video: (r.payload && r.payload.video_url) || '', sana: String(r.created_at).slice(0, 10) })) });
  if (a === 'joylash' && b.id) { const r = await mediaChaqir(env, '/nashr', { id: String(b.id), adminChatId: u.id }, u.id); return J({ ok: !!(r && r.ok), sabab: r && r.sabab }); }
  if (a === 'bekor' && b.id) { await sb(env, `nashr_navbati?id=eq.${Number(b.id)}&turi=eq.video_nashr`, { method: 'PATCH', body: JSON.stringify({ holat: 'bekor' }) }); return J({ ok: true }); }
  if (a === 'lidlar') {
    const bot = await q(env, 'lidlar?select=ism,telefon,xizmat_turi,maydon_m2,manba,created_at&order=created_at.desc&limit=30');
    let sayt = []; try { sayt = ((await env.DB.prepare('SELECT name, phone, service, created_at FROM leads ORDER BY id DESC LIMIT 30').all()).results) || []; } catch {}
    return J({ ok: true, bot, sayt });
  }
  if (a === 'target') return J({ ok: true, rows: (await q(env, "nashr_navbati?turi=eq.target&select=id,holat,payload&order=id.desc&limit=15")).map((r) => { const t = (r.payload && r.payload.taklif) || {}, v = r.payload && r.payload.tanlov; return { id: r.id, nom: t.nom || '', holat: r.holat, kun: v ? v.kun_usd : null, kunlar: v ? v.kunlar : null }; }) });
  if (a === 'obyektlar') return J({ ok: true, rows: await q(env, 'obyektlar?select=id,nom,holat&order=id.desc&limit=60') });
  return J({ ok: false, error: 'amal' }, 400);
}
