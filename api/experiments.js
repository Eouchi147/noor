// NOOR · the experiments console door.
// ---------------------------------------------------------------------------
// GET  /api/experiments   {registry, state, evaluation, history}: what a test
//   could be, what is planned or running now (and how it reads so far), and
//   every test that has already finished.
// POST /api/experiments {action:"plan", id, start, args}   plans a test: sets
//   nexp:state's current, refusing when one is already current, the id is
//   unknown, or (reciter-pair) the reciters named do not both have 20 verse
//   reels on the shelf.
// POST /api/experiments {action:"stop"}   ends the current test, folding its
//   final reading into history.
//
// Owner-gated exactly like api/lantern-models.js: the console's signed
// cookie, or ADMIN_SECRET in a header for a hand-run request. This file is
// deliberately thin -- every real decision (the registry, the arithmetic,
// the store) lives in api/_experiments.js, which is what tests/experiments.mjs
// tests with no network at all; this file only wires it to the gate, the
// insights read the arithmetic needs, and the HTTP shape.
// ---------------------------------------------------------------------------

import { ownerGate } from "./_owner.js";
import { EXPERIMENTS, readState, resolveCurrent, evaluate, planExperiment, stopExperiment } from "./_experiments.js";
import { read as insightsRead } from "./_insights.js";
import { readCache as observatoryReadCache, invalidateCache as observatoryInvalidate } from "./observatory.js";

const json = (res, code, obj) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(obj);
};

/* the registry, as the owner's own console needs it: never the match
   functions themselves (a function is not JSON), only what a reader picks
   a test from -- its question, its two arms' own labels, and how long it
   runs. reciter-pair's own arms are asked with empty args, so its label
   reads as "Recited by the first reciter" until a real test names them. */
function registryPublic() {
  return Object.keys(EXPERIMENTS).map(id => {
    const e = EXPERIMENTS[id];
    const arms = (typeof e.arms === "function" ? e.arms({}) : e.arms) || {};
    return { id: e.id, question: e.question, kind: e.kind, days: e.days, minPerArm: e.minPerArm,
             arms: { A: (arms.A && arms.A.label) || "", B: (arms.B && arms.B.label) || "" } };
  });
}

/* GET here once cost about 660 slot reads every time (insightsRead's own
   60 day collect), on every console open and every Lantern question about
   a test -- the same 660 the Observatory's own room already pays once and
   keeps for ten minutes (api/observatory.js's own K_OBS cache). This reuses
   that cache's own `experiment` field, when it was computed against this
   exact test (the same id and the same start), for free.

   READ ONLY, NEVER COMPOSE, NEVER WRITE. api/observatory.js exports two
   doors onto that cache: `cached`, which composes (the full 660-read walk)
   and WRITES the cache on a miss, meant for the one room that owns it; and
   `readCache`, a plain GET with no compose and no SET at all. This file
   calls only the second: a cold or mismatched cache is answered here with
   a fresh insightsRead instead, exactly as before `cached` was ever tried,
   never by composing and writing a cache entry a read-only door has no
   business creating. (2026-09-25, second review: the first version of this
   fix called `cached`, which happily composed AND wrote K_OBS on a miss --
   a GET performing a write, and paying the 660 reads anyway.) */
async function readEvaluation(state, now) {
  const current = resolveCurrent(state, EXPERIMENTS);
  if (!current) return null;
  try {
    const obs = await observatoryReadCache({});
    if (obs && obs.experiment && obs.experiment.id === current.id && obs.experiment.start === current.start)
      return obs.experiment;
  } catch { /* a fault reading the shared cache falls through to a fresh read below */ }
  const ins = await insightsRead(60, {});
  return evaluate(current, ins.igRows || [], now || new Date().toISOString());
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const gate = ownerGate(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.reason });

  /* the same outer guard api/lantern-models.js keeps: a fault anywhere
     below (a malformed state, a store outage mid read) answers a plain
     refusal rather than a stack trace reaching the console */
  try {
    if (req.method === "GET") {
      const state = await readState({});
      const evaluation = await readEvaluation(state);
      return json(res, 200, { ok: true, registry: registryPublic(), state, evaluation, history: state.history || [] });
    }

    if (req.method !== "POST") return json(res, 405, { ok: false, error: "GET or POST only" });
    let body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    const action = String(body.action || "");

    if (action === "plan") {
      const r = await planExperiment(String(body.id || ""), String(body.start || ""), body.args || {}, {});
      /* a plan changes what the shared Observatory cache's own `experiment`
         field means; cleared so the next reader (this door, the Lantern,
         the Observatory itself) recomputes against the real state rather
         than an evaluation of whatever test used to be current */
      if (r.ok) await observatoryInvalidate({}).catch(() => {});
      return json(res, r.ok ? 200 : 400, r);
    }
    if (action === "stop") {
      const state = await readState({});
      const current = resolveCurrent(state, EXPERIMENTS);
      let rows = [];
      if (current) { const ins = await insightsRead(60, {}); rows = ins.igRows || []; }
      const r = await stopExperiment(rows, {});
      if (r.ok) await observatoryInvalidate({}).catch(() => {});
      return json(res, r.ok ? 200 : 400, r);
    }
    return json(res, 400, { ok: false, error: "unknown action" });
  } catch (e) {
    return json(res, 200, { ok: false, error: String(e && e.message || e).slice(0, 200) });
  }
}
