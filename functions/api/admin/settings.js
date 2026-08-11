// /api/admin/settings — kontakt ma'lumotlari va statistikalar
import { json } from '../../_lib/auth.js';

const KEYS = ['phone', 'email', 'telegram', 'instagram', 'youtube', 'address_uz', 'address_ru', 'stats_years', 'stats_projects'];

export async function onRequestGet({ env }) {
  try {
    const res = await env.DB.prepare('SELECT key, value FROM settings').all();
    const out = {};
    for (const row of res.results) {
      if (KEYS.includes(row.key)) out[row.key] = row.value;
    }
    return json({ ok: true, settings: out });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const body = await request.json();
    for (const k of KEYS) {
      if (body[k] !== undefined) {
        await env.DB.prepare(
          "INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
        )
          .bind(k, String(body[k]))
          .run();
      }
    }
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}
