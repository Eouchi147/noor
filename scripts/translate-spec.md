# NOOR translation task (one language per agent)

You are translating the full language pack of NOOR Codex of Light, a premium Islamic site, into ONE target language given in your instructions.

## Source
/home/claude/noor/i18n/en.json (~3470 lines, ~600 KB). Sections: `_meta` (skip it), `ui` (210 flat keys), `nodes` (71 records of the timeline of creation, prophets, Seerah, end of times), `characters` (98), `places` (34), `words` (18). Read it in slices with the Read tool (offset/limit). Every string VALUE must be translated; keys, ids and structure stay identical.

## Output method (mandatory)
Write your translation as PART FILES, each a valid JSON object mirroring a subset of the pack shape:
- /home/claude/noor/i18n/tmp-CODE-p01.json  = {"ui": { ...all 210 keys... }}
- tmp-CODE-p02.json ... p05.json            = {"nodes": { ...about 18 records each... }}
- tmp-CODE-p06.json ... p08.json            = {"characters": { ...about 33 each... }}
- tmp-CODE-p09.json                         = {"places": { ...all 34... }}
- tmp-CODE-p10.json                         = {"words": { ...all 18... }}
(CODE = your language code. More or fewer parts is fine; every part must parse as JSON.)

Then run: `cd /home/claude/noor && node scripts/merge-pack.mjs CODE`
It validates key parity, array lengths, untouched refs, and style bans, then writes i18n/CODE.json. If it prints FAILED, fix the listed problems and run it again until it prints OK. Do not finish before OK.

## Translation rules
1. Translate VALUES only. Never keys, never `id` semantics, never structure.
2. NEVER alter: ayah refs like "2:255" (any leaf key named `ref`), numbers and counts, the marker syntax `{{n:ID|label}}` and `{{c:id|label}}` (translate ONLY the label after the pipe, keep ID exactly), embedded Arabic phrases (they are the sacred/ornamental layer, e.g. "نُورٌ عَلَىٰ نُورٍ" stays as is), the ﷺ mark (keep it after the Prophet's ﷺ name), and the brand word NOOR.
3. `quran[].en` values are renderings of the meaning of the Quran. Translate the meaning carefully into the target language in the classic register of that language's established Quran translations, WITHOUT copying any existing copyrighted translation. These must be reverent and exact.
4. `hadith[].source` values like "Bukhari 95": keep the collection name in the form your language's Islamic literature uses (transliterate if natural), keep the number unchanged.
5. Proper names (Ibrahim, Musa, Maryam, Jibril...) take the standard Islamic form used in the target language.
6. Register: reverent, literary, warm and CLEAR. Use the target language's living Islamic vocabulary (the words the community actually uses for prayer, fasting, etc.). Simple words carrying complex ideas, never bland, never academic-dry.
7. STYLE BANS (validator enforces): no em-dashes or en-dashes anywhere (use commas, colons, periods), no emoji. Use the target language's own quotation marks and punctuation conventions otherwise.
8. Keep Western digits (0-9) in refs and counts.
9. If the target language is written right-to-left, simply write natural RTL text; the site handles direction.

## Finishing
Final message: one line only: "CODE ok: merge passed" plus anything you had to decide (max 15 words).
