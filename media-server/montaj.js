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

const execFileAsync = promisify(execFile);
const GEMINI_MODEL = 'gemini-3.8-flash';

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

async function geminiKesishQarori(apiKey, fileUri, mimeType) {
  const prompt =
    "Siz Instagram'da million qarashlar oluvchi, PREMIUM darajadagi arxitektura/interyer studiyasi uchun ishlaydigan professional video montajchisiz (Visart Design). " +
    "Standartingiz PASAYTIRILMAYDI -- oddiy, zerikarli, 'xomaki' ko'rinadigan video chiqarish MUTLAQO taqiqlanadi.\n\n" +
    "Ushbu xom videoni qattiq, talabchan nazar bilan tahlil qiling:\n" +
    "1) KESIB TASHLANADI: uzoq pauza/duduqlanish, keraksiz/sust boshlanish, kamera qattiq silkingan yoki fokusdan chiqqan (xira) joylar, takrorlanuvchi/zerikarli kadrlar, hech narsa 'bo'lmayotgan' bo'sh vaqt.\n" +
    "2) SAQLANADIGAN segmentlar FAQAT: vizual jihatdan kuchli, aniq fokusli, yaxshi yorug'lik/kadrlashga ega, dinamik (harakat/burchak o'zgarishi bor) bo'laklar. Reels pacing -- qisqa, tez, zarur bo'lmagan hech bir soniya qoldirilmasin.\n" +
    "3) Birinchi saqlanadigan segment KUCHLI 'hook' bo'lishi kerak (eng jozibali kadrdan boshlansin) -- tomoshabinni birinchi 2-3 soniyada ushlab qolish shart.\n" +
    "4) AGAR butun xom material past sifatli bo'lsa (doim xira/silkingan, yorug'lik yomon, hech qanday jozibali/premium kadr yo'q, yoki foydali uzunlik 3 soniyadan kam qoladi) -- buni tan oling va \"munosib\": false qaytaring. Chalasifat video chiqarishdan ko'ra, UMUMAN chiqarmaslik afzal.\n\n" +
    "JAVOBNI FAQAT quyidagi JSON formatda qaytaring (boshqa hech narsa yozmang):\n" +
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

async function bajarMontajBirUrinish({ env, aslFileId, adminChatId, title, bosqich }) {
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
    const qaror = await geminiKesishQarori(env.GEMINI_API_KEY, active.uri, mimeType);

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

    await bosqich('Telegramga yuklanmoqda...');
    await tgSendVideo(env.MIJOZ_BOT_TOKEN, adminChatId,
      outputPath, `🎬 Montaj tayyor${title ? ` -- ${title}` : ''}\n\n${qaror.izoh || ''}`);
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
export async function bajarMontaj({ env, aslFileId, adminChatId, title, taklifId }) {
  const MAX_URINISH = 3;
  let oxirgiXato;
  for (let urinish = 1; urinish <= MAX_URINISH; urinish++) {
    const bosqich = async (matn) => {
      await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId,
        `⏳ ${matn}${urinish > 1 ? ` (${urinish}-urinish)` : ''}`);
    };
    try {
      const tugadi = await bajarMontajBirUrinish({ env, aslFileId, adminChatId, title, bosqich });
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
