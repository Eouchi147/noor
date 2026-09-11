#!/usr/bin/env python3
"""NOOR film · the score.

A seven minute film cannot be scored the way a forty second reel is. A reel's
bed arrives, builds and lands inside one breath; a film's has to be under
narration for minutes at a time without ever asking to be listened to, and
then has to mark the places where the argument turns.

So this is the reels' own sound engine -- the same synthesised pad, the same
sub, the same muted drum, the same hall, nothing sampled and nothing licensed
-- arranged for length instead of for impact:

  the harmony moves.  One root per chapter, and the roots walk: A, G, F, G, E,
      F, A. Out and back. Voicings are the house's suspended set (root, fifth,
      octave, ninth, twelfth, double octave -- no third, so nothing ever
      resolves major or minor and nothing ever sounds like a cue).

  the pad breathes with the chapter.  It opens over the title, thins to
      almost nothing while the sentences do the work, and swells again under
      the last beat. Under narration a pad that holds one level is a hum; a
      pad that moves is a room.

  the drum is rationed.  One deep stroke on each chapter title and one on each
      flash cut in the picture -- which the film file already marks, so the
      sound is cut to the picture rather than guessed at. Eight or nine
      strokes in seven minutes. Nothing repeating, no pulse, no kit.

  the risers are the picture's.  Every flash in the film gets a riser ending
      exactly on it. They are the only thing in here that draws attention to
      itself, and they draw it to the cut rather than to the music.

  it sits low.  Mastered around -26 LUFS, which is six or seven below where a
      narration track wants to be, so the voice drops on top of this without
      anything being ducked.

    python3 score.py what-is-islam            the whole film, one wav
    python3 score.py what-is-islam --chapter 01
"""
import argparse, json, os, subprocess, sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "reels"))
import sound as S                                    # the reels' own engine
from spec import FPS

SR = S.SR
OUT = os.path.join(HERE, "out")

#  A, G, F, G, E, F, A -- a walk down and back. All in the first octave, where
#  the sub lives; the pad plays the same root two octaves up.
ROOTS = [55.000, 48.999, 43.654, 48.999, 41.203, 43.654, 55.000]

#  root, fifth, octave, ninth, twelfth, double octave. No third, ever.
CHORD = [(0, 0.42, 0.0, 6.0), (7, 0.30, 1.2, 7.0), (12, 0.26, 0.6, 6.5),
         (14, 0.17, 3.0, 8.0), (19, 0.13, 5.0, 9.0), (24, 0.09, 7.0, 10.0)]


def film(slug):
    with open(os.path.join(HERE, "films", slug + ".json"), encoding="utf-8") as f:
        return json.load(f)


def beat_clock(ch):
    """where each beat starts and how long it holds, in seconds -- the same
       arithmetic stage.js does, so the sound lands on the picture"""
    t, out = 0.0, []
    for b in ch.get("beats", []):
        h = max(1.2, float(b.get("hold", 4)))
        out.append({"at": t, "dur": h, "flash": b.get("enter") == "flash",
                    "title": b.get("kind") == "title"})
        t += h + float(b.get("gap", 0) or 0)
    return out, t


def _pluck(t, f, at, dur, rng, amp=1.0):
    """one struck note, and nothing like a drum.

    A bed made only of held chords is a drone, and a drone under seven minutes
    of narration is what "bare" means. What gives a long score life without
    giving it a beat is a struck note: a fast attack, a long exponential decay,
    two quiet partials above the fundamental and nothing below it. Placed
    sparsely and off the grid, half a dozen per chapter, it reads as music
    being played rather than a pad being held.
    """
    n = len(t)
    u = t - at
    live = (u >= 0) & (u < dur)
    if not live.any():
        return np.zeros(n, dtype=np.float32)
    uu = np.maximum(0.0, u)
    env = (1.0 - np.exp(-uu / 0.006)) * np.exp(-uu / (dur * 0.32)) * live
    w = np.sin(2 * np.pi * f * uu)
    w += 0.30 * np.sin(2 * np.pi * f * 2.0 * uu + 0.7)
    w += 0.12 * np.sin(2 * np.pi * f * 3.0 * uu + 1.9)
    w += 0.05 * np.sin(2 * np.pi * f * 4.02 * uu + 2.6)
    return (w * env * amp).astype(np.float32)


