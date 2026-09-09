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
  /* cardsFeed: true pins the feed-era behaviour these promises are about;
     with the dial off (the shipped state since 9 September 2026) a card is a
     story only, which tests/cards-stories.mjs holds */
  plan: { hijri: { text: '' }, day: {}, leads: [] },
  index: { words: [{ i: 1, t: 'Qalqalah', a: 'قلقلة', s: 'a bounce in the sound' }], path: [] },
  extras: { entry: { s: 'a bounce in the sound', l: '', cat: 'Tajwid', k: 'editorial' } },
  dials: { polish: false, mode: 'auto', storeOk: true, stories: false, cardsFeed: true }
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


/* ==========================================================================
   THE REGRESSION THIS FILE EXISTS FOR

   The first cut of the healer ran BEFORE the posting loop. It walked two days
   of slots, composed each repair, waited up to twelve seconds on a card fetch
   and three more between Instagram attempts -- inside a function given sixty
   seconds in total. On a day with something to repair it spent the whole
   budget in the net and never reached the posting loop, and a 12:00 card was
   marked "owed" on a day the machine was working perfectly.

   The safety net took down the thing it was there to protect. So what is held
   here is the ordering: the scheduled post owns the clock, and no failure,
   exception or hang in the tidying can cost a post.
   ========================================================================== */
console.log('\nthe post comes first, whatever else happens');
{
  /* a slot that is owed, and a previous day full of things to repair */
  STORE.clear(); sent = [];
  STORE.set('nsoc:slot:2026-09-06#word', JSON.stringify(half()));
  STORE.set('nsoc:slot:2026-09-06#dawn', JSON.stringify(half()));
  STORE.set('nsoc:slot:2026-09-06#dusk', JSON.stringify(half()));

  const out = await SOC.runDue('noorcodex.com', DATE, new Date(LATER), { force: true });
  const posted = (out.ran || []).filter(x => x.state && !x.healed);
  ok(posted.length >= 1, 'the owed slot is posted even with repairs waiting');
  const iPost = (out.ran || []).findIndex(x => x.state && !x.healed);
  const iHeal = (out.ran || []).findIndex(x => x.healed);
  ok(iHeal === -1 || iPost < iHeal, 'and it is posted BEFORE anything is repaired');
}

console.log('\nthe net cannot take down what it protects');
{
  STORE.clear(); sent = [];
  STORE.set('nsoc:slot:2026-09-06#word', JSON.stringify(half()));
  /* the healer explodes */
  const realHeal = SOC.healFailures;
  const kvBroken = () => { throw new Error('KV fell over mid-heal'); };
  /* simulate by making the card fetch throw only during the tidy-up phase */
  let posting = true;
  const good = globalThis.fetch;
  globalThis.fetch = async (u, o) => {
    if (!posting && String(u).includes('/api/card')) throw new Error('boom');
    return good(u, o);
  };
  const out = await SOC.runDue('noorcodex.com', DATE, new Date(LATER), { force: true });
  globalThis.fetch = good;
  ok((out.ran || []).some(x => x.state && !x.healed), 'a run still posts when the tidying throws');
  ok(!!out && typeof out === 'object', 'and the run returns rather than dying');
}

console.log('\nit is bounded so it can never eat the hour');
{
  STORE.clear(); sent = [];
  for (const id of ['dawn', 'word', 'dusk', 'light']) {
    STORE.set('nsoc:slot:2026-09-06#' + id, JSON.stringify(half()));
    STORE.set('nsoc:slot:' + DATE + '#' + id, JSON.stringify(half()));
  }
  const ran = await SOC.healFailures('noorcodex.com', DATE, { ran: [] }, LATER, () => true);
  ok(ran.filter(x => x.healed).length <= 2, 'at most two repairs in one run, however many are owed');

  const none = await SOC.healFailures('noorcodex.com', DATE, { ran: [] }, LATER, () => false);
  ok(none.filter(x => x.healed).length === 0, 'and none at all when the run has no time left');
}

/* ==========================================================================
   FOUND ON REVIEW, BEFORE SHIPPING
   ========================================================================== */
console.log('\nPost now cannot be used to double-post a half-sent slot');
{
  put(half());
  const r = await SOC.sendSlot('noorcodex.com', DATE, 'word', CTX);
  ok(r.ok === false && /half sent/.test(r.error), 'send-slot on a partial slot is refused, with the reason');
  ok(sent.length === 0 || !sent.includes('facebook'), 'and nothing reaches the network that has it');
}

console.log('\na retry sends the SAME card the other network has');
{
  /* the record says one title went out; the slot rebuilds as another */
  put({ ...half(), title: 'A different card entirely' }); sent = [];
  const r = await SOC.retryChannel('noorcodex.com', DATE, 'word', 'instagram', CTX);
  ok(r.ok === false && r.drift === true, 'a slot that rebuilds as a different card is refused');
  ok(/different card/.test(r.error) && /Qalqalah/.test(r.error), 'and the reason names both cards');
  ok(!sent.includes('ig-publish'), 'so nothing mismatched is ever published');
  ok(r.fatal === true, 'and it is marked fatal, so the healer does not try it four times');
  ok(got().results.instagram.drift === true && got().results.instagram.fatal === true,
     'and it is written down, so the healer stops asking');
  ok(got().results.facebook.ok === true, 'without touching the half that went out');
  ok(!SOC.healable(got().results.instagram), 'the healer now leaves it alone');
}

console.log('\nattempts are counted from the first send');
{
  put(half({ tries: undefined, lastTry: undefined })); sent = [];
  /* a record from before counting existed: no tries stamped at all */
  const rec0 = got(); delete rec0.results.instagram.tries; delete rec0.results.instagram.lastTry; put(rec0);
  igFails = () => ({ ok: false, status: 400, headers: { get: () => '' },
    json: async () => ({ error: { message: 'still no', code: 9004 } }), text: async () => '' });
  await SOC.retryChannel('noorcodex.com', DATE, 'word', 'instagram', CTX);
  igFails = null;
  ok(got().results.instagram.tries === 2, 'the failed original send counts as the first attempt');
}

console.log('\na reel repair waits for room a card repair does not need');
{
  STORE.clear(); sent = [];
  STORE.set('nsoc:slot:' + DATE + '#reelA', JSON.stringify({ at: 'x', slot: 'reelA', state: 'partial', title: 'A reel',
    results: { facebook: { ok: true }, instagram: { ok: false, code: 9004, tries: 1, lastTry: '2026-09-07T01:00:00.000Z' } } }));
  /* room for a card (22s) but not for a reel (48s) */
  const tight = need => (need || 0) < 30000;
  const ran = await SOC.healFailures('noorcodex.com', DATE, { ran: [] }, LATER, tight);
  ok(!ran.some(x => x.slot === 'reelA'), 'a reel is not started when the run cannot finish it');
  const roomy = () => true;
  const ran2 = await SOC.healFailures('noorcodex.com', DATE, { ran: [] }, LATER, roomy);
  ok(ran2.some(x => x.slot === 'reelA'), 'but it is when there is time');
}

console.log('\none broken slot does not stop the others being healed');
{
  STORE.clear(); sent = [];
  STORE.set('nsoc:slot:' + DATE + '#dawn', 'this is not json {{{');
  STORE.set('nsoc:slot:' + DATE + '#word', JSON.stringify(half()));
  const ran = await SOC.healFailures('noorcodex.com', DATE, { ran: [] }, LATER, () => true);
  ok(ran.some(x => x.slot === 'word' && x.ok), 'a corrupt record is stepped over and the next slot still heals');
}

globalThis.fetch = realFetch;
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
