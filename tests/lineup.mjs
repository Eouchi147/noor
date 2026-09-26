/* NOOR · one reel slot, one day, changed by hand.
   ------------------------------------------------------------------
   Part A proves api/_lineup.js on its own, with a tiny in-memory store
   handed in through ctx.kv/ctx.kvReady exactly the way api/_experiments.js's
   own functions take one: every refusal the Director's brief named (a past
   date, eight days ahead, a non-reel slot, a slot already recorded, an
   unknown card, a card in the duplicate guard's own window, a card already
   chosen for another slot that day), and that a KV fault or a malformed
   value on the READ side (overrideFor, the posting path's own door) fails
   open exactly the way api/_experiments.js's biasFor does, never blocking
   a post.

   Part B proves the owner-gated door, api/lineup.js: the cookie is
   required, GET reflects the day (an override, and what the rota would
   post around it), POST set and clear round-trip through the real store.

   Part C proves the posting path itself, api/social.js's sendSlot and
   runDue: a skip never reaches a network and writes a record the retry
   path and the ledger of posted reels both read as settled, not missed; a
   swap posts the exact card named, once, and is never sent twice; an
   unknown swap id falls back to the ordinary pick rather than failing the
   slot; and the day's own preview (action=today) shows the same thing the
   poster actually did.

   Run:  node tests/lineup.mjs
*/
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

/* ===========================================================================
   PART A · api/_lineup.js, pure, a tiny store handed in
=========================================================================== */
console.log('\n--- api/_lineup.js, validation ---');
const L = await import('../api/_lineup.js');

/* a plain in-memory store, the same shape api/_kv.js's own kv() answers:
   an array of raw results, one a command, never wrapped in {result} --
   that unwrapping is _kv.js's own job, and this replaces it entirely. */
function makeKv() {
  const strings = new Map(), hashes = new Map();
  const run = async cmds => cmds.map(c => {
    const [op, ...a] = c;
    if (op === 'GET') return strings.has(a[0]) ? strings.get(a[0]) : null;
    if (op === 'SET') { strings.set(a[0], a[1]); return 'OK'; }
    if (op === 'DEL') { strings.delete(a[0]); return 1; }
    if (op === 'HSET') { const h = hashes.get(a[0]) || new Map(); h.set(a[1], a[2]); hashes.set(a[0], h); return 1; }
    if (op === 'HGETALL') { const h = hashes.get(a[0]); const flat = []; if (h) for (const [k, v] of h) flat.push(k, v); return flat; }
    return null;
  });
  return { strings, hashes, kv: run, kvReady: () => true };
}
const today = new Date().toISOString().slice(0, 10);
const inDays = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const MANIFEST = [
  { id: 'card-evening-1', kind: 'light', slot: 'evening' },
  { id: 'card-evening-2', kind: 'light', slot: 'evening' },
  { id: 'card-noon-1', kind: 'light', slot: 'noon' }
];

console.log('\nrefusals, one rule at a time');
{
  const store = makeKv();
  const ctxOf = extra => ({ kv: store.kv, kvReady: store.kvReady, now: today, manifest: MANIFEST, ...extra });

  const r1 = await L.validateOverride({ date: today, slot: 'dawn', action: 'skip' }, ctxOf());
  ok(!r1.ok && /only a reel slot/.test(r1.error), 'a slot that is not a reel is refused: ' + r1.error);

  const r2 = await L.validateOverride({ date: inDays(-1), slot: 'reelB', action: 'skip' }, ctxOf());
  ok(!r2.ok && /already passed/.test(r2.error), 'a date already past is refused: ' + r2.error);

  const r3 = await L.validateOverride({ date: inDays(8), slot: 'reelB', action: 'skip' }, ctxOf());
  ok(!r3.ok && /7 days ahead/.test(r3.error), 'eight days ahead is refused: ' + r3.error);
  const r3b = await L.validateOverride({ date: inDays(7), slot: 'reelB', action: 'skip' }, ctxOf());
  ok(r3b.ok, 'exactly seven days ahead is allowed: ' + JSON.stringify(r3b));

  const r4 = await L.validateOverride({ date: today, slot: 'reelB', action: 'sing' }, ctxOf());
  ok(!r4.ok && /action must be skip or swap/.test(r4.error), 'an action that is neither skip nor swap is refused: ' + r4.error);

  store.strings.set('nsoc:slot:' + today + '#reelB', JSON.stringify({ state: 'sent' }));
  const r5 = await L.validateOverride({ date: today, slot: 'reelB', action: 'skip' }, ctxOf());
  ok(!r5.ok && /already has something recorded/.test(r5.error), 'a slot with anything already recorded is refused, sent or not: ' + r5.error);
  store.strings.delete('nsoc:slot:' + today + '#reelB');

  const r6 = await L.validateOverride({ date: today, slot: 'reelB', action: 'swap', id: 'no-such-card' }, ctxOf());
  ok(!r6.ok && /no such card/.test(r6.error), 'an id the shelf does not carry is refused: ' + r6.error);

  const r7 = await L.validateOverride({ date: today, slot: 'reelB', action: 'swap' }, ctxOf());
  ok(!r7.ok && /needs a card id/.test(r7.error), 'a swap with no id at all is refused: ' + r7.error);

  const r8 = await L.validateOverride({ date: today, slot: 'reelB', action: 'swap', id: 'card-noon-1' }, ctxOf());
  ok(!r8.ok && /noon half/.test(r8.error), 'a card that belongs to a different half is refused: ' + r8.error);

  const seenMap = new Map([['card-evening-1', today]]);
  const r9 = await L.validateOverride({ date: today, slot: 'reelB', action: 'swap', id: 'card-evening-1' }, ctxOf({ seen: seenMap }));
  ok(!r9.ok && /duplicate guard/.test(r9.error), 'a card inside the duplicate guard\'s own window (seen handed in) is refused: ' + r9.error);

  await store.kv([['HSET', 'nsoc:reels:postedch', 'card-evening-1|instagram', today + '#reelB']]);
  const r10 = await L.validateOverride({ date: today, slot: 'reelB', action: 'swap', id: 'card-evening-1' }, ctxOf());
  ok(!r10.ok && /duplicate guard/.test(r10.error), 'the same window, read directly from the hash when no seen was handed in: ' + r10.error);

  const r11 = await L.validateOverride({ date: today, slot: 'reelB', action: 'swap', id: 'card-evening-2' },
    ctxOf({ otherPicks: { reelD: 'card-evening-2' } }));
  ok(!r11.ok && /already chosen for reelD/.test(r11.error), 'a card another slot of the same day already has is refused: ' + r11.error);

  const r12 = await L.validateOverride({ date: today, slot: 'reelB', action: 'skip' }, ctxOf());
  ok(r12.ok, 'a plain skip, nothing else recorded, is allowed: ' + JSON.stringify(r12));
  const r13 = await L.validateOverride({ date: today, slot: 'reelB', action: 'swap', id: 'card-evening-2' }, ctxOf());
  ok(r13.ok, 'a real swap, no conflicts, is allowed: ' + JSON.stringify(r13));

  /* 2026-09-26 review, LOW finding: a slot with nothing recorded YET can
     still be one a run is this second in the middle of sending (the ten
     minute claim, K_CLAIM) -- checked before the K_SLOT check, not only
     after it */
  await store.kv([['SET', 'nsoc:claim:' + today + '#reelB', new Date().toISOString()]]);
  const r14 = await L.validateOverride({ date: today, slot: 'reelB', action: 'skip' }, ctxOf());
  ok(!r14.ok && /being sent right now/.test(r14.error), 'a slot whose send is this second claimed is refused, even with nothing recorded yet: ' + r14.error);
  await store.kv([['DEL', 'nsoc:claim:' + today + '#reelB']]);
  const r14b = await L.validateOverride({ date: today, slot: 'reelB', action: 'skip' }, ctxOf());
  ok(r14b.ok, 'and the same slot is open again once the claim lets go: ' + JSON.stringify(r14b));

  /* 2026-09-26 review, HIGH finding's own last sentence: the same card set
     for a swap on two different days, both inside the window the duplicate
     guard actually enforces (every day an override can ever be set on is,
     by construction: at most MAX_DAYS_AHEAD apart) */
  await store.kv([['SET', 'nsoc:override:' + inDays(3), JSON.stringify({ reelD: { action: 'swap', id: 'card-evening-2', at: today, by: 'owner', note: '' } })]]);
  const r15 = await L.validateOverride({ date: today, slot: 'reelB', action: 'swap', id: 'card-evening-2' }, ctxOf());
  ok(!r15.ok && r15.error.includes(inDays(3)), 'the same card already set to go out on a different day, inside the window, is refused: ' + r15.error);
  await store.kv([['DEL', 'nsoc:override:' + inDays(3)]]);
  const r15b = await L.validateOverride({ date: today, slot: 'reelB', action: 'swap', id: 'card-evening-2' }, ctxOf());
  ok(r15b.ok, 'and the same swap is allowed again once that other day\'s own override is gone: ' + JSON.stringify(r15b));
}

