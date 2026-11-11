import test from 'node:test'; import assert from 'node:assert/strict';
import { navbatdagiBosqich, oyna, ball, guruhla, kun } from '../functions/_lib/analitika.js';
import { isoSoniya } from '../media-server/ytAnalitika.js';
const H = 3600e3, t0 = Date.UTC(2026, 10, 1, 15, 0);
test('bosqich: yosh yetmasa null', () => assert.equal(navbatdagiBosqich(t0, [], t0 + 10 * H), null));
test('bosqich: 24 soatdan keyin 24', () => assert.equal(navbatdagiBosqich(t0, [], t0 + 30 * H), 24));
test('bosqich: kech qolgan bo\'lsa eng kattasi', () => assert.equal(navbatdagiBosqich(t0, [], t0 + 200 * H), 168));
test('bosqich: olingani qaytarilmaydi', () => assert.equal(navbatdagiBosqich(t0, [24, 72], t0 + 80 * H), null));
test('oyna: Toshkent vaqti', () => { assert.equal(oyna(t0), 'kechqurun (16-21)'); assert.equal(oyna(Date.UTC(2026, 10, 1, 17)), 'kech (21-06)'); assert.equal(oyna(Date.UTC(2026, 10, 1, 9)), 'tush (11-16)'); });
test('kun: Toshkent bo\'yicha', () => assert.equal(kun(Date.UTC(2026, 10, 1, 20)), 'Du'));
test('ball: reach 0 -> 0', () => assert.equal(ball({ saved: 5 }), 0));
test('ball: 1000 qamrovga', () => assert.equal(ball({ reach: 2000, saved: 6, shares: 4 }), 5));
test('guruhla: o\'rtacha va tartib', () => {
  const g = guruhla([{ m: { reach: 1000, saved: 10 } }, { m: { reach: 1000, saved: 0 } }, { m: { reach: 500, shares: 10 } }], (r) => (r.m.shares ? 'b' : 'a'));
  assert.equal(g[0].kalit, 'b'); assert.equal(g[1].n, 2); assert.equal(g[1].ball, 5);
});
test('isoSoniya', () => { assert.equal(isoSoniya('PT1M5S'), 65); assert.equal(isoSoniya('PT1H'), 3600); assert.equal(isoSoniya(''), 0); });
