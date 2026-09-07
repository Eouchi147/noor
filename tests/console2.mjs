/* NOOR · the new console, driven the way a thumb drives it.
   ------------------------------------------------------------------
   admin2.html is one file that talks to the same endpoints as the old
   console. This opens it at a phone's width and at a desk's, feeds every
   endpoint a day that actually happened, and checks that the four surfaces
   draw, that nothing scrolls sideways, that no script throws, and that each
   button asks the server for exactly what its label says.

   Run:  python3 /tmp/vercelish.py . 8231 &   node tests/console2.mjs
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8231';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
mkdirSync('tests/shots', { recursive: true });
const br = await chromium.launch();

const TODAY = {
  ok: true, date: '2026-09-07', nowHour: 18, plan: { hijri: { d: 24, name: 'Rabi al-Awwal', y: 1448 }, verified: true },
  slots: [
    { id: 'dawn', at: 5, state: 'sent', title: '24 Rabi al-Awwal', results: { facebook: { ok: true }, instagram: { ok: true } } },
    { id: 'reelA', at: 8, state: 'due', title: 'A reel that did not go' },
    { id: 'lead', at: 9, state: 'skipped', title: '' },
    { id: 'light', at: 12, state: 'partial', title: 'The word for human nature also means breaking a fast',
      results: { facebook: { ok: true, id: 'F' }, instagram: { ok: false, error: 'Meta could not fetch the image', code: 9004 } } },
    { id: 'word', at: 16, state: 'sent', title: 'Qalqalah', results: { facebook: { ok: true }, instagram: { ok: true } } },
    { id: 'reelB', at: 17, state: 'pending', title: 'A reel', results: { facebook: { ok: true }, instagram: { ok: false, pending: 'CONT' } } },
    { id: 'dusk', at: 20, state: 'waiting', title: 'A chapter' }
  ]
};
const DIAG = { ok: true, where: 'instagram', slot: 'light', said: 'Meta could not fetch the image', code: 9004,
  cause: 'Instagram could not fetch or process the card image', fix: 'retry', canRetry: true,
  checks: [{ name: 'the card image', ok: true, detail: 'image/png, 41 KB, reachable now' }],
  steps: ['Press Retry.'] };
const DIALS = { ok: true, dials: { mode: 'auto' }, configured: { fb: true, ig: true } };
const TOKENS = { tokens: { fb: { daysLeft: 41, renewedAt: '2026-08-19' }, ig: { daysLeft: 41 }, lifeDays: 60 } };
const REDDIT = { held: [{ slot: 'light', title: 'A draft for r/islam', text: 'Body of the draft', links: [] }] };
const LOG = { log: [{ at: '2026-09-07T12:00:00Z', slot: 'light', state: 'partial' }], queue: [] };
const VIS = { enabled: true, store: 'redis', totals: { views30: 310, people30: 85 }, cleanFrom: '2026-09-04',
  days: [{ date: '2026-08-30', views: 60, people: 20, filtered: 30 }, { date: '2026-09-04', views: 80, people: 34, filtered: 28 }, { date: '2026-09-07', views: 90, people: 31, filtered: 30 }],
  rooms: [{ r: 'quran', n: 40 }, { r: 'names', n: 12 }], countries: [{ c: 'FR', n: 30 }, { c: 'MA', n: 20 }], sources: [{ s: 'google', n: 25 }],
  filtered: { total: 88, by: { bot: 80, noua: 8 } } };
const INBOX = { ok: true, counts: { new: 1 }, items: [{ id: 'm1', at: '2026-09-07T09:00:00Z', body: 'Salam, thank you for the library', from: 'a reader', kind: 'note', status: 'new' }] };
const QUEUE = { queue: [{ entry: 'e1', slug: 'first-light', title: 'First light', cid: 'c9', name: 'anon', body: 'A reply that waits, and goes on for long enough that the row can only show the start of it, which is why the whole of it opens when the row is tapped', at: '2026-09-07T08:00:00Z', state: 'pending', why: 'link' }] };
const HOUSE = { store: true, storeKind: 'redis', lanternConfigured: true, lanternModel: 'x/inkling:free', moneyMode: 'quiet', weekly: 3, mrr: 120, activeCount: 4,
  guardians: [{ market: 'FR', status: 'active', amount: 15, cadence: 'month', currency: 'EUR', email: 'g@x.y', name: 'A', started: '2026-05-01', renews: '2026-10-01', endsAfterWeek: false, approved: true, gname: 'Amina', gurl: '', gline: '' }],
  gifts: { total30d: 90, count30d: 3, monthly: 60, recent: [{ amount: 30, currency: 'USD', when: '2026-09-01', email: 'a@b.c' }] } };
const LANTERN = { ok: true, answered: 'x/inkling:free', reply: 'lit', tried: [{ model: 'x/inkling:free', ms: 900, err: '' }], ms: 950 };

async function open_(w, h, posted, errors, opts = {}) {
  const pg = await br.newPage({ viewport: { width: w, height: h } });
  pg.on('pageerror', e => errors.push(String(e)));
  pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  pg.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  const J = (b, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(b) });
  await pg.route('**/*', r => {
    const q = r.request(), u = q.url();
    if (q.method() === 'POST' && u.includes('/api/')) {
      const b = JSON.parse(q.postData() || '{}'); posted.push({ url: u.replace(BASE, ''), body: b });
      if (u.includes('/api/journal') && b.action === 'queue') return r.fulfill(J(QUEUE));
      if (u.includes('/api/admin-auth')) return r.fulfill(J({ ok: true }));
      return r.fulfill(J({ ok: true, where: 'instagram', state: 'sent', results: {} }));
    }
    if (u.includes('/api/admin-data?probe=lantern')) return r.fulfill(J(LANTERN));
    if (u.includes('/api/admin-data')) return r.fulfill(J(HOUSE));
    if (u.includes('/api/social')) {
      if (u.includes('action=diagnose')) return r.fulfill(J(DIAG));
      if (u.includes('action=dials')) return r.fulfill(J(DIALS));
      if (u.includes('action=tokens')) return r.fulfill(J(TOKENS));
      if (u.includes('action=reddit')) return r.fulfill(J(REDDIT));
      if (u.includes('action=log')) return r.fulfill(J(LOG));
      if (u.includes('action=slot')) return r.fulfill(J({ ok: true, slot: 'light', state: 'partial',
        post: { title: TODAY.slots.find(s => s.id === 'light').title, body: 'The card text', image: '/api/card?slot=light' }, shaped: { instagram: { text: 'The card text #noor' } } }));
      if (opts.legacy) { const t = JSON.parse(JSON.stringify(TODAY)); t.slots = t.slots.map(x => x.id === 'light' ? { id: 'light', at: 12, state: 'due', title: '' } : x); t.legacy = { state: 'sent', at: '2026-09-07T12:01:00Z', title: 'The card' }; return r.fulfill(J(t)); }
      return r.fulfill(J(TODAY));
    }
    if (u.includes('/api/visitors')) return r.fulfill(J(VIS));
    if (u.includes('/api/inbox')) return r.fulfill(J(INBOX));
    if (u.includes('/reels/index.json')) return r.fulfill(J({ n: 2, cards: [{ id: 'a', slot: 'morning', hook: 'A', caption: 'x' }, { id: 'b', slot: 'evening', hook: 'B', caption: 'y' }] }));
    if (u.includes('/api/card') || /\/reels\/.*\.(jpg|png)$/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') });
    if (u.includes('/api/')) return r.fulfill(J({ ok: true }));
    if (u.startsWith(BASE)) return r.continue();
    if (u.includes('fonts.g')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.abort();
  });
  await pg.goto(BASE + '/admin2.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#app.on, #app:not([hidden])', { timeout: 15000 });
  await pg.waitForSelector('#s-today .card, #s-today .row, #s-today .strip', { timeout: 15000 });
  await pg.waitForTimeout(400);
  return pg;
}

