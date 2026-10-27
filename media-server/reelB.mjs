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
import { sablonOblojka, sablonTanla } from './oblojkaShablon.js';
const ex = promisify(execFile);
const MODELLAR = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];
const SFX = {
  pol: { fx: [{ k: 'pol__', t: 2.2, v: 0.3 }] },
  oshxona: { nom: 'oshxona__refrigerator', fx: [{ k: 'oshxona__stove', t: 1.0, v: 0.3 }] },
  eshik: { fx: [{ k: 'eshik__creaky-door-open', t: 1.3, v: 0.4 }] },
  shamol: { nom: 'shamol' }, suv: { nom: 'suv__water-flowing' },
};

const jpgB64 = async (p, w) => (await sharp(p).resize(w, w, { fit: 'inside' }).jpeg({ quality: 82 }).toBuffer()).toString('base64');

// Gemini chaqiruvi (model zanjiri); rasm qismlari bilan JSON obyekt qaytaradi
async function geminiObj(env, parts, temperature = 0.3) {
  let xato;
  for (const m of MODELLAR) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature } }),
    });
    if (!res.ok) { xato = new Error(`Gemini ${m} ${res.status}`); console.log('Gemini xato:', m, res.status); continue; }
    const d = await res.json();
    const text = ((((d.candidates || [])[0] || {}).content || {}).parts || []).map((p) => p.text || '').join('');
    const mt = text.match(/\{[\s\S]*\}/);
    if (!mt) { xato = new Error('Gemini JSON qaytarmadi'); continue; }
    try { console.log('Gemini model:', m); return JSON.parse(mt[0]); } catch (e) { xato = e; }
  }
  throw xato;
}

