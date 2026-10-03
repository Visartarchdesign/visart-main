// Visart Admin — oddiy service worker: ilova sifatida o'rnatish va tezroq ochilish uchun.
// /api/* so'rovlari hech qachon keshlanmaydi (ma'lumot doim yangi bo'ladi).
const CACHE = 'visart-admin-v1';
const SHELL = ['/admin/', '/admin/icon-192.png', '/admin/icon-512.png', '/admin/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (!url.pathname.startsWith('/admin')) return;
  // Sahifa: avval tarmoq, internet bo'lmasa — saqlangan nusxa.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put('/admin/', cp)); }
      return r;
    }).catch(() => caches.match('/admin/')));
    return;
  }
  // Rasm va boshqa statik fayllar: keshdan, yo'q bo'lsa tarmoqdan.
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
