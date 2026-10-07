// NOOR · the Lantern agent: the owner's own strategist in the console.
// ---------------------------------------------------------------------------
// POST /api/lantern-agent  {message, thread}   plans a request, reads the
//   house's own tools, hands parts to subagents on the router's best free
//   models, and streams its thinking and its answer as it works (Server-Sent
//   Events: plan, step, subagent, token, artifact, action, proposal, done,
//   error). Owner-gated exactly like every other admin route.
// POST /api/lantern-agent  {action:"approve"|"decline", id}   the owner's
//   one-tap answer to a proposal a run made.
// POST /api/lantern-agent  {action:"undo", id}   reverses a logged action,
//   where the ledger carries a real undo recipe.
// GET  /api/lantern-agent?action=ledger    the actions the agent has taken
//   on its own, newest first, with today's count against the daily cap.
// GET  /api/lantern-agent?action=proposals the proposals still waiting for
//   a yes or a no.
//
// This file is deliberately thin: every decision (the plan, the budgets,
// the critic, what counts as an autonomous action versus a proposal) lives
// in api/_agent.js, pure and tested with no network at all. What lives here
// is wiring: the real router (api/_llm.js), the real tools (reading the
// Observatory, the shelf, the Content Graph, the package builder, Jev), the
// real store for the ledger and the thread, and the SSE formatting.
//
// THE THREE FIXED AUTONOMOUS ACTIONS, and why only two are wired to run
// alone: api/_agent.js's own header explains why reordering or skipping a
// reel has no safe existing mechanism and is always a proposal here, never
// executed. Refreshing the network numbers and teaching the duplicate guard
// both already have a safe, existing, owner-honoured door (api/insights.js's
// refresh/snapshot actions, api/social.js's teachGuard), so this file calls
// those doors exactly as the console's own buttons do, never a new one.
//
// ONE ENTITY (3 October 2026, LANTERN.md section 5). The conversation is the
// Lantern's own voice now, not a second agent beside it:
//   its two autonomous actions run through the Lantern's hands
//     (api/_hands.js runHand: insights-refresh and reconcile-teach), judged
//     by the council first, and land in the one action ledger and audit;
//   an order the owner gives here that names a registered hand (a line-up
//     skip, a rota lean once that lever exists) becomes an intent through the
//     same hands, council and caps, and the answer says what was done or why
//     it was refused;
//   its proposals become the owner's decisions (api/_decisions.js); the
//     approve and decline doors below still answer, by deciding them;
//   it reads the Lantern's own state through its "lantern" tool;
//   GET ?action=ledger reads the one ledger (and the older entries this file
//     kept before), so the console's older room keeps working.
//
// THINK DEEPLY (round four, 7 October 2026). When the owner's own words in
// Ask say "think deeply" or "think hard" as a whole order, where the message
// begins or ends (the review fix of 7 October 2026), the run's one
// synthesis, the answer itself, is asked of a paid model under the router's
// "ask-deep" use (api/_llm.js: the day's 0.50 dollars and a call's 0.10
// dollar ceiling, inside the month's 10), with up to 25 seconds to think; if
// no paid model may answer, the free strong tier writes it as always. The
// plan and the subagents stay free. The call is a line in the ROI ledger,
// its outcome whether the answer it wrote was the one he read.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ownerGate } from "./_owner.js";
import { kv, kvReady } from "./_kv.js";
import { route as llmRoute, scrub, paidOutcome } from "./_llm.js";
import { runAgent, undoAction, buildProposal, ACTION_TYPES, AUTONOMOUS_DAILY_CAP, BUDGETS, compactToolOutputs } from "./_agent.js";
import { HANDS, tierOf, redLineCheck, runHand, undoAction as undoHand } from "./_hands.js";
import { convene, tieBreakOutcome } from "./_council.js";   /* review fix: the tie break's outcome from the verdict kept */
import { actionsList, sayLantern, setRequest } from "./_soul.js";
import { lanternState, intentTitle, actionTitle } from "./_home.js";
import * as DEC from "./_decisions.js";
import { playbookLookup } from "./_playbook.js";
import { cached as observatoryCached, readCache as observatoryReadCache, slotLabel } from "./observatory.js";
import { read as insightsRead, numbers as insightsNumbers, kindLabel } from "./_insights.js";
import { computeVisitors } from "./visitors.js";
import { reconcile as socialReconcile, readSlot, revertTaught, recentlyPosted } from "./social.js";
import { chooseReel, SLOTS, SLOT_IDS } from "./_schedule.js";
import { EXPERIMENTS, readState as expReadState, resolveCurrent as expResolveCurrent, evaluate as expEvaluate, biasFromAny as expBiasFromAny } from "./_experiments.js";
import { chooseReelWithOverride, getOverrideRaw, clearOverride, restoreOverride, buildDayContext } from "./_lineup.js";
import * as PAGE from "./page.js";
import { buildPackage } from "./_package.js";
import { judge as jevJudge } from "./_jev.js";

const json = (res, code, obj) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(obj);
};

/* the production host every tool that must build a URL reads, the same
   default api/_insights.js's own manifest() reader keeps */
const SITE = () => (process.env.SITE_HOST || "noorcodex.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
const HOST = () => "https://" + SITE();

function readJSON(rel) { try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), rel), "utf8")); } catch { return null; } }

/* NEVER AN INTERNAL ID REACHES A MODEL (2026-09-24 review). A live run asked
   "which kind of reel reaches most people" and the answer named "reel:reel"
   in plain sight: a tool's own data carries "reel:verse" or "reelA" because
   that is how the house itself keeps the record, but a model reading a raw
   id like that has no way to know what it means and no way to check, so
   every tool's data is walked once here before it ever reaches a subagent,
   the synthesis step or the owner's own answer. Every internal kind id
   (KIND_LABEL's own keys, including the "reel:reel" catch-all) and every
   slot id (api/_schedule.js's own SLOTS) is replaced with the exact word
   the owner already reads elsewhere in this console -- kindLabel() and
   observatory.js's own SLOT_NOUN -- never a second, newly invented name for
   the same thing. A key shaped like a kind id (kindDaily's own object keys)
   is renamed the same way a value would be. */