// 1-bosqich: rejadan faktlar. 2-bosqich: faktlar + renderlardan senariy (faqat faktlarga tayanib).
import { QONUN, tekshir } from './senariyQoida.js';
import { senariyV2 } from './senariyV2.js';
import { raqamSegment } from './izohReel.js';
import { USLUB } from './strategist.js';
export async function senariyYoz(env, dir, nom = '') {
  const kesh = path.join(dir, 'senariy.json');
  if (fs.existsSync(kesh)) return JSON.parse(fs.readFileSync(kesh, 'utf8'));
  const renders = fs.readdirSync(dir).filter((f) => /^\d+\.jpe?g$/i.test(f)).sort((a, b) => parseInt(a) - parseInt(b));
  const rejaB = { inlineData: { mimeType: 'image/jpeg', data: await jpgB64(path.join(dir, 'reja.png'), 2200) } };
  const renderB = [];
  for (const f of renders) renderB.push({ inlineData: { mimeType: 'image/jpeg', data: await jpgB64(path.join(dir, f), 900) } });
  const faktlar = await geminiObj(env, [{ text:
    `Birinchi rasm -- AutoCAD reja (tepadan). Faqat rasmda HAQIQATAN ko'ringan narsalarni yozing, o'ylab topmang. Ruscha yozuvlarni o'zbekchaga tarjima qiling (СТОЛ=stol, ДИВАН=divan, ШКАФ=shkaf, ТВ=televizor, СЕРВАНТ=servant, САНУЗЕЛ=sanuzel, Холодильник=muzlatgich, Мойка=moyka, Плита=plita). JSON: {"xonalar":[{"nom":"xona nomi","box":[ymin,xmin,ymax,xmax] (0-1000),"olchamlar":["rejada yozilgan raqamlar va nimaga tegishli"],"mebel":["..."],"qoshni":["..."],"eshik_deraza":"..."}],"umumiy":"tartib haqida 1-2 gap"}` },
    rejaB], 0.1);
  // 1b: o'lchanadigan elementlar (animatsiya chiziqlari uchun nuqtalar)
  try {
    const el = await geminiObj(env, [{ text: `Birinchi rasm -- AutoCAD reja (tepadan). FAKTLAR: ${JSON.stringify(faktlar)}\nReja ustida o'lchami yozilgan yoki aniq o'lchab bo'ladigan 5-9 ta element ro'yxati (yo'lak kengligi, eshik, stol va devor oralig'i, oshxona ish zonasi tomoni, divan va devor orasi kabi). Faqat rasmda HAQIQATAN ko'ringanlarni yozing. JSON: {"elementlar":[{"id":"e1","xona":"FAKTLARdagi xona nomi","nom":"qisqa nom","olcham":"rejada yozilgan qiymat masalan '90 sm' yoki '1250' (bo'lmasa null)","a":[y,x],"b":[y,x]}]} -- a va b o'lchanayotgan oraliqning ikki uchi, 0-1000 koordinata [y,x].` }, rejaB], 0.1);
    faktlar.elementlar = (el.elementlar || []).filter((e) => e && e.id && Array.isArray(e.a) && Array.isArray(e.b) && [...e.a, ...e.b].every((v) => Number(v) >= 0 && Number(v) <= 1000)).slice(0, 10);
  } catch (e) { console.log('elementlar xato:', e.message); faktlar.elementlar = []; }
  if (process.env.MEDIA_SECRET && process.env.SENARIY_V1 !== '1' && (faktlar.elementlar || []).length) {
    try {
      const e2 = await senariyV2({ faktlar, renderlar: renders.length });
      const S2 = { ...e2.S, v2: true, ball: e2.ball, faktlar };
      fs.writeFileSync(kesh, JSON.stringify(S2, null, 2));
      return S2;
    } catch (e) { console.log("Senariy v2 ishlamadi, eski usulga qaytildi:", e.message); }
  }
  let S = await geminiObj(env, [{
    text: `Siz arxitektura/interyer dizayn Reels senaristisiz. Auditoriya: kvartira/uy egalari va dizayn sevuvchilar. Quyida rejadan olingan FAKTLAR va renderlar (tartib raqami 1..${renders.length}).\nFAKTLAR: ${JSON.stringify(faktlar)}\n` +
      `Vazifa: 3 ta eng qiziqarli va FOYDALI dizayn qarorini tanlang. Har biri uchun odamga o'zi uyida qo'llay oladigan umumiy ergonomika qoidasini (aniq raqam bilan, odatda qabul qilingan me'yor) ayting va shu qaror bu rejada qanday ishlaganini FAKTLARdagi o'lchamga bog'lang. Renderni faqat shu xona/qaror ROSTDAN ko'rinsa tanlang (rasmga qarang). Faqat JSON obyekt:\n` +
      `{"hook":"<=10 so'z, aniq savol (masalan: Dush necha santimetr bo'lsa qulay?). '3 ta sir' kabi umumiy va'dalar TAQIQ","oblojka":"<=6 so'z, videoning HAQIQIY mazmuniga mos UMUMIY mavzu va foyda (masalan: Qulay uy uchun 3 ta o'lcham qoidasi). Mijoz ismi, loyiha nomi, 'kvartirasi' kabi nomlar TAQIQ","hero":<eng chiroyli render>,"oxir":"<=30 so'z: Tabriklayman, Visart Design bilan uyni to'g'ri loyihaladingiz; sizga ham shunday loyiha kerak bo'lsa Direct'ga REJA deb yozing","zonalar":[{"sar":"2-3 so'z","tag":"3-5 so'z","xona":"FAKTLARdagi xona nomi","nom":"1-2 so'z","rasm":<render raqami>,"belgi":"2-3 so'z render yorlig'i","joy":[x,y],"kam":"3-5 so'z","muammo":"<=18 so'z: me'yor (raqam) + buzilsa oqibat","yechim":"<=16 so'z, 'Visart Design' bilan boshlanadi: shu rejada aniq nima qilgani (FAKTLARdagi o'lcham)","yangi":"<=14 so'z, 'Lekin' bilan boshlanadi: shu yechimning yon kamchiligi","yechim2":"<=16 so'z, 'Visart Design' bilan boshlanadi: yon kamchilikni qanday hal qilgani","sfx":"pol|oshxona|eshik|shamol|suv|null"}]}\n` +
      `QONUN (majburiy):\n- ${QONUN.join('\n- ')}` +
      `\nUSLUB (Visart strategist):\n- ${USLUB.join('\n- ')}`,
  }, ...renderB], 0.4);
  const tuz = async (A) => {
    for (let i = 0; i < 2; i++) {
      const x = tekshir(A, faktlar, nom);
      if (!x.length) return A;
      console.log('Senariy qonun buzilishlari:', x.join('; '));
      try { A = await geminiObj(env, [{ text: `Quyidagi senariyni QONUNga muvofiq TUZATING, faqat shu xatolarni: ${x.join('; ')}.\nQONUN:\n- ${QONUN.join('\n- ')}\nFAKTLAR: ${JSON.stringify(faktlar)}\nSENARIY: ${JSON.stringify(A)}\nO'sha JSON tuzilmasini qaytaring.` }], 0.2); } catch (e) { console.log('Tuzatish xato:', e.message); break; }
    }
    return A;
  };
  const boxOf = (xn) => { const x = (faktlar.xonalar || []).find((r) => String(r.nom).toLowerCase() === String(xn).toLowerCase()) || (faktlar.xonalar || []).find((r) => String(r.nom).toLowerCase().includes(String(xn).toLowerCase().split(' ')[0])); return x && x.box; };
  S = await tuz(S);
  S.zonalar = (S.zonalar || []).slice(0, 3).map((z, i) => {
    const b = boxOf(z.xona) || z.box || [100, 100, 900, 900];
    return { ...z, sabab: z.muammo || z.sabab, boshqa: z.yechim ? [z.yechim, z.yangi, z.yechim2].filter(Boolean).join(' ') : z.boshqa, box: b, zona: [b[1] / 1000, b[0] / 1000, b[3] / 1000, b[2] / 1000], yon: i % 2 ? -1 : 1 };
  });
  S.faktlar = faktlar;
  fs.writeFileSync(kesh, JSON.stringify(S, null, 2));
  return S;
}

