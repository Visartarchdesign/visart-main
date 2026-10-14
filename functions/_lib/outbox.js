// Chiquvchi xabarlar (mijoz/usta guruhlari): yuborish + jurnal + qayta urinish.
// Qoida: jadval yo'q yoki Supabase ishlamasa ham xabar ESKICHA to'g'ridan-to'g'ri yuboriladi (hech narsa buzilmaydi).
const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const BACKOFF_DAQIQA = [2, 10, 30, 120, 360]; // 1..5-urinishdan keyin kutish
const MAX_URINISH = 5;
const menejerlar = (env) => (env.MANAGER_CHAT_ID ? [env.MANAGER_CHAT_ID]
  : String(env.ADMIN_TELEGRAM_IDS || '').split(',').map((x) => x.trim()).filter(Boolean));

async function sb(env, path, init = {}) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: init.prefer || 'return=representation', ...(init.headers || {}) },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`sb ${r.status}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

// Telegram'ga bitta urinish. Natija: { ok } | { vaqtincha, kutish_s, sabab } | { doimiy, sabab, yangi_chat }
export async function tgUrinish(env, chat_id, text) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }), signal: AbortSignal.timeout(10000),
    });
    if (r.ok) return { ok: true };
    const d = await r.json().catch(() => null);
    const sabab = `Telegram ${r.status}${d && d.description ? ': ' + d.description : ''}`;
    if (r.status === 429) return { vaqtincha: true, kutish_s: (d && d.parameters && d.parameters.retry_after) || 30, sabab };
    if (d && d.parameters && d.parameters.migrate_to_chat_id) return { doimiy: true, sabab, yangi_chat: String(d.parameters.migrate_to_chat_id) };
    if (r.status >= 500) return { vaqtincha: true, kutish_s: 0, sabab };
    return { doimiy: true, sabab };
  } catch (e) { return { vaqtincha: true, kutish_s: 0, sabab: `Telegram'ga ulanib bo'lmadi (${e.message})` }; }
}

const tun = () => { const h = new Date(Date.now() + 5 * 3600e3).getUTCHours(); return h < 8 || h >= 21; }; // Toshkent 21:00-08:00
function keyingi(urinish, kutishS) {
  let ms = Math.max((BACKOFF_DAQIQA[Math.min(urinish, BACKOFF_DAQIQA.length) - 1] || 360) * 60e3, (kutishS + 1) * 1e3);
  let t = Date.now() + ms;
  const tosh = new Date(t + 5 * 3600e3); const h = tosh.getUTCHours();
  if (h < 8 || h >= 21) { // qayta urinish tunda mijozni bezovta qilmasin: ertalab 08:00 gacha suramiz
    const k = new Date(tosh); if (h >= 21) k.setUTCDate(k.getUTCDate() + 1); k.setUTCHours(8, 0, 0, 0);
    t = k.getTime() - 5 * 3600e3;
  }
  return new Date(t).toISOString();
}

async function chatniYangila(env, eski, yangi) {
  for (const j of ['visart_loyiha_guruhlar', 'usta_guruhlar']) {
    await sb(env, `${j}?telegram_chat_id=eq.${encodeURIComponent(eski)}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ telegram_chat_id: yangi }) }).catch(() => {});
  }
}

async function xatoXabar(env, qator, sabab) {
  for (const m of menejerlar(env)) {
    await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: m, parse_mode: 'HTML', text: `❌ Xabar mijozga YETMADI${qator.obyekt_id ? ` (obyekt ${esc(qator.obyekt_id)})` : ''}: ${esc(qator.tur || '')}\nSabab: ${esc(sabab)}\nGuruh bog'lanishini tekshiring (Admin panel → 👥 Guruhlar).` }), signal: AbortSignal.timeout(8000) }).catch(() => {});
  }
}

