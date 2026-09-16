#!/usr/bin/env python3
"""NOOR - the sound for a scene film (darkroom and any film built the same way).

    python3 filmsound.py darkroom --shape tall

WHY THIS IS ITS OWN FILE AND NOT A CHANGE TO shortmusic.py
shortmusic.py knows one shape of film: a plate short, with lines and steps
read out of a single beat's `lines`/`at` arrays. darkroom has no such beat;
it has a chapter-level `sound` list of named events at absolute times,
written by film.py compile from specs/darkroom.json. Rather than bend
shortmusic's event model to fit a second shape, this file imports the
instrument (decode, pick_window, find_key, hall, struck, thin, the level
helpers) and drives it from darkroom's own event list. shortmusic.py is
never touched.

WHAT EACH SPEC SOUND EVENT DOES
  roomtone                  a very quiet room bed, the whole film
  music_in                  the score fades in over 1.2 s from here
  music_release             a 2 dB lift on the score, ramped over 1 s
  music_out                 the score fades out from here to the end
  silence                   not a mark: the score dips 6 dB for a beat
  anything else with a "voice"   one struck mark (glass, felt or wood)

VOICE NAMES THE SPEC USES THAT shortmusic.VOICE DOES NOT HAVE, CONFIRMED
BY THE DIRECTOR (round two of these orders)
  air         glass, one octave down, minus 6 dB
  air_low     glass, two octaves down, minus 6 dB (air's own treatment
              carried one octave further)
  glass_low   glass, one octave down, at the ordinary mark level (no
              minus 6 dB: that reduction belongs to "air" only)
See VOICE_MAP below for where this is applied.
"""
import argparse, json, math, os, re, subprocess, sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import fftconvolve

HERE = os.path.dirname(os.path.abspath(__file__))
SPECS = os.path.join(HERE, "specs")
FILMS = os.path.join(HERE, "films")
MUSICDIR = os.path.join(HERE, "music")
OUT = os.path.join(HERE, "out")

sys.path.insert(0, HERE)
from shortmusic import (SR, decode, pick_window, find_key, hall, struck, thin,
                        at_db, rc, lowpass, hz, lufs as sm_lufs)

#  The same walking minor scale shortmusic.build() climbs across its own
#  marks, declared here too since shortmusic keeps it local to that function
#  and this file may not edit shortmusic.py to export it.
DEG = [0, 3, 5, 7, 10, 12, 14, 15]

#  spec voice name -> (shortmusic voice, octaves down, extra dB)
VOICE_MAP = {
    "glass": ("glass", 0, 0.0),
    "felt": ("felt", 0, 0.0),
    "wood": ("wood", 0, 0.0),
    "air": ("glass", 1, -6.0),
    "air_low": ("glass", 2, -6.0),
    "glass_low": ("glass", 1, 0.0),
}

NOT_MARKS = {"roomtone", "music_in", "music_release", "music_out", "silence"}


def load_chapter(slug):
    with open(os.path.join(FILMS, slug + ".json"), encoding="utf-8") as f:
        return json.load(f)


def load_spec(slug):
    with open(os.path.join(SPECS, slug + ".json"), encoding="utf-8") as f:
        return json.load(f)


def film_length(chapter):
    FADE = {"cut": 0.001, "dissolve": 0.7, "flash": 0.7, "slow": 1.0}
    beats = chapter["beats"]
    body = sum(max(1.2, b["hold"]) for b in beats)
    fade = FADE.get(beats[-1].get("exit", "dissolve"), FADE["dissolve"])
    return body, body + fade


def pick_track(letter):
    """music/ holds noor-score-C-vast-and-patient.m4a and
    noor-score-D-weight-and-air.m4a; the spec names the letter only."""
    if not os.path.isdir(MUSICDIR):
        sys.exit("no music in %s" % MUSICDIR)
    tag = "-%s-" % letter
    for f in sorted(os.listdir(MUSICDIR)):
        if tag in f:
            return os.path.join(MUSICDIR, f)
    sys.exit("no track named %s in %s" % (letter, MUSICDIR))


