// /ru/proekty/:slug — ruscha (kirill URL) versiya.
import { renderProjectPage, notFound } from '../../_lib/renderProject.js';

export async function onRequestGet({ params, env }) {
  try {
    // Kirill harfli manzil kodlangan holda kelishi mumkin — dekodlaymiz.
    let slug = String(params.slug || '');
    try { slug = decodeURIComponent(slug); } catch (e) { /* o'zgarishsiz qoldiramiz */ }
    const row = await env.DB.prepare('SELECT * FROM projects WHERE slug_ru = ?').bind(slug).first();
    if (!row) return notFound(env);
    const rel = await env.DB.prepare(
      'SELECT * FROM projects WHERE id != ? ORDER BY (category = ?) DESC, sort_order ASC LIMIT 3'
    ).bind(row.id, row.category).all();
    const html = renderProjectPage({ row, lang: 'ru', related: rel.results || [] });
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  } catch (e) {
    return new Response('Ошибка сервера', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
