#!/usr/bin/env python3
"""Many stills, one browser. For looking at a whole film before paying for it."""
import os, sys, json
from playwright.sync_api import sync_playwright
from spec import FRAMES, LUME_SS
from render import Stage, film, OUT

slug = sys.argv[1]
times = [float(x) for x in sys.argv[2].split(",")]
frames = sys.argv[3].split(",") if len(sys.argv) > 3 else ["wide", "tall"]
chap = sys.argv[4] if len(sys.argv) > 4 else None

F = film(slug)
ch = [c for c in F["chapters"] if c["id"].startswith(chap)][0] if chap else F["chapters"][0]
os.makedirs(OUT, exist_ok=True)
with sync_playwright() as pw:
    for fn in frames:
        st = Stage(pw, FRAMES[fn])
        st.build(ch)
        for ms in times:
            p = os.path.join(OUT, "sheet-%s-%05d.png" % (fn, int(ms)))
            st.p.evaluate("t => NOORFILM.seek(t)", ms)
            st.p.screenshot(path=p)
            print(p)
        st.close()
