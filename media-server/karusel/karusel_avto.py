# Visart: Instagram karusel avtomatik yaratuvchi (PC, Claude tokensiz).
#   python karusel_avto.py --rejim loyiha   (dushanba: chorshanba 19:30 karuseli)
#   "Arxitektor maslahati" rejimi O'CHIRILGAN (Doston: karuselda faqat o'zimizning ishimiz, rasmga aloqasiz layfxak yo'q).
#   qo'shimcha: --quruq (yuklamaydi, navbatga yozmaydi), --loyiha <katalog kaliti>, --majbur
# Loyiha karuseli = BIR XONADONning renderlari xonama-xona (muqova, [reja], dahlizdan yotoqxonagacha, CTA); har slayd matni faqat shu rasmda ko'ringan narsa haqida.
# Oqim: rasm tanlash + slayd matni (Gemini, tekshiruv bilan) -> dizayn (Playwright) -> Supabase public-media/karusel/<sana_nom>/
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
HOLAT = os.path.join(HERE, 'karusel_holat.json')
OUT = os.path.join(HERE, 'out')
TZ = dt.timezone(dt.timedelta(hours=5))
ROOTS = {'D': r'D:\1_WORK', 'E1': r'E:\1_WORK', 'ER': r'E:\RENDER'}
SLOT = {'loyiha': (2, 19, 30)}  # (weekday: Mon=0, soat, daqiqa) Toshkent
HASHTAG = '#visartdesign #interyerdizayn #dizayn #toshkent #remont #arxitektura #interior #uzbekistan #3dvizualizatsiya #kvartira'
KONTAKT = "\u2709\ufe0f t.me/visartadmin\n\U0001F4DE +998 97 402 15 15\n\U0001F310 visartdesign.uz"
XONALAR = ['dahliz', "yo'lak", 'mehmonxona', 'ovqatlanish', 'oshxona', 'kabinet', 'xojalik xonasi', 'yotoqxona', 'bolalar xonasi', 'garderob', 'hammom', 'balkon', 'fasad', 'hovli', 'ofis', 'boshqa']

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

# Xonadon xonalari: karusel tartibi (dahliz -> mehmonxona -> oshxona -> xo'jalik -> hammom -> yotoqxonalar) va ko'rinadigan nomi.
LOY_TARTIB = ['dahliz', "yo'lak", 'mehmonxona', 'oshxona', 'ovqatlanish', 'xojalik xonasi', 'hammom', 'bolalar xonasi', 'yotoqxona', 'kabinet', 'garderob', 'balkon']
XONA_NOM = {'dahliz': 'Dahliz', "yo'lak": "Yo'lak", 'mehmonxona': 'Mehmonxona', 'oshxona': 'Oshxona', 'ovqatlanish': 'Ovqatlanish zonasi', 'xojalik xonasi': "Xo'jalik xonasi",
            'hammom': 'Hammom', 'bolalar xonasi': 'Bolalar xonasi', 'yotoqxona': 'Yotoqxona', 'kabinet': 'Kabinet', 'garderob': 'Garderob', 'balkon': 'Balkon'}
XONA_CAP = {'hammom': 4, 'yotoqxona': 5}  # boshqalar: 3 tagacha ({xona: eng ko'pi bilan rasm})
# fayl/papka nomidan xona (aniq so'zlar; "HOLL" bahsli -- Gemini hal qiladi)
HINT = [(r'sanuz|vanna|hammom|tualet|\bwc\b|bath', 'hammom'), (r'bolala|detsk|kids|child', 'bolalar xonasi'),
        (r'kladov|kir ?yuv|xojalik|xo.jalik|prachech|stirk', 'xojalik xonasi'), (r'dahliz|prixoj|prihozh|kirish|entrance', 'dahliz'),
        (r'kuxn|kuhn|oshxona|kitchen', 'oshxona'), (r'kabinet|cabinet', 'kabinet'), (r'garderob|dressing', 'garderob'),
        (r'yotoq|spaln|spalnya|bedroom', 'yotoqxona')]
TOLERANT = {'yotoqxona': {'yotoqxona', 'bolalar xonasi', 'garderob', 'kabinet'}, 'oshxona': {'oshxona', 'ovqatlanish'}, 'dahliz': {'dahliz', "yo'lak"}}
REL = {}  # rasm yo'li -> katalogdagi nisbiy yo'l (xona nomi uchun)


def xona_aniq(rel, g):
    s = (rel or '').lower()
    for rx, x in HINT:
        if re.search(rx, s):
            return g if g in TOLERANT.get(x, ()) else x
    return g


