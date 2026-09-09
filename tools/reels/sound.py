#!/usr/bin/env python3
"""NOOR reel · the sound. Two worlds, one master chain.

**One verse is the recitation and nothing else.** No bed, no drone, no note,
no drum: silence, the voice, silence. The voice is shaped rather than
accompanied -- a high pass at 80 Hz to take the room out, a gentle shelf on
the sibilance, a slow compressor holding a few decibels so the quiet phrases
still carry on a phone, and a short warm plate (pre-delay 30 ms, about 1.2 s
of decay) mixed at 15 per cent so it stands in a room instead of a booth.
Then the limiter and the loudness. Nothing is added to the Qur'an.

**Every other kind gets the bed**, and the bed is new. It has four parts:

  the sub      the root at 41 to 49 Hz with its second and third harmonic,
               gently saturated so a phone speaker, which cannot move air at
               45 Hz, still hears the weight through the harmonics the ear
               puts the fundamental back under. It ducks under every boom.
  the pad      warm, not glass: a stack of sine partials, each doubled and
               detuned a few cents so it drifts, the upper partials swelling
               in as the picture opens, which is a low pass opening without
               a filter's resonance. It is played into a convolution hall.
  the drum     muted, and cinematic rather than rhythmic: a felt mallet on a
               damped floor tom, a taiko with a cloth over the head, the kick
               of a half time blues. A boom at 54 Hz falling from twice that
               in forty milliseconds and damped to nothing inside 300; a
               muted tom at 104; a brush ghost of dark filtered noise. Half
               time, swung and sparse: the boom on one, the tom on the
               shuffled and of two or on three in alternating bars and out of
               every second bar altogether, two brush ghosts on the triplet
               offbeats. It arrives a bar at a time so the reel gains a
               dimension rather than starting with one, thins back to the
               boom under the last line, and ends on a single deep stroke,
               the only one given the big hall. A short dark room (half a
               second, nothing above 3 kHz) sits under all of it at a tenth.
  the air      filtered noise, very quiet, and a short riser before each
               moment the picture blooms.

The pitch set is still suspended (root, fourth, fifth, octave, ninth,
eleventh, twelfth: no third, so it never resolves major or minor) but the
voice playing it is warm now rather than floating.

Percussion: muted drums only, and never a kit. No backbeat, no cymbal, no
clap, no sample, no licence: every sound here is arithmetic. The point of the
rhythm is weight and space, not a drummer.
"""
import os, re, subprocess, wave
import numpy as np
try:
    import pedalboard as PB           # Spotify's audio engine: the mix's quality lives here
except Exception:                     # pragma: no cover
    PB = None
    if os.environ.get("NOOR_NO_PEDALBOARD") != "1":
        raise SystemExit("pedalboard is not installed: pip install -r requirements.txt "
                         "(or set NOOR_NO_PEDALBOARD=1 to render the bare mix on purpose)")

SR = 48000
TARGET_LUFS = -18.0      # the bed sits below a music mix; Meta lifts the rest
TRUE_PEAK_DB = -2.0
NOMINAL_LUFS = -16.0     # fallback if ffmpeg cannot measure; see bed()
VOICE_LUFS = -16.0       # One verse is speech led, and speech sits where speech sits

# E1 F1 F#1 G1: the sub's root, picked by the card's own seed, so one card
# always sounds the same and the account keeps one voice
ROOTS = [41.20, 43.65, 46.25, 49.00]

# suspended: root, 4th, 5th, 8ve, 9th, 11th, 12th. No third to resolve.
SUS = [0, 5, 7, 12, 14, 17, 19]
ROOM_SEED = 20240401     # one hall for the whole account
DEFAULT_BPM = 80.0


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


# ---------------------------------------------------------------- the rooms

