// B seriya senariy QONUNI -- bitta manba: Gemini'ga prompt ham, tekshiruv ham shu yerdan.
export const QONUN = [
  'FORMULA: HOOK (raqamli savol/da\'vo) -> 3 zona [QOIDA (umumiy me\'yor, raqam bilan) -> SABAB (shu rejadagi o\'lcham, FAKTLARdan) -> KAMCHILIK (boshqacha qilinsa aniq oqibat)] -> CTA (Direct + kalit so\'z).',
  'Hook: <=10 so\'z, kamida 1 raqam yoki aniq savol. "sir", "siz bilmagan", "3 ta sir" kabi bo\'sh va\'dalar TAQIQ.',
  'Qoida: odatda qabul qilingan ergonomika me\'yori, albatta raqam bilan (sm/mm/m). Hamma kimdir o\'zi uyida qo\'llay oladigan bo\'lsin.',
  'Sabab: faqat FAKTLARda yozilgan o\'lchamlar. FAKTLARda yo\'q raqam, deraza, oyna, rang, material TAQIQ.',
  'Kamchilik (boshqa): jismoniy, kundalik oqibat (tirsak tegadi, idish sig\'maydi). Raqamsiz, <=16 so\'z.',
  '"kam" -- muammo nomi (Tor ..., Past ...), yechim emas.',
  '3 zona: har xil xona yoki har xil qaror, har xil render. Render faqat shu qaror ROSTDAN ko\'ringanda.',
  'Mijoz, loyiha nomi, "kvartirasi" tilga olinmasin. Oblojka: <=6 so\'z, mazmunga mos umumiy foyda.',
  'CTA: <=14 so\'z, "Direct" va KALIT SO\'Z ("REJA") bo\'lsin.',
  'Til: og\'zaki lotin o\'zbekcha, qisqa gaplar, bitta gapda bitta fikr. Jami ovoz matni 60-110 so\'z.',
];
const soz = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
const raqamlar = (t) => (String(t).match(/\d+(?:[.,]\d+)?/g) || []);

export function tekshir(S, faktlar, nom = '') {
  const x = [];
  const F = JSON.stringify(faktlar || {}).toLowerCase();
  const fraq = new Set(raqamlar(F));
  if (soz(S.hook) > 10) x.push('hook 10 so\'zdan uzun');
  if (!raqamlar(S.hook).length && !/\?/.test(S.hook)) x.push('hookda raqam yoki savol yo\'q');
  if (/\bsir(lar)?\b|siz bilmagan/i.test(`${S.hook} ${S.oblojka}`)) x.push('hook/oblojkada bo\'sh va\'da ("sir")');
  if (soz(S.oblojka) > 6) x.push('oblojka 6 so\'zdan uzun');
  const nomSozlari = String(nom).toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const hammasi = JSON.stringify(S).toLowerCase().replace(/"faktlar".*$/s, '');
  nomSozlari.forEach((w) => { if (hammasi.includes(w)) x.push(`loyiha nomi ("${w}") tilga olingan`); });
  if (/kvartirasi/i.test(S.oblojka || '')) x.push('oblojkada "kvartirasi"');
  if (!/direct/i.test(S.oxir || '') || !/[A-ZА-Я]{3,}/.test(S.oxir || '')) x.push('CTA da Direct va KALIT SO\'Z (katta harfda) yo\'q');
  if (soz(S.oxir) > 14) x.push('CTA 14 so\'zdan uzun');
  const Z = S.zonalar || [];
  if (Z.length !== 3) x.push('zonalar 3 ta emas');
  if (new Set(Z.map((z) => z.rasm)).size !== Z.length) x.push('zonalarda render takrorlangan');
  if (new Set(Z.map((z) => z.xona)).size < 2) x.push('zonalar bir xonada (kamida 2 xona bo\'lsin)');
  const deraza = /deraza|oyna/;
  const derazaYoq = /mavjud emas|yo'q/.test(F.match(/"eshik_deraza":"[^"]*"/g)?.join('') || '');
  let jami = soz(S.hook) + soz(S.oxir);
  Z.forEach((z, i) => {
    const n = `zona${i + 1}`;
    if (!raqamlar(z.qoida).length) x.push(`${n}: qoidada raqam yo'q`);
    raqamlar(z.sabab).forEach((r) => { if (!fraq.has(r) && !raqamlar(z.qoida).includes(r)) x.push(`${n}: sababdagi "${r}" FAKTLARda yo'q`); });
    if (!raqamlar(z.sabab).length) x.push(`${n}: sababda rejadagi o'lcham yo'q`);
    if (raqamlar(z.boshqa).length) x.push(`${n}: kamchilik gapida raqam bor`);
    if (soz(z.boshqa) > 16) x.push(`${n}: boshqa 16 so'zdan uzun`);
    if (soz(z.sabab) > 24) x.push(`${n}: sabab 24 so'zdan uzun`);
    if (/^(joyni tejash|yechim|qulay)/i.test(z.kam || '')) x.push(`${n}: "kam" yechim, muammo nomi emas`);
    if (derazaYoq && deraza.test(`${z.kam} ${z.qoida} ${z.sabab} ${z.boshqa}`)) x.push(`${n}: rejada deraza yo'q, lekin tilga olingan`);
    jami += soz(z.sabab) + soz(z.boshqa);
  });
  if (jami < 60 || jami > 130) x.push(`ovoz matni ${jami} so'z (60-110 bo'lsin)`);
  return x;
}
