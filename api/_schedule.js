/* NOOR · the day, in slots
   ===========================================================================
   One post a day became four, then seven, then nine, and ten when something
   is coming.

       05:00 UTC  dawn    what today is, and what to do about it
       08:00 UTC  reelA   a reel (morning)
       09:00 UTC  lead    only when an observance is a known number of days out
       11:00 UTC  reelC   a reel (noon)
       12:00 UTC  light   the day's card, the engine that already existed
       14:00 UTC  reelD   a reel (afternoon)
       16:00 UTC  word    one word of the Path, in Arabic and plain English
       17:00 UTC  reelB   a reel (evening)
       20:00 UTC  dusk    one chapter of the Path
       21:00 UTC  reelE   a reel (night)

   Every reel also goes out a second time as a story on Facebook and
   Instagram (api/social.js, addStories). The five cards are stories ONLY
   since 9 September 2026 (social.cardsFeed, off by default): they reach
   nobody in a feed, so the reels keep the feed and the cards keep the
   followers who open stories. Ten stories and five reels a day, well inside
   Instagram's hundred.

   Two design decisions worth stating, because both were tempting to get wrong.

   FIRST: the dawn slot is the only one allowed to make a dated claim, and it
   refuses to run at all if the calendar could not be verified. Every other
   slot draws on material that is true on any day -- a word means what it means
   whatever the date -- so an unreachable calendar API costs the day's
   announcement and nothing else. The site keeps talking; it just stops
   claiming what today is.

   SECOND: word and dusk are chosen by hashing the date, not at random and not
   by a stored cursor. A hash is stable -- the same day always yields the same
   word, so a retry after a failed send cannot post a different one -- and with
   523 words it is well over a year before anything repeats.
--------------------------------------------------------------------------- */

import { readDay, leadsFor, FIXED, MONTHS } from "./_calendar.js";
import { verifiedHijri, verifiedRange, addDays, METHOD_NOTE } from "./_hijri.js";
import { trimToSentences } from "./_prose.js";

/* THIRD: the two reel slots are the only ones that post something rendered
   somewhere else. Reels are the one surface either platform shows to people
   who do not already follow the account, so they are the growth path, and the
   videos are built by a workflow and committed to /reels rather than made at
   post time. A reel slot whose video is not there yet composes to nothing and
   says so, exactly like a word slot with no dictionary: the day loses one post
   and the machine keeps its promise about the rest. The list stays in clock
   order, because a catch-up run works through the owed slots newest first. */
export const SLOTS = [
  { id: "dawn",  at: 5,  needsDate: true  },
  { id: "reelA", at: 8,  needsDate: false, reel: "morning" },
  { id: "lead",  at: 9,  needsDate: true, conditional: true },
  { id: "reelC", at: 11, needsDate: false, reel: "noon" },
  { id: "light", at: 12, needsDate: false },
  { id: "reelD", at: 14, needsDate: false, reel: "afternoon" },
  { id: "word",  at: 16, needsDate: false },
  { id: "reelB", at: 17, needsDate: false, reel: "evening" },
  /* the sixth reel of the day is always a verse: the owner's rule of 9
     September 2026, that no day passes without the Qur'an on the shelf
     going out, and at least twice */
  { id: "reelF", at: 19, needsDate: false, reel: "late" },
  { id: "dusk",  at: 20, needsDate: false },
  { id: "reelE", at: 21, needsDate: false, reel: "night" }
];
export const REEL_SLOTS = SLOTS.filter(s => s.reel).map(s => s.id);
export const reelHalf = id => (SLOTS.find(s => s.id === id) || {}).reel || "";
export const SLOT_IDS = SLOTS.map(s => s.id);

/* a small stable hash, so a given date always picks the same item */
/* ---------------------------------------------------------------------------
   picking without repeating

   This was a hash of the date modulo the list length, which is a fresh throw of
   the dice every morning: nothing stopped two throws landing on the same face a
   week apart, and with seventy-one chapters in the Path the collisions were not
   rare. A reader who follows the account daily notices a repeat long before the
   arithmetic says one was due.

   A stride that shares no factor with the length walks the whole list before it
   returns to any item, so every word and every chapter is used once before any
   is used twice, and the order still depends only on the date -- two servers
   waking on the same morning still agree.
--------------------------------------------------------------------------- */
function hash32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const gcd = (a, b) => b ? gcd(b, a % b) : a;
/* `seen` here does the same work it does in pickStep below, for the same
   reason: this walk is also laid out against the list's own length, so it
   re-shuffles when the shelf grows and can land on something recently sent.
   It reaches the day's card, which walks by date rather than by slot, and the
   stand in kinds. Passing nothing is the old behaviour exactly, which is what
   every caller outside chooseReel does. */
