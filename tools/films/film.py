#!/usr/bin/env python3
"""NOOR - the terminal pipeline for one film: compile, voice, sound, mux, render.

    python3 film.py voice darkroom
    python3 film.py compile darkroom
    python3 film.py sound darkroom --shape tall
    python3 film.py mux darkroom --shape tall
    python3 film.py render darkroom --run
    python3 film.py all darkroom

WHY THIS FILE EXISTS
Every other film in this library is a corridor: one figure walking a long hall,
its camera and light worked out on the fly by web/stage.js from a spec of
lines and steps. darkroom is a scene: one room, one figure that never moves,
and a camera and a lantern that are choreographed by hand, beat by beat, in
specs/darkroom.json. Nothing before this file turned that scene spec into the
chapter JSON web/stage.js actually reads (figure/views/lantern/breath under
chapter.scene), spoke its narration, or built its sound. This file does all
three, and does them from the numbers in the spec, never from a guess.

THE RETIMING RULE, ONCE, HERE, SO IT IS NEVER TWO RULES
A scene's hold is max(the spec's own duration, the spoken line's length plus
0.9 s), and the line starts 0.3 s after its scene starts. WHAT BROKE BEFORE
THIS WAS ONE FUNCTION: an early draft computed the retimed hold in `compile`
and, separately, worked out where to drop each line in `voice`, and the two
had drifted by the time both were finished -- the picture held on a card for
3.6 s while the voice kept talking for another second into the next scene's
opening frame. `retime_scenes` is now the only place either number is made.
"""
import argparse, base64, json, math, os, subprocess, sys, time, wave

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
SPECS = os.path.join(HERE, "specs")
FILMS = os.path.join(HERE, "films")
VOICEDIR = os.path.join(HERE, "voice")
OUT = os.path.join(HERE, "out")

sys.path.insert(0, HERE)
from shortmusic import lufs as sm_lufs, limit as sm_limit, write as sm_write, SR as MUSIC_SR

PIPER = "/usr/local/bin/piper"
PIPER_MODEL = "/tmp/pipervoices/en-us-ryan-medium.onnx"
NARR_SR = MUSIC_SR  # 48000, the same rate the mixed sound is built at

#  THE ONE FADE TABLE. Mirrors FADE in web/stage.js and in noor.py's plan();
#  if either of those changes, this must change with it, or the length this
#  file prints stops matching the film noor.py actually renders.
FADE = {"cut": 0.001, "dissolve": 0.7, "flash": 0.7, "slow": 1.0}

#  Built from a code point, never typed literally: the house rule against a
#  dash applies to this file too, and a checker for the character is not an
#  exemption to hold the character itself.
EM_DASH, EN_DASH = chr(0x2014), chr(0x2013)


def has_dash(s):
    """True if s carries an em dash or an en dash. WHAT BROKE BEFORE: a
    dash slipped into a caption once, read fine on screen, and was only
    caught by a human proofing the final cut. Refusing at compile time
    means the house rule is enforced by the pipeline and not by memory."""
    return bool(s) and (EM_DASH in s or EN_DASH in s)


def refuse(msg):
    sys.stderr.write("refuse: %s\n" % msg)
    sys.exit(2)


def load_spec(slug):
    p = os.path.join(SPECS, slug + ".json")
    with open(p, encoding="utf-8") as f:
        return json.load(f)


# --------------------------------------------------------------- retiming
def retime_scenes(spec, lengths):
    """One pass over the spec's scenes, the only place hold and scene start
    are computed. lengths maps scene id to the measured narration length in
    seconds. Returns (scenes, total_body) where total_body is the sum of the
    retimed holds (seconds), before the last beat's exit fade."""
    out, clock = [], 0.0
    for sc in spec["scenes"]:
        d = float(sc["dur"])
        L = float(lengths[sc["id"]])
        hold = max(d, L + 0.9)
        out.append({"id": sc["id"], "spec_dur": d, "length": L, "hold": hold,
                    "scene_start": clock, "line_start": clock + 0.3})
        clock += hold
    return out, clock


def retimed_hold(authored, spec_dur, new_hold, eps=1e-6):
    """specs/darkroom.json's own retime convention: a lantern or camera hold
    that equalled the scene's WRITTEN duration meant "the whole scene", so it
    grows to the scene's retimed hold; a shorter hold was the artist's own
    number of seconds and is left exactly as written."""
    return new_hold if abs(authored - spec_dur) <= eps else authored


