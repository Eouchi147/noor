// NOOR · the Lantern agent: the orchestrator.
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
//
// Every free model call in this house until now answered one question
// (the day's light, the Verse Lamp, a caption) from material handed to it
// whole. The owner asked for something that plans a request, calls the
// house's own tools, hands parts to specialist subagents, and answers with
// grounded numbers, in the console, on its own initiative within fixed
// limits. That is a different shape of thing: it has to decide what to do
// before it does it, and it has to be caught if it invents a number nobody
// gave it.
//
// This file is pure and holds no import of a model, a store or a network.
// Every dependency (the router, the tools, a ledger) is injected as a
// parameter, so the whole orchestration -- planning, budgets, tool calls,
// subagents, the critic, actions and proposals -- can be tested with a
// stub router and stub tools and no network at all (tests/agent.mjs). The
// wiring to the real router (api/_llm.js), the real tools (reading the
// Observatory, the shelf, the package builder) and the real store lives in
// api/lantern-agent.js, which is deliberately thin.
//
// THE HARD BUDGETS, so a plan can never run away with the day's free
// allowance or the request's own clock: at most 8 steps, 10 model calls,
// 120 seconds of wall time, on top of whatever the router's own per-provider
// buckets already refuse. On exhaustion the agent answers with what it has
// and says plainly what it could not do; it never fails silently and never
// asks for another turn to finish something it started. A fresh model call
// is also refused once fewer than MODEL_CALL_MARGIN_MS remain, not only
// once the clock reads zero: a call already 9 seconds from timing out on
// its own has no room left to answer, be checked by the critic, and still
// leave the HTTP layer time to close the stream inside its own deploy
// limit (vercel.json's maxDuration, kept with a margin over this file's
// own maxWallMs for exactly this reason).
//
// THE THREE FIXED LIMITS ON ACTING ALONE, exactly the owner's three: refresh
// the network numbers, teach the duplicate guard from a reconciliation, and
// reorder or skip a reel within the same day's line-up for a slot not yet
// sent. The third has no existing, safe, already-honoured mechanism:
// api/overrides.js is a text patch for site copy, unrelated to which reel a
// slot sends, and api/_schedule.js's own `pin` argument is an internal
// repair path the poster uses to correct drift on an ALREADY SENT slot, not
// an owner-facing door to choose a reel ahead of time. Inventing one here
// would be building a new, untested write path into the poster under an
// agent's own steam, which is exactly what "do not invent one" forbids. So
// only two action types exist (ACTION_TYPES below); anything else, lineup
// changes above all, is always a proposal, never an autonomous action.
//
// THE DAILY CAP FAILS CLOSED. Counting today's actions is not a courtesy
// read: it is INCR first (api/lantern-agent.js's ledger.reserve()), which
// reserves a slot the same instant it counts one, so two runs racing each
// other can never both read "4 of 5" and both proceed to a sixth. If the
// action itself then fails, or if there is no ledger to reserve a slot in
// at all (the store is down, or a caller handed none), nothing runs: a
// slot this house cannot remember spending is a slot it does not spend.
// ---------------------------------------------------------------------------

import { HOUSE_RULES, PRINCIPLES, rolePrompt, playbookLookup } from "./_playbook.js";

export const BUDGETS = { maxSteps: 8, maxModelCalls: 10, maxWallMs: 120000 };
/* no fresh model call starts once less than this remains: chatOnce's own
   timeout (api/_llm.js) can run to 9 seconds, and the critic, the artifact
   write and the HTTP close still need to happen after the last one returns */
const MODEL_CALL_MARGIN_MS = 12000;

/* the tools a plan step may name; each is a deterministic, read-only call
   with no model inside it (api/lantern-agent.js wires the real readers) --
   with the one named exception below */
export const TOOL_NAMES = [
  "observatory", "insights", "numbers", "visitors", "reconcileRead", "package",
  "graph", "shelf", "lineup", "slots", "recentChanges", "siteSearch", "playbook", "jev"
];
/* "jev" is the one tool that is not deterministic and not free: api/_jev.js
   judges a piece of text with a model call of its own, over the house's
   existing Vercel AI Gateway use (free, the same gateway every other judged
   call in this house already rides). Every other name above never reaches
   a model. Because jev does, api/lantern-agent.js's own tools.jev runs the
   text through the router's scrub() before it is sent, exactly as a
   subagent's own tool output is guarded below, and the step loop counts a
   jev call against modelCalls the same as it counts a subagent, so the
   10-call budget is never quietly spent past by a tool that looks free but
   is not. */
const MODEL_TOOL_NAMES = ["jev"];

/* the subagent roles a plan step may name; each is one route() call at the
   tier api/_playbook.js's rolePrompt() and this file's roleTier() agree on */
export const SUBAGENT_ROLES = ["analyst", "strategist", "writer", "critic"];
const ROLE_TIER = { analyst: "strong", strategist: "strong", writer: "strong", critic: "fast" };
export const roleTier = role => ROLE_TIER[role] || "fast";

/* the only two things this agent may ever do without a yes from the owner.
   Reordering or skipping a reel is deliberately absent -- see the file
   header -- and any plan step naming it, or anything else, becomes a
   proposal, never an autonomous action. */
export const ACTION_TYPES = ["refresh-insights", "reconcile-teach"];
export const AUTONOMOUS_DAILY_CAP = 5;

const DASH_RX = new RegExp("[" + String.fromCharCode(0x2014, 0x2013) + "]", "g");
const nowMs = clock => (typeof clock === "function" ? clock() : Date.now());
/* every emit() call below is awaited: the default is a synchronous no-op,
   which await simply resolves at once, but the caller's own emit (built in
   api/lantern-agent.js) assigns a proposal its id and saves it to the
   store BEFORE the event goes out on the wire, and that write has to
   finish before this file moves on, or a function killed between the two
   could stream an id the store never got to keep. */

/* ---------------------------------------------------------------------------
   PLAN PARSING: robust to what a real free model actually answers, not only
   to strict JSON (2026-09-24, a live run: nvidia/nemotron-3-ultra-550b-a55b
   on OpenRouter answered with a reasoning preamble around its JSON, and
   parsePlan's own strict-then-largest-brace-run repair could not read it,
   so every question fell to the old one-step fallback). Local text work
   only, in this fixed order -- never a second model call spent repairing
   the first one, since that is exactly the kind of budget leak the
   marching orders name:
     1. strip a <think>...</think> block or a bare reasoning preamble
     2. try the text as-is, then the same text with a code fence's own
        marker lines removed and a trailing comma fixed
     3. extract the FIRST BALANCED {...} or [...] found anywhere in the
        text (a real bracket-depth scan that knows a brace inside a quoted
        string is not a brace, not merely "first { to last }", which a
        model's own trailing prose after the JSON could fool)
     4. the one repair attempt: single quotes turned into double quotes on
        whichever candidate above came closest, tried last
   A bare array of steps ([...] rather than {"steps":[...]}) is accepted as
   the steps list itself. Failing all of that, a safe fallback plan.
--------------------------------------------------------------------------- */
function stripThink(s) {
  /* a <think> block a reasoning model left in, and the common "Sure, here
     is the plan:" preamble before the JSON actually starts; neither is
     JSON, and leaving the preamble in only costs the plain-text parse
     attempt below, since extractBalanced() finds the JSON either way */
  const noThink = String(s || "").replace(/<think>[\s\S]*?<\/think>/gi, " ");
  const m = /[{[]/.exec(noThink);
  return m ? noThink.slice(m.index) : noThink;
}
function stripFence(s) {
  const m = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  return m ? m[1] : s;
}
function dropTrailingCommas(s) {
  return s.replace(/,(\s*[}\]])/g, "$1");
}
/* the first balanced {...} or [...] in the text, honouring a brace or a
   bracket inside a quoted string (single or double: a model that already
   drifted into single-quoted JSON should not also have its own apostrophes
   inside a string value miscounted as structure). Returns null if nothing
   ever opens, or opens and never closes (a truncated answer). */
function extractBalanced(s) {
  const text = String(s || "");
  let start = -1, openCh = "", closeCh = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "{" || c === "[") { start = i; openCh = c; closeCh = c === "{" ? "}" : "]"; break; }
  }
  if (start === -1) return null;
  let depth = 0, inStr = false, quote = "", esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; quote = c; continue; }
    if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}
