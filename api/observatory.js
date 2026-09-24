// NOOR · the Observatory
// ===========================================================================
// Ten posts a day, five networks, a site that counts its own readers, a
// shelf of 1,500 cards: every one of those already has a room of its own in
// this console, and every room answers a different question. Nobody could
// open six rooms every morning and hold the shape of the week in their
// head. This is the seventh room that answers none of those questions on
// its own and all of them at a glance: one call, one JSON, the whole
// ecosystem's numbers side by side so a pattern that only shows up when two
// charts sit next to each other has somewhere to show up.
//
// GET /api/observatory   the composed answer, kept ten minutes (?fresh=1
//   goes round the cache, the same door /api/house already opens).
//
// EVERY NUMBER HERE ALREADY LIVES SOMEWHERE ELSE. This file invents no
// arithmetic of its own kind: it calls api/_insights.js's numbers() for the
// week-over-week folds that room's own Numbers panel already trusts, reads
// the same nsoc:stats:<date>#<slot> snapshots api/_insights.js writes for
// the 30-day trend and the weekday-by-hour grid nothing else has built yet,
// reads api/social.js's own slot records for posting health, and reads the
// Content Graph's shipped derivatives (assets/reel-sources.json,
// reels/index.json, CONTENT_STATUS.md's generated block) for library
// coverage. No network is asked anything here: the Meta and YouTube calls
// live in _insights.js's refresh()/snapshot(), run by the owner's Read
// button and the nightly cron; this route only ever reads what they already
// wrote. A number this file cannot find is null, and the room must show it
// as absent, never as zero -- a network nobody has posted to yet and a
// network that posted and reached nobody are two different facts.
//
// Owner-gated exactly like api/insights.js and api/house.js: the console's
// signed cookie, or the secret in a header for a hand-run request.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import { ownerGate } from "./_owner.js";
import { kv, kvReady, kvKind } from "./_kv.js";
import { SLOT_IDS, REEL_SLOTS } from "./_schedule.js";
import { readSlot, postedChannelCounts } from "./social.js";
import {
  numbers, hourOf, kindLabel, matchedCard, subjectOf, reclassifyKind,
  cacheRead, K_STATS, datesBack, median, mean, MIN_BUCKET
} from "./_insights.js";
import { computeVisitors } from "./visitors.js";

const json = (res, code, obj) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(obj);
};

const WEEKDAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NET_LABEL = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", threads: "Threads" };
const NETS = ["instagram", "facebook", "youtube", "threads"];
const HH = h => String(h).padStart(2, "0") + ":00";
/* the hours a reel actually goes out, read from the schedule itself rather
   than from whatever happened to have a snapshot: 08, 11, 14, 17, 19, 21
   UTC (api/_schedule.js's SLOTS). The weekday-by-hour grid is about reels
   because a reel is the one post with a video and a caption both known well
   ahead, the thing a posting-time decision can actually act on; the five
   card slots (dawn, lead, light, word, dusk) keep their own fixed times and
   are not a choice the owner is making. Fixed rather than discovered from
   the data means an hour with nothing posted still gets its own column,
   marked absent, instead of quietly disappearing. */
const HEAT_HOURS = [...new Set(REEL_SLOTS.map(hourOf))].filter(h => h != null).sort((a, b) => a - b);
/* a name for a slot the owner can act on -- never the internal id. The five
   card slots keep their own fixed time and voice; the six reel slots share
   two a day, named for the half of the day they fall in (api/_schedule.js's
   own HALVES), which is what "reel" already means to the owner reading a
   caption, not which of six near-identical ids happened to carry it. */
const SLOT_NOUN = {
  dawn: "morning card", lead: "coming-up card", light: "day's card", word: "word card", dusk: "chapter card",
  reelA: "morning reel", reelC: "noon reel", reelD: "afternoon reel", reelB: "evening reel", reelF: "late reel", reelE: "night reel"
};
/* exported so any caller holding a bare slot id ("reelA" and the rest of
   api/_schedule.js's own SLOTS) can turn it into the same owner-facing
   word this file already uses, rather than inventing a second name for the
   same slot (api/lantern-agent.js's own tool sanitizer, 2026-09-24) */
