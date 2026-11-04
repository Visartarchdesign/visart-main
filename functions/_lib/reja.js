// Nashr jadvali (Toshkent, UTC+5): Telegram /reja orqali boshqariladi. Bazada bitta qator: nashr_navbati turi='nashr_reja'.
// Format: { reel: {"2":[20,0],...}, post: {"1":[19,30],...}, story: [[9,0],[13,30],[21,0]] }  (kalit = hafta kuni, 0=Yak)
export const REJA_DEFAULT = {
  reel: { 2: [20, 0], 4: [20, 30], 6: [20, 0], 0: [20, 30] },
  post: { 1: [19, 30], 3: [19, 30], 5: [14, 0] },
  story: [[9, 0], [13, 30], [21, 0]],
};
const KUN = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Juma', 'Shan'], TARTIB = [1, 2, 3, 4, 5, 6, 0];
const TUR = { reel: '🎬 Reels', post: '🖼 Rasm/karusel', story: '📱 Story' };
const SOATLAR = ['09:00', '12:00', '13:30', '14:00', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];
const p2 = (n) => String(n).padStart(2, '0'), hm = (v) => `${p2(v[0])}:${p2(v[1])}`;

export async function rejaOl(sb) {
  const r = await sb('nashr_navbati?turi=eq.nashr_reja&select=id,payload&limit=1').catch(() => null);
  const p = r && r[0] && r[0].payload;
  return { id: r && r[0] ? r[0].id : null, reja: { reel: (p && p.reel) || REJA_DEFAULT.reel, post: (p && p.post) || REJA_DEFAULT.post, story: (p && p.story) || REJA_DEFAULT.story } };
}
export async function rejaSaqla(sb, id, reja) {
  if (id) return sb(`nashr_navbati?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ payload: reja }) });
  return sb('nashr_navbati', { method: 'POST', body: JSON.stringify([{ turi: 'nashr_reja', holat: 'reja', nashr_vaqti: new Date().toISOString(), payload: reja }]) });
}
// reja[tur] ({kun:[s,d]}) -> keyingiSlot() uchun
export const kunVaqt = (reja, tur) => reja[tur] || {};

export function rejaMatn(reja) {
  const kun = (t) => TARTIB.filter((d) => reja[t][d]).map((d) => `${KUN[d]} ${hm(reja[t][d])}`).join(', ') || '—';
  return `🗓 <b>Nashr jadvali</b> (Toshkent)\n\n${TUR.reel}: ${kun('reel')}\n${TUR.post}: ${kun('post')}\n${TUR.story}: ${reja.story.map(hm).join(', ') || '—'} (har kuni)\n\nO'zgartirish uchun tur tanlang. Telegram video = Reels +30 daqiqa.`;
}
export const rejaTugma = () => ({ inline_keyboard: [[{ text: TUR.reel, callback_data: 'rj:t:reel' }, { text: TUR.post, callback_data: 'rj:t:post' }, { text: TUR.story, callback_data: 'rj:t:story' }]] });

const kunTugma = (reja, tur) => ({ inline_keyboard: [
  ...[TARTIB.slice(0, 4), TARTIB.slice(4)].map((qator) => qator.map((d) => ({ text: reja[tur][d] ? `✅ ${KUN[d]} ${hm(reja[tur][d])}` : `⬜️ ${KUN[d]}`, callback_data: `rj:k:${tur}:${d}` }))),
  [{ text: '⬅️ Orqaga', callback_data: 'rj:b' }]] });
const soatTugma = (tur, d, joriy) => {
  const q = []; for (let i = 0; i < SOATLAR.length; i += 3) q.push(SOATLAR.slice(i, i + 3).map((s) => ({ text: (joriy && hm(joriy) === s ? '✅ ' : '') + s, callback_data: `rj:s:${tur}:${d}:${s.replace(':', '')}` })));
  q.push([{ text: "🚫 Bu kunni o'chirish", callback_data: `rj:s:${tur}:${d}:off` }, { text: '⬅️ Orqaga', callback_data: `rj:t:${tur}` }]);
  return { inline_keyboard: q };
};
const storyTugma = (reja) => ({ inline_keyboard: [
  reja.story.map((v, i) => ({ text: `❌ ${hm(v)}`, callback_data: `rj:sr:${i}` })),
  ...[SOATLAR.slice(0, 5), SOATLAR.slice(5)].map((qq) => qq.map((s) => ({ text: `➕ ${s}`, callback_data: `rj:sa:${s.replace(':', '')}` }))),
  [{ text: '⬅️ Orqaga', callback_data: 'rj:b' }]] });

// rj:* tugmalari. tg(method, body) -> Telegram API. Faqat admin chaqiradi.
export async function rejaTugmaBajar({ sb, tg, data, chatId, mid, cqId }) {
  const a = data.split(':'), op = a[1];
  const javob = (text) => tg('answerCallbackQuery', { callback_query_id: cqId, text: text || '' });
  const edit = (text, kb) => tg('editMessageText', { chat_id: chatId, message_id: mid, text, parse_mode: 'HTML', reply_markup: kb });
  let { id, reja } = await rejaOl(sb);
  const bosh = () => edit(rejaMatn(reja), rejaTugma());
  const turKorsat = (tur) => tur === 'story'
    ? edit(`${TUR.story}\nHar kuni shu vaqtlarda. ❌ bosib olib tashlang, ➕ bosib qo'shing.`, storyTugma(reja))
    : edit(`${TUR[tur]}\nKunni tanlang (✅ = ishlaydi), keyin soatni.`, kunTugma(reja, tur));
  if (op === 'b') { await javob(); return bosh(); }
  if (op === 't') { await javob(); return turKorsat(a[2]); }
  if (op === 'k') { await javob(); return edit(`${TUR[a[2]]} — ${KUN[a[3]]}: soatni tanlang`, soatTugma(a[2], a[3], reja[a[2]][a[3]])); }
  if (op === 's') {
    const [, , tur, d, s] = a;
    if (s === 'off') delete reja[tur][d]; else reja[tur][d] = [Number(s.slice(0, 2)), Number(s.slice(2))];
    await rejaSaqla(sb, id, reja); await javob(s === 'off' ? "O'chirildi" : 'Saqlandi'); return turKorsat(tur);
  }
  if (op === 'sr') { reja.story.splice(Number(a[2]), 1); await rejaSaqla(sb, id, reja); await javob("Olib tashlandi"); return turKorsat('story'); }
  if (op === 'sa') {
    const v = [Number(a[2].slice(0, 2)), Number(a[2].slice(2))];
    if (!reja.story.some((x) => x[0] === v[0] && x[1] === v[1])) reja.story.push(v);
    reja.story.sort((x, y) => x[0] * 60 + x[1] - (y[0] * 60 + y[1]));
    await rejaSaqla(sb, id, reja); await javob("Qo'shildi"); return turKorsat('story');
  }
  return javob();
}
