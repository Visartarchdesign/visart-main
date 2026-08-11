// GET /api/content — asosiy sayt uchun ochiq (public) kontent API.
import { json } from '../_lib/auth.js';

export async function onRequestGet({ env }) {
  try {
    const projectsRes = await env.DB.prepare(
      'SELECT * FROM projects ORDER BY sort_order ASC, id ASC'
    ).all();
    const testimonialsRes = await env.DB.prepare(
      'SELECT * FROM testimonials ORDER BY sort_order ASC, id ASC'
    ).all();
    const settingsRes = await env.DB.prepare('SELECT key, value FROM settings').all();

    const settings = {};
    for (const row of settingsRes.results) settings[row.key] = row.value;

    const projects = projectsRes.results.map((p) => ({
      id: p.id,
      cat: p.category,
      status: p.status,
      title: { uz: p.title_uz, ru: p.title_ru },
      type: { uz: p.type_uz, ru: p.type_ru },
      desc: { uz: p.desc_uz, ru: p.desc_ru },
      thumb: p.thumb_url,
      hero: p.hero_url,
      gallery: JSON.parse(p.gallery_urls || '[]'),
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

    return json({
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
  } catch (e) {
    return json({ ok: false, error: 'db_error', message: String(e) }, 500);
  }
}
