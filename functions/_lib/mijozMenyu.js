// Mijoz botining shaxsiy chat imkoniyatlari: menyu (uz/ru), narx hisoblash,
// rasm-reference (uslub tahlili), lid baholash, obyekt holati.
// Yordamchilar (tgSend, sbFetch, ...) mijoz-bot.js dan `h` obyekti orqali beriladi.
// Mijoz holati: Supabase `mijoz_profil` jadvali (db/migration_mijoz_profil.sql);
// jadval yo'q bo'lsa hammasi uz tilida, holatsiz ishlayveradi.

export const SAYT = 'https://visartdesign.uz';
// Lid xabarlari oluvchilar: MANAGER_CHAT_ID bo'lsa shu, bo'lmasa adminlar.
export const menejerlar = (env) => env.MANAGER_CHAT_ID ? [env.MANAGER_CHAT_ID]
  : String(env.ADMIN_TELEGRAM_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);

const T = {
  uz: {
    salom: "Assalomu alaykum! <b>Visart Design</b>ga xush kelibsiz. 👋\nArxitektura, interyer dizayn va remont (pod klyuch) — Toshkent.\n\n📷 Yoqqan interyer rasmini yuboring — uslubini aniqlab, shunga mos loyihalarimizni ko'rsataman.",
    nima: 'Nima qiziqtiradi?',
    b_narx: '💰 Narxni hisoblash', b_xiz: '🛠 Xizmatlar', b_port: '🖼 Loyihalarimiz', b_soc: '🌐 Ijtimoiy tarmoqlar',
    b_aloqa: '📞 Aloqa', b_ariza: '📝 Ariza qoldirish', b_obyekt: '📊 Mening obyektim', b_til: '🇷🇺 Русский',
    narx_yoq: "Hozir narxlarni yuklab bo'lmadi. Ariza qoldiring — menejer aniq narxni aytadi.",
    narx_q: 'Qaysi xizmat narxini hisoblaymiz?',
    s_arch: '🏛 Arxitektura loyihalash', s_int: '🛋 Interyer dizayn', s_tk: '🔨 Remont (pod klyuch)',
    q_sotix: 'Yer maydoni necha <b>sotix</b>? (raqam yozing, masalan: 6)',
    q_int: 'Interyer maydoni necha <b>m²</b>? (masalan: 85)',
    q_tk: 'Remont qilinadigan maydon necha <b>m²</b>? (masalan: 100)',
    raqam: 'Iltimos, faqat raqam yozing (masalan: 85).',
    q_qavat: 'Necha qavatli?', q_paket: 'Qaysi paket?', q_uslub: 'Uslub darajasi?',
    kiradi: 'Kiradi', usul_boshq: 'Boshqaruv', taxminiy: "Bu taxminiy narx. Aniq narx — bepul konsultatsiyada.",
    qayta: '🔁 Qayta hisoblash',
    xiz: "<b>Xizmatlarimiz</b>\n\n🏛 <b>Arxitektura loyihalash</b> — uy va binolar loyihasi, 15–25 kun\n🛋 <b>Interyer dizayn</b> — planirovka, 3D vizualizatsiya, ishchi chizmalar\n🔨 <b>Remont (pod klyuch)</b> — dizayndan topshirishgacha to'liq qurilish\n\nBatafsil — saytda:",
    xb: ['Arxitektura', 'Interyer', 'Pod klyuch'],
    soc: "Bizni kuzatib boring — yangi loyihalar va jarayonlar shu yerda 👇",
    kanal: 'Telegram kanal', sayt: 'Sayt', menejer: '💬 Menejerga yozish', aloqa: 'Aloqa', aloqa_yoq: "Aloqa ma'lumoti hozir mavjud emas.",
    ariza_bosh: 'Ariza uchun bir necha savol beraman.\n\nIsmingiz nima?',
    ism_q: "Iltimos, to'liq ismingizni yozing.", tel_q: 'Rahmat! Endi telefon raqamingizni yuboring (masalan, +998901234567).',
    tel_xato: "Telefon raqami to'g'ri formatda emas. Masalan: +998901234567", xizmat_q: 'Qaysi xizmat kerak?',
    xizmat_tugma: 'Iltimos, yuqoridagi tugmalardan birini tanlang.', maydon_q: 'Obyekt maydoni necha m²?', tanlandi: 'Tanlandi',
    maydon_xato: 'Iltimos, maydonni raqamda yuboring (m², masalan: 85).',
    qabul: (ism) => `Rahmat, ${ism}! Ma'lumotlaringiz qabul qilindi.`, tez: 'Menejerimiz tez orada siz bilan bog\'lanadi.',
    qm: "Xabaringiz menejerga yuborildi, tez orada javob beradi.",
    // lid baholash
    lq_b: 'Taxminiy byudjetingiz? (so\'m)', lq_m: 'Ishni qachon boshlashni rejalashtiryapsiz?', lq_h: 'Obyekt qayerda?',
    lq_bv: ['50 mln gacha', '50–150 mln', '150–500 mln', '500 mln dan ko\'p', 'Hali bilmayman'],
    lq_mv: ['Shu oy', '1–3 oy ichida', '3–6 oy ichida', "O'ylab ko'ryapman"],
    lq_hv: ['Toshkent', 'Toshkent viloyati', 'Boshqa hudud'],
    lq_oxir: "Rahmat! Hammasi yozib olindi — menejerimiz siz bilan tez orada bog'lanadi. 🙌",
    // follow-up
    fu1: (ism) => `Salom, ${ism}! Kecha ariza qoldirgan edingiz. Savollaringiz bormi? Loyiha va narx bo'yicha bepul konsultatsiya beramiz.`,
    fu2: (ism) => `${ism}, loyihangiz bo'yicha hali ham yordam kerakmi? Qulay vaqtda yozing yoki qo'ng'iroq qiling — mamnuniyat bilan yordam beramiz. 🙂`,
    // rasm
    foto_tahlil: '🔎 Rasmni ko\'rib chiqyapman...', foto_xato: "Rasmni tahlil qilib bo'lmadi. Boshqa rasm yuborib ko'ring yoki menejerga yozing.",
    foto_limit: "Bugungi rasm tahlili limiti tugadi. Ertaga yana urinib ko'ring yoki menejerga yozing.",
    uslub: 'Uslub', ranglar: 'Ranglar', mater: 'Materiallar', mos: 'Shu uslubdagi loyihalarimiz:', mos_yoq: 'Loyihalarimizni saytda ko\'rishingiz mumkin:',
    // obyekt
    ob_tel: "Obyektingiz holatini ko'rish uchun telefon raqamingizni tasdiqlang (pastdagi tugma).", ob_tugma: '📱 Raqamni yuborish',
    ob_topilmadi: "⚠️ Bu raqam bo'yicha obyekt topilmadi.\n\nSabablari:\n• shartnomada boshqa raqam yozilgan bo'lishi mumkin (masalan, oila a'zosi yoki ikkinchi raqamingiz)\n• raqam bazamizda hali kiritilmagan yoki xato yozilgan\n\n<b>Nima qilish kerak:</b>\n1️⃣ Pastdagi tugmani bosing — so'rov menejerga boradi va u obyektingizni ulaydi\n2️⃣ Yoki shartnomada ko'rsatilgan raqam bilan Telegram'ga kirib, shu raqamni yuboring\n\nMenejer tez orada o'zi aloqaga chiqadi. 🙏", ob_boshqa: "Bu raqam sizniki emas. Faqat o'z raqamingizni yuboring.",
    ob_tanla: 'Qaysi obyekt?', ob_holat: 'Holat', ob_tugash: 'Tugash sanasi', ob_smeta: 'Smeta', ob_tolangan: "To'langan", ob_qoldiq: 'Qoldiq',
    ob_eslatma: "Batafsil ma'lumot — mijoz ilovasida.", ob_ilova: '📱 Ilovani ochish',
  },
  ru: {
    salom: "Здравствуйте! Добро пожаловать в <b>Visart Design</b>. 👋\nАрхитектура, дизайн интерьера и ремонт под ключ — Ташкент.\n\n📷 Пришлите фото понравившегося интерьера — определю стиль и покажу наши похожие проекты.",
    nima: 'Что вас интересует?',
    b_narx: '💰 Рассчитать стоимость', b_xiz: '🛠 Услуги', b_port: '🖼 Наши проекты', b_soc: '🌐 Соцсети',
    b_aloqa: '📞 Контакты', b_ariza: '📝 Оставить заявку', b_obyekt: '📊 Мой объект', b_til: '🇺🇿 O\'zbekcha',
    narx_yoq: 'Сейчас не удалось загрузить цены. Оставьте заявку — менеджер назовёт точную стоимость.',
    narx_q: 'Для какой услуги рассчитать стоимость?',
    s_arch: '🏛 Архитектурное проектирование', s_int: '🛋 Дизайн интерьера', s_tk: '🔨 Ремонт под ключ',
    q_sotix: 'Сколько <b>соток</b> участок? (напишите число, например: 6)',
    q_int: 'Площадь интерьера в <b>м²</b>? (например: 85)',
    q_tk: 'Площадь ремонта в <b>м²</b>? (например: 100)',
    raqam: 'Пожалуйста, напишите только число (например: 85).',
    q_qavat: 'Сколько этажей?', q_paket: 'Какой пакет?', q_uslub: 'Уровень стиля?',
    kiradi: 'Входит', usul_boshq: 'Управление', taxminiy: 'Это ориентировочная цена. Точная — на бесплатной консультации.',
    qayta: '🔁 Пересчитать',
    xiz: "<b>Наши услуги</b>\n\n🏛 <b>Архитектурное проектирование</b> — проект дома и зданий, 15–25 дней\n🛋 <b>Дизайн интерьера</b> — планировка, 3D-визуализация, рабочие чертежи\n🔨 <b>Ремонт под ключ</b> — от дизайна до сдачи объекта\n\nПодробнее на сайте:",
    xb: ['Архитектура', 'Интерьер', 'Под ключ'],
    soc: 'Следите за нами — новые проекты и процесс работы здесь 👇',
    kanal: 'Telegram-канал', sayt: 'Сайт', menejer: '💬 Написать менеджеру', aloqa: 'Контакты', aloqa_yoq: 'Контакты сейчас недоступны.',
    ariza_bosh: 'Задам несколько вопросов для заявки.\n\nКак вас зовут?',
    ism_q: 'Пожалуйста, напишите полное имя.', tel_q: 'Спасибо! Теперь отправьте номер телефона (например, +998901234567).',
    tel_xato: 'Неверный формат номера. Пример: +998901234567', xizmat_q: 'Какая услуга нужна?',
    xizmat_tugma: 'Пожалуйста, выберите одну из кнопок выше.', maydon_q: 'Площадь объекта в м²?', tanlandi: 'Выбрано',
    maydon_xato: 'Пожалуйста, укажите площадь числом (м², например: 85).',
    qabul: (ism) => `Спасибо, ${ism}! Ваши данные приняты.`, tez: 'Менеджер скоро свяжется с вами.',
    qm: 'Ваше сообщение передано менеджеру, скоро ответим.',
    lq_b: 'Ориентировочный бюджет? (сум)', lq_m: 'Когда планируете начать работы?', lq_h: 'Где находится объект?',
    lq_bv: ['до 50 млн', '50–150 млн', '150–500 млн', 'более 500 млн', 'Пока не знаю'],
    lq_mv: ['В этом месяце', 'В течение 1–3 мес.', 'В течение 3–6 мес.', 'Пока думаю'],
    lq_hv: ['Ташкент', 'Ташкентская обл.', 'Другой регион'],
    lq_oxir: 'Спасибо! Всё записано — менеджер скоро свяжется с вами. 🙌',
    fu1: (ism) => `Здравствуйте, ${ism}! Вчера вы оставляли заявку. Остались вопросы? Дадим бесплатную консультацию по проекту и стоимости.`,
    fu2: (ism) => `${ism}, вам всё ещё нужна помощь с проектом? Напишите или позвоните в удобное время — будем рады помочь. 🙂`,
    foto_tahlil: '🔎 Смотрю фото...', foto_xato: 'Не удалось проанализировать фото. Пришлите другое или напишите менеджеру.',
    foto_limit: 'Лимит анализа фото на сегодня исчерпан. Попробуйте завтра или напишите менеджеру.',
    uslub: 'Стиль', ranglar: 'Цвета', mater: 'Материалы', mos: 'Наши проекты в похожем стиле:', mos_yoq: 'Наши проекты можно посмотреть на сайте:',
    ob_tel: 'Чтобы увидеть статус объекта, подтвердите номер телефона (кнопка ниже).', ob_tugma: '📱 Отправить номер',
    ob_topilmadi: '⚠️ Объект по этому номеру не найден.\n\nВозможные причины:\n• в договоре указан другой номер (например, второй или номер родственника)\n• номер ещё не внесён в базу или записан с ошибкой\n\n<b>Что делать:</b>\n1️⃣ Нажмите кнопку ниже — запрос уйдёт менеджеру, он подключит ваш объект\n2️⃣ Или отправьте номер, указанный в договоре, из Telegram с этим номером\n\nМенеджер скоро свяжется с вами. 🙏', ob_boshqa: 'Это не ваш номер. Отправьте только свой номер.',
    ob_tanla: 'Какой объект?', ob_holat: 'Статус', ob_tugash: 'Срок завершения', ob_smeta: 'Смета', ob_tolangan: 'Оплачено', ob_qoldiq: 'Остаток',
    ob_eslatma: 'Подробности — в приложении клиента.', ob_ilova: '📱 Открыть приложение',
  },
};

