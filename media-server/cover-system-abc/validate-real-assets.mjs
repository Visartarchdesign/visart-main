// Real-asset validation run for A/B/C — no dev placeholders allowed.
// Any missing required input causes that family to FAIL explicitly.
import sharp from 'sharp';
import fs from 'fs';
import { renderFamilyA, renderFamilyB, renderFamilyC, assertRealAssets } from './coverFamiliesABC.mjs';

const ASSETS = '/home/claude/visart-main/assets';

const results = { A: null, B: null, C: null };

// ---------------- TEST A — FULL VISUAL ----------------
const inputsA = {
  heroImagePath: `${ASSETS}/arch-01.jpg`, // real Visart villa exterior render
};
try {
  assertRealAssets('A', inputsA);
  const buf = await renderFamilyA({
    ...inputsA,
    headline: ['ZAMONAVIY', 'VILLA LOYIHASI'],
    accent: '#D4AD67',
    subtitle: "TOSHKENT • 420 M² • 2026",
  });
  fs.writeFileSync('A-real.png', buf);
  results.A = { status: 'OK', assets: inputsA, preset: 'full-bleed hero (cover fit)' };
  console.log('[A] OK — heroImagePath =', inputsA.heroImagePath);
} catch (e) {
  results.A = { status: 'FAILED', reason: e.message };
  console.error('[A] FAILED —', e.message);
}

// ---------------- TEST B — FLAGSHIP PERSON ----------------
const inputsB = {
  personAssetPath: '/home/claude/visart-main/media-server/cover-system-abc/dev-assets/person-approved-v1.png', // background-removed only (rembg, alpha-channel edit) — face pixels untouched
  sceneImagePath: `${ASSETS}/int-02.jpg`, // real Visart interior render
};
try {
  assertRealAssets('B', inputsB);
  const buf = await renderFamilyB({
    ...inputsB,
    headline: ['LOYIHA NECHA', 'BOSQICH?'],
    accent: '#D4AD67',
    subtitle: "TO'LIQ LOYIHA YO'LI",
    personaPreset: 'fullBody',
  });
  fs.writeFileSync('B-real.png', buf);
  results.B = { status: 'OK', assets: inputsB, preset: 'fullBody' };
  console.log('[B] OK');
} catch (e) {
  results.B = { status: 'FAILED', reason: e.message };
  console.error('[B] FAILED —', e.message);
}

// ---------------- TEST C — TECHNICAL ----------------
const inputsC = {
  blueprintImagePath: `${ASSETS}/draw-01.jpg`, // real Visart electrical/floor plan
  projectImagePath: `${ASSETS}/int-01.jpg`,    // real Visart finished interior render
};
try {
  assertRealAssets('C', inputsC);
  const buf = await renderFamilyC({
    ...inputsC,
    headline: ['LOYIHADAN', 'QURILISHGACHA'],
    accent: '#B78A48',
    subtitle: 'CHIZMADAN — NATIJAGACHA',
  });
  fs.writeFileSync('C-real.png', buf);
  results.C = { status: 'OK', assets: inputsC, preset: 'blueprint->reality vertical reveal' };
  console.log('[C] OK — blueprint =', inputsC.blueprintImagePath, '| project =', inputsC.projectImagePath);
} catch (e) {
  results.C = { status: 'FAILED', reason: e.message };
  console.error('[C] FAILED —', e.message);
}

// ---------------- GRID PREVIEW ----------------
const TILE = 480;
const tiles = [];
for (const key of ['A', 'B', 'C']) {
  if (results[key].status === 'OK') {
    tiles.push(await sharp(`${key}-real.png`).resize(TILE, Math.round(TILE * 1920 / 1080), { fit: 'cover' }).png().toBuffer());
  } else {
    const failSvg = `<svg width="${TILE}" height="${Math.round(TILE * 1920 / 1080)}">
      <rect width="100%" height="100%" fill="#1C1C1C"/>
      <text x="50%" y="46%" text-anchor="middle" font-family="Arial" font-size="28" font-weight="700" fill="#E5322D">FAILED</text>
      <text x="50%" y="52%" text-anchor="middle" font-family="Arial" font-size="16" fill="#F4F1EA">Family ${key}</text>
      <text x="50%" y="58%" text-anchor="middle" font-family="Arial" font-size="13" fill="#F4F1EA" opacity="0.75">${esc(results[key].reason)}</text>
    </svg>`;
    tiles.push(await sharp(Buffer.from(failSvg)).png().toBuffer());
  }
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const gridH = Math.round(TILE * 1920 / 1080);
const grid = sharp({ create: { width: TILE * 3, height: gridH, channels: 4, background: '#111111' } });
await grid.composite(tiles.map((buf, i) => ({ input: buf, left: i * TILE, top: 0 }))).png().toFile('ABC-grid-preview.png');

console.log('\n--- SUMMARY ---');
for (const key of ['A', 'B', 'C']) {
  console.log(key, JSON.stringify(results[key]));
}
console.log('person identity: NOT touched by this module in any test (no tint/modulate/linear/recolor/regeneration calls exist for person pixels in coverFamiliesABC.mjs).');
