// Vizual effekt + ovoz effekti agenti: gapirilayotgan mazmunga mos rasm/animatsion kesim (cutaway) va MAJBURIY sound effectlar.
// Kirish: kesilgan video (original ovozi saqlanadi) va nutq segmentlari [{bosh,tugash,matn}]. Chiqish: yangi video yoki null.
// Barcha qadamlar ixtiyoriy: xato bo'lsa original video o'zgarmaydi, lekin ovoz effektlari (whoosh/klik) har holda qo'shishga uriniladi.
import fs from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const exec = promisify(execFile);
const SFX_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'music', 'sfx');
const SFX_KALITLAR = ['eshik', 'qadam', 'qurilish', 'oshxona', 'sahifa', 'klik', 'shamol', 'suv', 'qushlar', 'pol'];

async function davomiylik(p) {
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', p]);
  return parseFloat(stdout) || 0;
}

const kutubxonaSfx = (k) => {
  try {
    const f = fs.readdirSync(SFX_DIR).filter((x) => x.toLowerCase().startsWith(k) && /\.(mp3|wav|m4a)$/i.test(x));
    return f.length ? path.join(SFX_DIR, f[Math.floor(Math.random() * f.length)]) : null;
  } catch { return null; }
};

// Kutubxonada yo'q "whoosh" va "pop" sintez qilinadi (ffmpeg lavfi)
async function sintezSfx(tur, out) {
  const src = tur === 'pop'
    ? 'sine=f=720:d=0.12,afade=t=out:st=0.02:d=0.1,volume=1.4'
    : 'anoisesrc=color=pink:amplitude=0.9:d=0.7,highpass=f=350,lowpass=f=4200,afade=t=in:d=0.3,afade=t=out:st=0.3:d=0.4,volume=1.2';
  await exec('ffmpeg', ['-y', '-f', 'lavfi', '-i', src, '-ac', '2', '-ar', '44100', out]);
  return out;
}

async function sfxFayl(tur, tmp) {
  if (SFX_KALITLAR.includes(tur)) { const f = kutubxonaSfx(tur); if (f) return f; }
  const f = kutubxonaSfx(tur === 'whoosh' ? 'whoosh' : tur === 'pop' ? 'pop' : '__yoq__');
  if (f) return f;
  const out = path.join(tmp, `sfx_${tur === 'pop' ? 'pop' : 'whoosh'}.wav`);
  if (!fs.existsSync(out)) await sintezSfx(tur === 'pop' ? 'pop' : 'whoosh', out);
  return out;
}

