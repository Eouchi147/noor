/* NOOR · seven kinds of reel share six slots a day.
   ------------------------------------------------------------------
   The rota is a promise to a follower: a verse, a word, a Did you know and
   the day's card in a rhythm, never a run of one thing. This checks the
   rota does what it says, that a This day reel appears on its date and on
   no other, that an empty shelf yields its turn instead of silencing the
   account, and that yesterday's manifests, which knew no kinds, still work.

   Run:  node tests/reels-kinds.mjs
*/
import fs from 'fs';
import * as S from '../api/_schedule.js';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const MAN = [];
for (let i = 0; i < 8; i++) MAN.push({ id: 'verse-' + i, kind: 'verse', slot: i % 2 ? 'evening' : 'morning', hook: 'v', caption: 'c' });
for (let i = 0; i < 40; i++) MAN.push({ id: 'word-' + i, kind: 'word', slot: i % 2 ? 'evening' : 'morning', hook: 'w', caption: 'c' });
for (let i = 0; i < 5; i++) MAN.push({ id: 'know-' + i, kind: 'know', slot: 'morning', hook: 'k', caption: 'c' });
for (let i = 0; i < 4; i++) MAN.push({ id: 'light-' + i, kind: 'light', slot: i % 2 ? 'evening' : 'morning', hook: 'l', caption: 'c' });
for (let i = 0; i < 9; i++) MAN.push({ id: 'name-' + i, kind: 'name', slot: i % 2 ? 'evening' : 'morning', hook: 'n', caption: 'c' });
for (let i = 0; i < 3; i++) MAN.push({ id: 'dua-' + i, kind: 'dua', slot: 'evening', hook: 'd', caption: 'c' });
MAN.push({ id: 'day-ashura', kind: 'day', slot: 'morning', hm: 1, hd: 10, hook: 'Ashura', caption: 'c' });
MAN.push({ id: 'month-09', kind: 'day', slot: 'morning', hm: 9, hd: 1, hook: 'Ramadan begins', caption: 'c' });
MAN.push({ id: 'day-ramadan', kind: 'day', slot: 'morning', hm: 9, hd: 1, hook: 'Ramadan begins', caption: 'c' });
MAN.push({ id: 'month-01', kind: 'day', slot: 'morning', hm: 1, hd: 1, hook: 'Muharram begins', caption: 'c' });
MAN.push({ id: 'day-new-year', kind: 'day', slot: 'morning', hm: 1, hd: 1, hook: 'The Hijri New Year', caption: 'c' });

