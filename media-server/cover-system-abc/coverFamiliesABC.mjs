import sharp from 'sharp';
import fs from 'fs';

const KENG = 1080;
const BALAND = 1920;

// ---------- BRAND ----------
const GRAPHITE = '#111111';
const CHARCOAL = '#1C1C1C';
const WARM_WHITE = '#F4F1EA';
const GOLD = '#D4AD67';
const DEEP_GOLD = '#B78A48';

// ---------- LOGO ----------
const LOGO_H = 46;
const LOGO_PATH = '/home/claude/visart-main/assets/logo-mark.png';
const logoMeta = await sharp(LOGO_PATH).metadata();
const LOGO_W = Math.round(LOGO_H * (logoMeta.width / logoMeta.height));
const logoBuf = await sharp(LOGO_PATH).resize(LOGO_W, LOGO_H).png().toBuffer();
const LOGO_X = 64, LOGO_Y = 56;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------- PRODUCTION / REAL-ASSET VALIDATION ----------
// Call this before rendering when dev placeholders must NOT be allowed
// (production runs, real-asset QA previews). Throws naming the exact
// missing input instead of silently falling back.
const REQUIRED_INPUTS = {
  A: ['heroImagePath'],
  B: ['personAssetPath', 'sceneImagePath'],
  C: ['blueprintImagePath', 'projectImagePath'],
};

function assertRealAssets(family, inputs = {}) {
  const missing = REQUIRED_INPUTS[family].filter((key) => !inputs[key] || !fs.existsSync(inputs[key]));
  if (missing.length) {
    throw new Error(`FAILED: Family ${family} is missing required external asset(s): ${missing.join(', ')}. No placeholder was used.`);
  }
}

function logoMatnSvg(textColor = WARM_WHITE) {
  const tx = LOGO_X + LOGO_W + 18;
  return `<text x="${tx}" y="${LOGO_Y + LOGO_H / 2 + 7}" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2" fill="${textColor}">VISART DESIGN</text>`;
}

function qatorlarSvg(qatorlar, { x, yStart, lineH, fontSize, accentIndex, accentColor, baseColor = WARM_WHITE, anchor = 'start', weight = 800 }) {
  return qatorlar.map((line, i) => {
    const color = i === accentIndex ? accentColor : baseColor;
    return `<text x="${x}" y="${yStart + i * lineH}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(line)}</text>`;
  }).join('');
}

// ============================================================
// EXTERNAL IMAGE INPUTS
// Every major visual (hero/scene/blueprint/project/person) is an
// EXTERNAL asset path supplied by the caller at render time.
// This module never generates, edits, or AI-regenerates any of them.
// Dev placeholders below exist ONLY so the layout can be previewed
// without real assets — they must never be used in production calls.
// ============================================================

function warnDev(label) {
  console.warn(`[DEV PLACEHOLDER] ${label} — not a production asset. Supply the real external image path.`);
}

async function loadImage(imagePath, w, h, fit = 'cover', position = 'center') {
  if (!imagePath || !fs.existsSync(imagePath)) return null;
  return sharp(imagePath).resize(w, h, { fit, position }).png().toBuffer();
}

