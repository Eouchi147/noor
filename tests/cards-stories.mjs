/* NOOR · the cards leave the feed.
   ------------------------------------------------------------------
   The owner's decision of 9 September 2026: the five daily cards reach
   nobody in a feed, so they go to the stories on Facebook and Instagram and
   nowhere else, and the five reels keep the feed, offered to YouTube first.
   What is held here:

     with the dial off (the shipped state) a card slot sends no feed post
       and one story per live Meta network, and its record says so;
     the record's shape is the one the rest of the house reads:
       { story, ok, storyOnly } per channel, slotState sent;
     Reddit is still drafted, exactly as before;
     with the dial on, the feed comes back: a feed post, then the story;
     the healer mends a failed story-only slot as a story, once, and never
       touches the network that has it;
     a reel slot is untouched, and its channels are asked YouTube first;
     what the owner shared from the phone is a note on the record and never
       a network: it cannot make a slot sent.

   Meta is stubbed. This repository has no credentials and never will.

   Run:  node tests/cards-stories.mjs
*/
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

process.env.FB_PAGE_ID = '123'; process.env.FB_PAGE_TOKEN = 'tok';
process.env.IG_USER_ID = '456'; process.env.IG_TOKEN = 'igtok';
process.env.KV_REST_API_URL = 'https://kv.test';
process.env.KV_REST_API_TOKEN = 't';
process.env.IG_POLL_EVERY_MS = '5';

const SOC = await import('../api/social.js');

const DATE = '2026-09-10';
const STORE = new Map();
let calls = [];                 /* every Meta call, in order, as a short name */
let igStoryFails = false;

/* what each Meta call is, read off the url and the body */
function name(u, body) {
  if (u.includes('/123/photos')) return body.published === false ? 'fb-story-photo' : 'fb-feed';
  if (u.includes('/123/photo_stories')) return 'fb-story';
  if (u.includes('/123/video_reels')) return 'fb-reel:' + body.upload_phase;
  if (u.includes('/123/video_stories')) return 'fb-video-story:' + body.upload_phase;
  if (u.startsWith('https://rupload.facebook.com/')) return 'fb-upload';
  if (u.includes('/456/media_publish')) return 'ig-publish';
  if (u.includes('/456/media')) return body.media_type === 'STORIES' ? 'ig-story' : (body.media_type === 'REELS' ? 'ig-reel' : 'ig-feed');
  if (u.includes('status_code')) return 'ig-status';
  return 'other:' + u.slice(0, 40);
}

