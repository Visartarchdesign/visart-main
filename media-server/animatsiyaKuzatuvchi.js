// Animatsiya topshiruv kuzatuvchisi: kontent/animatsiya/<ish>/paket.json  {"holat":"tayyor"}
// Tayyor video (ovoz+subtitr bilan) montajsiz to'g'ri admin tasdiqiga ketadi (✅ Joylash -> haftalik nashr jadvali).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { tasdiqqaYubor } from './montaj.js';

const KESH = path.join(path.dirname(fileURLToPath(import.meta.url)), '_env_kesh.json');

export function animatsiyaKuzatuvchi() {
  const papka = process.env.ANIM_PAPKA || path.join(os.homedir(), 'Documents', 'Visart_AI_Studio', 'kontent', 'animatsiya');
  fs.mkdirSync(papka, { recursive: true });
  let band = false;
  console.log('Animatsiya papka kuzatilmoqda:', papka);
  setInterval(async () => {
    if (band) return;
    let ish, pj, paket;
    try {
      for (const d of fs.readdirSync(papka)) {
        pj = path.join(papka, d, 'paket.json');
        if (!fs.existsSync(pj)) continue;
        const p = JSON.parse(fs.readFileSync(pj, 'utf8'));
        if (p.holat === 'tayyor') { ish = path.join(papka, d); paket = p; break; }
      }
    } catch (e) { return; }
    if (!ish) return;
    band = true;
    try {
      let kesh = {};
      try { kesh = JSON.parse(fs.readFileSync(KESH, 'utf8')); } catch (e) { /* yo'q */ }
      const env = { ...process.env, ...kesh };
      const admin = kesh.ADMIN_CHAT_ID;
      if (!admin || !env.MIJOZ_BOT_TOKEN) { console.log("Animatsiya kuzatuvchi kutmoqda: kalit/admin yo'q (Telegramdan biror buyruq yuboring)"); return; }
      const video = path.join(ish, paket.video || 'final.mp4');
      const qop = paket.oblojka ? path.join(ish, paket.oblojka) : null;
      if (!fs.existsSync(video)) throw new Error('video topilmadi: ' + video);
      pj = path.join(ish, 'paket.json');
      paket.holat = 'yuborilmoqda'; fs.writeFileSync(pj, JSON.stringify(paket, null, 1));
      await tasdiqqaYubor(env, admin, video, qop && fs.existsSync(qop) ? fs.readFileSync(qop) : null,
        { sarlavha: paket.sarlavha, tavsif: paket.tavsif, hashtaglar: paket.hashtaglar, izoh: paket.izoh || 'Animatsiya (tayyor, montajsiz).', taklifId: null, manba: paket.manba || 'animatsion' });
      paket.holat = 'tasdiqda'; paket.yuborilgan = new Date().toISOString();
      fs.writeFileSync(pj, JSON.stringify(paket, null, 1));
    } catch (e) {
      console.error('Animatsiya kuzatuvchi xato:', e && e.message);
      try { paket.holat = 'xato'; paket.xato = String(e && e.message); fs.writeFileSync(path.join(ish, 'paket.json'), JSON.stringify(paket, null, 1)); } catch (_) { /* */ }
    } finally { band = false; }
  }, 20000);
}
