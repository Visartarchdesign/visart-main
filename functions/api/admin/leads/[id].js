// /api/admin/leads/:id — holat va izohni yangilash, o'chirish
import { json } from '../../../_lib/auth.js';

const STATUSES = ['new', 'contacted', 'contract', 'rejected'];

export async function onRequestPut({ request, env, params }) {
  try {
    const b = await request.json();
    const existing = await env.DB.prepare('SELECT status, note FROM leads WHERE id = ?').bind(params.id).first();
    if (!existing) return json({ ok: false, error: 'not_found' }, 404);
    const status = STATUSES.includes(b.status) ? b.status : existing.status;
    const note = b.note !== undefined ? String(b.note).slice(0, 2000) : existing.note;
    await env.DB.prepare('UPDATE leads SET status = ?, note = ? WHERE id = ?').bind(status, note, params.id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}

export async function onRequestDelete({ params, env }) {
  try {
    await env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(params.id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}