def _ir(secs=3.4, seed=ROOM_SEED, pre=0.030):
    """one room, built from noise that dies band by band.

    High frequencies are absorbed faster than low ones by everything a room is
    made of, so a tail whose bands all decay together sounds like a machine.
    `pre` is the pre-delay: the gap before the first reflection, which is what
    keeps a reverb behind a sound rather than smeared over it.
    """
    n = int(SR * secs)
    rng = np.random.default_rng(seed)
    k = np.arange(n, dtype=np.float32) / SR
    out = np.zeros(n, dtype=np.float32)
    for lo, hi, tau, amp in ((70, 300, secs * 0.90, 0.85),
                             (300, 1200, secs * 0.62, 1.00),
                             (1200, 4000, secs * 0.36, 0.62),
                             (4000, 9000, secs * 0.18, 0.28)):
        b = _band(rng.standard_normal(n).astype(np.float32), lo, hi)
        out += amp * b * np.exp(-6.91 * k / tau)          # -60 dB at tau
    p = int(SR * pre)
    out = np.concatenate([np.zeros(p, np.float32), out])[:n]
    out /= max(1e-9, float(np.sqrt((out ** 2).sum())))     # unit energy
    return out


def _conv(x, ir):
    n = len(x)
    N = 1 << int(np.ceil(np.log2(n + len(ir) - 1)))
    y = np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[:n]
    return y.astype(np.float32)


# ---------------------------------------------------------------- the pad

def _pad(t, root, chord, open_env, rng):
    """warm, not glass.

    Each note is a stack of sine partials, doubled and detuned a few cents so
    the two copies drift against each other slowly; the upper partials are
    gated by `open_env`, so the timbre brightens as the picture opens. That is
    a low pass opening, without a filter's resonance and without a sweep
    anybody can point at.
    """
    out = np.zeros((2, len(t)), dtype=np.float32)
    for i, (deg, amp, at, rise) in enumerate(chord):
        f0 = root * (2.0 ** (deg / 12.0))
        env = amp * _ramp(t, at, at + rise)
        pan = 0.5 + 0.22 * (1 if i % 2 else -1)
        for k, (mult, pa, opens) in enumerate(((1.0, 1.00, 0.0), (2.0, 0.44, 0.0),
                                               (3.0, 0.20, 0.35), (4.0, 0.11, 0.6),
                                               (5.0, 0.055, 0.85), (6.0, 0.028, 1.0))):
            f = f0 * mult
            if f > 7000.0:
                break
            det = 1.0 + (0.0009 + 0.0004 * k) * (1 if k % 2 else -1)
            drift = 1.0 + 0.0006 * np.sin(2 * np.pi * (0.041 + 0.017 * k) * t + i * 1.7)
            w = (np.sin(2 * np.pi * f * t * drift + i + k)
                 + np.sin(2 * np.pi * f * det * t * drift + 0.6 + k * 1.3)) * 0.5
            a = pa * (1.0 if opens <= 0 else np.clip((open_env - opens) / max(1e-6, 1.0 - opens), 0, 1))
            out[0] += env * a * w * (1.0 - pan) * 2.0
            out[1] += env * a * w * pan * 2.0
    return out * 0.5


# ---------------------------------------------------------------- the drum

