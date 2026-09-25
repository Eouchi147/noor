// NOOR · what the Lantern's three providers look like right now, owner only.
//
// GET  /api/lantern-models
//      which providers are configured (never the keys, only "set"/"missing"),
//      the live free models per provider per tier, today's and the last
//      week's usage against the budgets, and the last model that actually
//      answered for each tier.
// POST /api/lantern-models {action:"probe"}
//      sends one tiny prompt through each tier and reports the latency and
//      which model answered, or why none did.
//
// Owner-gated like api/insights.js. The arithmetic lives in api/_llm.js so it
// can be tested with the networks and the store stubbed.

import { ownerGate } from "./_owner.js";
import { kvReady, kvKind } from "./_kv.js";
import { providersConfigured, chainFor, usageReport, goodFor, route, chatOnce } from "./_llm.js";

const json = (res, code, obj) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(obj);
};

const TIER_NAMES = ["fast", "strong", "long"];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const gate = ownerGate(req);
  if (!gate.ok) return json(res, gate.code, { error: gate.reason });

  try {
    if (req.method === "POST") {
      let body = req.body || {};
      if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
      if (body.action !== "probe") return json(res, 400, { ok: false, error: "unknown action" });

      /* {action:"probe", each:true} asks every name in every tier once,
         directly, so a provider that the router never reaches (because a
         name above it answered) is still known to work */
      if (body.each) {
        const each = {};
        for (const tier of TIER_NAMES) {
          each[tier] = [];
          for (const c of await chainFor(tier, { skipGood: true })) {
            const got = await chatOnce(c.provider, c.model, [{ role: "user", content: "Reply with exactly one word: lit" }], { max_tokens: 12, temperature: 0, timeout: 9000 });
            each[tier].push({ provider: c.provider, model: c.model, ok: !!got.ok, ms: got.ms, error: got.ok ? "" : String(got.error || "").slice(0, 200), said: got.ok ? String(got.content || "").slice(0, 40) : "" });
          }
        }
        return json(res, 200, { ok: true, each });
      }
      const probe = {};
      for (const tier of TIER_NAMES) {
        const t0 = Date.now();
        const got = await route({
          tier,
          messages: [{ role: "user", content: "Reply with exactly one word: lit" }],
          opts: { max_tokens: 12, temperature: 0, timeout: 9000 }
        });
        probe[tier] = {
          ok: got.ok, provider: got.provider || "", model: got.model || "",
          ms: Date.now() - t0, error: got.ok ? "" : (got.error || ""), tried: got.tried || []
        };
      }
      return json(res, 200, { ok: true, probe });
    }

    const providers = providersConfigured();
    const tiers = {};
    const good = {};
    for (const tier of TIER_NAMES) {
      tiers[tier] = await chainFor(tier);
      good[tier] = await goodFor(tier);
    }
    const usage = await usageReport(7);
    return json(res, 200, { ok: true, providers, tiers, good, usage, store: kvKind(), storeReady: kvReady() });
  } catch (e) {
    return json(res, 200, { ok: false, error: String(e && e.message || e).slice(0, 200) });
  }
}
