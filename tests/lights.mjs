/* NOOR · the day's light.
   ------------------------------------------------------------------
   Today's Light came from fourteen written cards chosen by
   `dayIndexOf(today) % 14`. That is not a rotation, it is a fortnight on a
   loop: a daily reader met the same card twenty six times a year, and the
   owner noticed, which means every daily reader had noticed long before.

   This holds the new library and its picker to their promises, with the
   store and the Lantern both stubbed so it needs no network and no Redis:

     · a year of mornings shows a year of different cards
     · a card anchored to a date appears on that date
     · a Ramadan card appears in Ramadan
     · the ring genuinely prevents repeats
     · with the Lantern dark, the picker still picks
     · when the Lantern doubts the card it chose, that card is HELD BACK and
       the doubt is written where the owner will read it

   Run:  node tests/lights.mjs
*/
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const LIB = JSON.parse(fs.readFileSync('lights/all.json', 'utf8'));
const STORE = new Map();
let lanternReply = null, lanternCalls = 0;

process.env.KV_REST_API_URL = 'https://kv.test';
process.env.KV_REST_API_TOKEN = 't';
process.env.OPENROUTER_API_KEY = 'sk-test';

globalThis.fetch = async (url, opt) => {
  url = String(url);
  if (url.startsWith('https://kv.test')) {
    const cmds = JSON.parse(opt.body);
    const out = cmds.map(c => {
      const [verb, key, ...rest] = c;
      if (verb === 'GET') return { result: STORE.has(key) ? STORE.get(key) : null };
      if (verb === 'SET') { STORE.set(key, rest[0]); return { result: 'OK' }; }
      if (verb === 'LPUSH') { const l = STORE.get(key) || []; l.unshift(rest[0]); STORE.set(key, l); return { result: l.length }; }
      if (verb === 'LRANGE') { const l = STORE.get(key) || []; return { result: l.slice(0, +rest[1] + 1) }; }
      if (verb === 'LTRIM') { const l = STORE.get(key) || []; STORE.set(key, l.slice(0, +rest[1] + 1)); return { result: 'OK' }; }
      return { result: null };
    });
    return { ok: true, status: 200, json: async () => out };
  }
  if (url.includes('/lights/all.json'))
    return { ok: true, status: 200, json: async () => LIB };
  if (url.includes('/api/v1/models'))
    return { ok: true, status: 200, json: async () => ({ data: [{ id: 'x/y:free', context_length: 8000, pricing: { prompt: '0', completion: '0', request: '0' }, architecture: { input_modalities: ['text'], output_modalities: ['text'] } }] }) };
  if (url.includes('/chat/completions')) {
    lanternCalls++;
    if (lanternReply === null) return { ok: false, status: 404, json: async () => ({ error: { message: 'dark' } }), text: async () => 'dark' };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(lanternReply) } }] }) };
  }
  throw new Error('unexpected fetch ' + url);
};

const M = await import('../api/_lights.js');

console.log('\n=== 0. the calendar arithmetic ===');
ok(M.hijriOf('2025-03-01').m === 9 && M.hijriOf('2025-03-01').d === 1,
   '1 March 2025 is 1 Ramadan (' + JSON.stringify(M.hijriOf('2025-03-01')) + ')');
ok(M.hijriName(12) === 'Dhul Hijjah', 'the months are named');

console.log('\n=== 1. a year of mornings ===');
{
  STORE.clear(); lanternReply = null;          /* the Lantern is dark all year */
  const seen = [], ids = new Set();
  for (let i = 0; i < 365; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    const got = await M.chooseLight('h', d, {});
    seen.push(got.id); ids.add(got.id);
  }
  ok(ids.size >= 345, 'a year of mornings shows ' + ids.size + ' different cards, not 14');
  /* no repeat inside the ring */
  let early = 0;
  for (let i = 0; i < seen.length; i++)
    for (let j = Math.max(0, i - 348); j < i; j++) if (seen[i] === seen[j]) early++;
  ok(early === 0, 'every card shows once before any shows twice (' + early + ' repeats)');
  ok(new Set(seen.slice(0, 60)).size === 60, 'the first two months are 60 distinct cards');
}

console.log('\n=== 2. the calendar actually anchors ===');
{
  const dated = LIB.lights.filter(l => l.w && l.w.m && l.w.d);
  ok(dated.length > 10, LIB.lights.length + ' cards, ' + dated.length + ' anchored to an exact day');
  let hit = 0, yielded = 0;
  for (const L of dated.slice(0, 12)) {
    STORE.clear();
    const d = '2026-' + String(L.w.m).padStart(2, '0') + '-' + String(L.w.d).padStart(2, '0');
    const got = await M.chooseLight('h', d, {});
    if (got.id === L.id) { hit++; continue; }
    /* The one thing allowed to beat a Gregorian anniversary is the Islamic day
       the reader is actually in. Ashura outranks the anniversary of a treaty.
       Anything else winning here is the anchor failing. */
    const h = M.hijriOf(d), won = LIB.lights.find(x => x.id === got.id);
    if (won && won.h === h.m && won.hd === h.d) yielded++;
  }
  ok(hit + yielded === 12,
     'a card anchored to a date is shown on that date (' + hit + '/12, ' +
     yielded + ' yielded to an Islamic day)');
  ok(yielded > 0 || hit === 12, 'and when it yields, it yields only to the hijri calendar');
}

