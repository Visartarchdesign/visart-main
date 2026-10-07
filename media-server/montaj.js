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
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import { nodewhisper } from 'nodejs-whisper';
import { qopqoqYarat } from './qopqoqlar.js';

const execFileAsync = promisify(execFile);
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

async function tgSendPhoto(token, chatId, buf, caption) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) form.append('caption', caption.slice(0, 1024));
  form.append('photo', new Blob([buf], { type: 'image/png' }), 'cover.png');
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
  }).catch(() => {});
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
async function youtubeUpload(env, videoPath, title, description) {
  if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET || !env.YOUTUBE_REFRESH_TOKEN) return null;
  try {
    const accessToken = await youtubeAccessToken(env);
    if (!accessToken) return null;

    const stat = fs.statSync(videoPath);
    const nashrVaqti = keyingiYoutubeVaqt();
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
    return data.id ? { url: `https://youtube.com/shorts/${data.id}`, nashrVaqti } : null;
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
      '-vf', "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
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
function muzikaTanla(kayfiyat) {
  try {
    const papka = path.join(path.dirname(new URL(import.meta.url).pathname), 'music', kayfiyat || 'sokin');
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
async function ffmpegMuzikaQosh(videoPath, musicPath, outPath) {
  const audioBor = await ffmpegAudioBormi(videoPath);
  const filterComplex = audioBor
    // [0:a] -- video asl ovozi 22% darajada (butunlay o'chirilmaydi -- ambient
    // xona tovushi tabiiyroq eshitiladi); [1:a] -- muzika 55% darajada, 1.5s
    // fade-in bilan boshlanadi (keskin kirmasligi uchun).
    ? '[0:a]volume=0.22[a0];[1:a]volume=0.55,afade=t=in:st=0:d=1.5[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[aout]'
    : '[1:a]volume=0.55,afade=t=in:st=0:d=1.5[aout]';
  await execFileAsync('ffmpeg', [
    '-y', '-i', videoPath, '-stream_loop', '-1', '-i', musicPath,
    '-filter_complex', filterComplex,
    '-map', '0:v:0', '-map', '[aout]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
    '-shortest', '-movflags', '+faststart',
    outPath,
  ], { maxBuffer: 1024 * 1024 * 20 });
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
async function srtVideogaKuydir(videoPath, segmentlar, outPath) {
  if (!segmentlar || !segmentlar.length) return false;
  const { width, height } = await ffmpegOlchamOl(videoPath);
  const fontSize = Math.round(width * 0.052);
  const marginV = Math.round(height * 0.11);
  const marginLR = Math.round(width * 0.055);
  const assQatorlar = segmentlar.map((s) =>
    `Dialogue: 0,${soniyaAssVaqtga(s.bosh)},${soniyaAssVaqtga(s.tugash)},Default,,0,0,0,,${assEscape(s.matn)}`
  ).join('\n');
  const assMatn =
    `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nScaledBorderAndShadow: yes\n\n` +
    `[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n` +
    `Style: Default,Arial,${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,4,2,2,${marginLR},${marginLR},${marginV},1\n\n` +
    `[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${assQatorlar}\n`;
  const assPath = outPath.replace(/\.mp4$/, '.ass');
  fs.writeFileSync(assPath, assMatn, 'utf8');
  try {
    await execFileAsync('ffmpeg', [
      '-y', '-i', videoPath,
      '-vf', `ass=${assPath}`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
      '-threads', '1', '-x264-params', 'threads=1:lookahead_threads=1',
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
async function supabaseVideoUpload(env, videoPath) {
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

async function supabaseRasmUpload(env, buf) {
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
async function instagramStoryPost(env, videoUrl) {
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_BUSINESS_ACCOUNT_ID) return null;
  const igId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const token = env.INSTAGRAM_ACCESS_TOKEN;
  const container = await igFetch(`${igId}/media`, {
    media_type: 'STORIES',
    video_url: videoUrl,
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
async function navbatgaQoshStory(env, videoUrl) {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/nashr_navbati`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        turi: 'instagram_story',
        payload: { video_url: videoUrl },
        nashr_vaqti: keyingiStoryVaqt().toISOString(),
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    // navbatga qo'yishda xato bo'lsa ham, asosiy oqimni to'xtatmaydi
  }
}

async function bajarMontajBirUrinish({ env, aslFileId, adminChatId, title, taklifId, korsatma, bosqich }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'montaj-'));
  const inputPath = path.join(tmpDir, 'input.mp4');
  const outputPath = path.join(tmpDir, 'output.mp4');
  try {
    await bosqich('video yuklab olinmoqda...');
    const filePath = await tgGetFilePath(env.MIJOZ_BOT_TOKEN, aslFileId);
    await tgDownloadToFile(env.MIJOZ_BOT_TOKEN, filePath, inputPath);

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
        const musicPath = muzikaTanla(qaror.muzika_kayfiyat);
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
          const segmentlar = await whisperSubtitrYarat(outputPath, tmpDir);
          if (segmentlar) {
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

      qopqoqBuf = await qopqoqYarat({
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
    await tgSendVideo(env.MIJOZ_BOT_TOKEN, adminChatId,
      outputPath, `🎬 Montaj tayyor -- ${sarlavha}\n\n${qaror.izoh || ''}${taklifId ? `\n\n🆔${taklifId}` : ''}`);

    // Instagram Reels + Story -- sozlanmagan bo'lsa (INSTAGRAM_ACCESS_TOKEN/
    // INSTAGRAM_BUSINESS_ACCOUNT_ID yo'q) jim o'tkaziladi. Qo'shimcha
    // tasdiq SO'RALMAYDI -- admin buni allaqachon Senarist taklifini
    // tasdiqlaganda (bitta "✅ Tasdiqlash" bosilganda) ruxsat bergan, xuddi
    // foto-postlar (instagramPost, mijoz-bot.js) qanday avtomatik chiqsa.
    // ESLATMA (O'zbekiston auditoriyasi tadqiqotiga asosan): darhol bitta
    // Story (Reel bilan bir daqiqada -- "post'ni Story'ga ulash") chiqadi,
    // SO'NG kun davomidagi ikkinchi touchpoint ("savol-javob" bosqichi, 21:30
    // yoki ertangi 08:15) `nashr_navbati` navbatiga qo'yiladi -- worker
    // (functions/api/nashr-navbati.js) o'z vaqtida chiqaradi. Ertalabki/
    // tushlikdagi qo'shimcha bosqichlar (alohida kontent -- poll, teaser
    // matni talab qiladi) hali qo'lda qo'shiladi.
    if (env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_BUSINESS_ACCOUNT_ID && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await bosqich('Instagram Reels/Story uchun yuklanmoqda...');
        const videoUrl = await supabaseVideoUpload(env, outputPath);
        const igCaption = `${sarlavha}\n\n${qaror.tavsif || ''}\n\nShuni ustangizga yoki arxitektoringizga yuboring 👇\n\n#VisartDesign ${qaror.hashtaglar || '#arxitektura #interyerdizayn #ToshkentDizayn #qurilish'}`;
        let coverUrl = null;
        if (qopqoqBuf) {
          try { coverUrl = await supabaseRasmUpload(env, qopqoqBuf); } catch (e) {
            await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId, `⚠️ Reels qopqog'i yuklanmadi: ${String((e && e.message) || e).slice(0, 200)}`).catch(() => {});
          }
        }
        await instagramReelsPost(env, videoUrl, igCaption, coverUrl);
        await instagramStoryPost(env, videoUrl);
        await navbatgaQoshStory(env, videoUrl);
        await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId, '📸 Instagram Reels va Story\'ga avtomatik joylandi (2-Story bosqichi rejalashtirildi).');
      } catch (e) {
        await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId,
          `⚠️ Instagram Reels/Story joylashda xato: ${String((e && e.message) || e)}`);
      }
    }

    // YouTube Shorts -- sozlanmagan yoki xato bo'lsa jim o'tkaziladi.
    try {
      if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET || !env.YOUTUBE_REFRESH_TOKEN) {
        await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId, "ℹ️ YouTube sozlanmagan (YOUTUBE_* env yo'q) -- o'tkazib yuborildi");
        return true;
      }
      await bosqich('YouTube Shorts yuklanmoqda...');
      const ytNatija = await youtubeUpload(env, outputPath, sarlavha, qaror.tavsif || '');
      if (ytNatija && ytNatija.url) {
        const vaqtToshkent = new Date(ytNatija.nashrVaqti.getTime() + 5 * 60 * 60 * 1000);
        const vaqtMatni = `${String(vaqtToshkent.getUTCDate()).padStart(2, '0')}.${String(vaqtToshkent.getUTCMonth() + 1).padStart(2, '0')} ${String(vaqtToshkent.getUTCHours()).padStart(2, '0')}:${String(vaqtToshkent.getUTCMinutes()).padStart(2, '0')}`;
        await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId,
          `📺 YouTube Shorts yuklandi, nashr vaqti rejalashtirildi: ${vaqtMatni} (Toshkent)\n${ytNatija.url}`);
      } else if (ytNatija && ytNatija.xato) {
        await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId, `⚠️ YouTube yuklashda xato: ${ytNatija.xato}`);
      }
    } catch (e) {
      await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId, `⚠️ YouTube yuklashda xato: ${String((e && e.message) || e)}`);
    }

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
export async function bajarMontaj({ env, aslFileId, adminChatId, title, taklifId, korsatma }) {
  const MAX_URINISH = 3;
  let oxirgiXato;
  for (let urinish = 1; urinish <= MAX_URINISH; urinish++) {
    const bosqich = async (matn) => {
      await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId,
        `⏳ ${matn}${urinish > 1 ? ` (${urinish}-urinish)` : ''}`);
    };
    try {
      const tugadi = await bajarMontajBirUrinish({ env, aslFileId, adminChatId, title, taklifId, korsatma, bosqich });
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
