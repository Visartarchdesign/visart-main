// Montajchi agenti -- Gemini (video ko'rib kesish qarorini beradi) + FFmpeg
// (qarorga asosan kesib, Instagram uchun qayta kodlaydi, kerak bo'lsa fon
// muzika qo'shadi va Whisper orqali o'zbekcha subtitr kuydiradi).
//
// Cheklov: Telegram oddiy Bot API orqali faqat 20MB gacha fayl yuklab olish
// mumkin (getFile). Shundan katta xom video kelsa, xato qaytariladi.
//
// YouTube Shorts avtomatik yuklash (ixtiyoriy -- sozlanmasa jim o'tkazib
// yuboriladi): YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
// (Google Cloud OAuth, "In production" holatida olingan muddatsiz token).

import fs from 'fs';
import { keyingiMavzu } from './mavzuBanki.js';
import { effektQosh } from './effektlar.js';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
sharp.cache(false);
sharp.concurrency(1);
import { nodewhisper } from 'nodejs-whisper';
import { qopqoqYarat } from './qopqoqlar.js';
import { yuzTanla, aiOblojka, yuzStudio } from './yuz.js';
import { senariyTanla } from './senariylar.js';
import { KREATIV_PROMPT } from './animatsiyaPrompt.js';
import { SAHNALAR, SAHNA_MENYU, SAHNA_BG, SAHNA_RASM, SAHNA_SFX, sahnaSvg } from './sahnalar.js';
const TEMA_BG = process.env.TEMA === 'och' ? '#f2ece1' : '#111113';
const DARK = TEMA_BG === '#111113';
const YOZ = DARK ? '#f5f2ea' : '#16150f';
const VURGU = DARK ? '#ff8a4c' : '#c4572b';
import { elchiOblojka } from './oblojkaElchi.js';
import { BUYRUQ_MATN } from './buyruqlar.js';
import { SAHNA_FOTO, obyektJoyi, fotoIzohKadrlar, slaydIzohCfg } from './izohlash.js';
import { storyKartalarYarat, storyVariantYarat } from './storyKartalar.js';

const execFileAsync = promisify(execFile);
const MONTAJ_MAXPX = Number(process.env.MONTAJ_MAXPX) || 1920; // PC: to'liq 1080x1920; Render'da MONTAJ_MAXPX=1280
// "Flash Lite" tekin tarifda ancha yuqori kunlik limitga ega (500/kun,
// oddiy "Flash"da bor-yo'g'i 20/kun) -- 24/7 avtomatik pipeline uchun shart.
// Bir nechtasi ZANJIR sifatida ro'yxatlangan: birinchisi kunlik limitga
// yetsa (429), avtomatik keyingisiga o'tiladi -- shu bilan amalda
// 500+500+500=1500/kun gacha quvvat olinadi, billing shart bo'lmaydi.
const GEMINI_MODELLAR = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];

async function tgGetFilePath(token, fileId) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const data = await res.json().catch(() => null);
  if (!data || !data.ok) {
    throw new Error(`Telegram getFile xato: ${data && data.description ? data.description : 'noma\'lum'}`);
  }
  return data.result.file_path;
}

async function tgDownloadToFile(token, filePath, destPath) {
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!res.ok) throw new Error(`Telegram fayl yuklab olishda xato: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

async function tgSendVideo(token, chatId, filePath, caption) {
  const buf = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) form.append('caption', caption.slice(0, 1024));
  form.append('video', new Blob([buf], { type: 'video/mp4' }), 'montaj.mp4');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, { method: 'POST', body: form });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Telegram sendVideo xato: ${res.status} ${txt.slice(0, 200)}`);
  }
}

async function tgSendPhoto(token, chatId, buf, caption, replyMarkup) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));
  if (caption) form.append('caption', caption.slice(0, 1024));
  form.append('photo', new Blob([buf], { type: replyMarkup ? 'image/jpeg' : 'image/png' }), replyMarkup ? 'story.jpg' : 'cover.png');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Telegram sendPhoto xato: ${res.status} ${txt.slice(0, 200)}`);
  }
}

async function tgSendMessage(token, chatId, text, replyMarkup) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }),
  }).then(async (r) => { if (!r.ok) console.error('tgSendMessage', r.status, (await r.text()).slice(0, 200)); }).catch((e) => console.error('tgSendMessage', e && e.message));
}

async function geminiFileUpload(apiKey, filePath, mimeType) {
  const stat = fs.statSync(filePath);
  const startRes = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(stat.size),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'visart-montaj' } }),
  });
  if (!startRes.ok) throw new Error(`Gemini upload boshlashda xato: ${startRes.status}`);
  const uploadUrl = startRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error("Gemini upload URL qaytmadi");

  const fileBuf = fs.readFileSync(filePath);
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(stat.size),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: fileBuf,
  });
  if (!uploadRes.ok) throw new Error(`Gemini fayl yuklashda xato: ${uploadRes.status}`);
  const data = await uploadRes.json();
  return data.file;
}

async function geminiFileWaitActive(apiKey, fileName) {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}`, {
      headers: { 'x-goog-api-key': apiKey },
    });
    const data = await res.json();
    if (data.state === 'ACTIVE') return data;
    if (data.state === 'FAILED') throw new Error("Gemini fayl holati: FAILED");
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("Gemini fayl ACTIVE bo'lishini kutish vaqti tugadi");
}

async function geminiKesishQarori(apiKey, fileUri, mimeType, qoshimchaKorsatma) {
  const prompt =
    "Siz Instagram'da million qarashlar oluvchi, PREMIUM darajadagi arxitektura/interyer studiyasi uchun ishlaydigan professional video montajchisiz (Visart Design). " +
    "Standartingiz PASAYTIRILMAYDI -- oddiy, zerikarli, 'xomaki' ko'rinadigan video chiqarish MUTLAQO taqiqlanadi.\n\n" +
    "Ushbu xom videoni qattiq, talabchan nazar bilan tahlil qiling:\n" +
    "1) KESIB TASHLANADI: uzoq pauza/duduqlanish, keraksiz/sust boshlanish, kamera qattiq silkingan yoki fokusdan chiqqan (xira) joylar, takrorlanuvchi/zerikarli kadrlar, hech narsa 'bo'lmayotgan' bo'sh vaqt.\n" +
    "2) SAQLANADIGAN segmentlar FAQAT: vizual jihatdan kuchli, aniq fokusli, yaxshi yorug'lik/kadrlashga ega, dinamik (harakat/burchak o'zgarishi bor) bo'laklar. Reels pacing -- qisqa, tez, zarur bo'lmagan hech bir soniya qoldirilmasin. Statik, harakatsiz kadrni 1.5 soniyadan uzoq SAQLAMANG -- zamonaviy Reels/Shorts tomoshabini zerikib ketadi.\n" +
    "3) Birinchi saqlanadigan segment KUCHLI 'hook' bo'lishi kerak (eng jozibali, harakatli kadrdan boshlansin, hech qachon statik/sekin kadr bilan emas) -- tomoshabinni birinchi 1-2 soniyada ushlab qolish shart (bu 2026-yilgi algoritm standarti, oldingi 'sekin kirish' uslubi endi ishlamaydi).\n" +
    "4) AGAR butun xom material past sifatli bo'lsa (doim xira/silkingan, yorug'lik yomon, hech qanday jozibali/premium kadr yo'q, yoki foydali uzunlik 3 soniyadan kam qoladi) -- buni tan oling va \"munosib\": false qaytaring. Chalasifat video chiqarishdan ko'ra, UMUMAN chiqarmaslik afzal.\n" +
    "5) SARLAVHA: videoning ko'rgan mazmuniga (interyer uslubi, xona turi, material, yoritish, kayfiyat) ASOSLANGAN, 3-6 so'zdan iborat, DIQQATNI TORTUVCHI o'zbek tilidagi sarlavha yozing (masalan: \"Minimalizm Uyg'unligi\", \"Yorug' Zamonaviy Oshxona\", \"Hashamatli Mehmonxona Dizayni\") -- umumiy/bo'sh \"Interyer dizayni\" kabi klişelardan qoching, imlo xatosiz yozing.\n" +
    "6) QOPQOQ KATEGORIYASI: VISART DESIGN MASTER COVER SYSTEM'dan ushbu videoga ENG mos keladigan BITTA kategoriyani tanlang (raqam bilan):\n" +
    "   1 = Interyer/Portfolio (umumiy chiroyli interyer namoyishi -- standart, aksariyat videolar uchun mos)\n" +
    "   2 = Before/After (video ICHIDA aniq oldin/keyin farqi ko'rinsa -- FAQAT shunday bo'lsa tanlang)\n" +
    "   3 = Xatolar/Educational (video xato/ogohlantirish/maslahat haqida bo'lsa)\n" +
    "   4 = Process (loyihadan natijagacha jarayon ko'rsatilsa)\n" +
    "   5 = Arxitektura (tashqi ko'rinish/exterior, uy maydoni haqida bo'lsa)\n" +
    "   6 = Qurilish maslahati (qurilish jarayoni/maslahat)\n" +
    "   7 = Narx/Budjet (narx/smeta/byudjet haqida gap bo'lsa)\n" +
    "   8 = Material Comparison (ikki material/variant solishtirilsa)\n" +
    "   Noaniq bo'lsa 1 ni tanlang. 2 va 8 FAQAT video ichida ikkita aniq farqli holat/kadr ko'ringanda tanlanishi mumkin (chunki bu ikkisi ikkita alohida kadr ishlatadi).\n" +
    "7) AKSENT: sarlavha ichida (yoki alohida) rang bilan AJRATILISHI kerak bo'lgan QISQA so'z/raqam (masalan aniq m², narx, \"5 ta\" kabi) -- shart emas, bo'lmasa bo'sh qoldiring.\n" +
    "8) RAQAM: agar videoda aniq ko'rsatish mumkin bo'lgan KATTA raqam bo'lsa (maydon m², xato soni, narx) -- shu raqamni alohida qaytaring (masalan \"180 m²\", \"5\"), aks holda bo'sh qoldiring. HECH QACHON o'ylab topilgan raqam yozmang -- faqat qoshimchaKorsatma/izohda aniq berilgan bo'lsa.\n" +
    "9) FON MUZIKA KERAKMI: videoning asl ovoz-yo'lagini tinglab/ko'rib baholang. Agar video kimdir KAMERA OLDIDA GAPIRIB biror narsani TUSHUNTIRAYOTGAN/MA'LUMOT BERAYOTGAN bo'lsa (masalan loyiha haqida so'zlab bermoqda, maslahat bermoqda) -- fon muzika SHART EMAS, chunki u ovozga xalaqit beradi va diqqatni bo'ladi: \"muzika_kerak\": false qaytaring. Agar video FAQAT vizual (gapirish yo'q yoki kam, asosan chiroyli kadrlar/jarayon ko'rsatilmoqda, ambient xona tovushi bor xolos) bo'lsa -- fon muzika Reels tajribasini sezilarli yaxshilaydi: \"muzika_kerak\": true qaytaring va \"muzika_kayfiyat\" maydonida ENG mos kayfiyatni tanlang: \"sokin\" (standart, xotirjam interyer namoyishi), \"energetik\" (jarayon/before-after/qurilish, tez ritm), \"ilhomlantiruvchi\" (katta/hero arxitektura kadrlar), \"hashamatli\" (premium/lyuks loyiha, sekin va nafis).\n" +
    (qoshimchaKorsatma ? `\n10) ADMIN'NING MAXSUS KO'RSATMASI (bunga albatta amal qiling, boshqa qoidalardan ustun): "${qoshimchaKorsatma}"\n` : '') +
    "\nJAVOBNI FAQAT quyidagi JSON formatda qaytaring (boshqa hech narsa yozmang):\n" +
    '{"munosib": true, "sarlavha": "<3-6 so\'zli diqqat tortuvchi sarlavha>", "kategoriya": <1-8>, "aksent": "<qisqa so\'z/raqam yoki bo\'sh>", "raqam": "<katta raqam yoki bo\'sh>", "muzika_kerak": true/false, "muzika_kayfiyat": "<sokin|energetik|ilhomlantiruvchi|hashamatli yoki bo\'sh agar muzika_kerak false bo\'lsa>", "segmentlar": [{"start": 0.0, "end": 12.5}, {"start": 15.0, "end": 40.0}], "izoh": "<qisqa, nega aynan shu kadrlar qoldirildi va nima olib tashlandi -- FAQAT admin uchun>", "tavsif": "<mijozlarga mo\'ljallangan Instagram/YouTube izohi: 1-qator kuchli hook, 2-3 qisqa gap videodagi foydali maslahat/qiymat (montaj haqida HECH NARSA yozmang), oxirida 1 ta savol yoki CTA>", "hashtaglar": "<6-8 ta mavzuga mos o\'zbekcha/ruscha hashtag, bo\'sh joy bilan>"}\n' +
    'yoki material yetarli darajada bo\'lmasa:\n' +
    '{"munosib": false, "sabab": "<nega premium darajaga to\'g\'ri kelmaydi>"}';

  let oxirgiXato;
  for (const model of GEMINI_MODELLAR) {
    for (let urinish = 1; urinish <= 3; urinish++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { file_data: { mime_type: mimeType, file_uri: fileUri } },
                { text: prompt },
              ],
            }],
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = (data.candidates && data.candidates[0] && data.candidates[0].content &&
          data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
          data.candidates[0].content.parts[0].text) || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('Gemini javobi JSON emas: ' + text.slice(0, 200));
        return JSON.parse(match[0]);
      }
      const txt = await res.text().catch(() => '');
      oxirgiXato = new Error(`Gemini (${model}) generateContent xato: ${res.status} ${txt.slice(0, 300)}`);
      if (res.status === 429) {
        // Shu modelning kunlik/daqiqalik limiti tugagan -- qayta urinishning
        // foydasi yo'q, zanjirdagi KEYINGI modelga darhol o'tamiz.
        break;
      }
      // 503 (band) -- vaqtinchalik, biroz kutib SHU modelni qayta urinamiz
      if (res.status === 503 && urinish < 3) {
        await new Promise((r) => setTimeout(r, urinish * 5000));
        continue;
      }
      throw oxirgiXato;
    }
  }
  throw oxirgiXato;
}

// Tayyor videodan bitta kadrni JPEG rasm sifatida ajratib oladi -- `nisbat`
// (0..1) video uzunligining qaysi nuqtasidan olinishini belgilaydi.
// Standart qopqoq uchun ~35% (eng jozibali o'rtaroq nuqta); before/after va
// process shablonlari uchun ikkinchi, kech nuqtadagi kadr kerak bo'ladi.
async function ffmpegKadrOl(videoPath, outPath, nisbat = 0.35) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath,
  ]);
  const davomiylik = parseFloat(stdout) || 3;
  const vaqt = Math.max(0.2, davomiylik * nisbat);
  await execFileAsync('ffmpeg', [
    '-y', '-ss', String(vaqt), '-i', videoPath, '-vframes', '1', '-q:v', '2', outPath,
  ]);
}

// Video o'lchamini (width/height) olib qaytaradi -- sarlavha overlay'ini
// aniq shu o'lchamda (ko'chmasdan/cho'zilmasdan) yasash uchun kerak.
async function ffmpegOlchamOl(videoPath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
    '-of', 'csv=s=x:p=0', videoPath,
  ]);
  const [w, h] = stdout.trim().split('x').map((n) => parseInt(n, 10));
  return { width: w || 1080, height: h || 1920 };
}

