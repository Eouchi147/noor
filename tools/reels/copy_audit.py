#!/usr/bin/env python3
"""Audit reel copy against the cards it came from.

The mechanical checks are the cheap half. The half that matters is provenance:
every number and every capitalised name in a script has to be findable in that
card's own text, because a reel is screenshotted and argued with.
"""
import json, os, re, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get("NOOR_LIGHTS") or os.path.join(HERE, "..", "..", "lights", "all.json")
SRC = {c["id"]: c for c in json.load(open(LIB))["lights"]}

OK_WORDS = set("""A An The In On At By For And But Not Now It Its He She They We You His Her Their
Every Each One Two Three Four Five Six Seven Eight Nine Ten Muslim Muslims Islam Islamic Allah
Prophet Qur Quran Arabic Europe European God Nobody Anyone Anybody Today When What Where Who Why How
North South East West""".split())

def norm(s):
    return unicodedata.normalize("NFKD", s).lower()

def nums(s):
    return set(re.findall(r"\d[\d,]*", s))

def names(s):
    """capitalised words that are doing the work of a proper noun.

    A word that opens a sentence is capitalised by grammar, not by being a
    name, so it is not evidence of anything and is skipped; possessives are
    stripped so Fihri's is checked as Fihri."""
    out = set()
    for m in re.finditer(r"[A-Z][A-Za-z'’\-]+", s):
        before = s[:m.start()].rstrip()
        if not before or before[-1] in ".!?:·": continue
        w = re.sub(r"[’']s$", "", m.group(0))
        if w not in OK_WORDS: out.add(w)
    return out

def audit(path):
    """accepts a batch out file, or plan.json, which nests the same shape"""
    doc = json.load(open(path))
    out = doc.get("cards", doc)
    out = {k: v for k, v in out.items() if not k.startswith("_")}
    bad = []
    for cid, v in out.items():
        src = SRC.get(cid)
        if not src: bad.append((cid, "unknown card")); continue
        hay = " ".join([src.get("s", ""), src.get("t", ""),
                        src.get("d", ""), src.get("c", "")])
        hay_n, hay_num, hay_name = norm(hay), nums(hay), names(hay)

        need = {"eyebrow", "hook", "key", "date", "lines", "caption"}
        if not need <= set(v): bad.append((cid, "missing " + str(need - set(v)))); continue
        if v["key"] not in v["hook"]: bad.append((cid, "key not in hook"))
        if len(v["lines"]) != 3: bad.append((cid, "not three lines"))
        for f, lim in (("eyebrow", 22), ("hook", 62), ("date", 46)):
            if len(v[f]) > lim: bad.append((cid, f"{f} {len(v[f])} > {lim}"))
        for i, l in enumerate(v["lines"]):
            if len(l) > 118: bad.append((cid, f"line {i} {len(l)} > 118"))
            if re.match(r"^(And|But)\b", l): bad.append((cid, f"line {i} opens with And/But"))
            if "..." in l or "…" in l: bad.append((cid, f"line {i} trails off"))

        screen = " ".join([v["eyebrow"], v["hook"], v["date"], *v["lines"]])
        for f in (screen, v["caption"]):
            if "—" in f or "–" in f: bad.append((cid, "em or en dash"))
        if re.search(r"[\U0001F300-\U0001FAFF☀-➿]", screen):
            bad.append((cid, "emoji on screen"))

        for n in nums(screen) - hay_num:
            if n.replace(",", "") not in {x.replace(",", "") for x in hay_num}:
                bad.append((cid, "number not in the card: " + n))
        for nm in names(screen) - hay_name:
            if norm(nm) not in hay_n: bad.append((cid, "name not in the card: " + nm))

        cap = v["caption"]
        if "noorcodex.com" not in cap: bad.append((cid, "caption has no link"))
        tg = re.findall(r"#\w+", cap)
        if "#NoorCodexOfLight" not in tg or "#Islam" not in tg:
            bad.append((cid, "caption is missing a house tag"))
        if not (6 <= len(tg) <= 12): bad.append((cid, f"{len(tg)} tags"))
        body = cap.split("Read the whole")[0].strip()
        if len(body) > 480: bad.append((cid, f"caption body {len(body)} > 480"))
        if v["hook"].lower() in norm(body): bad.append((cid, "caption repeats the hook"))
    return out, bad

if __name__ == "__main__":
    total, allbad = 0, []
    for p in sys.argv[1:]:
        out, bad = audit(p)
        total += len(out)
        print(f"{p}  {len(out)} cards  {len(bad)} findings")
        for cid, msg in bad: print("   ", cid, "·", msg)
        allbad += bad
    print(f"\n{total} cards, {len(allbad)} findings")
    sys.exit(1 if allbad else 0)
