/* NOOR · the second surface.
   ------------------------------------------------------------------
   Every feed post goes out a second time as a story on Facebook and
   Instagram. This holds the four promises that make that safe:

     a story is only tried on a network whose feed post landed;
     a story that fails changes nothing about the slot's state;
     the dial switches the whole thing off;
     the calls made are exactly Meta's story calls, in Meta's order.

   Meta is stubbed. This repository has no credentials and never will.

   Run:  node tests/stories.mjs
*/
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

process.env.FB_PAGE_ID = '123'; process.env.FB_PAGE_TOKEN = 'tok';
process.env.IG_USER_ID = '456'; process.env.IG_TOKEN = 'igtok';
process.env.KV_REST_API_URL = 'https://kv.test';
process.env.KV_REST_API_TOKEN = 't';
process.env.IG_POLL_EVERY_MS = '5';

const SOC = await import('../api/social.js');

let calls = [];
let igStatus = 'FINISHED';
let fbStartOk = true, igContainerOk = true;

globalThis.fetch = async (url, opt) => {
  const u = String(url), body = opt && opt.body ? JSON.parse(opt.body) : {};
  calls.push({ u, body, headers: (opt && opt.headers) || {} });
  const J = j => ({ ok: true, status: 200, json: async () => j });
  const BAD = j => ({ ok: false, status: 400, json: async () => j });
  if (u.startsWith('https://kv.test')) return J([]);
  if (u.includes('/123?fields=access_token')) return J({ access_token: 'pagetok' });
  /* Instagram */
  if (u.includes('/456/media') && !u.includes('publish')) return igContainerOk ? J({ id: 'c1' }) : BAD({ error: { message: 'no', code: 100 } });
  if (u.includes('/c1?fields=status_code')) return J({ status_code: igStatus });
  if (u.includes('/456/media_publish')) return J({ id: 'ig-story-1' });
  /* Facebook */
  if (u.includes('/123/video_stories') && body.upload_phase === 'start') return fbStartOk ? J({ video_id: 'v1', upload_url: 'https://rupload.facebook.com/v1' }) : BAD({ error: { message: 'no' } });
  if (u.startsWith('https://rupload.facebook.com/')) return J({ success: true });
  if (u.includes('/123/video_stories') && body.upload_phase === 'finish') return J({ success: true, post_id: 'fb-story-1' });
  if (u.includes('/123/photos')) return J({ id: 'ph1' });
  if (u.includes('/123/photo_stories')) return J({ success: true, post_id: 'fb-photo-story-1' });
  return BAD({ error: { message: 'unexpected ' + u } });
};

const reel = { video: 'https://noorcodex.com/reels/x.mp4', image: 'https://noorcodex.com/reels/x-cover.jpg' };
const card = { image: 'https://noorcodex.com/api/card?d=2026-09-07' };
const D = { stories: true };
const seq = () => calls.map(c => c.u.replace(/^https:\/\/graph\.facebook\.com\/v21\.0/, '').replace(/^https:\/\/graph\.instagram\.com\/v21\.0/, '') + (c.body.upload_phase ? ':' + c.body.upload_phase : ''));

console.log('\na reel that landed on both networks');
{
  calls = [];
  const results = { facebook: { ok: true, id: 'f' }, instagram: { ok: true, id: 'i' }, youtube: { ok: true, id: 'y' } };
  await SOC.addStories(results, reel, D);
  ok(results.instagram.story && results.instagram.story.ok && results.instagram.story.id === 'ig-story-1', 'Instagram got a story and its id is kept');
  ok(results.facebook.story && results.facebook.story.ok && results.facebook.story.id === 'fb-story-1', 'Facebook got a story and its id is kept');
  ok(!results.youtube.story, 'YouTube has no story surface and is left alone');
  const ig = calls.filter(c => c.u.includes('/456/'));
  ok(ig[0] && ig[0].body.media_type === 'STORIES' && ig[0].body.video_url === reel.video, 'the Instagram container is a STORIES container with the video url');
  ok(calls.some(c => c.u.includes('status_code')), 'the video story is polled before it is published');
  ok(ig[ig.length - 1].u.includes('media_publish') && ig[ig.length - 1].body.creation_id === 'c1', 'the container is published last');
  const fb = seq().filter(s => s.includes('/123/') || s.startsWith('https://rupload'));
  ok(fb.join(' > ').includes('/123/video_stories:start > https://rupload.facebook.com/v1 > /123/video_stories:finish'), 'Facebook: start, upload, finish, in that order');
  const up = calls.find(c => c.u.startsWith('https://rupload'));
  ok(up && up.headers.file_url === reel.video, 'Facebook fetches the file itself from the reel url');
  ok(SOC.slotState(results) === 'sent', 'the slot is sent');
}

