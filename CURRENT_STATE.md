# NOOR: where things stand

Kept current by the Director after every shipped batch. Dates are UTC. `HANDOFF.md` says how
to resume; `DECISIONS.md` says what the owner decided; `changes.txt` is the line by line record.

## Live on main (23 September 2026)

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
