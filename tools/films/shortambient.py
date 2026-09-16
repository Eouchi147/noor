#!/usr/bin/env python3
"""NOOR - the score for a plate short. Low, warm, slow, and no percussion.

    python3 shortambient.py short-darkroom
    python3 shortambient.py short-darkroom --mux --shape tall

WHY THIS REPLACED shortscore.py

The verdict on the first engine was one sentence and it was right:

    the soundscape is garbage. I want something low frequency, ambient, feel
    good, exploration theme. The sounds you gave me are harsh, low quality,
    and sound like sand is falling continuously.

Three things in that file caused all three complaints and none of them was a
mixing problem.

  THE SAND was the reverb and the texture layer. Both were built out of white
  noise, and white noise shaped by a filter and then stretched over sixty
  seconds is, exactly, the sound of sand falling. There is no noise anywhere
  in this file. The hall is MODAL -- three hundred decaying sine resonators,
  which is what a real room actually is -- and it is silent between notes
  because there is nothing in it to be silent about.

  THE HARSHNESS was additive sawtooths. Twenty four harmonics of a sawtooth
  at 220 hertz puts real energy at five kilohertz, and five kilohertz on a
  phone speaker is a needle. Nothing here has more than five partials and
  every one of them is rolled off steeply.

  THE CHEAPNESS was the drum, and the marks that struck on every event
  whether or not anything was happening. There is no drum. A mark is a bell
  with a twenty five millisecond attack, so it swells rather than hits, and
  it only ever lands on a piece of the drawing arriving.

WHAT IT IS INSTEAD

  A SUB that never leaves.  D at thirty seven hertz and its octave, breathing
  once every twenty two seconds. This is the low frequency: the thing you
  feel on a phone in a pocket rather than hear.

  A PAD in maqam Hijaz on D.  The augmented second between E flat and F sharp
  is the whole character of the mode and it is the reason this sounds like
  somewhere rather than like a preset. Three voicings across the piece, each
  taking five seconds to open and eight to let go, so the harmony changes
  without anything ever being seen to change it.

  A BELL on every piece of the drawing.  Walking up the mode as the argument
  builds, so the ear learns that a new sound means a new thing on the screen.
  Soft attack, four second tail, and quiet.

  A BREATH under every new sentence.  A fifth below the bell, swelling over a
  second. It is the sound of the frame turning over.

Everything is read out of films/<slug>.json, so the score cannot drift from
the picture: the millisecond a stroke lands is the millisecond the bell is
struck, because both are the same number.
"""
import argparse, hashlib, json, os, re, subprocess, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
SR = 48000
CEIL_DB = -2.0

#  MAQAM HIJAZ ON D, in hertz, written out rather than derived, because the
#  augmented second between the second and third degrees is the point of the
#  mode and it should be readable in the file.
#      D   Eb   F#   G   A   Bb   C   D
HIJAZ = [146.832, 155.563, 184.997, 195.998, 220.000, 233.082, 261.626, 293.665]
SUB = 36.708          # D0
SUB2 = 73.416         # D1


# ---------------------------------------------------------------- the room
def hall(secs=6.5, modes=420, seed=414, top=2600.0, bottom=60.0):
    """A MODAL ROOM, not a noise burst.

    A reverb tail made by filtering white noise is the most common way to do
    this and it is what made the first score sound like sand: noise is noise
    however you shape it, and sixty seconds of shaped noise is sixty seconds
    of hiss under the music.

    A room is really a few hundred standing waves, each at its own frequency,
    each dying at its own rate, with the high ones dying first because
    everything a room is made of absorbs treble faster than bass. Summing
    that directly gives a tail that is smooth all the way down and has no
    hiss in it at all, because there is no noise in it at all.
    """
    n = int(SR * secs)
    t = np.arange(n, dtype=np.float32) / SR
    rng = np.random.default_rng(seed)
    #  modes crowd together at the bottom of a real room and thin out going
    #  up, so they are drawn on a log scale
    f = np.exp(rng.uniform(np.log(bottom), np.log(top), modes)).astype(np.float32)
    ph = rng.uniform(0, 2 * np.pi, modes).astype(np.float32)
    #  a 2.6 kHz mode is gone in a fifth of the time a 60 Hz one takes
    tau = secs * np.clip(1.05 * (bottom / f) ** 0.34, 0.06, 1.0)
    amp = 1.0 / (1.0 + f / 300.0)
    out = np.zeros(n, dtype=np.float32)
    for i in range(0, modes, 48):          # in blocks, or it wants half a gig
        fb, pb = f[i:i + 48, None], ph[i:i + 48, None]
        tb, ab = tau[i:i + 48, None], amp[i:i + 48, None]
        out += (ab * np.cos(2 * np.pi * fb * t + pb) *
                np.exp(-6.91 * t / tb)).sum(0).astype(np.float32)
    out[:int(SR * 0.022)] = 0.0          # the gap before the first reflection
    out /= max(1e-9, float(np.sqrt((out ** 2).sum())))
    return out.astype(np.float32)


