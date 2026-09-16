#!/usr/bin/env python3
"""NOOR - carry the library's own figures, and their own styling, into the film.

    python3 buildplates.py

WHAT THIS SOLVES

figs/*.svg holds 150-odd figures lifted off noorcodex.com. They are inline
SVG with class names on them and NOTHING ELSE: every stroke weight, every
colour, every type size lives in a <style> block on the page they were drawn
for, and those blocks do not agree with one another. heroes.html calls its
strokes ln and rd; protection.html calls them s1, s2, s3; school.html adds
fs, f1, f2, hts. A film that hard-codes one page's vocabulary renders the
other twenty as black-on-black.

So each figure is shipped WITH THE RULES ITS OWN PAGE STYLES IT WITH:

  * every class used anywhere in the figure is looked up in that page's
    style blocks, including the @keyframes it references,
  * var(--x) is resolved against that page's :root, because the film has its
    own :root and would otherwise resolve them to nothing,
  * any ink that is dark (a figure drawn for a light page) is lifted to the
    film's parchment, because the film's ground is night,
  * every selector is scoped under .figsvg so nothing leaks into the film's
    own typography,
  * the whole lot is written into the figure as one <style> child.

One short shows one plate, so a per-figure style block is exact and cannot
collide with anything.
"""
import json, os, re, collections, hashlib

SITE = "/root/repo/noor-main"
HERE = os.path.dirname(os.path.abspath(__file__))
FIGS = os.path.join(HERE, "figs")

# ---------------------------------------------------------------- css reading
STYLE = re.compile(r"<style[^>]*>(.*?)</style>", re.S | re.I)
_cache = {}

def page_css(p):
    if p in _cache: return _cache[p]
    fp = os.path.join(SITE, p)
    s = open(fp, encoding="utf-8", errors="replace").read() if os.path.exists(fp) else ""
    _cache[p] = "\n".join(STYLE.findall(s))
    return _cache[p]

def rules(css):
    """(selector, body, is_at_rule) in source order, @blocks kept whole"""
    out, i, n = [], 0, len(css)
    css = re.sub(r"/\*.*?\*/", " ", css, flags=re.S)
    n = len(css)
    while i < n:
        while i < n and css[i].isspace(): i += 1
        if i >= n: break
        if css[i] == "@":
            j = css.find("{", i)
            k = css.find(";", i)
            if j < 0 or (0 <= k < j):
                if k < 0: break
                i = k + 1; continue
            depth, k = 0, j
            while k < n:
                if css[k] == "{": depth += 1
                elif css[k] == "}":
                    depth -= 1
                    if depth == 0: break
                k += 1
            out.append((css[i:j].strip(), css[j:k+1], True)); i = k + 1
        else:
            j = css.find("{", i)
            if j < 0: break
            k = css.find("}", j)
            if k < 0: break
            out.append((css[i:j].strip(), css[j+1:k].strip(), False)); i = k + 1
    return out

def root_vars(css):
    v = {}
    for sel, body, at in rules(css):
        if at or ":root" not in sel: continue
        for m in re.finditer(r"(--[\w-]+)\s*:\s*([^;]+)", body):
            v[m.group(1)] = m.group(2).strip()
    return v

def resolve(val, vars, depth=0):
    if depth > 6 or "var(" not in val: return val
    def sub(m):
        name, fb = m.group(1), (m.group(2) or "").strip(" ,")
        return vars.get(name, fb or "currentColor")
    val = re.sub(r"var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)", sub, val)
    return resolve(val, vars, depth + 1)

# --------------------------------------------------------- ink on a dark room
HEX = re.compile(r"#([0-9a-fA-F]{3,8})\b")
RGBA = re.compile(r"rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.%]+))?\s*\)")

def lum(r, g, b):
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0

