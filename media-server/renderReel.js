// Haqiqiy 3D renderlardan (3ds Max/Corona) premium "qadamlar" reels: raqamli bosqichlar, sarlavha, belgi, nuqtali sahifa.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
const ex = promisify(execFile);

const BG = '#0c0a08', GOLD = '#e6c07b', CREAM = '#f3ead9';
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => x * x * (3 - 2 * x);
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const SERIF = 'DejaVu Serif, Georgia, serif';

// qadam: {img, n, jami, sarlavha, tagsarlavha, belgi, belgiJoy:[x,y](0..1), ovoz mp3 yoki null, dur}
export async function qadamSegment(q, tmp, out) {
  const W = 1080, H = 1920, IH = 1400, IT = 420, fps = 25, n = Math.max(2, Math.round(q.dur * fps));
  fs.mkdirSync(tmp, { recursive: true });
  let parDir = null;
  if (q.parallaks) {
    const pd = path.join(tmp, 'par');
    const scr = path.join(path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1')), 'parallax.py');
    for (const py of [process.env.PARALLAX_PY, 'python', 'python3', 'py'].filter(Boolean)) {
      try { await ex(py, [scr, q.img, pd, String(n), String(W), String(IH), String(q.yon || 1)], { maxBuffer: 1024 * 1024 * 20 }); parDir = pd; break; } catch (e) { if (py === 'py' || !py) console.error('parallaks xato:', String(e.message).slice(0, 200)); }
    }
  }
  const SRC_W = 3240, SRC_H = Math.round(SRC_W * IH / W);
  const src = parDir ? null : await sharp(q.img).resize(SRC_W, SRC_H, { fit: 'cover', kernel: 'lanczos3' }).toBuffer();
  const dots = Array.from({ length: q.jami }, (_, i) => `<circle cx="${W / 2 + (i - (q.jami - 1) / 2) * 34}" cy="1862" r="${i + 1 === q.n ? 9 : 6}" fill="${i + 1 === q.n ? GOLD : '#6b5a3e'}"/>`).join('');
  const fade = Buffer.from(`<svg width="${W}" height="${IH}"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.08" stop-color="#fff"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="${W}" height="${IH}" fill="url(#a)"/></svg>`);
  const baza = await sharp({ create: { width: W, height: H, channels: 3, background: BG } }).png().toBuffer();
  const kadr = async (k) => {
    const p = k / (n - 1);
    const zoom = 1 + 0.09 * ease(p);
    const cw = Math.round(SRC_W / zoom), ch = Math.round(SRC_H / zoom);
    const left = Math.round((SRC_W - cw) / 2), top = Math.round((SRC_H - ch) / 2);
    const rasm = parDir
      ? await sharp(path.join(parDir, `p${String(k).padStart(4, '0')}.jpg`)).composite([{ input: fade, blend: 'dest-in' }]).png().toBuffer()
      : await sharp(src).extract({ left, top, width: cw, height: ch }).resize(W, IH, { kernel: 'lanczos3' }).composite([{ input: fade, blend: 'dest-in' }]).png().toBuffer();
    const a = ease(clamp(p / 0.12));
    const sub = ease(clamp((p - 0.15) / 0.15));
    let belgi = '';
    if (q.belgi) {
      const b = ease(clamp((p - 0.35) / 0.15));
      const bx = (q.belgiJoy ? q.belgiJoy[0] : 0.5) * W, by = IT + (q.belgiJoy ? q.belgiJoy[1] : 0.5) * IH;
      const w = 40 + q.belgi.length * 17;
      belgi = `<g opacity="${b}" transform="translate(0,${(1 - b) * 14})"><rect x="${bx - w / 2}" y="${by - 24}" width="${w}" height="48" rx="12" fill="#d9b365"/><text x="${bx}" y="${by + 8}" text-anchor="middle" font-family="Liberation Sans, Arial, sans-serif" font-size="24" font-weight="700" fill="#2a1d08" letter-spacing="1.5">${esc(q.belgi.toUpperCase())}</text></g>`;
    }
    const ust = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <g opacity="${a}" transform="translate(0,${(1 - a) * -16})">
        <circle cx="${W / 2}" cy="170" r="36" fill="${GOLD}"/><text x="${W / 2}" y="184" text-anchor="middle" font-family="${SERIF}" font-size="40" font-weight="700" fill="#2a1d08">${q.n}</text>
        <text x="${W / 2}" y="300" text-anchor="middle" font-family="${SERIF}" font-size="92" font-weight="700" fill="${GOLD}">${esc(q.sarlavha)}</text></g>
      <text x="${W / 2}" y="372" opacity="${sub}" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="40" fill="${CREAM}">${esc(q.tag)}</text>
      ${belgi}${dots}</svg>`);
    await sharp(baza).composite([{ input: rasm, left: 0, top: IT }, { input: ust, left: 0, top: 0 }]).jpeg({ quality: 90 }).toFile(path.join(tmp, `f${String(k).padStart(4, '0')}.jpg`));
  };
  for (let k = 0; k < n; k += 4) await Promise.all([0, 1, 2, 3].filter((d) => k + d < n).map((d) => kadr(k + d)));
  const aud = q.mp3 ? ['-i', q.mp3, '-map', '[v]', '-map', '1:a', '-af', 'apad,aresample=44100', '-c:a', 'aac', '-b:a', '128k'] : ['-map', '[v]'];
  await ex('ffmpeg', ['-y', '-framerate', String(fps), '-i', path.join(tmp, 'f%04d.jpg'), ...aud, '-filter_complex', '[0:v]format=yuv420p[v]', '-t', String(q.dur), '-c:v', 'libx264', '-preset', 'superfast', '-crf', '19', out].filter((x, i, a2) => !(x === '-filter_complex' && false)));
  fs.rmSync(tmp, { recursive: true, force: true });
}
