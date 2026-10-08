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
    // Haqiqiy format baytlardan aniqlanadi (telefonlar ba'zan noto'g'ri tur/kengaytma yuboradi)
    const buf = await file.arrayBuffer();
    const h = new Uint8Array(buf.slice(0, 16));
    const asc = (o, n) => String.fromCharCode(...h.slice(o, o + n));
    let ext = null, ctype = null;
    if (h[0] === 0xff && h[1] === 0xd8) { ext = 'jpg'; ctype = 'image/jpeg'; }
    else if (asc(1, 3) === 'PNG') { ext = 'png'; ctype = 'image/png'; }
    else if (asc(0, 4) === 'RIFF' && asc(8, 4) === 'WEBP') { ext = 'webp'; ctype = 'image/webp'; }
    else if (asc(0, 3) === 'GIF') { ext = 'gif'; ctype = 'image/gif'; }
    else if (asc(4, 4) === 'ftyp') return json({ ok: false, error: 'heic_qollanmaydi', message: "HEIC format qo'llanmaydi. Telefon kamerasi sozlamalarida 'Most Compatible' (JPEG) ni tanlang yoki rasmni JPG qilib yuboring." }, 400);
    else return json({ ok: false, error: 'rasm_emas', message: "Fayl rasm formatida emas (JPG, PNG, WebP, GIF)." }, 400);
    const key = `uploads/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    await env.UPLOADS.put(key, buf, { httpMetadata: { contentType: ctype } });

    // Telefon uchun kichik nusxa (<nom>-sm.webp)
    const sm = formData.get('sm');
    if (sm && typeof sm !== 'string' && key.endsWith('.webp')) {
      await env.UPLOADS.put(key.replace(/\.webp$/, '-sm.webp'), sm.stream(), {
        httpMetadata: { contentType: 'image/webp' },
      });
    }

    const publicBase = env.R2_PUBLIC_BASE || '';
    const url = publicBase ? `${publicBase.replace(/\/$/, '')}/${key}` : `/r2/${key}`;
    return json({ ok: true, url, key });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}
