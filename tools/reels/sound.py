#!/usr/bin/env python3
"""NOOR reel · the bed under the picture.

Notes, not a song. Every note is triggered by something the picture does: the
opening bloom, the phrase that turns gold, the date ruling in, each block of
substance arriving, the way home. Nothing is on a grid, nothing repeats, there
is no pulse and no percussion -- the rhythm of the sound is the rhythm of the
animation, because the timeline the words are built on is the timeline the
notes are placed on.

The pitch set is suspended: root, fourth, fifth, octave, ninth, eleventh. There
is no third anywhere in it, so it never resolves major or minor and never
arrives anywhere -- which is both the reason it stays clear of what is argued
about, and the reason it sounds the way it does. Floating is what an unresolved
fourth sounds like.

The voice is a glass pad: a stack of partials with the upper ones slightly
sharp and dying sooner, which is what a struck bell does. It is played into a
synthesised hall -- a real convolution, not a delay pretending -- with the
highs decaying first, as they do in a room made of stone.

Under all of it, quietly, the drone and the air from before.

Nothing is sampled and nothing is licensed: it is all built here in numpy.
"""
import os, re, subprocess, wave
import numpy as np

SR = 48000
TARGET_LUFS = -18.0      # ambient sits below a music mix; Meta lifts the rest
TRUE_PEAK_DB = -2.0
NOMINAL_LUFS = -16.0     # fallback if ffmpeg cannot measure; see bed()

#  B1     C2     C#2    D2  -- picked by the card's own seed, so the same card
#  always sounds the same and the account keeps one voice
ROOTS = [61.74, 65.41, 69.30, 73.42]
BEAT_HZ = 4.5            # theta; the binaural split on the drone's octave

# suspended, so there is no third to resolve: root, 4th, 5th, 8ve, 9th, 11th, 12th
SUS = [0, 5, 7, 12, 14, 17, 19]
ROOM_SEED = 20240401     # one hall for the whole account


def _smooth(u):
    u = np.clip(u, 0.0, 1.0)
    return u * u * (3.0 - 2.0 * u)


