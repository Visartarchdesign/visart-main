// Loyiha URL manzillari (slug) uchun yordamchi funksiyalar.
// UZ — lotin alifbosida, SEO uchun qulay so'zlar bilan.
// RU — kirill alifbosida (rus tilida qidiruvda yaxshi ko'rinishi uchun).

export function slugifyUz(str) {
  if (!str) return '';
  let s = String(str).toLowerCase();
  // oʻ, gʻ va turli apostrof belgilarini olib tashlaymiz (oʻ->o, gʻ->g)
  s = s.replace(/[ʻʼ''`´’]/g, '');
  s = s.replace(/[^a-z0-9]+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  return s;
}

export function slugifyRu(str) {
  if (!str) return '';
  let s = String(str).toLowerCase();
  s = s.replace(/[^a-zа-яё0-9]+/gi, '-');
  s = s.replace(/^-+|-+$/g, '');
  return s;
}

// Bazadagi mavjud slug'lar bilan to'qnashmasligini ta'minlaydi.
// column — 'slug' yoki 'slug_ru' (kod ichida qat'iy belgilangan, foydalanuvchi kiritmaydi).
export async function ensureUniqueSlug(env, base, column, excludeId) {
  const safeBase = base || (column === 'slug_ru' ? 'proekt' : 'loyiha');
  let candidate = safeBase;
  let n = 1;
  while (true) {
    const query = excludeId
      ? `SELECT id FROM projects WHERE ${column} = ? AND id != ?`
      : `SELECT id FROM projects WHERE ${column} = ?`;
    const stmt = excludeId
      ? env.DB.prepare(query).bind(candidate, excludeId)
      : env.DB.prepare(query).bind(candidate);
    const row = await stmt.first();
    if (!row) return candidate;
    n += 1;
    candidate = `${safeBase}-${n}`;
  }
}