const SLOT_ID_SET = new Set(SLOT_IDS);
const KIND_ID_RX = /^(reel|card):[\w-]+$/;
function humanizeIds(value) {
  if (Array.isArray(value)) return value.map(humanizeIds);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) {
      const key = KIND_ID_RX.test(k) ? kindLabel(k) : k;
      out[key] = humanizeIds(value[k]);
    }
    return out;
  }
  if (typeof value === "string") {
    if (KIND_ID_RX.test(value)) return kindLabel(value);
    if (SLOT_ID_SET.has(value)) return slotLabel(value);
  }
  return value;
}

/* ---------------------------------------------------------------------------
   THE LANTERN'S HANDS, FROM THE CONVERSATION (3 October 2026, LANTERN.md
   section 5). One intent through the one door: the red lines first (no
   model is asked about what is forbidden), then, for a public act, the
   council of three over this run's own evidence, then api/_hands.js
   runHand, which keeps pause, the caps and the audit and records the act in
   the one ledger as the Lantern's (actor "lantern").
--------------------------------------------------------------------------- */
export const COUNCIL_MS = 45000;
const DASHES = new RegExp("[" + String.fromCharCode(0x2014, 0x2013) + "]", "g");
const plain = s => sayLantern(String(s == null ? "" : s).replace(DASHES, ", ").replace(/\s+/g, " ").trim());
function councilSaid(c) {
  if (!c) return "the council did not answer";
  if (c.timedOut) return "the council did not answer in time";
  if (c.sentinel && c.sentinel.vote === "reject") return "the sentinel said no (" + (c.sentinel.reasons || []).join("; ") + ")";
  const no = Object.values(c.verdicts || {}).filter(v => v && v.vote === "reject");
  return no.length ? "the council said no (" + no.map(v => v.role + ": " + ((v.reasons || [])[0] || "no reason given")).join("; ") + ")" : "the council said no";
}
/* what the council reads for an act asked for here: this run's own tool
   data, compact and totals only, the same shape the synthesis step is
   handed */
function conversationEvidence(toolOutputs) {
  const compact = compactToolOutputs((toolOutputs || []).slice(0, 8), "");
  return { source: "the owner's conversation with the Lantern in the console", tools: compact.map(c => ({ name: c.name, data: String(c.json || "").slice(0, 1500) })) };
}
export async function lanternAct(intent, ctx = {}) {
  const i = intent && typeof intent === "object" ? intent : {};
  const it = { action: String(i.action || ""), args: i.args && typeof i.args === "object" && !Array.isArray(i.args) ? i.args : {},
    why: String(i.why || "").slice(0, 600) || "the owner asked for it in the conversation", expectedEffect: String(i.expectedEffect || "").slice(0, 300), metric: String(i.metric || "").slice(0, 60) };
  if (!Object.prototype.hasOwnProperty.call(HANDS, it.action)) return { ok: false, refused: "unknown", error: "no such hand: " + it.action.slice(0, 60) };
  let approval = null, council = null;
  if (redLineCheck(it).ok && tierOf(it.action) === "R2") {
    const left = typeof ctx.timeLeftMs === "function" ? ctx.timeLeftMs() : COUNCIL_MS + 15000;
    const ms = Math.max(3000, Math.min(COUNCIL_MS, left - 15000));
    let t;
    /* review fix, 7 October 2026: the council knows its deadline, and a
       paid tie break's outcome is written from the verdict kept here */
    const pending = convene(it, conversationEvidence(ctx.toolOutputs), { until: Date.now() + Math.max(0, ms - 1000), deferOutcome: true })
      .catch(e => ({ approved: false, verdicts: {}, error: String(e && e.message || e).slice(0, 160) }));
    council = await Promise.race([
      pending,
      new Promise(res => { t = setTimeout(() => res({ approved: false, verdicts: {}, timedOut: true }), ms); })
    ]).finally(() => clearTimeout(t));
    if (council && council.timedOut) pending.then(late => tieBreakOutcome(late, false)).catch(() => {});
    else if (council && council.tieBreak && council.tieBreak.paidId) await tieBreakOutcome(council, true);
    if (!council || !council.approved) return { ok: false, refused: "council", council, error: councilSaid(council) };
    approval = council;
  }
  /* a red line goes straight to runHand, which refuses it and audits the
     refusal; an R1 hand runs without review, as in the cycle */
  const r = await runHand(it, { actor: "lantern", approval });
  return { ok: !!r.ok, actionId: r.id || null, undo: (r.entry && r.entry.undo) || null, entry: r.entry || null, refused: r.refused || null, error: r.ok ? null : r.error, council };
}
/* the hands the planner may name on the owner's order: every registered
   hand but the reads, which are its tools */
export function handsFor() {
  const names = Object.keys(HANDS).filter(n => tierOf(n) && tierOf(n) !== "R0");
  const lower = s => String(s || "").charAt(0).toLowerCase() + String(s || "").slice(1);
  return {
    has: name => names.includes(String(name || "")),
    text: names.map(n => n + " " + HANDS[n].args + ": " + HANDS[n].describe).join("\n"),
    run: async (intent, ctx) => {
      const r = await lanternAct(intent, ctx || {});
      const title = lower(intentTitle(intent));
      return { ...r, said: plain(r.ok ? (r.council ? "Done, with the council's approval: " : "Done: ") + title + "." : "Not done (" + title + "): " + (r.error || "it was refused") + ".") };
    }
  };
}

