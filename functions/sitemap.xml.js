// /sitemap.xml — bazadan real vaqtda o'qib, avtomatik yasaladi.
// Yangi loyiha qo'shilganda qo'lda tahrirlash shart emas — o'zi yangilanadi.
// DIQQAT: repo root'dagi statik sitemap.xml fayli o'chirilishi kerak, aks holda
// Cloudflare Pages statik faylni bu funksiyadan ustun qo'yadi.

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// /sitemap.xml — bazadan real vaqtda o'qib, avtomatik yasaladi.
// Yangi loyiha qo'shilganda qo'lda tahrirlash shart emas — o'zi yangilanadi.
// DIQQAT: repo root'dagi statik sitemap.xml fayli o'chirilishi kerak, aks holda
// Cloudflare Pages statik faylni bu funksiyadan ustun qo'yadi.

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function onRequestGet({ env }) {
  const base = 'https://visartdesign.uz';
  let rows = [];
  try {
    const res = await env.DB.prepare(
      'SELECT * FROM projects ORDER BY sort_order ASC, id ASC'
    ).all();
    rows = (res.results || []).filter((r) => r.slug || r.slug_ru);
  } catch (e) {
    rows = [];
  }

  const entries = [];
  entries.push(`  <url>\n    <loc>${base}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`);
  entries.push(`  <url>\n    <loc>${base}/maxfiylik/</loc>\n    <changefreq>yearly</changefreq>\n    <priority>0.2</priority>\n  </url>`);

  for (const r of rows) {
    const uzUrl = r.slug ? `${base}/loyihalar/${r.slug}` : null;
    const ruUrl = r.slug_ru ? `${base}/ru/proekty/${encodeURIComponent(r.slug_ru)}` : null;
    const lastmod = r.created_at ? String(r.created_at).slice(0, 10) : '';

    if (uzUrl) {
      entries.push(`  <url>
    <loc>${esc(uzUrl)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <xhtml:link rel="alternate" hreflang="uz" href="${esc(uzUrl)}"/>
    ${ruUrl ? `<xhtml:link rel="alternate" hreflang="ru" href="${esc(ruUrl)}"/>` : ''}
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }
    if (ruUrl) {
      entries.push(`  <url>
    <loc>${esc(ruUrl)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    ${uzUrl ? `<xhtml:link rel="alternate" hreflang="uz" href="${esc(uzUrl)}"/>` : ''}
    <xhtml:link rel="alternate" hreflang="ru" href="${esc(ruUrl)}"/>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
export async function onRequestGet({ env }) {
  const base = 'https://visartdesign.uz';
  let rows = [];
  try {
    const res = await env.DB.prepare(
      "SELECT slug, slug_ru, created_at FROM projects WHERE slug IS NOT NULL OR slug_ru IS NOT NULL"
    ).all();
    rows = res.results || [];
  } catch (e) {
    rows = [];
  }

  const entries = [];
  entries.push(`  <url>\n    <loc>${base}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`);
  entries.push(`  <url>\n    <loc>${base}/maxfiylik/</loc>\n    <changefreq>yearly</changefreq>\n    <priority>0.2</priority>\n  </url>`);

  for (const r of rows) {
    const uzUrl = r.slug ? `${base}/loyihalar/${r.slug}` : null;
    const ruUrl = r.slug_ru ? `${base}/ru/proekty/${encodeURIComponent(r.slug_ru)}` : null;
    const lastmod = r.created_at ? String(r.created_at).slice(0, 10) : '';

    if (uzUrl) {
      entries.push(`  <url>
    <loc>${esc(uzUrl)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <xhtml:link rel="alternate" hreflang="uz" href="${esc(uzUrl)}"/>
    ${ruUrl ? `<xhtml:link rel="alternate" hreflang="ru" href="${esc(ruUrl)}"/>` : ''}
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }
    if (ruUrl) {
      entries.push(`  <url>
    <loc>${esc(ruUrl)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    ${uzUrl ? `<xhtml:link rel="alternate" hreflang="uz" href="${esc(uzUrl)}"/>` : ''}
    <xhtml:link rel="alternate" hreflang="ru" href="${esc(ruUrl)}"/>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