#  the suspended set, in semitones: no third anywhere, so nothing ever
#  resolves major or minor and nothing ever sounds like a cue
VOICE = [0, 7, 12, 14, 19, 24, 26, 31]


def chapter_score(ch, root, seed, first=False, last=False):
    marks, secs = beat_clock(ch)
    n = int(round(secs * SR))
    t = np.arange(n, dtype=np.float32) / SR
    rng = np.random.default_rng(seed)

    #  THE BED MOVES WITH THE ARGUMENT, NOT WITH THE CUTS.
    #  The first score put a drum on every title and every flash, which is why
    #  it sounded like sounds happening when words appeared: the music was
    #  marking the edit rather than the thought. The swell is built from the
    #  beat clock instead, opening where the chapter opens, thinning while the
    #  sentences do the work, and rising again into the chapter's last idea.
    swell = np.full(n, 0.34, dtype=np.float32)

    def ramp_to(a, b, v0, v1):
        i0, i1 = int(max(0.0, a) * SR), min(n, int(b * SR))
        if i1 <= i0:
            return
        u = np.linspace(0.0, 1.0, i1 - i0, dtype=np.float32)
        swell[i0:i1] = v0 + (v1 - v0) * (u * u * (3 - 2 * u))

    ramp_to(0.0, min(7.0, secs * 0.18), 0.08, 0.92)
    ramp_to(min(7.0, secs * 0.18), secs * 0.44, 0.92, 0.34)
    ramp_to(secs * 0.44, secs * 0.70, 0.34, 0.46)
    ramp_to(secs * 0.70, max(secs - 5.0, secs * 0.88), 0.46, 0.88)
    ramp_to(max(secs - 5.0, secs * 0.88), secs, 0.88, 0.06)

    open_env = np.clip(swell * 1.12, 0.0, 1.0)

    #  TWO CHORDS, NOT ONE.
    #  A chapter held on a single voicing for a minute and a quarter is a
    #  drone with a shape drawn on it. The second voicing lifts the fifth to a
    #  fourth and adds the eleventh, which moves without going anywhere: the
    #  harmony breathes, and still never resolves.
    CH_A = [(0, 0.42, 0.0, 6.0), (7, 0.30, 1.2, 7.0), (12, 0.26, 0.6, 6.5),
            (14, 0.17, 3.0, 8.0), (19, 0.13, 5.0, 9.0), (24, 0.09, 7.0, 10.0)]
    CH_B = [(0, 0.40, 0.0, 7.0), (5, 0.30, 0.4, 8.0), (12, 0.24, 0.4, 7.0),
            (17, 0.17, 2.0, 9.0), (19, 0.12, 4.0, 10.0), (26, 0.08, 6.0, 11.0)]
    padA = S._pad(t, root * 4.0, CH_A, open_env, rng)
    padB = S._pad(t, root * 4.0, CH_B, open_env, np.random.default_rng(seed + 5))
    turn = np.clip((t - secs * 0.46) / max(1e-6, secs * 0.26), 0.0, 1.0)
    turn = turn * turn * (3 - 2 * turn)
    pad = padA * (1.0 - turn) + padB * turn
    pad = pad * swell
    pad = np.stack([S._conv(pad[0], HALL), S._conv(pad[1], HALL)])

    sub = S._sub(t, root, swells=[], floor=0.62) * (0.44 + 0.32 * swell)
    sub = S._saturate_sub(sub)

    air = S._band(rng.standard_normal(n).astype(np.float32), 150, 2800) * 0.013
    air = air * (0.5 + 0.5 * S._lfo(t, 0.037, 0.4, 0.0, 1.0))

    left = pad[0] * 0.17 + sub * 0.21 + air
    right = pad[1] * 0.17 + sub * 0.21 + air * 0.93

    #  THE STRUCK NOTES.
    #  Placed on the openings of the longer beats, so they land with a thought
    #  rather than with an edit, and never closer together than four seconds.
    #  Six or seven in a chapter. The pitch walks the suspended set and comes
    #  back, which is a line without being a tune.
    #  AND THEY ARE PLACED ON THEIR OWN PULSE, NOT ON THE BEATS.
    #  The first attempt put them on the openings of the long beats, which is
    #  the same mistake as the drum in different clothes: a note that lands
    #  exactly when a sentence appears is heard as a sound effect for the
    #  sentence. Music has its own clock. These sit on a slow pulse of about
    #  six and a half seconds with a seeded wobble, so they drift against the
    #  edit and never once agree with it.
    pl = np.zeros(n, dtype=np.float32)
    pr = np.zeros(n, dtype=np.float32)
    k, at = 0, 3.1 + hash01(seed) * 1.8
    while at < secs - 4.0:
        deg = VOICE[(k * 3 + seed) % len(VOICE)]
        f = root * 8.0 * (2.0 ** (deg / 12.0))
        amp = 0.55 + 0.28 * hash01(seed + k)
        v = _pluck(t, f, at, 3.6, rng, amp)
        pan = 0.5 + 0.30 * (1 if k % 2 else -1)
        pl += v * (1.0 - pan) * 2.0
        pr += v * pan * 2.0
        k += 1
        at += 5.4 + hash01(seed * 7 + k) * 2.6
    pl = S._conv(pl, HALL) * 0.52 + pl * 0.48
    pr = S._conv(pr, HALL) * 0.52 + pr * 0.48
    left += pl * 0.185
    right += pr * 0.185

    #  ONE STROKE TO OPEN THE FILM AND ONE TO CLOSE IT, AND NONE IN BETWEEN.
    #  Nine of them in seven minutes was the "random sounds" problem: a drum
    #  that arrives on a cut teaches the ear to listen for cuts.
    def stroke_at(kind, at, gain):
        st = S._stroke(kind, rng=np.random.default_rng(seed + int(at * 97)))
        st = S._conv(st, HALL) * 0.58 + st * 0.42
        i = int(at * SR); j = min(n, i + len(st))
        if j > i:
            left[i:j] += st[: j - i] * gain
            right[i:j] += st[: j - i] * gain

    if first:
        stroke_at("boom", 0.35, 0.52)
    if last:
        stroke_at("deep", max(0.0, secs - 9.0), 0.46)

    return left, right


