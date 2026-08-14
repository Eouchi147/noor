// Which mind answers, and what it costs.
//
// The bill that prompted this file came from two lines. api/daily-light.js
// defaulted to anthropic/claude-sonnet-4.5, and api/guide.js defaulted to
// openrouter/auto, which is a router that picks the BEST model, not the
// cheapest. Neither said so where anyone would read it, and both ran on the
// same key as everything else. A default nobody chose is still a default
// somebody pays for.
//
// So the rule is inverted here. Nothing bills unless somebody deliberately
// turns billing on. Every model in the chain below is free on OpenRouter, and
// anything that is not on the free list is dropped before the request is made,
// including whatever OPENROUTER_MODEL happens to be set to, unless
// ALLOW_PAID_MODELS=1 says otherwise in as many words.
//
// Verified against OpenRouter's own model list in August 2026. Free models
// come and go; a name that disappears simply fails and the next one answers,
// which is the point of a chain. Check the list occasionally at
// https://openrouter.ai/models?max_price=0

/* Free, in order of how good the answer is likely to be.
   The quality numbers are OpenRouter's own comparative scores, kept here as a
   comment so a future edit can see why the order is the order. */
export const FREE_CHAIN = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",      // 1M context, the strongest free one
  "google/gemma-4-31b-it:free",                  // 262K, vision and tools
  "nvidia/nemotron-3-super-120b-a12b:free",      // 262K
  "google/gemma-4-26b-a4b-it:free",              // 262K
  "nvidia/nemotron-3.5-lightning:free",          // 1M, fast and light
  "openai/gpt-oss-20b:free",                     // 131K
  "nvidia/nemotron-3-nano-30b-a3b:free",         // 256K
  "poolside/laguna-s-2.1:free",                  // 262K
  "nvidia/nemotron-nano-9b-v2:free",             // 128K
  "openrouter/free"                              // the house's own free router, last resort
];

/* Anything ending in :free is free by OpenRouter's own naming, and
   openrouter/free is their free-only router. Everything else may bill. */
export function isFree(id) {
  const m = String(id || "").trim();
  return /:free$/i.test(m) || m === "openrouter/free";
}

export function allowPaid() {
  return process.env.ALLOW_PAID_MODELS === "1";
}

/* The chain every endpoint should use.
   A model named in OPENROUTER_MODEL goes first, but only if it is free, or if
   paid models have been deliberately allowed. A paid name that slips into the
   environment is dropped and reported rather than quietly charged. */
export function modelChain() {
  const wanted = String(process.env.OPENROUTER_MODEL || "").trim();
  const out = [];
  if (wanted && (isFree(wanted) || allowPaid())) out.push(wanted);
  for (const m of FREE_CHAIN) if (!out.includes(m)) out.push(m);
  return out;
}

/* What was dropped and why, so /admin can say it out loud rather than leaving
   the owner to discover it on a statement. */
export function modelWarning() {
  const wanted = String(process.env.OPENROUTER_MODEL || "").trim();
  if (wanted && !isFree(wanted) && !allowPaid()) {
    return `OPENROUTER_MODEL is set to "${wanted}", which is not a free model. It is being ignored and the free chain is used instead. Set ALLOW_PAID_MODELS=1 if you really mean to pay for it.`;
  }
  if (allowPaid()) return "ALLOW_PAID_MODELS is on: paid models may be billed to your key.";
  return "";
}

/* One place that knows how to ask OpenRouter, so no endpoint invents its own
   half of the protocol. Walks the chain until one answers. */
export async function askOpenRouter(messages, opts = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { text: "", model: "", error: "no key" };
  const chain = opts.chain || modelChain();
  const max_tokens = opts.max_tokens || 400;
  const temperature = opts.temperature == null ? 0.4 : opts.temperature;
  let last = "";
  for (const model of chain) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opts.timeout || 25000);
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: "Bearer " + key,
          "HTTP-Referer": "https://noorcodex.com",
          "X-Title": "NOOR Codex of Light"
        },
        body: JSON.stringify({ model, messages, max_tokens, temperature, stream: false }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!r.ok) { last = "http " + r.status; continue; }   /* rate limited or gone: try the next */
      const j = await r.json();
      const text = ((((j.choices || [])[0] || {}).message || {}).content || "").trim();
      if (text) return { text, model, error: "" };
      last = "empty";
    } catch (e) {
      last = String(e && e.message || e).slice(0, 60);
    }
  }
  return { text: "", model: "", error: last || "all models failed" };
}
