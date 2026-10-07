// NOOR · the Lantern's model router: three free providers, never billed,
// plus one paid "deep" tier for the Soul alone, under a hard monthly cap.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
//
// api/_models.js taught the house one hard lesson: a model chain that only
// tries one provider goes dark exactly when that provider is slow, out of
// quota, or between deploys of its own free roster. OpenRouter alone gives
// the Lantern one throat to choke. Groq and Gemini both publish a real free
// tier reachable with the same OpenAI-compatible request shape, so the
// Lantern can now walk three providers instead of one model list on one.
//
// The rule that must never bend: nothing here can cost money. Every model
// this file will speak to is checked against a live, provider-specific free
// list before a single byte is sent, every time, with no override for Groq
// or Gemini. OpenRouter's own ALLOW_PAID_MODELS variable exists in
// api/_models.js (unchanged) but this file never reads it: allowPaid() below
// answers whether it is set, for the console to show, and nothing in the
// call path here honours it, so writing "OpenRouter keeps its own escape
// hatch" without saying this file ignores it would have been the kind of
// half-truth this house does not print. Groq and Gemini get no such
// variable at all, because the research behind this file could not find a
// published, checkable "still free" signal for their paid tiers the way
// OpenRouter's :free suffix and zero pricing give one. A gate nobody can
// prove is a gate nobody should build.
//
// THE ONE EXCEPTION, ADDED 2 OCTOBER 2026 (SOUL.md, the Brain row and §9).
// route({tier:"deep"}) may pay, and only it: a short code list of strong
// OpenRouter models (DEEP_MODELS, §8), each checked against OpenRouter's
// live price before every call and refused above a code price ceiling, each
// call refused unless its worst case still fits under the month's cap
// (DEEP_CAP_USD_MAX, 10 USD, which no variable can raise), and the actual
// cost written to the spend ledger afterwards. Per-person data never takes
// that door. The fast, strong and long tiers, isAllowed() and chatOnce()
// are exactly as free-only as they were; the paid call goes through a
// private sender no other path can reach, and ALLOW_PAID_MODELS still opens
// nothing here.
//
// ROUND FOUR, 7 OCTOBER 2026 (the owner: "the best free models ... and it
// can use paid models if needed but ... use them scarcely"). Five changes,
// each marked "round four" where it lives:
//   1. two more free doors: the AI Gateway's own free models (§1b), found
//      live by their zero price, reached by the deployment's OIDC token (the
//      same credential as api/_jev.js), every request carrying zero data
//      retention and no training (GATEWAY_PRIVACY); and Cerebras, only when a
//      CEREBRAS_API_KEY is set;
//   2. a scoreboard per model (§4b): answered, failed, its checks passed,
//      latency and the last error, two weeks deep, written in the same
//      pipeline as the usage after every call; inside each tier the free
//      names are ordered by that measured quality, the tier's own order (the
//      lead provider first) breaking ties;
//   3. Groq's real limit, tokens a minute, is counted (CAPS.groq.tpm);
//   4. the deep tier pays only for one of five named uses (PAID_PURPOSES),
//      under a day's cap of 0.50 dollars inside the month's 10, and never for
//      a call whose worst case passes 0.10 dollars unless it is the Monday
//      strategy; the mail tier pays only for a letter retry;
//   5. every paid call is a line in the ROI ledger nsoul:paid:<YYYY-MM>,
//      {at, task, model, costUsd, outcome}, the outcome filled in later by
//      what the call led to (paidOutcome).
//
// ROUND FIVE, 7 OCTOBER 2026 (the models review, each marked "round five"):
//   D1. the paid caps hold under parallel calls and a store that refuses
//       writes: the worst case is held before the call, the actual put in
//       its place after, and a cost that cannot be written closes the paid
//       door for the day for every caller (section 8);
//   D4. a paid call that can carry mail or a person's words asks OpenRouter
//       for zero data retention endpoints only (zdr: true);
//   D7. an unmeasured name is no longer ranked under every measured one, and
//       once an hour a tier asks the best name not measured for a day first,
//       so one bad hour no longer demotes a lead for good (section 4b);
//   and NVIDIA's API catalog joins the free doors for totals only (fast,
//   strong, long; never mail, never a person's words), found live, ranked by
//   the scoreboard, and held back until the owner says NVIDIA allows his use
//   (NVIDIA_PRODUCTION_OK, section 1c: its free catalog is a trial).
//
// "FREE" BELONGS TO THE ACCOUNT, NOT THE MODEL. A model named on an
// allow-list is only actually free if the account whose key answers for it
// has no billing turned on: a Groq organisation still on its free plan, or
// a Google AI Studio key whose project carries no billing account. The keys
// this file speaks to must come from accounts kept that way; see
// OPERATIONS.md's own rows for GROQ_API_KEY and GEMINI_API_KEY.
//
// The second rule: the library's anonymity is not a routing preference, it
// is a wall. A journal entry or a visitor-identifying row must never reach
// a model, not redacted, not summarised: refused outright, before anything
// else in the message is even looked at. See scrub() below.
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import { kv, kvReady } from "./_kv.js";
import { isFree as orIsFree, refreshFreeModels as orRefreshFreeModels } from "./_models.js";
import { GATEWAY_PRIVACY, credential as gatewayCredential } from "./_jev.js";   /* round four */

/* ---------------------------------------------------------------------------
   1. PROVIDERS. One OpenAI-compatible base URL each; a provider with no key
      set on this deployment simply does not exist, quietly, the same way a
      missing OPENROUTER_API_KEY already makes the Lantern fall back to
      written text rather than error.

      Round four: "gateway" is Vercel's AI Gateway (its OpenAI-compatible
      chat completions, docs/ai-gateway), keyed by AI_GATEWAY_API_KEY or the
      deployment's own OIDC token, exactly as api/_jev.js reaches Jev; and
      "cerebras" (inference-docs.cerebras.ai, read 7 October 2026: the base
      https://api.cerebras.ai/v1, a Bearer CEREBRAS_API_KEY), present only
      when that key is set.

      Round five: "nvidia" is NVIDIA's API catalog (build.nvidia.com), the
      OpenAI-compatible https://integrate.api.nvidia.com/v1 with a Bearer
      NVIDIA_API_KEY, present only when that key is set AND the owner has set
      NVIDIA_PRODUCTION_OK=1 (section 1c says why).
--------------------------------------------------------------------------- */
const PROVIDER_BASE = {
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  gateway: "https://ai-gateway.vercel.sh/v1",
  cerebras: "https://api.cerebras.ai/v1",
  nvidia: "https://integrate.api.nvidia.com/v1"
};
const PROVIDER_KEYENV = {
  openrouter: "OPENROUTER_API_KEY",
  groq: "GROQ_API_KEY",
  gemini: "GEMINI_API_KEY",
  gateway: "AI_GATEWAY_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  nvidia: "NVIDIA_API_KEY"
};
const PROVIDERS = Object.keys(PROVIDER_KEYENV);

/* round five: the owner's own word that NVIDIA allows his use of its free
   catalog in production (its trial terms say it does not, section 1c) */
export const NVIDIA_OK_ENV = "NVIDIA_PRODUCTION_OK";
const nvidiaAllowed = () => String(process.env[NVIDIA_OK_ENV] || "").trim() === "1";
/* the key is there but the door is held: what the models view says */
export function nvidiaHeld() { return !!String(process.env.NVIDIA_API_KEY || "").trim() && !nvidiaAllowed(); }

function keyFor(provider) {
  if (provider === "gateway") return String(gatewayCredential() || "").trim();   /* round four: the key, or the OIDC token */
  if (provider === "nvidia" && !nvidiaAllowed()) return "";                      /* round five: held until he says */
  return String(process.env[PROVIDER_KEYENV[provider]] || "").trim();
}
export function providerPresent(provider) { return !!keyFor(provider); }
export function providersConfigured() {
  const out = {};
  for (const p of PROVIDERS) out[p] = providerPresent(p) ? "set" : (p === "nvidia" && nvidiaHeld() ? "held" : "missing");   /* round five: a key held back by its terms */
  return out;
}

/* ---------------------------------------------------------------------------
   2. FREE-ONLY ALLOW-LISTS, DOCUMENTED.
      OpenRouter needs no list of its own: api/_models.js's refreshFreeModels
      already keeps only ids that end ":free" and price at zero on the live
      catalogue, which is the strictest test of the three.

      Groq: console.groq.com/docs/rate-limits, read 2026-09-24
      (lantern-research.md Part A). Only these four appeared in the free-tier
      table there; llama-3.3-70b-versatile and others exist on Groq but their
      free limits were not confirmed in writing, so they are left out until
      measured against a live key rather than guessed.

      Gemini: ai.google.dev/gemini-api/docs/pricing, read 2026-09-24. The 3.x
      Flash and Flash-Lite family carries a free tier; 3.1 Pro Preview does
      not and is deliberately absent. Google does not publish numeric RPM or
      RPD for the 3.x generation, which is why §4's bucket for Gemini is a
      conservative guess, not a measured cap.
--------------------------------------------------------------------------- */
const GROQ_ALLOW = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-safeguard-20b",
  "qwen/qwen3.8-27b"
];
/* round four, read again 7 October 2026: Groq's free table and Gemini's
   pricing page still name exactly these (ai.google.dev/gemini-api/docs/
   pricing: the 3.8, 3.7, 3.6 and 3.5 Flash and the 3.5 and 3.1 Flash-Lite
   "Free of charge", 3.1 Pro Preview "Not available"), so the lists stand. */
const GEMINI_FLASH_ORDER = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"];
const GEMINI_FLASH_LITE_ORDER = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
const GEMINI_ALLOW = GEMINI_FLASH_ORDER.concat(GEMINI_FLASH_LITE_ORDER);
/* round four: Cerebras's free trial, inference-docs.cerebras.ai read 7
   October 2026: gpt-oss-120b and qwen-3.8-27b, each 5 requests and 30,000
   uncached tokens a minute and 1,000,000 tokens a day. (zai-glm-4.7, named
   in the brief, was not on the page that day, so it is not here.) */
const CEREBRAS_ALLOW = ["gpt-oss-120b", "qwen-3.8-27b"];

/* ---------------------------------------------------------------------------
   1c. NVIDIA'S API CATALOG (round five, 7 October 2026). What was read that
       day, and what follows from it:
       - the list: GET https://integrate.api.nvidia.com/v1/models, public, the
         OpenAI shape {object, data[{id, object, created, owned_by}]}, about
         ninety names, chat models beside embedders, guards and vision ones;
       - the price: none per model. NVIDIA's NIM FAQ (docs.api.nvidia.com/
         nim/docs/product, updated 6 August 2026): "Members of the NVIDIA
         Developer Program have free access to NIM API endpoints for
         prototyping", and "Using NIM in production requires an NVIDIA AI
         Enterprise license", production being "any use of NIM for purposes
         other than development, testing, research or evaluation";
       - the terms: the NVIDIA API Trial Terms of Service (v. 19 September
         2025, assets.ngc.nvidia.com/products/api-catalog/legal): "for
         limited trial purposes only and without use of the API Service or
         Generated Content in production"; content is not kept "at the end
         of each API Service session" (2.3), but NVIDIA collects "User
         Content and Generated Content to improve NVIDIA products and
         services, including AI models" (3.3), and no personal information
         may be uploaded;
       - the rate: no table is published; NVIDIA's forum (July 2026) gives
         40 requests a minute for the account, "dependent on model, use-case
         and the amount of current overall traffic".
       So: it may learn from what it reads, so it is for totals only, never
       mail and never a person's words; its free use is a trial, so it is
       held back until the owner sets NVIDIA_PRODUCTION_OK=1 (when NVIDIA
       allows his use); and its list is read live with no written fallback,
       the chat names below intersected with what the catalog lists today.
       One bucket for the whole account (30 a minute, under its 40).
--------------------------------------------------------------------------- */
/* the quick names first, then the strong ones, each family best first */
export const NVIDIA_FAST = Object.freeze(["nvidia/nemotron-3.5-lightning-30b-a3b", "z-ai/glm-5.3-flash", "openai/gpt-oss-20b"]);
export const NVIDIA_STRONG = Object.freeze(["nvidia/nemotron-3-super-120b-a12b", "moonshotai/kimi-k3", "z-ai/glm-5.3", "deepseek-ai/deepseek-v4.1-flash", "nvidia/nemotron-3-ultra-550b-a55b"]);
const NVIDIA_ALLOW = NVIDIA_FAST.concat(NVIDIA_STRONG);

const ALLOW = { groq: GROQ_ALLOW, gemini: GEMINI_ALLOW, cerebras: CEREBRAS_ALLOW, nvidia: NVIDIA_ALLOW };

/* ---- live discovery, cached in the store the same shape as _models.js ---- */
const SIX_HOURS = 6 * 3600 * 1000;
const KEEP = 60 * 60 * 24 * 30;
const K_LIVE = p => "nllm:live:" + p;
const LIVE = { groq: { at: 0, ids: [] }, gemini: { at: 0, ids: [] }, cerebras: { at: 0, ids: [] }, gateway: { at: 0, ids: [] }, nvidia: { at: 0, ids: [] } };

