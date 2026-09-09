#!/usr/bin/env python3
"""NOOR reel · build plan.json from the sources.

plan.json is the one file the workflow renders from. Two of its kinds are
written by hand and audited (light, in light.json, and know, in know.json);
the other five are drawn straight from the library so that the words on
screen are the library's own words:

    word   build/dict-*.json         every word of the dictionary: the Arabic,
                                     the term, the short and long
    day    calendar.json             the fixed days and the twelve months,
                                     exported from api/_calendar.js
    verse  verses.txt                references only; text and translation
                                     come from quran-uthmani.json and
                                     verses.json at render time
    name   allah.html                the 99 Names: the Arabic, how it is said,
                                     its one line of meaning, and one sentence
                                     lifted whole from its own essay
    dua    words.js                  the du'as of the Path: the Arabic, how it
                                     is said, what it means, and the sentence
                                     that says who first said it

The Codex kind is gone. It was a heads up display of the library's own
numbers with an ask at the end, which is the site praising itself, and it is
not what anybody follows an account for. The two kinds above took its place.

Running it again is safe: the hand written cards are kept exactly, the
generated ones are rebuilt, and nothing is renumbered. `look` is decided
from the card id, so a card keeps its picture and its seed for good.

    python3 plan_build.py            rebuild plan.json in place
"""
import glob, hashlib, json, os, re, sys, time

import library

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get("NOOR_ROOT") or os.path.join(HERE, "..", "..")
PLAN = os.path.join(HERE, "plan.json")

MONTH_AR = {1: "ٱلْمُحَرَّم", 2: "صَفَر", 3: "رَبِيع ٱلْأَوَّل", 4: "رَبِيع ٱلْآخِر", 5: "جُمَادَىٰ ٱلْأُولَىٰ",
            6: "جُمَادَىٰ ٱلْآخِرَة", 7: "رَجَب", 8: "شَعْبَان", 9: "رَمَضَان", 10: "شَوَّال",
            11: "ذُو ٱلْقَعْدَة", 12: "ذُو ٱلْحِجَّة"}
CAT_LABEL = {"aqidah": "belief", "core": "the essentials", "fiqh": "law", "hadith": "the hadith",
             "ibadah": "worship", "quran": "the Qur'an", "tarikh": "history", "tazkiyah": "the heart"}
PALS = ["night", "sand", "green", "night", "dusk"]
STARS = [(8, 3), (12, 5), (10, 4), (16, 7), (8, 3), (12, 5)]

WORDS = """taqwa sabr tawakkul ihsan iman tawhid dua dhikr barakah fitrah niyyah ikhlas shukr tawbah rahmah
haya adab hilm sakinah qanaah zuhd tawadu muraqabah muhasabah tafakkur istiqamah yaqin sidq amanah nasihah
husn-al-zann salah sujud wudu qiblah adhan jumuah tahajjud witr sawm suhur iftar laylat-al-qadr itikaf zakat
sadaqah sadaqah-jariyah hajj umrah ihram tawaf talbiyah arafah zamzam kabah ummah sunnah hadith sahih isnad
tafsir tajwid tartil surah ayah juz basmalah fatihah akhirah jannah barzakh qadr ruh nafs qalb halal haram
makruh mustahabb fiqh madhhab ijma qiyas ijtihad fatwa maqasid-al-shariah rukhsah hijrah sirah khutbah shahadah
islam rida raja khawf mahabbah wahy nubuwwah malaikah jinn dunya ajal hisab mizan sirat shafaah""".split()


def h32(s):
    return int(hashlib.md5(s.encode("utf-8")).hexdigest()[:8], 16)


def first_sentence(txt, limit=150):
    txt = re.sub(r"\s+", " ", txt or "").strip()
    m = re.match(r"(.+?[.!?])(\s|$)", txt)
    s = m.group(1) if m else txt
    return s if len(s) <= limit else ""


def dictionary():
    out = {}
    for f in sorted(glob.glob(os.path.join(ROOT, "build", "dict-*.json"))):
        cat = os.path.basename(f)[5:-5]
        for e in json.load(open(f, encoding="utf-8")):
            out[e["id"]] = (cat, e)
    return out


