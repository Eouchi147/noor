/* NOOR · Today's reels, driven the way a thumb drives it.
   ------------------------------------------------------------------
   The Reels room of admin2.html: the day's five reel slots as cards, each
   with its cover, its hook, its caption behind a fold with Copy, and one
   big Share. Every endpoint is fed a day that could happen, /api/reel is
   fed a small file, and the phone's share sheet is stood in for. Held:

     the room is the first button in the bar and draws five cards;
     Copy puts the caption on the clipboard;
     Share fetches /api/reel?id=, hands the sheet a File named <id>.mp4 of
       type video/mp4 with the caption as text, and then tells the house
       (action=shared) with the date and the slot;
     a sheet that refuses for the gesture having passed turns the button
       into "Share now" and the next tap shares the file already in hand;
     a cancelled sheet notes nothing;
     with no share sheet (a desk) the file is saved and the caption copied;
     nothing scrolls sideways, no script throws, every button is a thumb's size.

   Run:  python3 /tmp/vercelish.py . 8231 &   node tests/console-reels.mjs
*/
import { chromium } from 'playwright';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8231';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const br = await chromium.launch();

const REL = 'https://github.com/Eouchi147/noor/releases/download/reels-verse/';
const reel = (id, kind, hook, caption) => ({ id, kind, hook, caption, cover: BASE + '/reels/' + id + '-cover.jpg', video: REL + id + '.mp4', secs: 14 });
const TODAY = { ok: true, date: '2026-09-10', nowHour: 15, plan: { hijri: { d: 27, name: 'Rabi al-Awwal', y: 1448 }, verified: true },
  slots: [
    { id: 'dawn', at: 5, state: 'sent', title: '27 Rabi al-Awwal', results: { facebook: { ok: true, storyOnly: true, story: { ok: true } }, instagram: { ok: true, storyOnly: true, story: { ok: true } } } },
    { id: 'reelA', at: 8, state: 'sent', title: 'Al-Sharh · 94:5-6', results: { facebook: { ok: true }, instagram: { ok: true }, youtube: { ok: true, id: 'y1' } },
      reel: reel('verse-94-5-6', 'verse', 'Al-Sharh · 94:5-6', 'Al-Sharh · 94:5-6\n\nFor indeed, with hardship will be ease.\n\n#OneVerse #Quran') },
    { id: 'reelC', at: 11, state: 'sent', title: 'Sabr', results: { facebook: { ok: true }, instagram: { ok: true }, phone: { ok: true, at: new Date(Date.now() - 600000).toISOString(), hand: true } },
      reel: reel('word-12', 'word', 'Sabr', 'Patience, held.') },
    { id: 'light', at: 12, state: 'sent', title: 'A card', results: {} },
    { id: 'reelD', at: 14, state: 'partial', title: 'Ar-Rahman', results: { facebook: { ok: true }, instagram: { ok: false, error: 'no', code: 9004 } }, reel: reel('name-1', 'name', 'Ar-Rahman', 'The Most Merciful.') },
    { id: 'reelB', at: 17, state: 'waiting', title: '', reel: reel('know-3', 'know', 'A little cloud in his star book', 'Al-Sufi saw Andromeda.') },
    { id: 'reelE', at: 21, state: 'waiting', title: '', reel: reel('dua-2', 'dua', 'Rabbana atina', "A du'a of the Path.") }
  ] };
const FILE = Buffer.alloc(120000, 3);

