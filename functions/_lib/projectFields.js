// Loyiha jadvalidagi tahrirlanadigan ustunlar — bitta joyda saqlanadi.
export const TEXT_FIELDS = [
  'category', 'status', 'title_uz', 'title_ru', 'type_uz', 'type_ru', 'desc_uz', 'desc_ru',
  'thumb_url', 'hero_url', 'location_uz', 'location_ru', 'duration_uz', 'duration_ru',
  'style_uz', 'style_ru', 'task_uz', 'task_ru',
];
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
  const g = body.gallery_urls !== undefined ? body.gallery_urls : JSON.parse(existing.gallery_urls || '[]');
  out.gallery_urls = JSON.stringify(Array.isArray(g) ? g : []);
  return out;
}
