/* NOOR · one network at a time.
   ------------------------------------------------------------------
   Today's light went out on Facebook and did not go out on Instagram, and the
   only control the console offered was Post now -- which would have sent it to
   Facebook a second time. What is held here is the thing that makes a
   per-network button safe:

     a retry may never send to a network that already took the post.

   Everything else in this file exists to keep that true through the states a
   half-failed slot can actually be in. It also holds the asymmetry that made
   the failure look like an Instagram fault: Instagram REQUIRES an image and
   Facebook does not, so a card Meta cannot fetch takes out one network and
   leaves the other looking healthy.

   Meta is stubbed. This repository has no credentials and never will.

   Run:  node tests/retry.mjs
*/
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

process.env.FB_PAGE_ID = '123'; process.env.FB_PAGE_TOKEN = 'tok';
process.env.IG_USER_ID = '456'; process.env.IG_TOKEN = 'igtok';
process.env.KV_REST_API_URL = 'https://kv.test';
process.env.KV_REST_API_TOKEN = 't';

const SOC = await import('../api/social.js');

const DATE = '2026-09-04';
const KEY = 'nsoc:slot:' + DATE + '#word';
const STORE = new Map();
const realFetch = globalThis.fetch;

/* the offline scaffolding: enough for composeSlot('word') to build without a
   network, so the test is about the retry and not about the library */
const CTX = {
  plan: { hijri: { text: '' }, day: {}, leads: [] },
  index: { words: [{ i: 1, t: 'Qalqalah', a: 'قلقلة', s: 'a bounce in the sound' }], path: [] },
  extras: { entry: { s: 'a bounce in the sound', l: '', cat: 'Tajwid', k: 'editorial' } },
  dials: { polish: false, mode: 'auto', storeOk: true }
};

let sent = [];           /* every network call the senders actually made */
let cardOk = true;       /* whether the card image answers */
let igReply = null;      /* what Instagram says when asked to make a container */

function net() {
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
    if (u.includes('/api/card')) {
      return cardOk
        ? { ok: true, status: 200, headers: { get: h => h === 'content-type' ? 'image/png' : '40000' },
            json: async () => ({}), text: async () => '' }
        : { ok: false, status: 502, headers: { get: () => '' }, json: async () => ({}), text: async () => '' };
    }
    if (u.includes('/photos') || u.includes('/feed')) {
      sent.push('facebook');
      return { ok: true, json: async () => ({ id: 'FBPOST' }), text: async () => '' };
    }
    if (u.includes('/media_publish')) {
      sent.push('ig-publish');
      return { ok: true, json: async () => ({ id: 'IGPOST' }), text: async () => '' };
    }
    if (u.includes('/media')) {
      sent.push('ig-container');
      if (igReply) return igReply();
      return { ok: true, json: async () => ({ id: 'CONT' }), text: async () => '' };
    }
    return { ok: false, status: 404, headers: { get: () => '' }, json: async () => ({}), text: async () => '' };
  };
}

const put = rec => STORE.set(KEY, JSON.stringify(rec));
const got = () => JSON.parse(STORE.get(KEY) || '{}');
const HALF = () => ({ at: 'x', slot: 'word', state: 'sent', title: 'Qalqalah',
  results: { facebook: { ok: true, id: 'FBPOST' },
             instagram: { ok: false, error: 'Meta could not fetch the image', code: 9004 } } });

/* --------------------------------------------------- the double-post guard */
console.log('\nit may never send twice');
{
  net(); put(HALF()); sent = [];
  const r = await SOC.retryChannel('noorcodex.com', DATE, 'word', 'facebook', CTX);
  ok(r.ok === false && r.already === true, 'a network that already took the post is refused');
  ok(sent.length === 0, 'and nothing at all was sent');
  ok(got().results.facebook.id === 'FBPOST', 'its recorded id is untouched');
}

/* ------------------------------------------------------- the actual repair */
console.log('\nthe one that failed, and only that one');
{
  net(); put(HALF()); sent = [];
  const r = await SOC.retryChannel('noorcodex.com', DATE, 'word', 'instagram', CTX);
  ok(r.ok === true, 'the failed network is sent');
  ok(!sent.includes('facebook'), 'Facebook was not touched');
  ok(sent.includes('ig-container') && sent.includes('ig-publish'), 'Instagram got both of its calls');
  const rec = got();
  ok(rec.results.facebook.ok === true && rec.results.facebook.id === 'FBPOST',
     'the successful result is carried through, not rebuilt');
  ok(rec.results.instagram.ok === true && rec.results.instagram.id === 'IGPOST',
     'and the failed one is replaced by its success');
  ok(rec.state === 'sent', 'the slot state is recomputed from both');
  ok(rec.title === 'Qalqalah', 'the row still says what it said');
}

