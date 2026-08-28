// Which mind answers, what it costs, and why it must never be a guess.
//
// ---------------------------------------------------------------------------
// THE FAILURE THIS FILE WAS REWRITTEN FOR
//
// The lantern kept going dark, and the reason was one word: synchronous.
//
// modelChain() is a plain function. It reads an in-process variable, LIVE,
// that is filled by an awaited fetch to OpenRouter. On Vercel, every cold
// start begins with LIVE empty, so modelChain() returned the hardcoded
// fallback list instead. Four endpoints called it that way: the assistant,
// the dedications, the marketing writer and part of the illuminations. On a
// cold start each of them walked four model names written down in August,
// every one of which OpenRouter had since retired, and then returned nothing.
//
// A cold start is not the rare case on a site with this much traffic. It is
// most invocations. So most of the time, most of the Lantern was asking dead
// names for an answer, waiting nine seconds each, and giving up in silence.
//
// Three things changed.
//
//   1. The free list now lives in the store, not in a variable. Any instance,
//      however cold, reads the last good list in one round trip instead of
//      falling back to a list written weeks ago.
//   2. The house remembers which model actually answered last, and asks that
//      one first. The fastest chain is the one that starts with a name known
//      to work an hour ago.
//   3. The hardcoded list is now the third fallback and not the first, and it
//      is explicitly labelled as what it is: a guess of last resort.
//
// The rule about money is unchanged and absolute. Nothing bills unless
// somebody deliberately turns billing on. Anything not on OpenRouter's own
// free list is dropped before the request is made, including whatever
// OPENROUTER_MODEL happens to be set to, unless ALLOW_PAID_MODELS=1 says
// otherwise in as many words.
// ---------------------------------------------------------------------------

import { kv, kvReady } from "./_kv.js";

/* Last-resort names. These are a guess and they are dated, which is the whole
   point: they are reached only when both the store and OpenRouter are
   unreachable at the same moment. If you are reading these in a log, the two
   layers in front of them have both failed. */
export const FREE_CHAIN = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "mistralai/mistral-small-3.2-24b-instruct:free"
];

const K_FREE = "nlm:free";      /* the live free list, as last seen */
const K_GOOD = "nlm:good";      /* the last model that actually produced words */
const SIX_HOURS = 6 * 3600 * 1000;
const KEEP = 60 * 60 * 24 * 30; /* the store keeps a month, long past useful */

let LIVE = { at: 0, ids: [], err: "", from: "" };
let GOOD = "";

/* ---------------------------------------------------------------------------
   ranking: which free model should answer first
   A free model is not automatically a good one. Three things are weighed:
   whether it is from a family that writes decent prose, how much context it
   can hold, and whether it can accept text at all. Nothing here is a promise
   of quality, only an ordering that is better than alphabetical.
--------------------------------------------------------------------------- */
const TIERS = [
  /deepseek/i, /llama-3\.[13]|llama-4/i, /qwen.*(72b|max|235b|plus)/i,
  /gemma-3/i, /mistral-(small|medium|large)/i, /gpt-oss/i, /nemotron/i,
  /glm-4/i, /kimi/i, /qwen/i, /llama/i, /gemma/i, /phi-4/i
];

function tier(id) {
  for (let i = 0; i < TIERS.length; i++) if (TIERS[i].test(id)) return i;
  return TIERS.length;
}

function usable(m) {
  /* image and embedding models are free and useless here */
  const a = (m && m.architecture) || {};
  const inp = a.input_modalities || (a.modality ? String(a.modality).split("->")[0] : "");
  const out = a.output_modalities || (a.modality ? String(a.modality).split("->")[1] : "");
  const has = (v, w) => Array.isArray(v) ? v.some(x => String(x).includes(w)) : String(v || "").includes(w);
  if (inp && !has(inp, "text")) return false;
  if (out && !has(out, "text")) return false;
  return true;
}

function priceZero(m) {
  const p = (m && m.pricing) || {};
  const n = v => Number(v || 0);
  return n(p.prompt) === 0 && n(p.completion) === 0 && n(p.request) === 0;
}

/* ---------------------------------------------------------------------------
   the store layer
   Every call is wrapped: a store that is missing or slow must never be the
   reason the lantern stays dark. It degrades to the network, then to the list.
--------------------------------------------------------------------------- */
async function readStore() {
  if (!kvReady()) return null;
  try {
    const r = await kv([["GET", K_FREE], ["GET", K_GOOD]]);
    const raw = r && r[0], good = r && r[1];
    if (good && typeof good === "string") GOOD = good;
    if (!raw) return null;
    const j = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (j && Array.isArray(j.ids) && j.ids.length) return j;
  } catch { /* the store is optional, always */ }
  return null;
}

async function writeStore(ids) {
  if (!kvReady() || !ids || !ids.length) return;
  try {
    await kv([["SET", K_FREE, JSON.stringify({ at: Date.now(), ids })],
              ["EXPIRE", K_FREE, String(KEEP)]]);
  } catch { }
}

async function rememberGood(model) {
  if (!model || model === GOOD) return;
  GOOD = model;
  if (!kvReady()) return;
  try { await kv([["SET", K_GOOD, model], ["EXPIRE", K_GOOD, String(KEEP)]]); } catch { }
}

