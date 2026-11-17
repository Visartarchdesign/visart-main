// Instagram karusel tasdig'i (Telegram): PC'dagi generator `nashr_navbati`ga turi='instagram_karusel',
// holat='tasdiq_kutilmoqda' qator yozadi va adminga muqova + caption + [✅ Joylash / ❌ Bekor] yuboradi.
// Tugma callback_data = `krs:<id>:ok|no` -- shu fayl qayta ishlaydi:
//   ok -> holat='kutilmoqda' (nashr_vaqti saqlanadi; o'tib ketgan bo'lsa -- keyingi bo'sh karusel slotiga),
//   no -> holat='bekor'.
// Nashrning o'zi nashr-navbati.js (bajarInstagramKarusel) da.

const TOSH = 5 * 3600e3;
// Karusel slotlari (Toshkent): chorshanba 19:30 (loyiha), shanba 11:00 (arxitektor maslahati)
export const KARUSEL_SLOTLAR = [{ kun: 3, soat: 19, daq: 30 }, { kun: 6, soat: 11, daq: 0 }];
const MIN_ORALIQ = 2 * 3600e3; // bir soatdan zich ikki karusel bo'lmasin

async function sb(env, path, init = {}) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: init.prefer || 'return=representation' },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Supabase ${path} -> ${r.status}`);
  const x = await r.text();
  return x ? JSON.parse(x) : null;
}
async function api(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  return r ? r.json().catch(() => null) : null;
}

// hozirdan keyingi karusel slotlari (ms, UTC), oldinga qarab, `hafta` hafta ichida
export function slotRoyxati(hozirMs, hafta = 4) {
  const t = new Date(hozirMs + TOSH);
  const kun0 = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()); // Toshkent yarim kechasi (soxta-UTC)
  const natija = [];
  for (let d = 0; d < hafta * 7; d++) {
    const kd = new Date(kun0 + d * 864e5);
    for (const s of KARUSEL_SLOTLAR) {
      if (kd.getUTCDay() !== s.kun) continue;
      natija.push(kun0 + d * 864e5 + (s.soat * 60 + s.daq) * 60e3 - TOSH);
    }
  }
  return natija.filter((x) => x > hozirMs).sort((a, b) => a - b);
}

// Tasdiqlangan karusel qaysi vaqtda chiqadi: reja vaqti hali kelmagan bo'lsa -- o'sha; aks holda keyingi BO'SH slot
export function nashrVaqtiTanla(rejaMs, hozirMs, bandMs = []) {
  const bosh = (ms) => !bandMs.some((b) => Math.abs(b - ms) < MIN_ORALIQ);
  if (rejaMs && rejaMs > hozirMs + 2 * 60e3 && bosh(rejaMs)) return rejaMs;
  const s = slotRoyxati(hozirMs).find(bosh);
  return s || hozirMs + 3600e3;
}

const pad = (n) => String(n).padStart(2, '0');
export function toshVaqt(ms) {
  const t = new Date(ms + TOSH);
  return `${pad(t.getUTCDate())}.${pad(t.getUTCMonth() + 1)} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

async function xabarYangila(env, cq, qoshimcha) {
  const m = cq.message;
  const bosh = { chat_id: m.chat.id, message_id: m.message_id, reply_markup: { inline_keyboard: [] } };
  if (typeof m.text === 'string') await api(env, 'editMessageText', { ...bosh, text: `${m.text}\n\n${qoshimcha}`.slice(0, 4000), disable_web_page_preview: true });
  else await api(env, 'editMessageCaption', { ...bosh, caption: `${m.caption || ''}\n\n${qoshimcha}`.slice(0, 1000) });
}

export async function karuselCb(env, cq, data) {
  const [, idStr, amal] = data.split(':');
  const id = Number(idStr);
  const jav = (text, alert = false) => api(env, 'answerCallbackQuery', { callback_query_id: cq.id, text, show_alert: alert });
  if (!Number.isInteger(id) || id <= 0 || !['ok', 'no'].includes(amal)) { await jav('Noto\'g\'ri tugma'); return; }

  const qator = await sb(env, `nashr_navbati?id=eq.${id}&turi=eq.instagram_karusel&select=id,holat,nashr_vaqti,payload`);
  const q = qator && qator[0];
  if (!q) { await jav('Karusel topilmadi', true); return; }
  if (q.holat !== 'tasdiq_kutilmoqda') {
    await jav(`Allaqachon hal qilingan (${q.holat})`);
    await xabarYangila(env, cq, `ℹ️ Holat: ${q.holat}`);
    return;
  }

  if (amal === 'no') {
    const r = await sb(env, `nashr_navbati?id=eq.${id}&holat=eq.tasdiq_kutilmoqda`, { method: 'PATCH', body: JSON.stringify({ holat: 'bekor' }) });
    await jav(r && r.length ? '❌ Bekor qilindi' : 'Allaqachon hal qilingan');
    await xabarYangila(env, cq, '❌ Bekor qilindi.');
    return;
  }

  const hozir = Date.now();
  const band = (await sb(env, `nashr_navbati?turi=eq.instagram_karusel&holat=in.(kutilmoqda,bajarilmoqda)&id=neq.${id}&select=nashr_vaqti`).catch(() => [])) || [];
  const vaqt = nashrVaqtiTanla(Date.parse(q.nashr_vaqti), hozir, band.map((x) => Date.parse(x.nashr_vaqti)).filter(Boolean));
  const payload = { ...(q.payload || {}), adminChatId: (q.payload && q.payload.adminChatId) || cq.message.chat.id };
  const r = await sb(env, `nashr_navbati?id=eq.${id}&holat=eq.tasdiq_kutilmoqda`, {
    method: 'PATCH', body: JSON.stringify({ holat: 'kutilmoqda', nashr_vaqti: new Date(vaqt).toISOString(), payload }),
  });
  if (!r || !r.length) { await jav('Allaqachon hal qilingan'); return; }
  const surildi = Math.abs(vaqt - Date.parse(q.nashr_vaqti)) > 60e3;
  await jav('✅ Tasdiqlandi');
  await xabarYangila(env, cq, `✅ Tasdiqlandi — ${toshVaqt(vaqt)} da joylanadi${surildi ? ' (reja vaqti o\'tib ketgan edi — keyingi bo\'sh slotga ko\'chirildi)' : ''}.`);
}
