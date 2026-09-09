#!/usr/bin/env python3
"""NOOR reel · One verse: the text, the translation, and the voice.

Three sources, none of them typed by hand:

  the Arabic     quran-uthmani.json beside this file: the Tanzil Uthmani text,
                 the same edition the Mushaf page puts on screen. A Quran
                 reel cannot afford a remembered letter.
  the meaning    Saheeh International, the translation the Mushaf page shows,
                 fetched from api.alquran.cloud once per verse and kept in
                 verses.json so the copy audit can prove every sentence.
  the voice      everyayah.com, verse by verse, from a roster of reciters.
                 A different reciter each time, chosen so the reel stays a
                 reel: the slow mujawwad readings only on short verses, the
                 murattal readings on anything longer, and any reading that
                 still runs past the limit gives way to the next.

    python3 verses.py fetch        fill verses.json for every verse in plan.json
    python3 verses.py voices       fetch and measure the recitation of each
"""
import hashlib, json, os, re, subprocess, sys, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
TEXT = os.path.join(HERE, "quran-uthmani.json")
TRANS = os.path.join(HERE, "verses.json")
CACHE = os.environ.get("NOOR_VOICE_DIR") or os.path.join(HERE, "cache", "voice")
EDITION = "en.sahih"
API = "https://api.alquran.cloud/v1/ayah/%s/" + EDITION
EVERYAYAH = "https://everyayah.com/data/%s/%03d%03d.mp3"
MAX_VOICE = 46.0        # seconds of recitation a reel can carry

# (folder on everyayah, name as printed, pace)  pace: mujawwad is the slow,
# ornamented reading; murattal the measured one. Folder names are verbatim
# from the site's index.
ROSTER = [
    ("Abdul_Basit_Mujawwad_128kbps",      "Abdul Basit Abd us-Samad", "mujawwad"),
    ("Alafasy_128kbps",                   "Mishary Rashid Alafasy",   "murattal"),
    ("Minshawy_Mujawwad_192kbps",         "Mohamed Siddiq al-Minshawi", "mujawwad"),
    ("Husary_128kbps",                    "Mahmoud Khalil al-Husary", "murattal"),
    ("Abdurrahmaan_As-Sudais_192kbps",    "Abdur-Rahman as-Sudais",   "murattal"),
    ("Mohammad_al_Tablaway_128kbps",      "Mohammad al-Tablawi",      "mujawwad"),
    ("Saood_ash-Shuraym_128kbps",         "Saud ash-Shuraym",         "murattal"),
    ("Abdul_Basit_Murattal_192kbps",      "Abdul Basit Abd us-Samad", "murattal"),
    ("Yasser_Ad-Dussary_128kbps",         "Yasser ad-Dossari",        "murattal"),
    ("Husary_128kbps_Mujawwad",           "Mahmoud Khalil al-Husary", "mujawwad"),
    ("Muhammad_Ayyoub_128kbps",           "Muhammad Ayyub",           "murattal"),
    ("Abu_Bakr_Ash-Shaatree_128kbps",     "Abu Bakr ash-Shatri",      "murattal"),
    ("Minshawy_Murattal_128kbps",         "Mohamed Siddiq al-Minshawi", "murattal"),
    ("Nasser_Alqatami_128kbps",           "Nasser al-Qatami",         "murattal"),
    ("Hani_Rifai_192kbps",                "Hani ar-Rifai",            "murattal"),
    ("Muhammad_Jibreel_128kbps",          "Muhammad Jibril",          "murattal"),
    ("MaherAlMuaiqly128kbps",             "Maher al-Muaiqly",         "murattal"),
    ("Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net", "Ahmad al-Ajmi", "murattal"),
    ("Khaalid_Abdullaah_al-Qahtaanee_192kbps", "Khalid al-Qahtani",   "murattal"),
    ("Hudhaify_128kbps",                  "Ali al-Hudhaifi",          "murattal"),
]
SHORT = 130             # Arabic characters: below this a mujawwad reading fits

_T = None


def text():
    global _T
    if _T is None:
        _T = json.load(open(TEXT, encoding="utf-8"))
    return _T


def parse(ref):
    """'2:255' -> (2, 255, 255); '94:5-6' -> (94, 5, 6)"""
    m = re.fullmatch(r"(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?", str(ref).strip())
    if not m: raise SystemExit("not a verse reference: " + str(ref))
    s, a, b = int(m.group(1)), int(m.group(2)), int(m.group(3) or m.group(2))
    if b < a: raise SystemExit("backwards range: " + ref)
    if b - a > 7: raise SystemExit("more than eight verses is a page, not a reel: " + ref)
    return s, a, b


