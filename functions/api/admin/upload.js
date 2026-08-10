// /api/admin/upload — rasm yuklash (Cloudflare R2)
import { json } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return json({ ok: false, error: 'no_file' }, 400);
    }
    if (!env.UPLOADS) {
      return json({ ok: false, error: 'not_configured' }, 500);
    }
    const rawExt = (file.name && file.name.includes('.')) ? file.name.split('.').pop().toLowerCase() : 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt) ? rawExt : 'jpg';
    const key = `uploads/${Date.now()}-${crypto.randomUUID()}.${safeExt}`;

    await env.UPLOADS.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || 'image/jpeg' },
    });

    const publicBase = env.R2_PUBLIC_BASE || '';
    const url = publicBase ? `${publicBase.replace(/\/$/, '')}/${key}` : `/r2/${key}`;
    return json({ ok: true, url, key });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}
