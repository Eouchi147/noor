#!/usr/bin/env python3
"""NOOR · render a film on this Mac, on the GPU.

    python3 noor.py                          film one, 60 fps, every frame
    python3 noor.py --clip 60 92             only seconds 60 to 92
    python3 noor.py --clip 60 92 --encode    ...and stitch it, in one go
    python3 noor.py --film lantern-ink       one of the direction shorts
    python3 noor.py --stills 8 41 64 155     a few PNGs to look at, no video
    python3 noor.py --encode                 stitch what is on disk

WHY IT IS FAST HERE
The cloud box has two cores and no graphics card, so WebGL there runs in
software and a frame costs about 1.3 seconds.  Chromium on Apple Silicon puts
WebGL on the GPU through Metal, and there are ten cores to run workers on.
Measured: 11 ms a frame.  The software fallback flag is deliberately NOT
passed, so if Metal ever fails you will see it fail rather than quietly drop
onto the slow path.

Frames are one file each and are never redone, so control-C and start again
picks up exactly where it stopped.
"""
import argparse, glob, json, os, re, subprocess, sys, time
from multiprocessing import Process, cpu_count

HERE = os.path.dirname(os.path.abspath(__file__))
MIN_BYTES = 2000

# Metal, not SwiftShader. This is the whole point of running here.
GPU_ARGS = [
    "--force-color-profile=srgb",
    "--font-render-hinting=none",
    "--use-angle=metal",
    "--enable-gpu",
    "--ignore-gpu-blocklist",
    "--enable-features=Vulkan,CanvasOopRasterization",
]


def stamp(slug):
    """A short hash of everything that decides what a frame looks like.

    Frames used to be keyed on slug, shape and fps. Nothing else. So the
    cache could not tell that the film had been rewritten or the engine
    fixed: have() saw a file of the right name and kept it. Change one beat,
    re-run, and you got a film that was half the old cut and half the new
    one, with no warning and no way to notice except by watching all eight
    minutes. --fresh existed to work around exactly this, which meant the
    safe thing was the thing you had to remember to type.

    Now the description and the engine are in the key. An edit gets its own
    cache automatically, and re-running something unchanged still resumes
    frame for frame, which is the only behaviour worth having."""
    import hashlib
    h = hashlib.blake2b(digest_size=5)
    parts = [os.path.join(HERE, "films", slug + ".json"),
             os.path.join(HERE, "films", slug + ".envelope.json"),
             os.path.join(HERE, "web", "film.html"),
             os.path.join(HERE, "spec.py")]
    #  three.min.js and anime.min.js are vendored and never edited, and they
    #  are 800 kB to hash on every worker start. Skipped on purpose.
    parts += [p for p in sorted(glob.glob(os.path.join(HERE, "web", "*.js")))
              if not os.path.basename(p).endswith(".min.js")]
    for p in parts:
        try:
            with open(p, "rb") as fh:
                h.update(fh.read())
        except OSError:
            pass
    h.update(str(os.environ.get("NOOR_SS", "")).encode())
    return h.hexdigest()


def cells(slug, shape, fps):
    return os.path.join(HERE, "frames",
                        "%s-%s-%dfps-%s" % (slug, shape, fps, stamp(slug)))


def have(d, i):
    try:
        return os.path.getsize(os.path.join(d, "%06d.jpg" % i)) >= MIN_BYTES
    except OSError:
        return False


def plan(slug, fps):
    """Every frame of the film, as (index, chapter index, millisecond in it).

    The film is one continuous take by design, but nothing here assumes one
    chapter: the frame index runs across the whole film and each chapter
    contributes the frames that land inside it."""
    sys.path.insert(0, HERE)
    from render import film
    F = film(slug)
    out, i = [], 0
    for ci, ch in enumerate(F["chapters"]):
        #  EXACTLY WHAT stage.js DOES, or the film ends early.
        #  This was sum(hold)*1000: no 1.2 s floor and, worse, no `gap`. One
        #  beat with "gap": 0.5 at 60 fps meant the last thirty frames were
        #  never asked for, the seek clamps at DUR, and the file simply
        #  ended half a second short with nothing reporting it.
        dur = 0.0
        for b in ch["beats"]:
            dur += max(1200.0, round(b.get("hold", 4) * 1000.0))
            dur += round(b.get("gap", 0) * 1000.0)
        #  AND THE LAST BEAT'S FADE OUT, which begins at the end of its
        #  hold. Without this the renderer stops one frame before the
        #  fade starts, so every chapter ended on a card at full
        #  brightness and simply stopped. Mirrors FADE in web/stage.js;
        #  if you change it there, change it here.
        FADE = {"cut": 1, "dissolve": 700, "flash": 700, "slow": 1000}
        if ch["beats"]:
            dur += FADE.get(ch["beats"][-1].get("exit", "dissolve"), 700)
        n = int(round(dur / 1000.0 * fps))
        for k in range(n):
            out.append((i, ci, k * 1000.0 / fps)); i += 1
    return F, out


