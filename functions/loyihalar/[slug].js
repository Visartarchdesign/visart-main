// /loyihalar/:slug — har bir loyihaning o'zbekcha, qidiruv tizimi indekslay oladigan sahifasi.
import { renderProjectPage, notFound } from '../_lib/renderProject.js';

export async function onRequestGet({ params, env }) {
  try {
    const row = await env.DB.prepare('SELECT * FROM projects WHERE slug = ?').bind(params.slug).first();
    if (!row) return notFound(env);
    const rel = await env.DB.prepare(
      'SELECT * FROM projects WHERE id != ? ORDER BY (category = ?) DESC, sort_order ASC LIMIT 3'
    ).bind(row.id, row.category).all();
    const html = renderProjectPage({ row, lang: 'uz', related: rel.results || [] });
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  } catch (e) {
    return new Response('Server xatosi', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
