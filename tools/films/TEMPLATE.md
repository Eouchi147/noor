# The NOOR film: the base template

Locked by the owner on 16 September 2026 on "The dark room" (`briefs/plate-darkroom.json`).
Every NOOR film is written, staged, lit, scored and checked this way. The floor is what a
film must meet to ship; the structure is how it is built so that forty films read as one
house. `VIDEO_ENGINE.md` is the map of the engine; this page is the standard.

## The floor (a film that fails one of these never ships)

1. The picture is one of the library's own plates (`figs/*.svg`, the illustration on the
   Light's page), never invented, never redrawn. Parallax off: every stroke on one plane.
2. Nine to ten sentences, 36 to 52 seconds; every fact on screen from the Light's own
   text and sources; the last card carries the person, the place, the work and the date.
3. One slow, continuous camera move per sentence, easing in and out across the sentence;
   no sway, no pre arrival, no closing push; a sentence that adds nothing holds with a
   slight pull back; the last sentence pulls to the whole drawing. No label is ever cut.
4. Focus: what the sentence names is at full strength; the rest steps back to 42 percent
   and softens over 1.2 s; the payoff sentence restores everything.
5. Captions fade in from transparent and blurred to sharp (1.1 s; the first 0.7 s) and
   leave into blur (0.7 s); one line on screen at a time; the reading model sets their
   length (entry 0.75 s, 0.05 s a word, 15 characters a second, settle 0.45 s, floor 2.2 s,
   the hook at least 3.9 s).
6. No synthetic voice. The score (the two Suno pieces) at minus 15.5 dB RMS, one struck
   voice, a mark on every event of the drawing (a light setting out, a light arriving, a
   pulse) and the first step under each sentence, master at minus 14 LUFS; the owner's
   own recording, when it exists, replaces the silence and the film retimes to it.
7. The picture area and the word band on the golden ratio division of the frame; the
   watermark (the mark and noorcodex.com) inside the safe margins on every frame.
8. Both shapes from one brief (9:16 for the feeds, 16:9 for YouTube), 30 fps, a three
   sample shutter, rendered on the Mac by `./plates.sh <brief>`.
9. `audit.py <slug> --shape tall` and `--shape wide` green: no dash on screen, a change
   every 2 to 4 s, the first frame has something to look at, no frame black or blown, the
   watermark lit, the words inside the safe area, loudness and peak, marks on events,
   lengths agreed. The owner's eye last.

## The structure (the scene architecture every brief follows)

A film is one drawing that builds in the order it was drawn, and one sentence at a time
over it. The sentences follow one arc:

| Beat | Sentences | What it does | Camera | Light |
|---|---|---|---|---|
| The hook | 1 | A claim in the viewer's own world, six to nine words ("Your camera is named after a room", "One book was checked 600,000 times") | tight on the first thing drawn | nothing yet |
| The place | 1 | City, region, year, and the person by name in the sub line | the second thing drawn, a little wider | the person's mark or the first object pulses once |
| The mechanism | 3 or 4 | Each sentence adds exactly one visible thing, in the drawing's own order, and says only what that thing does | to the thing added, nothing else | a light travels along the path the sentence describes (travel, trace, pour, flow, sweep) and a mark lands when it arrives; the named element glows |
| The turn | 1 or 2 | The older idea, or the test, or what was thrown out; a strike, a cross, a rejection in the drawing | to the crossed element | the rejected thing dims; the kept thing glows |
| The payoff | 1 | The one sentence the film exists to say, over the whole drawing | pull to the whole | the whole drawing at full strength; the last travel completes under this sentence |
| The source | 1 | Eyebrow: the person and the place. Text: the term or the fact in its own words. Src: the work and the date | hold the whole, a slow pull of 2.5 percent | the light rests on the drawing's centre |

Rules of the arc: a number appears in the first two sentences; two names capitalised in
the first three; no pronoun before its name; every sentence adds one thing or names one
turn, never two; the payoff never introduces a new element.

## The brief (what the writer hands in)