const kind = c => c && c.kind;
/* 2026-09-07 is a Monday, 2026-09-08 a Tuesday, ... 2026-09-13 a Sunday */
const week = ['2026-09-13', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'];

console.log('\nthe rota');
{
  const morn = week.map(d => kind(S.chooseReel(MAN, d, 'morning', null)));
  const eve = week.map(d => kind(S.chooseReel(MAN, d, 'evening', null)));
  ok(morn.join() === 'verse,verse,know,light,name,verse,know', 'mornings Sun..Sat: ' + morn.join(' '));
  ok(eve.join() === 'word,light,know,word,verse,name,word', 'evenings Sun..Sat: ' + eve.join(' '));
  ok(morn.filter(k => k === 'verse').length === 3, 'three verses a week in the morning');
  /* the six halves, in clock order: 08, 11, 14, 17, 19, 21 UTC */
  const halves = ['morning', 'noon', 'afternoon', 'evening', 'late', 'night'];
  const week6 = week.map(d => halves.map(h => kind(S.chooseReel(MAN, d, h, null))));
  ok(week6.every(r => r.length === 6 && r.every(Boolean)), 'six reels a day, every half of every day has a kind');
  const tally = {}; week6.flat().forEach(k => tally[k] = (tally[k] || 0) + 1);
  ok(tally.verse === 19 && tally.word === 9 && tally.name === 5 && tally.know === 6 && tally.light === 2 && tally.dua === 1 && !tally.codex, 'a week is 19 verses, 9 words, 5 Names, 6 Did you knows, 2 day\'s cards, 1 du\'a, and no Codex: ' + JSON.stringify(tally));
  ok(week6.every(r => r[4] === 'verse'), 'the 19:00 reel is a verse every day of the week');
  ok(week6.every(r => r.filter(k => k === 'verse').length >= 2), 'and no day passes without at least two verses');
  ok(week6.every(r => !(r[1] === 'light' || r[2] === 'light' || r[4] === 'light' || r[5] === 'light')), 'the day\'s card keeps to its two halves');
  const a = S.chooseReel(MAN, '2026-09-07', 'morning', null), b = S.chooseReel(MAN, '2026-09-07', 'morning', null);
  ok(a.id === b.id, 'the same date always chooses the same card');
}

console.log('\nno repeats within a kind');
{
  const seen = new Set();
  /* the verse walk is one walk across every half, stepped by the running
     count of verse slots: the first eight verse slots of the week, whichever
     halves they fall in, are eight different verses */
  let d = new Date('2026-09-06T12:00:00Z'), n = 0;
  while (n < 8) {
    const iso = d.toISOString().slice(0, 10);
    for (const h of ['morning', 'noon', 'afternoon', 'evening', 'late', 'night']) {
      if (n >= 8) break;
      const c = S.chooseReel(MAN, iso, h, null);
      if (c && c.kind === 'verse') { seen.add(c.id); n++; }
    }
    d = new Date(d.getTime() + 86400000);
  }
  ok(seen.size === 8, 'the first eight verse slots walk all eight verses before any repeats: ' + seen.size);
  /* words are chosen on some mornings and some evenings: one walk, not two */
  const words = [], when = [];
  let d2 = new Date('2026-09-06T12:00:00Z');
  for (let i = 0; i < 21; i++) {
    const iso = d2.toISOString().slice(0, 10);
    for (const h of ['morning', 'noon', 'afternoon', 'evening', 'late', 'night']) { const c = S.chooseReel(MAN, iso, h, null); if (c && c.kind === 'word') { words.push(c.id); when.push(iso + ' ' + h); } }
    d2 = new Date(d2.getTime() + 86400000);
  }
  let close = null;
  for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++)
    if (words[i] === words[j] && (Date.parse(when[j]) - Date.parse(when[i])) < 7 * 86400000) close = words[i] + ' ' + when[i] + ' / ' + when[j];
  ok(!close, 'a word never comes back within a week across the six slots' + (close ? ': ' + close : ''));
}

console.log('\nThis day');
{
  const ash = S.chooseReel(MAN, '2026-09-07', 'morning', { m: 1, d: 10 });
  ok(ash && ash.id === 'day-ashura', 'on 10 Muharram the morning reel is Ashura, whatever the rota said');
  const ashE = S.chooseReel(MAN, '2026-09-07', 'evening', { m: 1, d: 10 });
  ok(kind(ashE) !== 'day', 'the evening keeps its rota that day');
  const other = S.chooseReel(MAN, '2026-09-07', 'morning', { m: 1, d: 11 });
  ok(kind(other) !== 'day', 'on 11 Muharram no day reel is chosen');
  const ram = S.chooseReel(MAN, '2026-09-08', 'morning', { m: 9, d: 1 });
  ok(ram && ram.id === 'day-ramadan', 'the first of Ramadan is Ramadan begins, the named day, not the month card');
  const ny = S.chooseReel(MAN, '2026-09-08', 'morning', { m: 1, d: 1 });
  ok(ny && ny.id === 'day-new-year', 'and 1 Muharram is the New Year');
  let leaked = false;
  for (const d of week) for (const h of ['morning', 'evening'])
    if (kind(S.chooseReel(MAN, d, h, null)) === 'day') leaked = true;
  ok(!leaked, 'without a verified Hijri date a day reel is never chosen');
}

console.log('\nan empty shelf');
{
  const noVerse = MAN.filter(c => c.kind !== 'verse');
  const m = S.chooseReel(noVerse, '2026-09-07', 'morning', null);
  ok(m && kind(m) === 'word', 'a verse morning with no verses rendered yet becomes a word, not silence');
  const noName = S.chooseReel(MAN.filter(c => c.kind !== 'name'), '2026-09-11', 'evening', null);
  ok(noName && kind(noName) === 'verse', 'a Friday evening with no Name rendered yet takes the first kind on the shelf, a verse');
  const noDua = S.chooseReel(MAN.filter(c => c.kind !== 'dua'), '2026-09-10', 'night', null);
  ok(noDua && kind(noDua) === 'verse', "a Thursday night with no du'a rendered yet does the same");
  const nothing = S.chooseReel(MAN.filter(c => c.kind === 'day'), '2026-09-07', 'morning', null);
  ok(nothing === null, 'only day reels on the shelf, and not their day: nothing, honestly');
}