def lift_hex(m):
    h = m.group(1)
    if len(h) == 3: r, g, b = (int(c * 2, 16) for c in h)
    elif len(h) in (6, 8): r, g, b = int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
    else: return m.group(0)
    L = lum(r, g, b)
    if L >= 0.34: return m.group(0)
    #  a dark ink was drawn for a paper page. Pull it up the same hue until it
    #  reads on night, keeping gold gold and grey parchment.
    mx, mn = max(r, g, b), min(r, g, b)
    if mx - mn < 26:                      # neutral -> parchment
        return "#FFFEF7"
    k = 0.86 / max(L, 0.04)
    r, g, b = (min(255, int(c * k)) for c in (r, g, b))
    return "#%02X%02X%02X" % (r, g, b)

def lift_rgba(m):
    r, g, b = (float(m.group(i)) for i in (1, 2, 3))
    a = m.group(4) or "1"
    if lum(r, g, b) >= 0.34: return m.group(0)
    if max(r,g,b) - min(r,g,b) < 26: r, g, b = 255, 254, 247
    else:
        k = 0.86 / max(lum(r, g, b), 0.04)
        r, g, b = (min(255.0, c * k) for c in (r, g, b))
    return "rgba(%d,%d,%d,%s)" % (r, g, b, a)

def lift(val):
    return RGBA.sub(lift_rgba, HEX.sub(lift_hex, val))

# ------------------------------------------------------------ which rules apply
#  PROPERTIES THAT BELONG TO THE PAGE AND NOT TO THE FILM.
#  The site plays these figures with CSS: an entrance sets opacity to 0 and
#  an animation brings it back, a draw-on sets stroke-dashoffset to the length
#  of the path. Carried over with the animation stripped out, those two would
#  leave half of every figure permanently invisible. The film supplies its own
#  entrance for every element, on a seekable timeline, so the page's is not
#  wanted and its resting state is a bug.
DROP_PROPS = ("animation", "transition", "will-change", "cursor", "pointer-events",
              "stroke-dasharray", "stroke-dashoffset", "transform", "transform-origin",
              "transform-box", "animation-delay", "animation-duration", "animation-name",
              "animation-timing-function", "animation-iteration-count",
              "animation-fill-mode", "position", "display", "width", "height",
              "max-width", "margin", "padding", "overflow", "visibility")

#  and the film's own face, always. The pages set Inter.
FACE = "'NoorCard',system-ui,sans-serif"

def brighten(val):
    """A figure drawn for the site sits on #0A1024 behind a page that is
    already lit. The film's ground is darker and the frame is watched at
    arm's length on a phone, so every ink the page set faint comes up."""
    def a(x):
        x = float(x)
        return round(min(0.94, x * 1.34 + 0.10), 3) if x < 0.72 else x
    val = re.sub(r"rgba\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*[,/]\s*([\d.]+)\s*\)",
                 lambda m: "rgba(%s,%s,%s,%s)" % (m.group(1), m.group(2), m.group(3),
                                                  a(m.group(4))), val)
    return val

def scope(sel):
    """.s1 -> .figsvg .s1 ;  text -> .figsvg text ; svg.figsvg .x -> .figsvg .x"""
    outs = []
    for part in sel.split(","):
        p = part.strip()
        if not p: continue
        p = re.sub(r"^(svg)?\.figsvg\s*", "", p)
        p = re.sub(r"^\.fig\s+", "", p)
        if p.startswith(":"): continue
        outs.append(".figsvg " + p if not p.startswith(".figsvg") else p)
    return ", ".join(outs)

SEL_CLS = re.compile(r"\.([A-Za-z_][\w-]*)")
SVG_TAGS = {"svg","g","path","line","polyline","polygon","rect","circle","ellipse",
            "text","tspan","textPath","use","defs","marker","image","foreignObject"}