def _stroke(kind, sr=SR, rng=None):
    """one drum stroke, synthesised, and every one of them muted.

    This is not a kit and it is not a frame drum. It is the drum of a felt
    mallet on a damped floor tom, of a taiko with a cloth over the head, of
    the kick in a half time blues: a membrane struck and immediately stopped.
    The pitch falls from about twice the note in forty milliseconds, which is
    what a struck head does as it releases, and then the whole thing is
    damped: 250 to 400 ms for the low one, 150 to 250 for the tom, and that
    is all. The transient is dark on purpose, a band limited click between
    100 and 600 Hz rather than the crack of a skin, because the brightness of
    a drum is what makes it sound like a kit.

      boom   the weight, on the downbeat
      tom    the answer, higher and shorter, more damped still
      brush  a ghost: dark filtered noise, a brush laid on a damped head
      deep   the boom, lower and longer, struck once, at the end
    """
    rng = rng or np.random.default_rng(7)
    if kind == "boom":
        dur, fe, ratio, pdrop, body_d = 0.46, 54.0, 2.05, 0.042, 0.085
        click, click_d, drive = 0.20, 0.007, 1.9
    elif kind == "tom":
        dur, fe, ratio, pdrop, body_d = 0.28, 104.0, 2.00, 0.030, 0.048
        click, click_d, drive = 0.16, 0.006, 1.5
    elif kind == "deep":                     # the last stroke of the reel
        dur, fe, ratio, pdrop, body_d = 0.95, 46.0, 2.10, 0.050, 0.165
        click, click_d, drive = 0.14, 0.008, 2.1
    else:                                    # brush: no membrane at all
        n = int(sr * 0.13)
        u = np.arange(n, dtype=np.float32) / sr
        nz = _band(rng.standard_normal(n).astype(np.float32), 400.0, 2500.0)
        nz /= max(1e-9, float(np.abs(nz).max()))
        env = (1.0 - np.exp(-u / 0.005)) * np.exp(-u / 0.032)
        out = (nz * env).astype(np.float32)
        return out / max(1e-9, float(np.abs(out).max()))
    n = int(sr * dur)
    u = np.arange(n, dtype=np.float32) / sr
    f = fe + (fe * (ratio - 1.0)) * np.exp(-u / pdrop)
    ph = 2 * np.pi * np.cumsum(f) / sr
    # the head, and one damped overtone: heavy damping is the whole point, so
    # the overtone dies three times faster than the fundamental
    body = np.sin(ph) * np.exp(-u / body_d) + 0.14 * np.sin(2.4 * ph) * np.exp(-u / (body_d / 3.0))
    dark = _band(rng.standard_normal(n).astype(np.float32), 100.0, 600.0)
    dark /= max(1e-9, float(np.abs(dark).max()))
    out = body + click * dark * np.exp(-u / click_d)
    out = np.tanh(out * drive) / drive                     # felt, not a beater
    out[:16] *= np.linspace(0, 1, 16, dtype=np.float32)
    out[-int(sr * 0.02):] *= np.linspace(1, 0, int(sr * 0.02), dtype=np.float32)
    return (out / max(1e-9, float(np.abs(out).max()))).astype(np.float32)


