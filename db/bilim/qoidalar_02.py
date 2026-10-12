M8='8-mavzu: Balkonlar, lodjiyalar va erkerlar'
M10='10-mavzu: Pollar. Pol qoplamalarini qurish'
X='xonadon'
R=[
(M8,'balkon','arxitektura',X,'balkon','tashqi_devor_qalinligi_balkon_plita_qistirish','>=',0.25,0.30,'m','tavsiya','devor 25-30 sm dan yupqa bo\'lsa plita alohida ustunlarga o\'rnatiladi'),
(M8,'lodjiya','arxitektura',X,'lodjiya','lodjiya_tosiq_balandligi','=',1.0,1.0,'m','xato','1 m balandlikdagi to\'siq'),
(M8,'balkon','arxitektura',X,'balkon','gidroizolyatsiya_qatlami','bor',None,None,None,'xato','plita ustida gidroizolyatsiya + sement-qum tekislovchi qatlam'),
(M10,'pol harorati','arxitektura',X,'umumiy','xona_havosi_va_pol_sirti_harorat_farqi','<=',None,2,'°C','xato',None),
(M10,'pol materiali','arxitektura',X,'yashash xonasi','pol_sirti_issiqlik_ozlashtirish_koeffitsienti','<=',None,12,'Vt/m2·°C','xato','shuning uchun yashash xonalarida taxta/parket/DSP'),
(M10,'taxta pol','arxitektura',X,'umumiy','taxta_qalinligi','=',29,29,'mm','tavsiya','shpuntlangan randalangan, eni 100-120 mm'),
(M10,'taxta pol','arxitektura',X,'umumiy','taxta_eni','between',100,120,'mm','tavsiya',None),
(M10,'taxta pol','arxitektura',X,'umumiy','taxta_namligi','between',10,12,'%','xato','aks holda pol qiyshayadi'),
(M10,'taxta pol','arxitektura',X,'umumiy','laga_oraligi','between',500,600,'mm','tavsiya','yog\'och bruslardan'),
(M10,'taxta pol','arxitektura',X,'umumiy','gruntdagi_laga_ustunchalari_oraligi','between',800,1000,'mm','tavsiya',None),
(M10,'tovush izolyatsiyasi','arxitektura',X,'umumiy','qavatlararo_yopma_ustiga_qum_shlak_qatlami','between',50,60,'mm','tavsiya','havo shovqinidan'),
(M10,'linoleum','arxitektura',X,'umumiy','asossiz_linoleum_tovush_izolyatsiyasi_qatlami','bor',None,None,None,'xato','asosli linoleumda shart emas'),
]