const noSideScroll = pg => pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const surfaceOn = pg => pg.evaluate(() => (document.querySelector('.surf.on') || {}).id);

for (const [label, w, h] of [['phone 390', 390, 844], ['desk 1280', 1280, 900]]) {
  const posted = [], errors = [];
  const pg = await open_(w, h, posted, errors);
  console.log('\n' + label + ' · the gate and Today');
  ok(await pg.evaluate(() => document.getElementById('gate').hidden || getComputedStyle(document.getElementById('gate')).display === 'none'),
     'the probe unlocked the console without a password prompt');
  ok(await pg.evaluate(() => { try { return localStorage.getItem('noor_nocount') === '1'; } catch { return false; } }),
     'this browser is marked as not-a-reader for the traffic count');
  ok((await surfaceOn(pg)) === 's-today', 'Today is the first surface');
  const today = await pg.evaluate(() => document.getElementById('s-today').innerText);
  ok(/Rabi al-Awwal/.test(today), 'the Hijri date is named');
  ok(/dawn/.test(today) && /dusk/.test(today) && (today.match(/\d\d:00/g) || []).length >= 7, 'every slot of the day is on the strip');
  ok(/reelA is owed/.test(today) && /light is half sent/.test(today), 'what needs a hand is listed first');
  ok(!/dusk is owed/.test(today), 'a slot whose hour has not come is not called owed');
  ok(await noSideScroll(pg), 'nothing scrolls sideways');
  ok(await pg.evaluate(() => getComputedStyle(document.getElementById('sheet')).visibility === 'hidden'), 'the closed sheet is out of the way of screen readers and the tab key');
  await pg.screenshot({ path: 'tests/shots/console2-' + w + '-today.png', fullPage: true });

  console.log(label + ' · Posts');
  await pg.click('nav.bar [data-s="posts"]');
  await pg.waitForSelector('#s-posts .slot', { timeout: 15000 });
  await pg.waitForTimeout(300);
  ok((await surfaceOn(pg)) === 's-posts', 'the bar moves to Posts');
  const p = await pg.evaluate(() => ({
    retry: [...document.querySelectorAll('[data-retry]')].map(b => b.getAttribute('data-retry')),
    fix: [...document.querySelectorAll('[data-fix]')].map(b => b.getAttribute('data-fix')),
    why: [...document.querySelectorAll('[data-why]')].map(b => b.getAttribute('data-why')),
    send: [...document.querySelectorAll('[data-send]')].map(b => b.getAttribute('data-send')),
    mode: (document.querySelector('#seg button.on') || {}).dataset && document.querySelector('#seg button.on').dataset.mode,
    text: document.getElementById('s-posts').innerText,
    gridEmpty: document.getElementById('reel-grid').children.length === 0
  }));
  ok(p.retry.includes('light|instagram'), 'the network that refused is a Retry button');
  ok(!p.retry.includes('light|facebook'), 'the one that worked is not');
  ok(!p.retry.some(x => x.startsWith('word|')), 'a row where both worked offers no retry');
  ok(!p.retry.includes('reelB|instagram'), 'a container still transcoding is not offered a retry');
  ok(p.fix.includes('light|instagram') && p.why.includes('light|instagram'), "Fix it and What's wrong? sit on the half-failed row");
  ok(!p.send.includes('light'), 'Post now is NOT on the half-failed row (it would post twice)');
  ok(p.send.includes('reelA') && !p.send.includes('dusk'), 'the owed row leads with Post now; the one still to come does not');
  ok(p.mode === 'auto', 'the ladder shows the rung the server holds');
  ok(/41 days/.test(p.text) || /41/.test(p.text), 'the token clocks show days left');
  ok(/r\/islam/.test(p.text), 'the Reddit draft waits for a hand');
  ok(p.gridEmpty, 'the reels grid is not built until the fold opens');
  ok(await noSideScroll(pg), 'nothing scrolls sideways');
  await pg.screenshot({ path: 'tests/shots/console2-' + w + '-posts.png', fullPage: true });

  posted.length = 0;
  await pg.click('[data-retry="light|instagram"]');
  await pg.waitForTimeout(500);
  ok(posted.length === 1 && posted[0].body.action === 'retry-channel' && posted[0].body.slot === 'light' && posted[0].body.where === 'instagram',
     'Retry asks for retry-channel on that one network');
  ok(!posted.some(x => x.body.force), 'and never sends force');

  await pg.click('[data-why="light|instagram"]');
  await pg.waitForTimeout(600);
  const why = await pg.evaluate(() => ({ open: document.getElementById('sheet').classList.contains('on'), text: document.getElementById('sheet-in').innerText,
    retry: !!document.querySelector('#sheet-in [data-retry="light|instagram"]') }));
  ok(why.open, "What's wrong? opens a sheet");
  ok(/could not fetch or process/.test(why.text) && /9004/.test(why.text) && /reachable now/.test(why.text), 'that names the cause, the code, and the checks it ran');
  ok(why.retry, 'and offers Retry right there');
  await pg.click('#sheet-in #cl');
  await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => !document.getElementById('sheet').classList.contains('on') && document.body.style.overflow === ''), 'Close puts the sheet away and gives the page back');

  await pg.click('[data-prev="light"]');
  await pg.waitForTimeout(600);
  const pv = await pg.evaluate(() => ({ text: document.getElementById('sheet-in').innerText, img: !!document.querySelector('#sheet-in img') }));
  if (!(/human nature/.test(pv.text) && pv.img)) console.log('   preview text:', JSON.stringify(pv));
  ok(/human nature/.test(pv.text) && pv.img && /#noor/.test(pv.text), 'Preview shows the card, its title and the caption as Instagram would get it');
  await pg.evaluate(() => { document.getElementById('veil').click(); });
  await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => !document.getElementById('sheet').classList.contains('on')), 'tapping the veil closes it');

  posted.length = 0;
  await pg.click('[data-fix="light|instagram"]');
  await pg.waitForTimeout(700);
  ok(posted.some(x => x.body.action === 'retry-channel'), 'Fix it follows the diagnosis (fix: retry) and retries');

  await pg.click('#reels-fold summary');
  await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => document.getElementById('reel-grid').children.length === 2), 'opening the fold builds the reels grid');

  posted.length = 0;
  await pg.click('#seg [data-mode="approve"]');
  await pg.waitForSelector('#sheet.on #yes, #sheet:not([hidden]) #yes', { timeout: 5000 });
  ok(posted.length === 0, 'touching a rung asks first, posting nothing yet');
  await pg.click('#yes');
  await pg.waitForTimeout(500);
  ok(posted.some(x => x.url.startsWith('/api/settings') && x.body['social.mode'] === 'approve'), 'confirming posts {"social.mode":"approve"} to /api/settings');
  ok(await noSideScroll(pg), 'the sheet did not widen the page');

  console.log(label + ' · Readers');
  await pg.click('nav.bar [data-s="readers"]');
  await pg.waitForSelector('#s-readers .card', { timeout: 15000 });
  await pg.waitForTimeout(300);
  const r = await pg.evaluate(() => document.getElementById('s-readers').innerText);
  ok(/31/.test(r) && /85/.test(r), 'today and the 30 days are counted');
  ok(/filtered from/.test(r), 'the day the count became honest is marked');
  ok(/not counted/.test(r), 'and this browser is shown as not counted');
  ok(/88/.test(r) && /crawlers/.test(r), 'the turned-away total is explained');
  ok(/thank you for the library/.test(r), 'the inbox lists what arrived');
  ok(/A reply that waits/.test(r) && /flagged: link/.test(r), 'a held reply shows with why it was held');
  await pg.click('[data-held="0"]');
  await pg.waitForTimeout(400);
  const held = await pg.evaluate(() => ({ open: document.getElementById('sheet').classList.contains('on'), text: document.getElementById('sheet-in').innerText }));
  ok(held.open && /opens when the row is tapped/.test(held.text) && /flagged: link/.test(held.text), 'tapping a held reply opens the whole of it, with why it was held');
  posted.length = 0;
  await pg.click('#sheet-in [data-rm="e1|c9"]');
  await pg.waitForTimeout(400);
  ok(posted.some(x => x.url.startsWith('/api/journal') && x.body.action === 'comment-state' && x.body.state === 'reject'), 'Remove from the sheet posts comment-state reject');
  ok(await pg.evaluate(() => !document.getElementById('sheet').classList.contains('on')), 'and the sheet closes');
  await pg.waitForSelector('[data-rel="e1|c9"]', { timeout: 5000 });
  posted.length = 0;
  await pg.click('[data-rel="e1|c9"]');
  await pg.waitForTimeout(500);
  ok(posted.some(x => x.url.startsWith('/api/journal') && x.body.action === 'comment-state' && x.body.id === 'e1' && x.body.cid === 'c9' && x.body.state === 'approve'),
     'Release posts comment-state approve with the entry and the comment');
  ok(await noSideScroll(pg), 'nothing scrolls sideways');
  await pg.screenshot({ path: 'tests/shots/console2-' + w + '-readers.png', fullPage: true });

  console.log(label + ' · House');
  await pg.click('nav.bar [data-s="house"]');
  await pg.waitForSelector('#s-house .row', { timeout: 15000 });
  await pg.waitForTimeout(600);
  const hs = await pg.evaluate(() => document.getElementById('s-house').innerText);
  ok(/first in line: inkling/.test(hs), 'the Lantern row comes from the cheap probe-free read, naming the model first in line');
  await pg.click('#lantern-test');
  await pg.waitForTimeout(700);
  const lt = await pg.evaluate(() => document.getElementById('lantern-sub').textContent);
  if (!/Lit · inkling answered in/.test(lt)) console.log('   lantern sub:', lt);
  ok(/Lit · inkling answered in (0\.9|1\.0) s/.test(lt), 'Test it asks OpenRouter for one word and reports who answered and how fast');
  ok(/redis/i.test(hs) || /store/i.test(hs), 'the store is reported');
  ok(/\$90/.test(hs) && /30 USD/.test(hs), 'giving is shown');
  ok(/Amina/.test(hs) && /15 EUR/.test(hs) && /lit on the wall/.test(hs), 'a guardian is shown by the name they chose, with what they give');
  ok(await pg.evaluate(() => !!document.querySelector('#s-house a[href="/admin#journal"]')), 'the old console stays one tap away');
  ok(await noSideScroll(pg), 'nothing scrolls sideways');
  await pg.screenshot({ path: 'tests/shots/console2-' + w + '-house.png', fullPage: true });

  console.log(label + ' · the bar and the rail');
  const bar = await pg.evaluate(() => { const b = document.querySelector('nav.bar').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, vw: innerWidth, vh: innerHeight }; });
  if (w < 900) ok(bar.y + bar.h >= bar.vh - 2 && bar.w >= bar.vw - 2, 'on a phone the bar sits along the bottom');
  else ok(bar.x < 40 && bar.h > bar.w, 'at a desk the bar is a rail on the left');
  await pg.click('nav.bar [data-s="posts"]');
  await pg.waitForTimeout(200);
  const tap = await pg.evaluate(() => {
    const vis = b => b.getBoundingClientRect().height;
    return [...document.querySelectorAll('nav.bar button, .slot .b .btn')].every(b => vis(b) >= 32)
      && [...document.querySelectorAll('.slot .b button.chan')].every(b => vis(b) >= 28);
  });
  ok(tap, 'every control on the Posts surface is tall enough for a thumb');
  ok(errors.length === 0, 'no script threw: ' + (errors[0] || 'clean'));
  await pg.close();
}

