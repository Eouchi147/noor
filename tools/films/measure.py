#!/usr/bin/env python3
"""How big is each figure, actually, and how far back should the camera stand.

    python3 measure.py            every short, measured and solved

WHY THIS EXISTS

Every standing distance in stage.js was a number chosen by eye. Choosing by
eye is how the balance ended up with both pans outside the frame and how the
chain ended up a thumbnail in the middle of an empty one: a figure that is
wide and short and a figure that is small and square were being shot from
distances picked in the same way, in a frame that is nearly twice as tall as
it is wide.

A figure has a real size. three.js will give it. This asks for it at the
moment the figure has finished moving, and then solves for the distance that
composes it, rather than negotiating with the result afterwards.
"""
import argparse, json, os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from render import Stage, FRAMES


def film(slug):
    return json.load(open(os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "films", slug + ".json"), encoding="utf-8"))

HERE = os.path.dirname(os.path.abspath(__file__))

#  ---- THE LAYOUT, WRITTEN DOWN ------------------------------------------
#  A 9:16 frame is 0.5625 as wide as it is tall, so the two axes cannot be
#  treated the same way and a single "fit it in" rule gives a picture that is
#  either cut off or lost. The frame is composed as bands instead:
#
#      0.00 to 0.14   air, and the top label band sits in it
#      0.14 to 0.62   THE FIGURE
#      0.62 to 0.76   the lower label band
#      0.76 to 0.86   the key
#      0.86 to 1.00   the headline, which the DOM draws
#
#  The figure gets 48% of the height and, across, 82% of the width. Those two
#  are the whole specification: whichever of them binds first sets the
#  distance, so a wide figure is sized by the width and a tall one by the
#  height, and neither is ever sized by the wrong one.
FILL_W = 0.82
#  0.42 RATHER THAN 0.48, AND THE SIX POINTS ARE THE HEADLINE'S.
#  The words at the foot of the frame are drawn by the DOM and the figure is
#  drawn by the light layer, and neither knows the other is there. At 48% of
#  the height the figure's foot sat 1423 pixels down and the beat is set with
#  226 pixels of padding under it, which left 271 pixels for eyebrow,
#  headline, subtitle and source together: a three line hook filled it
#  exactly and anything more stood in the picture. That is the overlap the
#  owner sent back. Six points of height is 60 pixels of room, and 42% of
#  1920 against 82% of 1080 is still a picture that dominates the frame.
FILL_H = 0.42

#  the closing values of the short camera, which is where the frame is
#  tightest and therefore where the fit has to hold
FOV_CLOSE = 33.0
PUSH_CLOSE = 1.16
ASPECT_TALL = 1080.0 / 1920.0


def solve(hw, hh):
    """the standing distance that composes a figure of this size"""
    t = math.tan(math.radians(FOV_CLOSE) / 2.0)
    d_w = hw / (FILL_W * t * ASPECT_TALL)      # bound by how wide it is
    d_h = hh / (FILL_H * t)                    # bound by how tall it is
    #  AND THE LABEL BANDS NO LONGER BIND. There was a third constraint here
    #  that pushed the camera back until a band at a fixed world offset fitted
    #  the frame, and it was the binding one on four of the fifteen figures,
    #  which is to say four figures were shot from further away than they
    #  needed to be so that a label would fit. The bands are now written as a
    #  fraction of the frame rather than as a distance, so they fit by
    #  construction at any standing distance and there is nothing left to
    #  solve. See HOW BIG A WORD IS in web/lume.js.
    d = max(d_w, d_h)
    by = "width" if d == d_w else "height"
    return d / PUSH_CLOSE, by


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--at", type=float, default=0.88,
                    help="how far through the film to measure, as a fraction. "
                         "The default is late, because a figure is at its "
                         "largest once it has finished arriving.")
    a = ap.parse_args()

    slugs = sorted(f[:-5] for f in os.listdir(os.path.join(HERE, "films"))
                   if f.startswith("short-") and f.endswith(".json"))
    print("\n  %-20s %-12s %7s %7s %7s   %8s  %s"
          % ("short", "figure", "half w", "half h", "lift", "stand at", "bound by"))
    print("  " + "-" * 82)
    out, look = {}, {}
    with sync_playwright() as pw:
        st = Stage(pw, FRAMES["tall"])
        for slug in slugs:
            F = film(slug)
            ch = F["chapters"][0]
            st.build(ch)
            total = sum(b["hold"] for b in ch["beats"])
            #  AT FOUR POINTS, NOT ONE. A single late reading assumed the
            #  figure is at its largest once it has finished arriving, which
            #  is true of most of these and not of all of them: a figure that
            #  spreads and then gathers, or one that swaps a wide row for a
            #  tall column, is biggest in the middle. Measuring once at 88%
            #  and composing for that is how a figure ends up correctly
            #  framed at the end of a short and off the edge in the middle.
            best = None
            for frac in (0.45, 0.65, 0.82, 0.96):
                st.p.evaluate("t => NOORFILM.seek(t)", total * frac * 1000.0)
                ext = st.p.evaluate("() => window.NOORLUME && NOORLUME._extent "
                                    "? NOORLUME._extent() : []")
                if not ext:
                    continue
                cand = max(ext, key=lambda r: r["hw"] * r["hh"])
                if best is None or max(cand["hw"] / (FILL_W * ASPECT_TALL),
                                       cand["hh"] / FILL_H) > \
                                  max(best["hw"] / (FILL_W * ASPECT_TALL),
                                      best["hh"] / FILL_H):
                    best = cand
            if best is None:
                print("  %-20s  no figure measured" % slug)
                continue
            #  and the aim point is taken where the figure is finished, since
            #  that is the composition the viewer is left looking at
            st.p.evaluate("t => NOORFILM.seek(t)", total * a.at * 1000.0)
            late = st.p.evaluate("() => window.NOORLUME && NOORLUME._extent "
                                 "? NOORLUME._extent() : []")
            e = dict(best)
            if late:
                e["cy"] = max(late, key=lambda r: r["hw"] * r["hh"])["cy"]
            kind = ch["beats"][0]["lume"]["kind"]
            near, by = solve(e["hw"], e["hh"])
            out[kind] = round(near, 2)
            #  AND WHERE TO POINT IT.
            #  A figure places itself inside its own station: most of these
            #  lift by around eight tenths of a unit so their marks sit above
            #  the words. The camera was aimed at the STATION, so the figure
            #  came out riding high in the frame with the bottom third empty.
            #  This is how far off centre the figure's own marks actually sit,
            #  and the camera adds it to what it looks at.
            look[kind] = round(e["cy"], 2)
            print("  %-20s %-12s %7.2f %7.2f %7.2f   %8.2f  %s"
                  % (slug, kind, e["hw"], e["hh"], e["cy"], near, by))
        st.close()
    print("\n  the table stage.js needs:\n")
    print("        var STAND = {")
    for k in sorted(out):
        print("          %-14s %6.2f," % (k + ":", out[k]))
    print("        };")
    print("\n        var LOOK = {")
    for k in sorted(look):
        print("          %-14s %6.2f," % (k + ":", look[k]))
    print("        };")
    json.dump({"stand": out, "look": look},
              open(os.path.join(HERE, "out", "stand.json"), "w"), indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