console.log('\na swap that has since gone stale falls back to the ordinary pick, marked, rather than being trusted blindly (2026-09-26 review, HIGH finding)');
{
  const store = makeKv();
  await store.kv([['SET', 'nsoc:override:' + today, JSON.stringify({ reelB: { action: 'swap', id: 'card-evening-2', at: today, by: 'owner', note: '' } })]]);
  const ctxBase = { kv: store.kv, kvReady: store.kvReady };

  /* the card entered the duplicate guard's own window after the swap was
     set (posted somewhere else meanwhile): chooseReelWithOverride must
     never hand it back as if the swap still held */
  const seenNow = new Map([['card-evening-2', today]]);
  const fellBackSeen = await L.chooseReelWithOverride(MANIFEST, today, 'reelB', null, seenNow, null, null, ctxBase);
  ok(fellBackSeen.card && fellBackSeen.card.id !== 'card-evening-2', 'the swapped card is never handed back once it is in the duplicate window: ' + JSON.stringify(fellBackSeen.card));
  ok(fellBackSeen.override && fellBackSeen.override.fellBack === true && /duplicate guard/.test(fellBackSeen.override.reason),
    'the override itself says it fell back, and why: ' + JSON.stringify(fellBackSeen.override));

  /* a DIFFERENT way the same swap can go stale: another slot's own pick,
     today, has already taken the card (checked through ctx.otherPicks,
     the same shape setOverride's own conflict check already uses) */
  const fellBackOther = await L.chooseReelWithOverride(MANIFEST, today, 'reelB', null, null, null, null,
    { ...ctxBase, otherPicks: { reelD: 'card-evening-2' } });
  ok(fellBackOther.card && fellBackOther.card.id !== 'card-evening-2', 'nor when another slot has already been given the same card today: ' + JSON.stringify(fellBackOther.card));
  ok(fellBackOther.override && fellBackOther.override.fellBack === true && /already chosen for another slot/.test(fellBackOther.override.reason),
    'and the reason names what actually happened: ' + JSON.stringify(fellBackOther.override));

  /* neither check fires when nothing is actually wrong: the swap still
     holds exactly as it did before this review */
  const stillHolds = await L.chooseReelWithOverride(MANIFEST, today, 'reelB', null, new Map(), null, null, ctxBase);
  ok(stillHolds.card && stillHolds.card.id === 'card-evening-2' && !stillHolds.override.fellBack, 'and an ordinary, still-valid swap is completely unaffected: ' + JSON.stringify(stillHolds));
}

console.log('\na failed read on the WRITE side refuses outright, never proceeds on a day that only looks empty because the read itself failed (2026-09-26 review, MEDIUM finding)');
{
  /* nsoc:override:<today> already holds a real entry for reelD; the store
     answers every other key normally but throws on THIS ONE GET, so the
     old code (readOverrides' own safe {} on a fault) would have spread an
     empty day into the write and erased reelD outright */
  const raw = JSON.stringify({ reelD: { action: 'skip', at: today, by: 'owner', note: 'reelD\'s own decision' } });
  const overrideKey = 'nsoc:override:' + today;
  const flaky = {
    kv: async cmds => cmds.map(c => {
      if (c[0] === 'GET' && c[1] === overrideKey) throw new Error('the store hiccuped on this one key');
      if (c[0] === 'GET') return null;
      return null;
    }),
    kvReady: () => true
  };
  const setAttempt = await L.setOverride({ date: today, slot: 'reelB', action: 'skip' }, { ...flaky, manifest: MANIFEST });
  ok(!setAttempt.ok && /could not be read/.test(setAttempt.error), 'the set refuses outright rather than guessing the day is empty: ' + setAttempt.error);

  const clearAttempt = await L.clearOverride({ date: today, slot: 'reelD' }, flaky);
  ok(!clearAttempt.ok && /could not be read/.test(clearAttempt.error), 'and so does clear, for the same reason: ' + clearAttempt.error);

  /* proof the erasure the old code risked never actually happens: a store
     that can read this once more still finds reelD\'s own entry exactly
     as it was, because neither refused call above ever reached a write */
  const store2 = makeKv();
  store2.strings.set(overrideKey, raw);
  const stillThere = await L.getOverride(today, 'reelD', { kv: store2.kv, kvReady: store2.kvReady });
  ok(stillThere && stillThere.note === 'reelD\'s own decision', 'reelD\'s own override would still be exactly where it was: ' + JSON.stringify(stillThere));
}

