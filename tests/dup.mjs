/* NOOR · no reel sent twice.
   ------------------------------------------------------------------
   The diagnosis of 16 September 2026: a Facebook reel the clock cut kept no
   id, so the healer started a second, real upload over the first, and when
   the first one's own answer arrived it was thrown away because the record
   no longer said late. Held here, against that diagnosis:

     a Facebook send the clock cuts AFTER the upload has an id is recorded
       pending, not late with nothing to show, and the healer leaves it alone;

     a late answer that turns out to have succeeded, arriving after a newer
       result is already on the record, is kept beside it (dup, dupWarn),
       never silently dropped;

     the same reel id is refused a second send to a network that already has
       it, inside the last 21 days, without ever asking the network;

     the ledger's rule: a reel retires when every live network is ok, or
       skipped for a reason that will not change on its own -- not one still
       failing for a real, retryable reason.

   Telegram's own door and its content-length are held in tests/reel-proxy.mjs
   (the door itself) and tests/telegram.mjs (the sender's multipart upload
   and its 50 MB skip). Meta and the store are stubbed here too.

   Run:  node tests/dup.mjs
*/
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

process.env.FB_PAGE_ID = '123'; process.env.FB_PAGE_TOKEN = 'tok';
process.env.KV_REST_API_URL = 'https://kv.test';
process.env.KV_REST_API_TOKEN = 't';
/* a run of half a second, most of it reserve: room enough for Facebook's
   start phase to answer and set the id, not enough for an upload held open
   past it -- the shape of the real numbers, at test speed */
process.env.RUN_BUDGET_MS = '500';
process.env.WRITE_RESERVE_MS = '400';
process.env.CHANNEL_MIN_MS = '10';

const STORE = new Map();
const HASH = new Map();
let calls = [], uploadDelayMs = 0, statusMode = 'ready', videoList = [];
globalThis.fetch = async (url, opt) => {
  const u = String(url);
  if (u.startsWith('https://kv.test')) {
    const cmds = JSON.parse(opt.body);
    return { ok: true, status: 200, json: async () => cmds.map(c => {
      const [v, k, ...r] = c;
      if (v === 'GET') return { result: STORE.has(k) ? STORE.get(k) : null };
      if (v === 'SET') { STORE.set(k, r[0]); return { result: 'OK' }; }
      if (v === 'HSET') { const h = HASH.get(k) || new Map(); h.set(r[0], r[1]); HASH.set(k, h); return { result: 1 }; }
      if (v === 'HDEL') { const h = HASH.get(k) || new Map(); const had = h.delete(r[0]) ? 1 : 0; return { result: had }; }
      if (v === 'HGETALL') { const h = HASH.get(k) || new Map(); return { result: [...h.entries()].flat() }; }
      return { result: null };
    }) };
  }
  if (u.includes('/api/card') || u.includes('-cover.jpg'))
    return { ok: true, status: 200, headers: { get: h => (h === 'content-type' ? 'image/png' : '40000') }, json: async () => ({}), text: async () => '' };
  if (u.includes('?fields=access_token')) return { ok: true, status: 200, json: async () => ({ access_token: 'page' }) };
  if (u.includes('/video_reels')) {
    const body = JSON.parse(opt.body);
    if (body.upload_phase === 'start') { calls.push('fb-start'); return { ok: true, status: 200, json: async () => ({ video_id: 'VID', upload_url: 'https://rupload/x' }) }; }
    calls.push('fb-finish'); return { ok: true, status: 200, json: async () => ({}) };
  }
  if (u.includes('rupload')) {
    calls.push('fb-upload');
    if (uploadDelayMs) await sleep(uploadDelayMs);
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  }
  if (/\/VID\?fields=status,permalink_url/.test(u)) {
    calls.push('fb-status');
    if (statusMode === 'ready') return { ok: true, status: 200, json: async () => ({ status: { video_status: 'ready' }, permalink_url: '/reel/VID', published: true }) };
    return { ok: false, status: 500, json: async () => ({ error: { message: 'temporary' } }) };
  }
  if (/\/VID2\?fields=status,permalink_url/.test(u)) return { ok: false, status: 500, json: async () => ({ error: { message: 'temporary' } }) };
  /* the page's own recent videos, stubbed for the no-id-cut adopt path
     (adoptFacebookReel, social.js): a fixed list the test sets before a run */
  if (u.includes('/123/videos?fields=')) return { ok: true, status: 200, json: async () => ({ data: videoList }) };
  if (/\/ADOPTED\?fields=status,permalink_url/.test(u)) { calls.push('fb-status'); return { ok: true, status: 200, json: async () => ({ status: { video_status: 'ready' }, permalink_url: '/reel/ADOPTED', published: true }) }; }
  throw new Error('unexpected fetch ' + u);
};

