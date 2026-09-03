#!/usr/bin/env python3
"""Render every card in plan.json that has no video yet.

Called by the workflow with no arguments, so a card added to plan.json is
rendered on the next run and nothing already rendered is rendered again. Given
ids, it renders exactly those and overwrites them. Given "all", it renders the
whole library again, which is what a change to the picture or the sound needs:
those change every reel, and a reel is only as current as the day it was made.

    python3 render_missing.py                  the ones with no video
    python3 render_missing.py <id> [<id> ...]  exactly these, again
    python3 render_missing.py all              every card, again
"""
import json, os, sys, time
from playwright.sync_api import sync_playwright

import sound
import webreel

OUT = os.environ.get("REELS_OUT", "../../reels")


def main():
    want = [a for a in sys.argv[1:] if not a.startswith("-")]
    cards = webreel.plan()
    every = "--all" in sys.argv or [w.lower() for w in want] == ["all"]
    if every:
        want = list(cards)
    unknown = [w for w in want if w not in cards]
    if unknown: raise SystemExit("not in plan.json: " + ", ".join(unknown))
    if not want:
        want = [c for c in cards
                if not os.path.exists(os.path.join(OUT, c + ".mp4"))]
    if not want:
        print("nothing to render: every card in plan.json already has a video")
        return 0
    os.makedirs(OUT, exist_ok=True)
    print(f"{len(want)} to render into {OUT}")

    with sync_playwright() as pw:
        st = webreel.Stage(pw)
        # the safe area is proved for everything first, so a card that cannot
        # fit stops the run before any CPU is spent on the ones that can
        bad = []
        for nm in want:
            info, worst, out = webreel.audit(st, nm)
            if out or not info["fits"]:
                bad.append((nm, out[:2] or "does not fit"))
        if bad:
            for nm, why in bad: print("  OUT", nm, why)
            raise SystemExit("the safe area audit failed; nothing was rendered")

        faults = []
        for nm in want:
            t0 = time.time()
            webreel._SCRIM.clear()
            path = webreel.render(st, nm, out_dir=OUT)
            # the sound is checked on the finished file, not on the bed that
            # went in, because what ships is what came out of the encoder
            bad = sound.check(path)
            if bad: faults.append((nm, bad))
            print("%s  %.0fs  %s" % (path, time.time() - t0,
                                     "sound ok" if not bad else "SOUND " + "; ".join(bad)),
                  flush=True)
        st.close()
        if faults:
            for nm, bad in faults: print("  SOUND", nm, "; ".join(bad))
            raise SystemExit("the sound audit failed on %d reel(s)" % len(faults))

    manifest()
    return 0


def manifest():
    """List what actually has a video, for the poster to choose from.

    The site picks the day's reel from this file, so a card that is in the plan
    but has not been rendered yet can never be chosen, and no slot can ever
    point at a file that is not there. It carries the caption too, because the
    caption was written and audited beside the video and must not be rebuilt at
    post time.
    """
    cards = webreel.plan()
    out = []
    for cid in sorted(cards):
        if not os.path.exists(os.path.join(OUT, cid + ".mp4")): continue
        c = cards[cid]
        out.append({"id": cid, "slot": c["slot"], "hook": c["hook"],
                    "caption": c["caption"],
                    "cover": os.path.exists(os.path.join(OUT, cid + "-cover.jpg"))})
    doc = {"n": len(out), "written": time.strftime("%Y-%m-%d"), "cards": out}
    path = os.path.join(OUT, "index.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print(f"{path}: {len(out)} rendered")
    return path


if __name__ == "__main__":
    sys.exit(main())
