/* NOOR · experiments: which arm, and what it learned.
   ------------------------------------------------------------------
   Nine months of insights can say what happened; an experiment says
   whether the difference is bigger than chance. This proves the pure
   arithmetic (api/_experiments.js: which day leans toward which arm, what
   a test has learned so far, a permutation test that answers the same way
   twice), that the picker (api/_schedule.js's chooseReel) leans toward an
   arm only when its own pool is wide enough and behaves exactly as before
   with no bias at all, that the owner-only endpoint is gated and validates
   what it is asked to plan, and that a KV fault never costs a post.

   Run:  node tests/experiments.mjs
*/
import fs from 'fs';
import crypto from 'crypto';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

/* ===========================================================================
   PART A · the pure arithmetic, no store, no network
=========================================================================== */
console.log('\n--- api/_experiments.js, pure ---');
const EXP = await import('../api/_experiments.js');
const { EXPERIMENTS, armFor, biasFrom, biasFromAny, evaluate, resolveCurrent } = EXP;

console.log('\narmFor: parity from the test\'s own start, null outside the window');
{
  const st = { current: { id: 'verse-length', start: '2026-01-10', args: {} } };
  ok(armFor({ current: null }, '2026-01-10') === null, 'no current test at all: null');
  ok(armFor(st, '2026-01-09') === null, 'the day before the start: planned, null');
  ok(armFor(st, '2026-01-10') === 'A', 'day zero is A');
  ok(armFor(st, '2026-01-11') === 'B', 'day one is B');
  ok(armFor(st, '2026-01-12') === 'A', 'day two is A again');
  ok(armFor(st, '2026-02-20') === 'B', 'parity keeps counting well past a 28 day window, since armFor alone knows nothing of the registry\'s own length');
}

console.log('\nbiasFrom: null outside the window, {id, arm, kind, match} inside it');
{
  const st = { current: { id: 'verse-length', start: '2026-01-10', args: {} } };
  ok(biasFrom({ current: null }, '2026-01-10', EXPERIMENTS) === null, 'no current test: null');
  ok(biasFrom(st, '2026-01-09', EXPERIMENTS) === null, 'before the start: null (planned)');
  const a = biasFrom(st, '2026-01-10', EXPERIMENTS);
  ok(a && a.id === 'verse-length' && a.arm === 'A' && a.kind === 'verse', 'day zero: arm A, kind verse: ' + JSON.stringify(a));
  ok(a.match({ secs: 10 }) === true && a.match({ secs: 25 }) === false, 'arm A\'s own predicate is the short-verse one');
  const b = biasFrom(st, '2026-01-11', EXPERIMENTS);
  ok(b.arm === 'B' && b.match({ secs: 35 }) === true && b.match({ secs: 10 }) === false, 'day one: arm B, the long-verse predicate');
  /* verse-length runs 28 days, index 0..27; the 28th day (index 28) is over */
  ok(biasFrom(st, '2026-02-06', EXPERIMENTS) !== null, 'day 27 (index 27) is still inside the window');
  ok(biasFrom(st, '2026-02-07', EXPERIMENTS) === null, 'day 28 (index 28) is the window closing: null');
  const bad = { current: { id: 'no-such-test', start: '2026-01-10', args: {} } };
  ok(biasFrom(bad, '2026-01-10', EXPERIMENTS) === null, 'an id the registry does not carry: null, never thrown');
}

console.log('\nbiasFromAny: the current test first, a stopped one in history next, for a date it actually covered, never past its own stoppedAt');
{
  const st = { current: null, history: [
    { id: 'verse-length', start: '2026-01-10', args: {}, stoppedAt: '2026-06-01T00:00:00.000Z' },
    { id: 'reciter-pair', start: '2025-01-01', args: { a: 'X', b: 'Y' }, stoppedAt: '2025-06-01T00:00:00.000Z' }
  ] };
  const inside = biasFromAny(st, '2026-01-11', EXPERIMENTS);
  ok(inside && inside.arm === 'B', 'a date inside the stopped test\'s own window, before it stopped, is reconstructed: ' + JSON.stringify(inside));
  ok(biasFromAny(st, '2020-01-01', EXPERIMENTS) === null, 'a date neither the current test nor any history entry covers: null');
  ok(biasFromAny(null, '2026-01-11', EXPERIMENTS) === null, 'no state at all: null, never thrown');

  /* a history entry with no stoppedAt at all (malformed: stopExperiment
     never writes one without it) never biases -- the honest failure mode is
     "no bias", not "biases forever" */
  const noEnd = { current: null, history: [{ id: 'verse-length', start: '2026-01-10', args: {} }] };
  ok(biasFromAny(noEnd, '2026-01-11', EXPERIMENTS) === null, 'a history entry with no stoppedAt at all never biases: not trusted to run forever');
}

