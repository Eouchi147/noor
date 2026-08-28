/* NOOR · the dials must turn something.
   ------------------------------------------------------------------
   The owner switched the Guardian's Journal off and it kept working: the link
   stayed in the menu on fifty four pages and /journal rendered in full. The
   API had been right all along; the menu is baked into static HTML at
   generation time, so no server dial can reach it.

   This holds assets/noor-dials.js to the four things it must do:
     · with the journal off, no page offers a way into it
     · with the journal off, standing on /journal says so and offers the way back
     · with the journal ON, nothing is touched
     · if /api/settings never answers, nothing is touched  (fail open)

   Run:  node tests/dials.mjs        (server on 8433)
*/
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8433';
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

async function withDials(dials, fn) {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  await page.route('**/api/settings*', r => {
    if (dials === null) return r.abort();
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ s: dials }) });
  });
  await page.route('**/api/journal*', r => r.fulfill({
    status: dials && dials['journal.on'] === false ? 404 : 200,
    contentType: 'application/json', body: '{"ok":false,"reason":"closed"}' }));
  await fn(page);
  await ctx.close();
}

const PAGES = ['/', '/quran', '/good-life', '/three-lives', '/pillars'];

console.log('\n=== the journal switched OFF ===');
await withDials({ 'journal.on': false, 'journal.replies': false }, async page => {
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'load' });
    await page.waitForTimeout(420);
    const r = await page.evaluate(() => {
      const all = [...document.querySelectorAll('a[href="/journal"],a[href="journal.html"],a[href^="/journal/"]')];
      const live = all.filter(a => {
        const row = a.closest('li, .shl, .door-in > a, .wgo-c') || a;
        return !row.hasAttribute('hidden') && row.style.display !== 'none';
      });
      return { all: all.length, live: live.length };
    });
    ok(r.all > 0, path + ' carries a journal link to begin with (' + r.all + ')');
    ok(r.live === 0, path + ' offers no way into the journal once it is off');
  }
  await page.goto(BASE + '/journal', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const t = await page.evaluate(() => document.body.innerText);
  ok(/journal is closed/i.test(t), '/journal says plainly that it is closed');
  ok(/Back to the Codex/i.test(t), 'and offers the way back');
  const rules = await page.evaluate(() =>
    [...document.querySelectorAll('.jlist, #jlist')].filter(e => e.offsetParent !== null).length);
  ok(rules === 0, 'and the entry list is not rendered');
});

console.log('\n=== the journal switched ON ===');
await withDials({ 'journal.on': true, 'journal.replies': true }, async page => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(420);
  const live = await page.evaluate(() =>
    [...document.querySelectorAll('a[href="/journal"],a[href="journal.html"]')]
      .filter(a => { const row = a.closest('li, .shl, .door-in > a, .wgo-c') || a;
                     return !row.hasAttribute('hidden') && row.style.display !== 'none'; }).length);
  ok(live > 0, 'the link is left alone when the dial is on (' + live + ')');
  await page.goto(BASE + '/journal', { waitUntil: 'load' });
  await page.waitForTimeout(420);
  ok(!/journal is closed/i.test(await page.evaluate(() => document.body.innerText)),
     'and the page is not closed');
});

console.log('\n=== the settings endpoint never answers ===');
await withDials(null, async page => {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const live = await page.evaluate(() =>
    [...document.querySelectorAll('a[href="/journal"],a[href="journal.html"]')]
      .filter(a => { const row = a.closest('li, .shl, .door-in > a, .wgo-c') || a;
                     return !row.hasAttribute('hidden') && row.style.display !== 'none'; }).length);
  ok(live > 0, 'it fails OPEN: a network hiccup never hides a section (' + live + ')');
});

await b.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
