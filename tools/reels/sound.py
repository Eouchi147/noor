#!/usr/bin/env python3
"""NOOR reel · the bed under the picture.

Sound design, not a song. Everything here is either shaped noise -- air, wind,
the presence of a large stone room -- or a sustained tone. The tones are a
drone: root, fifth, octave, twelfth. There is no third in the stack, so it
never resolves major or minor, and with no melody and no pulse there is nothing
in it that behaves like an instrument playing a tune.

One partial is split a few hertz between the ears. On headphones that is the
binaural beat, a slow theta pulse; on a phone speaker the two ears sum into a
gentle breathing instead, so nothing is lost either way.

The bed is cut to the picture. Every swell is placed from the same timeline the
type layer reports, so the air lifts when the claim blooms, brightens when the
surprise turns gold, settles when the date rules in, opens as each block of
substance arrives, and thins on the way home. It fades from and to silence, so
the seam is clean when the reel loops.

Nothing is sampled and nothing is licensed: it is all built from numpy here.
"""
import os, re, subprocess, wave
import numpy as np

SR = 48000
TARGET_LUFS = -18.0      # ambient sits below a music mix; Meta lifts the rest
TRUE_PEAK_DB = -2.0
# what this bed measures when its peak is parked at -6 dBFS, across every seed
# and both slots. Only used if ffmpeg cannot measure, so that a runner without
# the ebur128 filter still writes a reel at roughly the right level instead of
# a quiet one. Measured, not guessed: the spread over the eight cases is 2.2 LU.
NOMINAL_LUFS = -16.4

#  B1     C2     C#2    D2  -- a drone root, picked by the card's own seed so
#  the same card always sounds the same and the account keeps one voice
ROOTS = [61.74, 65.41, 69.30, 73.42]
BEAT_HZ = 4.5            # theta; slow enough that a speaker reads it as breath


# ---------------------------------------------------------------- primitives

def _smooth(u):
    u = np.clip(u, 0.0, 1.0)
    return u * u * (3.0 - 2.0 * u)


