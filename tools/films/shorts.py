#!/usr/bin/env python3
"""NOOR - the silent short.

    python3 shorts.py briefs/isnad.json            write the film description
    python3 shorts.py briefs/isnad.json --check    just tell me if it fits

WHAT THIS FORMAT IS

The long films are watched. A silent short is READ, and that one difference
decides everything else about it.

Under narration a beat can hold eleven seconds, because the voice is carrying
the argument and the words on screen are a caption. With no voice the words
ARE the argument, and the viewer has to finish them before the next beat
arrives. So the hold is not a taste decision any more. It is arithmetic.

  THE READING MODEL, and where the numbers come from

  Subtitling practice puts comfortable reading at 12 to 17 characters a
  second, and that is for someone who also has the audio. Here there is no
  audio and the viewer is also watching a figure move, so attention is split
  and the honest rate is nearer eleven. On top of the reading there are two
  fixed costs the engine imposes: the headline arrives a word at a time on a
  70 ms stagger over a 1.1 s tween, and the last word needs to sit still for a
  moment or it reads as cut off.

      hold  =  1.0 entry  +  0.06 per word  +  chars / 11  +  0.6 settle

  Which is why the character caps below are what they are. A thirty second
  short with eight beats gives each beat 3.75 s. Subtract 1.6 s of entry and
  settle and 2.15 s of reading is left, and 2.15 s at eleven characters is
  TWENTY FOUR CHARACTERS. That is the whole budget. Four or five words.

  "Minimal words" is not a style note in this format. It is the only way the
  arithmetic closes.

ONE FIGURE, NOT EIGHT

A long film travels between stations, a new figure for each stretch of the
argument. Thirty seconds has no time to travel and no time to introduce a
second idea. So a short is ONE figure that develops continuously for its whole
length, with the words changing over it. That is also the engine at its best:
the thing it does better than a slideshow is exactly this.
"""
import argparse, json, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
OD = collections.OrderedDict

#  the reading model
#  Twelve rather than eleven characters a second: eleven was set for reading
#  a caption while a figure moved underneath it. A callout now sits in a
#  reserved band with nothing crossing it and the figure has settled into its
#  own part of the frame, so the reading is no longer competing for the eye.
ENTRY, PER_WORD, CPS, SETTLE = 1.00, 0.06, 12.0, 0.60
FLOOR = 2.2                      # nothing reads in under this, however short

#  ---- THE CAPS, AND WHY THEY ARE WHAT THEY ARE -------------------------
#
#  The first set of these was 28 characters for a headline and 26 for a
#  callout, derived from a reading rate and a 3.75 second beat. The
#  arithmetic was right and the result was wrong, and it is worth being
#  precise about how, because the failure was not in the numbers.
#
#  At 26 characters a callout cannot make a sentence, so it makes a note.
#  "Cairo, 1020s". "Latin, about 1200". "A Polish scholar". Every one of
#  those is true and none of them TEACHES anything: a viewer who did not
#  already know the story learns nothing from a date and a place. The owner's
#  word for the result was cryptic, and he was right. What was built was a
#  set of captions for a lecture nobody had given.
#
#  Two things had to change together for more words to be possible, and both
#  are now done in the engine rather than argued with here:
#
#    THE LABEL WRAPS. It was one line on a 900 pixel canvas, so a 27th
#    character ran off the end. It now wraps on MEASURED width in the real
#    font, up to two lines of headline and two of the line under it, and
#    steps the type down if a word still will not fit. See THE LABEL WRAPS
#    in web/lume.js.
#
#    THE BEAT IS AS LONG AS ITS OWN WORDS. A callout beat used to be given a
#    hold by hand, and every brief in the set said 4.4 because that is what
#    the first one said. The hold is now computed from the callout the same
#    way a headline's is computed from the headline, so writing a longer
#    sentence buys the seconds to read it and shows up in the total.
#
#  The caps below are therefore not the width of a line any more. They are
#  the point past which a single label is carrying more than one idea, and
#  the answer to that is another beat, not a smaller font.
#
#  The rule underneath all of it: a beat may say ONE complete thing, and a
#  viewer who knows nothing must be able to follow it. Anything that needs
#  outside knowledge to make sense is cut or explained.
CAP = {"text": 42, "sub": 44, "eyebrow": 30, "src": 44,
       #  the hook is 78px against a 14 character measure, so 42 is three
       #  lines, and three lines is what fits between the foot of the figure
       #  and the bottom of the frame. See DOM_ROOM below.
       "hook": 42,
       #  a callout and the line under it are read as one sentence
       "call": 52, "callsub": 62}

