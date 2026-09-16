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


# ------------------------------------------------------------------ frames
def planned_frame_count(chapter, fps):
    """holds plus the last beat's fade, times fps: exactly noor.py's own
    plan() (see the FADE comment there), so a partial render is measured
    against the count the render is actually going for, not a guess."""
    return int(round(chapter_length(chapter)[1] * fps))


def find_frames_dir(slug, shape):
    """The frames folder with the most numbered jpgs for this slug and
    shape, and how many of them there are. Returns (dir_or_None, fps,
    actual_count); the caller decides against the PLANNED count whether
    that is enough to read from, not this function."""
    hits = sorted(glob.glob(os.path.join(HERE, "frames", "%s-%s-*fps-*" % (slug, shape))))
    if not hits:
        return None, None, 0
    best = max(hits, key=lambda d: len(glob.glob(os.path.join(d, "??????.jpg"))))
    m = re.search(r"-(\d+)fps-", os.path.basename(best))
    fps = int(m.group(1)) if m else None
    n = len(glob.glob(os.path.join(best, "??????.jpg")))
    if n == 0:
        return None, fps, 0
    return best, fps, n


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


def check_pacing(chapter, frames_dir, fps, spec=None):
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
        print("no compiled film at %s (run: python3 film.py compile %s)" % (chapter_path, slug))
        sys.exit(2)
    except (json.JSONDecodeError, KeyError, IndexError) as e:
        print("films/%s.json is not a valid compiled chapter (%s)" % (slug, e))
        sys.exit(2)

    spec_path = os.path.join(SPECS, slug + ".json")
    spec = load_json(spec_path) if os.path.exists(spec_path) else None
    timings_path = os.path.join(VOICEDIR, slug, "timings.json")
    timings = load_json(timings_path) if os.path.exists(timings_path) else None

    frames_dir_found, fps_frames, actual = find_frames_dir(slug, shape)
    fps = fps_frames or 24
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
    mp4_path = os.path.join(OUT, "%s-%s.mp4" % (slug, shape))

    rows = []
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
