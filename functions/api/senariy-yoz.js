// B seriya senariysi v2: BITTA mavzuni chuqur ochadi (muammo -> qoida -> xato -> yechim -> tekshiruv), har bo'lim uchun vizual rejissura (kadr),
// so'ng alohida "rejissyor-tanqidchi" 10 ballik mezon bilan baholab qayta yozdiradi.
// POST {faza:'yoz', faktlar, renderlar:n, tajriba:{yoqdi:[],rad:[]}, qayta?:{senariy,tanqid:{kamchiliklar}}} -> {ok, senariy, buzilish[]}
// POST {faza:'baho', faktlar, senariy} -> {ok, ball, kamchiliklar[], mezonlar}   (+ X-Media-Secret)
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const MODELLAR = ['claude-opus-5-5', 'claude-sonnet-5'];
const soz = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;

async function claude(env, prompt, maxTokens = 3500) {
  let xato = 'model';
  for (const model of MODELLAR) {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }), signal: AbortSignal.timeout(90000) });
    if (!r.ok) { xato = `${model} ${r.status}`; continue; }
    const d = await r.json(); const t = '' + (((d.content || []).find((x) => x.type === 'text') || {}).text || '');
    const m = t.match(/\{[\s\S]*\}/); if (!m) { xato = 'json yoq'; continue; }
    try { return JSON.parse(m[0]); } catch (e) { xato = 'json xato'; }
  }
  throw new Error(xato);
}

const QOIDALAR = `ASOSIY TALAB: video BITTA mavzuni boshidan oxirigacha chuqur ochadi. Hook'da berilgan va'da shu mavzu bilan yopiladi. Boshqa mavzuga, boshqa xonaga yoki boshqa qoidaga O'TMANG. Har bo'lim oldingisidan mantiqan kelib chiqsin va keyingisiga sabab bersin.
TUZILMA (aynan shu tartib, rol nomlari bilan):
1. hook -- <=10 so'z: aniq sahna, raqam yoki ziddiyat ("Oshxonada 90 sm yetmaydi. Nega?"). "sir", "bilmagan", "3 ta" kabi bo'sh va'dalar TAQIQ.
2. muammo -- 25-35 so'z: uy egasi ko'zi bilan KONKRET kundalik holat (tirsak devorga tegadi, idish sig'maydi, ikki odam o'tolmaydi). Mavhum gap yo'q.
3. qoida -- 30-40 so'z: me'yor (aniq raqam bilan) va NEGA shunday: jismoniy/ergonomik sabab (odam qadami, qo'l uzunligi, eshik ochilishi). Raqamni faqat umume'tirof etilgan me'yordan yoki FAKTLARdan oling.
4. xato -- 25-35 so'z: odamlar shu qoidani qanday buzadi va buning ASL narxi (qayta qilish, tor joy, xavf).
5. yechim -- 30-40 so'z: AYNAN shu rejada nima qilingani, FAKTLARdagi o'lcham/joy bilan. "Visart Design" bilan boshlansin.
6. tekshiruv -- 20-30 so'z: tomoshabin o'z uyida shuni 1-2 harakatda qanday tekshiradi (lenta, qadam, qo'l). Foydali, bajariladigan.
7. oxir -- <=30 so'z: qisqa xulosa + "Tabriklayman, Visart Design bilan uyni to'g'ri loyihaladingiz" ma'nosi + Direct'ga KALIT SO'Z (REJA) deb yozing.
Jami ovoz 135-175 so'z (~55-65 soniya).
TIL: og'zaki, tabiiy o'zbekcha (lotin). Qisqa gaplar, bir gapda bitta fikr. Kitobiy so'zlar, "mazkur", "amalga oshiriladi", "Assalomu alaykum", "Bugungi videomizda" TAQIQ. Premium/luxury so'zlarini ishlatmang. Soxta statistika, narx, qo'rqitish TAQIQ. Mijoz va loyiha nomi tilga olinmasin.
HAR BO'LIM UCHUN "kadr" -- ovozda aytilayotgan narsani KO'RSATUVCHI vizual (tomoshabin rasmga qarab emas, animatsiya orqali tushunadi). Turlar:
 {"tur":"raqam","a":["Ko'pchilik qiladi",60],"b":["Norma",90],"birlik":"sm"}  -- ikki qiymatni animatsion taqqoslash (ustunlar o'sadi). Raqamlar ovozdagi bilan bir xil.
 {"tur":"reja","xona":"<FAKTLARdagi xona nomi>","elementlar":["e1","e2"]}  -- reja ustida kamera zonaga yaqinlashadi va FAKTLARdagi elementlar o'lcham chizig'i bilan chiziladi (elementlar faqat FAKTLAR.elementlar ichidagi id).
 {"tur":"render","rasm":<1..N>,"belgi":"<=3 so'z","joy":[x,y]}  -- render ustida yozuvli belgi (x,y 0..1). Faqat rasmda shu narsa ROSTDAN ko'ringanda.
Qoida: muammo -- raqam yoki render; qoida -- raqam; xato -- raqam yoki render; yechim -- reja (elementlar bilan); tekshiruv -- raqam; hook va oxir -- render. Ketma-ket ikki bir xil tur kamida bir marta almashsin. Har bo'limga "sar" (<=2 so'z sarlavha) va "tag" (<=6 so'z qisqa izoh) yozing.`;

