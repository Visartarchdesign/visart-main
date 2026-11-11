// Kontent analitikasi: Instagram (Cloudflare) + YouTube (media-server orqali) metrikalarini yig'ish,
// haftalik "nima ishladi" hisobotini adminga yuborish. Reyestr nashr oqimiga tegmaydi: IG/YT'dan o'zi topadi.
// Jadval: db/migration_kontent_analitika.sql. Xulosalar korrelyatsiya -- sabab deb aytilmaydi, kichik namuna belgilanadi.
import { xatoYoz } from './xato.js';
import { mediaChaqir } from './media.js';

const G = 'https://graph.facebook.com/v21.0';
export const BOSQICH = [24, 72, 168, 672]; // soat: 1 kun, 3 kun, 7 kun, 28 kun
export const KATEGORIYA = {
  qurilish_xato: "Qurilish xatolari va muammolar",
  premium_interyer: 'Premium interyer',
  arxitektura_talim: "Arxitektura ta'limi",
  oldin_keyin: 'Oldin / keyin',
  material_texnologiya: 'Material va texnologiya',
  planirovka: 'Planirovka va ergonomika',
  remont_boshqaruv: 'Remont va loyiha boshqaruvi',
  portfolio_3d: '3D va portfolio',
  mashhur_arxitektura: "Mashhur arxitektura va qiziq faktlar",
  shaxsiy_brend: 'Doston va Visart faoliyati',
};

const hdr = (env, extra = {}) => ({ apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...extra });
async function sb(env, path, init = {}) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: hdr(env, init.headers), signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`Supabase ${path.split('?')[0]} ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
async function ig(path, params) {
  const u = new URL(`${G}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(`IG ${path.split('/').pop()}: ${(d.error && d.error.message) || r.status}`);
  return d;
}

// ── Sof funksiyalar (testlanadi) ──
// Qaysi bosqich surati olinishi kerak: yosh >= bosqich va shu bosqich hali yo'q (eng kattasi)
export function navbatdagiBosqich(nashrVaqti, mavjud = [], hozir = Date.now()) {
  const yosh = (hozir - new Date(nashrVaqti).getTime()) / 3600e3;
  const tayyor = BOSQICH.filter((b) => yosh >= b && !mavjud.includes(b));
  return tayyor.length ? tayyor[tayyor.length - 1] : null;
}
// Toshkent vaqti bo'yicha nashr oynasi
export function oyna(nashrVaqti) {
  const s = new Date(new Date(nashrVaqti).getTime() + 5 * 3600e3).getUTCHours();
  return s < 11 ? 'ertalab (06-11)' : s < 16 ? 'tush (11-16)' : s < 21 ? 'kechqurun (16-21)' : 'kech (21-06)';
}
const KUN = ['Yak', 'Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha'];
export function kun(nashrVaqti) { return KUN[new Date(new Date(nashrVaqti).getTime() + 5 * 3600e3).getUTCDay()]; }
// Sifat ko'rsatkichi: 1000 qamrovga saqlash+ulashish (saqlash/ulashish -- foydalilik va tarqalish signali)
export function ball(m) {
  const reach = Number(m.reach || 0);
  if (!reach) return 0;
  return ((Number(m.saved || 0) + Number(m.shares || 0)) / reach) * 1000;
}
// Guruhlab o'rtacha: [{kalit, n, ball, reach}] -- n<3 bo'lsa "kam namuna"
export function guruhla(rows, kalitFn) {
  const g = new Map();
  for (const r of rows) {
    const k = kalitFn(r); const x = g.get(k) || { kalit: k, n: 0, ball: 0, reach: 0 };
    x.n++; x.ball += ball(r.m); x.reach += Number(r.m.reach || 0); g.set(k, x);
  }
  return [...g.values()].map((x) => ({ ...x, ball: x.ball / x.n, reach: Math.round(x.reach / x.n) })).sort((a, b) => b.ball - a.ball);
}

// ── Kategoriya (Gemini, bir marta; xato bo'lsa 'nomalum') ──
async function kategoriyaAniqla(env, matn) {
  if (!env.GEMINI_API_KEY || !matn) return 'nomalum';
  try {
    const model = env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash';
    const prompt = `Arxitektura/interyer kompaniyasining Instagram post matni. Quyidagi kategoriyalardan BITTASINING kalitini qaytar, boshqa hech narsa yozma:\n${Object.entries(KATEGORIYA).map(([k, v]) => `${k} = ${v}`).join('\n')}\n\nMatn:\n${String(matn).slice(0, 1200)}`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 256 } }),
    });
    const d = await r.json();
    const t = String((((d.candidates || [])[0] || {}).content || {}).parts?.[0]?.text || '').trim().toLowerCase();
    return Object.keys(KATEGORIYA).find((k) => t.includes(k)) || 'nomalum';
  } catch { return 'nomalum'; }
}

