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

#  ---------------------------------------------------------------------------
#  --parchment is not a ground. It is a colour with two jobs.
#
#  The first cut turned the token over -- :root{--parchment:#0A1024} -- on the
#  reasoning that the parchment is the floor and the floor goes dark. Counted
#  across the house: 59 declarations use it as a ground and 126 use it as ink.
#  It is used as writing more than twice as often as it is used as paper, and
#  flipping it painted every one of those 126 dark-on-dark. That is what put
#  "FREE FOREVER · NO ADS · NO TRACKERS · NO ACCOUNT" on the gift page in near
#  black on near black: the chips say color:color-mix(in srgb,var(--parchment)
#  60%,transparent), which is exactly right on parchment and exactly wrong once
#  the token means navy.
#
#  So the token is left alone -- in the night --parchment is still the light --
#  and the ground uses are turned by the same rule everything else is turned
#  by: the property says so. background:var(--parchment) becomes the night's
#  ground; color:var(--parchment) was already the light and stays it. A token
#  with two jobs cannot be given one value; a declaration only ever has one.
#  ---------------------------------------------------------------------------
GROUND_NAMES = ("parch", "paper", "cream", "surface", "card", "sheet", "page")
GTOK = re.compile(r"var\(\s*(--[\w-]*(?:%s)[\w-]*)\s*(?:,[^()]*)?\)"
                  % "|".join(GROUND_NAMES), re.I)


def ground_token(name):
    """The night ground this parchment-family token becomes in a background."""
    n = name.lower()
    return "#0D1428" if ("cream" in n or "card" in n or "surface" in n) else "#0A1024"



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


def _hsl(rgb):
    r, g, b = [v / 255 for v in rgb]
    mx, mn = max(r, g, b), min(r, g, b)
    L = (mx + mn) / 2
    if mx == mn: return (0.0, 0.0, L)
    d = mx - mn
    S = d / (2 - mx - mn) if L > .5 else d / (mx + mn)
    if mx == r:   H = (g - b) / d + (6 if g < b else 0)
    elif mx == g: H = (b - r) / d + 2
    else:         H = (r - g) / d + 4
    return (H / 6, S, L)


def _rgb(hsl):
    h, s, l = hsl
    if s == 0:
        v = int(round(l * 255)); return (v, v, v)
    q = l * (1 + s) if l < .5 else l + s - l * s
    p_ = 2 * l - q
    def f(t):
        t = (t + 1) % 1
        if t < 1/6: return p_ + (q - p_) * 6 * t
        if t < 1/2: return q
        if t < 2/3: return p_ + (q - p_) * (2/3 - t) * 6
        return p_
    return tuple(int(round(v * 255)) for v in (f(h + 1/3), f(h), f(h - 1/3)))


#  The night's own hue and how saturated it is, read off the palette above so
#  the two can never drift apart.
NIGHT_H, NIGHT_S, _ = _hsl(NIGHT[-1][1])


def night_dark(rgb):
    """A dark ground, kept exactly as deep and as rich as it was, in the night's
    own hue instead of its old one.

    "A dark band stays a band" was right about value and silent about hue, and
    that is how the Prophets hero ended up a warm brown ramp -- #14100A to
    #2A2110, hue 36 to 39 degrees -- meeting the navy page at #0D1428, hue 224,
    on a hard horizontal edge. Two low-chroma colours from opposite temperature
    families butting together with no bridge do not read as rich. They read as
    dirty, and the gold glow laid over that hero had nothing cool to be warm
    against, so the one deliberate accent in the house stopped working too.

    It was not caught because chroma here is measured as (max-min)/255, which
    structurally under-reports tint on dark colours: a colour that dark cannot
    span much of 0-255 whatever its hue. All three hero stops scored 0.04-0.10
    against a 0.18 threshold while their own saturation was 0.27-0.45.

    So: keep the lightness, which is what carries the hierarchy; keep the
    saturation, which is what carries the richness; take the night's hue. A
    neutral dark has no saturation to keep and stays neutral, which is already
    harmonious. A dark that is already cool barely moves. Only the warm ones
    travel, and they travel to where the rest of the house lives.
    """
    h, s, l = _hsl(rgb)
    if s < 0.04:
        return None                    # a neutral has no hue to move; leave it be
    away = abs(h - NIGHT_H)
    away = min(away, 1 - away) * 360
    if away < 30:
        return None                    # already in the family; do not churn it
    return _rgb((NIGHT_H, min(NIGHT_S, s), l))


