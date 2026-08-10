// /api/admin/projects — GET (ro'yxat), POST (yangi loyiha)
import { json } from '../../_lib/auth.js';

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
    const gallery = JSON.stringify(b.gallery_urls || []);
    const result = await env.DB.prepare(
      `INSERT INTO projects (category,status,title_uz,title_ru,type_uz,type_ru,desc_uz,desc_ru,thumb_url,hero_url,gallery_urls,sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    )
      .bind(
        b.category,
        b.status,
        b.title_uz,
        b.title_ru,
        b.type_uz,
        b.type_ru,
        b.desc_uz || '',
        b.desc_ru || '',
        b.thumb_url,
        b.hero_url,
        gallery,
        b.sort_order || 0
      )
      .run();
    return json({ ok: true, id: result.meta.last_row_id });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}
