#!/usr/bin/env python3
"""NOOR - checks a compiled film and its sound against the production rules.

    python3 audit.py darkroom --shape tall

WHY THIS EXISTS
A film that looks right and a film that IS right are not the same claim, and
the difference has been a person staring at a monitor and listening with
their ears. Every rule below is a number: a gap in seconds, a mean pixel
value, a LUFS reading, a millisecond of drift. This file reads the compiled
chapter, the sound.json filmsound.py wrote, the narration timings, and, when
they exist, the rendered frames and the muxed mp4, and prints PASS or FAIL
for each rule with the number that decided it. The frame and mp4 checks
print SKIPPED rather than FAIL when there is nothing yet to look at (Builder
A's figure was not ready when this was written, and neither the frames nor
the mp4 exist until the Director renders tonight): a SKIPPED row means
nobody has looked yet, and it must never be read as a pass.
"""
import argparse, glob, json, math, os, re, subprocess, sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SPECS = os.path.join(HERE, "specs")
FILMS = os.path.join(HERE, "films")
OUT = os.path.join(HERE, "out")
VOICEDIR = os.path.join(HERE, "voice")

#  Built from a code point, never typed literally: see the same line in
#  film.py, has_dash's twin here, for why.
EM_DASH, EN_DASH = chr(0x2014), chr(0x2013)
FADE = {"cut": 0.001, "dissolve": 0.7, "flash": 0.7, "slow": 1.0}

#  The safe margins in specs/darkroom.json's own watermark.safe are the
#  TALL frame's pixels only; the wide frame is a different picture (1920x1080
#  against 1080x1920) and its own margins are not in the spec. Fixed here per
#  the Director's numbers rather than guessed from the tall ones by ratio.
MARGINS = {
    "tall": {"sides": 60, "bottom": 320, "top": 130},
    "wide": {"sides": 60, "bottom": 48, "top": 60},
}

#  A PLATE SHORT'S MOTION MARKS, THE SAME WAY SHORTMUSIC.PY TIMES THEM.
#  shortmusic.py is in scope this round and already carries the one true
#  copy of "when does a travel/flow/pour/trace/glow/pulse entry start and
#  land" (it reads web/behave.js's own NOORMOTION.apply to get it right);
#  imported here rather than re-derived so the audit can never quietly
#  drift from what actually drew the picture. If the import fails for any
#  reason (shortmusic.py missing, scipy not installed, whatever), a slug
#  that does not exist must still print one clean line and exit 2 rather
#  than a traceback, so the same algorithm is kept, by hand, as a fallback.
sys.path.insert(0, HERE)
try:
    from shortmusic import motion_marks as _motion_marks
except Exception:
    def _motion_marks(b):
        lines = [float(L.get("at", 0.0)) for L in b.get("lines", [])]
        out = []
        for i, m in enumerate(b.get("motion", []) or []):
            do = m.get("do")
            at_field = m.get("at")
            if at_field is not None and at_field < 100 and lines:
                start = lines[min(int(at_field), len(lines) - 1)]
            else:
                start = float(m.get("sec", 0.0))
            start += float(m.get("delay", 0.0))
            dur = float(m.get("for", 3.0))
            arrival = start + dur
            if do in ("travel", "flow", "pour", "trace"):
                out.append({"at": start, "voice": "felt", "source": "%s#%d start" % (do, i)})
                out.append({"at": arrival, "voice": "glass", "source": "%s#%d arrival" % (do, i)})
            elif do in ("glow", "pulse"):
                out.append({"at": start, "voice": "felt", "source": "%s#%d start" % (do, i)})
        out.sort(key=lambda e: e["at"])
        return out


def has_dash(s):
    return bool(s) and (EM_DASH in s or EN_DASH in s)


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def chapter_length(chapter):
    beats = chapter["beats"]
    body = sum(max(1.2, b["hold"]) for b in beats)
    fade = FADE.get(beats[-1].get("exit", "dissolve"), FADE["dissolve"])
    return body, body + fade


def scene_starts(chapter):
    """cumulative scene start times, exactly as web/stage.js's own clock
    variable builds them from beats[].hold."""
    t, out = 0.0, []
    for b in chapter["beats"]:
        out.append(t)
        t += max(1.2, b["hold"])
    return out


