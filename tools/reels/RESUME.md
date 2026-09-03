# NOOR reels · resume file

Written 3 September 2026. Everything needed to pick the social video work back
up without the conversation that produced it.

## Where things stand (3 September 2026, evening)
Sam chose "ship the pipeline, then fill it". Delivered:
`/root/mushaf/delivery/noor-reels-pipeline.zip` (17 files, 94 KB) containing
`tools/reels/` and `.github/workflows/reels.yml`, plus the step by step
artifact "Wiring Up the Reels". Awaiting his drag, the repository setting that
lets Actions open pull requests, and one workflow run.

Written and audited this session: scripts for the first 30 cards, in
`tools/reels/plan.json`, 15 for a morning slot and 15 for an evening one, each
with hook, key phrase, dateline, three lines, caption, tags and a look. Zero
findings from `copy_audit.py`, zero from the safe area audit across all 30.

The posting half was finished the same evening and folded into ONE delivery,
`/root/mushaf/delivery/noor-reels.zip` (21 files, 140 KB), which supersedes
`noor-reels-pipeline.zip`. It carries `api/_schedule.js` (slots reelA at 08:00
and reelB at 17:00 UTC, `buildSlot` reel branch, `slotExtras` manifest fetch),
`api/_channels.js` (a written `caption` is carried whole instead of assembled),
`api/social.js` (`postInstagramReel`, `postFacebookReel`,
`finishInstagramReel`, the pending resume at the top of `runDue`, `post.only`
channel filtering), `vercel.json` (maxDuration 60 on api/social.js) and
`tests/reels.mjs` (46 checks, Meta stubbed). Full suite green, no regressions.

The two things that shaped that code: Instagram creates a REELS container and
then transcodes, and publishing before it finishes is refused, so the sender
polls for ~32 s and otherwise records the slot `pending` with the container id
for the next hourly cron to publish; and both platforms take the video BY URL,
which is why the MP4s are committed to `/reels` and served by Vercel rather
than uploaded, reusing the token plumbing that already works for images.

Still owed:
1. The social links. Not one of the 600+ pages links to the Facebook or
   Instagram accounts. A footer change, small enough to come on its own.
2. The remaining 320 cards of reel copy, in waves of ten, same brief, same
   audit. Adding a card to `tools/reels/plan.json` is the whole act of
   scheduling it; the Monday workflow run renders whatever is new.
3. Vercel Web Analytics is still off (`web_analytics_not_enabled`).

## Older notes
Sam asked for two posts a day in a Euronews "No Comment" style. On 3 Sep he
doubted his own brief and asked whether the posts should instead be enticing
and educational. The recommendation given: drop "no comment", keep silence, put
the teaching in on-screen type. Four prototype reels were rendered for him to
judge: out/noor-hijra.mp4, noor-shatir.mp4, noor-sufi.mp4, noor-qalawun.mp4.
Awaiting his verdict on the format before any of this is committed.

On 3 Sep Sam approved the direction with one condition, in his words: as long
as it is cinematic, relevant, accurate, hooking and enticing. The point he was
making is that reels are served to people who do not follow the account, so the
format is the whole growth mechanism. The stills were replaced with a moving
picture engine the same day; the four reels above were re-rendered from it.

## The type is animated with anime.js (3 Sep 2026)
Sam asked for the opening second to be as hooking as the format allows, and to
copy the site's own assets rather than reinvent them. `web/anime.min.js` is a
byte for byte copy of `assets/anime.min.js` (v4.5.0, the custom NOOR build with
animate, stagger, createTimeline, createDrawable, utils and eases), and
`web/noor-card-*.ttf` are copies of the site's faces.

The reel is now rendered by two engines that share one clock. `web/type.html`
and `web/type.js` lay the words out and animate them in a headless Chromium;
the timeline is built with `autoplay: false` and never plays, it is seeked to an
exact millisecond per frame and screenshotted with a transparent background.
`cine.py` draws the picture for the same instant in numpy. `webreel.py`
composites the two and pipes the result to ffmpeg. About 200 seconds a reel.

The opening: a bloom opens over the frame, a streak of light crosses it, the
mark draws its rule, and the claim arrives word by word out of blur, rising and
settling, with the phrase carrying the surprise turning gold and underlining
itself as it lands. The whole claim is readable by about 1.2 seconds. Each card
names that phrase in its `key` field.

Two traps worth remembering. anime.js v4 writes its own transform, so a CSS
`translate(-50%,-50%)` on an animated element is silently thrown away: position
those elements with `left`/`top` instead. And a blurred, scaled word bleeds
outside its box while it is arriving, which the safe area audit catches, so the
reading column is inset to x 96..926 rather than sitting on the safe edge.

## The pieces that exist
* `cine.py` — the moving picture. A dark sky, one screen of star polygon
  geometry far back and out of focus, a defocused rosette in the foreground, a
  drifting star field, dust, a breathing lamp, grain and a vignette, plus a
  per card *subject*: `andromeda` (a faint cloud that blooms), `epicycles`
  (uniform circles tracing their path), `moon` (a waxing crescent across the
  run), `arcade` (arches drawing themselves open). The subject is drawn on its
  own plane and thrown slightly out of focus, and recedes to about half
  strength when the body text arrives, so it is atmosphere with meaning rather
  than an illustration competing with the words.
  Everything composites in numpy at 540x960 and is upscaled once: about 45 ms a
  frame, where a per pixel Python loop was five seconds.
