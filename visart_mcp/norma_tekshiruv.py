"""
Norma tekshiruvchisi (validator) -- Supabase `norma_qoidalari` jadvaliga tayanadi.

Printsip: "xato qilishga haqqimiz yo'q".
  * XATO (jiddiylik='xato') topilsa -- loyihalash BLOKLANADI (run_bosqich chizmaga o'tmaydi),
    faqat arxitektor sababini yozib `ruxsat_buzish` bilan o'tkazishi mumkin (jurnalga yoziladi).
  * Qoida tekshirilmadi (parametr ma'lum emas / kontekst yetarli emas) -- jim o'tkazilmaydi,
    `tekshirilmadi` ro'yxatida ko'rsatiladi.
  * '=' operatorli qoida aniq qiymat emas, tavsiya bo'lishi mumkin -- mos kelmasa faqat OGOHLANTIRISH.
  * rad_etilgan=true qoidalar ishlatilmaydi.

Ma'lumot: norma_sync() Supabase'dan norma_cache.json'ga yuklaydi (config.json -> "supabase": {"url","key"}).
Kesh yo'q bo'lsa tekshiruv ISHLAMAYDI (NormaYoq) -- jim o'tish yo'q.
Birliklar: uzunlik -- mm, yuza -- m2 (norma_qoidalari.min_n / max_n / birlik_n).
"""
import csv
import json
import os
import re
import unicodedata
import urllib.request

BAZA = os.path.dirname(os.path.abspath(__file__))
KESH = os.path.join(BAZA, "norma_cache.json")
LUGAT_PAPKA = os.path.join(BAZA, "lugat")
ESHIK_PARAM = {}  # kengaytirish uchun

COLS = ("band,soha,obyekt_turi,xona_turi,parametr,operator,min_n,max_n,birlik_n,"
        "jiddiylik,izoh,rad_etilgan")


class NormaYoq(RuntimeError):
    pass


# ----------------------------------------------------------------- yuklash
def norma_sync(url, key, kesh=KESH):
    """Supabase'dan barcha qoidalarni (rad_etilganlarsiz) yuklab, kesh fayliga yozadi."""
    qoidalar, offset = [], 0
    while True:
        so = (f"{url.rstrip('/')}/rest/v1/norma_qoidalari?select={COLS}"
              f"&rad_etilgan=is.false&order=id&limit=1000&offset={offset}")
        req = urllib.request.Request(so, headers={"apikey": key, "Authorization": f"Bearer {key}"})
        with urllib.request.urlopen(req, timeout=30) as r:
            blok = json.loads(r.read().decode("utf-8"))
        qoidalar += blok
        if len(blok) < 1000:
            break
        offset += 1000
    with open(kesh, "w", encoding="utf-8") as f:
        json.dump({"soni": len(qoidalar), "qoidalar": qoidalar}, f, ensure_ascii=False)
    return {"status": "ok", "soni": len(qoidalar)}


def yukla(kesh=KESH):
    if not os.path.exists(kesh):
        raise NormaYoq("norma_cache.json yo'q -- avval norma_sync (norma_yangila tool) ni ishga tushiring")
    with open(kesh, "r", encoding="utf-8") as f:
        d = json.load(f)
    return [q for q in d["qoidalar"] if not q.get("rad_etilgan")]


# --------------------------------------------------------------- normallash
def _n(s):
    s = unicodedata.normalize("NFKD", str(s or "")).lower()
    s = s.replace("ʻ", "").replace("‘", "").replace("’", "").replace("'", "")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


# kalit so'z -> kanonik xona kaliti
XONA_KALIT = [
    (r"yotoqxona|uxlash|ota ona", "yotoqxona"),
    (r"oshxona", "oshxona"),
    (r"hojatxona", "hojatxona"),
    (r"vanna", "vanna"),
    (r"sanuzel|sanitar tugun", "sanuzel"),
    (r"dahliz|prixojaya|vestibyul", "dahliz"),
    (r"koridor|yolak", "koridor"),
    (r"zinaxona|zina", "zina"),
    (r"umumiy xona|turar xona|mehmonxona|yashash xonalari|yashash xonasi|bir xonali", "umumiy_xona"),
    (r"balkon|lodjiya", "balkon"),
    (r"kladovka|omborxona", "kladovka"),
    (r"garaj", "garaj"),
    (r"chordoq|mansarda", "chordoq"),
    (r"kabinet|ish xonasi", "kabinet"),
]
# bir kanonik kalit boshqalarni ham qamrab oladi (qoida -> chaqiruvchi xonasi)
QAMRAYDI = {
    "sanuzel": {"sanuzel", "vanna", "hojatxona"},
    "umumiy_xona": {"umumiy_xona"},
    "koridor": {"koridor", "dahliz"},
}