console.log('\nset and clear round-trip, and clear refuses when there is nothing to clear');
{
  const store = makeKv();
  const ctx = { kv: store.kv, kvReady: store.kvReady, manifest: MANIFEST, by: 'owner' };
  const clearNothing = await L.clearOverride({ date: today, slot: 'reelB' }, ctx);
  ok(!clearNothing.ok && /no override.*to clear/.test(clearNothing.error), 'clearing a slot with no override is refused: ' + clearNothing.error);

  const set1 = await L.setOverride({ date: today, slot: 'reelB', action: 'swap', id: 'card-evening-1' }, ctx);
  ok(set1.ok && set1.override.action === 'swap' && set1.override.id === 'card-evening-1' && set1.override.by === 'owner', 'a valid swap is written: ' + JSON.stringify(set1));
  const back = await L.getOverride(today, 'reelB', ctx);
  ok(back && back.id === 'card-evening-1', 'and reads back exactly as set: ' + JSON.stringify(back));

  const cleared = await L.clearOverride({ date: today, slot: 'reelB' }, ctx);
  ok(cleared.ok && cleared.prior.id === 'card-evening-1', 'clearing answers ok and hands back what was cleared: ' + JSON.stringify(cleared));
  ok((await L.getOverride(today, 'reelB', ctx)) === null, 'and the slot carries nothing now');
}

console.log('\nfail open on the READ side: a KV fault or a malformed value never blocks a post, exactly like biasFor');
{
  const throwingKv = async () => { throw new Error('the store is down'); };
  const r1 = await L.overrideFor(today, 'reelB', { kv: throwingKv, kvReady: () => true });
  ok(r1 === null, 'a KV fault reading an override answers null, the same as no override at all');

  const store = makeKv();
  store.strings.set('nsoc:override:' + today, 'not json at all {{{');
  const r2 = await L.overrideFor(today, 'reelB', { kv: store.kv, kvReady: store.kvReady });
  ok(r2 === null, 'bytes that will not parse answer null rather than throwing');

  store.strings.set('nsoc:override:' + today, JSON.stringify({ reelB: { action: 'do-a-backflip' } }));
  const r3 = await L.overrideFor(today, 'reelB', { kv: store.kv, kvReady: store.kvReady });
  ok(r3 === null, 'a shape sanitizeEntry does not recognise is dropped, not trusted');

  store.strings.set('nsoc:override:' + today, JSON.stringify({ reelB: { action: 'swap', id: 'unknown-card' } }));
  const { card, override } = await L.chooseReelWithOverride(MANIFEST, today, 'reelB', null, null, null, null, { kv: store.kv, kvReady: store.kvReady });
  ok(override === null, 'a swap naming a card no longer on the shelf never claims to have applied');
  ok(card && MANIFEST.some(c => c.id === card.id), 'and the ordinary pick is used instead, never nothing at all: ' + JSON.stringify(card));

  const r4 = await L.validateOverride({ date: today, slot: 'reelB', action: 'skip' }, { kv: throwingKv, kvReady: () => true, manifest: MANIFEST });
  ok(!r4.ok && /could not be read/.test(r4.error), 'the WRITE side is the opposite on purpose: a fault refuses the set rather than risk it landing on the wrong day: ' + r4.error);
}

console.log('\nchooseReelWithOverride: skip returns no card, a valid swap returns exactly that card');
{
  const store = makeKv();
  await store.kv([['SET', 'nsoc:override:' + today, JSON.stringify({ reelB: { action: 'skip', at: today, by: 'owner', note: '' } })]]);
  const skip = await L.chooseReelWithOverride(MANIFEST, today, 'reelB', null, null, null, null, { kv: store.kv, kvReady: store.kvReady });
  ok(skip.card === null && skip.override.action === 'skip', 'a skip hands back no card at all: ' + JSON.stringify(skip));

  await store.kv([['SET', 'nsoc:override:' + today, JSON.stringify({ reelB: { action: 'swap', id: 'card-evening-2', at: today, by: 'owner', note: '' } })]]);
  const swap = await L.chooseReelWithOverride(MANIFEST, today, 'reelB', null, null, null, null, { kv: store.kv, kvReady: store.kvReady });
  ok(swap.card && swap.card.id === 'card-evening-2', 'a valid swap hands back exactly the named card: ' + JSON.stringify(swap.card));
}

console.log('\nagainst the real shelf (reels/index.json): every non-light card can be swapped into every reel slot (2026-09-26 review, HIGH finding)');
{
  /* chooseReel (api/_schedule.js) only ever binds the half to a LIGHT
     card: `(!c.slot || c.slot === half || kind !== "light")`. Checking the
     half for every kind refused a swap on four of six slots for a card
     that would have played there perfectly well -- proved here against
     the real file, not an invented fixture, since that is exactly where
     the bug actually lived (the real shelf only ever uses morning and
     evening, never the other four halves these six slots ask for). */
  const fs = await import('node:fs');
  const real = JSON.parse(fs.readFileSync('reels/index.json', 'utf8'));
  const nonLight = real.cards.filter(c => c && c.id && (c.kind || 'light') !== 'light');
  ok(nonLight.length > 0, 'the real shelf actually carries non-light cards to prove this against: ' + nonLight.length);
  const REEL_SLOTS = ['reelA', 'reelB', 'reelC', 'reelD', 'reelE', 'reelF'];
  const oneOfEachKind = new Map();
  for (const c of nonLight) if (!oneOfEachKind.has(c.kind)) oneOfEachKind.set(c.kind, c);
  const failures = [];
  for (const [kind, card] of oneOfEachKind) {
    for (const slot of REEL_SLOTS) {
      const store = makeKv();
      const r = await L.validateOverride({ date: today, slot, action: 'swap', id: card.id },
        { kv: store.kv, kvReady: store.kvReady, now: today, manifest: real.cards });
      if (!r.ok) failures.push(kind + ' (' + card.id + ', own slot ' + (card.slot || 'none') + ') -> ' + slot + ': ' + r.error);
    }
  }
  ok(failures.length === 0, (oneOfEachKind.size * REEL_SLOTS.length) + ' checks, ' + failures.length + ' refused: ' + failures.join(' | '));
}

