#!/usr/bin/env python3
"""When does each figure actually finish moving.

    python3 settle.py

WHY THIS EXISTS, AND WHAT IT CAUGHT

A silent short remaps the figure's clock so the picture is up within two
seconds and its arrival lands near the end of the film. That remap is three
numbers, and until now all three were the same for every figure:

    o.warp = [0.055, 0.16, 0.70]

The 0.70 was measured, but it was measured on ONE figure. nutsort reads as
finished at about 0.58 of its own clock, so ending the map at 0.70 left the
picture settled with a beat or two still to run, which is what was wanted.

The lamps figure does not work like that. It throws its three patches of
light onto the far wall between 0.62 and 0.86 of its clock, so a map that
stops at 0.70 delivers them at a third of their size and a third of their
brightness, in the last second, and then the film ends. The whole point of
that short is that three separate images appear on the wall. On the rendered
file they never did. Nobody could have followed it, and the owner said so:
after watching it he was more confused than before.

One number cannot be right for fifteen figures that were each written with
their own timings. So this measures each of them: it drives the figure
through its own clock a hundred and twenty steps at a time, records the
position, size and opacity of every mark at each step, and reports the point
after which almost nothing more happens.

    START   the last u at which the figure is still essentially empty
    END     the first u after which less than 1.5% of the total change is left

Both are then given a margin and written into the table in web/stage.js.
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from render import Stage, FRAMES

HERE = os.path.dirname(os.path.abspath(__file__))
STEPS = 120
#  how much of the whole change may still be to come at the end mark
TAIL = 0.015
#  and how much has to have happened before the figure counts as begun
HEAD = 0.010


def sig(marks):
    """everything about the picture that can change, as one flat vector"""
    v = []
    for m in marks:
        v += [m["x"], m["y"], m["w"], m["h"], m["op"]]
    return v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?")
    a = ap.parse_args()
    slugs = ([a.slug] if a.slug else
             sorted(f[:-5] for f in os.listdir(os.path.join(HERE, "films"))
                    if f.startswith("short-") and f.endswith(".json")))
    out = {}
    with sync_playwright() as pw:
        st = Stage(pw, FRAMES["tall"])
        print("\n  %-20s %-12s %7s %7s   %s"
              % ("short", "figure", "start", "end", "what it means"))
        print("  " + "-" * 74)
        for slug in slugs:
            F = json.load(open(os.path.join(HERE, "films", slug + ".json"),
                               encoding="utf-8"))
            ch = F["chapters"][0]
            st.build(ch)
            kind = ch["beats"][0]["lume"]["kind"]
            frames = []
            for i in range(STEPS + 1):
                u = i / float(STEPS)
                frames.append(sig(st.p.evaluate("u => NOORLUME._sample(u)", u)))
            n = min(len(f) for f in frames)
            if not n:
                print("  %-20s  nothing to measure" % slug)
                continue
            #  EVERY MARK COUNTS THE SAME, AND THAT IS THE WHOLE TRICK.
            #  The first version of this summed the raw change across every
            #  mark, which is a measure of how much the picture moves in
            #  world units. A long bar sweeping across the frame then drowns
            #  out a sliver appearing at the end of it, and on nutbar the
            #  sliver IS the point of the short: it is the error al-Biruni
            #  was out by. The measure said that figure had finished at 0.63
            #  and the thing the whole film is about arrives after 0.78.
            #
            #  So each component is normalised by its own total change first.
            #  A mark that moves a hair and a mark that crosses the frame
            #  both count as one thing that happens, and a mark that never
            #  changes counts as nothing. What comes out is how much of what
            #  is GOING TO happen has happened, which is the actual question.
            per = []
            for j in range(n):
                col = [abs(frames[i][j] - frames[i - 1][j])
                       for i in range(1, len(frames))]
                t = sum(col)
                if t < 1e-9:
                    continue
                run, cum = 0.0, []
                for d in col:
                    run += d
                    cum.append(run / t)
                per.append(cum)
            if not per:
                print("  %-20s  nothing moves" % slug)
                continue
            #  AND THE ANSWER IS THE SLOWEST OF THEM, NOT THE AVERAGE.
            #  Averaging the normalised curves still lets a majority that
            #  finishes early outvote the one mark that arrives last, and the
            #  one that arrives last is very often the point of the film: the
            #  patches on the wall, the sliver of error, the second twin. So
            #  each mark is asked when IT is done, and the answer taken is
            #  the 98th percentile of those: late enough to wait for the last
            #  real arrival, high enough that on a figure of a hundred and
            #  fifty specks it still discards only the two or three that jitter
            #  on a rounding boundary. At the 90th it was discarding fifteen of
            #  them, and on nutconverge the fifteen it discarded were the
            #  donations arriving at the end, which is the film.
            def when(cum, level):
                for i, v in enumerate(cum):
                    if v >= level:
                        return (i + 1) / float(STEPS)
                return 1.0
            ends = sorted(when(c, 1.0 - TAIL) for c in per)
            starts = sorted(when(c, HEAD) for c in per)
            end = ends[min(len(ends) - 1, int(round(0.98 * (len(ends) - 1))))]
            start = starts[max(0, int(round(0.02 * (len(starts) - 1))))]
            out[kind] = [round(start, 3), round(end, 3)]
            print("  %-20s %-12s %7.3f %7.3f   %s"
                  % (slug, kind, start, end,
                     "settles early" if end < 0.72 else "runs to the end"))
        st.close()
    print("\n    the table stage.js needs:\n")
    print("        var SETTLE = {")
    for k in sorted(out):
        print("          %-14s [%.2f, %.2f]," % (k + ":", out[k][0], out[k][1]))
    print("        };")
    json.dump(out, open(os.path.join(HERE, "out", "settle.json"), "w"), indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
