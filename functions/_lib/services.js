// Xizmat sahifalari: /xizmatlar/:slug (UZ) va /ru/uslugi/:slug (RU).
// Matnlar shu faylda, narx va muddatlar esa admin paneldagi "Narxlar" (pricing_json) dan olinadi.

const BASE = 'https://visartdesign.uz';

export const SERVICES = [
  {
    id: 'interior',
    slug: { uz: 'interyer-dizayn', ru: 'dizajn-interera' },
    cat: ['interior'],
    hero: '/assets/int-02.webp',
    uz: {
      name: 'Interyer dizayn',
      title: 'Interyer dizayn Toshkentda — kvartira va uy | Visart Design',
      desc: "Kvartira, xususiy uy va ofis uchun interyer dizayn: planirovka, 3D vizualizatsiya, ishchi chizmalar va materiallar tanlovi. Toshkent. Bepul konsultatsiya.",
      h1: 'Interyer dizayn Toshkentda',
      lead: "Kvartira, xususiy uy yoki ofis uchun to'liq dizayn-loyiha: qulay planirovkadan tortib ustalar uchun aniq ishchi chizmalargacha.",
      intro: [
        "Yaxshi interyer chiroyli ko'rinish bilangina cheklanmaydi. U har kuni qulay yashash, yetarli saqlash joyi va to'g'ri yoritish demakdir. Biz avval oilangiz yoki jamoangiz qanday yashashi va ishlashini o'rganamiz, so'ng makonni shu ehtiyojlarga moslab loyihalaymiz.",
        "Premium va Lyuks paketlarida loyiha 3D vizualizatsiya bilan tayyorlanadi, shuning uchun natijani ta'mir boshlanishidan oldin ko'rasiz. Standart paket chizmalar (planirovka, ishchi chizmalar, elektrika va santexnika) bilan cheklanadi. Ishchi chizmalar ustalar uchun tushunarli bo'ladi: elektrika, santexnika va rejalar bir-biriga mos holda chiziladi.",
      ],
      includes: [
        "Obyektni o'lchash va texnik topshiriqni tuzish",
        'Planirovka va zonalashtirish variantlari',
        "Uslub konsepsiyasi, ranglar va materiallar tanlovi",
        'Ishchi chizmalar: elektrika, santexnika, rejani o\'zgartirish (barcha paketlarda)',
        'Har bir xona uchun 3D vizualizatsiya (Premium va Lyuks paketlarida)',
        'Mebel joylashuvi va saqlash tizimlari (Premium va Lyuks paketlarida)',
        "Smeta va materiallar xaridida yordam (Lyuks paketida)",
      ],
      steps: [
        ["Tanishuv va o'lchov", "Obyektni ko'ramiz, ehtiyoj va byudjetni aniqlaymiz."],
        ['Planirovka', "Zonalar va mebel joylashuvining 1–2 variantini taklif qilamiz."],
        ['Konsepsiya va 3D', "Premium va Lyuksda uslub, ranglar va materiallarni 3D ko'rinishda tasdiqlaymiz."],
        ['Ishchi chizmalar', "Ustalar uchun to'liq chizmalar to'plamini tayyorlaymiz."],
        ['Topshirish', "Loyihani topshiramiz va savollarga javob beramiz."],
      ],
      faq: [
        ['Interyer dizayn narxi qanday hisoblanadi?', "Narx obyekt maydoni (m²) va tanlangan paketga qarab hisoblanadi. Saytdagi kalkulyatorda taxminiy summani darhol ko'rishingiz mumkin, aniq narxni bepul konsultatsiyada aytamiz."],
        ['Dizayn-loyiha qancha vaqtda tayyor bo\'ladi?', "Paket va maydonga qarab odatda 10 kundan 35 kungacha. Aniq muddat shartnomada belgilanadi."],
        ["Loyihaga o'zgartirish kiritish mumkinmi?", "Ha. Planirovka va konsepsiya bosqichlarida takliflaringiz asosida tuzatishlar kiritamiz."],
        ['Toshkentdan tashqaridagi obyektlar bilan ishlaysizmi?', "Asosan Toshkent va Toshkent viloyatida ishlaymiz. Boshqa hududlar bo'yicha kelishilgan holda masofadan ishlash mumkin."],
      ],
    },
    ru: {
      name: 'Дизайн интерьера',
      title: 'Дизайн интерьера в Ташкенте — квартиры и дома | Visart Design',
      desc: 'Дизайн интерьера квартир, частных домов и офисов в Ташкенте: планировка, 3D-визуализация, рабочие чертежи, подбор материалов. Бесплатная консультация.',
      h1: 'Дизайн интерьера в Ташкенте',
      lead: 'Полный дизайн-проект квартиры, частного дома или офиса — от удобной планировки до точных рабочих чертежей для мастеров.',
      intro: [
        'Хороший интерьер — это не только красота, но и удобство каждый день: достаточно мест хранения, продуманный свет и логичное зонирование. Сначала мы изучаем, как живёт ваша семья или работает команда, а затем проектируем пространство под эти задачи.',
        'В пакетах «Премиум» и «Люкс» проект сопровождается 3D-визуализацией, поэтому вы видите результат ещё до начала ремонта. Пакет «Стандарт» включает чертежи: планировку, рабочие чертежи, электрику и сантехнику. Рабочие чертежи понятны строителям: электрика, сантехника и планы согласованы между собой.',
      ],
      includes: [
        'Обмер объекта и составление технического задания',
        'Варианты планировки и зонирования',
        'Стилевая концепция, подбор цветов и материалов',
        'Рабочие чертежи: электрика, сантехника, перепланировка (во всех пакетах)',
        '3D-визуализация каждого помещения (в пакетах «Премиум» и «Люкс»)',
        'Расстановка мебели и системы хранения (в пакетах «Премиум» и «Люкс»)',
        'Смета и помощь в закупке материалов (в пакете «Люкс»)',
      ],
      steps: [
        ['Знакомство и обмер', 'Осматриваем объект, определяем задачи и бюджет.'],
        ['Планировка', 'Предлагаем 1–2 варианта зонирования и расстановки мебели.'],
        ['Концепция и 3D', 'В «Премиум» и «Люкс» утверждаем стиль, цвета и материалы в 3D.'],
        ['Рабочие чертежи', 'Готовим полный комплект чертежей для мастеров.'],
        ['Сдача проекта', 'Передаём проект и отвечаем на вопросы.'],
      ],
      faq: [
        ['Как рассчитывается стоимость дизайна интерьера?', 'Стоимость зависит от площади (м²) и выбранного пакета. Примерную сумму можно сразу увидеть в калькуляторе на сайте, точную цену назовём на бесплатной консультации.'],
        ['Сколько времени занимает дизайн-проект?', 'В зависимости от пакета и площади — обычно от 10 до 35 дней. Точный срок фиксируется в договоре.'],
        ['Можно ли вносить изменения в проект?', 'Да. На этапах планировки и концепции вносим правки по вашим пожеланиям.'],
        ['Работаете ли вы за пределами Ташкента?', 'В основном работаем в Ташкенте и Ташкентской области. Для других регионов возможна удалённая работа по договорённости.'],
      ],
    },
  },
  {
    id: 'arch',
    slug: { uz: 'arxitektura-loyihalash', ru: 'arhitekturnoe-proektirovanie' },
    cat: ['architecture'],
    hero: '/assets/arch-01.webp',
    uz: {
      name: 'Arxitektura loyihalash',
      title: 'Arxitektura loyihalash Toshkentda — uy loyihasi | Visart Design',
      desc: "Xususiy uy, kottej va noturar binolar loyihasi: eskiz, planirovka, fasad, 3D vizualizatsiya va ishchi chizmalar. Toshkent. Bepul konsultatsiya.",
      h1: 'Arxitektura loyihalash Toshkentda',
      lead: "Xususiy uy, kottej yoki tijorat binosi loyihasi — yer uchastkasi tahlilidan tortib qurilish uchun chizmalargacha.",
      intro: [
        "Uy loyihasi yer uchastkasi, quyosh tomoni, kirish yo'li va oilaning turmush tarziga qarab tuziladi. Biz xonalar joylashuvini mantiqiy qilib, qurilish va keyingi foydalanish xarajatlarini oldindan hisobga olamiz.",
        "Premium va Lyuks paketlarida fasad uslubi — zamonaviy yoki klassik — 3D vizualizatsiyada ko'rsatiladi. Barcha paketlarga asosiy va ustalar uchun ishchi chizmalar (fasad, plan, kesim) kiradi. Faqat ruxsatnoma hujjatlari alohida buyurtma qilinadi.",
      ],
      includes: [
        "Yer uchastkasi va talablarni tahlil qilish",
        "Eskiz va planirovka variantlari",
        'Fasad dizayni (zamonaviy yoki klassik)',
        "Tashqi ko'rinish 3D vizualizatsiyasi (Premium va Lyuks paketlarida)",
        "Asosiy chizmalar: fasadlar, rejalar, kesimlar (barcha paketlarda)",
        'Ustalar uchun ishchi chizmalar (barcha paketlarda)',
        "Landshaft dizayn konsepsiyasi (Lyuks paketida)",
        'Ruxsatnoma hujjatlari (alohida buyurtma qilinadi)',
      ],
      steps: [
        ["Tanishuv", "Uchastka, xonalar soni, qavatlar va byudjetni aniqlaymiz."],
        ['Eskiz', "Planirovka va hajmiy yechim variantlarini taklif qilamiz."],
        ['Fasad va 3D', "Tashqi ko'rinishni 3D'da tasdiqlaymiz."],
        ['Chizmalar', "Fasad, reja va kesimlarni tayyorlaymiz."],
        ['Hujjatlar', "Kerak bo'lsa ruxsatnoma uchun hujjatlarni rasmiylashtiramiz."],
      ],
      faq: [
        ['Uy loyihasi narxi qanday hisoblanadi?', "Narx yer maydoni (sotix), qavatlar soni va tanlangan paketga (Standart, Premium, Lyuks) qarab hisoblanadi. Narx turar joylar uchun 500 m² gacha, noturar binolar uchun 300 m² gacha amal qiladi; maydon oshsa, narx loyihaga qarab alohida belgilanadi. Kalkulyatorda taxminiy narxni ko'rishingiz mumkin."],
        ['Loyiha qancha vaqtda tayyorlanadi?', "Odatda 15–25 kun — uchastka va murakkablikka qarab."],
        ['Tayyor loyihani o\'zgartirib berasizmi?', "Ha, mavjud loyihani tahlil qilib, planirovka yoki fasadni qayta ishlab beramiz."],
        ['Ruxsatnoma olishda yordam berasizmi?', "Ha, qurilish uchun zarur loyiha hujjatlarini tayyorlab beramiz. Batafsil — «Loyiha hujjatlari» xizmatida."],
      ],
    },
    ru: {
      name: 'Архитектурное проектирование',
      title: 'Архитектурное проектирование в Ташкенте | Visart Design',
      desc: 'Проекты частных домов, коттеджей и нежилых зданий в Ташкенте: эскиз, планировка, фасад, 3D-визуализация и рабочие чертежи. Бесплатная консультация.',
      h1: 'Архитектурное проектирование в Ташкенте',
      lead: 'Проект частного дома, коттеджа или коммерческого здания — от анализа участка до чертежей для строительства.',
      intro: [
        'Проект дома создаётся с учётом участка, сторон света, подъезда и образа жизни семьи. Мы продумываем логичную планировку и заранее учитываем затраты на строительство и эксплуатацию.',
        'В пакетах «Премиум» и «Люкс» стиль фасада — современный или классический — показываем в 3D-визуализации. Во все пакеты входят основные и рабочие чертежи для мастеров (фасад, план, разрез). Отдельно заказывается только документация для разрешения.',
      ],
      includes: [
        'Анализ участка и требований',
        'Эскиз и варианты планировки',
        'Дизайн фасада (современный или классический)',
        '3D-визуализация экстерьера (в пакетах «Премиум» и «Люкс»)',
        'Основные чертежи: фасады, планы, разрезы (во всех пакетах)',
        'Рабочие чертежи для мастеров (во всех пакетах)',
        'Концепция ландшафтного дизайна (в пакете «Люкс»)',
        'Документация для разрешения (заказывается отдельно)',
      ],
      steps: [
        ['Знакомство', 'Определяем участок, количество комнат, этажность и бюджет.'],
        ['Эскиз', 'Предлагаем варианты планировки и объёмного решения.'],
        ['Фасад и 3D', 'Утверждаем внешний вид в 3D.'],
        ['Чертежи', 'Готовим фасады, планы и разрезы.'],
        ['Документация', 'При необходимости оформляем документы для разрешения.'],
      ],
      faq: [
        ['Как рассчитывается стоимость проекта дома?', 'Стоимость зависит от площади участка (сотки), этажности и пакета (Стандарт, Премиум, Люкс). Примерную цену можно увидеть в калькуляторе.'],
        ['Сколько времени занимает проект?', 'Обычно 15–25 дней — в зависимости от участка и сложности.'],
        ['Можете доработать готовый проект?', 'Да, анализируем существующий проект и перерабатываем планировку или фасад.'],
        ['Помогаете с получением разрешения?', 'Да, готовим проектную документацию для строительства. Подробнее — в услуге «Проектная документация».'],
      ],
    },
  },
  {
    id: 'docs',
    slug: { uz: 'loyiha-hujjatlari', ru: 'proektnaya-dokumentaciya' },
    cat: ['architecture', 'drawings'],
    hero: '/assets/draw-02.webp',
    uz: {
      name: 'Loyiha hujjatlari va ruxsatnoma',
      title: 'Ruxsatnoma uchun loyiha hujjatlari Toshkentda | Visart Design',
      desc: "Qurilish va rekonstruksiya uchun loyiha hujjatlari: arxitektura qismi, kadastr va mygov.uz orqali ruxsatnoma uchun hujjatlar tayyorlash. Toshkent.",
      h1: 'Loyiha hujjatlari va ruxsatnoma',
      lead: "Qurilish yoki rekonstruksiyani boshlashdan oldin kerak bo'ladigan arxitektura hujjatlarini tayyorlaymiz.",
      intro: [
        "Uy qurish, kengaytirish yoki binoni rekonstruksiya qilish uchun rasmiy talablarga mos loyiha hujjatlari kerak. Hujjatlardagi kamchilik ko'pincha ruxsatnoma jarayonini kechiktiradi.",
        "Biz arxitektura qismini amaldagi talablarga mos holda tayyorlaymiz va kadastr hamda mygov.uz orqali topshiriladigan hujjatlar to'plamini yig'ishda yordam beramiz. Davlat boj to'lovlari alohida to'lanadi.",
      ],
      includes: [
        "Obyekt va mavjud hujjatlarni o'rganish",
        "Arxitektura qismi: rejalar, fasadlar, kesimlar",
        'Bosh reja (uchastkada joylashuv)',
        "Ruxsatnoma uchun hujjatlar to'plamini tayyorlash",
        "mygov.uz va kadastr jarayonlari bo'yicha maslahat",
        "Kerak bo'lsa — ishchi chizmalar",
      ],
      steps: [
        ["Tahlil", "Obyekt, mavjud hujjatlar va maqsadni aniqlaymiz."],
        ["Chizmalar", "Arxitektura qismini tayyorlaymiz."],
        ["To'plam", "Ruxsatnoma uchun hujjatlarni jamlaymiz."],
        ["Topshirish", "Topshirish tartibi bo'yicha yo'l-yo'riq beramiz."],
      ],
      faq: [
        ['Qaysi hollarda loyiha hujjatlari kerak?', "Yangi qurilish, qavat qo'shish, kengaytirish yoki binoning vazifasini o'zgartirishda odatda loyiha hujjatlari talab qilinadi."],
        ['Davlat boj to\'lovlari narxga kiradimi?', "Yo'q, rasmiy boj to'lovlari alohida to'lanadi. Biz faqat hujjatlarni tayyorlash xizmati uchun haq olamiz."],
        ['Hujjatlar qancha vaqtda tayyor bo\'ladi?', "Obyekt va hujjat turiga qarab farq qiladi — aniq muddatni konsultatsiyada aytamiz."],
        ["Faqat hujjat buyurtma qilsam bo'ladimi?", "Ha, dizayn yoki loyihani boshqa joyda qilgan bo'lsangiz ham, hujjatlar xizmatini alohida buyurtma qilishingiz mumkin."],
      ],
    },
    ru: {
      name: 'Проектная документация и разрешение',
      title: 'Проектная документация в Ташкенте | Visart Design',
      desc: 'Проектная документация для строительства и реконструкции: архитектурный раздел, подготовка документов для кадастра и разрешения через mygov.uz. Ташкент.',
      h1: 'Проектная документация и разрешение на строительство',
      lead: 'Готовим архитектурную документацию, необходимую до начала строительства или реконструкции.',
      intro: [
        'Для строительства, расширения или реконструкции здания нужна проектная документация, соответствующая официальным требованиям. Ошибки в документах часто затягивают получение разрешения.',
        'Мы готовим архитектурный раздел по действующим требованиям и помогаем собрать пакет документов для кадастра и подачи через mygov.uz. Государственные пошлины оплачиваются отдельно.',
      ],
      includes: [
        'Изучение объекта и имеющихся документов',
        'Архитектурный раздел: планы, фасады, разрезы',
        'Генплан (размещение на участке)',
        'Подготовка пакета документов для разрешения',
        'Консультации по процедурам mygov.uz и кадастра',
        'При необходимости — рабочие чертежи',
      ],
      steps: [
        ['Анализ', 'Изучаем объект, документы и цель.'],
        ['Чертежи', 'Готовим архитектурный раздел.'],
        ['Пакет', 'Собираем документы для разрешения.'],
        ['Подача', 'Подсказываем порядок подачи.'],
      ],
      faq: [
        ['В каких случаях нужна проектная документация?', 'Обычно она требуется при новом строительстве, надстройке этажа, расширении или изменении назначения здания.'],
        ['Входят ли госпошлины в стоимость?', 'Нет, официальные пошлины оплачиваются отдельно. Мы берём оплату только за подготовку документации.'],
        ['Сколько времени занимает подготовка?', 'Зависит от объекта и вида документов — точный срок назовём на консультации.'],
        ['Можно заказать только документацию?', 'Да, даже если дизайн или проект делали в другом месте, услугу по документации можно заказать отдельно.'],
      ],
    },
  },
  {
    id: 'turnkey',
    slug: { uz: 'pod-klyuch', ru: 'remont-pod-klyuch' },
    cat: ['interior', 'architecture'],
    hero: '/assets/int-10.webp',
    uz: {
      name: "Pod klyuch: ta'mir va qurilish",
      title: "Pod klyuch ta'mir va qurilish Toshkentda | Visart Design",
      desc: "Uy va kvartirani loyihadan topshirishgacha pod klyuch ta'mirlash va qurish: ustalar, materiallar, mebel va mualliflik nazorati. Toshkent.",
      h1: "Pod klyuch ta'mir va qurilish",
      lead: "Loyihadan tortib kalit topshirishgacha — dizayn, ta'mir, materiallar va nazorat bitta jamoada.",
      intro: [
        "Pod klyuch formatida siz alohida dizayner, prorab va ta'minotchi qidirmaysiz. Loyiha muallifi qurilishni ham nazorat qiladi, shuning uchun natija 3D loyihadagiga imkon qadar yaqin chiqadi.",
        "Har bir bandni — usta haqi, qurilish materiallari, mebel va jihozlar — alohida tanlashingiz mumkin. Masalan, materialni o'zingiz olib kelsangiz, faqat ish va nazorat uchun to'laysiz.",
      ],
      includes: [
        "Dizayn-loyiha va ishchi chizmalar",
        "Ta'mir yoki qurilish ishlarini tashkil qilish",
        'Qurilish materiallarini tanlash va yetkazish',
        'Mebel va jihozlar',
        "Mualliflik nazorati — loyihaga muvofiqlikni tekshirish",
        "Kommunikatsiyalarni ulash (suv, elektr, gaz)",
        'Obyektni topshirish',
      ],
      steps: [
        ['Loyiha', "Dizayn-loyiha va smetani tasdiqlaymiz."],
        ['Qora ishlar', "Devor, tom, kommunikatsiyalar."],
        ['Pardozlash', "Ichki va tashqi pardozlash ishlari."],
        ['Mebel va jihozlar', "Yetkazish va o'rnatish."],
        ['Topshirish', "Tayyor obyektni kalit bilan topshiramiz."],
      ],
      faq: [
        ['Pod klyuch narxi qanday hisoblanadi?', "Narx maydon va tanlangan bandlarga (ish, material, mebel) qarab hisoblanadi. Kalkulyatorda taxminiy summani so'm yoki dollarda ko'rishingiz mumkin."],
        ['Pod klyuch qancha vaqt oladi?', "Maydonga qarab: 100 m² gacha — 1–2 oy, 300 m² gacha — 2–3 oy, kattaroq obyektlar — 4–12 oy."],
        ["Materialni o'zim olsam bo'ladimi?", "Ha, har bir band mustaqil tanlanadi — materialni o'zingiz olib, faqat ish va nazoratni buyurtma qilishingiz mumkin."],
        ["Narxga nimalar kirmaydi?", "Uchastkani tozalash, murakkab grunt uchun maxsus poydevor va davlat boj to'lovlari alohida hisoblanadi."],
      ],
    },
    ru: {
      name: 'Ремонт и строительство под ключ',
      title: 'Ремонт и строительство под ключ в Ташкенте | Visart Design',
      desc: 'Ремонт и строительство домов и квартир под ключ в Ташкенте: от проекта до сдачи — мастера, материалы, мебель и авторский надзор.',
      h1: 'Ремонт и строительство под ключ',
      lead: 'От проекта до сдачи ключей — дизайн, ремонт, материалы и контроль в одной команде.',
      intro: [
        'В формате «под ключ» вам не нужно искать отдельно дизайнера, прораба и поставщиков. Автор проекта контролирует и строительство, поэтому результат максимально близок к 3D-проекту.',
        'Каждый пункт — работа мастеров, стройматериалы, мебель и оборудование — можно выбрать отдельно. Например, если материалы покупаете сами, вы платите только за работу и надзор.',
      ],
      includes: [
        'Дизайн-проект и рабочие чертежи',
        'Организация ремонтных или строительных работ',
        'Подбор и доставка стройматериалов',
        'Мебель и оборудование',
        'Авторский надзор — контроль соответствия проекту',
        'Подключение коммуникаций (вода, электричество, газ)',
        'Сдача объекта',
      ],
      steps: [
        ['Проект', 'Утверждаем дизайн-проект и смету.'],
        ['Черновые работы', 'Стены, кровля, коммуникации.'],
        ['Отделка', 'Внутренняя и наружная отделка.'],
        ['Мебель и техника', 'Доставка и монтаж.'],
        ['Сдача', 'Передаём готовый объект с ключами.'],
      ],
      faq: [
        ['Как рассчитывается стоимость под ключ?', 'Стоимость зависит от площади и выбранных пунктов (работа, материалы, мебель). В калькуляторе можно увидеть примерную сумму в сумах или долларах.'],
        ['Сколько длится ремонт под ключ?', 'В зависимости от площади: до 100 м² — 1–2 месяца, до 300 м² — 2–3 месяца, крупные объекты — 4–12 месяцев.'],
        ['Можно ли покупать материалы самому?', 'Да, каждый пункт выбирается отдельно — можно купить материалы самостоятельно и заказать только работу и надзор.'],
        ['Что не входит в стоимость?', 'Расчистка участка, специальный фундамент для сложных грунтов и государственные пошлины рассчитываются отдельно.'],
      ],
    },
  },
  {
    id: 'drawings',
    slug: { uz: 'ishchi-chizmalar', ru: 'rabochie-chertezhi' },
    cat: ['drawings'],
    hero: '/assets/draw-01.webp',
    uz: {
      name: 'Ishchi chizmalar',
      title: "Ishchi chizmalar Toshkentda — ta'mir uchun | Visart Design",
      desc: "Ustalar uchun ishchi chizmalar: o'lchov rejasi, devor yoyilmalari, elektrika, santexnika, shift va mebel chizmalari. Toshkent. Bepul konsultatsiya.",
      h1: "Ta'mir va qurilish uchun ishchi chizmalar",
      lead: "Ustalar xatosiz ishlashi uchun aniq o'lchamli, tushunarli chizmalar to'plami.",
      intro: [
        "Ishchi chizmalarsiz ta'mir ko'pincha taxmin bilan qilinadi: rozetka noto'g'ri joyda chiqadi, mebel sig'maydi, shift balandligi mos kelmaydi. Aniq chizmalar bunday xatolarni va ortiqcha xarajatni oldini oladi.",
        "Dizayningiz boshqa joyda tayyorlangan bo'lsa ham, uning asosida ishchi chizmalarni tayyorlab beramiz. Har bir varaq ustalar va ta'minotchilar uchun tushunarli qilib rasmiylashtiriladi.",
      ],
      includes: [
        "O'lchov rejasi va demontaj/montaj rejalari",
        'Devor yoyilmalari va kesimlar',
        'Elektrika: rozetka, yoritish va kalitlar joylashuvi',
        'Santexnika va jihozlar joylashuvi',
        'Shift rejasi',
        'Pol qoplamalari rejasi',
        "Mebel joylashuvi va o'lchamlari",
      ],
      steps: [
        ["O'lchov", "Obyektni o'lchaymiz yoki mavjud rejani tekshiramiz."],
        ['Kelishuv', "Dizayn yoki texnik topshiriqni aniqlaymiz."],
        ['Chizish', "Barcha bo'limlar bo'yicha chizmalarni tayyorlaymiz."],
        ['Topshirish', "PDF va bosma shaklda topshiramiz."],
      ],
      faq: [
        ["Ishchi chizmalar narxi qancha?", "Narx maydon (m²) bo'yicha hisoblanadi — kalkulyatordagi «Standart — chizmalar» paketiga qarang."],
        ['Chizmalar qancha vaqtda tayyor bo\'ladi?', "Odatda 10–15 kun, maydon va murakkablikka qarab."],
        ["Boshqa dizaynerning loyihasi bo'yicha chizma qilasizmi?", "Ha, tayyor dizayn yoki 3D asosida ishchi chizmalarni tayyorlab beramiz."],
        ['Chizmalar qanday formatda beriladi?', "PDF formatida, kerak bo'lsa bosma nusxada."],
      ],
    },
    ru: {
      name: 'Рабочие чертежи',
      title: 'Рабочие чертежи для ремонта в Ташкенте | Visart Design',
      desc: 'Рабочие чертежи для мастеров: обмерный план, развёртки стен, электрика, сантехника, потолки и мебель. Ташкент. Бесплатная консультация.',
      h1: 'Рабочие чертежи для ремонта и строительства',
      lead: 'Точный и понятный комплект чертежей, чтобы мастера работали без ошибок.',
      intro: [
        'Без рабочих чертежей ремонт часто делается «на глаз»: розетки оказываются не там, мебель не помещается, высота потолка не совпадает. Точные чертежи предотвращают такие ошибки и лишние расходы.',
        'Даже если дизайн делали в другом месте, мы подготовим рабочие чертежи на его основе. Каждый лист оформляется понятно для мастеров и поставщиков.',
      ],
      includes: [
        'Обмерный план, планы демонтажа и монтажа',
        'Развёртки стен и разрезы',
        'Электрика: розетки, освещение, выключатели',
        'Сантехника и расстановка оборудования',
        'План потолков',
        'План напольных покрытий',
        'Расстановка и размеры мебели',
      ],
      steps: [
        ['Обмер', 'Обмеряем объект или проверяем имеющийся план.'],
        ['Согласование', 'Уточняем дизайн или техническое задание.'],
        ['Чертежи', 'Готовим чертежи по всем разделам.'],
        ['Передача', 'Передаём в PDF и печатном виде.'],
      ],
      faq: [
        ['Сколько стоят рабочие чертежи?', 'Стоимость рассчитывается по площади (м²) — смотрите пакет «Стандарт — чертежи» в калькуляторе.'],
        ['Сколько времени занимает подготовка?', 'Обычно 10–15 дней, в зависимости от площади и сложности.'],
        ['Делаете чертежи по проекту другого дизайнера?', 'Да, готовим рабочие чертежи на основе готового дизайна или 3D.'],
        ['В каком формате передаются чертежи?', 'В формате PDF, при необходимости — в печатном виде.'],
      ],
    },
  },
];

