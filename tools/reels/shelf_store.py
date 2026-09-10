#!/usr/bin/env python3
"""The shelf moves to the store.

The videos used to live in the repository and ride along in every Vercel
deployment: 1.3 GB of mp4 per deploy, a repository past 3 GB, and every
re-render of the shelf adding the same again for good. They live on a store
now, and the repository keeps one small sidecar per reel that says where.

Two stores, one of them free:

    release   GitHub Releases, the default. Each kind has a release tagged
              reels-<kind>; a video is an asset of it, named <id>.mp4, its
              cover <id>-cover.jpg. Free, no size counted against the
              repository, deletable one by one. The download URL is stable
              (github.com/<repo>/releases/download/reels-<kind>/<id>.mp4)
              and answers with a short lived redirect, which the poster
              resolves at the moment it hands a network the file.
              Needs GITHUB_TOKEN, which every workflow run has.
    blob      Vercel Blob, through blob.mjs, when REELS_STORE=blob and
              BLOB_READ_WRITE_TOKEN is set.

Run by the assemble job after every machine's files are gathered into reels/
and before the manifest is written. For every video in reels/ whose card is
in the plan: upload the video (overwriting; the cover too with
REELS_STORE_COVERS=1, otherwise the hundred kilobyte cover stays in the
repository), write the URL into the sidecar reels/<id>.json (a verse sidecar
keeps its reciter, ref and meaning), and remove the local video, so the pull
request carries the sidecar and not the video. The sidecar with a `video` URL is what "rendered"
means from now on.

Without any token nothing moves and the run says so once: the videos stay in
reels/ as they always did.

    python3 shelf_store.py            move what is in reels/
    python3 shelf_store.py --dry      say what would move, touch nothing
"""
import json, os, subprocess, sys, time, urllib.request, urllib.error, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("REELS_OUT", os.path.join(HERE, "..", "..", "reels"))
API = os.environ.get("GITHUB_API_URL", "https://api.github.com")
UPLOADS = "https://uploads.github.com"
REPO = os.environ.get("GITHUB_REPOSITORY", "Eouchi147/noor")
TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or ""
STORE = os.environ.get("REELS_STORE") or ("blob" if os.environ.get("BLOB_READ_WRITE_TOKEN") and not TOKEN else "release")
TYPES = {".mp4": "video/mp4", ".jpg": "image/jpeg"}
COVERS = os.environ.get("REELS_STORE_COVERS") == "1" or STORE == "blob"


def have_store():
    if STORE == "blob":
        return bool(os.environ.get("BLOB_READ_WRITE_TOKEN")) or bool(os.environ.get("BLOB_FAKE_DIR"))
    return bool(TOKEN) or bool(os.environ.get("RELEASE_FAKE_DIR"))


# ---------------------------------------------------------------- GitHub

# GitHub allows about 500 content-creating requests an hour and 80 a minute
# per token, and a run's GITHUB_TOKEN has 1,000 requests an hour in all. A
# shelf of 1,265 videos is therefore paced: one upload every PACE seconds,
# a little under eight a minute, three hours for the whole shelf once and a
# few minutes for a week's new reels after that.
PACE = float(os.environ.get("REELS_STORE_PACE", "8"))
_last_write = 0.0

# A GitHub Actions job is killed at five hours with no warning and no output,
# which is how run #10 spent ten hours of machines and shipped nothing. The
# shelf stops uploading before that, hands back what it has, and lets the
# manifest and the pull request happen. What did not go up is deleted rather
# than committed, because a card with no video in the store and no video here
# is simply not in the manifest, stays in the plan, and is rendered again next
# run: a few hundred megabytes of mp4 in a pull request helps nobody.
BUDGET = float(os.environ.get("REELS_STORE_BUDGET", "13800"))   # 3h50m
_started = time.time()


def out_of_time():
    return BUDGET > 0 and (time.time() - _started) > BUDGET


