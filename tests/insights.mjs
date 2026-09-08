/* NOOR · what strangers watch, with the networks stubbed.
   ------------------------------------------------------------------
   The arithmetic on fixed records: medians by kind, by hour, by network,
   the top ten, and sentences that appear only when a bucket holds five.
   The cache: a second call within six hours asks Meta nothing. The batch
   cap and `partial`. A token without instagram_manage_insights is named,
   and one media that Meta refuses does not stop the rest.

   Meta and Google are stubbed. This repository has no credentials.

   Run:  node tests/insights.mjs
*/
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

process.env.FB_PAGE_ID = '123'; process.env.FB_PAGE_TOKEN = 'tok';
process.env.IG_USER_ID = '456'; process.env.IG_TOKEN = 'igtok';
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
const igAnswer = (id, metrics) => {
  const base = 100 + (parseInt(id.replace(/\D/g, ''), 10) || 0) * 10;
  const data = metrics.split(',').map(name => ({ name, period: 'lifetime', values: [{ value:
    name === 'reach' ? base : name === 'views' ? base * 3 : name === 'ig_reels_avg_watch_time' ? 4200 : 7 }] }));
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
  const m = u.match(/\/v21\.0\/([^/]+)\/insights\?metric=(.+)$/);
  if (m) {
    const id = m[1], metrics = m[2];
    if (id.startsWith('fb')) return J({ data: metrics.split(',').map(name => ({ name, values: [{ value: name === 'post_total_media_view_unique' ? 55 : 80 }] })) });
    if (igMode === 'noperm') return J({ error: { message: '(#10) Application does not have permission for this action', code: 10 } }, 400);
    if (igMode === 'refuse:' + id) return J({ error: { message: 'Unsupported get request. Object with ID does not exist', code: 100, error_subcode: 33 } }, 400);
    if (igMode === 'oldnames' && /views/.test(metrics)) return J({ error: { message: '(#100) metric[0] must be one of the following values: reach, likes...', code: 100 } }, 400);
    return J(igAnswer(id, metrics));
  }
  return J({ error: { message: 'unexpected ' + u } }, 400);
};

const INS = await import('../api/_insights.js');

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
  const results = { instagram: { ok: true, id: 'ig' + n }, facebook: { ok: true, id: 'fb' + n } };
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
  const ig = calls.filter(u => /\/ig\d+\/insights/.test(u)), fb = calls.filter(u => /\/fb\d+\/insights/.test(u)), yt = calls.filter(u => /youtube\/v3\/videos/.test(u));
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
  const f = await INS.fetchFacebook('fb1', { now: NOW });
  ok(f.reach === 55 && f.views === 80 && f.likes === 80 && /post_total_media_view_unique/.test(f.metrics), 'a Facebook post: unique media views as reach, impressions as views');
  const y = await INS.fetchYouTube(['yt1', 'yt2'], { now: NOW });
  ok(y.yt1 && y.yt1.views === 900 && y.yt1.likes === 12 && y.yt1.reach === null, 'a Short: views and likes, no reach');
  const none = await INS.fetchYouTube(['zz'], { now: NOW, fetch: async u => /youtube\/v3/.test(String(u)) ? ({ ok: true, status: 200, json: async () => ({ items: [] }) }) : ({ ok: true, status: 200, json: async () => ({ access_token: 'a' }) }) });
  ok(none.zz && /no such video/.test(none.zz.error), 'a video YouTube does not list is an error, not a zero');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