/* ---------------------------------------------------------------------------
   Ask OpenRouter what is free today. Public endpoint, no key needed, so this
   works even when the key is missing and can therefore say so honestly.
--------------------------------------------------------------------------- */
export async function refreshFreeModels(force) {
  const now = Date.now();
  if (!force && LIVE.ids.length && now - LIVE.at < SIX_HOURS) return LIVE.ids;

  /* the store first: one round trip, and it is almost always current */
  if (!force) {
    const s = await readStore();
    if (s && now - Number(s.at || 0) < SIX_HOURS) {
      LIVE = { at: Number(s.at), ids: s.ids, err: "", from: "store" };
      return LIVE.ids;
    }
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch("https://openrouter.ai/api/v1/models", { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    const list = (j.data || []).filter(m => m && m.id && usable(m) && (/:free$/i.test(m.id) || priceZero(m)));
    list.sort((a, b) => {
      const d = tier(a.id) - tier(b.id);
      return d || (Number(b.context_length || 0) - Number(a.context_length || 0));
    });
    const ids = list.map(m => m.id);
    if (ids.length) {
      LIVE = { at: now, ids, err: "", from: "openrouter" };
      writeStore(ids);                       /* not awaited: the answer is ready */
    } else {
      LIVE = { at: now, ids: LIVE.ids, err: "OpenRouter listed no free models", from: LIVE.from };
    }
  } catch (e) {
    /* the network failed. Fall back to whatever the store holds, however old:
       a list from yesterday is worth far more than a list from August. */
    const s = await readStore();
    if (s && s.ids.length) LIVE = { at: Number(s.at || 0), ids: s.ids, err: String(e && e.message || e).slice(0, 80), from: "store (stale)" };
    else LIVE = { at: LIVE.at, ids: LIVE.ids, err: String(e && e.message || e).slice(0, 80), from: LIVE.from || "none" };
  }
  return LIVE.ids.length ? LIVE.ids : FREE_CHAIN;
}

/* What the house currently believes, without making a request. */
export function liveFreeInfo() {
  return { ids: LIVE.ids.slice(0, 12), count: LIVE.ids.length,
           ageMs: LIVE.at ? Date.now() - LIVE.at : null, err: LIVE.err,
           from: LIVE.from || "none", good: GOOD };
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

function assemble(base) {
  const out = [];
  const push = m => { if (m && !out.includes(m)) out.push(m); };
  const wanted = String(process.env.OPENROUTER_MODEL || "").trim();
  if (wanted && (isFree(wanted) || allowPaid())) push(wanted);
  /* the name that answered last time goes next, if it is still on the list */
  if (GOOD && (isFree(GOOD) || allowPaid()) && (!base.length || base.includes(GOOD))) push(GOOD);
  for (const m of base) push(m);
  return out;
}

/* The synchronous chain. It is honest about being possibly stale, and it is
   kept only for callers that genuinely cannot await. Prefer liveChain. */
export function modelChain() {
  return assemble(LIVE.ids.length ? LIVE.ids : FREE_CHAIN);
}

/* The chain every endpoint should use: asks the store, then OpenRouter, then
   the written list, and always puts the last working name in front. */
export async function liveChain() {
  await refreshFreeModels(false);
  return assemble(LIVE.ids.length ? LIVE.ids : FREE_CHAIN);
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
   half of the protocol. Walks the chain until one answers, and remembers
   which one did. */
export async function askOpenRouter(messages, opts = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { text: "", model: "", error: "no key", tried: [] };
  const chain = opts.chain || await liveChain();
  const max_tokens = opts.max_tokens || 400;
  const temperature = opts.temperature == null ? 0.4 : opts.temperature;
  /* Two clocks, because one is never enough: each model gets its own patience,
     and the whole walk has a deadline so a serverless function never hangs.
     A single shared abort was what killed the lantern once before: the first
     dead names spent the entire budget and the live model was never reached. */
  const perModel = opts.timeout || 9000;
  const deadline = Date.now() + (opts.budget || 22000);
  const maxTries = opts.maxTries || 5;
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
          "X-Title": opts.title || "NOOR Codex of Light"
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
        } catch { try { why = (await r.text()).slice(0, 160); } catch { } }
        last = "http " + r.status + (why ? ": " + why : "");
        tried.push({ model, ms: Date.now() - t0, err: last, status: r.status, why });
        /* a name OpenRouter no longer knows must not be asked again this run */
        if (r.status === 404 && GOOD === model) GOOD = "";
        continue;
      }
      const j = await r.json();
      const text = ((((j.choices || [])[0] || {}).message || {}).content || "").trim();
      if (text) {
        tried.push({ model, ms: Date.now() - t0, err: "" });
        rememberGood(model);                 /* not awaited: the answer is ready */
        return { text, model, error: "", tried };
      }
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
    listFrom: info.from,
    lastGood: info.good || "",
    store: kvReady(),
    chain: (await liveChain()).slice(0, 6),
    warning: modelWarning(),
    paid: allowPaid()
  };
  if (!out.key) { out.ok = false; out.error = "OPENROUTER_API_KEY is not set on this deployment"; out.ms = Date.now() - t0; return out; }
  const got = await askOpenRouter(
    [{ role: "user", content: "Reply with exactly one word: lit" }],
    { max_tokens: 12, temperature: 0, timeout: 9000, budget: 20000, maxTries: 5 });
  out.ok = !!got.text;
  out.answered = got.model;
  out.reply = String(got.text || "").slice(0, 60);
  out.error = got.error;
  out.tried = got.tried || [];
  out.ms = Date.now() - t0;

  /* Turn the pattern of failures into the one sentence that tells the owner
     what to do. These four cover essentially every way a working key still
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

/* Called by the nightly cron. Forces a fresh list into the store so that every
   cold start tomorrow reads a list that is at most a day old, and never the
   written fallback. */
export async function refreshIntoStore() {
  const ids = await refreshFreeModels(true);
  await writeStore(ids);
  return { count: ids.length, from: LIVE.from, err: LIVE.err, top: ids.slice(0, 5) };
}
