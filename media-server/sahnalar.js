// Kod bilan chizilgan animatsion arxitektura sahnalari (makon_vizual uslubi). Tashqi AI/kvota kerak emas.
// Har sahna: (t 0..1, A aksent rang) => 720x720 viewBox ichidagi SVG.
const INK = '#16150f', W1 = '#e6e1d4', W2 = '#d6cfbd', FL = '#cbc3ae', BG = '#ecebe6';
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (t, a, b) => ease(clamp((t - a) / (b - a)));
const ping = (t) => (t < 0.5 ? ease(t * 2) : ease(2 - t * 2));
const mix = (c1, c2, k) => {
  const n = (c) => (c.length === 4 ? '#' + c.slice(1).split('').map((x) => x + x).join('') : c);
  const p = (c) => [1, 3, 5].map((i) => parseInt(n(c).slice(i, i + 2), 16));
  const a = p(c1), b = p(c2);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('');
};

// izometrik proyeksiya: x o'ngga-pastga, y chapga-pastga, z yuqoriga
const S = 62, CX = 360, CY = 250;
const P = (x, y, z = 0) => [CX + (x - y) * 0.866 * S, CY + (x + y) * 0.5 * S - z * S];
const pts = (arr) => arr.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
const poly = (arr, fill, extra = '') => `<polygon points="${pts(arr)}" fill="${fill}" ${/stroke="none"/.test(extra) ? '' : `stroke="${INK}" stroke-width="2.5"`} stroke-linejoin="round" ${extra}/>`;
function quad(a, b, c, d, fill, extra) { return poly([P(...a), P(...b), P(...c), P(...d)], fill, extra); }
function box(x, y, z, w, d, h, top, left, right) {
  return quad([x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h], top) +
    quad([x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h], right || left) +
    quad([x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h], left);
}
// xona: pol + ikki orqa devor (x=0 chap devor, y=0 o'ng devor)
function xonaBaza(Wd, Dp, H, wallL = W2, wallR = W1, floor = FL) {
  return quad([0, 0, 0], [Wd, 0, 0], [Wd, Dp, 0], [0, Dp, 0], floor) +
    quad([0, 0, 0], [0, Dp, 0], [0, Dp, H], [0, 0, H], wallL) +
    quad([0, 0, 0], [Wd, 0, 0], [Wd, 0, H], [0, 0, H], wallR);
}
const bosh = (inner) => `<g>${inner}</g>`;

