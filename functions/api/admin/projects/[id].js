// /api/admin/projects/:id — PUT (tahrirlash), DELETE (o'chirish)
import { json } from '../../../_lib/auth.js';

export async function onRequestPut({ request, env, params }) {
  try {
    const id = params.id;
    const b = await request.json();
    const gallery = JSON.stringify(b.gallery_urls || []);
    await env.DB.prepare(
      `UPDATE projects SET category=?, status=?, title_uz=?, title_ru=?, type_uz=?, type_ru=?,
       desc_uz=?, desc_ru=?, thumb_url=?, hero_url=?, gallery_urls=?, sort_order=? WHERE id=?`
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
        b.sort_order || 0,
        id
      )
      .run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}

export async function onRequestDelete({ params, env }) {
  try {
    await env.DB.prepare('DELETE FROM projects WHERE id=?').bind(params.id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}
