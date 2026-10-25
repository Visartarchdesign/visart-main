// Xom video papka kuzatuvchisi: Documents\Visart_AI_Studio\xom_video ga tashlangan video
// (Telegram 20 MB chegarasi yo'q) avtomatik montajga ketadi, natija adminga Telegram orqali tasdiqqa yuboriladi.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { bajarMontaj } from './montaj.js';

const KESH = path.join(path.dirname(fileURLToPath(import.meta.url)), '_env_kesh.json');
const KALITLAR = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MIJOZ_BOT_TOKEN', 'GEMINI_API_KEY', 'INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ACCOUNT_ID', 'FACEBOOK_PAGE_ID', 'TELEGRAM_CHANNEL_ID', 'TG_API_ID', 'TG_API_HASH'];
const VIDEO = /\.(mp4|mov|mkv|m4v|avi|webm)$/i;

// Cloudflare so'rovlaridan kelgan kalitlar va admin chat id -- qayta ishga tushganda ham kuzatuvchi ishlashi uchun
export function keshYoz(env, adminChatId) {
  try {
    let eski = {};
    try { eski = JSON.parse(fs.readFileSync(KESH, 'utf8')); } catch (e) { /* yangi */ }
    const yangi = { ...eski };
    for (const k of KALITLAR) if (env && env[k]) yangi[k] = env[k];
    if (adminChatId) yangi.ADMIN_CHAT_ID = String(adminChatId);
    if (JSON.stringify(yangi) !== JSON.stringify(eski)) fs.writeFileSync(KESH, JSON.stringify(yangi));
  } catch (e) { /* kesh ixtiyoriy */ }
}

export function xomKuzatuvchi() {
  const papka = process.env.XOM_PAPKA || path.join(os.homedir(), 'Documents', 'Visart_AI_Studio', 'xom_video');
  const tayyor = path.join(papka, 'ishlangan');
  fs.mkdirSync(tayyor, { recursive: true });
  const oldingi = new Map();
  let band = false;
  console.log('Xom video papka kuzatilmoqda:', papka);
  setInterval(async () => {
    if (band) return;
    let nom;
    try {
      for (const f of fs.readdirSync(papka)) {
        if (!VIDEO.test(f)) continue;
        const st = fs.statSync(path.join(papka, f));
        const key = `${st.size}:${st.mtimeMs}`;
        // fayl to'liq ko'chirilgan: hajm 2 skanda o'zgarmagan va 15 soniyadan eski
        if (oldingi.get(f) === key && Date.now() - st.mtimeMs > 15000) { nom = f; break; }
        oldingi.set(f, key);
      }
    } catch (e) { return; }
    if (!nom) return;
    band = true;
    try {
      let kesh = {};
      try { kesh = JSON.parse(fs.readFileSync(KESH, 'utf8')); } catch (e) { /* yo'q */ }
      const env = { ...process.env, ...kesh };
      const admin = kesh.ADMIN_CHAT_ID;
      const kerak = ['MIJOZ_BOT_TOKEN', 'GEMINI_API_KEY'].filter((k) => !env[k]);
      if (!admin || kerak.length) { console.log('Xom kuzatuvchi kutmoqda: kalit/admin yo\'q (Telegramdan biror buyruq yuboring, masalan /reelb):', kerak.join(',') || 'ADMIN_CHAT_ID'); return; }
      const asl = path.join(papka, nom);
      const nomBase = path.parse(nom).name;
      const korsatma = /^(IMG|VID|PXL|MOV|MVI|WIN|Screen)[_ -]?\d*/i.test(nomBase) ? undefined : nomBase.replace(/[_-]+/g, ' ');
      await bajarMontaj({ env, adminChatId: admin, title: undefined, korsatma, fayl: asl });
      fs.renameSync(asl, path.join(tayyor, `${Date.now()}_${nom}`));
      oldingi.delete(nom);
    } catch (e) {
      console.error('Xom kuzatuvchi xato:', e && e.message);
      oldingi.delete(nom);
    } finally { band = false; }
  }, 20000);
}
