// GET /api/content — asosiy sayt uchun ochiq (public) kontent API.
import { json } from '../_lib/auth.js';

export async function onRequestGet({ env }) {
  try {
    const [projectsRes, testimonialsRes, settingsRes] = await Promise.all([
      env.DB.prepare('SELECT * FROM projects ORDER BY sort_order ASC, id ASC').all(),
      env.DB.prepare('SELECT * FROM testimonials ORDER BY sort_order ASC, id ASC').all(),
      env.DB.prepare('SELECT key, value FROM settings').all(),
    ]);

    const settings = {};
    for (const row of settingsRes.results) settings[row.key] = row.value;

    const projects = projectsRes.results.map((p) => ({
      id: p.id,
      cat: p.category,
      status: p.status,
      slug: p.slug || '',
      slugRu: p.slug_ru || '',
      title: { uz: p.title_uz, ru: p.title_ru },
      type: { uz: p.type_uz, ru: p.type_ru },
      desc: { uz: p.desc_uz, ru: p.desc_ru },
      thumb: p.thumb_url,
      hero: p.hero_url,
      gallery: JSON.parse(p.gallery_urls || '[]'),
      area: p.area_m2 || null,
      year: p.year || null,
      location: { uz: p.location_uz || '', ru: p.location_ru || '' },
      style: { uz: p.style_uz || '', ru: p.style_ru || '' },
      duration: { uz: p.duration_uz || '', ru: p.duration_ru || '' },
      alts: (() => { try { return JSON.parse(p.alts_json || '{}') || {}; } catch (e) { return {}; } })(),
    }));

    const testimonials = testimonialsRes.results.map((t) => ({
      id: t.id,
      name: t.name,
      role: { uz: t.role_uz, ru: t.role_ru },
      quote: { uz: t.quote_uz, ru: t.quote_ru },
      stars: t.stars,
    }));

    let pricing = null;
    try {
      pricing = JSON.parse(settings.pricing_json || '{}');
    } catch (e) {
      pricing = null;
    }

    const res = json({
      ok: true,
      projects,
      testimonials,
      pricing,
      settings: {
        phone: settings.phone,
        email: settings.email,
        telegram: settings.telegram,
        telegram_personal: settings.telegram_personal,
        instagram: settings.instagram,
        youtube: settings.youtube,
        address: { uz: settings.address_uz, ru: settings.address_ru },
        stats: { years: settings.stats_years, projects: settings.stats_projects },
      },
    });
    res.headers.set('Cache-Control', 'public, max-age=30, s-maxage=120, stale-while-revalidate=600');
    return res;
  } catch (e) {
    return json({ ok: false, error: 'db_error', message: String(e) }, 500);
  }
}
