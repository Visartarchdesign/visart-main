// SMM agenti (kanal nazorati): Telegram, Instagram, Facebook, YouTube profillarini tekshiradi; Telegram kanalni tekshiradi, SMM+SEO+marketing "kengashi" (Claude) maslahati bilan tavsif/pin/logo taklif qiladi,
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

const gj = async (url, init) => { const r = await fetch(url, { ...init, signal: AbortSignal.timeout(12000) }); const d = await r.json().catch(() => ({})); return d; };
async function ytToken(env) {
  const t = await gj('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.YOUTUBE_CLIENT_ID, client_secret: env.YOUTUBE_CLIENT_SECRET, refresh_token: env.YOUTUBE_REFRESH_TOKEN, grant_type: 'refresh_token' }) });
  return t.access_token || null;
}
const YT = 'https://www.googleapis.com/youtube/v3';
async function platformalar(env) {
  const T = env.INSTAGRAM_ACCESS_TOKEN, o = {};
  const ig = env.INSTAGRAM_BUSINESS_ACCOUNT_ID && T ? gj(`https://graph.facebook.com/v21.0/${env.INSTAGRAM_BUSINESS_ACCOUNT_ID}?fields=username,name,biography,followers_count,media_count,website&access_token=${T}`).then((d) => d.error ? { xato: d.error.message } : { username: d.username, nom: d.name, bio: d.biography || '', obunachi: d.followers_count, postlar: d.media_count, sayt: d.website || '' }).catch((e) => ({ xato: String(e.message || e) })) : Promise.resolve(null);
  const fb = env.FACEBOOK_PAGE_ID && T ? gj(`https://graph.facebook.com/v21.0/${env.FACEBOOK_PAGE_ID}?fields=name,about,description,fan_count,website,category&access_token=${T}`).then((d) => d.error ? { xato: d.error.message } : { nom: d.name, about: d.about || '', tavsif: d.description || '', obunachi: d.fan_count, sayt: d.website || '', turkum: d.category }).catch((e) => ({ xato: String(e.message || e) })) : Promise.resolve(null);
  const yt = env.YOUTUBE_REFRESH_TOKEN ? (async () => {
    const tk = await ytToken(env); if (!tk) return { xato: 'token olinmadi' };
    const H = { Authorization: `Bearer ${tk}` };
    const d = await gj(`${YT}/channels?part=snippet,statistics,brandingSettings,contentDetails&mine=true`, { headers: H });
    if (d.error) return { xato: "o'qish ruxsati yo'q (" + (d.error.message || '').slice(0, 60) + ')' };
    const c = d.items && d.items[0]; if (!c) return { xato: 'kanal topilmadi' };
    let videolar = [];
    const up = c.contentDetails && c.contentDetails.relatedPlaylists && c.contentDetails.relatedPlaylists.uploads;
    if (up) {
      const pl = await gj(`${YT}/playlistItems?part=contentDetails&maxResults=10&playlistId=${up}`, { headers: H });
      const ids = ((pl.items) || []).map((x) => x.contentDetails.videoId).join(',');
      if (ids) { const v = await gj(`${YT}/videos?part=snippet,statistics&id=${ids}`, { headers: H }); videolar = ((v.items) || []).map((x) => ({ id: x.id, title: x.snippet.title, tavsif: (x.snippet.description || '').slice(0, 250), tags: (x.snippet.tags || []).slice(0, 12), korish: x.statistics && x.statistics.viewCount })); }
    }
    const br = (c.brandingSettings && c.brandingSettings.channel) || {};
    return { nom: c.snippet.title, tavsif: c.snippet.description || '', kalitlar: br.keywords || '', banner: !!(c.brandingSettings && c.brandingSettings.image && c.brandingSettings.image.bannerExternalUrl), obunachi: c.statistics.subscriberCount, videolar_soni: c.statistics.videoCount, videolar };
  })().catch((e) => ({ xato: String(e.message || e) })) : Promise.resolve(null);
  [o.ig, o.fb, o.yt] = await Promise.all([ig, fb, yt]); return o;
}

export async function kanalHolat(env) {
  const ch = env.TELEGRAM_CHANNEL_ID; if (!ch) return { xato: 'TELEGRAM_CHANNEL_ID sozlanmagan' };
  const [c, n, me] = await Promise.all([tg(env, 'getChat', { chat_id: ch }), tg(env, 'getChatMemberCount', { chat_id: ch }), tg(env, 'getMe')]);
  if (!c.ok) return { xato: `getChat: ${c.description || 'xato'}` };
  const m = await tg(env, 'getChatMember', { chat_id: ch, user_id: me.result && me.result.id });
  const r = (m.result) || {}, x = c.result;
  const pl = await platformalar(env);
  return {
    ...pl, nom: x.title, username: x.username || null, tavsif: x.description || '', rasm: !!x.photo, pin: (x.pinned_message && (x.pinned_message.text || x.pinned_message.caption || '').slice(0, 300)) || null,
    obunachi: n.ok ? n.result : null, botAdmin: r.status === 'administrator' || r.status === 'creator',
    huquq: { info: !!r.can_change_info, pin: !!r.can_pin_messages, post: !!r.can_post_messages },
  };
}

async function kengash(env, h) {
  const prompt = `Siz Visart Design (Toshkent, arxitektura/interyer dizayn va ta'mirlash studiyasi; sayt visartdesign.uz; mijoz boti @visart_design_bot) SMM agentisiz (SMM + SEO + marketing mutaxassisi) va Telegram, Instagram, Facebook, YouTube profillarini premium darajada ushlab turasiz. Brend yagona ovozda bo'lsin.
Telegram kanal holati:
- Nomi: ${h.nom}
- Username: ${h.username ? '@' + h.username : "yo'q (ommaviy havola sozlanmagan)"}
- Tavsif: ${h.tavsif || "(bo'sh)"}
- Logo/rasm: ${h.rasm ? 'bor' : "yo'q"}
- Pin xabar: ${h.pin || "yo'q"}
- Obunachilar: ${h.obunachi}
- Bot huquqlari: info=${h.huquq.info}, pin=${h.huquq.pin}, post=${h.huquq.post}
Instagram: ${JSON.stringify(h.ig || "ulanmagan")}
Facebook: ${JSON.stringify(h.fb || 'ulanmagan')}
YouTube: ${JSON.stringify(h.yt || 'ulanmagan')}
Qoidalar: faqat berilgan faktlarga tayaning; raqam, mukofot, tajriba yillari, manzil o'ylab topmang. Tavsif ≤255 belgi, o'zbekcha (lotin) + qisqa ruscha satr, kalit so'zlar (dizayn interyer Toshkent, ta'mirlash), sayt va bot havolasi bilan. Pin post: qisqa, xizmatlar, murojaat (sayt + @visart_design_bot), HTML emas oddiy matn, ≤600 belgi. Instagram bio, Facebook about va YouTube tavsifi ham shu qoidalarda; ulanmagan yoki xato platformani null qoldiring. YouTube: faqat haqiqatan zaif (sarlavha/tavsif/teglar SEO jihatdan yomon) videolar uchun, eng ko'pi 5 ta, yt_video ni to'ldiring — mazmunni o'zgartirmang, faqat sarlavha/tavsif/teglarni SEO ga moslang; yt_banner faqat banner yo'q bo'lsa true. Agar hozirgi tavsif/pin allaqachon yaxshi bo'lsa, o'sha maydonni null qoldiring. Kanal nomini faqat jiddiy sabab bo'lsa taklif qiling (aks holda null).
Javob QISQA bo'lsin (jami ≤1800 token), yt_video faqat 3 tagacha. FAQAT JSON: {"baho":1-10,"muammolar":["..."],"tavsif":"...|null","pin":"...|null","nom":"...|null","logo":true|false,"ig_bio":"≤150 belgi|null","fb_about":"≤255 belgi|null","yt_tavsif":"...|null","yt_kalit":"vergul bilan 8-12 kalit so'z|null","yt_banner":true|false,"yt_video":[{"id":"...","title":"≤70 belgi","description":"...","tags":["..."]}],"haftalik":["kontent/SEO bo'yicha 2-4 aniq maslahat"]}`;
  let raw = '', xato = '';
  for (const model of ['claude-sonnet-5', 'claude-sonnet-5-5', 'claude-opus-5-5']) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 2500, messages: [{ role: 'user', content: prompt }] }), signal: AbortSignal.timeout(45000) });
      const d = await r.json();
      raw = ((d.content || []).find((x) => x.type === 'text') || {}).text || '';
      if (raw.includes('{')) break;
      xato += ` | ${model}: ${r.status} ${JSON.stringify(d.error || d.stop_reason || d).slice(0, 160)}`;
    } catch (e) { xato += ` | ${model}: ${e && e.message}`; }
  }
  const m = raw.match(/\{[\s\S]*\}/); if (!m) throw new Error('claude json: ' + xato);
  try { return JSON.parse(m[0]); } catch (e) { throw new Error('claude json parse: ' + raw.length + ' belgi, oxiri: ' + raw.slice(-80)); }
}