def word_list(D):
    """every word of the dictionary: the hundred and six chosen by hand first,
    in their order, then the rest of the 523 by category and name, so the
    shelf holds the whole dictionary and a word is never written twice.
    A second shelf of words is what carries the account past its third month."""
    seen, out = set(), []
    for w in WORDS:
        if w in D and w not in seen: seen.add(w); out.append(w)
    rest = sorted((cat, w) for w, (cat, e) in D.items() if w not in seen)
    return out + [w for cat, w in rest]


def word_cards():
    D = dictionary()
    cards = {}
    for i, w in enumerate(word_list(D)):
        if w not in D: print("  no such word:", w); continue
        cat, e = D[w]
        long = first_sentence(e.get("long", ""))
        cid = "word-" + w
        n, k = STARS[h32(cid) % len(STARS)]
        cards[cid] = {
            "kind": "word", "src": w, "slot": "evening" if i % 2 else "morning",
            "eyebrow": "The word · " + CAT_LABEL.get(cat, cat),
            "ar": e["ar"], "term": e["term"], "short": e["short"], "long": long,
            "caption": "%s (%s). %s%s\n\nEvery word explained, free, with no ads and no account: noorcodex.com/dictionary/%s\n\n#TheWord #Islam #Arabic #%s #NoorCodexOfLight"
                       % (e["term"], e["ar"], e["short"], (" " + long) if long else "", w,
                          re.sub(r"[^A-Za-z]", "", e["term"])),
            "look": {"pal": PALS[h32(cid + "p") % len(PALS)], "seed": h32(cid) % 1000, "n": n, "k": k,
                     "scene": "mandala", "secs": 14}
        }
    return cards


def sentences_of(txt, n=2, limit=150):
    """the first n sentences of a passage, each within the line limit"""
    bits = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", txt or "").strip())
    out = []
    for b in bits:
        if len(b) > limit: break
        out.append(b)
        if len(out) >= n: break
    return out


def day_cards():
    C = json.load(open(os.path.join(HERE, "calendar.json"), encoding="utf-8"))
    cards = {}
    for key, f in C["FIXED"].items():
        hm, hd = [int(x) for x in key.split("-")]
        lines = sentences_of(f["what"], 2)
        if not lines: print("  no line fits:", key); continue
        todo = (f.get("todo") or [""])[0]
        if len(todo) > 96: todo = ""
        cid = "day-" + f["key"]
        name = f["name"]
        hook = name if len(name) <= 62 else name[:62]
        tags = [f.get("tag") or "#Islam", "#Islam", "#IslamicCalendar", "#Hijri", "#NoorCodexOfLight"]
        basis = f.get("basis", "")
        cards[cid] = {
            "kind": "day", "src": key, "slot": "morning", "hm": hm, "hd": hd,
            "eyebrow": "This day", "num": str(hd), "month": C["MONTHS"][str(hm)]["name"], "ar": MONTH_AR[hm],
            "hook": hook, "key": hook if len(hook.split()) <= 4 else " ".join(hook.split()[-2:]),
            "lines": lines, "todo": todo,
            "caption": "%s: %d %s.\n\n%s%s%s\n\nEvery day of the Islamic year, explained free at noorcodex.com\n\n%s"
                       % (name, hd, C["MONTHS"][str(hm)]["name"], f["what"],
                          ("\n\n" + (f.get("todo") or [""])[0]) if f.get("todo") and len(f["what"]) < 300 else "",
                          ("\n\nBasis: " + basis) if basis and len(basis) < 120 else "",
                          " ".join(dict.fromkeys(tags))),
            "look": {"pal": "night", "seed": h32(cid) % 1000, "n": 8, "k": 3, "scene": "months", "secs": 13}
        }
    for m, f in C["MONTHS"].items():
        m = int(m)
        if ("%d-1" % m) in C["FIXED"]: continue     # that day already has its reel
        lines = sentences_of(f["what"], 2)
        if not lines: print("  no line fits: month", m); continue
        cid = "month-%02d" % m
        name = f["name"]
        cards[cid] = {
            "kind": "day", "src": "month-" + str(m), "slot": "morning", "hm": m, "hd": 1,
            "eyebrow": "This day", "num": "1", "month": name, "ar": MONTH_AR[m],
            "hook": name + " begins", "key": name + " begins",
            "lines": lines, "todo": "",
            "caption": "%s begins: 1 %s.\n\n%s%s\n\nEvery day of the Islamic year, explained free at noorcodex.com\n\n#%s #Islam #IslamicCalendar #Hijri #NoorCodexOfLight"
                       % (name, name, f["what"], ("\n\nBasis: " + f["basis"]) if f.get("basis") else "",
                          re.sub(r"[^A-Za-z]", "", name)),
            "look": {"pal": "night", "seed": h32(cid) % 1000, "n": 12, "k": 5, "scene": "months", "secs": 13}
        }
    return cards


