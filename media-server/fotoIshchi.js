// Foto ishchi (kompyuterda): Supabase navbatidan (turi='foto_ish', holat='foto_navbat') rasmlarni olib, Yandex Business'ga yuklaydi.
// Brauzer: o'rnatilgan Chrome, alohida profil (Documents\Visart_AI_Studio\brauzer_profil). Birinchi marta: foto_kirish.bat -> Yandex'ga o'zingiz kirasiz.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const KESH = path.join(path.dirname(fileURLToPath(import.meta.url)), '_env_kesh.json');
const PROFIL = process.env.FOTO_PROFIL || path.join(os.homedir(), 'Documents', 'Visart_AI_Studio', 'brauzer_profil');
const YANDEX_ID = process.env.YANDEX_BIZ_ID || '117014923073';
const SAHIFA = `https://yandex.com/sprav/${YANDEX_ID}/p/edit/photos/`;
const GOOGLE_ID = process.env.GOOGLE_BIZ_ID || '9540037886496646500';
const GOOGLE_URL = `https://www.google.com/search?q=Visart+Design+Tashkent+arxitektura&hl=ru#mpd=~${GOOGLE_ID}/promote/photos/add`;
const INPUT = { interior: 'interior', exterior: 'exterior', xizmat: 'services', kirish: 'enter', logo: 'logo' };