const S = await import('../api/social.js');
const DATE = '2026-09-16';
const REEL = { id: 'al-basit-name', kind: 'name', hook: 'Al-Basit', caption: 'The Extender.\n\nRead the whole thing free at noorcodex.com\n\n#Islam',
  video: 'https://noorcodex.com/reels/al-basit-name.mp4', cover: 'https://noorcodex.com/reels/al-basit-name-cover.jpg' };
const CTX = { plan: { hijri: { text: '' }, day: {}, leads: [] }, index: { words: [], path: [] },
  dials: { polish: false, mode: 'auto', storeOk: true, stories: false, cardsFeed: true } };
const key = (d, s) => 'nsoc:slot:' + d + '#' + s;
const rec = (d, s) => JSON.parse(STORE.get(key(d, s)) || 'null');

console.log('\na status read that errors transiently keeps the id pending');
{
  const r = await S.fbReelStatus('VID2', 'tok', 1);
  ok(r.ok === false && r.pending && r.pending.fb === 'VID2', 'a transient http error on the status read is still pending, not a fatal refusal');
  ok(!/refused/.test(r.error || ''), 'only Facebook\'s own word for that id, not a fetch fault, is what turns it fatal: ' + r.error);
}

console.log('\nthe clock cuts a Facebook send after the id is known');
{
  /* HASH (K_POSTED_CH, the per-channel guard hash) is cleared here too: it
     is written the moment ANY channel says ok, and a background flight from
     an earlier block that later succeeds would otherwise leave this block's
     reel id looking, correctly, like a duplicate -- see findDuplicate. */
  STORE.clear(); HASH.clear(); calls = []; uploadDelayMs = 300; statusMode = 'ready';
  const r = await S.sendSlot('noorcodex.com', DATE, 'reelA', { ...CTX, extras: { reel: REEL } });
  const slot = rec(DATE, 'reelA');
  const fb = slot.results.facebook;
  ok(calls.includes('fb-start') && calls.includes('fb-upload'), 'the upload was in flight when the clock looked: ' + calls.join(','));
  ok(fb.late === true && fb.cut === true, 'the send is recorded late, cut by the clock');
  ok(fb.pending && fb.pending.fb === 'VID', 'and, because the id was already known, pending carries it: ' + JSON.stringify(fb.pending));
  ok(S.healable(fb, slot) === false, 'a pending result is not healable: the finisher asks the id, nobody starts a fresh upload');
  ok(slot.state === 'pending', 'the slot itself reads pending, not owed: ' + slot.state);

  const before = calls.length;
  const ran = await S.healFailures('noorcodex.com', DATE, { ran: [] }, Date.now() + 3600000, () => true);
  ok(!ran.some(x => x.slot === 'reelA' && x.where === 'facebook'), 'and the hourly heal leaves this slot alone: ' + JSON.stringify(ran));
  ok(calls.length === before, 'nothing more was sent to Facebook because of it');

  /* the flight the clock cut is still running in the background; give it
     room to settle before the next block reuses the same record */
  await sleep(500);
}

