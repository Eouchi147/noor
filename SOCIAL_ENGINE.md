# NOOR: the social publishing machine

The map of the machine, its states, what was fixed on 15 and 16 September 2026, how it is
read, and what remains against the masterplan's Distribution Manager. Kept current by the
Director.

## The shape

- **The schedule** (`api/_schedule.js`): slots a day in UTC: dawn 05 (the day's date
  card), reelA 08, reelC 11, light 12 (the day's Light card), reelD 14, word 16, reelB 17,
  reelF 19, dusk 20 (the chapter card), reelE 21. A rota by weekday picks each reel slot's
  kind (verse, word, name, know, light, dua, day); the afternoon asks for a short and takes
  the old row until shorts exist. `chooseReel` walks the shelf by a step counted per kind
  since the epoch (Sunday 6 September 2026), so nothing repeats inside six months; the
  walk moves when the shelf grows, which is why a repair must be pinned to the record's
  reel (it is).
- **The shelf** (`reels/index.json`, 1,457 rows with video; `tools/reels/README.md`):
  rendered on GitHub by the `reels` workflow every Monday, videos on GitHub Releases (one
  release a kind), a sidecar and a cover per reel in the repository, captions from
  `tools/reels/plan.json`, every fact proved by `copy_audit.py`.
- **The poster** (`api/social.js`, run hourly by the Vercel cron at `/api/social?action=due`,
  five minutes a run): claims the slot (`SET NX`, ten minutes), composes it, sends to the
  live networks in order (YouTube, Instagram, Facebook, Threads, Telegram, Pinterest for a
  reel; Facebook and Instagram stories for a card), writes the record
  (`nsoc:slot:<date>#<slot>`), adds the stories, then tidies: finishes pending containers
  (Instagram, Threads, Facebook) and heals failures one network at a time with backoff.
- **The channels** (`api/_channels.js`, `_youtube.js`, `_threads.js`, `_telegram.js`,
  `_reels.js`, `reel.js`): each network's own words and codes kept on the record; Reddit
  drafts only; X built and off; Pinterest on Trial (waiting).
- **The ledger** (`?action=posted`): a reel is done when every live network has it (a
  private YouTube upload does not count); the weekly render run copies the ledger and
  retires those cards.
- **The console** (`/admin2`, the Reels and Controls rooms; `/admin` the old one): the
  records, retry per network, Post now, the dials (mode off, approve, auto; fb; ig;
  stories; cardsFeed off).

## States today (against the masterplan's GENERATED, QUEUED, UPLOADED, PUBLISHED, FAILED, RETRIED)

Slot: none, queued, skipped, pending, partial, sent, failed. Per network: ok (with id, and a
url for YouTube, Threads, Telegram, and since 15 September Facebook's permalink), pending
(a container or a processing video), skipped (not configured), fatal, trial or waiting,
late or cut (the clock; the answer is written on arrival since 15 September), pre (the
card's picture unreachable), drift (a repair that rebuilt as a different card; no longer
possible for reels), gaveUp, quota, private, tries and lastTry, verified (the moment a
platform confirmed a Facebook reel). Missing still: a per network publish time on every
network, the asset version from the sidecar, the method (hosted upload, url, multipart),
and a permalink for Instagram and Pinterest.

## What was fixed (15 and 16 September 2026)

The 60 second budget (Instagram alone took 35 to 42 s; Facebook cut and resent; Threads,
Telegram and Pinterest never reached); no claim before sending; a Facebook 200 taken as a
publication; a PUBLISHED Instagram container read as pending and resent; a private Short
retiring a reel; the YouTube cap at five for six slots; Pinterest's media refusal without
the waiting flag; the legacy nightly feed post from `warm.js`; the Lights library read from
a walled deployment address (the day's card never went out); the afternoon rota fallen to
a verse; captions cut from the end for Threads and Pinterest; every reel linking the home
page; a failed slot resent whole every hour; the cron door open to a typed user agent;
Telegram handed a link it could not fetch; repairs refused as drift after every Monday;
the dusk story failing on Instagram's 9007. All on `changes.txt`.

## How it is read

The console unlocked in the owner's browser (he types the password), then
`noorcodex.com/api/social?action=plan&date=YYYY-MM-DD` (the day's records),
`?action=status` (dials, tokens, the day's preview), `?action=log`. The hourly function
log: Vercel runtime logs scoped to the production deployment and the hour, search `noor`.
Never a token in a report.

## What remains (masterplan sections 9, 11, 12)

- The record as the Distribution Manager wants it: publish time per network, permalink on
  every network, asset version and method; a verification read after every 200 (Instagram
  and Threads already poll; YouTube reads status; Pinterest and Telegram do not yet).
- Duplicate detection across days (the same reel id recorded sent twice on one network).
- Facebook treated as its own platform: native publishing, audience and eligibility
  checks, insights read per video (`_insights.js` reads the right object).
- Platform specific shaping beyond the caption: covers for Facebook and YouTube, alt
  text, the recitation's language for YouTube, hooks per platform.
- Analytics: views, reach, retention, engagement, conversion per reel and per kind, fed
  back into the rota.
