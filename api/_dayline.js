// NOOR · the day across the horizon: today's posting slots, as the Home reads them.
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS (3 October 2026, LANTERN.md sections 7 and 10)
//
// The owner's Home draws a line for today with every posting slot at its
// hour: sent is a lit point, partly sent half lit, failed an ember, still to
// come a hollow point, skipped struck through, and a tap says what it is
// ("19:00, a verse reel, sent to 5 of 6 networks"). This is that line's one
// read, `today.slots` in GET /api/soul?view=home:
//
//   [{ slot, time: "HH:MM" (UTC), label, kind, state, networks: {sent, total},
//      lean: kind | null }]  in time order
//
// It reads only the store and the deployment's own files, never a network
// and never a model, so the Home's clock is never spent on it:
//   the day's plan (api/_schedule.js planDay) with a fetch that refuses, so
//     the Hijri date comes from the store's own cache or not at all (a day
//     whose date was never verified carries no dawn and no coming-up card,
//     exactly as the poster would post it);
//   the slot records, in ONE read of every slot key (a store fault is a
//     fault here: the caller says `today.slots: null` with its reason in
//     `missing.slots`, never a day that only looks empty);
//   for a reel slot not yet recorded, the card every other view of the day
//     shows (api/_lineup.js buildDayContext, otherPicksFor and
//     chooseReelWithOverride over the shelf on disk), so the horizon names
//     the same kind of reel the poster will send; a fault there costs only
//     the kind, which then comes from the slot's own half.
//
// THE FIELDS
//   state     sent, partial or failed as the record says; a record still
//             processing at a network (pending) is partial once one network
//             has it and due before that; one waiting for the owner's
//             approval (queued) is due; the owner's or the Lantern's skip,
//             or a slot with nothing to say, is skipped (so is a reel slot a
//             skip override already holds); with no record, due once its
//             hour has come and later before it.
//   networks  the networks the record shows were asked, and how many have
//             it: a draft for a human hand (Reddit), the owner's own phone
//             share, a network not configured and one still on trial are
//             not counted, the same reading the poster's own slotState
//             makes. {0, 0} before the slot runs.
//   kind      the reel's kind (verse, word, know, day, light, name, dua,
//             short) for a reel slot, null when it cannot be read; "card"
//             for the five card slots, whose label says which card.
//   label     a phrase, "a verse reel" or "the day's card", in the house's
//             own words (api/_insights.js KIND_LABEL, said once), through
//             sayLantern like every word the owner reads.
//   lean      the kind a rota lean gave the slot (api/_levers.js): the
//             record's own mark once it went, the lean that decides its card
//             before; null when no lean shaped it (an override won, or none).
// ---------------------------------------------------------------------------

import { SLOTS, REEL_SLOTS, reelHalf, planDay } from "./_schedule.js";
import { buildDayContext, chooseReelWithOverride, otherPicksFor, readOverridesRaw } from "./_lineup.js";
import { store, parse, nowMs, dayOf, sayLantern } from "./_soul.js";

/* the poster's own slot key (api/social.js K_SLOT), read here in one MGET */
export const slotKey = (date, slot) => "nsoc:slot:" + date + "#" + slot;
/* channels that are never a network a post is sent to (api/_channels.js
   draftOnly, plus the owner's phone note); tests/mission.mjs holds the
   draft list equal to the channels file's own */
export const DRAFT_ONLY = Object.freeze(["reddit"]);
export const STATES = Object.freeze(["sent", "partial", "failed", "due", "later", "skipped"]);

/* one reel or card, said once, in the house's own words */
export const SAY = Object.freeze({
  "reel:verse": "a verse reel", "reel:word": "a word reel", "reel:know": "a Did you know reel",
  "reel:day": "a This day reel", "reel:light": "a day's-card reel", "reel:name": "a Name reel", "reel:dua": "a du'a reel",
  "reel:short": "a silent film", "reel:reel": "a reel",
  "card:dawn": "the dawn card", "card:light": "the day's card", "card:word": "the word card", "card:dusk": "the chapter card", "card:lead": "the coming-up card"
});
const NO_NET = () => Promise.reject(new Error("the Home reads the store and caches only"));
const hh = h => String(h).padStart(2, "0") + ":00";

/* the networks a record's results show were asked, and how many have it */
export function networksOf(results) {
  const asked = Object.entries(results && typeof results === "object" ? results : {})
    .filter(([c, r]) => r && typeof r === "object" && !DRAFT_ONLY.includes(c) && c !== "phone" && !r.hand && !r.skipped && !r.trial && !r.waiting);
  return { sent: asked.filter(([, r]) => r.ok).length, total: asked.length };
}

