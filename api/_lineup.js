/* NOOR · one slot, one day, changed by hand
   ===========================================================================
   The rota picks a reel for every slot, every day, and the owner is right
   most of the time to leave it alone. Twice this came up in the same week:
   a reel the owner had just watched land badly on the phone, and a Lantern
   proposal that named the exact fix and could only ever be RECORDED, never
   applied -- api/_agent.js's own header used to explain, correctly at the
   time, that no safe door existed onto the poster for this. This file is
   that door, built the way every other write path into the poster already
   is: validated before it is trusted, fail-open on the way OUT (a fault or
   a stale id never blocks a post or costs one twice), and touching one day,
   one slot, never the machine's own memory of what it has already sent.

   THE SHAPE. nsoc:override:<date> is a plain object keyed by slot id,
   {<reelA..reelF>: {action:"skip"}|{action:"swap", id}, at, by, note}. Only
   a reel slot can carry one -- dawn, light, word and dusk are not rendered
   ahead of time, so there is nothing to swap them for -- and only for today
   or up to a week ahead: further out and the shelf, the rota's own walk and
   the duplicate guard's window will all have moved by the time it matters,
   and an override that quietly stopped meaning what it said would be worse
   than no override at all.

   WHY THIS FILE NEVER IMPORTS api/social.js. The posting path (composeSlot,
   runDue) has to read an override on every run, so this file is imported
   FROM social.js; importing social.js back would be the cycle every other
   pure file in this house (api/_experiments.js, api/_agent.js) is built to
   avoid. The two places this file would otherwise have asked social.js for
   -- a slot's own record, and the duplicate guard's recent window -- are
   read here directly, against the exact key formats those live at
   (nsoc:slot:<date>#<slot>, nsoc:reels:postedch): duplicated, not shared,
   and proven to agree with the real thing by tests/lineup.mjs, which writes
   through api/social.js's own functions and reads back through this file's.

   FAIL OPEN ON THE WAY OUT, THE SAME PROMISE api/_experiments.js's biasFor
   makes. Setting an override is validated hard, because a bad write here
   could point the poster at nothing or at somebody else's day. Reading one
   back, on the posting path, is never allowed to cost a post: a KV fault, a
   malformed value, or a swap naming a card that has since left the shelf
   all answer exactly as "no override" would, and the day runs as it always
   has. A skip is recorded as a skipped slot, the same shape the poster
   already writes when a slot has nothing to say, so the retry path and
   reconcile() never chase a slot the owner deliberately quieted.
--------------------------------------------------------------------------- */
import { kv, kvReady } from "./_kv.js";
import { REEL_SLOTS, reelHalf, chooseReel, planDay } from "./_schedule.js";
import { isRealDate, biasFor } from "./_experiments.js";
import { readManifest } from "./_reels.js";

export const K_OVERRIDE = d => "nsoc:override:" + d;
export const MAX_DAYS_AHEAD = 7;

/* the same key format api/social.js's own K_SLOT writes and reads. Kept
   here as a plain, one-line duplicate rather than an import, for the cycle
   reason in the header above; tests/lineup.mjs proves the two agree. */
const K_SLOT = (d, s) => "nsoc:slot:" + d + "#" + s;
/* the same claim api/social.js's own claimSlot sets while a send is
   actually in flight (a ten minute SET NX), read only, here, for the same
   reason as K_SLOT: a slot the machine is in the middle of sending has
   nothing recorded YET, so the K_SLOT check alone would let a set through
   while the send that started before it is still writing its own record a
   moment later, with whatever it composed before the override existed. */
const K_CLAIM = (d, s) => "nsoc:claim:" + d + "#" + s;
/* the same hash api/social.js's own findDuplicate and recentlyPosted read:
   `<reel id>|<channel>` -> `date#slot`, written the moment one network says
   ok to a reel. Read only, here, for the same reason as K_SLOT above. */
const K_POSTED_CH = "nsoc:reels:postedch";
const DUP_WINDOW_DAYS = Number(process.env.DUP_WINDOW_DAYS) > 0 ? Number(process.env.DUP_WINDOW_DAYS) : 60;