export async function reelB(env, { dir, out, variant = 'uzun', nom = '' }) {
  const S = await senariyYoz(env, dir, nom);
  const teaser = variant === 'teaser';
  const V2 = !!S.v2;
  const B = V2 ? (teaser ? S.bolimlar.filter((q) => q.rol === 'qoida').slice(0, 1) : S.bolimlar) : [];
  const Q = V2 ? [] : (teaser ? S.zonalar.slice(0, 1) : S.zonalar), jami = V2 ? B.length + 2 : Q.length;
  let HOOK = S.hook, OXIR = teaser ? "Visart Design, loyiha uchun Direct'ga yozing." : S.oxir;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reelB-'));
  const imgs = (i) => path.join(dir, `${i}.jpg`), reja = path.join(dir, 'reja.png'), hero = S.hero || 1;
  {
    const arr = V2 ? [{ sarlavha: 'hook', ovoz: HOOK }, ...B.map((q) => ({ sarlavha: q.rol, ovoz: q.ovoz })), { sarlavha: 'oxir', ovoz: OXIR }]
      : [{ sarlavha: 'hook', ovoz: HOOK }, ...Q.flatMap((q) => [{ sarlavha: q.sar, ovoz: q.sabab }, { sarlavha: q.sar, ovoz: q.boshqa }]), { sarlavha: 'oxir', ovoz: OXIR }];
    const tuz = await ovozTahrir(env, arr, true, false);
    HOOK = tuz[0].ovoz; OXIR = tuz[tuz.length - 1].ovoz;
    if (V2) B.forEach((q, i) => { q.ovoz = tuz[1 + i].ovoz; }); else Q.forEach((q, i) => { q.sabab = tuz[1 + 2 * i].ovoz; q.boshqa = tuz[2 + 2 * i].ovoz; });
    fs.writeFileSync(out.replace(/\.mp4$/, '_matn.txt'), (V2 ? [HOOK, ...B.map((q) => q.ovoz), OXIR] : [HOOK, ...Q.flatMap((q) => [q.sabab, q.boshqa]), OXIR]).join('\n'));
  }
  const segs = [], sub = []; let t = 0, id = 0;
  const W = (tt = 0, v = 0.3) => ({ k: 'whoosh__short', t: tt, v });
  async function qosh(matn, build, teg, sfx) {
    const mp3 = path.join(tmp, `v${id}.mp3`); await ovozYarat(env, `${teg} ${matn}`, mp3, tmp);
    const dd = async () => parseFloat((await ex('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3])).stdout);
    if (sfx) await sfxQosh(sfx.nom || '', mp3, await dd(), tmp, sfx.fx || []).catch((e) => console.log('sfx xato', e.message));
    const dur = (await dd()) + 0.45, seg = path.join(tmp, `s${id}.mp4`);
    await build(mp3, dur, seg, path.join(tmp, `f${id}`)); id++; segs.push(seg);
    const sz = matn.replace(/Vizart Dizayn/gi, 'Visart Design').split(/\s+/), bol = []; for (let k = 0; k < sz.length; k += 2) bol.push(sz.slice(k, k + 2).join(' '));
    const jam = bol.reduce((a, x) => a + x.length, 0); let tt = t + 0.1;
    for (const x of bol) { const d = (x.length / jam) * (dur - 0.45); sub.push({ bosh: tt, tugash: tt + d, matn: x }); tt += d; }
    t += dur; console.log('segment', id, 'tayyor');
  }
  await qosh(HOOK, (mp3, dur, seg, fd) => qadamSegment({ img: imgs(hero), n: 1, jami, bolim: '', sarlavha: 'nega shunday?', tag: 'har bir mebelning sababi bor', parallaks: true, yon: -1, mp3, dur }, fd, seg), '[confident, energetic, fast-paced, intriguing]', { fx: [W(0, 0.35), { k: 'qurilish__tape', t: 0.4, v: 0.35 }] });
  if (V2) {
    const TEG = { muammo: '[serious, firm, clear]', qoida: '[confident, energetic, clear]', xato: '[serious, firm, confident]', yechim: '[confident, warm, clear]', tekshiruv: '[friendly, clear, upbeat]' };
    const EL = (S.faktlar && S.faktlar.elementlar) || [];
    for (let i = 0; i < B.length; i++) {
      const q = B[i], k = q.kadr || {}, nn = i + 2, teg = TEG[q.rol] || '[confident, clear]';
      const baz = { n: nn, jami, sarlavha: q.sar || q.rol, tag: q.tag || '' };
      if (k.tur === 'reja') {
        const els = (k.elementlar || []).map((id) => EL.find((e) => e.id === id)).filter(Boolean);
        let zona = null, belgilar = [];
        if (els.length) {
          const xs = els.flatMap((e) => [e.a[1], e.b[1]]).map((v) => v / 1000), ys = els.flatMap((e) => [e.a[0], e.b[0]]).map((v) => v / 1000);
          const px = Math.max(0.1, 0.5 * (0.2 - (Math.max(...xs) - Math.min(...xs)))), py = Math.max(0.1, 0.5 * (0.2 - (Math.max(...ys) - Math.min(...ys))));
          zona = [Math.max(0, Math.min(...xs) - px - 0.05), Math.max(0, Math.min(...ys) - py - 0.05), Math.min(1, Math.max(...xs) + px + 0.05), Math.min(1, Math.max(...ys) + py + 0.05)];
          belgilar = els.map((e) => ({ tur: 'olcham', a: [e.a[1] / 1000, e.a[0] / 1000], b: [e.b[1] / 1000, e.b[0] / 1000], yozuv: String(e.olcham || e.nom || '').slice(0, 20) }));
        } else { const x = (S.faktlar.xonalar || []).find((r) => String(r.nom).toLowerCase() === String(k.xona || '').toLowerCase()); if (x && x.box) zona = [x.box[1] / 1000, x.box[0] / 1000, x.box[3] / 1000, x.box[2] / 1000]; }
        await qosh(q.ovoz, (mp3, dur, seg, fd) => rejaSegment({ plan: reja, zona, zonaNom: k.xona || '', belgilar, ...baz, bolim: '', mp3, dur }, fd, seg), teg, { fx: [W(), { k: 'klik__select', t: 0.7, v: 0.35 }] });
      } else if (k.tur === 'raqam') {
        await qosh(q.ovoz, (mp3, dur, seg, fd) => raqamSegment({ a: k.a, b: k.b, birlik: k.birlik || '', ...baz, mp3, dur }, fd, seg), teg, { fx: [W(), { k: 'klik__select', t: 0.5, v: 0.3 }] });
      } else {
        await qosh(q.ovoz, (mp3, dur, seg, fd) => qadamSegment({ img: imgs(Number(k.rasm) || hero), ...baz, bolim: '', belgi: k.belgi, belgiJoy: k.joy, parallaks: true, yon: i % 2 ? -1 : 1, mp3, dur }, fd, seg), teg, { fx: [W()] });
      }
    }
  }
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
    let yuzBuf = null;
    try { const yd = path.join(path.dirname(fileURLToPath(import.meta.url)), 'yuz'); const yf = fs.existsSync(yd) ? fs.readdirSync(yd).filter((f) => /\.(jpe?g|png)$/i.test(f)) : []; if (yf.length) yuzBuf = fs.readFileSync(path.join(yd, yf[Math.floor(Math.random() * yf.length)])); } catch (e) { /* ixtiyoriy */ }
    if (!yuzBuf) yuzBuf = await yuzTanla(env, 'yuz').catch(() => null);
    if (!yuzBuf) console.log("DIQQAT: oblojkaga yuz topilmadi -- media-server\\yuz\\ papkasiga portret qo'ying");
    const toza = (x) => String(x || '').replace(new RegExp(`\\b(${[...String(nom).split(/\\s+/), 'kvartirasi', 'kvartira', 'uyi'].filter((w) => w.length > 2).join('|')})\\b`, 'gi'), '').replace(/\s+/g, ' ').trim();
    let logoB64 = ''; try { logoB64 = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'logo-mark.png')).toString('base64'); } catch (e) { /* ixtiyoriy */ }
    const sab = sablonTanla();
    const sarl = toza(S.oblojka) || toza(HOOK), fotoB = fs.readFileSync(imgs(hero));
    const jpg = sab ? await sablonOblojka({ sablon: sab, sarlavha: sarl, fotoBuf: fotoB, logoB64 })
      : await elchiOblojka({ sarlavha: sarl, vurgu: '', fotoBuf: fotoB, yuzBuf, logoB64 });
    fs.writeFileSync(out.replace(/\.mp4$/, '_oblojka.jpg'), jpg);
  } catch (e) { console.log('oblojka xato', e.message); }
  console.log('TAYYOR:', out);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const l of fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8').split(/\r?\n/) : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
  const bayroq = process.argv.slice(2).filter((a) => a.startsWith('--')), arg = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const ildiz = path.join(path.dirname(fileURLToPath(import.meta.url)), 'loyihalar'), reg = path.join(ildiz, 'ishlatilgan.json');
  let dir, nom;
  if (bayroq.includes('--auto')) {
    // Navbatdagi ishlatilmagan loyiha (har video -- boshqa interyer)
    const ishl = fs.existsSync(reg) ? JSON.parse(fs.readFileSync(reg, 'utf8')) : [];
    const bor = fs.readdirSync(ildiz, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(ildiz, d.name, 'reja.png'))).map((d) => d.name);
    const qoldi = bor.filter((n) => !ishl.includes(n));
    if (!qoldi.length) { console.log("Barcha loyihalar ishlatilgan. loyihalar\\ ga yangisini qo'shing yoki ishlatilgan.json ni tozalang."); process.exit(1); }
    nom = qoldi[0]; dir = path.join(ildiz, nom);
    if (!bayroq.includes('--senariy')) { ishl.push(nom); fs.writeFileSync(reg, JSON.stringify(ishl, null, 2)); }
  } else { dir = arg[0]; nom = arg[3] || ''; }
  const out = path.resolve((bayroq.includes('--auto') ? arg[0] : arg[1]) || 'reelB.mp4'), variant = (bayroq.includes('--auto') ? arg[1] : arg[2]) || 'uzun';
  if (bayroq.includes('--tekshir')) { const S = JSON.parse(fs.readFileSync(path.join(dir, 'senariy.json'), 'utf8')); const x = tekshir(S, S.faktlar, nom); console.log(x.length ? 'BUZILISH:\n- ' + x.join('\n- ') : 'QONUNGA MOS'); process.exit(0); }
  if (bayroq.includes('--senariy')) { const S = await senariyYoz(process.env, dir, nom); console.log(JSON.stringify({ hook: S.hook, oblojka: S.oblojka, hero: S.hero, oxir: S.oxir, zonalar: S.zonalar.map((z) => ({ xona: z.xona, rasm: z.rasm, qoida: z.qoida, sabab: z.sabab, boshqa: z.boshqa })) }, null, 2)); console.log('Tekshiring/tahrirlang:', path.join(dir, 'senariy.json')); }
  else await reelB(process.env, { dir, out, variant, nom });
}
