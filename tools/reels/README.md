# NOOR reels

Twenty second vertical videos for Instagram and Facebook Reels, built from the
same 350 card library the site's daily Light comes from. Reels are the only
surface either platform shows to people who do not already follow the account,
so this is the growth path; everything here exists to make a stranger stop, and
then to teach them one true thing well enough that they look the account up.

Every frame and every second of sound is generated. There is no photograph, no
stock footage, no sample and no voice: the picture is Islamic star polygon
geometry drawn from a seed, the sound is notes placed on the card's own
timeline and played into a synthesised hall, and the words are the card's own. So there is no licence to honour,
no attribution to print, no dead link in two years, and no way for a figurative
image or a depiction of a prophet to reach the frame through a stock search.

    plan.json          the 30 cards: the script and the look for each
    BRIEF.md           the contract every script is written against
    copy_audit.py      checks a script against the card it came from
    spec.py            the frame, and the part of it the platforms leave alone
    geom.py            star polygon fields
    cine.py            the moving picture
    sound.py           the bed under it
    web/               the type layer: anime.js, the page, the fonts
    webreel.py         renders one card, and audits the safe area
    render_missing.py  renders whatever plan.json has that reels/ does not,
                       or `all` to render the whole library again

## How a reel is made

Two engines share one clock.

The **type layer** is a page in a headless Chromium, animated with
`web/anime.min.js`: a byte for byte copy of the site's own `assets/anime.min.js`
(v4.5.0, the custom NOOR build). The timeline is built with `autoplay: false`
and never plays. It is seeked to an exact millisecond for each frame and
screenshotted with a transparent background.

The **picture** is drawn for the same instant by `cine.py` in numpy: a dark sky,
one screen of geometry far back and out of focus, a defocused rosette in the
foreground, a drifting star field, dust, a lamp that breathes, grain and a
vignette, and behind the words a *subject* chosen for the card. `andromeda` is a
faint cloud that blooms as the sentence about it lands; `epicycles` is two
uniform circles tracing the path they make; `moon` waxes across the run;
`arcade`, `pages`, `ripples` and `rosette` draw themselves open.

`webreel.py` composites the two and pipes the result to ffmpeg. About three
minutes of CPU a reel.

## The opening second

A reel lives or dies in its first second, so that second is where the work went.
A bloom opens over the frame and a streak of light crosses it; the mark draws
its own rule; the claim arrives word by word out of blur, rising and settling
about fifty milliseconds apart; and the phrase carrying the surprise turns gold
and underlines itself as it lands. The whole claim is readable by about 1.2
seconds. Each card names that phrase in its `key` field, so which words carry
the reel is an editorial decision, not a guess.

## The sound

Music is contested in Islamic law and this is a library, not a personal
account, so the bed has no percussion, no pulse, no instrument sample and
nothing licensed. It is notes, and every note is something the picture does.

The pitch set is **suspended**: root, fourth, fifth, octave, ninth, eleventh,
twelfth. There is no third anywhere in it, so it never resolves major or minor
and never arrives -- which is both why it stays clear of what is argued about
and why it sounds the way it does. Floating is what an unresolved fourth
sounds like; the constraint and the effect turned out to be the same thing.

Two layers, both built in `sound.py`:

**The pad** is three long tones that swell in over a second or two and hold, so
there is always something sounding and the reel never thins out between events.
The third of them opens as the substance arrives.

**The struck notes** sit on top, one for each thing that happens on screen. The
bloom opens on the fifth; the root arrives under it; the phrase that turns gold
gets the highest note in the set and then settles an octave below it; the date
rules in on the fourth; each block of substance takes the next step of a
wandering figure with a quiet root beneath it; and the way home is the root
again. Nothing is on a grid and nothing repeats. The rhythm of the sound is the
rhythm of the animation, because they are placed from the same timeline.

The voice is a glass pad: partials slightly sharp and dying sooner the higher
they are, which is what a struck thing does. Each partial is doubled and
detuned so it shimmers -- but a long note is detuned four times less than a
short one, and each partial by a different amount. A beat that is shimmer on a
bell becomes a tremolo on a tone held for twenty seconds, and a tremolo that
never stops is a pulse, which is the one thing this bed must not have.

