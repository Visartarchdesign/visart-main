// /api/admin/leads — saytdagi formadan kelgan murojaatlar ro'yxati
import { json } from '../../_lib/auth.js';

export async function onRequestGet({ env }) {
  try {
    const res = await env.DB.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 1000').all();
    return json({ ok: true, leads: res.results || [] });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}
