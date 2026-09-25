/* NOOR · the Observatory, with the store stubbed and no network reached.
   ---------------------------------------------------------------------------
   api/observatory.js composes one JSON from what the store already holds:
   the daily snapshots (nsoc:stats:<date>#<slot>), the slot records
   (nsoc:slot:<date>#<slot>), the duplicate guard's own hash, and the
   Content Graph's shipped files. This proves the composition on fixed
   records, that a day with nothing recorded reads null and not zero, that
   the 5-post floor is respected, that the weekday by hour matrix has the
   shape a heatmap needs, and that the owner gate refuses without the
   cookie -- all without a real Redis or a real network.

   Run:  node tests/observatory.mjs
*/
import crypto from 'node:crypto';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

process.env.ADMIN_SECRET = 'test-secret-observatory';
process.env.KV_REST_API_URL = 'https://kv.observatory.test';
process.env.KV_REST_API_TOKEN = 't';

/* a Redis in two Maps (strings, and hashes), spoken the way Upstash's REST
   pipeline speaks it -- the same shape tests/insights.mjs already stubs,
   widened here with HGETALL, HSET and a prefix-only KEYS, since visitors.js
   and social.js's postedChannelCounts both need them and observatory.js
   calls both. */
const store = new Map();
const hashes = new Map();
function pipeline(cmds) {
  return cmds.map(c => {
    const [op, ...a] = c;
    if (op === 'GET') return { result: store.has(a[0]) ? store.get(a[0]) : null };
    if (op === 'SET') { store.set(a[0], a[1]); return { result: 'OK' }; }
    if (op === 'MGET') return { result: a.map(k => store.has(k) ? store.get(k) : null) };
    if (op === 'DEL') { a.forEach(k => store.delete(k)); return { result: 1 }; }
    if (op === 'HSET') { const h = hashes.get(a[0]) || new Map(); for (let i = 1; i + 1 < a.length; i += 2) h.set(a[i], a[i + 1]); hashes.set(a[0], h); return { result: 1 }; }
    if (op === 'HGETALL') { const h = hashes.get(a[0]); const flat = []; if (h) for (const [k, v] of h) flat.push(k, v); return { result: flat }; }
    if (op === 'KEYS') { const prefix = String(a[0] || '').replace(/\*$/, ''); return { result: [...store.keys()].filter(k => k.startsWith(prefix)) }; }
    if (op === 'LRANGE') return { result: [] };
    if (op === 'LPUSH' || op === 'LTRIM' || op === 'EXPIRE' || op === 'LREM' || op === 'HDEL') return { result: 1 };
    return { result: null };
  });
}
globalThis.fetch = async (url, opt) => {
  const u = String(url);
  if (u.startsWith('https://kv.observatory.test')) {
    const body = JSON.parse(opt.body);
    return { ok: true, status: 200, json: async () => pipeline(body) };
  }
  throw new Error('unexpected network call in a test that promises none: ' + u);
};

const OBS = await import('../api/observatory.js');
const INS = await import('../api/_insights.js');
const { SLOT_IDS } = await import('../api/_schedule.js');

const NOW = '2026-09-24T12:00:00Z';
const dates = INS.datesBack(30, new Date(NOW));   /* dates[0] today, ascending age */

function putStats(i, slot, kind, hour, title, stats) {
  store.set(INS.K_STATS(dates[i], slot), JSON.stringify({ date: dates[i], slot, hour, kind, reel: /^reel/.test(slot), title, at: NOW, stats }));
}
function putSlot(i, slot, rec) {
  store.set('nsoc:slot:' + dates[i] + '#' + slot, JSON.stringify({ date: dates[i], slot, ...rec }));
}

