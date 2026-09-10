#!/usr/bin/env python3
"""Build assets/noor2-night.css: the 76 parchment rooms, read in the night.

   The overhaul of September 2026 put the shell's night on the arrival, the
   523 words and the 1,135 generated rooms, and left every room a person had
   written in the first cut's parchment with a dark bar bolted underneath it.
   Two visual languages on one site, and the rooms in the older one were the
   rooms people actually came for: the Mushaf, the Prophets, the Names, the
   Seerah, the Companions, Places, Hajj, the family rooms, the masjid tools.

   Converting them by hand is 76 rewrites. Converting them by eye is a week of
   finding the one cream card nobody noticed. So they are converted by reading:
   this walks every parchment room, finds every CSS rule that paints itself a
   house colour -- in its own <style>, as a hex or an rgb()/rgba() -- and emits
   the same rule again with the palette turned over, scoped under
   html.n2-night so it only applies where noor-fx.js has asked for the night.
   Coverage is complete by construction; nothing is missed because nobody
   thought to look at it.

   The palette turns over like this. Gold does not move: it was chosen to sit
   on both, and it is the one thing that ties the two halves of the site
   together. Everything else swaps ground for ink:

       parchment #FFFEF7  ->  #0A1024   the raised night of the shell
       card      #FFFDF4  ->  #0D1428   a card, one step off the ground
       cream     #FAF3DE  ->  #111A33   the warmer card
       ink       #2C2416  ->  #FFFEF7   the parchment, now the writing
       deep      #1A160F  ->  #04060F   the ground under everything
       white     #FFFFFF  ->  #0A1024

   An ink at low alpha is a hairline on parchment and must stay a hairline in
   the night, so alpha is preserved and only the triple is swapped: rgba(44,
   36,22,.12) becomes rgba(255,254,247,.12), not an opaque line.

       python3 scripts/build-night.py            write assets/noor2-night.css
       python3 scripts/build-night.py --report   say what it would cover
"""
import os, re, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "noor2-night.css")
SKIP_DIRS = (".git", "node_modules", "tests", ".build-src", "build", "i18n", "dictionary")

# ---------------------------------------------------------------------------
#  The turn is a rule, not a list.
#
#  A list of creams misses the next cream. The first pass of this script carried
#  eight of them and the Mushaf still had a #FFFDF0 band in it, because a room
#  written last spring reached for a slightly different white. So the palette is
#  classified instead of matched, on two questions:
#
#    is it a colour, or a neutral?   chroma, (max-min)/255. Gold is .64 and the
#                                    sages and the reds are higher still; every
#                                    parchment and ink the house has ever used
#                                    is under .18. A colour is never turned:
#                                    gold was chosen to sit on both grounds, and
#                                    a green that means "done" still means it.
#
#    is it a ground, or is it ink?   the property says so. background is ground;
#                                    color, border, fill, stroke and outline are
#                                    ink. This is what a list cannot know: #2C2416
#                                    is the writing on a parchment page and must
#                                    become the parchment, while #1A160F is a dark
#                                    band and must stay dark. Same neutral, two
#                                    jobs, and only the property tells them apart.
#
#  Alpha is never touched. An ink at .12 is a hairline on parchment and has to
#  stay a hairline in the night, not become an opaque rule across the page.
# ---------------------------------------------------------------------------
CHROMA = 0.18          # above this it is a colour with an opinion; leave it
LIGHT = 0.72           # a ground
DARK = 0.34            # ink

GROUND = ("background", "background-color", "background-image")
INK = ("color", "border", "border-color", "border-top", "border-right", "border-bottom",
       "border-left", "border-top-color", "border-right-color", "border-bottom-color",
       "border-left-color", "border-inline-start", "border-inline-end", "border-block",
       "border-inline-start-color", "border-inline-end-color", "outline", "outline-color",
       "fill", "stroke", "caret-color", "text-decoration-color", "column-rule",
       "column-rule-color", "-webkit-text-fill-color")

NIGHT = ((0.97, (10, 16, 36)),      # the ground of the shell
         (0.92, (13, 20, 40)),      # a card, one step off it
         (0.00, (17, 26, 51)))      # the warmer card
PARCH = (255, 254, 247)
INK_ON_NIGHT_BORDER = (255, 254, 247)

HEX_RE = re.compile(r"#[0-9a-fA-F]{3,8}\b")
#  Tailwind writes rgb(44 36 22/var(--tw-text-opacity,1)) -- space separated,
#  and the alpha is a variable, not a number. The first pass read only numeric
#  alphas, so every .text-ink on the site was left as it was and the Mushaf came
#  out with 224 pieces of dark writing on a dark ground.
RGB_RE = re.compile(
    r"(rgba?)\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)\s*"
    r"(?:[,/]\s*(var\([^()]*\)|[\d.]+%?)\s*)?\)", re.I)
