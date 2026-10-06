// NOOR · sustaining the house: the gifts read as totals, the one quiet line,
// the note on the giving page.
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS (3 October 2026, LANTERN.md section 9)
//
// The owner: "It also needs to make the project survive at all cost by
// managing the donation system and bringing real money in, without ever
// being pushy, but finding a way to make money that will align with the
// project's core values." Article 11 of the constitution says how: the
// Lantern reads the gifts as totals, keeps the way to give working, thanks
// the givers and invites support honestly and gently, only through the one
// quiet line every page already carries and the note on the giving page, in
// wording written into the code. It never pressures, never shows an
// advertisement, never puts the library behind a payment, never sells or
// shares anything about readers. Only the owner opens accounts, accepts
// terms, sets prices or touches the payments.
//
// THREE HANDS, merged into the registry the way the levers are (api/_hands.js):
//
//   giving (R0): the reading. Stripe, READ ONLY (GET and nothing else), on
//     its own clock: the ledger's own computeLedger (api/ledger.js: every
//     charge, refunds out, fees from the balance transaction, the zakat set
//     aside and what was recorded as given) and a count of the active
//     subscriptions marked noor_donation. Only totals leave Stripe's answer:
//     never a name, an email, a du'a or a single gift. Kept in nsoul:giving
//     with its time and refreshed at most every 6 hours, by the cycle's sense
//     stage and by insights-refresh; the Home reads the record, never Stripe.
//   support-line (R2, cap support): the one quiet line takes one of the
//     fixed wordings by id (api/_public.js LINES). A seasonal wording only in
//     its season by the Hijri date, the thanks wording only in the month after
//     a month the gifts covered the recorded costs, at most one change in 7
//     days. Undo puts back the previous wording.
//   giving-note (R2, cap note): the note on /donate, made ONLY by a template
//     from the week's facts. Never an amount of money, a number of givers or a
//     name. At most one in 7 days. Undo puts back the previous note.
//
// And around them: the goal g-sustain (added once, the owner's), the
// decisions that watch the gift door, the three seeded ideas to earn in
// keeping with the house, the snapshot's giving block and the Home's
// `giving` part (LANTERN.md section 10).
//
// THIS FILE NEVER IMPORTS api/_hands.js, api/_home.js OR api/_decisions.js AT
// ITS TOP: the registry imports this file, so those are reached lazily,
// inside the functions that need them.
// ---------------------------------------------------------------------------

import {
  K, nowMs, nowIso, dayOf, monthOf, addDays, store, parse, getJSON, setJSON, readSeries, readSnapshot, saveSnapshot,
  auditAppend, actionsList, updateGoals, netFetch, sayLantern, readGoals
} from "./_soul.js";
import { computeLedger } from "./ledger.js";
import { verifiedHijri } from "./_hijri.js";
import { LINES, LINE_IDS, LINE_LABELS, SEASONAL, inSeason, effectiveLine, hijriFromCache, PUB_KEYS } from "./_public.js";

export const G_KEY = "nsoul:giving";
export const GIVING_MAX_AGE_MS = 6 * 3600 * 1000;   /* refreshed at most every 6 hours */
export const GIVING_READ_MS = 15000;                /* Stripe's own clock */
export const GIVING_BOX_MS = 20000;                 /* the sense stage's box for the whole step */
export const CHANGE_DAYS = 7;                       /* one line change, one note, in 7 days */
export const STRIPE_DOWN_HOURS = 24;                /* refused this long: the owner is told */
export const LEDGER_HREF = "/admin#giving";         /* the ledger room (the full console) */
export const SUSTAIN_ID = "g-sustain";
export const SUSTAIN_METRIC = "giving.monthly";

/* the test seam: a stubbed Stripe and a key (null in production: the
   platform's fetch and STRIPE_SECRET_KEY) */
export const givingSeams = { fetchImpl: null, key: null };
export function setGivingSeams(s) { Object.assign(givingSeams, s || {}); }

const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n || 200);
const num = v => (typeof v === "number" && isFinite(v) ? v : null);
const round2 = v => (typeof v === "number" && isFinite(v) ? Math.round(v * 100) / 100 : null);
const fmt = v => Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
/* Stripe's zero-decimal currencies carry no minor unit; everything else is
   cents (or fils, or paise), so a major unit is a hundred of them */
const ZERO_DECIMAL = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);
export const toMajor = (minor, cur) => (typeof minor === "number" && isFinite(minor) ? round2(ZERO_DECIMAL.has(String(cur || "").toLowerCase()) ? minor : minor / 100) : null);
const prevMonth = m => { const [y, mo] = String(m).split("-").map(Number); return mo === 1 ? (y - 1) + "-12" : y + "-" + String(mo - 1).padStart(2, "0"); };
const monthEnd = m => { const [y, mo] = String(m).split("-").map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };
function within(p, ms, what) {
  let t;
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(what + " took longer than " + Math.round(ms / 1000) + " seconds")), ms); })])
    .finally(() => clearTimeout(t));
}

