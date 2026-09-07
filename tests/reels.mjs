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
  ok(S.REEL_SLOTS.join() === 'reelA,reelC,reelD,reelB,reelE', 'REEL_SLOTS names the five');
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
  ok(Array.isArray(p.only) && p.only.join() === 'facebook,instagram,youtube,pinterest',
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

/* ------------------------------------------------------------- the seam
   composeSlot is what the console's Preview and Post now both call. It fetches
   the manifest through slotExtras and then hands a context to buildSlot, and
   for a while it built that context without the reel in it -- so both halves
   passed their own tests and every reel slot still came out empty. This tests
   the join, end to end, with only the network stubbed. */
console.log('\nfrom the manifest to a finished post');
{
  const man = { n: 2, cards: [
    { id: 'al-sufi-andromeda-964', slot: 'morning', hook: 'A little cloud in his star book was another galaxy', caption: 'CAPTION A', cover: true },
    { id: 'smile-counts-as-charity', slot: 'evening', hook: 'Smiling in the face of a brother counts as charity', caption: 'CAPTION B', cover: true }
  ] };
  const real2 = globalThis.fetch;
  globalThis.fetch = async u => String(u).endsWith('/reels/index.json')
    ? { ok: true, json: async () => man } : { ok: false, json: async () => ({}) };

  const p = await SOC.composeSlot('noorcodex.com', '2026-09-04', 'reelA', { plan: { hijri: null, day: null, leads: [] } });
  ok(!!p, 'a reel slot composes once the manifest is on the site');
  ok(p && /^https:\/\/noorcodex\.com\/reels\/.+\.mp4$/.test(p.video || ''), 'it carries a video url');
  ok(p && /-cover\.jpg$/.test(p.image || ''), 'and its cover, not the day card');
  ok(p && /^CAPTION [AB]$/.test(p.caption || ''), 'and the caption written beside the video');
  ok(p && p.only.join() === 'facebook,instagram,youtube,pinterest', 'and it is aimed only where a reel can be shown');

  const ev = await SOC.composeSlot('noorcodex.com', '2026-09-04', 'reelB', { plan: { hijri: null, day: null, leads: [] } });
  ok(ev && ev.key === 'smile-counts-as-charity', 'the evening slot draws from the evening half');

  globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });
  const none = await SOC.composeSlot('noorcodex.com', '2026-09-04', 'reelA', { plan: { hijri: null, day: null, leads: [] } });
  ok(none === null, 'and with no manifest it composes to nothing rather than a broken post');
  globalThis.fetch = real2;
}

/* --------------------------------------------------- the order of the day */
console.log('\nwhich slot a run picks');
{
  const plan = ['dawn', 'reelA', 'light', 'word', 'reelB', 'dusk'];
  const at = h => new Date('2026-09-03T' + String(h).padStart(2, '0') + ':01:00Z');

  const capped = S.dueNow(plan, at(17), ['dawn', 'word']);
  ok(capped.length === 1 && capped[0].id === 'reelB',
     'capped, it is still the most recent owed slot');

  const all = S.dueNow(plan, at(17), ['dawn', 'word'], { all: true });
  ok(all.map(s => s.id).join() === 'reelB,light,reelA',
     'all, it is every owed slot, most recent first');
  ok(all[all.length - 1].id === 'reelA', 'the stalest is last, never first');

  const settled = S.dueNow(plan, at(17), ['dawn', 'word', 'reelA', 'reelB'], { all: true });
  ok(settled.map(s => s.id).join() === 'light',
     'a slot recorded as settled drops out and stops blocking the one behind it');

  ok(S.dueNow(plan, at(3), [], { all: true }).length === 0,
     'before the first slot nothing is owed, however you ask');

  /* the shape of the bug this replaced: the day's card sat owed from noon
     because every later hour put a fresher slot in front of it */
  const noon = S.dueNow(plan, at(12), ['dawn'], { all: true });
  ok(noon.map(s => s.id).join() === 'light,reelA',
     'at noon the card is reachable, with the empty reel slot behind it');
}

/* -------------------------------------------------- taken but not finished
   Instagram accepts a reel and then transcodes it, and refuses to publish
   until it has finished. That state is neither a success nor a failure, and
   the two send paths used to describe it differently: the cron called it
   pending, the Post button called it sent. A slot marked sent is never looked
   at again, so a container that needed one more minute was stranded and the
   reel never appeared, although Instagram had it the whole time. */
console.log('\ntaken, not yet finished');
{
  const SLOTS_KV = new Map();
  const kvStub = () => {
    globalThis.fetch = async (url, opt) => {
      url = String(url);
      if (url.startsWith('https://kv.test')) {
        const cmds = JSON.parse(opt.body);
        return { ok: true, json: async () => cmds.map(c => {
          const [v, k, val] = c;
          if (v === 'GET') return { result: SLOTS_KV.has(k) ? SLOTS_KV.get(k) : null };
          if (v === 'SET') { SLOTS_KV.set(k, val); return { result: 'OK' }; }
          return { result: null };
        }) };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    };
  };

  ok(SOC.slotState({ facebook: { ok: true }, instagram: { ok: true } }) === 'sent',
     'both landed: sent');
  ok(SOC.slotState({ facebook: { ok: true }, instagram: { ok: false, pending: 'C' } }) === 'pending',
     'one landed and one is still processing: pending, not sent');
  ok(SOC.slotState({ facebook: { ok: false }, instagram: { ok: false } }) === 'failed',
     'neither landed: failed');
  ok(SOC.slotState({ facebook: { ok: true }, reddit: { ok: false } }) === 'sent',
     'a Reddit draft never decides the state');

  /* the record that was actually stranded on 3 September: state sent, with a
     container sitting unpublished inside the results */
  process.env.KV_REST_API_URL = 'https://kv.test';
  process.env.KV_REST_API_TOKEN = 't';
  const key = 'nsoc:slot:2026-09-03#reelA';
  SLOTS_KV.set(key, JSON.stringify({ at: 'x', slot: 'reelA', state: 'sent',
    results: { facebook: { ok: true, id: 'F' }, instagram: { ok: false, pending: 'CONT' } } }));

  let phase = 'ready';
  kvStub();
  const kvOnly = globalThis.fetch;
  globalThis.fetch = async (url, opt) => {
    const u = String(url);
    if (u.startsWith('https://kv.test')) return kvOnly(url, opt);
    if (u.includes('media_publish')) return { ok: true, json: async () => ({ id: 'IGPOST' }), text: async () => '' };
    if (u.includes('CONT')) return { ok: true, json: async () => ({ status_code: phase === 'ready' ? 'FINISHED' : 'IN_PROGRESS' }), text: async () => '' };
    return { ok: true, json: async () => ({}), text: async () => '' };
  };

  const ran = await SOC.finishPendingReels('2026-09-03', { ran: [] });
  const done = ran.find(x => x.slot === 'reelA' && x.finished);
  ok(!!done && done.ok, 'the finisher publishes a container stranded inside a sent record');
  const after = JSON.parse(SLOTS_KV.get(key));
  ok(after.results.instagram.ok === true && after.results.instagram.id === 'IGPOST',
     'and writes Instagram\'s id back into the record');
  ok(after.state === 'sent', 'and the slot settles as sent, with both networks in');

  const again = await SOC.finishPendingReels('2026-09-03', { ran: [] });
  ok(again.length === 0, 'running it twice publishes nothing twice');

  globalThis.fetch = realFetch;
}

globalThis.fetch = realFetch;
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