export const slotLabel = id => SLOT_NOUN[id] || "post";
/* "the 21:00 UTC night reel", "the 09:00 UTC coming-up card": the clock
   and the noun, no article to agree with the noun (the live page once read
   "a afternoon reel") */
const slotPhrase = s => s.label + " UTC " + slotLabel(s.slot);
const r1 = x => x == null ? null : Math.round(x * 10) / 10;
const sum = xs => { const a = xs.filter(x => typeof x === "number" && isFinite(x)); return a.length ? a.reduce((s, x) => s + x, 0) : null; };
const weekdayOf = d => new Date(d + "T00:00:00Z").getUTCDay();

/* ---------------------------------------------------------------------------
   THE STORE CACHE (masterplan step, this room's own)

   Ten minutes, not the fourteen minutes house.js's flow keeps and not the
   six hours insights.js's per-media cache keeps: this room reads two 30-day
   walks and a handful of small files on every open, cheap enough that ten
   minutes is only there to protect the free store tier from a reader who
   leaves the room open and the console's own visibility-change refresh from
   asking twice in the same minute. ?fresh=1 goes round it, the same door
   /api/house already opens for the steward and the flow. */
export const K_OBS = "nsoc:observatory:v1";
export const CACHE_MS = 10 * 60 * 1000;

export async function readCache(opts = {}) {
  const ready = opts.kvReady || kvReady;
  if (!ready()) return null;
  try {
    const store = opts.kv || kv;
    const raw = (await store([["GET", K_OBS]]))[0];
    if (!raw) return null;
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!v || !v.at) return null;
    const nowMs = opts.now ? Date.parse(opts.now) : Date.now();
    if (nowMs - Date.parse(v.at) > CACHE_MS) return null;
    return v;
  } catch { return null; }
}

/* ---------------------------------------------------------------------------
   THE SHIPPED ASSETS, read once a call, never over the network: the Content
   Graph's own derivatives, exactly as scripts/graph/run.sh last wrote them.
--------------------------------------------------------------------------- */
function readJSON(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), rel), "utf8")); } catch { return fallback; }
}
function readText(rel) {
  try { return fs.readFileSync(path.join(process.cwd(), rel), "utf8"); } catch { return ""; }
}

/* CONTENT_STATUS.md's generated block (scripts/graph/write_counts.py): a
   markdown table between two HTML comments, and one sentence naming the
   heroes-and-Hajj films' own total and how many trace. Parsed, not
   hand-copied, so a re-run of the graph is read here without this file
   changing; a table this cannot find leaves the corpus totals null rather
   than guessed. */
function graphCounts() {
  const md = readText("CONTENT_STATUS.md");
  const out = { types: {}, films: null };
  const block = /<!--\s*graph-counts:start\s*-->([\s\S]*?)<!--\s*graph-counts:end\s*-->/.exec(md);
  const body = block ? block[1] : md;
  for (const m of body.matchAll(/^\|\s*([a-z]+)\s*\|\s*(\d+)\s*\|$/gm)) out.types[m[1]] = parseInt(m[2], 10);
  const fm = /short.*?films.*?:\s*(\d+)\s*total,\s*(\d+)\s*traced/is.exec(body);
  if (fm) out.films = { total: parseInt(fm[1], 10), traced: parseInt(fm[2], 10) };
  return out;
}

/* how many of each type have at least one reel: assets/reel-sources.json's
   own keys, one content_id per entry, each already carrying its reels or
   its films -- presence in the map is coverage, not a count of how many
   reels a single Light or word has (a second reel of the same Light would
   not raise this number, honestly). */
function sourceCoverage() {
  const j = readJSON("assets/reel-sources.json", null);
  const srcs = (j && j.sources && typeof j.sources === "object") ? j.sources : {};
  const out = {};
  for (const id of Object.keys(srcs)) {
    const t = id.split(":")[0];
    out[t] = (out[t] || 0) + 1;
  }
  return out;
}

/* the shelf as it stands right now: reels/index.json (1 MB, read locally,
   vercel.json's includeFiles names it for this function so the read never
   becomes a self network call the way api/insights.js's own manifest read
   is). A card retires (leaves this file entirely, by NOOR.md's own rule)
   once every live network has it, so this count IS "what is left". */