# ------------------------------------------------------------------ piper
def run_piper(text, wav_path):
    r = subprocess.run([PIPER, "--model", PIPER_MODEL, "--output_file", wav_path,
                        "--sentence_silence", "0.25"],
                       input=text.encode("utf-8"), capture_output=True)
    if r.returncode != 0 or not os.path.exists(wav_path):
        sys.exit("piper refused on %r\n%s" % (text, r.stderr.decode("utf-8", "ignore")[:600]))


def wav_seconds(path):
    with wave.open(path, "rb") as w:
        return w.getnframes() / float(w.getframerate())


def read_wav_mono_float(path):
    sr, data = wavfile.read(path)
    if data.dtype == np.int16:
        d = data.astype(np.float32) / 32768.0
    else:
        d = data.astype(np.float32)
    if d.ndim > 1:
        d = d.mean(axis=1)
    return sr, d


def resample_to(x, sr_from, sr_to):
    g = math.gcd(sr_from, sr_to)
    up, down = sr_to // g, sr_from // g
    return resample_poly(x, up, down).astype(np.float32)


# ------------------------------------------------------------- voice step
def build_narration_track(vdir, scenes, out_path):
    """Lays every scene's spoken line into one 48 kHz track at scene_start
    plus 0.3 s, per retime_scenes. WHAT BROKE BEFORE: laying lines out at
    their ORIGINAL spec offsets meant a scene that grew to fit its line
    pushed every later line into the previous scene's picture."""
    total = scenes[-1]["scene_start"] + scenes[-1]["hold"]
    n = int(round(total * NARR_SR))
    buf = np.zeros(n, dtype=np.float64)
    for i, s in enumerate(scenes, start=1):
        wav_path = os.path.join(vdir, "s%02d.wav" % i)
        sr, mono = read_wav_mono_float(wav_path)
        res = resample_to(mono, sr, NARR_SR)
        i0 = int(round(s["line_start"] * NARR_SR))
        i1 = i0 + len(res)
        if i1 > len(buf):
            buf = np.concatenate([buf, np.zeros(i1 - len(buf))])
        buf[i0:i1] += res
    sm_write(out_path, buf.astype(np.float32), buf.astype(np.float32))
    return total


def normalize_lufs(path, target_lufs):
    cur = sm_lufs(path)
    if cur is None:
        return {"before": None, "after": None, "target": target_lufs}
    g = 10.0 ** ((target_lufs - cur) / 20.0)
    sr, data = wavfile.read(path)
    l = data[:, 0].astype(np.float32) / 32767.0
    r = data[:, 1].astype(np.float32) / 32767.0
    l, r = sm_limit(l * g, r * g, ceiling_db=-1.5)
    sm_write(path, l, r)
    return {"before": round(cur, 2), "after": round(sm_lufs(path) or 0.0, 2), "target": target_lufs}


def build_envelope(narration_path, hz=50):
    """A 20 ms RMS envelope of the finished narration, 0..255, the shape
    render.py hands to NOORLUME so the Lantern breathes with the voice. A
    little smoothing keeps a single loud consonant from reading as a flash."""
    sr, data = wavfile.read(narration_path)
    mono = (data.astype(np.float64).mean(axis=1) if data.ndim > 1 else data.astype(np.float64)) / 32767.0
    win = int(round(sr / float(hz)))
    n = int(math.ceil(len(mono) / win)) or 1
    rms = np.zeros(n)
    for i in range(n):
        seg = mono[i * win:(i + 1) * win]
        rms[i] = math.sqrt(float(np.mean(seg ** 2))) if len(seg) else 0.0
    if n >= 3:
        sm = rms.copy()
        sm[1:-1] = (rms[:-2] + rms[1:-1] + rms[2:]) / 3.0
        rms = sm
    peak = rms.max() or 1e-9
    by = np.clip(np.round(rms / peak * 255.0), 0, 255).astype(np.uint8)
    return {"hz": hz, "n": int(n), "b64": base64.b64encode(by.tobytes()).decode("ascii")}