// ── Instagram: reyestrni sinxronlash ──
export async function igSinx(env, maxYangi = 6) {
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_BUSINESS_ACCOUNT_ID) return { ok: false, sabab: 'IG sozlanmagan' };
  const d = await ig(`${env.INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`, { fields: 'id,caption,media_type,media_product_type,timestamp,permalink', limit: '40', access_token: env.INSTAGRAM_ACCESS_TOKEN });
  const media = d.data || [];
  if (!media.length) return { ok: true, yangi: 0 };
  const bor = await sb(env, `kontent_nashr?platforma=eq.instagram&tashqi_id=in.(${media.map((m) => m.id).join(',')})&select=tashqi_id`);
  const borSet = new Set((bor || []).map((x) => x.tashqi_id));
  const yangi = media.filter((m) => !borSet.has(m.id)).slice(0, maxYangi);
  const qatorlar = [];
  for (const m of yangi) {
    qatorlar.push({
      platforma: 'instagram', tashqi_id: m.id, url: m.permalink, nashr_vaqti: m.timestamp,
      format: m.media_product_type === 'REELS' ? 'REELS' : m.media_type,
      sarlavha: String(m.caption || '').split('\n')[0].slice(0, 140),
      kategoriya: await kategoriyaAniqla(env, m.caption),
    });
  }
  if (qatorlar.length) await sb(env, 'kontent_nashr?on_conflict=platforma,tashqi_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(qatorlar) });
  // Avval aniqlanmagan (AI kvotasi tugagan) postlarni qayta ajratish -- har chaqiruvda ozgina
  let qayta = 0;
  const nomalum = await sb(env, `kontent_nashr?platforma=eq.instagram&kategoriya=eq.nomalum&select=id,tashqi_id&order=nashr_vaqti.desc&limit=3`).catch(() => []);
  for (const r of nomalum || []) {
    const m = media.find((x) => x.id === r.tashqi_id); if (!m) continue;
    const k = await kategoriyaAniqla(env, m.caption);
    if (k === 'nomalum') break; // kvota hali tiklanmagan
    await sb(env, `kontent_nashr?id=eq.${r.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ kategoriya: k }) }); qayta++;
  }
  return { ok: true, yangi: qatorlar.length, qayta };
}

const IG_REEL = ['views', 'reach', 'saved', 'shares', 'likes', 'comments', 'total_interactions', 'ig_reels_avg_watch_time'];
const IG_POST = ['views', 'reach', 'saved', 'shares', 'likes', 'comments', 'total_interactions', 'profile_visits', 'follows'];
const IG_MIN = ['reach', 'saved', 'shares', 'likes', 'comments'];
async function igInsights(env, row) {
  const ruyxat = row.format === 'REELS' ? IG_REEL : IG_POST;
  for (const metrics of [ruyxat, IG_MIN]) {
    try {
      const d = await ig(`${row.tashqi_id}/insights`, { metric: metrics.join(','), access_token: env.INSTAGRAM_ACCESS_TOKEN });
      const m = {};
      for (const x of d.data || []) m[x.name === 'ig_reels_avg_watch_time' ? 'avg_watch_ms' : x.name] = (x.values && x.values[0] ? x.values[0].value : x.total_value && x.total_value.value) ?? 0;
      return m;
    } catch (e) { if (metrics === IG_MIN) throw e; }
  }
  return null;
}

// ── Instagram: vaqti kelgan suratlarni olish (bir chaqiruvda ko'pi bilan `limit` ta) ──
export async function igMetrika(env, limit = 15) {
  const dan = new Date(Date.now() - 30 * 86400e3).toISOString();
  const rows = await sb(env, `kontent_nashr?platforma=eq.instagram&nashr_vaqti=gte.${dan}&select=id,tashqi_id,format,nashr_vaqti,kontent_metrika(soat)&order=nashr_vaqti.desc&limit=60`);
  let olindi = 0;
  for (const r of rows || []) {
    if (olindi >= limit) break;
    const b = navbatdagiBosqich(r.nashr_vaqti, (r.kontent_metrika || []).map((x) => x.soat));
    if (!b) continue;
    try {
      const m = await igInsights(env, r);
      if (m) { await sb(env, 'kontent_metrika?on_conflict=nashr_id,soat', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ nashr_id: r.id, soat: b, metrika: m }]) }); olindi++; }
    } catch (e) { await xatoYoz(env, 'analitika-ig', e); }
  }
  return { ok: true, olindi };
}

// ── Haftalik hisobot (oxirgi 28 kun, har post uchun eng so'nggi surat) ──
export async function haftalikHisobot(env, chatId) {
  const dan = new Date(Date.now() - 28 * 86400e3).toISOString();
  const rows = await sb(env, `kontent_nashr?nashr_vaqti=gte.${dan}&select=id,platforma,format,url,sarlavha,kategoriya,nashr_vaqti,kontent_metrika(soat,metrika)&order=nashr_vaqti.desc&limit=200`);
  const d = (rows || []).map((r) => {
    const s = (r.kontent_metrika || []).sort((a, b) => b.soat - a.soat)[0];
    return s ? { ...r, m: s.metrika, soat: s.soat } : null;
  }).filter(Boolean);
  const igr = d.filter((r) => r.platforma === 'instagram');
  const ytr = d.filter((r) => r.platforma === 'youtube');
  const L = [];
  L.push(`📊 Haftalik kontent hisoboti (oxirgi 28 kun)`);
  if (!igr.length && !ytr.length) {
    L.push("Hali yetarli ma'lumot yo'q (birinchi suratlar nashrdan 24 soat keyin olinadi).");
  }
  if (igr.length) {
    const jr = igr.reduce((s, r) => s + Number(r.m.reach || 0), 0);
    const jv = igr.reduce((s, r) => s + Number(r.m.views || 0), 0);
    L.push(`\n📸 Instagram: ${igr.length} ta post · qamrov ${jr.toLocaleString('ru-RU')} · ko'rish ${jv.toLocaleString('ru-RU')}`);
    const t = [...igr].sort((a, b) => ball(b.m) - ball(a.m));
    const qator = (r) => `• ${(r.sarlavha || '(matnsiz)').slice(0, 60)} — qamrov ${r.m.reach || 0}, saqlash ${r.m.saved || 0}, ulashish ${r.m.shares || 0}${r.m.avg_watch_ms ? `, o'rt. tomosha ${(r.m.avg_watch_ms / 1000).toFixed(1)} s` : ''} [${KATEGORIYA[r.kategoriya] || r.kategoriya}]\n  ${r.url || ''}`;
    L.push(`\n🏆 Eng foydali (saqlash+ulashish / 1000 qamrov):`); t.slice(0, 3).forEach((r) => L.push(qator(r)));
    if (t.length > 4) { L.push(`\n🔻 Eng zaif:`); t.slice(-2).forEach((r) => L.push(qator(r))); }
    const kam = (x) => (x.n < 3 ? ' (kam namuna)' : '');
    L.push(`\n📂 Kategoriya bo'yicha:`); guruhla(igr, (r) => KATEGORIYA[r.kategoriya] || 'Aniqlanmagan').forEach((x) => L.push(`• ${x.kalit}: ball ${x.ball.toFixed(1)}, o'rt. qamrov ${x.reach}, n=${x.n}${kam(x)}`));
    L.push(`\n🕒 Nashr oynasi bo'yicha:`); guruhla(igr, (r) => oyna(r.nashr_vaqti)).forEach((x) => L.push(`• ${x.kalit}: ball ${x.ball.toFixed(1)}, o'rt. qamrov ${x.reach}, n=${x.n}${kam(x)}`));
    L.push(`\n🎞 Format bo'yicha:`); guruhla(igr, (r) => r.format || '?').forEach((x) => L.push(`• ${x.kalit}: ball ${x.ball.toFixed(1)}, o'rt. qamrov ${x.reach}, n=${x.n}${kam(x)}`));
  }
  if (ytr.length) {
    L.push(`\n📺 YouTube: ${ytr.length} ta video`);
    [...ytr].sort((a, b) => Number(b.m.views || 0) - Number(a.m.views || 0)).slice(0, 3)
      .forEach((r) => L.push(`• ${(r.sarlavha || '').slice(0, 60)} — ko'rish ${r.m.views || 0}, layk ${r.m.likes || 0}, izoh ${r.m.comments || 0}\n  ${r.url || ''}`));
  }
  L.push(`\nℹ️ Bu korrelyatsiya, sabab emas: bitta post bo'yicha strategiya o'zgartirilmaydi. "kam namuna" guruhlari bo'yicha xulosa chiqarmang.`);
  const matn = L.join('\n').slice(0, 4000);
  if (chatId && env.MIJOZ_BOT_TOKEN) {
    await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: matn, disable_web_page_preview: true }), signal: AbortSignal.timeout(10000) });
  }
  return matn;
}

