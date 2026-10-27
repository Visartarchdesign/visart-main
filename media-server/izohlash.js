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


// Hayotiy effektlar: nur dastasi + chang zarralari, havo oqimi zarralari, issiq/sovuq nur, soya, fokus, olcham.
function rnd(i, s = 1) { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); }
function effektSvg(st, A, B, T, al, S, defs) {
  const id = 'e' + Math.floor(rnd(st.a * 1000 + (st.ga ? 7 : 3)) * 1e6);
  const ph = T * 6;
  let g = '';
  if (st.k === 'nur' && A) {
    const to = B || [A[0] - 160, A[1] + 420];
    const dx = to[0] - A[0], dy = to[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const k = ease(seg(T, st.a, st.a + 0.25)), w0 = 26, w1 = 150;
    const ex = A[0] + dx * k, ey = A[1] + dy * k;
    defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${A[0]}" y1="${A[1]}" x2="${ex}" y2="${ey}"><stop offset="0" stop-color="#fff3c4" stop-opacity="0.85"/><stop offset="0.7" stop-color="#ffe08a" stop-opacity="0.38"/><stop offset="1" stop-color="#ffd35a" stop-opacity="0.06"/></linearGradient><filter id="${id}b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>`);
    for (let r = 0; r < 3; r++) {
      const o = (r - 1) * 0.36, sh = 0.85 + 0.15 * Math.sin(ph * 1.3 + r * 2);
      g += `<polygon filter="url(#${id}b)" fill="url(#${id})" opacity="${(0.55 * sh).toFixed(3)}" points="${A[0] + nx * w0 * o},${A[1] + ny * w0 * o} ${A[0] - nx * w0 * 0.5 + nx * w0 * o},${A[1] - ny * w0 * 0.5 + ny * w0 * o} ${ex - nx * w1 * 0.5 + nx * w1 * o * 0.6},${ey - ny * w1 * 0.5 + ny * w1 * o * 0.6} ${ex + nx * w1 * 0.5 + nx * w1 * o * 0.6},${ey + ny * w1 * 0.5 + ny * w1 * o * 0.6} ${A[0] + nx * w0 * 0.5 + nx * w0 * o},${A[1] + ny * w0 * 0.5 + ny * w0 * o}"/>`;
    }
    for (let i = 0; i < 34; i++) { // havodagi chang zarralari nurda suzadi
      const u = (rnd(i) + ph * 0.05 * (0.4 + rnd(i, 2))) % 1, lat = (rnd(i, 3) - 0.5) * (w0 + (w1 - w0) * u) * 0.9;
      const x = A[0] + dx * k * u + nx * lat + Math.sin(ph + i) * 6, y = A[1] + dy * k * u + ny * lat + Math.cos(ph * 0.8 + i) * 5;
      g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.6 + rnd(i, 4) * 2.6).toFixed(1)}" fill="#fff" opacity="${(0.25 + 0.55 * rnd(i, 5) * Math.abs(Math.sin(ph * 0.7 + i))).toFixed(2)}"/>`;
    }
    g = `<g opacity="${al}" style="mix-blend-mode:screen">${g}</g>`;
  } else if (st.k === 'oqim' && A && B) { // havo oqimi: egri chiziqlar bo'ylab yugurayotgan zarralar
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const k = ease(seg(T, st.a, st.a + 0.2));
    for (let l = 0; l < 5; l++) {
      const off = (l - 2) * 34, pts = [];
      for (let i = 0; i <= 28; i++) { const u = i / 28 * k; const w = Math.sin(u * 9 + l) * 16 + off; pts.push(`${i ? 'L' : 'M'}${(A[0] + dx * u + nx * w).toFixed(1)},${(A[1] + dy * u + ny * w).toFixed(1)}`); }
      g += `<path d="${pts.join(' ')}" fill="none" stroke="#bfe6ff" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>`;
      for (let j = 0; j < 6; j++) {
        const u = ((ph * 0.12 + j / 6 + l * 0.13) % 1) * k, w = Math.sin(u * 9 + l) * 16 + off;
        g += `<circle cx="${(A[0] + dx * u + nx * w).toFixed(1)}" cy="${(A[1] + dy * u + ny * w).toFixed(1)}" r="${(4 + 2 * Math.sin(j + l)).toFixed(1)}" fill="#e8f6ff" opacity="${(0.85 * Math.sin(Math.PI * Math.min(1, u / Math.max(k, 0.01)))).toFixed(2)}"/>`;
      }
    }
    g = `<g opacity="${al}">${g}</g>`;
  } else if ((st.k === 'issiq' || st.k === 'sovuq') && A) {
    const hot = st.k === 'issiq', c1 = hot ? '#ff8a2a' : '#4fb4ff', c2 = hot ? '#ff3d00' : '#2a6fff';
    const R = (st.r || 190) * (0.92 + 0.08 * Math.sin(ph * 1.6));
    defs.push(`<radialGradient id="${id}"><stop offset="0" stop-color="${c1}" stop-opacity="0.65"/><stop offset="0.55" stop-color="${c2}" stop-opacity="0.22"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></radialGradient>`);
    g += `<circle cx="${A[0]}" cy="${A[1]}" r="${(R * ease(seg(T, st.a, st.a + 0.18))).toFixed(1)}" fill="url(#${id})" style="mix-blend-mode:screen"/>`;
    for (let i = 0; i < 7; i++) { // yuqoriga ko'tarilgan issiq to'lqin / tushayotgan sovuq
      const u = (ph * 0.09 + i / 7) % 1, x = A[0] + (rnd(i, 8) - 0.5) * R * 1.2 + Math.sin(ph + i * 2) * 10, y = A[1] + (hot ? -1 : 1) * u * R * 0.9;
      g += `<path d="M${x - 14},${y} q7,-14 14,0 t14,0" fill="none" stroke="${hot ? '#ffd9a0' : '#d6efff'}" stroke-width="3" stroke-linecap="round" opacity="${(0.6 * Math.sin(Math.PI * u)).toFixed(2)}"/>`;
    }
    g = `<g opacity="${al}">${g}</g>`;
  } else if (st.k === 'soya' && A) {
    const w = (st.w || 420), h = (st.h || 160), sl = ease(seg(T, st.a, st.b)) * 90;
    defs.push(`<filter id="${id}" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="22"/></filter>`);
    g = `<ellipse filter="url(#${id})" cx="${A[0] + sl}" cy="${A[1]}" rx="${w / 2}" ry="${h / 2}" fill="#0b0b12" opacity="${(0.5 * al).toFixed(3)}"/>`;
  } else if (st.k === 'fokus' && A) {
    const r = (st.r || 190) * (0.97 + 0.03 * Math.sin(ph * 2));
    defs.push(`<radialGradient id="${id}" cx="${A[0]}" cy="${A[1]}" r="${r * 2.2}" gradientUnits="userSpaceOnUse"><stop offset="0.35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></radialGradient>`);
    g = `<rect width="${S}" height="${S}" fill="url(#${id})" opacity="${al}"/><circle cx="${A[0]}" cy="${A[1]}" r="${r}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="14 12" stroke-dashoffset="${(-ph * 18).toFixed(0)}" opacity="${(0.8 * al).toFixed(2)}"/>`;
  } else if (st.k === 'olcham' && A && B) {
    const k = ease(seg(T, st.a, st.a + 0.2)), ex = A[0] + (B[0] - A[0]) * k, ey = A[1] + (B[1] - A[1]) * k;
    const ang = Math.atan2(B[1] - A[1], B[0] - A[0]) + Math.PI / 2, c = 18, ca = Math.cos(ang) * c, sa = Math.sin(ang) * c;
    g = `<g opacity="${al}" stroke="#fff" stroke-width="5" stroke-linecap="round"><line x1="${A[0]}" y1="${A[1]}" x2="${ex}" y2="${ey}" stroke="#000" stroke-opacity="0.35" stroke-width="10"/><line x1="${A[0]}" y1="${A[1]}" x2="${ex}" y2="${ey}"/><line x1="${A[0] - ca}" y1="${A[1] - sa}" x2="${A[0] + ca}" y2="${A[1] + sa}"/><line x1="${ex - ca}" y1="${ey - sa}" x2="${ex + ca}" y2="${ey + sa}"/></g>`;
    if (st.m && k > 0.6) { const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, w = 36 + st.m.length * 20; g += `<g opacity="${al}"><rect x="${mx - w / 2}" y="${my - 27}" width="${w}" height="54" rx="27" fill="#16150f" fill-opacity="0.85"/><text x="${mx}" y="${my + 12}" font-family="${FF}" font-size="34" font-weight="700" fill="#fff" text-anchor="middle">${esc(st.m)}</text></g>`; }
  }
  return g;
}
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function izohSvg(S, cfg, joy, T, aksent, tr) {
  const defs = [];
  // tr: (nx,ny)->[px,py] (zoom hisobga olingan)
  const pt = (nom) => {
    if (nom === 'sun') return tr(0.9, 0.04);
    const j = joy[nom];
    return j ? tr(j.cx, j.cy) : null;
  };
  let g = '';
  const fxK = (k) => (k === 'belgi' || k === 'strelka' ? 1 : 0);
  for (const st of [...cfg.steps].sort((x, y) => fxK(x.k) - fxK(y.k))) {
    const p = ease(seg(T, st.a, st.a + Math.min(0.2, (st.b - st.a) * 0.5)));
    const chiq = 1 - seg(T, st.b - 0.05, st.b);
    const al = p * (st.b >= 1 ? 1 : chiq);
    if (al <= 0.01) continue;
    if (st.k !== 'belgi' && st.k !== 'strelka') { g += effektSvg(st, pt(st.f || st.o), st.to ? pt(st.to) : null, T, al, S, defs); continue; }
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
  return `<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg"><defs>${defs.join('')}</defs>${g}</svg>`;
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
  // Hayotiy effektlar: [{k:'nur|oqim|issiq|sovuq|soya|fokus|olcham', ob:i, ga:j, m}]
  const KL = ['nur', 'oqim', 'issiq', 'sovuq', 'soya', 'fokus', 'olcham'];
  (Array.isArray(sl.effektlar) ? sl.effektlar : []).slice(0, 4).forEach((e, ei) => {
    if (!e || !KL.includes(e.k) || !obj['o' + e.ob]) return;
    const a = Math.min(0.75, 0.06 + (0.72 * (Number(e.ob) + 0.5)) / n + 0.03 * ei);
    steps.push({ k: e.k, f: 'o' + e.ob, to: obj['o' + e.ga] ? 'o' + e.ga : undefined, m: e.m ? String(e.m).slice(0, 18) : '', a, b: e.k === 'fokus' ? Math.min(1, a + 0.3) : 1 });
  });
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