def do_voice(slug, spec=None):
    spec = spec or load_spec(slug)
    vdir = os.path.join(VOICEDIR, slug)
    os.makedirs(vdir, exist_ok=True)
    lengths, texts = {}, {}
    for i, sc in enumerate(spec["scenes"], start=1):
        text = sc["narration"]
        if has_dash(text):
            refuse("narration for %s carries a dash: %r" % (sc["id"], text))
        texts[sc["id"]] = text
        wav_path = os.path.join(vdir, "s%02d.wav" % i)
        run_piper(text, wav_path)
        lengths[sc["id"]] = wav_seconds(wav_path)

    scenes, total_body = retime_scenes(spec, lengths)
    narration_path = os.path.join(vdir, "narration.wav")
    build_narration_track(vdir, scenes, narration_path)
    lufs_report = normalize_lufs(narration_path, spec["narration"]["level_lufs"])
    env = build_envelope(narration_path)
    with open(os.path.join(FILMS, slug + ".envelope.json"), "w", encoding="utf-8") as f:
        json.dump(env, f)

    timings = {
        "slug": slug, "standin": True,
        "voice": "piper en-us-ryan-medium, a stand in until the owner's voice tool speaks the script",
        "total": total_body,
        "narration_lufs": lufs_report,
        "scenes": [{"id": s["id"], "text": texts[s["id"]], "start": round(s["line_start"], 3),
                    "length": round(s["length"], 3), "hold": round(s["hold"], 3),
                    "scene_start": round(s["scene_start"], 3), "spec_dur": s["spec_dur"]}
                   for s in scenes],
    }
    with open(os.path.join(vdir, "timings.json"), "w", encoding="utf-8") as f:
        json.dump(timings, f, indent=2)
        f.write("\n")
    return timings


