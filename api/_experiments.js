/* NOOR · experiments: which arm the rota should lean on, and what it learned
   ===========================================================================
   Nine months of insights can say "verse reels reach further than word
   reels", which is a fact about the shelf as it happened to be posted, not
   a test of anything. An experiment is the other kind of question: split
   one kind into two arms by a real attribute the shelf already carries
   (a verse reel's own length, its own reciter), let the rota lean toward
   each arm for a fixed run, and read back whether the difference in what
   happened is bigger than chance would give for free.

   THE REGISTRY (EXPERIMENTS below) is code, not data: every arm is a real
   predicate over a card's own fields, never a guess about what a card
   "probably" is. Two experiments exist for now, both over the verse shelf
   (600 verses, the one kind wide enough to run a clean split on without
   starving the rota of a kind it needs every day):

     verse-length   under 20 seconds against over 30 seconds
     reciter-pair   two named reciters against each other, chosen at the
                    moment the test is planned (args.a, args.b)

   THE STATE lives in one KV key, nexp:state = {current, history}. `current`
   is null or {id, start, args}: the registry entry's own days, minPerArm
   and arms are never copied into it, so a later fix to how long a test runs
   changes nothing about a test already in flight only if that entry itself
   still exists; deleting a registry entry mid-test is the one thing this
   file cannot protect against, the same as deleting any other code the
   house depends on. Only one test runs at a time.

   THE ARM A GIVEN DAY LEANS TOWARD is decided by day parity from the test's
   own start (armFor below): day 0 is A, day 1 is B, day 2 is A, and so on.
   This is not the arm rows are SCORED by when the test is read back
   (evaluate below scores each row by what it actually was -- its own secs,
   its own reciter -- never by which day it happened to post on); it is only
   which pool api/_schedule.js's own chooseReel leans toward on a given day,
   so the shelf keeps filling both arms roughly evenly without the picker
   ever being told to prefer one card over another by name.

   THE READING (evaluate below) is a permutation test on the difference of
   medians of log(reach+1) between the two arms' own rows, seeded from the
   test's own id and start so two calls in the same run, or a console
   refreshed twice, always answer the same p value rather than a fresh throw
   of the dice each time a page loads. A verdict is only ever given once the
   test is ready (its window is over, or both arms have enough posts and the
   test is at least 14 days in): before that, the honest answer is "too
   early", with the counts so far, never a guess dressed as a result.
--------------------------------------------------------------------------- */
import fs from "node:fs";
import path from "node:path";
import { kv, kvReady } from "./_kv.js";

export const K_EXP = "nexp:state";
const HISTORY_KEEP = 20;

/* ---------------------------------------------------------------------------
   the registry
--------------------------------------------------------------------------- */
function reciterCounts(manifest) {
  const cards = (manifest && Array.isArray(manifest.cards)) ? manifest.cards : [];
  const out = {};
  for (const c of cards) if (c && c.kind === "verse" && c.reciter) out[c.reciter] = (out[c.reciter] || 0) + 1;
  return out;
}

export const EXPERIMENTS = {
  "verse-length": {
    id: "verse-length",
    question: "Do shorter or longer verse reels hold people better?",
    kind: "verse",
    days: 28,
    minPerArm: 10,
    metrics: ["reach", "watched"],
    /* this test names no owner argument at all: the plan door still refuses
       any key it does not expect (planExperiment's own check below), so a
       stray argument here is caught rather than silently ignored */
    argKeys: [],
    arms: () => ({
      /* `subject`/`object` are the sentence's own two shapes of the same
         arm, both authored here rather than derived from `label` (a card
         title, "Shorter verses, under 20 seconds", never read naturally as
         a sentence's opening or its closing "for ..."): `subject` opens a
         verdict sentence, capitalised; `object` closes one, mid sentence,
         lower case. A test with no subject/object of its own (none exists
         yet) falls back to `label` itself in evaluate() below. */
      A: { label: "Shorter verses, under 20 seconds", subject: "Shorter verses", object: "shorter verses",
           match: c => typeof c.secs === "number" && c.secs < 20 },
      B: { label: "Longer verses, over 30 seconds", subject: "Longer verses", object: "longer verses",
           match: c => typeof c.secs === "number" && c.secs > 30 }
    })
  },
  "reciter-pair": {
    id: "reciter-pair",
    question: "Does the reciter change how long people stay?",
    kind: "verse",
    days: 28,
    minPerArm: 10,
    metrics: ["reach", "watched"],
    /* the two reciters are named at plan time, not fixed in the registry:
       args.a and args.b, carried on state.current and read back here. The
       owner-only endpoint refuses any argument key outside this list. */
    argKeys: ["a", "b"],
    arms: (args) => {
      const a = args && args.a, b = args && args.b;
      return {
        A: { label: "Recited by " + (a || "the first reciter"),
             subject: "Recitations by " + (a || "the first reciter"), object: a || "the first reciter",
             match: c => !!a && c.reciter === a },
        B: { label: "Recited by " + (b || "the second reciter"),
             subject: "Recitations by " + (b || "the second reciter"), object: b || "the second reciter",
             match: c => !!b && c.reciter === b }
      };
    },
    validateArgs: (args, manifest) => {
      const a = String((args && args.a) || "").trim(), b = String((args && args.b) || "").trim();
      if (!a || !b) return { ok: false, error: "name both reciters: args.a and args.b" };
      if (a === b) return { ok: false, error: "the two reciters must differ" };
      const counts = reciterCounts(manifest);
      if ((counts[a] || 0) < 20) return { ok: false, error: a + " has fewer than 20 verse reels on the shelf" };
      if ((counts[b] || 0) < 20) return { ok: false, error: b + " has fewer than 20 verse reels on the shelf" };
      return { ok: true };
    }
  }
};