/* ---------------------------------------------------------------------------
   1. THE READING (R0). Stripe, read only: GET requests and nothing else.
--------------------------------------------------------------------------- */
/* the active monthly gifts, counted: a subscription is a monthly giver when
   donate.js marked it noor_donation; nothing else about it is kept */
async function countMonthlyGivers(key, F, deadline) {
  let givers = 0, starting = "", partial = false;
  for (let page = 0; page < 10; page++) {
    if (page > 0 && Date.now() >= deadline) { partial = true; break; }
    const q = new URLSearchParams({ status: "active", limit: "100" });
    if (starting) q.set("starting_after", starting);
    const r = await F("https://api.stripe.com/v1/subscriptions?" + q.toString(), { method: "GET", headers: { Authorization: "Bearer " + key } });
    if (!r || !r.ok) throw new Error("stripe " + (r ? r.status : "no answer"));
    const j = await r.json();
    const data = Array.isArray(j && j.data) ? j.data : [];
    for (const s of data) if (s && s.metadata && s.metadata.noor_donation === "1" && (s.status === "active" || s.status === "trialing")) givers++;
    if (!j.has_more || !data.length) break;
    if (page === 9) partial = true;
    starting = data[data.length - 1].id;
  }
  return { givers, partial };
}
/* one reading: {configured, ok, ...totals} or {configured, ok:false, why}.
   Never throws. */
export async function readStripe(opts = {}) {
  const key = opts.key || givingSeams.key || process.env.STRIPE_SECRET_KEY;
  if (!key) return { configured: false, ok: false, why: "no Stripe key on this deployment" };
  const F = opts.fetchImpl || givingSeams.fetchImpl || netFetch();
  const deadline = Date.now() + (opts.ms || GIVING_READ_MS);
  const from30 = Math.floor((nowMs() - 30 * 86400000) / 1000);
  let all, last30, subs;
  try {
    [all, last30, subs] = await within(Promise.all([
      computeLedger({ key, fetchImpl: F, maxPages: 25, deadline }),
      computeLedger({ key, fetchImpl: F, from: from30, maxPages: 10, deadline }),
      countMonthlyGivers(key, F, deadline)
    ]), (opts.ms || GIVING_READ_MS) + 3000, "the Stripe reading");
  } catch (e) { return { configured: true, ok: false, why: str(e && e.message || e, 160) }; }
  if (!all || !all.ok || !last30 || !last30.ok) return { configured: true, ok: false, why: "Stripe refused the reading" + (all && all.reason ? " (" + all.reason + ")" : "") };
  const cur = String(all.currency || "usd").toLowerCase();
  const M = v => toMajor(v, cur);
  const month = monthOf(), last = prevMonth(month);
  const row = m => (all.months || []).find(r => r && r.month === m) || { count: 0, gross: 0, net: 0 };
  const totals = r => ({ count: r.count || 0, gross: M(r.gross || 0), net: M(r.net || 0) });
  /* the running costs recorded in the ledger as upkeep, by month */
  const upkeepIn = m => (all.given || []).filter(g => g && g.kind === "upkeep" && String(g.currency || cur).toLowerCase() === cur && String(g.date || "").slice(0, 7) === m)
    .reduce((t, g) => t + (Number(g.amountMinor) || 0), 0);
  const thisM = row(month), lastM = row(last);
  const costs = upkeepIn(month), costsLast = upkeepIn(last);
  return {
    configured: true, ok: true, partial: !!(all.partial || last30.partial || subs.partial), currency: cur, month,
    monthly: { givers: subs.givers },
    gifts30: { count: (last30.totals && last30.totals.count) || 0, gross: M((last30.totals && last30.totals.gross) || 0), net: M((last30.totals && last30.totals.net) || 0) },
    thisMonth: totals(thisM), lastMonth: totals(lastM),
    upkeep: { month: M(costs), cover: costs > 0 ? round2(thisM.net / costs) : null },
    /* kept for the thanks wording (the month before was covered); not a
       field of the Home's contract */
    lastMonthCover: costsLast > 0 ? round2(lastM.net / costsLast) : null,
    zakat: { outstanding: M(all.waterfall && all.waterfall.zakat ? all.waterfall.zakat.outstanding : 0) }
  };
}
export async function readGivingRecord() {
  return getJSON(G_KEY, null);
}
/* the reading, refreshed when it is older than opts.maxAgeMs (6 hours): a
   failed attempt keeps the last good totals and says when it began to fail.
   Answers {fresh, record}; never throws. */