globalThis.fetch = async (url, opt) => {
  const u = String(url);
  const J = (j, status = 200) => ({ ok: status < 400, status, headers: { get: () => '' }, json: async () => j, text: async () => JSON.stringify(j) });
  if (u.startsWith('https://kv.test')) {
    const cmds = JSON.parse(opt.body);
    return J(cmds.map(c => {
      const [v, k, val] = c;
      if (v === 'GET') return { result: STORE.has(k) ? STORE.get(k) : null };
      if (v === 'SET') { STORE.set(k, val); return { result: 'OK' }; }
      if (v === 'LRANGE') return { result: [] };
      return { result: null };
    }));
  }
  if (u.includes('/api/card') || u.endsWith('-cover.jpg')) return { ok: true, status: 200, headers: { get: h => h === 'content-type' ? 'image/jpeg' : '40000' }, json: async () => ({}), text: async () => '' };
  /* the library, served offline, so the healer composes the real way */
  if (u.includes('/assets/menu-index.json')) return J({ words: [{ i: 1, t: 'Qalqalah', a: 'قلقلة', s: 'a bounce in the sound' }], path: [] });
  if (u.includes('/assets/dict-index.json')) return J({ words: { 1: { s: 'a bounce in the sound', l: '', cat: 'Tajwid', k: 'editorial' } } });
  if (u.includes('/123?fields=access_token')) return J({ access_token: 'pagetok' });
  if (u.includes('/reels/index.json')) return J({ n: 0, cards: [] });
  if (u.includes('graph.facebook.com') || u.includes('graph.instagram.com') || u.startsWith('https://rupload.facebook.com/')) {
    const body = opt && opt.body && typeof opt.body === 'string' ? (() => { try { return JSON.parse(opt.body); } catch { return {}; } })() : {};
    const n = name(u, body); calls.push(n);
    if (n === 'ig-story' && igStoryFails) return J({ error: { message: 'Media could not be fetched', code: 9004 } }, 400);
    if (n === 'fb-story-photo' || n === 'fb-feed') return J({ id: 'PH1', post_id: 'FBPOST' });
    if (n === 'fb-story') return J({ success: true, post_id: 'FBSTORY' });
    if (n === 'fb-reel:start') return J({ video_id: 'V1', upload_url: 'https://rupload.facebook.com/v1' });
    if (n === 'fb-upload') return J({ success: true });
    if (n === 'fb-reel:finish') return J({ success: true });
    if (n === 'fb-video-story:start') return J({ video_id: 'VS1', upload_url: 'https://rupload.facebook.com/vs1' });
    if (n === 'fb-video-story:finish') return J({ success: true, post_id: 'FBVSTORY' });
    if (n === 'ig-story' || n === 'ig-feed' || n === 'ig-reel') return J({ id: 'C1' });
    if (n === 'ig-status') return J({ status_code: 'FINISHED' });
    if (n === 'ig-publish') return J({ id: 'IGPOST' });
    return J({ error: { message: 'unexpected ' + u } }, 400);
  }
  if (u.includes('googleapis.com') || u.includes('/reels/')) return J({ error: { message: 'not in this test' } }, 400);
  return { ok: false, status: 404, headers: { get: () => '' }, json: async () => ({}), text: async () => '' };
};

/* the offline scaffolding: enough for the word slot to compose */
const CTX = () => ({
  plan: { hijri: { text: '' }, day: {}, leads: [] },
  index: { words: [{ i: 1, t: 'Qalqalah', a: 'قلقلة', s: 'a bounce in the sound' }], path: [] },
  extras: { entry: { s: 'a bounce in the sound', l: '', cat: 'Tajwid', k: 'editorial' } },
  dials: { polish: false, mode: 'auto', storeOk: true, stories: true, cardsFeed: false }
});
const KEY = 'nsoc:slot:' + DATE + '#word';
const got = () => JSON.parse(STORE.get(KEY) || '{}');

console.log('\nthe dial');
{
  STORE.clear();
  const d = await SOC.dials();
  ok(d.cardsFeed === false, 'social.cardsFeed ships OFF: the cards are stories only');
  STORE.set('nb:settings', JSON.stringify({ 'social.cardsFeed': true }));
  ok((await SOC.dials()).cardsFeed === true, 'and reads ON when the owner turns it');
  STORE.set('nb:settings', JSON.stringify({ 'social.cardsFeed': 'on' }));
  ok((await SOC.dials()).cardsFeed === true, 'generously, the way the ladder is read');
  STORE.clear();
  ok(SOC.cardIsStoryOnly({ title: 'a card', image: 'x' }, { cardsFeed: false }) === true, 'a card with the dial off is story only');
  ok(SOC.cardIsStoryOnly({ title: 'a card', image: 'x' }, { cardsFeed: true }) === false, 'with the dial on it is a feed post');
  ok(SOC.cardIsStoryOnly({ title: 'a reel', video: 'v.mp4', reel: true }, { cardsFeed: false }) === false, 'a reel is never story only');
}