def cue_times(chapter):
    times = set(scene_starts(chapter))
    for e in chapter["scene"]["figure"].get("events", []):
        times.add(e["at"])
    for e in chapter.get("sound", []):
        times.add(e["at"])
    return sorted(times)


def spec_cue_times(spec, exit_kind="slow"):
    """The same cue times, but as they would have been on the spec's OWN
    written scene durations, before a scene grew to hold a longer stand in
    line. Used only to tell a real pacing problem in the spec apart from one
    this round's retiming introduced; the spec's per-scene event and sound
    "at" values are still relative to their own scene start, same as compile
    reads them."""
    starts, clock = [], 0.0
    for sc in spec["scenes"]:
        starts.append(clock)
        clock += float(sc["dur"])
    times = set(starts)
    for i, sc in enumerate(spec["scenes"]):
        for e in sc.get("figure", {}).get("events", []):
            times.add(starts[i] + float(e["at"]))
        for e in sc.get("sound", []):
            times.add(starts[i] + float(e["at"]))
    total = clock + FADE.get(exit_kind, FADE["slow"])
    return sorted(times), total


# ------------------------------------------------------------- plate shorts
#  A PLATE SHORT IS ONE BEAT, NOT A ROW OF SCENES. shortplate.py's own
#  output (films/short-<slug>.json) has no "scene" key and no per-beat
#  text/sub/eyebrow/src -- one beat of kind "plate" carries a `lines` list
#  instead, each line with its own at/until, plus the `at` array of step
#  times and the `motion` list web/behave.js and web/plate.js read. Every
#  function below reads that shape; nothing above this comment is touched
#  by it, so darkroom.json's own scene-format audit still runs exactly as
#  it did before this round.
def is_plate_chapter(chapter):
    beats = chapter.get("beats") or []
    return bool(beats) and beats[0].get("kind") == "plate"


def plate_cue_times(beat):
    """The plate short's own cue times, used only when there are no frames
    yet to diff against: each line's own start, each step's own moment
    (beat["at"], milliseconds), and the start and arrival of every motion
    entry -- exactly the events shortmusic.py marks (see motion_marks
    there) and the events the drawing itself is judged against."""
    times = set(round(float(L.get("at", 0.0)), 3) for L in beat.get("lines", []))
    times |= set(round(float(ms) / 1000.0, 3) for ms in (beat.get("at") or []))
    for e in _motion_marks(beat):
        times.add(round(e["at"], 3))
    return sorted(times)


def line_sample_times(beat):
    """Each line's own midpoint: (at + until) / 2 when the line has an
    until, else at + 1.5s -- a line missing an until still runs well past
    a second and a half, so that lands inside it either way."""
    out = []
    for L in beat.get("lines", []):
        at = float(L.get("at", 0.0))
        until = L.get("until")
        out.append(at + 1.5 if until is None else (at + float(until)) / 2.0)
    return out


def check_words_plate(beat):
    bad = []
    lines = beat.get("lines", [])
    for L in lines:
        for field in ("text", "sub", "eyebrow", "src"):
            if has_dash(L.get(field)):
                bad.append("line %r field %s" % (L.get("text", "?")[:24], field))
    return (not bad, "no em dash or en dash in %d lines" % len(lines), "; ".join(bad))


def check_text_safe_plate(frames_dir, beat, fps, shape, note):
    if not frames_dir:
        return None, note, None
    safe = MARGINS[shape]
    top, bottom, sides = safe["top"], safe["bottom"], safe["sides"]
    lines = beat.get("lines", [])
    bad = []
    for L, sample_t in zip(lines, line_sample_times(beat)):
        idx = int(round(sample_t * fps))
        rgb = frame_rgb(frames_dir, idx)
        if rgb is None:
            continue
        h, w = rgb.shape[:2]
        top_band = rgb[0:top, :]
        bottom_band = rgb[h - bottom:h, sides:w]  # the watermark corner is excluded
        bright = max(float((top_band.mean(axis=2) > 90).mean()) if top_band.size else 0.0,
                    float((bottom_band.mean(axis=2) > 90).mean()) if bottom_band.size else 0.0)
        if bright > 0.01:
            bad.append("line %r frame %d bright fraction %.3f" % (L.get("text", "?")[:20], idx, bright))
    return (not bad, "sampled at each line's own midpoint, %d lines" % len(lines), "; ".join(bad[:5]))


