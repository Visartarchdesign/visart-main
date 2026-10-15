// Render (bepul tarif) uxlab qolishi mumkin -- avval /health bilan uyg'otamiz,
// keyin 2 marta urinamiz. Muvaffaqiyatsiz bo'lsa adminga ANIQ xabar beramiz.
async function tgSend(token, chatId, text) {
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

export async function mediaChaqir(env, yol, body, adminChatId) {
  if (!env.MEDIA_SERVER_URL || !env.MEDIA_SECRET) return { ok: false, sabab: 'MEDIA_SERVER_URL/MEDIA_SECRET sozlanmagan' };
  let sabab = '';
  for (let urinish = 0; urinish < 2; urinish++) {
    try {
      const r = await fetch(`${env.MEDIA_SERVER_URL}${yol}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Media-Secret': env.MEDIA_SECRET },
        body: JSON.stringify({ ...body, _env: { SUPABASE_URL: env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY, MIJOZ_BOT_TOKEN: env.MIJOZ_BOT_TOKEN, GEMINI_API_KEY: env.GEMINI_API_KEY } }), signal: AbortSignal.timeout(urinish ? 40000 : 15000),
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
