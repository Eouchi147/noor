# NOOR · Codex of Light — the brief

Read this first. It is what the keeper of this library would tell a new pair
of hands on day one, so that no session starts from a summary. Correct it
when it is wrong; it is yours.

## What NOOR is

A free Islamic library at **noorcodex.com**, run as a non-profit by one
person (Sam). No ads, no accounts, no tracking, no paywalls, ever. The whole
library is on the site: the Mushaf with recitation for every ayah, 523 words
defined, 350 Lights of history and science, the Path of Creation in 71
chapters, the 99 Names, the Prophets, the Companions, Hajj, Ramadan, the
Family Room, the Kids' Codex, and the rest of the rooms the menu lists.

The audience is anyone: Muslims who want the library, and strangers who
meet a reel and do not know a word of Arabic. Write for both at once, in the
register of a very good museum label: clear, warm, precise, no hype, no
rhetorical questions, no second person, and nothing invented.

## The hard rules

These are not preferences. They are refused, not negotiated.

- **No invented fact.** Every number, name, date and claim on the site or in
  a reel must be findable in the library's own text (the Light card, the
  dictionary entry, the calendar, the Uthmani text with Saheeh International).
  `tools/reels/copy_audit.py` proves it before anything renders.
- **No symbol of any other faith anywhere on the site. No faces** of prophets
  or companions, and no faces at all in what the machine draws (an icon that
  is a face is a face).
- **Journal anonymity is absolute.** Nothing in any console, page or log
  shows a journal commenter's mail or address beyond what the old console
  already shows.
- **Sound:** **nothing at all under the Qur'an**: a verse reel is the
  recitation alone, shaped (a high-pass, a gentle de-ess, a slow compressor,
  a short warm plate) and nothing else, silence before and after. Every other
  reel carries a bed built in numpy: deep sub bass, a warm pad, and one
  muted, damped, cinematic drum (a felt boom, a muted tom, a brush ghost; no
  kit, no cymbal, no clap, no bright skin) in a sparse half-time pattern the
  owner approved on 9 September 2026 after refusing a daf. No third in the
  pitch set. No sample, no license: everything synthesised.
- **Money:** 2.5% zakat computed on gross first; the private ledger in the
  console; a household floor whose figure is set in Controls (The Ledger) or
  the `LEDGER_FLOOR` variable and lives only there, never in this repository.
  The public page names only the zakat.
- **Nothing half finished goes live.** Every deliverable is audited for
  production before it is handed over, and shipped with a step-by-step page.

## How work reaches the site

- Sam drags files into GitHub's web UI (100 files per drag). He is never
  asked to run a terminal or git command. Nothing is ever pushed to the
  live repository by anyone else; pull requests opened by the workflows
  (`reels`, `dictionary`) are merged by him, except the `reels` ones, which
  he allowed the house to merge on his behalf on 9 September 2026 after
  reading their summary.
- Sam types every secret himself: passwords, tokens, API keys, codes, card
  details. A page may show a token once after a consent flow; the house
  keeps no copy. Terms and agreements are accepted only with his explicit
  word. CAPTCHAs are his.
- Every hand-over comes with a beautiful, organised HTML page: what it is,
  what was checked, the exact steps. Every piece of work is reviewed by a
  second reader against the sources before it ships, and the findings are
  fixed, not listed.
- Consoles: `/admin` is the full old console and is never changed under him;
  `/admin2` is the new phone-first one built beside it.

## What is decided

