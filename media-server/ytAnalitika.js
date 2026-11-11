// YouTube statistikasi: kanal yuklamalari (Shorts + uzun) reyestrga yoziladi va bosqichli suratlar olinadi.
// OAuth tokeni faqat media-serverda. Jadvallar: db/migration_kontent_analitika.sql.
const BOSQICH = [24, 72, 168, 672];

async function token(env) {
  if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET || !env.YOUTUBE_REFRESH_TOKEN) return null;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({ client_id: env.YOUTUBE_CLIENT_ID, client_secret: env.YOUTUBE_CLIENT_SECRET, refresh_token: env.YOUTUBE_REFRESH_TOKEN, grant_type: 'refresh_token' }),
  });
  return r.ok ? (await r.json()).access_token : null;
}
const yt = async (t, path) => {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, { headers: { Authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`YouTube ${path.split('?')[0]} ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
};
// ISO 8601 davomiylik -> soniya (PT1M5S -> 65)
export function isoSoniya(d) {
  const m = String(d || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
}

export async function ytStatistika(env) {
  const t = await token(env);
  if (!t) return { ok: false, sabab: 'YouTube OAuth sozlanmagan' };
  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  const sb = async (path, init = {}) => {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`Supabase ${path.split('?')[0]} ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const x = await r.text(); return x ? JSON.parse(x) : null;
  };
  const ch = await yt(t, 'channels?part=contentDetails&mine=true');
  const up = ch.items && ch.items[0] && ch.items[0].contentDetails.relatedPlaylists.uploads;
  if (!up) return { ok: false, sabab: 'uploads playlist topilmadi' };
  const pl = await yt(t, `playlistItems?part=contentDetails&maxResults=50&playlistId=${up}`);
  const ids = (pl.items || []).map((i) => i.contentDetails.videoId);
  if (!ids.length) return { ok: true, video: 0 };
  const v = await yt(t, `videos?part=snippet,statistics,contentDetails,status&id=${ids.join(',')}`);
  const qatorlar = []; const stat = new Map();
  for (const x of v.items || []) {
    const pub = (x.status && x.status.publishAt) || x.snippet.publishedAt;
    if (x.status && x.status.privacyStatus !== 'public') continue; // rejadagi (hali chiqmagan) videolar
    const s = isoSoniya(x.contentDetails.duration);
    qatorlar.push({ platforma: 'youtube', tashqi_id: x.id, url: `https://youtu.be/${x.id}`, sarlavha: x.snippet.title.slice(0, 140), nashr_vaqti: pub, davomiylik_s: s, format: s <= 180 ? 'SHORTS' : 'LONG' });
    stat.set(x.id, { views: +x.statistics.viewCount || 0, likes: +x.statistics.likeCount || 0, comments: +x.statistics.commentCount || 0 });
  }
  if (qatorlar.length) await sb('kontent_nashr?on_conflict=platforma,tashqi_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(qatorlar) });
  const rows = await sb(`kontent_nashr?platforma=eq.youtube&tashqi_id=in.(${[...stat.keys()].join(',')})&select=id,tashqi_id,nashr_vaqti,kontent_metrika(soat)`) || [];
  const suratlar = [];
  for (const r of rows) {
    const yosh = (Date.now() - new Date(r.nashr_vaqti).getTime()) / 3600e3;
    const bor = (r.kontent_metrika || []).map((x) => x.soat);
    const tayyor = BOSQICH.filter((b) => yosh >= b && !bor.includes(b));
    if (tayyor.length) suratlar.push({ nashr_id: r.id, soat: tayyor[tayyor.length - 1], metrika: stat.get(r.tashqi_id) });
  }
  if (suratlar.length) await sb('kontent_metrika?on_conflict=nashr_id,soat', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(suratlar) });
  return { ok: true, video: qatorlar.length, surat: suratlar.length };
}
