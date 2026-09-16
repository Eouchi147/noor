#!/usr/bin/env python3
"""Render film one so that losing the machine costs seconds, not hours.

WHY THIS EXISTS

Two renders of this film "died silently" at frame 361 and frame 481. Neither
left an error, a traceback or an out-of-memory, and I spent a while looking for
a bug in the renderer. There is no bug. This session runs in a cloud sandbox
that is reclaimed after a stretch of inactivity, and when it goes, every
background process goes with it: PID 1 was 76 seconds old when the second
render "died", and the log had stopped 52 minutes earlier. The renderer was
killed by the machine being taken away, mid-pipe, with nothing written.

render.py pipes JPEG frames straight into ffmpeg's stdin, which is the right
design for a machine that stays up: no picture is ever carried through python
and nothing touches the disk twice. But a pipe holds the whole film hostage.
Kill it at frame 481 of 11488 and you have nothing at all.

So this writes each frame to disk first and encodes at the end. The bytes are
the same bytes -- the same JPEG at the same quality that render.py would have
pushed down the pipe -- so the finished picture is identical. What changes is
that the work is durable: a frame that exists is never rendered again, and a
machine that disappears costs one frame.

    python3 resume.py                 render until done, then encode
    python3 resume.py --budget 480    render for eight minutes and stop
    python3 resume.py --encode        skip rendering, just encode what is there
"""
import argparse, os, sys, time

from playwright.sync_api import sync_playwright

from render import Stage, film, FRAMES
from spec import FPS, JPEG_Q

HERE = os.path.dirname(os.path.abspath(__file__))
SLUG = "what-is-islam-recited"
CELLS = os.path.join(HERE, "out", SLUG + "-frames")
OUT = os.path.join(HERE, "out", "%s-the-film-wide.mp4" % SLUG)
MIN_BYTES = 2000            # a frame smaller than this was half written


def have(i):
    p = os.path.join(CELLS, "%06d.jpg" % i)
    try:
        return os.path.getsize(p) >= MIN_BYTES
    except OSError:
        return False


def missing(n):
    return [i for i in range(n) if not have(i)]


def encode(n, frame):
    import subprocess
    if missing(n):
        sys.exit("not encoding: %d frames are still missing" % len(missing(n)))
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
           "-framerate", str(FPS), "-i", os.path.join(CELLS, "%06d.jpg"),
           # THE GRAIN WAS THE PIXELATION.
           #
           # Measured on one frame, same 420x500 crop of the dark ground: the
           # rendered JPEG has a neighbour-to-neighbour roughness of 0.126 and
           # the encoded file 0.749, six times more. The renderer's background
           # is smooth; noise=alls=2 was printing texture onto it, and on a
           # frame that is nine tenths near-black that reads as pixelation.
           #
           # The grain was there to dither the banding that 8-bit gives a dark
           # gradient. The cheaper answer is to stop throwing away the gradient
           # in the first place: CRF 16 instead of 19, and let x264's own
           # psy-trellis hold the smooth areas. Costs bitrate, buys a clean sky.
           "-an", "-c:v", "libx264", "-preset", "slower", "-crf", "16",
           "-x264-params", "aq-mode=3:aq-strength=1.0:deblock=1,1:psy-rd=0.8,0.15",
           "-pix_fmt", "yuv420p", "-color_primaries", "bt709",
           "-color_trc", "bt709", "-colorspace", "bt709",
           "-movflags", "+faststart", "-r", str(FPS),
           "-vf", "scale=%d:%d" % (frame["w"], frame["h"]), OUT]
    print("encoding %d frames -> %s" % (n, os.path.basename(OUT)), flush=True)
    r = subprocess.run(cmd)
    if r.returncode:
        sys.exit("ffmpeg refused")
    print("film  %.1f MB" % (os.path.getsize(OUT) / 1e6), flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--budget", type=float, default=0.0, help="seconds to render before stopping")
    ap.add_argument("--encode", action="store_true")
    # Two workers on two cores. Frames are independent -- the timeline is built
    # paused and seeked per frame -- so the only thing stopping us splitting the
    # work is two processes racing for the same frame. Striding gives each
    # worker its own arithmetic progression of the missing list, so they never
    # meet, and the atomic rename means a frame either exists whole or not at all.
    ap.add_argument("--stride", type=int, default=1)
    ap.add_argument("--offset", type=int, default=0)
    a = ap.parse_args()

    os.makedirs(CELLS, exist_ok=True)
    F = film(SLUG)
    ch = F["chapters"][0]
    frame = FRAMES["wide"]

    with sync_playwright() as pw:
        st = Stage(pw, frame)
        try:
            info = st.build(ch)
            n = int(round(info["duration"] / 1000.0 * FPS))
            todo = missing(n)
            print("%d frames, %d already on disk, %d to go" % (n, n - len(todo), len(todo)), flush=True)
            if a.stride > 1:
                todo = todo[a.offset::a.stride]
                print("worker %d/%d takes %d of them" % (a.offset + 1, a.stride, len(todo)), flush=True)

            if a.encode:
                st.close()
                return encode(n, frame)

            t0 = time.time()
            done = 0
            for i in todo:
                if a.budget and time.time() - t0 > a.budget:
                    print("\nbudget reached, stopping clean", flush=True)
                    break
                buf = st.shot(i * 1000.0 / FPS)
                # written beside and renamed, so a machine that dies mid-write
                # leaves no half frame for the next run to trust
                tmp = os.path.join(CELLS, ".%06d.part" % i)
                with open(tmp, "wb") as f:
                    f.write(buf)
                os.replace(tmp, os.path.join(CELLS, "%06d.jpg" % i))
                done += 1
                if done % 25 == 0:
                    per = (time.time() - t0) / done
                    left = len(todo) - done
                    sys.stdout.write("\r  worker %d: %5d done  %5d left  %4.0f ms/frame"
                                     % (a.offset + 1, done, left, per * 1000))
                    sys.stdout.flush()
            print(flush=True)
        finally:
            st.close()

    left = missing(n)
    if left:
        print("%d frames still missing, run again" % len(left), flush=True)
        return 1
    encode(n, frame)
    return 0


if __name__ == "__main__":
    sys.exit(main())
