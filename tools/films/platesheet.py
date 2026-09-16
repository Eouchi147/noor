#!/usr/bin/env python3
"""NOOR - look at all one hundred and thirty nine plates at once.

    python3 platesheet.py                 every plate, six to a row
    python3 platesheet.py --only sieve,camera9,road

The figures came off twenty one different pages of noorcodex.com with twenty
one different stylesheets, and the only way to know which of them survives
being carried into a film frame -- and which topic each one can actually
carry -- is to look at all of them side by side. Each tile is the plate at
rest, in its own box, at exactly the size and weight the film will lay it on
the frame, on the film's own ground.
"""
import argparse, io, json, os, re, sys, math
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
sys.path.insert(0, HERE)
from contact import a_font, FONT_TRY, FONT_DIRS   # the label face, wherever we are

TILE = 320


def load():
    s = open(os.path.join(HERE, "web", "plates.js"), encoding="utf-8").read()
    p = json.loads(s.split("window.NOORPLATE = ", 1)[1]
                    .split(";\nwindow.NOORPLATEINFO", 1)[0])
    i = json.loads(s.rsplit("window.NOORPLATEINFO = ", 1)[1].rstrip().rstrip(";"))
    return p, i


def page(plates, info, names):
    css = open(os.path.join(HERE, "web", "film.html"), encoding="utf-8").read()
    css = re.search(r"<style>(.*?)</style>", css, re.S).group(1)
    cells = []
    for n in names:
        bx, by = info[n]["box"]
        cells.append(
            '<div class="cell"><div class="pl" style="width:%dpx;height:%dpx">%s</div>'
            '<div class="cap">%s</div></div>'
            % (bx, by, plates[n], n))
    return ("<!doctype html><meta charset=utf-8><html data-frame=tall data-theme=nutvoid>"
            "<style>%s\n"
            "body{background:#04060F;width:1120px}"
            ".cell{width:1120px;padding:26px 55px 8px;box-sizing:border-box}"
            ".pl{margin:0 auto;overflow:hidden}"
            ".pl svg{width:100%%;height:100%%;display:block;overflow:hidden}"
            ".cap{font:600 22px 'NoorCard',system-ui;color:#8ea;opacity:.75;"
            "text-align:center;padding-top:10px}"
            "</style><body>%s</body></html>" % (css, "".join(cells)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--out", default="platesheet")
    a = ap.parse_args()
    plates, info = load()
    names = [n.strip() for n in a.only.split(",") if n.strip()] or sorted(plates)
    names = [n for n in names if n in plates]
    os.makedirs(OUT, exist_ok=True)

    shots = []
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=["--force-color-profile=srgb",
                                      "--disable-lcd-text", "--font-render-hinting=none"])
        pg = br.new_page(viewport={"width": 1120, "height": 900},
                         device_scale_factor=1)
        pg.goto("file://" + os.path.join(HERE, "web", "film.html").replace("film.html", ""))
        pg.set_content(page(plates, info, names))
        pg.evaluate("() => Promise.all(Array.from(document.fonts).map(f => f.load()))")
        pg.wait_for_function("() => document.fonts.status === 'loaded'")
        pg.wait_for_timeout(900)
        for n in names:
            el = pg.query_selector('.cell:has(.cap:text-is("%s"))' % n)
            if el is None:
                idx = names.index(n)
                el = pg.query_selector_all(".cell")[idx]
            shots.append((n, Image.open(io.BytesIO(el.screenshot(type="png")))))
        br.close()

    cols = a.cols
    rows = math.ceil(len(shots) / cols)
    hs = []
    for r in range(rows):
        row = shots[r * cols:(r + 1) * cols]
        hs.append(max(int(im.height * TILE / im.width) for _, im in row))
    sheet = Image.new("RGB", (TILE * cols, sum(hs)), (7, 9, 18))
    y = 0
    for r in range(rows):
        row = shots[r * cols:(r + 1) * cols]
        for c, (n, im) in enumerate(row):
            h = int(im.height * TILE / im.width)
            sheet.paste(im.convert("RGB").resize((TILE, h)), (c * TILE, y))
        y += hs[r]
    #  a sheet of a hundred and thirty nine is too tall for one file to be
    #  looked at, so it comes out in pages of eight rows
    per = 8 * cols
    n = 0
    for i in range(0, len(shots), per):
        part = shots[i:i + per]
        rr = math.ceil(len(part) / cols)
        hh = []
        for r in range(rr):
            row = part[r * cols:(r + 1) * cols]
            hh.append(max(int(im.height * TILE / im.width) for _, im in row))
        sh = Image.new("RGB", (TILE * cols, sum(hh)), (7, 9, 18))
        yy = 0
        for r in range(rr):
            row = part[r * cols:(r + 1) * cols]
            for c, (nm, im) in enumerate(row):
                h = int(im.height * TILE / im.width)
                sh.paste(im.convert("RGB").resize((TILE, h)), (c * TILE, yy))
            yy += hh[r]
        p = os.path.join(OUT, "%s-%02d.png" % (a.out, n))
        sh.save(p); print("  ->", p)
        n += 1


if __name__ == "__main__":
    main()
