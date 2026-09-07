/* NOOR · the safety net.
   ------------------------------------------------------------------
   Reels were healed and nothing else was. A card Instagram refused at noon
   stayed refused for ever: the slot read "sent" because Facebook had taken it,
   a slot that reads sent is never revisited, and the only thing that could
   send the missing half was a button a human had to notice.

   The dangerous half of fixing that is obvious. A machine that retries on its
   own, every hour, against a record where one network already succeeded, is
   one bug away from posting to Facebook every hour for a day. So the first
   thing held here is that it CANNOT: a heal goes through the same path the
   button uses, which refuses a channel that already landed.

   Run:  node tests/heal.mjs
*/
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

process.env.FB_PAGE_ID = '123'; process.env.FB_PAGE_TOKEN = 'tok';
process.env.IG_USER_ID = '456'; process.env.IG_TOKEN = 'igtok';
process.env.KV_REST_API_URL = 'https://kv.test';
process.env.KV_REST_API_TOKEN = 't';

const SOC = await import('../api/social.js');

const DATE = '2026-09-07';
const KEY = 'nsoc:slot:' + DATE + '#word';
const STORE = new Map();
const realFetch = globalThis.fetch;
let sent = [], igFails = null, cardOk = true;

const CTX = {
  plan: { hijri: { text: '' }, day: {}, leads: [] },
  index: { words: [{ i: 1, t: 'Qalqalah', a: 'قلقلة', s: 'a bounce in the sound' }], path: [] },
  extras: { entry: { s: 'a bounce in the sound', l: '', cat: 'Tajwid', k: 'editorial' } },
  dials: { polish: false, mode: 'auto', storeOk: true }
};

globalThis.fetch = async (url, opt) => {
  const u = String(url);
  if (u.startsWith('https://kv.test')) {
    const cmds = JSON.parse(opt.body);
    return { ok: true, json: async () => cmds.map(c => {
      const [v, k, val] = c;
      if (v === 'GET') return { result: STORE.has(k) ? STORE.get(k) : null };
      if (v === 'SET') { STORE.set(k, val); return { result: 'OK' }; }
      return { result: null };
    }) };
  }
  /* the library, served offline, so healFailures composes the real way rather
     than being handed its content by the test */
  if (u.includes('/assets/menu-index.json'))
    return { ok: true, json: async () => ({ words: [{ i: 1, t: 'Qalqalah', a: 'قلقلة', s: 'a bounce in the sound' }], path: [] }) };
  if (u.includes('/assets/dict-index.json'))
    return { ok: true, json: async () => ({ 1: { s: 'a bounce in the sound', l: '', cat: 'Tajwid', k: 'editorial' } }) };
  if (u.includes('/api/card')) return cardOk
    ? { ok: true, status: 200, headers: { get: h => h === 'content-type' ? 'image/png' : '40000' }, json: async () => ({}), text: async () => '' }
    : { ok: false, status: 502, headers: { get: () => '' }, json: async () => ({}), text: async () => '' };
  if (u.includes('/photos') || u.includes('/feed')) { sent.push('facebook'); return { ok: true, json: async () => ({ id: 'FB' }), text: async () => '' }; }
  if (u.includes('/media_publish')) { sent.push('ig-publish'); return { ok: true, json: async () => ({ id: 'IGPOST' }), text: async () => '' }; }
  if (u.includes('/media')) {
    sent.push('ig-container');
    if (igFails) return igFails();
    return { ok: true, json: async () => ({ id: 'CONT' }), text: async () => '' };
  }
  return { ok: false, status: 404, headers: { get: () => '' }, json: async () => ({}), text: async () => '' };
};

const put = r => STORE.set(KEY, JSON.stringify(r));
const got = () => JSON.parse(STORE.get(KEY) || '{}');
const half = (extra = {}) => ({ at: '2026-09-07T12:00:00.000Z', slot: 'word', state: 'partial', title: 'Qalqalah',
  results: { facebook: { ok: true, id: 'FB' },
             instagram: { ok: false, error: 'Media could not be fetched', code: 9004,
                          tries: 1, lastTry: '2026-09-07T12:00:00.000Z', ...extra } } });
const LATER = '2026-09-07T14:00:00.000Z';

/* ------------------------------------------------------- what it must not do */
console.log('\nthe thing that must never happen');
{
  put(half()); sent = [];
  await SOC.healFailures('noorcodex.com', DATE, { ran: [] }, LATER);
  ok(!sent.includes('facebook'), 'healing never touches the network that already has the post');
  ok(sent.filter(x => x === 'ig-publish').length === 1, 'and publishes to the failed one exactly once');
}