def _xona_kalitlari(matn):
    n = _n(matn)
    return {k for pat, k in XONA_KALIT if re.search(pat, n)}


# parametr nomi -> fakt kaliti (regex, fakt, shart_kalit|None)
PARAM_MAP = [
    (r"^(xona_yuzasi|xona_maydoni|xona_maydoni_minimal|maydon|xona_yuzasi_min)$", "maydon", None),
    (r"^xona_yuzasi_1kishi$", "maydon", ("kishi", 1)),
    (r"^xona_yuzasi_2kishi$", "maydon", ("kishi", 2)),
    (r"^(xona_eni|xona_eni_min|xona_eni_maqbul|eni)$", "eni", None),
    (r"^(oshxona_eni_bir_qatorli|xona_eni_bir_qatorli|xona_eni_bir_qator_jihoz)$", "eni", ("oshxona_joylashuv", "bir_qator")),
    (r"^(oshxona_eni_burchakli_yoki_ikki_tomonli|xona_eni_burchakli|xona_eni_burchakli_yoki_ikki_tomonlama)$", "eni", ("oshxona_joylashuv", "burchakli")),
    (r"^ikki_qatorli_joylash_oshxona_eni$", "eni", ("oshxona_joylashuv", "ikki_qator")),
    (r"^(xona_balandligi_janubiy_iqlim|qavat_balandligi.*|xizmat_xodimlari_joyi_sof_balandligi)$", "balandlik", None),
    (r"^deraza_balandligi$", "deraza_balandligi", None),
    (r"^deraza_kengligi$", "deraza_kengligi", None),
    (r"^(deraza_yuzasi/pol_yuzasi|deraza_pol_nisbati.*)$", "deraza_pol_nisbati", None),
    (r"^(ichki_eshik.*balandligi|eshik_balandligi)$", "eshik_balandligi", None),
    (r"^(eshik_eni_1tavaqa|bir_tavaqali_ichki_eshik_kengligi)$", "eshik_eni", ("eshik_tavaqa", 1)),
    (r"^(eshik_eni_2tavaqa|ikki_tavaqali_ichki_eshik_kengligi)$", "eshik_eni", ("eshik_tavaqa", 2)),
    (r"^(dahliz_eni|dahliz_eni_minimal|dahliz_eni_tavsiya)$", "eni", None),
    (r"^dahliz_maydoni$", "maydon", None),
    (r"^(zina_marsh_eni|marsh_eni_2_qavatli|marsh_eni_3_va_undan_koproq_qavat)$", "marsh_eni", None),
    (r"^(pillapoya_eni|pogona_eni_va_balandligi_tipik)$", "pogona_eni", None),
    (r"^(pillapoya_balandligi|pogona_balandligi_tipik)$", "pogona_balandligi", None),
    (r"^(pillapoya_soni_marsh|marsh_zinalari_soni|zina_pillapoya_soni_marsh|zina_marsh_pillapoya_soni)$", "marsh_pogona_soni", None),
    (r"^(zina_panjara_balandligi|panjara_balandligi|zina_toʻsiq_balandligi)$", "panjara_balandligi", None),
    (r"^2h_plus_b$", "2h_plus_b", None),
    (r"^zina_maydoncha_eni$", "maydoncha_eni", None),
    (r"^(ish_stoli_balandligi|jihoz_ish_yuzasi_balandligi|oshxona_ish_yuzasi_poldan_GOST)$", "oshxona_ish_yuzasi", None),
    (r"^(kvartiradan_zinagacha_masofa_.*|zinagacha_masofa_.*|koridorning_eng_uzoq_nuqtasidan_zina_yoki_liftgacha)$", "zinagacha_masofa", None),
    (r"^(gazli_oshxona_balandligi|gaz_plita_oshxona_balandligi)$", "balandlik", ("gazli", True)),
    (r"^(krovat_uzunligi)$", "krovat_uzunligi", None),
    (r"^(bir_kishilik_krovat_eni)$", "krovat_eni", ("kishi", 1)),
    (r"^(ikki_kishilik_krovat_eni_GOST|ikki_kishilik_karavot_eni)$", "krovat_eni", ("kishi", 2)),
    (r"^(stul_orindiq_chuqurligi_GOST)$", "stul_chuqurligi", None),
    (r"^(oshxona_sokol_balandligi)$", "sokol_balandligi", None),
    (r"^(oshxona_stol_shkaf_chuqurligi)$", "stol_shkaf_chuqurligi", None),
    (r"^(oshxona_devor_shkaf_ichki_chuqurligi)$", "devor_shkaf_chuqurligi", None),
    (r"^(oshxona_ish_yolagi_1_oshpaz)$", "oshxona_ish_yolagi", ("oshpaz", 1)),
    (r"^(oshxona_ish_yolagi_koproq_oshpaz)$", "oshxona_ish_yolagi", ("oshpaz", 2)),
    (r"^(rozetka_poldan_yashash_xonasi)$", "rozetka_balandligi", None),
    (r"^(viklyuchatel_poldan)$", "viklyuchatel_balandligi", None),
    (r"^(rakovina_balandligi_poldan|yuvinish_rakovinasi_ornatish_balandligi_poldan)$", "rakovina_balandligi", None),
    (r"^(tom_nishabi_.*|yassi_tom_nishabi)$", "tom_nishabi", None),
]
_PM = [(re.compile(p), f, sh) for p, f, sh in PARAM_MAP]