console.log('\na late answer that succeeded is never dropped once a newer result is on the record');
{
  STORE.clear(); HASH.clear(); calls = []; uploadDelayMs = 350; statusMode = 'ready';
  const p = S.sendSlot('noorcodex.com', DATE, 'reelC', { ...CTX, extras: { reel: REEL } });
  const r = await p;
  const cut = rec(DATE, 'reelC');
  ok(cut.results.facebook.late === true, 'the send is cut, as above');

  /* a healer's retry lands first: a NEWER, real result for the same
     channel, while the original flight is still in the air */
  cut.results.facebook = { ok: true, id: 'NEWID', url: 'https://www.facebook.com/reel/NEWID', tries: 2, lastTry: new Date().toISOString() };
  cut.state = S.slotState(cut.results);
  STORE.set(key(DATE, 'reelC'), JSON.stringify(cut));

  /* now the original flight resolves ok, in the background, after the
     newer result is already written */
  await sleep(700);
  const settled = rec(DATE, 'reelC');
  const fb = settled.results.facebook;
  ok(fb.ok === true && fb.id === 'NEWID', 'the newer result is still what the record follows, untouched');
  ok(Array.isArray(fb.dup) && fb.dup.length === 1 && fb.dup[0].id === 'VID', 'the older, real video is kept beside it, not thrown away: ' + JSON.stringify(fb.dup));
  ok(fb.dupWarn === true, 'and flagged, so the console can show it and the Director can act');
}

console.log('\nthe same reel is refused a second send to a network that already has it');
{
  STORE.clear(); HASH.clear(); calls = []; uploadDelayMs = 0; statusMode = 'ready';
  const OLD_DATE = '2026-09-01';
  HASH.set('nsoc:reels:posted', new Map([[REEL.id, OLD_DATE]]));
  STORE.set(key(OLD_DATE, 'reelE'), JSON.stringify({
    reel: REEL.id, state: 'sent',
    results: { facebook: { ok: true, id: 'OLDID', url: 'https://www.facebook.com/reel/OLDID' } }
  }));

  const r = await S.sendSlot('noorcodex.com', DATE, 'reelC', { ...CTX, extras: { reel: REEL } });
  const slot = rec(DATE, 'reelC');
  ok(!calls.includes('fb-start'), 'Facebook is never asked for a reel it already has: ' + calls.join(','));
  ok(slot.results.facebook.ok === true && slot.results.facebook.already === true, 'the send answers ok, marked already, instead');
  ok(slot.results.facebook.id === 'OLDID' && slot.results.facebook.url === 'https://www.facebook.com/reel/OLDID', 'carrying the earlier id and url, not a new one');
  ok(slot.results.facebook.at === OLD_DATE + '#reelE', 'and where it came from');

  /* a different reel, the same day: sends as normal */
  calls = [];
  const OTHER = { ...REEL, id: 'al-hakim-name', hook: 'Al-Hakim' };
  STORE.delete(key(DATE, 'reelC'));
  await S.sendSlot('noorcodex.com', DATE, 'reelD', { ...CTX, extras: { reel: OTHER } });
  ok(calls.includes('fb-start'), 'a different reel id is sent as usual, not caught by the guard');
}

console.log('\nthe ledger rule: ok, or skipped for a reason that will not change');
{
  const results = { facebook: { ok: true, id: 'F1' }, instagram: { ok: true, id: 'I1' },
    telegram: { ok: false, skipped: true, reason: 'too big', err: 'the reel is 61 MB, over Telegram\'s 50 MB upload limit' } };
  const state = S.slotState(results);
  ok(state === 'sent', 'a network skipped for a reason that will not change does not hold the slot half sent: ' + state);
  ok(S.reelDone({ reel: 'x', state, results }) === true, 'and the reel retires: every live network is ok or skipped that way');

  const failing = { ...results, telegram: { ok: false, err: 'still down', code: 400 } };
  ok(S.slotState(failing) === 'partial', 'a network still failing for a real, retryable reason holds the slot half sent: ' + S.slotState(failing));
  ok(S.reelDone({ reel: 'x', state: 'partial', results: failing }) === false, 'and the reel does not retire under it');
}

/* -----------------------------------------------------------------------
   the refuter's six, 16 September 2026: what the diagnosis above still let
   through, held against each one directly.
----------------------------------------------------------------------- */

