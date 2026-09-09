#!/usr/bin/env python3
"""NOOR reel · render the browser's frame: the shader picture and the type.

The picture is a fragment shader (web/scene.js) and the words are anime.js
(web/type.js), both in one headless page. The timeline never plays: it is
built paused and seeked to an exact millisecond for each frame, the shader is
told what that instant is (the cue, the blooms, the reciter's loudness), and
one screenshot is the finished frame. It goes to ffmpeg as JPEG; the encoder
decodes it itself, so nothing passes through numpy on the way.

    python3 webreel.py                  render every card in plan.json
    python3 webreel.py sufi shatir      render some of them
    python3 webreel.py --audit          only check the safe area
"""
import base64, io, json, math, os, subprocess, sys, tempfile, time
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

import sound
import verses
from spec import W, H, FPS, SAFE_TOP, SAFE_BOTTOM, SAFE_L, SAFE_R, ease

MAX_SECS = 58.0          # Instagram takes up to 90; nobody watches 90
CENTRED = ("word", "verse", "name", "dua")   # every kind is centred now
JPEG_Q = 94              # the frames go to ffmpeg as JPEG: the encoder decodes them itself

PAGE = "file://" + os.path.join(os.path.dirname(os.path.abspath(__file__)), "web", "type.html")

_SCRIM = {}   # kept for callers that clear it; the ground is drawn by the shader now


class Stage:
    """one page, held open for the length of a render"""
    def __init__(self, pw):
        # the picture is a WebGL shader; on a machine with no GPU, which is
        # every runner, Chromium draws it with SwiftShader on the CPU
        self.b = pw.chromium.launch(args=["--force-color-profile=srgb",
                                          "--font-render-hinting=none",
                                          "--use-gl=angle", "--use-angle=swiftshader",
                                          "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        self.p = self.b.new_page(viewport={"width": W, "height": H},
                                 device_scale_factor=1)
        self.errs = []
        self.p.on("pageerror", lambda e: self.errs.append(str(e)))
        self.p.goto(PAGE)
        # every face the page declares, fetched now and not on first use: a
        # font-display:block face is only loaded when text first asks for it,
        # so the first card set in Amiri or the mono was measured against the
        # fallback's metrics, and stood a pixel from where every later card
        # in the same page stood. Now the first build is like every other.
        self.p.evaluate("() => Promise.all(Array.from(document.fonts).map(f => f.load()))")
        self.p.wait_for_function("() => document.fonts.status === 'loaded' && "
                                 "Array.from(document.fonts).every(f => f.status === 'loaded')")
        if self.errs: raise RuntimeError("the page did not load cleanly: " + self.errs[0])
        # the picture must exist before a single card is built; a browser
        # without WebGL fails here, loudly, not as 300 unfit cards
        info = self.p.evaluate("() => { NOORSCENE.init(); return NOORSCENE.info(); }")
        if not info or not info.get("ok"): raise RuntimeError("no picture: " + str(info))
        self.gl = info
        self.cdp = None

    def build(self, card, secs):
        """build, then step the type down until the resting column clears"""
        self.errs = []
        info = self.p.evaluate("([c,s])=>NOORREEL.build(c,s)", [card, secs])
        if self.errs: raise SystemExit("type layer failed: " + self.errs[0])
        for _ in range(14):
            bottom = self.p.evaluate("() => NOORREEL.rest()")
            if bottom <= SAFE_BOTTOM - 24: break
            if not self.p.evaluate("() => NOORREEL.shrink()"): break
        info = self.p.evaluate("() => NOORREEL.info()")
        info["bottom"] = self.p.evaluate("() => NOORREEL.rest()")
        return info

    def at(self, t):
        """the type alone, with alpha: for the safe-area audit"""
        self.p.evaluate("t=>NOORREEL.seek(t)", t)
        return Image.open(io.BytesIO(self._png())).convert("RGBA")

    def _png(self):
        """the viewport as a lossless PNG with a transparent ground.

        Playwright's own screenshot() does the same capture, but has Chromium
        compress the PNG at its default level, and on a still frame full of
        type that is half of what the frame costs. Asked through the protocol
        directly with optimizeForSpeed the encoder takes its fast level: the
        same pixels, byte for byte once decoded, sooner by half on such a
        frame and by a tenth on a blurred one, where the paint is the cost.
        A Chromium that does not know the flag gets the slow path, not an
        error.
        """
        if self.cdp is None:
            try: self.cdp = self.p.context.new_cdp_session(self.p)
            except Exception: self.cdp = False
        if self.cdp:
            try:
                self.cdp.send("Emulation.setDefaultBackgroundColorOverride",
                              {"color": {"r": 0, "g": 0, "b": 0, "a": 0}})
                try:
                    return base64.b64decode(self.cdp.send(
                        "Page.captureScreenshot", {"format": "png", "optimizeForSpeed": True})["data"])
                finally:
                    self.cdp.send("Emulation.setDefaultBackgroundColorOverride", {})
            except Exception:
                self.cdp = False       # not understood here: the slow path from now on
        return self.p.screenshot(omit_background=True, type="png")

    def cues(self):
        """every moment the built timeline moves something: see NOORREEL.cues"""
        return self.p.evaluate("() => NOORREEL.cues()")

    def frame(self, t):
        """the finished frame, picture and words, as JPEG bytes"""
        self.p.evaluate("t=>NOORREEL.seek(t)", t)
        return self.p.screenshot(type="jpeg", quality=JPEG_Q)

    def pulse(self, env, start, fps=FPS):
        self.p.evaluate("([a,s,f])=>NOORREEL.pulse(a,s,f)", [[float(x) for x in env], start, fps])

    def close(self):
        self.b.close()


PLAN = None

def plan():
    """the reviewed file: copy and look for every card, one entry each"""
    global PLAN
    if PLAN is None:
        PLAN = json.load(open(os.environ.get("NOOR_PLAN") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "plan.json")))["cards"]
    return PLAN


