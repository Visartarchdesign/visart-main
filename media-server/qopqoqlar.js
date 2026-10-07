// VISART DESIGN MASTER COVER SYSTEM -- 8 reusable, premium "magazine cover"
// darajadagi video thumbnail/cover shabloni (Instagram Reels, IG grid,
// Facebook, YouTube Shorts uchun). Bepul, kod-asosida (Sharp + SVG) --
// OpenAI/Gemini billing shart emas. Har bir kategoriya o'z rang-kodiga ega,
// lekin barchasi bitta brend tizimiga (logotip, tipografiya, grid-safe zona)
// bo'ysunadi.
//
// Kategoriyalar:
//   1 = Interyer / Portfolio      (gold)
//   2 = Before / After            (gold/white, diagonal split)
//   3 = Xatolar / Educational     (qizil aksent)
//   4 = Process (loyihadan natijagacha) (gold)
//   5 = Arxitektura (exterior, maydon)  (qora/gold)
//   6 = Qurilish maslahati        (industrial, xira oltin)
//   7 = Narx / Budjet             (oq/qizil)
//   8 = Material Comparison       (gold, vertikal split + VS)

import sharp from 'sharp';

const KENG = 1080;
const BALAND = 1920;
// Instagram profil gridida kvadrat preview markazdan kesiladi -- eng muhim
// matn/raqam shu zonadan tashqariga chiqmasin.
const SAFE_TOP = 420;
const SAFE_BOTTOM = 1500;

export const KATEGORIYALAR = {
  1: { nomi: 'Interyer / Portfolio', accent: '#c9a876', eyebrow: 'PREMIUM INTERIOR', panel: '#0c0a08' },
  2: { nomi: 'Before / After', accent: '#c9a876', eyebrow: 'TRANSFORMATSIYA', panel: '#0c0a08' },
  3: { nomi: 'Xatolar / Educational', accent: '#c0392b', eyebrow: 'DIQQAT QILING', panel: '#130d0c' },
  4: { nomi: 'Process', accent: '#c9a876', eyebrow: 'LOYIHADAN NATIJAGACHA', panel: '#0c0a08' },
  5: { nomi: 'Arxitektura', accent: '#c9a876', eyebrow: 'ARXITEKTURA', panel: '#07070a' },
  6: { nomi: 'Qurilish maslahati', accent: '#b5812e', eyebrow: 'QURILISH MASLAHATI', panel: '#161310' },
  7: { nomi: 'Narx / Budjet', accent: '#c0392b', eyebrow: 'NARX VA BUDJET', panel: '#101010' },
  8: { nomi: 'Material Comparison', accent: '#c9a876', eyebrow: 'QAYSI BIRI YAXSHI?', panel: '#0c0a08' },
};