function pick(list, dateStr, salt, seen) {
  if (!list || !list.length) return null;
  const n = list.length;
  if (n === 1) return list[0];
  const day = Math.floor(Date.parse(String(dateStr) + "T00:00:00Z") / 86400000);
  if (!isFinite(day)) return list[hash32(String(dateStr) + "|" + salt) % n];
  let stride = (hash32(salt + "|stride") % (n - 1)) + 1;
  while (gcd(stride, n) !== 1) stride = (stride % (n - 1)) + 1;
  const off = hash32(salt + "|offset") % n;
  const at = d => list[(((d * stride + off) % n) + n) % n];
  const first = at(day);
  if (!seen || typeof seen.has !== "function" || !seen.size) return first;
  /* the first card this walk reaches that has not gone out. Failing that, when
     every card of the kind has been sent, the one sent LONGEST AGO rather than
     whichever the step happened to land on, so a library that has been round
     once still gives the widest gap it can. `seen` may be a plain Set, which
     knows whether but not when; then this is the first in walk order, exactly
     as before. */
  let oldest = null, oldestAt = Infinity;
  for (let i = 0; i < n; i++) {
    const c = at(day + i);
    if (!c) continue;
    if (!seen.has(c.id)) return c;
    const t = typeof seen.get === "function" ? Date.parse(String(seen.get(c.id)) + "T00:00:00Z") : NaN;
    const when = isFinite(t) ? t : 0;
    if (when < oldestAt) { oldestAt = when; oldest = c; }
  }
  return oldest || first;
}

const BASE_TAGS = ["#Islam", "#NoorCodexOfLight"];
/* the link arrives as https://host/?light=DATE; strip the whole path, not just
   the query, or every derived link comes out with a doubled slash */
const root = l => String(l || "").replace(/^(https?:\/\/[^/]+).*$/, "$1");
const tags = (...extra) => [...new Set([...extra, ...BASE_TAGS])];

/* ---------------------------------------------------------------------------
   the expansion

   The first month of slots went out thin: a chapter post whose whole caption
   was its title plus one boilerplate line, a word post that stopped at the
   dictionary's one-line gloss. Accurate, and empty, and the owner said so.

   The library already holds the full material: every chapter of the Path has
   its own /node/<id>.json with a summary, a details narrative, its verse, its
   hadith with a named source and its lessons; every word of the Encyclopedia
   has a long teaching text in assets/dict-index.json. The fix is not to write
   anything new at post time, it is to CARRY what was already written and
   audited. The caller fetches the chosen chapter and the chosen entry and
   hands them in as ctx.node and ctx.entry; with neither present these slots
   still compose, the way the norepeat test builds them, just thinner.
--------------------------------------------------------------------------- */
/* {{c:id|label}} and {{n:ID|label}} are the site's own cross links; a caption
   keeps the label and drops the plumbing */
const unmark = s => String(s || "").replace(/\{\{[a-z]+:[^|{}]+\|([^{}]*)\}\}/g, "$1");

/* the invitation, one honest sentence per kind of post, claims checked against
   the live rooms rather than remembered: the Mushaf is recited, the
   Encyclopedia holds 523 entries, the Path holds 71 chapters */
const INVITE = {
  dawn: "Noor Codex of Light is a free Islamic library: the whole Qur'an recited, the calendar explained with its evidence named, the story of Islam told in order. No ads, no trackers, no account.\n\nnoorcodex.com",
  lead: "Noor Codex of Light is a free Islamic library: the whole Qur'an recited, the calendar explained with its evidence named, the story of Islam told in order. No ads, no trackers, no account.\n\nnoorcodex.com",
  word: "One word a day, from the Encyclopedia of the Path: 523 words of the deen, each with its Arabic, its evidence and its meaning in plain English, free at noorcodex.com. No ads, no trackers, no account.",
  dusk: "One chapter a day, from the Path of Creation: the whole story in order, Kun Fayakun to the Hour, in 71 illuminated chapters, free at noorcodex.com. No ads, no trackers, no account."
};

/* the pickers, exported so the caller can know WHICH chapter and word today
   is, fetch their full material, and hand it back in */
export const pickWord = (words, dateStr) => pick(words, dateStr, "word");
export const pickChapter = (path, dateStr) => pick(path, dateStr, "path");

const dayName = g => {
  try { return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    [new Date(String(g) + "T12:00:00Z").getUTCDay()] || ""; } catch { return ""; }
};

/* ---------------------------------------------------------------------------
   which slots belong to this day
--------------------------------------------------------------------------- */
export async function planDay(dateStr, opts = {}) {
  const h = await verifiedHijri(dateStr, opts);
  const day = readDay(h);                       /* null when unverified */
  let leads = [];
  if (h) {
    const ahead = await verifiedRange(addDays(dateStr, 1), 30, opts);
    leads = leadsFor(h, ahead);
  }
  const plan = [];
  for (const s of SLOTS) {
    if (s.needsDate && !h) continue;            /* no verified date, no dated post */
    if (s.id === "lead" && !leads.length) continue;
    plan.push(s.id);
  }
  return { date: dateStr, hijri: h, day, leads, slots: plan, verified: !!h };
}