def _param(parametr):
    for rx, fakt, shart in _PM:
        if rx.match(parametr):
            return fakt, shart
    return None, None


# --------------------------------------------------------------- faktlar
def xona_faktlari(x):
    """Xona spetsifikatsiyasidan (orchestrator formati) tekshiriladigan faktlarni hisoblaydi.
    x: {"length_m","width_m","balandlik_m","eshik","derazalar":[{kenglik_m,tag_m,parvoz_m}], "tur", ...}
    Qaytaradi (faktlar{}, kontekst{}). Birliklar: mm, m2."""
    L, W = x["length_m"] * 1000.0, x["width_m"] * 1000.0
    f = {"eni": min(L, W), "boyi": max(L, W), "maydon": x["length_m"] * x["width_m"]}
    if x.get("balandlik_m"):
        f["balandlik"] = x["balandlik_m"] * 1000.0
    der = x.get("derazalar") or []
    if der:
        s = 0.0
        for d in der:
            h = (d.get("parvoz_m", 2.1) - d.get("tag_m", 0.9)) * 1000.0
            s += d["kenglik_m"] * (h / 1000.0)
        f["deraza_pol_nisbati"] = s / f["maydon"] if f["maydon"] else 0
        f["deraza_balandligi"] = [(d.get("parvoz_m", 2.1) - d.get("tag_m", 0.9)) * 1000.0 for d in der]
        f["deraza_kengligi"] = [d["kenglik_m"] * 1000.0 for d in der]
    if x.get("eshik", True) is not False:
        f["eshik_eni"] = x.get("eshik_kenglik_m", 0.9) * 1000.0
    for k in ("eshik_balandligi_mm", "marsh_eni_mm", "pogona_eni_mm", "pogona_balandligi_mm",
              "marsh_pogona_soni", "panjara_balandligi_mm", "oshxona_ish_yuzasi_mm",
              "zinagacha_masofa_mm", "rozetka_balandligi_mm", "viklyuchatel_balandligi_mm",
              "rakovina_balandligi_mm", "tom_nishabi", "maydoncha_eni_mm"):
        if k in x:
            f[k.replace("_mm", "")] = x[k]
    if "pogona_eni" in f and "pogona_balandligi" in f:
        f["2h_plus_b"] = 2 * f["pogona_balandligi"] + f["pogona_eni"]
    # to'g'ridan-to'g'ri faktlar ham o'tadi
    for k, v in (x.get("faktlar") or {}).items():
        f[k] = v
    kal = _xona_kalitlari(x.get("tur") or x.get("nom") or "")
    ctx = {"xona": kal, "kishi": x.get("kishi"), "obyekt": x.get("obyekt", "turar-joy"),
           "xonalar_soni": x.get("xonalar_soni"), "xonadon_sinfi": x.get("xonadon_sinfi", "oddiy"),
           "oshxona_joylashuv": x.get("oshxona_joylashuv"), "eshik_tavaqa": x.get("eshik_tavaqa", 1),
           "oshpaz": x.get("oshpaz", 1), "gazli": x.get("gazli"),
           "yonish_darajasi": x.get("yonish_darajasi"), "iqlim_zona": x.get("iqlim_zona")}
    if not kal:
        ctx["noma_lum_xona"] = True
    return f, ctx


