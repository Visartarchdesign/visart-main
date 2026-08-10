// Cloudflare Pages Function — /api/contact
// Sozlash: Cloudflare Pages loyihasi -> Settings -> Environment variables ga
//   TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID qo'shing (Production va Preview uchun), so'ng qayta deploy qiling.
// Bot yaratish: Telegram'da @BotFather -> /newbot. Chat ID olish: botga /start yozing,
//   so'ng https://api.telegram.org/bot<TOKEN>/getUpdates orqali chat.id ni ko'ring
//   (yoki guruh bo'lsa botni guruhga qo'shib xuddi shu usulda oling).

export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();
    const name = (data.name || '').toString().trim().slice(0, 200);
    const phone = (data.phone || '').toString().trim().slice(0, 50);
    const service = (data.service || '').toString().trim().slice(0, 200);
    const message = (data.message || '').toString().trim().slice(0, 2000);

    if (!name || !phone) {
      return new Response(JSON.stringify({ ok: false, error: 'missing_fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const text =
      `🆕 Yangi ariza — Visart Design\n\n` +
      `👤 Ism: ${name}\n` +
      `📞 Telefon: ${phone}\n` +
      `🛠 Xizmat: ${service || '—'}\n` +
      `📝 Loyiha: ${message || '—'}\n` +
      `🌐 Til: ${data.lang || '—'}`;

    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return new Response(JSON.stringify({ ok: false, error: 'not_configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    if (!tgRes.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'telegram_failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'server_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
