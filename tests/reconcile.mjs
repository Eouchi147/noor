/* NOOR · what a network actually holds, against what the house believes.
   ------------------------------------------------------------------
   The owner found a film on his YouTube twice, sent on 7 September and again
   on the 21st, by scrolling his own Studio. api/_reconcile.js asks the
   network instead, and this proves what its answers mean.

   A LESSON THIS FILE LEARNED THE HARD WAY. Its first version built the titles
   it fed in with the same function the index was built with, so when that
   function was the wrong one (a film's Short goes up under its HOOK, not its
   name) both sides agreed, every check passed, and the owner's own case came
   back "the two sides agree". The refuter found it. So every title a network
   is said to hold below is written out as a literal, the way YouTube stores
   it, and never computed by the code under test.

   Run:  node tests/reconcile.mjs
*/
import * as R from '../api/_reconcile.js';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

/* a shelf: two films whose name differs from their hook, as every film's
   does, and two ordinary reels */
const CARDS = [
  { id: 'short-tawaf', kind: 'short', title: 'Seven circuits', hook: 'Why does the first circuit not count?',
    wide: 'https://x/w1.mp4', video: 'https://x/t1.mp4', caption: 'c' },
  { id: 'short-zakat', kind: 'short', title: 'Zakat is growth', hook: 'What if giving made your wealth bigger?',
    wide: 'https://x/w2.mp4', video: 'https://x/t2.mp4', caption: 'c' },
  { id: 'verse-10-6', kind: 'verse', hook: 'In the turning of night and day there are signs', caption: 'c', video: 'https://x/v.mp4' },
  { id: 'word-sabr', kind: 'word', hook: 'Sabr is not waiting', caption: 'c', video: 'https://x/s.mp4' }
];
/* THE TITLES AS YOUTUBE HOLDS THEM, written by hand */
const T = {
  tawafShort: 'Why does the first circuit not count? #Shorts', tawafWide: 'Seven circuits',
  zakatShort: 'What if giving made your wealth bigger? #Shorts', zakatWide: 'Zakat is growth',
  verse: 'In the turning of night and day there are signs #Shorts'
};
const IDX = R.titleIndex(CARDS, 'youtube');
const inv = (id, title, at, extra = {}) => ({ id, title, at, atFull: at + 'T12:00:00Z', url: 'https://youtu.be/' + id, ...extra });
const led = (reel, id, at, shape = 'short') => ({ reel, id, url: 'https://youtu.be/' + id, at, slot: 'afternoon', shape });
const run = (inventory, ledger, opts = {}) =>
  R.compare({ inventory, ledger, index: IDX, cards: CARDS, network: 'youtube', ...opts });
const hit = t => (IDX.get(R.norm(t)) || []);