/* ---------------------------------------------------------------------------
   THE TOOLS. Every one reads only; every one but "jev" is deterministic and
   calls no model at all; none sends a per-person row (the agent's own
   guardToolOutput() double-checks this with the router's own scrubber
   before anything reaches a subagent). Each returns { data, summary }: data
   is the compact JSON a subagent or the synthesis step may read, summary is
   the one line the console's thinking stream shows while the step is
   running. tools.jev is the one exception, named in api/_agent.js's own
   header (MODEL_TOOL_NAMES): it judges a piece of text with a real model
   call, over the house's existing Vercel AI Gateway use (the same free
   gateway api/_jev.js already rides for every other judged call in this
   house, nothing new spent), so its own text is scrubbed here the same way
   a subagent's own prompt is scrubbed before it is sent, and its return
   carries `modelCall: true` so api/_agent.js's step loop counts it against
   the run's model-call budget exactly as it counts a subagent. Every tool
   here is wrapped once, below, so its own `data` never carries a raw kind
   or slot id regardless of which tool it came from or which one is added
   here next.
--------------------------------------------------------------------------- */
function buildTools(req) {
  const tools = {};

  tools.observatory = async () => {
    const o = await observatoryCached({});
    const s = o && o.summary;
    const summary = o && o.ok !== false
      ? "reach " + (s && s.reach && s.reach.value != null ? s.reach.value : "·") + ", views " + (s && s.views && s.views.value != null ? s.views.value : "·")
        + ", " + (o.notes || []).length + " pattern note" + ((o.notes || []).length === 1 ? "" : "s") + "."
      : "the Observatory could not be composed.";
    return { data: o, summary };
  };

  tools.insights = async (args) => {
    const days = Math.max(1, Math.min(60, parseInt((args && args.days) || 14, 10) || 14));
    const r = await insightsRead(days, {});
    return { data: r, summary: r.read + " posts read, " + r.unread + " unread, " + r.refused + " refused, over " + days + " days." };
  };

  tools.numbers = async () => {
    const n = await insightsNumbers({});
    return { data: n, summary: "this week " + n.thisWeek.from + " to " + n.thisWeek.to + " against the week before, " + (n.byNetwork || []).length + " networks." };
  };

  tools.visitors = async () => {
    const v = await computeVisitors();
    const t = v && v.totals;
    return { data: v, summary: t ? t.people30 + " readers, " + t.views30 + " page views, last 30 days." : "visitors could not be read." };
  };

  tools.reconcileRead = async (args) => {
    const network = String((args && args.network) || "").trim();
    if (!network) return { data: { ok: false, error: "which network?" }, summary: "no network named." };
    const r = await socialReconcile(network, HOST(), { date: args && args.date, days: args && args.days });
    const summary = r.enumerable === false ? network + " cannot be enumerated: " + (r.why || "not supported") + "."
      : "checked " + network + " against the record" + (r.twice ? ", " + r.twice.length + " duplicate finding(s)" : "") + ".";
    return { data: r, summary };
  };

  tools.package = async (args) => {
    const id = String((args && args.id) || "").trim();
    if (!id) return { data: { ok: false, error: "which content id?" }, summary: "no id named." };
    const p = await buildPackage(id);
    return { data: p, summary: p.ok ? "built a package for " + p.content_id + ", " + (p.gaps || []).length + " gap(s) noted." : "no such object: " + id + "." };
  };

  tools.graph = async (args) => {
    const file = String((args && args.file) || "entity-graph").replace(/[^a-z-]/g, "");
    const FILES = { "entity-graph": "assets/entity-graph.json", "reel-sources": "assets/reel-sources.json", "reel-subjects": "assets/reel-subjects.json" };
    const rel = FILES[file] || FILES["entity-graph"];
    const j = readJSON(rel);
    if (!j) return { data: { ok: false, error: rel + " is not on this deployment" }, summary: rel + " could not be read." };
    const id = args && args.id;
    const data = id ? (j[id] || (j.sources && j.sources[id]) || (j.names && j.names[id]) || null) : j;
    return { data, summary: id ? (data ? "found " + id + " in " + rel + "." : "nothing recorded for " + id + " in " + rel + ".") : rel + " read whole." };
  };

  tools.shelf = async (args) => {
    const cards = await PAGE.manifest();
    const kind = args && args.kind;
    const filtered = kind ? cards.filter(c => c && c.kind === kind) : cards;
    const byKind = {};
    for (const c of cards) { const k = c && c.kind || "?"; byKind[k] = (byKind[k] || 0) + 1; }
    return { data: { total: cards.length, byKind, matched: filtered.length, sample: filtered.slice(0, 20).map(c => ({ id: c.id, kind: c.kind, hook: c.hook })) },
      summary: cards.length + " cards on the shelf" + (kind ? ", " + filtered.length + " of kind " + kind : "") + "." };
  };

  tools.lineup = async (args) => {
    const from = String((args && args.fromDate) || new Date().toISOString().slice(0, 10));
    const days = Math.max(1, Math.min(14, parseInt((args && args.days) || 3, 10) || 3));
    const cards = await PAGE.manifest();
    /* the experiment state is read once for the whole preview, not once a
       day: biasFromAny itself is pure arithmetic (no store call at all)
       once the state is in hand, the same restraint api/_insights.js's own
       collect() already keeps over a sixty day window. A KV fault answers
       the same empty state a house with no test ever had, so a bad read
       here never breaks the preview, only ever costs it a lean. */
    const state = await expReadState({}).catch(() => ({ current: null, history: [] }));
    const out = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.parse(from + "T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
      /* the same lean a real post would use that day (api/_experiments.js's
         biasFromAny), so this preview never shows a different card than the
         one the machine will actually choose */
      let bias = null;
      try { bias = expBiasFromAny(state, d, EXPERIMENTS); } catch { bias = null; }
      /* the same day context every other view builds (api/_lineup.js's own
         buildDayContext): the day's own hijri date and the duplicate
         guard's recent window, so a swap this tool shows as still holding
         is the one that would actually post, not one the guard would have
         since refused (2026-09-26 review: this used to hand chooseReel
         neither, so a stale swap read here as still good). The cross-slot
         same-day check (otherPicks) is left to the door that actually
         writes something -- setOverride's own validation and the posting
         path's own reelOverridePlan -- since paying for it here too would
         be six slots squared for every one of up to fourteen days this
         tool may be asked to preview, for a number that is never more than
         a display. */
      const dayCtx = await buildDayContext(HOST(), d, { cards, bias, recentlyPosted });
      for (const s of SLOTS.filter(x => x.reel)) {
        /* a slot the day has already decided (its own record's rec.reel) is
           a fact, not a pick to preview -- the same rule every other view
           now applies (api/_lineup.js's own chooseReelWithOverride). Only
           this one extra read per slot, never the otherPicks squared cost
           the comment above already declines. */
        const rec = await readSlot(d, s.id).catch(() => null);
        /* and the day's rota leans (api/_levers.js), from the same day
           context, so a leaned slot shows the card the poster will pick */
        const { card: c, override: ov, lean: ln } = await chooseReelWithOverride(dayCtx.cards, d, s.id, dayCtx.hijri, dayCtx.seen, dayCtx.bias, null, { rec, leans: dayCtx.leans });
        out.push({ date: d, slot: s.id, hour: s.at, half: s.reel,
          card: c ? { id: c.id, kind: c.kind, hook: c.hook } : null,
          override: ov ? { action: ov.action, id: ov.id || null, by: ov.by,
            fellBack: ov.fellBack || undefined, reason: ov.reason || undefined } : null,
          ...(ln ? { lean: { id: ln.id, kind: ln.kind } } : {}) });
      }
    }
    return { data: out, summary: "predicted " + out.length + " reel slots over " + days + " day(s) from " + from + ". This is what the rota would choose today, not a promise: it recomputes at post time." };
  };

  /* the current or most recently stopped test, read the same way
     GET /api/experiments answers the console, minus nothing secret: there
     is nothing secret in it, an experiment is a question about reach and
     watch time, never a person. Reading its evaluation used to cost about
     660 slot reads (insightsRead's own 60 day collect) every time this
     tool ran; it now reuses the Observatory's own ten minute cache, read
     only (api/observatory.js's own `readCache`, a plain GET with no
     compose and no write -- `cached`, the door tools.observatory above
     uses, is for the one room that owns that cache, and would otherwise
     have this read-only tool composing the whole dashboard and writing it
     back on a cold cache, paying the very 660 reads this was meant to
     avoid). A cold or mismatched cache falls back to a fresh read. */
  tools.experiment = async () => {
    const state = await expReadState({}).catch(() => ({ current: null, history: [] }));
    const current = expResolveCurrent(state, EXPERIMENTS);
    let evaluation = null;
    if (current) {
      try {
        const obs = await observatoryReadCache({});
        evaluation = (obs && obs.experiment && obs.experiment.id === current.id && obs.experiment.start === current.start)
          ? obs.experiment : null;
      } catch { evaluation = null; }
      if (!evaluation) {
        const ins = await insightsRead(60, {}).catch(() => ({ igRows: [] }));
        evaluation = expEvaluate(current, ins.igRows || [], new Date().toISOString());
      }
    }
    const registry = Object.keys(EXPERIMENTS).map(id => {
      const e = EXPERIMENTS[id];
      return { id: e.id, question: e.question, kind: e.kind, days: e.days };
    });
    const summary = evaluation
      ? "running: " + evaluation.question + " " + evaluation.sentence
      : (state.history && state.history.length ? state.history.length + " test(s) finished; none running now." : "no test running.");
    return { data: { registry, current: evaluation, history: state.history || [] }, summary };
  };

  tools.slots = async (args) => {
    const from = String((args && args.fromDate) || new Date().toISOString().slice(0, 10));
    const to = String((args && args.toDate) || from);
    const dates = [];
    for (let t = Date.parse(from + "T00:00:00Z"); t <= Date.parse(to + "T00:00:00Z"); t += 86400000) dates.push(new Date(t).toISOString().slice(0, 10));
    const out = [];
    for (const d of dates.slice(0, 31)) for (const s of SLOT_IDS) {
      const rec = await readSlot(d, s).catch(() => null);
      if (rec) out.push({ date: d, slot: s, state: rec.state, title: rec.title || "" });
    }
    return { data: out, summary: out.length + " slot record(s) read from " + from + " to " + to + "." };
  };

  tools.recentChanges = async (args) => {
    const n = Math.max(1, Math.min(40, parseInt((args && args.n) || 10, 10) || 10));
    /* read from the public site rather than the deployment's own disk:
       changes.txt is not worth widening vercel.json's own 256-character
       includeFiles glob for (api/observatory.js and this file already
       spend most of that budget on the library itself), and the file is
       published at this exact address for a reader to read anyway, so the
       agent reads the same copy a reader would. A short timeout and a
       soft failure, the same shape every other tool here already answers
       with when something it wanted is not there: "recent changes could
       not be read" is a fact the owner can act on, a hung request is not. */
    let text = "";
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(HOST() + "/changes.txt", { signal: ctrl.signal });
      clearTimeout(t);
      if (r && r.ok) text = await r.text();
    } catch { text = ""; }
    if (!text) return { data: [], summary: "changes.txt could not be read from the site just now; skipped." };
    const lines = text.split("\n").filter(l => /^\d{4}-\d{2}-\d{2}\s*\|/.test(l)).slice(0, n);
    return { data: lines, summary: lines.length + " recent change line(s) read." };
  };

  tools.siteSearch = async (args) => {
    const q = String((args && args.q) || "").trim().toLowerCase();
    if (!q) return { data: [], summary: "no search text given." };
    const idx = readJSON("assets/search-index.json");
    if (!idx) return { data: [], summary: "the search index is not on this deployment." };
    const hits = [];
    for (const w of (idx.w || [])) if (String(w.t || "").toLowerCase().includes(q) || String(w.s || "").toLowerCase().includes(q))
      hits.push({ title: w.t, url: "/dictionary/" + w.i, summary: w.s });
    for (const r of (idx.r || [])) if (String(r.t || "").toLowerCase().includes(q) || String(r.s || "").toLowerCase().includes(q))
      hits.push({ title: r.t, url: r.u, summary: r.s });
    for (const e of (idx.e || [])) if (String(e.t || "").toLowerCase().includes(q) || String(e.s || "").toLowerCase().includes(q))
      hits.push({ title: e.t, url: e.u, summary: e.s });
    return { data: hits.slice(0, 20), summary: hits.length + " match(es) for \"" + q + "\", " + Math.min(hits.length, 20) + " shown." };
  };

  tools.playbook = async (args) => {
    const r = playbookLookup(args && args.topic);
    return { data: r, summary: r.matched + " of " + r.of + " principle(s) matched." };
  };

  tools.jev = async (args) => {
    const text = String((args && args.text) || "");
    if (!text.trim()) return { data: { pass: true, gate: "unavailable", why: "no text given" }, summary: "no draft handed to Jev." };
    /* Jev is a model call, so its own inputs get the same wall the router
       gives every message before it is sent: refused outright, never
       redacted-and-sent, if either carries a journal marker or a secret
       shape scrub() knows. */
    const sText = scrub(text), sCtx = scrub(String((args && args.ctx) || ""));
    if (!sText.ok || !sCtx.ok) {
      return { data: { pass: false, gate: "refused", why: (sText.ok ? sCtx.reason : sText.reason) },
        summary: "Jev refused this text before it reached a model.", modelCall: false };
    }
    const r = await jevJudge((args && args.kind) || "question", sText.text, { q: sCtx.text }, { req });
    return { data: r, summary: "Jev: " + r.gate + (r.reasons && r.reasons.length ? " (" + r.reasons.join("; ") + ")" : "") + ".", modelCall: true };
  };

  /* the Lantern's own state, read the way the Home reads it (api/_home.js
     lanternState): the brief, the decisions, Done, Next, the goals with
     their trajectories, the ideas, what its actions did, the playbook */
  tools.lantern = async () => {
    const s = await lanternState();
    const count = (n, one, many) => n === 1 ? "1 " + one : n + " " + many;
    return { data: s, summary: "the Lantern is " + (s.status === "needs-you" ? "waiting on " + count((s.decisions || []).length, "decision", "decisions") + " of yours" : s.status)
      + ", " + ((s.next || []).length ? count(s.next.length, "step", "steps") + " next" : "nothing next") + (s.brief ? ", the brief of " + s.brief.date : ", no brief yet") + "." };
  };

  /* the two autonomous actions (3 October 2026): through the Lantern's
     hands (insights-refresh, reconcile-teach), judged by the council, in the
     one ledger; the hands call the same doors the console's buttons use */
  tools.action_refresh_insights = async (args, ctx) => {
    const r = await lanternAct({ action: "insights-refresh", args: {}, why: (ctx && ctx.why) || "the owner asked in the conversation for the networks' numbers to be read again" }, ctx || {});
    return { ok: r.ok, actionId: r.actionId, undo: r.undo, error: r.error ? plain(r.error) : null, refused: r.refused };
  };
  tools.action_reconcile_teach = async (args, ctx) => {
    const network = String((args && args.network) || "").trim();
    if (!network) return { ok: false, error: "which network?" };
    const r = await lanternAct({ action: "reconcile-teach", args: { network }, why: (ctx && ctx.why) || "the owner asked in the conversation for the duplicate guard to learn what " + network + " holds" }, ctx || {});
    return { ok: r.ok, actionId: r.actionId, undo: r.undo, error: r.error ? plain(r.error) : null, refused: r.refused };
  };
  tools.action_undo_reconcile_teach = async (undo) => revertTaught(undo && undo.keys);

  /* the exact inverse of an approved lineup-change: put the prior override
     back, byte for byte -- the same at, by and note it always carried,
     never a fresh stamp -- or clear the slot (there was none before), and
     only when the slot still carries exactly what this approval itself set
     (its own `after`, compared by at and by: the two fields anything else
     that touched the slot since could not help but change). A slot already
     sent, or changed again since by another approval or the console's own
     Change control, refuses rather than guessing which of two decisions the
     owner actually wants undone (2026-09-26 review: the old version always
     re-stamped a restored entry and always cleared unconditionally, either
     of which could silently discard a decision made after this one). */
  tools.action_undo_lineup_change = async (undo) => {
    const date = String((undo && undo.date) || ""), slot = String((undo && undo.slot) || "");
    if (!date || !slot) return { ok: false, error: "nothing to undo: no date or slot on this entry" };
    const after = undo && undo.after;
    if (!after)
      return { ok: false, error: "this entry carries nothing to compare against; undo it in the Posts room" };
    /* the raw read, not the safe one, for BOTH branches below: a fault here
       must refuse the undo outright, never answer "nothing there" and mark
       it undone while the override still stands (2026-09-26 review, third
       finding -- the clear branch alone used to do this). */
    let current;
    try { current = await getOverrideRaw(date, slot); }
    catch { return { ok: false, error: "the store could not be read, so nothing was undone" }; }
    if (!current) return { ok: true, cleared: true, note: "there was nothing left to clear" };
    /* the slot must still hold exactly what THIS approval wrote (its own at
       and by) before either putting the prior entry back or clearing it --
       checked here, once, ahead of both branches, so a later console change
       (a hand-set swap or skip, or a different approval) is never silently
       overwritten by an undo that has nothing to do with it. Before this
       review's third finding, the restore branch skipped this check
       entirely: it trusted `before` and wrote it back regardless of what
       the slot held by the time the undo ran. */
    if (current.at !== after.at || current.by !== after.by)
      return { ok: false, error: "the slot was changed again since; undo it in the Posts room" };
    const before = undo && undo.before;
    if (before) {
      const r = await restoreOverride({ date, slot, entry: before });
      return r.ok ? { ok: true, restored: before } : { ok: false, error: r.error };
    }
    const r = await clearOverride({ date, slot });
    return r.ok ? { ok: true, cleared: true } : { ok: false, error: r.error };
  };

  /* the one place every tool's own data passes through humanizeIds, so a
     tool added here next gets the same guarantee without anyone having to
     remember it; an action's own return (no `data` field) passes through
     untouched. */
  for (const name of Object.keys(tools)) {
    const fn = tools[name];
    tools[name] = async (...args) => {
      const r = await fn(...args);
      return (r && typeof r === "object" && "data" in r) ? { ...r, data: humanizeIds(r.data) } : r;
    };
  }

  return tools;
}

