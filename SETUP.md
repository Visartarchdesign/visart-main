# Visart Design — yangilanishlar bo'yicha qo'llanma

## Nima o'zgardi

1. **Narxlar bo'limi (#pricing)** — interaktiv kalkulyator qo'shildi: xizmat turi, maydon (m²),
   uslub/daraja va qo'shimcha xizmatlarga qarab taxminiy narxni real vaqtda hisoblaydi.
   ⚠️ **Muhim:** `index.html` faylida `CALC_SERVICES`, `CALC_STYLES`, `CALC_ADDONS` obyektlaridagi
   raqamlar — boshlang'ich taxminiy stavkalar. Ularni haqiqiy narxlaringizga moslab tahrirlang
   (fayl ichida qidiring: "NARX KALKULYATORI").

2. **Bog'lanish formasi endi ishlaydi.** Ilgari forma hech qayerga ma'lumot yubormas edi.
   Endi u `/api/contact` ga so'rov yuboradi, u esa Telegram botga xabar jo'natadi.
   Ishga tushirish uchun quyidagi bosqichlarni bajaring:
   - Telegram'da **@BotFather** ga yozing → `/newbot` → bot nomini tanlang → sizga TOKEN beriladi.
   - Botga birinchi xabarni yuboring (yoki uni kerakli guruhga qo'shing).
   - `https://api.telegram.org/bot<TOKEN>/getUpdates` manzilini brauzerda oching — javobda
     `chat.id` ni topasiz (guruh bo'lsa manfiy raqam bo'lishi mumkin).
   - Cloudflare Pages loyihangizda: **Settings → Environment variables** bo'limiga o'ting va
     qo'shing: `TELEGRAM_BOT_TOKEN` va `TELEGRAM_CHAT_ID` (Production va Preview uchun).
   - Loyihani qayta deploy qiling — forma darhol ishga tushadi.
   - Kod: `functions/api/contact.js` (Cloudflare Pages Function).

3. **Rasmlar optimallashtirildi** — jami hajm 26.8 MB → 5.4 MB (~80% kamaydi), bu sayt tezligini
   sezilarli yaxshilaydi (ayniqsa mobil internetda).

4. **SEO tuzatildi:**
   - `sitemap.xml` va `robots.txt` qo'shildi (ildiz papkada).
   - `HomeAndConstructionBusiness` turidagi Schema.org (JSON-LD) qo'shildi — Google local pack/rich snippet uchun.
   - `<link rel="canonical">` qo'shildi.
   - Sarlavha (`<title>`) va OG teglar bir xil brend nomiga keltirildi: "VISART ARCHDESIGN".
   - Yetishmayotgan favicon fayllari (`favicon.ico`, `favicon-32.png`, `favicon-192.png`,
     `apple-touch-icon.png`) logotipdan yaratildi — ilgari bu fayllar umuman yo'q edi.
   - Dekorativ va portfolio rasmlariga tavsiflovchi `alt` matnlari qo'shildi.

5. **Kichik tuzatishlar:**
   - Footer'dagi ishlamaydigan Instagram havolasi (`href="#"`) olib tashlandi — real profil
     havolasini bersangiz, bir necha soniyada qo'shib qo'yaman.
   - Sahifa ichidagi bo'limlarga to'g'ridan-to'g'ri havola (`#pricing`, `#projects` va h.k.)
     endi sahifa yuklanganda ishonchli ishlaydi (preloader tugagach avtomatik scroll qilinadi).
   - Mobil menyuga "Narxlar" bandi qo'shildi (ilgari yo'q edi).

## Joylashtirish (deploy)

Bu papka joriy GitHub repo (`visart-main`) bilan bir xil tuzilishga ega. Fayllarni repo'ga
almashtirib, commit va push qilsangiz, Cloudflare Pages avtomatik qayta deploy qiladi
(agar auto-deploy yoqilgan bo'lsa).

## Tekshirish (test qilingan)

Kalkulyator va forma logikasi avtomatlashtirilgan test orqali tekshirildi (jsdom muhitida):
narx hisob-kitobi to'g'ri, forma `/api/contact` ga to'g'ri ma'lumot yuboradi, til almashtirish
ishlaydi. Vizual (brauzerda qo'lda) tekshiruvni joylashtirilgandan keyin birga qilamiz.

## Yangi: Arxitektura-uslubidagi 2D scroll animatsiyasi

- Saytdagi mavjud "chizma" (blueprint) SVG dekoratsiyalari (Yondashuv, Xizmatlar, Portfolio,
  Bog'lanish bo'limlarida) endi foydalanuvchi shu bo'limga scroll qilib kelganda **o'zi
  chizilib chiqadi** (texnik chizma effekti) — WebGL yoki qo'shimcha kutubxonasiz, sof SVG+CSS,
  fayl og'irligi deyarli oshmadi.
- Sahifaning chap tomonida ingichka **o'lchov chizig'i (rail)** qo'shildi — scroll qilgan sari
  oltin rang bilan to'lib boradi, bu ham arxitektura chizmalariga xos "dimension line" uslubida.
  Faqat kengroq ekranlarda (desktop, ≥1201px) ko'rinadi, mobilda soddaligicha qoladi.
- Ikkalasi ham 2D, yengil (bir necha KB JS/CSS), sahifa tezligiga sezilarli ta'sir qilmaydi.

## Yangi: "Yurib kirish" 3D effekti va chizmada yuruvchi nuqta

- Asosiy bo'lim sarlavhalari (Arxitektura, Biz haqimizda, Bog'lanish, Narxlar) endi scroll qilib
  kelganda **chuqurlikdan yurib kirgandek** 3D burchak bilan paydo bo'ladi (CSS perspective,
  WebGL emas) — videodagi "bir joydan boshqasiga yurib o'tish" hissini beradi, lekin yengil va tez.
