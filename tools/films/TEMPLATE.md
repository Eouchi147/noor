# The NOOR film: the base template

Locked by the owner on 16 September 2026 on "The dark room" (`briefs/plate-darkroom.json`).
Every NOOR film is written, staged, lit, scored and checked this way. The floor is what a
film must meet to ship; the structure is how it is built so that forty films read as one
house. `VIDEO_ENGINE.md` is the map of the engine; this page is the standard.

## The floor (a film that fails one of these never ships)

1. The picture is one of the library's own plates (`figs/*.svg`, the illustration on the
   Light's page), never invented, never redrawn. Parallax off: every stroke on one plane.
2. Nine to ten sentences, 36 to 46 seconds; every fact on screen from the Light's own
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