def ensure_timings(slug, spec):
    p = os.path.join(VOICEDIR, slug, "timings.json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            t = json.load(f)
        want = [sc["id"] for sc in spec["scenes"]]
        if [s["id"] for s in t.get("scenes", [])] == want:
            return t
    print("  no timings yet for %s; speaking the narration first" % slug)
    return do_voice(slug, spec)


# ----------------------------------------------------------------- compile
def do_compile(slug):
    spec = load_spec(slug)
    timings = ensure_timings(slug, spec)
    by_id = {s["id"]: s for s in timings["scenes"]}
    n_scenes = len(spec["scenes"])

    beats, views, lantern, figure_events, sound = [], [], [], [], []
    for i, sc in enumerate(spec["scenes"]):
        t = by_id.get(sc["id"])
        if t is None:
            refuse("timings has no scene %s" % sc["id"])
        start, hold = t["scene_start"], t["hold"]
        if hold < sc["dur"] - 1e-6:
            refuse("scene %s retimed hold %.3f is under the spec duration %.3f" %
                   (sc["id"], hold, sc["dur"]))

        words = sc["words"]
        text = words.get("text")
        if not text:
            refuse("scene %s has no words" % sc["id"])
        for field in ("text", "sub", "eyebrow", "src"):
            v = words.get(field)
            if v and has_dash(v):
                refuse("scene %s field %s carries a dash: %r" % (sc["id"], field, v))

        beat = {"kind": "title", "text": text}
        if "eyebrow" in words:
            beat["eyebrow"] = words["eyebrow"]
        if "sub" in words:
            beat["sub"] = words["sub"]
        if "src" in words:
            beat["src"] = words["src"]
        beat["hold"] = round(hold, 3)
        beat["shot"] = "hold"
        if i == 0:
            beat["enter"] = "slow"
        if i == n_scenes - 1:
            beat["exit"] = "slow"
        beats.append(beat)

        cam = sc["camera"]
        view = {"eye": cam["eye"], "look": cam["look"], "roll": cam.get("roll", 0.0)}
        #  HFOV, NOT FOV, WHEN THE SPEC HAS ONE.
        #  hfov is the horizontal field of view, true across both frame
        #  shapes; stage.js converts it to each frame's own vertical fov
        #  (view.fov) at build time, from the frame's real aspect. A scene
        #  written before this round only had "fov" (already vertical), so
        #  that is kept as is rather than mistaken for a horizontal number.
        if "hfov" in cam:
            view["hfov"] = cam["hfov"]
        elif "fov" in cam:
            view["fov"] = cam["fov"]
        else:
            refuse("scene %s camera has neither hfov nor fov" % sc["id"])
        if "hold" in cam:
            view["hold"] = round(retimed_hold(cam["hold"], sc["dur"], hold), 3)
        views.append(view)

        lan = sc["lantern"]
        lcue = {"pos": lan["pos"], "scale": lan["scale"], "bright": lan["bright"]}
        #  hold: how long the lantern stays at pos before travelling to the
        #  next cue's pos. WHAT BROKE BEFORE THIS ROUND: this used to copy
        #  lan["hold"] straight through. s2's lantern.hold (4.2) equalled
        #  s2's WRITTEN duration (4.2), meaning "stay the whole scene", but
        #  s2 retimed to 5.341 s to hold piper's longer line and the copied
        #  4.2 then meant "stay 4.2 of the scene's 5.341 s and travel for the
        #  remaining 1.14 s" -- the light started moving toward the next cue
        #  before its own scene was over. retimed_hold below is the fix,
        #  applied identically to camera.hold above: a hold that equalled
        #  the spec's own duration grows with the scene; a shorter hold, one
        #  the artist meant as its own number of seconds, is left alone.
        if "hold" in lan:
            lcue["hold"] = round(retimed_hold(lan["hold"], sc["dur"], hold), 3)
        lantern.append(lcue)

        for ev in sc.get("figure", {}).get("events", []):
            e = dict(ev)
            e["at"] = round(start + float(ev["at"]), 3)
            figure_events.append(e)

        for sd in sc.get("sound", []):
            s = dict(sd)
            s["at"] = round(start + float(sd["at"]), 3)
            sound.append(s)

    if not (len(beats) == len(views) == len(lantern) == n_scenes):
        refuse("totals disagree: %d beats, %d views, %d lantern, %d scenes" %
               (len(beats), len(views), len(lantern), n_scenes))

    figure_events.sort(key=lambda e: e["at"])
    sound.sort(key=lambda e: e["at"])

    total_body = timings["total"]
    fade = FADE.get(beats[-1].get("exit", "dissolve"), FADE["dissolve"])
    total_len = total_body + fade

    fig = spec["figure"]
    figure = {"kind": fig["kind"], "room": fig["room"],
              "aperture": {"y": fig["aperture"]["y"], "r": fig["aperture"]["r"]},
              "lamps": fig["lamps"], "events": figure_events}

    chapter = {
        "id": "the-film", "title": spec["title"], "theme": spec.get("theme", "night"),
        "scene": {
            "figure": figure, "views": views, "lantern": lantern,
            "watermark": {"text": spec["watermark"]["text"], "safe": spec["watermark"]["safe"]},
            "breath": 0.35,
        },
        "beats": beats,
        "sound": sound,
    }
    out = {
        "slug": slug, "id": slug, "title": spec["title"],
        "note": ("compiled from specs/%s.json by film.py compile. holds sum to %.2f s, "
                 "plus a %.1f s slow fade on the last beat, total %.2f s." %
                 (slug, total_body, fade, total_len)),
        "chapters": [chapter],
    }
    path = os.path.join(FILMS, slug + ".json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
        f.write("\n")
    return out, total_body, total_len


# ------------------------------------------------------------------- check
def do_check(slug):
    """The tiny checker VERIFY asks for: does the compiled chapter still
    hold the shape stage.js requires, and does it still agree with the spec
    it came from."""
    spec = load_spec(slug)
    with open(os.path.join(FILMS, slug + ".json"), encoding="utf-8") as f:
        F = json.load(f)
    ch = F["chapters"][0]
    scene = ch["scene"]
    beats = ch["beats"]
    rows = []

    ok = len(beats) == len(scene["views"]) == len(scene["lantern"]) == len(spec["scenes"])
    rows.append(("one view and one lantern cue per beat", ok,
                 "%d beats, %d views, %d lantern" % (len(beats), len(scene["views"]), len(scene["lantern"]))))

    body = sum(max(1.2, b["hold"]) for b in beats)
    fade = FADE.get(beats[-1].get("exit", "dissolve"), FADE["dissolve"])
    total = body + fade
    times = [e["at"] for e in scene["figure"]["events"]] + [e["at"] for e in ch.get("sound", [])]
    inside = all(0.0 <= t <= total + 1e-6 for t in times)
    rows.append(("every absolute event time inside the film", inside,
                 "%d times checked against %.2fs" % (len(times), total)))

    holds_ok = all(b["hold"] >= sc["dur"] - 1e-6 for b, sc in zip(beats, spec["scenes"]))
    rows.append(("every hold at or above the spec duration", holds_ok, ""))

    dashy = []
    for b in beats:
        for field in ("text", "sub", "eyebrow", "src"):
            if has_dash(b.get(field)):
                dashy.append("%s.%s" % (b.get("text", "?")[:20], field))
    rows.append(("no em dash or en dash on screen", not dashy, ", ".join(dashy)))

    print("%s check" % slug)
    failed = False
    for name, passed, detail in rows:
        print("  %-42s %s  %s" % (name, "PASS" if passed else "FAIL", detail))
        failed = failed or not passed
    return 0 if not failed else 1


# --------------------------------------------------------------- sound/mux
def do_sound(slug, shape):
    import filmsound
    return filmsound.build(slug, shape)


def do_mux(slug, shape, fps=None):
    """Finds the silent picture noor.py --encode wrote, next to noor.py
    itself. WHAT BROKE BEFORE: this looked for one exact name at the FULL
    fps only (spec.FPS), so a proof render (12 fps) or any fps other than
    the one hardcoded here was invisible to mux even when it was the only
    silent picture on disk. Globbed now, and --fps narrows it when more
    than one fps has been rendered; the newest file wins when it does not."""
    import glob
    pattern = os.path.join(HERE, "%s-%s-%sfps*.mp4" % (slug, shape, fps if fps else "*"))
    hits = [p for p in glob.glob(pattern) if os.path.isfile(p)]
    if not hits:
        print("no silent picture yet matching %s (Builder A's frames are not ready; "
              "the Director renders tonight)" % pattern)
        sys.exit(3)
    silent = max(hits, key=os.path.getmtime)
    print("  using silent picture " + silent)
    sound_wav = os.path.join(OUT, "%s-%s.wav" % (slug, shape))
    if not os.path.exists(sound_wav):
        sys.exit("no sound yet at %s. Run `sound` first." % sound_wav)
    out_mp4 = os.path.join(OUT, "%s-%s.mp4" % (slug, shape))
    r = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                        "-i", silent, "-i", sound_wav, "-map", "0:v:0", "-map", "1:a:0",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                        "-shortest", "-movflags", "+faststart", out_mp4])
    if r.returncode:
        sys.exit("ffmpeg refused to mux")
    print("  -> " + out_mp4)
    return out_mp4


