#!/usr/bin/env python3
"""NOOR - find out how big each figure actually is.

    python3 measureplates.py        ->  figs/_bbox.json

A figure's viewBox is what the page author typed, and on this site it is
routinely NOT the box the drawing occupies. Labels are set with text-anchor
start or end and run out past the right edge; a caption sits below the last
line of the drawing; several figures were given a round 520 by 280 with the
content sitting inside 470 of it.

That did not matter on the page, because the page lets a figure overflow. It
matters in a film, where the plate is clipped to its box so the camera has an
edge to work against: anything outside the viewBox is simply cut off, which is
how a label ended up sliced down the middle on the first sheet.

So every plate is laid out once in a real browser and asked how big it is.
The answer replaces the author's viewBox.
"""
import io, json, os, re, sys
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    s = open(os.path.join(HERE, "web", "plates.js"), encoding="utf-8").read()
    plates = json.loads(s.split("window.NOORPLATE = ", 1)[1]
                         .split(";\nwindow.NOORPLATEINFO", 1)[0])
    css = re.search(r"<style>(.*?)</style>",
                    open(os.path.join(HERE, "web", "film.html"), encoding="utf-8").read(),
                    re.S).group(1)
    body = "".join('<div class="pl" data-n="%s">%s</div>' % (n, v) for n, v in plates.items())
    html = ("<!doctype html><meta charset=utf-8><html data-frame=tall data-theme=nutvoid>"
            "<style>%s\n.pl{width:900px;margin:0}"
            ".pl svg{width:900px;height:auto;overflow:visible}</style>"
            "<body>%s</body></html>" % (css, body))
    out = {}
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        pg = br.new_page(viewport={"width": 1000, "height": 800})
        pg.goto("file://" + os.path.join(HERE, "web") + "/")
        pg.set_content(html)
        pg.evaluate("() => Promise.all(Array.from(document.fonts).map(f => f.load()))")
        pg.wait_for_function("() => document.fonts.status === 'loaded'")
        pg.wait_for_timeout(1200)
        out = pg.evaluate("""() => {
          var o = {};
          document.querySelectorAll('.pl').forEach(function(d){
            var svg = d.querySelector('svg'); if (!svg) return;
            var b = null;
            svg.childNodes.forEach(function(c){
              if (c.nodeType !== 1 || !c.getBBox) return;
              var t = c.tagName.toLowerCase();
              if (t === 'style' || t === 'defs' || t === 'title' || t === 'desc') return;
              var r; try { r = c.getBBox(); } catch(e){ return; }
              if (!r || (!r.width && !r.height)) return;
              if (!b) b = {x0:r.x, y0:r.y, x1:r.x+r.width, y1:r.y+r.height};
              else { b.x0=Math.min(b.x0,r.x); b.y0=Math.min(b.y0,r.y);
                     b.x1=Math.max(b.x1,r.x+r.width); b.y1=Math.max(b.y1,r.y+r.height); }
            });
            if (b) o[d.dataset.n] = [b.x0, b.y0, b.x1-b.x0, b.y1-b.y0];
          });
          return o;
        }""")
        br.close()
    p = os.path.join(HERE, "figs", "_bbox.json")
    json.dump(out, open(p, "w"), indent=0)
    print("  measured %d plates -> %s" % (len(out), p))


if __name__ == "__main__":
    main()