console.log('\nthe locked gate');
{
  const posted = [], errors = [];
  const pg = await br.newPage({ viewport: { width: 390, height: 844 } });
  pg.on('pageerror', e => errors.push(String(e)));
  await pg.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/admin-auth')) { posted.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 401, contentType: 'application/json', body: '{"ok":false}' }); }
    if (u.includes('/api/')) return r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"locked"}' });
    if (u.startsWith(BASE)) return r.continue();
    if (u.includes('fonts.g')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.abort();
  });
  await pg.goto(BASE + '/admin2.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(600);
  ok(await pg.evaluate(() => !document.getElementById('gate').hidden && getComputedStyle(document.getElementById('app')).display === 'none'), 'a locked house shows the gate, not the rooms');
  await pg.fill('#pw', 'wrong');
  await pg.click('#enter');
  await pg.waitForTimeout(400);
  ok(posted.length === 1 && posted[0].password === 'wrong', 'the key goes to /api/admin-auth as a POST');
  ok(await pg.evaluate(() => /not the key/.test(document.getElementById('err').textContent)), 'a wrong key is said plainly');
  ok(await pg.evaluate(() => !document.getElementById('enter').disabled), 'and the button is usable again');
  ok(errors.length === 0, 'no script threw');
  await pg.close();
}


