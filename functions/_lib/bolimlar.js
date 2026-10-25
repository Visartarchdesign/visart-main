// Bo'limlar bo'yicha admin panel (agent kompaniyasi): /admin -> bo'limlar -> tugmalar.
// Tugmalar mavjud callbacklarni ishlatadi (ap:*, tg:*, rb:*). Yangi bo'lim qo'shish: BOLIMLAR ga bitta yozuv.
import { mediaChaqir } from './media.js';

async function sb(env, path) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`sb ${r.status}`);
  return r.json();
}
const n = async (env, path) => { try { return (await sb(env, path)).length; } catch { return null; } };
const nb = (x) => (x === null ? '?' : x);
async function tg(env, chat_id, text, reply_markup) {
  return fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup }), signal: AbortSignal.timeout(10000) }).catch(() => null);
}

// Har bo'lim: sarlavha, tugmalar (callback_data mavjud handlerlarga boradi)
export const BOLIMLAR = {
  kontent: { nom: '🎬 Kontent (SMM · Senarist · Montajchi)', tugma: [
    [['🎞 Yangi reel (senariy)', 'bl:reel'], ['🗂 Nashr navbati', 'ap:nav']],
    [['📦 Tayyor, joylanmagan ishlar', 'bl:tayyor']],
    [['💡 Maslahat (test)', 'ap:ms']],
  ] },
  target: { nom: '🎯 Marketing va target', tugma: [
    [['🆕 Yangi taklif', 'tg:nw'], ['📋 Kampaniyalar', 'tg:ls']],
    [['📊 Hisobot', 'tg:rp'], ['🎬 Reklama videosi', 'tg:vd']],
  ] },
  mijoz: { nom: '👥 Mijozlar va obyektlar', tugma: [
    [['🆕 Oxirgi lidlar', 'ap:lid'], ['🌐 Sayt murojaatlari', 'ap:sayt']],
    [['🏗 Obyektlar', 'ap:ob'], ['👥 Guruhlar', 'ap:gr']],
    [['🔗 Mijoz ulanishlari', 'ap:ul'], ['👁 Mijoz ko\'rinishi', 'ap:mijoz']],
  ] },
  ishlab: { nom: '📐 Loyiha ishlab chiqarish (AutoCAD · 3ds Max)', tugma: [
    [['📚 Norma qoidalari', 'ap:nq']],
  ] },
  tizim: { nom: '⚙️ Tizim', tugma: [
    [['📊 Bugun / hafta', 'ap:stat'], ['🆔 Mening ID', 'ap:id']],
    [['➕ Admin qo\'shish', 'ap:add'], ['👥 Adminlar', 'ap:list']],
    [['🧰 Eski panel (hammasi)', 'bl:eski']],
  ] },
};
const kb = (b) => ({ inline_keyboard: [...b.tugma.map((q) => q.map(([text, callback_data]) => ({ text, callback_data }))), [{ text: '⬅️ Bo\'limlar', callback_data: 'bl:bosh' }]] });

async function holatlar(env) {
  const tosh = new Date(Date.now() + 5 * 3600e3); tosh.setUTCHours(0, 0, 0, 0);
  const bugun = new Date(tosh.getTime() - 5 * 3600e3).toISOString();
  const media = await fetch(`${env.MEDIA_SERVER_URL}/health`, { signal: AbortSignal.timeout(4000) }).then((r) => r.ok).catch(() => false);
  const [navbat, faol, taklif, lid, obyekt] = await Promise.all([
    n(env, 'nashr_navbati?holat=eq.kutilmoqda&turi=in.(video_ig_tg,facebook_photo,facebook_video,instagram_story)&select=id&limit=100'),
    n(env, 'nashr_navbati?turi=eq.target&holat=eq.target_faol&select=id'),
    n(env, 'nashr_navbati?turi=eq.target&holat=in.(tasdiq_kutilmoqda,target_tayyor)&select=id'),
    n(env, `lidlar?created_at=gte.${encodeURIComponent(bugun)}&select=id&limit=200`),
    n(env, 'obyektlar?select=id&limit=500'),
  ]);
  return { media, navbat, faol, taklif, lid, obyekt };
}