console.log('\na card (no video) on both networks');
{
  calls = [];
  const results = { facebook: { ok: true, id: 'f' }, instagram: { ok: true, id: 'i' } };
  await SOC.addStories(results, card, D);
  const ig = calls.find(c => c.u.includes('/456/media') && !c.u.includes('publish'));
  ok(ig && ig.body.image_url === card.image && !ig.body.video_url, 'the Instagram story is an image story');
  ok(!calls.some(c => c.u.includes('status_code')), 'an image story is not polled');
  const s = seq();
  ok(s.indexOf('/123/photos') > -1 && s.indexOf('/123/photo_stories') > s.indexOf('/123/photos'), 'Facebook: the photo first, then the story from it');
  const ph = calls.find(c => c.u.includes('/123/photos'));
  ok(ph && ph.body.published === false, 'the photo is not published to the feed a second time');
  ok(results.facebook.story.id === 'fb-photo-story-1' && results.instagram.story.id === 'ig-story-1', 'both story ids are kept');
}

console.log('\nonly where the feed post landed');
{
  calls = [];
  const results = { facebook: { ok: false, error: 'refused' }, instagram: { ok: true, id: 'i' } };
  await SOC.addStories(results, reel, D);
  ok(!results.facebook.story, 'no story is tried on the network that refused the post');
  ok(!calls.some(c => c.u.includes('/123/')), 'Facebook is not called at all');
  ok(results.instagram.story && results.instagram.story.ok, 'the other network still gets its story');
  ok(SOC.slotState(results) === 'partial', 'the slot is still partial, exactly as the feed left it');
}

console.log('\na story that fails');
{
  calls = []; igContainerOk = false; fbStartOk = false;
  const results = { facebook: { ok: true, id: 'f' }, instagram: { ok: true, id: 'i' } };
  const before = SOC.slotState(results);
  await SOC.addStories(results, reel, D);
  ok(results.instagram.story && results.instagram.story.ok === false && /no|http/.test(results.instagram.story.error), 'Instagram: the refusal is on the record');
  ok(results.facebook.story && results.facebook.story.ok === false, 'Facebook: the refusal is on the record');
  ok(results.facebook.ok === true && results.instagram.ok === true, 'the feed results are untouched');
  ok(SOC.slotState(results) === before && before === 'sent', 'the slot state does not move for a story');
  igContainerOk = true; fbStartOk = true;
}

console.log('\na story that cannot be processed');
{
  calls = []; igStatus = 'ERROR';
  const results = { instagram: { ok: true, id: 'i' } };
  await SOC.addStories(results, reel, D);
  ok(results.instagram.story.ok === false && /processed/.test(results.instagram.story.error), 'an ERROR status is reported, not published');
  ok(!calls.some(c => c.u.includes('media_publish')), 'nothing is published after an ERROR');
  igStatus = 'FINISHED';
}

console.log('\nthe dial');
{
  calls = [];
  const results = { facebook: { ok: true, id: 'f' }, instagram: { ok: true, id: 'i' } };
  await SOC.addStories(results, reel, { stories: false });
  ok(calls.length === 0 && !results.facebook.story && !results.instagram.story, 'with the dial off nothing is called and nothing is recorded');
  await SOC.addStories(results, reel, null);
  ok(calls.length === 0, 'with no dials at all nothing is called');
  const d = await SOC.dials().catch(() => null);
  ok(d && d.stories === true, 'the dial defaults to on');
}

console.log('\nnothing to show');
{
  calls = [];
  const results = { facebook: { ok: true, id: 'f' }, instagram: { ok: true, id: 'i' } };
  await SOC.addStories(results, { text: 'words only' }, D);
  ok(results.instagram.story.ok === false && results.facebook.story.ok === false, 'a post with neither image nor video is refused before any call');
  ok(!calls.some(c => c.u.includes('/456/') || c.u.includes('video_stories') || c.u.includes('/photos')), 'no Meta story call is made for it');
}

console.log('\na video story still processing is handed back, and finished later');
{
  calls = []; igStatus = 'IN_PROGRESS';
  const results = { instagram: { ok: true, id: 'i' } };
  await SOC.addStories(results, reel, D);
  ok(results.instagram.story.ok === false && results.instagram.story.pending === 'c1', 'the container is handed back as pending');
  ok(!calls.some(c => c.u.includes('media_publish')), 'nothing is published while it processes');
  ok(calls.filter(c => c.u.includes('status_code')).length === 1, 'the run spends one look on it, not twenty seconds');
  /* the hourly run finds it on the record and finishes it */
  process.env.KV_REST_API_URL = 'https://kv.test'; process.env.KV_REST_API_TOKEN = 't';
  const STORE = new Map();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opt) => {
    const u = String(url);
    if (u.startsWith('https://kv.test')) {
      const cmds = JSON.parse(opt.body);
      return { ok: true, json: async () => cmds.map(([v, k, val]) => v === 'GET' ? { result: STORE.has(k) ? STORE.get(k) : null } : (v === 'SET' ? (STORE.set(k, val), { result: 'OK' }) : { result: null })) };
    }
    return realFetch(url, opt);
  };
  const DATE = '2026-09-07';
  STORE.set('nsoc:slot:' + DATE + '#reelA', JSON.stringify({ at: 'x', slot: 'reelA', state: 'sent', title: 'v', results: { instagram: { ok: true, id: 'IG1', story: { ok: false, pending: 'c1' } }, facebook: { ok: true, id: 'F1' } } }));
  calls = []; igStatus = 'FINISHED';
  const ran = await SOC.finishPendingReels(DATE, { ran: [] });
  const rec = JSON.parse(STORE.get('nsoc:slot:' + DATE + '#reelA'));
  ok(rec.results.instagram.story && rec.results.instagram.story.ok && rec.results.instagram.story.id === 'ig-story-1', 'finishPendingReels publishes the story from the record');
  ok(rec.results.instagram.ok && rec.results.instagram.id === 'IG1' && rec.state === 'sent', 'the reel result and the slot state are untouched');
  ok(ran.some(r => r.where === 'instagram story' && r.ok), 'and says so in the run');
  globalThis.fetch = realFetch;
}

