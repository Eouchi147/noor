// NOOR · the Lantern's model router: three free providers, never billed.
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

import { kv, kvReady } from "./_kv.js";
import { isFree as orIsFree, refreshFreeModels as orRefreshFreeModels } from "./_models.js";

/* ---------------------------------------------------------------------------
   1. PROVIDERS. One OpenAI-compatible base URL each; a provider with no key
      set on this deployment simply does not exist, quietly, the same way a
      missing OPENROUTER_API_KEY already makes the Lantern fall back to
      written text rather than error.
--------------------------------------------------------------------------- */
const PROVIDER_BASE = {
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai"
};
const PROVIDER_KEYENV = {
  openrouter: "OPENROUTER_API_KEY",
  groq: "GROQ_API_KEY",
  gemini: "GEMINI_API_KEY"
};
const PROVIDERS = Object.keys(PROVIDER_KEYENV);

function keyFor(provider) { return String(process.env[PROVIDER_KEYENV[provider]] || "").trim(); }
export function providerPresent(provider) { return !!keyFor(provider); }
export function providersConfigured() {
  const out = {};
  for (const p of PROVIDERS) out[p] = providerPresent(p) ? "set" : "missing";
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
const GEMINI_FLASH_ORDER = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"];
const GEMINI_FLASH_LITE_ORDER = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
const GEMINI_ALLOW = GEMINI_FLASH_ORDER.concat(GEMINI_FLASH_LITE_ORDER);

const ALLOW = { groq: GROQ_ALLOW, gemini: GEMINI_ALLOW };

/* ---- live discovery, cached in the store the same shape as _models.js ---- */
const SIX_HOURS = 6 * 3600 * 1000;
const KEEP = 60 * 60 * 24 * 30;
const K_LIVE = p => "nllm:live:" + p;
const LIVE = { groq: { at: 0, ids: [] }, gemini: { at: 0, ids: [] } };

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
  const allow = ALLOW[provider];
  if (!allow) return [];
  const ids = await liveModels(provider, !!force);
  if (ids.length) return allow.filter(id => ids.includes(id));
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
   exactly as through Groq or Gemini, no exceptions. The variable still has
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
const CAPS = {
  groq: { rpm: 25, rpd: 800, tpd: 150000 },
  gemini: { rpm: 8, rpd: 150 },
  openrouter: { rpm: 15, rpd: () => { const n = parseInt(process.env.OPENROUTER_DAILY, 10); return n > 0 ? n : 40; } }
};

const dayStr = now => new Date(now).toISOString().slice(0, 10);
const minuteEpoch = now => Math.floor(now / 60000);
const rlKey = (provider, model, kind, part) => "nllm:rl:" + provider + ":" + model + ":" + kind + ":" + part;
const tokKey = (provider, model, day) => "nllm:tok:" + provider + ":" + model + ":" + day;

/* Checked before every call, and reserved atomically with it: a name that is
   only found to be over budget AFTER it answered would defeat the point. */
export async function checkAndReserve(provider, model, now) {
  const caps = CAPS[provider];
  if (!caps) return { ok: true };
  if (!kvReady()) return { ok: true };
  /* OpenRouter's free allowance belongs to the account, not to a model:
     fifty requests a day however they are spread across its free names. Now
     that a tier walks several of them, one bucket stands for all. */
  if (provider === "openrouter") model = "*";
  const rpd = typeof caps.rpd === "function" ? caps.rpd() : caps.rpd;
  const mKey = rlKey(provider, model, "m", minuteEpoch(now));
  const dKey = rlKey(provider, model, "d", dayStr(now));
  const wantTok = !!caps.tpd;
  try {
    const cmds = [["GET", mKey], ["GET", dKey]];
    if (wantTok) cmds.push(["GET", tokKey(provider, model, dayStr(now))]);
    const r = await kv(cmds);
    const mCount = parseInt(r[0] || "0", 10) || 0;
    const dCount = parseInt(r[1] || "0", 10) || 0;
    const tCount = wantTok ? (parseInt(r[2] || "0", 10) || 0) : 0;
    if (mCount >= caps.rpm) return { ok: false, why: "rpm" };
    if (dCount >= rpd) return { ok: false, why: "rpd" };
    if (wantTok && tCount >= caps.tpd) return { ok: false, why: "tpd" };
    await kv([["INCR", mKey], ["EXPIRE", mKey, "70"], ["INCR", dKey], ["EXPIRE", dKey, "90000"]]);
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

async function recordUsage(provider, now, tokens) {
  if (!kvReady()) return;
  try {
    const k = "nllm:usage:" + provider + ":" + dayStr(now);
    await kv([["HINCRBY", k, "requests", "1"], ["HINCRBY", k, "tokens", String(tokens || 0)], ["EXPIRE", k, "2592000"]]);
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
   5. ONE OPENAI-COMPATIBLE CHAT CALL, for all three providers. Free-only is
      enforced here too, not only by the caller, so nothing that reaches this
      function can ever bill by accident: a second gate on the one door that
      actually talks to the network.
--------------------------------------------------------------------------- */
export async function chatOnce(provider, model, messages, opts = {}) {
  const key = keyFor(provider);
  const t0 = Date.now();
  if (!key) return { ok: false, error: "no key", provider, model };
  if (!PROVIDER_BASE[provider]) return { ok: false, error: "unknown provider", provider, model };
  if (!(await isAllowed(provider, model))) {
    return { ok: false, error: "refused: " + model + " is not on " + provider + "'s free allow-list", provider, model, blocked: true };
  }

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
      let why = "";
      try { const e = await r.json(); why = String((e && e.error && (e.error.message || e.error)) || "").slice(0, 160); }
      catch { try { why = (await r.text()).slice(0, 160); } catch { } }
      return { ok: false, error: "http " + r.status + (why ? ": " + why : ""), status: r.status, provider, model, ms };
    }
    const j = await r.json();
    const choice = ((j.choices || [])[0] || {}).message || {};
    const content = String(choice.content || "").trim();
    const tool_calls = choice.tool_calls || null;
    const usage = j.usage || {};
    if (!content && !tool_calls) return { ok: false, error: "empty", provider, model, ms };
    return { ok: true, content, tool_calls, usage, model: j.model || model, provider, ms };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: e && e.name === "AbortError" ? "timeout" : String(e && e.message || e).slice(0, 120), provider, model, ms: Date.now() - t0 };
  }
}

/* ---------------------------------------------------------------------------
   6. TIERS. Which provider and which named model answers a "fast", "strong"
      or "long" task first, in the order the marching orders name, plus the
      last name that actually worked, remembered per tier the way
      api/_models.js remembers nlm:good.
--------------------------------------------------------------------------- */
const TIERS = {
  /* routing, tool selection, short classification: speed over depth */
  fast: [
    { provider: "groq", pick: "openai/gpt-oss-20b" },
    { provider: "gemini", pick: "flash-lite" },
    { provider: "openrouter", pick: "best" }
  ],
  /* synthesis, strategy, writing: quality over speed */
  strong: [
    { provider: "gemini", pick: "flash" },
    { provider: "groq", pick: "openai/gpt-oss-120b" },
    { provider: "openrouter", pick: "best" }
  ],
  /* large context dumps: Gemini's flash family carries the biggest window
     of the three, so it goes first; the fallback below it is the same as
     "strong" once the dump is small enough for either to hold it */
  long: [
    { provider: "gemini", pick: "flash" },
    { provider: "groq", pick: "openai/gpt-oss-120b" },
    { provider: "openrouter", pick: "best" }
  ]
};

function resolveModel(provider, pick, ids) {
  if (provider === "groq") return ids.includes(pick) ? pick : null;
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

  if (!opts.skipGood) {
    const good = await goodFor(tier);
    if (good) {
      const idx = good.indexOf(":");
      const gp = idx === -1 ? "" : good.slice(0, idx);
      const gm = idx === -1 ? "" : good.slice(idx + 1);
      if (gp && providerPresent(gp)) {
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
    const model = resolveModel(step.provider, step.pick, ids);
    if (model) push(step.provider, model);
  }
  return out;
}

/* how many OpenRouter free names a tier walks, and the memory of a name that
   refused the house outright (403, 404: not a passing fault, a door) */
const OR_DEPTH = 4;
const K_REFUSED = id => "nllm:refused:" + id;
const REFUSED_S = 24 * 3600;
async function refusedSet(ids) {
  const out = new Set();
  if (!kvReady() || !ids.length) return out;
  try {
    const r = await kv(ids.map(id => ["GET", K_REFUSED(id)]));
    ids.forEach((id, i) => { if (r && r[i]) out.add(id); });
  } catch { }
  return out;
}
async function rememberRefused(id, why) {
  if (!kvReady()) return;
  try { await kv([["SET", K_REFUSED(id), String(why || "refused").slice(0, 160)], ["EXPIRE", K_REFUSED(id), String(REFUSED_S)]]); } catch { }
}

/* ---------------------------------------------------------------------------
   7. route(task): task.tier ("fast" | "strong" | "long"), task.messages
      (OpenAI-shaped), task.opts (passed to chatOnce), task.perPerson (true
      when any message carries per-person rather than aggregate data, which
      routes the whole call away from Gemini's free tier -- see §3's header
      comment: Gemini's free terms allow training on submitted content, so
      nothing about an identifiable person goes there).

      Returns { ok:true, content, tool_calls, usage, model, provider, tier,
      tried } on success, or { ok:false, error, tier, tried, blocked? } with
      a message honest enough to put in front of the owner: which names were
      tried, why each one was skipped or failed, and, when every bucket for
      the day is empty, exactly when it resets.
--------------------------------------------------------------------------- */
export async function route(task = {}) {
  const tier = ["fast", "strong", "long"].includes(task.tier) ? task.tier : "fast";
  const messages = Array.isArray(task.messages) ? task.messages : [];
  if (!messages.length) return { ok: false, error: "no messages", tier };

  /* refuse before anything else is attempted: no bucket spent on a message
     that was never going to be sent */
  for (const m of messages) {
    const s = scrub(m && m.content);
    if (!s.ok) return { ok: false, error: s.reason, blocked: true, tier };
  }

  const perPerson = !!task.perPerson || messages.some(m => m && m.perPerson);
  const now = Date.now();
  const candidates = await chainFor(tier);
  if (!candidates.length) {
    return { ok: false, error: "no free model is configured for the \"" + tier + "\" tier (no provider key set, or nothing on its free tier is live today)", tier };
  }

  const tried = [];
  let anyAttempted = false;
  for (const cand of candidates) {
    if (perPerson && cand.provider === "gemini") {
      tried.push({ provider: cand.provider, model: cand.model, err: "skipped: per-person data is never sent to Gemini's free tier" });
      continue;
    }
    const gate = await checkAndReserve(cand.provider, cand.model, now);
    if (!gate.ok) {
      tried.push({ provider: cand.provider, model: cand.model, err: "rate limit reached for today (" + gate.why + ")" });
      continue;
    }
    anyAttempted = true;
    const got = await chatOnce(cand.provider, cand.model, messages, task.opts || {});
    tried.push({ provider: cand.provider, model: cand.model, ms: got.ms, err: got.ok ? "" : got.error });
    if (!got.ok && cand.provider === "openrouter" && (got.status === 403 || got.status === 404)) await rememberRefused(cand.model, got.error);
    const tokens = (got.usage && (got.usage.total_tokens || got.usage.totalTokens)) || 0;
    await recordUsage(cand.provider, now, tokens);
    if (got.ok) {
      await addTokens(cand.provider, cand.model, now, tokens);
      await rememberGood(tier, cand.provider + ":" + cand.model);
      return { ok: true, content: got.content, tool_calls: got.tool_calls, usage: got.usage, model: got.model, provider: got.provider, tier, tried };
    }
    if (got.blocked) return { ok: false, error: got.error, blocked: true, tier, tried };
  }
  if (!anyAttempted) {
    return { ok: false, error: "the free allowance for today is used up; resets at " + resetLabel(now), tier, tried };
  }
  return { ok: false, error: "no free model answered today", tier, tried };
}

export { PROVIDERS, GROQ_ALLOW, GEMINI_ALLOW };
