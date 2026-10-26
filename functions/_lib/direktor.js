// Direktor agenti: egasi bilan chatda gaplashadi, vazifalarni agentlarga taqsimlaydi, muammo/natijani o'zi xabar qiladi.
// Saqlash (nashr_navbati): direktor_xabar (chat tarixi), direktor_vazifa (holat 'ochiq'|'bajarildi'), direktor_holat (ogohlantirish dedupe).
const q = async (env, path, init = {}) => {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`sb ${r.status}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
};
const post = (env, turi, holat, payload) => q(env, 'nashr_navbati', { method: 'POST', body: JSON.stringify([{ turi, holat, nashr_vaqti: new Date().toISOString(), payload }]) });

export const AGENT_NOM = { senarist: 'Senarist', montajchi: 'Montajchi', smm: 'SMM', targetolog: 'Targetolog', mijoz: 'Mijozlar menejeri', nazorat: 'Nazoratchi', seo: 'SEO agenti' };

export async function direktorTarix(env, n = 40) {
  const r = await q(env, `nashr_navbati?turi=eq.direktor_xabar&select=id,payload,created_at&order=id.desc&limit=${n}`).catch(() => []);
  return (r || []).reverse().map((x) => ({ id: x.id, ...x.payload }));
}
export async function vazifalarOchiq(env) {
  const r = await q(env, 'nashr_navbati?turi=eq.direktor_vazifa&holat=eq.ochiq&select=id,payload,created_at&order=id.desc&limit=20').catch(() => []);
  return (r || []).map((x) => ({ id: x.id, agent: x.payload.agent, matn: x.payload.matn, sana: String(x.created_at).slice(0, 10) }));
}
export async function vazifaTayyor(env, id) {
  await q(env, `nashr_navbati?id=eq.${Number(id)}&turi=eq.direktor_vazifa`, { method: 'PATCH', body: JSON.stringify({ holat: 'bajarildi' }) });
}

export async function direktorChat(env, text, holat) {
  if (!env.ANTHROPIC_API_KEY) return { javob: 'ANTHROPIC_API_KEY sozlanmagan.', taklif: [], xato: true };
  const [tarix, vaz] = await Promise.all([direktorTarix(env, 12), vazifalarOchiq(env)]);
  const ctx = holat.agentlar.filter((a) => a.id !== 'direktor').map((x) => `${x.id} (${x.nom}): ${x.h} — ${x.i}`).join('\n');
  const vz = vaz.length ? vaz.map((v) => `#${v.id} → ${v.agent}: ${v.matn}`).join('\n') : "yo'q";
  const hist = tarix.map((m) => `${m.rol === 'u' ? 'Egasi' : 'Direktor'}: ${m.t}`).join('\n');
  const prompt = `Siz Visart Design (Toshkent, arxitektura va interyer studiyasi) agent kompaniyasining DIREKTORISIZ. Egasi (Doston) vazifa beradi; siz uni tushunib, to'g'ri agentlarga taqsimlaysiz va natijani qisqa xabar qilasiz.
Agentlar (id):
${ctx}
Ochiq vazifalar:
${vz}
Oxirgi suhbat:
${hist || '(yangi suhbat)'}

Qoidalar: qisqa, aniq o'zbekcha (2-5 gap). Faqat yuqoridagi holatga tayaning, raqam o'ylab topmang. Noaniq bo'lsa BITTA aniqlashtiruvchi savol bering.
Egasining talabi bo'yicha har bir agentga topshiriq tuzing ("buyruqlar"):
- amal "reel": Senarist yangi reel senariysi tayyorlaydi (agent=senarist). Pul/resurs ketadi — egasi tasdiqlaydi.
- amal "animatsiya": Montajchi yangi animatsiya (agent=montajchi). Egasi tasdiqlaydi.
- amal "vazifa": boshqa har qanday topshiriq — vazifa ro'yxatiga yoziladi (agent: ${Object.keys(AGENT_NOM).join('/')}). "matn" — agentga aniq, qisqa topshiriq.
Barcha tasdiqlar ilovada: Boshqaruv → Tasdiq (senariy, tayyor video, reklama, SEO loyiha). Botdagi tugmalar ham ishlaydi. Texnik xato yoki tizim nosozligi uchun vazifa YARATMANG — shunchaki egasiga ayting.
Rasm yuklash (SEO) uchun egasi ilovadagi SEO agent bo'limidan rasm yuboradi — shuni ayting.
Agar egasi shunchaki savol bersa, buyruqlar bo'sh bo'lsin. Pul sarflashni (reklama) o'zingiz boshlamaysiz.
FAQAT JSON: {"javob":"...","buyruqlar":[{"agent":"senarist","amal":"reel","matn":"..."}]}

Egasi: ${text}`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 900, messages: [{ role: 'user', content: prompt }] }), signal: AbortSignal.timeout(45000) });
    if (!r.ok) return { javob: `Claude API xatosi (${r.status}).`, taklif: [], xato: true };
    const d = await r.json();
    const raw = '' + (((d.content || []).find((x) => x.type === 'text') || {}).text || '');
    const m = raw.match(/\{[\s\S]*\}/); const j = m ? JSON.parse(m[0]) : null;
    if (!j || !j.javob) return { javob: raw.slice(0, 500), taklif: [] };
    const taklif = [];
    for (const b of (j.buyruqlar || []).slice(0, 5)) {
      const agent = AGENT_NOM[b.agent] ? b.agent : null; if (!agent) continue;
      const matn = String(b.matn || '').slice(0, 300);
      if (b.amal === 'reel' && agent === 'senarist') taklif.push({ agent, amal: 'reel', matn });
      else if (b.amal === 'animatsiya' && agent === 'montajchi') taklif.push({ agent, amal: 'animatsiya', matn });
      else if (matn) { const rr = await post(env, 'direktor_vazifa', 'ochiq', { agent, matn }).catch(() => null); taklif.push({ agent, amal: 'vazifa', matn, id: rr && rr[0] && rr[0].id }); }
    }
    return { javob: String(j.javob).slice(0, 1200), taklif };
  } catch (e) { return { javob: "Javob olinmadi, qayta urinib ko'ring.", taklif: [], xato: true }; }
}