// Instagram/YouTube feed'da video avtomatik o'ynaganda odam BIRDANIGA nima
// haqida ekanini bilishi uchun -- videoning o'zi ustiga, birinchi soniyalarda
// ko'rinadigan sarlavha "kuydiriladi" (shaffof PNG overlay, video o'lchamiga
// mos). Xato bersa, original videoni o'zgarishsiz qaytaradi.
async function sarlavhaKuydir(videoPath, outPath, title) {
  if (!title) return false;
  const { width, height } = await ffmpegOlchamOl(videoPath);
  const titleSafe = xmlEscape(title);
  const qatorlar = ikkiQatorgaBol(titleSafe, Math.max(10, Math.round(width / 38)));
  const fontSize = Math.round(width * 0.062);
  const panelBaland = 90 + qatorlar.length * (fontSize + 18);
  const overlaySvg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000" stop-opacity="0.75"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${panelBaland}" fill="url(#g)"/>
      ${qatorlar.map((q, i) => `<text x="${Math.round(width * 0.055)}" y="${60 + (i + 1) * (fontSize + 10)}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="800" fill="#ffffff">${q}</text>`).join('')}
      <rect x="${Math.round(width * 0.055)}" y="${panelBaland - 22}" width="${Math.round(width * 0.14)}" height="5" fill="#c9a876"/>
    </svg>
  `);
  const overlayPath = outPath.replace(/\.mp4$/, '-overlay.png');
  await sharp(overlaySvg).png().toFile(overlayPath);

  await execFileAsync('ffmpeg', [
    '-y', '-i', videoPath, '-i', overlayPath,
    '-filter_complex', "[0:v][1:v]overlay=0:0:enable='lt(t,4)'",
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
    '-threads', '1', '-x264-params', 'threads=1:lookahead_threads=1',
    '-c:a', 'copy', '-movflags', '+faststart',
    outPath,
  ], { maxBuffer: 1024 * 1024 * 20 });
  return true;
}

// Pollinations.ai (tekin, kalit/billing shart emas) orqali video mavzusiga
// oid, MAVHUM/konseptual premium fon rasm yasaydi (haqiqiy xona emas -- faqat
// dekorativ fon, Visart brend rangida). Xato bersa yoki tarmoq band bo'lsa,
// null qaytaradi -- chaqiruvchi tomon oddiy (AI'siz) qopqoqqa tushadi.
async function geminiPremiumFon(mavzu) {
  try {
    const prompt =
      `Premium abstract architectural interior design concept background, related to: ${mavzu || 'zamonaviy interyer dizayni'}. ` +
      "Dark elegant backdrop deep charcoal black with warm gold geometric accents, soft bokeh light, minimal luxury magazine cover aesthetic, " +
      "no real room, no people, no text, no logos, purely abstract decorative background, vertical composition";
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1920&model=flux&nologo=true&seed=${Math.floor(Math.random() * 1e6)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 1000 ? buf : null;
  } catch (e) {
    return null;
  }
}

function xmlEscape(s) {
  return String(s || '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

// Matnni so'z bo'yicha taxminan 2 qatorga bo'ladi (katta sarlavha sig'dirish uchun)
function ikkiQatorgaBol(matn, maxBelgiQator) {
  const sozlar = String(matn || '').trim().split(/\s+/);
  let qator1 = '';
  let qator2 = '';
  for (const s of sozlar) {
    if ((qator1 + ' ' + s).trim().length <= maxBelgiQator) {
      qator1 = (qator1 + ' ' + s).trim();
    } else {
      qator2 = (qator2 + ' ' + s).trim();
    }
  }
  return qator2 ? [qator1, qator2] : [qator1];
}

// YouTube: muddatsiz refresh_token'ni vaqtinchalik access_token'ga almashtiradi.
async function youtubeAccessToken(env) {
  if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET || !env.YOUTUBE_REFRESH_TOKEN) return null;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.YOUTUBE_CLIENT_ID,
      client_secret: env.YOUTUBE_CLIENT_SECRET,
      refresh_token: env.YOUTUBE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token || null;
}

// YouTube Shorts uchun eng yaqin "optimal" nashr vaqtini hisoblaydi (Toshkent,
// UTC+5): kunlik oynalar 16:00 va 19:00 -- O'zbekiston auditoriyasi va 2026
// platforma tadqiqotiga ko'ra Shorts uchun eng kuchli diapazon 16:00-20:00,
// eng kuchli kunlar Payshanba-Shanba (Juma 18:00 -- "flagship" slot, ikkala
// kunlik oyna orasida). Aniq soatdan ko'ra muntazam chiqish muhimroq bo'lgani
// uchun har kuni ikkita oyna beriladi (faqat Juma/Shanbaga cheklanmaydi).
function keyingiYoutubeVaqt() {
  const TOSHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
  const hozirToshkent = new Date(Date.now() + TOSHKENT_OFFSET_MS);
  const kun = hozirToshkent.getUTCDay(); // 0=Yak
  const soat = hozirToshkent.getUTCHours();
  const minut = hozirToshkent.getUTCMinutes();
  const hozirDaqiqa = soat * 60 + minut;

  const oynaErta = 16 * 60;
  const oynaKech = 19 * 60;

  function sanaOlish(kunOrttirish) {
    const d = new Date(hozirToshkent);
    d.setUTCDate(d.getUTCDate() + kunOrttirish);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  function vaqtQoshib(sana, daqiqalar) {
    const d = new Date(sana);
    d.setUTCMinutes(d.getUTCMinutes() + daqiqalar);
    return d;
  }

  let tanlanganSana, tanlanganDaqiqa;
  if (hozirDaqiqa < oynaErta) {
    tanlanganSana = sanaOlish(0);
    tanlanganDaqiqa = oynaErta;
  } else if (hozirDaqiqa < oynaKech) {
    tanlanganSana = sanaOlish(0);
    tanlanganDaqiqa = oynaKech;
  } else {
    // Bugungi oynalar tugagan -- ertangi birinchi oynaga o'tadi
    tanlanganSana = sanaOlish(1);
    tanlanganDaqiqa = oynaErta;
  }

  const natija = vaqtQoshib(tanlanganSana, tanlanganDaqiqa);
  // Toshkent vaqtidan UTC'ga qaytarish
  return new Date(natija.getTime() - TOSHKENT_OFFSET_MS);
}

// Tayyor videoni YouTube'ga Shorts sifatida yuklaydi (resumable upload).
// "private" + publishAt bilan yuklanadi -- YouTube o'zi belgilangan optimal
// vaqtda avtomatik ommaga ochadi. Sozlanmagan yoki xato bo'lsa, jim null
// qaytaradi -- asosiy Telegram oqimi buzilmaydi.
async function youtubeUpload(env, videoPath, title, description, coverBuf, publishAt) {
  if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET || !env.YOUTUBE_REFRESH_TOKEN) return null;
  try {
    const accessToken = await youtubeAccessToken(env);
    if (!accessToken) return null;

    const stat = fs.statSync(videoPath);
    const nashrVaqti = publishAt || keyingiYoutubeVaqt();
    const metadata = {
      snippet: {
        title: `${String(title || 'Visart Design').slice(0, 85)} #Shorts`,
        description: String(description || '').slice(0, 4900),
        categoryId: '26', // Howto & Style
      },
      status: {
        privacyStatus: 'private',
        publishAt: nashrVaqti.toISOString(),
        selfDeclaredMadeForKids: false,
      },
    };

    const startRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/mp4',
          'X-Upload-Content-Length': String(stat.size),
        },
        body: JSON.stringify(metadata),
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!startRes.ok) {
      const txt = await startRes.text().catch(() => '');
      throw new Error(`YouTube upload boshlashda xato: ${startRes.status} ${txt.slice(0, 200)}`);
    }
    const uploadUrl = startRes.headers.get('location');
    if (!uploadUrl) throw new Error("YouTube upload URL qaytmadi");

    const videoBuf = fs.readFileSync(videoPath);
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(stat.size) },
      body: videoBuf,
      signal: AbortSignal.timeout(180000),
    });
    if (!uploadRes.ok) {
      const txt = await uploadRes.text().catch(() => '');
      throw new Error(`YouTube video yuklashda xato: ${uploadRes.status} ${txt.slice(0, 200)}`);
    }
    const data = await uploadRes.json();
    let thumbXato = null;
    if (data.id && coverBuf) {
      try {
        const jpg = await sharp(coverBuf).resize(720, 1280, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer();
        const tr = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${data.id}&uploadType=media`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'image/jpeg' },
          body: jpg,
          signal: AbortSignal.timeout(30000),
        });
        if (!tr.ok) thumbXato = tr.status === 403 ? "YouTube API Shorts uchun maxsus qopqoqni qabul qilmadi (kanal tasdiqlangan, kod xatosi emas). Kerak bo'lsa qopqoqni YouTube Studio/ilovadan qo'lda qo'ying" : `${tr.status} ${(await tr.text().catch(() => '')).slice(0, 150)}`;
      } catch (e) { thumbXato = String((e && e.message) || e); }
    }
    return data.id ? { thumbXato, url: `https://youtube.com/shorts/${data.id}`, nashrVaqti } : null;
  } catch (e) {
    return { xato: String((e && e.message) || e) };
  }
}

// Xotira tejash uchun (Render bepul tarifi 512MB bilan cheklangan): bitta
// og'ir filter_complex grafigi o'rniga, har bir segmentni ALOHIDA-ALOHIDA
// (ketma-ket, bitta-bittadan) qayta kodlaymiz, keyin ularni concat demuxer
// bilan (qayta kodlamasdan, tez) birlashtiramiz. Shu yo'l bilan bir vaqtning
// o'zida faqat BITTA segment xotirada bo'ladi.
async function ffmpegKesibBirlashtir(inputPath, segmentlar, outputPath, tmpDir) {
  const segFiles = [];
  for (let i = 0; i < segmentlar.length; i++) {
    const seg = segmentlar[i];
    const segPath = path.join(tmpDir, `seg${i}.mp4`);
    await execFileAsync('ffmpeg', [
      '-y',
      '-ss', String(seg.start), '-to', String(seg.end),
      '-i', inputPath,
      '-map', '0:v:0', '-map', '0:a:0?',
      // Juda yuqori o'lchamli manba bo'lsa, 1280px'gacha kichraytiramiz
      // (xotira va chiqish hajmini nazorat qilish uchun) -- aks holda
      // asl o'lcham saqlanadi.
      // yengil rang tuzatish: iliq, biroz kontrastli, tiniq (yuz/teri chiroyli ko'rinsin)
      '-vf', `scale='min(${MONTAJ_MAXPX},iw)':'min(${MONTAJ_MAXPX},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,eq=contrast=1.06:saturation=1.08:brightness=0.02:gamma=0.98,unsharp=3:3:0.4`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
      // Manba (telefon) odatda bt709 rangda -- buni aniq ko'rsatmasak, ba'zi
      // pleyerlarda video xira/qorong'i ko'rinadi.
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      // Render'ning kichik konteynerida ffmpeg host CPU soniga qarab ko'p
      // thread/buffer ajratib xotirani oshirib yubormasligi uchun cheklaymiz.
      '-threads', '1', '-x264-params', 'threads=1:lookahead_threads=1',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
      '-avoid_negative_ts', 'make_zero',
      segPath,
    ], { maxBuffer: 1024 * 1024 * 20 });
    segFiles.push(segPath);
  }

  const listPath = path.join(tmpDir, 'list.txt');
  fs.writeFileSync(listPath, segFiles.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));

  await execFileAsync('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
    '-c', 'copy', '-movflags', '+faststart',
    outputPath,
  ], { maxBuffer: 1024 * 1024 * 20 });
}

// media-server/music/<kayfiyat>/*.mp3 papkasidan TASODIFIY bitta trekni
// tanlaydi. Papka bo'sh/mavjud bo'lmasa (hali to'ldirilmagan) -- null
// qaytaradi, chaqiruvchi tomon jim musiqasiz davom etadi (xato bermaydi).
export function muzikaTanla(kayfiyat) {
  try {
    const papka = path.join(path.dirname(fileURLToPath(import.meta.url)), 'music', kayfiyat || 'sokin');
    const fayllar = fs.readdirSync(papka).filter((f) => /\.(mp3|m4a|aac|wav)$/i.test(f));
    if (!fayllar.length) return null;
    return path.join(papka, fayllar[Math.floor(Math.random() * fayllar.length)]);
  } catch (e) {
    return null; // papka yo'q -- hali musiqa qo'yilmagan
  }
}

async function ffmpegAudioBormi(videoPath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index',
    '-of', 'csv=p=0', videoPath,
  ]);
  return stdout.trim().length > 0;
}

// Fon muzikani videoga qo'shadi. Video asl ovozi bor bo'lsa PASAYTIRIB
// qoldiriladi (xona tovushi/ambient kabi eshitilib tursin), muzika esa asosiy
// fon sifatida miks qilinadi va videoning uzunligiga moslab kesiladi
// (`-shortest`). Trek video uzunligidan qisqa bo'lsa, loop qilinadi. Asl
// videoda umuman audio trek bo'lmasa (jim kadr), faqat muzika qo'yiladi.
export async function ffmpegMuzikaQosh(videoPath, musicPath, outPath) {
  const audioBor = await ffmpegAudioBormi(videoPath);
  const filterComplex = audioBor
    // [0:a] -- video asl ovozi 22% darajada (butunlay o'chirilmaydi -- ambient
    // xona tovushi tabiiyroq eshitiladi); [1:a] -- muzika 55% darajada, 1.5s
    // fade-in bilan boshlanadi (keskin kirmasligi uchun).
    ? '[0:a]volume=0.22[a0];[1:a]volume=0.55,afade=t=in:st=0:d=1.5[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=2,loudnorm=I=-14:TP=-1.5:LRA=11[aout]'
    : '[1:a]volume=0.55,afade=t=in:st=0:d=1.5,loudnorm=I=-14:TP=-1.5:LRA=11[aout]';
  await execFileAsync('ffmpeg', [
    '-y', '-i', videoPath, '-stream_loop', '-1', '-i', musicPath,
    '-filter_complex', filterComplex,
    '-map', '0:v:0', '-map', '[aout]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
    '-shortest', '-movflags', '+faststart',
    outPath,
  ], { maxBuffer: 1024 * 1024 * 20 });
}

