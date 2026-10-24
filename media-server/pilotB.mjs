// B seriya: "Nega shunday loyihalangan". Reja (tepadan) + 3D parallaks render + muqobil kamchiligi.
// node pilotB.mjs pilot_renders pilotB.mp4   (papkada: reja.png, 1.jpg..6.jpg)
import fs from 'fs'; import os from 'os'; import path from 'path';
import { execFile } from 'child_process'; import { promisify } from 'util';
import { qadamSegment } from './renderReel.js';
import { rejaSegment } from './rejaReel.js';
import { ovozYarat, srtVideogaKuydir, muzikaTanla, ffmpegMuzikaQosh } from './montaj.js';
const ex = promisify(execFile);
for (const l of fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8').split(/\r?\n/) : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const dir = process.argv[2], out = path.resolve(process.argv[3] || 'pilotB.mp4');
const BOLIM = 'Moxir kvartirasi';
// zona: rejadagi to'rtburchak (nisbiy). rasm: render raqami. sabab -- reja ustida; boshqa -- renderda (muqobil kamchiligi)
const Q = [
  { sar: 'mehmonxona', tag: 'devorsiz bitta bo\'shliq', zona: [0.386, 0.084, 0.775, 0.943], nom: 'Umumiy bo\'shliq', rasm: 2, yon: 1, belgi: 'Bitta bo\'shliq', joy: [0.5, 0.6],
    sabab: "Bu yerda devor yo'q. Mehmonxona, ovqatlanish va oshxona bitta katta bo'shliq, shuning uchun derazadan kirgan yorug'lik hamma joyga yetadi.",
    boshqa: "Agar shu yerga devor tortilsa, o'rtadagi xona qorong'i va tor bo'lib qoladi." },
  { sar: 'divan va stol', tag: 'orasida bo\'sh yo\'lak', zona: [0.457, 0.118, 0.718, 0.578], nom: 'Yo\'lak', rasm: 1, yon: -1, belgi: 'Bo\'sh yo\'lak', joy: [0.5, 0.65],
    sabab: "Divan bilan stol orasida atayin bo'sh joy qoldirilgan. Stuldan turganda ham, o'tib ketganda ham hech kimga tegmaysiz.",
    boshqa: "Divan stolga yaqin qo'yilsa, stuldan turish ham, o'tish ham qiyin bo'ladi." },
  { sar: 'oshxona', tag: 'bir devor bo\'ylab', zona: [0.775, 0.084, 0.946, 0.533], nom: 'Oshxona', rasm: 3, yon: 1, belgi: 'Tekis fasad', joy: [0.5, 0.45],
    sabab: "Oshxona bir devor bo'ylab joylashgan: kir yuvish mashinasi, plita, muzlatgich va moyka yonma-yon. Ish uchun uzoq yurish kerak emas.",
    boshqa: "Texnika xonaning ikki chetiga tarqalsa, har qadamda ortiqcha yurasiz." },
  { sar: 'yotoqxona', tag: 'tinch burchak', zona: [0.015, 0.23, 0.37, 0.94], nom: 'Yotoqxona', rasm: 4, yon: -1, belgi: 'Yashirin yoritish', joy: [0.68, 0.57],
    sabab: "Yotoqxona alohida va tinch. Karavot devorga suyangan, shkaf esa kirish yonida, shuning uchun kiyim olish uyquga xalaqit bermaydi.",
    boshqa: "Karavot eshik oldiga qo'yilsa, kirgan har bir odam to'g'ri yotoqqa qaraydi." },
  { sar: 'kiyinish burchagi', tag: 'deraza yonida', zona: [0.136, 0.084, 0.24, 0.325], nom: 'Trimo', rasm: 5, yon: 1, belgi: 'Tabiiy yorug\'lik', joy: [0.5, 0.45],
    sabab: "Trimo derazaning yonida turibdi. Tabiiy yorug'lik yuzga to'g'ri tushadi, ko'zguga qarash qulay.",
    boshqa: "Qorong'i burchakda ko'zgu yorug'lik yetishmasligidan soyali ko'rsatadi." },
  { sar: 'sanuzel', tag: 'suv bir joyda', zona: [0.775, 0.556, 0.946, 0.92], nom: 'Sanuzel', rasm: 6, yon: -1, belgi: 'Dumaloq oyna', joy: [0.7, 0.35],
    sabab: "Sanuzel oshxona bilan yonma-yon. Suv quvurlari bir devor yonida jamlangan, shuning uchun quvur uzun tortilmaydi.",
    boshqa: "Sanuzel uzoqqa qo'yilsa, quvur uzayadi va ta'mirlash qimmatlashadi." },
];
const jami = Q.length;
const HOOK = "Bu kvartirada har bir mebel o'z joyida turibdi. Keling, nega aynan shunday ekanini ko'ramiz.";
const OXIR = "Har bir joylashuvning sababi bor. Vizart Dizayn jamoasi sizning kvartirangizda ham shunday o'ylaydi.";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pilotB-'));
const segs = [], sub = []; let t = 0, id = 0;
const reja = path.join(dir, 'reja.png');
const imgs = (i) => path.join(dir, `${i}.jpg`);
async function qosh(matn, build) {
  const mp3 = path.join(tmp, `v${id}.mp3`); await ovozYarat(process.env, matn, mp3, tmp);
  const { stdout } = await ex('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]);
  const dur = parseFloat(stdout) + 0.45, seg = path.join(tmp, `s${id}.mp4`);
  await build(mp3, dur, seg, path.join(tmp, `f${id}`)); id++;
  segs.push(seg);
  const sz = matn.split(/\s+/), bol = []; for (let k = 0; k < sz.length; k += 2) bol.push(sz.slice(k, k + 2).join(' '));
  const jam = bol.reduce((a, x) => a + x.length, 0); let tt = t + 0.1;
  for (const x of bol) { const d = (x.length / jam) * (dur - 0.45); sub.push({ bosh: tt, tugash: tt + d, matn: x }); tt += d; }
  t += dur; console.log('segment', id, 'tayyor');
}
await qosh(HOOK, (mp3, dur, seg, fd) => rejaSegment({ plan: reja, zona: null, n: 1, jami, bolim: BOLIM, sarlavha: 'nega shunday?', tag: 'kvartira rejasi tahlili', mp3, dur }, fd, seg));
for (let i = 0; i < Q.length; i++) {
  const q = Q[i];
  await qosh(q.sabab, (mp3, dur, seg, fd) => rejaSegment({ plan: reja, zona: q.zona, zonaNom: q.nom, n: i + 1, jami, bolim: BOLIM, sarlavha: q.sar, tag: q.tag, mp3, dur }, fd, seg));
  await qosh(q.boshqa, (mp3, dur, seg, fd) => qadamSegment({ img: imgs(q.rasm), n: i + 1, jami, bolim: "Boshqacha bo'lsa...", sarlavha: q.sar, tag: 'va natija', belgi: q.belgi, belgiJoy: q.joy, parallaks: true, yon: q.yon, mp3, dur }, fd, seg));
}
await qosh(OXIR, (mp3, dur, seg, fd) => qadamSegment({ img: imgs(2), n: jami, jami, bolim: BOLIM, sarlavha: 'Vizart Dizayn', tag: 'har qadam o\'ylangan', parallaks: true, yon: 1, mp3, dur }, fd, seg));
fs.writeFileSync(path.join(tmp, 'list.txt'), segs.map((s) => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
const joined = path.join(tmp, 'joined.mp4');
await ex('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy', joined]);
const withSub = path.join(tmp, 'sub.mp4');
await srtVideogaKuydir(joined, sub, withSub, true).catch((e) => console.log('subtitr xato', e.message));
const base = fs.existsSync(withSub) ? withSub : joined;
const mus = muzikaTanla('hashamatli');
if (mus) await ffmpegMuzikaQosh(base, mus, out); else fs.copyFileSync(base, out);
console.log('TAYYOR:', out);
