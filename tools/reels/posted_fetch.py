#!/usr/bin/env python3
"""What has already been posted, from the site's own ledger.

The poster keeps a ledger of the reels every network has taken (reel id to
the date the slot went out), and answers it at

    https://noorcodex.com/api/social?action=posted

with a margin of a few days, so a slot the healer is still mending or a
story a network is still processing is not on it yet. This script copies
that answer into posted.json beside the plan. plan_build.py reads the file
and leaves those cards out of the plan; a card out of the plan is taken off
the shelf by render_missing.py, video, sidecar and store asset together.
That is the whole of "a reel leaves the shelf once every network has it":
one ledger, one file, and a rule that already existed.

The file only ever grows. If the site cannot be reached, or answers
something that is not the ledger, the old file is kept and the run says so:
a missed week delays a retirement, which costs nothing; an emptied file
would put every posted reel back on the shelf, which is the one thing this
must never do.

    python3 posted_fetch.py            refresh posted.json from the site
    NOOR_SITE=https://...              another host (a preview deployment)
"""
import json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
FILE = os.path.join(HERE, "posted.json")
SITE = os.environ.get("NOOR_SITE", "https://noorcodex.com").rstrip("/")


def load():
    try:
        d = json.load(open(FILE, encoding="utf-8"))
        return d if isinstance(d, dict) and isinstance(d.get("posted"), dict) else {"posted": {}}
    except (OSError, ValueError):
        return {"posted": {}}


def fetch():
    req = urllib.request.Request(SITE + "/api/social?action=posted",
                                 headers={"User-Agent": "NOOR reels", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def main():
    old = load()
    try:
        j = fetch()
    except Exception as e:
        print("the ledger could not be read (%s); posted.json kept as it was, %d reel(s)"
              % (str(e)[:120], len(old["posted"])))
        return 0
    if not (isinstance(j, dict) and j.get("ok") and isinstance(j.get("posted"), dict)):
        print("the site did not answer with the ledger; posted.json kept as it was, %d reel(s)" % len(old["posted"]))
        return 0
    posted = dict(old["posted"])
    new = 0
    for cid, day in j["posted"].items():
        if not isinstance(cid, str) or not isinstance(day, str): continue
        if cid not in posted: new += 1
        posted[cid] = day
    doc = {"_note": "reels every network has taken, id to date, from %s/api/social?action=posted; "
                    "plan_build.py leaves them out of the plan and the shelf lets them go. "
                    "This file only grows." % SITE,
           "fetched": time.strftime("%Y-%m-%d"), "n": len(posted),
           "posted": dict(sorted(posted.items()))}
    with open(FILE, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print("posted.json: %d reel(s) on the ledger, %d new since last time" % (len(posted), new))
    return 0


if __name__ == "__main__":
    sys.exit(main())
