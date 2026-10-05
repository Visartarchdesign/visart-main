// Cloudflare Pages Function — /api/usta-eslatma
// Har kuni ertalab (masalan soat 6:00, Toshkent vaqti, tashqi bepul cron --
// cron-job.org -- orqali chaqiriladi) barcha ro'yxatdan o'tgan USTALAR
// guruhlariga kunlik video/foto hisobot so'rab eslatma + minnatdorchilik
// xabari yuboradi.
//
// Qo'shimcha Cloudflare Pages Environment Variable:
//   USTA_ESLATMA_SECRET -- o'zingiz o'ylab topgan tasodifiy satr
//   (MIJOZ_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY -- allaqachon bor)
//
// Chaqirish (IKKITA alohida cron job kerak, kuniga 2 marta):
//   Ertalab (masalan 09:00): GET /api/usta-eslatma?secret=<SECRET>&vaqt=ertalab
//   Kechqurun (masalan 17:00): GET /api/usta-eslatma?secret=<SECRET>&vaqt=kechqurun
//   (`vaqt` berilmasa -- "ertalab" matni ishlatiladi)

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

function eslatmaMatni(vaqt) {
  if (vaqt === 'kechqurun') {
    return "🌇 Assalomu alaykum, hurmatli ustalar!\n\n" +
      "Agar bugungi kun uchun hali video yoki rasm hisobotingizni tashlamagan bo'lsangiz, iltimos hozir yuborib qo'ying.\n\n" +
      "Mehnatingiz biz uchun juda qadrli — xalol ishingiz uchun rahmat, kuch-quvvat tilaymiz! 💪🙏";
  }
  return "🌅 Xayrli tong, hurmatli ustalar!\n\n" +
    "Bugungi bajarilgan ishlar bo'yicha video yoki rasm hisobotini shu guruhga tashlab qo'yishingizni so'raymiz.\n\n" +
    "Agar o'zaro biror narsani muhokama qilish yoki ma'lumot almashish kerak bo'lsa, buni faqat MATN (yozma xabar) orqali qiling.\n\n" +
    "Halol mehnatingiz uchun rahmat — ishlab charchamang! 💪🙏";
}

async function handle({ request, env }) {
  const url = new URL(request.url);
  const secret = request.headers.get('X-Usta-Secret') || url.searchParams.get('secret');
  if (!env.USTA_ESLATMA_SECRET || secret !== env.USTA_ESLATMA_SECRET) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }
  const vaqt = url.searchParams.get('vaqt') || 'ertalab';
  const matn = eslatmaMatni(vaqt);

  let guruhlar;
  try {
    guruhlar = await sbFetch(env, 'usta_guruhlar?select=telegram_chat_id');
  } catch (e) {
    return json({ ok: false, error: 'supabase_xato' }, 500);
  }

  let yuborildi = 0;
  for (const g of guruhlar || []) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: g.telegram_chat_id, text: matn }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) yuborildi += 1;
    } catch (e) {
      // bitta guruhda xato bo'lsa ham, qolganlariga davom etamiz
    }
  }

  return json({ ok: true, yuborilgan_guruhlar: yuborildi });
}

export async function onRequestGet(context) {
  try {
    return await handle(context);
  } catch (e) {
    return json({ ok: false, error: 'server_error' }, 500);
  }
}

export async function onRequestPost(context) {
  return onRequestGet(context);
}
