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
  13,538 strings, 224,694 words. Keys are stable content hashes, so a pack
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
* Runtime: `assets/noor-text.js` fetches `/i18n/text/<code>.json?v=84` with
  `cache: "force-cache"` and swaps every matching text node (MutationObserver,
  so JS-rendered text too). Untranslated strings simply stay English.
  **Every time packs change, bump `PACK_V` (the `?v=` number) in
  `assets/noor-text.js` and `V` in `sw.js`, and ship both files with the packs;
  otherwise returning readers keep the old packs forever.** Current: v=84 and
  noor-v113.
* `i18n/text/priority.json` (4,050 keys) is the old "first strings" list; the
  packs at ~4,016 entries (tr id hi bn fa pa) hold exactly that set. `qa.json`
  is a pseudo-locale for tests. `ui-en.json`/`ui-delta.json` are older UI
  packs, left alone.
* Tools: `scripts/i18n.py status | todo <code> [n] | merge <code>`,
  `scripts/i18n-audit.py [codes]`, `tests/i18n.mjs` (needs the static server:
  `python3 /tmp/vercelish.py <repo> 8433`, see tests/anime.mjs header for the
  same server), `scripts/extract-text.py` (re-harvests the corpus, see §4).

## 2. Coverage on 2 Sep 2026 (after the repair below)

    ar 100%  fr 100%  prs 100%  es 72%  de 71%  ru 71%  ur 7%
    tr id hi bn fa pa 5%  ps ha so ku sw zh ja ko ~0% (only pass-through strings)

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

### 4a. The kids wing in every language (re-prioritised by Sam on 2 Sep 2026)
`kids.html` and `kids/*.html` (15 rooms plus the hub). The six complete
languages already carry them. For the other 15 languages: harvest the kids
strings (they are in the corpus; filter `scripts/extract-text.py` to the kids
pages or take every key whose string appears in those files), batch, translate,
merge. Watch the runtime strings the hub renders from JS (Noor's lines, the
Little Mushaf interface, surah titles and kid meanings): they are in the corpus
under the same keys.

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

### 4c. The corpus is stale
A fresh harvest (`scripts/extract-text.py`, which OVERWRITES
`i18n/text/en.json`; run it on a copy or diff first) finds 14,677 unique
strings against the 13,538 in the corpus: about 1,647 real sentences on
non-landing pages (44,780 words) that currently show in English in every
language, and about 2,342 templated strings from the dictionary landing pages
(`words/*.html` style pages). When re-harvesting, keep every existing key
(the translations hang off them) and add the new ones; then translate the
delta for the complete languages first (ar fr prs, then es de ru).

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

## 5. Where the tooling from the 2 Sep session lived
The one-off scripts (`god_allah.py`, `rekey.py`, `strip_bad_packs.py`) were in
the session workspace and are not needed again; their logic is described
above and their effects are in the repo. `scripts/i18n-audit.py` is the
durable piece: run it after every merge.
