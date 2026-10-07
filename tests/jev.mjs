/* NOOR · the judge beside the Lantern.
   ------------------------------------------------------------------
   api/_jev.js asks Jev, a model that cannot write, whether what a free model
   wrote for the Lantern puts words in the Prophet's mouth, cites a hadith
   number nobody checked, issues a ruling, slights anyone, or wanders off its
   subject. It can only take a reflection away, never add one, and when it
   cannot be reached the Lantern behaves as it always did. This holds all of
   that, with the gateway, the store and the free models stood in for, and
   drives the real Verse Lamp through it end to end.

   Run:  node tests/jev.mjs
*/
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

process.env.KV_REST_API_URL = 'https://kv.test'; process.env.KV_REST_API_TOKEN = 't';
process.env.OPENROUTER_API_KEY = 'sk-test';
delete process.env.AI_GATEWAY_API_KEY; delete process.env.VERCEL_OIDC_TOKEN;
delete process.env.OPENROUTER_MODEL; delete process.env.ALLOW_PAID_MODELS;

const STORE = new Map();
let JEV = null;          /* (body) => response object, or 'down' or 'hang' */
let WRITER = null;       /* the JSON the free model answers with */
const sent = [];
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.startsWith('https://kv.test')) {
    const cmds = JSON.parse(opt.body);
    return { ok: true, status: 200, json: async () => cmds.map(([v, k, val]) => v === 'GET' ? { result: STORE.get(k) ?? null } : v === 'SET' ? (STORE.set(k, val), { result: 'OK' }) : { result: 1 }) };
  }
  if (url === 'https://openrouter.ai/api/v1/models') return { ok: true, status: 200, json: async () => ({ data: [{ id: 'test/free-writer:free', context_length: 8000, pricing: { prompt: '0', completion: '0', request: '0' }, architecture: { input_modalities: ['text'], output_modalities: ['text'] } }] }) };
  if (url === 'https://openrouter.ai/api/v1/chat/completions') return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(WRITER) } }] }) };
  /* round four: the gateway's Decision API, POST /v1/evaluate */
  if (url.startsWith('https://ai-gateway.vercel.sh/v1/evaluate')) {
    const body = JSON.parse(opt.body); sent.push({ url, auth: opt.headers && opt.headers.authorization, body });
    if (JEV === 'down') throw new Error('ECONNREFUSED');
    if (JEV === 'hang') return new Promise((res, rej) => opt.signal && opt.signal.addEventListener('abort', () => { const e = new Error('a'); e.name = 'AbortError'; rej(e); }));
    const out = JEV(body);
    if (out && out.__status) { const { __status, ...rest } = out; return { ok: false, status: __status, json: async () => rest }; }
    return { ok: true, status: 200, json: async () => out };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};
const J = await import('../api/_jev.js');
/* a stand in judge: every risk at `risk`, relevance at `topic` */
/* round four: answered the way the Decision API answers a boolean, {type, probability} */
const judgeWith = (risk, topic, over = {}) => body => ({ model: 'typesafe-ai/jev', answers: Object.fromEntries(Object.keys(body.questions).map(k => [k, { type: 'boolean', probability: k in over ? over[k] : (k === 'on_topic' ? topic : risk) }])) });

console.log('\nasking Jev');
{
  const none = await J.judge('verse', 'text', { ref: '3:190' });
  ok(none.pass && none.gate === 'unavailable' && /credential/.test(none.why), 'with no credential the gate stands aside and says why, and passes nothing it would otherwise refuse');
  process.env.VERCEL_OIDC_TOKEN = 'oidc-abc';
  JEV = judgeWith(0.02, 0.97);
  const g = await J.judge('verse', 'A reflection.', { ref: '3:190' });
  const last = sent[sent.length - 1];
  ok(g.pass && g.gate === 'passed', 'a clean reflection passes');
  ok(last.auth === 'Bearer oidc-abc', 'the deployment’s own token is the credential: no key to create or leak');
  ok(last.body.model === 'typesafe-ai/jev' && last.body.state.text === 'A reflection.', 'one POST, the model named, the text as the state');
  ok(/faith/.test(last.body.questions.on_topic.instructions) && !/3:190/.test(last.body.questions.on_topic.instructions), 'the relevance question asks what Jev can see (is it about faith), not what it cannot (the meaning of a verse it is never shown)');
  ok(['attributes', 'hadith_number', 'ruling', 'slight', 'on_topic'].every(k => last.body.questions[k] && last.body.questions[k].type === 'boolean'), 'five yes or no questions, asked at once');
  /* round four: every call asks that nothing is kept and nothing learned */
  ok(last.url === 'https://ai-gateway.vercel.sh/v1/evaluate' && last.body.providerOptions && last.body.providerOptions.gateway
    && last.body.providerOptions.gateway.zeroDataRetention === true && last.body.providerOptions.gateway.disallowPromptTraining === true,
    'through the Decision API, POST /v1/evaluate, with zero data retention and no training on the request itself');
}

