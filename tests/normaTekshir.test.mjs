import test from 'node:test'; import assert from 'node:assert/strict';
import { tekshir } from '../functions/_lib/normaTekshir.js';
const Q = (o) => ({ id: 1, tasdiqlangan: true, jiddiylik: 'xato', band: 'b1', ...o });
test('>= otdi va xato', () => {
  const q = [Q({ parametr: 'zina_eni', operator: '>=', qiymat_min: 900, birlik: 'mm' })];
  assert.equal(tekshir(q, [{ parametr: 'zina_eni', qiymat: 1000 }])[0].natija, 'otdi');
  assert.equal(tekshir(q, [{ parametr: 'zina_eni', qiymat: 800 }])[0].natija, 'xato');
});
test('between', () => {
  const q = [Q({ parametr: 'x', operator: 'between', qiymat_min: 10, qiymat_max: 20 })];
  assert.equal(tekshir(q, [{ parametr: 'x', qiymat: 15 }])[0].natija, 'otdi');
  assert.equal(tekshir(q, [{ parametr: 'x', qiymat: 25 }])[0].natija, 'xato');
});
test('tasdiqlanmagan va rad etilgan qoida ishlatilmaydi', () => {
  assert.equal(tekshir([Q({ parametr: 'x', operator: '>=', qiymat_min: 1, tasdiqlangan: false })], [{ parametr: 'x', qiymat: 0 }]).length, 0);
  assert.equal(tekshir([Q({ parametr: 'x', operator: '>=', qiymat_min: 1, rad_etilgan: true })], [{ parametr: 'x', qiymat: 0 }]).length, 0);
});
test('tavsiya -> ogohlantirish; xona turi mos kelmasa o\'tkaziladi', () => {
  const q = [Q({ parametr: 'm', operator: '>=', qiymat_min: 14, jiddiylik: 'tavsiya', xona_turi: 'yotoqxona' })];
  assert.equal(tekshir(q, [{ parametr: 'm', qiymat: 10, xona_turi: 'yotoqxona' }])[0].natija, 'ogohlantirish');
  assert.equal(tekshir(q, [{ parametr: 'm', qiymat: 10, xona_turi: 'oshxona' }]).length, 0);
});
