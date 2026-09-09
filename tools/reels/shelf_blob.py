#!/usr/bin/env python3
"""The shelf moves to Vercel Blob.

Run by the assemble job after every machine's files are gathered into
reels/ and before the manifest is written. For every video in reels/:

    upload  reels/<id>.mp4  and  reels/<id>-cover.jpg  to the Blob store,
            at the same path, overwriting: a card keeps one URL for good
    write   the URLs, the size and the date into the sidecar reels/<id>.json
            (the verse sidecar keeps its reciter, ref and meaning)
    remove  the local mp4 and cover, so the pull request carries the small
            sidecar and not the video

The sidecar with a `video` URL is what "rendered" means from now on: the
manifest lists those, render_missing.py leaves them alone, and the poster
reads the URL out of the manifest row rather than building one from the id.

Without BLOB_READ_WRITE_TOKEN nothing moves: the videos stay in reels/ as
they always did and the run says so once. The first run after the token is
set moves the whole shelf, old and new alike.

    python3 shelf_blob.py            move what is in reels/
    python3 shelf_blob.py --dry      say what would move, touch nothing
"""
import json, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("REELS_OUT", os.path.join(HERE, "..", "..", "reels"))
BLOB = os.path.join(HERE, "blob.mjs")
PREFIX = os.environ.get("REELS_BLOB_PREFIX", "reels")


def have_token():
    return bool(os.environ.get("BLOB_READ_WRITE_TOKEN")) or bool(os.environ.get("BLOB_FAKE_DIR"))


def put(local, pathname):
    r = subprocess.run(["node", BLOB, "put", local, pathname], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("blob put failed for %s: %s" % (pathname, r.stderr.strip()[:300]))
    url = r.stdout.strip().splitlines()[-1]
    if not url.startswith(("https://", "file://")):
        raise RuntimeError("blob put gave no url for %s: %s" % (pathname, url[:200]))
    return url


def sidecar(cid):
    p = os.path.join(OUT, cid + ".json")
    try:
        return json.load(open(p, encoding="utf-8")), p
    except (OSError, ValueError):
        return {"id": cid}, p


def move(dry=False):
    if not have_token():
        print("no BLOB_READ_WRITE_TOKEN: the videos stay in reels/ this run")
        return 0
    if not os.path.isdir(OUT):
        print("no reels/ directory; nothing to move"); return 0
    ids = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith(".mp4") and not f.endswith(".part.mp4"))
    try:
        plan = json.load(open(os.path.join(HERE, "plan.json"), encoding="utf-8"))["cards"]
    except (OSError, ValueError, KeyError):
        plan = None
    moved, faults = 0, []
    for cid in ids:
        if plan is not None and cid not in plan:
            continue        # not a card any more: the manifest step takes it off the shelf
        mp4 = os.path.join(OUT, cid + ".mp4")
        cover = os.path.join(OUT, cid + "-cover.jpg")
        meta, path = sidecar(cid)
        if dry:
            print("  would move", cid); continue
        try:
            meta["video"] = put(mp4, "%s/%s.mp4" % (PREFIX, cid))
            if os.path.exists(cover):
                meta["cover"] = put(cover, "%s/%s-cover.jpg" % (PREFIX, cid))
            meta["bytes"] = os.path.getsize(mp4)
            meta["uploaded"] = time.strftime("%Y-%m-%d")
            meta.setdefault("id", cid)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=1)
            os.remove(mp4)
            if os.path.exists(cover): os.remove(cover)
            moved += 1
            print("  moved", cid, meta["video"], flush=True)
        except Exception as e:
            # the video stays where it is; the manifest will still list it
            # from the local file, and the next run tries again
            faults.append((cid, str(e)[:200])); print("  KEPT", cid, e, flush=True)
    print("%d moved to the store, %d kept in reels/" % (moved, len(faults)))
    return 1 if faults else 0


if __name__ == "__main__":
    sys.exit(move(dry="--dry" in sys.argv))
