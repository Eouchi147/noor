#!/usr/bin/env python3
"""Where every mark of a figure actually is, in the units a callout points in.

    python3 points.py short-darkroom          one short
    python3 points.py                         all of them

WHY THIS EXISTS

A callout is written as "to": [x, y] and the engine runs a leader from the
label in the band to that point on the figure. Which means the number has to
be the world position of a real mark, and until now those numbers were typed
by eye off a still.

They were wrong, and wrong in a way a still hides. The lamps figure sets its
own root to y 0.86 and then scales its contents by 0.88, so the top lamp,
which is written in the figure's source at y 0.62, is actually at 1.41 in the
space a callout is measured in. Four of the five labels in the first draft of
that short pointed into empty air near the bottom of the picture, and on a
contact sheet a leader into empty air looks like a leader.

So this asks the scene. It builds the figure, lets it finish moving, and
reports the world box of every mark in it, which is the same thing the
callout means by "to".
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from render import Stage, FRAMES

HERE = os.path.dirname(os.path.abspath(__file__))

PROBE = "() => (window.NOORLUME && NOORLUME._marks) ? NOORLUME._marks() : []"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?")
    ap.add_argument("--at", type=float, default=0.88)
    a = ap.parse_args()
    slugs = ([a.slug] if a.slug else
             sorted(f[:-5] for f in os.listdir(os.path.join(HERE, "films"))
                    if f.startswith("short-") and f.endswith(".json")))
    everything = {}
    with sync_playwright() as pw:
        st = Stage(pw, FRAMES["tall"])
        for slug in slugs:
            F = json.load(open(os.path.join(HERE, "films", slug + ".json"),
                               encoding="utf-8"))
            ch = F["chapters"][0]
            st.build(ch)
            total = sum(b["hold"] for b in ch["beats"])
            kind = ch["beats"][0]["lume"]["kind"]
            calls = ch["beats"][0].get("lume", {}).get("calls") or []
            #  AT THE MOMENT EACH LABEL IS UP, not at one arbitrary instant.
            #  A callout points at whatever the picture is doing on ITS beat,
            #  and half of these figures are still building then. Measuring
            #  the finished picture and pointing at that is how a leader ends
            #  up aimed at a mark that has not been drawn yet.
            when = ([("t=%.0f%%" % (a.at * 100), total * a.at * 1000.0)]
                    if not calls else
                    [(c["text"][:26], c["atMs"] + c.get("holdMs", 3000) * 0.5)
                     for c in calls])
            everything[slug] = {"kind": kind, "at": {}}
            print("\n  %s   (%s)" % (slug, kind))
            for label, ms in when:
                st.p.evaluate("t => NOORFILM.seek(t)", ms)
                pts = st.p.evaluate(PROBE)
                pts = [m for m in pts if m["op"] > 0.12]
                everything[slug]["at"][label] = pts
                print("    %5.1fs  %-28s  %d marks visible"
                      % (ms / 1000.0, label, len(pts)))
                print("       %3s %8s %8s %8s %8s  %-9s %s"
                      % ("k", "x", "y", "w", "h", "colour", "seen"))
                for m in pts:
                    print("       %3d %8.2f %8.2f %8.2f %8.2f  %-9s %.2f"
                          % (m["k"], m["x"], m["y"], m["w"], m["h"],
                             m["col"], m["op"]))
        st.close()
    json.dump(everything, open(os.path.join(HERE, "out", "points.json"), "w"), indent=1)
    print("\n  -> out/points.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
