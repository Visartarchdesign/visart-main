import { obyektKuzatuv, kunlikXulosa, lidEslatma, xulosaNavbatiniTekshir, keyingiToshkent } from '../_lib/botAvto.js';
// Cloudflare Pages Function — /api/nashr-navbati
// Kechiktirilgan-nashr navbatini (`nashr_navbati` jadvali) ishga tushiruvchi
// worker. mijoz-bot.js (Facebook post'ini ertalabki oynaga kechiktiradi) va
// media-server/montaj.js (qo'shimcha Instagram Story bosqichini
// rejalashtiradi) shu jadvalga YOZADI; bu Function esa vaqti kelgan
// qatorlarni O'QIB, haqiqiy Graph API chaqiruvini qiladi.
//
// Tashqi bepul cron (cron-job.org) har 15 daqiqada chaqirishi kerak (Toshkent
// vaqti muhim emas -- har doim "vaqti kelganlarni" tekshiradi):
//   cron: */15 * * * *
//   GET https://visartdesign.uz/api/nashr-navbati?secret=<NASHR_NAVBATI_SECRET>
//
// Kerakli jadval (SQL) va to'liq jadval/vaqt rejasi uchun qarang:
//   functions/api/senarist-tahlil.js (bosh izoh)
//
// Qo'shimcha Cloudflare Pages Environment Variable:
//   NASHR_NAVBATI_SECRET -- o'zingiz o'ylab topgan tasodifiy satr
//   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INSTAGRAM_ACCESS_TOKEN,
//    INSTAGRAM_BUSINESS_ACCOUNT_ID, FACEBOOK_PAGE_ID -- allaqachon bor)

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function sbFetch(env, path, init = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: init.prefer || 'return=representation',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Supabase ${path} -> ${res.status}: ${txt.slice(0, 300)}`);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

async function igFetch(path, params) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: 'POST', signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) {
    throw new Error(`Graph API xato: ${(data && data.error && data.error.message) || res.status}`);
  }
  return data;
}

// Container tayyor (FINISHED) bo'lguncha kutadi -- faqat video (Story) uchun
// kerak, rasm (Facebook photo) sinxron darhol nashr qilinadi.
async function igContainerKutish(containerId, token) {
  const max = 20; // 20 x 10s = ~3.3 daqiqa (worker o'zi har 15 daqiqada qayta chaqiriladi)
  for (let i = 0; i < max; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const url = new URL(`https://graph.facebook.com/v21.0/${containerId}`);
    url.searchParams.set('fields', 'status_code');
    url.searchParams.set('access_token', token);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    const data = await res.json().catch(() => null);
    if (data && data.status_code === 'FINISHED') return true;
    if (data && (data.status_code === 'ERROR' || data.status_code === 'EXPIRED')) return false;
  }
  return false;
}

// Sahifaga post uchun System User tokeni emas, SAHIFA tokeni kerak
// (GET /{page-id}?fields=access_token). Xato bo'lsa -- sabab aniq ko'rinadi
// (noto'g'ri FACEBOOK_PAGE_ID yoki sahifa System User'ga biriktirilmagan).
async function sahifaTokeni(pageId, token) {
  const url = new URL(`https://graph.facebook.com/v21.0/${pageId}`);
  url.searchParams.set('fields', 'access_token,name');
  url.searchParams.set('access_token', token);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) {
    throw new Error(`Sahifa tokeni olinmadi (FACEBOOK_PAGE_ID=${pageId}): ${(data && data.error && data.error.message) || res.status}`);
  }
  if (!data.access_token) throw new Error(`Sahifa tokeni yo'q ("${data.name}") -- sahifa System User'ga Full control bilan biriktirilmagan`);
  return data.access_token;
}

async function bajarFacebookPhoto(env, payload) {
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.FACEBOOK_PAGE_ID) throw new Error('Facebook sozlanmagan');
  const { urls, caption } = payload;
  if (!urls || !urls.length) throw new Error("payload.urls bo'sh");
  const pageId = env.FACEBOOK_PAGE_ID;
  const token = await sahifaTokeni(pageId, env.INSTAGRAM_ACCESS_TOKEN);
  const fbCaption = (caption || '').slice(0, 5000);

  if (urls.length === 1) {
    await igFetch(`${pageId}/photos`, { url: urls[0], caption: fbCaption, access_token: token });
    return;
  }
  const attached = [];
  for (const url of urls.slice(0, 10)) {
    const r = await igFetch(`${pageId}/photos`, { url, published: 'false', access_token: token });
    attached.push({ media_fbid: r.id });
  }
  await igFetch(`${pageId}/feed`, {
    message: fbCaption,
    attached_media: JSON.stringify(attached),
    access_token: token,
  });
}

