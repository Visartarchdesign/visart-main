// /api/admin/testimonials — GET (ro'yxat), POST (yangi sharh)
import { json } from '../../_lib/auth.js';

export async function onRequestGet({ env }) {
  try {
    const res = await env.DB.prepare('SELECT * FROM testimonials ORDER BY sort_order ASC, id ASC').all();
    return json({ ok: true, testimonials: res.results });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    const required = ['name', 'quote_uz', 'quote_ru'];
    for (const f of required) {
      if (!b[f]) return json({ ok: false, error: 'missing_field', field: f }, 400);
    }
    const result = await env.DB.prepare(
      `INSERT INTO testimonials (name,role_uz,role_ru,quote_uz,quote_ru,stars,sort_order)
       VALUES (?,?,?,?,?,?,?)`
    )
      .bind(b.name, b.role_uz || '', b.role_ru || '', b.quote_uz, b.quote_ru, b.stars || 5, b.sort_order || 0)
      .run();
    return json({ ok: true, id: result.meta.last_row_id });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}
