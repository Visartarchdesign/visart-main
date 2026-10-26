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
import { bajarReelSenariy, bajarReelYarat } from './reelBot.js';
import { bajarMontaj, bajarNashr, bajarIgTg, bajarStoryVariant, bajarAnimatsion, bajarYuzStudio } from './montaj.js';

const app = express();
app.use(express.json({ limit: '20mb' }));

// Render'da SUPABASE_*/MIJOZ_BOT_TOKEN/GEMINI_API_KEY sozlanmagan bo'lsa ham ishlashi uchun, Cloudflare bot
// ularni (MEDIA_SECRET bilan himoyalangan HTTPS so'rovda) uzatadi. Cloudflare qiymatlari ustun (Render'dagi eski/almashtirilgan token 401 bermasligi uchun).
import { keshYoz, xomKuzatuvchi } from './xomKuzatuvchi.js';
import { tgYukla } from './tgBuyuk.js';
import { fotoIshchi } from './fotoIshchi.js';
import { loyihaTaklif } from './loyihaTopuvchi.js';
function mergeEnv(req) {
  const x = (req.body && req.body._env) || {};
  const out = { ...process.env };
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MIJOZ_BOT_TOKEN', 'GEMINI_API_KEY', 'INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ACCOUNT_ID', 'FACEBOOK_PAGE_ID', 'TELEGRAM_CHANNEL_ID']) if (x[k]) out[k] = x[k];
  keshYoz(out, req.body && req.body.adminChatId);
  return out;
}

app.get('/health', (req, res) => res.json({ ok: true }));

let oxirgiAdmin = null;
async function xatoYubor(env, chatId, nom, e) {
  const m = `⚠️ ${nom} xato: ${String((e && e.message) || e).slice(0, 500)}`;
  console.error(m);
  const tok = (env && env.MIJOZ_BOT_TOKEN) || process.env.MIJOZ_BOT_TOKEN;
  if (!tok || !chatId) return;
  await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: m }) }).catch(() => {});
}
process.on('uncaughtException', (e) => { xatoYubor(null, oxirgiAdmin, 'Media-server (crash)', e); });
process.on('unhandledRejection', (e) => { xatoYubor(null, oxirgiAdmin, 'Media-server (rejection)', e); });
function ish(nom, req, fn) {
  const env = mergeEnv(req);
  const chatId = (req.body && (req.body.adminChatId || req.body.chatId)) || null;
  if (chatId) oxirgiAdmin = chatId;
  const kerak = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MIJOZ_BOT_TOKEN', 'GEMINI_API_KEY'].filter((k) => !env[k]);
  if (kerak.length) return xatoYubor(env, chatId, nom, new Error('env yetishmaydi: ' + kerak.join(', ')));
  const t = setTimeout(() => xatoYubor(env, chatId, nom, new Error("16 daqiqadan beri tugamadi (osilib qolgan bo'lishi mumkin)")), 960000);
  Promise.resolve().then(() => fn(env)).catch((e) => xatoYubor(env, chatId, nom, e)).finally(() => clearTimeout(t));
}

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
  const { aslFileId, adminChatId, title, taklifId, korsatma } = req.body || {};
  if (!aslFileId || !adminChatId) {
    return res.status(400).json({ ok: false, error: 'aslFileId va adminChatId kerak' });
  }
  if (!mergeEnv(req).MIJOZ_BOT_TOKEN || !mergeEnv(req).GEMINI_API_KEY) {
    return res.status(500).json({ ok: false, error: 'MIJOZ_BOT_TOKEN yoki GEMINI_API_KEY sozlanmagan' });
  }
  res.json({ ok: true, holat: 'boshlandi' });
  ish('Montaj', req, (env) => bajarMontaj({ env, aslFileId, adminChatId, title, taklifId, korsatma }));
});

// POST /loyiha-taklif -- kompyuterdan saytga joylanmagan loyiha topib, adminga taklif qiladi
app.post('/loyiha-taklif', (req, res) => {
  if (!tekshirSecret(req, res)) return;
  res.json({ ok: true, holat: 'boshlandi' });
  ish('LoyihaTaklif', req, (env) => loyihaTaklif({ env, adminChatId: req.body && req.body.adminChatId }));
});

