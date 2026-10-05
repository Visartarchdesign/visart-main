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

async function tgSendMessage(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
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
    "Siz professional video montajchisiz. Ushbu xom videoni Instagram Reels uchun tahlil qiling.\n" +
    "Gapirishdagi uzoq pauza/duduqlanish, keraksiz boshlanish, kamera qattiq silkingan yoki fokusdan chiqqan (xira) joylarni aniqlang -- ular KESIB TASHLANISHI kerak.\n" +
    "Qolgan (SAQLANADIGAN) segmentlarni soniya aniqligida, xronologik tartibda ro'yxat qiling. Kamida 1 ta segment bo'lishi SHART.\n" +
    "JAVOBNI FAQAT quyidagi JSON formatda qaytaring (boshqa hech narsa yozmang):\n" +
    '{"segmentlar": [{"start": 0.0, "end": 12.5}, {"start": 15.0, "end": 40.0}], "izoh": "<qisqa izoh, nima olib tashlandi>"}';

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
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Gemini generateContent xato: ${res.status} ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = (data.candidates && data.candidates[0] && data.candidates[0].content &&
    data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
    data.candidates[0].content.parts[0].text) || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Gemini javobi JSON emas: ' + text.slice(0, 200));
  return JSON.parse(match[0]);
}

async function ffmpegKesibBirlashtir(inputPath, segmentlar, outputPath) {
  const parts = [];
  segmentlar.forEach((seg, i) => {
    parts.push(`[0:v]trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS[v${i}]`);
    parts.push(`[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS[a${i}]`);
  });
  const concatInputs = segmentlar.map((_, i) => `[v${i}][a${i}]`).join('');
  parts.push(`${concatInputs}concat=n=${segmentlar.length}:v=1:a=1[outv][outa]`);
  const filterComplex = parts.join(';');

  await execFileAsync('ffmpeg', [
    '-y', '-i', inputPath,
    '-filter_complex', filterComplex,
    '-map', '[outv]', '-map', '[outa]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    outputPath,
  ], { maxBuffer: 1024 * 1024 * 20 });
}

export async function bajarMontaj({ env, aslFileId, adminChatId, title }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'montaj-'));
  const inputPath = path.join(tmpDir, 'input.mp4');
  const outputPath = path.join(tmpDir, 'output.mp4');
  try {
    const filePath = await tgGetFilePath(env.MIJOZ_BOT_TOKEN, aslFileId);
    await tgDownloadToFile(env.MIJOZ_BOT_TOKEN, filePath, inputPath);

    const mimeType = 'video/mp4';
    const uploaded = await geminiFileUpload(env.GEMINI_API_KEY, inputPath, mimeType);
    const active = await geminiFileWaitActive(env.GEMINI_API_KEY, uploaded.name);
    const qaror = await geminiKesishQarori(env.GEMINI_API_KEY, active.uri, mimeType);

    if (!qaror.segmentlar || !qaror.segmentlar.length) {
      throw new Error('Gemini kesish uchun segment bermadi');
    }

    await ffmpegKesibBirlashtir(inputPath, qaror.segmentlar, outputPath);
    await tgSendVideo(env.MIJOZ_BOT_TOKEN, adminChatId,
      outputPath, `🎬 Montaj tayyor${title ? ` -- ${title}` : ''}\n\n${qaror.izoh || ''}`);
  } catch (e) {
    await tgSendMessage(env.MIJOZ_BOT_TOKEN, adminChatId,
      `⚠️ Montajchi xato berdi: ${String((e && e.message) || e)}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
