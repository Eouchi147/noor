#!/usr/bin/env python3
"""NOOR · Islamic geometry, drawn rather than borrowed.

No photographer, no museum, no licence: the picture is constructed here from
the star polygons the tradition actually uses, so nothing about it can be
claimed by anyone else.

The unit is the star polygon {n/k}: n points, each joined to the one k steps
away. {8/3} is the khatam of Mamluk woodwork, {12/5} the rosette of Persian
tile, {10/4} the girih of the Topkapi scroll. Placed on the right lattice and
joined tip to tip, they close into a continuous fabric the way the originals do.
"""
import math, random, sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

W, H = 1080, 1920
SS = 2

PALETTES = {
    "night":  {"sky": [(8, 11, 32), (16, 24, 62), (26, 40, 96), (38, 62, 140)],
               "line": (233, 200, 106), "deep": (150, 116, 40), "star": (255, 249, 227),
               "lamp": (120, 96, 40)},
    "dusk":   {"sky": [(26, 14, 34), (58, 26, 52), (104, 48, 62), (168, 92, 70)],
               "line": (255, 214, 150), "deep": (168, 104, 60), "star": (255, 238, 208),
               "lamp": (150, 80, 46)},
    "green":  {"sky": [(6, 22, 26), (10, 42, 46), (14, 66, 66), (22, 104, 94)],
               "line": (214, 226, 170), "deep": (120, 150, 96), "star": (245, 252, 230),
               "lamp": (60, 120, 90)},
    "sand":   {"sky": [(28, 20, 12), (58, 42, 24), (96, 72, 40), (150, 116, 64)],
               "line": (250, 232, 190), "deep": (176, 140, 84), "star": (255, 248, 232),
               "lamp": (140, 104, 52)},
}

def lerp(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

def sky(w, h, stops):
    img = Image.new("RGB", (1, h)); px = img.load(); n = len(stops) - 1
    for y in range(h):
        t = y / (h - 1) * n; i = min(int(t), n - 1)
        px[0, y] = lerp(stops[i], stops[i + 1], t - i)
    return img.resize((w, h), Image.BILINEAR)

def add_glow(img, cx, cy, r, colour, strength):
    lay = Image.new("RGB", img.size, (0, 0, 0))
    d = ImageDraw.Draw(lay)
    for i in range(30, 0, -1):
        t = i / 30; rr = r * t
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                  fill=tuple(round(v * (1 - t) ** 1.7 * strength) for v in colour))
    lay = lay.filter(ImageFilter.GaussianBlur(r * 0.16))
    a = np.asarray(img, dtype=np.int16) + np.asarray(lay, dtype=np.int16)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def star_points(cx, cy, R, n, k, phase=0.0):
    """the outline of the star polygon {n/k}, as the 2n points of its boundary"""
    # inner radius so the arms meet cleanly: from the {n/k} chord geometry
    inner = R * math.cos(math.pi * k / n) / math.cos(math.pi * (k - 1) / n)
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n + phase
        b = a + math.pi / n
        pts.append((cx + R * math.cos(a), cy + R * math.sin(a)))
        pts.append((cx + inner * math.cos(b), cy + inner * math.sin(b)))
    return pts, inner

def draw_star(d, cx, cy, R, n, k, colour, width, phase=0.0, fill=None):
    pts, inner = star_points(cx, cy, R, n, k, phase)
    if fill: d.polygon(pts, fill=fill)
    d.line(pts + [pts[0]], fill=colour, width=width, joint="curve")
    return pts, inner

def field(seed=7, palette="night", n=8, k=3, cols=3):
    random.seed(seed)
    P = PALETTES[palette]
    w, h = W * SS, H * SS
    img = sky(w, h, P["sky"])
    img = add_glow(img, w * .5, h * .40, w * 1.05, P["lamp"], 1.25)
    img = add_glow(img, w * .5, h * .42, w * .42, P["lamp"], 1.15)
    d = ImageDraw.Draw(img, "RGBA")

    R = w / (cols * 2.0)
    stepx = R * 2.0
    stepy = R * 2.0
    rows = int(h / stepy) + 3
    lw = max(3, int(SS * 3.4))

    def fade_at(cx, cy):
        dist = math.hypot(cx - w / 2, cy - h * .42) / (w * .80)
        return max(.34, 1.0 - dist * .62)

    # the connecting lattice first, so the stars sit on top of it
    for r in range(-1, rows):
        for c in range(-1, cols + 2):
            cx, cy = c * stepx, r * stepy
            f = fade_at(cx, cy)
            col = lerp(P["sky"][2], P["deep"], min(1, f)) + (int(190 * f + 55),)
            d.line([cx, cy, cx + stepx, cy], fill=col, width=max(1, lw - 1))
            d.line([cx, cy, cx, cy + stepy], fill=col, width=max(1, lw - 1))
            # the diagonals that turn each cell into the cross between the stars
            d.line([cx + stepx / 2, cy, cx + stepx, cy + stepy / 2], fill=col, width=max(1, lw - 1))
            d.line([cx + stepx, cy + stepy / 2, cx + stepx / 2, cy + stepy], fill=col, width=max(1, lw - 1))
            d.line([cx + stepx / 2, cy + stepy, cx, cy + stepy / 2], fill=col, width=max(1, lw - 1))
            d.line([cx, cy + stepy / 2, cx + stepx / 2, cy], fill=col, width=max(1, lw - 1))

    # the stars themselves, on the lattice points and in the cell centres
    for r in range(-1, rows):
        for c in range(-1, cols + 2):
            for (ox, oy, scale, kk) in ((0, 0, 1.0, k), (stepx / 2, stepy / 2, .56, max(2, k - 1))):
                cx, cy = c * stepx + ox, r * stepy + oy
                f = fade_at(cx, cy)
                col = lerp(P["deep"], P["line"], min(1, f ** .55))
                glow_fill = lerp(P["sky"][1], P["lamp"], min(1, f * .62)) + (int(115 * f),)
                draw_star(d, cx, cy, R * .74 * scale, n, kk,
                          col + (255,), max(2, int(lw * (1 if scale > .8 else .8))),
                          phase=-math.pi / 2, fill=glow_fill)
            # the small bright centre
            cx, cy = c * stepx, r * stepy
            f = fade_at(cx, cy)
            rr = R * .085
            pts, _ = star_points(cx, cy, rr, n, 3, -math.pi / 2)
            d.polygon(pts, fill=lerp(P["sky"][2], P["star"], min(1, f)) + (255,))

    img = img.convert("RGB").resize((W, H), Image.LANCZOS)
    # vignette, so the caption has somewhere quiet to sit
    v = Image.new("L", (W, H), 0)
    ImageDraw.Draw(v).ellipse([-W * .30, -H * .04, W * 1.30, H * .90], fill=255)
    v = v.filter(ImageFilter.GaussianBlur(W * .20))
    img = Image.composite(img, Image.new("RGB", (W, H), (4, 6, 18)), v)
    return img

if __name__ == "__main__":
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 7
    pal = sys.argv[2] if len(sys.argv) > 2 else "night"
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 8
    k = int(sys.argv[4]) if len(sys.argv) > 4 else 3
    out = sys.argv[5] if len(sys.argv) > 5 else "/root/noor-reels/frames/still.png"
    field(seed, pal, n, k).save(out)
    print("wrote", out)