console.log('\nstopping must stop: a test ended early never keeps leaning the picker, and a planned test cancelled before it began never switches on');
{
  /* stopped on day 5 of a 28 day run: days 0 through 4 still reconstruct
     (that is what the reel actually leaned on when it was posted); day 5
     and every day after, including the rest of the original 28, answer null */
  const stoppedEarly = { current: null, history: [{ id: 'verse-length', start: '2026-01-10', args: {}, stoppedAt: '2026-01-15T09:00:00.000Z' }] };
  ok(biasFromAny(stoppedEarly, '2026-01-14', EXPERIMENTS) !== null, 'day four, the day before the stop, still reconstructs its own arm');
  ok(biasFromAny(stoppedEarly, '2026-01-15', EXPERIMENTS) === null, 'the day it was stopped: no bias, the live posting path stops leaning at once');
  ok(biasFromAny(stoppedEarly, '2026-01-20', EXPERIMENTS) === null, 'a day later still, well inside the original 28: still no bias');
  ok(biasFromAny(stoppedEarly, '2026-02-07', EXPERIMENTS) === null, 'the day the original window would have closed: still no bias, it never runs that far again');

  /* planned for the future, then cancelled before its own start ever
     arrived: the start date, once it does arrive on the calendar, must
     never switch the bias on */
  const cancelledPlanned = { current: null, history: [{ id: 'verse-length', start: '2026-10-02', args: {}, stoppedAt: '2026-09-25T00:00:00.000Z' }] };
  ok(biasFromAny(cancelledPlanned, '2026-10-02', EXPERIMENTS) === null, 'a cancelled planned test never switches on at its own start date');
  ok(biasFromAny(cancelledPlanned, '2026-10-15', EXPERIMENTS) === null, 'nor at any date after it');
}

console.log('\nreciter-pair: arms built from args.a and args.b at plan time');
{
  const st = { current: { id: 'reciter-pair', start: '2026-03-01', args: { a: 'Ahmad al-Ajmi', b: 'Hani ar-Rifai' } } };
  const bias = biasFrom(st, '2026-03-01', EXPERIMENTS);
  ok(bias.match({ reciter: 'Ahmad al-Ajmi' }) === true && bias.match({ reciter: 'Hani ar-Rifai' }) === false, 'arm A matches only the named reciter a');
}

console.log('\nevaluate: status moves planned -> running -> ready, never further than the numbers carry');
{
  const st = { current: { id: 'verse-length', start: '2026-01-10', args: {} } };
  const cur = resolveCurrent(st, EXPERIMENTS);
  ok(!!cur && cur.days === 28 && cur.minPerArm === 10, 'resolveCurrent merges the registry entry with the plan\'s own start');

  const planned = evaluate(cur, [], '2026-01-05');
  ok(planned.status === 'planned', 'before the start: planned');

  /* a handful of rows, well under minPerArm, five days in: running */
  const fewRows = [
    { net: 'instagram', kind: 'reel:verse', date: '2026-01-10', secs: 10, reciter: null, reach: 100, watched: 0.9 },
    { net: 'instagram', kind: 'reel:verse', date: '2026-01-11', secs: 35, reciter: null, reach: 90, watched: 0.8 }
  ];
  const running = evaluate(cur, fewRows, '2026-01-15');
  ok(running.status === 'running', 'day five, arms not yet at minPerArm: running');
  ok(/too early/i.test(running.sentence) && running.sentence.includes('1') , 'the sentence says too early and carries the counts so far: ' + running.sentence);
  ok(running.verdict === null, 'no verdict while running');

  /* fourteen rows a side, a real gap in watched share, both arms already
     over minPerArm well before the window closes. A little jitter on
     `watched` (the same courtesy the old fixture gave `reach`) so the
     permutation test has something to actually discriminate on: two
     perfectly constant arms tie on every possible reshuffle's own median
     and the test loses all power, which is a fact about medians on
     duplicate values, not a fault in this file. */
  const rows = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.parse('2026-01-10T00:00:00Z') + (i % 14) * 86400000).toISOString().slice(0, 10);
    rows.push({ net: 'instagram', kind: 'reel:verse', date: d, secs: 12, reciter: null, reach: 90 + (i % 5), watched: 0.80 + (i % 5) * 0.02 });
    rows.push({ net: 'instagram', kind: 'reel:verse', date: d, secs: 34, reciter: null, reach: 150 + (i % 5), watched: 0.55 + (i % 5) * 0.02 });
  }
  /* NO EARLY VERDICT, EVEN WITH BOTH ARMS PAST minPerArm: day 15, both arms
     already carry twelve reels each -- ten years ago this would have called
     itself ready and handed back a verdict; now the window (28 days) is
     simply not over yet, so it stays "running" and says so */
  const early = evaluate(cur, rows, '2026-01-25');
  ok(early.status === 'running', 'day fifteen, both arms already past minPerArm, window not yet closed: still running, no peeking: ' + JSON.stringify({ status: early.status, An: early.arms[0].n, Bn: early.arms[1].n }));
  ok(early.verdict === null, 'and no verdict is offered early, whatever the counts already say');

  /* the window actually closed (day 28 or later): now, and only now, ready */
  const ready = evaluate(cur, rows, '2026-02-07');
  ok(ready.status === 'ready', 'the window is over: ready: ' + JSON.stringify({ status: ready.status, A: ready.arms[0], B: ready.arms[1] }));
  ok(ready.arms[0].n >= 10 && ready.arms[1].n >= 10, 'both arms actually carry at least ten reels: ' + ready.arms.map(a => a.n).join(','));
  /* watched share is the primary metric now, not reach: arm A holds people
     for a median 85% of the reel, arm B for 60%, so A wins the verdict even
     though B's own median reach is higher -- reach is reported beside it,
     never what decides */
  ok(ready.verdict === 'A', 'the arm that actually holds people longer wins the verdict, by watched share, not by reach: ' + ready.verdict);
  ok(ready.arms[1].reach > ready.arms[0].reach, 'reach itself still favours the other arm, so this is really testing watched share, not reach: ' + JSON.stringify(ready.arms));
  ok(!/[\u2014\u2013]/.test(ready.sentence), 'no dash in the sentence');
  ok(/\d+ and \d+ reels with a watch time, 28 days/.test(ready.sentence), 'the sentence carries both watched-row counts and the real number of days: ' + ready.sentence);
  ok(/^Shorter verses held people for a median 8[0-9] percent of the reel against 5[0-9] percent for longer verses/.test(ready.sentence), 'and reads as a natural sentence, watched share first: ' + ready.sentence);

  const ready2 = evaluate(cur, rows, '2026-02-07');
  ok(JSON.stringify(ready) === JSON.stringify(ready2), 'the same inputs answer the same p value and the same verdict every time: deterministic');

  /* the window simply closing, with too little on either side to say
     anything: ready, but verdict none and an honest "not enough" (the old
     MIN_VERDICT_N=3 floor is gone; minPerArm, 10, is the one gate now) */
  const thin = evaluate(cur, fewRows, '2026-02-10');
  ok(thin.status === 'ready' && thin.verdict === 'none', 'the window over with too little data: ready, but no verdict claimed');
  ok(/not enough/i.test(thin.sentence), 'and the sentence says so plainly: ' + thin.sentence);

  /* a real gap, but under the ten percent floor: even a p value near zero
     never earns a verdict alone */
  const closeRows = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.parse('2026-01-10T00:00:00Z') + (i % 14) * 86400000).toISOString().slice(0, 10);
    closeRows.push({ net: 'instagram', kind: 'reel:verse', date: d, secs: 12, reciter: null, reach: 100, watched: 0.50 + (i % 3) * 0.001 });
    closeRows.push({ net: 'instagram', kind: 'reel:verse', date: d, secs: 34, reciter: null, reach: 100, watched: 0.46 + (i % 3) * 0.001 });
  }
  const close = evaluate(cur, closeRows, '2026-02-07');
  ok(close.status === 'ready' && close.verdict === 'none', 'a gap under ten percent never earns a verdict, however tight the numbers: ' + JSON.stringify({ p: close.sentence, A: close.arms[0].watched, B: close.arms[1].watched }));
}

