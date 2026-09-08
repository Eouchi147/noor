// The house, in one call.
//
// GET /api/house?action=steward[&fresh=1]   what matters today, as findings
// GET /api/house?action=flow[&days=14][&fresh=1]   where the energy goes
//
// One route with two actions, because the deployment counts functions and a
// second file for a second read would cost one for nothing. GET reads, POST
// asks for the same read fresh; nothing here writes to a network, moves a
// dial, or sends a post. Every action a finding offers is a call to a route
// that already exists (api/social.js, api/insights.js, api/threads.js,
// api/admin-data.js), so this route can be read-only and stay that way.
//
// Owner-gated exactly as api/insights.js is: the console's signed cookie, or
// the secret in a header for a hand-run request. The arithmetic and the
// reading live in api/_steward.js and api/_flow.js so they can be tested with
// the store, Stripe and the Lantern all stubbed.

import { ownerGate } from "./_owner.js";
import { kvReady, kvKind } from "./_kv.js";
import { steward } from "./_steward.js";
import { cached as flowCached, DEFAULT_DAYS, MAX_DAYS } from "./_flow.js";

const json = (res, code, obj) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(obj);
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const gate = ownerGate(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.reason });

  const q = req.query || {};
  let body = {};
  if (req.method === "POST") {
    body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  }
  if (req.method !== "GET" && req.method !== "POST")
    return json(res, 405, { ok: false, error: "GET or POST" });

  const action = String(q.action || body.action || "steward").trim().toLowerCase();
  /* a read that has never been made is not a read that is old: fresh=1 is how
     the console asks for the answer again after it has changed something */
  const fresh = String(q.fresh || body.fresh || "") === "1" || body.fresh === true;
  const host = req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL || "noorcodex.com";

  /* Without a store there are no slot records, no counters and no cache, so
     there is nothing to read and saying so is the honest answer. */
  if (!kvReady())
    return json(res, 200, { ok: false, enabled: false, store: kvKind(), action,
      error: "no store is configured, so there is nothing to read the house from" });

  try {
    if (action === "steward") {
      const out = await steward({ fresh, host });
      return json(res, 200, { ...out, enabled: true, store: kvKind() });
    }
    if (action === "flow") {
      const days = Math.max(1, Math.min(MAX_DAYS, parseInt(q.days || body.days || String(DEFAULT_DAYS), 10) || DEFAULT_DAYS));
      const out = await flowCached(days, { fresh, host });
      return json(res, 200, { ...out, enabled: true, store: kvKind() });
    }
    return json(res, 400, { ok: false, error: "unknown action: " + action + ". This route answers steward and flow." });
  } catch (e) {
    return json(res, 200, { ok: false, enabled: true, action,
      error: String((e && e.message) || e).slice(0, 200) });
  }
}
