/* NOOR · the Lantern's levers on the posting machine
   ===========================================================================
   Hands that change what the house posts, kept apart from api/_hands.js so
   the posting path's own rules live beside the code that reads them. Each
   entry has the same shape as a hand in api/_hands.js's registry: {tier,
   caps, ownCapOnly, args, describe, run(args, ctx), undo(entry)}. The
   registry merges LEVERS into HANDS; the red lines, the council, the caps
   and the audit apply to every lever exactly as to every other hand.

   TWO LEVERS (LANTERN.md section 6).

   rota-lean (R2, cap rota, 1 a day). For one reel slot, for one to seven
     days starting today or tomorrow (UTC), the slot's kind becomes a named
     kind. Stored as a small list, nsoc:rota:leans, each entry {id, slot,
     kind, from, to, by, at, note}, `from` and `to` both days the lean
     covers. READ by leanFor(date) below on every view of a day and on the
     posting path itself, FAIL OPEN: a store fault, a malformed list, an
     entry that breaks the rules all answer "no lean", and the day runs on
     the rota exactly as it always has. What a lean does to the pick lives
     in api/_schedule.js's chooseReel (the kind decision, and nothing else).
     WRITTEN only here, validated hard and FAIL CLOSED: a read that failed
     is never taken for an empty list, and the write is a compare and set,
     so two writers can never quietly drop each other's lean.

   fix-posting (R2, cap fix, 6 a day, its own cap only). Repairs what the
     schedule already sent today, through exactly the functions the
     Steward's own buttons call in api/social.js: retryChannel (retry-
     channel) and finishPendingReels (finish-reels). It NEVER sends a slot
     (6 October 2026 review): a slot owed and not yet sent is the hourly
     run's, which sends one a run, the newest first, on its own full
     clock, and the owner's Post now; a lever that sent too raced them
     both, emptied a backlog the catch-up rule paces, and ran a reel's
     networks and stories on a clock too short for them. Never a network
     that already has the post (checked here first; the retry's own claim
     and the duplicate guard still decide underneath), never with force.
     A post is never deleted, so there is no undo: the entry says so.

   WHY THIS FILE IMPORTS SO LITTLE. The posting path (api/social.js) and
   every view of the day (api/_lineup.js) import leanFor from here, so the
   top of this file reaches only the store and two pure modules. The rest
   of the house (the poster, the shelf, the soul's clock and seams) is
   imported lazily, inside the levers themselves, and never from the
   posting path's own import graph.
--------------------------------------------------------------------------- */
import { kv, kvReady } from "./_kv.js";
import { SLOTS, SLOT_IDS, REEL_SLOTS, reelHalf, LEAN_KINDS, rotaKindFor, chooseReel } from "./_schedule.js";
import { isRealDate, readState as expReadState, biasFromAny, EXPERIMENTS } from "./_experiments.js";

/* ---------------------------------------------------------------------------
   THE LEAN STORE
--------------------------------------------------------------------------- */
export const K_LEANS = "nsoc:rota:leans";
export const K_LEANS_VER = "nsoc:rota:leans:ver";
export const LEAN_MAX_DAYS = 7;          /* a lean covers 1 to 7 days */
export const LEAN_MAX_ACTIVE = 2;        /* at most two leans cover any one date */
export const LEAN_MAX_SAME_KIND = 4;     /* never more than 4 of the 6 reel slots one kind on a day */
export const LEAN_MIN_FRESH = 30;        /* cards of the kind outside the duplicate window */
/* an ended lean is kept this long, so the insights reconstruction of the
   days it covered (api/_insights.js collect, up to sixty days back) still
   reads the day the way the poster did; then it is pruned on the next write */
export const LEAN_KEEP_DAYS = 62;

const DAY_MS = 86400000;
const dayNum = d => Math.floor(Date.parse(String(d) + "T00:00:00Z") / DAY_MS);
const plusDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n || 200);
const hourOf = slot => { const s = SLOTS.find(x => x.id === slot); return s ? String(s.at).padStart(2, "0") + ":00" : "?"; };

