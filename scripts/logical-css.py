#!/usr/bin/env python3
"""Turn direction-blind CSS into direction-aware CSS, everywhere at once.

padding-left is a promise that text runs left to right. Seven of the Codex's
languages do not. Every one of these swaps is a no-op in English (the logical
property resolves to exactly the physical one) and a correction in Arabic, Urdu,
Persian, Dari, Pashto and Shahmukhi Punjabi."""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {".git", "node_modules", "i18n", "build", "tests", "audit"}
EXTS = (".html", ".css", ".py", ".js")

# order matters: longest property name first so a prefix never eats a longer one
SWAPS = [
    (r"\bpadding-left\s*:", "padding-inline-start:"),
    (r"\bpadding-right\s*:", "padding-inline-end:"),
    (r"\bborder-left-color\s*:", "border-inline-start-color:"),
    (r"\bborder-right-color\s*:", "border-inline-end-color:"),
    (r"\bborder-left-width\s*:", "border-inline-start-width:"),
    (r"\bborder-right-width\s*:", "border-inline-end-width:"),
    (r"\bborder-left\s*:", "border-inline-start:"),
    (r"\bborder-right\s*:", "border-inline-end:"),
    (r"\btext-align\s*:\s*left\b", "text-align:start"),
    (r"\btext-align\s*:\s*right\b", "text-align:end"),
]
# margin-left/right only when it is not the auto that centres a block
MARGIN = [
    (re.compile(r"\bmargin-left\s*:\s*(?!auto)"), "margin-inline-start:"),
    (re.compile(r"\bmargin-right\s*:\s*(?!auto)"), "margin-inline-end:"),
]
# the pinned markers: left/right inside a ::before or ::after block

# the four value shorthand is physical too: "padding: a b c d" means top right
# bottom left, and in Arabic the d belongs on the other side. Only rewrite when
# the two sides actually differ, so nothing symmetrical is churned.
FOUR = re.compile(r"\b(padding|margin)\s*:\s*([^;{}]+?)\s*(?=[;}])")


def _four(m):
    prop, val = m.group(1), m.group(2).strip()
    if val.startswith("var(") or "calc(" in val or "!important" in val:
        return m.group(0)
    parts = val.split()
    if len(parts) != 4:
        return m.group(0)
    top, right, bottom, left = parts
    if right == left:
        return m.group(0)
    return "%s-block:%s %s;%s-inline:%s %s" % (prop, top, bottom, prop, left, right)

PSEUDO = re.compile(r"(::(?:before|after)\s*\{[^}]*?)\b(left|right)\s*:", re.S)


def fix_css(text, css_only=False):
    n = 0
    for pat, rep in SWAPS:
        text, c = re.subn(pat, rep, text)
        n += c
    for pat, rep in MARGIN:
        text, c = pat.subn(rep, text)
        n += c

    if css_only:
        text, c = FOUR.subn(_four, text)
        n += c

    def pseudo(m):
        side = "start" if m.group(2) == "left" else "end"
        return m.group(1) + "inset-inline-" + side + ":"
    prev = None
    while prev != text:
        prev = text
        text, c = PSEUDO.subn(pseudo, text)
        n += c
    return text, n



_extra = 0
STYLE_BLOCK = re.compile(r"(<style[^>]*>)([\s\S]*?)(</style>)", re.I)
CSS_CONST = re.compile(r'((?:CSS|STYLE|ROOM_CSS|FIGCSS)\s*=\s*(?:r?"""|r?\'\'\'))([\s\S]*?)("""|\'\'\')')


def _restyle(text):
    """Rewrite four value shorthands only where the text really is a stylesheet."""
    total = 0

    def one(m):
        nonlocal total
        body, k = fix_css(m.group(2), css_only=True)
        total += k
        return m.group(1) + body + m.group(3)

    text = STYLE_BLOCK.sub(one, text)
    text = CSS_CONST.sub(one, text)
    return text, total

def main():
    total, touched = 0, []
    for d, subs, files in os.walk(ROOT):
        subs[:] = [s for s in subs if s not in SKIP_DIRS]
        for f in sorted(files):
            if not f.endswith(EXTS):
                continue
            p = os.path.join(d, f)
            s = io.open(p, encoding="utf-8", errors="ignore").read()
            if f.endswith(".css"):
                out, n = fix_css(s, css_only=True)
            elif f.endswith((".html", ".py")):
                # only the <style> blocks and the CSS constants are stylesheet territory
                out, n = fix_css(s)
                def _inside(m):
                    global _extra
                    body, k = fix_css(m.group(2), css_only=True)
                    _extra += k
                    return m.group(1) + body + m.group(3)
                out, k = _restyle(out)
                n += k
            else:
                out, n = fix_css(s)
            if n:
                io.open(p, "w", encoding="utf-8").write(out)
                total += n
                touched.append((os.path.relpath(p, ROOT), n))
    touched.sort(key=lambda x: -x[1])
    print("%d physical properties made logical across %d files" % (total, len(touched)))
    for p, n in touched[:12]:
        print("   %-34s %d" % (p, n))


if __name__ == "__main__":
    main()
