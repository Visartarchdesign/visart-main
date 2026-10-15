// Muallif yuzi kutubxonasi + AI premium oblojka (Gemini rasm modeli, yuz referensi bilan).
// Matn AI tomonidan EMAS, bizning kodimiz tomonidan chiziladi -- o'zbekcha imlo xatosiz bo'lishi uchun.
import sharp from 'sharp';

const esc = (s) => String(s || '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

export async function yuzTanla(env, prefix = 'yuz_ai', hammasi = false) {
  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
    const r = await fetch(`${env.SUPABASE_URL}/storage/v1/object/list/public-media`, {
      method: 'POST', headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 100 }), signal: AbortSignal.timeout(10000) });
    const list = ((await r.json()) || []).filter((x) => x.name && /\.(jpe?g|png)$/i.test(x.name));
    if (!list.length) return null;
    const yukla = async (f) => {
      const img = await fetch(`${env.SUPABASE_URL}/storage/v1/object/public/public-media/${prefix}/${f.name}`, { signal: AbortSignal.timeout(15000) });
      return img.ok ? Buffer.from(await img.arrayBuffer()) : null;
    };
    if (hammasi) return (await Promise.all(list.slice(0, 4).map(yukla))).filter(Boolean);
    return await yukla(list[Math.floor(Math.random() * list.length)]);
  } catch (e) { return null; }
}

function sarlavhaQatorlari(t, maks = 13) {
  const so = String(t || '').trim().toUpperCase().split(/\s+/).filter(Boolean);
  const q = []; let c = '';
  for (const w of so) { if (c && (c + ' ' + w).length > maks) { q.push(c); c = w; } else c = (c + ' ' + w).trim(); }
  if (c) q.push(c);
  return q.slice(0, 4);
}