export { humanizeIds, buildTools };

/* ---------------------------------------------------------------------------
   THE LEDGER. One list, newest first, and a per-day counter that resets by
   the date's own key rather than a cron -- the same idiom the router's own
   rate limiter keeps (api/_llm.js's rlKey), so nothing has to remember to
   reset anything.
--------------------------------------------------------------------------- */
const K_ACTIONS = "nlan:actions";
const K_PROPOSALS = "nlan:proposals";
const ACTIONS_KEEP = 200;
const dayStr = () => new Date().toISOString().slice(0, 10);
const K_COUNT = d => "nlan:actions:count:" + d;

/* THE CAP FAILS CLOSED (2026-09-24 review). reserve() is the count: an
   INCR against today's key, checked against the cap by its own return
   value, so two runs racing each other can never both read "4 of 5" and
   both proceed to a sixth -- the read and the reservation are the same
   write. release() (a DECR) gives the slot back when the action itself
   then fails, so a failed action never spends a day's own slot. Neither
   method is a courtesy the way the old append()'s own INCR was: when the
   store cannot be reached, reserve() answers { ok:false }, and
   api/_agent.js's runAction() reads that as "no ledger available" and
   refuses to act rather than defaulting to zero and running anyway, which
   is what counting only on a successful read used to do. */
