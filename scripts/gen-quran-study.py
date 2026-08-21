#!/usr/bin/env python3
"""
Build the study companion for all 114 surahs.

Output is /study/<n>.json, one small file per surah, fetched by the Mushaf the
first time a reader opens that surah's companion. A browsable copy of the whole
thing is also written to build/quran-study.js; nothing on the site loads it.

Sources (all under build/):
  study-deep-a.json   19 surahs, rich records
  study-deep-b.json   23 surahs, rich records
  study-deep-c.json    8 surahs, promoted from short to rich
  study-deep-d.json    7 surahs, promoted from short to rich
  study-deep-e.json    6 surahs, promoted from short to rich
  study-deep-f.json   45 surahs, written in parallel and audited
  study-deep-g.json    6 surahs, the batch the parallel run dropped
  study-light.json    72 surahs, short records. Every one of them is now
                      superseded by a deep tranche; the file is kept so that
                      withdrawing a tranche can never open a gap.

A surah that appears in a deep tranche AND in the light file is taken from the
deep tranche. The light file deliberately keeps its record, so that withdrawing
a tranche can never open a gap.

Output is one plain script that sets window.NOOR_STUDY, one record per line,
each preceded by a comment naming the surah so the file stays browsable.
Every record carries depth:"deep" or depth:"light".

Run:  python3 scripts/gen-quran-study.py
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
OUT = os.path.join(BUILD, "quran-study.js")   # browsable copy, not served
DEEP_FILES = ["study-deep-a.json", "study-deep-b.json",
              "study-deep-c.json", "study-deep-d.json",
              "study-deep-e.json", "study-deep-f.json", "study-deep-g.json"]
LIGHT_FILE = "study-light.json"

DEEP_KEYS = ["context", "name_story", "movements", "themes", "heart",
             "passages", "connections", "virtue"]
LIGHT_KEYS = ["context", "themes", "heart", "passage"]
# "none" is not an absence of data. It is a claim: we looked, and no
# authentic report establishes a merit for this surah. Saying that plainly
# is worth more than reaching for a weak report to fill the space.
LEVELS = {"sunnah", "debated", "none"}


def load(name):
    with open(os.path.join(BUILD, name), encoding="utf-8") as f:
        return json.load(f)["surahs"]


def surah_table():
    """The single source of truth for names and ayah counts lives in quran.html."""
    html = open(os.path.join(ROOT, "quran.html"), encoding="utf-8").read()
    m = re.search(r"const SURAHS=(\[\[.*?\]\]);", html, re.S)
    if not m:
        sys.exit("SURAHS array not found in quran.html")
    return {r[0]: {"en": r[1], "count": r[4], "place": r[5]} for r in json.loads(m.group(1))}


def parse_range(text):
    a, _, b = str(text).partition("-")
    a = int(a)
    return a, (int(b) if b else a)


def check(records, table):
    """Fail loudly rather than ship a companion that points at verses that do not exist."""
    problems = []
    for rec in records.values():
        n = rec["n"]
        info = table[n]
        for mv in rec.get("movements", []):
            a, b = parse_range(mv["range"])
            if a < 1 or a > b or b > info["count"]:
                problems.append("surah %d: movement %s outside 1..%d" % (n, mv["range"], info["count"]))
        refs = [p["ref"] for p in rec.get("passages", [])]
        if rec.get("passage"):
            refs.append(rec["passage"]["ref"])
        for ref in refs:
            # A passage may cite a single ayah or a range. Ranges are not a
            # convenience: 2:285-286 is the correct citation for the two closing
            # verses, and forcing it apart would make the reference less true.
            m = re.fullmatch(r"(\d+):(\d+)(?:-(\d+))?", ref)
            if not m:
                problems.append("surah %d: passage ref %r is not surah:ayah or surah:from-to" % (n, ref))
                continue
            sura = int(m.group(1))
            first = int(m.group(2))
            last = int(m.group(3)) if m.group(3) else first
            if sura != n:
                problems.append("surah %d: passage ref %s names a different surah" % (n, ref))
            elif not (1 <= first <= last <= info["count"]):
                problems.append("surah %d: passage ref %s does not land in this surah" % (n, ref))
        for con in rec.get("connections", []):
            if not 1 <= int(con["to"]) <= 114:
                problems.append("surah %d: connection to %r" % (n, con["to"]))
        virtue = rec.get("virtue")
        if virtue and virtue.get("level") not in LEVELS:
            problems.append("surah %d: virtue level %r is not sunnah, debated or none" % (n, virtue.get("level")))
    return problems


def build():
    table = surah_table()
    records = {}

    for name in DEEP_FILES:
        for rec in load(name):
            n = int(rec["n"])
            if n in records:
                sys.exit("surah %d appears twice" % n)
            out = {"n": n, "depth": "deep"}
            for k in DEEP_KEYS:
                if rec.get(k):
                    out[k] = rec[k]
            records[n] = out

    for rec in load(LIGHT_FILE):
        n = int(rec["n"])
        if n in records:
            # A surah promoted into a deep tranche keeps its short record in
            # study-light.json, because that file is the complete 114 and
            # trimming it would leave gaps if a tranche were ever withdrawn.
            # The deep record simply wins.
            continue
        out = {"n": n, "depth": "light"}
        for k in LIGHT_KEYS:
            if rec.get(k):
                out[k] = rec[k]
        records[n] = out

    missing = sorted(set(range(1, 115)) - set(records))
    if missing:
        sys.exit("no study record for surahs: %s" % missing)

    problems = check(records, table)
    if problems:
        for p in problems:
            print("  ! " + p)
        sys.exit("%d data problems, nothing written" % len(problems))

    deep = sum(1 for r in records.values() if r["depth"] == "deep")
    lines = [
        "/* NOOR Codex of Light, the Qur'an study companions.",
        "   %d surahs: %d opened in full, %d opened in brief." % (len(records), deep, len(records) - deep),
        "   Generated by scripts/gen-quran-study.py from the study-deep-*.json",
        "   tranches and build/study-light.json. Do not edit by hand.",
        "   Loaded deferred: the Mushaf reads perfectly without it. */",
        "window.NOOR_STUDY = {",
    ]
    for n in range(1, 115):
        rec = records[n]
        info = table[n]
        body = json.dumps(rec, ensure_ascii=False, separators=(",", ":"), sort_keys=False)
        lines.append("/* %d %s, %s, %d ayat */" % (n, info["en"], rec["depth"], info["count"]))
        lines.append("%d:%s%s" % (n, body, "," if n < 114 else ""))
    lines.append("};")
    lines.append("")

    text = "\n".join(lines)
    for bad in ("—", "–", "‒", "―"):
        if bad in text:
            sys.exit("a long dash slipped into the data, house style forbids it")
    # ---- one file per surah, fetched on demand ---------------------------
    # The single bundle had grown to six hundred kilobytes and was downloaded by
    # every visitor to the Mushaf, including the large majority who never open a
    # companion at all. It is emitted one surah at a time now, roughly five
    # kilobytes each, so a reader pays only for the surah they actually open.
    #
    # The bundle itself is written to build/ rather than to the site root. It is
    # the browsable form, useful for reading the whole companion at once and for
    # diffing a tranche, and it is no longer something a visitor can download by
    # accident. Nothing on the site loads it.
    split_dir = os.path.join(ROOT, "study")
    os.makedirs(split_dir, exist_ok=True)
    total = 0
    for n, rec in records.items():
        blob = json.dumps(rec, ensure_ascii=False, separators=(",", ":"))
        with open(os.path.join(split_dir, "%d.json" % n), "w", encoding="utf-8") as g:
            g.write(blob)
        total += len(blob.encode("utf-8"))
    print("wrote study/1.json .. study/114.json: %d KB total, %d KB average"
          % (total // 1024, total // len(records) // 1024))

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    print("wrote %s: %d records (%d deep, %d light), %d bytes"
          % (OUT, len(records), deep, len(records) - deep, len(text.encode("utf-8"))))


if __name__ == "__main__":
    build()
