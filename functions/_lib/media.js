// Render (bepul tarif) uxlab qolishi mumkin -- avval /health bilan uyg'otamiz,
// keyin 2 marta urinamiz. Muvaffaqiyatsiz bo'lsa adminga ANIQ xabar beramiz.
export async function tgSend(token, chatId, text) {
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function mediaUygot(env, ms = 50000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(`${env.MEDIA_SERVER_URL}/health`, { signal: AbortSignal.timeout(10000) });
      if (r.ok) return true;
    } catch (e) { /* uxlayapti -- qayta urinamiz */ }
  }
  return false;
}

// Asosiy server (kompyuter, tunnel) javob bermasa -- zaxira (Render) ishlatiladi
export async function mediaBaza(env) {
  if (!env.MEDIA_SERVER_URL_ZAXIRA || env.MEDIA_SERVER_URL_ZAXIRA === env.MEDIA_SERVER_URL) return env.MEDIA_SERVER_URL;
  try {
    const r = await fetch(`${env.MEDIA_SERVER_URL}/health`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) return env.MEDIA_SERVER_URL;
  } catch (e) { /* asosiy o'chiq */ }
  return env.MEDIA_SERVER_URL_ZAXIRA;
}

export async function mediaChaqir(env, yol, body, adminChatId) {
  if (!env.MEDIA_SERVER_URL || !env.MEDIA_SECRET) return { ok: false, sabab: 'MEDIA_SERVER_URL/MEDIA_SECRET sozlanmagan' };
  let sabab = '';
  const baza = await mediaBaza(env);
  for (let urinish = 0; urinish < 2; urinish++) {
    try {
      const r = await fetch(`${baza}${yol}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Media-Secret': env.MEDIA_SECRET },
        body: JSON.stringify({ ...body, _env: { SUPABASE_URL: env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY, MIJOZ_BOT_TOKEN: env.MIJOZ_BOT_TOKEN, GEMINI_API_KEY: env.GEMINI_API_KEY, INSTAGRAM_ACCESS_TOKEN: env.INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID: env.INSTAGRAM_BUSINESS_ACCOUNT_ID, FACEBOOK_PAGE_ID: env.FACEBOOK_PAGE_ID, TELEGRAM_CHANNEL_ID: env.TELEGRAM_CHANNEL_ID } }), signal: AbortSignal.timeout(urinish ? 40000 : 15000),
      });
      if (r.ok) return { ok: true };
      sabab = `HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 160)}`;
      if (r.status === 401 || r.status === 400) break;
    } catch (e) { sabab = String((e && e.message) || e); }
    if (urinish === 0) await mediaUygot(env, 30000);
  }
  if (adminChatId) {
    await tgSend(env.MIJOZ_BOT_TOKEN, adminChatId,
      `⚠️ Media-server javob bermadi (${yol}): ${sabab}.\nRender bepul tarifi uxlab qolgan bo'lishi mumkin -- 1 daqiqadan so'ng qayta bosing.`).catch(() => {});
  }
  return { ok: false, sabab };
}


// Animatsiya buyurtmasi: ish navbatga yoziladi; server o'chib (OOM/uxlash) video kelmasa, cron 3 martagacha qayta boshlaydi.
export async function animatsiyaBuyurtma(env, adminChatId, mavzu, korsatma) {
  let ishId = null;
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/nashr_navbati`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify([{ turi: 'animatsiya_ish', holat: 'kutilmoqda', nashr_vaqti: new Date(Date.now() + 9 * 60e3).toISOString(), payload: { adminChatId, mavzu: mavzu || null, korsatma: korsatma || null, urinish: 1 } }]),
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) { const j = await r.json(); ishId = j && j[0] && j[0].id; }
  } catch (e) { /* navbatsiz ham ishlaydi */ }
  return mediaChaqir(env, '/animatsion', { adminChatId, mavzu: mavzu || undefined, korsatma: korsatma || undefined, ishId: ishId || undefined }, adminChatId);
}
