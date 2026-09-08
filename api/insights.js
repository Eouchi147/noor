// What strangers watch: the owner's read of the last fortnight's posts.
//
// GET  /api/insights?days=14        the aggregate, from what the cache holds
// POST /api/insights {action:"refresh", days}   read one batch of media from
//      the networks and say how much is left; the console asks again while
//      the answer says partial.
//
// Owner-gated like api/visitors.js: the console's cookie, or the secret in a
// header for a hand-run request. The arithmetic and the network calls live in
// api/_insights.js so they can be tested with the networks stubbed.

import { ownerGate } from "./_owner.js";
import { kvReady, kvKind } from "./_kv.js";
import { read, refresh } from "./_insights.js";

const json = (res, code, obj) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(obj);
};

/* the shelf, so a reel's kind can be named; the production host, because a
   preview deployment has no /reels of its own */
const SITE = () => (process.env.SITE_HOST || "noorcodex.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
async function manifest() {
  try {
    const r = await fetch("https://" + SITE() + "/reels/index.json", { cache: "no-store" });
    return r && r.ok ? await r.json() : null;
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const gate = ownerGate(req);
  if (!gate.ok) return json(res, gate.code, { error: gate.reason });
  const q = req.query || {};
  let body = {};
  if (req.method === "POST") {
    body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  }
  const days = Math.max(1, Math.min(60, parseInt(q.days || body.days || "14", 10) || 14));
  if (!kvReady()) return json(res, 200, { ok: false, enabled: false, store: kvKind(), days,
    error: "no store is configured, so no post record can be read" });

  try {
    if (req.method === "POST") {
      if (body.action !== "refresh") return json(res, 400, { ok: false, error: "unknown action" });
      const out = await refresh(days, { manifest: await manifest() });
      return json(res, 200, { ...out, enabled: true, store: kvKind() });
    }
    const out = await read(days, { manifest: await manifest() });
    return json(res, 200, { ...out, enabled: true, store: kvKind() });
  } catch (e) {
    return json(res, 200, { ok: false, enabled: true, days, error: String(e && e.message || e).slice(0, 200) });
  }
}
