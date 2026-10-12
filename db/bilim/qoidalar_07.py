B='O.A.Mamajonova, "Bino arxitekturasi" (darslik, Andijon 2026) — ShNK 2.08.01-05 jadvallari'
B2='O.A.Mamajonova, "Bino arxitekturasi" (2026), zina va tom bo\'limlari'
X='xonadon'
# Kitobda tilga olingan amaldagi me'yoriy hujjatlar (to'liq matni hali bazada YO'Q; foydalanuvchidan so'raladi):
MANBA=[
('ShNQ 2.08.01-19','Turar joy binolari','shnq','2019','kitob (Bino arxitekturasi) ro\'yxatidan; to\'liq matn kerak'),
('ShNQ 2.08.02-23','Jamoat binolari va inshootlari','shnq','2023','to\'liq matn kerak'),
('ShNQ 2.07.02-22','Qurilish obyektlarini nogironligi bo\'lgan shaxslar uchun moslashtirish','shnq','2022','pandus, eshik kengligi va h.k. -- to\'liq matn kerak'),
('ShNQ 2.07.01-23','Aholi punktlari hududlarini rivojlantirish va qurish','shnq','2023','to\'liq matn kerak'),
('QMQ 2.01.04-18','Qurilish issiqlik texnikasi','qmq','2018','to\'liq matn kerak'),
('QMQ 2.01.03-96','Zilzilaviy hududlarda qurilish','qmq','1996','to\'liq matn kerak'),
('QMQ 2.01.01-94','Loyihalash uchun iqlimiy va fizik-geologik ma\'lumotlar','qmq','1994','ma\'ruzada tilga olingan'),
('QMQ 2.08.01-94','Turar-joy binolari (eski)','qmq','1994','ma\'ruzada tilga olingan; ShNQ 2.08.01-19 bilan almashgan bo\'lishi mumkin'),
]
R=[
(B,'4.1-jadval','arxitektura',X,'1-xonali (1 kishi)','xonadon_maydoni_yozgi_xonasiz','between',28,30,'m2','tavsiya','yashash maydoni 14-16 m2; ShNK 2.08.01-05 (oddiy sinf)'),
(B,'4.1-jadval','arxitektura',X,'1-xonali (2 kishi)','xonadon_maydoni_yozgi_xonasiz','between',32,36,'m2','tavsiya','yashash maydoni 18-20 m2'),
(B,'4.1-jadval','arxitektura',X,'2-xonali (3 kishi)','xonadon_maydoni_yozgi_xonasiz','=',48,48,'m2','tavsiya','yashash maydoni 30 m2'),
(B,'4.1-jadval','arxitektura',X,'3-xonali (4 kishi)','xonadon_maydoni_yozgi_xonasiz','=',64,64,'m2','tavsiya','yashash maydoni 40 m2'),
(B,'4.1-jadval','arxitektura',X,'4-xonali (5 kishi)','xonadon_maydoni_yozgi_xonasiz','=',80,80,'m2','tavsiya','yashash maydoni 56 m2'),
(B,'4.1-jadval','arxitektura',X,'5-xonali (6 kishi)','xonadon_maydoni_yozgi_xonasiz','=',96,96,'m2','tavsiya','yashash maydoni 66 m2'),
(B,'4.1-jadval','arxitektura',X,'6-xonali (7-8 kishi)','xonadon_maydoni_yozgi_xonasiz','=',114,114,'m2','tavsiya','yashash maydoni 78 m2'),
(B,'xonadon sinfi','arxitektura',X,'yaxshilangan sinf','umumiy_maydon_1_kishiga','>=',23,None,'m2','tavsiya','har bir a\'zoga alohida xona'),
(B,'xonadon sinfi','arxitektura',X,'yuqori sinf','umumiy_maydon_1_kishiga','>=',30,None,'m2','tavsiya',None),
(B,'sanitariya-gigiena','arxitektura',X,'yashash xonasi','yashash_maydoni_1_kishiga','>=',9,None,'m2','xato','istiqbolda 12-15 m2 tavsiya'),
(B,'sanitariya-gigiena','arxitektura',X,'yashash xonasi','xona_havo_hajmi_1_kishiga','>=',25,None,'m3','xato',None),
(B,'sanitariya-gigiena','arxitektura',X,'xona va yordamchi xonalar','xona_balandligi_janubiy_iqlim','>=',2.7,None,'m','xato',None),
(B,'xona maydoni','arxitektura',X,'xona (1 kishilik)','xona_maydoni','>=',14,None,'m2','tavsiya','matn: bir kishilik >=14 m2, ikki kishilik >=18 m2 -- tasdiqlang'),
(B,'xona maydoni','arxitektura',X,'xona (2 kishilik)','xona_maydoni','>=',18,None,'m2','tavsiya',None),
(B2,'zina','arxitektura','turar-joy','zinaxona','marsh_eni_2_qavatli','>=',900,None,'mm','xato',None),
(B2,'zina','arxitektura','turar-joy','zinaxona','marsh_eni_3_va_undan_koproq_qavat','>=',1050,None,'mm','xato',None),
(B2,'zina','arxitektura','turar-joy','zinaxona','zina_maydoncha_eni','>=',1200,None,'mm','tavsiya','marsh enidan kam bolmasin'),
(B2,'zina','arxitektura','turar-joy','zinaxona','pogona_eni_va_balandligi_tipik','=',300,300,'mm (eni) / 150 mm (balandligi)','tavsiya','2h+b ~ 450 mm'),
(B2,'tom','arxitektura','umumiy','tom','bogot_devordan_chiqishi','>=',550,None,'mm','xato','tashqi (yomgir suvi) drenajli tomlarda'),
(B2,'tom','arxitektura','umumiy','tom','metall_himoya_panjarasi_balandligi','>=',0.6,None,'m','xato','binoning balandligi >10 m va nishab katta bo\'lganda'),
(B2,'seysmika','arxitektura','g\'isht devorli bino','umumiy','yuk_kotaruvchi_gisht_devor_balandligi_7_ball','<=',None,6,'m','xato',None),
(B2,'seysmika','arxitektura','g\'isht devorli bino','umumiy','yuk_kotaruvchi_gisht_devor_balandligi_8_ball','<=',None,5,'m','xato',None),
(B2,'seysmika','arxitektura','g\'isht devorli bino','umumiy','yuk_kotaruvchi_gisht_devor_balandligi_9_ball','<=',None,4,'m','xato',None),
(B2,'seysmika','arxitektura','umumiy','umumiy','antiseysmik_kamar_balandligi_tipik','>=',150,None,'mm','tavsiya','kamar eni odatda devor qalinligiga teng'),
]