export async function aiOblojka(env, { sarlavha, aksent = '', yuz = null }) {
  if (!env.GEMINI_API_KEY) return null;
  if (!yuz) yuz = (await yuzTanla(env, 'yuz', true).catch(() => []))[0] || null; // faqat shaxsni aniqlash uchun; natija ishlangan, xom foto emas
  const sahna =
    `Create a premium vertical (9:16) Instagram Reels cover photo for an architecture & interior design studio in Tashkent. Topic: "${sarlavha}". ` +
    (yuz ? 'The man from the reference photo MUST appear with EXACTLY his real face shape, eyes, nose and hair (identity must be unmistakable), but PROFESSIONALLY RETOUCHED and flattering: soft cinematic key light, clean even natural skin, neat hair, sharp confident look, premium dark blazer over black turtleneck, in the lower half, confident friendly expression, looking at camera, naturally interacting with a topic-relevant prop (architectural scale model, floor plan, material samples or a lamp). ' : 'A topic-relevant premium interior/architecture scene. ') +
    'Cinematic soft lighting, warm gold and deep charcoal palette, shallow depth of field, ultra-realistic, magazine-quality. Keep the TOP 40% of the frame visually calm and darker (text will be added later). ABSOLUTELY NO text, letters, numbers, logos or watermarks in the image.';
  const parts = [];
  if (yuz) parts.push({ inlineData: { mimeType: 'image/jpeg', data: yuz.toString('base64') } });
  parts.push({ text: sahna });
  let buf = null;
  for (const model of [env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image']) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'] } }), signal: AbortSignal.timeout(60000) });
      if (!res.ok) continue;
      const d = await res.json();
      const p = (((d.candidates || [])[0] || {}).content || {}).parts || [];
      const im = p.find((x) => x.inlineData && x.inlineData.data);
      if (im) { buf = Buffer.from(im.inlineData.data, 'base64'); break; }
    } catch (e) { /* keyingi */ }
  }
  if (!buf) return null;

  const W = 1080, H = 1920;
  const qat = sarlavhaQatorlari(sarlavha);
  const fz = 112;
  const ak = String(aksent || '').toUpperCase();
  const matnSvg = qat.map((q, i) => {
    const y = 330 + i * (fz + 18);
    const aksentli = ak && q.includes(ak);
    const bar = aksentli ? `<rect x="52" y="${y - fz + 18}" width="${Math.min(W - 104, q.length * 66)}" height="${fz - 6}" fill="#f2c230"/>` : '';
    return bar + `<text x="64" y="${y}" font-family="Liberation Sans, Arial, sans-serif" font-size="${fz}" font-weight="900" fill="${aksentli ? '#111' : '#fff'}">${esc(q)}</text>`;
  }).join('');
  const overlay = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.82"/><stop offset="0.5" stop-color="#000" stop-opacity="0.35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
    <rect width="${W}" height="900" fill="url(#t)"/>
    <text x="64" y="130" font-family="Liberation Sans, Arial, sans-serif" font-size="30" font-weight="700" fill="#c9a876" letter-spacing="7">VISART DESIGN</text>
    <rect x="64" y="160" width="100" height="5" fill="#c9a876"/>
    ${matnSvg}
  </svg>`);
  const baza = await sharp(buf).resize(W, H, { fit: 'cover', position: 'attention' }).toBuffer();
  return sharp(baza).composite([{ input: overlay }]).png().toBuffer();
}

// Muallifning "chiroyli" AI portretlari: xom rasmlardan (yuz/) studiya darajasida 4 ta portret yaratadi.
// Natijalar yuz_ai/ ga saqlanadi va admin'ga yuboriladi (❌ bilan o'chirish mumkin).
export async function yuzStudio(env, tgSendPhoto) {
  const refs = await yuzTanla(env, 'yuz', true);
  if (!refs.length) throw new Error("yuz/ kutubxonasi bo'sh -- avval botga 'yuz' izohi bilan rasm yuboring");
  const variantlar = [
    'front-facing, confident subtle smile, looking at camera, chest-up',
    'three-quarter view turned slightly to his left, calm confident gaze, chest-up',
    'three-quarter view turned slightly to his right, thoughtful expression, chest-up',
    'arms crossed, standing, confident friendly smile, waist-up',
  ];
  const natija = [];
  for (const v of variantlar) {
    const parts = refs.map((b) => ({ inlineData: { mimeType: 'image/jpeg', data: b.toString('base64') } }));
    parts.push({ text:
      'The reference photos show the SAME man from different angles. Create a premium studio portrait of THIS exact man: identity must be unmistakable (face shape, eyes, nose, hairline, hair style). ' +
      'Make him look his best: soft professional studio lighting, clean even natural skin with subtle realistic retouching (keep real texture, no plastic look), neat hair, fresh healthy look, sharp eyes. ' +
      `Outfit: premium dark blazer over a black turtleneck. Pose: ${v}. Background: softly blurred modern architecture studio with warm gold bokeh, 9:16 vertical, magazine quality. No text, no logos.` });
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'] } }), signal: AbortSignal.timeout(90000) });
      if (!res.ok) continue;
      const d = await res.json();
      const im = ((((d.candidates || [])[0] || {}).content || {}).parts || []).find((x) => x.inlineData && x.inlineData.data);
      if (!im) continue;
      const buf = await sharp(Buffer.from(im.inlineData.data, 'base64')).jpeg({ quality: 92 }).toBuffer();
      const name = `${Date.now()}-${natija.length}.jpg`;
      const up = await fetch(`${env.SUPABASE_URL}/storage/v1/object/public-media/yuz_ai/${name}`, {
        method: 'POST', headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: buf });
      if (!up.ok) continue;
      natija.push(name);
      await tgSendPhoto(buf, `✨ ${v}\nYoqmasa ❌ bosing -- o'chiriladi.`, { inline_keyboard: [[{ text: "❌ O'chirish", callback_data: `yuzdel:${name}` }]] });
    } catch (e) { /* keyingisi */ }
  }
  return natija.length;
}
