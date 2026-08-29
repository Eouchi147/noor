#!/usr/bin/env python3
"""
Build the Illuminations Library.

Today's Light used to come from fourteen written cards, chosen by
`dayIndexOf(today) % 14`. That is not a rotation, it is a fortnight on a loop,
and a daily reader saw the same card twenty six times a year. This library is
the answer: hundreds of cards, each one anchored to the calendar where it has a
real anchor, and a picker that remembers what it has already shown.

Sources: build/lights-*.json, one tranche per writer.

Output:
  /lights/all.json     every card, compact, read once by the server
  /lights/index.json   the counts and the calendar coverage, for the console

The validator refuses to write on:
  a duplicate id, an impossible date, a story too short or too long to be a
  card, a citation level with no source, an em dash, a banned word, and any
  entry claiming a day it has no year for.

Run:  python3 scripts/gen-lights.py
"""
import json, os, re, sys, hashlib
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
OUT = os.path.join(ROOT, "lights")

KINDS = {"onthisday", "science", "founder", "book", "place",
         "practice", "word", "companion", "sign", "number"}
LEVELS = {"quran", "sunnah", "debated", "editorial"}
BANNED = re.compile(r"\b(profound|beautiful|amazing|journey|deeply|truly|powerful|"
                    r"transformative|incredible|mind-?blowing)\b", re.I)
DASH = re.compile(r"[—–]")
DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def tranches():
    names = sorted(f for f in os.listdir(BUILD)
                   if f.startswith("lights-") and f.endswith(".json"))
    if not names:
        sys.exit("no lights-*.json tranches in build/")
    return names