/* a record's state as the horizon draws it */
export function stateOf(rec, hourNow, at, networks) {
  const st = rec && rec.state ? String(rec.state) : "";
  if (st === "sent" || st === "partial" || st === "failed" || st === "skipped") return st;
  if (st === "pending") return networks && networks.sent > 0 ? "partial" : "due";
  if (st === "queued") return "due";
  return hourNow >= at ? "due" : "later";
}

export function labelOf(slot, kind) {
  const half = reelHalf(slot);
  if (!half) return sayLantern(SAY["card:" + slot] || "the " + slot + " post");
  return sayLantern((kind && SAY["reel:" + kind]) || "the " + half + " reel");
}

/* today's slots, in time order. opts: {date, now (ms), D: {manifest(),
   recentlyPosted(date), host}, records (a map, for a caller that already
   read them)}. Throws only when the slot records cannot be read. */
export async function daySlots(opts = {}) {
  const now = typeof opts.now === "number" ? opts.now : nowMs();
  const date = opts.date || dayOf(now);
  const today = dayOf(now);
  const hourNow = date < today ? 24 : date > today ? -1 : new Date(now).getUTCHours();
  const D = opts.D || {};

  /* the slot records: one read of every key, and a fault is a fault */
  let recs = opts.records;
  if (!recs) {
    let r;
    try { r = await store([["MGET", ...SLOTS.map(s => slotKey(date, s.id))]]); }
    catch (e) { throw new Error("the day's slot records could not be read (" + String(e && e.message || e).slice(0, 80) + ")"); }
    const vals = (r && r[0]) || [];
    recs = {};
    SLOTS.forEach((s, i) => { const v = parse(vals[i], null); recs[s.id] = v && typeof v === "object" ? v : null; });
  }

  /* the plan, from the store's own cache of the Hijri date, never the network */
  let plan = null;
  try { plan = await planDay(date, { fetch: NO_NET }); } catch { plan = null; }
  /* a plan that cannot be read at all keeps to the slots every day has */
  const planned = new Set(plan && Array.isArray(plan.slots) ? plan.slots : SLOTS.filter(s => !s.needsDate && !s.conditional).map(s => s.id));
  const done = s => !!(recs[s] && recs[s].state);

  /* the reel slots with nothing recorded yet: the card every other view shows */
  const picks = {};
  const open = REEL_SLOTS.filter(s => !done(s));
  if (open.length) {
    try {
      let cards = [];
      try { cards = typeof D.manifest === "function" ? (await D.manifest()) || [] : []; } catch { cards = []; }
      let seen = new Map();
      try { if (typeof D.recentlyPosted === "function") seen = (await D.recentlyPosted(date)) || new Map(); } catch { seen = new Map(); }
      const ctx = await buildDayContext(D.host || "noorcodex.com", date, { cards: Array.isArray(cards) ? cards : [], hijri: (plan && plan.hijri) || null, seen });
      const records = {};
      for (const s of REEL_SLOTS) records[s] = recs[s] || null;
      /* the other slots' picks matter only to a swap (whether it still
         holds), so a day with no swap set never pays for them */
      let swaps = true;
      try { swaps = Object.values((await readOverridesRaw(date, {})) || {}).some(o => o && o.action === "swap"); } catch { swaps = true; }
      for (const s of open) {
        try {
          const otherPicks = swaps ? await otherPicksFor(ctx.cards, date, s, ctx.hijri, ctx.seen, ctx.bias, { records, leans: ctx.leans }) : {};
          picks[s] = await chooseReelWithOverride(ctx.cards, date, s, ctx.hijri, ctx.seen, ctx.bias, null, { otherPicks, rec: records[s] || undefined, leans: ctx.leans });
        } catch { picks[s] = null; }
      }
    } catch { /* the kinds alone are lost: each open reel slot is said by its half */ }
  }

  const out = [];
  for (const s of SLOTS) {
    const rec = recs[s.id];
    if (!planned.has(s.id) && !done(s.id)) continue;
    const isReel = !!s.reel;
    const networks = done(s.id) ? networksOf(rec.results) : { sent: 0, total: 0 };
    let state = stateOf(rec, hourNow, s.at, networks);
    let kind = isReel ? null : "card", lean = null;
    if (isReel) {
      if (done(s.id)) {
        kind = rec.kind ? String(rec.kind) : null;
        lean = rec.lean && typeof rec.lean === "object" && rec.lean.kind ? String(rec.lean.kind) : null;
      } else {
        const p = picks[s.id];
        if (p && p.card) kind = p.card.kind || "light";
        if (p && p.lean && p.lean.kind) lean = String(p.lean.kind);
        /* a skip override already holds the slot: nothing will go */
        if (p && !p.card && p.override && p.override.action === "skip") state = "skipped";
      }
    }
    out.push({ slot: s.id, time: hh(s.at), label: labelOf(s.id, kind), kind, state, networks, lean });
  }
  return out;
}
