/* NOOR · the clock, per network.
   ------------------------------------------------------------------
   Three hourly runs died at Vercel's sixty seconds with nothing on the
   record, because the send loop asked every network in turn and consulted
   the clock for none of them. A slot with no record is owed again the next
   hour, and whatever had landed is sent twice.

   Held here: a network that does not answer within what is left of the run
   is recorded as late; the record is written with the other networks'
   answers intact; the slot reads partial, not owed; and the late network
   is the one healFailures asks again, alone.

   Run:  node tests/clock.mjs
*/
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
process.env.FB_PAGE_ID = '123'; process.env.FB_PAGE_TOKEN = 'tok';
process.env.IG_USER_ID = '456'; process.env.IG_TOKEN = 'igtok';
process.env.KV_REST_API_URL = 'https://kv.test';
process.env.KV_REST_API_TOKEN = 't';
/* a run of one second, a reserve of a quarter of it, a network allowed a
   tenth: the shape of the real numbers, at test speed */
process.env.RUN_BUDGET_MS = '1000';
process.env.WRITE_RESERVE_MS = '250';
process.env.CHANNEL_MIN_MS = '100';
/* an Instagram reel polls fast here, with a budget larger than the run, and
   hands back its container once the run has less than this much left */
process.env.IG_POLL_EVERY_MS = '20'; process.env.IG_POLL_BUDGET_MS = '5000'; process.env.IG_POLL_FLOOR_MS = '600';
const SOC = await import('../api/social.js');
const DATE = '2026-09-07';
const KEY = 'nsoc:slot:' + DATE + '#word';
const STORE = new Map();
let sent = [], igDelay = 0, reelMode = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CTX = {
  plan: { hijri: { text: '' }, day: {}, leads: [] },
  index: { words: [{ i: 1, t: 'Qalqalah', a: 'قلقلة', s: 'a bounce in the sound' }], path: [] },
  extras: { entry: { s: 'a bounce in the sound', l: '', cat: 'Tajwid', k: 'editorial' } },
  /* cardsFeed: true pins the feed path this promise (the clock per network)
     was written against; the story-only card of the shipped state is held in
     tests/cards-stories.mjs, on the same clock */
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
  if (u.includes('/api/card') || u.includes('-cover.jpg')) return { ok: true, status: 200, headers: { get: h => h === 'content-type' ? 'image/png' : '40000' }, json: async () => ({}), text: async () => '' };
  /* a reel on Facebook, in its three phases, quickly */
  if (u.includes('/video_reels')) { sent.push('fb-reel'); return { ok: true, json: async () => ({ video_id: 'VID', upload_url: 'https://rupload/x' }), text: async () => '' }; }
  if (u.includes('rupload')) return { ok: true, json: async () => ({ success: true }), text: async () => '' };
  if (u.includes('?fields=access_token')) return { ok: true, json: async () => ({ access_token: 'page' }), text: async () => '' };
  if (reelMode && u.includes('CONT') && u.includes('status_code')) return { ok: true, json: async () => ({ status_code: 'IN_PROGRESS' }), text: async () => '' };
  if (u.includes('/photos') || u.includes('/feed')) { sent.push('facebook'); return { ok: true, json: async () => ({ id: 'FB' }), text: async () => '' }; }
  if (u.includes('/media_publish')) { sent.push('ig-publish'); return { ok: true, json: async () => ({ id: 'IGPOST' }), text: async () => '' }; }
  if (u.includes('/media')) {
    sent.push('ig-container');
    if (igDelay) await sleep(igDelay);
    return { ok: true, json: async () => ({ id: 'CONT' }), text: async () => '' };
  }
  return { ok: false, status: 404, headers: { get: () => '' }, json: async () => ({}), text: async () => '' };
};
const got = () => JSON.parse(STORE.get(KEY) || '{}');

