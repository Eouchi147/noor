# NOOR: where things stand

Kept current by the Director after every shipped batch. Dates are UTC. Newest at the top of
each section. `HANDOFF.md` says how to resume; `DECISIONS.md` says what the owner decided.

## Live on main (16 September 2026)

- **The video engine, rebuilt** (`VIDEO_ENGINE.md`): the film spec, the scene film in the
  light layer (explicit camera stations and light cues, one figure as the world), the
  dark room figure, the watermark, `film.py` (compile, voice, sound, render, mux, check,
  all) and `audit.py`; the whole engine in `tools/films/` in the repository, out of the
  deployment. The prototype "The dark room" (ten scenes, 44 s, both shapes) proofed at 12
  fps with a stand in voice, in the owner's folder `NOOR Films/darkroom/`.
- **Batch 5, the `/license` removal, the orphan removal and the house documents**: live
  (rooms for prophets, companions, characters, places and the 99 Names; the sitemap at
  1,386; `/license` redirected to `/school`; 97 orphan files gone by pull request 14).
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

- **The dark room prototype, waiting on the owner**: the look, the voice, and whether
  the architecture is locked (`VIDEO_ENGINE.md`, "What the owner decides"). The full
  render (24 fps, shutter 3) is a Mac job.
- **The dictionary rebuild at shell v14** (workflow run 35047391599): its pull request
  is merged or waiting; `CURRENT_STATE.md` is updated when it lands.

## Decided and not yet done

- Nudge Pinterest about the Standard access review (the owner sends the note himself;
  the text is in the morning summary of 16 September).
- The content corrections (content-001 to 006) and the old rooms diet (batch 6).

## Blocked or waiting

- Pinterest Standard access (their review). Video pins wait until it is granted.
- The content corrections (content-001 to 006) need hadith numbers checked against a
  reference; the cloud box cannot reach the web for that, the owner's browser can.

## Numbers that matter

- Reels on the shelf with video: 1,457 of 1,565 planned. Slots a day: 5 reels (08, 11, 14,
  17, 21 UTC) plus reelF at 19, and the cards (dawn 05, light 12, word 16, dusk 20).
- Rooms rendered by `api/page.js`: 1,130 live, 1,386 once batch 5 ships.
- Audit findings: 123 (23 high, 49 medium, 51 low); closed so far: about 40, and the
  engine rebuild (the audit's largest finding) has its first prototype.
