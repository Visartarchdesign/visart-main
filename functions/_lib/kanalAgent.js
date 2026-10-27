// Kanal agenti: Telegram kanalni tekshiradi, SMM+SEO+marketing "kengashi" (Claude) maslahati bilan tavsif/pin/logo taklif qiladi,
// egasi tasdiqlagach qo'llaydi. Saqlash: nashr_navbati turi=kanal_taklif (holat kutilmoqda|qollandi|rad).
const q = async (env, path, init = {}) => {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`sb ${r.status}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
};
const tg = async (env, method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(15000) });
  const d = await r.json().catch(() => ({})); return d;
};
const adminId = (env) => String(env.ADMIN_TELEGRAM_IDS || '').split(',')[0].trim();
const LOGO_URL = 'https://visartdesign.uz/assets/kanal-logo.png';

export async function kanalHolat(env) {
  const ch = env.TELEGRAM_CHANNEL_ID; if (!ch) return { xato: 'TELEGRAM_CHANNEL_ID sozlanmagan' };
  const [c, n, me] = await Promise.all([tg(env, 'getChat', { chat_id: ch }), tg(env, 'getChatMemberCount', { chat_id: ch }), tg(env, 'getMe')]);
  if (!c.ok) return { xato: `getChat: ${c.description || 'xato'}` };
  const m = await tg(env, 'getChatMember', { chat_id: ch, user_id: me.result && me.result.id });
  const r = (m.result) || {}, x = c.result;
  return {
    nom: x.title, username: x.username || null, tavsif: x.description || '', rasm: !!x.photo, pin: (x.pinned_message && (x.pinned_message.text || x.pinned_message.caption || '').slice(0, 300)) || null,
    obunachi: n.ok ? n.result : null, botAdmin: r.status === 'administrator' || r.status === 'creator',
    huquq: { info: !!r.can_change_info, pin: !!r.can_pin_messages, post: !!r.can_post_messages },
  };
}

async function kengash(env, h) {
  const prompt = `Siz Visart Design (Toshkent, arxitektura/interyer dizayn va ta'mirlash studiyasi; sayt visartdesign.uz; mijoz boti @visart_design_bot) Telegram kanalining kengashisiz: SMM mutaxassisi + SEO mutaxassisi + marketolog. Kanalni professional darajaga keltiring.
Hozirgi holat:
- Nomi: ${h.nom}
- Username: ${h.username ? '@' + h.username : "yo'q (ommaviy havola sozlanmagan)"}
- Tavsif: ${h.tavsif || "(bo'sh)"}
- Logo/rasm: ${h.rasm ? 'bor' : "yo'q"}
- Pin xabar: ${h.pin || "yo'q"}
- Obunachilar: ${h.obunachi}
- Bot huquqlari: info=${h.huquq.info}, pin=${h.huquq.pin}, post=${h.huquq.post}
Qoidalar: faqat berilgan faktlarga tayaning; raqam, mukofot, tajriba yillari, manzil o'ylab topmang. Tavsif ≤255 belgi, o'zbekcha (lotin) + qisqa ruscha satr, kalit so'zlar (dizayn interyer Toshkent, ta'mirlash), sayt va bot havolasi bilan. Pin post: qisqa, xizmatlar, murojaat (sayt + @visart_design_bot), HTML emas oddiy matn, ≤600 belgi. Agar hozirgi tavsif/pin allaqachon yaxshi bo'lsa, o'sha maydonni null qoldiring. Kanal nomini faqat jiddiy sabab bo'lsa taklif qiling (aks holda null).
FAQAT JSON: {"baho":1-10,"muammolar":["..."],"tavsif":"...|null","pin":"...|null","nom":"...|null","logo":true|false,"haftalik":["kontent/SEO bo'yicha 2-4 aniq maslahat"]}`;
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }), signal: AbortSignal.timeout(50000) });
  if (!r.ok) throw new Error(`claude ${r.status}`);
  const d = await r.json(); const raw = ((d.content || []).find((x) => x.type === 'text') || {}).text || '';
  const m = raw.match(/\{[\s\S]*\}/); if (!m) throw new Error('claude json');
  return JSON.parse(m[0]);
}

const bosh = (v) => (v && v !== 'null' ? String(v) : null);

export async function kanalTekshir(env, qolda = false) {
  const admin = adminId(env); if (!admin || !env.MIJOZ_BOT_TOKEN || !env.ANTHROPIC_API_KEY) return;
  const ochiq = await q(env, 'nashr_navbati?turi=eq.kanal_taklif&holat=eq.kutilmoqda&select=id&limit=1').catch(() => []);
  if (ochiq && ochiq.length && !qolda) return;
  const h = await kanalHolat(env);
  if (h.xato) { await tg(env, 'sendMessage', { chat_id: admin, text: `📣 Kanal agenti: ${h.xato}. Botni kanalga ADMIN qilib qo'shing (Xabar yuborish, Pin, Kanal ma'lumotini o'zgartirish huquqlari bilan).` }); return; }
  const j = await kengash(env, h);
  const t = { tavsif: bosh(j.tavsif) && String(j.tavsif).slice(0, 255), pin: bosh(j.pin) && String(j.pin).slice(0, 900), nom: bosh(j.nom) && String(j.nom).slice(0, 128), logo: !!j.logo && !h.rasm ? true : !!j.logo };
  const bor = t.tavsif || t.pin || t.nom || t.logo;
  const baho = Number(j.baho) || 0;
  const maslahat = (j.haftalik || []).slice(0, 4).map((x) => '• ' + x).join('\n');
  const muam = (j.muammolar || []).slice(0, 5).map((x) => '• ' + x).join('\n');
  let s = `📣 Kanal tekshiruvi — ${baho}/10 (obunachi: ${h.obunachi})\n${muam}`;
  if (!h.huquq.info || !h.huquq.pin) s += `\n\n⚠️ Bot huquqlari yetarli emas (info=${h.huquq.info}, pin=${h.huquq.pin}). Kanal adminlarida botga shu huquqlarni bering.`;
  if (!bor) { await tg(env, 'sendMessage', { chat_id: admin, text: s + (maslahat ? `\n\nMaslahat:\n${maslahat}` : '') + "\n\nSozlamalar yaxshi — o'zgartirish kerak emas." }); return; }
  const row = await q(env, 'nashr_navbati', { method: 'POST', body: JSON.stringify([{ turi: 'kanal_taklif', holat: 'kutilmoqda', nashr_vaqti: new Date().toISOString(), payload: { baho, muammolar: j.muammolar || [], taklif: t, maslahat: j.haftalik || [], oldingi: { tavsif: h.tavsif, nom: h.nom } } }]) });
  const id = row && row[0] && row[0].id;
  if (t.nom) s += `\n\n🏷 Yangi nom: ${t.nom}`;
  if (t.tavsif) s += `\n\n📝 Yangi tavsif:\n${t.tavsif}`;
  if (t.pin) s += `\n\n📌 Pin post:\n${t.pin}`;
  if (t.logo) s += `\n\n🖼 Logo: brend belgisi (qorong'i fon, kvadrat) o'rnatiladi.`;
  if (maslahat) s += `\n\nMaslahat:\n${maslahat}`;
  await tg(env, 'sendMessage', { chat_id: admin, text: s.slice(0, 3900), reply_markup: { inline_keyboard: [[{ text: '✅ Qo\'llash', callback_data: `kn:ok:${id}` }, { text: '❌ Rad', callback_data: `kn:no:${id}` }]] } });
}