console.log('\nwith the dial off, a card slot is a story and nothing else');
{
  STORE.clear(); calls = [];
  const r = await SOC.sendSlot('noorcodex.com', DATE, 'word', CTX());
  ok(r.ok === true && r.state === 'sent', 'the word slot is sent: ' + r.state + ' ' + (r.error || ''));
  ok(!calls.includes('fb-feed') && !calls.includes('ig-feed'), 'no feed post is made on either network: ' + calls.join(' > '));
  ok(calls.filter(c => c === 'fb-story').length === 1, 'one story on Facebook');
  ok(calls.filter(c => c === 'ig-story').length === 1 && calls.filter(c => c === 'ig-publish').length === 1, 'one story on Instagram, published once');
  const fbPhoto = calls.indexOf('fb-story-photo');
  ok(fbPhoto > -1 && calls.indexOf('fb-story') > fbPhoto, 'the Facebook photo is made unpublished, then the story from it');
  const rec = got();
  ok(rec.state === 'sent', 'the record reads sent');
  for (const ch of ['facebook', 'instagram']) {
    const x = rec.results[ch] || {};
    ok(x.ok === true && x.storyOnly === true && x.story && x.story.ok === true, ch + ': { story, ok, storyOnly } on the record');
    ok(x.id === (ch === 'facebook' ? 'FBSTORY' : 'IGPOST'), ch + ": the story's id is lifted onto the result: " + x.id);
  }
  ok(rec.results.reddit && rec.results.reddit.draft === true, 'Reddit is still drafted, never sent');
  ok(!Object.keys(rec.results).some(k => !['facebook', 'instagram', 'reddit'].includes(k)), 'no other network is on the record');
  ok(r.storyOnly === true, 'and the answer says it went as stories');
  ok(SOC.slotState(rec.results) === 'sent', 'slotState reads the story-only results as sent');
}

console.log('\nwith the dial on, the feed comes back');
{
  STORE.clear(); calls = [];
  const ctx = CTX(); ctx.dials.cardsFeed = true;
  const r = await SOC.sendSlot('noorcodex.com', DATE, 'word', ctx);
  ok(r.ok === true && r.state === 'sent', 'the word slot is sent');
  ok(calls.includes('fb-feed') && calls.includes('ig-feed'), 'a feed post lands on both networks');
  ok(calls.indexOf('fb-story') > calls.indexOf('fb-feed') && calls.indexOf('ig-story') > calls.indexOf('ig-feed'), 'and the story comes after it');
  const rec = got();
  ok(rec.results.facebook.ok && !rec.results.facebook.storyOnly && rec.results.facebook.story && rec.results.facebook.story.ok, 'the record is the old shape: a feed result with a story on it');
}

console.log('\na story that fails is on the record like a feed failure');
{
  STORE.clear(); calls = []; igStoryFails = true;
  const r = await SOC.sendSlot('noorcodex.com', DATE, 'word', CTX());
  igStoryFails = false;
  ok(r.state === 'partial', 'one story landed and one did not: the slot is half sent');
  const ig = got().results.instagram;
  ok(ig.ok === false && ig.storyOnly === true && ig.code === 9004 && /could not be fetched/.test(ig.error), "Instagram's refusal, code and words, is lifted onto the result");
  ok(SOC.healable(ig), 'and the healer reads it as something to mend');
}

console.log('\nthe healer mends a story-only slot as a story, once');
{
  STORE.clear(); calls = [];
  STORE.set(KEY, JSON.stringify({ at: DATE + 'T16:00:00.000Z', slot: 'word', state: 'partial', title: 'Qalqalah',
    results: { facebook: { ok: true, id: 'FBSTORY', storyOnly: true, story: { ok: true, id: 'FBSTORY' } },
               instagram: { ok: false, storyOnly: true, code: 9004, error: 'Media could not be fetched', err: 'Media could not be fetched',
                            tries: 1, lastTry: DATE + 'T16:00:00.000Z', story: { ok: false, code: 9004, error: 'Media could not be fetched' } } } }));
  const ran = await SOC.healFailures('noorcodex.com', DATE, { ran: [] }, DATE + 'T18:00:00.000Z', () => true);
  ok(ran.some(x => x.where === 'instagram' && x.healed && x.ok), 'the run reports the heal: ' + JSON.stringify(ran));
  ok(calls.filter(c => c === 'ig-story').length === 1 && calls.filter(c => c === 'ig-publish').length === 1, 'Instagram is sent the story again, exactly once');
  ok(!calls.includes('ig-feed'), 'and never a feed post');
  ok(!calls.some(c => c.startsWith('fb-')), 'Facebook, which has its story, is not touched');
  const rec = got();
  ok(rec.results.instagram.ok === true && rec.results.instagram.storyOnly === true && rec.results.instagram.tries === 2, 'the record says the story went, as a story, on the second try');
  ok(rec.results.facebook.id === 'FBSTORY' && rec.state === 'sent', 'the slot is properly sent');
  const again = await SOC.retryChannel('noorcodex.com', DATE, 'word', 'instagram', CTX());
  ok(again.ok === false && again.already === true, 'pressing Retry on it now is refused: it already went');
}