def verse_cards():
    refs = [l.split("#")[0].strip() for l in open(os.path.join(HERE, "verses.txt"), encoding="utf-8")]
    refs = [r for r in refs if r]
    cards = {}
    for i, ref in enumerate(refs):
        cid = "verse-" + ref.replace(":", "-")
        n, k = STARS[h32(cid) % len(STARS)]
        cards[cid] = {
            "kind": "verse", "verse": ref, "ordinal": i, "slot": "evening" if i % 2 else "morning",
            "eyebrow": "One verse",
            # {ref}, {meaning} and {reciter} are filled by the renderer, which is
            # the only place the translation and the voice are known
            "caption": "{ref}\n\n{meaning}\n\nRecited by {reciter}. Read the whole surah with its meaning, and hear every verse, free: noorcodex.com/quran\n\n#OneVerse #Quran #Islam #NoorCodexOfLight",
            "look": {"pal": PALS[h32(cid + "p") % len(PALS)], "seed": h32(cid) % 1000, "n": n, "k": k,
                     "scene": "halo"}
        }
    return cards


def name_cards():
    """one reel for each of the 99 Names.

    The Arabic, how it is said, the one line the page gives as its meaning,
    and one sentence lifted whole out of that Name's own essay. Nothing is
    written here: every word is the library's, and copy_audit.py proves it
    against allah.html.
    """
    cards = {}
    for i, (slug, e) in enumerate(library.names().items()):
        cid = "name-" + slug
        n, k = STARS[h32(cid) % len(STARS)]
        line = library.pick_sentence(e["essay"])
        if not line: print("  no sentence fits:", cid)
        cards[cid] = {
            "kind": "name", "src": slug, "slot": "evening" if i % 2 else "morning",
            "ar": e["ar"], "translit": e["translit"], "meaning": e["meaning"], "line": line,
            "caption": "%s (%s). %s%s\n\nEvery one of the Names, with its root, its verse and what it asks of a person, free at noorcodex.com/allah\n\n#NamesOfAllah #Islam #Allah #Arabic #Tawhid #NoorCodexOfLight"
                       % (e["translit"], e["ar"], e["meaning"] + ".", (" " + line) if line else ""),
            "look": {"pal": PALS[h32(cid + "p") % len(PALS)], "seed": h32(cid) % 1000,
                     "n": n, "k": k, "scene": "name", "secs": 20}
        }
    return cards


def dua_cards():
    """one reel for each du'a of the Path (words.js).

    The Arabic, how it is said, what it means, and the one sentence the page
    gives as its summary: who first said it, and what it did.
    """
    cards = {}
    for i, (did, e) in enumerate(library.duas().items()):
        cid = "dua-" + did[2:] if did.startswith("w-") else "dua-" + did
        n, k = STARS[h32(cid) % len(STARS)]
        line = library.pick_sentence(e["summary"]) or library.pick_sentence(e["role"])
        if not line: print("  no sentence fits:", cid)
        cards[cid] = {
            "kind": "dua", "src": did, "slot": "morning" if i % 2 else "evening",
            "ar": e["ar"], "translit": e["translit"], "meaning": e["meaning"], "line": line,
            "caption": "%s\n\n%s.%s\n\nEvery word of the Path, who first said it and what it did, free at noorcodex.com/words\n\n#WordsOfThePath #Dua #Islam #Quran #Arabic #NoorCodexOfLight"
                       % (e["ar"], e["meaning"], (" " + line) if line else ""),
            "look": {"pal": PALS[h32(cid + "p") % len(PALS)], "seed": h32(cid) % 1000,
                     "n": n, "k": k, "scene": "dua", "secs": 21}
        }
    return cards


