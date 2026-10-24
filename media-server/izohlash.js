// Haqiqiy ko'rinishdagi AI foto ustiga animatsion izohlar (strelka, nur, belgi).
// Foto Flux'dan; obyektlar joyini Gemini ko'rish modeli topadi; izoh qatlamini kod chizadi.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const FF = 'Liberation Sans, Arial, sans-serif';
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = (x) => x * x * (3 - 2 * x);

// obj: Gemini topadigan obyekt (inglizcha); steps: t -- sahna vaqti (0..1, slaydlar bo'ylab uzluksiz)
export const SAHNA_FOTO = {
  quyosh_xona: {
    prompt: 'a bright real living room interior, wide shot, one large window on the left wall with strong sunlight, a long bright sunlight patch on the wooden floor, a beige sofa on the right side, photorealistic architectural photography',
    obj: { window: 'the large window', patch: 'the bright sunlight patch on the floor', sofa: 'the sofa' },
    steps: [
      { k: 'belgi', o: 'window', m: 'Oyna', a: 0.0, b: 1 },
      { k: 'strelka', f: 'window', to: 'patch', m: 'Quyosh nuri', a: 0.1, b: 0.6 },
      { k: 'belgi', o: 'patch', m: 'Kechga uzayadi', a: 0.45, b: 1 },
      { k: 'belgi', o: 'sofa', m: 'Divan', a: 0.8, b: 1 },
    ],
  },
  hovli_soya: {
    prompt: 'a real private house in a sunny courtyard, side view, a big leafy shade tree on the left, long soft tree shadow on the ground toward the house, hot bright summer day, photorealistic architectural photography',
    obj: { house: 'the house', tree: 'the big tree', shadow: 'the shadow of the tree on the ground' },
    steps: [
      { k: 'belgi', o: 'house', m: 'Uy', a: 0.0, b: 1 },
      { k: 'belgi', o: 'tree', m: 'Soya beruvchi daraxt', a: 0.1, b: 1 },
      { k: 'strelka', f: 'tree', to: 'house', m: 'Soya', a: 0.3, b: 0.8 },
    ],
  },
  ayvon_kesim: {
    prompt: 'a real modern house facade seen from the front, a deep covered veranda overhang above large windows, a leafy tree on the right, bright summer sun, photorealistic architectural photography',
    obj: { overhang: 'the veranda roof overhang above the windows', window: 'the large window', tree: 'the tree' },
    steps: [
      { k: 'strelka', f: 'sun', to: 'overhang', m: 'Yozgi baland quyosh', a: 0.05, b: 0.5 },
      { k: 'belgi', o: 'overhang', m: 'Ayvon to\'sadi', a: 0.3, b: 1 },
      { k: 'belgi', o: 'window', m: 'Xona salqin', a: 0.5, b: 1 },
      { k: 'belgi', o: 'tree', m: 'Bargli daraxt', a: 0.7, b: 1 },
    ],
  },
  shamollatish: {
    prompt: 'a bright real living room with two opposite open windows on facing walls, light curtains, wide interior shot, photorealistic',
    obj: { w1: 'the left open window', w2: 'the right open window' },
    steps: [
      { k: 'belgi', o: 'w1', m: 'Ochiq oyna', a: 0.0, b: 1 },
      { k: 'belgi', o: 'w2', m: 'Qarshi oyna', a: 0.25, b: 1 },
      { k: 'strelka', f: 'w1', to: 'w2', m: 'Havo oqimi', a: 0.4, b: 0.95, havo: true },
    ],
  },
};

// Gemini ko'rish: obyektlar qutisi [ymin,xmin,ymax,xmax] (0..1000) -> {nom:{cx,cy,w,h}} (0..1)
export async function obyektJoyi(env, fotoBuf, obj, geminiJson) {
  const royxat = Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('; ');
  const r = await geminiJson(env.GEMINI_API_KEY, [
    { inline_data: { mime_type: 'image/jpeg', data: (await sharp(fotoBuf).resize(768, 768, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer()).toString('base64') } },
    { text: `Find each object in the image and return its bounding box. Objects (key: description): ${royxat}. Return ONLY a JSON array: [{"key":"...","box":[ymin,xmin,ymax,xmax]}] with coordinates 0-1000. If an object is not visible, give your best estimate of where it would be.` },
  ]);
  const out = {};
  for (const x of r || []) {
    if (!x || !obj[x.key] || !Array.isArray(x.box) || x.box.length !== 4) continue;
    const [y0, x0, y1, x1] = x.box.map((v) => clamp(Number(v) / 1000));
    out[x.key] = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: Math.max(0.05, x1 - x0), h: Math.max(0.05, y1 - y0) };
  }
  if (Object.keys(out).length < Math.min(2, Object.keys(obj).length)) throw new Error('obyektlar topilmadi');
  return out;
}

