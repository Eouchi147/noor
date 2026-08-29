#!/usr/bin/env python3
"""
Build api/_cardfont.js: the two faces the social card is drawn with, embedded
as bytes, plus the exact set of codepoints they can draw.

Why this exists, in one paragraph. Font fallback is silent. On the first real
rasterisation of a card, the honorific in "the birth of the Prophet ﷺ, or the"
rendered as an empty gap, and nothing anywhere reported a problem: no error, no
warning, no missing-glyph box. It was visible only by looking at the picture.
So the card renderer runs with loadSystemFonts disabled, carries its faces in
the repository rather than trusting the machine, and refuses to draw a
character these faces do not have.

Run this after adding cards that introduce new characters:

    python3 scripts/gen-card-fonts.py

It reads lights/all.json, so run gen-lights.py first.
"""
import base64, json, os, subprocess, sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEJAVU = "/usr/share/fonts/truetype/dejavu"
OUTDIR = os.path.join(ROOT, "assets", "fonts")

# The card frame's own words, which are not in the library
FRAME = ("NOORCODEX.COM A free Islamic library. No ads, no trackers, no account.")
# Latin punctuation and accented letters worth carrying even if unused today
EXTRA = "‘’“”…·éèîôûâàïüçñūīāḥṣḍṭẓʿʾ"
# Deliberately excluded: U+FDFA and U+FDFB. api/card.js spells them out before
# drawing, because these are the least reliably supported codepoints in Unicode
# and a broken one on a card about the Prophet is not an ordinary bug.
BANNED = {"ﷺ", "ﷻ"}


def main():
    lights = json.load(open(os.path.join(ROOT, "lights", "all.json"), encoding="utf-8"))["lights"]
    chars = set()
    for l in lights:
        for f in ("t", "s", "d", "c"):
            chars |= set(str(l.get(f, "")))
    chars |= set(FRAME) | set(EXTRA) | {chr(c) for c in range(0x20, 0x7F)}
    chars -= BANNED
    chars = {c for c in chars if ord(c) > 31}

    uni = ",".join("U+%04X" % ord(c) for c in sorted(chars))
    os.makedirs(OUTDIR, exist_ok=True)
    faces = {}
    for src, out in [("DejaVuSans.ttf", "noor-card-regular.ttf"),
                     ("DejaVuSans-Bold.ttf", "noor-card-bold.ttf")]:
        p = os.path.join(OUTDIR, out)
        subprocess.run(["pyftsubset", os.path.join(DEJAVU, src),
                        "--unicodes=" + uni, "--layout-features=kern,liga",
                        "--output-file=" + p], check=True)
        faces[out] = open(p, "rb").read()
        print("  %-24s %5.1f KB" % (out, len(faces[out]) / 1024.0))

    from fontTools.ttLib import TTFont
    f = TTFont(os.path.join(OUTDIR, "noor-card-regular.ttf"))
    cps = sorted({k for t in f["cmap"].tables for k in t.cmap})

    missing = sorted(c for c in chars if ord(c) not in set(cps))
    if missing:
        sys.exit("the source face cannot draw: " + " ".join(missing))

    header = open(os.path.join(ROOT, "api", "_cardfont.js"), encoding="utf-8").read()
    header = header[:header.index("export const REGULAR")] if "export const REGULAR" in header else ""
    body = ('export const REGULAR = Buffer.from("%s", "base64");\n'
            'export const BOLD = Buffer.from("%s", "base64");\n'
            'export const FAMILY = "DejaVu Sans";\n\n'
            '/* every codepoint the faces above can draw */\n'
            'export const COVERAGE = new Set(%s);\n'
            % (base64.b64encode(faces["noor-card-regular.ttf"]).decode(),
               base64.b64encode(faces["noor-card-bold.ttf"]).decode(),
               json.dumps(cps)))
    out = os.path.join(ROOT, "api", "_cardfont.js")
    open(out, "w", encoding="utf-8").write(header + body)
    print("  api/_cardfont.js         %5.1f KB, %d codepoints" % (os.path.getsize(out) / 1024.0, len(cps)))


if __name__ == "__main__":
    main()