def conv(x, ir):
    n = len(x)
    N = 1 << int(np.ceil(np.log2(n + len(ir) - 1)))
    return np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[:n].astype(np.float32)


def lowpass(x, hz, order=2):
    """one pole, applied `order` times, in the frequency domain. Gentle: a
    steep filter rings, and ringing on a pad is the thing that makes it sound
    computed."""
    N = len(x)
    f = np.fft.rfftfreq(N, 1.0 / SR)
    g = (1.0 / (1.0 + (f / hz) ** 2)) ** (order / 2.0)
    return np.fft.irfft(np.fft.rfft(x) * g, N).astype(np.float32)


def highpass(x, hz):
    N = len(x)
    f = np.fft.rfftfreq(N, 1.0 / SR)
    g = (f / hz) ** 2 / (1.0 + (f / hz) ** 2)
    return np.fft.irfft(np.fft.rfft(x) * g, N).astype(np.float32)


def drift(n, cents, hz, seed):
    """an oscillator wandering. Smooth, because a real one moves with
    temperature and supply rather than jittering."""
    rng = np.random.default_rng(seed)
    m = max(8, int(n / SR * hz * 20))
    c = rng.standard_normal(m)
    v = np.interp(np.linspace(0, m - 1, n), np.arange(m), c)
    #  a box smooth by running sum, O(n): np.convolve with a four thousand
    #  tap kernel over four million samples is fifteen billion multiplies and
    #  it was the reason the first run of this file never finished.
    k = 4096
    c = np.concatenate([[0.0], np.cumsum(v)])
    idx = np.arange(len(v))
    lo = np.clip(idx - k // 2, 0, len(v)); hi = np.clip(idx + k // 2, 0, len(v))
    v = ((c[hi] - c[lo]) / np.maximum(1, hi - lo)).astype(np.float32)
    v /= max(1e-9, np.abs(v).max())
    return (1.0 + v * (2.0 ** (cents / 1200.0) - 1.0)).astype(np.float32)


# ---------------------------------------------------------------- voices
def warm(n, f, seed, partials=(1.0, 2.0, 3.0, 4.0, 5.0), tilt=2.3, det=(-6.0, 0.0, 7.0)):
    """A WARM VOICE: three oscillators a few cents apart, four partials each,
    every partial steeply quieter than the one below it.

    Three is what gives the width -- two beat against each other and a third
    stops the beat being periodic. Four partials with a 2.6 tilt puts the
    fourth at six per cent of the first, which is a soft triangle: enough
    upper harmonic to have a body, not enough to have an edge. The first
    engine used twenty four harmonics of a sawtooth and that is where the
    needle at five kilohertz came from."""
    t = np.arange(n, dtype=np.float32) / SR
    out = np.zeros(n, dtype=np.float32)
    for k, c in enumerate(det):
        d = drift(n, 7.0, 0.055, seed * 31 + k)
        ff = f * (2.0 ** (c / 1200.0)) * d
        ph = 2 * np.pi * np.cumsum(ff) / SR
        for h in partials:
            if f * h > 7000: break
            out += np.sin(ph * h + k * 1.7 + h * 0.9).astype(np.float32) / (h ** tilt)
    return (out / len(det)).astype(np.float32)


def env(n, at, attack, hold, release):
    """a raised-cosine attack and release. Never linear: a linear ramp has a
    corner at each end and a corner is a click."""
    e = np.zeros(n, dtype=np.float32)
    i0 = int(at * SR)
    a, h, r = int(attack * SR), int(hold * SR), int(release * SR)
    if i0 >= n: return e
    k = np.arange(a, dtype=np.float32)
    up = 0.5 - 0.5 * np.cos(np.pi * k / max(1, a - 1))
    seg = np.concatenate([up, np.ones(max(0, h), np.float32),
                          0.5 + 0.5 * np.cos(np.pi * np.arange(max(1, r)) / max(1, r - 1))])
    m = min(n - i0, len(seg))
    e[i0:i0 + m] = seg[:m]
    return e


def bell(n, at, f, secs=4.2, level=1.0, seed=0):
    """A BELL WITH A SOFT SHOULDER.

    Twenty five milliseconds of attack rather than none. A struck sound with
    an instant attack reads as a click on a phone speaker, and a film with
    twenty one clicks in it is the thing that was described as cheap. This
    swells, which on a picture that draws itself is also what is happening on
    the screen.

    The partials are the low end of a tubular bell -- roughly 1, 2, 2.76, 5.4
    -- and the inharmonic ones die first, so the sound arrives with a shimmer
    and settles into a sine."""
    out = np.zeros(n, dtype=np.float32)
    i0 = int(at * SR)
    if i0 >= n: return out
    m = min(n - i0, int(secs * SR))
    t = np.arange(m, dtype=np.float32) / SR
    rng = np.random.default_rng(seed)
    for h, amp, dec in ((1.0, 1.00, 1.00), (2.0, 0.42, 0.62),
                        (2.76, 0.22, 0.34), (5.40, 0.07, 0.16)):
        if f * h > 8000: continue
        out[i0:i0 + m] += (amp * np.sin(2 * np.pi * f * h * t +
                                        rng.uniform(0, 6.28)) *
                           np.exp(-6.91 * t / (secs * dec))).astype(np.float32)
    #  the soft shoulder
    a = int(0.025 * SR)
    sh = 0.5 - 0.5 * np.cos(np.pi * np.arange(a, dtype=np.float32) / max(1, a - 1))
    out[i0:i0 + a] *= sh[:max(0, min(a, n - i0))]
    return (out * level).astype(np.float32)


# ---------------------------------------------------------------- the film
def events(slug):
    d = json.load(open(os.path.join(HERE, "films", slug + ".json"), encoding="utf-8"))
    b = d["chapters"][0]["beats"][0]
    total = float(b.get("hold", 60.0)) + 1.2
    lines = [float(L.get("at", 0.0)) for L in b.get("lines", [])]
    steps = [float(ms) / 1000.0 for ms in (b.get("at") or [])]
    return {"total": total, "lines": lines, "steps": steps,
            "title": d.get("title", slug)}


# ---------------------------------------------------------------- the score
def score(ev, slug):
    n = int(SR * ev["total"])
    seed = int(hashlib.sha1(slug.encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)

    #  ---- THE SUB ------------------------------------------------------
    #  It is there from the first frame and it never stops. Two sines and a
    #  breath: nothing else, because anything else at thirty seven hertz is
    #  mud on a phone and rumble on a speaker.
    t = np.arange(n, dtype=np.float32) / SR
    breath = 0.78 + 0.22 * np.sin(2 * np.pi * t / 22.0 + 1.1)
    sub = (np.sin(2 * np.pi * SUB * t * drift(n, 3.0, 0.03, seed)) * 0.62 +
           np.sin(2 * np.pi * SUB2 * t * drift(n, 3.5, 0.037, seed + 1)) * 0.38)
    sub = (sub * breath * env(n, 0.0, 6.0, ev["total"] - 11.0, 5.0)).astype(np.float32)

    #  ---- THE PAD ------------------------------------------------------
    #  Three voicings, laid across the piece at a third and two thirds. No
    #  third in the first: it opens on a bare fifth, which is a place rather
    #  than a mood, and the mode declares itself when the E flat arrives.
    VOICINGS = [
        (0, 4, 7),          # D  A  D+      the open fifth
        (1, 4, 7),          # Eb A  D+      the hijaz colour
        (2, 4, 7),          # F# A  D+      lit
    ]
    pad = np.zeros(n, dtype=np.float32)
    T = ev["total"]
    marks = [0.0, T * 0.34, T * 0.68]
    for i, (v, at) in enumerate(zip(VOICINGS, marks)):
        end = marks[i + 1] if i + 1 < len(marks) else T
        e = env(n, max(0.0, at - 2.0), 5.4, max(1.0, end - at + 1.0), 8.0)
        for j, deg in enumerate(v):
            f = HIJAZ[deg] * (0.5 if j == 0 else 1.0)
            pad += warm(n, f, seed + i * 7 + j) * e * (0.44 if j == 0 else 0.30)
    pad = lowpass(pad, 2200.0, 2)

    #  ---- THE BELLS ----------------------------------------------------
    #  One per piece of the drawing, walking up the mode as the argument
    #  builds so the ear can hear the shape of the explanation even with the
    #  sound off in another room. It comes back down for the last third,
    #  which is where a short stops adding and starts landing.
    bells = np.zeros(n, dtype=np.float32)
    steps = ev["steps"]
    for i, at in enumerate(steps):
        u = i / max(1, len(steps) - 1)
        deg = int(round((len(HIJAZ) - 1) * (u if u < 0.72 else 0.72 - (u - 0.72) * 1.2)))
        deg = max(0, min(len(HIJAZ) - 1, deg))
        f = HIJAZ[deg] * 2.0
        bells += bell(n, at, f, 4.4, 0.30 - 0.06 * (i % 2), seed + i)
        #  ---- AND A LIGHT TWO OCTAVES UP, EVERY THIRD PIECE -------------
        #  The mix without this was correct and joyless: everything sat
        #  under fifteen hundred hertz and the whole thing sounded like it
        #  was being played through a wall. One glass note, a fifth of the
        #  weight of the bell under it, is what "beautiful" costs, and
        #  putting it on every third step rather than every one keeps it a
        #  highlight instead of a texture.
        if i % 3 == 0:
            bells += bell(n, at + 0.09, f * 4.0, 5.6, 0.085, seed + 500 + i)
    bells = lowpass(bells, 5200.0, 2)

    #  ---- THE BREATH ---------------------------------------------------
    #  Under every new sentence. A fifth below the bell, one second to swell
    #  and three to go, filtered right down: it is felt as the frame turning
    #  over rather than heard as a note.
    air = np.zeros(n, dtype=np.float32)
    for i, at in enumerate(ev["lines"]):
        f = HIJAZ[[0, 4, 3, 4][i % 4]] * 0.5
        air += warm(n, f, seed + 100 + i, partials=(1.0, 2.0), tilt=3.2) * \
               env(n, max(0.0, at - 0.35), 1.15, 0.5, 3.2) * 0.26
    air = lowpass(air, 700.0, 3)
    #  ---- THE BALANCE, SET IN DECIBELS AND NOT BY EYE ------------------
    #  The first mix of this file put ninety nine per cent of its energy
    #  below two hundred and fifty hertz, which is not "low frequency
    #  ambient", it is mud: the sub was written at nearly full scale and
    #  everything with a note in it sat underneath it. Each layer is now
    #  levelled to its own loudness and then placed, so the balance is a
    #  decision rather than an accident of how loud a sine happens to be.
    def at_db(x, db):
        rms = float(np.sqrt(np.mean(x.astype(np.float64) ** 2))) or 1e-9
        return (x * (10.0 ** (db / 20.0) / rms)).astype(np.float32)

    sub   = at_db(sub,   -19.0)     # felt, not heard
    pad   = at_db(pad,   -13.5)     # the music
    bells = at_db(bells, -13.5)     # the thing the eye follows
    air   = at_db(air,   -21.0)     # the frame turning over

    #  ---- THE ROOM -----------------------------------------------------
    send = bells * 1.0 + air * 0.7 + pad * 0.34
    ir  = hall(6.8, 420, seed % 9973)
    ir2 = hall(6.8, 420, (seed % 9973) + 977)
    wet  = at_db(conv(send, ir),  -16.0)
    wet2 = at_db(conv(send, ir2), -16.0)
    dry = sub + pad + bells + air

    #  ---- WIDTH --------------------------------------------------------
    #  Not a delay and not a phase trick, both of which collapse to a comb
    #  filter when a phone plays it in mono. The same room from two seeds:
    #  the dry side is common to both, so the low end stays solid in mono
    #  and only the tail differs, which is how a real hall is wide.
    def finish(x):
        #  a gentle shelf rather than a wall, and the sub kept out of the
        #  part of the spectrum a phone speaker turns into distortion
        x = x * 0.82 + lowpass(x, 5000.0, 1) * 0.18
        return highpass(x, 28.0)
    left, right = finish(dry + wet), finish(dry + wet2)

    fade = env(n, 0.0, 1.6, max(0.1, ev["total"] - 5.4), 3.8)
    left, right = left * fade, right * fade
    peak = max(float(np.abs(left).max()), float(np.abs(right).max()), 1e-9)
    g = 0.72 / peak
    stems = {"sub": sub * g, "pad": pad * g, "bells": bells * g, "air": air * g}
    return (left * g).astype(np.float32), (right * g).astype(np.float32), stems


# ---------------------------------------------------------------- output
def limit(l, r, ceiling_db=CEIL_DB):
    c = 10.0 ** (ceiling_db / 20.0)
    knee = c * 0.55
    def bend(x):
        a = np.abs(x); y = a.copy(); o = a > knee
        y[o] = knee + (c - knee) * np.tanh((a[o] - knee) / (c - knee))
        return (np.sign(x) * y).astype(np.float32)
    return bend(l), bend(r)


def write(path, l, r):
    a = np.clip(np.stack([l, r], axis=1), -1.0, 1.0)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((a * 32767.0).astype("<i2").tobytes())
    return path


def lufs(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path,
                          "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    m = re.findall(r"I:\s*(-?\d+(?:\.\d+)?)\s*LUFS", out)
    return float(m[-1]) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--lufs", type=float, default=-15.0)
    ap.add_argument("--mux", action="store_true")
    ap.add_argument("--shape", default="tall")
    ap.add_argument("--stems", action="store_true")
    a = ap.parse_args()

    ev = events(a.slug)
    print("\n  %s" % ev["title"])
    print("  %.1f s   %d sentences   %d picture steps"
          % (ev["total"], len(ev["lines"]), len(ev["steps"])))
    L, R, stems = score(ev, a.slug)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, a.slug + ".wav")
    write(path, L, R)
    cur = lufs(path)
    if cur is not None:
        g = 10.0 ** ((a.lufs - cur) / 20.0)
        L, R = limit(L * g, R * g)
        write(path, L, R)
        print("  %.1f LUFS -> %.1f" % (cur, lufs(path) or 0.0))
    print("  -> %s" % path)

    if a.stems:
        sd = os.path.join(OUT, a.slug + "-stems"); os.makedirs(sd, exist_ok=True)
        for k, v in stems.items():
            write(os.path.join(sd, k + ".wav"), v * 0.9, v * 0.9)
        print("  -> %s" % sd)

    if a.mux:
        mp4 = os.path.join(HERE, "%s-%s-60fps.mp4" % (a.slug, a.shape))
        if not os.path.exists(mp4):
            print("\n  no picture at %s. Render it first." % mp4); return 1
        out = os.path.join(HERE, "%s-%s-60fps-scored.mp4" % (a.slug, a.shape))
        r = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                            "-i", mp4, "-i", path, "-c:v", "copy",
                            "-c:a", "aac", "-b:a", "256k", "-shortest", out])
        if r.returncode: return 1
        os.replace(out, mp4)
        print("  -> %s" % mp4)
    return 0


if __name__ == "__main__":
    sys.exit(main())