console.log('\na network that answers in time is unchanged');
{
  STORE.clear(); sent = []; igDelay = 0;
  const r = await SOC.sendSlot('noorcodex.com', DATE, 'word', CTX);
  const rec = got();
  ok(r.ok && rec.state === 'sent', 'both land, the slot is sent: ' + rec.state);
  ok(typeof rec.results.facebook.ms === 'number' && typeof rec.results.instagram.ms === 'number', 'each answer carries how long it took, for the log');
  ok(!rec.results.instagram.late, 'and nothing is called late');
}

console.log('\na network that does not answer in time');
{
  STORE.clear(); sent = []; igDelay = 3000;      /* longer than the whole run */
  const t0 = Date.now();
  const r = await SOC.sendSlot('noorcodex.com', DATE, 'word', CTX);
  const took = Date.now() - t0;
  const rec = got();
  ok(took < 1500, 'the send returns inside the run, not when Instagram feels like it: ' + took + 'ms');
  ok(rec.state === 'partial', 'the slot reads partial, not owed: ' + rec.state);
  ok(rec.results.facebook.ok === true && rec.results.facebook.id === 'FB', 'what landed is on the record');
  ok(rec.results.instagram.ok === false && rec.results.instagram.late === true && rec.results.instagram.cut === true,
     'the slow one is recorded as late, cut by the clock');
  ok(/retried next hour/.test(rec.results.instagram.error), 'in words that say what happens next: ' + rec.results.instagram.error);
  ok(!sent.includes('ig-publish'), 'and was never published in this run');
  ok(r.ok === true && r.state === 'partial', 'the caller is told the truth');
}

console.log('\na run with no room left asks nothing more');
{
  STORE.clear(); sent = []; igDelay = 0;
  /* the clock already spent: what is left is under the reserve */
  const spent = () => 200;
  const r = await SOC.sendSlot('noorcodex.com', DATE, 'word', { ...CTX, left: spent });
  const rec = got();
  ok(rec.results.facebook.late === true && rec.results.instagram.late === true && !rec.results.facebook.cut,
     'every network is recorded as late without being asked: ' + JSON.stringify(Object.keys(rec.results)));
  ok(!sent.length, 'nothing was sent');
  ok(rec.state === 'failed' || rec.state === 'partial', 'and the slot is not left owed: ' + rec.state);
}

console.log('\na reel Instagram is still transcoding when the run gets short');
{
  STORE.clear(); sent = []; igDelay = 0; reelMode = true;
  const REEL = { id: 'al-sufi-andromeda-964', slot: 'morning', hook: 'A little cloud in his star book was another galaxy',
    caption: 'Al-Sufi drew each constellation twice.\n\nRead the whole thing free at noorcodex.com\n\n#Islam #NoorCodexOfLight',
    video: 'https://noorcodex.com/reels/al-sufi-andromeda-964.mp4', cover: 'https://noorcodex.com/reels/al-sufi-andromeda-964-cover.jpg' };
  const t0 = Date.now();
  const r = await SOC.sendSlot('noorcodex.com', DATE, 'reelA', { ...CTX, extras: { reel: REEL } });
  const took = Date.now() - t0;
  const rec = JSON.parse(STORE.get('nsoc:slot:' + DATE + '#reelA') || '{}');
  const ig = rec.results && rec.results.instagram;
  ok(took < 1500, 'the send returns inside the run: ' + took + 'ms');
  ok(ig && ig.pending === 'CONT' && !ig.late, 'Instagram stops polling when the run has ' + process.env.IG_POLL_FLOOR_MS + 'ms left and hands back its container as pending, not late: ' + JSON.stringify({ pending: ig && ig.pending, late: ig && ig.late, ms: ig && ig.ms }));
  ok(rec.state === 'pending', 'the slot reads pending, so the next hour publishes that container rather than making a new one: ' + rec.state);
  ok(rec.results.facebook.ok === true && rec.results.facebook.id === 'VID', 'Facebook, asked first, is on the record');
  reelMode = false;
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
