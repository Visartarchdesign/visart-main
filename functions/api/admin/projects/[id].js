// /api/admin/projects/:id — PUT (tahrirlash), DELETE (o'chirish)
import { json } from '../../../_lib/auth.js';
import { slugifyUz, slugifyRu, ensureUniqueSlug } from '../../../_lib/slug.js';
import { buildValues } from '../../../_lib/projectFields.js';

export async function onRequestPut({ request, env, params }) {
  try {
    const id = params.id;
    const b = await request.json();
    const existing = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
    if (!existing) return json({ ok: false, error: 'not_found' }, 404);

    // Body'da yuborilmagan maydonlar o'zgarmaydi (masalan, tartib o'zgartirilganda dalillar o'chib ketmaydi).
    const v = buildValues(b, existing);

    // Slug bir marta yaratilgach o'zgarmaydi — mavjud havolalar va SEO buzilmasin.
    v.slug = existing.slug || (await ensureUniqueSlug(env, slugifyUz(v.title_uz), 'slug', id));
    v.slug_ru = existing.slug_ru || (await ensureUniqueSlug(env, slugifyRu(v.title_ru), 'slug_ru', id));

    const cols = Object.keys(v);
    await env.DB.prepare(`UPDATE projects SET ${cols.map((c) => `${c}=?`).join(', ')} WHERE id=?`)
      .bind(...cols.map((c) => v[c]), id)
      .run();
    return json({ ok: true, slug: v.slug, slug_ru: v.slug_ru });
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