console.log('\nevaluate: minPerArm applies to rows that actually carry a watched number, never the bigger count of every matched row');
{
  const st = { current: { id: 'verse-length', start: '2026-01-10', args: {} } };
  const cur = resolveCurrent(st, EXPERIMENTS);
  /* ten reels a side match the arm, but only five a side ever answered a
     watch time -- the second-round review's own case: A.n/B.n (ten) used
     to clear minPerArm while the test itself only had five values a side
     to actually compare */
  const rows = [];
  for (let i = 0; i < 10; i++) {
    const d = new Date(Date.parse('2026-01-10T00:00:00Z') + (i % 14) * 86400000).toISOString().slice(0, 10);
    rows.push({ net: 'instagram', kind: 'reel:verse', date: d, secs: 12, reciter: null, reach: 100, watched: i < 5 ? null : 0.80 });
    rows.push({ net: 'instagram', kind: 'reel:verse', date: d, secs: 34, reciter: null, reach: 100, watched: i < 5 ? null : 0.55 });
  }
  const out = evaluate(cur, rows, '2026-02-07');
  ok(out.arms[0].n === 10 && out.arms[1].n === 10, 'both arms still carry all ten matched reels: ' + JSON.stringify(out.arms.map(a => a.n)));
  ok(out.status === 'ready' && out.verdict === 'none', 'but only five a side ever carry a watch time, under minPerArm (10): no verdict, however many reels merely matched: ' + JSON.stringify({ status: out.status, verdict: out.verdict }));
  ok(/not enough/i.test(out.sentence) && /5 and 5 reels with a watch time/.test(out.sentence), 'and the sentence names the measured count, never the bigger matched count: ' + out.sentence);
}

console.log('\nevaluate: a zero median on the lower arm never blocks a verdict; the gap is percentage points, not a ratio');
{
  const st = { current: { id: 'verse-length', start: '2026-01-10', args: {} } };
  const cur = resolveCurrent(st, EXPERIMENTS);
  const rows = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.parse('2026-01-10T00:00:00Z') + (i % 14) * 86400000).toISOString().slice(0, 10);
    /* the lower arm's own watched share is exactly zero, every single row:
       a ratio (higher minus lower, divided by lower) is undefined right
       here, which used to force "none" no matter how real or how big the
       gap actually was */
    rows.push({ net: 'instagram', kind: 'reel:verse', date: d, secs: 12, reciter: null, reach: 100, watched: 0.15 + (i % 5) * 0.01 });
    rows.push({ net: 'instagram', kind: 'reel:verse', date: d, secs: 34, reciter: null, reach: 100, watched: 0 });
  }
  const out = evaluate(cur, rows, '2026-02-07');
  ok(out.arms[1].watched === 0, 'the lower arm really did median to zero: ' + JSON.stringify(out.arms[1]));
  ok(out.status === 'ready' && out.verdict === 'A', 'a zero lower median no longer blocks the verdict: ' + out.verdict);
  ok(/16 percent of the reel against 0 percent for longer verses, a gap of 16 percentage points/.test(out.sentence), 'the sentence states the true gap in percentage points, zero included, and says "points": ' + out.sentence);
}