They are played into a synthesised hall: a real convolution, not a delay
pretending. The impulse is noise decaying band by band, the highs absorbed
first as they are by everything a room is made of, about three seconds to
-60 dB. A tail whose bands all die together sounds like a machine; this one
does not.

Under all of it, quietly, a drone at the root four octaves down with its octave
split 4.5 Hz between the ears -- theta binaural on headphones, a slow breathing
when a phone speaker sums the two -- and a little air.

Under those, the sub: the root two octaves down with its second harmonic
beside it, so a phone that cannot play 31 Hz still hears the weight. It swells
on the moments the picture blooms, and a breath of filtered noise is drawn in
before the word lands and before the way home. Each kind has its own score
(`_score_for` in `sound.py`): The word's one big chord as the Arabic lands,
This day's root under the numeral and a bright fifth under what to do. In One
verse nothing else sounds while the Qur'an is recited: the whole bed goes to
silence in the half second before the voice and returns in the half second
after it, and the notes speak only before and after; the voice is high passed at
80 Hz, trimmed of its silence, and given a little of the same hall, so it
stands in the room the notes are in. A verse reel is levelled to -16 LUFS,
speech's level; the rest stay at -18.

The notes are pitched four octaves above the drone on purpose. A phone speaker
rolls off hard below about 400 Hz; the body is there for headphones, but what
carries the reel on a handset is the notes.

Every reel is written to -18 LUFS integrated, measured with `ebur128` on the
bed and then checked again on the finished mp4, because what ships is what came
out of the encoder. An account whose posts jump in volume is an account people
mute. `sound.check()` fails a render that has no audio stream, is not stereo
AAC at 48 kHz, misses the loudness by more than 1.5 LU, or peaks within a
decibel of clipping.

Most reels are watched muted, and these are text-driven, so they still work in
silence. The sound embellishes; it is never what the reel depends on.

## The safe area, and why it is measured in pixels

Both platforms paint their own furniture over the frame. `spec.py` holds the
rectangle that is left: x 84 to 950, y 270 to 1500, tighter than Meta's own
organic guidance on every edge, with the right margin clearing the button rail
rather than only the frame edge.

    python3 webreel.py --audit

draws the type layer alone on black, with the opening bloom and streak switched
off because they are light rather than information, samples every fifth frame of
every card, and takes the bounding box of the ink. An overrun measure, one line
too many, two blocks colliding and a word that bleeds while it is still blurred
all move that box, so the box is the honest test. `render_missing.py` audits
everything before it encodes anything: a card that does not fit stops the run.

The layout fits itself to that rectangle. The hook walks down from 78px until
it wraps to at most four lines, then the body walks down from 44px until the
column fits, with a floor of 36px because below that the substance stops being
read on a phone. If no hook size can house a 36px body, the hook gives way
first. The measurement that decides is taken with the timeline in place and
everything at rest: measuring the column mid build reported it eighty pixels
shorter than the one that actually renders, and cost a card that overran.

## The second cut: the picture is light, the timing is a grid

The picture is no longer drawn in numpy. `web/scene.js` is one fragment
shader, run in the same headless Chromium that animates the words (with
SwiftShader on a machine that has no GPU, which is every runner): sky, haze,
the house geometry, the subject of each kind, rays, bloom, grain and the
grade, at 405x720 under a full-resolution DOM. One JPEG screenshot per frame
is the finished picture and goes straight to ffmpeg. The type layer tells
the shader what each instant is: the cue, the blooms and hits it placed, the
reciter's loudness, where the subject stands. `cine.py` and `geom.py` are
no longer used.

Every kind but One verse has a tempo (`BPM` in `type.js`: the day's card 96,
Did you know 108, This day 84, The word 92, The Codex 120), and every moment
of its timeline is quantised to an eighth of it, so the words, the swells,
the risers and the notes land together. No beat is ever sounded. The sound
is finished in Pedalboard (`_master`, `_voice_chain`, `_saturate_sub` in
`sound.py`): a shelf for weight, a slow glue compressor, tape-like harmonics
on the sub so a phone hears it, a levelled and de-essed voice, and a
hand-made soft ceiling after the loudness is set.

## The six kinds

One plan, five kinds of card, one opening they all share: the bloom, the
streak of light, the mark drawing itself. Then each goes its own way.