async function fetchModelIds(provider) {
  const key = keyFor(provider);
  if (!key) return [];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(PROVIDER_BASE[provider] + "/models", {
      headers: { Authorization: "Bearer " + key }, signal: ctrl.signal
    });
    clearTimeout(t);
    if (!r.ok) return [];
    const j = await r.json();
    const arr = Array.isArray(j.data) ? j.data : (Array.isArray(j.models) ? j.models : []);
    return arr.map(m => String((m && (m.id || m.name)) || "").replace(/^models\//, "")).filter(Boolean);
  } catch { clearTimeout(t); return []; }
}

/* round five: a test's own fresh instance, as a cold start would have it */
export function forgetLive(provider) { if (LIVE[provider]) LIVE[provider] = { at: 0, ids: [] }; }
async function liveModels(provider, force) {
  const now = Date.now();
  const cache = LIVE[provider];
  if (!force && cache.ids.length && now - cache.at < SIX_HOURS) return cache.ids;
  if (!force && kvReady()) {
    try {
      const r = await kv([["GET", K_LIVE(provider)]]);
      const raw = r && r[0];
      if (raw) {
        const j = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (j && Array.isArray(j.ids) && now - Number(j.at || 0) < SIX_HOURS) {
          LIVE[provider] = { at: Number(j.at), ids: j.ids };
          return j.ids;
        }
      }
    } catch { /* the store is optional, always */ }
  }
  const ids = await fetchModelIds(provider);
  if (ids.length) {
    LIVE[provider] = { at: now, ids };
    if (kvReady()) {
      try { await kv([["SET", K_LIVE(provider), JSON.stringify({ at: now, ids })], ["EXPIRE", K_LIVE(provider), String(KEEP)]]); } catch { }
    }
  }
  return ids.length ? ids : cache.ids;
}

/* ---------------------------------------------------------------------------
   1b. THE AI GATEWAY'S FREE MODELS (round four, 7 October 2026). Its public
       list (GET https://ai-gateway.vercel.sh/v1/models, no key needed;
       docs/ai-gateway/models-and-providers, "Response fields": data[].id,
       data[].type, data[].pricing.input and .output, per token as strings,
       with optional input_tiers and output_tiers) is read live, and a model
       is free here only when it is a language model whose every price field
       reads exactly zero and which carries no tier at all. There is no
       written fallback for this door: the free list changes by the month
       ("this month's free list"), so a list read once could name a model
       that is priced today. When the list cannot be read and no copy younger
       than a day is held, no gateway model is allowed at all. Cached six
       hours, in memory and in the store, the same shape as the others.
       Round six (7 October 2026): every gateway call asks for zero data
       retention and no training (GATEWAY_PRIVACY), and the list now says of
       each model whether all, some or none of its providers keep those two
       promises (data[].zdr and data[].no_training, "all", "some" or "none",
       read 7 October 2026). A name none of whose providers keeps them could
       only be refused (400 no_providers_available), as all five free names
       were on every mail round of 7 October, so it is never asked: it is
       counted in `without`, for the engine room to say. A list without the
       two fields (its older shape) leaves the refusing to the gateway.
--------------------------------------------------------------------------- */
export const GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";
const GATEWAY_STALE = 24 * 3600 * 1000;
/* a copy kept in the store before round six named models that cannot keep
   the promises, so only a copy of this shape is trusted */
const GW_LIST_V = 2;
const zeroPrice = v => v != null && String(v).trim() !== "" && Number(v) === 0;
const promiseKept = v => v == null || String(v).trim().toLowerCase() !== "none";
function gatewayFreeRead(list) {
  const ids = [];
  let without = 0;
  for (const m of Array.isArray(list) ? list : []) {
    if (!m || typeof m.id !== "string" || m.type !== "language") continue;
    const p = m.pricing && typeof m.pricing === "object" ? m.pricing : null;
    if (!p || !zeroPrice(p.input) || !zeroPrice(p.output)) continue;
    let priced = false;
    for (const [k, v] of Object.entries(p)) {
      if (/_tiers$/.test(k)) { if (Array.isArray(v) ? v.length : v != null) priced = true; continue; }
      if (v != null && typeof v !== "object" && !zeroPrice(v)) priced = true;
    }
    if (priced || ids.includes(m.id)) continue;
    if (!promiseKept(m.zdr) || !promiseKept(m.no_training)) { without++; continue; }
    ids.push(m.id);
  }
  return { ids, without };
}
export function gatewayFreeOf(list) { return gatewayFreeRead(list).ids; }
async function fetchGatewayFree() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(GATEWAY_MODELS_URL, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    return gatewayFreeRead(j && j.data);
  } catch { clearTimeout(t); return null; }
}
async function gatewayFreeModels(force) {
  const now = Date.now();
  const cache = LIVE.gateway;
  if (!force && cache.at && now - cache.at < SIX_HOURS) return cache.ids;
  let stored = null;
  if (kvReady()) {
    try {
      const r = await kv([["GET", K_LIVE("gateway")]]);
      const raw = r && r[0];
      const j = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
      if (j && Array.isArray(j.ids) && Number(j.v) >= GW_LIST_V) stored = { at: Number(j.at) || 0, ids: j.ids, without: Number(j.without) || 0 };
    } catch { stored = null; }
  }
  if (!force && stored && now - stored.at < SIX_HOURS) { LIVE.gateway = stored; return stored.ids; }
  const got = await fetchGatewayFree();
  if (got) {
    LIVE.gateway = { at: now, ids: got.ids, without: got.without };
    if (kvReady()) { try { await kv([["SET", K_LIVE("gateway"), JSON.stringify({ at: now, ids: got.ids, without: got.without, v: GW_LIST_V })], ["EXPIRE", K_LIVE("gateway"), String(KEEP)]]); } catch { } }
    return got.ids;
  }
  const best = [cache, stored].filter(Boolean).sort((a, b) => b.at - a.at)[0];
  if (best && best.at && now - best.at < GATEWAY_STALE) { if (best !== cache) LIVE.gateway = { ...best }; return best.ids; }
  return [];
}
/* how many of the gateway's free names its own list says cannot keep the
   two promises (round six), from the last reading */
export function gatewayWithout() { return Number(LIVE.gateway && LIVE.gateway.without) || 0; }

/* The free, allowed models for a provider right now: the allow-list
   intersected with what the provider's own /models endpoint says exists
   today. If live discovery cannot be reached at all (no network, no key),
   the allow-list itself is the only honest guess left, since every name on
   it was free the day this file was written; it is never used to ADD a name
   discovery did not confirm, only as the last resort when discovery itself
   is unreachable. */
export async function freeModels(provider, force) {
  if (!providerPresent(provider)) return [];
  if (provider === "openrouter") return await orRefreshFreeModels(!!force);
  if (provider === "gateway") return await gatewayFreeModels(!!force);   /* round four: live only */
  const allow = ALLOW[provider];
  if (!allow) return [];
  const ids = await liveModels(provider, !!force);
  if (ids.length) return allow.filter(id => ids.includes(id));
  /* round five: NVIDIA's catalog changes by the week, so a list not read
     today names nothing (no written fallback, as for the gateway) */
  if (provider === "nvidia") return [];
  return allow.slice();
}

/* The one question every call must answer yes to before a byte is sent. For
   OpenRouter this is deliberately the live, zero-priced list, not merely the
   ":free" naming convention, which is the stricter of the two tests. */
export async function isAllowed(provider, model) {
  if (!model || !providerPresent(provider)) return false;
  const ids = await freeModels(provider, false);
  return ids.includes(model);
}

/* Reads the same variable api/_models.js's own allowPaid() reads, so a
   caller of this file can ask whether it is set without importing the other
   file too. It changes nothing HERE: isAllowed() above and chainFor() below
   never call it, so a paid OpenRouter model is refused through this router
   exactly as through Groq or Gemini on every free tier. (The deep tier, §8,
   pays only through its own code list and cap, and does not read this
   variable either: setting it neither opens nor widens that door.) The variable still has
   a real effect, but only inside api/_models.js's own, older chain, which
   the legacy callers (assistant.js, guide.js, marketing.js and the rest)
   still use directly. Groq and Gemini have no equivalent variable at all,
   here or there, and never will unless a future change names one
   explicitly, in as many words, the way the marching orders require. */
export function allowPaid() {
  return process.env.ALLOW_PAID_MODELS === "1";
}

/* ---------------------------------------------------------------------------
   3. THE PRIVACY SCRUBBER. Applied to every outbound message, no exceptions.
      Two different jobs live here on purpose: redaction (secrets and contact
      details, which are removed so the rest of a message can still be sent)
      and refusal (journal text, which is never sent at all, not even
      redacted, because summarising it is still disclosing that it exists).

      JOURNAL MARKERS. The Journal's own store keys all begin "nj:" (nj:e,
      nj:c, nj:list -- see api/journal.js), so a caller that stringifies a
      raw journal record carries that prefix with it. A caller that means to
      send journal-derived text on purpose must say so with the literal
      marker "[[journal]]", which is refused the same way: there is no path
      by which journal prose reaches a model through this file.
--------------------------------------------------------------------------- */
const EMAIL_RX = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
const IP_RX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
/* PHONE_RX, narrowed 2026-09-24: the first shape (a bare run of digits,
   hyphens, spaces, dots and parens seven or more characters long) also
   matched an ISO date ("2026-09-24" is ten such characters) and a plain
   space-separated list of numbers ("1204 1330 1502", exactly the shape a
   reach or a reel-slot reading takes), so a critic asked to check those
   numbers against a tool's own evidence found the evidence itself already
   redacted into "[redacted]" before it ever reached the check. A phone
   number is redacted here only when it carries an actual phone shape: a
   leading international "+", a parenthesised area code, or digit groups
   joined by a hyphen or a dot (never by a bare space alone, which is also
   how a plain list of numbers separates itself). An ISO date that still
   manages to fit one of those shapes (a hyphen-joined "YYYY-MM-DD") is
   protected explicitly below, after the match, rather than excluded from
   the pattern itself, since excluding it from the pattern would also
   exclude every phone number that happens to open with four digits. */
