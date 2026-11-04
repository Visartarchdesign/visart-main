// Instagram Reels navbati: ko'rish va tartibni o'zgartirish (Telegram admin tugmalari). Slotlar media-server `IG_REJA` bilan bir xil.
import { rejaOl } from './reja.js';
const IG_REJA = { 2: [20, 0], 4: [20, 30], 6: [20, 0], 0: [20, 30] };   // zaxira (bazada reja bo'lmasa); asl manba: /reja
const TOSH = 5 * 3600e3, KUN = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Juma', 'Shan'];
const p2 = (n) => String(n).padStart(2, '0');
export const fmt = (d) => { const t = new Date(new Date(d).getTime() + TOSH); return `${KUN[t.getUTCDay()]} ${p2(t.getUTCDate())}.${p2(t.getUTCMonth() + 1)} ${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())}`; };
export function keyingiSlot(dan, reja = IG_REJA) {
  for (let i = 0; i < 15; i++) {
    const t = new Date(dan.getTime() + TOSH); t.setUTCDate(t.getUTCDate() + i);
    const v = reja[t.getUTCDay()]; if (!v) continue;
    t.setUTCHours(v[0], v[1], 0, 0);
    const utc = new Date(t.getTime() - TOSH); if (utc > dan) return utc;
  }
  return new Date(dan.getTime() + 24 * 3600e3);
}
// sb(path, init) -> JSON (mijoz-bot sbFetch)
export async function navbatOl(sb) {
  const rows = (await sb('nashr_navbati?turi=eq.video_ig_tg&holat=eq.kutilmoqda&select=id,nashr_vaqti,payload&order=nashr_vaqti.asc&limit=15')) || [];
  const tgBy = new Map(), igs = [];
  for (const r of rows) { const q = r.payload || {}; if (q.qism === 'tg') tgBy.set(q.video_url, r); else igs.push(r); }
  return igs.map((ig) => ({ ig, tg: tgBy.get((ig.payload || {}).video_url) || null }));
}
const patch = (sb, id, body) => sb(`nashr_navbati?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export async function qaytaSlotla(sb, items) {      // tartib bo'yicha ketma-ket IG slotlar, Telegram = +30 daq
  let prev = new Date(Date.now() + 30 * 60e3);
  const { reja } = await rejaOl(sb);   // /reja da sozlangan Reels slotlari
  for (const it of items) {
    const t = keyingiSlot(prev, reja.reel); prev = t; it.ig.nashr_vaqti = t.toISOString();
    await patch(sb, it.ig.id, { nashr_vaqti: t.toISOString() });
    if (it.tg) await patch(sb, it.tg.id, { nashr_vaqti: new Date(t.getTime() + 30 * 60e3).toISOString() });
  }
}
const sarl = (it) => String((it.ig.payload || {}).sarlavha || 'video').slice(0, 40).replace(/[<>&]/g, '');
export const navbatMatn = (items) => items.length
  ? '🗓 Instagram Reels navbati (Toshkent):\n\n' + items.map((it, i) => `${i + 1}. ${fmt(it.ig.nashr_vaqti)} — ${sarl(it)}`).join('\n') + '\n\nTelegram kanal: har Reels +30 daqiqa.'
  : "📭 Navbat bo'sh.";
export const navbatTugma = (items) => ({ inline_keyboard: items.map((it, i) => [
  { text: `${i + 1}`, callback_data: 'nv:x' }, { text: '⬆', callback_data: `nv:up:${it.ig.id}` }, { text: '⬇', callback_data: `nv:dn:${it.ig.id}` },
  { text: '🔢 O‘rin', callback_data: `nv:mv:${it.ig.id}` }, { text: '❌', callback_data: `nv:rm:${it.ig.id}` }]) });
export function orinTugma(prefix, n) {      // 1..n raqam tugmalari
  const qat = []; let r = [];
  for (let i = 1; i <= n; i++) { r.push({ text: String(i), callback_data: `${prefix}${i}` }); if (r.length === 5) { qat.push(r); r = []; } }
  if (r.length) qat.push(r);
  return { inline_keyboard: qat };
}
// nv:* tugmalari. tg(method, body) -> Telegram API. Qaytaradi: nima bo'lganini matn bilan.
export async function navbatTugmaBajar({ sb, tg, data, chatId, mid, cqId }) {
  const a = data.split(':'), op = a[1], id = a[2];
  const javob = (text) => tg('answerCallbackQuery', { callback_query_id: cqId, text: text || '' });
  const korsat = async () => { const it = await navbatOl(sb); await tg('editMessageText', { chat_id: chatId, message_id: mid, text: navbatMatn(it), reply_markup: navbatTugma(it) }); };
  if (op === 'x') return javob();
  const items = await navbatOl(sb); const i = items.findIndex((it) => it.ig.id === id);
  if (op === 'up' || op === 'dn') {
    const j = op === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= items.length) return javob('Bu yerda ko‘chirib bo‘lmaydi');
    [items[i], items[j]] = [items[j], items[i]]; await qaytaSlotla(sb, items); await javob('Ko‘chirildi'); return korsat();
  }
  if (op === 'mv') { await javob(); return tg('editMessageReplyMarkup', { chat_id: chatId, message_id: mid, reply_markup: orinTugma(`nv:to:${id}:`, items.length) }); }
  if (op === 'to') {
    if (i < 0) return javob('Topilmadi');
    const [it] = items.splice(i, 1); items.splice(Math.min(Number(a[3]), items.length + 1) - 1, 0, it);
    await qaytaSlotla(sb, items); await javob(`${a[3]}-o‘rin`); return korsat();
  }
  if (op === 'rm') { await javob(); return tg('editMessageReplyMarkup', { chat_id: chatId, message_id: mid, reply_markup: { inline_keyboard: [[{ text: '✅ Ha, olib tashla', callback_data: `nv:rmy:${id}` }, { text: 'Yo‘q', callback_data: 'nv:cancel' }]] } }); }
  if (op === 'cancel') { await javob(); return korsat(); }
  if (op === 'rmy') {
    if (i >= 0) { await patch(sb, items[i].ig.id, { holat: 'bekor' }); if (items[i].tg) await patch(sb, items[i].tg.id, { holat: 'bekor' }); items.splice(i, 1); await qaytaSlotla(sb, items); }
    await javob('Olib tashlandi'); return korsat();
  }
}