function xmlEscape(s) {
  return String(s || '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

// Uzun sarlavhani 1-2 QISQA (ideal holda 2-5 so'zli) qatorga bo'ladi.
function qatorlargaBol(matn, maxBelgiQator = 14) {
  const sozlar = String(matn || '').trim().split(/\s+/).filter(Boolean);
  if (!sozlar.length) return ['VISART DESIGN'];
  let qator1 = '';
  let qator2 = '';
  for (const s of sozlar) {
    if (!qator2 && (qator1 + ' ' + s).trim().length <= maxBelgiQator) {
      qator1 = (qator1 + ' ' + s).trim();
    } else {
      qator2 = (qator2 + ' ' + s).trim();
    }
  }
  return qator2 ? [qator1, qator2] : [qator1];
}

// Minimal, bir xil joylashuvli logotip belgisi -- barcha shablonlarda bir xil.
function logoSvg(x = 60, y = 62, color = '#c9a876') {
  return `
    <rect x="${x}" y="${y}" width="16" height="16" fill="${color}" transform="rotate(45 ${x + 8} ${y + 8})"/>
    <text x="${x + 36}" y="${y + 18}" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="700" fill="#ffffff" letter-spacing="5">VISART DESIGN</text>
  `;
}

async function fonGaMoslash(buf, fallbackRgb = { r: 18, g: 16, b: 13 }) {
  if (buf) {
    try {
      return await sharp(buf).resize(KENG, BALAND, { fit: 'cover' }).png().toBuffer();
    } catch (e) {
      // o'tadi, pastdagi fallback ishlatiladi
    }
  }
  return sharp({ create: { width: KENG, height: BALAND, channels: 4, background: { ...fallbackRgb, alpha: 1 } } })
    .png().toBuffer();
}

// --- 1-shablon: HERO (kategoriya 1,3,4,5,6,7 -- bitta kuchli rasm + pastki
// matn paneli). Kategoriyaga qarab eyebrow/accent/panel rangi va ixtiyoriy
// KATTA raqam (m², narx, xato soni) o'zgaradi.
async function heroShablon({ rasmBuf, aiFonBuf, kategoriya, headlineLines, accentQator, raqam, subtitle }) {
  const cfg = KATEGORIYALAR[kategoriya] || KATEGORIYALAR[1];
  const fonLayer = await fonGaMoslash(aiFonBuf);

  const qatorlar = (headlineLines && headlineLines.length ? headlineLines : qatorlargaBol('VISART DESIGN')).map(xmlEscape);
  const raqamSafe = raqam ? xmlEscape(String(raqam)) : null;

  // Footer balandligini AVVAL hisoblaymiz (eyebrow + ixtiyoriy raqam +
  // sarlavha qatorlari + ixtiyoriy subtitle + pastki bo'shliq), keyin
  // foto-kartani shu balandlikka mos qilib SIQAMIZ -- shu bilan matn hech
  // qachon 1920px canvas'dan tashqariga chiqib ketmaydi.
  const EYEBROW_H = 100;
  const RAQAM_H = raqamSafe ? 170 : 0;
  const HEADLINE_H = qatorlar.length * 78 + 20;
  const SUBTITLE_H = subtitle ? 50 : 0;
  const PASTKI_BOSHLIQ = 70;
  const footerBaland = EYEBROW_H + RAQAM_H + HEADLINE_H + SUBTITLE_H + PASTKI_BOSHLIQ;

  const kartaKeng = 860;
  const kartaY = 260;
  const kartaRadius = 28;
  const kartaBaland = Math.max(620, BALAND - kartaY - 40 - footerBaland);
  const kartaX = Math.round((KENG - kartaKeng) / 2);

  const kartaMask = Buffer.from(`<svg width="${kartaKeng}" height="${kartaBaland}"><rect width="${kartaKeng}" height="${kartaBaland}" rx="${kartaRadius}" fill="#fff"/></svg>`);
  const frameRounded = await sharp(rasmBuf)
    .resize(kartaKeng, kartaBaland, { fit: 'cover' })
    .composite([{ input: kartaMask, blend: 'dest-in' }])
    .png().toBuffer();

  const soyaSvg = Buffer.from(`
    <svg width="${KENG}" height="${BALAND}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${kartaX - 22}" y="${kartaY - 4}" width="${kartaKeng + 44}" height="${kartaBaland + 44}" rx="42" fill="#000" opacity="0.12"/>
      <rect x="${kartaX - 12}" y="${kartaY + 2}" width="${kartaKeng + 24}" height="${kartaBaland + 32}" rx="36" fill="#000" opacity="0.22"/>
      <rect x="${kartaX - 4}" y="${kartaY + 10}" width="${kartaKeng + 8}" height="${kartaBaland + 18}" rx="32" fill="#000" opacity="0.3"/>
    </svg>
  `);

  const footerY = kartaY + kartaBaland + 40;
  let cursorY = footerY + 100;

  const eyebrowSvg = `<text x="60" y="${cursorY}" font-family="Arial, sans-serif" font-size="23" font-weight="700" fill="${cfg.accent}" letter-spacing="5">${xmlEscape(cfg.eyebrow)}</text>
    <rect x="60" y="${cursorY + 22}" width="110" height="5" fill="${cfg.accent}"/>`;
  cursorY += 100;

  let raqamSvg = '';
  if (raqamSafe) {
    raqamSvg = `<text x="60" y="${cursorY + 110}" font-family="Arial, sans-serif" font-size="150" font-weight="900" fill="${cfg.accent}">${raqamSafe}</text>`;
    cursorY += 160;
  }

  const headlineSvg = qatorlar.map((q, i) => {
    const accent = accentQator === i;
    return `<text x="60" y="${cursorY + i * 78}" font-family="Arial, sans-serif" font-size="68" font-weight="800" fill="${accent ? cfg.accent : '#ffffff'}">${q}</text>`;
  }).join('');
  cursorY += qatorlar.length * 78 + 10;

  const subtitleSvg = subtitle
    ? `<text x="60" y="${cursorY + 34}" font-family="Arial, sans-serif" font-size="26" font-weight="600" fill="#cfcfcf" letter-spacing="2">${xmlEscape(subtitle)}</text>`
    : '';

  const overlaySvg = Buffer.from(`
    <svg width="${KENG}" height="${BALAND}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="foot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${cfg.panel}" stop-opacity="0"/>
          <stop offset="22%" stop-color="${cfg.panel}" stop-opacity="0.94"/>
          <stop offset="100%" stop-color="${cfg.panel}" stop-opacity="0.98"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${KENG}" height="220" fill="url(#top)"/>
      <rect x="0" y="${footerY - 140}" width="${KENG}" height="${BALAND - (footerY - 140)}" fill="url(#foot)"/>
      ${logoSvg(60, 62, cfg.accent)}
      <rect x="${kartaX}" y="${kartaY}" width="${kartaKeng}" height="${kartaBaland}" rx="${kartaRadius}" fill="none" stroke="${cfg.accent}" stroke-width="2.5" opacity="0.9"/>
      ${eyebrowSvg}
      ${raqamSvg}
      ${headlineSvg}
      ${subtitleSvg}
    </svg>
  `);

  return sharp(fonLayer)
    .composite([
      { input: soyaSvg, left: 0, top: 0 },
      { input: frameRounded, left: kartaX, top: kartaY },
      { input: overlaySvg, left: 0, top: 0 },
    ])
    .png().toBuffer();
}

// --- 2-shablon: BEFORE / AFTER (kategoriya 2) -- diagonal split, ikki kadr.
async function beforeAfterShablon({ rasmBuf, rasmBuf2, headlineLines, accentQator }) {
  const cfg = KATEGORIYALAR[2];
  const chap = await sharp(await fonGaMoslash(rasmBuf)).resize(KENG, BALAND, { fit: 'cover' }).toBuffer();
  const ong = await sharp(await fonGaMoslash(rasmBuf2 || rasmBuf)).resize(KENG, BALAND, { fit: 'cover' }).toBuffer();

  // Diagonal kesish chizig'i -- yuqorida 55%, pastda 45% kenglik (nozik qiya)
  const ongMask = Buffer.from(`
    <svg width="${KENG}" height="${BALAND}" xmlns="http://www.w3.org/2000/svg">
      <polygon points="${KENG * 0.58},0 ${KENG},0 ${KENG},${BALAND} ${KENG * 0.42},${BALAND}" fill="#fff"/>
    </svg>
  `);
  const ongKesilgan = await sharp(ong).composite([{ input: ongMask, blend: 'dest-in' }]).png().toBuffer();

  const qatorlar = (headlineLines && headlineLines.length ? headlineLines : ['TRANSFORMATSIYA']).map(xmlEscape);
  const footerY = BALAND - 320;

  const overlaySvg = Buffer.from(`
    <svg width="${KENG}" height="${BALAND}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="foot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0c0a08" stop-opacity="0"/>
          <stop offset="35%" stop-color="#0c0a08" stop-opacity="0.92"/>
          <stop offset="100%" stop-color="#0c0a08" stop-opacity="0.97"/>
        </linearGradient>
        <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${KENG}" height="200" fill="url(#top)"/>
      <rect x="0" y="${footerY}" width="${KENG}" height="${BALAND - footerY}" fill="url(#foot)"/>
      <line x1="${KENG * 0.58}" y1="0" x2="${KENG * 0.42}" y2="${BALAND}" stroke="#ffffff" stroke-width="4" opacity="0.9"/>
      ${logoSvg(60, 62, cfg.accent)}
      <text x="110" y="${SAFE_TOP + 40}" font-family="Arial, sans-serif" font-size="40" font-weight="800" fill="#ffffff" letter-spacing="3">OLDIN</text>
      <text x="${KENG - 220}" y="${SAFE_TOP + 40}" font-family="Arial, sans-serif" font-size="40" font-weight="800" fill="${cfg.accent}" letter-spacing="3">KEYIN</text>
      <text x="60" y="${footerY + 90}" font-family="Arial, sans-serif" font-size="23" font-weight="700" fill="${cfg.accent}" letter-spacing="5">${xmlEscape(cfg.eyebrow)}</text>
      <rect x="60" y="${footerY + 112}" width="110" height="5" fill="${cfg.accent}"/>
      ${qatorlar.map((q, i) => `<text x="60" y="${footerY + 210 + i * 78}" font-family="Arial, sans-serif" font-size="68" font-weight="800" fill="${accentQator === i ? cfg.accent : '#ffffff'}">${q}</text>`).join('')}
    </svg>
  `);

  return sharp(chap)
    .composite([{ input: ongKesilgan, left: 0, top: 0 }, { input: overlaySvg, left: 0, top: 0 }])
    .png().toBuffer();
}

// --- 3-shablon: MATERIAL COMPARISON (kategoriya 8) -- vertikal split + VS.
async function comparisonShablon({ rasmBuf, rasmBuf2, headlineLines, labelA = 'A', labelB = 'B' }) {
  const cfg = KATEGORIYALAR[8];
  const yarimBaland = Math.round(BALAND * 0.42);
  const ustki = await sharp(await fonGaMoslash(rasmBuf)).resize(KENG, yarimBaland, { fit: 'cover' }).toBuffer();
  const pastki = await sharp(await fonGaMoslash(rasmBuf2 || rasmBuf)).resize(KENG, yarimBaland, { fit: 'cover' }).toBuffer();

  const qatorlar = (headlineLines && headlineLines.length ? headlineLines : ['QAYSI BIRI', "YAXSHI?"]).map(xmlEscape);
  const ortaY = Math.round(BALAND / 2);

  const overlaySvg = Buffer.from(`
    <svg width="${KENG}" height="${BALAND}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="t1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000" stop-opacity="0.55"/><stop offset="100%" stop-color="#000" stop-opacity="0.1"/>
        </linearGradient>
        <linearGradient id="t2" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#000" stop-opacity="0.55"/><stop offset="100%" stop-color="#000" stop-opacity="0.1"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${KENG}" height="${yarimBaland}" fill="url(#t1)"/>
      <rect x="0" y="${BALAND - yarimBaland}" width="${KENG}" height="${yarimBaland}" fill="url(#t2)"/>
      <rect x="0" y="${ortaY - 96}" width="${KENG}" height="192" fill="#0c0a08"/>
      ${logoSvg(60, 62, cfg.accent)}
      <text x="80" y="${yarimBaland - 50}" font-family="Arial, sans-serif" font-size="46" font-weight="800" fill="#ffffff">${xmlEscape(labelA)}</text>
      <text x="80" y="${BALAND - 50}" font-family="Arial, sans-serif" font-size="46" font-weight="800" fill="${cfg.accent}">${xmlEscape(labelB)}</text>
      <circle cx="${KENG / 2}" cy="${ortaY}" r="64" fill="${cfg.accent}"/>
      <text x="${KENG / 2}" y="${ortaY + 16}" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" font-weight="900" fill="#0c0a08">VS</text>
      ${qatorlar.map((q, i) => `<text x="${KENG / 2}" y="${ortaY - 150 + i * 56}" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" font-weight="800" fill="#ffffff">${q}</text>`).join('')}
    </svg>
  `);

  return sharp({ create: { width: KENG, height: BALAND, channels: 4, background: { r: 10, g: 9, b: 8, alpha: 1 } } })
    .composite([
      { input: ustki, left: 0, top: 0 },
      { input: pastki, left: 0, top: BALAND - yarimBaland },
      { input: overlaySvg, left: 0, top: 0 },
    ])
    .png().toBuffer();
}

// Yagona kirish nuqtasi -- Gemini tanlagan kategoriya raqamiga qarab mos
// shablonni chaqiradi. Har doim PNG buffer qaytaradi (xato ichkarida
// ushlanadi -- chaqiruvchi tomon try/catch bilan o'raydi).
//   rasmBuf       -- asosiy video kadri (har doim bor)
//   rasmBuf2       -- ixtiyoriy ikkinchi kadr (before/after, comparison uchun)
//   aiFonBuf       -- Pollinations fon (faqat hero shablonda ishlatiladi)
//   kategoriya     -- 1..8 (Gemini tanlovi, bo'lmasa 1)
//   headline       -- tayyor sarlavha matni (Gemini'dan)
//   accentSoz      -- sarlavha ichida qaysi so'z/qator rangda ajratilishi kerak
//   raqam          -- ixtiyoriy katta raqam (m², narx, xato soni)
//   subtitle       -- ixtiyoriy kichik pastki matn
export async function qopqoqYarat({ rasmBuf, rasmBuf2, aiFonBuf, kategoriya, headline, accentSoz, raqam, subtitle }) {
  const kat = Number(kategoriya) >= 1 && Number(kategoriya) <= 8 ? Number(kategoriya) : 1;
  const qatorlar = qatorlargaBol(headline || 'VISART DESIGN', 16);
  // accentSoz qaysi qatorda uchrasa, shu qator aksent rangda bo'ladi (topilmasa -- oxirgi qator)
  let accentQator = qatorlar.length - 1;
  if (accentSoz) {
    const idx = qatorlar.findIndex((q) => q.toLowerCase().includes(String(accentSoz).toLowerCase()));
    if (idx >= 0) accentQator = idx;
  }

  if (kat === 2) {
    return beforeAfterShablon({ rasmBuf, rasmBuf2, headlineLines: qatorlar, accentQator });
  }
  if (kat === 8) {
    return comparisonShablon({ rasmBuf, rasmBuf2, headlineLines: qatorlar, labelA: 'VARIANT A', labelB: 'VARIANT B' });
  }
  return heroShablon({ rasmBuf, aiFonBuf, kategoriya: kat, headlineLines: qatorlar, accentQator, raqam, subtitle });
}