def _drum_pattern(bpm, t_in, t_thin, t_out, rng):
    """(time, stroke, velocity) for the half time figure, humanised.

    Half time, swung, and sparse enough to be felt rather than counted. One
    bar of four beats at the reel's own tempo, positions in beats:

        beat      1 . . 2 . . 3 . . 4 . .
        boom      B
        tom                x  or     x        (alternating bars only)
        brush       g            .    g

    the boom on one; the muted tom on the shuffled and of two (two thirds of
    the way through beat two) in one bar and on three in the next, and left
    out of every second bar altogether, which is what makes it half time
    rather than a groove; and two brush ghosts on the swung triplet offbeats
    at a fifth of the tom's weight. Nothing else. No backbeat, because a
    backbeat is a kit.

    It arrives in three steps so the reel gains a dimension rather than
    starting with one: the first bar is the boom alone, the tom joins in the
    second, the ghosts in the third. Under the last line it thins back to the
    boom, and the reel ends on one deep stroke, the only one with the big
    hall behind it.
    """
    beat = 60.0 / bpm
    bar = 4.0 * beat
    SWING = 2.0 / 3.0                     # the triplet, which is the shuffle
    out = []
    b, i = t_in, 0
    while b < t_out - 1e-6:
        thin = b >= t_thin - 1e-6
        cell = [(0.0, "boom", 1.00)]
        if not thin and i >= 1 and i % 2 == 1:
            # the tom, on alternating bars, and never twice in the same place
            cell.append((1.0 + SWING, "tom", 0.62) if (i // 2) % 2 == 0
                        else (2.0, "tom", 0.58))
        if not thin and i >= 2:
            cell.append((0.0 + SWING, "brush", 0.26))
            cell.append((3.0 + SWING, "brush", 0.22))
        for pos, kind, vel in cell:
            at = b + pos * beat + float(rng.normal(0.0, 0.0055))
            if at >= t_out - 0.05:
                continue
            out.append((max(0.0, at), kind, min(1.15, vel * float(rng.uniform(0.88, 1.10)))))
        b += bar
        i += 1
    out.append((t_out, "deep", 1.0))      # the way home, one stroke
    return out


def _drum(t, strokes, rng, hall=None):
    """the strokes played into a buffer: the dry drums, the sidechain the sub
    asks of them, and the one stroke that is allowed the big hall.

    The room on the drums is small and dark, half a second and nothing above
    three kilohertz, mixed at a tenth: it is what makes a struck thing sound
    like it is standing somewhere rather than nowhere. The epic sense is not a
    wash of reverb over everything, which is what makes a mix sound cheap; it
    is one stroke, the last, sent into the same hall the pad is in.
    """
    n = len(t)
    hits = {k: _stroke(k, rng=rng) for k in ("boom", "tom", "brush", "deep")}
    dry = np.zeros(n, dtype=np.float32)
    duck = np.zeros(n, dtype=np.float32)
    epic = np.zeros(n, dtype=np.float32)
    for at, kind, vel in strokes:
        i = int(round(at * SR))
        if i < 0 or i >= n:
            continue
        s = hits[kind]
        j = min(n, i + len(s))
        dry[i:j] += s[:j - i] * vel
        if kind in ("boom", "deep"):                  # the sub steps aside
            u = (np.arange(n, dtype=np.float32) - i) / SR
            duck += np.maximum(0.0, np.exp(-np.maximum(u, 0.0) / 0.13) * (u >= 0)
                               - np.exp(-np.maximum(u, 0.0) / 0.004) * (u >= 0)) * vel
        if kind == "deep":
            epic[i:j] += s[:j - i] * vel
    return dry, np.clip(duck, 0.0, 1.0), epic


def _drum_room(seed=ROOM_SEED + 3):
    """a small dark room for the drums: half a second, nothing above 3 kHz"""
    ir = _ir(secs=0.5, seed=seed, pre=0.008)
    return _band(ir, 40.0, 3000.0)


def _wet(dry, wet, frac):
    """dry plus its reverb at `frac` of the dry's own level.

    An impulse built here carries unit energy, not unit gain, so how loud its
    convolution comes out depends on how long the tail is. Levelling the wet
    against the dry's own peak means a percentage in this file means the same
    thing whichever room it is talking about.
    """
    p = float(np.abs(wet).max())
    if p < 1e-9:
        return dry
    return dry + wet * (float(np.abs(dry).max()) / p) * frac


# ---------------------------------------------------------------- the weight

def _sub(t, root, swells, floor=0.55):
    """the weight under everything: the root with its second and third
    harmonic, so a phone that cannot play 45 Hz still hears it. `swells` are
    (time, amount)."""
    env = np.full_like(t, floor)
    for at, amt in swells:
        u = t - at
        ra = 0.32 if amt >= 0.8 else 0.09
        rise = _smooth(u / ra)
        fall = np.exp(-np.maximum(0.0, u - ra) / (2.8 if amt >= 0.8 else 1.5))
        env += amt * rise * fall * (u >= 0)
    env = np.minimum(env, 1.6)
    w = (np.sin(2 * np.pi * root * t) * 1.00
         + np.sin(2 * np.pi * root * 2.0 * t + 0.3) * 0.46
         + np.sin(2 * np.pi * root * 3.0 * t + 0.9) * 0.13)
    return (w * env).astype(np.float32)


def _riser(t, at, dur, rng):
    """a breath drawn in before a bloom: filtered noise rising in pitch and
    level through `dur` seconds, cut at `at`"""
    n = len(t)
    u = (t - (at - dur)) / max(1e-6, dur)
    live = (u >= 0) & (u < 1.0)
    if not live.any():
        return np.zeros_like(t)
    noise = rng.standard_normal(n).astype(np.float32)
    lo = _band(noise, 110.0, 800.0)
    hi = _band(noise, 800.0, 4200.0)
    for a in (lo, hi):
        a /= max(1e-9, float(np.abs(a).max()))
    uu = np.clip(u, 0, 1)
    env = (uu ** 2.4) * live
    out = lo * (1.0 - uu) * env + hi * uu * env
    tail = np.exp(-np.maximum(0.0, t - at) / 0.12) * (t >= at)
    return (out * (1.0 - (t >= at)) + out * tail).astype(np.float32)


# ---------------------------------------------------------------- the voice

def load_voice(path, sr=SR):
    """a recitation file -> mono float32 at the bed's rate, trimmed of the
    silence at both ends, and the seconds it lasts. ffmpeg decodes it, so
    whatever everyayah serves is fine."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le",
                          "-ac", "1", "-ar", str(sr), "-"],
                         capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).copy()
    if not len(x):
        raise SystemExit("could not decode " + path)
    x /= max(1e-9, float(np.abs(x).max()))
    # trim: where the voice actually begins and ends, at -42 dBFS over 20 ms
    win = int(sr * 0.02)
    e = np.sqrt(np.convolve(x * x, np.ones(win) / win, mode="same"))
    loud = np.where(e > 10.0 ** (-42.0 / 20.0))[0]
    if len(loud):
        a = max(0, loud[0] - int(sr * 0.08)); b = min(len(x), loud[-1] + int(sr * 0.35))
        x = x[a:b]
    f = np.fft.rfftfreq(len(x), 1.0 / sr)
    g = 1.0 / (1.0 + np.exp(-(np.log2(np.maximum(f, 1e-6)) - np.log2(80.0)) * 6.0))
    x = np.fft.irfft(np.fft.rfft(x) * g, len(x)).astype(np.float32)
    fade = int(sr * 0.03)
    x[:fade] *= np.linspace(0, 1, fade, dtype=np.float32)
    x[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
    x /= max(1e-9, float(np.abs(x).max()))
    return x, len(x) / float(sr)


def envelope(x, fps=30, sr=SR):
    """the voice's loudness at each frame, 0..1, smoothed the way an ear is:
    what the picture's glow breathes with"""
    hop = sr // fps
    n = int(np.ceil(len(x) / hop))
    env = np.zeros(n, dtype=np.float32)
    for i in range(n):
        seg = x[i * hop:(i + 1) * hop]
        env[i] = float(np.sqrt(np.mean(seg * seg))) if len(seg) else 0.0
    env = env / max(1e-9, float(env.max()))
    out = np.zeros_like(env); v = 0.0
    for i, e in enumerate(env):
        v = e if e > v else v + (e - v) * 0.18
        out[i] = v
    return out


def _pb(chain, x, sr=SR):
    """run a mono or stereo float32 array through a Pedalboard chain"""
    if PB is None or not chain:
        return x
    board = PB.Pedalboard(chain)
    if x.ndim == 1:
        return board(x[None, :].astype(np.float32), sr)[0]
    return board(x.astype(np.float32), sr)


def _voice_chain(v):
    """what a recitation gets, and nothing more.

    The room under 80 Hz taken out; the sibilance eased with a narrow cut
    where a microphone's ess lives, which is a de-esser that cannot pump; a
    slow compressor at about 3:1 taking a few decibels, so the quiet phrases
    carry on a phone without the loud ones being flattened; and the level
    put back. No colour of any kind is added.
    """
    if PB is None: return v
    return _pb([PB.HighpassFilter(cutoff_frequency_hz=80.0),
                PB.PeakFilter(cutoff_frequency_hz=6600.0, gain_db=-3.5, q=1.4),
                PB.Compressor(threshold_db=-10.0, ratio=3.0, attack_ms=20.0, release_ms=200.0),
                PB.Gain(gain_db=3.0)], v).astype(np.float32)


def _voice_plate(v):
    """a short warm plate: 30 ms of pre-delay, about 1.2 s of decay, mixed at
    15 per cent. Enough to put the voice in a room; not enough to be heard as
    an effect on it."""
    ir = _ir(secs=1.25, seed=ROOM_SEED + 7, pre=0.030)
    wet_l = _conv(v, ir)
    wet_r = _conv(v, _ir(secs=1.25, seed=ROOM_SEED + 8, pre=0.036))
    g = 2.6 / max(1e-9, float(np.abs(wet_l).max()) / max(1e-9, float(np.abs(v).max())))
    mix = 0.15
    return (v * (1.0 - mix) + wet_l * g * mix,
            v * (1.0 - mix) + wet_r * g * mix)


def _saturate_sub(sub):
    """the weight, given harmonics: a phone speaker cannot play 45 Hz, but it
    can play the second and third harmonic of a gently driven sine, and the
    ear puts the fundamental back. Tape does this; so does this."""
    if PB is None: return sub
    peak = max(1e-9, float(np.abs(sub).max()))
    y = _pb([PB.Distortion(drive_db=8.0), PB.LowpassFilter(cutoff_frequency_hz=220.0)],
            sub / peak * 0.5)
    return (y / max(1e-9, float(np.abs(y).max())) * peak).astype(np.float32)


# ---------------------------------------------------------------- the score

def _moments(info, secs, kind):
    """the times the bed is placed on, from the timeline the words are built
    on. The type layer reports its own scene, so nothing here guesses."""
    sc = info.get("scene") or {}
    grid = info.get("grid") or {}
    bpm = float(grid.get("bpm") or 0) or DEFAULT_BPM
    hits = [float(x) for x in (sc.get("hits") or [])]
    blooms = [float(x) for x in (sc.get("blooms") or [])]
    tClose = float(info.get("tClose") or (secs - 3.0))
    tBody = float(info.get("tBody") or (secs * 0.35))
    hookEnd = float(info.get("hookEnd") or 1.6)
    if not hits: hits = [0.0, hookEnd, tBody, tClose]
    if not blooms: blooms = [0.0, hookEnd, tClose]
    return bpm, sorted(hits), sorted(blooms), tBody, hookEnd, tClose


# ---------------------------------------------------------------- the bed

def build(info, secs, seed, slot="morning", lines=3, kind="light", voice=None):
    """(left, right) float32 for one card, cut to that card's own timeline.

    One verse takes the first branch and is the recitation alone. Everything
    else is the bed: sub, pad, drum, air.
    """
    n = int(round(SR * secs))
    t = np.arange(n, dtype=np.float32) / SR

    # ---- One verse: the voice, and silence around it ---------------------
    if kind == "verse" and voice is None:
        raise SystemExit("a verse reel is its recitation: none was given to sound.bed")
    if voice is not None:
        vx, v0 = voice
        i0 = int(round(v0 * SR)); i1 = min(n, i0 + len(vx))
        v = np.zeros(n, dtype=np.float32); v[i0:i1] = vx[:i1 - i0]
        v = _voice_chain(v)
        left, right = _voice_plate(v)
        # a short fade at each end of the file: silence, then the voice
        fi = _smooth(t / 0.25)
        fo = 1.0 - _smooth((t - (secs - 0.5)) / 0.5)
        return left * fi * fo, right * fi * fo

    rng = np.random.default_rng(int(seed) * 7919 + 13)
    bpm, hits, blooms, tBody, hookEnd, tClose = _moments(info, secs, kind)
    beat = 60.0 / bpm
    evening = slot != "morning"
    root = ROOTS[int(seed) % len(ROOTS)] * (0.9439 if evening else 1.0)

    fade_in = _smooth(t / 0.6)
    fade_out = 1.0 - _smooth((t - (secs - 1.3)) / 1.3)
    master = fade_in * fade_out
    # how open the picture is: the pad brightens with it
    open_env = _ramp(t, 0.2, tBody + 1.0) * (1.0 - 0.45 * _ramp(t, tClose, tClose + 1.4))

    # ---- the pad: root, fifth, octave, ninth, arriving as the reel does ---
    chord = [(SUS[0], 0.34, 0.05, 2.0), (SUS[2], 0.24, 0.05, 2.6),
             (SUS[3], 0.20, max(0.1, hookEnd - 0.5), 2.2),
             (SUS[4], 0.12, max(0.1, tBody - 0.4), 2.6)]
    pad = _pad(t, root * 4.0, chord, open_env, rng) * 0.15
    hall = _ir()
    hall2 = _ir(seed=ROOM_SEED + 1)
    wet_l = _conv(pad[0], hall)
    wet_r = _conv(pad[1], hall2)
    gw = 2.2
    pad_l = pad[0] * 0.72 + wet_l * gw
    pad_r = pad[1] * 0.72 + wet_r * gw

    # ---- the drum: in after the hook, thin under the last line, home on the
    # last beat. It is muted throughout: weight and space, not a drummer.
    t_in = min(secs - beat * 2, max(hookEnd + beat * 0.5, beat))
    t_in = round(t_in / (beat / 2.0)) * (beat / 2.0)
    t_thin = max(t_in + 8.0 * beat, tClose - 5.0 * beat)
    t_out = max(t_in + beat, min(tClose, secs - 1.0))
    strokes = _drum_pattern(bpm, t_in, t_thin, t_out, rng)
    drum, duck, epic = _drum(t, strokes, rng)
    drum *= 0.58
    epic *= 0.58
    # a small dark room on all of it, a tenth wet, and the big hall on the one
    # last stroke only: the epic sense comes from one hit, not from a wash
    room = _drum_room()
    room2 = _drum_room(ROOM_SEED + 4)
    drum_l = _wet(drum, _conv(drum, room), 0.11)
    drum_r = _wet(drum, _conv(drum, room2), 0.11)
    drum_l = drum_l + _wet(epic, _conv(epic, hall), 0.34) - epic
    drum_r = drum_r + _wet(epic, _conv(epic, hall2), 0.34) - epic

    # ---- the sub, ducking under every boom -------------------------------
    swells = [(h, 1.0 if any(abs(h - b) < 1e-3 for b in blooms) else 0.42) for h in hits]
    sub = _sub(t, root, swells, floor=0.46) * 0.15
    sub = _saturate_sub(sub) * (1.0 - 0.38 * duck)

    # ---- the air, and the breath before each bloom -----------------------
    shared = rng.standard_normal(n).astype(np.float32)
    low = _band(shared, 45.0, 190.0)
    hil = _band(rng.standard_normal(n).astype(np.float32), 2200.0, 7000.0)
    hir = _band(rng.standard_normal(n).astype(np.float32), 2200.0, 7000.0)
    for a in (low, hil, hir):
        a /= max(1e-9, float(np.abs(a).max()))
    g_low = 0.024 * _lfo(t, 0.023, 0.0, 0.70, 1.0)
    g_hi = 0.009 * _lfo(t, 0.047, 2.3, 0.6, 1.0)
    air_l = low * g_low + hil * g_hi
    air_r = low * g_low + hir * g_hi

    rise = np.zeros(n, dtype=np.float32)
    prev = 0.0
    for i, at in enumerate([b for b in blooms if b > 0.9]):
        dur = min(4.0 * beat, max(0.7, at - prev - 0.2))
        rise += _riser(t, at, dur, rng) * 0.055
        prev = at

    left = pad_l + drum_l + sub + air_l + rise
    right = pad_r + drum_r + sub + air_r + rise
    return left * master, right * master


# ---------------------------------------------------------------- the master

def _master(left, right, kind="light"):
    """the whole mix, glued: a shelf for the weight, a slow compressor that
    holds the swells together, and a gentle roll off at the top, because
    nothing above six kilohertz should be loud in this bed. The limiter comes
    last, after the loudness is set, so it only ever catches peaks."""
    if PB is None: return left, right
    st = np.stack([left, right])
    if kind == "verse":
        # the recitation is not glued to anything: it is levelled, and that is all
        y = _pb([PB.Compressor(threshold_db=-16.0, ratio=1.6, attack_ms=40.0, release_ms=300.0)], st)
        return y[0].astype(np.float32), y[1].astype(np.float32)
    y = _pb([PB.LowShelfFilter(cutoff_frequency_hz=110.0, gain_db=2.0),
             PB.Compressor(threshold_db=-14.0, ratio=1.7, attack_ms=28.0, release_ms=280.0),
             PB.HighShelfFilter(cutoff_frequency_hz=6500.0, gain_db=-1.5),
             PB.LowpassFilter(cutoff_frequency_hz=13500.0)], st)
    return y[0].astype(np.float32), y[1].astype(np.float32)


def _limit(left, right, ceiling_db=TRUE_PEAK_DB):
    """a soft ceiling: below half of it nothing is touched, above it the curve
    bends so no sample crosses. Written by hand because a library limiter adds
    make up gain, and the loudness was set already."""
    c = 10.0 ** (ceiling_db / 20.0)
    knee = c * 0.5
    def bend(x):
        a = np.abs(x)
        over = a > knee
        y = a.copy()
        y[over] = knee + (c - knee) * np.tanh((a[over] - knee) / (c - knee))
        return (np.sign(x) * y).astype(np.float32)
    return bend(left), bend(right)


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


def target_for(kind):
    return VOICE_LUFS if kind == "verse" else TARGET_LUFS


def bed(path, info, secs, seed, slot="morning", lines=3, target=None, kind="light", voice=None):
    """write one card's sound, trimmed to an exact loudness, and return its path"""
    if target is None: target = target_for(kind)
    left, right = build(info, secs, seed, slot, lines, kind=kind, voice=voice)
    left, right = _master(left, right, kind=kind)
    peak = max(1e-9, float(max(np.abs(left).max(), np.abs(right).max())))
    head = 10.0 ** (-6.0 / 20.0) / peak
    _write(path, left, right, head)
    got = _lufs(path)
    if got is None:
        got = NOMINAL_LUFS
    gain = head * 10.0 ** ((target - got) / 20.0)
    gain = min(gain, 10.0 ** ((TRUE_PEAK_DB + 5.0) / 20.0) / peak)
    l2, r2 = _limit(left * gain, right * gain)
    _write(path, l2, r2, 1.0)
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


# ---------------------------------------------------------------- the bench

if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "out_v3/bed-test.wav"
    secs = float(sys.argv[2]) if len(sys.argv) > 2 else 20.0
    kind = sys.argv[3] if len(sys.argv) > 3 else "light"
    bpm = float(sys.argv[4]) if len(sys.argv) > 4 else 80.0
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    info = {"tBody": secs * 0.36, "tDate": secs * 0.22, "tClose": secs - 3.0,
            "hookEnd": 2.2, "step": 3.4, "grid": {"bpm": bpm, "beat": 60.0 / bpm},
            "scene": {"hits": [0.0, 2.2, secs * 0.36, secs * 0.55, secs * 0.74, secs - 3.0],
                      "blooms": [0.0, 2.2, secs - 3.0]}}
    bed(out, info, secs, seed=7, slot="morning", lines=3, kind=kind)
    print(out, "  %.1f LUFS  peak %.1f dBFS" % measure(out))
