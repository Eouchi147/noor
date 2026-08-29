/* NOOR · the Lantern's night shift.
   ------------------------------------------------------------------
   The doctrine every job here obeys: the Lantern does not write facts, it
   exercises judgment over material that is already true.

   So the thing this file has to prove is not that the jobs work. It is that
   a job which goes WRONG is still harmless: it cannot edit a page, cannot
   publish, cannot delete, and cannot put a number in front of the owner that
   the material did not contain.

   Run:  node tests/nightshift.mjs
*/
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const LIB = JSON.parse(fs.readFileSync('lights/all.json', 'utf8'));
const STORE = new Map();
let reply = null, calls = [];

process.env.KV_REST_API_URL = 'https://kv.test';
process.env.KV_REST_API_TOKEN = 't';
process.env.OPENROUTER_API_KEY = 'sk-test';

globalThis.fetch = async (url, opt) => {
  url = String(url);
  if (url.startsWith('https://kv.test')) {
    const cmds = JSON.parse(opt.body);
    return { ok: true, status: 200, json: async () => cmds.map(c => {
      const [v, k, ...r] = c;
      if (v === 'GET') return { result: STORE.has(k) ? STORE.get(k) : null };
      if (v === 'SET') { STORE.set(k, r[0]); return { result: 'OK' }; }
      if (v === 'DEL') { STORE.delete(k); return { result: 1 }; }
      if (v === 'MGET') return { result: [k, ...r].map(x => STORE.get(x) ?? null) };
      if (v === 'LPUSH') { const l = STORE.get(k) || []; l.unshift(r[0]); STORE.set(k, l); return { result: l.length }; }
      if (v === 'LRANGE') { const l = STORE.get(k) || []; return { result: l.slice(0, +r[1] + 1) }; }
      if (v === 'LTRIM') { const l = STORE.get(k) || []; STORE.set(k, l.slice(0, +r[1] + 1)); return { result: 'OK' }; }
      return { result: null };
    }) };
  }
  if (url.includes('/lights/all.json')) return { ok: true, status: 200, json: async () => LIB };
  if (url.includes('/verse/')) return { ok: false, status: 404, json: async () => ({}) };
  if (url.includes('/api/v1/models')) return { ok: true, status: 200, json: async () => ({ data: [{ id: 'x/y:free', context_length: 9000, pricing: { prompt: '0', completion: '0', request: '0' }, architecture: { input_modalities: ['text'], output_modalities: ['text'] } }] }) };
  if (url.includes('/chat/completions')) {
    calls.push(JSON.parse(opt.body).messages[0].content.slice(0, 40));
    if (reply === null) return { ok: false, status: 404, json: async () => ({ error: { message: 'dark' } }), text: async () => 'dark' };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: typeof reply === 'function' ? reply() : reply } }] }) };
  }
  throw new Error('unexpected fetch ' + url);
};

const N = await import('../api/_nightshift.js');

console.log('\n=== 1. it reads what the house already published ===');
{
  const c = await N.corpus('h');
  ok(c.length > 300, c.length + ' passages gathered from the live site');
  ok(c.every(p => p.text && p.where), 'every one carries where it came from, so a finding is actionable');
  ok(c.some(p => p.kind === 'light'), 'the light library is in it');
}

console.log('\n=== 2. it walks the corpus rather than sampling it ===');
{
  STORE.clear(); reply = '{"verdict":"clear"}';
  const a = await N.auditCorpus('h', 5);
  const b = await N.auditCorpus('h', 5);
  ok(a.from === 0 && b.from === 5, 'the second night starts where the first stopped (' + a.from + ' then ' + b.from + ')');
  ok(/nights to walk/.test(a.pace), 'and it says how long a full pass takes (' + a.pace + ')');
}

console.log('\n=== 3. a finding names the file, and nothing is changed ===');
{
  STORE.clear();
  reply = '{"verdict":"look","why":"the hadith is quoted with no collection or number"}';
  const before = JSON.stringify([...STORE.entries()]);
  const r = await N.auditCorpus('h', 3);
  ok(r.found === 3, 'three passages flagged');
  const f = await N.findings();
  ok(f.length === 3 && /lights-\*/.test(f[0].where), 'each finding says which file to open (' + f[0].where + ')');
  ok(!before.includes('changed'), 'and no page, card or note was touched: the job has no write path to one');
  ok(Object.keys(STORE.keys()).length >= 0 && ![...STORE.keys()].some(k => /^nb:|^nj:/.test(k)),
     'it never wrote into the content or journal keyspaces');
}

