#!/usr/bin/env python3
"""NOOR · the moving picture behind the words.

A still with a Ken Burns push reads as a slideshow. What reads as cinema is
parallax, depth of field, light that breathes, and a subject that does something
at the moment the sentence about it arrives.

Everything here is generated: star polygon lattices, star fields, orbits,
arcades. No photograph is used anywhere, so there is no licence to honour, no
attribution to print, no dead link in two years, and no possibility of a
figurative image reaching the frame.

The whole background is composited in numpy at half resolution, where a full
frame costs about half a million pixels instead of two million, and is upscaled
once at the end. Softness is the point, so nothing is lost.
"""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import geom

W, H = 1080, 1920
BW, BH = 540, 960                     # the background works at half scale
OW, OH = 660, 1150                    # over-rendered, so parallax has room to move

GOLD = (233, 200, 106)


def _np(img):
    return np.asarray(img, dtype=np.float32)


def _lattice(seed, n, k, cols, size, lw=2, blur=0.0):
    """the line art of a star polygon field, as a single intensity mask.

    Only the drawing: no sky, no glow. Colour and strength are decided when the
    plane is composited, which is what keeps three stacked planes from blowing
    the frame out to white.
    """
    w, h = size
    img = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(img)
    R = w / (cols * 2.0)
    step = R * 2.0
    rows = int(h / step) + 3
    for r in range(-1, rows):
        for c in range(-1, cols + 2):
            cx, cy = c * step, r * step
            d.line([cx, cy, cx + step, cy], fill=30, width=1)
            d.line([cx, cy, cx, cy + step], fill=30, width=1)
            geom.draw_star(d, cx + step / 2, cy + step / 2, R * .74, n, k,
                           170, lw, phase=-math.pi / 2)
    if blur: img = img.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(img, dtype=np.float32) / 255.0


def _bokeh(n, k, size=520, blur=9.0):
    """one rosette, thrown well out of focus: the plane nearest the lens"""
    img = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(img)
    geom.draw_star(d, size / 2, size / 2, size * .43, n, k, 190, 7,
                   phase=-math.pi / 2)
    geom.draw_star(d, size / 2, size / 2, size * .26, n, k, 120, 5,
                   phase=-math.pi / 2 + math.pi / n)
    return img.filter(ImageFilter.GaussianBlur(blur))


def _sky(stops, w, h):
    col = np.zeros((h, 3), dtype=np.float32)
    n = len(stops) - 1
    for y in range(h):
        t = y / (h - 1) * n
        i = min(int(t), n - 1)
        f = t - i
        for c in range(3):
            col[y, c] = stops[i][c] + (stops[i + 1][c] - stops[i][c]) * f
    return np.repeat(col[:, None, :], w, axis=1)


def _stars(seed, count, w, h):
    r = random.Random(seed)
    x = np.array([r.random() * w for _ in range(count)], dtype=np.float32)
    y = np.array([r.random() * h for _ in range(count)], dtype=np.float32)
    b = np.array([r.random() ** 2.4 for _ in range(count)], dtype=np.float32)
    ph = np.array([r.random() * 6.283 for _ in range(count)], dtype=np.float32)
    sp = np.array([0.35 + 0.65 * r.random() for _ in range(count)], dtype=np.float32)
    return x, y, b, ph, sp