console.log('\nevaluate: reciter-pair reads as a natural sentence, "Recitations by ... held people ... for ..."');
{
  const st = { current: { id: 'reciter-pair', start: '2026-01-10', args: { a: 'Maher al-Muaiqly', b: 'Ahmad al-Ajmi' } } };
  const cur = resolveCurrent(st, EXPERIMENTS);
  const rows = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.parse('2026-01-10T00:00:00Z') + (i % 14) * 86400000).toISOString().slice(0, 10);
    /* a little jitter on watched, the same reason the verse-length fixture
       above carries it: a permutation test needs values that actually vary
       to have any power at all */
    rows.push({ net: 'instagram', kind: 'reel:verse', date: d, secs: 20, reciter: 'Maher al-Muaiqly', reach: 100, watched: 0.58 + (i % 5) * 0.02 });
    rows.push({ net: 'instagram', kind: 'reel:verse', date: d, secs: 20, reciter: 'Ahmad al-Ajmi', reach: 100, watched: 0.44 + (i % 5) * 0.02 });
  }
  const out = evaluate(cur, rows, '2026-02-07');
  ok(out.status === 'ready' && out.verdict === 'A', 'Maher al-Muaiqly\'s arm holds people longer and wins: ' + out.verdict);
  ok(/^Recitations by Maher al-Muaiqly held people for a median 6[0-9] percent of the reel against 4[0-9] percent for Ahmad al-Ajmi, a gap of \d+ percentage points \(12 and 12 reels with a watch time, 28 days\)\./.test(out.sentence),
     'the sentence names both reciters by their own names, never the internal arm label, and states the gap in points: ' + out.sentence);
  ok(!/[\u2014\u2013]/.test(out.sentence), 'no dash in the reciter sentence either');
}

/* ===========================================================================
   PART B · api/_schedule.js's chooseReel leans toward an arm's own pool
=========================================================================== */
console.log('\n--- api/_schedule.js, chooseReel with a bias ---');
const S = await import('../api/_schedule.js');
{
  const MAN = [];
  /* twenty verse cards: ten short, ten long, so an 8-card floor can be
     tested both being met and being starved */
  for (let i = 0; i < 10; i++) MAN.push({ id: 'verse-short-' + i, kind: 'verse', slot: 'morning', hook: 'v', caption: 'c', secs: 12 });
  for (let i = 0; i < 10; i++) MAN.push({ id: 'verse-long-' + i, kind: 'verse', slot: 'morning', hook: 'v', caption: 'c', secs: 35 });
  for (let i = 0; i < 20; i++) MAN.push({ id: 'word-' + i, kind: 'word', slot: 'morning', hook: 'w', caption: 'c' });
  for (let i = 0; i < 6; i++) MAN.push({ id: 'know-' + i, kind: 'know', slot: 'morning', hook: 'k', caption: 'c' });

  const biasShort = { kind: 'verse', arm: 'A', match: c => c.secs < 20 };
  const dates = ['2026-09-13', '2026-09-08']; /* both land on 'verse' in the morning rota */

  console.log('a wide enough pool: the picker leans toward the arm');
  for (const d of dates) {
    const c = S.chooseReel(MAN, d, 'morning', null, new Set(), biasShort);
    if (c && c.kind === 'verse') ok(c.secs < 20, d + ': the chosen verse is short, the arm\'s own predicate: ' + c.id);
  }

  console.log('a starved pool (fewer than 8 fresh cards left) falls back to the whole kind');
  {
    const seen = new Set(MAN.filter(c => c.kind === 'verse' && c.secs < 20).slice(0, 4).map(c => c.id));
    /* only 6 short verses remain unseen, under the 8-card floor */
    const withBias = S.chooseReel(MAN, '2026-09-13', 'morning', null, seen, biasShort);
    const withoutBias = S.chooseReel(MAN, '2026-09-13', 'morning', null, seen, null);
    ok(withBias && withoutBias && withBias.id === withoutBias.id, 'the starved arm changes nothing: the same card either way: ' + (withBias && withBias.id));
  }

  console.log('the optional 7th argument, report: usedArm is true only when the arm\'s own pool was actually walked, never merely offered');
  {
    const r1 = {};
    S.chooseReel(MAN, dates[0], 'morning', null, new Set(), biasShort, r1);
    ok(r1.usedArm === true, 'a wide enough pool sets report.usedArm: ' + JSON.stringify(r1));

    const seen = new Set(MAN.filter(c => c.kind === 'verse' && c.secs < 20).slice(0, 4).map(c => c.id));
    const r2 = {};
    S.chooseReel(MAN, '2026-09-13', 'morning', null, seen, biasShort, r2);
    ok(!r2.usedArm, 'a starved pool never sets report.usedArm, whatever the picker actually lands on: ' + JSON.stringify(r2));

    const r3 = {};
    S.chooseReel(MAN, dates[0], 'morning', null, new Set(), null, r3);
    ok(!r3.usedArm, 'no bias at all never sets report.usedArm');
  }

  console.log('no bias at all is untouched');
  {
    const a = S.chooseReel(MAN, '2026-09-13', 'morning', null, new Set());
    const b = S.chooseReel(MAN, '2026-09-13', 'morning', null, new Set(), null);
    ok(a && b && a.id === b.id, 'a call with no sixth argument and one with an explicit null answer the same card');
  }

  console.log('a bias for the wrong kind is ignored');
  {
    const wrongKind = { kind: 'word', arm: 'A', match: () => true };
    const a = S.chooseReel(MAN, '2026-09-13', 'morning', null, new Set());
    const b = S.chooseReel(MAN, '2026-09-13', 'morning', null, new Set(), wrongKind);
    ok(a.id === b.id, 'the morning rota wants a verse today, so a bias about words changes nothing');
  }
}

