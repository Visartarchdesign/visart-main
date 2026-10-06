// Montajchi agenti -- Gemini (video ko'rib kesish qarorini beradi) + FFmpeg
// (qarorga asosan kesib, Instagram uchun qayta kodlaydi).
//
// 1-bosqich (hozirgi): faqat kesish (subtitr yo'q). Whisper orqali subtitr
// keyingi bosqichda qo'shiladi.
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
    (qoshimchaKorsatma ? `\n5) ADMIN'NING MAXSUS KO'RSATMASI (bunga albatta amal qiling, boshqa qoidalardan ustun): "${qoshimchaKorsatma}"\n` : '') +
    "\nJAVOBNI FAQAT quyidagi JSON formatda qaytaring (boshqa hech narsa yozmang):\n" +
    '{"munosib": true, "segmentlar": [{"start": 0.0, "end": 12.5}, {"start": 15.0, "end": 40.0}], "izoh": "<qisqa, nega aynan shu kadrlar qoldirildi va nima olib tashlandi>"}\n' +
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

// Tayyor videodan eng jozibali o'rtaroq kadrni JPEG rasm sifatida ajratib
// oladi (video uzunligining ~35% nuqtasidan) -- thumbnail asosi sifatida.
async function ffmpegKadrOl(videoPath, outPath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath,
  ]);
  const davomiylik = parseFloat(stdout) || 3;
  const vaqt = Math.max(0.2, davomiylik * 0.35);
  await execFileAsync('ffmpeg', [
    '-y', '-ss', String(vaqt), '-i', videoPath, '-vframes', '1', '-q:v', '2', outPath,
  ]);
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

