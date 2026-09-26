# NOOR: where things stand

Kept current by the Director after every shipped batch. Dates are UTC. `HANDOFF.md` says how
to resume; `DECISIONS.md` says what the owner decided; `changes.txt` is the line by line record.

## Live on main (24 September 2026)

- **Experiments** (masterplan step 9, `api/_experiments.js`, `api/experiments.js`): a real A/B
  split over the verse shelf (length, or reciter against reciter), owner-planned, `chooseReel`
  leaning the picker toward the day's own arm, a seeded permutation test on watched share reading
  the result once the full window has closed; `api/_insights.js`'s `learn` block (watch time by
  kind, length and reciter) and the Observatory's own `experiment` card read it, with a Plan
  button on the card itself. Nothing is planned yet; the owner starts the first one (the verse
  length question) from that card, or `POST /api/experiments`.
- **The films**: 52 on the shelf (`reels/index.json`, kind `short`), each with its tall file,
  wide file and cover on the store; the eleven Hajj films among them. Rendered on the owner's
  Mac (`./plates.sh`), published by `tools/films/publish-shorts.sh`, which refuses to shrink the
  shelf, cuts covers from the current master, and prunes a film's old frame caches.
- **The duplicate guard, three layers deep**: the picker steps past what has gone out and prefers
  the reel sent longest ago; the guard looks back 60 days (the shortest honest cycle, films, is
  91); `backfillPosted` wrote the history back to March.
- **The reconciliation** (masterplan section 11): the System room's "What the networks actually
  hold" asks a network for its real inventory and names what is absent, unrecorded, posted twice
  or rejected after an ok. "Teach the guard" writes what a network holds into the guard's memory.
  First live run on YouTube: 8 reels more than once, all dated 8 to 21 September; the owner chose
  to leave the copies. The guard now remembers every one of them.
- **Citations**: every narration in the prophets, the chapters, the companions and the places
  names its collection and number, checked against sunnah.com (audit content-001, content-002);
  `tests/citations.mjs` guards it.
- **The front door**: "What do you want to know about Islam?", title "NOOR · Learn Islam, from
  the sources".
- **The nine story rooms** on the same diet as the other 42 old rooms.
- **Everything from before 19 September**: see `changes.txt`.

## Shipped 22 September, second batch

- **Jev, the Lantern's judge** (`api/_jev.js`, `api/illuminations.js`, `tests/jev.mjs`): before a
  Verse Lamp, Seeker's answer, Hidden Thread or Friday Light is saved, Jev (TypeSafe, through
  Vercel's AI Gateway, free, no key) asks whether it quotes the Prophet, cites an unchecked hadith
  number, issues a ruling, slights anyone, or strays from its subject; a refusal falls back to the
  hand written light, and Jev being down changes nothing. Owner probe: `/api/illuminations?kind=gate`.
- **The reconciliation on Instagram, Facebook and Threads**: posts named by caption, reels and
  videos only (the old card posts are not ours to judge), container ids paired within two days on
  Instagram and Threads.
- **Verse rooms** (audit seo-008): Arabic from the house's own table, never waiting on
  api.alquran.cloud; a missing English cached ten minutes, not a day; a headline; the written sense
  and word by word notes on the 1,280 verses that have them (`verse/*.json` now shipped with the
  function).
- **llms.txt** rewritten to the site as it is; the home page names its subject as Wikidata Q432.

## Shipped 23 September

- **Jev, calibrated live**: the relevance question now asks what Jev can see (is this about faith)
  instead of whether it matches a verse it is never shown; the owner's probe sends one sound piece
  of each kind and one bad one, and all behave. Owner calibration: `?kind=gate&text=..&ask={..}`.
- **The reconciliation, live on Meta and Threads**: no absences, no rejections; copies of 11
  (Instagram), 19 (Facebook) and 6 (Threads) reels from 5 to 21 September, left in place by the
  owner's choice, and taught to the guard.
- **The Mushaf reading view** (the 17 September prototype): word meanings on tap, transliteration,
  the "How you read" sheet with a Day page, chrome that steps aside while reading, the verse seal.
  Bismillah shown twice on 95 and 97 fixed.

## Shipped 24 September (audit leftovers)

- Search: room titles keep their full sentence with a short " · NOOR"; long descriptions trimmed,
  thin chapter descriptions built only from each chapter's own text; the sitemap loses its
  redirecting slashes and gains /three-lives; verse lastmod comes from the reel's own upload date;
  /today's dated pages point to the Light they show; structured data gains authors and real HowTo
  steps (no invented dates); Arabic on the Names, the Prophet and the Prophets pages is marked as
  Arabic for screen readers and engines.
- Speed and structure: two old rooms on the current shell version, a dead route removed, the
  Follow the light label readable, tap targets on the verse shelf and the language row, the Hajj
  badges no longer clipped, OPERATIONS.md matches the routes and variables, stale tests corrected.
- Left on purpose: hreflang and language detection (per-language SEO is paused by the owner);
  kids-engine.js cannot be deferred (the games bind to it inline).
- Fixed 26 September: chapter 60's summary said "the plea arrives one node late", an old slip for
  "too late"; corrected at the source (`scripts/patches/nihaya.mjs`) and carried through by
  `node scripts/build.mjs` into `node/60.json`, `nodes.js` and `nodes-index.js`, then into
  `assets/search-index.json` by `scripts/gen-dictionary.py`, the way each of those files is always
  meant to be produced. No file was hand edited.

## Shipped 24 September (masterplan step 5, the Content Graph)

