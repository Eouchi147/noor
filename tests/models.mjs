/* NOOR · round four: the Lantern's brains and its voice.
   ---------------------------------------------------------------------------
   7 October 2026. The owner: "I want the best free models to be used by the
   lantern and I want to take advantage of JEV ... Also I need the lantern to
   communicate with me on telegram for important or urgent things. And it can
   use paid models if needed but it needs to be efficient with extreme ROI
   ... and use them scarcely." This file holds all of it, with the store, the
   gateway, Groq, OpenRouter, Jev and Telegram stood in (nothing real is ever
   reached, nothing is ever sent):

     1. the AI Gateway's free models, found live by their zero price and
        cached; every gateway call, chat and Jev alike, carrying zero data
        retention and no training; a model no such provider serves set aside
        a day; the gateway in the mail tier; the OIDC token as its credential;
     2. the scoreboard: measured quality orders each tier, the lead
        provider's order breaking ties, a failing model falling behind, a
        check failed counting against it, the ranking said in plain words;
     3. Jev on the Decision API: the mail kind as a choice, the seven letter
        questions, the place score, the brief and the ideas, each falling
        back to "unavailable" when the judge is down, and every call counted;
     4. paid models scarce: no named use, no paid call; the five uses; the
        day's 0.50 dollars; a call's 0.10 ceiling with the Monday strategy
        above it; the ROI ledger and its outcomes; the soul's own uses (the
        daily strategist free, Monday's paid, an extra run free);
     5. the council's tie break: asked only when the free Guardian alone
        stands against an act the Skeptic approved, paid or not at all;
     6. the voice: urgent at once and once, the rest in the 22:00 digest,
        letters waiting at most once in six hours, the cap of six with a slot
        kept for the urgent, nothing personal in any message, the link card;
     7. the Home: spend.roi, the brief's one sentence on paid models, Ask's
        "think deeply";
     8. round five (the models review), each finding's own repro turned into
        a check: the paid caps held before the call under parallel asks and a
        store that refuses writes, the paid door closed for the day for every
        caller, paidReserve and paidSettle (D1); zero retention endpoints for
        the paid mail path and Ask (D4); a lead demoted by one bad hour that
        leads again, the hour's one look (D7); a Telegram outage that spends
        nothing, paced retries (D2); a carried Monday that no longer swallows
        Tuesday's needs (D9); NVIDIA's catalog, held back by its terms, and
        when allowed found live, for totals only, ranked with the others.

   Run:  node tests/models.mjs
*/
import fs from 'node:fs';
import {
  S, L, H, NET, FAULT, onNet, resp, resetStore, SOUL, COUNCIL, MIND, ROUTER, JEV, JEV_URL, jevOn, jevOff, setDay, today, addDays, CLOCK, NOTIFY, DEPS, snapFor, putSnap
} from './_soul-harness.mjs';

