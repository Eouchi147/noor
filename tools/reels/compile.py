#!/usr/bin/env python3
"""The reels, joined into long-form videos for YouTube.

A reel is twenty seconds and lives a day in a feed. The same reels, joined
end to end, are a half-hour video that YouTube keeps and searches for years:
the 99 Names in their order, the du'as of the Path, thirty verses on one
theme, the words of the Path a letter block at a time, the Did you knows
forty at a time. Nothing is written for it. Every frame is a reel that was
already audited and rendered; the title is fixed here; the description is
the library's line, the chapter list (each reel's own hook), the reciters
the manifest names, and the translation credit. The manifest is the only
source of words.

What one run makes, in out/:

    <name>.mp4            the reels, joined
    <name>.chapters.txt   "0:00 <hook>" per reel, for the description
    <name>.json           title, description, tags, the ordered ids, seconds
    <name>.jpg            the first reel's cover, letterboxed to 1280x720 on
                          the night, no text added

The join is a stream copy: every reel is 1080x1920, 30 fps, H.264 high,
yuv420p, AAC stereo at 48 kHz, so ffmpeg's concat demuxer can join them
without touching a frame. Each input is probed first; if any stream differs
from the first (a reel from an older cut, say) the join is re-encoded at the
house settings with 0.6 s of black and silence between reels, which hides
the seam an encoder makes. A copy that does not come out the length of its
inputs takes the same road.

The compilations (`catalogue()`, in the order the scheduled run takes them):

    names              the 99 Names, in order
    dua                the du'as of the Path
    verses-<theme>     verses whose meaning carries the theme's words, thirty
                       at most: patience, mercy, gratitude, remembrance
    words-<block>      the words of the Path by first letter: a-d, e-k, l-r, s-z
    know-<n>           the Did you knows, forty at a time, in manifest order

    python3 compile.py names dua                 build these
    python3 compile.py verses words know         a family expands to its members
    python3 compile.py --pending --max 4         what compilations.json has not seen yet
    python3 compile.py --list                    the catalogue, and what is uploaded

A video over twelve hours, YouTube's limit, is split into parts before
anything is downloaded; no compilation on today's shelf comes near it.
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get("NOOR_ROOT") or os.path.join(HERE, "..", "..")
REELS = os.environ.get("REELS_OUT", os.path.join(ROOT, "reels"))
REPO = os.environ.get("GITHUB_REPOSITORY", "Eouchi147/noor")
RELEASE = "https://github.com/%s/releases/download/reels-%%s/%%s.mp4" % REPO
LEDGER = os.path.join(HERE, "compilations.json")

SITE = "noorcodex.com"
NIGHT = "0x04060F"                     # the site's night, behind the thumbnail
GAP = 0.6                              # seconds of black between reels when re-encoding
LIMIT = 12 * 3600 - 60                 # YouTube's twelve hours, with a minute in hand
THEME_CAP = 30
KNOW_CHUNK = 40

# the words that put a verse under a theme, matched at the start of a word
# in the verse's meaning or caption, so "ease" is not found inside "please"
THEMES = {
    "patience":    ["patience", "patient", "hardship", "ease"],
    "mercy":       ["mercy", "merciful", "forgiv"],
    "gratitude":   ["grateful", "gratitude", "thank"],
    "remembrance": ["remember", "remembrance"],
}
BLOCKS = [("a-d", "AD", "A to D"), ("e-k", "EK", "E to K"), ("l-r", "LR", "L to R"), ("s-z", "SZ", "S to Z")]

# the room of the library each kind comes from
ROOM = {"name": "/allah", "verse": "/quran", "word": "/dictionary", "know": "/lights", "dua": "/words"}
PLAYLIST = {"name": "The 99 Names of Allah", "verse": "One verse", "word": "The word",
            "know": "Did you know?", "dua": "Du'as of the Path"}
TAGS = {
    "name":  ["NOOR", "Islam", "99 Names of Allah", "Asma ul Husna", "Arabic", "Tawhid"],
    "dua":   ["NOOR", "Islam", "Dua", "Quran", "Sunnah", "Arabic"],
    "verse": ["NOOR", "Islam", "Quran", "Recitation", "Saheeh International"],
    "word":  ["NOOR", "Islam", "Arabic", "Islamic terms", "Dictionary"],
    "know":  ["NOOR", "Islam", "Islamic history", "History of science", "Did you know"],
}
# the length of a reel when nothing has measured it yet, used only to decide
# a split before the files are here
GUESS = {"verse": 25.0, "word": 14.0, "name": 20.0, "know": 13.0, "light": 21.0, "day": 13.0, "dua": 21.0}

# the fixed lines of a description: the only words in it that are not the
# manifest's own. test_compile.py holds the description to these plus the
# manifest's text.
LIBRARY_LINE = ("From NOOR Codex of Light, a free Islamic library: no ads, no account, no tracking. "
                "The whole room is at %s%s")
CHAPTERS_LINE = "Chapters"
RECITED_LINE = "Recited by: "
MEANING_LINE = "The meaning of each verse is the Saheeh International translation."

NUMBERS = {1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight", 9: "Nine",
           10: "Ten", 11: "Eleven", 12: "Twelve", 13: "Thirteen", 14: "Fourteen", 15: "Fifteen", 16: "Sixteen",
           17: "Seventeen", 18: "Eighteen", 19: "Nineteen", 20: "Twenty", 30: "Thirty", 40: "Forty", 50: "Fifty"}


def number_word(n):
    """a count as a word, so a title never says thirty of twenty-eight"""
    if n in NUMBERS: return NUMBERS[n]
    if 20 < n < 60: return NUMBERS[n // 10 * 10] + "-" + NUMBERS[n % 10].lower()
    return str(n)


# ---------------------------------------------------------------- the manifest

def load_manifest(path=None):
    path = path or os.path.join(REELS, "index.json")
    doc = json.load(open(path, encoding="utf-8"))
    rows = doc["cards"] if isinstance(doc, dict) else doc
    return [r for r in rows if isinstance(r, dict) and r.get("id")]


def plan_order():
    """the order plan.json gives its cards: the 99 Names as the page has
    them, the verses as verses.txt has them. The manifest is sorted by id,
    which is alphabetical and not an order anyone chose."""
    try:
        cards = json.load(open(os.path.join(HERE, "plan.json"), encoding="utf-8"))["cards"]
        return {cid: i for i, cid in enumerate(cards)}
    except (OSError, ValueError, KeyError):
        return {}


def ordered(rows, order=None):
    """`ordinal` when a row has one, the plan's order when it is known, the
    manifest's order otherwise"""
    order = plan_order() if order is None else order
    n = len(rows)
    def key(ir):
        i, r = ir
        if r.get("ordinal") is not None: return (0, float(r["ordinal"]), i)
        if r["id"] in order: return (1, order[r["id"]], i)
        return (2, n, i)
    return [r for i, r in sorted(enumerate(rows), key=key)]