console.log('\nit reads a half-sent slot as half sent');
{
  ok(SOC.slotState({ facebook: { ok: true }, instagram: { ok: false } }) === 'partial',
     'one landed and one did not is "partial", not "sent"');
  ok(SOC.slotState({ facebook: { ok: true }, instagram: { ok: true } }) === 'sent', 'both landed is sent');
  ok(SOC.slotState({ facebook: { ok: true }, instagram: { ok: false, pending: 'C' } }) === 'pending',
     'still transcoding is pending, not partial');
  ok(SOC.slotState({ facebook: { ok: true }, instagram: { ok: false, skipped: 'no token' } }) === 'sent',
     'a channel that was never asked did not fail');
  ok(SOC.slotState({ facebook: { ok: true }, reddit: { ok: false } }) === 'sent',
     'a Reddit draft still never decides the state');
}

console.log('\nit heals, and says so');
{
  put(half()); sent = [];
  const ran = await SOC.healFailures('noorcodex.com', DATE, { ran: [] }, LATER);
  const rec = got();
  ok(rec.results.instagram.ok === true, 'the missing half is posted');
  ok(rec.results.facebook.id === 'FB', 'the half that worked is untouched');
  ok(rec.state === 'sent', 'and the slot becomes properly sent');
  const line = ran.find(x => x.where === 'instagram');
  ok(line && line.healed === true && line.ok === true, 'the run reports what it healed');
}

/* --------------------------------------------------------------- bounded */
console.log('\nit knows when to stop');
{
  const old = { code: 9004, lastTry: '2026-09-07T01:00:00.000Z' };
  ok(SOC.healDue({ ...old, tries: 1 }, +new Date(LATER)), 'a first failure is retried');
  ok(SOC.healDue({ ...old, tries: 3 }, +new Date(LATER)), 'a third is still retried');
  ok(!SOC.healDue({ ...old, tries: 4 }, +new Date(LATER)), 'a fifth attempt is not made');
  ok(!SOC.healDue({ code: 9004, tries: 2, lastTry: LATER }, +new Date(LATER) + 60000),
     'and it waits between tries rather than hammering');
  ok(SOC.healDue({ code: 9004, tries: 2, lastTry: LATER }, +new Date(LATER) + 3600000),
     'once the wait has passed, it goes again');

  put(half({ tries: 4 })); sent = [];
  await SOC.healFailures('noorcodex.com', DATE, { ran: [] }, LATER);
  ok(sent.length === 0, 'a slot that has had its four goes is left alone entirely');
}

/* ------------------------------------------------ what a retry cannot fix */
console.log('\nwhat it refuses to keep retrying');
{
  ok(!SOC.healable({ ok: false, code: 190 }), "an expired token is a person's job, not a retry's");
  ok(!SOC.healable({ ok: false, code: 200 }), 'and so is a missing permission');
  ok(!SOC.healable({ ok: false, fatal: true, error: 'needs an image' }), 'nothing to send is not retried');
  ok(!SOC.healable({ ok: false, skipped: 'no token set' }), 'a channel never asked is not a failure');
  ok(!SOC.healable({ ok: true, id: 'X' }), 'and a success is obviously not healed');
  ok(SOC.healable({ ok: false, code: 9004 }), 'a card Meta could not fetch IS retried');
  ok(SOC.healable({ ok: false, code: 4 }), 'so is a rate limit');
  ok(SOC.healable({ ok: false, error: 'socket hang up' }), 'and so is a failure with no code at all');

  put(half({ code: 190, error: 'Invalid OAuth access token' })); sent = [];
  await SOC.healFailures('noorcodex.com', DATE, { ran: [] }, LATER);
  ok(sent.length === 0, 'a token failure is not hammered every hour');
  ok(got().results.instagram.code === 190, 'it is left exactly as it was, for a human to read');
}

/* ------------------------------------------- the immediate second attempt */
console.log('\none more go, immediately');
{
  STORE.delete(KEY); sent = []; let n = 0;
  igFails = () => (++n === 1)
    ? { ok: false, status: 400, headers: { get: () => '' },
        json: async () => ({ error: { message: 'Media could not be fetched', code: 9004 } }), text: async () => '' }
    : null;
  /* first call fails, second succeeds */
  const realIg = igFails;
  igFails = () => { const r = realIg(); return r || { ok: true, json: async () => ({ id: 'CONT' }), text: async () => '' }; };
  const r = await SOC.sendSlot('noorcodex.com', DATE, 'word', CTX);
  igFails = null;
  ok(sent.filter(x => x === 'ig-container').length === 2, 'a fetch failure is tried again three seconds later');
  ok(r.results.instagram.ok === true, 'so the post lands on time rather than an hour late');
  ok(sent.filter(x => x === 'facebook').length === 1, 'and Facebook is still only posted once');
}

/* ------------------------------------------------------- the run wires it */
console.log('\nevery run does this');
{
  put(half()); sent = [];
  const out = await SOC.runDue('noorcodex.com', DATE, new Date(LATER), { force: true, cap: 0 });
  ok((out.ran || []).some(x => x.healed && x.ok), 'the hourly run heals, and the heal lands');
  ok(!sent.includes('facebook'), 'and still never re-posts to a network that has it');
}

globalThis.fetch = realFetch;
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