def css_for(svg_body, page, TYPE=1.0, WEIGHT=1.0):
    used = set(w for c in re.findall(r'class="([^"]*)"', svg_body) for w in c.split())
    css = page_css(page)
    vars = root_vars(css)
    keep, sizes_seen, widths_seen = [], [], []
    for sel, body, at in rules(css):
        if at:
            continue
        if "@" in sel or ":root" in sel or "@media" in sel: continue
        cls = set(SEL_CLS.findall(sel))
        tags = set(re.findall(r"(?:^|[\s,>+~])([a-zA-Z][\w-]*)", sel))
        touches_svg = bool(cls & used) or bool(tags & SVG_TAGS)
        if not touches_svg: continue
        #  a selector that names a class the figure does not have is dead
        #  weight and a chance to collide
        if cls and not (cls & used): continue
        decls = []
        for d in body.split(";"):
            if ":" not in d: continue
            prop, val = d.split(":", 1)
            prop, val = prop.strip(), val.strip()
            if not prop or prop.startswith("--"): continue
            if prop in DROP_PROPS: continue
            val = lift(resolve(val, vars))
            if prop == "font-family":
                val = FACE
            elif prop in ("opacity", "fill-opacity", "stroke-opacity"):
                try:
                    f = float(val)
                except ValueError:
                    f = 1.0
                if f < 0.14: continue          # a page entrance, not a colour
                val = "%g" % min(0.96, f * 1.30 + 0.08)
            elif prop in ("fill", "stroke", "color", "stop-color"):
                val = brighten(val)
            elif prop == "stroke-width":
                m3 = re.match(r"([\d.]+)(px)?$", val)
                if m3:
                    widths_seen.append(float(m3.group(1)))
                    val = "%.2f" % (float(m3.group(1)) * WEIGHT)
            elif prop == "font-size":
                m2 = re.match(r"([\d.]+)px$", val)
                if m2:
                    sizes_seen.append(float(m2.group(1)))
                    val = "%.1fpx" % (float(m2.group(1)) * TYPE)
            decls.append("%s:%s" % (prop, val))
        if not decls: continue
        s = scope(sel)
        if s: keep.append("%s{%s}" % (s, ";".join(decls)))
    return "\n".join(keep), sizes_seen, widths_seen