#  ---- AND HOW MUCH ROOM THE WORDS ACTUALLY HAVE ------------------------
#  The headline is drawn by the DOM, at the bottom of the frame, and the
#  figure is drawn by the light layer, in the middle of it. Neither knows
#  about the other, so the only thing stopping a four line hook from running
#  up into the picture is that nobody has written a four line hook yet.
#
#  In a 1080 by 1920 frame the figure is composed to 42% of the height about
#  the centre, so its foot is at 0.71 of the way down, which is 1363 pixels,
#  and the beat is set with 226 pixels of padding under it. What is left
#  between those two is the entire budget for eyebrow, headline, subtitle and
#  source, and a beat that spends more than it has is a beat whose words are
#  standing in the picture. That is the thing the owner sent back twice.
#
#  (It was 271 pixels while the figure took 48% of the height, which is why
#  a three line hook was the most that would fit. Dropping the figure to 42%
#  buys sixty pixels, and 42% of 1920 against 82% of 1080 is still a picture
#  that dominates the frame. See FILL_H in measure.py.)
DOM_ROOM = 331
#  the type, from web/film.html, as height per line and characters per line
DOM = {"eyebrow": (29, 30), "hook": (81, 14), "text": (57, 16),
       "sub": (52, 22), "src": (30, 34)}
DOM_GAP = 26

#  where a short is allowed to land. Under 15 s reads as an ad; over 50 s and
#  the platforms stop treating it as a short.
#  A LESSON IS LONGER THAN A CAPTION. 34 seconds was sized for a format that
#  showed a picture and named it. A short that explains something completely,
#  to somebody who knows nothing, needs the room to do it: a hook, the setup,
#  three or four steps of the actual mechanism, the turn and the payoff. Both
#  platforms that matter carry ninety seconds. Fifty five is the new middle.
LEN_MIN, LEN_SWEET, LEN_MAX = 30.0, 55.0, 78.0


def hold_for(*parts):
    """How long this beat has to stay up for someone to actually read it."""
    txt = " ".join(p for p in parts if p)
    if not txt.strip():
        return FLOOR
    words = len(txt.split())
    return max(FLOOR, ENTRY + PER_WORD * words + len(txt) / CPS + SETTLE)


#  ---- THE FOUR QUESTIONS, AND WHY THEY ARE NOW CHECKED ------------------
#
#  The owner watched the gold price short end to end and came away not
#  knowing who it was about, where it happened, or when. He was right, and
#  the transcript shows it exactly:
#
#      One pilgrim moved a whole market
#      Cairo's gold, before he arrives
#      One caravan, on the other side
#      The city cannot absorb it
#
#  Every line is true. Not one of them says that a king of Mali called Mansa
#  Musa, travelling to Makkah in the year 1324, spent so much gold in Cairo
#  that the price fell and stayed down for a decade. The name appears once,
#  in small type, on the last card. "He" arrives in the second line with
#  nothing to attach it to. "The city" is never named in a headline. A viewer
#  who did not already know the story is being asked to infer it from hints,
#  and nobody on a feed infers anything. They scroll.
#
#  So the format now has a law, and the law is checked rather than hoped for.
#
#      BY THE END OF THE SECOND BEAT the viewer knows WHO, WHERE and WHEN.
#      A named person or a named people. A named place. A year or a century.
#      In the headline, in ordinary words, not in an eyebrow at the end.
#
#      NO PRONOUN BEFORE ITS NOUN. "He", "it", "they" may not appear until
#      something has been named for them to refer to. This is the single
#      biggest source of the cryptic reading and it is mechanically
#      detectable, so it is mechanically forbidden.
#
#      PLAIN WORDS. The audience is everybody. A word that a twelve year old
#      would not use is flagged, and there is almost always a shorter one:
#      absorb becomes take, transmitter becomes person, observation becomes
#      watching. The picture carries the argument; the words only have to be
#      understood instantly.
#
#  None of this is a style preference. It is the difference between a film
#  that teaches somebody something and a film that flatters people who
#  already knew.

