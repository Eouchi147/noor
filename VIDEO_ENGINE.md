# NOOR: the video and sound engine

The map of what exists, how a film is made from one terminal command, what the first
prototype taught, and what remains against the masterplan. Kept current by the Director
when the engine changes shape. Last rebuilt: the night of 16 September 2026.

## Where it lives

`tools/films/` in the repository (kept out of the deployment by `.vercelignore`). The
working copy during a session is `/root/noor-reels/deliver/tools/films/`; the owner's Mac
mirror is `NOOR Films/noor-render/` (it also holds `music/` with the two Suno scores,
`figs/` with the 137 plate sources, and the renders; those stay out of the repository).

## The base (unchanged since the audit)

A frame exact renderer: a paused anime.js v4 timeline in headless Chromium (Playwright),
seeked per frame (`NOORFILM.build(chapter)`, `NOORFILM.seek(ms)`), so every frame is a
pure function of time; `noor.py --shutter 3` accumulates three sub frames for motion
blur; the Mac (M4) renders about 62 ms a frame with eight workers, the cloud box (two
cores, no GPU) about five seconds a frame. Plates (`web/plates.js`), the 2.5D camera
(`web/plate.js`), behaviours (`web/behave.js`), the reading model (`shortplate.py`), the
scores and struck marks (`shortmusic.py`) and the briefs (`briefs/`) are as the audit
described them. One rule the renderer relies on and the DOM word layer does not
guarantee: the anime timeline is only exact when seeked FORWARD (a seek backward can
leave a beat at opacity 0). `noor.py` and `contact.py` seek forward; any future resume
or out of order worker must too. The light layer (`web/lume.js`) is pure in both
directions (verified by the refuter: byte identical frames from either side).

## The rebuild (masterplan steps 3 and 4): what was added

- **A scene film**. A chapter with a `scene` object skips the corridor layout: the camera
  is the viewer's eyes at explicit stations, the light stands on explicit cues, one
  figure is the whole world. `web/stage.js` (the `chapter.scene` branch) hands
  `web/lume.js` the board, the views and the cues; every beat's headline, eyebrow, sub
  and source draw in the lower band (`has-lume`); the watermark is on.
- **The dark room** (`FIG.darkroom` in `web/lume.js`): a room the camera stands inside
  (its own `roomMat`, faces at their own levels, seams a third as bright), an opaque back
  wall with a real hole (a cold point unlit, a hot point lit), lamps outside, rays that
  draw through the hole in two legs, images that bloom at the computed inverted point on
  the front wall and follow a lamp that lifts, a fan of thin cool out rays for the old
  idea, a dust lit pencil along each drawn ray. Every element's state is replayed from
  an events list against absolute film seconds (`ramp`, `liftDy`): no accumulated
  state.
- **The camera in scene mode** (`pace("glide")` in lume.js): the eye glides between
  stations over the whole beat (inOutSine); the aim holds on the station's look point
  for `hold` seconds then turns; breath scaled by `scene.breath` (0.35); `hfov` is the
  horizontal field of view, converted per frame shape in stage.js so one spec composes
  9:16 and 16:9.
- **The Lantern in scene mode**: cues carry `hold` (stay, then travel, inOutSine); a
  near lens attenuation (smoothstep of the distance to the camera, 0.5 to 2.2 units)
  dims the air and streak so a light that comes to the lens never floods the frame;
  ambient dust off, the Lantern's own motes halved.
- **The watermark**: `div#mark` in `web/film.html`, the house mark as inline SVG plus
  `noorcodex.com` in NoorMono, bottom left inside the safe margins (60 left, 320 bottom
  on 1080 by 1920; 60 and 48 on the wide frame); a DOM element, so it is in every frame.
- **The spec** (`specs/<slug>.json`): research (facts with sources), story, figure (room,
  aperture, lamps, world conventions), scenes (words, camera with eye, look, hfov, roll,
  hold; figure events at scene relative seconds; lantern pos, scale, bright, hold; sound
  events with a voice; narration line), music, narration, watermark, export.
- **The pipeline** (`film.py`): `compile` (spec to the chapter `films/<slug>.json`; the
  scene grows to the spoken line plus 0.9 s, a hold that equalled the written duration
  grows with it, absolute times follow), `voice` (Piper stand in, one wav per line,
  timings, the narration track and the 50 Hz envelope `films/<slug>.envelope.json` the
  light breathes to), `sound` (`filmsound.py`: the Suno score's window at minus 16.5
  LUFS rising, roomtone, a struck mark on every sound event in the found key through the
  hall, `silence`, `music_in`, `music_release` and `music_out` shaping the bed, a duck
  of 10 dB under the narration with 120 ms attack and 700 ms release, narration at minus
  16 LUFS, master at minus 14 LUFS and minus 2 dBTP, exactly the picture's length),
  `render` (proof 12 fps shutter 1, full 24 fps shutter 3, through `noor.py`), `mux`,
  `check`, `all`.
- **The audit** (`audit.py <slug> --shape`): no dash on screen; a change every 2 to 4 s;
  the first frame has something to look at; no frame black or blown; the watermark lit
  and inside its corner; words inside the safe area; loudness and true peak; every mark
  on its event; narration on its line; the film's length agreed between chapter, frames
  and mp4. PASS, FAIL or SKIPPED with "n of m frames present"; exit 1 on a FAIL.

## The prototype: "The dark room" (step 4)

`specs/darkroom.json`, ten scenes, 44.05 s after retiming to the stand in voice, both
shapes. Words and facts from the Light `camera-obscura-dark-room` and heroes.html's
Ibn al-Haytham; the source line "The Book of Optics, about 1020". Built in five rounds
of render, look, revise (the contact sheet and the stills, then the refuter's review):
the room did not read, the light flooded the lens, the headlines were missing in scene
mode, the aim left its subject early; each fixed in turn and recorded in `changes.txt`.
The proof (12 fps, stand in narration) is in the owner's folder `NOOR Films/darkroom/`;
the audit table beside it. The full render (24 fps, shutter 3) is a Mac job
(`python3 film.py render darkroom --run` after `python3 film.py all darkroom`).

What the owner decides after seeing it: the look (the room's tone, the size of the
hole, the sphere's presence), the voice (Piper is a stand in; his own voice tool
replaces `film.py voice`), and whether the architecture is locked (masterplan: lock it
only when the prototype convinces).

## What remains (masterplan steps 3 and 4, then 6 and 12)

- Golden ratio primitives as a module (`web/phi.js`): frames, margins, focal points,
  type scale and durations from phi; today the spec places cameras by hand.
- The Lantern as a true storyteller in scene mode: a thread of light between two
  things it names; today it travels, breathes and rests.
- Depth of field driven by the spec (focus as storytelling); today the theme's lens.
- More figure kinds for more films (the sieve, the balance, the road); each a pure
  function of the events list like the dark room.
- The Mac as the renderer (eight workers, 62 ms a frame): copy the engine from the
  repository to `NOOR Films/noor-render/`, keep `music/` and `figs/` there.
- Narration by the owner's voice tool; `film.py voice` reads the wavs it produces.
- Automated generation (step 6): the researcher writes the spec from the library, the
  builder adds a figure kind only when the spec needs one, the film ships through the
  reels shelf and the social machine.