#  ---------------------------------------------------------------------------
#  A dark colour the house writes with.
#
#  lift() already rescues a literal dark colour that is passed to `color` -- the
#  sealing red on the Hajj rulings, the lapis on Theology -- because a dark red
#  on a dark ground is not dim, it is absent. It never rescued the same colour
#  held in a custom property, because a custom property has no property to ask.
#  So the journal's --jseal (#7B2D26) stayed exactly as it was and the notice at
#  the top of the journal -- "Read this before anything else" -- came out at
#  1.9:1 on its own card.
#
#  The name cannot answer this one: --jseal does not contain "ink". What answers
#  it is how the house actually uses the token. A dark colour that is only ever
#  passed to color/fill/stroke is writing, and writing must be lifted. A dark
#  colour that is also passed to a background is a band somewhere, and lifting
#  it would put a bright stripe in a dark room. So the tree is read once and the
#  tokens that are ever used as a ground are collected; everything else that is
#  dark and coloured gets lifted. Nothing is listed, so nothing goes stale.
#  ---------------------------------------------------------------------------
GROUND_TOKENS = set()
VAR_IN_BG = re.compile(r"background[\w-]*\s*:\s*[^;{}]*?var\(\s*(--[\w-]+)", re.I)


def read_ground_tokens():
    for dp, dn, fn in os.walk(ROOT):
        if any(os.sep + x in dp or dp.endswith(os.sep + x) for x in SKIP_DIRS):
            continue
        for f in fn:
            if not (f.endswith(".html") or f.endswith(".css")):
                continue
            try:
                src = open(os.path.join(dp, f), encoding="utf-8", errors="ignore").read()
            except OSError:
                continue
            for m in VAR_IN_BG.finditer(src):
                GROUND_TOKENS.add(m.group(1).lower())


def turned(rgb, prop):
    """The colour this one becomes in the night, or None to leave it alone."""
    flat, l = neutral(rgb)
    if not flat:
        p = prop.strip().lower()
        if p.startswith(("color", "fill", "stroke", "-webkit-text-fill")) and l < DARK:
            return lift(rgb)
        if p.startswith("--") and l < DARK and p not in GROUND_TOKENS:
            return lift(rgb)          # a dark colour the house only writes with
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
        if any(k in p for k in GROUND_NAMES) or "bg" in p:
            #  left as it is: its ground uses are turned where they are written
            return None
        return ground_for(l) if l >= LIGHT else None
    if p.startswith(GROUND) or "shadow" in p:
        if l >= LIGHT: return ground_for(l)
        return night_dark(rgb)         # a dark band stays a band, in the night's hue
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
    if prop.strip().lower().startswith(GROUND):
        val = GTOK.sub(lambda m: ground_token(m.group(1)), val)

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