/* ===========================================================================
   PART C · the owner-only endpoint: gated, validated, and the plan/stop doors
=========================================================================== */
console.log('\n--- api/experiments.js, owner-gated ---');
process.env.ADMIN_SECRET = 'test-secret-experiments';
process.env.KV_REST_API_URL = 'https://kv.experiments.test';
process.env.KV_REST_API_TOKEN = 't';
const STORE = new Map();
let failNexpGet = false;
/* every SET this whole part issues, key only, so a test can clear it right
   before one call and prove that call wrote nothing -- specifically, that
   a GET never composes and writes the Observatory's own K_OBS cache (the
   second review's own finding: the first version of the read-only fix
   still called `cached`, which composes AND writes on a miss) */
const setLog = [];
globalThis.fetch = async (url, opt) => {
  const u = String(url);
  if (u.startsWith('https://kv.experiments.test')) {
    const cmds = JSON.parse(opt.body);
    if (failNexpGet && cmds.length === 1 && cmds[0][0] === 'GET' && cmds[0][1] === 'nexp:state')
      return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => cmds.map(c => {
      const [v, k, ...r] = c;
      if (v === 'GET') return { result: STORE.has(k) ? STORE.get(k) : null };
      if (v === 'SET') { setLog.push(k); STORE.set(k, r[0]); return { result: 'OK' }; }
      if (v === 'MGET') return { result: [k, ...r].map(kk => STORE.has(kk) ? STORE.get(kk) : null) };
      if (v === 'DEL') { const had = STORE.has(k); STORE.delete(k); return { result: had ? 1 : 0 }; }
      return { result: null };
    }) };
  }
  /* everything else (the shelf, the library) answers "not found" rather than
     throw, exactly what api/_insights.js's own read() already survives */
  return { ok: false, status: 404, json: async () => ({}) };
};

const EP = await import('../api/experiments.js');
function fakeRes() {
  return { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}
function cookieFor(secret) {
  const exp = Date.now() + 100000;
  const sig = crypto.createHmac('sha256', secret).update(String(exp)).digest('hex');
  return 'noor_admin=' + exp + '.' + sig;
}
const AUTH = { cookie: cookieFor(process.env.ADMIN_SECRET) };

console.log('the gate');
{
  const saved = process.env.ADMIN_SECRET;
  delete process.env.ADMIN_SECRET;
  const r1 = fakeRes();
  await EP.default({ method: 'GET', query: {}, headers: {} }, r1);
  ok(r1.statusCode === 501, 'no ADMIN_SECRET at all: 501');
  process.env.ADMIN_SECRET = saved;

  const r2 = fakeRes();
  await EP.default({ method: 'GET', query: {}, headers: {} }, r2);
  ok(r2.statusCode === 401, 'a secret is set but no cookie rides with the request: 401');

  const r3 = fakeRes();
  await EP.default({ method: 'GET', query: {}, headers: AUTH }, r3);
  ok(r3.statusCode === 200 && r3.body.ok === true, 'the right cookie: in');
}

console.log('GET with nothing planned');
{
  const r = fakeRes();
  await EP.default({ method: 'GET', query: {}, headers: AUTH }, r);
  ok(Array.isArray(r.body.registry) && r.body.registry.length === 2, 'the registry lists both tests: ' + r.body.registry.map(x => x.id).join(', '));
  ok(r.body.state.current === null && r.body.evaluation === null, 'no test is current, so no evaluation either');
  ok(Array.isArray(r.body.history) && r.body.history.length === 0, 'and no history yet');
}

console.log('planning: refusals');
{
  const r1 = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'plan', id: 'no-such-test', start: '2026-10-02' } }, r1);
  ok(r1.body.ok === false, 'an unknown id is refused: ' + r1.body.error);

  const r2 = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'plan', id: 'verse-length', start: 'not-a-date' } }, r2);
  ok(r2.body.ok === false, 'a start that is not YYYY-MM-DD is refused: ' + r2.body.error);

  const r3 = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'plan', id: 'reciter-pair', start: '2026-10-02', args: { a: 'Ahmad al-Ajmi' } } }, r3);
  ok(r3.body.ok === false, 'reciter-pair with only one reciter named is refused: ' + r3.body.error);

  const r4 = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'plan', id: 'reciter-pair', start: '2026-10-02', args: { a: 'Ahmad al-Ajmi', b: 'Nobody Reciting At All' } } }, r4);
  ok(r4.body.ok === false && /fewer than 20/.test(r4.body.error), 'a reciter with under 20 reels on the real shelf is refused: ' + r4.body.error);

  /* an id the registry object's own prototype happens to answer to, never
     resolved through a bracket read */
  const r5 = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'plan', id: 'constructor', start: '2026-10-02' } }, r5);
  ok(r5.body.ok === false && /no such experiment/.test(r5.body.error), '"constructor" is refused as an unknown id, never resolved off the prototype: ' + r5.body.error);

  /* a shape that matches YYYY-MM-DD but names no real day */
  const r6 = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'plan', id: 'verse-length', start: '2026-02-31' } }, r6);
  ok(r6.body.ok === false && /real date/.test(r6.body.error), 'February the 31st is refused, though it matches the shape of a date: ' + r6.body.error);

  /* a real date, safely in the past */
  const r7 = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'plan', id: 'verse-length', start: '2020-01-01' } }, r7);
  ok(r7.body.ok === false && /today.*or later|later/.test(r7.body.error), 'a start already in the past is refused: ' + r7.body.error);

  /* an argument key the registry never documented for this test */
  const r8 = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'plan', id: 'verse-length', start: '2026-10-02', args: { extra: 'x' } } }, r8);
  ok(r8.body.ok === false && /unknown argument/.test(r8.body.error), 'an argument verse-length never documented is refused: ' + r8.body.error);

  /* a string argument well past a short, sane length */
  const r9 = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'plan', id: 'reciter-pair', start: '2026-10-02', args: { a: 'Ahmad al-Ajmi'.repeat(10), b: 'Hani ar-Rifai' } } }, r9);
  ok(r9.body.ok === false && /short/.test(r9.body.error), 'an overlong reciter name is refused before the shelf is even asked: ' + r9.body.error);
}

