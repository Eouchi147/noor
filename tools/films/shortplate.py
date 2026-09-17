#!/usr/bin/env python3
"""NOOR - the silent short, second format: ONE PLATE, WORDS UNDER IT.

    python3 shortplate.py briefs/plate-darkroom.json
    python3 shortplate.py briefs/plate-darkroom.json --check

WHY THIS REPLACED THE FIRST FORMAT

The first format was nine or ten cut beats with an abstract figure running
underneath and labels pointing into it. Two verdicts from the owner ended it,
and both were correct:

    too many lines ... the legend shows a colour for the source of light
    but that colour is nowhere to be found on the demonstration

A figure made of gold discs and rays cannot be understood without a key, and
a key is a second thing on the screen competing with the first. Pointing at a
mark needs a leader, and a leader is a third. The frame fills up with
apparatus and the apparatus is not the lesson.

The library's own figures do not work that way. A candle is drawn as a
candle. The wall has a gap in it. The image on the far wall is the same
candle upside down, which is the whole of what Ibn al-Haytham proved, sitting
there in one picture. And the labels are written inside the drawing next to
the things they name, so there is no key and nothing to point at.

So a short is now:

    ONE PICTURE that builds itself across the whole length, piece by piece,
    in the order it was drawn, which is the order the argument runs.

    ONE SENTENCE at a time underneath it, crossing from one to the next.

Nothing else is on the screen at any moment. See web/plate.js for how a
static plate is given its choreography, and THE PLATE BEAT in web/stage.js.

THE READING MODEL is the same one the first format used, because it is about
eyes and not about layout: a line stays up long enough to be read once,
comfortably, by somebody who is also watching a picture move.

    hold = 1.0 entry + 0.06 per word + characters / 12 + 0.6 settle
"""
import argparse, json, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
OD = collections.OrderedDict

#  ---- THE READING MODEL, SET FOR A FEED AND NOT FOR A PAGE -------------
#  The first numbers here were measured on somebody reading a caption under a
#  moving picture at their own pace. That is not who watches this. On a feed
#  the type is enormous, the line is short, and the viewer is reading at the
#  speed of somebody deciding whether to keep watching, which is much faster
#  than the speed of somebody who has decided.
#
#  The platforms agree on the number and it is not sixty seconds. Fifteen to
#  thirty for a tip, twenty five to forty for a lesson, and half the people
#  who leave leave inside the first three seconds. So a short is written to
#  land between twenty five and forty five, and the model that gets it there
#  reads at fifteen characters a second rather than twelve.
ENTRY, PER_WORD, CPS, SETTLE = 0.75, 0.05, 15.0, 0.45
FLOOR = 2.2

#  the caps, and what sets each one. All three are the measure the type is
#  set on in web/film.html, times the number of lines that fits between the
#  foot of the picture and the bottom of the frame.
CAP = {"hook": 42, "text": 42, "sub": 44, "eyebrow": 30, "src": 44}

LEN_MIN, LEN_MAX = 22.0, 52.0

#  the same writing law the first format was given, because the law was never
#  about the format. See THE FOUR QUESTIONS in shorts.py.
PRONOUNS = ("he", "him", "his", "she", "her", "they", "them", "their")


def hold_for(*parts):
    txt = " ".join(p for p in parts if p)
    if not txt.strip():
        return FLOOR
    return max(FLOOR, ENTRY + PER_WORD * len(txt.split()) + len(txt) / CPS + SETTLE)


def check_words(lines, notes):
    """who, where, when, before the third line; and no pronoun before a name"""
    opening = " ".join(v for L in lines[:2] for v in
                       (L.get("eyebrow"), L.get("text"), L.get("sub")) if v)
    if not re.search(r"\b(1[0-9]{3}|[6-9][0-9]{2}|[0-9]{3,4}s|years ago|"
                     r"(elev|twelf|thirteen|fourteen|fifteen|sixteen)th)\b",
                     opening, re.I):
        notes.append("the first two lines give no date. A year, a century or "
                     "\"about a thousand years ago\" has to be on screen early")
    names = set()
    for L in lines[:2]:
        for v in (L.get("eyebrow"), L.get("text"), L.get("sub")):
            if not v:
                continue
            ws = re.findall(r"[A-Za-z'-]+", v)
            for j, w in enumerate(ws):
                if j and w[0].isupper():
                    names.add(w)
    if len(names) < 2:
        notes.append("the first two lines name %s. A viewer needs the person "
                     "and the place before the third line"
                     % (", ".join(sorted(names)) or "nobody and nowhere"))
    named = False
    for i, L in enumerate(lines):
        for v in (L.get("eyebrow"), L.get("text"), L.get("sub")):
            if not v:
                continue
            for j, w in enumerate(re.findall(r"[A-Za-z'-]+", v)):
                if j and w[0].isupper():
                    named = True
                    continue
                if not named and w.lower() in PRONOUNS:
                    notes.append("line %d says %r before anybody has been named"
                                 % (i, w))
                    named = True