#  ---------------------------------------------------------------------------
#  A room that was already written in the night.
#
#  The test for "convert this room" was "it loads noor-fx.js and is not the
#  shell", and that is a test for *reachable*, not for *parchment*. kids.html
#  passes it and is not a parchment room at all: it opens
#  body{background:var(--deep);color:var(--parchment)} -- a night sky with the
#  parchment used as the writing. Turning its tokens over turned the room
#  inside out. The white "Little Codex" went black, the seven star tiles grew
#  cream bands under white labels, and each star got a black rectangle where a
#  transparent ground had been. September 2026: this ate the Little Codex
#  whole, and it was the one room in the house that never needed converting.
#
#  So ask the room what colour its own floor is before touching it. Resolve the
#  var() against the room's own :root, take the luminance, and if the ground is
#  already dark then the room is already in the night: skip it entire.
#  ---------------------------------------------------------------------------
ROOT_RE = re.compile(r":root[^{]*\{([^}]*)\}")
BODY_RE = re.compile(r"(?m)^[^@{}/]*\bbody\b[^{}]*\{([^}]*)\}")


def _tokens(style):
    out = {}
    for m in ROOT_RE.finditer(style):
        for d in m.group(1).split(";"):
            if ":" not in d: continue
            k, v = d.split(":", 1)
            k = k.strip()
            if k.startswith("--"): out[k] = v.strip()
    return out


def _resolve(val, tok, depth=0):
    if depth > 4: return val
    m = re.search(r"var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)", val)
    if not m: return val
    sub = tok.get(m.group(1)) or (m.group(2) or "").strip()
    return _resolve(val[:m.start()] + sub + val[m.end():], tok, depth + 1)


def already_night(html):
    """True when the room paints itself a dark floor in its own <style>."""
    for style in re.findall(r"<style>([\s\S]*?)</style>", html):
        style = re.sub(r"/\*[\s\S]*?\*/", "", style)
        tok = _tokens(style)
        for m in BODY_RE.finditer(style):
            decl = m.group(1)
            for d in decl.split(";"):
                if ":" not in d: continue
                prop, val = d.split(":", 1)
                if prop.strip().lower() not in ("background", "background-color"):
                    continue
                v = _resolve(val, tok)
                hx = HEX_RE.search(v)
                rgb = bits(hx.group(0)) if hx else None
                if rgb is None:
                    mm = RGB_RE.search(v)
                    if mm: rgb = (int(mm.group(2)), int(mm.group(3)), int(mm.group(4)))
                if rgb is None: continue
                _, l = neutral(rgb)
                if l < LIGHT * 0.62:      # a floor this dark is already the night
                    return True
    return False


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
            if already_night(s):
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
          "assets/figfit.css", "assets/noor-rtl.css",
          "assets/anim.css", "assets/journal.css", "masjid/kit.css"]


#  ---------------------------------------------------------------------------
#  Paper has no night.
#
#  Two rooms in the house draw a sheet of paper on the screen: the masjid's
#  monthly timetable and the qibla card. Both are laid out in millimetres at
#  exactly the size they print, so that what the browser measures is what the
#  printer puts on the wall, and both say so in their own CSS --
#  print-color-adjust:exact, which means "these colours are ink, do not
#  re-render them."
#
#  The night turned them anyway, and turned them inconsistently, because the
#  rule that decides is chroma: the Friday row's #F0DFAE is saturated enough to
#  read as a colour and was left cream, while the alternating #ECE5D4 beside it
#  is not and went dark. One table, two grounds, one set of classes -- and the
#  legibility floor then "fixed" the ink for whichever ground it happened to
#  measure, which put the Friday row at 1.2:1. That is the one document in this
#  house that gets pinned up in front of a congregation.
#
#  A drawing of paper is not a room. It does not get a night.
#  ---------------------------------------------------------------------------
PAPER = {
    "masjid/timetable.html": re.compile(r"^\s*(?:#sheet|\.sh-|table\.tt|\.page)"),
    "masjid/qibla.html":     re.compile(r"^\s*#card"),
}


def paper(rel, sel):
    rx = PAPER.get(rel)
    return bool(rx) and any(rx.match(one) for one in sel.split(","))


