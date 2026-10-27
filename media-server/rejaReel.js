// Reja (tepadan ko'rinish) segmenti: kamera zonaga yaqinlashadi, zona yoritiladi, sabab ovozi bilan.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
const ex = promisify(execFile);
let LOGO_B64 = '';
try { LOGO_B64 = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'logo-mark.png')).toString('base64'); } catch (e) { /* logo ixtiyoriy */ }
const LOGO = LOGO_B64 ? `<image href="data:image/png;base64,${LOGO_B64}" x="${1080 / 2 - 38}" y="34" width="76" height="66"/>` : '';
const BG = '#0c0a08', GOLD = '#e6c07b', CREAM = '#f3ead9';
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => x * x * (3 - 2 * x);
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const SERIF = 'DejaVu Serif, Georgia, serif';

// q: {plan, zona:[fx0,fy0,fx1,fy1]|null, zonaNom, n, jami, bolim, sarlavha, tag, mp3, dur}
export async function rejaSegment(q, tmp, out) {
  const W = 1080, H = 1920, IH = 1400, IT = 420, fps = 25, K = 3, n = Math.max(2, Math.round(q.dur * fps));
  const CW = W * K, CH = IH * K;
  fs.mkdirSync(tmp, { recursive: true });
  const meta = await sharp(q.plan).metadata();
  const PW = Math.round(CW * 0.94), PH = Math.round(PW * meta.height / meta.width);
  const pl = await sharp(q.plan).resize(PW, PH, { kernel: 'lanczos3' }).linear(1.9, 0).toBuffer();
  const px0 = Math.round((CW - PW) / 2), py0 = Math.round((CH - PH) / 2);
  const canvas = await sharp({ create: { width: CW, height: CH, channels: 3, background: BG } }).composite([{ input: pl, left: px0, top: py0, blend: 'lighten' }]).png().toBuffer();
  const baza = await sharp({ create: { width: W, height: H, channels: 3, background: BG } }).png().toBuffer();
  const Z = q.zona;
  const zc = Z ? [px0 + (Z[0] + Z[2]) / 2 * PW, py0 + (Z[1] + Z[3]) / 2 * PH] : [CW / 2, CH / 2];
  const zk = Z ? Math.min(3.4, 0.8 * CW / ((Z[2] - Z[0]) * PW), 0.8 * CH / ((Z[3] - Z[1]) * PH)) : 1.12;
  const dots = Array.from({ length: q.jami }, (_, i) => `<circle cx="${W / 2 + (i - (q.jami - 1) / 2) * 34}" cy="1862" r="${i + 1 === q.n ? 9 : 6}" fill="${i + 1 === q.n ? GOLD : '#6b5a3e'}"/>`).join('');
  const kadr = async (k) => {
    const p = k / (n - 1), c = ease(clamp(p / 0.45));
    const z = 1 + (zk - 1) * c + 0.05 * p * (Z ? 0 : 1);
    const cw = Math.round(CW / z), ch = Math.round(CH / z);
    const mx = CW / 2 + (zc[0] - CW / 2) * c, my = CH / 2 + (zc[1] - CH / 2) * c;
    const left = Math.max(0, Math.min(CW - cw, Math.round(mx - cw / 2))), top = Math.max(0, Math.min(CH - ch, Math.round(my - ch / 2)));
    const rasm = await sharp(canvas).extract({ left, top, width: cw, height: ch }).resize(W, IH, { kernel: 'lanczos3' }).png().toBuffer();
    const s = W / cw;
    let hl = '';
    if (Z) {
      const x0 = (px0 + Z[0] * PW - left) * s, x1 = (px0 + Z[2] * PW - left) * s, y0 = (py0 + Z[1] * PH - top) * s, y1 = (py0 + Z[3] * PH - top) * s;
      const a = ease(clamp((p - 0.3) / 0.2)), pulse = 0.5 + 0.5 * Math.sin(p * 18);
      const w = 44 + (q.zonaNom || '').length * 17;
      hl = `<g opacity="${a}"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="14" fill="${GOLD}" fill-opacity="${0.04 + 0.03 * pulse}" stroke="${GOLD}" stroke-width="5"/>
        <rect x="${x0}" y="${Math.max(6, y0 - 64)}" width="${w}" height="50" rx="12" fill="#d9b365"/><text x="${x0 + w / 2}" y="${Math.max(6, y0 - 64) + 34}" text-anchor="middle" font-family="Liberation Sans, Arial, sans-serif" font-size="25" font-weight="700" fill="#2a1d08" letter-spacing="1.5">${esc((q.zonaNom || '').toUpperCase())}</text></g>`;
    }
    let bl = '';
    (q.belgilar || []).forEach((o, j) => {
      const pr = ease(clamp((p - (0.42 + j * 0.16)) / 0.22)); if (pr <= 0) return;
      const X = (f) => (px0 + f * PW - left) * s, Y = (f) => (py0 + f * PH - top) * s;
      const ax = X(o.a[0]), ay = Y(o.a[1]), bx = X(o.b[0]), by = Y(o.b[1]);
      const ex = ax + (bx - ax) * pr, ey = ay + (by - ay) * pr, dx = bx - ax, dy = by - ay, Ln = Math.hypot(dx, dy) || 1, nx = -dy / Ln, ny = dx / Ln;
      const cap = (x, y) => `<line x1="${x - nx * 26}" y1="${y - ny * 26}" x2="${x + nx * 26}" y2="${y + ny * 26}" stroke="#0c0a08" stroke-width="14" stroke-linecap="round"/><line x1="${x - nx * 26}" y1="${y - ny * 26}" x2="${x + nx * 26}" y2="${y + ny * 26}" stroke="${GOLD}" stroke-width="7" stroke-linecap="round"/>`;
      const lb = ease(clamp((pr - 0.6) / 0.4)), txt = esc(String(o.yozuv || '').slice(0, 22)), cw = 50 + txt.length * 21, mx = (ax + bx) / 2 + nx * 64, my = (ay + by) / 2 + ny * 64;
      bl += `<g><line x1="${ax}" y1="${ay}" x2="${ex}" y2="${ey}" stroke="#0c0a08" stroke-width="14" stroke-linecap="round"/><line x1="${ax}" y1="${ay}" x2="${ex}" y2="${ey}" stroke="${GOLD}" stroke-width="7" stroke-linecap="round"/>${cap(ax, ay)}${pr > 0.97 ? cap(bx, by) : ''}` +
        (txt ? `<g opacity="${lb}" transform="translate(0,${(1 - lb) * 10})"><rect x="${mx - cw / 2}" y="${my - 30}" width="${cw}" height="60" rx="14" fill="#d9b365"/><text x="${mx}" y="${my + 11}" text-anchor="middle" font-family="Liberation Sans, Arial, sans-serif" font-size="32" font-weight="800" fill="#2a1d08">${txt}</text></g>` : '') + '</g>';
    });
    const a = ease(clamp(p / 0.12)), sub = ease(clamp((p - 0.15) / 0.15));
    const ust = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      ${LOGO}
      <g opacity="${a}" transform="translate(0,${(1 - a) * -16})"><circle cx="${W / 2}" cy="170" r="36" fill="${GOLD}"/><text x="${W / 2}" y="184" text-anchor="middle" font-family="${SERIF}" font-size="40" font-weight="700" fill="#2a1d08">${q.n}</text>
      <text x="${W / 2}" y="300" text-anchor="middle" font-family="${SERIF}" font-size="92" font-weight="700" fill="${GOLD}">${esc(q.sarlavha)}</text></g>
      <text x="${W / 2}" y="372" opacity="${sub}" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="40" fill="${CREAM}">${esc(q.tag)}</text>
      <g transform="translate(0,${IT})">${hl}${bl}</g>${dots}</svg>`);
    await sharp(baza).composite([{ input: rasm, left: 0, top: IT }, { input: ust, left: 0, top: 0 }]).jpeg({ quality: 90 }).toFile(path.join(tmp, `f${String(k).padStart(4, '0')}.jpg`));
  };
  for (let k = 0; k < n; k += 4) await Promise.all([0, 1, 2, 3].filter((d) => k + d < n).map((d) => kadr(k + d)));
  const aud = q.mp3 ? ['-i', q.mp3, '-map', '[v]', '-map', '1:a', '-af', 'apad,aresample=44100', '-c:a', 'aac', '-b:a', '128k'] : ['-map', '[v]'];
  await ex('ffmpeg', ['-y', '-framerate', String(fps), '-i', path.join(tmp, 'f%04d.jpg'), ...aud, '-filter_complex', '[0:v]format=yuv420p[v]', '-t', String(q.dur), '-c:v', 'libx264', '-preset', 'superfast', '-crf', '19', out]);
  fs.rmSync(tmp, { recursive: true, force: true });
}
