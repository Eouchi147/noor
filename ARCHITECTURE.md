# NOOR: the architecture

The shape of the house in one page, for an agent who has never seen it. The audit of 15
September 2026 (`/root/audit/` in the session box, the pack in the owner's folder) is
the long form; `OPERATIONS.md` is the day to day.

## The site

- **Hosting**: Vercel, project `noor-islamic-timeline`, deployed on every commit to `main`
  of `Eouchi147/noor`. Static HTML at the root and in folders; serverless functions in
  `api/`; `vercel.json` holds the rewrites, the caching headers and the crons. Vercel
  Authentication walls every `*.vercel.app` address; only `noorcodex.com` is public, so a
  function that fetches the site must use the site's own name (`publicHost`,
  `manifestHost`, `libraryHost`).
- **Three generations of chrome**: the rendered rooms and the 523 word pages are in the
  second cut's shell (`data-n2`, `assets/noor2.css`, `assets/noor2.js`, version 13); 38
  root pages, the nine stories, six masjid pages and the 21 language doors are older pages
  dressed at runtime by the skin (`noor-fx.js` hides their baked Tailwind header, inserts
  the shell's bar and the night sheets). The audit's batch 6 (`scripts/oldrooms.py`) put
  the 51 pages the map named for it (36 root pages, six masjid pages, the nine stories) on
  a diet: the baked header, once about 21 KB, is now a hidden stub carrying only the three
  ids a script still reaches for (`#site-header`, `#search-toggle`, `#hm-search`); each
  page's `<head>` now links the shell's four sheets directly and carries a small inline
  night style, so first paint is already dark instead of flashing parchment; and the nine
  file kit is down to what `noor-fx.js` cannot already load on its own, since it now
  fetches search on first keystroke and the Ramadan and Dhul Hijjah files only in the
  weeks they fall due. The 21 language doors were not in the map's list and keep their
  old chrome for now.
- **The rooms** (`api/page.js`): `/light/:id` (350), `/path/:n` (71), `/surah/:n` (114),
  `/verse/:ref` (591 with a reel), `/today`, the shelves, and, once batch 5 ships,
  `/prophet/:id` (25), `/companion/:id` (58), `/character/:id` (40), `/place/:id` (34),
  `/name/:n` (99). One shell, canonical, description, Open Graph, JSON-LD, the day at the
  edge, an honest 404. `api/sitemap.js` shares the loaders. The function's `includeFiles`
  in `vercel.json` must list every data file a room reads.
- **The data**: `lights/all.json` (350 Lights, the cleanest model, sources on the badged
  cards); `build/dict-*.json` (523 words in seven domains; no source field yet, arch-014);
  `node/*.json` (71 chapters), `study/*.json` (114 surahs), `tools/reels/quran-uthmani.json`
  (the whole text), `verse/*.json` (notes for 1,280 verses), `prophets-data.js`,
  `characters.js`, `places.js`, `allah.html`'s Names, `words.js` (the du'as),
  `madrasa-data.js`, `assets/menu-index.json` (the map of the house), `assets/search-index.json`
  (the site search), `assets/entity-graph.json` (batch 5, the graph's edges the rooms
  use, now derived rather than hand kept; see "The Content Graph" below). The graph
  itself (`build/graph/noor-content-graph.json`, git ignored, rebuilt on demand: about
  6,950 nodes and 27,000 edges over 18 types) is built by `scripts/graph/run.sh`.
- **Generators** (`scripts/`, never deployed): `gen-dictionary.py` (the hub and the word
  pages, run by the `dictionary` workflow with a guard), `gen-lights.py`,
  `gen-quran-study.py`, `gen-dict-index.py`, `build.mjs` (the Path), `build-questions.py`,
  `nav49.py` (the old header), and page generators that drift from their pages
  (arch-010; the `generators` workflow of batch 5 reports drift).
- **Tests**: `tests/*.mjs`, one file per promise, `node tests/<name>.mjs`; 36 run without
  a browser (the `tests` workflow of batch 5), the rest need Playwright and a local server.
- **The consoles**: `/admin` (the full old console, never changed under the owner) and
  `/admin2` (the phone first one). The store is Redis or KV through `api/_kv.js`.
- **The Lantern**: `api/_models.js`, the best free model on OpenRouter, refreshed nightly
  by `api/warm.js`, which also runs the night shift (`api/_nightshift.js`).

## The Content Graph

