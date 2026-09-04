/* NOOR · the half of the counter that runs in the reader's browser.
   ------------------------------------------------------------------
   The server turns away anything that names itself a machine. This is the
   other half: the owner's own devices, browsers being driven by software, and
   pages nobody actually looked at -- a link the browser prefetched against a
   click that never came, or a prerender that was thrown away.

   Run:  python3 /tmp/vercelish.py . 8231 &   node tests/beaconclient.mjs
*/
import { chromium } from 'playwright';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8231';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const br = await chromium.launch();

/* Playwright drives a real browser, so navigator.webdriver is true in every
   page it opens. That is the very thing being tested, so the other cases have
   to put it back to what a person's browser reports. */
async function page({ human = true, url = '/tests/fixtures/beacon-page.html', ctx = {} } = {}) {
  const c = await br.newContext(ctx);
  if (human) await c.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
  });
  const pg = await c.newPage();
  await pg.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  return pg;
}
const sent = pg => pg.evaluate(() => window.__sent.filter(u => u.indexOf('/api/beacon') === 0).length);

console.log('\na page somebody looked at');
{
  const pg = await page();
  await pg.waitForTimeout(400);
  ok(await sent(pg) === 0, 'nothing is sent in the first moment');
  await pg.waitForTimeout(1400);
  ok(await sent(pg) === 1, 'and exactly one ping once the page has been up a second');
  await pg.context().close();
}

console.log('\na browser being driven by software');
{
  const pg = await page({ human: false });     /* webdriver left true */
  await pg.waitForTimeout(2000);
  ok(await sent(pg) === 0, 'an automated browser is never a reader');
  await pg.context().close();
}

console.log('\nthe owner, marked once');
{
  const pg = await page({ url: '/tests/fixtures/beacon-page.html?nocount=1' });
  await pg.waitForTimeout(2000);
  ok(await sent(pg) === 0, 'visiting with ?nocount=1 stops this browser counting');
  const flag = await pg.evaluate(() => localStorage.getItem('noor_nocount'));
  ok(flag === '1', 'and the mark is kept');

  /* the same browser, a later ordinary visit */
  const pg2 = await pg.context().newPage();
  await pg2.goto(BASE + '/tests/fixtures/beacon-page.html', { waitUntil: 'domcontentloaded' });
  await pg2.waitForTimeout(2000);
  ok(await sent(pg2) === 0, 'and it stays uncounted on every visit after');

  const pg3 = await pg.context().newPage();
  await pg3.goto(BASE + '/tests/fixtures/beacon-page.html?nocount=0', { waitUntil: 'domcontentloaded' });
  await pg3.waitForTimeout(2000);
  ok(await pg3.evaluate(() => localStorage.getItem('noor_nocount')) === null, '?nocount=0 undoes it');
  ok(await sent(pg3) === 1, 'and that browser is counted again');
  await pg.context().close();
}

console.log('\na page nobody looked at');
{
  /* a background tab is what a prefetch and a prerender both look like */
  const c = await br.newContext();
  await c.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
  });
  const pg = await c.newPage();
  await pg.goto(BASE + '/tests/fixtures/beacon-page.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2000);
  ok(await sent(pg) === 0, 'a page that was never visible is never counted');
  await c.close();
}

console.log('\nthe console takes the device out of the count');
{
  /* the way it really happens: the console asks whether this browser is
     already signed in, and shows the dashboard when it is */
  const c = await br.newContext();
  const pg = await c.newPage();
  const VIS = { ok: true, enabled: true, store: 'rest',
    days: Array.from({ length: 30 }, (_, i) => ({ date: '2026-08-' + String(6 + i).padStart(2, '0'),
      people: 20, views: 50, filtered: 9 })),
    totals: { views30: 1500, people30: 600 }, cleanFrom: '2026-08-28',
    filtered: { total: 271, by: { bot: 240, preview: 20, noua: 11 } },
    countries: [], rooms: [], sources: [], hours: [],
    duration: { n: 0, avg: 0, buckets: {}, days: [] }, dayRooms: [], roomTime: [] };
  await pg.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(r.request().url().includes('/api/visitors') ? VIS : { ok: true }) }));
  await pg.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const d = document.getElementById('dash'); return d && !d.hidden; }, { timeout: 10000 });
  const flag = await pg.evaluate(() => { try { return localStorage.getItem('noor_nocount'); } catch (e) { return null; } });
  ok(flag === '1', 'opening the console marks that browser, without being asked');

  /* and the switch in the Traffic tab flips it both ways */
  await pg.click('[data-pane="traffic"]');
  await pg.waitForSelector('#t-mytoggle', { timeout: 10000 });
  const read = () => pg.evaluate(() => ({
    flag: localStorage.getItem('noor_nocount'),
    label: document.getElementById('t-mytoggle').textContent.trim(),
    says: document.getElementById('t-honest').innerText
  }));
  const a1 = await read();
  ok(a1.label === 'Count this browser', 'the switch offers to put this browser back in');
  ok(/is not counted/.test(a1.says), 'and the panel says it is out');
  await pg.click('#t-mytoggle');
  await pg.waitForTimeout(200);
  const a2 = await read();
  ok(a2.flag === null, 'pressing it puts the browser back in the count');
  ok(a2.label === 'Stop counting this browser' && /IS being counted/.test(a2.says),
     'and the panel says so, rather than showing the same thing twice');
  await pg.click('#t-mytoggle');
  await pg.waitForTimeout(200);
  ok((await read()).flag === '1', 'and pressing it again takes it back out');
  await c.close();
}

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