/* single-quoted JSON, turned into real JSON: a quoted span (single or
   double) is read whole and re-emitted double-quoted with any double quote
   already inside it escaped, rather than a blind global replace of every
   apostrophe, which would just as happily wreck "reelA's own reach" sitting
   inside an already-correct double-quoted string. */
function singleToDoubleQuotes(s) {
  const text = String(s || "");
  let out = "", i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "'" || c === '"') {
      const quote = c;
      let j = i + 1, buf = "";
      while (j < text.length && text[j] !== quote) {
        if (text[j] === "\\" && j + 1 < text.length) { buf += text[j] + text[j + 1]; j += 2; continue; }
        buf += text[j]; j++;
      }
      out += '"' + buf.replace(/\\?"/g, '\\"') + '"';
      i = j + 1;
    } else { out += c; i++; }
  }
  return out;
}
function tryParseAsPlan(t) {
  try {
    const j = JSON.parse(t);
    if (j && Array.isArray(j.steps)) return j;
    if (Array.isArray(j)) return { steps: j };
    return null;
  } catch { return null; }
}
/* returns { steps: [...] } or null if even the repair could not read it */
export function parsePlan(raw) {
  const cleaned = stripThink(String(raw == null ? "" : raw));
  const balanced = extractBalanced(cleaned);
  const tries = [cleaned, dropTrailingCommas(stripFence(cleaned))];
  if (balanced) tries.push(dropTrailingCommas(balanced));
  for (const t of tries) {
    const p = tryParseAsPlan(t);
    if (p) return p;
  }
  /* the one repair attempt beyond plain reading: fix single quotes on
     whichever candidate came closest to real JSON */
  const repaired = dropTrailingCommas(singleToDoubleQuotes(balanced || stripFence(cleaned)));
  return tryParseAsPlan(repaired);
}

/* the safe fallback, no longer one fixed read: which tools it reaches for
   is chosen from plain keywords in the owner's own question, since a plan
   that could not be parsed is not a plan that could not be understood --
   the question itself is still there to read. Observatory always runs
   first (the whole picture, the one thing every question can use), the
   analyst and strategist subagents always run last (a reading needs a
   reader), and whatever the keywords below matched runs between the two.
   Never empty handed, never a guess dressed as a plan. */
export function fallbackPlan(message) {
  const q = " " + String(message || "").toLowerCase() + " ";
  const steps = [{ kind: "tool", name: "observatory", args: {}, why: "the plan could not be read, so this looks at the whole picture first" }];
  const add = (name, args, why) => {
    if (!steps.some(s => s.kind === "tool" && s.name === name && JSON.stringify(s.args) === JSON.stringify(args || {})))
      steps.push({ kind: "tool", name, args: args || {}, why });
  };
  if (/\bkind\b|\bsubject\b|what to post|which (kind|type)/.test(q)) {
    add("insights", {}, "the question asks by kind or subject, which insights breaks down");
    add("numbers", {}, "and the week's own numbers by network");
  }
  if (/\bsite\b|\bvisitors?\b|\breaders?\b/.test(q)) add("visitors", {}, "the question is about the site itself, not one network");
  for (const net of ["facebook", "instagram", "youtube", "threads"]) {
    if (q.includes(net)) {
      add("numbers", {}, "the question names a network, and numbers carries every network's own week");
      add("reconcileRead", { network: net }, "checking " + net + " against the record");
    }
  }
  if (/\bpackage\b|\bdraft\b/.test(q)) add("package", {}, "the question asks for a package or a draft");
  if (/line.?up|next week/.test(q)) { add("lineup", {}, "the question is about the line-up"); add("shelf", {}, "and what the shelf holds to fill it"); }
  steps.push({ kind: "subagent", name: "analyst", args: {}, why: "read what the numbers say" });
  steps.push({ kind: "subagent", name: "strategist", args: {}, why: "turn the reading into a recommendation" });
  return { steps };
}

/* letters only, lower case: "reconcileRead", "reconcile Read", "RECONCILE_READ"
   and "reconcile-read" all fold to the same key, so a free model's own
   habit of re-casing or re-spacing a tool name it was given verbatim in
   the system prompt (seen live: "Reconcile Read", "site_search") does not
   silently drop a step whose name it otherwise got right. */
const foldName = s => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
const TOOL_FOLD = new Map(TOOL_NAMES.map(n => [foldName(n), n]));
const ROLE_FOLD = new Map(SUBAGENT_ROLES.map(n => [foldName(n), n]));

/* a plan step is trusted only if its shape and its name are both known; an
   unknown tool, an unknown subagent, or an action step is either accepted
   (kind action, name in ACTION_TYPES) or turned into a proposal at run
   time, never silently dropped without the owner ever seeing why */
export function validatePlan(plan) {
  const steps = (plan && Array.isArray(plan.steps)) ? plan.steps : [];
  const out = [];
  for (const s of steps) {
    if (!s || typeof s !== "object") continue;
    const kind = foldName(s.kind);
    const rawName = String(s.name || "");
    const why = String(s.why || "").slice(0, 300);
    const args = (s.args && typeof s.args === "object") ? s.args : {};
    if (kind === "tool") {
      const canon = TOOL_FOLD.get(foldName(rawName));
      if (canon) out.push({ kind: "tool", name: canon, args, why });
    } else if (kind === "subagent") {
      const canon = ROLE_FOLD.get(foldName(rawName));
      if (canon) out.push({ kind: "subagent", name: canon, args, why });
    } else if (kind === "action") {
      out.push({ kind: "action", name: rawName, args, why });
    }
    /* anything else (an unknown tool name, a malformed kind) is dropped
       rather than guessed at; the plan simply does less than it claimed */
    if (out.length >= BUDGETS.maxSteps) break;
  }
  return out;
}

/* ---------------------------------------------------------------------------
   THE PROMPTS. Compact by design: a tool's own one-line summary carries the
   gist into the stream, and the full JSON is handed to a subagent only when
   a step actually names that subagent, never broadcast to every call.
--------------------------------------------------------------------------- */
const PLANNER_SYSTEM = "You are the planner inside NOOR's Lantern agent. Read the owner's request and answer with "
  + "strict JSON only, no prose, no code fence: {\"steps\":[{\"kind\":\"tool\"|\"subagent\"|\"action\",\"name\":string,\"args\":object,\"why\":string}]}. "
  + "Tools (read only, no model, deterministic, except jev which judges one piece of text): " + TOOL_NAMES.join(", ") + ". "
  + "Subagents (each one model call): " + SUBAGENT_ROLES.join(", ") + ". "
  + "Actions the agent may take on its own, at most " + AUTONOMOUS_DAILY_CAP + " a day, each logged and undoable: " + ACTION_TYPES.join(", ") + ". "
  + "Reordering, skipping or choosing a reel for a slot is NOT an available action in this build; if the request needs that, "
  + "end the plan with an action step named \"lineup-change\" so it is offered to the owner as a proposal, never done alone. "
  + "At most " + BUDGETS.maxSteps + " steps. Read tools before subagents; a subagent should usually follow the tool reads it needs.";

function planPrompt(message, threadContext) {
  const msgs = [{ role: "system", content: PLANNER_SYSTEM }];
  if (threadContext) msgs.push({ role: "system", content: "Earlier in this conversation: " + threadContext });
  msgs.push({ role: "user", content: String(message || "").slice(0, 2000) });
  return msgs;
}

/* thread memory: the last 12 turns pass through, formatted plainly, so a
   follow-up question ("and last week?") is answerable at all; anything
   older than that is folded into one summary line rather than spent on a
   model call, since a summary of housekeeping is not worth a bucket of the
   day's free requests. A new thread (empty array) needs no context at all. */
export function summariseThread(turns) {
  const all = Array.isArray(turns) ? turns : [];
  if (all.length <= 12) return { recent: all, summary: "" };
  const older = all.slice(0, all.length - 12), recent = all.slice(all.length - 12);
  const gist = older.filter(t => t && t.role === "user").map(t => String(t.content || "").slice(0, 80)).join(" · ");
  return { recent, summary: gist ? "Earlier questions in this thread: " + gist : "" };
}
/* the recent turns, verbatim (bounded per turn), as one block of context a
   planner or a synthesiser can actually read; this is the piece that was
   being computed and then never handed to anything until 2026-09-24 */