/* ---------------------------------------------------------------------------
   which reel today

   Five kinds of reel share two slots a day. The kinds take turns by weekday,
   so a follower sees a verse, a word, a Did you know and the day's card in a
   rhythm rather than a run of one thing; within a kind the stride walk above
   keeps any one card from coming back before the rest have had their turn.

   A This day reel belongs to one Hijri date and to no other: on its date it
   takes the morning slot from whatever the rota had there, and on every other
   date it is never chosen at all. A kind with nothing rendered yet simply
   yields its turn to the next, so the account is never silent because a
   shelf is still being filled.
--------------------------------------------------------------------------- */
const ROTA = {
  /* Sun Mon Tue Wed Thu Fri Sat -- by the UTC day of the week. Six reels a
     day, and the sixth (19:00, "late") is always One verse: the whole
     library stands on the Qur'an, and the owner asked on 9 September 2026
     that no day pass without at least two verse reels. With the Wednesday
     afternoon turned from a Name to a verse, every day of the week now
     carries two or three. Across a week: 19 verses, 9 words, 5 of the 99
     Names, 6 Did you knows, 2 day's cards (one in the morning, one in the
     evening, so both halves of that shelf are walked), 1 du'a of the Path,
     and This day on its own date. The weights follow the wells: 600 verses
     and 523 words carry half a year without a repeat; the 99 Names and the
     18 du'as come round, which is what Names and du'as are for. The Codex
     reel, the brand's own, was retired on 9 September 2026: it praised the
     house and taught nothing. */
  morning:   ["verse", "verse", "know", "light", "name", "verse", "know"],
  noon:      ["word", "name", "verse", "word", "know", "word", "verse"],
  /* THE AFTERNOON IS THE SILENT SHORT ON FOUR DAYS, AND IT REPLACES RATHER
     THAN ADDS. The owner asked for the new format to have a slot of its own
     and named the real risk in the same breath: eleven posts a day is
     already a lot to send from one account, and a twelfth is the sort of
     thing that gets an account looked at. So nothing is added. The
     afternoon was the least distinct of the six reel halves, and it is the
     one the shorts take. The daily volume does not change by one post.

     FOUR DAYS, NOT SEVEN. A silent short is a bigger, slower thing to make
     than a reel, and the owner's own words on 16 September 2026 were "two
     to four films a week": Sunday, Tuesday, Thursday and Saturday carry a
     short; Monday, Wednesday and Friday keep exactly what the afternoon
     showed before a single short existed, position for position out of
     afternoonUntilShorts below, so nothing on those three days changes.

     THIS ROW IS ALSO SELF DISABLING, which is why it needs no flag and no
     switch to be safe to ship. chooseReel walks [want, ...FALLBACK]; "short"
     is deliberately NOT in FALLBACK; and the filter under it yields nothing
     for a kind with no rows. So until rows of kind "short" actually exist in
     the manifest this row does nothing whatever and the afternoon behaves
     exactly as it does today (afternoonUntilShorts, every day). The moment
     the shorts are on the site it starts using them on its four days, and
     because "short" is absent from FALLBACK they can never leak into any
     other half. Emptying this row back to afternoonUntilShorts restores the
     old rota exactly. */
  afternoon: ["short", "word", "short", "verse", "short", "know", "short"],
  /* what the afternoon showed before the shorts, and shows again on any day
     the shelf has no short: the audit of 15 September 2026 found that "short"
     with no rows fell through to FALLBACK, which begins with "verse", so the
     afternoon had been a verse every day since the line went in (24 verses a
     week for 19 planned, and only 479 distinct verses in six months). The
     stand in is the old rota for that weekday, walked by step like any kind. */
  afternoonUntilShorts: ["name", "word", "know", "verse", "verse", "know", "word"],
  evening:   ["word", "light", "know", "word", "verse", "name", "word"],
  night:     ["name", "verse", "verse", "word", "dua", "verse", "verse"],
  late:      ["verse", "verse", "verse", "verse", "verse", "verse", "verse"]
};
/* the order the shelf is searched when the kind the rota wants has nothing
   rendered yet (a shelf mid-render, a kind not yet made) */
const FALLBACK = ["verse", "word", "name", "know", "light", "dua"];

/* ---------------------------------------------------------------------------
   the walk, counted by slot and not by day

   pick() steps by calendar day, which is right for one word or one chapter a
   day and wrong for a kind that has two slots on a Monday: both slots asked
   the same day for the same kind and got the same card, and over six months
   a third of the reels went out twice in one day while half the shelf was
   never shown. Here the step is the running count of that kind's slots since
   the epoch, so every slot of a kind is a new step of one walk that visits
   the whole shelf before it comes round. Adding cards to a kind reshuffles
   its walk (the stride is chosen against the length), which is the price of
   a stateless rota and a fair one: a new shelf is a new walk.
--------------------------------------------------------------------------- */
const HALVES = ["morning", "noon", "afternoon", "evening", "late", "night"];
const REEL_EPOCH = Date.UTC(2026, 8, 6);          /* Sunday 6 September 2026 */