def measure_ebur128(path):
    """Integrated loudness and true peak off the finished audio. The same
    ffmpeg filter and the same regex as filmsound.py's own measure_ebur128;
    filmsound.py is out of this round's scope to touch, so this is a copy
    kept in step with it by eye, not a shared import."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path,
                        "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    out = r.stderr
    Im = re.findall(r"\bI:\s*(-?\d+(?:\.\d+)?)\s*LUFS", out)
    Pm = re.findall(r"Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS", out)
    return (float(Im[-1]) if Im else None, float(Pm[-1]) if Pm else None)


def check_loudness_plate(slug, shape, mp4_path):
    #  the mixed mp4 once it is muxed; shortmusic.py's own wav (already
    #  normalised to its own target, see its main()) stands in before that.
    src = mp4_path if (mp4_path and os.path.exists(mp4_path)) else None
    wav_path = os.path.join(OUT, "%s.wav" % slug)
    if src is None and os.path.exists(wav_path):
        src = wav_path
    if src is None:
        return None, "no mp4 or wav yet (run: python3 shortmusic.py %s)" % slug, None
    lufs_i, peak = measure_ebur128(src)
    bad = []
    target_i, ceiling_p = -14.0, -1.5  # shortmusic.py's own target and its limiter's own ceiling
    if lufs_i is None or abs(lufs_i - target_i) > 1.0:
        bad.append("integrated loudness %s LUFS, target %.1f +/- 1 LU" %
                  ("%.1f" % lufs_i if lufs_i is not None else "?", target_i))
    if peak is None or peak > ceiling_p + 0.1:
        bad.append("true peak %s dBTP, ceiling %.1f" %
                  ("%.1f" % peak if peak is not None else "?", ceiling_p))
    detail = "%s LUFS, %s dBTP (measured on %s)" % (
        "%.1f" % lufs_i if lufs_i is not None else "?",
        "%.1f" % peak if peak is not None else "?", os.path.basename(src))
    return (not bad, detail, "; ".join(bad))


def check_marks_plate(slug, shape, beat):
    mj_path = os.path.join(OUT, "%s-%s.marks.json" % (slug, shape))
    if not os.path.exists(mj_path):
        return None, "no marks yet (run: python3 shortmusic.py %s --shape %s)" % (slug, shape), None
    mj = load_json(mj_path)
    marks = mj.get("marks", [])
    cand = plate_cue_times(beat)
    bad = []
    for m in marks:
        try:
            t = round(float(m.get("at")), 3)
        except (TypeError, ValueError):
            bad.append("mark with no usable at: %r" % (m,))
            continue
        if not any(abs(t - c) <= 0.05 for c in cand):
            bad.append("mark at %.2fs (%s) is not on a line, step or motion event" %
                      (t, m.get("source", "?")))
    has_arrival = any("arrival" in (m.get("source") or "") for m in marks)
    if beat.get("motion") and not has_arrival:
        bad.append("the beat has motion but no arrival mark was struck for any of it")
    detail = "%d marks checked against %d candidate events" % (len(marks), len(cand))
    return (not bad, detail, "; ".join(bad[:6]))


# ------------------------------------------------------------------ frames
def planned_frame_count(chapter, fps):
    """holds plus the last beat's fade, times fps: exactly noor.py's own
    plan() (see the FADE comment there), so a partial render is measured
    against the count the render is actually going for, not a guess."""
    return int(round(chapter_length(chapter)[1] * fps))


def find_frames_dir(slug, shape, fps=None):
    """The frames folder with the most numbered jpgs for this slug and
    shape, and how many of them there are. Returns (dir_or_None, fps,
    actual_count); the caller decides against the PLANNED count whether
    that is enough to read from, not this function. With an explicit fps
    (a plate short's own --fps, default 30, or a scene film's), only that
    fps's own folder is looked at rather than whichever happens to have
    the most frames on disk."""
    pattern = "%s-%s-%dfps-*" % (slug, shape, fps) if fps else "%s-%s-*fps-*" % (slug, shape)
    hits = sorted(glob.glob(os.path.join(HERE, "frames", pattern)))
    if not hits:
        return None, fps, 0
    best = max(hits, key=lambda d: len(glob.glob(os.path.join(d, "??????.jpg"))))
    m = re.search(r"-(\d+)fps-", os.path.basename(best))
    found_fps = int(m.group(1)) if m else fps
    n = len(glob.glob(os.path.join(best, "??????.jpg")))
    if n == 0:
        return None, found_fps, 0
    return best, found_fps, n


def frame_gray(d, i):
    from PIL import Image
    p = os.path.join(d, "%06d.jpg" % i)
    if not os.path.exists(p):
        return None
    return np.asarray(Image.open(p).convert("L"), dtype=np.float32)


def frame_rgb(d, i):
    from PIL import Image
    p = os.path.join(d, "%06d.jpg" % i)
    if not os.path.exists(p):
        return None
    return np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)


# --------------------------------------------------------------- the rules
def check_words(chapter, timings):
    bad = []
    for b in chapter["beats"]:
        for field in ("text", "sub", "eyebrow", "src"):
            if has_dash(b.get(field)):
                bad.append("beat %r field %s" % (b.get("text", "?")[:24], field))
    if timings:
        for s in timings.get("scenes", []):
            if has_dash(s.get("text")):
                bad.append("narration %s" % s["id"])
    return (not bad, "no em dash or en dash in %d beats" % len(chapter["beats"]) +
            (" and %d narration lines" % len(timings.get("scenes", [])) if timings else ""),
            "; ".join(bad))


def check_pacing(chapter, frames_dir, fps, spec=None, beat=None):
    if frames_dir:
        n = len(glob.glob(os.path.join(frames_dir, "??????.jpg")))
        step = max(1, int(round(2.0 * fps)))
        worst, worst_i = None, None
        i = 0
        while i + step < n:
            a, b = frame_gray(frames_dir, i), frame_gray(frames_dir, i + step)
            if a is not None and b is not None:
                mad = float(np.mean(np.abs(a - b)))
                if worst is None or mad < worst:
                    worst, worst_i = mad, i
            i += step
        ok = worst is not None and worst > 4.0
        return ok, "quietest 2s window mean abs diff %.2f (frame %s)" % (worst or 0.0, worst_i), None
    if beat is not None:
        ct = plate_cue_times(beat)
        total = chapter_length(chapter)[1]
        gaps = [b - a for a, b in zip([0.0] + ct, ct + [total])]
        worst = max(gaps) if gaps else 0.0
        ok = worst <= 4.05
        detail = ("largest gap between cues %.2fs (from the compiled beat's "
                  "lines, steps and motion, no frames yet)" % worst)
        return ok, detail, None
    ct = cue_times(chapter)
    gaps = [b - a for a, b in zip([0.0] + ct, ct + [chapter_length(chapter)[1]])]
    worst = max(gaps) if gaps else 0.0
    ok = worst <= 4.05
    detail = "largest gap between cues %.2fs (from the compiled chapter, no frames yet)" % worst
    #  TELL A REAL PACING PROBLEM FROM ONE THE STAND IN VOICE MADE.
    #  WHAT BROKE BEFORE THIS: a FAIL here read as "the spec's own timing is
    #  wrong", and it was often really "piper's line ran long enough to
    #  stretch a scene past its only event". Recomputed once against the
    #  spec's own written durations (no retiming) so the report says which
    #  one it is.
    if not ok and spec is not None:
        exit_kind = chapter["beats"][-1].get("exit", "dissolve")
        sct, stotal = spec_cue_times(spec, exit_kind)
        sgaps = [b - a for a, b in zip([0.0] + sct, sct + [stotal])]
        sworst = max(sgaps) if sgaps else 0.0
        if sworst <= 4.05:
            detail += "; caused by the stand in voice's length, not the spec's own timing (spec-only worst gap %.2fs)" % sworst
        else:
            detail += "; present even in the spec's own timing (spec-only worst gap %.2fs)" % sworst
    return ok, detail, None


def check_first_frame(frames_dir, note):
    if not frames_dir:
        return None, note, None
    g = frame_gray(frames_dir, 0)
    if g is None:
        return None, "no frame 0", None
    mean, std = float(g.mean()), float(g.std())
    ok = 4.0 <= mean <= 60.0 and std > 3.0
    return ok, "mean %.1f std %.1f" % (mean, std), None


def check_no_black_blown(frames_dir, note):
    if not frames_dir:
        return None, note, None
    files = sorted(glob.glob(os.path.join(frames_dir, "??????.jpg")))
    bad = []
    for i in range(0, len(files), 12):
        idx = int(os.path.splitext(os.path.basename(files[i]))[0])
        g = frame_gray(frames_dir, idx)
        if g is None:
            continue
        mean = float(g.mean())
        blown = float((g >= 250).mean()) * 100.0
        if mean < 2.0 or blown > 2.0:
            bad.append("frame %06d mean %.1f blown %.1f%%" % (idx, mean, blown))
    return (not bad, "%d of every 12th frame checked" % (len(files) // 12 + 1), "; ".join(bad[:5]))


def check_watermark(frames_dir, chapter, shape, note):
    if not frames_dir:
        return None, note, None
    safe = MARGINS[shape]
    sides, bottom = safe["sides"], safe["bottom"]
    n = len(glob.glob(os.path.join(frames_dir, "??????.jpg")))
    bad = []
    for idx in (0, n // 3, 2 * n // 3, n - 1):
        rgb = frame_rgb(frames_dir, idx)
        if rgb is None:
            continue
        h, w = rgb.shape[:2]
        corner = rgb[h - bottom:h, 0:sides]
        outside_left = rgb[0:h - bottom, 0:sides]
        outside_bottom = rgb[h - bottom:h, sides:w]
        bright_corner = float(corner.mean()) if corner.size else 0.0
        bright_outside = max(float(outside_left.mean()) if outside_left.size else 0.0,
                             float(outside_bottom.mean()) if outside_bottom.size else 0.0)
        if bright_corner <= 6.0:
            bad.append("frame %d corner not lit (%.1f)" % (idx, bright_corner))
        if bright_outside > 30.0:
            bad.append("frame %d outside the safe corner is not dark (%.1f)" % (idx, bright_outside))
    return (not bad, "sampled %d frames, corner sides=%d bottom=%d" % (4, sides, bottom), "; ".join(bad))


def check_text_safe(frames_dir, chapter, fps, shape, note):
    if not frames_dir:
        return None, note, None
    safe = MARGINS[shape]
    top, bottom, sides = safe["top"], safe["bottom"], safe["sides"]
    starts = scene_starts(chapter)
    bad = []
    for b, t0 in zip(chapter["beats"], starts):
        sample_t = t0 + max(1.2, b["hold"]) * 0.62
        idx = int(round(sample_t * fps))
        rgb = frame_rgb(frames_dir, idx)
        if rgb is None:
            continue
        h, w = rgb.shape[:2]
        top_band = rgb[0:top, :]
        bottom_band = rgb[h - bottom:h, sides:w]  # the watermark corner is excluded
        bright = max(float((top_band.mean(axis=2) > 90).mean()) if top_band.size else 0.0,
                    float((bottom_band.mean(axis=2) > 90).mean()) if bottom_band.size else 0.0)
        if bright > 0.01:
            bad.append("beat %r frame %d bright fraction %.3f" % (b.get("text", "?")[:20], idx, bright))
    return (not bad, "sampled at 62%% of each of %d beats" % len(chapter["beats"]), "; ".join(bad[:5]))


def check_sound(slug, shape, chapter, timings):
    sj_path = os.path.join(OUT, "%s-%s.sound.json" % (slug, shape))
    if not os.path.exists(sj_path):
        return None, "no sound yet", None
    sj = load_json(sj_path)
    bad = []
    m = sj.get("measured", {})
    target_i = m.get("target_lufs", -14.0)
    target_p = m.get("target_true_peak_dbfs", -2.0)
    if m.get("integrated_lufs") is None or abs(m["integrated_lufs"] - target_i) > 1.0:
        bad.append("integrated loudness %.1f LUFS, target %.1f +/- 1 LU" % (m.get("integrated_lufs") or -99, target_i))
    if m.get("true_peak_dbfs") is None or m["true_peak_dbfs"] > target_p + 0.1:
        bad.append("true peak %.1f dBTP, ceiling %.1f" % (m.get("true_peak_dbfs") or 99, target_p))

    chapter_sound = chapter.get("sound", [])
    for mk in sj.get("marks", []):
        cand = [e for e in chapter_sound if e.get("event") == mk["event"]]
        if not cand:
            bad.append("mark %s has no matching chapter event" % mk["event"])
            continue
        nearest = min(cand, key=lambda e: abs(e["at"] - mk["at"]))
        if abs(nearest["at"] - mk["at"]) > 0.08:
            bad.append("mark %s at %.3fs is %.3fs from its event" %
                      (mk["event"], mk["at"], abs(nearest["at"] - mk["at"])))

    if timings:
        starts = scene_starts(chapter)
        for s, t0 in zip(timings.get("scenes", []), starts):
            want = t0 + 0.3
            if abs(want - s["start"]) > 0.06:
                bad.append("narration %s starts %.3fs, wants %.3fs" % (s["id"], s["start"], want))

    detail = "; ".join(bad[:6])
    return (not bad, "%.1f LUFS, %.1f dBTP, %d marks checked" %
            (m.get("integrated_lufs") or -99, m.get("true_peak_dbfs") or -99, len(sj.get("marks", []))), detail)


def check_length(chapter, frames_dir, fps, mp4_path, note):
    body, total = chapter_length(chapter)
    have_frames = frames_dir is not None
    have_mp4 = mp4_path is not None and os.path.exists(mp4_path)
    if not have_frames and not have_mp4:
        return None, "chapter says %.2fs; %s; no mp4 yet to compare" % (total, note), None
    bad = []
    frame_secs = None
    if have_frames:
        n = len(glob.glob(os.path.join(frames_dir, "??????.jpg")))
        frame_secs = n / float(fps)
        if abs(frame_secs - total) > 1.0 / fps:
            bad.append("frames %.2fs vs chapter %.2fs" % (frame_secs, total))
    mp4_secs = None
    if have_mp4:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                            "-of", "default=nw=1:nk=1", mp4_path], capture_output=True, text=True)
        try:
            mp4_secs = float(r.stdout.strip())
        except Exception:
            mp4_secs = None
        if mp4_secs is not None and abs(mp4_secs - total) > 1.0 / (fps or 24):
            bad.append("mp4 %.2fs vs chapter %.2fs" % (mp4_secs, total))
    detail = "chapter %.2fs, frames %s, mp4 %s" % (
        total, "%.2fs" % frame_secs if frame_secs is not None else "n/a",
        "%.2fs" % mp4_secs if mp4_secs is not None else "n/a")
    return (not bad, detail, "; ".join(bad))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--shape", default="tall", choices=["tall", "wide"])
    ap.add_argument("--fps", type=int, default=None,
                    help="frame rate to look for; default 24 for a scene film, 30 for a plate short")
    a = ap.parse_args()
    slug, shape = a.slug, a.shape

    #  A SLUG THAT DOES NOT EXIST IS A CLEAN LINE, NOT A TRACEBACK.
    #  WHAT BROKE BEFORE: a typo'd slug, or one that had not been compiled
    #  yet, raised FileNotFoundError straight out of main() -- a wall of
    #  Python the person running this did not ask for.
    chapter_path = os.path.join(FILMS, slug + ".json")
    try:
        chapter = load_json(chapter_path)["chapters"][0]
    except FileNotFoundError:
        print("no compiled film at %s (run: python3 film.py compile %s, or python3 shortplate.py for a plate short)" % (chapter_path, slug))
        sys.exit(2)
    except (json.JSONDecodeError, KeyError, IndexError) as e:
        print("films/%s.json is not a valid compiled chapter (%s)" % (slug, e))
        sys.exit(2)

    plate = is_plate_chapter(chapter)
    beat = chapter["beats"][0] if plate else None

    #  A PLATE SHORT HAS NO SPEC (it comes from a brief, not a spec/darkroom
    #  style scene file) and no piper stand in narration timings -- both are
    #  scene-format-only sidecars, so neither is looked for on a plate slug.
    spec_path = os.path.join(SPECS, slug + ".json")
    spec = load_json(spec_path) if (not plate and os.path.exists(spec_path)) else None
    timings_path = os.path.join(VOICEDIR, slug, "timings.json")
    timings = load_json(timings_path) if (not plate and os.path.exists(timings_path)) else None

    default_fps = 30 if plate else 24
    frames_dir_found, fps_frames, actual = find_frames_dir(slug, shape, a.fps)
    fps = fps_frames or a.fps or default_fps
    planned = planned_frame_count(chapter, fps)
    #  A CHECK MUST NEVER PASS ON FRAMES IT DID NOT READ.
    #  WHAT BROKE BEFORE: any jpgs at all made frames_dir truthy, so a render
    #  stopped halfway (a worker died, --budget ran out) still ran every
    #  pixel check against whatever fraction was on disk and could print a
    #  clean PASS. frames_dir only reaches a check now when the count on
    #  disk meets the plan; short of that every frame check is SKIPPED and
    #  says exactly how short.
    frames_ready = frames_dir_found is not None and actual >= planned
    frames_dir = frames_dir_found if frames_ready else None
    frames_note = "%d of %d frames present" % (actual, planned)
    #  the mp4 convention itself differs: a plate short's picture sits next
    #  to noor.py named for its own fps (noor.py's own encode(), no tag);
    #  a scene film's lives in out/ named for slug and shape alone.
    if plate:
        mp4_path = os.path.join(HERE, "%s-%s-%dfps.mp4" % (slug, shape, fps))
    else:
        mp4_path = os.path.join(OUT, "%s-%s.mp4" % (slug, shape))

    rows = []
    if plate:
        rows.append(("words: no dashes anywhere", *check_words_plate(beat)))
        rows.append(("pacing: a change every 2 to 4s", *check_pacing(chapter, frames_dir, fps, None, beat)))
        rows.append(("first frame has something to look at", *check_first_frame(frames_dir, frames_note)))
        rows.append(("no frame black or blown", *check_no_black_blown(frames_dir, frames_note)))
        rows.append(("watermark corner lit, elsewhere dark", *check_watermark(frames_dir, chapter, shape, frames_note)))
        rows.append(("text stays out of the safe margins", *check_text_safe_plate(frames_dir, beat, fps, shape, frames_note)))
        rows.append(("sound: loudness and true peak", *check_loudness_plate(slug, shape, mp4_path)))
        rows.append(("marks land on the drawing's own events", *check_marks_plate(slug, shape, beat)))
        rows.append(("length agrees: chapter, frames, mp4", *check_length(chapter, frames_dir, fps, mp4_path, frames_note)))
    else:
        rows.append(("words: no dashes anywhere", *check_words(chapter, timings)))
        rows.append(("pacing: a change every 2 to 4s", *check_pacing(chapter, frames_dir, fps, spec)))
        rows.append(("first frame has something to look at", *check_first_frame(frames_dir, frames_note)))
        rows.append(("no frame black or blown", *check_no_black_blown(frames_dir, frames_note)))
        rows.append(("watermark corner lit, elsewhere dark", *check_watermark(frames_dir, chapter, shape, frames_note)))
        rows.append(("text stays out of the safe margins", *check_text_safe(frames_dir, chapter, fps, shape, frames_note)))
        rows.append(("sound: loudness, peak, marks, narration", *check_sound(slug, shape, chapter, timings)))
        rows.append(("length agrees: chapter, frames, mp4", *check_length(chapter, frames_dir, fps, mp4_path, frames_note)))

    print("%s %s audit" % (slug, shape))
    failed = False
    out_rows = []
    for name, ok, detail, bad in rows:
        state = "SKIPPED" if ok is None else ("PASS" if ok else "FAIL")
        failed = failed or (ok is False)
        print("  %-42s %-7s %s" % (name, state, detail or ""))
        if bad:
            print("      " + bad)
        out_rows.append({"check": name, "state": state, "detail": detail, "problem": bad})

    with open(os.path.join(OUT, "%s-%s.audit.json" % (slug, shape)), "w", encoding="utf-8") as f:
        json.dump({"slug": slug, "shape": shape, "rows": out_rows}, f, indent=2)
        f.write("\n")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