# a reel leaves the shelf once every network has it (the owner's rule of 9
# September 2026). posted.json is the site's ledger, copied by
# posted_fetch.py: reel id to the date the whole slot went out. A card on it
# is left out of the plan, and a card out of the plan is taken off the shelf
# by render_missing.py, video, sidecar and store asset together. Four kinds
# retire: a verse, a word, a Did you know and a day's card are each said
# once. The other three recur by design and stay: This day returns on its
# own Hijri date every year, the 99 Names and the du'as of the Path come
# round on their walk.
RETIRE = {"verse", "word", "know", "light"}


def posted():
    try:
        d = json.load(open(os.path.join(HERE, "posted.json"), encoding="utf-8"))
        p = d.get("posted")
        return {str(k): str(v) for k, v in p.items()} if isinstance(p, dict) else {}
    except (OSError, ValueError, AttributeError):
        return {}


def retire(cards):
    gone, by = {}, {}
    for cid, day in posted().items():
        c = cards.get(cid)
        if c is None or c.get("kind", "light") not in RETIRE: continue
        gone[cid] = day
        by[c.get("kind", "light")] = by.get(c.get("kind", "light"), 0) + 1
        del cards[cid]
    if gone:
        print("  retired      %d (posted, every network had them) %s" % (len(gone), by))
    return len(gone)


def main():
    doc = json.load(open(PLAN, encoding="utf-8")) if os.path.exists(PLAN) else {"_meta": {}, "cards": {}}
    old = doc.get("cards", {})
    # the two hand written kinds live in their own files now, light.json and
    # know.json, so a new card is a small file to commit rather than a line
    # in a megabyte of plan; a light card still in an old plan.json is kept
    kept = {k: v for k, v in old.items() if v.get("kind", "light") == "light"}
    try:
        light = json.load(open(os.path.join(HERE, "light.json"), encoding="utf-8"))["cards"]
    except FileNotFoundError:
        light = {}
    for k, v in light.items():
        v = dict(v); v["kind"] = "light"
        kept[k] = v
    know = json.load(open(os.path.join(HERE, "know.json"), encoding="utf-8"))["cards"]
    for k, v in know.items():
        v = dict(v); v["kind"] = "know"
        if "slot" not in v: v["slot"] = "morning" if h32(k) % 2 else "evening"
        if "look" not in v:
            n, kk = STARS[h32(k) % len(STARS)]
            v["look"] = {"pal": PALS[h32(k + "p") % len(PALS)], "seed": h32(k) % 1000, "n": n, "k": kk,
                         "scene": ["rosette", "pages", "moon", "ripples", "arcade", "epicycles"][h32(k + "s") % 6],
                         "secs": 13, "cue": 0}
        kept[k] = v
    # a day's card written by hand and dropped into plan.json without a look
    # gets one the same way a Did you know does, decided from its id for good
    for k, v in kept.items():
        if v.get("kind", "light") == "light" and "slot" not in v:
            v["slot"] = "morning" if h32(k) % 2 else "evening"
        if v.get("kind", "light") == "light" and "look" not in v:
            n, kk = STARS[h32(k) % len(STARS)]
            v["look"] = {"pal": PALS[h32(k + "p") % len(PALS)], "seed": h32(k) % 1000, "n": n, "k": kk,
                         "scene": ["rosette", "pages", "moon", "ripples", "arcade", "epicycles"][h32(k + "s") % 6],
                         "secs": 21, "cue": 1}
    cards = dict(kept)
    for build in (word_cards, day_cards, verse_cards, name_cards, dua_cards):
        new = build()
        cards.update(new)
        print("  %-12s %d" % (build.__name__.replace("_cards", ""), len(new)))
    retired = retire(cards)
    counts = {}
    for v in cards.values(): counts[v.get("kind", "light")] = counts.get(v.get("kind", "light"), 0) + 1
    doc["_meta"] = {**doc.get("_meta", {}), "n": len(cards), "kinds": counts, "retired": retired,
                    "built": "plan_build.py from the library; light.json and know.json are written by hand"}
    doc["cards"] = cards
    json.dump(doc, open(PLAN, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("plan.json: %d cards %s" % (len(cards), counts))


if __name__ == "__main__":
    main()
