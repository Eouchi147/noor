# NOOR translations · resume file

Written 2 September 2026 so that a future session can pick the translation work
up without the conversation that produced it. Read this whole file first, then
`i18n/TRANSLATOR-BRIEF.md` (the contract every translator batch is given), then
run `python3 scripts/i18n.py status` and `python3 scripts/i18n-audit.py`.

Sam's standing rules that apply here: he deploys by dragging files into
GitHub's web interface (never ask him to run git or a terminal); at most 100
files per drag; every delivery is production-ready, no half finished packs;
whenever he has to do anything, give him a simple, detailed, beautifully
organised HTML step by step. Priorities he set: Dari, German and Russian
first (done), then the languages his readers use most, eventually all 21 at
100%. Translation was paused by him on 2 Sep 2026 ("leave the translation for
later"), then the kids wing was re-prioritised the same day ("not everything is
translated in the kid's codex").

## 1. How the system works

* Corpus: `i18n/text/en.json` = `{"_meta":…, "s": {key: englishString}}`.
  14,182 strings, 228,721 words. Keys are stable content hashes, so a pack
  entry survives page edits only while the English text is byte-identical.
* Key = FNV-1a 32-bit twice, seeds `0x811C9DC5` and `0x7B5C1A9F`, over the
  UTF-16 code units of the whitespace-normalised string
  (`s.replace(/\s+/g," ").trim()`), formatted `%08x%08x`. The browser
  (`assets/noor-text.js`) and the harvester (`scripts/extract-text.py`) agree
  on this; emoji strings used to disagree (code points vs UTF-16 units) and
  were fixed on 2 Sep 2026.
* Packs: `i18n/text/<code>.json` = `{"_meta":{"language","base","coverage"},
  "s":{key: translation}}`, minified, `ensure_ascii=False`. Languages:
  ar ur fr es de ru tr id hi bn fa prs pa ps ha so ku sw zh ja ko.
* Runtime: `assets/noor-text.js` fetches `/i18n/text/<code>.json?v=85` with
  `cache: "force-cache"` and swaps every matching text node (MutationObserver,
  so JS-rendered text too). Untranslated strings simply stay English.
  **Every time packs change, bump `PACK_V` (the `?v=` number) in
  `assets/noor-text.js` and `V` in `sw.js`, and ship both files with the packs;
  otherwise returning readers keep the old packs forever.** Current: v=85 and
  noor-v114.
* `i18n/text/priority.json` (4,050 keys) is the old "first strings" list; the
  packs at ~4,016 entries (tr id hi bn fa pa) hold exactly that set. `qa.json`
  is a pseudo-locale for tests. `ui-en.json`/`ui-delta.json` are older UI
  packs, left alone.
* Tools: `scripts/i18n.py status | todo <code> [n] | merge <code>`,
  `scripts/i18n-audit.py [codes]`, `tests/i18n.mjs` (needs the static server:
  `python3 /tmp/vercelish.py <repo> 8433`, see tests/anime.mjs header for the
  same server), `scripts/extract-text.py` (re-harvests the corpus, see §4).

## 2. Coverage at the end of 2 Sep 2026

    corpus 14,182 strings, 228,721 words
    ar 100%  fr 100%  prs 100%  es 72%  de 72%  ru 71%  ur 7%
    tr id hi bn fa pa 5%  ps ha so ku sw zh ja ko ~0% (only pass-through strings)

The daily light library is separate from the corpus and lives in
`lights/i18n/<lang>.json`: 350 cards each, done for ar de es fr prs ru.
Every other language gets the Lantern's translation of the day at request time
(see api/illuminations.js, function `speak`), cached once per language per day.

## 3. The batch procedure that worked (de, ru, prs, and the kids strings)

1. `python3 scripts/i18n.py todo <code> 20000` writes `i18n/text/jobs/<code>.json`
   with every untranslated string (pass-through strings such as "Bukhari 95"
   are folded into the pack automatically first).
2. Split that job into batches of roughly 9,000 English words (about 500 to
   900 strings). Each batch is one subagent run: give it the batch file, the
   brief (`i18n/TRANSLATOR-BRIEF.md`), the target language, and ask for an
   `.out.json` with exactly the same keys. Dispatch batches in parallel
   (20 at a time ran fine).
3. Audit every out file before merging: same key set, no empty values, no em
   or en dashes, ayah and hadith numbers unchanged, `{{c:id|label}}` ids
   intact, and, for the wording rule below, no "Dieu/Dios/Gott/Бог/خدا" where
   the English says Allah.
4. Put the out files in `i18n/text/_<code>wave/` (any directory named
   `_<code>*` or `<code>parts` is read) and run `python3 scripts/i18n.py merge
   <code>`. Files in the legacy `N|text` line format are skipped on purpose.
5. `python3 scripts/i18n.py status`, `python3 scripts/i18n-audit.py <code>`,
   `node tests/i18n.mjs`. Then bump PACK_V and sw.js V, zip the packs plus
   `assets/noor-text.js` and `sw.js`, deliver with the HTML step by step.

Wording rule for translators (Sam, 2 Sep 2026): both "God" and "Allah" are
allowed in English, the most natural for its context; inside relayed Qur'an or
hadith wording, "Allah's Messenger" and fixed Arabic formulas the Codex says
Allah, and the translation must say Allah there too (fr Allah, es Allah, de
Allah/Allahs, ru Аллах declined, prs الله). No em or en dashes anywhere.

## 4. What is waiting, in order

### 4a. DONE on 2 Sep 2026: the kids wing is in the corpus
`scripts/harvest-kids.mjs` opens the hub and all fifteen rooms in a browser,
plays them, folds in the per-room sidecar lists, and adds what it finds to
`i18n/text/en.json` without ever removing a key. It found 644 new strings
(4,027 words), now translated into ar de es fr prs ru. Two things to know if
you run it again: it must never click a language button (it is guarded, and the
guard is why the first run had to be thrown away), and the sidecars live in
`/root/mushaf/kids/strings/` in the session that built the rooms, so pass
`NOOR_KIDS_STRINGS` if they are somewhere else.

### 4b. Re-translate what was stripped from es, de, ru
`i18n/retranslate.json` lists the keys (es 3,632 keys / 63,869 words; de 4,111
/ 65,160; ru 4,139 / 65,193). Why: the packs committed at the Aug 30 base
attached translations to the wrong strings for every entry at corpus
positions 0 to 6633 and 12996 onward (an old wave was merged by line index
against a corpus that had since been re-ordered). Those entries were removed on
2 Sep 2026 so the pages fall back to English; 476 Spanish entries were
recovered from the legacy `_esparts` files through the priority order. Run
the batch procedure on exactly these keys (build the job file from the list,
not from `todo`, if you want them first). Positions 6634 to 12995 of the old
packs were verified right and kept.

### 4c. The corpus is still short of the site
Most of the 44,780 words that were missing turned out to be the daily light
library, now handled separately (§2). What remains is roughly a thousand
sentences on the deeper pages plus about 2,300 templated strings from the
dictionary landing pages. `scripts/harvest-kids.mjs` is the pattern to copy:
open the pages in a browser, add, never remove. `scripts/extract-text.py`
OVERWRITES `i18n/text/en.json`, so diff it rather than running it in place.

### 4d. The remaining languages to 100%
Sam's tiers: after the kids wing, whichever languages matter most to his
readers (Urdu, Turkish, Indonesian, Bengali, Hindi, Persian, Punjabi are at the
priority set), then Pashto, Hausa, Somali, Kurdish, Swahili, Chinese, Japanese,
Korean. Roughly 210,000 English words per language.

### 4e. Housekeeping Sam can do in GitHub
Dead copies safe to delete: the root `text/` directory (an old copy of the
packs, nothing loads it), `locales/en.json`, `i18n/text/_esparts`,
`i18n/text/_frparts`, `i18n/text/trparts` (legacy line-format parts, already
folded in), and the stray directory `study 2/` (a duplicate of `study/`).
Old GSAP files in `assets/` are unreferenced since the anime.js layer.

### 4f. Light packs for the remaining fifteen languages
`/root/mushaf/lights/` holds the job files (`job-00.json` .. `job-11.json`,
30 cards each) and `BRIEF.md`, the contract. One agent per three job files
worked well. Assemble with the audit in this file's history: same ids, same
keys, no em or en dashes, every number in the English present in the
translation, the honorific count per field unchanged, and the four character
limits (c 26, t 96, s 1200, d 64). Write the result as
`{"n":350,"lang":"<code>","lights":{...}}` to `lights/i18n/<code>.json`, then
`node tests/lightlang.mjs`.

## 5. Where the tooling from the 2 Sep session lived
The one-off scripts (`god_allah.py`, `rekey.py`, `strip_bad_packs.py`) were in
the session workspace and are not needed again; their logic is described
above and their effects are in the repo. `scripts/i18n-audit.py` is the
durable piece: run it after every merge.
