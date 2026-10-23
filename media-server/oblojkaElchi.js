// Elchi (brend yuzi) oblojkasi: mavzuga mos AI foto fon + katta aniq mavzu yozuvi + muallifning retush qilingan portreti (chetlari fon bilan qo'shiladi).
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const esc = (s) => String(s || '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
function bol(t, maks) {
  const so = String(t || '').trim().split(/\s+/).filter(Boolean); const q = []; let c = '';
  for (const w of so) { if (c && (c + ' ' + w).length > maks) { q.push(c); c = w; } else c = (c + ' ' + w).trim(); }
  if (c) q.push(c); return q.slice(0, 4);
}

export async function elchiOblojka({ sarlavha, vurgu = '', fotoBuf, yuzBuf, logoB64 = '' }) {
  const W = 1080, H = 1920, fz = 104;
  const qat = bol(esc(sarlavha), 14);
  const vr = String(vurgu || '').toLowerCase();
  const tx = qat.map((q, i) => `<text x="540" y="${450 + i * (fz + 16)}" text-anchor="middle" xml:space="preserve" font-family="Poppins, DejaVu Sans, sans-serif" font-size="${fz}" font-weight="700">${q.split(' ').map((w) => `<tspan fill="${vr && w.toLowerCase().includes(vr) ? '#ff8a4c' : '#ffffff'}">${w} </tspan>`).join('')}</text>`).join('');
  const fon = await sharp(fotoBuf).resize(W, H, { fit: 'cover', position: 'centre' }).modulate({ brightness: 0.8 }).toBuffer();
  const qatlam = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0b0d" stop-opacity="0.92"/><stop offset="0.38" stop-color="#0b0b0d" stop-opacity="0.55"/><stop offset="0.7" stop-color="#0b0b0d" stop-opacity="0.25"/><stop offset="1" stop-color="#0b0b0d" stop-opacity="0.7"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/></svg>`);
  const matn = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${logoB64 ? `<image href="data:image/png;base64,${logoB64}" x="504" y="190" width="72" height="63"/>` : ''}
    <text x="540" y="300" text-anchor="middle" font-family="Poppins, DejaVu Sans, sans-serif" font-size="26" font-weight="700" fill="#ffffff" letter-spacing="9">VISART DESIGN</text>${tx}</svg>`);
  const qismlar = [{ input: qatlam }];
  if (yuzBuf) {
    const ph = 1050;
    const mask = Buffer.from(`<svg width="${W}" height="${ph}"><defs><radialGradient id="r" cx="50%" cy="58%" r="62%"><stop offset="0.5" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${ph}" fill="url(#r)"/></svg>`);
    const yuz = await sharp(yuzBuf).resize(W, ph, { fit: 'cover', position: 'top' }).ensureAlpha().composite([{ input: await sharp(mask).png().toBuffer(), blend: 'dest-in' }]).png().toBuffer();
    qismlar.push({ input: yuz, left: 0, top: H - ph });
  }
  qismlar.push({ input: matn });
  return sharp(fon).composite(qismlar).jpeg({ quality: 92 }).toBuffer();
}
