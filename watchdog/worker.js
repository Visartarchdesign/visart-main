// Mustaqil "o'lik cron" qo'riqchisi (Cloudflare Worker, Cron Trigger: */30 * * * *).
// cron-job.org yoki Pages to'xtab qolsa ham ishlaydi, chunki ular bilan bog'liq emas.
// Secrets (wrangler secret put): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BOT_TOKEN, ADMIN_CHAT_ID
const TEKSHIRUV = [
  { nom: 'nashr', maxDaq: 60, izoh: 'nashr-navbati cron (har 15 daqiqa)' },
  { nom: 'kunlik', maxDaq: 25 * 60, izoh: 'kunlik hisobot cron (20:00)', faqatSoatdan: 21 }, // Toshkent 21:00 dan keyin tekshiriladi
];
async function ogohla(env, matn) {
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.ADMIN_CHAT_ID, text: matn }) }).catch(() => {});
}
export default {
  async scheduled(_e, env) {
    const tosh = new Date(Date.now() + 5 * 3600e3);
    const takror = Math.floor(Date.now() / 1800e3) % 12 === 0; // ogohlantirish har ~6 soatda takrorlanadi
    let rows;
    try {
      const r = await fetch(`${env.SUPABASE_URL}/rest/v1/bot_yurak?select=nom,oxirgi`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
      if (!r.ok) throw new Error(r.status);
      rows = await r.json();
    } catch (e) { if (takror) await ogohla(env, `🚨 Qo'riqchi: Supabase'ga ulanib bo'lmadi (${e.message}).`); return; }
    for (const t of TEKSHIRUV) {
      if (t.faqatSoatdan && tosh.getUTCHours() < t.faqatSoatdan) continue;
      const q = rows.find((x) => x.nom === t.nom);
      const daq = q ? (Date.now() - new Date(q.oxirgi).getTime()) / 60e3 : Infinity;
      if (daq > t.maxDaq && (takror || daq < t.maxDaq + 30)) await ogohla(env, `🚨 Qo'riqchi: ${t.izoh} ${q ? Math.round(daq / 60) + ' soatdan beri' : 'hali'} ishlamadi. cron-job.org va Cloudflare Pages'ni tekshiring.`);
    }
  },
};
