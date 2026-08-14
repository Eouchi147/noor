#!/usr/bin/env python3
"""Cut the corpus into translation batches, highest value first.

Value here is reach, not length: a string that appears in the header of fifty
pages is worth more than a paragraph buried in one. Batches are sized so one
agent can carry a whole batch and still hold the glossary in mind."""
import json, os, re, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = os.path.join(ROOT, "i18n", "text")
corpus = json.load(open(os.path.join(T, "en.json"), encoding="utf-8"))["s"]

# reach: how many pages carry the string (from the source files, cheap and close enough)
reach = collections.Counter()
for d, subs, files in os.walk(ROOT):
    rel = os.path.relpath(d, ROOT)
    if rel.split(os.sep)[0] in (".git", "node_modules", "i18n", "build", "scripts", "tests", "tracks", "api", "assets"):
        continue
    for f in files:
        if not f.endswith(".html"):
            continue
        html = open(os.path.join(d, f), encoding="utf-8", errors="ignore").read()
        for k, v in corpus.items():
            if len(v) > 8 and v in html:
                reach[k] += 1


# strings that must never be translated: language endonyms, house marks, bare
# attribute names, and anything that is a proper name of the project itself
STOP = {"English","Français","Español","Deutsch","Русский","Türkçe","Bahasa Indonesia",
        "Hausa","Soomaali","Kurdî","Kiswahili","NOOR","NOOR Codex of Light","Codex of Light",
        "NOOR · Codex of Light","description","viewport","utf-8","image/svg+xml","summary",
        "noorcodex.com","hello@noorcodex.com","Amiri","Inter","Qur'an","Qur’an"}

def score(k):
    v = corpus[k]
    n = len(v.split())
    r = reach.get(k, 1)
    # chrome and headings first, long prose last
    return (-r * 8) + n

order = [k for k in sorted(corpus, key=score) if corpus[k] not in STOP and len(corpus[k]) > 1]
BATCH = int(sys.argv[1]) if len(sys.argv) > 1 else 90
out = os.path.join(T, "batches")
os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    os.remove(os.path.join(out, f))
n = 0
for i in range(0, len(order), BATCH):
    chunk = order[i:i + BATCH]
    json.dump({k: corpus[k] for k in chunk},
              open(os.path.join(out, "b%03d.json" % (i // BATCH)), "w", encoding="utf-8"),
              ensure_ascii=False, indent=0)
    n += 1
words = [sum(len(corpus[k].split()) for k in order[i:i + BATCH]) for i in range(0, len(order), BATCH)]
print("%d batches of %d strings · first batch %d words · median %d words · total %d words"
      % (n, BATCH, words[0], sorted(words)[len(words) // 2], sum(words)))
print("batch 0 sample:", " | ".join(corpus[k][:34] for k in order[:5]))