export async function ffmpegMuzikaDuck(videoPath, musicPath, outPath, { daraja = 0.32 } = {}) {
  // Muzika: past/yuqori chastota kesiladi (ovoz diapazoni bo'sh qoladi), nutq paytida kuchli pasayadi.
  const dur = parseFloat((await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', videoPath])).stdout) || 30;
  const fc = `[0:a]asplit=2[v1][v2];[1:a]highpass=f=90,lowpass=f=9000,equalizer=f=2500:t=q:w=1:g=-4,volume=${daraja},afade=t=in:d=2,afade=t=out:st=${Math.max(1, dur - 3).toFixed(2)}:d=3[m];[m][v2]sidechaincompress=threshold=0.015:ratio=12:attack=15:release=700:makeup=1[d];[v1][d]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9[a]`;
  await execFileAsync('ffmpeg', ['-y', '-i', videoPath, '-stream_loop', '-1', '-i', musicPath, '-filter_complex', fc,
    '-map', '0:v', '-map', '[a]', '-t', dur.toFixed(2), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-movflags', '+faststart', outPath], { maxBuffer: 1024 * 1024 * 20 });
}

// SRT vaqt belgisini ("00:00:01,500") soniyaga aylantiradi.
function srtVaqtSoniyaga(t) {
  const m = t.trim().match(/(\d+):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!m) return 0;
  const [, h, mi, s, ms] = m;
  return (+h) * 3600 + (+mi) * 60 + (+s) + (+ms) / 1000;
}

// Soniyani ASS vaqt formatiga ("0:00:01.50") aylantiradi.
function soniyaAssVaqtga(sec) {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sRem = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${sRem.toFixed(2).padStart(5, '0')}`;
}

// whisper.cpp .srt chiqishini { boshlanish, tugash, matn }[] massiviga parse qiladi.
function srtParseQil(srtMatn) {
  const bloklar = srtMatn.split(/\r?\n\r?\n/).map((b) => b.trim()).filter(Boolean);
  const natija = [];
  for (const blok of bloklar) {
    const qatorlar = blok.split(/\r?\n/);
    const vaqtQator = qatorlar.find((q) => q.includes('-->'));
    if (!vaqtQator) continue;
    const [boshStr, tugashStr] = vaqtQator.split('-->');
    const matn = qatorlar.slice(qatorlar.indexOf(vaqtQator) + 1).join(' ').trim();
    if (!matn) continue;
    natija.push({ bosh: srtVaqtSoniyaga(boshStr), tugash: srtVaqtSoniyaga(tugashStr), matn });
  }
  return natija;
}

// ASS matn maydonida maxsus belgilarni escape qiladi.
function assEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\r?\n/g, '\\N');
}

// Gemini orqali sof o'zbek (lotin) subtitr: audio ajratiladi, nutq so'zma-so'z
// yoziladi, ikkinchi o'tishda imlo/tinish belgilari tekshiriladi. Vaqtlar
// "MM:SS.s" yoki soniya sifatida qabul qilinadi.
function vaqtParse(v) {
  if (typeof v === 'number') return v;
  const m = String(v).trim().match(/^(?:(\d+):)?(\d+):(\d+(?:[.,]\d+)?)$|^(\d+(?:[.,]\d+)?)$/);
  if (!m) return NaN;
  if (m[4]) return parseFloat(m[4].replace(',', '.'));
  return (m[1] ? +m[1] * 3600 : 0) + (+m[2]) * 60 + parseFloat(m[3].replace(',', '.'));
}

async function geminiJsonSora(apiKey, parts) {
  let xato;
  for (const model of GEMINI_MODELLAR) {
    for (let u = 1; u <= 3; u++) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.1 } }),
      });
      if (res.ok) {
        const d = await res.json();
        const t = (((d.candidates || [])[0] || {}).content || {}).parts;
        const text = (t && t[0] && t[0].text) || '';
        const m = text.match(/\[[\s\S]*\]/);
        if (!m) throw new Error('Gemini javobi massiv emas: ' + text.slice(0, 150));
        return JSON.parse(m[0]);
      }
      xato = new Error(`Gemini (${model}) ${res.status}`);
      if (res.status === 429) break;
      if (res.status === 503 && u < 3) { await new Promise((r) => setTimeout(r, u * 5000)); continue; }
      throw xato;
    }
  }
  throw xato;
}

async function geminiSubtitrYarat(env, videoPath, tmpDir) {
  const audioPath = path.join(tmpDir, 'nutq.mp3');
  await execFileAsync('ffmpeg', ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k', audioPath]);
  const up = await geminiFileUpload(env.GEMINI_API_KEY, audioPath, 'audio/mpeg');
  const act = await geminiFileWaitActive(env.GEMINI_API_KEY, up.name);
  const raw = await geminiJsonSora(env.GEMINI_API_KEY, [
    { file_data: { mime_type: 'audio/mpeg', file_uri: act.uri } },
    { text:
      "Bu audioda o'zbek tilida (ba'zan rus so'zlari bilan) arxitektura/interyer/qurilish haqida gapirilmoqda. " +
      "Nutqni so'zma-so'z, ANIQ transkripsiya qiling -- SOF O'ZBEK LOTIN yozuvida (o', g', sh, ch, ng; apostrof sifatida faqat ' belgisi), adabiy imlo bilan, tinish belgilari to'g'ri. " +
      "Eshitilmagan/noaniq so'zni o'ylab topmang va qo'shmang; musiqa yoki shovqin uchun matn yozmang. Brend nomi: Visart Design. " +
      "Har bir bo'lak 1-7 so'z (maks. ~42 belgi), gap ma'nosi bo'yicha bo'lingan, vaqtlar nutqqa ANIQ mos. " +
      'FAQAT JSON massiv: [{"start":"00:01.2","end":"00:03.4","text":"..."}]. Nutq bo\'lmasa: []' },
  ]);
  let seg = raw.map((x) => ({ bosh: vaqtParse(x.start), tugash: vaqtParse(x.end), matn: String(x.text || '').trim() }))
    .filter((x) => x.matn && isFinite(x.bosh) && isFinite(x.tugash) && x.tugash > x.bosh);
  if (!seg.length) throw new Error("nutq aniqlanmadi");
  // Imlo tekshiruvi (matn bo'yicha, vaqtlarga tegmaydi)
  try {
    const tuz = await geminiJsonSora(env.GEMINI_API_KEY, [{ text:
      "Quyidagi o'zbek (lotin) subtitr qatorlarini imlo, apostrof (o', g'), tinish belgilari va katta-kichik harf jihatidan TUZATING. " +
      "Ma'noni o'zgartirmang, so'z qo'shmang/olib tashlamang, tartib va soni (aynan " + seg.length + " ta) saqlansin. " +
      "FAQAT JSON massiv (satrlar): " + JSON.stringify(seg.map((x) => x.matn)) }]);
    if (Array.isArray(tuz) && tuz.length === seg.length) seg = seg.map((x, i) => ({ ...x, matn: String(tuz[i] || x.matn).trim() }));
  } catch (e) { /* tuzatish ixtiyoriy */ }
  // Ustma-ust tushmasin
  for (let i = 0; i < seg.length - 1; i++) if (seg[i].tugash > seg[i + 1].bosh) seg[i].tugash = Math.max(seg[i].bosh + 0.3, seg[i + 1].bosh - 0.02);
  return seg;
}

// Sof ambient fon muzika (ffmpeg sintez) -- music/ papkasi bo'sh bo'lganda.
async function muzikaSintez(kayfiyat, soniya, outPath) {
  const akkord = {
    sokin: [261.63, 329.63, 392.0, 493.88],            // Cmaj7
    hashamatli: [293.66, 349.23, 440.0, 523.25, 659.25], // Dm9
    ilhomlantiruvchi: [196.0, 246.94, 293.66, 392.0, 587.33], // G
    energetik: [220.0, 261.63, 329.63, 440.0],         // Am
  }[kayfiyat] || [261.63, 329.63, 392.0, 493.88];
  const tr = kayfiyat === 'energetik' ? 2.0 : 0.15;
  const inputs = akkord.flatMap((f) => ['-f', 'lavfi', '-i', `sine=frequency=${f}:duration=${soniya + 3}`]);
  const mix = akkord.map((_, i) => `[${i}:a]`).join('') + `amix=inputs=${akkord.length}:normalize=1,tremolo=f=${tr}:d=0.35,aecho=0.8:0.7:70|140:0.35|0.2,lowpass=f=1800,volume=2.2,afade=t=in:d=2,afade=t=out:st=${Math.max(0, soniya - 2.5)}:d=2.5[m]`;
  await execFileAsync('ffmpeg', ['-y', ...inputs, '-filter_complex', mix, '-map', '[m]', '-t', String(soniya), '-c:a', 'libmp3lame', '-b:a', '128k', outPath]);
  return outPath;
}

// Whisper.cpp (nodejs-whisper, "tiny" ko'p-tilli model -- Render bepul 512MB
// RAM cheklovi sabab) orqali videoning o'zbekcha nutqini SRT'ga transkripsiya
// qiladi. Faqat gapirib ma'lumot berilayotgan (muzika kerak emas deb
// topilgan) videolarda chaqiriladi. Xato bersa yoki nutq topilmasa, null
// qaytaradi -- chaqiruvchi tomon subtitrsiz davom etadi.
async function whisperSubtitrYarat(videoPath, tmpDir) {
  try {
    const model = process.env.WHISPER_MODEL || 'tiny';
    await nodewhisper(videoPath, {
      modelName: model,
      autoDownloadModelName: model,
      removeWavFileAfterTranscription: true,
      whisperOptions: {
        outputInSrt: true,
        language: 'uz',
        wordTimestamps: false,
        splitOnWord: false,
      },
    });
    const wavPath = videoPath.replace(/\.[^.]+$/, '.wav');
    const srtPath = `${wavPath}.srt`;
    if (!fs.existsSync(srtPath)) {
      const yonida = fs.readdirSync(path.dirname(videoPath)).join(', ');
      throw new Error(`SRT fayl topilmadi (${srtPath}); papkada: ${yonida}`);
    }
    const segmentlar = srtParseQil(fs.readFileSync(srtPath, 'utf8'));
    fs.rmSync(srtPath, { force: true });
    if (!segmentlar.length) throw new Error('nutq aniqlanmadi (SRT bo\'sh)');
    return segmentlar;
  } catch (e) {
    throw new Error(String((e && e.message) || e).slice(0, 400));
  }
}

// Whisper segmentlaridan video o'lchamiga ANIQ mos (PlayResX/Y = video
// width/height) ASS fayl yasab, "ass" filtri bilan kuydiradi. `subtitles`
// filtri + force_style/original_size juftligi libass'da PlayRes-video
// o'lcham nomuvofiqligi tufayli matnni noto'g'ri joy/o'lchamda chiqarishi
// aniqlangani uchun (sinovda tasdiqlangan), shu usul o'rniga PlayRes'ni
// video o'lchamiga ANIQ moslab, stilni ASS fayl ichida beramiz.
function qatorBol(m, maks = 26) {
  const so = m.split(/\s+/); const q = []; let c = '';
  for (const w of so) { if ((c + ' ' + w).trim().length > maks && c) { q.push(c); c = w; } else c = (c + ' ' + w).trim(); }
  if (c) q.push(c);
  return q.join('\n');
}

const ffFiltYol = (p) => String(p).replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1\\:');
export async function srtVideogaKuydir(videoPath, segmentlar, outPath, toza = false) {
  if (!segmentlar || !segmentlar.length) return false;
  const { width, height } = await ffmpegOlchamOl(videoPath);
  const fontSize = Math.round(width * (toza ? 0.075 : 0.052));
  const marginV = Math.round(height * (toza ? 0.118 : 0.11));
  const marginLR = Math.round(width * 0.055);
  const assQatorlar = (toza
    ? segmentlar.flatMap((s) => {
      const so = s.matn.split(/\s+/).filter(Boolean), jam = so.reduce((a, w) => a + w.length + 1, 0); let t0 = s.bosh;
      return so.map((w, k) => {
        const d = ((w.length + 1) / jam) * (s.tugash - s.bosh), t1 = k === so.length - 1 ? s.tugash : t0 + d;
        const satr = so.map((x, j) => (j === k ? `{\\c&H37AFD4&}${assEscape(x)}{\\c&HFFFFFF&}` : assEscape(x))).join(' ');
        const r = `Dialogue: 0,${soniyaAssVaqtga(t0)},${soniyaAssVaqtga(t1)},Default,,0,0,0,,${satr}`; t0 = t1; return r;
      });
    })
    : segmentlar.map((s) => `Dialogue: 0,${soniyaAssVaqtga(s.bosh)},${soniyaAssVaqtga(s.tugash)},Default,,0,0,0,,${assEscape(qatorBol(s.matn))}`)
  ).join('\n');
  const assMatn =
    `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nScaledBorderAndShadow: yes\n\n` +
    `[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n` +
    `Style: Default,${toza ? 'Poppins' : 'Liberation Sans'},${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H78000000,1,0,0,0,100,100,0,0,1,${toza ? '0,3' : '5,2'},2,${marginLR},${marginLR},${marginV},1\n\n` +
    `[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${assQatorlar}\n`;
  const assPath = outPath.replace(/\.mp4$/, '.ass');
  fs.writeFileSync(assPath, assMatn, 'utf8');
  try {
    await execFileAsync('ffmpeg', [
      '-y', '-i', videoPath,
      '-vf', `ass='${ffFiltYol(assPath)}'${toza ? ":fontsdir='" + ffFiltYol(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts')) + "'" : ''}`,
      '-c:v', 'libx264', '-preset', 'superfast', '-crf', '26', '-pix_fmt', 'yuv420p',
      '-threads', '1', '-x264-params', 'threads=1:lookahead_threads=1:rc-lookahead=5:ref=1:bframes=0',
      '-c:a', 'copy', '-movflags', '+faststart',
      outPath,
    ], { maxBuffer: 1024 * 1024 * 20 });
    return true;
  } finally {
    fs.rmSync(assPath, { force: true });
  }
}

// Tayyor videoni Supabase Storage'ning ochiq ("public-media") bucket'iga
// yuklaydi -- Instagram Graph API video kontentni FAQAT ochiq URL orqali
// qabul qiladi. mijoz-bot.js'dagi supabasePublicUpload bilan bir xil bucket.
export async function supabaseVideoUpload(env, videoPath) {
  const bucket = 'public-media';
  const objPath = `instagram-video/${Date.now()}-reel.mp4`;
  const buffer = fs.readFileSync(videoPath);
  const upload = async () => fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${objPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'video/mp4',
      'x-upsert': 'true',
    },
    body: buffer,
  });
  let res = await upload();
  if (res.status === 404 || res.status === 400) {
    await fetch(`${env.SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bucket, name: bucket, public: true }),
    }).catch(() => {});
    res = await upload();
  }
  if (!res.ok) throw new Error(`Supabase video yuklash xato: ${res.status}`);
  return `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${objPath}`;
}

export async function supabaseRasmUpload(env, buf) {
  const bucket = 'public-media';
  const objPath = `instagram-video/${Date.now()}-cover.jpg`;
  const jpg = await sharp(buf).jpeg({ quality: 90 }).toBuffer();
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${objPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    body: jpg,
  });
  if (!res.ok) throw new Error(`Supabase qopqoq yuklash xato: ${res.status}`);
  return `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${objPath}`;
}

async function igFetch(path, params) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: 'POST', signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) {
    throw new Error(`Instagram API xato: ${(data && data.error && data.error.message) || res.status}`);
  }
  return data;
}

// Container tayyor (FINISHED) bo'lguncha kutadi -- Reels/Story video
// qayta ishlash odatda 30s-2min oladi, 5 daqiqadan keyin vaqt tugaydi deb
// hisoblanadi.
async function igContainerKutish(containerId, token) {
  const max = 30; // 30 x 10s = 5 daqiqa
  for (let i = 0; i < max; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const url = new URL(`https://graph.facebook.com/v21.0/${containerId}`);
    url.searchParams.set('fields', 'status_code');
    url.searchParams.set('access_token', token);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    const data = await res.json().catch(() => null);
    if (data && data.status_code === 'FINISHED') return true;
    if (data && (data.status_code === 'ERROR' || data.status_code === 'EXPIRED')) return false;
  }
  return false;
}

// Tayyor videoni Instagram Reels sifatida avtomatik post qiladi. Admin
// Senarist taklifini allaqachon TASDIQLAGAN (media_taklif approve bosqichi)
// -- xuddi shu taklifdan kelib chiqqan foto-postlar (instagramPost,
// mijoz-bot.js) qanday qo'shimcha so'ramasdan avtomatik chiqsa, video ham
// shu bir xil, allaqachon-tasdiqlangan oqimga ergashadi. Sozlanmagan yoki
// xato bo'lsa -- jim o'tkaziladi, asosiy Telegram oqimini to'xtatmaydi.
async function instagramReelsPost(env, videoUrl, caption, coverUrl) {
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_BUSINESS_ACCOUNT_ID) return null;
  const igId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const token = env.INSTAGRAM_ACCESS_TOKEN;
  const container = await igFetch(`${igId}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption: (caption || '').slice(0, 2200),
    share_to_feed: 'true',
    ...(coverUrl ? { cover_url: coverUrl } : {}),
    access_token: token,
  });
  const tayyor = await igContainerKutish(container.id, token);
  if (!tayyor) throw new Error('Reels container FINISHED holatiga yetmadi (timeout/xato)');
  await igFetch(`${igId}/media_publish`, { creation_id: container.id, access_token: token });
  return true;
}

// Tayyor videoni Instagram Story sifatida avtomatik post qiladi (24 soatlik,
// caption qabul qilmaydi -- Graph API Stories matn/caption maydonini
// qo'llab-quvvatlamaydi).
async function instagramStoryPost(env, mediaUrl, rasm = false) {
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_BUSINESS_ACCOUNT_ID) return null;
  const igId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const token = env.INSTAGRAM_ACCESS_TOKEN;
  const container = await igFetch(`${igId}/media`, {
    media_type: 'STORIES',
    ...(rasm ? { image_url: mediaUrl } : { video_url: mediaUrl }),
    access_token: token,
  });
  const tayyor = await igContainerKutish(container.id, token);
  if (!tayyor) throw new Error('Story container FINISHED holatiga yetmadi (timeout/xato)');
  await igFetch(`${igId}/media_publish`, { creation_id: container.id, access_token: token });
  return true;
}

// Qo'shimcha "savol-javob" Story bosqichi uchun eng yaqin vaqtni hisoblaydi
// (Toshkent, UTC+5): kechqurungi 21:30 oynasi hali o'tmagan bo'lsa -- SHU
// KUNI 21:30, aks holda ertangi ertalabki 08:15 oynasiga o'tkaziladi --
// O'zbekiston auditoriyasi Story faolligi tadqiqotiga asoslangan ikkita
// kuchli kunlik nuqta.
function keyingiStoryVaqt() {
  const TOSHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
  const hozirToshkent = new Date(Date.now() + TOSHKENT_OFFSET_MS);
  const hozirDaqiqa = hozirToshkent.getUTCHours() * 60 + hozirToshkent.getUTCMinutes();
  const kechqurunOyna = 21 * 60 + 30;
  const ertalabOyna = 8 * 60 + 15;

  const sana = new Date(hozirToshkent);
  let daqiqa;
  if (hozirDaqiqa < kechqurunOyna) {
    daqiqa = kechqurunOyna;
  } else {
    sana.setUTCDate(sana.getUTCDate() + 1);
    daqiqa = ertalabOyna;
  }
  sana.setUTCHours(0, daqiqa, 0, 0);
  return new Date(sana.getTime() - TOSHKENT_OFFSET_MS);
}

// Bir xil videoni QO'SHIMCHA Story bosqichi sifatida (darhol chiqqan asosiy
// Story'dan keyinroq, kun davomida ikkinchi touchpoint sifatida) `nashr_navbati`
// navbatiga qo'yadi -- worker (functions/api/nashr-navbati.js) uni o'z
// vaqtida chiqaradi. Supabase sozlanmagan yoki xato bo'lsa, jim o'tkaziladi.
function keyingiFacebookVaqt() {
  const OFF = 5 * 60 * 60 * 1000;
  const t = new Date(Date.now() + OFF);
  const d = t.getUTCHours() * 60 + t.getUTCMinutes();
  if (d >= 7 * 60 && d <= 11 * 60 + 30) return new Date();
  const s = new Date(t);
  s.setUTCDate(s.getUTCDate() + (d > 11 * 60 + 30 ? 1 : 0));
  s.setUTCHours(9, 0, 0, 0);
  return new Date(s.getTime() - OFF);
}

async function navbatgaQoshFacebookVideo(env, videoUrl, coverUrl, caption) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/nashr_navbati`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      turi: 'facebook_video',
      payload: { video_url: videoUrl, cover_url: coverUrl, caption },
      nashr_vaqti: keyingiFacebookVaqt().toISOString(),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`navbat xato: ${res.status}`);
}

async function navbatgaQoshStory(env, mediaUrl, vaqt, rasm = false, ekstra = {}) {
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/nashr_navbati`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        turi: 'instagram_story',
        payload: { ...(rasm ? { image_url: mediaUrl } : { video_url: mediaUrl }), ...ekstra },
        nashr_vaqti: (vaqt || keyingiStoryVaqt()).toISOString(),
        holat: 'tasdiq_kutilmoqda', // admin tasdiqlamaguncha worker olmaydi
      }),
      signal: AbortSignal.timeout(10000),
    });
    const rows = await r.json().catch(() => null);
    return rows && rows[0] && rows[0].id;
  } catch (e) {
    return null;
    // navbatga qo'yishda xato bo'lsa ham, asosiy oqimni to'xtatmaydi
  }
}

// Tayyor video + qopqoqni adminga yuboradi va tasdiq (✅ Joylash / ❌ Bekor) so'raydi.
async function tasdiqqaYubor(env, adminChatId, outputPath, qopqoqBuf, { sarlavha, tavsif, hashtaglar, izoh, taklifId }) {
    await tgSendVideo(env.MIJOZ_BOT_TOKEN, adminChatId,
      outputPath, `🎬 Montaj tayyor -- ${sarlavha}\n\n${izoh || ''}${taklifId ? `\n\n🆔${taklifId}` : ''}`);
    // TASDIQ: tayyor video + qopqoq Supabase'ga yuklanadi, navbat jadvaliga
    // "tasdiq_kutilmoqda" holatida yoziladi va adminga tugmalar yuboriladi.
    // Instagram/Facebook/YouTube'ga FAQAT "✅ Joylash" bosilgandan keyin
    // (bajarNashr) chiqadi.
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const videoUrl = await supabaseVideoUpload(env, outputPath);
        let coverUrl = null;
        if (qopqoqBuf) {
          try { coverUrl = await supabaseRasmUpload(env, qopqoqBuf); } catch (e) {
            await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId, `⚠️ Qopqoq yuklanmadi: ${String((e && e.message) || e).slice(0, 200)}`).catch(() => {});
          }
        }
        const caption = `${sarlavha}\n\n${tavsif || ''}\n\nShuni ustangizga yoki arxitektoringizga yuboring 👇\n\n#VisartDesign ${hashtaglar || '#arxitektura #interyerdizayn #ToshkentDizayn #qurilish'}`;
        const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/nashr_navbati`, {
          method: 'POST',
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            turi: 'video_nashr',
            holat: 'tasdiq_kutilmoqda',
            payload: { video_url: videoUrl, cover_url: coverUrl, caption, sarlavha, tavsif: tavsif || '', taklifId: taklifId || null },
            nashr_vaqti: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) throw new Error(`navbat xato: ${resp.status} ${(await resp.text().catch(() => '')).slice(0, 150)}`);
        const nid = (await resp.json())[0].id;
        await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId,
          `✅ Video va qopqoq tayyor. Instagram Reels + Story, Facebook va YouTube'ga joylaymizmi?\n\n"${sarlavha}"\n\nKamchilik bo'lsa -- shu xabarga REPLY qilib nimani to'g'rilashni yozing (montaj/sarlavha/izoh) -- qayta tayyorlayman.${taklifId ? `\n\n🆔${taklifId}` : `\n\n🎞️${nid}`}`,
          { inline_keyboard: [[
            { text: '✅ Joylash', callback_data: `vnash:${nid}:ok` },
            { text: '❌ Bekor', callback_data: `vnash:${nid}:no` },
          ]] });
      } catch (e) {
        await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId,
          `⚠️ Tasdiqqa tayyorlashda xato: ${String((e && e.message) || e)}`);
      }
    }

}

async function bajarMontajBirUrinish({ env, aslFileId, adminChatId, title, taklifId, korsatma, bosqich, fayl }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'montaj-'));
  const inputPath = path.join(tmpDir, 'input.mp4');
  const outputPath = path.join(tmpDir, 'output.mp4');
  try {
    if (fayl) {
      await bosqich(`kompyuter papkasidan olindi: ${path.basename(fayl)}`);
      fs.copyFileSync(fayl, inputPath);
    } else {
      await bosqich('video yuklab olinmoqda...');
      let filePath;
      try { filePath = await tgGetFilePath(env.MIJOZ_BOT_TOKEN, aslFileId); }
      catch (e) {
        if (/too big/i.test(String((e && e.message) || e))) {
          await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId,
            "📦 Video 20 MB dan katta -- Telegram bot uni yuklab ololmaydi.\nFaylni kompyuterdagi Documents\\Visart_AI_Studio\\xom_video papkasiga tashlang -- montaj avtomatik boshlanadi.");
          return true;
        }
        throw e;
      }
      await tgDownloadToFile(env.MIJOZ_BOT_TOKEN, filePath, inputPath);
    }

    await bosqich("Gemini'ga yuklanmoqda...");
    const mimeType = 'video/mp4';
    const uploaded = await geminiFileUpload(env.GEMINI_API_KEY, inputPath, mimeType);
    const active = await geminiFileWaitActive(env.GEMINI_API_KEY, uploaded.name);

    await bosqich('Gemini video tahlil qilmoqda (kesish qarori)...');
    const qaror = await geminiKesishQarori(env.GEMINI_API_KEY, active.uri, mimeType, korsatma);

    if (qaror.munosib === false) {
      await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId,
        `🚫 Bu video premium darajaga to'g'ri kelmadi, shuning uchun chiqarilmadi${title ? ` -- ${title}` : ''}.\n\n${qaror.sabab || ''}`);
      return true; // yakuniy natija -- qayta urinish shart emas
    }
    if (!qaror.segmentlar || !qaror.segmentlar.length) {
      throw new Error('Gemini kesish uchun segment bermadi');
    }

    // Gemini videoning mazmuniga qarab o'zi sarlavha topgan -- shu, qo'lda
    // berilgan (yoki umuman berilmagan) "title"dan ustun turadi: qopqoq,
    // video ustidagi matn va YouTube sarlavhasi shundan foydalanadi.
    const sarlavha = qaror.sarlavha || title || 'Visart Design';

    await bosqich(`FFmpeg kesmoqda va birlashtirmoqda (${qaror.segmentlar.length} segment)...`);
    await ffmpegKesibBirlashtir(inputPath, qaror.segmentlar, outputPath, tmpDir);

    // Fon muzika -- faqat AI "kerak" deb topgan (gapirib ma'lumot berilmayotgan,
    // sof vizual) videolarda qo'shiladi. Mos kayfiyat papkasida trek bo'lmasa
    // (hali to'ldirilmagan), jim o'tkazib yuboriladi -- xato bermaydi.
    if (qaror.muzika_kerak) {
      try {
        await bosqich("Fon muzika qo'shilmoqda...");
        let musicPath = muzikaTanla(qaror.muzika_kayfiyat);
        if (!musicPath) {
          const { stdout: dur } = await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', outputPath]);
          musicPath = await muzikaSintez(qaror.muzika_kayfiyat, Math.ceil(parseFloat(dur) || 20), path.join(tmpDir, 'sintez.mp3'));
        }
        if (musicPath) {
          const bilanMuzikaPath = path.join(tmpDir, 'output-music.mp4');
          await ffmpegMuzikaQosh(outputPath, musicPath, bilanMuzikaPath);
          fs.renameSync(bilanMuzikaPath, outputPath);
        }
      } catch (e) {
        // muzika ixtiyoriy -- asosiy video yuborishni to'xtatmaydi
      }
    }

    // Subtitr (Whisper) -- faqat AI "gapirib ma'lumot berilayotgan" (muzika
    // kerak emas) deb topgan videolarda, asl ovoz mavjud bo'lsa ishga
    // tushadi: odam ovozsiz (feed'da) ko'rsa ham tushunsin. Xato bersa yoki
    // nutq aniqlanmasa, video subtitrsiz o'zgarishsiz qoladi.
    if (qaror.muzika_kerak) {
      await bosqich("ℹ️ AI bu videoni 'musiqali' deb topdi -- subtitr o'tkazib yuborildi").catch(() => {});
    }
    if (!qaror.muzika_kerak) {
      try {
        const audioBor = await ffmpegAudioBormi(outputPath);
        if (!audioBor) await bosqich("ℹ️ Videoda ovoz yo'q -- subtitr o'tkazib yuborildi").catch(() => {});
        if (audioBor) {
          await bosqich('Subtitr (nutq) aniqlanmoqda...');
          let segmentlar;
          try { segmentlar = await geminiSubtitrYarat(env, outputPath, tmpDir); }
          catch (ge) { segmentlar = await whisperSubtitrYarat(outputPath, tmpDir); }
          if (segmentlar) {
            // Vizual kesimlar (nutqqa mos rasm) + majburiy ovoz effektlari -- subtitrdan OLDIN, subtitr ustida qolsin
            try {
              const effPath = path.join(tmpDir, 'output-effekt.mp4');
              const er = await effektQosh({ env, videoPath: outputPath, segmentlar, tmpDir, outPath: effPath, deps: { rasmYarat, geminiJsonSora, ffmpegOlchamOl }, bosqich });
              if (er && fs.existsSync(effPath)) { fs.renameSync(effPath, outputPath); await bosqich(`✨ Effektlar: ${er.kesim} vizual kesim, ${er.sfx} ovoz effekti`).catch(() => {}); }
            } catch (ee) { await bosqich(`⚠️ Effektlar qo'shilmadi: ${String((ee && ee.message) || ee).slice(0, 300)}`).catch(() => {}); }
            await bosqich('Subtitr videoga kuydirilmoqda...');
            const bilanSubtitrPath = path.join(tmpDir, 'output-subtitr.mp4');
            const bajarildi = await srtVideogaKuydir(outputPath, segmentlar, bilanSubtitrPath);
            if (bajarildi) fs.renameSync(bilanSubtitrPath, outputPath);
          }
        }
      } catch (e) {
        // subtitr ixtiyoriy -- video yuborish to'xtamaydi, lekin sabab ko'rinsin
        await bosqich(`⚠️ Subtitr yaratilmadi: ${String((e && e.message) || e).slice(0, 400)}`).catch(() => {});
      }
    }

    // Sarlavhani video ustiga "kuydirish" -- feed'da avtomatik o'ynaganda
    // odam birdaniga nima haqida ekanini bilsin. Xato bersa, original video
    // o'zgarishsiz qoladi (hech narsa to'xtamaydi).
    try {
      await bosqich('Sarlavha videoga yozilmoqda...');
      const bilanTitlePath = path.join(tmpDir, 'output-title.mp4');
      const bajarildi = await sarlavhaKuydir(outputPath, bilanTitlePath, sarlavha);
      if (bajarildi) fs.renameSync(bilanTitlePath, outputPath);
    } catch (e) {
      // sarlavha ixtiyoriy -- asosiy video yuborishni to'xtatmaydi
    }

    // Premium qopqoq (cover/thumbnail) -- video kadri + AI fon. Xato bersa ham
    // (Gemini kvota/billing yo'q), oddiy video yuborishga tushadi, hech narsa
    // to'xtamaydi.
    let qopqoqBuf = null;
    try {
      await bosqich('Premium qopqoq tayyorlanmoqda...');
      const kategoriya = qaror.kategoriya || 1;
      const framePath = path.join(tmpDir, 'frame.jpg');
      await ffmpegKadrOl(outputPath, framePath, 0.35);
      const frameBuf = fs.readFileSync(framePath);

      // Before/After (2) va Process (4) shabloni ikkinchi, kech nuqtadagi
      // kadrni talab qiladi -- faqat shu kategoriyalarda qo'shimcha olinadi.
      let frameBuf2 = null;
      if (kategoriya === 2 || kategoriya === 4) {
        const framePath2 = path.join(tmpDir, 'frame2.jpg');
        await ffmpegKadrOl(outputPath, framePath2, 0.85);
        frameBuf2 = fs.readFileSync(framePath2);
      }

      // AI fon faqat "hero" shablonlarida ishlatiladi (qopqoqlar.js ichida
      // o'zi e'tiborsiz qoldiradi, lekin oldindan so'rab vaqt tejamaymiz --
      // 2/8 kategoriyada aiFonBuf shart emas).
      const aiFonBuf = (kategoriya === 2 || kategoriya === 8) ? null : await geminiPremiumFon(sarlavha);

      const yuzBuf = await yuzTanla(env);
      const aiQopqoq = await aiOblojka(env, { sarlavha, aksent: qaror.aksent, yuz: yuzBuf }).catch(() => null);
      if (aiQopqoq) qopqoqBuf = aiQopqoq;
      else qopqoqBuf = await qopqoqYarat({
        rasmBuf: frameBuf,
        rasmBuf2: frameBuf2,
        aiFonBuf,
        kategoriya,
        headline: sarlavha,
        accentSoz: qaror.aksent || '',
        raqam: qaror.raqam || '',
      });
    } catch (e) {
      qopqoqBuf = null; // qopqoq ixtiyoriy -- asosiy video yuborishni to'xtatmaydi
      await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId, `⚠️ Qopqoq yaratilmadi: ${String((e && e.message) || e).slice(0, 300)}`).catch(() => {});
    }

    if (qopqoqBuf) {
      await tgSendPhoto(env.MIJOZ_BOT_TOKEN, adminChatId,
        qopqoqBuf, `🖼️ Premium qopqoq -- ${sarlavha}`);
    }

    await bosqich('Telegramga yuklanmoqda...');
    await tasdiqqaYubor(env, adminChatId, outputPath, qopqoqBuf, { sarlavha, tavsif: qaror.tavsif, hashtaglar: qaror.hashtaglar, izoh: qaror.izoh, taklifId });
    return true;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Tarmoq/Gemini kabi vaqtinchalik xatolarda butun jarayonni avtomatik qayta
