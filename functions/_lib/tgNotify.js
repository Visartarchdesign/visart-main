// Sayt xabarlari (murojaat, parol tiklash kodi) endi asosiy bot (MIJOZ_BOT_TOKEN) orqali ketadi.
// Yangi bot ishlamasa (admin /start bosmagan va h.k.) eski TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID ga qaytadi.
const list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);

export const lidQabulqiluvchilar = (env) => (env.MANAGER_CHAT_ID ? [env.MANAGER_CHAT_ID] : list(env.ADMIN_TELEGRAM_IDS));
export const kodQabulqiluvchilar = (env) => list(env.ADMIN_TELEGRAM_IDS).slice(0, 1);

async function yubor(token, chat, text) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text }), signal: AbortSignal.timeout(10000),
    });
    return r.ok;
  } catch (e) { return false; }
}

// true -- kamida bitta qabul qiluvchiga yetdi
export async function saytXabar(env, qabul, text) {
  let ok = false;
  if (env.MIJOZ_BOT_TOKEN) for (const c of qabul) if (await yubor(env.MIJOZ_BOT_TOKEN, c, text)) ok = true;
  if (!ok && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) ok = await yubor(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, text);
  return ok;
}
export const sozlanganmi = (env) => !!((env.MIJOZ_BOT_TOKEN && (env.ADMIN_TELEGRAM_IDS || env.MANAGER_CHAT_ID)) || (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID));