// 1) Reja: nutq mazmuniga qarab qaysi joyda qanday vizual kesim va qaysi ovoz effekti kerak
async function rejaTuz(deps, env, segmentlar, jami) {
  const maks = Math.max(1, Math.min(5, Math.floor(jami / 8)));
  const matn = segmentlar.map((s, i) => `${i + 1}) [${s.bosh.toFixed(1)}-${s.tugash.toFixed(1)}] ${s.matn}`).join('\n');
  const javob = await deps.geminiJsonSora(env.GEMINI_API_KEY, [{ text:
    `Siz video muharriri-rejissyorsiz. Bu arxitektura/interyer mavzusidagi nutq (jami ${jami.toFixed(0)} s). Muallif gapirayotganda ekranda shu gapga MOS vizual kesim (cutaway: rasm) ko'rsatamiz, so'ng yana muallifga qaytamiz.\n` +
    `NUTQ:\n${matn}\n\n` +
    `QOIDALAR:\n- Ko'pi bilan ${maks} ta kesim. Faqat aniq narsa/joy/material/tushuncha tilga olingan joyda ('gumbaz', 'parket', 'oyna', 'shift'...). Umumiy gap uchun kesim qo'yma.\n` +
    `- Kesim davomi 2.0-3.5 s, u nutq gapi doirasida bo'lsin. Oralari kamida 4 s. Birinchi 1.5 s va oxirgi 2 s da kesim yo'q.\n` +
    `- 'prompt' INGLIZCHA, fotorealistik, aynan gapda aytilgan narsani ko'rsatsin, matn/yozuv/logo/aniq odam yuzi YO'Q, vertikal kadrga mos.\n` +
    `- 'vurgu': ekranda ko'rinadigan 1-3 so'zli o'zbekcha yozuv (aynan nutqdagi kalit so'z) yoki bo'sh.\n` +
    `- 'sfx': kesim boshlanganda eshitiladigan effekt: "whoosh" (har doim yaxshi) yoki mazmunga mos: ${SFX_KALITLAR.join(', ')} (masalan eshik haqida 'eshik'); aniq mos kelmasa 'whoosh'.\n` +
    `- 'pop_t': nutqdagi eng muhim so'z/son aytilgan sekund (pop effekti uchun) yoki null. Ko'pi bilan 2 ta, jami 'pop' massivda.\n` +
    `FAQAT JSON: {"kesimlar":[{"t":<boshlanish s>,"d":<davomi s>,"prompt":"...","vurgu":"...","sfx":"whoosh"}],"pop":[<sekundlar>]}` }]);
  const k = ((javob && javob.kesimlar) || []).filter((x) => x && isFinite(x.t) && isFinite(x.d) && x.prompt)
    .map((x) => ({ t: Number(x.t), d: Math.min(3.5, Math.max(1.8, Number(x.d))), prompt: String(x.prompt), vurgu: String(x.vurgu || '').slice(0, 30), sfx: String(x.sfx || 'whoosh').toLowerCase() }))
    .filter((x) => x.t >= 1.5 && x.t + x.d <= jami - 2)
    .sort((a, b) => a.t - b.t);
  const toza = [];
  for (const x of k) if (!toza.length || x.t - (toza[toza.length - 1].t + toza[toza.length - 1].d) >= 4) toza.push(x);
  const pop = ((javob && javob.pop) || []).map(Number).filter((x) => isFinite(x) && x > 0.5 && x < jami - 0.5).slice(0, 2);
  return { kesimlar: toza.slice(0, maks), pop };
}

// 2) Kesim kadri: rasm -> video o'lchamiga, pastda vurgu yozuvi
async function kadrTayyor(deps, env, k, W, H, out) {
  const r = await deps.rasmYarat(env, k.prompt, k.vurgu || k.prompt, true);
  let img = sharp(r.buf).resize(W, H, { fit: 'cover' });
  const qatlamlar = [];
  if (k.vurgu) {
    const fs_ = Math.round(W * 0.085), esc = k.vurgu.replace(/[<>&]/g, '');
    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.75"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/><text x="${W / 2}" y="${Math.round(H * 0.58)}" text-anchor="middle" font-family="Poppins, Arial, sans-serif" font-weight="800" font-size="${fs_}" fill="#fff" stroke="#000" stroke-width="${Math.round(fs_ * 0.06)}" paint-order="stroke">${esc}</text></svg>`;
    qatlamlar.push({ input: Buffer.from(svg) });
  }
  await img.composite(qatlamlar).jpeg({ quality: 88 }).toFile(out);
}

