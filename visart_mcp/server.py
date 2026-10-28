"""
Visart MCP Server — exposes AutoCAD and 3ds Max (+Corona) as tools Claude can call.

Setup (on the Windows PC that has AutoCAD 2022 / 3ds Max 2022 / Corona):
    1. pip install "mcp[cli]" pywin32
    2. Edit config.json (paths only — no code changes needed on AutoCAD/Max version upgrades)
    3. Copy max_bridge/start_listener.ms into 3ds Max's startup scripts folder,
       OR run max_bridge/max_listener.py manually from Max's Python console.
    4. Add this server to Claude Desktop's config (claude_desktop_config.json):

       {
         "mcpServers": {
           "visart": {
             "command": "python",
             "args": ["C:\\Visart\\visart_mcp\\server.py"]
           }
         }
       }

    5. Restart Claude Desktop. Claude will then see tools named autocad_* and max_*.
"""
import contextlib
import io
import json
import os
import traceback

import pythoncom
import win32com.client
from mcp.server.fastmcp import FastMCP

from autocad_bridge import AutoCADBridge
from max_bridge_client import MaxBridge
import loyihalash_orchestrator
import norma_tekshiruv

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")
with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    CONFIG = json.load(f)

mcp = FastMCP("visart")
cad = AutoCADBridge(CONFIG)
mx = MaxBridge(CONFIG)

# ---------------- AutoCAD tools ----------------

@mcp.tool()
def autocad_connect() -> dict:
    """Connect to the currently open AutoCAD instance (or launch it)."""
    return cad.connect()


@mcp.tool()
def autocad_get_layers() -> list:
    """List layer names in the active AutoCAD drawing."""
    return cad.get_layers()


@mcp.tool()
def autocad_list_blocks() -> list:
    """List block definition names available in the active drawing (e.g. SOFA_001, BED_003)."""
    return cad.list_block_defs()


@mcp.tool()
def autocad_insert_block(block_name: str, x: float, y: float, rotation_deg: float = 0.0,
                          layer: str = None) -> dict:
    """Insert a library block (by its Visart code, e.g. SOFA_001) at an X,Y position (mm)."""
    return cad.insert_block(block_name, x, y, rotation_deg, layer)


@mcp.tool()
def autocad_draw_room(name: str, x: float, y: float, length_m: float, width_m: float,
                       layer: str = "ARCH-WALLS") -> dict:
    """Draw a rectangular room outline (mm position, meters size) + a centered name/area label."""
    return cad.draw_room(name, x, y, length_m, width_m, layer)


@mcp.tool()
def autocad_get_room_polylines(layer: str = "ARCH-WALLS") -> list:
    """Read room outline coordinates straight from the live AutoCAD document. Feed the result
    into max_build_room_walls to rebuild them in 3ds Max (DWG import drops standalone polylines)."""
    return cad.get_room_polylines(layer)


@mcp.tool()
def autocad_export_pdf(out_path: str) -> dict:
    """Export the current layout to PDF at out_path."""
    return cad.export_pdf(out_path)


@mcp.tool()
def autocad_run_python(code: str) -> dict:
    """Run raw Python against the live AutoCAD COM objects (app = Application, doc = ActiveDocument,
    win32com/pythoncom available). For diagnostics and anything not covered by a dedicated tool --
    e.g. SaveAs with an explicit format to avoid a blocking dialog."""
    local_ns = {"app": cad.app, "doc": cad.app.ActiveDocument, "win32com": win32com, "pythoncom": pythoncom}
    out = io.StringIO()
    try:
        with contextlib.redirect_stdout(out):
            try:
                result = eval(code, {}, local_ns)
            except SyntaxError:
                exec(code, {}, local_ns)
                result = local_ns.get("RESULT")
        return {"status": "ok", "result": repr(result), "stdout": out.getvalue()}
    except Exception:
        return {"status": "error", "message": traceback.format_exc()}


@mcp.tool()
def autocad_backup_now() -> dict:
    """Force an immediate backup copy of the active drawing before a risky change."""
    return cad.backup_active_doc()


# ---------------- 3ds Max / Corona tools ----------------

@mcp.tool()
def max_ping() -> dict:
    """Check that the listener inside 3ds Max is reachable."""
    return mx.ping()


@mcp.tool()
def max_run_python(code: str) -> dict:
    """Run raw MAXScript-via-pymxs Python code inside 3ds Max (rt = pymxs.runtime). For diagnostics
    and anything not covered by a dedicated tool -- e.g. checking exact class names before calling
    max_setup_corona. Localhost-only; same trust level as the other max_* tools."""
    return mx.run_python(code)


@mcp.tool()
def max_import_dwg(dwg_path: str) -> dict:
    """Import a DWG plan (with Visart library blocks) into the current 3ds Max scene."""
    return mx.import_dwg(dwg_path)


@mcp.tool()
def max_extrude_walls(layer_name: str, height_mm: float = 2800) -> dict:
    """Extrude wall splines found on a given layer to a given height (mm)."""
    return mx.extrude_walls_by_layer(layer_name, height_mm)


@mcp.tool()
def max_build_room_walls(rooms: list, height_mm: float = 2800, layer_name: str = "ARCH-WALLS",
                          thickness_mm: float = 200, openings: list = None) -> dict:
    """Build REAL (hollow, thickness_mm) wall geometry in 3ds Max from room rectangle coords (get
    these from autocad_get_room_polylines -- each room is [x1,y1,x2,y2,x3,y3,x4,y4] in mm), with
    optional door/window openings. Use this instead of max_import_dwg for walls: DWG/DXF import
    only brings in block-reference geometry (furniture), it does not reliably import standalone
    polylines/text drawn directly in AutoCAD.

    openings: optional, same length/order as `rooms` -- for each room, a list of:
      {"tomon": 0-3 (edge index: 0=p0->p1, 1=p1->p2, 2=p2->p3, 3=p3->p0),
       "turi": "eshik" | "deraza", "boshlanish_mm": float, "kenglik_mm": float,
       "tag_mm": float (deraza only, default 900), "parvoz_mm": float (deraza only, default 2100)}"""
    return mx.build_room_walls(rooms, height_mm, layer_name, thickness_mm, openings)