def build():
    read_ground_tokens()
    seen = collections.OrderedDict()          # (at, selector, turned decl) -> who wanted it
    pages = 0
    for name in SHARED:
        p = os.path.join(ROOT, name)
        if not os.path.exists(p):
            continue
        css = re.sub(r"/\*[\s\S]*?\*/", "", open(p, encoding="utf-8", errors="ignore").read())
        for at, inner in at_blocks(css):
            if PRINT.match(at):
                continue
            for sel, decl in flat_rules(inner):
                if foundational(sel):
                    continue
                if not (HOUSE.search(decl) or GTOK.search(decl)):
                    continue
                t = inverted(decl) or only_changed(decl)
                if not t:
                    continue
                seen.setdefault((at, sel, t), set()).add(name)
    for rel, html in rooms():
        pages += 1
        for style in re.findall(r"<style>([\s\S]*?)</style>", html):
            # strip comments so a colour named in prose is never converted
            style = re.sub(r"/\*[\s\S]*?\*/", "", style)
            for at, inner in at_blocks(style):
                if PRINT.match(at):
                    continue
                for sel, decl in flat_rules(inner):
                    if foundational(sel) or paper(rel, sel):
                        continue
                    #  a rule already written for the night is somebody's answer,
                    #  not a question. Turning it again turns it back.
                    if "n2-night" in sel:
                        continue
                    if not (HOUSE.search(decl) or INVERTED.search(decl) or GTOK.search(decl)):
                        continue
                    t = inverted(decl) or only_changed(decl)
                    if not t:
                        continue
                    key = (at, sel, t)
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
            if p == "background":
                out += kin(decl)
        elif p.startswith(("color", "fill", "stroke")) and re.search(r"var\(\s*--parch", val, re.I):
            out.append("%s:#FFFEF7" % p)
    return ";".join(out) or None


#  ---------------------------------------------------------------------------
#  The background shorthand resets the rest of the background.
#
#  begin.html paints its heading with a gradient through the letterforms:
#     .shimmer-sage{background:linear-gradient(...);background-size:200% 100%;
#                   -webkit-background-clip:text;background-clip:text;
#                   color:transparent;animation:shimb 7s linear infinite}
#  Turning the two sage stops over and re-emitting `background:` alone is a
#  shorthand, and a shorthand resets every longhand it covers -- so
#  background-clip went back to border-box, the gradient stopped being poured
#  through the letters and painted the whole box instead, and the title of the
#  page became a coloured bar with no writing in it. September 2026.
#
#  A rule that says background and also says how that background is clipped,
#  sized, repeated or placed carries those along when it is restated. The
#  colour is the only thing this script is allowed to change; everything the
#  shorthand would silently take with it is put back.
#  ---------------------------------------------------------------------------
BG_KIN = ("-webkit-background-clip", "background-clip", "background-size",
          "background-repeat", "background-position", "background-origin",
          "background-attachment", "background-blend-mode")


def kin(decl):
    """The background longhands this rule also sets, verbatim."""
    out = []
    for d in split_decls(decl):
        if ":" not in d:
            continue
        prop, val = d.split(":", 1)
        if prop.strip().lower() in BG_KIN:
            out.append("%s:%s" % (prop.strip(), val.strip()))
    return out


