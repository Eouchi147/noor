#!/usr/bin/env python3
"""
Build assets/mail/: the Lantern's emblem for the head of every letter the
house sends.

What it draws. The same light the owner sees on his console every day: a
night blue medallion with a fine gold ring, the eight fold lattice of the
house's geometry (the {8/3} star, the two squares and the octagon) drawn in
gold at a whisper, and at the centre the eight pointed star of two squares,
cream, traced inside with a thin gold line, with a warm halo and a bright
core. Islamic geometry only, eight fold; never a six pointed star, a cross,
a face or a figure.

How it moves. A slow breath, six seconds in and out, the halo rising and
falling and the star swelling a little with it (the console's own breath:
scale .94 to 1.05, opacity .8 to 1). Email clients do not run CSS
animation, so it is a GIF. The FIRST frame is the top of the breath,
because Outlook on Windows shows only that frame, and it has to be the
beautiful one. Frames after the first carry only the pixels that drifted
more than TOL from what is already shown, the rest left clear, and the
palette is shared out so the light has fine steps: that is what keeps it
under 120 KB without rings in the glow.

What it writes:
    assets/mail/lantern-v1.gif        the breathing emblem, 240 px (2x for 120)
    assets/mail/lantern-v1-still.png  its first frame, for readers who ask
                                      their device for less motion

The names carry a version because vercel.json serves /assets/*.gif and
*.png as immutable for a year: a changed emblem takes a new name, never
the old one.

Run:  python3 scripts/gen-mail-emblem.py [out_dir]
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "assets", "mail")
NAME = "lantern-v1"

S = 240             # the emblem, in pixels: 2x for a 120 px place in the letter
SS = 4              # drawn four times larger, then brought down, for clean edges
W = S * SS
FRAMES = 24
MS = 250            # 24 frames of 250 ms: one breath in six seconds
LIMIT = 120 * 1024  # the house's own ceiling for it
TOL = 7             # how far a pixel may drift before it is sent again
OUTER = 96          # palette colours for the still night; the light has the rest

# the house's colours (assets/brand/mark.svg, assets/noor2.css, admin2.html)
NIGHT_HI = (0x18, 0x24, 0x52)
NIGHT_MID = (0x0B, 0x12, 0x30)
NIGHT_LO = (0x04, 0x06, 0x0F)
BAND = (0x0A, 0x10, 0x24)        # the letter's head, behind the medallion
GOLD = (0xE9, 0xC8, 0x6A)
GOLD_HI = (0xF4, 0xD4, 0x6A)
GOLD_DEEP = (0xC9, 0xA2, 0x27)
CREAM = (0xFF, 0xF9, 0xE3)
CORE = (0xFF, 0xFB, 0xEA)
HALO = (0xF3, 0xD0, 0x78)

C = W / 2.0
R = W / 2.0 - 1.5 * SS           # the medallion's edge
RING = 0.905 * R                 # the gold ring
LAT = 0.84 * R                   # the lattice's outer reach


def pt(r, deg, cx=C, cy=C):
    a = math.radians(deg)
    return (cx + r * math.sin(a), cy - r * math.cos(a))


def star(r, rot, step, cx=C, cy=C):
    """an eight fold polygon: step 1 the octagon, 2 the two squares, 3 the {8/3} star.
    Returns a list of closed point lists."""
    p = [pt(r, rot + k * 45, cx, cy) for k in range(8)]
    if step == 2:
        return [[p[(s + i * 2) % 8] for i in range(5)] for s in (0, 1)]
    return [[p[(k * step) % 8] for k in range(9)]]


def lines_mask(polys, width):
    im = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(im)
    for poly in polys:
        d.line(poly, fill=255, width=int(round(width)), joint="curve")
    return np.asarray(im, dtype=np.float32) / 255.0


def fill_mask(polys):
    im = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(im)
    for poly in polys:
        d.polygon(poly, fill=255)
    return np.asarray(im, dtype=np.float32) / 255.0


def circle_mask(r, width=None):
    im = Image.new("L", (W, W), 0)
    d = ImageDraw.Draw(im)
    box = [C - r, C - r, C + r, C + r]
    if width:
        d.ellipse(box, outline=255, width=int(round(width)))
    else:
        d.ellipse(box, fill=255)
    return np.asarray(im, dtype=np.float32) / 255.0


yy, xx = np.mgrid[0:W, 0:W].astype(np.float32)
dist = np.hypot(xx - C + 0.5, yy - C + 0.5)


def mix(base, color, alpha):
    a = alpha[..., None]
    return base * (1 - a) + np.array(color, dtype=np.float32)[None, None, :] * a


def screen(base, color, alpha):
    c = np.array(color, dtype=np.float32)[None, None, :] / 255.0
    b = base / 255.0
    a = alpha[..., None]
    return 255.0 * (1 - (1 - b) * (1 - c * a))


# ---- what never moves: the disc, the lattice, the ring -------------------
def stops(t, cols, at):
    out = np.zeros(t.shape + (3,), dtype=np.float32)
    for i in range(len(at) - 1):
        lo, hi = at[i], at[i + 1]
        m = (t >= lo) & (t <= hi)
        f = ((t - lo) / (hi - lo))[m][:, None]
        out[m] = np.array(cols[i], np.float32) * (1 - f) + np.array(cols[i + 1], np.float32) * f
    out[t > at[-1]] = cols[-1]
    return out


gy = np.hypot(xx - C, yy - (C - 0.22 * R)) / (1.12 * R)   # the light falls from a little above
disc = stops(np.clip(gy, 0, 1), [NIGHT_HI, NIGHT_MID, NIGHT_LO], [0.0, 0.55, 1.0])

lat_polys = (star(LAT, 22.5, 3) + star(LAT, 0, 2) + star(0.73 * LAT, 0, 3)
             + star(0.73 * LAT, 22.5, 1))
lattice = lines_mask(lat_polys, 1.05 * SS)
lattice = np.maximum(lattice, 0.75 * circle_mask(LAT, 1.0 * SS))
ring = circle_mask(RING, 2.2 * SS)
ring_in = circle_mask(RING - 4.4 * SS, 0.8 * SS)
edge = np.clip(R - dist + 0.5, 0, 1)
# a point of gold where each of the outer star's eight arms meets the circle
nodes = np.zeros((W, W), np.float32)
for i in range(8):
    nx, ny = pt(LAT, i * 45 + 22.5)
    nodes = np.maximum(nodes, np.clip(1.5 * SS - np.hypot(xx - nx, yy - ny) + 0.5 * SS, 0, SS) / SS)

# the lattice fades toward the centre, so the light has room
lat_fade = np.clip((dist - 0.36 * R) / (0.30 * R), 0, 1) * 0.30 + 0.06
gold_ring = stops(np.clip((yy - (C - R)) / (2 * R), 0, 1), [GOLD_HI, GOLD_DEEP], [0.0, 1.0])

base = disc.copy()
base = mix(base, GOLD, lattice * lat_fade)
ring_a = ring * 0.92
base = base * (1 - ring_a[..., None]) + gold_ring * ring_a[..., None]
base = mix(base, GOLD, ring_in * 0.32)
base = mix(base, GOLD_HI, nodes * 0.75)


# ---- what breathes: the halo, the star, the core --------------------------
def bump(rad):
    """a soft light that ends exactly at rad, so nothing beyond it ever changes"""
    t = np.clip(1 - (dist / rad) ** 2, 0, 1)
    return t * t * t


HALO_R = 0.52 * R
GLOW_R = 0.22 * R
# the core's colour runs from the white of the flame to the gold around it
# (the console's own light: #FFFBEA, then #F7E19A)
core_col = stops(np.clip(dist / GLOW_R, 0, 1), [CORE, (0xF7, 0xE1, 0x9A), GOLD], [0.0, 0.45, 1.0])
# the star's own light: brighter at its heart, fainter toward its points
star_light = np.clip(1 - dist / (0.46 * R), 0, 1)


def frame(b):
    """b runs from 1 (the top of the breath) to 0 (the bottom)."""
    sc = 0.94 + 0.11 * b
    op = 0.80 + 0.20 * b
    img = base.copy()
    img = screen(img, HALO, bump(HALO_R) * (0.40 + 0.22 * b))
    glow = bump(GLOW_R) * (0.34 + 0.24 * b)
    img = img * (1 - glow[..., None]) + core_col * glow[..., None]
    rs = 0.42 * R * sc
    sq = star(rs, 0, 2)
    img = mix(img, HALO, fill_mask(sq) * (0.10 + 0.22 * star_light) * op)
    img = mix(img, CREAM, lines_mask(sq, 2.6 * SS) * 0.92 * op)
    img = mix(img, GOLD, lines_mask(star(rs * 0.80, 0, 2), 1.0 * SS) * 0.55 * op)
    core = np.clip(0.066 * R * sc - dist + 0.5 * SS, 0, SS) / SS
    img = mix(img, CORE, core)
    return img


def bring_down(img):
    """from the drawing size to the emblem's, the edge leaning on the band colour"""
    a = edge
    rgb = img * a[..., None] + np.array(BAND, np.float32)[None, None, :] * (1 - a[..., None])
    big = Image.fromarray(np.clip(rgb + 0.5, 0, 255).astype(np.uint8), "RGB")
    small = big.resize((S, S), Image.BOX)
    am = Image.fromarray((a * 255).astype(np.uint8), "L").resize((S, S), Image.BOX)
    return small, am


