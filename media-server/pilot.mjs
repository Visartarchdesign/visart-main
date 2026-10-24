// Pilot: haqiqiy renderlardan ovozli premium reels.  Ishga tushirish:  node pilot.mjs "<renderlar papkasi>" [chiqish.mp4]
// Papkada: 1.jpg ... 6.jpg (tartib bilan)
import fs from 'fs'; import os from 'os'; import path from 'path';
import { execFile } from 'child_process'; import { promisify } from 'util';
import { qadamSegment } from './renderReel.js';
import { ovozYarat, srtVideogaKuydir, muzikaTanla, ffmpegMuzikaQosh } from './montaj.js';
const ex = promisify(execFile);
for (const l of fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8').split(/\r?\n/) : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const dir = process.argv[2], out = path.resolve(process.argv[3] || 'pilot.mp4');
const QADAMLAR = [
  { sarlavha: 'mehmonxona', tag: 'bir qarashda ochiq', belgi: "Ochiq javon", joy: [0.2, 0.5], ovoz: "Birinchi navbatda mehmonxona. Divan va ochiq javon xonani bosmaydi, aksincha, nafas olishga joy qoldiradi." },
  { sarlavha: 'ovqatlanish', tag: 'mehmonxona bilan bitta bo\'shliqda', belgi: "Bitta bo'shliq", joy: [0.5, 0.55], ovoz: "Ovqatlanish joyi alohida xona emas. U mehmonxona bilan bitta bo'shliqda, shuning uchun kichik kvartira ham keng ko'rinadi." },
  { sarlavha: 'oshxona', tag: 'tekis fasad', belgi: "Tekis fasad", joy: [0.55, 0.4], ovoz: "Oshxonada tutqichsiz, tekis fasad. Texnika devorga singdirilgan, shuning uchun ko'z charchamaydi." },
  { sarlavha: 'yotoqxona', tag: 'yumshoq yorug\'lik', belgi: "Yashirin yoritish", joy: [0.5, 0.35], ovoz: "Yotoqxonada yorug'lik yashirin. Karnizdagi chiroq devorni yumshoq yoritadi, kechqurun xona tinch bo'ladi." },
  { sarlavha: 'kiyinish burchagi', tag: 'ozgina joyda', belgi: "Kiyinish burchagi", joy: [0.5, 0.5], ovoz: "Derazaning yonidagi kichik burchak kiyinish joyiga aylangan. Alohida xona kerak emas." },
  { sarlavha: 'sanuzel', tag: 'nur va oyna', belgi: "LED oyna", joy: [0.7, 0.35], ovoz: "Sanuzelda dumaloq oyna ham ko'zgu, ham yorug'lik. Kichik hajm toza va qimmat ko'rinadi." },
];
const SARAV = ['Kichik kvartira', 'ham keng bo\'ladi'];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-'));
const segs = []; const sub = []; let t = 0;
for (let i = 0; i < QADAMLAR.length; i++) {
  const q = QADAMLAR[i];
  const mp3 = path.join(tmp, `v${i}.mp3`); await ovozYarat(process.env, q.ovoz, mp3, tmp);
  const { stdout } = await ex('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]);
  const dur = parseFloat(stdout) + 0.5;
  const seg = path.join(tmp, `s${i}.mp4`);
  const img = fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).sort((a, b) => parseInt(a) - parseInt(b))[i];
  await qadamSegment({ img: path.join(dir, img), n: i + 1, jami: QADAMLAR.length, bolim: 'Moxir kvartirasi', sarlavha: q.sarlavha, tag: q.tag, belgi: q.belgi, belgiJoy: q.joy, mp3, dur }, path.join(tmp, `f${i}`), seg);
  segs.push(seg);
  const sz = q.ovoz.split(/\s+/); const bol = []; for (let k = 0; k < sz.length; k += 2) bol.push(sz.slice(k, k + 2).join(' '));
  const jam = bol.reduce((a, x) => a + x.length, 0); let tt = t + 0.1;
  for (const x of bol) { const d = (x.length / jam) * (dur - 0.5); sub.push({ bosh: tt, tugash: tt + d, matn: x }); tt += d; }
  t += dur; console.log('qadam', i + 1, 'tayyor');
}
fs.writeFileSync(path.join(tmp, 'list.txt'), segs.map((s) => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
const joined = path.join(tmp, 'joined.mp4');
await ex('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy', joined]);
const withSub = path.join(tmp, 'sub.mp4');
await srtVideogaKuydir(joined, sub, withSub, true).catch((e) => console.log('subtitr xato', e.message));
const base = fs.existsSync(withSub) ? withSub : joined;
const mus = muzikaTanla('hashamatli');
if (mus) await ffmpegMuzikaQosh(base, mus, out); else fs.copyFileSync(base, out);
console.log('TAYYOR:', out);