async function bajarFacebookVideo(env, payload) {
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.FACEBOOK_PAGE_ID) throw new Error('Facebook sozlanmagan');
  const { video_url: videoUrl, cover_url: coverUrl, caption } = payload;
  if (!videoUrl) throw new Error("payload.video_url bo'sh");
  const pageId = env.FACEBOOK_PAGE_ID;
  const token = await sahifaTokeni(pageId, env.INSTAGRAM_ACCESS_TOKEN);
  const form = new FormData();
  form.append('file_url', videoUrl);
  form.append('description', (caption || '').slice(0, 5000));
  form.append('access_token', token);
  if (coverUrl) {
    const r = await fetch(coverUrl, { signal: AbortSignal.timeout(15000) });
    if (r.ok) form.append('thumb', new Blob([await r.arrayBuffer()], { type: 'image/jpeg' }), 'cover.jpg');
  }
  const res = await fetch(`https://graph-video.facebook.com/v21.0/${pageId}/videos`, { method: 'POST', body: form, signal: AbortSignal.timeout(25000) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) throw new Error(`Facebook video xato: ${(data && data.error && data.error.message) || res.status}`);
}

async function bajarInstagramStory(env, payload) {
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_BUSINESS_ACCOUNT_ID) throw new Error('Instagram sozlanmagan');
  const { video_url: videoUrl } = payload;
  if (!videoUrl) throw new Error("payload.video_url bo'sh");
  const igId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const token = env.INSTAGRAM_ACCESS_TOKEN;
  const container = await igFetch(`${igId}/media`, { media_type: 'STORIES', video_url: videoUrl, access_token: token });
  const tayyor = await igContainerKutish(container.id, token);
  if (!tayyor) throw new Error('Story container FINISHED holatiga yetmadi');
  await igFetch(`${igId}/media_publish`, { creation_id: container.id, access_token: token });
}

async function bajarLidFollowup(env, payload) {
  if (!env.MIJOZ_BOT_TOKEN) throw new Error('MIJOZ_BOT_TOKEN yoq');
  // Mijoz arizadan keyin faol bo'lgan bo'lsa (menyu/narx/yozgan) -- eslatma kerak emas.
  const d = await sbFetch(env, `mijoz_dialog?chat_id=eq.${payload.chat_id}&select=updated_at`).catch(() => null);
  const oxirgi = d && d[0] && Date.parse(d[0].updated_at);
  if (oxirgi && oxirgi > Date.parse(payload.yaratildi) + 10 * 60 * 1000) return;
  const ru = payload.til === 'ru';
  const ism = String(payload.ism || '').replace(/[<>&]/g, '');
  const matn = payload.n === 1
    ? (ru ? `Здравствуйте, ${ism}! Вчера вы оставляли заявку. Остались вопросы? Дадим бесплатную консультацию по проекту и стоимости.` : `Salom, ${ism}! Kecha ariza qoldirgan edingiz. Savollaringiz bormi? Loyiha va narx bo'yicha bepul konsultatsiya beramiz.`)
    : (ru ? `${ism}, вам всё ещё нужна помощь с проектом? Напишите или позвоните в удобное время — будем рады помочь. 🙂` : `${ism}, loyihangiz bo'yicha hali ham yordam kerakmi? Qulay vaqtda yozing yoki qo'ng'iroq qiling — mamnuniyat bilan yordam beramiz. 🙂`);
  const res = await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: payload.chat_id, text: matn, reply_markup: { inline_keyboard: [[
      { text: ru ? '💰 Рассчитать стоимость' : '💰 Narxni hisoblash', callback_data: 'menu:narx' },
      { text: ru ? '📞 Контакты' : '📞 Aloqa', callback_data: 'menu:aloqa' },
    ]] } }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}`);
}

async function bajarUstaEslatma(env, payload) {
  if (!env.MIJOZ_BOT_TOKEN) throw new Error('MIJOZ_BOT_TOKEN yoq');
  const res = await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: payload.chat_id,
      text: `⏰ Eslatma (${payload.k}/2): ${payload.kasb} bo'yicha hisobotingiz rad etilgan edi. Iltimos, ko'rib chiqib, foto/video hisobotni boshqatdan yuboring. 🙏`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}`);
}

// ===== Avtomatik tozalash (Supabase bepul 1 GB Storage / 500 MB DB tejash) =====
// - Storage ("public-media"): 7 kundan eski fayllar o'chiriladi (kutilayotgan
//   navbat qatorlari ishlatayotgan fayllar bundan mustasno).
// - nashr_navbati: 30 kundan eski tugagan (bajarildi/xato/bekor/muddati_otdi)
//   qatorlar o'chiriladi; 3 kundan beri tasdiq kutayotgan videolar
//   "muddati_otdi" bo'ladi.
// Faqat soatiga 1 marta (cron */15 -- har soatning birinchi chaqiruvida) yoki
// ?tozalash=1 bilan qo'lda ishlaydi.
const STORAGE_MUDDAT_KUN = 7;
const NAVBAT_MUDDAT_KUN = 30;
const TASDIQ_MUDDAT_KUN = 3;

