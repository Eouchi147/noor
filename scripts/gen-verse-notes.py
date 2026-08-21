#!/usr/bin/env python3
"""
Build the verse-by-verse layer of the Mushaf.

Six thousand two hundred and thirty six verses will not be written in a day.
This script exists so that the room can be finished now and the writing can
arrive one tranche at a time, without a single line of the page changing again.

Sources (all under build/):
  verse-notes-a.json   the first tranche
  verse-notes-b.json   and so on, as they are written

Each tranche is:

  {"tranche": "a",
   "surahs": [
     {"n": 1,
      "verses": {
        "1": {
          "words": [{"a": "بِسْمِ", "t": "bismi", "g": "in the name of"}, ...],
          "sense": "one plain paragraph: what the verse says",
          "notes": [{"t": "...", "lvl": "quran|sunnah|debated|editorial",
                     "src": "Bukhari 7"}],
          "links": [{"ref": "27:30", "why": "..."}]
        }
      }}]}

Only "sense" is required. A verse with nothing honest to say about it should
not have a record at all: the page says so plainly rather than padding.

The evidence levels are the same four the teaching rooms use, and they mean the
same four things:

  quran      the claim is the Qur'an's own, stated in the text
  sunnah     an authentic report establishes it
  debated    scholars, readings or gradings differ, and we say so
  editorial  our own reading, offered as a reading and not as proof

Output:
  /verse/index.json    {"have": {"1": [1,...]}, ...}  which verses are written
  /verse/<n>.json      {"n": 1, "v": {"1": {...}}}    one file per surah

The index exists so the reader is never shown an expander that opens on an
apology. A verse with no note gets no button.

Run:  python3 scripts/gen-verse-notes.py
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
OUT = os.path.join(ROOT, "verse")

LEVELS = {"quran", "sunnah", "debated", "editorial"}
REF = re.compile(r"^(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$")
ARABIC = re.compile(r"[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]")


def tranches():
    names = sorted(f for f in os.listdir(BUILD)
                   if f.startswith("verse-notes-") and f.endswith(".json"))
    if not names:
        sys.exit("no verse-notes-*.json tranches in build/")
    return names


def surah_table():
    """Names and ayah counts come from the one place that already holds them."""
    html = open(os.path.join(ROOT, "quran.html"), encoding="utf-8").read()
    m = re.search(r"const SURAHS=(\[\[.*?\]\]);", html, re.S)
    if not m:
        sys.exit("SURAHS array not found in quran.html")
    rows = json.loads(m.group(1))
    return {r[0]: {"name": r[1], "count": r[4]} for r in rows}


def fail(errs, where, msg):
    errs.append("%s: %s" % (where, msg))


def check_verse(errs, where, rec, count, table):
    if not isinstance(rec, dict):
        return fail(errs, where, "record is not an object")

    unknown = set(rec) - {"words", "sense", "notes", "links"}
    if unknown:
        fail(errs, where, "unknown keys %s" % sorted(unknown))

    sense = rec.get("sense")
    if not isinstance(sense, str) or len(sense.strip()) < 40:
        fail(errs, where, "sense must be a real paragraph, at least 40 characters")

    for i, w in enumerate(rec.get("words") or []):
        w_where = "%s word %d" % (where, i + 1)
        if not isinstance(w, dict):
            fail(errs, w_where, "not an object"); continue
        for k in ("a", "t", "g"):
            if not isinstance(w.get(k), str) or not w[k].strip():
                fail(errs, w_where, "missing %r" % k)
        if isinstance(w.get("a"), str) and not ARABIC.search(w["a"]):
            fail(errs, w_where, "'a' carries no Arabic letters")

    notes = rec.get("notes") or []
    if not isinstance(notes, list):
        fail(errs, where, "notes must be a list")
        notes = []
    for i, nt in enumerate(notes):
        n_where = "%s note %d" % (where, i + 1)
        if not isinstance(nt, dict):
            fail(errs, n_where, "not an object"); continue
        if nt.get("lvl") not in LEVELS:
            fail(errs, n_where, "lvl %r is not one of %s" % (nt.get("lvl"), sorted(LEVELS)))
        if not isinstance(nt.get("t"), str) or len(nt["t"].strip()) < 25:
            fail(errs, n_where, "note text is too short to be a claim")
        # A sunnah badge is a promise that a report stands behind it. Make the
        # page keep that promise: no source, no badge.
        if nt.get("lvl") in ("sunnah", "debated") and not str(nt.get("src", "")).strip():
            fail(errs, n_where, "lvl %r requires a src naming the report or the difference" % nt["lvl"])

    for i, ln in enumerate(rec.get("links") or []):
        l_where = "%s link %d" % (where, i + 1)
        if not isinstance(ln, dict):
            fail(errs, l_where, "not an object"); continue
        m = REF.match(str(ln.get("ref", "")))
        if not m:
            fail(errs, l_where, "ref %r is not N:V or N:V-W" % ln.get("ref")); continue
        s, a, b = int(m.group(1)), int(m.group(2)), m.group(3)
        if s not in table:
            fail(errs, l_where, "surah %d does not exist" % s); continue
        if not (1 <= a <= table[s]["count"]):
            fail(errs, l_where, "%d:%d is past the end of %s (%d verses)"
                 % (s, a, table[s]["name"], table[s]["count"]))
        if b and not (a <= int(b) <= table[s]["count"]):
            fail(errs, l_where, "range end %s is out of order or past the end" % b)
        if not isinstance(ln.get("why"), str) or len(ln["why"].strip()) < 10:
            fail(errs, l_where, "a link without a reason is a dead end; add 'why'")


def main():
    table = surah_table()
    errs = []
    book = {}       # n -> {verse str -> record}
    seen_from = {}  # (n, v) -> tranche, so a rewrite is never silent

    for name in tranches():
        with open(os.path.join(BUILD, name), encoding="utf-8") as f:
            data = json.load(f)
        for s in data.get("surahs", []):
            n = s.get("n")
            if n not in table:
                fail(errs, name, "surah %r does not exist" % n); continue
            count = table[n]["count"]
            verses = s.get("verses") or {}
            for key in sorted(verses, key=lambda k: int(k) if str(k).isdigit() else 0):
                if not str(key).isdigit():
                    fail(errs, "%s %d" % (name, n), "verse key %r is not a number" % key); continue
                v = int(key)
                if not (1 <= v <= count):
                    fail(errs, "%s %s" % (name, table[n]["name"]),
                         "verse %d is past the end (%d verses)" % (v, count)); continue
                where = "%s %s:%d" % (name, table[n]["name"], v)
                if (n, v) in seen_from:
                    fail(errs, where, "already written in %s" % seen_from[(n, v)]); continue
                seen_from[(n, v)] = name
                check_verse(errs, where, verses[key], count, table)
                book.setdefault(n, {})[str(v)] = verses[key]

    if errs:
        print("The verse layer was not written. %d problem(s):\n" % len(errs))
        for e in errs:
            print("  " + e)
        sys.exit(1)

    if not os.path.isdir(OUT):
        os.makedirs(OUT)
    # Files for surahs that are no longer written must not linger.
    for f in os.listdir(OUT):
        if f.endswith(".json"):
            os.remove(os.path.join(OUT, f))

    have = {}
    total = 0
    for n in sorted(book):
        verses = book[n]
        have[str(n)] = sorted(int(k) for k in verses)
        total += len(verses)
        with open(os.path.join(OUT, "%d.json" % n), "w", encoding="utf-8") as f:
            json.dump({"n": n, "v": verses}, f, ensure_ascii=False, separators=(",", ":"))

    index = {"have": have, "surahs": len(have), "verses": total}
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))

    idx_kb = os.path.getsize(os.path.join(OUT, "index.json")) / 1024.0
    print("verse layer written")
    print("  %d verses across %d surahs" % (total, len(have)))
    for n in sorted(book):
        print("    %-16s %d of %d" % (table[n]["name"], len(book[n]), table[n]["count"]))
    print("  index.json %.1fKB, fetched once per visit" % idx_kb)
    print("  %d of 6236 verses written (%.2f%%)" % (total, total / 6236.0 * 100))


if __name__ == "__main__":
    main()
