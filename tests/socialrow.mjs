/* NOOR · the social row, driven the way a thumb drives it.
   ------------------------------------------------------------------
   The server side of a half-failed slot is held in tests/retry.mjs. This holds
   the half a person actually touches: that a network which refused is offered
   as a button and one that worked is not, that pressing it asks the server to
   send ONE network rather than the slot, and that Post now -- which would post
   it twice -- is not what a half-failed row leads with.

   Run:  python3 /tmp/vercelish.py . 8231 &   node tests/socialrow.mjs
*/
import { chromium } from 'playwright';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8231';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const br = await chromium.launch();

/* today, as it actually looked: the light took on Facebook and refused on
   Instagram, and the reel behind it is still transcoding */
const TODAY = {
  ok: true, date: '2026-09-04', nowHour: 13,
  slots: [
    { id: 'light', at: 12, state: 'sent', title: 'The word for human nature also means breaking a fast',
      results: { facebook: { ok: true, id: 'F' },
                 instagram: { ok: false, error: 'Meta could not fetch the image', code: 9004 } } },
    { id: 'word', at: 16, state: 'sent', title: 'Qalqalah',
      results: { facebook: { ok: true }, instagram: { ok: true } } },
    { id: 'reelB', at: 17, state: 'pending', title: 'A reel',
      results: { facebook: { ok: true }, instagram: { ok: false, pending: 'CONT' } } },
    { id: 'dusk', at: 20, state: 'due', title: 'A chapter' }
  ]
};
const DIAG = {
  ok: true, where: 'instagram', slot: 'light', said: 'Meta could not fetch the image', code: 9004,
  cause: 'Instagram could not fetch or process the card image', fix: 'retry', canRetry: true,
  checks: [{ name: 'the card image', ok: true, detail: 'image/png, 41 KB, reachable now' },
           { name: 'the caption', ok: true, detail: '840 of 2200 characters' },
           { name: 'the token', ok: true, detail: '48 days left of 60' }],
  steps: ['The card is rendered on demand, so a cold start can outrun Meta.', 'Press Retry.']
};

const posted = [];
async function open_() {
  const pg = await br.newPage({ viewport: { width: 1200, height: 900 } });
  await pg.route('**/*', r => {
    const q = r.request(), u = q.url();
    if (u.includes('/api/social')) {
      if (q.method() === 'POST') { posted.push(JSON.parse(q.postData() || '{}')); 
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ ok: true, where: 'instagram', state: 'sent', results: {} }) }); }
      if (u.includes('action=diagnose'))
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DIAG) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TODAY) });
    }
    if (u.includes('/reels/index.json')) return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ n: 2, cards: [{ id: 'a', slot: 'morning', hook: 'A', caption: 'x' }, { id: 'b', slot: 'evening', hook: 'B', caption: 'y' }] }) });
    if (u.includes('/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    if (u.startsWith(BASE)) return r.continue();
    return r.abort();
  });
  await pg.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded' });
  await pg.evaluate(() => { document.getElementById('gate').hidden = true;
    document.getElementById('dash').hidden = false; });
  /* the panel is drawn by the tab's own loader, so open the tab the way a
     thumb does rather than reaching past it into a closure */
  await pg.click('[data-pane="social"]');
  await pg.waitForSelector('#so-sched [data-slotprev]', { timeout: 15000 });
  await pg.waitForTimeout(400);
  return pg;
}

const pg = await open_();

console.log('\nwhat a half-failed row offers');
{
  const s = await pg.evaluate(() => {
    const html = document.body.innerHTML;
    const btn = [...document.querySelectorAll('[data-retry]')].map(b => b.getAttribute('data-retry'));
    return { btn,
      fix: [...document.querySelectorAll('[data-fixch]')].map(b => b.getAttribute('data-fixch')),
      why: [...document.querySelectorAll('[data-whych]')].map(b => b.getAttribute('data-whych')),
      send: [...document.querySelectorAll('[data-slotsend]')].map(b => b.getAttribute('data-slotsend')),
      hasHtml: html.length > 0 };
  });
  ok(s.btn.includes('light|instagram'), 'the network that refused is a button');
  ok(!s.btn.includes('light|facebook'), 'the network that worked is not');
  ok(!s.btn.some(x => x.startsWith('word|')), 'a row where both worked offers no retry at all');
  ok(!s.btn.some(x => x === 'reelB|instagram'), 'a container still transcoding is not offered as a retry');
  ok(s.fix.includes('light|instagram'), 'Fix it is offered on the half-failed row');
  ok(s.why.includes('light|instagram'), "so is What's wrong?");
  ok(!s.send.includes('light'), 'Post now is NOT offered on it, because it would post twice');
  ok(s.send.includes('dusk'), 'and a genuinely owed row still leads with Post now');
}

