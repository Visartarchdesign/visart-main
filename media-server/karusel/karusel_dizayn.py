# Visart Instagram karusel dizayni (tasdiqlangan uslub: kar.py / kar2.py bilan 1:1).
# Slayd = 1080x1350 JPEG. Matn avtomatik moslanadi (.fit) -- uzun matn tashqariga chiqmaydi.
import base64, html, io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, 'assets')
W, H = 1080, 1350


def _uri(path):
    return 'file:///' + path.replace('\\', '/').lstrip('/')


def prep_b64(path, maxside=2000, quality=90):
    """Katta renderni kichraytirib data-URI qiladi (xotira va tezlik uchun)."""
    from PIL import Image, ImageOps
    im = Image.open(path)
    im = ImageOps.exif_transpose(im).convert('RGB')
    if max(im.size) > maxside:
        im.thumbnail((maxside, maxside), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=quality)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def _logo():
    with open(os.path.join(ASSETS, 'logo-mark.png'), 'rb') as f:
        return 'data:image/png;base64,' + base64.b64encode(f.read()).decode()


def _fonts_css():
    fd = os.path.join(ASSETS, 'fonts')
    return (
        "@font-face{font-family:'Inter';src:url('%s') format('truetype');font-weight:100 900;font-style:normal}"
        "@font-face{font-family:'Playfair Display';src:url('%s') format('truetype');font-weight:400 900;font-style:normal}"
    ) % (_uri(os.path.join(fd, 'Inter.ttf')), _uri(os.path.join(fd, 'PlayfairDisplay.ttf')))


CSS = """*{box-sizing:border-box;margin:0;padding:0}html,body{width:1080px;height:1350px;overflow:hidden;background:#0b0c0f;font-family:Inter;color:#fff}
.bg{position:absolute;inset:0;background-size:cover;background-position:center}
.sh{position:absolute;inset:0}
.brand{z-index:5;position:absolute;top:52px;left:64px;display:flex;align-items:center;gap:14px;font-weight:700;font-size:24px;letter-spacing:6px;color:rgba(255,255,255,.92)}
.brand img{height:38px}
.cnt{z-index:5;position:absolute;top:56px;right:64px;font-size:22px;font-weight:600;letter-spacing:2px;color:rgba(255,255,255,.7)}
.kick{display:inline-block;font-weight:800;font-size:24px;letter-spacing:7px;color:#E8C27A;border:2px solid rgba(232,194,122,.55);padding:9px 22px;border-radius:40px}
.h{font-family:'Playfair Display';font-weight:800;line-height:1.05}
.gold{color:#E8C27A}.red{color:#FF4A3D}
.cap{position:absolute;left:64px;right:64px;bottom:72px}
.cap .t{font-family:'Playfair Display';font-weight:800;font-size:58px;line-height:1.08}
.cap .s{margin-top:16px;font-size:28px;line-height:1.4;color:rgba(255,255,255,.82)}
.line{width:72px;height:4px;background:#E8C27A;margin:22px 0}
.swipe{position:absolute;right:64px;bottom:64px;font-size:24px;font-weight:700;letter-spacing:3px;color:#E8C27A}
.nw{white-space:nowrap}
.cap .b{position:relative;padding-left:36px;margin-top:14px;font-size:30px;line-height:1.32;color:rgba(255,255,255,.93)}
.cap .b:before{content:'';position:absolute;left:0;top:.62em;width:20px;height:3px;background:#E8C27A}
.tag{z-index:5;position:absolute;left:64px;bottom:56px;font-weight:800;font-size:20px;letter-spacing:5px;color:#E8C27A;border:2px solid rgba(232,194,122,.55);padding:7px 16px;border-radius:30px;background:rgba(8,9,12,.4)}
"""

SHADE = 'linear-gradient(180deg,rgba(8,9,12,.75) 0%,rgba(8,9,12,0) 28%,rgba(8,9,12,0) 52%,rgba(8,9,12,.92) 100%)'
SHADE_INTRO = 'linear-gradient(180deg,rgba(8,9,12,.7) 0%,rgba(8,9,12,0) 20%,rgba(8,9,12,0) 34%,rgba(8,9,12,.88) 56%,rgba(8,9,12,.97) 100%)'
SHADE_CLEAN = 'linear-gradient(180deg,rgba(8,9,12,.6) 0%,rgba(8,9,12,0) 16%,rgba(8,9,12,0) 88%,rgba(8,9,12,.45) 100%)'
SHADE_COVER = 'linear-gradient(180deg,rgba(8,9,12,.88) 0%,rgba(8,9,12,.5) 45%,rgba(8,9,12,.1) 70%,rgba(8,9,12,.85) 100%)'