export async function refreshGiving(opts = {}) {
  let prev = null;
  try { prev = await readGivingRecord(); } catch (e) { return { fresh: false, record: null, error: str(e && e.message || e, 160) }; }
  const maxAge = opts.maxAgeMs == null ? GIVING_MAX_AGE_MS : opts.maxAgeMs;
  const tried = prev && prev.lastTry && prev.lastTry.at ? Date.parse(prev.lastTry.at) : 0;
  /* a new calendar month is read at once (6 October 2026): the month's own
     totals, and what last month covered, change with it */
  if (!opts.force && prev && tried && nowMs() - tried < maxAge && monthOf(tried) === monthOf()) return { fresh: false, record: prev };
  const r = await readStripe(opts);
  const at = nowIso();
  let rec;
  if (r.ok) rec = { ...r, at, lastOkAt: at, lastTry: { at, ok: true }, failingSince: null };
  else if (r.configured !== false && prev && prev.ok) rec = { ...prev, lastTry: { at, ok: false, why: r.why }, failingSince: prev.failingSince || at };
  else rec = { configured: r.configured !== false, ok: false, why: r.why, at, lastOkAt: (prev && prev.lastOkAt) || null, lastTry: { at, ok: false, why: r.why },
    failingSince: r.configured === false ? null : ((prev && prev.failingSince) || at) };
  try { await setJSON(G_KEY, rec, 120 * 86400); } catch (e) { return { fresh: true, record: rec, error: "the reading could not be kept: " + str(e && e.message || e, 120) }; }
  return { fresh: true, record: rec };
}
/* a reading fit to stand for today: good, and read within the last 30 hours */
const goodToday = rec => !!(rec && rec.ok && rec.monthly && rec.lastOkAt && nowMs() - Date.parse(rec.lastOkAt) < 30 * 3600 * 1000);
/* AN AMOUNT REACHES A MODEL ONLY AS A TOTAL OF THREE GIFTS OR MORE (6
   October 2026, the review): a "total" of one or two gifts is those gifts'
   own amounts. Below three, every path to a model (the planner's and the
   council's evidence, the conversation's state, the snapshot the effects
   and the brief read) carries the count and null for the money, and for
   the share of the costs it covers. The owner's own Home card shows them. */
export const MODEL_MIN_GIFTS = 3;
const enough = t => !!(t && typeof t.count === "number" && t.count >= MODEL_MIN_GIFTS);
export const modelTotals = t => (enough(t) ? { count: t.count, gross: t.gross, net: t.net } : { count: t && typeof t.count === "number" ? t.count : 0, gross: null, net: null });
/* the snapshot's own block (SOUL.md section 6): totals only */
export function snapshotPart(rec) {
  if (!goodToday(rec)) return null;
  return { monthly: rec.monthly.givers, gifts30: rec.gifts30.count, net30: enough(rec.gifts30) ? rec.gifts30.net : null,
    cover: rec.upkeep && enough(rec.thisMonth) ? rec.upkeep.cover : null };
}
/* what the planner and the council read: totals, the line and the note */
export function evidencePart(rec, pub) {
  const p = pub || {};
  if (!rec) return { configured: null, why: "the gifts have not been read yet" };
  if (rec.configured === false) return { configured: false, why: "no Stripe key on this deployment" };
  if (!rec.ok) return { configured: true, read: false, why: str(rec.why, 160) };
  return { configured: true, read: true, stale: !goodToday(rec), currency: rec.currency, monthlyGivers: rec.monthly.givers,
    gifts30: modelTotals(rec.gifts30), thisMonth: modelTotals(rec.thisMonth), lastMonth: modelTotals(rec.lastMonth),
    costsCovered: rec.upkeep && enough(rec.thisMonth) ? rec.upkeep.cover : null,
    lastMonthCovered: enough(rec.lastMonth) ? rec.lastMonthCover : null, supportLine: p.line || null, noteAt: p.noteAt || null };
}

/* ---------------------------------------------------------------------------
   2. THE SUPPORT LINE (R2): one of the fixed wordings, by id
--------------------------------------------------------------------------- */
const WORDING = { "everyday": "the everyday wording", "ramadan": "the Ramadan wording", "last-ten": "the wording for the last ten nights",
  "dhul-hijjah": "the Dhul Hijjah wording", "thanks": "the thanks wording" };
export const wordingName = id => WORDING[id] || "a fixed wording";
/* today's Hijri date: the poster's own cache first, then the calendar
   itself (api/_hijri.js); null when it cannot be verified */
