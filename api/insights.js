// What strangers watch: the owner's read of the last fortnight's posts.
//
// GET  /api/insights?days=14        the aggregate, from what the cache holds
// POST /api/insights {action:"refresh", days}   read one batch of media from
//      the networks and say how much is left; the console asks again while
//      the answer says partial.
// POST /api/insights {action:"snapshot"}   one photograph a day of every
//      live post's numbers, kept under its own key (api/_insights.js,
//      snapshot); owner or the daily cron, never a plain visitor.
// GET  /api/insights?action=numbers   this week against the week before it,
//      per network, per kind, per weekday and per slot hour, read from the
//      snapshots alone -- no network call. Owner only.
//
// Owner-gated like api/visitors.js: the console's cookie, or the secret in a
// header for a hand-run request. The arithmetic and the network calls live in
// api/_insights.js so they can be tested with the networks stubbed.

import crypto from "crypto";
import { ownerGate } from "./_owner.js";
import { kvReady, kvKind } from "./_kv.js";
import { read, refresh, snapshot, numbers } from "./_insights.js";

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

/* THE SAME DOOR api/social.js OPENS FOR ITS OWN CRON, FOR EXACTLY ONE
   ACTION. The nightly snapshot is taken by the warm run's own daily cron
   (api/warm.js, a direct call, since it already runs server side and needs
   no HTTP round trip); this door exists so a Vercel cron pointed straight
   at ?action=snapshot, or a hand-run request carrying CRON_SECRET, is also
   admitted, the same proof social.js's `due` action already accepts. Every
   other action stays owner-only. */
function cronMaySnapshot(req) {
  const secret = process.env.CRON_SECRET || "";
  const bearer = String((req.headers || {}).authorization || "").replace(/^Bearer\s+/i, "");
  const bearerOk = !!secret && bearer.length === secret.length && crypto.timingSafeEqual(Buffer.from(bearer), Buffer.from(secret));
  const fromVercelCron = !!req.headers["x-vercel-signature"] || /vercel-cron/i.test(String(req.headers["user-agent"] || ""));
  return secret ? bearerOk : fromVercelCron;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const q = req.query || {};
  let body = {};
  if (req.method === "POST") {
    body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  }
  const cronOk = req.method === "POST" && body.action === "snapshot" && cronMaySnapshot(req);
  const gate = ownerGate(req);
  if (!gate.ok && !cronOk) return json(res, gate.code, { error: gate.reason });
  const days = Math.max(1, Math.min(60, parseInt(q.days || body.days || "14", 10) || 14));
  if (!kvReady()) return json(res, 200, { ok: false, enabled: false, store: kvKind(), days,
    error: "no store is configured, so no post record can be read" });

  try {
    if (req.method === "POST") {
      if (body.action === "snapshot") {
        const out = await snapshot({ manifest: await manifest(), force: body.force === true, days: body.days });
        return json(res, 200, { ...out, enabled: true, store: kvKind() });
      }
      if (body.action !== "refresh") return json(res, 400, { ok: false, error: "unknown action" });
      const out = await refresh(days, { manifest: await manifest(), force: body.force === true });
      return json(res, 200, { ...out, enabled: true, store: kvKind() });
    }
    if (String(q.action || "") === "numbers") {
      const out = await numbers({});
      return json(res, 200, { ...out, enabled: true, store: kvKind() });
    }
    const out = await read(days, { manifest: await manifest() });
    return json(res, 200, { ...out, enabled: true, store: kvKind() });
  } catch (e) {
    return json(res, 200, { ok: false, enabled: true, days, error: String(e && e.message || e).slice(0, 200) });
  }
}
