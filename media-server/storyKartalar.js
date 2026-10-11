// Instagram Story'lar uchun BIR-BIRIDAN FARQLI kartalar (bir xil videoni
// kuniga 3 marta qo'ymaslik uchun). Reel = video; Story'lar = kadrdan
// teaser, savol kartasi va AI-rasm (yoki boshqa kadr) + qisqa matn.
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { execFile } from 'child_process';
import { promisify } from 'util';
const run = promisify(execFile);
const W = 1080, H = 1920;
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function qatorlar(matn, maxBelgi) {
  const so = String(matn || '').split(/\s+/).filter(Boolean);
  const q = []; let h = '';
  for (const s of so) {
    if ((h + ' ' + s).trim().length > maxBelgi && h) { q.push(h); h = s; } else h = (h + ' ' + s).trim();
  }
  if (h) q.push(h);
  return q.slice(0, 5);
}

function matnSvg(matn, { y, size = 78, maxBelgi = 22, pastki }) {
  const q = qatorlar(matn, maxBelgi);
  const lh = size * 1.25;
  const t = q.map((l, i) => `<text x="540" y="${y + i * lh}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="${size}" fill="#F3E9DA">${esc(l)}</text>`).join('');
  const foot = pastki ? `<text x="540" y="1790" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="40" fill="#D8C3A5">${esc(pastki)}</text>` : '';
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.15"/><stop offset="0.55" stop-color="#000" stop-opacity="0.2"/><stop offset="1" stop-color="#1a1410" stop-opacity="0.85"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>${t}${foot}<text x="540" y="140" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="44" letter-spacing="8" fill="#E8D9C4">VISART DESIGN</text></svg>`);
}

async function kadrOl(videoPath, nisbat, chiqish) {
  let dur = 10;
  try {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', videoPath]);
    dur = parseFloat(stdout) || 10;
  } catch (e) { /* standart */ }
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0.5, dur * nisbat)), '-i', videoPath, '-frames:v', '1', '-q:v', '2', chiqish]);
  return fs.readFileSync(chiqish);
}

async function geminiMatn(env, sarlavha) {
  if (!env.GEMINI_API_KEY) return null;
  const prompt = `Interyer dizayn studiyasi (Toshkent) Instagram Story'lari uchun O'ZBEK tilida (lotin) qisqa matnlar yoz. Mavzu: "${sarlavha}". Faqat JSON: {"teaser":"<=7 so'z","savol":"auditoriyaga savol <=10 so'z","maslahat":"1 ta amaliy dizayn maslahati <=12 so'z","rasm_prompt":"inglizcha: premium issiq-neytral interyer fotosurati, mavzuga mos, 9:16, realistik yoritish"}`;
  for (const model of ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite']) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
        signal: AbortSignal.timeout(30000),
      });
      const d = await r.json();
      const t = d && d.candidates && d.candidates[0].content.parts[0].text;
      if (t) return JSON.parse(t);
    } catch (e) { /* keyingi model */ }
  }
  return null;
}

async function geminiRasm(env, promptEn) {
  if (!env.GEMINI_API_KEY || !promptEn) return null;
  const model = env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptEn + ' Vertical 9:16, photorealistic, no text, no people.' }] }], generationConfig: { responseModalities: ['IMAGE'] } }),
      signal: AbortSignal.timeout(60000),
    });
    const d = await r.json();
    const p = d && d.candidates && d.candidates[0].content.parts.find((x) => x.inlineData);
    return p ? Buffer.from(p.inlineData.data, 'base64') : null;
  } catch (e) { return null; }
}

// Qaytaradi: [{ rol:'teaser'|'savol'|'maslahat', buf:Buffer(JPEG 1080x1920) }]
export async function storyKartalarYarat({ env, videoUrl, sarlavha }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'story-'));
  try {
    const vp = path.join(tmp, 'v.mp4');
    fs.writeFileSync(vp, Buffer.from(await (await fetch(videoUrl)).arrayBuffer()));
    const k1 = await kadrOl(vp, 0.35, path.join(tmp, 'a.jpg'));
    const k2 = await kadrOl(vp, 0.7, path.join(tmp, 'b.jpg'));
    const m = (await geminiMatn(env, sarlavha)) || {};
    const teaser = m.teaser || sarlavha;
    const savol = m.savol || "Sizga qaysi uslub yoqadi?";
    const maslahat = m.maslahat || "Yoritishni 2700–3000K ichida tanlang: xona issiq ko'rinadi.";
    const cover = (b) => sharp(b).resize(W, H, { fit: 'cover' });
    const A = await cover(k1).composite([{ input: matnSvg(teaser, { y: 1380, pastki: "To'liq video — profilimizda (Reels)" }) }]).jpeg({ quality: 90 }).toBuffer();
    const blur = await cover(k2).blur(28).modulate({ brightness: 0.75 }).toBuffer();
    const B = await sharp(blur).composite([{ input: matnSvg(savol, { y: 800, size: 84, pastki: 'Javobingizni yozing' }) }]).jpeg({ quality: 90 }).toBuffer();
    const ai = await geminiRasm(env, m.rasm_prompt);
    const Cbase = ai ? await cover(ai).toBuffer() : await cover(k2).toBuffer();
    const C = await sharp(Cbase).composite([{ input: matnSvg(maslahat, { y: 1340, size: 66, maxBelgi: 26, pastki: ai ? 'AI vizualizatsiya' : 'Dizayner maslahati' }) }]).jpeg({ quality: 90 }).toBuffer();
    return [{ rol: 'teaser', buf: A }, { rol: 'savol', buf: B }, { rol: 'maslahat', buf: C, ai: !!ai }];
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