/* ---------------------------------------------------------------------------
   the store: sanitized on the way in, so a hand-edited or corrupted key
   degrades to "no override today" rather than throwing at a poster mid run
--------------------------------------------------------------------------- */
function sanitizeEntry(v) {
  if (!v || typeof v !== "object") return null;
  const at = typeof v.at === "string" ? v.at : "";
  const by = v.by === "lantern-approved" ? "lantern-approved" : "owner";
  const note = typeof v.note === "string" ? v.note.slice(0, 300) : "";
  if (v.action === "skip") return { action: "skip", at, by, note };
  if (v.action === "swap" && typeof v.id === "string" && v.id.trim())
    return { action: "swap", id: v.id.trim(), at, by, note };
  return null;
}
function sanitizeDay(v) {
  const out = {};
  if (!v || typeof v !== "object") return out;
  for (const slot of REEL_SLOTS) {
    const e = sanitizeEntry(v[slot]);
    if (e) out[slot] = e;
  }
  return out;
}

async function readOverridesRaw(date, ctx = {}) {
  const store = ctx.kv || kv, ready = ctx.kvReady || kvReady;
  if (!ready()) return {};
  const r = await store([["GET", K_OVERRIDE(date)]]);
  const raw = r && r[0];
  if (!raw) return {};
  let v;
  try { v = typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch { return {}; }
  return sanitizeDay(v);
}
/* the safe read every caller but set/clear should use: a store fault or a
   corrupted value both answer "nothing overridden today", never a throw */
export async function readOverrides(date, ctx = {}) {
  try { return await readOverridesRaw(date, ctx); } catch { return {}; }
}
export async function getOverride(date, slot, ctx = {}) {
  if (!REEL_SLOTS.includes(slot)) return null;
  const day = await readOverrides(date, ctx);
  return day[slot] || null;
}
/* the one read that is allowed to throw: a caller about to record what
   stood on a slot BEFORE it changes something (the approve path's own
   `before`, an undo's own comparison) needs to know it actually read the
   truth, not "nothing" because the store happened to hiccup -- reading
   that wrong once means an undo restores the wrong day, or clears a slot
   that was never really empty. Every ordinary reader still wants
   getOverride's fail-open promise; this is only for the few that must
   refuse rather than guess. */
export async function getOverrideRaw(date, slot, ctx = {}) {
  if (!REEL_SLOTS.includes(slot)) return null;
  const day = await readOverridesRaw(date, ctx);
  return day[slot] || null;
}
async function writeOverrides(date, day, ctx = {}) {
  const store = ctx.kv || kv, ready = ctx.kvReady || kvReady;
  if (!ready()) return false;
  try {
    if (Object.keys(day).length) await store([["SET", K_OVERRIDE(date), JSON.stringify(day)]]);
    else await store([["DEL", K_OVERRIDE(date)]]);
    return true;
  } catch { return false; }
}

/* THE ONE CALL THE POSTING PATH MAKES, once a slot, in the same fail-open
   shape as api/_experiments.js's own biasFor: any fault at all answers null,
   which is exactly what "no override" already means to every caller. */
export async function overrideFor(date, slot, ctx = {}) {
  try {
    if (!REEL_SLOTS.includes(slot)) return null;
    const day = await readOverrides(date, ctx);
    return day[slot] || null;
  } catch { return null; }
}

/* ---------------------------------------------------------------------------
   validation

   Every rule the Director's brief named, in the order a caller would hit
   them: a reel slot, a real date inside the week ahead, an action, a slot
   with nothing already recorded, and -- for a swap -- a card the shelf
   actually has, that fits this slot's own half, that the duplicate guard's
   own window has not just refused, and that no other slot of the same day
   has already been given.
--------------------------------------------------------------------------- */
function cardsOf(manifest) {
  if (Array.isArray(manifest)) return manifest;
  if (manifest && Array.isArray(manifest.cards)) return manifest.cards;
  return [];
}

export async function validateOverride({ date, slot, action, id }, ctx = {}) {
  const now = ctx.now ? new Date(ctx.now) : new Date();
  const today = now.toISOString().slice(0, 10);
  if (!REEL_SLOTS.includes(slot))
    return { ok: false, error: "only a reel slot (reelA through reelF) can be overridden" };
  if (!isRealDate(date)) return { ok: false, error: "date must be a real date, YYYY-MM-DD" };
  if (date < today) return { ok: false, error: "that date has already passed" };
  const maxDate = new Date(Date.parse(today + "T00:00:00Z") + MAX_DAYS_AHEAD * 86400000)
    .toISOString().slice(0, 10);
  if (date > maxDate)
    return { ok: false, error: "an override can be set at most " + MAX_DAYS_AHEAD + " days ahead" };
  if (action !== "skip" && action !== "swap")
    return { ok: false, error: "action must be skip or swap" };

  const store = ctx.kv || kv, ready = ctx.kvReady || kvReady;
  if (!ready()) return { ok: false, error: "no store is configured, so nothing can be remembered" };
  let recorded, claimed;
  try {
    const r = await store([["GET", K_SLOT(date, slot)], ["GET", K_CLAIM(date, slot)]]);
    recorded = !!r[0]; claimed = !!r[1];
  } catch { return { ok: false, error: "the store could not be read, so nothing was set" }; }
  /* the claim comes first: a slot with nothing recorded YET can still be
     the one a run is this second in the middle of sending (api/social.js's
     own claimSlot, a ten minute hold); a K_SLOT check alone would let an
     override through a moment before that run's own record lands with
     whatever it had already composed. */
  if (claimed)
    return { ok: false, error: "that slot is being sent right now; try again in a moment" };
  if (recorded)
    return { ok: false, error: "that slot already has something recorded for that day, so an override cannot change what has already gone out or is in flight" };

  if (action === "skip") return { ok: true };

  const cardId = String(id || "").trim();
  if (!cardId) return { ok: false, error: "a swap needs a card id" };
  const cards = cardsOf(ctx.manifest);
  const card = cards.find(c => c && c.id === cardId);
  if (!card) return { ok: false, error: "no such card on the shelf: " + cardId };
  /* the half only ever binds a LIGHT card: chooseReel (api/_schedule.js)
     filters by `.slot === half` for kind light alone -- `(!c.slot ||
     c.slot === half || kind !== "light")` -- so a verse, a word, a name or
     any other kind already goes to any slot regardless of what `.slot` it
     happens to carry (the real shelf only ever uses morning and evening,
     never the other four halves this file's six slots would ask for).
     Checking the half for every kind refused a swap on four of six slots
     for cards that would have played there perfectly well (2026-09-26
     review fix). */
  const half = reelHalf(slot);
  const kind = card.kind || "light";
  if (kind === "light" && card.slot && card.slot !== half)
    return { ok: false, error: "that card belongs to the " + card.slot + " half, not " + half };

  const seen = ctx.seen;
  if (seen && typeof seen.has === "function" && seen.has(cardId))
    return { ok: false, error: "that card was posted inside the last " + DUP_WINDOW_DAYS + " days; the duplicate guard would refuse it again" };
  if (!seen) {
    /* no window was handed in (a caller that skipped the read): read the
       same hash the guard itself reads, once, rather than trust a caller
       that forgot to pass one -- the endpoint always passes one; this is
       the floor for a caller that does not */
    const inWindow = await recentlyUsed(date, ctx);
    if (inWindow.has(cardId))
      return { ok: false, error: "that card was posted inside the last " + DUP_WINDOW_DAYS + " days; the duplicate guard would refuse it again" };
  }

  if (ctx.otherPicks) {
    for (const [otherSlot, otherId] of Object.entries(ctx.otherPicks)) {
      if (otherSlot !== slot && otherId === cardId)
        return { ok: false, error: "that card is already chosen for " + otherSlot + " today" };
    }
  }
  /* the same card, two different days, both inside the window the
     duplicate guard actually enforces: an override can only ever be set
     today through MAX_DAYS_AHEAD, a span always inside DUP_WINDOW_DAYS
     (7 against a default 60), so any OTHER day already carrying a swap to
     this id is a standing conflict the moment both go forward -- one of
     the two would silently fall back the day it posted. Refused here
     rather than left to be discovered then. */
  const clash = await conflictingOverrideDate(cardId, date, ctx);
  if (clash)
    return { ok: false, error: "that card is already set to go out on " + clash + ", inside the duplicate guard's own window" };
  return { ok: true };
}

/* every OTHER day an override could possibly exist on (today through
   MAX_DAYS_AHEAD, the only span setOverride ever accepts a date from) that
   already names this same card for a swap. A day that cannot be read is
   skipped rather than refusing the whole set over it: this is a second,
   belt-and-braces check on top of the duplicate guard's own real window
   (recentlyUsed, read against what has actually posted), not the one place
   a fault must fail closed -- that promise belongs to the day actually
   being written, in setOverride itself. */
async function conflictingOverrideDate(cardId, date, ctx) {
  const now = ctx.now ? new Date(ctx.now) : new Date();
  const today = now.toISOString().slice(0, 10);
  const base = Date.parse(today + "T00:00:00Z");
  if (!isFinite(base)) return null;
  for (let i = 0; i <= MAX_DAYS_AHEAD; i++) {
    const d = new Date(base + i * 86400000).toISOString().slice(0, 10);
    if (d === date) continue;
    let day;
    try { day = await readOverrides(d, ctx); } catch { continue; }
    for (const s of REEL_SLOTS) {
      const e = day[s];
      if (e && e.action === "swap" && e.id === cardId) return d;
    }
  }
  return null;
}

/* the guard's own window, read directly (see the header): a reel id posted
   to any channel inside DUP_WINDOW_DAYS of `date`. Store down, or anything
   malformed: an empty set, so a caller with no better information behaves
   as if nothing had ever been posted, which validateOverride's own
   downstream checks (the manifest, the slot record) still guard. */
export async function recentlyUsed(date, ctx = {}) {
  const store = ctx.kv || kv, ready = ctx.kvReady || kvReady;
  const out = new Set();
  if (!ready()) return out;
  const cutoff = Date.parse(String(date) + "T00:00:00Z") - DUP_WINDOW_DAYS * 86400000;
  if (!isFinite(cutoff)) return out;
  let raw = [];
  try { raw = (await store([["HGETALL", K_POSTED_CH]]))[0] || []; } catch { return out; }
  const pairs = Array.isArray(raw) ? raw : Object.entries(raw).flat();
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const field = String(pairs[i]), at = String(pairs[i + 1]);
    const bar = field.lastIndexOf("|");
    if (bar < 0) continue;
    const hash = at.indexOf("#");
    const when = Date.parse((hash < 0 ? at : at.slice(0, hash)) + "T00:00:00Z");
    if (!isFinite(when) || when < cutoff) continue;
    out.add(field.slice(0, bar));
  }
  return out;
}

