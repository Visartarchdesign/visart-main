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


const FF = 'Liberation Sans, Arial, sans-serif';
// yozuvli ko'rsatkich: (px,py) -> (tx,ty) nishon, a = ko'rinish 0..1
function etiket(px, py, matn, tx, ty, a = 1) {
  if (a <= 0.02) return '';
  const w = matn.length * 14 + 28;
  return `<g opacity="${a.toFixed(2)}"><line x1="${px}" y1="${py}" x2="${tx}" y2="${ty}" stroke="${INK}" stroke-width="2.5"/><circle cx="${tx}" cy="${ty}" r="5" fill="${INK}"/>` +
    `<rect x="${px - w / 2}" y="${py - 20}" width="${w}" height="38" rx="19" fill="#fff" stroke="${INK}" stroke-width="2.5"/>` +
    `<text x="${px}" y="${py + 8}" text-anchor="middle" font-family="${FF}" font-weight="700" font-size="22" fill="${INK}">${matn}</text></g>`;
}
const divan = (x, y, A, len = 2.4) => box(x, y, 0, 1.0, len, 0.5, mix(A, '#ffffff', 0.35), mix(A, '#000000', 0.12), mix(A, '#000000', 0.05)) +
  box(x, y, 0.5, 0.32, len, 0.6, mix(A, '#ffffff', 0.2), mix(A, '#000000', 0.2), mix(A, '#000000', 0.1));
const yostiq = (x, y, c) => box(x, y, 0.5, 0.35, 0.35, 0.3, mix(c, '#ffffff', 0.4), c, mix(c, '#000000', 0.1));
const gilam = (x, y, w, d, c) => quad([x, y, 0.02], [x + w, y, 0.02], [x + w, y + d, 0.02], [x, y + d, 0.02], c);
function osimlik(x, y) {
  const [px, py] = P(x, y, 0.55);
  return box(x, y, 0, 0.45, 0.45, 0.5, '#b88a63', '#a07650', '#ad8159') +
    `<ellipse cx="${px}" cy="${py - 40}" rx="30" ry="42" fill="#6f9a63" stroke="${INK}" stroke-width="2.5"/><ellipse cx="${px - 16}" cy="${py - 18}" rx="18" ry="28" fill="#85ad76" stroke="${INK}" stroke-width="2.5"/>`;
}
function torsher(x, y, nur = '#ffe9b8', yoniq = 0) {
  const [bx, by] = P(x, y, 0), [tx, ty] = P(x, y, 1.9);
  return (yoniq ? `<circle cx="${tx}" cy="${ty + 6}" r="${70 * yoniq}" fill="${nur}" fill-opacity="0.35"/>` : '') +
    `<line x1="${bx}" y1="${by}" x2="${tx}" y2="${ty}" stroke="${INK}" stroke-width="5"/><ellipse cx="${bx}" cy="${by}" rx="18" ry="8" fill="${INK}"/>` +
    `<path d="M${tx - 26},${ty + 6} L${tx + 26},${ty + 6} L${tx + 15},${ty - 32} L${tx - 15},${ty - 32} Z" fill="${nur}" stroke="${INK}" stroke-width="3"/>`;
}
const oynaOyna = (x1, x2, z1, z2, rang) => quad([x1, 0, z1], [x2, 0, z1], [x2, 0, z2], [x1, 0, z2], rang) +
  `<line x1="${P((x1 + x2) / 2, 0, z1)[0]}" y1="${P((x1 + x2) / 2, 0, z1)[1]}" x2="${P((x1 + x2) / 2, 0, z2)[0]}" y2="${P((x1 + x2) / 2, 0, z2)[1]}" stroke="${INK}" stroke-width="2.5"/>`;
