// Montaj shablonlari (FFmpeg): 9:16 Reels. Matn kartalari + LUT + xira zoom.
// shablon: 'obyekt' | 'muammo' | 'mutaxassis'. Kirish: klip/rasm yo'llari + matnlar.
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
const run = promisify(execFile);
const W = 1080, H = 1920, FPS = 30;
const FONT = process.env.MONTAJ_FONT || (process.platform === 'win32' ? 'C\\:/Windows/Fonts/arialbd.ttf' : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf');
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '\u2019').replace(/%/g, '\\%');

function segFilter(i, isImg, dur, text, lut) {
  const base = isImg
    ? `[${i}:v]scale=${Math.round(W * 1.15)}:-2,zoompan=z='min(zoom+0.0009,1.12)':d=${dur * FPS}:s=${W}x${H}:fps=${FPS}`
    : `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},trim=duration=${dur},setpts=PTS-STARTPTS`;
  const l = lut ? `,lut3d='${lut.replace(/\\/g, '/').replace(/:/g, '\\:')}'` : '';
  const dt = text
    ? `,drawbox=y=ih-380:w=iw:h=170:color=black@0.45:t=fill,drawtext=fontfile='${FONT}':text='${esc(text)}':fontcolor=white:fontsize=58:x=(w-text_w)/2:y=h-330:enable='between(t,0.3,${dur - 0.3})'`
    : '';
  return `${base}${l}${dt},setsar=1,format=yuv420p[v${i}]`;
}

export async function shablonMontaj({ shablon = 'obyekt', fayllar, matnlar = [], bosh, oxir = 'Visart Design | @visartdesign', lut, musiqa, chiqish, segDur = 3.2 }) {
  const items = fayllar.map((f) => ({ f, img: /\.(jpe?g|png|webp)$/i.test(f) }));
  const args = ['-y'];
  items.forEach((it) => args.push(...(it.img ? ['-i', it.f] : ['-i', it.f])));
  // bosh/oxir kartalari
  const cards = [];
  if (bosh) cards.push(['bosh', bosh]);
  cards.push(['oxir', oxir]);
  cards.forEach(() => args.push('-f', 'lavfi', '-t', '2.2', '-i', `color=c=0x2a2420:s=${W}x${H}:r=${FPS}`));
  const n = items.length;
  const parts = items.map((it, i) => segFilter(i, it.img, segDur, matnlar[i], lut));
  cards.forEach(([, t], k) => {
    const i = n + k;
    parts.push(`[${i}:v]drawtext=fontfile='${FONT}':text='${esc(t)}':fontcolor=0xE8D9C4:fontsize=70:x=(w-text_w)/2:y=(h-text_h)/2,fade=t=in:d=0.4,fade=t=out:st=1.8:d=0.4,setsar=1,format=yuv420p[v${i}]`);
  });
  const order = [];
  if (bosh) order.push(n);
  for (let i = 0; i < n; i++) order.push(i);
  order.push(n + cards.length - 1);
  const concat = order.map((i) => `[v${i}]`).join('') + `concat=n=${order.length}:v=1:a=0[out]`;
  args.push('-filter_complex', parts.concat(concat).join(';'), '-map', '[out]');
  if (musiqa && fs.existsSync(musiqa)) args.push('-i', musiqa, '-map', `${n + cards.length}:a`, '-af', 'afade=t=out:st=20:d=2,volume=0.4', '-shortest', '-c:a', 'aac');
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-movflags', '+faststart', chiqish);
  await run('ffmpeg', args, { maxBuffer: 1 << 26 });
  return chiqish;
}
