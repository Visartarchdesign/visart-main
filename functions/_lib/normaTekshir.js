// Reja qiymatlarini TASDIQLANGAN norma qoidalari bilan solishtiradi (sof funksiya, tarmoqsiz).
// qoidalar: norma_qoidalari qatorlari; olchovlar: [{ parametr, xona_turi?, qiymat, nom? }]
// Natija: [{ qoida_id, parametr, xona_turi, topilgan, natija: 'otdi'|'xato'|'ogohlantirish', izoh }]
export function qoidaBajarilganmi(q, v) {
  const mi = q.qiymat_min != null ? Number(q.qiymat_min) : null;
  const ma = q.qiymat_max != null ? Number(q.qiymat_max) : null;
  switch (q.operator) {
    case '>=': return v >= (mi != null ? mi : ma);
    case '<=': return v <= (ma != null ? ma : mi);
    case '=': return v === (mi != null ? mi : ma);
    case 'between': return v >= mi && v <= ma;
    case 'bor': return v != null && v !== 0;
    case 'yoq': return v == null || v === 0;
    default: return true;
  }
}
const JIDDIY = { xato: 'xato', ogohlantirish: 'ogohlantirish', tavsiya: 'ogohlantirish' };
export function tekshir(qoidalar, olchovlar) {
  const nat = [];
  for (const o of olchovlar) {
    for (const q of qoidalar) {
      if (!q.tasdiqlangan || q.rad_etilgan) continue;                    // faqat tasdiqlangan qoidalar
      if (q.parametr !== o.parametr) continue;
      if (q.xona_turi && o.xona_turi && q.xona_turi !== o.xona_turi) continue;
      if (q.operator === '=' && q.qiymat_min == null && q.qiymat_max == null) continue; // qiymatsiz ma'lumot qoidasi
      const ok = qoidaBajarilganmi(q, Number(o.qiymat));
      nat.push({ qoida_id: q.id, parametr: q.parametr, xona_turi: q.xona_turi || o.xona_turi || null, topilgan: o.qiymat,
        natija: ok ? 'otdi' : (JIDDIY[q.jiddiylik] || 'xato'), izoh: ok ? null : `${o.nom || q.parametr}: ${o.qiymat} ${q.birlik || ''} — talab: ${q.operator} ${q.qiymat_min ?? ''}${q.operator === 'between' ? '…' + q.qiymat_max : ''}${q.qiymat_min == null && q.operator !== 'between' ? q.qiymat_max : ''} (${q.band || ''})` });
    }
  }
  return nat;
}