def _band(x, lo, hi, tilt=0.0):
    """shape noise into a band with soft shoulders, in the frequency domain"""
    n = len(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    lf = np.log2(np.maximum(f, 1e-6))
    g = 1.0 / (1.0 + np.exp(-(lf - np.log2(lo)) * 5.0))
    g *= 1.0 / (1.0 + np.exp((lf - np.log2(hi)) * 5.0))
    if tilt:
        g *= (np.maximum(f, 20.0) / lo) ** tilt
    return np.fft.irfft(np.fft.rfft(x) * g, n).astype(np.float32)


def _lfo(t, hz, phase, lo, hi):
    return lo + (hi - lo) * (0.5 + 0.5 * np.sin(2 * np.pi * hz * t + phase))


def _swell(t, at, rise, fall, peak=1.0):
    """a soft rise and a long tail -- an event, never a hit"""
    e = np.zeros_like(t)
    up = (t >= at) & (t < at + rise)
    e[up] = _smooth((t[up] - at) / rise)
    dn = (t >= at + rise) & (t < at + rise + fall)
    e[dn] = (1.0 - (t[dn] - at - rise) / fall) ** 2.2
    return e * peak


def _ramp(t, a, b):
    return _smooth((t - a) / max(1e-6, b - a))


# ---------------------------------------------------------------- the bed

def build(info, secs, seed, slot="morning", lines=3):
    """(left, right) float32 for one card, cut to that card's own timeline"""
    n = int(round(SR * secs))
    t = np.arange(n, dtype=np.float32) / SR
    rng = np.random.default_rng(int(seed) * 7919 + 13)

    tDate = float(info["tDate"])
    tBody = float(info["tBody"])
    tClose = float(info["tClose"])
    step = float(info["step"])
    hookEnd = float(info["hookEnd"])
    evening = slot != "morning"

    # ---- the arc the whole bed breathes on -------------------------------
    fade_in = _smooth(t / 0.60)
    fade_out = 1.0 - _smooth((t - (secs - 0.95)) / 0.95)
    master = fade_in * fade_out

    # the drone opens as the substance arrives and thins on the way home
    opened = _ramp(t, tBody - 0.5, tBody + 1.4) * (1.0 - 0.55 * _ramp(t, tClose, tClose + 1.6))
    lift = 0.55 + 0.20 * _ramp(t, tDate, tDate + 1.0) + 0.25 * opened

    # ---- the drone -------------------------------------------------------
    root = ROOTS[int(seed) % len(ROOTS)] * (0.9439 if evening else 1.0)
    # root, fifth, octave, twelfth, double octave, and one quiet partial above
    # weighted up the stack on purpose: a phone speaker rolls off hard below
    # about 400 Hz, so a drone written where a drone "should" sit is a drone
    # nobody hears. The body stays for headphones; the twelfth and above carry
    # it on a handset.
    parts = [(1.0, 0.30), (1.5, 0.20), (2.0, 0.34), (3.0, 0.30),
             (4.0, 0.26), (6.0, 0.16), (8.0, 0.09), (12.0, 0.04)]
    dl = np.zeros(n, dtype=np.float32)
    dr = np.zeros(n, dtype=np.float32)
    for k, (mult, amp) in enumerate(parts):
        f = root * mult
        # the upper partials only come up once the drone opens
        a = amp * (1.0 if mult <= 2.0 else (0.52 + 0.48 * opened))
        # each partial breathes on its own slow cycle, so the timbre never sits still
        a = a * _lfo(t, 0.031 + 0.017 * k, k * 1.7, 0.78, 1.0)
        if mult == 2.0:                      # the binaural pair
            dl += a * np.sin(2 * np.pi * (f - BEAT_HZ / 2) * t + 0.4)
            dr += a * np.sin(2 * np.pi * (f + BEAT_HZ / 2) * t + 0.4)
        else:
            w = a * np.sin(2 * np.pi * f * t + k * 0.9)
            dl += w
            dr += w
    drone = 0.175 * lift
    dl *= drone
    dr *= drone

    # ---- the air ---------------------------------------------------------
    shared = rng.standard_normal(n).astype(np.float32)
    low = _band(shared, 40.0, 190.0)                    # the room's body
    mid = _band(shared, 280.0, 1400.0)                  # wind
    midl = 0.86 * mid + 0.14 * _band(rng.standard_normal(n).astype(np.float32), 280.0, 1400.0)
    midr = 0.86 * mid + 0.14 * _band(rng.standard_normal(n).astype(np.float32), 280.0, 1400.0)
    hil = _band(rng.standard_normal(n).astype(np.float32), 3000.0, 9000.0)
    hir = _band(rng.standard_normal(n).astype(np.float32), 3000.0, 9000.0)
    for a in (low, midl, midr, hil, hir):
        a /= max(1e-9, float(np.abs(a).max()))

    # the air is a floor, not the bed. Kept low and steady so the drone is the
    # thing you hear and the swells below have room to actually be movements.
    g_low = 0.050 * _lfo(t, 0.023, 0.0, 0.70, 1.0) * (0.5 + 0.5 * lift)
    g_mid = _lfo(t, 0.037, 1.1, 0.022, 0.058) * (0.7 if evening else 1.0)
    g_hi = 0.020 * _lfo(t, 0.051, 2.3, 0.6, 1.0) * (1.35 if not evening else 1.0)

    # ---- the events, on the picture's own frames -------------------------
    # the opening bloom and its streak
    g_hi = g_hi + _swell(t, 0.02, 0.26, 1.00, 0.115)
    g_mid = g_mid + _swell(t, 0.02, 0.30, 1.10, 0.150)
    # the claim arriving out of blur
    g_mid = g_mid + 0.070 * _ramp(t, 0.18, hookEnd) * (1.0 - _ramp(t, hookEnd, hookEnd + 1.4))
    # the surprise turning gold
    g_hi = g_hi + _swell(t, hookEnd - 0.30, 0.10, 1.30, 0.105)
    # where and when
    g_low = g_low + _swell(t, tDate, 0.24, 1.70, 0.130)
    # the substance, one block at a time
    for i in range(max(1, int(lines))):
        at = tBody + i * step
        if at > secs - 0.4:
            break
        g_low = g_low + _swell(t, at, 0.30, 1.80, 0.105)
        g_mid = g_mid + _swell(t, at, 0.34, 1.60, 0.055)
    # the way home
    g_hi = g_hi + _swell(t, tClose, 0.50, 2.00, 0.080)

    left = dl + low * g_low + midl * g_mid + hil * g_hi
    right = dr + low * g_low + midr * g_mid + hir * g_hi
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