| kind    | what it is                                              | length   | the words come from                 |
|---------|---------------------------------------------------------|----------|-------------------------------------|
| `light` | the day's card: a claim, a dateline, three sentences    | 20 s     | `plan.json`, written by hand        |
| `know`  | Did you know?: the claim, one sentence of evidence      | 13 s     | `know.json`, written by hand        |
| `day`   | This day: the numeral of the Hijri date, the day's name | 13 s     | `calendar.json` from `api/_calendar.js` |
| `word`  | The word: the Arabic itself, centred, then its meaning  | 14 s     | `build/dict-*.json`, verbatim       |
| `verse` | One verse: the Arabic in the Quran cut, the meaning by sentence under the recitation | the voice decides | `quran-uthmani.json` (Tanzil), `verses.json` (Saheeh International), everyayah.com |
| `codex` | The Codex: the library's own blueprint, counters ticking up on the beat, one room, the ask | 10 s | `assets/menu-index.json`, the dictionary, the lights |

`plan_build.py` writes `plan.json` from those sources and keeps the hand
written cards exactly as they are, so running it again changes nothing that
was reviewed. `copy_audit.py` knows every kind: a word's `short` must be the
dictionary's own, a day's lines must be in the calendar's text, a Did you
know's numbers and names must be in its Light card.

The two centred kinds get their own picture: The word stands on a mandala
that draws itself and turns, with a disc of light behind the word that
brightens as it lands; One verse stands in a halo of rings that breathe
with the reciter's voice, because the renderer measures the recording's
envelope and hands it to the picture, so the two can never drift apart.
This day carries a ring of twelve marks with this month's lit and a
crescent inside it. All three have light rays turning slowly behind them.

One verse is built around its recording. `verses.py` holds a roster of
twenty reciters from everyayah.com, each named on screen and in the caption.
A different one is chosen for each verse in turn; the slow mujawwad readings
are offered only to short verses, the murattal readings to anything longer,
and a reading that still runs past forty six seconds gives way to the next.
The reel's length follows from the voice: 2.6 s in, the recitation, 1.35 s,
then three seconds of the way home.

The rota in `api/_schedule.js` gives five reel slots a day to the kinds by
weekday (morning 08:00, noon 11:00, afternoon 14:00, evening 17:00, night
21:00 UTC). Across a week that is 11 verses, 9 words, 6 Names, 6 Did you
knows, 2 day's cards and a du'a on Thursday night; a This day reel takes the
morning of its own Hijri date. Each kind is walked by the running count of
its slots since Sunday 6 September 2026 (`reelStep`), so no card is shown
twice in a day and, with 300 verses on the shelf, a verse does not come round
inside six months. `node tests/reels-kinds.mjs` holds it, including a walk
of the whole six months.

## How one gets posted

`api/_schedule.js` has five reel slots, `reelA` 08:00, `reelC` 11:00, `reelD`
14:00, `reelB` 17:00 and `reelE` 21:00 UTC, between the five card slots that
already existed. Each hour the `due` cron asks
what is owed; a reel slot fetches `/reels/index.json`, the manifest the render
workflow writes, and picks the day's card from the half of the library that
belongs to it. The pick walks the whole list before it repeats and depends only
on the date, so two servers waking on the same morning agree and a retry cannot
post a different reel.

The manifest lists only cards that HAVE a rendered video, so a card added to
the plan but not yet rendered can never be chosen, and no slot can ever point at
a file that is not there. A slot with nothing to post composes to nothing and
says so: the day loses one post and the rest go out as usual.

The caption is carried whole from `plan.json` rather than assembled, because it
was written and audited beside the video. A reel is offered to Facebook,
Instagram, YouTube (as a Short) and Pinterest (as a video pin on the board of
its kind); the other channels would fall back to the cover, and a still of a
video is a poor post. On Facebook and Instagram every reel and every card is
also put up as a story once the feed post has landed (`addStories` in
`api/social.js`, the `social.stories` dial); a story that fails is noted and
never decides the slot's state.

Instagram is the awkward half. Creating the container returns at once, but the
video is then transcoded and publishing before that finishes is refused. So the
sender waits about thirty seconds, and if the wait runs past what a serverless
function may spend it hands back the container id, the slot is recorded as
`pending` rather than failed, and the next hourly run publishes it. Facebook
takes a reel in three phases and fetches the file itself, so none of the bytes
pass through the site.