function formatRecentTurns(recent) {
  const list = Array.isArray(recent) ? recent : [];
  if (!list.length) return "";
  return list.map(t => (t && t.role) + ": " + String((t && t.content) || "").slice(0, 500)).join("\n");
}
function buildThreadContext(thread) {
  const { recent, summary } = summariseThread(thread);
  const recentText = formatRecentTurns(recent);
  return [summary, recentText].filter(Boolean).join("\n\n");
}

/* ---------------------------------------------------------------------------
   PER-PERSON DATA NEVER REACHES A MODEL. Every tool output is text-checked
   with api/_llm.js's own scrub()/looksLikeJournal before it is ever folded
   into a subagent's prompt: the same wall the router itself keeps, kept a
   second time here so a tool that accidentally returned something
   identifying is caught before the message is even built, not only if it
   happens to reach the network. Injected rather than imported, so this file
   stays free of a network-carrying dependency and the test can prove the
   wall holds with a fake scrubber that always refuses. */
export function guardToolOutput(name, data, scrub) {
  const text = JSON.stringify(data == null ? null : data);
  const checked = scrub ? scrub(text) : { ok: true, text };
  if (!checked.ok) return { ok: false, reason: checked.reason || "refused: this tool's own output could not be verified as safe to send to a model" };
  return { ok: true, text: checked.text };
}

/* ---------------------------------------------------------------------------
   NUMBER, DATE AND CLOCK RECOGNITION.

   The critic below has to find every shape a number can take in ordinary
   English, not only a bare digit run: a percent, a "45k", a "3x", a "12th",
   a spelled-out word ("fourteen thousand"), a clock time in either 24 hour
   or am/pm form, and a calendar date in either ISO or written-out form.
   Each gets its own small recogniser here, in a fixed order (dates and
   clocks first, since "24 September 2026" and "19:00" must never also be
   read as the bare numbers 24, 2026 and 19), so critic() can mask a
   claimed span out of the text before the next recogniser runs over what
   is left, and never mark the same characters twice.
--------------------------------------------------------------------------- */
/* a number, not a digit embedded in an id (verse:2-255's "255", or a model
   name like gpt-oss-120b's "120"): excluded when the character right
   before it is a letter, a digit, a hash or a hyphen. A colon is
   deliberately NOT excluded, since JSON itself always writes a value
   straight after one ("engagement":0.052), which is the common shape a
   tool's own compact output takes here. */
