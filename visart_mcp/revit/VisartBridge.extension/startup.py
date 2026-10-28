# -*- coding: utf-8 -*-
"""Visart Revit ko'prigi (pyRevit Routes). Revit ochilganda ishga tushadi.
Endpointlar: /visart/ping, /visart/levels, /visart/walls  (POST: mm koordinatalar)
Barcha o'lchamlar MM (Revit ichki birlik: fut -> /304.8 bilan o'giriladi)."""
from pyrevit import routes, revit, DB

API = routes.API("visart")
MM = 1.0 / 304.8


@API.route("/ping", methods=["GET"])
def ping():
    return routes.make_response(data={"status": "ok", "revit": revit.doc.Application.VersionNumber,
                                      "hujjat": revit.doc.Title})


@API.route("/levels", methods=["GET"])
def levels():
    col = DB.FilteredElementCollector(revit.doc).OfClass(DB.Level)
    return routes.make_response(data=[{"nom": l.Name, "balandlik_mm": round(l.Elevation / MM, 1)} for l in col])


@API.route("/walls", methods=["POST"])
def walls(request):
    """Body: {"daraja": "Level 1", "balandlik_mm": 2800, "devor_turi": "<WallType nomi>" (ixtiyoriy),
              "kontur": [[x1,y1],[x2,y2],...] (yopiq), "yopiq": true}"""
    d = request.data
    doc = revit.doc
    lvl = None
    for l in DB.FilteredElementCollector(doc).OfClass(DB.Level):
        if l.Name == d.get("daraja"):
            lvl = l
    if lvl is None:
        return routes.make_response(data={"status": "xato", "sabab": "daraja topilmadi"}, status=400)
    wt = None
    for t in DB.FilteredElementCollector(doc).OfClass(DB.WallType):
        if d.get("devor_turi") is None or t.get_Parameter(DB.BuiltInParameter.SYMBOL_NAME_PARAM).AsString() == d["devor_turi"]:
            wt = t
            break
    pts = d["kontur"]
    n = len(pts)
    h = d.get("balandlik_mm", 2800) * MM
    ids = []
    with revit.Transaction("Visart: devorlar"):
        rng = range(n) if d.get("yopiq", True) else range(n - 1)
        for i in rng:
            a, b = pts[i], pts[(i + 1) % n]
            ln = DB.Line.CreateBound(DB.XYZ(a[0] * MM, a[1] * MM, 0), DB.XYZ(b[0] * MM, b[1] * MM, 0))
            w = DB.Wall.Create(doc, ln, wt.Id, lvl.Id, h, 0, False, False)
            ids.append(w.Id.IntegerValue)
    return routes.make_response(data={"status": "ok", "devorlar": ids})