async function open_(w, h, posted, errors, fetched, opts = {}) {
  const pg = await br.newPage({ viewport: { width: w, height: h }, permissions: ['clipboard-read', 'clipboard-write'] });
  pg.on('pageerror', e => errors.push(String(e)));
  pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const J = (b, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(b) });
  /* the share sheet, stood in for: it remembers what it was handed and
     answers as the test says */
  await pg.addInitScript(opts => {
    window.__shares = []; window.__saved = [];
    if (opts.sheet !== 'none') {
      navigator.canShare = d => !!(d && d.files && d.files.length);
      navigator.share = d => {
        window.__shares.push({ n: d.files.length, name: d.files[0].name, type: d.files[0].type, size: d.files[0].size, text: d.text, title: d.title });
        const mode = window.__sheet || opts.sheet;
        if (mode === 'refuse-once') { window.__sheet = 'ok'; const e = new Error('no gesture'); e.name = 'NotAllowedError'; return Promise.reject(e); }
        if (mode === 'cancel') { const e = new Error('cancelled'); e.name = 'AbortError'; return Promise.reject(e); }
        return Promise.resolve();
      };
    } else { delete navigator.share; delete navigator.canShare; }
    /* a download is a click on an <a download>; it is caught rather than performed */
    document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[download]'); if (a) { window.__saved.push(a.download); e.preventDefault(); } }, true);
  }, { sheet: opts.sheet || 'ok' });
  await pg.route('**/*', r => {
    const q = r.request(), u = q.url();
    if (q.method() === 'POST' && u.includes('/api/')) {
      const b = JSON.parse(q.postData() || '{}'); posted.push({ url: u.replace(BASE, ''), body: b });
      if (u.includes('/api/social') && b.action === 'shared') return r.fulfill(J({ ok: true, date: b.date, slot: b.slot, where: b.where, at: new Date().toISOString() }));
      return r.fulfill(J({ ok: true }));
    }
    if (u.includes('/api/reel?')) { fetched.push(u.replace(BASE, '')); return r.fulfill({ status: 200, contentType: 'video/mp4', headers: { 'content-length': String(FILE.length), 'accept-ranges': 'bytes', 'content-disposition': 'inline; filename="x.mp4"' }, body: FILE }); }
    if (u.includes('/api/admin-data')) return r.fulfill(J({ store: true, lanternConfigured: false, gifts: {} }));
    if (u.includes('/api/social')) return r.fulfill(J(TODAY));
    if (u.includes('/api/house')) return r.fulfill(J({ ok: true, findings: [], paragraph: '' }));
    if (u.includes('/api/visitors')) return r.fulfill(J({ days: [] }));
    if (u.includes('/api/inbox')) return r.fulfill(J({ ok: true, counts: {}, items: [] }));
    if (/\/reels\/.*-cover\.jpg$/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') });
    if (u.includes('/api/')) return r.fulfill(J({ ok: true }));
    if (u.startsWith(BASE)) return r.continue();
    if (u.includes('fonts.g')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.abort();
  });
  await pg.goto(BASE + '/admin2.html#reels', { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#app.on', { timeout: 15000 });
  await pg.waitForSelector('#s-reels .rl .share', { timeout: 15000 });
  await pg.waitForTimeout(300);
  return pg;
}

for (const [label, w, h] of [['phone 390', 390, 844], ['desk 1280', 1280, 900]]) {
  const posted = [], errors = [], fetched = [];
  const pg = await open_(w, h, posted, errors, fetched);
  console.log('\n' + label + ' · the room');
  ok(await pg.evaluate(() => document.querySelector('nav.bar button').dataset.s === 'reels'), 'Reels is the first button in the bar');
  ok(await pg.evaluate(() => document.getElementById('title').textContent) === "Today's reels", 'and the room is titled Today\'s reels');
  ok(await pg.evaluate(() => (document.querySelector('.surf.on') || {}).id) === 's-reels', 'the hash opens it');
  const cards = await pg.evaluate(() => [...document.querySelectorAll('#s-reels .rl')].map(c => ({ slot: c.dataset.slot, hook: c.querySelector('.tx b').textContent, img: !!c.querySelector('.cv img'), share: c.querySelector('.share').textContent, hint: c.querySelector('.hint').textContent, hand: (c.querySelector('.hand') || {}).textContent || '' })));
  ok(cards.length === 5 && cards.map(c => c.slot).join() === 'reelA,reelC,reelD,reelB,reelE', 'five cards, the reel slots in clock order: ' + cards.map(c => c.slot).join(' '));
  ok(cards.every(c => c.img && c.hook && c.share === 'Share'), 'each with its cover, its hook and a Share button');
  ok(cards[0].hook === 'Al-Sharh · 94:5-6', 'the hook is the reel\'s own: ' + cards[0].hook);
  ok(cards.every(c => /TikTok, WhatsApp or X/.test(c.hint) && /share sheet/.test(c.hint)), 'the hint says to pick the app in the share sheet');
  ok(/shared by hand/.test(cards[1].hand), 'a reel the owner already shared says so: ' + cards[1].hand);
  ok(await pg.evaluate(() => /half sent/.test(document.querySelector('#reel-reelD .pill').textContent)), 'the slot\'s state is on the card');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#s-reels .rl details')].every(d => !d.open)), 'the captions are folded');
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'nothing scrolls sideways');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#s-reels .share, #s-reels [data-copy], nav.bar button')].every(b => b.getBoundingClientRect().height >= 32)), 'every button is a thumb\'s size');
  await pg.screenshot({ path: 'tests/shots/console-reels-' + w + '.png', fullPage: true });

  console.log(label + ' · Copy');
  await pg.click('#reel-reelA [data-copy]');
  await pg.waitForTimeout(200);
  const clip = await pg.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok(/hardship will be ease/.test(clip), 'the caption is on the clipboard');
  ok(await pg.evaluate(() => !document.querySelector('#reel-reelA details').open), 'and Copy did not unfold the caption');

  console.log(label + ' · Share');
  await pg.click('#reel-reelA .share');
  await pg.waitForFunction(() => window.__shares.length === 1 || window.__saved.length === 1, null, { timeout: 10000 });
  await pg.waitForTimeout(400);
  const sh = await pg.evaluate(() => window.__shares[0] || null);
  ok(fetched.length === 1 && fetched[0] === '/api/reel?id=verse-94-5-6', 'the file is fetched from the same-origin door by id: ' + fetched.join());
  ok(sh && sh.n === 1 && sh.name === 'verse-94-5-6.mp4' && sh.type === 'video/mp4' && sh.size === 120000, 'the sheet is handed one File, <id>.mp4, video/mp4, whole: ' + JSON.stringify(sh));
  ok(sh && /hardship will be ease/.test(sh.text), 'with the caption as its text');
  const noted = posted.find(p => p.url.startsWith('/api/social') && p.body.action === 'shared');
  ok(noted && noted.body.date === '2026-09-10' && noted.body.slot === 'reelA' && noted.body.where === 'phone', 'and the house is told: ' + JSON.stringify(noted && noted.body));
  ok(await pg.evaluate(() => document.querySelector('#reel-reelA .share').textContent === 'Share now'), 'the file stays in hand: the button reads Share now');
  await pg.click('#reel-reelA .share');
  await pg.waitForFunction(() => window.__shares.length === 2, null, { timeout: 5000 });
  ok(fetched.length === 1, 'a second share does not fetch the file again');
  ok(errors.length === 0, 'no script error, no failed request' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await pg.close();
}

console.log('\nphone · a sheet that refuses for the gesture having passed');
{
  const posted = [], errors = [], fetched = [];
  const pg = await open_(390, 844, posted, errors, fetched, { sheet: 'refuse-once' });
  await pg.click('#reel-reelC .share');
  await pg.waitForFunction(() => window.__shares.length === 1, null, { timeout: 10000 });
  await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => document.querySelector('#reel-reelC .share').textContent === 'Share now' && !document.querySelector('#reel-reelC .share').disabled), 'the button turns into Share now and is live');
  ok(!posted.some(p => p.body.action === 'shared'), 'nothing is noted yet');
  await pg.click('#reel-reelC .share');
  await pg.waitForFunction(() => window.__shares.length === 2, null, { timeout: 5000 });
  await pg.waitForTimeout(300);
  ok(fetched.length === 1, 'the second tap shares the file already in hand');
  ok(posted.some(p => p.body.action === 'shared' && p.body.slot === 'reelC'), 'and the house is told then');
  ok(errors.length === 0, 'no script error' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await pg.close();
}

console.log('\nphone · a cancelled sheet');
{
  const posted = [], errors = [], fetched = [];
  const pg = await open_(390, 844, posted, errors, fetched, { sheet: 'cancel' });
  await pg.click('#reel-reelD .share');
  await pg.waitForFunction(() => window.__shares.length === 1, null, { timeout: 10000 });
  await pg.waitForTimeout(300);
  ok(!posted.some(p => p.body.action === 'shared'), 'nothing is noted');
  ok(await pg.evaluate(() => !document.querySelector('#reel-reelD .share').disabled), 'and the button comes back');
  await pg.close();
}

console.log('\ndesk · no share sheet at all');
{
  const posted = [], errors = [], fetched = [];
  const pg = await open_(1280, 900, posted, errors, fetched, { sheet: 'none' });
  await pg.click('#reel-reelE .share');
  await pg.waitForFunction(() => window.__saved.length === 1, null, { timeout: 10000 });
  await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => window.__saved[0]) === 'dua-2.mp4', 'the file is saved as <id>.mp4');
  const clip = await pg.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok(/du'a of the Path/.test(clip), 'and the caption is on the clipboard');
  ok(!posted.some(p => p.body.action === 'shared'), 'a download is not a share, so nothing is noted');
  ok(errors.length === 0, 'no script error' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await pg.close();
}

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
