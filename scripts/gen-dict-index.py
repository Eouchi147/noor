#!/usr/bin/env python3
# NOOR · the poster's copy of the Encyclopedia
# ---------------------------------------------------------------------------
# The daily "A WORD" post used to carry one line, because one line was all the
# menu index held. The full entries live in build/dict-*.json and are compiled
# into dictionary.html, which a serverless route should not be parsing.
#
# So this writes the one file the poster needs: every entry, with its long
# teaching text, keyed by id, as a static asset the api can fetch once.
# Same source of truth as the dictionary page itself, so the post and the room
# can never disagree.
#
#   python3 scripts/gen-dict-index.py     ->  assets/dict-index.json
import json, glob, io, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

CATNAME = {"aqidah": "Belief", "ibadah": "Worship", "quran": "The Qur'an",
           "hadith": "Hadith", "fiqh": "Law and life", "tazkiyah": "The heart",
           "tarikh": "History"}

out, seen = {}, set()
for f in sorted(glob.glob(os.path.join(ROOT, "build", "dict-*.json"))):
    try:
        data = json.load(io.open(f, encoding="utf-8"))
    except Exception as e:
        print("  ! skipping %s: %s" % (os.path.basename(f), e))
        continue
    for e in data:
        i = re.sub(r"[^a-z0-9-]", "", str(e.get("id", "")).lower())
        if not i or i in seen:
            continue
        if not e.get("term") or not e.get("short"):
            continue
        seen.add(i)
        rec = {"t": e["term"], "a": e.get("ar", ""),
               "cat": CATNAME.get(e.get("cat"), "Belief"),
               "k": e.get("k") if e.get("k") in ("quran", "sunnah", "debated", "editorial") else "editorial",
               "s": e["short"]}
        if e.get("long"):
            rec["l"] = e["long"]
        out[i] = rec

path = os.path.join(ROOT, "assets", "dict-index.json")
json.dump({"v": 1, "words": out}, io.open(path, "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
size = os.path.getsize(path)
withlong = sum(1 for r in out.values() if "l" in r)
print("dict-index: %d entries (%d with a long text), %d KB -> assets/dict-index.json"
      % (len(out), withlong, size // 1024))
