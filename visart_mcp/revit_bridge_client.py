"""Revit ko'prigi mijozi (pyRevit Routes, VisartBridge.extension). Barcha o'lchamlar MM."""
import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:48884/visart"


class RevitXato(RuntimeError):
    pass


def _call(path, data=None, timeout=60):
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(BASE + path, data=body, headers={"Content-Type": "application/json"},
                                 method="POST" if data is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RevitXato("HTTP %s: %s" % (e.code, e.read().decode("utf-8", "ignore")[:400]))
    except urllib.error.URLError as e:
        raise RevitXato("Revit ulanmadi (Revit ochiq, hujjat ochiq, pyRevit Routes yoqilganmi?): %s" % e)


def ping():
    return _call("/ping")


def levels():
    return _call("/levels")


def walls(kontur, daraja, balandlik_mm=2800, devor_turi=None, yopiq=True):
    return _call("/walls", {"kontur": kontur, "daraja": daraja, "balandlik_mm": balandlik_mm,
                            "devor_turi": devor_turi, "yopiq": yopiq})
