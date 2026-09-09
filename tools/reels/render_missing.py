#!/usr/bin/env python3
"""Render every card in plan.json that has no video yet.

Called by the workflow with no arguments, so a card added to plan.json is
rendered on the next run and nothing already rendered is rendered again. A
card is rendered when its video is in reels/, or when its sidecar says the
video is on the Blob store (shelf_blob.py moves it there after the render). Given
ids, it renders exactly those and overwrites them. Given "all", it renders the
whole library again, which is what a change to the picture or the sound needs:
those change every reel, and a reel is only as current as the day it was made.

    python3 render_missing.py                  the ones with no video
    python3 render_missing.py <id> [<id> ...]  exactly these, again
    python3 render_missing.py all              every card, again
    python3 render_missing.py --count          how many a run would render, no browser
    python3 render_missing.py --manifest       list what has a video, nothing else

Each card is audited against the safe area in the worker that renders it,
in the same browser, immediately before its first frame is drawn (REELS_JOBS
workers, three on a runner), so the audit runs as wide as the rendering and a
run cut short leaves nothing audited but unrendered. Its verdicts are printed
as they land, one line a card: `  OK <id>` or `  OUT <id> why`.

Several machines can share one run: with REELS_SHARDS=4 and REELS_SHARD=0..3
each takes every fourth card of the same interleaved list, so four runners
finish a shelf in the time one would take a quarter of it. Each then hands
its files to the one that writes the manifest (--manifest) and opens the
pull request; the workflow in .github/workflows/reels.yml is that dance.
"""
import json, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
from playwright.sync_api import sync_playwright

import sound
import verses
import webreel

OUT = os.environ.get("REELS_OUT", "../../reels")


def todo(args):
    """the cards this process should render, in the order it should take them"""
    want = [a for a in args if not a.startswith("-")]
    cards = webreel.plan()
    every = "--all" in args or [w.lower() for w in want] == ["all"]
    if every:
        want = list(cards)
    unknown = [w for w in want if w not in cards]
    if unknown: raise SystemExit("not in plan.json: " + ", ".join(unknown))
    if not want:
        # a card with a video is done, here or on the store; a card marked
        # unfit is known and is not tried again unless it is named or the
        # plan changes its copy
        want = [c for c in cards
                if not has_video(c)
                and not unfit_still(c, cards[c])]
    # the kinds take turns, so a run that stops early still leaves a balanced
    # shelf: a verse, a word, a Name, a Did you know, a du'a, a day, then
    # round again
    want = interleave(want, cards)
    total = len(want)
    shards = max(1, int(os.environ.get("REELS_SHARDS", "1") or 1))
    shard = int(os.environ.get("REELS_SHARD", "0") or 0)
    if shards > 1:
        if not 0 <= shard < shards:
            raise SystemExit("REELS_SHARD must be between 0 and %d" % (shards - 1))
        want = want[shard::shards]
    cap = int(os.environ.get("REELS_MAX", "0") or 0)
    if cap and len(want) > cap:
        want = want[:cap]
    return want, cards, total


def main():
    if "--manifest" in sys.argv:
        sweep(); manifest(); return 0
    if "--count" in sys.argv:
        # what one run would take on, before any machine is spent on it
        os.environ.pop("REELS_SHARDS", None); os.environ.pop("REELS_SHARD", None)
        want, _, total = todo(sys.argv[1:])
        print(len(want)); return 0
    want, cards, total = todo(sys.argv[1:])
    if not want:
        print("nothing to render: every card in plan.json already has a video")
        return 0
    if len(want) < total:
        print(f"{total} to do in all; this machine takes {len(want)}")
    os.makedirs(OUT, exist_ok=True)
    print(f"{len(want)} to render into {OUT}")

    # One verse needs its translation before anything can be measured
    refs = [cards[c]["verse"] for c in want if cards[c].get("kind") == "verse"]
    if refs:
        print("translations fetched now:", verses.fetch_translations(refs), flush=True)

    # the audit and the rendering, in as many browsers as the machine has
    # cores for: each worker holds one page, takes every j-th card, and proves
    # the safe area of each card in that page immediately before rendering it.
    # So the audit runs as wide as the rendering does instead of one card at
    # a time before any frame is drawn, and a run cut short leaves nothing
    # audited but unrendered. A card that cannot fit is set aside and named,
    # and the ones that can are still rendered: one long verse must not cost
    # the week its other reels. A browser or picture failure is the machine's,
    # not the card's: it stops the run rather than marking cards unfit.
    jobs = max(1, int(os.environ.get("REELS_JOBS", "1") or 1))
    faults, bad = [], []
    try:
        if jobs == 1 or len(want) < 2:
            faults, bad = _work(want, 0)
        else:
            import multiprocessing as mp
            ctx = mp.get_context("spawn")
            parts = [want[i::jobs] for i in range(jobs)]
            with ctx.Pool(jobs) as pool:
                for f, b in pool.starmap(_work, [(p_, i) for i, p_ in enumerate(parts)]):
                    faults += f; bad += b
    except RuntimeError as e:
        # the machine's failure, raised by a worker: the run stops
        raise SystemExit(str(e))
    finally:
        # whatever happened, what exists is listed: a run cut short still
        # leaves every finished reel on the shelf and none of the broken ones
        sweep()
        manifest()
    for nm, why in bad: print("  OUT", nm, why)
    for nm, fb in faults: print("  FAULT", nm, "; ".join(fb))
    if bad: print("%d card(s) set aside as unfit; they are named in reels/<id>.unfit.json" % len(bad))
    if faults:
        raise SystemExit("%d reel(s) failed and were removed so the next run tries again" % len(faults))
    return 0