/* ---------------------------------------------------------------------------
   set, clear -- the only two writes
--------------------------------------------------------------------------- */
export async function setOverride({ date, slot, action, id }, ctx = {}) {
  const v = await validateOverride({ date, slot, action, id }, ctx);
  if (!v.ok) return v;
  /* the raw read, not the safe one: a fault here must refuse the write,
     never proceed on an empty day that is empty only because the read
     failed -- readOverrides' own {} on a fault would otherwise be spread
     into the write below and silently erase every OTHER slot's override
     that same day actually held (2026-09-26 review fix). */
  let day;
  try { day = await readOverridesRaw(date, ctx); }
  catch { return { ok: false, error: "the store could not be read, so nothing was set" }; }
  const prior = day[slot] || null;
  const at = ctx.now ? new Date(ctx.now).toISOString() : new Date().toISOString();
  const by = ctx.by === "lantern-approved" ? "lantern-approved" : "owner";
  const note = String(ctx.note || "").slice(0, 300);
  const entry = action === "skip"
    ? { action: "skip", at, by, note }
    : { action: "swap", id: String(id).trim(), at, by, note };
  const wrote = await writeOverrides(date, { ...day, [slot]: entry }, ctx);
  if (!wrote) return { ok: false, error: "the store could not be written to" };
  return { ok: true, override: entry, prior };
}

