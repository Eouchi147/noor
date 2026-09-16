#!/usr/bin/env python3
"""NOOR - the score for a silent short.

    python3 shortscore.py short-isnad              write the wav
    python3 shortscore.py short-isnad --mux        and lay it under the mp4

WHY THIS IS NOT score.py

score.py writes music to go UNDER A VOICE. It sits at -26 LUFS, it rations
the drum to eight strokes in seven minutes, and it deliberately never asks to
be listened to, because anything that asks will fight the narration.

A silent short has no narration, so every one of those decisions inverts. The
sound is not accompanying an argument, it IS the second half of the argument,
and the half that tells you where to look. It can be loud, it can be musical,
and it must be exact.

THE WHOLE POINT: IT IS CUT FROM THE FILM FILE, NOT GUESSED AT.

Every timing in here is read out of films/<slug>.json, which already knows the
frame each beat cuts on and the millisecond each callout arrives. Nothing is
tapped in by ear and nothing drifts, because the score and the picture are
generated from the same numbers. Change a word in the brief, the hold changes,
and the note that marks it moves with it.

THE MODE

D natural minor, played on analogue synthesisers in a very large room.
and the F# is the interval that does the work here. It belongs to the world
the film is about rather than being borrowed as a costume, and it is what
makes a sustained tone read as ancient rather than as ambient wallpaper.

No third in the drone, ever, so nothing resolves major or minor and nothing
sounds like a film cue. The Hijaz colour arrives only at the turn.

WHAT MARKS WHAT

  every cut          a struck tone, soft, low in the mode
  every callout      a struck tone, brighter, walking up the mode as the
                     argument builds. This is the one the eye is following.
  the turn           the harmony changes and the frame drum enters
  the close          the drum leaves, the drone opens to the octave
"""
import argparse, hashlib, json, os, re, subprocess, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")

#  ONE FILE, NUMPY, AND FFMPEG. NOTHING ELSE.
#  The first version imported the reels' sound engine from ../reels, which is
#  where it lives in the repo and is NOT where it lives on the machine this
#  actually renders on: the render folder there is flat, there is no ../reels
#  beside it, and the import would have failed the moment it was run. The six
#  helpers it needed are short, so they are here instead of being a second
#  folder to keep in sync. Same numbers, same hall.
SR = 48000
TRUE_PEAK_DB = -2.0
ROOM_SEED = 20240401


