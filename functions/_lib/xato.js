// Xatolar jurnali + admin ogohlantirishi. Bir xil manba uchun ogohlantirish soatiga 1 martadan oshmaydi.
// Hech qachon xato tashlamaydi (asosiy ishni buzmasligi uchun).
const list = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);

export async function xatoYoz(env, manba, xato) {
  try {
    const xabar = String((xato && xato.message) || xato || '').slice(0, 500);
    const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
    let ogohla = true;
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const soatOldin = new Date(Date.now() - 3600e3).toISOString();
      const oldin = await fetch(`${env.SUPABASE_URL}/rest/v1/bot_xatolar?manba=eq.${encodeURIComponent(manba)}&created_at=gte.${soatOldin}&select=id&limit=1`, { headers: h, signal: AbortSignal.timeout(5000) })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (oldin && oldin.length) ogohla = false;
      await fetch(`${env.SUPABASE_URL}/rest/v1/bot_xatolar`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify([{ manba, xabar }]), signal: AbortSignal.timeout(5000) }).catch(() => {});
    }
    if (ogohla && env.MIJOZ_BOT_TOKEN) {
      const admin = list(env.ADMIN_TELEGRAM_IDS)[0];
      if (admin) await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: admin, text: `⚠️ Xato: ${manba}\n${xabar}` }), signal: AbortSignal.timeout(5000) }).catch(() => {});
    }
  } catch (e) { /* jim */ }
}

// ── Cron monitoringi ──
const shdr = (env) => ({ apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' });

export async function yurakYoz(env, nom) {
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/bot_yurak`, { method: 'POST', headers: { ...shdr(env), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ nom, oxirgi: new Date().toISOString() }]), signal: AbortSignal.timeout(5000) });
  } catch (e) { /* jim */ }
}

// nom oxirgi marta maxSoat soatdan oldin ishlagan bo'lsa admin'ga xabar. Jadval/qator yo'q bo'lsa jim.
export async function yurakTekshir(env, nom, maxSoat) {
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/bot_yurak?nom=eq.${encodeURIComponent(nom)}&select=oxirgi`, { headers: shdr(env), signal: AbortSignal.timeout(5000) });
    if (!r.ok) return;
    const rows = await r.json();
    if (!rows || !rows[0]) return;
    const soat = (Date.now() - new Date(rows[0].oxirgi).getTime()) / 3600e3;
    if (soat > maxSoat) await xatoYoz(env, `cron-ishlamayapti:${nom}`, `"${nom}" cron ${soat.toFixed(1)} soatdan beri ishlamadi (kutilgan: har ${maxSoat} soatda). cron-job.org va secretni tekshiring.`);
  } catch (e) { /* jim */ }
}