const ARX_UZ = "Narx turar joylar (uylar) uchun 500 m² gacha, noturar binolar uchun 300 m³ gacha bo'lgan maydonga amal qiladi. Maydon oshsa, narx loyihaga qarab alohida hisoblanadi.";
const ARX_RU = "Цена действует для жилых домов площадью до 500 м² и нежилых зданий до 300 м³. При большей площади стоимость рассчитывается индивидуально, в зависимости от проекта.";
const ARX_FEE = 6000000, ARX_MAX_RES = 500, ARX_MAX_NON = 300;
const arxKey = (v) => { const [a, b] = String(v).split('-'); return { sotix: Number(a) || 0, non: b === 'n' }; };
export const t = (til, key) => (T[til] || T.uz)[key] !== undefined ? (T[til] || T.uz)[key] : T.uz[key];
const esc = (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sumFmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const nom = (o, til) => (o && (o[til] || o.uz)) || '';

// ── profil (til, tel, lid javoblari, foto limiti) ──
export async function getProfil(env, h, chatId) {
  try {
    const r = await h.sbFetch(env, `mijoz_profil?chat_id=eq.${chatId}&select=*`);
    return (r && r[0]) || { chat_id: chatId, til: 'uz' };
  } catch (e) { return { chat_id: chatId, til: 'uz' }; }
}
export async function setProfil(env, h, chatId, patch) {
  try {
    await h.sbFetch(env, 'mijoz_profil', {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify([{ chat_id: chatId, updated_at: new Date().toISOString(), ...patch }]),
    });
  } catch (e) { /* jadval yo'q -- jim */ }
}

async function saytMalumot() {
  try {
    const res = await fetch(`${SAYT}/api/content`, { signal: AbortSignal.timeout(6000) });
    const d = await res.json();
    return d && d.ok ? d : null;
  } catch (e) { return null; }
}
const havola = (v, baza) => { v = String(v || '').trim(); if (!v) return null; return /^https?:\/\//i.test(v) ? v : baza + v.replace(/^@/, ''); };

// ── MENYU ──
function menyuKb(til) {
  return { inline_keyboard: [
    [{ text: t(til, 'b_narx'), callback_data: 'menu:narx' }, { text: t(til, 'b_xiz'), callback_data: 'menu:xiz' }],
    [{ text: t(til, 'b_port'), url: til === 'ru' ? `${SAYT}/ru/#projects` : `${SAYT}/#projects` }, { text: t(til, 'b_soc'), callback_data: 'menu:soc' }],
    [{ text: t(til, 'b_aloqa'), callback_data: 'menu:aloqa' }, { text: t(til, 'b_ariza'), callback_data: 'menu:ariza' }],
    [{ text: t(til, 'b_obyekt'), callback_data: 'menu:obyekt' }, { text: t(til, 'b_til'), callback_data: 'menu:til' }],
  ] };
}

export async function menyuKorsat(env, h, chatId, salom) {
  const p = await getProfil(env, h, chatId);
  await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, (salom ? t(p.til, 'salom') + '\n\n' : '') + t(p.til, 'nima'), menyuKb(p.til));
}

export async function handleMenu(env, h, cq, data) {
  const chatId = cq.message.chat.id;
  const amal = data.split(':')[1];
  await h.answerCq(env, cq.id);
  const p = await getProfil(env, h, chatId);
  const til = p.til;
  const send = (txt, kb) => h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, txt, kb);

  if (amal === 'til') {
    const yangi = til === 'ru' ? 'uz' : 'ru';
    await setProfil(env, h, chatId, { til: yangi });
    await send(t(yangi, 'nima'), menyuKb(yangi));
  } else if (amal === 'narx') {
    const d = await saytMalumot();
    if (!d || !d.pricing || !d.pricing.architecture) {
      await send(t(til, 'narx_yoq'), { inline_keyboard: [[{ text: t(til, 'b_ariza'), callback_data: 'menu:ariza' }]] });
      return;
    }
    await send(t(til, 'narx_q'), { inline_keyboard: [
      [{ text: t(til, 's_arch'), callback_data: 'nx:arch' }],
      [{ text: t(til, 's_int'), callback_data: 'nx:int' }],
      [{ text: t(til, 's_tk'), callback_data: 'nx:tk' }],
    ] });
  } else if (amal === 'xiz') {
    const xb = t(til, 'xb'); const ru = til === 'ru';
    const u = (uz, rr) => ru ? `${SAYT}/ru/uslugi/${rr}` : `${SAYT}/xizmatlar/${uz}`;
    await send(t(til, 'xiz'), { inline_keyboard: [
      [{ text: xb[0], url: u('arxitektura-loyihalash', 'arhitekturnoe-proektirovanie') }, { text: xb[1], url: u('interyer-dizayn', 'dizajn-interera') }],
      [{ text: xb[2], url: u('pod-klyuch', 'remont-pod-klyuch') }],
      [{ text: t(til, 'b_narx'), callback_data: 'menu:narx' }],
    ] });
  } else if (amal === 'soc' || amal === 'aloqa') {
    const d = await saytMalumot();
    const st = (d && d.settings) || {};
    const ig = havola(st.instagram, 'https://instagram.com/');
    const yt = havola(st.youtube, 'https://youtube.com/@');
    const tg = havola(st.telegram, 'https://t.me/');
    const tgp = havola(st.telegram_personal, 'https://t.me/');
    if (amal === 'soc') {
      const rows = [];
      if (ig) rows.push({ text: 'Instagram', url: ig });
      if (tg) rows.push({ text: t(til, 'kanal'), url: tg });
      if (yt) rows.push({ text: 'YouTube', url: yt });
      rows.push({ text: t(til, 'sayt'), url: SAYT });
      await send(t(til, 'soc'), { inline_keyboard: rows.map((b) => [b]) });
    } else {
      const adr = st.address && (st.address[til] || st.address.uz);
      const matn = [`<b>${t(til, 'aloqa')}</b>`, st.phone ? `📞 ${esc(st.phone)}` : '', st.email ? `✉️ ${esc(st.email)}` : '', adr ? `📍 ${esc(adr)}` : ''].filter(Boolean).join('\n');
      await send(matn || t(til, 'aloqa_yoq'), tgp ? { inline_keyboard: [[{ text: t(til, 'menejer'), url: tgp }]] } : undefined);
    }
  } else if (amal === 'ariza') {
    await h.upsertDialog(env, chatId, { step: 'ism', ism: null, telefon: null, xizmat_turi: null, maydon_m2: null });
    await send(t(til, 'ariza_bosh'));
  } else if (amal === 'obyekt') {
    await obyektKorsat(env, h, chatId, p);
  }
}

