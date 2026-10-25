// B seriya avtomat: "Nega shunday loyihalangan". Papkada: reja.png + 1.jpg..N.jpg (+ ixtiyoriy senariy.json -- qo'lda tahrir).
// node reelB.mjs <papka> <chiqish.mp4> [uzun|teaser] ["Obyekt nomi"]
import fs from 'fs'; import os from 'os'; import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process'; import { promisify } from 'util';
import sharp from 'sharp';
import { qadamSegment } from './renderReel.js';
import { rejaSegment } from './rejaReel.js';
import { ovozTahrir, ovozYarat, srtVideogaKuydir, muzikaTanla, ffmpegMuzikaDuck, sfxQosh } from './montaj.js';
import { elchiOblojka } from './oblojkaElchi.js';
import { yuzTanla } from './yuz.js';
const ex = promisify(execFile);
const MODELLAR = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const SFX = {
  pol: { fx: [{ k: 'pol__', t: 2.2, v: 0.3 }] },
  oshxona: { nom: 'oshxona__refrigerator', fx: [{ k: 'oshxona__stove', t: 1.0, v: 0.3 }] },
  eshik: { fx: [{ k: 'eshik__creaky-door-open', t: 1.3, v: 0.4 }] },
  shamol: { nom: 'shamol' }, suv: { nom: 'suv__water-flowing' },
};

const jpgB64 = async (p, w) => (await sharp(p).resize(w, w, { fit: 'inside' }).jpeg({ quality: 82 }).toBuffer()).toString('base64');

// Gemini: reja + renderlardan senariy (zonalar, matnlar, yorliqlar)
export async function senariyYoz(env, dir, nom = '') {
  const kesh = path.join(dir, 'senariy.json');
  if (fs.existsSync(kesh)) return JSON.parse(fs.readFileSync(kesh, 'utf8'));
  const renders = fs.readdirSync(dir).filter((f) => /^\d+\.jpe?g$/i.test(f)).sort((a, b) => parseInt(a) - parseInt(b));
  const parts = [{
    text: `Siz arxitektura/interyer dizayn Reels senaristisiz. Birinchi rasm -- AutoCAD reja (tepadan ko'rinish). Keyingi rasmlar -- renderlar, tartib raqami 1..${renders.length}${nom ? `. Loyiha: ${nom}` : ''}.\n` +
      `Rejani ANIQ o'qing (o'lchamlar, mebel, yo'laklar, deraza/eshik) va 3 ta eng qiziqarli dizayn qarorini tanlang. Faqat JSON obyekt qaytaring:\n` +
      `{"hook":"<=12 so'z, savol yoki ziddiyat","oblojka":"<=5 so'z mavzu sarlavhasi","hero":<eng chiroyli render raqami>,"oxir":"<=16 so'z, jamoa va Direct'ga yozishga chaqiruv","zonalar":[{"sar":"2-3 so'z","tag":"3-5 so'z","box":[ymin,xmin,ymax,xmax] (rejadagi zona, 0-1000),"nom":"1-2 so'z","rasm":<shu qaror ko'rinadigan render raqami>,"belgi":"2-3 so'z render yorlig'i","joy":[x,y] (0..1),"kam":"3-5 so'z, muqobil kamchiligi","sabab":"1-2 gap, <=22 so'z, nega shunday (rejadagi aniq o'lchamga tayanib)","boshqa":"1 gap, <=16 so'z, boshqacha qilinsa nima xato bo'ladi","sfx":"pol|oshxona|eshik|shamol|suv|null"}]}\n` +
      `Qoidalar: oddiy og'zaki o'zbek (lotin), qisqa gaplar, faqat rasmda ko'ringan narsaga tayan, o'ylab topma.`,
  }, { inlineData: { mimeType: 'image/jpeg', data: await jpgB64(path.join(dir, 'reja.png'), 1600) } }];
  for (const f of renders) parts.push({ inlineData: { mimeType: 'image/jpeg', data: await jpgB64(path.join(dir, f), 800) } });
  let xato;
  for (const m of MODELLAR) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.4 } }),
    });
    if (!res.ok) { xato = new Error(`Gemini ${m} ${res.status}`); continue; }
    const d = await res.json();
    const text = ((((d.candidates || [])[0] || {}).content || {}).parts || []).map((p) => p.text || '').join('');
    const mt = text.match(/\{[\s\S]*\}/);
    if (!mt) { xato = new Error('Gemini JSON qaytarmadi'); continue; }
    const s = JSON.parse(mt[0]);
    s.zonalar = (s.zonalar || []).slice(0, 3).map((z, i) => ({ ...z, zona: [z.box[1] / 1000, z.box[0] / 1000, z.box[3] / 1000, z.box[2] / 1000], yon: i % 2 ? -1 : 1 }));
    fs.writeFileSync(kesh, JSON.stringify(s, null, 2));
    return s;
  }
  throw xato;
}

