/* NOOR · one picture per post.
   ------------------------------------------------------------------
   THE BUG THIS FIXES

   /api/card only ever drew the day's light, and the poster handed that one url
   to every slot it sent. So the dawn reminder, the word of the day and the
   chapter of the Path all went out carrying the light's card. Four posts a day,
   four different captions, one identical picture -- and on Instagram, where the
   picture is the post, that is the same post four times.

   The owner saw it on his own feed before any test did: a fasting reminder
   captioned "Monday and Thursday · 18 Rabi al-Awwal" wearing a card about the
   death of the Prophet and Abu Bakr's answer to it.

   A slot now asks for its own card, composed from exactly what the caption is
   composed from, so the two cannot drift apart.

   Run:  node tests/cards.mjs
*/
import fs from 'fs';
import { stubFetch } from './_stub-hijri.mjs';

const root = new URL('../', import.meta.url);
const idx = JSON.parse(fs.readFileSync(new URL('assets/menu-index.json', root), 'utf8'));
const lights = JSON.parse(fs.readFileSync(new URL('lights/all.json', root), 'utf8'));
globalThis.fetch = async url => {
  const u = String(url);
  if (u.includes('aladhan')) return stubFetch()(u);
  if (u.includes('menu-index.json')) return { ok: true, status: 200, json: async () => idx };
  if (u.includes('/lights/all.json')) return { ok: true, status: 200, json: async () => lights };
  throw new Error('unexpected fetch ' + u);
};

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL ' + m)); };

const card = await import('../api/card.js');
const { SLOT_IDS } = await import('../api/_schedule.js');
const social = fs.readFileSync(new URL('api/social.js', root), 'utf8');

const DATE = '2026-08-31';
async function render(slot) {
  let body = null, code = 200;
  const res = { setHeader(){}, status(c){ code = c; return this; }, send(b){ body = String(b); return this; } };
  await card.default({ query: { date: DATE, slot }, headers: { host: 'noorcodex.com' } }, res);
  return { code, svg: body || '' };
}
const text = svg => [...svg.matchAll(/>([^<>]{2,})</g)].map(m => m[1].trim());
const titleOf = svg => (svg.match(/aria-label="([^"]*)"/) || [])[1] || '';

console.log('\n=== 1. the poster asks for a card per slot ===');
ok(/api\/card\?date=" \+ date \+ "&slot="/.test(social),
   'composeSlot puts the slot in the card url');
ok((social.match(/&slot=" \+ encodeURIComponent/g) || []).length >= 2,
   'and so does the path the cron takes');
/* the bare url is still right in exactly one place: compose(), which builds
   the light's own post and therefore wants the light's own card */
const bare = (social.match(/api\/card\?date=" \+ date \+ "&fmt=png"/g) || []).length;
ok(bare === 1, 'the only caller left on the bare url is the light itself (found ' + bare + ')');

console.log('\n=== 2. each slot draws its own card ===');
const cards = {};
for (const slot of SLOT_IDS) cards[slot] = await render(slot);
for (const slot of SLOT_IDS) ok(cards[slot].code === 200, slot + ' renders');

/* lead has nothing to announce on this date, so it falls back to the light --
   that is the designed fallback, and that slot is not sent when it is empty */
const posting = ['dawn', 'light', 'word', 'dusk'];
const titles = posting.map(s => titleOf(cards[s].svg));
ok(new Set(titles).size === posting.length,
   'the four slots that post today draw four different cards (' + new Set(titles).size + '/4)');
ok(new Set(posting.map(s => cards[s].svg)).size === posting.length,
   'and four different pictures, byte for byte');

console.log('\n=== 3. the card says what the caption says ===');
ok(titleOf(cards.dawn.svg) === 'Monday and Thursday',
   'the fasting reminder carries the fasting card, not the light (' + titleOf(cards.dawn.svg) + ')');
ok(text(cards.dawn.svg).some(t => /deeds are/.test(t)), 'and its own words');
ok(text(cards.dawn.svg).some(t => /18 Rabi al-Awwal 1448/.test(t)),
   'footed with the verified date');

console.log('\n=== 4. nothing is printed twice ===');
for (const slot of posting) {
  const t = titleOf(cards[slot].svg);
  const lines = text(cards[slot].svg);
  const i = lines.indexOf(t);
  const after = lines.slice(i + 1).join(' ');
  ok(!after.startsWith(t), slot + ': the body does not repeat the headline');
  ok(!/^\d{1,2}\s+[^\d]{2,30}\s+\d{3,4}\.?\s/.test(after),
     slot + ': the body does not repeat the date the footer carries');
}

console.log('\n=== 5. an eyebrow that names the kind of post ===');
const EYE = { dawn: 'TODAY', word: 'A WORD', dusk: 'THE PATH' };
for (const [slot, want] of Object.entries(EYE))
  ok(text(cards[slot].svg).includes(want), slot + ' is labelled ' + want);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