console.log('\nwhat it refuses');
{
  JEV = judgeWith(0.02, 0.95, { attributes: 0.91 });
  const v = await J.judge('verse', 'x', { ref: '1:1' });
  ok(!v.pass && v.gate === 'refused' && v.reasons.some(r => /attributes/.test(r)), 'a verse reflection that quotes the Prophet is refused: nothing handed to the writer had a saying in it');
  const q = await J.judge('question', 'x', { q: 'Why fast?' });
  ok(q.pass, 'while a Seeker’s answer may mention a narration, so long as it adds no number');
  JEV = judgeWith(0.02, 0.95, { attributes: 0.9, hadith_number: 0.88 });
  const q2 = await J.judge('question', 'x', { q: 'Why fast?' });
  ok(!q2.pass && q2.reasons.some(r => /hadith number/.test(r)), 'but one that cites a hadith number the house never checked is refused');
  JEV = judgeWith(0.02, 0.95, { ruling: 0.8 });
  ok(!(await J.judge('friday', 'x')).pass, 'a ruling is refused');
  JEV = judgeWith(0.02, 0.95, { slight: 0.7 });
  ok(!(await J.judge('thread', 'x')).pass, 'contempt for anyone is refused');
  JEV = judgeWith(0.02, 0.2);
  ok(!(await J.judge('verse', 'x', { ref: '2:255' })).pass, 'a piece that strays from its verse is refused');
  JEV = judgeWith(0.49, 0.51);
  ok((await J.judge('verse', 'x', { ref: '2:255' })).pass, 'the line is at one half, on both sides');
}

console.log('\nwhen the judge is not there');
{
  JEV = 'down';
  const d = await J.judge('verse', 'x', { ref: '1:1' });
  ok(d.pass && d.gate === 'unavailable', 'a dropped line changes nothing a reader sees, and is named');
  JEV = 'hang';
  const t0 = Date.now();
  const h = await J.judge('verse', 'x', { ref: '1:1' }, { timeoutMs: 400 });
  ok(h.pass && h.gate === 'unavailable' && /in time/.test(h.why) && Date.now() - t0 < 2000, 'a line that never answers is cut off, and the Lantern does not wait on it');
  JEV = body => ({ answers: { attributes: { type: 'boolean', probability: 0.1 } } });
  const part = await J.judge('verse', 'x', { ref: '1:1' });
  ok(part.gate === 'unavailable', 'an answer missing questions is not a pass on them: the whole verdict is treated as absent');
}

console.log('\nround six: refused outright, the judge waits an hour');
{
  const n0 = sent.length;
  JEV = () => ({ __status: 403, error: { message: 'This model needs AI Gateway credits' } });
  const r = await J.ask({ text: 'x' }, { slight: { type: 'boolean', instructions: 'x' } });
  ok(!r.ok && r.closed && /refused it \(403/.test(r.why) && /bought AI Gateway credit/.test(r.why) && sent.length === n0 + 1, 'a 403: not answered, and why: ' + r.why);
  ok(STORE.has(J.K_JEV_CLOSED) && /403/.test(STORE.get(J.K_JEV_CLOSED)), 'the reason is kept for an hour');
  const r2 = await J.ask({ text: 'y' }, { slight: { type: 'boolean', instructions: 'x' } });
  ok(!r2.ok && r2.closed && /^the judge waits: /.test(r2.why) && sent.length === n0 + 1, 'meanwhile it is not asked at all');
  const v = await J.judge('verse', 'x', { ref: '1:1' });
  ok(v.pass && v.gate === 'unavailable', 'and everything it would judge goes on as before it existed');
  STORE.delete(J.K_JEV_CLOSED);
  JEV = judgeWith(0.02, 0.95);
  const r3 = await J.ask({ text: 'z' }, { slight: { type: 'boolean', instructions: 'x' } });
  ok(r3.ok && sent.length === n0 + 2, 'after the hour (the key gone) it is asked again, and answers');
}

console.log('\nthe Verse Lamp, end to end');
{
  const L = (await import('../api/illuminations.js')).default;
  const call = async (q) => { let out = null, code = 0; const res = { setHeader() {}, status(c) { code = c; return this; }, json(o) { out = o; return this; } }; await L({ query: q, headers: {} }, res); return { code, out }; };
  /* long enough to pass the prose check (35 words), so the judge is what stops it */
  WRITER = { reflection: 'The Prophet said that whoever recites this verse after every single prayer is safe from the Fire forever, as narrated in Bukhari 9921, so reciting it is obligatory upon you every day without exception, and whoever neglects it has sinned before his Lord and must repent.', theme: 'Safety' };
  JEV = judgeWith(0.02, 0.9, { attributes: 0.96, hadith_number: 0.97, ruling: 0.93 });
  const bad = await call({ kind: 'verse' });
  ok(bad.out.source === 'treasury' && bad.out.gate === 'refused', 'a free model inventing a hadith with a number reaches no reader: the hand written lamp is shown instead');
  ok(bad.out.refusedFor.length === 3, 'and the refusal names all three reasons (' + bad.out.refusedFor.join('; ') + ')');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