// ── NARX HISOBLASH (formulalar sayt kalkulyatori bilan bir xil) ──
export async function handleNarx(env, h, cq, data) {
  const chatId = cq.message.chat.id;
  const p = data.split(':');
  await h.answerCq(env, cq.id);
  const prof = await getProfil(env, h, chatId);
  const til = prof.til;
  const tg = (txt, kb) => h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, txt, kb);

  if (p[0] === 'nx') {
    const q = { arch: ['sotix', 'q_sotix'], int: ['m2int', 'q_int'], tk: ['m2tk', 'q_tk'] }[p[1]];
    if (!q) return;
    await h.upsertDialog(env, chatId, { step: `nx:${q[0]}` });
    await tg(t(til, q[1]));
    return;
  }
  const d = await saytMalumot();
  const pr = d && d.pricing;
  if (!pr || !pr.architecture) { await tg(t(til, 'narx_yoq')); return; }
  const stil = (id) => (pr.styles || []).find((x) => x.id === id) || { mult: 1, uz: 'Standart', ru: 'Стандарт' };
  const kb2 = { inline_keyboard: [[{ text: t(til, 'b_ariza'), callback_data: 'menu:ariza' }, { text: t(til, 'qayta'), callback_data: 'menu:narx' }]] };
  const nota = `\n\n<i>${t(til, 'taxminiy')}</i>`;

  const ARCH_BUNDLED = ['workDrawings', '3d', 'landscape'];
  const addonlar = ((pr.architecture && pr.architecture.addons) || []).filter((a) => !ARCH_BUNDLED.includes(a.id));
  const archNatija = async (key, floorId, styleId, mask) => {
    const { sotix, non } = arxKey(key);
    const fl = (pr.architecture.floors || []).find((f) => String(f.id) === String(floorId)) || { mult: 1, uz: floorId, ru: floorId };
    const st = stil(styleId);
    const asos = pr.architecture.ratePerSotix * sotix * st.mult * fl.mult;
    let jami = asos; const qosh = [];
    if (non) { jami += ARX_FEE; qosh.push(`• ${til === 'ru' ? 'Нежилое здание' : 'Noturar bino'}: +${sumFmt(ARX_FEE)}`); }
    addonlar.forEach((a, i) => { if (mask & (1 << i)) { jami += a.flat; qosh.push(`• ${esc(nom(a, til))}: +${sumFmt(a.flat)}`); } });
    const tl = pr.timelines && pr.timelines.architecture ? nom(pr.timelines.architecture, til) : '';
    const som = til === 'ru' ? 'сум' : "so'm";
    await tg(`🏛 <b>${t(til, 's_arch').slice(2).trim()}</b>\n${sotix} ${til === 'ru' ? 'сот.' : 'sotix'} · ${nom(fl, til)} · ${nom(st, til)}\n\n• ${til === 'ru' ? 'Проект' : 'Loyiha'}: ${sumFmt(asos)}${qosh.length ? '\n' + qosh.join('\n') : ''}\n\n💰 ~ <b>${sumFmt(jami)} ${som}</b>${tl ? `\n⏱ ${esc(tl)}` : ''}${nota}\n\n<i>${til === 'ru' ? ARX_RU : ARX_UZ}</i>`, kb2);
  };

  const addonKb = (sotix, fl, st, mask) => ({ inline_keyboard: [
    ...addonlar.map((a, i) => [{ text: `${mask & (1 << i) ? '✅' : '⬜️'} ${nom(a, til)} (+${sumFmt(a.flat)})`.slice(0, 60), callback_data: `nxa:${sotix}:${fl}:${st}:${mask}:t${i}` }]),
    [{ text: til === 'ru' ? '✅ Рассчитать' : '✅ Hisoblash', callback_data: `nxa:${sotix}:${fl}:${st}:${mask}:go` }],
  ] });

  if (p[0] === 'nxa') {                 // nxa:<sotix>:<qavat>:<uslub>:<mask>:<amal>  (amal: tN = almashtirish, go = hisoblash)
    let mask = Number(p[4]) || 0;
    if (p[5] === 'go') { await h.removeKb(env, chatId, cq.message.message_id); await archNatija(p[1], p[2], p[3], mask); return; }
    const i = Number(String(p[5]).slice(1)); if (i >= 0 && i < addonlar.length) mask ^= (1 << i);
    await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/editMessageReplyMarkup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: cq.message.message_id, reply_markup: addonKb(p[1], p[2], p[3], mask) }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => {});
    return;
  }
  if (p[0] === 'nxy') {                 // nxy:<sotix>:<r|n> — bino turi tanlandi, maydonni so'raymiz
    await h.upsertDialog(env, chatId, { step: `nx:arxm2:${p[1]}-${p[2]}` });
    const nn = p[2] === 'n';
    await tg(nn ? (til === 'ru' ? 'Какой <b>объём здания</b> (м³)? Напишите число, например: 250' : "<b>Bino hajmi</b> necha m³? (raqam yozing, masalan: 250)")
      : (til === 'ru' ? 'Какова <b>площадь здания</b> (м²)? Напишите число, например: 200' : "<b>Bino maydoni</b> necha m²? (raqam yozing, masalan: 200)"));
    return;
  }
  if (p[0] === 'nxf') {
    await tg(t(til, 'q_uslub'), { inline_keyboard: [(pr.styles || []).map((x) => ({ text: nom(x, til), callback_data: `nxs:${p[1]}:${p[2]}:${x.id}` }))] });
  } else if (p[0] === 'nxs' && addonlar.length) {
    await tg(til === 'ru' ? 'Нужны дополнительные услуги? (отметьте и нажмите «Рассчитать»)' : "Qo'shimcha xizmatlar kerakmi? (belgilab, «Hisoblash»ni bosing)", addonKb(p[1], p[2], p[3], 0));
  } else if (p[0] === 'nxs') {
    const { sotix, non } = arxKey(p[1]);
    const fl = (pr.architecture.floors || []).find((f) => String(f.id) === p[2]) || { mult: 1, uz: p[2], ru: p[2] };
    const st = stil(p[3]);
    const jami = pr.architecture.ratePerSotix * sotix * st.mult * fl.mult + (non ? ARX_FEE : 0);
    const tl = pr.timelines && pr.timelines.architecture ? nom(pr.timelines.architecture, til) : '';
    await tg(`🏛 <b>${t(til, 's_arch').slice(2).trim()}</b>\n${sotix} ${til === 'ru' ? 'сот.' : 'sotix'} · ${nom(fl, til)} · ${nom(st, til)}\n\n💰 ~ <b>${sumFmt(jami)} ${til === 'ru' ? 'сум' : "so'm"}</b>${tl ? `\n⏱ ${esc(tl)}` : ''}${nota}\n\n<i>${til === 'ru' ? ARX_RU : ARX_UZ}</i>`, kb2);
  } else if (p[0] === 'nxi') {
    const m2 = Number(p[1]);
    const pk = (pr.interior.packages || []).find((x) => x.id === p[2]);
    if (!pk) return;
    const feats = (pk.includes || []).map((f) => `• ${esc(nom(pr.interior.features && pr.interior.features[f], til) || f)}`).join('\n');
    await tg(`🛋 <b>${t(til, 's_int').slice(2).trim()} — ${esc(nom(pk, til))}</b>\n${m2} m²\n\n💰 ~ <b>${sumFmt(pk.rate * m2)} ${til === 'ru' ? 'сум' : "so'm"}</b> (${sumFmt(pk.rate)}/m²)\n\n${t(til, 'kiradi')}:\n${feats}${nota}`, kb2);
  } else if (p[0] === 'nxt') {
    const m2 = Number(p[1]);
    const st = stil(p[2]);
    const tk = pr.turnkey;
    const tier = tk.areaTiers.find((x) => m2 <= x.maxArea) || tk.areaTiers[tk.areaTiers.length - 1];
    const mg = tk.managementTiers.find((x) => m2 <= x.maxArea) || tk.managementTiers[tk.managementTiers.length - 1];
    let mn = 0, mx = 0; const qator = [];
    for (const c of tk.components) {
      const tt = tier[c.id]; if (!tt) continue;
      mn += tt.min * st.mult * m2; mx += tt.max * st.mult * m2;
      qator.push(`• ${esc(nom(c, til))}: $${Math.round(tt.min * st.mult)}–${Math.round(tt.max * st.mult)}/m²`);
    }
    mn *= 1 + mg.pct; mx *= 1 + mg.pct;
    const kurs = pr.usdRate || 12700;
    await tg(`🔨 <b>${t(til, 's_tk').slice(2).trim()}</b>\n${m2} m² · ${nom(st, til)}\n\n${qator.join('\n')}\n• ${t(til, 'usul_boshq')}: +${Math.round(mg.pct * 100)}%\n\n💰 ~ <b>$${sumFmt(mn)} – $${sumFmt(mx)}</b>\n≈ ${sumFmt(mn * kurs)} – ${sumFmt(mx * kurs)} ${til === 'ru' ? 'сум' : "so'm"}${nota}`, kb2);
  }
}