// Asosiy kirish: yuboradi va jurnalga yozadi. Qaytaradi { holat: 'yuborildi'|'navbatda'|'xato'|'takror', sabab? }
export async function xabarYubor(env, { chat_id, matn, tur, obyekt_id, kalit }) {
  chat_id = String(chat_id);
  let id = null, jadval = true;
  try {
    if (kalit) {
      const bor = await sb(env, `xabar_navbati?kalit=eq.${encodeURIComponent(kalit)}&select=id,holat`);
      if (bor && bor[0]) {
        if (bor[0].holat !== 'xato') return { holat: 'takror' };
        id = bor[0].id; // oldin xato bo'lgan: qayta urinib ko'ramiz
      }
    }
    if (id === null) {
      const q = await sb(env, 'xabar_navbati', { method: 'POST', body: JSON.stringify([{ chat_id, matn, tur: tur || null, obyekt_id: obyekt_id ? String(obyekt_id) : null, kalit: kalit || null }]) });
      id = q && q[0] ? q[0].id : null;
    }
  } catch (e) { jadval = false; } // jadval yo'q -- eskicha yuboramiz
  let n = await tgUrinish(env, chat_id, matn);
  if (n.yangi_chat) { await chatniYangila(env, chat_id, n.yangi_chat); chat_id = n.yangi_chat; n = await tgUrinish(env, chat_id, matn); }
  const patch = (p) => (jadval && id ? sb(env, `xabar_navbati?id=eq.${id}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(p) }).catch(() => {}) : null);
  if (n.ok) { await patch({ holat: 'yuborildi', urinish: 1, yuborilgan: new Date().toISOString(), chat_id, xato_matni: null }); return { holat: 'yuborildi' }; }
  if (n.vaqtincha && jadval && id) {
    await patch({ urinish: 1, keyingi_urinish: keyingi(1, n.kutish_s), xato_matni: n.sabab, holat: 'kutilmoqda' });
    return { holat: 'navbatda', sabab: n.sabab };
  }
  await patch({ holat: 'xato', urinish: 1, xato_matni: n.sabab });
  return { holat: 'xato', sabab: n.sabab };
}

// Cron (har 15 daqiqa): vaqti kelgan kutilayotgan xabarlarni qayta yuboradi. Tunda (21:00-08:00 Toshkent) yubormaydi.
export async function navbatniYubor(env) {
  if (!env.MIJOZ_BOT_TOKEN || tun()) return { o_tkazildi: 'tun yoki token yoq' };
  const nat = { yuborildi: 0, qayta: 0, xato: 0 };
  let list;
  try { list = await sb(env, `xabar_navbati?holat=eq.kutilmoqda&keyingi_urinish=lte.${new Date().toISOString()}&order=id.asc&limit=20&select=*`); }
  catch (e) { return { xato: 'xabar_navbati jadvali yoq' }; }
  for (const q of list || []) {
    // "claim": bir vaqtda ikki cron bir xabarni ikki marta yubormasin
    const olindi = await sb(env, `xabar_navbati?id=eq.${q.id}&holat=eq.kutilmoqda&keyingi_urinish=eq.${encodeURIComponent(q.keyingi_urinish)}`, { method: 'PATCH', body: JSON.stringify({ keyingi_urinish: new Date(Date.now() + 10 * 60e3).toISOString() }) }).catch(() => null);
    if (!olindi || !olindi.length) continue;
    let chat = q.chat_id;
    let n = await tgUrinish(env, chat, q.matn);
    if (n.yangi_chat) { await chatniYangila(env, chat, n.yangi_chat); chat = n.yangi_chat; n = await tgUrinish(env, chat, q.matn); }
    const urinish = (q.urinish || 0) + 1;
    if (n.ok) { await sb(env, `xabar_navbati?id=eq.${q.id}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ holat: 'yuborildi', urinish, chat_id: chat, yuborilgan: new Date().toISOString(), xato_matni: null }) }).catch(() => {}); nat.yuborildi++; continue; }
    if (n.vaqtincha && urinish < MAX_URINISH) {
      await sb(env, `xabar_navbati?id=eq.${q.id}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ urinish, keyingi_urinish: keyingi(urinish, n.kutish_s), xato_matni: n.sabab }) }).catch(() => {}); nat.qayta++; continue;
    }
    await sb(env, `xabar_navbati?id=eq.${q.id}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ holat: 'xato', urinish, xato_matni: n.sabab }) }).catch(() => {});
    await xatoXabar(env, q, `${n.sabab} (${urinish} urinishdan keyin)`); nat.xato++;
  }
  return nat;
}
