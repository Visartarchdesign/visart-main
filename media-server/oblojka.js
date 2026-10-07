// Oblojka agenti -- 3 xil "pro darajadagi" shablon, real fotosurat ustiga
// Visart brendi (logotip/rang/matn) qo'yib, tayyor PNG rasm chiqaradi.
// AI rasm CHIZMAYDI -- faqat haqiqiy fotosuratingizni bezaydi (xavfsiz,
// brend uchun ishonchli yondashuv).

import sharp from 'sharp';

const KENG = 1080;
const BALAND = 1920; // Instagram Reels/Story nisbati (9:16)

const RANGLAR = {
  fon: '#15130f',
  aksent: '#c9a876', // oltin-jigarrang aksent -- keyinroq aniq brend rangiga almashtiriladi
  matn: '#ffffff',
};

function escapeXml(s) {
  return String(s || '').replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

// Telegram rasm/thumbnail JPEG, PNG yoki WebP bo'lishi mumkin -- noto'g'ri
// media_type bilan SVG <image> uni ko'rsatolmay, natija BO'SH chiqadi.
function rasmMediaTuri(b64) {
  if (b64.startsWith('iVBOR')) return 'image/png';
  if (b64.startsWith('UklGR')) return 'image/webp';
  if (b64.startsWith('R0lGOD')) return 'image/gif';
  return 'image/jpeg';
}

function toDataUri(photoBase64) {
  if (photoBase64.startsWith('data:')) return photoBase64;
  return `data:${rasmMediaTuri(photoBase64)};base64,${photoBase64}`;
}

// Matnni so'z bo'yicha taxminan 2 qatorga bo'ladi (chiroyli sig'dirish uchun)
function ikkiQatorga(title, maxBelgiQator) {
  const sozlar = String(title || '').trim().split(/\s+/);
  let qator1 = '';
  let qator2 = '';
  for (const s of sozlar) {
    if ((qator1 + ' ' + s).trim().length <= maxBelgiQator) {
      qator1 = (qator1 + ' ' + s).trim();
    } else {
      qator2 = (qator2 + ' ' + s).trim();
    }
  }
  return qator2 ? [qator1, qator2] : [qator1];
}

// 1-shablon: "Minimal gradient" -- to'liq fotosurat, pastda qorong'i soya,
// sarlavha pastda chapda, kategoriya chipi yuqorida.
function shablon1(photoUri, title, kategoriya) {
  const qatorlar = ikkiQatorga(title, 20);
  const matnY = BALAND - 260;
  return `
  <svg width="${KENG}" height="${BALAND}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="40%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.85"/>
      </linearGradient>
    </defs>
    <image href="${photoUri}" x="0" y="0" width="${KENG}" height="${BALAND}" preserveAspectRatio="xMidYMid slice"/>
    <rect x="0" y="0" width="${KENG}" height="${BALAND}" fill="url(#grad)"/>
    <text x="60" y="110" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="${RANGLAR.matn}" letter-spacing="4">VISART DESIGN</text>
    ${kategoriya ? `<rect x="60" y="150" width="${kategoriya.length * 16 + 50}" height="46" rx="23" fill="${RANGLAR.aksent}"/>
    <text x="85" y="181" font-family="Arial, sans-serif" font-size="24" font-weight="600" fill="#15130f">${escapeXml(kategoriya.toUpperCase())}</text>` : ''}
    <rect x="60" y="${matnY}" width="90" height="6" fill="${RANGLAR.aksent}"/>
    ${qatorlar.map((q, i) => `<text x="60" y="${matnY + 60 + i * 72}" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="${RANGLAR.matn}">${escapeXml(q)}</text>`).join('')}
  </svg>`;
}

// 2-shablon: "Split panel" -- chap tomonda brend rangidagi panel (logotip+
// sarlavha), o'ng tomonda to'liq fotosurat.
function shablon2(photoUri, title, kategoriya) {
  const panelKeng = Math.round(KENG * 0.4);
  const qatorlar = ikkiQatorga(title, 14);
  return `
  <svg width="${KENG}" height="${BALAND}" xmlns="http://www.w3.org/2000/svg">
    <image href="${photoUri}" x="${panelKeng}" y="0" width="${KENG - panelKeng}" height="${BALAND}" preserveAspectRatio="xMidYMid slice"/>
    <rect x="0" y="0" width="${panelKeng}" height="${BALAND}" fill="${RANGLAR.fon}"/>
    <text x="50" y="110" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="${RANGLAR.aksent}" letter-spacing="3">VISART</text>
    <text x="50" y="145" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="${RANGLAR.matn}" letter-spacing="3">DESIGN</text>
    <rect x="50" y="200" width="70" height="6" fill="${RANGLAR.aksent}"/>
    ${qatorlar.map((q, i) => `<text x="50" y="${280 + i * 64}" font-family="Arial, sans-serif" font-size="50" font-weight="700" fill="${RANGLAR.matn}">${escapeXml(q)}</text>`).join('')}
    ${kategoriya ? `<text x="50" y="${280 + qatorlar.length * 64 + 50}" font-family="Arial, sans-serif" font-size="26" font-weight="500" fill="${RANGLAR.aksent}" letter-spacing="2">${escapeXml(kategoriya.toUpperCase())}</text>` : ''}
  </svg>`;
}

// 3-shablon: "Frame" -- fotosurat nozik ramka ichida, yuqorida logotip,
// pastda brend rangidagi banner + sarlavha.
function shablon3(photoUri, title, kategoriya) {
  const chegara = 36;
  const bannerBalandligi = 280;
  const qatorlar = ikkiQatorga(title, 22);
  return `
  <svg width="${KENG}" height="${BALAND}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${KENG}" height="${BALAND}" fill="${RANGLAR.fon}"/>
    <image href="${photoUri}" x="${chegara}" y="${chegara}" width="${KENG - chegara * 2}" height="${BALAND - chegara * 2 - bannerBalandligi}" preserveAspectRatio="xMidYMid slice"/>
    <rect x="${chegara}" y="${chegara}" width="${KENG - chegara * 2}" height="${BALAND - chegara * 2 - bannerBalandligi}" fill="none" stroke="${RANGLAR.aksent}" stroke-width="3"/>
    <text x="${KENG / 2}" y="${chegara + 50}" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="${RANGLAR.matn}" letter-spacing="4" text-anchor="middle">VISART DESIGN</text>
    <rect x="0" y="${BALAND - bannerBalandligi}" width="${KENG}" height="${bannerBalandligi}" fill="${RANGLAR.fon}"/>
    ${kategoriya ? `<text x="${KENG / 2}" y="${BALAND - bannerBalandligi + 60}" font-family="Arial, sans-serif" font-size="24" font-weight="600" fill="${RANGLAR.aksent}" letter-spacing="3" text-anchor="middle">${escapeXml(kategoriya.toUpperCase())}</text>` : ''}
    ${qatorlar.map((q, i) => `<text x="${KENG / 2}" y="${BALAND - bannerBalandligi + 140 + i * 60}" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="${RANGLAR.matn}" text-anchor="middle">${escapeXml(q)}</text>`).join('')}
  </svg>`;
}

// 4-shablon: "Karusel slayd" -- to'liq fotosurat, KATTA sarlavha YO'Q (faqat
// muqova slaydida bo'ladi), pastki burchakda nozik brend belgisi. Bir nechta
// rasmli karusel postning 2-, 3-... slaydlari uchun -- har birida bir xil
// katta matn takrorlanib zerikarli bo'lib qolmasligi uchun.
function shablonKarusel(photoUri, kategoriya) {
  return `
  <svg width="${KENG}" height="${BALAND}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gradKarusel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="80%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
      </linearGradient>
    </defs>
    <image href="${photoUri}" x="0" y="0" width="${KENG}" height="${BALAND}" preserveAspectRatio="xMidYMid slice"/>
    <rect x="0" y="0" width="${KENG}" height="${BALAND}" fill="url(#gradKarusel)"/>
    <rect x="0" y="0" width="${KENG}" height="${BALAND}" fill="none" stroke="${RANGLAR.aksent}" stroke-width="10"/>
    <text x="${KENG - 50}" y="${BALAND - 60}" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="${RANGLAR.matn}" letter-spacing="3" text-anchor="end">VISART DESIGN</text>
    ${kategoriya ? `<text x="50" y="${BALAND - 60}" font-family="Arial, sans-serif" font-size="22" font-weight="600" fill="${RANGLAR.aksent}" letter-spacing="2">${escapeXml(kategoriya.toUpperCase())}</text>` : ''}
  </svg>`;
}

export async function yasaOblojka({ shablon, photoBase64, title, kategoriya }) {
  const photoUri = toDataUri(photoBase64);
  if (shablon === 'karusel') {
    return sharp(Buffer.from(shablonKarusel(photoUri, kategoriya))).png().toBuffer();
  }
  const tanlangan = { 1: shablon1, 2: shablon2, 3: shablon3 }[shablon] || shablon1;
  const svg = tanlangan(photoUri, title, kategoriya);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