const UI = {
  uz: {
    home: 'Bosh sahifa', services: 'Xizmatlar', otherLang: 'RU', projects: 'Loyihalar', calc: 'Narxni hisoblash',
    includes: 'Xizmatga nimalar kiradi', steps: 'Ish bosqichlari', prices: 'Narxlar', pay: "To'lov tartibi",
    faq: 'Savol-javob', related: 'Shu yo\'nalishdagi loyihalar', other: 'Boshqa xizmatlar',
    cta: 'Bepul konsultatsiya', ctaTitle: 'Loyihangizni muhokama qilaylik', ctaText: "Bepul konsultatsiyada taxminiy narx va muddatni aytib beramiz.",
    from: 'dan', perM2: "so'm / m²", perSotix: "so'm / sotix", sum: "so'm", timeline: 'Muddat', priceFrom: 'Narx',
    calcNote: "Yakuniy narx obyekt va vazifaga qarab aniqlanadi. Taxminiy summani kalkulyatorda ko'ring.",
    city: 'Toshkent', call: "Qo'ng'iroq qilish", byConsult: 'Konsultatsiyada aniqlanadi', calcLink: 'Kalkulyatorda hisoblash',
  },
  ru: {
    home: 'Главная', services: 'Услуги', otherLang: 'UZ', projects: 'Проекты', calc: 'Рассчитать стоимость',
    includes: 'Что входит в услугу', steps: 'Этапы работы', prices: 'Цены', pay: 'Порядок оплаты',
    faq: 'Вопросы и ответы', related: 'Проекты по этому направлению', other: 'Другие услуги',
    cta: 'Бесплатная консультация', ctaTitle: 'Обсудим ваш проект', ctaText: 'На бесплатной консультации назовём примерную стоимость и сроки.',
    from: 'от', perM2: 'сум / м²', perSotix: 'сум / сотка', sum: 'сум', timeline: 'Срок', priceFrom: 'Цена',
    calcNote: 'Итоговая стоимость определяется по объекту и задаче. Примерную сумму смотрите в калькуляторе.',
    city: 'Ташкент', call: 'Позвонить', byConsult: 'Уточняется на консультации', calcLink: 'Рассчитать в калькуляторе',
  },
};

