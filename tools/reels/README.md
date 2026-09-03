# NOOR reels

Twenty second vertical videos for Instagram and Facebook Reels, built from the
same 350 card library the site's daily Light comes from. Reels are the only
surface either platform shows to people who do not already follow the account,
so this is the growth path; everything here exists to make a stranger stop, and
then to teach them one true thing well enough that they look the account up.

Every frame is generated. There is no photograph, no stock footage, no music
and no voice: the picture is Islamic star polygon geometry drawn from a seed,
and the words are the card's own. So there is no licence to honour, no
attribution to print, no dead link in two years, and no way for a figurative
image or a depiction of a prophet to reach the frame through a stock search.

    plan.json          the 30 cards: the script and the look for each
    BRIEF.md           the contract every script is written against
    copy_audit.py      checks a script against the card it came from
    spec.py            the frame, and the part of it the platforms leave alone
    geom.py            star polygon fields
    cine.py            the moving picture
    web/               the type layer: anime.js, the page, the fonts
    webreel.py         renders one card, and audits the safe area
    render_missing.py  renders whatever plan.json has that reels/ does not

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

## How one gets posted

`api/_schedule.js` has two reel slots, `reelA` at 08:00 UTC and `reelB` at
17:00 UTC, beside the five that already existed. Each hour the `due` cron asks
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
was written and audited beside the video. A reel is offered only to Facebook and
Instagram; the others would fall back to the cover, and a still of a video is a
poor post.

Instagram is the awkward half. Creating the container returns at once, but the
video is then transcoded and publishing before that finishes is refused. So the
sender waits about thirty seconds, and if the wait runs past what a serverless
function may spend it hands back the container id, the slot is recorded as
`pending` rather than failed, and the next hourly run publishes it. Facebook
takes a reel in three phases and fetches the file itself, so none of the bytes
pass through the site.

`node tests/reels.mjs` holds all of that with Meta stubbed: 46 checks, including
that a token never reaches a URL, that a pending container is finished later
rather than lost, and that a reel post with no video is refused rather than sent
as a photo.

## Adding a card

1. Pick it from `lights/all.json`.
2. Write its script against `BRIEF.md`. Nothing may be invented: every number
   and every capitalised name has to be findable in that card's own text,
   because a reel is screenshotted and argued with far more often than a page.
3. Add it to `plan.json` with a `look`.
4. `python3 copy_audit.py plan.json` and `python3 webreel.py --audit <id>`.
5. Push. The `reels` workflow renders what is missing and opens a pull request
   with the videos.

## What the files are

Each card renders `reels/<id>.mp4` and `reels/<id>-cover.jpg`. 1080x1920, 30fps,
H.264 high, yuv420p, about a megabyte, with the silent AAC track Instagram
requires: without an audio stream Instagram treats the file as malformed. The
cover exists because the profile grid otherwise takes frame zero, which is the
picture before a single word has arrived.
