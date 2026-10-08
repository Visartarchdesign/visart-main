// Supabase Database Webhook (obyektlar UPDATE) -> darhol xabar.
// Header: x-webhook-secret = env.OBYEKT_WEBHOOK_SECRET
import { holatXabar } from '../_lib/botAvto.js';

export async function onRequestPost({ request, env }) {
  const sec = env.OBYEKT_WEBHOOK_SECRET;
  if (!sec || request.headers.get('x-webhook-secret') !== sec) return new Response('forbidden', { status: 403 });
  let b; try { b = await request.json(); } catch (e) { return new Response('bad', { status: 400 }); }
  const r = b && b.record; const old = (b && b.old_record) || {};
  if (!r || !r.id || (r.holat || '') === (old.holat || '')) return Response.json({ ok: true, skip: true });
  await holatXabar(env, r, String(r.id), r.holat || '');
  return Response.json({ ok: true });
}