#  words that are allowed to be long, because they are names or because the
#  short is about them and spells them out
PROPER_OK = set("""Haytham Biruni Bukhari Khwarizmi Fibonacci Aldebaran Mansa Musa
Ibn Sina Nafis Servetus Qushji Samarkand Istanbul Baghdad Damascus Madinah
Toledo Basel Cairo Aleppo Nandana Pakistan Algeria Morocco Pisa Poland
Germany Syria Egypt India Spain France Java Arabia Persia Bugia Amwas
Makkah Mali Kepler Alhazen Witelo Umar Nadim Ijli Sufi Altair Vega Algol
Rigel Deneb Pleiades Sanskrit Arabic Latin English Indian Ottoman
astrolabe astrolabes Optics Canon Medicine Fihrist September""".split())

PRONOUNS = {"he", "him", "his", "she", "her", "hers", "they", "them",
            "their", "theirs", "it", "its", "this", "that", "these", "those"}

#  a long word is not automatically a hard word, but it is where hard words
#  hide. Twelve letters is the line: "understood" passes, "transmitter" does
#  not, and the exceptions above cover the names.
LONG = 11


def words_of(*parts):
    out = []
    for p in parts:
        if p:
            out += re.findall(r"[A-Za-z']+", p)
    return out


def plain_check(brief, beats):
    """the four questions, the pronouns, and the long words"""
    notes = []

    def shown(i):
        b = brief["beats"][i]
        return (b.get("eyebrow"), b.get("text"), b.get("sub"),
                b.get("call"), b.get("callsub"))

    #  ---- WHO, WHERE, WHEN, by the end of beat one --------------------
    opening = " ".join(x for i in (0, 1) if i < len(brief["beats"])
                       for x in shown(i) if x)
    has_when = bool(re.search(r"\b(1[0-9]{3}|[6-9][0-9]{2}|[0-9]{3,4}s|"
                              r"(eleventh|twelfth|thirteenth|fourteenth|fifteenth|"
                              r"sixteenth|seventeenth|eighteenth|nineteenth)\b|"
                              r"\b[0-9]{3,4} ?(BC|CE|AD)\b|\byears ago\b)",
                              opening, re.I))
    #  a name is a capitalised word that is not simply the first word of a line
    #  A NAME IS A NAME WHEREVER IT SITS IN THE LINE. Counting only
    #  capitals away from position zero missed "Cairo's gold, before he
    #  arrives", which does name a city; the fault there was that a city is
    #  not a person. So both are counted, and TWO distinct names are asked
    #  for, which in practice is the person and the place.
    caps = set()
    for i in (0, 1):
        if i >= len(brief["beats"]):
            continue
        for f in shown(i):
            if not f:
                continue
            ws = re.findall(r"[A-Za-z'-]+", f)
            for j, w in enumerate(ws):
                bare = w.strip("'").split("'")[0]
                parts = [bare] + bare.split("-")
                if (j and w[0].isupper()) or any(q in PROPER_OK for q in parts):
                    caps.add(bare)
    if len(caps) < 2:
        notes.append("the first two beats name %s. A viewer needs WHO and WHERE "
                     "before the third beat or the rest is a riddle: the person and "
                     "the place, in a headline, in plain words, not in an eyebrow at "
                     "the end" % (("only " + ", ".join(sorted(caps))) if caps
                                  else "nobody and nowhere"))
    if not has_when:
        notes.append("the first two beats give no date. A year, a century or "
                     "\"about a thousand years ago\" has to be on screen early, "
                     "because WHEN is half of why anyone cares")

    #  ---- a pronoun before there is anything for it to mean ------------
    #  AND THE NAME COUNTS FROM THE MOMENT IT IS WRITTEN, not from the next
    #  line. "Al-Bukhari kept only what he could prove" introduces the man
    #  and then refers to him, in that order, which is exactly right; an
    #  earlier version of this check read the whole line for pronouns before
    #  reading it for names and called it a fault.
    named = False
    for i, b in enumerate(brief["beats"]):
        for f in shown(i):
            if not f:
                continue
            ws = re.findall(r"[A-Za-z'-]+", f)
            for j, w in enumerate(ws):
                bare = w.strip("'").split("'")[0]
                parts = [bare] + bare.split("-")
                if (j and w[0].isupper()) or any(q in PROPER_OK for q in parts):
                    named = True
                    continue
                if not named and w.lower() in ("he", "him", "his", "she", "her",
                                               "they", "them", "their"):
                    notes.append("beat %d says %r before anybody has been named. "
                                 "Name the person first, in the same line or an "
                                 "earlier one" % (i, w))
                    named = True     # report once, not once per word

    #  ---- plain words --------------------------------------------------
    for i, b in enumerate(brief["beats"]):
        for w in words_of(*shown(i)):
            if len(w) > LONG and w not in PROPER_OK and w.capitalize() not in PROPER_OK:
                notes.append("beat %d uses %r. This is for everybody, so there is "
                             "almost always a shorter word that means the same "
                             "thing" % (i, w))
    return notes