# --------------------------------------------------------------- roomtone
def make_roomtone(n, level_db=-44.0, cutoff=900.0, seed=17):
    """A very quiet filtered noise bed for the whole film. Filtered, not
    raw white noise, because raw hiss under a struck mark is what makes a
    sample sound cheap (the same reasoning as shortmusic.hall)."""
    rng_l = np.random.default_rng(seed)
    rng_r = np.random.default_rng(seed + 1)
    l = lowpass(rng_l.standard_normal(n).astype(np.float32), cutoff, 2)
    r = lowpass(rng_r.standard_normal(n).astype(np.float32), cutoff, 2)
    return at_db(l, level_db), at_db(r, level_db)


# ------------------------------------------------------------- music shape
def music_gain_envelope(n, sr, sound):
    """One multiplicative gain curve carrying every music_in/release/out and
    silence cue. Built once, in time order, rather than as separate filters,
    so the release lift and the fade out compose correctly when they land
    close together, as they do here (release at s9+3.0s, out at s10+4.0s)."""
    g = np.ones(n, dtype=np.float32)

    def at(ev_name):
        for e in sound:
            if e["event"] == ev_name:
                return e["at"]
        return None

    t_in = at("music_in")
    if t_in is not None:
        i0 = int(round(t_in * sr))
        g[:max(0, i0)] = 0.0
        ramp = rc(int(round(1.2 * sr)))
        i1 = min(n, i0 + len(ramp))
        if i1 > i0:
            g[i0:i1] = ramp[:i1 - i0]

    t_rel = at("music_release")
    if t_rel is not None:
        i0 = int(round(t_rel * sr))
        lift = 10.0 ** (2.0 / 20.0)
        ramp_len = int(round(1.0 * sr))
        curve = 1.0 + (lift - 1.0) * rc(ramp_len)
        i1 = min(n, i0 + ramp_len)
        if i1 > i0:
            g[i0:i1] *= curve[:i1 - i0]
        if i1 < n:
            g[i1:] *= lift

    t_out = at("music_out")
    if t_out is not None:
        i0 = int(round(t_out * sr))
        if i0 < n:
            fall = rc(n - i0)[::-1]
            g[i0:] *= fall

    #  silence: not a mark. Six dB down over 0.4 s, held 1.5 s, and back up
    #  over 0.4 s (a release the orders name a duration for but not a shape;
    #  a raised cosine matches every other transition in this file).
    dip = 10.0 ** (-6.0 / 20.0)
    in_n, hold_n, out_n = (int(round(x * sr)) for x in (0.4, 1.5, 0.4))
    shape = np.concatenate([
        1.0 - (1.0 - dip) * rc(in_n),
        np.full(hold_n, dip, dtype=np.float32),
        dip + (1.0 - dip) * rc(out_n),
    ]).astype(np.float32)
    for e in sound:
        if e["event"] == "silence":
            i0 = int(round(e["at"] * sr))
            i1 = min(n, i0 + len(shape))
            if i1 > i0:
                g[i0:i1] *= shape[:i1 - i0]
    return g


# --------------------------------------------------------------------- duck
def duck_gain(narration_mono, n, sr, duck_db, attack_s=0.12, release_s=0.70, ctrl_hz=500.0):
    """The music and marks sit duck_db under the narration, attack and
    release given in seconds. Run at a 500 Hz control rate (fast enough for
    a 120 ms attack, cheap enough to smooth with a plain python loop) and
    then stretched back out to the full sample rate."""
    hop = max(1, int(round(sr / ctrl_hz)))
    m = np.abs(narration_mono)
    nh = int(math.ceil(len(m) / hop)) or 1
    pad = nh * hop - len(m)
    if pad > 0:
        m = np.concatenate([m, np.zeros(pad, dtype=m.dtype)])
    peak = m.reshape(nh, hop).max(axis=1)
    top = float(peak.max()) or 1e-9
    gate = (peak / top > 0.03).astype(np.float32)
    a_att = math.exp(-1.0 / (attack_s * ctrl_hz))
    a_rel = math.exp(-1.0 / (release_s * ctrl_hz))
    sm = np.zeros(nh, dtype=np.float32)
    prev = 0.0
    for i in range(nh):
        a = a_att if gate[i] > prev else a_rel
        prev = a * prev + (1.0 - a) * gate[i]
        sm[i] = prev
    gain_db = sm * duck_db
    gain = np.repeat((10.0 ** (gain_db / 20.0)).astype(np.float32), hop)[:n]
    if len(gain) < n:
        tail = gain[-1] if len(gain) else 1.0
        gain = np.concatenate([gain, np.full(n - len(gain), tail, dtype=np.float32)])
    return gain