@mcp.tool()
def max_place_furniture(code_name: str, x: float, y: float, z: float = 0.0,
                         rotation_deg: float = 0.0) -> dict:
    """Merge a furniture model from the Visart 3D library (by code, e.g. SOFA_001) at a position."""
    library_root = CONFIG["autocad"]["library_csv"].rsplit("\\", 1)[0] + "\\Max3D"
    return mx.place_furniture_by_code(code_name, x, y, z, rotation_deg, library_root)


@mcp.tool()
def max_setup_corona() -> dict:
    """Set Corona Renderer as the active renderer in the current 3ds Max scene."""
    return mx.setup_corona_renderer()


@mcp.tool()
def max_render_preview(camera_name: str, out_path: str) -> dict:
    """Render a fast low-res preview from a named camera using Corona."""
    return mx.render_preview(camera_name, out_path)


@mcp.tool()
def max_render_final(camera_name: str, out_path: str) -> dict:
    """Render a final high-res image from a named camera using Corona."""
    return mx.render_final(camera_name, out_path)


@mcp.tool()
def max_backup_now() -> dict:
    """Force an immediate backup copy of the current .max scene before a risky change."""
    return mx.backup_scene()


# ---------------- Loyihalash orchestrator (qaror #15, 2-servis) ----------------

@mcp.tool()
def loyihalash_bosqich(xonalar: list, height_mm: float = 2800.0,
                        render_out_path: str = None, fast_preview: bool = True,
                        thickness_mm: float = 200.0, ruxsat_buzish: dict = None) -> dict:
    """Arxitektor+3D+Vizualizatsiya bosqichini bitta ketma-ket oqimda bajaradi:
    1) har xona uchun ShNQ 2.08.01-24 tekshiruvi (OK/MUAMMO, chizmada ko'rinadi -- muammo
       aniqlangan taqdirda ham chizish to'xtatilmaydi, qaror arxitektorga qoladi);
    2) AutoCAD'da xonalarni chizadi; 3) devor konturlarini (thickness_mm qalinlikda, eshik/deraza
       bo'shliqlari bilan) o'qib 3ds Max'da quradi; 4) agar render_out_path berilsa -- Corona
       sozlanadi, kamera yaratiladi, preview render qilinadi.

    xonalar: [{"nom": str, "tur": str (shnq_meyorlari.json'dagi xona turi kaliti),
               "x": float, "y": float (mm), "length_m": float, "width_m": float,
               "balandlik_m": float (ixtiyoriy),
               "eshik": bool (ixtiyoriy, default True -- 0-tomonda, o'rtada, avtomatik 900mm),
               "eshik_tomon"/"eshik_kenglik_m"/"eshik_boshlanish_m": qo'lda sozlash (ixtiyoriy),
               "derazalar": [{"tomon": 0-3, "boshlanish_m": float, "kenglik_m": float,
                               "tag_m": float (ixtiyoriy, def 0.9), "parvoz_m": float (ixtiyoriy, def 2.1)}, ...]
                               (ixtiyoriy)}, ...]
    """
    return loyihalash_orchestrator.run_bosqich(cad, mx, xonalar, height_mm,
                                                render_out_path, fast_preview, thickness_mm, ruxsat_buzish)


@mcp.tool()
def norma_tekshir(xonalar: list, ruxsat_buzish: dict = None, batafsil: bool = False) -> list:
    """Xonalarni Supabase norma_qoidalari (GOST/ShNQ/NKBA) bo'yicha tekshiradi -- chizmasiz.
    Holat: OK / OGOHLANTIRISH / XATO. 'tekshirilmadi' -- tekshirib bo'lmagan qoidalar (jim o'tkazilmaydi)."""
    return norma_tekshiruv.tekshir(xonalar, ruxsat_buzish, batafsil)


@mcp.tool()
def norma_parametrlar(band_prefiks: str = "") -> dict:
    """Berish mumkin bo'lgan faktlar (parametr, operator, min, max, birlik). Xona dict'idagi "faktlar"
    ichida aynan shu parametr nomi bilan qiymat (mm / m2) bering -- tekshiriladi."""
    return norma_tekshiruv.parametrlar(band_prefiks)


@mcp.tool()
def norma_yangila() -> dict:
    """Qoidalar keshini Supabase'dan yangilaydi (config.json -> supabase.url/key kerak)."""
    c = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json"), encoding="utf-8"))
    sb = c.get("supabase") or {}
    if not sb.get("url") or not sb.get("key"):
        return {"status": "xato", "sabab": "config.json'da supabase.url/key yo'q"}
    return norma_tekshiruv.norma_sync(sb["url"], sb["key"])


@mcp.tool()
def lugat_tekshir(qatlamlar: list = None, atamalar: list = None) -> dict:
    """Qatlam nomlari va atamalar Visart o'zbekcha lug'atiga mosligini tekshiradi."""
    return {"qatlam": norma_tekshiruv.qatlam_tekshir(qatlamlar) if qatlamlar else None,
            "atama": norma_tekshiruv.atama_tekshir(atamalar) if atamalar else None}


if __name__ == "__main__":
    mcp.run()