export async function clearOverride({ date, slot }, ctx = {}) {
  if (!REEL_SLOTS.includes(slot)) return { ok: false, error: "only a reel slot can be overridden" };
  let day;
  try { day = await readOverridesRaw(date, ctx); }
  catch { return { ok: false, error: "the store could not be read, so nothing was cleared" }; }
  if (!day[slot]) return { ok: false, error: "there is no override on that slot to clear" };
  const prior = day[slot];
  const next = { ...day };
  delete next[slot];
  const wrote = await writeOverrides(date, next, ctx);
  if (!wrote) return { ok: false, error: "the store could not be written to" };
  return { ok: true, prior };
}

/* UNDO'S OWN DOOR, not setOverride's. An undo is a return trip: it puts
   back the exact entry that stood before an approval, the same at, by and
   note it always carried, never a fresh stamp -- setOverride always mints
   a new `at`, which is right for a real decision and wrong for reversing
   one. Still refuses a slot that already carries any record at all (the
   same K_SLOT/K_CLAIM door setOverride is behind): a slot the day has
   since decided cannot be changed either direction. */
export async function restoreOverride({ date, slot, entry }, ctx = {}) {
  if (!REEL_SLOTS.includes(slot)) return { ok: false, error: "only a reel slot can be overridden" };
  const sane = sanitizeEntry(entry);
  if (!sane) return { ok: false, error: "nothing valid to restore" };
  const store = ctx.kv || kv, ready = ctx.kvReady || kvReady;
  if (!ready()) return { ok: false, error: "no store is configured, so nothing can be remembered" };
  let recorded, claimed;
  try {
    const r = await store([["GET", K_SLOT(date, slot)], ["GET", K_CLAIM(date, slot)]]);
    recorded = !!r[0]; claimed = !!r[1];
  } catch { return { ok: false, error: "the store could not be read, so nothing was restored" }; }
  if (claimed) return { ok: false, error: "that slot is being sent right now; try again in a moment" };
  if (recorded)
    return { ok: false, error: "that slot already has something recorded for that day, so an override cannot change what has already gone out or is in flight" };
  let day;
  try { day = await readOverridesRaw(date, ctx); }
  catch { return { ok: false, error: "the store could not be read, so nothing was restored" }; }
  const wrote = await writeOverrides(date, { ...day, [slot]: sane }, ctx);
  if (!wrote) return { ok: false, error: "the store could not be written to" };
  return { ok: true, override: sane };
}