- **The reels** (`tools/reels/README.md`): seven kinds share five slots a
  day (08, 11, 14, 17, 21 UTC): One verse, The word, one of the 99 Names, Did
  you know?, the day's card, This day, and a du'a of the Path. The Codex reel
  (the brand's own) was retired on 9 September 2026: it praised the house
  and taught nothing. The shelf is 1,265 cards: 300 verses, all 523 words of
  the dictionary, the 99 Names, 225 Did you knows and 79 day's cards written
  by hand from the Lights (`know.json`, `light.json`, every fact proved by
  `copy_audit.py`), 21 This days, 18 du'as. A rota by weekday (11 verses, 9
  words, 6 Names, 6 Did you knows, 2 day's cards, 1 du'a a week), each kind
  walked by the running count of its slots so nothing is shown twice in a
  day and a verse is not shown twice in six months; a This day reel on its
  own Hijri date. One idea per screen, night and gold, no HUD, no stat, no
  end card asking to be followed; every frame measured against the safe
  area. The render workflow spreads a shelf over up to sixteen machines, the
  finished videos go to the store, a GitHub release per kind (`shelf_store.py`,
  free, outside the repository's size, paced under GitHub's write limits;
  Vercel Blob behind `REELS_STORE=blob`), the repository keeps one small
  sidecar per reel and the manifest, and the poster resolves a release link
  at the second it hands a network the file. A card that leaves the plan
  leaves the shelf, store asset and all; and **a reel leaves the shelf once
  every network has it** (Sam's rule of 9 September 2026): the poster's
  ledger (`/api/social?action=posted`, three days behind) is copied into
  `posted.json` by the weekly run and those cards leave the plan. A verse, a
  word, a Did you know and a day's card retire; This day, the Names and the
  du'as recur and stay. The picture is
  a shader in the browser; the words are anime.js on a tempo grid per kind;
  the sound is built in numpy and finished in Pedalboard; every reel is
  levelled (-18 LUFS; -16 for a verse). A different reciter each time from
  the roster in `verses.py`, named on screen.
- **Channels** (`api/_channels.js`): Facebook and Instagram live; every reel
  there goes up a second time as a story (`social.stories` dial), and since
  9 September 2026 the five daily cards are stories ONLY (`social.cardsFeed`,
  off by default): they reached nobody in a feed. The reels keep the feed and
  are offered to YouTube first. `/api/reel?id=` hands a phone the file so
  the owner can share a reel by hand from the console's Reels room (noted on
  the record as `results.phone`), and `/podcast.xml` is the verse reels as a
  podcast;
  YouTube Shorts for reels once the consent is given; Pinterest approved
  (Trial), each kind on its own board, reels as video pins, Standard access
  asked for with a screen recording; X built and switched off (paid); Reddit
  drafts only, never automatic; Telegram built (`api/_telegram.js`: a bot
  from BotFather made administrator of a public channel, TG_BOT_TOKEN and
  TG_CHAT_ID), cards as photos and reels as videos; Threads built
  (`api/_threads.js`, its own door at `/api/threads?action=auth`: the Threads
  use case on the Meta app, one consent, TH_TOKEN and TH_USER_ID shown once
  and pasted into Vercel; a card as its picture with the title, one line and
  the link, a reel as the video with its caption cut to 500; the token lives
  sixty days and `?action=renew` shows a fresh one) and waiting on its
  consent; TikTok after YouTube. The day is ten posts (nine without a
  countdown), eighteen surfaces on Meta, well inside Instagram's hundred a
  day and Threads' 250.
- **Reliability** (`api/social.js`): the poster posts first, then heals what
  failed with backoff, and never double-posts: a half-sent slot is retried
  one network at a time, a legacy-sent card is honoured, a slot in flight
  cannot be sent again.
- **Traffic** (`api/beacon.js`): the owner's browser, bots, AI crawlers and
  previewers are not counted; the count is honest from the marked date.
- **The Lantern** (`api/_models.js`): the best free model on OpenRouter,
  refreshed from the live list; never probed on page load.
- **The site's shell** (`assets/noor2.css`, `assets/noor2.js`; the rooms
  `api/page.js` renders, the home page, and every older page through the
  skin `assets/noor2-skin.css` that `noor-fx.js` loads where `data-n2` is
  absent): the reels' night, one idea per screen, everything under the
  thumb. The bar is five doors, no two alike, decided 9 September 2026 when
  Sam asked why Read and Listen both went to the Qur'an: Today (the day's
  light, word and chapter), Qur'an (read and heard in one room), Story (the
  Path in order), Words (the dictionary), Search (the page's own search,
  else the words). A verse or a surah lights Qur'an, a chapter Story, a
  Light lights Today only on its own day. Every movement rides one spring;
  fades and blurs the bezier; nothing moves under reduced motion
  (`tests/rooms.mjs` audits the file). The kids' games keep their own
  screen; a parchment page keeps its parchment and gets only the bar, the
  room for it and the share.
- **Paused by Sam:** language auto-detect and per-language SEO.

## What done means

A thing is done when it runs unattended, when it fails honestly and says
why in the console, when a reviewer has read it against the sources, when
the tests pass (`node tests/<name>.mjs`), and when Sam has the page that
tells him what to drag and what to press. Not before.

## The map

- `OPERATIONS.md` — how the house runs day to day, the money, the consoles.
- `tools/reels/README.md` — the reels, end to end.
- `api/` — the machinery; each file opens with why it exists.
- `tests/` — one file per promise; run any of them on its own.
- `lights/all.json`, `build/dict-*.json`, `api/_calendar.js`,
  `assets/menu-index.json` — the sources every generated thing draws from.

## What is next

The second cut of the reels (shader picture, tempo grid, the muted drum,
seven kinds) was rendered on GitHub on 9 September 2026, the shelf grew to
1,265 cards the same night, and the shelf moved to GitHub Releases the day
after, with posted reels retiring weekly. Then: a longer verse list
(`verses.txt`, curated and audited, so the plan keeps refilling as the
shelf drains at 28 a week); a narrated branch for the Did you know, day's
card and This day reels (Sam's own voice tool, the library's own words,
never under the Qur'an); the Telegram bot and channel made in Sam's
Telegram, and the two variables; a one-time rewrite of the git history to
drop the 1.3 GB of old video it still carries; the achievements room by
field and era; the internal linking audit once the dictionary pull request
is live; the rota leaning on what the insights say strangers watch.
