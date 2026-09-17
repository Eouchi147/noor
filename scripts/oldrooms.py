# NOOR · the diet of the 52 old rooms (audit batch 6: arch-004, arch-005, perf-003)
# ---------------------------------------------------------------------------
# One pass over the 51 pages the scout's map names (36 root, 6 masjid/, 9
# stories/; the map's own header count of 52 does not match its own list,
# which sums to 51 -- see /root/audit/handoff/oldrooms-map.md and the
# changes.txt line for this batch).
#
# Per page:
#   1. arch-004  the baked <header id="site-header">...</header> and the
#                <div id="nav-sheet">...</div> that follows it (together the
#                menu nav49.py bakes into every old room) are replaced with a
#                small hidden stub carrying only the ids a script anywhere in
#                the house still reaches for: #site-header (noor-fx.js's
#                convert() looks it up to hide it and hang its own bar off
#                it; noor-dials.js and noor-ramadan.js insert a banner next
#                to it), #search-toggle and #hm-search (noor-fx.js's click
#                listener checks for both defensively; neither id is a
#                script that throws on a miss, closest() does not need the
#                element to exist, but the stub costs nothing and the
#                marching orders ask for it by name).
#   2. perf-003  a night-palette inline style and the shell's four
#                stylesheets, as ordinary <link> tags, go in <head> right
#                after <meta charset>, so the first paint is already the
#                night the shell would otherwise repaint it to after
#                noor-fx.js runs. The refuter's review: html,body{color:...}
#                only ever reaches an element that carries no color rule of
#                its own, and nearly every heading and paragraph in these
#                rooms does (the room's own ink, #2C2416 or
#                rgba(44,36,22,alpha)), so with no script the inline rule
#                painted the background night and left the words a dark ink
#                on it, unreadable, and the header stub carried no way to
#                get anywhere. Every such rule in the page's own <style> is
#                now read back (_ink_overrides, walking the page's rules
#                itself rather than guessing its classes) and answered, same
#                selector, same alpha, ink swapped for the night's own
#                #FFFEF7, !important; and the stub's header carries a
#                <noscript> block, a five link menu (Home, Today, The
#                Lights, The Verses, Search) that a <noscript><style> turns
#                the hidden header back on for, since a browser only ever
#                renders a noscript's own children when it has no script to
#                run. With a script, noor-fx.js's own bar and its own
#                #site-header{display:none!important} still apply exactly as
#                before; noscript content is never parsed into a live
#                element when scripting is on, so nothing here is reachable
#                for it to fight.
#   3. arch-005  noor-search.js comes off every page (noor-fx.js already
#                loads it on demand: NOOR_NEED_SEARCH, wired to the bar's
#                More door and to the first keystroke). noor-ramadan.css,
#                noor-hijri.js and noor-ramadan.js come off every page except
#                ramadan.html and eid.html, whose own inline scripts read
#                window.NOOR_HIJRI and window.NOOR_RAMADAN directly and so
#                need the season loaded unconditionally; noor-fx.js gained a
#                small gate (see "the season, asked for only when it is
#                due") that loads those two files itself, only within the
#                countdown window or ?season=. Everything else in the nine
#                file kit -- noor-ink.js, sponsor.js, noor-anime.js,
#                noor-overrides.js, noor-text.js, noor-dials.js,
#                noor-rtl.css, figfit.css, figfit.js -- stays: noor-fx.js
#                does not load any of them on demand, each does something a
#                page needs at once (the hero's ink, the figures' fit, the
#                dials that hide a link the owner turned off), and moving
#                them behind a gate is exactly the twelve hour piece of this
#                finding the marching orders did not ask for.
#
# Idempotent: both the head insert and the header stub are recomputed fresh
# from the page's current content on every run and only written back if
# that recomputed text differs from what is already there, so a page this
# script has already brought current comes back byte for byte, and a page
# fixed under an older shape of this script is brought forward the same as
# one seeing it for the first time. Refuses anything not on PAGES, or a page
# on PAGES whose header does not match the shape every one of the 51 was
# checked against before this was written.
#
# Run:  python3 scripts/oldrooms.py            (all 51, prints a diff stat)
#       python3 scripts/oldrooms.py --check     (dry run, no write)
#       python3 scripts/oldrooms.py quran.html  (one page)
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PAGES = [
    "allah.html", "arabic.html", "begin.html", "characters.html", "companions.html",
    "donate.html", "eid.html", "family.html", "feedback.html", "good-life.html",
    "hajj-plan.html", "hajj.html", "health.html", "heroes.html", "journal-rules.html",
    "journal.html", "latif.html", "legal.html", "madrasa.html", "marriage.html",
    "muhammad.html", "pillars.html", "places.html", "prophets.html", "protection.html",
    "quran.html", "ramadan.html", "school.html", "sermon.html", "simulation.html",
    "soul.html", "teens.html", "theology.html", "three-lives.html", "unseen.html",
    "words.html",
    "masjid/index.html", "masjid/khutba.html", "masjid/qibla.html", "masjid/setup.html",
    "masjid/start.html", "masjid/timetable.html",
    "stories/adl.html", "stories/ghaffar.html", "stories/hadi.html", "stories/index.html",
    "stories/jabbar.html", "stories/razzaq.html", "stories/sabur.html",
    "stories/shakur.html", "stories/wadud.html",
]