def unfit_path(cid):
    return os.path.join(OUT, cid + ".unfit.json")


def stored(cid):
    """the sidecar's word on where the video is: {video, cover} URLs on the
    Blob store, written by shelf_blob.py, or an empty dict"""
    try:
        m = json.load(open(os.path.join(OUT, cid + ".json"), encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return m if isinstance(m, dict) and str(m.get("video", "")).startswith(("https://", "file://")) else {}


def has_video(cid):
    """rendered means a video here in reels/, or a sidecar that says the
    video is on the store"""
    return os.path.exists(os.path.join(OUT, cid + ".mp4")) or bool(stored(cid))


def copy_hash(card):
    """the words of a card, hashed: when they change the card is tried again"""
    import hashlib
    keep = {k: v for k, v in card.items() if k not in ("look", "caption", "slot", "build")}
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
    """audit and render these, in one browser, and hand back the sound faults
    and the cards set aside as unfit"""
    faults, unfit = [], []
    if not names: return faults, unfit
    cards = webreel.plan()
    with sync_playwright() as pw:
        st = webreel.Stage(pw)
        for nm in names:
            t0 = time.time()
            webreel._SCRIM.clear()
            # the safe area first, in this same page, measured as pixels
            try:
                info, worst, out = webreel.audit(st, nm)
            except SystemExit as e:
                why = str(e) or "unfit"
                print("  OUT", nm, why, flush=True); mark_unfit(nm, cards[nm], why)
                unfit.append((nm, why)); continue
            except Exception as e:
                raise RuntimeError("the renderer failed on %s: %s" % (nm, str(e)[:200]))
            if out or not info["fits"]:
                why = str(out[:2] or "does not fit")
                print("  OUT", nm, why, flush=True); mark_unfit(nm, cards[nm], why)
                unfit.append((nm, why)); continue
            t1 = time.time()
            print("  OK", nm, flush=True)
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
            print("[%d] %s  audit %.0fs  render %.0fs  %s"
                  % (worker, path, t1 - t0, time.time() - t1,
                     "sound ok" if not bad else "SOUND " + "; ".join(bad)),
                  flush=True)
        st.close()
    return faults, unfit


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
    order = ["verse", "word", "name", "know", "dua", "day", "light"]
    queues = [by[k] for k in order if by.get(k)] + [v for k, v in by.items() if k not in order]
    out = []
    while any(queues):
        for q in queues:
            if q: out.append(q.pop(0))
    return out


def orphans(cards):
    """the shelf is what the plan says: a file whose card is no longer in
    plan.json (a kind retired, an id renamed) is taken off, so the manifest
    and the folder never disagree and a retired reel cannot be posted"""
    gone = []
    for f in sorted(os.listdir(OUT)):
        if f == "index.json": continue
        cid = f
        for suf in (".unfit.json", "-cover.jpg", ".part.mp4", ".mp4", ".json"):
            if f.endswith(suf): cid = f[:-len(suf)]; break
        if cid in cards: continue
        if f.endswith(".json") and not f.endswith(".unfit.json"):
            # the video on the store goes with its sidecar, best effort
            m = stored(cid)
            for u in (m.get("video"), m.get("cover")):
                if u:
                    try: subprocess.run(["node", os.path.join(HERE, "blob.mjs"), "del", u], capture_output=True, timeout=60)
                    except Exception: pass
        try: os.remove(os.path.join(OUT, f)); gone.append(f)
        except OSError: pass
    if gone: print("taken off the shelf, no card in the plan: %d file(s)" % len(gone))
    return gone


def manifest():
    """List what actually has a video, for the poster to choose from.

    The site picks the day's reel from this file, so a card that is in the plan
    but has not been rendered yet can never be chosen, and no slot can ever
    point at a file that is not there. It carries the caption too, because the
    caption was written and audited beside the video and must not be rebuilt at
    post time.
    """
    cards = webreel.plan()
    orphans(cards)
    out = []
    for cid in sorted(cards):
        if not has_video(cid): continue
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
                "word": c.get("term"), "verse": meta.get("ref") or c.get("verse"),
                "name": c.get("translit"), "dua": c.get("translit")}.get(kind, c.get("hook"))
        row = {"id": cid, "kind": kind, "slot": c["slot"], "hook": hook or "",
               "caption": caption, "secs": meta.get("secs"),
               "cover": os.path.exists(os.path.join(OUT, cid + "-cover.jpg")) or bool(meta.get("cover"))}
        # where the video is: on the store, the row carries the URLs and the
        # poster uses them as they are; in reels/, the poster builds the old
        # path from the id, so an old manifest and a new one read alike
        if str(meta.get("video", "")).startswith(("https://", "file://")):
            row["video"] = meta["video"]
            if meta.get("cover"): row["cover"] = meta["cover"]
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