def _band(x, lo, hi):
    """shape into a band with soft shoulders, in the frequency domain"""
    n = len(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    lf = np.log2(np.maximum(f, 1e-6))
    g = 1.0 / (1.0 + np.exp(-(lf - np.log2(lo)) * 5.0))
    g *= 1.0 / (1.0 + np.exp((lf - np.log2(hi)) * 5.0))
    return np.fft.irfft(np.fft.rfft(x) * g, n).astype(np.float32)


def _ir(secs=3.4, seed=ROOM_SEED, pre=0.030):
    """one room, built from noise that dies band by band. High frequencies are
    absorbed faster than low ones by everything a room is made of, so a tail
    whose bands decay together sounds like a machine. `pre` is the gap before
    the first reflection, which is what keeps a reverb behind a sound rather
    than smeared over it."""
    n = int(SR * secs)
    rng = np.random.default_rng(seed)
    k = np.arange(n, dtype=np.float32) / SR
    out = np.zeros(n, dtype=np.float32)
    for lo, hi, tau, amp in ((70, 300, secs * 0.90, 0.85),
                             (300, 1200, secs * 0.62, 1.00),
                             (1200, 4000, secs * 0.36, 0.62),
                             (4000, 9000, secs * 0.18, 0.28)):
        b = _band(rng.standard_normal(n).astype(np.float32), lo, hi)
        out += amp * b * np.exp(-6.91 * k / tau)
    p = int(SR * pre)
    out = np.concatenate([np.zeros(p, np.float32), out])[:n]
    out /= max(1e-9, float(np.sqrt((out ** 2).sum())))
    return out


def _conv(x, ir):
    n = len(x)
    N = 1 << int(np.ceil(np.log2(n + len(ir) - 1)))
    y = np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[:n]
    return y.astype(np.float32)


def _limit(left, right, ceiling_db=TRUE_PEAK_DB):
    """a soft ceiling: below half of it nothing is touched, above it the curve
    bends so no sample crosses. By hand, because a library limiter adds make
    up gain and the loudness was set already."""
    c = 10.0 ** (ceiling_db / 20.0)
    knee = c * 0.5
    def bend(x):
        a = np.abs(x)
        over = a > knee
        y = a.copy()
        y[over] = knee + (c - knee) * np.tanh((a[over] - knee) / (c - knee))
        return (np.sign(x) * y).astype(np.float32)
    return bend(left), bend(right)


def _write(path, left, right, gain=1.0):
    a = np.stack([left * gain, right * gain], axis=1)
    a = np.clip(a, -1.0, 1.0)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((a * 32767.0).astype("<i2").tobytes())
    return path


def _lufs(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path,
                          "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    m = re.findall(r"I:\s*(-?\d+(?:\.\d+)?)\s*LUFS", out)
    return float(m[-1]) if m else None

#  Hijaz on D, in hertz. Written out rather than computed from a formula
#  because the augmented second is the point and it should be readable.
D1, D2 = 36.708, 73.416
HIJAZ = {"D": 146.832, "Eb": 155.563, "F#": 184.997, "G": 195.998,
         "A": 220.000, "Bb": 233.082, "C": 261.626, "D+": 293.665,
         "Eb+": 311.127, "F#+": 369.994, "A+": 440.000}


def film_events(slug):
    """Everything the score is allowed to know, straight out of the picture."""
    d = json.load(open(os.path.join(HERE, "films", slug + ".json"), encoding="utf-8"))
    ch = d["chapters"][0]
    beats = ch["beats"]
    cuts, t, heads = [], 0.0, []
    for b in beats:
        spoken = bool(b.get("text") or b.get("eyebrow"))
        cuts.append({"at": t, "hold": b["hold"], "head": spoken})
        if spoken:
            heads.append(t)
        t += b["hold"]
    #  the last beat fades out over a second, and the film is that much longer
    #  than the sum of the holds. Same number stage.js uses.
    total = t + 1.0
    lume = beats[0].get("lume", {})
    calls = [{"at": c["atMs"] / 1000.0, "hold": c["holdMs"] / 1000.0,
              "text": c.get("text", "")} for c in lume.get("calls", [])]
    key = (lume["keyAtMs"] / 1000.0) if "keyAtMs" in lume else None
    return {"total": total, "cuts": cuts, "calls": calls, "heads": heads,
            "key": key, "title": d.get("title", slug)}


# ------------------------------------------------------------------ voices
#
#  THE ROOM THIS IS PLAYED IN.
#
#  Everything below is one family of sounds: big analogue synthesisers in a
#  very large empty space. It is the Vangelis line that the space games all
#  descend from, and the reason it works for a film about something old being
#  carefully preserved is that the idiom is built out of PATIENCE. A pad that
#  takes four seconds to open, a sequence that repeats without ever arriving,
#  a delay long enough that you hear the room answer back.
#
#  Four things make a synthesiser sound analogue rather than computed, and all
#  four are here because leaving any one out is what makes a pad sound like a
#  plugin preset:
#
#    THE OSCILLATORS DRIFT.   A voltage controlled oscillator never holds its
#      pitch exactly. Every voice here walks a fraction of a per cent around
#      its note on its own slow random path, which is why two of them beat
#      against each other in a way that never repeats.
#
#    THE FILTER MOVES.        A static lowpass is a tone control. A filter
#      that opens when something happens and closes as it passes is the single
#      most characteristic gesture in the whole idiom, and here it is driven
#      by the picture: every cut and every callout opens it.
#
#    NOTHING IS ONE OSCILLATOR.  Every note is three, detuned against each
#      other by a few cents, which is what gives the width.
#
#    THE DELAY IS PART OF THE INSTRUMENT.  Not an effect on the end. A dotted
#      eighth feeding back at just under half is what turns a sparse line into
#      a texture, and it is why one note can fill four seconds.


def drift(n, cents=9.0, hz=0.09, seed=0):
    """A voltage controlled oscillator wandering. Smooth noise, not white:
    the pitch of a real oscillator moves slowly with temperature and supply,
    it does not jitter. Returned as a multiplier around 1.0."""
    rng = np.random.default_rng(seed)
    m = max(8, int(n / SR * hz * 24))
    coarse = rng.standard_normal(m)
    fine = np.interp(np.linspace(0, m - 1, n), np.arange(m), coarse)
    fine = np.convolve(fine, np.ones(2048) / 2048, "same")
    fine /= max(1e-9, np.abs(fine).max())
    return 1.0 + fine * (2.0 ** (cents / 1200.0) - 1.0)


def saw_add(t, f, nharm, tilt, seed=0, det=(-7.0, 0.0, 8.0)):
    """A band limited sawtooth, built by adding harmonics rather than by
    wrapping a ramp, because a wrapped ramp aliases and an aliased saw is the
    one sound that instantly says computer.

    `tilt` is an array the same length as t giving, per sample, how bright the
    tone is: 0 leaves the fundamental alone, 1 lets every harmonic through. It
    is the lowpass, done additively, which costs nothing and lets the cutoff
    move per sample without a filter running sample by sample in python.
    """
    rng = np.random.default_rng(seed)
    y = np.zeros(len(t), dtype=np.float64)
    for c in det:
        fd = f * (2.0 ** (c / 1200.0)) * drift(len(t), 7.0, 0.07, seed + int(c) + 97)
        ph = 2 * np.pi * np.cumsum(fd) / SR + rng.random() * 6.283
        for h in range(1, nharm + 1):
            if f * h > 16000:
                break
            #  each harmonic fades in as the filter opens, the high ones last
            g = np.clip(tilt * nharm - (h - 1), 0.0, 1.0)
            y += (1.0 / h) * g * np.sin(h * ph)
    return y / len(det)


def bell(n, f, at, amp, decay, tilt=0.55, seed=0):
    """THE MARKER, AND IT IS NOT A HIT.

    A note has to land on an exact frame to mark a cut, and the obvious way to
    make something land is to give it a hard attack. That is a percussion
    instrument, and there is none in this piece. So the attack is 26 ms, which
    is slow enough that nothing reads as struck and fast enough that the ear
    still places it on the frame: the threshold for hearing two events as
    simultaneous is around 30 ms, so a note that takes 26 to arrive is still
    ON the cut, it just is not hitting it.

    Partials are a soft bell, not a metal one: the inharmonicity is slight and
    the high ones die first, so what is left after half a second is a warm
    sine sitting in the reverb.
    """
    rng = np.random.default_rng(seed)
    i0 = int(at * SR)
    ln = int(min(decay * 3.2, 7.0) * SR)
    if i0 >= n or ln <= 0:
        return np.zeros(n, np.float32)
    k = np.arange(ln, dtype=np.float64) / SR
    y = np.zeros(ln, dtype=np.float64)
    for r, lv, fast in ((1.000, 1.00, 1.00), (2.004, 0.34, 1.6),
                        (3.010, 0.17, 2.3), (4.021, 0.085, 3.4),
                        (5.980, 0.040, 4.8)):
        det = 1.0 + (rng.random() - 0.5) * 0.0026
        y += lv * (0.35 + tilt) * np.exp(-6.91 * k / max(0.05, decay / fast)) * \
             np.sin(2 * np.pi * f * r * det * k + rng.random() * 6.283)
    a = int(0.026 * SR)
    a = min(a, ln)
    y[:a] *= np.sin(np.linspace(0.0, np.pi / 2, a)) ** 2
    out = np.zeros(n, np.float32)
    m = min(n - i0, ln)
    out[i0:i0 + m] = (y[:m] * amp).astype(np.float32)
    return out


def breath_note(n, f, at, amp, dur, seed=0):
    """A SIGNAL, NOT A NOTE. One voice of the chord leaning forward.

    No attack to speak of: 180 ms in, which is far past anything the ear
    hears as struck, and a long fall. Only the fundamental and a quiet
    octave, so it has no timbre of its own to notice; it is the same colour
    as the pad and simply gets closer for a moment.

    The pitch is handed in from the chord that is already sounding, which is
    the point of the whole thing. A new pitch is an event. A pitch that is
    already there, coming forward, is a change in the room, and a viewer
    registers it without being able to say what happened. That is what a
    signal is supposed to feel like.
    """
    rng = np.random.default_rng(seed)
    i0 = int(at * SR)
    ln = int(min(dur, 7.0) * SR)
    if i0 >= n or ln <= 0:
        return np.zeros(n, np.float32)
    k = np.arange(ln, dtype=np.float64) / SR
    #  in over 180 ms on a raised cosine, out over the rest on a slow curve
    a = min(int(0.18 * SR), ln)
    env = np.exp(-3.4 * k / dur)
    env[:a] *= (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, a)))
    d = drift(ln, 5.0, 0.08, seed + 7)
    ph = 2 * np.pi * np.cumsum(f * d) / SR + rng.random() * 6.283
    y = np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)
    out = np.zeros(n, np.float32)
    m = min(n - i0, ln)
    out[i0:i0 + m] = (y[:m] * env[:m] * amp).astype(np.float32)
    return out


