#!/usr/bin/env python3
"""NOOR - the sound for a plate short: the written score, plus marks.

    python3 shortmusic.py short-darkroom
    python3 shortmusic.py short-darkroom --mux --shape tall
    python3 shortmusic.py short-darkroom --track D --at 128

WHY THE SYNTHESISED SCORE WAS DROPPED

Two engines were written to compose the music for these shorts from nothing,
and the verdict on both was the same: harsh, then depressing and weird. That
is the right verdict and it is not a mixing problem. Music written by rule
from a mode and a set of event times has no melody, because nothing in the
rules knows what a tune is, and forty seconds of harmonically correct
non-melody is exactly what "depressing and weird" sounds like.

There are already two finished pieces of music for this library, written for
it and approved: music/*.m4a. Six minutes each, warm, low, no percussion,
nothing above about two kilohertz. So this file does not compose. It CUTS,
and then it adds the one thing a piece of library music cannot do, which is
know what is happening on the screen.

WHAT IT DOES

  PICKS THE PIECE, and the forty seconds of it that build. Every window in
  the track is scored on how much it rises from its first third to its last
  and how quietly it starts, so the cut lands on a passage that opens and
  grows rather than one that was already in full flow.

  FINDS THE KEY, by chroma, so the marks are in tune with the music instead
  of beside it. This is the whole difference between a sound effect and a
  score, and it costs one FFT.

  MARKS WHAT MOVES. A round bell as each piece of the drawing lands. A low
  swell under each new sentence. A soft fall of air on each camera move.
  Every one is built from sines with harmonic partials only -- no fifth
  partial, no inharmonic ring, no noise anywhere -- because the standing
  note on this is "round and balanced, not sharp and ugly", and sharpness in
  a struck sound is entirely a question of which partials are in it.

  DUCKS THE MUSIC a hair under each mark, so the mark is heard without being
  loud, which is how a mark stays a mark and does not become a bang.

Every timing is read out of films/<slug>.json, the same file the picture is
rendered from, so the sound cannot drift from the frame.
"""
import argparse, hashlib, json, os, re, subprocess, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
MUSIC = os.path.join(HERE, "music")
SR = 48000
NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


# ------------------------------------------------------------------ helpers
def decode(path):
    """anything ffmpeg can read -> float32 stereo at 48k"""
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le",
                        "-ac", "2", "-ar", str(SR), "-"],
                       capture_output=True)
    if r.returncode:
        raise SystemExit("could not read %s\n%s" % (path, r.stderr.decode()[:400]))
    a = np.frombuffer(r.stdout, dtype="<f4").reshape(-1, 2)
    return a[:, 0].copy(), a[:, 1].copy()


def lowpass(x, hz, order=2):
    N = len(x)
    f = np.fft.rfftfreq(N, 1.0 / SR)
    g = (1.0 / (1.0 + (f / hz) ** 2)) ** (order / 2.0)
    return np.fft.irfft(np.fft.rfft(x) * g, N).astype(np.float32)


def rc(n):
    """a raised cosine from 0 to 1. Never a straight line: a line has a
    corner at each end and a corner is a click."""
    return (0.5 - 0.5 * np.cos(np.pi * np.arange(max(1, n)) / max(1, n - 1))).astype(np.float32)


def at_db(x, db):
    r = float(np.sqrt(np.mean(x.astype(np.float64) ** 2))) or 1e-9
    return (x * (10.0 ** (db / 20.0) / r)).astype(np.float32)