console.log('\n1. the guard sees a reel ok on Facebook while Telegram is still failing');
{
  /* the 14 September shape exactly: Facebook ok, Telegram a real error, so
     the slot reads partial and the OLD ledger (K_POSTED, every network
     required) never names this reel. Before 16 September's review that made
     the guard blind to it (probe block D); now K_POSTED_CH -- written the
     moment Facebook alone said ok -- catches it with one HGETALL and no
     extra slot reads beyond the one hit names. */
  STORE.clear(); HASH.clear(); calls = []; uploadDelayMs = 0; statusMode = 'ready';
  const OLD = '2026-09-10';
  HASH.set('nsoc:reels:postedch', new Map([[REEL.id + '|facebook', OLD + '#reelE']]));
  STORE.set(key(OLD, 'reelE'), JSON.stringify({ reel: REEL.id, state: 'partial',
    results: { facebook: { ok: true, id: 'OLDFB', url: 'https://www.facebook.com/reel/OLDFB' },
               telegram: { ok: false, err: 'could not fetch the file from its url', code: 400 } } }));
  const posted = await S.postedReels(DATE, 0);
  ok(!posted[REEL.id], 'the old ledger alone does not name this reel (Telegram never went ok): ' + JSON.stringify(posted));

  await S.sendSlot('noorcodex.com', DATE, 'reelA', { ...CTX, extras: { reel: REEL } });
  const slot = rec(DATE, 'reelA');
  ok(!calls.includes('fb-start'), 'so the per-channel hash alone has to catch it, and does: Facebook is not asked again: ' + calls.join(','));
  ok(slot.results.facebook.ok === true && slot.results.facebook.already === true && slot.results.facebook.id === 'OLDFB',
     'the record shows the earlier Facebook id, not a fresh one: ' + JSON.stringify(slot.results.facebook));
}

console.log('\n2. PENDING_MAX_MS never gives a Facebook id back to the healer');
{
  STORE.clear(); HASH.clear(); calls = []; statusMode = 'err';   /* the status read keeps erroring, so the id is still unconfirmed */
  const old = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  STORE.set(key(DATE, 'reelB'), JSON.stringify({ at: old, slot: 'reelB', reel: REEL.id, state: 'pending',
    results: { facebook: { ok: false, late: true, cut: true, pending: { fb: 'VID' } } } }));
  await S.finishPendingReels(DATE, { ran: [] });
  const after = rec(DATE, 'reelB').results.facebook;
  ok(after.fatal === true && after.unverified === true && after.id === 'VID' && !after.pending,
     'past the max it is fatal and unverified, the id kept on the record: ' + JSON.stringify(after));
  ok(S.healable(after, rec(DATE, 'reelB')) === false,
     'and never healable: the automatic net will not start a second real upload of an id Facebook may still publish');
}

