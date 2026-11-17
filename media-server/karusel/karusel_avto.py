# Visart: Instagram karusel avtomatik yaratuvchi (PC, Claude tokensiz).
#   python karusel_avto.py --rejim loyiha   (dushanba: chorshanba 19:30 karuseli)
#   python karusel_avto.py --rejim maslahat (payshanba: shanba 11:00 "Arxitektor maslahati")
#   qo'shimcha: --quruq (yuklamaydi, navbatga yozmaydi), --mavzu <papka nomi>, --loyiha <katalog kaliti>, --majbur
# Oqim: matn/rasm tanlash (Gemini) -> dizayn (Playwright) -> Supabase public-media/karusel/<sana_nom>/
#       -> nashr_navbati(instagram_karusel, tasdiq_kutilmoqda) -> Telegramda adminga tasdiq tugmalari (krs:<id>:ok|no).
import argparse, base64, datetime as dt, glob, hashlib, io, json, os, re, sys, time, traceback

import requests
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import karusel_dizayn as D  # noqa: E402

DOCS = os.environ.get('KAR_DOCS', r'C:\Users\Visart\Documents')
STUDIO = os.path.join(DOCS, 'Visart_AI_Studio')
MS = os.path.join(DOCS, r'visart-server-kurulum\media-server')
KATALOG = os.path.join(STUDIO, r'portfolio\portfolio_katalog.json')
ANIM = os.path.join(STUDIO, r'kontent\animatsiya')
LOY = os.path.join(STUDIO, 'loyihalar')
HOLAT = os.path.join(HERE, 'karusel_holat.json')
POOL = os.path.join(HERE, 'karusel_pool.json')
OUT = os.path.join(HERE, 'out')
TZ = dt.timezone(dt.timedelta(hours=5))
ROOTS = {'D': r'D:\1_WORK', 'E1': r'E:\1_WORK', 'ER': r'E:\RENDER'}
SLOT = {'loyiha': (2, 19, 30), 'maslahat': (5, 11, 0)}  # (weekday: Mon=0, soat, daqiqa) Toshkent
HASHTAG = '#visartdesign #interyerdizayn #dizayn #toshkent #remont #arxitektura #interior #uzbekistan #3dvizualizatsiya #kvartira'
KONTAKT = "\u2709\ufe0f t.me/visartadmin\n\U0001F4DE +998 97 402 15 15\n\U0001F310 visartdesign.uz"
XONALAR = ['dahliz', "yo'lak", 'mehmonxona', 'ovqatlanish', 'oshxona', 'kabinet', 'xojalik xonasi', 'yotoqxona', 'bolalar xonasi', 'garderob', 'hammom', 'balkon', 'fasad', 'hovli', 'ofis', 'boshqa']
XONA_TARTIB = {x: i for i, x in enumerate(XONALAR)}

SECRETS = []


def log(*a):
    s = ' '.join(str(x) for x in a)
    for k in SECRETS:
        if k:
            s = s.replace(k, '***')
    line = '%s %s' % (dt.datetime.now(TZ).strftime('%H:%M:%S'), s)
    print(line, flush=True)
    try:
        os.makedirs(os.path.join(HERE, 'log'), exist_ok=True)
        with open(os.path.join(HERE, 'log', 'karusel_%s.log' % dt.datetime.now(TZ).strftime('%Y%m')), 'a', encoding='utf-8') as f:
            f.write(line + '\n')
    except Exception:
        pass


# ---------- kalitlar ----------
def kalitlar():
    k = json.load(open(os.path.join(MS, '_env_kesh.json'), encoding='utf-8'))
    if not k.get('GEMINI_API_KEY'):
        for l in open(os.path.join(MS, '.env'), encoding='utf-8').read().splitlines():
            if l.startswith('GEMINI_API_KEY='):
                k['GEMINI_API_KEY'] = l.split('=', 1)[1].strip().strip('"\'')
    for n in ('SUPABASE_SERVICE_ROLE_KEY', 'MIJOZ_BOT_TOKEN', 'GEMINI_API_KEY'):
        SECRETS.append(k.get(n))
    return k


K = {}


def sb_h(extra=None):
    h = {'apikey': K['SUPABASE_SERVICE_ROLE_KEY'], 'Authorization': 'Bearer ' + K['SUPABASE_SERVICE_ROLE_KEY']}
    h.update(extra or {})
    return h


def sb_get(path):
    r = requests.get('%s/rest/v1/%s' % (K['SUPABASE_URL'], path), headers=sb_h(), timeout=30)
    r.raise_for_status()
    return r.json()


def sb_post(path, body):
    r = requests.post('%s/rest/v1/%s' % (K['SUPABASE_URL'], path), headers=sb_h({'Content-Type': 'application/json', 'Prefer': 'return=representation'}), data=json.dumps(body), timeout=30)
    r.raise_for_status()
    return r.json()