console.log('planning and stopping a real one');
{
  const r1 = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'plan', id: 'verse-length', start: '2026-10-02' } }, r1);
  ok(r1.body.ok === true && r1.body.state.current.id === 'verse-length', 'verse-length is planned: ' + JSON.stringify(r1.body.state.current));

  const r2 = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'plan', id: 'reciter-pair', start: '2026-11-01' } }, r2);
  ok(r2.body.ok === false && /already/.test(r2.body.error), 'a second test cannot be planned while one is current: ' + r2.body.error);

  const rGet = fakeRes();
  await EP.default({ method: 'GET', query: {}, headers: AUTH }, rGet);
  ok(rGet.body.state.current.id === 'verse-length' && rGet.body.evaluation && rGet.body.evaluation.status === 'planned', 'GET now shows it current and planned (its start is in the future)');

  /* GET must never compose or write the Observatory's own shared cache: a
     read-only door (readCache), never `cached` (which composes AND writes
     on a miss). Proved directly: the cache is cold right here (no test has
     ever planted nsoc:observatory:v1 in this Map), a current test exists so
     readEvaluation's fallback runs (a fresh insightsRead), and still not a
     single SET reaches the store during this call. */
  ok(!STORE.has('nsoc:observatory:v1'), 'the cache really is cold going into this: nothing has written it yet');
  setLog.length = 0;
  const rGetCold = fakeRes();
  await EP.default({ method: 'GET', query: {}, headers: AUTH }, rGetCold);
  ok(rGetCold.body.ok === true && rGetCold.body.evaluation, 'GET still answers a real evaluation with the cache cold: ' + rGetCold.body.evaluation.status);
  ok(setLog.length === 0, 'and issues no SET at all while doing it, to any key: ' + JSON.stringify(setLog));
  ok(!STORE.has('nsoc:observatory:v1'), 'the Observatory cache is still cold afterward: GET never composed or wrote it');

  /* GET used to cost about 660 slot reads every time (a fresh insightsRead
     collect); it now reuses the Observatory's own ten minute cache when
     that cache was built against this exact test. Proved here by planting
     a fabricated cache entry directly (nsoc:observatory:v1, the same key
     api/observatory.js writes) and confirming GET hands back exactly that
     fabricated evaluation rather than recomputing one of its own -- a real
     recompute of a freshly planned test with no posts yet would answer
     "Planned to start ...", never this sentence. */
  const fabricated = { at: new Date().toISOString(), experiment: {
    id: 'verse-length', start: '2026-10-02', question: 'q', kind: 'verse', day: 5, days: 28,
    status: 'running', arms: [], verdict: null, sentence: 'this reading came from the shared Observatory cache, not a fresh collect' } };
  STORE.set('nsoc:observatory:v1', JSON.stringify(fabricated));
  const rGetCached = fakeRes();
  await EP.default({ method: 'GET', query: {}, headers: AUTH }, rGetCached);
  ok(rGetCached.body.evaluation && rGetCached.body.evaluation.sentence === fabricated.experiment.sentence,
     'GET reuses the shared cache\'s own evaluation when it matches the current test: ' + JSON.stringify(rGetCached.body.evaluation && rGetCached.body.evaluation.sentence));

  /* a fabricated cache entry for a DIFFERENT test (a different start) is
     never trusted -- GET falls back to a fresh read rather than answering
     with someone else's test */
  STORE.set('nsoc:observatory:v1', JSON.stringify({ at: new Date().toISOString(), experiment: { id: 'verse-length', start: '2020-01-01', sentence: 'stale, a different test entirely' } }));
  const rGetMismatch = fakeRes();
  await EP.default({ method: 'GET', query: {}, headers: AUTH }, rGetMismatch);
  ok(rGetMismatch.body.evaluation && rGetMismatch.body.evaluation.sentence !== 'stale, a different test entirely',
     'a cache built against a different test\'s start is never reused: ' + JSON.stringify(rGetMismatch.body.evaluation && rGetMismatch.body.evaluation.sentence));

  /* stopping invalidates the shared cache, so the console's own room reads
     the real, post-stop state on its very next open rather than an
     evaluation of a test that is no longer current */
  STORE.set('nsoc:observatory:v1', JSON.stringify(fabricated));
  const rStop = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'stop' } }, rStop);
  ok(rStop.body.ok === true && rStop.body.state.current === null, 'stopping clears current: ' + JSON.stringify(rStop.body.state));
  ok(rStop.body.state.history.length === 1 && rStop.body.state.history[0].id === 'verse-length', 'and folds it into history');
  ok(!STORE.has('nsoc:observatory:v1'), 'stopping invalidated the shared Observatory cache: the fabricated entry is gone');

  const rStop2 = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'stop' } }, rStop2);
  ok(rStop2.body.ok === false, 'stopping with nothing running is refused: ' + rStop2.body.error);
}