console.log('\n3. dup and dupWarn survive the next write to the channel');
{
  /* finishPendingReels used to replace results[ch] wholesale (had.pending
     resolved) and erase both fields; carryDup merges them forward now */
  STORE.clear(); HASH.clear(); calls = []; statusMode = 'ready';
  STORE.set(key(DATE, 'reelA'), JSON.stringify({ at: new Date().toISOString(), slot: 'reelA', reel: REEL.id, state: 'pending',
    results: { facebook: { ok: false, pending: { fb: 'VID' }, dup: [{ id: 'OLDVID', url: 'u', at: 't' }], dupWarn: true } } }));
  await S.finishPendingReels(DATE, { ran: [] });
  const afterFinish = rec(DATE, 'reelA').results.facebook;
  ok(afterFinish.ok === true && afterFinish.id === 'VID', 'the finisher still settles the pending id: ' + JSON.stringify(afterFinish).slice(0, 80));
  ok(Array.isArray(afterFinish.dup) && afterFinish.dup[0].id === 'OLDVID' && afterFinish.dupWarn === true,
     'and dup, dupWarn ride along rather than vanishing: ' + JSON.stringify(afterFinish));

  /* retryChannel replaces results[ch] wholesale too (a person pressing
     Retry on a channel that still carries an old duplicate warning). HASH
     is cleared as well: the block just above left this same reel id ok on
     Facebook in K_POSTED_CH, which would otherwise have the GUARD, not a
     real send, answer this retry -- a true result either way, but not the
     one this block means to hold carryDup against. */
  STORE.clear(); HASH.clear();
  STORE.set(key(DATE, 'reelB'), JSON.stringify({ at: new Date().toISOString(), slot: 'reelB', reel: REEL.id, state: 'partial',
    results: { facebook: { ok: false, err: 'still down', code: 400, dup: [{ id: 'OLDVID', url: 'u', at: 't' }], dupWarn: true } } }));
  calls = [];
  const rr = await S.retryChannel('noorcodex.com', DATE, 'reelB', 'facebook', { ...CTX, extras: { reel: REEL } });
  const afterRetry = rec(DATE, 'reelB').results.facebook;
  ok(rr.ok === true && calls.includes('fb-start'), 'the retry actually sends: ' + JSON.stringify(rr).slice(0, 80));
  ok(Array.isArray(afterRetry.dup) && afterRetry.dupWarn === true, 'and the earlier duplicate mark is still on the record after it: ' + JSON.stringify(afterRetry));
}

console.log('\n4. a cut with no id yet is adopted by name, or given up after 30 minutes');
{
  STORE.clear(); HASH.clear(); calls = []; statusMode = 'ready';

  /* a) the page's own recent videos carry a match: adopted, not resent */
  videoList = [{ id: 'ADOPTED', title: 'Al-Basit', description: '', created_time: new Date(Date.now() - 60000).toISOString() }];
  const since1 = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  STORE.set(key(DATE, 'reelA'), JSON.stringify({ at: since1, slot: 'reelA', reel: REEL.id, caption: 'Al-Basit', state: 'pending',
    results: { facebook: { ok: false, late: true, cut: true, pending: { fb: null, since: since1 } } } }));
  await S.finishPendingReels(DATE, { ran: [] });
  const afterA = rec(DATE, 'reelA').results.facebook;
  ok(afterA.ok === true && afterA.id === 'ADOPTED' && !calls.includes('fb-start'),
     'a matching title on the page is adopted, nothing new sent: ' + JSON.stringify(afterA));

  /* b) nothing matches yet, well inside 30 minutes: stays pending, not resent */
  videoList = [];
  calls = [];
  const since2 = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  STORE.set(key(DATE, 'reelC'), JSON.stringify({ at: since2, slot: 'reelC', reel: REEL.id, caption: 'Al-Basit', state: 'pending',
    results: { facebook: { ok: false, late: true, cut: true, pending: { fb: null, since: since2 } } } }));
  await S.finishPendingReels(DATE, { ran: [] });
  const afterB = rec(DATE, 'reelC').results.facebook;
  ok(afterB.pending && afterB.pending.since === since2 && !calls.includes('fb-start'),
     'nothing found yet inside the window: still pending, nothing new sent: ' + JSON.stringify(afterB));

  /* c) nothing matches after 30 minutes: a plain, healable failure */
  const since3 = new Date(Date.now() - 35 * 60 * 1000).toISOString();
  STORE.set(key(DATE, 'reelD'), JSON.stringify({ at: since3, slot: 'reelD', reel: REEL.id, caption: 'Al-Basit', state: 'pending',
    results: { facebook: { ok: false, late: true, cut: true, pending: { fb: null, since: since3 } } } }));
  await S.finishPendingReels(DATE, { ran: [] });
  const afterC = rec(DATE, 'reelD').results.facebook;
  ok(!afterC.pending && afterC.ok !== true, 'past 30 minutes with no match, it gives up into a plain failure: ' + JSON.stringify(afterC));
  ok(S.healable(afterC, rec(DATE, 'reelD')) === true, 'and the healer may send it once, since nothing of this cut was ever confirmed live');
}