# --------------------------------------------------------------- moslik
def _qoida_qollanadi(q, ctx):
    """True | False | None (None = kontekst yetarli emas)."""
    xt = _n(q.get("xona_turi"))
    ot = _n(q.get("obyekt_turi"))
    # xona turi
    if xt and xt not in ("umumiy", "interyer"):
        kal = _xona_kalitlari(xt)
        if kal:
            qamrov = set()
            for k in kal:
                qamrov |= QAMRAYDI.get(k, {k})
            if ctx["xona"] and not (qamrov & ctx["xona"]):
                return False
            if not ctx["xona"]:
                return None
        # kishi
        if re.search(r"\b1 kishi|1kishi", xt) and ctx["kishi"] not in (1, None):
            return False
        if re.search(r"\b2 kishi|2kishi|er xotin", xt) and ctx["kishi"] not in (2, None):
            return False
        if re.search(r"\b1 kishi|1kishi|\b2 kishi|2kishi|er xotin", xt) and ctx["kishi"] is None:
            return None
    # obyekt turi
    if "jamoat" in ot and ctx["obyekt"] != "jamoat":
        return False
    if re.search(r"turar joy|xonadon", ot) and ctx["obyekt"] == "jamoat":
        return False
    m = re.search(r"xonadon oddiy (\d)xona", ot)
    if m:
        if ctx.get("xonalar_soni") is None:
            return None
        if int(m.group(1)) != int(ctx["xonalar_soni"]) or ctx["xonadon_sinfi"] != "oddiy":
            return False
    if "xonadon yaxshilangan" in ot and ctx["xonadon_sinfi"] != "yaxshilangan":
        return False
    if "xonadon yuqori" in ot and ctx["xonadon_sinfi"] != "yuqori":
        return False
    if re.search(r"yonish darajasi|\bi iii daraja|\biiib|\biiia|\bgisht devorli|\b\d\s*\d?\s*qavat|6 9 qavat|>?\s*10 qavat", ot):
        return None  # sinf/yong'in konteksti kerak
    return True


def _solishtir(op, qiymat, mn, mx):
    """(mos, tavsif)"""
    if op == "between":
        return (mn <= qiymat <= mx), f"{mn:g}…{mx:g}"
    if op == ">=":
        t = mn if mn is not None else mx
        return qiymat >= t, f">= {t:g}"
    if op == "<=":
        t = mx if mx is not None else mn
        return qiymat <= t, f"<= {t:g}"
    if op == ">":
        t = mn if mn is not None else mx
        return qiymat > t, f"> {t:g}"
    if op == "<":
        t = mx if mx is not None else mn
        return qiymat < t, f"< {t:g}"
    if op == "=":
        if mx is not None and mn is not None and mx != mn:
            return (mn <= qiymat <= mx), f"{mn:g}…{mx:g}"
        t = mn if mn is not None else mx
        return abs(qiymat - t) < 1e-6, f"= {t:g}"
    return True, op


