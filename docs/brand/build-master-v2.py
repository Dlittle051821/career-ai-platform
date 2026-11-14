"""Builds the Nextwise Master Logo v2.0 web assets from the owner-supplied approved artwork.

Sources (docs/brand/master-v2-source/, supplied by the owner on 14 Nov 2026, never redrawn):
  Nextwise_Approved_With_Tagline_Raster_4800px.png  full lockup with tagline (pink-tinted arrow)
  Nextwise_N_logo.png                               N symbol (pink-tinted arrow)

Every output keeps the canvas size of its v1 counterpart, so every logo box on the site keeps its
geometry; the artwork is only scaled (Lanczos, aspect preserved) and placed, never reshaped. The dark
variants ink the wordmark for Deep Navy exactly like v1 (wordmark -> Canvas white, "x" -> Soft Aqua,
tagline -> Ice Blue); the N symbol is never recoloured.

Run from the repository root:  python3 docs/brand/build-master-v2.py
"""
import os
from PIL import Image
import numpy as np

SRC = "docs/brand/master-v2-source"
OUT = "public/brand/master-v2"
os.makedirs(OUT, exist_ok=True)

def ink_box(im, thr=24):
    return im.getchannel("A").point(lambda v: 255 if v > thr else 0).getbbox()

def fit(art, size, align="left"):
    """Scale `art` (tightly cropped) to fill `size` by height (or width if wider), keep the aspect, transparent padding."""
    W, H = size
    s = min(W / art.width, H / art.height)
    w, h = max(1, round(art.width * s)), max(1, round(art.height * s))
    img = art.resize((w, h), Image.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = 0 if align == "left" else (W - w) // 2
    canvas.alpha_composite(img, (x, (H - h) // 2))
    return canvas

full = Image.open(f"{SRC}/Nextwise_Approved_With_Tagline_Raster_4800px.png").convert("RGBA")
full = full.crop(ink_box(full))
FW, FH = full.size
# the tagline row (lines + "Know What's Next.") starts below the wordmark: find the empty band between them
alpha = np.array(full.getchannel("A")) > 24
rows = alpha.sum(axis=1)
band = [y for y in range(int(FH * 0.70), int(FH * 0.92)) if rows[y] == 0]
tag_top = band[0] if band else int(FH * 0.80)
horizontal = full.crop((0, 0, FW, tag_top))
horizontal = horizontal.crop(ink_box(horizontal))

def dark(img, tagline_from=None):
    """Wordmark and tagline inked for Deep Navy, by colour: the navy letters right of the N become Canvas white,
    the blue-accented "x" Soft Aqua, the tagline row Ice Blue. The N (blue body, navy tail, pink arrow) is untouched."""
    a = np.array(img).astype(np.float32)
    H, W = a.shape[:2]
    xx = np.mgrid[0:H, 0:W][1]
    yy = np.mgrid[0:H, 0:W][0]
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    right_of_n = xx > int(W * 0.30)
    navy_ink = (np.maximum(np.maximum(r, g), b) < 120) & (b - r < 90)
    x_letter = (b > 120) & (b - r > 70) & (xx > int(W * 0.40)) & (xx < int(W * 0.56))
    tagline = (yy >= tagline_from) if tagline_from is not None else np.zeros_like(right_of_n)
    out = a.copy()
    def paint(mask, rgb):
        m = mask & (al > 0)
        out[m, 0], out[m, 1], out[m, 2] = rgb
    paint(right_of_n & navy_ink & ~tagline, (255, 255, 255))   # Canvas white
    paint(x_letter & ~tagline, (144, 224, 239))                # Soft Aqua #90E0EF
    paint(tagline, (202, 240, 248))                            # Ice Blue #CAF0F8
    return Image.fromarray(out.astype(np.uint8), "RGBA")

outputs = {}
v_full = fit(full, (1125, 373))
outputs["nextwise-master-full-light.png"] = v_full
scale_full = min(1125 / FW, 373 / FH)
outputs["nextwise-master-full-dark.png"] = dark(v_full, tagline_from=round((373 - FH * scale_full) / 2 + tag_top * scale_full))
v_hz = fit(horizontal, (1125, 300))
outputs["nextwise-master-horizontal-light.png"] = v_hz
outputs["nextwise-master-horizontal-dark.png"] = dark(v_hz)

n = Image.open(f"{SRC}/Nextwise_N_logo.png").convert("RGBA")
n = n.crop(ink_box(n))
outputs["nextwise-master-symbol.png"] = fit(n, (1073, 853), align="center")

for name, img in outputs.items():
    img.save(f"{OUT}/{name}", optimize=True)

# app icons: same canvas and same ink placement as the v1 icons (symbol ~80 % wide, centred)
def icon(size, bg=None, scale=0.80, dy=0.0):
    c = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    w = round(size * scale); h = round(n.height * w / n.width)
    c.alpha_composite(n.resize((w, h), Image.LANCZOS), ((size - w) // 2, (size - h) // 2 + round(dy * size)))
    return c

for s in (32, 192, 256, 512):
    icon(s).save(f"public/brand/nextwise-icon-{s}.png", optimize=True)
icon(180, bg=(255, 255, 255, 255), scale=0.72).convert("RGB").save("public/brand/nextwise-apple-touch-icon.png", optimize=True)
icon(48).save("src/app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("built", list(outputs), "and icons")