console.log('the owner gate: no secret, no cookie, the right cookie');
{
  const savedSecret = process.env.ADMIN_SECRET;
  delete process.env.ADMIN_SECRET;
  let out;
  const res501 = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await OBS.default({ method: 'GET', query: {}, headers: {} }, res501);
  ok(res501.statusCode === 501, 'no ADMIN_SECRET at all answers 501, not a guess dressed as a fact');
  process.env.ADMIN_SECRET = savedSecret;

  const res401 = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await OBS.default({ method: 'GET', query: {}, headers: {} }, res401);
  ok(res401.statusCode === 401, 'a secret is set but no cookie rides with the request: locked');

  const exp = Date.now() + 100000;
  const sig = crypto.createHmac('sha256', process.env.ADMIN_SECRET).update(String(exp)).digest('hex');
  const cookie = 'noor_admin=' + exp + '.' + sig;
  const res200 = { statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await OBS.default({ method: 'GET', query: {}, headers: { cookie } }, res200);
  ok(res200.statusCode === 200 && res200.body && res200.body.ok !== false, 'the console\'s own signed cookie is let through: ' + JSON.stringify(res200.body && res200.body.error || 'ok'));
  ok(res200.headers['Cache-Control'] === 'no-store', 'an owner answer is never cached by a shared proxy');
}

console.log('\nnull versus zero: a day nothing was recorded for is absent, a real zero stays zero');
{
  store.clear(); hashes.clear();
  /* dates[0]: a real send, instagram reach 0 on purpose (a post that truly
     reached nobody), youtube views 500 */
  putStats(0, 'reelA', 'reel:verse', 8, 'A verse', { instagram: { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, at: NOW }, youtube: { views: 500, likes: 4, comments: 0, at: NOW } });
  /* dates[1]: nothing recorded at all for any slot */
  const out = await OBS.compose({ now: NOW });
  ok(out.ok, 'composes without throwing: ' + (out.error || 'ok'));
  const ig = out.trend30.networks.instagram;
  const rowToday = ig.find(r => r.date === dates[0]);
  const rowYesterday = ig.find(r => r.date === dates[1]);
  ok(rowToday && rowToday.reach === 0, 'an explicit zero reach stays a numeric zero: ' + JSON.stringify(rowToday));
  ok(rowYesterday && rowYesterday.reach === null, 'a day with no snapshot at all reads null, never a manufactured zero: ' + JSON.stringify(rowYesterday));
  ok(rowYesterday && rowYesterday.posts === 0, 'but the post COUNT for that day is a true zero: nothing was posted');
  const yt = out.trend30.networks.youtube.find(r => r.date === dates[0]);
  ok(yt && yt.views === 500, 'youtube\'s own row carries its real views: ' + JSON.stringify(yt));
}

console.log('\nthe 30-day per-network trend and the summary band');
{
  store.clear(); hashes.clear();
  for (let i = 0; i < 7; i++) putStats(i, 'reelA', 'reel:verse', 8, 'A verse ' + i,
    { instagram: { views: 1000 + i * 10, reach: 500 + i * 10, likes: 40, comments: 5, shares: 1, saves: 2, at: NOW } });
  for (let i = 7; i < 14; i++) putStats(i, 'reelA', 'reel:verse', 8, 'A verse, last week',
    { instagram: { views: 400, reach: 200, likes: 10, comments: 1, shares: 0, saves: 0, at: NOW } });
  const out = await OBS.compose({ now: NOW });
  ok(Array.isArray(out.trend30.dates) && out.trend30.dates.length === 30, 'thirty dates in the trend, oldest first: ' + out.trend30.dates.length);
  ok(out.trend30.dates[29] === dates[0], 'the trend ends on today: ' + out.trend30.dates[29] + ' vs ' + dates[0]);
  ok(out.summary.reach.value > 0 && out.summary.reach.delta > 0, 'this week reached more than last, and the summary says so: ' + JSON.stringify(out.summary.reach));
  const igNet = out.summary.networks.find(n => n.net === 'instagram');
  ok(igNet && igNet.sparkline.filter(v => v != null).length > 0, 'the network tile carries a sparkline the room can draw');
}

console.log('\nthe weekday by hour matrix: seven weekdays, the six reel hours the schedule actually keeps, present or not');
{
  store.clear(); hashes.clear();
  putStats(0, 'reelA', 'reel:verse', 8, 'A verse', { instagram: { views: 100, reach: 300, likes: 1, comments: 0, shares: 0, saves: 0, at: NOW }, youtube: { views: 700, at: NOW } });
  putStats(1, 'reelC', 'reel:verse', 11, 'Another verse', { instagram: { views: 50, reach: 100, likes: 1, comments: 0, shares: 0, saves: 0, at: NOW } });
  const out = await OBS.compose({ now: NOW });
  const wd = out.weekdayHour;
  ok(Array.isArray(wd) && wd.length > 0, 'the matrix is a flat array of cells');
  const weekdaysSeen = new Set(wd.map(c => c.weekday));
  ok(weekdaysSeen.size === 7, 'every weekday, 0 to 6, gets a row even where a hour has nothing: ' + [...weekdaysSeen].sort().join(','));
  /* the schedule keeps six reel hours (api/_schedule.js's SLOTS: 08, 11,
     14, 17, 19, 21 UTC) and the matrix carries all six on every weekday,
     an hour nothing was posted at included and marked absent rather than
     missing its own column */
  const hoursSeen = new Set(wd.map(c => c.hour));
  ok(hoursSeen.size === 6 && [8, 11, 14, 17, 19, 21].every(h => hoursSeen.has(h)),
    'all six reel hours are columns, an hour with nothing posted included: ' + [...hoursSeen].sort((a, b) => a - b).join(','));
  ok(wd.length === 42, 'seven weekdays by six hours is forty-two cells, not one shy or one over: ' + wd.length);
  const quietHour = wd.find(c => c.hour === 14);
  ok(quietHour && quietHour.instagramReach == null && quietHour.instagramN === 0,
    'an hour nothing was posted at reads null, never a manufactured zero: ' + JSON.stringify(quietHour));
  ok(wd.every(c => typeof c.weekday === 'number' && c.weekday >= 0 && c.weekday <= 6), 'every cell names a weekday 0 to 6');
  const cell8 = wd.find(c => c.hour === 8 && c.instagramReach != null);
  ok(cell8 && cell8.instagramReach === 300, 'the cell carries instagram\'s own median reach: ' + JSON.stringify(cell8));
}

console.log('\nthe 5-post floor: a kind or subject with fewer than five posts is still shown, but the room knows to fade it');
{
  store.clear(); hashes.clear();
  /* six posts of one kind (over the floor), two of another (under it) */
  for (let i = 0; i < 6; i++) putStats(i, 'reelA', 'reel:verse', 8, 'v' + i, { instagram: { views: 100, reach: 200, likes: 1, comments: 0, shares: 0, saves: 0, at: NOW } });
  putStats(6, 'reelC', 'reel:word', 11, 'w1', { instagram: { views: 50, reach: 90, likes: 1, comments: 0, shares: 0, saves: 0, at: NOW } });
  putStats(7, 'reelD', 'reel:word', 14, 'w2', { instagram: { views: 40, reach: 80, likes: 1, comments: 0, shares: 0, saves: 0, at: NOW } });
  const out = await OBS.compose({ now: NOW });
  const verse = out.kindTotals.find(k => k.kind === 'reel:verse');
  const word = out.kindTotals.find(k => k.kind === 'reel:word');
  ok(verse && verse.n === 6, 'the kind over the floor carries its true count: ' + (verse && verse.n));
  ok(word && word.n === 2 && word.n < INS.MIN_BUCKET, 'the kind under the floor is still in the answer, not dropped, so the room can fade it: ' + (word && word.n));
}

console.log('\nkind at read time: a stored "reel:reel" is asked of the shelf again here too, not only in numbers() (2026-09-24, a live run: kindTotals held "106" reels the shelf could have named, and none of them were)');
{
  store.clear(); hashes.clear();
  /* the exact live fault: written the night the shelf could not be read,
     with a real hook (reels/index.json's own "Al-Fatiha · 1:1-7", a verse
     card) that this call's own manifest, read straight off disk, can name */
  putStats(0, 'reelA', 'reel:reel', 8, 'Al-Fatiha · 1:1-7', { instagram: { views: 300, reach: 200, likes: 5, comments: 1, shares: 0, saves: 0, at: NOW } });
  const out = await OBS.compose({ now: NOW });
  const verse = out.kindTotals.find(k => k.kind === 'reel:verse');
  ok(verse && verse.n === 1 && verse.label === 'verse reels', 'kindTotals reclassifies it under its real kind, not the catch-all: ' + JSON.stringify(verse));
  ok(!out.kindTotals.some(k => k.kind === 'reel:reel'), 'and it never appears as the raw "reel:reel" once the shelf can name it');
  ok(!JSON.stringify(out.kindDaily).includes('"reel:reel"'), 'kindDaily\'s own keys are reclassified the same way, not left as the raw id');
}

console.log('\nevery figure labels its own window: the 30-day breakdowns never let a model mistake them for the 7-day summary (2026-09-24, "106 posts" this week, when it was really a month\'s own count)');
{
  store.clear(); hashes.clear();
  putStats(0, 'reelA', 'reel:verse', 8, 'v0', { instagram: { views: 100, reach: 200, likes: 1, comments: 0, shares: 0, saves: 0, at: NOW } });
  const out = await OBS.compose({ now: NOW });
  ok(out.windowDays === 30, 'the room\'s own top-level window is stated: 30 days of trend and kind history');
  ok(out.summary.windowDays === 7, 'the summary block states its own, different window right beside it: 7');
  ok(out.kindTotals.every(k => k.windowDays === 30), 'every kindTotals row carries its own 30-day window');
  ok(out.bySubject.every(s => s.windowDays === 30), 'every bySubject row carries its own 30-day window too');
}

console.log('\nposting health: state, retries and duplicates read from the slot records, never invented');
{
  store.clear(); hashes.clear();
  putSlot(0, 'reelA', { state: 'sent', results: { instagram: { ok: true, id: 'i1' }, youtube: { ok: true, id: 'y1' } } });
  putSlot(0, 'reelC', { state: 'failed', results: { instagram: { ok: false, tries: 3 } } });
  putSlot(0, 'light', { state: 'partial', results: { facebook: { ok: true, id: 'f1' }, instagram: { ok: false } } });
  putSlot(1, 'reelA', { state: 'sent', results: { instagram: { ok: true, id: 'i2', dupWarn: true } } });
  const out = await OBS.compose({ now: NOW });
  const days = out.postingHealth.days;
  const today = days.find(d => d.date === dates[0]);
  const yesterday = days.find(d => d.date === dates[1]);
  ok(today.sent === 1 && today.failed === 1 && today.partial === 1, 'one sent, one failed, one half sent, read straight off the day\'s three records: ' + JSON.stringify(today));
  ok(today.retried >= 1, 'a channel with tries over one counts as retried: ' + today.retried);
  ok(yesterday.duplicates === 1, 'a channel the guard marked dupWarn counts as a duplicate caught: ' + yesterday.duplicates);
  const untouched = days.find(d => d.date === dates[5]);
  ok(untouched && untouched.sent === 0 && untouched.failed === 0 && untouched.none === SLOT_IDS.length, 'a day nothing was written for reads as none, not as failed');
}

console.log('\nthe library, read from the shipped files, nothing invented');
{
  store.clear(); hashes.clear();
  const out = await OBS.compose({ now: NOW });
  const types = out.library.corpus.types;
  ok(Array.isArray(types) && types.length > 0, 'the corpus types come back');
  const light = types.find(t => t.type === 'light');
  ok(light && light.total > 0 && light.withReel >= 0 && light.withReel <= light.total,
     'a Light with a reel never outnumbers the Lights that exist: ' + JSON.stringify(light));
  ok(out.library.shelf.total > 0, 'the shelf as it stands right now is read from reels/index.json: ' + out.library.shelf.total);
}

console.log('\nthe test now running, and what holds attention (masterplan step 9)');
{
  store.clear(); hashes.clear();
  const out = await OBS.compose({ now: NOW });
  ok(out.experiment === null && out.experimentState === null, 'no test planned: experiment and experimentState both read null, not a guess dressed as one');
  ok(out.learn && Array.isArray(out.learn.watchByKind) && Array.isArray(out.learn.verseByLength)
     && Array.isArray(out.learn.verseByReciter) && Array.isArray(out.learn.sentences),
     'learn always carries its own shape, empty or not: ' + JSON.stringify(Object.keys(out.learn || {})));

  const future = new Date(Date.parse(NOW) + 5 * 86400000).toISOString().slice(0, 10);
  store.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: future, args: {} }, history: [] }));
  const out2 = await OBS.compose({ now: NOW });
  ok(out2.experiment && out2.experiment.id === 'verse-length' && out2.experiment.status === 'planned',
     'a test planned for the future reads as planned, right here beside everything else: ' + JSON.stringify(out2.experiment));
  ok(/Planned to start/.test(out2.experiment.sentence), 'and the sentence says so plainly: ' + out2.experiment.sentence);

  /* a fault reading either insightsRead or the experiment state must never
     blank the rest of the room: experiment and learn degrade to null on
     their own, everything else this call already builds (the library, the
     shelf, summary) reads exactly as it does with no fault at all */
  const brokenInsights = async () => { throw new Error('boom: the collect() this stands in for choked on something'); };
  const out3 = await OBS.compose({ now: NOW, insightsRead: brokenInsights });
  ok(out3.ok === true && out3.experiment === null && out3.learn === null, 'a broken insights read degrades experiment and learn to null, never a thrown error: ' + JSON.stringify({ experiment: out3.experiment, learn: out3.learn }));
  ok(out3.library && out3.library.shelf.total > 0 && out3.summary, 'and the rest of the room reads exactly as it does with no fault: the library, the summary, still whole');

  /* experimentState: a test really is current, but the full reading could
     not be built (insightsRead itself failed) -- the room must still be
     able to say WHICH test that is, never confuse "the numbers could not
     be read" with "nothing is running", since the card's own Plan/Stop
     choice depends on telling those two apart */
  store.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: future, args: {} }, history: [] }));
  const out3b = await OBS.compose({ now: NOW, insightsRead: brokenInsights });
  ok(out3b.experiment === null, 'the full reading is still null, since insightsRead itself failed: ' + JSON.stringify(out3b.experiment));
  ok(out3b.experimentState && out3b.experimentState.id === 'verse-length' && out3b.experimentState.start === future && out3b.experimentState.status === 'planned',
     'but experimentState still names the test, its start and its status, built from nexp:state alone: ' + JSON.stringify(out3b.experimentState));
  store.set('nexp:state', JSON.stringify({ current: null, history: [] }));

  const brokenExpState = async () => { throw new Error('boom: nexp:state could not be read'); };
  const out4 = await OBS.compose({ now: NOW, expReadState: brokenExpState });
  ok(out4.ok === true && out4.experiment === null, 'a broken experiment state read degrades the same way: ' + JSON.stringify(out4.experiment));
  ok(out4.learn && Array.isArray(out4.learn.watchByKind), 'learn itself is unaffected, since it never depended on nexp:state at all: ' + JSON.stringify(Object.keys(out4.learn || {})));
  ok(out4.library && out4.library.shelf.total > 0, 'and the rest of the room is still whole');

  store.delete('nexp:state');
}