export function reelStep(kind, dateStr, half, noShorts) {
  const t = Date.parse(String(dateStr) + "T00:00:00Z");
  if (!isFinite(t)) return 0;
  const day = Math.floor((t - REEL_EPOCH) / 86400000);
  const week = Math.floor(day / 7), dow = ((day % 7) + 7) % 7;
  const hi = HALVES.indexOf(half);
  /* the rota as it is walked: while the shelf has no short, the afternoon
     is its stand in row, and the kinds on that row count their afternoon
     slots as steps, or an afternoon word would share its step with the
     evening word of the same day and could land on the same card */
  const row = h => (h === "afternoon" && noShorts) ? ROTA.afternoonUntilShorts : (ROTA[h] || []);
  let perWeek = 0, before = 0;
  for (let d = 0; d < 7; d++) for (let h = 0; h < HALVES.length; h++) {
    if (row(HALVES[h])[d] !== kind) continue;
    perWeek++;
    if (d < dow || (d === dow && h < hi)) before++;
  }
  return week * perWeek + before;
}

/* THE WALK STEPS PAST WHAT HAS ALREADY GONE OUT.

   The walk visits every card of a kind before it comes round, which is right,
   and it is computed from the shelf rather than remembered, which is cheap.
   The cost of that is written a few lines above: "a new shelf is a new walk".
   Change the shelf and every step maps to a different card. Measured on 19
   September 2026, putting the films on the shelf moved 60 of the 84 slots in
   a fortnight onto a different card, across name, know, verse and word.

   A re-shuffled walk can land on something posted days earlier. When it does,
   sendOne's duplicate guard refuses every channel that already has it and the
   slot goes out to nobody: five green "already had it" labels and silence. The
   guard was doing its job. It was simply the only thing looking, and by the
   time it looks the slot is already spent.

   So the walk is told what has actually been sent, and steps on. It keeps its
   own shape, which is the point: this is not a filter. Filtering the list
   would change its length, and the stride and offset are chosen against the
   length, so filtering would re-shuffle the very walk it was meant to steady.
   Stepping forward leaves every other card exactly where it was and only
   skips the cells that are occupied.

   With no set passed, nothing changes at all: the first pick is returned
   before the set is even consulted. So a store that is down, a caller that
   does not know about this, and every existing test all get today's answer.
   If every card of a kind has been sent inside the window, the plain pick is
   returned rather than nothing, which is what happens today. */
function pickStep(list, step, salt, seen) {
  if (!list || !list.length) return null;
  const n = list.length;
  if (n === 1) return list[0];
  let stride = (hash32(salt + "|stride") % (n - 1)) + 1;
  while (gcd(stride, n) !== 1) stride = (stride % (n - 1)) + 1;
  const off = hash32(salt + "|offset") % n;
  const at = s => list[(((s * stride + off) % n) + n) % n];
  const first = at(step);
  if (!seen || typeof seen.has !== "function" || !seen.size) return first;
  /* the first card this walk reaches that has not gone out. Failing that, when
     every card of the kind has been sent, the one sent LONGEST AGO rather than
     whichever the step happened to land on, so a library that has been round
     once still gives the widest gap it can. `seen` may be a plain Set, which
     knows whether but not when; then this is the first in walk order, exactly
     as before. */
  let oldest = null, oldestAt = Infinity;
  for (let i = 0; i < n; i++) {
    const c = at(step + i);
    if (!c) continue;
    if (!seen.has(c.id)) return c;
    const t = typeof seen.get === "function" ? Date.parse(String(seen.get(c.id)) + "T00:00:00Z") : NaN;
    const when = isFinite(t) ? t : 0;
    if (when < oldestAt) { oldestAt = when; oldest = c; }
  }
  return oldest || first;
}