console.log('\nchooseReelWithOverride: a slot already recorded shows exactly its own card, never a fresh pick that steps past it (2026-09-26 review, second round, HIGH finding)');
{
  /* the reviewer's own repro shape (scratchpad r8.mjs): a slot that has
     already sent has its own card sitting in `seen` by definition (the
     duplicate guard's own hash gained it the moment the post went out), so
     the ordinary pick would step right past it. ctx.rec, the slot's own
     record, is the fact every view must show instead. */
  const rec1 = { state: 'sent', reel: 'card-evening-1', kind: 'light' };
  const seenNow = new Map([['card-evening-1', today]]);
  const r1 = await L.chooseReelWithOverride(MANIFEST, today, 'reelB', null, seenNow, null, null, { rec: rec1 });
  ok(r1.card && r1.card.id === 'card-evening-1', 'the record\'s own card is shown, exactly, even though it sits in seen: ' + JSON.stringify(r1.card));
  ok(r1.override === null, 'and with no override on the record, none is claimed');

  const rec2 = { state: 'sent', reel: 'card-evening-2', override: { action: 'swap', id: 'card-evening-2', by: 'owner' } };
  const r2 = await L.chooseReelWithOverride(MANIFEST, today, 'reelB', null, null, null, null, { rec: rec2 });
  ok(r2.card && r2.card.id === 'card-evening-2' && r2.override && r2.override.action === 'swap', 'the record\'s own override, when it carries one, is handed back unchanged too: ' + JSON.stringify(r2));

  /* a record with nothing recorded yet (no reel at all -- a skip written
     with no card, or simply nothing there) never takes this shortcut, and
     falls through to exactly the ordinary path as before */
  const without = await L.chooseReelWithOverride(MANIFEST, today, 'reelB', null, null, null, null, {});
  const withEmptyRec = await L.chooseReelWithOverride(MANIFEST, today, 'reelB', null, null, null, null, { rec: { state: 'skipped' } });
  ok(without.card?.id === withEmptyRec.card?.id, 'a record with no reel field behaves exactly as having none at all: ' + JSON.stringify([without.card, withEmptyRec.card]));
}

console.log('\notherPicksFor: a slot already recorded is a fact (rec.reel), never a pick recomputed against a growing seen window (2026-09-26 review, second round, HIGH finding)');
{
  /* reelD already sent card-evening-1 (which now sits in `seen`); without
     ctx.records, the old code would recompute reelD's own pick fresh
     against that seen window and could land on some OTHER card by
     coincidence -- exactly the drift the posting-path test below proves
     end to end. Handed ctx.records, reelD's own entry is trusted exactly
     as recorded. reelF carries no record yet, so it is still the one slot
     this function actually recomputes. */
  const seenNow = new Map([['card-evening-1', today]]);
  const records = { reelD: { state: 'sent', reel: 'card-evening-1' } };
  const picks = await L.otherPicksFor(MANIFEST, today, 'reelB', null, seenNow, null, { records });
  ok(picks.reelD === 'card-evening-1', 'reelD\'s own record is trusted exactly as recorded, not recomputed against seen: ' + JSON.stringify(picks));
}

/* ===========================================================================
   PART B · api/lineup.js, the owner-gated door
=========================================================================== */
import crypto from 'node:crypto';
console.log('\n--- api/lineup.js, owner-gated ---');
process.env.ADMIN_SECRET = 'test-secret-lineup';
process.env.KV_REST_API_URL = 'https://kv.lineup.test';
process.env.KV_REST_API_TOKEN = 't';
const KVSTRINGS = new Map(), KVHASHES = new Map();
/* one filler card per OTHER half, so the day's five other reel slots do not
   also fall back onto the two evening cards this file actually tests
   against (chooseReel's own last resort, when a half has nothing of its
   own kind, is ANY card of kind "light" -- true of every card here) */
const REEL_MANIFEST = { n: 7, written: today, cards: [
  { id: 'evening-a', kind: 'light', slot: 'evening', hook: 'Evening A' },
  { id: 'evening-b', kind: 'light', slot: 'evening', hook: 'Evening B' },
  { id: 'morning-x', kind: 'light', slot: 'morning', hook: 'Morning X' },
  { id: 'noon-x', kind: 'light', slot: 'noon', hook: 'Noon X' },
  { id: 'afternoon-x', kind: 'light', slot: 'afternoon', hook: 'Afternoon X' },
  { id: 'late-x', kind: 'light', slot: 'late', hook: 'Late X' },
  { id: 'night-x', kind: 'light', slot: 'night', hook: 'Night X' }
] };
/* a single switch this file's own tests flip to prove the write side's own
   fail-closed promise (2026-09-26 review, MEDIUM finding): the duplicate
   guard's own hash, made to fail exactly once, the same way a real Upstash
   outage would (viaRest throws on a non-ok response, api/_kv.js) */
