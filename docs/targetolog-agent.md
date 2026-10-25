# Targetolog/marketolog agent (2026-10-25)
Boshqaruv: Telegram bot, `/target` (faqat adminlar).

## Oqim
1. `/target` -> **Yangi taklif**: Claude `targetBilim.js` + oldingi natijalar + Instagram'dagi eng yaxshi organik postlar asosida taklif tuzadi (auditoriya, matn, 3 ta byudjet varianti, kutilgan natija, xavflar, o'z-o'ziga tanqid).
2. Siz byudjet variantini bosasiz -> Meta'da kampaniya **PAUSED** yaratiladi (pul ketmaydi).
3. **Yoqish** tugmasi -> ACTIVE. Faqat shundan keyin sarf boshlanadi.
4. Har 15 daqiqada xavfsizlik: kunlik sarf limitdan 30% oshsa avtomatik PAUZA. Har kuni 09:00 tanqidiy hisobot (raqamlar + Claude tahlili). Byudjetni o'zi hech qachon oshirmaydi.
5. **Reklama videosi** tugmasi -> senarist (`/reel-senariy`) -> montajchi, tayyor video kreativga.

## Sozlash (Cloudflare Pages env)
- `META_AD_ACCOUNT_ID` (raqam), `META_ADS_TOKEN` (ads_management; yo'q bo'lsa INSTAGRAM_ACCESS_TOKEN ishlatiladi, lekin unda shu ruxsat bo'lishi shart), `FACEBOOK_PAGE_ID`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`, `ANTHROPIC_API_KEY`.
- Ixtiyoriy: `TARGET_MAKS_KUNLIK` (USD, standart 30), `TARGET_LINK` (standart `https://t.me/visart_design_bot?start=reklama`).
- Hisob valyutasi USD bo'lishi kerak (boshqasida yaratish bloklanadi).

## Hali tasdiqlanmagan
- Meta API chaqiruvlari (kampaniya/adset/kreativ) jonli sinalmagan; xato bo'lsa botga Meta xabari keladi, pul sarflanmaydi.
- Lidlar reklamadan ajratilmagan (botdagi barcha yangi lidlar sanaladi). O'zbekiston narx oraliqlari taxminiy -- 1-2 hafta natijasidan keyin yangilanadi.

## Bo'limlar paneli (`/admin`)
`functions/_lib/bolimlar.js`: Kontent, Target, Mijozlar, Ishlab chiqarish (AutoCAD/3ds Max -- keyingi bosqich), Tizim. Bosh ekran jonli holat ko'rsatadi (navbat, faol kampaniya, bugungi lid, media-server 🟢/🔴). Yangi bo'lim: `BOLIMLAR` va `IZOH` ga yozuv + `bosh` ekraniga qator. Eski panel: Tizim -> "Eski panel".