const LLM = await import('../api/_llm.js');
const JEVM = await import('../api/_jev.js');
const J = await import('../api/_judge.js');
const V = await import('../api/_voice.js');
const DEC = await import('../api/_decisions.js');
const HOME = await import('../api/_home.js');
const T = await import('../api/_telegram.js');
const LA = await import('../api/lantern-agent.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const D0 = '2026-10-07';   /* a Wednesday */
const MONDAY = '2026-10-12';
const realDay = () => new Date().toISOString().slice(0, 10);
const realMonth = () => new Date().toISOString().slice(0, 7);
const EMAIL_RX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
const KEYS = ['GROQ_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'CEREBRAS_API_KEY', 'AI_GATEWAY_API_KEY', 'VERCEL_OIDC_TOKEN', 'SOUL_DEEP_MODELS', 'SOUL_MONTHLY_USD', 'TG_BOT_TOKEN', 'NVIDIA_API_KEY', 'NVIDIA_PRODUCTION_OK'];
const clean = () => { for (const k of KEYS) delete process.env[k]; LLM.forgetScores(); LLM.forgetExplore(); LLM.forgetPaidDay(); JEVM.useRequest(null); };
const msgs = [{ role: 'user', content: 'Plan today from these totals: 19000 people reached.' }];
const week = () => Math.floor(Math.floor(Date.now() / 86400000) / 7);
const seedScore = (provider, model, h) => { H.set(LLM.K_SCORE(provider, model, week()), new Map(Object.entries(h).map(([k, v]) => [k, String(v)]))); LLM.forgetScores(); };

/* the gateway's own public list, in the shape its docs give */
const GW_LIST = [
  { id: 'inclusionai/ling-3.1-flash-free', object: 'model', type: 'language', zdr: 'some', no_training: 'some', pricing: { input: '0', output: '0' } },
  { id: 'poolside/laguna-s-2.1-free', object: 'model', type: 'language', zdr: 'all', no_training: 'all', pricing: { input: '0', output: '0', input_cache_read: '0' } },
  /* round six: free, but its list entry says none of its providers keeps nothing */
  { id: 'convaiinnovations/laya', object: 'model', type: 'language', zdr: 'none', no_training: 'none', pricing: { input: '0', output: '0' } },
  { id: 'example/learns', object: 'model', type: 'language', zdr: 'some', no_training: 'none', pricing: { input: '0', output: '0' } },
  { id: 'convaiinnovations/laya-free', object: 'model', type: 'decision', pricing: { input: '0', output: '0' } },
  { id: 'inclusionai/ling-3.1-flash', object: 'model', type: 'language', pricing: { input: '0.0000003', output: '0.0000012' } },
  { id: 'example/tiered', object: 'model', type: 'language', pricing: { input: '0', output: '0', input_tiers: [{ cost: '0.000002', min: 200000 }] } },
  { id: 'anthropic/claude-sonnet-5', object: 'model', type: 'language', pricing: { input: '0.000002', output: '0.00001' } }
];
const GW = { models: 0, chats: [], refuse: new Set(), refuseNested: new Set(), down: false };
onNet(LLM.GATEWAY_MODELS_URL, async () => { GW.models++; if (GW.down) throw new Error('ECONNREFUSED'); return resp(200, { object: 'list', data: GW_LIST }); });
onNet('https://ai-gateway.vercel.sh/v1/chat/completions', async (u, init) => {
  const b = JSON.parse(init.body);
  GW.chats.push({ b, auth: init.headers.Authorization });
  if (GW.refuse.has(b.model)) return resp(400, { error: 'No providers available that disallow prompt training for model: ' + b.model + '. Providers considered: novita', type: 'no_providers_available', statusCode: 400 });
  /* round six: the OpenAI shaped error, its type general and its code the gateway's */
  if (GW.refuseNested.has(b.model)) return resp(400, { error: { message: 'No ZDR (Zero Data Retention) providers available for model: ' + b.model + '. Providers considered: poolside', type: 'invalid_request_error', code: 'no_providers_available' } });
  return resp(200, { model: b.model, choices: [{ message: { content: 'lit' } }], usage: { total_tokens: 9 } });
});
/* Groq and OpenRouter */
const GQ = { calls: [], fail: false };
onNet('https://api.groq.com/openai/v1/models', async () => resp(200, { data: [{ id: 'openai/gpt-oss-120b' }, { id: 'openai/gpt-oss-20b' }] }));
onNet('https://api.groq.com/openai/v1/chat/completions', async (u, init) => { const b = JSON.parse(init.body); GQ.calls.push(b); return GQ.fail ? resp(500, { error: { message: 'busy' } }) : resp(200, { choices: [{ message: { content: 'lit' } }], usage: { total_tokens: 30 } }); });
const PRICE = { prompt: '0.000002', completion: '0.00001' };
const OR = { calls: [], answer: null };
onNet('https://openrouter.ai/api/v1/models', async () => resp(200, { data: [
  { id: 'anthropic/claude-sonnet-5', pricing: PRICE, supported_parameters: ['response_format'], context_length: 1000000, architecture: { input_modalities: ['text'], output_modalities: ['text'] } },
  { id: 'openai/gpt-6-luna', pricing: { prompt: '0.0000001', completion: '0.0000005' }, context_length: 400000, architecture: { input_modalities: ['text'], output_modalities: ['text'] } },
  { id: 'google/gemini-3.1-pro-preview', pricing: { prompt: '0.000002', completion: '0.000012' }, context_length: 1000000, architecture: { input_modalities: ['text'], output_modalities: ['text'] } }] }));
onNet('https://openrouter.ai/api/v1/chat/completions', async (u, init) => {
  const b = JSON.parse(init.body); OR.calls.push(b);
  if (typeof OR.answer === 'function') return OR.answer(b);
  return resp(200, { choices: [{ message: { content: '{"intents":[]}' } }], usage: { prompt_tokens: 400, completion_tokens: 100, cost: 0.0018 } });
});

/* ===========================================================================
   1. THE AI GATEWAY: free by its own zero price, private on every call
=========================================================================== */
console.log('\n1. the AI Gateway\'s free models, found live, every call asked to keep nothing');
{
  resetStore(); clean();
  process.env.AI_GATEWAY_API_KEY = 'gw-test-key';
  GW.models = 0; GW.chats.length = 0; GW.refuse = new Set(['inclusionai/ling-3.1-flash-free']); GW.down = false;
  ok(LLM.providersConfigured().gateway === 'set' && LLM.providersConfigured().cerebras === 'missing', 'the gateway is a provider when its credential is there; Cerebras only with its own key');
  const ids = await LLM.freeModels('gateway', true);
  ok(ids.join() === 'inclusionai/ling-3.1-flash-free,poolside/laguna-s-2.1-free', 'free means a language model whose every price reads zero and which has no tier: ' + ids.join(', '));
  ok(!ids.includes('convaiinnovations/laya-free') && !ids.includes('inclusionai/ling-3.1-flash') && !ids.includes('example/tiered'), 'never a decision model as a writer, a priced twin, or a price that turns on past a tier');
  ok(!ids.includes('convaiinnovations/laya') && !ids.includes('example/learns') && LLM.gatewayWithout() === 2,
    'round six: never a free name whose list entry says none of its providers keeps nothing, or none learns nothing; the two are counted');
  ok(JSON.parse(S.get('nllm:live:gateway')).v === 2 && JSON.parse(S.get('nllm:live:gateway')).without === 2, 'the copy kept in the store is of the new shape, with what it set aside');
  ok(S.has('nllm:live:gateway') && JSON.parse(S.get('nllm:live:gateway')).ids.length === 2, 'the list is kept in the store, the same shape as the others');
  await LLM.freeModels('gateway', false); await LLM.freeModels('gateway', false);
  ok(GW.models === 1, 'and read again only after six hours (one fetch for three asks)');
  ok(await LLM.isAllowed('gateway', 'poolside/laguna-s-2.1-free') && !(await LLM.isAllowed('gateway', 'inclusionai/ling-3.1-flash')) && !(await LLM.isAllowed('gateway', 'anthropic/claude-sonnet-5')),
    'the one gate every call passes: a priced gateway model is refused before a byte is sent');
  const chain = await LLM.chainFor('fast', { skipGood: true });
  ok(chain.length === 2 && chain.every(c => c.provider === 'gateway'), 'with only the gateway present, the fast tier is its two free names');
  const r = await LLM.route({ tier: 'fast', messages: [{ role: 'user', content: 'Reply with one word: lit' }] });
  ok(r.ok && r.provider === 'gateway' && r.model === 'poolside/laguna-s-2.1-free' && r.tried[0].model === 'inclusionai/ling-3.1-flash-free' && /No providers available/.test(r.tried[0].err),
    'a name no provider that keeps nothing will serve is refused by the gateway itself (400 no_providers_available), and the next free name answers');
  ok(GW.chats.length === 2 && GW.chats.every(c => c.b.providerOptions && c.b.providerOptions.gateway && c.b.providerOptions.gateway.zeroDataRetention === true && c.b.providerOptions.gateway.disallowPromptTraining === true),
    'every gateway call carries providerOptions.gateway {zeroDataRetention: true, disallowPromptTraining: true}');
  ok(GW.chats.every(c => c.auth === 'Bearer gw-test-key' && !c.b.reasoning && !c.b.response_format), 'through the deployment\'s own credential, with nothing the gateway\'s docs do not name');
  ok(S.has('nllm:refused:gateway:inclusionai/ling-3.1-flash-free'), 'the refused name waits a day');
  const chain2 = await LLM.chainFor('fast', { skipGood: true });
  ok(chain2.length === 1 && chain2[0].model === 'poolside/laguna-s-2.1-free', 'and is not asked again meanwhile');
  const sc = (await LLM.scoresFor([{ provider: 'gateway', model: 'inclusionai/ling-3.1-flash-free' }, { provider: 'gateway', model: 'poolside/laguna-s-2.1-free' }]));
  const a = sc.get('gateway:inclusionai/ling-3.1-flash-free'), b = sc.get('gateway:poolside/laguna-s-2.1-free');
  ok(a && a.n === 1 && a.fail === 1 && /No providers available/.test(a.err) && a.errAt && b && b.n === 1 && b.ok === 1 && b.ms >= 0,
    'the scoreboard took both calls in the same pipeline as the usage: one failed with its error and time, one answered');
  /* the mail tier may use a gateway name, since every call keeps nothing */
  GW.chats.length = 0;
  const m = await LLM.route({ tier: 'mail', messages: [{ role: 'system', content: 'ROLE: mail-reader' }, { role: 'user', content: 'EMAIL: thank you' }], json: true, caller: 'soul' });
  ok(m.ok && m.tier === 'mail' && m.provider === 'gateway' && m.paid === false && GW.chats.length === 1 && GW.chats[0].b.providerOptions.gateway.zeroDataRetention === true,
    'the mail tier asks a gateway name after Groq (none here), under the same two promises: ' + m.model);
  ok(m.tried.some(t => t.provider === 'groq' && /no GROQ_API_KEY/.test(t.err)) && m.tried.some(t => t.model === 'inclusionai/ling-3.1-flash-free' && /refused in the last day/.test(t.err)), 'and says why the others were passed over');
  /* the OIDC token, from the request's own header, when no key is set */
  delete process.env.AI_GATEWAY_API_KEY;
  ok(LLM.providersConfigured().gateway === 'missing', 'no key and no token: no gateway');
  SOUL.setRequest({ headers: { 'x-vercel-oidc-token': 'oidc-from-the-request' } });
  GW.chats.length = 0;
  const o = await LLM.route({ tier: 'fast', messages: [{ role: 'user', content: 'Reply with one word: lit' }] });
  ok(LLM.providersConfigured().gateway === 'set' && o.ok && GW.chats[0].auth === 'Bearer oidc-from-the-request', 'the deployment\'s OIDC token, handed down from the door\'s request, is the credential: no key to create or leak');
  SOUL.setRequest(null);
  /* the list unreadable: the copy held stands, and no written list is ever guessed */
  process.env.AI_GATEWAY_API_KEY = 'gw-test-key';
  GW.down = true;
  const kept = await LLM.freeModels('gateway', true);
  ok(kept.join() === 'inclusionai/ling-3.1-flash-free,poolside/laguna-s-2.1-free', 'a list that cannot be read keeps the last one read (a day at most), and there is no written list to fall back on');
  ok(!/GATEWAY_FREE_FALLBACK|laguna|ling-3/.test(fs.readFileSync(new URL('../api/_llm.js', import.meta.url), 'utf8').split('1b. THE AI GATEWAY')[1].split('export async function freeModels')[0].replace(/\/\*[\s\S]*?\*\//g, '')),
    'no gateway model id is written into the router\'s code: free is what the live list says today');
  GW.down = false;
  /* round six: a copy kept before the list said who keeps nothing is read again, never trusted */
  LLM.forgetLive('gateway');
  S.set('nllm:live:gateway', JSON.stringify({ at: Date.now(), ids: ['convaiinnovations/laya'] }));
  const n0 = GW.models;
  const fresh6 = await LLM.freeModels('gateway', false);
  ok(GW.models === n0 + 1 && !fresh6.includes('convaiinnovations/laya'), 'a copy of the old shape is not trusted: the list is read again');
  /* round six: a refusal in the OpenAI shape (type general, code the gateway's) waits a day too */
  GW.refuseNested = new Set(['poolside/laguna-s-2.1-free']); GW.refuse = new Set();
  for (const k of [...S.keys()]) if (k.startsWith('nllm:refused:gateway:')) S.delete(k);
  LLM.forgetScores();
  const rn = await LLM.route({ tier: 'fast', messages: [{ role: 'user', content: 'Reply with one word: lit' }] });
  ok(S.has('nllm:refused:gateway:poolside/laguna-s-2.1-free') && rn.tried.some(t => t.model === 'poolside/laguna-s-2.1-free' && /No ZDR/.test(t.err)), 'a refusal as code no_providers_available, or in its words, waits a day as well');
  GW.refuseNested = new Set();
  const rk6 = await LLM.rankingReport();
  ok(rk6.gateway && rk6.gateway.without === 2, 'the engine room is told how many free names cannot keep the promises: ' + JSON.stringify(rk6.gateway));
  clean();
}

/* ===========================================================================
   2. THE SCOREBOARD: measured quality first, the tier's own order between equals
=========================================================================== */
console.log('\n2. the scoreboard orders each tier');
{
  resetStore(); clean();
  process.env.GROQ_API_KEY = 'gsk_test'; process.env.AI_GATEWAY_API_KEY = 'gw-test-key';
  GW.refuse = new Set();
  await LLM.freeModels('groq', true); await LLM.freeModels('gateway', true);
  const order = async tier => (await LLM.chainFor(tier, { skipGood: true })).map(c => c.provider + ':' + c.model);
  const s0 = await order('strong');
  ok(s0.join() === 'groq:openai/gpt-oss-120b,gateway:inclusionai/ling-3.1-flash-free,gateway:poolside/laguna-s-2.1-free', 'nothing measured yet: the tier\'s own order, its lead provider first: ' + s0.join(', '));
  /* round five (the review, D7): an unmeasured name is no longer under a
     healthy measured one; the two stand level and the tier's order decides */
  seedScore('gateway', 'poolside/laguna-s-2.1-free', { n: 20, ok: 20, ms: 16000, gn: 10, gp: 10 });
  const s1 = await order('strong');
  ok(s1.join() === s0.join(), 'a name that answered 20 of 20 and passed 10 of 10 checks stands level with the unmeasured: the tier\'s own order decides: ' + s1.join(', '));
  seedScore('groq', 'openai/gpt-oss-120b', { n: 20, ok: 20, ms: 9000, gn: 10, gp: 10 });
  const s2 = await order('strong');
  ok(s2[0] === 'groq:openai/gpt-oss-120b' && s2[2] === 'gateway:poolside/laguna-s-2.1-free', 'two of equal quality: the lead provider\'s order breaks the tie');
  seedScore('groq', 'openai/gpt-oss-120b', { n: 12, ok: 3, fail: 9, err: 'http 503: over capacity', errAt: '2026-10-07T04:00:00.000Z' });
  const s3 = await order('strong');
  ok(s3[s3.length - 1] === 'groq:openai/gpt-oss-120b', 'a name that failed 9 of 12 falls behind the unmeasured and the healthy: ' + s3.join(', '));
  ok(LLM.qualityOf({ n: 3, ok: 0 }) === LLM.qualityOf({}) && LLM.qualityOf({}) === 1, 'fewer than five calls move nothing: an unmeasured count is 1, neither lifting nor lowering (' + LLM.qualityOf({}) + ')');
  ok(LLM.qualityOf({ n: 20, ok: 20, gn: 10, gp: 10 }) > 0.9 && LLM.qualityOf({ n: 20, ok: 20, gn: 10, gp: 10 }) < 1, 'and a measured healthy name is just under it, so tenths stop at 9 to keep them level');
  /* a check failed counts against the one who wrote */
  seedScore('groq', 'openai/gpt-oss-120b', { n: 20, ok: 20 });
  for (let i = 0; i < 6; i++) await LLM.noteGuard({ provider: 'groq', model: 'openai/gpt-oss-120b', measured: { provider: 'groq', model: 'openai/gpt-oss-120b' } }, false);
  const g = (await LLM.scoresFor([{ provider: 'groq', model: 'openai/gpt-oss-120b' }])).get('groq:openai/gpt-oss-120b');
  ok(g.gn === 6 && g.gp === 0 && LLM.qualityOf(g) < 0.5, 'six answers that failed their checks pull a name down though it always answered (' + LLM.qualityOf(g) + ')');
  /* the answer names whom it measured, for noteGuard */
  LLM.forgetScores(); H.clear();
  const r = await LLM.route({ tier: 'strong', messages: [{ role: 'user', content: 'Reply with one word: lit' }] });
  ok(r.ok && r.measured && r.measured.provider === 'groq' && r.measured.model === 'openai/gpt-oss-120b', 'every answer names the scoreboard\'s own provider and model');
  /* the ranking, in plain words (round five: the healthy one leads once the
     others have shown worse) */
  seedScore('gateway', 'poolside/laguna-s-2.1-free', { n: 20, ok: 20, ms: 16000, gn: 10, gp: 10 });
  seedScore('groq', 'openai/gpt-oss-120b', { n: 12, ok: 3, fail: 9, err: 'http 503: over capacity', errAt: '2026-10-07T04:00:00.000Z' });
  seedScore('gateway', 'inclusionai/ling-3.1-flash-free', { n: 10, ok: 2, fail: 8 });
  const rk = await LLM.rankingReport();
  const strongWords = rk.words.find(w => /^Writing and judging/.test(w)) || '';
  ok(/first the AI Gateway's laguna-s-2\.1-free \(answered 20 of 20, passed 10 of 10 checks, 0\.8 seconds\)/.test(strongWords), 'the engine room reads it in words: ' + strongWords);
  ok(rk.tiers.strong[0].model === 'poolside/laguna-s-2.1-free' && rk.tiers.strong[0].calls === 20 && rk.tiers.mail.length >= 1 && rk.gateway && rk.gateway.free.length === 2,
    'and in fields: each tier\'s order with calls, answers, checks, latency and the last error; the mail tier; the gateway\'s free list');
  ok(rk.words.every(w => !DASHES.test(w)), 'and in the house\'s punctuation');
  clean();
}

/* ===========================================================================
   3. JEV ON THE DECISION API: a judgement where a judgement is enough
=========================================================================== */
console.log('\n3. Jev: the mail kind, the letter, the place, the brief, the ideas; down changes nothing');
{
  resetStore(); clean();
  const last = () => JEV.bodies[JEV.bodies.length - 1];
  jevOn(() => 0.03, { choose: () => ({ choice: 'spam', probabilities: { spam: 0.93, newsletter: 0.04, question: 0.03 } }), rate: () => 3 });
  const mk = await J.mailKind({ subject: 'You have won', text: 'Claim your prize at [an email address].' });
  const b = last();
  ok(mk.ok && mk.kind === 'spam' && mk.sure && mk.p === 0.93, 'a choice among the house\'s kinds, taken when Jev is sure: ' + mk.kind + ' at ' + mk.p);
  ok(b.model === 'typesafe-ai/jev' && b.questions.kind.type === 'choice' && Object.keys(b.questions.kind.criteria).length === 17 && b.questions.kind.criteria.distress,
    'asked as the docs give a choice: criteria a record of the 17 kinds, each with its words');
  ok(b.providerOptions && b.providerOptions.gateway && b.providerOptions.gateway.zeroDataRetention === true && b.providerOptions.gateway.disallowPromptTraining === true,
    'and asked to keep nothing and learn nothing');
  ok(NET.calls.some(c => c.url === JEV_URL && c.url === 'https://ai-gateway.vercel.sh/v1/evaluate'), 'on the Decision API, POST /v1/evaluate');
  JEV.choose = () => ({ choice: 'question', probabilities: { question: 0.62, thanks: 0.38 } });
  const unsure = await J.mailKind({ subject: 'Hello', text: 'Thank you, and one question.' });
  ok(unsure.ok && !unsure.sure, 'under 0.7 it is not sure, so a writing model reads it (' + unsure.p + ')');
  JEV.choose = () => ({ choice: 'personal', probabilities: { personal: 0.74, distress: 0.24 } });
  const risk = await J.mailKind({ subject: 'Hard days', text: 'I do not know who else to tell.' });
  ok(risk.ok && !risk.sure && risk.distressP === 0.24, 'any real chance of someone at risk is never left to the choice: the writing model reads it');
  JEV.choose = () => null;
  ok((await J.mailKind({ subject: 'x', text: 'y' })).unavailable, 'a choice with no answer is an incomplete verdict, unavailable');

  /* the letter questions (round five: eight) */
  JEV.score = k => (k === 'promises_money' ? 0.81 : 0.04);
  const lr = await J.letterRisk({ subject: 'A gift for your school', text: 'We will donate to your school if you share our posts.' });
  ok(lr.held && lr.reasons.length === 1 && /promises money/.test(lr.reasons[0]) && !lr.slop, 'a letter that promises money is held, and no rewrite mends that: ' + lr.reasons.join('; '));
  ok(Object.keys(last().questions).join() === 'promises_money,pressure_to_give,religious_ruling,claims_person,shares_details,asks_improper,off_topic,ai_voice' && Object.values(last().questions).every(q => q.type === 'boolean'),
    'the eight yes or no questions: money promised, pressure to give, a ruling, claiming to be a person, someone\'s details, anything improper, off topic, and (round five) reading as written by an AI');
  JEV.score = k => (k === 'off_topic' ? 0.5 : 0.1);
  ok((await J.letterRisk({ subject: 's', text: 't' })).held, 'the line is at one half');
  JEV.score = () => 0.49;
  ok(!(await J.letterRisk({ subject: 's', text: 't' })).held, 'under it, nothing is held');
  JEV.mode = 'down';
  const down = await J.letterRisk({ subject: 's', text: 't' });
  ok(!down.held && down.unavailable, 'Jev down: nothing is held that would otherwise go');
  JEV.mode = 'on';

  /* the place score, the brief, the ideas */
  JEV.rate = () => 3;
  const fit = await J.jevScorePlace([{ text: 'Our weekend school teaches Quran classes for young people.' }, 'Arabic classes for adults meet in the evenings.'], { name: 'Al Noor', kind: 'mosque' });
  ok(fit.ok && fit.rung === 3 && fit.score === 0.75 && fit.label === 'a good fit' && last().questions.fit.type === 'score' && last().questions.fit.criteria.length === 5,
    'a place\'s fit, a score on five rungs from its own facts: ' + fit.label + ' (' + fit.score + ')');
  ok(last().state.facts.length === 2 && !EMAIL_RX.test(JSON.stringify(last().state)), 'from its facts alone, never an address');
  JEV.score = k => (k === 'thinks_aloud' ? 0.86 : 0.02);
  const sb = await J.screenBrief('We need to write three sentences about the morning, so here is the paragraph.');
  ok(sb.risky && sb.reasons.includes('thinks aloud about its task') && Object.keys(last().questions).length === 7, 'the brief: the five religious questions and two of its own, in one call: ' + sb.reasons.join(', '));
  JEV.score = (k, body) => (k === 'breaks_rules' && /advertis/i.test(body.state.idea) ? 0.9 : 0.05);
  const si = await J.screenIdeas([{ title: 'Advertisements on the pages', why: 'They pay the hosting.' }, { title: 'A Friday verse series', why: 'Verse reels reach most.', steps: ['Lean Fridays toward verses'] }]);
  ok(si.kept.length === 1 && si.kept[0].title === 'A Friday verse series' && si.dropped.length === 1 && /break the house's rules/.test(si.dropped[0].reasons[0]), 'an idea that would break the house\'s rules is dropped, with why');
  JEV.mode = 'down';
  const sd = await J.screenIdeas([{ title: 'Advertisements on the pages', why: 'x' }]);
  ok(sd.kept.length === 1 && sd.unavailable === 1, 'and with Jev down every idea is kept, as before');
  JEV.mode = 'on';

  /* every call counted by the day, for the evidence */
  const c = await JEVM.jevCounts(realDay());
  ok(c.calls === 13 && c.failed === 2 && c.ok === 11 && c.by['mail-kind'] === 4 && c.by.letter === 4 && c.by.place === 1 && c.by.brief === 1 && c.by.idea === 3 && c.costUsd > 0,
    'every call is counted by the day: ' + c.calls + ' calls, ' + c.failed + ' failed, by use ' + JSON.stringify(c.by) + ', ' + c.costUsd + ' dollars reported by the gateway');
  /* a high-value place: a foundation, or a network of schools */
  ok(J.isHighValuePlace({ kind: 'foundation', name: 'The Learning Foundation' }) && J.isHighValuePlace({ kind: 'school', name: 'Crescent Schools Trust', facts: [] })
    && !J.isHighValuePlace({ kind: 'school', name: 'Al Noor Primary' }) && !J.isHighValuePlace({ kind: 'mosque', name: 'Network Road Mosque' }),
    'a place of high value is a foundation, or a school that names itself a network, a trust or a group of schools');
  jevOff();
}

/* ===========================================================================
   4. PAID MODELS, SCARCE: five named uses, two caps, one ceiling, one ledger
=========================================================================== */
console.log('\n4. paid models: named uses only, the day\'s 0.50, a call\'s 0.10, the ROI ledger');
{
  resetStore(); clean();
  process.env.OPENROUTER_API_KEY = 'or-test'; process.env.GROQ_API_KEY = 'gsk_test';
  /* one paid name, so each cap is met by the price it was written for */
  process.env.SOUL_DEEP_MODELS = 'anthropic/claude-sonnet-5';
  await LLM.deepPrices(true); await LLM.freeModels('groq', true);
  OR.calls.length = 0; OR.answer = null; GQ.fail = false;
  const deep = (purpose, more) => LLM.route({ tier: 'deep', purpose, messages: msgs, opts: { max_tokens: 800 }, ...(more || {}) });
  const none = await deep(undefined);
  ok(none.ok && none.paid === false && OR.calls.filter(b => LLM.DEEP_MODELS.includes(b.model)).length === 0 && none.tried.some(t => t.paid && /kept for the Monday strategy/.test(t.err)),
    'a deep call that names no use is answered free, and says why (' + none.provider + ')');
  const other = await deep('daily-strategy');
  ok(other.paid === false && !OR.calls.some(b => LLM.DEEP_MODELS.includes(b.model)), 'nor does a use that is not one of the five');
  const uses = {};
  for (const p of ['weekly-strategy', 'weekly-reflection', 'tie-break', 'ask-deep']) { const r = await deep(p); uses[p] = r; }
  ok(Object.values(uses).every(r => r.ok && r.paid && r.provider === 'openrouter' && /^pd-\d{4}-\d{2}-[0-9a-f]+$/.test(r.paidId)), 'each of the named uses may pay, and each paid answer carries its ledger line');
  const mailPaid = await LLM.route({ tier: 'mail', purpose: 'letter-retry', messages: msgs, json: true, caller: 'soul' });
  ok(mailPaid.ok && mailPaid.paid === false && mailPaid.provider === 'groq', 'a letter retry still asks the free names first: Groq answered, nothing paid');
  GQ.fail = true;
  const mailPaid2 = await LLM.route({ tier: 'mail', purpose: 'letter-retry', messages: msgs, json: true, caller: 'soul' });
  ok(mailPaid2.ok && mailPaid2.paid === true && OR.calls[OR.calls.length - 1].provider.data_collection === 'deny', 'and only when they fail, one paid name that keeps nothing');
  GQ.fail = false;
  const lines = await LLM.paidLedger(realMonth());
  ok(lines.length === 5 && lines.every(l => l.id && l.at && l.task && l.model === 'anthropic/claude-sonnet-5' && l.costUsd === 0.0018 && l.outcome === null),
    'the ROI ledger nsoul:paid:<YYYY-MM>: one line a paid call, {at, task, model, costUsd, outcome}, the outcome waiting');
  ok(lines.map(l => l.task).sort().join() === 'ask-deep,letter-retry,tie-break,weekly-reflection,weekly-strategy', 'each under the use it was paid for');
  const o = await LLM.paidOutcome(uses['tie-break'].paidId, { helped: true, note: 'the act went ahead' });
  ok(o.ok && o.line.outcome.helped === true && o.line.outcome.note === 'the act went ahead' && o.line.outcome.at, 'the outcome is filled in later, from what the call led to');
  await LLM.paidOutcome(uses['ask-deep'].paidId, { helped: false, note: 'not used' });
  const roi = await LLM.roiSummary(realMonth());
  ok(roi.calls === 5 && roi.usd === 0.01 && roi.helped === 1 && roi.waiting === 3 && roi.uses['tie-break'] === 1, 'what the month bought, in totals: ' + JSON.stringify({ calls: roi.calls, usd: roi.usd, helped: roi.helped, waiting: roi.waiting }));
  ok(/^Paid models this month: 0\.01 dollars, 5 uses: /.test(roi.line) && /the Monday strategy/.test(roi.line) && /a tie break/.test(roi.line) && /a think deeply in Ask/.test(roi.line) && /\.$/.test(roi.line) && !DASHES.test(roi.line),
    'and in one plain sentence: ' + roi.line);
  ok(LLM.roiLine(3, 1.2, { 'weekly-strategy': 1, 'tie-break': 2 }) === 'Paid models this month: 1.20 dollars, 3 uses: the Monday strategy and tie break 2 times.', 'the sentence the brief carries: ' + LLM.roiLine(3, 1.2, { 'weekly-strategy': 1, 'tie-break': 2 }));
  /* one call's ceiling, the Monday strategy above it */
  OR.calls.length = 0;
  const big = { max_tokens: 12000 };
  const tooBig = await LLM.route({ tier: 'deep', purpose: 'tie-break', messages: msgs, opts: big });
  ok(tooBig.paid === false && !OR.calls.some(b => LLM.DEEP_MODELS.includes(b.model)) && tooBig.tried.some(t => /over the 0\.1000 USD a single call may cost/.test(t.err)),
    'a call whose worst case passes 0.10 dollars is refused before it is sent: ' + (tooBig.tried.find(t => t.paid && /single call/.test(t.err)) || {}).err);
  const monday = await LLM.route({ tier: 'deep', purpose: 'weekly-strategy', messages: msgs, opts: big });
  ok(monday.paid === true, 'the Monday strategy alone may think past it');
  /* the day's cap, inside the month's */
  const dk = LLM.K_SPEND_DAY(realDay());
  S.set(dk, String(495000));
  OR.calls.length = 0;
  const day = await deep('weekly-reflection');
  ok(day.paid === false && !OR.calls.some(b => LLM.DEEP_MODELS.includes(b.model)) && day.tried.some(t => /would pass the day's cap/.test(t.err)), 'with 0.495 of the day\'s 0.50 spent, a call that could pass it is refused');
  const sr = await LLM.spendReport();
  ok(sr.dayUsd === 0.495 && sr.dayCapUsd === 0.5 && sr.callMaxUsd === 0.1 && sr.capUsd === 10, 'the spend report says the day, its cap and a call\'s ceiling beside the month');
  S.set(dk, '0');
  /* the month's cap still holds */
  S.set('nsoul:spend:' + realMonth(), String(9999000));
  const month = await deep('weekly-strategy');
  ok(month.paid === false && month.tried.some(t => /monthly cap/.test(t.err)), 'and the month\'s 10 dollars above all');
  S.set('nsoul:spend:' + realMonth(), '0');
  /* paid or nothing: no free walk after a refusal */
  GQ.calls.length = 0;
  const only = await LLM.route({ tier: 'deep', purpose: 'tie-break', paidOnly: true, messages: msgs, opts: big });
  ok(!only.ok && only.paid === false && GQ.calls.length === 0 && /no paid model answered/.test(only.error), 'a tie break that may not pay asks no free model either: ' + only.error.slice(0, 90));
  /* a failed paid call is its own outcome at once */
  OR.answer = b => { throw Object.assign(new Error('timeout'), { name: 'AbortError' }); };
  const t = await deep('weekly-strategy');
  OR.answer = null;
  const failed = (await LLM.paidLedger(realMonth())).find(l => l.outcome && /the call failed/.test(l.outcome.note));
  ok(t.paid === false && failed && failed.outcome.helped === false && failed.costUsd > 0, 'a paid call that timed out is charged its worst case and its line says it failed');
  clean();
}

/* ===========================================================================
   5. THE SOUL'S OWN PAID USES, AND THE COUNCIL'S TIE BREAK
=========================================================================== */
console.log('\n5. the daily plan free, Monday\'s paid, the tie break only when the free Guardian alone says no');
const roleOf = t => (/ROLE: (\w+)/.exec(String(t.messages[0] && t.messages[0].content)) || [])[1];
{
  resetStore(); clean(); NOTIFY.length = 0; ROUTER.calls.length = 0; ROUTER.plan = '{"intents":[]}'; ROUTER.guardian = 'approve'; ROUTER.skeptic = 'approve';
  ROUTER.reflect = '{"lessons":[],"retire":[],"goals":[],"upgrades":[],"ideas":[]}';
  const SR = SOUL.seams.route; const tasks = [];
  SOUL.setSeams({ route: async task => { tasks.push(task); return SR(task); } });
  const exp = d => S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: addDays(d, -2), args: {} }, history: [] }));
  setDay(D0, '05:20'); exp(D0);
  await MIND.tick({});
  let st = tasks.filter(t => roleOf(t) === 'strategist');
  ok(st.length === 1 && st[0].tier === 'strong' && !st[0].purpose, 'a daily morning plans on the best free model: one strong call, no paid use named');
  resetStore(); tasks.length = 0; setDay(MONDAY, '05:20'); exp(MONDAY);
  await MIND.tick({});
  st = tasks.filter(t => roleOf(t) === 'strategist');
  const rf = tasks.filter(t => roleOf(t) === 'reflector');
  ok(st[0] && st[0].tier === 'deep' && st[0].purpose === 'weekly-strategy' && !('purpose' in (st[0].opts || {})), 'the scheduled Monday cycle may pay for its strategy, the use named to the router and never to the model');
  ok(rf[0] && rf[0].tier === 'deep' && rf[0].purpose === 'weekly-reflection', 'and for its weekly reflection');
  tasks.length = 0;
  setDay(MONDAY, '11:00');
  await MIND.tick({ force: true });
  st = tasks.filter(t => roleOf(t) === 'strategist');
  ok(st.length >= 1 && st.every(t => t.tier === 'strong' && !t.purpose) && tasks.filter(t => roleOf(t) === 'reflector').every(t => t.tier === 'strong'), 'an extra run on a Monday pays for nothing');
  tasks.length = 0;
  await COUNCIL.guardian({ action: 'note', args: { text: 'x' }, why: 'a note' }, {});
  ok(tasks.length === 1 && tasks[0].tier === 'strong', 'the Guardian judges on the free strong tier');
  SOUL.setSeams({ route: SR });

  /* the tie break */
  const swap = { action: 'lineup-swap', args: { date: addDays(D0, 1), slot: 'reelB', id: 'verse-kursi' }, why: 'Verse reels reached 1204 people over 12 posts, against 640 for word reels.', expectedEffect: 'more reach', metric: 'northStar', evidence: { n: 12 } };
  const evidence = { byKind: [{ kind: 'verse reels', posts: 12, reach: 1204 }, { kind: 'word reels', posts: 9, reach: 640 }] };
  const T2 = { tasks: [], paid: 'approve', available: true };
  SOUL.setSeams({ route: async task => {
    T2.tasks.push(task);
    if (task.tier === 'deep') {
      if (!T2.available) return { ok: false, error: 'no paid model answered', tier: 'deep', paid: false, costUsd: 0 };
      const id = await LLM.paidRecord({ task: task.purpose, model: 'anthropic/claude-sonnet-5', costUsd: 0.004 });
      return { ok: true, content: JSON.stringify({ vote: T2.paid, reasons: ['the paid Guardian'] }), tier: 'deep', paid: true, purpose: task.purpose, paidId: id, costUsd: 0.004, spendRecorded: true, model: 'anthropic/claude-sonnet-5' };
    }
    return SR(task);
  } });
  jevOff(); resetStore(); setDay(D0, '09:00');
  ROUTER.guardian = 'reject'; ROUTER.skeptic = 'approve';
  let c = await COUNCIL.convene(swap, evidence);
  const gs = T2.tasks.filter(t => roleOf(t) === 'guardian');
  ok(c.approved && c.tieBreak && c.tieBreak.paid && c.tieBreak.changed && c.verdicts.guardian.tieBreak && c.verdicts.guardian.free.vote === 'reject',
    'the free Guardian alone said no to an act the Skeptic and the Auditor approved: one paid Guardian decided, and its yes stands');
  ok(gs.length === 2 && gs[0].tier === 'strong' && gs[1].tier === 'deep' && gs[1].purpose === 'tie-break' && gs[1].paidOnly === true, 'asked as a tie break, paid or nothing');
  let line = (await LLM.paidLedger(realMonth())).find(l => l.task === 'tie-break');
  ok(line && line.outcome && line.outcome.helped === true && /lifted/.test(line.outcome.note), 'and its line in the ledger says what it changed: ' + (line && line.outcome && line.outcome.note));
  resetStore(); T2.tasks.length = 0; T2.paid = 'reject';
  c = await COUNCIL.convene(swap, evidence);
  line = (await LLM.paidLedger(realMonth())).find(l => l.task === 'tie-break');
  ok(!c.approved && c.tieBreak.paid && !c.tieBreak.changed && line.outcome.helped === false, 'the paid Guardian agreeing keeps the act refused, and the ledger says it changed nothing');
  T2.tasks.length = 0; ROUTER.guardian = 'approve';
  c = await COUNCIL.convene(swap, evidence);
  ok(c.approved && !c.tieBreak && !T2.tasks.some(t => t.tier === 'deep'), 'no disagreement: nothing paid');
  T2.tasks.length = 0; ROUTER.guardian = 'reject'; ROUTER.skeptic = 'reject';
  c = await COUNCIL.convene(swap, evidence);
  ok(!c.approved && !c.tieBreak && !T2.tasks.some(t => t.tier === 'deep'), 'the Guardian and the Skeptic both saying no: nothing paid');
  T2.tasks.length = 0; ROUTER.skeptic = 'approve';
  c = await COUNCIL.convene({ ...swap, why: 'Verse reels reached 9917 people over 12 posts, against 640 for word reels.' }, evidence);
  ok(!c.approved && !c.tieBreak && c.verdicts.auditor.vote === 'reject' && !T2.tasks.some(t => t.tier === 'deep'), 'a veto the Auditor shares (a number the evidence does not hold): two free judges against one, nothing paid');
  T2.tasks.length = 0;
  c = await COUNCIL.convene({ ...swap, action: 'delete-post', args: { id: 'old' } }, evidence);
  ok(!c.approved && !c.tieBreak && c.verdicts.guardian.tier === 'code', 'a red line refused in code is never put to a paid model');
  T2.tasks.length = 0; T2.available = false;
  c = await COUNCIL.convene(swap, evidence);
  ok(!c.approved && c.tieBreak && c.tieBreak.paid === false && T2.tasks.filter(t => roleOf(t) === 'guardian').length === 2, 'no paid name may answer: the free verdicts stand, and no second free Guardian is asked');
  SOUL.setSeams({ route: SR }); ROUTER.guardian = 'approve'; ROUTER.skeptic = 'approve'; T2.available = true;
}

/* ===========================================================================
   6. THE VOICE: urgent at once and once, the rest at 22:00, nothing personal
=========================================================================== */
console.log('\n6. Telegram: what is urgent now, everything else in the evening digest');
{
  resetStore(); clean(); NOTIFY.length = 0; setDay(D0, '09:00');
  const r1 = await V.urgent('complaint');
  ok(r1.sent && NOTIFY.length === 1 && NOTIFY[0] === 'NOOR Lantern: a complaint came to the mailbox. Open Home.', 'a complaint is said at once, in the house\'s fixed words: ' + NOTIFY[0]);
  const r2 = await V.urgent('complaint');
  ok(r2.deduped && NOTIFY.length === 1, 'and once a day: the second waits for the evening, counted');
  await V.urgent('distress', { ref: 't-1' }); await V.urgent('distress', { ref: 't-2' }); await V.urgent('distress', { ref: 't-1' });
  ok(NOTIFY.length === 3 && NOTIFY.slice(1).every(n => /may be at risk/.test(n)), 'someone at risk: told for each conversation, never twice for the same one');
  await V.mailHanded('legal', 't-3'); await V.mailHanded('personal', 't-4');
  ok(NOTIFY.length === 3, 'a legal matter and a personal message wait for the evening');
  await V.mailHanded('press', 't-5'); await V.mailHanded('money', 't-6'); await V.mailHanded('partnership', 't-7');
  ok(NOTIFY.length === 6 && /the press wrote/.test(NOTIFY[3]) && /about money/.test(NOTIFY[4]) && /work together, or to meet/.test(NOTIFY[5]), 'the press, money and a place that wants to work together are urgent');
  await V.urgent('posting', { detail: 'nothing went out on 2026-10-06' });
  const pd = NOTIFY[6] || '';
  ok(pd === 'NOOR Lantern: posting is down (nothing went out on 2026-10-06). Open Home.', 'posting down, with the house\'s own numbers: ' + pd);
  S.delete(V.VK.said('posting', D0));
  await V.urgent('posting', { detail: 'nothing went out; write to sam@example.com or call +44 113 496 0000' });
  const pd2 = NOTIFY[7] || '';
  ok(pd2 === 'NOOR Lantern: posting is down. Open Home.', 'and a detail that carries anything shaped like an address or a phone is dropped whole: ' + pd2);
  NOTIFY.splice(7, 1);
  await V.urgent('mailbox');
  ok(/could not log in/.test(NOTIFY[7] || ''), 'the mailbox unable to log in');
  setDay(D0, '21:50');
  let d = await V.voiceTick();
  ok(!d.digest && NOTIFY.length === 8, 'before 22:00 UTC the evening waits');
  setDay(D0, '22:05');
  d = await V.voiceTick();
  const dg = NOTIFY[8] || '';
  ok(d.digest && d.digest.sent && NOTIFY.length === 9, 'the first tick after 22:00 sends the one evening message');
  ok(/^NOOR Lantern, the evening of 2026-10-07\./.test(dg) && /a legal matter and a personal message/.test(dg) && /1 more of a complaint/.test(dg) && /Open Home\.$/.test(dg),
    'everything else, by kind alone, and "Open Home": ' + dg);
  await V.voiceTick();
  ok(NOTIFY.length === 9, 'once an evening');
  await V.digestAdd({ kind: 'mail', what: 'legal' });
  ok(L.get(V.VK.digest(addDays(D0, 1))) && L.get(V.VK.digest(addDays(D0, 1))).length === 1, 'what comes after the evening\'s message waits for tomorrow\'s');
  ok(NOTIFY.every(n => !EMAIL_RX.test(n) && !DASHES.test(n) && n.length <= 700), 'no message carries an address, a dash, or more than a few lines');

  /* letters waiting for his Send: at most once in six hours */
  resetStore(); NOTIFY.length = 0; setDay(D0, '10:00');
  const letter = (id, to, name) => DEC.upsert({ kind: 'approve', key: 'mail:' + id, stamp: '1', sticky: true, source: 'mail', title: 'Send this letter to ' + name + '?',
    options: [DEC.opt.yes({ type: 'done' }, 'Send')], letter: { to, toName: name, subject: 'Free material for your weekend school', text: 'Assalamu alaykum,\n\nWe would be glad to help.', kind: 'outreach' } });
  await letter('m1', 'contact@alnoor.example.org', 'Al Noor Islamic Centre'); await letter('m2', 'office@arrahman.example.org', 'Masjid Ar-Rahman');
  const l1 = await V.voiceTick();
  ok(l1.letters && l1.letters.sent && NOTIFY[0] === 'NOOR Lantern: 2 letters wait for your Send. Open Home.', 'letters waiting: how many, and nothing of whom: ' + NOTIFY[0]);
  setDay(D0, '13:00'); await V.voiceTick();
  ok(NOTIFY.filter(n => /wait for your Send/.test(n)).length === 1, 'not again inside six hours');
  S.delete(V.VK.said('letters', 'window'));   /* the six hours pass */
  setDay(D0, '16:30'); await V.voiceTick();
  ok(NOTIFY.filter(n => /wait for your Send/.test(n)).length === 2, 'and again once they have passed');
  /* the link card, while Telegram is not linked */
  const card = (await DEC.readOpen()).find(x => x.key === 'tg-link');
  ok(card && card.options.length === 1 && card.options[0].do.type === 'open' && /so the Lantern can reach you when something is urgent/i.test(card.why) && /urgent/.test(card.title),
    'the Home carries the link card until he links, and says why: ' + (card && card.why.slice(0, 60)));
  ok(!(await DEC.readOpen()).find(x => x.key === 'tg-link').options.some(o => o.do.type === 'snooze' || o.do.type === 'done'), 'with no Done and no Later to put it away');

  /* the cap of six, a slot kept for what is urgent, through the real line */
  const notifySaved = SOUL.seams.notify;
  SOUL.setSeams({ notify: null });
  resetStore(); NOTIFY.length = 0;
  const RD = realDay();
  setDay(RD, '09:00');
  process.env.TG_BOT_TOKEN = '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
  S.set(T.K_TG_OWNER, JSON.stringify({ chat: 4242, name: 'Sam', since: RD + 'T08:00:00.000Z' }));
  const TG = { sent: [] };
  onNet('https://api.telegram.org/bot', async (u, init) => { TG.sent.push(JSON.parse(init.body)); return resp(200, { ok: true, result: { message_id: TG.sent.length } }); });
  for (const k of ['complaint', 'press', 'money', 'partner', 'security']) await V.urgent(k);
  await V.mailHanded('legal', 't-9');
  setDay(RD, '22:05');
  const cd = await V.eveningDigest();
  ok(TG.sent.length === 5 && cd.carried && !cd.sent && S.has(V.VK.carry), 'five urgent messages sent: the digest would take the sixth, the last, so it waits for tomorrow evening');
  setDay(RD, '23:10');
  const late = await V.urgent('mailbox');
  ok(late.sent && TG.sent.length === 6, 'and the slot it left was there for something urgent after 22:00');
  const over = await V.urgent('budget', { detail: '8.4 of 10 dollars this month' });
  ok(!over.sent && over.queued && TG.sent.length === 6, 'a seventh is not sent (the cap of six holds) and waits for the next evening instead');
  const NEXT = addDays(RD, 1);
  S.delete(T.K_TG_SENT(RD));   /* the line counts by the real day: the day turns */
  setDay(NEXT, '22:05');
  const nd = await V.eveningDigest();
  const last = TG.sent[TG.sent.length - 1] || {};
  ok(nd.sent && TG.sent.length === 7 && /a legal matter/.test(last.text) && /the paid budget is near its cap/.test(last.text) && !S.has(V.VK.carry), 'the next evening carries the day before: ' + String(last.text).slice(0, 160));
  ok(TG.sent.every(b => b.chat_id === 4242 && !b.parse_mode && !EMAIL_RX.test(b.text) && !/Sam/.test(b.text)), 'every message to his private chat, plain text, with no address and no name in it');
  SOUL.setSeams({ notify: notifySaved });
  delete process.env.TG_BOT_TOKEN;

  /* paused: the voice is silent, and an evening in the pause is carried */
  resetStore(); NOTIFY.length = 0; setDay(D0, '10:00');
  await letter('m3', 'contact@alnoor.example.org', 'Al Noor Islamic Centre');
  await V.digestAdd({ kind: 'mail', what: 'legal' });
  await SOUL.setPaused(true, 'owner');
  setDay(D0, '22:05');
  const pz = await V.voiceTick();
  ok(pz.ran === false && NOTIFY.length === 0 && !S.has(V.VK.digestSent(D0)) && S.has(V.VK.carry), 'paused: no letters reminder and no evening message, and the evening\'s words are carried');
  await SOUL.setPaused(false, 'owner');
  setDay(addDays(D0, 1), '22:05'); S.delete(V.VK.said('letters', 'window'));
  await V.voiceTick();
  ok(NOTIFY.some(n => /since the last evening's message: a legal matter/.test(n)) && !S.has(V.VK.carry), 'and the first evening after the pause says them: ' + NOTIFY.filter(n => /evening/.test(n)).join(' | ').slice(0, 120));

  /* a passing fault on an urgent message (round five, D2: paced): it waits
     in the retry list, is tried again at most once in thirty minutes, and
     the evening names it only if it never went */
  resetStore(); NOTIFY.length = 0; setDay(D0, '09:00');
  SOUL.setSeams({ notify: async () => ({ ok: false, reason: 'Telegram asked for a pause: Too Many Requests' }) });
  const uf = await V.urgent('press');
  ok(!uf.sent && uf.queued && /^retry/.test(S.get(V.VK.said('press', D0)) || '') && (L.get(V.VK.retry) || []).length === 1, 'Telegram busy: the press waits in the retry list, its mark held thirty minutes so nothing is asked every tick');
  const uf1 = await V.urgent('press');
  ok(uf1.deduped && (L.get(V.VK.retry) || []).length === 1, 'a second word from the press inside the thirty minutes is the same news, not a second try');
  const rt0 = await V.retryTick();
  ok(rt0.tried === 1 && rt0.sent === 0 && (L.get(V.VK.retry) || []).length === 1, 'tried again once, still busy: it keeps waiting');
  const rt1 = await V.retryTick();
  ok(rt1.paced && rt1.tried === 0, 'and not again before the thirty minutes are out');
  S.delete(V.VK.retryPace);   /* the thirty minutes pass */
  setDay(D0, '22:05');
  await V.eveningDigest();
  ok(/Not sent at the time, Telegram did not answer: the press wrote to the house\./.test(String(NOTIFY[NOTIFY.length - 1] || '')) === false && NOTIFY.length === 0, 'Telegram still busy at the evening: nothing went');
  SOUL.setSeams({ notify: notifySaved });
  S.delete(V.VK.digestSent(D0));   /* the evening's own thirty minutes pass */
  await V.eveningDigest();
  ok(/Not sent at the time, Telegram did not answer: the press wrote to the house\./.test(NOTIFY[NOTIFY.length - 1] || '') && !(L.get(V.VK.retry) || []).length, 'and once it answers, the evening says what did not get through, and the list is done with: ' + String(NOTIFY[NOTIFY.length - 1]).slice(0, 140));
  resetStore(); NOTIFY.length = 0; setDay(D0, '09:00');
  SOUL.setSeams({ notify: async () => ({ ok: false, reason: 'Telegram did not answer: socket hang up' }) });
  await V.urgent('distress', { ref: 't-9' });
  SOUL.setSeams({ notify: notifySaved });
  const rt2 = await V.retryTick();
  ok(rt2.sent === 1 && /may be at risk/.test(NOTIFY[0] || '') && !(L.get(V.VK.retry) || []).length && !/^retry/.test(S.get(V.VK.said('distress', [...S.keys()].find(k => k.startsWith('nsoul:voice:said:distress:')).split(':').pop())) || ''),
    'someone at risk is tried again when Telegram answers, not left for the evening: ' + (NOTIFY[0] || ''));

  /* a passing fault on the evening's message: carried, not lost */
  resetStore(); NOTIFY.length = 0; setDay(D0, '12:00');
  await V.digestAdd({ kind: 'mail', what: 'personal' });
  SOUL.setSeams({ notify: async () => ({ ok: false, reason: 'Telegram asked for a pause: Too Many Requests' }) });
  setDay(D0, '22:05');
  const pf = await V.eveningDigest();
  ok(!pf.sent && pf.carried && pf.retry && S.has(V.VK.carry) && /^retry/.test(S.get(V.VK.digestSent(D0)) || ''), 'Telegram busy at 22:00: the evening\'s words are carried, and tried again thirty minutes on (round five)');
  SOUL.setSeams({ notify: notifySaved });
  await V.digestAdd({ kind: 'mail', what: 'legal' });
  ok((L.get(V.VK.digest(D0)) || []).length === 1, 'what comes while the evening waits to be tried again joins this evening, not tomorrow\'s');
  S.delete(V.VK.digestSent(D0));   /* the thirty minutes pass */
  setDay(D0, '22:40');
  const pf2 = await V.voiceTick();
  ok(pf2.digest && pf2.digest.sent && /a personal message/.test(NOTIFY[NOTIFY.length - 1] || '') && /a legal matter/.test(NOTIFY[NOTIFY.length - 1] || '') && !S.has(V.VK.carry), 'and the same evening the message goes, whole: ' + String(NOTIFY[NOTIFY.length - 1]).slice(0, 120));
  SOUL.setSeams({ notify: async () => ({ ok: false, reason: 'not linked' }) });
  await V.digestAdd({ kind: 'mail', what: 'legal' });
  setDay(addDays(D0, 2), '22:05');
  const nl = await V.eveningDigest();
  ok(!nl.sent && !nl.carried && !S.has(V.VK.carry), 'not linked: nothing piles up for a line that is not there (Home keeps it all)');
  SOUL.setSeams({ notify: notifySaved });
}

/* ===========================================================================
   7. THE HOME, THE BRIEF AND ASK
=========================================================================== */
console.log('\n7. the Home\'s spend.roi, the brief\'s sentence, Ask\'s think deeply');
{
  resetStore(); clean(); setDay(realDay(), '06:00');
  const a = await LLM.paidRecord({ task: 'weekly-strategy', model: 'anthropic/claude-sonnet-5', costUsd: 0.42 });
  await LLM.paidOutcome(a, { helped: true, note: '3 of its intents ran' });
  await LLM.paidRecord({ task: 'tie-break', model: 'anthropic/claude-sonnet-5', costUsd: 0.04 });
  const h = await HOME.homeView();
  ok(h.spend && h.spend.roi && h.spend.roi.calls === 2 && h.spend.roi.usd === 0.46 && h.spend.roi.helped === 1, 'the Home shows spend.roi {calls, usd, helped}: ' + JSON.stringify(h.spend.roi));
  ok(h.voice && h.voice.telegram.linked === false && h.voice.telegram.why === 'so the Lantern can reach you when something is urgent' && h.voice.digestAt === '22:00 UTC', 'and while Telegram is not linked, why it matters');
  putSnap(snapFor(realDay()));
  const b = await HOME.writeBrief({ date: realDay(), id: realDay() + '-daily', snapshot: snapFor(realDay()), assess: { trajectories: [] }, intents: [] }, {});
  ok(b.ok && /Paid models this month: 0\.46 dollars, 2 uses: the Monday strategy and a tie break\.$/.test(b.brief.text), 'the brief carries one plain sentence on paid models: ' + b.brief.text.slice(-80));
  const ls = await HOME.lanternState();
  ok(ls.brief && !/Paid models/.test(ls.brief.text), 'the conversation\'s state stays without the spend');
  /* Ask: "think deeply" pays for the one synthesis, nothing else */
  ok(LA.thinkDeeply('Think deeply about why reach fell this week') && LA.thinkDeeply('please think hard') && !LA.thinkDeeply('What do you think?') && !LA.thinkDeeply('deep verse reels'), 'only his own words ask for depth');
  const seen = [];
  const base = async task => { seen.push(task); return task.tier === 'deep' ? { ok: true, content: '{"answer":"x"}', paid: true, paidId: 'pd-x', tier: 'deep' } : { ok: true, content: '{}', tier: task.tier }; };
  const ar = LA.askRoute('Think deeply: what should the house do next?', base);
  await ar.route({ tier: 'fast', json: true, messages: [], opts: { timeout: 9000 } });
  await ar.route({ tier: 'strong', messages: [], opts: { timeout: 9000 } });
  await ar.route({ tier: 'strong', json: true, messages: [], opts: { timeout: 9000 } });
  await ar.route({ tier: 'strong', json: true, messages: [], opts: { timeout: 9000 } });
  ok(seen.map(t => t.tier + (t.purpose ? ':' + t.purpose : '')).join() === 'fast,strong,deep:ask-deep,strong' && seen[2].opts.timeout === 25000 && ar.paidCalls.length === 1,
    'the plan and the subagents stay free; the one synthesis asks the deep tier as "ask-deep", with time to think: ' + seen.map(t => t.tier).join(','));
  const plain = LA.askRoute('What did the Lantern do today?', base);
  ok(plain.route === base && !plain.deep, 'without his words, nothing changes');
}

/* ===========================================================================
   8. ROUND FIVE: the models review's findings, each its own repro turned
      into a check (tests/repro in the review's tree), and NVIDIA's catalog
=========================================================================== */
console.log('\n8. round five: the paid caps under pressure, zero retention for mail, faults that fade, Telegram outages, what was told, NVIDIA');
const realNow = Date.now;
{
  /* D1: five asks at once against the day's last 0.10 (day-cap-race) */
  resetStore(); clean();
  process.env.OPENROUTER_API_KEY = 'or-test'; process.env.SOUL_DEEP_MODELS = 'anthropic/claude-sonnet-5';
  OR.calls.length = 0;
  OR.answer = async () => { await new Promise(r => setTimeout(r, 120)); return resp(200, { choices: [{ message: { content: '{"answer":"deep"}' } }], usage: { prompt_tokens: 50, completion_tokens: 8000, cost: 0.08 } }); };
  await LLM.deepPrices(true);
  const day = realDay(), month = realMonth();
  S.set(LLM.K_SPEND_DAY(day), String(400000));
  const ask = () => LLM.route({ tier: 'deep', purpose: 'ask-deep', json: true, messages: [{ role: 'user', content: 'think deeply: what should the house do next?' }], opts: { max_tokens: 8000 } });
  const rs = await Promise.all([ask(), ask(), ask(), ask(), ask()]);
  const dayUsd = Number(S.get(LLM.K_SPEND_DAY(day))) / 1e6;
  const paidCalls = () => OR.calls.filter(b => LLM.DEEP_MODELS.includes(b.model)).length;   /* the free fallback may ask OpenRouter's free names */
  ok(rs.filter(r => r.paid).length === 1 && paidCalls() === 1 && dayUsd <= LLM.PAID_DAY_CAP_USD && Math.abs(dayUsd - 0.48) < 1e-9,
    'five asks at once with 0.40 of the day spent: one is paid, the hold refuses the other four before a byte is sent, and the day ends at ' + dayUsd + ' of 0.50 (it was 0.80)');
  ok(rs.filter(r => !r.paid).every(r => r.tried.some(t => t.paid && /would pass the day's cap/.test(t.err))), 'each refused one says the day\'s cap held it');
  ok(Number(S.get('nsoul:spend:' + month)) === 80000 && Number(S.get('nsoul:spend:' + month + ':calls')) === 1, 'and the month\'s ledger holds the one actual cost, 0.08, with one call counted');

  /* D1: a store that answers reads and refuses writes (write-fault) */
  resetStore(); clean();
  process.env.OPENROUTER_API_KEY = 'or-test'; process.env.SOUL_DEEP_MODELS = 'anthropic/claude-sonnet-5';
  let billed = 0;
  OR.calls.length = 0;
  OR.answer = async b => { if (LLM.DEEP_MODELS.includes(b.model)) billed += 0.08; return resp(200, { choices: [{ message: { content: '{"answer":"deep"}' } }], usage: { prompt_tokens: 50, completion_tokens: 8000, cost: 0.08 } }); };
  await LLM.deepPrices(true);
  S.set(LLM.K_SPEND_DAY(day), String(400000));
  FAULT.cmds = new Set(['INCRBY', 'HSET', 'SET']);
  let paidN = 0, flagged = 0;
  for (let i = 0; i < 10; i++) {
    const r = await LLM.route({ tier: 'deep', purpose: 'ask-deep', json: true, messages: [{ role: 'user', content: 'think deeply about the week' }], opts: { max_tokens: 8000 } });
    if (r.paid) paidN++; if (r.paidButUnrecorded || r.spendRecorded === false) flagged++;
    if (i === 0) ok(r.tried.some(t => t.paid && /did not take the hold/.test(t.err)), 'a store that will not take the hold refuses the paid call, fail closed: ' + (r.tried.find(t => t.paid) || {}).err);
  }
  FAULT.cmds = null;
  ok(paidN === 0 && billed === 0 && paidCalls() === 0 && flagged === 0 && Number(S.get(LLM.K_SPEND_DAY(day))) === 400000,
    'ten asks while the store refuses writes: not one paid call, nothing billed and nothing left unrecorded (it was ten calls, 0.80 billed, 0.40 in the ledger)');

  /* D1: a cost that could not be written closes the paid door for the day, for every caller */
  resetStore(); clean();
  process.env.OPENROUTER_API_KEY = 'or-test'; process.env.SOUL_DEEP_MODELS = 'anthropic/claude-sonnet-5';
  OR.calls.length = 0;
  OR.answer = async () => { FAULT.cmds = new Set(['INCRBY']); return resp(200, { choices: [{ message: { content: '{"answer":"deep"}' } }], usage: { prompt_tokens: 50, completion_tokens: 900, cost: 0.095 } }); };
  await LLM.deepPrices(true);
  const short = await LLM.route({ tier: 'deep', purpose: 'ask-deep', json: true, messages: [{ role: 'user', content: 'think deeply' }], opts: { max_tokens: 900 } });
  FAULT.cmds = null;
  ok(short.paid && short.spendRecorded === false && S.has(LLM.K_DEEPOFF(day)), 'a paid answer that cost more than its hold, its correction refused by the store: spendRecorded false, and the paid door is closed for the day (' + LLM.K_DEEPOFF(day) + ')');
  OR.answer = null; OR.calls.length = 0;
  const after = await LLM.route({ tier: 'deep', purpose: 'tie-break', paidOnly: true, json: true, messages: msgs, opts: { max_tokens: 300 } });
  ok(!after.paid && paidCalls() === 0 && after.tried.some(t => t.paid && /the paid door is closed for the rest of the day/.test(t.err)), 'and every caller meets the closed door, whoever asks (the Ask, the council, the mailbox, the research): ' + (after.tried.find(t => t.paid) || {}).err);
  const roomShut = await LLM.paidRoom(0.01, 'web-search');
  ok(!roomShut.ok && /closed for the rest of the day/.test(roomShut.why), 'the research\'s own check reads the same door');
  S.delete(LLM.K_DEEPOFF(day));
  const still = await LLM.paidRoom(0.01, 'web-search');
  ok(!still.ok, 'this instance keeps the door shut for the day even if the store loses the mark');
  LLM.forgetPaidDay();

  /* D1: a paid call made outside route() holds and settles the same way */
  resetStore(); clean();
  S.set(LLM.K_SPEND_DAY(day), String(450000));
  const h1 = await LLM.paidReserve(0.04, 'web-search');
  const h2 = await LLM.paidReserve(0.04, 'web-search');
  ok(h1.ok && h1.hold && !h2.ok && Number(S.get(LLM.K_SPEND_DAY(day))) === 490000, 'paidReserve holds a worst case before the call: 0.45 + 0.04 fits, a second 0.04 does not');
  const st1 = await LLM.paidSettle(h1.hold, { costUsd: 0.015, model: 'anthropic/claude-sonnet-5', task: 'web-search' });
  ok(st1.ok && st1.spendRecorded && st1.paidId && Number(S.get(LLM.K_SPEND_DAY(day))) === 465000 && Number(S.get('nsoul:spend:' + month)) === 15000,
    'paidSettle puts the actual 0.015 in place of the hold in both ledgers and writes its ROI line: ' + st1.paidId);

  /* D4: the paid mail path asks for endpoints that keep nothing (mail-paid-zdr) */
  resetStore(); clean();
  process.env.OPENROUTER_API_KEY = 'or-test'; process.env.GROQ_API_KEY = 'gsk_test';
  OR.calls.length = 0; OR.answer = null; GQ.calls.length = 0;
  await LLM.deepPrices(true); await LLM.freeModels('groq', true);
  const minute = Math.floor(Date.now() / 60000);
  for (const m of LLM.MAIL_GROQ) S.set('nllm:tpm:groq:' + m + ':' + minute, '6500');
  const mr = await LLM.route({ tier: 'mail', purpose: 'letter-retry', json: true, caller: 'soul', opts: { max_tokens: 700 },
    messages: [{ role: 'system', content: 'ROLE: mail-reader' }, { role: 'user', content: 'EMAIL: Salaam, our trust runs four schools; my daughter is unwell this week but we would love the curriculum.' }] });
  const pv = OR.calls[0] && OR.calls[0].provider;
  ok(mr.paid && GQ.calls.length === 0 && pv && pv.zdr === true && pv.data_collection === 'deny', 'a letter retry that reaches a paid name asks for zero data retention endpoints only (zdr true, beside data_collection deny): ' + JSON.stringify(pv));
  OR.calls.length = 0;
  await LLM.route({ tier: 'deep', purpose: 'ask-deep', json: true, messages: msgs, opts: { max_tokens: 300 } });
  ok(OR.calls[0] && OR.calls[0].provider.zdr === true, 'and so does the owner\'s own think deeply in Ask, which may carry his words');
  OR.calls.length = 0;
  await LLM.route({ tier: 'deep', purpose: 'weekly-strategy', json: true, messages: msgs, opts: { max_tokens: 300 } });
  ok(OR.calls[0] && OR.calls[0].provider.zdr === undefined && OR.calls[0].provider.data_collection === 'deny', 'while the Monday strategy, totals only, keeps data_collection deny without narrowing its endpoints');

  /* D7: one bad hour no longer demotes the lead for good (rank-lockin) */
  resetStore(); clean();
  process.env.GROQ_API_KEY = 'gsk_test'; process.env.GEMINI_API_KEY = 'gem-test';
  let geminiDown = true; const asked = [];
  onNet('https://generativelanguage.googleapis.com/v1beta/openai/models', async () => resp(200, { data: [{ id: 'models/gemini-3.8-flash' }, { id: 'models/gemini-3.7-flash' }] }));
  onNet('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', async () => { asked.push('gemini'); return geminiDown ? resp(503, { error: { message: 'The model is overloaded' } }) : resp(200, { choices: [{ message: { content: 'ok' } }], usage: { total_tokens: 20 } }); });
  const gq0 = GQ.calls.length;
  const BASE = Date.parse('2026-10-09T12:00:00Z');   /* a Friday noon, far from a week's turn */
  let shift = 0; Date.now = () => BASE + shift;
  try {
    await LLM.freeModels('groq', true); await LLM.freeModels('gemini', true);
    const call = async () => { shift += 61000; LLM.forgetScores(); const before = GQ.calls.length; const r = await LLM.route({ tier: 'strong', messages: [{ role: 'user', content: 'Write one line.' }], opts: { max_tokens: 50 } }); for (let i = before; i < GQ.calls.length; i++) asked.push('groq'); return r; };
    for (let i = 0; i < 10; i++) await call();
    geminiDown = false;
    const weeks = [];
    for (let w = 0; w < 3; w++) {
      asked.length = 0;
      for (let i = 0; i < 20; i++) await call();
      weeks.push(asked.filter(p => p === 'gemini').length);
      shift += 7 * 86400000;
    }
    ok(weeks[0] === 0, 'the hour after the outage the fallback answers: the fault is fresh (' + weeks.join(', ') + ' calls to Gemini over three weeks)');
    ok(weeks[1] >= 1 && weeks[1] <= 3, 'a week on, the lead not measured for a day is asked first once an hour, and is heard again (' + weeks[1] + ' of 20)');
    ok(weeks[2] >= 19, 'two weeks on the bad hour has left the scoreboard and the lead leads again (' + weeks[2] + ' of 20); it was 0, 0 and 0 before');
    const order = (await LLM.chainFor('strong', { skipGood: true })).map(c => c.provider + ':' + c.model);
    ok(order[0] === 'gemini:gemini-3.8-flash', 'and the tier\'s own order stands again: ' + order.join(', '));
  } finally { Date.now = realNow; }
  /* the hour's one look, on its own */
  resetStore(); clean();
  const pair = [{ provider: 'groq', model: 'openai/gpt-oss-120b' }, { provider: 'gateway', model: 'poolside/laguna-s-2.1-free' }];
  seedScore('groq', 'openai/gpt-oss-120b', { n: 9, ok: 9, at: new Date().toISOString() });
  seedScore('gateway', 'poolside/laguna-s-2.1-free', { n: 9, ok: 9, at: new Date(Date.now() - 3 * 86400000).toISOString() });
  const e1 = await LLM.exploreFirst('strong', pair, Date.now());
  const e2 = await LLM.exploreFirst('strong', pair, Date.now());
  ok(e1[0].provider === 'gateway' && e2[0].provider === 'groq' && [...S.keys()].some(k => k.startsWith('nllm:explore:strong:')), 'once an hour the best name not measured for a day goes first, then the order stands for the rest of the hour');
  LLM.forgetExplore();
  seedScore('groq', 'openai/gpt-oss-120b', { n: 9, ok: 9, at: new Date(Date.now() - 2 * 86400000).toISOString() });
  for (const k of [...S.keys()]) if (k.startsWith('nllm:explore:')) S.delete(k);
  const e3 = await LLM.exploreFirst('strong', pair, Date.now());
  ok(e3[0].provider === 'groq' && ![...S.keys()].some(k => k.startsWith('nllm:explore:')), 'a lead itself unmeasured for a day is asked anyway: nothing moves and the hour is not spent');
  clean();
}

{
  /* D2: a Telegram outage no longer spends the day (tg-burn) */
  resetStore(); clean();
  const notifySaved = SOUL.seams.notify;
  SOUL.setSeams({ notify: null });
  process.env.TG_BOT_TOKEN = '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
  const RD = realDay();
  setDay(RD, '09:00');
  S.set(T.K_TG_OWNER, JSON.stringify({ chat: 4242, name: 'Sam', since: RD + 'T08:00:00.000Z' }));
  await DEC.upsert({ kind: 'approve', key: 'mail:o-1', stamp: '1', sticky: true, source: 'mail', title: 'Send this letter to a place?', options: [DEC.opt.yes({ type: 'done' }, 'Send')],
    letter: { to: 'contact@alnoor.example.org', toName: 'Al Noor Islamic Centre', subject: 'Free material', text: 'Assalamu alaykum,\n\nWe would be glad to help.', kind: 'outreach' } });
  let down = true; const delivered = [], tries = [];
  onNet('https://api.telegram.org/bot', async (u, init) => { tries.push(1); if (down) return resp(502, { ok: false, error_code: 502, description: 'Bad Gateway' }); delivered.push(JSON.parse(init.body).text); return resp(200, { ok: true, result: { message_id: delivered.length } }); });
  for (let i = 0; i < 6; i++) { await V.voiceTick(); CLOCK.t += 15 * 60000; }
  ok((parseInt(S.get(T.K_TG_SENT(RD)) || '0', 10) || 0) === 0, 'six ticks while Telegram answers 502: not one of the day\'s six is spent (it was all six)');
  ok(tries.length === 1, 'and the letters reminder was asked once, its mark held thirty minutes, not at every tick (' + tries.length + ' tries)');
  S.delete(V.VK.said('letters', 'window'));   /* the thirty minutes pass */
  await V.voiceTick();
  ok(tries.length === 2 && (parseInt(S.get(T.K_TG_SENT(RD)) || '0', 10) || 0) === 0, 'once they pass it asks again, still for nothing');
  down = false;
  const d = await V.urgent('distress', { ref: 't-1' });
  await V.mailHanded('legal', 't-2');
  const ev = await V.eveningDigest({ force: true });
  ok(d.sent && ev.sent && delivered.length === 2 && parseInt(S.get(T.K_TG_SENT(RD)), 10) === 2, 'Telegram back: someone at risk is told at once and the evening goes too, two of the six spent (both were refused before)');
  SOUL.setSeams({ notify: notifySaved });
  delete process.env.TG_BOT_TOKEN;

  /* D9: a carried Monday no longer swallows Tuesday's needs (told-unsaid) */
  resetStore(); clean();
  const sent = []; let tfault = true;
  SOUL.setSeams({ notify: async t => { if (tfault) return { ok: false, reason: 'Telegram did not answer: socket hang up' }; sent.push(t); return { ok: true }; } });
  setDay(MONDAY, '06:00');
  await V.digestAdd({ kind: 'weekly', text: 'NOOR Lantern, weekly cycle ' + MONDAY + '. Needs you: the Observatory could not be read.', told: ['the Observatory could not be read'] });
  setDay(MONDAY, '22:05'); await V.eveningDigest({});
  tfault = false;
  const TUE = addDays(MONDAY, 1);
  setDay(TUE, '06:00');
  const need = 'posting health is 91 percent over the last 7 days, under the 98 you set';
  await V.digestAdd({ kind: 'cycle', text: 'NOOR Lantern, daily cycle ' + TUE + '. Needs you: ' + need + '.', told: [need, 'a fourth need the morning never said'] });
  setDay(TUE, '22:05'); await V.eveningDigest({});
  setDay(addDays(MONDAY, 2), '06:00');
  ok(sent.length === 1 && /Observatory could not be read/.test(sent[0]) && /posting health is 91 percent/.test(sent[0]), 'the carried Monday and Tuesday\'s own morning are both said: ' + String(sent[0]).slice(0, 160));
  ok((await V.newToOwner([need])).length === 0 && (await V.newToOwner(['the Observatory could not be read'])).length === 0, 'and both needs are remembered as told');
  ok((await V.newToOwner(['a fourth need the morning never said'])).length === 1, 'while a need whose words were in no message is not: it is still fresh for the next morning');
  SOUL.setSeams({ notify: notifySaved });
}

{
  /* NVIDIA's catalog: found live, for totals only, held back while its trial terms stand */
  resetStore(); clean();
  process.env.NVIDIA_API_KEY = 'nvapi-test-key';
  ok(!LLM.providerPresent('nvidia') && LLM.nvidiaHeld() && LLM.providersConfigured().nvidia === 'held', 'NVIDIA\'s key alone opens nothing: its free catalog is for trial use only, not production, so it waits for NVIDIA_PRODUCTION_OK');
  const rk0 = await LLM.rankingReport();
  ok(rk0.nvidia && rk0.nvidia.held && rk0.words.some(w => /NVIDIA's free models are held back/.test(w) && !DASHES.test(w)), 'and the engine room says so in words');
  const NV = { models: 0, chats: [], down: false };
  onNet('https://integrate.api.nvidia.com/v1/models', async (u, init) => { NV.models++; if (NV.down) throw new Error('ECONNREFUSED'); return resp(200, { object: 'list', data: [
    { id: 'nvidia/nemotron-3.5-lightning-30b-a3b', object: 'model', owned_by: 'nvidia' }, { id: 'z-ai/glm-5.3-flash', object: 'model', owned_by: 'z-ai' },
    { id: 'nvidia/nemotron-3-super-120b-a12b', object: 'model', owned_by: 'nvidia' }, { id: 'moonshotai/kimi-k3', object: 'model', owned_by: 'moonshotai' },
    { id: 'nvidia/nv-embedqa-mistral-7b-v2', object: 'model', owned_by: 'nvidia' }, { id: 'meta/llama-guard-4-12b', object: 'model', owned_by: 'meta' }] }); });
  onNet('https://integrate.api.nvidia.com/v1/chat/completions', async (u, init) => { const b = JSON.parse(init.body); NV.chats.push({ b, auth: init.headers.Authorization }); return resp(200, { model: b.model, choices: [{ message: { content: 'lit' } }], usage: { total_tokens: 12 } }); });
  process.env.NVIDIA_PRODUCTION_OK = '1';
  const ids = await LLM.freeModels('nvidia', true);
  ok(LLM.providerPresent('nvidia') && ids.join() === 'nvidia/nemotron-3.5-lightning-30b-a3b,z-ai/glm-5.3-flash,nvidia/nemotron-3-super-120b-a12b,moonshotai/kimi-k3',
    'with his word, its chat names that the live catalog lists today, never an embedder or a guard: ' + ids.join(', '));
  const fast = (await LLM.chainFor('fast', { skipGood: true })).map(c => c.provider + ':' + c.model);
  const strong = (await LLM.chainFor('strong', { skipGood: true })).map(c => c.provider + ':' + c.model);
  const long = (await LLM.chainFor('long', { skipGood: true })).map(c => c.provider + ':' + c.model);
  ok(fast.join() === 'nvidia:nvidia/nemotron-3.5-lightning-30b-a3b,nvidia:z-ai/glm-5.3-flash' && strong.join() === 'nvidia:nvidia/nemotron-3-super-120b-a12b,nvidia:moonshotai/kimi-k3' && long[0] === 'nvidia:nvidia/nemotron-3-super-120b-a12b',
    'its quick names in the fast tier, its strong ones in the strong and long tiers');
  const r = await LLM.route({ tier: 'strong', messages: [{ role: 'user', content: 'Reply with one word: lit' }] });
  ok(r.ok && r.provider === 'nvidia' && NV.chats.length === 1 && NV.chats[0].auth === 'Bearer nvapi-test-key' && NV.chats[0].b.model === 'nvidia/nemotron-3-super-120b-a12b', 'and it answers, by its own key, through the same free gate');
  const pp = await LLM.route({ tier: 'strong', perPerson: true, messages: [{ role: 'user', content: 'Reply with one word: lit' }] });
  ok(!pp.ok && NV.chats.length === 1 && pp.tried.every(t => /never sent to NVIDIA/.test(t.err)), 'never a person\'s words: its trial terms let it learn from what it reads');
  const ml = await LLM.route({ tier: 'mail', json: true, caller: 'soul', messages: [{ role: 'system', content: 'ROLE: mail-reader' }, { role: 'user', content: 'EMAIL: thank you' }] });
  ok(!ml.ok && NV.chats.length === 1 && !ml.tried.some(t => t.provider === 'nvidia'), 'and never mail: the mail tier does not know it');
  S.set('nllm:rl:nvidia:*:m:' + Math.floor(Date.now() / 60000), '30');
  const busy = await LLM.route({ tier: 'fast', messages: [{ role: 'user', content: 'Reply with one word: lit' }] });
  ok(!busy.ok && busy.tried.length === 2 && busy.tried.every(t => /rpm/.test(t.err)), 'one bucket for the whole account, every name together: thirty a minute, under its forty');
  /* the scoreboard ranks it against the others */
  process.env.GROQ_API_KEY = 'gsk_test';
  await LLM.freeModels('groq', true);
  seedScore('groq', 'openai/gpt-oss-120b', { n: 12, ok: 3, fail: 9 });
  const ranked = (await LLM.chainFor('strong', { skipGood: true })).map(c => c.provider + ':' + c.model);
  ok(ranked[0].startsWith('nvidia:') && ranked[ranked.length - 1] === 'groq:openai/gpt-oss-120b', 'ranked by the scoreboard with the others: a failing Groq falls behind it: ' + ranked.join(', '));
  /* no written fallback */
  NV.down = true; LLM.forgetLive('nvidia'); S.delete('nllm:live:nvidia');
  ok((await LLM.freeModels('nvidia', true)).length === 0, 'a catalog that cannot be read names nothing: there is no written list to fall back on');
  clean();
}

/* the files of this round keep the house's punctuation */
{
  const files = ['api/_judge.js', 'api/_voice.js', 'api/_jev.js', 'tests/models.mjs'].map(f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
  ok(files.every(t => !DASHES.test(t)), 'no em or en dash in the round\'s new files');
  ok(!/console\.(log|error|warn)/.test(files[0] + files[1]), 'and the judge and the voice log nothing');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