V = "14"  # the shell's cache-buster; must match api/page.js's V and noor-fx.js's V
SHEETS = ["noor2.css", "noor2-skin.css", "noor2-night.css", "noor2-legible.css"]

MARKER = "<!--oldrooms-v1-->"
# !important, and on body as well as html: every old room's own <style>
# carries a plain body{background:var(--parchment);color:var(--ink)} rule,
# later in <head> than this one, of the same specificity -- without
# !important that rule wins the very first paint and the flash this exists
# to cut stays. noor2-night.css's own rule for the same property, once
# noor-fx.js adds html.n2-night, is html.n2-night body{background:#0A1024}
# -- the identical colour, just reached by a class instead of an
# exclamation mark -- so this never fights the shell once it lands; it only
# ever stands in for it.
BASE_STYLE = "html,body{background:#0A1024!important;color:#FFFEF7!important}#site-header{display:none}"
SHEET_LINKS = "".join('<link rel="stylesheet" href="/assets/%s?v=%s"/>' % (s, V) for s in SHEETS)
# the head insert is recomputed and replaced whole on every run, marker and
# all, rather than left alone once seen: the ink overrides below are read
# out of the page fresh each time, so a page fixed under an older shape of
# this script is brought forward the same as one seeing it for the first
# time, and a page already current comes back byte for byte, unchanged.
HEAD_INSERT_RE = re.compile(re.escape(MARKER) + r"<style>.*?</style>(?:<link[^>]*/>)*", re.S)

# the refuter's review (D1): html,body{color:...} only ever reaches an
# element with no color rule of its own, and a room's own <style> gives
# nearly every heading, paragraph and card its own -- some of them (.card,
# .before, .wgo-c, .snav a) a light background too, not just dark text on
# nothing. noor2-night.css's own generator already worked all of this out,
# room by room, gated behind html.n2-night.n2-room[data-room="<room>"]; the
# room's own values are read back out of it rather than guessed a second
# time, stripped of the class gate that would otherwise need a script to
# ever apply, and set !important so no rule of the room's own (never itself
# !important) outweighs them.
_NIGHT_GATE_RE = re.compile(r'^html\.n2-night\.n2-room\[data-room="[^"]*"\]\s+')
_NIGHT_PROP_RE = re.compile(r"(background(?:-color)?|color)\s*:\s*([^;]+?)\s*(?:;|$)")
# the two pages with the sixth header shape (allah.html, muhammad.html)
# carry no data-room of their own in noor2-night.css -- the generator never
# saw them, being built off the ordinary head-of-page kit these two do not
# carry either. Answered instead straight off their own <style>, the same
# discipline in miniature: an ink color rule to the night's own #FFFEF7,
# alpha kept, and a plain white card background (the one shape this pair
# happens to carry, the "Where to go from here" widget every room shares)
# to the night's own #0A1024.
_INK_RE = re.compile(r"(?<![\w-])color\s*:\s*(#2[Cc]2416|rgba?\(\s*44\s*,\s*36\s*,\s*22\s*(?:,\s*([\d.]+)\s*)?\))\s*(?:!important)?\s*(?:;|$)")
_WHITE_BG_RE = re.compile(r"(?<![\w-])background\s*:\s*(#fff|#ffffff)\s*(?:!important)?\s*(?:;|$)", re.I)


