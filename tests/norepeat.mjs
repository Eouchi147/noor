/* NOOR · nothing goes out twice.
   ------------------------------------------------------------------
   On 25, 26 and 27 August 2026 Noor's own Instagram and Facebook published the
   same card three mornings running: prophet-death-632, word for word. The owner
   saw it before any test did.

   Two things had to be true at once for that to happen, and both were:

     1 · every rule that can lift a card above the general pool -- its month,
         its hijri month, the season -- holds steady for weeks, and the
         tiebreaker was seeded on the YEAR. So the whole ranking was frozen for
         weeks at a time.
     2 · the only thing that made one morning differ from the next was the ring
         of recently-shown cards in the key store, and the ring was not turning.

   A picker whose variety depends entirely on a store is a picker that repeats
   the day the store blinks. So the memory is now recoverable without the store:
   the picker is a pure function of the date, so the last three months can be
   replayed and used as memory.

   This holds all of it in place, with no store and no network at all.

   Run:  node tests/norepeat.mjs
*/
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };

const LIB = JSON.parse(fs.readFileSync(new URL('../lights/all.json', import.meta.url), 'utf8')).lights;
const { scoreLights, replaySeen } = await import('../api/_lights.js');
const { buildSlot } = await import('../api/_schedule.js');

const day = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const walk = n => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = day(2026, 7, 20 + i);
    out.push(scoreLights(LIB, d, [], replaySeen(LIB, d))[0].L.id);
  }
  return out;
};
const sameAsYesterday = a => a.filter((x, i) => i && x === a[i - 1]).length;

console.log('\n=== 1. the morning that repeated ===');
{
  const got = ['2026-08-25', '2026-08-26', '2026-08-27']
    .map(d => scoreLights(LIB, d, [], replaySeen(LIB, d))[0].L.id);
  ok(new Set(got).size === 3, 'the three mornings are three different cards (' + got.join(', ') + ')');
  ok(got[1] === 'prophet-death-632',
     'and the card still lands on its own day, 12 Rabi al-Awwal');
}

console.log('\n=== 2. a year with no store at all ===');
{
  const y = walk(365);
  ok(sameAsYesterday(y) === 0, 'never the same card two mornings running, across 365 days');
  ok(new Set(walk(30)).size === 30, 'thirty days, thirty different cards');
  const c = {}; y.forEach(x => c[x] = (c[x] || 0) + 1);
  ok(new Set(y).size >= 250, 'a year shows ' + new Set(y).size + ' different cards');
  /* a card may come round again, but not inside the replay window */
  let tooSoon = 0;
  const last = new Map();
  y.forEach((id, i) => { if (last.has(id) && i - last.get(id) < 60) tooSoon++; last.set(id, i); });
  ok(tooSoon === 0, 'and none comes back inside two months (' + tooSoon + ' did)');
}

console.log('\n=== 3. the tiebreaker moves with the day, not the year ===');
{
  const a = scoreLights(LIB, '2026-06-10', [], []).slice(0, 8).map(r => r.L.id).join();
  const b = scoreLights(LIB, '2026-06-11', [], []).slice(0, 8).map(r => r.L.id).join();
  ok(a !== b, 'two ordinary days rank the library differently even with no memory');
}

console.log('\n=== 4. an anniversary is kept for its day ===');
{
  const dated = LIB.filter(l => l.w && l.w.m && l.w.d).slice(0, 14);
  let held = 0;
  for (const L of dated) {
    /* the day before its anniversary it must not be spent */
    const d = new Date(Date.UTC(2026, L.w.m - 1, L.w.d - 1));
    if (isNaN(d)) { held++; continue; }
    const ds = d.toISOString().slice(0, 10);
    if (scoreLights(LIB, ds, [], replaySeen(LIB, ds))[0].L.id !== L.id) held++;
  }
  ok(held === dated.length, 'no dated card is spent on the eve of its own anniversary');
}

console.log('\n=== 5. the word and the chapter rotate ===');
{
  const words = Array.from({ length: 523 }, (_, i) => ({ i, t: 'w' + i, a: 'a', s: 's' }));
  const path  = Array.from({ length: 71 },  (_, i) => ({ i, t: 'c' + i, a: 'a' }));
  const ctx = d => ({ date: d, hijri: { d: 1, name: 'Safar', y: 1448 },
    day: { fixed: null, recurring: [] }, leads: [], words, path,
    link: 'https://noorcodex.com/', image: 'i' });
  for (const [slot, n, label] of [['word', 523, 'the word'], ['dusk', 71, 'the chapter']]) {
    const keys = [];
    for (let i = 0; i < n; i++) keys.push(buildSlot(slot, ctx(day(2026, 7, 20 + i))).key);
    ok(sameAsYesterday(keys) === 0, label + ' is never the same two days running');
    ok(new Set(keys).size === n, label + ' uses all ' + n + ' before reusing any');
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