console.log('\nno time left');
{
  calls = [];
  const results = { facebook: { ok: true, id: 'f' }, instagram: { ok: true, id: 'i' } };
  const any = await SOC.addStories(results, reel, D, () => 2000);
  ok(any === true && calls.length === 0, 'with two seconds left nothing is called');
  ok(results.facebook.story.skipped && results.instagram.story.skipped, 'and each record says the story was skipped for time');
  ok(SOC.slotState(results) === 'sent', 'the slot is still sent');
  const results2 = { facebook: { ok: true, id: 'f' }, instagram: { ok: true, id: 'i' } };
  await SOC.addStories(results2, card, D, () => 30000);
  ok(results2.facebook.story.ok && results2.instagram.story.ok, 'with half a minute left both stories are made');
}

console.log('\nthrough sendSlot: the record first, then the stories');
{
  const STORE = new Map(); const order = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opt) => {
    const u = String(url);
    if (u.startsWith('https://kv.test')) {
      const cmds = JSON.parse(opt.body);
      return { ok: true, json: async () => cmds.map(([v, k, val]) => {
        if (v === 'GET') return { result: STORE.has(k) ? STORE.get(k) : null };
        if (v === 'SET') { if (k.includes('#word')) order.push('record'); STORE.set(k, val); return { result: 'OK' }; }
        return { result: null }; }) };
    }
    if (u.includes('/api/card')) return { ok: true, status: 200, headers: { get: h => h === 'content-type' ? 'image/png' : '40000' }, json: async () => ({}), text: async () => '' };
    if (u.includes('/photos') && !u.includes('photo_stories')) { const b = JSON.parse(opt.body || '{}'); order.push(b.published === false ? 'fb-story-photo' : 'fb-feed'); return { ok: true, json: async () => ({ id: 'FB1' }), text: async () => '' }; }
    if (u.includes('/photo_stories')) { order.push('fb-story'); return { ok: true, json: async () => ({ post_id: 'FBS' }), text: async () => '' }; }
    if (u.includes('/media_publish')) { order.push('ig-publish'); return { ok: true, json: async () => ({ id: 'IG1' }), text: async () => '' }; }
    if (u.includes('/456/media')) { const b = JSON.parse(opt.body || '{}'); order.push(b.media_type === 'STORIES' ? 'ig-story' : 'ig-feed'); return { ok: true, json: async () => ({ id: 'C1' }), text: async () => '' }; }
    return { ok: false, status: 404, headers: { get: () => '' }, json: async () => ({}), text: async () => '' };
  };
  const CTX = { plan: { hijri: { text: '' }, day: {}, leads: [] },
    index: { words: [{ i: 1, t: 'Qalqalah', a: 'قلقلة', s: 'a bounce in the sound' }], path: [] },
    extras: { entry: { s: 'a bounce in the sound', l: '', cat: 'Tajwid', k: 'editorial' } },
    /* cardsFeed on: the feed-era order this promise is about; a story-only
       card (the shipped state) is held in tests/cards-stories.mjs */
    dials: { polish: false, mode: 'auto', storeOk: true, stories: true, cardsFeed: true } };
  const r = await SOC.sendSlot('noorcodex.com', '2026-09-08', 'word', CTX);
  ok(r.ok && r.state === 'sent', 'the word slot is sent');
  const firstRecord = order.indexOf('record'), firstStory = order.findIndex(o => o.endsWith('story') || o === 'fb-story-photo');
  ok(firstRecord > -1 && firstStory > firstRecord, 'the slot is on the record before the first story call: ' + order.join(' > '));
  ok(order.indexOf('fb-feed') < firstStory && order.indexOf('ig-publish') < firstStory, 'both feed posts land before any story');
  const rec = JSON.parse(STORE.get('nsoc:slot:2026-09-08#word'));
  ok(rec.results.facebook.story && rec.results.facebook.story.ok && rec.results.instagram.story && rec.results.instagram.story.ok, 'the final record carries both stories');
  ok(order.filter(o => o === 'record').length === 2, 'the record is written twice: once before, once with the stories');
  globalThis.fetch = realFetch;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