#  ---------------------------------------------------------------------------
#  Ink that sits on a ground the night is not moving must not move either.
#
#  The Prophets page ends with a gold button: background:#C9A227;color:#241D12.
#  Gold is a colour with an opinion and is never turned -- it was chosen to sit
#  on both grounds, and that is the whole reason the house holds together. The
#  dark ink on it is a neutral, so it *was* turned, and the button came out as
#  parchment on gold: 2.4:1, the last unreadable thing left on the site.
#
#  The pair was chosen together. If a rule paints its own ground and that ground
#  is staying exactly where it is, then the writing on it is already correct,
#  whatever the page behind them is doing.
#  ---------------------------------------------------------------------------
def keeps_its_ground(decl):
    #  Only an opaque ground counts. `background:transparent`, `background:none`
    #  and a 5%-alpha wash are not grounds: the ink on them is sitting on the
    #  page, and the page is exactly what is moving.
    for d in split_decls(decl):
        if ":" not in d:
            continue
        prop, val = d.split(":", 1)
        p = prop.strip().lower()
        if not p.startswith(GROUND):
            continue
        if GTOK.search(val):
            return False                       # a parchment token: it moves
        opaque, moved = False, False
        for m in HEX_RE.finditer(val):
            rgb = bits(m.group(0))
            if not rgb:
                continue
            h = m.group(0).lstrip("#")
            if len(h) == 8 and int(h[6:8], 16) < 153:
                continue                       # a hex with alpha, and it is a wash
            if len(h) == 4 and int(h[3] * 2, 16) < 153:
                continue
            opaque = True
            if turned(rgb, p) is not None:
                moved = True
        for m in RGB_RE.finditer(val):
            a = m.group(5)
            if a and not a.startswith("var(") and float(a.rstrip("%")) / (100.0 if a.endswith("%") else 1.0) < 0.6:
                continue
            opaque = True
            rgb = (int(m.group(2)), int(m.group(3)), int(m.group(4)))
            if turned(rgb, p) is not None:
                moved = True
        return opaque and not moved
    return False


#  A background clipped to the text is not a ground: it is the writing.
#
#  .shimmer pours a gradient through its letterforms -- gold, a bright flash of
#  parchment at the halfway stop, gold again. Read as a ground, that flash is a
#  cream panel and the night turns it navy, which puts a dark hole through the
#  middle of a gold heading. The property says "background" and the clip says
#  "these are letters", and the clip is the one telling the truth.
CLIP_TEXT = re.compile(r"(?:-webkit-)?background-clip\s*:\s*text", re.I)


def only_changed(decl):
    """Just the declarations whose colour moved.

       A rule is not copied wholesale: `.card{background:#FFFEF7;padding:1rem;
       border-radius:12px}` becomes `background:#0A1024` and nothing else. The
       room keeps its own shape, spacing and type; only the light changes. It
       also keeps the file small enough to send to a phone -- carrying every
       property of every rule came to 141 KB, of which the colours were a
       fifth."""
    out = []
    writing = bool(CLIP_TEXT.search(decl))
    fixed = keeps_its_ground(decl)
    for d in split_decls(decl):
        if ":" not in d:
            continue
        prop, val = d.split(":", 1)
        if not (HOUSE.search(val) or GTOK.search(val)):
            continue
        asked = prop
        if writing and prop.strip().lower().startswith(GROUND):
            asked = "color"          # clipped to the text: turn it as ink
        elif fixed and prop.strip().lower().startswith(INK):
            continue                 # its ground is not moving; nor is it
        t = turn(val, asked)
        if t.strip() == val.strip():
            continue
        out.append("%s:%s" % (prop.strip(), t.strip()))
    if out and any(o.split(":", 1)[0].strip().lower() == "background" for o in out):
        out += kin(decl)
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


#  @media print is paper, and paper has no night. The house's print blocks say
#  things like body.kit{background:#fff;color:#000} -- the deliberate act of
#  taking a night page back to ink on a page -- and turning those over emitted
#  colour:#FFFEF7 inside @media print, which is white ink on white paper. An
#  imam printing Friday's sermon would have got a blank sheet.
PRINT = re.compile(r"^@media\b[^{]*\bprint\b", re.I)


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


#  A keyframe's steps are offsets, not selectors. `0%`, `50%`, `from`, `to`:
#  flat_rules() hands them over like any other rule and the first cut scoped
#  them, which put `html.n2-night 100%{background:#0A1024}` in the sheet -- a
#  selector that matches nothing and parses as garbage. They are dropped here.
STEP = re.compile(r"^(?:\d+(?:\.\d+)?%|from|to)$", re.I)


