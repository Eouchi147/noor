/* NOOR · the Lantern's chain.
   ------------------------------------------------------------------
   The lantern went dark for one reason: modelChain() is synchronous, it reads
   an in-process cache that is empty on every cold start, and four endpoints
   called it that way. They spent most invocations asking model names that
   OpenRouter had retired, then returned nothing.

   This file holds the rebuilt chain to its promises, with both OpenRouter and
   the store stubbed so it runs with no network and no Redis:

     · a cold start with a store reads the store, never the written fallback
     · a cold start with no store fetches, and writes what it learns
     · only when BOTH are unreachable does the written guess appear
     · the model that answered last time is asked first next time
     · paid models are dropped unless paid is deliberately allowed
     · image and embedding models never enter the chain
     · a walk that fails on every name still reports why, per model

   Run:  node tests/lantern.mjs
*/
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };

/* ---- a store that lives in a Map, spoken to over the REST protocol ---- */
const STORE = new Map();
let orLive = true, orModels = null, orAnswers = null, netCalls = [];

process.env.KV_REST_API_URL = "https://kv.test";
process.env.KV_REST_API_TOKEN = "t";
process.env.OPENROUTER_API_KEY = "sk-test";
delete process.env.OPENROUTER_MODEL;
delete process.env.ALLOW_PAID_MODELS;

function model(id, ctx, price, mod) {
  return { id, context_length: ctx, pricing: price || { prompt: "0", completion: "0", request: "0" },
           architecture: { input_modalities: mod ? [mod] : ["text"], output_modalities: ["text"] } };
}

globalThis.fetch = async (url, opt) => {
  url = String(url);
  netCalls.push(url);
  /* the store */
  if (url.startsWith("https://kv.test")) {
    const cmds = JSON.parse(opt.body);
    const out = cmds.map(c => {
      const [verb, key, val] = c;
      if (verb === "GET") return { result: STORE.has(key) ? STORE.get(key) : null };
      if (verb === "SET") { STORE.set(key, val); return { result: "OK" }; }
      if (verb === "EXPIRE") return { result: 1 };
      return { result: null };
    });
    return { ok: true, status: 200, json: async () => out, text: async () => JSON.stringify(out) };
  }
  /* OpenRouter's model list */
  if (url.includes("/api/v1/models")) {
    if (!orLive) throw new Error("network down");
    return { ok: true, status: 200, json: async () => ({ data: orModels }) };
  }
  /* OpenRouter's completions */
  if (url.includes("/chat/completions")) {
    const body = JSON.parse(opt.body);
    const a = orAnswers ? orAnswers(body.model) : { ok: true, text: "lit" };
    if (!a.ok) return { ok: false, status: a.status || 404,
      json: async () => ({ error: { message: a.why || "No endpoints found" } }),
      text: async () => a.why || "" };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: a.text } }] }) };
  }
  throw new Error("unexpected fetch " + url);
};

orModels = [
  model("openai/gpt-4o", 128000, { prompt: "0.000005", completion: "0.00001" }), /* paid: must never appear */
  model("black-forest/flux:free", 4096, null, "image"),                          /* image: must never appear */
  model("tiny/thing:free", 2048),
  model("deepseek/deepseek-chat-v3:free", 163840),
  model("meta-llama/llama-3.3-70b-instruct:free", 131072),
  model("google/gemma-3-27b-it:free", 96000)
];

const M = await import("../api/_models.js");

console.log("\n=== 1. a cold start with nothing anywhere ===");
{
  const chain = await M.liveChain();
  ok(chain.length > 0, "the chain is never empty (" + chain.length + " names)");
  ok(chain[0] === "deepseek/deepseek-chat-v3:free", "the strongest free model is asked first (" + chain[0] + ")");
  ok(!chain.includes("openai/gpt-4o"), "the paid model never enters the chain");
  ok(!chain.some(c => /flux/.test(c)), "the image model never enters the chain");
  ok(chain.includes("tiny/thing:free"), "a small free model is still kept as a fallback");
  ok(STORE.has("nlm:free"), "what it learned was written to the store");
}