def otkir(path):
    """Qirralar dispersiyasi (o'tkirlik ko'rsatkichi)."""
    from PIL import ImageFilter, ImageStat
    im = ImageOps.exif_transpose(Image.open(path)).convert('L'); im.thumbnail((900, 900), Image.LANCZOS)
    return ImageStat.Stat(im.filter(ImageFilter.FIND_EDGES)).var[0]


def tasnif(paths):
    """Rasmlarni Gemini ko'rib baholaydi: [{path, haqiqiy, sifat, xona, tavsif, vertikal_mos}]"""
    natija = []
    for s in range(0, len(paths), 6):
        grp = paths[s:s + 6]
        parts = [{'text': (
            "You review architecture/interior visualization images for an Instagram portfolio. For EACH image return: "
            "haqiqiy = true ONLY for a finished photorealistic render of an interior or exterior (false for texture/material swatches, floor plans, drawings, CAD/viewport/clay/wireframe screenshots, collages, UI screenshots, people photos, logos); "
            "sifat = 1-10 (sharpness, lighting, composition, cleanliness, no artifacts/noise, attractive); "
            "vertikal_mos = true if a center crop to 4:5 portrait still looks good; "
            "xona = room/zone from the enum (kitchen with dining table -> oshxona; living room -> mehmonxona; utility/laundry/storage room -> xojalik xonasi; bathroom/WC -> hammom); tavsif = what is visible in <=12 words (Uzbek or English). Use the given index i.")}]
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


def tanla(tasn):
    """Xonadon renderlari: muqova + xona boshiga eng yaxshi 1-3 rakurs (o'xshashlari tashlanadi).
    Qaytaradi (cover, {xona: [t, ...]}) yoki (None, {})."""
    ok = []
    for lim in (7, 6):
        ok = [t for t in tasn if t['haqiqiy'] and t['sifat'] >= lim and t['xona'] in LOY_TARTIB]
        if len(ok) >= 10: break
    for t in ok:
        try: t['_o'] = otkir(t['path'])
        except Exception: t['_o'] = 0
    srt = sorted(t['_o'] for t in ok)
    for t in ok:
        t['ball'] = t['sifat'] + (0.5 if t['vertikal_mos'] else 0) + (srt.index(t['_o']) / max(1, len(srt) - 1) if len(srt) > 1 else 0)
    ok.sort(key=lambda t: -t['ball'])
    uniq, hashlar = [], []
    for t in ok:
        try: h = dhash(t['path'])
        except Exception: continue
        if any(bin(h ^ x).count('1') < 12 for x in hashlar): continue
        hashlar.append(h); uniq.append(t)
    if len(uniq) < 8: return None, {}
    pool = [t for t in uniq if t['xona'] in ('mehmonxona', 'oshxona', 'ovqatlanish', 'dahliz')] or uniq
    cover = max(pool, key=lambda t: t['ball'] + (1 if t['xona'] == 'mehmonxona' else 0))
    per = {}
    for t in uniq:
        if t is cover: continue
        if len(per.setdefault(t['xona'], [])) < XONA_CAP.get(t['xona'], 3): per[t['xona']].append(t)
    return cover, per


def slayd_sxema(per, maks):
    """Xona rasmlarini slaydlarga ajratadi: full() va two() aralash; jami slayd <= maks."""
    xl = [x for x in LOY_TARTIB if per.get(x)]
    rejim = {x: ('p' if (i % 2 == 1 and len(per[x]) >= 2) else 'f') for i, x in enumerate(xl)}
    def soni(x): k = len(per[x]); return k if rejim[x] == 'f' else (k + 1) // 2
    def jami(): return sum(soni(x) for x in xl)
    while jami() > maks:
        c = [x for x in xl if rejim[x] == 'f' and len(per[x]) >= 2]
        if c: rejim[max(c, key=lambda x: len(per[x]))] = 'p'; continue
        c = [x for x in xl if len(per[x]) >= 2]
        if not c: break
        x = max(c, key=lambda x: len(per[x])); per[x].pop()  # eng past ball (oxirgi)
    out = []
    for x in xl:
        l = per[x]
        if rejim[x] == 'f':
            out += [{'xona': x, 'paths': [t['path']]} for t in l]
        else:
            if len(l) == 3: out += [{'xona': x, 'paths': [l[0]['path']]}, {'xona': x, 'paths': [l[1]['path'], l[2]['path']]}]
            else: out += [{'xona': x, 'paths': [t['path'] for t in l[i:i + 2]]} for i in range(0, len(l), 2)]
    return out