function shelfNow() {
  const j = readJSON("reels/index.json", null);
  const cards = (j && Array.isArray(j.cards)) ? j.cards : [];
  const byKind = {};
  for (const c of cards) { const k = c && c.kind || "?"; byKind[k] = (byKind[k] || 0) + 1; }
  return { total: cards.length, byKind, manifest: j };
}

/* ---------------------------------------------------------------------------
   THE 30-DAY WALK OF THE SNAPSHOTS (nsoc:stats:<date>#<slot>)

   One MGET for up to 300 keys, then one pass over what came back builds
   three things nothing else in the house computes: the per-network daily
   trend, the weekday-by-hour grid of Instagram's median reach and
   YouTube's median views, and the per-kind and per-subject folds over the
   whole 30 days rather than the fortnight numbers() keeps. Every record
   already carries `kind` (api/_insights.js's snapshot() wrote it with
   kindOf); the subject is found here the same way aggregate() finds it,
   through the same matchedCard + subjectOf pair, since a snapshot record
   does not itself carry a subject.
--------------------------------------------------------------------------- */
async function walkStats(dates, manifest, opts) {
  const wanted = [];
  for (const d of dates) for (const s of SLOT_IDS) wanted.push([d, s]);
  const keys = wanted.map(([d, s]) => K_STATS(d, s));
  const recs = await cacheRead(keys, opts);

  const byDateNet = {};                    /* date -> net -> {posts,views,reach,engSum,engBase} */
  const cell = {};                         /* "wd:hh" -> {igReach:[], ytViews:[]} */
  const byDateKind = {};                   /* date -> kind -> {posts,engSum,engBase} */
  const subjRows = [];                     /* one row per (post, instagram) with a subject and a reach */

  for (let i = 0; i < wanted.length; i++) {
    const rec = recs[i]; if (!rec || !rec.stats) continue;
    const [d] = wanted[i];
    const wd = weekdayOf(d), hh = rec.hour;
    const ck = wd + ":" + hh;
    /* the card matched once per record, then reused for both the kind fold
       below and the subject fold already here: a stored "reel:reel" (the
       shelf could not be read the day snapshot() wrote it) is asked of
       THIS call's own manifest before either fold trusts it, the same
       review that fixed numbers() (2026-09-24) */
    const card = matchedCard(rec, manifest);
    const kind = reclassifyKind(rec, manifest, card);
    for (const net of Object.keys(rec.stats)) {
      if (net === "youtubeWide") continue;             /* folded into youtube below, same as numbers() */
      const v = rec.stats[net];
      if (!v || v.error) continue;
      const wide = rec.stats.youtubeWide;
      const views = (net === "youtube" && wide && !wide.error) ? sum([v.views, wide.views]) : v.views;
      const eng = (v.likes || 0) + (v.comments || 0) + (v.shares || 0) + (v.saves || 0);
      const base = v.reach != null ? v.reach : (views != null ? views : 0);

      const dn = (byDateNet[d] = byDateNet[d] || {});
      const row = (dn[net] = dn[net] || { posts: 0, views: null, reach: null, engSum: 0, engBase: 0 });
      row.posts++;
      row.views = sum([row.views, views]);
      row.reach = sum([row.reach, v.reach]);
      row.engSum += eng; row.engBase += base;

      if (HEAT_HOURS.includes(hh)) {
        if (net === "instagram" && v.reach != null) (cell[ck] = cell[ck] || { igReach: [], ytViews: [] }).igReach.push(v.reach);
        if (net === "youtube" && views != null) (cell[ck] = cell[ck] || { igReach: [], ytViews: [] }).ytViews.push(views);
      }

      const dk = (byDateKind[d] = byDateKind[d] || {});
      const krow = (dk[kind] = dk[kind] || { posts: 0, engSum: 0, engBase: 0 });
      /* a slot posts to several networks; the kind trend counts the SLOT once
         (the first network's own pass through it), the same restraint
         numbers() keeps for byWeekday and bySlot */
      if (net === NETS.find(n => rec.stats[n] && !rec.stats[n].error)) { krow.posts++; }
      krow.engSum += eng; krow.engBase += base;

      if (net === "instagram" && v.reach != null) {
        const subj = subjectOf(kind, card);
        if (subj) subjRows.push({ group: subj.group, label: subj.label, reach: v.reach, date: d });
      }
    }
  }

  const trend30 = {};
  for (const net of NETS) trend30[net] = dates.slice().reverse().map(d => {
    const r = (byDateNet[d] || {})[net];
    return { date: d, posts: r ? r.posts : 0, views: r ? r.views : null, reach: r ? r.reach : null,
             engaged: r ? r.engSum : null,
             engagement: r && r.engBase > 0 ? r1(r.engSum / r.engBase) : null };
  });

  /* every reel hour gets a column on every weekday, present or not: a slot
     that fell silent all 30 days is a fact worth showing, not a column that
     quietly never appears. */
  const weekdayHour = [];
  for (let wd = 0; wd < 7; wd++) for (const hh of HEAT_HOURS) {
    const c = cell[wd + ":" + hh];
    weekdayHour.push({ weekday: wd, label: WEEKDAY_LABEL[wd], hour: hh, at: HH(hh),
      instagramReach: c ? median(c.igReach) : null, instagramN: c ? c.igReach.length : 0,
      youtubeViews: c ? median(c.ytViews) : null, youtubeN: c ? c.ytViews.length : 0 });
  }

  const kindDaily = {};
  const kindsSeen = new Set(); for (const d of Object.keys(byDateKind)) for (const k of Object.keys(byDateKind[d])) kindsSeen.add(k);
  for (const k of kindsSeen) kindDaily[k] = dates.slice().reverse().map(d => {
    const r = (byDateKind[d] || {})[k];
    return { date: d, posts: r ? r.posts : 0, engagement: r && r.engBase > 0 ? r1(r.engSum / r.engBase) : null };
  });
  /* windowDays on every row, not only once at the top of compose()'s own
     return: a live run read this 30-day total as if it were the week the
     owner actually asked about (2026-09-24, "106 posts" this week when
     Instagram had 36; kindTotals' own 30-day count sat right beside a
     7-day summary with nothing on either one saying which was which). */
  const kindTotals = [...kindsSeen].map(k => {
    const posts = (kindDaily[k] || []).reduce((a, x) => a + x.posts, 0);
    return { kind: k, label: kindLabel(k), n: posts, windowDays: dates.length };
  }).sort((a, b) => b.n - a.n);

  const subjBuckets = {};
  for (const r of subjRows) (subjBuckets[r.group] = subjBuckets[r.group] || { label: r.label, reach: [] }).reach.push(r.reach);
  const bySubject = Object.keys(subjBuckets).map(g => ({
    group: g, label: subjBuckets[g].label, n: subjBuckets[g].reach.length, windowDays: dates.length,
    reach: { median: median(subjBuckets[g].reach), mean: r1(mean(subjBuckets[g].reach)) }
  })).sort((a, b) => (b.reach.median || 0) - (a.reach.median || 0));

  return { trend30, weekdayHour, kindDaily, kindTotals, bySubject };
}