def do_render(slug, shapes, run):
    from spec import FPS as FULL_FPS
    cmds = []
    for shape in shapes:
        cmds.append(["python3", "noor.py", "--film", slug, "--shape", shape,
                     "--fps", "12", "--shutter", "1", "--encode"])
        cmds.append(["python3", "noor.py", "--film", slug, "--shape", shape,
                     "--fps", str(FULL_FPS), "--shutter", "3", "--encode"])
    for c in cmds:
        print("  " + " ".join(c))
    if run:
        for c in cmds:
            r = subprocess.run(c, cwd=HERE)
            if r.returncode:
                sys.exit("render command failed: %s" % " ".join(c))
    return cmds


def do_all(slug, shape):
    shape = shape or "tall"
    print("== compile (bootstraps timings if this is the first run) ==")
    do_compile(slug)
    print("== voice (speaks the narration, may resynthesise) ==")
    do_voice(slug)
    print("== compile again, retimed ==")
    _, body, total = do_compile(slug)
    print("  holds %.2fs + fade, film %.2fs" % (body, total))
    print("== sound ==")
    do_sound(slug, shape)
    print("== render, mux, audit (printed, not run; frames are not ready yet) ==")
    do_render(slug, ["tall", "wide"], run=False)
    print("  python3 film.py mux %s --shape %s" % (slug, shape))
    print("  python3 audit.py %s --shape %s" % (slug, shape))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["compile", "voice", "sound", "mux", "render", "all", "check"])
    ap.add_argument("slug")
    ap.add_argument("--shape", choices=["tall", "wide"], default=None)
    ap.add_argument("--run", action="store_true")
    ap.add_argument("--fps", type=int, default=None, help="mux: pick the silent picture at this fps")
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(FILMS, exist_ok=True)

    if a.cmd == "voice":
        t = do_voice(a.slug)
        print("  %d scenes spoken, total narrated body %.2fs" % (len(t["scenes"]), t["total"]))
        for s in t["scenes"]:
            print("    %-4s %5.2fs line, hold %5.2fs, start %6.2fs  %r" %
                  (s["id"], s["length"], s["hold"], s["scene_start"], s["text"]))
        return 0
    if a.cmd == "compile":
        _, body, total = do_compile(a.slug)
        print("  holds sum to %.2fs, film total %.2fs" % (body, total))
        return do_check(a.slug)
    if a.cmd == "check":
        return do_check(a.slug)
    if a.cmd == "sound":
        do_sound(a.slug, a.shape or "tall")
        return 0
    if a.cmd == "mux":
        do_mux(a.slug, a.shape or "tall", a.fps)
        return 0
    if a.cmd == "render":
        do_render(a.slug, [a.shape] if a.shape else ["tall", "wide"], a.run)
        return 0
    if a.cmd == "all":
        do_all(a.slug, a.shape)
        return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
