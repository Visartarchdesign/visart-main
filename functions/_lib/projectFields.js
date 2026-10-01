// Loyiha jadvalidagi tahrirlanadigan ustunlar — bitta joyda saqlanadi.
export const TEXT_FIELDS = [
  'category', 'status', 'title_uz', 'title_ru', 'type_uz', 'type_ru', 'desc_uz', 'desc_ru',
  'thumb_url', 'hero_url', 'location_uz', 'location_ru', 'duration_uz', 'duration_ru',
  'style_uz', 'style_ru', 'task_uz', 'task_ru',
];
// alts_json: {"rasm-url": {"uz": "...", "ru": "..."}} — har bir rasm uchun alt-matn

export const INT_FIELDS = ['sort_order', 'area_m2', 'year'];

function toInt(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

// body'dagi qiymatlarni tozalaydi; body'da yo'q maydon uchun `existing` qiymati saqlanadi.
export function buildValues(body, existing = {}) {
  const out = {};
  for (const f of TEXT_FIELDS) {
    const v = body[f] !== undefined ? body[f] : existing[f];
    out[f] = v === undefined || v === null ? '' : String(v).trim();
  }
  for (const f of INT_FIELDS) {
    out[f] = body[f] !== undefined ? toInt(body[f]) : (existing[f] ?? null);
  }
  if (out.sort_order === null) out.sort_order = 0;
  // alts_json ustuni faqat migratsiya qilingan bazada bor — shuning uchun faqat kerak bo'lganda yozamiz.
  if (body.alts !== undefined || existing.alts_json !== undefined) {
    let a = body.alts;
    if (a === undefined) { try { a = JSON.parse(existing.alts_json || '{}'); } catch (e) { a = {}; } }
    out.alts_json = JSON.stringify(a && typeof a === 'object' && !Array.isArray(a) ? a : {});
  }
  const g = body.gallery_urls !== undefined ? body.gallery_urls : JSON.parse(existing.gallery_urls || '[]');
  out.gallery_urls = JSON.stringify(Array.isArray(g) ? g : []);
  return out;
}
