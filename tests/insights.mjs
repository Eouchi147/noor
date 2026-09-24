/* NOOR · what strangers watch, with the networks stubbed.
   ------------------------------------------------------------------
   The arithmetic on fixed records: medians by kind, by hour, by network,
   the top ten, and sentences that appear only when a bucket holds five.
   The cache: a second call within six hours asks Meta nothing. The batch
   cap and `partial`. A token without instagram_manage_insights is named,
   and one media that Meta refuses does not stop the rest.

   And the daily snapshot (masterplan step 8): ytStats, a batch read of
   statistics and contentDetails together; snapshot(), which writes one
   photograph a day per record, Short and wide upload both, bounded by a
   day count and a clock; and numbers(), the arithmetic that folds a
   fortnight of those photographs into this week against the one before it.

   And the learning loop (masterplan section 12): Threads media insights
   read and folded the same way Instagram's are, with the same missing
   permission stop; and the subject fold, a Light's group, a verse's surah,
   a word's dictionary category and a film's field, bucketed by MIN_BUCKET
   the same as everything else here, with the top ten and bottom five.

   Meta and Google are stubbed. This repository has no credentials.

   Run:  node tests/insights.mjs
*/
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

process.env.FB_PAGE_ID = '123'; process.env.FB_PAGE_TOKEN = 'tok';
process.env.IG_USER_ID = '456'; process.env.IG_TOKEN = 'igtok';
process.env.TH_TOKEN = 'thtok';
process.env.KV_REST_API_URL = 'https://kv.test';
process.env.KV_REST_API_TOKEN = 't';
process.env.YT_CLIENT_ID = 'c'; process.env.YT_CLIENT_SECRET = 's'; process.env.YT_REFRESH_TOKEN = 'r';

/* a Redis in a Map, spoken over the pipeline the way Upstash speaks it */
const store = new Map();
function pipeline(cmds) {
  return cmds.map(c => {
    const [op, ...a] = c;
    if (op === 'GET') return { result: store.has(a[0]) ? store.get(a[0]) : null };
    if (op === 'SET') { store.set(a[0], a[1]); return { result: 'OK' }; }
    if (op === 'MGET') return { result: a.map(k => store.has(k) ? store.get(k) : null) };
    if (op === 'DEL') { a.forEach(k => store.delete(k)); return { result: 1 }; }
    return { result: null };
  });
}

let calls = [];
let igMode = 'ok';            /* ok | noperm | refuse:<id> | oldnames */
let thMode = 'ok';            /* ok | noperm | refuse:<id> */
const igAnswer = (id, metrics) => {
  const base = 100 + (parseInt(id.replace(/\D/g, ''), 10) || 0) * 10;
  const data = metrics.split(',').map(name => ({ name, period: 'lifetime', values: [{ value:
    name === 'reach' ? base : name === 'views' ? base * 3 : name === 'ig_reels_avg_watch_time' ? 4200 : 7 }] }));
  return { data };
};
/* Threads has no reach metric: views stands in, the way the top of
   api/_insights.js's THREADS note says */
const thAnswer = (id, metrics) => {
  const base = 100 + (parseInt(id.replace(/\D/g, ''), 10) || 0) * 10;
  const data = metrics.split(',').map(name => ({ name, values: [{ value:
    name === 'views' ? base : name === 'likes' ? 9 : name === 'replies' ? 3 : name === 'reposts' ? 2 : name === 'quotes' ? 1 : 4 }] }));
  return { data };
};
globalThis.fetch = async (url, opt) => {
  const u = String(url);
  const J = (j, status = 200) => ({ ok: status < 400, status, json: async () => j });
  if (u.startsWith('https://kv.test')) return J(pipeline(JSON.parse(opt.body)));
  calls.push(u);
  if (u.includes('/123?fields=access_token')) return J({ access_token: 'pagetok' });
  if (u.includes('oauth2.googleapis.com/token')) return J({ access_token: 'yt-access', expires_in: 3600 });
  if (u.includes('googleapis.com/youtube/v3/videos')) {
    const ids = decodeURIComponent(u.split('id=')[1]).split(',');
    return J({ items: ids.map(id => ({ id, statistics: { viewCount: '900', likeCount: '12', commentCount: '1' } })) });
  }
  const mt = u.match(/^https:\/\/graph\.threads\.net\/v1\.0\/([^/]+)\/insights\?metric=(.+)$/);
  if (mt) {
    const id = mt[1], metrics = mt[2];
    if (thMode === 'noperm') return J({ error: { message: '(#10) Application does not have permission for this action', code: 10 } }, 400);
    if (thMode === 'refuse:' + id) return J({ error: { message: 'Unsupported get request. Object with ID does not exist', code: 100 } }, 400);
    return J(thAnswer(id, metrics));
  }
  const mv = u.match(/\/v21\.0\/([^/]+)\/video_insights\?metric=(.+)$/);
  if (mv) {
    /* a reel is a video node: only the video names, and only under video_insights */
    const names = mv[2].split(',');
    if (names.some(n => !FBV_OK.has(n))) return J({ error: { message: '(#100) The value must be a valid insights metric', code: 100 } }, 400);
    return J({ data: names.map(name => ({ name, values: [{ value: name === 'post_total_media_view_unique' ? 300 : (name === 'blue_reels_play_count' ? 500 : 4200) }] })) });
  }
  const m = u.match(/\/v21\.0\/([^/]+)\/insights\?metric=(.+)$/);
  if (m) {
    const id = m[1], metrics = m[2];
    if (/^\d+$/.test(id) || id.startsWith('vid')) return J({ error: { message: '(#100) The value must be a valid insights metric', code: 100 } }, 400);
    if (id.startsWith('fb')) {
      /* Meta today: the retired names are refused, the four that stand are taken */
      const names = metrics.split(',');
      if (names.some(n => !FB_OK.has(n))) return J({ error: { message: '(#100) The value must be a valid insights metric', code: 100 } }, 400);
      return J({ data: names.map(name => ({ name, values: [{ value: name === 'post_total_media_view_unique' ? 55 : 80 }] })) });
    }
    if (igMode === 'noperm') return J({ error: { message: '(#10) Application does not have permission for this action', code: 10 } }, 400);
    if (igMode === 'refuse:' + id) return J({ error: { message: 'Unsupported get request. Object with ID does not exist', code: 100, error_subcode: 33 } }, 400);
    if (igMode === 'oldnames' && /views/.test(metrics)) return J({ error: { message: '(#100) metric[0] must be one of the following values: reach, likes...', code: 100 } }, 400);
    return J(igAnswer(id, metrics));
  }
  return J({ error: { message: 'unexpected ' + u } }, 400);
};

/* Meta on 9 September 2026: post_impressions went on 15 November 2025 and
   post_impressions_unique on 15 June 2026 (see the top of api/_insights.js);
   these are the names that stand, and a reel answers only to its own */