console.log('\na story-only card is not offered to a network without a story surface');
{
  STORE.clear(); calls = [];
  STORE.set(KEY, JSON.stringify({ at: 'x', slot: 'word', state: 'sent', title: 'Qalqalah',
    results: { facebook: { ok: true, storyOnly: true, story: { ok: true } }, instagram: { ok: true, storyOnly: true, story: { ok: true } } } }));
  process.env.PIN_TOKEN = 'at'; process.env.PIN_BOARD_NAME = 'NOOR';
  const r = await SOC.retryChannel('noorcodex.com', DATE, 'word', 'pinterest', CTX());
  delete process.env.PIN_TOKEN; delete process.env.PIN_BOARD_NAME;
  ok(r.ok === false && r.fatal === true && /stories only/.test(r.error), 'Pinterest is refused with the reason: ' + r.error);
  ok(calls.length === 0, 'and nothing is called');
}

console.log('\na record from before the cards left the feed is retried as a feed post');
{
  STORE.clear(); calls = [];
  STORE.set(KEY, JSON.stringify({ at: 'x', slot: 'word', state: 'partial', title: 'Qalqalah',
    results: { facebook: { ok: true, id: 'FBPOST' }, instagram: { ok: false, error: 'Meta could not fetch the image', code: 9004 } } }));
  const r = await SOC.retryChannel('noorcodex.com', DATE, 'word', 'instagram', CTX());
  ok(r.ok === true && calls.includes('ig-feed') && !calls.includes('ig-story'), 'the missing half of a feed-era slot is a feed post, whatever the dial says now');
}