export async function hijriToday(today) {
  try {
    const r = await store([["MGET", "nhij:" + today, "nhij:" + addDays(today, -1)]]);
    const v = (r && r[0]) || [];
    const h = hijriFromCache(v[0], v[1]);
    if (h) return h;
  } catch { /* the calendar itself, below */ }
  try { const h = await verifiedHijri(today); return h ? { m: h.m, d: h.d, y: h.y } : null; } catch { return null; }
}
const MONTH_NAMES = ["", "Muharram", "Safar", "Rabi al-Awwal", "Rabi ath-Thani", "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhul Qa'dah", "Dhul Hijjah"];
async function supportLineRun(a, ctx) {
  const id = str(a && a.id, 20).toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(LINES, id)) return { ok: false, error: "no such wording: " + (id || "none") + "; the wordings are " + LINE_IDS.join(", ") };
  const today = dayOf();
  let cur;
  try { cur = await getJSON(PUB_KEYS.line, null); }
  catch { return { ok: false, error: "the line's own record could not be read, so nothing was changed" }; }
  /* compared with what readers see today, so a wording past its date or
     its season never blocks itself (6 October 2026) */
  const seen = cur ? effectiveLine(cur, SEASONAL.includes(String(cur.id)) ? await hijriToday(today) : null, today) : "everyday";
  if (seen === id) return { ok: false, error: "the line already carries " + wordingName(id) };
  if (cur && /^\d{4}-\d{2}-\d{2}$/.test(String(cur.since || "")) && cur.since > addDays(today, -CHANGE_DAYS))
    return { ok: false, error: "the line changed on " + cur.since + "; it changes at most once in " + CHANGE_DAYS + " days, so the next change may come on " + addDays(cur.since, CHANGE_DAYS) };
  let until = null;
  if (SEASONAL.includes(id)) {
    const h = await hijriToday(today);
    if (!h) return { ok: false, error: "today's Hijri date could not be verified, so no seasonal wording is set" };
    if (!inSeason(id, h)) return { ok: false, error: wordingName(id) + " is only for its season; today is " + h.d + " " + MONTH_NAMES[h.m] + " by the Umm al-Qura calendar" };
    /* a safety date as well: the season's own end is read from the calendar
       every time the line is shown (api/_public.js) */
    until = addDays(today, id === "ramadan" ? 30 : 11);
  }
  if (id === "thanks") {
    let rec = null;
    try { rec = await readGivingRecord(); } catch { rec = null; }
    if (!rec || !rec.ok) return { ok: false, error: "the gifts have not been read, so there is no month to thank for" };
    /* only on a reading of this month made today (6 October 2026): an older
       one may be of the month before, and thank for the wrong month */
    if (rec.month !== monthOf() || String(rec.lastOkAt || "").slice(0, 10) !== today)
      return { ok: false, error: "the thanks wording waits for a reading of this month made today; the last good reading was " + (rec.lastOkAt ? "on " + String(rec.lastOkAt).slice(0, 10) + ", of " + (rec.month || "an unknown month") : "never made") };
    if (!(typeof rec.lastMonthCover === "number" && rec.lastMonthCover >= 1))
      return { ok: false, error: "the thanks wording is only for the month after a month whose gifts covered the recorded costs; last month they did not, or no costs were recorded" };
    until = monthEnd(monthOf());
  }
  const after = { id, since: today, until, at: nowIso(), by: str(ctx && ctx.actor, 40) || "lantern" };
  try { await setJSON(PUB_KEYS.line, after); }
  catch (e) { return { ok: false, error: "the line could not be written: " + str(e && e.message || e, 120) }; }
  return { ok: true, id, since: today, until, before: cur ? { id: cur.id, since: cur.since || null } : null,
    undo: { kind: "support-line-revert", before: cur || null, after: { id, at: after.at } } };
}
async function supportLineUndo(u) {
  let cur;
  try { cur = await getJSON(PUB_KEYS.line, null); }
  catch { return { ok: false, error: "the line's own record could not be read, so nothing was undone" }; }
  if (!cur || !u || !u.after || cur.id !== u.after.id || cur.at !== u.after.at)
    return { ok: false, error: "the line was changed again since; it is left as it stands" };
  if (u.before) await setJSON(PUB_KEYS.line, u.before);
  else await store([["DEL", PUB_KEYS.line]]);
  return { ok: true, note: u.before ? "the line carries " + wordingName(u.before.id) + " again" : "the line carries the everyday wording again" };
}

/* ---------------------------------------------------------------------------
   3. THE NOTE ON THE GIVING PAGE (R2): a template, and only facts in it
--------------------------------------------------------------------------- */
/* the week's facts from the latest snapshot (today's, or the latest of the
   last three days): how many times the posts were seen (the north star's
   own sum), the readers who opened the pages, the posts and reels that went
   out. Nothing about money. */
export async function noteFacts() {
  const today = dayOf();
  let snap = null;
  try { snap = await readSnapshot(today); } catch { snap = null; }
  if (!snap) {
    try { const s = await readSeries(3, today); const last = s.slice().reverse().find(x => x && x.snap); snap = last ? last.snap : null; } catch { snap = null; }
  }
  if (!snap) return null;
  const n = v => (typeof v === "number" && isFinite(v) && v > 0 ? Math.round(v) : null);
  return { date: snap.date || today, seen: n(snap.northStar), readers: n(snap.site && snap.site.visitors7), posts: n(snap.output && snap.output.posts7) };
}
export function noteText(f) {
  if (!f) return null;
  const parts = [];
  if (f.seen) parts.push("the library's posts were seen " + fmt(f.seen) + " times");
  if (f.readers) parts.push(fmt(f.readers) + " readers opened its pages");
  if (f.posts) parts.push(fmt(f.posts) + " posts and reels went out");
  if (!parts.length) return null;
  const list = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];
  return "In the last seven days " + list + ". It stayed free, with no ads and no trackers, and 2.5 percent of every gift is set aside as zakat.";
}
async function givingNoteRun(a, ctx) {
  const today = dayOf();
  let cur;
  try { cur = await getJSON(PUB_KEYS.note, null); }
  catch { return { ok: false, error: "the note's own record could not be read, so nothing was written" }; }
  const curDay = cur && String(cur.at || "").slice(0, 10);
  if (cur && /^\d{4}-\d{2}-\d{2}$/.test(curDay) && curDay > addDays(today, -CHANGE_DAYS))
    return { ok: false, error: "the note was written on " + curDay + "; there is at most one in " + CHANGE_DAYS + " days, so the next may come on " + addDays(curDay, CHANGE_DAYS) };
  const facts = await noteFacts();
  const text = noteText(facts);
  if (!text) return { ok: false, error: "this week's facts could not be read, so there is nothing true to write" };
  const after = { text, at: nowIso(), facts, by: str(ctx && ctx.actor, 40) || "lantern" };
  try { await setJSON(PUB_KEYS.note, after); }
  catch (e) { return { ok: false, error: "the note could not be written: " + str(e && e.message || e, 120) }; }
  return { ok: true, text, undo: { kind: "giving-note-revert", before: cur || null, after: { at: after.at } } };
}
async function givingNoteUndo(u) {
  let cur;
  try { cur = await getJSON(PUB_KEYS.note, null); }
  catch { return { ok: false, error: "the note's own record could not be read, so nothing was undone" }; }
  if (!cur || !u || !u.after || cur.at !== u.after.at) return { ok: false, error: "the note was changed again since; it is left as it stands" };
  if (u.before) await setJSON(PUB_KEYS.note, u.before);
  else await store([["DEL", PUB_KEYS.note]]);
  return { ok: true, note: u.before ? "the previous note is back" : "the giving page carries no note again" };
}