// urinadi (post "osilib qolmasligi" uchun) -- faqat BARCHA urinishlar
// tugagandan keyin adminga xato xabari yuboriladi. (Butun process'ni
// o'ldiradigan OOM kabi xatolar bundan mustasno -- ular xotira sozlamalari
// bilan oldindan oldi olingan.)
export async function bajarMontaj({ env, aslFileId, adminChatId, title, taklifId, korsatma, fayl }) {
  const MAX_URINISH = 3;
  let oxirgiXato;
  for (let urinish = 1; urinish <= MAX_URINISH; urinish++) {
    const bosqich = async (matn) => {
      await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId,
        `⏳ ${matn}${urinish > 1 ? ` (${urinish}-urinish)` : ''}`);
    };
    try {
      const tugadi = await bajarMontajBirUrinish({ env, aslFileId, adminChatId, title, taklifId, korsatma, bosqich, fayl });
      if (tugadi) return;
    } catch (e) {
      oxirgiXato = e;
      if (urinish < MAX_URINISH) {
        await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId,
          `🔁 Xato bo'ldi, qayta urinilmoqda (${urinish}/${MAX_URINISH}): ${String((e && e.message) || e)}`);
        await new Promise((r) => setTimeout(r, 8000));
      }
    }
  }
  const replyMarkup = taklifId
    ? { inline_keyboard: [[{ text: '🔁 Qayta urinish', callback_data: `montaj_retry:${taklifId}` }]] }
    : undefined;
  await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId,
    `⚠️ Montajchi ${MAX_URINISH} urinishdan keyin ham xato berdi: ${String((oxirgiXato && oxirgiXato.message) || oxirgiXato)}`,
    replyMarkup);
}


// Admin "✅ Joylash" bosgandan keyin: Instagram Reels + Story, Facebook
// (navbat) va YouTube Shorts'ga chiqaradi.

