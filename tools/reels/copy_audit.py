#!/usr/bin/env python3
"""Audit reel copy against the cards it came from.

The mechanical checks are the cheap half. The half that matters is provenance:
every number and every capitalised name in a script has to be findable in that
card's own text, because a reel is screenshotted and argued with.
"""
import json, os, re, sys, unicodedata

import library

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get("NOOR_ROOT") or os.path.join(HERE, "..", "..")
LIB = os.environ.get("NOOR_LIGHTS") or os.path.join(ROOT, "lights", "all.json")
SRC = {c["id"]: c for c in json.load(open(LIB))["lights"]}

TAG_FLOOR = {"light": 6, "know": 5, "word": 4, "day": 4, "verse": 3,
             "name": 4, "dua": 4}


def _dict():
    """the dictionary, id -> entry, from the build JSON the site is built from"""
    import glob
    out = {}
    for f in glob.glob(os.path.join(ROOT, "build", "dict-*.json")):
        for e in json.load(open(f, encoding="utf-8")):
            out[e["id"]] = e
    return out


def _calendar():
    try: return json.load(open(os.path.join(HERE, "calendar.json"), encoding="utf-8"))
    except FileNotFoundError: return {"FIXED": {}, "MONTHS": {}}


def _verses():
    try: return json.load(open(os.path.join(HERE, "verses.json"), encoding="utf-8")).get("verses", {})
    except FileNotFoundError: return {}