def _band(x, lo, hi):
    """shape noise into a band with soft shoulders, in the frequency domain"""
    n = len(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    lf = np.log2(np.maximum(f, 1e-6))
    g = 1.0 / (1.0 + np.exp(-(lf - np.log2(lo)) * 5.0))
    g *= 1.0 / (1.0 + np.exp((lf - np.log2(hi)) * 5.0))
    return np.fft.irfft(np.fft.rfft(x) * g, n).astype(np.float32)


def _lfo(t, hz, phase, lo, hi):
    return lo + (hi - lo) * (0.5 + 0.5 * np.sin(2 * np.pi * hz * t + phase))


def _ramp(t, a, b):
    return _smooth((t - a) / max(1e-6, b - a))


# ---------------------------------------------------------------- the hall

def _ir(secs=4.2, seed=ROOM_SEED):
    """one room, built from noise that dies band by band.

    High frequencies are absorbed faster than low ones by everything a room is
    made of, so a tail whose bands all decay together sounds like a machine.
    These do not, which is the whole difference between a reverb and an echo.
    """
    n = int(SR * secs)
    rng = np.random.default_rng(seed)
    k = np.arange(n, dtype=np.float32) / SR
    out = np.zeros(n, dtype=np.float32)
    for lo, hi, tau, amp in ((70, 300, secs * 0.90, 0.85),
                             (300, 1200, secs * 0.62, 1.00),
                             (1200, 4000, secs * 0.38, 0.70),
                             (4000, 11000, secs * 0.20, 0.40)):
        b = _band(rng.standard_normal(n).astype(np.float32), lo, hi)
        out += amp * b * np.exp(-6.91 * k / tau)          # -60 dB at tau
    pre = int(SR * 0.032)                                  # a little pre-delay
    out = np.concatenate([np.zeros(pre, np.float32), out])[:n]
    out /= max(1e-9, float(np.sqrt((out ** 2).sum())))     # unit energy
    return out


def _conv(x, ir):
    n = len(x)
    N = 1 << int(np.ceil(np.log2(n + len(ir) - 1)))
    y = np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[:n]
    return y.astype(np.float32)


# ---------------------------------------------------------------- the voice

def _note(t, at, hz, amp=1.0, hold=6.0, attack=0.05):
    """one struck note of the glass pad, from `at` onward

    The partials are slightly sharp and die sooner the higher they are, which
    is what makes a struck thing sound struck rather than blown.
    """
    u = t - at
    live = u >= 0
    if not live.any():
        return np.zeros_like(t)
    out = np.zeros_like(t)
    uu = np.where(live, u, 0.0)
    env_a = _smooth(uu / attack)
    # How far the two copies of each partial are detuned decides how fast they
    # beat against each other. On a struck note that beat is the shimmer of a
    # bell. On a pad that holds for twenty seconds the same beat never stops,
    # and a tremolo that never stops is a pulse -- which is the one thing this
    # bed must not have. So a long note is detuned four times less, and each
    # partial by a different amount, so the beats never line up into one.
    det = 0.0016 if hold < 20.0 else 0.00038
    for k, (mult, a, dk) in enumerate(((1.00, 1.00, 1.00), (2.00, 0.46, 0.80),
                                       (3.01, 0.24, 0.62), (4.02, 0.13, 0.48),
                                       (5.43, 0.065, 0.36), (7.06, 0.030, 0.28))):
        f = hz * mult
        if f > SR * 0.45:
            break
        body = np.exp(-uu / (hold * dk / 3.0))
        d = det * (0.55 + 0.42 * k)
        w = (np.sin(2 * np.pi * f * uu)
             + np.sin(2 * np.pi * f * (1.0 + d) * uu + 0.7 + k)) * 0.5
        out += a * body * w
    return out * env_a * live * amp


def _score(info, secs, lines):
    """what gets played, and exactly when.

    Two layers. The pad is three long tones that swell in and hold, so there is
    always something sounding and the reel never thins out between events. The
    struck notes sit on top of it, and every one of them is something the
    picture does. Entries are (time, degree, level, ring, attack).
    """
    tDate = float(info["tDate"])
    tBody = float(info["tBody"])
    tClose = float(info["tClose"])
    step = float(info["step"])
    hookEnd = float(info["hookEnd"])

    plan = [
        # the pad: swells in, holds, and is the reason there is never a hole
        (0.10,            SUS[0],  0.26, 90.0, 1.5),
        (0.10,            SUS[2],  0.19, 90.0, 2.2),
        (tBody - 0.4,     SUS[3],  0.15, 90.0, 2.4),   # opens with the substance

        # the struck notes: one for each thing that happens on screen
        (0.02,            SUS[2],  0.46, 7.0, 0.04),   # the bloom, on the fifth
        (0.30,            SUS[0],  0.34, 8.0, 0.05),   # the root under it
        (hookEnd - 0.30,  SUS[5],  0.60, 6.5, 0.03),   # the surprise turns gold
        (hookEnd + 0.10,  SUS[3],  0.26, 6.0, 0.05),   # settling under it
        (tDate,           SUS[1],  0.34, 7.5, 0.05),   # where and when
    ]
    walk = [SUS[4], SUS[2], SUS[6], SUS[3], SUS[5]]   # the substance, wandering
    for i in range(max(1, int(lines))):
        at = tBody + i * step
        if at > secs - 1.2:
            break
        plan.append((at, walk[i % len(walk)], 0.38, 7.5, 0.05))
        if i:                                     # a quiet root beneath it
            plan.append((at + 0.24, SUS[0], 0.17, 6.5, 0.06))
    plan.append((tClose, SUS[0], 0.40, 8.0, 0.05))    # the way home, on the root
    plan.append((tClose + 0.30, SUS[2], 0.26, 7.5, 0.05))
    return [p for p in plan if 0.0 <= p[0] < secs - 0.35]


# ---------------------------------------------------------------- the bed

def build(info, secs, seed, slot="morning", lines=3):
    """(left, right) float32 for one card, cut to that card's own timeline"""
    n = int(round(SR * secs))
    t = np.arange(n, dtype=np.float32) / SR
    rng = np.random.default_rng(int(seed) * 7919 + 13)

    tBody = float(info["tBody"])
    tDate = float(info["tDate"])
    tClose = float(info["tClose"])
    evening = slot != "morning"

    fade_in = _smooth(t / 0.45)
    fade_out = 1.0 - _smooth((t - (secs - 1.15)) / 1.15)
    master = fade_in * fade_out
    opened = _ramp(t, tBody - 0.5, tBody + 1.4) * (1.0 - 0.55 * _ramp(t, tClose, tClose + 1.6))
    lift = 0.55 + 0.20 * _ramp(t, tDate, tDate + 1.0) + 0.25 * opened

    root = ROOTS[int(seed) % len(ROOTS)] * (0.9439 if evening else 1.0)

    # ---- the notes ------------------------------------------------------
    # played four octaves up from the drone root, where a phone can hear them
    base = root * 8.0
    dry = np.zeros(n, dtype=np.float32)
    for at, deg, amp, hold, atk in _score(info, secs, lines):
        dry += _note(t, at, base * (2.0 ** (deg / 12.0)), amp, hold, atk)
    dry *= 0.16

    hall = _ir()
    wet_l = _conv(dry, hall)
    wet_r = _conv(dry, _ir(seed=ROOM_SEED + 1))       # the other side of the room
    g = 3.1                                           # the hall is most of it
    notes_l = dry * 0.42 + wet_l * g
    notes_r = dry * 0.42 + wet_r * g

    # ---- the drone, now a bed rather than the subject --------------------
    parts = [(1.0, 0.30), (1.5, 0.20), (2.0, 0.34), (3.0, 0.30),
             (4.0, 0.26), (6.0, 0.16), (8.0, 0.09)]
    dl = np.zeros(n, dtype=np.float32)
    dr = np.zeros(n, dtype=np.float32)
    for k, (mult, amp) in enumerate(parts):
        f = root * mult
        a = amp * (1.0 if mult <= 2.0 else (0.52 + 0.48 * opened))
        a = a * _lfo(t, 0.031 + 0.017 * k, k * 1.7, 0.78, 1.0)
        if mult == 2.0:
            dl += a * np.sin(2 * np.pi * (f - BEAT_HZ / 2) * t + 0.4)
            dr += a * np.sin(2 * np.pi * (f + BEAT_HZ / 2) * t + 0.4)
        else:
            w = a * np.sin(2 * np.pi * f * t + k * 0.9)
            dl += w
            dr += w
    drone = 0.085 * lift
    dl *= drone
    dr *= drone

    # ---- the air, quieter still -----------------------------------------
    shared = rng.standard_normal(n).astype(np.float32)
    low = _band(shared, 40.0, 190.0)
    mid = _band(shared, 280.0, 1400.0)
    hil = _band(rng.standard_normal(n).astype(np.float32), 3000.0, 9000.0)
    hir = _band(rng.standard_normal(n).astype(np.float32), 3000.0, 9000.0)
    for a in (low, mid, hil, hir):
        a /= max(1e-9, float(np.abs(a).max()))
    g_low = 0.030 * _lfo(t, 0.023, 0.0, 0.70, 1.0) * (0.5 + 0.5 * lift)
    g_mid = _lfo(t, 0.037, 1.1, 0.012, 0.032) * (0.7 if evening else 1.0)
    g_hi = 0.013 * _lfo(t, 0.051, 2.3, 0.6, 1.0) * (1.35 if not evening else 1.0)
    air_l = low * g_low + mid * g_mid + hil * g_hi
    air_r = low * g_low + mid * g_mid + hir * g_hi

    left = notes_l + dl + air_l
    right = notes_r + dr + air_r
    return left * master, right * master


# ---------------------------------------------------------------- output

def _write(path, left, right, gain=1.0):
    a = np.stack([left * gain, right * gain], axis=1)
    a = np.clip(a, -1.0, 1.0)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((a * 32767.0).astype("<i2").tobytes())
    return path


def _lufs(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path,
                          "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    m = re.findall(r"I:\s*(-?\d+(?:\.\d+)?)\s*LUFS", out)
    return float(m[-1]) if m else None


def bed(path, info, secs, seed, slot="morning", lines=3, target=TARGET_LUFS):
    """write one card's bed, trimmed to an exact loudness, and return its path"""
    left, right = build(info, secs, seed, slot, lines)
    peak = max(1e-9, float(max(np.abs(left).max(), np.abs(right).max())))
    head = 10.0 ** (-6.0 / 20.0) / peak
    _write(path, left, right, head)
    got = _lufs(path)
    if got is None:
        got = NOMINAL_LUFS
    gain = head * 10.0 ** ((target - got) / 20.0)
    gain = min(gain, 10.0 ** (TRUE_PEAK_DB / 20.0) / peak)
    _write(path, left, right, gain)
    return path


def measure(path):
    """(integrated LUFS, peak dBFS) of a rendered file -- for the audit"""
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path,
                          "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    i = re.findall(r"I:\s*(-?\d+(?:\.\d+)?)\s*LUFS", out)
    p = re.findall(r"Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS", out)
    return (float(i[-1]) if i else None), (float(p[-1]) if p else None)


def check(path, target=TARGET_LUFS, slack=1.5):
    """what a finished reel's sound has to be true for.

    Instagram treats a file with no audio stream as malformed, so the absence
    of a track is a production fault, not a cosmetic one. The rest keeps every
    reel at one level: an account whose posts jump in volume gets muted.
    """
    faults = []
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a",
         "-show_entries", "stream=codec_name,channels,sample_rate",
         "-of", "default=nw=1:nk=0", path], capture_output=True, text=True).stdout
    got = dict(l.split("=", 1) for l in out.strip().splitlines() if "=" in l)
    if not got:
        return ["no audio stream at all: Instagram will refuse the file"]
    if got.get("codec_name") != "aac":
        faults.append("audio is %s, not aac" % got.get("codec_name"))
    if got.get("channels") != "2":
        faults.append("audio is %s channel, not stereo" % got.get("channels"))
    if got.get("sample_rate") != str(SR):
        faults.append("audio is %s Hz, not %d" % (got.get("sample_rate"), SR))
    lufs, peak = measure(path)
    if lufs is None:
        faults.append("the loudness could not be measured")
    elif abs(lufs - target) > slack:
        faults.append("%.1f LUFS, wanted %.1f" % (lufs, target))
    if peak is not None and peak > -1.0:
        faults.append("peaks at %.1f dBFS, too close to clipping" % peak)
    return faults