def esc(s):
    return html.escape(str(s), quote=False)


class Dizayn:
    def __init__(self, total):
        self.N = total
        self.logo = _logo()
        self._cache = {}

    def img(self, path):
        if path not in self._cache:
            self._cache[path] = prep_b64(path)
        return self._cache[path]

    def page(self, inner, n, bg=None, shade=SHADE):
        b = ('<div class=bg style="background-image:url(%s)"></div><div class=sh style="background:%s"></div>' % (bg, shade)) if bg else ''
        return ('<html><head><meta charset="utf-8"><style>%s%s</style></head><body>%s<div class=brand><img src="%s">VISART DESIGN</div>'
                '<div class=cnt>%d/%d</div>%s</body></html>') % (_fonts_css(), CSS, b, self.logo, n, self.N, inner)

    def cover(self, image, kick, l1, l2, sub, n=1):
        inner = ('<div style="position:absolute;left:64px;right:64px;top:260px"><div class=kick>%s</div>'
                 '<div class="h nw fit" style="font-size:100px;margin-top:30px">%s</div>'
                 '<div class="red nw fit" style="font-weight:900;font-size:84px;margin-top:8px">%s</div>'
                 '<div style="font-size:34px;margin-top:26px;color:rgba(255,255,255,.88)">%s</div></div><div class=swipe>VARAQLANG →</div>'
                 ) % (esc(kick), esc(l1), esc(l2), esc(sub))
        return self.page(inner, n, self.img(image), SHADE_COVER)

    def full(self, image, kick, t, s, n, pos='center'):
        inner = '<div class=cap><div class=kick>%s</div><div class=line></div><div class=t>%s</div>%s</div>' % (esc(kick), esc(t), ('<div class=s>%s</div>' % esc(s)) if s else '')
        return self.page(inner, n, self.img(image)).replace('background-position:center', 'background-position:%s' % pos)

    def intro(self, image, kick, bandlar, n, title=None):
        """Xona kirish slaydi: render + xona haqida 3-5 band (title faqat bandlar yo'q bo'lsa -- neytral sarlavha)."""
        body = ''.join('<div class=b>%s</div>' % esc(b) for b in bandlar) if bandlar else '<div class=t style="font-size:50px">%s</div>' % esc(title or '')
        inner = '<div class="cap intro"><div class=kick>%s</div><div class=line></div>%s</div>' % (esc(kick), body)
        return self.page(inner, n, self.img(image), SHADE_INTRO)

    def clean(self, image, kick, n):
        """Toza render: matnsiz, butun kadr; faqat logo, n/N va burchakda xona nomi."""
        return self.page('<div class=tag>%s</div>' % esc(kick), n, self.img(image), SHADE_CLEAN)

    def two(self, a, b, kick, t, s, n):
        inner = ('<img src="%s" style="position:absolute;left:0;top:0;width:539px;height:900px;object-fit:cover">'
                 '<img src="%s" style="position:absolute;left:541px;top:0;width:539px;height:900px;object-fit:cover">'
                 '<div class=sh style="background:linear-gradient(180deg,rgba(8,9,12,.7) 0%%,rgba(8,9,12,0) 18%%,rgba(8,9,12,0) 52%%,rgba(11,12,15,1) 67%%)"></div>'
                 '<div class=cap><div class=kick>%s</div><div class=line></div><div class=t>%s</div>%s</div>'
                 ) % (self.img(a), self.img(b), esc(kick), esc(t), ('<div class=s>%s</div>' % esc(s)) if s else '')
        return self.page(inner, n)

    def plan(self, oldin, keyin, n):
        """Reja slaydi: oldin+keyin ustma-ust (OLDIN qizil / KEYIN oltin teg) yoki bitta reja ("Reja"). Rasmlar object-fit:contain (yorliqlar kesilmasin)."""
        def box(top, hgt): return 'position:absolute;left:64px;top:%dpx;width:952px;height:%dpx;object-fit:contain;background:#15171c;border-radius:16px' % (top, hgt)
        def tag(top, st): return '<div style="position:absolute;left:84px;top:%dpx;font-weight:800;font-size:22px;letter-spacing:3px;padding:8px 16px;border-radius:8px;%s">%s</div>' % (top, st[0], st[1])
        if oldin and keyin:
            inner = ('<div style="position:absolute;left:64px;right:64px;top:140px"><div class=kick>REJA</div><div class=h style="font-size:60px;margin-top:20px">Oldin \u2192 keyin</div></div>'
                     '<img src="%s" style="%s">%s<img src="%s" style="%s">%s<div class=cap style="bottom:60px"><div class=s style="margin:0">Reja: oldingi holat va yangi joylashuv</div></div>'
                     ) % (self.img(oldin), box(300, 430), tag(316, ('background:#FF4A3D', 'OLDIN')), self.img(keyin), box(750, 430), tag(766, ('background:#E8C27A;color:#111', 'KEYIN')))
        else:
            inner = ('<div style="position:absolute;left:64px;right:64px;top:140px"><div class=kick>REJA</div><div class=h style="font-size:60px;margin-top:20px">Reja</div></div>'
                     '<img src="%s" style="%s">') % (self.img(oldin or keyin), box(300, 900))
        return self.page(inner, n)

    def cta(self, image, n, note, kick='NAVBATDAGI BUYURTMA — SIZNIKI'):
        inner = ('<div style="position:absolute;left:64px;right:64px;top:300px;text-align:center"><div class=kick>%s</div>'
                 '<div class=h style="font-size:84px;margin-top:40px">Rejangizni<br>yuboring —<br><span class=gold>ko\'rib beramiz</span></div>'
                 '<div style="margin-top:56px;font-size:34px;line-height:1.7;color:rgba(255,255,255,.9)">✉️ t.me/visartadmin<br>\U0001F4DE +998 97 402 15 15<br>\U0001F310 visartdesign.uz</div>'
                 '<div style="margin-top:44px;font-size:26px;color:rgba(255,255,255,.6)">%s</div></div>') % (esc(kick), esc(note))
        return self.page(inner, n, self.img(image), 'rgba(8,9,12,.86)')


