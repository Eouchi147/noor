// NOOR · the Soul's hands: the only things it can do, and the guard first.
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS (2 October 2026, SOUL.md sections 1 to 3)
//
// The owner gave the soul full freedom inside the constitution. Freedom is
// only safe when its edges are code, not a model's restraint, so every
// intent the soul ever forms passes through this file in one fixed order:
//
//   1. redLineCheck(intent), a PURE function, before any model ever sees the
//      intent and again before any hand runs. A red line is tier R3: refused
//      here whatever the planner, the council or any text in the evidence
//      says. It errs toward refusing: a sentence that merely sounds like a
//      red line is refused too, and the chronicle says so.
//   2. the registry: only a hand named in HANDS can run. An unknown name is
//      refused, never guessed at, never mapped to the nearest real one.
//   3. pause: a paused soul runs nothing, and an unreadable pause flag reads
//      as paused.
//   4. the council: an R2 hand runs only with a council verdict that holds
//      under the rule in api/_soul.js's councilRule (checked again here,
//      never trusted as a bare `approved: true`).
//   5. the caps, counted atomically before the run (api/_soul.js reserve),
//      failing closed on any store fault.
//   6. the audit: an entry is written BEFORE the hand runs (a fault there
//      refuses the action) and another after, carrying the exact undo.
//
// THE TIERS. R0 reads (run freely, not audited: a read changes nothing).
// R1 writes only to the soul's own memory (a note, its own goals, a lesson
// proposal, an upgrade proposal): run freely, audited, undoable. R2 changes
// what the public sees or what the house posts, always through the house's
// own validated doors (api/_lineup.js setOverride and restoreOverride,
// api/_experiments.js planExperiment and stopExperiment, api/_insights.js
// refresh, api/social.js teachGuard), never around them.
//
// THE DEPENDENCIES are the rest of the house (the Observatory, the
// insights reader, the poster's own slot records). Real ones are imported
// lazily on first use, so a test can hand in stubs through api/_soul.js's
// seams.deps and never load a module that would reach a network.
// ---------------------------------------------------------------------------

import {
  CAP_LIMITS, K, nowIso, nowMs, dayOf, addDays, newId, store, parse, isPaused, auditAppend,
  actionsRecord, actionsList, actionsUpdate, reserve, release, councilRule, seams,
  soulGoalOp, soulGoalRestore, metricValue, readGoals
} from "./_soul.js";
import { looksLikeJournal } from "./_llm.js";
import { REEL_SLOTS } from "./_schedule.js";
import { getOverrideRaw, setOverride, clearOverride, restoreOverride, otherPicksFor, buildDayContext, chooseReelWithOverride, actorLabel } from "./_lineup.js";
import { EXPERIMENTS, readState as expReadState, resolveCurrent as expResolveCurrent, planExperiment, stopExperiment, biasFor, biasFromAny } from "./_experiments.js";
import * as I from "./_instruments.js";