def haystack(cid, v, D, CAL, VER):
    """the text a card of this kind may draw from, or None if there is none"""
    kind = v.get("kind", "light")
    if kind in ("light", "know"):
        src = SRC.get(v.get("src") or cid)
        if not src: return None
        return " ".join([src.get("s", ""), src.get("t", ""), src.get("d", ""), src.get("c", "")])
    if kind == "word":
        e = D.get(v.get("src") or "")
        if not e: return None
        return " ".join([e.get("term", ""), e.get("ar", ""), e.get("short", ""), e.get("long", ""),
                         " ".join(e.get("also", []))])
    if kind == "day":
        key = v.get("src") or ""
        f = CAL["FIXED"].get(key) or CAL["MONTHS"].get(key.replace("month-", ""))
        if not f: return None
        return " ".join([f.get("name", ""), f.get("what", ""), " ".join(f.get("todo", []) or []),
                         f.get("basis", ""), f.get("note", ""), str(v.get("hd", "")), str(v.get("num", "")),
                         "Muharram Safar Rabi al-Awwal Rabi al-Akhir "
                         "Jumada al-Ula Jumada al-Akhirah Rajab Sha'ban Ramadan Shawwal Dhul Qa'dah Dhul Hijjah"])
    if kind == "name":
        e = library.names().get(v.get("src") or "")
        if not e: return None
        return " ".join([e["ar"], e["translit"], e["meaning"], e["root"], e["gloss"],
                         e["essay"], e["verse_en"], e["action"]])
    if kind == "dua":
        e = library.duas().get(v.get("src") or "")
        if not e: return None
        return " ".join([e["ar"], e["translit"], e["meaning"], e["role"],
                         e["summary"], e["title"]])
    if kind == "verse":
        import re as _re
        m = _re.fullmatch(r"(\d+):(\d+)(?:-(\d+))?", str(v.get("verse", "")))
        if not m: return None
        s, a, b = int(m.group(1)), int(m.group(2)), int(m.group(3) or m.group(2))
        parts = [VER.get("%d:%d" % (s, n), {}).get("text", "") for n in range(a, b + 1)]
        if not all(parts): return ""     # the translation is fetched by the workflow before the audit
        return " ".join(parts + [VER["%d:%d" % (s, a)].get("surah", "")])
    return None

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
    D, CAL, VER = _dict(), _calendar(), _verses()
    for cid, v in out.items():
        kind = v.get("kind", "light")
        hay = haystack(cid, v, D, CAL, VER)
        if hay is None: bad.append((cid, "unknown source for a %s card" % kind)); continue
        if hay == "": continue          # a verse whose translation is not fetched yet
        hay_n, hay_num, hay_name = norm(hay), nums(hay), names(hay)

        if kind in ("light", "know"):
            need = {"eyebrow", "hook", "key", "date", "lines", "caption"}
            if not need <= set(v): bad.append((cid, "missing " + str(need - set(v)))); continue
            if v["key"] not in v["hook"]: bad.append((cid, "key not in hook"))
            want = 3 if kind == "light" else 1
            if len(v["lines"]) != want: bad.append((cid, "not %s line%s" % (want, "s" if want > 1 else "")))
            for f, lim in (("eyebrow", 22), ("hook", 62), ("date", 46)):
                if len(v[f]) > lim: bad.append((cid, f"{f} {len(v[f])} > {lim}"))
            lines = v["lines"]
            screen = " ".join([v["eyebrow"], v["hook"], v["date"], *lines])
        elif kind == "day":
            need = {"num", "month", "hook", "key", "lines", "caption", "hm", "hd"}
            if not need <= set(v): bad.append((cid, "missing " + str(need - set(v)))); continue
            if v["key"] not in v["hook"]: bad.append((cid, "key not in hook"))
            if not (1 <= len(v["lines"]) <= 2): bad.append((cid, "a day card carries one or two lines"))
            if len(v["hook"]) > 62: bad.append((cid, f"hook {len(v['hook'])} > 62"))
            if v.get("todo") and len(v["todo"]) > 96: bad.append((cid, "todo too long"))
            lines = v["lines"]
            screen = " ".join([v["hook"], *lines, v.get("todo", "")])
        elif kind == "word":
            need = {"ar", "term", "short", "caption", "src"}
            if not need <= set(v): bad.append((cid, "missing " + str(need - set(v)))); continue
            e = D[v["src"]]
            if v["short"] != e["short"]: bad.append((cid, "short is not the dictionary's own"))
            if v.get("long") and v["long"] not in e.get("long", ""): bad.append((cid, "long is not from the dictionary"))
            if v["ar"] != e["ar"] or v["term"] != e["term"]: bad.append((cid, "ar/term differ from the dictionary"))
            if len(v["short"]) > 150: bad.append((cid, f"short {len(v['short'])} > 150"))
            if len(v.get("long", "")) > 150: bad.append((cid, f"long {len(v['long'])} > 150"))
            lines = [v["short"], v.get("long", "")]
            screen = " ".join([v["term"], *lines])
        elif kind == "verse":
            need = {"verse", "caption"}
            if not need <= set(v): bad.append((cid, "missing " + str(need - set(v)))); continue
            lines = []
            screen = ""
        elif kind in ("name", "dua"):
            # Nothing on a Name or a du'a reel is written here: the Arabic, the
            # transliteration and the meaning must be the page's own, character
            # for character, and the one sentence of substance must be a piece
            # of that entry's own prose, lifted whole and not paraphrased.
            need = {"ar", "translit", "meaning", "caption", "src"}
            if not need <= set(v): bad.append((cid, "missing " + str(need - set(v)))); continue
            e = (library.names() if kind == "name" else library.duas()).get(v["src"])
            if not e: bad.append((cid, "no such entry: " + str(v["src"]))); continue
            for f in ("ar", "translit", "meaning"):
                if v[f] != e[f]: bad.append((cid, "%s is not the page's own" % f))
            prose = e["essay"] if kind == "name" else (e["summary"] + " " + e["role"])
            prose = re.sub(r"\s+", " ", prose)
            line = re.sub(r"\s+", " ", v.get("line") or "")
            if line and line not in prose:
                bad.append((cid, "the sentence is not the page's own"))
            if len(v["meaning"]) > 150: bad.append((cid, f"meaning {len(v['meaning'])} > 150"))
            if len(line) > 210: bad.append((cid, f"line {len(line)} > 210"))
            lines = [line] if line else []
            screen = " ".join([v["translit"], v["meaning"], line])
        else:
            bad.append((cid, "unknown kind " + kind)); continue
        for i, l in enumerate(lines):
            lim = {"know": 140, "day": 150}.get(kind, 118)
            if len(l) > lim and kind in ("light", "know", "day"): bad.append((cid, f"line {i} {len(l)} > {lim}"))
            if kind in ("light", "know"):      # house style is asked of what the house wrote
                if re.match(r"^(And|But)\b", l): bad.append((cid, f"line {i} opens with And/But"))
                if "..." in l or "…" in l: bad.append((cid, f"line {i} trails off"))
        for f in ((screen, v["caption"]) if kind in ("light", "know", "name", "dua") else ()):
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
        if not (TAG_FLOOR.get(kind, 6) <= len(tg) <= 12): bad.append((cid, f"{len(tg)} tags"))
        body = re.split(r"Read the whole|The whole story|Every word|Read the whole surah|Every day of", cap)[0].strip()
        if len(body) > 520: bad.append((cid, f"caption body {len(body)} > 520"))
        if kind != "day" and v.get("hook") and v["hook"].lower() in norm(body): bad.append((cid, "caption repeats the hook"))
        # the caption is copy too: its numbers and names come from the same source
        if kind != "verse":
            for n in nums(cap) - hay_num:
                if n.replace(",", "") not in {x.replace(",", "") for x in hay_num}:
                    bad.append((cid, "caption number not in the source: " + n))
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