/* ------------------------------------------------------------ still failing */
console.log('\nwhen it fails again');
{
  net(); put(HALF()); sent = [];
  igReply = () => ({ ok: false, status: 400, headers: { get: () => '' },
    json: async () => ({ error: { message: 'Invalid OAuth access token', code: 190, error_subcode: 463 } }),
    text: async () => '' });
  const r = await SOC.retryChannel('noorcodex.com', DATE, 'word', 'instagram', CTX);
  igReply = null;
  ok(r.ok === false, 'it reports the failure rather than swallowing it');
  const ig = got().results.instagram;
  ok(ig.code === 190 && ig.sub === 463, "Meta's numeric code is kept, not just its sentence");
  ok(/Invalid OAuth/.test(ig.error), 'and its own words are kept verbatim');
  ok(got().results.facebook.ok === true, 'the network that worked is still recorded as working');
}

/* ---------------------------------------------------------- what it refuses */
console.log('\nwhat it will not do');
{
  net(); put(HALF());
  const a = await SOC.retryChannel('noorcodex.com', DATE, 'word', 'reddit', CTX);
  ok(a.ok === false, 'Reddit is a draft for a human and is never sent');
  const b = await SOC.retryChannel('noorcodex.com', DATE, 'nosuch', 'instagram', CTX);
  ok(b.ok === false && /no such slot/.test(b.error), 'an unknown slot is refused');
  const c = await SOC.retryChannel('noorcodex.com', DATE, 'word', 'myspace', CTX);
  ok(c.ok === false && /no such channel/.test(c.error), 'an unknown channel is refused');
}

/* --------------------------------------------- the asymmetry that caused it */
console.log('\na card Meta cannot fetch');
{
  net(); STORE.delete(KEY); sent = []; cardOk = false;
  const r = await SOC.sendSlot('noorcodex.com', DATE, 'word', CTX);
  cardOk = true;
  ok(!sent.includes('ig-container'), 'Instagram is not even attempted with an unreachable card');
  ok(sent.includes('facebook'), 'Facebook still goes, because its image is optional');
  ok(r.results.instagram.pre === true, 'and the record says the pre-flight stopped it');
  ok(/could not be fetched|answered 502/.test(r.results.instagram.error),
     'in words that name the card, not Instagram');
}

/* ------------------------------------------------------------ the diagnosis */
console.log('\nwhat it says is wrong');
{
  net();
  put({ at: 'x', slot: 'word', state: 'sent', title: 'Qalqalah',
    results: { facebook: { ok: true }, instagram: { ok: false, error: 'Invalid OAuth access token', code: 190 } } });
  const d = await SOC.diagnoseSlot('noorcodex.com', DATE, 'word', 'instagram', CTX);
  ok(/token/.test(d.cause), 'code 190 is read as the token');
  ok(d.fix === 'token' && d.steps.length >= 3, 'and it hands back steps rather than a shrug');
  ok(d.said === 'Invalid OAuth access token', "Meta's own sentence is quoted, not paraphrased");

  put({ at: 'x', slot: 'word', state: 'sent',
    results: { facebook: { ok: true }, instagram: { ok: false, error: 'Something went wrong', code: 1 } } });
  const u = await SOC.diagnoseSlot('noorcodex.com', DATE, 'word', 'instagram', CTX);
  ok(u.fix === 'retry', 'an unrecognised code with everything checking out points at a retry');
  ok(/no cause we can establish/.test(u.cause), 'and it says plainly that it does not know');
  ok(u.checks.some(c => c.name === 'the caption') && u.checks.some(c => c.name === 'the card image'),
     'the checks it ran are reported as facts');

  put({ at: 'x', slot: 'word', state: 'sent',
    results: { facebook: { ok: true }, instagram: { ok: true, id: 'IGPOST' } } });
  const g = await SOC.diagnoseSlot('noorcodex.com', DATE, 'word', 'instagram', CTX);
  ok(g.canRetry === false, 'a network that succeeded offers no retry at all');
}

globalThis.fetch = realFetch;
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