function yozPrompt(b, qayta) {
  const t = b.tajriba || {};
  const ex = (a) => (a || []).slice(-5).map((x, i) => `${i + 1}) ${String(x).slice(0, 380)}`).join('\n');
  return `Siz Visart Design (Toshkent interyer/arxitektura studiyasi) uchun Instagram Reels senaristisiz. Auditoriya: kvartira/uy egalari. Maqsad: odam oxirigacha ko'rsin, saqlasin va do'stiga yuborsin; tomosha oxirida NIMA o'rganganini aniq his qilsin.
FAKTLAR (AutoCAD rejadan, o'ylab topilmagan): ${JSON.stringify(b.faktlar)}
Renderlar soni: ${b.renderlar} (1..${b.renderlar}).
${t.yoqdi && t.yoqdi.length ? `EGASI MA'QULLAGAN senariylar (shu didga yaqin yozing):\n${ex(t.yoqdi)}\n` : ''}${t.rad && t.rad.length ? `EGASI RAD ETGAN senariylar (bunday yozmang):\n${ex(t.rad)}\n` : ''}${(b.oxirgiMavzular || []).length ? `Yaqinda ishlatilgan mavzular (takrorlamang): ${b.oxirgiMavzular.join('; ')}\n` : ''}
VAZIFA: FAKTLARdagi eng boy dalilga (aniq o'lcham yozilgan element) ega BITTA dizayn qarorini tanlang va uni chuqur oching.
${QOIDALAR}
${qayta ? `\nOLDINGI VARIANT:\n${JSON.stringify(qayta.senariy)}\nREJISSYOR TANQIDI (hammasini tuzating, yaxshi tomonini saqlang): ${(qayta.tanqid.kamchiliklar || []).join(' | ')}\n` : ''}
Faqat JSON:
{"mavzu":"<bitta mavzu, 4-8 so'z>","hook":"...","oblojka":"<=6 so'z, mazmunga mos foyda, nom/'kvartirasi' yo'q","hero":<eng chiroyli render raqami>,"bolimlar":[{"rol":"muammo","sar":"...","tag":"...","ovoz":"...","kadr":{...}},{"rol":"qoida",...},{"rol":"xato",...},{"rol":"yechim",...},{"rol":"tekshiruv",...}],"oxir":"..."}`;
}

function tanqidPrompt(S, b) {
  return `Siz qattiq, tajribali Reels rejissyori va kontent-tanqidchisiz. Quyidagi senariyni 10 ballik mezon bilan BAHOLANG. Yumshoq bo'lmang: o'rtamiyona bo'lsa 6-7 qo'ying.
FAKTLAR: ${JSON.stringify(b.faktlar)}
SENARIY: ${JSON.stringify(S)}
MEZON (har biri 1-10):
1) yagona_mavzu -- hook va'dasi shu mavzu bilan yopiladimi, boshqa mavzuga sakramaydimi;
2) chuqurlik -- muammo -> sabab -> xato -> yechim -> tekshiruv mantiqiy zanjirmi, aniq raqam va misol bormi (sayoz umumiy gap emas);
3) hook -- scrollni to'xtatadimi, aniq va qiziqmi;
4) ogzaki_til -- tabiiy gapirma o'zbekcha, robot/kitobiy emasmi, qisqa gaplarmi;
5) vizual_moslik -- har bo'lim kadri ovozda aytilayotgan narsani tushuntiradimi (rasmni shunchaki ko'rsatmaydimi);
6) haqiqiylik -- raqamlar FAKTLARga yoki umume'tirof etilgan me'yorga mosmi, o'ylab topilgan narsa yo'qmi;
7) foyda -- tomoshabin nimani o'rgandi va nimani darrov qila oladi.
Umumiy "ball" = eng past 3 mezonning o'rtachasi. Faqat JSON: {"ball":<1-10>,"mezonlar":{...},"kamchiliklar":["aniq, bajariladigan tuzatish ko'rsatmasi", ...]}`;
}