const bosh = (v) => (v && v !== 'null' ? String(v) : null);

export async function kanalTekshir(env, qolda = false) {
  const admin = adminId(env); if (!admin || !env.MIJOZ_BOT_TOKEN || !env.ANTHROPIC_API_KEY) return;
  const ochiq = await q(env, 'nashr_navbati?turi=eq.kanal_taklif&holat=eq.kutilmoqda&select=id&limit=1').catch(() => []);
  if (ochiq && ochiq.length && !qolda) return;
  const h = await kanalHolat(env);
  if (h.xato) { await tg(env, 'sendMessage', { chat_id: admin, text: `📣 Kanal agenti: ${h.xato}. Botni kanalga ADMIN qilib qo'shing (Xabar yuborish, Pin, Kanal ma'lumotini o'zgartirish huquqlari bilan).` }); return; }
  const j = await kengash(env, h);
  const t = { tavsif: bosh(j.tavsif) && String(j.tavsif).slice(0, 255), pin: bosh(j.pin) && String(j.pin).slice(0, 900), nom: bosh(j.nom) && String(j.nom).slice(0, 128), logo: !!j.logo, ig_bio: bosh(j.ig_bio) && String(j.ig_bio).slice(0, 150), fb_about: bosh(j.fb_about) && String(j.fb_about).slice(0, 255), yt_tavsif: bosh(j.yt_tavsif) && String(j.yt_tavsif).slice(0, 1000), yt_kalit: bosh(j.yt_kalit) && String(j.yt_kalit).slice(0, 400), yt_banner: !!j.yt_banner && !(h.yt && h.yt.banner), yt_video: (Array.isArray(j.yt_video) ? j.yt_video : []).filter((v) => v && /^[\w-]{11}$/.test(v.id || '') && v.title).slice(0, 5).map((v) => ({ id: v.id, title: String(v.title).slice(0, 100), description: String(v.description || '').slice(0, 4000), tags: (v.tags || []).slice(0, 15).map((x) => String(x).slice(0, 30)) })) };
  const bor = t.tavsif || t.pin || t.nom || t.logo || t.ig_bio || t.fb_about || t.yt_tavsif || t.yt_kalit || t.yt_banner || (t.yt_video && t.yt_video.length);
  const baho = Number(j.baho) || 0;
  const maslahat = (j.haftalik || []).slice(0, 4).map((x) => '• ' + x).join('\n');
  const muam = (j.muammolar || []).slice(0, 5).map((x) => '• ' + x).join('\n');
  let s = `📣 SMM tekshiruvi — ${baho}/10\nTG ${h.obunachi ?? '?'} · IG ${h.ig && h.ig.obunachi != null ? h.ig.obunachi : '—'} · FB ${h.fb && h.fb.obunachi != null ? h.fb.obunachi : '—'} · YT ${h.yt && h.yt.obunachi != null ? h.yt.obunachi : '—'}\n${muam}`;
  if (!h.huquq.info || !h.huquq.pin) s += `\n\n⚠️ Bot huquqlari yetarli emas (info=${h.huquq.info}, pin=${h.huquq.pin}). Kanal adminlarida botga shu huquqlarni bering.`;
  if (!bor) { await tg(env, 'sendMessage', { chat_id: admin, text: s + (maslahat ? `\n\nMaslahat:\n${maslahat}` : '') + "\n\nSozlamalar yaxshi — o'zgartirish kerak emas." }); return; }
  const row = await q(env, 'nashr_navbati', { method: 'POST', body: JSON.stringify([{ turi: 'kanal_taklif', holat: 'kutilmoqda', nashr_vaqti: new Date().toISOString(), payload: { baho, muammolar: j.muammolar || [], taklif: t, maslahat: j.haftalik || [], oldingi: { tavsif: h.tavsif, nom: h.nom } } }]) });
  const id = row && row[0] && row[0].id;
  if (t.nom) s += `\n\n🏷 Yangi nom: ${t.nom}`;
  if (t.tavsif) s += `\n\n📝 Yangi tavsif:\n${t.tavsif}`;
  if (t.pin) s += `\n\n📌 Pin post:\n${t.pin}`;
  if (t.logo) s += `\n\n🖼 Logo: brend belgisi (qorong'i fon, kvadrat) o'rnatiladi.`;
  if (t.ig_bio) s += `\n\n📷 Instagram bio:\n${t.ig_bio}`;
  if (t.fb_about) s += `\n\n📘 Facebook haqida:\n${t.fb_about}`;
  if (t.yt_tavsif) s += `\n\n▶️ YouTube tavsif:\n${t.yt_tavsif}`;
  if (t.yt_kalit) s += `\n▶️ YouTube kalit so'zlar: ${t.yt_kalit}`;
  if (t.yt_banner) s += `\n▶️ YouTube banner o'rnatiladi`;
  if (t.yt_video && t.yt_video.length) s += `\n▶️ ${t.yt_video.length} ta video SEO: ` + t.yt_video.map((v) => v.title).join(' | ');
  if (maslahat) s += `\n\nMaslahat:\n${maslahat}`;
  await tg(env, 'sendMessage', { chat_id: admin, text: s.slice(0, 3900), reply_markup: { inline_keyboard: [[{ text: '✅ Qo\'llash', callback_data: `kn:ok:${id}` }, { text: '❌ Rad', callback_data: `kn:no:${id}` }]] } });
}

