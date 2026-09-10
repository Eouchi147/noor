/* NOOR · the asking field
   ---------------------------------------------------------------------------
   The arrival and /ask are the same block, and the block has one promise: a
   stranger who arrives with a question in their head gets it answered without
   navigating anywhere, and the answer is the library's own words rather than
   anything written for a landing page.

   So this holds three things, and they are the three that can quietly break.

     the fallback   what ships in the HTML must work with no JavaScript at all:
                    real links to real rooms and a real GET form. Every clever
                    thing above it is an upgrade, and an upgrade that fails
                    leaves a working page or it is not an upgrade.

     the source     every answer must still be, verbatim, in the room it claims
                    to come from. scripts/build-questions.py lifts them; nothing
                    stops the room being rewritten afterwards, and an arrival
                    screen answering a stranger's first question about Islam
                    with prose the room no longer contains is the worst failure
                    this page has available to it. So the file is checked
                    against the rooms, not against itself.

     the gesture    one tap opens one answer, in place, with its evidence and a
                    door into the room; two characters put the whole library
                    underneath it; clearing goes home.

       node tests/ask.mjs
*/
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = Number(process.env.NOOR_PORT || 8231);
const BASE = process.env.NOOR_BASE || ('http://127.0.0.1:' + PORT);
const ROOT = process.cwd();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

/* ---------------------------------------------------------------- the file */
console.log('\n=== every answer is still in the room it came from ===');
const QF = path.join(ROOT, 'assets/questions.json');
ok(fs.existsSync(QF), 'assets/questions.json is generated and present');
const data = JSON.parse(fs.readFileSync(QF, 'utf8'));
ok(Array.isArray(data.q) && data.q.length >= 40,
  'it carries ' + data.q.length + ' questions, and a stranger has more than a handful to pick from');

/* The house writes ﷺ as &#65018; and its separators as &middot;, so a hand-kept
   list of named entities is not a decoder, it is a list of the ones somebody
   remembered. Numeric entities are decoded outright and the named ones the
   house actually uses are mapped; anything else left standing would show up
   here as drift, which is the right way round for a check like this. */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  middot: '·', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', times: '×', deg: '°', shy: '' };
const strip = h => h.replace(/<[^>]+>/g, '')
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in NAMED ? NAMED[n.toLowerCase()] : m))
  .replace(/\s+/g, ' ');