export async function narxMaydonMatn(env, h, chatId, dialog, text) {
  const prof = await getProfil(env, h, chatId);
  const til = prof.til;
  const n = parseFloat(String(text).replace(',', '.').replace(/[^\d.]/g, ''));
  const tur = dialog.step.split(':')[1];
  if (!n || n <= 0 || n > 100000) { await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'raqam')); return; }
  await h.upsertDialog(env, chatId, { step: 'menu' });
  const d = await saytMalumot();
  const pr = d && d.pricing;
  if (!pr || !pr.architecture) { await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'narx_yoq')); return; }
  const n_ = Math.round(n);
  if (tur === 'sotix') {
    await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, til === 'ru' ? 'Тип здания?' : 'Bino turi?', { inline_keyboard: [[
      { text: til === 'ru' ? '🏠 Жилой дом' : '🏠 Turar joy', callback_data: `nxy:${n_}:r` },
      { text: til === 'ru' ? '🏢 Нежилое здание' : '🏢 Noturar bino', callback_data: `nxy:${n_}:n` },
    ]] });
  } else if (tur === 'arxm2') {
    const key = dialog.step.split(':')[2] || '';
    const non = key.endsWith('-n');
    if (n_ > (non ? ARX_MAX_NON : ARX_MAX_RES)) {
      await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, til === 'ru'
        ? `📐 Для ${non ? 'нежилых зданий свыше 300 м³' : 'жилых домов свыше 500 м²'} стоимость рассчитывается отдельно, в зависимости от площади и проекта. Оставьте заявку — менеджер подготовит расчёт.`
        : `📐 ${non ? 'Noturar binolar uchun 300 m³' : 'Turar joylar uchun 500 m²'} dan oshgan hajm/maydonda narx maydoni va loyihaga qarab alohida hisoblanadi. Ariza qoldiring — menejer hisob-kitobni tayyorlaydi.`,
        { inline_keyboard: [[{ text: t(til, 'b_ariza'), callback_data: 'menu:ariza' }, { text: t(til, 'qayta'), callback_data: 'menu:narx' }]] });
    } else {
      await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'q_qavat'), { inline_keyboard: [(pr.architecture.floors || []).map((f) => ({ text: nom(f, til), callback_data: `nxf:${key}:${f.id}` }))] });
    }
  } else if (tur === 'm2int') {
    await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'q_paket'), { inline_keyboard: (pr.interior.packages || []).map((x) => [{ text: `${nom(x, til)} — ${sumFmt(x.rate)}/m²`, callback_data: `nxi:${n_}:${x.id}` }]) });
  } else {
    await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'q_uslub'), { inline_keyboard: [(pr.styles || []).map((x) => ({ text: nom(x, til), callback_data: `nxt:${n_}:${x.id}` }))] });
  }
}

