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
    const body = JSON.parse(opt.body);
    const a = geminiAnswers ? geminiAnswers(body.model) : { ok: true, text: "lit" };
    if (!a.ok) return { ok: false, status: a.status || 500, json: async () => ({ error: { message: a.why || "error" } }), text: async () => a.why || "" };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: a.text } }], usage: { total_tokens: 8 } }) };
  }
  /* OpenRouter */
  if (url.includes("openrouter.ai/api/v1/models")) {
    return { ok: true, status: 200, json: async () => ({ data: orModels }) };
  }
  if (url.includes("openrouter.ai/api/v1/chat/completions")) {
    const body = JSON.parse(opt.body); LAST.or = body;
    const a = orAnswers ? orAnswers(body.model) : { ok: true, text: "lit" };
    if (!a.ok) return { ok: false, status: a.status || 500, json: async () => ({ error: { message: a.why || "error" } }), text: async () => a.why || "" };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: a.text } }], usage: { total_tokens: 20 } }) };
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
  ok(fast[1].provider === "gemini" && fast[1].model === "gemini-3.5-flash-lite", "fast: gemini flash-lite second (" + fast[1].model + ")");
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
  for (let i = 0; i < 150; i++) await L.checkAndReserve("gemini", "gemini-3.5-flash-lite", day + i * 61000);
  for (let i = 0; i < 40; i++) await L.checkAndReserve("openrouter", "deepseek/deepseek-chat-v3:free", day + i * 61000);
  const usedUp = await L.route({ tier: "fast", messages: [{ role: "user", content: "hi" }] });
  ok(usedUp.ok === false && /used up; resets at/.test(usedUp.error), "buckets exhausted names the reset time (" + usedUp.error + ")");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