/* one entry, or null: every field checked, nothing guessed at */
function sanitizeLean(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const id = typeof v.id === "string" ? v.id.trim().slice(0, 80) : "";
  if (!id || !REEL_SLOTS.includes(v.slot) || !LEAN_KINDS.includes(v.kind)) return null;
  if (!isRealDate(v.from) || !isRealDate(v.to) || v.to < v.from) return null;
  if (dayNum(v.to) - dayNum(v.from) + 1 > LEAN_MAX_DAYS) return null;
  return { id, slot: v.slot, kind: v.kind, from: v.from, to: v.to,
    by: typeof v.by === "string" ? v.by.slice(0, 40) : "",
    at: typeof v.at === "string" ? v.at.slice(0, 40) : "",
    note: typeof v.note === "string" ? v.note.slice(0, 300) : "" };
}
export function sanitizeLeans(v) {
  const arr = Array.isArray(v) ? v : [];
  const out = [], ids = new Set();
  for (const x of arr) { const l = sanitizeLean(x); if (l && !ids.has(l.id)) { ids.add(l.id); out.push(l); } }
  return out;
}

/* the raw read: a store fault THROWS, for the writers and the validation,
   which must refuse rather than mistake a fault for "no leans" */
async function readLeansRaw(ctx = {}) {
  const store = ctx.kv || kv, ready = ctx.kvReady || kvReady;
  if (!ready()) return { list: [], ver: "", ready: false };
  const r = await store([["GET", K_LEANS], ["GET", K_LEANS_VER]]);
  const raw = r && r[0];
  let v = null;
  if (raw) { try { v = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { v = null; } }
  return { list: sanitizeLeans(v), ver: r && r[1] != null ? String(r[1]) : "", ready: true };
}
/* the safe read every reader uses: any fault is an empty list */
export async function readLeans(ctx = {}) {
  try { return (await readLeansRaw(ctx)).list; } catch { return []; }
}

/* THE DAY'S MAP, {reelA..reelF: {id, kind}}, from a list. Pure. A date with
   more leans than the rules allow (a hand edited or half written store) is
   read as no lean at all that day, and a slot two leans claim at once is
   read as no lean on that slot: never a guess at which one was meant. */
export function leansOn(list, date) {
  const out = {};
  const d = String(date || "").slice(0, 10);
  if (!isRealDate(d)) return out;
  const covering = sanitizeLeans(list).filter(l => l.from <= d && d <= l.to);
  if (!covering.length || covering.length > LEAN_MAX_ACTIVE) return out;
  const bySlot = {};
  for (const l of covering) (bySlot[l.slot] = bySlot[l.slot] || []).push(l);
  for (const [slot, ls] of Object.entries(bySlot)) if (ls.length === 1) out[slot] = { id: ls[0].id, kind: ls[0].kind };
  return out;
}

/* THE DAY'S MAP AS ONE SLOT RECORD SAW IT, for the insights reconstruction
   (api/_insights.js collect): the stored map for the record's date, with
   the record's OWN slot taken from the record itself, because the poster
   writes {id, kind} on a slot record exactly when a lean decided its kind.
   A record with no mark went out without one (an override won, or it went
   before the lean was set), and a mark whose lean has since been undone
   still says what that day did. Pure. */
export function leansOnRecord(list, rec) {
  if (!rec || typeof rec !== "object") return {};
  const day = leansOn(list, rec.date);
  if (REEL_SLOTS.includes(rec.slot)) {
    delete day[rec.slot];
    const m = rec.lean;
    if (m && typeof m === "object" && typeof m.id === "string" && m.id && LEAN_KINDS.includes(m.kind))
      day[rec.slot] = { id: m.id.slice(0, 80), kind: m.kind };
  }
  return day;
}

/* THE ONE CALL EVERY VIEW OF A DAY MAKES (the poster's runDue, sendSlot and
   composeSlot, the plan and today previews, api/_lineup.js's day context,
   the Lantern's line-up tool, the insights reconstruction), in the same
   fail-open shape as api/_experiments.js's biasFor: any fault at all is
   an empty map, which is exactly what "no lean" already means to
   api/_schedule.js's chooseReel. */
export async function leanFor(date, ctx = {}) {
  try { return leansOn(await readLeans(ctx), date); } catch { return {}; }
}

/* ---------------------------------------------------------------------------
   THE LEAN'S RULES (LANTERN.md section 6), pure, in the order a caller
   meets them. ctx: {today, list (the leans now stored), cards (the
   shelf), seen (the duplicate guard's window, a Map or Set of reel ids)}.
--------------------------------------------------------------------------- */
export function checkLean(args, ctx = {}) {
  const a = (args && typeof args === "object") ? args : {};
  const today = String(ctx.today || "").slice(0, 10);
  const list = sanitizeLeans(ctx.list);
  const cards = (Array.isArray(ctx.cards) ? ctx.cards : []).filter(c => c && c.id);
  const seen = ctx.seen && typeof ctx.seen.has === "function" ? ctx.seen : new Set();
  const slot = str(a.slot, 10), kind = str(a.kind, 10);
  if (!REEL_SLOTS.includes(slot)) return { ok: false, error: "a lean is for one reel slot, reelA to reelF" };
  if (!LEAN_KINDS.includes(kind))
    return { ok: false, error: "a lean names one kind: verse, word, name, know, light, short or dua (a This day reel keeps to its own date)" };
  const days = Number(a.days);
  if (!Number.isInteger(days) || days < 1 || days > LEAN_MAX_DAYS)
    return { ok: false, error: "a lean lasts 1 to " + LEAN_MAX_DAYS + " days" };
  if (!isRealDate(today)) return { ok: false, error: "today's date could not be told, so nothing was set" };
  const from = str(a.from, 10) || today;
  if (!isRealDate(from)) return { ok: false, error: "from must be a real date, YYYY-MM-DD" };
  if (from !== today && from !== plusDays(today, 1))
    return { ok: false, error: "a lean starts today or tomorrow (UTC), never " + from };
  const to = plusDays(from, days - 1);
  const dates = [];
  for (let i = 0; i < days; i++) dates.push(plusDays(from, i));

  const same = list.find(l => l.slot === slot && l.from <= to && from <= l.to);
  if (same)
    return { ok: false, error: slot + " already leans toward " + same.kind + " from " + same.from + " to " + same.to + "; a slot carries one lean at a time" };
  for (const d of dates) {
    const n = list.filter(l => l.from <= d && d <= l.to).length;
    if (n >= LEAN_MAX_ACTIVE)
      return { ok: false, error: "on " + d + " " + n + " leans are already active; at most " + LEAN_MAX_ACTIVE + " at once" };
  }
  const half = reelHalf(slot);
  const noShorts = !cards.some(c => (c.kind || "light") === "short");
  const cand = { id: "candidate", slot, kind, from, to };
  for (const d of dates) {
    const day = leansOn([...list, cand], d);
    let n = 0;
    for (const s of REEL_SLOTS) {
      const k = day[s] ? day[s].kind : rotaKindFor(reelHalf(s), d, noShorts);
      if (k === kind) n++;
    }
    if (n > LEAN_MAX_SAME_KIND)
      return { ok: false, error: "on " + d + " that would make " + n + " of the six reel slots " + kind + "; at most " + LEAN_MAX_SAME_KIND + " of one kind on a day" };
  }
  const fits = cards.filter(c => (c.kind || "light") === kind && (!c.slot || c.slot === half || kind !== "light"));
  const fresh = fits.filter(c => !seen.has(c.id)).length;
  if (fresh < LEAN_MIN_FRESH)
    return { ok: false, error: "only " + fresh + " " + kind + " cards that fit " + slot + " are outside the duplicate window; a lean needs at least " + LEAN_MIN_FRESH };
  if (dates.every(d => rotaKindFor(half, d, noShorts) === kind))
    return { ok: false, error: "the rota already gives " + slot + " " + kind + " on every one of those days; the lean would change nothing" };
  return { ok: true, lean: { slot, kind, from, to, days } };
}

/* AN OWNER'S SWAP IS NEVER MADE TO FALL BACK BY A LEAN. A swap set on
   another slot is checked against every other slot's pick, leans and all,
   when it is set (api/_lineup.js validateOverride). The one case left is a
   lean set AFTER the swap whose own pick happens to be the very card the
   swap names: on a day the leaned slot goes first, that would put the
   swapped card in the duplicate guard's window and the owner's choice
   would fall back. So the lean's pick on every day it covers is worked out
   here, now, and a clash refuses the lean, not the swap. A day the store
   cannot be read for refuses as well: this is a write. */
async function swapClash(lean, list, cards, seen, D) {
  const L = await import("./_lineup.js");
  const cand = { id: "candidate", slot: lean.slot, kind: lean.kind, from: lean.from, to: lean.to };
  let state = null;
  try { state = await D.expState(); } catch { state = null; }
  for (let i = 0; i <= dayNum(cand.to) - dayNum(cand.from); i++) {
    const d = plusDays(cand.from, i);
    let day;
    try { day = await L.readOverridesRaw(d, {}); }
    catch { return { ok: false, error: "the line-up of " + d + " could not be read, so nothing was set" }; }
    if (day[cand.slot]) continue;              /* that slot's own skip or swap wins there anyway */
    let bias = null;
    try { bias = state ? biasFromAny(state, d, EXPERIMENTS) : null; } catch { bias = null; }
    const pick = chooseReel(cards, d, reelHalf(cand.slot), null, seen, bias, {}, leansOn([...list, cand], d));
    if (!pick) continue;
    for (const [s, e] of Object.entries(day)) {
      if (s !== cand.slot && e && e.action === "swap" && e.id === pick.id)
        return { ok: false, error: "on " + d + " the lean would land on " + pick.id + ", the card already set by hand for " + s + " that day; nothing was set" };
    }
  }
  return { ok: true };
}

/* ---------------------------------------------------------------------------
   THE REST OF THE HOUSE, lazily (see the header), and a test's own stubs
   over it through api/_soul.js's seams.deps, the same seam api/_hands.js
   reads, with the same names wherever the two mean the same thing
--------------------------------------------------------------------------- */
const SITE = () => (process.env.SITE_HOST || "noorcodex.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
let SOUL = null;
const soul = async () => SOUL || (SOUL = await import("./_soul.js"));
let REAL = null;
function realDeps() {
  if (REAL) return REAL;
  const host = SITE();
  const social = () => import("./social.js");
  REAL = {
    host,
    manifest: async () => {
      const doc = await (await import("./_reels.js")).readManifest(host);
      return (doc && Array.isArray(doc.cards)) ? doc.cards : [];
    },
    recentlyPostedRaw: async d => (await social()).recentlyPostedRaw(d),
    expState: async () => expReadState({}),
    dials: async () => (await social()).dials(),
    /* no sendSlot and no slot claim: fix-posting never sends a slot */
    retryChannel: async (host2, d, s, ch, o) => (await social()).retryChannel(host2, d, s, ch, o),
    finishPendingReels: async (d, out) => (await social()).finishPendingReels(d, out)
  };
  return REAL;
}
async function leverDeps() {
  const S = await soul();
  return { ...realDeps(), ...((S.seams && S.seams.deps) || {}) };
}

/* the compare and set every lean write goes through (api/_soul.js casWrite,
   on the version key): a writer that read an older list than the one now
   stored writes nothing */
async function writeLeans(list, ver) {
  const S = await soul();
  let v;
  try { v = await S.casWrite(K_LEANS, K_LEANS_VER, ver, JSON.stringify(list)); }
  catch { return { ok: false, error: "the store could not be written to, so nothing changed" }; }
  if (v == null) return { ok: false, error: "the leans were changed by something else while this ran; nothing was written" };
  return { ok: true };
}

export const describeLean = l => l.slot + " (" + hourOf(l.slot) + ") leans toward " + l.kind
  + (l.from === l.to ? " on " + l.from : " from " + l.from + " to " + l.to)
  + "; a skip or swap set on that slot still wins, and the rota takes it back after " + l.to;

/* ---------------------------------------------------------------------------
   rota-lean: run and undo
--------------------------------------------------------------------------- */
async function rotaLeanRun(a, ctx = {}) {
  const S = await soul();
  const D = await leverDeps();
  const today = S.dayOf();
  let state;
  try { state = await readLeansRaw(); }
  catch { return { ok: false, error: "the leans could not be read, so nothing was set" }; }
  if (!state.ready) return { ok: false, error: "no store is configured, so nothing can be remembered" };
  let cards = null;
  try { cards = await D.manifest(); } catch { cards = null; }
  if (!Array.isArray(cards) || !cards.length) return { ok: false, error: "the shelf could not be read, so nothing was set" };
  let seen;
  try { seen = await D.recentlyPostedRaw(today); }
  catch { return { ok: false, error: "the duplicate guard could not be read, so nothing was set" }; }
  const v = checkLean(a, { today, list: state.list, cards, seen });
  if (!v.ok) return v;
  const clash = await swapClash(v.lean, state.list, cards, seen, D);
  if (!clash.ok) return clash;
  const lean = { id: S.newId("lean"), slot: v.lean.slot, kind: v.lean.kind, from: v.lean.from, to: v.lean.to,
    by: str(ctx.actor || "soul", 40), at: S.nowIso(), note: str(ctx.why, 300) };
  const keepFrom = plusDays(today, -LEAN_KEEP_DAYS);
  const w = await writeLeans([...state.list.filter(l => l.to >= keepFrom), lean], state.ver);
  if (!w.ok) return w;
  return { ok: true, lean, note: describeLean(lean), undo: { kind: "rota-lean-remove", lean } };
}

/* the exact inverse, and only of exactly what was written: the same id with
   the same slot, kind, days, author and stamp. Gone already: nothing left
   to do. Ended already: kept, since it is now only the record of days that
   went as they went. */
async function rotaLeanUndo(u) {
  const want = sanitizeLean(u && u.lean);
  if (!want) return { ok: false, error: "this entry carries no lean to compare against" };
  const S = await soul();
  let state;
  try { state = await readLeansRaw(); }
  catch { return { ok: false, error: "the leans could not be read, so nothing was undone" }; }
  const cur = state.list.find(l => l.id === want.id);
  if (!cur) return { ok: true, note: "the lean was already gone; there was nothing left to take away" };
  const same = ["slot", "kind", "from", "to", "by", "at"].every(k => cur[k] === want[k]);
  if (!same) return { ok: false, error: "the lean was changed since it was set, so nothing was undone" };
  if (cur.to < S.dayOf()) return { ok: true, note: "the lean already ended on " + cur.to + "; there is nothing left to undo, and it stays as the record of those days" };
  const w = await writeLeans(state.list.filter(l => l.id !== want.id), state.ver);
  if (!w.ok) return { ok: false, error: w.error };
  return { ok: true, removed: cur, note: "the lean was taken away: " + cur.slot + " follows the rota again, and whatever already went out under it stays as it went" };
}

/* ---------------------------------------------------------------------------
   fix-posting
--------------------------------------------------------------------------- */
/* the same key formats api/social.js writes (K_SLOT, K_POSTED_CH), read
   here directly and FAIL CLOSED: social.js's own readSlot answers null on a
   fault, which is right for a reader and wrong for a lever about to post,
   since a network that only LOOKS unasked would be asked twice.
   tests/levers.mjs proves the formats agree by writing through the
   poster's own functions and reading back here. */
const K_SLOT = (d, s) => "nsoc:slot:" + d + "#" + s;
const K_POSTED_CH = "nsoc:reels:postedch";
async function readSlotRaw(date, slot) {
  if (!kvReady()) throw new Error("no store is configured");
  const r = await kv([["GET", K_SLOT(date, slot)]]);
  const raw = r && r[0];
  let rec = null;
  if (raw) rec = typeof raw === "string" ? JSON.parse(raw) : raw;   /* a record that will not parse throws */
  return { rec: rec && typeof rec === "object" ? rec : null };
}

const NETS = { facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", telegram: "Telegram",
  threads: "Threads", pinterest: "Pinterest", linkedin: "LinkedIn", x: "X", reddit: "Reddit" };
const netName = c => NETS[c] || String(c || "");
/* a network refused, in slotState's own sense (api/social.js): not ok, not
   still processing, not a network that was never asked or is waiting on
   its review */
const refused = r => !!r && !r.ok && !r.pending && !r.skipped && !r.trial && !r.waiting;
const chanResult = (ch, r) => ({ channel: ch, ok: !!(r && r.ok), already: !!(r && r.already),
  pending: !!(r && r.pending), skipped: !!(r && r.skipped),
  error: r && !r.ok ? str(r.error || r.err || "", 160) : "" });
const IRREVERSIBLE = { kind: "irreversible", note: "a post is never deleted: what fix-posting sent stays where it went, so there is nothing to undo" };
/* THE LEVER'S OWN CLOCK. The cycle holds every hand to a minute
   (api/_mind.js HAND_STEP_MS) and then moves on, and this lever posts from
   inside the cycle's own function, not the poster's five minutes. So the
   retry is handed a clock that ends well inside that minute: the network
   goes on the poster's own per-network clock (sendWithin), one that has
   not answered by then is recorded late (a Facebook upload with its id,
   pending, for the finisher), and the slot's record is always written
   before the hand's minute is up. A whole slot (every network and its
   stories) never fits that minute, which is one reason the lever never
   sends one. */
export const FIX_RUN_MS = 50000;

async function fixPostingRun(a, ctx = {}) {
  const t0 = Date.now();
  const left = () => FIX_RUN_MS - (Date.now() - t0);
  const S = await soul();
  const D = await leverDeps();
  const SOC = await import("./social.js");
  const today = S.dayOf();
  const date = str(a.date, 10) || today;
  const slot = str(a.slot, 10);
  /* the Steward's own findings name these repairs by their buttons
     ({action: "retry-channel", where}, "send-slot", "finish-reels"), so a
     plan that copies one is read the same as the lever's own words */
  const ALIAS = { "retry-channel": "retry", "send-slot": "send", "finish-reels": "finish" };
  const w0 = str(a.what, 20).toLowerCase();
  const what = ALIAS[w0] || w0;
  const channel = str(a.channel || a.where, 20).toLowerCase();
  /* 6 October 2026 review: a slot owed and not yet sent is the hourly
     run's (one a run, the newest first, on its own full clock) and the
     owner's Post now; never this lever's */
  if (what === "send")
    return { ok: false, error: "fix-posting never sends a slot: a slot owed and not yet sent goes out with the hourly run, one slot a run and the newest first, or by the owner's Post now in Posts" };
  if (date !== today) return { ok: false, error: "fix-posting repairs today (" + today + ", UTC) only, never " + date };
  if (!SLOT_IDS.includes(slot)) return { ok: false, error: "no such slot: " + (slot || "none named") };
  if (!["retry", "finish"].includes(what)) return { ok: false, error: "what must be retry or finish" };

  /* the ladder, read the way the hourly run reads it: unreadable is a stop,
     and off means the schedule owes nothing */
  let dl;
  try { dl = await D.dials(); } catch { dl = null; }
  if (!dl || !dl.storeOk) return { ok: false, error: "the settings could not be read, so nothing was sent" };
  if (dl.mode === "off") return { ok: false, error: "the schedule is off, so it owes nothing today; the owner's own buttons still work" };

  let got;
  try { got = await readSlotRaw(date, slot); }
  catch { return { ok: false, error: "the slot's record could not be read, so nothing was sent" }; }
  const rec = got.rec;
  const state = rec && rec.state ? String(rec.state) : "";
  const at = hourOf(slot);
  const base = { what, date, slot };

  if (what === "finish") {
    if (!REEL_SLOTS.includes(slot)) return { ok: false, error: "only a reel is ever left processing by a network; " + slot + " is not one" };
    if (state !== "pending")
      return { ok: false, error: "nothing on the " + at + " slot is still processing (it reads " + (state || "nothing recorded") + ")" };
    let ran;
    try { ran = await D.finishPendingReels(date, { ran: [] }); }
    catch (e) { return { ok: false, error: "finishing failed: " + str(e && e.message || e, 160) }; }
    const mine = (ran || []).filter(x => x && x.slot === slot && x.date === date);
    const channels = mine.map(x => ({ channel: x.where, ok: !!x.ok, already: false, pending: x.state === "pending" && !x.finished,
      skipped: false, error: str(x.error, 160) }));
    let now = null;
    try { now = (await readSlotRaw(date, slot)).rec; } catch { now = null; }
    /* finishPendingReels walks every reel left processing yesterday and
       today, exactly as the finish-reels button does; what it did to the
       others is counted, not hidden */
    return { ok: true, ...base, state: (now && now.state) || state, channels,
      otherSlotsAsked: (ran || []).length - mine.length,
      note: channels.length ? "the " + at + " slot was asked to finish: " + channels.map(c => netName(c.channel) + (c.ok ? " published it" : c.pending ? " is still processing it" : " gave up on it")).join(", ")
        : "the " + at + " slot is still processing; nothing was ready to publish yet",
      undo: IRREVERSIBLE };
  }

  if (what === "retry") {
    if (!rec || !rec.results || !Object.keys(rec.results).length)
      return { ok: false, error: "nothing was recorded for the " + at + " slot today, so no network failed it; a slot owed and not yet sent is the hourly run's to send (or the owner's Post now), never this lever's" };
    if (state !== "failed" && state !== "partial") {
      const why = state === "sent" ? "every network that was asked has it"
        : state === "pending" ? "a network is still processing it; finish it first"
        : state === "skipped" ? "it was skipped today" : state === "queued" ? "it waits for the owner's own press" : "it reads " + (state || "nothing");
      return { ok: false, error: "the " + at + " slot has nothing to retry: " + why };
    }
    if (!channel) return { ok: false, error: "a retry names the network that failed" };
    if (channel === "reddit" || channel === "phone")
      return { ok: false, error: channel === "reddit" ? "Reddit is a draft for the owner and is never sent by the machine" : "the phone is the owner's own hand, not a network" };
    const r = rec.results[channel];
    if (!r) return { ok: false, error: netName(channel) + " was never asked for the " + at + " slot" };
    if (r.ok) return { ok: false, error: netName(channel) + " already has the " + at + " post; it is never sent there twice" };
    if (!refused(r)) return { ok: false, error: netName(channel) + " did not fail the " + at + " slot (" + (r.pending ? "it is still processing it" : "it was not asked, or it waits on its review") + ")" };
    if (!SOC.healable(r, rec))
      return { ok: false, error: netName(channel) + " refused for a reason a retry cannot mend (a token, a permission, or a post it cannot take); that needs the owner" };
    if (rec.reel) {
      /* the duplicate guard's own hash, asked first and fail closed: a reel
         this network already holds under ANY record is refused here */
      let hit;
      try { hit = (await kv([["HGET", K_POSTED_CH, String(rec.reel) + "|" + channel]]))[0]; }
      catch { return { ok: false, error: "the duplicate guard could not be read, so nothing was sent" }; }
      const when = hit ? Date.parse(String(hit).split("#")[0] + "T00:00:00Z") : NaN;
      if (hit && isFinite(when) && when >= Date.parse(date + "T00:00:00Z") - SOC.DUP_WINDOW_DAYS * DAY_MS)
        return { ok: false, error: netName(channel) + " already has " + rec.reel + " (" + hit + "); the duplicate guard never sends it there twice" };
    }
    let res;
    try { res = await D.retryChannel(D.host, date, slot, channel, { force: false, byHand: true, left }); }
    catch (e) { return { ok: false, error: "the retry failed: " + str(e && e.message || e, 160) }; }
    /* the poster's own claim on this one network's retry (api/social.js
       retryChannel, review of 6 October 2026): held by the hourly healer
       or the owner's Retry, so the network was not asked a second time */
    if (res && res.busy)
      return { ok: false, ...base, channel, busy: true,
        error: netName(channel) + " is being retried for the " + at + " slot right now (by the hourly run or the owner), so it was not asked twice" };
    const cr = chanResult(channel, (res && res.result) || res);
    return { ok: !!(res && res.ok), ...base, channel, state: (res && res.state) || state, channels: [cr],
      error: res && !res.ok ? str(res.error || cr.error || "the network refused again", 200) : undefined,
      note: netName(channel) + (res && res.ok ? (cr.already ? " already had the " + at + " post; the record now says so" : " took the " + at + " post")
        : res && res.result ? " refused the " + at + " post again: " + (cr.error || str(res.error, 160))
        : " was not asked again: " + str(res && res.error, 160)),
      undo: res && res.ok ? IRREVERSIBLE : undefined };
  }
  return { ok: false, error: "what must be retry or finish" };
}

/* ---------------------------------------------------------------------------
   THE LEVERS. The describe lines are what the planner reads, and what it
   reads it tends to repeat in its own why, so they are worded to say what
   each lever does in the house's own plain terms (the red lines in
   api/_hands.js are run over every why, and these must never trip them).
--------------------------------------------------------------------------- */
export const LEVERS = {
  "rota-lean": { tier: "R2", caps: ["rota"], args: "{slot, kind, days, from}",
    describe: "for one reel slot (reelA to reelF), for 1 to 7 days starting today or tomorrow (UTC), the slot's kind becomes the named kind (verse, word, name, know, light, short or dua); at most two leans at once, at most four of the six reel slots one kind on any day, the kind needs 30 cards outside the duplicate window, and a skip or swap set on that slot still wins; undo takes the lean away",
    run: rotaLeanRun, undo: rotaLeanUndo },
  "fix-posting": { tier: "R2", caps: ["fix"], ownCapOnly: true, args: "{date, slot, what: retry|finish, channel}",
    describe: "repair what today's schedule already sent (UTC): what retry asks one network that failed a slot to take it again, what finish asks a network still processing a reel to finish it; it never sends a slot (a slot owed and not yet sent goes out with the hourly run, one a run, or by the owner's own button in Posts), never a network that already has the post; the why names the slot, the network and what the record shows; nothing it does can be taken back",
    run: fixPostingRun, undo: async u => ({ ok: false, error: (u && u.note) || IRREVERSIBLE.note }) }
};