/* ---------------------------------------------------------------------------
   1. THE RED LINES, MACHINE-CHECKED. One pattern family a line, run over the
      action's own name, its arguments and its stated reasons. The owner's
      own seeded goals are named here as well: an intent touching one is the
      "owner's goals" red line however it is phrased.
--------------------------------------------------------------------------- */
const OWNER_GOAL_IDS = ["g-reach", "g-attention", "g-search", "g-health"];
const RL = [
  { id: "delete-content", rx: [
    /\b(delete|deleting|remove|removing|hide|hiding|unpublish\w*|take\s+down|taking\s+down|archive|archiving|unlist\w*|trash\w*)\b[^.;\n]{0,50}\b(posts?|reels?|videos?|stor(y|ies)|content|pages?|lights?|library|entr(y|ies)|cards?|comments?|captions?)\b/i,
    /\b(delete|remove|hide|unpublish|takedown|unlist)[-_](post|reel|video|content|page|light|card)s?\b/i ] },
  { id: "external-accounts", rx: [
    /\b(create|creating|open|opening|register\w*|sign\s*up|signing\s*up)\b[^.;\n]{0,40}\baccounts?\b/i,
    /\baccept\w*\b[^.;\n]{0,30}\b(terms|tos|agreement|polic(y|ies))\b/i,
    /\b(spend|spending|pay|paying)\b[^.;\n]{0,30}(\$|\b(money|dollars?|usd|euros?|pounds?|budget on ads|ads?)\b)/i,
    /\b(purchase|purchasing|buy|buying|boost(ed|ing)?\s+(a\s+)?post|top\s*up|subscribe\s+to\s+(a\s+)?paid|paid\s+promotion|ad\s+campaign|run\s+ads)\b/i,
    /\b(change|changing|rotate|rotating|replace|replacing|set|setting|edit|editing|update|updating|revoke|revoking)\b[^.;\n]{0,40}\b(api\s*keys?|keys|tokens?|credentials?|passwords?|secrets?|account\s+settings|settings\s+of|webhooks?)\b/i,
    /\b(create|open|register)[-_]account\b/i ] },
  { id: "message-individuals", rx: [
    /\b(dm|dms|direct\s+messages?|private\s+messages?|inbox\s+them)\b/i,
    /\b(message|messaging|email|emailing|contact|contacting|reply\s+to|replying\s+to|comment\s+on|commenting\s+on|write\s+to|writing\s+to)\s+(each|every|all|individual|our|the|those|these|them|him|her|users?|followers?|people|readers?|commenters?|subscribers?)\b/i,
    /\bsend\w*\b[^.;\n]{0,30}\b(emails?|messages?|dms?|newsletters?)\b/i,
    /\b(dm|message|email|reply|comment)[-_](campaign|users?|followers?|people|readers?)\b/i ] },
  { id: "off-schedule-posting", rx: [
    /\b(post|posting|publish|publishing|send|sending|upload|uploading)\b[^.;\n]{0,40}\b(now|immediately|right\s+away|extra|additional|another|more\s+often|twice|outside\s+the\s+schedule|beyond\s+the\s+schedule|off\s*schedule)\b/i,
    /\b(extra|additional|unscheduled|bonus)\s+(posts?|slots?|reels?|stories)\b/i,
    /\b(more\s+posts|post\s+more|beyond\s+the\s+(daily\s+)?schedule|above\s+the\s+schedule)\b/i,
    /\b(write|generate|compose|create|make)\b[^.;\n]{0,30}\b(new\s+)?(posts?|reels?|cards?|captions?)\b[^.;\n]{0,30}\b(to\s+post|and\s+post|for\s+posting|to\s+publish)\b/i,
    /^(post|publish|upload|post-now|publish-now|send-post|schedule-post|extra-post|story)$/i ] },
  { id: "self-modification", rx: [
    /\b(change|changing|raise|raising|increase|increasing|lift|lifting|lower|lowering|edit|editing|modify|modifying|disable|disabling|remove|removing|bypass\w*|override|overriding|rewrite|rewriting|delete|deleting|relax\w*|loosen\w*|ignore|ignoring|amend\w*|suspend\w*|update|updating|turn\s+off)\b[^.;\n]{0,50}\b(constitution|articles?\s+of|red\s+lines?|caps?|daily\s+caps?|daily\s+limits?|budget|spending\s+cap|evals?|canar(y|ies)|owner'?s?\s+goals?|guardrails?|the\s+code|source\s+code|codebase|council|guardian|soul_monthly_usd)\b/i,
    /\b(deploy|deploying|commit|committing|push|pushing|merge|merging)\b[^.;\n]{0,30}\b(code|changes?|branch|repo|repository|patch)\b/i,
    /\b(edit|change|modify|patch)[-_](code|constitution|caps?|budget|evals?)\b/i ] },
  { id: "per-person-data", rx: [
    /\bjournal\s+(text|entr(y|ies)|posts?|content|comments?|notes?)\b/i,
    /\b(per[- ]person|personal\s+data|personally\s+identifiable|pii|visitor\s+ids?|reader\s+ids?|email\s+addresses|ip\s+addresses|individual\s+readers?'?\s+(data|records|history))\b/i,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/ ] }
];

function flatText(v, depth) {
  if (v == null) return "";
  if ((depth || 0) > 4) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(x => flatText(x, (depth || 0) + 1)).join(" . ");
  if (typeof v === "object") return Object.keys(v).map(k => k + ": " + flatText(v[k], (depth || 0) + 1)).join(" . ");
  return "";
}

/* {ok:true} or {ok:false, tier:"R3", line, text, reason}. Pure: no store, no
   model, no clock, no import that could reach either at call time. */
export function redLineCheck(intent) {
  const it = (intent && typeof intent === "object") ? intent : {};
  const action = String(it.action || "").trim();
  const args = (it.args && typeof it.args === "object") ? it.args : {};
  const refuse = (id, reason) => {
    const line = RED_LINES_TEXT[id] || id;
    return { ok: false, tier: "R3", line: id, text: line, reason: reason || ("red line: " + line) };
  };
  if (!action) return refuse("unknown", "an intent with no action name is never run");
  /* the action's own name is read as a phrase as well ("delete-post" reads
     as "delete post"), so a red line cannot hide behind a hyphen */
  const nameAsWords = action.replace(/[-_]+/g, " ");
  const body = [action, nameAsWords, flatText(args), flatText(it.why), flatText(it.expectedEffect), flatText(it.evidence)].join(" \n ");
  if (looksLikeJournal(body)) return refuse("per-person-data", "red line: journal text or a per-person marker is never sent to a model or acted on");
  /* the owner's goals: an intent touching one, by id or by owner */
  const goalArg = (args.goal && typeof args.goal === "object") ? args.goal : args;
  if ((action === "goal" || /goal/i.test(action)) && (OWNER_GOAL_IDS.includes(String(goalArg.id || "")) || goalArg.owner === "owner"))
    return refuse("self-modification", "red line: the owner's goals change only from the console");
  for (const line of RL) {
    for (const rx of line.rx) {
      const target = rx.source.startsWith("^") ? action : body;
      if (rx.test(target)) return refuse(line.id);
    }
  }
  return { ok: true };
}
const RED_LINES_TEXT = {
  "delete-content": "deleting or hiding any post on any network, or any content of the library",
  "external-accounts": "creating accounts, accepting terms, spending money, changing keys or settings of any external service",
  "message-individuals": "messaging individuals (DMs, comments, emails) on the house's behalf",
  "off-schedule-posting": "posting beyond the daily schedule, or posting anything that is not a card or reel already in the house's own shelf",
  "self-modification": "changing the constitution, red lines, caps, budget, evals, the owner's goals, or code",
  "per-person-data": "sending per-person data or Journal text to any model",
  "unknown": "an intent with no action"
};

/* ---------------------------------------------------------------------------
   2. THE DEPENDENCIES: the rest of the house, lazily
--------------------------------------------------------------------------- */
const SITE = () => (process.env.SITE_HOST || "noorcodex.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
let REAL = null;
function realDeps() {
  if (REAL) return REAL;
  const host = SITE();
  const social = () => import("./social.js");
  REAL = {
    host,
    observatory: async () => (await import("./observatory.js")).cached({}),
    observatoryInvalidate: async () => (await import("./observatory.js")).invalidateCache({}),
    insightsRead: async days => (await import("./_insights.js")).read(days, {}),
    insightsNumbers: async () => (await import("./_insights.js")).numbers({}),
    insightsRefresh: async () => {
      const I = await import("./_insights.js");
      const ref = await I.refresh(14, {});
      const snap = await I.snapshot({ force: true, days: 14 });
      return { ok: !!(ref.ok || snap.ok), fetched: ref.fetched, errors: ref.errors, partial: !!(ref.partial || snap.partial) };
    },
    computeVisitors: async () => (await import("./visitors.js")).computeVisitors(),
    manifest: async () => {
      const doc = await (await import("./_reels.js")).readManifest(host);
      return (doc && Array.isArray(doc.cards)) ? doc.cards : [];
    },
    expState: async () => expReadState({}),
    readSlot: async (d, s) => (await social()).readSlot(d, s),
    recentlyPostedRaw: async d => (await social()).recentlyPostedRaw(d),
    recentlyPosted: async d => (await social()).recentlyPosted(d),
    dayContext: async (date, seen) => buildDayContext(host, date, { seen, biasFor }),
    teachGuard: async network => (await social()).teachGuard(network, "https://" + host, {}),
    revertTaught: async keys => (await social()).revertTaught(keys)
  };
  return REAL;
}
/* the stubs a test hands in, over the real ones */
export function deps() {
  return { ...realDeps(), ...(seams.deps || {}) };
}

/* what the rota would post on these days, overrides and all: the same
   reading api/lineup.js's own GET and the Lantern's lineup tool give, so the
   soul, the console and the poster agree */
export async function lineupPreview(fromDate, days) {
  const D = deps();
  const out = [];
  const cards = await D.manifest().catch(() => []);
  let state = null;
  try { state = await D.expState(); } catch { state = null; }
  for (let i = 0; i < Math.max(1, Math.min(7, days || 2)); i++) {
    const d = addDays(fromDate, i);
    let bias = null;
    try { bias = state ? biasFromAny(state, d, EXPERIMENTS) : null; } catch { bias = null; }
    let seen = new Map();
    try { seen = await D.recentlyPosted(d); } catch { seen = new Map(); }
    const ctx = await buildDayContext(D.host, d, { cards, bias, seen, ...(D.hijri !== undefined ? { hijri: D.hijri } : {}) });
    for (const slot of REEL_SLOTS) {
      const rec = await D.readSlot(d, slot).catch(() => null);
      const { card, override } = await chooseReelWithOverride(ctx.cards, d, slot, ctx.hijri, ctx.seen, ctx.bias, null, { rec });
      out.push({ date: d, slot, sent: !!(rec && rec.state), card: card ? { id: card.id, kind: card.kind || "light", hook: String(card.hook || "").slice(0, 120) } : null,
        override: override ? { action: override.action, id: override.id || null, fellBack: !!override.fellBack,
          by: override.by || "owner", note: String(override.note || "").slice(0, 160) } : null });
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
   3. THE REGISTRY. Each hand: tier, the caps it spends beyond the R2 total,
      the argument shape the planner is told about, run(args, ctx) and
      undo(recipe). A run answers {ok, ..., undo}; an undo answers {ok}.
--------------------------------------------------------------------------- */
const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n || 200);
const realDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const NOOP = note => ({ kind: "noop", note });

/* the line-up change, through api/_lineup.js's own validated door exactly as
   api/lineup.js and the Lantern's approve path call it: the raw reads for
   `before` and the duplicate guard's window (a fault refuses, never guesses
   "nothing there"), the day's context, every other slot's own record, then
   setOverride, whose validation decides. */
/* THE SOUL'S OWN LIMITS ON A DAY (the 2 October review): a day can never be
   emptied by the soul. Per target date, at most SOUL_SKIPS_PER_DATE skips
   and SOUL_CHANGES_PER_DATE line-up changes in all, counted atomically
   (INCR first, then the check on the value INCR returned, given back on
   any refusal or failure), failing closed on a store fault; and only today
   or tomorrow (UTC), never further ahead. A slot that already carries the
   owner's own choice, or a Lantern proposal he approved, is his: the soul
   refuses it outright. */
export const SOUL_SKIPS_PER_DATE = 1;
export const SOUL_CHANGES_PER_DATE = 2;
const K_TARGET = (kind, date) => "nsoul:count:" + kind + ":" + date;
async function reserveTarget(action, date) {
  const keys = [K_TARGET("soul-lineup-date", date)];
  if (action === "skip") keys.push(K_TARGET("soul-skip-date", date));
  let r;
  try { r = await store(keys.flatMap(k => [["INCR", k], ["EXPIRE", k, String(9 * 86400)]])); }
  catch { return { ok: false, error: "the per-day line-up count could not be kept, so nothing was changed" }; }
  const changes = parseInt(r[0], 10), skips = action === "skip" ? parseInt(r[2], 10) : 0;
  const giveBack = async () => { try { await store(keys.map(k => ["DECR", k])); } catch { } };
  if (!isFinite(changes) || !isFinite(skips)) { await giveBack(); return { ok: false, error: "the per-day line-up count could not be read, so nothing was changed" }; }
  if (changes > SOUL_CHANGES_PER_DATE) { await giveBack(); return { ok: false, error: "the soul may change at most " + SOUL_CHANGES_PER_DATE + " slots of " + date + ", and has" }; }
  if (skips > SOUL_SKIPS_PER_DATE) { await giveBack(); return { ok: false, error: "the soul may skip at most " + SOUL_SKIPS_PER_DATE + " slot of " + date + ", and has" }; }
  return { ok: true, giveBack };
}
async function lineupRun(action, args, ctx) {
  const D = deps();
  const date = str(args.date, 10), slot = str(args.slot, 10), id = action === "swap" ? str(args.id, 120) : undefined;
  if (!realDate(date) || !REEL_SLOTS.includes(slot)) return { ok: false, error: "a line-up change needs a real date and a reel slot (reelA to reelF)" };
  if (action === "swap" && !id) return { ok: false, error: "a swap needs the id of a card on the shelf" };
  const today = dayOf();
  if (date !== today && date !== addDays(today, 1)) return { ok: false, error: "the soul changes only today's or tomorrow's line-up (UTC), never " + date };
  let before, seen;
  try { before = await getOverrideRaw(date, slot); }
  catch { return { ok: false, error: "the store could not be read, so nothing was changed" }; }
  if (before && before.by !== "soul")
    return { ok: false, error: "that slot was set by " + actorLabel(before.by) + "; the soul never overwrites it" };
  try { seen = await D.recentlyPostedRaw(date); }
  catch { return { ok: false, error: "the duplicate guard could not be read, so nothing was changed" }; }
  const dctx = await D.dayContext(date, seen);
  const records = {};
  for (const s of REEL_SLOTS) if (s !== slot) records[s] = await D.readSlot(date, s).catch(() => null);
  const otherPicks = await otherPicksFor(dctx.cards, date, slot, dctx.hijri, dctx.seen, dctx.bias, { records });
  /* api/_lineup.js's third actor, "soul": the record, the poster's slot
     record and the console all say the Soul set it, never the owner */
  const held = await reserveTarget(action, date);
  if (!held.ok) return held;
  let r;
  try {
    r = await setOverride({ date, slot, action, id },
      { manifest: dctx.cards, seen: dctx.seen, otherPicks, now: nowMs(), by: "soul", note: ("Council approved: " + str(ctx.why, 260)).slice(0, 300) });
  } catch (e) { r = { ok: false, error: String(e && e.message || e).slice(0, 160) }; }
  if (!r.ok) { await held.giveBack(); return { ok: false, error: r.error }; }
  return { ok: true, date, slot, override: r.override, before: before || null,
    undo: { kind: "lineup-revert", date, slot, before: before || null, after: r.override } };
}
/* the exact inverse: the prior entry put back byte for byte through
   restoreOverride, or the slot cleared, and only while the slot still holds
   exactly what this action wrote (its own at and by) */
async function lineupUndo(u) {
  const date = str(u.date, 10), slot = str(u.slot, 10);
  if (!date || !slot || !u.after) return { ok: false, error: "this entry carries nothing to compare against" };
  let current;
  try { current = await getOverrideRaw(date, slot); }
  catch { return { ok: false, error: "the store could not be read, so nothing was undone" }; }
  if (!current) return { ok: true, cleared: true, note: "there was nothing left to clear" };
  if (current.at !== u.after.at || current.by !== u.after.by || current.by !== "soul")
    return { ok: false, error: "the slot was changed again since (now " + actorLabel(current.by) + "'s); undo it in the Posts room" };
  if (u.before) {
    const r = await restoreOverride({ date, slot, entry: u.before });
    return r.ok ? { ok: true, restored: u.before } : { ok: false, error: r.error };
  }
  const r = await clearOverride({ date, slot });
  return r.ok ? { ok: true, cleared: true } : { ok: false, error: r.error };
}

async function igRowsFor60() {
  const D = deps();
  try { const ins = await D.insightsRead(60); return (ins && ins.igRows) || []; } catch { return []; }
}

export const HANDS = {
  /* R0: reads */
  observatory: { tier: "R0", args: "{}", describe: "the Observatory's own week: reach, views, visitors, posts, posting health, notes",
    run: async () => { const o = await deps().observatory(); return { ok: !!o && o.ok !== false, data: o ? { summary: o.summary, notes: o.notes, learn: o.learn && { sentences: o.learn.sentences }, experiment: o.experiment && { id: o.experiment.id, status: o.experiment.status, sentence: o.experiment.sentence } } : null }; } },
  insights: { tier: "R0", args: "{days}", describe: "what the network readings say, as sentences and medians by kind",
    run: async a => { const days = Math.max(1, Math.min(60, parseInt(a.days, 10) || 14)); const r = await deps().insightsRead(days); return { ok: !!r, data: r ? { days, read: r.read, unread: r.unread, sentences: r.sentences, learn: r.learn && { sentences: r.learn.sentences, watchByKind: r.learn.watchByKind, verseByLength: r.learn.verseByLength } } : null }; } },
  numbers: { tier: "R0", args: "{}", describe: "this week against last, by network and by kind",
    run: async () => { const n = await deps().insightsNumbers(); return { ok: !!n, data: n ? { thisWeek: n.thisWeek, byNetwork: n.byNetwork, byKind: n.byKind, best: n.best, worst: n.worst } : null }; } },
  visitors: { tier: "R0", args: "{}", describe: "site visitors and arrivals by network, totals only",
    run: async () => { const v = await deps().computeVisitors(); return { ok: !!v, data: v ? { totals: v.totals, arrivals: v.arrivals, sources: v.sources } : null }; } },
  lineup: { tier: "R0", args: "{fromDate, days}", describe: "what the rota will post, slot by slot",
    run: async a => ({ ok: true, data: await lineupPreview(realDate(a.fromDate) ? a.fromDate : dayOf(), Math.min(7, parseInt(a.days, 10) || 2)) }) },
  slots: { tier: "R0", args: "{date}", describe: "the day's slot records: what was sent, what failed",
    run: async a => { const d = realDate(a.date) ? a.date : dayOf(); const D = deps(); const out = [];
      for (const s of REEL_SLOTS) { const rec = await D.readSlot(d, s).catch(() => null); if (rec) out.push({ date: d, slot: s, state: rec.state }); }
      return { ok: true, data: out }; } },
  shelf: { tier: "R0", args: "{kind}", describe: "the cards and reels on the shelf, counted by kind",
    run: async a => { const cards = await deps().manifest(); const byKind = {};
      for (const c of cards) { const k = (c && c.kind) || "light"; byKind[k] = (byKind[k] || 0) + 1; }
      const f = a.kind ? cards.filter(c => c && c.kind === a.kind) : cards;
      return { ok: true, data: { total: cards.length, byKind, sample: f.slice(0, 12).map(c => ({ id: c.id, kind: c.kind, hook: String(c.hook || "").slice(0, 100) })) } }; } },
  experiment: { tier: "R0", args: "{}", describe: "the test now planned or running, and the history of finished ones",
    run: async () => { const st = await deps().expState(); const cur = expResolveCurrent(st, EXPERIMENTS);
      return { ok: true, data: { current: cur ? { id: cur.id, start: cur.start } : null, history: (st.history || []).slice(0, 5).map(h => ({ id: h.id, start: h.start, status: h.status, verdict: h.verdict || null, sentence: h.sentence || null })) } }; } },
  playbook: { tier: "R0", args: "{}", describe: "the soul's own playbook of lessons",
    run: async () => { const E = await import("./_evolve.js"); return { ok: true, data: await E.readPlaybook() }; } },

  /* R0: the instruments (SOUL.md section 11), read from the soul's memory;
     totals only, never a person */
  trajectories: { tier: "R0", args: "{}", describe: "each goal's trend line: projected value at its due date, the date it reaches its target, on-track, behind, met or no-data",
    run: async () => { const goals = await readGoalsSafe(); const d = dayOf(); return { ok: true, data: goals.map(g => { const t = I.trajectory(g, d); delete t.series; return t; }) }; } },
  anomalies: { tier: "R0", args: "{days}", describe: "the days whose numbers broke from their own trailing 28 days (posting health drop, reach collapse, spend spike, visitors spike)",
    run: async a => { const n = Math.max(1, Math.min(60, parseInt(a.days, 10) || 14)); return { ok: true, data: (await I.readAnomalies()).slice(0, n) }; } },
  effects: { tier: "R0", args: "{limit}", describe: "what past public actions did to the metric each named, seven days on, against the same weekday of earlier weeks",
    run: async a => { const list = await I.readEffects(Math.max(1, Math.min(50, parseInt(a.limit, 10) || 20))); return { ok: true, data: { summary: I.effectsSummary(list), items: I.effectsForPrompt(list) } }; } },
  "search-readiness": { tier: "R0", args: "{}", describe: "the latest weekly audit of 25 sitemap pages (title, description, canonical, structured data, words, indexable) and the IndexNow queue",
    run: async () => { const a = await I.readLatest("search"); return { ok: true, data: { audit: a ? { score: a.score, sampled: a.sampled, counts: a.counts, failures: (a.failures || []).slice(0, 10), week: a.week } : null, indexnow: await I.indexnowStatus(dayOf()) } }; } },
  "page-speed": { tier: "R0", args: "{}", describe: "the latest weekly PageSpeed Insights reading, mobile: performance score, LCP, CLS, INP for four pages",
    run: async () => ({ ok: true, data: await I.readLatest("speed") }) },
  "youtube-position": { tier: "R0", args: "{}", describe: "the channel's subscribers, total views and videos, and the benchmark channels' public totals",
    run: async () => ({ ok: true, data: await I.readLatest("youtube") }) },
  "topic-radar": { tier: "R0", args: "{}", describe: "what people searched on YouTube in the last 30 days, mapped to the house's shelves (demand signals)",
    run: async () => { const r = await I.readLatest("radar"); return { ok: true, data: r ? { week: r.week, signals: r.signals, byKind: r.byKind, rising: (r.rising || []).map(x => ({ query: x.query, views: x.views, kinds: x.kinds })) } : null }; } },
  coverage: { tier: "R0", args: "{}", describe: "cards of each kind on the shelf, posted and left, and days of runway at the rota's pace",
    run: async () => { const c = await I.takeCoverage(dayOf(), deps()); return { ok: !!c.ok, data: c.ok ? c : null, error: c.ok ? undefined : c.why }; } },
  scorecard: { tier: "R0", args: "{week}", describe: "the weekly scorecard (built on Mondays) for a week such as 2026-W40, or the latest",
    run: async a => ({ ok: true, data: (await I.readScorecard(a.week)).scorecard }) },

  /* R1: the soul's own memory */
  note: { tier: "R1", args: "{text}", describe: "a note in the soul's own memory",
    run: async a => {
      const text = str(a.text, 600);
      if (!text) return { ok: false, error: "an empty note" };
      const notes = parse((await store([["GET", K.notes]]))[0], []);
      const n = { id: newId("n"), at: nowIso(), text };
      await store([["SET", K.notes, JSON.stringify([n, ...(Array.isArray(notes) ? notes : [])].slice(0, 200))]]);
      return { ok: true, note: n, undo: { kind: "note-remove", id: n.id } };
    },
    undo: async u => {
      const notes = parse((await store([["GET", K.notes]]))[0], []);
      await store([["SET", K.notes, JSON.stringify((Array.isArray(notes) ? notes : []).filter(n => n && n.id !== u.id))]]);
      return { ok: true };
    } },
  goal: { tier: "R1", args: "{op: add|adjust|retire, goal: {id, outcome, metric, target, due, cadence}}", describe: "add, adjust or retire one of the soul's OWN goals (never an owner goal)",
    run: async a => {
      const op = str(a.op, 10);
      const r = await soulGoalOp(op, a.goal || {});
      if (!r.ok) return r;
      return { ok: true, goal: r.goal, undo: { kind: "goal-restore", id: r.goal.id, before: r.before } };
    },
    undo: async u => soulGoalRestore(u.id, u.before) },
  "lesson-propose": { tier: "R1", args: "{text, why} to add, or {kind: \"retire\", id, why} to retire a lesson", describe: "propose a playbook lesson, or retiring one (applied only if every canary passes)",
    run: async (a, ctx) => {
      const E = await import("./_evolve.js");
      const retire = a.kind === "retire";
      const r = retire
        ? await E.propose({ kind: "retire", lessonId: str(a.id, 80), lesson: { why: str(a.why || ctx.why, 400) }, from: ctx.cycle || "soul" })
        : await E.propose({ kind: "add", lesson: { text: str(a.text, 400), why: str(a.why || ctx.why, 400) }, from: ctx.cycle || "soul" });
      if (!r.ok) return r;
      return { ok: true, proposal: r.proposal, undo: { kind: "proposal-withdraw", id: r.proposal.id } };
    },
    undo: async u => (await import("./_evolve.js")).withdraw(u.id) },
  "upgrade-propose": { tier: "R1", args: "{title, why, spec, metric, expectedEffect, priority}", describe: "write a code upgrade proposal for the owner and Claude to build (never built by the soul)",
    run: async (a, ctx) => {
      const E = await import("./_evolve.js");
      const r = await E.addUpgrade({ title: a.title, why: a.why || ctx.why, spec: a.spec, metric: a.metric, expectedEffect: a.expectedEffect, priority: a.priority });
      if (!r.ok) return r;
      return { ok: true, upgrade: r.upgrade, undo: { kind: "upgrade-remove", id: r.upgrade.id } };
    },
    undo: async u => (await import("./_evolve.js")).removeUpgrade(u.id) },

  /* R2: what the public sees */
  "lineup-skip": { tier: "R2", caps: ["lineup"], args: "{date, slot}", describe: "skip one reel slot not yet sent, today or tomorrow (UTC) only; at most one soul skip a day",
    run: (a, ctx) => lineupRun("skip", a, ctx), undo: lineupUndo },
  "lineup-swap": { tier: "R2", caps: ["lineup"], args: "{date, slot, id}", describe: "swap one reel slot not yet sent, today or tomorrow (UTC) only, for a named card already on the shelf",
    run: (a, ctx) => lineupRun("swap", a, ctx), undo: lineupUndo },
  "experiment-plan": { tier: "R2", caps: ["experiment"], args: "{id, start, args}", describe: "plan a registered experiment (verse-length, reciter-pair) to start on a date",
    run: async a => {
      const id = str(a.id, 40), start = str(a.start, 10);
      const r = await planExperiment(id, start, (a.args && typeof a.args === "object") ? a.args : {}, {});
      if (!r.ok) return r;
      await deps().observatoryInvalidate().catch(() => {});
      return { ok: true, current: r.state.current, undo: { kind: "experiment-withdraw", id, start } };
    },
    undo: async u => {
      let st;
      try { st = await deps().expState(); } catch { return { ok: false, error: "the experiment state could not be read" }; }
      const cur = st && st.current;
      if (!cur || cur.id !== u.id || cur.start !== u.start) return { ok: false, error: "the test was changed since; nothing was undone" };
      const rows = cur.start > dayOf() ? [] : await igRowsFor60();
      const r = await stopExperiment(rows, { by: "soul" });
      if (!r.ok) return r;
      await deps().observatoryInvalidate().catch(() => {});
      return { ok: true, note: "the plan was withdrawn by stopping it: the test now sits in the history as stopped, the honest record of a plan made and taken back" };
    } },
  "experiment-stop": { tier: "R2", caps: ["experiment"], args: "{}", describe: "stop the current experiment, folding its final reading into history",
    run: async () => {
      const r = await stopExperiment(await igRowsFor60(), { by: "soul" });
      if (!r.ok) return r;
      await deps().observatoryInvalidate().catch(() => {});
      return { ok: true, evaluation: r.evaluation ? { id: r.evaluation.id, status: r.evaluation.status, verdict: r.evaluation.verdict || null } : null,
        undo: { kind: "irreversible", note: "a stopped test cannot be put back as it was; its final reading stays in the history, and it can be planned again from the console" } };
    },
    undo: async u => ({ ok: false, error: u.note }) },
  "insights-refresh": { tier: "R2", args: "{}", describe: "read the networks' public numbers again and take the day's stats snapshot",
    run: async () => { const r = await deps().insightsRefresh(); return { ...r, ok: !!(r && r.ok), undo: NOOP("this read the numbers the networks already show publicly and cached them; nothing on the site changed") }; },
    undo: async () => ({ ok: true, note: "nothing to put back" }) },
  /* the changed pages of the sitemap offered to the IndexNow engines (Bing,
     Yandex and the rest), at most 100 a day, counted in code; a ping asks a
     search engine to look again and changes nothing anyone sees, so its undo
     is a plain note */
  "indexnow-submit": { tier: "R2", args: "{max}", describe: "offer up to 100 changed sitemap pages a day to the IndexNow search engines (Bing, Yandex and others)",
    run: async a => {
      const r = await I.indexnowSubmit({ max: a.max, date: dayOf() });
      if (!r.ok) return r;
      return { ...r, undo: NOOP("a ping asks the search engines to read pages again; nothing on the site changed") };
    },
    undo: async () => ({ ok: true, note: "nothing to put back" }) },
  "reconcile-teach": { tier: "R2", args: "{network}", describe: "teach the duplicate guard what a network already holds",
    run: async a => {
      const network = str(a.network, 20);
      if (!network) return { ok: false, error: "which network?" };
      const r = await deps().teachGuard(network);
      if (!r || !r.ok) return { ok: false, error: (r && r.why) || "could not teach the guard" };
      return { ok: true, network, written: r.written, undo: { kind: "reconcile-teach-revert", keys: (r.taught || []).map(t => ({ reel: t.reel, network, before: t.before || null, wrote: t.day ? t.day + "#" : null })) } };
    },
    undo: async u => deps().revertTaught(u.keys) }
};

async function readGoalsSafe() {
  try { return await readGoals(); } catch { return []; }
}

/* the registry as the planner reads it */
export function registryText() {
  return Object.keys(HANDS).map(n => n + " (" + HANDS[n].tier + ") " + HANDS[n].args + ": " + HANDS[n].describe).join("\n");
}
export const tierOf = name => (HANDS[name] ? HANDS[name].tier : null);

/* ---------------------------------------------------------------------------
   4. RUN AND UNDO
--------------------------------------------------------------------------- */
function compactResult(r) {
  if (!r || typeof r !== "object") return r;
  const { undo, data, ...rest } = r;
  try { const s = JSON.stringify(rest); return s.length > 1500 ? { ok: rest.ok, note: "result too long to keep in full" } : rest; } catch { return { ok: rest.ok }; }
}

/* opts: {actor, cycle, approval (the council's own verdicts), why, metric,
   before: {metric, value, date}, the named metric's reading the morning the
   action ran, kept on every R2 entry for the effects ledger} */
export async function runHand(intent, opts = {}) {
  const it = (intent && typeof intent === "object") ? intent : {};
  const name = String(it.action || "");
  const rl = redLineCheck(it);
  if (!rl.ok) {
    try { await auditAppend({ kind: "refused", actor: opts.actor || "soul", summary: "refused at the red line: " + rl.text, data: { action: name.slice(0, 60), line: rl.line, cycle: opts.cycle || null } }); } catch { }
    return { ok: false, refused: "R3", line: rl.line, error: rl.reason };
  }
  const hand = Object.prototype.hasOwnProperty.call(HANDS, name) ? HANDS[name] : null;
  if (!hand) return { ok: false, refused: "unknown", error: "no such hand: " + name.slice(0, 60) + "; only a registered hand can run" };
  if (await isPaused()) return { ok: false, refused: "paused", error: "the soul is paused; nothing runs until the owner resumes it" };
  const args = (it.args && typeof it.args === "object" && !Array.isArray(it.args)) ? it.args : {};
  const ctx = { why: str(it.why, 600), cycle: opts.cycle || null, actor: opts.actor || "soul" };

  if (hand.tier === "R0") {
    try { const r = await hand.run(args, ctx); return { ok: !!(r && r.ok), tier: "R0", data: r && r.data }; }
    catch (e) { return { ok: false, tier: "R0", error: String(e && e.message || e).slice(0, 200) }; }
  }
  if (hand.tier === "R2" && !councilRule(opts.approval && opts.approval.verdicts)) {
    return { ok: false, refused: "council", error: "a public action runs only once the council approves it (the Guardian and at least two of three)" };
  }
  const kinds = hand.tier === "R2" ? ["r2", ...(hand.caps || [])] : [];
  const day = dayOf();
  const res = await reserve(kinds, day);
  if (!res.ok) return { ok: false, refused: "cap", error: res.error };
  const id = newId("act");
  try {
    await auditAppend({ kind: "act", actor: ctx.actor, summary: hand.tier + " " + name + " begins", data: { id, hand: name, tier: hand.tier, args, why: ctx.why, cycle: ctx.cycle } });
  } catch (e) {
    await release(kinds, day);
    return { ok: false, refused: "audit", error: "the audit entry could not be written, so nothing ran: " + String(e && e.message || e).slice(0, 120) };
  }
  let r;
  try { r = await hand.run(args, ctx); }
  catch (e) { r = { ok: false, error: "the hand itself failed: " + String(e && e.message || e).slice(0, 200) }; }
  if (!r || !r.ok) await release(kinds, day);
  const entry = {
    id, at: nowIso(), hand: name, tier: hand.tier, args, why: ctx.why, metric: str(it.metric, 60) || null,
    expectedEffect: str(it.expectedEffect, 300) || null, cycle: ctx.cycle, actor: ctx.actor,
    ok: !!(r && r.ok), error: r && !r.ok ? str(r.error, 300) : null,
    result: compactResult(r), undo: (r && r.ok && r.undo) || null, undone: false
  };
  if (hand.tier === "R2" && entry.metric) {
    const b = opts.before && typeof opts.before === "object" ? opts.before : {};
    entry.before = { metric: entry.metric, value: typeof b.value === "number" && isFinite(b.value) ? b.value : null, date: realDate(b.date) ? b.date : day };
  }
  try { await actionsRecord(entry); } catch { /* the audit below still holds the record */ }
  try {
    await auditAppend({ kind: "action", actor: ctx.actor, summary: hand.tier + " " + name + (entry.ok ? " done" : " failed"), data: { id, hand: name, ok: entry.ok, error: entry.error, undo: entry.undo } });
  } catch { entry.auditMissing = true; }
  return { ok: entry.ok, id, tier: hand.tier, entry, error: entry.error || undefined };
}

export async function undoAction(id, actor) {
  const list = await actionsList();
  const entry = list.find(x => x && x.id === id);
  if (!entry) return { ok: false, code: 404, error: "no such action" };
  if (entry.undone) return { ok: false, error: "this action was already undone" };
  if (!entry.ok) return { ok: false, error: "this action never took effect, so there is nothing to undo" };
  const hand = HANDS[entry.hand];
  if (!hand || typeof hand.undo !== "function" || !entry.undo) return { ok: false, error: "this action carries no undo" };
  let r;
  try { r = await hand.undo(entry.undo); }
  catch (e) { r = { ok: false, error: String(e && e.message || e).slice(0, 200) }; }
  try { await auditAppend({ kind: r.ok ? "undo" : "undo-refused", actor: actor || "owner", summary: (r.ok ? "undid " : "could not undo ") + entry.hand + " " + id, data: { id, hand: entry.hand, result: compactResult(r) } }); } catch { }
  if (r.ok) await actionsUpdate(id, { undone: true, undoneAt: nowIso(), undoneBy: actor || "owner" });
  return { ...r, ok: !!r.ok, id };
}

export { metricValue, CAP_LIMITS };