const NUMBER_RX = /(?<![A-Za-z0-9#-])-?\d[\d,]*(?:\.\d+)?(?![A-Za-z0-9])/g;
const PERCENT_RX = /(?<![A-Za-z0-9#-])-?\d[\d,]*(?:\.\d+)?%/g;
const KM_RX = /(?<![A-Za-z0-9#-])-?\d[\d,]*(?:\.\d+)?\s?[kKmM]\b/g;
const X_MULT_RX = /(?<![A-Za-z0-9#-])\d[\d,]*(?:\.\d+)?x\b/g;
const TIMES_WORD_RX = /(?<![A-Za-z0-9#-])\d[\d,]*(?:\.\d+)?\s+times\b/gi;
const ORDINAL_RX = /(?<![A-Za-z0-9#-])\d{1,3}(?:st|nd|rd|th)\b/gi;

const ISO_DATE_RX = /\b\d{4}-\d{2}-\d{2}\b/g;
const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const HUMAN_DATE_RX = /\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b|\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/g;
const CLOCK_RX = /\b([01]?\d|2[0-3]):([0-5]\d)\s*(am|pm)?\b|\b(1[0-2]|0?[1-9])\s*(am|pm)\b/gi;

const SMALL_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  once: 1, twice: 2, thrice: 3, dozen: 12 };
const SCALE_WORDS = { hundred: 100, thousand: 1000, million: 1000000 };
const WORD_RX = /\b[A-Za-z]+\b/g;

function normaliseNumber(tok) {
  const n = parseFloat(String(tok).replace(/,/g, "").replace(/[%kKmMx]$/, "").trim());
  return isFinite(n) ? n : null;
}
function round2(n) { return Math.round(n * 100) / 100; }

function isoFromHumanMatch(m) {
  let day, monName, year;
  if (m[1] && m[2] && m[3]) { day = m[1]; monName = m[2]; year = m[3]; }
  else if (m[4] && m[5] && m[6]) { monName = m[4]; day = m[5]; year = m[6]; }
  else return null;
  const mon = MONTHS[monName.toLowerCase()];
  if (!mon) return null;
  const dd = day.length < 2 ? "0" + day : day;
  const mm = mon < 10 ? "0" + mon : String(mon);
  return year + "-" + mm + "-" + dd;
}
function normaliseClock(m) {
  let h, mins = "00", ap;
  if (m[1] != null) { h = parseInt(m[1], 10); mins = m[2]; ap = m[3]; }
  else { h = parseInt(m[4], 10); ap = m[5]; }
  if (ap) { ap = ap.toLowerCase(); if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0; }
  if (h == null || h < 0 || h > 23) return null;
  return (h < 10 ? "0" + h : String(h)) + ":" + mins;
}

/* number words ("fourteen thousand", "twelve", "twice"), as a list of
   { start, end, value } spans over the given text, so critic() can mask
   them the same way it masks a digit-shaped match */
function wordNumberMatches(text) {
  const words = [];
  let m;
  WORD_RX.lastIndex = 0;
  while ((m = WORD_RX.exec(text))) words.push({ w: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length });
  const out = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i].w;
    const isSmall = SMALL_WORDS.hasOwnProperty(w), isScale = SCALE_WORDS.hasOwnProperty(w);
    if (!isSmall && !isScale) { i++; continue; }
    let value = isScale ? SCALE_WORDS[w] : SMALL_WORDS[w];
    let start = words[i].start, end = words[i].end, usedScale = isScale, j = i;
    while (j + 1 < words.length) {
      const gap = text.slice(words[j].end, words[j + 1].start);
      const isAnd = /^\s+and\s+$/.test(gap);
      if (!/^[\s-]*$/.test(gap) && !isAnd) break;
      const nw = words[j + 1].w;
      if (SCALE_WORDS.hasOwnProperty(nw) && !usedScale) { value = (value || 1) * SCALE_WORDS[nw]; end = words[j + 1].end; j++; usedScale = true; continue; }
      if (SMALL_WORDS.hasOwnProperty(nw) && usedScale) { value += SMALL_WORDS[nw]; end = words[j + 1].end; j++; continue; }
      break;
    }
    out.push({ start, end, value });
    i = j + 1;
  }
  return out;
}
/* replace every character in [start,end) with a space, so a later, wider
   recogniser never re-reads a span an earlier one already claimed */
function mask(text, start, end) {
  return text.slice(0, start) + " ".repeat(end - start) + text.slice(end);
}

/* ---------------------------------------------------------------------------
   EVIDENCE. Every number AND every ISO date and clock time found in the
   text handed to this function goes into one Set: numbers as themselves
   (rounded to 2 decimals, so a formatting difference is not read as an
   invented figure), dates and clock times as their own normalised strings
   alongside the numbers, since a Set holds both without confusing a lookup
   of one kind for the other. There is deliberately no blanket x100 or /100
   expansion here any more (removed 2026-09-24): it used to add every
   number's own percent and fraction form to the set regardless of whether
   the number in the text was ever meant as one, which on a large object
   (api/observatory.js's own composed answer, hundreds of small decimals)
   made nearly every integer from 0 to 100 pass the check whether the
   answer had earned it or not. The percent/fraction equivalence is instead
   checked explicitly, only for a token that is actually written as a
   percent, inside critic() below.
--------------------------------------------------------------------------- */
export function evidenceFromText(text) {
  const evidence = new Set();
  const s = String(text == null ? "" : text);
  const nums = s.match(NUMBER_RX) || [];
  for (const m of nums) { const n = normaliseNumber(m); if (n != null) evidence.add(round2(n)); }
  const isoDates = s.match(ISO_DATE_RX) || [];
  for (const d of isoDates) evidence.add(d);
  let cm; CLOCK_RX.lastIndex = 0;
  while ((cm = CLOCK_RX.exec(s))) { const c = normaliseClock(cm); if (c) evidence.add(c); }
  return evidence;
}
export function evidenceFromToolOutputs(toolOutputs) {
  const evidence = new Set();
  for (const out of (toolOutputs || [])) {
    let text;
    try { text = JSON.stringify(out && out.data != null ? out.data : out); } catch { text = String(out); }
    for (const v of evidenceFromText(text)) evidence.add(v);
  }
  return evidence;
}
/* the same collector, over the exact compact (possibly truncated) JSON
   strings synthesisPrompt() below actually sends to the model, so the
   evidence a run is checked against is never wider than what the model was
   actually shown this run (rule 3d of the 24 September 2026 review) */
export function evidenceFromCompact(compact) {
  const evidence = new Set();
  for (const c of (compact || [])) for (const v of evidenceFromText(c && c.json)) evidence.add(v);
  return evidence;
}

/* is `value` the ratio, or (percent-typed only) the percent change, of
   some pair of numbers actually in the evidence, within a small rounding
   tolerance? Checked over every ordered pair, which is cheap even for a
   few hundred numbers and only ever run on the numeric subset of the
   evidence (date and clock strings are ignored here, silently, since
   Math.abs on a string is already NaN and never satisfies <=).

   Deliberately NOT checked: a plain difference of two arbitrary evidence
   values ("up by 1,200"). A tool that actually computed a delta (every
   network row api/observatory.js composes carries one) writes it straight
   into its own JSON as a literal number, which the literal check above
   already accepts; checking every possible pair's own difference as well
   would accept it a second, redundant way, and on a large evidence set
   (the whole Observatory's own answer, several hundred distinct numbers)
   the birthday problem makes that redundant check dangerous rather than
   harmless: among that many pairs, almost any small claimed number sits
   within half a point of SOME pair's difference by pure chance, which is
   exactly the over-permissive evidence set 2026-09-24's own review found
   (dens.mjs). Both derivations below are further limited to evidence
   values of a real size (10 or more): the small end of a typical tool's
   JSON (a weekday index, an hour, a post count under ten) is common
   enough that pairing it freely would recreate the same problem, and a
   genuine ratio or percent-change claim about this house's own numbers is
   about reach, views or engagement, never about a weekday index. */
function derivedOk(value, isPercent, evNums) {
  const tol = Math.max(0.75, Math.abs(value) * 0.015);
  const big = evNums.filter(n => Math.abs(n) >= 10);
  for (let i = 0; i < big.length; i++) {
    for (let j = 0; j < big.length; j++) {
      if (i === j) continue;
      const a = big[i], b = big[j];
      if (b === 0) continue;
      if (isPercent) { const pc = ((a - b) / b) * 100; if (Math.abs(pc - value) <= 0.5) return true; }
      else { const ratio = a / b; if (Math.abs(ratio - value) <= tol) return true; }
    }
  }
  return false;
}

/* ---------------------------------------------------------------------------
   THE CRITIC. Mechanical, always runs, regardless of budget, over the
   final answer, over every string and number an artifact carries, and
   over every subagent's own gist before it is streamed. Rule: a number,
   with whatever unit or suffix it is written in, passes only if it (or its
   fraction form for a percent) is a literal value this run's own evidence
   holds, or is the ratio, the difference, or -- for a percent only -- the
   percent change of two evidence values, within rounding. A date or a
   clock time passes only if it appears in the evidence, in whatever form
   it is written in the answer. When ANY token in a clause fails, the WHOLE
   clause is dropped, never spliced with a placeholder: a sentence that is
   half right and half invented is not a sentence this house prints half
   of, it is one it does not print. A clause is text between semicolons (or
   the edges of a sentence); a sentence is text between . ! or ?. Dropping
   is logged so the owner can see what was taken out and why.
--------------------------------------------------------------------------- */
function checkClause(clause, evidence, evNums) {
  let work = clause;
  let ok = true;

  /* 1. dates, both ISO and written out, masked once checked */
  let m;
  HUMAN_DATE_RX.lastIndex = 0;
  const dateSpans = [];
  while ((m = HUMAN_DATE_RX.exec(work))) {
    const iso = isoFromHumanMatch(m);
    if (iso && !evidence.has(iso)) ok = false;
    dateSpans.push([m.index, m.index + m[0].length]);
  }
  for (const [a, b] of dateSpans) work = mask(work, a, b);
  ISO_DATE_RX.lastIndex = 0;
  const isoSpans = [];
  while ((m = ISO_DATE_RX.exec(work))) { if (!evidence.has(m[0])) ok = false; isoSpans.push([m.index, m.index + m[0].length]); }
  for (const [a, b] of isoSpans) work = mask(work, a, b);

  /* 2. clock times, masked once checked */
  CLOCK_RX.lastIndex = 0;
  const clockSpans = [];
  while ((m = CLOCK_RX.exec(work))) {
    const c = normaliseClock(m);
    if (!c || !evidence.has(c)) ok = false;
    clockSpans.push([m.index, m.index + m[0].length]);
  }
  for (const [a, b] of clockSpans) work = mask(work, a, b);

  /* 3. percent, k/m suffix, x-multiplier, "N times", ordinal: each is its
     own shape and its own unit, masked as it is checked so the plain
     number pass below never re-reads the same digits */
  const passNumeric = (rx, toValue, isPercent) => {
    rx.lastIndex = 0;
    const spans = [];
    let mm;
    while ((mm = rx.exec(work))) {
      const v = toValue(mm[0]);
      if (v == null) { spans.push([mm.index, mm.index + mm[0].length]); continue; }
      /* a percent's own literal check is its fraction form ONLY (5.2% real
         only if 0.052 is really in evidence): checking the raw number 5.2
         against evidence too (removed 2026-09-24, dens.mjs) conflated a
         percent with any unrelated count that happened to equal it, which
         on a large object (api/observatory.js's own answer, hundreds of
         small integers in sparklines and deltas) let almost any invented
         percent from 0 to 100 find some unrelated 42 or 17 to hide behind. */
      const literal = isPercent ? evidence.has(round2(v / 100)) : evidence.has(round2(v));
      if (!literal && !derivedOk(v, isPercent, evNums)) ok = false;
      spans.push([mm.index, mm.index + mm[0].length]);
    }
    for (const [a, b] of spans) work = mask(work, a, b);
  };
  passNumeric(PERCENT_RX, t => normaliseNumber(t), true);
  passNumeric(KM_RX, t => { const n = normaliseNumber(t); if (n == null) return null; return /[kK]$/.test(t.trim()) ? n * 1000 : n * 1000000; }, false);
  passNumeric(X_MULT_RX, t => normaliseNumber(t), false);
  passNumeric(TIMES_WORD_RX, t => normaliseNumber(t), false);
  passNumeric(ORDINAL_RX, t => normaliseNumber(t), false);

  /* 4. number words ("fourteen thousand"), masked as checked */
  const words = wordNumberMatches(work);
  for (const w of words) {
    const literal = evidence.has(round2(w.value));
    if (!literal && !derivedOk(w.value, false, evNums)) ok = false;
  }
  for (const w of words.slice().sort((a, b) => b.start - a.start)) work = mask(work, w.start, w.end);

  /* 5. whatever plain digit numbers are left */
  NUMBER_RX.lastIndex = 0;
  while ((m = NUMBER_RX.exec(work))) {
    const v = normaliseNumber(m[0]);
    if (v == null) continue;
    const literal = evidence.has(round2(v));
    if (!literal && !derivedOk(v, false, evNums)) ok = false;
  }

  return ok;
}

/* a decimal point between two digits ("5.2%") is not a sentence's own full
   stop; guarded here with a character no real prose ever carries, so the
   sentence split below cannot mistake "5.2% engaged" for two sentences,
   "5" and "2% engaged", and drop the second half of a real number's own
   clause as if it were a sentence on its own */
const DECIMAL_GUARD = "\u0001";
const guardDecimals = s => s.replace(/(\d)\.(\d)/g, "$1" + DECIMAL_GUARD + "$2");
const unguardDecimals = s => s.split(DECIMAL_GUARD).join(".");

/* splits on sentence boundaries, then on semicolons within each sentence;
   a clause that fails is dropped, a sentence with nothing left is dropped
   whole rather than left as stray punctuation */
/* debris cleanup, run over the critic's own final text. A dropped clause
   that sat inside a parenthesis or a comma list can leave punctuation
   behind that no longer makes sense on its own -- "(verse, dhikr, )", an
   orphaned "and" right before a closing bracket, a doubled comma, a
   doubled space -- even when the drop itself was correct (2026-09-24, a
   live run: a free model answered "reel type (verse, dhikr, ). It only
   shows..." once it had run out of real kind names to name, a debris
   shape this tidies whether it came from a clause this critic dropped or
   from the model's own raw prose trailing off). Never changes which words
   survived, only how the punctuation around a gap reads once something,
   somewhere, is gone; run to a fixed point since undoing one gap can
   reveal another right next to it (an emptied "(verse, )" becomes "()"
   only after the trailing comma is fixed, and only then is it caught by
   the empty-brackets pass). */
function tidyPunctuation(text) {
  let s = String(text || "");
  for (let i = 0; i < 5; i++) {
    const before = s;
    s = s
      .replace(/,\s*(and|or)\b(?=\s*[.)\]])/gi, "")   // ", and )" / ", and." -> ")" / "."
      .replace(/\(\s*(and|or)\b\s*/gi, "(")            // "( and " -> "("
      .replace(/,\s*,/g, ",")                          // doubled comma
      .replace(/,\s*\)/g, ")")                          // ", )" -> ")"
      .replace(/\(\s*,/g, "(")                          // "( ," -> "("
      .replace(/,\s*\]/g, "]")
      .replace(/\[\s*,/g, "[")
      .replace(/\(\s*\)/g, "")                          // now-empty ()
      .replace(/\[\s*\]/g, "")                          // now-empty []
      .replace(/,\s*\./g, ".")                          // ", ." -> "."
      .replace(/\(\s+/g, "(").replace(/\s+\)/g, ")")    // padding just inside a bracket
      .replace(/\s+([,.;:])/g, "$1")                    // a space before punctuation
      .replace(/\s{2,}/g, " ")
      .trim();
    if (s === before) break;
  }
  return s;
}

function checkAndClean(text, evidence) {
  const evNums = [...evidence].filter(v => typeof v === "number");
  const dropped = [];
  const guarded = guardDecimals(String(text || ""));
  const sentences = guarded.match(/[^.!?]+[.!?]*(?:\s+|$)/g) || [guarded];
  const kept = [];
  for (const rawSentence of sentences) {
    const sentence = unguardDecimals(rawSentence);
    if (!sentence.trim()) continue;
    const clauses = sentence.split(/;/);
    const survivors = [];
    clauses.forEach((clause, idx) => {
      if (!clause.trim()) return;
      if (checkClause(clause, evidence, evNums)) survivors.push(clause);
      else dropped.push(clause.trim().slice(0, 160));
    });
    if (survivors.length) kept.push(survivors.join(";"));
  }
  return { text: tidyPunctuation(kept.join(" ")), dropped };
}

/* the mechanical pass: strips a stray em or en dash first (never counted
   as a dropped clause, just cleaned in place, the same as before), then
   drops any clause holding a number, a date or a clock time this run's own
   evidence does not support, in the shape described above. Returns the
   cleaned text plus a report; never throws. */
export function critic(text, evidence) {
  const original = String(text == null ? "" : text);
  const dashesFound = DASH_RX.test(original);
  const dashless = original.replace(DASH_RX, ", ");
  const { text: cleaned, dropped } = checkAndClean(dashless, evidence || new Set());
  return { text: cleaned, removed: dropped, dashesFound, clean: !dropped.length && !dashesFound };
}

/* ---------------------------------------------------------------------------
   ARTIFACT VALIDATION. A schema, not a request: a synthesis model's own
   JSON is read here field by field, every row and every string clipped to
   a sane size, anything that does not fit the shape dropped with a plain
   note rather than passed through and left for the console to survive on
   its own. A "proposal" artifact from the synthesiser is never accepted at
   all: the only real proposals are the ones an action step itself builds
   through runAction()/buildProposal() below, each with its own id, saved
   to the store before it is ever streamed (api/lantern-agent.js); a
   free-form proposal a model invented after the fact would have none of
   that behind it and would let a model call something approvable that was
   never checked the way a real one is.
--------------------------------------------------------------------------- */
const ARTIFACT_LIMITS = { rows: 30, tableRows: 50, headers: 12, seriesPoints: 60, seriesCount: 8, textLen: 6000, strLen: 300 };
const cleanStr = (s, max) => String(s == null ? "" : s).slice(0, max || ARTIFACT_LIMITS.strLen);
const cleanNum = n => { const v = typeof n === "number" ? n : parseFloat(n); return isFinite(v) ? v : null; };

export function validateArtifact(a) {
  if (!a || typeof a !== "object") return { ok: false, note: "an artifact that was not an object was dropped" };
  const type = String(a.type || "");
  if (type === "chart") {
    const spec = a.spec && typeof a.spec === "object" ? a.spec : {};
    const kind = String(spec.kind || "");
    if (kind === "bars") {
      const rowsIn = Array.isArray(spec.rows) ? spec.rows.slice(0, ARTIFACT_LIMITS.rows) : [];
      const rows = rowsIn.map(r => (r && typeof r === "object") ? { label: cleanStr(r.label, 80), n: cleanNum(r.n) || 0, v: cleanNum(r.v) } : null)
        .filter(r => r && r.v != null);
      if (!rows.length) return { ok: false, note: "a bars chart with no usable numeric rows was dropped" };
      return { ok: true, artifact: { type: "chart", spec: { kind: "bars", title: cleanStr(spec.title, 120), sub: cleanStr(spec.sub, 160), rows } } };
    }
    if (kind === "trend") {
      const dates = Array.isArray(spec.dates) ? spec.dates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(String(d))).slice(0, ARTIFACT_LIMITS.seriesPoints) : [];
      const seriesIn = spec.series && typeof spec.series === "object" ? spec.series : {};
      const series = {};
      let count = 0;
      for (const k of Object.keys(seriesIn)) {
        if (count >= ARTIFACT_LIMITS.seriesCount) break;
        const arr = Array.isArray(seriesIn[k]) ? seriesIn[k].slice(0, dates.length || ARTIFACT_LIMITS.seriesPoints).map(v => (v == null ? null : cleanNum(v))) : null;
        if (!arr) continue;
        series[cleanStr(k, 40)] = arr; count++;
      }
      if (!dates.length || !count) return { ok: false, note: "a trend chart with no usable dates or series was dropped" };
      return { ok: true, artifact: { type: "chart", spec: { kind: "trend", title: cleanStr(spec.title, 120), sub: cleanStr(spec.sub, 160), dates, series } } };
    }
    return { ok: false, note: "a chart of an unknown kind (\"" + cleanStr(kind, 40) + "\") was dropped" };
  }
  if (type === "table") {
    const headers = Array.isArray(a.headers) ? a.headers.slice(0, ARTIFACT_LIMITS.headers).map(h => cleanStr(h, 40)) : [];
    if (!headers.length) return { ok: false, note: "a table with no headers was dropped" };
    const rowsIn = Array.isArray(a.rows) ? a.rows.slice(0, ARTIFACT_LIMITS.tableRows) : [];
    const rows = rowsIn.map(r => Array.isArray(r) ? r.slice(0, headers.length).map(c => cleanStr(c, 60)) : null).filter(Boolean);
    return { ok: true, artifact: { type: "table", title: cleanStr(a.title, 120), headers, rows } };
  }
  if (type === "draft") {
    const text = cleanStr(a.text, ARTIFACT_LIMITS.textLen);
    if (!text.trim()) return { ok: false, note: "a draft with no text was dropped" };
    return { ok: true, artifact: { type: "draft", network: cleanStr(a.network, 30), text } };
  }
  return { ok: false, note: "an artifact of type \"" + cleanStr(type, 40) + "\" from the synthesiser is never accepted; a proposal can only come from the agent's own action step, never a model's own free-form suggestion" };
}

/* runs an artifact through the schema above, then the critic, over its own
   title, its sub-title, every row label and every row's own numbers; a
   clause the critic would drop inside a table cell or a bar's own label
   instead drops that one cell/row, never the whole artifact, since an
   artifact is data, not prose, and one bad row is not reason to lose the
   rest of a real chart */
function checkArtifact(raw, evidence) {
  const v = validateArtifact(raw);
  if (!v.ok) return { artifact: null, note: v.note };
  const a = v.artifact;
  const okNum = (n) => n == null || evidence.has(round2(n)) || derivedOk(n, false, [...evidence].filter(x => typeof x === "number"));
  const okStr = (s) => critic(s, evidence).text;
  if (a.type === "chart" && a.spec.kind === "bars") {
    a.spec.title = okStr(a.spec.title); a.spec.sub = okStr(a.spec.sub);
    a.spec.rows = a.spec.rows.filter(r => okNum(r.v)).map(r => ({ ...r, label: okStr(r.label) }));
    if (!a.spec.rows.length) return { artifact: null, note: "every row of a bars chart failed the critic and was dropped" };
    return { artifact: a };
  }
  if (a.type === "chart" && a.spec.kind === "trend") {
    a.spec.title = okStr(a.spec.title); a.spec.sub = okStr(a.spec.sub);
    return { artifact: a };
  }
  if (a.type === "table") {
    a.title = okStr(a.title);
    a.rows = a.rows.map(r => r.map(c => (typeof c === "string" && /\d/.test(c)) ? okStr(c) : c));
    return { artifact: a };
  }
  if (a.type === "draft") {
    return { artifact: a };
  }
  return { artifact: a };
}

/* ---------------------------------------------------------------------------
   ACTIONS AND PROPOSALS
--------------------------------------------------------------------------- */
export function buildProposal(type, requested, args, why, reason, evidence) {
  return {
    type: ACTION_TYPES.includes(type) ? type : "other",
    requested,
    args: args || {},
    why: why || "",
    reason: reason || "",
    evidence: evidence || "",
    description: proposalDescription(requested, args, reason),
    at: new Date().toISOString()
  };
}
function proposalDescription(requested, args, reason) {
  if (requested === "lineup-change")
    return "Reorder or skip a reel in today's line-up. There is no existing, safe, owner-honoured way to do this automatically, so nothing was changed; approving this only records that you asked for it, and the console shows you which slot to open by hand in the Posts room.";
  if (ACTION_TYPES.includes(requested))
    return "Run " + requested + " now" + (reason ? " (" + reason + ")" : "") + ".";
  return "A step the agent could not take on its own (" + requested + "): " + (reason || "no safe mechanism exists for this yet") + ".";
}

/* the fallback undo recipe, used only when an action's own handler did not
   hand back a precise one of its own (api/lantern-agent.js's
   action_reconcile_teach always does, from teachGuard's own `taught` list,
   since only it knows which network each entry belongs to). A refresh has
   nothing to put back: it only reads what the networks already show
   publicly and writes a cache of that reading, so the fallback for
   anything that is not reconcile-teach is always the honest no-op. */
function undoRecipeFor(name) {
  return { kind: "noop", note: "this action changed only a cache of numbers the networks already show publicly; nothing on the site changed, so there is nothing to put back" };
}

/* runs one action step: refuses anything not in ACTION_TYPES as a
   proposal; refuses when there is no ledger able to reserve a slot
   atomically, or the reservation lands over the daily cap, as a proposal
   (see the file header: the cap fails closed); otherwise calls the
   injected handler, releasing the reserved slot again if the handler
   itself fails, writes the ledger entry, and returns what happened. Every
   proposal carries whatever this run's own tool summaries said so far, so
   the owner sees real, grounded evidence beside the ask, never a bare
   claim with nothing behind it. */
export async function runAction(step, ctx) {
  const { tools = {}, ledger, emit = () => {}, toolOutputs = [] } = ctx;
  const name = String(step.name || "");
  const evidence = toolOutputs.map(t => t && t.summary).filter(Boolean).join(" ").slice(0, 400);

  if (!ACTION_TYPES.includes(name)) {
    const p = buildProposal("other", name, step.args, step.why, "no safe autonomous mechanism exists for this in the current build", evidence);
    await emit("proposal", p);
    return { kind: "proposal", proposal: p };
  }

  if (!ledger || typeof ledger.reserve !== "function") {
    const p = buildProposal(name, name, step.args, step.why, "the daily action ledger is not available right now, so nothing runs on its own until it is", evidence);
    await emit("proposal", p);
    return { kind: "proposal", proposal: p };
  }
  const reserved = await ledger.reserve();
  if (!reserved.ok || reserved.count == null || reserved.count > AUTONOMOUS_DAILY_CAP) {
    if (reserved.ok && ledger.release) await ledger.release();
    const reason = reserved.ok
      ? "the daily limit of " + AUTONOMOUS_DAILY_CAP + " autonomous actions has already been reached today"
      : "the daily action ledger could not be read, so nothing runs on its own until it can be";
    const p = buildProposal(name, name, step.args, step.why, reason, evidence);
    await emit("proposal", p);
    return { kind: "proposal", proposal: p };
  }

  const key = "action_" + name.replace(/-/g, "_");
  const fn = tools[key];
  if (typeof fn !== "function") {
    if (ledger.release) await ledger.release();
    return { kind: "error", error: "no handler wired for action " + name };
  }
  let result;
  try { result = await fn(step.args || {}); }
  catch (e) {
    if (ledger.release) await ledger.release();
    return { kind: "error", error: "the action itself failed: " + String(e && e.message || e).slice(0, 200) };
  }
  if (!result || result.ok === false) { if (ledger.release) await ledger.release(); }
  const entry = {
    id: (ledger && ledger.newId) ? ledger.newId() : ("a-" + Date.now()),
    who: "lantern", what: name, args: step.args || {}, why: step.why || "",
    before: result && result.before != null ? result.before : null,
    undo: (result && result.undo) || undoRecipeFor(name),
    at: new Date().toISOString(), ok: !!(result && result.ok)
  };
  if (ledger && ledger.record) await ledger.record(entry);
  await emit("action", entry);
  return { kind: "action", entry, result };
}

/* replays an undo recipe. Only reconcile-teach carries a real, precise
   revert; every other kind (today, only the read-only refresh) needs none,
   and says so rather than pretending to reverse a read. An entry already
   marked undone is refused here too (belt and braces: api/lantern-agent.js
   also refuses a second undo before ever calling this, from the ledger's
   own `undone` flag, but this function is pure and callable on its own in
   a test, so it checks for itself rather than trusting every future
   caller to remember to). */
export async function undoAction(entry, tools = {}) {
  if (!entry || !entry.undo) return { ok: false, error: "this entry carries no undo recipe" };
  if (entry.undone) return { ok: false, error: "this action was already undone" };
  if (entry.undo.kind === "noop") return { ok: true, note: entry.undo.note || "nothing to reverse" };
  if (entry.undo.kind === "reconcile-teach-revert") {
    const fn = tools.action_undo_reconcile_teach;
    if (typeof fn !== "function") return { ok: false, error: "no undo handler is wired for this deployment" };
    return await fn(entry.undo);
  }
  return { ok: false, error: "unknown undo recipe: " + entry.undo.kind };
}

/* ---------------------------------------------------------------------------
   THE SYNTHESIS PROMPT AND ITS OWN PARSE. The model is asked for
   {"answer": string, "artifacts": [ {type, ...} ]}; a chart artifact's
   spec matches the Observatory's own kinds (bars, trend) so the console
   can draw it with the exact functions that room already uses. The model
   is handed the run's own tool data as compact JSON, not only the one-line
   summaries: a strategist cannot cite a real number it was never shown,
   and a one-line summary is not enough material to cite one from.
--------------------------------------------------------------------------- */
const SYNTH_SYSTEM = "You are the synthesiser inside NOOR's Lantern agent. You are given this run's own tool data, as compact JSON, and, where they ran, "
  + "subagent findings. Answer the owner's own question in plain English, every number carrying its sample size, drawn only from the JSON you were "
  + "actually given, in strict JSON only: {\"answer\": string, \"artifacts\": [ ARTIFACT, ... ] }. Only add an artifact when it genuinely helps; most "
  + "answers need none. An ARTIFACT is one of:\n"
  + "{\"type\":\"chart\",\"spec\":{\"kind\":\"bars\",\"title\":string,\"sub\":string,\"rows\":[{\"label\":string,\"n\":number,\"v\":number}]}}\n"
  + "{\"type\":\"chart\",\"spec\":{\"kind\":\"trend\",\"title\":string,\"sub\":string,\"dates\":[string],\"series\":{seriesName:[number,...]}}}\n"
  + "{\"type\":\"table\",\"title\":string,\"headers\":[string],\"rows\":[[string]]}\n"
  + "{\"type\":\"draft\",\"network\":string,\"text\":string} (built only from a package tool's own words, never invented)\n"
  + "Never invent a \"proposal\" artifact: a proposal only ever comes from the agent's own action step, never from you.\n"
  + "Never state a number, a date or a clock time this run's own tool data did not give you. Never use an em dash or an en dash; use a comma or a full stop.\n"
  + "Answer the owner's own question directly, with whatever breakdown the JSON actually carries (byKind, bySubject, byHour, byNetwork and the rest are "
  + "included precisely because a question about which kind or subject does best needs them); read the JSON before deciding it is missing something. "
  + "Only say a breakdown is not available when the JSON you were actually given truly does not carry it, and say so once, plainly, never as a reason "
  + "to answer a different, easier question instead of the one asked.\n"
  + HOUSE_RULES.map(r => "- " + r).join("\n");

/* the per-tool JSON budget handed to the synthesis model: divided across
   however many tools actually ran this turn, so one run's worth of reading
   never grows the prompt past what the free tiers comfortably hold, and a
   run with only one or two tools gets to hand over most of what each one
   found rather than an even smaller slice than it needs */
const SYNTH_JSON_BUDGET = 6000;

/* the breakdowns a real question is most likely to need an answer from,
   in the order they are worth keeping: a "which kind reaches most" or
   "what should we post more of" question lives in byKind and bySubject,
   not in a 30-day trend or an hourly matrix. Named here once so both
   api/observatory.js's own shape and api/_insights.js's own shape (two
   different tools, the same field names for the same idea) are read the
   same way, with no per-tool special case. */
const BREAKDOWN_PRIORITY = ["byKind", "bySubject", "byHour", "byNetwork", "kindTotals", "top", "subjectTop", "subjectBottom", "notes", "sentences"];

function jsonSize(v) { try { return JSON.stringify(v).length; } catch { return 0; } }
/* a scalar, or a small plain object, cheap enough to always keep whole:
   this is where "reach 5319, views 17498" actually lives (api/observatory
   .js's own `summary`), and it is worth more than any breakdown below it */
const isCheap = v => v == null || typeof v === "number" || typeof v === "string" || typeof v === "boolean";

/* fits `value` into `budget` characters without ever cutting a row (or a
   key) in half: an array keeps as many of its own whole entries as fit, in
   order; a plain object keeps as many of its own whole entries as fit; a
   value with nothing removable that still does not fit is dropped rather
   than sliced mid-JSON, which the old flat slice(0,per)+"…(truncated)"
   used to do -- handing the model a string that was not even valid JSON
   inside its own "compact JSON", past whatever byte the cut fell on. */
function fitToBudget(value, budget) {
  if (budget < 2) return undefined;
  if (Array.isArray(value)) {
    const kept = []; let used = 2;
    for (const row of value) {
      const add = jsonSize(row) + (kept.length ? 1 : 0);
      if (used + add > budget) break;
      kept.push(row); used += add;
    }
    return kept.length || !value.length ? kept : undefined;
  }
  if (value && typeof value === "object") {
    const kept = {}; let used = 2; let any = false;
    for (const k of Object.keys(value)) {
      const add = jsonSize(value[k]) + k.length + 4;
      if (used + add > budget) continue;
      kept[k] = value[k]; used += add; any = true;
    }
    return any || !Object.keys(value).length ? kept : undefined;
  }
  return jsonSize(value) <= budget ? value : undefined;
}

/* one tool's own data, compacted by priority rather than by a flat
   truncation: summary numbers first (whatever they cost), then the named
   breakdowns in BREAKDOWN_PRIORITY order (each trimmed to fit whatever
   budget is left, sample size n included since every row already carries
   its own), then everything else -- a long tail like a 30-day trend or an
   hour-by-weekday matrix -- with whatever budget the two passes above did
   not spend. A tool whose own data is an array (lineup, slots) or a bare
   scalar is fit to the whole budget directly, the same rule as a single
   breakdown. */
function compactOne(data, budget) {
  if (data == null || typeof data !== "object") {
    let s; try { s = JSON.stringify(data); } catch { s = String(data); }
    return (s || "null").slice(0, budget);
  }
  if (Array.isArray(data)) return JSON.stringify(fitToBudget(data, budget) || []);

  const out = {}; let used = 2;
  const keys = Object.keys(data);
  const breakdownSet = new Set(BREAKDOWN_PRIORITY);

  /* PASS 1: cheap scalars and small summary objects, always kept */
  for (const k of keys) {
    if (breakdownSet.has(k)) continue;
    const v = data[k];
    const smallObject = v && typeof v === "object" && !Array.isArray(v) && jsonSize(v) < 500;
    if (!isCheap(v) && !smallObject) continue;
    out[k] = v; used += jsonSize(v) + k.length + 4;
  }
  /* PASS 2: the named breakdowns, in fixed priority order */
  for (const k of BREAKDOWN_PRIORITY) {
    if (!(k in data) || k in out) continue;
    const remaining = budget - used - k.length - 4;
    if (remaining <= 20) continue;
    const trimmed = fitToBudget(data[k], remaining);
    if (trimmed !== undefined) { out[k] = trimmed; used += jsonSize(trimmed) + k.length + 4; }
  }
  /* PASS 3: the long tail -- everything else, cut first when the budget
     runs out, since it is read last */
  for (const k of keys) {
    if (k in out || breakdownSet.has(k)) continue;
    const remaining = budget - used - k.length - 4;
    if (remaining <= 20) continue;
    const trimmed = fitToBudget(data[k], remaining);
    if (trimmed !== undefined) { out[k] = trimmed; used += jsonSize(trimmed) + k.length + 4; }
  }
  let s; try { s = JSON.stringify(out); } catch { s = "{}"; }
  return s;
}

export function compactToolOutputs(toolOutputs) {
  const list = toolOutputs || [];
  const per = Math.max(300, Math.floor(SYNTH_JSON_BUDGET / Math.max(1, list.length)));
  return list.map(t => ({ name: t.name, json: compactOne(t && t.data, per) }));
}

export function synthesisPrompt(message, toolOutputs, subagentOutputs, threadContext) {
  const compact = compactToolOutputs(toolOutputs);
  const evidenceText = compact.map(t => t.name + ": " + t.json).join("\n");
  const findings = subagentOutputs.map(s => s.role + ": " + String(s.content || "").slice(0, 600)).join("\n\n");
  const msgs = [{ role: "system", content: SYNTH_SYSTEM }];
  if (threadContext) msgs.push({ role: "system", content: "Earlier in this conversation: " + threadContext });
  msgs.push({ role: "user", content: "The owner asked: " + String(message || "").slice(0, 1000)
      + "\n\nThis run's own tool data (compact JSON):\n" + evidenceText
      + (findings ? "\n\nSubagent findings:\n" + findings : "") });
  return { messages: msgs, compact };
}
function tryParseAsSynthesis(t) {
  try {
    const p = JSON.parse(t);
    if (p && typeof p.answer === "string") return { answer: p.answer, artifacts: Array.isArray(p.artifacts) ? p.artifacts : [] };
  } catch { /* fall through to the next repair */ }
  return null;
}
/* the same robustness parsePlan() above keeps, for the exact same reason:
   a free model answering the synthesis prompt drifts into a reasoning
   preamble or a fenced block exactly as readily as one answering the
   planner prompt does */
export function parseSynthesis(raw) {
  const cleaned = stripThink(String(raw == null ? "" : raw));
  const balanced = extractBalanced(cleaned);
  const tries = [cleaned, dropTrailingCommas(stripFence(cleaned))];
  if (balanced) tries.push(dropTrailingCommas(balanced));
  for (const t of tries) {
    const p = tryParseAsSynthesis(t);
    if (p) return p;
  }
  const repaired = dropTrailingCommas(singleToDoubleQuotes(balanced || stripFence(cleaned)));
  return tryParseAsSynthesis(repaired);
}

/* ---------------------------------------------------------------------------
   THE RUN
--------------------------------------------------------------------------- */
export async function runAgent(input) {
  const {
    message, thread = [], tools = {}, route, emit = () => {}, clock, ledger = null, scrub = null
  } = input;

  const startedAt = nowMs(clock);
  const timeLeftMs = () => BUDGETS.maxWallMs - (nowMs(clock) - startedAt);
  /* a single call's own timeout shrinks as the run's own clock runs down,
     leaving room after it returns for the critic, the artifact schema
     check and the HTTP layer's own close, rather than always asking
     api/_llm.js's chatOnce for its full default (9 seconds) even on a call
     started with only a little of the run's own 120 seconds left */
  const callTimeoutMs = () => Math.max(4000, Math.min(9000, timeLeftMs() - 4000));
  let modelCalls = 0;
  const toolOutputs = [];      /* { name, args, summary, data } */
  const subagentOutputs = [];  /* { role, content } */
  const notCompleted = [];

  const threadContext = buildThreadContext(thread);

  /* ---- PLAN ---- */
  let plan = null;
  if (route && timeLeftMs() > MODEL_CALL_MARGIN_MS) {
    const planCall = await route({ tier: "fast", json: true, messages: planPrompt(message, threadContext), opts: { max_tokens: 600, timeout: callTimeoutMs() } });
    modelCalls++;
    if (planCall && planCall.ok) plan = parsePlan(planCall.content);
  }
  if (!plan) plan = fallbackPlan(message);
  const steps = validatePlan(plan);
  await emit("plan", { steps: steps.map(s => ({ kind: s.kind, name: s.name, why: s.why })) });

  /* ---- STEPS ---- */
  for (const step of steps) {
    if (timeLeftMs() <= 0) { notCompleted.push(step.name + " (out of time)"); break; }
    const consumesModelCall = step.kind === "subagent" || (step.kind === "tool" && MODEL_TOOL_NAMES.includes(step.name));
    if (consumesModelCall && modelCalls >= BUDGETS.maxModelCalls) {
      notCompleted.push(step.name + " (out of model calls for this request)"); continue;
    }
    if (consumesModelCall && timeLeftMs() < MODEL_CALL_MARGIN_MS) {
      notCompleted.push(step.name + " (too little time left in this run to start another model call safely)"); continue;
    }

    if (step.kind === "tool") {
      await emit("step", { phase: "start", tool: step.name, why: step.why });
      const fn = tools[step.name];
      if (typeof fn !== "function") { await emit("step", { phase: "done", tool: step.name, error: "no such tool on this deployment" }); notCompleted.push(step.name + " (not available)"); continue; }
      let data, summary1 = "";
      try {
        const r = await fn(step.args || {});
        data = (r && typeof r === "object" && "data" in r) ? r.data : r;
        summary1 = (r && r.summary) || summariseData(data);
        if (r && r.modelCall) modelCalls++;
      }
      catch (e) { await emit("step", { phase: "done", tool: step.name, error: String(e && e.message || e).slice(0, 200) }); notCompleted.push(step.name + " (failed)"); continue; }
      toolOutputs.push({ name: step.name, args: step.args, summary: summary1, data });
      await emit("step", { phase: "done", tool: step.name, summary: summary1 });
      continue;
    }

    if (step.kind === "action") {
      const r = await runAction(step, { tools, ledger, emit, toolOutputs });
      if (r.kind === "error") notCompleted.push(step.name + " (" + r.error + ")");
      continue;
    }

    if (step.kind === "subagent") {
      if (!route) { notCompleted.push(step.name + " (no router available)"); continue; }
      const gathered = [];
      for (const t of toolOutputs) {
        const g = guardToolOutput(t.name, t.data, scrub);
        if (g.ok) gathered.push(t.name + ": " + g.text.slice(0, 1200));
        else notCompleted.push(t.name + "'s output was withheld from " + step.name + " (" + g.reason + ")");
      }
      const messages = [
        { role: "system", content: rolePrompt(step.name) },
        { role: "user", content: "The owner asked: " + String(message || "").slice(0, 1000) + (step.why ? "\nThis step's own purpose: " + step.why : "")
            + (gathered.length ? "\n\nTool outputs so far:\n" + gathered.join("\n\n") : "") }
      ];
      await emit("subagent", { role: step.name, phase: "start" });
      const got = await route({ tier: roleTier(step.name), messages, opts: { max_tokens: 900, timeout: callTimeoutMs() } });
      modelCalls++;
      if (got && got.ok) {
        subagentOutputs.push({ role: step.name, content: got.content });
        /* the gist streamed to the console is checked against this run's
           evidence so far too, the same as the final answer; an invented
           number in a subagent's own aside must not reach the thinking
           stream just because it never made it into the synthesised text */
        const evSoFar = evidenceFromToolOutputs(toolOutputs);
        const gistChecked = critic(String(got.content || "").slice(0, 400), evSoFar);
        await emit("subagent", { role: step.name, phase: "done", gist: gistChecked.text.slice(0, 200) });
      } else {
        notCompleted.push(step.name + " (" + ((got && got.error) || "did not answer") + ")");
        await emit("subagent", { role: step.name, phase: "done", error: (got && got.error) || "did not answer" });
      }
      continue;
    }
  }

  /* ---- SYNTHESIS ---- */
  let answer = "", artifacts = [], evidence = evidenceFromToolOutputs(toolOutputs);
  if (route && modelCalls < BUDGETS.maxModelCalls && timeLeftMs() > MODEL_CALL_MARGIN_MS) {
    const { messages: synthMessages, compact } = synthesisPrompt(message, toolOutputs, subagentOutputs, threadContext);
    evidence = evidenceFromCompact(compact);
    const got = await route({ tier: "strong", json: true, messages: synthMessages, opts: { max_tokens: 1800, timeout: callTimeoutMs() } });
    modelCalls++;
    const parsed = got && got.ok ? parseSynthesis(got.content) : null;
    if (parsed) { answer = parsed.answer; artifacts = parsed.artifacts; }
    else answer = (got && got.content) ? got.content : "";
  }
  if (!answer) {
    /* the honest fallback: what tools actually found, in the house's own
       words, never a model's guess at a summary it was never asked to make */
    answer = toolOutputs.length
      ? "Here is what could be read without the Lantern's own words: " + toolOutputs.map(t => t.summary).filter(Boolean).join(" ")
      : "Nothing could be gathered for this request.";
  }

  /* ---- CRITIC AND ARTIFACT SCHEMA: mechanical, always run, regardless of budget ---- */
  const checked = critic(answer, evidence);
  if (checked.removed.length) notCompleted.push(checked.removed.length + " clause" + (checked.removed.length > 1 ? "s" : "")
    + " could not be verified against this run's own tool data and were dropped: " + checked.removed.map(c => "\"" + c + "\"").join("; "));

  const cleanArtifacts = [];
  for (const raw of artifacts) {
    const { artifact, note } = checkArtifact(raw, evidence);
    if (artifact) cleanArtifacts.push(artifact);
    else if (note) notCompleted.push("an artifact was dropped: " + note);
  }

  if (notCompleted.length) await emit("step", { phase: "incomplete", items: notCompleted });
  /* "done" is not emitted here: it is the transport's own signal that the
     whole HTTP stream is closing, and this function is also called outside
     any stream at all (a test, a future non-streaming caller). The caller
     that owns the connection (api/lantern-agent.js) emits "done" once,
     after it has also streamed the answer and the artifacts this function
     hands back below, the answer FIRST so a bad artifact can never cost
     the owner the answer itself. */
  return {
    answer: checked.text, artifacts: cleanArtifacts, notCompleted,
    plan: steps.map(s => ({ kind: s.kind, name: s.name, why: s.why })),
    modelCalls, toolCalls: toolOutputs.length,
    exhausted: timeLeftMs() <= 0 || modelCalls >= BUDGETS.maxModelCalls || steps.length >= BUDGETS.maxSteps
  };
}

function summariseData(data) {
  if (data == null) return "";
  if (Array.isArray(data)) return data.length + " row" + (data.length === 1 ? "" : "s") + " read.";
  if (typeof data === "object") { const keys = Object.keys(data); return keys.length ? "read: " + keys.slice(0, 6).join(", ") + (keys.length > 6 ? "…" : "") : "read, nothing in it."; }
  return String(data).slice(0, 140);
}

export { HOUSE_RULES, PRINCIPLES, playbookLookup };