/* the shelf, read locally the same way api/_insights.js's own localManifest
   does; kept as its own small reader rather than an import of that file, so
   the two modules never have to agree on which one loads first */
let LOCAL_SHELF;
function localManifest() {
  if (LOCAL_SHELF !== undefined) return LOCAL_SHELF;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(process.cwd(), "reels", "index.json"), "utf8"));
    LOCAL_SHELF = (j && Array.isArray(j.cards)) ? j : null;
  } catch { LOCAL_SHELF = null; }
  return LOCAL_SHELF;
}

/* ---------------------------------------------------------------------------
   pure arithmetic: window, arm, bias
--------------------------------------------------------------------------- */
function daysBetween(a, b) {
  const ta = Date.parse(String(a || "").slice(0, 10) + "T00:00:00Z");
  const tb = Date.parse(String(b || "").slice(0, 10) + "T00:00:00Z");
  if (!isFinite(ta) || !isFinite(tb)) return null;
  return Math.floor((tb - ta) / 86400000);
}

/* which arm a date leans toward, by parity of days since the current test's
   own start; null before the start (a planned test), and null with no
   current test at all. Never bounded by the test's own length here -- that
   bound needs the registry (a test's `days`), which biasFrom below applies;
   armFor alone only answers "has it started, and which half of the rota's
   rhythm is this day". */
export function armFor(state, dateStr) {
  const cur = state && state.current;
  const start = cur && typeof cur === "object" ? cur.start : null;
  if (!start) return null;
  const idx = daysBetween(start, dateStr);
  if (idx == null || idx < 0) return null;
  return idx % 2 === 0 ? "A" : "B";
}

/* the registry entry merged with the one test actually running: its start
   and its own args, so every pure function below reads one shape rather
   than two objects that have to agree. Object.hasOwn, not a bracket read:
   a state built from a bad store write (or an id like "constructor") must
   never resolve to something the registry's own prototype happens to carry. */
export function resolveCurrent(state, registry) {
  const cur = state && state.current;
  if (!cur || typeof cur !== "object" || typeof cur.id !== "string" || !cur.id) return null;
  const reg = registry || EXPERIMENTS;
  if (!Object.hasOwn(reg, cur.id)) return null;
  const def = reg[cur.id];
  return { ...def, start: cur.start, args: (cur.args && typeof cur.args === "object") ? cur.args : {} };
}

/* null outside the window (planned, or the window has closed), or
   {id, arm, kind, match}: the one thing api/_schedule.js's own chooseReel
   needs to lean the picker toward an arm on a day the test actually covers */
export function biasFrom(state, dateStr, registry) {
  const arm = armFor(state, dateStr);
  if (!arm) return null;
  const cur = resolveCurrent(state, registry);
  if (!cur) return null;
  const idx = daysBetween(cur.start, dateStr);
  if (idx == null || idx >= cur.days) return null;
  const arms = (typeof cur.arms === "function" ? cur.arms(cur.args) : cur.arms) || {};
  const def = arms[arm];
  if (!def || typeof def.match !== "function") return null;
  return { id: cur.id, arm, kind: cur.kind, match: def.match };
}