def strings(t, freqs, env, seed=61):
    """THE ORCHESTRA, such as it is.

    A section is not one player louder, it is many players who do not agree.
    Six voices per note, each detuned a few cents from the others and each
    with its own vibrato rate and its own slow drift, is what turns a synth
    tone into an ensemble: the disagreement is the sound. Bowed spectrum, so
    the harmonics fall away more gently than a saw and there is a breath of
    bow noise across the top.

    Slow in and slow out. Nothing here is ever attacked.
    """
    rng = np.random.default_rng(seed)
    y = np.zeros(len(t), dtype=np.float64)
    for j, f in enumerate(freqs):
        lv = 0.30 / (1.0 + 0.38 * j)
        for v, c in enumerate((-11.0, -6.0, -2.0, 3.0, 7.0, 12.0)):
            vr = 4.3 + 0.7 * ((v * 7 + j * 3) % 5) * 0.5
            vib = 1.0 + 0.0019 * np.sin(2 * np.pi * vr * t + v * 1.7 + j)
            d = drift(len(t), 6.0, 0.06, seed + v * 13 + j * 29)
            ph = 2 * np.pi * np.cumsum(f * (2.0 ** (c / 1200.0)) * vib * d) / SR \
                 + rng.random() * 6.283
            for h, hl in ((1, 1.00), (2, 0.44), (3, 0.26), (4, 0.13),
                          (5, 0.075), (6, 0.040), (8, 0.018)):
                if f * h > 13000:
                    break
                y += lv * hl * np.sin(h * ph) / 6.0
    #  the bow: a whisper of band limited noise that follows the level
    nz = _band(rng.standard_normal(len(t)).astype(np.float32), 1400, 6200)
    y += nz * 0.010
    y = _band(y.astype(np.float32), 80, 7000)
    return (y * env).astype(np.float32)


def pluck(n, f, at, amp, decay, tilt=0.55, seed=0):
    """The marker. A short filtered synth pluck rather than a bell: two
    detuned saws through a filter that shuts as the note decays, which is a
    lowpass envelope on a subtractive voice and the sound the whole idiom
    marks things with."""
    rng = np.random.default_rng(seed)
    i0 = int(at * SR)
    ln = int(min(decay * 3.0, 6.0) * SR)
    if i0 >= n or ln <= 0:
        return np.zeros(n, np.float32)
    k = np.arange(ln, dtype=np.float64) / SR
    env = np.exp(-6.91 * k / decay)
    #  the filter shuts faster than the amplitude, so the note darkens as it
    #  falls away instead of just getting quieter
    tl = tilt * np.exp(-6.91 * k / (decay * 0.42)) + 0.04
    y = np.zeros(ln, dtype=np.float64)
    for c, lv in ((-6.0, 0.5), (0.0, 0.6), (7.0, 0.5)):
        ph = 2 * np.pi * f * (2.0 ** (c / 1200.0)) * k + rng.random() * 6.283
        for h in range(1, 13):
            if f * h > 15000:
                break
            g = np.clip(tl * 12.0 - (h - 1), 0.0, 1.0)
            y += lv * (1.0 / h) * g * np.sin(h * ph)
    y *= env
    #  14 ms, so the sequence has definition without any of its notes
    #  reading as a hit. There is no percussion in this piece.
    a = min(int(0.014 * SR), ln)
    y[:a] *= np.sin(np.linspace(0.0, np.pi / 2, a)) ** 2
    out = np.zeros(n, np.float32)
    m = min(n - i0, ln)
    out[i0:i0 + m] = (y[:m] * amp).astype(np.float32)
    return out


