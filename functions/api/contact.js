import { saytXabar, lidQabulqiluvchilar, sozlanganmi } from '../_lib/tgNotify.js';
// Cloudflare Pages Function — /api/contact
// Har bir ariza: 1) bazaga (leads jadvali) yoziladi — admin panelda "Murojaatlar" bo'limida ko'rinadi;
// 2) Telegram botga yuboriladi (TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID sozlangan bo'lsa).
// Ikkalasidan biri muvaffaqiyatli bo'lsa, ariza qabul qilingan hisoblanadi.

function respond(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();

    // Spam-botlar uchun tuzoq: odam ko'rmaydigan maydon to'ldirilgan bo'lsa — jimgina qabul qilamiz.
    if (data.website) return respond({ ok: true });

    const name = (data.name || '').toString().trim().slice(0, 200);
    const phone = (data.phone || '').toString().trim().slice(0, 50);
    const service = (data.service || '').toString().trim().slice(0, 200);
    const message = (data.message || '').toString().trim().slice(0, 2000);
    const lang = (data.lang || '').toString().slice(0, 5);
    const digits = phone.replace(/\D/g, '');

    if (!name || digits.length < 9 || digits.length > 15) {
      return respond({ ok: false, error: 'invalid_fields' }, 400);
    }

    let saved = false;
    let sent = false;

    if (env.DB) {
      try {
        await env.DB.prepare(
          "INSERT INTO leads (name, phone, service, message, lang, status, created_at) VALUES (?, ?, ?, ?, ?, 'new', datetime('now'))"
        ).bind(name, phone, service, message, lang).run();
        saved = true;
      } catch (e) { /* jadval hali yaratilmagan bo'lishi mumkin — Telegram orqali davom etamiz */ }
    }

    if (sozlanganmi(env)) {
      const text =
        `🆕 Yangi ariza — Visart Design (sayt)\n\n` +
        `👤 Ism: ${name}\n` +
        `📞 Telefon: ${phone}\n` +
        `🛠 Xizmat: ${service || '—'}\n` +
        `📝 Loyiha: ${message || '—'}\n` +
        `🌐 Til: ${lang || '—'}`;
      sent = await saytXabar(env, lidQabulqiluvchilar(env), text);
    }

    if (!saved && !sent) return respond({ ok: false, error: 'not_delivered' }, 502);
    return respond({ ok: true });
  } catch (e) {
    return respond({ ok: false, error: 'server_error' }, 500);
  }
}