console.log("\n=== 2. the fault that caused the outage ===");
{
  /* a genuinely cold instance: nothing cached in process, network unreachable,
     but the store holds yesterday's list. This is the case that used to hand
     back the written fallback. */
  const before = JSON.parse(STORE.get("nlm:free"));
  orLive = false;
  const fresh = await import("../api/_models.js?cold=2");
  const chain = await fresh.liveChain();
  ok(chain[0] === before.ids[0], "a cold start with the network down still reads the store (" + chain[0] + ")");
  ok(!chain.includes(fresh.FREE_CHAIN[0]) || before.ids.includes(fresh.FREE_CHAIN[0]),
     "and does NOT fall through to the written guess");
  orLive = true;
}

console.log("\n=== 3. only when both layers are gone does the guess appear ===");
{
  STORE.clear();
  orLive = false;
  const fresh = await import("../api/_models.js?cold=3");
  const chain = await fresh.liveChain();
  ok(chain[0] === fresh.FREE_CHAIN[0], "the written list is the third fallback, not the first");
  ok(chain.length === fresh.FREE_CHAIN.length, "and it is the whole of it");
  orLive = true;
}

console.log("\n=== 4. the name that answered is asked first next time ===");
{
  STORE.clear();
  const fresh = await import("../api/_models.js?cold=4");
  /* only the third name in the ranking will answer */
  orAnswers = m => m === "google/gemma-3-27b-it:free"
    ? { ok: true, text: "lit" } : { ok: false, status: 404, why: "No endpoints found" };
  const got = await fresh.askOpenRouter([{ role: "user", content: "hi" }], { timeout: 200, budget: 4000 });
  ok(got.text === "lit", "it walks past the dead names and finds the live one");
  ok(got.model === "google/gemma-3-27b-it:free", "and reports which one answered");
  ok(got.tried.length === 3, "and records every name it tried (" + got.tried.length + ")");
  ok(got.tried[0].status === 404, "with the status each one gave");
  ok(STORE.get("nlm:good") === "google/gemma-3-27b-it:free", "the winner is remembered in the store");

  const next = await import("../api/_models.js?cold=4b");
  const chain = await next.liveChain();
  ok(chain[0] === "google/gemma-3-27b-it:free",
     "a later cold start asks the known-good name first (" + chain[0] + ")");
  orAnswers = null;
}

console.log("\n=== 5. money cannot leak ===");
{
  process.env.OPENROUTER_MODEL = "openai/gpt-4o";
  const fresh = await import("../api/_models.js?cold=5");
  const chain = await fresh.liveChain();
  ok(!chain.includes("openai/gpt-4o"), "a paid name in the environment is dropped");
  ok(/not a free model/.test(fresh.modelWarning()), "and the console is told why");
  process.env.ALLOW_PAID_MODELS = "1";
  const paid = await import("../api/_models.js?cold=5b");
  const pchain = await paid.liveChain();
  ok(pchain[0] === "openai/gpt-4o", "and it is honoured only when paid is deliberately allowed");
  delete process.env.ALLOW_PAID_MODELS;
  delete process.env.OPENROUTER_MODEL;
}

console.log("\n=== 6. a total failure still explains itself ===");
{
  STORE.clear();
  const fresh = await import("../api/_models.js?cold=6");
  orAnswers = () => ({ ok: false, status: 404, why: "No endpoints found matching your data policy" });
  const p = await fresh.probeLantern();
  ok(p.ok === false, "the probe reports failure honestly");
  ok(p.verdict === "policy", "it names the actual cause (" + p.verdict + ")");
  ok(/privacy/.test(p.advice), "and gives the one action that fixes it");
  ok(p.tried.length >= 3, "with every attempt listed");
  orAnswers = null;
}

console.log("\n=== 7. no key at all ===");
{
  delete process.env.OPENROUTER_API_KEY;
  const fresh = await import("../api/_models.js?cold=7");
  const got = await fresh.askOpenRouter([{ role: "user", content: "hi" }]);
  ok(got.error === "no key", "it says so immediately rather than timing out");
  const p = await fresh.probeLantern();
  ok(p.ok === false && /not set/.test(p.error), "and the probe says which variable is missing");
  process.env.OPENROUTER_API_KEY = "sk-test";
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
