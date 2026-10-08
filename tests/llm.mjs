/* NOOR · the Lantern's three-provider router.
   ------------------------------------------------------------------
   api/_llm.js adds Groq and Gemini beside OpenRouter, with one hard rule
   above all three: nothing here can ever bill. This file proves it with
   fetch and the store both stubbed, no network and no Redis:

     · a priced model is refused on all three providers
     · tiers try the providers in the order the marching orders name
     · a walk falls back across providers on http error, timeout and an
       empty reply
     · a rate bucket blocks a model and the walk skips to the next one
     · a day's bucket resets once the day string changes
     · the scrubber redacts every secret shape and refuses journal text
     · per-person data is routed away from Gemini
     · a provider with no key is simply absent, not an error
     · every provider exhausted gives one clear, timed message
     · the paid "deep" tier: listed, priced under the ceiling and inside
       the monthly cap or refused; cost recorded; fail closed on a store
       fault; perPerson never paid; the free tiers still refuse any price

   Run:  node tests/llm.mjs
*/
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };

const STORE = new Map();
process.env.KV_REST_API_URL = "https://kv.test";
process.env.KV_REST_API_TOKEN = "t";
process.env.GROQ_API_KEY = "groq-test";
process.env.GEMINI_API_KEY = "gemini-test";
process.env.OPENROUTER_API_KEY = "sk-test";
delete process.env.OPENROUTER_MODEL;
delete process.env.ALLOW_PAID_MODELS;
delete process.env.OPENROUTER_DAILY;

const LAST = {};
const GEMINI_EXTRA = [];
let groqAnswers = null, geminiAnswers = null, orAnswers = null, orModels = null;
let kvFault = false;
const OR_CALLS = [];
const OR_KEY_CALLS = [];
let orKeyAnswer = null;

function orModel(id, price) {
  return { id, context_length: 32000, pricing: price || { prompt: "0", completion: "0", request: "0" },
           architecture: { input_modalities: ["text"], output_modalities: ["text"] } };
}
orModels = [
  orModel("openai/gpt-4o", { prompt: "0.000005", completion: "0.00001" }), /* paid: must never appear */
  orModel("deepseek/deepseek-chat-v3:free"),
  orModel("meta-llama/llama-3.3-70b-instruct:free")
];

globalThis.fetch = async (url, opt) => {
  url = String(url);
  /* the store, spoken over the same REST pipeline as api/_kv.js expects */
  if (url.startsWith("https://kv.test")) {
    if (kvFault) return { ok: false, status: 500, json: async () => ({}), text: async () => "down" };
    const cmds = JSON.parse(opt.body);
    const out = cmds.map(c => {
      const [verb, key, val] = c;
      if (verb === "GET") return { result: STORE.has(key) ? STORE.get(key) : null };
      if (verb === "SET") { STORE.set(key, val); return { result: "OK" }; }
      if (verb === "INCR") { const n = (parseInt(STORE.get(key), 10) || 0) + 1; STORE.set(key, String(n)); return { result: n }; }
      if (verb === "INCRBY") { const n = (parseInt(STORE.get(key), 10) || 0) + parseInt(val, 10); STORE.set(key, String(n)); return { result: n }; }
      if (verb === "HINCRBY") {
        const h = JSON.parse(STORE.get(key) || "{}");
        h[val] = (parseInt(h[val], 10) || 0) + parseInt(c[3], 10);
        STORE.set(key, JSON.stringify(h));
        return { result: h[val] };
      }
      if (verb === "HGETALL") {
        const h = JSON.parse(STORE.get(key) || "{}");
        const flat = []; for (const k of Object.keys(h)) { flat.push(k, String(h[k])); }
        return { result: flat };
      }
      if (verb === "EXPIRE") return { result: 1 };
      return { result: null };
    });
    return { ok: true, status: 200, json: async () => out, text: async () => JSON.stringify(out) };
  }
  /* Groq */
  if (url.includes("api.groq.com") && url.includes("/models")) {
    return { ok: true, status: 200, json: async () => ({ data: [
      { id: "openai/gpt-oss-20b" }, { id: "openai/gpt-oss-120b" }, { id: "llama-3.3-70b-versatile" } /* not on the allow-list */
    ] }) };
  }
  if (url.includes("api.groq.com") && url.includes("/chat/completions")) {
    const body = JSON.parse(opt.body); LAST.groq = body;
    const a = groqAnswers ? groqAnswers(body.model) : { ok: true, text: "lit" };
    if (!a.ok) return { ok: false, status: a.status || 500, json: async () => ({ error: { message: a.why || "error" } }), text: async () => a.why || "" };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: a.text } }], usage: { total_tokens: 12 } }) };
  }
  /* Gemini */
  if (url.includes("generativelanguage.googleapis.com") && url.includes("/models")) {
    return { ok: true, status: 200, json: async () => ({ data: [
      { id: "gemini-3.8-flash" }, { id: "gemini-3.5-flash-lite" }, { id: "gemini-3.1-pro-preview" } /* not on the allow-list: no free tier */
    ].concat(GEMINI_EXTRA) }) };
  }
  if (url.includes("generativelanguage.googleapis.com") && url.includes("/chat/completions")) {
    const body = JSON.parse(opt.body); LAST.gemini = body;
    const a = geminiAnswers ? geminiAnswers(body.model) : { ok: true, text: "lit" };
    if (!a.ok) return { ok: false, status: a.status || 500, json: async () => ({ error: { message: a.why || "error" } }), text: async () => a.why || "" };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: a.text } }], usage: { total_tokens: 8 } }) };
  }
  /* round ten c: the OpenRouter key's own page */
  if (url.includes("openrouter.ai/api/v1/key")) {
    OR_KEY_CALLS.push(url);
    if (!orKeyAnswer) throw new Error("unexpected fetch " + url);
    const a = orKeyAnswer();
    return { ok: a.ok !== false, status: a.status || 200, json: async () => a.body || {} };
  }
  /* OpenRouter */
  if (url.includes("openrouter.ai/api/v1/models")) {
    return { ok: true, status: 200, json: async () => ({ data: orModels }) };
  }
  if (url.includes("openrouter.ai/api/v1/chat/completions")) {
    const body = JSON.parse(opt.body); LAST.or = body; OR_CALLS.push(body.model);
    const a = orAnswers ? orAnswers(body.model) : { ok: true, text: "lit" };
    if (!a.ok) return { ok: false, status: a.status || 500, json: async () => ({ error: { message: a.why || "error" } }), text: async () => a.why || "" };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: a.text } }], usage: a.usage || { total_tokens: 20 } }) };
  }
  throw new Error("unexpected fetch " + url);
};

