# NOOR: where things stand

Kept current by the Director after every shipped batch. Dates are UTC. Newest at the top of
each section. `HANDOFF.md` says how to resume; `DECISIONS.md` says what the owner decided.

## Live on main (16 September 2026)

- **The change archive**: `changes.txt` at the root, one line per change, read and
  downloaded from the console's System room (`/admin2`).
- **The social machine**: five minutes a run (was 60 s), a claim per slot before sending, a
  Facebook reel verified after finish, a published Instagram container never resent, a
  private YouTube upload never retiring a reel, the YouTube cap at six, Pinterest's Trial
  refusal recorded as waiting, the legacy nightly feed post removed, the Lights library read
  from the site's own host, the afternoon rota restored until shorts exist, every reel
  linking its own room, captions cut for Threads and Pinterest keeping their tail, the cron
  door bearer only when a secret is set, Telegram handed `/api/reel?id=`, repairs pinned to
  the record's reel, the dusk story patient with Instagram's 9007. First proof: the day's
  card story went out at 22:00 UTC on 15 September (it had failed every hour before).
- **The site**: the six right to left doors keep their language; 32 pages allow zoom; the
  breadcrumb on every room resolves; the map on every page names Today, The Lights and
  The Verses and sends the Path to `/path`; each surah on the Mushaf links its room; the
  search index carries every Light, surah, Name, chapter and reader room; the dictionary
  generator keeps the index whole and builds at shell v13; the 523 word pages rebuilt and
  merged (pull request 13) with "Rooms that name it" shelves.
- **The reels**: 1,457 reels on the shelf with video (runs 12 and 13 merged); the
  recitation of a verse reel held by a lookahead limiter at minus 3 dB true peak and
  encoded at 128k; a removed reel named on the run page; manifest rows carry `src`.
- **The audit**: `/root/audit/` in the session box, the pack in the owner's folder
  `NOOR Films/audit-2026`, the page "NOOR Audit 2026" in the owner's artifacts: 123
  findings, 23 high; batches 1 to 3 shipped.

## In flight

- **Batch 5, reviewed SHIP WITH NOTES by the refuter on 16 September and shipping**: rooms
  for 25 prophets, 58 companions, 40 characters, 34 places and the 99 Names in
  `api/page.js` (256 rooms, the sitemap grows from 1,130 to 1,386); `.github/workflows/tests.yml`
  (36 suites on every push); `.github/workflows/generators.yml` (drift guard); the first
  screen of every room painted at once; `reels/home.json` for the home (appears at the next
  render run); focus held in the sheets; a skip link; the Names canvas and the Prophets
  stars quiet under reduced motion; the shell at version 14.
- **The `/license` removal**, built by the builder and reviewed with batch 5: the page and
  the function deleted (by the new `remove.yml` workflow's pull request), `/license`
  redirected to `/school` for good, every menu, sitemap, index and page sentence true
  without a subscription.
- **The orchestration infrastructure**: `CLAUDE.md`, `.claude/agents`, `.claude/skills`,
  the six state documents, shipping with this batch; tested end to end on the `/license`
  removal (scout on haiku, builder on sonnet, refuter on opus).

## Decided and not yet done

- Remove the orphan files by a workflow opened pull request (owner, 16 September):
  `"study 2/"`, `console.html`, `sponsor.html`, `nodes-a.js`, `nodes-b.js`,
  `shorts-rows.json`, root `quran-study.js`, `text/`, `locales/`, `assets/noor-menu.js`
  and `.css`, root `lantern.js`, `tools/reels/web/type.html`, `assets/.DS_Store`,
  `scripts/__pycache__`. `tools/films` stays (the engine's base).
- Nudge Pinterest about the Standard access review (the owner is waiting on it).
- Open a few of the recorded YouTube Shorts to confirm they are public.

## Blocked or waiting

- Pinterest Standard access (their review). Video pins wait until it is granted.
- The content corrections (content-001 to 006) need hadith numbers checked against a
  reference; the cloud box cannot reach the web for that, the owner's browser can.

## Numbers that matter

- Reels on the shelf with video: 1,457 of 1,565 planned. Slots a day: 5 reels (08, 11, 14,
  17, 21 UTC) plus reelF at 19, and the cards (dawn 05, light 12, word 16, dusk 20).
- Rooms rendered by `api/page.js`: 1,130 live, 1,386 once batch 5 ships.
- Audit findings: 123 (23 high, 49 medium, 51 low); closed so far: about 30.