/* ---------------------------------------------------------------------------
   the one reader every view of the day shares: the plan/today preview, the
   Lantern's lineup tool and the console's own override picker. Wraps
   api/_schedule.js's own chooseReel with the day's override, so a skip
   shows nothing and a swap shows the named card -- unless it no longer
   exists, in which case this fails open exactly like the posting path and
   hands back the ordinary pick, never a hole in the day.
--------------------------------------------------------------------------- */
export async function chooseReelWithOverride(cards, date, slot, hijri, seen, bias, report, ctx = {}) {
  /* a slot the day has already decided (any record naming its own reel --
     sent, pending, partial, or a skip written by the poster itself) is a
     FACT, not a pick to preview: the card that record names is the one
     that actually went, or is actively in flight, and every view of the
     day must show exactly that, never a fresh pick recomputed against a
     `seen` window that card has since joined itself. Before the
     2026-09-26 review's second finding, a sent slot's own card sat in
     `seen` by the time anyone previewed it, so this function politely
     stepped past its own answer and every view (Today, the day's reels
     room, /api/lineup GET) showed some OTHER card for a slot that had
     already gone. `ctx.rec` is the slot's own record, read by the caller
     (this file never imports api/social.js, see the header) -- a caller
     with none in hand (nothing recorded yet) leaves it undefined and
     falls through to the ordinary pick below. */
  if (ctx.rec && ctx.rec.reel) {
    const card = (cards || []).find(c => c && c.id === ctx.rec.reel) || null;
    return { card: card || { id: ctx.rec.reel, kind: ctx.rec.kind || "light", hook: "" },
      override: ctx.rec.override || null };
  }
  let ov = null;
  try { ov = await overrideFor(date, slot, ctx); } catch { ov = null; }
  if (ov && ov.action === "skip") return { card: null, override: ov };
  if (ov && ov.action === "swap") {
    const card = (cards || []).find(c => c && c.id === ov.id);
    if (card) {
      /* a swap held valid the moment it was set can still go stale before
         its own day arrives: the card can enter the duplicate guard's own
         window (posted somewhere else meanwhile) or another slot's own
         pick, today, can land on it too. Trusting the pin regardless was
         the 2026-09-26 review's HIGH finding: the guard would then refuse
         the actual send on every channel at once, and the slot recorded
         "sent" over having posted nothing at all. Checked here, the one
         function every view of the day already shares, so the preview,
         the Lantern's own tool and the poster itself always agree on
         whether a swap still holds or has fallen back. */
      const inSeen = seen && typeof seen.has === "function" && seen.has(card.id);
      const inOther = !inSeen && ctx.otherPicks && Object.entries(ctx.otherPicks)
        .some(([s, otherId]) => s !== slot && otherId === card.id);
      if (!inSeen && !inOther) return { card, override: ov };
      const fellBack = { ...ov, fellBack: true,
        reason: inSeen ? "the duplicate guard's own window" : "already chosen for another slot today" };
      return { card: chooseReel(cards, date, reelHalf(slot) || slot, hijri, seen, bias, report), override: fellBack };
    }
    /* the id has left the shelf entirely: the existing fail-open path
       below, no override mark at all, since nothing was actually held */
  }
  /* `slot` here is the SLOT id (reelA..reelF), the same id an override is
     keyed by; chooseReel itself wants the HALF (morning, noon, ...), which
     reelHalf maps a slot id to. A caller that already has only the half in
     hand (an older SLOTS row) has no slot id to look an override up by in
     the first place, so this function always takes the id. */
  return { card: chooseReel(cards, date, reelHalf(slot) || slot, hijri, seen, bias, report), override: null };
}

