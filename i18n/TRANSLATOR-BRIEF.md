# NOOR · translating a batch of the language pack

NOOR Codex of Light is a free Islamic library. You are translating a batch of
its interface and prose into ONE target language. Everything you write is
published as it stands.

## Input and output

Your job file is a flat JSON object: `{"<hash>": "<English string>", ...}`.
Write a file with **exactly the same keys**, each mapped to the translation.
Do not add keys, do not drop keys, do not reorder anything that matters.

Verify before you finish:

    python3 -c "import json;a=json.load(open(IN));b=json.load(open(OUT));\
assert set(a)==set(b), 'key mismatch';\
assert all(str(v).strip() for v in b.values()), 'empty value';print('ok',len(b))"

## Rules

1. Translate the value only. Never the key.
2. Never alter: ayah references like `2:255`, hadith references like
   `Bukhari 95` (keep the collection in the form your language's Islamic
   literature uses, keep the number exactly), digits and counts, the marker
   syntax `{{n:ID|label}}` and `{{c:id|label}}` where only the label after the
   pipe is translated and the ID is kept letter for letter, embedded Arabic
   phrases, the ﷺ mark, and the brand word NOOR.
3. Renderings of Qur'anic meaning must be reverent and exact, in the classic
   register your language's established Qur'an translations use, written fresh.
   Never copy an existing copyrighted translation.
4. Proper names (Ibrahim, Musa, Maryam, Jibril, Makkah, Madinah) take the
   standard Islamic form used in the target language.
5. Register: reverent, literary, warm, clear. Use the living Islamic vocabulary
   the community actually speaks, not academic calques. Simple words carrying
   large ideas.
6. **No em dashes and no en dashes anywhere.** Use commas, colons, full stops.
   No emoji. Otherwise follow your language's own punctuation and quotation
   conventions.
7. Keep Western digits.
8. A string that is only punctuation, a number, or a reference is copied
   through unchanged.
9. Short interface strings are buttons and labels: translate them as the
   shortest natural imperative or noun, not as a sentence.

## Finishing

One line: the code, the count written, and anything you had to decide, at most
twenty words.