console.log('a reciter reciter-pair plans cleanly with two real reciters');
{
  const r = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'plan', id: 'reciter-pair', start: '2026-10-02', args: { a: 'Ahmad al-Ajmi', b: 'Hani ar-Rifai' } } }, r);
  ok(r.body.ok === true, 'two reciters each with at least 20 verse reels: planned: ' + (r.body.error || 'ok'));
  const rStop = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'stop' } }, rStop);
  ok(rStop.body.ok === true, 'cleared again, so the store starts the next part empty');
}

console.log('a malformed state must never take a reader down');
{
  /* the exact shape that once made biasFromAny throw, called unguarded from
     api/_insights.js's own collect(): {"history":[null]}. GET reads
     through readState -> sanitizeState, which drops the null entry rather
     than choking on it. */
  STORE.set('nexp:state', JSON.stringify({ history: [null] }));
  const r1 = fakeRes();
  await EP.default({ method: 'GET', query: {}, headers: AUTH }, r1);
  ok(r1.statusCode === 200 && r1.body.ok === true, 'a null entry in history never brings the endpoint down: ' + JSON.stringify(r1.body).slice(0, 120));
  ok(r1.body.state.current === null && Array.isArray(r1.body.state.history) && r1.body.state.history.length === 0, 'the bad entry is dropped, not kept: ' + JSON.stringify(r1.body.state));

  /* a current with no start, or a stray string where an object belongs:
     both sanitize to "nothing running" rather than crash resolveCurrent */
  STORE.set('nexp:state', JSON.stringify({ current: { id: 'verse-length' }, history: 'not-an-array' }));
  const r2 = fakeRes();
  await EP.default({ method: 'GET', query: {}, headers: AUTH }, r2);
  ok(r2.statusCode === 200 && r2.body.state.current === null && r2.body.state.history.length === 0, 'a current with no start, and a history that is not even an array, both sanitize to empty: ' + JSON.stringify(r2.body.state));

  STORE.set('nexp:state', JSON.stringify({ current: null, history: [] }));
}

console.log('a KV read fault must never wipe the store: a real history is refused, never silently overwritten with an empty one');
{
  /* seed the store directly with what looks like real, hard won history */
  const seeded = { current: null, history: [{ id: 'verse-length', start: '2025-01-01', args: {}, stoppedAt: '2025-01-29T00:00:00.000Z',
    status: 'ready', question: 'q', kind: 'verse', day: 28, days: 28, arms: [], verdict: 'none', sentence: 's' }] };
  STORE.set('nexp:state', JSON.stringify(seeded));

  failNexpGet = true;
  const rPlan = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'plan', id: 'verse-length', start: '2026-10-02' } }, rPlan);
  ok(rPlan.body.ok === false && /could not be read/.test(rPlan.body.error), 'a KV fault while planning refuses rather than guessing the store empty: ' + rPlan.body.error);

  const rStop = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'stop' } }, rStop);
  ok(rStop.body.ok === false, 'a KV fault while stopping refuses too (nothing was current to begin with, but the read itself is what failed first): ' + rStop.body.error);

  failNexpGet = false;
  ok(STORE.get('nexp:state') === JSON.stringify(seeded), 'the store itself was never touched while the read was failing: the real history is still exactly there');

  const rGet = fakeRes();
  await EP.default({ method: 'GET', query: {}, headers: AUTH }, rGet);
  ok(rGet.body.history.length === 1 && rGet.body.history[0].id === 'verse-length', 'and reads back exactly as it was seeded, once the store answers again');
  STORE.set('nexp:state', JSON.stringify({ current: null, history: [] }));
}

