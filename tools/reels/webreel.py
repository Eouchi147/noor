#!/usr/bin/env python3
"""NOOR reel · render the anime.js type layer over the generated picture.

The words are animated in a headless browser by the same anime.js build the
site ships (`web/anime.min.js`, copied from assets/). The timeline never plays:
it is built paused and seeked to an exact millisecond for each frame, the frame
is screenshotted with a transparent background, and that layer is composited
over the picture `cine.py` draws for the same instant. So the motion is the
browser's, the picture is numpy's, and the two agree on the clock.

    python3 webreel.py                  render every card in make.LOOKS
    python3 webreel.py sufi shatir      render some of them
    python3 webreel.py --audit          only check the safe area
"""
import io, json, os, subprocess, sys, time
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

import cine
from spec import W, H, FPS, SAFE_TOP, SAFE_BOTTOM, SAFE_L, SAFE_R, ease

PAGE = "file://" + os.path.join(os.path.dirname(os.path.abspath(__file__)), "web", "type.html")

_SCRIM = {}


def scrim(img, t):
    """the ground the type stands on, deepening as the words arrive"""
    lift = ease((t - 0.2) / 2.2)
    key = round(lift, 3)
    col = _SCRIM.get(key)
    if col is None:
        v = np.linspace(0.0, 1.0, H, dtype=np.float32)
        a = (118 + 74 * lift) * (0.36 + 0.64 * (v ** 1.35))
        a = np.maximum(a, 96 * lift)
        col = (np.clip(a, 0, 236).reshape(H, 1, 1) / 255.0).astype(np.float32)
        _SCRIM[key] = col
    base = np.asarray(img, dtype=np.float32)
    ink = np.array([5.0, 7.0, 20.0], dtype=np.float32)
    return Image.fromarray(np.uint8(base * (1.0 - col) + ink * col))


class Stage:
    """one page, held open for the length of a render"""
    def __init__(self, pw):
        self.b = pw.chromium.launch(args=["--force-color-profile=srgb",
                                          "--font-render-hinting=none"])
        self.p = self.b.new_page(viewport={"width": W, "height": H},
                                 device_scale_factor=1)
        self.errs = []
        self.p.on("pageerror", lambda e: self.errs.append(str(e)))
        self.p.goto(PAGE)
        self.p.wait_for_function("() => document.fonts.status === 'loaded'")

    def build(self, card, secs):
        """build, then step the type down until the resting column clears"""
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
        self.p.evaluate("t=>NOORREEL.seek(t)", t)
        return Image.open(io.BytesIO(
            self.p.screenshot(omit_background=True, type="png"))).convert("RGBA")

    def close(self):
        self.b.close()


PLAN = None

def plan():
    """the reviewed file: copy and look for every card, one entry each"""
    global PLAN
    if PLAN is None:
        PLAN = json.load(open("plan.json"))["cards"]
    return PLAN


def look(name):
    """(look, card) for one card id"""
    c = plan()[name]
    card = {k: c[k] for k in ("eyebrow", "hook", "key", "date", "lines")}
    lk = dict(c["look"])
    return lk, card


def frames(stage, name, secs=None):
    """yields (t, finished frame) for the whole reel"""
    cfg, card = look(name)
    secs = secs or cfg["secs"]
    info = stage.build(card, secs)
    if not info["fits"]:
        raise SystemExit(f"{name}: the copy is too long for the safe area")
    cue_at = info["tBody"] + min(cfg["cue"], len(card["lines"]) - 1) * info["step"] - 0.3
    cin = cine.Cine(cfg["pal"], cfg["seed"], cfg["n"], cfg["k"], secs,
                    cine.Scene(cfg["scene"], n=cfg["n"], k=cfg["k"]),
                    cue_at=cue_at, recede=info["tBody"] - 0.5)
    for i in range(int(FPS * secs)):
        t = i / float(FPS)
        fg = stage.at(t)
        bg = scrim(cin.frame(t), t).convert("RGBA")
        yield t, Image.alpha_composite(bg, fg).convert("RGB"), info


def render(stage, name, out_dir="out"):
    cfg, card = look(name)
    secs = cfg["secs"]
    out = f"{out_dir}/{name}.mp4"
    p = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
         "-map", "0:v", "-map", "1:a", "-t", str(secs),
         # slow and crf 25: these frames are dark and barely move, so the
         # slower search finds far more to throw away. Four megabytes became
         # under two, at a quality difference nobody can see on a phone.
         "-c:v", "libx264", "-preset", "slow", "-crf", "25",
         "-profile:v", "high", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "96k", "-shortest",
         "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    cover_at, cover = None, None
    for t, img, info in frames(stage, name):
        p.stdin.write(img.tobytes())
        if cover_at is None: cover_at = info["tDate"] + 1.1
        if cover is None and t >= cover_at:
            cover = img; img.save(f"{out_dir}/{name}-cover.jpg", quality=92)
    p.stdin.close(); p.wait()
    return out


def audit(stage, name, every=5):
    """the ink of the type layer, measured against the safe rectangle"""
    cfg, card = look(name)
    secs = cfg["secs"]
    info = stage.build(card, secs)
    stage.p.evaluate("() => NOORREEL.decor(false)")
    worst, bad = [W, H, 0, 0], []
    for i in range(0, int(FPS * secs), every):
        t = i / float(FPS)
        a = np.asarray(stage.at(t))[..., 3]
        ys, xs = np.where(a > 24)
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
            print("%-9s hook %dpx body %dpx  ink x %4d..%4d y %4d..%4d  "
                  "margins L%+d T%+d R%+d B%+d  %s"
                  % (nm, info["hookPx"], info["bodyPx"], worst[0], worst[2],
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
