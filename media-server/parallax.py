# 2.5D parallaks: render + chuqurlik xaritasi -> kamera siljiganday 25fps kadrlar.
# python parallax.py <rasm> <chiqish_papka> <kadrlar_soni> [W H] [yo'nalish: 1|-1]
import sys, os, numpy as np, cv2
img_p, out, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
W = int(sys.argv[4]) if len(sys.argv) > 4 else 1080
H = int(sys.argv[5]) if len(sys.argv) > 5 else 1400
dr = int(sys.argv[6]) if len(sys.argv) > 6 else 1
os.makedirs(out, exist_ok=True)
im = cv2.imread(img_p)
S = 1.16  # zaxira masshtab (chetlar ko'rinmasin)
h0, w0 = im.shape[:2]
sc = max(W * S / w0, H * S / h0)
im = cv2.resize(im, (int(w0 * sc) + 1, int(h0 * sc) + 1), interpolation=cv2.INTER_CUBIC)
ih, iw = im.shape[:2]

def depth_map(img):
    try:
        from transformers import pipeline
        from PIL import Image
        pipe = pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Small-hf')
        d = np.array(pipe(Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))['depth']).astype(np.float32)
        d = cv2.resize(d, (img.shape[1], img.shape[0]))
        d = (d - d.min()) / (d.max() - d.min() + 1e-6)  # 1 = yaqin
        return d, True
    except Exception as e:
        print('depth modeli yo\'q, taxminiy:', str(e)[:80], file=sys.stderr)
        yy, xx = np.mgrid[0:img.shape[0], 0:img.shape[1]].astype(np.float32)
        r = np.sqrt(((xx / img.shape[1] - 0.5) * 1.2) ** 2 + ((yy / img.shape[0] - 0.45)) ** 2)
        d = np.clip(r / 0.75, 0, 1)
        return d, False

dp = os.path.splitext(img_p)[0] + '_depth.png'
if os.path.exists(dp):
    d = cv2.resize(cv2.imread(dp, 0).astype(np.float32) / 255, (iw, ih))
else:
    d, ok = depth_map(im)
    if ok: cv2.imwrite(dp, (cv2.resize(d, (256, 256)) * 255).astype(np.uint8))
d = cv2.GaussianBlur(d, (0, 0), 6)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
cx, cy = iw / 2, ih / 2
ease = lambda x: x * x * (3 - 2 * x)
for k in range(n):
    t = k / max(1, n - 1)
    z = 1 + 0.10 * ease(t)                    # dolly: yaqinlashish
    sway = dr * (ease(t) - 0.5) * 2           # -1..1 yon siljish
    sx = (xx - W / 2) / z + cx
    sy = (yy - H / 2) / z + cy
    dd = cv2.remap(d, sx, sy, cv2.INTER_LINEAR)
    sx2 = sx + sway * 34 * (dd - 0.5)         # yaqin narsalar ko'proq siljiydi
    sy2 = sy - (ease(t) - 0.5) * 10 * (dd - 0.5)
    fr = cv2.remap(im, sx2.astype(np.float32), sy2.astype(np.float32), cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    cv2.imwrite(os.path.join(out, f'p{k:04d}.jpg'), fr, [cv2.IMWRITE_JPEG_QUALITY, 92])