# --------------------------------------------------------------- tekshir
def tekshir_xona(x, qoidalar=None, ruxsat_buzish=None):
    """Bitta xonani tekshiradi. ruxsat_buzish: {"parametr": "sababi"} -- arxitektor ruxsati."""
    qoidalar = qoidalar if qoidalar is not None else yukla()
    ruxsat_buzish = ruxsat_buzish or {}
    f, ctx = xona_faktlari(x)
    topildi, tekshirilmadi, ok = [], [], 0
    if ctx.get("noma_lum_xona"):
        tekshirilmadi.append("xona turi ma'lum emas -- kontekstli qoidalar tekshirilmadi")
    for q in qoidalar:
        if q["operator"] in ("bor", "yoq"):
            continue
        qol = _qoida_qollanadi(q, ctx)
        if qol is False:
            continue
        fakt, shart = _param(q["parametr"])
        if fakt is None:
            if qol is True and ctx["xona"] and _n(q.get("xona_turi")) not in ("", "umumiy", "interyer"):
                tekshirilmadi.append(f'{q["band"]}:{q["parametr"]} (parametr xaritada yo\'q)')
            continue
        if shart:
            k, v = shart
            if ctx.get(k) is None or ctx.get(k) != v:
                if ctx.get(k) is None and k in ("oshxona_joylashuv", "gazli"):
                    if ctx["xona"] and "oshxona" in ctx["xona"]:
                        tekshirilmadi.append(f'{q["band"]}:{q["parametr"]} ({k} berilmagan)')
                continue
        if qol is None:
            tekshirilmadi.append(f'{q["band"]}:{q["parametr"]} (kontekst yetarli emas)')
            continue
        qiym = f.get(fakt)
        if qiym is None:
            if q.get("jiddiylik", "").startswith("x") and (ctx["xona"] or fakt in ("balandlik",)):
                tekshirilmadi.append(f'{q["band"]}:{q["parametr"]} (fakt "{fakt}" berilmagan)')
            continue
        qiymlar = qiym if isinstance(qiym, list) else [qiym]
        for qv in qiymlar:
            mos, tav = _solishtir(q["operator"], qv, q.get("min_n"), q.get("max_n"))
            if mos:
                ok += 1
                continue
            jid = (q.get("jiddiylik") or "tavsiya")[0]
            daraja = {"x": "XATO", "o": "OGOHLANTIRISH", "t": "TAVSIYA"}.get(jid, "TAVSIYA")
            if q["operator"] == "=":
                daraja = "OGOHLANTIRISH" if daraja == "XATO" else daraja
            if q["parametr"] in ruxsat_buzish:
                daraja = "RUXSAT"
            topildi.append({"daraja": daraja, "band": q["band"], "parametr": q["parametr"],
                            "qiymat": round(qv, 3), "talab": tav, "birlik": q.get("birlik_n"),
                            "izoh": (q.get("izoh") or "")[:140],
                            "ruxsat_sababi": ruxsat_buzish.get(q["parametr"])})
    daraj = {d["daraja"] for d in topildi}
    holat = "XATO" if "XATO" in daraj else ("OGOHLANTIRISH" if "OGOHLANTIRISH" in daraj else "OK")
    return {"nom": x.get("nom"), "holat": holat, "topildi": topildi,
            "tekshirildi_soni": ok + len(topildi), "tekshirilmadi": sorted(set(tekshirilmadi))}


def tekshir(xonalar, ruxsat_buzish=None):
    q = yukla()
    return [tekshir_xona(x, q, (ruxsat_buzish or {}).get(x.get("nom"))) for x in xonalar]


def bloklash_kerakmi(natijalar):
    return [n for n in natijalar if n["holat"] == "XATO"]


# --------------------------------------------------------------- lug'at
def _lugat_yuklash():
    qat, lug = set(), set()
    p = os.path.join(LUGAT_PAPKA, "qatlam_standart.csv")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            qat |= {r["visart_qatlam"] for r in csv.DictReader(f)}
    p = os.path.join(LUGAT_PAPKA, "qatlam_standart_arx.csv")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            qat |= {r["visart_qatlam"] for r in csv.DictReader(f)}
    for nom, kol in (("lugat_arxitektura.csv", "uz_standart"), ("lugat_milliy_me_moriy.csv", "atama")):
        p = os.path.join(LUGAT_PAPKA, nom)
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                for r in csv.DictReader(f):
                    for t in re.split(r"[()/,;]", r[kol]):
                        if t.strip():
                            lug.add(_n(t))
    return qat, lug


def qatlam_tekshir(nomlar):
    """Qatlam nomlari Visart standartida (o'zbekcha) bo'lishi shart."""
    qat, _ = _lugat_yuklash()
    if not qat:
        raise NormaYoq("lugat/qatlam_standart*.csv topilmadi")
    yomon = [n for n in nomlar if n not in qat]
    return {"holat": "OK" if not yomon else "XATO", "nostandart": yomon,
            "tavsiya": "Visart standartidagi o'zbekcha nomlardan foydalaning (lugat/qatlam_standart*.csv)"}


def atama_tekshir(atamalar):
    """Chizma/yozuvdagi atamalar lug'atda bo'lishi shart (xona nomlari bundan mustasno emas --
    lug'atga qo'shing yoki ruxsat bering)."""
    _, lug = _lugat_yuklash()
    if not lug:
        raise NormaYoq("lugat/*.csv topilmadi")
    yomon = [a for a in atamalar if _n(a) not in lug]
    return {"holat": "OK" if not yomon else "OGOHLANTIRISH", "lugatda_yoq": yomon}


if __name__ == "__main__":
    import sys
    c = json.load(open(os.path.join(BAZA, "config.json"), encoding="utf-8")).get("supabase") or {}
    print(norma_sync(c["url"], c["key"]) if len(sys.argv) > 1 and sys.argv[1] == "sync" else "foydalanish: python norma_tekshiruv.py sync")