/* the registry entries (api/_hands.js merges them in, as it does the levers) */
export const GIVING_HANDS = {
  giving: { tier: "R0", args: "{}", describe: "read the gifts as totals from Stripe, read only, at most every 6 hours: monthly givers, gifts in the last 30 days, this month and the last, the share of the running costs they cover",
    run: async () => {
      const r = await refreshGiving({});
      const rec = r.record;
      return { ok: !!rec, data: evidencePart(rec, null) };
    } },
  "support-line": { tier: "R2", caps: ["support"], args: "{id: " + LINE_IDS.join("|") + "}",
    describe: "set the one quiet support line every page carries to one of its fixed wordings; a seasonal wording only in its season (by the Hijri date), the thanks wording only in the month after a month the gifts covered the recorded costs; at most one change in 7 days; never any other text",
    run: supportLineRun, undo: supportLineUndo },
  "giving-note": { tier: "R2", caps: ["note"], args: "{}",
    describe: "write this week's note on the giving page from the week's facts by a fixed template (how many times the posts were seen, the readers, the posts that went out, free with no ads and no trackers, the zakat set aside); never an amount, a number of givers or a name; at most one in 7 days",
    run: givingNoteRun, undo: givingNoteUndo }
};
export const GIVING_HAND_NAMES = Object.freeze(Object.keys(GIVING_HANDS));
/* the words the Home says for each (api/_home.js NOW_WORDS and PAST_WORDS) */
export const GIVING_WORDS = {
  now: {
    giving: () => "Read the gifts as totals",
    "support-line": a => "Set the support line to " + wordingName(a && a.id),
    "giving-note": () => "Write this week's note on the giving page"
  },
  past: {
    giving: () => "Read the gifts as totals",
    "support-line": a => "Set the support line to " + wordingName(a && a.id),
    "giving-note": () => "Wrote this week's note on the giving page"
  }
};

/* ---------------------------------------------------------------------------
   4. THE GOAL g-sustain: the owner's, added once when missing, by compare
      and set, never over a goal he has
--------------------------------------------------------------------------- */
export const sustainTarget = b => (typeof b === "number" && isFinite(b) ? (b < 10 ? b + 10 : b * 2) : null);
export function sustainOutcome(baseline, target) {
  return typeof baseline === "number" && typeof target === "number"
    ? "More readers keeping the library alive each month: monthly givers from " + baseline + " to " + target + " within 12 weeks."
    : "More readers keeping the library alive each month: monthly givers up by ten, or doubled from ten and above, within 12 weeks of the first reading.";
}
/* the goal's card: Keep this goal, or Change it */
async function raiseSustainCard(DEC, goal, expires) {
  return DEC.upsert({ kind: "choose", key: "goal:" + SUSTAIN_ID, stamp: "1", sticky: true, source: "giving", goal: SUSTAIN_ID,
    title: "A goal for keeping the house alive: keep it?",
    why: goal.outcome + " It is yours: keep it as it is, or change it in the goals.",
    options: [DEC.opt.choice("keep", "Keep this goal", { type: "done" }, "primary"), DEC.opt.open("Change it")],
    link: { href: DEC.ROOM.engine, label: "Open the goals" }, steps: [], expires });
}
/* a card the cap pushed out before he answered it (overflow) is raised
   again while its goal stands, to its own first date (6 October 2026, the
   review); one he answered, or one past its date, is not */