let FAIL_POSTED_CH = false;
globalThis.fetch = async (url, opt) => {
  const u = String(url);
  if (u.startsWith('https://kv.lineup.test')) {
    const cmds = JSON.parse(opt.body);
    if (FAIL_POSTED_CH && cmds.some(c => c[0] === 'HGETALL' && c[1] === 'nsoc:reels:postedch'))
      return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => cmds.map(c => {
      const [v, k, ...r] = c;
      if (v === 'GET') return { result: KVSTRINGS.has(k) ? KVSTRINGS.get(k) : null };
      if (v === 'SET') { KVSTRINGS.set(k, r[0]); return { result: 'OK' }; }
      if (v === 'DEL') { KVSTRINGS.delete(k); return { result: 1 }; }
      if (v === 'HSET') { const h = KVHASHES.get(k) || new Map(); h.set(r[0], r[1]); KVHASHES.set(k, h); return { result: 1 }; }
      if (v === 'HGETALL') { const h = KVHASHES.get(k) || new Map(); return { result: [...h.entries()].flat() }; }
      return { result: null };
    }) };
  }
  if (u.includes('/reels/index.json')) return { ok: true, status: 200, json: async () => REEL_MANIFEST };
  if (u.includes('aladhan.com')) return { ok: false, status: 500, json: async () => ({}) };
  return { ok: false, status: 404, json: async () => ({}) };
};
const EP = await import('../api/lineup.js');
function fakeRes() {
  return { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}
function cookieFor(secret) {
  const exp = Date.now() + 100000;
  const sig = crypto.createHmac('sha256', secret).update(String(exp)).digest('hex');
  return 'noor_admin=' + exp + '.' + sig;
}
const AUTH = { cookie: cookieFor(process.env.ADMIN_SECRET) };

console.log('\nthe owner gate');
{
  const r1 = fakeRes();
  await EP.default({ method: 'GET', query: { date: today }, headers: {} }, r1);
  ok(r1.statusCode === 401, 'no cookie at all: 401, not a silent empty answer');
}

console.log('\nGET reads the day: no override yet, then one set through the store directly');
{
  const r1 = fakeRes();
  await EP.default({ method: 'GET', query: { date: today }, headers: AUTH }, r1);
  ok(r1.body.ok === true && Array.isArray(r1.body.slots) && r1.body.slots.length === 6, 'all six reel slots are named: ' + (r1.body.slots || []).map(s => s.slot).join(','));
  const reelB1 = r1.body.slots.find(s => s.slot === 'reelB');
  ok(reelB1 && reelB1.override === null && reelB1.card && reelB1.card.id, 'reelB carries no override yet, and a real card is what the rota would post: ' + JSON.stringify(reelB1));

  KVSTRINGS.set('nsoc:override:' + today, JSON.stringify({ reelB: { action: 'swap', id: 'evening-b', at: today, by: 'owner', note: '' } }));
  const r2 = fakeRes();
  await EP.default({ method: 'GET', query: { date: today }, headers: AUTH }, r2);
  const reelB2 = r2.body.slots.find(s => s.slot === 'reelB');
  ok(reelB2.override && reelB2.override.id === 'evening-b' && reelB2.card && reelB2.card.id === 'evening-b',
    'the override and the card the rota would now actually post agree: ' + JSON.stringify(reelB2));
  KVSTRINGS.delete('nsoc:override:' + today);
}

console.log('\nPOST set and clear, validated the same way Part A already proved');
{
  const rBad = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'set', date: today, slot: 'dawn', override: { action: 'skip' } } }, rBad);
  ok(rBad.body.ok === false && /only a reel slot/.test(rBad.body.error), 'a non-reel slot is refused through the endpoint too: ' + rBad.body.error);

  const rSet = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'set', date: today, slot: 'reelB', override: { action: 'swap', id: 'evening-a' } } }, rSet);
  ok(rSet.body.ok === true && rSet.body.override.id === 'evening-a', 'a valid swap is set: ' + JSON.stringify(rSet.body));
  ok(!!KVSTRINGS.get('nsoc:override:' + today), 'and lands in the store under the day\'s own key');

  const rConflict = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'set', date: today, slot: 'reelD', override: { action: 'swap', id: 'evening-a' } } }, rConflict);
  /* evening-a does not fit reelD's own half (noon), so this refuses on the
     half check before the conflict check is ever reached -- still a refusal,
     which is what matters here */
  ok(rConflict.body.ok === false, 'a card that does not even fit the slot asked for is refused: ' + rConflict.body.error);

  const rClear = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'clear', date: today, slot: 'reelB' } }, rClear);
  ok(rClear.body.ok === true, 'clearing the override that was just set answers ok: ' + JSON.stringify(rClear.body));
  ok(JSON.parse(KVSTRINGS.get('nsoc:override:' + today) || '{}').reelB === undefined, 'and the slot carries nothing now');
}

console.log('\na slot claimed by a send this second in flight refuses a set through the endpoint too (2026-09-26 review, LOW finding)');
{
  KVSTRINGS.set('nsoc:claim:' + today + '#reelC', new Date().toISOString());
  const rClaimed = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'set', date: today, slot: 'reelC', override: { action: 'skip' } } }, rClaimed);
  ok(rClaimed.body.ok === false && /being sent right now/.test(rClaimed.body.error), 'refused while the claim holds: ' + rClaimed.body.error);
  KVSTRINGS.delete('nsoc:claim:' + today + '#reelC');
  const rFree = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'set', date: today, slot: 'reelC', override: { action: 'skip' } } }, rFree);
  ok(rFree.body.ok === true, 'and set once the claim lets go: ' + JSON.stringify(rFree.body));
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'clear', date: today, slot: 'reelC' } }, fakeRes());
}

console.log('\na fault reading the duplicate guard\'s own window refuses the write outright, never treats it as an empty window (2026-09-26 review, MEDIUM finding)');
{
  FAIL_POSTED_CH = true;
  const rFault = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'set', date: today, slot: 'reelF', override: { action: 'swap', id: 'late-x' } } }, rFault);
  ok(rFault.body.ok === false && /duplicate guard could not be read/.test(rFault.body.error), 'the set refuses rather than guessing nothing has ever posted: ' + rFault.body.error);
  FAIL_POSTED_CH = false;
  const rOk = fakeRes();
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'set', date: today, slot: 'reelF', override: { action: 'swap', id: 'late-x' } } }, rOk);
  ok(rOk.body.ok === true, 'and the same set succeeds once the guard\'s own window can be read again: ' + JSON.stringify(rOk.body));
  await EP.default({ method: 'POST', query: {}, headers: AUTH, body: { action: 'clear', date: today, slot: 'reelF' } }, fakeRes());
}

console.log('\nvercel.json names the new function, and if it ever grows includeFiles, keeps it under the 256 character limit rooms.mjs already holds api/page.js to');
{
  const fs = await import('node:fs');
  const vc = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const fn = vc.functions && vc.functions['api/lineup.js'];
  ok(!!fn, 'api/lineup.js has its own entry in vercel.json');
  ok(!fn.includeFiles || fn.includeFiles.length <= 256, 'includeFiles, if present at all, is under Vercel\'s 256 character limit');
}

/* ===========================================================================
   PART C · the posting path itself, api/social.js
=========================================================================== */
console.log('\n--- the posting path: skip and swap through api/social.js ---');
process.env.FB_PAGE_ID = '123'; process.env.FB_PAGE_TOKEN = 'tok';
delete process.env.IG_USER_ID; delete process.env.IG_TOKEN; delete process.env.IG_ACCESS_TOKEN;
let fbCalls = [];
const DATE = today;
const REELB = { id: 'evening-a', kind: 'light', hook: 'Evening A', caption: 'Evening A caption.\n\nnoorcodex.com\n\n#Islam',
  video: 'https://noorcodex.com/reels/evening-a.mp4', cover: 'https://noorcodex.com/reels/evening-a-cover.jpg' };
