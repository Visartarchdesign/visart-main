// Montajchi agenti -- Gemini (video ko'rib kesish qarorini beradi) + FFmpeg
// (qarorga asosan kesib, Instagram uchun qayta kodlaydi).
//
// 1-bosqich (hozirgi): faqat kesish (subtitr yo'q). Whisper orqali subtitr
// keyingi bosqichda qo'shiladi.
//
// Cheklov: Telegram oddiy Bot API orqali faqat 20MB gacha fayl yuklab olish
// mumkin (getFile). Shundan katta xom video kelsa, xato qaytariladi.

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const GEMINI_MODEL = 'gemini-3.8-flash';
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

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
  for (let urinish = 1; urinish <= 3; urinish++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
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
    oxirgiXato = new Error(`Gemini generateContent xato: ${res.status} ${txt.slice(0, 300)}`);
    // 503 (band) yoki 429 (limit) -- vaqtinchalik, biroz kutib qayta urinamiz
    if ((res.status === 503 || res.status === 429) && urinish < 3) {
      await new Promise((r) => setTimeout(r, urinish * 5000));
      continue;
    }
    throw oxirgiXato;
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

// Gemini'ning rasm-generatsiya modeli orqali, video mavzusiga oid, MAVHUM/
// konseptual premium fon rasm yasaydi (haqiqiy xona emas -- faqat dekorativ
// fon, Visart brend rangida). Gemini billing/kvota bo'lmasa yoki xato bersa,
// null qaytaradi -- chaqiruvchi tomon oddiy (AI'siz) qopqoqqa tushadi.
async function geminiPremiumFon(apiKey, mavzu) {
  try {
    const prompt =
      `Premium, abstract architectural/interior-design concept background image related to: "${mavzu || 'zamonaviy interyer dizayni'}". ` +
      "Dark elegant backdrop (deep charcoal/black) with warm gold geometric accents, soft bokeh light, minimal luxury magazine-cover aesthetic. " +
      "NO real room, NO people, NO text, NO logos -- purely abstract decorative background. Vertical 9:16 composition.";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(30000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    const imgPart = parts.find((p) => p.inlineData || p.inline_data);
    const inline = imgPart && (imgPart.inlineData || imgPart.inline_data);
    if (!inline || !inline.data) return null;
    return Buffer.from(inline.data, 'base64');
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
      const aiFonBuf = env.GEMINI_API_KEY ? await geminiPremiumFon(env.GEMINI_API_KEY, title) : null;
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