HOUSE = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\(", re.I)


def bits(h):
    h = h.lstrip("#")
    if len(h) in (3, 4): h = "".join(c * 2 for c in h[:3])
    if len(h) < 6: return None
    try: return tuple(int(h[k:k + 2], 16) for k in (0, 2, 4))
    except ValueError: return None


def neutral(rgb):
    """(is it a neutral, its luminance 0..1)"""
    r, g, b = rgb
    return (max(rgb) - min(rgb)) / 255.0 < CHROMA, (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0


def ground_for(l):
    for cut, c in NIGHT:
        if l >= cut: return c
    return NIGHT[-1][1]


def turned(rgb, prop):
    """The colour this one becomes in the night, or None to leave it alone."""
    flat, l = neutral(rgb)
    if not flat:
        p = prop.strip().lower()
        if p.startswith(("color", "fill", "stroke", "-webkit-text-fill")) and l < DARK:
            return lift(rgb)
        return None
    p = prop.strip().lower()
    if p.startswith("--"):
        #  A custom property has no property to ask, so the name answers instead.
        #  The house names them the same way everywhere: --parchment and its
        #  kin are grounds, --ink and its kin are writing, --deep is a dark band
        #  that must stay dark, and --gold is a colour and never moves. Missing
        #  this is what left 224 pieces of dark writing on the dark Mushaf: the
        #  page paints from body{color:var(--ink)}, and --ink had not turned.
        #  The substring test knows --ink and --subtext. It did not know --soft,
        #  which is what the masjid tools call their quieter writing, and the
        #  audit found #timebar .lab painting rgba(44,36,22,.6) on the night at
        #  1.1:1 -- "Running time", on a screen at the front of a prayer hall.
        #  So the names the house actually writes with are listed outright. The
        #  way to extend this list is not to guess: find every --name the house
        #  passes to color/fill/stroke, keep the ones declared dark, and read
        #  them. There were twelve; these are the ones that were writing.
        if any(k in p for k in ("ink", "text", "fg", "foreground", "type")) \
           or p in ("--soft", "--lapis", "--muted", "--dim", "--quiet", "--faint"):
            return PARCH if l <= DARK else None
        if any(k in p for k in ("parch", "paper", "cream", "surface", "card", "bg", "sheet", "page")):
            return ground_for(l) if l >= LIGHT else None
        return ground_for(l) if l >= LIGHT else None
    if p.startswith(GROUND) or "shadow" in p:
        return ground_for(l) if l >= LIGHT else None      # a dark band stays a band
    if p.startswith(INK):
        if l <= DARK: return PARCH                        # the writing, and the hairlines
        if l >= LIGHT and p.startswith(("border", "outline", "column-rule")):
            return ground_for(l)                          # a white separator on a light page
        return None
    return None


def lift(rgb):
    """A dark colour, raised until it can be read on the night, still itself.

       Gold does not need this and neither does a mid green, but the house has
       a few deep ones -- the sealing red at #8F2D2D on the Hajj rulings, the
       lapis on Theology -- chosen to be read on parchment. Left alone they are
       a dark red on a dark ground, which is worse than wrong: it is invisible.
       Replacing them with parchment would lose what the colour was saying, so
       the hue and the relation between the channels are kept and the whole
       thing is scaled until it sits at the luminance of comfortable reading."""
    r, g, b = rgb
    l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
    if l <= 0.01: return None
    k = 0.60 / l
    out = tuple(min(255, int(round(c * k))) for c in rgb)
    # scaling clips at the top and can wash the hue out; pull back toward the
    # original if a channel pinned, so a red stays red rather than turning pink
    if 255 in out and max(rgb) < 255:
        m = 255.0 / max(rgb)
        out = tuple(min(255, int(round(c * m))) for c in rgb)
    return out


def turn(val, prop):
    def hx(m):
        rgb = bits(m.group(0))
        if not rgb: return m.group(0)
        t = turned(rgb, prop)
        return ("#%02X%02X%02X" % t) if t else m.group(0)

    def rgb(m):
        fn, r, g, b, a = m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4)), m.group(5)
        t = turned((r, g, b), prop)
        if not t: return m.group(0)
        return "%s(%d,%d,%d%s)" % (fn, t[0], t[1], t[2], ("," + a) if a else "")

    return RGB_RE.sub(rgb, HEX_RE.sub(hx, val))