- Xizmatlar, Portfolio va Bog'lanish bo'limlaridagi chizma (blueprint) rasmlarida endi kichik
  **oltin nuqta xona rejasi bo'ylab asta yurib** aylanadi — texnik chizmadagi "yurish yo'li"
  effekti, bo'lim ko'rinishga kirgach avtomatik boshlanadi.
- Mobil qurilmalarda ortiqcha yuk bo'lmasligi uchun bu ikkala effekt ham soddalashtirilgan/o'chirilgan.

Eslatma: bu o'zgarishlarni jonli brauzerda tekshirib chiqishni tavsiya qilaman — men hozircha
faqat kod darajasida (struktura, sintaksis, funksional test) tekshira oldim, chunki ishlayotgan
muhitimda haqiqiy brauzer yo'q.

## Yangi: Kinematik "flythrough" o'tish (portfolio filtri va loyiha ochish)

- **Filtr tugmalari** (Barchasi / Interyer / Arxitektura / Chizmalar) bosilganda endi to'liq ekran
  qisqa (~0.8s) "kamera harakati" effekti ishga tushadi: tegishli rasm tez zoom bo'lib, xiralashadi,
  ustida "Interyerga kiramiz" / "Fasadga chiqamiz" kabi matn chiqadi — so'ng filtrlangan portfolio
  ko'rinadi. Bu videodagi "bir joydan boshqasiga yurib o'tish" hissini beradi.
- **Loyiha kartochkasi bosilganda** ham xuddi shu flythrough effekti ishlaydi — o'sha loyihaning
  o'z surati bilan, so'ng loyiha oynasi (modal) ochiladi.
- Bularning barchasi mavjud fotolar bilan CSS transform (scale/blur) orqali qilingan — yangi 3D
  fayl yoki WebGL kerak emas, sahifa og'irligiga deyarli ta'sir qilmaydi.
- **Haqiqiy 360° virtual tur** (video namunasidagi kabi haqiqiy 3D fazoda yurish) uchun
  obyektlaringizni 360° kamerada suratga olish kerak — buni alohida bosqichda muhokama qilamiz.

## Keyingi bosqich: Admin panel

Kelishuvimizga ko'ra, sayt joylashtirilib yakunlangach, keyingi bosqichda quyidagilarni
o'z ichiga olgan **to'liq admin panel** qurishni boshlaymiz:
- Login/parol bilan himoyalangan boshqaruv paneli.
- Portfolio: yangi loyiha qo'shish/o'chirish, rasm yuklash, tavsif tahrirlash.
- Narxlar kalkulyatoridagi stavkalarni o'zgartirish.
- Mijozlar sharhlarini qo'shish/o'chirish.
- Kelgan arizalar ro'yxati (Telegram'dan tashqari, saytning o'zida ham).

Bu alohida backend (baza + autentifikatsiya + fayl xotira) talab qiladi — hozirgi statik sayt
tuzilishidan farqli infratuzilma bo'ladi. Sayt joylashtirilib, joriy funksiyalar tasdiqlangach
buni birga rejalashtiramiz.

## Yangi: Portfolio bo'limi soddalashtirildi

- Ilgari har bir loyiha butun ekranni egallagan, qisman kesilgan holda ko'rinardi va "bosish
  kerakligi" aniq emasdi. Endi portfolio **aniq kartochkalar to'ri (grid)** ko'rinishida —
  har bir kartochkada to'liq nomi, turi va ko'zga aniq tashlanadigan **"Ko'rish →" tugmasi** bor.
- Desktop'da 3 ustunli, planshetda 2 ustunli, telefonda 1 ustunli — har doim to'liq va aniq ko'rinadi.
- Kartochkaga bosish/Enter bosish orqali ochiladi (klaviatura orqali ham foydalanish mumkin).

---