/* ---------------------------------------------------------------------------
   THE 30-DAY WALK OF THE SLOT RECORDS (nsoc:slot:<date>#<slot>)

   Posting health lives only here: state, retries, duplicates the guard
   caught. A snapshot record (above) only exists for a slot that answered at
   least one live network, so a slot that failed everywhere never reaches
   it; this walk reads readSlot itself so a wholly failed day still counts.
   Chunked ten at a time, the same courtesy api/_insights.js's collect()
   already pays the store. */
async function walkSlots(dates, opts) {
  const read = opts.readSlot || readSlot;
  const wanted = [];
  for (const d of dates) for (const s of SLOT_IDS) wanted.push([d, s]);
  const recs = [];
  for (let i = 0; i < wanted.length; i += 10) {
    const chunk = wanted.slice(i, i + 10);
    const got = await Promise.all(chunk.map(([d, s]) => read(d, s).catch(() => null)));
    got.forEach(r => recs.push(r));
  }
  const byDate = {};
  for (let i = 0; i < wanted.length; i++) {
    const [d] = wanted[i]; const rec = recs[i];
    const row = (byDate[d] = byDate[d] || { date: d, sent: 0, partial: 0, failed: 0, pending: 0, none: 0, retried: 0, duplicates: 0 });
    if (!rec || !rec.state) { row.none++; continue; }
    if (row[rec.state] != null) row[rec.state]++; else row.none++;
    for (const r of Object.values(rec.results || {})) {
      if (r && Number(r.tries) > 1) row.retried++;
      if (r && (r.dupWarn === true || r.already === true)) row.duplicates++;
    }
  }
  return dates.slice().reverse().map(d => byDate[d] || { date: d, sent: 0, partial: 0, failed: 0, pending: 0, none: 0, retried: 0, duplicates: 0 });
}

