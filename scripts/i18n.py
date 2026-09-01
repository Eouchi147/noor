#!/usr/bin/env python3
"""NOOR i18n · status, merge, and the queue.

Three commands, so no wave ever repeats work another wave already did:

  status              coverage of every language against the full corpus
  todo <code> [n]     write the next n untranslated strings to a job file
  merge <code>        fold every part file into the language pack, pass through
                      the strings that need no translator, and validate

The pass through matters: a hadith reference, an ayah number and a proper noun
are the same in every language. Sending them to a translator is asking a person
to retype "Bukhari 1369" twenty one times.
"""
import io, json, os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = os.path.join(ROOT, "i18n", "text")
COLL = r'(Bukhari|Muslim|Tirmidhi|Abu Dawud|Ibn Majah|Ahmad|Malik|Nasa\'i|Muwatta|Bayhaqi|Darimi|Hakim)'


def corpus():
    return json.load(io.open(os.path.join(T, "en.json"), encoding="utf-8"))["s"]


def passthrough(v):
    """True when the English is already correct in every language."""
    s = v.strip()
    if re.fullmatch(r"[\W\d\s]+", s):
        return True
    if re.fullmatch(COLL + r"[\s\d:,\.\-]*", s):
        return True
    if re.fullmatch(r"(Qur[’']?an\s*)?\d+:\d+(-\d+)?", s):
        return True
    return False


def pack(code):
    p = os.path.join(T, code + ".json")
    if not os.path.exists(p):
        return {}
    try:
        d = json.load(io.open(p, encoding="utf-8"))
    except Exception:
        return {}
    return d.get("s", d) if isinstance(d, dict) else {}


def write(code, s):
    json.dump({"_meta": {"language": code, "base": "en v61",
                         "coverage": {"strings": len(s), "of": len(corpus())}},
               "s": s},
              io.open(os.path.join(T, code + ".json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))


LANGS = ["ar", "ur", "fr", "es", "de", "ru", "tr", "id", "hi", "bn", "fa", "prs",
         "pa", "ps", "ha", "so", "ku", "sw", "zh", "ja", "ko"]


def part_files(code):
    """Every part file a wave may have left behind, under either layout."""
    files = []
    for d in glob.glob(os.path.join(T, "_%s*" % code)) + glob.glob(os.path.join(T, "%sparts" % code)):
        if not os.path.isdir(d):
            continue
        for root_, _dirs, names in os.walk(d):
            files += [os.path.join(root_, n) for n in sorted(names)]
    return files


def pending(code, have):
    """Part files whose work is NOT already in the pack.

    The old count called every part file "in flight", so a language read as
    unfinished for weeks after its parts had been folded in. What matters is
    whether the pack already carries the text, so that is what is counted."""
    carried = set(str(v).strip() for v in have.values())
    n = 0
    for f in part_files(code):
        try:
            txt = io.open(f, encoding="utf-8").read()
        except Exception:
            continue
        vals = []
        if txt.lstrip().startswith("{"):
            try:
                vals = [str(v).strip() for v in json.loads(txt).values()]
            except Exception:
                vals = []
        else:
            vals = [ln.split("|", 1)[1].strip() for ln in txt.splitlines() if "|" in ln]
        vals = [v for v in vals if v]
        if vals and sum(1 for v in vals if v in carried) < 0.9 * len(vals):
            n += 1
    return n


def cmd_status():
    C = corpus()
    total_w = sum(len(v.split()) for v in C.values())
    print("corpus: %d strings, %d words, %d languages\n" % (len(C), total_w, len(LANGS)))
    done_any = 0
    for code in LANGS:
        s = pack(code)
        have = sum(1 for k in C if k in s and str(s[k]).strip())
        w = sum(len(C[k].split()) for k in C if k in s and str(s[k]).strip())
        parts = pending(code, s)
        bar = "#" * int(round(28 * have / len(C))) + "." * (28 - int(round(28 * have / len(C))))
        print("  %-4s %s %5d/%d strings  %3d%% of words%s"
              % (code, bar, have, len(C), round(100 * w / total_w), ("  (%d parts in flight)" % parts) if parts else ""))
        if have:
            done_any += 1
    print("\n%d of %d languages started" % (done_any, len(LANGS)))


def cmd_todo(code, n):
    C = corpus()
    have = pack(code)
    auto = {k: C[k] for k in C if k not in have and passthrough(C[k])}
    if auto:
        have.update(auto)
        write(code, have)
    todo = [k for k in C if k not in have or not str(have.get(k, "")).strip()]
    # longest reach first is already the batch order; keep the corpus order stable
    todo.sort(key=lambda k: (len(C[k].split()), k))
    chunk = todo[:n]
    out = os.path.join(T, "jobs")
    os.makedirs(out, exist_ok=True)
    p = os.path.join(out, "%s.json" % code)
    json.dump({k: C[k] for k in chunk}, io.open(p, "w", encoding="utf-8"),
              ensure_ascii=False, indent=0)
    print("%s: %d already carried (%d auto), %d still to do, wrote %d to %s"
          % (code, len(have), len(auto), len(todo), len(chunk), os.path.relpath(p, ROOT)))


def cmd_merge(code):
    C = corpus()
    s = pack(code)
    before = len(s)
    got = 0
    skipped = []
    files = part_files(code)
    for f in files:
        try:
            txt = io.open(f, encoding="utf-8").read().strip()
        except Exception:
            continue
        if txt.startswith("{"):
            try:
                for k, v in json.loads(txt).items():
                    if k in C and str(v).strip():
                        s[k] = v; got += 1
            except Exception:
                pass
        else:
            # "index|translation" lines. The index counted positions in a job
            # file that no longer exists, not positions in the corpus, so
            # folding them in by corpus order scatters finished translations
            # onto unrelated keys. This branch used to do exactly that.
            skipped.append(os.path.relpath(f, ROOT))

    for k, v in C.items():
        if k not in s and passthrough(v):
            s[k] = v
    bad = [k for k, v in s.items() if k not in C or not str(v).strip()]
    for k in bad:
        s.pop(k, None)
    dash = sum(1 for v in s.values() if "—" in str(v) or "–" in str(v))
    for k in list(s):
        if isinstance(s[k], str):
            s[k] = s[k].replace("—", ", ").replace("–", ", ")
    write(code, s)
    print("%s: %d -> %d strings (+%d from parts), dropped %d stray, fixed %d dashes, %d%% of corpus"
          % (code, before, len(s), got, len(bad), dash, round(100 * len(s) / len(C))))
    if skipped:
        print("  %d part file(s) skipped: they are keyed by position in a job file,"
              % len(skipped))
        print("  not by string, so they can only be folded in beside that job file.")
        for f in skipped[:6]:
            print("    " + f)


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] == "status":
        cmd_status()
    elif a[0] == "todo":
        cmd_todo(a[1], int(a[2]) if len(a) > 2 else 900)
    elif a[0] == "merge":
        cmd_merge(a[1])
    else:
        print(__doc__)