export function chooseReel(cards, dateStr, half, hijri, seen, bias, report) {
  const all = (cards || []).filter(c => c && c.id);
  /* ids already sent to some channel inside the duplicate guard's window; a
     Set, an array, or nothing at all, which is the same as nothing */
  const avoid = seen && typeof seen.has === "function"
    ? seen : new Set(Array.isArray(seen) ? seen : []);
  const kindOf = c => c.kind || "light";
  const dow = new Date(String(dateStr) + "T12:00:00Z").getUTCDay();
  if (half === "morning" && hijri && hijri.m && hijri.d) {
    const today = all.filter(c => kindOf(c) === "day" && Number(c.hm) === Number(hijri.m) && Number(c.hd) === Number(hijri.d));
    /* a named day outranks the month it opens: Ashura's month is not the news */
    today.sort((a, b) => (String(a.id).startsWith("month-") ? 1 : 0) - (String(b.id).startsWith("month-") ? 1 : 0));
    if (today.length) return today[0];
  }
  let want = (ROTA[half] || ROTA.morning)[isFinite(dow) ? dow : 0];
  const noShorts = !all.some(c => kindOf(c) === "short");
  if (want === "short" && noShorts)
    want = ROTA.afternoonUntilShorts[isFinite(dow) ? dow : 0];
  const order = [want, ...FALLBACK.filter(k => k !== want)];
  for (const kind of order) {
    /* the old manifests carried no kind and no other kind than light; a card
       without a slot is fine anywhere, one with a slot keeps to its half.
       The salt is the kind alone, whichever slot asks: the walk is indexed by
       the date, so a word chosen on Thursday morning and one chosen on
       Sunday evening are different steps of one walk, not two walks that
       can land on the same card in the same week. */
    const list = all.filter(c => kindOf(c) === kind && (!c.slot || c.slot === half || kind !== "light"));
    if (list.length) {
      /* AN EXPERIMENT'S OWN ARM (api/_experiments.js's biasFrom, the day's
         {kind, match}). Only when the kind this loop is actually walking is
         the one the test is about, and only when the arm's own pool -- this
         kind's cards, filtered by the arm's predicate -- still holds at
         least 8 the duplicate guard has not already sent: a pool thinner
         than that would walk itself dry inside a week and start repeating,
         which a test needs at least as much as an ordinary day does. Every
         other case (no bias, the wrong kind, a pool run thin) is exactly
         today's walk over the whole kind, untouched. */
      let pool = list;
      if (bias && bias.kind === kind && typeof bias.match === "function") {
        const arm = list.filter(bias.match);
        const fresh = arm.filter(c => !avoid.has(c.id)).length;
        /* `report`, an optional 7th argument, out only -- a caller that
           needs to know whether the arm's own pool was actually walked
           (never merely offered) sets a property here rather than this
           function changing what it returns; slotExtras below is the one
           caller that needs it, to tag exp on a slot record only when it
           is true (2026-09-25 fix: a card the fallback pool happened to
           still match by chance was being tagged as the arm's own pick). */
        if (fresh >= 8) { pool = arm; if (report) report.usedArm = true; }
      }
      /* the kind the rota asked for walks by slot count; a stand-in kind (the
         shelf mid-render) and the day's card, which has one slot a half a
         week and cannot meet itself, walk by the day as before */
      if (kind === want && kind !== "light") return pickStep(pool, reelStep(kind, dateStr, half, noShorts), "reel:" + kind, avoid);
      return pick(pool, dateStr, kind === "light" ? "reel:" + half : "reel:" + kind, avoid);
    }
  }
  /* the shelf holds only the old day's cards, filed as morning and evening,
     and a new half (noon, afternoon, night) asked: rather than post nothing,
     the half takes any day's card, on its own walk, until the other kinds
     are rendered */
  const any = all.filter(c => kindOf(c) === "light");
  if (any.length) return pick(any, dateStr, "reel:" + half, avoid);
  return null;
}

/* ---------------------------------------------------------------------------
   what each slot actually says
--------------------------------------------------------------------------- */
/* the room a reel's viewer is sent to: the exact page the caption names,
   never the home page. Until 15 September 2026 every reel carried
   /?light=DATE, a parameter no page reads, and Pinterest used it as the
   pin's destination. The id carries the room for a verse, a word and a
   Light; a Did you know card names its Light in `src` when the manifest
   has it; the rest go to their shelf. */
export function reelRoom(r) {
  if (!r || !r.id) return "/";
  const id = String(r.id), kind = r.kind || "light";
  if (kind === "verse") return "/verse/" + id.replace(/^verse-/, "");
  if (kind === "word") return "/dictionary/" + id.replace(/^word-/, "");
  if (kind === "light") return "/light/" + id;
  /* a silent short carries its own room, a page and anchor (heroes.html#..)
     or a Light's room, written on the row by shortmanifest.py; with none on
     the row (an old or malformed one) this falls back to the shelf like a
     Did you know with no src, rather than the home page. */
  if (kind === "short") return r.room ? "/" + String(r.room).replace(/^\/+/, "") : "/";
  if (kind === "know") return r.src ? "/light/" + String(r.src) : "/light";
  if (kind === "name") return "/allah";
  if (kind === "dua") return "/words";
  if (kind === "day") return "/today";
  return "/";
}

export function buildSlot(slot, ctx) {
  const p = buildSlotInner(slot, ctx);
  /* the slot rides along, so a channel that files things by kind (Pinterest's
     boards) knows what it was handed without asking the schedule again */
  if (p && !p.slot) p.slot = slot;
  return p;
}