/* the same question, asked of the current test AND, failing that, of every
   stopped one in state.history: a date inside a test that has since been
   stopped still needs its own arm reconstructed the same way it was chosen
   on the day, for a reader piecing that day back together after the fact.
   Two callers now, not one: api/_insights.js's own matchedCard fallback
   (a past day) AND api/_experiments.js's own biasFor below (the live
   posting path, today or a future preview) -- both need a STOPPED test to
   stop influencing anything from the day it was stopped onward, which is
   why every history entry is capped at its own stoppedAt date here, the one
   place both callers share. A history entry with no stoppedAt at all (should
   never happen, but a malformed store write is not this file's to trust)
   is skipped rather than treated as still running forever. Every entry is
   also checked for the shape readState's own sanitizer already guarantees,
   defensively, since a caller may hand this a state it built itself (a
   test, a console preview) rather than one that passed through readState. */
export function biasFromAny(state, dateStr, registry) {
  if (!state) return null;
  const cur = biasFrom(state, dateStr, registry);
  if (cur) return cur;
  const history = Array.isArray(state.history) ? state.history : [];
  for (const h of history) {
    if (!h || typeof h !== "object" || typeof h.id !== "string" || !h.id || typeof h.start !== "string" || !h.start) continue;
    /* a test cancelled before it ever ran, or stopped mid run, never biases
       on or after the day it was stopped: "stopping must stop" means the
       day of the stop is already the day nothing more leans on it. Every
       entry stopExperiment writes carries stoppedAt; one that somehow does
       not is skipped rather than trusted to bias without any known end. */
    if (typeof h.stoppedAt !== "string" || !h.stoppedAt) continue;
    const stoppedDate = h.stoppedAt.slice(0, 10);
    if (String(dateStr).slice(0, 10) >= stoppedDate) continue;
    const b = biasFrom({ current: { id: h.id, start: h.start, args: (h.args && typeof h.args === "object") ? h.args : {} } }, dateStr, registry);
    if (b) return b;
  }
  return null;
}

/* ---------------------------------------------------------------------------
   the store

   A MALFORMED STATE MUST NEVER TAKE A READER DOWN. {"history":[null]} once
   made biasFromAny throw at a caller that never wrapped it (api/_insights.js's
   own collect(), which every read of the house's numbers runs through); the
   fix belongs here, once, rather than trusted to every caller downstream to
   remember: sanitizeState below drops anything in `current` or `history`
   that is not at least {id, start} shaped, so a corrupted or hand-edited
   key degrades to "nothing running, nothing finished" rather than throwing.

   A FAILED READ MUST NEVER WIPE THE STORE. readState (below) is the SAFE
   door every reader (the live posting path, the console, the Lantern) calls:
   a KV outage answers the same empty state a house with no test ever had,
   because "no bias today" is always the right answer to a fault. planning
   and stopping a test are different: a plan built from an empty state that
   was really just an unreachable store would overwrite real history with
   nothing. Those two callers use readStateRaw instead, which lets a genuine
   store fault propagate so they can refuse the write outright rather than
   guess the store was empty. Only the KV call itself throwing counts as
   that fault; a value that came back but will not parse is treated the same
   as a malformed shape (sanitized to empty), since the bytes that would have
   held the real history are already gone either way. */
function sanitizeCurrent(c) {
  if (!c || typeof c !== "object" || typeof c.id !== "string" || !c.id || typeof c.start !== "string" || !c.start) return null;
  return { id: c.id, start: c.start, args: (c.args && typeof c.args === "object" && !Array.isArray(c.args)) ? c.args : {} };
}
function sanitizeHistoryEntry(h) {
  if (!h || typeof h !== "object" || typeof h.id !== "string" || !h.id || typeof h.start !== "string" || !h.start) return null;
  return h;
}
function sanitizeState(v) {
  return {
    current: sanitizeCurrent(v && v.current),
    history: (v && Array.isArray(v.history)) ? v.history.map(sanitizeHistoryEntry).filter(Boolean) : []
  };
}

