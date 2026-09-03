/* NOOR · the reel slots and the two reel senders.
   ------------------------------------------------------------------
   Meta is stubbed. This repository has no credentials and never will, so what
   is held here is everything that can be held without them: that a slot points
   only at a video that exists, that the written caption is carried whole
   rather than rebuilt, that a reel is not offered to a channel that cannot
   show one, and that the awkward part of Instagram -- a container that is
   still transcoding when the function runs out of time -- is recorded as
   pending and finished later rather than reported as a failure.

   Run:  node tests/reels.mjs
*/
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

process.env.FB_PAGE_ID = '123'; process.env.FB_PAGE_TOKEN = 'tok';
process.env.IG_USER_ID = '456'; process.env.IG_TOKEN = 'igtok';
/* the real budget is half a minute of polling; the test does not need to wait it */
process.env.IG_POLL_EVERY_MS = '5'; process.env.IG_POLL_BUDGET_MS = '40';

const S = await import('../api/_schedule.js');
const CH = await import('../api/_channels.js');

/* ------------------------------------------------------------------ slots */
console.log('\nthe slots');
{
  const ids = S.SLOTS.map(s => s.id);
  ok(ids.includes('reelA') && ids.includes('reelB'), 'both reel slots exist');
  ok(S.SLOTS.find(s => s.id === 'reelA').at === 8, 'the morning reel is at 08:00 UTC');
  ok(S.SLOTS.find(s => s.id === 'reelB').at === 17, 'the evening reel is at 17:00 UTC');
  const hours = S.SLOTS.map(s => s.at);
  ok(hours.every((h, i) => i === 0 || h >= hours[i - 1]), 'the list stays in clock order');
  ok(new Set(hours).size === hours.length, 'no two slots share an hour');
  ok(S.REEL_SLOTS.join() === 'reelA,reelB', 'REEL_SLOTS names them');
  ok(S.reelHalf('reelA') === 'morning' && S.reelHalf('reelB') === 'evening',
     'each reel slot knows its half of the library');
  ok(S.reelHalf('dusk') === '', 'a slot that is not a reel says so');
}

/* ------------------------------------------------------------- buildSlot */
console.log('\nwhat a reel slot says');
const REEL = { id: 'al-sufi-andromeda-964', slot: 'morning',
  hook: 'A little cloud in his star book was another galaxy',
  caption: 'Al-Sufi drew each constellation twice.\n\nRead the whole thing free at noorcodex.com\n\n#Islam #NoorCodexOfLight',
  video: 'https://noorcodex.com/reels/al-sufi-andromeda-964.mp4',
  cover: 'https://noorcodex.com/reels/al-sufi-andromeda-964-cover.jpg' };
{
  const ctx = { date: '2026-09-04', link: 'https://noorcodex.com/?light=2026-09-04', reel: REEL };
  const p = S.buildSlot('reelA', ctx);
  ok(p && p.video === REEL.video, 'the post carries the video');
  ok(p.image === REEL.cover, 'and the cover');
  ok(p.caption === REEL.caption, 'and the written caption, whole');
  ok(p.title === REEL.hook, 'the hook is the title');
  ok(p.reel === true, 'it is marked as a reel');
  ok(Array.isArray(p.only) && p.only.join() === 'facebook,instagram',
     'it names the only channels that can show it');
  ok(S.buildSlot('reelA', { date: '2026-09-04', link: 'l' }) === null,
     'no reel for the day composes to nothing rather than a broken post');
  ok(S.buildSlot('reelA', { date: '2026-09-04', link: 'l', reel: { id: 'x', hook: 'h' } }) === null,
     'a card with no rendered video is never posted');
}

/* -------------------------------------------------------------- the pick */
console.log('\nchoosing the day\'s reel');
{
  const man = { cards: [] };
  for (let i = 0; i < 6; i++) man.cards.push({ id: 'm' + i, slot: 'morning', hook: 'h', caption: 'c' });
  for (let i = 0; i < 4; i++) man.cards.push({ id: 'e' + i, slot: 'evening', hook: 'h', caption: 'c' });
  const real = globalThis.fetch;
  globalThis.fetch = async u => String(u).endsWith('/reels/index.json')
    ? { ok: true, json: async () => man } : { ok: false };

  const seen = new Set(), days = [];
  for (let i = 0; i < 6; i++) {
    const d = '2026-09-0' + (i + 1);
    const x = await S.slotExtras('https://h', d, null, 'reelA');
    days.push(x.reel.id); seen.add(x.reel.id);
  }
  ok(seen.size === 6, 'six days walk all six morning cards before repeating');
  const again = await S.slotExtras('https://h', '2026-09-01', null, 'reelA');
  ok(again.reel.id === days[0], 'the same date always chooses the same card');
  const ev = await S.slotExtras('https://h', '2026-09-01', null, 'reelB');
  ok(ev.reel.slot === 'evening', 'the evening slot draws from the evening half');
  ok(ev.reel.video === 'https://h/reels/' + ev.reel.id + '.mp4', 'the video url is built from the id');
  ok(ev.reel.cover === 'https://h/reels/' + ev.reel.id + '-cover.jpg', 'and the cover beside it');

  globalThis.fetch = async () => { throw new Error('no manifest'); };
  const none = await S.slotExtras('https://h', '2026-09-01', null, 'reelA');
  ok(none.reel === null, 'an unreachable manifest composes to nothing, and does not throw');
  globalThis.fetch = real;
}