FIT_JS = """() => {
  document.querySelectorAll('.fit').forEach(e => { let fs = parseFloat(getComputedStyle(e).fontSize); while (e.scrollWidth > e.clientWidth + 1 && fs > 36) { fs -= 2; e.style.fontSize = fs + 'px'; } });
  const ci = document.querySelector('.cap.intro');
  if (ci) { let fs = 30; const bs = ci.querySelectorAll('.b'); while (ci.getBoundingClientRect().top < 470 && fs > 22) { fs -= 1; bs.forEach(b => b.style.fontSize = fs + 'px'); } const tp = Math.round(ci.getBoundingClientRect().top); return tp < 420 ? tp : 9999; }
  const c = document.querySelector('.cap');
  if (c) { const t = c.querySelector('.t'); let fs = t ? parseFloat(getComputedStyle(t).fontSize) : 0; while (t && c.getBoundingClientRect().top < 560 && fs > 36) { fs -= 2; t.style.fontSize = fs + 'px'; } }
  return c ? Math.round(c.getBoundingClientRect().top) : -1;
}"""


def render(pages, outdir, prefix='s', quality=92, log=print):
    """pages: HTML satrlar ro'yxati -> outdir/s01.jpg ... ; yo'llar ro'yxatini qaytaradi."""
    from playwright.sync_api import sync_playwright
    os.makedirs(os.path.join(outdir, '_html'), exist_ok=True)
    out = []
    with sync_playwright() as p:
        try:
            b = p.chromium.launch()
        except Exception as e:  # playwright chromium o'rnatilmagan bo'lsa -- Windows'dagi Edge
            log('chromium yo\'q, Edge ishlatiladi: %s' % str(e)[:80])
            b = p.chromium.launch(channel='msedge')
        pg = b.new_page(viewport={'width': W, 'height': H})
        for i, h in enumerate(pages, 1):
            hp = os.path.join(outdir, '_html', '%s%02d.html' % (prefix, i))
            with open(hp, 'w', encoding='utf-8') as f:
                f.write(h)
            pg.goto(_uri(os.path.abspath(hp)))
            pg.evaluate('document.fonts.ready')
            pg.wait_for_timeout(300)
            top = pg.evaluate(FIT_JS)
            if top != -1 and top < 560:
                log('OGOHLANTIRISH: slayd %d matni baland (cap.top=%s)' % (i, top))
            fp = os.path.join(outdir, '%s%02d.jpg' % (prefix, i))
            pg.screenshot(path=fp, type='jpeg', quality=quality)
            out.append(fp)
        b.close()
    return out


def kontakt_varaq(paths, outpath, cols=5, tw=270):
    from PIL import Image
    ims = [Image.open(p).convert('RGB') for p in paths]
    th = int(tw * H / W)
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * tw + (cols + 1) * 8, rows * th + (rows + 1) * 8), (11, 12, 15))
    for i, im in enumerate(ims):
        im = im.resize((tw, th), Image.LANCZOS)
        sheet.paste(im, (8 + (i % cols) * (tw + 8), 8 + (i // cols) * (th + 8)))
    sheet.save(outpath, 'JPEG', quality=88)
    return outpath
