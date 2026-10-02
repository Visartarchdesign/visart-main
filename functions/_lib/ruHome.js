// Bosh sahifaning ruscha versiyasi (/ru/) — o'sha index.html serverda ruschaga o'giriladi:
// <html lang="ru">, ruscha title/description, canonical /ru/, ruscha matnlar faol holatda.
// Shunda Google va Yandex ruscha sahifani alohida, to'liq ruscha ko'radi.

export const RU_SEO = {
  title: 'Visart Design — архитектура и дизайн интерьера в Ташкенте',
  description: 'Visart Design — архитектурное проектирование, дизайн интерьера и авторский надзор в Ташкенте. От чертежа до сдачи объекта — одна команда. Бесплатная консультация.',
  ogTitle: 'Visart Design — архитектура и дизайн интерьера',
  ogDescription: 'Архитектура, дизайн интерьера и авторский надзор в Ташкенте — от чертежа до сдачи объекта одной командой.',
  heroAlt: 'Visart Design — современный дизайн интерьера, Ташкент',
  aboutAlt: 'Visart Design — проект дизайна интерьера, Ташкент',
};
const BASE = 'https://visartdesign.uz';

const Attr = (name, value) => ({ element(el) { el.setAttribute(name, value); } });
const Text = (text) => ({ element(el) { el.setInnerContent(text, { html: false }); } });
const classToggle = (on) => ({
  element(el) {
    const cls = (el.getAttribute('class') || '').split(/\s+/).filter((c) => c && c !== 'lang-active' && c !== 'active');
    const isBtn = el.getAttribute('data-setlang') !== null;
    if (on) cls.push(isBtn ? 'active' : 'lang-active');
    if (cls.length) el.setAttribute('class', cls.join(' ')); else el.removeAttribute('class');
  },
});

export function toRussianHome(response) {
  const headers = new Headers(response.headers);
  headers.set('Content-Language', 'ru');
  const res = new Response(response.body, { status: 200, headers });
  return new HTMLRewriter()
    .on('html', Attr('lang', 'ru'))
    .on('title', Text(RU_SEO.title))
    .on('meta[name="description"]', Attr('content', RU_SEO.description))
    .on('meta[property="og:title"]', Attr('content', RU_SEO.ogTitle))
    .on('meta[name="twitter:title"]', Attr('content', RU_SEO.ogTitle))
    .on('meta[property="og:description"]', Attr('content', RU_SEO.ogDescription))
    .on('meta[name="twitter:description"]', Attr('content', RU_SEO.ogDescription))
    .on('meta[property="og:image:alt"]', Attr('content', RU_SEO.ogTitle))
    .on('meta[property="og:url"]', Attr('content', `${BASE}/ru/`))
    .on('meta[property="og:locale"]', Attr('content', 'ru_RU'))
    .on('link[rel="canonical"]', Attr('href', `${BASE}/ru/`))
    .on('#heroImg', Attr('alt', RU_SEO.heroAlt))
    .on('#aboutImg', Attr('alt', RU_SEO.aboutAlt))
    .on('[data-lang="uz"]', classToggle(false))
    .on('[data-lang="ru"]', classToggle(true))
    .on('[data-setlang="uz"]', classToggle(false))
    .on('[data-setlang="ru"]', classToggle(true))
    .transform(res);
}
