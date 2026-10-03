// POST /api/t — ichki statistika yig'uvchi (ochiq endpoint, cookie va IP saqlanmaydi).
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|preview|monitor|curl|wget|python|axios/i;
const TYPES = new Set(['pv', 'leave', 'click', 'sec']);
let ready = false;

const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>"'`]/g, '').slice(0, n);

function source(ref, utm, host) {
  if (utm) return clean(utm.toLowerCase(), 30);
  if (!ref) return 'direct';
  let h = '';
  try { h = new URL(ref).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return 'direct'; }
  if (!h || h === host || h.endsWith('visartdesign.uz')) return 'direct';
  if (/(^|\.)google\./.test(h)) return 'google';
  if (/(^|\.)(yandex\.|ya\.ru)/.test(h)) return 'yandex';
  if (/instagram\.com$/.test(h)) return 'instagram';
  if (/(^|\.)(t\.me|telegram\.)/.test(h)) return 'telegram';
  if (/(facebook|fb)\.com$|^l\.facebook|^m\.facebook/.test(h)) return 'facebook';
  if (/youtube\.com$|youtu\.be$/.test(h)) return 'youtube';
  if (/bing\.com$/.test(h)) return 'bing';
  if (/duckduckgo\.com$/.test(h)) return 'duckduckgo';
  return h.slice(0, 40);
}

async function ensure(db) {
  if (ready) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, day TEXT NOT NULL, vid TEXT, sid TEXT, type TEXT NOT NULL, path TEXT, ref TEXT, dev TEXT, lang TEXT, label TEXT, val INTEGER DEFAULT 0, country TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_events_day ON events(day)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_events_sid ON events(sid)"),
  ]);
  ready = true;
}

export async function onRequestPost({ request, env }) {
  const ok = new Response(null, { status: 204 });
  try {
    if (!env.DB) return ok;
    if (BOT.test(request.headers.get('User-Agent') || '')) return ok;
    const raw = await request.text();
    if (!raw || raw.length > 1200) return ok;
    const d = JSON.parse(raw);
    if (!TYPES.has(d.t)) return ok;
    const vid = clean(d.v, 32), sid = clean(d.s, 32);
    const path = clean(d.p, 120);
    if (!vid || !sid || path[0] !== '/' || path.startsWith('/admin')) return ok;
    const now = Date.now();
    const day = new Date(now + 5 * 3600 * 1000).toISOString().slice(0, 10); // Toshkent vaqti
    const url = new URL(request.url);
    const ref = d.t === 'pv' ? source(clean(d.r, 300), clean(d.u, 40), url.hostname.replace(/^www\./, '')) : '';
    const dev = ['m', 't', 'd'].includes(d.d) ? d.d : 'd';
    const lang = d.l === 'ru' ? 'ru' : 'uz';
    let val = parseInt(d.n, 10); if (!(val >= 0)) val = 0; val = Math.min(val, 1800);
    const country = clean((request.cf && request.cf.country) || '', 3);
    await ensure(env.DB);
    await env.DB.prepare(
      'INSERT INTO events (ts, day, vid, sid, type, path, ref, dev, lang, label, val, country) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(Math.floor(now / 1000), day, vid, sid, d.t, path, ref, dev, lang, clean(d.b, 80), val, country).run();
    if (Math.random() < 0.01) {
      const old = new Date(now - 400 * 86400000).toISOString().slice(0, 10);
      await env.DB.prepare('DELETE FROM events WHERE day < ?').bind(old).run();
    }
  } catch (e) { /* statistika hech qachon saytni buzmasligi kerak */ }
  return ok;
}