# ----------------------------------------------------------------------- build
def main():
    names = {}
    pulled = json.load(open(os.path.join(FIGS, "_pulled.json")))
    #  ---- THE BOX THE DRAWING ACTUALLY OCCUPIES ------------------------
    #  measureplates.py lays every plate out in a real browser and asks it.
    #  The author's viewBox is not that box: labels anchored start or end run
    #  out past the right edge, captions sit below the last line, and several
    #  figures were given a round 520 by 280 with the drawing inside 470 of
    #  it. A page lets a figure overflow; a film clips it to its box, so the
    #  author's number is the reason a label came out sliced in half.
    BB = {}
    bp = os.path.join(FIGS, "_bbox.json")
    if os.path.exists(bp): BB = json.load(open(bp))
    plates, info = collections.OrderedDict(), collections.OrderedDict()
    src_of = {}
    for k, v in pulled.items():
        src_of[k] = v.get("from", "heroes.html")
    files = sorted(f for f in os.listdir(FIGS) if f.endswith(".svg"))
    for f in files:
        name = f[:-4]
        raw = open(os.path.join(FIGS, f), encoding="utf-8").read().strip()
        m = re.search(r'viewBox="([^"]+)"', raw)
        if not m: 
            print("  no viewBox:", name); continue
        vb = [float(x) for x in m.group(1).split()]
        if name in BB:
            b = BB[name]
            pad = max(6.0, min(b[2], b[3]) * 0.022)    # room for the stroke
            vb = [b[0] - pad, b[1] - pad, b[2] + 2 * pad, b[3] + 2 * pad]
        page = src_of.get(name)
        if page is None:
            #  a hand-laid plate (camera9) or a renamed one: find it by body
            page = "heroes.html"
            for k, v in pulled.items():
                if k == name: page = v.get("from"); break
        body = raw
        #  ---- TYPE THAT READS ON A PHONE ------------------------------
        #  THE SAME ARITHMETIC AS box() IN web/plate.js. If one changes the
        #  other has to: that function decides how large the drawing is laid
        #  on the frame, and this decides how large its labels have to be
        #  drawn so that they land readable once it is.
        #
        #  The site sets its smallest figure label at 13.5 units. On a 480
        #  wide figure enlarged 2.10 times that is 28 pixels, and 28 pixels on
        #  a phone at arm's length is a squint. Every size in the figure is
        #  scaled by the same factor, so the hierarchy the page designed
        #  survives, until the smallest clears 31 -- and never by more than
        #  half again, past which labels start colliding with the drawing.
        BOXW, BOXH = 1010.0, 1320.0
        winw = vb[2]
        scale = min(BOXW / winw, BOXH / vb[3])
        _, sizes, widths = css_for(body, page, 1.0, 1.0)
        small = min([f for f in sizes if f >= 7] or [16.0])   # smallest label
        #  THE TYPE IS NOT ENLARGED. The first cut scaled every label up
        #  until the smallest cleared thirty one pixels, and the sheet showed
        #  exactly what that costs: the sieve's three questions ran over the
        #  sieve, the gold chart's caption ran off the right edge, and the
        #  paper road's three city names ran into one another. These figures
        #  were SET, not just drawn -- the label sizes are load bearing and
        #  the gaps between them are the layout. Legibility is bought by
        #  laying the drawing 1010 wide on the frame, which is where it comes
        #  from, and nowhere else.
        TYPE = 1.0
        #  ---- AND A LINE THICK ENOUGH TO SURVIVE THE GRADE ---------------
        #  The site draws its figures at 2.4 units on a 520 unit box, shown
        #  about 700 wide on a desktop: a three pixel line on a lit page held
        #  at reading distance, which is right there and a hairline here. A
        #  film frame is graded, vignetted, grained and then watched at four
        #  hundred pixels wide on a phone, and every one of those steps takes
        #  a bite out of a thin stroke. The heaviest line in the figure is
        #  brought to six and a half pixels on the frame and the rest follow
        #  it, so the weight the drawing was designed with is kept.
        heavy = max([w for w in widths] or [2.4])
        WEIGHT = max(1.0, min(2.4, 6.4 / max(0.4, heavy * scale)))
        sheet, _, _ = css_for(body, page, TYPE, WEIGHT)
        #  the figure keeps its own class attribute; the wrapper adds figsvg
        inner = re.sub(r"^<svg[^>]*>", "", body, flags=re.S)
        inner = re.sub(r"</svg>\s*$", "", inner, flags=re.S)
        title = ""
        tm = re.search(r"<title[^>]*>(.*?)</title>", inner, re.S)
        if tm: title = re.sub(r"\s+", " ", tm.group(1)).strip()
        if sheet:
            inner = "<style>%s</style>\n%s" % (sheet, inner)
        plates[name] = ('<svg viewBox="%s" class="figsvg" '
                        'xmlns="http://www.w3.org/2000/svg">%s</svg>'
                        % (" ".join("%.1f" % v for v in vb), inner))
        info[name] = {"vb": vb, "ar": round(vb[2] / vb[3], 3), "title": title,
                      "from": page, "css": bool(sheet), "type": round(TYPE, 3),
                      "weight": round(WEIGHT, 3),
                      "scale": round(scale, 3),
                      "box": [round(winw * scale), round(vb[3] * scale)],
                      "steps": len([1 for m in re.finditer(
                          r"<(g|path|line|polyline|polygon|rect|circle|ellipse|text)\b",
                          re.sub(r"<(g|text)\b[^>]*>.*?</\1>", "", inner, flags=re.S))])}
    out = ["/* GENERATED by buildplates.py. Do not edit. */",
           "window.NOORPLATE = " + json.dumps(plates, ensure_ascii=False, indent=0) + ";",
           "window.NOORPLATEINFO = " + json.dumps(info, ensure_ascii=False, indent=0) + ";"]
    p = os.path.join(HERE, "web", "plates.js")
    open(p, "w", encoding="utf-8").write("\n".join(out) + "\n")
    nocss = [k for k, v in info.items() if not v["css"]]
    print("  %d plates -> %s  (%.0f KB)" % (len(plates), p, os.path.getsize(p) / 1024))
    if nocss: print("  no css for: %s" % ", ".join(nocss[:8]))

if __name__ == "__main__":
    main()