KIND_FIELDS = {
    "light": ("hook", "key", "date", "lines"),
    "know":  ("hook", "key", "date", "lines"),
    "day":   ("num", "month", "ar", "hook", "key", "lines", "todo"),
    "word":  ("ar", "term", "short", "long"),
    "name":  ("ar", "translit", "meaning", "line"),
    "dua":   ("ar", "translit", "meaning", "line"),
    "verse": ("ar", "ref", "sents", "reciter", "verse"),
}


def kind_of(c):
    return c.get("kind", "light")


def look(name):
    """(look, card) for one card id"""
    c = plan()[name]
    kind = kind_of(c)
    card = {k: c[k] for k in KIND_FIELDS[kind] if k in c}
    if kind == "verse":
        card.update(verses.card_text(c))
    card["kind"] = kind
    lk = dict(c["look"])
    card["look"] = lk
    if kind == "day": card["hm"] = c.get("hm", 1)
    return lk, card


def prepare(stage, name, secs=None):
    """build the type layer once, and hand back everything the render needs.

    Split out of frames() because the sound has to be written before ffmpeg
    starts, and the sound is placed from the timeline this build reports.

    One verse is built around its recitation: the audio is fetched (or found
    in the cache), trimmed and measured first, so the type knows how long the
    voice lasts, the reel's length follows from it, and the picture is handed
    the voice's envelope to breathe with.
    """
    cfg, card = look(name)
    kind = card["kind"]
    voice, pulse = None, None
    if kind == "verse":
        vpath, who = verses.audio_for(plan()[name])
        vx, vdur = sound.load_voice(vpath)
        start = 2.0
        card["rec"] = {"start": start, "dur": vdur}
        card["reciter"] = "Recited by " + who
        secs = round(start + vdur + 4.2, 2)
        if secs > MAX_SECS:
            raise SystemExit(f"{name}: the recitation is {vdur:.0f}s, too long for a reel")
        voice = (vx, start)
        env = sound.envelope(vx, FPS)
        pulse = True
    secs = secs or cfg.get("secs") or 20.0
    info = stage.build(card, secs)
    # the type layer decides how long its own choreography needs to be: the
    # length follows from the words, not from a number written in the plan
    secs = round(float(info.get("secs") or secs), 2)
    if secs > MAX_SECS:
        raise SystemExit(f"{name}: {secs:.0f}s is longer than a reel should be")
    if pulse is not None:
        stage.pulse(list(env), start)
    return {"cfg": cfg, "card": card, "secs": secs, "info": info,
            "kind": kind, "voice": voice, "centre": kind in CENTRED,
            "slot": plan()[name].get("slot", "morning")}


