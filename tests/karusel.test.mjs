import test from 'node:test'; import assert from 'node:assert/strict';
import { slotRoyxati, nashrVaqtiTanla, toshVaqt } from '../functions/_lib/karusel.js';
const T = (s) => Date.parse(s); // ISO UTC
test('slotlar: chorshanba 19:30 va shanba 11:00 (Toshkent)', () => {
  // seshanba 2026-11-17 21:49 Toshkent = 16:49Z
  const r = slotRoyxati(T('2026-11-17T16:49:00Z')).slice(0, 3).map(toshVaqt);
  assert.deepEqual(r, ['18.11 19:30', '21.11 11:00', '25.11 19:30']);
});
test('reja vaqti kelmagan bo\'lsa saqlanadi', () => {
  const reja = T('2026-11-21T06:00:00Z'); // 21.11 11:00
  assert.equal(nashrVaqtiTanla(reja, T('2026-11-19T05:00:00Z'), []), reja);
});
test('o\'tib ketgan reja -- keyingi slot', () => {
  const reja = T('2026-11-18T14:30:00Z'); // chorshanba 19:30
  const v = nashrVaqtiTanla(reja, T('2026-11-18T16:00:00Z'), []);
  assert.equal(toshVaqt(v), '21.11 11:00');
});
test('band slot (id=399 kabi) o\'tkazib yuboriladi', () => {
  const band = [T('2026-11-18T14:30:00Z')];
  const v = nashrVaqtiTanla(T('2026-11-18T14:30:00Z'), T('2026-11-17T16:00:00Z'), band);
  assert.equal(toshVaqt(v), '21.11 11:00');
});