const L = await import("../api/_llm.js");

console.log("\n=== 1. free-only enforcement, all three ===");
{
  ok((await L.isAllowed("groq", "openai/gpt-oss-20b")) === true, "groq: an allow-listed, live model passes");
  ok((await L.isAllowed("groq", "llama-3.3-70b-versatile")) === false, "groq: a live model with no confirmed free tier is refused");
  ok((await L.isAllowed("gemini", "gemini-3.8-flash")) === true, "gemini: an allow-listed, live model passes");
  ok((await L.isAllowed("gemini", "gemini-3.1-pro-preview")) === false, "gemini: the no-free-tier model is refused");
  ok((await L.isAllowed("openrouter", "deepseek/deepseek-chat-v3:free")) === true, "openrouter: a live zero-priced model passes");
  ok((await L.isAllowed("openrouter", "openai/gpt-4o")) === false, "openrouter: a priced model is refused");

  const r1 = await L.chatOnce("groq", "some-paid-groq-model", [{ role: "user", content: "hi" }]);
  ok(r1.ok === false && r1.blocked === true, "chatOnce refuses a model not on the allow-list before any network call would bill");
}

console.log("\n=== 2. tiering order ===");
{
  const fast = await L.chainFor("fast", { skipGood: true });
  ok(fast[0].provider === "groq" && fast[0].model === "openai/gpt-oss-20b", "fast: groq gpt-oss-20b first (" + fast[0].provider + ")");
  /* round four: the fast tier asks Gemini's flash (in May its free flash-lite had no quota) */
  ok(fast[1].provider === "gemini" && fast[1].model === "gemini-3.8-flash", "fast: gemini's flash second (" + fast[1].model + ")");
  ok(fast[2].provider === "openrouter", "fast: an openrouter free model third");

  const strong = await L.chainFor("strong", { skipGood: true });
  ok(strong[0].provider === "gemini" && strong[0].model === "gemini-3.8-flash", "strong: gemini's newest free flash first");
  ok(strong[1].provider === "groq" && strong[1].model === "openai/gpt-oss-120b", "strong: groq gpt-oss-120b second");
  ok(strong[2].provider === "openrouter", "strong: openrouter's strongest free third");

  const long = await L.chainFor("long", { skipGood: true });
  ok(long[0].provider === "gemini", "long: gemini's flash family first (" + long[0].model + ")");
}

console.log("\n=== 3. fallback across providers ===");
{
  /* groq times out, gemini answers with a rate limit, openrouter answers */
  groqAnswers = () => { throw Object.assign(new Error("timeout"), { name: "AbortError" }); };
  geminiAnswers = () => ({ ok: false, status: 429, why: "rate limited" });
  orAnswers = () => ({ ok: true, text: "lit" });
  const got = await L.route({ tier: "fast", messages: [{ role: "user", content: "hi" }] });
  ok(got.ok === true, "the walk reaches the third provider");
  ok(got.provider === "openrouter", "and reports which one answered (" + got.provider + ")");
  ok(got.tried.length === 3, "and records every attempt (" + got.tried.length + ")");
  ok(/timeout/.test(got.tried[0].err), "groq's timeout is recorded");
  ok(/429/.test(got.tried[1].err), "gemini's 429 is recorded");

  /* an empty reply is also a reason to move on; forget the last-good name
     the previous call just learned so groq is asked first again */
  STORE.delete("nllm:good:fast");
  groqAnswers = () => ({ ok: true, text: "" });
  const got2 = await L.route({ tier: "fast", messages: [{ role: "user", content: "hi" }] });
  ok(got2.ok === true && got2.tried[0].err === "empty", "an empty reply falls through too");
  groqAnswers = null; geminiAnswers = null; orAnswers = null;
}

console.log("\n=== 3b. a remembered name never jumps a higher provider ===");
{
  /* 25 September: every tier opened on an OpenRouter name remembered from
     the days before the Groq and Gemini keys, so neither was ever asked */
  STORE.set("nllm:good:fast", "openrouter:deepseek/deepseek-chat-v3:free");
  STORE.set("nllm:good:strong", "openrouter:deepseek/deepseek-chat-v3:free");
  const fast = await L.chainFor("fast");
  ok(fast[0].provider === "groq", "fast: groq still first despite a remembered openrouter name (" + fast[0].provider + ")");
  const strong = await L.chainFor("strong");
  ok(strong[0].provider === "gemini", "strong: gemini still first (" + strong[0].provider + ")");
  STORE.set("nllm:good:fast", "groq:openai/gpt-oss-20b");
  const fast2 = await L.chainFor("fast");
  ok(fast2[0].provider === "groq" && fast2[0].model === "openai/gpt-oss-20b", "a remembered name inside the leading provider is still honoured");
  const saved = process.env.GROQ_API_KEY; delete process.env.GROQ_API_KEY;
  STORE.set("nllm:good:fast", "openrouter:meta-llama/llama-3.3-70b-instruct:free");
  const fast3 = await L.chainFor("fast");
  ok(fast3[0].provider === "gemini", "with no groq key, gemini leads and the openrouter memory waits (" + fast3[0].provider + ")");
  process.env.GROQ_API_KEY = saved;
  STORE.delete("nllm:good:fast"); STORE.delete("nllm:good:strong");
}

