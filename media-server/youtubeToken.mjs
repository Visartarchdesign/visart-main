// YouTube refresh token olish (bir marta). .env da YOUTUBE_CLIENT_ID va YOUTUBE_CLIENT_SECRET bo'lishi kerak.
// node youtubeToken.mjs  -> brauzerda Google'ga kirib ruxsat bering; token .env ga avtomatik yoziladi.
import fs from 'fs'; import http from 'http';
const ENV = '.env';
const env = {}; for (const l of fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8').split(/\r?\n/) : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2]; }
if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET) { console.log('.env da YOUTUBE_CLIENT_ID va YOUTUBE_CLIENT_SECRET yo\'q.'); process.exit(1); }
const PORT = 8085, REDIR = `http://127.0.0.1:${PORT}/`;
const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: env.YOUTUBE_CLIENT_ID, redirect_uri: REDIR, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube' });
console.log('\nBrauzerda shu manzilni oching va Visart YouTube kanali akkauntida ruxsat bering:\n\n' + url + '\n');
http.createServer(async (req, res) => {
  const code = new URL(req.url, REDIR).searchParams.get('code');
  if (!code) { res.end('kutilmoqda...'); return; }
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: env.YOUTUBE_CLIENT_ID, client_secret: env.YOUTUBE_CLIENT_SECRET, redirect_uri: REDIR, grant_type: 'authorization_code' }) });
  const d = await r.json();
  if (!d.refresh_token) { res.end('Xato: ' + JSON.stringify(d)); console.log('Xato:', JSON.stringify(d)); process.exit(1); }
  let t = fs.readFileSync(ENV, 'utf8').replace(/\r?\n*$/, '\n').replace(/^YOUTUBE_REFRESH_TOKEN=.*\r?\n/m, '');
  fs.writeFileSync(ENV, t + `YOUTUBE_REFRESH_TOKEN=${d.refresh_token}\n`);
  res.end('Tayyor! Bu oynani yopishingiz mumkin.'); console.log('Tayyor: YOUTUBE_REFRESH_TOKEN .env ga yozildi.'); process.exit(0);
}).listen(PORT);
