#!/usr/bin/env python3
"""NOOR i18n · audit the language packs for misaligned translations.

    python3 scripts/i18n-audit.py            every language
    python3 scripts/i18n-audit.py es de ru   only these

A translation is checked against its English string with signals that need no
knowledge of the language: the digits it carries (an ayah reference or a year
must survive translation), its length against the French pack (French is
complete and verified, so a value three times longer or shorter than the French
of the same string is almost never a translation of it), and identity (a string
that is only a reference is copied through and reads the same in every language).

The report per language: how many strings are verifiably right, how many are
verifiably wrong, how many could not be judged. Positions are indexes into the
corpus order of i18n/text/en.json; a run of wrong strings at consecutive
positions means a batch was merged out of order, which is what happened to the
Spanish, German and Russian packs before 2 Sep 2026.
"""
import io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = os.path.join(ROOT, "i18n", "text")
SKIP = {"en", "qa", "priority", "ui-delta", "ui-en"}
LATIN = {"es", "de", "ru", "fr", "tr", "id", "sw", "ha", "so", "ku"}   # scripts whose length tracks French

def digs(s):
    s = s.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789"))
    return tuple(sorted(re.findall(r"\d+", s.replace(",", "").replace(".", "").replace(" ", "").replace(" ", ""))))

def load(code):
    return json.load(io.open(os.path.join(T, code + ".json"), encoding="utf-8"))["s"]

def audit(code, en, fr, idx):
    p = load(code)
    good, bad, unk, same = 0, [], 0, 0
    for k, v in p.items():
        e = en.get(k)
        if e is None: continue
        if e.strip() == v.strip(): same += 1; continue
        d = digs(e)
        if d and len("".join(d)) >= 2 and not re.search(r"\d:\d\d\s?[AP]M", e):
            dv = digs(v)
            if d == dv: good += 1; continue
            if dv: bad.append(k); continue      # both carry digits and they differ
            # no digit at all in the translation: a spelled-out number or a Roman century; not judged
        f = fr.get(k) if code != "fr" else None
        if f and len(f) >= 40 and code in LATIN:
            r = len(v) / len(f)
            if r < 0.35 or r > 2.8: bad.append(k); continue
        unk += 1
    print("%-4s %5d entries · right %5d · wrong %4d · unjudged %5d · copied through %4d"
          % (code, len(p), good, len(bad), unk, same))
    if bad:
        pos = sorted(idx[k] for k in bad)
        runs, s, prev = [], pos[0], pos[0]
        for x in pos[1:]:
            if x - prev > 40: runs.append((s, prev)); s = x
            prev = x
        runs.append((s, prev))
        runs = [r for r in runs if r[1] - r[0] >= 20]
        if runs: print("     runs of wrong strings at corpus positions:", ", ".join("%d-%d" % r for r in runs))
        for k in bad[:3]:
            print("     e.g. %r -> %r" % (en[k][:60], p[k][:60]))

def main():
    en = load("en"); idx = {k: i for i, k in enumerate(en)}
    fr = load("fr")
    codes = sys.argv[1:] or sorted(f[:-5] for f in os.listdir(T) if f.endswith(".json") and f[:-5] not in SKIP)
    for c in codes:
        audit(c, en, fr, idx)

if __name__ == "__main__":
    main()