// ── LID BAHOLASH: ariza tugagach 3 ta savol -> ball -> menejerga ──
export async function lidSavollarBoshla(env, h, chatId) {
  const p = await getProfil(env, h, chatId);
  const v = t(p.til, 'lq_bv');
  await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(p.til, 'lq_b'), { inline_keyboard: v.map((x, i) => [{ text: x, callback_data: `lqb:${i}` }]) });
}

export async function handleLq(env, h, cq, data) {
  const chatId = cq.message.chat.id;
  const p = data.split(':');
  await h.answerCq(env, cq.id);
  await h.removeKb(env, chatId, cq.message.message_id);
  const prof = await getProfil(env, h, chatId);
  const til = prof.til;
  if (p[0] === 'lqb') {
    await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'lq_m'), { inline_keyboard: t(til, 'lq_mv').map((x, i) => [{ text: x, callback_data: `lqm:${p[1]}:${i}` }]) });
  } else if (p[0] === 'lqm') {
    await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'lq_h'), { inline_keyboard: t(til, 'lq_hv').map((x, i) => [{ text: x, callback_data: `lqh:${p[1]}:${p[2]}:${i}` }]) });
  } else if (p[0] === 'lqh') {
    const b = Number(p[1]), m = Number(p[2]), hh = Number(p[3]);
    const dialog = await h.getDialog(env, chatId);
    let ball = [5, 15, 25, 30, 10][b] + [30, 20, 10, 0][m] + [20, 10, 0][hh];
    if (dialog && Number(dialog.maydon_m2) >= 60) ball += 10;
    if (dialog && dialog.xizmat_turi === 'turnkey') ball += 10;
    ball = Math.min(100, ball);
    const belgi = ball >= 70 ? '🔥 ISSIQ' : ball >= 40 ? '🌤 ILIQ' : '❄️ SOVUQ';
    const uz = T.uz;
    await setProfil(env, h, chatId, { byudjet: uz.lq_bv[b], muddat: uz.lq_mv[m], hudud: uz.lq_hv[hh], ball });
    await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'lq_oxir'), menyuKb(til));
    if (env.MANAGER_CHAT_ID) {
      await h.tgSend(env.MIJOZ_BOT_TOKEN, env.MANAGER_CHAT_ID,
        `📊 Lid bahosi: <b>${belgi}</b> (${ball}/100)\n👤 ${esc(dialog && dialog.ism)} · 📞 ${esc(dialog && dialog.telefon)}\n🛠 ${esc(dialog && (dialog.xizmat_label || dialog.xizmat_turi))} · ${esc(dialog && dialog.maydon_m2)} m²\n💵 ${uz.lq_bv[b]}\n🗓 ${uz.lq_mv[m]}\n📍 ${uz.lq_hv[hh]}\n💬 Chat: ${chatId}`);
    }
  }
}

