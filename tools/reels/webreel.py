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
import io, json, os, subprocess, sys, tempfile, time
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

import cine
import sound
import verses
from spec import W, H, FPS, SAFE_TOP, SAFE_BOTTOM, SAFE_L, SAFE_R, ease

MAX_SECS = 58.0          # Instagram takes up to 90; nobody watches 90
CENTRED = ("word", "verse")

PAGE = "file://" + os.path.join(os.path.dirname(os.path.abspath(__file__)), "web", "type.html")

_SCRIM = {}


def scrim(img, t, centre=False):
    """the ground the type stands on, deepening as the words arrive.

    The column formats read top to bottom, so the ground deepens toward the
    bottom. The centred formats stand on the middle of the frame, with the
    picture meant to be seen around them, so their ground is a band."""
    lift = ease((t - 0.2) / 2.2)
    key = (round(lift, 3), centre)
    col = _SCRIM.get(key)
    if col is None:
        v = np.linspace(0.0, 1.0, H, dtype=np.float32)
        if centre:
            band = np.exp(-((v - float(centre)) / 0.30) ** 2)
            a = (34 + 72 * lift) * (0.30 + 0.70 * band)
        else:
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
        PLAN = json.load(open(os.environ.get("NOOR_PLAN") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "plan.json")))["cards"]
    return PLAN


KIND_FIELDS = {
    "light": ("eyebrow", "hook", "key", "date", "lines"),
    "know":  ("eyebrow", "hook", "key", "date", "lines"),
    "day":   ("eyebrow", "num", "month", "ar", "hook", "key", "lines", "todo"),
    "word":  ("eyebrow", "ar", "term", "short", "long"),
    "verse": ("eyebrow", "ar", "ref", "sents", "reciter", "verse"),
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
        start = 2.6
        card["rec"] = {"start": start, "dur": vdur}
        card["reciter"] = "Recited by " + who
        secs = min(MAX_SECS, round(start + vdur + 1.35 + 3.0, 2))
        if start + vdur + 2.6 > MAX_SECS:
            raise SystemExit(f"{name}: the recitation is {vdur:.0f}s, too long for a reel")
        voice = (vx, start)
        env = sound.envelope(vx, FPS)
        def pulse(t, env=env, start=start):
            i = int((t - start) * FPS)
            return float(env[i]) if 0 <= i < len(env) else 0.0
    secs = secs or cfg["secs"]
    info = stage.build(card, secs)
    scene_kw = {"n": cfg["n"], "k": cfg["k"]}
    if kind == "day": scene_kw["month"] = plan()[name].get("hm", 1)
    if kind == "word":
        cue_at, blooms = info["tAr"] - 0.2, [info["tAr"], info["tShort"]]
    elif kind == "verse":
        cue_at, blooms = info["tAyah"] - 0.2, [info["tAyah"], info["recEnd"] + 0.45]
    elif kind == "day":
        cue_at, blooms = info["tDate"], [info["tDate"], info["hookEnd"] - 0.3]
    else:
        cue_at = info["tBody"] + min(cfg.get("cue", 0), len(card["lines"]) - 1) * info["step"] - 0.3
        blooms = [info["hookEnd"] - 0.3]
    centred = kind in CENTRED
    cin = cine.Cine(cfg["pal"], cfg["seed"], cfg["n"], cfg["k"], secs,
                    cine.Scene(cfg["scene"], **scene_kw),
                    cue_at=cue_at, recede=info["tBody"] - 0.5,
                    rays=kind in ("word", "verse", "day"), blooms=blooms,
                    pulse=pulse, centre=(float(info.get("focus", 0.42)) if centred else False))
    return {"cfg": cfg, "card": card, "secs": secs, "info": info, "cin": cin,
            "kind": kind, "voice": voice, "centre": centred,
            "slot": plan()[name].get("slot", "morning")}


def frames(stage, name, secs=None, prep=None):
    """yields (t, finished frame) for the whole reel"""
    p = prep or prepare(stage, name, secs)
    secs, info, cin = p["secs"], p["info"], p["cin"]
    for i in range(int(FPS * secs)):
        t = i / float(FPS)
        fg = stage.at(t)
        bg = scrim(cin.frame(t), t, cin.centre).convert("RGBA")
        yield t, Image.alpha_composite(bg, fg).convert("RGB"), info


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
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
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
    for t, img, info in frames(stage, name, prep=prep):
        p.stdin.write(img.tobytes())
        if cover_at is None: cover_at = info.get("cover", info["tDate"] + 1.1)
        if cover is None and t >= cover_at:
            cover = img; img.save(f"{out_dir}/{name}-cover.jpg", quality=92)
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


def audit(stage, name, every=5):
    """the ink of the type layer, measured against the safe rectangle"""
    p = prepare(stage, name)
    secs, info = p["secs"], p["info"]
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