# ADMIN PANEL — o'rnatish qo'llanmasi

Endi saytda to'liq boshqaruv paneli bor: `/admin` sahifasi orqali portfolio, narxlar,
mijozlar sharhlari va kontakt ma'lumotlarini o'zingiz — kod yozmasdan — boshqarasiz,
jumladan rasm yuklash/o'chirish.

## Kirish ma'lumotlari (o'zim generatsiya qildim)

```
Login:  visart_admin
Parol:  CHhy6dEaU3KFLL3Ar2
```

**Muhim:** birinchi kirishdan so'ng, Cloudflare Pages sozlamalarida (pastda tushuntirilgan)
shu parolni o'zingiznikiga almashtiring.

## 1-qadam — D1 ma'lumotlar bazasini yaratish

1. Cloudflare dashboard → **Workers & Pages** → **D1** → **Create database**.
2. Nomi: `visart_db` (yoki xohlagan nom).
3. Yaratilgach, **Console** bo'limiga o'ting va `db/schema.sql` faylining butun matnini
   nusxalab, u yerga joylashtirib ishga tushiring (jadvallar va boshlang'ich ma'lumotlarni yaratadi).
4. Sayt loyihasiga qaytib: **Pages loyihangiz → Settings → Functions → D1 database bindings**
   → **Add binding**: Variable name = `DB`, Database = yuqorida yaratgan `visart_db`.

## 2-qadam — R2 (rasm xotirasi) yaratish

1. Cloudflare dashboard → **R2** → **Create bucket**, nomi: `visart-uploads`.
2. Bucket → **Settings** → **Public access** → yoqing (r2.dev domenini oling), YOKI
   o'z domeningizni ulang. Public URL'ni nusxalang.
3. Pages loyihangiz → **Settings → Functions → R2 bucket bindings** → **Add binding**:
   Variable name = `UPLOADS`, Bucket = `visart-uploads`.
4. Agar public domen sozlagan bo'lsangiz, **Environment variables**'ga qo'shing:
   `R2_PUBLIC_BASE` = shu public URL (masalan `https://pub-xxxx.r2.dev`).
   (Agar bu qadamni o'tkazib yuborsangiz ham, rasmlar `/r2/...` orqali saytning
   o'zi orqali ko'rsatiladi — ishlayveradi, faqat biroz sekinroq bo'lishi mumkin.)

## 3-qadam — Login va sessiya sozlamalari

Pages loyihangiz → **Settings → Environment variables**'ga qo'shing (Production va Preview):

```
ADMIN_USERNAME = visart_admin
ADMIN_PASSWORD = CHhy6dEaU3KFLL3Ar2     (buni o'zingizniki bilan almashtiring)
SESSION_SECRET = 8d08d9fe6360a8ca71d15877659716a2de3fb41e50d6e86a1e34bba6f7e6045f
```

`SESSION_SECRET` — bu tasodifiy, hech kimga aytmang; uni ham boshqa qiymatga
almashtirishni istasangiz, istalgan uzun tasodifiy matn bo'lishi mumkin.

Bularni Telegram bot sozlamalari (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) bilan
BIRGA qo'shing — ular ham hali kerak (yuqorida tushuntirilgan).

## 4-qadam — qayta joylashtirish

Barcha bindinglar va o'zgaruvchilarni qo'shgach, loyihani qayta deploy qiling.
Shundan so'ng: `https://visartdesign.uz/admin` manzilига kirib, yuqoridagi login
bilan tizimga kirasiz.

## Qanday ishlaydi

- Asosiy sayt endi ochilganda avtomatik `/api/content` dan ma'lumot olishga harakat
  qiladi. Agar admin panel hali sozlanmagan bo'lsa (D1/R2 ulanmagan) — **sayt hech
  qanday xatoliksiz, oldingi standart ma'lumotlar bilan ishlashda davom etadi**.
  Ya'ni bu bosqichni istalgan vaqt, shoshilmasdan sozlashingiz mumkin.
- Admin panelda o'zgartirish kiritib "Saqlash" bosganingizdan so'ng, o'zgarish
  saytda darhol (sahifani yangilagach) ko'rinadi — qayta deploy qilish shart emas.
- Rasm yuklashda: JPG/PNG/WebP/GIF qo'llab-quvvatlanadi, hajm chekланмаган lekin
  tezlik uchun 2-3 MB dan kichik rasm yuklashni tavsiya qilaman.

## Xavfsizlik eslatmasi

`/admin` sahifasi qidiruv tizimlaridan yashirilgan (`robots.txt`), lekin havolani
hech kimga tarqatmang va parolni ishonchli joyda saqlang. Agar parol oshkor bo'lib
qolgan deb hisoblasangiz, `ADMIN_PASSWORD` o'zgaruvchisini Cloudflare'da yangilab,
qayta deploy qilishning o'zi yetarli.