// Video kadri + AI fon + sarlavha'ni birlashtirib, premium darajadagi
// qopqoq (cover/thumbnail) PNG yasaydi. AI fon bo'lmasa (null), oddiy
// qorong'i gradient fonga tushadi -- har doim ishlashi kafolatlanadi.
async function yasaPremiumQopqoq(frameBuf, aiFonBuf, title) {
  const KENG = 1080;
  const BALAND = 1920;

  const fonLayer = aiFonBuf
    ? await sharp(aiFonBuf).resize(KENG, BALAND, { fit: 'cover' }).png().toBuffer()
    : await sharp({
        create: { width: KENG, height: BALAND, channels: 4, background: { r: 21, g: 19, b: 15, alpha: 1 } },
      }).png().toBuffer();

  // Haqiqiy video kadrini markaziy "karta" sifatida joylaymiz (soyali, burchaklari yumaloq)
  const kartaKeng = 880;
  const kartaBaland = 1100;
  const kartaX = Math.round((KENG - kartaKeng) / 2);
  const kartaY = 420;
  const kartaMask = Buffer.from(
    `<svg width="${kartaKeng}" height="${kartaBaland}"><rect x="0" y="0" width="${kartaKeng}" height="${kartaBaland}" rx="28" fill="#fff"/></svg>`
  );
  const frameRounded = await sharp(frameBuf)
    .resize(kartaKeng, kartaBaland, { fit: 'cover' })
    .composite([{ input: kartaMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const titleSafe = String(title || 'Visart Design').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  const overlaySvg = Buffer.from(`
    <svg width="${KENG}" height="${BALAND}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000" stop-opacity="0.55"/>
          <stop offset="18%" stop-color="#000" stop-opacity="0"/>
          <stop offset="78%" stop-color="#000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0.9"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${KENG}" height="${BALAND}" fill="url(#g)"/>
      <text x="60" y="110" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff" letter-spacing="4">VISART DESIGN</text>
      <text x="60" y="${BALAND - 140}" font-family="Arial, sans-serif" font-size="56" font-weight="800" fill="#ffffff">${titleSafe}</text>
      <rect x="60" y="${BALAND - 90}" width="140" height="6" fill="#c9a876"/>
    </svg>
  `);

  return sharp(fonLayer)
    .composite([
      { input: frameRounded, left: kartaX, top: kartaY },
      { input: overlaySvg, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
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
// UTC+5): kunlik oynalar 12:30 va 18:30 -- tadqiqotga ko'ra Shorts uchun eng
// kuchli vaqt tushlik va kechki "passiv scroll" payti (SocialPilot, 301k+
// video tahlili). 03:00-07:00 va yakshanba kechqurun (18:30 oynasi)
// qoldirilади -- bular eng zaif vaqt hisoblanadi. Aniq soatdan ko'ra muntazam
// chiqish muhimroq bo'lgani uchun har kuni ikkita oyna beriladi (faqat
// Juma/Shanba/Payshankaga cheklanmaydi).
function keyingiYoutubeVaqt() {
  const TOSHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
  const hozirToshkent = new Date(Date.now() + TOSHKENT_OFFSET_MS);
  const kun = hozirToshkent.getUTCDay(); // 0=Yak
  const soat = hozirToshkent.getUTCHours();
  const minut = hozirToshkent.getUTCMinutes();
  const hozirDaqiqa = soat * 60 + minut;

  const oynaErta = 12 * 60 + 30;
  const oynaKech = 18 * 60 + 30;

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
  if (kun === 0 && hozirDaqiqa < oynaErta) {
    // Yakshanba, hali tushlik oynasidan oldin -- yakshanba kechqurun zaif, shuning uchun tushlik oynasi ishlatiladi
    tanlanganSana = sanaOlish(0);
    tanlanganDaqiqa = oynaErta;
  } else if (kun === 0) {
    // Yakshanba, tushlikdan keyin -- yakshanba kechqurunni tashlab, dushanba tushlikka o'tkaziladi
    tanlanganSana = sanaOlish(1);
    tanlanganDaqiqa = oynaErta;
  } else if (hozirDaqiqa < oynaErta) {
    tanlanganSana = sanaOlish(0);
    tanlanganDaqiqa = oynaErta;
  } else if (hozirDaqiqa < oynaKech) {
    tanlanganSana = sanaOlish(0);
    tanlanganDaqiqa = oynaKech;
  } else {
    // Bugungi oynalar tugagan -- ertangi birinchi oynaga o'tadi (ertaga yakshanba
    // bo'lsa ham tushlik oynasi muammosiz, faqat yakshanba KECHASI qoldiriladi)
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
      signal: AbortSignal.timeout(120000),
    });
    if (!uploadRes.ok) {
      const txt = await uploadRes.text().catch(() => '');
      throw new Error(`YouTube video yuklashda xato: ${uploadRes.status} ${txt.slice(0, 200)}`);
    }
    const data = await uploadRes.json();
    return data.id ? { url: `https://youtube.com/shorts/${data.id}`, nashrVaqti } : null;
  } catch (e) {
    return null;
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

    await bosqich(`FFmpeg kesmoqda va birlashtirmoqda (${qaror.segmentlar.length} segment)...`);
    await ffmpegKesibBirlashtir(inputPath, qaror.segmentlar, outputPath, tmpDir);

    // Premium qopqoq (cover/thumbnail) -- video kadri + AI fon. Xato bersa ham
    // (Gemini kvota/billing yo'q), oddiy video yuborishga tushadi, hech narsa
    // to'xtamaydi.
    let qopqoqBuf = null;
    try {
      await bosqich('Premium qopqoq (AI fon) tayyorlanmoqda...');
      const framePath = path.join(tmpDir, 'frame.jpg');
      await ffmpegKadrOl(outputPath, framePath);
      const frameBuf = fs.readFileSync(framePath);
      const aiFonBuf = await geminiPremiumFon(title);
      qopqoqBuf = await yasaPremiumQopqoq(frameBuf, aiFonBuf, title);
    } catch (e) {
      qopqoqBuf = null; // qopqoq ixtiyoriy -- asosiy video yuborishni to'xtatmaydi
    }

    if (qopqoqBuf) {
      await tgSendPhoto(env.MIJOZ_BOT_TOKEN, adminChatId,
        qopqoqBuf, `🖼️ Premium qopqoq${title ? ` -- ${title}` : ''}`);
    }

    await bosqich('Telegramga yuklanmoqda...');
    await tgSendVideo(env.MIJOZ_BOT_TOKEN, adminChatId,
      outputPath, `🎬 Montaj tayyor${title ? ` -- ${title}` : ''}\n\n${qaror.izoh || ''}${taklifId ? `\n\n🆔${taklifId}` : ''}`);

    // YouTube Shorts -- sozlanmagan yoki xato bo'lsa jim o'tkaziladi.
    try {
      await bosqich('YouTube Shorts yuklanmoqda...');
      const ytNatija = await youtubeUpload(env, outputPath, title, qaror.izoh);
      if (ytNatija) {
        const vaqtToshkent = new Date(ytNatija.nashrVaqti.getTime() + 5 * 60 * 60 * 1000);
        const vaqtMatni = `${String(vaqtToshkent.getUTCDate()).padStart(2, '0')}.${String(vaqtToshkent.getUTCMonth() + 1).padStart(2, '0')} ${String(vaqtToshkent.getUTCHours()).padStart(2, '0')}:${String(vaqtToshkent.getUTCMinutes()).padStart(2, '0')}`;
        await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId,
          `📺 YouTube Shorts yuklandi, nashr vaqti rejalashtirildi: ${vaqtMatni} (Toshkent)\n${ytNatija.url}`);
      }
    } catch (e) { /* jim e'tiborsiz */ }

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
