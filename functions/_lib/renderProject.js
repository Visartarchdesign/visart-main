// Har bir loyiha uchun mustaqil, qidiruv tizimlari indekslay oladigan HTML sahifa yasaydi.
// UZ (/loyihalar/:slug) va RU (/ru/proekty/:slug) ikkalasi ham shu funksiyadan foydalanadi.

const CAT = {
  interior: { uz: 'Interyer dizayn', ru: 'Дизайн интерьера', tag: { uz: 'Interyer', ru: 'Интерьер' } },
  architecture: { uz: 'Arxitektura loyihasi', ru: 'Архитектурный проект', tag: { uz: 'Arxitektura', ru: 'Архитектура' } },
  drawings: { uz: 'Ishchi chizmalar', ru: 'Рабочие чертежи', tag: { uz: 'Chizmalar', ru: 'Чертежи' } },
};
const BADGE = {
  render: { uz: '3D konsept', ru: '3D-концепт' },
  done: { uz: 'Amalga oshirilgan', ru: 'Реализован' },
};
const UI = {
  uz: {
    home: 'Bosh sahifa', projects: 'Loyihalar', otherLang: 'RU', city: 'Toshkent',
    ctaTitle: "Shunga o'xshash loyiha kerakmi?", ctaText: 'Bepul konsultatsiyada taxminiy narx va muddatni aytib beramiz.',
    cta: 'Bepul konsultatsiya', calc: 'Narxni hisoblash', back: 'Barcha loyihalar', related: "O'xshash loyihalar",
    facts: { type: 'Xizmat', style: 'Uslub', area: 'Maydon', location: 'Joylashuv', year: 'Yil', duration: 'Muddat', status: 'Holati' },
    task: 'Vazifa', gallery: 'Galereya',
  },
  ru: {
    home: 'Главная', projects: 'Проекты', otherLang: 'UZ', city: 'Ташкент',
    ctaTitle: 'Нужен похожий проект?', ctaText: 'На бесплатной консультации назовём примерную стоимость и сроки.',
    cta: 'Бесплатная консультация', calc: 'Рассчитать стоимость', back: 'Все проекты', related: 'Похожие проекты',
    facts: { type: 'Услуга', style: 'Стиль', area: 'Площадь', location: 'Расположение', year: 'Год', duration: 'Срок', status: 'Статус' },
    task: 'Задача', gallery: 'Галерея',
  },
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function abs(url, base) {
  if (!url) return '';
  return /^https?:\/\//.test(url) ? url : `${base}/${String(url).replace(/^\//, '')}`;
}
function pick(row, key, lang) {
  return (row[`${key}_${lang}`] || '').trim();
}
export function projectUrl(row, lang, base = 'https://visartdesign.uz') {
  if (lang === 'ru') return row.slug_ru ? `${base}/ru/proekty/${encodeURIComponent(row.slug_ru)}` : null;
  return row.slug ? `${base}/loyihalar/${row.slug}` : null;
}

export function renderProjectPage({ row, lang, related = [], baseUrl = 'https://visartdesign.uz' }) {
  const homeUrl = lang === 'ru' ? `${baseUrl}/ru/` : `${baseUrl}/`;
  const t = UI[lang];
  const title = pick(row, 'title', lang);
  const type = pick(row, 'type', lang) || (CAT[row.category] ? CAT[row.category][lang] : '');
  const desc = pick(row, 'desc', lang);
  const style = pick(row, 'style', lang);
  const location = pick(row, 'location', lang);
  const duration = pick(row, 'duration', lang);
  const task = pick(row, 'task', lang);
  const area = row.area_m2 ? `${row.area_m2} m²` : '';
  const year = row.year ? String(row.year) : '';
  const badge = BADGE[row.status] ? BADGE[row.status][lang] : '';
  const catTag = CAT[row.category] ? CAT[row.category].tag[lang] : '';
  const gallery = (() => { try { return JSON.parse(row.gallery_urls || '[]'); } catch (e) { return []; } })();
  const alts = (() => { try { return JSON.parse(row.alts_json || '{}') || {}; } catch (e) { return {}; } })();
  const altFor = (url, fallback) => { const x = alts[url]; return (x && (x[lang] || x.uz || x.ru)) || fallback; };

  const selfUrl = projectUrl(row, lang, baseUrl);
  const uzUrl = projectUrl(row, 'uz', baseUrl);
  const ruUrl = projectUrl(row, 'ru', baseUrl);
  const otherUrl = lang === 'uz' ? ruUrl : uzUrl;
  const heroAbs = abs(row.hero_url || row.thumb_url, baseUrl);
  const place = location || t.city;

  // Sarlavha: "Nomi — Xizmat, Joy | VISART" (60 belgigacha maqsad)
  const pageTitle = `${title} — ${type}, ${place} | Visart Design`;
  // Meta tavsif: dalillar + tavsif boshi, 155 belgigacha
  const factBits = [style && `${style}`, area, location, year].filter(Boolean).join(', ');
  let metaDesc = `${title}: ${type.toLowerCase()}${factBits ? ` (${factBits})` : ''}. ${desc}`;
  if (metaDesc.length > 158) metaDesc = metaDesc.slice(0, 155).replace(/\s+\S*$/, '') + '…';
  const imgAlt = `${title} — ${type}${style ? `, ${style.toLowerCase()} uslub` : ''}, ${place}`;
  const imgAltRu = `${title} — ${type}${style ? `, стиль ${style.toLowerCase()}` : ''}, ${place}`;
  const alt = lang === 'uz' ? imgAlt : imgAltRu;

  const tags = [catTag, style, place, 'Visart Design'].filter(Boolean);
  const facts = [
    [t.facts.type, type], [t.facts.style, style], [t.facts.area, area], [t.facts.location, location],
    [t.facts.year, year], [t.facts.duration, duration], [t.facts.status, badge],
  ].filter(([, v]) => v);

  const images = [heroAbs, ...gallery.map((g) => abs(g, baseUrl))];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: title,
    headline: `${title} — ${type}`,
    description: metaDesc,
    image: images,
    url: selfUrl,
    inLanguage: lang === 'uz' ? 'uz-UZ' : 'ru-RU',
    genre: type,
    keywords: tags.join(', '),
    ...(year ? { dateCreated: year } : {}),
    ...(location ? { locationCreated: { '@type': 'Place', name: `${location}, ${t.city}` } } : {}),
    creator: { '@type': 'Organization', name: 'Visart Design', url: `${baseUrl}/` },
    publisher: { '@type': 'Organization', name: 'Visart Design', logo: { '@type': 'ImageObject', url: `${baseUrl}/assets/logo-full.png` } },
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.home, item: homeUrl },
      { '@type': 'ListItem', position: 2, name: t.projects, item: `${baseUrl}/#projects` },
      { '@type': 'ListItem', position: 3, name: title, item: selfUrl },
    ],
  };

  const hreflang = [
    uzUrl && `<link rel="alternate" hreflang="uz" href="${uzUrl}">`,
    ruUrl && `<link rel="alternate" hreflang="ru" href="${ruUrl}">`,
    uzUrl && `<link rel="alternate" hreflang="x-default" href="${uzUrl}">`,
  ].filter(Boolean).join('\n');

  const galleryHtml = gallery
    .map((g, i) => `<figure><img src="${esc(abs(g, baseUrl))}" alt="${esc(altFor(g, `${alt} — ${i + 2}`))}" loading="lazy" decoding="async"></figure>`)
    .join('\n');

  const relatedHtml = related
    .map((r) => {
      const u = projectUrl(r, lang, baseUrl);
      if (!u) return '';
      return `<a class="rel" href="${u}"><img src="${esc(abs(r.thumb_url, baseUrl))}" alt="${esc(pick(r, 'title', lang))}" loading="lazy"><span>${esc(pick(r, 'title', lang))}</span><small>${esc(pick(r, 'type', lang))}</small></a>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(pageTitle)}</title>
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="description" content="${esc(metaDesc)}">
<link rel="canonical" href="${selfUrl}">
${hreflang}
<meta property="og:site_name" content="Visart Design">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)} — ${esc(type)}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:image" content="${esc(heroAbs)}">
<meta property="og:image:alt" content="${esc(alt)}">
<meta property="og:url" content="${selfUrl}">
<meta property="og:locale" content="${lang === 'uz' ? 'uz_UZ' : 'ru_RU'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)} — ${esc(type)}">
<meta name="twitter:description" content="${esc(metaDesc)}">
<meta name="twitter:image" content="${esc(heroAbs)}">
<link rel="icon" type="image/x-icon" href="${baseUrl}/assets/favicon.ico">
<link rel="preload" as="image" href="${esc(heroAbs)}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@500;600&display=swap" rel="stylesheet">
<style>
:root{--gold:#A9895A;--gold-l:#C4A876;--ink:#151412;--paper:#FCFBF9;--t1:#151412;--t2:#4F4C43;--t3:#6B675C;--line:#E7E3D9;--serif:'Playfair Display',serif;--sans:'Inter',sans-serif}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--sans);background:var(--paper);color:var(--t1);-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}a{color:inherit;text-decoration:none}
.wrap{max-width:1120px;margin:0 auto;padding:0 32px}
header{background:var(--ink);position:sticky;top:0;z-index:10}
header .wrap{display:flex;align-items:center;justify-content:space-between;height:66px}
.brand{display:flex;align-items:center;gap:10px;color:#fff;font-family:var(--serif);letter-spacing:1px}
.brand img{width:28px}
.hnav{display:flex;align-items:center;gap:18px}
.hnav a{color:#B8B2A0;font-size:13px}.hnav a:hover{color:var(--gold-l)}
.hnav .lang{border:0.5px solid rgba(255,255,255,.3);border-radius:3px;padding:5px 11px;color:#fff;font-weight:600;font-size:12px}
.hero{position:relative;height:min(78vh,720px);overflow:hidden;background:var(--ink)}
.hero img{width:100%;height:100%;object-fit:cover}
.hero::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(21,20,18,.05) 40%,rgba(21,20,18,.85) 100%)}
.hero-cap{position:absolute;left:0;right:0;bottom:0;z-index:2;padding-bottom:48px;color:#fff}
.crumbs{font-size:12px;color:#D9CBAE;margin-bottom:16px;opacity:.9}.crumbs a:hover{color:#fff}
.badge{display:inline-block;background:rgba(252,251,249,.94);color:#5C594F;font-size:10.5px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;padding:6px 12px;border-radius:2px;margin-bottom:16px}
h1{font-family:var(--serif);font-weight:600;font-size:clamp(30px,4.6vw,54px);line-height:1.15;max-width:820px}
.sub{margin-top:10px;font-size:15px;color:#E4DED0}
.body{display:grid;grid-template-columns:1.6fr 1fr;gap:64px;padding:72px 0 40px}
.desc p{font-size:16.5px;line-height:1.85;color:var(--t2);margin-bottom:18px}
.desc h2{font-family:var(--serif);font-size:22px;font-weight:600;margin:30px 0 12px}
.facts{border-top:0.5px solid var(--line)}
.facts div{display:flex;justify-content:space-between;gap:16px;padding:15px 0;border-bottom:0.5px solid var(--line);font-size:14px}
.facts dt{color:var(--t3)}.facts dd{font-weight:500;text-align:right}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
.tags span{font-size:12px;color:var(--t2);border:0.5px solid var(--line);border-radius:16px;padding:5px 12px}
.side-cta{margin-top:26px;display:flex;flex-direction:column;gap:10px}
.btn{display:inline-flex;justify-content:center;align-items:center;padding:14px 22px;font-size:13px;font-weight:600;border-radius:2px;transition:all .2s}
.btn-gold{background:var(--gold);color:var(--ink)}.btn-gold:hover{background:var(--gold-l)}
.btn-line{border:0.5px solid var(--t1)}.btn-line:hover{background:var(--t1);color:#fff}
.gallery{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;padding-bottom:72px}
.gallery figure:first-child:nth-last-child(odd),.gallery figure:only-child{grid-column:1/-1}
.gallery img{width:100%;height:100%;max-height:640px;object-fit:cover;border-radius:3px}
.cta{background:var(--ink);color:#fff;text-align:center;padding:80px 24px}
.cta h2{font-family:var(--serif);font-weight:500;font-size:clamp(26px,3.4vw,38px);margin-bottom:12px}
.cta p{color:#B8B2A0;margin-bottom:28px}
.cta .row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.cta .btn-line{border-color:rgba(255,255,255,.6);color:#fff}.cta .btn-line:hover{background:#fff;color:var(--ink)}
.related{padding:72px 0}
.related h2{font-family:var(--serif);font-size:28px;font-weight:500;margin-bottom:28px}
.rel-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.rel img{aspect-ratio:4/3;object-fit:cover;border-radius:3px;margin-bottom:12px;transition:opacity .2s}.rel:hover img{opacity:.85}
.rel span{display:block;font-weight:600;font-size:15px}.rel small{color:var(--t3);font-size:12.5px}
footer{background:var(--ink);color:#8C8676;font-size:12.5px;padding:30px 0}
footer .wrap{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}
footer a:hover{color:var(--gold-l)}
@media(max-width:820px){.body{grid-template-columns:1fr;gap:36px;padding:48px 0 28px}.gallery{grid-template-columns:1fr}.rel-grid{grid-template-columns:1fr 1fr}.wrap{padding:0 20px}.hnav a.hide-m{display:none}}
@media(max-width:520px){.rel-grid{grid-template-columns:1fr}.hero{height:62vh}}
</style>
</head>
<body>
<header><div class="wrap">
  <a href="${homeUrl}" class="brand"><img src="${baseUrl}/assets/logo-mark.png" alt="">VISART</a>
  <nav class="hnav">
    <a class="hide-m" href="${homeUrl}#projects">${esc(t.projects)}</a>
    <a class="hide-m" href="${homeUrl}#pricing">${esc(t.calc)}</a>
    ${otherUrl ? `<a class="lang" href="${otherUrl}" hreflang="${lang === 'uz' ? 'ru' : 'uz'}">${t.otherLang}</a>` : ''}
  </nav>
</div></header>
<main>
  <section class="hero">
    <img src="${esc(heroAbs)}" alt="${esc(altFor(row.hero_url, alt))}" fetchpriority="high">
    <div class="hero-cap"><div class="wrap">
      <nav class="crumbs" aria-label="breadcrumb"><a href="${homeUrl}">${esc(t.home)}</a> / <a href="${homeUrl}#projects">${esc(t.projects)}</a> / ${esc(title)}</nav>
      ${badge ? `<span class="badge">${esc(badge)}</span>` : ''}
      <h1>${esc(title)}</h1>
      <p class="sub">${esc([type, style, location || t.city].filter(Boolean).join(' · '))}</p>
    </div></div>
  </section>
  <div class="wrap body">
    <article class="desc">
      ${desc.split(/\n{2,}|\r\n\r\n/).map((para) => `<p>${esc(para)}</p>`).join('')}
      ${task ? `<h2>${esc(t.task)}</h2><p>${esc(task)}</p>` : ''}
    </article>
    <aside>
      <dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <div class="tags">${tags.map((g) => `<span>#${esc(g)}</span>`).join('')}</div>
      <div class="side-cta">
        <a class="btn btn-gold" href="${homeUrl}#contact">${esc(t.cta)}</a>
        <a class="btn btn-line" href="${homeUrl}#pricing">${esc(t.calc)}</a>
      </div>
    </aside>
  </div>
  ${galleryHtml ? `<section class="wrap gallery" aria-label="${esc(t.gallery)}">${galleryHtml}</section>` : ''}
  <section class="cta">
    <h2>${esc(t.ctaTitle)}</h2>
    <p>${esc(t.ctaText)}</p>
    <div class="row"><a class="btn btn-gold" href="${homeUrl}#contact">${esc(t.cta)}</a><a class="btn btn-line" href="${homeUrl}#projects">${esc(t.back)}</a></div>
  </section>
  ${relatedHtml ? `<section class="wrap related"><h2>${esc(t.related)}</h2><div class="rel-grid">${relatedHtml}</div></section>` : ''}
</main>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} Visart Design · ${lang === 'uz' ? "Toshkent, Uchtepa tumani, Foziltepa ko'chasi" : 'Ташкент, Учтепинский р-н, ул. Фозилтепа'}</span><span><a href="tel:+998974021515">+998 97 402 15 15</a> · <a href="${baseUrl}/maxfiylik/">${lang === 'uz' ? 'Maxfiylik siyosati' : 'Конфиденциальность'}</a></span></div></footer>
</body>
</html>`;
}

// Brend uslubidagi 404 sahifasini qaytaradi (bo'lmasa oddiy matn).
export async function notFound(env, msg = 'Sahifa topilmadi') {
  try {
    if (env.ASSETS) {
      const r = await env.ASSETS.fetch(new Request('https://visartdesign.uz/404.html'));
      if (r.ok) return new Response(r.body, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
  } catch (e) { /* oddiy javobga o'tamiz */ }
  return new Response(msg, { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