class Scene:
    """the thing the card is actually about, drawn over the field"""
    def __init__(self, kind, **kw):
        self.kind, self.kw = kind, kw

    def draw(self, d, t, secs, cue, a=1.0):
        """cue is 0 before the scene's moment and eases to 1 through it;
        a is how much room the words have left it"""
        self.a = a
        getattr(self, "_" + self.kind, self._none)(d, t, secs, cue)

    def _none(self, d, t, secs, cue): pass

    def A(self, v): return int(max(0, min(255, v * getattr(self, 'a', 1.0))))

    # --- a faint smudge among the stars, found and marked
    def _andromeda(self, d, t, secs, cue):
        cx, cy = BW * 0.64, BH * 0.255
        drift = 9 * math.sin(t * 0.20)
        cx += drift * 0.4; cy += drift * 0.2
        glow = 0.20 + 0.80 * cue
        A = getattr(self, "a", 1.0)
        # a halo that swells as the sentence about it lands
        for i in range(10, 0, -1):
            f = i / 10.0
            rr = 210 * f * (0.8 + 0.3 * cue)
            d.ellipse([cx - rr, cy - rr * .70, cx + rr, cy + rr * .70],
                      fill=(122, 142, 214, int(7 * cue * A)))
        for i in range(14, 0, -1):               # the little cloud itself
            f = i / 14.0
            rx, ry = 70 * f, 25 * f
            d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry],
                      fill=(206, 214, 246, int(19 * glow * A)))

    # --- uniform circles, which is the whole claim of the card
    def _epicycles(self, d, t, secs, cue):
        cx, cy = BW * 0.50, BH * 0.44
        R1, R2 = 196, 76
        a = 0.34 + 0.66 * cue
        d.ellipse([cx - R1, cy - R1, cx + R1, cy + R1],
                  outline=(150, 168, 220, self.A(130 * a)), width=2)
        w1 = t * 0.62
        px, py = cx + R1 * math.cos(w1), cy + R1 * math.sin(w1)
        d.ellipse([px - R2, py - R2, px + R2, py + R2],
                  outline=GOLD + (self.A(165 * a),), width=2)
        w2 = -t * 1.55
        qx, qy = px + R2 * math.cos(w2), py + R2 * math.sin(w2)
        pts = []                                  # the path the pair traces out
        for i in range(0, 260):
            s = t - i * 0.02
            if s < 0: break
            ax, ay = cx + R1 * math.cos(s * 0.62), cy + R1 * math.sin(s * 0.62)
            pts.append((ax + R2 * math.cos(-s * 1.55), ay + R2 * math.sin(-s * 1.55)))
        for i in range(len(pts) - 1):
            f = 1 - i / max(1, len(pts) - 1)
            d.line([pts[i], pts[i + 1]], fill=GOLD + (self.A(200 * f * a),), width=3)
        d.ellipse([qx - 5, qy - 5, qx + 5, qy + 5], fill=(255, 249, 227, self.A(200 * a)))
        d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=GOLD + (self.A(200 * a),))

    # --- the lunar month, which is why the calendar exists at all
    def _moon(self, d, t, secs, cue):
        cx, cy = BW * 0.60, BH * 0.215
        R, SSx = 104, 3
        A = getattr(self, "a", 1.0)
        box = int(R * 2.9)
        c = box * SSx / 2
        r = R * SSx
        lit = Image.new("L", (box * SSx, box * SSx), 0)
        ld = ImageDraw.Draw(lit)
        # a waxing month: thin crescent at the top of the reel, half by the end
        phase = 0.055 + 0.20 * (t / secs)
        k = math.cos(phase * 2 * math.pi)
        ld.pieslice([c - r, c - r, c + r, c + r], -90, 90, fill=255)
        ld.ellipse([c - abs(k) * r, c - r, c + abs(k) * r, c + r],
                   fill=0 if k > 0 else 255)
        lit = lit.resize((box, box), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.4))
        lit = lit.point(lambda v: int(v * (0.74 + 0.20 * cue) * A))

        halo = Image.new("L", (box, box), 0)
        ImageDraw.Draw(halo).ellipse([box / 2 - R * .96, box / 2 - R * .96,
                                      box / 2 + R * .96, box / 2 + R * .96], fill=76)
        halo = halo.filter(ImageFilter.GaussianBlur(30)).point(lambda v: int(v * A))

        px, py = int(cx - box / 2), int(cy - box / 2)
        d._image.paste(Image.new("RGB", (box, box), (232, 214, 170)), (px, py), halo)
        d._image.paste(Image.new("RGB", (box, box), (247, 242, 226)), (px, py), lit)

    # --- the house geometry, drawing itself the way a compass would
    def _rosette(self, d, t, secs, cue):
        cx, cy = BW * 0.50, BH * 0.42
        R = 210
        n, k = self.kw.get("n", 8), self.kw.get("k", 3)
        pts, _ = geom.star_points(cx, cy, R, n, k, -math.pi / 2 + t * 0.035)
        p = min(1.0, 0.06 + t / (secs * 0.62))
        seg = len(pts)
        a = self.A(90 + 80 * cue)
        d.ellipse([cx - R, cy - R, cx + R, cy + R],
                  outline=(150, 168, 220, self.A(48)), width=1)
        for i in range(seg):
            f = max(0.0, min(1.0, p * seg - i))
            if f <= 0: break
            x0, y0 = pts[i]
            x1, y1 = pts[(i + 1) % seg]
            d.line([x0, y0, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f],
                   fill=GOLD + (a,), width=2)
        d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=GOLD + (self.A(150),))

    # --- a codex spread, writing itself line by line
    def _pages(self, d, t, secs, cue):
        cx, cy = BW * 0.50, BH * 0.44
        pw, ph, gap = 176, 250, 18
        a = self.A(84 + 70 * cue)
        p = min(1.0, 0.04 + t / (secs * 0.70))
        rows = 11
        for side in (-1, 1):
            x = cx + side * (gap / 2) + (0 if side > 0 else -pw)
            d.rectangle([x, cy - ph / 2, x + pw, cy + ph / 2],
                        outline=GOLD + (self.A(70 + 50 * cue),), width=2)
            for r in range(rows):
                idx = r if side < 0 else r + rows
                f = max(0.0, min(1.0, p * rows * 2 - idx))
                if f <= 0: break
                ly = cy - ph / 2 + 22 + r * (ph - 40) / (rows - 1)
                w = (pw - 32) * (0.62 + 0.38 * ((r * 7 % 5) / 4.0))
                d.line([x + 16, ly, x + 16 + w * f, ly],
                       fill=(226, 214, 178, a), width=2)
        d.line([cx, cy - ph / 2, cx, cy + ph / 2], fill=GOLD + (self.A(60),), width=1)

    # --- rings spreading out from one point, the way water does
    def _ripples(self, d, t, secs, cue):
        cx, cy = BW * 0.50, BH * 0.44
        a0 = 120 + 70 * cue
        for i in range(7):
            ph = (t * 0.24 + i / 7.0) % 1.0
            r = 30 + ph * 300
            a = self.A(a0 * (1 - ph) ** 1.7)
            if a <= 2: continue
            d.ellipse([cx - r, cy - r * .34, cx + r, cy + r * .34],
                      outline=GOLD + (a,), width=2)
        d.ellipse([cx - 5, cy - 3, cx + 5, cy + 3], fill=(255, 249, 227, self.A(180)))

    # --- an arcade, drawing itself open
    def _arcade(self, d, t, secs, cue):
        y0, hgt = BH * 0.615, 340
        n, span = 4, 132
        x0 = BW / 2 - (n - 1) * span / 2 - span / 2
        p = min(1.0, 0.15 + t / (secs * 0.55))
        for i in range(n):
            f = max(0.0, min(1.0, p * n - i))
            if f <= 0: break
            a = self.A((130 + 90 * cue) * f)
            x = x0 + i * span
            d.arc([x, y0 - span * .5, x + span, y0 + span * .5], 180, 360,
                  fill=GOLD + (a,), width=3)
            d.line([x, y0, x, y0 + hgt], fill=GOLD + (a,), width=3)
            d.line([x + span, y0, x + span, y0 + hgt], fill=GOLD + (a,), width=3)
        d.line([x0 - 14, y0 + hgt, x0 + n * span + 14, y0 + hgt],
               fill=GOLD + (self.A(140 + 70 * cue),), width=3)