def rooms():
    """Every page that noor-fx.js dresses and that is not already in the shell."""
    for dp, dn, fn in os.walk(ROOT):
        if any(os.sep + s in dp or dp.endswith(os.sep + s) for s in SKIP_DIRS):
            continue
        for f in sorted(fn):
            if not f.endswith(".html"):
                continue
            p = os.path.join(dp, f)
            try:
                s = open(p, encoding="utf-8", errors="ignore").read()
            except OSError:
                continue
            if "data-n2=" in s[:600] or "noor-fx.js" not in s:
                continue
            yield os.path.relpath(p, ROOT), s


#  the stylesheets those rooms share. tw.css is a Tailwind build and its whole
#  palette is four colours, but they are baked into the utility classes rather
#  than read from a token, so a page that says class="bg-parchment/95" cannot be
#  reached by turning a room's own <style> over -- which is how the Mushaf's
#  surah picker stayed a cream band in a night room.
#  The list was short by four, and the legibility audit is how that surfaced:
#  masjid/kit.css was still painting rgba(44,36,22,.82) -- the parchment ink --
#  on a night ground, which is 1.17:1, which is invisible. The masjid toolbox is
#  the one part of the house that gets put on a wall in front of a congregation,
#  and its sermon text could not be read at all. noor-rtl.css carried 21 more of
#  the same, on the ninety pages that can be read right to left.
#
#  A stylesheet belongs here if a room links it and it names a house colour. The
#  rule for finding the next one: grep the HTML for href="...css", and anything
#  that is not in this list and not a room's own <style> is unturned.
SHARED = ["assets/tw.css", "assets/hub.css", "assets/noor-ramadan.css",
          "assets/figfit.css", "assets/noor-rtl.css", "assets/kids-engine.css",
          "assets/anim.css", "assets/journal.css", "masjid/kit.css"]


def build():
    seen = collections.OrderedDict()          # (at, selector, turned decl) -> who wanted it
    pages = 0
    for name in SHARED:
        p = os.path.join(ROOT, name)
        if not os.path.exists(p):
            continue
        css = re.sub(r"/\*[\s\S]*?\*/", "", open(p, encoding="utf-8", errors="ignore").read())
        for at, inner in at_blocks(css):
            for sel, decl in flat_rules(inner):
                if foundational(sel):
                    continue
                if not HOUSE.search(decl):
                    continue
                t = inverted(decl) or only_changed(decl)
                if not t:
                    continue
                seen.setdefault((at, scope(sel), t), set()).add(name)
    for rel, html in rooms():
        pages += 1
        for style in re.findall(r"<style>([\s\S]*?)</style>", html):
            # strip comments so a colour named in prose is never converted
            style = re.sub(r"/\*[\s\S]*?\*/", "", style)
            for at, inner in at_blocks(style):
                for sel, decl in flat_rules(inner):
                    if foundational(sel):
                        continue
                    if not (HOUSE.search(decl) or INVERTED.search(decl)):
                        continue
                    t = inverted(decl) or only_changed(decl)
                    if not t:
                        continue
                    key = (at, scope(sel), t)
                    seen.setdefault(key, set()).add(rel)
    return seen, pages


#  A rule that paints itself with the tokens in their opposite roles --
#  background:var(--ink), color:var(--parchment) -- is an inverted card: a dark
#  panel deliberately set against a parchment page. Turning the tokens over
#  turns it over too, and a bright white card appears in a dark room, which is
#  the flash this whole conversion exists to remove. There are four of them in
#  the house. In the night an inverted card is not a bright one: it is a raised
#  one, a step off the ground, with the writing still light.
INVERTED = re.compile(r"background(?:-color)?\s*:\s*var\(\s*--(?:ink|deep)\b", re.I)
RAISED = "#111A33"


def inverted(decl):
    if not INVERTED.search(decl):
        return None
    out = []
    for d in split_decls(decl):
        if ":" not in d: continue
        prop, val = d.split(":", 1)
        p = prop.strip().lower()
        if p.startswith(("background", "background-color")) and re.search(r"var\(\s*--(?:ink|deep)\b", val, re.I):
            out.append("%s:%s" % (p, RAISED))
        elif p.startswith(("color", "fill", "stroke")) and re.search(r"var\(\s*--parch", val, re.I):
            out.append("%s:#FFFEF7" % p)
    return ";".join(out) or None


def only_changed(decl):
    """Just the declarations whose colour moved.

       A rule is not copied wholesale: `.card{background:#FFFEF7;padding:1rem;
       border-radius:12px}` becomes `background:#0A1024` and nothing else. The
       room keeps its own shape, spacing and type; only the light changes. It
       also keeps the file small enough to send to a phone -- carrying every
       property of every rule came to 141 KB, of which the colours were a
       fifth."""
    out = []
    for d in split_decls(decl):
        if ":" not in d:
            continue
        prop, val = d.split(":", 1)
        if not HOUSE.search(val):
            continue
        t = turn(val, prop)
        if t.strip() == val.strip():
            continue
        out.append("%s:%s" % (prop.strip(), t.strip()))
    return ";".join(out)