/* what every OTHER reel slot of the same date would show, overrides and
   all: the one thing setOverride's own conflict check needs, and worth
   giving a name so the console and the Lantern's approval path compute it
   the same way rather than each rebuilding the loop.

   `ctx.records`, when the caller has it, is a plain {slot: record|null} map
   (api/social.js's own readSlot, read once by the caller for every reel
   slot of the day): a slot already recorded is handed straight to
   chooseReelWithOverride as `ctx.rec`, which answers with that exact card
   rather than a fresh pick (see chooseReelWithOverride's own header). Before
   the 2026-09-26 review's first finding, EVERY other slot was recomputed
   fresh against today's own `seen`, which grows as the day's earlier slots
   actually post -- so an already-sent slot's own recomputed pick could drift
   onto whatever a LATER slot's swap had named, and that swap refused itself
   as "already chosen for another slot today" over an arithmetic coincidence,
   not a real clash. A slot with no record yet has decided nothing, so its
   pick is still whatever chooseReelWithOverride would show right now -- the
   one case this still recomputes. A caller with no `ctx.records` at all
   (there is none left; every writing door now builds one) falls back to the
   same recompute for every slot, exactly the old behaviour. */
export async function otherPicksFor(cards, date, excludeSlot, hijri, seen, bias, ctx = {}) {
  const out = {};
  for (const s of REEL_SLOTS) {
    if (s === excludeSlot) continue;
    const rec = ctx.records ? ctx.records[s] : undefined;
    const { card } = await chooseReelWithOverride(cards, date, s, hijri, seen, bias, null, { ...ctx, rec });
    if (card) out[s] = card.id;
  }
  return out;
}

/* ---------------------------------------------------------------------------
   THE ONE DAY-CONTEXT EVERY VIEW BUILDS THE SAME WAY (2026-09-26 review).

   Before this, api/lineup.js's GET, api/social.js's own plan/today preview,
   the Lantern's `lineup` tool and its approve conflict check each gathered
   the shelf, the day's hijri date, an experiment's own lean and the
   duplicate guard's recent window by hand, slightly differently every
   time -- which is exactly how a preview and a live post could disagree
   about what "today" even looked like. This is the one function all four
   now call.

   Every piece here already fails open on its own (readManifest, planDay,
   biasFor); nothing here adds a new way for a fault to become a throw. A
   caller that already HAS a piece (a shelf just read, a plan already
   computed, an already-known bias) hands it straight through `ctx` and it
   is used as is, never re-fetched; a caller with nothing yet hands the
   fetcher itself (`ctx.readManifest`, `ctx.planDay`, `ctx.biasFor`,
   `ctx.recentlyPosted`) and this calls it once. `ctx.recentlyPosted` is the
   one piece this file has no default for on its own: it lives in
   api/social.js, which this file never imports (see the header). A caller
   that hands none gets an empty window, exactly the "nothing posted" a
   store with nothing in it would also answer -- the right default for a
   READ (a preview, the Lantern's tool). A caller validating a WRITE
   (setOverride's own duplicate check) must never treat a failed read as an
   empty window; that promise lives in setOverride and validateOverride
   themselves, which read the guard's own window directly and are never
   built from this function. */
export async function buildDayContext(host, date, ctx = {}) {
  const cards = ctx.cards || cardsOf(await (ctx.readManifest || readManifest)(host, ctx).catch(() => null));
  const hijri = ctx.hijri !== undefined ? ctx.hijri
    : ((await (ctx.planDay || planDay)(date, ctx).catch(() => ({ hijri: null }))).hijri || null);
  const bias = ctx.bias !== undefined ? ctx.bias
    : await (ctx.biasFor || biasFor)(date, ctx).catch(() => null);
  let seen = ctx.seen;
  if (!seen) {
    seen = new Map();
    if (typeof ctx.recentlyPosted === "function") {
      try { seen = await ctx.recentlyPosted(date); } catch { seen = new Map(); }
    }
  }
  return { cards, hijri, bias, seen };
}