def meaning_of(row):
    """a verse's meaning: the row's own, or the second paragraph of its
    caption, which the renderer filled from the same translation"""
    if row.get("meaning"): return str(row["meaning"])
    paras = [p.strip() for p in str(row.get("caption", "")).split("\n\n") if p.strip()]
    return paras[1] if len(paras) > 1 else ""


def verse_ref(row):
    if row.get("verse"): return str(row["verse"])
    m = re.search(r"\d+:\d+(?:-\d+)?", str(row.get("hook", "")))
    return m.group(0) if m else ""


def secs_of(row):
    """how long a reel is: the manifest's word, then the sidecar's, then a
    guess by kind for the split alone"""
    if row.get("secs"): return float(row["secs"])
    try:
        m = json.load(open(os.path.join(REELS, row["id"] + ".json"), encoding="utf-8"))
        if m.get("secs"): return float(m["secs"])
    except (OSError, ValueError):
        pass
    return GUESS.get(row.get("kind", "light"), 20.0)


# ---------------------------------------------------------------- the selections

def theme_rows(rows, theme):
    """verses whose meaning or caption carries one of the theme's words"""
    pat = re.compile(r"\b(?:%s)" % "|".join(re.escape(w) for w in THEMES[theme]), re.I)
    out = []
    for r in ordered([r for r in rows if r.get("kind") == "verse"]):
        text = meaning_of(r) + "\n" + str(r.get("caption", ""))
        if pat.search(text): out.append(r)
        if len(out) >= THEME_CAP: break
    return out