def _iter_rules(css):
    """Yields (selector, declarations) for every plain rule in a <style>
    block's text (a room's own, or noor2-night.css's), including a rule
    nested one level inside an @media block (nothing here nests deeper).
    @font-face, @keyframes and the like are walked the same way and simply
    never match a property this file looks for."""
    i, n = 0, len(css)
    while i < n:
        brace = css.find("{", i)
        if brace == -1:
            break
        head = css[i:brace].strip()
        depth, j = 1, brace + 1
        while j < n and depth:
            if css[j] == "{":
                depth += 1
            elif css[j] == "}":
                depth -= 1
            j += 1
        body = css[brace + 1:j - 1]
        if head.startswith("@media"):
            for r in _iter_rules(body):
                yield r
        elif head and not head.startswith("@"):
            yield head, body
        i = j


def _data_room_for(rel):
    key = rel[:-len(".html")] if rel.endswith(".html") else rel
    if key.endswith("/index"):
        key = key[:-len("/index")]
    return key


_NIGHT_RULES = None  # lazily parsed once; assets/noor2-night.css does not change mid-run


def _night_rules():
    global _NIGHT_RULES
    if _NIGHT_RULES is None:
        css = _read(os.path.join(ROOT, "assets", "noor2-night.css"))
        _NIGHT_RULES = list(_iter_rules(css))
    return _NIGHT_RULES


def _room_overrides(rel, html_src):
    room = _data_room_for(rel)
    gate = 'html.n2-night.n2-room[data-room="%s"] ' % room
    merged, order = {}, []
    for sel_list, decls in _night_rules():
        props = _NIGHT_PROP_RE.findall(decls)
        if not props:
            continue
        for member in sel_list.split(","):
            member = member.strip()
            if not member.startswith(gate):
                continue
            rest = member[len(gate):].strip()
            if not rest:
                continue
            if rest not in merged:
                merged[rest] = {}
                order.append(rest)
            for p, v in props:
                merged[rest][p] = v.strip()  # last one in source order wins, same as the cascade would
    if order:
        return ["%s{%s}" % (r, ";".join("%s:%s!important" % (p, v) for p, v in merged[r].items())) for r in order]

    # the fallback, for the two pages noor2-night.css never saw
    overrides, seen = [], set()
    for block in re.findall(r"<style>(.*?)</style>", html_src, re.S):
        for sel, decls in _iter_rules(block):
            sel = sel.strip()
            m = _INK_RE.search(decls)
            if m and (sel, "color") not in seen:
                seen.add((sel, "color"))
                val = "#FFFEF7" if m.group(1)[0] == "#" else ("rgba(255,254,247,%s)" % m.group(2) if m.group(2) else "#FFFEF7")
                overrides.append("%s{color:%s!important}" % (sel, val))
            if _WHITE_BG_RE.search(decls) and (sel, "background") not in seen:
                seen.add((sel, "background"))
                overrides.append("%s{background:#0A1024!important}" % sel)
    return overrides


def head_insert(rel, html_src):
    style = "<style>" + BASE_STYLE + "".join(_room_overrides(rel, html_src)) + "</style>"
    return MARKER + style + SHEET_LINKS


# the noscript menu: a browser only ever builds a <noscript>'s children into
# real elements when it has no script to run, so this is inert weight (an
# inert text node) the moment scripting is on, and the <style> inside it
# never enters the cascade then either. #site-header{display:block!important}
# answers both the CSS above and noor-fx.js's own JS-set
# #site-header{display:none!important}: without a script neither of those
# ever reaches the page, and importance beats the plain "hidden" attribute's
# own UA default either way. #site-header a{color:...!important} answers the
# browser's own link colour, which a bare <a> carries regardless of what its
# ancestors say (inheritance is only ever a fallback for a property nothing
# else set on the element itself).
NOSCRIPT_NAV = (
    '<noscript><style>#site-header{display:block!important}#site-header a{color:#FFFEF7!important}</style>'
    '<nav aria-label="Menu" style="display:flex;flex-wrap:wrap;gap:1rem;justify-content:center;padding:.9rem 1rem">'
    '<a href="/">Home</a><a href="/today">Today</a><a href="/light">The Lights</a>'
    '<a href="/verses">The Verses</a><a href="/#search">Search</a>'
    '</nav></noscript>'
)