console.log('\nnaming a video back to a reel, by the road the sender actually takes');
{
  ok(hit(T.tawafShort).some(e => e.reel === 'short-tawaf' && e.shape === 'short'),
     'a film’s Short is named by its HOOK, which is what the sender titles it: "' + T.tawafShort + '"');
  ok(!hit('Seven circuits #Shorts').length,
     'and not by its name with #Shorts, which no video on the channel has ever been called');
  ok(hit(T.tawafWide).some(e => e.reel === 'short-tawaf' && e.shape === 'wide'),
     'its wide video is named by the film’s own name, as the dual upload titles it');
  ok(hit(T.verse).some(e => e.reel === 'verse-10-6' && e.shape === 'short'), 'an ordinary reel by its hook with #Shorts');
  const wides = [...IDX.values()].flat().filter(e => e.shape === 'wide').map(e => e.reel).sort();
  ok(wides.join() === 'short-tawaf,short-zakat', 'only reels with a wide file claim a wide title (' + wides.join(' ') + ')');
  const hookless = R.titleIndex([{ id: 'x', kind: 'verse', caption: 'c', video: 'v' }], 'youtube');
  ok(hookless.has('noor #shorts'), 'a reel with no hook is named as it went up, "NOOR #Shorts"');
  const long = { id: 'long', kind: 'verse', hook: 'word '.repeat(40).trim(), caption: 'c', video: 'v' };
  const t = R.youtubeTitles(long).short;
  ok(t && t.length <= 100 && /#Shorts$/.test(t), 'a hook past the hundred character cut is named as cut (' + (t || '').length + ' characters)');
  ok(R.norm('  A   Title  ') === 'a title', 'titles compare on collapsed whitespace, case folded');
}

console.log('\nhow many videos a reel may lawfully have');
{
  const f = R.allowanceOn(CARDS[0], 'youtube'), v = R.allowanceOn(CARDS[2], 'youtube'), g = R.allowanceOn(null, 'youtube');
  ok(f.total === 2 && f.short === 1 && f.wide === 1 && !f.assumed, 'a film on the shelf: one Short and one wide');
  ok(v.total === 1 && v.short === 1 && v.wide === 0, 'an ordinary reel: one Short, no wide');
  ok(g.short === 1 && g.wide === 1 && g.assumed, 'a reel off the shelf: one of each, and marked as assumed');
  ok(R.allowanceOn(CARDS[0], 'instagram').total === 1, 'everywhere else a reel is one');
}

console.log('\nTHE OWNER’S OWN CASE, 7 AND 21 SEPTEMBER');
{
  /* The film went up on the 7th with no record kept, and again on the 21st
     with one. This exact input came back "the two sides agree" before the fix. */
  const out = run(
    [inv('S1', T.zakatShort, '2026-09-07'), inv('W1', T.zakatWide, '2026-09-07'),
     inv('S2', T.zakatShort, '2026-09-21'), inv('W2', T.zakatWide, '2026-09-21')],
    [led('short-zakat', 'S2', '2026-09-21', 'short'), led('short-zakat', 'W2', '2026-09-21', 'wide')]);
  ok(out.clean === false, 'the pass is NOT clean');
  const t = out.twice.find(x => x.reel === 'short-zakat');
  ok(!!t && t.shapes.slice().sort().join() === 'short,wide', 'the film is posted twice, both its Short and its wide video');
  ok(out.unrecorded.map(u => u.id).sort().join() === 'S1,W1', 'and the two sends nobody wrote down are named');
  const keep = t ? t.copies.filter(c => c.keep).map(c => c.id).sort().join() : '';
  const remove = t ? t.copies.filter(c => !c.keep).map(c => c.id).sort().join() : '';
  ok(keep === 'S1,W1' && remove === 'S2,W2', 'keep the 7 September pair, remove the 21st (keep ' + keep + ', remove ' + remove + ')');
}

console.log('\nthe agreed case says nothing');
{
  const out = run(
    [inv('v1', T.tawafShort, '2026-09-01'), inv('v2', T.tawafWide, '2026-09-01'), inv('v3', T.verse, '2026-09-02')],
    [led('short-tawaf', 'v1', '2026-09-01'), led('short-tawaf', 'v2', '2026-09-01', 'wide'), led('verse-10-6', 'v3', '2026-09-02')]);
  ok(out.clean === true && !out.twice.length, 'a film’s Short and wide video plus a verse, all recorded: clean, and no duplicate');
  ok(out.coverage === 1 && out.counted.named === 3, 'every item named, every recorded send found');
}

console.log('\nthe findings, one at a time');
{
  const a = run([inv('v1', T.verse, '2026-09-02')], [led('verse-10-6', 'v1', '2026-09-02'), led('word-sabr', 'GONE', '2026-09-03')]);
  ok(a.absent.length === 1 && a.absent[0].id === 'GONE' && a.absent[0].reel === 'word-sabr' && a.clean === false,
     'a recorded send the network does not have is named with its reel');

  const u = run([inv('v1', T.verse, '2026-09-07')], []);
  ok(u.unrecorded.length === 1 && u.unrecorded[0].reel === 'verse-10-6' && u.clean === false,
     'a reel the network holds and no record mentions is named');

  const t = run([inv('v1', T.verse, '2026-09-07'), inv('v9', T.verse, '2026-09-21')],
                [led('verse-10-6', 'v1', '2026-09-07'), led('verse-10-6', 'v9', '2026-09-21')]);
  ok(t.twice.length === 1 && t.twice[0].count === 2 && t.twice[0].expected === 1, 'an ordinary reel twice: two against one');
  ok(t.twice[0].copies[0].id === 'v1' && t.twice[0].copies[0].keep && !t.twice[0].copies[1].keep, 'the older is kept');

  const renamed = run([inv('v1', 'A title the owner edited', '2026-09-07'), inv('v9', T.zakatShort, '2026-09-21')],
                      [led('short-zakat', 'v1', '2026-09-07', 'short'), led('short-zakat', 'v9', '2026-09-21', 'short')]);
  ok(renamed.twice.length === 1 && renamed.twice[0].shapes.join() === 'short',
     'a video renamed on YouTube is still known by the shape its record kept, so the duplicate still shows');
}

console.log('\nwhat must never be offered for removal');
{
  /* S1 and its lawful wide W on the 7th, a second Short S2 on the 21st. The
     wide video once sorted second and was marked "remove". */
  const r = run([inv('S1', T.tawafShort, '2026-09-07'), inv('W', T.tawafWide, '2026-09-07'), inv('S2', T.tawafShort, '2026-09-21')],
                [led('short-tawaf', 'S1', '2026-09-07'), led('short-tawaf', 'W', '2026-09-07', 'wide'), led('short-tawaf', 'S2', '2026-09-21')]);
  const t = r.twice[0];
  ok(t && t.shapes.join() === 'short', 'the Short is the doubled shape');
  ok(t && !t.copies.some(c => c.id === 'W'), 'the lawful wide video is not among the copies offered for removal');
  ok(t && t.lawful.length === 1 && t.lawful[0].id === 'W', 'it is listed apart, as lawful');
  const tie = run([inv('N', T.verse, '2026-09-07'), inv('O', T.verse, '2026-09-07')], [led('verse-10-6', 'O', '2026-09-07')]);
  ok(tie.twice[0].copies.find(c => c.keep).id === 'O', 'on a tie the recorded send is the one kept, whatever order YouTube listed them');
  const later = run([inv('N', T.verse, '2026-09-07', { atFull: '2026-09-07T18:00:00Z' }), inv('O', T.verse, '2026-09-07', { atFull: '2026-09-07T08:00:00Z' })], []);
  ok(later.twice[0].copies.find(c => c.keep).id === 'O', 'on one day the earlier by the clock is kept, not whichever came first in the list');
}

console.log('\nwhat must never be reported');
{
  const retired = R.compare({ inventory: [inv('v1', 'Gone film hook #Shorts', '2026-09-07'), inv('v2', 'Gone film', '2026-09-07')],
    ledger: [led('short-gone', 'v1', '2026-09-07', 'short'), led('short-gone', 'v2', '2026-09-07', 'wide')],
    index: IDX, cards: CARDS, network: 'youtube' });
  ok(!retired.twice.length && retired.clean === true, 'a film retired from the shelf, with its lawful Short and wide pair, is no duplicate');
  const retired2 = R.compare({ inventory: [inv('v1', 'Gone #Shorts', '2026-09-07'), inv('v9', 'Gone #Shorts', '2026-09-21')],
    ledger: [led('short-gone', 'v1', '2026-09-07'), led('short-gone', 'v9', '2026-09-21')], index: IDX, cards: CARDS, network: 'youtube' });
  ok(retired2.twice.length === 1 && !!retired2.twice[0].assumed, 'but two Shorts of a retired reel are caught, and say the allowance was assumed');

  const foreign = run([inv('vX', 'A talk the owner uploaded himself', '2026-08-01')], []);
  ok(foreign.foreign.length === 1 && !foreign.unrecorded.length && foreign.clean === true, 'a video not from the shelf is reported as itself and is no fault');

  const dup = run([inv('v1', T.verse, '2026-09-07'), inv('v1', T.verse, '2026-09-07')], [led('verse-10-6', 'v1', '2026-09-07')]);
  ok(!dup.twice.length && dup.clean === true, 'the same video handed back twice by the network is one video, not a duplicate');

  const rej = run([inv('v1', T.verse, '2026-09-07'), inv('v2', T.verse, '2026-09-08', { upload: 'rejected' })], [led('verse-10-6', 'v1', '2026-09-07')]);
  ok(!rej.twice.length && rej.rejected.length === 1, 'an upload YouTube rejected is reported as rejected, not counted as a copy');

  const old = run([inv('v0', T.verse, '2026-02-01')], [], { ledgerFrom: '2026-03-01' });
  ok(!old.unrecorded.length && old.beyondReach.length === 1, 'an item older than the records read is not called unrecorded: it could not have a record');
}

console.log('\nwhat can never be clean');
{
  const twins = [{ id: 'a-1', kind: 'verse', hook: 'The same hook', caption: 'c', video: 'v' },
                 { id: 'a-2', kind: 'verse', hook: 'The same hook', caption: 'c', video: 'v' }];
  const amb = R.compare({ inventory: [inv('v1', 'The same hook #Shorts', '2026-09-01'), inv('v2', 'The same hook #Shorts', '2026-09-02')],
                          ledger: [], index: R.titleIndex(twins, 'youtube'), cards: twins, network: 'youtube' });
  ok(amb.ambiguous.length === 2 && amb.clean === false,
     'titles two cards both claim are not guessed at, and the pass is not clean while they stand: one could be the duplicate');
  const noid = run([], [{ reel: 'verse-10-6', id: null, at: '2026-09-02', slot: 'morning' }]);
  ok(noid.unverifiable.length === 1 && !noid.absent.length && noid.clean === false,
     'a send that kept no id is neither missing nor fine, and the pass cannot call itself clean');
}

console.log('\nthe gate that stops a measurement fault reading as forty findings');
{
  const many = [];
  for (let i = 0; i < 40; i++) many.push(led('verse-10-6', 'v' + i, '2026-09-0' + (i % 9 + 1)));
  const blind = run([], many);
  ok(!blind.absent.length && blind.withheld && blind.withheld.count === 40 && blind.clean === false,
     'an empty inventory against forty recorded sends asserts none of them, and is not clean');
  ok(blind.withheld.items.length === 40, 'but lists them under the caveat, so a real mass loss is never hidden');
  const ungated = run([], many, { minCoverage: 0 });
  ok(ungated.absent.length === 40, 'lower the gate and the same input asserts forty, so the gate is what does the work');
  const small = run([], [led('verse-10-6', 'v1', '2026-09-02')]);
  ok(small.absent.length === 1 && !small.withheld, 'a single miss in a small ledger is still asserted');
  const cut = run([inv('v1', T.verse, '2026-09-01'), inv('v2', T.verse, '2026-09-20')],
                  [led('verse-10-6', 'v1', '2026-09-01'), led('word-sabr', 'GONE', '2026-09-02')],
                  { enumeration: { complete: false, why: 'ran out of time after 3 pages' } });
  ok(!cut.absent.length && /ran out of time after 3 pages/.test(cut.withheld.why) && cut.clean === false,
     'an unfinished walk asserts no absence, repeats its own reason, and is not clean');
  ok(cut.twice.length === 1 && cut.twice[0].reel === 'verse-10-6',
     'while a duplicate it DID see is still reported: a partial walk can find a copy, it just cannot find an absence');
}

/* ---------------------------------------------------------------------------
   ASKING YOUTUBE, against a stand in
--------------------------------------------------------------------------- */
const page = (items, next) => ({ ok: true, status: 200, json: async () => ({ items, nextPageToken: next }) });
const vid = (id, t, at) => ({ contentDetails: { videoId: id, videoPublishedAt: at + 'T00:00:00Z' }, snippet: { title: t } });
const chan = () => page([{ contentDetails: { relatedPlaylists: { uploads: 'UUnoor' } } }]);

console.log('\nasking YouTube, against a stand in');
{
  const calls = [];
  const r = await R.ytInventory({ token: 'TOK', fetch: async (url) => {
    calls.push(url);
    if (/\/channels\?/.test(url)) return chan();
    if (/\/playlistItems\?/.test(url)) return /pageToken=p2/.test(url) ? page([vid('v3', 'c', '2026-09-03')])
                                                                          : page([vid('v1', 'a', '2026-09-01'), vid('v2', 'b', '2026-09-02')], 'p2');
    return page([{ id: 'v1', status: { privacyStatus: 'private', uploadStatus: 'processed' } },
                 { id: 'v2', status: { privacyStatus: 'private', uploadStatus: 'rejected' } },
                 { id: 'v3', status: { privacyStatus: 'public', uploadStatus: 'processed' } }]);
  } });
  ok(r.ok && r.items.length === 3 && r.complete && r.pages === 2, 'it pages to the end and says it finished');
  ok(r.items[0].atFull === '2026-09-01T00:00:00Z' && r.items[0].at === '2026-09-01', 'each video keeps its full timestamp for ordering and its day for reading');
  ok(r.privacy.private === 2 && r.privacy.public === 1 && r.privacyComplete === true, 'the privacy tally covers every video and says so');
  ok(r.items.find(x => x.id === 'v2').upload === 'rejected', 'and whether YouTube accepted each upload at all');
  ok(calls.some(u => /playlistId=UUnoor/.test(u)), 'the channel is asked for its own uploads playlist');

  const shifted = await R.ytInventory({ token: 'TOK', privacy: false, fetch: async (url) => {
    if (/\/channels\?/.test(url)) return chan();
    return /pageToken=p2/.test(url) ? page([vid('n2', 'b', '2026-09-02'), vid('n3', 'c', '2026-09-03')])
                                    : page([vid('n1', 'a', '2026-09-01'), vid('n2', 'b', '2026-09-02')], 'p2');
  } });
  ok(shifted.items.map(x => x.id).join() === 'n1,n2,n3' && shifted.repeats === 1,
     'a video handed back on two pages, as an upload mid walk makes happen, is one video');

  const stuck = await R.ytInventory({ token: 'TOK', privacy: false, fetch: async (url) => /\/channels\?/.test(url) ? chan() : page([vid('s', 'x', '2026-09-01')], 'same') });
  ok(stuck.complete === false && /already/.test(stuck.why || '') && stuck.items.length === 1,
     'a page token handed back twice stops the walk as unfinished, instead of forty copies of one video');

  const flaky = await R.ytInventory({ token: 'TOK', privacy: false, fetch: async (url) => {
    if (/\/channels\?/.test(url)) return chan();
    if (/pageToken=p2/.test(url)) return { ok: false, status: 403, json: async () => ({ error: { message: 'quota' } }) };
    return page([vid('v1', 'a', '2026-09-01')], 'p2');
  } });
  ok(flaky.complete === false && /quota/.test(flaky.why) && flaky.items.length === 1, 'a refused page leaves the walk unfinished, keeps what it got, and repeats YouTube’s words');

  const dead = await R.ytInventory({ token: 'TOK', fetch: async () => { throw new Error('ECONNRESET'); } });
  ok(dead.ok === false && dead.enumerable === false && /ECONNRESET/.test(dead.why), 'a dropped line is a refusal with a reason, not a crash');

  const part = await R.ytInventory({ token: 'TOK', fetch: async (url) => {
    if (/\/channels\?/.test(url)) return chan();
    if (/\/playlistItems\?/.test(url)) return page([vid('v1', 'a', '2026-09-01'), vid('v2', 'b', '2026-09-02')]);
    return page([{ id: 'v1', status: { privacyStatus: 'private' } }]);
  } });
  ok(part.privacyComplete === false, 'a tally YouTube answered for only some videos says it is partial');

  const none = await R.ytInventory({ token: 'TOK', fetch: async () => page([]) });
  ok(none.ok === false && none.enumerable === false && /no uploads playlist/.test(none.why), 'a channel with no uploads playlist is not enumerable, and not an empty channel');
}

/* ---------------------------------------------------------------------------
   THE WHOLE ROAD: the store, the shelf, the channel and the verdict, through
   the shipped sentTo and reconcile, with only the wire stood in for.
--------------------------------------------------------------------------- */
console.log('\nthe whole road, store to verdict');
{
  process.env.KV_REST_API_URL = 'https://kv.test';
  process.env.KV_REST_API_TOKEN = 'kvtok';
  process.env.YT_CLIENT_ID = 'id'; process.env.YT_CLIENT_SECRET = 'sec'; process.env.YT_REFRESH_TOKEN = 'ref';
  const STORE = {
    'nsoc:yt:access': 'TOK',
    /* 21 September: the resend, recorded, both shapes */
    'nsoc:slot:2026-09-21#reelD': JSON.stringify({ reel: 'short-zakat', slot: 'reelD',
      results: { youtube: { ok: true, id: 'S2', url: 'u', wide: { id: 'W2', url: 'u' } }, telegram: { ok: true, id: 't' } } }),
    /* 15 September: a wide video still processing when the record was written */
    'nsoc:slot:2026-09-15#reelD': JSON.stringify({ reel: 'short-tawaf', slot: 'reelD',
      results: { youtube: { ok: true, id: 'TS', url: 'u', wide: { pending: 'TW' } } } }),
    /* 18 September: a guard refusal carrying the earlier send's id */
    'nsoc:slot:2026-09-18#reelA': JSON.stringify({ reel: 'short-tawaf', slot: 'reelA',
      results: { youtube: { ok: true, already: true, id: 'TS', url: 'u' } } }),
    /* 19 September: a send whose answer kept no id */
    'nsoc:slot:2026-09-19#reelB': JSON.stringify({ reel: 'word-sabr', slot: 'reelB', results: { youtube: { ok: true } } })
    /* and nothing at all for 7 September, which is what happened */
  };
  const kvCalls = [];
  /* the guard already knows the tawaf film went to YouTube on the 15th */
  const HASH = { 'nsoc:reels:postedch': { 'short-tawaf|youtube': '2026-09-15#reelD' } };
  const wire = [];
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    wire.push((init.method || 'GET') + ' ' + url.replace(/\?.*/, ''));
    if (url === 'https://kv.test/pipeline') {
      const cmds = JSON.parse(init.body);
      kvCalls.push(...cmds.map(c => c[0]));
      return { ok: true, status: 200, json: async () => cmds.map(c => {
        if (c[0] === 'GET') return { result: STORE[c[1]] ?? null };
        if (c[0] === 'HGET') return { result: (HASH[c[1]] || {})[c[2]] ?? null };
        if (c[0] === 'HSET') { (HASH[c[1]] = HASH[c[1]] || {})[c[2]] = c[3]; return { result: 1 }; }
        if (c[0] === 'HGETALL') return { result: Object.entries(HASH[c[1]] || {}).flat() };
        return { result: 'OK' };
      }) };
    }
    if (/\/reels\/index\.json$/.test(url)) return { ok: true, status: 200, json: async () => ({ n: CARDS.length, cards: CARDS }) };
    if (/\/channels\?/.test(url)) return chan();
    if (/\/playlistItems\?/.test(url)) return page([
      vid('S1', T.zakatShort, '2026-09-07'), vid('W1', T.zakatWide, '2026-09-07'),
      vid('TS', T.tawafShort, '2026-09-15'), vid('TW', T.tawafWide, '2026-09-15'),
      vid('S2', T.zakatShort, '2026-09-21'), vid('W2', T.zakatWide, '2026-09-21')]);
    if (/\/videos\?/.test(url)) return page(['S1', 'W1', 'TS', 'TW', 'S2', 'W2'].map(id => ({ id, status: { privacyStatus: 'private', uploadStatus: 'processed' } })));
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const SOC = await import('../api/social.js');

  const lw = await SOC.sentTo('youtube', '2026-09-22', 30);
  const ids = lw.rows.filter(r => r.id).map(r => r.id).sort().join();
  ok(lw.ok && ids === 'S2,TS,TW,W2', 'the ledger takes every id a record kept, the wide beside the Short and a pending wide too (' + ids + ')');
  ok(lw.rows.filter(r => r.id === 'TS').length === 1 && lw.rows.find(r => r.id === 'TS').at === '2026-09-15',
     'a guard refusal naming an earlier send is that send, once, at its first date, and not a second send');
  ok(lw.rows.some(r => r.reel === 'word-sabr' && !r.id), 'a send that kept no id is carried as unverifiable rather than dropped');
  ok(lw.rows.find(r => r.id === 'W2').shape === 'wide' && lw.rows.find(r => r.id === 'S2').shape === 'short', 'each id carries its shape');
  ok(lw.complete === true && lw.from === '2026-08-24' && lw.to === '2026-09-22', 'and it says which days it read (' + lw.from + ' to ' + lw.to + ')');
  ok(kvCalls.length && kvCalls.every(c => c === 'GET'), 'it only ever reads the store (' + [...new Set(kvCalls)].join() + ')');

  const short = await SOC.sentTo('youtube', '2026-09-22', 30, { budgetMs: -1 });
  ok(short.complete === false && /ran out of time/.test(short.why || ''), 'a ledger walk out of time says so rather than returning a short ledger as whole');

  kvCalls.length = 0;
  const out = await SOC.reconcile('youtube', 'noorcodex.com', { date: '2026-09-22', days: 30 });
  ok(out.ok && out.enumerable && out.clean === false, 'the owner’s case, end to end: NOT clean');
  const z = (out.twice || []).find(t => t.reel === 'short-zakat');
  ok(!!z && z.shapes.slice().sort().join() === 'short,wide', 'the film is found posted twice, Short and wide');
  ok(!!z && z.copies.filter(c => c.keep).map(c => c.id).sort().join() === 'S1,W1', 'and the 7 September pair is the one to keep');
  ok((out.unrecorded || []).map(u => u.id).sort().join() === 'S1,W1', 'the 7 September sends are named as never recorded');
  ok(!(out.twice || []).some(t => t.reel === 'short-tawaf'), 'the film sent once, with a guard refusal on a later day, is not called a duplicate');
  ok((out.unverifiable || []).length === 1 && out.unverifiable[0].reel === 'word-sabr', 'the id-less send reaches the verdict as unverifiable');
  ok(out.walk && out.walk.privacyComplete === true && out.ledgerWalk.complete === true, 'the walk reports both of its halves whole');
  ok(kvCalls.length > 0 && kvCalls.every(c => c === 'GET'), 'and the whole pass wrote nothing to the store (' + kvCalls.length + ' reads)');
  const writes = wire.filter(w => !/^GET /.test(w) && w !== 'POST https://kv.test/pipeline');
  ok(wire.length > 0 && !writes.length, 'nor anything anywhere else: every call on the wire was a read (' + wire.length + ' calls' + (writes.length ? ', writes: ' + writes.join(', ') : '') + ')');

  /* asked for a single day, it still reads back to the channel's oldest video */
  const one = await SOC.reconcile('youtube', 'noorcodex.com', { date: '2026-09-22', days: 1 });
  ok(one.ledgerWalk.from === '2026-09-07' && !(one.beyondReach || []).length && (one.twice || []).some(t => t.reel === 'short-zakat'),
     'asked for one day, the pass reads back to the oldest video on the channel (' + one.ledgerWalk.from + ') so nothing is left beyond reach');

  /* the guard is taught what the channel holds, and only that */
  kvCalls.length = 0;
  const taught = await SOC.teachGuard('youtube', 'noorcodex.com', { date: '2026-09-22', days: 30 });
  const H = HASH['nsoc:reels:postedch'];
  ok(taught.ok && H['short-zakat|youtube'] === '2026-09-21#',
     'the guard now remembers the Zakat film went to YouTube, at its latest day on the channel (' + H['short-zakat|youtube'] + ')');
  ok(H['short-tawaf|youtube'] === '2026-09-15#reelD' && !taught.taught.some(t => t.reel === 'short-tawaf'),
     'a reel whose sends were all recorded has nothing to teach and is left exactly as it was');
  ok(kvCalls.filter(c => c !== 'GET' && c !== 'HGET').every(c => c === 'HSET') && taught.written === taught.taught.length,
     'it writes one kind of thing, the guard\u2019s own memory, and says how many (' + taught.written + ')');
  ok(!wire.some(w => /^(POST|PUT|DELETE|PATCH) https:\/\/(www\.)?googleapis/.test(w)), 'and nothing at all to YouTube');
  const again = await SOC.teachGuard('youtube', 'noorcodex.com', { date: '2026-09-22', days: 30 });
  ok(again.ok && again.written === 0 && again.known === 1, 'run twice, the second run finds the guard already knows and writes nothing: it is idempotent');
  H['short-zakat|youtube'] = '2026-09-30#reelA';
  const later = await SOC.teachGuard('youtube', 'noorcodex.com', { date: '2026-09-22', days: 30 });
  ok(later.written === 0 && H['short-zakat|youtube'] === '2026-09-30#reelA', 'and a later day the guard already holds is never wound back to an earlier one');
  const picker = await SOC.recentlyPosted('2026-09-22');
  ok(picker.has('short-zakat'), 'and the picker now steps past the Zakat film too, because it reads the same memory');

  const tg = await SOC.reconcile('telegram', 'noorcodex.com', {});
  ok(tg.enumerable === false && tg.clean === null && /getUpdates/.test(tg.why), 'a network that cannot be asked is never clean: it says why, and clean is null');
}

console.log('\nround two of the refuter');
{
  /* an ok that never became a post: recorded, then rejected by YouTube */
  const f = run([inv('v1', T.verse, '2026-09-07', { upload: 'failed' })], [led('verse-10-6', 'v1', '2026-09-07')]);
  ok(f.failed.length === 1 && f.failed[0].reel === 'verse-10-6' && !f.absent.length && f.clean === false,
     'a send recorded as ok that YouTube then failed is its own finding, and the pass is not clean');
  const g = run([inv('v1', T.verse, '2026-09-07', { upload: 'rejected' })], []);
  ok(!g.failed.length && g.rejected.length === 1 && g.clean === true && g.caveats.length === 1,
     'one nobody recorded and YouTube rejected was never public and is no fault, but it is named as a caveat');

  const old = run([inv('v0', T.verse, '2026-02-01')], [], { ledgerFrom: '2026-03-01' });
  ok(old.clean === false, 'a reel of ours older than the records read blocks clean: whether it was recorded cannot be said');

  const lost = [{ ...CARDS[0], wide: '' }];
  const lone = R.compare({ inventory: [inv('S', T.tawafShort, '2026-09-01'), inv('W', T.tawafWide, '2026-09-01')],
    ledger: [led('short-tawaf', 'S', '2026-09-01'), led('short-tawaf', 'W', '2026-09-01', 'wide')],
    index: IDX, cards: lost, network: 'youtube' });
  ok(!lone.twice.length && lone.clean === true, 'a film that lost its wide file after a lawful pair went up is one Short and one wide, not a duplicate');

  const fo = run([inv('vX', 'Something the owner uploaded', '2026-09-01')], []);
  ok(fo.clean === true && fo.caveats.some(c => /match no reel/.test(c)), 'a clean verdict still says what it could not name');

  const partial = run([inv('v1', T.verse, '2026-09-07')], [led('verse-10-6', 'v1', '2026-09-07')], { statusComplete: false });
  ok(partial.clean === false && partial.caveats.some(c => /did not say the status/.test(c)),
     'a status read YouTube answered only in part cannot be clean: a rejected upload could be in the part it skipped');
  const t0 = Date.now();
  const hung = await R.ytInventory({ token: 'TOK', budgetMs: 2500, fetch: (url, init = {}) => new Promise((res, rej) => {
    if (init.signal) init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); });
  }) });
  ok(hung.ok === false && /no answer in time/.test(hung.why) && Date.now() - t0 < 6000,
     'a line to YouTube that never answers is cut off and named, in ' + (Date.now() - t0) + ' ms');
}

console.log('\nno network is silently unchecked');
{
  const names = Object.keys(R.NETWORKS);
  ok(names.every(n => R.NETWORKS[n].enumerable ? typeof R.NETWORKS[n].inventory === 'function' : !!R.NETWORKS[n].why),
     'every network is either enumerable with a way to enumerate it, or says why not (' + names.length + ' networks)');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
