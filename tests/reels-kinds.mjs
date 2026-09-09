/* NOOR · seven kinds of reel share six slots a day.
   ------------------------------------------------------------------
   The rota is a promise to a follower: a verse, a word, a Did you know and
   the day's card in a rhythm, never a run of one thing. This checks the
   rota does what it says, that a This day reel appears on its date and on
   no other, that an empty shelf yields its turn instead of silencing the
   account, and that yesterday's manifests, which knew no kinds, still work.

   Run:  node tests/reels-kinds.mjs
*/
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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