def build(brief):
    notes, lines, t = [], [], 0.0
    raw = brief["lines"]
    for i, L in enumerate(raw):
        for f in ("text", "sub", "eyebrow", "src"):
            v = (L.get(f) or "").strip()
            cap = CAP["hook"] if (f == "text" and i == 0 and L.get("size") != "h1") \
                else CAP.get(f, 99)
            if v and len(v) > cap:
                notes.append("line %d: %s is %d characters, cap is %d -- %r"
                             % (i, f, len(v), cap, v))
        h = L.get("hold") or hold_for(L.get("eyebrow"), L.get("text"), L.get("sub"))
        #  THE OPENING LINE IS HELD LONGER THAN ITS OWN WORD COUNT ASKS.
        #  The reading model sizes a line for somebody who has decided to read
        #  it. The first line is read by somebody who has not.
        if i == 0:
            h = max(h, 3.9)
        out = OD()
        if L.get("eyebrow"): out["eyebrow"] = L["eyebrow"]
        if L.get("text"): out["text"] = L["text"]
        if L.get("sub"): out["sub"] = L["sub"]
        if L.get("src"): out["src"] = L["src"]
        out["size"] = L.get("size", "hook" if i == 0 else "h1")
        out["at"] = round(t, 2)
        #  it leaves a third of a second before the next one lands, so the two
        #  cross rather than swap
        out["until"] = round(t + h - 0.34, 2)
        lines.append(out)
        t += round(h, 2)

    check_words(raw, notes)
    total = round(t, 1)
    if total < LEN_MIN:
        notes.append("the short is %.1f s, under the %.0f s floor" % (total, LEN_MIN))
    if total > LEN_MAX:
        notes.append("the short is %.1f s, over the %.0f s ceiling" % (total, LEN_MAX))

    #  ---- WHEN THE PICTURE ADVANCES -----------------------------------
    #  A brief may say, per line, how many pieces of the drawing land while
    #  that line is up. That is how a short is actually cut: the sentence and
    #  the stroke arrive together. Without it the pieces are spread evenly,
    #  which is never wrong and never as good.
    at, shots, k = None, [], 0
    if any("steps" in L for L in raw):
        at = []
        for i, L in enumerate(raw):
            n = int(L.get("steps", 0))
            start, end = lines[i]["at"], lines[i]["until"]
            i0 = k
            for j in range(n):
                #  the first stroke of the film lands almost at once, for the
                #  same reason the hook does not fade: frame zero has to have
                #  something in it
                lead = 0.10 if (i == 0 and j == 0) else 0.45
                at.append(int(round(1000 * (start + lead +
                                            (end - start - 0.9) * (j / max(1, n))))))
                k += 1
            #  ---- AND WHERE THE CAMERA IS WHILE THAT LINE IS UP -----------
            #  One move per line, never one per stroke. A drawing that is
            #  re-framed twenty times in a minute is a nervous film; a
            #  drawing that settles on the part being talked about, holds it,
            #  and then travels to the next part, is a made one.
            if n:
                shots.append(OD([("at", start), ("i0", i0), ("i1", k - 1)]))
            elif i == len(raw) - 1:
                #  the close sees the whole thing
                shots.append(OD([("at", start), ("all", True)]))
            else:
                #  A LINE THAT DRAWS NOTHING STILL GETS A MOVE.
                #  Otherwise the camera sits dead for six or seven seconds in
                #  the middle of a short, which on a feed is the moment the
                #  thumb goes. It pushes in on the last thing that landed
                #  instead, which is also what the sentence is about.
                shots.append(OD([("at", start), ("i0", max(0, k - 1)),
                                 ("i1", max(0, k - 1))]))
        at = at or None
    if not shots:
        shots = [OD([("at", 0.0), ("all", True)])]

    beat = OD()
    beat["kind"] = "plate"
    beat["plate"] = brief["plate"]
    beat["hold"] = total
    beat["lines"] = lines
    if at: beat["at"] = at
    beat["shots"] = shots
    #  ---- AND WHAT THE PICTURE DOES -----------------------------------
    #  A list of behaviours from web/behave.js, each pointed at part of the
    #  plate with a selector and timed to a SENTENCE rather than a second,
    #  so rewriting a line carries its motion with it. This is the half of
    #  a short that is the argument rather than the delivery.
    if brief.get("motion"):
        beat["motion"] = brief["motion"]
    beat["shot"] = "study"
    beat["enter"] = "slow"
    beat["exit"] = "slow"

    film = OD()
    film["slug"] = brief["slug"]
    film["id"] = brief["slug"]
    film["title"] = brief.get("title", brief["slug"])
    film["note"] = brief.get("note", "")
    film["short"] = True
    film["chapters"] = [OD([("id", "the-short"),
                            ("title", brief.get("title", "")),
                            ("theme", brief.get("theme", "nutvoid")),
                            ("short", True),
                            ("beats", [beat])])]
    return film, total, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("brief")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    brief = json.load(open(a.brief, encoding="utf-8"))
    film, secs, notes = build(brief)
    b = film["chapters"][0]["beats"][0]
    print("\n  %s" % film["title"])
    print("  plate: %s   %.1f s   (%s)"
          % (b["plate"], secs, "good" if LEN_MIN <= secs <= LEN_MAX else "OUT OF RANGE"))
    print("  %d picture steps timed\n" % len(b.get("at") or []))
    for L in b["lines"]:
        print("   %5.1fs  %-42s %s" % (L["at"], L.get("text", ""), L.get("sub", "")))
    if notes:
        print("\n  PROBLEMS")
        for n in notes:
            print("    " + n)
    if a.check:
        return 1 if notes else 0
    if notes:
        print("\n  not written. Fix the above first.")
        return 1
    p = os.path.join(HERE, "films", film["slug"] + ".json")
    open(p, "w", encoding="utf-8").write(json.dumps(film, ensure_ascii=False, indent=2) + "\n")
    print("\n  -> %s" % p)
    return 0


if __name__ == "__main__":
    sys.exit(main())