async function storageRoyxat(env, prefix) {
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/list/public-media`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: 'created_at', order: 'asc' } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  const arr = await res.json().catch(() => []);
  return (arr || []).filter((o) => o && o.name && o.id); // papkalarda id yo'q
}

async function tozalash(env) {
  const hisobot = { storage_ochirildi: 0, navbat_ochirildi: 0, muddati_otdi: 0, xato: null };
  try {
    const kunMs = 24 * 3600 * 1000;
    const tasdiqChegara = new Date(Date.now() - TASDIQ_MUDDAT_KUN * kunMs).toISOString();
    const eskiTasdiq = await sbFetch(env,
      `nashr_navbati?holat=eq.tasdiq_kutilmoqda&created_at=lt.${encodeURIComponent(tasdiqChegara)}`,
      { method: 'PATCH', body: JSON.stringify({ holat: 'muddati_otdi' }) });
    hisobot.muddati_otdi = (eskiTasdiq || []).length;

    // 2 kundan eski update_id yozuvlari (bot dedup jadvali; jadval yo'q bo'lsa jim o'tadi)
    await sbFetch(env, `bot_update_log?created_at=lt.${encodeURIComponent(new Date(Date.now() - 2 * kunMs).toISOString())}`,
      { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});

    // Hali ishlatilishi mumkin bo'lgan fayllar: kutilayotgan/tasdiqdagi qatorlar payload'i
    const faol = await sbFetch(env, 'nashr_navbati?holat=in.(kutilmoqda,tasdiq_kutilmoqda)&select=payload');
    const faolMatn = JSON.stringify(faol || []);

    const chegara = Date.now() - STORAGE_MUDDAT_KUN * kunMs;
    const ochirish = [];
    for (const papka of ['instagram', 'instagram-video']) {
      for (const o of await storageRoyxat(env, papka)) {
        const t = Date.parse(o.created_at || o.updated_at || '');
        const yol = `${papka}/${o.name}`;
        if (t && t < chegara && !faolMatn.includes(yol)) ochirish.push(yol);
      }
    }
    if (ochirish.length) {
      const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/public-media`, {
        method: 'DELETE',
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: ochirish }),
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) hisobot.storage_ochirildi = ochirish.length;
    }

    const navbatChegara = new Date(Date.now() - NAVBAT_MUDDAT_KUN * kunMs).toISOString();
    const o = await sbFetch(env,
      `nashr_navbati?holat=in.(bajarildi,xato,bekor,muddati_otdi)&created_at=lt.${encodeURIComponent(navbatChegara)}`,
      { method: 'DELETE' });
    hisobot.navbat_ochirildi = (o || []).length;
  } catch (e) {
    hisobot.xato = String((e && e.message) || e);
  }
  return hisobot;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.NASHR_NAVBATI_SECRET || url.searchParams.get('secret') !== env.NASHR_NAVBATI_SECRET) {
    return json({ error: 'ruxsat yo\'q' }, 403);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Supabase sozlanmagan' }, 500);
  }

  const hozir = new Date().toISOString();
  const qatorlar = await sbFetch(
    env,
    `nashr_navbati?holat=eq.kutilmoqda&nashr_vaqti=lte.${encodeURIComponent(hozir)}&order=nashr_vaqti.asc&limit=10&select=*`
  );

  const natijalar = [];
  for (const q of qatorlar || []) {
    try {
      if (q.turi === 'facebook_photo') {
        await bajarFacebookPhoto(env, q.payload);
      } else if (q.turi === 'facebook_video') {
        await bajarFacebookVideo(env, q.payload);
      } else if (q.turi === 'lid_followup') {
        await bajarLidFollowup(env, q.payload);
      } else if (q.turi === 'lid_eslatma') {
        await lidEslatma(env, q.payload);
      } else if (q.turi === 'kunlik_xulosa') {
        await kunlikXulosa(env);
        await sbFetch(env, 'nashr_navbati', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify([{ turi: 'kunlik_xulosa', payload: {}, nashr_vaqti: keyingiToshkent(9, 0), holat: 'kutilmoqda' }]) }).catch(() => {});
      } else if (q.turi === 'usta_eslatma') {
        await bajarUstaEslatma(env, q.payload);
      } else if (q.turi === 'instagram_story') {
        await bajarInstagramStory(env, q.payload);
      } else {
        throw new Error(`noma'lum turi: ${q.turi}`);
      }
      await sbFetch(env, `nashr_navbati?id=eq.${q.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ holat: 'bajarildi' }),
      });
      natijalar.push({ id: q.id, holat: 'bajarildi' });
    } catch (e) {
      await sbFetch(env, `nashr_navbati?id=eq.${q.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ holat: 'xato', xato_matni: String((e && e.message) || e).slice(0, 500) }),
      }).catch(() => {});
      natijalar.push({ id: q.id, holat: 'xato', xato: String((e && e.message) || e) });
    }
  }

  await obyektKuzatuv(env).catch(() => {});
  await xulosaNavbatiniTekshir(env).catch(() => {});

  let tozalashNatijasi = null;
  if (url.searchParams.get('tozalash') === '1' || new Date().getUTCMinutes() < 15) {
    tozalashNatijasi = await tozalash(env);
  }

  return json({ ok: true, bajarildi: natijalar.length, natijalar, tozalash: tozalashNatijasi });
}
