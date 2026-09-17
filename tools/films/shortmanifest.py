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

TWO KINDS OF SHORT, TWO SOURCES OF TRUTH.

The plate shorts (`briefs/plate-*.json`) are the library's own illustrated
page, staged to the template: the caption and the long `story` are built HERE,
from the brief's own audited lines and from the hero card the brief's `room`
points at (heroes.html), never invented. A brief with no rendered film yet is
quietly left off the shelf, exactly as a card with no rendered video always
has been; a brief WITH a film but nothing to build its row from is a real
problem and is named.

The fifteen shorts written before the plate engine keep the old path: their
caption is a know.json card's own caption, taken verbatim, because rewriting
it here would mean two versions of the same claim drifting apart. A slug with
its own plate brief is never built this way, even if it is still listed
below, because the newer, fuller brief takes precedence the moment its film
exists.
"""
import datetime
import json
import os
import re
import sys
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
BRIEFS = os.path.join(HERE, "briefs")
FILMS = os.path.join(HERE, "films")
OUT = os.path.join(HERE, "out")
#  Two homes, one file (see publish-shorts.sh): inside the site's tree the
#  cards are ../reels/know.json; on the owner's Mac, where this folder stands
#  alone, the same file travels with it as shelf/know.json, refreshed from
#  main with every update. Whichever exists is read.
KNOW = os.path.join(HERE, "..", "reels", "know.json")
if not os.path.exists(KNOW):
    KNOW = os.path.join(HERE, "shelf", "know.json")

#  Where heroes.html and lights/all.json live once this file sits at
#  tools/films/ inside the site's own tree, two levels up. NOOR_SITE_ROOT
#  overrides it for a dry run made from the engine's working copy alone,
#  which has no site tree beside it; on the Mac the pages a story is read
#  from travel as shelf/site/ (heroes.html), refreshed the same way.
SITE_ROOT = os.environ.get("NOOR_SITE_ROOT") or os.path.normpath(
    os.path.join(HERE, "..", ".."))
if not os.environ.get("NOOR_SITE_ROOT") and not os.path.exists(os.path.join(SITE_ROOT, "heroes.html")) \
        and os.path.exists(os.path.join(HERE, "shelf", "site", "heroes.html")):
    SITE_ROOT = os.path.join(HERE, "shelf", "site")

#  The shortest LIVE network limit in api/_channels.js's SPEC, checked 16
#  September 2026: facebook 2200, instagram 2200, youtube 4900, telegram
#  1024, threads 500. (pinterest is 500 too but is not live; x is 280 but
#  is not live either.) The caption is built to fit here, so it stays safe
#  on every channel that falls back to it rather than shaping the story.
CAPTION_LIMIT = 500
STORY_LIMIT = 4500
HOUSE_TAG = "#NoorCodexOfLight"
TAGS = ["#Islam", "#IslamicHistory", HOUSE_TAG]

#  short -> the card its facts came out of. Unchanged since before the
#  plate engine; short-darkroom is still listed for the record, but its own
#  plate brief now takes precedence the moment short-darkroom-tall-30fps.mp4
#  exists, so this entry is never actually reached once that film ships.
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


# ---------------------------------------------------------------------------
# small, pure text helpers
# ---------------------------------------------------------------------------
#  built from code points, not typed literally, so this file itself never
#  carries the two characters it exists to catch
_DASH = re.compile(u"[" + chr(0x2013) + chr(0x2014) + u"]")


def no_dash(s):
    """The house rule, kept even on text copied verbatim: an em or en dash
    becomes a comma rather than being carried through unremarked. Every page
    this reads from is written dash free already, so this is a net that
    should never catch anything, not a rewrite of what the page says."""
    return _DASH.sub(",", s or "")


def clean(s):
    return no_dash(re.sub(r"\s+", " ", s or "").strip())


def clean_paras(text):
    """collapses each paragraph's own whitespace, keeps the blank line
    between paragraphs"""
    paras = [clean(p) for p in re.split(r"\n\s*\n", text or "") if clean(p)]
    return "\n\n".join(paras)


def secs_of(slug):
    """the film's own length, out of the compiled film JSON, plus the
    closing fade. None when that file does not exist yet."""
    p = os.path.join(FILMS, slug + ".json")
    if not os.path.exists(p):
        return None
    d = json.load(open(p, encoding="utf-8"))
    t = sum(b["hold"] for b in d["chapters"][0]["beats"])
    return int(round(t + 1.0))


def made_of(path):
    return datetime.datetime.utcfromtimestamp(os.path.getmtime(path)).strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# reading a hero card off heroes.html: a person's own paragraphs, or, inside
# a field of several cards, the one gcard whose title and meta share the
# most words with the brief's own title and note.
# ---------------------------------------------------------------------------
def _classes(attrs):
    for k, v in attrs:
        if k == "class":
            return (v or "").split()
    return []


def _attr(attrs, name):
    for k, v in attrs:
        if k == name:
            return v
    return None


class _HeroParser(HTMLParser):
    """One pass over heroes.html: every person's own paragraphs (a pcard's
    pc-body), kept under the card's own id; and every field's grouped cards
    (a fieldsec's gcards), each kept under its own title and meta line, so
    the one that matches a brief can be picked out afterward. This only
    reads the page; it writes nothing back to it."""

    def __init__(self):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.persons = {}
        self.fields = {}
        self._person = None
        self._in_body = False
        self._field = None
        self._card = None
        self._mode = None
        self._buf = []

    def handle_starttag(self, tag, attrs):
        cls = _classes(attrs)
        idv = _attr(attrs, "id")
        if tag == "article" and "pcard" in cls:
            self._person = idv
            if idv:
                self.persons[idv] = []
        elif tag == "div" and "pc-body" in cls and self._person:
            self._in_body = True
        elif tag == "section" and "fieldsec" in cls:
            self._field = idv
            if idv:
                self.fields[idv] = []
        elif tag == "article" and "gcard" in cls and self._field:
            self._card = {"title": "", "meta": "", "paras": []}
            self.fields[self._field].append(self._card)
        elif tag == "div" and self._card is not None and ("fig" in cls or "gc-now" in cls):
            self._card = None            # this card's prose is over
        elif tag == "h4" and "gc-t" in cls and self._card is not None:
            self._mode, self._buf = "title", []
        elif tag == "p" and "gc-m" in cls and self._card is not None:
            self._mode, self._buf = "meta", []
        elif tag == "p" and not cls and self._in_body:
            self._mode, self._buf = "person", []
        elif tag == "p" and not cls and self._card is not None and self._mode is None:
            self._mode, self._buf = "card", []

    def handle_endtag(self, tag):
        if tag == "h4" and self._mode == "title":
            self._card["title"] = "".join(self._buf).strip()
            self._mode = None
        elif tag == "p" and self._mode == "meta":
            self._card["meta"] = "".join(self._buf).strip()
            self._mode = None
        elif tag == "p" and self._mode == "person":
            t = "".join(self._buf).strip()
            if t and self._person:
                self.persons[self._person].append(t)
            self._mode = None
        elif tag == "p" and self._mode == "card":
            t = "".join(self._buf).strip()
            if t and self._card is not None:
                self._card["paras"].append(t)
            self._mode = None
        elif tag == "div" and self._in_body:
            self._in_body = False
        elif tag == "section":
            self._field = None
        elif tag == "article":
            self._person = None

    def handle_data(self, data):
        if self._mode:
            self._buf.append(data)


STOP = set(("the a an of and to in on for with his her it is was that this "
            "at by or as are he she from into one its their they were had "
            "who what when where which not never no did do does about over "
            "under near than then so if but").split())


def _keywords(s):
    return set(w for w in re.findall(r"[a-z]+", (s or "").lower())
               if w not in STOP and len(w) > 2)


def _brief_words(brief):
    """everything a brief itself says: the title, the note, and every line
    and sub line, which is where a name like Fibonacci or a place like
    Toledo actually shows up, not in the one sentence note"""
    bits = [brief.get("title", ""), brief.get("note", "")]
    for l in brief.get("lines") or []:
        bits.append(l.get("text", ""))
        bits.append(l.get("sub", ""))
        bits.append(l.get("src", ""))
    return _keywords(" ".join(bits))


def _pick_card(cards, brief):
    """the one gcard, among several sharing a field's anchor, whose own
    title, meta and paragraphs share the most words with the brief: a
    title and a one line note are too thin to tell "the paper road" from
    three different cards in the same field, but the brief's own lines and
    the card's own paragraphs both carry the names and places that do.
    None when nothing overlaps at all: with best_score starting below zero
    the first card in the field used to win every tie, which is a silent
    wrong pick, not a match, and one hero's paragraphs are never another's
    story. The caller falls back to the brief's own text instead."""
    want = _brief_words(brief)
    best, best_score = None, 0
    for c in cards:
        have = _keywords(c["title"] + " " + c["meta"] + " " + " ".join(c["paras"]))
        score = len(want & have)
        if score > best_score:
            best, best_score = c, score
    return best


_HERO_CACHE = {}


def page_text(room, brief):
    """the hero card's paragraphs at a brief's room: a person's whole life,
    or, inside a field of several cards, the one gcard that matches the
    brief. "" when the page is not reachable (a dry run away from the site)
    or the anchor names nothing this parser knows."""
    m = re.match(r"^([\w.\-]+\.html)#([\w-]+)$", room or "")
    if not m:
        return ""
    page, anchor = m.group(1), m.group(2)
    path = os.path.join(SITE_ROOT, page)
    if not os.path.exists(path):
        return ""
    hp = _HERO_CACHE.get(path)
    if hp is None:
        hp = _HeroParser()
        hp.feed(open(path, encoding="utf-8").read())
        _HERO_CACHE[path] = hp
    if anchor in hp.persons and hp.persons[anchor]:
        return "\n\n".join(hp.persons[anchor])
    if anchor in hp.fields and hp.fields[anchor]:
        card = _pick_card(hp.fields[anchor], brief)
        if card and card["paras"]:
            return "\n\n".join(card["paras"])
        print("  WARNING: %s: no hero card at %s shares a word with the brief; "
              "the brief's own lines are used for its story instead"
              % (brief.get("title", "") or room, room), file=sys.stderr)
    return ""


# ---------------------------------------------------------------------------
# the caption (short form) and the story (the long, full account)
# ---------------------------------------------------------------------------
def payoff_of(brief):
    """the payoff sentence: TEMPLATE.md's own name for the second to last
    line, "the one sentence the film exists to say"; the last line is the
    source card (eyebrow, text, src), a different beat."""
    lines = brief.get("lines") or []
    if len(lines) >= 2:
        return clean(lines[-2].get("text", ""))
    return clean(lines[0].get("text", "")) if lines else ""


def caption_for(brief, room_link):
    """title, then the hook, then the payoff sentence, then the source,
    then the room link, then the tags: all inside the shortest live
    network limit, so it is safe wherever a channel falls back to it."""
    lines = brief.get("lines") or []
    title = clean(brief.get("title", ""))
    hook = clean(lines[0].get("text", "")) if lines else ""
    payoff = payoff_of(brief)
    src = clean(lines[-1].get("src", "")) if lines else ""
    tags_line = " ".join(TAGS)
    body_parts = [p for p in (title, hook, payoff, ("Source: " + src) if src else "") if p]
    fixed = "\n\n".join(p for p in (room_link, tags_line) if p)
    cap = "\n\n".join(body_parts + ([fixed] if fixed else []))
    if len(cap) > CAPTION_LIMIT:
        room_for_text = CAPTION_LIMIT - len(fixed) - 2
        body = "\n\n".join(body_parts)
        body = body[:max(0, room_for_text)].rsplit(" ", 1)[0] + "…" if room_for_text > 20 else ""
        cap = "\n\n".join(p for p in (body, fixed) if p)
    return no_dash(cap)


def story_for(brief, room_link):
    """the full account in the library's own words, the sources named on
    that page, then the room link, under STORY_LIMIT characters, no dash."""
    text = page_text(brief.get("room", ""), brief)
    lines = brief.get("lines") or []
    if not text:
        #  the page could not be reached: fall back to the brief's own
        #  audited lines, still true, still the library's own words
        text = "\n\n".join(clean(l.get("text", "")) for l in lines if l.get("text"))
    text = clean_paras(text)
    src = clean(lines[-1].get("src", "")) if lines else ""
    tail_bits = [("Source: " + src) if src else "", room_link]
    tail = "\n\n".join(p for p in tail_bits if p)
    story = "\n\n".join(p for p in (text, tail) if p)
    if len(story) > STORY_LIMIT:
        room_for_text = STORY_LIMIT - len(tail) - 2
        kept, total = [], 0
        for p in text.split("\n\n"):
            if total + len(p) + 2 > room_for_text:
                break
            kept.append(p)
            total += len(p) + 2
        story = "\n\n".join(p for p in ("\n\n".join(kept), tail) if p)
    return no_dash(story)


# ---------------------------------------------------------------------------
# rows
# ---------------------------------------------------------------------------
def plate_row(brief_path):
    """None, reason when the row cannot be built; reason is None when the
    only reason is "not rendered yet", which is not an error."""
    brief = json.load(open(brief_path, encoding="utf-8"))
    fname = os.path.basename(brief_path)
    slug = brief.get("slug") or ("short-" + fname[len("plate-"):-5])
    tall = os.path.join(HERE, slug + "-tall-30fps.mp4")
    if not os.path.exists(tall):
        return None, None                # quietly not on the shelf yet
    lines = brief.get("lines") or []
    if not lines:
        return None, fname + ": no lines"
    room = brief.get("room", "")
    if not room:
        return None, fname + ": no room"
    secs = secs_of(slug)
    if secs is None:
        return None, fname + ": no compiled film at films/" + slug + ".json"
    room_link = "https://noorcodex.com/" + room
    row = {
        "id": slug,
        "kind": "short",
        "title": clean(brief.get("title", "")),
        "hook": clean(lines[0].get("text", "")),
        "payoff": payoff_of(brief),
        "caption": caption_for(brief, room_link),
        "story": story_for(brief, room_link),
        "src": clean(lines[-1].get("src", "")),
        "room": room,
        "tags": list(TAGS),
        "secs": secs,
        "cover": True,
        "video": "https://noorcodex.com/reels/" + slug + ".mp4",
        "made": made_of(tall),
    }
    #  no "wide" key here: publish-shorts.sh looks at the file on disk for
    #  itself to decide whether to upload one, and this row travels through
    #  the merge and onto the live shelf whether or not that upload ever
    #  happens. A bare filename in "wide" would ride along as if it were a
    #  playable url the moment the upload is skipped or refused for size;
    #  the key is only ever written, as a real https url, once an upload
    #  has actually succeeded (publish-shorts.sh's own merge step).
    return row, None


def old_row(slug, film, know_cards):
    cid = FROM_CARD.get(slug)
    if cid and cid in know_cards:
        cap = know_cards[cid]["caption"]
    elif slug in OWN:
        cap = OWN[slug]
    else:
        return None, slug
    return {
        "id": slug,
        "kind": "short",
        "hook": film.get("title", slug),
        "caption": cap,
        "secs": secs_of(slug),
        "cover": True,
        "video": "https://noorcodex.com/reels/" + slug + ".mp4",
        "source": cid or "",
    }, None


def main():
    rows, missing = [], []
    plate_slugs = set()

    for fname in sorted(os.listdir(BRIEFS)):
        if not (fname.startswith("plate-") and fname.endswith(".json")):
            continue
        row, why = plate_row(os.path.join(BRIEFS, fname))
        if row:
            rows.append(row)
            plate_slugs.add(row["id"])
        elif why:
            missing.append(why)

    know_cards = json.load(open(KNOW, encoding="utf-8"))["cards"]
    for fname in sorted(os.listdir(FILMS)):
        if not (fname.startswith("short-") and fname.endswith(".json")):
            continue
        slug = fname[:-5]
        if slug in plate_slugs:
            continue                      # this one now comes from its own plate brief
        plate_equiv = "plate-" + slug[len("short-"):] + ".json"
        if os.path.exists(os.path.join(BRIEFS, plate_equiv)):
            continue                      # a plate brief exists for it, just not rendered yet
        film = json.load(open(os.path.join(FILMS, fname), encoding="utf-8"))
        row, miss = old_row(slug, film, know_cards)
        if row:
            rows.append(row)
        else:
            missing.append(miss)

    rows.sort(key=lambda r: r["id"])
    os.makedirs(OUT, exist_ok=True)
    out_path = os.path.join(OUT, "shorts-rows.json")
    open(out_path, "w", encoding="utf-8").write(
        json.dumps({"n": len(rows), "kind": "short", "cards": rows},
                   ensure_ascii=False, indent=1) + "\n")
    print("  %d rows -> %s" % (len(rows), out_path))
    for r in rows:
        tag = r.get("room") or r.get("source") or "(own caption)"
        print("   %-24s %2ds  %-28s %s" % (r["id"], r["secs"], r.get("hook", "")[:28], tag))
    if missing:
        print("\n  NOT BUILT: %s" % ", ".join(missing))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