const PHONE_RX = /(?:\+\d{1,3}[\s.-]?\d{2,4}(?:[\s.-]\d{2,4}){1,4})|(?:\(\d{2,4}\)[\s.-]?\d{2,4}[\s.-]?\d{2,9})|(?:\b\d{2,4}[.-]\d{2,4}[.-]\d{2,9}\b)/g;
const ISO_DATE_SHAPE_RX = /^\d{4}-\d{2}-\d{2}$/;
const COOKIE_RX = /\b[\w.$!*'()]+=[^;=\s]{6,}(?:;\s*[\w.$!*'()]+=[^;=\s]{1,})+/g;
const TOKEN_RXES = [
  /\bBearer\s+[A-Za-z0-9._\-]{10,}/gi,
  /\bsk-or-v1-[A-Za-z0-9]{8,}/gi,
  /\bsk-[A-Za-z0-9]{10,}/gi,
  /\bEAA[A-Za-z0-9]{10,}/g,
  /\bya29\.[A-Za-z0-9._\-]{10,}/g,
  /* the four key shapes added 2026-09-24 (the refuter's own probe, p1.mjs):
     Groq (gsk_), Gemini/Google AI Studio (AIza, 39 characters whole), a
     GitHub personal access token in either its classic (ghp_) or its fine
     grained (github_pat_) shape, and a Slack token (xox, then a one letter
     kind and a dash). None of these place a \b directly against the "_" or
     "-" that ends the prefix: "_" and "-" both count as ordinary characters
     to \b's own test, so a \b written right after one, with more of the
     same kind of character following, can never match at all, and a whole
     pattern built that way would silently never fire. Each \b here instead
     opens the pattern, before the prefix's own first letter, where a real
     boundary (the start of the string, or the space before it) actually
     sits. */
  /\bgsk_[A-Za-z0-9]{20,}/g,
  /\bAIza[A-Za-z0-9_-]{35}/g,
  /\bghp_[A-Za-z0-9]{30,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bxox[abpr]-[A-Za-z0-9-]{10,}/g,
  /\b[A-Fa-f0-9]{32,}\b/g,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g
];
const JOURNAL_MARKER_RX = /\bnj:[a-z]|\bjournal[_-]?id\b|\bvisitor[_-]?id\b|\[\[journal\]\]/i;

export function looksLikeJournal(text) { return JOURNAL_MARKER_RX.test(String(text == null ? "" : text)); }

/* { ok:true, text } once every secret shape is redacted, or
   { ok:false, reason } when the text must never be sent at all. */
export function scrub(text) {
  const raw = String(text == null ? "" : text);
  if (looksLikeJournal(raw)) {
    return { ok: false, reason: "journal text is never sent to a model; the Journal stays anonymous" };
  }
  let out = raw;
  for (const rx of TOKEN_RXES) out = out.replace(rx, "[redacted]");
  out = out.replace(EMAIL_RX, "[redacted]");
  out = out.replace(IP_RX, "[redacted]");
  out = out.replace(COOKIE_RX, "[redacted]");
  out = out.replace(PHONE_RX, m => ISO_DATE_SHAPE_RX.test(m) ? m : "[redacted]");
  return { ok: true, text: out };
}

/* ---------------------------------------------------------------------------
   4. RATE LIMITS. A token bucket per provider and model, kept in the store,
      set well under the free ceilings the research found (or under a
      deliberately cautious guess where the provider does not publish one).
      A store that is missing or slow degrades to "allow": a rate limiter
      that cannot count must never be the reason the Lantern goes dark, the
      same principle api/_models.js already lives by.
--------------------------------------------------------------------------- */
/* round four: tpm, tokens a minute, which is Groq's real ceiling on its
   free plan (8,000 a minute for the gpt-oss names; kept at 7,000 here) and
   Cerebras's (30,000 uncached); each call reserves its own estimate, the
   prompt at four characters a token plus the whole max_tokens. The gateway's
   free tier is "rate limited per model" with no number published, so its
   bucket is a cautious guess, like Gemini's. */
const CAPS = {
  groq: { rpm: 25, rpd: 800, tpd: 150000, tpm: 7000 },
  gemini: { rpm: 8, rpd: 150 },
  openrouter: { rpm: 15, rpd: () => { const n = parseInt(process.env.OPENROUTER_DAILY, 10); return n > 0 ? n : 40; } },
  gateway: { rpm: 10, rpd: 200 },
  cerebras: { rpm: 4, rpd: 900, tpd: 900000, tpm: 25000 },
  /* round five: NVIDIA's 40 a minute is the account's, every name together
     (section 1c), so one bucket stands for all of them, kept at 30; no daily
     number is published, so the day's is a cautious guess */
  nvidia: { rpm: 30, rpd: 1000 }
};
export const estimateTokens = (messages, maxTokens) => {
  let chars = 0;
  for (const m of Array.isArray(messages) ? messages : []) chars += String((m && m.content) == null ? "" : m.content).length;
  return Math.ceil(chars / 4) + Math.max(0, parseInt(maxTokens, 10) || 500);
};

const dayStr = now => new Date(now).toISOString().slice(0, 10);
const minuteEpoch = now => Math.floor(now / 60000);
const rlKey = (provider, model, kind, part) => "nllm:rl:" + provider + ":" + model + ":" + kind + ":" + part;
const tokKey = (provider, model, day) => "nllm:tok:" + provider + ":" + model + ":" + day;
const tpmKey = (provider, model, minute) => "nllm:tpm:" + provider + ":" + model + ":" + minute;

/* Checked before every call, and reserved atomically with it: a name that is
   only found to be over budget AFTER it answered would defeat the point.

   THE LANTERN'S RESERVE (the 2 October review). A caller named "soul" (the
   Soul's own free calls, api/_mind.js think) may use at most SOUL_FREE_SHARE
   of each provider's daily request allowance, counted in its own key beside
   the shared one, so the Lantern, which answers readers, always keeps at
   least the other half. Every other caller is the Lantern's, as before. */
export const SOUL_FREE_SHARE = 0.5;
const soulKey = (provider, model, day) => "nllm:rl:" + provider + ":" + model + ":soul:" + day;
export async function checkAndReserve(provider, model, now, caller, estTokens) {
  const caps = CAPS[provider];
  if (!caps) return { ok: true };
  if (!kvReady()) return { ok: true };
  /* OpenRouter's free allowance belongs to the account, not to a model:
     fifty requests a day however they are spread across its free names. Now
     that a tier walks several of them, one bucket stands for all. */
  if (provider === "openrouter" || provider === "nvidia") model = "*";   /* round five: NVIDIA's allowance is the account's too */
  const rpd = typeof caps.rpd === "function" ? caps.rpd() : caps.rpd;
  const mKey = rlKey(provider, model, "m", minuteEpoch(now));
  const dKey = rlKey(provider, model, "d", dayStr(now));
  const wantTok = !!caps.tpd;
  /* round four: tokens a minute, when the caller gave its estimate */
  const est = Math.max(0, parseInt(estTokens, 10) || 0);
  const wantTpm = !!caps.tpm && est > 0;
  const tKey = tpmKey(provider, model, minuteEpoch(now));
  try {
    const soul = caller === "soul";
    const sKey = soulKey(provider, model, dayStr(now));
    const cmds = [["GET", mKey], ["GET", dKey]];
    const at = {};
    if (wantTok) { at.tok = cmds.length; cmds.push(["GET", tokKey(provider, model, dayStr(now))]); }
    if (soul) { at.soul = cmds.length; cmds.push(["GET", sKey]); }
    if (wantTpm) { at.tpm = cmds.length; cmds.push(["GET", tKey]); }
    const r = await kv(cmds);
    const n = i => (i == null ? 0 : (parseInt(r[i] || "0", 10) || 0));
    const mCount = n(0), dCount = n(1), tCount = n(at.tok), sCount = n(at.soul), pmCount = n(at.tpm);
    if (mCount >= caps.rpm) return { ok: false, why: "rpm" };
    if (dCount >= rpd) return { ok: false, why: "rpd" };
    if (wantTok && tCount >= caps.tpd) return { ok: false, why: "tpd" };
    if (wantTpm && pmCount + est > caps.tpm) return { ok: false, why: "tpm, " + caps.tpm + " tokens a minute" };
    if (soul && sCount >= Math.floor(rpd * SOUL_FREE_SHARE)) return { ok: false, why: "the daily cycle's share of the day (" + Math.floor(rpd * SOUL_FREE_SHARE) + " of " + rpd + "; the rest is kept for the Lantern's conversation and the readers)" };
    const inc = [["INCR", mKey], ["EXPIRE", mKey, "70"], ["INCR", dKey], ["EXPIRE", dKey, "90000"]];
    if (soul) inc.push(["INCR", sKey], ["EXPIRE", sKey, "90000"]);
    if (wantTpm) inc.push(["INCRBY", tKey, String(est)], ["EXPIRE", tKey, "70"]);
    await kv(inc);
    return { ok: true };
  } catch { return { ok: true }; }
}

async function addTokens(provider, model, now, n) {
  if (!kvReady() || !n) return;
  try {
    const k = tokKey(provider, model, dayStr(now));
    await kv([["INCRBY", k, String(n)], ["EXPIRE", k, "90000"]]);
  } catch { }
}

/* the day's usage of a provider and (round four) the model's own scoreboard
   line, in one pipeline after every call: cheap enough to run every time */
async function recordUsage(provider, now, tokens, model, got) {
  if (!kvReady()) return;
  try {
    const k = "nllm:usage:" + provider + ":" + dayStr(now);
    const cmds = [["HINCRBY", k, "requests", "1"], ["HINCRBY", k, "tokens", String(tokens || 0)], ["EXPIRE", k, "2592000"]];
    if (model && got) cmds.push(...scoreCommands(provider, model, now, got));
    await kv(cmds);
    if (model) SCORE_MEM.delete(provider + ":" + model);
  } catch { }
}

/* Today's and the recent past's usage, for the owner console. Never reads
   further back than asked and never touches a reader's own text. */
export async function usageReport(days) {
  const n = Math.max(1, Math.min(31, parseInt(days, 10) || 7));
  const out = {};
  if (!kvReady()) return out;
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const d = dayStr(now - i * 86400000);
    for (const p of PROVIDERS) {
      try {
        const r = await kv([["HGETALL", "nllm:usage:" + p + ":" + d]]);
        const arr = r && r[0];
        if (!arr || !arr.length) continue;
        const obj = {};
        for (let j = 0; j < arr.length; j += 2) obj[arr[j]] = arr[j + 1];
        out[p] = out[p] || {};
        out[p][d] = { requests: parseInt(obj.requests || "0", 10) || 0, tokens: parseInt(obj.tokens || "0", 10) || 0 };
      } catch { }
    }
  }
  return out;
}

