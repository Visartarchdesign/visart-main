// Visart targetolog/marketolog agentining bilimi. Raqamlar -- boshlang'ich taxmin (Toshkent, premium segment),
// NATIJALAR kelgach agent o'zi qayta baholaydi. "tasdiqlanmagan" = O'zbekiston uchun manbasi tekshirilmagan.
export const TARGET_BILIM = {
  biznes: "Visart Design (Toshkent): arxitektura loyiha, interyer dizayn, 3D vizualizatsiya, ishchi chizmalar, smeta, avtor nazorati. Mijoz: Toshkentda uy/kvartira/ofis egasi, qarori uzoq (1-4 hafta), chek katta, ishonch hal qiluvchi.",
  maqsad_voronka: "Reklama -> Instagram/Telegram -> bot (/start) -> lid (ism, telefon, maydon) -> menejer qo'ng'irog'i -> shartnoma. Reklama 'sotmaydi', suhbatni boshlaydi. Asosiy ko'rsatkich: SIFATLI LID narxi, klik emas.",
  auditoriya: [
    "Toshkent shahri + 15-25 km atrofi (Chilonzor, Yunusobod, Mirzo Ulug'bek, Yakkasaroy, Sergeli yangi uylar), yosh 28-55.",
    "Yangi kvartira/uy olgan yoki remont rejalashtirayotganlar; qiziqish: interyer dizayn, remont, uy dekori, mebel, ko'chmas mulk, arxitektura.",
    "Erkak/ayol ajratilmaydi (qaror ko'pincha er-xotin); Instagram auditoriya ~65% erkak -- ayollar uchun alohida test.",
    "Narx segmenti: o'rta-yuqori; arzon 'remont' so'rovchilarni filtrlash uchun matnda 'loyiha asosida' va minimal maydon (60 m2+) ko'rsatish.",
  ],
  kreativ: [
    "Birinchi 3 soniya: tayyor ish natijasi (render yoki real foto) + bitta aniq va'da. Video > karusel > bitta rasm.",
    "Faqat Visart'ning HAQIQIY ishlari (D:/E: arxiv, portfolio_katalog.json). Boshqalar rasmi, soxta 'oldin/keyin' yo'q.",
    "Matn <=125 belgi, bitta CTA ('Loyiha narxini bilish -> Telegram'). 'Premium', 'luxury' so'zlari yo'q.",
    "Har kampaniyada 2-3 xil kreativ (A/B), bir vaqtda bitta o'zgaruvchi.",
  ],
  korsatkichlar: {
    // tasdiqlanmagan boshlang'ich oraliqlar -- haqiqiy natija bilan almashtiriladi
    ctr_yomon: 0.8, ctr_yaxshi: 1.5, chastota_yuqori: 3, oyna_kun: 4,
    cpm_usd_oraliq: [1.5, 6],
  },
  byudjet_qoidasi: [
    "O'rganish bosqichi 3-7 kun: bu davrda hukm chiqarilmaydi, byudjet o'zgartirilmaydi.",
    "Boshlang'ich: 5-10 USD/kun x 7 kun (jami 35-70 USD). Natija ko'rsatsagina oshiriladi, har safar <=20% va faqat egasi tasdig'i bilan.",
    "Kunlik sarf belgilangan limitdan 30% oshsa -- avtomatik pauza (xavfsizlik).",
    "Pul: faqat egasi tasdig'idan keyin yoqiladi; hech qachon o'zi byudjetni oshirmaydi.",
  ],
  tanqidiy_tekshiruv: [
    "Klik bor, lid yo'q -> kreativ yoki taklif (offer) muammosi, auditoriya emas.",
    "CTR past (<0.8%) -> birinchi 3 soniya/sarlavha zaif; kreativni almashtir.",
    "Chastota >3 -> auditoriya toliqdi; kengaytir yoki yangi kreativ.",
    "Lid keldi, lekin sifatsiz (arzon remont/maydon kichik) -> matnni filtrlovchi qil.",
    "Hech qachon 'natija kafolat' va'dasi; 7 kundan kam ma'lumotga asoslanib xulosa yo'q.",
  ],
  cheklovlar: "Meta reklama hisobi: valyuta/to'lov usuli egasi tomonidan sozlanadi. Maxsus toifa (special_ad_categories) yo'q deb olinadi. Telegram havolasi reklamada ishlatiladi -- Meta rad etsa, Instagram profil/bot havolasiga o'tiladi.",
};

export function bilimMatn() {
  const b = TARGET_BILIM;
  return [
    `BIZNES: ${b.biznes}`, `VORONKA: ${b.maqsad_voronka}`,
    `AUDITORIYA:\n- ${b.auditoriya.join('\n- ')}`,
    `KREATIV:\n- ${b.kreativ.join('\n- ')}`,
    `BYUDJET:\n- ${b.byudjet_qoidasi.join('\n- ')}`,
    `TANQIDIY TEKSHIRUV:\n- ${b.tanqidiy_tekshiruv.join('\n- ')}`,
    `KO'RSATKICHLAR (tasdiqlanmagan): CTR<${b.korsatkichlar.ctr_yomon}% yomon, >${b.korsatkichlar.ctr_yaxshi}% yaxshi; chastota>${b.korsatkichlar.chastota_yuqori} yuqori; baho berish ${b.korsatkichlar.oyna_kun}+ kundan keyin.`,
    `CHEKLOV: ${b.cheklovlar}`,
  ].join('\n\n');
}