function muhit() {
  let e = {};
  try { e = JSON.parse(fs.readFileSync(KESH, 'utf8')); } catch (x) { /* kesh yo'q */ }
  return { ...e, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|MIJOZ_BOT_TOKEN)$/.test(k))) };
}
const sb = async (E, p, init = {}) => {
  const r = await fetch(`${E.SUPABASE_URL}/rest/v1/${p}`, { ...init, headers: { apikey: E.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${E.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`sb ${r.status}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
};
const tg = (E, method, body) => fetch(`https://api.telegram.org/bot${E.MIJOZ_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) }).then((r) => r.json()).catch(() => null);

async function faylOl(E, p, tmp) {
  let url, ext = 'jpg';
  if (p.fileId) {
    const g = await tg(E, 'getFile', { file_id: p.fileId });
    if (!g || !g.ok) throw new Error('Telegram fayli 20 MB dan katta yoki topilmadi');
    url = `https://api.telegram.org/file/bot${E.MIJOZ_BOT_TOKEN}/${g.result.file_path}`;
    ext = (g.result.file_path.split('.').pop() || 'jpg').toLowerCase();
  } else { url = p.url; ext = ((url.split('?')[0].split('.').pop()) || 'jpg').toLowerCase(); }
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error('rasm yuklanmadi: HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 25e6) throw new Error('rasm 25 MB dan katta');
  let f = path.join(tmp, `${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`);
  // webp/avif Yandex qabul qilmaydi (faqat jpeg/png/heic) -> sharp bilan jpg
  if (!/^(jpe?g|png|heic)$/.test(ext)) {
    const sharp = (await import('sharp')).default;
    f = f.replace(/\.[^.]+$/, '.jpg');
    await sharp(buf).jpeg({ quality: 92 }).toFile(f);
  } else fs.writeFileSync(f, buf);
  return f;
}

let band = false;
export async function fotoIshchiBajar() {
  if (band) return; band = true;
  const E = muhit();
  if (!E.SUPABASE_URL || !E.SUPABASE_SERVICE_ROLE_KEY || !E.MIJOZ_BOT_TOKEN) { band = false; return; }
  let ishlar = [];
  try { ishlar = await sb(E, 'nashr_navbati?turi=eq.foto_ish&holat=eq.foto_navbat&select=id,payload&order=id.asc&limit=20'); } catch (e) { band = false; return; }
  if (!ishlar || !ishlar.length) { band = false; return; }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'foto_'));
  const natija = new Map(); // chatId -> {ok:[], xato:[]}
  const belgila = (chatId, kalit, qator) => { if (!natija.has(chatId)) natija.set(chatId, { ok: [], xato: [] }); natija.get(chatId)[kalit].push(qator); };
  let ctx;
  try {
    const { chromium } = await import('playwright-core');
    fs.mkdirSync(PROFIL, { recursive: true });
    ctx = await chromium.launchPersistentContext(PROFIL, { channel: 'chrome', headless: true, viewport: { width: 1400, height: 900 }, args: ['--disable-blink-features=AutomationControlled'] });
    const page = ctx.pages()[0] || await ctx.newPage();

    for (const ish of ishlar) {
      const p = ish.payload || {};
      const claim = await sb(E, `nashr_navbati?id=eq.${ish.id}&holat=eq.foto_navbat`, { method: 'PATCH', body: JSON.stringify({ holat: 'foto_bajar' }) }).catch(() => []);
      if (!claim || !claim.length) continue; // boshqa nusxa oldi
      try {
        const pl = p.platforma || 'yandex';
        const f = await faylOl(E, p, tmp);
        if (pl === 'yandex') {
          const nom = INPUT[p.toifa]; if (!nom) throw new Error('noma\'lum toifa: ' + p.toifa);
          await page.goto(SAHIFA, { waitUntil: 'domcontentloaded', timeout: 60000 });
          if (/passport\.yandex|\/auth/.test(page.url())) throw new Error("Yandex'ga kirilmagan: foto_kirish.bat ni ishga tushiring");
          await page.waitForSelector(`input[name="${nom}"]`, { state: 'attached', timeout: 30000 });
          await page.setInputFiles(`input[name="${nom}"]`, f);
          await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
          await page.waitForTimeout(6000);
          const sakla = page.getByRole('button', { name: /^(Save|Save changes|Publish|Done|Сохранить|Готово)$/i }).first();
          if (await sakla.isVisible().catch(() => false)) { await sakla.click().catch(() => {}); await page.waitForTimeout(4000); }
        } else if (pl === 'google') {
          await page.goto('about:blank');
          await page.goto(GOOGLE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.waitForTimeout(4000);
          if (/accounts\.google\.com/.test(page.url())) throw new Error("Google'ga kirilmagan: foto_kirish.bat ni ishga tushiring");
          await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
          await page.waitForTimeout(3000);
          const inp = page.locator('input[type="file"][accept*="image/jpeg"]').first();
          await inp.waitFor({ state: 'attached', timeout: 30000 });
          await inp.setInputFiles(f);
          await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
          await page.waitForTimeout(8000);
        } else if (pl === 'gis') {
          throw new Error("2GIS hali ulanmagan (2GIS kabineti ma'lumotlari kerak)");
        } else throw new Error('noma\'lum platforma: ' + pl);
        const shot = path.join(tmp, `shot_${ish.id}.png`);
        await page.screenshot({ path: shot }).catch(() => {});
        await sb(E, `nashr_navbati?id=eq.${ish.id}`, { method: 'PATCH', body: JSON.stringify({ holat: 'foto_tayyor', payload: { ...p, tugadi: new Date().toISOString() } }) });
        belgila(p.chatId, 'ok', `#${ish.id} ${p.toifa}${p.nom ? ' · ' + p.nom : ''}`);
        if (p.chatId && fs.existsSync(shot)) {
          const fd = new FormData(); fd.append('chat_id', String(p.chatId)); fd.append('caption', `✅ #${ish.id} yuborildi (${(p.platforma || 'yandex')}, ${p.toifa}). Moderatsiya bir necha soat/kun olishi mumkin.`);
          fd.append('photo', new Blob([fs.readFileSync(shot)]), 'natija.png');
          await fetch(`https://api.telegram.org/bot${E.MIJOZ_BOT_TOKEN}/sendPhoto`, { method: 'POST', body: fd, signal: AbortSignal.timeout(30000) }).catch(() => {});
        }
      } catch (e) {
        const xato = String((e && e.message) || e).slice(0, 200);
        await sb(E, `nashr_navbati?id=eq.${ish.id}`, { method: 'PATCH', body: JSON.stringify({ holat: 'foto_xato', payload: { ...p, xato } }) }).catch(() => {});
        belgila(p.chatId, 'xato', `#${ish.id}: ${xato}`);
      }
    }
  } catch (e) {
    const xato = String((e && e.message) || e).slice(0, 200);
    for (const ish of ishlar) {
      const holat = await sb(E, `nashr_navbati?id=eq.${ish.id}&select=holat`).catch(() => []);
      if (holat && holat[0] && holat[0].holat !== 'foto_navbat' && holat[0].holat !== 'foto_bajar') continue;
      await sb(E, `nashr_navbati?id=eq.${ish.id}`, { method: 'PATCH', body: JSON.stringify({ holat: 'foto_xato', payload: { ...(ish.payload || {}), xato } }) }).catch(() => {});
      belgila((ish.payload || {}).chatId, 'xato', `#${ish.id}: ${xato}`);
    }
  } finally {
    try { if (ctx) await ctx.close(); } catch (e) { /* yopilgan */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* vaqtinchalik */ }
    for (const [chatId, n] of natija) {
      if (!chatId) continue;
      const t = `📸 <b>Foto ko'prigi</b>\n✅ yuborildi: ${n.ok.length}${n.xato.length ? `\n❌ xato: ${n.xato.length}\n${n.xato.slice(0, 4).join('\n')}\n\nQayta: /foto_qayta` : ''}`;
      await tg(E, 'sendMessage', { chat_id: chatId, text: t, parse_mode: 'HTML' });
    }
    band = false;
  }
}

export function fotoIshchi() {
  console.log('Foto ishchi ishga tushdi (har 60 s navbat tekshiriladi)');
  // Yarim yo'lda to'xtab qolgan (foto_bajar) ishlar qayta navbatga
  setTimeout(async () => { try { const E = muhit(); if (E.SUPABASE_URL) await sb(E, 'nashr_navbati?turi=eq.foto_ish&holat=eq.foto_bajar', { method: 'PATCH', body: JSON.stringify({ holat: 'foto_navbat' }) }); } catch (e) { /* kesh hali yo'q */ } }, 20000);
  setInterval(() => { fotoIshchiBajar().catch(() => { band = false; }); }, 60000);
}

// Qo'lda kirish rejimi: node fotoIshchi.js --kirish  (ko'rinadigan oyna; o'zingiz Yandex'ga kirasiz)
if (process.argv[1] && process.argv[1].endsWith('fotoIshchi.js') && process.argv.includes('--kirish')) {
  const { chromium } = await import('playwright-core');
  fs.mkdirSync(PROFIL, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFIL, { channel: 'chrome', headless: false, viewport: null, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-blink-features=AutomationControlled'] });
  const page = ctx.pages()[0] || await ctx.newPage();
  const g = await ctx.newPage();
  const och = (p, u) => p.goto(u, { waitUntil: 'commit', timeout: 60000 }).catch((e) => console.log('Ochilmadi:', u, String(e.message).slice(0, 80)));
  await Promise.all([
    och(page, 'https://passport.yandex.com/auth?retpath=' + encodeURIComponent(SAHIFA)),
    och(g, 'https://accounts.google.com/ServiceLogin?continue=' + encodeURIComponent('https://business.google.com/locations')),
  ]);
  await page.bringToFront().catch(() => {});
  console.log("Ikkala tabda kiring: 1) Yandex (Doston Toxtaev), 2) Google (visartarchdesign@gmail.com). Tugagach oynani yoping.");
  await new Promise((r) => ctx.on('close', r));
  process.exit(0);
}
