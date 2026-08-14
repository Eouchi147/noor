#!/usr/bin/env python3
"""NOOR · the text harvest.

Walks every page and collects each unique visible string into i18n/text/en.json,
keyed by a short stable hash of the string itself. Nothing in the markup changes:
the runtime finds a text node, hashes what is in it, and swaps it if the loaded
language has that hash. That means a half finished language is not a broken page,
it is a page with some English left in it, which is exactly the honest behaviour.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "i18n", "text")

PAGES = []
for d, subs, files in os.walk(ROOT):
    rel = os.path.relpath(d, ROOT)
    top = rel.split(os.sep)[0]
    if top in (".git", "node_modules", "i18n", "build", "scripts", "tests", "tracks", "api"):
        continue
    # the language gateways are already in their own language
    if top in ("ar", "fr", "es", "de", "ru", "tr", "ur", "hi", "bn", "id", "fa", "prs",
               "pa", "ha", "ps", "so", "ku", "sw", "zh", "ja", "ko"):
        continue
    for f in sorted(files):
        if f.endswith(".html"):
            PAGES.append(os.path.relpath(os.path.join(d, f), ROOT))
PAGES.sort()

# blocks whose text is never prose
DROP = re.compile(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>|<!--[\s\S]*?-->", re.I)
# an element that opts out
NOTR = re.compile(r'class="[^"]*\bnotranslate\b[^"]*"|translate="no"')
ARABIC = re.compile(r"[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]")
CJK = re.compile(r"[　-ヿ一-鿿가-힯]")


def _fnv(s, seed):
    """FNV-1a, 32 bit. Chosen because the browser has to compute the same key on
    every text node at language change, and it must be synchronous and cheap."""
    h = seed
    for ch in s:
        h ^= ord(ch) & 0xFFFF
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def key(s):
    return "%08x%08x" % (_fnv(s, 0x811C9DC5), _fnv(s, 0x7B5C1A9F))


def strings_of(html):
    """Every translatable text node, in document order."""
    body = DROP.sub(" ", html)
    out, spans = [], []
    # keep <text> inside svg: figure labels are prose too
    for m in re.finditer(r">([^<>]+)<", body):
        raw = m.group(1)
        s = raw.strip()
        if not s:
            continue
        # the element that owns this text node
        start = body.rfind("<", 0, m.start())
        tag = body[start:m.start() + 1]
        if NOTR.search(tag):
            continue
        if not re.search(r"[A-Za-z]", s):        # pure Arabic, numbers, symbols
            continue
        if ARABIC.search(s) or CJK.search(s):    # scripture and names stay
            continue
        if len(s) < 2:
            continue
        if re.fullmatch(r"[\W\d\s]+", s):
            continue
        out.append(re.sub(r"\s+", " ", s))
    return out


def attrs_of(html):
    """Translatable attributes: placeholders, aria labels, titles, alt text."""
    out = []
    for m in re.finditer(r'(?:placeholder|aria-label|title|alt)="([^"]{2,})"', DROP.sub(" ", html)):
        s = re.sub(r"\s+", " ", m.group(1)).strip()
        if s and re.search(r"[A-Za-z]", s) and not ARABIC.search(s):
            out.append(s)
    return out


def main():
    corpus, where = {}, {}
    for rel in PAGES:
        html = open(os.path.join(ROOT, rel), encoding="utf-8").read()
        for s in strings_of(html) + attrs_of(html):
            k = key(s)
            corpus[k] = s
            where.setdefault(k, set()).add(rel)
    reach = {k: len(v) for k, v in where.items()}
    os.makedirs(OUT, exist_ok=True)
    payload = {"_meta": {"strings": len(corpus), "pages": len(PAGES),
                         "words": sum(len(v.split()) for v in corpus.values())},
               "reach": reach, "s": corpus}
    json.dump(payload, open(os.path.join(OUT, "en.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=0, sort_keys=True)
    print("harvest: %d unique strings, %d words, across %d pages"
          % (len(corpus), payload["_meta"]["words"], len(PAGES)))
    tiers = sorted(reach.items(), key=lambda kv: -kv[1])
    print("  reach: %d strings on 5+ pages, %d on 2+, %d on one"
          % (sum(1 for _, n in tiers if n >= 5), sum(1 for _, n in tiers if n >= 2),
             sum(1 for _, n in tiers if n == 1)))


if __name__ == "__main__":
    main()