function buildSlotInner(slot, ctx) {
  const { date, hijri: h, day, leads, words, path, link, image, node, entry } = ctx;

  /* -------------------------------------------------------------------------
     a reel

     The caption was written and audited alongside the video and is carried
     whole: `caption` tells the channel shaper not to assemble one, because
     anything assembled here would be a second, worse caption sitting under a
     video that already said it. `only` keeps a reel off the channels that
     cannot show one; the cover is what they would fall back to, and a still of
     a video is a poor post.
  ------------------------------------------------------------------------- */
  if (reelHalf(slot)) {
    const r = ctx.reel;
    if (!r || !r.id || !r.video) return null;
    const out = {
      lvl: "editorial", key: r.id,
      title: r.hook || "", oneLine: r.hook || "",
      body: r.caption || "", caption: r.caption || "",
      todo: [], basis: "", note: "", tags: [], invite: "",
      link: (ctx.base || "") + reelRoom(r), image: r.cover || null, video: r.video, reel: true,
      kind: r.kind || "light",
      only: ["facebook", "instagram", "youtube", "pinterest", "telegram", "threads"]
    };
    /* which arm of a running experiment this reel actually was
       (api/_experiments.js's own biasFrom), carried through so
       api/social.js's own writeSlot can put {id, arm} on the slot record */
    if (r.exp) out.exp = r.exp;
    /* A SILENT SHORT CARRIES MORE THAN A CAPTION. shapeRaw's short branch
       (api/_channels.js) reads p.story, p.title, p.hook, p.payoff, p.tags,
       p.wide, p.src and p.room; none of those existed on the post this
       function built, only on the row itself, so that whole branch never
       fired -- every network fell through to the plain caption path and the
       long story, the wide file and the row's own tag set never reached
       anyone. Carried here, for a short only; an ordinary reel is untouched. */
    if ((r.kind || "light") === "short") {
      out.title = r.title || r.hook || "";
      out.story = r.story || "";
      out.hook = r.hook || "";
      out.payoff = r.payoff || "";
      out.tags = r.tags || [];
      out.wide = r.wide || "";
      out.src = r.src || "";
      out.room = r.room || "";
    }
    return out;
  }

  if (slot === "dawn") {
    if (!h || !day) return null;
    const hd = `${h.d} ${h.name} ${h.y}`;
    const f = day.fixed, rec = day.recurring;
    if (f) {
      return {
        lvl: f.lvl, key: f.key,
        title: f.name,
        /* the names already carry their article -- "The Day of Arafah" -- so
           "Today is The Day of Arafah" reads like a machine wrote it */
        oneLine: `${f.name}: ${hd}.`,
        body: `${hd}.\n\n${f.what}`,
        todo: f.todo || [],
        basis: f.basis ? (f.url ? `${f.basis} · ${f.url}` : f.basis) : "",
        note: [f.note, METHOD_NOTE].filter(Boolean).join(" · "),
        tags: tags(f.tag || "#Islam", "#Muslim"),
        invite: INVITE.dawn,
        link, image
      };
    }
    if (rec.length) {
      const r = rec[0];
      return {
        lvl: r.lvl, key: r.key, title: r.name,
        oneLine: `${r.name}: ${r.what}`,
        body: `${hd}.\n\n${r.what}`,
        todo: r.todo || [],
        basis: r.url ? `${r.basis} · ${r.url}` : r.basis,
        note: [r.note, METHOD_NOTE].filter(Boolean).join(" · "),
        tags: tags(r.tag || "#Islam", "#Muslim"),
        invite: INVITE.dawn,
        link, image
      };
    }
    /* an ordinary morning. The date alone teaches nothing; the month it sits
       in always does, and the month piece was written and audited the way the
       observances were. On top of it, one true dated line about the rhythm:
       what stands near enough today to act on. */
    const m = MONTHS[h.m];
    const rhythm = [];
    if (h.d >= 9 && h.d <= 12 && h.m !== 12)
      rhythm.push(`The white days of this month, the 13th to the 15th, begin in ${13 - h.d === 1 ? "one day" : (13 - h.d) + " days"}: three fasts the Prophet ﷺ named to Abu Dharr.`);
    const wd = dayName(h.g);
    if (wd === "Sunday" || wd === "Wednesday")
      rhythm.push(`Tomorrow is ${wd === "Sunday" ? "Monday" : "Thursday"}, one of the two days deeds are presented, which the Prophet ﷺ liked to meet fasting.`);
    if (wd === "Thursday")
      rhythm.push("Tonight is the night of Jumu'ah, and tomorrow its day: many bring forward Surah al-Kahf to the night.");
    if (m) {
      return {
        lvl: m.lvl, key: "month-" + h.m + "-" + h.d, title: hd,
        oneLine: `${hd}, in ${m.name}.`,
        /* the title already prints the date, so the body opens on the month */
        body: m.what + (rhythm.length ? `\n\n${rhythm.join(" ")}` : ""),
        todo: [], basis: m.url ? `${m.basis} · ${m.url}` : (m.basis || ""),
        note: [m.note, METHOD_NOTE].filter(Boolean).join(" · "),
        tags: tags("#HijriCalendar", "#" + m.name.replace(/[^A-Za-z]/g, "")),
        invite: INVITE.dawn,
        link, image
      };
    }
    return {
      lvl: "editorial", key: "date", title: hd,
      oneLine: `Today is ${hd}.`,
      body: `${hd}.\n\nAn ordinary day in the Muslim year, which is most of them, and the ones the rest are built out of.`,
      todo: [], basis: "", note: METHOD_NOTE,
      tags: tags("#HijriCalendar"),
      invite: INVITE.dawn,
      link, image
    };
  }

  if (slot === "lead") {
    if (!leads || !leads.length) return null;
    const L = leads[0], o = L.obs;
    const when = L.days === 1 ? "tomorrow" : `in ${L.days} days`;
    return {
      lvl: o.lvl, key: o.key + "-lead", title: `${o.name} is ${when}`,
      oneLine: `${o.name} is ${when}.`,
      body: `${o.name} falls ${when}.\n\n${o.what}`,
      todo: o.todo || [],
      basis: o.basis ? (o.url ? `${o.basis} · ${o.url}` : o.basis) : "",
      note: [o.note, METHOD_NOTE].filter(Boolean).join(" · "),
      tags: tags(o.tag || "#Islam", "#Muslim"),
      invite: INVITE.lead,
      link, image
    };
  }

  if (slot === "word") {
    const w = pick(words, date, "word");
    if (!w) return null;
    /* entry is the word's FULL record out of assets/dict-index.json, fetched
       by the caller; w is the menu index's one-line version of the same word */
    const e = entry && (entry.t || entry.l || entry.s) ? entry : null;
    const long = e && e.l ? trimToSentences(unmark(e.l), 1050) : "";
    const shortLine = (e && e.s) || w.s || "";
    /* the term itself is the title, and every channel prints the title first,
       so the body opens on the Arabic rather than saying the word twice */
    const bodyParts = [w.a, shortLine];
    if (long && long !== shortLine) bodyParts.push(long);
    const catLine = e && e.cat ? `${e.cat} · one entry of 523 in the Encyclopedia of the Path.` : "";
    return {
      lvl: (e && e.k) || "editorial", key: "word-" + w.i, title: w.t,
      oneLine: `${w.t} (${w.a}): ${shortLine}`,
      body: bodyParts.filter(Boolean).join("\n\n"),
      todo: [], basis: "",
      note: catLine,
      tags: tags("#Arabic", "#Quran", "#IslamicTerms"),
      invite: INVITE.word,
      /* a fragment in a caption is mangled into a hashtag by the networks, so
         the deep link travels as a query and the room reads both spellings */
      link: root(link) + "/dictionary?w=" + w.i, image
    };
  }

  if (slot === "dusk") {
    const c = pick(path, date, "path");
    if (!c) return null;
    /* node is the chapter's own /node/<id>.json, fetched by the caller: the
       same file the reader's modal opens, so the post and the room agree */
    const n = node && (node.summary || node.details) ? node : null;
    const summary = n ? unmark(n.summary || "") : "";
    const details = n ? trimToSentences(unmark(n.details || ""), 950) : "";
    const lessons = n && Array.isArray(n.lessons) ? n.lessons.slice(0, 3).map(unmark) : [];
    /* the verse the chapter itself carries, translation first; a chapter with
       no verse offers its hadith instead, source and all */
    let basis = "";
    const v = n && Array.isArray(n.quran) && n.quran[0];
    const hh = n && Array.isArray(n.hadith) && n.hadith[0];
    const bits = [summary, details].filter(Boolean).join("\n\n");
    /* a chapter that already quotes its verse in the narrative does not quote
       it again underneath; the hadith, with its named source, stands instead */
    const verseShown = v && v.en && bits.includes(String(v.en).slice(0, 48));
    if (v && v.en && !verseShown) basis = `Qur'an ${v.ref}: "${trimToSentences(v.en, 200) || v.en}"`;
    else if (hh && hh.text) basis = `${trimToSentences(unmark(hh.text), 220) || hh.text}` + (hh.source ? ` · ${hh.source}` : "");
    return {
      lvl: "editorial", key: "path-" + c.i, title: n && n.titleEn ? n.titleEn : c.t,
      oneLine: `${(n && n.titleEn) || c.t}. Chapter ${c.i} of 71 on the Path.`,
      body: bits || `${c.t}\n${c.a || ""}\n\nChapter ${c.i} of the Path of Creation: the story from Kun Fayakun to the Hour, in seventy-one chapters.`,
      todo: lessons,
      basis,
      note: [n && n.metric ? n.metric : "", `Chapter ${c.i} of 71 on the Path of Creation.`].filter(Boolean).join(" · "),
      tags: tags("#IslamicHistory", "#Muslim"),
      invite: INVITE.dusk,
      /* ?node= rather than #node-: the fragment form is eaten as a hashtag in
         a caption, and the query form is the one the room's own tests open */
      link: root(link) + "/?node=" + c.i, image
    };
  }

  return null;   /* "light" is built by compose() in social.js, not here */
}