// Ariza tugagach 1 va 3 kundan keyin yumshoq eslatma navbatga qo'yiladi.
export async function followUpQoy(env, h, chatId, ism, til) {
  const now = Date.now();
  const qatorlar = [[1, 24], [2, 72]].map(([n, soat]) => ({
    turi: 'lid_followup',
    payload: { chat_id: chatId, ism, til, n, yaratildi: new Date(now).toISOString() },
    nashr_vaqti: new Date(now + soat * 3600 * 1000).toISOString(),
    holat: 'kutilmoqda',
  }));
  await h.sbFetch(env, 'nashr_navbati', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(qatorlar) }).catch(() => {});
}

// ── RASM-REFERENCE: uslub tahlili (Claude vision) + mos loyihalar ──
const USLUBLAR = ['zamonaviy', 'minimalizm', 'klassik', 'neoklassik', 'skandinav', 'loft', 'hi-tech', 'art-deco', 'boshqa'];

async function tgFaylBase64(env, fileId) {
  const g = await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`, { signal: AbortSignal.timeout(10000) }).then((r) => r.json());
  const path = g && g.result && g.result.file_path;
  if (!path) throw new Error('getFile');
  const buf = new Uint8Array(await (await fetch(`https://api.telegram.org/file/bot${env.MIJOZ_BOT_TOKEN}/${path}`, { signal: AbortSignal.timeout(15000) })).arrayBuffer());
  if (buf.length > 4_500_000) throw new Error('katta');
  let bin = ''; for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
  return { b64: btoa(bin), mime: path.endsWith('.png') ? 'image/png' : 'image/jpeg' };
}