export async function direktorYoz(env, rol, t, taklif) { await post(env, 'direktor_xabar', 'xabar', { rol, t: String(t).slice(0, 1500), taklif: taklif || null, vaqt: new Date().toISOString() }).catch(() => {}); }

// Cron (15 daqiqada): muhim holatni direktor o'zi xabar qiladi (Telegram + ilova chati). Bir xil ogohlantirish 6 soatda bir marta.
export async function direktorKuzat(env) {
  const admin = String(env.ADMIN_TELEGRAM_IDS || '').split(',')[0].trim(); if (!admin || !env.MIJOZ_BOT_TOKEN) return;
  const [seoX, fotoX, tay, tk, hol] = await Promise.all([
    q(env, 'nashr_navbati?turi=eq.seo_loyiha&holat=eq.seo_xato&select=id&limit=20').catch(() => []),
    q(env, 'nashr_navbati?turi=eq.foto_ish&holat=eq.foto_xato&select=id&limit=50').catch(() => []),
    q(env, 'nashr_navbati?turi=eq.video_nashr&holat=eq.tasdiq_kutilmoqda&select=id&limit=50').catch(() => []),
    q(env, 'media_taklif?holat=eq.kutilmoqda&select=id&limit=50').catch(() => []),
    q(env, 'nashr_navbati?turi=eq.direktor_holat&select=id,payload&limit=1').catch(() => []),
  ]);
  const media = await fetch(`${env.MEDIA_SERVER_URL}/health`, { signal: AbortSignal.timeout(4000) }).then((r) => r.ok).catch(() => false);
  const sent = (hol && hol[0] && hol[0].payload && hol[0].payload.sent) || {};
  const A = [];
  if (!media) A.push(['media', "⚠️ Doston, media-server (kompyuter) javob bermayapti. Video va rasm ishlari to'xtab turibdi — kompyuter yoqilganini tekshirsangiz."]);
  if (seoX.length) A.push(['seo:' + seoX.map((x) => x.id).join('.'), `⚠️ SEO agenti ${seoX.length} ta loyihani saytga joylay olmadi. /seo orqali qayta urinib ko'ring yoki menga yozing.`]);
  if (fotoX.length) A.push(['foto:' + fotoX.length, `⚠️ Xaritalarga rasm yuklashda ${fotoX.length} ta xato bor. Botda /foto → Holat, so'ng /foto_qayta. (Sessiya tugagan bo'lsa foto_kirish.bat)`]);
  if (tay.length) A.push(['tayyor:' + tay.map((x) => x.id).join('.'), `🎬 ${tay.length} ta tayyor video sizning tasdig'ingizni kutmoqda. Ilovada Boshqaruv → Tasdiq.`]);
  if (tk.length) A.push(['senariy:' + tk.map((x) => x.id).join('.'), `📝 ${tk.length} ta senariy tasdiq kutmoqda.`]);
  const now = Date.now(), yuborildi = [];
  for (const [k, t] of A) {
    if (sent[k] && now - sent[k] < 6 * 3600e3) continue;
    sent[k] = now; yuborildi.push(t);
  }
  for (const k of Object.keys(sent)) if (now - sent[k] > 48 * 3600e3) delete sent[k];
  if (!yuborildi.length) return;
  const matn = '👔 Direktor:\n' + yuborildi.join('\n');
  await fetch(`https://api.telegram.org/bot${env.MIJOZ_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: admin, text: matn }), signal: AbortSignal.timeout(10000) }).catch(() => {});
  await direktorYoz(env, 'd', yuborildi.join('\n'));
  if (hol && hol[0]) await q(env, `nashr_navbati?id=eq.${hol[0].id}`, { method: 'PATCH', body: JSON.stringify({ payload: { sent } }) }).catch(() => {});
  else await post(env, 'direktor_holat', 'holat', { sent }).catch(() => {});
}
