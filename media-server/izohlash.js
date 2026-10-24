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
      const w = 36 + st.m.length * 20, x = Math.max(8, Math.min(S - w - 8, j[0] - w / 2)), y = Math.max(10, Math.min(S - 64, j[1] - 80));
      g += `<g opacity="${al}"><circle cx="${j[0]}" cy="${j[1]}" r="12" fill="${aksent}" stroke="#fff" stroke-width="3"/><line x1="${j[0]}" y1="${j[1] - 12}" x2="${x + w / 2}" y2="${y + 52}" stroke="#fff" stroke-width="3"/><rect x="${x}" y="${y}" width="${w}" height="54" rx="27" fill="#16150f" fill-opacity="0.82"/><text x="${x + w / 2}" y="${y + 37}" text-anchor="middle" font-family="${FF}" font-size="31" font-weight="700" fill="#fff">${st.m}</text></g>`;
    } else if (st.k === 'strelka') {
      const A = pt(st.f), B = pt(st.to); if (!A || !B) continue;
      const k = seg(T, st.a, st.a + (st.b - st.a) * 0.6);
      const ex = A[0] + (B[0] - A[0]) * ease(k), ey = A[1] + (B[1] - A[1]) * ease(k);
      const ang = Math.atan2(B[1] - A[1], B[0] - A[0]), ah = 26;
      const wave = st.havo ? Array.from({ length: 24 }, (_, i) => { const u = i / 23 * ease(k); const x = A[0] + (B[0] - A[0]) * u, y = A[1] + (B[1] - A[1]) * u + Math.sin(u * 14) * 14; return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ') : `M${A[0]},${A[1]} L${ex},${ey}`;
      const col = st.havo ? '#2f7fb0' : '#ffb21f';
      g += `<g opacity="${al}"><path d="${wave}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="12" stroke-linecap="round"/><path d="${wave}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round"/>`;
      if (k > 0.2) g += `<polygon points="${ex},${ey} ${ex - ah * Math.cos(ang - 0.45)},${ey - ah * Math.sin(ang - 0.45)} ${ex - ah * Math.cos(ang + 0.45)},${ey - ah * Math.sin(ang + 0.45)}" fill="${col}" stroke="#000" stroke-opacity="0.35" stroke-width="2"/>`;
      if (st.m && k > 0.5) { const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2 - 24; const w = 36 + st.m.length * 20; g += `<rect x="${mx - w / 2}" y="${my - 30}" width="${w}" height="54" rx="27" fill="#16150f" fill-opacity="0.82"/><text x="${mx}" y="${my + 8}" text-anchor="middle" font-family="${FF}" font-size="31" font-weight="700" fill="#fff">${st.m}</text>`; }
      g += '</g>';
    }
  }
  return `<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
}

// Slayd belgilaridan (Gemini senariysi) izoh konfiguratsiyasi: belgilar [{ob,m}], oqim [[i,j,m]]
export function slaydIzohCfg(sl) {
  const bl = (Array.isArray(sl.belgilar) ? sl.belgilar : []).filter((x) => x && x.ob && x.m).slice(0, 4);
  if (!bl.length) return null;
  const obj = {}, steps = [];
  const n = bl.length;
  bl.forEach((x, i) => {
    obj['o' + i] = String(x.ob);
    const a = 0.06 + (0.72 * i) / n;
    steps.push({ k: 'belgi', o: 'o' + i, m: String(x.m).slice(0, 22), a, b: 1 });
  });
  for (const q of (Array.isArray(sl.oqim) ? sl.oqim : []).slice(0, 2)) {
    if (!Array.isArray(q) || !obj['o' + q[0]] || !obj['o' + q[1]]) continue;
    const a = 0.06 + (0.72 * Math.max(q[0], q[1])) / n + 0.06;
    steps.push({ k: 'strelka', f: 'o' + q[0], to: 'o' + q[1], m: q[2] ? String(q[2]).slice(0, 20) : '', a: Math.min(a, 0.8), b: 1, havo: /havo|shamol|oqim/i.test(String(q[2] || '')) });
  }
  return { obj, steps };
}

// Foto + animatsion izohlar -> kadrlar (25 fps, silliq zoom: 3x supersample, titroqsiz).
export async function fotoIzohKadrlar({ nom, cfg: cfg0, fotoBuf, joy, dur, dir, t0, t1, aksent, ovBuf, SAHNA_BG, zk = 0.06 }) {
  const cfg = cfg0 || SAHNA_FOTO[nom];
  const fps = 25, n = Math.max(2, Math.round(dur * fps)), S = 880, SRC = 2640;
  fs.mkdirSync(dir, { recursive: true });
  const baza = await sharp({ create: { width: 1080, height: 1920, channels: 3, background: SAHNA_BG } }).png().toBuffer();
  const src = await sharp(fotoBuf).resize(SRC, SRC, { fit: 'cover', kernel: 'lanczos3' }).toBuffer();
  const mask = Buffer.from(`<svg width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="36" fill="#fff"/></svg>`);
  const kadr = async (k) => {
    const q = Math.min(1, k / (n - 1) / 0.92);
    const T = t0 + (t1 - t0) * q;
    const zoom = 1 + zk * ease(clamp(k / (n - 1)));
    const cs = Math.round(SRC / zoom), off = Math.round((SRC - cs) / 2);
    const tr = (nx, ny) => [(nx - 0.5) * (SRC / cs) * S + S / 2, (ny - 0.5) * (SRC / cs) * S + S / 2];
    const rasm = await sharp(src).extract({ left: off, top: off, width: cs, height: cs }).resize(S, S, { kernel: 'lanczos3' }).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    const iz = await sharp(Buffer.from(izohSvg(S, cfg, joy, T, aksent, tr))).png().toBuffer();
    await sharp(baza).composite([{ input: rasm, left: 100, top: 740 }, { input: iz, left: 100, top: 740 }, { input: ovBuf, left: 0, top: 0 }]).jpeg({ quality: 90 }).toFile(path.join(dir, `f${String(k).padStart(4, '0')}.jpg`));
  };
  for (let k = 0; k < n; k += 4) await Promise.all([0, 1, 2, 3].filter((d) => k + d < n).map((d) => kadr(k + d)));
  return fps;
}