export const SAHNALAR = {
  quyosh_xona: {
    tavsif: "oynadan tushayotgan quyosh nuri polga uzayib boradi: quyosh burchagi, yorug'lik, janub/shimol oyna, kun davomida yorug'lik",
    svg(t, A) {
      const k = 0.5 + 2.6 * seg(t, 0.05, 0.9);
      const sun = [610 - 40 * seg(t, 0, 0.9), 80 + 90 * seg(t, 0, 0.9)];
      const win = [[1.2, 0, 1.0], [3.4, 0, 1.0], [3.4, 0, 2.5], [1.2, 0, 2.5]];
      const dx = 0.3 * k;
      const patch = [[1.2 + dx, 0.2 + k, 0], [3.4 + dx, 0.2 + k, 0], [3.4 + dx + 0.4, 0.2 + k + 1.0, 0], [1.2 + dx + 0.4, 0.2 + k + 1.0, 0]];
      const base = [[1.2, 0.05, 0], [3.4, 0.05, 0], [3.4 + dx, 0.2 + k, 0], [1.2 + dx, 0.2 + k, 0]];
      return bosh(
        `<circle cx="${sun[0]}" cy="${sun[1]}" r="46" fill="${A}" fill-opacity="0.25"/><circle cx="${sun[0]}" cy="${sun[1]}" r="26" fill="${A}"/>` +
        xonaBaza(5, 5, 3) + quad(...win, '#cfe6ee') +
        `<line x1="${P(2.3, 0, 1)[0]}" y1="${P(2.3, 0, 1)[1]}" x2="${P(2.3, 0, 2.5)[0]}" y2="${P(2.3, 0, 2.5)[1]}" stroke="${INK}" stroke-width="2.5"/>` +
        gilam(1.6, 2.0, 2.4, 2.2, mix(A, '#ffffff', 0.7)) +
        quad(...base, A, 'fill-opacity="0.2" stroke="none"') + quad(...patch, A, 'fill-opacity="0.34" stroke="none"') +
        divan(0.25, 1.5, '#8d8f86', 2.6) + yostiq(0.35, 1.7, A) + osimlik(4.3, 0.5) +
        etiket(130, 520, 'Quyosh nuri', ...P(2.4 + dx, 0.2 + k + 0.4, 0), seg(t, 0.15, 0.3)) +
        etiket(600, 380, 'Oyna', ...P(3.4, 0, 1.8), seg(t, 0.02, 0.12)) +
        etiket(150, 150, 'Divan', ...P(0.7, 1.7, 1.0), seg(t, 0.6, 0.75)),
      );
    },
  },
  lampa_kelvin: {
    tavsif: "lampa nur harorati: iliq 2700K dan sovuq 6500K gacha, xona ko'rinishi o'zgaradi (oq/sariq chiroq, Kelvin, yoritish)",
    svg(t, A) {
      const e = seg(t, 0.1, 0.9);
      const nur = mix('#ffb46b', '#d6e8ff', e);
      const devor = mix('#efd9b8', '#dfe8f2', e);
      const kelv = Math.round(2700 + e * 3800);
      const kx = 120 + e * 480;
      return bosh(
        `<rect x="40" y="40" width="640" height="440" rx="18" fill="${devor}" stroke="${INK}" stroke-width="2.5"/>` +
        `<rect x="40" y="420" width="640" height="60" fill="${mix('#b9a98c', '#aab4c0', e)}" stroke="${INK}" stroke-width="2.5"/>` +
        `<defs><radialGradient id="g"><stop offset="0" stop-color="${nur}" stop-opacity="0.95"/><stop offset="1" stop-color="${nur}" stop-opacity="0"/></radialGradient>` +
        `<linearGradient id="bar" x1="0" x2="1"><stop offset="0" stop-color="#ffb46b"/><stop offset="1" stop-color="#d6e8ff"/></linearGradient></defs>` +
        `<circle cx="470" cy="190" r="200" fill="url(#g)"/>` +
        // divan va rasm
        `<rect x="70" y="290" width="300" height="130" rx="14" fill="${mix(A, '#ffffff', 0.35)}" stroke="${INK}" stroke-width="3"/><rect x="70" y="250" width="300" height="60" rx="14" fill="${mix(A, '#ffffff', 0.15)}" stroke="${INK}" stroke-width="3"/>` +
        `<rect x="120" y="90" width="150" height="110" fill="${mix(devor, '#ffffff', 0.4)}" stroke="${INK}" stroke-width="3"/><path d="M135,185 l35,-45 l30,30 l25,-25 l30,40 z" fill="${A}" fill-opacity="0.6"/>` +
        // stol va lampa
        `<rect x="430" y="330" width="130" height="14" fill="${INK}"/><rect x="440" y="344" width="10" height="76" fill="${INK}"/><rect x="540" y="344" width="10" height="76" fill="${INK}"/>` +
        `<rect x="486" y="270" width="12" height="60" fill="${INK}"/><path d="M450,275 L535,275 L515,205 L470,205 Z" fill="${nur}" stroke="${INK}" stroke-width="3"/>` +
        `<rect x="110" y="545" width="500" height="22" rx="11" fill="url(#bar)" stroke="${INK}" stroke-width="2.5"/>` +
        `<circle cx="${kx}" cy="556" r="22" fill="#fff" stroke="${INK}" stroke-width="3.5"/>` +
        `<text x="${kx}" y="640" text-anchor="middle" font-family="${FF}" font-weight="700" font-size="42" fill="${INK}">${kelv}K</text>` +
        `<text x="110" y="604" font-family="${FF}" font-size="24" fill="${INK}" fill-opacity="0.7">iliq nur</text><text x="610" y="604" text-anchor="end" font-family="${FF}" font-size="24" fill="${INK}" fill-opacity="0.7">sovuq nur</text>` +
        `<text x="360" y="700" text-anchor="middle" font-family="${FF}" font-weight="700" font-size="30" fill="${INK}">${e < 0.5 ? 'Yashash xonasi: shu yerda to\'xtang' : 'Ofis va ish joyi uchun'}</text>`,
      );
    },
  },
  oyna_parda: {
    tavsif: "katta oyna: parda yopiq holatdan ochiladi, kunduzgi yorug'lik xonaga kiradi (parda, jalyuzi, tabiiy yorug'lik, oyna o'lchami)",
    svg(t, A) {
      const e = seg(t, 0.1, 0.85);
      const ochiq = 12 + 138 * (1 - e) * 0 + (1 - e) * 138; // yopiq(0)-> ochiq(1): parda yig'iladi
      const pw = 175 - 140 * e; // parda kengligi
      return bosh(
        `<rect x="60" y="50" width="600" height="570" fill="${W1}" stroke="${INK}" stroke-width="2.5"/>` +
        `<rect x="60" y="560" width="600" height="60" fill="${FL}" stroke="${INK}" stroke-width="2.5"/>` +
        `<rect x="170" y="110" width="380" height="380" fill="${mix('#9fb8c4', '#bfe0ef', e)}" stroke="${INK}" stroke-width="6"/>` +
        `<line x1="360" y1="110" x2="360" y2="490" stroke="${INK}" stroke-width="5"/><line x1="170" y1="300" x2="550" y2="300" stroke="${INK}" stroke-width="5"/>` +
        `<circle cx="470" cy="180" r="30" fill="${A}" fill-opacity="${0.3 + 0.7 * e}"/>` +
        `<rect x="150" y="490" width="420" height="16" fill="${INK}"/>` +
        `<polygon points="170,506 550,506 ${620 + 10 * e},620 ${100 - 10 * e},620" fill="${A}" fill-opacity="${0.04 + 0.3 * e}"/>` +
        `<path d="M100,98 h${pw} v${420} h-${pw} z" fill="${mix(A, '#ffffff', 0.5)}" stroke="${INK}" stroke-width="3"/>` +
        `<path d="M620,98 h-${pw} v${420} h${pw} z" fill="${mix(A, '#ffffff', 0.5)}" stroke="${INK}" stroke-width="3"/>` +
        `<line x1="90" y1="98" x2="630" y2="98" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>` +
        etiket(150, 640, 'Parda', 110, 330, seg(t, 0.05, 0.15)) + etiket(560, 640, 'Kun nuri', 520, 580, seg(t, 0.5, 0.65)),
      );
    },
  },
  parda_taqqos: {
    tavsif: "parda to'g'ri va noto'g'ri osilishi yonma-yon: karniz shiftga yaqin va oynadan kengroq bo'lsa oyna katta, shift baland ko'rinadi (parda, karniz, oyna ko'rinishi)",
    svg(t, A) {
      const up = seg(t, 0.12, 0.5), wide = seg(t, 0.45, 0.78), fin = seg(t, 0.82, 0.95);
      const panel = (x0, tog) => {
        const cx = x0 + 165, wl = cx - 70, wr = cx + 70, wt = 240, wb = 430;
        const rodY = tog ? 215 - 120 * up : 215;
        const ext = tog ? 95 * wide : 6;
        const cw = tog ? 56 : 52; // parda kengligi
        const bot = tog ? 535 : 470;
        const pc = mix(A, '#ffffff', 0.45);
        return `<rect x="${x0}" y="60" width="330" height="480" fill="${W1}" stroke="${INK}" stroke-width="2.5"/>` +
          `<rect x="${x0}" y="540" width="330" height="40" fill="${FL}" stroke="${INK}" stroke-width="2.5"/>` +
          `<rect x="${wl}" y="${wt}" width="140" height="190" fill="#bfe0ef" stroke="${INK}" stroke-width="5"/><line x1="${cx}" y1="${wt}" x2="${cx}" y2="${wb}" stroke="${INK}" stroke-width="4"/>` +
          `<line x1="${wl - ext - 8}" y1="${rodY}" x2="${wr + ext + 8}" y2="${rodY}" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>` +
          `<rect x="${wl - ext}" y="${rodY + 4}" width="${cw}" height="${bot - rodY - 4}" fill="${pc}" stroke="${INK}" stroke-width="3"/>` +
          `<rect x="${wr + ext - cw}" y="${rodY + 4}" width="${cw}" height="${bot - rodY - 4}" fill="${pc}" stroke="${INK}" stroke-width="3"/>`;
      };
      const yoz = (x, y, m, c, a = 1) => `<text x="${x}" y="${y}" text-anchor="middle" opacity="${a}" font-family="${FF}" font-weight="700" font-size="30" fill="${c}">${m}</text>`;
      return bosh(
        panel(20, false) + panel(370, true) +
        yoz(185, 40, "Noto'g'ri", '#b3261e') + yoz(535, 40, "To'g'ri", '#1f7a4d', seg(t, 0.1, 0.2)) +
        etiket(535, 640, 'Shiftga yaqin', 520, 120, seg(t, 0.3, 0.45) * (1 - seg(t, 0.6, 0.7))) +
        etiket(185, 640, 'Oynadan tor', 150, 330, seg(t, 0.05, 0.15) * (1 - seg(t, 0.45, 0.55))) +
        `<g opacity="${fin}"><text x="360" y="690" text-anchor="middle" font-family="${FF}" font-weight="700" font-size="36" fill="${INK}">Oyna katta, shift baland</text></g>`,
      );
    },
  },
  planirovka: {
    tavsif: "yuqoridan ko'rinish: devorlar chiziladi, xonalar nomlanadi va mebel joylashadi (planirovka, xonalar joylashuvi, zonalash, 2 xonali/3 xonali)",
    svg(t, A) {
      const dev = (d) => `stroke-dasharray="1500" stroke-dashoffset="${(1 - d) * 1500}"`;
      const d1 = seg(t, 0.0, 0.3), d2 = seg(t, 0.25, 0.45);
      const f = (a) => seg(t, a, a + 0.1);
      const lbl = (x, y, m, a) => `<text x="${x}" y="${y}" text-anchor="middle" opacity="${f(a)}" font-family="${FF}" font-weight="700" font-size="26" fill="${INK}">${m}</text>`;
      return bosh(
        `<rect x="90" y="90" width="540" height="540" fill="none" stroke="${INK}" stroke-width="12" ${dev(d1)}/>` +
        `<path d="M360,90 V420 M90,420 H360 M360,300 H630" fill="none" stroke="${INK}" stroke-width="8" ${dev(d2)}/>` +
        // yotoqxona: karavot
        `<g opacity="${f(0.5)}"><rect x="120" y="130" width="190" height="140" rx="8" fill="${W2}" stroke="${INK}" stroke-width="3"/><rect x="140" y="150" width="150" height="100" rx="6" fill="${A}" fill-opacity="0.75" stroke="${INK}" stroke-width="3"/><rect x="150" y="158" width="52" height="30" rx="8" fill="#fff"/><rect x="228" y="158" width="52" height="30" rx="8" fill="#fff"/></g>` +
        // oshxona
        `<g opacity="${f(0.62)}"><rect x="395" y="115" width="215" height="44" fill="${W2}" stroke="${INK}" stroke-width="3"/><circle cx="440" cy="137" r="12" fill="${INK}"/><circle cx="480" cy="137" r="12" fill="${INK}"/><rect x="420" y="200" width="120" height="70" rx="8" fill="${A}" fill-opacity="0.55" stroke="${INK}" stroke-width="3"/></g>` +
        // hammom
        `<g opacity="${f(0.74)}"><rect x="395" y="320" width="215" height="75" rx="30" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="130" cy="470" r="0"/></g>` +
        // mehmonxona: divan, stol
        `<g opacity="${f(0.8)}"><rect x="130" y="470" width="215" height="70" rx="10" fill="${mix(A, '#ffffff', 0.3)}" stroke="${INK}" stroke-width="3"/><rect x="190" y="560" width="95" height="45" rx="8" fill="${W2}" stroke="${INK}" stroke-width="3"/></g>` +
        `<g opacity="${f(0.88)}"><rect x="410" y="470" width="190" height="130" rx="8" fill="${W1}" stroke="${INK}" stroke-width="3"/><circle cx="505" cy="535" r="38" fill="${A}" fill-opacity="0.5" stroke="${INK}" stroke-width="3"/></g>` +
        lbl(215, 300, 'Yotoqxona', 0.5) + lbl(500, 190, 'Oshxona', 0.62) + lbl(500, 360, 'Hammom', 0.74) + lbl(235, 455, 'Mehmonxona', 0.8) + lbl(505, 455, 'Bolalar', 0.88),
      );
    },
  },
  kichik_xona: {
    tavsif: "kichik xona: mebel ketma-ket joylashadi, joy tejash (kichik xona, ixcham mebel, karavot, ish stoli, shkaf, 2 xonali dan 3 xonaliga)",
    svg(t, A) {
      const kir = (a, b) => 1 - seg(t, a, b);
      const sq = (a, b) => seg(t, a, b);
      return bosh(
        xonaBaza(4, 4, 3) +
        `<g opacity="${sq(0.05, 0.1)}">${quad([1.0, 0, 1.2], [2.6, 0, 1.2], [2.6, 0, 2.5], [1.0, 0, 2.5], '#cfe6ee')}</g>` +
        // karavot (chap devor)
        box(0.2, 0.5 - 5 * kir(0.05, 0.3), 0, 1.5, 2.0, 0.45, '#efe9da', '#d6cfbb', '#e2dcc8') + box(0.2, 0.5 - 5 * kir(0.05, 0.3), 0.45, 1.5, 0.0 + 0.4, 0.15, mix(A, '#ffffff', 0.4), A, A) +
        // shkaf
        box(0.15, 3.0, 0, 0.6, 1.0, 2.2 * sq(0.3, 0.5), '#d9d0bb', '#c2b8a0', '#cdc3ab') +
        // ish stoli oyna ostida
        box(3.1 + 4 * kir(0.5, 0.7), 0.15, 0.7, 0.8, 1.6, 0.1, '#e9dfcf', '#c8bda5', '#d6ccb4') + box(3.1 + 4 * kir(0.5, 0.7), 0.15, 0, 0.1, 0.1, 0.7, INK, INK, INK) + box(3.1 + 4 * kir(0.5, 0.7), 1.65, 0, 0.1, 0.1, 0.7, INK, INK, INK) +
        // kreslo
        box(2.6 + 4 * kir(0.65, 0.8), 1.0, 0, 0.6, 0.6, 0.5, A, mix(A, '#000000', 0.2), mix(A, '#000000', 0.1)) +
        etiket(120, 600, 'Karavot', ...P(0.9, 1.0, 0.6), sq(0.3, 0.4)) + etiket(360, 625, 'Shkaf', ...P(0.4, 3.5, 1.7), sq(0.5, 0.6)) + etiket(600, 600, 'Ish stoli', ...P(3.5, 1.0, 0.85), sq(0.72, 0.82)) +
        `<g opacity="${sq(0.85, 0.95)}"><text x="360" y="705" text-anchor="middle" font-family="${FF}" font-weight="700" font-size="34" fill="${INK}">4 × 4 m — hammasi sig'di</text></g>`,
      );
    },
  },
  rang_palitra: {
    tavsif: "60-30-10 qoidasi: devor, mebel va aksent ranglari ketma-ket qo'yiladi (rang tanlash, palitra, kontrast, iliq/sovuq ranglar)",
    svg(t, A) {
      const devor = mix('#ece6d8', '#d9c9a6', seg(t, 0.05, 0.3));
      const mebel = mix('#cfcabb', '#6f8f86', seg(t, 0.35, 0.6));
      const aksent = mix('#cfcabb', A, seg(t, 0.65, 0.85));
      const x = (n) => 50 + n * 225;
      return bosh(
        xonaBaza(5, 5, 3, mix(devor, '#000000', 0.06), devor, '#d2c8b0') +
        quad([1.6, 0.0, 0.9], [3.4, 0, 0.9], [3.4, 0, 2.2], [1.6, 0, 2.2], '#cfe6ee') +
        gilam(1.4, 1.8, 2.4, 2.2, mix(aksent, '#ffffff', 0.55)) +
        divan(0.25, 1.4, mebel, 2.8) + yostiq(0.35, 1.7, aksent) + yostiq(0.35, 2.7, aksent) + osimlik(4.2, 0.45) +
        // 60/30/10 chiziq
        `<g font-family="${FF}" font-weight="700" font-size="26" fill="${INK}"><circle cx="${x(0)}" cy="640" r="${24 * seg(t, 0.05, 0.3)}" fill="${devor}" stroke="${INK}" stroke-width="3"/><text x="${x(0) + 36}" y="650" opacity="${seg(t, 0.1, 0.3)}">60% devor</text>` +
        `<circle cx="${x(1) + 20}" cy="640" r="${24 * seg(t, 0.35, 0.6)}" fill="${mebel}" stroke="${INK}" stroke-width="3"/><text x="${x(1) + 56}" y="650" opacity="${seg(t, 0.4, 0.6)}">30% mebel</text>` +
        `<circle cx="${x(2) + 40}" cy="640" r="${24 * seg(t, 0.65, 0.85)}" fill="${aksent}" stroke="${INK}" stroke-width="3"/><text x="${x(2) + 76}" y="650" opacity="${seg(t, 0.7, 0.85)}">10% aksent</text></g>`,
      );
    },
  },
  hovli_soya: {
    tavsif: "uy va quyosh yoyi: kun davomida soya uzunligi o'zgaradi (hovli, soya, quyosh yo'nalishi, yoz issiqligi, ayvon, daraxt)",
    svg(t, A) {
      const e = seg(t, 0.05, 0.92);
      const ang = Math.PI * (0.1 + 0.8 * e);
      const sx = 360 - Math.cos(ang) * 290, sy = 340 - Math.sin(ang) * 270;
      const soya = 1.2 + 3.0 * Math.abs(0.5 - e) * 2;
      const dir = e < 0.5 ? 1 : -1;
      const nom = e < 0.33 ? 'Ertalab: soya uzun' : e < 0.66 ? 'Tush: soya qisqa' : 'Kechga: soya yana uzayadi';
      return bosh(
        `<path d="M70,340 A290,270 0 0 1 650,340" fill="none" stroke="${INK}" stroke-opacity="0.25" stroke-width="3" stroke-dasharray="8 10"/>` +
        `<circle cx="${sx}" cy="${sy}" r="44" fill="${A}" fill-opacity="0.25"/><circle cx="${sx}" cy="${sy}" r="25" fill="${A}"/>` +
        quad([-0.2, -0.2, 0], [5.2, -0.2, 0], [5.2, 5.2, 0], [-0.2, 5.2, 0], '#cfd8bd') +
        quad([1.5, 1.5, 0], [1.5 + dir * soya * 0.6, 1.5 + soya, 0], [3.5 + dir * soya * 0.6, 1.5 + soya, 0], [3.5, 1.5, 0], INK, 'fill-opacity="0.24" stroke="none"') +
        box(1.5, 1.5, 0, 2.0, 2.0, 1.6, '#eee6d3', '#d8cfb8', '#e2d9c3') +
        quad([3.5, 2.1, 0.0], [3.5, 2.9, 0.0], [3.5, 2.9, 1.2], [3.5, 2.1, 1.2], mix(A, '#ffffff', 0.2)) +
        poly([P(1.3, 1.3, 1.6), P(3.7, 1.3, 1.6), P(2.5, 2.5, 2.6)], A) + poly([P(1.3, 3.7, 1.6), P(3.7, 3.7, 1.6), P(2.5, 2.5, 2.6)], mix(A, '#000000', 0.15)) +
        osimlik(4.4, 4.2) +
        `<text x="360" y="650" text-anchor="middle" font-family="${FF}" font-weight="700" font-size="34" fill="${INK}">${nom}</text>`,
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