def arabic(ref):
    """the verses, Uthmani, joined with the ayah mark between them"""
    s, a, b = parse(ref)
    V = text()["verses"]
    parts = []
    for n in range(a, b + 1):
        k = "%d:%d" % (s, n)
        if k not in V: raise SystemExit("no such verse: " + k)
        parts.append(V[k].strip())
    return " ۝ ".join(parts) if len(parts) > 1 else parts[0]


def surah(ref):
    s = parse(ref)[0]
    return text()["surahs"][str(s)]


def label(ref):
    s, a, b = parse(ref)
    name = surah(ref)["translit"]
    return "%s · %d:%d" % (name, s, a) + ("-%d" % b if b != a else "")


# ---------------------------------------------------------------- the meaning

def translations():
    try: return json.load(open(TRANS, encoding="utf-8"))
    except FileNotFoundError: return {"edition": EDITION, "verses": {}}


DOWN = set()            # hosts that refused this run: asked once, not twenty times


def _get(url, binary=False, tries=3):
    host = url.split("/")[2]
    if host in DOWN: raise IOError(host + " is not answering this run")
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "NOOR reels (noorcodex.com)"})
            with urllib.request.urlopen(req, timeout=25) as r:
                return r.read() if binary else json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404: raise
            last = e
        except Exception as e:                   # timeouts, resets, DNS
            last = e
        import time; time.sleep(1.5 * (i + 1))
    if isinstance(last, (urllib.error.URLError, TimeoutError, OSError)) and not isinstance(last, urllib.error.HTTPError):
        DOWN.add(host)
    raise IOError("%s: %s" % (url, last))


def fetch_translations(refs):
    """fill verses.json for every verse of every reference, once. A verse
    that cannot be fetched is left out and named; its card is set aside by
    the renderer rather than the run being lost."""
    T = translations()
    V = T.setdefault("verses", {})
    T["edition"] = EDITION
    got, missed = 0, []
    for ref in refs:
        s, a, b = parse(ref)
        for n in range(a, b + 1):
            k = "%d:%d" % (s, n)
            if k in V: continue
            try:
                j = _get(API % k)
                d = j.get("data") or {}
                if not d.get("text"): raise IOError("no text in the answer")
                V[k] = {"text": d["text"].strip(), "surah": (d.get("surah") or {}).get("englishName", "")}
                got += 1
                json.dump(T, open(TRANS, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            except Exception as e:
                missed.append("%s (%s)" % (k, e)); continue
    json.dump(T, open(TRANS, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if missed: print("  not fetched:", "; ".join(missed[:8]), ("... %d more" % (len(missed) - 8)) if len(missed) > 8 else "")
    return got


def meaning(ref):
    """the translation of the whole reference, or None if not fetched yet"""
    s, a, b = parse(ref)
    V = translations()["verses"]
    parts = []
    for n in range(a, b + 1):
        e = V.get("%d:%d" % (s, n))
        if not e: return None
        parts.append(e["text"])
    return " ".join(parts)


def sentences(txt, limit=120):
    """the meaning in pieces a phone reads in one breath, split only where
    the translation itself pauses, never inside a clause"""
    txt = re.sub(r"\s+", " ", txt).strip()
    bits = re.split(r"(?<=[.;:!?])\s+(?=[A-Z\"'\[(])", txt)
    out = []
    for b in bits:
        if out and len(out[-1]) + 1 + len(b) <= limit * 0.6:
            out[-1] += " " + b
        else:
            out.append(b)
    # a single piece that is still too long is cut at commas
    final = []
    for b in out:
        if len(b) <= limit * 1.35:
            final.append(b); continue
        cur = ""
        for c in re.split(r"(?<=,)\s+", b):
            if cur and len(cur) + 1 + len(c) > limit:
                final.append(cur); cur = c
            else:
                cur = (cur + " " + c).strip()
        if cur: final.append(cur)
    return final


# ---------------------------------------------------------------- the voice

def _length(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
    try: return float(out)
    except ValueError: return 0.0


def _fetch_mp3(folder, s, n):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, "%s-%03d%03d.mp3" % (folder.replace("/", "_"), s, n))
    if os.path.exists(path) and os.path.getsize(path) > 2000: return path
    data = _get(EVERYAYAH % (folder, s, n), binary=True)
    if len(data) < 2000: raise IOError("too small")
    # written whole or not at all: the render workers fetch side by side now,
    # and two verses of one surah can share an ayah
    tmp = "%s.%d.part" % (path, os.getpid())
    open(tmp, "wb").write(data); os.replace(tmp, path)
    return path


def _joined(folder, s, a, b):
    """one file for a range: the ayahs decoded and joined with a short rest"""
    if a == b: return _fetch_mp3(folder, s, a)
    out = os.path.join(CACHE, "%s-%03d%03d-%03d.wav" % (folder.replace("/", "_"), s, a, b))
    if os.path.exists(out): return out
    parts = [_fetch_mp3(folder, s, n) for n in range(a, b + 1)]
    lst = os.path.join(CACHE, "join-%s.txt" % hashlib.md5(out.encode()).hexdigest()[:8])
    # a 0.45 s rest between ayahs, made with ffmpeg so no sample is resampled twice
    with open(lst, "w") as f:
        for i, pth in enumerate(parts):
            f.write("file '%s'\n" % os.path.abspath(pth))
            if i < len(parts) - 1:
                gap = os.path.join(CACHE, "gap.wav")
                if not os.path.exists(gap):
                    tmp = os.path.join(CACHE, "gap.%d.part.wav" % os.getpid())
                    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
                                    "anullsrc=r=44100:cl=mono", "-t", "0.45", tmp], check=True)
                    os.replace(tmp, gap)
                f.write("file '%s'\n" % os.path.abspath(gap))
    tmp = out[:-4] + ".%d.part.wav" % os.getpid()
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst,
                    "-ar", "44100", "-ac", "1", tmp], check=True)
    os.replace(tmp, out)
    return out