`node tests/reels.mjs` holds all of that with Meta stubbed: 78 checks, including
that a token never reaches a URL, that a pending container is finished later
rather than lost, and that a reel post with no video is refused rather than sent
as a photo.

### A reel leaves the shelf once every network has it

The owner's rule of 9 September 2026: a reel that is up on the networks is
not needed any more. The poster keeps a ledger, reel id to the date the
whole slot went out (`nsoc:reels:posted`, written by `writeSlot` whenever a
reel's record reads `sent`: every live network answered yes, none is still
processing, no story container is pending). It answers the ledger in public
at `/api/social?action=posted`, less the last three days, because a slot is
not final the minute it is written. The weekly render run copies that
answer into `posted.json` (`posted_fetch.py`, which keeps the old file when
the site cannot be read), `plan_build.py` leaves those cards out of the
plan, and `render_missing.py --manifest` takes a card that is not in the
plan off the shelf: the sidecar, the cover, and the video on the store. Four
kinds retire, a verse, a word, a Did you know and a day's card; This day,
the Names and the du'as recur by design and stay. `node tests/retire.mjs`
holds it: what counts as done, the margin, the public read, and that a slot
the healer mends lands on the ledger like one that went out clean.

The shelf therefore drains at about 28 reels a week, and is refilled by
adding cards: verse references to `verses.txt`, Did you knows to
`know.json`, day's cards to `light.json`; the dictionary is on the shelf
whole.

## Adding a card

1. Pick it from `lights/all.json`.
2. Write its script against `BRIEF.md`. Nothing may be invented: every number
   and every capitalised name has to be findable in that card's own text,
   because a reel is screenshotted and argued with far more often than a page.
3. Add it to `plan.json` with a `look` (a Did you know? goes in `know.json`
   with one line; a word, a day or a verse is not written at all: put the word
   in `plan_build.py`'s list, the verse in `verses.txt`, and the day is
   already in the calendar).
4. `python3 copy_audit.py plan.json` and `python3 webreel.py --audit <id>`.
5. Push. The `reels` workflow renders what is missing and opens a pull request
   with the videos.

## How the workflow renders

`.github/workflows/reels.yml` is three jobs. `plan` copies the ledger of
posted reels, builds and audits the plan once, fetches the translations
once, and counts what is missing (`render_missing.py --count`). `render` is
a matrix of as many machines as the count needs, up to the `machines` input
(eight by default, sixteen at most), each taking every n-th card of the same
interleaved list (`REELS_SHARD` of `REELS_SHARDS`) and at most 60
(`REELS_MAX`), three at a time (`REELS_JOBS`); each hands what it made on as
an artifact. `assemble` gathers them, moves every finished video to the
store (`shelf_store.py`), writes the manifest (`render_missing.py
--manifest`) and opens one pull request that carries the sidecars, the
manifest, the plan and the ledger, not the videos. A machine that dies takes
only its own share with it. The `gather` input names an earlier run whose
artifacts are shelved instead of rendering, for the week a change to the
workflow itself lands after a night's render. The repository is public, so
the minutes are free; the run is also scheduled for Monday 04:00 UTC, when
it renders what is new and retires what has been posted.

## What the files are

Each card renders `reels/<id>.mp4` and `reels/<id>-cover.jpg`. 1080x1920, 30fps,
H.264 high, yuv420p, and an AAC stereo track at 48 kHz and 96 kbit: about
3.5 MB in all. The video does not stay in the repository: `shelf_store.py`
puts it on the store, a GitHub release tagged `reels-<kind>` (one per kind,
free, outside the repository's size, with the run's own token; Vercel Blob
behind `REELS_STORE=blob` and its token), paced at one upload every eight
seconds under GitHub's write limits, and the sidecar `reels/<id>.json` keeps
the URL and the asset id. A release link answers with a short lived
redirect, so `freshVideoUrl` in `api/social.js` resolves it for each network
at the second the file is handed over. The cover stays in the repository,
where the console and the poster read it often (`REELS_STORE_COVERS=1`
sends it too). The audio track is not optional even when it is quiet, because
without an audio stream Instagram treats the file as malformed. The cover
exists because the profile grid otherwise takes frame zero, which is the
picture before a single word has arrived.