STUB = ('<header id="site-header" hidden>'
        '<a id="search-toggle" href="/#search" hidden></a>'
        '<span id="hm-search" hidden></span>'
        + NOSCRIPT_NAV +
        '</header>')

HEADER_RE = re.compile(r'<header id="site-header"[\s\S]*?</header>')
CHARSET_RE = re.compile(r'<meta charset=["\'][^"\']*["\']\s*/?>', re.IGNORECASE)
# allah.html and muhammad.html (a sixth header variant) bake their
# <script src=".../noor-fx.js" defer></script> INSIDE the header block
# itself, rather than in <head> before it like every other old room. A
# blind stub would delete the page's only copy of the shell loader. Any
# such tag found inside the matched header is hoisted in front of the stub.
EMBEDDED_ASSET_RE = re.compile(r'<script[^>]*\bsrc="[^"]*"[^>]*></script>|<link[^>]*\brel="stylesheet"[^>]*\bhref="[^"]*"[^>]*/?>')

# label -> compiled regex; matched with optional leading whitespace/newline
# so removal leaves no blank line behind.
KIT_ALWAYS = [
    ("noor-search.js", re.compile(r'[ \t]*\r?\n?<script src="[^"]*noor-search\.js[^"]*"\s+defer></script>')),
]
KIT_SEASON = [
    ("noor-ramadan.css", re.compile(r'[ \t]*\r?\n?<link rel="stylesheet" href="[^"]*noor-ramadan\.css[^"]*"\s*/>')),
    ("noor-hijri.js", re.compile(r'[ \t]*\r?\n?<script src="[^"]*noor-hijri\.js[^"]*"\s+defer></script>')),
    ("noor-ramadan.js", re.compile(r'[ \t]*\r?\n?<script src="[^"]*noor-ramadan\.js[^"]*"\s+defer></script>')),
]
# these two pages carry window.NOOR_HIJRI / window.NOOR_RAMADAN reads in
# their own inline script (their permanent calendar content, not the
# seasonal banner), so the season files stay tags on the page rather than
# waiting on noor-fx.js's gate.
KEEP_SEASON_PAGES = {"ramadan.html", "eid.html"}

KIT_KEPT_EXPLAIN = [
    ("noor-ink.js", "the hero's living ink texture (data-ink=soft); paints once at load, noor-fx.js has no equivalent"),
    ("sponsor.js", "the free-forever line every page carries; small and unconditional, not seasonal"),
    ("noor-anime.js", "the .mo/.mo-pop/.mo-draw reveal language the room's own markup calls for"),
    ("noor-overrides.js", "the correction layer; reads /api/overrides once a session, walks text nodes at load"),
    ("noor-text.js", "the deep translation layer; must run before a non-English reader sees English prose"),
    ("noor-dials.js", "the owner's feature dials (journal.on, the notice banner); reads /api/settings at once"),
    ("noor-rtl.css", "the direction corrections for computed layouts (the print cards, the radial menu)"),
    ("figfit.css", "the over-wide figure's scroll box; figfit.js measures the room's own figures at load"),
    ("figfit.js", "measures a figure's rendered label size against the room's own figures at load"),
]


def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def _write(path, s):
    with open(path, "w", encoding="utf-8") as f:
        f.write(s)


def _strip_balanced_div(s, start):
    """s[start:] begins with '<div ...>'. Returns the index right after its
    matching close tag."""
    j, depth = start, 0
    while j < len(s):
        if s.startswith("<div", j):
            depth += 1
            j += 4
        elif s.startswith("</div>", j):
            depth -= 1
            j += 6
            if depth == 0:
                return j
        else:
            j += 1
    return len(s)


