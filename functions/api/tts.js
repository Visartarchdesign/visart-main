// Edge neyron ovozi (o'zbek) uchun proksi: Render IP'si Microsoft tomonidan to'silganda Cloudflare orqali o'tadi.
// POST { matn, voice?, rate?, pitch? }, sarlavha x-media-secret: <MEDIA_SECRET> -> audio/mpeg
const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS = 'https://api.msedgeservices.com/tts/cognitiveservices/websocket/v1';
const esc = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');

async function gec() {
  const ticks = Math.floor(Date.now() / 1000) + 11644473600;
  const r = ticks - (ticks % 300);
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${r * 10000000}${TOKEN}`));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export async function onRequestPost({ request, env }) {
  if (!env.MEDIA_SECRET || request.headers.get('x-media-secret') !== env.MEDIA_SECRET) return new Response('forbidden', { status: 403 });
  let b; try { b = await request.json(); } catch (e) { return new Response('bad json', { status: 400 }); }
  const matn = String(b.matn || '').slice(0, 1500);
  if (!matn) return new Response('matn yo\'q', { status: 400 });
  const voice = b.voice || 'uz-UZ-SardorNeural';
  try {
    const url = `${WSS}?Ocp-Apim-Subscription-Key=${TOKEN}&Sec-MS-GEC=${await gec()}&Sec-MS-GEC-Version=1-143.0.3650.96&ConnectionId=${hex(16)}`;
    const resp = await fetch(url, { headers: { Upgrade: 'websocket', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0', Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold' } });
    const ws = resp.webSocket;
    if (!ws) return new Response(`ws yo'q: HTTP ${resp.status}`, { status: 424 });
    ws.accept();
    const qismlar = [];
    const tugadi = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 40000);
      ws.addEventListener('message', async (e) => {
        if (typeof e.data === 'string') { if (e.data.includes('Path:turn.end')) { clearTimeout(t); resolve(); } return; }
        const buf = new Uint8Array(e.data instanceof ArrayBuffer ? e.data : await e.data.arrayBuffer());
        if (buf.length < 2) return;
        const hl = (buf[0] << 8) | buf[1];
        if (new TextDecoder().decode(buf.slice(2, 2 + hl)).includes('Path:audio')) qismlar.push(buf.slice(2 + hl));
      });
      ws.addEventListener('error', () => { clearTimeout(t); reject(new Error('ws xato')); });
      ws.addEventListener('close', () => { clearTimeout(t); resolve(); });
    });
    ws.send(`Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="uz-UZ"><voice name="${esc(voice)}"><prosody pitch="${esc(b.pitch || '+0Hz')}" rate="${esc(b.rate || '+0%')}" volume="+0%">${esc(matn)}</prosody></voice></speak>`;
    ws.send(`X-RequestId:${hex(16)}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`);
    await tugadi;
    try { ws.close(); } catch (e) { /* */ }
    const n = qismlar.reduce((q, x) => q + x.length, 0);
    if (!n) return new Response('audio yo\'q', { status: 424 });
    const out = new Uint8Array(n); let o = 0;
    for (const q of qismlar) { out.set(q, o); o += q.length; }
    return new Response(out, { headers: { 'Content-Type': 'audio/mpeg' } });
  } catch (e) { return new Response('xato: ' + String((e && e.message) || e).slice(0, 150), { status: 424 }); }
}