/* ---------------------------------------------------------------------------
   fetching what the day's word and chapter actually say

   One helper, used by the poster and by the card route, so the caption and
   the picture are always built from the same material. Every fetch here is
   allowed to fail: a slot composed without its enrichment is the thin post
   the machine used to send, which is worse than the full one and better than
   none.
--------------------------------------------------------------------------- */
export async function slotExtras(base, date, index, slot, hijri, pin, seen, bias) {
  const out = { node: null, entry: null, reel: null };
  const grab = async u => {
    try { const r = await fetch(u); return r && r.ok ? await r.json() : null; } catch { return null; }
  };
  /* The manifest lists only the cards that HAVE a rendered video, so a card
     added to the plan but not yet rendered can never be chosen and no slot can
     ever point at a file that is not there. */
  const half = reelHalf(slot);
  if (half) {
    const man = await grab(base + "/reels/index.json");
    const cards = man && Array.isArray(man.cards) ? man.cards : [];
    /* a repair is pinned to the reel that went out: the record names it, and
       the rota's walk moves when the shelf grows (every Monday), so a retry
       composed from the rota came out as a different card and was refused
       as drift (every reel of 15 September 2026 after the shelf grew).
       A pin skips chooseReel entirely, so `report` below stays untouched
       and a repair never carries exp -- honest, since a pinned repair is
       not the arm's own pool being walked, whatever it happens to match. */
    const report = {};
    const c = (pin && cards.find(x => x && x.id === pin)) || chooseReel(cards, date, half, hijri || null, seen, bias || null, report);
    /* the row carries the video's own URL once the shelf is on the Blob
       store; an older manifest has none, and the file is on the site */
    const isUrl = v => typeof v === "string" && /^https:\/\//.test(v);
    if (c) out.reel = { ...c,
      video: isUrl(c.video) ? c.video : base + "/reels/" + c.id + ".mp4",
      cover: isUrl(c.cover) ? c.cover : base + "/reels/" + c.id + "-cover.jpg" };
    /* exp is written only when the arm's own pool was actually walked to
       reach this card (chooseReel's own `report.usedArm`, above), never
       merely because the card the picker landed on happens to match the
       arm's predicate: a pool run thin falls back to the whole kind (the
       same walk any ordinary day gets), and a card from THAT walk can
       still, by chance, satisfy the arm's own match -- tagging that as the
       arm's own pick would credit the test with a post it never actually
       leaned toward (2026-09-25 fix). Carried on the reel row so buildSlot
       can lift it onto the post, and social.js's own writeSlot can lift it
       onto the slot record -- {id, arm}, nothing else. */
    if (out.reel && report.usedArm && bias)
      out.reel.exp = { id: bias.id, arm: bias.arm };
    return out;
  }
  if (!slot || slot === "dusk") {
    const c = index && pickChapter(index.path, date);
    if (c && c.i != null) out.node = await grab(base + "/node/" + c.i + ".json");
  }
  if (!slot || slot === "word") {
    const w = index && pickWord(index.words, date);
    if (w && w.i != null) {
      const d = await grab(base + "/assets/dict-index.json");
      if (d && d.words && d.words[w.i]) out.entry = d.words[w.i];
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
   which slots are due right now and have not been sent

   The catch-up cap is the important line. If a cron is down for a day and
   comes back, the honest thing is to post the one most recent thing, not to
   empty a backlog of nine posts into a feed at once -- which is precisely the
   pattern that gets an account flagged as automated.
--------------------------------------------------------------------------- */
export function dueNow(planSlots, nowUTC, sent, opts = {}) {
  const hour = nowUTC.getUTCHours();
  const due = SLOTS
    .filter(s => planSlots.includes(s.id))
    .filter(s => hour >= s.at)
    .filter(s => !sent.includes(s.id));
  /* `all` hands back every owed slot, most recent first, and leaves the capping
     to the caller. This exists because capping HERE counts attempts, and an
     attempt that finds nothing to say is not a post: with the old slice the
     day's card sat owed from noon while the machine spent every run on a
     later slot that had nothing to say, and only got out near midnight, on the
     days it got out at all. runDue now walks this list and stops after it has
     actually SENT its cap, which is the thing the cap was ever about. */
  if (opts.all) return due.slice().reverse();
  const cap = opts.cap == null ? 1 : opts.cap;
  return due.slice(-cap);          /* the most recent unsent, not the whole backlog */
}