def sb_upload(path, data):
    r = requests.post('%s/storage/v1/object/public-media/%s' % (K['SUPABASE_URL'], path), headers=sb_h({'Content-Type': 'image/jpeg', 'x-upsert': 'true'}), data=data, timeout=120)
    r.raise_for_status()
    return '%s/storage/v1/object/public/public-media/%s' % (K['SUPABASE_URL'], path)


def tg(method, data=None, files=None):
    r = requests.post('https://api.telegram.org/bot%s/%s' % (K['MIJOZ_BOT_TOKEN'], method), data=data, files=files, timeout=120)
    j = r.json()
    if not j.get('ok'):
        raise RuntimeError('Telegram %s: %s' % (method, str(j)[:200]))
    return j


# ---------- Gemini ----------
BAD = set()


def duz(x):
    """Egri tutuq belgilarini oddiy ' ga keltiradi (tasdiqlangan uslub: o', g')."""
    if isinstance(x, str): return re.sub('[\u2018\u2019\u02bb\u02bc`\u00b4]', "'", x)
    if isinstance(x, list): return [duz(i) for i in x]
    if isinstance(x, dict): return {k: duz(v) for k, v in x.items()}
    return x


MODELLAR = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest']  # 2.5-flash endi yangi kalitlarga yopiq


def gemini(parts, schema, temperature=0.7, level='low'):
    """Modellar zanjiri: biri band/sekin/yopiq bo'lsa keyingisiga o'tadi."""
    last = ''
    for raund in range(3):
      if raund:
        log('Gemini band (%s) -- %d soniyadan keyin qayta' % (last, 25 * raund)); time.sleep(25 * raund); BAD.clear()
      for model in [m for m in MODELLAR if m not in BAD] or MODELLAR:
          gc = {'temperature': temperature, 'responseMimeType': 'application/json', 'responseSchema': schema, 'thinkingConfig': {'thinkingLevel': level}}
          for t in range(2):
              try:
                  r = requests.post('https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent' % model,
                                    headers={'x-goog-api-key': K['GEMINI_API_KEY'], 'Content-Type': 'application/json'},
                                    data=json.dumps({'contents': [{'role': 'user', 'parts': parts}], 'generationConfig': gc}), timeout=(30 if model == MODELLAR[0] else 100))
              except requests.exceptions.RequestException as e:
                  last = '%s: %s' % (model, str(e)[:80]); BAD.add(model); break
              if r.status_code == 400 and 'thinkingConfig' in gc:
                  gc.pop('thinkingConfig'); continue
              if r.status_code in (429, 500, 503):
                  last = '%s: HTTP %d' % (model, r.status_code); time.sleep(5); continue
              if r.status_code != 200:
                  last = '%s: HTTP %d %s' % (model, r.status_code, r.text[:120].replace('\n', ' ')); break
              try:
                  j = r.json()
                  txt = ''.join(p.get('text', '') for p in j['candidates'][0]['content']['parts'] if not p.get('thought'))
                  return duz(json.loads(txt))
              except Exception:
                  last = '%s: javob o\'qilmadi' % model; break
          log('Gemini %s -> keyingi model' % last)
    raise RuntimeError('Gemini javob bermadi: ' + last)


def thumb_part(path, side=720):
    im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
    im.thumbnail((side, side), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=80)
    return {'inline_data': {'mime_type': 'image/jpeg', 'data': base64.b64encode(b.getvalue()).decode()}}


def dhash(path):
    im = ImageOps.exif_transpose(Image.open(path)).convert('L').resize((9, 8), Image.LANCZOS)
    px = list(im.tobytes()); h = 0
    for r in range(8):
        for c in range(8):
            h = (h << 1) | (1 if px[r * 9 + c] > px[r * 9 + c + 1] else 0)
    return h


# ---------- holat ----------
def holat_oqi():
    try:
        return json.load(open(HOLAT, encoding='utf-8'))
    except Exception:
        return {'loyihalar': ['D:2024/OYBEKA 110 m2 kvartira'], 'mavzular': {}, 'rasm_oxirgi': [], 'tarix': []}


