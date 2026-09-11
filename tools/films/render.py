#!/usr/bin/env python3
"""NOOR · render a film, wide and tall, from one description.

    python3 render.py what-is-islam                  every chapter, both frames
    python3 render.py what-is-islam --frame wide     one frame shape
    python3 render.py what-is-islam --chapter 01     one chapter
    python3 render.py what-is-islam --still 2400     one frame, to look at

The browser never plays the film. The timeline is built PAUSED and seeked to
an exact millisecond for each frame, the ground is drawn from the same
millisecond, and one screenshot is the finished frame. That is what makes two
renders of the same film identical, and what lets a slow machine make a slow
render rather than a dropped frame.

Chapters are rendered as separate segments and concatenated, so a chapter that
changes costs one chapter and not a film. Both frame shapes come off the same
description: nothing is cropped.
"""
import argparse, json, os, subprocess, sys, time

from playwright.sync_api import sync_playwright
from spec import FPS, FRAMES, JPEG_Q, LUME_SS

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = "file://" + os.path.join(HERE, "web", "film.html")
OUT = os.path.join(HERE, "out")


def film(slug):
    p = os.path.join(HERE, "films", slug + ".json")
    with open(p, encoding="utf-8") as f:
        return json.load(f)


class Stage:
    """one page, held open for a whole render"""

    def __init__(self, pw, frame):
        self.f = frame
        #  ASKING FOR ANGLE COST MORE THAN TWICE THE RENDER AND MADE THE
        #  PICTURE WORSE.
        #
        #  These flags were added to be sure WebGL would come up on a runner
        #  with no GPU. It comes up without them: Chromium falls back to
        #  SwiftShader on its own and reports WebGL 2.0 either way. What the
        #  flags changed was the path the whole PAGE is composited and read
        #  back through, and the screenshot is nearly all of the frame time.
        #  Measured on this runner, same page, same frame, ten frames each:
        #
        #      --use-gl=angle --use-angle=swiftshader ...    453 ms a frame
        #      --enable-unsafe-swiftshader only             192 ms a frame
        #
        #  The drawing itself is 5 ms of that. It is worth knowing which half
        #  of a render is the picture and which half is the photograph of it.
        #  The one flag that stays lets a software WebGL context be created
        #  at all, which newer Chromium refuses without it.
        self.b = pw.chromium.launch(args=[
            "--force-color-profile=srgb", "--font-render-hinting=none",
            "--enable-unsafe-swiftshader"])
        self.p = self.b.new_page(viewport={"width": frame["w"], "height": frame["h"]},
                                 device_scale_factor=1)
        self.errs = []
        self.p.on("pageerror", lambda e: self.errs.append(str(e)))
        self.p.goto(PAGE)
        # every face fetched now, not on first use: a font-display:block face
        # loads when text first asks for it, and the first beat set in Amiri
        # would otherwise be measured against the fallback's metrics
        self.p.evaluate("() => Promise.all(Array.from(document.fonts).map(f => f.load()))")
        self.p.wait_for_function("() => document.fonts.status === 'loaded'")
        if self.errs:
            raise RuntimeError("the stage did not load cleanly: " + self.errs[0])
        self.p.evaluate("() => NOORGROUND.size()")
        #  The scene is drawn into a buffer LUME_SS times the frame in each
        #  direction and boxed down to it by the resolve shader. The canvas the
        #  page composites is exactly the frame, which is the only size that
        #  costs anything -- see the measurements in web/lume.js.
        self.p.evaluate("n => NOORLUME.supersample(n)", LUME_SS)
        self.p.evaluate("n => NOORLUME.frame(n)", frame["name"])

    def build(self, chapter):
        info = self.p.evaluate("([c, f]) => NOORFILM.build(c, f)", [chapter, self.f["name"]])
        if self.errs:
            raise RuntimeError("the chapter did not build: " + self.errs[0])
        return info

    def shot(self, ms):
        self.p.evaluate("t => NOORFILM.seek(t)", ms)
        return self.p.screenshot(type="jpeg", quality=JPEG_Q)

    def close(self):
        self.b.close()


