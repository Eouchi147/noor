#!/usr/bin/env python3
"""NOOR - one staged film, start to finish, for the films workflow.

    python3 render_ci.py darkroom
    python3 render_ci.py darkroom --proof

WHY THIS EXISTS

plates.sh is the Mac's own way to turn every staged brief into two finished
shorts: compile the brief, render both shapes, lay the score under each. The
films workflow (films.yml) runs that same chain on a GitHub Actions machine,
one brief at a time, and needs one thing plates.sh does not: an audit and a
contact sheet written to disk for the Director to read in a pull request
without downloading 200 MB of video. This is that chain, called once per
brief by the render job's matrix.

Six steps: compile (shortplate.py), render tall then wide (noor.py), lay the
score under each (shortmusic.py --mux), audit each (audit.py, its own
verdict, never this script's), and a contact sheet of each, ten tiles at
each line's own midpoint, drawn here with PIL because contact.py samples one
frame a BEAT and a plate short is one beat covering the whole picture; its
sampling would give one tile, not ten.

The brief's own name is passed without its "plate-" prefix, the same
spelling the films workflow's own "briefs" input takes (briefs/plate-darkroom.json
is named "darkroom" here); the compiled slug (its "short-darkroom") is what
the render, the score and the audit are all called with, exactly as
plates.sh calls them.

EXIT CODE

Non zero only when the render itself could not be produced: a refused
brief, a render or mux that failed. An audit FAIL is not a render failure:
it is let through, its table already written to
out/<slug>-<shape>.audit.json by audit.py itself, for the Director to read
in the pull request the assemble job opens.
"""
import argparse, io, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
PY = sys.executable or "python3"

#  the two speeds a film in this house is ever asked for: the shelf copy,
#  and a quick look. plates.sh only ever does the first; --proof is this
#  script's own addition, named the same as film.py's older "proof 12 fps
#  shutter 1" so the two stay easy to talk about in the same sentence.
FULL_FPS, FULL_SHUTTER = 30, 3
PROOF_FPS, PROOF_SHUTTER = 12, 1


def run(cmd):
    print("  $ " + " ".join(cmd), flush=True)
    return subprocess.run(cmd, cwd=HERE)


def compile_brief(name):
    """shortplate.py, exactly as plates.sh calls it for one brief: writes
    films/<slug>.json and returns the slug, or exits with the brief's own
    PROBLEMS lines already printed by shortplate.py itself. The films
    workflow's plan job has already checked every brief with --check before
    any machine is spent rendering one, so a refusal here means the brief
    changed between that check and this render, not a surprise."""
    brief_path = os.path.join(HERE, "briefs", "plate-%s.json" % name)
    if not os.path.exists(brief_path):
        sys.exit("no such brief: briefs/plate-%s.json" % name)
    r = run([PY, "shortplate.py", os.path.join("briefs", "plate-%s.json" % name)])
    if r.returncode:
        sys.exit("brief refused: %s (see PROBLEMS above)" % name)
    with open(brief_path, encoding="utf-8") as f:
        return json.load(f)["slug"]


def render_shape(slug, shape, fps, shutter, workers):
    r = run([PY, "noor.py", "--film", slug, "--shape", shape,
             "--workers", str(workers), "--fps", str(fps),
             "--shutter", str(shutter), "--encode"])
    if r.returncode:
        sys.exit("render failed: %s %s" % (slug, shape))
    mp4 = os.path.join(HERE, "%s-%s-%dfps.mp4" % (slug, shape, fps))
    if not os.path.exists(mp4):
        sys.exit("noor.py said it encoded %s but %s is not there" % (shape, mp4))
    return mp4


def score_and_mux(slug, shape, fps):
    """shortmusic.py's own --mux always looks for, and writes back to,
    <slug>-<shape>-60fps.mp4: a name fixed when every short rendered at 60,
    and not this script's file to change. The same rename dance plates.sh
    does around it: the file actually encoded at fps (30 for the shelf
    copy, 12 for a proof) borrows the 60fps name just long enough to be
    found and muxed, and is handed its own name back the moment the mux is
    done, success or not, an exception or a signal included: the rename
    back sits in a finally, so a killed job never leaves a film stuck under
    a name shortmanifest.py and every other tool here does not know."""
    real = os.path.join(HERE, "%s-%s-%dfps.mp4" % (slug, shape, fps))
    borrowed = os.path.join(HERE, "%s-%s-60fps.mp4" % (slug, shape))
    os.makedirs(OUT, exist_ok=True)
    #  a stale wav from an earlier shape or an earlier run of this slug must
    #  never be read as this shape's own score; shortmusic.py writes it
    #  fresh every time regardless, this only makes sure nothing stale is
    #  ever mistaken for it in between
    try:
        os.remove(os.path.join(OUT, slug + ".wav"))
    except OSError:
        pass
    os.replace(real, borrowed)
    try:
        r = run([PY, "shortmusic.py", slug, "--mux", "--shape", shape])
    finally:
        os.replace(borrowed, real)
    if r.returncode:
        sys.exit("score failed: %s %s" % (slug, shape))
    return real