console.log('\nthe day after a card went through the old path');
{
  const posted = [], errors = [];
  const pg = await open_(390, 844, posted, errors, { legacy: true });
  const t = await pg.evaluate(() => document.getElementById('s-today').innerText);
  ok(!/light is owed/.test(t), 'a card sent through the old day path is not called owed');
  await pg.click('nav.bar [data-s="posts"]');
  await pg.waitForSelector('#s-posts .slot', { timeout: 15000 });
  const send = await pg.evaluate(() => [...document.querySelectorAll('[data-send]')].map(b => b.getAttribute('data-send')));
  ok(!send.includes('light'), 'and Post now is not offered for it, so it cannot go out twice');
  ok(errors.length === 0, 'no script threw');
  await pg.close();
}

console.log('\nwhen the key expires under an open console');
{
  const posted = [], errors = [];
  const pg = await open_(390, 844, posted, errors);
  await pg.evaluate(() => { window.__LOCK = true; });
  await pg.route('**/api/social?action=today', r => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"locked"}' }));
  await pg.click('#refresh');
  await pg.waitForTimeout(700);
  ok(await pg.evaluate(() => !document.getElementById('gate').hidden && getComputedStyle(document.getElementById('app')).display === 'none'), 'a 401 brings the gate back instead of printing guesses as facts');
  ok(await pg.evaluate(() => /expired/.test(document.getElementById('err').textContent)), 'and says why');
  const left = errors.filter(e => !/^401 /.test(e) && !/status of 401/.test(e)); if (left.length) console.log('   errors:', left);
  ok(left.length === 0, 'no script threw');
  await pg.close();
}