/* ---------------------------------------------------------------------------
   THE THREE TO FIVE SENTENCES

   Plain sentences the server computes, numbers only from what this file
   already built -- the same discipline api/_steward.js and
   api/_insights.js's own sentences() keep: no sentence from a bucket under
   MIN_BUCKET posts, and nothing said about a network with nothing to say.
--------------------------------------------------------------------------- */
function patternNotes(ins, visitorsThis, visitorsLast, postingDays, kindTotals) {
  const out = [];
  const nets = (ins.byNetwork || []).filter(n => n.thisWeek.reach != null || n.thisWeek.views != null);
  if (nets.length) {
    /* the biggest MOVE is judged by percent change, not by the bare size of
       the delta: fixed 2026-09-24, when a variable literally named "pct"
       was holding an absolute count (an Instagram reach delta of 1,200
       people, say) and sorting it against a YouTube views delta in the
       same units -- reach and views are not the same thing, and neither
       carried its own name into the sentence, so "up 1,200" never said
       1,200 of what. Percent change is comparable across the two, since it
       is unitless; a network with nothing to compare against last week
       (delta "new", or no prior total to divide by) is left out of the
       race rather than sorted in by an absolute figure no other row here
       shares a unit with. */
    const withDelta = nets.map(n => {
      const metric = n.thisWeek.reach != null ? "reach" : "views";
      const delta = n.delta && n.delta[metric];
      if (typeof delta !== "number" || !delta) return null;
      const base = n.lastWeek && n.lastWeek[metric];
      const pctChange = (typeof base === "number" && base > 0) ? (delta / base) * 100 : null;
      return pctChange == null ? null : { n, metric, delta, pctChange };
    }).filter(Boolean);
    if (withDelta.length) {
      const biggest = withDelta.slice().sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange))[0];
      if (biggest) {
        const label = NET_LABEL[biggest.n.net] || biggest.n.net;
        const noun = biggest.metric === "reach" ? "reach" : "views";
        const who = biggest.metric === "reach" ? " people" : "";
        out.push(label + "'s " + noun + " " + (biggest.delta > 0 ? "rose" : "fell") + " by "
          + Math.abs(Math.round(biggest.delta)).toLocaleString("en-US") + who + ", "
          + Math.abs(Math.round(biggest.pctChange)) + " percent on the week before.");
      }
    }
  }
  const bestSlot = (ins.bySlot || []).filter(s => s.thisWeek.engagement != null).sort((a, b) => b.thisWeek.engagement - a.thisWeek.engagement)[0];
  const worstSlot = (ins.bySlot || []).filter(s => s.thisWeek.engagement != null).sort((a, b) => a.thisWeek.engagement - b.thisWeek.engagement)[0];
  /* the owner thinks in the clock, not in slot ids: bySlot's own label is
     already an hour ("08:00"), and slotPhrase names the kind of post that
     hour actually carries, so nothing internal ever reaches this sentence */
  if (bestSlot && worstSlot && bestSlot.slot !== worstSlot.slot)
    out.push("The " + slotPhrase(bestSlot) + " engages best this week, and the " + slotPhrase(worstSlot) + " least.");
  if (ins.best) {
    const lead = (kindTotals || []).find(k => k.kind === ins.best.kind);
    /* a kind the shelf could not name ("reel:reel", labelled just "reels")
       says nothing the owner can act on, so no sentence is drawn from it */
    const named = ins.best.kind && !/^reel:reel$/.test(ins.best.kind);
    if (named && lead && lead.n >= MIN_BUCKET) {
      const lab = String(ins.best.label || "");
      out.push(lab.charAt(0).toUpperCase() + lab.slice(1) + " lead engagement this week, over " + lead.n + " posts in the last 30 days.");
    }
  }
  const zero = (ins.byNetwork || []).filter(n => n.thisWeek.posts === 0 && n.lastWeek.posts === 0);
  if (zero.length) out.push((zero.length === 1 ? "One network, " : zero.length + " networks, ")
    + zero.map(n => NET_LABEL[n.net] || n.net).join(", ") + " sent nothing in the last two weeks.");
  if (visitorsThis != null && visitorsLast != null && visitorsLast > 0) {
    const pct = Math.round(((visitorsThis - visitorsLast) / visitorsLast) * 100);
    if (Math.abs(pct) >= 5) out.push("Site visitors are " + (pct > 0 ? "up " : "down ") + Math.abs(pct) + "% on the week before.");
  }
  const dupDays = (postingDays || []).filter(d => d.duplicates > 0).length;
  if (dupDays) out.push(dupDays + (dupDays === 1 ? " day" : " days") + " in the last 30 caught a duplicate before it went out twice.");
  return out.slice(0, 5);
}