// ===== Haftalik nashr jadvali (Toshkent, UTC+5) =====
const IG_REJA = { vaqt: { 2: [20, 0], 5: [14, 0], 0: [20, 30] } };   // Sesh 20:00, Juma 14:00 (Juma namozidan keyin), Yak 20:30 (Reel); Telegram video = IG +30 daqiqa
const YT_REJA = { vaqt: { 1: [18, 30], 4: [18, 30], 6: [11, 0] } };  // Dush 18:30, Pay 18:30, Shan 11:00 (Shorts)
const tosh = (d) => { const t = new Date(d.getTime() + 5 * 3600e3), p = (n) => String(n).padStart(2, '0'); return `${['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Juma', 'Shan'][t.getUTCDay()]} ${p(t.getUTCDate())}.${p(t.getUTCMonth() + 1)} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`; };
export function keyingiSlot(reja, dan) {
  for (let i = 0; i < 15; i++) {
    const t = new Date(dan.getTime() + 5 * 3600e3);
    t.setUTCDate(t.getUTCDate() + i);
    const v = reja.vaqt[t.getUTCDay()];
    if (!v) continue;
    t.setUTCHours(v[0], v[1], 0, 0);
    const utc = new Date(t.getTime() - 5 * 3600e3);
    if (utc > dan) return utc;
  }
  return new Date(dan.getTime() + 24 * 3600e3);
}
async function slotlarHisobla(env) {
  const boshi = new Date(Date.now() + 30 * 60e3);
  let oxirIg = boshi, oxirYt = boshi;
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/nashr_navbati?turi=eq.video_ig_tg&select=nashr_vaqti,payload&order=created_at.desc&limit=20`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
    for (const q of (await r.json()) || []) {
      const a = new Date(q.nashr_vaqti), b = q.payload && q.payload.yt_vaqt ? new Date(q.payload.yt_vaqt) : null;
      if (q.payload && q.payload.qism === 'tg') continue;
      if (a > oxirIg) oxirIg = a; if (b && b > oxirYt) oxirYt = b;
    }
  } catch (e) { /* jadval bo'sh -- eng yaqin slot */ }
  return { ig: keyingiSlot(IG_REJA, oxirIg), yt: keyingiSlot(YT_REJA, oxirYt) };
}

// Instagram Reels (+3 Story) va Telegram kanal -- jadval vaqti kelganda yoki darhol
export async function igTgNashr(env, p, adminChatId) {
  const xabar = (t) => tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId, t).catch(() => {});
  const { video_url: videoUrl, cover_url: coverUrl, caption, sarlavha } = p;
  if (p.qism !== 'tg' && env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    try {
      await xabar('⏳ Instagram Reels/Story joylanmoqda...');
      await instagramReelsPost(env, videoUrl, caption, coverUrl);
      // Bir xil videoni qayta-qayta qo'ymaymiz: Reel = video; 3 ta Story = farqli kartalar.
      try {
        const kartalar = await storyKartalarYarat({ env, videoUrl, sarlavha });
        const t1 = new Date();
        const t2 = keyingiStoryVaqt();
        const vaqtlar = [t1, t2, new Date(t2.getTime() + 11 * 3600 * 1000)];
        const nom = { teaser: 'Teaser', savol: 'Savol kartasi', maslahat: 'Maslahat/AI-rasm' };
        for (let i = 0; i < kartalar.length; i++) {
          const url = await supabaseRasmUpload(env, kartalar[i].buf);
          const qid = await navbatgaQoshStory(env, url, vaqtlar[i], true, { manba_video: videoUrl, sarlavha, rol: kartalar[i].rol, v: 0 });
          if (!qid) continue;
          const t = new Date(vaqtlar[i].getTime() + 5 * 3600 * 1000);
          const p2 = (n) => String(n).padStart(2, '0');
          await tgSendPhoto(env.MIJOZ_BOT_TOKEN, adminChatId, kartalar[i].buf,
            `📱 Story: ${nom[kartalar[i].rol]}\nChiqish vaqti: ${p2(t.getUTCDate())}.${p2(t.getUTCMonth() + 1)} ${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())}\n\nTasdiqlamaguncha Instagram'ga CHIQMAYDI.`,
            { inline_keyboard: [[{ text: '✅ Story qo\'y', callback_data: `sty:ok:${qid}` }, { text: '❌ Boshqasini yarat', callback_data: `sty:no:${qid}` }]] });
        }
        await xabar('📸 Reels joylandi. 3 ta Story tasdiq uchun yuborildi (tasdiqlamaguncha chiqmaydi).');
      } catch (se) {
        await xabar(`📸 Reels joylandi. Story kartalar xato (video takrorlanmadi): ${String((se && se.message) || se)}`);
      }
    } catch (e) {
      await xabar(`⚠️ Instagram Reels/Story xato: ${String((e && e.message) || e)}`);
    }
  }
  if (p.qism === 'ig') return;
  if (env.TELEGRAM_CHANNEL_ID) {
    try {
      const vr = await fetch(videoUrl, { signal: AbortSignal.timeout(120000) });
      if (!vr.ok) throw new Error(`video yuklab bo'lmadi (${vr.status})`);
      const fd = new FormData();
      fd.append('chat_id', String(env.TELEGRAM_CHANNEL_ID)); fd.append('caption', String(caption || sarlavha || '').slice(0, 1000)); fd.append('supports_streaming', 'true');
      fd.append('video', new Blob([await vr.arrayBuffer()], { type: 'video/mp4' }), 'reel.mp4');
      const tr = await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendVideo`, { method: 'POST', body: fd, signal: AbortSignal.timeout(180000) });
      if (!tr.ok) throw new Error(`Telegram ${tr.status} ${(await tr.text().catch(() => '')).slice(0, 160)}`);
      await xabar('📣 Telegram kanalga joylandi.');
    } catch (e) {
      await xabar(`⚠️ Telegram kanal xato: ${String((e && e.message) || e)}`);
    }
  } else await xabar("ℹ️ Telegram kanal: TELEGRAM_CHANNEL_ID sozlanmagan -- o'tkazib yuborildi");
}

// Cron chaqiradi (Cloudflare nashr-navbati -> /nashr-ig-tg)
export async function bajarIgTg({ env, id, adminChatId }) {
  const r = await (await fetch(`${env.SUPABASE_URL}/rest/v1/nashr_navbati?id=eq.${id}&select=payload`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } })).json();
  const p = r && r[0] && r[0].payload;
  if (!p) throw new Error('video_ig_tg yozuvi topilmadi');
  await igTgNashr(env, p, p.adminChatId || adminChatId);
}

export async function bajarNashr({ env, id, adminChatId }) {
  const sb = (p, init = {}) => fetch(`${env.SUPABASE_URL}/rest/v1/${p}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const xabar = (t) => tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId, t).catch(() => {});
  const rows = await (await sb(`nashr_navbati?id=eq.${id}&select=*`)).json();
  const q = rows && rows[0];
  if (!q || q.turi !== 'video_nashr') return xabar('⚠️ Nashr yozuvi topilmadi');
  if (q.holat === 'bajarildi') return xabar('ℹ️ Bu video allaqachon joylangan');
  const { video_url: videoUrl, cover_url: coverUrl, caption, sarlavha, tavsif } = q.payload;
  await sb(`nashr_navbati?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ holat: 'bajarildi' }) }).catch(() => {});

  // Instagram Reels + Story + Telegram kanal: haftalik jadval bo'yicha (nashr_navbati 'video_ig_tg'), xato bo'lsa darhol.
  const slotlar = await slotlarHisobla(env);
  let igReja = null;
  try {
    const r = await sb('nashr_navbati', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ turi: 'video_ig_tg', holat: 'kutilmoqda', nashr_vaqti: slotlar.ig.toISOString(), payload: { video_url: videoUrl, cover_url: coverUrl, caption, sarlavha, tavsif, qism: 'ig', yt_vaqt: slotlar.yt.toISOString(), adminChatId } }) });
    await sb('nashr_navbati', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ turi: 'video_ig_tg', holat: 'kutilmoqda', nashr_vaqti: new Date(slotlar.ig.getTime() + 30 * 60e3).toISOString(), payload: { video_url: videoUrl, cover_url: coverUrl, caption, sarlavha, tavsif, qism: 'tg', yt_vaqt: slotlar.yt.toISOString(), adminChatId } }) });
    if (!r.ok) throw new Error(`navbat ${r.status}`);
    igReja = slotlar.ig;
  } catch (e) {
    await xabar(`⚠️ Jadvalga qo'yib bo'lmadi (${String((e && e.message) || e).slice(0, 120)}), Instagram va Telegram kanalga darhol joylanadi.`);
    await igTgNashr(env, { video_url: videoUrl, cover_url: coverUrl, caption, sarlavha, tavsif }, adminChatId);
  }
  if (igReja) await xabar(`🗓 Jadval (Toshkent):\n📸 Instagram Reels: ${tosh(igReja)}\n📣 Telegram kanal: ${tosh(new Date(igReja.getTime() + 30 * 60e3))}\n📺 YouTube Shorts: ${tosh(slotlar.yt)}\n📘 Facebook: ertalabki oynada`);
  if (env.FACEBOOK_PAGE_ID) {
    try {
      await navbatgaQoshFacebookVideo(env, videoUrl, coverUrl, caption);
      await xabar('📘 Facebook video navbatga qo\'yildi (ertalabki oynada chiqadi).');
    } catch (e) {
      await xabar(`⚠️ Facebook navbat xato: ${String((e && e.message) || e)}`);
    }
  }
  if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET || !env.YOUTUBE_REFRESH_TOKEN) {
    return xabar("ℹ️ YouTube sozlanmagan (YOUTUBE_* env yo'q) -- o'tkazib yuborildi");
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nashr-'));
  try {
    await xabar('⏳ YouTube Shorts yuklanmoqda...');
    const vp = path.join(tmp, 'v.mp4');
    fs.writeFileSync(vp, Buffer.from(await (await fetch(videoUrl)).arrayBuffer()));
    const cb = coverUrl ? Buffer.from(await (await fetch(coverUrl)).arrayBuffer()) : null;
    const yt = await youtubeUpload(env, vp, sarlavha, tavsif || '', cb, slotlar.yt);
    if (yt && yt.url) {
      const t = new Date(yt.nashrVaqti.getTime() + 5 * 3600 * 1000);
      const p = (n) => String(n).padStart(2, '0');
      await xabar(`📺 YouTube Shorts yuklandi, nashr: ${p(t.getUTCDate())}.${p(t.getUTCMonth() + 1)} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())} (Toshkent)\n${yt.url}${yt.thumbXato ? `\n⚠️ Qopqoq o'rnatilmadi: ${yt.thumbXato}` : ''}`);
    } else if (yt && yt.xato) {
      await xabar(`⚠️ YouTube xato: ${yt.xato}`);
    }
  } catch (e) {
    await xabar(`⚠️ YouTube xato: ${String((e && e.message) || e)}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}


// Admin Story kartasini ❌ qilganda: BOSHQA variant yaratib, yana tasdiqqa yuboradi.
export async function bajarStoryVariant({ env, id, adminChatId }) {
  const sbh = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  const xabar = (t) => tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId, t).catch(() => {});
  const rows = await (await fetch(`${env.SUPABASE_URL}/rest/v1/nashr_navbati?id=eq.${id}&select=*`, { headers: sbh })).json();
  const q = rows && rows[0];
  const pl = q && q.payload;
  if (!pl || !pl.manba_video) return xabar("ℹ️ Bu karta uchun yangi variant yaratib bo'lmadi (manba yo'q).");
  const v = (pl.v || 0) + 1;
  if (v > 3) return xabar("ℹ️ Bu Story uchun 3 ta variant allaqachon taklif qilindi. Hozircha yangisi yaratilmaydi.");
  try {
    const buf = await storyVariantYarat({ env, videoUrl: pl.manba_video, sarlavha: pl.sarlavha, rol: pl.rol, v });
    const url = await supabaseRasmUpload(env, buf);
    const vaqt = new Date(Math.max(Date.parse(q.nashr_vaqti), Date.now()));
    const qid = await navbatgaQoshStory(env, url, vaqt, true, { manba_video: pl.manba_video, sarlavha: pl.sarlavha, rol: pl.rol, v });
    if (!qid) return xabar('⚠️ Yangi variantni navbatga qo\'yib bo\'lmadi.');
    const t = new Date(vaqt.getTime() + 5 * 3600 * 1000);
    const p2 = (n) => String(n).padStart(2, '0');
    await tgSendPhoto(env.MIJOZ_BOT_TOKEN, adminChatId, buf,
      `📱 Story (yangi variant ${v}/3): ${pl.rol}\nChiqish vaqti: ${p2(t.getUTCDate())}.${p2(t.getUTCMonth() + 1)} ${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())}\n\nTasdiqlamaguncha Instagram'ga CHIQMAYDI.`,
      { inline_keyboard: [[{ text: '✅ Story qo\'y', callback_data: `sty:ok:${qid}` }, { text: '❌ Boshqasini yarat', callback_data: `sty:no:${qid}` }]] });
  } catch (e) {
    await xabar(`⚠️ Yangi Story variant xato: ${String((e && e.message) || e)}`);
  }
}

// ───────────────────────── Animatsion video (material yo'q kunlar uchun) ─────────────────────────
// AI mavzu va senariy yozadi -> ovoz (TTS) -> brend slaydlar (Ken Burns) ->
// fon muzika (ovoz ustida past) -> subtitr -> qopqoq -> ADMIN TASDIG'IGA.
const USTUNLAR = ['Interyer xatolari', 'Kichik xonani katta ko\'rsatish', 'Yoritish sirlari', 'Material tanlash', 'Remont rejasi va tartibi', 'Rang va uslub', 'Planirovka maslahati', 'Byudjetni tejash'];

async function tgSoniya(file) {
  const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file]);
  return parseFloat(stdout) || 0;
}

// Diktor uchun matn: tinish belgilari orqali jonli pauzalar (kitobiy bir tekis o'qishni yumshatadi)
export function lotinKirill(t) {
  const U = String(t).replace(/[ʻʼ‘’`´]/g, "'");
  const mp = [["yo'", 'йў'], ["Yo'", 'Йў'], ['ye', 'е'], ['Ye', 'Е'], ["O'", 'Ў'], ["o'", 'ў'], ["G'", 'Ғ'], ["g'", 'ғ'], ['Sh', 'Ш'], ['sh', 'ш'], ['Ch', 'Ч'], ['ch', 'ч'], ['Yo', 'Ё'], ['yo', 'ё'], ['Yu', 'Ю'], ['yu', 'ю'], ['Ya', 'Я'], ['ya', 'я'], ['Ng', 'Нг'], ['ng', 'нг'], ["'", 'ъ']];
  const one = { a: 'а', b: 'б', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з' };
  let out = '';
  for (let i = 0; i < U.length;) {
    let ok = false;
    for (const [a, b] of mp) if (U.startsWith(a, i)) { out += b; i += a.length; ok = true; break; }
    if (ok) continue;
    const c = U[i], lc = c.toLowerCase();
    if (lc === 'e' && (i === 0 || !/[a-zA-Z']/.test(U[i - 1]))) out += c === c.toLowerCase() ? 'э' : 'Э';
    else if (one[lc]) out += c === lc ? one[lc] : one[lc].toUpperCase();
    else out += c;
    i++;
  }
  return out;
}

function ovozMatni(m) {
  let t = String(m || '').replace(/\s+/g, ' ')
    .replace(/\s*:\s*/g, ', ').replace(/\s*[—–-]\s+/g, ', ')
    .replace(/([.!?])\s+/g, '$1 ... ').replace(/\?\s*\.\.\./g, '? ...').trim();
  const y = process.env.TTS_YOZUV;
  if (y === 'kirill') t = lotinKirill(t);
  else if (y === 'lotin2') t = t.replace(/([oOgG])['‘’`ʼ]/g, '$1\u02BB').replace(/'/g, '\u02BC');
  return t;
}

export const ovozMatniOl = ovozMatni;
function elMatn(t, env) {
  const y = env.EL_YOZUV === undefined ? 'kirill' : env.EL_YOZUV;
  const f = (x) => y === 'kirill' ? lotinKirill(x) : y === 'lotin2' ? String(x).replace(/([oOgG])['‘’`ʼ]/g, '$1\u02BB').replace(/'/g, '\u02BC') : x;
  return String(t).split(/(\[[^\]]*\])/).map((p) => (p.startsWith('[') ? p : f(p))).join('');
}
export async function ovozYarat(env, matnTeg, outPath, tmpDir) {
  const matn = String(matnTeg || '').replace(/\[[^\]]*\]\s*/g, '').trim(); // [teg]lar faqat ElevenLabs v3 uchun
  // 0) Muallifning o'z ovozi (ElevenLabs klon) -- kalit va ovoz ID qo'yilgan bo'lsa
  if (env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID) {
    try {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${env.ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`, {
        method: 'POST', headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: elMatn(matnTeg, env), model_id: env.ELEVENLABS_MODEL || 'eleven_v3', voice_settings: { stability: Number(env.EL_STABILITY ?? 0.5), similarity_boost: 0.85, speed: Number(env.EL_TEZLIK || 1.1), use_speaker_boost: true } }),
        signal: AbortSignal.timeout(45000) });
      if (r.ok) { fs.writeFileSync(outPath, Buffer.from(await r.arrayBuffer())); return; }
      console.error('ElevenLabs xato:', r.status, (await r.text().catch(() => '')).slice(0, 200));
    } catch (e) { console.error('ElevenLabs xato:', e && e.message); }
  }
  // 1) Microsoft Edge neyron ovozi (o'zbek, erkak: Sardor) -- har urinishda yangi ulanish, kutish bilan
  const edgeXato = [];
  // 1-0) Python edge-tts (Microsoft protokolining eng yangi versiyasi bilan)
  try {
    const tf = path.join(tmpDir, `t${Date.now()}.txt`);
    fs.writeFileSync(tf, ovozMatni(matn), 'utf8');
    await execFileAsync('edge-tts', ['-f', tf, '-v', process.env.TTS_OVOZ || 'uz-UZ-SardorNeural', `--rate=${process.env.TTS_TEZLIK || '+4%'}`, `--pitch=${process.env.TTS_PITCH || '-1Hz'}`, '--write-media', outPath], { timeout: 60000, maxBuffer: 1024 * 1024 * 5 });
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) return;
    throw new Error('edge-tts bo\'sh fayl');
  } catch (e) { console.error('edge-tts(py) xato:', String((e && (e.stderr || e.message)) || e).slice(0, 200)); }
  // 1-a) Cloudflare proksi orqali (Render IP'si to'silgan bo'lsa ham ishlaydi)
  if (process.env.MEDIA_SECRET) {
    for (let u = 0; u < 2; u++) {
      try {
        const r = await fetch(process.env.TTS_PROKSI_URL || 'https://visartdesign.uz/api/tts', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-media-secret': process.env.MEDIA_SECRET },
          body: JSON.stringify({ matn: ovozMatni(matn), voice: process.env.TTS_OVOZ || 'uz-UZ-SardorNeural', rate: process.env.TTS_TEZLIK || '+4%', pitch: process.env.TTS_PITCH || '-1Hz' }), signal: AbortSignal.timeout(50000) });
        if (!r.ok) throw new Error(`proksi ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
        const ab = Buffer.from(await r.arrayBuffer());
        if (ab.length < 1000) throw new Error('proksi bo\'sh audio');
        fs.writeFileSync(outPath, ab);
        return;
      } catch (e) { const m = String((e && e.message) || e).slice(0, 120); edgeXato.push(m); console.error('TTS proksi xato:', m); await new Promise((r2) => setTimeout(r2, 1500)); }
    }
  }
  for (let u = 0; u < 2; u++) {
    try {
      const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
      const tts = new MsEdgeTTS();
      await tts.setMetadata(process.env.TTS_OVOZ || 'uz-UZ-SardorNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const dir = fs.mkdtempSync(path.join(tmpDir, 'tts-'));
      const pr = u < 2 ? { rate: process.env.TTS_TEZLIK || '+4%', pitch: process.env.TTS_PITCH || '-1Hz' } : undefined;
      const r = await tts.toFile(dir, ovozMatni(matn), pr);
      fs.copyFileSync(r.audioFilePath, outPath);
      return;
    } catch (e) {
      const m = String((e && e.message) || e).slice(0, 120);
      edgeXato.push(m); console.error('Edge TTS xato:', m);
      await new Promise((r) => setTimeout(r, 2000 * (u + 1)));
    }
  }
  // 1b) Google Translate TTS (o'zbek, kalitsiz, zaxira) -- Edge to'silganda
  try {
    const gap = ovozMatni(matn).replace(/\s+/g, ' ').trim();
    const bo = []; let c = '';
    for (const w of gap.split(' ')) { if (c && (c + ' ' + w).length > 180) { bo.push(c); c = w; } else c = (c + ' ' + w).trim(); }
    if (c) bo.push(c);
    const qism = [];
    for (let i = 0; i < bo.length; i++) {
      const r = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=uz&q=${encodeURIComponent(bo[i])}`, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://translate.google.com/' }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error('Google TTS ' + r.status);
      const f = path.join(tmpDir, `g${Date.now()}_${i}.mp3`);
      fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); qism.push(f);
    }
    const lst = path.join(tmpDir, `gl${Date.now()}.txt`);
    fs.writeFileSync(lst, qism.map((f) => `file '${f}'`).join('\n'));
    await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', lst, '-af', 'atempo=1.08,aresample=44100', '-ac', '1', outPath]);
    return;
  } catch (e) { edgeXato.push('Google: ' + String((e && e.message) || e).slice(0, 60)); console.error('Google TTS xato:', edgeXato[edgeXato.length - 1]); }
  // 2) Gemini TTS (zaxira)
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `O'zbek tilida, tabiiy va iliq, aniq talaffuz bilan o'qing: ${matn}` }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } } },
    }),
  });
  if (!res.ok) throw new Error(`TTS xato: Gemini ${res.status}; Edge/Google: ${edgeXato.slice(-2).join(' | ') || '?'}`);
  const d = await res.json();
  const b64 = d.candidates[0].content.parts[0].inlineData.data;
  const pcm = path.join(tmpDir, 'v.pcm');
  fs.writeFileSync(pcm, Buffer.from(b64, 'base64'));
  await execFileAsync('ffmpeg', ['-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', pcm, outPath]);
}

// Atrof-muhit effekti (shamol, suv...) -- music/sfx/<nom>*.mp3 bo'lsa shu, bo'lmasa sintez; diktor ovoziga past qatlam bo'lib qo'shiladi
export async function sfxQosh(nom, mp3, dur, tmpDir, fx = []) {
  const sfxDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'music', 'sfx');
  const topish = (k) => { try { const f = fs.readdirSync(sfxDir).filter((x) => x.toLowerCase().startsWith(k) && /\.(mp3|wav|m4a)$/i.test(x)); return f.length ? path.join(sfxDir, f[Math.floor(Math.random() * f.length)]) : null; } catch (e) { return null; } };
  const sintez = { shamol: 'highpass=f=250,lowpass=f=1800,tremolo=f=0.35:d=0.7,aecho=0.6:0.5:60:0.3', suv: 'highpass=f=600,lowpass=f=6000,tremolo=f=7:d=0.4' }[nom];
  const fayl = nom ? topish(nom) : null;
  const bir = (Array.isArray(fx) ? fx : []).map((x) => ({ f: topish(String(x.k || '')), t: Math.max(0, Number(x.t) || 0), v: Number(x.v) || 0.6 })).filter((x) => x.f && x.t < dur - 0.3);
  if (!nom || (!fayl && !sintez)) { if (!bir.length) return; }
  const out = mp3.replace(/\.mp3$/, '.fx.mp3');
  const args = ['-y', '-i', mp3];
  const fl = [];
  const tarkib = ['[0:a]'];
  let idx = 1;
  if (nom && (fayl || sintez)) {
    args.push(...(fayl ? ['-stream_loop', '-1', '-i', fayl] : ['-f', 'lavfi', '-i', `anoisesrc=color=pink:amplitude=0.8:d=${Math.ceil(dur) + 1}:r=44100,${sintez}`]));
    fl.push(`[${idx}:a]volume=${fayl ? 0.3 : 1.6},afade=t=in:d=0.6,afade=t=out:st=${Math.max(0.5, dur - 0.8)}:d=0.8[s${idx}]`);
    tarkib.push(`[s${idx}]`); idx++;
  }
  for (const x of bir) {
    args.push('-i', x.f);
    fl.push(`[${idx}:a]volume=${x.v || 0.6},adelay=${Math.round(x.t * 1000)}|${Math.round(x.t * 1000)}[s${idx}]`);
    tarkib.push(`[s${idx}]`); idx++;
  }
  fl.push(`${tarkib.join('')}amix=inputs=${tarkib.length}:duration=first:normalize=0[a]`);
  args.push('-filter_complex', fl.join(';'), '-map', '[a]', '-t', String(dur), '-ac', '2', '-ar', '44100', out);
  await execFileAsync('ffmpeg', args);
  fs.renameSync(out, mp3);
}

async function slaydRasm(tur, sarlavha, matn, indeks, jami, outPath, vurgu = '', yuzBuf = null) {
  // Makon Vizual uslubi: och iliq fon, katta serif sarlavha + rangli vurg'u so'z, toza chiziq-chizma.
  const W = 720, H = 1280;
  const BG = '#ecebe6', INK = '#16150f', ACC = '#0e6b5c', ACC2 = '#c4572b';
  const accent = tur === 'hook' ? ACC2 : ACC;
  const fs1 = tur === 'hook' ? 72 : 60;
  const qat = qatorBol(xmlEscape(sarlavha), Math.floor(610 / (fs1 * 0.6))).split('\n');
  const vr = vurgu ? xmlEscape(vurgu).toLowerCase() : '';
  const qatSvg = qat.map((q, i) => {
    const y = 300 + i * (fs1 + 16);
    const sozlar = q.split(' ');
    const tspans = sozlar.map((w) => `<tspan fill="${vr && w.toLowerCase().includes(vr) ? accent : INK}">${w} </tspan>`).join('');
    return `<text x="56" y="${y}" xml:space="preserve" font-family="DejaVu Serif, Georgia, serif" font-size="${fs1}" font-weight="700">${tspans}</text>`;
  }).join('');
  const matnQ = matn ? qatorBol(xmlEscape(matn), 30).split('\n') : [];
  const yMatn = 300 + qat.length * (fs1 + 16) + 30;
  // izometrik xona (chiziq-chizma)
  const ox = 120, oy = 960;
  const xona = `<g fill="none" stroke="${INK}" stroke-opacity="0.55" stroke-width="3">
    <path d="M${ox},${oy} l240,-130 l240,130 l-240,130 z"/>
    <path d="M${ox},${oy} v-200 l240,-130 v200"/><path d="M${ox + 480},${oy} v-200 l-240,-130"/>
    <path d="M${ox + 300},${oy - 150} h90 v60 h-90 z" stroke="${accent}" stroke-width="4"/></g>`;
  const yuzSvg = yuzBuf ? '<image href="data:image/jpeg;base64,YUZ" x="468" y="1010" width="200" height="200" clip-path="url(#c)" preserveAspectRatio="xMidYMid slice"/><circle cx="568" cy="1110" r="100" fill="none" stroke="' + accent + '" stroke-width="5"/>' : '';
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="c"><circle cx="568" cy="1110" r="100"/></clipPath></defs>
    <rect width="${W}" height="${H}" fill="${BG}"/>
    <text x="56" y="96" font-family="Liberation Sans, Arial, sans-serif" font-size="24" font-weight="700" fill="${INK}" letter-spacing="6">VISART DESIGN</text>
    <rect x="56" y="118" width="70" height="4" fill="${accent}"/>
    ${qatSvg}
    ${matnQ.map((q, i) => `<text x="56" y="${yMatn + i * 42}" font-family="Liberation Sans, Arial, sans-serif" font-size="30" fill="#4a463d">${q}</text>`).join('')}
    ${xona}
    ${yuzSvg}
    <text x="56" y="${H - 70}" font-family="Liberation Sans, Arial, sans-serif" font-size="22" fill="#8a8272">${indeks + 1} / ${jami}</text>
  </svg>`;
  let buf = Buffer.from(svg);
  if (yuzBuf) {
    const kichik = await sharp(yuzBuf).resize(200, 200, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82 }).toBuffer();
    buf = Buffer.from(svg.replace('YUZ', kichik.toString('base64')));
  }
  await sharp(buf).png().toFile(outPath);
}

// Rasm manbai: avval Gemini, bo'lmasa bepul Pollinations. {buf} yoki {sabab}.
let rasmKvotaTugagan = false; // 429/402 bo'lsa shu jarayonda qayta urinmaymiz
async function svgIllyustratsiya(env, mavzu) {
  const prompt = `Create a flat, minimalist architectural line-and-color illustration as ONE SVG for this subject: ${mavzu}. ` +
    'Canvas: viewBox="0 0 720 720", no background rect (transparent). Style: clean isometric or front-view diagram, thin dark strokes (#16150f, stroke-width 3), flat fills in warm neutrals (#d9d4c7, #c9c2b0) with ONE accent color (#0e6b5c teal or #c4572b terracotta), simple shapes only (rect, polygon, path, circle, line), clear readable composition filling the canvas, subtle soft shadow shapes. No text, no letters, no images, no scripts. Output ONLY the <svg>...</svg> markup.';
  const xatolar = [];
  for (const model of GEMINI_MODELLAR) {
    for (let u = 0; u < 2; u++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 8192 } }), signal: AbortSignal.timeout(60000) });
        if (!res.ok) { xatolar.push(`${model} HTTP ${res.status}`); break; }
        const d = await res.json();
        const text = ((((d.candidates || [])[0] || {}).content || {}).parts || []).map((p) => p.text || '').join('');
        const m = text.match(/<svg[\s\S]*<\/svg>/i);
        if (!m) { xatolar.push(`${model} svg yo'q: ${text.slice(0, 60).replace(/\s+/g, ' ')}`); continue; }
        const svg = m[0].replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<image[\s\S]*?>/gi, '').replace(/<svg\b[^>]*>/i, (t) => (/xmlns=/.test(t) ? t : t.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')).replace(/\s(width|height)="[^"]*"/g, '').replace('<svg', '<svg width="720" height="720"'));
        const png = await sharp(Buffer.from(svg)).resize(720, 720, { fit: 'contain', background: { r: 236, g: 235, b: 230, alpha: 0 } }).png().toBuffer();
        return await sharp({ create: { width: 720, height: 1280, channels: 3, background: '#ecebe6' } }).composite([{ input: png, left: 0, top: 440 }]).png().toBuffer();
      } catch (e) { xatolar.push(`${model} ${String((e && e.message) || e).slice(0, 70)}`); }
    }
  }
  throw new Error('SVG: ' + xatolar.join('; '));
}

