# Visart agent kompaniyasi -- bilim xaritasi (2026-10-25)

## Agentlar va ularning bilim manbasi
| Agent | Vazifa | Bilim / kod |
|---|---|---|
| Arxitektor | plan, ShNQ/KMQ tekshiruvi | `db/bilim/qoidalar_01..09.py` (179 qoida), `Visart_AI_Studio\Arxitektor\check_compliance.py`, `shnq_rules.json`; admin panelda tasdiqlash |
| Interyer/3D quruvchi | AutoCAD plan -> 3ds Max sahna | `bilim\dizayn_qoidalari.json` (shift, eshik, mebel o'lchamlari), `xona_spetsifikatsiya.md`, `qa_kamchiliklar.json` (Q1-Q10), `kadr_qoidalari.json` (kamera) |
| Ko'prik (AutoCAD/Max) | `visart_mcp` (autocad_*, max_*), orqaga nusxa har buyruqdan oldin | `Visart_AI_Studio\visart_mcp` |
| Kutubxona | 1000+ Max model, blok kodlari | `Visart_Template_v1.dxf`, `library.csv`, `E:\3DMAX` |
| Senarist/Montajchi/SMM | Reels, jadval | `media-server\*`, `docs/kontent-strategist.md`, `senariyQoida.js`, `strategist.js` |
| Loyiha hujjatlari (ekspertiza) | MyGov rad sabablarini oldindan topish | quyidagi "Ekspertiza tekshiruvi" |

## Kitoblardan olingan (bilim_bazasi\matn, 68 fayl, ~5 MB)
Kodlangan: sanitar-gigiena, yong'in, zina, deraza/eshik, balkon, pol, interyer o'lchamlari, santexnika, ergonomika, ShNQ 2.08.01 maydonlar, seysmika, iqlim, KNAUF.
Asosan sifatiy (sonli qoida kam): Materiallar darsligi (2 MB), Interyerni loyihalash, Interyer va jihozlash, Zamonaviy jihozlash, Sharqona uslub, Bino interyerini grafik dasturlarda loyihalash. Ulardan qo'shimcha olingan sonlar: oshxona eni >=2,4 m, oshxona-yemakxona >=8 m2, dahliz eni >=130 sm, bir kishilik yotoqxona kengligi >=2,2 m, stol usti ish balandligi 85 sm, perspektivada ufq chizig'i ~1,7 m, kamera 45 daraja (hammasi tasdiqlanmagan).

## Hali yo'q (Dostondan kutiladi)
- Qo'lyozmalar -> `Visart_AI_Studio\bilim\kirish\` (protokol: `QABUL_PROTOKOLI.md`; qo'lyozma standartdan ustun).
- ShNQ 2.08.01-19, 2.08.02-23, 2.07.02-22, KMQ 2.01.04-18, 2.01.03-96 to'liq matni.
- Ishchi chizma (rabochka) varaq tarkibi: 3-5 tugallangan komplekt (D:\1_WORK dan).
- Material narxlari (UZS), yetkazuvchilar.

## ChatGPT arxividan (2026-10-25 o'qildi; ahamiyatli qismlari)
- Chizma nomlari (rus): "План перекрытия над подвалом", "План перекрытия 1 этажа" (1-2 etaj orasi), kesimda "Перекрытие на отм. ±0.000"; konstruktiv yopma markasi PK/PB.
- Ekspertiza tekshiruvi (MyGov rad javoblaridan): (1) loyiha nomi arizadagi tur bilan mos (yangi qurilish != "qurish va rekonstruksiya"); (2) hajm 300 m3 chegarasiga yaqin (289 m3) bo'lsa devor qalinligi/parapet/tom bilan qayta hisob; (3) rekonstruksiyada texnik xulosa kuchaytirishni talab qilsa AR albomiga KR/KJ, kuchaytirish tugunlari (setka O6/150x150, M100, ~35 mm), poydevor tekshiruvi va geologiya kiritilishi shart; (4) titul varaqda obyekt holati (yangi/rekonstruksiya) to'g'ri yozilsin; (5) so'rovnomadagi obyekt turi, maydon, qavat, kadastr, buyurtmachi ma'lumotlari hujjatlar bilan bir xil.
- Pol styajkasi: ertasi kuni mayin namlash, kuniga 2-3 (issiqda 3-4) marta, kamida 5-7 kun, quyosh/shamoldan himoya; qoplama yotqizishdan oldin ichki namlik pasayishi kerak (manba: ChatGPT, ShNQ bilan tasdiqlash kerak).
- 3ds Max 2022 "Merge" ko'rinmasa: fayl yangiroq versiyada saqlangan bo'lishi (Open bilan tekshir), File -> Import -> Merge, UI sxemasi (Customize -> Load Custom UI Scheme -> DefaultUI), dialog ekrandan tashqarida (Alt+Space, M).
- PC: i5-11400F, GTX 1660 SUPER 6 GB, 16 GB RAM, 477 GB SSD, Win11 Pro. Lumion 12.5 optimal; 2024+ og'ir. Corona/Max uchun RAM 32 GB va RTX 4060+ yaxshilash maslahati.
- Gemini/Claude uchun umumiy "professional ekspert" instruksiyasi: fakt o'ylab topmaslik, tanqidiy ko'rib chiqish, bitta eng yaxshi yechim, tokenni tejash (bizning foydalanuvchi preferensiyasi bilan mos).

## Ish tartibi (o'zgarmas)
Doston plan va mebel joylashtiradi -> agent faqat blok nomlarini to'g'rilaydi (mebelni surmaydi) -> Max (bitta fayl ochiq) -> QA Q1-Q10 -> preview -> final -> ishchi chizma. Qoidalar o'zgargach faqat JSON/DB yangilanadi, builder qattiq kodsiz.

## DWG zaxira va namuna (2026-10-25)
- Zaxira: `Visart_AI_Studio\zaxira_dwg\{D,E1,ER}\...` (437 DWG, ~608 MB; manba o'zgarmaydi). Skript: `portfolio\zaxira_dwg.py`.
- Namuna indeksi: `portfolio\portfolio_katalog.json` (loyiha -> dwg/render/max/pdf/video). Agentlar yangi loyihada planlar, mebel joylashuvi, qatlamlar va renderlarni shu yerdan namuna qilib oladi (nusxalamaydi).
- Qatlam lug'ati: `bilim\autocad_qatlamlar.json`.
- Navbat: smeta agenti (narxlar kerak), rabochka generatori, QA.