#  THE SHUTTER.
#  A frame of film is not an instant, it is an exposure: the shutter is open
#  for half the frame interval on a 180 degree disc, and whatever moved
#  during that time is smeared across the frame. That smear is most of what
#  separates footage from animation -- it is why a 60 fps game looks like a
#  game and a 24 fps film looks like a film even though the film has fewer
#  frames. The renderer seeks to an exact millisecond, so it can only ever
#  make instants; the exposure has to be built by taking several instants
#  across the open shutter and averaging them, which is exactly what a
#  renderer with no analytic motion vectors should do.
#
#  Three samples over a 180 degree shutter is enough at 60 fps: the head of
#  the stream moves a few pixels between them. It costs three screenshots
#  instead of one, and on an M4 a screenshot is most of eleven milliseconds,
#  so it is the difference between two minutes and six for the whole film.
SHUTTER_DEG = 180.0


def expose(st, ms, frame_ms, n, deg):
    """One frame, as an exposure rather than an instant."""
    if n <= 1:
        return st.shot(ms)
    import io
    try:
        import numpy as np
        from PIL import Image
    except ImportError:
        sys.exit("the shutter needs numpy and pillow:\n"
                 "    pip install numpy pillow\n"
                 "or run with --shutter 1 to render instants instead of exposures.")
    open_ms = frame_ms * (deg / 360.0)
    acc = None
    for k in range(n):
        t = ms + (k / float(n - 1) - 0.5) * open_ms
        a = np.asarray(Image.open(io.BytesIO(st.shot(max(0.0, t)))).convert("RGB"), dtype=np.float32)
        acc = a if acc is None else acc + a
    out = Image.fromarray(np.rint(acc / n).astype("uint8"))
    b = io.BytesIO()
    out.save(b, "JPEG", quality=93, subsampling=0)
    return b.getvalue()


def worker(off, stride, slug, shape, fps, lo, hi, budget, shutter):
    from playwright.sync_api import sync_playwright
    sys.path.insert(0, HERE)
    from render import Stage, film
    from spec import FRAMES

    F, frames = plan(slug, fps)
    d = cells(slug, shape, fps)
    #  PARTITION ON THE FRAME NUMBER, NOT ON POSITION IN THE LIST.
    #  Each worker builds this list itself, and on a resume they build it at
    #  different moments while worker 0 is already writing, so they saw
    #  different lists and [off::stride] carved them differently. Simulated
    #  at the real frame count with eight workers: eighty frames covered by
    #  nobody, sixty rendered twice. The frame number is the same in every
    #  process no matter when it looks.
    todo = [f for f in frames
            if lo <= f[0] <= hi and f[0] % stride == off and not have(d, f[0])]
    if not todo:
        return
    frame = FRAMES[shape]
    with sync_playwright() as pw:
        orig = pw.chromium.launch
        pw.chromium.launch = lambda **kw: orig(args=GPU_ARGS)
        st = Stage(pw, frame)
        built = None
        try:
            t0 = time.time()
            for k, (i, ci, ms) in enumerate(todo):
                if budget and time.time() - t0 > budget:
                    break
                if built != ci:
                    st.build(F["chapters"][ci]); built = ci
                #  A PAGE ERROR MUST NOT BECOME A CACHED FRAME.
                #  render.py checks st.errs; this file never did. A JS
                #  exception mid-render leaves the page showing the last
                #  thing it painted, that screenshot is 30 kB or more, so
                #  have() keeps it and the wrong picture is baked in for
                #  good. Fail on the first one instead.
                if st.errs:
                    raise RuntimeError("frame %d: %s" % (i, st.errs[0]))
                buf = expose(st, ms, 1000.0 / fps, shutter, SHUTTER_DEG)
                tmp = os.path.join(d, ".%06d.part" % i)
                with open(tmp, "wb") as fh:
                    fh.write(buf)
                os.replace(tmp, os.path.join(d, "%06d.jpg" % i))
                if off == 0 and k and k % 50 == 0:
                    print("  %d done, %.0f ms/frame" % (k, (time.time() - t0) / k * 1000), flush=True)
        finally:
            st.close()


