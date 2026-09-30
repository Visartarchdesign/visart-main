// /api/admin/projects — GET (ro'yxat), POST (yangi loyiha)
import { json } from '../../_lib/auth.js';
import { slugifyUz, slugifyRu, ensureUniqueSlug } from '../../_lib/slug.js';
import { buildValues } from '../../_lib/projectFields.js';

export async function onRequestGet({ env }) {
  try {
    const res = await env.DB.prepare('SELECT * FROM projects ORDER BY sort_order ASC, id ASC').all();
    return json({ ok: true, projects: res.results });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    const required = ['category', 'status', 'title_uz', 'title_ru', 'type_uz', 'type_ru', 'thumb_url', 'hero_url'];
    for (const f of required) {
      if (!b[f]) return json({ ok: false, error: 'missing_field', field: f }, 400);
    }
    const v = buildValues(b);
    v.slug = await ensureUniqueSlug(env, slugifyUz(v.title_uz), 'slug', null);
    v.slug_ru = await ensureUniqueSlug(env, slugifyRu(v.title_ru), 'slug_ru', null);
    const cols = Object.keys(v);
    const result = await env.DB.prepare(
      `INSERT INTO projects (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    ).bind(...cols.map((c) => v[c])).run();
    return json({ ok: true, id: result.meta.last_row_id, slug: v.slug, slug_ru: v.slug_ru });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}
