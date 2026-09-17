# NOOR: the social publishing machine

The map of the machine, its states, what was fixed on 15 and 16 September 2026, how it is
read, and what remains against the masterplan's Distribution Manager. Kept current by the
Director.

## The shape

- **The schedule** (`api/_schedule.js`): slots a day in UTC: dawn 05 (the day's date
  card), reelA 08, reelC 11, light 12 (the day's Light card), reelD 14, word 16, reelB 17,
  reelF 19, dusk 20 (the chapter card), reelE 21. A rota by weekday picks each reel slot's
  kind (verse, word, name, know, light, dua, day); the afternoon asks for a short on
  Sunday, Tuesday, Thursday and Saturday and keeps the old row the other three days (and
  every day, until shorts exist at all). `chooseReel` walks the shelf by a step counted per
  kind since the epoch (Sunday 6 September 2026), so nothing repeats inside six months; the
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

## Shorts

A silent short is a plate film (`tools/films/briefs/plate-*.json`, rendered on the owner's
Mac by `plates.sh`), not a rendered-from-cards reel: no voice, the library's own illustrated
page staged to motion, a hook, a mechanism, a turn and a payoff, then its source. `tools/
films/shortmanifest.py` turns a finished brief into a row of kind "short" in `reels/
index.json` (id, caption, the long `story` in the library's own words read off the hero card
its `room` names, or, when nothing on that page shares a word with the brief, the brief's own
lines instead, with a warning printed rather than a silent wrong guess, `src`, `room`,
`title`, `hook`, `payoff`, `secs`, `made`); no `wide` from this script, ever, since it has no
url yet to put there. `publish-shorts.sh` makes a delivery copy of each shape first (a master
is CRF 16 and 90 to 180 MB; the copy is libx264, crf 21, kept under Telegram's 50 MB ceiling
or refused rather than uploaded), uploads the copies, and merges the rows in -- `wide` is
written only here, as a real url, once that upload has actually succeeded, and a shelf that
already carries a row's id twice is collapsed to one row rather than left with a stale copy
standing. The Director carries `out/index.merged.json` to main, the same as every other reels
update.

Building the row is not the same as the post reaching a network: `api/_schedule.js`'s
`buildSlot`, which every reel slot runs through, carries a short's own fields -- `story`,
`title`, `hook`, `payoff`, `tags`, `wide`, `src`, `room` -- onto the post it hands to
`api/_channels.js`, alongside the caption and video every reel already carries; without this
the shaping below never runs at all. An ordinary reel's post carries none of these fields,
unchanged.

The rota (`api/_schedule.js`, `ROTA.afternoon`) gives the afternoon slot to a short on
Sunday, Tuesday, Thursday and Saturday, two to four a week by the owner's own words of 16
September 2026; Monday, Wednesday and Friday keep exactly what the afternoon showed before
any short existed. The row change is self disabling: `chooseReel` only ever picks kind
"short" once a row of that kind exists on the shelf, and "short" is deliberately absent from
`FALLBACK`, so it can never leak into another half.

A short is shaped per network in `api/_channels.js`, on the owner's instruction of 16
September 2026 that every network gets its own words and its own posting shape. YouTube is
the one network a short with a wide file reaches twice in one slot, on the owner's further
instruction the same day: the tall file first, filed as a proper Short (titled the hook, with
#Shorts, its description the full `story` then the source then the room link then the tags),
and, once the daily upload cap (`YT.DAILY_CAP`) still has room after that, the wide file
second, as an ordinary 16:9 video (titled the film's own name, never the hook, never
`#Shorts`, the same story and tags) -- never wide IN PLACE of the Short, the way an earlier
version of this had it. `api/social.js`'s `sendOne` (`sendYouTubeBoth`) runs both through the
one sender and folds them into one `results.youtube`: the Short's own `id` and `url` as
always, plus `wide: {id, url}` once the second upload is confirmed clean by `api/_youtube.js`'s
`status()` (read the one way `fbReelStatus` reads Facebook's, a single look, since a duplicate
refusal sometimes only surfaces once YouTube has finished processing); `wide: {pending: id}`
when that look is inconclusive, settled next run by `finishPendingReels`'s own `youtube`
finisher (a look through `YT.status`, never a fresh upload, the same restraint the story
finishers above already keep) rather than started over; and `wide: {refused: reason}` --
"duplicate" among them -- on an outright refusal, never touching the Short's own `ok`. If the
cap only has room for one upload, the Short takes it and `wide: {skipped: "cap"}` is recorded
so the console shows why, with no later retry, since the owner's own rule is that a Short
always wins the room. findDuplicate and notePostedChannels see one send of the reel to
youtube either way, because both uploads live under that one result, never two. Facebook and
Instagram take the `story` too, cut to their own limit keeping the tail (`_threads.js`'s
`cutKeepTail`, already used for a reel's caption), so the source and the room link survive a
cut that a plain trim from the end would have dropped. Threads and Pinterest, both capped at
500, take the hook and the payoff sentence rather than the caption or the story, since
neither of those fits whole. Telegram needs no special shaping: the row's own `caption`
already ends with the source, the room link and the tags inside 500 characters, well under
Telegram's 1,024. A reel (kind other than "short") is untouched by any of this; every row of
kind "short" is shaped this way, `story` falling back to the row's own `caption` when a short
has nothing longer to say, so the hook title and the wide upload hold either way.

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

## Numbers (masterplan step 8, 16 September 2026)

`api/_insights.js` reads what the cache already holds on demand; it never remembered what a
Friday looked like once Monday asked. `snapshot()` takes one photograph a day instead: it
walks the slot records of the last fourteen days (bounded to thirty, and by a forty second
clock), asks Instagram, Facebook and YouTube (`YT.ytStats`, statistics and contentDetails
together, up to fifty ids a call, added to `_youtube.js` for this) for the numbers on every
live id a record carries, the Short and the `wide` upload beside it both, and writes one row
per network under its own key, `nsoc:stats:<date>#<slot>`, thirty of them kept before the
oldest goes. A separate key, not a rewrite of the poster's own `nsoc:slot:<date>#<slot>`: the
poster writes that one on its own hourly cron, and this file must never race it. `numbers()`
folds a fortnight of those photographs into this week against the one before it, per network
(posts, views, reach, engagement rate, all summed over the bucket, not averaged per post),
per reel kind and the silent films together, per weekday, per slot hour, the best and worst
kind by engagement, and every film named once any exist; it reads only the snapshots, no
network call.

Taking the photograph wants its own daily cron, and `vercel.json` already carries two, held
to exactly that count by a fixed check in `tests/rooms.mjs`. So it rides `api/warm.js`'s own
04:00 UTC run instead, a direct call rather than a fourth cron, budgeted tighter (25 s) than
the door `?action=snapshot` opens for a hand run or the console's own Refresh button (40 s),
since warm.js has the night shift and, once a month, the journal triage still ahead of it.
The console's Readers room shows the fold as "The numbers": this week against last per
network, the best and worst reel kind, the films' own rows once any exist, and a network
with no token reads as "not connected", never a silent zero.

The refuter's review of 17 September 2026 closed four gaps here. `snapshot()` only counts
`out.written` for a row it actually wrote, not one the store skipped, and `warm.js` checks
`kvReady()` itself before even calling `snapshot()`, so a night with no store touches neither
the network nor the write path for nothing. Every Meta and YouTube fetch in `_insights.js`
now carries an eight second `AbortController` timeout, and `snapshot()` checks its own clock
again right after the token exchange, before the first store round trip, so one hung call
cannot spend a night shift that never gets to the store at all. `numbers()` folds the wide
upload's views into its Short's own row before any bucket is built, so a short with both
counts as one post everywhere, not only in the network fold; and a bucket with nothing in the
week before reads its delta as `"new"` rather than a null the console could not tell apart
from an error.

## What remains (masterplan sections 9, 11, 12)

- The record as the Distribution Manager wants it: publish time per network, permalink on
  every network, asset version and method; a verification read after every 200 (Instagram
  and Threads already poll; YouTube reads status; Pinterest and Telegram do not yet).
- Duplicate detection across days (the same reel id recorded sent twice on one network).
- Facebook treated as its own platform: native publishing, audience and eligibility
  checks, insights read per video (`_insights.js` reads the right object).
- Platform specific shaping beyond the caption: covers for Facebook and YouTube, alt
  text, the recitation's language for YouTube, hooks per platform.
- Retention proper (watch time beyond Instagram's own reel average) and conversion per
  reel and per kind; the numbers above are read only, still nothing feeds the rota.