export async function handleMijozFoto(env, h, msg) {
  const chatId = msg.chat.id;
  const prof = await getProfil(env, h, chatId);
  const til = prof.til;
  const bugun = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  const son = prof.foto_kun === bugun ? (prof.foto_son || 0) : 0;
  if (son >= 5) { await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'foto_limit')); return; }
  if (!env.ANTHROPIC_API_KEY) { await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'foto_xato')); return; }
  const fileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id
    : (msg.document && (msg.document.mime_type || '').startsWith('image/') ? msg.document.file_id : null);
  if (!fileId) return;
  await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'foto_tahlil'));
  await setProfil(env, h, chatId, { foto_kun: bugun, foto_son: son + 1 });
  try {
    const img = await tgFaylBase64(env, fileId);
    const prompt = `Bu interyer/arxitektura rasmi. Quyidagini aniqla va FAQAT JSON qaytar: {"uslub": "<${USLUBLAR.join('|')}>", "ranglar": ["<2-4 asosiy rang, ${til === 'ru' ? 'rus' : "o'zbek"} tilida>"], "materiallar": ["<2-4 material, ${til === 'ru' ? 'rus' : "o'zbek"} tilida>"], "tavsif": "<1-2 qisqa gap, ${til === 'ru' ? 'rus' : "o'zbek"} tilida>"}. Rasmda interyer/arxitektura bo'lmasa uslub="boshqa".`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 500, messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: img.mime, data: img.b64 } }, { type: 'text', text: prompt }] }] }),
      signal: AbortSignal.timeout(40000),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}`);
    const data = await res.json();
    const tx = ((data.content || []).find((x) => x.type === 'text') || {}).text || '';
    const m = tx.match(/\{[\s\S]*\}/);
    const a = JSON.parse(m[0]);
    const uslub = USLUBLAR.includes(a.uslub) ? a.uslub : 'boshqa';

    // mos loyihalar
    const d = await saytMalumot();
    const loyihalar = ((d && d.projects) || []).filter((p) => p.cat === 'interior' && p.slug);
    const kalit = { zamonaviy: ['zamonaviy', 'modern', 'современ'], minimalizm: ['minimal'], klassik: ['klassik', 'классич'], neoklassik: ['neoklassik', 'неоклассик'], skandinav: ['skandinav', 'скандинав'], loft: ['loft', 'лофт'], 'hi-tech': ['hi-tech', 'хай-тек'], 'art-deco': ['art', 'арт'] }[uslub] || [];
    const mos = loyihalar.filter((p) => { const s = `${nom(p.style, 'uz')} ${nom(p.style, 'ru')}`.toLowerCase(); return kalit.some((k) => s.includes(k)); });
    const tanlangan = (mos.length ? mos : loyihalar).slice(0, 3);
    const url = (p) => til === 'ru' ? `${SAYT}/ru/proekty/${p.slugRu || p.slug}` : `${SAYT}/loyihalar/${p.slug}`;
    const rows = tanlangan.map((p) => [{ text: `🏠 ${nom(p.title, til)}`.slice(0, 60), url: url(p) }]);
    rows.push([{ text: t(til, 'b_ariza'), callback_data: 'menu:ariza' }, { text: t(til, 'b_narx'), callback_data: 'menu:narx' }]);
    const list = (x) => (Array.isArray(x) ? x : []).map(esc).join(', ');
    await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId,
      `🎨 <b>${t(til, 'uslub')}: ${esc(uslub)}</b>\n${t(til, 'ranglar')}: ${list(a.ranglar)}\n${t(til, 'mater')}: ${list(a.materiallar)}\n\n${esc(a.tavsif)}\n\n${tanlangan.length ? t(til, 'mos') : t(til, 'mos_yoq')}`,
      { inline_keyboard: rows });

    // menejerga: rasm + uslub (lid belgisi)
    for (const mid of menejerlar(env)) {
      const kim = msg.from ? `${msg.from.first_name || ''} ${msg.from.last_name || ''} ${msg.from.username ? '@' + msg.from.username : ''}`.trim() : chatId;
      await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendPhoto`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: mid, photo: fileId, caption: `📷 Mijoz reference yubordi\n👤 ${kim}\n🎨 ${uslub}; ${list(a.ranglar)}\n💬 Chat: ${chatId}`.slice(0, 1000) }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => {});
    }
  } catch (e) {
    await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'foto_xato'));
  }
}