const DEFAULT_DESIGN_PAY = [
  { pct: 40, uz: 'Shartnoma imzolanganda (oldindan)', ru: 'При подписании договора (предоплата)' },
  { pct: 30, uz: 'Dizayn konsepsiyasi tasdiqlanganda', ru: 'После утверждения дизайн-концепции' },
  { pct: 30, uz: "Loyiha to'liq topshirilganda", ru: 'После сдачи готового проекта' },
];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const money = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/ /g, ' ');
const fromP = (lang, v) => (lang === 'ru' ? `от ${v}` : `${v} dan`);
const absUrl = (u) => (!u ? '' : /^https?:\/\//.test(u) ? u : `${BASE}/${String(u).replace(/^\//, '')}`);

export function findService(slug, lang) {
  return SERVICES.find((s) => s.slug[lang] === slug) || null;
}
export function serviceUrl(s, lang) {
  return lang === 'ru' ? `${BASE}/ru/uslugi/${s.slug.ru}` : `${BASE}/xizmatlar/${s.slug.uz}`;
}

// Narx kartalari — admin paneldagi narxlardan.
function priceBlock(s, lang, P) {
  const t = UI[lang];
  const cards = [];
  let timeline = '';
  let fromPrice = '';
  try {
    if (s.id === 'interior' && P.interior) {
      const feats = P.interior.features || {};
      for (const pk of P.interior.packages || []) {
        const inc = (pk.includes || []).map((k) => (feats[k] ? feats[k][lang] : '')).filter(Boolean);
        cards.push({ name: pk[lang], price: `${money(pk.rate)} ${t.perM2}`, list: inc, qs: `calc=interior&pkg=${pk.id}` });
      }
      const rates = (P.interior.packages || []).map((p) => p.rate).filter(Boolean);
      if (rates.length) fromPrice = fromP(lang, `${money(Math.min(...rates))} ${t.perM2}`);
      const tl = P.timelines && P.timelines.interior;
      if (tl) timeline = Object.values(tl).map((x) => x[lang]).filter(Boolean).join(' / ');
    } else if (s.id === 'arch' && P.architecture) {
      const base = P.architecture.ratePerSotix || 0;
      const feats = P.architecture.styleFeatures || {};
      for (const st of P.styles || []) {
        cards.push({ name: st[lang], price: `${money(base * (st.mult || 1))} ${t.perSotix}`, list: (feats[st.id] || []).map((f) => f[lang]), qs: `calc=arch&style=${st.id}` });
      }
      if (base) fromPrice = fromP(lang, `${money(base)} ${t.perSotix}`);
      timeline = P.timelines && P.timelines.architecture ? P.timelines.architecture[lang] : '';
    } else if (s.id === 'docs' && P.architecture) {
      const d = (P.architecture.addons || []).find((a) => a.id === 'docs');
      if (d && d.flat) fromPrice = fromP(lang, `${money(d.flat)} ${t.sum}`);
    } else if (s.id === 'drawings' && P.interior) {
      const pk = (P.interior.packages || []).find((p) => p.id === 'drawings');
      if (pk) {
        const feats = P.interior.features || {};
        cards.push({ name: pk[lang], price: `${money(pk.rate)} ${t.perM2}`, list: (pk.includes || []).map((k) => (feats[k] ? feats[k][lang] : '')).filter(Boolean), qs: 'calc=interior&pkg=drawings' });
        fromPrice = fromP(lang, `${money(pk.rate)} ${t.perM2}`);
      }
      const wd = (P.architecture && P.architecture.addons || []).find((a) => a.id === 'workDrawings');
      if (wd && wd.flat) cards.push({ name: wd[lang], price: fromP(lang, `${money(wd.flat)} ${t.sum}`), list: [] });
      const tl = P.timelines && P.timelines.interior && P.timelines.interior.drawings;
      if (tl) timeline = tl[lang];
    } else if (s.id === 'turnkey') {
      const tl = (P.timelines && P.timelines.turnkey) || [];
      timeline = tl.map((x) => x[lang]).filter(Boolean).join(' / ');
    }
  } catch (e) { /* narxlar bo'lmasa sahifa matn bilan ochilaveradi */ }
  return { cards, timeline, fromPrice };
}

export function renderServicePage({ s, lang, pricing = {}, related = [], phone = '+998974021515' }) {
  const t = UI[lang];
  const c = s[lang];
  const other = lang === 'uz' ? 'ru' : 'uz';
  const selfUrl = serviceUrl(s, lang);
  const otherUrl = serviceUrl(s, other);
  const homeUrl = lang === 'ru' ? `${BASE}/ru/` : `${BASE}/`;
  const heroAbs = absUrl((related[0] && related[0].hero_url) || s.hero);
  const { cards, timeline, fromPrice } = priceBlock(s, lang, pricing || {});
  const pay = s.id === 'turnkey' ? (pricing.paymentStages || []) : ((pricing.designPaymentStages && pricing.designPaymentStages.length) ? pricing.designPaymentStages : DEFAULT_DESIGN_PAY);
  const tel = String(phone || '').replace(/[^\d+]/g, '');
  const calcSvc = { interior: 'interior', drawings: 'interior', arch: 'arch', docs: 'arch', turnkey: 'turnkey' }[s.id] || 'arch';
  const calcHref = (qs) => `${homeUrl}?${(qs || `calc=${calcSvc}`).replace(/&/g, '&amp;')}#pricing`;

  const serviceLd = {
    '@context': 'https://schema.org', '@type': 'Service', name: c.name, serviceType: c.name, description: c.desc,
    url: selfUrl, inLanguage: lang, areaServed: { '@type': 'City', name: t.city },
    provider: { '@type': 'LocalBusiness', name: 'Visart Design', url: `${BASE}/`, telephone: tel, image: `${BASE}/assets/hero.jpg`,
      address: { '@type': 'PostalAddress', addressLocality: t.city, addressCountry: 'UZ' } },
  };
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: c.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  const crumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: t.home, item: homeUrl },
    { '@type': 'ListItem', position: 2, name: t.services, item: `${homeUrl}#services` },
    { '@type': 'ListItem', position: 3, name: c.name, item: selfUrl },
  ] };

  const relHtml = related.map((r) => {
    const title = (r[`title_${lang}`] || '').trim();
    const slug = lang === 'ru' ? r.slug_ru : r.slug;
    if (!slug || !title) return '';
    const u = lang === 'ru' ? `${BASE}/ru/proekty/${encodeURIComponent(slug)}` : `${BASE}/loyihalar/${slug}`;
    return `<a class="rel" href="${u}"><img src="${esc(absUrl(r.thumb_url))}" alt="${esc(title)}" loading="lazy"><span>${esc(title)}</span><small>${esc(r[`type_${lang}`] || '')}</small></a>`;
  }).join('');
  const otherHtml = SERVICES.filter((x) => x.id !== s.id).map((x) => `<a href="${serviceUrl(x, lang)}">${esc(x[lang].name)}</a>`).join('');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(c.title)}</title>
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="description" content="${esc(c.desc)}">
<link rel="canonical" href="${selfUrl}">
<link rel="alternate" hreflang="uz" href="${serviceUrl(s, 'uz')}">
<link rel="alternate" hreflang="ru" href="${serviceUrl(s, 'ru')}">
<link rel="alternate" hreflang="x-default" href="${serviceUrl(s, 'uz')}">
<meta property="og:site_name" content="Visart Design">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(c.h1)}">
<meta property="og:description" content="${esc(c.desc)}">
<meta property="og:image" content="${esc(heroAbs)}">
<meta property="og:url" content="${selfUrl}">
<meta property="og:locale" content="${lang === 'uz' ? 'uz_UZ' : 'ru_RU'}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/x-icon" href="${BASE}/assets/favicon.ico">
<link rel="preload" as="image" href="${esc(heroAbs)}">
<script type="application/ld+json">${JSON.stringify(serviceLd)}</script>
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
<script type="application/ld+json">${JSON.stringify(crumbLd)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@500;600&display=swap" rel="stylesheet">
<style>
:root{--gold:#A9895A;--gold-l:#C4A876;--ink:#151412;--paper:#FCFBF9;--t1:#151412;--t2:#4F4C43;--t3:#6B675C;--line:#E7E3D9;--serif:'Playfair Display',serif;--sans:'Inter',sans-serif}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--sans);background:var(--paper);color:var(--t1);-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}a{color:inherit;text-decoration:none}
.wrap{max-width:1120px;margin:0 auto;padding:0 32px}
header{background:var(--ink);position:sticky;top:0;z-index:10}
header .wrap{display:flex;align-items:center;justify-content:space-between;height:66px}
.brand{display:flex;align-items:center;gap:10px;color:#fff;font-family:var(--serif);letter-spacing:1px}.brand img{width:28px}
.hnav{display:flex;align-items:center;gap:18px}.hnav a{color:#B8B2A0;font-size:13px}.hnav a:hover{color:var(--gold-l)}
.hnav .lang{border:0.5px solid rgba(255,255,255,.3);border-radius:3px;padding:5px 11px;color:#fff;font-weight:600;font-size:12px}
.hero{position:relative;height:min(64vh,600px);overflow:hidden;background:var(--ink)}
.hero img{width:100%;height:100%;object-fit:cover}
.hero::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(21,20,18,.15) 30%,rgba(21,20,18,.88) 100%)}
.hero-cap{position:absolute;left:0;right:0;bottom:0;z-index:2;padding-bottom:48px;color:#fff}
.crumbs{font-size:12px;color:#D9CBAE;margin-bottom:16px}.crumbs a:hover{color:#fff}
h1{font-family:var(--serif);font-weight:600;font-size:clamp(30px,4.4vw,52px);line-height:1.15;max-width:820px}
.lead{margin-top:14px;font-size:16px;color:#E4DED0;max-width:680px;line-height:1.6}
.body{display:grid;grid-template-columns:1.6fr 1fr;gap:64px;padding:72px 0 40px}
.content p{font-size:16.5px;line-height:1.85;color:var(--t2);margin-bottom:18px}
.content h2{font-family:var(--serif);font-size:26px;font-weight:600;margin:44px 0 18px}
.content h2:first-child{margin-top:0}
.checks{list-style:none;display:grid;gap:10px}
.checks li{position:relative;padding-left:26px;font-size:15.5px;color:var(--t2);line-height:1.6}
.checks li::before{content:'';position:absolute;left:0;top:9px;width:12px;height:7px;border-left:1.6px solid var(--gold);border-bottom:1.6px solid var(--gold);transform:rotate(-45deg)}
.steps{list-style:none;counter-reset:s;display:grid;gap:14px}
.steps li{counter-increment:s;display:grid;grid-template-columns:44px 1fr;gap:14px;align-items:start}
.steps li::before{content:counter(s,decimal-leading-zero);font-family:var(--serif);color:var(--gold);font-size:22px}
.steps b{display:block;font-size:15.5px;margin-bottom:3px}.steps span{color:var(--t3);font-size:14.5px;line-height:1.6}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.card{border:0.5px solid var(--line);border-radius:4px;padding:22px;background:#fff}
.card h3{font-size:15px;font-weight:600;margin-bottom:6px}.card .pr{font-family:var(--serif);font-size:20px;color:var(--gold);margin-bottom:12px}
.card-calc{display:inline-block;margin-top:14px;font-size:13px;color:var(--gold);border-bottom:1px solid currentColor;padding-bottom:1px}.card-calc:hover{color:var(--ink)}
.card ul{list-style:none;display:grid;gap:6px}.card li{font-size:13.5px;color:var(--t2);padding-left:14px;position:relative}.card li::before{content:'·';position:absolute;left:2px;color:var(--gold)}
.note{font-size:13px;color:var(--t3);margin-top:12px}
.pay div{display:flex;gap:16px;align-items:baseline;padding:12px 0;border-bottom:0.5px solid var(--line);font-size:15px;color:var(--t2)}
.pay b{font-family:var(--serif);font-size:22px;color:var(--gold);min-width:58px}
details{border-bottom:0.5px solid var(--line);padding:16px 0}
summary{cursor:pointer;font-weight:600;font-size:15.5px;list-style:none}summary::-webkit-details-marker{display:none}
summary::after{content:'+';float:right;color:var(--gold);font-size:20px;line-height:1}details[open] summary::after{content:'–'}
details p{margin-top:10px;font-size:15px;line-height:1.7;color:var(--t2)}
aside{position:sticky;top:96px;align-self:start}
.facts{border-top:0.5px solid var(--line)}
.facts div{display:flex;justify-content:space-between;gap:16px;padding:15px 0;border-bottom:0.5px solid var(--line);font-size:14px}
.facts dt{color:var(--t3)}.facts dd{font-weight:500;text-align:right}
.side-cta{margin-top:24px;display:flex;flex-direction:column;gap:10px}
.btn{display:inline-flex;justify-content:center;align-items:center;padding:14px 22px;font-size:13px;font-weight:600;border-radius:2px;transition:all .2s}
.btn-gold{background:var(--gold);color:var(--ink)}.btn-gold:hover{background:var(--gold-l)}
.btn-line{border:0.5px solid var(--t1)}.btn-line:hover{background:var(--t1);color:#fff}
.others{margin-top:30px}.others h4{font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:var(--t3);margin-bottom:10px}
.others a{display:block;padding:9px 0;border-bottom:0.5px solid var(--line);font-size:14px}.others a:hover{color:var(--gold)}
.related{padding:24px 0 72px}.related h2{font-family:var(--serif);font-size:28px;font-weight:500;margin-bottom:28px}
.rel-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.rel img{aspect-ratio:4/3;object-fit:cover;border-radius:3px;margin-bottom:12px;transition:opacity .2s}.rel:hover img{opacity:.85}
.rel span{display:block;font-weight:600;font-size:15px}.rel small{color:var(--t3);font-size:12.5px}
.cta{background:var(--ink);color:#fff;text-align:center;padding:80px 24px}
.cta h2{font-family:var(--serif);font-weight:500;font-size:clamp(26px,3.4vw,38px);margin-bottom:12px}
.cta p{color:#B8B2A0;margin-bottom:28px}.cta .row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.cta .btn-line{border-color:rgba(255,255,255,.6);color:#fff}.cta .btn-line:hover{background:#fff;color:var(--ink)}
footer{background:var(--ink);color:#8C8676;font-size:12.5px;padding:30px 0;border-top:0.5px solid rgba(255,255,255,.08)}
footer .wrap{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}footer a:hover{color:var(--gold-l)}
@media(max-width:820px){.body{grid-template-columns:1fr;gap:36px;padding:48px 0 28px}aside{position:static}.rel-grid{grid-template-columns:1fr 1fr}.wrap{padding:0 20px}.hnav a.hide-m{display:none}}
@media(max-width:520px){.rel-grid{grid-template-columns:1fr}.hero{height:58vh}}
</style>
</head>
<body>
<header><div class="wrap">
  <a href="${homeUrl}" class="brand"><img src="${BASE}/assets/logo-mark.png" alt="">VISART</a>
  <nav class="hnav">
    <a class="hide-m" href="${homeUrl}#projects">${esc(t.projects)}</a>
    <a class="hide-m" href="${calcHref()}">${esc(t.calc)}</a>
    <a class="lang" href="${otherUrl}" hreflang="${other}">${t.otherLang}</a>
  </nav>
</div></header>
<main>
  <section class="hero">
    <img src="${esc(heroAbs)}" alt="${esc(c.h1)}" fetchpriority="high">
    <div class="hero-cap"><div class="wrap">
      <nav class="crumbs" aria-label="breadcrumb"><a href="${homeUrl}">${esc(t.home)}</a> / <a href="${homeUrl}#services">${esc(t.services)}</a> / ${esc(c.name)}</nav>
      <h1>${esc(c.h1)}</h1>
      <p class="lead">${esc(c.lead)}</p>
    </div></div>
  </section>
  <div class="wrap body">
    <div class="content">
      ${c.intro.map((p) => `<p>${esc(p)}</p>`).join('')}
      <h2>${esc(t.includes)}</h2>
      <ul class="checks">${c.includes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h2>${esc(t.steps)}</h2>
      <ol class="steps">${c.steps.map(([a, b]) => `<li><div><b>${esc(a)}</b><span>${esc(b)}</span></div></li>`).join('')}</ol>
      ${cards.length ? `<h2>${esc(t.prices)}</h2><div class="cards">${cards.map((k) => `<div class="card"><h3>${esc(k.name)}</h3><div class="pr">${esc(k.price)}</div>${k.list.length ? `<ul>${k.list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${k.qs ? `<a class="card-calc" href="${calcHref(k.qs)}">${esc(t.calcLink)} →</a>` : ''}</div>`).join('')}</div><p class="note">${esc(t.calcNote)}</p>` : ''}
      ${pay.length ? `<h2>${esc(t.pay)}</h2><div class="pay">${pay.map((p) => `<div><b>${esc(p.pct)}%</b><span>${esc(p[lang])}</span></div>`).join('')}</div>` : ''}
      <h2>${esc(t.faq)}</h2>
      ${c.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
    </div>
    <aside>
      <dl class="facts">
        <div><dt>${esc(t.priceFrom)}</dt><dd>${esc(fromPrice || t.byConsult)}</dd></div>
        <div><dt>${esc(t.timeline)}</dt><dd>${esc(timeline || t.byConsult)}</dd></div>
        <div><dt>${esc(t.pay)}</dt><dd>${esc(pay.map((p) => p.pct + '%').join(' / '))}</dd></div>
      </dl>
      <div class="side-cta">
        <a class="btn btn-gold" href="${homeUrl}#contact">${esc(t.cta)}</a>
        <a class="btn btn-line" href="${calcHref()}">${esc(t.calcLink)}</a>
        ${tel ? `<a class="btn btn-line" href="tel:${esc(tel)}">${esc(t.call)}</a>` : ''}
      </div>
      <div class="others"><h4>${esc(t.other)}</h4>${otherHtml}</div>
    </aside>
  </div>
  ${relHtml ? `<section class="related"><div class="wrap"><h2>${esc(t.related)}</h2><div class="rel-grid">${relHtml}</div></div></section>` : ''}
  <section class="cta">
    <h2>${esc(t.ctaTitle)}</h2>
    <p>${esc(t.ctaText)}</p>
    <div class="row"><a class="btn btn-gold" href="${homeUrl}#contact">${esc(t.cta)}</a><a class="btn btn-line" href="${calcHref()}">${esc(t.calc)}</a></div>
  </section>
</main>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} Visart Design · ${lang === 'uz' ? "Toshkent, Uchtepa tumani, Foziltepa ko'chasi" : 'Ташкент, Учтепинский район, ул. Фозилтепа'}</span><a href="${BASE}/maxfiylik/">${lang === 'uz' ? 'Maxfiylik siyosati' : 'Конфиденциальность'}</a></div></footer>
</body>
</html>`;
}

// Route'lar uchun umumiy ishlov beruvchi.
export async function serveService({ params, env }, lang) {
  const slug = decodeURIComponent(String(params.slug || '')).replace(/\/$/, '');
  const s = findService(slug, lang);
  if (!s) {
    const nf = env.ASSETS ? await env.ASSETS.fetch(new Request(`${BASE}/404.html`)) : null;
    return new Response(nf ? nf.body : 'Not found', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  let pricing = {}; let related = []; let phone = '';
  try {
    const rows = await env.DB.prepare("SELECT key, value FROM settings WHERE key IN ('pricing_json','phone')").all();
    for (const r of rows.results || []) {
      if (r.key === 'pricing_json') { try { pricing = JSON.parse(r.value || '{}') || {}; } catch (e) { pricing = {}; } }
      if (r.key === 'phone') phone = r.value || '';
    }
    const ph = s.cat.map(() => '?').join(',');
    const res = await env.DB.prepare(`SELECT * FROM projects WHERE category IN (${ph}) ORDER BY (status = 'done') DESC, sort_order ASC, id ASC LIMIT 3`).bind(...s.cat).all();
    related = res.results || [];
  } catch (e) { /* baza ishlamasa ham sahifa matn bilan ochiladi */ }
  const html = renderServicePage({ s, lang, pricing, related, phone: phone || '+998974021515' });
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}