// POST /tg-yukla -- Telegram'dagi katta (>20 MB) videoni MTProto bilan xom_video papkasiga yuklaydi
app.post('/tg-yukla', (req, res) => {
  if (!tekshirSecret(req, res)) return;
  const { chatId, messageId, adminChatId, korsatma } = req.body || {};
  if (!chatId || !messageId || !adminChatId) return res.status(400).json({ ok: false, error: 'chatId, messageId, adminChatId kerak' });
  res.json({ ok: true, holat: 'boshlandi' });
  ish('TgYukla', req, (env) => tgYukla({ env, chatId, messageId, adminChatId, korsatma }));
});

// POST /nashr-ig-tg -- jadval vaqti kelganda (Cloudflare cron chaqiradi)
app.post('/nashr-ig-tg', (req, res) => {
  if (!tekshirSecret(req, res)) return;
  const { id, adminChatId } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: 'id kerak' });
  res.json({ ok: true, holat: 'boshlandi' });
  ish('IG+TG nashr', req, (env) => bajarIgTg({ env, id, adminChatId }));
});

// POST /nashr -- admin "✅ Joylash" bosganda (Cloudflare bot chaqiradi)
app.post('/nashr', (req, res) => {
  if (!tekshirSecret(req, res)) return;
  const { id, adminChatId } = req.body || {};
  if (!id || !adminChatId) return res.status(400).json({ ok: false, error: 'id va adminChatId kerak' });
  res.json({ ok: true, holat: 'boshlandi' });
  ish('Nashr', req, (env) => bajarNashr({ env, id, adminChatId }));
});

// POST /story-variant -- admin Story kartasini ❌ qilganda yangi variant
app.post('/story-variant', (req, res) => {
  if (!tekshirSecret(req, res)) return;
  const { id, adminChatId } = req.body || {};
  if (!id || !adminChatId) return res.status(400).json({ ok: false, error: 'id va adminChatId kerak' });
  res.json({ ok: true, holat: 'boshlandi' });
  ish('Story', req, (env) => bajarStoryVariant({ env, id, adminChatId }));
});

// POST /animatsion -- material yo'q kuni AI mavzu + ovoz + animatsion video (admin tasdig'iga)
app.post('/animatsion', (req, res) => {
  if (!tekshirSecret(req, res)) return;
  const { adminChatId, mavzu, korsatma, ishId } = req.body || {};
  if (!adminChatId) return res.status(400).json({ ok: false, error: 'adminChatId kerak' });
  res.json({ ok: true, holat: 'boshlandi' });
  ish('Animatsiya', req, (env) => bajarAnimatsion({ env, adminChatId, mavzu, korsatma, ishId }));
});

app.post('/reel-senariy', (req, res) => {
  if (!tekshirSecret(req, res)) return;
  const { adminChatId, loyiha, qayta } = req.body || {};
  if (!adminChatId) return res.status(400).json({ ok: false, error: 'adminChatId kerak' });
  res.json({ ok: true, holat: 'boshlandi' });
  ish('ReelSenariy', req, (env) => bajarReelSenariy({ env, adminChatId, loyiha, qayta: !!qayta }));
});

app.post('/reel-yarat', (req, res) => {
  if (!tekshirSecret(req, res)) return;
  const { adminChatId, loyiha, variant } = req.body || {};
  if (!adminChatId || !loyiha) return res.status(400).json({ ok: false, error: 'adminChatId va loyiha kerak' });
  res.json({ ok: true, holat: 'boshlandi' });
  ish('ReelVideo', req, (env) => bajarReelYarat({ env, adminChatId, loyiha, variant: variant === 'teaser' ? 'teaser' : 'uzun' }));
});

app.post('/yuz-studio', (req, res) => {
  if (!tekshirSecret(req, res)) return;
  const { adminChatId } = req.body || {};
  if (!adminChatId) return res.status(400).json({ ok: false, error: 'adminChatId kerak' });
  res.json({ ok: true, holat: 'boshlandi' });
  ish('Yuz-studio', req, (env) => bajarYuzStudio({ env, adminChatId }));
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
  bajarMontaj({ env: mergeEnv(req), aslFileId: fileId, adminChatId: chatId, title: title || null }).catch(() => {});
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Visart media-server ${port}-portda ishga tushdi`));
if (process.platform === 'win32' || process.env.XOM_KUZAT) { xomKuzatuvchi(); fotoIshchi(); }