export async function kanalQollash(env, id) {
  const r = await q(env, `nashr_navbati?id=eq.${Number(id)}&turi=eq.kanal_taklif&holat=eq.kutilmoqda&select=id,payload`);
  if (!r || !r[0]) return "Taklif topilmadi yoki allaqachon hal qilingan.";
  const t = r[0].payload.taklif || {}, ch = env.TELEGRAM_CHANNEL_ID, out = [];
  if (t.nom) { const d = await tg(env, 'setChatTitle', { chat_id: ch, title: t.nom }); out.push(`${d.ok ? '✅' : '❌'} Nom${d.ok ? '' : ': ' + d.description}`); }
  if (t.tavsif) { const d = await tg(env, 'setChatDescription', { chat_id: ch, description: t.tavsif }); out.push(`${d.ok ? '✅' : '❌'} Tavsif${d.ok ? '' : ': ' + d.description}`); }
  if (t.logo) {
    try {
      const img = await fetch(LOGO_URL, { signal: AbortSignal.timeout(15000) }); if (!img.ok) throw new Error('logo fayl ' + img.status);
      const fd = new FormData(); fd.append('chat_id', String(ch)); fd.append('photo', new Blob([await img.arrayBuffer()], { type: 'image/png' }), 'logo.png');
      const d = await (await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/setChatPhoto`, { method: 'POST', body: fd, signal: AbortSignal.timeout(20000) })).json();
      out.push(`${d.ok ? '✅' : '❌'} Logo${d.ok ? '' : ': ' + d.description}`);
    } catch (e) { out.push('❌ Logo: ' + String((e && e.message) || e).slice(0, 80)); }
  }
  if (t.pin) {
    const m = await tg(env, 'sendMessage', { chat_id: ch, text: t.pin, disable_web_page_preview: true });
    if (m.ok) { const p = await tg(env, 'pinChatMessage', { chat_id: ch, message_id: m.result.message_id, disable_notification: true }); out.push(`${p.ok ? '✅' : '❌'} Pin post${p.ok ? '' : ': ' + p.description}`); }
    else out.push('❌ Pin post: ' + m.description);
  }
  await q(env, `nashr_navbati?id=eq.${Number(id)}`, { method: 'PATCH', body: JSON.stringify({ holat: 'qollandi' }) }).catch(() => {});
  return '📣 Kanal:\n' + out.join('\n');
}
export async function kanalRad(env, id) {
  await q(env, `nashr_navbati?id=eq.${Number(id)}&turi=eq.kanal_taklif`, { method: 'PATCH', body: JSON.stringify({ holat: 'rad' }) }).catch(() => {});
  return 'Kanal taklifi rad etildi.';
}
export async function kanalOchiq(env) {
  const r = await q(env, 'nashr_navbati?turi=eq.kanal_taklif&holat=eq.kutilmoqda&select=id,payload&order=id.desc&limit=3').catch(() => []);
  return (r || []).map((x) => ({ id: x.id, baho: x.payload.baho, muammolar: x.payload.muammolar || [], taklif: x.payload.taklif || {}, maslahat: x.payload.maslahat || [] }));
}
