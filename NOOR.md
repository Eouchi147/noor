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
- **Sound:** no percussion, no pulse, no third in the pitch set (the
  suspended set only), and **nothing at all under the Qur'an**: when a verse
  is recited the bed is silent. A tempo grid may shape the timing; it is
  never sounded.
- **Money:** 2.5% zakat computed on gross first; the private ledger in the
  console; the household floor of $20k USD a month. The public page names
  only the zakat.
- **Nothing half finished goes live.** Every deliverable is audited for
  production before it is handed over, and shipped with a step-by-step page.

## How work reaches the site

- Sam drags files into GitHub's web UI (100 files per drag). He is never
  asked to run a terminal or git command. Nothing is ever pushed to the
  live repository by anyone else; pull requests opened by the workflows
  (`reels`, `dictionary`) are merged by him.
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

- **The reels** (`tools/reels/README.md`): six kinds share five slots a day
  (08, 11, 14, 17, 21 UTC): the day's card, Did you know?, This day, The
  word, One verse, and The Codex (the brand's own reel, Friday evenings). A
  rota by weekday, one no-repeat walk per kind, a This day reel on its own
  Hijri date; 150 verses and 106 words on the shelf. The render workflow
  spreads a shelf over up to four machines and opens one pull request.
  The picture is a shader in the browser; the words are anime.js on a tempo
  grid per kind; the sound is built in numpy and finished in Pedalboard;
  every reel is levelled (-18 LUFS; -16 for a verse). A different reciter
  each time from the roster in `verses.py`, named on screen.
- **Channels** (`api/_channels.js`): Facebook and Instagram live, and every
  post there goes up a second time as a story (`social.stories` dial);
  YouTube Shorts for reels once the consent is given; Pinterest approved
  (Trial), each kind on its own board, reels as video pins, Standard access
  asked for with a screen recording; X built and switched off (paid); Reddit
  drafts only, never automatic; Telegram built (`api/_telegram.js`: a bot
  from BotFather made administrator of a public channel, TG_BOT_TOKEN and
  TG_CHAT_ID), cards as photos and reels as videos; TikTok and Threads after
  YouTube. The day is ten posts (nine without a countdown),
  eighteen surfaces on Meta, well inside Instagram's hundred a day.
- **Reliability** (`api/social.js`): the poster posts first, then heals what
  failed with backoff, and never double-posts: a half-sent slot is retried
  one network at a time, a legacy-sent card is honoured, a slot in flight
  cannot be sent again.
- **Traffic** (`api/beacon.js`): the owner's browser, bots, AI crawlers and
  previewers are not counted; the count is honest from the marked date.
- **The Lantern** (`api/_models.js`): the best free model on OpenRouter,
  refreshed from the live list; never probed on page load.
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

The Codex and the second cut of the reels (shader picture, grid, sound
chain) are shipping now. Then: the Telegram bot and channel made in Sam's
Telegram, and the two variables; the YouTube consent in Sam's browser; more day's cards and Did you knows; the achievements room by field
and era; the internal linking audit once the dictionary pull request is
live; Instagram insights so the rota can lean on what strangers watch.