function makeLedger() {
  return {
    newId: () => dayStr().replace(/-/g, "") + "-" + crypto.randomBytes(4).toString("hex"),
    countToday: async () => {
      if (!kvReady()) return null;
      try { const r = await kv([["GET", K_COUNT(dayStr())]]); return parseInt(r[0] || "0", 10) || 0; } catch { return null; }
    },
    reserve: async () => {
      if (!kvReady()) return { ok: false, count: null };
      try {
        const r = await kv([["INCR", K_COUNT(dayStr())], ["EXPIRE", K_COUNT(dayStr()), "172800"]]);
        return { ok: true, count: parseInt(r[0], 10) || 0 };
      } catch { return { ok: false, count: null }; }
    },
    release: async () => {
      if (!kvReady()) return;
      try { await kv([["DECR", K_COUNT(dayStr())]]); } catch { }
    },
    record: async (entry) => {
      /* an act the Lantern's hands ran is already in the one ledger
         (nsoul:action:<id>); it is never written twice */
      if (!kvReady() || (entry && entry.unified)) return;
      try { await kv([["LPUSH", K_ACTIONS, JSON.stringify(entry)], ["LTRIM", K_ACTIONS, "0", String(ACTIONS_KEEP - 1)]]); } catch { }
    }
  };
}
/* THE ONE LEDGER, as this room has always read its own (3 October 2026):
   every act of the Lantern's hands (the daily cycle's, the conversation's,
   the owner's own buttons), newest first, in the shape the console's older
   room draws: who, what, args, why, before, undo, at, ok, undone */