console.log("\n=== 3c. thinking names answer, and their thinking stays out ===");
{
  /* 25 September: Groq's gpt-oss spent a short budget thinking and
     returned nothing; a free OpenRouter name wrote its thinking into the reply */
  await L.chatOnce("groq", "openai/gpt-oss-20b", [{ role: "user", content: "hi" }], { max_tokens: 50 });
  ok(LAST.groq && LAST.groq.reasoning_effort === "low", "groq gpt-oss is asked for low effort (" + (LAST.groq && LAST.groq.reasoning_effort) + ")");
  await L.chatOnce("openrouter", "deepseek/deepseek-chat-v3:free", [{ role: "user", content: "hi" }]);
  ok(LAST.or && LAST.or.reasoning && LAST.or.reasoning.exclude === true, "openrouter is asked to keep thinking out of the reply");
  orAnswers = () => ({ ok: true, text: "<think>The user asks for one word.</think>\nlit" });
  const a = await L.chatOnce("openrouter", "deepseek/deepseek-chat-v3:free", [{ role: "user", content: "hi" }]);
  ok(a.ok && a.content === "lit", "a think block is cut from the reply (" + JSON.stringify(a.content) + ")");
  orAnswers = () => ({ ok: true, text: "The user asks for one word, so\n</think>\nlit" });
  const b = await L.chatOnce("openrouter", "deepseek/deepseek-chat-v3:free", [{ role: "user", content: "hi" }]);
  ok(b.ok && b.content === "lit", "thinking before a lone closing tag is cut too (" + JSON.stringify(b.content) + ")");
  orAnswers = null;
}

console.log("\n=== 3d. a busy Gemini flash hands over to the next flash ===");
{
  /* 25 September: gemini-3.8-flash answered 503 all morning */
  GEMINI_EXTRA.push({ id: "gemini-3.7-flash" });
  await L.freeModels("gemini", true);
  const strong = await L.chainFor("strong", { skipGood: true });
  ok(strong[0].model === "gemini-3.8-flash" && strong[1].model === "gemini-3.7-flash" && strong[2].provider === "groq",
     "strong: newest flash, then the next flash, then groq (" + strong.slice(0, 3).map(c => c.model).join(", ") + ")");
  geminiAnswers = m => m === "gemini-3.8-flash" ? { ok: false, status: 503, why: "busy" } : { ok: true, text: "lit" };
  STORE.delete("nllm:good:strong");
  const got = await L.route({ tier: "strong", messages: [{ role: "user", content: "hi" }] });
  ok(got.ok && got.model === "gemini-3.7-flash", "a 503 on the newest flash is answered by the next (" + got.model + ")");
  geminiAnswers = null; GEMINI_EXTRA.length = 0;
  await L.freeModels("gemini", true);
  STORE.delete("nllm:good:strong");
}

console.log("\n=== 4. buckets block and skip ===");
{
  STORE.clear();
  const now = Date.parse("2026-09-24T12:00:00Z");
  for (let i = 0; i < 25; i++) await L.checkAndReserve("groq", "openai/gpt-oss-20b", now);
  const blocked = await L.checkAndReserve("groq", "openai/gpt-oss-20b", now + 1000);
  ok(blocked.ok === false && blocked.why === "rpm", "the 26th call in the same minute is blocked (" + blocked.why + ")");
  const otherModel = await L.checkAndReserve("groq", "openai/gpt-oss-120b", now + 1000);
  ok(otherModel.ok === true, "a different model on the same provider still has its own bucket");
}

console.log("\n=== 5. day rollover ===");
{
  STORE.clear();
  /* a fresh minute per call, so the per-minute cap is never what blocks
     this: only the day's own 800-request ceiling should */
  const day1 = Date.parse("2026-09-24T00:00:00Z");
  for (let i = 0; i < 800; i++) await L.checkAndReserve("groq", "openai/gpt-oss-20b", day1 + i * 61000);
  const stillDay1 = await L.checkAndReserve("groq", "openai/gpt-oss-20b", day1 + 800 * 61000);
  ok(stillDay1.ok === false && stillDay1.why === "rpd", "the day's bucket is exhausted (" + stillDay1.why + ")");
  const day2 = Date.parse("2026-09-25T00:05:00Z");
  const nextDay = await L.checkAndReserve("groq", "openai/gpt-oss-20b", day2);
  ok(nextDay.ok === true, "a new UTC day starts with a fresh bucket");
}

console.log("\n=== 6. the scrubber ===");
{
  ok(L.scrub("mail me at sam@example.com").text === "mail me at [redacted]", "an email is redacted");
  ok(L.scrub("call 555-867-5309 now").text.includes("[redacted]"), "a phone number is redacted");
  ok(L.scrub("from 192.168.10.4").text === "from [redacted]", "an ip address is redacted");
  ok(L.scrub("Authorization: Bearer sk-abcdefghijklmnop").text.includes("[redacted]"), "a bearer token is redacted");
  ok(L.scrub("key sk-or-v1-abcdefgh12345678").text.includes("[redacted]"), "an openrouter-shaped key is redacted");
  ok(L.scrub("token EAA1234567890abcdef").text.includes("[redacted]"), "a facebook-shaped token is redacted");
  ok(L.scrub("token ya29.abcdefghijklmno-p").text.includes("[redacted]"), "a google oauth token is redacted");
  ok(L.scrub("hex " + "a".repeat(40)).text.includes("[redacted]"), "a long hex string is redacted");
  ok(L.scrub("b64 " + "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU2Nzg5").text.includes("[redacted]"), "a long base64 string is redacted");
  ok(L.scrub("cookie sess=abc123456; theme=dark").text.includes("[redacted]"), "a cookie string is redacted");

  const j1 = L.scrub("entry nj:e12345 says something");
  ok(j1.ok === false, "a journal store-key marker refuses outright");
  const j2 = L.scrub("[[journal]] whatever this says");
  ok(j2.ok === false, "the explicit journal marker refuses outright");
  const j3 = L.scrub("the visitor_id on this row is 9");
  ok(j3.ok === false, "a visitor-identifying marker refuses outright");

  const got = await L.route({ tier: "fast", messages: [{ role: "user", content: "nj:e999 leaked" }] });
  ok(got.ok === false && got.blocked === true, "route() refuses before any candidate is even built");
}