const FB_OK = new Set(['post_total_media_view_unique', 'post_media_view', 'post_clicks', 'post_reactions_like_total']);
const FBV_OK = new Set(['post_total_media_view_unique', 'blue_reels_play_count', 'post_video_avg_time_watched']);
const INS = await import('../api/_insights.js');
const YT = await import('../api/_youtube.js');
const { SLOT_IDS } = await import('../api/_schedule.js');

/* ---------- fixed records: fourteen days, a kind per slot, an id per network ---------- */
const MANIFEST = { cards: [
  { id: 'v1', kind: 'verse', hook: 'One verse about light' }, { id: 'w1', kind: 'word', hook: 'The word for patience' },
  { id: 'k1', kind: 'know', hook: 'Did you know the first minaret' }, { id: 'c1', kind: 'codex', hook: 'The Codex' } ] };
const HOOK = { reelA: 'One verse about light', reelC: 'The word for patience', reelD: 'Did you know the first minaret', reelB: 'One verse about light', reelE: 'The word for patience' };
const NOW = '2026-09-08T12:00:00Z';
const dates = INS.datesBack(14, new Date(NOW));
const records = {};
let n = 0;
for (const d of dates) for (const slot of ['dawn', 'reelA', 'reelC', 'light', 'reelD', 'word', 'reelB', 'dusk', 'reelE']) {
  n++;
  const results = { instagram: { ok: true, id: 'ig' + n }, facebook: { ok: true, id: 'fb_' + n } };
  if (/^reel/.test(slot)) results.youtube = { ok: true, id: 'yt' + n };
  records[d + '#' + slot] = { at: d + 'T' + String(INS.hourOf(slot)).padStart(2, '0') + ':02:00Z', slot, state: 'sent',
    title: HOOK[slot] || (slot + ' of ' + d), results };
}
/* one slot that failed on Instagram carries no id there and must not be counted */
records[dates[0] + '#dusk'].results.instagram = { ok: false, error: 'no' };
const readSlot = async (d, s) => records[d + '#' + s] || null;
const opts = { readSlot, manifest: MANIFEST, now: NOW };

console.log('\ncollecting the records');
{
  const posts = await INS.collect(14, opts);
  ok(posts.length === 14 * 9, 'every slot record of the fortnight is a post: ' + posts.length);
  const a = posts.find(p => p.slot === 'reelA');
  ok(a.kind === 'reel:verse' && a.hour === 8 && a.reel, 'a reel is named by matching its hook on the shelf, with its hour');
  ok(posts.find(p => p.slot === 'word').kind === 'card:word', 'a card is its slot, keyed apart from the reel of the same name');
  const dusk0 = posts.find(p => p.slot === 'dusk' && p.date === dates[0]);
  ok(dusk0 && !dusk0.media.instagram && dusk0.media.facebook, 'a network that refused carries no id and is not asked');
  ok(INS.kindOf({ slot: 'reelE', title: 'a hook that is not on the shelf', date: dates[3] }, MANIFEST).startsWith('reel:'), 'a hook off the shelf still gets a reel kind from the rota');
  ok(INS.kindOf({ slot: 'reelE', title: 'x' }, null) === 'reel:reel', 'and with no shelf at all it is simply a reel');
  /* a card sent as a story only (social.cardsFeed off) carries the story's id, which answers under no post edge */
  const so = { ...records[dates[1] + '#word'], results: { facebook: { ok: true, id: 'FBSTORY', storyOnly: true, story: { ok: true, id: 'FBSTORY' } }, instagram: { ok: true, id: 'IGSTORY', storyOnly: true, story: { ok: true } }, phone: { ok: true, at: NOW, hand: true } } };
  const posts2 = await INS.collect(14, { ...opts, readSlot: async (d, s) => (d + '#' + s === dates[1] + '#word') ? so : records[d + '#' + s] || null });
  ok(posts2.length === 14 * 9 - 1 && !posts2.some(p => p.slot === 'word' && p.date === dates[1]), 'a story-only card is not read as a post: a story answers under no post edge');
}