def main():
    os.makedirs(OUT, exist_ok=True)
    rgbs, alpha = [], None
    for k in range(FRAMES):
        b = 0.5 + 0.5 * math.cos(2 * math.pi * k / FRAMES)
        b = b * b * (3 - 2 * b)          # eased, so the breath lingers at each end
        rgb, am = bring_down(frame(b))
        rgbs.append(rgb)
        alpha = am
    clear = np.asarray(alpha) < 128

    # One palette for every frame, so a colour never shifts between them,
    # shared out by where the colour lives: the still night and its gold
    # lines take OUTER colours, the breathing light at the centre the rest,
    # so the halo has steps fine enough to read as one soft light rather
    # than rings.
    r_small = np.hypot(*np.mgrid[0:S, 0:S].astype(np.float32) - (S / 2.0 - 0.5))
    inner = r_small < (HALO_R / SS) + 2
    still = np.asarray(rgbs[0])[~inner & ~clear].reshape(1, -1, 3)
    moving = np.concatenate([np.asarray(im)[inner].reshape(1, -1, 3) for im in rgbs], axis=1)
    pa = Image.fromarray(still, "RGB").quantize(colors=OUTER, method=Image.Quantize.MEDIANCUT, kmeans=2, dither=Image.Dither.NONE)
    pb = Image.fromarray(moving, "RGB").quantize(colors=255 - OUTER, method=Image.Quantize.MEDIANCUT, kmeans=2, dither=Image.Dither.NONE)
    palette = pa.getpalette()[: OUTER * 3] + pb.getpalette()[: (255 - OUTER) * 3]
    palette = palette + [0] * (255 * 3 - len(palette)) + [0, 0, 0]
    pal_img = Image.new("P", (1, 1))
    pal_img.putpalette(palette)

    # Frame one is whole. After it, a pixel is sent again only when the
    # colour it shows has drifted more than TOL from the colour it should
    # be; everywhere else the frame is left clear and the last one shows
    # through. A breath this slow never needs more, and it is what keeps
    # the file small.
    pal_rgb = np.array(palette, dtype=np.int16).reshape(-1, 3)
    frames, shown = [], None
    for im in rgbs:
        q = np.asarray(im.quantize(palette=pal_img, dither=Image.Dither.NONE)).astype(np.int16)
        want = np.asarray(im).astype(np.int16)
        if shown is None:
            out = q.copy()
            shown = pal_rgb[q]
        else:
            drift = np.abs(want - shown).max(axis=2) > TOL
            out = np.where(drift, q, 255)
            shown = np.where(drift[..., None], pal_rgb[q], shown)
        out[clear] = 255
        p = Image.fromarray(out.astype(np.uint8), "P")
        p.putpalette(palette)
        p.info["transparency"] = 255
        frames.append(p)

    gif = os.path.join(OUT, NAME + ".gif")
    frames[0].save(gif, save_all=True, append_images=frames[1:], duration=MS, loop=0,
                   disposal=1, transparency=255, optimize=False)
    still = os.path.join(OUT, NAME + "-still.png")
    frames[0].save(still, optimize=True, transparency=255)

    size = os.path.getsize(gif)
    print("%s: %d frames, %d bytes (%.1f KB), %d ms each" % (os.path.relpath(gif, ROOT), FRAMES, size, size / 1024.0, MS))
    print("%s: %d bytes" % (os.path.relpath(still, ROOT), os.path.getsize(still)))
    if size > LIMIT:
        print("TOO LARGE: the emblem must stay under %d KB" % (LIMIT // 1024))
        sys.exit(1)


if __name__ == "__main__":
    main()
