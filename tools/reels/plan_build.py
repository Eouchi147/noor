#!/usr/bin/env python3
"""NOOR reel · build plan.json from the sources.

plan.json is the one file the workflow renders from. Two of its kinds are
written by hand and audited (light, in plan.json itself, and know, in
know.json); the other three are drawn straight from the library so that the
words on screen are the library's own words:

    word   build/dict-*.json         the Arabic, the term, the short and long
    day    calendar.json             the fixed days and the twelve months,
                                     exported from api/_calendar.js
    verse  verses.txt                references only; text and translation
                                     come from quran-uthmani.json and
                                     verses.json at render time

Running it again is safe: the hand written cards are kept exactly, the
generated ones are rebuilt, and nothing is renumbered. `look` is decided
from the card id, so a card keeps its picture and its seed for good.

    python3 plan_build.py            rebuild plan.json in place
"""
import glob, hashlib, json, os, re, sys, time

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


def word_cards():
    D = dictionary()
    cards = {}
    for i, w in enumerate(WORDS):
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


# the rooms The Codex tours: the ones a stranger walks into, not the desk drawers
CODEX_SKIP = ("/donate", "/license", "/journal", "/feedback", "/legal", "/masjid", "/school", "/hajj-plan", "/#mizan", "/kids/lanterns")


def codex_counts():
    """the library's true numbers, from the library itself"""
    idx = json.load(open(os.path.join(ROOT, "assets", "menu-index.json"), encoding="utf-8"))
    lights = json.load(open(os.path.join(ROOT, "lights", "all.json"), encoding="utf-8"))
    words = sum(len(json.load(open(f, encoding="utf-8"))) for f in glob.glob(os.path.join(ROOT, "build", "dict-*.json")))
    return idx, {"words": words, "surahs": 114, "lights": int(lights.get("n") or len(lights.get("lights", []))),
                 "chapters": len(idx.get("path", [])), "names": 99, "prophets": 25}


def codex_cards():
    idx, N = codex_counts()
    counts = [[N["words"], "words"], [N["surahs"], "surahs"], [N["lights"], "lights"], [N["chapters"], "chapters"]]
    zeros = [[0, "ads"], [0, "accounts"], [0, "tracking"]]
    cards = {}
    rooms = [it for sec in idx["sections"] for it in sec["items"] if it["u"] not in CODEX_SKIP]
    for i, it in enumerate(rooms):
        slug = re.sub(r"[^a-z0-9]+", "-", it["u"].lower()).strip("-") or "home"
        cid = "codex-" + slug
        if cid in cards: raise SystemExit("two rooms make the same card id: " + cid)
        url = "noorcodex.com" + ("" if it["u"].startswith("/#") else it["u"])
        cards[cid] = {
            "kind": "codex", "src": it["u"], "slot": "evening",
            "build": "build %s" % time.strftime("%Y.%m"),
            "counts": counts, "zeros": zeros,
            "room": {"k": "today's room", "t": it["t"], "d": it["d"]},
            "ask": {"l1": "One light a day.", "l2": "Follow. Save this. Send it to one person.", "l3": "NOORCODEX.COM · FREE, NO ADS, NO ACCOUNT"},
            "caption": "NOOR is a free Islamic library: %d words defined, all %d surahs with recitation, %d lights of history and science, the Path in %d chapters. No ads, no account, no tracking, ever.\n\nToday's room: %s. %s\n%s\n\nFollow for one light a day.\n\n#Islam #Muslim #Quran #IslamicLibrary #NoorCodexOfLight"
                       % (N["words"], N["surahs"], N["lights"], N["chapters"], it["t"], it["d"], url),
            "look": {"pal": "codex", "seed": h32(cid) % 1000, "n": STARS[h32(cid) % len(STARS)][0], "k": STARS[h32(cid) % len(STARS)][1],
                     "scene": "codex", "secs": 10}
        }
    return cards


def main():
    doc = json.load(open(PLAN, encoding="utf-8")) if os.path.exists(PLAN) else {"_meta": {}, "cards": {}}
    old = doc.get("cards", {})
    kept = {k: v for k, v in old.items() if v.get("kind", "light") in ("light", "know")}
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
    cards = dict(kept)
    for build in (word_cards, day_cards, verse_cards, codex_cards):
        new = build()
        cards.update(new)
        print("  %-12s %d" % (build.__name__.replace("_cards", ""), len(new)))
    counts = {}
    for v in cards.values(): counts[v.get("kind", "light")] = counts.get(v.get("kind", "light"), 0) + 1
    doc["_meta"] = {**doc.get("_meta", {}), "n": len(cards), "kinds": counts,
                    "built": "plan_build.py from the library; light and know cards are written by hand"}
    doc["cards"] = cards
    json.dump(doc, open(PLAN, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("plan.json: %d cards %s" % (len(cards), counts))


if __name__ == "__main__":
    main()