console.log('\nyesterday\'s manifest');
{
  const old = [];
  for (let i = 0; i < 6; i++) old.push({ id: 'm' + i, slot: 'morning', hook: 'h', caption: 'c' });
  for (let i = 0; i < 4; i++) old.push({ id: 'e' + i, slot: 'evening', hook: 'h', caption: 'c' });
  const m = S.chooseReel(old, '2026-09-07', 'morning', null), e = S.chooseReel(old, '2026-09-07', 'evening', null);
  ok(m && m.slot === 'morning' && e && e.slot === 'evening', 'cards with no kind are light cards and keep to their half');
  const ids = new Set();
  for (let i = 1; i <= 6; i++) ids.add(S.chooseReel(old, '2026-09-0' + i, 'morning', null).id);
  ok(ids.size === 6, 'and six days still walk all six morning cards');
}

console.log('\nthe old shelf and the new halves');
{
  /* the shelf as it stood before the six kinds rendered: day's cards only,
     filed morning and evening, and no kind field at all */
  const OLD = [{ id: 'l1', slot: 'morning', hook: 'a' }, { id: 'l2', slot: 'evening', hook: 'b' }, { id: 'l3', slot: 'morning', hook: 'c' }, { id: 'l4', slot: 'evening', hook: 'd' }];
  const got = ['morning', 'noon', 'afternoon', 'evening', 'late', 'night'].map(h => S.chooseReel(OLD, '2026-09-07', h, null));
  ok(got.every(Boolean), 'every one of the six halves gets a reel from the old shelf rather than nothing');
  ok(got[0].slot === 'morning' && got[3].slot === 'evening', 'morning and evening keep to their own cards');
  ok(new Set(got.map(c => c.id)).size >= 3, 'the new halves walk the shelf on their own, so a day does not show one card six times');
}


console.log('\nsix months on the full shelf');
{
  const man = [];
  const add = (k, n, slot) => { for (let i = 0; i < n; i++) man.push({ id: k + '-' + i, kind: k, hook: 'h', caption: 'c', ...(slot ? { slot: i % 2 ? 'evening' : 'morning' } : {}) }); };
  /* the live shelf: 600 verse references, and six reels a day */
  add('verse', 600); add('word', 523); add('name', 99); add('know', 225); add('light', 79, true); add('dua', 18);
  const halves = ['morning', 'noon', 'afternoon', 'evening', 'late', 'night'];
  const seen = {}; let twice = 0;
  for (let d = 0; d < 182; d++) {
    const dt = new Date(Date.UTC(2026, 8, 10 + d)).toISOString().slice(0, 10);
    const today = new Set();
    for (const h of halves) { const c = S.chooseReel(man, dt, h, null); if (today.has(c.id)) twice++; today.add(c.id); seen[c.id] = (seen[c.id] || 0) + 1; }
  }
  ok(twice === 0, 'no card is shown twice in one day: ' + twice);
  const max = k => Math.max(...Object.entries(seen).filter(([id]) => id.startsWith(k + '-')).map(([, v]) => v));
  const shown = k => Object.keys(seen).filter(id => id.startsWith(k + '-')).length;
  /* 182 days is 26 weeks of 19 verse slots: 494 verses, every one different */
  ok(max('verse') === 1 && shown('verse') === 494, 'every verse posted in six months is a different one, 19 a week: ' + shown('verse') + ' of 600');
  ok(max('word') === 1 && max('know') === 1 && max('light') === 1, 'and so is every word, Did you know and day\'s card');
  ok(shown('name') === 99 && max('name') <= 2, 'the 99 Names all come round before any is shown a second time');
}

