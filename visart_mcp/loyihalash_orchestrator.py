"""
Loyihalash orchestrator -- qaror #15 (2-servis): Arxitektor + 3D + Vizualizatsiya
bosqichlarini bitta ketma-ket oqimga birlashtiradi.

server.py shu moduldagi run_bosqich() ni chaqiradi (bitta MCP tool sifatida).
Avtonomiya darajasi: 🟡 -- xona o'lchami/joylashuvi agent tomonidan bajariladi,
lekin ShNQ MUAMMO topilsa ham ish to'xtatilmaydi, faqat ANIQ ko'rsatiladi --
yakuniy qaror inson (arxitektor) tomonidan beriladi.
"""
import math
import time

import shnq_check
import norma_tekshiruv


def _ensure_sun(rt):
    """Sahnada kamida bitta yorug'lik manbai borligiga ishonch hosil qiladi
    (aks holda Corona render qop-qora chiqadi -- 2026-10-02 sinovida topilgan muammo)."""
    if len(list(rt.lights)) == 0:
        sun = rt.CoronaSun()
        sun.name = "Sun_Auto"
        sun.pos = rt.Point3(2000, -3000, 5000)
        return sun.name
    return None


def _avto_eshik(xona):
    """Xona uchun standart eshikni hisoblaydi: 0-tomonda (pastki qirra), o'rtada,
    900mm kenglikda (tor xonalarda kichikroq). xona["eshik"]=False bo'lsa -- eshiksiz."""
    if xona.get("eshik") is False:
        return None
    tomon = xona.get("eshik_tomon", 0)
    length_mm = xona["length_m"] * 1000.0 if tomon in (0, 2) else xona["width_m"] * 1000.0
    kenglik = xona.get("eshik_kenglik_m", 0.9) * 1000.0
    kenglik = min(kenglik, length_mm * 0.7) if length_mm > 0 else kenglik
    boshlanish = xona.get("eshik_boshlanish_m")
    boshlanish = boshlanish * 1000.0 if boshlanish is not None else (length_mm - kenglik) / 2.0
    return {"tomon": tomon, "turi": "eshik", "boshlanish_mm": boshlanish, "kenglik_mm": kenglik}


def _derazalar(xona):
    """xona["derazalar"]: [{"tomon","boshlanish_m","kenglik_m","tag_m","parvoz_m"}, ...] (ixtiyoriy)."""
    out = []
    for d in xona.get("derazalar", []):
        out.append({
            "tomon": d["tomon"], "turi": "deraza",
            "boshlanish_mm": d["boshlanish_m"] * 1000.0, "kenglik_mm": d["kenglik_m"] * 1000.0,
            "tag_mm": d.get("tag_m", 0.9) * 1000.0, "parvoz_mm": d.get("parvoz_m", 2.1) * 1000.0,
        })
    return out