globalThis.fetch = async (url, opt) => {
  const u = String(url);
  if (u.startsWith('https://kv.lineup.test')) {
    const cmds = JSON.parse(opt.body);
    return { ok: true, status: 200, json: async () => cmds.map(c => {
      const [v, k, ...r] = c;
      if (v === 'GET') return { result: KVSTRINGS.has(k) ? KVSTRINGS.get(k) : null };
      if (v === 'SET') { KVSTRINGS.set(k, r[0]); return { result: 'OK' }; }
      if (v === 'DEL') { KVSTRINGS.delete(k); return { result: 1 }; }
      if (v === 'LPUSH') { const l = KVHASHES.get('L:' + k) || []; l.unshift(r[0]); KVHASHES.set('L:' + k, l); return { result: l.length }; }
      if (v === 'LTRIM') return { result: 'OK' };
      if (v === 'LRANGE') { const l = KVHASHES.get('L:' + k) || []; return { result: l.slice(0, +r[1] + 1) }; }
      if (v === 'HSET') { const h = KVHASHES.get(k) || new Map(); h.set(r[0], r[1]); KVHASHES.set(k, h); return { result: 1 }; }
      if (v === 'HGETALL') { const h = KVHASHES.get(k) || new Map(); return { result: [...h.entries()].flat() }; }
      return { result: null };
    }) };
  }
  if (u.includes('/reels/index.json')) return { ok: true, status: 200, json: async () => REEL_MANIFEST };
  if (u.includes('/assets/menu-index.json')) return { ok: true, status: 200, json: async () => ({ words: [], path: [] }) };
  if (u.includes('aladhan.com')) return { ok: false, status: 500, json: async () => ({}) };
  if (u.includes('?fields=access_token')) return { ok: true, status: 200, json: async () => ({ access_token: 'page' }) };
  if (u.includes('/video_reels')) {
    const body = JSON.parse(opt.body);
    if (body.upload_phase === 'start') { fbCalls.push('fb-start'); return { ok: true, status: 200, json: async () => ({ video_id: 'VID', upload_url: 'https://rupload/x' }) }; }
    fbCalls.push('fb-finish'); return { ok: true, status: 200, json: async () => ({ post_id: 'P1' }) };
  }
  if (u.includes('rupload')) { fbCalls.push('fb-upload'); return { ok: true, status: 200, json: async () => ({ success: true }) }; }
  if (/\/VID\?fields=status,permalink_url/.test(u)) return { ok: true, status: 200, json: async () => ({ status: { video_status: 'ready' }, permalink_url: '/reel/VID', published: true }) };
  throw new Error('unexpected fetch in Part C: ' + u);
};
const S = await import('../api/social.js');
const key = (d, s) => 'nsoc:slot:' + d + '#' + s;
const rec = (d, s) => JSON.parse(KVSTRINGS.get(key(d, s)) || 'null');
const CTX = { dials: { mode: 'auto', fb: true, ig: false, polish: false, stories: false, cardsFeed: true, storeOk: true } };

console.log('\na skip never reaches a network, and writes a record the retry path reads as settled');
{
  KVSTRINGS.clear(); KVHASHES.clear(); fbCalls = [];
  KVSTRINGS.set('nsoc:override:' + DATE, JSON.stringify({ reelB: { action: 'skip', at: DATE, by: 'owner', note: '' } }));
  const r = await S.sendSlot('noorcodex.com', DATE, 'reelB', CTX);
  ok(r.ok === true && r.state === 'skipped', 'the send answers ok, skipped: ' + JSON.stringify(r));
  ok(fbCalls.length === 0, 'Facebook was never asked for anything');
  const slot = rec(DATE, 'reelB');
  ok(slot && slot.state === 'skipped' && slot.why === 'owner override' && !slot.results, 'the record carries no results at all, the same shape a slot with nothing to say already gets');

  /* the automatic healer is the real "retry path": healFailures walks every
     slot record and refuses outright to touch one with no results field at
     all (api/social.js's own guard, `if (!rec || !rec.results) continue;`),
     so a slot the owner skipped is never mistaken for one that failed and
     needs mending -- proved here rather than assumed */
  const healed = await S.healFailures('noorcodex.com', DATE, { ran: [] }, Date.now(), () => true);
  ok(!healed.some(h => h.slot === 'reelB'), 'the healer leaves a skipped slot alone entirely, never counting it among what needs mending: ' + JSON.stringify(healed));
  ok(fbCalls.length === 0, 'and Facebook is still never asked, by the healer or by hand');

  /* runDue reaches the same conclusion on its own clock: asked again for
     the same slot, on the same day, it writes the same skipped state and
     never posts it, whatever else that run also finds due */
  KVSTRINGS.delete(key(DATE, 'reelB'));
  const due = await S.runDue('noorcodex.com', DATE, new Date(Date.UTC(2026, 0, 1, 17)), { force: true, index: { words: [], path: [] } });
  const settled = rec(DATE, 'reelB');
  const ranReelB = due.ran.find(r => r.slot === 'reelB');
  ok(settled && settled.state === 'skipped' && !settled.results, 'runDue itself also writes reelB as skipped, with no results, whatever else it posted this run: ' + JSON.stringify(ranReelB));
  KVSTRINGS.delete('nsoc:override:' + DATE);
}

console.log('\na dry run of runDue writes nothing at all for a skipped slot either (2026-09-26 review, LOW finding: the write used to land before the dry check)');
{
  KVSTRINGS.clear(); KVHASHES.clear(); fbCalls = [];
  KVSTRINGS.set('nsoc:override:' + DATE, JSON.stringify({ reelB: { action: 'skip', at: DATE, by: 'owner', note: '' } }));
  const due = await S.runDue('noorcodex.com', DATE, new Date(Date.UTC(2026, 0, 1, 17)),
    { force: true, dry: true, index: { words: [], path: [] } });
  const ranReelB = due.ran.find(r => r.slot === 'reelB');
  ok(ranReelB && ranReelB.dry === true, 'the run itself says this was a dry pass over reelB: ' + JSON.stringify(ranReelB));
  ok(!KVSTRINGS.has(key(DATE, 'reelB')), 'and no record was written for it at all, exactly like every other slot a dry run touches');
  ok(fbCalls.length === 0, 'nor was any network ever asked');
  KVSTRINGS.delete('nsoc:override:' + DATE);
}