`briefs/plate-<slug>.json`: `slug` (short-<slug>), `title`, `theme` (nutvoid), `plate`
(the figure's id in `figs/`), `note` (one sentence, the film's argument), `lines` (each:
`text`, optional `sub`, `eyebrow`, `src`, and `steps`: how many of the plate's drawing
steps this sentence reveals; the steps of all lines add up to the plate's step count from
`plateplan.py <plate>`), `motion` (each: `do` one of travel, flow, pour, trace, sweep,
pulse, count, orbit, glow; `on` a CSS selector into the plate; `at` the line index it
belongs under; `for` seconds; optional `times`, `size`, `delay`). Every mechanism
sentence has at least one motion or a glow on the element it names; the payoff sentence
has the last travel; the source has none.

## The check before the owner sees it

`python3 shortplate.py briefs/plate-<slug>.json` (the reading model and the four
questions), stills at the midpoint of every line in both shapes (`noor.py --stills`),
looked at one by one against the table above, then the render and `audit.py`. A film
the Director has not looked at frame by frame is not handed over.

## What a film is for

Two to four a week for ninety days and beyond: each takes a reel's slot in the rota (or
an extra slot on a network with room), with its own caption, its sources in the first
comment where a network allows it, and the Light's room as the link. The film is the
library's own illustration, moving; the room is where the reader goes next.

## The writing law (the owner, the evening of 16 September 2026)

The films are for people who scroll fast and will not break their heads. Every brief
obeys this before anything is staged:

1. **Line one says the whole point** in plain words a stranger understands with no
   context, in the viewer's own world, in at most 42 characters. A claim, never a
   riddle, never a metaphor. "Your camera is named after a room." "One man checked
   600,000 hadith reports."
2. **Line two names the person with what he was**, the place and the year: "Cairo, the
   year 1020" with the sub "Ibn al-Haytham, a scientist, lights a candle". A stranger
   does not know who Ibn Khaldun is; the film tells him: a historian.
3. **One plain step per line**, lines three to six: a complete sentence that stands on
   its own, cause then effect, everyday words, present tense, a number where there is
   one. No line refers to a thing the viewer has not seen yet; no pronoun without its
   name in the same line or the one before.
4. **The turn**: "Before him, everyone thought ..." or "The old way was ...", a plain
   contrast the viewer can picture.
5. **The payoff**: what it means for the viewer today, in the viewer's world: "Every
   phone camera works this way." "Every hadith you read passed his test."
6. **The source card**: the person, the place, the work, the date.
7. **Words**: everyday English; a technical word never appears without its plain word
   beside it (asabiyya, group loyalty); sentences of eight words where possible; concrete
   nouns; no cleverness that costs a second of understanding.
8. **The test**: read the nine lines with no picture. If a twelve year old cannot retell
   the story in one sentence, rewrite. The refuter runs this test on every brief.

## The worship films (the owner's call, 17 September 2026)

The library's history and discovery plates are used up at forty one films. The drawings that
remain are mostly worship and belief, and the owner chose to open a second series on them:
how the Hajj is actually made, Ramadan, the prayer. Everything above still holds. Four
things are added, because a film that teaches a practice can do a kind of harm a film about
a dead astronomer cannot.

1. **When** is a month of the Hijri year, not a year that happened once. "The eighth of Dhul
   Hijjah" answers the template's own question as precisely as "the year 1020", and
   `shortplate.py` now accepts the twelve month names for exactly this.
2. **Where the schools differ, the film says so**, on screen, in the same plain words as
   everything else: "the Hanafis hold ..., the others ...". A practice film that flattens a
   real disagreement into one answer is teaching the viewer something false about his own
   religion, and it is worse than no film.
3. **Nothing is graded above what the page grades it.** The pages already mark what is a
   pillar, what is an obligation, what is a sunnah and what the cost of leaving each is. The
   film carries that grading exactly, and never turns a sunnah into a duty by omission.
4. **The source card names the page, not a person.** A practice has no author. The eyebrow
   is the practice and its place, the src is where in the library it is set out.

The refuter checks every worship brief twice: once against the page as usual, and once
against these four.

## The sound law (the same evening)

Subtle, with reverb. At most eight struck marks a film: the first step under the hook,
one arrival per sentence that has a travelling light, and the payoff; never two inside
1.6 s. The marks sit about 9 dB lower than before (minus 38 dB RMS against the music at
minus 15.5), the felt voice by default, the hall wetter and longer so each mark is a
distant touch under the music, never a strike in front of it. The score carries the
film; the marks only agree with it.