export const SAHNALAR = {
  quyosh_xona: {
    tavsif: "izometrik xona, oynadan tushayotgan quyosh dog'i polda siljiydi (quyosh burchagi, yorug'lik, yo'nalish, janub/shimol oynalar)",
    svg(t, A) {
      const e = ping(t);
      const sun = [560 - 60 * e, 90 + 40 * e];
      const k = 0.8 + 2.2 * e; // dog' siljishi
      const win = [[1.2, 0, 1.0], [3.4, 0, 1.0], [3.4, 0, 2.5], [1.2, 0, 2.5]];
      const patch = [[1.2 + k * 0.4, 0.2 + k, 0], [3.4 + k * 0.4, 0.2 + k, 0], [3.4 + k * 0.4 + 0.5, 0.2 + k + 1.1, 0], [1.2 + k * 0.4 + 0.5, 0.2 + k + 1.1, 0]];
      return bosh(
        `<circle cx="${sun[0]}" cy="${sun[1]}" r="46" fill="${A}" fill-opacity="0.25"/><circle cx="${sun[0]}" cy="${sun[1]}" r="26" fill="${A}"/>` +
        xonaBaza(5, 5, 3) +
        quad(...win, mix('#cfe6ee', '#fbe9c0', e), '') +
        `<line x1="${P(2.3, 0, 1)[0]}" y1="${P(2.3, 0, 1)[1]}" x2="${P(2.3, 0, 2.5)[0]}" y2="${P(2.3, 0, 2.5)[1]}" stroke="${INK}" stroke-width="2.5"/>` +
        quad(...patch, A, 'fill-opacity="0.38" stroke-opacity="0.35"') +
        box(0.4, 2.6, 0, 1.0, 2.2, 0.8, '#b9b09a', '#a69d86', '#b3aa93') + box(0.3, 2.6, 0.8, 0.45, 2.2, 0.8, '#b9b09a', '#a69d86', '#b3aa93') +
        box(3.4, 3.4, 0, 1.3, 1.3, 0.35, A, mix(A, '#000000', 0.18), mix(A, '#000000', 0.08)),
      );
    },
  },
  lampa_kelvin: {
    tavsif: "lampa nur harorati: iliq 2700K dan sovuq 6500K gacha, devor va xona rangi o'zgaradi (oq/sariq chiroq, Kelvin)",
    svg(t, A) {
      const e = ping(t);
      const nur = mix('#ffb46b', '#d6e8ff', e);
      const devor = mix('#efd9b8', '#dfe8f2', e);
      const kelv = Math.round(2700 + e * 3800);
      const kx = 120 + e * 480;
      return bosh(
        `<rect x="40" y="60" width="640" height="420" rx="18" fill="${devor}" stroke="${INK}" stroke-width="2.5"/>` +
        `<rect x="40" y="440" width="640" height="40" fill="${mix('#b9a98c', '#aab4c0', e)}" stroke="${INK}" stroke-width="2.5"/>` +
        `<defs><radialGradient id="g"><stop offset="0" stop-color="${nur}" stop-opacity="0.95"/><stop offset="1" stop-color="${nur}" stop-opacity="0"/></radialGradient></defs>` +
        `<circle cx="360" cy="220" r="${190 + 20 * Math.sin(t * 6.28)}" fill="url(#g)"/>` +
        `<rect x="340" y="250" width="40" height="190" fill="${INK}" fill-opacity="0.8"/><rect x="300" y="430" width="120" height="14" rx="6" fill="${INK}"/>` +
        `<path d="M300,250 L420,250 L395,160 L325,160 Z" fill="${nur}" stroke="${INK}" stroke-width="3"/>` +
        `<rect x="110" y="520" width="500" height="22" rx="11" fill="url(#bar)" stroke="${INK}" stroke-width="2.5"/>` +
        `<defs><linearGradient id="bar" x1="0" x2="1"><stop offset="0" stop-color="#ffb46b"/><stop offset="1" stop-color="#d6e8ff"/></linearGradient></defs>` +
        `<circle cx="${kx}" cy="531" r="22" fill="#fff" stroke="${INK}" stroke-width="3.5"/>` +
        ` <text x="${kx}" y="650" text-anchor="middle" font-family="Liberation Sans, Arial" font-weight="700" font-size="40" fill="${INK}">${kelv}K</text>` +
        `<text x="110" y="574" font-family="Liberation Sans, Arial" font-size="22" fill="${INK}" fill-opacity="0.65">iliq</text><text x="610" y="574" text-anchor="end" font-family="Liberation Sans, Arial" font-size="22" fill="${INK}" fill-opacity="0.65">sovuq</text>`,
      );
    },
  },
  oyna_parda: {
    tavsif: "katta oyna va parda ochilib-yopiladi, kunduzgi yorug'lik nuri polga tushadi (parda, jalyuzi, tabiiy yorug'lik, oyna o'lchami)",
    svg(t, A) {
      const e = ping(t);
      const ochiq = 150 * (1 - e) + 12;
      return bosh(
        `<rect x="60" y="60" width="600" height="560" fill="${W1}" stroke="${INK}" stroke-width="2.5"/>` +
        `<rect x="60" y="560" width="600" height="60" fill="${FL}" stroke="${INK}" stroke-width="2.5"/>` +
        `<rect x="180" y="120" width="360" height="360" fill="${mix('#bfe0ef', '#fff3cf', 1 - e)}" stroke="${INK}" stroke-width="6"/>` +
        `<line x1="360" y1="120" x2="360" y2="480" stroke="${INK}" stroke-width="5"/><line x1="180" y1="300" x2="540" y2="300" stroke="${INK}" stroke-width="5"/>` +
        `<circle cx="470" cy="190" r="30" fill="${A}"/>` +
        `<polygon points="${180},${480} ${540},${480} ${620 + 20 * (1 - e)},620 ${100 - 20 * (1 - e)},620" fill="${A}" fill-opacity="${0.12 + 0.28 * (1 - e)}"/>` +
        `<path d="M${180 - 60},100 h${60 + ochiq} v420 h-${60 + ochiq} z" fill="${mix(A, '#ffffff', 0.55)}" stroke="${INK}" stroke-width="3"/>` +
        `<path d="M${540 + 60},100 h-${60 + ochiq} v420 h${60 + ochiq} z" fill="${mix(A, '#ffffff', 0.55)}" stroke="${INK}" stroke-width="3"/>` +
        `<line x1="100" y1="100" x2="620" y2="100" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`,
      );
    },
  },
  planirovka: {
    tavsif: "yuqoridan ko'rinish: devorlar chiziladi, xonalar va mebel paydo bo'ladi (planirovka, xonalar joylashuvi, zonalash, o'lcham)",
    svg(t, A) {
      const dev = (d) => `stroke-dasharray="1400" stroke-dashoffset="${(1 - d) * 1400}"`;
      const d1 = seg(t, 0.0, 0.5), d2 = seg(t, 0.35, 0.65);
      const f = (a) => seg(t, a, a + 0.15);
      return bosh(
        `<rect x="90" y="90" width="540" height="540" fill="none" stroke="${INK}" stroke-width="12" ${dev(d1)}/>` +
        `<path d="M360,90 V420 M90,420 H360 M360,300 H630" fill="none" stroke="${INK}" stroke-width="8" ${dev(d2)}/>` +
        `<g opacity="${f(0.6)}"><rect x="120" y="120" width="190" height="110" rx="8" fill="${A}" fill-opacity="0.75" stroke="${INK}" stroke-width="3"/><circle cx="220" cy="175" r="22" fill="#fff" fill-opacity="0.5"/></g>` +
        `<g opacity="${f(0.7)}"><rect x="400" y="130" width="190" height="120" rx="8" fill="${W2}" stroke="${INK}" stroke-width="3"/><rect x="420" y="150" width="70" height="70" rx="35" fill="${A}" fill-opacity="0.5" stroke="${INK}" stroke-width="3"/></g>` +
        `<g opacity="${f(0.8)}"><rect x="120" y="460" width="210" height="130" rx="8" fill="${W2}" stroke="${INK}" stroke-width="3"/><rect x="140" y="480" width="170" height="40" rx="6" fill="${A}" fill-opacity="0.6" stroke="${INK}" stroke-width="3"/></g>` +
        `<g opacity="${f(0.85)}"><rect x="410" y="350" width="190" height="240" rx="8" fill="${W1}" stroke="${INK}" stroke-width="3"/><rect x="430" y="380" width="150" height="70" fill="${A}" fill-opacity="0.45" stroke="${INK}" stroke-width="3"/></g>` +
        `<g opacity="${f(0.9)}" stroke="${INK}" stroke-width="2" fill="none"><path d="M90,650 H630 M90,640 v20 M630,640 v20"/><path d="M660,90 V630 M650,90 h20 M650,630 h20"/></g>`,
      );
    },
  },
  kichik_xona: {
    tavsif: "kichik xona: mebel ketma-ket joylashadi, joy tejash (kichik xona, multifunksional mebel, ixcham, 2 xonali dan 3 xonaliga)",
    svg(t, A) {
      const a = (s) => 1 - seg(t, s, s + 0.2);
      const o = (v) => v * a(0);
      return bosh(
        xonaBaza(4, 4, 3) +
        box(0.2 + a(0) * 5, 0.2, 0, 1.0, 2.2, 0.7, mix(A, '#fff', 0.55), mix(A, '#000', 0.12), mix(A, '#000', 0.04)) +
        box(2.2, 0.15 - a(0.2) * 4, 0, 1.6, 0.8, 0.9, '#c0b59c', '#a99d83', '#b5a98f') +
        box(0.15, 2.7 + a(0.4) * 5, 0, 1.3, 1.2, 0.5, A, mix(A, '#000', 0.2), mix(A, '#000', 0.1)) +
        box(2.6 + a(0.55) * 5, 2.4, 0, 1.0, 1.0, 1.9, '#d9d0bb', '#c2b8a0', '#cdc3ab') +
        `<g opacity="${seg(t, 0.8, 0.95)}"><path d="M${P(0, 4.5, 0)[0]},${P(0, 4.5, 0)[1] + 18} L${P(4, 4.5, 0)[0]},${P(4, 4.5, 0)[1] + 18}" stroke="${INK}" stroke-width="3"/><text x="${(P(0, 4.5, 0)[0] + P(4, 4.5, 0)[0]) / 2}" y="${P(2, 4.5, 0)[1] + 60}" text-anchor="middle" font-family="Liberation Sans, Arial" font-weight="700" font-size="34" fill="${INK}">4 × 4 m</text></g>`,
      );
    },
  },
  rang_palitra: {
    tavsif: "rang palitrasi va xona devor rangi almashadi (rang tanlash, 60-30-10 qoidasi, iliq/sovuq ranglar, kontrast)",
    svg(t, A) {
      const pal = ['#d9c7a8', '#9bb3a4', A, '#2f3b52', '#e9dfcf'];
      const idx = Math.min(4, Math.floor(t * 5));
      const wall = pal[idx];
      return bosh(
        xonaBaza(5, 5, 3, wall, mix(wall, '#ffffff', 0.25)) +
        box(1, 1.8, 0, 2.2, 1.0, 0.7, mix(pal[(idx + 2) % 5], '#fff', 0.35), pal[(idx + 2) % 5], mix(pal[(idx + 2) % 5], '#000', 0.12)) +
        pal.map((c, i) => {
          const s = seg(t, i * 0.12, i * 0.12 + 0.2);
          return `<circle cx="${130 + i * 115}" cy="${620 - 12 * (i === idx ? 1 : 0)}" r="${(i === idx ? 44 : 34) * s}" fill="${c}" stroke="${INK}" stroke-width="3"/>`;
        }).join(''),
      );
    },
  },
  hovli_soya: {
    tavsif: "uy va quyosh yoyi: soya uzunligi kun davomida o'zgaradi (hovli, soya, quyosh yo'nalishi, yoz issiqligi, ayvon, daraxt)",
    svg(t, A) {
      const e = t; // 0 ertalab .. 1 kech
      const ang = Math.PI * (0.12 + 0.76 * e);
      const sx = 360 - Math.cos(ang) * 270, sy = 330 - Math.sin(ang) * 270;
      const soya = 1.6 + 2.6 * Math.abs(0.5 - e) * 2; // tushda qisqa
      const dir = e < 0.5 ? 1 : -1;
      return bosh(
        `<path d="M90,330 A270,270 0 0 1 630,330" fill="none" stroke="${INK}" stroke-opacity="0.25" stroke-width="3" stroke-dasharray="8 10"/>` +
        `<circle cx="${sx}" cy="${sy}" r="42" fill="${A}" fill-opacity="0.25"/><circle cx="${sx}" cy="${sy}" r="24" fill="${A}"/>` +
        quad([-0.2, -0.2, 0], [5.2, -0.2, 0], [5.2, 5.2, 0], [-0.2, 5.2, 0], '#cfd8bd') +
        quad([1.5, 1.5, 0], [1.5 + dir * soya * 0.6, 1.5 + soya, 0], [3.5 + dir * soya * 0.6, 1.5 + soya, 0], [3.5, 1.5, 0], INK, 'fill-opacity="0.22" stroke="none"') +
        box(1.5, 1.5, 0, 2.0, 2.0, 1.6, '#eee6d3', '#d8cfb8', '#e2d9c3') +
        poly([P(1.3, 1.3, 1.6), P(3.7, 1.3, 1.6), P(2.5, 2.5, 2.6)], A) +
        poly([P(1.3, 3.7, 1.6), P(3.7, 3.7, 1.6), P(2.5, 2.5, 2.6)], mix(A, '#000', 0.15)) +
        `<circle cx="${P(4.4, 4.2, 0)[0]}" cy="${P(4.4, 4.2, 1.6)[1]}" r="46" fill="#7f9c6b" stroke="${INK}" stroke-width="2.5"/><rect x="${P(4.4, 4.2, 0)[0] - 5}" y="${P(4.4, 4.2, 1.6)[1] + 40}" width="10" height="${P(4.4, 4.2, 0)[1] - P(4.4, 4.2, 1.6)[1] - 40}" fill="${INK}"/>`,
      );
    },
  },
};

export const SAHNA_NOMLARI = Object.keys(SAHNALAR);
export const SAHNA_MENYU = SAHNA_NOMLARI.map((n) => `${n}: ${SAHNALAR[n].tavsif}`).join('\n');
export const SAHNA_BG = BG;
export function sahnaSvg(nom, t, aksent) {
  const s = SAHNALAR[nom];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720">${s.svg(clamp(t), aksent)}</svg>`;
}