function izohSvg(S, cfg, joy, T, aksent, tr) {
  // tr: (nx,ny)->[px,py] (zoom hisobga olingan)
  const pt = (nom) => {
    if (nom === 'sun') return tr(0.9, 0.04);
    const j = joy[nom];
    return j ? tr(j.cx, j.cy) : null;
  };
  let g = '';
  for (const st of cfg.steps) {
    const p = ease(seg(T, st.a, st.a + Math.min(0.2, (st.b - st.a) * 0.5)));
    const chiq = 1 - seg(T, st.b - 0.05, st.b);
    const al = p * (st.b >= 1 ? 1 : chiq);
    if (al <= 0.01) continue;
    if (st.k === 'belgi') {
      const j = pt(st.o); if (!j) continue;
      const w = 28 + st.m.length * 15.5, x = Math.max(8, Math.min(S - w - 8, j[0] - w / 2)), y = Math.max(10, Math.min(S - 50, j[1] - 60));
      g += `<g opacity="${al}"><circle cx="${j[0]}" cy="${j[1]}" r="9" fill="${aksent}" stroke="#fff" stroke-width="3"/><line x1="${j[0]}" y1="${j[1] - 9}" x2="${x + w / 2}" y2="${y + 38}" stroke="#fff" stroke-width="3"/><rect x="${x}" y="${y}" width="${w}" height="40" rx="20" fill="#16150f" fill-opacity="0.82"/><text x="${x + w / 2}" y="${y + 27}" text-anchor="middle" font-family="${FF}" font-size="23" font-weight="700" fill="#fff">${st.m}</text></g>`;
    } else if (st.k === 'strelka') {
      const A = pt(st.f), B = pt(st.to); if (!A || !B) continue;
      const k = seg(T, st.a, st.a + (st.b - st.a) * 0.6);
      const ex = A[0] + (B[0] - A[0]) * ease(k), ey = A[1] + (B[1] - A[1]) * ease(k);
      const ang = Math.atan2(B[1] - A[1], B[0] - A[0]), ah = 26;
      const wave = st.havo ? Array.from({ length: 24 }, (_, i) => { const u = i / 23 * ease(k); const x = A[0] + (B[0] - A[0]) * u, y = A[1] + (B[1] - A[1]) * u + Math.sin(u * 14) * 14; return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ') : `M${A[0]},${A[1]} L${ex},${ey}`;
      const col = st.havo ? '#2f7fb0' : '#ffb21f';
      g += `<g opacity="${al}"><path d="${wave}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="12" stroke-linecap="round"/><path d="${wave}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round"/>`;
      if (k > 0.2) g += `<polygon points="${ex},${ey} ${ex - ah * Math.cos(ang - 0.45)},${ey - ah * Math.sin(ang - 0.45)} ${ex - ah * Math.cos(ang + 0.45)},${ey - ah * Math.sin(ang + 0.45)}" fill="${col}" stroke="#000" stroke-opacity="0.35" stroke-width="2"/>`;
      if (st.m && k > 0.5) { const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2 - 24; const w = 28 + st.m.length * 15.5; g += `<rect x="${mx - w / 2}" y="${my - 24}" width="${w}" height="40" rx="20" fill="#16150f" fill-opacity="0.82"/><text x="${mx}" y="${my + 3}" text-anchor="middle" font-family="${FF}" font-size="23" font-weight="700" fill="#fff">${st.m}</text>`; }
      g += '</g>';
    }
  }
  return `<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
}

// Foto + animatsion izohlar -> kadrlar (12.5 fps). Tashqi qatlam (sarlavha/logo) ov bilan qo'shiladi.
export async function fotoIzohKadrlar({ nom, fotoBuf, joy, dur, dir, t0, t1, aksent, ovBuf, SAHNA_BG }) {
  const cfg = SAHNA_FOTO[nom];
  const fps = 10, n = Math.max(2, Math.round(dur * fps)), S = 880, SRC = 1056;
  fs.mkdirSync(dir, { recursive: true });
  const baza = await sharp({ create: { width: 1080, height: 1920, channels: 3, background: SAHNA_BG } }).png().toBuffer();
  const src = await sharp(fotoBuf).resize(SRC, SRC, { fit: 'cover' }).toBuffer();
  const mask = Buffer.from(`<svg width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="36" fill="#fff"/></svg>`);
  for (let k = 0; k < n; k++) {
    const q = Math.min(1, k / (n - 1) / 0.9);
    const T = t0 + (t1 - t0) * q;
    const zoom = 1 + 0.06 * T; // sahna davomida sekin yaqinlashadi
    const cs = Math.round(SRC / zoom), off = Math.round((SRC - cs) / 2);
    const tr = (nx, ny) => [(nx - 0.5) * zoom * S + S / 2, (ny - 0.5) * zoom * S + S / 2];
    const rasm = await sharp(src).extract({ left: off, top: off, width: cs, height: cs }).resize(S, S).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    const iz = await sharp(Buffer.from(izohSvg(S, cfg, joy, T, aksent, tr))).png().toBuffer();
    await sharp(baza).composite([{ input: rasm, left: 100, top: 740 }, { input: iz, left: 100, top: 740 }, { input: ovBuf, left: 0, top: 0 }]).jpeg({ quality: 88 }).toFile(path.join(dir, `f${String(k).padStart(4, '0')}.jpg`));
  }
  return fps;
}
