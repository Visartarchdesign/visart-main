// /api/admin/testimonials/:id — PUT, DELETE
import { json } from '../../../_lib/auth.js';

export async function onRequestPut({ request, env, params }) {
  try {
    const b = await request.json();
    await env.DB.prepare(
      `UPDATE testimonials SET name=?, role_uz=?, role_ru=?, quote_uz=?, quote_ru=?, stars=?, sort_order=? WHERE id=?`
    )
      .bind(b.name, b.role_uz || '', b.role_ru || '', b.quote_uz, b.quote_ru, b.stars || 5, b.sort_order || 0, params.id)
      .run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}

export async function onRequestDelete({ params, env }) {
  try {
    await env.DB.prepare('DELETE FROM testimonials WHERE id=?').bind(params.id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}