# --------------------------------------------------------------- true peak
def measure_ebur128(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path,
                        "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    out = r.stderr
    Im = re.findall(r"\bI:\s*(-?\d+(?:\.\d+)?)\s*LUFS", out)
    Pm = re.findall(r"Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS", out)
    return (float(Im[-1]) if Im else None, float(Pm[-1]) if Pm else None)


def apply_alimiter(path, ceiling_db):
    limit_lin = max(0.0625, min(1.0, 10.0 ** (ceiling_db / 20.0)))
    tmp = path + ".lim.wav"
    r = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", path,
                        "-af", "alimiter=limit=%.6f:attack=5:release=50:level=0" % limit_lin,
                        tmp])
    if r.returncode == 0:
        os.replace(tmp, path)
        return True
    return False


def write_stereo(path, l, r, sr):
    a = np.clip(np.stack([l, r], axis=1), -1.0, 1.0)
    import wave
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((a * 32767.0).astype("<i2").tobytes())


# ---------------------------------------------------------------- the mix
def build(slug, shape):
    chapter = load_chapter(slug)["chapters"][0]
    spec = load_spec(slug)
    sound = chapter.get("sound", [])
    body, total = film_length(chapter)
    #  EXACTLY THE PICTURE'S LENGTH, NOT A SECOND LONGER.
    #  WHAT BROKE BEFORE: every stem used to be built one second past the
    #  picture (room for pick_window to choose from), and that extra second
    #  was written straight into the delivered wav. mux's -shortest then cut
    #  the file down to the picture's real length, landing mid fade rather
    #  than at the silence music_out's own curve was heading for -- the
    #  score was audibly still there, about 12 dB under itself, at the cut.
    #  Every stem below is built to exactly n samples; only the SOURCE
    #  material pick_window chooses from is allowed to run past that, so it
    #  has room to pick a window that is actually growing where it is cut.
    n = int(round(total * SR))  # the exact working length every stem shares

    # ---- narration --------------------------------------------------
    narr_path = os.path.join(HERE, "voice", slug, "narration.wav")
    if not os.path.exists(narr_path):
        sys.exit("no narration at %s. Run `python3 film.py voice %s` first." % (narr_path, slug))
    nsr, ndata = wavfile.read(narr_path)
    nl = ndata[:, 0].astype(np.float32) / 32767.0
    nr = ndata[:, 1].astype(np.float32) / 32767.0
    if nsr != SR:
        sys.exit("narration is at %d Hz, expected %d" % (nsr, SR))
    if len(nl) < n:
        pad = n - len(nl)
        nl = np.concatenate([nl, np.zeros(pad, dtype=np.float32)])
        nr = np.concatenate([nr, np.zeros(pad, dtype=np.float32)])
    else:
        nl, nr = nl[:n], nr[:n]

    # ---- music --------------------------------------------------------
    music = spec["music"]
    track_path = pick_track(music["track"])
    L, R = decode(track_path)
    mono = (L + R) * 0.5
    #  pick_window scores a candidate a second longer than the film so the
    #  "opens and grows" measurement is not biased by a window cut short of
    #  its own build; only the first n samples of the winner are ever taken.
    win_secs = total + 1.0
    at = pick_window(mono, win_secs)
    i0 = int(round(at * SR))
    Lc = L[i0:i0 + n].copy()
    Rc = R[i0:i0 + n].copy()
    if len(Lc) < n:
        Lc = np.concatenate([Lc, np.zeros(n - len(Lc), dtype=np.float32)])
        Rc = np.concatenate([Rc, np.zeros(n - len(Rc), dtype=np.float32)])
    pc, key_name = find_key(mono[i0:i0 + min(n, len(mono) - i0)])
    Lc = at_db(Lc, music["level_lufs"])
    Rc = at_db(Rc, music["level_lufs"])
    mgain = music_gain_envelope(n, SR, sound)
    Lc *= mgain
    Rc *= mgain

    # ---- marks ----------------------------------------------------------
    mark_events = [e for e in sound if e.get("event") not in NOT_MARKS and "voice" in e]
    mark_events.sort(key=lambda e: e["at"])
    marks = np.zeros(n, dtype=np.float32)
    marks_meta = []
    top_hz = 5200.0
    for i, e in enumerate(mark_events):
        base, down, extra_db = VOICE_MAP.get(e["voice"], (e["voice"], 0, 0.0))
        u = i / max(1, len(mark_events) - 1)
        frac = u if u < 0.78 else 0.78 - (u - 0.78) * 1.4
        d = DEG[min(len(DEG) - 1, max(0, int(round((len(DEG) - 1) * frac))))]
        f = hz((pc + d) % 12 + 12 * ((pc + d) // 12), 5) / (2.0 ** down)
        level = 10.0 ** (extra_db / 20.0)
        marks += struck(n, e["at"], f, base, level)
        marks_meta.append({"at": round(e["at"], 3), "event": e["event"], "voice": e["voice"]})
    marks = lowpass(marks, top_hz, 2)
    marks = at_db(marks, -29.5) if mark_events else marks
    room = hall(5.2, 320, sum(ord(c) for c in slug) % 7919 + 13)
    #  fftconvolve, not np.convolve: the room impulse is 5.2s at 48kHz and
    #  the marks track is the whole film, and a direct convolution of two
    #  arrays that size is O(n*m) -- it once ran past the two minute budget
    #  on a single call and looked like a hang, not a slow filter.
    wet = at_db(fftconvolve(marks, room)[:n], -31.0) if mark_events else marks
    marks_dry = marks

    dgain = duck_gain(0.5 * (nl + nr), n, SR, spec["music"]["duck_under_voice_db"])
    Lc *= dgain
    Rc *= dgain
    marks_dry = marks_dry * dgain
    wet = wet * dgain

    # ---- roomtone -------------------------------------------------------
    rl, rr = make_roomtone(n, seed=(sum(ord(c) for c in slug) % 97) + 3)

    left = nl + Lc + marks_dry + wet + rl
    right = nr + Rc + marks_dry * 0.97 + wet * 0.97 + rr

    # ---- master loudness --------------------------------------------------
    os.makedirs(OUT, exist_ok=True)
    wav_path = os.path.join(OUT, "%s-%s.wav" % (slug, shape))
    write_stereo(wav_path, left, right, SR)
    measured_i, measured_peak = measure_ebur128(wav_path)
    target_i = spec["export"]["master_lufs"]
    if measured_i is not None:
        g = 10.0 ** ((target_i - measured_i) / 20.0)
        write_stereo(wav_path, left * g, right * g, SR)
    ceiling = spec["export"]["true_peak_db"]
    apply_alimiter(wav_path, ceiling - 0.2)  # a little headroom under the ceiling for the limiter's own overshoot
    final_i, final_peak = measure_ebur128(wav_path)

    info = {
        "slug": slug, "shape": shape,
        "film_seconds": round(total, 2),
        "music": {"track": os.path.basename(track_path), "window_at": round(at, 2),
                  "window_seconds": round(win_secs, 2), "key": key_name,
                  "level_lufs": music["level_lufs"]},
        "marks": marks_meta,
        "duck_under_voice_db": spec["music"]["duck_under_voice_db"],
        "narration_path": narr_path,
        "measured": {"integrated_lufs": final_i, "true_peak_dbfs": final_peak,
                     "target_lufs": target_i, "target_true_peak_dbfs": ceiling},
    }
    with open(os.path.join(OUT, "%s-%s.sound.json" % (slug, shape)), "w", encoding="utf-8") as f:
        json.dump(info, f, indent=2)
        f.write("\n")

    print("  %s  track %s from %.1fs  key %s  %d marks" %
          (slug, info["music"]["track"], at, key_name, len(mark_events)))
    for m in marks_meta:
        print("    %6.2fs  %-16s %s" % (m["at"], m["event"], m["voice"]))
    print("  measured %.1f LUFS (target %.1f), true peak %.1f dBTP (ceiling %.1f)" %
          (final_i or -99, target_i, final_peak or -99, ceiling))
    print("  -> " + wav_path)
    return info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--shape", default="tall", choices=["tall", "wide"])
    a = ap.parse_args()
    build(a.slug, a.shape)
    return 0


if __name__ == "__main__":
    sys.exit(main())
