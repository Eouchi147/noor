/* A reel leaves the shelf once every network has it.

   The owner's rule of 9 September 2026. The poster keeps a ledger of the
   reels whose whole slot went out (reel id to date), answers it in public at
   /api/social?action=posted with a margin of a few days, and the weekly
   render run drops those cards from the plan; the shelf then lets their
   files go by a rule it already had. These tests are the ledger's promises:
   what counts as done, what is written, what the public read shows and
   hides, and that no key is needed to read it. */
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const STORE = new Map();
const HASH = new Map();
process.env.KV_REST_API_URL = 'https://kv.test';
process.env.KV_REST_API_TOKEN = 't';
process.env.ADMIN_SECRET = 'secret-for-tests-0000000000';
process.env.FB_PAGE_ID = '123'; process.env.FB_PAGE_TOKEN = 'tok';
process.env.IG_USER_ID = '456';
process.env.POSTED_GRACE_DAYS = '3';

const MAN = { n: 2, cards: [
  { id: 'verse-2-152', kind: 'verse', hook: 'So remember Me', caption: 'c', video: 'https://github.com/Eouchi147/noor/releases/download/reels-verse/verse-2-152.mp4' },
  { id: 'word-sabr', kind: 'word', slot: 'evening', hook: 'Sabr', caption: 'c' }
] };
let net = [], containers = 0, storyReady = false, igRefuses = false;
globalThis.fetch = async (url, opt) => {
  url = String(url);
  if (url.startsWith('https://kv.test')) {
    const cmds = JSON.parse(opt.body);
    return { ok: true, status: 200, json: async () => cmds.map(c => {
      const [v, k, ...r] = c;
      if (v === 'GET') return { result: STORE.has(k) ? STORE.get(k) : null };
      if (v === 'SET') { STORE.set(k, r[0]); return { result: 'OK' }; }
      if (v === 'LPUSH') { const l = STORE.get(k) || []; l.unshift(r[0]); STORE.set(k, l); return { result: l.length }; }
      if (v === 'LRANGE') { const l = STORE.get(k) || []; return { result: l.slice(0, +r[1] + 1) }; }
      if (v === 'LTRIM') { const l = STORE.get(k) || []; STORE.set(k, l.slice(0, +r[1] + 1)); return { result: 'OK' }; }
      if (v === 'HSET') { const h = HASH.get(k) || new Map(); h.set(r[0], r[1]); HASH.set(k, h); return { result: 1 }; }
      if (v === 'HDEL') { const h = HASH.get(k) || new Map(); const had = h.delete(r[0]) ? 1 : 0; return { result: had }; }
      if (v === 'HGETALL') { const h = HASH.get(k) || new Map(); return { result: [...h.entries()].flat() }; }
      return { result: null };
    }) };
  }
  if (url.endsWith('/reels/index.json')) return { ok: true, status: 200, json: async () => MAN };
  if (url.endsWith('/assets/menu-index.json')) return { ok: true, status: 200, json: async () => ({ words: [], path: [] }) };
  if (/releases\/download\//.test(url) && opt && opt.method === 'HEAD')
    return { ok: false, status: 302, headers: { get: h => (h === 'location' ? 'https://release-assets.githubusercontent.com/signed' : null) } };
  if (url.includes('graph.facebook.com') || url.includes('graph.instagram.com')) {
    net.push(url);
    if (igRefuses && url.includes('graph.facebook.com/v') && /\/456\//.test(url))
      return { ok: false, status: 400, json: async () => ({ error: { message: 'Instagram refused' } }) };
    if (/\/media(\?|$)/.test(url) || /\/video_reels/.test(url) && !/upload_phase=finish/.test(url))
      return { ok: true, status: 200, json: async () => ({ id: 'container_' + (++containers), video_id: 'v_1', upload_url: 'https://rupload.facebook.com/x' }) };
    /* Instagram's containers are the third and fourth handed out (Facebook's
       two reel phases come first): the reel's is ready at once, the story's
       only when the test says so */
    if (/status_code/.test(url)) {
      const story = /container_4/.test(url) && !storyReady;
      return { ok: true, status: 200, json: async () => ({ status_code: story ? 'IN_PROGRESS' : 'FINISHED', status: { video_status: 'ready' } }) };
    }
    return { ok: true, status: 200, json: async () => ({ id: 'posted_1', post_id: 'p_1', success: true }) };
  }
  if (url.includes('rupload.facebook.com')) return { ok: true, status: 200, json: async () => ({ success: true }) };
  if (/\/api\/card\?/.test(url) || /-cover\.jpg$/.test(url)) return { ok: true, status: 200, headers: { get: h => (h === 'content-type' ? 'image/jpeg' : '360000') } };
  throw new Error('unexpected fetch ' + url);
};

const S = await import('../api/social.js');
const H = S.default;

function res() {
  const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.end = b => { r.body = b; return r; };
  return r;
}
const call = async req => { const r = res(); await H({ method: 'GET', headers: {}, query: {}, ...req }, r); return r; };
const today = new Date().toISOString().slice(0, 10);
const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

console.log('\n=== 1. what "every network has it" means ===');
{
  const sent = { reel: 'verse-2-152', state: 'sent', results: { facebook: { ok: true }, instagram: { ok: true } } };
  ok(S.reelDone(sent) === true, 'a sent reel with every network answering yes is done');
  ok(S.reelDone({ ...sent, state: 'partial' }) === false, 'a half sent reel is not: one network refused');
  ok(S.reelDone({ ...sent, state: 'pending' }) === false, 'nor one a network is still processing');
  ok(S.reelDone({ ...sent, state: 'failed' }) === false, 'nor one that failed everywhere');
  ok(S.reelDone({ ...sent, results: { facebook: { ok: true }, instagram: { ok: true, story: { pending: 'c9' } } } }) === false,
     'nor one whose video story is still in a network\'s hands');
  ok(S.reelDone({ state: 'sent', results: { facebook: { ok: true } } }) === false, 'a card (no reel id) is never on the ledger');
  ok(S.reelDone(null) === false && S.reelDone({}) === false, 'and nothing breaks on an empty record');
}

console.log('\n=== 2. the ledger is read with a margin ===');
{
  HASH.clear();
  const h = new Map([['verse-1', daysAgo(10)], ['word-2', daysAgo(3)], ['know-3', daysAgo(2)], ['light-4', today], ['bad-5', 'not a date']]);
  HASH.set('nsoc:reels:posted', h);
  const p = await S.postedReels(today);
  ok(p['verse-1'] === daysAgo(10), 'a reel posted ten days ago is on it');
  ok(p['word-2'] === daysAgo(3), 'and one posted exactly three days ago');
  ok(!('know-3' in p) && !('light-4' in p), 'not the last two days: a story may still be pending, the healer still at work');
  ok(!('bad-5' in p), 'a row without a date is ignored');
  const all = await S.postedReels(today, 0);
  ok(Object.keys(all).length === 4, 'with no margin everything dated is on it (' + Object.keys(all).length + ')');
  const obj = await (async () => { HASH.set('nsoc:reels:posted', new Map([['verse-9', daysAgo(30)]])); return S.postedReels(today); })();
  ok(obj['verse-9'] === daysAgo(30), 'a flat list from the store is read as pairs');
}

console.log('\n=== 3. the public read needs no key, and nothing else does ===');
{
  HASH.clear();
  HASH.set('nsoc:reels:posted', new Map([['verse-1', daysAgo(10)], ['light-4', today]]));
  const r = await call({ query: { action: 'posted' } });
  ok(r.code === 200 && r.body && r.body.ok === true, 'GET ?action=posted answers 200 with no cookie and no secret (got ' + r.code + ')');
  ok(r.body && r.body.posted && r.body.posted['verse-1'] && !r.body.posted['light-4'], 'it lists the retirable reel and hides today\'s');
  ok(r.body && r.body.n === 1 && r.body.grace_days === 3, 'with the count and the margin named');
  ok(/public/.test(String(r.headers['Cache-Control'])), 'and it may be cached (' + r.headers['Cache-Control'] + ')');
  const keys = Object.keys(r.body.posted).concat(Object.values(r.body.posted)).join(' ');
  ok(!/token|secret|@/.test(keys), 'it carries ids and dates, nothing else');
  for (const action of ['dials', 'log', 'plan', 'tokens', 'due']) {
    const x = await call({ query: { action } });
    ok(x.code === 401, 'an anonymous GET to \'' + action + '\' is still refused');
  }
  const post = await call({ method: 'POST', query: { action: 'posted' }, body: {} });
  ok(post.code === 401, 'a POST with action=posted is refused: the door is a read');
}

console.log('\n=== 4. a reel that goes out lands on the ledger; a card does not ===');
{
  STORE.clear(); HASH.clear(); net = [];
  STORE.set('nb:settings', JSON.stringify({ mode: 'auto', polish: false, fb: true, ig: true, stories: false, 'social.stories': false }));
  /* Thursday 2026-09-10 at 08 UTC asks for a verse */
  const r = await S.sendSlot('noorcodex.com', '2026-09-10', 'reelA', { force: true });
  ok(r.ok === true && r.state === 'sent', 'the reel went out (' + r.state + (r.error ? ': ' + r.error : '') + ')');
  const rec = await S.readSlot('2026-09-10', 'reelA');
  ok(rec && rec.reel === 'verse-2-152' && rec.kind === 'verse', 'the record names the card (' + (rec && rec.reel) + ')');
  const h = HASH.get('nsoc:reels:posted');
  ok(h && h.get('verse-2-152') === '2026-09-10', 'and the ledger has it, dated the day it went');
  const p = await S.postedReels('2026-09-20');
  ok(p['verse-2-152'] === '2026-09-10', 'ten days on, the render run may retire it');
  const p2 = await S.postedReels('2026-09-11');
  ok(!('verse-2-152' in p2), 'the morning after, not yet');
}

console.log('\n=== 5. a half sent reel waits for the healer ===');
{
  STORE.clear(); HASH.clear(); net = [];
  const rec = { at: new Date().toISOString(), slot: 'reelA', state: 'partial', title: 't', reel: 'word-sabr', kind: 'word',
    results: { facebook: { ok: true }, instagram: { ok: false, error: 'no' } } };
  STORE.set('nsoc:slot:2026-09-10#reelA', JSON.stringify(rec));
  STORE.set('nb:settings', JSON.stringify({ mode: 'auto', polish: false, fb: true, ig: true, 'social.stories': false }));
  /* the healer asks Instagram again and Instagram refuses again: the record
     is written through the same door and the ledger stays empty */
  igRefuses = true;
  const composed = await S.composeSlot('noorcodex.com', '2026-09-10', 'reelA', {});
  STORE.set('nsoc:slot:2026-09-10#reelA', JSON.stringify({ ...rec, title: composed.title, reel: composed.key }));
  const again = await S.retryChannel('noorcodex.com', '2026-09-10', 'reelA', 'instagram', {});
  igRefuses = false;
  ok(again.ok === false && again.state === 'partial', 'Instagram refused the retry and the slot is still half sent (' + again.state + ')');
  ok(!(HASH.get('nsoc:reels:posted') || new Map()).size, 'nothing on the ledger while Instagram has refused');
  STORE.set('nsoc:slot:2026-09-10#reelA', JSON.stringify(rec));
  /* the healer mends it: the record is written again as sent, through the same door */
  const mended = { ...rec, state: 'sent', results: { facebook: { ok: true }, instagram: { ok: true, id: 'x' } } };
  /* writeSlot is not exported; retryChannel is the path that writes it, but it
     asks the network. The finisher walks the same door: a pending container
     that finishes writes the record as sent. */
  STORE.set('nsoc:slot:2026-09-10#reelA', JSON.stringify({ ...rec, state: 'pending',
    results: { facebook: { ok: true }, instagram: { ok: false, pending: 'container_1' } } }));
  await S.finishPendingReels('2026-09-10', { ran: [] });
  const after = await S.readSlot('2026-09-10', 'reelA');
  ok(after && after.state === 'sent', 'the finisher published the container and the slot reads sent');
  const h = HASH.get('nsoc:reels:posted');
  ok(h && h.get('word-sabr') === '2026-09-10', 'and only then is the reel on the ledger');
  void mended;
}

console.log('\n=== 5c. a video story still in a network\'s hands holds the reel back ===');
{
  STORE.clear(); HASH.clear(); net = []; containers = 0; storyReady = false;
  STORE.set('nb:settings', JSON.stringify({ mode: 'auto', polish: false, fb: true, ig: true, 'social.stories': true }));
  const r = await S.sendSlot('noorcodex.com', '2026-09-10', 'reelA', { force: true });
  const rec = await S.readSlot('2026-09-10', 'reelA');
  ok(r.ok === true && rec && rec.state === 'sent', 'the reel went out to both networks (' + (rec && rec.state) + ')');
  ok(rec && rec.results.instagram.story && rec.results.instagram.story.pending, 'Instagram is still processing the video story');
  ok(!(HASH.get('nsoc:reels:posted') || new Map()).has('verse-2-152'), 'so the reel is not on the ledger yet: the story needs the file');
  storyReady = true;
  await S.finishPendingReels('2026-09-10', { ran: [] });
  const after = await S.readSlot('2026-09-10', 'reelA');
  ok(after && after.results.instagram.story && after.results.instagram.story.ok, 'the finisher published the story on the next run');
  ok((HASH.get('nsoc:reels:posted') || new Map()).get('verse-2-152') === '2026-09-10', 'and now the reel is on the ledger');
}

console.log('\n=== 5b. the record keeps the reel\'s name through a retry ===');
{
  STORE.clear(); HASH.clear(); net = [];
  STORE.set('nb:settings', JSON.stringify({ mode: 'auto', polish: false, fb: true, ig: true, 'social.stories': false }));
  const composed = await S.composeSlot('noorcodex.com', '2026-09-10', 'reelA', {});
  ok(composed && composed.reel && composed.key === 'verse-2-152', 'Thursday morning composes the verse (' + (composed && composed.key) + ')');
  /* Facebook took it, Instagram refused: the record is half sent and named */
  STORE.set('nsoc:slot:2026-09-10#reelA', JSON.stringify({ at: new Date().toISOString(), slot: 'reelA', state: 'partial',
    title: composed.title, lvl: 'editorial', reel: 'verse-2-152', kind: 'verse',
    results: { facebook: { ok: true, id: 'F1' }, instagram: { ok: false, error: 'refused', err: 'refused' } } }));
  ok(!HASH.get('nsoc:reels:posted'), 'half sent: not on the ledger');
  const r = await S.retryChannel('noorcodex.com', '2026-09-10', 'reelA', 'instagram', {});
  ok(r.ok === true && r.state === 'sent', 'the retry mends Instagram and the slot reads sent (' + r.state + (r.error ? ': ' + r.error : '') + ')');
  const rec = await S.readSlot('2026-09-10', 'reelA');
  ok(rec && rec.reel === 'verse-2-152' && rec.kind === 'verse', 'the record still names the reel after the retry');
  const h = HASH.get('nsoc:reels:posted');
  ok(h && h.get('verse-2-152') === '2026-09-10', 'and the ledger has it now, and not before');
}

console.log('\n=== 6. the plan builder and the workflow carry it ===');
{
  const pb = fs.readFileSync('tools/reels/plan_build.py', 'utf8');
  ok(/RETIRE = \{"verse", "word", "know", "light"\}/.test(pb), 'four kinds retire; This day, the Names and the du\'as stay');
  ok(/def retire\(cards\)/.test(pb) && /posted\.json/.test(pb), 'plan_build reads posted.json and retires');
  ok(fs.existsSync('tools/reels/posted_fetch.py'), 'posted_fetch.py copies the ledger beside the plan');
  const pf = fs.readFileSync('tools/reels/posted_fetch.py', 'utf8');
  ok(/kept as it was/.test(pf), 'and keeps the old file when the site cannot be read');
  const wf = fs.readFileSync('.github/workflows/reels.yml', 'utf8');
  ok(/posted_fetch\.py/.test(wf), 'the plan job runs it before the plan');
  ok((wf.match(/tools\/reels\/posted\.json/g) || []).length >= 2, 'posted.json travels with the plan and rides in the pull request');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