export async function reelB(env, { dir, out, variant = 'uzun', nom = '' }) {
  const S = await senariyYoz(env, dir, nom);
  const teaser = variant === 'teaser';
  const Q = teaser ? S.zonalar.slice(0, 1) : S.zonalar, jami = Q.length;
  let HOOK = S.hook, OXIR = teaser ? "Visart Design, loyiha uchun Direct'ga yozing." : S.oxir;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reelB-'));
  const imgs = (i) => path.join(dir, `${i}.jpg`), reja = path.join(dir, 'reja.png'), hero = S.hero || 1;
  {
    const arr = [{ sarlavha: 'hook', ovoz: HOOK }, ...Q.flatMap((q) => [{ sarlavha: q.sar, ovoz: q.sabab }, { sarlavha: q.sar, ovoz: q.boshqa }]), { sarlavha: 'oxir', ovoz: OXIR }];
    const tuz = await ovozTahrir(env, arr, true, false);
    HOOK = tuz[0].ovoz; Q.forEach((q, i) => { q.sabab = tuz[1 + 2 * i].ovoz; q.boshqa = tuz[2 + 2 * i].ovoz; }); OXIR = tuz[tuz.length - 1].ovoz;
    fs.writeFileSync(out.replace(/\.mp4$/, '_matn.txt'), [HOOK, ...Q.flatMap((q) => [q.sabab, q.boshqa]), OXIR].join('\n'));
  }
  const segs = [], sub = []; let t = 0, id = 0;
  const W = (tt = 0, v = 0.3) => ({ k: 'whoosh__short', t: tt, v });
  async function qosh(matn, build, teg, sfx) {
    const mp3 = path.join(tmp, `v${id}.mp3`); await ovozYarat(env, `${teg} ${matn}`, mp3, tmp);
    const dd = async () => parseFloat((await ex('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3])).stdout);
    if (sfx) await sfxQosh(sfx.nom || '', mp3, await dd(), tmp, sfx.fx || []).catch((e) => console.log('sfx xato', e.message));
    const dur = (await dd()) + 0.45, seg = path.join(tmp, `s${id}.mp4`);
    await build(mp3, dur, seg, path.join(tmp, `f${id}`)); id++; segs.push(seg);
    const sz = matn.split(/\s+/), bol = []; for (let k = 0; k < sz.length; k += 2) bol.push(sz.slice(k, k + 2).join(' '));
    const jam = bol.reduce((a, x) => a + x.length, 0); let tt = t + 0.1;
    for (const x of bol) { const d = (x.length / jam) * (dur - 0.45); sub.push({ bosh: tt, tugash: tt + d, matn: x }); tt += d; }
    t += dur; console.log('segment', id, 'tayyor');
  }
  await qosh(HOOK, (mp3, dur, seg, fd) => qadamSegment({ img: imgs(hero), n: 1, jami, bolim: '', sarlavha: 'nega shunday?', tag: 'har bir mebelning sababi bor', parallaks: true, yon: -1, mp3, dur }, fd, seg), '[confident, energetic, fast-paced, intriguing]', { fx: [W(0, 0.35), { k: 'qurilish__tape', t: 0.4, v: 0.35 }] });
  for (let i = 0; i < Q.length; i++) {
    const q = Q[i], sf = SFX[q.sfx] || {};
    await qosh(q.sabab, (mp3, dur, seg, fd) => rejaSegment({ plan: reja, zona: q.zona, zonaNom: q.nom, n: i + 1, jami, bolim: '', sarlavha: q.sar, tag: q.tag, mp3, dur }, fd, seg), '[confident, energetic, clear]', { fx: [W(), { k: 'klik__select', t: 0.7, v: 0.35 }] });
    await qosh(q.boshqa, (mp3, dur, seg, fd) => qadamSegment({ img: imgs(q.rasm), n: i + 1, jami, bolim: '', sarlavha: q.sar, tag: q.kam, belgi: q.belgi, belgiJoy: q.joy, parallaks: true, yon: q.yon, mp3, dur }, fd, seg), '[serious, firm, confident]', { ...sf, fx: [W(), ...(sf.fx || [])] });
  }
  await qosh(OXIR, (mp3, dur, seg, fd) => qadamSegment({ img: imgs(hero), n: jami, jami, bolim: '', sarlavha: 'Visart Design', tag: "loyiha uchun Direct'ga yozing", parallaks: true, yon: 1, mp3, dur }, fd, seg), '[warm, confident, upbeat]', { nom: 'qushlar__morning', fx: [W(0, 0.35)] });
  fs.writeFileSync(path.join(tmp, 'list.txt'), segs.map((s) => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
  const joined = path.join(tmp, 'joined.mp4');
  await ex('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy', joined]);
  const withSub = path.join(tmp, 'sub.mp4');
  await srtVideogaKuydir(joined, sub, withSub, true).catch((e) => console.log('subtitr xato', e.message));
  const base = fs.existsSync(withSub) ? withSub : joined;
  const mus = ['hashamatli', 'sokin'].map((k) => muzikaTanla(k)).find(Boolean);
  if (mus) await ffmpegMuzikaDuck(base, mus, out); else fs.copyFileSync(base, out);
  // Oblojka: Doston surati + render + mavzu sarlavhasi
  try {
    const yuzBuf = await yuzTanla(env, 'yuz').catch(() => null);
    let logoB64 = ''; try { logoB64 = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'logo-mark.png')).toString('base64'); } catch (e) { /* ixtiyoriy */ }
    const jpg = await elchiOblojka({ sarlavha: S.oblojka || HOOK, vurgu: '', fotoBuf: fs.readFileSync(imgs(hero)), yuzBuf, logoB64 });
    fs.writeFileSync(out.replace(/\.mp4$/, '_oblojka.jpg'), jpg);
  } catch (e) { console.log('oblojka xato', e.message); }
  console.log('TAYYOR:', out);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const l of fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8').split(/\r?\n/) : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
  const [dir, out = 'reelB.mp4', variant = 'uzun', nom = ''] = process.argv.slice(2);
  await reelB(process.env, { dir, out: path.resolve(out), variant, nom });
}
