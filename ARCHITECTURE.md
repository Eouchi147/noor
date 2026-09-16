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
  the shell's bar and the night sheets). The audit's batch 6 is the diet of those old
  rooms (a 21 KB baked header, a nine file kit, two shells).
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
  use). The content graph itself (`noor-content-graph.json`, 6,923 nodes, 26,899 edges)
  is rebuilt by `/root/audit/content/scripts/run.sh`.
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
