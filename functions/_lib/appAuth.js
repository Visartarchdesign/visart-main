// Admin ilova (Telegram Mini App) uchun umumiy: initData tekshiruvi va botga sun'iy update yuborish.
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? new TextEncoder().encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
}
export async function adminTekshir(env, initData) {
  const p = new URLSearchParams(initData || '');
  const hash = p.get('hash'); if (!hash) return null;
  p.delete('hash');
  const s = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  if (hex(await hmac(await hmac('WebAppData', env.MIJOZ_BOT_TOKEN), s)) !== hash) return null;
  if (Date.now() / 1000 - Number(p.get('auth_date') || 0) > 86400) return null;
  let u; try { u = JSON.parse(p.get('user')); } catch { return null; }
  const admins = String(env.ADMIN_TELEGRAM_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
  return u && admins.includes(String(u.id)) ? u : null;
}
export function botUpd(env, request, upd) {
  const uid = Date.now() * 100 + Math.floor(Math.random() * 100);
  return fetch(new URL('/api/mijoz-bot', request.url).href, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': env.MIJOZ_BOT_SECRET || '' }, body: JSON.stringify({ update_id: uid, ...upd }), signal: AbortSignal.timeout(110000) }).catch(() => null);
}
