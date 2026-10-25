// Animatsion/ta'limiy videolar uchun mavzu xilma-xilligi: ustunlar (pillar) aylanadi, bir ustun ketma-ket takrorlanmaydi.
// Tarixiy/mashhur obyektlar: faqat umume'tirof etilgan faktlar (aniq yil/raqam -- 100% ishonchli bo'lsagina).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const MAVZU_BANKI = {
  'Tarixiy binolar': ['Panteon (Rim): gumbaz va markazdagi oculus', 'Ayasofya: gumbaz qanday "suzib" turadi', 'Kolizey: olomonni boshqarish me\'morchiligi', 'Parfenon: ko\'zni aldovchi to\'g\'ri chiziqlar', 'Sagrada Familia: tabiatdan ilhomlangan ustunlar', 'Eyfel minorasi: nega panjara shaklida', 'Gotika soborlari: tayanch yoylar (arbutan) vazifasi'],
  'Tarixiy interyerlar': ['Versal saroyi: Oynalar zali nega shunday yaratilgan', 'Barokko interyeri: nega hammasi bezakli', 'Klassitsizm uslubi: nisbat va simmetriya', 'Art Deko interyeri: geometriya va yorqin material', 'Sharq saroylarida ichki hovli va suv', 'Shotlandiya/Angliya kutubxonalari: yorug\'lik va tokchalar', 'Bauhaus: "shakl vazifaga xizmat qiladi" g\'oyasi'],
  "O'zbekiston me'morchiligi": ['Registon: ansambl nisbati va ko\'k rang', 'Shohizinda: sirli koshin va rang', 'Ganchkori (ganch o\'ymakorligi) interyerda', 'An\'anaviy hovli: nega yozda salqin', 'Eyvon: soya va shamol me\'morchiligi', 'Toshkent modernizmi: Sovet davri mashhur binolari', 'Amir Temur davri gumbazlari'],
  "Mashhur me'morlar": ['Antoni Gaudi: egri chiziqlar va tabiat', 'Le Korbyuzye: "yashash mashinasi" g\'oyasi', 'Zaha Hadid: oqib turuvchi shakllar', 'Frank Llayd Rayt: tabiat bilan uyg\'un uy (Fallingwater)', 'Mis van der Roe: "kamroq -- ko\'proq"', 'Norman Foster: yorug\'lik va shaffoflik', 'Mimar Sinan: usmonli me\'morchilik ustozi'],
  'Dunyo shaharlari va ramzlar': ['Dubay Burj Xalifa: balandlik muammolari', 'Sidney opera uyi: yelkan shakli qanday qurilgan', 'Venetsiya: suv ustidagi shahar poydevori', 'Pekin Taqiqlangan shahar: yo\'nalish va simmetriya', 'Nyu-York osmono\'par binolari: nega po\'lat karkas', 'Singapur "Gardens by the Bay": vertikal yashil'],
  'Uslublar tarixi': ['Minimalizm qayerdan chiqdi', 'Skandinav uslubi: nega yorug\' va oddiy', 'Loft: sanoat binosidan uy', 'Neoklassika vs zamonaviy klassika', 'Yaponcha uy: tatami va siljuvchi devor', 'Midcentury modern mebel qanday paydo bo\'ldi'],
  'Material va texnologiya tarixi': ['Beton: Rimdan hozirgacha', 'Shisha: derazadan fasadgacha', 'Ganch: qadimiy bezak materiali', 'G\'isht: nega 5000 yildan beri ishlatiladi', 'Po\'lat va lift: osmono\'par binolar kaliti', 'Yog\'och: eski ustalik va zamonaviy CLT'],
  'Interyer xatolari va maslahatlar': ['Interyer xatolari', 'Kichik xonani katta ko\'rsatish', 'Yoritish qatlamlari', 'Planirovka maslahati', 'Rang va uslub tanlash', 'Byudjetni tejash', 'Remont ketma-ketligi'],
  'Mif va haqiqat': ['"Oq rang xonani doim kattalashtiradi" -- rostmi', '"Qimmat remont = yaxshi interyer" -- rostmi', '"Oyna xonani doim yoritadi" -- rostmi', '"Minimalizm = bo\'sh xona" -- rostmi', '"Gips shift hammaga kerak" -- rostmi'],
  'Dizayn psixologiyasi': ['Rang kayfiyatga qanday ta\'sir qiladi', 'Shift balandligi va his-tuyg\'u', 'Yorug\'lik harorati va uyqu', 'Tartib va chalkashlik: ko\'z qanday o\'qiydi', 'Hid, tovush va akustika interyerda'],
};

const FAYL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'mavzu_tarix.json');
const o = () => { try { return JSON.parse(fs.readFileSync(FAYL, 'utf8')); } catch { return { ustunlar: [], g: [] }; } };

// Oxirgi 4 ustundan farqli, eng kam ishlatilgan ustun + unga mos hali ishlatilmagan g'oya
export function keyingiMavzu() {
  const t = o();
  const nomlar = Object.keys(MAVZU_BANKI);
  const song = t.ustunlar.slice(-4);
  const nomzod = nomlar.filter((n) => !song.includes(n));
  const sanoq = (n) => t.ustunlar.filter((x) => x === n).length;
  nomzod.sort((a, b) => sanoq(a) - sanoq(b) || Math.random() - 0.5);
  const ustun = nomzod[0] || nomlar[0];
  const bosh = MAVZU_BANKI[ustun].filter((g) => !t.g.includes(g));
  const royxat = bosh.length ? bosh : MAVZU_BANKI[ustun];
  const goya = royxat[Math.floor(Math.random() * royxat.length)];
  t.ustunlar = [...t.ustunlar, ustun].slice(-60);
  t.g = [...t.g.filter((x) => x !== goya), goya].slice(-120);
  try { fs.writeFileSync(FAYL, JSON.stringify(t)); } catch { /* ixtiyoriy */ }
  return { ustun, goya };
}