export async function bolimBosh(env, chatId) {
  const h = await holatlar(env);
  const t = `🏢 <b>Visart agent kompaniyasi</b>\n\n`
    + `🎬 Kontent — navbatda: <b>${nb(h.navbat)}</b>\n`
    + `🎯 Target — faol: <b>${nb(h.faol)}</b>, tasdiq kutayotgan: <b>${nb(h.taklif)}</b>\n`
    + `👥 Mijozlar — bugungi lid: <b>${nb(h.lid)}</b>, obyektlar: <b>${nb(h.obyekt)}</b>\n`
    + `📐 Ishlab chiqarish — AutoCAD/3ds Max (keyingi bosqich)\n`
    + `⚙️ Media-server: ${h.media ? '🟢 ishlayapti' : "🔴 javob bermayapti (nazorat o'zi tiklaydi)"}`;
  const b = BOLIMLAR;
  await tg(env, chatId, t, { inline_keyboard: [
    [{ text: '📱 Admin ilova', web_app: { url: 'https://visartdesign.uz/admin-ilova/' } }],
    [{ text: b.kontent.nom, callback_data: 'bl:kontent' }], [{ text: b.target.nom, callback_data: 'bl:target' }],
    [{ text: b.mijoz.nom, callback_data: 'bl:mijoz' }], [{ text: b.ishlab.nom, callback_data: 'bl:ishlab' }],
    [{ text: b.tizim.nom, callback_data: 'bl:tizim' }],
  ] });
}

const IZOH = {
  kontent: "Senarist -> montajchi -> SMM jadvali bitta oqimda: reel yaratasiz, tasdiqlaysiz, jadval bo'yicha IG/Telegram/YouTube/Facebook'ga o'zi chiqadi.",
  target: "Targetolog taklif beradi, siz byudjetni tasdiqlaysiz, pul faqat \"Yoqish\" dan keyin sarflanadi. Kunlik limit nazorati avtomatik.",
  mijoz: "Lidlar, sayt murojaatlari, obyektlar va mijoz guruhlari.",
  ishlab: "Keyingi bosqich: 3ds Max ish holati, AutoCAD chizmalar kuzatuvi, smeta. Hozir faqat norma qoidalari (ShNQ/KMQ) tasdiqlanadi.",
  tizim: "Statistika, adminlar va eski to'liq panel.",
};

// Callback: bl:<bolim|bosh|reel|eski>
export async function bolimCb(env, cq, eskiPanel) {
  const chatId = cq.message.chat.id;
  const amal = String(cq.data).split(':')[1];
  await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/answerCallbackQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: cq.id }) }).catch(() => {});
  if (amal === 'bosh') return bolimBosh(env, chatId);
  if (amal === 'eski') return eskiPanel();
  if (amal === 'tayyor') {
    const rows = await sb(env, 'nashr_navbati?turi=eq.video_nashr&holat=eq.tasdiq_kutilmoqda&select=id,payload,created_at&order=id.desc&limit=10').catch(() => null);
    if (!rows || !rows.length) return tg(env, chatId, "📦 Tasdiq kutayotgan tayyor video yo'q.");
    await tg(env, chatId, `📦 Tayyor, joylanmagan ishlar: <b>${rows.length}</b> ta (eng yangi 10). Ko'rib chiqing; "✅ Joylash" bossangiz haftalik jadvalning keyingi bo'sh slotiga qo'yiladi.`);
    for (const r of rows) {
      const p = r.payload || {};
      const cap = `🎞 #${r.id} — ${String(p.sarlavha || '').slice(0, 120)}\n${String(r.created_at).slice(0, 10)}`;
      const markup = { inline_keyboard: [[{ text: '✅ Joylash', callback_data: `vnash:${r.id}:ok` }, { text: '❌ Bekor', callback_data: `vnash:${r.id}:no` }]] };
      const ok = p.video_url && await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendVideo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, video: p.video_url, caption: cap, reply_markup: markup }), signal: AbortSignal.timeout(20000) }).then((x) => x.ok).catch(() => false);
      if (!ok) await tg(env, chatId, `${cap}\n${p.video_url || ''}`, markup);
    }
    return;
  }
  if (amal === 'reel') {
    await tg(env, chatId, "⏳ Senarist ishga tushdi, senariy 1–2 daqiqada keladi. Tasdiqlasangiz montajchi yig'adi.");
    return mediaChaqir(env, '/reel-senariy', { adminChatId: chatId }, chatId).catch(() => {});
  }
  const b = BOLIMLAR[amal];
  if (!b) return;
  await tg(env, chatId, `<b>${b.nom}</b>\n${IZOH[amal] || ''}`, kb(b));
}
