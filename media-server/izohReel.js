// "Raqam" kadri: ikki qiymat (masalan: ko'pchilik qiladi 60 sm vs norma 90 sm) animatsion ustunlar bilan taqqoslanadi -- tomoshabin raqamni ko'radi va farqni his qiladi.
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
const BG = '#0c0a08', GOLD = '#e6c07b', CREAM = '#f3ead9', RED = '#d9654a';
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => x * x * (3 - 2 * x);
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const SERIF = 'DejaVu Serif, Georgia, serif', SANS = 'Liberation Sans, Arial, sans-serif';

// q: {a:[nom,qiymat], b:[nom,qiymat], birlik, n, jami, sarlavha, tag, mp3, dur}
export async function raqamSegment(q, tmp, out) {
  const W = 1080, H = 1920, IT = 420, fps = 25, n = Math.max(2, Math.round(q.dur * fps));
  fs.mkdirSync(tmp, { recursive: true });
  const [an, av] = [String(q.a[0]), Number(q.a[1])], [bn, bv] = [String(q.b[0]), Number(q.b[1])], mx = Math.max(av, bv, 1), U = esc(q.birlik || '');
  const fark = Math.abs(bv - av), TX = 90, TW = 900, TH = 110;
  const dots = Array.from({ length: q.jami }, (_, i) => `<circle cx="${W / 2 + (i - (q.jami - 1) / 2) * 34}" cy="1862" r="${i + 1 === q.n ? 9 : 6}" fill="${i + 1 === q.n ? GOLD : '#6b5a3e'}"/>`).join('');
  const baza = await sharp({ create: { width: W, height: H, channels: 3, background: BG } }).png().toBuffer();
  const row = (y, nom, val, col, pr) => {
    const w = Math.max(14, TW * (val / mx) * pr), shown = Math.round(val * pr);
    return `<text x="${TX}" y="${y - 22}" font-family="${SANS}" font-size="44" font-weight="700" fill="${CREAM}">${esc(nom)}</text>
      <rect x="${TX}" y="${y}" width="${TW}" height="${TH}" rx="26" fill="#1b1611"/>
      <rect x="${TX}" y="${y}" width="${w}" height="${TH}" rx="26" fill="${col}"/>
      ${w > 260 ? `<text x="${TX + w - 28}" y="${y + 78}" text-anchor="end" font-family="${SERIF}" font-size="68" font-weight="700" fill="#1a1208">${shown}</text>` : `<text x="${TX + w + 24}" y="${y + 78}" font-family="${SERIF}" font-size="68" font-weight="700" fill="${col}">${shown}</text>`}
      <text x="${TX + TW + 0}" y="${y - 22}" text-anchor="end" font-family="${SANS}" font-size="40" fill="${col}" opacity="${pr > 0.2 ? 1 : 0}">${U}</text>`;
  };
  const kadr = async (k) => {
    const p = k / (n - 1);
    const p1 = ease(clamp((p - 0.1) / 0.38)), p2 = ease(clamp((p - 0.42) / 0.38)), f = ease(clamp((p - 0.82) / 0.14));
    const a = ease(clamp(p / 0.12)), sub = ease(clamp((p - 0.15) / 0.15));
    let ticks = ''; for (let i = 0; i <= 10; i++) ticks += `<line x1="${TX + TW * i / 10}" y1="1620" x2="${TX + TW * i / 10}" y2="${i % 5 === 0 ? 1650 : 1638}" stroke="#6b5a3e" stroke-width="3"/>`;
    const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      ${LOGO}
      <g opacity="${a}" transform="translate(0,${(1 - a) * -16})"><circle cx="${W / 2}" cy="170" r="36" fill="${GOLD}"/><text x="${W / 2}" y="184" text-anchor="middle" font-family="${SERIF}" font-size="40" font-weight="700" fill="#2a1d08">${q.n}</text>
      <text x="${W / 2}" y="300" text-anchor="middle" font-family="${SERIF}" font-size="92" font-weight="700" fill="${GOLD}">${esc(q.sarlavha)}</text></g>
      <text x="${W / 2}" y="372" opacity="${sub}" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="40" fill="${CREAM}">${esc(q.tag)}</text>
      ${row(IT + 300, an, av, RED, p1)}${row(IT + 640, bn, bv, GOLD, p2)}
      <g opacity="${f}" transform="translate(0,${(1 - f) * 18})"><text x="${W / 2}" y="${IT + 1010}" text-anchor="middle" font-family="${SERIF}" font-size="150" font-weight="700" fill="${GOLD}">${av === bv ? '=' : (bv > av ? '+' : '−') + fark}</text>
      <text x="${W / 2}" y="${IT + 1075}" text-anchor="middle" font-family="${SANS}" font-size="44" fill="${CREAM}" letter-spacing="2">${U ? U + ' farq' : 'farq'}</text></g>
      ${ticks}${dots}</svg>`);
    await sharp(baza).composite([{ input: svg, left: 0, top: 0 }]).jpeg({ quality: 90 }).toFile(path.join(tmp, `f${String(k).padStart(4, '0')}.jpg`));
  };
  for (let k = 0; k < n; k += 4) await Promise.all([0, 1, 2, 3].filter((d) => k + d < n).map((d) => kadr(k + d)));
  const aud = q.mp3 ? ['-i', q.mp3, '-map', '[v]', '-map', '1:a', '-af', 'apad,aresample=44100', '-c:a', 'aac', '-b:a', '128k'] : ['-map', '[v]'];
  await ex('ffmpeg', ['-y', '-framerate', String(fps), '-i', path.join(tmp, 'f%04d.jpg'), ...aud, '-filter_complex', '[0:v]format=yuv420p[v]', '-t', String(q.dur), '-c:v', 'libx264', '-preset', 'superfast', '-crf', '19', out]);
  fs.rmSync(tmp, { recursive: true, force: true });
}