console.log('\na swap posts exactly the named card, and never twice');
{
  KVSTRINGS.clear(); KVHASHES.clear(); fbCalls = [];
  KVSTRINGS.set('nsoc:override:' + DATE, JSON.stringify({ reelB: { action: 'swap', id: 'evening-a', at: DATE, by: 'owner', note: '' } }));
  const r = await S.sendSlot('noorcodex.com', DATE, 'reelB', { ...CTX, index: { words: [], path: [] } });
  ok(r.ok === true && r.title === 'Evening A', 'the post that went out is the named card, not whatever the rota would have picked: ' + r.title);
  ok(fbCalls.includes('fb-start'), 'Facebook really was asked, once');
  const slot = rec(DATE, 'reelB');
  ok(slot.override && slot.override.action === 'swap' && slot.override.id === 'evening-a', 'the record carries the override, matching what actually went out: ' + JSON.stringify(slot.override));

  const again = await S.sendSlot('noorcodex.com', DATE, 'reelB', { ...CTX, index: { words: [], path: [] } });
  ok(again.ok === false && /already gone/.test(again.error), 'pressing send again refuses: it has already gone today');
  ok(fbCalls.filter(c => c === 'fb-start').length === 1, 'and Facebook was never asked a second time');
}

console.log('\na swap that entered the duplicate window after it was set posts the ordinary pick, never nothing (2026-09-26 review, HIGH finding)');
{
  KVSTRINGS.clear(); KVHASHES.clear(); fbCalls = [];
  KVSTRINGS.set('nsoc:override:' + DATE, JSON.stringify({ reelB: { action: 'swap', id: 'evening-a', at: DATE, by: 'owner', note: '' } }));
  /* the swapped card landed on some OTHER slot's send, or another day's,
     in the meantime -- the duplicate guard's own hash says so, exactly the
     way a real post would leave it */
  KVHASHES.set('nsoc:reels:postedch', new Map([['evening-a|facebook', DATE + '#reelD']]));

  /* the preview, asked BEFORE anything here is sent, so this is a genuine
     side by side of two views of the same, still unchanged, moment -- not
     a preview asked after the send has itself changed what "recently
     posted" means (item 6, every view agrees) */
  const res2 = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await S.default({ method: 'GET', query: { action: 'slot', slot: 'reelB', date: DATE }, headers: { cookie: cookieFor(process.env.ADMIN_SECRET) } }, res2);
  ok(res2.body && res2.body.post && res2.body.post.title === 'Evening B', 'the ?action=slot preview already shows the fallback, before anything is sent: ' + (res2.body.post && res2.body.post.title));

  const r = await S.sendSlot('noorcodex.com', DATE, 'reelB', { ...CTX, index: { words: [], path: [] } });
  ok(r.ok === true, 'the slot still sends: ' + JSON.stringify(r));
  ok(r.title !== 'Evening A', 'never the card the duplicate guard would refuse: ' + r.title);
  ok(r.title === 'Evening B', 'the ordinary pick from the same half instead, not nothing at all, and exactly what the preview just showed: ' + r.title);
  ok(fbCalls.filter(c => c === 'fb-start').length === 1, 'Facebook was asked exactly once -- the HIGH finding this proves: it used to be asked for the stale card, refused on every channel, and the slot still recorded "sent"');

  const slot = rec(DATE, 'reelB');
  ok(slot.state === 'sent', 'and the record genuinely says sent, because something genuinely was: ' + slot.state);
  ok(slot.override && slot.override.action === 'swap' && slot.override.id === 'evening-a' && slot.override.fellBack === true,
    'the record still names what was asked for, and says plainly it fell back: ' + JSON.stringify(slot.override));
  ok(/duplicate guard/.test(slot.override.reason), 'with the reason spelled out: ' + slot.override.reason);
}

console.log('\na later slot\'s swap is never refused by an earlier slot\'s own pick drifting once that slot has actually sent (2026-09-26 review, second round, HIGH finding)');
{
  /* the reviewer's own repro shape (scratchpad r6.mjs): a shelf with only
     two light cards, so every OTHER reel slot -- having no card of its own
     half -- falls back to this exact shared pool (chooseReel's own last
     resort, api/_schedule.js). Before this fix, otherPicksFor recomputed
     every other slot fresh against today's growing `seen`, so once the
     early slot actually posted its own FIRST pick (P), that slot's own
     recompute (used only to check the later slot's swap) landed on its
     SECOND pick instead -- and if that second pick happened to be exactly
     what the later slot's own swap named, the swap refused itself as
     "already chosen for another slot today" over an earlier slot's own
     drifting arithmetic, not any real clash: the send then fell back
     silently at post time, for no reason the owner had caused. */
  const fs = await import('node:fs');
  const REAL = JSON.parse(fs.readFileSync('reels/index.json', 'utf8'));
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async (url, opt) => {
    if (String(url).includes('/reels/index.json')) return { ok: true, status: 200, json: async () => REAL };
    return savedFetch(url, opt);
  };
  const SC = await import('../api/_schedule.js');
  const hours = { reelA: 8, reelC: 11, reelD: 14, reelB: 17, reelF: 19, reelE: 21 };
  let found = null;
  for (let k = 1; k <= 7 && !found; k++) {
    const D = new Date(Date.now() + k * 86400000).toISOString().slice(0, 10);
    /* every slot's own natural pick against an empty day, so a coincidence
       with what a DIFFERENT, untouched slot genuinely wants of its own
       accord is never mistaken for the drift this proves -- exactly r6.mjs's
       own `picks` guard */
    const picks = Object.fromEntries(SC.REEL_SLOTS.map(s => [s, SC.chooseReel(REAL.cards, D, SC.reelHalf(s), null, new Map(), null)?.id]));
    for (const early of SC.REEL_SLOTS) {
      const P = picks[early];
      if (!P) continue;
      const P2 = SC.chooseReel(REAL.cards, D, SC.reelHalf(early), null, new Map([[P, D]]), null)?.id;
      if (!P2 || P2 === P) continue;
      const card2 = REAL.cards.find(c => c.id === P2);
      /* a non-light card only: kind !== "light" is the one branch of
         chooseReel's own filter that ignores `.slot` altogether, so a
         second pick of this shape can genuinely be shared across two
         different halves -- the exact shape of the real repro */
      if (!card2 || (card2.kind || 'light') === 'light') continue;
      if (Object.values(picks).includes(P2)) continue;
      for (const late of SC.REEL_SLOTS) {
        if (late === early || hours[late] <= hours[early]) continue;
        found = { D, early, late, P, P2 }; break;
      }
      if (found) break;
    }
  }
  ok(!!found, 'a repro case exists on the real shelf within a week: ' + JSON.stringify(found));
  if (found) {
    const { D, early, late, P, P2 } = found;
    KVSTRINGS.clear(); KVHASHES.clear(); fbCalls = [];
    KVSTRINGS.set('nsoc:override:' + D, JSON.stringify({ [late]: { action: 'swap', id: P2, at: D, by: 'owner', note: '' } }));

    const rEarly = await S.sendSlot('noorcodex.com', D, early, { ...CTX, index: { words: [], path: [] } });
    ok(rEarly.ok === true, 'the early slot sends first, on its own ordinary pick: ' + JSON.stringify(rEarly));
    const earlyRec = rec(D, early);
    ok(earlyRec && earlyRec.reel === P, 'and its record names exactly its own first pick, not the second one a stale recompute would later find: ' + earlyRec.reel + ' vs ' + P);

    const rLate = await S.sendSlot('noorcodex.com', D, late, { ...CTX, index: { words: [], path: [] } });
    ok(rLate.ok === true, 'the later slot still sends: ' + JSON.stringify(rLate));
    const lateRec = rec(D, late);
    ok(lateRec && lateRec.reel === P2, 'and posts the swapped card exactly as asked, never falling back over the earlier slot\'s own pick drifting: ' + (lateRec && lateRec.reel) + ' vs ' + P2);
    ok(!lateRec || !lateRec.override || !lateRec.override.fellBack, 'no fellBack mark at all, because nothing actually fell back: ' + JSON.stringify(lateRec && lateRec.override));
  }
  globalThis.fetch = savedFetch;
}