def pool_for(ref):
    """which readings fit this verse: everything for a short one, only the
    measured readings for a long one"""
    n = len(re.sub(r"[ً-ْٰۖ-ۭ\s]", "", arabic(ref)))
    if n <= SHORT: return list(ROSTER)
    return [r for r in ROSTER if r[2] == "murattal"]


def choose(ref, ordinal, pool=None):
    """the reciter for this card: the pool rotated by the card's place in the
    plan, so consecutive verse reels are read by different voices"""
    pool = pool or pool_for(ref)
    return pool[ordinal % len(pool)]


TRY_AT_MOST = 5         # readings asked for per verse per run, not the whole roster


def audio_for(card):
    """(path, reciter name) for a verse card, fetching what is not cached and
    stepping to the next reciter when a reading runs past the limit or the
    file is not there. The choice, once made, is written beside the cache so
    the audit and the render, and next week's run, all read the same voice."""
    ref = card["verse"]
    s, a, b = parse(ref)
    os.makedirs(CACHE, exist_ok=True)
    memo = os.path.join(CACHE, "choice-%s.json" % ref.replace(":", "-"))
    try:
        m = json.load(open(memo))
        if os.path.exists(m["path"]) and 0.5 < _length(m["path"]) <= MAX_VOICE:
            return m["path"], m["who"]
    except (OSError, ValueError, KeyError):
        pass
    pool = pool_for(ref)
    ordinal = int(card.get("ordinal", 0))
    forced = card.get("reciter_dir")
    tried = []
    order = [choose(ref, ordinal + i, pool) for i in range(min(TRY_AT_MOST, len(pool)))]
    if forced:
        order = [r for r in ROSTER if r[0] == forced] + order
    for folder, who, pace in order:
        try:
            path = _joined(folder, s, a, b)
        except Exception as e:
            tried.append("%s: %s" % (folder, e))
            if "not answering" in str(e): break
            continue
        secs = _length(path)
        if 0.5 < secs <= MAX_VOICE:
            json.dump({"path": path, "who": who, "folder": folder, "secs": secs}, open(memo, "w"))
            return path, who
        tried.append("%s: %.0fs" % (folder, secs))
    raise SystemExit("no reading of %s fits a reel: %s" % (ref, "; ".join(tried)))


def card_text(c):
    """what the type layer needs for a verse card, from the sources"""
    ref = c["verse"]
    m = meaning(ref)
    if m is None:
        raise SystemExit("verses.json has no translation for %s: run verses.py fetch" % ref)
    return {"ar": arabic(ref), "ref": label(ref), "sents": sentences(m),
            "eyebrow": c.get("eyebrow", "One verse")}


if __name__ == "__main__":
    cmd = (sys.argv[1:] or ["fetch"])[0]
    plan = json.load(open(os.path.join(HERE, "plan.json")))["cards"]
    refs = [c["verse"] for c in plan.values() if c.get("kind") == "verse"]
    if cmd == "fetch":
        print("%d verses in the plan, %d fetched now" % (len(refs), fetch_translations(refs)))
    elif cmd == "voices":
        for cid, c in plan.items():
            if c.get("kind") != "verse": continue
            path, who = audio_for(c)
            print("%-28s %-8s %5.1fs  %s" % (cid, c["verse"], _length(path), who))
    else:
        raise SystemExit(__doc__)