def _req(method, url, body=None, ctype="application/json", raw=None, tries=4):
    global _last_write
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    writes = method in ("POST", "DELETE", "PATCH")
    for attempt in range(tries):
        if writes:
            # The pace is one write STARTED every PACE seconds, which is what
            # GitHub counts. Measuring from the end of the last write instead
            # made every cycle PACE plus the upload itself: a three megabyte
            # video takes about eight seconds to send, so eight became sixteen,
            # and the three hours this file promises became five and three
            # quarters. The job ceiling is five, so the shelf could never
            # finish in one run. Run #10 died at 1,090 of 1,265 with nothing
            # to show for nearly ten hours of machines.
            wait = PACE - (time.time() - _last_write)
            if wait > 0: time.sleep(wait)
            _last_write = time.time()
        req = urllib.request.Request(url, data=data, method=method, headers={
            "Authorization": "Bearer " + TOKEN, "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28", "Content-Type": ctype,
            "User-Agent": "NOOR reels"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                t = r.read()
                return r.status, (json.loads(t) if t and r.headers.get("Content-Type", "").startswith("application/json") else t)
        except urllib.error.HTTPError as e:
            if e.code in (403, 429, 502, 503) and attempt < tries - 1:
                # rate limited or a hiccup: wait what GitHub asks, or a minute
                ra = e.headers.get("Retry-After") if e.headers else None
                time.sleep(float(ra) if ra and ra.isdigit() else 60.0 * (attempt + 1))
                continue
            return e.code, e.read()[:300]
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            if attempt < tries - 1: time.sleep(20.0 * (attempt + 1)); continue
            return 0, str(e)[:300]


_RELEASES = {}
_ASSETS = {}


def release_for(kind):
    """the release this kind's videos hang on, made once if it is not there"""
    tag = "reels-" + kind
    if tag in _RELEASES: return _RELEASES[tag]
    st, j = _req("GET", "%s/repos/%s/releases/tags/%s" % (API, REPO, tag))
    if st == 404:
        st, j = _req("POST", "%s/repos/%s/releases" % (API, REPO), {
            "tag_name": tag, "name": "Reels · " + kind,
            "body": "The rendered %s reels of NOOR Codex of Light, one asset each, kept here so the repository "
                    "stays small. Written by the reels workflow; read by the poster." % kind,
            "draft": False, "prerelease": False, "make_latest": "false"})
    if st not in (200, 201):
        raise RuntimeError("release %s: %s %s" % (tag, st, j))
    _RELEASES[tag] = j
    return j


def assets_of(rel):
    rid = rel["id"]
    if rid in _ASSETS: return _ASSETS[rid]
    out, page = {}, 1
    while True:
        st, j = _req("GET", "%s/repos/%s/releases/%d/assets?per_page=100&page=%d" % (API, REPO, rid, page))
        if st != 200: raise RuntimeError("assets of %s: %s %s" % (rel.get("tag_name"), st, j))
        for a in j: out[a["name"]] = a
        if len(j) < 100: break
        page += 1
    _ASSETS[rid] = out
    return out


def release_put(local, kind, name):
    fake = os.environ.get("RELEASE_FAKE_DIR")
    if fake:
        import shutil
        dest = os.path.join(fake, "reels-" + kind, name)
        os.makedirs(os.path.dirname(dest), exist_ok=True); shutil.copyfile(local, dest)
        return "file://" + dest, 0
    rel = release_for(kind)
    have = assets_of(rel)
    if name in have:                       # a re-render replaces the old file
        _req("DELETE", "%s/repos/%s/releases/assets/%d" % (API, REPO, have[name]["id"]))
        del have[name]
    ext = os.path.splitext(name)[1].lower()
    with open(local, "rb") as f: data = f.read()
    url = "%s/repos/%s/releases/%d/assets?%s" % (UPLOADS, REPO, rel["id"], urllib.parse.urlencode({"name": name}))
    st, j = _req("POST", url, ctype=TYPES.get(ext, "application/octet-stream"), raw=data)
    if st != 201: raise RuntimeError("upload %s: %s %s" % (name, st, j))
    have[name] = j
    return j["browser_download_url"], j["id"]


def release_delete(asset_id):
    if not asset_id or os.environ.get("RELEASE_FAKE_DIR"): return
    _req("DELETE", "%s/repos/%s/releases/assets/%d" % (API, REPO, int(asset_id)))


# ---------------------------------------------------------------- Blob

def blob_put(local, pathname):
    r = subprocess.run(["node", os.path.join(HERE, "blob.mjs"), "put", local, pathname], capture_output=True, text=True)
    if r.returncode != 0: raise RuntimeError("blob put failed for %s: %s" % (pathname, r.stderr.strip()[:300]))
    url = r.stdout.strip().splitlines()[-1]
    if not url.startswith(("https://", "file://")): raise RuntimeError("blob put gave no url for %s" % pathname)
    return url


def blob_delete(url):
    if not url: return
    try: subprocess.run(["node", os.path.join(HERE, "blob.mjs"), "del", url], capture_output=True, timeout=60)
    except Exception: pass


# ---------------------------------------------------------------- the move

def sidecar(cid):
    p = os.path.join(OUT, cid + ".json")
    try: return json.load(open(p, encoding="utf-8")), p
    except (OSError, ValueError): return {"id": cid}, p


def take_off(meta):
    """the stored files of one card go, best effort: for an orphan or a
    posted reel that is being retired"""
    if not isinstance(meta, dict): return
    if meta.get("store") == "release":
        for k in ("video_asset", "cover_asset"):
            try: release_delete(meta.get(k))
            except Exception: pass
    elif meta.get("store") == "blob":
        for k in ("video", "cover"): blob_delete(meta.get(k))


def move(dry=False):
    if not have_store():
        print("no store token (GITHUB_TOKEN or BLOB_READ_WRITE_TOKEN): the videos stay in reels/ this run")
        return 0
    if not os.path.isdir(OUT):
        print("no reels/ directory; nothing to move"); return 0
    try: plan = json.load(open(os.path.join(HERE, "plan.json"), encoding="utf-8"))["cards"]
    except (OSError, ValueError, KeyError): plan = None
    ids = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith(".mp4") and not f.endswith(".part.mp4"))
    moved, faults, left = 0, [], []
    for cid in ids:
        if plan is not None and cid not in plan:
            continue            # not a card any more: the manifest step takes it off the shelf
        if out_of_time():
            left.append(cid)
            continue
        kind = (plan or {}).get(cid, {}).get("kind", "light")
        mp4 = os.path.join(OUT, cid + ".mp4")
        cover = os.path.join(OUT, cid + "-cover.jpg")
        meta, path = sidecar(cid)
        if dry:
            print("  would move", cid, "to", STORE); continue
        try:
            if STORE == "blob":
                meta["video"] = blob_put(mp4, "reels/%s.mp4" % cid)
                if os.path.exists(cover): meta["cover"] = blob_put(cover, "reels/%s-cover.jpg" % cid)
                meta["store"] = "blob"
            else:
                meta["video"], meta["video_asset"] = release_put(mp4, kind, cid + ".mp4")
                # the cover is a hundred kilobytes and is read by the console and
                # the poster far more often than the video: it stays in the
                # repository unless asked to go too (REELS_STORE_COVERS=1), which
                # also keeps the upload count, and so the hours, in half
                if COVERS and os.path.exists(cover):
                    meta["cover"], meta["cover_asset"] = release_put(cover, kind, cid + "-cover.jpg")
                meta["store"] = "release"
            meta["bytes"] = os.path.getsize(mp4)
            meta["uploaded"] = time.strftime("%Y-%m-%d")
            meta.setdefault("id", cid)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=1)
            os.remove(mp4)
            if meta.get("cover") and os.path.exists(cover): os.remove(cover)
            moved += 1
            print("  moved", cid, meta["video"], flush=True)
        except Exception as e:
            # the video stays where it is; the manifest still lists it from
            # the local file, and the next run tries again
            faults.append((cid, str(e)[:200])); print("  KEPT", cid, e, flush=True)
    if left:
        for cid in left:
            for f in (cid + ".mp4", cid + "-cover.jpg"):
                try: os.remove(os.path.join(OUT, f))
                except OSError: pass
        print("  the clock: %d not uploaded this run and taken back off the shelf; "
              "they stay in the plan and are rendered again next run" % len(left), flush=True)
    print("%d moved to the %s store, %d kept in reels/, %d left to the next run"
          % (moved, STORE, len(faults), len(left)))
    return 1 if faults else 0


if __name__ == "__main__":
    sys.exit(move(dry="--dry" in sys.argv))
