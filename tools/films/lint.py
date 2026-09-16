#!/usr/bin/env python3
"""NOOR - check a film description before a browser ever opens it.

    python3 lint.py                       every film in films/
    python3 lint.py who-was-muhammad      one of them
    python3 lint.py --strict              warnings count as failures too

WHY THIS EXISTS
An eight minute render is eight minutes of a Mac at full tilt, and the mistakes
that waste it are not subtle ones: a beat with no words and no picture, a quote
whose text is in a field the renderer does not read, a figure kind spelled
wrong, a claim with no source under it. Every one of those is visible in the
JSON in a millisecond and invisible in the film until you watch all of it.

The checks are learned from bugs that actually shipped, one per rule, and the
rule says which. Two long films a week for a year is a hundred films; this runs
before every one of them.
"""
import argparse, glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))

#  What the engine can actually draw. Read off web/lume.js FIG.* and the KIND
#  table in web/stage.js, so a typo is caught here and not by an empty beat.
FIGS = {"orb", "plate", "field", "lattice", "stream", "bars", "nut", "nutdots",
        "nutarc", "nutforty", "nutsieve", "nutchain", "nuttime", "nutsort",
        "nutpath", "nutlamps", "nutbar", "ring", "card", "station",
        "nutvalley", "nutscale", "nutsplit", "nutconverge", "nuttwin"}
KINDS = {"title", "statement", "root", "quote", "three", "list", "figure"}
THEMES = {"night", "ink", "orrery", "girih", "relief", "nutshell", "nutvoid", "nutday"}
FADES = {"cut", "dissolve", "flash", "slow"}

#  A beat is on screen this long, so the words on it have to be readable in
#  that time and no longer. Measured against the cuts that read well: a
#  headline over about 62 characters wraps to three lines in the wide frame.
MAXLEN = {"eyebrow": 46, "text": 62, "sub": 116, "en": 150}

#  A BEAT WITH NO FIGURE PUTS ITS HEADLINE ON THE LANTERN'S PANE, and the
#  pane hangs just above where the subtitle band wants to be. Measured off
#  the contact sheet rather than guessed: 65 and 72 character subtitles sit
#  clear under a two line pane, and a 96 character one climbed straight
#  through "governing for ten". The boundary is between those, so the line
#  is drawn at 88 and anything past it is an error rather than a note.
PANESUB = 88

#  A beat that asserts something dated, numbered or named needs a source under
#  it. This is the film's own rule, not a style preference.
CLAIMY = re.compile(r"\b(1[0-9]{3}|[0-9]{3}) *(AD|CE|BC)?\b|\bcentur|\bper cent|%")


class Report:
    def __init__(s, slug): s.slug, s.err, s.warn = slug, [], []
    def e(s, i, m): s.err.append((i, m))
    def w(s, i, m): s.warn.append((i, m))


