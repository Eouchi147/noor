---
name: noor-video
description: Make or change a NOOR film or short through the terminal driven engine (tools/films): research, script, scene plan, visual plan, motion plan, sound plan, render, audit, revise, export. Use for any request for a video, a reel, a prototype, or a change to the engine.
---
# /noor-video <subject or engine change>

Read `VIDEO_ENGINE.md` first: the architecture, the spec format, the commands, and the
prototype's state.

1. **Research** (noor-researcher, `sonnet`): the subject from the library's own files
   (the Light, the chapter, the dictionary entry, the figure's SVG plate) and, where the
   plate needs it, the source named on the page. Output: the research object (facts with
   sources, the figure, the numbers) as JSON at the path the orders name. Nothing invented.
2. **Script and scene plan** (the Director, on judgment; a builder drafts when the form is
   settled): the film spec, scene by scene, each scene with its camera move, its subject on
   the plate, its narration line, its sound event, its duration. The first frame must
   create curiosity; no intro. Golden ratio primitives from the engine, never by hand.
3. **Builder** (`sonnet`): the spec into the engine's files; a low resolution render
   (`--proof`) in the cloud; the audit script (`audit.py`: text safe area, a visual change
   every 2 to 4 s, watermark present, loudness and true peak, the sound events on their
   frames) must pass.
4. **Refuter** (`opus`): watches the proof frames (contact sheet) against the masterplan's
   standard: nothing generic, cheap, clunky or artificial; every movement deliberate;
   depth and light used to tell the story; the sphere a guide, not a decoration. Verdict.
5. **Render** on the owner's Mac (`noor-render`, the one command in `VIDEO_ENGINE.md`) at
   full resolution with motion blur; the export names the platform (9:16 for the feeds,
   16:9 for YouTube long form), carries the watermark inside the safe margins and the
   loudness at the platform's target.
6. The Director judges the render against the standard before the owner sees it.
