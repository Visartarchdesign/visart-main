// Oblojka shablonlarini yaratadi (Doston portreti asosida, 10 xil sahna). node shablonYarat.mjs [raqamlar: 2 3 5]
// Natija: oblojka_shablon/NN.png. Mavjud fayllar o'tkazib yuboriladi. Yuz manbasi: oblojka_shablon/01.png va yuz/*.jpg
import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
for (const l of fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8').split(/\r?\n/) : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const DIR = path.dirname(fileURLToPath(import.meta.url)), SH = path.join(DIR, 'oblojka_shablon');
const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const OPT = 'Vertical 9:16 premium Instagram cover photo, ultra-realistic, cinematic soft key light, warm gold and deep charcoal palette, shallow depth of field, magazine quality. The man wears a black blazer over a black turtleneck. The TOP 34% of the frame must stay calm and darker (a title will be added there). The man is in the lower 60% of the frame. ABSOLUTELY NO text, letters, numbers, logos or watermarks.';
const S = {
  2: 'He sits on a luxury sofa in a dark modern living room with vertical wooden slats and a plant, looking aside thoughtfully.',
  3: 'A luxurious modern living room with a marble fireplace, designer glass chandelier and a large window with a city view behind him; he sits in the foreground looking toward the window.',
  4: 'He draws on architectural floor plans at a drafting table with a pen, a blackboard with blueprint sketches behind him, an architectural scale model beside him.',
  5: 'Behind him a split image: left half an unfinished concrete construction room, right half the same room beautifully finished as a luxury bedroom; he looks aside, serious.',
  6: 'He examines a stone sample tile in his hand; on the table marble, walnut wood and brass material samples, dark moody lighting.',
  7: 'A clean bright split-scene living room (grey sofa left, warm wood and gold lighting right) behind him; he looks aside with a thoughtful expression.',
  8: 'He rests his chin on his hand, pen in the other, with many printed floor plans and interior photos spread on the desk in front of him, thinking critically.',
  9: 'He wears a white hard hat and a black work jacket, standing at a concrete building construction site with scaffolding, holding rolled blueprints.',
  10: 'He sits at a warm designer desk with a laptop, explaining something confidently with an open hand gesture toward the camera.',
};
const refs = [path.join(SH, '01.png'), ...(fs.existsSync(path.join(DIR, 'yuz')) ? fs.readdirSync(path.join(DIR, 'yuz')).filter((f) => /\.(jpe?g|png)$/i.test(f)).slice(0, 2).map((f) => path.join(DIR, 'yuz', f)) : [])].filter(fs.existsSync);
const mime = (p) => (/\.png$/i.test(p) ? 'image/png' : 'image/jpeg');
const kerak = process.argv.slice(2).map(Number).filter(Boolean);
for (const n of (kerak.length ? kerak : Object.keys(S).map(Number))) {
  const out = path.join(SH, `${String(n).padStart(2, '0')}.png`);
  if (fs.existsSync(out)) { console.log(n, 'bor, o\'tkazildi'); continue; }
  const parts = refs.map((p) => ({ inlineData: { mimeType: mime(p), data: fs.readFileSync(p).toString('base64') } }));
  parts.push({ text: `The man in the reference photo(s) MUST appear with EXACTLY his real face (identity unmistakable), professionally retouched and flattering. Scene: ${S[n]} ${OPT}` });
  let ok = false;
  for (let u = 1; u <= 3 && !ok; u++) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'] } }), signal: AbortSignal.timeout(90000) });
      if (!res.ok) { console.log(n, 'HTTP', res.status, (await res.text().catch(() => '')).slice(0, 200)); continue; }
      const d = await res.json();
      const im = (((d.candidates || [])[0] || {}).content || {}).parts?.find((x) => x.inlineData?.data);
      if (im) { fs.writeFileSync(out, Buffer.from(im.inlineData.data, 'base64')); console.log(n, 'tayyor ->', out); ok = true; } else console.log(n, 'rasm qaytmadi');
    } catch (e) { console.log(n, 'xato', e.message); }
  }
}
