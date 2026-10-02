// Bosh sahifaga admin paneldagi "Sayt ko'rinishi / SEO / FAQ" sozlamalarini qo'llaydi.
// Boshqa ochiq HTML sahifalarga (loyihalar, maxfiylik, 404) faqat analitika kodlari qo'shiladi.
import { applySite, applyAnalytics } from './_lib/applySite.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const response = await next();
  if (request.method !== 'GET' || !env.DB) return response;
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/')) return response;
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return response;
  const isHome = url.pathname === '/' || url.pathname === '/index.html';
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'site_json'").first();
    if (!row || !row.value) return response;
    const site = JSON.parse(row.value);
    if (!site || typeof site !== 'object') return response;
    return isHome ? applySite(response, site) : applyAnalytics(response, site);
  } catch (e) {
    return response; // xatolik bo'lsa, sayt standart holatda ochilaveradi
  }
}