def process(rel, write=True):
    if rel not in PAGES:
        return {"page": rel, "status": "REFUSED", "why": "not on the batch's page list"}
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        return {"page": rel, "status": "REFUSED", "why": "file not found"}
    s = _read(path)
    before = len(s.encode("utf-8"))
    if 'id="site-header"' not in s and MARKER not in s:
        return {"page": rel, "status": "REFUSED", "why": "no id=\"site-header\": not a recognised old room"}

    changed = False
    header_before = header_after = 0
    stub_applied = False
    removed, kept = [], []

    # ---- perf-003 + the marker: the head insert, recomputed and replaced ----
    new_insert = head_insert(rel, s)
    him = HEAD_INSERT_RE.search(s)
    if him:
        if s[him.start():him.end()] != new_insert:
            s = s[:him.start()] + new_insert + s[him.end():]
            changed = True
    else:
        m = CHARSET_RE.search(s)
        if not m:
            return {"page": rel, "status": "REFUSED", "why": "no <meta charset> to anchor the head insert"}
        s = s[:m.end()] + new_insert + s[m.end():]
        changed = True

    # ---- arch-004: the header block, stubbed (recomputed and replaced) ----
    hm = HEADER_RE.search(s)
    if not hm:
        return {"page": rel, "status": "REFUSED", "why": "no <header id=\"site-header\">...</header> match"}
    header_body = s[hm.start():hm.end()]
    header_before = len(header_body.encode("utf-8"))
    hoisted = EMBEDDED_ASSET_RE.findall(header_body)
    cut_end = hm.end()
    ns_at = s.find('<div id="nav-sheet"', hm.end())
    # nav-sheet must follow within a few characters (whitespace only);
    # anything else is a shape this script does not recognise. On a page
    # already stubbed there is no nav-sheet left to find, and ns_at is -1.
    if ns_at != -1 and not s[hm.end():ns_at].strip():
        cut_end = _strip_balanced_div(s, ns_at)
    replacement = "".join(hoisted) + STUB
    if header_body != replacement or cut_end != hm.end():
        s = s[:hm.start()] + replacement + s[cut_end:]
        changed = True
        stub_applied = True
        if hoisted:
            removed.append("hoisted out of the header, kept on the page: " + ", ".join(hoisted))
    header_after = len(replacement.encode("utf-8"))

    # ---- arch-005: the kit, cut down ----
    for label, rx in KIT_ALWAYS:
        if rx.search(s):
            s = rx.sub("", s, count=1)
            removed.append(label)
            changed = True
    is_season_page = os.path.basename(rel) in KEEP_SEASON_PAGES
    for label, rx in KIT_SEASON:
        if is_season_page:
            if rx.search(s):
                kept.append(label + " (this page reads NOOR_HIJRI/NOOR_RAMADAN directly)")
            continue
        if rx.search(s):
            s = rx.sub("", s, count=1)
            removed.append(label)
            changed = True
    for label, why in KIT_KEPT_EXPLAIN:
        rxk = re.compile(re.escape(label))
        if rxk.search(s):
            kept.append(label + " (" + why + ")")

    after = len(s.encode("utf-8"))
    if changed and write:
        _write(path, s)

    return {
        "page": rel, "status": "OK", "changed": changed,
        "before": before, "after": after,
        "header_before": header_before, "header_after": header_after,
        "stub_applied": stub_applied,
        "removed": removed, "kept": kept,
    }


def main():
    args = sys.argv[1:]
    write = True
    if "--check" in args:
        write = False
        args.remove("--check")
    pages = args if args else PAGES
    total_before = total_after = 0
    refused = 0
    for rel in pages:
        r = process(rel, write=write)
        if r["status"] == "REFUSED":
            print("REFUSE %-28s %s" % (rel, r["why"]))
            refused += 1
            continue
        total_before += r["before"]
        total_after += r["after"]
        print("%-28s %7d -> %7d bytes (%+d)  header %5d -> %-4d  -%d kit tag(s)%s" % (
            rel, r["before"], r["after"], r["after"] - r["before"],
            r["header_before"], r["header_after"], len(r["removed"]),
            "" if r["changed"] else "  [no change]"))
        if r["removed"]:
            print("    removed: " + ", ".join(r["removed"]))
    print("-" * 78)
    print("%d pages, %d refused, %d -> %d bytes total (%+d)" % (
        len(pages) - refused, refused, total_before, total_after, total_after - total_before))


if __name__ == "__main__":
    main()