console.log('\n=== 2b. the Islamic day outranks the Western one ===');
{
  const hd = LIB.lights.filter(l => l.h && l.hd);
  ok(hd.length >= 10, hd.length + ' cards carry an exact day in the Islamic calendar');
  /* walk two hijri years of real mornings and check every anchored day fires */
  let fired = 0, days = 0;
  for (let t = 0; t < 760; t++) {
    const d = new Date(Date.UTC(2026, 0, 1) + t * 86400000).toISOString().slice(0, 10);
    const h = M.hijriOf(d);
    const due = hd.filter(l => l.h === h.m && l.hd === h.d);
    if (!due.length) continue;
    days++;
    const top = M.scoreLights(LIB.lights, d, [])[0];
    if (due.some(l => l.id === top.L.id)) fired++;
  }
  ok(days > 15, days + ' mornings in two years land on an anchored Islamic day');
  ok(fired === days, 'every one of them surfaces its card (' + fired + '/' + days + ')');
}

console.log('\n=== 2c. the reason printed is the reason it won ===');
{
  /* the bug this guards: `why` was assigned outside the Math.max that set the
     score, so a card that won on 17 Ramadan printed "the season" underneath */
  let wrong = [];
  for (let t = 0; t < 400; t += 3) {
    const d = new Date(Date.UTC(2026, 0, 1) + t * 86400000).toISOString().slice(0, 10);
    const h = M.hijriOf(d);
    for (const r of M.scoreLights(LIB.lights, d, []).slice(0, 5)) {
      const s = Math.floor(r.s);
      const named = r.why;
      if (s >= 1200 && !(r.L.h === h.m && r.L.hd === h.d)) wrong.push(d + ' ' + r.L.id + ' scored ' + s);
      else if (r.L.h === h.m && r.L.hd === h.d && named.indexOf(String(r.L.hd)) !== 0)
        wrong.push(d + ' ' + r.L.id + ' won on the Islamic day but says "' + named + '"');
    }
  }
  ok(wrong.length === 0, 'no card is shown with a reason it did not win on' +
     (wrong.length ? ' (' + wrong.slice(0, 3).join('; ') + ')' : ''));
}

console.log('\n=== 3. the season ===');
{
  STORE.clear();
  const ram = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(2025, 2, 1 + i)).toISOString().slice(0, 10);   /* Ramadan 1446 */
    const got = await M.chooseLight('h', d, {});
    ram.push(got);
  }
  const seasonal = ram.filter(g => /Ramadan|the season/i.test(g.why)).length;
  ok(M.hijriOf('2025-03-05').m === 9, 'the test dates really are in Ramadan');
  ok(seasonal >= 8, seasonal + ' of 12 Ramadan mornings show a card chosen for the season');
}

console.log('\n=== 4. the Lantern as editor ===');
{
  STORE.clear();
  const first = await M.chooseLight('h', '2026-06-10', { peek: true });
  lanternCalls = 0;
  lanternReply = { pick: first.id, why: 'it fits the week', doubt: '' };
  STORE.clear();
  const got = await M.chooseLight('h', '2026-06-10', {});
  ok(lanternCalls > 0, 'the Lantern is asked');
  ok(got.id === first.id, 'it can confirm the top candidate');
  ok(got.why === 'it fits the week', 'and its reason is what the reader is told');
  ok(got.source === 'library+lantern', 'the source names both (' + got.source + ')');
}

console.log('\n=== 5. when the editor doubts the card ===');
{
  STORE.clear();
  const first = await M.chooseLight('h', '2026-06-11', { peek: true });
  STORE.clear();
  lanternReply = { pick: first.id, why: 'fits', doubt: 'the year 1187 looks wrong to me' };
  const got = await M.chooseLight('h', '2026-06-11', {});
  ok(got.id !== first.id, 'the doubted card is HELD BACK, not published');
  const d = await M.doubts();
  ok(d.length === 1 && /1187/.test(d[0].doubt), 'and the doubt is written where the owner reads it');
  ok(d[0].id === first.id, 'against the card it was raised about');
}

console.log('\n=== 6. the Lantern dark ===');
{
  STORE.clear(); lanternReply = null;
  const got = await M.chooseLight('h', '2026-06-12', {});
  ok(!!got && !!got.title, 'the picker still picks with no AI at all');
  ok(got.source === 'library', 'and says the light came from the library alone');
  ok(got.lvl && ['quran', 'sunnah', 'debated', 'editorial'].includes(got.lvl),
     'carrying its evidence level (' + got.lvl + ')');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