def scope(sel, room=False):
    """Every selector is answered only where the night has been asked for.

       `room` marks a rule that was read out of one page's own <style> rather
       than a stylesheet the whole house links. Those rules carry class names
       that belong to a single room, and a class name is not a namespace: the
       Little Codex has a <span class="moon"> holding the word "Codex" and the
       moon-phase dial in another room has a .moon that is a conic gradient, so
       the dial's night rule painted a gold wedge across the child's wordmark.
       Worse, a room's :root{--parchment} turned over became a house-wide token
       flip, and the Little Codex writes its white text as color:var(--parchment)
       -- so the whole header went black on black. September 2026.

       A rule read from one room may only answer in a room of that kind, and
       noor-fx.js decides which those are by measuring: it reads the page's own
       ground before it asks for the night, and adds .n2-room only where that
       ground was light. A room that was already dark is never repainted, and
       the list of them is never written down anywhere to fall out of date."""
    at = "html.n2-night.n2-room" if room else "html.n2-night"
    parts = []
    for one in sel.split(","):
        one = one.strip()
        if not one or one.startswith("@") or STEP.match(one):
            continue
        if one in (":root", "html"):
            parts.append(at)
        elif one.startswith("html"):
            parts.append(at + one[4:])
        elif one.startswith("body"):
            parts.append(at + " body" + one[4:])
        else:
            parts.append(at + " " + one)
    return ",".join(parts)


#  ---------------------------------------------------------------------------
#  A rule with no class in it belongs to one room and to no other.
#
#  .n2-room keeps a room's rules off the pages that were never parchment. It
#  does not keep them off each other, and it cannot: `main p{color:#2C2416}` in
#  the twenty language front doors turns into light writing, and then answers
#  on /begin, where the Seeker's card is still a cream panel -- white on cream,
#  which is nothing at all. A class name is at least a weak namespace. A bare
#  element name is not even that.
#
#  These are rare (fourteen rules in seventy-one rooms), so they are simply
#  addressed to the rooms that asked for them. noor-fx.js stamps the room's own
#  path on <html> and the selector names it.
#  ---------------------------------------------------------------------------
def room_slug(rel):
    p = rel[:-5] if rel.endswith(".html") else rel
    if p.endswith("/index"):
        p = p[:-6]
    if p == "index":
        p = ""
    return p or "home"


NAMED = re.compile(r"[.#\[]")


def addressed(sel, rooms):
    """The same selector, said once per room that wanted it."""
    out = []
    for r in sorted(rooms):
        at = 'html.n2-night.n2-room[data-room="%s"]' % room_slug(r)
        for one in sel.split(","):
            one = one.strip()
            if not one or one.startswith("@") or STEP.match(one):
                continue
            if one in (":root", "html"):
                out.append(at)
            elif one.startswith("html"):
                out.append(at + one[4:])
            elif one.startswith("body"):
                out.append(at + " body" + one[4:])
            else:
                out.append(at + " " + one)
    return ",".join(out)


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
    shared = set(SHARED)
    for (at, sel, decl), who in seen.items():
        #  a rule the whole house links answers everywhere; a rule read out of
        #  one page's own <style> answers only in a room that was parchment.
        #
        #  A token flip is always room-scoped, whichever it came from. It is the
        #  most far-reaching shape a rule has -- :root{--parchment:#0A1024}
        #  repaints every element in the document that ever named that token,
        #  including ones in rooms that never linked the sheet it came from. The
        #  Little Codex writes its white wordmark as color:var(--parchment) and
        #  does not link hub.css, and hub.css's flip blacked it out anyway.
        tokens = any(d.strip().startswith("--") for d in split_decls(decl))
        own = who.isdisjoint(shared)
        if own and not NAMED.search(sel):
            s2 = addressed(sel, who)
        else:
            s2 = scope(sel, room=tokens or own)
        if not s2:
            continue
        by_at.setdefault(at, []).append((s2, decl, who))
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