async function readStateRaw(opts = {}) {
  const store = opts.kv || kv, ready = opts.kvReady || kvReady;
  const empty = { current: null, history: [] };
  if (!ready()) return empty;
  const r = await store([["GET", K_EXP]]);        /* a genuine fault propagates: the caller decides */
  const raw = r && r[0];
  if (!raw) return empty;
  let v;
  try { v = typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch { return empty; }                          /* corrupted bytes, not a read fault: degrade, do not throw */
  return sanitizeState(v);
}
export async function readState(opts = {}) {
  try { return await readStateRaw(opts); }
  catch { return { current: null, history: [] }; }
}
async function writeState(state, opts = {}) {
  const store = opts.kv || kv, ready = opts.kvReady || kvReady;
  if (!ready()) return false;
  try { await store([["SET", K_EXP, JSON.stringify(state)]]); return true; } catch { return false; }
}

/* the one call the posting path, the plan preview and the Lantern's lineup
   tool all make: a KV failure here must never fail a post, so it is caught
   here, once, rather than trusted to every caller to remember. */
export async function biasFor(dateStr, opts = {}) {
  try {
    const state = await readState(opts);
    return biasFromAny(state, dateStr, EXPERIMENTS);
  } catch { return null; }
}

/* ---------------------------------------------------------------------------
   the reading: a seeded permutation test, deterministic, and a status that
   never claims more than the numbers carry
--------------------------------------------------------------------------- */
function median(xs) {
  const a = (xs || []).filter(v => typeof v === "number" && isFinite(v)).sort((p, q) => p - q);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
/* a small stable hash (the same shape api/_schedule.js's own hash32 keeps),
   seeding a mulberry32 generator so the same test id and start always shuffle
   the same way -- two console refreshes of a "ready" test must answer the
   same p value, not a fresh roll each time the page is opened */
function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* the two-sided permutation test itself: the test statistic is the absolute
   difference of medians between the two groups; 2000 reshuffles of the
   pooled values, seeded, count how often a reshuffle's own difference is at
   least as large as what was actually observed. */
function permutationP(a, b, seedStr, iters) {
  if (!a.length || !b.length) return null;
  const obs = Math.abs(median(a) - median(b));
  const pooled = a.concat(b), nA = a.length, n = iters || 2000;
  const rng = mulberry32(hashSeed(seedStr));
  let count = 0;
  for (let i = 0; i < n; i++) {
    const arr = pooled.slice();
    for (let j = arr.length - 1; j > 0; j--) {
      const k = Math.floor(rng() * (j + 1));
      const t = arr[j]; arr[j] = arr[k]; arr[k] = t;
    }
    const diff = Math.abs(median(arr.slice(0, nA)) - median(arr.slice(nA)));
    if (diff >= obs) count++;
  }
  return count / n;
}
const pct = n => n == null ? null : Math.round(n * 100);

/* exp: a resolved current test (resolveCurrent's own shape: the registry
   entry plus start and args). rows: the IG reel rows api/_insights.js's own
   read()/collect() already builds (each carrying kind, secs, reciter, reach,
   watched, date, net). today: any date string or ISO stamp.

   THE PRIMARY METRIC IS WATCHED SHARE, NOT REACH. Every one of these tests
   asks a question about what holds a viewer's attention (a verse's own
   length, a reciter), and `watched` -- the fraction of a reel's own runtime
   a viewer actually stayed for -- answers that question directly; reach
   answers a different one (how far a post travelled) and is carried on
   every arm's own row for the console to show beside it, never as what the
   permutation test itself is run on.

   "READY" ONLY WHEN THE FULL WINDOW IS OVER. An earlier version called a
   test ready, and let it hand back a verdict, from day 14 once both arms
   merely had enough posts -- an owner refreshing the console daily could
   watch the verdict flicker before the run it was promised (28 days) ever
   finished, which is peeking, not reading a result. Now "ready" means
   exactly one thing: the window itself has closed; before that it is
   always "running", however many reels either arm already carries. */
export function evaluate(exp, rows, today) {
  if (!exp) return null;
  const idx = daysBetween(exp.start, today);
  const inWindow = r => {
    if (!r || r.net !== "instagram" || r.kind !== "reel:" + exp.kind) return false;
    const d = daysBetween(exp.start, r.date);
    return d != null && d >= 0 && d < exp.days;
  };
  const arms = (typeof exp.arms === "function" ? exp.arms(exp.args) : exp.arms) || {};
  const bucket = { A: [], B: [] };
  for (const r of (rows || [])) {
    if (!inWindow(r)) continue;
    for (const name of ["A", "B"]) {
      const def = arms[name];
      if (def && typeof def.match === "function" && def.match({ secs: r.secs, reciter: r.reciter })) { bucket[name].push(r); break; }
    }
  }
  const statsOf = name => {
    const list = bucket[name], def = arms[name] || {};
    return { arm: name, label: def.label || name, n: list.length,
             reach: median(list.map(r => r.reach)), watched: median(list.map(r => r.watched)) };
  };
  const A = statsOf("A"), B = statsOf("B");
  const windowOver = idx != null && idx >= exp.days;
  const day = idx == null ? 0 : Math.max(0, Math.min(idx, exp.days));

  let status;
  if (idx == null || idx < 0) status = "planned";
  else if (windowOver) status = "ready";
  else status = "running";

  let verdict = null, sentence = "";
  if (status === "planned") {
    sentence = "Planned to start " + exp.start + ".";
  } else if (status === "running") {
    sentence = "Too early to say: day " + day + " of " + exp.days + ", " + A.n + " and " + B.n + " reels counted so far.";
  } else {
    /* ready: the window is over. THE FLOOR IS ON WATCHED ROWS, NOT MATCHED
       ROWS. A.n/B.n count every reel evaluate() classified into the arm,
       whether or not Instagram ever answered a watch time for it; a reel
       with no `watched` number cannot enter the permutation test at all
       (median() and permutationP both already drop it), so gating the
       floor on A.n/B.n let ten reels a side "clear" minPerArm while five
       of them carried nothing to actually compare. The honest count is the
       one the test itself runs on, wA.length and wB.length, and that is
       what the sentence below names too, never the bigger A.n/B.n. */
    const wA = bucket.A.map(r => r.watched).filter(v => typeof v === "number" && isFinite(v));
    const wB = bucket.B.map(r => r.watched).filter(v => typeof v === "number" && isFinite(v));
    const bothMin = wA.length >= exp.minPerArm && wB.length >= exp.minPerArm;
    if (!bothMin || A.watched == null || B.watched == null) {
      verdict = "none";
      sentence = "After " + exp.days + " days, there is not enough to say: " + wA.length + " and " + wB.length + " reels with a watch time counted.";
    } else {
      const p = permutationP(wA, wB, exp.id + "|" + exp.start, 2000);
      const higher = A.watched >= B.watched ? A : B, lower = higher === A ? B : A;
      const higherW = higher === A ? wA.length : wB.length, lowerW = higher === A ? wB.length : wA.length;
      /* THE GAP IS PERCENTAGE POINTS, NOT A RATIO. watched is already a
         share (0..1, capped at 3); dividing the gap by the lower arm's own
         median is undefined at zero and wildly oversensitive near it (a
         lower arm at 2 percent turns a real but modest 8 point gap into
         "400 percent higher"). Percentage points -- the rounded percents
         the sentence already states, subtracted plainly -- read the same
         way the card does, and a zero lower median no longer breaks the
         comparison the way a ratio's own division by zero did. */
      const higherPct = pct(higher.watched), lowerPct = pct(lower.watched);
      const diffPoints = (higherPct != null && lowerPct != null) ? Math.abs(higherPct - lowerPct) : null;
      /* a verdict is given only on both counts at once: a real gap (at
         least ten percentage points, median to median) AND a gap a
         permutation test calls unlikely to be luck (p under 0.05, two
         sided) -- either alone is not enough to act on */
      const sure = p != null && p < 0.05 && diffPoints != null && diffPoints >= 10;
      verdict = sure ? higher.arm : "none";
      const armDef = arms[higher.arm] || {}, lowDef = arms[lower.arm] || {};
      const subject = armDef.subject || armDef.label || higher.arm;
      const object = lowDef.object || lowDef.label || lower.arm;
      sentence = subject + " held people for a median " + higherPct + " percent of the reel against "
        + lowerPct + " percent for " + object + ", a gap of " + diffPoints + " percentage points"
        + " (" + higherW + " and " + lowerW + " reels with a watch time, " + exp.days + " days). "
        + (sure ? "That gap is unlikely to be chance." : "That gap could still be chance.");
    }
  }

  return { id: exp.id, question: exp.question, kind: exp.kind, start: exp.start, day, days: exp.days,
           status, arms: [A, B], verdict, sentence };
}

/* ---------------------------------------------------------------------------
   planning and stopping (the owner-only endpoint's own doors)
--------------------------------------------------------------------------- */
const todayStr = now => (now ? new Date(now).toISOString() : new Date().toISOString()).slice(0, 10);
const ARG_STRING_MAX = 80;

/* a real calendar date, not merely four digits, a dash, two digits, a dash,
   two digits: 2026-02-31 matches that shape and is not a day that exists.
   Built round trip through Date.UTC, the same proof api/_calendar.js's own
   date checks lean on -- a month or day JS itself would silently roll over
   (13, or 31 in a 30 day month) is caught because the round trip disagrees. */
function isRealDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export async function planExperiment(id, start, args, opts = {}) {
  const idStr = String(id || "");
  /* Object.hasOwn, not a bracket read: an id like "constructor" or
     "toString" must be refused as unknown, never resolved through the
     registry object's own prototype */
  if (!Object.hasOwn(EXPERIMENTS, idStr)) return { ok: false, error: "no such experiment: " + idStr };
  const def = EXPERIMENTS[idStr];
  const startStr = String(start || "");
  if (!isRealDate(startStr)) return { ok: false, error: "start must be a real date, YYYY-MM-DD" };
  const today = todayStr(opts.now);
  if (startStr < today) return { ok: false, error: "start must be today (" + today + ") or later" };
  const ready = opts.kvReady || kvReady;
  if (!ready()) return { ok: false, error: "no store is configured, so nothing can be remembered" };
  /* A FAILED READ MUST NEVER WIPE THE STORE (see the note above readState):
     readStateRaw, not the safe readState, so a genuine store fault refuses
     the plan outright rather than being read as "nothing has ever run
     here" and overwriting real history with an empty one. */
  let state;
  try { state = await readStateRaw(opts); }
  catch { return { ok: false, error: "the store could not be read, so nothing was planned (a real history must never be guessed empty)" }; }
  /* a test already current is refused before anything else is even checked:
     the owner's own next step is always to stop it first, whatever the new
     test's own args turn out to be, so that is the one thing worth saying */
  if (state.current)
    return { ok: false, error: "a test is already " + (state.current.start > today ? "planned" : "running") + ": stop it first" };
  const rawArgs = (args && typeof args === "object" && !Array.isArray(args)) ? args : {};
  const allowedKeys = Array.isArray(def.argKeys) ? def.argKeys : [];
  const extraKeys = Object.keys(rawArgs).filter(k => !allowedKeys.includes(k));
  if (extraKeys.length) return { ok: false, error: "unknown argument" + (extraKeys.length > 1 ? "s" : "") + ": " + extraKeys.join(", ") };
  const cleanArgs = {};
  for (const k of allowedKeys) {
    const v = rawArgs[k];
    if (v == null) continue;
    if (typeof v !== "string" || !v.trim() || v.length > ARG_STRING_MAX)
      return { ok: false, error: k + " must be a short piece of text, under " + ARG_STRING_MAX + " characters" };
    cleanArgs[k] = v;
  }
  if (typeof def.validateArgs === "function") {
    const manifest = opts.manifest !== undefined ? opts.manifest : localManifest();
    const v = def.validateArgs(cleanArgs, manifest);
    if (!v.ok) return { ok: false, error: v.error };
  }
  const next = { current: { id: def.id, start: startStr, args: cleanArgs }, history: state.history || [] };
  const wrote = await writeState(next, opts);
  if (!wrote) return { ok: false, error: "the store could not be written to" };
  return { ok: true, state: next };
}

/* rows: the same IG reel rows evaluate() reads, gathered by the caller
   (api/experiments.js, from api/_insights.js's own read()) -- this file
   never reaches into the network or the insights cache itself, so it stays
   testable with no store at all beyond the one key it owns. */
export async function stopExperiment(rows, opts = {}) {
  const ready = opts.kvReady || kvReady;
  if (!ready()) return { ok: false, error: "no store is configured, so nothing can be remembered" };
  let state;
  try { state = await readStateRaw(opts); }
  catch { return { ok: false, error: "the store could not be read, so the test was not stopped" }; }
  if (!state.current) return { ok: false, error: "no test is running" };
  const cur = resolveCurrent(state, EXPERIMENTS);
  const today = todayStr(opts.now);
  const finalEval = cur ? evaluate(cur, rows || [], today) : null;
  const entry = { ...(finalEval || { id: state.current.id }), start: state.current.start, args: state.current.args,
                   stoppedAt: opts.now ? new Date(opts.now).toISOString() : new Date().toISOString() };
  const next = { current: null, history: [entry, ...(state.history || [])].slice(0, HISTORY_KEEP) };
  const wrote = await writeState(next, opts);
  if (!wrote) return { ok: false, error: "the store could not be written to" };
  return { ok: true, state: next, evaluation: finalEval };
}
