// /api/admin/site — sayt ko'rinishi, SEO, FAQ va xizmatlar matnlari (settings.site_json)
import { json } from '../../_lib/auth.js';

export async function onRequestGet({ env }) {
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'site_json'").first();
    let site = null;
    try { site = row && row.value ? JSON.parse(row.value) : null; } catch (e) { site = null; }
    return json({ ok: true, site });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') return json({ ok: false, error: 'bad_request' }, 400);
    const value = JSON.stringify(body);
    if (value.length > 200000) return json({ ok: false, error: 'too_large' }, 400);
    await env.DB.prepare(
      "INSERT INTO settings (key, value) VALUES ('site_json', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind(value).run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}