// ── Cron: nazorat qismidan har 15 daqiqada chaqiriladi; o'zi qachon ishlashni hal qiladi ──
export async function analitikaCron(env, majburiy = false) {
  const n = new Date(); const h = n.getUTCHours(), mi = n.getUTCMinutes();
  const admin = String(env.ADMIN_TELEGRAM_IDS || '').split(',').map((x) => x.trim()).filter(Boolean)[0];
  const nat = {};
  // Toshkent 05:00-07:59 oralig'ida IG sinxron + suratlar (har 15 daqiqada kichik porsiya -- subrequest chegarasi)
  if (majburiy || (h >= 0 && h <= 2)) {
    nat.sinx = await igSinx(env).catch((e) => { xatoYoz(env, 'analitika-ig-sinx', e); return { ok: false }; });
    nat.ig = await igMetrika(env, 12).catch((e) => { xatoYoz(env, 'analitika-ig', e); return { ok: false }; });
  }
  // YouTube: kuniga bir marta media-server orqali (OAuth tokeni o'sha yerda)
  if (majburiy || (h === 1 && mi < 15)) nat.yt = await mediaChaqir(env, '/yt-statistika', { adminChatId: admin }, admin).catch(() => ({ ok: false }));
  // Haftalik hisobot: Dushanba 09:00 Toshkent
  if (majburiy || (n.getUTCDay() === 1 && h === 4 && mi < 15)) nat.hisobot = await haftalikHisobot(env, admin).then(() => true).catch((e) => { xatoYoz(env, 'analitika-hisobot', e); return false; });
  return nat;
}
