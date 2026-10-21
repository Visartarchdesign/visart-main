// Qo'lda yozilgan premium senariylar banki (Claude muallifligida). Har senariy sahnalar kutubxonasi bilan sinxron:
// t0..t1 -- sahna animatsiyasining shu slaydga to'g'ri keladigan bosqichi (bir sahna ketma-ket slaydlarda uzluksiz davom etadi).
// Faktsiz, faqat umume'tirof etilgan tamoyillar. Ovozdagi raqamlar so'z bilan.
const S = (tur, sarlavha, vurgu, sahna, t0, t1, ovoz) => ({ tur, sarlavha, vurgu, sahna, t0, t1, ovoz });

export const SENARIYLAR = [
  {
    id: 'chiroq-rangi', post_sarlavha: 'Chiroq rangi uyni arzon ko\'rsatadi', vurgu: 'arzon',
    tavsif: "Chiroq rangi xona kayfiyatini butunlay o'zgartiradi. Yashash xonasida iliq, ish joyida sovuqroq nur tanlang.\nSizning uyingizda qanday chiroq yonadi?",
    hashtaglar: '#interyer #yoritish #dizayn #toshkent #remont #uydizayni #visartdesign',
    slaydlar: [
      S('hook', 'Oq chiroq uyni arzon ko\'rsatadi', 'arzon', 'lampa_kelvin', 0, 0.06, "Uyingiz nega arzon ko'rinadi? Gap chiroqning rangida bo'lishi mumkin."),
      S('mazmun', 'Iliq nur: 2700K', '2700K', 'lampa_kelvin', 0.06, 0.4, "Iliq nur, ya'ni ikki ming yetti yuz kelvin, xonani yumshoq va issiq qiladi."),
      S('mazmun', 'Kelvin oshadi', 'oshadi', 'lampa_kelvin', 0.4, 0.8, "Kelvin oshgani sari nur sovuqlashadi, devorlar muzdek ko'rina boshlaydi."),
      S('mazmun', 'Sovuq nur: 6500K', '6500K', 'lampa_kelvin', 0.8, 1, "Olti ming besh yuz kelvinda esa xona ofisga o'xshab qoladi."),
      S('xulosa', 'Yotoqxonaga iliq nur', 'iliq', 'lampa_kelvin', 1, 1, "Yotoqxona va mehmonxonaga iliq nur tanlang, ish joyiga sovuqroq. Sizning uyingizda qaysi nur yonadi?"),
    ],
  },
  {
    id: 'quyosh-yoli', post_sarlavha: 'Quyosh xonangizga qanday kiradi', vurgu: 'quyosh',
    tavsif: "Mebelni joylashtirishdan oldin kun davomida quyosh yo'lini kuzating. Divan va gilam rangi quyoshda tez o'chadi.\nSizning xonangizga quyosh qachon kiradi?",
    hashtaglar: '#interyer #quyosh #yoritish #planirovka #dizayn #toshkent #visartdesign',
    slaydlar: [
      S('hook', 'Xonangizga quyosh qachon kiradi?', 'quyosh', 'quyosh_xona', 0, 0.08, "Xonangizga quyosh qachon kirishini bilasizmi?"),
      S('mazmun', 'Tushda nur qisqa', 'qisqa', 'quyosh_xona', 0.08, 0.4, "Tushda quyosh baland turadi va oynadan tushgan nur polga qisqa tushadi."),
      S('mazmun', 'Kechga nur uzayadi', 'uzayadi', 'quyosh_xona', 0.4, 0.85, "Kech tomon quyosh pasayadi, nur uzayib, xonaning ichkarisigacha kirib boradi."),
      S('mazmun', 'Divanni uzoqroq', 'uzoqroq', 'quyosh_xona', 0.85, 1, "Shuning uchun divanni oynadan uzoqroq qo'ying, mato tez o'chib ketmasin."),
      S('xulosa', 'Avval quyosh yo\'lini kuzating', 'kuzating', 'quyosh_xona', 1, 1, "Mebel qo'yishdan oldin quyosh yo'lini kuzating. Sizning xonangizga quyosh qachon kiradi?"),
    ],
  },
  {
    id: 'parda-osish', post_sarlavha: 'Oyna nega kichik ko\'rinadi?', vurgu: 'kichik',
    tavsif: "Pardani to'g'ri osish oynani kattaroq, shiftni balandroq ko'rsatadi. Karnizni shiftga yaqin, oynadan 20-30 sm kengroq o'rnating.\nSizning pardangiz qanday osilgan?",
    hashtaglar: '#interyer #parda #oyna #uydizayni #dizayn #remont #visartdesign',
    slaydlar: [
      S('hook', 'Oyna nega kichik ko\'rinadi?', 'kichik', 'parda_taqqos', 0, 0.1, "Parda noto'g'ri osilsa, oynangiz kichik ko'rinadi."),
      S('mazmun', 'Karniz shiftga yaqin', 'shiftga', 'parda_taqqos', 0.1, 0.5, "Birinchi xato: karniz oynaning tepasiga taqab o'rnatiladi. Uni shiftga yaqinroq osing."),
      S('mazmun', 'Oynadan kengroq', 'kengroq', 'parda_taqqos', 0.5, 0.8, "Ikkinchi xato: parda oyna kengligicha olinadi. Ikki yonga yigirma-o'ttiz santimetr kengroq qiling."),
      S('mazmun', 'Oyna katta, shift baland', 'baland', 'parda_taqqos', 0.8, 1, "Natijada oyna to'liq ochiladi, shift esa balandroq ko'rinadi."),
      S('xulosa', 'Saqlab qo\'ying', 'saqlab', 'parda_taqqos', 1, 1, "Pardani oynadan kengroq va shiftga yaqin osing. Sizniki qanday osilgan?"),
    ],
  },
  {
    id: 'planirovka-birinchi', post_sarlavha: 'Remontdan oldin planirovka', vurgu: 'planirovka',
    tavsif: "Planirovka tayyor bo'lmasdan turib mebel va jihozga pul sarflamang. Xonalar joylashuvi kundalik qulaylikni belgilaydi.\nUyingiz planirovkasi sizga qulaymi?",
    hashtaglar: '#planirovka #remont #interyer #uydizayni #arxitektura #toshkent #visartdesign',
    slaydlar: [
      S('hook', 'Remontdan oldin eng muhimi', 'muhimi', 'planirovka', 0, 0.05, "Remontdan oldin eng muhim ish nima? Planirovka."),
      S('mazmun', 'Devorlar joyi', 'devorlar', 'planirovka', 0.05, 0.4, "Avval devorlar joyini aniq belgilang, qolgan hamma narsa shunga bog'lanadi."),
      S('mazmun', 'Yotoqxona uzoqroq', 'uzoqroq', 'planirovka', 0.4, 0.7, "Yotoqxonani mehmonxonadan uzoqroq qo'ying, tinch uxlaysiz."),
      S('mazmun', 'Oshxona va hammom', 'yaqin', 'planirovka', 0.7, 1, "Oshxona va hammom yaqin tursin, suv quvuri qisqa va arzon bo'ladi."),
      S('xulosa', 'Avval reja', 'reja', 'planirovka', 1, 1, "Reja tayyor bo'lmasdan turib, mebel olmang. Avval devor, keyin qolgani."),
    ],
  },
  {
    id: 'kichik-xona', post_sarlavha: 'Kichik xonaga hamma narsa sig\'adi', vurgu: 'sig\'adi',
    tavsif: "Kichik xona tor emas, shunchaki noto'g'ri joylashtirilgan bo'ladi. Mebelni ketma-ket, devor bo'ylab joylashtiring.\nSizning xonangiz necha metr?",
    hashtaglar: '#kichikxona #interyer #mebel #joytejash #uydizayni #toshkent #visartdesign',
    slaydlar: [
      S('hook', 'To\'rtga to\'rt xona', 'to\'rtga', 'kichik_xona', 0, 0.08, "To'rt metrlik xonaga karavot, shkaf va ish stoli sig'adimi?"),
      S('mazmun', 'Karavot devor bo\'ylab', 'karavot', 'kichik_xona', 0.08, 0.35, "Sig'adi. Avval karavotni devor bo'ylab qo'ying."),
      S('mazmun', 'Shkaf balandligi', 'shkaf', 'kichik_xona', 0.35, 0.62, "Shkafni tor devorga qo'ying, balandligi bilan joyni tejaydi."),
      S('mazmun', 'Ish stoli oyna yonida', 'oyna', 'kichik_xona', 0.62, 0.9, "Ish stolini oyna yoniga qo'ying, kun nuri qo'shimcha chiroq o'rnini bosadi."),
      S('xulosa', 'Xona tor emas', 'tor', 'kichik_xona', 1, 1, "Xona tor emas, shunchaki to'g'ri joylashtirilmagan. Sizning xonangiz necha metr?"),
    ],
  },
  {
    id: 'rang-60-30-10', post_sarlavha: 'Rang tanlashda 60-30-10 qoidasi', vurgu: 'qoidasi',
    tavsif: "Xonada ranglar nisbati: 60 foiz devor, 30 foiz mebel, 10 foiz aksent. Shunda xona tartibli va uyg'un ko'rinadi.\nSizning xonangizda qaysi rang aksent?",
    hashtaglar: '#rang #interyer #palitra #dizayn #uydizayni #remont #visartdesign',
    slaydlar: [
      S('hook', 'Rangda adashmang', 'adashmang', 'rang_palitra', 0, 0.04, "Rang tanlashda adashmaslik uchun bitta oddiy qoida bor."),
      S('mazmun', 'Oltmish foiz: devor', 'devor', 'rang_palitra', 0.04, 0.35, "Oltmish foiz bu devor va katta yuzalar. Xotirjam, och rang tanlang."),
      S('mazmun', 'O\'ttiz foiz: mebel', 'mebel', 'rang_palitra', 0.35, 0.65, "O'ttiz foiz bu mebel. Divan devordan biroz to'qroq bo'lsin."),
      S('mazmun', 'O\'n foiz: aksent', 'aksent', 'rang_palitra', 0.65, 0.95, "O'n foiz bu yostiq, parda yoki o'simlik. Yorqin rangni aynan shu yerga qo'ying."),
      S('xulosa', 'Xona uyg\'un bo\'ladi', 'uyg\'un', 'rang_palitra', 1, 1, "Oltmish, o'ttiz, o'n. Shunda xona tartibli va uyg'un ko'rinadi."),
    ],
  },
  {
    id: 'hovli-soya', post_sarlavha: 'Hovlida soya qayerga tushadi', vurgu: 'soya',
    tavsif: "Hovli yoki uy qurishdan oldin kun davomida soya qayerga tushishini kuzating. Daraxt va ayvon joyi shunga bog'liq.\nSizning hovlingiz yozda issiqmi?",
    hashtaglar: '#hovli #soya #arxitektura #uyqurish #landshaft #toshkent #visartdesign',
    slaydlar: [
      S('hook', 'Hovli nega issiq?', 'issiq', 'hovli_soya', 0, 0.06, "Yozda hovli nega bunday issiq? Soya noto'g'ri tushgan bo'lishi mumkin."),
      S('mazmun', 'Ertalab soya uzun', 'uzun', 'hovli_soya', 0.06, 0.3, "Ertalab quyosh past turadi, soya uzun bo'ladi."),
      S('mazmun', 'Tushda soya qisqa', 'qisqa', 'hovli_soya', 0.3, 0.65, "Tushda soya deyarli yo'qoladi, aynan shu payt ayvon va daraxt kerak bo'ladi."),
      S('mazmun', 'Kechga yana uzayadi', 'uzayadi', 'hovli_soya', 0.65, 0.95, "Kechga soya yana uzayadi. Daraxtni quyosh tushadigan tomonga o'tqazing."),
      S('xulosa', 'Soyani kuzating', 'kuzating', 'hovli_soya', 1, 1, "Qurishdan oldin soyani kuzating. Sizning hovlingizda soya qayerga tushadi?"),
    ],
  },
];

export function senariyTanla(oxirgiSarlavhalar = [], mavzu = '') {
  const ishlatilgan = new Set(oxirgiSarlavhalar.map((x) => String(x || '').toLowerCase()));
  const mavjud = SENARIYLAR.filter((s) => !ishlatilgan.has(s.post_sarlavha.toLowerCase()));
  const kalit = String(mavzu || '').toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  if (kalit.length) {
    const baho = SENARIYLAR.map((s) => ({ s, b: kalit.filter((w) => (s.post_sarlavha + ' ' + s.id + ' ' + s.tavsif).toLowerCase().includes(w.slice(0, 5))).length }));
    const eng = baho.sort((a, b) => b.b - a.b)[0];
    if (eng && eng.b > 0) return eng.s;
    return null; // admin mavzu berdi, bankda yo'q -> Gemini yozadi
  }
  const pool = mavjud.length ? mavjud : SENARIYLAR;
  return pool[Math.floor(Math.random() * pool.length)];
}