class Cine:
    """the background, ready to be asked for any second of the run"""

    def __init__(self, palette="night", seed=7, n=8, k=3, secs=20,
                 scene=None, cue_at=None, recede=None, push=0.09):
        self.P = geom.PALETTES[palette]
        P = self.P
        self.secs = secs
        self.scene = scene
        self.cue_at = cue_at if cue_at is not None else secs * 0.45
        self.recede = recede
        self.push = push

        # the night itself, deliberately dark: white type has to sit on it
        self.sky = _sky(P["sky"], OW, OH) * 0.72

        # one screen of geometry, far back and well out of focus: the house
        # texture, present but never competing with the words
        far = _lattice(seed, n, k, 2, (OW, OH), lw=2, blur=3.4)
        self.far = far[..., None] * np.array(P["deep"], dtype=np.float32) * 0.50

        # and one rosette right in front of the lens, unreadable on purpose
        self.bok = _bokeh(n, k, 520, 9.0)
        self.bok_col = np.array(P["line"], dtype=np.float32)

        self.stars = _stars(seed + 7, 900, OW, OH)
        r = random.Random(seed + 3)
        self.motes = [(r.random(), r.random(), 0.3 + r.random(),
                       r.random() * 6.283, 1 + r.random() * 2.2) for _ in range(34)]

        # a lamp behind everything, breathing
        yy, xx = np.mgrid[0:OH, 0:OW].astype(np.float32)
        dd = np.hypot((xx - OW * .5) / (OW * .70), (yy - OH * .36) / (OH * .50))
        self.lamp = (np.clip(1.0 - dd, 0, 1)[..., None] ** 2.4) * \
            np.array(P["lamp"], dtype=np.float32) * 0.85

        # grain, six fields, cycled
        g = np.random.default_rng(seed).normal(0, 1, (6, BH, BW, 1)).astype(np.float32)
        self.grain = g

        yy, xx = np.mgrid[0:BH, 0:BW].astype(np.float32)
        v = np.hypot((xx - BW * .5) / (BW * .74), (yy - BH * .46) / (BH * .70))
        self.vig = np.clip(1.0 - 0.62 * np.clip(v - 0.36, 0, None) ** 1.55, 0, 1)[..., None]

    def _plane(self, arr, t, rate, amp):
        """slice the over rendered plane at a drifting offset"""
        ox = int((OW - BW) * (0.5 + amp * math.sin(t * rate * 0.31)))
        oy = int((OH - BH) * (0.5 - amp * 0.8 * (t / self.secs) * 2 * rate))
        ox = max(0, min(OW - BW, ox)); oy = max(0, min(OH - BH, oy))
        return arr[oy:oy + BH, ox:ox + BW]

    def scene_a(self, t):
        """the picture owns the frame until the words need it"""
        if self.recede is None: return 1.0
        p = max(0.0, min(1.0, (t - self.recede) / 1.4))
        return 1.0 - 0.45 * (1 - pow(1 - p, 3))

    def frame(self, t):
        breathe = 0.88 + 0.12 * math.sin(t * 0.55)

        base = self._plane(self.sky, t, 0.35, 0.10).copy()
        base += self._plane(self.lamp, t, 0.35, 0.10) * breathe
        base += self._plane(self.far, t, 0.6, 0.16)

        # the star field, its own plane, twinkling
        x, y, b, ph, sp = self.stars
        ox = (OW - BW) * (0.5 + 0.22 * math.sin(t * 0.19))
        oy = (OH - BH) * (0.5 - 0.30 * (t / self.secs))
        px = (x - ox).astype(np.int32); py = (y - oy).astype(np.int32)
        m = (px >= 0) & (px < BW) & (py >= 0) & (py < BH)
        tw = 0.55 + 0.45 * np.sin(ph + t * sp * 2.1)
        val = (b * tw * 340.0)[m]
        np.add.at(base, (py[m], px[m]),
                  val[:, None] * np.array([1.0, 1.0, 1.06], dtype=np.float32))

        # the foreground rosette, drifting across a corner
        bs = self.bok.size[0]
        bx = int(-bs * .34 + 26 * math.sin(t * 0.17))
        by = int(BH * .58 + 34 * math.sin(t * 0.11 + 1.4) - t * 3.0)
        sx0, sy0 = max(0, bx), max(0, by)
        sx1, sy1 = min(BW, bx + bs), min(BH, by + bs)
        if sx1 > sx0 and sy1 > sy0:
            crop = np.asarray(self.bok.crop((sx0 - bx, sy0 - by,
                                             sx1 - bx, sy1 - by)),
                              dtype=np.float32)[..., None] / 255.0
            base[sy0:sy1, sx0:sx1] += crop * self.bok_col * 0.34

        img = Image.fromarray(np.uint8(np.clip(base, 0, 255)))
        img = img.filter(ImageFilter.GaussianBlur(0.55))

        d = ImageDraw.Draw(img, "RGBA")
        # dust, slow, barely there
        for fx, fy, s, phi, rate in self.motes:
            mx = (fx * BW + 26 * math.sin(t * 0.21 * rate + phi)) % BW
            my = (fy * BH - t * 5.5 * rate) % BH
            a = int(46 * s * (0.5 + 0.5 * math.sin(t * 0.8 + phi)))
            d.ellipse([mx - s, my - s, mx + s, my + s], fill=(226, 232, 250, a))

        if self.scene:
            cue = max(0.0, min(1.0, (t - self.cue_at) / 1.6))
            cue = 1 - pow(1 - cue, 3)
            sa = self.scene_a(t)
            lay = Image.new("RGBA", (BW, BH), (0, 0, 0, 0))
            self.scene.draw(ImageDraw.Draw(lay, "RGBA"), t, self.secs, cue, sa)
            # the subject sits behind the glass: sharp while it has the frame
            # to itself, softer once the words are using the same space
            lay = lay.filter(ImageFilter.GaussianBlur(0.5 + 0.7 * (1 - sa) / 0.45))
            img = Image.alpha_composite(img.convert("RGBA"), lay).convert("RGB")

        out = _np(img)
        out *= self.vig
        # grain enough to break banding on the gradients and no more: random
        # noise is the most expensive thing an encoder can be asked to keep, and
        # at 3.4 it was doubling the file for something nobody can see
        out += self.grain[int(t * 30) % 6] * 2.2
        out = Image.fromarray(np.uint8(np.clip(out, 0, 255)))
        # a slow push in, so the frame is never still
        z = 1.0 + self.push * (t / self.secs)
        if z > 1.001:
            cw, chh = BW / z, BH / z
            ox, oy = (BW - cw) * .5, (BH - chh) * .52
            out = out.crop((int(ox), int(oy), int(ox + cw), int(oy + chh)))
        return out.resize((W, H), Image.BICUBIC)
