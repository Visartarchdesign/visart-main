// Tizim nazorati: sayt/baza/bot/Instagram/media-server salomatligi, hujum belgilari, to'xtab qolgan navbat.
// nashr-navbati cron'i (har 15 daqiqa) chaqiradi. Hech qachon xato tashlamaydi.
import { xatoYoz, adminXabar } from './xato.js';

const sh = (env) => ({ apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` });
const sb = async (env, path) => {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { headers: sh(env), signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
};

async function sayt(env) {
  const t = Date.now();
  try {
    const r = await fetch('https://visartdesign.uz/', { method: 'GET', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'visart-nazorat' } });
    const ms = Date.now() - t;
    if (r.status >= 500) await xatoYoz(env, 'nazorat:sayt', `Sayt ${r.status} qaytardi.`);
    else if (ms > 5000) await xatoYoz(env, 'nazorat:sayt-sekin', `Sayt juda sekin javob beryapti (${ms} ms).`);
    return r.status < 500 ? `sayt ${r.status} (${ms} ms)` : `sayt ${r.status}`;
  } catch (e) { await xatoYoz(env, 'nazorat:sayt', `Sayt ochilmayapti: ${e.message}`); return 'sayt: OCHILMADI'; }
}

async function baza(env) {
  try {
    const xato = await sb(env, `nashr_navbati?holat=eq.xato&created_at=gte.${new Date(Date.now() - 3600e3).toISOString()}&select=id`);
    if (xato.length >= 5) await xatoYoz(env, 'nazorat:navbat-xatolar', `So'nggi 1 soatda navbatda ${xato.length} ta xato.`);
    const qotgan = await sb(env, `nashr_navbati?holat=eq.bajarilmoqda&created_at=lt.${new Date(Date.now() - 20 * 60e3).toISOString()}&select=id,turi`);
    if (qotgan.length) await xatoYoz(env, 'nazorat:navbat-qotgan', `${qotgan.length} ta qator 20 daqiqadan beri "bajarilmoqda" holatida qotib qoldi (${qotgan.map((q) => q.turi).join(', ')}).`);
    const hujum = await sb(env, `bot_xatolar?manba=like.cron-401*&created_at=gte.${new Date(Date.now() - 3600e3).toISOString()}&select=id`);
    if (hujum.length >= 10) await xatoYoz(env, 'nazorat:hujum', `HUJUM EHTIMOLI: so'nggi 1 soatda ${hujum.length} marta noto'g'ri secret bilan kirishga urinildi.`);
    const kun = await sb(env, `bot_xatolar?created_at=gte.${new Date(Date.now() - 24 * 3600e3).toISOString()}&select=id`);
    return { text: `baza OK (24s xato: ${kun.length}, navbat xato/1s: ${xato.length})`, kun: kun.length };
  } catch (e) { await xatoYoz(env, 'nazorat:baza', `Supabase javob bermayapti: ${e.message}`); return { text: 'baza: XATO' }; }
}

