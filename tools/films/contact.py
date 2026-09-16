#!/usr/bin/env python3
"""NOOR - look at every beat of a film before paying to render it.

    python3 contact.py who-was-muhammad
    python3 contact.py what-did-they-build --shape tall --cols 6

WHY THIS EXISTS
An eight minute film is 11,500 frames. Watching it is eight minutes; rendering
it is eight more. Neither tells you that beat 20 is empty until you are twenty
minutes in and looking at a hole. This renders ONE frame per beat, tiles them
with their labels, and measures each one, so a whole film is checked in about
two minutes and a blank beat announces itself instead of hiding.

The frame is taken at 62% through the beat: past the entrance animation, before
the exit, which is the only instant that shows what the beat actually looks
like at rest.
"""
import argparse, os, sys, io, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from spec import FRAMES
from render import Stage, film, OUT
from playwright.sync_api import sync_playwright

#  ---- THE LABEL FONT, WHEREVER THIS IS RUN --------------------------
#  These two were absolute paths into a Debian font package, which is
#  correct on the box this was written on and does not exist on a Mac. The
#  whole sheet rendered, every beat measured and passed, and then the last
#  step threw OSError: cannot open resource while drawing the captions.
#  Losing a two minute render to a missing caption font is a silly way to
#  lose two minutes, so the path is now looked for rather than assumed, and
#  if none of them is there the sheet is still drawn, in Pillow's own font.
FONT_TRY = [
    #  macOS
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/SFNS.ttf",
    "/Library/Fonts/Arial.ttf",
    #  Debian and Ubuntu
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]
FONTB_TRY = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/SFNS.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]


FONT_DIRS = ["/System/Library/Fonts", "/System/Library/Fonts/Supplemental",
             "/Library/Fonts", os.path.expanduser("~/Library/Fonts"),
             "/usr/share/fonts", "/usr/local/share/fonts"]


def a_font(paths, size):
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    #  AND IF NONE OF THE NAMED ONES IS THERE, GO AND LOOK. Font layouts
    #  differ between macOS versions and between Linux distributions, and a
    #  list of paths will always be one system out of date. Any real
    #  typeface is fine here; these are eleven pixel captions under a
    #  contact sheet, not the film.
    for d in FONT_DIRS:
        if not os.path.isdir(d):
            continue
        try:
            for f in sorted(os.listdir(d)):
                if f.lower().endswith((".ttf", ".ttc", ".otf")):
                    try:
                        return ImageFont.truetype(os.path.join(d, f), size)
                    except Exception:
                        continue
        except Exception:
            continue
    #  the sheet is about the pictures. A default bitmap caption is worse
    #  than a set one and infinitely better than a traceback.
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def label_of(i, b, t0):
    fig = (b.get("lume") or {}).get("kind")
    txt = b.get("text") or b.get("en") or b.get("ar") or b.get("eyebrow") or ""
    txt = " ".join(str(txt).split())[:52]
    return ("%02d  %s  %.0fs+%.0f%s" % (i, b["kind"], t0, b["hold"],
                                        "  [" + fig + "]" if fig else ""), txt)


def measure(im):
    """What is actually on this frame.

    ink   share of pixels that differ from the frame's own background mode.
          A beat that draws nothing still has a lit room behind it, so
          "is it black" is the wrong question; "does anything sit on the
          ground" is the right one.
    """
    a = np.asarray(im.convert("L").resize((240, 135)), dtype=np.float32)
    bg = np.median(a)
    ink = float(np.mean(np.abs(a - bg) > 10)) * 100.0
    return ink, float(a.std())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--shape", default="wide")
    ap.add_argument("--at", type=float, default=0.62)
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--tile", type=int, default=520)
    ap.add_argument("--chapter", default=None)
    a = ap.parse_args()

    F = film(a.slug)
    chs = F["chapters"]
    if a.chapter:
        chs = [c for c in chs if c["id"].startswith(a.chapter)]
    os.makedirs(OUT, exist_ok=True)

    shots, rows, errs = [], [], []
    with sync_playwright() as pw:
        st = Stage(pw, FRAMES[a.shape])
        for ch in chs:
            st.build(ch)
            t0 = 0.0
            for i, b in enumerate(ch["beats"]):
                hold = max(1.2, b.get("hold", 4))
                ms = (t0 + hold * a.at) * 1000.0
                n0 = len(st.errs)
                im = Image.open(io.BytesIO(st.shot(ms))).convert("RGB")
                ink, sd = measure(im)
                head, txt = label_of(i, b, t0)
                shots.append((im, head, txt, ink))
                rows.append((i, b, t0, ink, sd))
                if len(st.errs) > n0:
                    errs.append((i, st.errs[-1]))
                t0 += hold + (b.get("gap") or 0)
        st.close()

    #  the report, before the picture
    inks = np.array([r[3] for r in rows])
    print("\n  %-4s %-10s %7s %7s   %s" % ("#", "kind", "start", "ink%", "verdict"))
    bad = []
    for i, b, t0, ink, sd in rows:
        v = ""
        if ink < 0.8:
            v = "EMPTY, nothing on the ground"; bad.append(i)
        elif ink < 2.0:
            v = "nearly empty"; bad.append(i)
        print("  %-4d %-10s %6.1fs %6.2f   %s" % (i, b["kind"], t0, ink, v))
    print("\n  median ink %.2f%%   floor %.2f%%   %d beat(s) flagged"
          % (np.median(inks), inks.min(), len(bad)))
    for i, e in errs:
        print("  page error on beat %d: %s" % (i, e[:160]))

    #  the sheets
    W = a.tile
    H = int(W * FRAMES[a.shape]["h"] / FRAMES[a.shape]["w"])
    LH, PAD = 40, 10
    per = a.cols * 4
    f1 = a_font(FONTB_TRY, 15)
    f2 = a_font(FONT_TRY, 14)
    out = []
    for s in range(0, len(shots), per):
        grp = shots[s:s + per]
        rn = (len(grp) + a.cols - 1) // a.cols
        sheet = Image.new("RGB", (a.cols * (W + PAD) + PAD,
                                  rn * (H + LH + PAD) + PAD), (16, 16, 20))
        d = ImageDraw.Draw(sheet)
        for k, (im, head, txt, ink) in enumerate(grp):
            x = PAD + (k % a.cols) * (W + PAD)
            y = PAD + (k // a.cols) * (H + LH + PAD)
            sheet.paste(im.resize((W, H), Image.LANCZOS), (x, y))
            col = (235, 178, 41) if ink >= 2.0 else (255, 90, 70)
            d.text((x + 2, y + H + 4), head, font=f1, fill=col)
            d.text((x + 2, y + H + 22), txt, font=f2, fill=(150, 150, 158))
        p = os.path.join(OUT, "contact-%s-%s-%02d.png" % (a.slug, a.shape, s // per))
        sheet.save(p)
        out.append(p); print("  " + p)
    return out


if __name__ == "__main__":
    main()