/* ------------------------------------------------------------- the shape */
console.log('\nthe caption');
{
  const p = S.buildSlot('reelA', { date: '2026-09-04', link: 'https://h/', reel: REEL });
  for (const ch of ['facebook', 'instagram']) {
    const sh = CH.shape(p, ch);
    ok(sh.text === REEL.caption, ch + ' carries the written caption verbatim');
    ok(sh.image === REEL.cover, ch + ' carries the cover as its image');
  }
  const other = CH.shape({ title: 'T', body: 'B', link: 'https://h/', image: null }, 'facebook');
  ok(other.text.includes('T') && other.text.includes('B'),
     'a post with no written caption still gets the house one');
}

/* ------------------------------------------------------------ the senders */
console.log('\nInstagram');
const SOC = await import('../api/social.js');
const POST = { video: REEL.video, image: REEL.cover, caption: REEL.caption };

function stub(steps) {
  const calls = [];
  globalThis.fetch = async (url, opt) => {
    url = String(url);
    calls.push({ url, body: opt && opt.body ? JSON.parse(opt.body) : null,
                 headers: (opt && opt.headers) || {} });
    const r = steps(url, calls.length);
    return { ok: r.ok !== false, status: r.status || 200,
             json: async () => r.j || {}, text: async () => JSON.stringify(r.j || {}) };
  };
  return calls;
}
const realFetch = globalThis.fetch;

{
  const calls = stub(url => {
    if (url.includes('/media_publish')) return { j: { id: 'POSTED' } };
    if (url.includes('/media')) return { j: { id: 'CONT' } };
    if (url.includes('CONT')) return { j: { status_code: 'FINISHED' } };
    if (url.includes('?fields=access_token')) return { j: { access_token: 'page' } };
    return { j: {} };
  });
  const r = await SOC.publishAll({}, POST, { fb: false, ig: true });
  const ig = r.find(x => x.where === 'instagram');
  ok(ig.ok && ig.id === 'POSTED', 'a reel that finishes transcoding is published');
  const create = calls.find(c => c.url.includes('/media') && c.body && c.body.media_type);
  ok(create && create.body.media_type === 'REELS', 'the container is created as a reel');
  ok(create.body.video_url === REEL.video, 'with the video url');
  ok(create.body.cover_url === REEL.cover, 'and the cover, so the grid is not frame zero');
  ok(create.body.caption === REEL.caption, 'and the written caption');
  ok(!calls.some(c => c.url.includes('access_token=')), 'no token is ever put in a url');
}
{
  stub(url => url.includes('CONT') && !url.includes('publish')
    ? { j: { status_code: 'IN_PROGRESS' } }
    : { j: { id: 'CONT' } });
  const rec = {};
  const r = await SOC.publishAll(rec, POST, { fb: false, ig: true });
  const ig = r.find(x => x.where === 'instagram');
  ok(!ig.ok && ig.pending === 'CONT', 'a container still transcoding comes back pending');
  ok(rec.igPending === 'CONT', 'and the record keeps the container id');
  ok(!rec.igId, 'nothing is recorded as posted');
}
{
  stub(url => url.includes('CONT') ? { j: { status_code: 'FINISHED' } } : { j: { id: 'POSTED2' } });
  const r = await SOC.finishInstagramReel('CONT');
  ok(r.ok && r.id === 'POSTED2', 'a pending container is published on a later run');
}
{
  stub(() => ({ j: { status_code: 'IN_PROGRESS' } }));
  const r = await SOC.finishInstagramReel('CONT');
  ok(!r.ok && r.pending === 'CONT', 'one that is still going stays pending');
}
{
  stub(() => ({ j: { status_code: 'ERROR', error: { message: 'bad video' } } }));
  const r = await SOC.finishInstagramReel('CONT');
  ok(!r.ok && !r.pending && /bad video/.test(r.error), "a refusal carries Meta's own words");
}

console.log('\nFacebook');
{
  const calls = stub(url => {
    if (url.includes('?fields=access_token')) return { j: { access_token: 'page' } };
    if (url.includes('rupload')) return { j: { success: true } };
    if (url.includes('/video_reels')) return { j: { video_id: 'VID', upload_url: 'https://rupload/x' } };
    return { j: {} };
  });
  const r = await SOC.publishAll({}, POST, { fb: true, ig: false });
  const fb = r.find(x => x.where === 'facebook');
  ok(fb.ok && fb.id === 'VID', 'a reel goes out in three phases');
  const up = calls.find(c => c.url.includes('rupload'));
  ok(up && up.headers.file_url === REEL.video, 'Facebook is told where to fetch the file');
  ok(up && /^OAuth /.test(up.headers.authorization), 'and is given the page token as a header');
  const fin = calls.filter(c => c.url.includes('/video_reels')).pop();
  ok(fin.body.upload_phase === 'finish' && fin.body.video_state === 'PUBLISHED',
     'the last phase publishes it');
  ok(fin.body.description === REEL.caption, 'with the written caption');
}
{
  stub(url => url.includes('?fields=access_token')
    ? { j: { access_token: 'page' } }
    : { ok: false, status: 400, j: { error: { message: 'no permission' } } });
  const r = await SOC.publishAll({}, POST, { fb: true, ig: false });
  ok(!r[0].ok && /no permission/.test(r[0].error), 'a refusal at the first phase is reported plainly');
}
{
  const r = await SOC.publishAll({}, { caption: 'c' }, { fb: true, ig: true });
  ok(r.every(x => !x.ok), 'a reel post with no video is refused rather than sent as a photo');
}

globalThis.fetch = realFetch;
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
