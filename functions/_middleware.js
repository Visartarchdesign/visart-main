// Bosh sahifaga admin paneldagi "Sayt ko'rinishi / SEO / FAQ" sozlamalarini qo'llaydi.
// Boshqa barcha so'rovlar o'zgarishsiz o'tadi.
import { applySite } from './_lib/applySite.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const isHome = request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html');
  const response = await next();
  if (!isHome || !env.DB) return response;
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return response;
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'site_json'").first();
    if (!row || !row.value) return response;
    const site = JSON.parse(row.value);
    if (!site || typeof site !== 'object') return response;
    return applySite(response, site);
  } catch (e) {
    return response; // xatolik bo'lsa, sayt standart holatda ochilaveradi
  }
}