def lint(path):
    slug = os.path.basename(path)[:-5]
    R = Report(slug)
    try:
        F = json.load(open(path, encoding="utf-8"))
    except Exception as ex:
        R.e(-1, "will not parse: %s" % ex); return R, 0.0
    if "chapters" not in F:
        return None, 0.0                      # an envelope or some other sidecar

    total = 0.0
    for ch in F["chapters"]:
        th = ch.get("theme")
        if th and th not in THEMES:
            R.e(-1, "chapter %s: theme %r is not one the engine knows" % (ch.get("id"), th))
        beats = ch.get("beats") or []
        n = len(beats)

        #  which beats a figure stands under, span by span. This is the same
        #  arithmetic stage.js does; a beat outside all of them and with no
        #  words of its own is a hole in the film.
        cov, heads = [None] * n, [False] * n
        for i, b in enumerate(beats):
            L = b.get("lume")
            if not L:
                continue
            heads[i] = True
            if L.get("kind") not in FIGS:
                R.e(i, "figure kind %r does not exist. Nothing will draw."
                       % L.get("kind"))
            last = min(n - 1, i + max(1, L.get("span", 1)) - 1)
            if i + max(1, L.get("span", 1)) - 1 > n - 1:
                R.w(i, "span runs %d beats past the end of the chapter"
                       % (i + max(1, L.get("span", 1)) - 1 - (n - 1)))
            for j in range(i, last + 1):
                if cov[j] is not None:
                    R.w(j, "two figures claim this beat: %s and %s"
                           % (cov[j], L["kind"]))
                cov[j] = L["kind"]

        for i, b in enumerate(beats):
            k = b.get("kind")
            total += max(1.2, b.get("hold", 4)) + b.get("gap", 0)
            if k not in KINDS:
                R.e(i, "kind %r is not a beat the engine builds" % k)
            for f in ("enter", "exit"):
                if b.get(f) and b[f] not in FADES:
                    R.e(i, "%s: %r is not a transition; it will fall back to a dissolve"
                           % (f, b[f]))
            if b.get("hold", 4) < 1.2:
                R.w(i, "hold %.1fs is under the 1.2s floor and will be stretched"
                       % b["hold"])

            #  A WORDLESS BEAT IS NOT AUTOMATICALLY AN EMPTY ONE, and the
            #  first version of this rule said it was, which sent me chasing
            #  eight beats of film one that turned out to be fine.
            #
            #  When no figure owns a beat, stage.js makes the Lantern the
            #  subject: full scale, full brightness, centre frame. In the dark
            #  themes that is the film's own language and the frame is far
            #  from empty. But the nut themes deliberately tame it to 62% of
            #  its size and 34% of its brightness, because a big soft orb
            #  fights flat vector art. There the same beat really is an empty
            #  room, which is what beats 20 and 42 of film two were.
            #
            #  So the rule is about the theme, not about the beat.
            words = [b.get(x) for x in ("text", "ar", "en", "eyebrow", "sub", "src")]
            if not any(words) and cov[i] is None and (th or "").startswith("nut"):
                R.e(i, "nothing on screen: no words, no figure, and this theme "
                       "shrinks the Lantern to a dim speck")

            #  THE SEAM. Measured off the rendered film rather than reasoned
            #  about: the five darkest seconds of what-is-islam-recited are at
            #  114, 262, 329, 337 and 369, and two of those are the FIRST beat
            #  of a figure's span. The Lantern steps aside the instant a span
            #  opens, dropping to 0.21 scale and 0.34 brightness, but the
            #  figure needs about a second of its own easing to arrive. A
            #  short wordless beat in that gap has nothing lit in it at all.
            if not any(words) and heads[i]:
                h = max(1.2, b.get("hold", 4))
                R.w(i, "seam: the Lantern steps aside for a figure that takes "
                       "about a second to arrive, and there are no words to "
                       "cover it. That is %.0f%% of this %.1fs beat."
                       % (min(100.0, 100.0 / h), h))

            #  AND THE OTHER ONE. KIND.quote reads ar and en; a quote written
            #  with `text` renders blank.
            if k == "quote" and b.get("text") and not (b.get("ar") or b.get("en")):
                R.e(i, "a quote's words go in `ar` and `en`. `text` is not read.")
            if k == "quote" and not b.get("src"):
                R.w(i, "a quote with no source")

            for f, cap in MAXLEN.items():
                v = b.get(f)
                if isinstance(v, str) and len(v) > cap:
                    R.w(i, "%s is %d characters against a comfortable %d"
                           % (f, len(v), cap))
            #  the pane case, which is stricter and is an error, not a note
            pane = (cov[i] is None and b.get("text")
                    and (k == "title" or (k == "statement" and b.get("size") == "big")))
            if pane and len(b.get("sub") or "") > PANESUB:
                R.e(i, "sub is %d characters on a pane beat; over %d it wraps "
                       "to a second line and collides with the pane"
                       % (len(b["sub"]), PANESUB))

            body = " ".join(str(b.get(x) or "") for x in ("text", "sub", "en"))
            if CLAIMY.search(body) and not b.get("src"):
                R.w(i, "a date or a number with no source under it")

    return R, total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="*")
    ap.add_argument("--strict", action="store_true")
    a = ap.parse_args()
    paths = ([os.path.join(HERE, "films", s + ".json") for s in a.slug]
             if a.slug else sorted(glob.glob(os.path.join(HERE, "films", "*.json"))))

    bad = 0
    for p in paths:
        R, total = lint(p)
        if R is None:
            continue
        mark = "FAIL" if R.err else ("warn" if R.warn else "ok")
        print("\n  %-34s %6.1f s   %s" % (R.slug, total, mark))
        for i, m in R.err:
            print("    ERROR  %s %s" % (("beat %-3d" % i) if i >= 0 else "        ", m))
        for i, m in R.warn:
            print("    warn   %s %s" % (("beat %-3d" % i) if i >= 0 else "        ", m))
        if R.err or (a.strict and R.warn):
            bad += 1
    print("\n  %d film(s) checked, %d would not ship\n" % (len(paths), bad))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
