#!/usr/bin/env python3
"""Build the manifest rows for the silent shorts.

    python3 shortmanifest.py            write out/shorts-rows.json

WHY THE ROWS AND NOT THE WHOLE FILE

The posting desk reads one manifest, /reels/index.json, and picks a row by
`kind`. A short is a row in that same file with kind "short": it needs no new
API, no new slot machinery and no new door, because chooseReel already routes
by kind and the afternoon rota already asks for "short".

This writes only the rows. Merging them into the live manifest is the last
step and belongs to whatever already writes that file, so nothing here can
overwrite a manifest it did not build.

THE CAPTION IS THE CARD'S OWN CAPTION.

Every one of these shorts is a card out of know.json, which already carries a
written, sourced caption ending in the codex link and the tags. Rewriting it
here would mean two versions of the same claim drifting apart, so the caption
is taken verbatim and only the hook is the short's own title.
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
KNOW = os.path.join(HERE, "..", "reels", "know.json")

#  short -> the card its facts came out of
FROM_CARD = {
    "short-darkroom":     "know-camera-obscura",
    "short-digits":       "know-ghubar",
    "short-sine":         "know-sine",
    "short-leftout":      "know-bukhari",
    "short-onehill":      "know-earth-radius",
    "short-sixcenturies": "know-canon",
    "short-starnames":    "know-star-names",
    "short-subscription": "know-hejaz-railway",
    "short-goldprice":    "know-mansa-musa-gold",
    "short-turnback":     "know-quarantine",
    "short-alhazen":      "know-basel-optics",
    "short-turningearth": "know-turning-earth",
    "short-oneline":      "know-astrolabe-maker",
}

#  the isnad short was written before the card set was used, so it carries its
#  own caption. Same shape, same ending, same tags.
OWN = {
    #  the Tusi couple short was written straight off the library entry
    #  tusi-couple rather than off a Did you know card, because there is no
    #  card for it yet. Same shape of caption, same ending, same tags.
    "short-twice": (
        "In 1247 Nasir al-Din al-Tusi, working at the observatory at Maragha, "
        "published a construction: roll a small circle inside a circle twice "
        "its width, and any point on the small one traces a straight line "
        "back and forth. Circular motion alone can therefore produce a "
        "straight oscillation, which is what the old planetary models needed "
        "and could not honestly get. The same construction, drawn the same "
        "way and with no attribution, appears in Copernicus's book of 1543. "
        "How it got there is still an open question.\n\n"
        "The whole story, free, at noorcodex.com\n\n"
        "#DidYouKnow #Islam #Science #IslamicHistory #NoorCodexOfLight"),
    "short-isnad": (
        "How a hadith was checked. Every report carries a chain of who heard "
        "it from whom, back to the Prophet صلى الله "
        "عليه وسلم, and the chain was "
        "examined name by name: did this person exist, did they overlap in "
        "time with the one they quote, were they held to be reliable. What "
        "came out was graded sound, good or weak, and the weak ones were "
        "named as weak rather than quietly dropped.\n\n"
        "The whole story, free, at noorcodex.com\n\n"
        "#DidYouKnow #Islam #Hadith #IslamicHistory #NoorCodexOfLight")
}


def secs_of(slug):
    """the film's own length, out of the film file, plus the closing fade"""
    p = os.path.join(HERE, "films", slug + ".json")
    d = json.load(open(p, encoding="utf-8"))
    t = sum(b["hold"] for b in d["chapters"][0]["beats"])
    return int(round(t + 1.0))


def main():
    cards = json.load(open(KNOW, encoding="utf-8"))["cards"]
    rows, missing = [], []
    for slug in sorted(os.listdir(os.path.join(HERE, "films"))):
        if not slug.startswith("short-") or not slug.endswith(".json"):
            continue
        slug = slug[:-5]
        film = json.load(open(os.path.join(HERE, "films", slug + ".json"), encoding="utf-8"))
        cid = FROM_CARD.get(slug)
        if cid and cid in cards:
            cap = cards[cid]["caption"]
        elif slug in OWN:
            cap = OWN[slug]
        else:
            missing.append(slug)
            continue
        rows.append({
            "id": slug,
            "kind": "short",
            "hook": film.get("title", slug),
            "caption": cap,
            "secs": secs_of(slug),
            "cover": True,
            "video": "https://noorcodex.com/reels/" + slug + ".mp4",
            "source": cid or "",
        })
    out = os.path.join(HERE, "out", "shorts-rows.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write(
        json.dumps({"n": len(rows), "kind": "short", "cards": rows},
                   ensure_ascii=False, indent=1) + "\n")
    print("  %d rows -> %s" % (len(rows), out))
    for r in rows:
        print("   %-20s %2ds  %-28s %s" % (r["id"], r["secs"], r["hook"][:28],
                                           ("<- " + r["source"]) if r["source"] else "(own caption)"))
    if missing:
        print("\n  NO CAPTION for: %s" % ", ".join(missing))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