console.log('\nan unknown swap id falls back to the ordinary pick, never a hole in the day');
{
  KVSTRINGS.clear(); KVHASHES.clear(); fbCalls = [];
  KVSTRINGS.set('nsoc:override:' + DATE, JSON.stringify({ reelB: { action: 'swap', id: 'left-the-shelf', at: DATE, by: 'owner', note: '' } }));
  const r = await S.sendSlot('noorcodex.com', DATE, 'reelB', { ...CTX, index: { words: [], path: [] } });
  ok(r.ok === true, 'the slot still sends: ' + JSON.stringify(r));
  ok(['Evening A', 'Evening B'].includes(r.title), 'the ordinary pick from the real shelf, not nothing at all: ' + r.title);
  const slot = rec(DATE, 'reelB');
  ok(!slot.override, 'and the record carries no override mark, since nothing was actually overridden');
}

console.log('\nthe day\'s preview (action=today) shows the same card the poster itself would use');
{
  KVSTRINGS.clear(); KVHASHES.clear();
  KVSTRINGS.set('nsoc:override:' + DATE, JSON.stringify({ reelB: { action: 'swap', id: 'evening-b', at: DATE, by: 'owner', note: '' } }));
  const res = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await S.default({ method: 'GET', query: { action: 'today', date: DATE }, headers: { cookie: cookieFor(process.env.ADMIN_SECRET) } }, res);
  const slots = (res.body && res.body.slots) || [];
  const reelB = slots.find(s => s.id === 'reelB');
  ok(reelB && reelB.override && reelB.override.id === 'evening-b' && reelB.reel && reelB.reel.id === 'evening-b',
    'the preview\'s own override and its own card agree with what a real post would use: ' + JSON.stringify(reelB));
}

console.log('\na slot that has already sent shows exactly its own card, in the Today room and in /api/lineup GET alike -- never one stepped past because that very card now sits in seen (2026-09-26 review, second round, HIGH finding)');
{
  /* the reviewer's own repro shape (scratchpad r8.mjs): the moment reelB
     actually sends evening-a, that id enters the duplicate guard's own
     window (the same hash a real post leaves behind) -- and every view
     that recomputed the pick fresh, rather than reading the slot's own
     record, would step right past it and show evening-b instead, for a
     slot that had not even offered a choice: it had already gone. */
  KVSTRINGS.clear(); KVHASHES.clear();
  KVSTRINGS.set(key(DATE, 'reelB'), JSON.stringify({ at: DATE, slot: 'reelB', state: 'sent', title: 'Evening A',
    reel: 'evening-a', results: { facebook: { ok: true, id: '1' } } }));
  KVHASHES.set('nsoc:reels:postedch', new Map([['evening-a|facebook', DATE + '#reelB']]));

  const resToday = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await S.default({ method: 'GET', query: { action: 'today', date: DATE }, headers: AUTH }, resToday);
  const todayReelB = (resToday.body && resToday.body.slots || []).find(s => s.id === 'reelB');
  ok(todayReelB && todayReelB.reel && todayReelB.reel.id === 'evening-a', 'the Today room shows exactly the card that was sent: ' + JSON.stringify(todayReelB && todayReelB.reel));

  const resLineup = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await EP.default({ method: 'GET', query: { date: DATE }, headers: AUTH }, resLineup);
  const lineupReelB = (resLineup.body && resLineup.body.slots || []).find(s => s.slot === 'reelB');
  ok(lineupReelB && lineupReelB.card && lineupReelB.card.id === 'evening-a', 'and /api/lineup GET agrees exactly, the same view every writing door validates against: ' + JSON.stringify(lineupReelB && lineupReelB.card));
}

console.log('\nadmin2.html: the Change control (2026-09-26 review, LOW findings)');
{
  const fs = await import('node:fs');
  const html = fs.readFileSync('admin2.html', 'utf8');

  /* a queued slot already carries its own record (the middle rung's own
     draft, waiting on Post now): api/_lineup.js refuses an override on ANY
     existing record, so offering Change there was always going to be
     refused. Both places a Change button is decided (today's rows, and
     tomorrow's) must leave "queued" out of what counts as open. */
  const canChangeLines = html.match(/var canChange=[^;]+;/g) || [];
  ok(canChangeLines.length === 2, 'exactly two canChange assignments, today\'s rows and tomorrow\'s: ' + canChangeLines.length);
  ok(canChangeLines.every(l => !/queued/.test(l)), 'neither one offers Change on a queued slot, only due or waiting: ' + canChangeLines.join(' | '));

  /* the swap picker's own confirm question must be built plain, and
     escaped exactly once, by confirmChange itself -- escaping a hook's own
     text a second time on the way in doubled every &, < and quote it
     happened to carry */
  const swapCall = (html.match(/confirmChange\(date,slotId,\{action:"swap",id:id\},[^)]*\)/) || [])[0] || '';
  ok(swapCall && !/esc\(c\.hook/.test(swapCall), 'the swap confirm\'s own question is handed to confirmChange un-escaped: ' + swapCall);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
