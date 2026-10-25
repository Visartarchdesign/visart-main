// Oblojka: Dostonning tayyor shablon surati (oblojka_shablon/*.png) + yuqorida mavzuga oid render (yumshoq aralashgan) + mavzu sarlavhasi.
// oblojka_shablon/sablon.json (ixtiyoriy): { "01.png": { "top": 0.34 } } -- yuqoridagi bo'sh (yuzsiz) qism nisbati.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SH = path.join(DIR, 'oblojka_shablon');
const GOLD = '#e6c07b';
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function sablonlar() {
  try { return fs.readdirSync(SH).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort(); } catch (e) { return []; }
}

// Oxirgi ishlatilganidan boshqasini tanlaydi (aylanma)
export function sablonTanla() {
  const hammasi = sablonlar();
  if (!hammasi.length) return null;
  const reg = path.join(SH, '.oxirgi');
  let oxirgi = ''; try { oxirgi = fs.readFileSync(reg, 'utf8').trim(); } catch (e) { /* birinchi marta */ }
  const i = hammasi.indexOf(oxirgi), tanlangan = hammasi[(i + 1) % hammasi.length];
  try { fs.writeFileSync(reg, tanlangan); } catch (e) { /* ixtiyoriy */ }
  return tanlangan;
}

function sarlavhaMarkup(t, vurgu) {
  const sx = esc(t).split(/\s+/).filter(Boolean), so = [];
  for (let k = 0; k < sx.length; k++) { if (/\d/.test(sx[k]) && sx[k + 1]) { so.push(`${sx[k]}\u00a0${sx[k + 1]}`); k++; } else so.push(sx[k]); }
  const v = String(vurgu || '').toLowerCase();
  const belgi = new Set();
  so.forEach((w, i) => { if (/\d/.test(w)) belgi.add(i); if (v && w.toLowerCase().includes(v)) belgi.add(i); });
  if (!belgi.size && so.length) belgi.add(so.length - 1);
  // qatorlarga bo'lish (<=16 belgi)
  const q = []; let c = [];
  so.forEach((w, i) => { const t2 = [...c.map((x) => x.w), w].join(' '); if (c.length && t2.length > 16) { q.push(c); c = []; } c.push({ w, i }); });
  if (c.length) q.push(c);
  return q.slice(0, 4).map((r) => r.map((x) => (belgi.has(x.i) ? `<span foreground="${GOLD}">${x.w}</span>` : `<span foreground="#ffffff">${x.w}</span>`)).join(' ')).join('\n');
}

export async function sablonOblojka({ sablon, sarlavha, vurgu = '', fotoBuf, logoB64 = '' }) {
  const W = 1080, H = 1920;
  const meta = (() => { try { return JSON.parse(fs.readFileSync(path.join(SH, 'sablon.json'), 'utf8'))[sablon] || {}; } catch (e) { return {}; } })();
  const top = meta.top || 0.34, PH = Math.round(H * top);
  const baza = await sharp(path.join(SH, sablon)).resize(W, H, { fit: 'cover', position: 'top' }).toBuffer();
  const qismlar = [];
  if (fotoBuf) {
    // render yuqori qismda: ohang bazaga moslangan, pastga qarab so'nadi (yuzga tegmaydi)
    const rasm = await sharp(fotoBuf).resize(W, PH, { fit: 'cover', position: 'centre' }).modulate({ brightness: 0.82, saturation: 0.8 }).ensureAlpha().toBuffer();
    const mask = Buffer.from(`<svg width="${W}" height="${PH}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="${W}" height="${PH}" fill="url(#g)"/></svg>`);
    qismlar.push({ input: await sharp(rasm).composite([{ input: await sharp(mask).png().toBuffer(), blend: 'dest-in' }]).png().toBuffer(), left: 0, top: 0 });
  }
  // sarlavha o'qilishi uchun qorong'i gradient
  qismlar.push({ input: Buffer.from(`<svg width="${W}" height="${H}"><defs><linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0908" stop-opacity="0.6"/><stop offset="${top}" stop-color="#0a0908" stop-opacity="0.25"/><stop offset="${top + 0.06}" stop-color="#0a0908" stop-opacity="0"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#d)"/></svg>`) });
  const fontfile = path.join(DIR, 'fonts', 'Poppins-Bold.ttf');
  const matn = await sharp({ text: { text: sarlavhaMarkup(sarlavha, vurgu), font: 'Poppins Bold 74', fontfile, width: W - 160, align: 'centre', rgba: true, spacing: 8 } }).png().toBuffer();
  const mm = await sharp(matn).metadata();
  qismlar.push({ input: matn, left: Math.round((W - mm.width) / 2), top: Math.max(250, Math.round(PH * 0.55 - mm.height / 2)) });
  if (logoB64) qismlar.push({ input: await sharp(Buffer.from(logoB64, 'base64')).resize({ height: 64 }).png().toBuffer(), left: W / 2 - 37, top: 86 });
  qismlar.push({ input: Buffer.from(`<svg width="${W}" height="140" xmlns="http://www.w3.org/2000/svg"><text x="540" y="40" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#ffffff" letter-spacing="9">VISART DESIGN</text></svg>`), left: 0, top: 160 });
  return sharp(baza).composite(qismlar).jpeg({ quality: 93 }).toBuffer();
}