def stills(slug, shape, fps, secs):
    from playwright.sync_api import sync_playwright
    sys.path.insert(0, HERE)
    from render import Stage, film
    from spec import FRAMES
    F = film(slug)
    d = os.path.join(HERE, "stills"); os.makedirs(d, exist_ok=True)
    with sync_playwright() as pw:
        orig = pw.chromium.launch
        pw.chromium.launch = lambda **kw: orig(args=GPU_ARGS)
        st = Stage(pw, FRAMES[shape])
        try:
            st.build(F["chapters"][0])
            for s in secs:
                p = os.path.join(d, "%s-%s-%06dms.png" % (slug, shape, int(s * 1000)))
                st.p.evaluate("t => NOORFILM.seek(t)", s * 1000.0)
                st.p.screenshot(path=p)
                print("  " + p, flush=True)
        finally:
            st.close()


def encode(slug, shape, fps, lo, hi, tag):
    from spec import FRAMES
    d, fr = cells(slug, shape, fps), FRAMES[shape]
    #  ONLY SIX DIGITS AND .jpg IS A FRAME.
    #  This folder lives on an iCloud synced Desktop, and iCloud resolves a
    #  write it thinks is a conflict by keeping both and calling the second
    #  one "003483 2.jpg". ffmpeg would never see it -- it reads the numbered
    #  sequence -- but int("003483 2") is a crash, and a crash after an
    #  eighty five second render is a bad way to find out. Strays are counted
    #  and removed rather than tripped over.
    keep = re.compile(r"^(\d{6})\.jpg$")
    stray = [f for f in os.listdir(d) if f.endswith(".jpg") and not keep.match(f)]
    for f in stray:
        try:
            os.remove(os.path.join(d, f))
        except OSError:
            pass
    if stray:
        print("removed %d duplicate frames left behind by iCloud (e.g. %s)"
              % (len(stray), stray[0]), flush=True)
    idx = sorted(int(keep.match(f).group(1)) for f in os.listdir(d) if keep.match(f))
    idx = [i for i in idx if lo <= i <= hi]
    if not idx:
        sys.exit("no frames in that range yet")
    gaps = [i for i in range(min(idx), max(idx) + 1) if not have(d, i)]
    if gaps:
        sys.exit("%d frames still missing (first %d); render before encoding" % (len(gaps), gaps[0]))
    out = os.path.join(HERE, "%s-%s-%dfps%s.mp4" % (slug, shape, fps, tag))
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
           "-framerate", str(fps), "-start_number", str(min(idx)),
           "-i", os.path.join(d, "%06d.jpg"),
           "-frames:v", str(len(idx)),
           "-an", "-c:v", "libx264", "-preset", "slower", "-crf", "16",
           # NO NOISE FILTER.  Grain is drawn in the render now, on the ground
           # and nothing else.  Adding it here put it over the gold and the
           # type as well, and x264 then spent its bitrate describing it,
           # which is what read as pixelation.
           "-x264-params", "aq-mode=3:aq-strength=1.0:deblock=1,1:psy-rd=0.8,0.15",
           "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709",
           "-colorspace", "bt709", "-movflags", "+faststart", "-r", str(fps),
           "-vf", "scale=%d:%d" % (fr["w"], fr["h"]), out]
    print("encoding %d frames at %d fps" % (len(idx), fps), flush=True)
    if subprocess.run(cmd).returncode:
        sys.exit("ffmpeg refused")
    print("done -> %s  (%.1f MB)" % (out, os.path.getsize(out) / 1e6))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--film", default="what-is-islam-recited")
    ap.add_argument("--shape", default="wide", choices=["wide", "tall"])
    ap.add_argument("--fps", type=int, default=60)
    ap.add_argument("--clip", type=float, nargs=2, metavar=("FROM", "TO"),
                    help="seconds; render or encode only this stretch")
    ap.add_argument("--workers", type=int, default=max(2, cpu_count() - 2))
    ap.add_argument("--budget", type=float, default=0.0)
    ap.add_argument("--encode", action="store_true")
    ap.add_argument("--stills", type=float, nargs="+", metavar="SEC")
    ap.add_argument("--shutter", type=int, default=3, metavar="N",
                    help="samples across the open shutter: real motion blur. "
                         "3 is the default, 1 turns it off, 5 for a fast whip pan.")
    ap.add_argument("--fresh", action="store_true",
                    help="throw away the frames already on disk for this film first. "
                         "Use it after the look changes, or you will re-encode old frames.")
    ap.add_argument("--cells", action="store_true",
                    help="print the frames directory this film and shape would "
                         "use right now, then stop. plates.sh asks with this so "
                         "it can drop a film's older frame generations without "
                         "reimplementing the cache key and drifting from it.")
    a = ap.parse_args()

    #  A QUESTION, NOT A RENDER. Answered before anything is created, so asking
    #  where the frames would go never brings that directory into being.
    if a.cells:
        print(cells(a.film, a.shape, a.fps))
        return

    sys.path.insert(0, HERE)
    if a.stills:
        return stills(a.film, a.shape, a.fps, a.stills)

    d = cells(a.film, a.shape, a.fps)
    if a.fresh and os.path.isdir(d):
        gone = 0
        for f in os.listdir(d):
            if f.endswith(".jpg") or f.endswith(".part") or f.endswith(".part 2"):
                os.remove(os.path.join(d, f)); gone += 1
        print("cleared %d old frames" % gone, flush=True)
    os.makedirs(d, exist_ok=True)
    F, frames = plan(a.film, a.fps)
    total = len(frames)
    lo, hi, tag = 0, total - 1, ""
    if a.clip:
        #  round, not truncate: int(29.7 * 60) is 1781, not 1782, because
        #  29.7 has no exact binary form. And TO is exclusive, so --clip 60
        #  92 is thirty two seconds and not thirty two and one frame.
        lo = max(0, int(round(a.clip[0] * a.fps)))
        hi = min(int(round(a.clip[1] * a.fps)) - 1, total - 1)
        tag = "-%gs-%gs" % (a.clip[0], a.clip[1])

    want = hi - lo + 1
    done = sum(1 for i in range(lo, hi + 1) if have(d, i))
    if done < want:
        print("%s · %s · %d fps · %d frames (%.1f s), shutter %d, %d already on disk, %d workers of %d cores"
              % (a.film, a.shape, a.fps, want, want / float(a.fps), max(1, a.shutter), done, a.workers, cpu_count()), flush=True)
        t0 = time.time()
        ps = [Process(target=worker, args=(w, a.workers, a.film, a.shape, a.fps, lo, hi, a.budget, max(1, a.shutter)))
              for w in range(a.workers)]
        [p.start() for p in ps]
        [p.join() for p in ps]
        #  a worker that dies on a page error, a Playwright timeout or
        #  memory pressure used to contribute nothing and say nothing, and
        #  the run reported the same "run again" as a normal partial pass
        dead = [w for w, p in enumerate(ps) if p.exitcode]
        if dead:
            print("\n  workers %s exited badly (%s). Scroll up for the reason."
                  % (dead, [ps[w].exitcode for w in dead]), flush=True)
        now = sum(1 for i in range(lo, hi + 1) if have(d, i))
        made, dt = now - done, time.time() - t0
        print("\n%d frames in %.0f s  (%.0f ms/frame across all workers)"
              % (made, dt, dt / max(1, made) * 1000), flush=True)
        if now < want:
            print("%d of %d. Run the same command again to continue." % (now, want))
            return
    if a.encode:
        encode(a.film, a.shape, a.fps, lo, hi, tag)
    else:
        print("all %d frames are on disk. Add --encode to stitch them." % want)


if __name__ == "__main__":
    main()