# ---------- slayd matni: faqat rasmda ko'rinadigan narsa ----------
SL_SCHEMA = {'type': 'OBJECT', 'properties': {'sarlavha': {'type': 'STRING'}, 'izoh': {'type': 'STRING'}}, 'required': ['sarlavha', 'izoh']}
TEKSH_SCHEMA = {'type': 'OBJECT', 'properties': {
    'elementlar': {'type': 'ARRAY', 'items': {'type': 'OBJECT', 'properties': {'matn': {'type': 'STRING'}, 'korinadi': {'type': 'BOOLEAN'}}, 'required': ['matn', 'korinadi']}},
    'umumiy_maslahat': {'type': 'BOOLEAN'}}, 'required': ['elementlar', 'umumiy_maslahat']}
UZ_QOIDA = ("Write in Uzbek, Latin script, plain everyday language, straight apostrophe (o', g'). NEVER use any digits (write numbers in words if really needed), "
            "no prices, no brands, no client names, no addresses, no dimensions/areas. Be concrete, not generic marketing clich\u00e9s.")
TAQIQ = re.compile(r'(layfxak|lifehack|life hack|maslahat|tavsiya|esda tuting|unutmang|aytaylik|odatda|ko.pincha)', re.I)


def sozlar(s): return len(re.findall(r"\S+", s))


def slayd_xato(m):
    x = []
    if sozlar(m['sarlavha']) > 6 or not m['sarlavha'].strip(): x.append('sarlavha <= 6 so\'z')
    if sozlar(m['izoh']) > 18 or not m['izoh'].strip(): x.append('izoh <= 18 so\'z')
    if re.search(r'\d', m['sarlavha'] + m['izoh']): x.append('raqam bor')
    if TAQIQ.search(m['sarlavha'] + ' ' + m['izoh']): x.append('umumiy maslahat/layfxak so\'zlari bor')
    return x


def slayd_matn(xona, paths, oldingi=()):
    """Aynan shu rasm(lar)ga qarab matn yozadi, ikkinchi so'rovda tekshiradi; 2 marta o'tmasa neytral matn."""
    nom = XONA_NOM[xona]
    imgs = [thumb_part(p, 900) for p in paths]
    fb = (' Solutions already used on other slides - pick a DIFFERENT visible element (prefer materials, furniture, storage or layout over repeating lighting): ' + '; '.join(oldingi) + '.') if oldingi else ''
    baza = fb
    for urin in range(2):
        try:
            m = gemini([{'text': (
                "You write the text of ONE Instagram carousel slide for Visart Design (Tashkent). The attached image(s) show: %s. Look at the image(s) carefully. "
                "Describe exactly ONE design solution that is clearly VISIBLE in the attached image(s) (a material, colour, lighting, furniture layout, storage or shape) and its practical benefit for living. "
                "Mention ONLY objects, materials and features that you can actually see in the attached image(s); if you are not sure something is visible, leave it out. "
                "NO general advice, NO life-hacks, NO tips, nothing that is not in the picture. Name the visible element directly (e.g. its material, colour or position) - do not refer to things outside the frame. sarlavha: at most 6 words, concrete; izoh: at most 18 words (visible solution + benefit). " % nom
                + UZ_QOIDA + fb)}] + imgs, SL_SCHEMA, 0.7, 'low')
            err = slayd_xato(m)
            if not err:
                v = gemini([{'text': (
                    "You are a fact-checker for an interior design slide. The text below will be printed on a slide with the attached image(s) of: %s. "
                    "List every PHYSICAL thing the text names or claims is present: objects, furniture, materials, colours, light fixtures, finishes, shapes, layout features. For each set korinadi=true if it is clearly visible in the attached image(s), false if it is absent or you cannot see it. "
                    "IGNORE statements of benefit, comfort or feeling (e.g. 'convenient', 'looks spacious', 'easy to clean') - do not list them. "
                    "Set umumiy_maslahat=true ONLY if the text is an instruction/tip/life-hack addressed to the reader that does not describe anything in the image(s); a text that describes a visible element and its benefit is NOT general advice.\nTITLE: %s\nCAPTION: %s" % (nom, m['sarlavha'], m['izoh']))}] + imgs, TEKSH_SCHEMA, 0.1, 'low')
                bad = [e['matn'] for e in v['elementlar'] if not e['korinadi']]
                if v['elementlar'] and not bad and not v['umumiy_maslahat']:
                    return {'sarlavha': m['sarlavha'].strip(), 'izoh': m['izoh'].strip(), 'fallback': False}
                err = ['not visible in the image: ' + '; '.join(bad)] if bad else ['too generic / not specific to what is visible']
            fb = baza + ' The previous attempt (title=%r caption=%r) was REJECTED: %s. Write a different text that uses only clearly visible things.' % (m['sarlavha'], m['izoh'], '; '.join(err))
            log('  matn rad etildi (%s, urinish %d): %s <- %s | %s' % (nom, urin + 1, '; '.join(err)[:160], m['sarlavha'], m['izoh']))
        except Exception as e:
            log('  matn xato (%s): %s' % (nom, str(e)[:120]))
    return {'sarlavha': '%s \u2014 umumiy ko\'rinish' % nom, 'izoh': '', 'fallback': True}