def holat_yoz(h):
    json.dump(h, open(HOLAT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def db_ishlatilgan():
    try:
        rows = sb_get('nashr_navbati?turi=eq.instagram_karusel&select=payload&order=id.desc&limit=200')
        return {(r.get('payload') or {}).get('kalit') for r in rows} - {None}
    except Exception as e:
        log('DB kalitlari o\'qilmadi: %s' % e); return set()


# ---------- rejalashtirilgan vaqt ----------
def reja_vaqti(rejim, band):
    wd, hh, mm = SLOT[rejim]
    now = dt.datetime.now(TZ)
    d = now.replace(hour=hh, minute=mm, second=0, microsecond=0) + dt.timedelta(days=(wd - now.weekday()) % 7)
    while d <= now + dt.timedelta(hours=3) or any(abs((d - b).total_seconds()) < 7200 for b in band):
        d += dt.timedelta(days=7)
    return d


def band_vaqtlar():
    try:
        rows = sb_get('nashr_navbati?turi=eq.instagram_karusel&holat=in.(kutilmoqda,bajarilmoqda,tasdiq_kutilmoqda)&select=nashr_vaqti')
        return [dt.datetime.fromisoformat(r['nashr_vaqti'].replace('Z', '+00:00')) for r in rows if r.get('nashr_vaqti')]
    except Exception as e:
        log('band vaqtlar o\'qilmadi: %s' % e); return []


# ---------- rasm tanlash ----------
RAD = re.compile(r'(diff|bump|refl|gloss|depth|mask|textur|normal|spec|zdepth|lightmix|wire|clay|material|seamless|alpha|cshading|rawtotal|vray|corona|reja|plan|_b\.|_d\.|_r\.)', re.I)
SINF = {'type': 'ARRAY', 'items': {'type': 'OBJECT', 'properties': {
    'i': {'type': 'INTEGER'}, 'haqiqiy': {'type': 'BOOLEAN'}, 'sifat': {'type': 'INTEGER'}, 'vertikal_mos': {'type': 'BOOLEAN'},
    'xona': {'type': 'STRING', 'enum': XONALAR}, 'tavsif': {'type': 'STRING'}}, 'required': ['i', 'haqiqiy', 'sifat', 'vertikal_mos', 'xona', 'tavsif']}}


def tasnif(paths):
    """Rasmlarni Gemini ko'rib baholaydi: [{path, haqiqiy, sifat, xona, tavsif, vertikal_mos}]"""
    natija = []
    for s in range(0, len(paths), 6):
        grp = paths[s:s + 6]
        parts = [{'text': (
            "You review architecture/interior visualization images for an Instagram portfolio. For EACH image return: "
            "haqiqiy = true ONLY for a finished photorealistic render of an interior or exterior (false for texture/material swatches, floor plans, drawings, CAD/viewport/clay/wireframe screenshots, collages, UI screenshots, people photos, logos); "
            "sifat = 1-10 (composition, lighting, cleanliness, no artifacts/noise, attractive); "
            "vertikal_mos = true if a center crop to 4:5 portrait still looks good; "
            "xona = room/zone from the enum; tavsif = what is visible in <=12 words (Uzbek or English). Use the given index i.")}]
        for j, p in enumerate(grp):
            parts.append({'text': 'i=%d' % j}); parts.append(thumb_part(p, 560))
        try:
            res = gemini(parts, SINF, 0.2, 'minimal')
        except Exception as e:
            log('tasnif xato: %s' % e); continue
        for r in res:
            if 0 <= r.get('i', -1) < len(grp):
                natija.append({'path': grp[r['i']], **{k: r[k] for k in ('haqiqiy', 'sifat', 'vertikal_mos', 'xona', 'tavsif')}})
    return natija


def rasm_ok(p):
    try:
        if os.path.getsize(p) > 60e6: return False
        w, h = Image.open(p).size
        return w >= 1200 and 0.55 <= w / h <= 2.2
    except Exception:
        return False


def tanla(tasn, maks):
    """Sifatli, xilma-xil, o'xshashsiz rasmlar (sifat kamayish tartibida)."""
    ok = [t for t in tasn if t['haqiqiy'] and t['sifat'] >= 7]
    ok.sort(key=lambda t: (-(t['sifat'] + (1 if t['vertikal_mos'] else 0))))
    tanlangan, soni, hashlar = [], {}, []
    for t in ok:
        if soni.get(t['xona'], 0) >= (3 if t['xona'] == 'boshqa' else 2): continue
        try: h = dhash(t['path'])
        except Exception: continue
        if any(bin(h ^ x).count('1') < 8 for x in hashlar): continue
        hashlar.append(h); soni[t['xona']] = soni.get(t['xona'], 0) + 1; tanlangan.append(t)
        if len(tanlangan) >= maks: break
    return tanlangan


# ---------- loyiha ----------
def loyiha_nomzodlari(holat, db_kalit):
    ishl = set(holat['loyihalar']) | db_kalit
    reel = []
    try: reel = [x.upper() for x in json.load(open(os.path.join(MS, r'loyihalar\ishlatilgan.json'), encoding='utf-8'))]
    except Exception: pass
    kat = json.load(open(KATALOG, encoding='utf-8'))
    nom = []
    for x in kat:
        k = x['loyiha']
        m = re.match(r'^D:(20\d\d)/', k)
        if not m or int(m.group(1)) < 2022 or x['render_soni'] < 20 or k in ishl: continue
        if re.search(r'UCHAST|UCHASK', k, re.I): continue
        reel_used = any(r in k.upper() for r in reel)
        nom.append((reel_used, -int(m.group(1)), -x['render_soni'], k, x))
    nom.sort(key=lambda z: z[:4])
    return [z[3:] for z in nom]


def loyiha_rasmlari(x):
    kal = x['loyiha']; tag, rest = kal.split(':', 1)
    root = ROOTS[tag]
    paths = []
    for rel in x['renderlar']:
        base = os.path.basename(rel)
        if RAD.search(base): continue
        p = os.path.join(root, *rel.split('/'))
        if os.path.exists(p): paths.append(p)
    names = {os.path.basename(p).lower() for p in paths}
    paths = [p for p in paths if not (re.search(r'( copy| копия)', os.path.basename(p), re.I) and re.sub(r'( copy| копия)', '', os.path.basename(p), flags=re.I).lower() in names)]
    paths = [p for p in paths if rasm_ok(p)]
    if len(paths) > 40:
        step = len(paths) / 40.0
        paths = [paths[int(i * step)] for i in range(40)]
    return paths


MATN_SCHEMA = {'type': 'OBJECT', 'properties': {
    'muqova': {'type': 'OBJECT', 'properties': {'l1': {'type': 'STRING'}, 'l2': {'type': 'STRING'}, 'sub': {'type': 'STRING'}}, 'required': ['l1', 'l2', 'sub']},
    'slaydlar': {'type': 'ARRAY', 'items': {'type': 'OBJECT', 'properties': {
        'rasmlar': {'type': 'ARRAY', 'items': {'type': 'INTEGER'}}, 'kick': {'type': 'STRING'}, 'sarlavha': {'type': 'STRING'}, 'izoh': {'type': 'STRING'}},
        'required': ['rasmlar', 'kick', 'sarlavha', 'izoh']}},
    'caption': {'type': 'STRING'}}, 'required': ['muqova', 'slaydlar', 'caption']}

UZ_QOIDA = ("Write in Uzbek, Latin script, plain everyday language, straight apostrophe (o', g'). NEVER use any digits (write numbers in words if really needed; the only exception: list markers like '1)' at line starts of the caption), "
            "no prices, no brands, no client names, no addresses, no dimensions/areas, no hashtags/phone in caption. Be concrete, not generic marketing clich\u00e9s.")


def sozlar(s): return len(re.findall(r"\S+", s))


def matn_xato(m, loyiha=True):
    x = []
    mu = m['muqova']
    if len(mu['l1']) > 20 or len(mu['l2']) > 18: x.append('muqova l1<=20 belgi, l2<=18 belgi bo\'lsin')
    if sozlar(mu['sub']) > 9: x.append('muqova sub <= 9 so\'z')
    for i, s in enumerate(m['slaydlar'], 1):
        if sozlar(s['sarlavha']) > 6: x.append('slayd %d sarlavha <= 6 so\'z' % i)
        if sozlar(s['izoh']) > 18: x.append('slayd %d izoh <= 18 so\'z' % i)
        if len(s['kick']) > 22: x.append('slayd %d kick <= 22 belgi' % i)
        if re.search(r'\d', s['sarlavha'] + s['izoh'] + s['kick'] if loyiha else s['sarlavha'] + s['izoh']): x.append('slayd %d da raqam bor' % i)
    if re.search(r'\d', mu['l1'] + mu['l2'] + mu['sub'] + re.sub(r'(?m)^\s*\d+\)\s*', '', m['caption'])): x.append('muqova/caption da raqam bor (faqat ro\'yxat belgisi 1) 2) mumkin)')
    if len(m['caption']) > 1500: x.append('caption <= 1500 belgi')
    return x


def loyiha_matn(tanl, cover):
    """tanl: tanlangan rasmlar (cover'dan tashqari). Qaytaradi: matn dict."""
    parts = [{'text': (
        "You are the senior designer of Visart Design (Tashkent) writing an Instagram carousel about one of our interior/architecture projects. "
        "Image 0 is the COVER image, images 1.. are for content slides. " + UZ_QOIDA + "\n"
        "For EVERY content slide present exactly ONE design solution that is clearly VISIBLE in its image(s) (material, colour, layout, lighting, storage, shape) plus its practical benefit for living (comfort, cleaning, light, storage, privacy, space). "
        "Never claim anything not visible. Compose 5-8 slides; each image index used at most once; put 2 images in one slide ONLY if they show the same room from different angles. "
        "Fields: kick = room/zone name, 1-2 words, <=18 chars; sarlavha = <=6 words, a concrete catchy phrase; izoh = <=18 words (solution + benefit). "
        "muqova: l1 = headline 2-4 words <=18 chars describing the project's character from the cover; l2 = short promise <=16 chars starting with an arrow like '\u2192 PREMIUM INTERYER' style (uppercase); sub = <=8 words like 'Har bir xonadan 1 ta yechim' style but without digits. "
        "caption: Instagram caption: line 1 hook <=12 words; blank line; 3-5 lines starting with '\u2022' naming key solutions; blank line; one line inviting to send their plan to get a similar project. <=900 chars.")}]
    for i, t in enumerate([cover] + tanl):
        parts.append({'text': 'Image %d (%s):' % (i, t['xona'])}); parts.append(thumb_part(t['path'], 900))
    fb = ''
    for t in range(3):
        m = gemini(parts + ([{'text': 'FIX THESE PROBLEMS from the previous attempt: ' + fb}] if fb else []), MATN_SCHEMA, 0.8, 'low')
        for s in m['slaydlar']:
            s['rasmlar'] = [r for r in s['rasmlar'] if 1 <= r <= len(tanl)][:2]
        m['slaydlar'] = [s for s in m['slaydlar'] if s['rasmlar']]
        err = matn_xato(m)
        used = [r for s in m['slaydlar'] for r in s['rasmlar']]
        if len(used) != len(set(used)): err.append('rasm indeksi takrorlandi')
        if not (5 <= len(m['slaydlar']) <= 8): err.append('slaydlar soni 5-8 bo\'lsin')
        if not err: return m
        fb = '; '.join(err); log('matn tuzatiladi: %s' % fb)
    raise RuntimeError('matn qoidalarga mos kelmadi: ' + fb)


def loyiha_karusel(args, holat):
    db_k = db_ishlatilgan()
    nomz = loyiha_nomzodlari(holat, db_k)
    if args.loyiha: nomz = [z for z in nomz if z[0] == args.loyiha] or [z for z in loyiha_nomzodlari({'loyihalar': []}, set()) if z[0] == args.loyiha]
    log('loyiha nomzodlari: %d' % len(nomz))
    for kal, x in nomz[:4]:
        log('loyiha: %s (%d render)' % (kal, x['render_soni']))
        paths = loyiha_rasmlari(x)
        log('  mos rasm: %d' % len(paths))
        if len(paths) < 8: continue
        tasn = tasnif(paths)
        pool_qosh(tasn)
        tanl = tanla(tasn, 10)
        log('  sifatli tanlangan: %d' % len(tanl))
        if len(tanl) < 7: continue
        # muqova: eng yuqori sifat + vertikal mos, keng xona (mehmonxona/fasad/oshxona) afzal
        cover = max(tanl, key=lambda t: t['sifat'] * 2 + (2 if t['vertikal_mos'] else 0) + (1 if t['xona'] in ('mehmonxona', 'fasad', 'oshxona') else 0))
        rest = [t for t in tanl if t is not cover]
        m = loyiha_matn(rest, cover)
        nom = re.sub(r'[^a-z0-9]+', '-', re.sub(r'^D:\d+/', '', kal).lower()).strip('-')[:30]
        return {'turi': 'loyiha', 'kalit': kal, 'nom': nom, 'cover': cover, 'rest': rest, 'matn': m, 'sarlavha': kal.split('/', 1)[1].title()}
    raise RuntimeError('yetarli sifatli renderli ishlatilmagan loyiha topilmadi')


def loyiha_slaydlar(r):
    m = r['matn']
    slaydlar = sorted(m['slaydlar'], key=lambda s: min(XONA_TARTIB.get(r['rest'][i - 1]['xona'], 99) for i in s['rasmlar']))
    N = len(slaydlar) + 2
    d = D.Dizayn(N)
    mu = m['muqova']
    pages = [d.cover(r['cover']['path'], 'LOYIHAMIZ \u00b7 3D', mu['l1'], mu['l2'], mu['sub'])]
    for n, s in enumerate(slaydlar, 2):
        ps = [r['rest'][i - 1]['path'] for i in s['rasmlar']]
        k = s['kick'].upper()
        pages.append(d.two(ps[0], ps[1], k, s['sarlavha'], s['izoh'], n) if len(ps) == 2 else d.full(ps[0], k, s['sarlavha'], s['izoh'], n))
    pages.append(d.cta(r['rest'][-1]['path'], N, "Saqlab qo'ying \u2014 remontda kerak bo'ladi"))
    caption = m['caption'].strip() + '\n\n' + KONTAKT + '\n\n' + HASHTAG
    return pages, caption, {'ishlatilgan_rasmlar': []}


# ---------- pool (maslahat fonlari) ----------
def pool_oqi():
    try: return json.load(open(POOL, encoding='utf-8'))
    except Exception: return {}


def pool_qosh(tasn):
    pl = pool_oqi()
    for t in tasn:
        if t['haqiqiy'] and t['sifat'] >= 7 and os.path.exists(t['path']):
            pl[t['path']] = {k: t[k] for k in ('sifat', 'vertikal_mos', 'xona', 'tavsif')}
    json.dump(pl, open(POOL, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)


def pool_toldir():
    """Lokal tayyor renderlar (Visart_AI_Studio\\loyihalar\\*\\NN_XXX.jpg, media-server\\loyihalar\\*\\N.jpg) hovuzga tasniflanadi."""
    pl = pool_oqi()
    cand = glob.glob(os.path.join(LOY, '*', '[0-9][0-9]_*.jpg')) + glob.glob(os.path.join(MS, 'loyihalar', '*', '[0-9].jpg'))
    yangi = [p for p in cand if p not in pl and rasm_ok(p)]
    log('hovuz: %d bor, %d yangi tasniflanadi' % (len(pl), len(yangi)))
    if yangi: pool_qosh(tasnif(yangi))
    return {p: v for p, v in pool_oqi().items() if os.path.exists(p)}


# ---------- maslahat ----------
def norm(s): return re.sub(r"[^a-z0-9\u0400-\u04ff ]+", '', re.sub(r"[\u02bb\u02bc\u2019'`]", '', s.lower()))


def shingles(s, n=5):
    w = norm(s).split()
    return {' '.join(w[i:i + n]) for i in range(len(w) - n + 1)}


MASLAHAT_SCHEMA = {'type': 'OBJECT', 'properties': {
    'muqova': MATN_SCHEMA['properties']['muqova'],
    'maslahatlar': {'type': 'ARRAY', 'items': {'type': 'OBJECT', 'properties': {
        'kick': {'type': 'STRING'}, 'sarlavha': {'type': 'STRING'}, 'izoh': {'type': 'STRING'}, 'xona': {'type': 'STRING', 'enum': XONALAR}},
        'required': ['kick', 'sarlavha', 'izoh', 'xona']}},
    'cta': {'type': 'STRING'}, 'caption': {'type': 'STRING'}}, 'required': ['muqova', 'maslahatlar', 'cta', 'caption']}


def mavzu_tanla(holat, args):
    fs = sorted(glob.glob(os.path.join(ANIM, '*', 'matn.json')))
    if not fs: raise RuntimeError('matn.json topilmadi')
    if args.mavzu:
        fs = [f for f in fs if args.mavzu in f] or fs
    db_k = db_ishlatilgan()
    def sanoq(f):
        kal = os.path.basename(os.path.dirname(f)); return (holat['mavzular'].get(kal, {}).get('soni', 0) + (1 if 'mavzu:' + kal in db_k else 0), kal)
    f = min(fs, key=sanoq)
    kal = os.path.basename(os.path.dirname(f))
    matn = ' '.join(x[1] for x in json.load(open(f, encoding='utf-8')))
    return kal, matn


def maslahat_karusel(args, holat):
    kal, skript = mavzu_tanla(holat, args)
    oldin = holat['mavzular'].get(kal, {}).get('sarlavhalar', [])
    log('mavzu: %s (oldin: %d marta)' % (kal, holat['mavzular'].get(kal, {}).get('soni', 0)))
    prompt = (
        "You are the chief architect of Visart Design (Tashkent) writing the 'Arxitektor maslahati' Instagram carousel (cover + 5 or 6 tip slides) based on the IDEAS of the source video script below. "
        + UZ_QOIDA + " Do NOT copy sentences or phrases from the script; rephrase fully in short carousel style. Use only ideas present in the script (no new facts); drop tariffs, dates, organisations, laws, news, prices. "
        "Each tip = one concrete action or one common mistake + why it matters (benefit). kick = 1-2 word topic label (<=18 chars, no digits; code adds the number); sarlavha <=6 words; izoh <=18 words. "
        "xona = which room type best illustrates the tip (for a background image). muqova: l1 <=18 chars catchy headline, l2 <=16 chars '\u2192 ...' promise (uppercase, no digits), sub <=8 words. "
        "cta = short line (<=8 words) urging to save the post. caption: hook <=12 words, blank line, numbered lines '1)' ... one per tip (short), blank line, one line CTA inviting to ask the architect; <=900 chars. "
        + ('Titles already used before for this topic (use a DIFFERENT angle): ' + '; '.join(oldin) + '. ' if oldin else '')
        + "\n\nSOURCE SCRIPT:\n" + skript)
    parts = [{'text': prompt}]
    fb = ''; sh = shingles(skript)
    for t in range(4):
        m = gemini(parts + ([{'text': 'FIX THESE PROBLEMS: ' + fb}] if fb else []), MASLAHAT_SCHEMA, 0.8, 'low')
        for s in m['maslahatlar']: s['kick'] = s['kick']
        err = matn_xato({'muqova': m['muqova'], 'slaydlar': m['maslahatlar'], 'caption': m['caption']}, loyiha=False)
        if not (5 <= len(m['maslahatlar']) <= 6): err.append('5 yoki 6 ta maslahat bo\'lsin')
        if re.search(r'\d', ' '.join(s['kick'] for s in m['maslahatlar'])): err.append('kick da raqam bor')
        bor = set()
        for s in m['maslahatlar']: bor |= shingles(s['sarlavha'] + '. ' + s['izoh'])
        bor |= shingles(m['caption'])
        if bor & sh: err.append("skriptdan so'zma-so'z 5 so'zli parcha takrorlandi: " + '; '.join(list(bor & sh)[:3]))
        if not err: break
        fb = '; '.join(err); log('maslahat matni tuzatiladi: %s' % fb)
    else:
        raise RuntimeError('maslahat matni qoidalarga mos kelmadi: ' + fb)
    return {'turi': 'maslahat', 'kalit': 'mavzu:' + kal, 'mavzu': kal, 'nom': re.sub(r'[^a-z0-9]+', '-', kal.split('_', 1)[-1].lower()), 'matn': m,
            'sarlavha': m['muqova']['l1']}


def maslahat_slaydlar(r, holat):
    m = r['matn']; pl = pool_toldir()
    if len(pl) < 8: raise RuntimeError('fon rasmlar hovuzi kichik (%d)' % len(pl))
    oxirgi = set(holat.get('rasm_oxirgi', []))
    ishl = set()
    def tanla_fon(xona):
        c = [(p, v) for p, v in pl.items() if p not in ishl and p not in oxirgi]
        if not c: c = [(p, v) for p, v in pl.items() if p not in ishl]
        pref = [x for x in c if x[1]['xona'] == xona] or c
        p = max(pref, key=lambda x: x[1]['sifat'] * 2 + (2 if x[1]['vertikal_mos'] else 0) + (hash(x[0]) % 7) / 7.0)[0]
        ishl.add(p); return p
    n_t = len(m['maslahatlar']); N = n_t + 2
    d = D.Dizayn(N)
    mu = m['muqova']
    cover_bg = tanla_fon('mehmonxona')
    pages = [d.cover(cover_bg, 'ARXITEKTOR MASLAHATI', mu['l1'], mu['l2'], mu['sub'])]
    for i, s in enumerate(m['maslahatlar'], 1):
        pages.append(d.full(tanla_fon(s['xona']), '%d \u00b7 %s' % (i, s['kick'].upper()), s['sarlavha'], s['izoh'], i + 1))
    pages.append(d.cta(tanla_fon('yotoqxona'), N, m['cta'].strip() or "Saqlab qo'ying \u2014 remontda kerak bo'ladi", kick='SAQLAB QO\'YING'))
    caption = m['caption'].strip() + '\n\n' + KONTAKT + '\n\n' + HASHTAG
    return pages, caption, {'ishlatilgan_rasmlar': sorted(ishl)}


# ---------- yuborish ----------
def tg_tasdiq(qid, r, urls_local, caption, vaqt, adm):
    tur = 'Loyiha karuseli' if r['turi'] == 'loyiha' else 'Arxitektor maslahati'
    n = len(urls_local)
    if n <= 10: album = urls_local
    else:
        album = [urls_local[0], D.kontakt_varaq(urls_local, os.path.join(os.path.dirname(urls_local[0]), 'sheet.jpg'))]
    media = [{'type': 'photo', 'media': 'attach://f%d' % i} for i in range(len(album))]
    media[0]['caption'] = '\U0001F4F8 %s \u2014 %d slayd' % (tur, n)
    fh = [open(p, 'rb') for p in album]
    try: tg('sendMediaGroup', {'chat_id': adm, 'media': json.dumps(media)}, {'f%d' % i: f for i, f in enumerate(fh)})
    finally:
        for f in fh: f.close()
    kun = ['dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba', 'yakshanba'][vaqt.weekday()]
    txt = '\U0001F4DD Instagram karusel \u2014 tasdiqlang\n\nTuri: %s\nMavzu: %s\nSlaydlar: %d\nJoylanish: %s (%s)\n\nCaption:\n\u2014\u2014\u2014\n%s' % (
        tur, r['sarlavha'], n, vaqt.strftime('%d.%m %H:%M'), kun, caption)
    tg('sendMessage', {'chat_id': adm, 'text': txt[:4000], 'disable_web_page_preview': 'true',
                       'reply_markup': json.dumps({'inline_keyboard': [[{'text': '\u2705 Joylash', 'callback_data': 'krs:%d:ok' % qid}, {'text': '\u274C Bekor', 'callback_data': 'krs:%d:no' % qid}]]})})


def asosiy(args):
    global K
    K = kalitlar()
    adm = K.get('ADMIN_CHAT_ID')
    holat = holat_oqi()
    band = band_vaqtlar()
    vaqt = reja_vaqti(args.rejim, band)
    if not args.majbur and not args.quruq:
        try:
            lo, hi = (vaqt - dt.timedelta(hours=12)).isoformat(), (vaqt + dt.timedelta(hours=12)).isoformat()
            bor = sb_get('nashr_navbati?turi=eq.instagram_karusel&holat=in.(kutilmoqda,tasdiq_kutilmoqda)&payload->>karusel_turi=eq.%s&nashr_vaqti=gte.%s&nashr_vaqti=lte.%s&select=id' % (args.rejim, requests.utils.quote(lo), requests.utils.quote(hi)))
            if bor: log('shu slot uchun karusel allaqachon bor (id=%s) -- o\'tkazib yuborildi' % bor[0]['id']); return
        except Exception as e:
            log('takror tekshiruvi: %s' % e)
    log('rejim=%s reja vaqti=%s' % (args.rejim, vaqt.strftime('%Y-%m-%d %H:%M')))
    r = loyiha_karusel(args, holat) if args.rejim == 'loyiha' else maslahat_karusel(args, holat)
    pages, caption, qosh = loyiha_slaydlar(r)[0:3] if args.rejim == 'loyiha' else maslahat_slaydlar(r, holat)
    sana = vaqt.strftime('%Y-%m-%d')
    papka = '%s_%s' % (sana, r['nom'])
    od = os.path.join(OUT, papka)
    slayd = D.render(pages, od, log=log)
    log('render tayyor: %d slayd -> %s' % (len(slayd), od))
    open(os.path.join(od, 'caption.txt'), 'w', encoding='utf-8').write(caption)
    if args.quruq: log('--quruq: yuklanmadi'); return
    urls = []
    for i, p in enumerate(slayd, 1):
        urls.append(sb_upload('karusel/%s/s%02d.jpg' % (papka, i), open(p, 'rb').read()))
    for u in urls[:2] + urls[-1:]:
        if requests.head(u, timeout=30).status_code != 200: raise RuntimeError('yuklangan rasm ochilmadi: ' + u.split('/public-media/')[-1])
    payload = {'rasmlar': urls, 'caption': caption, 'sarlavha': r['sarlavha'], 'adminChatId': int(adm) if str(adm).lstrip('-').isdigit() else adm,
               'karusel_turi': r['turi'], 'kalit': r['kalit'], 'slaydlar': len(urls), 'papka': papka}
    row = sb_post('nashr_navbati', [{'turi': 'instagram_karusel', 'payload': payload, 'nashr_vaqti': vaqt.astimezone(dt.timezone.utc).isoformat(), 'holat': 'tasdiq_kutilmoqda'}])
    qid = row[0]['id']
    log('navbatga yozildi: id=%s (tasdiq_kutilmoqda)' % qid)
    # holat
    if r['turi'] == 'loyiha': holat['loyihalar'].append(r['kalit'])
    else:
        mv = holat['mavzular'].setdefault(r['mavzu'], {'soni': 0, 'sarlavhalar': []})
        mv['soni'] += 1; mv['sarlavhalar'] += [s['sarlavha'] for s in r['matn']['maslahatlar']]
        holat['rasm_oxirgi'] = qosh.get('ishlatilgan_rasmlar', [])
    holat['tarix'].append({'sana': sana, 'turi': r['turi'], 'kalit': r['kalit'], 'id': qid})
    holat_yoz(holat)
    tg_tasdiq(qid, r, slayd, caption, vaqt, adm)
    log('Telegramga tasdiq yuborildi')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rejim', choices=['loyiha', 'maslahat'], required=True)
    ap.add_argument('--quruq', action='store_true'); ap.add_argument('--majbur', action='store_true')
    ap.add_argument('--mavzu'); ap.add_argument('--loyiha')
    args = ap.parse_args()
    lock = os.path.join(HERE, 'karusel.lock')
    if os.path.exists(lock) and time.time() - os.path.getmtime(lock) < 3 * 3600:
        log('boshqa jarayon ishlayapti (lock)'); return
    open(lock, 'w').write(str(os.getpid()))
    try:
        asosiy(args)
    except Exception as e:
        log('XATO: %s\n%s' % (e, traceback.format_exc()[-1500:]))
        try:
            if K.get('MIJOZ_BOT_TOKEN') and not args.quruq:
                tg('sendMessage', {'chat_id': K['ADMIN_CHAT_ID'], 'text': '\u26A0\uFE0F Karusel (%s) yaratilmadi: %s\nQo\'lda: karusel_avto.py --rejim %s' % (args.rejim, str(e)[:300], args.rejim)})
        except Exception as e2:
            log('adminga xabar ketmadi: %s' % e2)
        sys.exit(1)
    finally:
        try: os.remove(lock)
        except Exception: pass


if __name__ == '__main__':
    main()