console.log('\n5. the guard\'s already:true never collides with lateArrival\'s dup list');
{
  STORE.clear(); HASH.clear(); calls = [];
  const OLD = '2026-09-01';
  HASH.set('nsoc:reels:posted', new Map([[REEL.id, OLD]]));
  STORE.set(key(OLD, 'reelE'), JSON.stringify({ reel: REEL.id, state: 'sent',
    results: { facebook: { ok: true, id: 'OLDID', url: 'https://www.facebook.com/reel/OLDID' } } }));
  await S.sendSlot('noorcodex.com', DATE, 'reelA', { ...CTX, extras: { reel: REEL } });
  const fb = rec(DATE, 'reelA').results.facebook;
  ok(fb.already === true, 'the guard names its own flag already, not dup: ' + JSON.stringify(fb));
  ok(fb.dup === undefined, 'and never sets the dup field lateArrival owns, so the two can never be read as one: ' + JSON.stringify(fb));
}

console.log('\n6. opts.force reaches the guard like every other refusal');
{
  STORE.clear(); HASH.clear(); calls = [];
  const OLD = '2026-09-01';
  HASH.set('nsoc:reels:posted', new Map([[REEL.id, OLD]]));
  STORE.set(key(OLD, 'reelE'), JSON.stringify({ reel: REEL.id, state: 'sent',
    results: { facebook: { ok: true, id: 'OLDID', url: 'https://www.facebook.com/reel/OLDID' } } }));

  /* without force, the guard still refuses (the rule itself, unchanged) */
  await S.sendSlot('noorcodex.com', DATE, 'reelA', { ...CTX, extras: { reel: REEL } });
  ok(!calls.includes('fb-start'), 'without force the guard still refuses: ' + calls.join(','));

  /* with force, on a slot the guard would otherwise have caught, it sends */
  calls = [];
  STORE.delete(key(DATE, 'reelA'));
  await S.sendSlot('noorcodex.com', DATE, 'reelA', { ...CTX, extras: { reel: REEL }, force: true });
  ok(calls.includes('fb-start'), 'opts.force skips findDuplicate the same way it skips the other already-sent refusals: ' + calls.join(','));
}

console.log('\n7. the one time backfill for K_POSTED_CH');
{
  STORE.clear(); HASH.clear(); calls = [];
  const d1 = DATE;             /* today, inside the window */
  const d2 = '2026-09-10';     /* six days back, inside the window */
  const d3 = '2026-09-05';     /* eleven days back, inside the window */
  STORE.set(key(d1, 'reelA'), JSON.stringify({ reel: 'r1', slot: 'reelA', state: 'partial',
    results: { facebook: { ok: true, id: 'F1' }, telegram: { ok: false, err: 'still down' } } }));
  STORE.set(key(d2, 'reelB'), JSON.stringify({ reel: 'r2', slot: 'reelB', state: 'sent',
    results: { facebook: { ok: true, id: 'F2' }, instagram: { ok: true, id: 'I2' } } }));
  STORE.set(key(d3, 'reelC'), JSON.stringify({ reel: 'r3', slot: 'reelC', state: 'failed',
    results: { facebook: { ok: false, err: 'refused' } } }));

  const r1 = await S.backfillPosted(DATE);
  ok(r1.days === 21, 'it walks the guard\'s own 21 day window: ' + r1.days);
  ok(r1.records === 2, 'two of the three stubbed days had an ok result somewhere: ' + r1.records);
  ok(r1.written === 3, 'three fields written: r1|facebook, r2|facebook and r2|instagram: ' + r1.written);

  const h = HASH.get('nsoc:reels:postedch') || new Map();
  ok(h.get('r1|facebook') === d1 + '#reelA' && h.get('r2|facebook') === d2 + '#reelB' && h.get('r2|instagram') === d2 + '#reelB',
     'each field points at the right date and slot: ' + JSON.stringify([...h.entries()]));
  ok(!h.has('r3|facebook'), 'the day with no ok result writes nothing');

  const r2 = await S.backfillPosted(DATE);
  ok(r2.records === 2 && r2.written === 3, 'idempotent: run again, same counts, nothing new to write: ' + JSON.stringify(r2));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
