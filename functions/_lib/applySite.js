// Admin paneldagi "Sayt ko'rinishi / SEO / FAQ va xizmatlar" sozlamalarini bosh sahifa HTML'iga
// server tomonida yozadi (HTMLRewriter). Natijada rasm/matn "sakramaydi" va Google yangi matnni ko'radi.

const has = (v) => typeof v === 'string' && v.trim() !== '';
const pairOk = (p) => p && (has(p.uz) || has(p.ru));

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Faqat xavfsiz rasm manzillari: /r2/..., /assets/..., assets/..., https://...
function safeImg(u) {
  if (!has(u)) return '';
  const s = u.trim();
  return /^(https:\/\/|\/|assets\/)[^\s"'<>]+$/.test(s) ? s : '';
}

// Oddiy obyektlar (class emas) — Cloudflare'da ham, test muhitida ham bir xil ishlaydi.
const TextSetter = (text) => ({ element(el) { el.setInnerContent(text, { html: false }); } });
const AttrSetter = (attr, value) => ({ element(el) { el.setAttribute(attr, value); } });
const HtmlSetter = (html) => ({ element(el) { el.setInnerContent(html, { html: true }); } });
const HeadAppender = (html) => ({ element(el) { el.append(html, { html: true }); } });

function setPair(rw, baseSelector, pair) {
  if (!pairOk(pair)) return rw;
  if (has(pair.uz)) rw = rw.on(`${baseSelector} span[data-lang="uz"]`, TextSetter(pair.uz.trim()));
  if (has(pair.ru)) rw = rw.on(`${baseSelector} span[data-lang="ru"]`, TextSetter(pair.ru.trim()));
  return rw;
}

export function buildHeadExtras(seo = {}) {
  let out = '';
  const gsc = has(seo.gsc) && /^[A-Za-z0-9_-]{10,100}$/.test(seo.gsc.trim()) ? seo.gsc.trim() : '';
  const ya = has(seo.yandex) && /^[A-Za-z0-9]{8,64}$/.test(seo.yandex.trim()) ? seo.yandex.trim() : '';
  const ga = has(seo.ga4) && /^G-[A-Z0-9]{4,20}$/.test(seo.ga4.trim()) ? seo.ga4.trim() : '';
  const ym = has(seo.metrika) && /^\d{5,12}$/.test(seo.metrika.trim()) ? seo.metrika.trim() : '';
  if (gsc) out += `<meta name="google-site-verification" content="${gsc}">`;
  if (ya) out += `<meta name="yandex-verification" content="${ya}">`;
  if (ga) {
    out += `<script async src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script>` +
      `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');</script>`;
  }
  if (ym) {
    out += `<script>(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${ym},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true});</script>`;
  }
  return out;
}

export function buildFaqHtml(faq) {
  return faq
    .filter((f) => f && f.q && f.a && has(f.q.uz) && has(f.a.uz))
    .map((f) => `<details><summary><span data-lang="uz" class="lang-active">${esc(f.q.uz)}</span><span data-lang="ru">${esc(f.q.ru || f.q.uz)}</span></summary><div class="faq-a"><span data-lang="uz" class="lang-active">${esc(f.a.uz)}</span><span data-lang="ru">${esc(f.a.ru || f.a.uz)}</span></div></details>`)
    .join('\n');
}

export function buildFaqLd(faq) {
  const items = faq.filter((f) => f && f.q && f.a && has(f.q.uz) && has(f.a.uz));
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q.uz, acceptedAnswer: { '@type': 'Answer', text: f.a.uz } })),
  };
  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

export function applySite(response, site) {
  let rw = new HTMLRewriter();
  const seo = site.seo || {};
  if (has(seo.title)) {
    const t = seo.title.trim();
    rw = rw.on('title', TextSetter(t))
      .on('meta[property="og:title"]', AttrSetter('content', t))
      .on('meta[name="twitter:title"]', AttrSetter('content', t));
  }
  if (has(seo.description)) {
    const d = seo.description.trim();
    rw = rw.on('meta[name="description"]', AttrSetter('content', d))
      .on('meta[property="og:description"]', AttrSetter('content', d))
      .on('meta[name="twitter:description"]', AttrSetter('content', d));
  }
  const extras = buildHeadExtras(seo);
  if (extras) rw = rw.on('head', HeadAppender(extras));

  const hero = site.hero || {};
  const heroImg = safeImg(hero.image);
  if (heroImg) rw = rw.on('#heroImg', AttrSetter('src', heroImg)).on('#heroPreload', AttrSetter('href', heroImg));
  rw = setPair(rw, '.hero h1', hero.title);
  rw = setPair(rw, '.hero-sub', hero.sub);

  const about = site.about || {};
  const aboutImg = safeImg(about.image);
  if (aboutImg) rw = rw.on('#aboutImg', AttrSetter('src', aboutImg));
  rw = setPair(rw, '.about-inner h2', about.title);
  rw = setPair(rw, '.about-text', about.text);

  for (const s of Array.isArray(site.services) ? site.services : []) {
    if (!s || !/^svc-[a-z]+$/.test(s.id || '')) continue;
    rw = setPair(rw, `#${s.id} h3`, s.title);
    if (s.desc && has(s.desc.uz)) rw = rw.on(`#${s.id} .svc-desc > span[data-lang="uz"]`, TextSetter(s.desc.uz.trim()));
    if (s.desc && has(s.desc.ru)) rw = rw.on(`#${s.id} .svc-desc > span[data-lang="ru"]`, TextSetter(s.desc.ru.trim()));
  }

  if (Array.isArray(site.faq) && site.faq.length) {
    const faqHtml = buildFaqHtml(site.faq);
    if (faqHtml) {
      rw = rw.on('#faqList', HtmlSetter(faqHtml)).on('#faqLd', HtmlSetter(buildFaqLd(site.faq)));
    }
  }
  return rw.transform(response);
}