console.log('\nwhen the network is gone mid-action');
{
  const posted = [], errors = [];
  const pg = await open_(390, 844, posted, errors);
  await pg.click('nav.bar [data-s="posts"]');
  await pg.waitForSelector('[data-send="reelA"]', { timeout: 15000 });
  await pg.route('**/api/social', r => r.abort('connectionfailed'));
  await pg.click('[data-send="reelA"]');
  await pg.waitForTimeout(700);
  const st = await pg.evaluate(() => { const b = document.querySelector('[data-send="reelA"]'); return { disabled: b.disabled, text: b.textContent, toast: document.getElementById('toast').textContent }; });
  ok(!st.disabled && st.text === 'Post now', 'the button comes back instead of staying on Sending… forever');
  ok(/Could not reach the house/.test(st.toast), 'and the owner is told');
  ok(!errors.some(e => /Error|rejection/i.test(e) && !/ERR_CONNECTION/.test(e)), 'no unhandled rejection: ' + (errors.find(e => /Error/.test(e)) || 'clean'));
  await pg.close();
}

console.log('\nwhile a send is in flight');
{
  const posted = [], errors = [];
  const pg = await open_(390, 844, posted, errors);
  await pg.click('nav.bar [data-s="posts"]');
  await pg.waitForSelector('[data-send="reelA"]', { timeout: 15000 });
  let release, sends = 0; const gate = new Promise(res => { release = res; });
  await pg.route('**/api/social', async r => { if (r.request().method() === 'POST') { if (/send-slot/.test(r.request().postData() || '')) sends++; await gate; return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"state":"sent"}' }); } return r.continue(); });
  await pg.click('[data-send="reelA"]');
  await pg.waitForTimeout(300);
  await pg.evaluate(() => window.NOOR_CONSOLE.show('posts', true));
  await pg.waitForTimeout(500);
  const mid = await pg.evaluate(() => ({ send: [...document.querySelectorAll('[data-send]')].map(b => b.getAttribute('data-send')), sending: [...document.querySelectorAll('#slot-reelA button')].some(b => b.disabled && /Sending/.test(b.textContent)) }));
  ok(!mid.send.includes('reelA') && mid.sending, 'a redraw during the send shows Sending… and offers no second Post now');
  ok(sends === 1, 'exactly one send-slot has been asked for');
  release();
  await pg.waitForTimeout(600);
  ok(errors.length === 0, 'no script threw');
  await pg.close();
}

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