async function sustainCardAgain() {
  try {
    const DEC = await import("./_decisions.js");
    const f = await DEC.findByKey("goal:" + SUSTAIN_ID);
    if (!f || f.open || !f.decision || f.decision.status !== "overflow") return false;
    const expires = f.decision.expires;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(expires || "")) || expires < dayOf()) return false;
    const goal = (await readGoals()).find(g => g && g.id === SUSTAIN_ID);
    if (!goal) return false;
    const r = await raiseSustainCard(DEC, goal, expires);
    return !!(r && r.ok);
  } catch { return false; }
}
export async function ensureSustainGoal(rec) {
  let done = null;
  try { done = (await store([["GET", K.once("goal:" + SUSTAIN_ID)]]))[0]; } catch { return { ok: false, error: "the store could not be read" }; }
  if (done) return { ok: true, added: false, already: true, raisedAgain: await sustainCardAgain() };
  const today = dayOf();
  const baseline = rec && rec.ok && rec.monthly && typeof rec.monthly.givers === "number" ? rec.monthly.givers : null;
  const target = sustainTarget(baseline);
  const goal = { id: SUSTAIN_ID, owner: "owner", outcome: sustainOutcome(baseline, target), metric: SUSTAIN_METRIC, baseline, target,
    due: addDays(today, 84), cadence: "weekly", status: "active", history: [], at: today };
  const r = await updateGoals(goals => {
    if (goals.some(g => g && (g.id === SUSTAIN_ID || g.metric === SUSTAIN_METRIC))) return { write: false, result: { ok: true, existed: true } };
    goals.push(goal);
    return { write: true, goals, result: { ok: true, added: true } };
  });
  if (!r || r.ok === false) return { ok: false, error: (r && r.error) || "the goals could not be written" };
  try { await store([["SET", K.once("goal:" + SUSTAIN_ID), nowIso()]]); } catch { }
  if (!r.added) return { ok: true, added: false, existed: true };
  try { await auditAppend({ kind: "goal-owner", actor: "lantern", summary: "the sustain goal was added once, as the owner's own, for him to keep or change", data: { goal } }); } catch { }
  /* raised once: Keep this goal, or Change it */
  try {
    const DEC = await import("./_decisions.js");
    await raiseSustainCard(DEC, goal, addDays(today, 30));
  } catch { /* the goal stands; the card comes from the next cycle's read of the archive, or not at all */ }
  return { ok: true, added: true, goal };
}

/* ---------------------------------------------------------------------------
   5. WATCHING THE GIFT DOOR: the decisions only the owner can act on
--------------------------------------------------------------------------- */
export function doorItems(rec) {
  const out = [];
  if (!rec) return out;
  if (rec.configured === false) {
    out.push({ kind: "you", key: "giving-setup", stamp: "1", sticky: false, title: "The gift door is not set up: Stripe has no key here",
      why: "The giving page cannot take a gift, and the Lantern cannot read the gifts, until the Stripe key is in place. Only you can add it.",
      options: "open-done-later", link: { href: "https://dashboard.stripe.com/apikeys", label: "Open Stripe" },
      steps: ["Copy the secret key from Stripe (Developers, API keys)", "Add it to Vercel as STRIPE_SECRET_KEY and redeploy", "Nothing else: the Lantern reads the gifts on its next cycle"] });
    return out;
  }
  const since = rec.failingSince ? Date.parse(rec.failingSince) : 0;
  if (rec.lastTry && rec.lastTry.ok === false && since && nowMs() - since >= STRIPE_DOWN_HOURS * 3600 * 1000) {
    out.push({ kind: "you", key: "giving-stripe", stamp: "1", sticky: false, title: "Stripe has refused the giving reading for a day",
      why: "Since " + String(rec.failingSince).slice(0, 10) + " every reading was refused (" + str(rec.lastTry.why, 120) + "). The gift door may still take gifts; the Lantern cannot see them until the key reads again."
        + (rec.lastOkAt ? " The last good reading was on " + String(rec.lastOkAt).slice(0, 10) + "." : ""),
      options: "open-done-later", link: { href: "https://dashboard.stripe.com/apikeys", label: "Open Stripe" },
      steps: ["Check in Stripe that the secret key is still active", "If it was rolled, put the new one in Vercel as STRIPE_SECRET_KEY and redeploy"] });
  }
  return out;
}
/* the zakat waiting, once a month: the amount on the owner's own card only,
   in its steps (the conversation's compact state carries a card's title and
   why, never its steps). 6 October 2026 (the review): raised, or kept up to
   date, while it waits and this month's card is open or was never raised;
   a card the cap pushed out (overflow) comes back; one he answered, or one
   put away, is not raised again this month */
export async function zakatItem(rec) {
  if (!rec || !rec.ok || !rec.zakat || !(rec.zakat.outstanding > 0)) return null;
  const month = monthOf();
  let f = null;
  try { const DEC = await import("./_decisions.js"); f = await DEC.findByKey("zakat:" + month); } catch { return null; }
  if (f && !f.open && f.decision && f.decision.status !== "overflow") return null;
  return { kind: "you", key: "zakat:" + month, stamp: month, sticky: true, title: "Zakat set aside is waiting to be given",
    why: "Zakat set aside from the gifts, 2.5 percent of every gift, waits to be given to those it is owed to (9:60). The amount is in the steps and the ledger.",
    options: "open-given-later", link: { href: LEDGER_HREF, label: "Open the ledger" },
    steps: [fmt(rec.zakat.outstanding) + " " + String(rec.currency || "").toUpperCase() + " waits to be given", "Give it to the zakat-eligible causes you choose", "Record it in the ledger, so the amount waiting goes down"], expires: monthEnd(month) };
}
/* the options above are named, and made here with the decisions' own
   builders (loaded lazily) */