function resetLabel(now) {
  const d = new Date(now);
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

/* ---------------------------------------------------------------------------
   4b. THE SCOREBOARD (round four, 7 October 2026). The best free model is
       measured, never guessed: every call a model answers or fails adds to
       its own line, nllm:score:<provider>:<model>:<week> (a hash: n calls,
       ok, fail, ms summed over the answers, gn and gp for the checks its
       answers met and passed, err and errAt for the last failure), in the
       same pipeline as the usage. A caller that holds its answer to a check
       (the brief's guard, a verdict that can be read, a letter's checks)
       says how it went with noteGuard(). Two weeks are read, this one and
       the last, so an old fault fades on its own.

       QUALITY is the share answered times the share of checks passed, each
       pulled toward 0.75 by three imagined calls so one answer moves it
       little; a model with fewer than 5 calls (or 3 checks) is simply 0.75
       on that count until it has shown more. Inside a tier the candidates
       are sorted by quality in tenths, highest first, and the tier's own
       order (its lead provider first) decides between equals, so an
       unmeasured house keeps exactly the order it always had.

       Round five (the review, D7): a count with too little behind it is 1,
       not 0.75, and tenths stop at 9, so an unmeasured name stands level
       with a healthy measured one; and once an hour each tier asks first the
       best name that has not been measured for a day (exploreFirst), so a
       lead sunk by one bad hour is heard again and its fault fades with the
       two weeks. Each line also keeps `at`, when it was last measured.
--------------------------------------------------------------------------- */
export const SCORE_PRIOR = 0.75;
export const SCORE_MIN_CALLS = 5;
export const SCORE_MIN_CHECKS = 3;
const SCORE_WEIGHT = 3;
const SCORE_KEEP_S = 21 * 86400;
const SCORE_MEM_MS = 60000;
const SCORE_MEM = new Map();
const weekOf = now => Math.floor(Math.floor(now / 86400000) / 7);
export const K_SCORE = (provider, model, week) => "nllm:score:" + provider + ":" + model + ":" + week;
function scoreCommands(provider, model, now, got) {
  const k = K_SCORE(provider, model, weekOf(now));
  const at = new Date(now).toISOString();
  const cmds = [["HINCRBY", k, "n", "1"], ["HINCRBY", k, got.ok ? "ok" : "fail", "1"]];
  if (got.ok && Number.isFinite(got.ms) && got.ms > 0) cmds.push(["HINCRBY", k, "ms", String(Math.round(got.ms))]);
  /* round five (D7): when it was last measured, so a name that has not been
     asked for a day is asked once more (exploreFirst, below) */
  if (!got.ok) cmds.push(["HSET", k, "err", String(got.error || "failed").slice(0, 120), "errAt", at, "at", at]);
  else cmds.push(["HSET", k, "at", at]);
  cmds.push(["EXPIRE", k, String(SCORE_KEEP_S)]);
  return cmds;
}
/* a caller's word on what an answer was worth: passed its check or not.
   result is route()'s own answer (it names its provider and model) */
export async function noteGuard(result, passed) {
  const named = result && (result.measured || result);
  const p = named && named.provider, m = named && named.model;
  if (!p || !m || !PROVIDER_BASE[p] || !kvReady()) return;
  const k = K_SCORE(p, m, weekOf(Date.now()));
  try { await kv([["HINCRBY", k, "gn", "1"], ["HINCRBY", k, "gp", passed ? "1" : "0"], ["EXPIRE", k, String(SCORE_KEEP_S)]]); } catch { }
  SCORE_MEM.delete(p + ":" + m);
}
const hashOfReply = raw => {
  const out = {};
  if (Array.isArray(raw)) { for (let i = 0; i + 1 < raw.length; i += 2) out[raw[i]] = raw[i + 1]; return out; }
  if (raw && typeof raw === "object") return raw;
  if (typeof raw === "string") { try { const j = JSON.parse(raw); return j && typeof j === "object" ? j : {}; } catch { return {}; } }
  return out;
};
/* a call made outside the walks (the engine room's probe of every name)
   counted on the scoreboard all the same */
export async function measureCall(provider, model, got) {
  if (!provider || !model || !got || !PROVIDER_BASE[provider]) return;
  const tokens = (got.usage && (got.usage.total_tokens || got.usage.totalTokens)) || 0;
  if (parkable(provider, got)) await rememberRefused(model, got.error, provider);
  await recordUsage(provider, Date.now(), tokens, model, got);
}
/* the memory of the last minute's reads, forgotten on demand (a test, or
   the probe that has just measured every name) */
export function forgetScores() { SCORE_MEM.clear(); }
/* this week and the last, added together; the latest error of the two */
export async function scoresFor(cands, now) {
  const t = Number.isFinite(now) ? now : Date.now();
  const out = new Map();
  const need = [];
  for (const c of cands || []) {
    const key = c.provider + ":" + c.model;
    const m = SCORE_MEM.get(key);
    if (m && t - m.at < SCORE_MEM_MS) out.set(key, m.s); else need.push(c);
  }
  if (!need.length || !kvReady()) return out;
  const w = weekOf(t);
  try {
    const r = await kv(need.flatMap(c => [["HGETALL", K_SCORE(c.provider, c.model, w)], ["HGETALL", K_SCORE(c.provider, c.model, w - 1)]]));
    need.forEach((c, i) => {
      const a = hashOfReply(r && r[2 * i]), b = hashOfReply(r && r[2 * i + 1]);
      const num = (h, f) => parseInt(h[f], 10) || 0;
      const s = { n: num(a, "n") + num(b, "n"), ok: num(a, "ok") + num(b, "ok"), fail: num(a, "fail") + num(b, "fail"),
        ms: num(a, "ms") + num(b, "ms"), gn: num(a, "gn") + num(b, "gn"), gp: num(a, "gp") + num(b, "gp"),
        err: a.err || b.err || "", errAt: a.err ? (a.errAt || "") : (b.errAt || ""),
        at: [a.at, b.at, a.errAt, b.errAt].filter(Boolean).map(String).sort().pop() || "" };
      const key = c.provider + ":" + c.model;
      out.set(key, s);
      SCORE_MEM.set(key, { at: t, s });
    });
  } catch { /* an unread scoreboard ranks nothing: the tier's own order stands */ }
  return out;
}
/* round five (the review, D7): a count with too little behind it is no
   evidence either way, so it is 1, neither lifting nor lowering: an
   unmeasured name no longer scores 0.75 x 0.75 = 0.56 under every healthy
   measured one (it scored 0.56, and a lead demoted by one bad hour then sat
   under the fallback for good). Tenths are capped at 9, so an unmeasured
   name and a healthy measured one are equals and the tier's own order (its
   lead first) decides between them, as it always did. */
export function qualityOf(s) {
  const x = s || {};
  const succ = (x.n || 0) >= SCORE_MIN_CALLS ? ((x.ok || 0) + SCORE_PRIOR * SCORE_WEIGHT) / (x.n + SCORE_WEIGHT) : 1;
  const guard = (x.gn || 0) >= SCORE_MIN_CHECKS ? ((x.gp || 0) + SCORE_PRIOR * SCORE_WEIGHT) / (x.gn + SCORE_WEIGHT) : 1;
  return Math.round(succ * guard * 1000) / 1000;
}
const tenthOf = q => Math.min(9, Math.floor(q * 10 + 1e-9));
/* the candidates by measured quality, the tier's own order between equals */
export async function rankByQuality(cands, now) {
  if (!Array.isArray(cands) || cands.length < 2) return cands || [];
  const s = await scoresFor(cands, now);
  return cands.map((c, i) => ({ c, i, q: tenthOf(qualityOf(s.get(c.provider + ":" + c.model))) }))
    .sort((a, b) => (b.q - a.q) || (a.i - b.i)).map(x => x.c);
}
/* round five (D7): faults fade. Once an hour a tier sends one call first to
   the best of its names that has not been measured for a day: a name a bad
   hour sank is asked again, does well or not, and the two weeks of the
   scoreboard carry the rest. When the name the order puts first is itself
   unmeasured for a day it is asked anyway, so nothing moves and the hour is
   not spent. One mark an hour a tier, in the store and in memory. */
export const EXPLORE_EVERY_MS = 3600 * 1000;
export const STALE_AFTER_MS = 24 * 3600 * 1000;
export const K_EXPLORE = (tier, hour) => "nllm:explore:" + tier + ":" + hour;
const EXPLORE_MEM = new Map();
export function forgetExplore() { EXPLORE_MEM.clear(); }
const staleAt = (s, now) => { const t = Date.parse((s && s.at) || ""); return !Number.isFinite(t) || now - t > STALE_AFTER_MS; };
export async function exploreFirst(tier, ranked, now) {
  if (!Array.isArray(ranked) || ranked.length < 2) return ranked || [];
  const t = Number.isFinite(now) ? now : Date.now();
  const hour = Math.floor(t / EXPLORE_EVERY_MS);
  if (EXPLORE_MEM.get(tier) === hour) return ranked;
  const s = await scoresFor(ranked, t);
  const at = ranked.findIndex(c => staleAt(s.get(c.provider + ":" + c.model), t));
  if (at <= 0) return ranked;
  EXPLORE_MEM.set(tier, hour);
  let first = !kvReady();
  if (!first) { try { first = (await kv([["SET", K_EXPLORE(tier, hour), ranked[at].provider + ":" + ranked[at].model, "NX", "EX", String(Math.ceil(EXPLORE_EVERY_MS / 1000) + 60)]]))[0] === "OK"; } catch { first = false; } }
  if (!first) return ranked;
  return [ranked[at]].concat(ranked.filter((_, i) => i !== at));
}

/* ---------------------------------------------------------------------------
   5. ONE OPENAI-COMPATIBLE CHAT CALL, for all three providers. Free-only is
      enforced here too, not only by the caller, so nothing that reaches this
      function can ever bill by accident: a second gate on the one door that
      actually talks to the network.

      The network itself lives in send() below, which is NOT exported. The
      only two callers are chatOnce() (after the free gate) and §8's
      deepWalk() (after the paid gate: code list, live price, ceiling, cap).
--------------------------------------------------------------------------- */
export async function chatOnce(provider, model, messages, opts = {}) {
  if (!keyFor(provider)) return { ok: false, error: "no key", provider, model };
  if (!PROVIDER_BASE[provider]) return { ok: false, error: "unknown provider", provider, model };
  if (!(await isAllowed(provider, model))) {
    return { ok: false, error: "refused: " + model + " is not on " + provider + "'s free allow-list", provider, model, blocked: true };
  }
  return await send(provider, model, messages, opts, null);
}

/* extra.paid is set only by deepWalk(): it asks OpenRouter for usage
   accounting (usage.cost in USD on the reply) and tells OpenRouter's own
   router the price ceiling and that no endpoint may keep the prompt. */
async function send(provider, model, messages, opts, extra) {
  const key = keyFor(provider);
  const t0 = Date.now();
  if (!key) return { ok: false, error: "no key", provider, model };
  if (!PROVIDER_BASE[provider]) return { ok: false, error: "unknown provider", provider, model };

  const scrubbed = [];
  for (const m of (Array.isArray(messages) ? messages : [])) {
    const s = scrub(m && m.content);
    if (!s.ok) return { ok: false, error: s.reason, provider, model, blocked: true };
    scrubbed.push({ role: (m && m.role) || "user", content: s.text });
  }

  const body = {
    model,
    messages: scrubbed,
    temperature: opts.temperature == null ? 0.4 : opts.temperature,
    max_tokens: opts.max_tokens || 500,
    stream: !!opts.stream
  };
  if (opts.tools) body.tools = opts.tools;
  if (opts.tool_choice) body.tool_choice = opts.tool_choice;
  if (opts.response_format) body.response_format = opts.response_format;
  /* Groq's gpt-oss names think before they answer, and the thinking is
     paid out of max_tokens: on 25 September a short budget came back with
     no answer at all. Low effort leaves the budget to the answer. On
     OpenRouter, a name that thinks is asked to keep the thinking out of
     the reply, since one free name wrote it straight into the text. */
  if (provider === "groq" && /gpt-oss/.test(model)) body.reasoning_effort = opts.reasoning_effort || "low";
  if (provider === "openrouter") body.reasoning = { exclude: true };
  /* round four: every gateway request asks that the provider keep nothing
     and learn nothing (docs/ai-gateway/security-and-compliance: the request
     body's providerOptions.gateway, zeroDataRetention and
     disallowPromptTraining); a model no such provider serves is refused by
     the gateway itself, 400 no_providers_available, and is set aside below */
  if (provider === "gateway") body.providerOptions = { gateway: { ...GATEWAY_PRIVACY } };
  if (extra && extra.paid && provider === "openrouter") {
    body.usage = { include: true };
    body.provider = {
      max_price: { prompt: DEEP_MAX_PROMPT_PER_MTOK, completion: DEEP_MAX_COMPLETION_PER_MTOK },
      data_collection: "deny",
      /* round five (D4): an endpoint with zero data retention, nothing else,
         when the call can carry mail or a person's words (openrouter.ai/docs/
         features/zdr, read 7 October 2026: "provider": {"zdr": true}, "the
         request will only be routed to endpoints that have a Zero Data
         Retention policy") */
      ...(extra.zdr ? { zdr: true } : {})
    };
  }

  const headers = { "content-type": "application/json", Authorization: "Bearer " + key };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://noorcodex.com";
    headers["X-Title"] = opts.title || "NOOR Codex of Light";
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout || 9000);
  try {
    const r = await fetch(PROVIDER_BASE[provider] + "/chat/completions", {
      method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal
    });
    clearTimeout(timer);
    const ms = Date.now() - t0;
    if (!r.ok) {
      let why = "", codes = [];
      try {
        const e = await r.json();
        why = String((e && e.error && (e.error.message || e.error)) || "").slice(0, 160);
        const inner = e && e.error && typeof e.error === "object" ? e.error : {};
        codes = [e && e.type, e && e.code, inner.type, inner.code].map(x => String(x || ""));
      }
      catch { try { why = (await r.text()).slice(0, 160); } catch { } }
      /* round four: the gateway found no provider that keeps nothing (round
         six: its type may come at the top, as its docs show, or inside the
         OpenAI shaped error, as type or as code; and its words say it too) */
      const noProvider = codes.includes("no_providers_available") || /\bno (zdr|zero data retention)\b[^.]*\bproviders? available\b|\bno providers available\b/i.test(why);
      return { ok: false, error: "http " + r.status + (why ? ": " + why : ""), status: r.status, provider, model, ms, ...(noProvider ? { noProvider: true } : {}) };
    }
    const j = await r.json();
    const choice = ((j.choices || [])[0] || {}).message || {};
    const content = String(choice.content || "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*?<\/think>/i, "").trim();
    const tool_calls = choice.tool_calls || null;
    const usage = j.usage || {};
    /* an empty reply still answered 200, and on a paid name a 200 is billed:
       the usage goes back with it so the ledger can count it */
    if (!content && !tool_calls) return { ok: false, error: "empty", status: r.status, usage, provider, model, ms };
    return { ok: true, content, tool_calls, usage, model: j.model || model, asked: model, provider, ms };
  } catch (e) {
    clearTimeout(timer);
    /* netError: the request may have reached the provider before the
       line dropped, so a paid caller must assume it was billed */
    return { ok: false, error: e && e.name === "AbortError" ? "timeout" : String(e && e.message || e).slice(0, 120), netError: true, provider, model, ms: Date.now() - t0 };
  }
}

/* ---------------------------------------------------------------------------
   6. TIERS. Which provider and which named model answers a "fast", "strong"
      or "long" task first, in the order the marching orders name, plus the
      last name that actually worked, remembered per tier the way
      api/_models.js remembers nlm:good.
--------------------------------------------------------------------------- */
/* round four: the fast tier asks Gemini's flash, not its flash-lite (in May
   the free flash-lite and pro answered with no quota at all, while flash
   worked); Cerebras's gpt-oss-120b stands beside Groq's when its key is set;
   and the gateway's free names come last, since each must first find a
   provider that keeps nothing. The scoreboard (section 4b) then orders what
   is measured; this order breaks the ties. */
/* round five: NVIDIA's catalog after Cerebras (or Groq), before OpenRouter's
   free names, its quick names for "fast" and its strong ones elsewhere */
const TIERS = {
  /* routing, tool selection, short classification: speed over depth */
  fast: [
    { provider: "groq", pick: "openai/gpt-oss-20b" },
    { provider: "cerebras", pick: "gpt-oss-120b" },
    { provider: "gemini", pick: "flash" },
    { provider: "nvidia", pick: "fast" },
    { provider: "openrouter", pick: "best" },
    { provider: "gateway", pick: "best" }
  ],
  /* synthesis, strategy, writing: quality over speed */
  strong: [
    { provider: "gemini", pick: "flash" },
    { provider: "groq", pick: "openai/gpt-oss-120b" },
    { provider: "cerebras", pick: "gpt-oss-120b" },
    { provider: "nvidia", pick: "strong" },
    { provider: "openrouter", pick: "best" },
    { provider: "gateway", pick: "best" }
  ],
  /* large context dumps: Gemini's flash family carries the biggest window
     of the three, so it goes first; the fallback below it is the same as
     "strong" once the dump is small enough for either to hold it */
  long: [
    { provider: "gemini", pick: "flash" },
    { provider: "groq", pick: "openai/gpt-oss-120b" },
    { provider: "nvidia", pick: "strong" },
    { provider: "openrouter", pick: "best" },
    { provider: "gateway", pick: "best" }
  ]
};
export const TIER_NAMES = Object.freeze(Object.keys(TIERS));

function resolveModel(provider, pick, ids) {
  if (provider === "groq" || provider === "cerebras") return ids.includes(pick) ? pick : null;
  if (provider === "gemini") {
    const order = pick === "flash-lite" ? GEMINI_FLASH_LITE_ORDER : GEMINI_FLASH_ORDER;
    for (const id of order) if (ids.includes(id)) return id;
    return null;
  }
  if (provider === "openrouter") return ids.length ? ids[0] : null;
  return null;
}

const K_GOOD = tier => "nllm:good:" + tier;
export async function goodFor(tier) {
  if (!kvReady()) return "";
  try { const r = await kv([["GET", K_GOOD(tier)]]); return (r && r[0]) || ""; } catch { return ""; }
}
async function rememberGood(tier, value) {
  if (!kvReady()) return;
  try { await kv([["SET", K_GOOD(tier), value], ["EXPIRE", K_GOOD(tier), String(KEEP)]]); } catch { }
}

/* The ordered list of { provider, model } candidates for a tier: the last
   known good one first (if it is still present and still free), then the
   tier's own order, each entry resolved against what is actually live and
   allowed right now. A provider with no key, or whose allow-list has
   nothing live today, is skipped rather than left as a dead entry. */
export async function chainFor(tier, opts = {}) {
  const order = TIERS[tier] || TIERS.fast;
  const out = [];
  const seen = new Set();
  const push = (provider, model) => {
    const k = provider + ":" + model;
    if (model && !seen.has(k)) { seen.add(k); out.push({ provider, model }); }
  };

  /* The last good name only jumps the queue inside the tier's leading
     provider. On 25 September the fast, strong and long tiers all still
     opened on an OpenRouter name remembered from the days when OpenRouter
     was the only key, so Groq and Gemini, set that morning, were never
     asked. A remembered name from a lower provider now waits its turn. */
  let lead = "";
  for (const step of order) {
    if (providerPresent(step.provider) && (await freeModels(step.provider, false)).length) { lead = step.provider; break; }
  }
  if (!opts.skipGood) {
    const good = await goodFor(tier);
    if (good) {
      const idx = good.indexOf(":");
      const gp = idx === -1 ? "" : good.slice(0, idx);
      const gm = idx === -1 ? "" : good.slice(idx + 1);
      if (gp && gp === lead && providerPresent(gp)) {
        const ids = await freeModels(gp, false);
        if (ids.includes(gm)) push(gp, gm);
      }
    }
  }
  for (const step of order) {
    if (!providerPresent(step.provider)) continue;
    const ids = await freeModels(step.provider, false);
    if (!ids.length) continue;
    /* OpenRouter's free list is several names deep and a name can be on it
       and still refuse this house: on the first live probe, 24 September,
       the only name tried answered 403 "only available on agentic
       harnesses" and the whole tier went dark. So the tier takes the first
       few free names, not one, and steps past any name that refused this
       house in the last day. */
    if (step.provider === "openrouter") {
      const refused = await refusedSet(ids.slice(0, OR_DEPTH + 4));
      let n = 0;
      for (const id of ids) {
        if (n >= OR_DEPTH) break;
        if (refused.has(id)) continue;
        push("openrouter", id); n++;
      }
      continue;
    }
    /* round four: the gateway's free names, the same way, and a name the
       gateway refused under the privacy flags in the last day waits */
    if (step.provider === "gateway") {
      const parked = await refusedSet(ids.slice(0, GW_DEPTH + 4), "gateway");
      let n = 0;
      for (const id of ids) {
        if (n >= GW_DEPTH) break;
        if (parked.has(id)) continue;
        push("gateway", id); n++;
      }
      continue;
    }
    if (step.provider === "cerebras") {
      const model = resolveModel("cerebras", step.pick, ids);
      if (model && !(await refusedSet([model], "cerebras")).has(model)) push("cerebras", model);
      continue;
    }
    /* round five: NVIDIA's names of the step's family that the catalog lists
       today, the best two, stepping past one it refused in the last day */
    if (step.provider === "nvidia") {
      const fam = (step.pick === "fast" ? NVIDIA_FAST : NVIDIA_STRONG).filter(id => ids.includes(id));
      const parked = await refusedSet(fam, "nvidia");
      let n = 0;
      for (const id of fam) {
        if (n >= NV_DEPTH) break;
        if (parked.has(id)) continue;
        push("nvidia", id); n++;
      }
      continue;
    }
    /* Gemini's newest flash answered 503 (busy) for a whole morning on
       25 September while the key itself was fine, so a flash step also
       carries the next live flash name before the walk leaves Gemini */
    if (step.provider === "gemini" && step.pick === "flash") {
      let n = 0;
      for (const id of GEMINI_FLASH_ORDER) { if (n >= 2) break; if (ids.includes(id)) { push("gemini", id); n++; } }
      continue;
    }
    const model = resolveModel(step.provider, step.pick, ids);
    if (model) push(step.provider, model);
  }
  /* round four: measured quality first, the tier's own order between equals;
     round five (D7): and, for a call (opts.explore), once an hour the best
     name not measured for a day goes first */
  if (opts.unranked) return out;
  const now = Date.now();
  const ranked = await rankByQuality(out, now);
  return opts.explore ? await exploreFirst(tier, ranked, now) : ranked;
}

/* how many OpenRouter free names a tier walks, and the memory of a name that
   refused the house outright (403, 404: not a passing fault, a door) */
const OR_DEPTH = 4;
const GW_DEPTH = 3;   /* round four: the gateway's free names a tier walks */
const NV_DEPTH = 2;   /* round five: NVIDIA's names a tier step walks */
/* OpenRouter's keys keep their old shape; the other doors carry their name */
const K_REFUSED = (id, provider) => "nllm:refused:" + (provider && provider !== "openrouter" ? provider + ":" : "") + id;
const REFUSED_S = 24 * 3600;
async function refusedSet(ids, provider) {
  const out = new Set();
  if (!kvReady() || !ids.length) return out;
  try {
    const r = await kv(ids.map(id => ["GET", K_REFUSED(id, provider)]));
    ids.forEach((id, i) => { if (r && r[i]) out.add(id); });
  } catch { }
  return out;
}
async function rememberRefused(id, why, provider) {
  if (!kvReady()) return;
  try { await kv([["SET", K_REFUSED(id, provider), String(why || "refused").slice(0, 160)], ["EXPIRE", K_REFUSED(id, provider), String(REFUSED_S)]]); } catch { }
}
/* round four: when a name is set aside for a day rather than asked again.
   OpenRouter's 403 and 404 as before; the gateway's no provider that keeps
   nothing, and its or Cerebras's 403 and 404 (a name that has gone) */
const parkable = (provider, got) => !!got && !got.ok && (
  ((provider === "openrouter" || provider === "gateway" || provider === "cerebras" || provider === "nvidia") && (got.status === 403 || got.status === 404))
  || (provider === "gateway" && !!got.noProvider));

/* ---------------------------------------------------------------------------
   response_format:{type:"json_object"} only helps when the model on the
   other end actually honours it; sent to one that does not, it is usually
   just ignored, but a strict host can 400 the whole request instead. Groq
   and Gemini both always accept the OpenAI-shaped field. OpenRouter fans
   out to dozens of underlying models, and only some of them declare
   "response_format" (or "structured_outputs") among their own
   supported_parameters on OpenRouter's own /models endpoint -- so this is
   asked for there only where the model itself lists it, best-effort and
   fail-closed: a network failure or a schema OpenRouter changes under this
   file leaves the set empty, which asks for json mode nowhere on
   OpenRouter rather than guessing a model can answer it. A caller that
   still wants strict JSON gets it from the robust parser either way
   (api/_agent.js's parsePlan/parseSynthesis); this is only ever a better
   chance at the first try, never the only line of defence. */
const OR_JSON_TTL = 6 * 3600 * 1000;
let orJsonCache = { at: 0, ids: new Set() };
async function orJsonCapableIds(force) {
  const now = Date.now();
  if (!force && orJsonCache.ids.size && now - orJsonCache.at < OR_JSON_TTL) return orJsonCache.ids;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch("https://openrouter.ai/api/v1/models", { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return orJsonCache.ids;
    const j = await r.json();
    const ids = new Set();
    for (const m of (Array.isArray(j.data) ? j.data : [])) {
      const sp = Array.isArray(m && m.supported_parameters) ? m.supported_parameters : [];
      if (sp.includes("response_format") || sp.includes("structured_outputs")) ids.add(m.id);
    }
    if (ids.size) orJsonCache = { at: now, ids };
    return orJsonCache.ids;
  } catch { return orJsonCache.ids; }
}
async function jsonCapable(provider, model) {
  if (provider === "groq" || provider === "gemini") return true;
  if (provider === "openrouter") return (await orJsonCapableIds(false)).has(model);
  return false;
}

/* ---------------------------------------------------------------------------
   7. route(task): task.tier ("fast" | "strong" | "long" | "deep"),
      task.messages (OpenAI-shaped), task.opts (passed to chatOnce), task.perPerson (true
      when any message carries per-person rather than aggregate data, which
      routes the whole call away from Gemini's free tier -- see §3's header
      comment: Gemini's free terms allow training on submitted content, so
      nothing about an identifiable person goes there). task.json (true
      when the caller wants response_format:{type:"json_object"}, asked for
      on a per-candidate basis, only where jsonCapable() above says that
      provider or that specific OpenRouter model actually lists it; a
      caller that already set task.opts.response_format itself is left
      alone, this never overrides one already chosen).

      Returns { ok:true, content, tool_calls, usage, model, provider, tier,
      tried } on success, or { ok:false, error, tier, tried, blocked? } with
      a message honest enough to put in front of the owner: which names were
      tried, why each one was skipped or failed, and, when every bucket for
      the day is empty, exactly when it resets.

      "deep" first walks §8's paid names under the caps, then the "strong"
      free chain exactly as that tier would. Its answer, success or not, also
      carries paid (true only when a paid name answered) and costUsd (what
      this call added to the month's ledger, 0 when nothing paid was billed).

      Round four (7 October 2026): a deep task pays only when task.purpose
      names one of PAID_PURPOSES; with no purpose, or another, the paid names
      are passed over in words and the free chain answers. task.paidOnly
      asks for the paid answer or nothing (a tie break, where a second free
      opinion is not what was asked for). A paid answer carries paidId, its
      line in the ROI ledger. Every answer carries measured {provider,
      model}, the scoreboard's own name for whoever answered, for noteGuard.
--------------------------------------------------------------------------- */
export const PAID_PURPOSES = Object.freeze({
  "weekly-strategy": "the Monday strategy",
  "weekly-reflection": "the Monday reflection",
  "tie-break": "a tie break",
  "letter-retry": "a letter retry",
  "ask-deep": "a think deeply in Ask"
});
/* the research's web search for places (api/_outreach.js, the mission
   builder's, 2 dollars a month at most) is paid too: it keeps its own door
   and share, and since round four it also answers to the day's cap and is a
   line in the same ROI ledger, under this name */
export const LEDGER_TASKS = Object.freeze({ ...PAID_PURPOSES, "web-search": "a web search for places" });
export const PAID_DAY_CAP_USD = 0.5;
export const PAID_CALL_MAX_USD = 0.1;
export const paidPurposeOf = p => (typeof p === "string" && Object.prototype.hasOwnProperty.call(PAID_PURPOSES, p) ? p : null);
const PURPOSES_WORDS = "the Monday strategy and reflection, a tie break between the free judges, a letter retry for a place of high value, and the owner's own think deeply";

export async function route(task = {}) {
  const deep = task.tier === "deep";
  /* 6 October 2026: "mail" joins the tiers (section 9 below) */
  const tier = deep ? "deep" : (["fast", "strong", "long", "mail"].includes(task.tier) ? task.tier : "fast");
  const messages = Array.isArray(task.messages) ? task.messages : [];
  if (!messages.length) return deep ? { ok: false, error: "no messages", tier, paid: false, costUsd: 0 } : { ok: false, error: "no messages", tier };

  /* refuse before anything else is attempted: no bucket spent on a message
     that was never going to be sent */
  for (const m of messages) {
    const s = scrub(m && m.content);
    if (!s.ok) return deep ? { ok: false, error: s.reason, blocked: true, tier, paid: false, costUsd: 0 } : { ok: false, error: s.reason, blocked: true, tier };
  }

  const perPerson = !!task.perPerson || messages.some(m => m && m.perPerson);
  const now = Date.now();
  const tried = [];

  /* 6 October 2026 (LANTERN.md section 11.1): correspondence goes only to
     models that neither keep nor learn from it (section 9 below) */
  if (tier === "mail") return await mailWalk(task, messages, now, tried);

  if (!deep) return await freeWalk(tier, task, messages, perPerson, now, tried, task.caller);

  /* round four: paid only for a named use */
  const purpose = paidPurposeOf(task.purpose);
  let paid = { ok: false, got: null, micro: 0 };
  if (!purpose) tried.push({ provider: "openrouter", model: "(deep)", paid: true, err: "skipped: paid models are kept for " + PURPOSES_WORDS + "; this call named none of them, so the free names answer" });
  else paid = await deepWalk(task, messages, perPerson, now, tried, purpose);
  const costUsd = paid.micro / 1e6;
  if (paid.ok) {
    return { ok: true, spendRecorded: !paid.spendFailed, content: paid.got.content, tool_calls: paid.got.tool_calls, usage: paid.got.usage,
             model: paid.got.model, provider: "openrouter", tier, tried, paid: true, costUsd, purpose, paidId: paid.paidId || null,
             measured: { provider: "openrouter", model: paid.got.asked || paid.got.model } };
  }
  if (task.paidOnly) {
    const why = tried.filter(t => t.paid).map(t => t.model + ": " + (t.err || "no answer")).join("; ").slice(0, 300);
    return { ok: false, error: "no paid model answered (" + (why || "none was allowed") + ")", tier, tried, paid: false, costUsd, purpose,
             ...(paid.spendFailed ? { spendRecorded: false, paidButUnrecorded: true } : {}) };
  }
  const free = await freeWalk("strong", task, messages, perPerson, now, tried, task.caller);
  return { ...free, tier, paid: false, costUsd, ...(purpose ? { purpose } : {}), ...(paid.spendFailed ? { spendRecorded: false, paidButUnrecorded: true } : {}) };
}

async function freeWalk(tier, task, messages, perPerson, now, tried, caller) {
  const candidates = await chainFor(tier, { explore: true });   /* round five: faults fade */
  if (!candidates.length) {
    return { ok: false, error: "no free model is configured for the \"" + tier + "\" tier (no provider key set, or nothing on its free tier is live today)", tier, tried };
  }

  const est = estimateTokens(messages, task.opts && task.opts.max_tokens);   /* round four: tokens a minute */
  let anyAttempted = false;
  for (const cand of candidates) {
    if (perPerson && cand.provider === "gemini") {
      tried.push({ provider: cand.provider, model: cand.model, err: "skipped: per-person data is never sent to Gemini's free tier" });
      continue;
    }
    /* round four: Cerebras says it does not train on what it reads, but its
       pages say nothing of how long it keeps it, so nothing about a person
       goes there either */
    if (perPerson && cand.provider === "cerebras") {
      tried.push({ provider: cand.provider, model: cand.model, err: "skipped: per-person data is never sent to Cerebras (its retention is not published)" });
      continue;
    }
    /* round five: NVIDIA's trial terms let it collect what it reads to
       improve its models, and forbid personal information (section 1c) */
    if (perPerson && cand.provider === "nvidia") {
      tried.push({ provider: cand.provider, model: cand.model, err: "skipped: per-person data is never sent to NVIDIA (its trial terms let it learn from what it reads)" });
      continue;
    }
    const gate = await checkAndReserve(cand.provider, cand.model, now, caller, est);
    if (!gate.ok) {
      tried.push({ provider: cand.provider, model: cand.model, err: "rate limit reached for today (" + gate.why + ")" });
      continue;
    }
    anyAttempted = true;
    const callOpts = { ...(task.opts || {}) };
    if (task.json && !callOpts.response_format && await jsonCapable(cand.provider, cand.model)) {
      callOpts.response_format = { type: "json_object" };
    }
    const got = await chatOnce(cand.provider, cand.model, messages, callOpts);
    tried.push({ provider: cand.provider, model: cand.model, ms: got.ms, err: got.ok ? "" : got.error });
    if (parkable(cand.provider, got)) await rememberRefused(cand.model, got.error, cand.provider);
    const tokens = (got.usage && (got.usage.total_tokens || got.usage.totalTokens)) || 0;
    await recordUsage(cand.provider, now, tokens, cand.model, got);
    if (got.ok) {
      await addTokens(cand.provider, cand.model, now, tokens);
      await rememberGood(tier, cand.provider + ":" + cand.model);
      return { ok: true, content: got.content, tool_calls: got.tool_calls, usage: got.usage, model: got.model, provider: got.provider, tier, tried,
               measured: { provider: cand.provider, model: cand.model } };
    }
    if (got.blocked) return { ok: false, error: got.error, blocked: true, tier, tried };
  }
  if (!anyAttempted) {
    return { ok: false, error: "the free allowance for today is used up; resets at " + resetLabel(now), tier, tried };
  }
  return { ok: false, error: "no free model answered today", tier, tried };
}

/* ---------------------------------------------------------------------------
   8. THE DEEP TIER: the one door in this file that may pay.
      SOUL.md: "Budget: at most 10 US dollars a month on paid models
      (OpenRouter), enforced in code." Every gate below fails closed: any
      doubt (no store, an unreadable ledger, an unreadable price list, a
      price that is not a plain number) means the call goes to the free
      "strong" chain instead, never that it is paid for blind.

      Gates, in the order route() meets them, for every paid call:
        1. the name is on DEEP_MODELS (code). SOUL_DEEP_MODELS may narrow
           that list to a subset; a name it gives that is not on the code
           list is ignored, so the variable can never add one.
        2. per-person data never goes to a paid name (only totals reach any
           model, constitution article 5).
        3. the store answers: the ledger nsoul:spend:<YYYY-MM> is readable
           and no 402 "no credit" mark is set (nsoul:nocredit, one hour).
        4. OpenRouter's live /models lists the name today, with a fixed
           price under DEEP_MAX_PROMPT_PER_MTOK and
           DEEP_MAX_COMPLETION_PER_MTOK (USD per million tokens).
        5. the worst case (prompt length at two characters a token, plus
           max_tokens all spent, at the live price) plus the month's spend
           so far stays within deepCapUsd().
        6. (round four) the worst case plus the day's spend so far stays
           within PAID_DAY_CAP_USD, 0.50 dollars, read from
           nsoul:spend:day:<YYYY-MM-DD>; and the worst case alone is no more
           than PAID_CALL_MAX_USD, 0.10 dollars, unless the call is the
           Monday strategy (purpose "weekly-strategy"), the one use allowed
           to think at length.
      The actual cost is OpenRouter's own usage.cost when it reports one,
      else the reported tokens at the live price, else the worst case. A
      timeout or a dropped line is charged the worst case too, since the
      request may have been billed before the line went; an http error is
      charged nothing.

      Round five (the review, D1: the check, the send and the write were
      three steps, so five parallel asks all passed one read of the day's
      ledger, and a store that refused writes recorded nothing at all): the
      worst case is now HELD before a byte is sent, INCRBY on the month's
      and the day's ledger in one pipeline (reserveSpend). A hold that takes
      either past its cap is given back at once and the call refused; a hold
      the store does not take refuses every paid call (fail closed). After
      the call the actual cost replaces the hold (INCRBY actual minus worst,
      settleSpend). A correction that adds and cannot be written leaves the
      ledger short, so the answer says spendRecorded:false and the paid door
      closes for the rest of the UTC day, here, for every caller (the same
      nsoul:deepoff:<date> api/_mind.js and api/_mail.js close and read).
--------------------------------------------------------------------------- */
export const DEEP_CAP_USD_MAX = 10;
/* strong reasoning names, best first; every one is re-checked against the
   live list and price before each call, so a name that is retired or
   repriced is simply skipped, never trusted from this list alone.
   Round four, read on OpenRouter 7 October 2026: anthropic/claude-sonnet-5
   (2 and 10 dollars a million, prompt and completion) and openai/gpt-6-luna
   (0.10 and 0.50) are live; google/gemini-3.8-pro answered 404, there is no
   such name, and Google's pro today is google/gemini-3.1-pro-preview (2 and
   12), so that is the third. */
export const DEEP_MODELS = Object.freeze(["anthropic/claude-sonnet-5", "openai/gpt-6-luna", "google/gemini-3.1-pro-preview"]);
export const DEEP_MAX_PROMPT_PER_MTOK = 5;       /* USD per million prompt tokens */
export const DEEP_MAX_COMPLETION_PER_MTOK = 20;  /* USD per million completion tokens */
const DEEP_MAX_REQUEST_USD = 0.01;               /* a flat per-request fee, if a name carries one */
const DEEP_TIMEOUT_MS = 60000;                   /* strong reasoning names think before they answer */
const SPEND_KEEP_S = 70 * 24 * 3600;
const NOCREDIT_S = 3600;
const monthStr = now => new Date(now).toISOString().slice(0, 7);
const K_SPEND = month => "nsoul:spend:" + month;
const K_SPEND_CALLS = month => "nsoul:spend:" + month + ":calls";
const K_NOCREDIT = "nsoul:nocredit";
/* round four: the day's own spend, beside the month's */
export const K_SPEND_DAY = day => "nsoul:spend:day:" + day;
const SPEND_DAY_KEEP_S = 3 * 24 * 3600;

/* min(10, SOUL_MONTHLY_USD). The variable may lower the cap, to 0 if the
   owner wants no paid calls at all; it can never raise it above
   DEEP_CAP_USD_MAX. Unset or not a number means the code's own 10. */
export function deepCapUsd() {
  const raw = String(process.env.SOUL_MONTHLY_USD == null ? "" : process.env.SOUL_MONTHLY_USD).trim();
  const n = raw === "" ? NaN : Number(raw);
  if (!Number.isFinite(n)) return DEEP_CAP_USD_MAX;
  return Math.min(DEEP_CAP_USD_MAX, Math.max(0, n));
}

/* DEEP_MODELS, or the subset of it SOUL_DEEP_MODELS names (a JSON array or
   a comma list), in the order the variable gives. A variable that names
   nothing on the code list leaves no paid name at all: narrowing to
   nothing is still narrowing, and a typo never widens anything. */
export function deepModels() {
  const raw = String(process.env.SOUL_DEEP_MODELS || "").trim();
  if (!raw) return DEEP_MODELS.slice();
  let want = null;
  try { const j = JSON.parse(raw); if (Array.isArray(j)) want = j; } catch { }
  if (!want) want = raw.split(",");
  const out = [];
  for (const w of want) {
    const id = String(w == null ? "" : w).trim();
    if (id && DEEP_MODELS.includes(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/* OpenRouter's live price for the deep names, from its public /models list,
   kept six hours in memory. Returns a Map id -> pricing for the deep names
   that list carries today, or null when the list could not be read and no
   copy younger than a day is held: null refuses every paid name. */
const DEEP_PRICE_TTL = 6 * 3600 * 1000;
const DEEP_PRICE_STALE = 24 * 3600 * 1000;
let deepPriceCache = { at: 0, prices: null };
export async function deepPrices(force) {
  const now = Date.now();
  /* any list read, even one that carries none of the deep names (an empty
     map), is kept with its time for six hours: the list is never downloaded
     again on every call just because it named nothing useful */
  if (!force && deepPriceCache.prices && now - deepPriceCache.at < DEEP_PRICE_TTL) return deepPriceCache.prices;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch("https://openrouter.ai/api/v1/models", { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    if (!j || !Array.isArray(j.data)) throw new Error("no data");
    const prices = new Map();
    for (const m of j.data) {
      if (m && m.id && DEEP_MODELS.includes(m.id) && m.pricing && typeof m.pricing === "object") prices.set(m.id, m.pricing);
    }
    deepPriceCache = { at: now, prices };
    return prices;
  } catch {
    clearTimeout(t);
    if (deepPriceCache.prices && now - deepPriceCache.at < DEEP_PRICE_STALE) return deepPriceCache.prices;
    return null;
  }
}

/* A live pricing block (USD per token, as strings) checked against the
   ceilings. A missing, negative or non-numeric price is refused: OpenRouter
   writes "-1" for a price that varies, and a variable price cannot be
   estimated, so it cannot be paid for under a cap. */
function deepPriceOf(p) {
  const req = v => (v == null || v === "") ? NaN : Number(v);
  const opt = v => (v == null || v === "") ? 0 : Number(v);
  const prompt = req(p.prompt);
  const completion = Math.max(req(p.completion), opt(p.internal_reasoning));
  const request = opt(p.request);
  if (![prompt, completion, request].every(x => Number.isFinite(x) && x >= 0)) {
    return { ok: false, why: "its live price is not a fixed number" };
  }
  const pM = prompt * 1e6, cM = completion * 1e6;
  if (pM > DEEP_MAX_PROMPT_PER_MTOK) return { ok: false, why: "prompt price " + pM.toFixed(2) + " USD per million tokens is over the ceiling of " + DEEP_MAX_PROMPT_PER_MTOK };
  if (cM > DEEP_MAX_COMPLETION_PER_MTOK) return { ok: false, why: "completion price " + cM.toFixed(2) + " USD per million tokens is over the ceiling of " + DEEP_MAX_COMPLETION_PER_MTOK };
  if (request > DEEP_MAX_REQUEST_USD) return { ok: false, why: "a per-request fee of " + request + " USD is over the ceiling of " + DEEP_MAX_REQUEST_USD };
  return { ok: true, prompt, completion, request };
}

/* USD to whole micro-dollars, rounded up (after shaving float noise, so
   0.003 is 3000, not 3001). Anything not a finite, non-negative number is
   null: the ledger never takes a negative or a NaN. */
function toMicro(usd) {
  const n = Number(usd);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.ceil(Math.round(n * 1e9) / 1e3);
}
const usdLabel = micro => (micro / 1e6).toFixed(4) + " USD";

function worstCaseMicro(price, messages, maxTokens, tools) {
  let chars = 0;
  for (const m of messages) chars += String((m && m.content) == null ? "" : m.content).length + 16;
  if (tools) { try { chars += JSON.stringify(tools).length; } catch { } }
  const promptTok = Math.ceil(chars / 2);
  return toMicro(promptTok * price.prompt + maxTokens * price.completion + price.request) || 0;
}

function actualMicro(usage, price, fallbackMicro) {
  const u = usage || {};
  if (u.cost != null && u.cost !== "") {
    const c = toMicro(u.cost);
    if (c != null) return c;
  }
  const pt = Number(u.prompt_tokens), ct = Number(u.completion_tokens);
  if (u.prompt_tokens != null && u.completion_tokens != null && Number.isFinite(pt) && pt >= 0 && Number.isFinite(ct) && ct >= 0) {
    const c = toMicro(pt * price.prompt + ct * price.completion + price.request);
    if (c != null) return c;
  }
  return fallbackMicro;
}

/* throws on any store fault or a ledger value that is not a plain count:
   the caller treats a throw as "refuse paid". Round five: it also reads
   whether the paid door was closed for the day (off). */
async function readLedger(now) {
  const month = monthStr(now);
  const r = await kv([["GET", K_SPEND(month)], ["GET", K_SPEND_CALLS(month)], ["GET", K_NOCREDIT], ["GET", K_SPEND_DAY(dayStr(now))], ["GET", K_DEEPOFF(dayStr(now))]]);
  if (!Array.isArray(r) || r.length < 4) throw new Error("ledger unreadable");
  const micro = r[0] == null ? 0 : Number(r[0]);
  const calls = r[1] == null ? 0 : Number(r[1]);
  const day = r[3] == null ? 0 : Number(r[3]);
  if (!Number.isFinite(micro) || micro < 0 || !Number.isFinite(calls) || calls < 0 || !Number.isFinite(day) || day < 0) throw new Error("ledger corrupt");
  return { month, micro, calls, nocredit: r[2] ? String(r[2]) : "", day, off: !!r[4] || paidOffDay === dayStr(now) };
}

/* round five (D1): the paid door, closed for the rest of a UTC day when a
   paid cost could not be written. The store keeps the mark when it can
   (api/_soul.js K.deepOff names the same key), this instance keeps it
   whether or not. */
export const K_DEEPOFF = day => "nsoul:deepoff:" + day;
let paidOffDay = "";
export async function closePaidDay(why, now) {
  const t = Number.isFinite(now) ? now : Date.now();
  paidOffDay = dayStr(t);
  if (!kvReady()) return;
  try { await kv([["SET", K_DEEPOFF(dayStr(t)), JSON.stringify({ at: new Date(t).toISOString(), why: String(why || "a paid call's cost could not be written to the ledger").slice(0, 160) }), "EX", "172800"]]); } catch { }
}
/* a test's own day turns: the memory of a closed door is for one day only */
export function forgetPaidDay() { paidOffDay = ""; }
const PAID_OFF_WHY = "the paid door is closed for the rest of the day: a paid call's cost could not be written to the ledger";

/* the worst case held in both ledgers before anything is sent. {ok, hold}
   or {ok:false, store, why}: a cap it would pass (the hold given back at
   once) or a store that did not take it (store:true, fail closed) */
async function reserveSpend(now, micro, capMicro, dayCapMicro) {
  const m = Number.isFinite(micro) && micro > 0 ? Math.ceil(micro) : 0;
  const month = monthStr(now), day = dayStr(now), dk = K_SPEND_DAY(day);
  let r;
  try { r = await kv([["INCRBY", K_SPEND(month), String(m)], ["EXPIRE", K_SPEND(month), String(SPEND_KEEP_S)], ["INCRBY", dk, String(m)], ["EXPIRE", dk, String(SPEND_DAY_KEEP_S)]]); }
  catch { return { ok: false, store: true, why: "the spend ledger did not take the hold on its worst case, so nothing is paid (fail closed)" }; }
  const mAfter = r && r[0] != null ? Number(r[0]) : NaN, dAfter = r && r[2] != null ? Number(r[2]) : NaN;
  const hold = { month, day, micro: m, at: now };
  if (!Number.isFinite(mAfter) || !Number.isFinite(dAfter)) {
    await giveBack({ ...hold, micro: 0 }, Number.isFinite(mAfter) ? m : 0, Number.isFinite(dAfter) ? m : 0);
    return { ok: false, store: true, why: "the spend ledger did not take the hold on its worst case, so nothing is paid (fail closed)" };
  }
  if (mAfter > capMicro) {
    await giveBack(hold, m, m);
    return { ok: false, why: "its worst case of " + usdLabel(m) + " would pass the monthly cap (" + usdLabel(Math.max(0, mAfter - m)) + " of " + usdLabel(capMicro) + " spent or held in " + month + ")" };
  }
  if (dAfter > dayCapMicro) {
    await giveBack(hold, m, m);
    return { ok: false, why: "its worst case of " + usdLabel(m) + " would pass the day's cap (" + usdLabel(Math.max(0, dAfter - m)) + " of " + usdLabel(dayCapMicro) + " spent or held today)" };
  }
  return { ok: true, hold };
}
/* a hold given back (a refusal, an answer that cost less): best effort, since
   a give back that fails only leaves the ledger counting more than was spent */
async function giveBack(hold, monthMicro, dayMicro) {
  const cmds = [];
  if (monthMicro > 0) cmds.push(["INCRBY", K_SPEND(hold.month), String(-monthMicro)]);
  if (dayMicro > 0) cmds.push(["INCRBY", K_SPEND_DAY(hold.day), String(-dayMicro)]);
  if (!cmds.length) return;
  try { await kv(cmds); } catch { }
}
/* after the call: the actual cost in place of the worst case held, and the
   month's count of paid calls when it was billed. {ok} or {ok:false, short}:
   a correction that adds was not written, so the ledger is short by it */
async function settleSpend(hold, actualMicro, billed) {
  const actual = Number.isFinite(actualMicro) && actualMicro > 0 ? Math.ceil(actualMicro) : 0;
  const delta = actual - hold.micro;
  const cmds = [];
  if (delta) cmds.push(["INCRBY", K_SPEND(hold.month), String(delta)], ["INCRBY", K_SPEND_DAY(hold.day), String(delta)]);
  if (billed) cmds.push(["INCR", K_SPEND_CALLS(hold.month)], ["EXPIRE", K_SPEND_CALLS(hold.month), String(SPEND_KEEP_S)]);
  if (!cmds.length) return { ok: true };
  let r = null;
  try { r = await kv(cmds); } catch { r = null; }
  if (delta > 0 && !(r && Number.isFinite(Number(r[0])) && Number.isFinite(Number(r[1])))) return { ok: false, short: delta };
  return { ok: true };
}

/* a 402 from OpenRouter means the account holds no credit: every paid name
   would answer the same, so the whole deep tier rests on free names for an
   hour rather than knocking on the same closed door each call. Kept in
   memory too, for the hour, in case the store write itself fails. */
let noCreditUntil = 0;
async function rememberNoCredit(now, why) {
  noCreditUntil = now + NOCREDIT_S * 1000;
  try {
    await kv([["SET", K_NOCREDIT, (new Date(now).toISOString() + " " + String(why || "402")).slice(0, 200)], ["EXPIRE", K_NOCREDIT, String(NOCREDIT_S)]]);
  } catch { }
}

/* Walks the paid names. Returns { ok, got, micro } where micro is what this
   walk added to the ledger (on success, a timeout, or both). Every name it
   passes over, and why, goes into tried with paid:true. */
async function deepWalk(task, messages, perPerson, now, tried, purpose) {
  const out = { ok: false, got: null, micro: 0 };
  const note = (model, err, more) => tried.push({ provider: "openrouter", model, paid: true, err, ...(more || {}) });
  const models = deepModels();
  if (!models.length) { note("(deep)", "skipped: SOUL_DEEP_MODELS names no model on the code's deep list, so no paid model is allowed"); return out; }
  if (perPerson) {
    for (const m of models) note(m, "skipped: per-person data is never sent to a paid model; only totals reach any model");
    return out;
  }
  if (!providerPresent("openrouter")) { note("(deep)", "skipped: no OpenRouter key, so no paid model"); return out; }
  if (!kvReady()) { note("(deep)", "skipped: no store to keep the spend ledger, so paid models are refused"); return out; }
  let ledger;
  try { ledger = await readLedger(now); }
  catch { note("(deep)", "skipped: the spend ledger could not be read, so paid models are refused (fail closed)"); return out; }
  if (ledger.nocredit || now < noCreditUntil) {
    note("(deep)", "skipped: no credit on the OpenRouter account (402" + (ledger.nocredit ? " at " + ledger.nocredit.slice(0, 20) : "") + "); free models only for the hour");
    return out;
  }
  /* round five (D1): a door closed for the day stays closed, whoever asks */
  if (ledger.off) { note("(deep)", "skipped: " + PAID_OFF_WHY); return out; }
  const prices = await deepPrices(false);
  if (!prices) { note("(deep)", "skipped: OpenRouter's live model list could not be read, so no price can be checked and paid is refused"); return out; }

  const capMicro = toMicro(deepCapUsd()) || 0;
  const dayCapMicro = toMicro(PAID_DAY_CAP_USD) || 0;
  const callMaxMicro = toMicro(PAID_CALL_MAX_USD) || 0;
  let spent = ledger.micro, spentDay = ledger.day;
  const opts = task.opts || {};
  const maxTokens = Math.max(1, parseInt(opts.max_tokens, 10) || 500);
  /* round five (the review, D4): a paid call that can carry mail or a
     person's words (the mail tier's letter retry, the owner's own Ask) is
     routed only to endpoints that keep nothing, OpenRouter's zdr flag beside
     data_collection "deny" */
  const zdr = task.tier === "mail" || purpose === "letter-retry" || purpose === "ask-deep";
  for (const model of models) {
    const p = prices.get(model);
    if (!p) { note(model, "skipped: not on OpenRouter's live model list today"); continue; }
    const price = deepPriceOf(p);
    if (!price.ok) { note(model, "refused: " + price.why); continue; }
    const est = worstCaseMicro(price, messages, maxTokens, opts.tools);
    /* round four: one call's own ceiling, the Monday strategy alone above it */
    if (est > callMaxMicro && purpose !== "weekly-strategy") {
      note(model, "refused: its worst case of " + usdLabel(est) + " is over the " + usdLabel(callMaxMicro) + " a single call may cost (only the Monday strategy may pass it)");
      continue;
    }
    if (spent + est > capMicro) {
      note(model, "refused: its worst case of " + usdLabel(est) + " would pass the monthly cap (" + usdLabel(spent) + " of " + usdLabel(capMicro) + " spent in " + ledger.month + ")");
      continue;
    }
    /* round four: and the day's own cap, inside the month's */
    if (spentDay + est > dayCapMicro) {
      note(model, "refused: its worst case of " + usdLabel(est) + " would pass the day's cap (" + usdLabel(spentDay) + " of " + usdLabel(dayCapMicro) + " spent today)");
      continue;
    }
    /* round five (D1): the worst case held in both ledgers before a byte is
       sent; what the read above could not see (a call running beside this
       one) the hold sees */
    const held = await reserveSpend(now, est, capMicro, dayCapMicro);
    if (!held.ok) {
      note(model, "refused: " + held.why);
      if (held.store) return out;
      continue;
    }
    const callOpts = { ...opts, max_tokens: maxTokens, timeout: opts.timeout || DEEP_TIMEOUT_MS };
    if (task.json && !callOpts.response_format && await jsonCapable("openrouter", model)) {
      callOpts.response_format = { type: "json_object" };
    }
    const got = await send("openrouter", model, messages, callOpts, { paid: true, zdr });

    let micro = 0;
    if (got.ok || got.status === 200) micro = actualMicro(got.usage, price, est);
    else if (got.netError) micro = est;
    let ledgerNote = "";
    const settled = await settleSpend(held.hold, micro, got.ok || micro > 0);
    if (!settled.ok) {
      ledgerNote = " (store fault: " + usdLabel(settled.short) + " of this cost could not be written to the ledger, so the paid door is closed for the rest of the day)";
      out.spendFailed = true;
      await closePaidDay("a paid call's cost could not be written to the ledger", now);
    }
    if (got.ok || micro > 0) {
      spent += micro;
      spentDay += micro;
      out.micro += micro;
      /* round four: every paid call is a line in the ROI ledger, its outcome
         left for what the call leads to (paidOutcome); a call that failed is
         its own outcome at once */
      const line = await roiAdd(now, { task: purpose || "deep", model, costUsd: micro / 1e6,
        outcome: got.ok ? null : { helped: false, note: "the call failed: " + String(got.error || "no answer").slice(0, 120), at: new Date(now).toISOString() } });
      if (got.ok && line) out.paidId = line;
    }
    const tokens = (got.usage && (got.usage.total_tokens || got.usage.totalTokens)) || 0;
    await recordUsage("openrouter", now, tokens, model, got);   /* round four: the paid names are measured too */
    if (got.status === 402) {
      await rememberNoCredit(now, got.error);
      note(model, "no credit: OpenRouter answered 402, so the deep tier uses free models for the next hour", { ms: got.ms });
      return out;
    }
    note(model, (got.ok ? "" : got.error) + ledgerNote, { ms: got.ms, costUsd: micro / 1e6 });
    if (got.ok) { out.ok = true; out.got = got; return out; }
    if (got.blocked || out.spendFailed) return out;   /* round five: a closed door asks no second name */
  }
  return out;
}

/* ---------------------------------------------------------------------------
   8b. THE ROI LEDGER (round four, 7 October 2026): what each paid dollar
       bought. nsoul:paid:<YYYY-MM>, a hash of one line a paid call, {id, at,
       task, model, costUsd, outcome}; task is the use it was paid for
       (LEDGER_TASKS), outcome null until the caller learns what the call led
       to and says so with paidOutcome(id, {helped, note}). Kept 400 days.
--------------------------------------------------------------------------- */
export const K_PAID = month => "nsoul:paid:" + month;
const PAID_KEEP_S = 400 * 86400;
async function roiAdd(now, e) {
  if (!kvReady()) return null;
  const month = monthStr(now);
  const id = "pd-" + month + "-" + crypto.randomBytes(4).toString("hex");
  const line = { id, at: new Date(now).toISOString(), task: String(e.task || "deep").slice(0, 40), model: String(e.model || "").slice(0, 80),
    costUsd: Math.round((Number(e.costUsd) || 0) * 1e6) / 1e6, outcome: e.outcome || null };
  try { await kv([["HSET", K_PAID(month), id, JSON.stringify(line)], ["EXPIRE", K_PAID(month), String(PAID_KEEP_S)]]); return id; }
  catch { return null; }
}
/* a paid line written from outside this file: the research's web search
   (api/_outreach.js), which keeps its own door; its cost is already in the
   month's ledger by its own hand, so this adds only the day's and the line.
   (Round five: a caller that pays outside route() should hold its worst
   case first with paidReserve and settle it with paidSettle, below, which
   keep both ledgers and the line themselves; paidRecord stays for the
   callers that have not moved yet.) */
export async function paidRecord(e = {}) {
  const now = Number.isFinite(e.now) ? e.now : Date.now();
  const micro = toMicro(e.costUsd) || 0;
  if (micro && kvReady()) {
    const dk = K_SPEND_DAY(dayStr(now));
    try { await kv([["INCRBY", dk, String(micro)], ["EXPIRE", dk, String(SPEND_DAY_KEEP_S)]]); } catch { }
  }
  return roiAdd(now, { task: e.task, model: e.model, costUsd: micro / 1e6, outcome: e.outcome || null });
}
/* the day's paid room for a call whose worst case is estUsd, read the same
   way deepWalk reads it: {ok, why, dayUsd, monthUsd}; a store that cannot be
   read refuses (fail closed) */
export async function paidRoom(estUsd, purpose) {
  const now = Date.now();
  if (!kvReady()) return { ok: false, why: "no store to keep the spend ledger, so nothing paid" };
  let l;
  try { l = await readLedger(now); } catch { return { ok: false, why: "the spend ledger could not be read, so nothing paid (fail closed)" }; }
  if (l.off) return { ok: false, why: PAID_OFF_WHY };   /* round five (D1) */
  const est = toMicro(estUsd) || 0;
  if (est > (toMicro(PAID_CALL_MAX_USD) || 0) && purpose !== "weekly-strategy") return { ok: false, why: "its worst case of " + usdLabel(est) + " is over the paid budget of " + usdLabel(toMicro(PAID_CALL_MAX_USD)) + " a call" };
  if (l.day + est > (toMicro(PAID_DAY_CAP_USD) || 0)) return { ok: false, why: "the day's paid budget of " + usdLabel(toMicro(PAID_DAY_CAP_USD)) + " would not hold it (" + usdLabel(l.day) + " spent today)" };
  if (l.micro + est > (toMicro(deepCapUsd()) || 0)) return { ok: false, why: "the month's paid budget would not hold it" };
  return { ok: true, dayUsd: l.day / 1e6, monthUsd: l.micro / 1e6 };
}
/* round five (D1): a paid call made outside route() holds its worst case the
   way deepWalk does, before it is sent: {ok, hold} or {ok:false, why}. The
   caller then writes neither ledger itself: paidSettle puts the actual cost
   in place of the hold, counts the call, writes its ROI line and closes the
   paid door for the day when the cost could not be written. */
export async function paidReserve(estUsd, purpose) {
  const room = await paidRoom(estUsd, purpose);
  if (!room.ok) return room;
  const now = Date.now();
  const r = await reserveSpend(now, toMicro(estUsd) || 0, toMicro(deepCapUsd()) || 0, toMicro(PAID_DAY_CAP_USD) || 0);
  return r.ok ? { ok: true, hold: { ...r.hold, purpose: paidPurposeOf(purpose) || String(purpose || "").slice(0, 40) } } : { ok: false, why: r.why };
}
/* e: {costUsd (the actual, null when it is not known: the hold stands),
   model, task, outcome}. {ok, paidId, spendRecorded} */
export async function paidSettle(hold, e = {}) {
  if (!hold || !hold.month || !hold.day || !Number.isFinite(hold.micro)) return { ok: false, spendRecorded: false, why: "no hold to settle" };
  const known = e.costUsd != null && Number.isFinite(Number(e.costUsd));
  const actual = known ? (toMicro(e.costUsd) || 0) : hold.micro;
  const s = await settleSpend(hold, actual, actual > 0);
  if (!s.ok) await closePaidDay("a paid call's cost could not be written to the ledger");
  const paidId = actual > 0 ? await roiAdd(hold.at || Date.now(), { task: e.task || hold.purpose || "deep", model: e.model, costUsd: actual / 1e6, outcome: e.outcome || null }) : null;
  return { ok: true, paidId, spendRecorded: s.ok, costUsd: actual / 1e6 };
}
export async function paidOutcome(id, outcome) {
  const m = /^pd-(\d{4}-\d{2})-[0-9a-f]+$/.exec(String(id || ""));
  if (!m || !kvReady()) return { ok: false };
  try {
    const r = await kv([["HGET", K_PAID(m[1]), id]]);
    const cur = r && r[0] ? (typeof r[0] === "string" ? JSON.parse(r[0]) : r[0]) : null;
    if (!cur) return { ok: false };
    const o = outcome && typeof outcome === "object" ? outcome : {};
    cur.outcome = { helped: !!o.helped, note: String(o.note || "").replace(/\s+/g, " ").slice(0, 200), at: new Date().toISOString() };
    await kv([["HSET", K_PAID(m[1]), id, JSON.stringify(cur)], ["EXPIRE", K_PAID(m[1]), String(PAID_KEEP_S)]]);
    return { ok: true, line: cur };
  } catch { return { ok: false }; }
}
export async function paidLedger(month) {
  const mo = /^\d{4}-\d{2}$/.test(String(month || "")) ? month : monthStr(Date.now());
  if (!kvReady()) return [];
  try {
    const r = await kv([["HGETALL", K_PAID(mo)]]);
    const h = hashOfReply(r && r[0]);
    return Object.values(h).map(v => { try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return null; } })
      .filter(x => x && x.id).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  } catch { return []; }
}
/* {month, calls, usd, helped, waiting, uses: {task: n}, line}: the month's
   paid use as the Home and the brief say it */
export async function roiSummary(month) {
  const mo = /^\d{4}-\d{2}$/.test(String(month || "")) ? month : monthStr(Date.now());
  const lines = await paidLedger(mo);
  const uses = {};
  let usd = 0, helped = 0, waiting = 0;
  for (const l of lines) {
    usd += Number(l.costUsd) || 0;
    uses[l.task] = (uses[l.task] || 0) + 1;
    if (l.outcome && l.outcome.helped) helped++;
    if (!l.outcome) waiting++;
  }
  usd = Math.round(usd * 100) / 100;
  return { month: mo, calls: lines.length, usd, helped, waiting, uses, line: roiLine(lines.length, usd, uses) };
}
/* "Paid models this month: 1.20 dollars, 3 uses: the Monday strategy, a tie
   break and a letter retry." (null when nothing was paid for this month) */
export function roiLine(calls, usd, uses) {
  if (!calls) return null;
  const words = [];
  for (const [task, n] of Object.entries(uses || {})) {
    const w = LEDGER_TASKS[task] || "another use";
    words.push(n > 1 ? w.replace(/^(a|an|the) /, "") + " " + n + " times" : w);
  }
  const list = words.length <= 1 ? (words[0] || "") : words.slice(0, -1).join(", ") + " and " + words[words.length - 1];
  return "Paid models this month: " + (Math.round((Number(usd) || 0) * 100) / 100).toFixed(2) + " dollars, " + calls + (calls === 1 ? " use" : " uses") + (list ? ": " + list : "") + ".";
}

/* ---------------------------------------------------------------------------
   9. THE MAIL TIER (6 October 2026, LANTERN.md section 11.1). The mailbox's
      correspondence, the messages the house receives and the answers it
      writes, is per-person data, which the amended red line lets only models
      that neither keep nor learn from it read, and only to answer it:
        1. Groq's free names, gpt-oss-120b then gpt-oss-20b (Groq keeps no
           inference data by default), each through the same free gate and
           the same bucket as every other free call (caller "soul" takes at
           most half of a day);
        2. (round four) the AI Gateway's free names, every request carrying
           zero data retention and no training, so the gateway itself lets
           only a provider that keeps nothing answer (or refuses, 400
           no_providers_available, and the name waits a day); these and
           Groq's are ordered by the scoreboard, Groq first between equals;
        3. then, only for a letter retry (task.purpose "letter-retry", round
           four), the deep tier's own paid names on OpenRouter, through every
           gate of section 8 (the code list, the live price, the ceilings,
           the hold on the day's and the month's caps) with the provider
           preferences data_collection "deny" AND zdr true (round five, the
           review, D4: "deny" alone still let an endpoint that keeps prompts
           for a while answer; zdr routes only to endpoints with a zero data
           retention policy, and a name with none is refused by OpenRouter
           and passed over). Any other mail call stops at the free names.
      Gemini's free tier, Cerebras and OpenRouter's ":free" names are never
      candidates here at all. Journal text is still refused before anything
      (route()). Every message is still scrubbed in send(), and the caller
      (api/_mail.js) masks every address and phone number before it gets
      here. The answer has the deep tier's shape: paid, and costUsd.
--------------------------------------------------------------------------- */
export const MAIL_GROQ = Object.freeze(["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
/* the mail tier's free candidates, unranked: Groq's two names, then the
   gateway's (round four); what is passed over is said in tried */
async function mailCandidates(tried) {
  const cands = [];
  if (providerPresent("groq")) {
    const ids = await freeModels("groq", false);
    for (const model of MAIL_GROQ) {
      if (!ids.includes(model)) { tried.push({ provider: "groq", model, err: "skipped: not on Groq's live free list today" }); continue; }
      cands.push({ provider: "groq", model });
    }
  } else tried.push({ provider: "groq", model: "(mail)", err: "skipped: no GROQ_API_KEY on this deployment" });
  /* round four: the gateway's free names, asked to keep nothing */
  if (providerPresent("gateway")) {
    const ids = await freeModels("gateway", false);
    const parked = await refusedSet(ids.slice(0, GW_DEPTH + 4), "gateway");
    let n = 0;
    for (const id of ids) {
      if (n >= GW_DEPTH) break;
      if (parked.has(id)) { tried.push({ provider: "gateway", model: id, err: "skipped: refused in the last day under zero data retention" }); continue; }
      cands.push({ provider: "gateway", model: id }); n++;
    }
  }
  return cands;
}
async function mailWalk(task, messages, now, tried) {
  const done = (more) => ({ tier: "mail", tried, paid: false, costUsd: 0, ...more });
  const cands = await mailCandidates(tried);
  const est = estimateTokens(messages, task.opts && task.opts.max_tokens);
  for (const cand of await exploreFirst("mail", await rankByQuality(cands, now), now)) {   /* round five: faults fade */
    const { provider, model } = cand;
    const gate = await checkAndReserve(provider, model, now, task.caller, est);
    if (!gate.ok) { tried.push({ provider, model, err: "rate limit reached for today (" + gate.why + ")" }); continue; }
    const callOpts = { ...(task.opts || {}) };
    if (task.json && !callOpts.response_format && await jsonCapable(provider, model)) callOpts.response_format = { type: "json_object" };
    const got = await chatOnce(provider, model, messages, callOpts);
    tried.push({ provider, model, ms: got.ms, err: got.ok ? "" : got.error });
    if (parkable(provider, got)) await rememberRefused(model, got.error, provider);
    const tokens = (got.usage && (got.usage.total_tokens || got.usage.totalTokens)) || 0;
    await recordUsage(provider, now, tokens, model, got);
    if (got.ok) {
      await addTokens(provider, model, now, tokens);
      return done({ ok: true, content: got.content, tool_calls: got.tool_calls, usage: got.usage, model: got.model, provider, measured: { provider, model } });
    }
    if (got.blocked) return done({ ok: false, error: got.error, blocked: true });
  }
  /* correspondence may reach a paid name that keeps nothing: perPerson is
     false here by the amended red line, and only here. task.noPaid: the
     caller found the paid names closed for the day (nsoul:deepoff). Round
     four: and only for a letter retry. */
  let paid = { ok: false, got: null, micro: 0 };
  const purpose = paidPurposeOf(task.purpose);
  if (purpose !== "letter-retry") tried.push({ provider: "openrouter", model: "(mail)", paid: true, err: "skipped: on the mail tier a paid model is asked only to write a letter again for a place of high value, after its free drafts failed their checks twice" });
  else if (task.noPaid) tried.push({ provider: "openrouter", model: "(mail)", paid: true, err: "skipped: paid names are closed for the rest of the day" });
  else paid = await deepWalk(task, messages, false, now, tried, purpose);
  const costUsd = paid.micro / 1e6;
  if (paid.ok) {
    return done({ ok: true, spendRecorded: !paid.spendFailed, content: paid.got.content, tool_calls: paid.got.tool_calls, usage: paid.got.usage,
      model: paid.got.model, provider: "openrouter", paid: true, costUsd, purpose, paidId: paid.paidId || null, measured: { provider: "openrouter", model: paid.got.asked || paid.got.model } });
  }
  return done({ ok: false, error: "no model that keeps nothing answered (" + tried.map(t => t.model + ": " + (t.err || "no answer")).join("; ").slice(0, 300) + ")",
    costUsd, ...(paid.spendFailed ? { spendRecorded: false, paidButUnrecorded: true } : {}) });
}

/* The month's paid spend, for the Soul's console. usd is null (with an
   error) when the ledger cannot be read, never a guessed 0. */
export async function spendReport(now) {
  const t = Number.isFinite(now) ? now : Date.now();
  const month = monthStr(t);
  const capUsd = deepCapUsd();
  if (!kvReady()) return { month, usd: 0, capUsd, calls: 0, note: "no store: paid calls are refused, so nothing is spent" };
  try {
    const l = await readLedger(t);
    return { month, usd: l.micro / 1e6, capUsd, calls: l.calls, noCredit: l.nocredit || "",
      dayUsd: l.day / 1e6, dayCapUsd: PAID_DAY_CAP_USD, callMaxUsd: PAID_CALL_MAX_USD };   /* round four */
  } catch {
    return { month, usd: null, capUsd, calls: null, error: "the spend ledger could not be read" };
  }
}

/* ---------------------------------------------------------------------------
   10. THE RANKING IN PLAIN WORDS (round four): what the engine room's models
       view and the cycle's evidence show. Each tier's candidates in the order
       the next call would ask them, with what each has shown these two weeks,
       and one sentence a tier the owner can read.
--------------------------------------------------------------------------- */
const PROVIDER_WORD = { groq: "Groq", gemini: "Gemini", openrouter: "OpenRouter", gateway: "the AI Gateway", cerebras: "Cerebras", nvidia: "NVIDIA" };
const nameOf = c => (PROVIDER_WORD[c.provider] || c.provider) + "'s " + String(c.model).replace(/^[a-z0-9-]+\//i, "");
function shownOf(r) {
  if (!r.calls) return "not measured yet";
  const bits = ["answered " + r.answered + " of " + r.calls];
  if (r.checks) bits.push("passed " + r.passed + " of " + r.checks + " checks");
  if (r.msAvg != null) bits.push(r.msAvg < 100 ? "under a tenth of a second" : (Math.round(r.msAvg / 100) / 10) + " seconds");
  return bits.join(", ");
}
const TIER_WORD = { fast: "Quick work", strong: "Writing and judging", long: "Long reading", mail: "Mail" };
export async function rankingReport() {
  const now = Date.now();
  const out = { at: new Date(now).toISOString(), tiers: {}, words: [] };
  for (const tier of TIER_NAMES.concat(["mail"])) {
    const chain = tier === "mail" ? await rankByQuality(await mailCandidates([]), now) : await chainFor(tier);
    const stats = await scoresFor(chain, now);
    const rows = chain.map(c => {
      const st = stats.get(c.provider + ":" + c.model) || {};
      return { provider: c.provider, model: c.model, quality: qualityOf(st), calls: st.n || 0, answered: st.ok || 0, failed: st.fail || 0,
        checks: st.gn || 0, passed: st.gp || 0, msAvg: st.ok ? Math.round((st.ms || 0) / st.ok) : null, lastError: st.err || null, lastErrorAt: st.errAt || null };
    });
    out.tiers[tier] = rows;
    out.words.push(rows.length
      ? TIER_WORD[tier] + ": " + rows.slice(0, 3).map((r, i) => (i === 0 ? "first " : "then ") + nameOf(r) + " (" + shownOf(r) + ")").join(", ") + (rows.length > 3 ? ", and " + (rows.length - 3) + " more after them" : "") + "."
      : TIER_WORD[tier] + ": no free model is configured or live today.");
  }
  /* the gateway's own free list, and which of it waits */
  if (providerPresent("gateway")) {
    const ids = await freeModels("gateway", false);
    const parked = await refusedSet(ids, "gateway");
    const without = gatewayWithout();
    out.gateway = { free: ids, waiting: ids.filter(id => parked.has(id)), without };
    out.words.push(ids.length
      ? "The AI Gateway's free models today: " + ids.join(", ") + (out.gateway.waiting.length ? "; " + out.gateway.waiting.length + " of them found no provider that keeps nothing and learns nothing, so they wait a day before they are asked again." : "; each is asked to keep nothing and learn nothing.")
      : without ? "The AI Gateway's " + without + " free " + (without === 1 ? "model has" : "models have") + " no provider that keeps nothing and learns nothing today, so none is asked."
      : "The AI Gateway's free list could not be read, or holds no language model today.");
  } else out.gateway = null;
  /* round five: NVIDIA's catalog, held back while its trial terms stand */
  out.nvidia = providerPresent("nvidia") ? { on: true, free: await freeModels("nvidia", false) } : { on: false, held: nvidiaHeld() };
  if (out.nvidia.held) out.words.push("NVIDIA's free models are held back: its catalog is free for trial use only, not production, so they are asked only once NVIDIA allows the house's use and NVIDIA_PRODUCTION_OK is set.");
  return out;
}

export { PROVIDERS, GROQ_ALLOW, GEMINI_ALLOW, CEREBRAS_ALLOW, NVIDIA_ALLOW };
