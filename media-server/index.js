// Visart Media Server -- Render.com'da ishlaydigan alohida xizmat.
// Cloudflare Pages Functions'da ishlay olmaydigan og'ir vazifalar shu yerda:
// 1) Oblojka -- real fotosurat ustiga brend shablon qo'yib PNG chiqaradi
// 2) Montajchi -- (keyingi bosqich) FFmpeg + Whisper orqali video montaj
//
// Kerakli Render Environment Variable:
//   MEDIA_SECRET -- o'zingiz o'ylab topgan tasodifiy satr (bizning
//                   Cloudflare bot shu secret bilan so'rov yuboradi)

import express from 'express';
import { yasaOblojka } from './oblojka.js';
import { bajarMontaj } from './montaj.js';

const app = express();
app.use(express.json({ limit: '20mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

function tekshirSecret(req, res) {
  const secret = req.headers['x-media-secret'];
  if (!process.env.MEDIA_SECRET || secret !== process.env.MEDIA_SECRET) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

// POST /oblojka
// body: { shablon: 1|2|3|"karusel", photoBase64, title, kategoriya? }
// "karusel" uchun title shart emas (katta matn chizilmaydi).
app.post('/oblojka', async (req, res) => {
  if (!tekshirSecret(req, res)) return;
  try {
    const { shablon, photoBase64, title, kategoriya } = req.body || {};
    if (!photoBase64 || (!title && shablon !== 'karusel')) {
      return res.status(400).json({ ok: false, error: "photoBase64 va title kerak" });
    }
    const shablonQiymati = shablon === 'karusel' ? 'karusel' : (Number(shablon) || 1);
    const png = await yasaOblojka({ shablon: shablonQiymati, photoBase64, title, kategoriya });
    res.set('Content-Type', 'image/png');
    res.send(png);
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

// POST /montaj
// body: { aslFileId, adminChatId, title? }
// Darhol 202 qaytaradi, og'ir ish (Gemini + FFmpeg) fonda davom etadi --
// tugagach natija (yoki xato) to'g'ridan-to'g'ri Telegram orqali adminChatId'ga yuboriladi.
app.post('/montaj', (req, res) => {
  if (!tekshirSecret(req, res)) return;
  const { aslFileId, adminChatId, title } = req.body || {};
  if (!aslFileId || !adminChatId) {
    return res.status(400).json({ ok: false, error: 'aslFileId va adminChatId kerak' });
  }
  if (!process.env.MIJOZ_BOT_TOKEN || !process.env.GEMINI_API_KEY) {
    return res.status(500).json({ ok: false, error: 'MIJOZ_BOT_TOKEN yoki GEMINI_API_KEY sozlanmagan' });
  }
  res.json({ ok: true, holat: 'boshlandi' });
  bajarMontaj({ env: process.env, aslFileId, adminChatId, title }).catch(() => {});
});

// VAQTINCHALIK: brauzerdan to'g'ridan-to'g'ri sinash uchun (qo'lda test).
// GET /montaj-test?secret=...&fileId=...&chatId=...
app.get('/montaj-test', (req, res) => {
  const { secret, fileId, chatId, title } = req.query;
  if (!process.env.MEDIA_SECRET || secret !== process.env.MEDIA_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  if (!fileId || !chatId) {
    return res.status(400).json({ ok: false, error: 'fileId va chatId kerak' });
  }
  res.json({ ok: true, holat: 'boshlandi' });
  bajarMontaj({ env: process.env, aslFileId: fileId, adminChatId: chatId, title: title || null }).catch(() => {});
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Visart media-server ${port}-portda ishga tushdi`));