// Detects the real content bounding box of a technical drawing (ink/lines)
// against a near-white sheet background and crops to it, so a scanned/exported
// blueprint's page margin or title-block whitespace doesn't eat half the frame.
// This is a composition/cropping decision — it never alters pixels, only the crop.
async function autoCropToContent(imagePath, { bg = [255, 255, 255], threshold = 18, edgeInset = 0.025 } = {}) {
  const img = sharp(imagePath);
  const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  // ignore a thin margin at the true page edge first: scanned/exported sheets
  // usually have a full-bleed frame/border line there, which would otherwise
  // get picked up as "content" and defeat the whole crop.
  const insetX = Math.round(width * edgeInset);
  const insetY = Math.round(height * edgeInset);
  let minX = width, maxX = 0, minY = height, maxY = 0, found = false;
  const step = 5;
  for (let y = insetY; y < height - insetY; y += step) {
    for (let x = insetX; x < width - insetX; x += step) {
      const idx = (y * width + x) * channels;
      const dr = Math.abs(data[idx] - bg[0]);
      const dg = Math.abs(data[idx + 1] - bg[1]);
      const db = Math.abs(data[idx + 2] - bg[2]);
      if (dr > threshold || dg > threshold || db > threshold) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return sharp(imagePath).png().toBuffer();
  const pad = Math.round(Math.min(width, height) * 0.02);
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const w2 = Math.min(width - left, maxX - minX + pad * 2);
  const h2 = Math.min(height - top, maxY - minY + pad * 2);
  return sharp(imagePath).extract({ left, top, width: w2, height: h2 }).png().toBuffer();
}

// drawn architecture-line placeholder (dev-only stand-in for a real hero/scene photo)
function devArchitectureLinesSvg({ ufqY = 1150, nurRangi = GOLD, intensivlik = 0.35, derazaQatorlar = 9 } = {}) {
  let windows = '';
  for (let row = 0; row < derazaQatorlar; row++) {
    const t = row / (derazaQatorlar - 1);
    const y = ufqY * (1 - t) + ufqY * 0.08 * t;
    const rowW = KENG * (0.3 + 0.7 * t);
    const cols = Math.round(4 + t * 8);
    const cw = rowW / cols;
    const ch = 10 + t * 26;
    const x0 = (KENG - rowW) / 2;
    for (let c = 0; c < cols; c++) {
      const op = (0.04 + 0.1 * t) * intensivlik * (0.6 + 0.4 * Math.random());
      windows += `<rect x="${(x0 + c * cw + cw * 0.12).toFixed(1)}" y="${(y - ch / 2).toFixed(1)}" width="${(cw * 0.76).toFixed(1)}" height="${ch.toFixed(1)}" fill="${nurRangi}" opacity="${op.toFixed(3)}"/>`;
    }
  }
  return `
    <radialGradient id="horizonGlow" cx="50%" cy="${(ufqY / BALAND * 100).toFixed(1)}%" r="70%">
      <stop offset="0%" stop-color="${nurRangi}" stop-opacity="${0.18 * intensivlik}"/>
      <stop offset="100%" stop-color="${nurRangi}" stop-opacity="0"/>
    </radialGradient>
    <rect width="${KENG}" height="${BALAND}" fill="url(#horizonGlow)"/>
    ${windows}
    <line x1="0" y1="${ufqY}" x2="${KENG}" y2="${ufqY}" stroke="${nurRangi}" stroke-width="1" opacity="${0.15 * intensivlik}"/>
  `;
}

async function devHeroPlaceholder() {
  warnDev('heroImagePath');
  const svg = `<svg width="${KENG}" height="${BALAND}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${CHARCOAL}"/><stop offset="100%" stop-color="${GRAPHITE}"/>
    </linearGradient></defs>
    <rect width="${KENG}" height="${BALAND}" fill="url(#bg)"/>
    ${devArchitectureLinesSvg({ ufqY: 1200, nurRangi: GOLD, intensivlik: 0.4, derazaQatorlar: 11 })}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function devScenePlaceholder() {
  warnDev('sceneImagePath');
  const svg = `<svg width="${KENG}" height="${BALAND}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${CHARCOAL}"/><stop offset="100%" stop-color="${GRAPHITE}"/>
    </linearGradient></defs>
    <rect width="${KENG}" height="${BALAND}" fill="url(#bg)"/>
    ${devArchitectureLinesSvg({ ufqY: 1300, nurRangi: DEEP_GOLD, intensivlik: 0.28, derazaQatorlar: 9 })}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function devBlueprintPlaceholder() {
  warnDev('blueprintImagePath');
  const svg = `<svg width="${KENG}" height="${BALAND}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${GRAPHITE}"/><stop offset="100%" stop-color="${CHARCOAL}"/>
    </linearGradient></defs>
    <rect width="${KENG}" height="${BALAND}" fill="url(#bg)"/>
    ${devArchitectureLinesSvg({ ufqY: 900, nurRangi: DEEP_GOLD, intensivlik: 0.22, derazaQatorlar: 7 })}
    <g stroke="${DEEP_GOLD}" stroke-width="2" fill="none" opacity="0.8">
      <rect x="260" y="500" width="560" height="420"/>
      <line x1="260" y1="650" x2="560" y2="650"/>
      <line x1="560" y1="500" x2="560" y2="920"/>
      <line x1="560" y1="760" x2="820" y2="760"/>
    </g>
    <text x="300" y="960" font-family="Arial, sans-serif" font-size="18" fill="${DEEP_GOLD}" opacity="0.85">18.40 M</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function devProjectPlaceholder() {
  warnDev('projectImagePath');
  const svg = `<svg width="${KENG}" height="${BALAND}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${DEEP_GOLD}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${CHARCOAL}"/>
    </linearGradient></defs>
    <rect width="${KENG}" height="${BALAND}" fill="url(#bg)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ---------- PERSON ASSET (unchanged contract: external, never edited) ----------
const DEV_PERSON_ASSET = new URL('./dev-assets/person-placeholder.png', import.meta.url).pathname;

function resolvePersonAsset(assetPath) {
  if (assetPath && fs.existsSync(assetPath)) return { path: assetPath, isDev: false };
  if (fs.existsSync(DEV_PERSON_ASSET)) {
    warnDev('personAssetPath');
    return { path: DEV_PERSON_ASSET, isDev: true };
  }
  return null;
}

const PERSONA_PRESETS = {
  portrait: { boxW: 560, boxH: 1200, fit: 'contain' },
  halfBody: { boxW: 620, boxH: 1500, fit: 'contain' },
  fullBody: { boxW: 640, boxH: 1760, fit: 'contain' },
  // dominant editorial crop (approved Family B reference): person occupies
  // ~40-45% of canvas width, large and bottom-anchored. boxW is the real
  // constraint; boxH is a generous ceiling so tall narrow assets scale by width.
  editorial: { boxW: 480, boxH: 1850, fit: 'contain' },
};

// Minimal line-icon set for the process-step list (01-06). Pure geometric
// SVG, no external icon font/library — keeps the module dependency-free.
const STEP_ICONS = {
  search: '<circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="13.5" y1="13.5" x2="19" y2="19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  pencil: '<path d="M4 16.5 V20 H7.5 L17.5 10 L14 6.5 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><line x1="12.5" y1="8" x2="16" y2="11.5" stroke="currentColor" stroke-width="1.6"/>',
  grid: '<rect x="4" y="4" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="4" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="4" y="13" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="13" y="13" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  gear: '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2.4 2.6"/>',
  helmet: '<path d="M4 16 a8 7 0 0 1 16 0 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><line x1="2.5" y1="16" x2="21.5" y2="16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  home: '<path d="M4 11.5 L12 4.5 L20 11.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10.5 V19.5 H18 V10.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
};

function stepIconSvg(key, x, y, size, color) {
  const inner = STEP_ICONS[key] || STEP_ICONS.grid;
  return `<g transform="translate(${x},${y}) scale(${(size / 24).toFixed(3)})" color="${color}">${inner}</g>`;
}

async function personVisibleBounds(assetPath, boxW, boxH, fit) {
  // transparent padding is required here: sharp's default pad for fit:'contain'
  // is opaque black, which would otherwise show up as a solid black box wherever
  // the asset doesn't fill its bounding box.
  const resized = sharp(assetPath).resize(boxW, boxH, { fit, position: 'bottom', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const { data, info } = await resized.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width, maxX = 0, minY = height, maxY = 0, found = false;
  const rowLefts = [];
  const rowRights = [];
  const leftEdge = []; // {x,y} per sampled row — traces the actual silhouette, for a contour-following rim light
  const step = 4;
  for (let y = 0; y < height; y += step) {
    let rowMinX = -1, rowMaxX = -1;
    for (let x = 0; x < width; x += step) {
      const a = data[(y * width + x) * channels + 3];
      if (a > 10) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (rowMinX === -1) rowMinX = x;
        rowMaxX = x;
      }
    }
    if (rowMinX !== -1) { rowLefts.push(rowMinX); rowRights.push(rowMaxX); leftEdge.push({ x: rowMinX, y }); }
  }
  const buf = await resized.png().toBuffer();
  if (!found) return { buf, visible: null };
  const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  return {
    buf,
    visible: {
      minX, maxX, minY, maxY,
      // robust edges: the median per-row edge, used for the contact shadow
      // so a single outlying limb — a hand tucked near the hip, say —
      // doesn't drag the shadow away from the body's actual visual mass.
      // True min/max stays for the text safe-zone, which should stay
      // conservative and never overlap any part of the asset.
      typicalLeft: median(rowLefts),
      typicalRight: median(rowRights),
      leftEdge,
    },
  };
}

async function buildPersonLayer({ assetPath, persona, boxX, boxY }) {
  const resolved = resolvePersonAsset(assetPath);
  if (!resolved) return null;
  const { boxW, boxH, fit } = PERSONA_PRESETS[persona];
  const { buf, visible } = await personVisibleBounds(resolved.path, boxW, boxH, fit);
  const bounds = visible
    ? {
        left: boxX + visible.minX, right: boxX + visible.maxX, top: boxY + visible.minY, bottom: boxY + visible.maxY,
        typicalLeft: boxX + visible.typicalLeft, typicalRight: boxX + visible.typicalRight,
        leftEdge: visible.leftEdge.map((p) => ({ x: boxX + p.x, y: boxY + p.y })),
      }
    : { left: boxX, right: boxX + boxW, top: boxY, bottom: boxY + boxH, typicalLeft: boxX, typicalRight: boxX + boxW, leftEdge: [] };
  return { composite: { input: buf, left: boxX, top: boxY }, bounds, isDev: resolved.isDev };
}

function contactShadowSvg(bounds) {
  const cx = (bounds.typicalLeft + bounds.typicalRight) / 2;
  const w = (bounds.typicalRight - bounds.typicalLeft) * 1.15;
  const cy = bounds.bottom - 6;
  return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(w / 2).toFixed(1)}" ry="${(w * 0.11).toFixed(1)}" fill="#000000" opacity="0.38" filter="url(#blurShadow)"/>`;
}

function rimLightSvg(bounds, accent) {
  // A straight vertical line can't hug a curved silhouette (shoulders,
  // crossed arms, a roll held against the hip all sit at different x's),
  // so trace the actual left edge instead — a contour-following highlight
  // that reads as light grazing the body, not a ruled sticker outline.
  const pts = bounds.leftEdge;
  if (!pts || pts.length < 2) {
    const x = bounds.typicalLeft - 4;
    return `<rect x="${x.toFixed(1)}" y="${bounds.top.toFixed(1)}" width="10" height="${(bounds.bottom - bounds.top).toFixed(1)}" fill="${accent}" opacity="0.3"/>`;
  }
  const offset = 3;
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x - offset).toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return `<path d="${d}" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.38" filter="url(#rimBlur)"/>`;
}

// ============================================================
// FAMILY A — FULL VISUAL / PROJECT
// Input contract:
//   heroImagePath : string  (required in production) — full-bleed architecture/interior photo
//   headline      : string[2]  — 2 lines, 2nd line is the accent line
//   accent        : string  — hex color for the accent line (default GOLD)
//   subtitle      : string
//   metadata      : string  — small bottom line (location / area / year)
// Layer order: heroImage -> bottom scrim -> text -> logo
// ============================================================
async function renderFamilyA({ heroImagePath, headline = ['SARLAVHA', 'AKSENT'], accent = GOLD, subtitle = '', metadata = '' } = {}) {
  const heroBuf = await loadImage(heroImagePath, KENG, BALAND, 'cover') || await devHeroPlaceholder();

  const overlaySvg = `
    <svg width="${KENG}" height="${BALAND}">
      <defs>
        <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${GRAPHITE}" stop-opacity="0"/>
          <stop offset="100%" stop-color="${GRAPHITE}" stop-opacity="0.92"/>
        </linearGradient>
      </defs>
      <rect x="0" y="1300" width="${KENG}" height="620" fill="url(#scrim)"/>
      ${logoMatnSvg()}
      <text x="64" y="1540" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3" fill="${accent}">ARXITEKTURA</text>
      ${qatorlarSvg(headline, { x: 64, yStart: 1610, lineH: 72, fontSize: 64, accentIndex: 1, accentColor: accent })}
      ${subtitle ? `<text x="64" y="1790" font-family="Arial, sans-serif" font-size="26" fill="${WARM_WHITE}" opacity="0.75">${esc(subtitle)}</text>` : ''}
    </svg>`;

  return sharp(heroBuf)
    .composite([
      { input: Buffer.from(overlaySvg), left: 0, top: 0 },
      { input: logoBuf, left: LOGO_X, top: LOGO_Y },
    ])
    .png().toBuffer();
}

// ============================================================
// FAMILY B — PERSON + ARCHITECTURE (FLAGSHIP)
// Input contract:
//   personAssetPath : string (required in production) — transparent PNG/WebP, pre-identity-correct
//   sceneImagePath  : string (required in production) — architecture/interior/construction environment photo
//   headline        : string[2]
//   accent          : string
//   subtitle        : string
//   personaPreset   : 'portrait' | 'halfBody' | 'fullBody'
//   metadata        : string
// Layer order:
//   01 sceneImage  02 (dev-only drawn env, skipped when sceneImage real)  03 depth/bottom scrim
//   04 contact shadow  05 PERSON_ASSET  06 rim-light (foreground edge, never over face)
//   07 textSvg  08 logo
// ============================================================
const DEFAULT_STEPS = [
  { number: '01', icon: 'search', title: 'TAHLIL', subtitle: "EHTIYOJLARNI O'RGANISH" },
  { number: '02', icon: 'pencil', title: 'KONSEPSIYA', subtitle: "G'OYA VA USLUB" },
  { number: '03', icon: 'grid', title: 'LOYIHALASH', subtitle: 'REJALAR VA 3D' },
  { number: '04', icon: 'gear', title: 'TEXNIK YECHIM', subtitle: 'CHIZMALAR VA DETALLAR' },
  { number: '05', icon: 'helmet', title: 'IJRO NAZORATI', subtitle: 'SIFAT VA MUVOFIQLIK' },
  { number: '06', icon: 'home', title: 'NATIJA', subtitle: 'ORZUINGIZDAGI MAKON' },
];

function stepListSvg(steps, { x, yStart, rowH, maxWidth, accent }) {
  const r = 26;
  const lineX = x + r;
  const top = yStart;
  const bottom = yStart + rowH * (steps.length - 1);
  let out = `<line x1="${lineX}" y1="${top}" x2="${lineX}" y2="${bottom}" stroke="${accent}" stroke-width="1.5" opacity="0.45"/>`;
  steps.forEach((s, i) => {
    const cy = yStart + rowH * i;
    const textX = x + r * 2 + 22;
    out += `
      <circle cx="${lineX}" cy="${cy}" r="${r}" fill="${GRAPHITE}" stroke="${accent}" stroke-width="1.6"/>
      <text x="${lineX}" y="${cy + 6}" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="800" fill="${accent}">${esc(s.number)}</text>
      ${stepIconSvg(s.icon, textX, cy - 12, 22, accent)}
      <text x="${textX + 30}" y="${cy - 2}" font-family="Arial, sans-serif" font-size="19" font-weight="800" fill="${WARM_WHITE}">${esc(s.title)}</text>
      <text x="${textX + 30}" y="${cy + 18}" font-family="Arial, sans-serif" font-size="12" fill="${WARM_WHITE}" opacity="0.65">${esc(s.subtitle)}</text>
    `;
  });
  return out;
}

async function renderFamilyB({ personAssetPath, sceneImagePath, headline = ['SARLAVHA', 'AKSENT'], accent = GOLD, subtitle = '', personaPreset = 'editorial', steps = DEFAULT_STEPS, eyebrow = 'EKSPERT MASLAHATI', metadata = '' } = {}) {
  const preset = PERSONA_PRESETS[personaPreset];
  const boxX = KENG - preset.boxW - 20;
  const boxY = BALAND - preset.boxH - 20;

  const personLayer = await buildPersonLayer({ assetPath: personAssetPath, persona: personaPreset, boxX, boxY });
  const bounds = personLayer ? personLayer.bounds : { left: boxX + preset.boxW * 0.2, right: boxX + preset.boxW, top: boxY + preset.boxH * 0.1, bottom: BALAND - 20 };
  const safeMaxX = bounds.left - 48;

  const sceneBuf = sceneImagePath && fs.existsSync(sceneImagePath)
    ? await loadImage(sceneImagePath, KENG, BALAND, 'cover')
    : await devScenePlaceholder();

  const backSvg = `
    <svg width="${KENG}" height="${BALAND}">
      <defs>
        <linearGradient id="depthScrimR" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${GRAPHITE}" stop-opacity="0"/>
          <stop offset="100%" stop-color="${GRAPHITE}" stop-opacity="0.5"/>
        </linearGradient>
        <linearGradient id="leftScrim" x1="0" y1="0" x2="${KENG}" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${GRAPHITE}" stop-opacity="0.9"/>
          <stop offset="${((safeMaxX + 48) / KENG * 100).toFixed(1)}%" stop-color="${GRAPHITE}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${GRAPHITE}" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="topScrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${GRAPHITE}" stop-opacity="0.75"/>
          <stop offset="100%" stop-color="${GRAPHITE}" stop-opacity="0"/>
        </linearGradient>
        <filter id="blurShadow"><feGaussianBlur stdDeviation="10"/></filter>
      </defs>
      <rect x="0" y="0" width="${KENG}" height="${BALAND}" fill="url(#leftScrim)"/>
      <rect x="${boxX - 60}" y="0" width="${KENG - boxX + 60}" height="${BALAND}" fill="url(#depthScrimR)"/>
      <rect x="0" y="0" width="${KENG}" height="260" fill="url(#topScrim)"/>
      ${contactShadowSvg(bounds)}
    </svg>`;

  const rimSvg = `<svg width="${KENG}" height="${BALAND}">
      <defs><filter id="rimBlur"><feGaussianBlur stdDeviation="2.2"/></filter></defs>
      ${rimLightSvg(bounds, accent)}
    </svg>`;

  const headlineFontSize = Math.min(54, (safeMaxX - 64) / 5.4);
  const stepsStartY = 560;
  const stepsRowH = 108;

  const textSvg = `
    <svg width="${KENG}" height="${BALAND}">
      ${logoMatnSvg()}
      <text x="64" y="168" font-family="Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="3" fill="${accent}">${esc(eyebrow)}</text>
      ${qatorlarSvg(headline, { x: 64, yStart: 230, lineH: headlineFontSize + 14, fontSize: headlineFontSize, accentIndex: 1, accentColor: accent })}
      ${subtitle ? `<text x="64" y="${230 + (headlineFontSize + 14) * 2 + 20}" font-family="Arial, sans-serif" font-size="20" fill="${WARM_WHITE}" opacity="0.7" letter-spacing="1">${esc(subtitle)}</text>` : ''}
      ${stepListSvg(steps, { x: 64, yStart: stepsStartY, rowH: stepsRowH, maxWidth: safeMaxX - 64, accent })}
    </svg>`;

  return sharp(sceneBuf)
    .composite([
      { input: Buffer.from(backSvg), left: 0, top: 0 },
      ...(personLayer ? [personLayer.composite] : []),
      { input: Buffer.from(rimSvg), left: 0, top: 0 },
      { input: Buffer.from(textSvg), left: 0, top: 0 },
      { input: logoBuf, left: LOGO_X, top: LOGO_Y },
    ])
    .png().toBuffer();
}

// ============================================================
// FAMILY C — TECHNICAL / BLUEPRINT
// Input contract:
//   blueprintImagePath : string (required in production) — technical/blueprint/wireframe image (top layer)
//   projectImagePath   : string (required in production) — real finished-project photo (reveals at bottom)
//   headline           : string[2]
//   accent             : string
//   subtitle           : string
//   metadata           : string
// Layer order: blueprintImage (full bg) -> projectImage masked with a soft vertical
//   gradient (transparent top -> opaque bottom), i.e. a blueprint->reality transition
//   -> top/bottom scrims -> text -> logo
// ============================================================
async function renderFamilyC({ blueprintImagePath, projectImagePath, headline = ['SARLAVHA', 'AKSENT'], accent = DEEP_GOLD, subtitle = '', metadata = '', blueprintPosition = 'center', projectPosition = 'center', blueprintAutoCrop = true } = {}) {
  // technical sheets (scanned/exported CAD sheets) often carry a page margin or
  // title-block whitespace around the actual drawing — auto-crop to the drawing's
  // content bounding box first so that whitespace doesn't dominate the frame.
  let blueprintSource = blueprintImagePath;
  let blueprintBuf;
  if (blueprintImagePath && fs.existsSync(blueprintImagePath) && blueprintAutoCrop) {
    const cropped = await autoCropToContent(blueprintImagePath);
    blueprintBuf = await sharp(cropped).resize(KENG, BALAND, { fit: 'cover', position: blueprintPosition }).png().toBuffer();
  } else {
    blueprintBuf = await loadImage(blueprintImagePath, KENG, BALAND, 'cover', blueprintPosition);
  }
  blueprintBuf = blueprintBuf || await devBlueprintPlaceholder();
  const projectBufRaw = await loadImage(projectImagePath, KENG, BALAND, 'cover', projectPosition) || await devProjectPlaceholder();

  // vertical reveal mask: transparent top, opaque bottom (alpha comes straight from SVG opacity)
  const maskSvg = `<svg width="${KENG}" height="${BALAND}">
      <defs><linearGradient id="reveal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="white" stop-opacity="0"/>
        <stop offset="42%" stop-color="white" stop-opacity="0"/>
        <stop offset="78%" stop-color="white" stop-opacity="1"/>
        <stop offset="100%" stop-color="white" stop-opacity="1"/>
      </linearGradient></defs>
      <rect width="${KENG}" height="${BALAND}" fill="url(#reveal)"/>
    </svg>`;
  const maskBuf = await sharp(Buffer.from(maskSvg)).png().toBuffer();
  const projectMasked = await sharp(projectBufRaw).composite([{ input: maskBuf, blend: 'dest-in' }]).png().toBuffer();

  const overlaySvg = `
    <svg width="${KENG}" height="${BALAND}">
      <defs>
        <linearGradient id="topScrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${GRAPHITE}" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="${GRAPHITE}" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="botScrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${GRAPHITE}" stop-opacity="0"/>
          <stop offset="100%" stop-color="${GRAPHITE}" stop-opacity="0.92"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${KENG}" height="220" fill="url(#topScrim)"/>
      <rect x="0" y="1380" width="${KENG}" height="540" fill="url(#botScrim)"/>
      ${logoMatnSvg()}
      <text x="64" y="1540" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3" fill="${accent}">TEXNIK KO'RIB CHIQISH</text>
      ${qatorlarSvg(headline, { x: 64, yStart: 1610, lineH: 72, fontSize: 60, accentIndex: 1, accentColor: accent })}
      ${subtitle ? `<text x="64" y="1790" font-family="Arial, sans-serif" font-size="26" fill="${WARM_WHITE}" opacity="0.75">${esc(subtitle)}</text>` : ''}
    </svg>`;

  return sharp(blueprintBuf)
    .composite([
      { input: projectMasked, left: 0, top: 0 },
      { input: Buffer.from(overlaySvg), left: 0, top: 0 },
      { input: logoBuf, left: LOGO_X, top: LOGO_Y },
    ])
    .png().toBuffer();
}

export { renderFamilyA, renderFamilyB, renderFamilyC, assertRealAssets };

// ============================================================
// CLI self-preview — only runs when this file is executed directly
// (`node coverFamiliesABC.mjs`), never on import. Uses dev placeholders
// unless real paths are passed via env vars, purely for local preview.
//   renderFamilyA({ heroImagePath: '/assets/projects/villa-01/hero.jpg', ... })
//   renderFamilyB({ personAssetPath: '/assets/people/architect.png',
//                    sceneImagePath: '/assets/projects/villa-01/interior.jpg', ... })
//   renderFamilyC({ blueprintImagePath: '/assets/projects/villa-01/plan.png',
//                    projectImagePath: '/assets/projects/villa-01/final.jpg', ... })
// ============================================================
if (import.meta.url === `file://${process.argv[1]}`) {
  const [a, b, c] = await Promise.all([
    renderFamilyA({ heroImagePath: process.env.HERO_IMAGE || null, headline: ['ZAMONAVIY', 'VILLA LOYIHASI'], subtitle: "TOSHKENT • 420 M² • 2026" }),
    renderFamilyB({ personAssetPath: process.env.PERSON_ASSET || null, sceneImagePath: process.env.SCENE_IMAGE || null, headline: ['LOYIHA NECHA', 'BOSQICH?'], subtitle: "TO'LIQ LOYIHA YO'LI" }),
    renderFamilyC({ blueprintImagePath: process.env.BLUEPRINT_IMAGE || null, projectImagePath: process.env.PROJECT_IMAGE || null, headline: ['LOYIHADAN', 'QURILISHGACHA'], subtitle: "CHIZMADAN — NATIJAGACHA" }),
  ]);
  fs.writeFileSync('concept-A.png', a);
  fs.writeFileSync('concept-B.png', b);
  fs.writeFileSync('concept-C.png', c);
  console.log('tayyor');
}