let drift = [], bad = [];
for (const r of data.q) {
  if (!r.q || !r.u || !r.p) { bad.push(r.q || '(unnamed)'); continue; }
  const file = path.join(ROOT, r.u.split('#')[0].replace(/^\//, '') + '.html');
  if (!fs.existsSync(file)) { drift.push(r.q + ' → ' + r.u + ' (no such room)'); continue; }
  const src = strip(fs.readFileSync(file, 'utf8'));
  if (!src.includes(r.p.replace(/\s+/g, ' ').trim())) drift.push(r.q + ' → ' + r.u);
}
ok(bad.length === 0, 'every entry carries a question, a room and an answer'
  + (bad.length ? ' (' + bad.slice(0, 3).join(', ') + ')' : ''));
ok(drift.length === 0, 'and every answer is still, word for word, in its room'
  + (drift.length ? '\n       ' + drift.slice(0, 6).join('\n       ') : ''));

const urls = new Set(data.q.map(r => r.u));
ok(urls.size === data.q.length, 'no two questions send the reader to the same room');
ok(data.q.every(r => /\?$/.test(r.q.trim())), 'every question is written as a question');
ok(data.q.every(r => r.p.length >= 80), 'no answer is a fragment');

/* ------------------------------------------------------------ the fallback */
console.log('\n=== it works with no JavaScript at all ===');
let srv = null;
async function up() {
  try { const r = await fetch(BASE + '/'); if (r.ok) return; } catch (e) {}
  srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
}
await up();

const br = await chromium.launch({ executablePath: EXE, args: ['--no-proxy-server'] });
const plain = await br.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
for (const [url, want] of [['/', 6], ['/ask', 40]]) {
  const pg = await plain.newPage();
  await pg.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  const r = await pg.evaluate(() => ({
    links: [...document.querySelectorAll('a.ask-q')].map(a => a.getAttribute('href')),
    form: (() => { const f = document.querySelector('form.ask-field'); return f && { a: f.getAttribute('action'), m: (f.getAttribute('method') || '').toLowerCase() }; })(),
    named: !!document.querySelector('form.ask-field input[name]')
  }));
  ok(r.links.length >= want, url + ' ships ' + r.links.length + ' real links with the script switched off');
  ok(r.links.every(h => h && h.startsWith('/')), url + ' and every one of them points into this house');
  ok(r.form && r.form.a === '/ask' && r.form.m === 'get' && r.named,
    url + ' and the field is a real GET form, so typing still goes somewhere');
  await pg.close();
}
await plain.close();

/* ------------------------------------------------------------- the gesture */
console.log('\n=== one tap, one answer, in place ===');
const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push(e.message));
await pg.goto(BASE + '/', { waitUntil: 'networkidle' });
await pg.waitForTimeout(1800);

ok(await pg.$$eval('button.ask-q', b => b.length) === 6,
  'the six links have become six disclosures');
ok(await pg.$$eval('button.ask-q', b => b.every(x => x.getAttribute('aria-expanded') === 'false')),
  'and all six start shut, and say so');

await pg.click('button.ask-q >> nth=0');
await pg.waitForTimeout(700);
const one = await pg.evaluate(() => {
  const p = document.querySelector('.ask-a');
  return p && {
    inside: p.closest('li') === document.querySelector('button.ask-q').closest('li'),
    words: (p.querySelector('.p') || {}).textContent || '',
    go: (p.querySelector('.go') || {}).getAttribute ? p.querySelector('.go').getAttribute('href') : null,
    tall: Math.round(p.getBoundingClientRect().height),
    open: document.querySelector('button.ask-q').getAttribute('aria-expanded')
  };
});
ok(!!one && one.open === 'true' && one.tall > 80, 'a tap opens the answer, and it has height');
ok(!!one && one.inside, 'and it opens where the question stands, not somewhere else');
ok(!!one && one.words.length > 80, 'and the answer is prose, not a stub');
ok(!!one && one.go && one.go.startsWith('/'), 'and the room is one more tap away (' + (one && one.go) + ')');
ok(one.words.trim().startsWith(data.q.find(r => r.u === one.go).p.slice(0, 40)),
  'and the words are the room’s own, not a summary of them');

await pg.click('button.ask-q >> nth=2');
await pg.waitForTimeout(700);
ok(await pg.$$eval('button.ask-q', b => b.filter(x => x.getAttribute('aria-expanded') === 'true').length) === 1,
  'opening a second answer shuts the first: one thing to read at a time');

/* ------------------------------------------------------- the whole library */
console.log('\n=== and then the field answers everything else ===');
await pg.fill('#ask-in', 'zakat');
await pg.waitForTimeout(1300);
const typed = await pg.evaluate(() => ({
  groups: [...document.querySelectorAll('.ask-grp')].map(e => e.textContent),
  rows: document.querySelectorAll('a.ask-r').length,
  qs: document.querySelectorAll('button.ask-q').length,
  said: (document.querySelector('[data-ask-live]') || {}).textContent || ''
}));
ok(typed.rows + typed.qs > 3, 'two characters and the library answers (' + (typed.rows + typed.qs) + ' rows)');
ok(typed.groups[0] === 'Answered here',
  'a question we can answer in place is offered before a link to go somewhere');
ok(typed.groups.length > 1, 'and the library’s own groups come under it: ' + typed.groups.slice(1, 4).join(', '));
ok(/result/.test(typed.said), 'and a reader who cannot see the screen is told what happened: “' + typed.said + '”');
ok(await pg.$eval('[data-ask-live]', e => {
  const s = getComputedStyle(e);
  return s.display !== 'none' && s.visibility !== 'hidden' && !e.hasAttribute('hidden');
}), 'which means the live line is present to a screen reader, not display:none');

await pg.fill('#ask-in', '');
await pg.waitForTimeout(700);
ok(await pg.$$eval('button.ask-q', b => b.length) === 6, 'clearing the field goes home to the six');
ok(await pg.$$eval('button.ask-q', b => b.every(x => x.getAttribute('aria-expanded') === 'false')),
  'and they are shut again, not left half-open from before');

ok(errs.length === 0, 'and nothing threw' + (errs.length ? ': ' + errs[0] : ''));

/* --------------------------------------------------------------- the room */
console.log('\n=== /ask is a room of the house ===');
const p2 = await ctx.newPage();
await p2.goto(BASE + '/ask?q=hajj', { waitUntil: 'networkidle' });
await p2.waitForTimeout(1600);
const room = await p2.evaluate(() => ({
  bar: !!document.querySelector('.n2-bar'),
  title: document.title,
  h1: document.querySelectorAll('h1').length,
  prefilled: (document.getElementById('ask-in') || {}).value,
  answered: document.querySelectorAll('.ask-grp, a.ask-r, button.ask-q').length
}));
ok(room.bar, 'it wears the house bar, so a reader is never trapped in it');
ok(room.h1 === 1 && /Ask/.test(room.title), 'it has one heading and its own title');
ok(room.prefilled === 'hajj', 'and /ask?q=… arrives with the question already in the field');
ok(room.answered > 1, 'and already answered (' + room.answered + ' rows), so a shared link lands on the answer');

await br.close();
if (srv) srv.kill();
console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