* `make.py` — the driver. `LOOKS` holds palette, {n/k} and subject per card.
  `python3 make.py [names]`, two to three minutes a reel. It refuses to render
  a card whose copy will not fit, and writes `out/noor-<name>-cover.jpg` beside
  the video: Instagram otherwise takes frame zero for the profile grid, which is
  the picture before a single word has arrived.
* `webreel.py` — the renderer, and the audit that matters now:
  `python3 webreel.py --audit` measures the alpha of the browser's own type
  layer (with the opening bloom and streak switched off, since they are light
  rather than information) every fifth frame of every card, so a word that
  bleeds while it is animating is caught, not just the resting layout.
  `python3 webreel.py [names]` audits first and renders only if everything fits.
* `audit.py` — the same proof for the older Pillow type layer. It draws the type layer alone on black,
  samples every fifth frame of every card, and fails if the bounding box of the
  ink leaves the rectangle. Because it measures pixels rather than the
  arithmetic that produced them, an overrun measure, one line too many, or two
  blocks colliding all show up as a moved box. `python3 audit.py --sheet` also
  writes `out/safe-zones.png`, the finished frames with each platform's
  furniture drawn over them. Run it before every render; `make.py` will not
  save a card that does not fit.
* `geom.py` — Islamic star-polygon field generator, no external assets, so
  nothing has a licence question. `python3 geom.py <seed> <palette> <n> <k> <out.png>`
  palettes: night dusk green sand. Star polygon {n/k}, inner radius
  R*cos(pi*k/n)/cos(pi*(k-1)/n).
* `light_reel.py` — the type layer. Frames drawn in Pillow over whatever
  `cine.Cine` hands back, piped as rawvideo to ffmpeg. `render(cin, out, card,
  secs)`; anything with a `.frame(t)` returning a 1080x1920 picture will do.
  Card shape: {"eyebrow","hook","date","lines":[3 strings]}.
  Two traps that cost time: the scrim must be built with numpy (a per pixel
  Python loop is 2 million writes a frame), and the draw must be
  `ImageDraw.Draw(img, "RGBA")` or every fade renders at full opacity.
  Layout fits itself: hook size walks down 78..52 until it wraps to at most
  four lines, then body size 44..34 until the column fits the safe band
  (TOP_SAFE 300, BOTTOM_SAFE 1620, because Instagram and TikTok paint their own
  furniture over the rest).
* `render.py` — the older wordless "Signs" format (out/signs-01..03.mp4).
* `cards/*.json` — the four prototype scripts.

## The next step if he approves
Reel copy should be compressed offline, not at post time: 350 cards in
`lights/all.json` already carry `t` (the claim), `d` (the dateline) and `s`
(the substance). Turning each `s` into three reel lines is one batch job of
subagent waves, the same shape as the translation waves in i18n/RESUME.md,
audited against the source card (no new facts, every number preserved, no em or
en dashes, at most three lines) and committed as `reels/copy.json`. Then the
renderer is deterministic and every reel is auditable before it ships, which is
what Sam's production rule requires. A GitHub Action can render and commit the
MP4s (needs ffmpeg, which is available on ubuntu-latest runners) and
`api/social.js` posts them on the existing schedule.

## The safe area (3 Sep 2026)
Sam's condition was that nothing overlaps and everything fits Instagram and
Facebook perfectly. The constants live at the top of `light_reel.py`:

    SAFE_TOP 270   SAFE_BOTTOM 1500   SAFE_L 84   SAFE_R 950

Meta's published organic guidance for Reels is 270 at the top, about 320 at the
bottom and 65 each side; the numbers above are tighter on every edge, and the
right margin clears the like/comment/share rail rather than only the frame edge.
The reading column is drawn at SAFE_L + 3 because glyphs overhang their origin
by a pixel, which the audit caught. The layout that resulted: the NOOR mark and
the card's category share one row at the top of the band, and the closing
noorcodex.com line sits under the column rather than centred at the foot of the
frame, where the caption would have covered it. There is no progress bar any
more for the same reason. Measured margins at the last run were 15 to 48 pixels
of slack on every side of every card.

Ad placements are stricter still (Meta asks for 670 clear at the bottom for
paid). Nothing here is inside that, so a boosted post would want a re-render at
SAFE_BOTTOM 1250, which the fitter will handle by shrinking the body.

## Two things the runner taught us (3 Sep 2026)
* **ffmpeg is not on the ubuntu-24.04 image.** It was on 22.04, it is not on
  24.04, and `ubuntu-latest` is now 24.04. Run 1 audited all thirty cards
  cleanly, spent nine minutes doing it, and then died on the first encode with
  `FileNotFoundError: 'ffmpeg'`. The install step now does
  `sudo apt-get install -y --no-install-recommends ffmpeg` and prints its
  version, so the next time this breaks the log says so in one line.
* **The pull request step is `if: always()`.** A run that renders twenty five
  and then hits the timeout still has twenty five finished reels, each complete
  on its own; with nothing to commit the step simply does nothing.

Also worth remembering for any future browser work on GitHub: its web editor
auto-indents as you type, so YAML typed in cascades further right on every line
and comes out unusable. Put the text on the clipboard from inside the page and
paste it; a paste event does not trigger auto-indent. And write the clipboard
only while the page has focus, with a wait before the paste, or the write
silently does not land.

## Constraints that shaped this
No photographs are used at all: every background is generated geometry, so
there is no licence, no attribution and no risk of a figurative image or a
depiction of a prophet slipping in. Reels must carry an audio stream even when
silent (`anullsrc`) or Instagram treats the file as malformed.
