// B seriya: "Nega shunday loyihalangan". Reja (tepadan) + 3D parallaks render + muqobil kamchiligi.
// node pilotB.mjs pilot_renders pilotB.mp4   (papkada: reja.png, 1.jpg..6.jpg)
import fs from 'fs'; import os from 'os'; import path from 'path';
import { execFile } from 'child_process'; import { promisify } from 'util';
import { qadamSegment } from './renderReel.js';
import { rejaSegment } from './rejaReel.js';
import { ovozTahrir, ovozYarat, srtVideogaKuydir, muzikaTanla, ffmpegMuzikaQosh } from './montaj.js';
const ex = promisify(execFile);
for (const l of fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8').split(/\r?\n/) : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const dir = process.argv[2], out = path.resolve(process.argv[3] || 'pilotB.mp4');
const BOLIM = 'Moxir kvartirasi';
// zona: rejadagi to'rtburchak (nisbiy). rasm: render raqami. sabab -- reja ustida; boshqa -- renderda (muqobil kamchiligi)
const Q = [
  { sar: 'umumiy bo\'shliq', tag: 'devorsiz, yorug\'', zona: [0.386, 0.084, 0.775, 0.943], nom: 'Bitta bo\'shliq', rasm: 2, yon: 1, belgi: 'Yorug\'lik hamma joyda', joy: [0.5, 0.6],
    kam: "devor tortilsa — qorong'i",
    sabab: "Mana bu yerda devor yo'q. Mehmonxona, stol va oshxona bitta bo'shliqda, shuning uchun deraza yorug'ligi hamma burchakka yetib boradi.",
    boshqa: "Shu yerga devor tortsak-chi? O'rtadagi xona qorong'i va tor bo'lib qoladi, kunduzi ham chiroq yoqishga to'g'ri keladi." },
  { sar: 'divan va stol', tag: 'orasida bo\'sh yo\'lak', zona: [0.457, 0.118, 0.718, 0.578], nom: 'Yo\'lak', rasm: 1, yon: -1, belgi: 'Bo\'sh yo\'lak', joy: [0.5, 0.65],
    kam: "yaqin qo'yilsa — tor",
    sabab: "Divan bilan stol orasida atayin bo'sh joy qoldirdik. Stuldan turasiz, kimdir o'tadi, hech kim hech kimga tegmaydi.",
    boshqa: "Divanni stolga yaqinlashtirsak, har safar o'rningizdan turish azobga aylanadi." },
  { sar: 'oshxona', tag: 'hammasi qo\'l yetadigan joyda', zona: [0.775, 0.084, 0.946, 0.533], nom: 'Oshxona', rasm: 3, yon: 1, belgi: 'Tekis fasad', joy: [0.5, 0.45],
    kam: "tarqoq texnika — ortiqcha yurish",
    sabab: "Oshxona bitta devor bo'ylab: kir yuvish mashinasi, plita, muzlatgich va moyka yonma-yon. Bir joyda turib hammasiga qo'lingiz yetadi.",
    boshqa: "Texnika xonaning turli chetlariga tarqalsa, har ovqatda xona bo'ylab yugurib yurasiz." },
  { sar: 'yotoqxona', tag: 'tinch burchak', zona: [0.015, 0.23, 0.37, 0.94], nom: 'Yotoqxona', rasm: 4, yon: -1, belgi: 'Yashirin yoritish', joy: [0.68, 0.57],
    kam: "eshik oldida — tinchlik yo'q",
    sabab: "Yotoqxona alohida va tinch. Karavot devorga suyangan, shkaf esa kirish yonida, shuning uchun erta turganda hech kimni uyg'otmaysiz.",
    boshqa: "Karavot eshik oldiga qo'yilsa, kirgan har bir odam to'g'ri yotoqqa qaraydi, tinchlik qolmaydi." },
];
const jami = Q.length;
let HOOK = "Bu kvartirada birorta mebel tasodifan turmagan. Hozir nega aynan shu yerda ekanini ko'rsataman.";
let OXIR = "Har bir joyning o'z sababi bor. Vizart Dizayn jamoasi sizning uyingizni ham shunday o'ylab chiqadi.";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pilotB-'));
const segs = [], sub = []; let t = 0, id = 0;
const reja = path.join(dir, 'reja.png');
{
  const arr = [{ sarlavha: 'hook', ovoz: HOOK }, ...Q.flatMap((q) => [{ sarlavha: q.sar, ovoz: q.sabab }, { sarlavha: q.sar, ovoz: q.boshqa }]), { sarlavha: 'oxir', ovoz: OXIR }];
  const tuz = await ovozTahrir(process.env, arr, true, false);
  HOOK = tuz[0].ovoz; Q.forEach((q, i) => { q.sabab = tuz[1 + 2 * i].ovoz; q.boshqa = tuz[2 + 2 * i].ovoz; }); OXIR = tuz[tuz.length - 1].ovoz;
  fs.writeFileSync(out.replace(/\.mp4$/, '_matn.txt'), [HOOK, ...Q.flatMap((q) => [q.sabab, q.boshqa]), OXIR].join('\n'));
}
const imgs = (i) => path.join(dir, `${i}.jpg`);
async function qosh(matn, build, teg = '') {
  const mp3 = path.join(tmp, `v${id}.mp3`); await ovozYarat(process.env, (teg ? `${teg} ` : '') + matn, mp3, tmp);
  const { stdout } = await ex('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]);
  const dur = parseFloat(stdout) + 0.45, seg = path.join(tmp, `s${id}.mp4`);
  await build(mp3, dur, seg, path.join(tmp, `f${id}`)); id++;
  segs.push(seg);
  const sz = matn.split(/\s+/), bol = []; for (let k = 0; k < sz.length; k += 2) bol.push(sz.slice(k, k + 2).join(' '));
  const jam = bol.reduce((a, x) => a + x.length, 0); let tt = t + 0.1;
  for (const x of bol) { const d = (x.length / jam) * (dur - 0.45); sub.push({ bosh: tt, tugash: tt + d, matn: x }); tt += d; }
  t += dur; console.log('segment', id, 'tayyor');
}
await qosh(HOOK, (mp3, dur, seg, fd) => rejaSegment({ plan: reja, zona: null, n: 1, jami, bolim: '', sarlavha: 'nega shunday?', tag: 'kvartira rejasi tahlili', mp3, dur }, fd, seg), '[confident, energetic, fast-paced, intriguing]');
for (let i = 0; i < Q.length; i++) {
  const q = Q[i];
  await qosh(q.sabab, (mp3, dur, seg, fd) => rejaSegment({ plan: reja, zona: q.zona, zonaNom: q.nom, n: i + 1, jami, bolim: '', sarlavha: q.sar, tag: q.tag, mp3, dur }, fd, seg), '[confident, energetic, clear]');
  await qosh(q.boshqa, (mp3, dur, seg, fd) => qadamSegment({ img: imgs(q.rasm), n: i + 1, jami, bolim: '', sarlavha: q.sar, tag: q.kam, belgi: q.belgi, belgiJoy: q.joy, parallaks: true, yon: q.yon, mp3, dur }, fd, seg), '[serious, firm, confident]');
}
await qosh(OXIR, (mp3, dur, seg, fd) => qadamSegment({ img: imgs(2), n: jami, jami, bolim: '', sarlavha: 'Vizart Dizayn', tag: 'har qadam o\'ylangan', parallaks: true, yon: 1, mp3, dur }, fd, seg), '[warm, confident, upbeat]');
fs.writeFileSync(path.join(tmp, 'list.txt'), segs.map((s) => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
const joined = path.join(tmp, 'joined.mp4');
await ex('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy', joined]);
const withSub = path.join(tmp, 'sub.mp4');
await srtVideogaKuydir(joined, sub, withSub, true).catch((e) => console.log('subtitr xato', e.message));
const base = fs.existsSync(withSub) ? withSub : joined;
const mus = ['hashamatli', 'sokin', 'ilhomlantiruvchi', 'energetik'].map((k) => muzikaTanla(k)).find(Boolean);
if (mus) await ffmpegMuzikaQosh(base, mus, out); else fs.copyFileSync(base, out);
console.log('TAYYOR:', out);