/* ===========================================================================
   PART D · the posting path: exp on the slot record, and a KV fault that
   never costs a post
=========================================================================== */
console.log('\n--- the posting path ---');
{
  const MANIFEST = { n: 20, written: '2026-09-01', cards: [
    { id: 'verse-short-1', kind: 'verse', slot: 'morning', hook: 'A short verse', caption: 'c', secs: 12, video: '/reels/verse-short-1.mp4', cover: '/reels/verse-short-1-cover.jpg' },
    { id: 'verse-short-2', kind: 'verse', slot: 'morning', hook: 'Another short verse', caption: 'c', secs: 13, video: '/reels/verse-short-2.mp4', cover: '/reels/verse-short-2-cover.jpg' },
    { id: 'verse-short-3', kind: 'verse', slot: 'morning', hook: 'Yet a third', caption: 'c', secs: 14, video: '/reels/verse-short-3.mp4', cover: '/reels/verse-short-3-cover.jpg' },
    { id: 'verse-short-4', kind: 'verse', slot: 'morning', hook: 'And a fourth', caption: 'c', secs: 15, video: '/reels/verse-short-4.mp4', cover: '/reels/verse-short-4-cover.jpg' },
    { id: 'verse-short-5', kind: 'verse', slot: 'morning', hook: 'Fifth', caption: 'c', secs: 16, video: '/reels/verse-short-5.mp4', cover: '/reels/verse-short-5-cover.jpg' },
    { id: 'verse-short-6', kind: 'verse', slot: 'morning', hook: 'Sixth', caption: 'c', secs: 17, video: '/reels/verse-short-6.mp4', cover: '/reels/verse-short-6-cover.jpg' },
    { id: 'verse-short-7', kind: 'verse', slot: 'morning', hook: 'Seventh', caption: 'c', secs: 18, video: '/reels/verse-short-7.mp4', cover: '/reels/verse-short-7-cover.jpg' },
    { id: 'verse-short-8', kind: 'verse', slot: 'morning', hook: 'Eighth', caption: 'c', secs: 19, video: '/reels/verse-short-8.mp4', cover: '/reels/verse-short-8-cover.jpg' },
    { id: 'verse-long-1', kind: 'verse', slot: 'morning', hook: 'A long verse', caption: 'c', secs: 35, video: '/reels/verse-long-1.mp4', cover: '/reels/verse-long-1-cover.jpg' }
  ] };
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith('https://kv.experiments.test')) throw new Error('this part reads the experiment state through opts.kv, never the network');
    if (u.includes('/reels/index.json')) return { ok: true, status: 200, json: async () => MANIFEST };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const SOC = await import('../api/social.js');

  /* a bias handed straight to composeSlot through opts.kv/opts.kvReady, the
     same injection every other pure function in this house takes, so this
     part never has to fight the global fetch stub over the same store */
  const st = { current: { id: 'verse-length', start: '2026-09-13', args: {} }, history: [] };
  const goodKv = async cmds => cmds.map(c => (c[0] === 'GET' && c[1] === 'nexp:state') ? JSON.stringify(st) : null);
  const failKv = async () => { throw new Error('the store is down'); };

  console.log('a bias in force, and a wide enough pool: the composed reel carries exp');
  {
    const post = await SOC.composeSlot('noorcodex.com', '2026-09-13', 'reelA',
      { plan: { hijri: null, day: null, leads: [] }, kv: goodKv, kvReady: () => true });
    ok(!!post && post.reel === true, 'a reel was actually composed: ' + (post && post.title));
    ok(post && (/^verse-short-/.test(post.key)), 'the arm the day leans toward (day zero, arm A, under 20 seconds) is the card actually chosen: ' + (post && post.key));
    ok(post && post.exp && post.exp.id === 'verse-length' && post.exp.arm === 'A', 'and the post itself carries which test and which arm: ' + JSON.stringify(post && post.exp));
  }

  console.log('a KV fault reading the experiment state never fails the post');
  {
    const post = await SOC.composeSlot('noorcodex.com', '2026-09-13', 'reelA',
      { plan: { hijri: null, day: null, leads: [] }, kv: failKv, kvReady: () => true });
    ok(!!post && post.reel === true, 'the reel still composes with the store down: ' + (post && post.title));
    ok(!post.exp, 'and it carries no exp, exactly the day before any experiment existed');
  }

  console.log('no store configured at all behaves the same way');
  {
    const post = await SOC.composeSlot('noorcodex.com', '2026-09-13', 'reelA',
      { plan: { hijri: null, day: null, leads: [] }, kvReady: () => false });
    ok(!!post && post.reel === true && !post.exp, 'composes cleanly, no bias, no exp');
  }

  console.log('exp is written only when the arm\'s own pool was actually walked, never on a fallback that merely happens to match');
  {
    /* every card on this shelf is a short verse, so a fallback walk over the
       whole kind (the arm's own pool starved, under 8) lands on a card that
       still matches the arm's own predicate every single time -- exactly the
       shape that used to tag exp on a post the picker never actually leaned
       toward */
    const STARVED = { n: 3, written: '2026-09-01', cards: [
      { id: 'verse-only-1', kind: 'verse', slot: 'morning', hook: 'One', caption: 'c', secs: 11, video: '/reels/verse-only-1.mp4', cover: '/reels/verse-only-1-cover.jpg' },
      { id: 'verse-only-2', kind: 'verse', slot: 'morning', hook: 'Two', caption: 'c', secs: 12, video: '/reels/verse-only-2.mp4', cover: '/reels/verse-only-2-cover.jpg' },
      { id: 'verse-only-3', kind: 'verse', slot: 'morning', hook: 'Three', caption: 'c', secs: 13, video: '/reels/verse-only-3.mp4', cover: '/reels/verse-only-3-cover.jpg' }
    ] };
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/reels/index.json')) return { ok: true, status: 200, json: async () => STARVED };
      return { ok: false, status: 404, json: async () => ({}) };
    };
    const bias = { id: 'verse-length', arm: 'A', kind: 'verse', match: c => c.secs < 20 };
    const out = await S.slotExtras('noorcodex.com', '2026-09-13', null, 'reelA', null, null, new Set(), bias);
    ok(out.reel && out.reel.secs < 20, 'the card chosen still matches the arm\'s own predicate, by coincidence, since the whole shelf does: ' + (out.reel && out.reel.id));
    ok(!out.reel.exp, 'but exp is not written: the arm\'s own pool (three cards) never reached the eight card floor, so it was never actually walked: ' + JSON.stringify(out.reel && out.reel.exp));
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
