// /api/admin/* ostidagi barcha so'rovlar uchun sessiya tekshiruvi.
import { verifySession, json } from '../../_lib/auth.js';

export async function onRequest({ request, env, next }) {
  const session = await verifySession(request, env);
  if (!session) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }
  return next();
}