def first_letter(row):
    s = re.sub(r"[^A-Za-z]", "", str(row.get("hook", "")))
    return s[:1].upper()


def block_rows(rows, block):
    """the words whose term begins in the block, in alphabetical order"""
    lo, hi = dict((b, r) for b, r, _ in BLOCKS)[block]
    words = [r for r in rows if r.get("kind") == "word" and lo <= first_letter(r) <= hi]
    return sorted(words, key=lambda r: str(r.get("hook", "")).lower())


def catalogue(rows):
    """every compilation the shelf can make today, in the order the scheduled
    run takes them: name -> (kind, title, ordered rows)"""
    out = {}
    names = ordered([r for r in rows if r.get("kind") == "name"])
    if names:
        n = len(names)
        head = "The 99 Names of Allah" if n == 99 else "%d of the 99 Names of Allah" % n
        out["names"] = ("name", head + ", with their meaning · NOOR Codex of Light", names)
    duas = ordered([r for r in rows if r.get("kind") == "dua"])
    if duas:
        out["dua"] = ("dua", "Du'as of the Path, from the Qur'an and the Sunnah", duas)
    for theme in THEMES:
        vs = theme_rows(rows, theme)
        if vs:
            out["verses-" + theme] = ("verse", "%s %s on %s, recited, with meaning"
                                      % (number_word(len(vs)), "verse" if len(vs) == 1 else "verses", theme), vs)
    for block, _, said in BLOCKS:
        ws = block_rows(rows, block)
        if ws:
            out["words-" + block] = ("word", "The words of the Path, %s, explained" % said, ws)
    knows = [r for r in rows if r.get("kind") == "know"]
    for i in range(0, len(knows), KNOW_CHUNK):
        chunk = knows[i:i + KNOW_CHUNK]
        out["know-%d" % (i // KNOW_CHUNK + 1)] = (
            "know", "Did you know? %s true things from Islamic history, part %d"
            % (number_word(len(chunk)), i // KNOW_CHUNK + 1), chunk)
    return out


def expand(names, cat):
    """a family name stands for its members: verses, words, know"""
    out = []
    for n in names:
        if n in cat: out.append(n)
        elif n in ("verses", "words", "know"):
            out += [k for k in cat if k.startswith(n + "-")]
        else:
            raise SystemExit("no such compilation on the shelf: %s (have %s)" % (n, ", ".join(cat)))
    return list(dict.fromkeys(out))


def split(rows, limit=LIMIT, secs=secs_of):
    """parts no longer than the limit, in order; one part when it all fits"""
    parts, cur, total = [], [], 0.0
    for r in rows:
        s = float(secs(r))
        if cur and total + s > limit:
            parts.append(cur); cur, total = [], 0.0
        cur.append(r); total += s
    if cur: parts.append(cur)
    return parts


# ---------------------------------------------------------------- the words

def hms(t):
    t = int(t)                          # a chapter starts on the reel's first frame
    h, m, s = t // 3600, t % 3600 // 60, t % 60
    return "%d:%02d:%02d" % (h, m, s) if h else "%d:%02d" % (m, s)


def chapters(rows, durations, gap=0.0):
    """"0:00 <hook>" per reel, the timestamps YouTube reads as chapters"""
    out, t = [], 0.0
    for r, d in zip(rows, durations):
        title = re.sub(r"\s+", " ", str(r.get("hook") or r["id"])).strip()
        if len(title) > 80:             # cut on a word, as the site's own title() does
            title = title[:79].rsplit(" ", 1)[0] + "…"
        out.append("%s %s" % (hms(t), title))
        t += float(d) + gap
    return out


def reciters(rows):
    seen = []
    for r in rows:
        who = str(r.get("reciter", "")).replace("Recited by ", "").strip()
        if who and who not in seen: seen.append(who)
    return seen


def description(kind, rows, chapter_lines):
    """one paragraph of the library's line, the chapters, the reciters of a
    verse compilation, and the translation credit; nothing else"""
    parts = [LIBRARY_LINE % (SITE, ROOM.get(kind, ""))]
    parts.append(CHAPTERS_LINE + "\n" + "\n".join(chapter_lines))
    if kind == "verse":
        who = reciters(rows)
        if who: parts.append(RECITED_LINE + ", ".join(who) + ".")
        parts.append(MEANING_LINE)
    text = "\n\n".join(parts)
    # YouTube keeps 5,000 characters; a chapter list that runs past that is
    # cut at the end, the chapters file beside the video keeps the whole
    while len(text) > 4900 and len(chapter_lines) > 3:
        chapter_lines = chapter_lines[:-1]
        parts[1] = CHAPTERS_LINE + "\n" + "\n".join(chapter_lines)
        text = "\n\n".join(parts)
    return text


# ---------------------------------------------------------------- the files

def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def fetch(url, dest, tries=4):
    """curl -L, because a release link answers with a redirect to a signed
    URL; a partial file is never left behind"""
    part = dest + ".part"
    for attempt in range(tries):
        r = run(["curl", "-sSL", "--fail", "--retry", "2", "--connect-timeout", "30",
                 "--max-time", "600", "-o", part, url])
        if r.returncode == 0 and os.path.getsize(part) > 20000:
            os.replace(part, dest); return dest
        try: os.remove(part)
        except OSError: pass
        if attempt < tries - 1: time.sleep(5.0 * (attempt + 1))
    raise RuntimeError("could not fetch %s: %s" % (url, (r.stderr or "").strip()[-200:]))


def video_url(row):
    v = str(row.get("video", ""))
    if v.startswith(("https://", "http://", "file://")): return v
    return RELEASE % (row.get("kind", "light"), row["id"])


def gather(rows, tmp, reels_dir=None):
    """every reel of the selection, local when it is here, fetched otherwise"""
    reels_dir = reels_dir or REELS
    paths = []
    for r in rows:
        local = os.path.join(reels_dir, r["id"] + ".mp4")
        if os.path.exists(local):
            paths.append(local); continue
        dest = os.path.join(tmp, r["id"] + ".mp4")
        if not os.path.exists(dest):
            print("  fetch", r["id"], flush=True)
            fetch(video_url(r), dest)
        paths.append(dest)
    return paths


def probe(path):
    """the shape of the streams, and the length"""
    r = run(["ffprobe", "-v", "error", "-show_entries",
             "stream=codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,sample_rate,channels,time_base:format=duration",
             "-of", "json", path])
    if r.returncode != 0: raise RuntimeError("ffprobe %s: %s" % (path, r.stderr.strip()[-200:]))
    j = json.loads(r.stdout)
    shape = {}
    for s in j.get("streams", []):
        t = s.get("codec_type")
        if t == "video":
            shape["v"] = (s.get("codec_name"), s.get("profile"), s.get("width"), s.get("height"),
                          s.get("pix_fmt"), s.get("r_frame_rate"), s.get("time_base"))
        elif t == "audio":
            shape["a"] = (s.get("codec_name"), s.get("sample_rate"), s.get("channels"), s.get("time_base"))
    return shape, float(j.get("format", {}).get("duration") or 0.0)


def uniform(shapes):
    """every reel cut the same way: what a stream copy needs"""
    return all("v" in s and "a" in s for s in shapes) and len(set(json.dumps(s, sort_keys=True) for s in shapes)) == 1


def listfile(paths, tmp, gap=None):
    p = os.path.join(tmp, "list.txt")
    with open(p, "w", encoding="utf-8") as f:
        for i, path in enumerate(paths):
            if gap and i: f.write("file '%s'\n" % gap.replace("'", r"'\''"))
            f.write("file '%s'\n" % os.path.abspath(path).replace("'", r"'\''"))
    return p


def black(tmp, secs=GAP):
    """0.6 s of the night with silence, in the house's own format"""
    p = os.path.join(tmp, "gap.mp4")
    if os.path.exists(p): return p
    r = run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=%s:s=1080x1920:r=30:d=%s" % (NIGHT, secs),
             "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", str(secs),
             "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", "30",
             "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "96k", "-shortest", p])
    if r.returncode != 0: raise RuntimeError("gap: " + r.stderr.strip()[-200:])
    return p


def join(paths, out, tmp, durations, force_encode=False):
    """the reels, joined: a stream copy when every input is the same shape and
    the copy comes out the length of its inputs; otherwise a re-encode at the
    house settings with a breath of black between reels. Returns the gap used."""
    shapes = [probe(p)[0] for p in paths]
    want = sum(durations)
    if uniform(shapes) and not force_encode:
        r = run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listfile(paths, tmp),
                 "-c", "copy", "-movflags", "+faststart", out])
        if r.returncode == 0:
            got = probe(out)[1]
            if abs(got - want) <= 0.2 * len(paths) + 1.0:
                return 0.0
            print("  the copy came out %.1fs for %.1fs of reels: re-encoding" % (got, want))
        else:
            print("  the copy failed: re-encoding (%s)" % r.stderr.strip()[-160:])
    else:
        print("  the reels are not all one shape: re-encoding")
    r = run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listfile(paths, tmp, black(tmp)),
             "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=%s,fps=30,format=yuv420p" % NIGHT,
             "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "20", "-r", "30",
             "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "96k", "-movflags", "+faststart", out])
    if r.returncode != 0: raise RuntimeError("join: " + r.stderr.strip()[-300:])
    return GAP


def thumbnail(row, first_video, out, tmp, reels_dir=None, secs=None):
    """the first reel's cover, or its frame at two seconds (the middle of a
    reel shorter than four), on a 1280x720 canvas of the night; no text is
    added"""
    reels_dir = reels_dir or REELS
    src = None
    local = os.path.join(reels_dir, row["id"] + "-cover.jpg")
    cover = str(row.get("cover", ""))
    if os.path.exists(local):
        src = local
    elif cover.startswith(("https://", "http://", "file://")):
        try: src = fetch(cover, os.path.join(tmp, row["id"] + "-cover.jpg"))
        except RuntimeError: src = None
    if src is None:
        src = os.path.join(tmp, row["id"] + "-frame.jpg")
        at = 2.0 if not secs or secs >= 4.0 else secs / 2.0
        r = run(["ffmpeg", "-y", "-v", "error", "-ss", "%.2f" % at, "-i", first_video, "-frames:v", "1", "-q:v", "2", src])
        if r.returncode != 0: raise RuntimeError("frame: " + r.stderr.strip()[-200:])
    r = run(["ffmpeg", "-y", "-v", "error", "-i", src, "-frames:v", "1",
             "-vf", "scale=-2:720,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=%s" % NIGHT, "-q:v", "3", out])
    if r.returncode != 0: raise RuntimeError("thumbnail: " + r.stderr.strip()[-200:])
    return out


# ---------------------------------------------------------------- one compilation

def build(name, kind, title, rows, out_dir, reels_dir=None, tmp=None, force_encode=False):
    """download, join, and write the four files. Returns the record."""
    os.makedirs(out_dir, exist_ok=True)
    own = tmp is None
    tmp = tmp or tempfile.mkdtemp(prefix="noor-compile-")
    try:
        paths = gather(rows, tmp, reels_dir)
        durations = [probe(p)[1] for p in paths]
        mp4 = os.path.join(out_dir, name + ".mp4")
        gap = join(paths, mp4, tmp, durations, force_encode=force_encode)
        total = probe(mp4)[1]
        lines = chapters(rows, durations, gap)
        with open(os.path.join(out_dir, name + ".chapters.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        thumbnail(rows[0], paths[0], os.path.join(out_dir, name + ".jpg"), tmp, reels_dir, durations[0])
        rec = {"name": name, "kind": kind, "title": title, "description": description(kind, rows, lines),
               "tags": TAGS.get(kind, ["NOOR", "Islam"]), "playlist": PLAYLIST.get(kind, "NOOR"),
               "ids": [r["id"] for r in rows], "secs": round(total, 2), "chapters": lines,
               "reciters": reciters(rows) if kind == "verse" else [],
               "joined": "copy" if gap == 0.0 else "encode", "bytes": os.path.getsize(mp4),
               "made": time.strftime("%Y-%m-%d")}
        with open(os.path.join(out_dir, name + ".json"), "w", encoding="utf-8") as f:
            json.dump(rec, f, ensure_ascii=False, indent=1)
        return rec
    finally:
        if own: shutil.rmtree(tmp, ignore_errors=True)


def parts_of(name, kind, title, rows, limit=LIMIT):
    """(name, title, rows) for each part the duration guard makes"""
    ps = split(rows, limit)
    if len(ps) == 1: return [(name, title, rows)]
    return [("%s-part%d" % (name, i + 1), "%s, part %d of %d" % (title, i + 1, len(ps)), p) for i, p in enumerate(ps)]


def uploaded():
    try:
        d = json.load(open(LEDGER, encoding="utf-8"))
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def pending(cat, cap, limit=LIMIT):
    """the compilations no upload has recorded, in catalogue order, cap at most"""
    done = uploaded()
    out = []
    for n, (kind, title, rows) in cat.items():
        for pn, _, _ in parts_of(n, kind, title, rows, limit):
            if pn not in done: out.append(n); break
        if len(out) >= cap: break
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("names", nargs="*", help="compilation names, or a family: verses, words, know")
    ap.add_argument("--pending", action="store_true", help="what compilations.json has not seen, in catalogue order")
    ap.add_argument("--max", type=int, default=4, help="with --pending: at most this many (the day's quota)")
    ap.add_argument("--list", action="store_true", help="the catalogue, and what is uploaded")
    ap.add_argument("--manifest", default=None, help="reels/index.json")
    ap.add_argument("--reels", default=None, help="a directory holding <id>.mp4 already (no download)")
    ap.add_argument("--out", default=os.path.join(HERE, "out"))
    ap.add_argument("--limit", type=float, default=LIMIT, help="seconds a part may run")
    ap.add_argument("--encode", action="store_true", help="re-encode rather than copy, whatever the probe says")
    a = ap.parse_args(argv)

    rows = load_manifest(a.manifest)
    cat = catalogue(rows)
    if a.list:
        done = uploaded()
        for n, (kind, title, rs) in cat.items():
            est = sum(secs_of(r) for r in rs)
            mark = "uploaded " + done[n].get("video", "") if n in done else "not yet"
            print("  %-18s %3d reels  ~%s  %s  %s" % (n, len(rs), hms(est), mark, title))
        return 0
    want = pending(cat, a.max, a.limit) if a.pending else expand(a.names, cat)
    if not want:
        print("nothing to build" + (": every compilation is uploaded" if a.pending else ""))
        return 0
    made = []
    for n in want:
        kind, title, rs = cat[n]
        for pn, pt, prs in parts_of(n, kind, title, rs, a.limit):
            print("%s: %d reels" % (pn, len(prs)), flush=True)
            rec = build(pn, kind, pt, prs, a.out, a.reels, force_encode=a.encode)
            made.append(rec)
            print("  %s  %s  %.1f MB  joined by %s" % (pn + ".mp4", hms(rec["secs"]), rec["bytes"] / 1e6, rec["joined"]), flush=True)
    with open(os.path.join(a.out, "made.json"), "w", encoding="utf-8") as f:
        json.dump([{k: v for k, v in m.items() if k != "description"} for m in made], f, ensure_ascii=False, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
