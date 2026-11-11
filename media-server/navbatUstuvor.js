// Nashr navbati ustuvorligi: jonli (Doston o'zi olgan) -> portfolio (tayyor ish tahlili) -> animatsion. Bir xil darajada mavjud tartib saqlanadi.
export const USTUVOR = { jonli: 0, portfolio: 1, boshqa: 1, animatsion: 2 };
export function ustuvorTartib(items) {
  return items.map((it, i) => ({ it, i, u: USTUVOR[(it.ig.payload || {}).manba] ?? 1 })).sort((a, b) => a.u - b.u || a.i - b.i).map((x) => x.it);
}
