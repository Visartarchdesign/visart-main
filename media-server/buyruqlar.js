// HAR BIR video senariysiga avtomatik qo'shiladigan doimiy buyruqlar. Yangi talab -- shu ro'yxatga qator qo'shing.
export const BUYRUQLAR = [
  "BREND: yechim qismida (kamida bitta slaydda) Visart Design jamoasi muammoni qanday hal qilishini ayting, masalan: \"Vizart Dizayn jamoasi buni mana bunday hal qiladi: ...\" va keyin aniq amal. Ovozda brend nomi \"Vizart Dizayn\" deb yoziladi (to'g'ri talaffuz uchun). Har videoda brend bir-ikki marta, ortiqcha reklamasiz.",
  "TIL: jonli o'zbek so'zlashuvi, grammatik to'g'ri: kelishik (-ning, -ni, -ga, -da, -dan), egalik (-im, -ing, -i), fe'l zamonlari (-yapti, -di, -ar edi) to'g'ri qo'llansin; tarjima gap tuzilishi yo'q, fe'l gap oxirida; har gap 6-11 so'z.",
  "TUSHUNARLILIK: har slaydda bitta fikr; ko'z oldida ko'rinadigan narsani ko'rsatib gapiring (mana bu, shu, bu yerda).",
  "HALOLLIK: to'qima raqam, kafolat, va'da yo'q; natija 'yordam berishi mumkin' darajasida.",
  "HOOK: birinchi gap xarajat/xato/yo'qotish haqida aniq savol yoki da'vo bo'lsin (masalan 'Remontda eng qimmat xato qaysi?'); salomlashish, kirish gap yo'q.",
  "TUZILMA: muammo -> sabab -> yechim -> foyda; xato usul va to'g'ri usul QARSHI QO'YILSIN ('ko'pchilik shunday qiladi ... to'g'risi esa ...').",
  "QIYMAT: tomoshabin pul, vaqt yoki asabni qanday tejashini aytib bering (raqamsiz bo'lsa ham aniq: 'ikki marta ishlamaysiz', 'devor yopilgach topib bo'lmaydi').",
  "OXIR: oxirgi gap xulosa + bitta savol ('Sizning uyingizda qanday?') -- izoh yozishga undaydi.",
];
export const BUYRUQ_MATN = 'DOIMIY BUYRUQLAR (har videoda bajariladi):\n' + BUYRUQLAR.map((x, i) => `${i + 1}) ${x}`).join('\n') + '\n';