def main():
    errs, lights, seen = [], [], {}

    def bad(where, msg):
        errs.append("%s: %s" % (where, msg))

    for name in tranches():
        with open(os.path.join(BUILD, name), encoding="utf-8") as f:
            data = json.load(f)
        for i, L in enumerate(data.get("lights", [])):
            w = "%s #%d %s" % (name, i + 1, str(L.get("id", "?"))[:40])
            if not isinstance(L, dict):
                bad(w, "not an object"); continue

            lid = str(L.get("id", "")).strip()
            if not re.match(r"^[a-z0-9][a-z0-9-]{3,60}$", lid):
                bad(w, "id must be lowercase kebab, 4 to 61 chars"); continue
            if lid in seen:
                bad(w, "duplicate id, first seen in %s" % seen[lid]); continue
            seen[lid] = name

            if L.get("kind") not in KINDS:
                bad(w, "kind %r is not one of %s" % (L.get("kind"), sorted(KINDS)))
            lvl = L.get("lvl", "editorial")
            if lvl not in LEVELS:
                bad(w, "lvl %r is not one of %s" % (lvl, sorted(LEVELS)))
            if lvl in ("quran", "sunnah", "debated") and not str(L.get("src", "")).strip():
                bad(w, "lvl %r requires a src" % lvl)

            title = str(L.get("title", "")).strip()
            if not (12 <= len(title) <= 90):
                bad(w, "title is %d chars, wanted 12 to 90" % len(title))
            if ":" in title:
                bad(w, "title carries a colon")

            story = str(L.get("story", "")).strip()
            words = len(story.split())
            if not (60 <= words <= 190):
                bad(w, "story is %d words, wanted 60 to 190" % words)

            detail = str(L.get("detail", "")).strip()
            if len(detail) > 64:
                bad(w, "detail is %d chars, wanted under 64" % len(detail))

            blob = " ".join([title, story, detail, str(L.get("category", ""))])
            if DASH.search(blob):
                bad(w, "a long dash; house style forbids it")
            m = BANNED.search(blob)
            if m:
                bad(w, "banned word %r" % m.group(0))
            if "!" in blob:
                bad(w, "an exclamation mark")

            when = L.get("when") or None
            if when is not None:
                if not isinstance(when, dict) or "y" not in when:
                    bad(w, "when must be an object carrying at least a year")
                else:
                    y = when.get("y")
                    if not isinstance(y, int) or not (-3000 <= y <= 2100):
                        bad(w, "year %r is not a year" % y)
                    mm, dd = when.get("m"), when.get("d")
                    if dd is not None and mm is None:
                        bad(w, "a day with no month")
                    if mm is not None:
                        if not isinstance(mm, int) or not (1 <= mm <= 12):
                            bad(w, "month %r out of range" % mm)
                        elif dd is not None:
                            if not isinstance(dd, int) or not (1 <= dd <= DAYS[mm - 1]):
                                bad(w, "day %r impossible in month %d" % (dd, mm))
            hij = L.get("hijri") or None
            if hij is not None:
                hm, hd = hij.get("m"), hij.get("d")
                if not isinstance(hm, int) or not (1 <= hm <= 12):
                    bad(w, "hijri month %r out of range" % hm)
                if hd is not None:
                    if not isinstance(hd, int) or not (1 <= hd <= 30):
                        bad(w, "hijri day %r out of range" % hd)
                    elif not isinstance(hm, int):
                        bad(w, "a hijri day with no hijri month")

            tags = L.get("tags") or []
            if not isinstance(tags, list) or len(tags) > 5:
                bad(w, "tags must be a list of at most 5")

            rec = {"id": lid, "k": L["kind"] if L.get("kind") in KINDS else "science",
                   "c": str(L.get("category", "")).strip()[:26],
                   "t": title, "s": story, "d": detail,
                   "lvl": lvl, "tags": [str(t).lower()[:20] for t in tags]}
            if L.get("src"): rec["src"] = str(L["src"])[:140]
            if when: rec["w"] = {k: v for k, v in when.items() if v is not None}
            if hij:
                rec["h"] = hij.get("m")
                if hij.get("d"): rec["hd"] = hij["d"]
            lights.append(rec)

    if errs:
        print("The library was not written. %d problem(s):\n" % len(errs))
        for e in errs[:60]:
            print("  " + e)
        if len(errs) > 60:
            print("  ... and %d more" % (len(errs) - 60))
        sys.exit(1)

    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith(".json"):
            os.remove(os.path.join(OUT, f))

    with open(os.path.join(OUT, "all.json"), "w", encoding="utf-8") as f:
        json.dump({"n": len(lights), "lights": lights}, f,
                  ensure_ascii=False, separators=(",", ":"))

    kinds = Counter(l["k"] for l in lights)
    lvls = Counter(l["lvl"] for l in lights)
    dated = [l for l in lights if l.get("w", {}).get("m")]
    exact = [l for l in lights if l.get("w", {}).get("d")]
    cal = Counter(l["w"]["m"] for l in dated)
    seasonal = Counter(l["h"] for l in lights if l.get("h"))
    hdays = [l for l in lights if l.get("hd")]

    index = {"n": len(lights), "kinds": dict(kinds), "levels": dict(lvls),
             "dated": len(dated), "exact": len(exact), "hdays": len(hdays),
             "months": {str(k): v for k, v in sorted(cal.items())},
             "hijri": {str(k): v for k, v in sorted(seasonal.items())},
             "built": True}
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))

    kb = os.path.getsize(os.path.join(OUT, "all.json")) / 1024.0
    print("the library is written")
    print("  %d lights, %.0fKB, read once per server start" % (len(lights), kb))
    print("  kinds: " + ", ".join("%s %d" % kv for kv in kinds.most_common()))
    print("  levels: " + ", ".join("%s %d" % kv for kv in lvls.most_common()))
    print("  %d carry a month, %d carry an exact day" % (len(dated), len(exact)))
    print("  %d carry an exact day in the Islamic calendar" % len(hdays))
    print("  seasonal anchors: " + (", ".join("hijri %s: %d" % kv for kv in sorted(seasonal.items())) or "none"))
    print("  a daily reader now sees a repeat after %d days, not 14" % len(lights))


if __name__ == "__main__":
    main()