def audit_shape(slug, shape, fps):
    """audit.py's own verdict, PASS, FAIL or SKIPPED a rule at a time,
    already written to out/<slug>-<shape>.audit.json by audit.py itself.
    Its return code says whether any rule FAILed; that is not this
    script's failure, only printed, so a FAIL still ships an artifact the
    Director reads in the pull request rather than stopping the batch."""
    r = run([PY, "audit.py", slug, "--shape", shape, "--fps", str(fps)])
    if r.returncode:
        print("  AUDIT FAIL: %s %s (see the table above and "
              "out/%s-%s.audit.json)" % (slug, shape, slug, shape))
    return r.returncode


#  ---- the contact sheet: ten tiles, one at each line's own midpoint ------
FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
]


def a_font(size):
    from PIL import ImageFont
    for p in FONT_PATHS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def contact_sheet(slug, shape):
    """One picture per shape: every one of the brief's own lines, at its
    own midpoint (the "at" and "until" shortplate.py already timed it to,
    read straight off the compiled beat rather than guessed here), tiled
    five across with the line's own text under it. contact.py's own
    sampling is one frame a BEAT, which is right for a film of many beats
    and wrong for a plate short: the whole picture is one beat, so that
    sampling would draw one tile for a forty second film, not ten."""
    from PIL import Image, ImageDraw
    sys.path.insert(0, HERE)
    from spec import FRAMES
    from render import Stage, film
    from playwright.sync_api import sync_playwright

    F = film(slug)
    chapter = F["chapters"][0]
    beat = chapter["beats"][0]
    lines = beat.get("lines") or []
    frame = FRAMES[shape]
    W = 420
    H = int(W * frame["h"] / frame["w"])
    LH, PAD, COLS = 34, 8, 5
    rows_n = max(1, (len(lines) + COLS - 1) // COLS)
    sheet = Image.new("RGB", (COLS * (W + PAD) + PAD, rows_n * (H + LH + PAD) + PAD), (16, 16, 20))
    d = ImageDraw.Draw(sheet)
    f1 = a_font(14)
    with sync_playwright() as pw:
        st = Stage(pw, frame)
        try:
            st.build(chapter)
            for i, L in enumerate(lines):
                at, until = float(L.get("at", 0.0)), float(L.get("until", L.get("at", 0.0)))
                mid_ms = (at + until) / 2.0 * 1000.0
                im = Image.open(io.BytesIO(st.shot(mid_ms))).convert("RGB")
                x = PAD + (i % COLS) * (W + PAD)
                y = PAD + (i // COLS) * (H + LH + PAD)
                sheet.paste(im.resize((W, H), Image.LANCZOS), (x, y))
                txt = (L.get("text") or L.get("eyebrow") or "")[:44]
                d.text((x + 2, y + H + 4), "%02d  %.1fs" % (i, at), font=f1, fill=(235, 178, 41))
                d.text((x + 2, y + H + 18), txt, font=f1, fill=(160, 160, 168))
        finally:
            st.close()
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "contact-%s-%s.png" % (slug, shape))
    sheet.save(path)
    print("  -> %s" % path)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name", help="a brief's own name, without the plate- prefix "
                                  "(briefs/plate-darkroom.json is \"darkroom\")")
    ap.add_argument("--proof", action="store_true",
                     help="12 fps, shutter 1: a quick look, not the shelf copy")
    ap.add_argument("--workers", type=int, default=0,
                     help="default: every core this machine has")
    a = ap.parse_args()

    fps, shutter = (PROOF_FPS, PROOF_SHUTTER) if a.proof else (FULL_FPS, FULL_SHUTTER)
    workers = a.workers or max(1, os.cpu_count() or 2)

    print("\n  %s  ->  %s fps, shutter %d, %d worker(s)%s\n"
          % (a.name, fps, shutter, workers, "  (PROOF)" if a.proof else ""))

    slug = compile_brief(a.name)

    failed_audit = False
    for shape in ("tall", "wide"):
        print("\n  == %s : %s ==" % (slug, shape))
        render_shape(slug, shape, fps, shutter, workers)
        score_and_mux(slug, shape, fps)
        if audit_shape(slug, shape, fps):
            failed_audit = True
        contact_sheet(slug, shape)

    print("\n  %s done: both shapes rendered, scored and audited%s"
          % (slug, " (an audit FAILed, see above)" if failed_audit else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