def encode(frames_iter, path, frame, n):
    """the frames go to ffmpeg as JPEG on stdin; the encoder decodes them
       itself, so no picture is ever carried through python"""
    #  WHY THE VIDEO LOOKED WORSE THAN THE STILLS
    #
    #  Two reasons, and the grain was the larger one. noise=alls=7:allf=t+u is
    #  a heavy grain -- a seventh of full scale, spatial AND temporal -- and on
    #  a picture that is nine tenths near-black it does two bad things at once:
    #  it sits on top of the soft falloff of every glow, and it is
    #  incompressible, so it ate the bitrate that the gradients needed and
    #  left them to band. Twenty eight seconds came to 160 MB and still looked
    #  worse than a PNG of one frame of it.
    #
    #  A little grain is still the right answer for eight-bit video: it is what
    #  stops a dark gradient stepping. But it wants to be a third of what it
    #  was and temporal only, so it dithers the banding without printing a
    #  texture over the light. With the weight off, CRF can come down too.
    #
    #  The other reason was mine: I was sending a re-encode of the master
    #  rather than the master. Two generations of H.264 on a dark picture is
    #  visible. Encode once, at quality, and hand over that file.
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
           "-f", "image2pipe", "-vcodec", "mjpeg", "-r", str(FPS), "-i", "-",
           #  CRF 15 on this material is about nineteen megabits, which is a
           #  third of a gigabyte for four minutes -- and the only way a file
           #  that size reaches the person it is for is in seventeen pieces.
           #  19 with a slower preset is visually the same picture on a dark
           #  animated frame and a third of the bytes. The encoder gets the
           #  time back because rendering the frames costs two hundred times
           #  more than compressing them.
           "-an", "-c:v", "libx264", "-preset", "slower", "-crf", "19",
           "-x264-params", "aq-mode=3:aq-strength=1.1:deblock=-1,-1",
           "-pix_fmt", "yuv420p", "-color_primaries", "bt709",
           "-color_trc", "bt709", "-colorspace", "bt709",
           "-movflags", "+faststart", "-r", str(FPS),
           "-vf", "scale=%d:%d,noise=alls=2:allf=t" % (frame["w"], frame["h"]), path]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    for i, buf in enumerate(frames_iter):
        pr.stdin.write(buf)
        if n and (i % 60 == 0):
            done = i + 1
            per = (time.time() - t0) / done
            sys.stdout.write("\r      %5d / %d  %4.0f ms/frame  eta %4.1f min" %
                             (done, n, per * 1000, per * (n - done) / 60))
            sys.stdout.flush()
    pr.stdin.close()
    pr.wait()
    if n:
        sys.stdout.write("\r" + " " * 72 + "\r")
    return pr.returncode == 0


def render_chapter(stage, ch, out_path):
    info = stage.build(ch)
    dur = info["duration"]
    n = int(round(dur / 1000.0 * FPS))
    print("    %-16s %5.1fs  %4d frames  %d beats" % (ch["id"], dur / 1000.0, n, info["beats"]))

    def frames():
        for i in range(n):
            yield stage.shot(i * 1000.0 / FPS)

    ok = encode(frames(), out_path, stage.f, n)
    if stage.errs:
        raise RuntimeError("the chapter threw while rendering: " + stage.errs[0])
    return ok, dur


def concat(paths, out_path):
    lst = out_path + ".txt"
    with open(lst, "w", encoding="utf-8") as f:
        for p in paths:
            f.write("file '%s'\n" % os.path.abspath(p))
    r = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                        "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", out_path])
    os.remove(lst)
    return r.returncode == 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--frame", choices=["wide", "tall"], action="append")
    ap.add_argument("--chapter", action="append")
    ap.add_argument("--still", type=float, help="one frame at this millisecond, as a PNG")
    a = ap.parse_args()

    F = film(a.slug)
    chapters = F["chapters"]
    if a.chapter:
        want = tuple(a.chapter)
        chapters = [c for c in chapters if c["id"].startswith(want)]
        if not chapters:
            sys.exit("no chapter matches " + ", ".join(a.chapter))
    frames = [FRAMES[n] for n in (a.frame or ["wide", "tall"])]

    os.makedirs(OUT, exist_ok=True)
    print("%s · %s" % (F["title"], F["slug"]))

    with sync_playwright() as pw:
        for fr in frames:
            print("  %s  %dx%d" % (fr["name"], fr["w"], fr["h"]))
            st = Stage(pw, fr)
            try:
                if a.still is not None:
                    st.build(chapters[0])
                    png = os.path.join(OUT, "%s-%s-%s-%dms.png" %
                                       (a.slug, chapters[0]["id"], fr["name"], int(a.still)))
                    st.p.evaluate("t => NOORFILM.seek(t)", a.still)
                    st.p.screenshot(path=png)
                    print("    still -> " + png)
                    continue
                segs = []
                for ch in chapters:
                    seg = os.path.join(OUT, "%s-%s-%s.mp4" % (a.slug, ch["id"], fr["name"]))
                    ok, _ = render_chapter(st, ch, seg)
                    if not ok:
                        sys.exit("ffmpeg refused " + seg)
                    segs.append(seg)
                if len(segs) > 1:
                    whole = os.path.join(OUT, "%s-%s.mp4" % (a.slug, fr["name"]))
                    concat(segs, whole)
                    print("    film  -> " + whole)
                else:
                    print("    film  -> " + segs[0])
            finally:
                st.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