/* ---------------------------------------------------------------------------
   THE COMPOSE
--------------------------------------------------------------------------- */
export async function compose(opts = {}) {
  const now = opts.now || new Date().toISOString();
  const dates = datesBack(30, now);                        /* dates[0] today, ascending age */

  const shelf = shelfNow();
  const manifest = shelf.manifest;

  const [ins, visitors, statsWalk, postingDays, postedNets] = await Promise.all([
    numbers(opts),
    (opts.computeVisitors || computeVisitors)(),
    walkStats(dates, manifest, opts),
    walkSlots(dates, opts),
    (opts.postedChannelCounts || postedChannelCounts)()
  ]);

  /* site visitors, this 7 days against the 7 before, by date so the two
     30-length arrays (dates here, visitors.days there) never have to agree
     on direction */
  const vByDate = {};
  for (const d of (visitors.days || [])) vByDate[d.date] = d;
  const thisWeekDates = dates.slice(0, 7), lastWeekDates = dates.slice(7, 14);
  const visitorsThis = sum(thisWeekDates.map(d => vByDate[d] ? vByDate[d].people : null));
  const visitorsLast = sum(lastWeekDates.map(d => vByDate[d] ? vByDate[d].people : null));
  const visitorsSpark = dates.slice(0, 14).slice().reverse().map(d => (vByDate[d] ? vByDate[d].people : null));

  /* posts sent (any live network) this week against last, from the posting
     health walk, which is the only one of the three passes that still
     counts a slot nothing answered */
  const healthByDate = {}; for (const d of postingDays) healthByDate[d.date] = d;
  const postsThis = sum(thisWeekDates.map(d => { const h = healthByDate[d]; return h ? h.sent + h.partial : null; }));
  const postsLast = sum(lastWeekDates.map(d => { const h = healthByDate[d]; return h ? h.sent + h.partial : null; }));
  const postsSpark = dates.slice(0, 14).slice().reverse().map(d => { const h = healthByDate[d]; return h ? h.sent + h.partial : null; });

  /* overall reach, views and engagement (raw actions, not a rate) this week
     against last, summed across the four networks the trend already folded
     per day */
  const overallSpan = wantedDates => {
    const want = new Set(wantedDates);
    let reach = null, views = null;
    for (const net of NETS) for (const row of statsWalk.trend30[net]) {
      if (!want.has(row.date)) continue;
      reach = sum([reach, row.reach]); views = sum([views, row.views]);
    }
    return { reach, views };
  };
  const reachThis = overallSpan(thisWeekDates);
  const reachLast = overallSpan(lastWeekDates);

  const summary = {
    /* this block's own window, stated plainly rather than left to the top
       level windowDays (30, the trend and kind history below it): every
       figure here is the 7 days named in thisWeek, never the 30 (2026-09-24
       review, the "106 posts" fault) */
    windowDays: 7,
    thisWeek: { from: thisWeekDates[thisWeekDates.length - 1], to: thisWeekDates[0] },
    lastWeek: { from: lastWeekDates[lastWeekDates.length - 1], to: lastWeekDates[0] },
    reach: { value: reachThis.reach, delta: (reachThis.reach != null && reachLast.reach != null) ? reachThis.reach - reachLast.reach : null },
    views: { value: reachThis.views, delta: (reachThis.views != null && reachLast.views != null) ? reachThis.views - reachLast.views : null },
    visitors: { value: visitorsThis, delta: (visitorsThis != null && visitorsLast != null) ? visitorsThis - visitorsLast : null, sparkline: visitorsSpark },
    posts: { value: postsThis, delta: (postsThis != null && postsLast != null) ? postsThis - postsLast : null, sparkline: postsSpark },
    /* one row a network, everything the scoreboard needs already folded in:
       posts, whichever of reach or views that network actually gives (never
       both, so the room never has to choose which to bold), an engagement
       rate as a plain fraction (the room turns it into a percent), and the
       14-day sparkline. A network that sent nothing and has no prior week
       either carries null in every field here, which the room reads as "no
       numbers yet" rather than a row of zeros. */
    networks: NETS.map(net => {
      const row = (ins.byNetwork || []).find(x => x.net === net) || null;
      return {
        net, label: NET_LABEL[net],
        posts: row ? row.thisWeek.posts : null, postsDelta: row ? row.delta.posts : null,
        reach: row ? row.thisWeek.reach : null, reachDelta: row ? row.delta.reach : null,
        views: row ? row.thisWeek.views : null, viewsDelta: row ? row.delta.views : null,
        engagement: row ? row.thisWeek.engagement : null, engagementDelta: row ? row.delta.engagement : null,
        sparkline: statsWalk.trend30[net].slice(-14).map(x => x.reach != null ? x.reach : x.views)
      };
    })
  };

  /* the funnel: post, reach, engaged (raw actions), site visit, per network */
  const arrivalsByNet = {}; for (const a of ((visitors.arrivals && visitors.arrivals.byNetwork) || [])) arrivalsByNet[a.net] = a;
  const funnel = NETS.map(net => {
    const row = (ins.byNetwork || []).find(x => x.net === net) || null;
    const engaged = sum(statsWalk.trend30[net].filter(x => thisWeekDates.includes(x.date)).map(x => x.engaged));
    const arr = arrivalsByNet[net];
    return {
      net, label: NET_LABEL[net],
      posts: row ? row.thisWeek.posts : null,
      reach: row ? row.thisWeek.reach : null,
      engaged,
      visits: arr ? arr.thisWeek : null
    };
  });

  const notes = patternNotes(ins, visitorsThis, visitorsLast, postingDays, statsWalk.kindTotals);

  const library = {
    corpus: (() => {
      const gc = graphCounts();
      const cov = sourceCoverage();
      const types = ["light", "word", "name", "day", "dua", "verse"].map(t => ({
        type: t, total: gc.types[t] != null ? gc.types[t] : null, withReel: cov[t] != null ? cov[t] : 0
      }));
      return { types, films: gc.films };
    })(),
    shelf: { total: shelf.total, byKind: shelf.byKind },
    postedByNetwork: postedNets
  };

  return {
    ok: true, at: now,
    /* the room's OWN default span, for the trend, the weekday grid and the
       30-day kind and subject history below; summary carries its own
       windowDays (7) right beside it, since that block alone is this week
       against the one before, never this 30 (2026-09-24 review) */
    windowDays: 30,
    summary, funnel,
    trend30: { dates: dates.slice().reverse(), networks: statsWalk.trend30 },
    weekdayHour: statsWalk.weekdayHour,
    byKind: ins.byKind, kindDaily: statsWalk.kindDaily, kindTotals: statsWalk.kindTotals,
    bySubject: statsWalk.bySubject,
    visitors,
    postingHealth: { days: postingDays },
    library,
    notes,
    missingToken: ins.missingToken
  };
}

export async function cached(opts = {}) {
  if (!opts.fresh) {
    const hit = await readCache(opts);
    if (hit) return { ...hit, cached: true };
  }
  const out = await compose(opts);
  const ready = opts.kvReady || kvReady;
  if (ready()) {
    try { await (opts.kv || kv)([["SET", K_OBS, JSON.stringify(out), "EX", "3600"]]); } catch { }
  }
  return { ...out, cached: false };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const gate = ownerGate(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.reason });
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "GET only" });
  if (!kvReady()) return json(res, 200, { ok: false, enabled: false, store: kvKind(),
    error: "no store is configured, so there is nothing to read the house from" });
  const fresh = String((req.query || {}).fresh || "") === "1";
  try {
    const out = await cached({ fresh });
    return json(res, 200, { ...out, enabled: true, store: kvKind() });
  } catch (e) {
    return json(res, 200, { ok: false, enabled: true, error: String(e && e.message || e).slice(0, 200) });
  }
}
