// Bosh sahifaga admin paneldagi "Sayt ko'rinishi / SEO / FAQ" sozlamalarini qo'llaydi.
// Boshqa ochiq HTML sahifalarga (loyihalar, maxfiylik, 404) faqat analitika kodlari qo'shiladi.
import { applySite, applyAnalytics } from './_lib/applySite.js';
import { TRACKER_SCRIPT } from './_lib/tracker.js';

// Barcha javoblarga asosiy xavfsizlik sarlavhalari (Functions javoblariga _headers qo'llanmaydi).
function secure(res) {
  try {
    const r = new Response(res.body, res);
    r.headers.set('X-Frame-Options', 'SAMEORIGIN');
    r.headers.set('Content-Security-Policy', "frame-ancestors 'self'");
    r.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    r.headers.set('Strict-Transport-Security', 'max-age=15552000');
    r.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    if (!r.headers.has('X-Content-Type-Options')) r.headers.set('X-Content-Type-Options', 'nosniff');
    if (!r.headers.has('Referrer-Policy')) r.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return r;
  } catch (e) { return res; }
}

// Ichki statistika skriptini barcha ochiq HTML sahifalarga qo'shadi.
function withTracker(res) {
  try {
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') || res.status >= 400 && res.status !== 404) return res;
    return new HTMLRewriter()
      .on('head', { element(el) { el.append('<script>' + TRACKER_SCRIPT + '</script>', { html: true }); } })
      .transform(res);
  } catch (e) { return res; }
}

export async function onRequest(context) {
  const res = await handle(context);
  const u = new URL(context.request.url);
  const track = context.request.method === 'GET' && context.env.DB &&
    !u.pathname.startsWith('/admin') && !u.pathname.startsWith('/api/');
  return secure(track ? withTracker(res) : res);
}

async function handle(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const response = await next();
  if (request.method !== 'GET' || !env.DB) return response;
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/')) return response;
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return response;
  const isRu = url.pathname === '/ru/' || url.pathname === '/ru';
  const isHome = isRu || url.pathname === '/' || url.pathname === '/index.html';
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'site_json'").first();
    if (!row || !row.value) return response;
    const site = JSON.parse(row.value);
    if (!site || typeof site !== 'object') return response;
    if (!isHome) return applyAnalytics(response, site);
    let projects = [];
    try {
      const pr = await env.DB.prepare('SELECT slug, slug_ru, title_uz, title_ru FROM projects ORDER BY sort_order ASC, id ASC').all();
      projects = pr.results || [];
    } catch (e) { /* havolalarsiz davom etadi */ }
    return applySite(response, site, isRu ? 'ru' : 'uz', projects);
  } catch (e) {
    return response; // xatolik bo'lsa, sayt standart holatda ochilaveradi
  }
}