def run_bosqich(cad, mx, xonalar, height_mm=2800.0, render_out_path=None,
                 fast_preview=True, thickness_mm=200.0, ruxsat_buzish=None):
    """
    xonalar: [{"nom": str, "tur": str (shnq_meyorlari.json kaliti),
               "x": float, "y": float (mm), "length_m": float, "width_m": float,
               "balandlik_m": float (ixtiyoriy),
               "eshik": bool (ixtiyoriy, default True -- 0-tomonda, o'rtada, avtomatik),
               "eshik_tomon"/"eshik_kenglik_m"/"eshik_boshlanish_m": qo'lda sozlash (ixtiyoriy),
               "derazalar": [{"tomon","boshlanish_m","kenglik_m","tag_m","parvoz_m"}, ...] (ixtiyoriy)},
              ...]

    Qaytaradi: {
      "shnq_natijalar": [...],       # har xona uchun OK/MUAMMO
      "chizma_natijalar": [...],     # AutoCAD draw_room natijalari
      "max_natija": {...},           # build_room_walls natijasi (devor soni bilan)
      "render": {...} | None,        # agar render_out_path berilgan bo'lsa
    }
    """
    # 1) ShNQ tekshiruvi -- chizishdan OLDIN, label'ga OK/MUAMMO belgisi qo'shiladi
    shnq_kirish = [{
        "nom": x["nom"], "tur": x.get("tur"),
        "nuqtalar": [(0, 0), (x["length_m"], 0), (x["length_m"], x["width_m"]), (0, x["width_m"])],
        "balandlik_m": x.get("balandlik_m"),
    } for x in xonalar]
    shnq_natijalar = shnq_check.tekshir(shnq_kirish)

    # 1b) NORMA tekshiruvi (Supabase norma_qoidalari keshi). XATO bo'lsa -- chizma BLOKLANADI.
    # ruxsat_buzish: {"xona nomi": {"parametr": "sababi"}} -- faqat arxitektor sababi bilan.
    # Kesh yo'q bo'lsa NormaYoq ko'tariladi (jim o'tish yo'q).
    norma_natijalar = norma_tekshiruv.tekshir(xonalar, ruxsat_buzish)
    bloklangan = norma_tekshiruv.bloklash_kerakmi(norma_natijalar)
    if bloklangan:
        return {"status": "BLOKLANDI", "sabab": "norma XATO -- chizma chizilmadi",
                "norma_natijalar": norma_natijalar, "shnq_natijalar": shnq_natijalar}

    # 2) AutoCAD'da chizish (har bir xona uchun ShNQ belgisi bilan)
    chizma_natijalar = []
    for xona, shnq in zip(xonalar, shnq_natijalar):
        belgi = "OK" if shnq["holat"] == "OK" else "MUAMMO"
        nom_shnq = f'{xona["nom"]} [{belgi}]'
        natija = cad.draw_room(nom_shnq, xona["x"], xona["y"], xona["length_m"], xona["width_m"])
        chizma_natijalar.append(natija)

    # 3) AutoCAD'dan devor konturlarini o'qish, Max'da quyish (eshik/deraza bilan)
    # get_room_polylines() {"handle","coords"} lug'atlar ro'yxatini qaytaradi -- shu yerdan
    # faqat 4-nuqtali (8 qiymatli) coords'larni ajratib olamiz (avval bu yerda "coords" ochib
    # olinmagani uchun rooms_8 HAR DOIM bo'sh bo'lib qolgan edi -- 2026-10-04 topildi va tuzatildi).
    polylines = cad.get_room_polylines("ARCH-WALLS")
    rooms_8 = [p["coords"] for p in polylines if len(p.get("coords", [])) == 8]
    # DIQQAT: bu yerda rooms_8 BUTUN ARCH-WALLS qatlamidan o'qiladi (eski/qoldiq test xonalari ham
    # kirishi mumkin) -- shu sabab openings faqat shu run'dagi xonalar soniga mos keladi deb
    # FARAZ qilinadi; ishonchli ishlashi uchun chaqiruvdan oldin qatlamni tozalab oling.
    openings = []
    for xona in xonalar:
        xona_openings = []
        eshik = _avto_eshik(xona)
        if eshik:
            xona_openings.append(eshik)
        xona_openings += _derazalar(xona)
        openings.append(xona_openings)
    # rooms_8 soni xonalar sonidan ko'p bo'lsa (eski qoldiqlar), qolganlariga bo'sh openings beriladi
    while len(openings) < len(rooms_8):
        openings.append([])

    max_natija = mx.build_room_walls(rooms_8, height_mm, "ARCH-WALLS", thickness_mm, openings)
    # muvaffaqiyatsizlikni sukut bo'yicha yashirmaslik uchun -- qurilgan devor segmentlari sonini tekshirish
    try:
        created = eval(max_natija.get("result", "None")) if max_natija.get("status") == "ok" else None
    except Exception:
        created = None
    if max_natija.get("status") != "ok" or not created:
        max_natija = {
            "status": "error",
            "message": "build_room_walls devor yaratmadi (0 segment) -- rooms_8 bo'sh yoki Max'da xato bo'lishi mumkin",
            "raw": max_natija,
            "rooms_8_soni": len(rooms_8),
        }

    render_natija = None
    if render_out_path:
        # 4) Corona + kamera + preview render
        mx.setup_corona_renderer()
        cam_code = """
walls = [o for o in rt.objects if o.name.startswith("Room_Wall")]
mins = [1e9,1e9,1e9]; maxs=[-1e9,-1e9,-1e9]
for o in walls:
    bb = rt.nodeGetBoundingBox(o, rt.Matrix3(1))
    lo, hi = bb[0], bb[1]
    for i,v in enumerate([lo.x,lo.y,lo.z]): mins[i]=min(mins[i],v)
    for i,v in enumerate([hi.x,hi.y,hi.z]): maxs[i]=max(maxs[i],v)
cx=(mins[0]+maxs[0])/2.0; cy=(mins[1]+maxs[1])/2.0; cz=(mins[2]+maxs[2])/2.0
span = max(maxs[0]-mins[0], maxs[1]-mins[1], 1000)
if len(list(rt.lights)) == 0:
    sun = rt.CoronaSun(); sun.name = "Sun_Auto"; sun.pos = rt.Point3(2000,-3000,5000)
cam = rt.targetcamera(pos=rt.Point3(cx, cy-span*1.5, cz+span*1.2), target=rt.targetobject(pos=rt.Point3(cx,cy,cz+1000)))
cam.name = "RenderCam_Orchestrator_%d" % int(__import__("time").time())
if fast_preview:
    rt.execute("renderers.current.progressive_timeLimit = 25")
    rt.execute("renderers.current.progressive_passLimit = 25")
    rt.renderWidth = 640; rt.renderHeight = 360
RESULT = {"camera": cam.name}
""".replace("fast_preview", str(fast_preview))
        cam_res = mx.run_python(cam_code)
        cam_name = None
        try:
            cam_name = eval(cam_res["result"]).get("camera")
        except Exception:
            pass
        if cam_name:
            render_natija = mx.render_preview(cam_name, render_out_path)
        else:
            render_natija = {"status": "error", "message": "kamera yaratilmadi", "raw": cam_res}

    return {
        "shnq_natijalar": shnq_natijalar,
        "norma_natijalar": norma_natijalar,
        "chizma_natijalar": chizma_natijalar,
        "max_natija": max_natija,
        "render": render_natija,
    }