// ── OBYEKT HOLATI (telefon orqali, Telegram tasdiqlagan kontakt bilan) ──
const raqam = (s) => String(s || '').replace(/\D/g, '');

async function obyektlarTopish(env, h, tel) {
  const last9 = raqam(tel).slice(-9);
  if (last9.length < 9) return [];
  const all = await h.sbFetch(env, 'obyektlar?select=id,nom,holat,smeta,tugash_sana,mijoz_tel,mijoz_ism&limit=1000').catch(() => []);
  return (all || []).filter((o) => raqam(o.mijoz_tel).slice(-9) === last9);
}

async function obyektMatni(env, h, o, til) {
  const tol = await h.sbFetch(env, `tolovlar?obyekt_id=eq.${encodeURIComponent(o.id)}&select=summa`).catch(() => []);
  const tolangan = (tol || []).reduce((s, x) => s + (Number(x.summa) || 0), 0);
  const smeta = Number(o.smeta) || 0;
  const som = til === 'ru' ? 'сум' : "so'm";
  return [`🏗 <b>${esc(o.nom || o.id)}</b>`, `${t(til, 'ob_holat')}: ${esc(o.holat || '—')}`,
    o.tugash_sana ? `${t(til, 'ob_tugash')}: ${esc(o.tugash_sana)}` : '',
    smeta ? `${t(til, 'ob_smeta')}: ${sumFmt(smeta)} ${som}` : '',
    `${t(til, 'ob_tolangan')}: ${sumFmt(tolangan)} ${som}`,
    smeta ? `${t(til, 'ob_qoldiq')}: ${sumFmt(Math.max(0, smeta - tolangan))} ${som}` : '',
    '', t(til, 'ob_eslatma')].filter((x) => x !== '').join('\n');
}

export async function obyektKorsat(env, h, chatId, prof) {
  const til = prof.til;
  if (!prof.tel) {
    await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'ob_tel'), {
      keyboard: [[{ text: t(til, 'ob_tugma'), request_contact: true }]], resize_keyboard: true, one_time_keyboard: true });
    return;
  }
  await obyektTelBilan(env, h, chatId, prof.tel, til);
}

export async function obyektTelBilan(env, h, chatId, tel, til) {
  const list = await obyektlarTopish(env, h, tel);
  if (!list.length) {
    await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'ob_topilmadi'),
      { inline_keyboard: [[{ text: til === 'ru' ? '🔗 У меня есть объект — отправить запрос менеджеру' : "🔗 Obyektim bor — menejerga so'rov yuborish", callback_data: 'obr' }]] });
    return;
  }
  if (list.length === 1) {
    await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, await obyektMatni(env, h, list[0], til), { inline_keyboard: [[{ text: t(til, 'ob_ilova'), url: 'https://app.visartdesign.uz' }]] });
    return;
  }
  await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(til, 'ob_tanla'), { inline_keyboard: list.slice(0, 10).map((o) => [{ text: String(o.nom || o.id).slice(0, 40), callback_data: `ob:${o.id}`.slice(0, 64) }]) });
}

export async function handleKontakt(env, h, msg) {
  const chatId = msg.chat.id;
  const prof = await getProfil(env, h, chatId);
  const c = msg.contact;
  if (!c || !msg.from || c.user_id !== msg.from.id) {   // faqat o'z raqami
    await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, t(prof.til, 'ob_boshqa'), { remove_keyboard: true });
    return;
  }
  await setProfil(env, h, chatId, { tel: raqam(c.phone_number) });
  await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, '✅', { remove_keyboard: true });
  await obyektTelBilan(env, h, chatId, c.phone_number, prof.til);
  try {   // menejerga: mijoz obyekt holatini so'radi
    const list = await obyektlarTopish(env, h, c.phone_number);
    const kim = `${msg.from.first_name || ''} ${msg.from.last_name || ''} ${msg.from.username ? '@' + msg.from.username : ''}`.trim();
    const xabar = `📊 Mijoz obyekt holatini so'radi\n\n👤 ${kim}\n📞 +${raqam(c.phone_number).replace(/^\+/, '')}\n🏗 ${list.length ? list.map((o) => o.nom || o.id).join(', ') : "obyekt topilmadi (raqam bazada yo'q)"}\n💬 <a href="tg://user?id=${chatId}">Telegramda yozish</a>`;
    for (const mid of menejerlar(env)) await h.tgSend(env.MIJOZ_BOT_TOKEN, mid, xabar).catch(() => {});
  } catch (e) { /* xabar muhim emas */ }
}

export async function handleObTanla(env, h, cq, data) {
  const chatId = cq.message.chat.id;
  await h.answerCq(env, cq.id);
  const prof = await getProfil(env, h, chatId);
  if (!prof.tel) return;
  const id = data.slice(3);
  const o = (await obyektlarTopish(env, h, prof.tel)).find((x) => String(x.id) === id);   // faqat o'z raqamiga tegishlisi
  if (!o) return;
  await h.tgSend(env.MIJOZ_BOT_TOKEN, chatId, await obyektMatni(env, h, o, prof.til), { inline_keyboard: [[{ text: t(prof.til, 'ob_ilova'), url: 'https://app.visartdesign.uz' }]] });
}