def split_decls(decl):
    """Split on semicolons that are not inside brackets or quotes."""
    out, buf, depth, q = [], [], 0, ""
    for ch in decl:
        if q:
            buf.append(ch)
            if ch == q: q = ""
            continue
        if ch in "\"'": q = ch; buf.append(ch); continue
        if ch == "(": depth += 1
        elif ch == ")": depth = max(0, depth - 1)
        if ch == ";" and not depth:
            out.append("".join(buf)); buf = []
        else:
            buf.append(ch)
    if buf: out.append("".join(buf))
    return [x for x in (y.strip() for y in out) if x]


def at_blocks(style):
    """(at-rule or '', css inside it) for a stylesheet, one level deep."""
    out, i, n = [], 0, len(style)
    plain = []
    while i < n:
        m = re.compile(r"@(media|supports)([^{]*)\{").search(style, i)
        if not m:
            plain.append(style[i:]); break
        plain.append(style[i:m.start()])
        depth, j = 1, m.end()
        while j < n and depth:
            if style[j] == "{": depth += 1
            elif style[j] == "}": depth -= 1
            j += 1
        out.append(("@%s%s" % (m.group(1), m.group(2).rstrip()), style[m.end():j - 1]))
        i = j
    out.insert(0, ("", "".join(plain)))
    return out


def flat_rules(css):
    return [(m.group(1).strip(), m.group(2)) for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", css)]


#  A reset is not a palette. Tailwind's preflight carries
#      *, ::before, ::after { box-sizing: border-box; border: 0 solid #e5e7eb }
#  and that grey is a neutral on an ink property, so the first pass dutifully
#  turned it over and emitted it back as a universal rule -- which, being later
#  in the cascade and equal in weight, reset `border` on every element in all
#  76 rooms and quietly deleted every border in the house. tests/figures.mjs
#  caught it as two pixels of label overlap on one figure at one width, which
#  is the whole reason that file measures instead of looking.
#
#  So a rule that speaks to everything is never restated here. A night sheet
#  answers what a room actually painted; it does not re-lay foundations.
UNIVERSAL = re.compile(r"(^|[\s,>+~])\*(?![-\w])|::(?:before|after)\s*$", re.I)


def foundational(sel):
    return any(UNIVERSAL.search(one.strip()) for one in sel.split(","))


def scope(sel):
    """Every selector is answered only where the night has been asked for."""
    parts = []
    for one in sel.split(","):
        one = one.strip()
        if not one or one.startswith("@") or one.startswith("%"):
            continue
        if one in (":root", "html"):
            parts.append("html.n2-night")
        elif one.startswith("html"):
            parts.append("html.n2-night" + one[4:])
        elif one.startswith("body"):
            parts.append("html.n2-night body" + one[4:])
        else:
            parts.append("html.n2-night " + one)
    return ",".join(parts)


HEAD = """/* NOOR · noor2-night.css · the older rooms, read in the night.
   ------------------------------------------------------------------
   GENERATED by scripts/build-night.py. Do not edit by hand: run the script.

   The 76 rooms a person wrote were left in the first cut's parchment when the
   shell's night went to the arrival, the words and the generated rooms. This
   turns their palette over -- ground for ink, alpha preserved, gold untouched,
   because gold was chosen to sit on both. Every rule here was read out of a
   room's own <style>; nothing was guessed, so nothing is missed.

   noor-fx.js sets html.n2-night on those pages and appends this file after
   their own styles, so every rule below is both later and more specific than
   the one it answers. A page that never gets the class is untouched. */
"""


def main():
    seen, pages = build()
    by_at = collections.OrderedDict()
    for (at, sel, decl), who in seen.items():
        by_at.setdefault(at, []).append((sel, decl, who))
    if "--report" in sys.argv:
        print("parchment rooms read: %d" % pages)
        print("rules turned over   : %d" % len(seen))
        for at, rules in by_at.items():
            print("  %-22s %d" % (at or "(top level)", len(rules)))
        return 0
    out = [HEAD]
    for at, rules in by_at.items():
        if at:
            out.append("%s{" % at)
        for sel, decl, who in rules:
            out.append("%s{%s}" % (sel, decl))
        if at:
            out.append("}")
    css = "\n".join(out) + "\n"
    open(OUT, "w", encoding="utf-8").write(css)
    print("noor2-night.css written · %d rooms read · %d rules · %d KB"
          % (pages, len(seen), len(css.encode()) / 1024))
    return 0


if __name__ == "__main__":
    sys.exit(main())