console.log('\nthe ten minute cache');
{
  store.clear(); hashes.clear();
  putStats(0, 'reelA', 'reel:verse', 8, 'A verse', { instagram: { views: 10, reach: 20, likes: 1, comments: 0, shares: 0, saves: 0, at: NOW } });
  const first = await OBS.cached({ now: NOW });
  ok(first.cached === false, 'the first read composes fresh');
  /* new posts land, but a read inside the ten minutes must not notice yet:
     that is the whole point of keeping the composed answer for a while */
  putStats(0, 'reelC', 'reel:word', 11, 'A word', { instagram: { views: 999999, reach: 999999, likes: 1, comments: 0, shares: 0, saves: 0, at: NOW } });
  const second = await OBS.cached({ now: NOW });
  ok(second.cached === true, 'a second read within ten minutes is served from the cache, not recomposed');
  ok(JSON.stringify(second.summary) === JSON.stringify(first.summary), 'and it is the SAME answer, not one that quietly picked up the new post');
  const forced = await OBS.cached({ now: NOW, fresh: true });
  ok(forced.cached === false, 'fresh=1 goes round the cache the same way /api/house already lets it');

  /* invalidateCache: a plan or a stop clears this cache from underneath a
     GET /api/experiments or a Lantern experiment tool call that reused it,
     so the next reader recomputes rather than answering from an evaluation
     of whatever test used to be current */
  const third = await OBS.cached({ now: NOW });
  ok(third.cached === true, 'still within the window, still cached');
  await OBS.invalidateCache({});
  const fourth = await OBS.cached({ now: NOW });
  ok(fourth.cached === false, 'invalidateCache clears it: the very next read recomposes, cache window notwithstanding');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