function withOptions(DEC, it) {
  const o = it.options;
  const options = o === "open-given-later" ? [DEC.opt.open("Open the ledger"), DEC.opt.done("Given"), DEC.opt.later()]
    : [DEC.opt.open(), DEC.opt.done(), DEC.opt.later()];
  return { ...it, options };
}
export async function raiseDoorDecisions(rec) {
  const DEC = await import("./_decisions.js");
  const items = doorItems(rec).map(it => withOptions(DEC, it));
  const z = await zakatItem(rec);
  /* the goal's own card is sticky, so this sync never closes it */
  const out = await DEC.sync("giving", items);
  if (z) { try { await DEC.upsert({ ...withOptions(DEC, z), source: "giving-zakat" }); } catch { } }
  /* the zakat given since: its card closes itself */
  if (rec && rec.ok && rec.zakat && !(rec.zakat.outstanding > 0)) { try { await DEC.closeByKey("zakat:" + monthOf(), "resolved"); } catch { } }
  return out;
}

/* ---------------------------------------------------------------------------
   6. IDEAS TO EARN, IN KEEPING WITH THE HOUSE: seeded once each (from
      "seed"), never again once he has decided on them or said Never
--------------------------------------------------------------------------- */
export const SEED_IDEAS = Object.freeze([
  { seed: "case-for-support", title: "A case for support for foundations and sponsors", who: "lantern", metric: SUSTAIN_METRIC,
    why: "A one page letter about NOOR, what it is, whom it reaches and what it costs to keep, lets the owner ask a foundation or a sponsor for support himself. Go asks the next plan to write it as a draft for him to send.",
    impact: "support beyond readers' gifts, asked for by the owner himself" },
  { seed: "print-shop", title: "A shop of printed art from the house's own designs", who: "build", metric: SUSTAIN_METRIC,
    why: "Posters and prints of the house's own designs, with no faces and no symbol of another faith, at fair prices, would let readers carry the library's art home and help keep it. Claude prepares the print files; the owner opens the shop and sets the prices himself.",
    impact: "a second way to sustain the house that fits it",
    spec: "Prepare print ready files of the house's own designs (posters and prints, no faces, no symbol of another faith) and a short page linking to the shop. Steps: Claude prepares the files and the page; the owner opens the shop with a printing service and sets fair prices; nothing is sold from inside the library." },
  { seed: "documentary", title: "The first documentary, funded by named Guardians", who: "build", metric: SUSTAIN_METRIC,
    why: "A film the house cannot make on its own could be carried by Guardians who choose to be named on it, through an honest page that says what it is, what it costs and what it will be. Claude builds the page; the owner approves it before it goes live.",
    impact: "new work funded openly, with no ads and no pressure",
    spec: "Build an honest appeal page for the first documentary: what it is, what it costs, how a Guardian is named on it; its wording written in the code and approved by the owner before it goes live; no countdown, no pressure. Steps: Claude builds the page; the owner reads it and approves it; it is linked from the giving page." }
]);
export async function seedIdeas() {
  const H = await import("./_home.js");
  const out = { added: [], skipped: [] };
  for (const s of SEED_IDEAS) {
    const onceKey = K.once("seed:" + s.seed);
    let done = null;
    try { done = (await store([["GET", onceKey]]))[0]; } catch { continue; }
    if (done) { out.skipped.push(s.seed); continue; }
    const { seed, ...idea } = s;
    let r;
    try { r = await H.addIdeas([idea], "seed"); } catch { continue; }
    /* kept, or refused for good (said Never, or already held): never tried
       again; refused only because five are open: tried again next cycle */
    const drop = (r && r.dropped || [])[0];
    if ((r && r.added && r.added.length) || (drop && !/already open/.test(String(drop.why || "")))) {
      try { await store([["SET", onceKey, nowIso()]]); } catch { }
      if (r && r.added && r.added.length) out.added.push(seed);
      else out.skipped.push(seed);
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
   7. THE CYCLE'S STEP (api/_mind.js stageSense): the reading at most every
      6 hours, the snapshot's block, the evidence, the goal, the door, the
      seeds. Each part fails soft on its own into the record's notes.
--------------------------------------------------------------------------- */
export async function senseGiving(rec) {
  const notes = [];
  const r = await refreshGiving({});
  const g = r.record;
  if (r.error) notes.push("giving: " + r.error);
  const part = snapshotPart(g);
  if (rec.snapshot) {
    rec.snapshot.giving = part;
    if (!part) {
      rec.snapshot.missing = rec.snapshot.missing || {};
      rec.snapshot.missing["giving.monthly"] = !g ? "the gifts could not be read" : g.configured === false ? "giving is not configured on this deployment" : "no good reading of the gifts in the last 30 hours";
    }
  }
  let pub = null;
  try {
    const v = (await store([["MGET", PUB_KEYS.line, PUB_KEYS.note]]))[0] || [];
    const line = parse(v[0], null), note = parse(v[1], null);
    pub = { line: line ? { id: line.id, since: line.since || null } : null, noteAt: note ? note.at || null : null };
  } catch { pub = null; }
  /* beside the spend, early in the pack, so the planner's own slice of the
     evidence always holds it */
  if (rec.evidence) {
    const ev = {};
    for (const [k, v] of Object.entries(rec.evidence)) { if (k === "giving") continue; ev[k] = v; if (k === "spend") ev.giving = evidencePart(g, pub); }
    if (!("giving" in ev)) ev.giving = evidencePart(g, pub);
    rec.evidence = ev;
  }
  if (rec.snapshot) { try { await saveSnapshot(rec.snapshot); } catch (e) { notes.push("the gifts could not be added to the snapshot: " + str(e && e.message || e, 120)); } }
  try { const s = await ensureSustainGoal(g); if (s.added) notes.push("the sustain goal was added as the owner's, for him to keep or change"); }
  catch (e) { notes.push("the sustain goal could not be added: " + str(e && e.message || e, 120)); }
  /* a record that could not be read at all raises and closes nothing: a
     card is never closed because its reader failed */
  if (g) { try { await raiseDoorDecisions(g); } catch (e) { notes.push("the gift door's decisions could not be raised: " + str(e && e.message || e, 120)); } }
  try { await seedIdeas(); } catch (e) { notes.push("the seeded ideas could not be written: " + str(e && e.message || e, 120)); }
  return { record: g, part, notes };
}

/* ---------------------------------------------------------------------------
   8. THE HOME'S `giving` PART (LANTERN.md section 10): totals only, amounts
      in major units, from the record and the snapshots, never Stripe
--------------------------------------------------------------------------- */
export async function homeGiving(opts = {}) {
  const today = dayOf();
  const r = await store([["MGET", G_KEY, PUB_KEYS.line, PUB_KEYS.note, "nhij:" + today, "nhij:" + addDays(today, -1)]]);
  const v = (r && r[0]) || [];
  const rec = parse(v[0], null);
  if (!rec) throw new Error("the gifts have not been read yet; the next cycle reads them");
  if (rec.configured === false) throw new Error("giving is not configured on this deployment (no Stripe key)");
  if (!rec.ok || !rec.monthly) throw new Error("Stripe refused the reading" + (rec.why ? " (" + str(rec.why, 120) + ")" : ""));
  /* the daily readings, from the snapshots */
  let series = [];
  try {
    const s = await readSeries(30, today);
    series = s.filter(x => x.snap && x.snap.giving && typeof x.snap.giving.monthly === "number")
      .map(x => ({ date: x.date, monthly: x.snap.giving.monthly, net30: num(x.snap.giving.net30) }));
  } catch { series = []; }
  const weekAgo = series.find(x => x.date === addDays(today, -7));
  const givers = rec.monthly.givers;
  const stored = parse(v[1], null);
  const eff = effectiveLine(stored, hijriFromCache(v[3], v[4]), today);
  const note = parse(v[2], null);
  let did = [];
  try {
    const acts = typeof opts.actions === "function" ? await opts.actions() : await actionsList(200);
    did = (acts || []).filter(a => a && a.ok && GIVING_HAND_NAMES.includes(a.hand) && a.tier !== "R0").slice(0, 3)
      .map(a => ({ at: a.at, title: sayLantern(GIVING_WORDS.past[a.hand](a.args || {}) + (a.undone ? " (undone)" : "")) }));
  } catch { did = []; }
  return {
    configured: true, currency: rec.currency, month: rec.month,
    monthly: { givers, delta7: weekAgo ? givers - weekAgo.monthly : null },
    gifts30: rec.gifts30, thisMonth: rec.thisMonth, lastMonth: rec.lastMonth,
    upkeep: { month: rec.upkeep ? rec.upkeep.month : null, cover: rec.upkeep ? rec.upkeep.cover : null },
    zakat: { outstanding: rec.zakat ? rec.zakat.outstanding : null },
    series,
    line: { id: eff, label: sayLantern(LINE_LABELS[eff]), since: stored && stored.id === eff ? stored.since || null : null },
    note: note && note.text ? { text: str(note.text, 600), at: note.at || null } : null,
    did, at: rec.lastOkAt || rec.at, partial: !!rec.partial
  };
}

/* the brief's facts on giving (LANTERN.md section 9.7): new monthly givers
   this week and the share of the costs covered, totals only */
export function briefGiving(snap, weekAgoSnap) {
  const now = snap && snap.giving, ago = weekAgoSnap && weekAgoSnap.giving;
  if (!now) return null;
  const delta = typeof now.monthly === "number" && ago && typeof ago.monthly === "number" ? now.monthly - ago.monthly : null;
  const cover = typeof now.cover === "number" ? Math.round(now.cover * 100) : null;
  if (!(delta > 0) && cover == null) return null;
  return { newMonthly7: delta > 0 ? delta : null, coverPct: cover };
}
