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
// The list of free models is no longer written here by hand: it is asked of
// OpenRouter at runtime and cached for six hours. See the note below.

/* ---------------------------------------------------------------------------
   THE LESSON OF AUGUST 2026: a hardcoded list of free models is a fuse.
   Eight of the ten names below vanished from OpenRouter within weeks of being
   written here. Every request walked a chain of 404s and the lantern went dark
   without a single word of complaint, because a failed chain and a quiet day
   look identical from the outside.
   So the chain is no longer a guess. The house asks OpenRouter itself which
   models are free right now, keeps the answer for six hours, and only falls
   back to the list below if that call cannot be made. Names that disappear are
   simply never asked for again. --------------------------------------------- */

/* Last-resort names, verified live against OpenRouter in August 2026.
   These are used only when the live list cannot be fetched. */
export const FREE_CHAIN = [
  "nvidia/nemotron-3.5-lightning:free",
  "poolside/laguna-s-2.1:free",
  "dots-studio/dots-3-note-preview:free",
  "liquid/lfm-2.5-2.6b:free"
];

/* Preference, not a requirement: if one of these is free today it goes first,
   because a bigger model writes a better paragraph. Anything unlisted is
   ordered after them by context length. */
const PREFERRED = [/nemotron.*(ultra|super|lightning)/i, /gemma/i, /gpt-oss/i, /qwen/i, /deepseek/i, /llama/i];

let LIVE = { at: 0, ids: [], err: "" };
const SIX_HOURS = 6 * 3600 * 1000;

function priceZero(m) {
  const p = m && m.pricing || {};
  const n = v => Number(v || 0);
  return n(p.prompt) === 0 && n(p.completion) === 0 && n(p.request) === 0;
}

/* Ask OpenRouter what is free today. Public endpoint, no key needed, so this
   works even when the key is missing and can therefore say so honestly. */
export async function refreshFreeModels(force) {
  const now = Date.now();
  if (!force && LIVE.ids.length && now - LIVE.at < SIX_HOURS) return LIVE.ids;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch("https://openrouter.ai/api/v1/models", { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    const list = (j.data || []).filter(m => m && m.id && (/:free$/i.test(m.id) || priceZero(m)));
    list.sort((a, b) => {
      const rank = m => { for (let i = 0; i < PREFERRED.length; i++) if (PREFERRED[i].test(m.id)) return i; return PREFERRED.length; };
      const d = rank(a) - rank(b);
      return d || (Number(b.context_length || 0) - Number(a.context_length || 0));
    });
    const ids = list.map(m => m.id);
    if (ids.length) LIVE = { at: now, ids, err: "" };
    else LIVE = { at: now, ids: [], err: "OpenRouter listed no free models" };
  } catch (e) {
    LIVE = { at: LIVE.at, ids: LIVE.ids, err: String(e && e.message || e).slice(0, 80) };
  }
  return LIVE.ids.length ? LIVE.ids : FREE_CHAIN;
}

/* What the house currently believes, without making a request. */
export function liveFreeInfo() {
  return { ids: LIVE.ids.slice(0, 12), count: LIVE.ids.length, ageMs: LIVE.at ? Date.now() - LIVE.at : null, err: LIVE.err };
}

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
  const base = LIVE.ids.length ? LIVE.ids : FREE_CHAIN;
  for (const m of base) if (!out.includes(m)) out.push(m);
  return out;
}

/* The same chain, but having first asked OpenRouter what is actually free.
   Every endpoint that can await should use this one. */