async function ytQollash(env, t) {
  const tk = await ytToken(env); if (!tk) return ['❌ YouTube: token olinmadi'];
  const H = { Authorization: `Bearer ${tk}` }, J = { ...H, 'Content-Type': 'application/json' }, out = [];
  const ch = await gj(`${YT}/channels?part=brandingSettings&mine=true`, { headers: H });
  const c = ch.items && ch.items[0]; if (!c) return ['❌ YouTube: kanal topilmadi'];
  const bs = c.brandingSettings || {}; bs.channel = bs.channel || {}; bs.image = bs.image || {};
  if (t.yt_tavsif) bs.channel.description = t.yt_tavsif;
  if (t.yt_kalit) bs.channel.keywords = t.yt_kalit.split(',').map((x) => '"' + x.trim().replace(/"/g, '') + '"').join(' ');
  if (t.yt_banner) {
    try {
      const img = await fetch('https://visartdesign.uz/assets/yt-banner.png', { signal: AbortSignal.timeout(15000) });
      const up = await gj('https://www.googleapis.com/upload/youtube/v3/channelBanners/insert?uploadType=media', { method: 'POST', headers: { ...H, 'Content-Type': 'image/png' }, body: await img.arrayBuffer() });
      if (up.url) bs.image.bannerExternalUrl = up.url; else out.push('❌ Banner: ' + ((up.error && up.error.message) || 'yuklanmadi').slice(0, 80));
    } catch (e) { out.push('❌ Banner: ' + String((e && e.message) || e).slice(0, 80)); }
  }
  if (t.yt_tavsif || t.yt_kalit || bs.image.bannerExternalUrl) {
    const d = await gj(`${YT}/channels?part=brandingSettings`, { method: 'PUT', headers: J, body: JSON.stringify({ id: c.id, brandingSettings: bs }) });
    out.push(d.error ? '❌ YouTube kanal: ' + (d.error.message || '').slice(0, 100) : `✅ YouTube kanal (${[t.yt_tavsif && 'tavsif', t.yt_kalit && 'kalit', t.yt_banner && 'banner'].filter(Boolean).join(', ')})`);
  }
  let ok = 0, xs = [];
  for (const v of t.yt_video || []) {
    const cur = await gj(`${YT}/videos?part=snippet&id=${v.id}`, { headers: H }); const sn = cur.items && cur.items[0] && cur.items[0].snippet;
    if (!sn) { xs.push(v.id); continue; }
    const body = { id: v.id, snippet: { title: v.title, description: v.description || sn.description, tags: v.tags && v.tags.length ? v.tags : sn.tags, categoryId: sn.categoryId, defaultLanguage: sn.defaultLanguage } };
    const d = await gj(`${YT}/videos?part=snippet`, { method: 'PUT', headers: J, body: JSON.stringify(body) });
    if (d.error) xs.push(v.id); else ok++;
  }
  if (t.yt_video && t.yt_video.length) out.push(`${xs.length ? '⚠️' : '✅'} YouTube video SEO: ${ok} ta yangilandi${xs.length ? ', xato: ' + xs.length : ''}`);
  out.push("ℹ️ YouTube kanal rasmi (avatar) API orqali o'zgarmaydi: Studio → Sozlash → Brending, fayl: visartdesign.uz/assets/kanal-logo.png");
  return out;
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
  if (t.fb_about && env.FACEBOOK_PAGE_ID) {
    const d = await gj(`https://graph.facebook.com/v21.0/${env.FACEBOOK_PAGE_ID}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ about: t.fb_about, access_token: env.INSTAGRAM_ACCESS_TOKEN }) }).catch((e) => ({ error: { message: String(e.message || e) } }));
    out.push(`${d.success ? '✅' : '❌'} Facebook haqida${d.success ? '' : ': ' + ((d.error && d.error.message) || 'xato').slice(0, 100) + " — qo'lda qo'ying:\n" + t.fb_about}`);
  }
  if (t.ig_bio) out.push("📷 Instagram bio (API orqali o'zgarmaydi — profilni tahrirlashda qo'ying):\n" + t.ig_bio);
  if (t.yt_tavsif || t.yt_kalit || t.yt_banner || (t.yt_video && t.yt_video.length)) out.push(...await ytQollash(env, t).catch((e) => ['❌ YouTube: ' + String((e && e.message) || e).slice(0, 100)]));
  await q(env, `nashr_navbati?id=eq.${Number(id)}`, { method: 'PATCH', body: JSON.stringify({ holat: 'qollandi' }) }).catch(() => {});
  return '📣 SMM:\n' + out.join('\n');
}
export async function kanalRad(env, id) {
  await q(env, `nashr_navbati?id=eq.${Number(id)}&turi=eq.kanal_taklif`, { method: 'PATCH', body: JSON.stringify({ holat: 'rad' }) }).catch(() => {});
  return 'Kanal taklifi rad etildi.';
}
export async function kanalOchiq(env) {
  const r = await q(env, 'nashr_navbati?turi=eq.kanal_taklif&holat=eq.kutilmoqda&select=id,payload&order=id.desc&limit=3').catch(() => []);
  return (r || []).map((x) => ({ id: x.id, baho: x.payload.baho, muammolar: x.payload.muammolar || [], taklif: x.payload.taklif || {}, maslahat: x.payload.maslahat || [] }));
}
