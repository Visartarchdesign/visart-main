// Telegram'dan KATTA video (20 MB dan ortiq, 2 GB gacha) yuklab olish: Bot API emas, MTProto (GramJS) orqali -- bot tokeni bilan,
// telefon/parol kerak emas. Faqat bir marta my.telegram.org dan API_ID/API_HASH olinadi (.env: TG_API_ID, TG_API_HASH).
// Yuklangan fayl xom_video papkasiga tushadi -- papka kuzatuvchisi uni avtomatik montajga oladi.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const SESS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'tg_sessiya.txt');
let _klient = null;

async function xabar(env, chatId, matn) {
  await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: matn }), signal: AbortSignal.timeout(10000) }).catch(() => {});
}

async function klient(env) {
  if (_klient && _klient.connected) return _klient;
  const apiId = Number(env.TG_API_ID), apiHash = env.TG_API_HASH;
  if (!apiId || !apiHash) throw new Error("TG_API_ID/TG_API_HASH yo'q (my.telegram.org -> API development tools; media-server\\.env ga yozing)");
  let tl, sessions;
  try { tl = await import('telegram'); sessions = await import('telegram/sessions/index.js'); }
  catch { throw new Error("'telegram' paketi o'rnatilmagan: media-server papkasida `npm install` ni ishga tushiring (qayta.bat/ornatish.bat buni o'zi qiladi)"); }
  const saqlangan = fs.existsSync(SESS) ? fs.readFileSync(SESS, 'utf8').trim() : '';
  const c = new tl.TelegramClient(new sessions.StringSession(saqlangan), apiId, apiHash, { connectionRetries: 5 });
  await c.start({ botAuthToken: env.MIJOZ_BOT_TOKEN });
  try { fs.writeFileSync(SESS, c.session.save()); } catch { /* ixtiyoriy */ }
  _klient = c;
  return c;
}

const toza = (s) => String(s || '').replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

export async function tgYukla({ env, chatId, messageId, adminChatId, korsatma }) {
  const papka = process.env.XOM_PAPKA || path.join(os.homedir(), 'Documents', 'Visart_AI_Studio', 'xom_video');
  fs.mkdirSync(papka, { recursive: true });
  try {
    const c = await klient(env);
    const [m] = await c.getMessages(chatId, { ids: [Number(messageId)] });
    if (!m || !m.media) throw new Error('xabar yoki video topilmadi (bot guruhda bormi?)');
    const mb = Math.round(Number((m.document && m.document.size) || 0) / 1048576);
    const nom = (toza(korsatma) || `tg_${messageId}`) + '.mp4';
    let yakun = path.join(papka, nom);
    if (fs.existsSync(yakun)) yakun = path.join(papka, nom.replace(/\.mp4$/, `_${Date.now()}.mp4`));
    const part = yakun + '.part';
    await xabar(env, adminChatId, `📥 Katta video (${mb} MB) yuklab olinmoqda... tugagach montaj o'zi boshlanadi.`);
    let oxirgi = 0;
    await c.downloadMedia(m, { outputFile: part, progressCallback: (done, total) => {
      const p = Math.floor(Number(done) / Number(total) * 100);
      if (p - oxirgi >= 25) { oxirgi = p; xabar(env, adminChatId, `📥 ${p}%`); }
    } });
    fs.renameSync(part, yakun);
    await xabar(env, adminChatId, '✅ Yuklab olindi. Montaj boshlanadi (bir necha daqiqa).');
  } catch (e) {
    await xabar(env, adminChatId, `⚠️ Katta videoni yuklab bo'lmadi: ${String((e && e.message) || e).slice(0, 400)}\nZaxira yo'l: faylni Documents\\Visart_AI_Studio\\xom_video papkasiga tashlang.`);
  }
}
