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
(a container or a processing video, or, since 16 September, `pending: { fb: <id> }` on a
Facebook reel the clock cut after its upload had an id, or `pending: { fb: null, since:
<iso> }` on one cut before the upload even answered; a healer never touches a pending
result, the finisher alone asks the network what became of it, and for the id-less kind it
searches the page's own recent videos for one whose title or description matches the
record's caption, giving up into a plain, healable failure after 30 minutes with nothing
found), skipped (not configured, or, since 16 September, a reel over Telegram's own 50 MB
upload ceiling, or one the door could not deliver whole -- a body shorter than its own
declared length, or under 100 KB, is read as a fetch failure and never handed to Telegram
as a file), fatal, unverified (a Facebook pending WITH a known id that outlived
PENDING_MAX_MS: the id is kept on the record and it is never healed into a second upload,
because the video may still be live on the page; only a deliberate retry, `opts.force`,
sends it again), trial or waiting, late or cut (the clock; the answer is written on arrival
since 15 September, and since 16 September a late answer that turns out to have succeeded
after a NEWER result already landed is kept, not dropped: `dup: [{id, url, at}]` beside the
newer result, with `dupWarn: true` so the console shows it -- carried forward across every
later write to that channel, not erased by the next finish or retry), pre (the card's
picture unreachable), drift (a repair that rebuilt as a different card; no longer possible
for reels), gaveUp, quota, private, tries and lastTry, verified (the moment a platform
confirmed a Facebook reel).
Since 16 September, a reel whose id already answered ok on a channel within the last 21
days is never sent again to it: the result is `{ ok: true, already: true, id, url, at }`
(named `already` so it cannot collide with the `dup` list above), the earlier send's own
words, and nothing is asked of the network -- unless the caller passes `opts.force`, which
skips the guard the same way it skips every other refusal. The guard itself reads a second
hash, `<reel>|<channel>` to `date#slot`, written the moment any ONE network says ok, before
falling back to the ledger below; this is what lets it catch a reel ok on Facebook while
Telegram was still failing, which the ledger alone (needing every network) could not see.
Missing still: a per network publish time on every network, the asset version from the
sidecar, the method (hosted upload, url, multipart), and a permalink for Instagram and
Pinterest.

The ledger (`?action=posted`, `reelDone`): a reel retires once its slot reads `sent`, which
already means every live network answered ok OR was skipped for a reason that will not
change on its own (not configured, on trial, waiting for review, or, since 16 September,
Telegram's own 50 MB ceiling). A network still failing for a real, retryable reason keeps
the slot `partial` on purpose, and the reel stays on the shelf until someone looks.

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

16 September: the Al-Basit and Az-Zumar duplicates, diagnosed the same day. A Facebook send
the clock cut kept no id (the upload learns it early, but nothing carried it out), so
`healable` let a plain "late" through and the healer started a second, real upload over the
first; when the first one's own answer arrived, `lateArrival` found the record already said
something else and threw the answer away. Now `postFacebookReel` writes the id to a flight
the moment the start phase answers, a cut with the id known is `pending` (never healable),
and a late answer that succeeded after a newer result already landed is kept beside it
(`dup`, `dupWarn`) instead of discarded. A second, separate guard refuses to send the same
reel id to a network that already has it, inside the last 21 days, whatever record it is
under. Telegram failing "could not fetch the file from its url" on every reel of every day:
its own fetch of a url is on ITS clock, and two hops to reach a reel (first the store's
signed link, then this house's own door) outran it more than not; `_telegram.js` now reads
the video itself and uploads it to Telegram directly, and the ledger's rule above (already
correct) fills once Telegram does.

The same day, on review: the guard above only ever read the ledger, which needs every
network before it names a reel, so a reel ok on Facebook while Telegram was still failing
was invisible to it and got a second Facebook upload. A second hash closes that, written on
every single ok (`notePostedChannels`, read first by `findDuplicate`). PENDING_MAX_MS was
turning a Facebook pending back into a healable failure after two hours even with a real id
on it, which is exactly the second upload the whole change exists to stop; that id now goes
`fatal`, `unverified`, kept on the record, never healed. `dup` and `dupWarn` were erased by
the next write to the channel (the finisher, a retry); both are carried forward now
(`carryDup`), and the console shows the duplicate chip whatever state the channel is in, not
only inside the ok branch. A Facebook cut with no id yet (before the start phase even
answered) was still plain "late" and still got resent; it is `pending` too now, with a
`since` mark, and the next run's finisher looks for a matching video by name on the page
before giving up after 30 minutes. The guard's own `dup: true` collided with `lateArrival`'s
`dup` list on one field name; the guard's flag is `already: true` now. And `opts.force` now
reaches the guard the same way it reaches every other refusal, instead of being blocked by
it. Telegram: a door answer shorter than its own declared length, or under 100 KB either
way, is read as a fetch failure now, not an upload -- a truncated or too-small file is never
handed to Telegram as if it were the whole reel.

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
