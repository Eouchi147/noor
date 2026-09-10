#!/usr/bin/env python3
"""Move the colours out of style attributes and into the room's own stylesheet.

   An inline style is the one place a stylesheet cannot reach. The night is a
   generated stylesheet; the legibility floor is a generated stylesheet; and
   between them they answer every colour in the house except the ones written
   into a style attribute, which they cannot see and could not out-specify if
   they could. September 2026 found two of these the hard way, on the two pages
   a visitor is most likely to open:

     · the gift page's chips  -- color:color-mix(in srgb,var(--parchment) 60%,
       transparent) -- correct on parchment, black on black in the night;
     · the journal's notice   -- color:var(--jseal) -- a sealing red at 1.9:1.

   Both were found by a person looking at the site, which is the wrong way to
   find them. There were 208 more.

   So the colours are hoisted. For every style attribute that paints something,
   the colour declarations are lifted into a generated class named after their
   own content, and everything else in the attribute stays exactly where it is:

     <p style="font-size:.63rem;color:var(--jseal);margin:0">
     <p class="ih-9f21ab40" style="font-size:.63rem;margin:0">
     .ih-9f21ab40{color:var(--jseal)}

   Three properties of that shape matter. The class is a hash of the declaration
   text, so the same colours always mint the same class and running this twice
   changes nothing. The non-colour declarations stay inline, so any script that
   sets el.style.width still works. And a script that sets el.style.color still
   wins, because an inline style still beats a class -- the only thing that has
   changed is that the *initial* colour is now something a stylesheet can answer.

       python3 scripts/hoist-inline.py --dry     say what it would move
       python3 scripts/hoist-inline.py           move them
"""
import os, re, sys, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = (".git", "node_modules", "tests", ".build-src", "build", "i18n", "dictionary")
DRY = "--dry" in sys.argv

PAINT = ("color", "background", "background-color", "background-image", "fill", "stroke",
         "border", "border-color", "border-top", "border-right", "border-bottom",
         "border-left", "border-top-color", "border-right-color", "border-bottom-color",
         "border-left-color", "outline", "outline-color", "-webkit-text-fill-color",
         "box-shadow", "text-shadow", "caret-color", "text-decoration-color")
