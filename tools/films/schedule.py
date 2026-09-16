#!/usr/bin/env python3
"""WHEN, IN FILM SECONDS, EACH FIGURE ACTUALLY DOES WHAT IT DOES.

    python3 schedule.py short-darkroom
    python3 schedule.py

WHY THIS EXISTS

The words and the picture were written separately and then played together,
and on the first full contact sheet of the lamps short the result was plain:
at 25 seconds the callout said "three patches of light appear" over a wall
with nothing on it, and at 34 seconds it said "cover one lamp and its patch
goes out" over three patches that had not arrived yet. The picture did both
of those things, correctly and beautifully, twenty seconds later.

Neither half was wrong. They were not addressed to each other. A beat is
timed by how long its words take to READ, and a figure is timed by its own
internal phases, and nothing had ever compared the two.

So this prints one against the other. It walks the film in film time, watches
how much of the figure's total change has happened at each point, and reports
the seconds at which it passes each tenth. Write the beats against that table
and the words describe what is on the screen while they are on the screen.
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from render import Stage, FRAMES

HERE = os.path.dirname(os.path.abspath(__file__))
STEPS = 60
PROBE = "() => (window.NOORLUME && NOORLUME._marks) ? NOORLUME._marks() : []"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?")
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
            st.build(ch)
            total = sum(b["hold"] for b in ch["beats"])
            sig = []
            for i in range(STEPS + 1):
                st.p.evaluate("t => NOORFILM.seek(t)", total * 1000.0 * i / STEPS)
                m = st.p.evaluate(PROBE)
                v = []
                for q in m:
                    v += [q["x"], q["y"], q["w"], q["h"], q["op"]]
                sig.append(v)
            n = min(len(v) for v in sig)
            per = []
            for j in range(n):
                col = [abs(sig[i][j] - sig[i - 1][j]) for i in range(1, len(sig))]
                t = sum(col)
                if t < 1e-9:
                    continue
                run, cum = 0.0, []
                for d in col:
                    run += d
                    cum.append(run / t)
                per.append(cum)
            if not per:
                print("  %-22s nothing moves" % slug)
                continue
            prog = [sum(p[i] for p in per) / len(per) for i in range(len(per[0]))]
            print("\n  %s   %.1f s" % (slug, total))
            print("     how much of the picture has happened, in film seconds")
            line = []
            for lev in (0.10, 0.25, 0.40, 0.55, 0.70, 0.85, 0.95):
                s = total
                for i, v in enumerate(prog):
                    if v >= lev:
                        s = total * (i + 1) / STEPS
                        break
                line.append("%3d%% at %5.1fs" % (lev * 100, s))
            print("       " + "   ".join(line[:4]))
            print("       " + "   ".join(line[4:]))
            print("     and where the words are")
            t = 0.0
            calls = {c["atMs"]: c for c in
                     (ch["beats"][0].get("lume", {}).get("calls") or [])}
            for b in ch["beats"]:
                c = calls.get(int(round((t + 0.34) * 1000)))
                what = b.get("text") or (c["text"] if c else "")
                pc = 0
                i = min(STEPS - 1, int(round(t / total * STEPS)))
                pc = int(round(prog[max(0, i - 1)] * 100))
                print("       %5.1fs  %3d%%  %s  %s"
                      % (t, pc, "HEAD" if b.get("text") else "call", what))
                t += b["hold"]
        st.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
