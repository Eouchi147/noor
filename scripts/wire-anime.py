#!/usr/bin/env python3
# NOOR · wire the illumination layer into every page
# ---------------------------------------------------------------------------
# One script tag per page, and the GSAP trio it replaces taken out where a
# page still carried it. Idempotent: run it as often as you like.
#
#   python3 scripts/wire-anime.py             every page
#   python3 scripts/wire-anime.py rooms       the rooms only (no dictionary landing pages)
#   python3 scripts/wire-anime.py words       the dictionary landing pages only
import glob, io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TAG = '<script src="/assets/noor-anime.js?v=1" defer></script>'
SKIP = {"admin.html"}                       # the console stays still

BOOT = re.compile(r'[ \t]*<script src="[^"]*noor-motion-boot\.js[^"]*"[^>]*></script>[ \t]*\n?')
GSAP = re.compile(r'[ \t]*<script src="[^"]*(?:gsap\.min\.js|ScrollTrigger\.min\.js|DrawSVGPlugin\.min\.js|noor-motion\.js(?:\?v=\d+)?)"[^>]*></script>[ \t]*\n?')
WORD_PAGE = 'class="kick">A word of the Path'

which = sys.argv[1] if len(sys.argv) > 1 else "all"
pages = sorted(glob.glob(os.path.join(ROOT, "*.html")) + glob.glob(os.path.join(ROOT, "*", "*.html")))
pages = [p for p in pages if not p.startswith(os.path.join(ROOT, "api")) and os.path.basename(p) not in SKIP]

changed = swapped = added = same = 0
for p in pages:
    s = io.open(p, encoding="utf-8").read()
    is_word = WORD_PAGE in s
    if which == "rooms" and is_word: continue
    if which == "words" and not is_word: continue
    if TAG in s:
        same += 1; continue
    out = s
    if BOOT.search(out):
        out = BOOT.sub(TAG + "\n", out, count=1); swapped += 1
    elif GSAP.search(out):
        out, n = GSAP.subn("", out)
        # put the one tag where the first of the four used to be: before </head>
        out = out.replace("</head>", TAG + "\n</head>", 1); swapped += 1
    else:
        if "</head>" not in out:
            print("  ! no </head> in", os.path.relpath(p, ROOT)); continue
        out = out.replace("</head>", TAG + "\n</head>", 1); added += 1
    if out != s:
        io.open(p, "w", encoding="utf-8").write(out); changed += 1

print("wired %d page(s): %d swapped off GSAP, %d added, %d already carried it" % (changed, swapped, added, same))