async function rasmYarat(env, prompt, mavzu, faqatFoto = false) {
  const sabablar = [];
  if (env.CF_ACCOUNT_ID && env.CF_AI_TOKEN) {
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
        method: 'POST', headers: { Authorization: `Bearer ${env.CF_AI_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.slice(0, 1800), steps: 6 }), signal: AbortSignal.timeout(60000) });
      if (r.ok) {
        const d = await r.json();
        const b64 = d && d.result && d.result.image;
        if (b64) return { buf: Buffer.from(b64, 'base64') };
        sabablar.push('Cloudflare AI rasm qaytarmadi');
      } else sabablar.push(`Cloudflare AI HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 120)}`);
    } catch (e) { sabablar.push('Cloudflare AI: ' + String((e && e.message) || e).slice(0, 80)); }
  }
  if (env.GEMINI_API_KEY && !rasmKvotaTugagan) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } }), signal: AbortSignal.timeout(60000) });
      if (res.ok) {
        const d = await res.json();
        const im = ((((d.candidates || [])[0] || {}).content || {}).parts || []).find((x) => x.inlineData && x.inlineData.data);
        if (im) return { buf: Buffer.from(im.inlineData.data, 'base64') };
        sabablar.push('Gemini rasm qaytarmadi');
      } else { if (res.status === 429) rasmKvotaTugagan = true; sabablar.push(`Gemini HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 120)}`); }
    } catch (e) { sabablar.push('Gemini: ' + String((e && e.message) || e).slice(0, 80)); }
  }
  if (!rasmKvotaTugagan) try {
    const seed = Math.floor(Math.random() * 1e6);
    const r = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 900))}?width=720&height=1280&nologo=true&model=flux&seed=${seed}`, { signal: AbortSignal.timeout(90000) });
    if (r.ok && /image/.test(r.headers.get('content-type') || '')) return { buf: Buffer.from(await r.arrayBuffer()) };
    if (r.status === 402 || r.status === 429) rasmKvotaTugagan = true;
    sabablar.push(`Pollinations HTTP ${r.status}`);
  } catch (e) { sabablar.push('Pollinations: ' + String((e && e.message) || e).slice(0, 80)); }
  if (faqatFoto) return { sabab: sabablar.join(' | ') };
  try { return { buf: await svgIllyustratsiya(env, mavzu || prompt.slice(0, 200)), svg: true }; } catch (e) { sabablar.push(String((e && e.message) || e)); }
  return { sabab: sabablar.join(' | ') };
}

let _logoB64 = null;
function logoYukla() {
  if (_logoB64 === null) { try { _logoB64 = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'logo-mark.png')).toString('base64'); } catch (e) { _logoB64 = ''; } }
  return _logoB64;
}