# ---------- reja (oldin/keyin) ----------
PLAN_RX = re.compile(r'(reja|plan|oldin|keyin|planirov|layout)', re.I)
PLAN_SCHEMA = {'type': 'ARRAY', 'items': {'type': 'OBJECT', 'properties': {'i': {'type': 'INTEGER'}, 'tur': {'type': 'STRING', 'enum': ['oldin', 'keyin', 'boshqa']}}, 'required': ['i', 'tur']}}


def plan_topish(x, root):
    """Katalogda oldin/keyin reja rasmlari bo'lsa (ikkalasi ham) (oldin, keyin) yo'llari; aks holda None."""
    c = []
    for rel in x['renderlar']:
        if PLAN_RX.search(os.path.basename(rel)) and rel.lower().endswith(('.jpg', '.jpeg', '.png')):
            p = os.path.join(root, *rel.split('/'))
            if os.path.exists(p) and rasm_ok(p): c.append(p)
    c = c[:8]
    if len(c) < 2: return None
    parts = [{'text': "Classify each image: oldin = floor plan / top view of the ORIGINAL or empty state (before design, survey, bare shell); keyin = the FINAL furnished floor plan / top view of the designed apartment; boshqa = anything else (3D room render, texture, CAD screenshot with no clear plan, logo). Use the given index i."}]
    for j, p in enumerate(c): parts.append({'text': 'i=%d' % j}); parts.append(thumb_part(p, 700))
    try: res = gemini(parts, PLAN_SCHEMA, 0.1, 'minimal')
    except Exception as e: log('reja tasnif xato: %s' % e); return None
    o = [c[r['i']] for r in res if 0 <= r['i'] < len(c) and r['tur'] == 'oldin']
    k = [c[r['i']] for r in res if 0 <= r['i'] < len(c) and r['tur'] == 'keyin']
    return (o[0], k[0]) if o and k else None


# ---------- loyiha ----------
APT_RX = re.compile(r'KVARTIRA|XONADON|APARTAM', re.I)
EXCL_RX = re.compile(r'UCHAST|UCHASK|FASAD|OFIS|BUTIK|SHOW ?ROOM|SHTAB', re.I)


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
        if EXCL_RX.search(k): continue
        reel_used = any(r in k.upper() for r in reel)
        nom.append((not APT_RX.search(k), reel_used, -int(m.group(1)), -x['render_soni'], k, x))  # xonadon (kvartira) loyihalari birinchi
    nom.sort(key=lambda z: z[:5])
    return [z[4:] for z in nom]


XD_RX = re.compile(r'(\d+)[\s_-]*(?:qavat|kvartira|xonadon)', re.I)


