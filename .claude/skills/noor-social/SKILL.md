---
name: noor-social
description: Work on NOOR's social publishing machine (api/social.js and its channels, the schedule, the reels shelf, the ledger, the console): read the live records and function logs, diagnose a failure, change the dispatcher, verify on the next slot. Use for any posting, duplicate, missing network, or ledger question.
---
# /noor-social <question or change>

Read `SOCIAL_ENGINE.md` first: it holds the map of the machine and what was fixed on 15
September 2026.

1. **Evidence before code.** The Director (or a researcher with the browser and Vercel
   tools) reads: the slot records at `noorcodex.com/api/social?action=plan&date=YYYY-MM-DD`
   (the console must be unlocked in the owner's browser; he types the password), the
   function log of the hour (Vercel runtime logs scoped to the production deployment and
   the hour's window, search `noor`), and `?action=status` for the dials and tokens. Never
   a token in a report.
2. **Scout** (`haiku`) maps the code path the evidence points at, with file:line.
3. **Builder** (`sonnet`) changes the dispatcher or a channel, with the suites named:
   social, heal, retry, claim, stories, cards-stories, retire, norepeat, reels, reels-kinds,
   telegram, threads, youtube, pinterest, crongate, calendar, podcast, reel-proxy. Meta,
   YouTube and the store are stubbed in the tests; nothing in a test may reach a network.
4. **Refuter** (`opus`) with the duplication questions of the masterplan in its orders:
   can this send twice, can a 200 be mistaken for a publication, what does the record
   carry (platform, time, URL, asset version, method), what state does the slot end in.
5. `/noor-release`, then watch the next slot's log line (`{"noor":"sent",...}`) and the
   record, and say what happened in one message.