COLOUR = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|color-mix|var\(\s*--", re.I)
MARK = "/* hoisted from style attributes by scripts/hoist-inline.py */"


def split_decls(text):
    """Split on semicolons that are not inside brackets or quotes."""
    out, buf, depth, q = [], [], 0, ""
    for ch in text:
        if q:
            buf.append(ch)
            if ch == q: q = ""
            continue
        if ch in "\"'": q = ch; buf.append(ch); continue
        if ch == "(": depth += 1
        elif ch == ")": depth = max(0, depth - 1)
        if ch == ";" and not depth:
            out.append("".join(buf)); buf = []; continue
        buf.append(ch)
    if buf: out.append("".join(buf))
    return [d.strip() for d in out if d.strip()]


def paints(d):
    if ":" not in d:
        return False
    prop, val = d.split(":", 1)
    p = prop.strip().lower()
    if p.startswith("--"):
        return False                       # a per-element parameter, not a colour
    return p in PAINT and bool(COLOUR.search(val))


#  A room written in the night is left exactly as its author wrote it -- the
#  same test build-night.py uses, for the same reason.
BODY_RE = re.compile(r"(?m)^[^@{}/]*\bbody\b[^{}]*\{([^}]*)\}")
ROOT_RE = re.compile(r":root[^{]*\{([^}]*)\}")


def already_night(html):
    for style in re.findall(r"<style>([\s\S]*?)</style>", html):
        style = re.sub(r"/\*[\s\S]*?\*/", "", style)
        tok = {}
        for m in ROOT_RE.finditer(style):
            for d in m.group(1).split(";"):
                if ":" in d:
                    k, v = d.split(":", 1)
                    if k.strip().startswith("--"): tok[k.strip()] = v.strip()
        for m in BODY_RE.finditer(style):
            for d in m.group(1).split(";"):
                if ":" not in d: continue
                prop, val = d.split(":", 1)
                if prop.strip().lower() not in ("background", "background-color"): continue
                for _ in range(4):
                    mm = re.search(r"var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)", val)
                    if not mm: break
                    val = val[:mm.start()] + (tok.get(mm.group(1)) or (mm.group(2) or "")) + val[mm.end():]
                hx = re.search(r"#[0-9a-fA-F]{3,8}\b", val)
                if not hx: continue
                h = hx.group(0).lstrip("#")
                if len(h) in (3, 4): h = "".join(c * 2 for c in h[:3])
                if len(h) < 6: continue
                r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
                if (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45:
                    return True
    return False


def rooms():
    for dp, dn, fn in os.walk(ROOT):
        if any(os.sep + s in dp or dp.endswith(os.sep + s) for s in SKIP_DIRS):
            continue
        for f in sorted(fn):
            if not f.endswith(".html"):
                continue
            p = os.path.join(dp, f)
            s = open(p, encoding="utf-8", errors="ignore").read()
            #  only rooms the house dresses, and never one that is already dark:
            #  those are left exactly as their author wrote them.
            if "noor-fx.js" not in s or "data-n2=" in s[:600]:
                continue
            if already_night(s):
                continue
            yield p, os.path.relpath(p, ROOT), s


ATTR = re.compile(r'<([a-zA-Z][\w-]*)((?:\s+[^<>"\']*|\s+[a-zA-Z-]+\s*=\s*"[^"]*"|\s+[a-zA-Z-]+\s*=\s*\'[^\']*\')*?)\s*(/?)>')
STYLE_AT = re.compile(r'\sstyle\s*=\s*"([^"]*)"')
CLASS_AT = re.compile(r'\sclass\s*=\s*"([^"]*)"')


HOISTED = re.compile(r"<style>\s*" + re.escape(MARK) + r"([\s\S]*?)</style>")
IH = re.compile(r"\bih-[0-9a-f]{8}\b")


def unhoist(html):
    """Put a previous run's rules back on their elements, so a re-run is a
       fresh start rather than a second layer. Without this the script cannot
       change its own output format."""
    m = HOISTED.search(html)
    if not m:
        return html
    end = m.end()
    while end < len(html) and html[end] in "\r\n":
        end += 1
    rules = {}
    for r in re.finditer(r"((?:\.ih-[0-9a-f]{8})+)\{([^}]*)\}", m.group(1)):
        cls = re.findall(r"ih-[0-9a-f]{8}", r.group(1))[0]
        rules[cls] = r.group(2)
    html = html[:m.start()] + html[end:]

    def tag(t):
        name, attrs, close = t.group(1), t.group(2), t.group(3)
        cm = CLASS_AT.search(attrs)
        if not cm:
            return t.group(0)
        keep, back = [], []
        for c in cm.group(1).split():
            (back if IH.fullmatch(c) and c in rules else keep).append(c)
        if not back:
            return t.group(0)
        attrs = attrs[:cm.start()] + ((' class="%s"' % " ".join(keep)) if keep else "") + attrs[cm.end():]
        sm = STYLE_AT.search(attrs)
        decls = ";".join(rules[c] for c in back)
        if sm:
            attrs = attrs[:sm.start()] + (' style="%s;%s"' % (decls, sm.group(1))) + attrs[sm.end():]
        else:
            attrs += ' style="%s"' % decls
        return "<%s%s%s>" % (name, attrs, (" " + close) if close else "")

    return ATTR.sub(tag, html)


def convert(html):
    rules = {}
    moved = [0]

    def tag(m):
        name, attrs, close = m.group(1), m.group(2), m.group(3)
        sm = STYLE_AT.search(attrs)
        if not sm:
            return m.group(0)
        decls = split_decls(sm.group(1))
        paint = [d for d in decls if paints(d)]
        if not paint:
            return m.group(0)
        rest = [d for d in decls if not paints(d)]
        body = ";".join(re.sub(r"\s*:\s*", ":", d, count=1) for d in paint)
        cls = "ih-" + hashlib.sha1(body.encode("utf-8")).hexdigest()[:8]
        rules[cls] = body
        moved[0] += len(paint)
        attrs = attrs[:sm.start()] + (' style="%s"' % ";".join(rest) if rest else "") + attrs[sm.end():]
        cm = CLASS_AT.search(attrs)
        if cm:
            attrs = attrs[:cm.start()] + ' class="%s %s"' % (cm.group(1).strip(), cls) + attrs[cm.end():]
        else:
            attrs = ' class="%s"' % cls + attrs
        return "<%s%s%s>" % (name, attrs, (" " + close) if close else "")

    out = ATTR.sub(tag, html)
    return out, rules, moved[0]


def install(html, rules):
    """Put the generated rules in the room, once, where the night can read them."""
    if not rules:
        return html
    #  An inline style beats every rule in the document. A single class beats
    #  almost none of them: hoisting .gold's button on /school handed it back to
    #  .gold, which repainted a lapis gradient gold. So the class is written three
    #  times -- .ih-x.ih-x.ih-x, one element's own class counted thrice, which is
    #  legal CSS and costs nothing -- and the block is installed last in the
    #  document. That is heavy enough to keep what the attribute used to win, and
    #  still light enough for the night (html.n2-night.n2-room .ih-x.ih-x.ih-x)
    #  and the floor to answer it.
    body = MARK + "\n" + "\n".join("%s{%s}" % ((".%s" % k) * 3, v) for k, v in sorted(rules.items()))
    #  replace an existing hoisted block, or add one just before </head>
    old = re.search(r"<style>\s*" + re.escape(MARK) + r"[\s\S]*?</style>", html)
    if old:
        html = html[:old.start()] + html[old.end():]
    i = html.lower().rfind("</body>")
    if i < 0:
        i = html.lower().rfind("</html>")
    if i < 0:
        return html
    return html[:i] + "<style>" + body + "</style>" + html[i:]


def main():
    files = 0
    total = 0
    for path, rel, html in rooms():
        out, rules, moved = convert(unhoist(html))
        if not rules:
            continue
        out = install(out, rules)
        if out == html:
            continue
        files += 1
        total += moved
        print("  %-28s %3d declarations -> %d classes" % (rel, moved, len(rules)))
        if not DRY:
            open(path, "w", encoding="utf-8").write(out)
    print("%s %d colour declarations in %d rooms"
          % ("would move" if DRY else "moved", total, files))
    return 0


if __name__ == "__main__":
    sys.exit(main())
