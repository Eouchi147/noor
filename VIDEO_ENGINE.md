# NOOR: the video and sound engine

The map of what exists, what the masterplan asks for, and how the rebuild is run. Kept
current by the Director when the engine changes shape.

## What exists (the base, 16 September 2026)

Lives in `tools/films/` (kept out of the deployment by `.vercelignore`; the working copy
during a session is `/root/noor-reels/deliver/tools/films/`, mirrored on the owner's Mac
at `NOOR Films/noor-render/`). It is a frame exact renderer: a paused anime.js v4 timeline
in headless Chromium (Playwright), seeked per frame (`NOORFILM.build(chapter)`,
`NOORFILM.seek(ms)`), so every frame is a pure function of time; `noor.py --shutter 3`
accumulates three sub frames for real motion blur; the Mac (M4) renders about 62 ms a frame
with eight workers, the cloud box about 2.2 s.

- **Plates**: the site's own inline SVG figures, 137 valid, each shipped with its page's
  CSS scoped under `.figsvg` (`web/plates.js`, built by `buildplates.py`; measured
  viewBoxes from `measureplates.py`; contact sheets from `platesheet.py`; step lists from
  `plateplan.py`). A plate is never cropped: `box()` fits it in 1010 by 1240 and the
  viewBox camera pushes within that box.
- **Camera** (`web/plate.js`): text safe; a shot's window is the union of what it looks at
  and every label drawn so far; every sentence a 13 percent push; parallax by depth from
  element area, pinned to zero for text bearing steps; rack focus by opacity and blur;
  labels never overlapped (text wrappers last in the document, geometry under a feathered
  knockout mask).
- **Behaviours** (`web/behave.js`, `NOORMOTION`): travel, flow, pour, trace, sweep, pulse,
  count, orbit, glow; timed by sentence index; selectors by CSS; generated elements tagged
  `data-fx`.
- **Words** (`shortplate.py`): the reading model (entry 0.75 s, 0.05 s a word, 15 cps,
  settle 0.45 s, floor 2.2 s, first line at least 3.9 s), a camera shot on every line, the
  four questions check (a date in the first two lines, two capitalised names, no pronoun
  before a name).
- **Sound** (`shortmusic.py`): the two Suno scores in `music/` cut by `pick_window`
  (quiet start, rise from the first to the last third), key found by chroma, one struck
  voice (felt, glass or wood) thinned to about 15 marks at least 1.15 s apart, marks at
  minus 29.5 dB RMS under music at minus 15.5, a modal hall, 1.1 dB duck, master at minus
  14 LUFS; `--mux` replaces the mp4's sound in place.
- **Briefs**: `briefs/plate-*.json` (ten researched shorts: darkroom, sieve, zero, gold,
  road, teachers, licence, hospital, roundearth, sextant), each with slug, plate, lines
  (text, sub, eyebrow, src, steps) and motion.
- **The one command** on the Mac: `./plates.sh plate-darkroom` (compile, render, score,
  mux). Social specs used: safe zone 130 top, 320 bottom, 60 sides on 1080 by 1920; 25 to
  40 s for a lesson; a visual change every 2 to 4 s; minus 14 LUFS.

The audit's verdict: technically sound, visually a prototype. What it lacks against the
masterplan: a real camera in depth (it is a 2.5D viewBox push with parallax), the glowing
NOOR sphere as a guide, an environment (light, atmosphere, occlusion, focus as
storytelling), narration and a sound plan synchronised to visual events, the watermark
inside the safe margins, golden ratio layout primitives, and a spec driven pipeline
(research, script, scene plan, visual plan, motion plan, sound plan, render, audit,
revise, export) from one terminal command.

## The rebuild (masterplan steps 3 and 4), the architecture chosen

Keep the frame exact browser renderer (it is what makes the site's own SVG, its fonts and
its CSS first class, and it is fast on the Mac), and put a real scene under it:

- **A 3D stage** in WebGL (Three.js, vendored, no CDN) rendered in the same paused,
  seekable timeline: the plate becomes a lit surface in space, the camera is the viewer's
  eyes (dolly, push, orbit, tilt, with inertia and weight), depth of field and bloom as
  post passes, atmosphere as particles and fog, occlusion by real depth. The 2.5D layer
  stays for words and the plate's own animated behaviours, composited over the stage.
- **The NOOR sphere**: an emissive object with its own light, that arrives, illuminates
  the part of the plate the narration names, connects two things with a thread of light,
  and reacts to the narration's envelope. Never a decoration: every appearance is a step
  of the story.
- **Golden ratio primitives**: a layout module (`web/phi.js`) that returns the frames,
  margins, focal points, type scale and durations from phi, and the camera aims at those
  points; nothing placed by hand.
- **The film spec**: one JSON per film (`films/<slug>.json`): research object (facts with
  sources), script (narration lines with their sources), scene plan (per scene: camera,
  subject, sphere action, words, duration), visual plan (plate, palette, environment),
  motion plan (behaviours and camera curves), sound plan (narration, music window, sound
  events tied to scene events, atmosphere, silence), export (aspect, platform, watermark).
- **The pipeline, terminal driven** (`noor film <slug> [--proof] [--aspect 9:16|16:9]`):
  research (from the library, by the researcher), script, plans, render (proof at low
  resolution in the cloud, full on the Mac), audit (`audit.py`: text safe area, change every
  2 to 4 s, watermark present and inside margins, first frame curiosity check by the
  refuter, loudness and true peak, sound events on their frames, no dash characters on
  screen), revise, export.
- **Narration**: the owner's voice tool produces the voice from the script; the engine
  retimes scenes to the narration (`voice/retime.py` pattern); a stand in voice (Piper,
  offline) is used for proofs and marked as such; nothing sounds under the Qur'an.
- **Watermark**: the NOOR logo and `noorcodex.com`, inside the platform safe margins, on
  every social export.

## The prototype (step 4)

One film, "The dark room" (Ibn al-Haytham's camera obscura; the plate `darkroom.svg`, the
brief `briefs/plate-darkroom.json`, the Light `camera-obscura-dark-room`): first person,
we are inside the room, the lamps outside, light travelling in straight lines, the sphere
entering and drawing the rays, the figure transforming into the diagram; 30 to 45 s, 9:16
and 16:9; narration from the Light's own words; music from the Suno scores; sound events
on the lamps, the rays, the sphere; watermark; export for the feeds and YouTube.

The loop: render quickly, audit aggressively, revise, render again; lock the architecture
only when the prototype convinces the owner.