console.log("\n=== 7. per-person data is routed away from Gemini ===");
{
  groqAnswers = () => ({ ok: false, status: 500, why: "down" });
  orAnswers = () => ({ ok: true, text: "lit" });
  const got = await L.route({ tier: "fast", perPerson: true, messages: [{ role: "user", content: "reader 42 said this" }] });
  const geminiTried = got.tried.find(t => t.provider === "gemini");
  ok(!!geminiTried && /never sent to Gemini/.test(geminiTried.err), "gemini is skipped, not asked, for per-person data");
  ok(got.ok === true && got.provider === "openrouter", "the walk still reaches a provider that may see it");
  groqAnswers = null; orAnswers = null;
}

console.log("\n=== 8. no key present means the provider is simply absent ===");
{
  delete process.env.GEMINI_API_KEY;
  ok((await L.freeModels("gemini")).length === 0, "no gemini models are offered with no key");
  const cfg = L.providersConfigured();
  ok(cfg.gemini === "missing" && cfg.groq === "set" && cfg.openrouter === "set", "the console can tell which providers are configured");
  const fast = await L.chainFor("fast", { skipGood: true });
  ok(!fast.some(c => c.provider === "gemini"), "gemini never appears in a chain it has no key for");
  process.env.GEMINI_API_KEY = "gemini-test";
}

console.log("\n=== 9. every provider down gives one clear, timed message ===");
{
  STORE.clear();
  groqAnswers = () => ({ ok: false, status: 500, why: "down" });
  geminiAnswers = () => ({ ok: false, status: 500, why: "down" });
  orAnswers = () => ({ ok: false, status: 500, why: "down" });
  const got = await L.route({ tier: "fast", messages: [{ role: "user", content: "hi" }] });
  ok(got.ok === false, "the route reports failure");
  ok(/all|no free model answered/.test(got.error) || /used up/.test(got.error), "with a message, not a silent empty (" + got.error + ")");
  groqAnswers = null; geminiAnswers = null; orAnswers = null;

  /* now exhaust every bucket instead, which is the honest "used up" case.
     route() itself stamps its own attempt with the real wall clock, which
     the test session's own date makes 2026-09-24 (see the day rollover
     block above), so the day string here must match that, not an arbitrary
     one; a fresh minute per call keeps the per-minute cap out of the way. */
  STORE.clear();
  const day = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  for (let i = 0; i < 800; i++) await L.checkAndReserve("groq", "openai/gpt-oss-20b", day + i * 61000);
  for (let i = 0; i < 150; i++) await L.checkAndReserve("gemini", "gemini-3.8-flash", day + i * 61000);   /* round four: fast asks flash */
  for (let i = 0; i < 40; i++) await L.checkAndReserve("openrouter", "deepseek/deepseek-chat-v3:free", day + i * 61000);
  const usedUp = await L.route({ tier: "fast", messages: [{ role: "user", content: "hi" }] });
  ok(usedUp.ok === false && /used up; resets at/.test(usedUp.error), "buckets exhausted names the reset time (" + usedUp.error + ")");
}