console.log('\nthe arithmetic');
{
  ok(INS.median([5, 1, 3]) === 3 && INS.median([4, 1, 3, 2]) === 2.5 && INS.median([]) === null && INS.median([1, null, 'x']) === 1, 'median: odd, even, empty, and the unreadable ignored');
  ok(INS.mean([1, 2, 3]) === 2 && INS.mean([]) === null, 'mean');
  const mk = (kind, hour, net, reach, views, i) => ({ date: '2026-09-01', slot: 's', hour, kind, title: 't' + i, media: { [net]: net + i }, ins: { [net]: { at: NOW, reach, views } } });
  const posts = [];
  let i = 0;
  for (let k = 0; k < 6; k++) posts.push(mk('reel:verse', 8, 'instagram', 2400 + k, 7000, i++));
  for (let k = 0; k < 5; k++) posts.push(mk('card:word', 16, 'instagram', 1000 + k, 1200, i++));
  for (let k = 0; k < 5; k++) posts.push(mk('reel:word', 21, 'instagram', 300 + k, 900, i++));
  for (let k = 0; k < 2; k++) posts.push(mk('reel:codex', 17, 'instagram', 9000, 20000, i++));   /* two only: no sentence */
  for (let k = 0; k < 5; k++) posts.push(mk('card:dawn', 5, 'facebook', 500 + k, 600, i++));
  posts.push(mk('reel:verse', 8, 'youtube', null, 12000, i++));
  posts.push({ ...mk('reel:verse', 8, 'instagram', null, null, i++), ins: {} });                    /* not read yet */
  posts.push({ ...mk('reel:verse', 8, 'instagram', null, null, i++), ins: { instagram: { at: NOW, error: 'refused' } } });
  const a = INS.aggregate(posts);
  ok(a.read === 24 && a.unread === 1 && a.refused === 1, 'read, unread and refused are counted apart: ' + JSON.stringify([a.read, a.unread, a.refused]));
  const verse = a.byKind.find(k => k.kind === 'reel:verse'), word = a.byKind.find(k => k.kind === 'card:word');
  ok(verse && verse.n === 6 && verse.reach.median === 2402.5 && verse.views.median === 7000, 'verse reels: n, median reach, median views');
  ok(word && word.reach.mean === 1002 && word.label === 'word cards', 'word cards: mean reach and a plain label');
  ok(a.byKind[0].kind === 'reel:codex', 'kinds are ordered by median reach, whatever their count');
  const h21 = a.byHour.find(h => h.hour === 21);
  ok(h21 && h21.n === 5 && h21.reach.median === 302 && h21.label === '21:00', 'the 21:00 slot is a bucket of its own');
  ok(!a.byHour.find(h => h.hour === 5), 'hours are judged by Instagram; a Facebook-only card does not make an hour');
  const fb = a.byNetwork.find(x => x.net === 'facebook'), yt = a.byNetwork.find(x => x.net === 'youtube');
  ok(fb && fb.n === 5 && fb.reach.median === 502 && yt && yt.views.median === 12000 && yt.reach.median === null, 'by network: Facebook reach, YouTube views and no reach');
  ok(a.top.length === 10 && a.top[0].n === 12000 && a.top[0].measure === 'views' && a.top[1].reach === 9000 && a.top[1].measure === 'reach' && a.top.every((t, j) => !j || a.top[j - 1].n >= t.n), 'the top ten is ranked by reach, a Short by its views');
  ok(a.top.some(t => t.net === 'youtube' && t.measure === 'views' && t.url.includes('youtube.com/shorts/')), 'a YouTube Short stands in the list by its views, named as views, with its url');
  ok(a.top.every(t => t.title && t.label && t.at && t.net && t.id), 'each with title, kind, hour, network and id');
  const s = a.sentences.join(' ');
  ok(/Verse reels reach 8× the median of word reels/.test(s), 'the best kind against the worst, as a plain ratio: ' + s);
  ok(!/Codex/.test(s), 'a kind with two posts is in no sentence');
  ok(/The 08:00 slot reaches most/.test(s) && /The 21:00 slot reaches least/.test(s), 'the hours that reach most and least are named');
  ok(/Instagram reaches 2× Facebook's median/.test(s), 'the two networks against each other, both five deep');
  ok(a.sentences.every(x => /\.$/.test(x)), 'every sentence ends');
}

console.log('\nnot enough yet');
{
  const posts = [];
  for (let k = 0; k < 4; k++) posts.push({ date: 'd', slot: 's', hour: 8, kind: 'reel:verse', title: 't', media: { instagram: 'i' + k }, ins: { instagram: { at: NOW, reach: 100 } } });
  for (let k = 0; k < 4; k++) posts.push({ date: 'd', slot: 's', hour: 21, kind: 'reel:word', title: 't', media: { instagram: 'j' + k }, ins: { instagram: { at: NOW, reach: 10 } } });
  const a = INS.aggregate(posts);
  ok(a.byKind.length === 2 && a.byHour.length === 2, 'the buckets are still drawn');
  ok(a.sentences.length === 1 && /Not enough yet/.test(a.sentences[0]) && /8 readings/.test(a.sentences[0]), 'but the one sentence says not enough yet: ' + a.sentences[0]);
  const same = [];
  for (let k = 0; k < 5; k++) same.push({ date: 'd', slot: 's', hour: 8, kind: 'reel:verse', title: 't', media: { instagram: 'a' + k }, ins: { instagram: { at: NOW, reach: 100 } } });
  for (let k = 0; k < 5; k++) same.push({ date: 'd', slot: 's', hour: 21, kind: 'reel:word', title: 't', media: { instagram: 'b' + k }, ins: { instagram: { at: NOW, reach: 95 } } });
  const b = INS.aggregate(same).sentences.join(' ');
  ok(/about the same/.test(b) && /No hour stands out/.test(b), 'a difference under a fifth is called about the same, not a finding');
}

console.log('\nthe batch, the cap and partial');
{
  store.clear(); calls = [];
  const r = await INS.refresh(14, opts);
  ok(r.media === 14 * 9 * 2 + 14 * 5 - 1, 'every (post, network) pair is a media to read: ' + r.media);
  ok(r.fetched === 40 && r.partial === true && r.left === r.media - 40, 'forty are read and the answer is partial with the rest counted: ' + JSON.stringify([r.fetched, r.partial, r.left]));
  const ig = calls.filter(u => /\/ig\d+\/insights/.test(u)), fb = calls.filter(u => /\/fb_\d+\/insights/.test(u)), yt = calls.filter(u => /youtube\/v3\/videos/.test(u));
  ok(yt.length === 1 && ig.length + fb.length + 1 <= 41, 'YouTube is one call for all its ids in the batch');
  ok(ig.every(u => u.includes('metric=views,reach,likes,comments,saved,shares')), 'Instagram is asked for views and reach, never the retired plays or impressions');
  ok(ig.some(u => u.includes('ig_reels_avg_watch_time')), 'a reel is asked its watch time');
  ok(!calls.some(u => /access_token=/.test(u)), 'no token travels in a query string');
  const one = JSON.parse(store.get('nsoc:ins:instagram:ig2'));
  ok(one && one.at && one.reach === 120 && one.views === 360, 'each answer is cached under nsoc:ins:<network>:<id> with the time');
  let total = r.fetched, rounds = 1, last = r;
  while (last.partial && rounds < 20) { last = await INS.refresh(14, opts); total += last.fetched; rounds++; }
  ok(!last.partial && last.left === 0 && total === r.media, 'asked again until partial is false, every media is read once: ' + rounds + ' rounds');
  calls = [];
  const again = await INS.refresh(14, opts);
  ok(again.fetched === 0 && calls.length === 0 && !again.partial, 'a second call within six hours asks Meta nothing');
  const later = await INS.refresh(14, { ...opts, now: '2026-09-08T18:30:00Z' });
  ok(later.fetched === 40 && calls.length > 0, 'after six hours the oldest are read again');
  const rd = await INS.read(14, { ...opts, now: '2026-09-08T18:30:00Z' });
  ok(rd.ok && rd.read > 0 && rd.byKind.length >= 4 && rd.byHour.length === 9 && rd.stale === rd.media - 40, 'the read folds the cache into kinds, hours and a stale count without a network call');
  ok(rd.sentences.length >= 2 && !/Not enough/.test(rd.sentences[0]), 'and with a fortnight read it has something to say: ' + rd.sentences[0]);
}

console.log('\nthe budget');
{
  store.clear(); calls = [];
  const r = await INS.refresh(14, { ...opts, budgetMs: -1 });
  ok(r.fetched < 40 && r.partial, 'a spent budget stops the batch early and says partial');
}

console.log('\none media Meta refuses does not stop the rest');
{
  store.clear(); calls = [];
  igMode = 'refuse:ig3';
  const r = await INS.refresh(14, { ...opts, batch: 12 });
  ok(r.fetched === 12 && r.errors === 1, 'twelve read, one refused: ' + JSON.stringify([r.fetched, r.errors]));
  const bad = JSON.parse(store.get('nsoc:ins:instagram:ig3'));
  ok(bad && bad.error && /does not exist/.test(bad.error) && bad.code === 100, 'the refusal is recorded as { error } with Meta\'s words and code');
  ok(JSON.parse(store.get('nsoc:ins:instagram:ig4')).reach === 140, 'and the next one was read');
  const rd = await INS.read(14, opts);
  ok(rd.refused === 1 && rd.read === 11, 'the read counts it as refused and goes on');
  calls = [];
  await INS.refresh(14, { ...opts, batch: 12 });
  ok(!calls.some(u => /\/ig3\/insights/.test(u)), 'a refusal is not asked again within the hour');
  calls = [];
  await INS.refresh(14, { ...opts, batch: 12, force: true });
  ok(calls.some(u => /\/ig3\/insights/.test(u)), 'unless the owner presses Read again, which asks a refusal at once and first (force)');
  ok(!calls.some(u => /\/ig1\/insights/.test(u)), 'while a number already in hand is not asked for again, even forced');
  let rest = await INS.refresh(14, opts); while (rest.partial) rest = await INS.refresh(14, opts);
  calls = [];
  await INS.refresh(14, { ...opts, batch: 1, now: '2026-09-08T13:30:00Z' });
  ok(calls.some(u => /\/ig3\/insights/.test(u)), 'but it is the first thing asked after the hour, before anything read six hours ago');
  igMode = 'ok';
}

console.log('\nthe permission that is missing');
{
  store.clear(); calls = [];
  igMode = 'noperm';
  const r = await INS.refresh(14, opts);
  ok(r.needs === 'instagram_manage_insights', 'the missing permission is named');
  ok(/IG_TOKEN/.test(r.say) && /instagram_manage_insights/.test(r.say) && /paste/.test(r.say), 'and the owner is told what to generate and where to paste it');
  ok(calls.filter(u => /\/ig\d+\/insights/.test(u)).length === 1, 'the batch stops on the first refusal rather than collecting a hundred');
  ok(!r.partial, 'partial is false, so the console does not loop on a token it cannot fix');
  ok(![...store.keys()].some(k => k.startsWith('nsoc:ins:instagram:')), 'the refusal is not cached: a fixed token reads at once');
  ok([...store.keys()].some(k => k.startsWith('nsoc:ins:youtube:')), 'YouTube, asked first, was still read');
  igMode = 'ok';
  const code200 = await INS.fetchInstagram('x', true, { fetch: async () => ({ ok: false, status: 400, json: async () => ({ error: { code: 200, message: 'Requires instagram_manage_insights permission' } }) }) });
  ok(code200.needs === 'instagram_manage_insights', 'code 200 with the permission in the sentence is the same finding');
  const code190 = await INS.fetchInstagram('x', true, { fetch: async () => ({ ok: false, status: 400, json: async () => ({ error: { code: 190, message: 'Error validating access token' } }) }) });
  ok(!code190.needs && code190.error && code190.code === 190, 'an expired token is an error, not a missing permission');
}

console.log('\nwhen Meta no longer knows a metric name');
{
  store.clear(); calls = [];
  igMode = 'oldnames';
  const v = await INS.fetchInstagram('ig9', true, { now: NOW });
  ok(!v.error && v.reach === 190 && v.views == null && !/views/.test(v.metrics), 'the bare set is asked once more and the answer stands without the missing column');
  ok(calls.filter(u => /\/ig9\/insights/.test(u)).length === 2, 'exactly two calls');
  igMode = 'ok';
}

console.log('\nFacebook and YouTube');
{
  store.delete(INS.K_FBSET); calls = [];
  const f = await INS.fetchFacebook('fb_1', { now: NOW });
  const probes = calls.filter(u => /\/fb_1\/insights\?metric=[a-z_]+$/.test(u)).length;
  ok(probes === INS.FB_CANDIDATES.length, 'the first Facebook read asks Meta about every candidate metric, one at a time: ' + probes);
  ok(f.reach === 55 && f.views === 80 && f.likes === 80 && f.clicks === 80 && f.metrics === 'post_total_media_view_unique,post_media_view,post_clicks,post_reactions_like_total',
     'and reads with exactly the names Meta accepted, unique media views as reach, media views as views: ' + f.metrics);
  const learned = JSON.parse(store.get(INS.K_FBSET));
  ok(learned && learned.set.length === 4, 'the accepted set is remembered');
  calls = [];
  const f2 = await INS.fetchFacebook('fb_2', { now: NOW });
  ok(f2.reach === 55 && calls.length === 1, 'the next post asks once, with the remembered set, and probes nothing');
  store.set(INS.K_FBSET, JSON.stringify({ at: NOW, set: ['post_impressions'] }));
  const f3 = await INS.fetchFacebook('fb_3', { now: NOW });
  ok(f3.error && f3.code === 100 && JSON.parse(store.get(INS.K_FBSET)).set.length === 0, 'a remembered name Meta stops taking is refused once and forgotten, so the next read learns again');
  /* a reel on Facebook is a video node: its own edge, its own names, its own learned set */
  store.delete(INS.K_FBVSET); calls = [];
  const v = await INS.fetchFacebook('1753567922516397', { now: NOW });
  ok(calls.every(u => /video_insights/.test(u)) && !calls.some(u => /\/insights\?/.test(u)), 'a video id (no underscore) is asked under video_insights and never under a post\'s edge');
  ok(v.reach === 300 && v.views === 500 && v.metrics === 'post_total_media_view_unique,blue_reels_play_count,post_video_avg_time_watched', 'and reads unique media views as reach, reel plays as views: ' + v.metrics);
  ok(JSON.parse(store.get(INS.K_FBVSET)).set.length === 3 && JSON.parse(store.get(INS.K_FBSET)).set.length === 0, 'the video set is remembered on its own key, and does not touch the post set');
  store.set(INS.K_FBSET, JSON.stringify({ at: NOW, set: [] }));
  calls = [];
  await INS.fetchFacebook('fb_4', { now: new Date(Date.parse(NOW) + 2 * 3600000).toISOString() });
  ok(calls.filter(u => /\/fb_4\/insights\?metric=[a-z_]+$/.test(u)).length === INS.FB_CANDIDATES.length, 'an empty set is asked about again after an hour, not after a week');
  const y = await INS.fetchYouTube(['yt1', 'yt2'], { now: NOW });
  ok(y.yt1 && y.yt1.views === 900 && y.yt1.likes === 12 && y.yt1.reach === null, 'a Short: views and likes, no reach');
  const none = await INS.fetchYouTube(['zz'], { now: NOW, fetch: async u => /youtube\/v3/.test(String(u)) ? ({ ok: true, status: 200, json: async () => ({ items: [] }) }) : ({ ok: true, status: 200, json: async () => ({ access_token: 'a' }) }) });
  ok(none.zz && /no such video/.test(none.zz.error), 'a video YouTube does not list is an error, not a zero');
}

console.log('\nThreads: media insights, the same shape and the same missing permission stop as Instagram');
{
  calls = []; thMode = 'ok';
  const t = await INS.fetchThreads('th1', { now: NOW });
  ok(!t.error && t.views === 110 && t.reach === null && t.likes === 9 && t.comments === 3 && t.reposts === 2 && t.quotes === 1 && t.shares === 4,
     'views stand in for reach (Threads has none), replies read as comments: ' + JSON.stringify(t));
  ok(calls.length === 1 && calls[0].includes('graph.threads.net/v1.0/th1/insights?metric=views,likes,replies,reposts,quotes,shares'),
     'one call, the six names, no fallback set');
  ok(!calls.some(u => /access_token=/.test(calls[0])), 'no token travels in the query string');

  thMode = 'noperm';
  const tp = await INS.fetchThreads('th2', { now: NOW });
  ok(tp.needs === 'threads_manage_insights', 'a token without the permission is named the same way Instagram\'s is');
  thMode = 'ok';

  /* collect() and refresh() read a Threads id from the slot record exactly
     as they read Instagram's, Facebook's and YouTube's */
  store.clear(); calls = [];
  const thRec = { d: '2026-09-08', s: 'reelA' };
  const thRecords = { [thRec.d + '#' + thRec.s]: { at: NOW, slot: 'reelA', state: 'sent', title: 'One verse about light',
    results: { instagram: { ok: true, id: 'igT1' }, threads: { ok: true, id: 'thT1' } } } };
  const thReadSlot = async (d, s) => thRecords[d + '#' + s] || null;
  const posts = await INS.collect(1, { readSlot: thReadSlot, manifest: MANIFEST, now: thRec.d + 'T12:00:00Z' });
  const p = posts.find(x => x.media.threads);
  ok(p && p.media.threads === 'thT1', 'a Threads id on the record is collected the same way the others are');

  const r = await INS.refresh(1, { readSlot: thReadSlot, manifest: MANIFEST, now: thRec.d + 'T12:00:00Z' });
  ok(r.fetched === 2 && !r.needs, 'both networks on the one post are read');
  const savedTh = JSON.parse(store.get(INS.K_INS('threads', 'thT1')));
  ok(savedTh && savedTh.views === 110, 'the Threads read is cached under nsoc:ins:threads:<id>, the same key shape as the others');

  const agg = INS.aggregate(posts.map(x => ({ ...x, ins: { instagram: { at: NOW, reach: 100, views: 300 }, threads: savedTh } })));
  ok(agg.byNetwork.some(n => n.net === 'threads'), 'Threads takes its own row in "by network"');

  /* the batch stops on a Threads refusal exactly as it does on Instagram's,
     and says what TH_TOKEN needs */
  store.clear(); calls = []; thMode = 'noperm';
  const rp = await INS.refresh(1, { readSlot: thReadSlot, manifest: MANIFEST, now: thRec.d + 'T12:00:00Z' });
  ok(rp.needs === 'threads_manage_insights' && /TH_TOKEN/.test(rp.say) && /threads_manage_insights/.test(rp.say),
     'the owner is told the token needs the permission and where to paste the fresh one: ' + rp.say);
  thMode = 'ok';
}

console.log('\nthe subject fold: read from assets/reel-subjects.json (scripts/graph/derive_reel_subjects.py), never lights/, the dictionary or api/page.js live');
{
  const fsMod = await import('node:fs');
  const SUBJ = JSON.parse(fsMod.readFileSync(new URL('../assets/reel-subjects.json', import.meta.url), 'utf8')).subjects;
  const light = SUBJ['abdurrahman-ibn-awf-market'];
  ok(light && light.group, 'the shipped file carries a Light reel\'s own entry, derived from lights/all.json at build time');
  const sLight = INS.subjectOf('reel:light', { id: 'abdurrahman-ibn-awf-market' });
  ok(sLight && sLight.group === light.group && sLight.label === light.label,
     'subjectOf reads exactly what the shipped file holds for a Light: ' + JSON.stringify(sLight));
  const sVerse = INS.subjectOf('reel:verse', { id: 'verse-2-255' });
  ok(sVerse && sVerse.group === 'surah:2' && /^Surah 2/.test(sVerse.label),
     'a verse reel\'s subject is its surah: ' + JSON.stringify(sVerse));
  const sWord = INS.subjectOf('reel:word', { id: 'word-abu-bakr' });
  ok(sWord && sWord.group === 'word:History' && sWord.label === 'History',
     'a word reel\'s subject is the dictionary\'s own category: ' + JSON.stringify(sWord));
  const sFilm = INS.subjectOf('reel:short', { id: 'short-algebra', room: 'heroes.html#f-mathematics' });
  ok(sFilm && sFilm.group === 'film:mathematics' && sFilm.label === 'Mathematics',
     'a film\'s subject is the field named after its room\'s #f-: ' + JSON.stringify(sFilm));
  ok(INS.subjectOf('reel:name', { id: 'name-ad-darr' }) === null, 'a Name reel is not tied to one of the four rooms, so the file carries no entry and it carries no subject');
  ok(INS.subjectOf('reel:light', { id: 'no-such-light' }) === null, 'an id the file does not carry is no subject, not a guess');
  ok(INS.subjectOf('reel:verse', null) === null, 'no card at all is no subject');
  ok(INS.subjectOf('reel:verse', { room: 'x' }) === null, 'a card with no id at all is no subject either, since the lookup is by id, read once and cached, from a file api/_insights.js never asks lights/, the dictionary or api/page.js for');

  /* the aggregate's own fold: a bucket needs five, the same MIN_BUCKET the
     kinds and hours already keep to; the top ten and bottom five are a
     plain list and carry no floor of their own */
  const mk = (subj, reach, i) => ({ date: '2026-09-0' + (1 + (i % 9)), slot: 's', hour: 8, kind: 'reel:verse', title: 'hook ' + i,
    media: { instagram: 'i' + i }, subject: subj, ins: { instagram: { at: NOW, reach, views: reach * 3 } } });
  const posts = [];
  let i = 0;
  const A = { group: 'surah:2', label: 'Surah 2 (Al-Baqarah)' }, B = { group: 'surah:114', label: 'Surah 114 (An-Nas)' };
  /* ten of A and five of B: fifteen subject-bearing posts, the floor a
     refuter's review set below which "top ten" and "bottom five" would
     overlap (see subjectBottom's own comment in api/_insights.js). At
     exactly fifteen the two lists still meet edge to edge with nothing
     shared, which is the case this fixture proves. */
  for (let k = 0; k < 10; k++) posts.push(mk(A, 3000 + k, i++));
  for (let k = 0; k < 5; k++) posts.push(mk(B, 300 + k, i++));
  posts.push(mk(null, 999, i++));                                     /* no subject: not in the fold at all */
  const agg = INS.aggregate(posts);
  ok(agg.bySubject.length === 2, 'two subject groups, the one post with no subject left out');
  ok(agg.bySubject[0].label === A.label && agg.bySubject[0].n === 10, 'the best subject leads, with its own count');
  ok(agg.subjectTop.length === 10 && agg.subjectTop[0].reach === 3009 && agg.subjectTop[0].subject === A.label,
     'the top ten by reach carries the hook, the reach and the subject\'s own label');
  ok(agg.subjectBottom.length === 5 && agg.subjectBottom[0].reach === 300, 'the bottom five, lowest first');
  ok(!agg.subjectBottom.some(r => r.subject === A.label), 'the bottom five, in this fixture, are all the weaker subject, with no overlap against the top ten');
  ok(agg.sentences.some(s => /Surah 2.*Surah 114/.test(s) && /Surah 2.*×/.test(s)), 'a plain sentence names the two subjects with enough posts: ' + agg.sentences.join(' '));

  /* below fifteen subject-bearing posts, top ten and bottom five would
     share entries; a refuter's review caught this and the fix leaves
     subjectBottom empty rather than repeat the best list as "weakest" */
  const overlap = [];
  let j = 0;
  for (let k = 0; k < 6; k++) overlap.push(mk(A, 3000 + k, j++));
  for (let k = 0; k < 5; k++) overlap.push(mk(B, 300 + k, j++));
  const aggOverlap = INS.aggregate(overlap);
  ok(aggOverlap.subjectTop.length === 10, 'eleven subject-bearing posts still draw a top ten');
  ok(aggOverlap.subjectBottom.length === 0, 'but under fifteen, the bottom five would overlap the top ten, so it is left empty rather than misleading');

  /* a subject bucket under five posts draws no sentence of its own */
  const few = [];
  for (let k = 0; k < 3; k++) few.push(mk(A, 3000 + k, i++));
  const aggFew = INS.aggregate(few);
  ok(aggFew.bySubject.length === 1 && !aggFew.sentences.some(s => /Surah 2/.test(s)), 'three posts make a bucket but no sentence');
}

console.log('\nytStats: a batch of videos.list, statistics and contentDetails together');
{
  const calls2 = [];
  const fx = async (url) => {
    calls2.push(String(url));
    const u = String(url);
    const ids = decodeURIComponent(u.split('id=')[1]).split(',');
    return { ok: true, status: 200, json: async () => ({ items: ids.filter(id => id !== 'gone').map(id =>
      ({ id, statistics: { viewCount: '111', likeCount: '22', commentCount: '3' }, contentDetails: { duration: 'PT1M30S' } })) }) };
  };
  const s = await YT.ytStats(['a', 'b', 'gone'], 'yt-tok', { fetch: fx });
  ok(s.a.viewCount === 111 && s.a.likeCount === 22 && s.a.commentCount === 3 && s.a.duration === 'PT1M30S',
     'statistics and contentDetails both read, numbers not strings: ' + JSON.stringify(s.a));
  ok(s.gone && /no such video/.test(s.gone.error), 'an id YouTube does not list back is an error, not a silent zero');
  ok(calls2.every(u => /part=statistics,contentDetails/.test(u)), 'both parts asked in the one call');
  ok(calls2.every(u => !/authorization|bearer|yt-tok/i.test(u)), 'the token rides in the header, never the url');

  const many = Array.from({ length: 120 }, (_, i) => 'v' + i);
  calls2.length = 0;
  const got = await YT.ytStats(many, 'yt-tok', { fetch: fx });
  ok(calls2.length === 3, 'fifty ids a call, so a hundred and twenty is three calls: ' + calls2.length);
  ok(Object.keys(got).length === 120, 'every id answered');

  const noTok = await YT.ytStats(['x'], '', { fetch: fx });
  ok(noTok.x && /no YouTube token/.test(noTok.x.error), 'no token, no call, an error naming why');
  const nothing = await YT.ytStats([], 'yt-tok', { fetch: fx });
  ok(Object.keys(nothing).length === 0, 'no ids, nothing asked');
  const failing = await YT.ytStats(['a'], 'yt-tok', { fetch: async () => { throw new Error('offline'); } });
  ok(failing.a && /offline/.test(failing.a.error), 'a network failure is an error on the id, never thrown');
}

console.log('\nthe snapshot: one photograph a day, per network, per record, Short and wide both');
{
  store.clear(); calls = [];
  const SDATE = '2026-09-08';
  const srec = { at: SDATE + 'T08:02:00Z', slot: 'reelA', date: SDATE, title: 'One verse about light', state: 'sent',
    results: { instagram: { ok: true, id: 'igS1' }, facebook: { ok: true, id: 'fbS_1' },
               youtube: { ok: true, id: 'ytS1', wide: { id: 'ytS1wide' } } } };
  const readOne = async (d, s) => (d === SDATE && s === 'reelA') ? srec : null;

  const r = await INS.snapshot({ readSlot: readOne, manifest: MANIFEST, now: SDATE + 'T12:00:00Z', ytToken: 'ss-yt-tok' });
  ok(r.ok && r.written === 1 && r.skipped === 0, 'one record with something to say gets one write: ' + JSON.stringify(r));
  const saved = JSON.parse(store.get(INS.K_STATS(SDATE, 'reelA')));
  ok(saved && saved.kind === 'reel:verse' && saved.hour === 8 && saved.reel === true, 'the record is named by the hook on the shelf, with its hour, the same as collect()');
  ok(saved.stats.instagram && saved.stats.facebook && saved.stats.youtube && saved.stats.youtubeWide,
     'a row for every id the record had, including the wide upload beside the Short: ' + Object.keys(saved.stats).join(','));
  ok(saved.stats.instagram.views === 330 && saved.stats.instagram.reach === 110 && saved.stats.instagram.watch === 4200,
     'instagram\'s row is fetchInstagram\'s own answer, folded to the one shape: ' + JSON.stringify(saved.stats.instagram));
  ok(saved.stats.facebook.views === 80 && saved.stats.facebook.reach === 55, 'facebook\'s row, the same fold');
  ok(saved.stats.youtube.views === 900 && saved.stats.youtube.likes === 12 && saved.stats.youtube.reach === null,
     'the Short\'s own row, from ytStats, no reach (YouTube gives none)');
  ok(saved.stats.youtubeWide.views === 900, 'and the wide upload beside it gets its own row, the same shape');
  ok(!JSON.stringify(saved).match(/ss-yt-tok|igtok|pagetok/), 'no token travels into what gets written to the store');

  const again = await INS.snapshot({ readSlot: readOne, manifest: MANIFEST, now: SDATE + 'T18:00:00Z', ytToken: 'ss-yt-tok' });
  ok(again.written === 0 && again.skipped === 1, 'the same day is not asked twice: idempotent');
  const forced = await INS.snapshot({ readSlot: readOne, manifest: MANIFEST, now: SDATE + 'T18:00:00Z', ytToken: 'ss-yt-tok', force: true });
  ok(forced.written === 1, 'unless the owner\'s Refresh asks for it again');

  const nextDay = await INS.snapshot({ readSlot: readOne, manifest: MANIFEST, now: '2026-09-09T08:00:00Z', ytToken: 'ss-yt-tok' });
  ok(nextDay.written === 1, 'a new day takes a new photograph even without force');
}

console.log('\nthe walk is bounded: a day count first, then a clock');
{
  store.clear(); calls = [];
  const big = await INS.snapshot({ readSlot: async () => null, now: NOW, days: 999 });
  ok(big.slots === 30 * SLOT_IDS.length, 'a day count past the ceiling is clamped to thirty, as many as a snapshot is kept: ' + big.slots);
  const def = await INS.snapshot({ readSlot: async () => null, now: NOW });
  ok(def.slots === 14 * SLOT_IDS.length, 'and the ordinary walk is a fortnight, every slot a day: ' + def.slots);
  const stopped = await INS.snapshot({ readSlot: opts.readSlot, manifest: MANIFEST, now: NOW, budgetMs: -1 });
  ok(stopped.partial === true && stopped.walked === 0 && stopped.written === 0,
     'a budget already spent stops the walk before a single network is asked, and says so: ' + JSON.stringify(stopped));
}

console.log('\nthe numbers: two weeks side by side, from the snapshots alone, no network call');
{
  store.clear(); calls = [];
  const dates = INS.datesBack(14, new Date(NOW));
  const put = (i, slot, kind, title, stats) => store.set(INS.K_STATS(dates[i], slot),
    JSON.stringify({ date: dates[i], slot, hour: INS.hourOf(slot), kind, reel: /^reel/.test(slot), title, at: NOW, stats }));
  /* this week: dates[0..4] */
  put(0, 'reelA', 'reel:verse', 'Light on the heart', { instagram: { views: 1000, reach: 500, likes: 40, comments: 10, shares: 0, saves: 0, at: NOW } });
  put(1, 'reelC', 'reel:verse', 'The straight path', { instagram: { views: 800, reach: 400, likes: 20, comments: 5, shares: 0, saves: 0, at: NOW } });
  put(2, 'reelD', 'reel:word', 'Sabr', { instagram: { views: 600, reach: 300, likes: 54, comments: 6, shares: 0, saves: 0, at: NOW } });
  put(3, 'light', 'card:light', "Today's light", { facebook: { views: 200, reach: 150, likes: 10, comments: 2, shares: 1, saves: 0, at: NOW } });
  put(4, 'reelE', 'reel:short', 'The sieve of al-Khwarizmi', {
    youtube: { views: 4000, reach: null, likes: 180, comments: 20, shares: 0, saves: 0, at: NOW },
    youtubeWide: { views: 1000, reach: null, likes: 40, comments: 10, shares: 0, saves: 0, at: NOW }
  });
  /* last week: dates[7..9], seven days behind the first three of this week, same weekdays */
  put(7, 'reelA', 'reel:verse', 'Light on the heart, a fortnight back', { instagram: { views: 500, reach: 250, likes: 10, comments: 2, shares: 0, saves: 0, at: NOW } });
  put(8, 'reelC', 'reel:verse', 'The straight path, a fortnight back', { instagram: { views: 400, reach: 200, likes: 5, comments: 1, shares: 0, saves: 0, at: NOW } });
  put(9, 'reelD', 'reel:word', 'Sabr, a fortnight back', { instagram: { views: 300, reach: 150, likes: 5, comments: 0, shares: 0, saves: 0, at: NOW } });

  const n = await INS.numbers({ now: NOW });
  ok(calls.length === 0, 'numbers() asks the store, never a network');
  const rate = (eng, base) => Math.round((eng / base) * 1000) / 1000;

  ok(n.ok && n.thisWeek.to === dates[0] && n.thisWeek.from === dates[6] && n.lastWeek.to === dates[7] && n.lastWeek.from === dates[13],
     'the two windows are named by their own dates: ' + JSON.stringify([n.thisWeek, n.lastWeek]));
  ok(n.read === 9 && n.unread === 14 * SLOT_IDS.length - 8, 'nine readings across eight records; the rest of the fortnight is simply unread');

  const ig = n.byNetwork.find(x => x.net === 'instagram');
  ok(ig.thisWeek.posts === 3 && ig.thisWeek.views === 2400 && ig.thisWeek.reach === 1200, 'instagram this week: three readings, summed views and reach');
  ok(ig.thisWeek.engagement === rate(50 + 25 + 60, 500 + 400 + 300), 'and the engagement rate is the bucket\'s own engagement over its own reach: ' + ig.thisWeek.engagement);
  ok(ig.lastWeek.posts === 3 && ig.lastWeek.engagement === rate(12 + 6 + 5, 250 + 200 + 150), 'instagram last week, the same arithmetic');
  ok(ig.delta.views === 2400 - (500 + 400 + 300), 'the delta is this week minus last: ' + ig.delta.views);

  const yt = n.byNetwork.find(x => x.net === 'youtube'), fb = n.byNetwork.find(x => x.net === 'facebook');
  ok(yt.thisWeek.posts === 1 && yt.thisWeek.views === 5000 && yt.thisWeek.reach === null,
     'the wide upload beside the Short is the same post as its Short: one post, views summed, still no reach');
  ok(fb.thisWeek.posts === 1 && fb.lastWeek.posts === 0, 'facebook only posted this week; last week reads as nothing, not an error');

  ok(!n.byKind.some(k => k.kind === 'card:light'), 'a card kind never enters "per kind": the rota does not choose a card the way it chooses a reel');
  const verse = n.byKind.find(k => k.kind === 'reel:verse'), word = n.byKind.find(k => k.kind === 'reel:word'), short = n.byKind.find(k => k.kind === 'reel:short');
  ok(verse.thisWeek.engagement === rate(50 + 25, 500 + 400) && verse.label === 'verse reels', 'verse reels: two readings folded into one rate');
  ok(word.thisWeek.engagement === rate(60, 300), 'word reels, their own rate');
  ok(short.thisWeek.engagement === rate(200, 4000 + 1000) && short.label === 'silent films',
     'the silent films count once, likes from the Short, views from both: ' + short.thisWeek.engagement);
  ok(n.best.kind === 'reel:word', 'the best kind by engagement this week: ' + n.best.kind);
  ok(n.worst.kind === 'reel:short', 'and the worst: ' + n.worst.kind);

  ok(n.films.length === 1 && n.films[0].title === 'The sieve of al-Khwarizmi' && n.films[0].week === 'this', 'the one silent film so far, named, once any exist');
  ok(n.films[0].stats.youtube.views === 4000 && n.films[0].stats.youtubeWide.views === 1000, 'the film\'s own numbers travel whole, Short and wide both');

  const wd0 = new Date(dates[0] + 'T00:00:00Z').getUTCDay();
  const wdThis = n.byWeekday.find(w => w.weekday === wd0);
  ok(wdThis.thisWeek.posts === 1 && wdThis.thisWeek.views === 1000, 'the weekday of the first record carries just its own reading this week');
  ok(wdThis.lastWeek.posts === 1 && wdThis.lastWeek.views === 500, 'dates[0] and dates[7] are seven days apart, so they share a weekday, and the pairing finds it');

  const slotA = n.bySlot.find(x => x.slot === 'reelA');
  ok(slotA && slotA.hour === 8 && slotA.thisWeek.posts === 1, 'per slot hour, reelA carries its own hour and its own reading');

  ok(!/igtok|pagetok|ss-yt-tok|yt-access/.test(JSON.stringify(n)), 'no token or secret name leaks into the aggregate');
}

console.log('\nkind at read time: a stored "reel:reel" (the shelf could not be read the day it was written) is asked again here, not trusted forever (2026-09-24, a live run: warm.js\'s own manifest fetch answered nothing one night, and every reel that day stayed "reel:reel" in the store from then on)');
{
  store.clear(); calls = [];
  const dates2 = INS.datesBack(14, new Date(NOW));
  const put2 = (i, slot, kind, title, stats) => store.set(INS.K_STATS(dates2[i], slot),
    JSON.stringify({ date: dates2[i], slot, hour: INS.hourOf(slot), kind, reel: /^reel/.test(slot), title, at: NOW, stats }));
  /* written the night the shelf could not be read: every reel that day
     landed under the catch-all, even though its own title is right there
     on the shelf MANIFEST already names throughout this file */
  put2(0, 'reelA', 'reel:reel', 'One verse about light', { instagram: { views: 1000, reach: 500, likes: 40, comments: 10, shares: 0, saves: 0, at: NOW } });
  put2(1, 'reelC', 'reel:reel', 'The word for patience', { instagram: { views: 800, reach: 400, likes: 20, comments: 5, shares: 0, saves: 0, at: NOW } });

  const n2 = await INS.numbers({ manifest: MANIFEST, now: NOW });
  const verse2 = n2.byKind.find(k => k.kind === 'reel:verse');
  ok(verse2 && verse2.thisWeek.posts === 1 && verse2.label === 'verse reels', 'a stored "reel:reel" whose title matches a shelf hook is counted under its real kind: ' + JSON.stringify(verse2));
  const word2 = n2.byKind.find(k => k.kind === 'reel:word');
  ok(word2 && word2.thisWeek.posts === 1, 'a second one, the same read');
  ok(!n2.byKind.some(k => k.kind === 'reel:reel'), 'neither stays under the catch-all once the shelf can name it');

  /* a title even a real shelf cannot name (no hook match, no manifest at
     all to fall back on) is the only case that honestly stays "reel:reel",
     and it is labelled in plain words, never the raw id */
  ok(INS.reclassifyKind({ kind: 'reel:reel', slot: 'reelA', title: 'One verse about light' }, MANIFEST) === 'reel:verse',
     'reclassifyKind reads the shelf directly, the same fold numbers() uses');
  ok(INS.reclassifyKind({ kind: 'reel:verse', slot: 'reelA', title: 'anything at all' }, MANIFEST) === 'reel:verse',
     'a kind already known is never second-guessed by the shelf');
  ok(INS.reclassifyKind({ kind: 'reel:reel', slot: 'reelA', title: 'no hook anywhere' }, { cards: [] }) === 'reel:reel',
     'with no shelf at all to ask, the catch-all stays honest rather than guessing');
  ok(INS.kindLabel('reel:reel') === 'reels whose kind could not be matched', 'and it is never shown as the raw internal id');
  ok(INS.reclassifyKind({ slot: 'word' }, MANIFEST) === 'reel:reel', 'a card slot with no kind at all falls back honestly, never invented');
}

console.log('\nthe shelf, read locally: reels/index.json beside this file, no network call, an HTTP fetch only as the very last resort');
{
  const local = INS.localManifest();
  ok(local && Array.isArray(local.cards) && local.cards.length > 0, 'the real reels/index.json is read straight off disk: ' + (local ? local.cards.length : 0) + ' cards');
  let fetched = false;
  const shelf = await INS.shelfManifest({ base: 'https://example.test', fetch: async () => { fetched = true; return { ok: true, json: async () => ({ cards: [] }) }; } });
  ok(shelf === local && fetched === false, 'the local file answers first; the HTTP fallback is never even called while it is there');
}

console.log('\nthe deploy gap: subjectOf works from a copy of the tree that has no lights/, scripts/ or tools/ at all');
{
  /* A refuter's review found the first version of the subject fold read
     lights/all.json, assets/dict-index.json and tools/reels/quran-uthmani.json
     live, through api/page.js -- and none of api/insights.js, api/house.js or
     api/warm.js carried those paths in vercel.json's includeFiles, so on
     Vercel the fold would have shipped silently empty. This proves the fix
     rather than asserting it: a copy of ONLY what actually deploys (api/,
     for the code, plus the one small assets/reel-subjects.json the derive
     step writes, nothing else) still resolves a Light, a word, a verse
     (with its surah name) and a film, with lights/, scripts/ and tools/
     entirely absent from the copy, not merely unread. */
  const fsMod = await import('node:fs');
  const osMod = await import('node:os');
  const pathMod = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const REPO = pathMod.dirname(pathMod.dirname(fileURLToPath(import.meta.url)));
  const DEPLOY = fsMod.mkdtempSync(pathMod.join(osMod.tmpdir(), 'noor-deploy-'));
  fsMod.cpSync(pathMod.join(REPO, 'api'), pathMod.join(DEPLOY, 'api'), { recursive: true });
  fsMod.mkdirSync(pathMod.join(DEPLOY, 'assets'));
  fsMod.cpSync(pathMod.join(REPO, 'assets', 'reel-subjects.json'), pathMod.join(DEPLOY, 'assets', 'reel-subjects.json'));
  ok(!fsMod.existsSync(pathMod.join(DEPLOY, 'lights')) && !fsMod.existsSync(pathMod.join(DEPLOY, 'scripts')) && !fsMod.existsSync(pathMod.join(DEPLOY, 'tools')),
     'the copy carries no lights/, scripts/ or tools/ directory at all, the same as the deployed function');

  const script = `
    process.chdir(${JSON.stringify(DEPLOY)});
    process.env.FB_PAGE_ID = '123'; process.env.FB_PAGE_TOKEN = 'tok';
    process.env.IG_USER_ID = '456'; process.env.IG_TOKEN = 'igtok';
    process.env.TH_TOKEN = 'thtok';
    const INS = await import(${JSON.stringify(pathMod.join(DEPLOY, 'api', '_insights.js'))});
    const out = {
      light: INS.subjectOf('reel:light', { id: 'abdurrahman-ibn-awf-market' }),
      word: INS.subjectOf('reel:word', { id: 'word-abu-bakr' }),
      verse: INS.subjectOf('reel:verse', { id: 'verse-2-255' }),
      film: INS.subjectOf('reel:short', { id: 'short-algebra', room: 'heroes.html#f-mathematics' })
    };
    process.stdout.write(JSON.stringify(out));
  `;
  const scriptFile = pathMod.join(DEPLOY, 'run.mjs');
  fsMod.writeFileSync(scriptFile, script);
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [scriptFile], { cwd: DEPLOY, encoding: 'utf8' });
  ok(r.status === 0, 'the copy runs clean with no lights/, scripts/ or tools/ on disk: ' + (r.stderr || '').slice(-400));
  let out = {};
  try { out = JSON.parse(r.stdout || '{}'); } catch { }
  ok(out.light && out.light.group === 'light:trades' && out.light.label === 'Trades', 'a Light still resolves: ' + JSON.stringify(out.light));
  ok(out.word && out.word.group === 'word:History' && out.word.label === 'History', 'a word still resolves: ' + JSON.stringify(out.word));
  ok(out.verse && out.verse.group === 'surah:2' && out.verse.label === 'Surah 2 (Al-Baqarah)', 'a verse still resolves, with its surah name: ' + JSON.stringify(out.verse));
  ok(out.film && out.film.group === 'film:mathematics' && out.film.label === 'Mathematics', 'a film still resolves: ' + JSON.stringify(out.film));
  fsMod.rmSync(DEPLOY, { recursive: true, force: true });
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