console.log('\na reel slot is untouched, and YouTube is asked first');
{
  const reel = { id: 'verse-94-5-6', kind: 'verse', hook: 'Al-Sharh · 94:5-6', caption: 'A caption.', video: 'https://noorcodex.com/reels/verse-94-5-6.mp4', cover: 'https://noorcodex.com/reels/verse-94-5-6-cover.jpg' };
  STORE.clear(); calls = [];
  const ctx = CTX(); ctx.extras = { reel };
  const r = await SOC.sendSlot('noorcodex.com', DATE, 'reelA', ctx);
  ok(r.ok === true && !r.storyOnly, 'the reel is sent as a reel: ' + r.state);
  ok(calls.includes('fb-reel:start') && calls.includes('ig-reel'), 'to the feed on both networks');
  const rec = JSON.parse(STORE.get('nsoc:slot:' + DATE + '#reelA'));
  ok(rec.results.facebook.ok && !rec.results.facebook.storyOnly && rec.results.instagram.ok && !rec.results.instagram.storyOnly, 'and its record is the feed shape');
  ok(rec.results.facebook.story && rec.results.instagram.story, 'with the story after it, as before');
  ok(SOC.orderChannels(['facebook', 'instagram', 'youtube', 'pinterest', 'telegram', 'threads'], { video: 'v' }).join() === 'youtube,instagram,facebook,threads,telegram,pinterest',
     'a reel is offered YouTube first, then Instagram, Facebook, Threads, Telegram, Pinterest');
  ok(SOC.orderChannels(['facebook', 'instagram', 'youtube'], { video: 'v' }).join() === 'youtube,instagram,facebook', 'the set is what is live; only the order changes');
  ok(SOC.orderChannels(['facebook', 'instagram'], { image: 'i' }).join() === 'facebook,instagram', 'a card keeps its order');
  {
    /* Six networks share fifty five seconds and YouTube can take half of it,
       so a FIXED queue means the same three are never reached: Threads,
       Telegram and Pinterest were last every hour of every day. Whoever the
       clock cut last time on this slot leads next time. */
    const ALL = ['facebook', 'instagram', 'youtube', 'pinterest', 'telegram', 'threads'];
    const cut = { results: { threads: { late: true }, telegram: { late: true }, pinterest: { late: true },
                             youtube: { ok: true }, instagram: { ok: true }, facebook: { ok: true } } };
    ok(SOC.orderChannels(ALL, { video: 'v' }, cut).join() === 'threads,telegram,pinterest,youtube,instagram,facebook',
      'the three the clock cut lead the next hour, in their own order');
    const one = { results: { pinterest: { late: true }, youtube: { ok: true } } };
    ok(SOC.orderChannels(ALL, { video: 'v' }, one).join() === 'pinterest,youtube,instagram,facebook,threads,telegram',
      'and one that was cut goes to the front alone');
    const refused = { results: { threads: { ok: false, err: 'refused' } } };
    ok(SOC.orderChannels(ALL, { video: 'v' }, refused).join() === 'youtube,instagram,facebook,threads,telegram,pinterest',
      'a network that REFUSED is not owed time: that is the healer\'s business, and the order is unchanged');
    ok(SOC.orderChannels(ALL, { image: 'i' }, cut).join() === ALL.join(),
      'and a card is never reordered, whatever happened last hour');
  }
  /* end to end: with YouTube connected, it is the first network called */
  process.env.YT_CLIENT_ID = 'c'; process.env.YT_CLIENT_SECRET = 's'; process.env.YT_REFRESH_TOKEN = 'r';
  const order = [];
  const inner = globalThis.fetch;
  globalThis.fetch = async (u, o) => {
    const s = String(u);
    if (s.includes('oauth2.googleapis.com')) { order.push('youtube'); return { ok: true, status: 200, json: async () => ({ access_token: 'a', expires_in: 3600 }) }; }
    if (s.endsWith('.mp4')) return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(30000) };
    if (s.includes('googleapis.com/upload')) return { ok: true, status: 200, json: async () => ({ id: 'yt1', status: { privacyStatus: 'public' } }) };
    if (s.includes('/123/video_reels') || s.includes('/456/media')) order.push(s.includes('/456/') ? 'instagram' : 'facebook');
    return inner(u, o);
  };
  STORE.clear();
  const r2 = await SOC.sendSlot('noorcodex.com', DATE, 'reelA', ctx);
  globalThis.fetch = inner;
  delete process.env.YT_CLIENT_ID; delete process.env.YT_CLIENT_SECRET; delete process.env.YT_REFRESH_TOKEN;
  const first = order.filter((x, i) => order.indexOf(x) === i);
  ok(r2.results.youtube && r2.results.youtube.ok && r2.results.youtube.id === 'yt1', 'YouTube took the Short');
  ok(first.join() === 'youtube,instagram,facebook', 'and was asked before Instagram and Facebook: ' + first.join(' > '));
}

console.log('\nboth networks cut by the clock: still a story-only slot, healed as one');
{
  /* the second reader's find: a story-only card whose two networks were
     both cut by the clock carried no mark, so the healer sent it to the FEED */
  STORE.clear(); calls = [];
  const ctx = CTX(); ctx.left = () => 5000;                 /* no room for any network */
  const r = await SOC.sendSlot('noorcodex.com', DATE, 'word', ctx);
  ok(r.state === 'failed' && calls.length === 0, 'with no time left nothing is called and the slot is failed');
  const rec0 = got();
  ok(rec0.results.facebook.late && rec0.results.instagram.late, 'both networks are recorded as late');
  ok(rec0.results.facebook.storyOnly === true && rec0.results.instagram.storyOnly === true, 'and both carry the story-only mark even so');
  const ran = await SOC.healFailures('noorcodex.com', DATE, { ran: [] }, DATE + 'T18:00:00.000Z', () => true);
  ok(ran.filter(x => x.healed && x.ok).length === 2, 'the healer mends both: ' + JSON.stringify(ran.map(x => x.where + ':' + x.ok)));
  ok(!calls.includes('fb-feed') && !calls.includes('ig-feed'), 'as stories, never as feed posts: ' + calls.join(' > '));
  ok(calls.filter(c => c === 'fb-story').length === 1 && calls.filter(c => c === 'ig-story').length === 1, 'one story each');
  const rec = got();
  ok(rec.state === 'sent' && rec.results.facebook.storyOnly && rec.results.instagram.storyOnly, 'and the record is a sent, story-only slot');
  /* and a record with nothing decided on it at all follows the dial */
  STORE.set(KEY, JSON.stringify({ at: 'x', slot: 'word', state: 'failed', title: 'Qalqalah',
    results: { facebook: { ok: false, late: true, error: 'no time' }, instagram: { ok: false, late: true, error: 'no time' } } }));
  calls = [];
  const r2 = await SOC.retryChannel('noorcodex.com', DATE, 'word', 'instagram', CTX());
  ok(r2.ok && calls.includes('ig-story') && !calls.includes('ig-feed'), 'a record no network decided (both late, no mark) is retried the way the dial says: a story');
}

