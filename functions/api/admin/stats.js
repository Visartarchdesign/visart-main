// GET /api/admin/stats?days=7 — ichki statistika hisoboti (faqat admin).
import { json } from '../../_lib/auth.js';

const TZ = 5 * 3600;
const dayStr = (ms) => new Date(ms + TZ * 1000).toISOString().slice(0, 10);

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days'), 10) || 7, 1), 365);
    const now = Date.now();
    const from = dayStr(now - (days - 1) * 86400000);
    const db = env.DB;
    const all = async (sql, ...b) => (await db.prepare(sql).bind(...b).all()).results || [];
    const one = async (sql, ...b) => (await db.prepare(sql).bind(...b).first()) || {};

    try { await db.prepare('SELECT 1 FROM events LIMIT 1').first(); }
    catch (e) { return json({ ok: true, empty: true, days }); }

    const [tot, sess, avgT, vis, ret, live] = await Promise.all([
      one("SELECT COUNT(*) pv FROM events WHERE type='pv' AND day>=?", from),
      one(`SELECT COUNT(*) total, COALESCE(SUM(CASE WHEN pvs=1 AND clicks=0 AND secs<10 THEN 1 ELSE 0 END),0) bounced,
             COALESCE(SUM(CASE WHEN clicks>0 THEN 1 ELSE 0 END),0) acted
           FROM (SELECT sid, SUM(type='pv') pvs, SUM(type='click') clicks,
                        SUM(CASE WHEN type='leave' THEN val ELSE 0 END) secs
                 FROM events WHERE day>=? GROUP BY sid)`, from),
      one("SELECT AVG(t) a FROM (SELECT SUM(val) t FROM events WHERE type='leave' AND day>=? GROUP BY sid)", from),
      one('SELECT COUNT(DISTINCT vid) n FROM events WHERE day>=?', from),
      one(`SELECT COUNT(*) n FROM (SELECT vid FROM events WHERE vid IN (SELECT DISTINCT vid FROM events WHERE day>=?)
             GROUP BY vid HAVING COUNT(DISTINCT sid)>=2)`, from),
      one('SELECT COUNT(DISTINCT sid) n FROM events WHERE ts>=?', Math.floor(now / 1000) - 300),
    ]);

    const [daily, pages, pageTime, exits, firsts, clicks, secs, homeSess, hours] = await Promise.all([
      all("SELECT day, SUM(type='pv') pv, COUNT(DISTINCT sid) sessions FROM events WHERE day>=? GROUP BY day ORDER BY day", from),
      all("SELECT path, COUNT(*) pv, COUNT(DISTINCT vid) uv FROM events WHERE type='pv' AND day>=? GROUP BY path ORDER BY pv DESC LIMIT 20", from),
      all("SELECT path, AVG(val) t, AVG(CAST(label AS INTEGER)) sc FROM events WHERE type='leave' AND day>=? GROUP BY path", from),
      all(`SELECT path, COUNT(*) n FROM events e WHERE type='pv' AND day>=?
             AND id=(SELECT MAX(id) FROM events WHERE sid=e.sid AND type='pv') GROUP BY path`, from),
      all(`SELECT ref, dev, lang, country FROM events e WHERE type='pv' AND day>=?
             AND id=(SELECT MIN(id) FROM events WHERE sid=e.sid AND type='pv') LIMIT 20000`, from),
      all("SELECT label, COUNT(*) c, COUNT(DISTINCT sid) s FROM events WHERE type='click' AND day>=? GROUP BY label ORDER BY c DESC LIMIT 30", from),
      all("SELECT label, COUNT(DISTINCT sid) s FROM events WHERE type='sec' AND day>=? GROUP BY label", from),
      one("SELECT COUNT(DISTINCT sid) n FROM events WHERE type='pv' AND path IN ('/','/ru') AND day>=?", from),
      all("SELECT CAST(strftime('%H', ts+?, 'unixepoch') AS INTEGER) h, COUNT(DISTINCT sid) s FROM events WHERE type='pv' AND day>=? GROUP BY h", TZ, from),
    ]);

    const tally = (key) => {
      const m = {};
      for (const r of firsts) { const k = r[key] || '—'; m[k] = (m[k] || 0) + 1; }
      return Object.entries(m).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n).slice(0, 12);
    };
    const tMap = Object.fromEntries(pageTime.map((r) => [r.path, r]));
    const eMap = Object.fromEntries(exits.map((r) => [r.path, r.n]));
    const pagesOut = pages.map((r) => ({
      path: r.path, pv: r.pv, uv: r.uv,
      time: tMap[r.path] ? Math.round(tMap[r.path].t || 0) : 0,
      scroll: tMap[r.path] ? Math.round(tMap[r.path].sc || 0) : 0,
      exit: r.pv ? Math.round(((eMap[r.path] || 0) / r.pv) * 100) : 0,
    }));

    return json({
      ok: true, days, from,
      totals: {
        pv: tot.pv || 0, sessions: sess.total || 0, visitors: vis.n || 0,
        returning: ret.n || 0, avgTime: Math.round(avgT.a || 0),
        bounce: sess.total ? Math.round((sess.bounced / sess.total) * 100) : 0,
        acted: sess.total ? Math.round((sess.acted / sess.total) * 100) : 0,
        live: live.n || 0,
      },
      daily, pages: pagesOut,
      sources: tally('ref'), devices: tally('dev'), langs: tally('lang'), countries: tally('country'),
      clicks, sections: secs, homeSessions: homeSess.n || 0, hours,
    });
  } catch (e) {
    return json({ ok: false, error: 'server_error', message: String(e) }, 500);
  }
}