def dom_height(eyebrow, text, sub, src, size):
    """How tall the words at the foot of the frame come out, in pixels.

    Every line of this is read off web/film.html: the type sizes, the line
    heights and the measures are declared there per frame shape and this is
    the same arithmetic done ahead of the render. It is an estimate in one
    respect only, that it divides characters by the measure rather than
    setting the type, and text-wrap:balance can only ever give the same
    number of lines or fewer. So it never under-counts, which is the
    direction that matters.
    """
    import math
    h, first = 0, True
    for field, val in (("eyebrow", eyebrow), (size, text), ("sub", sub), ("src", src)):
        if not val:
            continue
        lh, ch = DOM[field]
        h += lh * max(1, int(math.ceil(len(val) / float(ch))))
        if not first:
            h += DOM_GAP
        first = False
    return h


def build(brief):
    """A brief is the short in the fewest keystrokes that can describe it."""
    beats, notes = [], []
    n = len(brief["beats"])
    for i, b in enumerate(brief["beats"]):
        text = (b.get("text") or "").strip()
        sub = (b.get("sub") or "").strip()
        eyebrow = (b.get("eyebrow") or "").strip()
        src = (b.get("src") or "").strip()
        for f, v in (("text", text), ("sub", sub), ("eyebrow", eyebrow), ("src", src)):
            if v and len(v) > CAP[f]:
                notes.append("beat %d: %s is %d characters, cap is %d -- %r"
                             % (i, f, len(v), CAP[f], v))
        #  AND DO THE WORDS FIT UNDER THE PICTURE. See DOM_ROOM.
        size_cls = "hook" if (i == 0 and text) else "text"
        if b.get("size") in ("hook", "text"):
            size_cls = b["size"]
        dh = dom_height(eyebrow, text, sub, src, size_cls)
        if dh > DOM_ROOM:
            notes.append("beat %d: the words come to %d px and there are only %d "
                         "between the foot of the figure and the bottom of the "
                         "frame. Cut a line, or move the source to its own beat."
                         % (i, dh, DOM_ROOM))
        beat = OD()
        beat["kind"] = "title" if text else "statement"
        #  THE FIRST BEAT IS A HOOK, NOT A TITLE, and it is set as one.
        #  A feed gives a short about a second. What has to be in that second
        #  is a claim large enough to read without deciding to, so the opening
        #  beat carries its own type size and everything after it is a
        #  headline. An author can override by naming a size in the brief.
        if i == 0 and text:
            beat["size"] = b.get("size", "hook")
        elif b.get("size"):
            beat["size"] = b["size"]
        if eyebrow: beat["eyebrow"] = eyebrow
        if text: beat["text"] = text
        if sub: beat["sub"] = sub
        if src: beat["src"] = src
        #  A BEAT WITH NO WORDS IS NOT A SHORT BEAT.
        #  The reading model sets the hold from the words, which is right for
        #  a beat that has words. Once the callouts carry the argument most
        #  beats have none, and the floor of 2.2 s is far too quick to watch a
        #  figure do something. So a wordless beat may name its own hold, and
        #  that is the author saying how long this part of the animation takes.
        #  A BEAT IS AS LONG AS THE WORDS IT SHOWS, WHEREVER THEY ARE SET.
        #  This used to read the headline only, so a beat whose words were in
        #  a callout got the 2.2 second floor and the author typed a hold by
        #  hand to fix it. Every brief in the set then said 4.4, because the
        #  first one did, and a callout that grew from four words to twelve
        #  still got 4.4 seconds and could not be read. The reading model is
        #  the same model wherever the words are; it just has to be given all
        #  of them.
        shown = (eyebrow, text, sub, b.get("call") or "", b.get("callsub") or "")
        auto = hold_for(*shown)
        #  and a beat that points at the picture holds a moment longer than
        #  reading alone asks for, because the eye has to travel: label,
        #  leader, mark, and back. Measured off a sheet at about half a
        #  second each way.
        if b.get("call"):
            auto = max(auto + 0.9, 4.8)
        beat["hold"] = round(max(float(b["hold"]) if b.get("hold") else 0.0, auto), 1)
        #  and the hook is held a beat longer than its own word count asks
        #  for. The reading model sizes a beat for somebody who has already
        #  decided to read it; the first beat is being read by somebody who
        #  has not, and a claim that leaves before it has been taken in has
        #  not been made at all.
        if i == 0 and text:
            beat["hold"] = round(max(beat["hold"], 4.6), 1)
        beat["shot"] = "study"
        #  A SHORT DOES NOT DISSOLVE. Half a second of crossfade out of thirty
        #  is a sixtieth of the film spent on a transition, and on a phone it
        #  reads as lag. Everything cuts except the way in and the way out.
        beat["enter"] = "slow" if i == 0 else "cut"
        beat["exit"] = "slow" if i == n - 1 else "cut"
        beats.append(beat)

    #  ONE FIGURE, THE WHOLE WAY. It is declared on the first beat and spans
    #  every one of them, so it develops continuously underneath the words
    #  instead of restarting.
    fig = OD(brief["figure"])
    fig["span"] = len(beats)
    #  THE LEGEND HAS THE FLOOR OF THE FRAME AND THAT IS ALL IT HAS.
    #  It hangs from its top edge at 0.55 of the way down and grows toward
    #  the bottom, so its height is its own business up to the point where it
    #  runs off the frame. Three rows is where that happens.
    if len(fig.get("key") or []) > 3:
        notes.append("the legend has %d rows and three is what fits below the figure "
                     "in a tall frame" % len(fig["key"]))
    for kr in (fig.get("key") or []):
        if len(kr) > 1 and len(str(kr[1])) > 30:
            notes.append("legend row %r is %d characters and the panel holds 30"
                         % (kr[1], len(str(kr[1]))))

    #  THE CALLOUTS ARE COMPILED FROM THE BEATS, SO NOBODY TYPES A TIMESTAMP.
    #  A callout is written on the beat it belongs to, because that is the
    #  unit the author is already thinking in: "on this beat, point at the
    #  middle column and say Good". Here that becomes an absolute time,
    #  because the engine needs milliseconds and a person should not have to
    #  add up holds in their head, or redo the sum every time a word changes
    #  earlier in the film.
    #
    #  It also enters a beat late and leaves early. A label that arrives with
    #  the cut is part of the cut; one that arrives a third of a second after
    #  it reads as the picture being pointed at, which is the whole idea.
    calls, t = [], 0.0
    for i, b in enumerate(brief["beats"]):
        hold = beats[i]["hold"]
        if b.get("call"):
            if not b.get("to"):
                notes.append("beat %d has a callout with no point to attach it to "
                             "(give it \"to\": [x, y] in the figure's own units)" % i)
            c = OD()
            c["atMs"] = int(round((t + 0.34) * 1000))
            c["holdMs"] = int(round((hold - 0.34 - 0.30) * 1000))
            c["text"] = b["call"]
            if b.get("callsub"): c["sub"] = b["callsub"]
            c["to"] = b.get("to", [0, 0])
            #  AND WHICH PART OF THE PICTURE THE AUTHOR MEANT, BY NAME.
            #  The coordinate above is a cache: anchors.py resolves this
            #  selector against the marks the figure is actually drawing on
            #  this beat and writes the number back. Keeping the selector in
            #  the brief is what makes the number re-derivable, so a figure
            #  can be rebuilt or re-measured without every leader in the set
            #  quietly going stale. "hold" means the coordinate was chosen by
            #  hand and is not to be solved.
            if b.get("at"): c["at"] = b["at"]
            c["side"] = b.get("side", "up")
            if len(c["text"]) > CAP["call"]:
                notes.append("beat %d: the callout is %d characters and the cap is %d. "
                             "Past that it is carrying two ideas, and the answer to two "
                             "ideas is two beats"
                             % (i, len(c["text"]), CAP["call"]))
            #  THE SECOND LINE, and why its cap moved. It was 30 characters,
            #  and that was a measurement rather than a preference: the label
            #  leaned away from the edge it pointed at, so a sub line wider
            #  than the line above it stuck out past the lean and ran off the
            #  frame. On a rendered sheet "set aside, and said so out loud"
            #  lost its last four characters.
            #
            #  The label does not lean any more. It is centred, it holds
            #  still, and the leader does the pointing, which gives the words
            #  90% of the frame instead of 60% and lets both lines wrap. The
            #  cap that is left is about sense, not width.
            if b.get("callsub") and len(b["callsub"]) > CAP["callsub"]:
                notes.append("beat %d: the callout's second line is %d characters and the "
                             "cap is %d" % (i, len(b["callsub"]), CAP["callsub"]))
            calls.append(c)
        t += hold
    if calls:
        fig["calls"] = calls
    if fig.get("key") and "keyAtMs" not in fig:
        #  THE LEGEND TAKES THE BEATS THAT HAVE NO HEADLINE.
        #  It comes up once the second callout is on screen, which is about
        #  when the second colour first appears and the distinction it
        #  explains becomes a real question, and it leaves before the next
        #  beat that carries a headline, because in a tall frame those two
        #  want the same floor of the picture.
        starts, acc = [], 0.0
        for bb in beats:
            starts.append(acc); acc += bb["hold"]
        t0 = (calls[1]["atMs"] / 1000.0) if len(calls) > 1 else 4.0
        t1 = acc
        for i, bb in enumerate(beats):
            if starts[i] > t0 and (bb.get("text") or bb.get("eyebrow")):
                t1 = starts[i] - 0.5
                break
        fig["keyAtMs"] = int(round(t0 * 1000))
        fig["keyHoldMs"] = max(3500, int(round((t1 - t0) * 1000)))
    #  Nothing else to set. The engine remaps the figure's clock by itself on
    #  any film marked short: the opening slice of the film covers the
    #  figure's fade-in so the first beat is never a blank frame, and the rest
    #  covers its motion so the arrival lands on the last beat instead of two
    #  thirds through. See THE SHORT WARP in web/stage.js for the arithmetic
    #  and for the measurement that produced it.
    beats[0]["lume"] = fig

    #  AND THE WRITING LAW. See THE FOUR QUESTIONS above. These are not
    #  style notes; each one is a thing that made a finished short unreadable
    #  to somebody who did not already know the answer.
    notes += plain_check(brief, beats)

    secs = sum(b["hold"] for b in beats)
    if secs < LEN_MIN:
        notes.append("the whole short is %.1f s, which is under the %.0f s floor" % (secs, LEN_MIN))
    if secs > LEN_MAX:
        notes.append("the whole short is %.1f s, which is over the %.0f s ceiling" % (secs, LEN_MAX))

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
                            ("beats", beats)])]
    return film, secs, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("brief")
    ap.add_argument("--check", action="store_true", help="report and write nothing")
    a = ap.parse_args()
    brief = json.load(open(a.brief, encoding="utf-8"))
    film, secs, notes = build(brief)

    print("\n  %s" % film["title"])
    print("  %d beats, %.1f s   (%s)" % (
        len(film["chapters"][0]["beats"]), secs,
        "good" if LEN_MIN <= secs <= LEN_MAX else "OUT OF RANGE"))
    print("  one figure: %s\n" % film["chapters"][0]["beats"][0]["lume"]["kind"])
    t = 0.0
    calls = {c["atMs"]: c for c in
             (film["chapters"][0]["beats"][0].get("lume", {}).get("calls") or [])}
    for i, b in enumerate(film["chapters"][0]["beats"]):
        c = calls.get(int(round((t + 0.34) * 1000)))
        #  a beat is shown as what a viewer would actually see on it: the
        #  headline if it has one, the callout if that is where its words are
        where = "HEAD" if b.get("text") else ("call" if c else "    ")
        line = b.get("text") or (c["text"] if c else "")
        sub = b.get("sub") or (c.get("sub", "") if c else "")
        print("   %2d  %5.1fs  %4.1fs  %s  %s" % (i, t, b["hold"], where, line))
        if sub:
            print("                        %s" % sub)
        t += b["hold"]
    if notes:
        print("\n  PROBLEMS")
        for nn in notes:
            print("    " + nn)
    if a.check:
        return 1 if notes else 0
    if notes:
        print("\n  not written. Fix the above first.")
        return 1
    p = os.path.join(HERE, "films", film["slug"] + ".json")
    open(p, "w", encoding="utf-8").write(json.dumps(film, ensure_ascii=False, indent=2) + "\n")
    print("\n  -> %s" % p)
    print("     python3 noor.py --film %s --shape tall --encode" % film["slug"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