console.log('\nwhat the owner shared from the phone');
{
  STORE.clear();
  const a = await SOC.markShared(DATE, 'reelA', 'phone');
  ok(a.ok === true && a.where === 'phone' && a.at, 'a share is noted');
  const rec = JSON.parse(STORE.get('nsoc:slot:' + DATE + '#reelA'));
  ok(rec.results.phone && rec.results.phone.ok === true && rec.results.phone.at === a.at, 'as results.phone = { ok, at } on the slot record');
  ok(!rec.state, 'on a slot the machine has not reached, the record has no state, so the slot is still owed');
  ok(SOC.slotState(rec.results) === 'failed' && SOC.slotState({ ...rec.results, facebook: { ok: false, error: 'no' } }) === 'failed',
     'the phone can never make a slot read sent');
  const b = await SOC.markShared(DATE, 'reelA', 'phone');
  ok(b.ok === true && b.already === true && b.at === a.at, 'a second press keeps the first time');
  const c = await SOC.markShared(DATE, 'nosuch', 'phone');
  ok(c.ok === false && /no such slot/.test(c.error), 'an unknown slot is refused');
  /* on a slot the machine did send, the note sits beside the networks */
  STORE.set('nsoc:slot:' + DATE + '#reelC', JSON.stringify({ at: 'x', slot: 'reelC', state: 'sent', title: 'v', reel: 'verse-1', results: { facebook: { ok: true, id: 'F' }, instagram: { ok: true, id: 'I' } } }));
  await SOC.markShared(DATE, 'reelC', 'phone');
  const rc = JSON.parse(STORE.get('nsoc:slot:' + DATE + '#reelC'));
  ok(rc.state === 'sent' && rc.results.facebook.id === 'F' && rc.results.phone.ok, 'and beside the networks on a sent slot, which stays sent');
  ok(SOC.slotState({ facebook: { ok: true }, instagram: { ok: false, error: 'x' }, phone: { ok: true } }) === 'partial', 'a half sent slot with a phone note is still half sent');
  /* the second reader's find: `where` naming a network would have written
     over that network's real answer and made the slot read sent */
  STORE.set('nsoc:slot:' + DATE + '#reelD', JSON.stringify({ at: 'x', slot: 'reelD', state: 'failed', title: 'v', results: { instagram: { ok: false, error: 'refused', code: 9004 } } }));
  const bad = await SOC.markShared(DATE, 'reelD', 'instagram');
  ok(bad.ok === false && bad.code === 400 && /phone/.test(bad.error), 'a share said to be "instagram" is refused, in words: ' + bad.error);
  const rd = JSON.parse(STORE.get('nsoc:slot:' + DATE + '#reelD'));
  ok(rd.results.instagram.ok === false && rd.results.instagram.code === 9004 && !rd.results.phone, "and Instagram's real answer is untouched");
  ok(SOC.slotState({ instagram: { ok: true, at: 'x', hand: true } }) === 'failed', 'a hand-written result under a network\'s name still never makes a slot sent');
  const odd = await SOC.markShared(DATE, 'reelD', 'Phone');
  ok(odd.ok === false && odd.code === 400, 'nor any other spelling');
  const blank = await SOC.markShared(DATE, 'reelD', '');
  ok(blank.ok === true && blank.where === 'phone', 'an empty where is the phone');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