export async function liveChain() {
  await refreshFreeModels(false);
  return modelChain();
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
  if (!key) return { text: "", model: "", error: "no key", tried: [] };
  const chain = opts.chain || await liveChain();
  const max_tokens = opts.max_tokens || 400;
  const temperature = opts.temperature == null ? 0.4 : opts.temperature;
  /* Two clocks, because one is never enough: each model gets its own patience,
     and the whole walk has a deadline so a serverless function never hangs.
     A single shared abort was what killed the lantern: the first dead names
     spent the entire budget and the live model was never reached. */
  const perModel = opts.timeout || 9000;
  const deadline = Date.now() + (opts.budget || 22000);
  const maxTries = opts.maxTries || 4;
  const tried = [];
  let last = "";
  for (const model of chain.slice(0, maxTries)) {
    if (Date.now() > deadline) { last = "out of time"; break; }
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), Math.min(perModel, Math.max(1200, deadline - Date.now())));
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
      if (!r.ok) {
        /* "http 404" tells nobody anything. OpenRouter says exactly why in the
           body, and the difference matters enormously: a 404 here almost always
           means "no provider matches your privacy settings", which is one
           checkbox on their site, not a broken key. Read it and pass it on. */
        let why = "";
        try {
          const e = await r.json();
          why = String((e && e.error && (e.error.message || e.error)) || "").slice(0, 160);
        } catch { try { why = (await r.text()).slice(0, 160); } catch {} }
        last = "http " + r.status + (why ? ": " + why : "");
        tried.push({ model, ms: Date.now() - t0, err: last, status: r.status, why });
        continue;                                   /* dead name, rate limit, or refusal: next */
      }
      const j = await r.json();
      const text = ((((j.choices || [])[0] || {}).message || {}).content || "").trim();
      if (text) { tried.push({ model, ms: Date.now() - t0, err: "" }); return { text, model, error: "", tried }; }
      last = "empty";
      tried.push({ model, ms: Date.now() - t0, err: last });
    } catch (e) {
      last = String(e && e.message || e).slice(0, 60);
      tried.push({ model, ms: Date.now() - t0, err: last });
    }
  }
  return { text: "", model: "", error: last || "all models failed", tried };
}

/* A deliberate, minimal call whose only purpose is to answer "is the lantern
   lit?" out loud: does the key exist, which names are free today, and what
   does the first one that answers actually say. Used by /admin. */
export async function probeLantern() {
  const t0 = Date.now();
  const ids = await refreshFreeModels(true);
  const info = liveFreeInfo();
  const out = {
    key: !!process.env.OPENROUTER_API_KEY,
    keyTail: process.env.OPENROUTER_API_KEY ? "…" + String(process.env.OPENROUTER_API_KEY).slice(-4) : "",
    listed: info.count || ids.length,
    listErr: info.err,
    chain: modelChain().slice(0, 6),
    warning: modelWarning(),
    paid: allowPaid()
  };
  if (!out.key) { out.ok = false; out.error = "OPENROUTER_API_KEY is not set on this deployment"; out.ms = Date.now() - t0; return out; }
  const got = await askOpenRouter(
    [{ role: "user", content: "Reply with exactly one word: lit" }],
    { max_tokens: 12, temperature: 0, timeout: 9000, budget: 20000, maxTries: 4 });
  out.ok = !!got.text;
  out.answered = got.model;
  out.reply = String(got.text || "").slice(0, 60);
  out.error = got.error;
  out.tried = got.tried || [];
  out.ms = Date.now() - t0;

  /* Turn the pattern of failures into the one sentence that tells the owner
     what to do. These three cover essentially every way a working key still
     produces no words. */
  const st = out.tried.map(t => t.status).filter(Boolean);
  const body = out.tried.map(t => String(t.why || "")).join(" ").toLowerCase();
  if (!out.ok) {
    if (st.includes(401) || st.includes(403)) {
      out.verdict = "key";
      out.advice = "OpenRouter refused the key itself. Check that OPENROUTER_API_KEY in Vercel matches a key that still exists on openrouter.ai/keys, and redeploy after changing it.";
    } else if (/data policy|privacy|no endpoints|no allowed providers/.test(body) || (st.includes(404) && !st.includes(401))) {
      out.verdict = "policy";
      out.advice = "The key works, but no provider is allowed to answer. Free models are served by providers that may train on prompts, so OpenRouter hides them until you allow it: open openrouter.ai/settings/privacy and enable the free-model / prompt-training option. Nothing needs redeploying afterwards.";
    } else if (st.includes(429)) {
      out.verdict = "limit";
      out.advice = "Every model answered with a rate limit. Free models share a small daily allowance per account; it resets each day. Adding a few dollars of credit on OpenRouter raises that allowance permanently without making any request paid.";
    } else {
      out.verdict = "unknown";
      out.advice = "No model answered and none gave a reason the house recognises. The exact words each one returned are in the table below.";
    }
  }
  return out;
}