def sub(t, f, env, seed=3):
    """The floor. A sine, an octave up at a fifth of the level, and enough
    soft saturation to put a second harmonic on it so it survives a phone
    speaker that cannot reproduce the fundamental at all."""
    d = drift(len(t), 4.0, 0.05, seed)
    ph = 2 * np.pi * np.cumsum(f * d) / SR
    y = np.sin(ph) + 0.20 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    y = np.tanh(y * 1.25) * 0.72
    return (y * env).astype(np.float32)


def arp(n, tempo_s, chords, gate, seed=13):
    """THE SEQUENCE, which is the thing that makes this idiom what it is.

    Sixteenth notes climbing and falling through whatever chord is current,
    across two and a half octaves, forever. On its own it is wallpaper. What
    makes it music is `gate`: a per sample curve, driven by the picture, that
    says how far open the filter is. Every cut and every callout pushes it
    open and it shuts over the next second and a half, so the sequence surges
    exactly when the frame changes and recedes while the viewer reads.

    That is the whole trick of the format in one line. The sequence is the
    ambience AND the punctuation, and it is the same object.
    """
    rng = np.random.default_rng(seed)
    out = np.zeros(n, np.float64)
    step = tempo_s / 16.0
    #  up and down, skipping about, so it does not read as a scale exercise
    #  a shape that climbs the mode and falls back through it without ever
    #  running straight up it, so it reads as a line rather than as a scale
    ORDER = [0, 2, 4, 2, 5, 4, 6, 4, 3, 1, 2, 0, 4, 2, 5, 3]
    i, x = 0, 0.0
    while x < n / SR:
        ch = None
        for at, notes in chords:
            if x >= at:
                ch = notes
        if ch:
            j = ORDER[i % len(ORDER)]
            oct_ = [1.0, 2.0, 2.0, 4.0][(i // len(ORDER)) % 4]
            f = ch[j % len(ch)] * oct_
            if f < 2400:
                i0 = int(x * SR)
                g = float(gate[min(n - 1, i0)])
                #  a note the filter is shut on is not silent, it is dull and
                #  quiet, which is what a real filter does
                lv = 0.055 + 0.115 * g
                out += pluck(n, f, x, lv, 0.24 + 0.22 * g,
                             tilt=0.20 + 0.62 * g, seed=seed * 7 + i).astype(np.float64)
        x += step
        i += 1
    return out


def delay(x, time_s, fb=0.42, taps=7, wet=1.0):
    """A dotted eighth feeding back at just under half. Part of the
    instrument, not an effect on the end: it is what lets three notes fill
    thirty seconds without anything repeating exactly, because each repeat is
    darker than the one before it."""
    out = np.zeros_like(x)
    d = int(time_s * SR)
    g = 1.0
    cur = x.copy()
    for k in range(taps):
        g *= fb
        if g < 0.008 or d * (k + 1) >= len(x):
            break
        rep = np.zeros_like(x)
        rep[d * (k + 1):] = x[:len(x) - d * (k + 1)]
        #  each repeat loses its top, the way a tape delay does
        rep = _band(rep.astype(np.float32), 90, 5200 * (0.72 ** k))
        out += rep * g
    return (x + out * wet).astype(np.float32)


def lead(n, notes, seed=29):
    """The lonely line. Three or four notes in the whole piece, portamento
    between them, and the delay does the rest. A melody here would be a
    television theme; what the idiom wants is somebody a long way off playing
    almost nothing."""
    rng = np.random.default_rng(seed)
    out = np.zeros(n, np.float64)
    for at, f, dur, amp in notes:
        i0 = int(at * SR)
        ln = int(dur * SR)
        if i0 >= n or ln <= 0:
            continue
        ln = min(ln, n - i0)
        k = np.arange(ln, dtype=np.float64) / SR
        #  in slowly, out slowly. Nothing in this idiom is struck.
        env = np.minimum(1.0, k / 0.35) * np.minimum(1.0, (dur - k) / 0.9)
        env = np.clip(env, 0.0, 1.0) ** 1.3
        d = drift(ln, 11.0, 0.11, seed + i0)
        y = np.zeros(ln, dtype=np.float64)
        for c, lv in ((-9.0, 0.42), (0.0, 0.52), (10.0, 0.42)):
            ph = 2 * np.pi * np.cumsum(f * (2.0 ** (c / 1200.0)) * d) / SR
            y += lv * (np.sin(ph) + 0.34 * np.sin(2 * ph) + 0.14 * np.sin(3 * ph)
                       + 0.06 * np.sin(5 * ph))
        out[i0:i0 + ln] += y * env * amp
    return out


#  THERE IS NO PERCUSSION IN THIS PIECE, AND THAT IS THE POINT.
#  A frame drum lived here and it was good, and it was still wrong: the moment
#  anything keeps time, the viewer starts counting instead of reading, and a
#  silent short is a reading experience. What replaced it is the filter on the
#  sequence, which surges at every cut and recedes while the words are up. It
#  does the job a drum was doing, which is to say when, without ever telling
#  the viewer how fast to go.


def swell(t, at, dur, peak=1.0):
    """Air moving into a cut, stopping dead ON it, never through it."""
    rng = np.random.default_rng(int(at * 1000) & 0xFFFF)
    y = np.zeros(len(t), dtype=np.float32)
    i0, i1 = max(0, int((at - dur) * SR)), int(at * SR)
    if i1 <= i0:
        return y
    k = np.linspace(0.0, 1.0, i1 - i0, dtype=np.float32)
    nz = _band(rng.standard_normal(i1 - i0).astype(np.float32), 180, 3400)
    y[i0:i1] = nz * (k ** 2.8) * peak
    return y


# ------------------------------------------------------------------ the air
#
#  THE CAMERA MAKES A SOUND, AND THE ENGINE ALREADY KNOWS WHAT IT IS DOING.
#
#  A silent short has one continuous camera move: stage.js pushes in, orbits
#  about fourteen degrees and closes the lens by five, all on one smoothstep
#  across the whole film. That is a FORMULA, not a performance, so its speed
#  at any instant can be differentiated rather than guessed at, and the air
#  can be hung on the answer.
#
#  Which is the difference between a swish and a whoosh. A whoosh is dropped
#  on a cut because cuts feel like they want one. A swish that rides the
#  actual angular rate is quiet while the camera drifts and lifts exactly
#  where it is travelling fastest, which on a smoothstep is the middle of the
#  move. You do not hear it as an effect; you hear the room going past.

def camera_speed(n, total, near=8.0):
    """the short camera's own rate of change, sampled per audio frame.

    stage.js:  e = p*p*(3-2p)
               az = -0.130 + 0.245 e      the orbit, in radians
               d  = near * (1.34 - 0.18 e) the push, in world units
               fov = 38 - 5 e              the lens, in degrees

    What the ear registers as movement is angular: how fast the picture
    slides across the frame. That is the orbit rate plus the rate the lens is
    narrowing, and the dolly contributes as a fraction of the distance rather
    than in absolute units, because closing a metre matters more when you are
    close. All three are combined and normalised, so the curve is the shape
    of the move and the mix decides how loud it is.
    """
    p = np.linspace(0.0, 1.0, n)
    dp = 1.0 / max(1e-9, total)
    de = (6.0 * p * (1.0 - p)) * dp            # d/dt of the smoothstep
    d_az = 0.245 * de                          # rad per second
    d_fov = 5.0 * de * np.pi / 180.0           # rad per second
    d_dolly = (0.18 * de) / 1.34               # fraction of the distance, per second
    v = np.abs(d_az) + 0.55 * np.abs(d_fov) + 0.80 * np.abs(d_dolly)
    m = float(v.max()) or 1.0
    return (v / m).astype(np.float64)


def air_move(t, speed, seed=91):
    """the room going past: band limited noise whose LEVEL and whose COLOUR
    both follow the camera rate. Faster air is brighter air, which is the
    thing that makes it read as movement rather than as hiss."""
    rng = np.random.default_rng(seed)
    nz = rng.standard_normal(len(t)).astype(np.float32)
    lo = _band(nz, 120, 900)
    mid = _band(nz, 500, 2600)
    hi = _band(nz, 1800, 7000)
    s = speed.astype(np.float32)
    y = lo * (0.55 * s) + mid * (0.75 * s ** 1.6) + hi * (0.42 * s ** 2.6)
    #  a slow wander on top, so it breathes rather than tracking the curve
    #  so exactly that it sounds like an automation lane
    w = 0.82 + 0.18 * np.sin(2 * np.pi * 0.083 * t + 1.1)
    return (y * w).astype(np.float32)


def swish(n, at, dur, peak, up=True, seed=0):
    """one pass of air across a cut. Rises into the frame change and falls
    away after it, never the other way round, and filtered so the brightest
    part of it is the moment itself."""
    rng = np.random.default_rng(seed)
    i0 = int((at - dur * 0.62) * SR)
    i1 = int((at + dur * 0.38) * SR)
    i0 = max(0, i0); i1 = min(n, i1)
    if i1 <= i0:
        return np.zeros(n, np.float32)
    k = np.linspace(0.0, 1.0, i1 - i0)
    env = np.where(k < 0.62, (k / 0.62) ** 2.4, (1.0 - (k - 0.62) / 0.38) ** 1.5)
    nz = rng.standard_normal(i1 - i0).astype(np.float32)
    band = _band(nz, 300, 4200) if up else _band(nz, 200, 2200)
    out = np.zeros(n, np.float32)
    out[i0:i1] = band * env.astype(np.float32) * peak
    return out


# ------------------------------------------------------------------ the mode

#  MAQAM HIJAZ, AS INTERVALS RATHER THAN AS A TABLE OF FREQUENCIES.
#  1, b2, 3, 4, 5, b6, b7. The augmented second between the b2 and the 3 is
#  the whole character, and writing the mode as semitone steps rather than as
#  hard coded hertz is what lets every film sit on its own tonic while still
#  being unmistakably the same maqam.
HIJAZ_STEPS = [0, 1, 4, 5, 7, 8, 10]
#  Hijazkar is Hijaz on BOTH tetrachords, so the seventh is major and the top
#  of the scale has the same augmented second as the bottom. More intense,
#  and still Hijaz: it is the mode's own doubling, not a different mode.
HIJAZKAR_STEPS = [0, 1, 4, 5, 7, 8, 11]


def hz(root, step, octave=0):
    return root * (2.0 ** ((step + 12 * octave) / 12.0))


#  the tonics. A fifth of range, low enough that the sub still has somewhere
#  to go and high enough that the pad is not mud.
TONICS = [("C", 32.703), ("D", 36.708), ("Eb", 38.891), ("E", 41.203),
          ("F", 43.654), ("G", 48.999), ("A", 55.000), ("Bb", 58.270)]

#  how the pad is voiced. Which degrees of the mode, and in which octave.
#  Each is a different sonority out of the same seven notes, which is how two
#  films in the same maqam can still not sound like each other.
VOICINGS = [
    ("open fifth and the flat second", [(0, 1), (4, 1), (0, 2), (1, 2)]),
    ("the augmented second, stated",   [(0, 1), (2, 1), (4, 1), (5, 1)]),
    ("wide, no third",                 [(0, 1), (4, 1), (0, 2), (4, 2)]),
    ("the fourth on top",              [(0, 1), (4, 1), (3, 2), (5, 2)]),
    ("close, and unresolved",          [(0, 1), (1, 1), (4, 1), (6, 1)]),
]


def _hash(slug):
    return int(hashlib.blake2b(slug.encode("utf-8"), digest_size=8).hexdigest(), 16)


def identity(slug, family=None):
    """EVERY FILM GETS ITS OWN SOUND, AND GETS THE SAME ONE EVERY TIME.

    A hash of the slug picks the tonic, the voicing, which degree the lead
    enters on and how bright the pad sits, so a short is always the same
    piece of music and never the same piece as its neighbour. Nothing is
    random: change the slug and you change the score, change nothing and
    nothing changes, which is what makes a render reproducible.

    AND A HASH ALONE IS NOT ENOUGH, which is worth saying because the first
    version of this used one and looked fine. Eight tonics and five voicings
    is forty pairs, and fifteen films dropped into forty boxes collide about
    three times by simple arithmetic. Measured: nine distinct pairs out of
    fifteen, with two films landing on the same tonic AND the same voicing
    and differing only in which degree the lead came in on. That is not "a
    different score for each video", it is two films that sound like each
    other in a feed.

    So the hash states a PREFERENCE and the set resolves it. Every short in
    the briefs folder is walked in slug order; each takes the pair it asked
    for if it is still free, and the next free one if it is not. Deterministic
    for a given set, and stable for every film that sorts before the one you
    add.
    """
    fam = family if family is not None else _family()
    h = _hash(slug)
    ti, vi = fam.get(slug, (h % len(TONICS), (h >> 7) % len(VOICINGS)))
    kar = ((h >> 13) % 5) == 0        # one film in five takes the doubled form
    lead_deg = [0, 1, 2, 4][(h >> 17) % 4]
    seq_oct = [1, 1, 2][(h >> 21) % 3]
    bright = 0.82 + ((h >> 25) % 40) / 100.0
    return {"name": TONICS[ti][0], "root": TONICS[ti][1],
            "steps": HIJAZKAR_STEPS if kar else HIJAZ_STEPS,
            "kar": kar, "voicing": VOICINGS[vi], "lead_deg": lead_deg,
            "seq_oct": seq_oct, "bright": bright, "seed": (h >> 3) & 0xFFFF}


def _family(folder=None):
    """the whole set of shorts, each given a tonic and a voicing no other one
    has, resolved in slug order from what each would have chosen on its own"""
    folder = folder or os.path.join(HERE, "films")
    try:
        slugs = sorted(f[:-5] for f in os.listdir(folder)
                       if f.startswith("short-") and f.endswith(".json"))
    except OSError:
        return {}
    taken, out = set(), {}
    for sl in slugs:
        h = _hash(sl)
        want = (h % len(TONICS), (h >> 7) % len(VOICINGS))
        if want in taken:
            #  walk the space on a stride that shares no factor with it, so
            #  the search covers every pair before returning to any
            i = want[0] * len(VOICINGS) + want[1]
            for step in range(1, len(TONICS) * len(VOICINGS)):
                j = (i + step * 7) % (len(TONICS) * len(VOICINGS))
                cand = (j // len(VOICINGS), j % len(VOICINGS))
                if cand not in taken:
                    want = cand
                    break
        taken.add(want)
        out[sl] = want
    return out


# ------------------------------------------------------------------ arrange

def score(ev, slug="short", seed=7):
    ID = identity(slug)
    seed = (seed + ID["seed"]) & 0xFFFF
    root, steps = ID["root"], ID["steps"]
    total = ev["total"]
    n = int(total * SR) + SR // 2
    t = np.arange(n, dtype=np.float64) / SR

    turn = ev["heads"][1] if len(ev["heads"]) > 1 else total * 0.48
    close = ev["heads"][-1] if ev["heads"] else total * 0.87

    holds = sorted(c["hold"] for c in ev["cuts"])
    bar = holds[len(holds) // 2]
    dotted8 = bar / 4.0 * 0.75

    def ramp(a, b, v0, v1):
        e = np.full(n, v0, np.float64)
        i0, i1 = int(a * SR), int(b * SR)
        i1 = max(i1, i0 + 1)
        e[i1:] = v1
        e[i0:i1] = np.linspace(v0, v1, i1 - i0)
        return e

    #  ---- the gate: everything bright hangs on the picture ----
    gate = np.zeros(n, np.float64)
    def push(at, amp, fall):
        i0 = int(at * SR)
        if i0 >= n: return
        k = np.arange(n - i0, dtype=np.float64) / SR
        gate[i0:] = np.maximum(gate[i0:], amp * np.exp(-k / fall))
    for c in ev["cuts"]:
        push(c["at"], 0.92 if c["head"] else 0.46, 1.7 if c["head"] else 1.1)
    for c in ev["calls"]:
        push(c["at"], 0.80, 1.45)
    if ev["key"] is not None:
        push(ev["key"], 0.40, 1.0)

    #  ---- AND THE FIGURE'S OWN THREE MOMENTS ----
    #  The film file says when the words change. It does not say when the
    #  PICTURE does, because that lives inside the figure. But the warp does:
    #  stage.js maps the film onto the figure's clock from 0.16 to 0.70, and
    #  every figure in the set has the same three landmarks on that clock.
    #  Its fade in completes at 0.16, which the warp puts at 5.5% of the film;
    #  its motion reads as half done around 0.42; and it settles near 0.58,
    #  which the warp puts at about four fifths of the way in. Those are three
    #  real events in the picture and they were going unmarked.
    def film_t(u):
        if u <= 0.16: return total * (u / 0.16) * 0.055
        return total * (0.055 + (u - 0.16) / (0.70 - 0.16) * 0.945)
    APPEAR, MIDWAY, SETTLE = film_t(0.16), film_t(0.42), film_t(0.58)
    push(APPEAR, 0.34, 1.6)
    push(MIDWAY, 0.30, 1.8)
    push(SETTLE, 0.52, 2.4)
    gate = np.convolve(gate, np.ones(1200) / 1200, "same")

    #  ---- the sub ----
    sg = ramp(0.0, 2.6, 0.0, 0.55) * ramp(turn - 1.4, turn + 0.8, 1.0, 1.24) \
       * ramp(close - 1.0, close + 1.4, 1.0, 1.34) * ramp(total - 1.8, total, 1.0, 0.0)
    bass = sub(t, root, sg * 0.42, seed) + sub(t, root * 2, sg * 0.20, seed + 1)

    #  ---- the pad, in this film's own voicing ----
    vname, degs = ID["voicing"]
    chA = [hz(root, steps[d], o + 1) for d, o in degs]
    #  the turn lifts the voicing by a degree of the mode and opens it out
    chB = [hz(root, steps[(d + 2) % 7], o + 1 + (1 if d > 4 else 0)) for d, o in degs]
    #  the close is the tonic, the fifth and the mode's own third, wide
    chC = [hz(root, steps[0], 1), hz(root, steps[4], 1),
           hz(root, steps[0], 2), hz(root, steps[2], 2)]
    eA = ramp(1.0, 5.0, 0.0, 1.0) * ramp(turn - 1.4, turn + 1.0, 1.0, 0.0)
    eB = ramp(turn - 1.2, turn + 1.8, 0.0, 1.0) * ramp(close - 1.4, close + 0.9, 1.0, 0.0)
    eC = ramp(close - 1.2, close + 2.0, 0.0, 1.0) * ramp(total - 2.0, total, 1.0, 0.0)
    breath = np.clip(0.30 * ID["bright"] + 0.16 * np.sin(2 * np.pi * 0.055 * t)
                     + 0.34 * gate, 0.05, 1.0)
    pad = np.zeros(n, np.float64)
    for ch, e, sd in ((chA, eA, 0), (chB, eB, 40), (chC, eC, 80)):
        if float(e.max()) < 0.01: continue
        for j, f in enumerate(ch):
            pad += saw_add(t, f, 10, breath, seed + sd + j) * e * (0.088 / (1 + 0.35 * j))

    #  ---- the sequence, walking the whole mode ----
    scale = [hz(root, st, ID["seq_oct"]) for st in steps]
    seq = arp(n, bar, [(0.0, scale)], gate, seed + 5)
    seq = delay(seq.astype(np.float32), dotted8, fb=0.44, taps=7, wet=0.62)

    #  ---- the markers ----
    #  ---- A SIGNAL IS NOT AN ANNOUNCEMENT --------------------------------
    #  The first cut of this rang a bell on every cut, every callout and the
    #  key: sixteen struck notes in forty seconds, each one a clear musical
    #  event. Played back it is a xylophone following a slideshow. The owner's
    #  word for it was annoying, and he was right about why: it was making a
    #  sound for the sake of it rather than telling you anything.
    #
    #  What a viewer actually needs from the sound is one thing: to know,
    #  without looking away, that SOMETHING NEW IS ON SCREEN. That is a
    #  signal, and a signal wants to be at the edge of hearing. So:
    #
    #    the pitch drops out of the chord.  Every mark is now a note the pad
    #      is ALREADY HOLDING, so it does not arrive as a new harmony, it
    #      arrives as one voice of the existing one leaning forward. You
    #      register it and you cannot quite say what changed.
    #
    #    it is a third of the level.  0.150 was a foreground event. 0.048 is
    #      under the pad, which is where a signal belongs.
    #
    #    it is slower.  A 26 ms attack still reads as struck. 180 ms does not
    #      read as anything except the room brightening.
    #
    #    the cuts lose theirs entirely.  A cut is already the loudest visual
    #      event there is; marking it as well is saying the same thing twice.
    #      Only the two headline cuts keep a note, and only because they are
    #      the two structural turns of the whole piece.
    CHORD = [chA, chB, chC]
    def in_chord(at):
        ch = chA if at < turn else (chB if at < close else chC)
        return ch
    marks = np.zeros(n, np.float32)
    for i, c in enumerate(ev["calls"]):
        ch = in_chord(c["at"])
        f = ch[(i + 1) % len(ch)]
        marks += breath_note(n, f, c["at"], 0.048, 3.4, seed=seed * 31 + i)
        marks += breath_note(n, f * 0.5, c["at"], 0.026, 4.2, seed=seed * 37 + i)
    for i, c in enumerate(ev["cuts"]):
        if not c["head"]:
            continue
        ch = in_chord(c["at"])
        marks += breath_note(n, ch[0] * 0.5, c["at"], 0.062, 5.0, seed=seed * 53 + i)
    if ev["key"] is not None:
        ch = in_chord(ev["key"])
        marks += breath_note(n, ch[-1], ev["key"], 0.030, 3.0, seed=seed * 71)
    #  AND THE PICTURE'S OWN THREE. Quieter than a callout, because they are
    #  not being read, and low, so they are felt under the words rather than
    #  competing with them.
    marks += breath_note(n, chA[1], APPEAR, 0.030, 4.0, seed=seed * 91)
    marks += breath_note(n, chC[0], SETTLE, 0.044, 5.2, seed=seed * 97)
    marks = delay(marks, dotted8 * 1.333, fb=0.30, taps=4, wet=0.40)

    #  ---- the lead, entering on this film's own degree ----
    L = ID["lead_deg"]
    ld = lead(n, [(1.6, hz(root, steps[(L + 1) % 7], 2), 3.4, 0.050),
                  (turn + 0.25, hz(root, steps[(L + 2) % 7], 2), 4.2, 0.058),
                  (close + 0.3, hz(root, steps[L], 2), 4.8, 0.056)], seed + 9)
    ld = delay(ld.astype(np.float32), dotted8, fb=0.46, taps=8, wet=0.80)

    #  ---- THE AIR: the camera, and the cuts it makes on the way ----
    spd = camera_speed(n, total)
    air = air_move(t, spd, seed + 11) * 0.055
    #  a pass of air on every cut, LOUDER WHERE THE CAMERA IS ALREADY MOVING.
    #  A swish on a still camera is a lie; on this move the middle of the film
    #  is where the picture is travelling and that is where they land hardest.
    #  A PASS OF AIR ON EVERY CUT IS A TRAILER, not a film. Eight of them in
    #  forty seconds is the same fault as the bells: a sound per event rather
    #  than a sound that means something. Only the two structural turns get
    #  one, at a third of the level, and they are there to lift the moment
    #  the argument changes direction rather than to mark a cut.
    for at in (turn, close):
        v = float(spd[min(n - 1, int(at * SR))])
        air += swish(n, at, 1.5, 0.016 + 0.022 * v, up=True, seed=seed * 17 + int(at))
    air += swish(n, SETTLE, 1.8, 0.014, up=False, seed=seed * 19)

    #  ---- the strings ----
    st = (strings(t, [f * 0.5 for f in chA], eA * 0.075, seed + 21)
        + strings(t, [f * 0.5 for f in chB], eB * 0.082, seed + 22)
        + strings(t, [f * 0.5 for f in chC], eC * 0.078, seed + 23))
    hi = strings(t, [chB[1] * 2.0, chB[-1] * 2.0], eB * 0.020, seed + 24) \
       + strings(t, [chC[1] * 2.0, chC[-1] * 2.0], eC * 0.022, seed + 25)

    #  ---- one hall ----
    ir = _ir(secs=5.4, pre=0.026)
    wet_p = _conv(pad.astype(np.float32), ir)
    wet_s = _conv(seq, ir)
    wet_m = _conv(marks, ir)
    wet_l = _conv(ld, ir)
    wet_t = _conv((st + hi).astype(np.float32), ir)

    mono = (bass
            + pad.astype(np.float32) * 0.62 + wet_p * 0.58
            + seq * 0.50 + wet_s * 0.44
            + marks * 0.58 + wet_m * 0.62
            + ld * 0.66 + wet_l * 0.74
            + (st + hi) * 0.90 + wet_t * 0.66
            + air)

    #  THE AIR IS THE WIDEST THING IN THE MIX, because it is the only thing
    #  that is not in front of the camera: it is the camera. Everything else
    #  keeps the narrow image that survives a phone speaker.
    left = mono + 0.20 * np.roll(wet_s, 380) + 0.14 * np.roll(wet_p, 210) \
                + 0.16 * np.roll(wet_l, 150) + 0.22 * np.roll(wet_t, 430) \
                + 0.34 * np.roll(air, 520)
    right = mono + 0.20 * np.roll(wet_s, -350) + 0.14 * np.roll(wet_p, -240) \
                 + 0.16 * np.roll(wet_l, -170) + 0.22 * np.roll(wet_t, -470) \
                 + 0.34 * np.roll(air, -560)
    stems = {"sub": bass, "pad": pad.astype(np.float32) * 0.62 + wet_p * 0.58,
             "sequence": seq * 0.50 + wet_s * 0.44,
             "marks": marks * 0.58 + wet_m * 0.62,
             "lead": ld * 0.66 + wet_l * 0.74,
             "strings": (st + hi) * 0.90 + wet_t * 0.66,
             "air": air}
    return left.astype(np.float32), right.astype(np.float32), total, stems, ID


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--lufs", type=float, default=-14.0,
                    help="a silent short carries no voice, so it is mastered "
                         "where music is mastered for a phone, not where a "
                         "narration bed is")
    ap.add_argument("--mux", action="store_true",
                    help="lay the finished wav under the rendered mp4")
    ap.add_argument("--shape", default="tall")
    ap.add_argument("--stems", action="store_true",
                    help="also write each layer on its own, at the same length "
                         "and sample rate, so they drop straight onto tracks "
                         "in Logic and line up without nudging")
    a = ap.parse_args()

    ev = film_events(a.slug)
    print("\n  %s" % ev["title"])
    print("  %.2f s   %d cuts   %d callouts   %d headlines"
          % (ev["total"], len(ev["cuts"]), len(ev["calls"]), len(ev["heads"])))
    L, R, total, stems, ID = score(ev, a.slug)
    print("  maqam %s on %s%s  ·  %s  ·  lead on degree %d"
          % ("Hijazkar" if ID["kar"] else "Hijaz", ID["name"],
             "", ID["voicing"][0], ID["lead_deg"] + 1))

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, a.slug + ".wav")
    _write(path, L, R)
    cur = _lufs(path)
    if cur is not None:
        g = 10.0 ** ((a.lufs - cur) / 20.0)
        L, R = _limit(L * g, R * g)
        _write(path, L, R)
        print("  %.1f LUFS -> %.1f" % (cur, _lufs(path) or 0.0))
    print("  -> %s" % path)

    if a.stems:
        sd = os.path.join(OUT, a.slug + "-stems")
        os.makedirs(sd, exist_ok=True)
        for k, v in stems.items():
            _write(os.path.join(sd, k + ".wav"), v * 0.9, v * 0.9)
        print("  -> %s  (%s)" % (sd, ", ".join(sorted(stems))))

    if a.mux:
        mp4 = os.path.join(HERE, "%s-%s-60fps.mp4" % (a.slug, a.shape))
        if not os.path.exists(mp4):
            print("\n  no picture at %s. Render it first." % mp4)
            return 1
        out = os.path.join(HERE, "%s-%s-60fps-scored.mp4" % (a.slug, a.shape))
        r = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                            "-i", mp4, "-i", path,
                            "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
                            "-shortest", out])
        if r.returncode:
            return 1
        print("  -> %s" % out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