# ---------------------------------------------------------- choosing the cut
def pick_window(x, secs, hop=2.0):
    """The passage that OPENS AND GROWS.

    A short is forty seconds long and it has a shape: quiet at the hook,
    fullest at the point. Dropping it on a random forty seconds of a six
    minute piece gets a passage that was already in full flow when the video
    started, which is why library music so often sounds stuck on rather than
    written for. Every candidate is scored on how much louder its last third
    is than its first, with a bonus for starting quiet, and the best wins."""
    n = int(secs * SR)
    if len(x) <= n:
        return 0.0
    step = int(hop * SR)
    best, bat = -1e9, 0
    #  never the first eight seconds (a track's own fade in) and never the
    #  last thirty (its fade out): a cut that lands on either is a cut that
    #  starts or ends on somebody else's ending
    lo, hi = int(8 * SR), max(int(8 * SR) + step, len(x) - n - int(30 * SR))
    for i in range(lo, hi, step):
        seg = x[i:i + n]
        a = float(np.sqrt((seg[:n // 3] ** 2).mean()))
        b = float(np.sqrt((seg[n // 3:2 * n // 3] ** 2).mean()))
        c = float(np.sqrt((seg[2 * n // 3:] ** 2).mean()))
        if min(a, b, c) < 0.010:            # a hole in the middle of a cut
            continue
        s = (c - a) * 6.0 + (b - a) * 2.0 - a * 1.4
        if s > best:
            best, bat = s, i
    return bat / float(SR)


def find_key(x):
    """the tonic, by chroma. One FFT of the cut, folded into twelve."""
    n = min(len(x), SR * 30)
    S = np.abs(np.fft.rfft(x[:n] * np.hanning(n))) ** 2
    f = np.fft.rfftfreq(n, 1.0 / SR)
    m = (f > 55) & (f < 1200)
    f, S = f[m], S[m]
    pc = np.zeros(12)
    idx = np.round(12 * np.log2(f / 440.0) + 69).astype(int) % 12
    np.add.at(pc, idx, S)
    #  a tonic is not always the loudest pitch class; it is the one whose
    #  fifth is also strong. Score each candidate as itself plus its fifth.
    sc = [pc[i] * 1.0 + pc[(i + 7) % 12] * 0.55 + pc[(i + 3) % 12] * 0.22 +
          pc[(i + 4) % 12] * 0.22 for i in range(12)]
    k = int(np.argmax(sc))
    return k, NOTES[k]


def hz(pc, octave):
    """midi pitch class + octave -> hertz"""
    return 440.0 * (2.0 ** ((pc + 12 * octave - 69) / 12.0))


# ------------------------------------------------------------------- marks
#
#  WHAT WENT WRONG WITH THE FIRST SET, IN ONE SENTENCE EACH.
#
#    THE SWELL was a sine that rose over a second and fell over two, an
#    octave below middle. A slow rise and fall on a single low tone is,
#    acoustically, a moan. It was described as an old man whining and that is
#    exactly what it was.
#
#    THE AIRFALL was four sines gliding down a fifth together. A group of
#    tones sliding in parallel is a siren. Softening it only made it a
#    quieter siren.
#
#  Both were trying to be a gesture. A mark should not be a gesture, it
#  should be a THING: something struck, or something dropped, with a pitch
#  and a shape a person recognises before they have thought about it. So
#  there are two sounds in this film and both are objects.

def hall(secs=5.0, modes=320, seed=91, top=2400.0, bottom=70.0):
    """A MODAL ROOM: a few hundred standing waves, each dying at its own rate,
    the high ones first, because everything a room is built of absorbs treble
    faster than bass. Not filtered noise -- noise stretched over five seconds
    is hiss, and hiss under a piano note is what makes a sample sound cheap."""
    n = int(SR * secs)
    t = np.arange(n, dtype=np.float32) / SR
    rng = np.random.default_rng(seed)
    f = np.exp(rng.uniform(np.log(bottom), np.log(top), modes)).astype(np.float32)
    ph = rng.uniform(0, 2 * np.pi, modes).astype(np.float32)
    tau = secs * np.clip(1.05 * (bottom / f) ** 0.34, 0.06, 1.0)
    amp = 1.0 / (1.0 + f / 320.0)
    out = np.zeros(n, dtype=np.float32)
    for i in range(0, modes, 48):
        fb, pb = f[i:i + 48, None], ph[i:i + 48, None]
        tb, ab = tau[i:i + 48, None], amp[i:i + 48, None]
        out += (ab * np.cos(2 * np.pi * fb * t + pb) *
                np.exp(-6.91 * t / tb)).sum(0).astype(np.float32)
    out[:int(SR * 0.020)] = 0.0
    out /= max(1e-9, float(np.sqrt((out ** 2).sum())))
    return out.astype(np.float32)


#  ---- ONE VOICE, THREE CHARACTERS ------------------------------------
#  Not two sound effects. One instrument, struck, with a choice of what it
#  is made of, so the whole film is punctuated by a single sound rather than
#  by a little collection of noises. All three are the same shape -- a
#  strike, a tone, a decay -- and they differ only in which partials are in
#  them and how fast each partial dies, which is all that "made of wood" or
#  "made of glass" means to an ear.
#
#      felt   a hammered string, dark, with the knock of the key under it
#      glass  a soft bell: bright, long, never sharp, rolled off hard
#      wood   a marimba bar: the roundest of the three, and the shortest
#
#  PARTIALS is (ratio, loudness, how much faster than the fundamental it
#  dies). STIFF stretches the partials slightly sharp, which is what a real
#  struck string does and most of what tells an ear it is a string.
VOICE = {
    "felt":  {"partials": [(1.0, 1.00, 1.0), (2.0, 0.42, 1.7), (3.0, 0.18, 2.4),
                           (4.0, 0.09, 3.1), (5.0, 0.04, 4.0)],
              "stiff": 0.00042, "secs": 3.0, "knock": 0.16, "top": 4200.0},
    "glass": {"partials": [(1.0, 1.00, 1.0), (2.76, 0.26, 2.2), (5.40, 0.09, 4.2),
                           (8.90, 0.03, 7.0)],
              "stiff": 0.0, "secs": 4.4, "knock": 0.05, "top": 5200.0},
    "wood":  {"partials": [(1.0, 1.00, 1.0), (3.9, 0.22, 3.0), (9.2, 0.06, 6.0)],
              "stiff": 0.0, "secs": 1.5, "knock": 0.10, "top": 3200.0},
}


def struck(n, at, f, voice="glass", level=1.0):
    """One note, struck and left to ring.

    Three things keep this from sounding like a sine with an envelope:

      THE TOP DIES FIRST. The highest partial is gone in a fraction of the
      time the fundamental takes, so the note gets ROUNDER as it decays
      rather than just quieter. That is the single most important line in
      this function.

      THERE IS A STRIKE. A short knock under a hundred hertz, forty
      milliseconds long. Leave it out and the note begins out of nowhere,
      which is the tell of a synthesised sound.

      IT IS NOT INSTANT. Four milliseconds of attack, shaped, not a step. A
      step is a click, and a click on a phone speaker is the whole reason
      the first version of this was called cheap.
    """
    V = VOICE.get(voice, VOICE["glass"])
    out = np.zeros(n, dtype=np.float32)
    i0 = int(at * SR)
    if i0 >= n or i0 < 0:
        return out
    secs = V["secs"]
    m = min(n - i0, int(secs * SR))
    if m <= 0:
        return out
    t = np.arange(m, dtype=np.float32) / SR
    for h, a, fast in V["partials"]:
        fh = f * h * np.sqrt(1.0 + V["stiff"] * h * h)
        if fh > V["top"] * 1.6:
            continue
        out[i0:i0 + m] += (a * np.sin(2 * np.pi * fh * t) *
                           np.exp(-6.91 * t / (secs / fast))).astype(np.float32)
    if V["knock"]:
        k = min(m, int(0.14 * SR))
        tk = np.arange(k, dtype=np.float32) / SR
        out[i0:i0 + k] += (V["knock"] * np.sin(2 * np.pi * 96.0 * tk) *
                           np.exp(-6.91 * tk / 0.045)).astype(np.float32)
    a0 = min(int(0.004 * SR), m)
    out[i0:i0 + a0] *= rc(a0)
    return (out * level).astype(np.float32)


def thin(times, gap=1.15, keep=()):
    """WHICH MOMENTS ACTUALLY GET A SOUND.

    A short has twenty one pieces of drawing in forty four seconds. Marking
    every one of them is a sound every two seconds for the whole film, which
    stops being punctuation and becomes a rhythm section nobody asked for,
    and it is most of what "not subtle at all" meant.

    So a mark is only struck if a second and a bit has passed since the last
    one, and the first piece under each new sentence is always struck. Twenty
    one events become about ten, each of them landing on something the words
    are talking about."""
    out, last = [], -9.0
    keep = set(round(k, 2) for k in keep)
    for t in times:
        if round(t, 2) in keep or t - last >= gap:
            out.append(t); last = t
    return out


# ------------------------------------------------------------------ the film
def events(slug):
    d = json.load(open(os.path.join(HERE, "films", slug + ".json"), encoding="utf-8"))
    b = d["chapters"][0]["beats"][0]
    return {"total": float(b.get("hold", 40.0)) + 1.0,
            "lines": [float(L.get("at", 0.0)) for L in b.get("lines", [])],
            "steps": [float(ms) / 1000.0 for ms in (b.get("at") or [])],
            "title": d.get("title", slug)}


def tracks():
    if not os.path.isdir(MUSIC):
        return []
    return sorted(os.path.join(MUSIC, f) for f in os.listdir(MUSIC)
                  if f.lower().endswith((".m4a", ".mp3", ".wav", ".flac", ".aac", ".ogg")))


def build(ev, slug, which=None, start=None, voice="glass"):
    tl = tracks()
    if not tl:
        raise SystemExit("no music in %s. Put the score files there." % MUSIC)
    seed = int(hashlib.sha1(slug.encode()).hexdigest()[:8], 16)
    path = None
    if which:
        for t in tl:
            if which.lower() in os.path.basename(t).lower():
                path = t
                break
    if path is None:
        path = tl[seed % len(tl)]

    L, R = decode(path)
    mono = (L + R) * 0.5
    total = ev["total"]
    at = start if start is not None else pick_window(mono, total + 2.5)
    i0 = int(at * SR)
    n = int(total * SR)
    ml = L[i0:i0 + n].copy()
    mr = R[i0:i0 + n].copy()
    if len(ml) < n:
        ml = np.pad(ml, (0, n - len(ml)))
        mr = np.pad(mr, (0, n - len(mr)))

    #  in over a second, out over three, so it lands and leaves like a cue
    fin, fout = int(1.1 * SR), int(3.0 * SR)
    ml[:fin] *= rc(fin); mr[:fin] *= rc(fin)
    ml[-fout:] *= rc(fout)[::-1]; mr[-fout:] *= rc(fout)[::-1]

    pc, name = find_key(mono[i0:i0 + n])

    #  ---- THE MARKS -----------------------------------------------------
    #  One note as each piece of the drawing lands, walking up the piece's
    #  own minor scale as the argument builds and easing back for the close,
    #  so the sound carries the shape of the lesson. Thinned, so it marks
    #  rather than drums, and set a long way under the music: a mark is meant
    #  to be noticed the way a page turning is noticed.
    DEG = [0, 3, 5, 7, 10, 12, 14, 15]
    firsts = []
    for L in ev["lines"]:
        nxt = [t for t in ev["steps"] if t >= L - 0.1]
        if nxt: firsts.append(nxt[0])
    hits = thin(ev["steps"], 1.15, firsts)
    marks = np.zeros(n, dtype=np.float32)
    for i, t in enumerate(hits):
        u = i / max(1, len(hits) - 1)
        d = DEG[min(len(DEG) - 1, int(round((len(DEG) - 1) *
                                            (u if u < 0.78 else 0.78 - (u - 0.78) * 1.4))))]
        f = hz((pc + d) % 12 + 12 * ((pc + d) // 12), 5)
        marks += struck(n, t, f, voice, 0.36 if i % 2 else 0.42)
    marks = lowpass(marks, VOICE.get(voice, VOICE["glass"])["top"], 2)
    air = np.zeros(n, dtype=np.float32)

    #  ---- BALANCE -------------------------------------------------------
    ml = at_db(ml, -15.5); mr = at_db(mr, -15.5)
    #  FOURTEEN DECIBELS UNDER THE MUSIC. The first mix put them six under,
    #  which is not punctuation, it is a duet.
    marks = at_db(marks, -29.5)

    #  ---- AND A ROOM TO PUT THEM IN -------------------------------------
    #  A piano note dry on top of a piece of music is a sample. The same note
    #  five seconds deep in a dark room is part of the piece. The music keeps
    #  its own space; only the marks are sent to this one.
    room = hall(5.2, 320, (seed % 7919) + 13)
    wet = at_db(np.convolve(marks, room)[:n], -31.0)
    marks = marks + wet

    #  ---- AND THE MUSIC STEPS BACK FOR THEM -----------------------------
    #  A mark that has to be loud enough to cut through a full mix is a bang.
    #  A mark the music makes room for is a mark. One and a half decibels for
    #  three hundred milliseconds is under the threshold of being noticed and
    #  over the threshold of being heard.
    duck = np.zeros(n, dtype=np.float32)
    for t in list(hits):
        i = int(max(0.0, t - 0.05) * SR)
        m = min(n - i, int(0.55 * SR))
        if m <= 0:
            continue
        d = np.concatenate([rc(int(0.05 * SR)), rc(int(0.50 * SR))[::-1]])[:m]
        duck[i:i + m] = np.maximum(duck[i:i + m], d)
    g = (10.0 ** (-1.1 * duck / 20.0)).astype(np.float32)
    ml *= g; mr *= g

    left = ml + marks + air
    right = mr + marks * 0.96 + air
    return left, right, {"track": os.path.basename(path), "at": at,
                         "key": name, "marks": len(hits), "voice": voice}


# ------------------------------------------------------------------ output
def limit(l, r, ceiling_db=-1.5):
    c = 10.0 ** (ceiling_db / 20.0)
    knee = c * 0.60
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
    ap.add_argument("--track", default=None, help="part of a filename in music/")
    ap.add_argument("--at", type=float, default=None, help="seconds into the track")
    ap.add_argument("--voice", default="glass", choices=sorted(VOICE),
                    help="what the mark is made of: felt, glass or wood")
    ap.add_argument("--lufs", type=float, default=-14.0,
                    help="where the platforms normalise to")
    ap.add_argument("--mux", action="store_true")
    ap.add_argument("--shape", default="tall")
    a = ap.parse_args()

    ev = events(a.slug)
    Lc, Rc, info = build(ev, a.slug, a.track, a.at, a.voice)
    print("\n  %s" % ev["title"])
    print("  %.1f s   %d sentences   %d marks" % (ev["total"], len(ev["lines"]), info["marks"]))
    print("  %s  from %.0f s  ·  key %s  ·  %d marks in %s"
          % (info["track"], info["at"], info["key"], info["marks"], info["voice"]))

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, a.slug + ".wav")
    write(path, Lc, Rc)
    cur = lufs(path)
    if cur is not None:
        g = 10.0 ** ((a.lufs - cur) / 20.0)
        Lc, Rc = limit(Lc * g, Rc * g)
        write(path, Lc, Rc)
        print("  %.1f LUFS -> %.1f" % (cur, lufs(path) or 0.0))
    print("  -> %s" % path)

    if a.mux:
        mp4 = os.path.join(HERE, "%s-%s-60fps.mp4" % (a.slug, a.shape))
        if not os.path.exists(mp4):
            print("\n  no picture at %s. Render it first." % mp4)
            return 1
        tmp = os.path.join(HERE, "_%s-scored.mp4" % a.slug)
        r = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                            "-i", mp4, "-i", path, "-c:v", "copy",
                            "-c:a", "aac", "-b:a", "256k", "-shortest", tmp])
        if r.returncode:
            return 1
        os.replace(tmp, mp4)
        print("  -> %s" % mp4)
    return 0


if __name__ == "__main__":
    sys.exit(main())