def frames(stage, name, secs=None, prep=None):
    """yields (t, finished frame as JPEG bytes, info) for the whole reel"""
    p = prep or prepare(stage, name, secs)
    secs, info = p["secs"], p["info"]
    for i in range(int(FPS * secs)):
        t = i / float(FPS)
        yield t, stage.frame(t), info


def render(stage, name, out_dir="out"):
    prep = prepare(stage, name)
    if not prep["info"]["fits"]:
        raise SystemExit(f"{name}: the copy is too long for the safe area")
    secs = prep["secs"]
    out = f"{out_dir}/{name}.mp4"
    part = f"{out_dir}/{name}.part.mp4"     # renamed only once ffmpeg has finished well
    # The bed, written first because it is placed from this card's own timeline.
    # It goes to a temp directory rather than out_dir on purpose: the workflow
    # commits everything in reels/, so a run that died between writing the bed
    # and encoding would otherwise leave a four megabyte wav in the repository.
    wav = sound.bed(os.path.join(tempfile.gettempdir(), f"noor-bed-{os.getpid()}-{name}.wav"),
                    prep["info"], secs, prep["cfg"]["seed"], prep["slot"],
                    len(prep["card"].get("lines") or []), kind=prep["kind"],
                    voice=prep["voice"])
    p = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-f", "image2pipe", "-c:v", "mjpeg", "-r", str(FPS), "-i", "-",
         "-i", wav,
         "-map", "0:v", "-map", "1:a", "-t", str(secs),
         # slow and crf 25: these frames are dark and barely move, so the
         # slower search finds far more to throw away. Four megabytes became
         # under two, at a quality difference nobody can see on a phone.
         "-c:v", "libx264", "-preset", "slow", "-crf", "25",
         "-profile:v", "high", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "96k", "-shortest",
         "-movflags", "+faststart", part], stdin=subprocess.PIPE)
    cover_at, cover = None, None
    for t, jpg, info in frames(stage, name, prep=prep):
        p.stdin.write(jpg)
        if cover_at is None: cover_at = info.get("cover", info["tDate"] + 1.1)
        if cover is None and t >= cover_at:
            cover = jpg
            with open(f"{out_dir}/{name}-cover.jpg", "wb") as f: f.write(jpg)
    p.stdin.close(); rc = p.wait()
    try: os.remove(wav)
    except OSError: pass
    if rc != 0 or not os.path.exists(part) or os.path.getsize(part) < 50000:
        try: os.remove(part)
        except OSError: pass
        raise SystemExit(f"{name}: ffmpeg failed (exit {rc}); nothing was kept")
    os.replace(part, out)
    # what was made, beside the file: the manifest reads it back, and the
    # caption of a verse reel needs the reciter, which only exists here
    meta = {"id": name, "kind": prep["kind"], "secs": secs}
    if prep["kind"] == "verse":
        meta["reciter"] = prep["card"].get("reciter", "").replace("Recited by ", "")
        meta["ref"] = prep["card"].get("ref", "")
        meta["meaning"] = " ".join(prep["card"].get("sents", []))
    with open(f"{out_dir}/{name}.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    return out


AUDIT_EVERY = 10   # the coarse stride of the audit, in frames
AUDIT_ARRIVAL = 5  # frames drawn from the start of every tween
INK = 24           # alpha above which a pixel counts as ink


def audit_frames(cues, nframes, every=AUDIT_EVERY):
    """which frames the audit draws: every `every`-th, and the first five of
    every tween the timeline holds (NOORREEL.cues, one entry per target).

    This used to be every fifth frame of the reel, and this is not weaker
    than that, only cheaper where the old stride was spending its frames on
    nothing. Ink can only reach further than its resting place while a
    tween is moving it, and elements only appear at cue times: between two
    cues nothing arrives and nothing is pushed, and the fades of earlier
    blocks only make ink fainter. So the box of ink over the whole reel is
    the box at rest, which the coarse stride sees over and over, together
    with the reach of every arrival and every departure, which are looked
    at here on purpose rather than met by chance.

    An arrival eases out (outCubic, outQuint, outExpo): a word that enters
    42px low and blurred is furthest from home as it appears, and its blur,
    which spreads ink sideways for a few frames as the word brightens, has
    peaked, to the pixel, within four frames of every fade-in the timeline
    uses. The first five frames of every tween are drawn. Every fifth frame
    saw exactly one of those five, and after them only frames nearer rest.

    A departure that moves (a sentence of a long verse leaving upward as the
    next arrives) reaches further the longer it runs, until it is too faint
    to count, so every frame of a fade-out is drawn from its start to its
    end: the whole of what the old stride could have seen of it. The glows
    are not measured at all: the audit puts them out first (NOORREEL.decor).

    What this buys: a long verse, which is mostly rest, has a third fewer
    frames drawn than before; a short card, whose opening is all arrivals,
    somewhat more, and the moments that matter are looked at on purpose
    rather than met by chance. Each frame costs less, see
    Stage._png; the run is faster because the audit is done in the workers,
    three wide, beside the rendering.
    """
    take = set(range(0, nframes, every))
    for s, e, prop, a, b in cues:
        if prop == "color": continue                       # colour is not geometry
        first = int(math.ceil(s * FPS - 1e-6))
        if prop == "opacity" and a is not None and b is not None and b < a and b * 255 < INK:
            last = int(math.floor(e * FPS + 1e-6))          # a fade-out: all of it
        else:
            last = first + AUDIT_ARRIVAL - 1                # an arrival: its first frames
        take.update(range(max(0, first), min(nframes, last + 1)))
    return sorted(take)


def audit(stage, name, every=AUDIT_EVERY):
    """the ink of the type layer, measured against the safe rectangle"""
    p = prepare(stage, name)
    secs, info = p["secs"], p["info"]
    cues = stage.cues()
    # the audit leans on the timeline's own list of moments; a page that
    # cannot show it, or shows one without the way home in it, is a broken
    # renderer and stops the run rather than a quietly thinner audit
    if not any(abs(c[0] - float(info["tClose"])) < 1e-3 for c in cues):
        raise RuntimeError("the type layer lists no cue at tClose for %s" % name)
    stage.p.evaluate("() => NOORREEL.decor(false)")
    worst, bad = [W, H, 0, 0], []
    for i in audit_frames(cues, int(FPS * secs), every):
        t = i / float(FPS)
        a = np.asarray(stage.at(t))[..., 3]
        ys, xs = np.where(a > INK)
        if not len(xs): continue
        bb = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
        worst = [min(worst[0], bb[0]), min(worst[1], bb[1]),
                 max(worst[2], bb[2]), max(worst[3], bb[3])]
        if bb[0] < SAFE_L: bad.append((round(t, 2), "left", bb[0]))
        if bb[1] < SAFE_TOP: bad.append((round(t, 2), "top", bb[1]))
        if bb[2] > SAFE_R: bad.append((round(t, 2), "right", bb[2]))
        if bb[3] > SAFE_BOTTOM: bad.append((round(t, 2), "bottom", bb[3]))
    stage.p.evaluate("() => NOORREEL.decor(true)")
    return info, worst, bad


if __name__ == "__main__":
    names = [a for a in sys.argv[1:] if not a.startswith("-")] or list(plan())
    only_audit = "--audit" in sys.argv
    with sync_playwright() as pw:
        st = Stage(pw)
        ok = True
        print(f"safe rectangle  x {SAFE_L}..{SAFE_R}   y {SAFE_TOP}..{SAFE_BOTTOM}")
        for nm in names:
            info, worst, bad = audit(st, nm)
            print("%-14s %3dpx/%2dpx  ink x %4d..%4d y %4d..%4d  "
                  "margins L%+d T%+d R%+d B%+d  %s"
                  % (nm, info.get("hookPx") or info.get("arPx") or info.get("ayahPx") or 0,
                     info.get("bodyPx") or info.get("shortPx") or info.get("transPx") or 0,
                     worst[0], worst[2],
                     worst[1], worst[3], worst[0] - SAFE_L, worst[1] - SAFE_TOP,
                     SAFE_R - worst[2], SAFE_BOTTOM - worst[3],
                     ("FIT" if not info.get("tight") else "TIGHT")
                     if (not bad and info["fits"]) else "OUT " + str(bad[:2])))
            if bad or not info["fits"]: ok = False
        print("ALL CLEAR" if ok else "FAILED")
        if not only_audit and ok:
            for nm in names:
                t0 = time.time()
                _SCRIM.clear()
                print(render(st, nm), "in %.0fs" % (time.time() - t0), flush=True)
        st.close()
        sys.exit(0 if ok else 1)
