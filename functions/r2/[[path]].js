// GET /r2/... — R2_PUBLIC_BASE sozlanmagan holatda R2 obyektlarini xizmat qiladi (fallback).
export async function onRequestGet({ params, env }) {
  if (!env.UPLOADS) return new Response('Not configured', { status: 500 });
  const segments = Array.isArray(params.path) ? params.path : [params.path];
  const key = `uploads/${segments.join('/')}`;
  const obj = await env.UPLOADS.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
}
