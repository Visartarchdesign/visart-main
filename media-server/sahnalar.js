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

// Haqiqiyroq daraxt (ekran koordinatalarida): tanasi, shoxlari, qatlamli barg, yorug' tomoni
function daraxt(cx, baseY, h, kattalik = 1) {
  const th = h * 0.42, r = h * 0.34 * kattalik;
  const top = baseY - th;
  return `<ellipse cx="${cx}" cy="${baseY + 4}" rx="${r * 0.9}" ry="${r * 0.18}" fill="#000" fill-opacity="0.16"/>` +
    `<path d="M${cx - 9},${baseY} C${cx - 7},${baseY - th * 0.5} ${cx - 5},${baseY - th * 0.8} ${cx - 4},${top} L${cx + 4},${top} C${cx + 5},${baseY - th * 0.8} ${cx + 8},${baseY - th * 0.5} ${cx + 10},${baseY} Z" fill="#6b4a2f" stroke="${INK}" stroke-width="2.5"/>` +
    `<path d="M${cx},${top + 10} l-${r * 0.55},-${r * 0.5} M${cx},${top + 6} l${r * 0.5},-${r * 0.55}" stroke="#6b4a2f" stroke-width="6" stroke-linecap="round"/>` +
    `<circle cx="${cx - r * 0.55}" cy="${top - r * 0.2}" r="${r * 0.62}" fill="#5f8f55" stroke="${INK}" stroke-width="2.5"/>` +
    `<circle cx="${cx + r * 0.55}" cy="${top - r * 0.25}" r="${r * 0.6}" fill="#5f8f55" stroke="${INK}" stroke-width="2.5"/>` +
    `<circle cx="${cx}" cy="${top - r * 0.75}" r="${r * 0.72}" fill="#6fa363" stroke="${INK}" stroke-width="2.5"/>` +
    `<circle cx="${cx - r * 0.25}" cy="${top - r * 0.95}" r="${r * 0.38}" fill="#8cc07b" fill-opacity="0.85"/><circle cx="${cx + r * 0.35}" cy="${top - r * 0.45}" r="${r * 0.28}" fill="#8cc07b" fill-opacity="0.7"/>`;
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
  yolak_kengligi: {
    tavsif: "yuqoridan ko'rinish: divan va shkaf orasidagi yo'lak 60 sm dan 90 sm gacha kengayadi, odam o'tadi (yo'lak kengligi, mebel orasidagi masofa, harakat erkinligi)",
    svg(t, A) {
      const e = seg(t, 0.35, 0.75);
      const cm = 1.2; // 1 sm = 1.2 px
      const gap = (60 + 30 * e) * cm; // 60 -> 90 sm
      const x0 = 130, y0 = 90, y1 = 560; // xona ichki chegaralari
      const mid = 360;
      const left = mid - gap / 2, right = mid + gap / 2;
      const ok = e > 0.95;
      const rang = ok ? '#1f7a4d' : '#b3261e';
      const py = 520 - 360 * seg(t, 0.05, 0.95); // odam yurishi
      const sm = Math.round(gap / cm);
      return bosh(
        `<rect x="${x0 - 70}" y="${y0 - 30}" width="${520 + 60}" height="${y1 - y0 + 60}" fill="${W1}" stroke="${INK}" stroke-width="10"/>` +
        `<rect x="${x0 - 60}" y="${y0 + 20}" width="${left - (x0 - 60)}" height="190" rx="10" fill="${mix(A, '#ffffff', 0.35)}" stroke="${INK}" stroke-width="3"/>` +
        `<rect x="${x0 - 60}" y="${y0 + 20}" width="34" height="190" rx="10" fill="${mix(A, '#ffffff', 0.1)}" stroke="${INK}" stroke-width="3"/>` +
        `<rect x="${x0 - 60}" y="${y0 + 250}" width="${left - (x0 - 60)}" height="200" rx="6" fill="${W2}" stroke="${INK}" stroke-width="3"/>` +
        `<rect x="${right}" y="${y0 + 20}" width="${x0 + 520 - 60 - right}" height="${y1 - y0 - 50}" rx="6" fill="${W2}" stroke="${INK}" stroke-width="3"/>` +
        `<ellipse cx="${mid}" cy="${py}" rx="30" ry="18" fill="#fff" stroke="${rang}" stroke-width="5"/><circle cx="${mid}" cy="${py}" r="11" fill="${rang}"/>` +
        `<g stroke="${rang}" stroke-width="4"><line x1="${left}" y1="${y1 - 20}" x2="${right}" y2="${y1 - 20}"/><line x1="${left}" y1="${y1 - 32}" x2="${left}" y2="${y1 - 8}"/><line x1="${right}" y1="${y1 - 32}" x2="${right}" y2="${y1 - 8}"/></g>` +
        `<text x="${mid}" y="${y1 + 50}" text-anchor="middle" font-family="${FF}" font-weight="700" font-size="48" fill="${rang}">${sm} sm</text>` +
        `<text x="${mid}" y="${y1 + 95}" text-anchor="middle" font-family="${FF}" font-weight="700" font-size="28" fill="${INK}">${ok ? "Erkin o'tadi" : 'Tor yo\'lak'}</text>` +
        etiket(150, 640, 'Divan', x0 + 40, y0 + 110, seg(t, 0.02, 0.1)) + etiket(570, 640, 'Shkaf', right + 60, y0 + 250, seg(t, 0.05, 0.12)),
      );
    },
  },
  ish_stoli: {
    tavsif: "yon ko'rinish: ish stoli balandligi 75 sm, o'rindiq balandligi sozlanadi, tirsak to'g'ri burchak bo'ladi (ergonomika, ish joyi, stol va stul balandligi)",
    svg(t, A) {
      const e = seg(t, 0.3, 0.85);
      const h = 36 + 11 * e; // o'rindiq balandligi sm
      const k = 4; const fl = 600;
      const seatY = fl - h * k, hipX = 250;
      const shY = seatY - 220, elbY = shY + 120;
      const deskY = fl - 75 * k, deskX = 330;
      const handX = deskX + 90, handY = deskY - 8;
      const elbX = hipX + 35;
      const ok = e > 0.95;
      const rang = ok ? '#1f7a4d' : '#b3261e';
      return bosh(
        `<line x1="40" y1="${fl}" x2="680" y2="${fl}" stroke="${INK}" stroke-width="5"/>` +
        // stol
        `<rect x="${deskX}" y="${deskY}" width="260" height="14" fill="#d9c7a8" stroke="${INK}" stroke-width="3"/><rect x="${deskX + 230}" y="${deskY + 14}" width="12" height="${fl - deskY - 14}" fill="${INK}"/><rect x="${deskX + 20}" y="${deskY + 14}" width="12" height="${fl - deskY - 14}" fill="${INK}"/>` +
        `<rect x="${deskX + 150}" y="${deskY - 150}" width="12" height="136" fill="${INK}"/><rect x="${deskX + 110}" y="${deskY - 220}" width="170" height="110" rx="6" fill="#222" stroke="${INK}" stroke-width="3"/>` +
        // stul
        `<rect x="${hipX - 70}" y="${seatY}" width="130" height="14" rx="6" fill="${A}" stroke="${INK}" stroke-width="3"/><rect x="${hipX - 70}" y="${seatY - 150}" width="14" height="150" rx="6" fill="${A}" stroke="${INK}" stroke-width="3"/><rect x="${hipX - 8}" y="${seatY + 14}" width="12" height="${fl - seatY - 14}" fill="${INK}"/>` +
        // odam
        `<g stroke="${INK}" stroke-width="12" stroke-linecap="round" fill="none"><line x1="${hipX}" y1="${seatY - 2}" x2="${hipX}" y2="${shY}"/><line x1="${hipX}" y1="${seatY - 2}" x2="${hipX + 110}" y2="${seatY - 2}"/><line x1="${hipX + 110}" y1="${seatY - 2}" x2="${hipX + 110}" y2="${fl - 4}"/>` +
        `<line x1="${hipX}" y1="${shY}" x2="${elbX}" y2="${elbY}"/><line x1="${elbX}" y1="${elbY}" x2="${handX}" y2="${handY}" stroke="${rang}"/></g>` +
        `<circle cx="${hipX + 6}" cy="${shY - 42}" r="32" fill="#f1d9c0" stroke="${INK}" stroke-width="4"/>` +
        // o'lchamlar
        `<g stroke="${INK}" stroke-width="3"><line x1="690" y1="${deskY}" x2="690" y2="${fl}"/><line x1="680" y1="${deskY}" x2="700" y2="${deskY}"/><line x1="680" y1="${fl}" x2="700" y2="${fl}"/></g>` +
        `<text x="672" y="${(deskY + fl) / 2}" text-anchor="end" font-family="${FF}" font-weight="700" font-size="34" fill="${INK}">75 sm</text>` +
        `<text x="360" y="655" text-anchor="middle" font-family="${FF}" font-weight="700" font-size="34" fill="${rang}">${ok ? 'Tirsak ≈ 90°: yelka bo\'sh' : 'Qo\'l ko\'tarilib turibdi'}</text>` +
        `<text x="40" y="700" font-family="${FF}" font-weight="700" font-size="28" fill="${INK}">o'rindiq ${Math.round(h)} sm</text>`,
      );
    },
  },
  oshxona_uchburchak: {
    tavsif: "yuqoridan ko'rinish: muzlatgich, rakovina va plita orasidagi 'ish uchburchagi', masofalar qisqaradi (oshxona rejasi, qulaylik, harakat)",
    svg(t, A) {
      const e = seg(t, 0.35, 0.8);
      const m = 100; // 1 m = 100 px
      const A1 = [150 + 80 * e, 170], B1 = [360 - 5 * e, 520 - 190 * e], C1 = [570 - 90 * e, 170];
      const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) / m;
      const dlar = [d(A1, B1), d(B1, C1), d(C1, A1)];
      const jami = dlar[0] + dlar[1] + dlar[2];
      const ok = e > 0.95;
      const rang = ok ? '#1f7a4d' : '#b3261e';
      const fmt = (v) => v.toFixed(1).replace('.', ',');
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const lab = (p, q, v) => { const c = mid(p, q); return `<rect x="${c[0] - 40}" y="${c[1] - 20}" width="80" height="36" rx="18" fill="#fff" stroke="${rang}" stroke-width="3"/><text x="${c[0]}" y="${c[1] + 8}" text-anchor="middle" font-family="${FF}" font-weight="700" font-size="24" fill="${rang}">${fmt(v)} m</text>`; };
      const blok = (c, w, h, f, nom) => `<rect x="${c[0] - w / 2}" y="${c[1] - h / 2}" width="${w}" height="${h}" rx="8" fill="${f}" stroke="${INK}" stroke-width="3"/><text x="${c[0]}" y="${c[1] + h / 2 + 30}" text-anchor="middle" font-family="${FF}" font-weight="700" font-size="22" fill="${INK}">${nom}</text>`;
      return bosh(
        `<rect x="50" y="60" width="620" height="540" fill="${W1}" stroke="${INK}" stroke-width="10"/>` +
        `<rect x="50" y="60" width="620" height="60" fill="${W2}" stroke="${INK}" stroke-width="3"/>` +
        `<polygon points="${A1.join(',')} ${B1.join(',')} ${C1.join(',')}" fill="${rang}" fill-opacity="0.12" stroke="${rang}" stroke-width="5" stroke-dasharray="14 8"/>` +
        blok(A1, 100, 80, '#d6dce0', 'Muzlatgich') + blok(B1, 110, 70, '#bcd6e4', 'Rakovina') + blok(C1, 100, 80, mix(A, '#ffffff', 0.4), 'Plita') +
        lab(A1, B1, dlar[0]) + lab(B1, C1, dlar[1]) + lab(C1, A1, dlar[2]) +
        `<text x="360" y="660" text-anchor="middle" font-family="${FF}" font-weight="700" font-size="34" fill="${rang}">${ok ? 'Qulay: uchburchak ixcham' : 'Uzoq: ortiqcha yurasiz'}</text>`,
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
    tavsif: "uy va quyosh yoyi: kun davomida soya uzunligi o'zgaradi (hovli, soya, quyosh yo'nalishi, yoz issiqligi, daraxt)",
    svg(t, A) {
      const e = seg(t, 0.05, 0.92);
      const ang = Math.PI * (0.1 + 0.8 * e);
      const sx = 360 - Math.cos(ang) * 290, sy = 330 - Math.sin(ang) * 260;
      const soya = 1.1 + 3.2 * Math.abs(0.5 - e) * 2;
      const dir = e < 0.5 ? 1 : -1;
      const nom = e < 0.33 ? 'Ertalab: soya uzun' : e < 0.66 ? 'Tush: soya qisqa' : 'Kechga: soya yana uzayadi';
      const oyna = (x1, x2, z1, z2) => quad([3.5, x1, z1], [3.5, x2, z1], [3.5, x2, z2], [3.5, x1, z2], '#bcdcea');
      const oynaFr = (x1, x2, z1, z2) => quad([x1, 3.5, z1], [x2, 3.5, z1], [x2, 3.5, z2], [x1, 3.5, z2], '#bcdcea');
      const tomLines = [0.2, 0.4, 0.6, 0.8].map((k) => `<line x1="${P(1.3 + 2.4 * k, 1.3, 1.6 + 1.0 * k * 0)[0]}" y1="0" x2="0" y2="0" stroke="none"/>`).join('');
      return bosh(
        `<defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfd3a3"/><stop offset="1" stop-color="#9fbb84"/></linearGradient></defs>` +
        `<path d="M70,340 A290,260 0 0 1 650,340" fill="none" stroke="${INK}" stroke-opacity="0.25" stroke-width="3" stroke-dasharray="8 10"/>` +
        `<circle cx="${sx}" cy="${sy}" r="46" fill="${A}" fill-opacity="0.22"/><circle cx="${sx}" cy="${sy}" r="26" fill="${A}"/>` +
        quad([-0.4, -0.4, 0], [5.4, -0.4, 0], [5.4, 5.4, 0], [-0.4, 5.4, 0], 'url(#gr)') +
        quad([3.8, 2.0, 0.01], [5.4, 2.0, 0.01], [5.4, 3.0, 0.01], [3.8, 3.0, 0.01], '#d8cdb8') +
        quad([1.5, 1.5, 0], [1.5 + dir * soya * 0.6, 1.5 + soya, 0], [3.5 + dir * soya * 0.6, 1.5 + soya, 0], [3.5, 1.5, 0], INK, 'fill-opacity="0.24" stroke="none"') +
        box(1.5, 1.5, 0, 2.0, 2.0, 1.5, '#f1e9d6', '#ddd2b9', '#e8dfc9') +
        oyna(1.8, 2.6, 0.55, 1.15) + `<line x1="${P(3.5, 2.2, 0.55)[0]}" y1="${P(3.5, 2.2, 0.55)[1]}" x2="${P(3.5, 2.2, 1.15)[0]}" y2="${P(3.5, 2.2, 1.15)[1]}" stroke="${INK}" stroke-width="2"/>` +
        quad([3.5, 2.9, 0], [3.5, 3.4, 0], [3.5, 3.4, 1.05], [3.5, 2.9, 1.05], mix(A, '#000000', 0.15)) +
        oynaFr(1.8, 2.8, 0.55, 1.15) + oynaFr(2.9, 3.3, 0.55, 1.15) +
        poly([P(1.25, 1.25, 1.5), P(3.75, 1.25, 1.5), P(2.5, 2.5, 2.55)], mix(A, '#000000', 0.05)) +
        poly([P(1.25, 3.75, 1.5), P(3.75, 3.75, 1.5), P(3.75, 1.25, 1.5), P(2.5, 2.5, 2.55)].slice(0, 3), mix(A, '#000000', 0.2)) +
        poly([P(3.75, 1.25, 1.5), P(3.75, 3.75, 1.5), P(2.5, 2.5, 2.55)], mix(A, '#000000', 0.12)) +
        box(1.55, 1.6, 2.0, 0.28, 0.28, 0.55, '#b9a58c', '#a08b72', '#ab9680') +
        daraxt(P(5.0, 0.4, 0)[0], P(5.0, 0.4, 0)[1], 150) + daraxt(P(0.2, 4.6, 0)[0], P(0.2, 4.6, 0)[1], 110) +
        `<text x="360" y="665" text-anchor="middle" font-family="${FF}" font-weight="700" font-size="32" fill="${INK}">${nom}</text>`,
      );
    },
  },
  ayvon_kesim: {
    tavsif: "uy kesimi: ayvon (soyabon) yozgi baland quyoshni to'sadi, bargli daraxt past quyoshni to'sadi, xona salqin qoladi (issiqdan himoya, ayvon, daraxt, deraza, quyosh nuri, issiq yozda uyni salqin saqlash)",
    svg(t, A) {
      const uz = seg(t, 0.18, 0.42); // ayvon uzayadi
      const dr = seg(t, 0.68, 0.85); // daraxt o'sadi
      const ang = (t < 0.62 ? 68 : 26) * Math.PI / 180; // yozgi baland -> kechki past quyosh
      const L = 150 * uz;
      const WX = 360, WY1 = 350, WY2 = 460, FL = 560;
      const trH = 190 * dr;
      const tr = { cx: 520, cy: FL - 130 * dr, rx: 70 * dr, ry: 85 * dr };
      const nur = [];
      const cs = Math.cos(ang), sn = Math.sin(ang);
      for (let i = 0; i < 6; i++) {
        const ty = 330 + i * 28;
        let hit = null, db = 900;
        for (let d = 0; d < 900; d += 2) {
          const x = WX + d * cs, y = ty - d * sn;
          if (uz > 0.02 && x >= WX && x <= WX + L && y >= 258 && y <= 276) { hit = 'ayvon'; db = d; break; }
          if (dr > 0.05 && ((x - tr.cx) / tr.rx) ** 2 + ((y - tr.cy) / tr.ry) ** 2 <= 1) { hit = 'daraxt'; db = d; break; }
        }
        let df = 0; while (df < 900 && WX + df * cs <= 700 && ty - df * sn >= 30) df += 2;
        if (!hit) { hit = 'oyna'; db = 0; }
        nur.push({ x0: WX + df * cs, y0: ty - df * sn, x: WX + db * cs, y: ty - db * sn, hit });
      }
      const kirdi = nur.filter((n) => n.hit === 'oyna').length;
      const qiz = kirdi > 0;
      const rangN = qiz ? '#e8730c' : '#2f7fb0';
      return bosh(
        `<rect x="40" y="${FL}" width="640" height="14" fill="#9fbb84" stroke="${INK}" stroke-width="2.5"/>` +
        // uy
        `<rect x="60" y="270" width="${WX - 60}" height="${FL - 270}" fill="#f1e9d6" stroke="${INK}" stroke-width="3"/>` +
        `<polygon points="40,270 ${WX + 12},270 ${(40 + WX + 12) / 2},170" fill="${mix(A, '#000000', 0.1)}" stroke="${INK}" stroke-width="3"/>` +
        `<rect x="${WX - 14}" y="${WY1}" width="14" height="${WY2 - WY1}" fill="#bcdcea" stroke="${INK}" stroke-width="3"/>` +
        `<rect x="110" y="${WY1}" width="${WX - 150}" height="${FL - WY1}" fill="${qiz ? '#f6d9b0' : '#d9e7ef'}" fill-opacity="0.65"/>` +
        `<rect x="120" y="${FL - 190}" width="70" height="190" fill="#c9b79b" stroke="${INK}" stroke-width="3"/>` +
        (kirdi ? `<polygon points="${WX - 14},${WY1 + 10} ${WX - 14 - 150},${FL - 4} ${WX - 14 - 60},${FL - 4} ${WX - 14},${WY1 + 60}" fill="#ffb347" fill-opacity="0.35"/>` : '') +
        // ayvon
        `<rect x="${WX}" y="262" width="${L}" height="14" fill="#8d8f86" stroke="${INK}" stroke-width="3"/>` +
        (uz > 0.4 ? `<rect x="${WX + L - 10}" y="276" width="10" height="${FL - 276}" fill="#6b6c64" stroke="${INK}" stroke-width="2"/>` : '') +
        // daraxt
        (dr > 0.02 ? `<path d="M${tr.cx - 8},${FL} L${tr.cx - 4},${tr.cy + tr.ry - 20} L${tr.cx + 4},${tr.cy + tr.ry - 20} L${tr.cx + 9},${FL} Z" fill="#6b4a2f" stroke="${INK}" stroke-width="2.5"/>` +
          `<ellipse cx="${tr.cx}" cy="${tr.cy}" rx="${tr.rx}" ry="${tr.ry}" fill="#6fa363" stroke="${INK}" stroke-width="3"/><ellipse cx="${tr.cx - tr.rx * 0.3}" cy="${tr.cy - tr.ry * 0.3}" rx="${tr.rx * 0.45}" ry="${tr.ry * 0.4}" fill="#8cc07b" fill-opacity="0.8"/>` : '') +
        // quyosh va nurlar
        `<circle cx="${nur[2].x0}" cy="${nur[2].y0}" r="34" fill="${A}"/><circle cx="${nur[2].x0}" cy="${nur[2].y0}" r="56" fill="${A}" fill-opacity="0.2"/>` +
        nur.map((n) => `<line x1="${n.x0}" y1="${n.y0}" x2="${n.x}" y2="${n.y}" stroke="#ff9a1f" stroke-width="4" stroke-linecap="round" stroke-opacity="0.85"/>`).join('') +
        `<text x="360" y="640" text-anchor="middle" font-family="${FF}" font-weight="700" font-size="34" fill="${rangN}">${qiz ? 'Nur xonani qizdiryapti' : 'Nur to\'silgan: xona salqin'}</text>` +
        (uz > 0.5 ? etiket(560, 190, 'Ayvon', WX + L - 30, 268, seg(t, 0.4, 0.5) * (1 - seg(t, 0.65, 0.7))) : '') +
        etiket(590, 300, 'Bargli daraxt', tr.cx, tr.cy - 30, seg(t, 0.75, 0.88)),
      );
    },
  },
  shamollatish: {
    tavsif: "yuqoridan ko'rinish: qarama-qarshi ikki oyna ochilganda havo xonadan o'tib issiqni olib chiqadi (shamollatish, tortma shamol, salqinlatish, ventilyatsiya, issiq xona)",
    svg(t, A) {
      const o1 = seg(t, 0.1, 0.25), o2 = seg(t, 0.4, 0.55);
      const oqim = seg(t, 0.55, 0.95);
      const sov = mix('#f4a46a', '#cfe6f3', oqim);
      const x0 = 110, x1 = 610, y0 = 170, y1 = 520;
      const yo = [300, 390];
      const dash = `stroke-dasharray="18 14" stroke-dashoffset="${-t * 420}"`;
      const sh = (y, a) => `<path d="M40,${y} C200,${y - 30} 300,${y + 30} 360,${y} S520,${y - 30} 680,${y}" fill="none" stroke="#2f7fb0" stroke-width="7" ${dash} stroke-linecap="round" opacity="${a}"/>`;
      return bosh(
        `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${sov}" stroke="${INK}" stroke-width="12"/>` +
        `<rect x="${x0 - 8}" y="${yo[0]}" width="16" height="${yo[1] - yo[0]}" fill="${o1 > 0.5 ? '#f3f0e6' : '#bcdcea'}" stroke="${INK}" stroke-width="3"/>` +
        `<rect x="${x1 - 8}" y="${yo[0]}" width="16" height="${yo[1] - yo[0]}" fill="${o2 > 0.5 ? '#f3f0e6' : '#bcdcea'}" stroke="${INK}" stroke-width="3"/>` +
        // mebel
        `<rect x="${x0 + 40}" y="${y0 + 30}" width="140" height="70" rx="8" fill="${mix(A, '#ffffff', 0.4)}" stroke="${INK}" stroke-width="3"/><rect x="${x1 - 190}" y="${y1 - 100}" width="140" height="70" rx="8" fill="#d6cfbd" stroke="${INK}" stroke-width="3"/>` +
        (o1 > 0.5 ? sh(yo[0] + 45, 0.35 + 0.65 * Math.min(1, oqim * 1.6)) : '') + (o1 > 0.5 && o2 > 0.5 ? sh(yo[0] + 25, oqim) + sh(yo[0] + 65, oqim) : '') +
        etiket(150, 120, 'Ochiq oyna', x0, yo[0] + 40, o1) + etiket(570, 120, 'Qarshi oyna', x1, yo[0] + 40, o2) +
        `<text x="360" y="610" text-anchor="middle" font-family="${FF}" font-weight="700" font-size="34" fill="${oqim > 0.5 ? '#1f7a4d' : '#b3261e'}">${oqim > 0.5 ? 'Havo oqimi issiqni olib chiqadi' : (o1 > 0.5 ? 'Bitta oyna: havo harakatlanmaydi' : 'Xona issiq')}</text>`,
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

// Haqiqiy ko'rinishdagi AI rasm uchun (hook/xulosa slaydlari va oblojka): sahna nomi -> prompt
export const SAHNA_RASM = {
  hovli_soya: 'a real modern private house with a courtyard in Uzbekistan, a mature leafy shade tree next to the house, covered veranda overhang, bright summer sun, soft realistic shadows on the ground',
  ayvon_kesim: 'a real modern house facade with a deep covered veranda over large windows, a leafy tree casting shade, bright summer day',
  shamollatish: 'a bright real living room with two opposite open windows, light curtains moving in the breeze, summer light',
  quyosh_xona: 'a real bright living room with sunlight from a large window falling on a wooden floor and a sofa',
  lampa_kelvin: 'a cozy real living room with warm light from ceiling spotlights and a floor lamp, modern interior',
  oyna_parda: 'a real modern living room with floor-to-ceiling curtains hung high above a large window',
  parda_taqqos: 'a real modern living room with long curtains hung from ceiling to floor, wide window, elegant interior',
  yolak_kengligi: 'a real modern apartment hallway with wardrobes and a comfortable wide passage, warm light',
  ish_stoli: 'a real modern home office with a desk, ergonomic chair and a monitor, daylight from a window',
  oshxona_uchburchak: 'a real modern kitchen with sink, stove and refrigerator in a practical work triangle layout, bright',
  planirovka: 'a real apartment interior under renovation, bright empty rooms, clean walls, wooden floor',
  kichik_xona: 'a real small but well organized modern bedroom, light colors, smart furniture placement',
  rang_palitra: 'a real modern living room with a balanced color palette: neutral walls, grey sofa, one terracotta accent',
};

// Sahna fon ovoz effekti (atrof-muhit): nom -> music/sfx/<nom>*.mp3 bo'lsa shu, bo'lmasa ffmpeg sintezi
export const SAHNA_SFX = { hovli_soya: 'shamol', ayvon_kesim: 'shamol', shamollatish: 'shamol' };