function tekshir(S, b) {
  const x = [];
  const B = S.bolimlar || [];
  const rol = ['muammo', 'qoida', 'xato', 'yechim', 'tekshiruv'];
  if (B.length !== 5 || rol.some((r, i) => (B[i] || {}).rol !== r)) x.push('bolimlar: muammo, qoida, xato, yechim, tekshiruv tartibida 5 ta bo\'lsin');
  if (!S.hook || soz(S.hook) > 12) x.push('hook 10 so\'zdan oshmasin');
  const jami = soz(S.hook) + soz(S.oxir) + B.reduce((a, q) => a + soz(q.ovoz), 0);
  if (jami < 120 || jami > 190) x.push(`ovoz ${jami} so'z (135-175 bo'lsin)`);
  const ids = new Set(((b.faktlar || {}).elementlar || []).map((e) => e.id));
  B.forEach((q, i) => {
    const k = q.kadr || {};
    if (!['raqam', 'reja', 'render'].includes(k.tur)) x.push(`${i + 1}-bo'lim kadr turi noto'g'ri`);
    if (k.tur === 'reja') { k.elementlar = (k.elementlar || []).filter((e) => ids.has(e)); if (!k.elementlar.length) x.push(`${i + 1}-bo'lim: reja kadrida FAKTLAR.elementlar dan id yo'q`); }
    if (k.tur === 'render' && !(Number(k.rasm) >= 1 && Number(k.rasm) <= b.renderlar)) x.push(`${i + 1}-bo'lim: render raqami noto'g'ri`);
    if (k.tur === 'raqam' && !(Array.isArray(k.a) && Array.isArray(k.b) && Number(k.a[1]) > 0 && Number(k.b[1]) > 0)) x.push(`${i + 1}-bo'lim: raqam kadrida a/b qiymat yo'q`);
  });
  if (!/direct/i.test(S.oxir || '') || !/[A-ZА-Я]{3,}/.test(S.oxir || '')) x.push('oxirda Direct va KALIT SO\'Z (REJA) yo\'q');
  if (soz(S.oxir) > 32) x.push('oxir 30 so\'zdan oshmasin');
  if (!S.hero || Number(S.hero) < 1 || Number(S.hero) > b.renderlar) S.hero = 1;
  return x;
}

export async function onRequestPost({ request, env }) {
  if (!env.MEDIA_SECRET || request.headers.get('x-media-secret') !== env.MEDIA_SECRET) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!env.ANTHROPIC_API_KEY) return json({ ok: false, error: 'ANTHROPIC_API_KEY yoq' }, 500);
  let b; try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'json' }, 400); }
  if (!b.faktlar) return json({ ok: false, error: 'faktlar kerak' }, 400);
  try {
    if (b.faza === 'baho') {
      if (!b.senariy) return json({ ok: false, error: 'senariy kerak' }, 400);
      const T = await claude(env, tanqidPrompt(b.senariy, b), 1500);
      return json({ ok: true, ball: Number(T.ball) || 0, kamchiliklar: (T.kamchiliklar || []).slice(0, 6), mezonlar: T.mezonlar || {} });
    }
    if (!(b.renderlar > 0)) return json({ ok: false, error: 'renderlar kerak' }, 400);
    let S = await claude(env, yozPrompt(b, b.qayta || null));
    let x = tekshir(S, b);
    if (x.length) { S = await claude(env, yozPrompt(b, { senariy: S, tanqid: { kamchiliklar: x } })); x = tekshir(S, b); }
    return json({ ok: true, senariy: S, buzilish: x });
  } catch (e) { return json({ ok: false, error: String((e && e.message) || e).slice(0, 200) }, 502); }
}
