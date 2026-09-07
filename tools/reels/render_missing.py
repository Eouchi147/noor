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
import verses
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
    named = bool(want)
    if not want:
        # a card with a video is done; a card marked unfit is known and is
        # not tried again unless it is named or the plan changes its copy
        want = [c for c in cards
                if not os.path.exists(os.path.join(OUT, c + ".mp4"))
                and not unfit_still(c, cards[c])]
    if not want:
        print("nothing to render: every card in plan.json already has a video")
        return 0
    # the kinds take turns, so a run that stops early still leaves a balanced
    # shelf: a verse, a word, a Did you know, a day, then round again
    want = interleave(want, cards)
    cap = int(os.environ.get("REELS_MAX", "0") or 0)
    if cap and len(want) > cap:
        print(f"{len(want)} missing; this run takes the first {cap}")
        want = want[:cap]
    os.makedirs(OUT, exist_ok=True)
    print(f"{len(want)} to render into {OUT}")

    # One verse needs its translation before anything can be measured
    refs = [cards[c]["verse"] for c in want if cards[c].get("kind") == "verse"]
    if refs:
        print("translations fetched now:", verses.fetch_translations(refs))

    with sync_playwright() as pw:
        st = webreel.Stage(pw)
        # the safe area is proved for everything first. A card that cannot fit
        # is set aside and named, and the ones that can are still rendered:
        # one long verse must not cost the week its other reels.
        bad, good = [], []
        for nm in want:
            try:
                info, worst, out = webreel.audit(st, nm)
            except (SystemExit, Exception) as e:
                bad.append((nm, str(e) or type(e).__name__)); continue
            if out or not info["fits"]:
                bad.append((nm, str(out[:2] or "does not fit")))
            else:
                good.append(nm)
        for nm, why in bad:
            print("  OUT", nm, why)
            mark_unfit(nm, cards[nm], why)
        want = good

        st.close()

    # the rendering itself, in as many browsers as the machine has cores for:
    # each worker holds one page and takes every j-th card
    jobs = max(1, int(os.environ.get("REELS_JOBS", "1") or 1))
    faults = []
    try:
        if jobs == 1 or len(want) < 2:
            faults = _work(want, 0)
        else:
            import multiprocessing as mp
            ctx = mp.get_context("spawn")
            parts = [want[i::jobs] for i in range(jobs)]
            with ctx.Pool(jobs) as pool:
                for f in pool.starmap(_work, [(p_, i) for i, p_ in enumerate(parts)]):
                    faults += f
    finally:
        # whatever happened, what exists is listed: a run cut short still
        # leaves every finished reel on the shelf and none of the broken ones
        sweep()
        manifest()
    for nm, fb in faults: print("  FAULT", nm, "; ".join(fb))
    if bad: print("%d card(s) set aside as unfit; they are named in reels/<id>.unfit.json" % len(bad))
    if faults:
        raise SystemExit("%d reel(s) failed and were removed so the next run tries again" % len(faults))
    return 0


def unfit_path(cid):
    return os.path.join(OUT, cid + ".unfit.json")


def copy_hash(card):
    """the words of a card, hashed: when they change the card is tried again"""
    import hashlib
    keep = {k: v for k, v in card.items() if k not in ("look", "caption", "slot")}
    return hashlib.md5(json.dumps(keep, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]


def unfit_still(cid, card):
    try:
        u = json.load(open(unfit_path(cid), encoding="utf-8"))
        return u.get("copy") == copy_hash(card)
    except (OSError, ValueError):
        return False


def mark_unfit(cid, card, why):
    with open(unfit_path(cid), "w", encoding="utf-8") as f:
        json.dump({"id": cid, "why": why, "copy": copy_hash(card), "when": time.strftime("%Y-%m-%d")},
                  f, ensure_ascii=False, indent=1)


def sweep():
    """nothing half made stays on the shelf"""
    for f in os.listdir(OUT):
        if f.endswith(".part.mp4"):
            try: os.remove(os.path.join(OUT, f))
            except OSError: pass


def _work(names, worker):
    """render these, in one browser, and hand back the sound faults"""
    faults = []
    if not names: return faults
    cards = webreel.plan()
    with sync_playwright() as pw:
        st = webreel.Stage(pw)
        for nm in names:
            t0 = time.time()
            webreel._SCRIM.clear()
            try:
                path = webreel.render(st, nm, out_dir=OUT)
            except (SystemExit, Exception) as e:
                print("  FAILED", nm, e, flush=True); faults.append((nm, [str(e) or type(e).__name__]))
                forget(nm); continue
            # the sound is checked on the finished file, not on the bed that
            # went in, because what ships is what came out of the encoder
            bad = sound.check(path, target=sound.target_for(cards[nm].get("kind", "light")))
            if bad:
                faults.append((nm, bad)); forget(nm)
            print("[%d] %s  %.0fs  %s" % (worker, path, time.time() - t0,
                                          "sound ok" if not bad else "SOUND " + "; ".join(bad)),
                  flush=True)
        st.close()
    return faults


def forget(cid):
    """a reel that failed its audit is not a reel: every trace goes, so the
    next run renders it again rather than shipping it"""
    for suf in (".mp4", ".part.mp4", "-cover.jpg", ".json"):
        try: os.remove(os.path.join(OUT, cid + suf))
        except OSError: pass


def interleave(names, cards):
    by = {}
    for nm in names:
        by.setdefault(cards[nm].get("kind", "light"), []).append(nm)
    order = ["verse", "word", "know", "day", "light"]
    queues = [by[k] for k in order if by.get(k)] + [v for k, v in by.items() if k not in order]
    out = []
    while any(queues):
        for q in queues:
            if q: out.append(q.pop(0))
    return out


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
        kind = c.get("kind", "light")
        meta = {}
        try: meta = json.load(open(os.path.join(OUT, cid + ".json"), encoding="utf-8"))
        except (OSError, ValueError): pass
        caption = c["caption"]
        if kind == "verse":
            caption = (caption.replace("{ref}", meta.get("ref", c.get("verse", "")))
                              .replace("{meaning}", meta.get("meaning", ""))
                              .replace("{reciter}", meta.get("reciter", "a reciter")))
        hook = {"light": c.get("hook"), "know": c.get("hook"), "day": c.get("hook"),
                "word": c.get("term"), "verse": meta.get("ref") or c.get("verse")}[kind]
        row = {"id": cid, "kind": kind, "slot": c["slot"], "hook": hook or "",
               "caption": caption, "secs": meta.get("secs"),
               "cover": os.path.exists(os.path.join(OUT, cid + "-cover.jpg"))}
        if kind == "day": row["hm"], row["hd"] = c.get("hm"), c.get("hd")
        if kind == "verse":
            if not meta.get("reciter"): continue   # no sidecar, no caption: not listed
            row["reciter"] = meta.get("reciter", "")
        out.append(row)
    path = os.path.join(OUT, "index.json")
    # the date is only touched when the list is: a run that made nothing new
    # must not open a pull request that changes one line
    written = time.strftime("%Y-%m-%d")
    try:
        old = json.load(open(path, encoding="utf-8"))
        if old.get("cards") == out: written = old.get("written", written)
    except (OSError, ValueError):
        pass
    doc = {"n": len(out), "written": written, "cards": out}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print(f"{path}: {len(out)} rendered")
    return path


if __name__ == "__main__":
    sys.exit(main())