export async function effektQosh({ env, videoPath, segmentlar, tmpDir, outPath, deps, bosqich = async () => {} }) {
  const jami = await davomiylik(videoPath);
  if (!jami || jami < 6) return null;
  const { width: W, height: H } = await deps.ffmpegOlchamOl(videoPath);
  const w = W - (W % 2), h = H - (H % 2);
  let reja = { kesimlar: [], pop: [] };
  try { reja = await rejaTuz(deps, env, segmentlar || [], jami); } catch (e) { await bosqich(`⚠️ Effekt rejasi tuzilmadi: ${String((e && e.message) || e).slice(0, 150)}`).catch(() => {}); }

  // kadrlarni tayyorlash (xato bo'lgan kesim tushib qoladi)
  const kesimlar = [];
  for (let i = 0; i < reja.kesimlar.length; i++) {
    const k = reja.kesimlar[i], f = path.join(tmpDir, `kes${i}.jpg`);
    try { await kadrTayyor(deps, env, k, w, h, f); kesimlar.push({ ...k, f }); } catch { /* shu kesim o'tkazib yuboriladi */ }
  }

  // ovoz effektlari: har kesim boshida (+oxirida yengil) whoosh/mavzuviy, pop'lar, va montaj tutashuvlarida whoosh bo'lmaydi (nutqni buzmaslik uchun)
  const sfx = [];
  for (const k of kesimlar) {
    sfx.push({ t: Math.max(0, k.t - 0.08), tur: k.sfx, v: k.sfx === 'whoosh' ? 0.5 : 0.35 });
    sfx.push({ t: k.t + k.d - 0.1, tur: 'whoosh', v: 0.3 });
  }
  for (const t of reja.pop) sfx.push({ t, tur: 'pop', v: 0.5 });
  if (!kesimlar.length && !reja.pop.length) { // reja bo'lmasa ham kamida 2 ta yengil effekt: hook va xulosa
    sfx.push({ t: 0.05, tur: 'whoosh', v: 0.4 });
    if (jami > 10) sfx.push({ t: jami - 3, tur: 'pop', v: 0.4 });
  }
  if (!kesimlar.length && !sfx.length) return null;

  const args = ['-y', '-i', videoPath];
  kesimlar.forEach((k) => args.push('-loop', '1', '-framerate', '25', '-t', String(k.d + 0.1), '-i', k.f));
  const sfxFayllar = [];
  for (const s of sfx) sfxFayllar.push(await sfxFayl(s.tur, tmpDir));
  sfxFayllar.forEach((f) => args.push('-i', f));

  const fl = [];
  let video = '[0:v]';
  kesimlar.forEach((k, i) => {
    const D = k.d, e = 0.18;
    fl.push(`[${i + 1}:v]scale=${Math.round(w * 1.14)}:${Math.round(h * 1.14)},crop=${w}:${h}:'(iw-${w})*t/${D}':'(ih-${h})*t/${D}',format=yuva420p,fade=t=in:st=0:d=${e}:alpha=1,fade=t=out:st=${(D - e).toFixed(2)}:d=${e}:alpha=1,setpts=PTS+${k.t}/TB[k${i}]`);
    fl.push(`${video}[k${i}]overlay=0:0:enable='between(t,${k.t},${(k.t + D).toFixed(2)})':eof_action=pass[v${i}]`);
    video = `[v${i}]`;
  });
  const ofs = kesimlar.length + 1;
  const aTar = ['[0:a]'];
  sfx.forEach((s, i) => {
    const ms = Math.round(s.t * 1000);
    fl.push(`[${ofs + i}:a]volume=${s.v},atrim=0:1.6,adelay=${ms}|${ms}[s${i}]`);
    aTar.push(`[s${i}]`);
  });
  const hasAudio = await exec('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', videoPath]).then((r) => !!r.stdout.trim()).catch(() => false);
  if (!hasAudio) return null; // ovozsiz videoda effekt qo'shilmaydi
  fl.push(`${aTar.join('')}amix=inputs=${aTar.length}:duration=first:normalize=0:dropout_transition=0[a]`);
  const map = kesimlar.length ? [video.replace(/[\[\]]/g, '')] : ['0:v'];
  args.push('-filter_complex', fl.join(';'), '-map', kesimlar.length ? `[${map[0]}]` : '0:v', '-map', '[a]',
    ...(kesimlar.length ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p'] : ['-c:v', 'copy']), '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', outPath);
  await bosqich(`Vizual kesimlar (${kesimlar.length}) va ovoz effektlari (${sfx.length}) qo'shilmoqda...`).catch(() => {});
  await exec('ffmpeg', args, { maxBuffer: 1 << 26 });
  return { kesim: kesimlar.length, sfx: sfx.length };
}