console.log('\nwhat pressing it asks for');
{
  posted.length = 0;
  await pg.click('[data-retry="light|instagram"]');
  await pg.waitForTimeout(500);
  ok(posted.length === 1, 'one request, not several');
  ok(posted[0] && posted[0].action === 'retry-channel', 'it asks for retry-channel, not send-slot');
  ok(posted[0] && posted[0].slot === 'light' && posted[0].where === 'instagram',
     'naming the slot and the one network');
  ok(!(posted[0] || {}).force, 'and it never sends force, which is what would double-post');
}

console.log('\nwhat it says when asked');
{
  await pg.click('[data-whych="light|instagram"]');
  await pg.waitForTimeout(600);
  const t = await pg.evaluate(() => {
    const b = document.getElementById('slotbox-light');
    return { shown: b && !b.hidden, text: (b && b.innerText) || '' };
  });
  ok(t.shown, 'the panel opens on the row it belongs to');
  ok(/could not fetch or process the card image/i.test(t.text), 'it names the cause');
  ok(/Meta could not fetch the image/.test(t.text), "and quotes Meta's own words");
  ok(/9004/.test(t.text), 'with the code, so it can be searched');
  ok(/reachable now/.test(t.text), 'and reports the checks it actually ran');
}

console.log('\nFix it tries before it talks');
{
  posted.length = 0;
  await pg.click('[data-fixch="light|instagram"]');
  await pg.waitForTimeout(900);
  ok(posted.length === 1 && posted[0].action === 'retry-channel',
     'a fault it can clear itself is cleared, not narrated');
  ok(posted[0].where === 'instagram', 'against the one network that refused');
}

console.log('\na pending network is neither red nor green');
{
  const c = await pg.evaluate(() => {
    const row = [...document.querySelectorAll('#so-sched span')]
      .find(n => n.textContent.trim() === 'instagram' && n.style.color);
    const all = [...document.querySelectorAll('#so-sched [style*="color"]')]
      .filter(n => n.textContent.trim() === 'instagram').map(n => n.style.color);
    return all;
  });
  ok(c.some(x => /233, 200, 106|#E9C86A/i.test(x)),
     'the reel Instagram is still transcoding shows as waiting, not as a failure');
}

console.log('\nit reads on a phone');
{
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.waitForTimeout(400);
  const g = await pg.evaluate(() => {
    const b = document.querySelector('[data-retry="light|instagram"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { w: r.width, h: r.height, right: r.right, doc: document.documentElement.scrollWidth,
             vw: window.innerWidth };
  });
  ok(g && g.doc <= g.vw + 1, 'the page still does not scroll sideways');
  ok(g && g.right <= g.vw + 1, 'and the button is inside the screen');
  ok(g && g.h >= 16, 'it is big enough to hit');
}

console.log('\nthe reels fold out of the way');
{
  const f = await pg.evaluate(() => {
    const d = document.getElementById('so-reels-fold');
    return { exists: !!d, open: d && d.open, videos: document.querySelectorAll('#so-reels video').length,
             summary: d && d.querySelector('summary').textContent.trim() };
  });
  ok(f.exists && f.open === false, 'the reels start folded, so the day\'s post is one scroll away');
  ok(f.videos === 0, 'and no video player is built while they are folded');
  await pg.click('#so-reels-fold summary');
  await pg.waitForTimeout(500);
  const g = await pg.evaluate(() => ({ open: document.getElementById('so-reels-fold').open,
    videos: document.querySelectorAll('#so-reels video').length,
    remembered: localStorage.getItem('noor_reels_open') }));
  ok(g.open && g.videos > 0, 'opening it builds the players');
  ok(g.remembered === '1', 'and the browser remembers it was opened');
}

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
