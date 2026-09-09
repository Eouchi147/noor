#!/usr/bin/env python3
"""The two rooms of the library that are not JSON, read without a browser.

`plan_build.py` writes the reels for the 99 Names and for the du'as of the
Path, and `copy_audit.py` proves every word of them against the same source.
Both live inside the site's own pages rather than in `build/`, so they are
read from there, and read the same way twice, so the plan and the audit can
never disagree about what the library says.

    allah.html   `const NAMES = [...]`, an array of arrays. It is written by
                 the generator with double quoted strings and numbers only, so
                 the literal is JSON and is parsed as JSON, not with a regular
                 expression that would quietly take half a sentence.

                 [ar, translit, meaning, [root, gloss, essay, ref, verse_ar,
                                          verse_en, n, action]]

    words.js     `const WORDS = { verses: [ ... ] }`, the du'as: object
                 literals with unquoted keys and one template literal
                 (`details`) that no JSON parser will take. Only the five
                 plain fields are wanted, and each is read from its own entry
                 by name, so a change to `details` cannot move them.

Nothing here writes anything. NOOR_ROOT points at the site.
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get("NOOR_ROOT") or os.path.join(HERE, "..", "..")

_NAMES = None
_DUAS = None


def _slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def names():
    """the 99 Names, in the order the page has them.

    dict: slug -> {ar, translit, meaning, root, gloss, essay, ref, verse_en, action}
    """
    global _NAMES
    if _NAMES is not None:
        return _NAMES
    src = open(os.path.join(ROOT, "allah.html"), encoding="utf-8").read()
    i = src.index("const NAMES")
    j = src.index("\n];", i)
    rows = json.loads(src[src.index("[", i):j + 2])
    out = {}
    for k, r in enumerate(rows):
        ar, translit, meaning, more = r[0], r[1], r[2], (r[3] or [])
        e = {"ar": ar, "translit": translit, "meaning": meaning, "n": k + 1,
             "root": more[0] if len(more) > 0 else "",
             "gloss": more[1] if len(more) > 1 else "",
             "essay": more[2] if len(more) > 2 else "",
             "ref": more[3] if len(more) > 3 else "",
             "verse_ar": more[4] if len(more) > 4 else "",
             "verse_en": more[5] if len(more) > 5 else "",
             "action": more[7] if len(more) > 7 else ""}
        # two of the ninety nine transliterate the same (الماجد and المجيد are
        # both Al-Majid): the second keeps its place in the list by number
        slug = _slug(translit)
        if slug in out: slug = "%s-%d" % (slug, k + 1)
        e["slug"] = slug
        out[slug] = e
    _NAMES = out
    return out


_FIELD = r'%s:"((?:[^"\\]|\\.)*)"'


def duas():
    """the du'as of the Path, from words.js.

    dict: id -> {ar, translit, meaning, role, summary, title}
    """
    global _DUAS
    if _DUAS is not None:
        return _DUAS
    src = open(os.path.join(ROOT, "words.js"), encoding="utf-8").read()
    out = {}
    for m in re.finditer(r'\{id:"(w-[a-z0-9\-]+)"', src):
        cid = m.group(1)
        chunk = src[m.start():m.start() + 4000]
        got = {}
        for want in ("titleEn", "titleAr", "translit", "meaning", "role", "summary"):
            f = re.search(_FIELD % want, chunk)
            if f:
                got[want] = f.group(1).encode().decode("unicode_escape") if "\\u" in f.group(1) else f.group(1)
        if not {"titleAr", "translit", "meaning", "summary"} <= set(got):
            continue
        out[cid] = {"ar": got["titleAr"], "translit": got["translit"],
                    "meaning": got["meaning"], "role": got.get("role", ""),
                    "summary": got["summary"], "title": got.get("titleEn", "")}
    _DUAS = out
    return out


def sentences(text):
    """a passage cut where it pauses, so one sentence can be lifted whole"""
    text = re.sub(r"\s+", " ", text or "").strip()
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def pick_sentence(text, lo=55, hi=200):
    """the first sentence of a passage that a reel can carry, verbatim.

    A sentence with an em or en dash is passed over rather than edited, and so
    is one that says God where the house says Allah: the words on screen are
    the library's own, and the ones that are not the house's voice are simply
    not the ones that get used.
    """
    for s in sentences(text):
        if not (lo <= len(s) <= hi):
            continue
        if "—" in s or "–" in s:
            continue
        if re.search(r"\bGod\b", s):
            continue
        if s.startswith(("And ", "But ")):
            continue
        return s
    return ""


if __name__ == "__main__":
    N, D = names(), duas()
    print("%d names, %d du'as" % (len(N), len(D)))
    miss = [k for k, v in N.items() if not pick_sentence(v["essay"])]
    print("names with no sentence that fits: %d %s" % (len(miss), miss[:8]))
    miss = [k for k, v in D.items() if not pick_sentence(v["summary"] + " " + v["role"])]
    print("du'as with no sentence that fits: %d %s" % (len(miss), miss[:8]))
