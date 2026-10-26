// POST /api/ilova-media-yukla (multipart, har so'rovda 1 ta fayl) -- admin ilovadan rasm/video: bazaga (Senarist uchun) yoki "hozir post".
// Fayl botning o'zi orqali admin chatiga yuboriladi (haqiqiy message_id va file_id uchun), so'ng bot oqimiga adminning xabari sifatida beriladi.
import { adminTekshir, botUpd } from '../_lib/appAuth.js';
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env, waitUntil }) {
  let f; try { f = await request.formData(); } catch { return J({ ok: false, error: 'forma' }, 400); }
  const u = await adminTekshir(env, f.get('initData'));
  if (!u) return J({ ok: false, error: 'ruxsat' }, 403);
  const file = f.get('fayl'); if (!file || typeof file !== 'object') return J({ ok: false, error: 'Fayl yoq' }, 400);
  const rejim = f.get('rejim') === 'hozir' ? 'hozir' : 'baza';
  const caption = String(f.get('caption') || '').slice(0, 900).trim();
  if (rejim === 'hozir' && !caption) return J({ ok: false, error: "«Hozir post» uchun izoh (ko'rsatma) kerak" }, 400);
  const isVid = /^video\//.test(file.type || ''), isImg = /^image\//.test(file.type || '');
  if (!isVid && !isImg) return J({ ok: false, error: 'Faqat rasm yoki video' }, 400);
  if (file.size > 49 * 1048576) return J({ ok: false, error: 'Fayl 50 MB dan katta (Telegram cheklovi)' }, 400);
  const fd = new FormData(); fd.append('chat_id', String(u.id));
  fd.append(isVid ? 'video' : 'document', file, file.name || (isVid ? 'v.mp4' : 'r.jpg'));
  if (isVid) fd.append('supports_streaming', 'true');
  const r = await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/${isVid ? 'sendVideo' : 'sendDocument'}`, { method: 'POST', body: fd, signal: AbortSignal.timeout(100000) }).then((x) => x.json()).catch(() => null);
  if (!r || !r.ok) return J({ ok: false, error: 'Telegramga yuklanmadi' + (r && r.description ? ': ' + r.description.slice(0, 60) : '') }, 502);
  const m = r.result;
  const msg = { message_id: m.message_id, from: { id: u.id, is_bot: false, first_name: 'Admin' }, chat: { id: u.id, type: 'private' }, date: m.date, ...(m.video ? { video: m.video } : { document: m.document }) };
  if (rejim === 'baza') msg.media_group_id = 'app-' + String(f.get('partiya') || Date.now()).replace(/[^\w-]/g, '').slice(0, 30);
  else msg.caption = caption;
  const p = botUpd(env, request, { message: msg });
  if (waitUntil) waitUntil(p);
  return J({ ok: true });
}
