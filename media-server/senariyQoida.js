// B seriya senariy QONUNI -- bitta manba: Gemini'ga prompt ham, tekshiruv ham shu yerdan.
export const QONUN = [
  'FORMULA: HOOK (raqamli savol/da\'vo) -> 3 zona [MUAMMO (umumiy me\'yor raqam bilan + buzilsa kundalik oqibat; rejada ko\'rsatiladi) -> YECHIM ("Visart Design" shu rejada aniq nima qilgani, FAKTLARdagi o\'lcham bilan; renderda) -> YANGI KAMCHILIK (shu yechim keltirib chiqargan yon muammo) -> uning YECHIMI (Visart Design)] -> TABRIK + CTA ("Tabriklayman! Siz Visart Design bilan uyni to\'g\'ri loyihaladingiz. Sizga ham shunday mukammal loyiha kerak bo\'lsa, Direct\'ga REJA deb yozing.").',
  'Hook: <=10 so\'z, kamida 1 raqam yoki aniq savol. "sir", "siz bilmagan", "3 ta sir" kabi bo\'sh va\'dalar TAQIQ.',
  'Qoida: odatda qabul qilingan ergonomika me\'yori, albatta raqam bilan (sm/mm/m). Hamma kimdir o\'zi uyida qo\'llay oladigan bo\'lsin.',
  'Muammo: <=18 so\'z; birinchi gapda me\'yor (raqam), ikkinchisida buzilsa jismoniy oqibat (tirsak tegadi, idish sig\'maydi).',
  'Yangi kamchilik (yangi): <=14 so\'z, "Lekin ..." bilan boshlanadi, yechimning haqiqiy yon ta\'siri. Yechim2: <=16 so\'z, "Visart Design" bilan boshlanadi, FAKTLARdagi narsalarga tayanadi.',
  'Yechim: "Visart Design" so\'zlari bilan boshlanadi, <=16 so\'z, faqat FAKTLARda yozilgan o\'lcham. FAKTLARda yo\'q raqam, deraza, oyna, rang, material TAQIQ.',
  '"kam" -- muammo nomi (Tor ..., Past ...), yechim emas.',
  '3 zona: har xil xona yoki har xil qaror, har xil render. Render faqat shu qaror ROSTDAN ko\'ringanda.',
  'Mijoz, loyiha nomi, "kvartirasi" tilga olinmasin. Oblojka: <=6 so\'z, mazmunga mos umumiy foyda.',
  'Yakun (oxir): <=30 so\'z: tabrik ("Tabriklayman"), "Visart Design bilan uyni to\'g\'ri loyihaladingiz", sizga ham shunday loyiha kerak bo\'lsa "Direct" va KALIT SO\'Z ("REJA").',
  'Til: og\'zaki lotin o\'zbekcha, qisqa gaplar, bitta gapda bitta fikr. Jami ovoz matni 120-200 so\'z.',
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
  if (soz(S.oxir) > 30) x.push('yakun 30 so\'zdan uzun');
  if (!/tabrik/i.test(S.oxir || '') || !/visart design/i.test(S.oxir || '')) x.push('yakunda tabrik va "Visart Design bilan to\'g\'ri loyihaladingiz" yo\'q');
  const Z = S.zonalar || [];
  if (Z.length !== 3) x.push('zonalar 3 ta emas');
  if (new Set(Z.map((z) => z.rasm)).size !== Z.length) x.push('zonalarda render takrorlangan');
  if (new Set(Z.map((z) => z.xona)).size < 2) x.push('zonalar bir xonada (kamida 2 xona bo\'lsin)');
  const deraza = /deraza|oyna/;
  const derazaYoq = /mavjud emas|yo'q/.test(F.match(/"eshik_deraza":"[^"]*"/g)?.join('') || '');
  let jami = soz(S.hook) + soz(S.oxir);
  Z.forEach((z, i) => {
    const n = `zona${i + 1}`;
    if (!raqamlar(z.muammo).length) x.push(`${n}: muammoda me'yor raqami yo'q`);
    if (soz(z.muammo) > 18) x.push(`${n}: muammo 18 so'zdan uzun`);
    if (!/^visart design/i.test(String(z.yechim || '').trim())) x.push(`${n}: yechim "Visart Design" bilan boshlanmaydi`);
    if (soz(z.yechim) > 16) x.push(`${n}: yechim 16 so'zdan uzun`);
    if (!/^lekin/i.test(String(z.yangi || '').trim()) || soz(z.yangi) > 14) x.push(`${n}: yangi kamchilik "Lekin..." bilan boshlanib <=14 so'z bo'lsin`);
    if (!/^visart design/i.test(String(z.yechim2 || '').trim()) || soz(z.yechim2) > 16) x.push(`${n}: yechim2 "Visart Design" bilan boshlanib <=16 so'z bo'lsin`);
    raqamlar(`${z.yangi} ${z.yechim2}`).forEach((r) => { if (!fraq.has(r)) x.push(`${n}: yangi/yechim2 dagi "${r}" FAKTLARda yo'q`); });
    if (!raqamlar(z.yechim).length) x.push(`${n}: yechimda rejadagi o'lcham yo'q`);
    raqamlar(z.yechim).forEach((r) => { if (!fraq.has(r)) x.push(`${n}: yechimdagi "${r}" FAKTLARda yo'q`); });
    if (/^(joyni tejash|yechim|qulay)/i.test(z.kam || '')) x.push(`${n}: "kam" yechim, muammo nomi emas`);
    if (derazaYoq && deraza.test(`${z.kam} ${z.muammo} ${z.yechim}`)) x.push(`${n}: rejada deraza yo'q, lekin tilga olingan`);
    jami += soz(z.muammo) + soz(z.yechim) + soz(z.yangi) + soz(z.yechim2);
  });
  if (jami < 100 || jami > 210) x.push(`ovoz matni ${jami} so'z (120-200 bo'lsin)`);
  return x;
}
