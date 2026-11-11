import test from 'node:test'; import assert from 'node:assert/strict';
import { ustuvorTartib } from '../media-server/navbatUstuvor.js';
test('ustuvorlik: jonli > portfolio > animatsion, ichki tartib saqlanadi', () => {
  const it = (m, n) => ({ ig: { payload: { manba: m, n } } });
  const r = ustuvorTartib([it('animatsion', 1), it('portfolio', 2), it('jonli', 3), it(undefined, 4), it('jonli', 5)]).map((x) => x.ig.payload.n);
  assert.deepEqual(r, [3, 5, 2, 4, 1]);
});