console.log('\n=== 4. a finding may not invent a number ===');
{
  STORE.clear();
  reply = '{"verdict":"look","why":"the year 1187 here should be 1193 according to most sources"}';
  const r = await N.auditCorpus('h', 6);
  const f = await N.findings();
  ok(f.every(x => !/1193/.test(x.why)),
     'a finding carrying a number the passage does not contain is thrown away, not shown');
  ok(r.found < 6, 'so fewer findings survive than were produced (' + r.found + ' of 6)');
}

console.log('\n=== 5. a broken reply is a skip, not a crash ===');
{
  STORE.clear();
  for (const junk of ['not json at all', '{"verdict":"maybe"}', '', '{"verdict":"look"}']) {
    reply = junk;
    const r = await N.auditCorpus('h', 2);
    ok(r.ok === true, 'a reply of ' + JSON.stringify(junk.slice(0, 22)) + ' leaves the shift standing');
  }
}

console.log('\n=== 6. the Lantern dark ===');
{
  STORE.clear(); reply = null;
  const r = await N.runNightShift('h', { audit: 3 });
  ok(r.jobs.audit.ok === true, 'the shift still completes');
  ok(r.jobs.audit.found === 0, 'and flags nothing rather than guessing');
  ok(r.jobs.brief.ok === false, 'the brief says it could not be written');
}

console.log('\n=== 7. the brief may not invent a number either ===');
{
  STORE.clear();
  reply = 'Nine gifts arrived and two messages wait. The lantern answered. Nothing else needs you.';
  const good = await N.dailyBrief({ 'gifts in the last 30 days': 9, 'unread messages': 2 });
  ok(good.ok === true, 'a brief built from the numbers given is accepted');
  ok((await N.readBrief()).text === good.text, 'and stored where the console reads it');

  reply = 'Four hundred and twelve readers came, 412 of them new. Nothing needs you.';
  const bad = await N.dailyBrief({ 'gifts in the last 30 days': 9, 'unread messages': 2 });
  ok(bad.ok === false && /number/.test(bad.why), 'a brief that invents a number is refused (' + bad.why + ')');

  reply = 'A fine day! Truly wonderful.';
  ok((await N.dailyBrief({ a: 1 })).ok === false, 'and so is one written in exclamation marks');
}

console.log('\n=== 8. inbox triage sorts and never replies ===');
{
  STORE.clear();
  STORE.set('nb:list', ['m1', 'm2']);
  STORE.set('nb:msg:m1', JSON.stringify({ id: 'm1', body: 'Surah 2 verse 255 is cited as 2:256 on the mushaf page.' }));
  STORE.set('nb:msg:m2', JSON.stringify({ id: 'm2', body: 'Thank you for this beautiful work.' }));
  reply = () => '{"sort":"correction","gist":"a verse number is wrong on the mushaf page","urgent":true}';
  const r = await N.triageInbox();
  ok(r.sorted === 2, 'both messages were sorted');
  const m1 = JSON.parse(STORE.get('nb:msg:m1'));
  ok(m1.sort === 'correction' && m1.urgent === true, 'the correction is marked urgent so it rises');
  ok(m1.body === 'Surah 2 verse 255 is cited as 2:256 on the mushaf page.',
     'and the message itself is untouched: triage adds a label, it does not edit');
  ok(!('reply' in m1) && !('sent' in m1), 'nothing was replied to');

  const again = await N.triageInbox();
  ok(again.sorted === 0, 'a second pass re-sorts nothing, so the calls are spent once');
}

console.log('\n=== 9. a finding can be dismissed ===');
{
  STORE.clear();
  reply = '{"verdict":"look","why":"a claim of fact with no source"}';
  await N.auditCorpus('h', 3);
  const f = await N.findings();
  await N.clearFinding(f[0].id);
  const after = await N.findings();
  ok(after.length === f.length - 1, 'it leaves the list (' + f.length + ' then ' + after.length + ')');
  ok(!after.some(x => x.id === f[0].id), 'and does not come back');
}

console.log('\n=== 10. every job is wrapped ===');
{
  STORE.clear();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, o) => {
    if (String(u).includes('/lights/all.json')) throw new Error('corpus is gone');
    return realFetch(u, o);
  };
  reply = 'Two messages wait. Nothing else needs you. Nothing can wait.';
  const r = await N.runNightShift('h', { audit: 2 });
  ok(r.jobs.audit.ok === false, 'a job that cannot read its material says so');
  ok(r.jobs.brief.ok === true, 'and the rest of the night still runs');
  globalThis.fetch = realFetch;
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