- The graph the content audit built outside the house now lives in it: `scripts/graph/run.sh`
  builds the NOOR Content Graph from the repository's own files (about 6,950 objects, 18 types,
  27,000 ties), validates it, regenerates `assets/entity-graph.json` (the related shelves of the
  prophet, companion, character, place and Name rooms, ranked by relevance) and the counts in
  `CONTENT_STATUS.md`. Deterministic; `build/graph/` is git ignored and never deployed.
- The content_id is `<type>:<id>` (ARCHITECTURE.md, "The Content Graph"): every one of the 1,565
  planned cards traces to its object; 34 of the 52 films trace through their room or their brief,
  18 are named in the test with the reason they cannot yet.
- `scripts/graph/same-as.json` names one canonical id for records that are one thing under two
  ids (content-003); no id in the site's data was renamed.
- `tests/content-graph.mjs` (16 checks) fails if the shelves drift from the graph by one link or
  one place in order.
- Checked 26 September: about 30 of the film edges `derive_reel_sources.py` writes point to a
  `hero:` or `page:` id rather than the object's own content id. Left as they are on purpose: the
  package (`api/_package.js`) only ever looks up an object's own content id in
  `assets/reel-sources.json`, never enumerates the file's keys, so a `hero:`/`page:` key never
  breaks a lookup. A hero or page package is a future feature, not yet built; the keys wait for it.

## Shipped 24 September (masterplan step 8, analytics, and the related words)

- Analytics already read Instagram, Facebook and YouTube per post; now Threads too (views, likes,
  replies, reposts, quotes, shares; needs threads_manage_insights, so the owner authorises the
  Threads app once more), a fold by SUBJECT (a Light's group, a verse's surah, a word's category,
  a film's field; `assets/reel-subjects.json` from `scripts/graph/run.sh`), the best and weakest
  posts by subject, and ARRIVALS: visits from each network, the last 7 complete days against the
  7 before (beacon counts the source daily now; threads.com recognised).
- Related words: citations and names no longer pass for dictionary terms (the grade "hasan" on
  al-Hasan's room, "sahih" beside a citation); 23 of 1,270 rooms changed, every loss spurious.
  Curated person words ship as `assets/person-words.json`. Verse ranges read 2:255-257.
- Found, not yet fixed: fold() makes Mu'tah (the battle) and Mut'ah (the fiqh word) the same.

## Shipped 24 September (masterplan step 6, in the owner's narrow form)

- "Make a package" in the console's Marketing room (`/api/package?id=`, owner only): one library
  object (a Light, verse, word, prophet, companion, place, chapter, surah or Name, by content_id
  or by its address) becomes drafts for YouTube, Instagram, Facebook, Threads, Pinterest, an X
  thread and Reddit, built from the object's own words and sources, never a model; its reels and
  films (`assets/reel-sources.json` from the graph) and plain gaps ("no reel yet"). Nothing is
  posted; the owner copies what he wants. Checked over all 1,907 objects: within every limit, no
  word lost from a thread, no source that does not back its text, no dash.
- First live analytics (24 Sept): YouTube strongest (12,014 views in a week), Instagram growing
  (5,319 reached), Facebook about zero, Threads about one view a post; verse reels lead on
  Instagram. The owner chose to wait a week before changing the line-up; a scheduled task
  re-reads on 1 October.

## Shipped 24 September (the Lantern agent, the Observatory, the model router)

- **The Observatory** (console, House, `/api/observatory`): every number side by side: a hero
  band and a per-network scoreboard, pattern notes computed from the data, the funnel, 30-day
  trends, a weekday by hour heatmap at the six posting hours, kind and subject performance with the
  5-post floor, site readers, posting health, library coverage. Nothing invented; null is absent.
- **The model router** (`api/_llm.js`, `/api/lantern-models`): OpenRouter, Groq and Gemini free
  tiers only, tiered (fast, strong, long), token buckets under the free limits, fallback, a
  scrubber on every outbound message, journal text refused, per-person rows never sent to Gemini.
  Groq and Gemini keys must come from accounts with no billing. Keys: the owner's to create.
- **The Lantern agent** (console, House, `/api/lantern-agent`, owner only): plans, calls 14
  read-only tools, runs analyst, strategist, writer and critic subagents on the free models,
  streams its thinking, answers with grounded numbers (a critic drops any clause whose number is
  not in this run's evidence), charts, drafts and proposals. On its own, at most 5 a day, logged
  with undo: refresh the numbers, teach the duplicate guard. Everything else is a proposal the
  owner approves. There is no safe way yet to change one day's reel, so that is a proposal too.

## Decided and not yet done

- The site wide wordmark line "Learn Islam": one stylesheet line, but the stylesheet is cached for
  a year behind a version written by hand in the shell and baked into 527 generated pages; ride it
  on the next dictionary rebuild.

## Postponed by the owner until funding (do not start)

Full translation of the library, the Mushaf's remaining exegesis (1,280 verses across 59 surahs
written; the long surahs from Al-Imran on are not), bulk generation of any kind, and anything
needing paid compute.

## Blocked or waiting

- Pinterest Standard access (their review).
- "Al-Isra · 17:110" on YouTube, blocked by a claim since 18 September.
- Three unheard nasheeds in the owner's Suno library; every film shares the one G minor track.

## Numbers that matter

- Shelf: 1,509 cards, 52 films. YouTube channel: 88 videos at the first reconciliation.
- Audit: 122 findings; the high ones in content, performance, SEO and social are closed. Open light
  work remains in architecture, performance and SEO (the scout's table of 22 September overstates
  it: at least ten items it calls open are fixed in `changes.txt`).