def loyiha_rasmlari(x):
    """Bitta xonadonning renderlari (loyihada bir necha xonadon bo'lsa -- eng ko'pi)."""
    kal = x['loyiha']; tag, rest = kal.split(':', 1)
    root = ROOTS[tag]
    paths = []
    for rel in x['renderlar']:
        base = os.path.basename(rel)
        if RAD.search(base): continue
        p = os.path.join(root, *rel.split('/'))
        if os.path.exists(p): paths.append((p, rel))
    names = {os.path.basename(p).lower() for p, _ in paths}
    paths = [(p, r) for p, r in paths if not (re.search(r'( copy| \u043a\u043e\u043f\u0438\u044f)', os.path.basename(p), re.I) and re.sub(r'( copy| \u043a\u043e\u043f\u0438\u044f)', '', os.path.basename(p), flags=re.I).lower() in names)]
    paths = [(p, r) for p, r in paths if rasm_ok(p)]
    grp = {}
    for p, r in paths:
        m = XD_RX.search(r); grp.setdefault(m.group(0).lower() if m else '', []).append((p, r))
    if grp: paths = max(grp.values(), key=len)
    if len(paths) > 70:
        step = len(paths) / 70.0
        paths = [paths[int(i * step)] for i in range(70)]
    for p, r in paths: REL[p] = r
    return [p for p, _ in paths]


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
        for t in tasn: t['xona'] = xona_aniq(REL.get(t['path']), t['xona'])
        cover, per = tanla(tasn)
        if not cover: log('  sifatli xilma-xil rasm yetarli emas'); continue
        for t in [cover] + [t for l in per.values() for t in l]: log('  %s | %s | %s | %.1f' % (os.path.basename(t['path']), t['xona'], t['tavsif'][:40], t['ball']))
        plan = plan_topish(x, ROOTS[kal.split(':', 1)[0]])
        sx = slayd_sxema(per, 18 - (1 if plan else 0))
        if len(sx) < 6: continue
        used = []
        for s in sx:
            s['kick'] = XONA_KICK_UP(s['xona'])
            s.update(slayd_matn(s['xona'], s['paths'], used[-8:]))
            if not s['fallback']: used.append(s['sarlavha'])
            log('  [%s] %s | %s%s' % (s['kick'], s['sarlavha'], s['izoh'], ' (neytral)' if s['fallback'] else ''))
        nom = re.sub(r'[^a-z0-9]+', '-', re.sub(r'^D:\d+/', '', kal).lower()).strip('-')[:30]
        m = re.search(r'(\d{2,3})\s*(?:m2|m\u00b2|kv)', kal, re.I)
        return {'turi': 'loyiha', 'kalit': kal, 'nom': nom, 'cover': cover, 'slaydlar': sx, 'plan': plan,
                'maydon': m.group(1) if m else None, 'tur': 'KVARTIRA' if re.search('KVARTIRA', kal, re.I) else 'XONADON',
                'sarlavha': kal.split('/', 1)[1].title()}
    raise RuntimeError('yetarli sifatli renderli ishlatilmagan xonadon loyihasi topilmadi')


def XONA_KICK_UP(x): return XONA_NOM[x].upper().replace(' ZONASI', '')


def loyiha_slaydlar(r):
    sl = r['slaydlar']; plan = r.get('plan')
    N = len(sl) + 2 + (1 if plan else 0)
    d = D.Dizayn(N)
    nrasm = 1 + sum(len(s['paths']) for s in sl)
    if r['maydon']: l1, l2 = '%s m\u00b2 %s' % (r['maydon'], r['tur'].lower()), '\u2192 PREMIUM INTERYER'
    else: l1, l2 = 'Navbatdagi buyurtma:', '\u2192 ' + r['tur']
    pages = [d.cover(r['cover']['path'], 'LOYIHAMIZ \u00b7 3D', l1, l2, 'Xonama-xona \u2014 %d kadrda' % nrasm)]
    n = 2
    if plan: pages.append(d.plan(plan[0], plan[1], n, "Reja: oldingi holat va yangi joylashuv")); n += 1
    for s in sl:
        pages.append(d.two(s['paths'][0], s['paths'][1], s['kick'], s['sarlavha'], s['izoh'], n) if len(s['paths']) == 2 else d.full(s['paths'][0], s['kick'], s['sarlavha'], s['izoh'], n)); n += 1
    pages.append(d.cta(sl[-1]['paths'][0], N, "Saqlab qo'ying \u2014 remontda kerak bo'ladi"))
    bul = [s['sarlavha'] for s in sl if not s['fallback']][:5]
    caption = '\n'.join(["Navbatdagi buyurtma \u2014 bitta xonadon, xonama-xona.", ''] + ['\u2022 %s' % b for b in bul] + ['', "Rejangizni yuboring \u2014 shunday loyiha tayyorlab beramiz."]) + '\n\n' + KONTAKT + '\n\n' + HASHTAG
    return pages, caption, {}


# ---------- yuborish ----------
def tg_tasdiq(qid, r, urls_local, caption, vaqt, adm):
    tur = 'Loyiha karuseli'
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
    r = loyiha_karusel(args, holat)
    pages, caption, qosh = loyiha_slaydlar(r)
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
    holat['loyihalar'].append(r['kalit'])
    holat['tarix'].append({'sana': sana, 'turi': r['turi'], 'kalit': r['kalit'], 'id': qid})
    holat_yoz(holat)
    tg_tasdiq(qid, r, slayd, caption, vaqt, adm)
    log('Telegramga tasdiq yuborildi')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rejim', choices=['loyiha'], default='loyiha')
    ap.add_argument('--quruq', action='store_true'); ap.add_argument('--majbur', action='store_true')
    ap.add_argument('--loyiha')
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