console.log('\nthe afternoon short, four days a week');
{
  /* a shelf that also carries silent shorts: chooseReel only uses the new
     afternoon row once rows of kind "short" actually exist (noShorts) */
  const withShorts = MAN.concat([
    { id: 'short-a', kind: 'short', hook: 's', caption: 'c' },
    { id: 'short-b', kind: 'short', hook: 's', caption: 'c' },
  ]);
  const aft = week.map(d => kind(S.chooseReel(withShorts, d, 'afternoon', null)));
  ok(aft.join() === 'short,word,short,verse,short,know,short', 'afternoons Sun..Sat: ' + aft.join(' '));
  ok(aft.filter(k => k === 'short').length === 4, 'a short goes out four afternoons a week');
  ok(aft[1] === 'word' && aft[3] === 'verse' && aft[5] === 'know', 'Monday, Wednesday and Friday keep the old stand in row');
  /* the same shelf, and the afternoon's OLD kinds still walk their own step
     count rather than colliding with their noon/evening slots */
  const wordAft = S.chooseReel(withShorts, week[1], 'afternoon', null);
  ok(wordAft && wordAft.kind === 'word', 'Monday afternoon is a word, not silence');

  /* a shelf with no shorts rendered yet: every day of the week keeps the
     original stand in row, exactly as before this change */
  const noShorts = week.map(d => kind(S.chooseReel(MAN, d, 'afternoon', null)));
  ok(noShorts.join() === 'name,word,know,verse,verse,know,word', 'with no shorts on the shelf, every afternoon is still the old row: ' + noShorts.join(' '));
}

/* =========================================================================
   THE WALK STEPS PAST WHAT HAS ALREADY GONE OUT

   On 19 September 2026 the 08:00 reel was refused by all five networks at
   once, each of them saying it already had that reel, and the slot went out
   to nobody. The duplicate guard was right every time; it was simply the
   only thing looking, and it is asked after a send is already under way.

   The cause is written into the walk itself: its stride and offset are laid
   out against the length of the list, so a shelf that grows is a new walk.
   Putting the films on the shelf moved 60 of the 84 slots in a fortnight
   onto a different card, and a moved slot can land on something posted days
   earlier.

   The picker now takes what has actually been sent and steps past it. Three
   things have to hold: passing nothing must change nothing, a card known to
   have gone out must never come back while another of its kind is free, and
   a kind that is entirely spent must still yield something rather than
   nothing, because nothing is the fault being fixed.
   ========================================================================= */
console.log('\n=== the walk steps past what has already gone out ===');
{
  const HALVES = ['morning', 'noon', 'afternoon', 'evening', 'late', 'night'];
  const days = [];
  for (let t = Date.parse('2026-09-06T00:00:00Z'); t <= Date.parse('2026-12-06T00:00:00Z'); t += 86400000)
    days.push(new Date(t).toISOString().slice(0, 10));

  //  nothing passed, an empty Set and an empty array are one and the same
  let sameEmpty = 0, n = 0;
  for (const d of days) for (const h of HALVES) {
    const a = S.chooseReel(MAN, d, h, null);
    const b = S.chooseReel(MAN, d, h, null, new Set());
    const c = S.chooseReel(MAN, d, h, null, []);
    n++;
    if ((a && a.id) === (b && b.id) && (a && a.id) === (c && c.id)) sameEmpty++;
  }
  ok(sameEmpty === n, 'an empty set, an empty array and nothing at all pick the same card every time (' + sameEmpty + '/' + n + ')');

  //  the card it would have chosen, marked sent: it must move, and stay in kind
  let moved = 0, stuck = [];
  for (const d of days) for (const h of HALVES) {
    const was = S.chooseReel(MAN, d, h, null);
    if (!was) continue;
    const now = S.chooseReel(MAN, d, h, null, new Set([was.id]));
    if (now && now.id !== was.id && now.kind === was.kind) moved++;
    else stuck.push(d + ' ' + h + ' ' + (was && was.id));
  }
  ok(stuck.length === 0, 'a card already sent is stepped past, for a card of the same kind, on every slot of three months (' + moved + ' moved' + (stuck.length ? ', stuck: ' + stuck.slice(0, 3).join('; ') : '') + ')');

  //  keep marking them off and it keeps finding new ones, right to the end of
  //  the kind. Asked for more than the kind holds it must of course repeat:
  //  the run below is the size of the pool the slot actually draws on, worked
  //  out from the shelf rather than guessed, because a stub shelf with five
  //  Did you knows cannot yield thirty distinct ones and a test that asks for
  //  thirty is testing its own arithmetic.
  {
    const d = '2026-09-06', h = 'noon';
    const kindHere = (S.chooseReel(MAN, d, h, null) || {}).kind;
    const pool = MAN.filter(c => c.kind === kindHere).length;
    const seen = new Set(); const got = []; let repeated = 0;
    for (let i = 0; i < pool; i++) {
      const c = S.chooseReel(MAN, d, h, null, seen);
      if (!c) break;
      if (seen.has(c.id)) repeated++;
      got.push(c.id); seen.add(c.id);
    }
    ok(pool > 3 && repeated === 0 && got.length === pool && new Set(got).size === pool,
       'asked again and again with every answer marked sent, it walks the whole kind without repeating itself (' + kindHere + ': ' + got.length + ' of ' + pool + ', ' + new Set(got).size + ' distinct)');
  }

  //  a kind wholly spent still answers: nothing is the bug, not the remedy
  {
    const know = new Set(MAN.filter(c => c.kind === 'know').map(c => c.id));
    const c = S.chooseReel(MAN, '2026-09-08', 'morning', null, know);
    ok(!!c, 'when every card of the kind has already gone out it still returns one rather than nothing (' + (c ? c.kind + ' ' + c.id : 'NULL') + ')');
  }

  //  and the day's card keeps its date: a named day is not stepped over
  {
    const ash = S.chooseReel(MAN, '2026-09-07', 'morning', { m: 1, d: 10 });
    if (ash) {
      const again = S.chooseReel(MAN, '2026-09-07', 'morning', { m: 1, d: 10 }, new Set([ash.id]));
      ok(again && again.id === ash.id, 'a This day reel still goes out on its own date even when it has been sent before, because the date is the point');
    } else ok(true, 'no This day card in this stub shelf to check');
  }
}

