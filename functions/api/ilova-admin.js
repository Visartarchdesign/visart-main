// POST /api/ilova-admin — Telegram Mini App (admin ilova) API. Kirish: Telegram initData (HMAC) + ADMIN_TELEGRAM_IDS.
// Pul sarflaydigan amallar (target yoqish/byudjet) bu yerda YO'Q -- ular faqat botda tasdiqlanadi.
import { mediaChaqir, animatsiyaBuyurtma } from '../_lib/media.js';

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
  { id: 'senarist', nom: 'Senarist', rol: 'Reel va post senariylari' },
  { id: 'montajchi', nom: 'Montajchi', rol: 'Video montaj, subtitr, effektlar' },
  { id: 'smm', nom: 'SMM', rol: 'Nashr jadvali: Instagram, YouTube, Telegram, Facebook' },
  { id: 'targetolog', nom: 'Targetolog', rol: 'Reklama taklifi va nazorat' },
  { id: 'mijoz', nom: 'Mijozlar menejeri', rol: 'Lidlar, obyektlar, guruhlar' },
  { id: 'nazorat', nom: 'Nazoratchi', rol: 'Tizim salomatligi va xatolar' },
  { id: 'autocad', nom: 'AutoCAD', rol: 'Chizmalar holati (keyingi bosqich)', kutish: true },
  { id: 'max', nom: '3ds Max', rol: 'Vizualizatsiya ishlari (keyingi bosqich)', kutish: true },
];
async function agentHolat(env) {
  const t0 = new Date(Date.now() + 5 * 3600e3); t0.setUTCHours(0, 0, 0, 0);
  const bugun = new Date(t0.getTime() - 5 * 3600e3).toISOString();
  const kun = new Date(Date.now() - 864e5).toISOString();
  const [nv, tk, lid, xato, media] = await Promise.all([
    q(env, 'nashr_navbati?select=turi,holat,created_at&order=id.desc&limit=120'),
    q(env, 'media_taklif?holat=eq.kutilmoqda&select=id,created_at&limit=50'),
    q(env, `lidlar?created_at=gte.${encodeURIComponent(bugun)}&select=id&limit=300`),
    q(env, `bot_xatolar?created_at=gte.${encodeURIComponent(kun)}&select=id&limit=300`),
    fetch(`${env.MEDIA_SERVER_URL}/health`, { signal: AbortSignal.timeout(4000) }).then((r) => r.ok).catch(() => false),
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
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 700, messages: [{ role: 'user', content: prompt }, { role: 'assistant', content: '{' }] }), signal: AbortSignal.timeout(40000) });
    if (!r.ok) return { javob: `Claude API xatosi (${r.status}).` };
    const d = await r.json();
    const raw = '{' + (((d.content || []).find((x) => x.type === 'text') || {}).text || '');
    const m = raw.match(/\{[\s\S]*\}/);
    const j = m ? JSON.parse(m[0]) : null;
    return j && j.javob ? { javob: String(j.javob).slice(0, 1200), amal: ['reel', 'animatsiya'].includes(j.amal) ? j.amal : null } : { javob: raw.slice(1, 600) };
  } catch (e) { return { javob: 'Javob olinmadi, qayta urinib ko\'ring.' }; }
}

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return J({ ok: false }, 400); }
  const u = await tekshir(env, b.initData);
  const admins = String(env.ADMIN_TELEGRAM_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!u || !admins.includes(String(u.id))) return J({ ok: false, error: 'ruxsat' }, 403);

  const a = b.amal;
  if (a === 'agentlar') { const h = await agentHolat(env); return J({ ok: true, ...h }); }
  if (a === 'chat' && b.text) { const h = await agentHolat(env); return J({ ok: true, ...(await agentChat(env, b.agent, String(b.text).slice(0, 800), h)) }); }
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
    return J({ ok: true, media, navbat: navbat.length, tayyor: tayyor.length, faol: faol.length, taklif: taklif.length, lid: lid.length, obyekt: obyekt.length });
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
