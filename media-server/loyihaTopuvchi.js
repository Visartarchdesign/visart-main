// Kunlik taklif: kompyuterdagi ish papkalaridan (D:\1_WORK, E:\1_WORK) saytga joylanmagan loyiha topadi,
// 6-10 ta eng yaxshi renderni Telegram'ga albom qilib yuboradi va SEO agentiga taklif sifatida beradi (admin tasdiqlaydi).
import fs from 'fs';
import os from 'os';
import path from 'path';

const ILDIZ = (process.env.LOYIHA_ILDIZ || 'D:\\1_WORK;E:\\1_WORK').split(';').filter(Boolean);
const YILLAR = ['2026', '2025', '2024'];
const TARIX = path.join(os.homedir(), 'Documents', 'Visart_AI_Studio', 'taklif_tarix.json');
const RASM = /\.(jpe?g|png)$/i;
const YOMON_YOL = /(texture|textures|tex|maps?|material|materials|mat|ref|reference|scan|screenshot|thumb|thumbs|backup|ishlangan|plan|chizma|autocad|sketch|bak)([\\/]|$)/i;
const YAXSHI_NOM = /(view|render|cam|camera|final|fasad|interior|exterior|vray|corona|_v\d+|post)/i;

const tarixOl = () => { try { return JSON.parse(fs.readFileSync(TARIX, 'utf8')); } catch (e) { return { used: [] }; } };
const tarixYoz = (t) => { try { fs.mkdirSync(path.dirname(TARIX), { recursive: true }); fs.writeFileSync(TARIX, JSON.stringify(t)); } catch (e) { /* ixtiyoriy */ } };

function rasmlar(dir, chuqur = 0, out = []) {
  if (chuqur > 4) return out;
  let list = []; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const d of list) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) { if (!YOMON_YOL.test(d.name + path.sep)) rasmlar(p, chuqur + 1, out); continue; }
    if (!RASM.test(d.name)) continue;
    let st; try { st = fs.statSync(p); } catch (e) { continue; }
    if (st.size < 400e3 || st.size > 40e6) continue;
    out.push({ p, size: st.size, mtime: st.mtimeMs, nom: d.name });
  }
  return out;
}

export function nomzodlar() {
  const t = tarixOl(), res = [];
  for (const root of ILDIZ) for (const y of YILLAR) {
    const yd = path.join(root, y); let list = []; try { list = fs.readdirSync(yd, { withFileTypes: true }); } catch (e) { continue; }
    for (const d of list) {
      if (!d.isDirectory()) continue;
      const dir = path.join(yd, d.name);
      if (t.used.includes(dir)) continue;
      const im = rasmlar(dir);
      if (im.length < 4) continue;
      res.push({ dir, nom: d.name, yil: y, im, yangi: Math.max(...im.map((x) => x.mtime)) });
    }
  }
  return res.sort((a, b) => b.yangi - a.yangi);
}

function tanla(im) {
  // ball: yaxshi nom +, katta hajm +, oxirgi o'zgarish +; bir papkadan haddan ko'p olinmasin
  const ball = (x) => (YAXSHI_NOM.test(x.nom) ? 2 : 0) + Math.min(x.size / 3e6, 2) + (x.mtime / 1e13);
  const sorted = [...im].sort((a, b) => ball(b) - ball(a));
  const per = new Map(), pick = [];
  for (const x of sorted) { const k = path.dirname(x.p); if ((per.get(k) || 0) >= 5) continue; per.set(k, (per.get(k) || 0) + 1); pick.push(x); if (pick.length >= 10) break; }
  return pick;
}