async function telegram(env) {
  if (!env.MIJOZ_BOT_TOKEN) return 'telegram: token yo\'q';
  try {
    const d = await (await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/getWebhookInfo`, { signal: AbortSignal.timeout(6000) })).json();
    const w = d && d.result;
    if (!w) throw new Error('javob bo\'sh');
    if (!w.url) await xatoYoz(env, 'nazorat:webhook-yoq', 'Telegram webhook o\'rnatilmagan, bot javob bermaydi.');
    if (w.last_error_date && Date.now() / 1000 - w.last_error_date < 3600) await xatoYoz(env, 'nazorat:webhook-xato', `Telegram webhook xatosi: ${w.last_error_message || ''}`);
    if ((w.pending_update_count || 0) > 50) await xatoYoz(env, 'nazorat:webhook-navbat', `Telegram'da ${w.pending_update_count} ta xabar kutib turibdi (bot sekin yoki ishlamayapti).`);
    return `bot OK (kutilayotgan: ${w.pending_update_count || 0})`;
  } catch (e) { await xatoYoz(env, 'nazorat:telegram', `Telegram tekshiruvi xato: ${e.message}`); return 'bot: XATO'; }
}

async function instagram(env) {
  const tok = env.INSTAGRAM_ACCESS_TOKEN;
  if (!tok) return 'instagram: token yo\'q';
  try {
    const u = new URL('https://graph.facebook.com/v21.0/debug_token');
    u.searchParams.set('input_token', tok); u.searchParams.set('access_token', tok);
    const d = (await (await fetch(u, { signal: AbortSignal.timeout(8000) })).json()).data;
    if (!d) throw new Error('javob bo\'sh');
    if (d.is_valid === false) { await xatoYoz(env, 'nazorat:ig-token', 'Instagram/Facebook token YAROQSIZ. Story, post va Reels joylanmaydi. Yangi token kerak.'); return 'instagram: TOKEN YAROQSIZ'; }
    const tugash = d.expires_at ? d.expires_at * 1000 - Date.now() : null;
    if (tugash !== null && tugash < 7 * 86400e3) await xatoYoz(env, 'nazorat:ig-token-muddat', `Instagram token ${Math.max(0, Math.round(tugash / 86400e3))} kundan keyin tugaydi. Yangilang.`);
    return `instagram OK${tugash ? ` (${Math.round(tugash / 86400e3)} kun)` : ''}`;
  } catch (e) { return `instagram: tekshirib bo'lmadi (${e.message})`; }
}

async function media(env) {
  if (!env.MEDIA_SERVER_URL) return 'media-server: sozlanmagan';
  let ok = false, kod = '';
  try {
    const r = await fetch(`${env.MEDIA_SERVER_URL}/health`, { signal: AbortSignal.timeout(8000) });
    ok = r.ok; kod = r.ok ? '' : String(r.status);
  } catch (e) { kod = 'javob yoq'; }
  // Holat qatori: oflayn bo'lsa ketma-ket 2 tekshiruvdan keyin (~15-30 daq) ogohlantiradi, qaytganda xabar beradi
  try {
    const H = { ...sh(env), 'Content-Type': 'application/json' };
    const rows = await sb(env, 'nashr_navbati?turi=eq.media_holat&select=id,holat,payload&limit=1');
    const q = rows[0];
    const now = Date.now();
    const yoz = (id, holat, payload) => fetch(`${env.SUPABASE_URL}/rest/v1/nashr_navbati${id ? `?id=eq.${id}` : ''}`, { method: id ? 'PATCH' : 'POST', headers: H, body: JSON.stringify(id ? { holat, payload } : [{ turi: 'media_holat', holat, payload, nashr_vaqti: new Date().toISOString() }]), signal: AbortSignal.timeout(6000) }).catch(() => {});
    if (!ok) {
      const p = (q && q.holat === 'media_oflayn' && q.payload) || null;
      if (!p) await yoz(q && q.id, 'media_oflayn', { birinchi: now, xabar: false });
      else if (!p.xabar && now - p.birinchi >= 10 * 60e3) {
        await adminXabar(env, `🔴 Media-server (kompyuter) ${Math.round((now - p.birinchi) / 60000)}+ daqiqadan beri javob bermayapti${kod ? ` (${kod})` : ''}.\nKompyuter o'chgan, uxlayotgan yoki internet uzilgan bo'lishi mumkin. Montaj, video va Instagram/YouTube joylash to'xtaydi (matnli postlar ishlayveradi).\nKompyuter yonganda hamma narsa o'zi ishga tushadi va men xabar beraman.`);
        await yoz(q.id, 'media_oflayn', { ...p, xabar: true });
      }
      return `media-server: OFLAYN (${kod})`;
    }
    if (q && q.holat === 'media_oflayn') {
      const p = q.payload || {};
      if (p.xabar) await adminXabar(env, `🟢 Media-server qayta ishga tushdi (${Math.round((now - p.birinchi) / 60000)} daqiqa o'chiq bo'lgan). Kutib turgan ishlar davom etadi.`);
      await yoz(q.id, 'media_ok', { tiklandi: now });
    }
  } catch (e) { /* holat yozilmasa ham tekshiruv davom etadi */ }
  return 'media-server OK';
}

export async function tizimNazorati(env) {
  try {
    const t = Promise.allSettled([sayt(env), baza(env), telegram(env), instagram(env), media(env)]);
    const res = await Promise.race([t, new Promise((r) => setTimeout(() => r(null), 6000))]);
    // Kunlik xulosa: Toshkent 08:00 (UTC 03:00)
    const n = new Date();
    if (res && n.getUTCHours() === 3 && n.getUTCMinutes() < 15) {
      const q = res.map((x) => (x.status === 'fulfilled' ? (typeof x.value === 'string' ? x.value : x.value.text) : 'tekshiruv yiqildi'));
      await adminXabar(env, `🛡 Tizim holati (ertalabki)\n• ${q.join('\n• ')}`);
    }
  } catch (e) { /* jim */ }
}
