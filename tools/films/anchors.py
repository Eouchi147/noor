#!/usr/bin/env python3
"""What each callout should be pointing at, worked out rather than guessed.

    python3 anchors.py            report only
    python3 anchors.py --write    write the "to" values into the briefs

WHAT A LEADER IS FOR

A callout says one thing about the picture and a thin line runs from the
words to the part of the picture it is about. Which part is a real question
with a real answer, and it was being answered by typing a pair of numbers
off a still.

Those numbers were wrong nearly everywhere, and wrong in a way that is
invisible in the file and obvious on screen: a figure sets its own root and
scales its own contents, so a lamp written at 0.62 in the figure's source is
at 1.41 in the space the leader is measured in. Four of the five leaders in
the lamps short pointed into empty air.

HOW IT IS DECIDED HERE

A callout is written on the beat where something happens, and what it is
about is the thing that just happened. So this reads the picture twice, once
just before the label arrives and once while it is up, and asks which marks
changed: appeared, brightened, grew, moved. The point it hands back is the
centre of those, weighted by how much each one changed.

A beat where nothing changes at all falls back to the centre of everything
that is lit, which is the honest answer to "point at the picture".
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from render import Stage, FRAMES

HERE = os.path.dirname(os.path.abspath(__file__))
PROBE = "() => (window.NOORLUME && NOORLUME._marks) ? NOORLUME._marks() : []"


def delta(a, b):
    """how much each mark changed between two readings, by index"""
    out = {}
    A = {m["k"]: m for m in a}
    for m in b:
        p = A.get(m["k"])
        if p is None:
            out[m["k"]] = (m, 1.0)
            continue
        d = (abs(m["op"] - p["op"]) * 1.6 + abs(m["w"] - p["w"]) * 1.2
             + abs(m["h"] - p["h"]) * 1.2 + abs(m["x"] - p["x"])
             + abs(m["y"] - p["y"]))
        out[m["k"]] = (m, d)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?")
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    slugs = ([a.slug] if a.slug else
             sorted(f[:-5] for f in os.listdir(os.path.join(HERE, "films"))
                    if f.startswith("short-") and f.endswith(".json")))
    with sync_playwright() as pw:
        st = Stage(pw, FRAMES["tall"])
        for slug in slugs:
            F = json.load(open(os.path.join(HERE, "films", slug + ".json"),
                               encoding="utf-8"))
            ch = F["chapters"][0]
            calls = ch["beats"][0].get("lume", {}).get("calls") or []
            if not calls:
                continue
            st.build(ch)
            kind = ch["beats"][0]["lume"]["kind"]
            print("\n  %s   (%s)" % (slug, kind))
            found = []
            for c in calls:
                t0 = max(0.0, c["atMs"] - 500.0)
                t1 = c["atMs"] + c.get("holdMs", 3000) * 0.72
                st.p.evaluate("t => NOORFILM.seek(t)", t0)
                before = st.p.evaluate(PROBE)
                st.p.evaluate("t => NOORFILM.seek(t)", t1)
                after = st.p.evaluate(PROBE)
                d = delta(before, after)
                lit = [m for m in after if m["op"] > 0.15
                       and m["w"] * m["h"] > 1e-5]
                moved = [(d[m["k"]][1], m) for m in lit
                         if m["k"] in d and d[m["k"]][1] > 0.02]
                moved.sort(key=lambda r: -r[0])
                pick = moved[:6]
                how = "changed"
                if not pick:
                    pick = [(1.0, m) for m in lit]
                    how = "everything lit"
                #  ---- AND THE AUTHOR MAY SAY WHICH PART, BY NAME --------
                #  "What just changed" is the right default and it is not
                #  always right. On the balance, the beat that says "Cairo's
                #  gold, before he arrives" belongs on the LEFT pan, and what
                #  was changing at that moment was the pan filling, the beam
                #  settling and the tray fading up all at once, so the
                #  centroid of it landed in the middle of the frame between
                #  the two pans, which names neither.
                #
                #  So a callout may carry a selector instead, and it is
                #  resolved against the marks that are actually on screen on
                #  its own beat rather than against a number typed off a
                #  still. Nothing here is a coordinate: "left" means the
                #  leftmost thing the figure is drawing at that moment, so it
                #  survives the figure being rebuilt or re-measured.
                sel = c.get("at") or ""
                if sel == "hold":
                    found.append((c, list(c.get("to") or [0, 0]), "held"))
                    print("     %-32s    [%6.2f, %6.2f]   set by hand"
                          % (c["text"][:32], (c.get("to") or [0, 0])[0],
                             (c.get("to") or [0, 0])[1]))
                    continue
                if sel and lit:
                    if sel == "gone":
                        #  the mark that went OUT between the two readings,
                        #  which is the only honest way to point at an
                        #  absence: it is measured where it used to be
                        A = {m["k"]: m for m in before}
                        out = sorted((((A[m["k"]]["op"] - m["op"]), A[m["k"]])
                                      for m in after if m["k"] in A),
                                     key=lambda r: r[0])
                        if out and out[-1][0] > 0.15:
                            pick, how = [(1.0, out[-1][1])], "gone dark"
                    else:
                        f = {"left":   lambda m: m["x"],
                             "right":  lambda m: -m["x"],
                             "top":    lambda m: -m["y"],
                             "bottom": lambda m: m["y"],
                             "big":    lambda m: -(m["w"] * m["h"]),
                             "bright": lambda m: -m["op"]}.get(sel)
                        if f:
                            pool = sorted(lit, key=f)[:3]
                            pick, how = [(1.0, m) for m in pool], sel
                        elif sel == "middle":
                            pick, how = [(1.0, m) for m in lit], "middle"
                if not pick:
                    found.append((c, [0.0, 0.0], "nothing on screen"))
                    print("     %-30s  NOTHING VISIBLE" % c["text"][:30])
                    continue
                wsum = sum(w for w, _ in pick)
                x = sum(w * m["x"] for w, m in pick) / wsum
                y = sum(w * m["y"] for w, m in pick) / wsum
                found.append((c, [round(x, 2), round(y, 2)], how))
                print("     %-32s -> [%6.2f, %6.2f]   %s, %d of %d lit"
                      % (c["text"][:32], x, y, how, len(pick), len(lit)))
            if a.write:
                bp = os.path.join(HERE, "briefs", slug + ".json")
                brief = json.load(open(bp, encoding="utf-8"))
                i = 0
                for b in brief["beats"]:
                    if b.get("call"):
                        b["to"] = found[i][1]
                        i += 1
                json.dump(brief, open(bp, "w", encoding="utf-8"),
                          ensure_ascii=False, indent=2)
        st.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