const tg = async (E, method, body, form) => (await fetch(`https://api.telegram.org/bot${E.MIJOZ_BOT_TOKEN}/${method}`, form ? { method: 'POST', body: form, signal: AbortSignal.timeout(120000) } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })).json().catch(() => null);
const sb = async (E, p, init = {}) => {
  const r = await fetch(`${E.SUPABASE_URL}/rest/v1/${p}`, { ...init, headers: { apikey: E.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${E.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('sb ' + r.status);
  const t = await r.text(); return t ? JSON.parse(t) : null;
};

const BAHO_URL = process.env.BAHO_URL || 'https://visartdesign.uz/api/loyiha-baho';

// AI baholash: nomzod papkadagi eng yaxshi 24 ta rasm kichraytirilib yuboriladi, faqat 8+ ballilar qaytadi
async function aiBaho(sharp, c) {
  const havola = tanla24(c.im);
  const rasmlar = [];
  for (let i = 0; i < havola.length; i++) {
    const buf = await sharp(havola[i].p).rotate().resize({ width: 1000, withoutEnlargement: true }).jpeg({ quality: 68 }).toBuffer().catch(() => null);
    if (buf) rasmlar.push({ i, b64: buf.toString('base64') });
  }
  const r = await fetch(BAHO_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Media-Secret': process.env.MEDIA_SECRET || '' }, body: JSON.stringify({ nom: c.nom, rasmlar }), signal: AbortSignal.timeout(150000) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.ok) throw new Error('AI baholash: ' + ((j && j.error) || r.status));
  return { yaxshi: j.yaxshi.map((i) => havola[i]).filter(Boolean), ballar: j.ballar, xulosa: j.xulosa, korildi: rasmlar.length };
}

function tanla24(im) {
  const ball = (x) => (YAXSHI_NOM.test(x.nom) ? 2 : 0) + Math.min(x.size / 3e6, 2) + (x.mtime / 1e13);
  const sorted = [...im].sort((a, b) => ball(b) - ball(a));
  const per = new Map(), pick = [];
  for (const x of sorted) { const k = path.dirname(x.p); if ((per.get(k) || 0) >= 12) continue; per.set(k, (per.get(k) || 0) + 1); pick.push(x); if (pick.length >= 24) break; }
  return pick;
}

export async function loyihaTaklif({ env: E, adminChatId }) {
  const chatId = adminChatId || E.ADMIN_CHAT_ID;
  if (!chatId) return;
  const faol = await sb(E, `nashr_navbati?turi=eq.seo_loyiha&holat=eq.seo_yig&payload->>chatId=eq.${chatId}&select=id&limit=1`).catch(() => []);
  if (faol && faol.length) { await tg(E, 'sendMessage', { chat_id: chatId, text: "ℹ️ Kunlik taklif: ochiq SEO ish bor, avval uni tugating yoki /seo → bekor." }); return; }
  const t = tarixOl();
  const nom = nomzodlar();
  if (!nom.length) { await tg(E, 'sendMessage', { chat_id: chatId, text: "📁 Kompyuterda saytga mos yangi loyiha papkasi topilmadi (2024–2026, kamida 4 ta rasm)." }); return; }
  const sharp = (await import('sharp')).default;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'taklif_'));
  try {
    let tanlangan = null, korilgan = [];
    for (const c of nom.slice(0, 5)) {
      let baho;
      try { baho = await aiBaho(sharp, c); } catch (e) { throw e; }
      t.used.push(c.dir); tarixYoz(t); // baholangan papka qayta ko'rsatilmaydi (yaxshi chiqsa ham, yomon chiqsa ham)
      if (baho.yaxshi.length >= 4) { tanlangan = { c, baho }; break; }
      korilgan.push(`${c.nom} (${baho.yaxshi.length}/${baho.korildi} munosib)`);
    }
    if (!tanlangan) { await tg(E, 'sendMessage', { chat_id: chatId, text: `🔍 Bugun AI saytga munosib (8+/10, kamida 4 ta) loyiha topmadi. Ko'rildi: ${korilgan.join('; ')}.\nNomzodlar saqlanib turibdi, ertaga yangi papkalar tekshiriladi.` }); return; }
    const { c, baho } = tanlangan;
    const files = [];
    for (let i = 0; i < baho.yaxshi.length; i++) { const f = path.join(tmp, `r${i + 1}.jpg`); await sharp(baho.yaxshi[i].p).rotate().resize({ width: 2400, withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(f); files.push(f); }
    const fd = new FormData(); fd.append('chat_id', String(chatId));
    fd.append('media', JSON.stringify(files.map((f, i) => ({ type: 'document', media: `attach://f${i}`, caption: i === 0 ? `1 · 📁 ${c.nom} (${c.yil})` : String(i + 1) }))));
    files.forEach((f, i) => fd.append(`f${i}`, new Blob([fs.readFileSync(f)]), `r${i + 1}.jpg`));
    const r = await tg(E, 'sendMediaGroup', null, fd);
    if (!r || !r.ok) throw new Error('Telegram albom: ' + JSON.stringify(r).slice(0, 120));
    const fids = r.result.map((m) => m.document.file_id);
    await sb(E, 'nashr_navbati', { method: 'POST', body: JSON.stringify([{ turi: 'seo_loyiha', holat: 'seo_yig', nashr_vaqti: new Date().toISOString(), payload: { chatId: Number(chatId), step: 'taklif', n: { sayt: true }, rasmlar: fids, q: 0, j: {}, papka: c.nom } }]) });
    await tg(E, 'sendMessage', { chat_id: chatId, text: `📁 <b>Bugungi taklif</b>: ${c.nom} (${c.yil})\n🤖 AI ${baho.korildi} ta rasmni ko'rib, <b>${fids.length} ta</b> sifatlisini (8+/10) tanladi.${baho.xulosa ? '\n💬 ' + baho.xulosa : ''}${korilgan.length ? `\n(Rad etilgan papkalar: ${korilgan.join('; ')})` : ''}\n\nRasmlar raqamlangan. Keraksizini yozing (masalan: «2 va 5-rasm bu ishga aloqasi yo'q», «3-rasmni muqova qil»).\n\nShuni saytga (portfolio) joylaymi? Tasdiqlasangiz, bir nechta savol beraman va premium SEO bilan avtomatik joylayman.`, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '✅ Ha, joyla', callback_data: 'sg:tk:ha' }], [{ text: '🔄 Boshqasini top', callback_data: 'sg:tk:boshqa' }, { text: "🚫 Bugun yo'q", callback_data: 'sg:tk:yoq' }]] } });
  } catch (e) {
    await tg(E, 'sendMessage', { chat_id: chatId, text: `⚠️ Kunlik taklif xatosi: ${String((e && e.message) || e).slice(0, 200)}` });
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* vaqtinchalik */ } }
}