def hash01(i):
    n = (int(i) * 2654435761) & 0xFFFFFFFF
    n ^= n >> 13
    n = (n * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFFFF) / 4294967295.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--chapter", action="append")
    ap.add_argument("--lufs", type=float, default=-26.0)
    a = ap.parse_args()

    F = film(a.slug)
    chapters = F["chapters"]
    if a.chapter:
        want = tuple(a.chapter)
        chapters = [c for c in chapters if c["id"].startswith(want)]

    os.makedirs(OUT, exist_ok=True)
    L, R = [], []
    for i, ch in enumerate(chapters):
        root = ROOTS[i % len(ROOTS)]
        l, r = chapter_score(ch, root, seed=9173 + i * 131,
                             first=(i == 0), last=(i == len(chapters) - 1))
        print("    %-22s %5.1fs  root %.1f Hz" % (ch["id"], len(l) / SR, root))
        L.append(l); R.append(r)
    left = np.concatenate(L); right = np.concatenate(R)

    #  peak the whole film at about twelve decibels down before the glue, so
    #  the compressor's threshold means what it was written to mean
    pk = max(1e-9, float(max(np.abs(left).max(), np.abs(right).max())))
    left *= 0.25 / pk; right *= 0.25 / pk
    left, right = S._master(left, right, kind="light")
    left, right = S._limit(left, right)
    path = os.path.join(OUT, "%s-score.wav" % a.slug)
    S._write(path, left, right)

    #  set it where a narration track can sit on top of it without ducking
    have = S._lufs(path)
    if have is not None:
        gain = 10.0 ** ((a.lufs - have) / 20.0)
        S._write(path, left, right, gain=gain)
        print("    %.1f LUFS -> %.1f LUFS" % (have, a.lufs))
    print("    score -> " + path)


HALL = S._ir(secs=4.2, pre=0.034)

if __name__ == "__main__":
    sys.exit(main())