/* =========================================================================
   AND THE READ THAT FEEDS IT
   ========================================================================= */
console.log('\n=== what has already gone out, read from the store ===');
{
  const src = fs.readFileSync(new URL('../api/social.js', import.meta.url), 'utf8');
  ok(/export async function recentlyPosted\(/.test(src), 'social.js exports recentlyPosted for the picker to use');
  ok(/recentlyPosted[\s\S]{0,900}K_POSTED_CH/.test(src),
     'it reads the per channel hash, so a reel that reached three networks of five still counts as sent');
  ok(/recentlyPosted[\s\S]{0,900}DUP_WINDOW_DAYS/.test(src),
     'and it uses the duplicate guard\'s own window, so the picker avoids exactly what the guard would refuse');
  const SOC = await import('../api/social.js');
  const empty = await SOC.recentlyPosted('2026-09-19');
  ok(empty instanceof Map && empty.size === 0, 'with no store configured it answers empty, so the picker behaves exactly as it did before');
}

/* =========================================================================
   HOW FAR BACK THE GUARD LOOKS, HELD TO THE SHELF ITSELF

   On 21 September 2026 the owner found one of his films posted a second time.
   The guard looked back twenty one days. His films come round every ninety
   one, because there are 52 of them and the rota asks for one four times a
   week, so there were seventy days in which a repeat was possible and nothing
   was watching. The walk re-lays itself whenever the shelf grows, and the
   shelf had gone from 22 films to 41 to 52 inside a week, which is how a film
   sent on day 10 was offered again on day 25.

   The number is now sixty. What matters more than the number is that it can
   never again be wrong without something saying so: the shortest honest gap in
   the library is worked out here from the real shelf and the real rota, and
   the window has to sit under it. Add films and the gap shrinks; ask for them
   more often and it shrinks; either way this fails and names the kind.
   ========================================================================= */
console.log('\n=== how far back the guard looks ===');
{
  const SOC = await import('../api/social.js');
  const shelf = JSON.parse(fs.readFileSync(new URL('../reels/index.json', import.meta.url), 'utf8')).cards;
  const HALVES = ['morning', 'noon', 'afternoon', 'evening', 'late', 'night'];
  const pool = {}, perWeek = {};
  for (const c of shelf) { const k = c.kind || 'light'; pool[k] = (pool[k] || 0) + 1; }
  for (let d = 0; d < 7; d++) for (const h of HALVES) {
    const iso = new Date(Date.UTC(2026, 8, 6 + d)).toISOString().slice(0, 10);
    const c = S.chooseReel(shelf, iso, h, null);
    if (c) { const k = c.kind || 'light'; perWeek[k] = (perWeek[k] || 0) + 1; }
  }
  let tightest = null, tightestDays = Infinity;
  for (const k of Object.keys(perWeek)) {
    if (k === 'day') continue;                    /* a This day card is its date, not a cycle */
    const days = Math.round((pool[k] / perWeek[k]) * 7);
    if (days < tightestDays) { tightestDays = days; tightest = k; }
  }
  ok(isFinite(tightestDays) && tightestDays > 0, 'the shortest honest gap can be worked out from the shelf (' + tightest + ', ' + tightestDays + ' days)');
  ok(SOC.DUP_WINDOW_DAYS > 21, 'the guard looks back further than the twenty one days that let a film through (' + SOC.DUP_WINDOW_DAYS + ')');
  ok(SOC.DUP_WINDOW_DAYS < tightestDays,
     'and it still sits under the shortest gap the rota honestly produces, so it never refuses a card whose turn has really come round (' +
     SOC.DUP_WINDOW_DAYS + ' against ' + tightest + ' at ' + tightestDays + ')');
  ok(tightestDays - SOC.DUP_WINDOW_DAYS >= 14, 'with at least a fortnight of margin, not a hair (' + (tightestDays - SOC.DUP_WINDOW_DAYS) + ' days)');
}

/* =========================================================================
   AND WHEN A KIND HAS BEEN USED UP, THE ONE SENT LONGEST AGO
   ========================================================================= */
console.log('\n=== a kind used up falls back to the oldest, not to chance ===');
{
  const d = '2026-09-06', h = 'noon';
  const kindHere = (S.chooseReel(MAN, d, h, null) || {}).kind;
  const all = MAN.filter(c => c.kind === kindHere);
  //  every one of them sent, on dates a month apart, the last one longest ago
  const when = new Map();
  all.forEach((c, i) => when.set(c.id, '2026-0' + (i % 8 + 1) + '-01'));
  let oldestId = null, oldestT = Infinity;
  for (const [id, day] of when) { const t = Date.parse(day + 'T00:00:00Z'); if (t < oldestT) { oldestT = t; oldestId = id; } }
  const got = S.chooseReel(MAN, d, h, null, when);
  ok(got && when.has(got.id), 'with the whole kind spent it still answers rather than going silent');
  ok(got && Date.parse(when.get(got.id) + 'T00:00:00Z') === oldestT,
     'and it answers with one of those sent longest ago, which is the widest gap left to give (' + (got && when.get(got.id)) + ')');
  //  a plain Set still works, it simply knows whether and not when
  const asSet = new Set(when.keys());
  const fromSet = S.chooseReel(MAN, d, h, null, asSet);
  ok(!!fromSet, 'a caller that passes a plain Set, which knows whether but not when, still gets an answer');
}

/* =========================================================================
   THE GUARD CAN ONLY REFUSE WHAT IT REMEMBERS

   The same short went to YouTube on 7 September and again on the 21st. That
   is fourteen days, well inside the guard's window even as it then stood, so
   the window was not the fault. The 7 September send happened before the per
   channel hash existed, and the older ledger only ever names a reel once EVERY
   live network has it, so that send was written down nowhere the guard reads.
   It had no memory of it in any form.

   backfillPosted is the walk that writes the past down. Its reach was fixed at
   twenty one days, which is the bound that keeps its cost sane, not a statement
   about how far back the history goes. It takes the reach from its caller now,
   clamped, so the hole can actually be closed.
   ========================================================================= */
console.log('\n=== the walk that writes the past down ===');
{
  const SOC = await import('../api/social.js');
  const r21 = await SOC.backfillPosted('2026-09-21');
  ok(r21 && r21.days === 21, 'asked for nothing it still walks its old default (' + (r21 && r21.days) + ')');
  const r120 = await SOC.backfillPosted('2026-09-21', 120);
  ok(r120 && r120.days === 120, 'asked for 120 it walks 120, which is what a history starting in August needs (' + (r120 && r120.days) + ')');
  ok(r120 && r120.to === '2026-09-21' && r120.from === '2026-05-25',
     'and it says which days it covered, so nobody has to guess whether it reached far enough (' + (r120 && r120.from) + ' to ' + (r120 && r120.to) + ')');
  const huge = await SOC.backfillPosted('2026-09-21', 9999);
  ok(huge && huge.days === 400, 'a silly reach is clamped rather than run (' + (huge && huge.days) + ')');
  const zero = await SOC.backfillPosted('2026-09-21', 0);
  ok(zero && zero.days === 21, 'and nought falls back to the default rather than walking nothing');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
