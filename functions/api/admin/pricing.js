// /api/admin/pricing — GET (joriy kalkulyator konfiguratsiyasi), PUT (yangilash)
import { json } from '../../_lib/auth.js';

export async function onRequestGet({ env }) {
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key='pricing_json'").first();
    return json({ ok: true, pricing: row ? JSON.parse(row.value) : null });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const body = await request.json(); // { services:[...], styles:[...], addons:[...] }
    await env.DB.prepare(
      "INSERT INTO settings (key,value) VALUES ('pricing_json',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    )
      .bind(JSON.stringify(body))
      .run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}