async function matnQatlami(sl, ovOut, ai = true) {
  const logoB64 = logoYukla();
  const W = 720, H = 1280;
  const fs1 = sl.tur === 'hook' ? 70 : 58;
  const qat = qatorBol(xmlEscape(sl.sarlavha || ''), Math.floor(620 / (fs1 * 0.6))).split('\n');
  const vr = sl.vurgu ? xmlEscape(sl.vurgu).toLowerCase() : '';
  const tx = qat.map((q, i) => `<text x="52" y="${340 + i * (fs1 + 14)}" xml:space="preserve" font-family="DejaVu Serif, Georgia, serif" font-size="${fs1}" font-weight="700">${q.split(' ').map((w) => `<tspan fill="${vr && w.toLowerCase().includes(vr) ? VURGU : YOZ}">${w} </tspan>`).join('')}</text>`).join('');
  const ov = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${TEMA_BG}" stop-opacity="0.96"/><stop offset="0.7" stop-color="${TEMA_BG}" stop-opacity="0.6"/><stop offset="1" stop-color="${TEMA_BG}" stop-opacity="0"/></linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></linearGradient></defs>
    <rect width="${W}" height="760" fill="url(#t)"/>
    <rect y="${H - 360}" width="${W}" height="360" fill="url(#b)"/>
    ${logoB64 ? `<image href="data:image/png;base64,${logoB64}" x="344" y="172" width="32" height="28"/>` : ''}
    <text x="360" y="222" text-anchor="middle" font-family="Liberation Sans, Arial, sans-serif" font-size="12" font-weight="700" fill="${YOZ}" letter-spacing="3.5">VISART DESIGN</text>${tx}
    <text x="${W - 40}" y="${H - 70}" text-anchor="end" font-family="Liberation Sans, Arial, sans-serif" font-size="15" fill="#ffffff" fill-opacity="0.7" letter-spacing="2">${ai ? 'AI ' : ''}ILLYUSTRATSIYA · MA'LUMOT UCHUN</text>
  </svg>`);
  await sharp(ov).resize(1080, 1920).png().toFile(ovOut);
}

// Mavzuga mos alohida STATIK oblojka: sahnaning eng mazmunli kadri + katta o'qiladigan mavzu
async function mavzuOblojka(nom, aksent, sarlavha, vurgu, fotoBuf = null) {
  const logoB64 = logoYukla();
  const fs1 = 80;
  const qat = qatorBol(xmlEscape(sarlavha || ''), Math.floor(640 / (fs1 * 0.58))).split('\n').slice(0, 4);
  const vr = vurgu ? xmlEscape(vurgu).toLowerCase() : '';
  const tx = qat.map((q, i) => `<text x="360" y="${330 + i * (fs1 + 12)}" text-anchor="middle" xml:space="preserve" font-family="DejaVu Serif, Georgia, serif" font-size="${fs1}" font-weight="700">${q.split(' ').map((w) => `<tspan fill="${vr && w.toLowerCase().includes(vr) ? VURGU : YOZ}">${w} </tspan>`).join('')}</text>`).join('');
  const sc = fotoBuf ? await sharp(fotoBuf).resize(1080, 1080, { fit: 'cover' }).png().toBuffer() : await sharp(Buffer.from(sahnaSvg(nom, 0.95, aksent)), { density: 108 }).resize(1080, 1080).png().toBuffer();
  const ov = Buffer.from(`<svg width="720" height="1280" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${TEMA_BG}"/><stop offset="0.85" stop-color="${TEMA_BG}" stop-opacity="0.9"/><stop offset="1" stop-color="${TEMA_BG}" stop-opacity="0"/></linearGradient></defs>
    <rect width="720" height="640" fill="url(#t)"/>
    ${logoB64 ? `<image href="data:image/png;base64,${logoB64}" x="344" y="172" width="32" height="28"/>` : ''}
    <text x="360" y="222" text-anchor="middle" font-family="Liberation Sans, Arial, sans-serif" font-size="12" font-weight="700" fill="${YOZ}" letter-spacing="3.5">VISART DESIGN</text>${tx}
  </svg>`);
  const baza = await sharp({ create: { width: 1080, height: 1920, channels: 3, background: TEMA_BG } }).png().toBuffer();
  const ovp = await sharp(ov).resize(1080, 1920).png().toBuffer();
  return sharp(baza).composite([{ input: sc, left: 0, top: 780 }, ...(fotoBuf ? [] : [{ input: await sharp({ create: { width: 1080, height: 240, channels: 3, background: TEMA_BG } }).png().toBuffer(), left: 0, top: 1680 }]), { input: ovp, left: 0, top: 0 }]).jpeg({ quality: 92 }).toBuffer();
}

// Haqiqiy ko'rinishdagi AI foto (faqat Cloudflare/Gemini foto; vektor zaxira yo'q) -> bg + matn qatlami
async function fotoSlayd(env, sl, bgOut, ovOut) {
  const prompt = `Photorealistic professional architectural photograph, ${SAHNA_RASM[sl.sahna]}. Natural light, 35mm lens, high detail, realistic materials, vertical composition, calm empty space in the top 35% of the frame. No text, no letters, no logos, no people.`;
  let r = await rasmYarat(env, prompt, null, true);
  if (!r.buf) r = await rasmYarat(env, prompt, null, true);
  if (!r.buf) throw new Error('Foto yaratilmadi: ' + r.sabab);
  await sharp(r.buf).resize(1440, 2560, { fit: 'cover', position: 'centre' }).jpeg({ quality: 92 }).toFile(bgOut);
  await matnQatlami(sl, ovOut, true);
  return r.buf;
}

// Mavzuga mos AI illyustratsiya (ma'lumot uchun) -> bg (2x, barqaror zoom uchun) + alohida STATIK matn qatlami.
async function animatsiyaAiRasm(env, sl, bgOut, ovOut) {
  const prompt = `Clean educational illustration for an architecture/interior tips video, vertical 9:16. Subject: ${sl.rasm || sl.sarlavha}. ` +
    'Style: minimalist 3D isometric / soft-render concept illustration, light warm beige background, muted natural palette with one teal or terracotta accent, soft shadows, lots of empty space in the TOP 40% of the frame (text will be added). ' +
    'No text, no letters, no numbers, no logos, no people faces.';
  let r = await rasmYarat(env, prompt, sl.rasm || sl.sarlavha);
  if (!r.buf) r = await rasmYarat(env, prompt, sl.rasm || sl.sarlavha);
  if (!r.buf) throw new Error('AI rasm yaratilmadi: ' + r.sabab);
  const W = 720, H = 1280;
  await sharp(r.buf).resize(W * 2, H * 2, { fit: 'cover', position: 'centre' }).jpeg({ quality: 92 }).toFile(bgOut);
  await matnQatlami(sl, ovOut);
}

// Kod bilan chizilgan animatsion sahnani kadrlarga aylantiradi (12.5 fps), 1080x1920 fon + sahna
async function sahnaKadrlar(nom, aksent, dur, dir, t0 = 0, t1 = 1, ovPath = null) {
  const fps = 10;
  const n = Math.max(2, Math.round(dur * fps));
  fs.mkdirSync(dir, { recursive: true });
  const baza = await sharp({ create: { width: 1080, height: 1920, channels: 3, background: TEMA_BG } }).png().toBuffer();
  const ovBuf = ovPath ? fs.readFileSync(ovPath) : null;
  for (let k = 0; k < n; k++) {
    const sc = await sharp(Buffer.from(sahnaSvg(nom, t0 + (t1 - t0) * Math.min(1, k / (n - 1) / 0.9), aksent)), { density: 108 }).resize(880, 880).png().toBuffer();
    await sharp(baza).composite(ovBuf ? [{ input: sc, left: 100, top: 740 }, { input: ovBuf, left: 0, top: 0 }] : [{ input: sc, left: 100, top: 740 }]).jpeg({ quality: 88 }).toFile(path.join(dir, `f${String(k).padStart(4, '0')}.jpg`));
  }
  return fps;
}

async function animatsionSenariy(env, mavzu) {
  let oxirgilar = '';
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/media_taklif?select=sarlavha&order=created_at.desc&limit=15`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }, signal: AbortSignal.timeout(10000) });
    oxirgilar = ((await r.json()) || []).map((x) => x.sarlavha).filter(Boolean).join('; ');
  } catch (e) { /* ixtiyoriy */ }
  const prompt = KREATIV_PROMPT + "\n\n" + BUYRUQ_MATN +
    "\n\nAVTOMATIK REJIM: savol bermang, to'liq mustaqil ishlang. Brend: Visart Design (Toshkent). Material (video/foto) yo'q -- animatsion, ovozli, foydali video kerak. Sizning kodingiz tayyor animatsion SAHNALAR kutubxonasidan foydalanadi (pastda); har slayd uchun bittasini tanlang. Jami ovoz 40-55 soniya, 7-9 slayd.\n" +
    (mavzu ? `Mavzu (admin bergan): ${mavzu}\n` : (() => { const m = keyingiMavzu(); return `XILMA-XILLIK (MAJBURIY): bu safar ustun: "${m.ustun}". ${m.goya ? `G'oya yo'nalishi: "${m.goya}" -- shundan boshlang (aniqlashtirishingiz mumkin, lekin ustundan chiqmang).` : `Bu ustundagi tayyor g'oyalar ishlatib bo'lingan: ${m.ishlatilgan.join('; ')}. Shu ustundan mutlaqo YANGI, oldingilarga o'xshamagan g'oya toping.`} Oxirgi videolar bilan o'xshash mavzu va sarlavha bo'lmasin. Yaqinda chiqqanlar (takrorlamang): ${oxirgilar || "yo'q"}.\n` + (/Tarixiy|Mashhur|Dunyo|Uslublar|Material|Mif|O'zbekiston/.test(m.ustun) ? "TARIXIY/MASHHUR OBYEKT QOIDASI: faqat umume'tirof etilgan, hamma biladigan faktlar; aniq yil, balandlik, raqam va ismni faqat 100% ishonchli bo'lsa ayting, aks holda umumiy tasvirlang; to'qima yo'q. Bu ustunlarda FOTO QOIDASIdagi 'uy' sharti o'rniga: har slaydning 'foto'si shu mavzudagi bino/interyerning (yoki uning detali: gumbaz, ustun, bezak, kesim) fotorealistik tasviri bo'lsin, har slaydda boshqa rakurs; matn/yozuvsiz.\n" : ''); })()) +
    "SAHNALAR (animatsion, har slayd uchun bittasini tanlang). MUHIM: mavzu SAHNALARDAN 2-4 tasi bilan to'liq tushuntiriladigan bo'lsin; ovoz AYNAN sahnada ko'rinayotgan narsani aytsin (sahna ichidagi yozuvlar -- oyna, divan, parda, karavot, quyosh nuri, hammom... -- ovozda tilga olinsin), shunda tomoshabin nima ko'rayotganini darrov tushunadi. Sahnadagi harakat ovoz davomida rivojlanadi (quyosh pastlaydi, parda ochiladi, mebel joylashadi), shuning uchun gap shu jarayonni izohlasin:\n" + SAHNA_MENYU + "\n" +
    "TIL: jonli so'zlashuv o'zbekchasi, ustaga/mijozga tushuntirayotgandek iliq, 'Siz'lab. Tarjima uslubi, rasmiy va kitobiy so'zlar ('ushbu', 'mazkur', 'amalga oshirmoq', 'taqdim etmoq') yo'q. Qisqa gaplar, kelishik va egalik qo'shimchalari to'g'ri (-ning, -ni, -ga, -da, -dan, -i/-si). Oddiy so'zlar: remont, planirovka, kvadrat metr, chiroq, parda, divan, shkaf, oshxona, mehmonxona. Yaxshi: 'Uyingizdagi chiroq rangi xonani arzon ko'rsatib qo'yishi mumkin.' Yomon: 'Ushbu yoritish moslamasi interyerni arzon his ettiradi.' Ovozdagi raqamlar SO'Z bilan yoziladi (2700K -> 'ikki ming yetti yuz kelvin', 4x4 -> 'to'rtga to'rt').\n" + "PROFESSIONAL QOIDALAR: hook birinchi 1.5 soniyada qiziqtirsin (3 soniya ichida butun hook aytiladi, 8 so'zdan oshmasin); har slaydning 'ovoz'i BITTA qisqa gap (6-11 so'z, ~3 soniya) -- vizual har 2-3 soniyada almashadi; ortiqcha, to'ldiruvchi so'z yo'q; oxirgi gap bitta esda qoladigan xulosa yoki tabiiy savol bo'lsin (reklama yoki 'saqlang/yuboring' chaqirig'i MAJBURIY EMAS), hook bilan mazmunan bog'lansin. Emotsiya birinchi: odamga 'bu menga tegishli' degan his bering.\nStruktura: 1-slayd HOOK (0-3 soniya, savol yoki qiziqtiruvchi da'vo), 1-2 slayd MUAMMO VA SABAB (nima uchun shunday), 2-3 slayd YECHIM (arxitektura, interyer yoki qurilishda NIMA QILISH KERAK -- aniq, amaliy, umumiy qabul qilingan usullar), oxirgi slayd FOYDA-XULOSA (shu yechimdan odam nima yutadi: qulaylik, tejam, salqinlik, kenglik...). Faqat muammoni aytib tashlab ketish MAN ETILADI: video albatta 'qanday qursa/qilsa natija bo'ladi' bilan tugasin. Raqam va faktlarni to'qimang; umumiy tan olingan qoidalarni ayting. Jami ovoz 40-55 soniya (7-9 slayd).\n" +
    "MAVZUGA SODIQLIK (MAJBURIY): admin mavzu bergan bo'lsa, video AYNAN shu mavzu haqida bo'lsin, boshqa mavzuga o'tmang; hook va sarlavhada mavzu so'zi bo'lsin.\n" +
    "CHUQUR MAZMUN (MAJBURIY): 1) MUAMMO qanday sodir bo'ladi -- jarayonni bosqichma-bosqich, sabab-oqibat bilan ko'rsating (masalan: yozda tik quyosh -> devor qiziydi -> issiqlik ichkariga o'tadi -> xona qiziydi). 2) Har sabab uchun ANIQ detal: qaysi element (oyna, parda, devor, ayvon, izolyatsiya, chiroq, mebel), qayerda, qanday joylashadi. 3) YECHIM -- har biri alohida slaydda, aniq amal: nima qilinadi, qayerga, qanday parametr/yo'nalish bilan (faqat umumiy tan olingan qoidalar, to'qima raqam yo'q). 4) Har slaydning ovozi ekrandagi ko'rinish bilan mos: 'mana bu oyna', 'shu devor', 'bu yerda' kabi ko'rsatish so'zlari bilan. 5) Oxirida natija: odam nima yutadi. Umumiy gaplar ('muhim', 'e'tibor bering', 'chiroyli bo'ladi') TAQIQLANGAN -- har gap yangi aniq ma'lumot bersin. Slaydlar 7-9 ta, jami ovoz 40-55 soniya.\n" +
    "PROFESSIONAL SENARIYCHI QOIDASI: siz 15 yillik amaliyotchi arxitektor-prorabsiz, mijozga obyektda turib tushuntiryapsiz. Har slaydda bitta aniq fikr: KIM/QAYER (xona, devor, oyna) -> NIMA BO'LADI -> NIMA UCHUN. Yaxshi: 'Yozda quyosh tik tushganda janub oynadan issiqlik to'g'ri xonaga kiradi.' Yomon: 'Quyosh nuri xonaga ta'sir qiladi.' Birinchi gap -- mijoz xatosi yoki og'riq nuqtasi ('Remontda eng qimmat xato -- ...'), ikkinchi -- sabab, keyin yechimlar (har biri: nima + qayerga + natija), oxirida natija. Bir xil qolipdagi gaplar ('Bu muhim', 'Buni unutmang') yo'q. Har slayd 'foto' maydoni haqiqiy, konkret joy tavsifi bo'lsin va 'belgilar' ovozda aytiladigan predmetlarning o'zi bo'lsin (ovozda 'mana bu oyna' desa -- belgida oyna). MUAMMO va YECHIM slaydlarining HAMMASIDA foto va belgilar MAJBURIY.\n" +
    "FOTO QOIDASI: har slaydning 'foto'si BOSHQA-BOSHQA kadr bo'lsin (boshqa xona/burchak/yaqin plan), hech qachon bir xil emas. Faqat haqiqiy, jonli 3D vizualizatsiya: haqiqiy uy, quyosh nuri, daraxtlar, mebel; chizma, sxema, izometrik, 2D yo'q.\n" +
    'JAVOB FAQAT JSON massiv: slaydlar [{"tur":"hook|mazmun|xulosa","sarlavha":"<ekranda 2-5 so\'z>","vurgu":"<sarlavhadagi 1 ta rangli ajratiladigan so\'z>","sahna":"<yuqoridagi SAHNALAR ro\'yxatidan ENG MOS nom, faqat nomning o\'zi>","foto":"<INGLIZCHA: slaydda korsatiladigan HAQIQIY joy/sahna fotosi tavsifi, ANIQ: xona turi, oyna/mebel/material joylashuvi, yoruglik yonalishi; faqat bitta kadrda korinadigan narsalar>","belgilar":[{"ob":"<INGLIZCHA: foto ichidagi aniq predmet, masalan the large window on the left wall>","m":"<ekranda 1-3 sozli ozbekcha belgi>"}] (2-4 ta, ovozda aytilish tartibida),"oqim":[[0,1,"<1-2 soz: Quyosh nuri|Havo|Issiqlik>"]] (ixtiyoriy: belgilar indekslari orasida strelka -- jarayon yonalishi),"rasm":"<INGLIZCHA (zaxira): shu slaydga mos illyustratsiya tavsifi, masalan isometric cutaway room with low winter sun angle>","matn":"<ekranda 0-8 so\'z yoki bo\'sh>","ovoz":"<diktor aytadigan 1-2 qisqa gap>","fx":"<ixtiyoriy: [{\"k\":\"eshik|qadam|qurilish|suv|shamol|qushlar|yomgir|oshxona|sahifa|klik|pol|bogh\",\"t\":soniya}] -- FAQAT ekrandagi harakatga HAQIQATAN mos tovush (eshik ochilsa eshik); ortiqcha effekt qo\'shmang>"}], oxirgi element: {"tur":"meta","post_sarlavha":"<3-6 so\'z>","vurgu":"<sarlavhadagi 1 ta so\'z>","tavsif":"<Instagram izohi: hook + 2 gap + savol>","hashtaglar":"<6-8 hashtag>"}';
  return geminiJsonSora(env.GEMINI_API_KEY, [{ text: prompt }]);
}

// Mantiq/aniqlik muharriri: ketma-ketlik, atamalar izohi, slaydlararo moslik, takror va ziddiyatni tuzatadi (faqat "ovoz" matni).
export async function mantiqTahrir(env, slaydlar, mavzu) {
  try {
    const tuz = await geminiJsonSora(env.GEMINI_API_KEY, [{ text:
      "Siz arxitektura bo'yicha ta'limiy video bosh muharririsiz. Quyida video diktor matnlari (slaydlar tartibida) va har slaydda ko'rinadigan sahna berilgan. Mavzu: " + (mavzu || 'berilgan') + ".\n" +
      "VAZIFA: matnni oddiy odam ham tushunadigan, lekin detalgacha aniq qiling. Tekshiring va tuzating:\n" +
      "1) SODDALIK: murakkab atama birinchi marta kelganda bitta qisqa jumla bilan izohlansin ('gumbaz -- tepadagi yarim shar shaklidagi yopma'); 12 so'zdan uzun gap bo'lmasin.\n" +
      "2) DETALGACHA: umumiy gap ('yaxshi yechim') o'rniga aniq element va uning vazifasi ('ustun yukni pastga uzatadi, devor esa faqat to'siq').\n" +
      "3) KETMA-KETLIK: har slayd oldingisidan mantiqan kelib chiqsin (savol -> sabab -> mexanizm -> yechim -> xulosa); slaydlar orasi bog'lansin ('shuning uchun', 'endi qarang', 'natijada').\n" +
      "4) MOSLIK: ovoz shu slaydda ko'rinayotgan sahnani aytsin; slaydlar bir-biriga zid bo'lmasin; bir fikr/jumla ikki marta takrorlanmasin; murojaat bir xil ('Siz').\n" +
      "5) ISHONCHLILIK: tasdiqlanmagan yil, raqam, ism, foiz qo'shmang; shubhali bo'lsa olib tashlang yoki umumiy ayting.\n" +
      "6) HAJM: har slayd matni uzunligi asl matndan ko'pi bilan 25% farq qilsin. Ma'noni o'zgartirmang.\n" +
      "Faqat JSON massiv qaytaring: aynan " + slaydlar.length + " ta obyekt [{\"ovoz\":\"...\"}], tartib saqlansin. Kirish: " + JSON.stringify(slaydlar.map((x, i) => ({ n: i + 1, tur: x.tur, sahna: x.sahna, ovoz: x.ovoz }))) }]);
    if (Array.isArray(tuz) && tuz.length === slaydlar.length && tuz.every((x) => x && typeof x.ovoz === 'string' && x.ovoz.trim().length > 5)) {
      return slaydlar.map((x, i) => ({ ...x, ovoz: tuz[i].ovoz.trim() }));
    }
  } catch (e) { /* ixtiyoriy */ }
  return slaydlar;
}

export async function ovozTahrir(env, slaydlar, sarlavhaSaqla = false, brend = true) {
  try {
    const tuz = await geminiJsonSora(env.GEMINI_API_KEY, [{ text:
      BUYRUQ_MATN + "Siz o'zbek tilining tajribali muharririsiz (Toshkent shevasiga yaqin, jonli so'zlashuv). Quyidagi video diktor matnlarini USTA DO'STIGA GAPIRGANDEK tabiiy, grammatik to'g'ri, jonli o'zbekchaga keltiring: kitobiy va tarjima uslubini olib tashlang (ushbu, mazkur, amalga oshirmoq, taqdim etmoq, mavjud, kabi), -moqda/-ayotgan o'rniga -yapti/-ayotgan jonli shakl, gap tartibi so'zlashuvdagidek (fe'l oxirda), 'bo'lishi mumkin' o'rniga 'bo'lishi ham mumkin'/'bo'lib qolishi mumkin' kabi tabiiy burilishlar, yordamchi so'zlar ('axir', 'ya'ni', 'mana', 'shunda') o'rinli ishlating, uzun gapni ikkiga bo'ling, kelishik/egalik qo'shimchalarini to'g'rilang, 'Siz'lab, qisqa gaplar, ma'noni va sahnada ko'rinadigan narsalarning nomlarini saqlang, so'z sonini oshirmang (har biri 6-12 so'z), raqamlar so'z bilan. " + (brend ? "Agar hech bir slaydda 'Vizart Dizayn' brendi tilga olinmagan bo'lsa, yechim slaydlaridan birining ovoziga tabiiy qilib 'Vizart Dizayn jamoasi buni mana bunday hal qiladi' ma'nosini qo'shing. " : "Brend nomini qo'shmang, ma'noni o'zgartirmang. Imlo, kelishik va egalik qo'shimchalari, fe'l shakllari va gap tartibini mukammal qiling. Matn KITOBDAN O'QILGANDEK emas, ustaning ishonchli jonli og'zaki nutqidek eshitilsin: qisqa gaplar (6-10 so'z), vergul va tire bilan tabiiy pauzalar, o'rinli 'Qarang', 'Ko'ryapsizmi', 'Mana', 'Shuning uchun' kabi og'zaki bog'lovchilar, savol-javob ritmi. Kitobiy burilishlar yo'q. ") +
      "Faqat JSON massiv qaytaring: aynan " + slaydlar.length + " ta obyekt [{\"sarlavha\":\"...\",\"ovoz\":\"...\"}], tartib saqlansin. Kirish: " + JSON.stringify(slaydlar.map((x) => ({ sarlavha: x.sarlavha, ovoz: x.ovoz }))) }]);
    if (Array.isArray(tuz) && tuz.length === slaydlar.length) {
      return slaydlar.map((x, i) => ({ ...x, sarlavha: sarlavhaSaqla ? x.sarlavha : String((tuz[i] && tuz[i].sarlavha) || x.sarlavha).trim(), ovoz: String((tuz[i] && tuz[i].ovoz) || x.ovoz).trim() }));
    }
  } catch (e) { /* tahrir ixtiyoriy */ }
  return slaydlar;
}

let _animZanjir = Promise.resolve();
const _animIshlar = new Set();
// Bir vaqtda faqat BITTA animatsiya (512 MB xotira), bir xil ish ikki marta boshlanmaydi
export function bajarAnimatsion(a) {
  if (a.ishId && _animIshlar.has(a.ishId)) return Promise.resolve();
  if (a.ishId) _animIshlar.add(a.ishId);
  const p = _animZanjir.then(() => bajarAnimatsionIc(a)).finally(() => { if (a.ishId) _animIshlar.delete(a.ishId); });
  _animZanjir = p.catch(() => {});
  return p;
}
async function bajarAnimatsionIc({ env, adminChatId, mavzu, korsatma, ishId }) {
  const ishYop = (holat) => ishId ? fetch(`${env.SUPABASE_URL}/rest/v1/nashr_navbati?id=eq.${ishId}`, { method: 'PATCH', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ holat }), signal: AbortSignal.timeout(8000) }).catch(() => {}) : null;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anim-'));
  try {
    await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId, "🎞️ Material yo'q -- animatsion ovozli video tayyorlanmoqda...");
    let oxirgi = [];
    try {
      const rr = await fetch(`${env.SUPABASE_URL}/rest/v1/nashr_navbati?select=payload&turi=eq.video_nashr&order=created_at.desc&limit=40`, {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }, signal: AbortSignal.timeout(10000) });
      oxirgi = ((await rr.json()) || []).map((x) => x && x.payload && x.payload.sarlavha);
    } catch (e) { /* ixtiyoriy */ }
    const bank = null; // faqat AI senariy + haqiqiy foto
    const raw = bank
      ? [...bank.slaydlar, { tur: 'meta', post_sarlavha: bank.post_sarlavha, vurgu: bank.vurgu, tavsif: bank.tavsif, hashtaglar: bank.hashtaglar }]
      : await animatsionSenariy(env, [mavzu, korsatma ? `ADMIN TUZATISH KO'RSATMASI (albatta bajaring, avvalgi variant yoqmadi): ${korsatma}` : ''].filter(Boolean).join('. '));
    const meta = raw.find((x) => x.tur === 'meta') || {};
    let slaydlar = raw.filter((x) => x.tur !== 'meta' && x.ovoz).slice(0, 9);
    if (slaydlar.length < 3) throw new Error('senariy yetarli emas');
    if (!bank) slaydlar = await mantiqTahrir(env, slaydlar, mavzu || (meta && meta.post_sarlavha) || '');
    slaydlar = await ovozTahrir(env, slaydlar, !!bank);

    const yuzBuf = await yuzTanla(env);
    let qopqoqAsos = null;
    let qopqoqSahna = null;
    let qopqoqFoto = null;
    const izohKesh = {};
    const segFiles = [];
    const subtitr = [];
    let t = 0;
    for (let i = 0; i < slaydlar.length; i++) {
      const sl = slaydlar[i];
      const png = path.join(tmpDir, `s${i}.png`);
      const mp3 = path.join(tmpDir, `v${i}.mp3`);
      const seg = path.join(tmpDir, `seg${i}.mp4`);
      const bg = path.join(tmpDir, `bg${i}.jpg`);
      const ov = path.join(tmpDir, `ov${i}.png`);
      const sahnaNom = SAHNALAR[sl.sahna] ? sl.sahna : null;
      let fotoBuf = null;
      if (env.CF_ACCOUNT_ID && env.CF_AI_TOKEN && (i === 0 || i === slaydlar.length - 1) && SAHNA_RASM[sl.sahna]) {
        try { fotoBuf = await fotoSlayd(env, sl, bg, ov); if (!qopqoqFoto) qopqoqFoto = fotoBuf; } catch (e) { fotoBuf = null; }
      }
      console.log(`[anim] slayd ${i + 1}/${slaydlar.length} ${sl.sahna} boshlandi`);
      await ovozYarat(env, sl.ovoz, mp3, tmpDir);
      const dur = (await tgSoniya(mp3)) + 0.5;
      await sfxQosh(SAHNA_SFX[sl.sahna], mp3, dur, tmpDir, sl.fx).catch(() => {});
      const kadr = Math.round(dur * 25);
      const aksent = ['#c4572b', '#0e6b5c'][i % 2];
      let izohOk = false;
      if (!sl.foto) sl.foto = (SAHNA_RASM[sl.sahna] || sl.rasm || sl.sarlavha || 'modern interior');
      const gCfg = !fotoBuf ? (slaydIzohCfg(sl) || { obj: {}, steps: [] }) : null;
      if (gCfg && env.CF_ACCOUNT_ID && env.CF_AI_TOKEN && env.GEMINI_API_KEY) {
        try {
          const kal = 'g:' + sl.foto;
          if (!izohKesh[kal]) {
            let rr = await rasmYarat(env, `Ultra realistic 3D architectural visualization photo, Corona render quality, ${sl.foto}. Real house, real sunlight and shadows, real trees and plants, natural materials, 35mm lens, sharp focus, square composition, everything described is clearly visible. No text, no letters, no people.`, null, true);
            if (!rr.buf) rr = await rasmYarat(env, `Photorealistic architectural photograph, ${sl.foto}. No text, no people.`, null, true);
            if (!rr.buf) throw new Error("foto yo'q");
            izohKesh[kal] = { buf: rr.buf, joy: Object.keys(gCfg.obj).length ? await obyektJoyi(env, rr.buf, gCfg.obj, geminiJsonSora).catch(() => ({})) : {} };
          }
          await matnQatlami(sl, ov, false);
          const fdir = path.join(tmpDir, `fr${i}`);
          const fps = await fotoIzohKadrlar({ cfg: gCfg, fotoBuf: izohKesh[kal].buf, joy: izohKesh[kal].joy, dur, dir: fdir, t0: 0, t1: 1, aksent, ovBuf: fs.readFileSync(ov), SAHNA_BG: TEMA_BG, zk: 0.1 });
          if (!qopqoqFoto) qopqoqFoto = izohKesh[kal].buf;
          await execFileAsync('ffmpeg', [
            '-y', '-framerate', String(fps), '-i', path.join(fdir, 'f%04d.jpg'), '-i', mp3,
            '-filter_complex', '[0:v]fps=25,format=yuv420p[v]',
            '-map', '[v]', '-map', '1:a', '-af', 'apad,aresample=44100', '-t', String(dur),
            '-c:v', 'libx264', '-preset', 'superfast', '-crf', '20', '-maxrate', '12M', '-bufsize', '24M', '-threads', '2', '-x264-params', 'ref=1:bframes=0',
            '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '44100', seg,
          ], { maxBuffer: 1024 * 1024 * 20 });
          fs.rmSync(fdir, { recursive: true, force: true });
          izohOk = true;
        } catch (e) { console.error('izoh-umumiy xato:', e && e.message); }
      }
      if (!izohOk && sahnaNom && !fotoBuf && SAHNA_FOTO[sahnaNom] && env.CF_ACCOUNT_ID && env.CF_AI_TOKEN && env.GEMINI_API_KEY) {
        try {
          if (!izohKesh[sahnaNom]) {
            const rr = await rasmYarat(env, `Photorealistic professional architectural photograph, ${SAHNA_FOTO[sahnaNom].prompt}. Natural light, 35mm lens, realistic materials, square composition. No text, no letters, no people.`, null, true);
            if (!rr.buf) throw new Error('foto yo\'q');
            izohKesh[sahnaNom] = { buf: rr.buf, joy: await obyektJoyi(env, rr.buf, SAHNA_FOTO[sahnaNom].obj, geminiJsonSora) };
          }
          await matnQatlami(sl, ov, false);
          const fdir = path.join(tmpDir, `fr${i}`);
          const fps = await fotoIzohKadrlar({ nom: sahnaNom, fotoBuf: izohKesh[sahnaNom].buf, joy: izohKesh[sahnaNom].joy, dur, dir: fdir,
            t0: Number.isFinite(sl.t0) ? sl.t0 : 0, t1: Number.isFinite(sl.t1) ? sl.t1 : 1, aksent, ovBuf: fs.readFileSync(ov), SAHNA_BG: TEMA_BG });
          if (!qopqoqFoto) qopqoqFoto = izohKesh[sahnaNom].buf;
          if (i === 0) qopqoqAsos = await sharp(path.join(fdir, 'f0000.jpg')).jpeg({ quality: 90 }).toBuffer();
          await execFileAsync('ffmpeg', [
            '-y', '-framerate', String(fps), '-i', path.join(fdir, 'f%04d.jpg'), '-i', mp3,
            '-filter_complex', '[0:v]fps=25,format=yuv420p[v]',
            '-map', '[v]', '-map', '1:a', '-af', 'apad,aresample=44100', '-t', String(dur),
            '-c:v', 'libx264', '-preset', 'superfast', '-crf', '20', '-maxrate', '12M', '-bufsize', '24M', '-threads', '1', '-x264-params', 'threads=1:lookahead_threads=1:rc-lookahead=0:ref=1:bframes=0',
            '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '44100', seg,
          ], { maxBuffer: 1024 * 1024 * 20 });
          fs.rmSync(fdir, { recursive: true, force: true });
          izohOk = true;
        } catch (e) { console.error('izoh-foto xato:', e && e.message); izohKesh[sahnaNom] = null; }
      }
      if (izohOk) { /* tayyor */ } else if (sahnaNom && !fotoBuf) {
        await matnQatlami(sl, ov, false);
        const fdir = path.join(tmpDir, `fr${i}`);
        const fps = await sahnaKadrlar(sahnaNom, aksent, dur, fdir, Number.isFinite(sl.t0) ? sl.t0 : 0, Number.isFinite(sl.t1) ? sl.t1 : 1, ov);
        if (!qopqoqSahna) qopqoqSahna = [sahnaNom, aksent];
        if (i === 0) qopqoqAsos = await sharp(path.join(fdir, 'f0000.jpg')).jpeg({ quality: 90 }).toBuffer();
        await execFileAsync('ffmpeg', [
          '-y', '-framerate', String(fps), '-i', path.join(fdir, 'f%04d.jpg'), '-i', mp3,
          '-filter_complex', '[0:v]fps=25,format=yuv420p[v]',
          '-map', '[v]', '-map', '1:a', '-af', 'apad,aresample=44100', '-t', String(dur),
          '-c:v', 'libx264', '-preset', 'superfast', '-crf', '20', '-maxrate', '12M', '-bufsize', '24M', '-threads', '1', '-x264-params', 'threads=1:lookahead_threads=1:rc-lookahead=0:ref=1:bframes=0',
          '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '44100', seg,
        ], { maxBuffer: 1024 * 1024 * 20 });
        fs.rmSync(fdir, { recursive: true, force: true });
      } else {
        if (!fotoBuf) await animatsiyaAiRasm(env, sl, bg, ov);
        if (i === 0) qopqoqAsos = fs.readFileSync(bg);
        const ez = `(0.5-0.5*cos(PI*on/${kadr}))`; const z = i % 2 === 0 ? `1+0.07*${ez}` : `1.07-0.07*${ez}`;
        await execFileAsync('ffmpeg', [
          '-y', '-i', bg, '-loop', '1', '-framerate', '25', '-i', ov, '-i', mp3,
          '-filter_complex', `[0:v]scale=3240:5760:flags=lanczos,zoompan=z='${z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${kadr}:s=1080x1920:fps=25[b];[b][1:v]overlay=format=auto,format=yuv420p[v]`,
          '-map', '[v]', '-map', '2:a', '-af', 'apad,aresample=44100', '-t', String(dur),
          '-c:v', 'libx264', '-preset', 'superfast', '-crf', '20', '-maxrate', '12M', '-bufsize', '24M', '-threads', '1', '-x264-params', 'threads=1:lookahead_threads=1:rc-lookahead=5:ref=1:bframes=0',
          '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '44100', seg,
        ], { maxBuffer: 1024 * 1024 * 20 });
      }
      segFiles.push(seg);
      {
        const sz = String(sl.ovoz).split(/\s+/).filter(Boolean);
        const bol = [];
        for (let k = 0; k < sz.length; k += 2) bol.push(sz.slice(k, k + 2).join(' '));
        const jamiH = bol.reduce((q, x) => q + x.length, 0) || 1;
        let tt = t + 0.1;
        const mavjud = dur - 0.5;
        for (const x of bol) { const d = (x.length / jamiH) * mavjud; subtitr.push({ bosh: tt, tugash: tt + d, matn: x }); tt += d; }
      }
      t += dur;
    }
    try {
      const lg = logoYukla();
      const ecSvg = Buffer.from(`<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg"><rect width="1080" height="1920" fill="${TEMA_BG}"/>
        ${lg ? `<image href="data:image/png;base64,${lg}" x="500" y="800" width="80" height="70"/>` : ''}
        <text x="540" y="960" text-anchor="middle" font-family="Liberation Sans, Arial, sans-serif" font-size="40" font-weight="700" fill="${YOZ}" letter-spacing="10">VISART DESIGN</text>
        <rect x="490" y="995" width="100" height="4" rx="2" fill="${VURGU}"/>
        <text x="540" y="1060" text-anchor="middle" font-family="Liberation Sans, Arial, sans-serif" font-size="28" fill="${YOZ}" fill-opacity="0.75">Arxitektura · Interyer · Qurilish</text></svg>`);
      const ecPng = path.join(tmpDir, 'endcard.png');
      await sharp(ecSvg).png().toFile(ecPng);
      const ecSeg = path.join(tmpDir, 'endcard.mp4');
      await execFileAsync('ffmpeg', ['-y', '-loop', '1', '-framerate', '25', '-i', ecPng, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '2.5',
        '-vf', 'fade=t=in:d=0.4,format=yuv420p', '-c:v', 'libx264', '-preset', 'superfast', '-crf', '20', '-threads', '1', '-x264-params', 'threads=1:lookahead_threads=1:rc-lookahead=0:ref=1:bframes=0',
        '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '44100', ecSeg], { maxBuffer: 1024 * 1024 * 20 });
      segFiles.push(ecSeg);
    } catch (e) { console.error('endcard xato:', e && e.message); }
    const list = path.join(tmpDir, 'list.txt');
    fs.writeFileSync(list, segFiles.map((p) => `file '${p}'`).join('\n'));
    const birlashgan = path.join(tmpDir, 'birlashgan.mp4');
    await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', birlashgan]);

    // Fon muzika: ovoz 100%, muzika past
    const mixed = path.join(tmpDir, 'mixed.mp4');
    const haqiqiy = muzikaTanla('sokin');
    if (haqiqiy) {
      // Haqiqiy trek: ovoz ustida avtomatik pasayadi (ducking), kirishda yumshoq ko'tariladi, oxirida so'nadi
      await execFileAsync('ffmpeg', ['-y', '-i', birlashgan, '-stream_loop', '-1', '-i', haqiqiy,
        '-filter_complex', `[0:a]asplit=2[v1][v2];[1:a]volume=0.5,afade=t=in:d=1.5,afade=t=out:st=${Math.max(1, Math.floor(t) - 2)}:d=2[m];[m][v2]sidechaincompress=threshold=0.02:ratio=10:attack=20:release=500[d];[v1][d]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]`,
        '-map', '0:v', '-map', '[a]', '-t', String(Math.ceil(t) + 1), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', mixed]);
    } else {
      const muz = await muzikaSintez('sokin', Math.ceil(t) + 1, path.join(tmpDir, 'm.mp3'));
      await execFileAsync('ffmpeg', ['-y', '-i', birlashgan, '-i', muz,
        '-filter_complex', '[1:a]volume=0.16[m];[0:a][m]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]',
        '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', mixed]);
    }

    let chiqish = mixed;
    try {
      const sub = path.join(tmpDir, 'final.mp4');
      if (await srtVideogaKuydir(mixed, subtitr, sub, true)) chiqish = sub;
    } catch (e) { /* subtitrsiz ham yaroqli */ }

    const sarlavha = meta.post_sarlavha || slaydlar[0].sarlavha || 'Visart Design';
    let qopqoqBuf = null;
    try {
      if (qopqoqFoto) qopqoqBuf = await elchiOblojka({ sarlavha, vurgu: meta.vurgu || slaydlar[0].vurgu || '', fotoBuf: qopqoqFoto, yuzBuf, logoB64: logoYukla() }).catch((e) => { console.error('elchi oblojka:', e && e.message); return null; });
      if (!qopqoqBuf && (qopqoqSahna || qopqoqFoto)) qopqoqBuf = await mavzuOblojka(qopqoqSahna ? qopqoqSahna[0] : slaydlar[0].sahna, qopqoqSahna ? qopqoqSahna[1] : '#c4572b', sarlavha, meta.vurgu || slaydlar[0].vurgu || '', qopqoqFoto).catch(() => null);
      if (!qopqoqBuf) qopqoqBuf = await aiOblojka(env, { sarlavha, aksent: meta.vurgu || '', yuz: yuzBuf }).catch(() => null);
      if (!qopqoqBuf) qopqoqBuf = await qopqoqYarat({ rasmBuf: qopqoqAsos, rasmBuf2: null, aiFonBuf: null, kategoriya: 3, headline: sarlavha, accentSoz: meta.vurgu || '', raqam: '' });
    } catch (e) { qopqoqBuf = null; }
    if (qopqoqBuf) await tgSendPhoto(env.MIJOZ_BOT_TOKEN, adminChatId, qopqoqBuf, `🖼️ Qopqoq -- ${sarlavha}`);
    await tasdiqqaYubor(env, adminChatId, chiqish, qopqoqBuf, {
      sarlavha, tavsif: meta.tavsif, hashtaglar: meta.hashtaglar,
      izoh: `Animatsion (${Math.round(t)} s) -- AI mavzu va ovoz. Ovozni tinglab, xato bo'lsa ❌ bosing va sababini yozing.`, taklifId: null });
    await ishYop('bajarildi');
  } catch (e) {
    await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId, `⚠️ Animatsion video yaratilmadi: ${String((e && e.message) || e).slice(0, 300)}`).catch(() => {});
    await ishYop('xato');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function bajarYuzStudio({ env, adminChatId }) {
  try {
    await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId, "✨ Chiroyli AI portretlar tayyorlanmoqda (1-2 daqiqa)...");
    const n = await yuzStudio(env, (buf, cap, kb) => tgSendPhoto(env.MIJOZ_BOT_TOKEN, adminChatId, buf, cap, kb));
    await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId, n ? `✅ ${n} ta portret saqlandi. Oblojka va videolarda shular ishlatiladi (xom rasmlar emas).` : "⚠️ Portret yaratilmadi (Gemini rasm modeli javob bermadi). Keyinroq /yuzstudio ni qayta yuboring.");
  } catch (e) {
    await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId, `⚠️ ${String((e && e.message) || e).slice(0, 300)}`).catch(() => {});
  }
}