const LEGACY_WHAT = { "insights-refresh": "refresh-insights", "reconcile-teach": "reconcile-teach", "lineup-skip": "lineup-change", "lineup-swap": "lineup-change" };
function legacyShape(e) {
  const u = e.undo || {};
  const who = e.approval && e.approval.owner ? "lantern (owner approved)" : e.actor === "soul" ? "lantern (daily cycle)" : "lantern";
  return { id: e.id, who, what: LEGACY_WHAT[e.hand] || e.hand, hand: e.hand, title: actionTitle(e), args: e.args || {}, why: plain(e.why || ""),
    before: u.kind === "lineup-revert" ? (u.before || null) : null, ...(u.kind === "lineup-revert" ? { after: u.after || null } : {}),
    undo: e.undo || null, at: e.at, ok: !!e.ok, ...(e.error ? { error: plain(e.error) } : {}), undone: !!e.undone, ...(e.undoneAt ? { undoneAt: e.undoneAt } : {}), unified: true };
}
async function unifiedLedger(n) {
  if (!kvReady()) return [];
  try { return (await actionsList(n)).filter(e => e && e.id && e.tier !== "R0").map(legacyShape); } catch { return []; }
}
async function ledgerList(n) {
  if (!kvReady()) return [];
  try {
    const r = await kv([["LRANGE", K_ACTIONS, "0", String(Math.max(0, n - 1))]]);
    return (r[0] || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}
/* marks a logged action undone in place (an LSET on its own index in the
   list), so a second attempt at the same id can be refused before it ever
   replays a revert the store no longer needs, and the console can grey the
   row out and take its Undo button away. Silent on a store fault, the same
   as every other ledger write here: a courtesy that cannot itself block
   the undo that already succeeded. */
async function ledgerMarkUndone(id) {
  if (!kvReady()) return;
  try {
    const r = await kv([["LRANGE", K_ACTIONS, "0", String(ACTIONS_KEEP - 1)]]);
    const raw = r[0] || [];
    const idx = raw.findIndex(s => { try { return JSON.parse(s).id === id; } catch { return false; } });
    if (idx === -1) return;
    const entry = JSON.parse(raw[idx]);
    entry.undone = true; entry.undoneAt = new Date().toISOString();
    await kv([["LSET", K_ACTIONS, String(idx), JSON.stringify(entry)]]);
  } catch { }
}
async function proposalsAppend(p) {
  if (!kvReady()) return p;
  try { await kv([["LPUSH", K_PROPOSALS, JSON.stringify(p)], ["LTRIM", K_PROPOSALS, "0", "99"]]); } catch { }
  return p;
}
async function proposalsList() {
  if (!kvReady()) return [];
  try {
    const r = await kv([["LRANGE", K_PROPOSALS, "0", "99"]]);
    return (r[0] || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}
async function proposalsSet(list) {
  if (!kvReady()) return;
  try { const cmds = [["DEL", K_PROPOSALS]]; if (list.length) cmds.push(["RPUSH", K_PROPOSALS, ...list.map(p => JSON.stringify(p))]); await kv(cmds); } catch { }
}

/* ---------------------------------------------------------------------------
   THREAD MEMORY. Last 12 turns pass through to the agent verbatim
   (api/_agent.js's own summariseThread folds anything older); a new thread
   is simply an id the console has not asked for before, so nothing here
   needs to know whether one is new. Kept 30 days, the same order as the
   router's own remembered-good-model keys.
--------------------------------------------------------------------------- */
const K_THREAD = id => "nlan:thread:" + id;
async function threadRead(id) {
  if (!id || !kvReady()) return [];
  try { const r = await kv([["GET", K_THREAD(id)]]); const v = r[0]; return v ? JSON.parse(v) : []; } catch { return []; }
}
async function threadWrite(id, turns) {
  if (!id || !kvReady()) return;
  const kept = turns.slice(-24);
  try { await kv([["SET", K_THREAD(id), JSON.stringify(kept)], ["EXPIRE", K_THREAD(id), String(30 * 86400)]]); } catch { }
}

/* ---------------------------------------------------------------------------
   SSE
--------------------------------------------------------------------------- */
function sseStart(res) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();
}
function sseWrite(res, type, data) {
  try { res.write("event: " + type + "\ndata: " + JSON.stringify(data == null ? {} : data) + "\n\n"); } catch { }
}

async function readBody(req) {
  let body = req.body;
  if (body === undefined || body === null || body === "") {
    body = await new Promise(resolve => {
      let s = "";
      try {
        req.on("data", c => { s += c; if (s.length > 20000) s = s.slice(0, 20000); });
        req.on("end", () => resolve(s));
        req.on("error", () => resolve(""));
      } catch { resolve(""); }
    });
  }
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  return body || {};
}

/* ---------------------------------------------------------------------------
   APPROVE / DECLINE / UNDO
--------------------------------------------------------------------------- */
/* THE PROPOSAL IS A DECISION (3 October 2026, LANTERN.md section 3). This
   door still answers the console's older Approve button, by deciding the
   proposal's own card on the owner's Home: made now from the proposal when
   the conversation that made it ran before decisions existed. Yes runs the
   hand with his approval (api/_hands.js runHand: the red lines, pause, the
   caps and the audit all still apply, and the act is in the one ledger); a
   vague proposal's Yes is recorded, as it always was. */
async function proposalDecision(p) {
  const key = "proposal:" + String(p.id || "");
  let found = null;
  try { found = await DEC.findByKey(key); } catch { found = null; }
  if (found) return found;
  const up = await DEC.upsert(DEC.fromProposal(p));
  if (!up || !up.ok) return { error: (up && (up.error || up.suppressed)) || "the decision could not be made" };
  return { open: true, decision: { id: up.id } };
}
async function handleApprove(res, body) {
  const id = String(body.id || "");
  const list = await proposalsList();
  const p = list.find(x => x && x.id === id);
  if (!p) return json(res, 404, { ok: false, error: "no such proposal" });
  const found = await proposalDecision(p);
  if (found.error) return json(res, 200, { ok: false, error: plain(found.error), message: "Not done: " + plain(found.error) + "." });
  if (!found.open) {
    await proposalsSet(list.filter(x => x.id !== id));
    return json(res, 200, { ok: false, error: "this proposal was already answered on the Home (" + found.decision.status + ")", message: "That was already answered on the Home." });
  }
  const r = await DEC.decide(found.decision.id, "yes", { actor: "owner" });
  if (r.ok && r.executed === true) {
    const e = r.entry || {};
    const u = e.undo || {};
    const entry = { id: e.id || r.actionId, who: "lantern (owner approved)", what: p.requested === "lineup-change" ? "lineup-change" : (p.type || e.hand), hand: e.hand,
      args: p.args || e.args || {}, why: p.why || e.why || "", before: u.kind === "lineup-revert" ? (u.before || null) : null,
      ...(u.kind === "lineup-revert" ? { after: u.after || null } : {}), undo: e.undo || null, at: e.at || new Date().toISOString(), ok: true, unified: true };
    await proposalsSet(list.filter(x => x.id !== id));
    return json(res, 200, { ok: true, executed: true, entry, decision: found.decision.id, message: r.message });
  }
  if (r.ok) {
    await proposalsSet(list.map(x => x.id === id ? { ...x, decision: "approved", decidedAt: new Date().toISOString() } : x));
    return json(res, 200, { ok: true, executed: false, note: "recorded. " + (p.description || ""), decision: found.decision.id, message: r.message });
  }
  return json(res, 200, { ok: false, error: plain(String(r.message || "it refused").replace(/^Not done: /, "").replace(/\. The card stays open\.$/, "")), message: r.message, decision: found.decision.id });
}
async function handleDecline(res, body) {
  const id = String(body.id || "");
  const list = await proposalsList();
  if (!list.some(x => x && x.id === id)) return json(res, 404, { ok: false, error: "no such proposal" });
  /* its card on the Home, when it has one, is answered No */
  try { const f = await DEC.findByKey("proposal:" + id); if (f && f.open) await DEC.decide(f.decision.id, "no", { actor: "owner" }); } catch { }
  await proposalsSet(list.filter(x => x.id !== id));
  return json(res, 200, { ok: true, declined: id, message: "Declined." });
}
async function handleUndo(res, body) {
  const id = String(body.id || "");
  /* the one ledger first (3 October 2026): an act of the Lantern's hands is
     undone by its own hand's exact recipe (api/_hands.js undoAction), which
     refuses a second undo and a slot changed since */
  let mine = null;
  if (kvReady()) { try { mine = (await actionsList()).find(x => x && x.id === id) || null; } catch { mine = null; } }
  if (mine) {
    const r = await undoHand(id, "owner");
    return json(res, 200, { ...r, ok: !!r.ok, ...(r.error ? { error: plain(r.error) } : {}), ...(r.note ? { note: plain(r.note) } : {}) });
  }
  const list = await ledgerList(ACTIONS_KEEP);
  const entry = list.find(x => x && x.id === id);
  if (!entry) return json(res, 404, { ok: false, error: "no such logged action" });
  /* the server itself refuses a second undo of the same entry, not only
     the console's own greyed-out button: undoAction() (api/_agent.js)
     checks entry.undone too, for a caller with no HTTP layer in front of
     it at all, but this is the door a second click actually reaches. */
  if (entry.undone) return json(res, 200, { ok: false, error: "this action was already undone" });
  const tools = buildTools({ headers: {} });
  const r = await undoAction(entry, tools);
  if (r.ok) await ledgerMarkUndone(id);
  return json(res, 200, { ok: r.ok, ...r });
}

/* ---------------------------------------------------------------------------
   THE STREAMED ASK
--------------------------------------------------------------------------- */
async function handleAsk(req, res, body) {
  const message = String(body.message || "").slice(0, 2000);
  if (!message.trim()) return json(res, 400, { ok: false, error: "say what you want to ask" });
  const threadId = String(body.thread || "").trim() || (dayStr() + "-" + crypto.randomBytes(4).toString("hex"));
  const prior = await threadRead(threadId);

  sseStart(res);
  sseWrite(res, "start", { thread: threadId, budgets: BUDGETS });

  /* the request, so the council's sentinel (Jev, through Vercel's AI
     Gateway) can find this deployment's OIDC token */
  setRequest(req);
  const tools = buildTools(req);
  const ledger = makeLedger();

  /* a proposal gets its id and is SAVED before it is ever streamed, not
     after the whole run finishes (fixed 2026-09-24: the old code streamed
     the bare object api/_agent.js built, with no id on it at all, since an
     id was only assigned afterwards in a loop below that ran once runAgent
     had already returned -- so the console had nothing an Approve button
     could post, and a function killed mid-run between the stream and that
     loop would lose the proposal outright). emit() is awaited everywhere
     api/_agent.js calls it, so this write finishes before the run moves
     on to whatever step comes after it. */
  const emit = async (type, data) => {
    if (type === "proposal") {
      const withId = { id: crypto.randomBytes(6).toString("hex"), at: new Date().toISOString(), ...data };
      await proposalsAppend(withId);
      /* and a card on the owner's Home (3 October 2026): the proposal is
         one of his decisions now, answered there or by Approve here */
      try { const d = await DEC.upsert(DEC.fromProposal(withId)); if (d && d.ok) withId.decision = d.id; } catch { }
      sseWrite(res, type, withId);
      return;
    }
    sseWrite(res, type, data);
  };

  /* round four: the owner's own "think deeply" pays for one synthesis */
  const { route: routeFor, paidCalls } = askRoute(message, llmRoute);
  let out;
  try {
    out = await runAgent({ message, thread: prior, tools, route: routeFor, emit, scrub, ledger, hands: handsFor() });
  } catch (e) {
    sseWrite(res, "error", { error: String(e && e.message || e).slice(0, 300) });
    try { res.end(); } catch { }
    return;
  }

  const turns = prior.concat([{ role: "user", content: message, at: new Date().toISOString() },
                               { role: "assistant", content: out.answer, at: new Date().toISOString() }]);
  await threadWrite(threadId, turns);
  /* round four: what the paid answer led to, in the ROI ledger */
  for (const r of paidCalls) {
    if (!r.paidId) continue;
    const used = !!(out.answer && r.content && out.answer.length > 40 && !/^Here is what could be read without/.test(out.answer));
    try { await paidOutcome(r.paidId, { helped: used, note: used ? "its answer was the one the owner read in Ask" : "its answer could not be used" }); } catch { }
  }

  /* the answer streams BEFORE the artifacts, not after: a malformed or
     refused artifact (both handled inside runAgent's own schema check
     now, api/_agent.js's validateArtifact) must never cost the owner the
     answer itself, which is the one thing this whole run was for. */
  sseWrite(res, "token", { text: out.answer });
  for (const a of (out.artifacts || [])) sseWrite(res, "artifact", a);
  sseWrite(res, "done", { thread: threadId, notCompleted: out.notCompleted, exhausted: out.exhausted, modelCalls: out.modelCalls, toolCalls: out.toolCalls });
  try { res.end(); } catch { }
}

/* round four: the owner's own words asking for depth, and nothing else.
   Review fix, 7 October 2026: "think deeply" or "think hard" only as a whole
   order, where the message begins ("Think deeply about why reach fell",
   "Please think hard: ...") or ends ("... Think hard.", "..., and think
   deeply"), never inside a question that only uses the words ("do you think
   deep dives ...", "think harder topics", "think hard-working parents") */
export const THINK_DEEPLY_RX = new RegExp(String.raw`^\s*(?:please[\s,]+)?think\s+(?:deeply|hard)(?![\w-])`
  + String.raw`|(?:^|[.:!,;?\n]|\band)\s*(?:please[\s,]+)?think\s+(?:deeply|hard)(?:[\s,]+please)?\s*[.!?]*\s*$`, "i");
export function thinkDeeply(message) { return THINK_DEEPLY_RX.test(String(message || "")); }
/* the run's router: the base one, unless he asked for depth, and then the
   one synthesis (the strong, JSON call the answer is written by) goes to the
   deep tier under the "ask-deep" use, with time to think; the plan and the
   subagents stay free. paidCalls holds what was paid for. */
export function askRoute(message, base) {
  const paidCalls = [];
  if (!thinkDeeply(message)) return { route: base, paidCalls, deep: false };
  let asked = false;
  const route = async task => {
    if (task && task.tier === "strong" && task.json && !asked) {
      asked = true;
      const r = await base({ ...task, tier: "deep", purpose: "ask-deep", opts: { ...(task.opts || {}), timeout: Math.max(Number(task.opts && task.opts.timeout) || 0, 25000) } });
      if (r && r.paid) paidCalls.push(r);
      return r;
    }
    return base(task);
  };
  return { route, paidCalls, deep: true };
}

/* ---------------------------------------------------------------------------
   THE ROUTE
--------------------------------------------------------------------------- */
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const gate = ownerGate(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.reason });

  if (req.method === "GET") {
    const action = String((req.query || {}).action || "");
    if (action === "ledger") {
      const ledger = makeLedger();
      /* the one ledger (3 October 2026) and what this room kept before it,
         newest first, in the shape the console has always drawn */
      const [mine, older, countToday] = await Promise.all([unifiedLedger(30), ledgerList(30), ledger.countToday()]);
      const items = mine.concat(older).sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))).slice(0, 30);
      /* countToday() answers null when the store could not be read (see
         makeLedger's own header): shown here as 0 for a plain display,
         since the console's own room already says plainly when the store
         itself is down elsewhere, and this number failing closed (never
         acting) matters far more than this number reading correctly on a
         screen nobody is gated by */
      return json(res, 200, { ok: true, items, countToday: countToday == null ? 0 : countToday, cap: AUTONOMOUS_DAILY_CAP });
    }
    if (action === "proposals") return json(res, 200, { ok: true, items: await proposalsList() });
    return json(res, 400, { ok: false, error: "unknown action" });
  }

  if (req.method !== "POST") return json(res, 405, { ok: false, error: "POST only" });
  /* the agent still answers without a store: no thread memory, no ledger
     persistence across requests, and (fixed 2026-09-24, the cap failing
     closed rather than open) no autonomous action either, since reserving
     a slot in a ledger that cannot be read always answers { ok:false } and
     api/_agent.js's runAction() reads that as "refuse", never as zero
     spent today. Reading and answering is the one thing that still works
     exactly as it does with a store; acting alone is the one thing this
     build deliberately trades away rather than guess about. */
  const body = await readBody(req);
  if (body.action === "approve") return handleApprove(res, body);
  if (body.action === "decline") return handleDecline(res, body);
  if (body.action === "undo") return handleUndo(res, body);
  return handleAsk(req, res, body);
}