Masterplan step 5. `scripts/graph/` (`extract_js.mjs`, `build_graph.py`, `validate_graph.py`,
`derive_entity_graph.py`, `same-as.json`, `write_counts.py`, `run.sh`) reads every content
collection the repository already has and writes `build/graph/noor-content-graph.json` (git
ignored, out of the deployment): one node per entity, one edge per real reference. `sh
scripts/graph/run.sh` builds it, validates it (unique ids, no dangling edge, every `mentions`
edge carries a confidence), derives `assets/entity-graph.json` from it, and writes the counts
block in `CONTENT_STATUS.md`. Nothing it writes is hand edited afterward except `same-as.json`.
It reads the repository it is run from by default and takes no path outside it; an optional
`--rooms` argument for a future step (the rendered rooms' own hyperlinks) is accepted and
currently unused, so the build runs the same with or without it. Two runs over an unchanged
tree write byte-identical files: the graph's own `generated` date is the newest content file
the run actually opened, never the clock, and every place a Python `set()` or a filesystem
listing could iterate in a different order from one process to the next is sorted before it is
used.

**The content id.** Every node's id is `<type>:<id>`, exactly as `build_graph.py` writes it: 18
types (`chapter`, `companion`, `day`, `dua`, `figure`, `hadith`, `hero`, `kid`, `light`, `name`,
`page`, `place`, `prophet`, `reel`, `story`, `surah`, `verse`, `word`). Examples: `light:hijri-calendar-epoch-622`,
`verse:2:255` is written `verse:2-255` in the graph (a colon cannot sit inside the id half, so a
verse or a verse range uses a hyphen: `verse:38-42` is 38:42, `verse:2-255` is 2:255), `word:<slug>`
(the dictionary's own id, `word:zamzam`), `chapter:<n>` (1 to 71, the Path), `surah:<n>` (1 to 114),
`name:<slug>` (the graph's own slug of the Name's transliteration, `name:al-hakam`; the room the
site renders it at, `/name/<n>`, uses the Name's position instead, 1 to 99, since two Names share
one transliteration, content-004; `derive_entity_graph.py` is the only place the two are
translated into each other, by the node's own `order` field), `companion:c-<id>` and
`figure:<a|j|e|an>-<id>` (`characters.js`'s own ids; a figure not prefixed `unseen-` is the
`/character/:id` room, one prefixed `unseen-` is `unseen-data.js`'s own copy of the same kind of
thing), `place:p-<id>`, `prophet:<id>`, `hadith:<collection>-<number>` (the numbering the graph
canonicalised, arch: content-001/002), `page:<slug>` (a static page or a rendered room's own hub),
`reel:<id>` (a card of the shelf, `tools/reels/plan.json`'s own id, or a "short" torchbearer or
Hajj reel from `reels/index.json` that has no card, see below). A reel names its content object
with a `reel_of` edge to the object it was cut from: a `light` card to its `light:<id>` (confidence
1.0), a `know` card to the Light it was written from, a `word`/`name`/`dua`/`day` card to its own
record, a `verse` card to the `verse:<ref>` it recites. Of the 1,565 cards the reel plan holds, all
1,565 trace to a content object this way (0 untraced, checked by `tests/content-graph.mjs`).

52 further "short" reels (heroes and Hajj shorts added to `reels/index.json` since 18 September,
after the 15 September audit that this step's scripts were ported from), the masterplan's flagship
derivatives, carry a `room` field instead of a plan.json card id: a page and a fragment, such as
`heroes.html#mansa-musa` or `hajj.html#ihram`. `build_graph.py` traces one in up to three passes.
First, where the fragment names exactly one graph node: on `heroes.html`, a fragment is read only
against `hero:<id>` (the page's eight field sections, `#f-mathematics` and the rest, each hold
several gifts and are never traced this way, since a name is never guessed from which gift a
reel's own title suggests); on any other hub page (so far only `hajj.html`, which has no id space
of its own), a fragment is tried against every collection a section id could coincide with, and
`hajj.html` genuinely reuses the dictionary's own `ihram` and `umrah` word ids for its own
sections. Second, for a heroes field section still unresolved, the reel's own brief (most of the
52 have one at `tools/films/briefs/plate-<id-without-"short-">.json`, a richer source written for
the film itself, with a `note` and a closing `eyebrow`) is read against that field's own gifts
(`build/contributions.json`): a distinctive word shared by a gift's title or `who` and the brief's
`eyebrow` traces at confidence 0.9, or, failing that, its `note` at 0.8; the matched brief text is
kept as the edge's evidence, and more than one gift sharing a name, or none, is left untraced with
that reason. A brief that also cites a Light by id (`[lights/all.json: <id>]` in its own research
notes) earns the film an extra `reel_of` to that Light, on top of whatever else it traces to (so
far, one film: `short-astrolabe`, to `light:al-ijliyya-astrolabe-maker`). Third, a `hajj.html`
fragment that still names nothing traces to `page:hajj` itself at confidence 0.7 (`via`
`section:<fragment>`), honest that the film is cut from that page's section and not a record.
Whatever is left untraced is flagged on its node (`short_untraced:<why>`), read out by
`write_counts.py`'s block in `CONTENT_STATUS.md` and asserted by name in `tests/content-graph.mjs`.
Of the 52: 34 trace (12 heroes at 0.9, a fragment naming exactly one `hero:<id>`; 4 Hajj words at
0.8, a fragment naming exactly one `word:<id>` on a page that is not the word's own hub, so
`short-ihram` and `short-miqat`, both citing `hajj.html#ihram`, both trace to `word:ihram`,
honestly, not a claim that either reel is about miqat specifically; 11 field-section films at 0.9
via their own brief's eyebrow; 1 of those, `short-astrolabe`, also carries the extra Light edge;
7 Hajj page sections at 0.7 to `page:hajj` itself); 18 do not (15 name a field section with no
brief on file to match against; `short-darkroom` names a field section whose brief's eyebrow,
"Ibn al-Haytham, Cairo", is shared by two gifts under Seeing, a genuine ambiguity in the data, not
a gap in the matching; `short-road` and `short-zero` have briefs, but no gift's name or
distinctive title word is in either one).

**Same entity, two ids.** `build_graph.py` computes 63 same_entity_as edges over 61 pairs (two
pairs are declared both ways, from each side): a companion also written as a dictionary word, an
angel described twice (once in `characters.js`, once in `unseen-data.js`), a place spelled two
ways (content-003). Of those, 17 pairs also touch a chapter: id, a Path chapter that retells a
prophet's, a place's or a word's story under a matching name; those are never folded in, since a
chapter is its own stop on the discovery path (Short, Light, the word, the person or place, the
Path chapter, the sources), not a duplicate of the thing it narrates. The remaining 44 are checked
by title or Arabic against the source files; `scripts/graph/same-as.json` hand-keeps only the ones
that really are one entity written twice (word:hasan is the hadith grade, not the companion
Hasan, and stays out even though the two titles match), and `build_graph.py` stamps a `canonical`
id on every node from it (a node not in the file is its own canonical). No id is renamed in a
source data file by this; only the graph's own `canonical` field changes. `derive_entity_graph.py`
reads the same curation for its own `word` and `unseen` fields (a room's own dictionary word, and
a figure's own entry on /unseen): a raw same_entity_as edge the graph found is a claim, not a
fact, and only a pair same-as.json keeps is trusted as the same record.

**Shelf order.** `api/page.js`'s `besideEntity()` shows only the first 8 of a `lights` or a
`words` list (`entity-graph.json`'s two longest fields), so the order the graph writes them in is
which links a reader actually sees, not a cosmetic detail. `derive_entity_graph.py`'s
`by_relevance()` ranks every candidate: the mentions edge's own confidence, descending (a full
name matched at 1.0 outranks a single word matched at 0.8, the same rule that keeps Mansa Musa off
the prophet Musa's own shelf); then how many distinct edges the graph records between the pair,
descending (a word and an entity tied by more than one kind of edge is a stronger tie than one the
graph records only once); then the order `build_graph.py` met the edge while walking the source
files (not a claim that earlier is better, but a real, deterministic fact about the source, and a
fairer tie-break than an id's own spelling); alphabetical only last, when everything else ties.
`chapters`, `people`, `places` and `stories` are not sliced by `besideEntity()` and keep their
plain id order.

## The reels

`tools/reels/` and `.github/workflows/reels.yml`: the plan from the library
(`plan_build.py`), every fact proved (`copy_audit.py`), rendered on GitHub every Monday on
up to eight machines (`render_missing.py`, `webreel.py`: a shader picture and anime.js
type in Chromium, sound in numpy and Pedalboard, `sound.py`; the recitation for a verse
from everyayah.com through `verses.py`), the videos on GitHub Releases (`shelf_store.py`),
a sidecar and a cover per reel in the repository, the manifest `reels/index.json`, a pull
request the house merges.

## The social machine

`SOCIAL_ENGINE.md`.

## The films

`VIDEO_ENGINE.md`.

## How work is run

`CLAUDE.md` (the Director and the specialists), `HANDOFF.md` (how to resume),
`CURRENT_STATE.md`, `DECISIONS.md`.
