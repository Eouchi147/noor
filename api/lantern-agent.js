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
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ownerGate } from "./_owner.js";
import { kv, kvReady } from "./_kv.js";
import { route as llmRoute, scrub } from "./_llm.js";
import { runAgent, undoAction, buildProposal, ACTION_TYPES, AUTONOMOUS_DAILY_CAP, BUDGETS } from "./_agent.js";
import { playbookLookup } from "./_playbook.js";
import { cached as observatoryCached, readCache as observatoryReadCache, slotLabel } from "./observatory.js";
import { read as insightsRead, numbers as insightsNumbers, refresh as insightsRefresh, snapshot as insightsSnapshot, kindLabel } from "./_insights.js";
import { computeVisitors } from "./visitors.js";
import { reconcile as socialReconcile, teachGuard as socialTeachGuard, readSlot, revertTaught } from "./social.js";
import { chooseReel, SLOTS, REEL_SLOTS, SLOT_IDS } from "./_schedule.js";
import { EXPERIMENTS, readState as expReadState, resolveCurrent as expResolveCurrent, evaluate as expEvaluate, biasFromAny as expBiasFromAny } from "./_experiments.js";
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
      for (const s of SLOTS.filter(x => x.reel)) {
        const c = chooseReel(cards, d, s.reel, null, null, bias);
        out.push({ date: d, slot: s.id, hour: s.at, half: s.reel, card: c ? { id: c.id, kind: c.kind, hook: c.hook } : null });
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

  /* the two autonomous actions, wired to the exact doors the console's own
     buttons already use -- never a new write path */
  tools.action_refresh_insights = async () => {
    const manifest = await PAGE.manifest();
    const ref = await insightsRefresh(14, { manifest });
    const snap = await insightsSnapshot({ manifest, force: true, days: 14 });
    return { ok: !!(ref.ok || snap.ok), refresh: ref, snapshot: snap };
  };
  tools.action_reconcile_teach = async (args) => {
    const network = String((args && args.network) || "").trim();
    if (!network) return { ok: false, error: "which network?" };
    const r = await socialTeachGuard(network, HOST(), { date: args && args.date, days: args && args.days });
    if (!r.ok) return { ok: false, error: r.why || "could not teach the guard" };
    return {
      ok: true, network, written: r.written, known: r.known, taught: r.taught,
      undo: { kind: "reconcile-teach-revert", keys: (r.taught || []).map(t => ({ reel: t.reel, network, before: t.before || null })) }
    };
  };
  tools.action_undo_reconcile_teach = async (undo) => revertTaught(undo && undo.keys);

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

export { humanizeIds };

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
      if (!kvReady()) return;
      try { await kv([["LPUSH", K_ACTIONS, JSON.stringify(entry)], ["LTRIM", K_ACTIONS, "0", String(ACTIONS_KEEP - 1)]]); } catch { }
    }
  };
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
async function handleApprove(res, body) {
  const id = String(body.id || "");
  const list = await proposalsList();
  const p = list.find(x => x && x.id === id);
  if (!p) return json(res, 404, { ok: false, error: "no such proposal" });
  /* only a proposal whose own type is one of the safe autonomous actions
     can be executed by approving it; everything else (a lineup change
     above all) has no endpoint to run, so approving only records the
     owner's decision and the console shows what to open by hand */
  if (ACTION_TYPES.includes(p.type)) {
    const tools = buildTools({ headers: {} });
    const ledger = makeLedger();
    /* the same atomic reserve-then-act the autonomous path uses
       (api/_agent.js's runAction): approving a proposal is another door
       onto the same daily cap, and it fails closed the same way. */
    const reserved = await ledger.reserve();
    if (!reserved.ok || reserved.count == null || reserved.count > AUTONOMOUS_DAILY_CAP) {
      if (reserved.ok) await ledger.release();
      return json(res, 200, { ok: false, error: reserved.ok
        ? "the daily limit of " + AUTONOMOUS_DAILY_CAP + " autonomous actions has already been reached today; try again tomorrow"
        : "the daily action ledger could not be read right now, so nothing runs on its own until it can be" });
    }
    const fn = tools["action_" + p.type.replace(/-/g, "_")];
    if (typeof fn !== "function") { await ledger.release(); return json(res, 200, { ok: false, error: "no handler wired for " + p.type }); }
    let result;
    try { result = await fn(p.args || {}); }
    catch (e) { await ledger.release(); return json(res, 200, { ok: false, error: String(e && e.message || e).slice(0, 200) }); }
    if (!result || result.ok === false) await ledger.release();
    const entry = { id: ledger.newId(), who: "lantern (owner approved)", what: p.type, args: p.args || {}, why: p.why || "",
      before: result && result.before != null ? result.before : null, undo: result && result.undo, at: new Date().toISOString(), ok: !!(result && result.ok) };
    await ledger.record(entry);
    await proposalsSet(list.filter(x => x.id !== id));
    return json(res, 200, { ok: true, executed: true, entry });
  }
  await proposalsSet(list.map(x => x.id === id ? { ...x, decision: "approved", decidedAt: new Date().toISOString() } : x));
  return json(res, 200, { ok: true, executed: false, note: "recorded. " + (p.description || "") });
}
async function handleDecline(res, body) {
  const id = String(body.id || "");
  const list = await proposalsList();
  if (!list.some(x => x && x.id === id)) return json(res, 404, { ok: false, error: "no such proposal" });
  await proposalsSet(list.filter(x => x.id !== id));
  return json(res, 200, { ok: true, declined: id });
}
async function handleUndo(res, body) {
  const id = String(body.id || "");
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
      sseWrite(res, type, withId);
      return;
    }
    sseWrite(res, type, data);
  };

  let out;
  try {
    out = await runAgent({ message, thread: prior, tools, route: llmRoute, emit, scrub, ledger });
  } catch (e) {
    sseWrite(res, "error", { error: String(e && e.message || e).slice(0, 300) });
    try { res.end(); } catch { }
    return;
  }

  const turns = prior.concat([{ role: "user", content: message, at: new Date().toISOString() },
                               { role: "assistant", content: out.answer, at: new Date().toISOString() }]);
  await threadWrite(threadId, turns);

  /* the answer streams BEFORE the artifacts, not after: a malformed or
     refused artifact (both handled inside runAgent's own schema check
     now, api/_agent.js's validateArtifact) must never cost the owner the
     answer itself, which is the one thing this whole run was for. */
  sseWrite(res, "token", { text: out.answer });
  for (const a of (out.artifacts || [])) sseWrite(res, "artifact", a);
  sseWrite(res, "done", { thread: threadId, notCompleted: out.notCompleted, exhausted: out.exhausted, modelCalls: out.modelCalls, toolCalls: out.toolCalls });
  try { res.end(); } catch { }
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
      const [items, countToday] = await Promise.all([ledgerList(30), ledger.countToday()]);
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
