// Kompyuterdan kelgan nomzod rasmlarni AI baholaydi: faqat portfolioga munosib (sifatli, tugallangan render/foto) rasmlar qoladi.
// POST { nom, rasmlar: [{ i, b64 }] } + X-Media-Secret  ->  { ok, yaxshi: [i...], ballar: {i: ball}, xulosa }
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  if (!env.MEDIA_SECRET || request.headers.get('x-media-secret') !== env.MEDIA_SECRET) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!env.ANTHROPIC_API_KEY) return json({ ok: false, error: 'ANTHROPIC_API_KEY yoq' }, 500);
  let b; try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'json' }, 400); }
  const im = (b.rasmlar || []).slice(0, 24);
  if (!im.length) return json({ ok: false, error: 'rasm yoq' }, 400);
  const content = [];
  im.forEach((x, k) => { content.push({ type: 'text', text: `Rasm #${x.i}:` }); content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: x.b64 } }); });
  content.push({ type: 'text', text: `Sen premium arxitektura/interyer studiyasining art-direktorisan. Yuqoridagi ${im.length} ta rasm "${String(b.nom || '').slice(0, 60)}" loyihasidan nomzod. Saytdagi portfolio uchun har rasmni 1–10 ball bilan baho.
Yuqori ball (8–10): tugallangan, professional, real ko'rinadigan render yoki foto; yaxshi yoritish va kompozitsiya; to'g'ri perspektiva; toza, mantiqiy joylashgan mebel/detal; sifatli material; shovqin, artefakt, buzilgan geometriya yo'q.
Past ball (1–6): chizma/plan/eskiz, ekran skrinshoti, 3D dastur oynasi, tekstura/xarita, ishlanmagan (grey/clay/WIP) ko'rinish, xira yoki shovqinli, noto'g'ri yoritilgan, bo'sh/zerikarli kadr, boshqa studiya yoki mijoz ma'lumoti (logo, telefon, hujjat) ko'ringan, takroriy deyarli bir xil kadr.
Faqat 8+ ballilarni "yaxshi" ga qo'sh, eng yaxshisi birinchi, bir-biriga o'xshash kadrlardan faqat bittasini, ko'pi bilan 10 ta. Shubha bo'lsa — qo'shma.
Faqat JSON qaytar: {"ballar":{"<rasm raqami>":ball,...},"yaxshi":[raqamlar],"xulosa":"1 gap"}` });
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 1500, messages: [{ role: 'user', content }, { role: 'assistant', content: '{' }] }), signal: AbortSignal.timeout(100000) });
  if (!r.ok) return json({ ok: false, error: 'Claude API ' + r.status }, 502);
  const d = await r.json();
  const t = '{' + (((d.content || []).find((x) => x.type === 'text') || {}).text || '');
  const m = t.match(/\{[\s\S]*\}/); if (!m) return json({ ok: false, error: 'JSON emas' }, 502);
  let o; try { o = JSON.parse(m[0]); } catch (e) { return json({ ok: false, error: 'JSON xato' }, 502); }
  const ruxsat = new Set(im.map((x) => x.i));
  const ballar = o.ballar || {};
  const yaxshi = (o.yaxshi || []).map(Number).filter((i) => ruxsat.has(i) && Number(ballar[i]) >= 8).slice(0, 10);
  return json({ ok: true, yaxshi, ballar, xulosa: String(o.xulosa || '').slice(0, 200) });
}