console.log("\n=== 10. the paid deep tier, under the monthly cap ===");
{
  STORE.clear();
  delete process.env.SOUL_MONTHLY_USD;
  delete process.env.SOUL_DEEP_MODELS;
  const month = new Date().toISOString().slice(0, 7);
  const K = "nsoul:spend:" + month;
  orModels.push(
    orModel("anthropic/claude-sonnet-5", { prompt: "0.000003", completion: "0.000015", request: "0" }),
    orModel("openai/gpt-6-luna", { prompt: "0.00001", completion: "0.00003" })      /* over both ceilings */
    /* google/gemini-3.1-pro-preview deliberately not listed today (round four: the real id; 3.8-pro never existed) */
  );
  await L.deepPrices(true);
  const msgs = [{ role: "user", content: "plan today from these totals" }];
  const sonnetSays = usage => m => m === "anthropic/claude-sonnet-5" ? { ok: true, text: "deep plan", usage } : { ok: true, text: "lit" };

  /* a. paid when listed, priced under the ceiling, and inside the cap */
  orAnswers = sonnetSays({ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, cost: 0.00105 });
  const a = await L.route({ tier: "deep", purpose: "weekly-strategy", messages: msgs, opts: { max_tokens: 800 } });
  ok(a.ok && a.paid === true && a.model === "anthropic/claude-sonnet-5" && a.content === "deep plan", "deep: the paid name answers when the budget allows (" + a.model + ", paid " + a.paid + ")");
  ok(a.tier === "deep" && a.costUsd === 0.00105, "deep: the answer carries tier and costUsd (" + a.costUsd + ")");
  ok(LAST.or.usage && LAST.or.usage.include === true, "deep: OpenRouter is asked for usage accounting");
  ok(LAST.or.provider && LAST.or.provider.max_price && LAST.or.provider.max_price.prompt === L.DEEP_MAX_PROMPT_PER_MTOK && LAST.or.provider.data_collection === "deny",
     "deep: OpenRouter is told the price ceiling and that no endpoint may keep the prompt");
  ok(LAST.or.max_tokens === 800, "deep: the max_tokens the estimate used is the one sent");
  ok(JSON.stringify(LAST.or.reasoning) === JSON.stringify({ exclude: true }), "round ten c: a short paid call asks no effort; only the thinking kept out, as before (" + JSON.stringify(LAST.or.reasoning) + ")");
  ok(STORE.get(K) === "1050", "cost recorded from usage.cost, in micro-dollars (" + STORE.get(K) + ")");
  const r1 = await L.spendReport();
  ok(r1.month === month && r1.usd === 0.00105 && r1.calls === 1 && r1.capUsd === 10, "spendReport reads the ledger (" + JSON.stringify(r1) + ")");

  /* round four: a deep call that names no paid use is answered free, and
     says why; nothing paid is asked */
  const OR_BEFORE = OR_CALLS.length;
  const np = await L.route({ tier: "deep", messages: msgs, opts: { max_tokens: 800 } });
  ok(np.ok && np.paid === false && OR_CALLS.length === OR_BEFORE && np.tried.some(t => t.paid && /kept for the Monday strategy/.test(t.err)), "deep with no named use: no paid call, the free names answer (" + np.provider + ")");

  /* b. no usage.cost: computed from tokens at the live price */
  orAnswers = sonnetSays({ prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200 });
  const b = await L.route({ tier: "deep", purpose: "weekly-strategy", messages: msgs });
  ok(b.ok && b.paid && b.costUsd === 0.006, "with no usage.cost, the cost is tokens times live price (" + b.costUsd + ")");
  ok(STORE.get(K) === "7050", "and the ledger adds it (" + STORE.get(K) + ")");

  /* never negative, never NaN: a nonsense cost falls to the tokens */
  orAnswers = sonnetSays({ prompt_tokens: 0, completion_tokens: 0, cost: -5 });
  const b2 = await L.route({ tier: "deep", purpose: "weekly-strategy", messages: msgs });
  ok(b2.ok && b2.costUsd === 0 && STORE.get(K) === "7050", "a negative usage.cost is never recorded (" + b2.costUsd + ", ledger " + STORE.get(K) + ")");
  orAnswers = sonnetSays({ cost: "NaN" });
  const b3 = await L.route({ tier: "deep", purpose: "weekly-strategy", messages: msgs, opts: { max_tokens: 100 } });
  ok(b3.ok && Number.isFinite(b3.costUsd) && b3.costUsd > 0 && /^\d+$/.test(STORE.get(K)), "a NaN cost with no tokens is charged the worst case, never NaN (" + b3.costUsd + ", ledger " + STORE.get(K) + ")");

  /* c. refused when not on the live list (the free strong chain answers) */
  process.env.SOUL_DEEP_MODELS = '["google/gemini-3.1-pro-preview"]';
  OR_CALLS.length = 0;
  const c = await L.route({ tier: "deep", purpose: "weekly-strategy", messages: msgs });
  ok(c.ok && c.paid === false && c.costUsd === 0 && c.provider === "gemini", "a name not on the live list is skipped, free strong answers (" + c.provider + ")");
  ok(c.tried.some(t => t.paid && /not on OpenRouter's live model list/.test(t.err)), "and tried says why");
  ok(!OR_CALLS.length, "and no paid request was sent");
  process.env.SOUL_DEEP_MODELS = "openai/gpt-4o, some/new-model";
  ok(L.deepModels().length === 0, "SOUL_DEEP_MODELS can never add a name the code list lacks");
  process.env.SOUL_DEEP_MODELS = "openai/gpt-6-luna, anthropic/claude-sonnet-5, openai/gpt-4o";
  ok(JSON.stringify(L.deepModels()) === '["openai/gpt-6-luna","anthropic/claude-sonnet-5"]', "it narrows to a subset, in its own order (" + L.deepModels().join(", ") + ")");

  /* d. refused over the price ceiling */
  process.env.SOUL_DEEP_MODELS = "openai/gpt-6-luna";
  OR_CALLS.length = 0;
  const d = await L.route({ tier: "deep", purpose: "weekly-strategy", messages: msgs });
  ok(d.ok && d.paid === false && d.tried.some(t => t.model === "openai/gpt-6-luna" && /prompt price .* over the ceiling/.test(t.err)), "a prompt price over the ceiling is refused");
  orModels.find(m => m.id === "openai/gpt-6-luna").pricing = { prompt: "0.000002", completion: "0.000025" };
  await L.deepPrices(true);
  const d2 = await L.route({ tier: "deep", purpose: "weekly-strategy", messages: msgs });
  ok(d2.paid === false && d2.tried.some(t => t.model === "openai/gpt-6-luna" && /completion price .* over the ceiling/.test(t.err)), "a completion price over the ceiling is refused");
  orModels.find(m => m.id === "openai/gpt-6-luna").pricing = { prompt: "-1", completion: "-1" };
  await L.deepPrices(true);
  const d3 = await L.route({ tier: "deep", purpose: "weekly-strategy", messages: msgs });
  ok(d3.paid === false && d3.tried.some(t => /not a fixed number/.test(t.err)), "a variable (-1) price is refused");
  ok(!OR_CALLS.length, "and no paid request was sent for any of them");
  delete process.env.SOUL_DEEP_MODELS;

  /* e. the worst case would pass the cap: free strong instead */
  STORE.set(K, "9999000");
  OR_CALLS.length = 0;
  const e = await L.route({ tier: "deep", purpose: "weekly-strategy", messages: msgs, opts: { max_tokens: 1000 } });
  ok(e.ok && e.paid === false && e.provider === "gemini", "an estimate past the cap falls back to free strong (" + e.provider + ")");
  ok(e.tried.some(t => /would pass the monthly cap/.test(t.err)), "and tried names the cap (" + (e.tried.find(t => t.paid) || {}).err + ")");
  ok(!OR_CALLS.includes("anthropic/claude-sonnet-5") && STORE.get(K) === "9999000", "no paid request, ledger unchanged");

  /* f. the env may lower the cap, never raise it */
  process.env.SOUL_MONTHLY_USD = "50";
  ok(L.deepCapUsd() === 10 && L.DEEP_CAP_USD_MAX === 10, "SOUL_MONTHLY_USD=50 still caps at 10 (" + L.deepCapUsd() + ")");
  ok((await L.spendReport()).capUsd === 10, "spendReport shows the real cap");
  const f = await L.route({ tier: "deep", purpose: "weekly-strategy", messages: msgs, opts: { max_tokens: 1000 } });
  ok(f.paid === false, "and the near-full month is still refused with the variable at 50");
  process.env.SOUL_MONTHLY_USD = "1";
  STORE.set(K, "999000");
  const f2 = await L.route({ tier: "deep", purpose: "weekly-strategy", messages: msgs, opts: { max_tokens: 1000 } });
  ok(L.deepCapUsd() === 1 && f2.paid === false, "SOUL_MONTHLY_USD=1 lowers the cap and is enforced");
  process.env.SOUL_MONTHLY_USD = "0";
  STORE.set(K, "0");
  const f3 = await L.route({ tier: "deep", purpose: "weekly-strategy", messages: msgs });
  ok(L.deepCapUsd() === 0 && f3.paid === false, "SOUL_MONTHLY_USD=0 turns paid off entirely");
  process.env.SOUL_MONTHLY_USD = "lots";
  ok(L.deepCapUsd() === 10, "a non-number falls back to the code's 10, never more");
  delete process.env.SOUL_MONTHLY_USD;

  /* g. a store fault refuses paid (fail closed) */
  kvFault = true;
  OR_CALLS.length = 0;
  const g = await L.route({ tier: "deep", purpose: "weekly-strategy", messages: msgs });
  ok(g.ok && g.paid === false && g.provider === "gemini", "a store fault refuses paid, free strong answers (" + g.provider + ")");
  ok(g.tried.some(t => /ledger could not be read/.test(t.err)) && !OR_CALLS.length, "and says the ledger was unreadable");
  const gr = await L.spendReport();
  ok(gr.usd === null && /could not be read/.test(gr.error), "spendReport says unknown, never a guessed 0");
  kvFault = false;

  /* h. per-person data never reaches a paid name */
  OR_CALLS.length = 0;
  groqAnswers = () => ({ ok: true, text: "lit" });
  const h = await L.route({ tier: "deep", purpose: "weekly-strategy", perPerson: true, messages: msgs });
  ok(h.ok && h.paid === false && !OR_CALLS.includes("anthropic/claude-sonnet-5"), "perPerson: no paid request (" + h.provider + ")");
  ok(h.tried.some(t => t.paid && /per-person data is never sent to a paid model/.test(t.err)), "perPerson: tried says why");
  ok(h.tried.some(t => t.provider === "gemini" && /never sent to Gemini/.test(t.err)) && h.provider === "groq", "perPerson: and gemini is still skipped on the free fallback");
  groqAnswers = null;

  /* i. the free tiers still refuse any priced name, ALLOW_PAID_MODELS or not */
  process.env.ALLOW_PAID_MODELS = "1";
  ok((await L.isAllowed("openrouter", "anthropic/claude-sonnet-5")) === false, "isAllowed still refuses a deep name");
  const ci = await L.chatOnce("openrouter", "anthropic/claude-sonnet-5", msgs);
  ok(ci.ok === false && ci.blocked === true, "chatOnce still refuses a deep name");
  for (const tier of ["fast", "strong", "long"]) {
    const chain = await L.chainFor(tier, { skipGood: true });
    ok(!chain.some(x => L.DEEP_MODELS.includes(x.model) || x.model === "openai/gpt-4o"), tier + ": no priced name in the chain");
  }
  OR_CALLS.length = 0;
  const si = await L.route({ tier: "strong", messages: msgs });
  ok(si.ok && si.paid === undefined && !OR_CALLS.some(m => L.DEEP_MODELS.includes(m)), "a strong route never pays (" + si.provider + ")");
  delete process.env.ALLOW_PAID_MODELS;

  /* j. a timeout is charged the worst case: it may have been billed */
  STORE.set(K, "0");
  orAnswers = m => { if (m === "anthropic/claude-sonnet-5") throw Object.assign(new Error("timeout"), { name: "AbortError" }); return { ok: true, text: "lit" }; };
  const j = await L.route({ tier: "deep", purpose: "weekly-strategy", messages: msgs, opts: { max_tokens: 100 } });
  ok(j.ok && j.paid === false && j.costUsd > 0 && STORE.get(K) === String(Math.round(j.costUsd * 1e6)), "a paid timeout is charged its worst case and falls back (" + j.costUsd + ")");

  /* k. a 402 means no credit: free for the next hour, without asking again */
  STORE.set(K, "0");
  orAnswers = m => m === "anthropic/claude-sonnet-5" ? { ok: false, status: 402, why: "Insufficient credits" } : { ok: true, text: "lit" };
  const k = await L.route({ tier: "deep", purpose: "weekly-strategy", messages: msgs });
  ok(k.ok && k.paid === false && k.costUsd === 0 && STORE.get(K) === "0", "a 402 is not charged and free strong answers");
  ok(k.tried.some(t => /no credit/.test(t.err)) && !!STORE.get("nsoul:nocredit"), "a 402 is recorded as no credit");
  OR_CALLS.length = 0;
  const k2 = await L.route({ tier: "deep", purpose: "weekly-strategy", messages: msgs });
  ok(k2.ok && k2.paid === false && !OR_CALLS.length && k2.tried.some(t => /no credit/.test(t.err)), "the next deep call does not knock again");
  orAnswers = null;
}

console.log("\n=== 11. round ten c: the free names answer the council again ===");
{
  STORE.clear(); L.forgetOrTier(); OR_KEY_CALLS.length = 0;
  /* a. OpenRouter's free allowance is the account's own */
  orKeyAnswer = () => ({ body: { data: { label: "noor", is_free_tier: false, limit: null, usage: 0.85 } } });
  ok(await L.orDaily() === L.OR_DAILY_PAID && L.OR_DAILY_PAID === 900 && STORE.get(L.K_OR_TIER) === "paid" && OR_KEY_CALLS.length === 1,
    "an account that bought credits: 900 free requests a day, read once and kept (" + STORE.get(L.K_OR_TIER) + ")");
  ok(await L.orDaily() === 900 && OR_KEY_CALLS.length === 1, "asked again within ten minutes: from memory, no second read");
  L.forgetOrTier();
  ok(await L.orDaily() === 900 && OR_KEY_CALLS.length === 1, "a new instance: from the store, no second read");
  STORE.delete(L.K_OR_TIER); L.forgetOrTier();
  orKeyAnswer = () => ({ body: { data: { is_free_tier: true } } });
  ok(await L.orDaily() === L.OR_DAILY_FREE && L.OR_DAILY_FREE === 40 && STORE.get(L.K_OR_TIER) === "free", "an account that never paid: 40, as before");
  STORE.delete(L.K_OR_TIER); L.forgetOrTier();
  orKeyAnswer = () => ({ ok: false, status: 401, body: { error: { message: "no auth" } } });
  ok(await L.orDaily() === 40 && !STORE.has(L.K_OR_TIER), "a read that fails: 40, and nothing kept, so it is read again later");
  process.env.OPENROUTER_DAILY = "7";
  ok(await L.orDaily() === 7, "OPENROUTER_DAILY still decides when set");
  delete process.env.OPENROUTER_DAILY;
  /* the bucket itself follows it */
  const day = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  STORE.clear(); L.forgetOrTier(); STORE.set(L.K_OR_TIER, "paid");
  let last = null;
  for (let i = 0; i < 41; i++) last = await L.checkAndReserve("openrouter", "a:free", day + i * 61000);
  ok(last && last.ok === true, "with a paid account the 41st free request of the day still goes");
  STORE.clear(); L.forgetOrTier(); STORE.set(L.K_OR_TIER, "free");
  for (let i = 0; i < 41; i++) last = await L.checkAndReserve("openrouter", "a:free", day + i * 61000);
  ok(last && last.ok === false && last.why === "rpd", "with a free account the 41st is refused, as before");
  orKeyAnswer = null;

  /* b. a short free answer asks the thinking names to think little */
  STORE.clear(); L.forgetOrTier(); STORE.set(L.K_OR_TIER, "free");
  const msgs = [{ role: "user", content: "judge this" }];
  LAST.gemini = null;
  const g1 = await L.route({ tier: "strong", messages: msgs, opts: { max_tokens: 400 } });
  ok(g1.ok && g1.provider === "gemini" && LAST.gemini && LAST.gemini.reasoning_effort === "low", "a short answer from Gemini: reasoning_effort low (" + (LAST.gemini && LAST.gemini.reasoning_effort) + ")");
  const g2 = await L.route({ tier: "strong", messages: msgs, opts: { max_tokens: 1400 } });
  ok(g2.ok && g2.provider === "gemini" && LAST.gemini.reasoning_effort === undefined, "a long answer from Gemini: its own thinking, as before");
  geminiAnswers = () => ({ ok: false, status: 503, why: "busy" });
  groqAnswers = () => ({ ok: false, status: 500, why: "down" });
  const o1 = await L.route({ tier: "strong", messages: msgs, opts: { max_tokens: 400 } });
  ok(o1.ok && o1.provider === "openrouter" && JSON.stringify(LAST.or.reasoning) === JSON.stringify({ exclude: true, effort: "low" }), "a short free answer from OpenRouter: effort low, the thinking kept out (" + JSON.stringify(LAST.or.reasoning) + ")");
  const o2 = await L.route({ tier: "strong", messages: msgs, opts: { max_tokens: 1400 } });
  ok(o2.ok && JSON.stringify(LAST.or.reasoning) === JSON.stringify({ exclude: true }), "a long one: only the thinking kept out, as before");
  ok(L.SHORT_ANSWER_TOKENS === 800, "short means 800 tokens or fewer");
  /* the free names' health, one line for the log */
  L.forgetScores();
  const mp = await L.modelsPulse();
  const gem = mp.names.find(x => /^gemini\/gemini-3\.8-flash /.test(x)) || "";
  const grq = mp.names.find(x => /^groq\/openai\/gpt-oss-120b /.test(x)) || "";
  /* (this file's store keeps no HSET, so the last error is not shown here; tests/mend.mjs reads the line whole) */
  ok(/^gemini\/gemini-3\.8-flash 2\/4 [\d.]+s$/.test(gem) && /^groq\/openai\/gpt-oss-120b 0\/2$/.test(grq)
    && mp.openrouter === "free account, 40 a day" && new Set(mp.names.map(x => x.split(" ")[0])).size === mp.names.length,
    "each free name once: answered of asked and its time; the OpenRouter account: " + JSON.stringify(mp).slice(0, 300));
  ok(!/judge this|lit/.test(JSON.stringify(mp)), "never a prompt or an answer");

  /* c. the words: a minute's bucket says this minute, and no answer is never "today" */
  ok(L.gateWords("tpm, 7000 tokens a minute") === "rate limit reached for this minute (tpm, 7000 tokens a minute)" && L.gateWords("rpm") === "rate limit reached for this minute (rpm)"
    && L.gateWords("rpd") === "rate limit reached for today (rpd)" && /^rate limit reached for today \(the daily cycle's share/.test(L.gateWords("the daily cycle's share of the day (20 of 40)")),
    "a minute's bucket says this minute; a day's says today");
  orAnswers = () => ({ ok: false, status: 429, why: "Provider returned error" });
  const none = await L.route({ tier: "strong", messages: msgs, opts: { max_tokens: 400 } });
  ok(!none.ok && none.error === "no free model answered", "every name asked and none answered: " + none.error);
  /* every name held by its minute: the next minute frees them */
  const realNow = Date.now;
  const FIX = Math.floor(realNow() / 60000) * 60000 + 5000;
  Date.now = () => FIX;
  try {
    STORE.clear(); L.forgetOrTier(); STORE.set(L.K_OR_TIER, "free");
    for (let i = 0; i < 8; i++) await L.checkAndReserve("gemini", "gemini-3.8-flash", FIX);
    for (let i = 0; i < 25; i++) await L.checkAndReserve("groq", "openai/gpt-oss-120b", FIX);
    for (let i = 0; i < 25; i++) await L.checkAndReserve("groq", "openai/gpt-oss-20b", FIX);
    for (let i = 0; i < 15; i++) await L.checkAndReserve("openrouter", "x:free", FIX);
    const busy = await L.route({ tier: "strong", messages: msgs, opts: { max_tokens: 400 } });
    ok(!busy.ok && busy.error === "every free model is busy this minute; the next minute frees them" && busy.tried.every(t => /for this minute \(rpm\)/.test(t.err)),
      "every name held by its minute: said so, not a day's reset: " + busy.error);
  } finally { Date.now = realNow; }
  geminiAnswers = null; groqAnswers = null; orAnswers = null;

  /* d. Groq's gpt-oss-20b answers a short question when the strong names cannot */
  STORE.clear(); L.forgetOrTier(); STORE.set(L.K_OR_TIER, "free"); L.forgetScores();
  const chain = await L.chainFor("strong", { skipGood: true, unranked: true });
  const tail = chain[chain.length - 1];
  ok(tail.provider === "groq" && tail.model === "openai/gpt-oss-20b" && tail.short === true && chain.filter(c => c.short).length === 1,
    "the strong tier ends with Groq's gpt-oss-20b, kept for short answers: " + chain.map(c => c.provider + ":" + c.model + (c.short ? "(short)" : "")).join(", "));
  geminiAnswers = () => ({ ok: false, status: 503, why: "busy" });
  orAnswers = () => ({ ok: false, status: 429, why: "Provider returned error" });
  groqAnswers = m => (m === "openai/gpt-oss-120b" ? { ok: false, status: 500, why: "down" } : { ok: true, text: '{"vote":"approve","reasons":["ok"]}' });
  const v20 = await L.route({ tier: "strong", messages: msgs, opts: { max_tokens: 400 } });
  ok(v20.ok && v20.provider === "groq" && v20.model === "openai/gpt-oss-20b", "a verdict the strong names could not give: the 20b gives it (" + v20.provider + " " + v20.model + ")");
  ok(STORE.get("nllm:good:strong") !== "groq:openai/gpt-oss-20b", "and it is never remembered as the tier's good name");
  const long20 = await L.route({ tier: "strong", messages: msgs, opts: { max_tokens: 1400 } });
  ok(!long20.ok && !long20.tried.some(t => t.model === "openai/gpt-oss-20b"), "a long answer (a plan) never falls to it: " + long20.error);
  ok((await L.chainFor("fast", { skipGood: true, unranked: true })).every(c => !c.short), "the fast tier asks it as it always did");

  /* e. the next minute: a name held by its minute's bucket is asked again when the caller can wait */
  const realNow2 = Date.now, realSleep = L.WAIT.sleep;
  let clock = Math.floor(realNow2() / 60000) * 60000 + 40000;
  const slept = [];
  Date.now = () => clock;
  L.WAIT.sleep = async ms => { slept.push(ms); clock += ms; };
  try {
    const fill = () => {
      const m = Math.floor(clock / 60000);
      STORE.set("nllm:tpm:groq:openai/gpt-oss-120b:" + m, "7000");
      STORE.set("nllm:tpm:groq:openai/gpt-oss-20b:" + m, "7000");
    };
    STORE.clear(); L.forgetOrTier(); STORE.set(L.K_OR_TIER, "free"); L.forgetScores(); fill();
    groqAnswers = () => ({ ok: true, text: '{"vote":"approve","reasons":["ok"]}' });
    const w = await L.route({ tier: "strong", messages: msgs, opts: { max_tokens: 400, timeout: 25000, waitUntil: clock + 60000 } });
    ok(w.ok && w.waited === true && w.provider === "groq" && w.model === "openai/gpt-oss-120b" && slept.length === 1 && slept[0] === 20000 + L.WAIT.afterMs,
      "held by Groq's minute and nothing else answered: it waits for the next minute (" + slept.join() + " ms) and Groq answers");
    ok(w.tried.some(t => t.waited === true && t.model === "openai/gpt-oss-120b" && t.err === "") && w.tried.some(t => /for this minute \(tpm/.test(t.err)), "both the hold and the try after the wait are in tried");
    slept.length = 0; clock = Math.floor(clock / 60000) * 60000 + 40000; fill();
    const nw = await L.route({ tier: "strong", messages: msgs, opts: { max_tokens: 400, timeout: 25000, waitUntil: clock + 25000 } });
    ok(!nw.ok && slept.length === 0 && nw.error === "no free model answered", "too little time before the caller's own limit: no wait (" + nw.error + ")");
    const nd = await L.route({ tier: "strong", messages: msgs, opts: { max_tokens: 400 } });
    ok(!nd.ok && slept.length === 0, "no limit given: no wait, as before");
    ok(L.WAIT.minCallMs === 6000 && L.WAIT.afterMs === 250, "a call after the wait is worth at least six seconds, a quarter second past the minute");
  } finally { Date.now = realNow2; L.WAIT.sleep = realSleep; }
  geminiAnswers = null; groqAnswers = null; orAnswers = null;
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
