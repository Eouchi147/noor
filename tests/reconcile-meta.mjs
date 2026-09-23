/* NOOR · the duplicate check on Instagram, Facebook and Threads.
   ------------------------------------------------------------------
   YouTube gives every video a title; these three carry only the caption the
   poster wrote. api/_reconcile.js names a post by the caption's opening
   words, and pairs a record with a post when Instagram recorded the id of
   the upload container instead of the post's own. Every caption below is a
   literal, as the network would hold it, never computed by the code under
   test (the lesson tests/reconcile.mjs records).

   Run:  node tests/reconcile-meta.mjs
*/
import * as R from '../api/_reconcile.js';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const CARDS = [
  { id: 'know-zakat', kind: 'know', hook: 'Zakat is growth', caption: 'The word for alms in Arabic means growth, not deduction. Giving is how wealth is cleaned and made to grow.', video: 'https://x/z.mp4' },
  { id: 'verse-94-5', kind: 'verse', hook: 'With hardship comes ease', caption: 'Twice in two lines the Qur’an promises it: with hardship comes ease, not after it but with it.', video: 'https://x/v.mp4' }
];
const IG = R.titleIndex(CARDS, 'instagram');
const hit = (net, text) => (R.titleIndex(CARDS, net).get(R.captionKey(text)) || []).map(e => e.reel);
const inv = (id, title, at) => ({ id, title, at, atFull: at + 'T10:00:00Z', url: 'https://x/' + id });
const led = (reel, id, at) => ({ reel, id, at, slot: 'reelA', shape: 'short' });

console.log('\nnaming a post by its caption');
{
  ok(R.captionKey('Hello, WORLD! #tag https://x.y/z  and   more') === 'hello world and more', 'links, tags, punctuation and case are set aside');
  const posted = 'The word for alms in Arabic means growth, not deduction. Giving is how wealth is cleaned and made to grow.\n\nSource: Qur’an 9:103\n\nnoorcodex.com/light/zakat\n\n#Islam #Zakat';
  ok(hit('instagram', posted).join() === 'know-zakat', 'an Instagram caption as posted, source, link and tags included, names its reel');
  ok(hit('facebook', posted).join() === 'know-zakat', 'and so does the same text on Facebook');
  const trimmed = 'The word for alms in Arabic means growth, not deduction. Giving is how wealth is cleaned…';
  ok(hit('instagram', trimmed).join() === 'know-zakat', 'a caption the network cut short is still named: the opening survives every cut');
  ok(!hit('instagram', 'Something the owner posted by hand').length, 'a post of the owner’s own is named by nothing');
}

console.log('\none send under two ids');
{
  const run = (inventory, ledger, network = 'instagram') => R.compare({ inventory, ledger, index: R.titleIndex(CARDS, network), cards: CARDS, network });
  const container = run([inv('POST1', 'The word for alms in Arabic means growth, not deduction. Giving is how wealth is cleaned', '2026-09-10')],
                        [led('know-zakat', 'CONTAINER1', '2026-09-10')]);
  ok(!container.absent.length && !container.unrecorded.length && container.clean === true,
     'a record holding the upload container’s id and a post holding its own are one send: not absent, not unrecorded');
  const twice = run([inv('P1', 'The word for alms in Arabic means growth, not deduction. Giving is', '2026-09-10'),
                     inv('P2', 'The word for alms in Arabic means growth, not deduction. Giving is', '2026-09-20')],
                    [led('know-zakat', 'C1', '2026-09-10')]);
  ok(twice.twice.length === 1 && twice.twice[0].copies.find(c => c.keep).id === 'P1', 'but a second post of the same reel is still a duplicate, the older one kept');
  const yt = R.compare({ inventory: [inv('V1', 'Zakat is growth #Shorts', '2026-09-10')], ledger: [led('know-zakat', 'GONE', '2026-09-10')],
                         index: R.titleIndex(CARDS, 'youtube'), cards: CARDS, network: 'youtube' });
  ok(yt.absent.length === 1 && yt.unrecorded.length === 1, 'never on YouTube, whose ids are exact: there the same shape is a real fault and is reported');
}

console.log('\nwalking the Graph');
{
  const page = (data, next) => ({ ok: true, status: 200, json: async () => ({ data, paging: next ? { next } : {} }) });
  const calls = [];
  const two = await R.igInventory({ ig: { id: '17841', tok: 'IGQ', base: 'https://graph.instagram.com/v21.0' }, fetch: async (u, o) => {
    calls.push({ u, auth: o.headers.authorization });
    return /after=2/.test(u) ? page([{ id: 'm3', caption: 'c', timestamp: '2026-09-03T08:00:00+0000', permalink: 'https://instagram.com/p/3' }])
                             : page([{ id: 'm1', caption: 'a', timestamp: '2026-09-01T08:00:00+0000' }, { id: 'm2', caption: 'b', timestamp: '2026-09-02T08:00:00+0000' }], 'https://graph.instagram.com/v21.0/17841/media?after=2');
  } });
  ok(two.ok && two.complete && two.items.map(i => i.id).join() === 'm1,m2,m3' && two.pages === 2, 'it follows paging.next to the end');
  ok(/graph\.instagram\.com\/v21\.0\/17841\/media\?fields=id,caption,timestamp,permalink/.test(calls[0].u) && calls[0].auth === 'Bearer IGQ', 'the account’s own media list, with the token it posts with');
  ok(two.items[2].at === '2026-09-03' && two.items[2].url === 'https://instagram.com/p/3', 'each post keeps its day and its link');
  const dup = await R.fbInventory({ fb: { id: 'PAGE', tok: 'T' }, fetch: async (u) => /after/.test(u) ? page([{ id: 'v2', description: 'b', created_time: '2026-09-02T00:00:00+0000' }, { id: 'v1', description: 'a' }])
      : page([{ id: 'v1', description: 'a', created_time: '2026-09-01T00:00:00+0000', permalink_url: '/reel/1' }], 'https://graph.facebook.com/v21.0/PAGE/video_reels?after=1') });
  ok(dup.items.length === 2 && dup.repeats === 1 && dup.items[0].url === 'https://www.facebook.com/reel/1', 'a reel handed back twice is one reel, and a relative permalink is made whole');
  const loop = await R.thInventory({ th: { tok: 'TH' }, fetch: async () => page([{ id: 't1', text: 'x', timestamp: '2026-09-01T00:00:00+0000' }], 'https://graph.threads.net/v1.0/me/threads?after=same') });
  ok(loop.complete === false && /already given/.test(loop.why) && loop.items.length === 1, 'a page handed back twice stops the walk as unfinished');
  const refused = await R.igInventory({ ig: { id: '1', tok: 't' }, fetch: async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'Invalid OAuth access token' } }) }) });
  ok(refused.ok === false && refused.enumerable === false && /Invalid OAuth/.test(refused.why), 'a refused first page is "not checked", in Meta’s own words, never an empty account');
  ok((await R.fbInventory({})).why.includes('FB_PAGE_ID'), 'an unconnected network says which setting is missing');
  ok(['instagram', 'facebook', 'threads'].every(n => R.NETWORKS[n].enumerable && typeof R.NETWORKS[n].inventory === 'function'), 'all three can now be asked');
}

console.log('\nround one of the refuter');
{
  const page = (data, next) => ({ ok: true, status: 200, json: async () => ({ data, paging: next ? { next } : {} }) });
  /* before 9 September the cards were ordinary posts on the grid, and a word
     card opens with the same words as that word's reel */
  const ig = await R.igInventory({ ig: { id: '1', tok: 't' }, fetch: async () => page([
    { id: 'card', caption: "'Aqd\n\n\u0639\u064e\u0642\u0652\u062f\n\nA contract: a binding agreement", media_product_type: 'FEED', timestamp: '2026-09-01T00:00:00+0000' },
    { id: 'reel', caption: "'Aqd (\u0639\u064e\u0642\u0652\u062f). A contract: a binding agreement", media_product_type: 'REELS', timestamp: '2026-09-12T00:00:00+0000' }]) });
  ok(ig.items.map(i => i.id).join() === 'reel', 'an old card post on the grid is not read as a reel: only REELS are ours to judge on Instagram');
  const th = await R.thInventory({ th: { tok: 't' }, fetch: async (u) => { ok(/media_type/.test(u), 'Threads is asked for each post\'s media type'); return page([
    { id: 'text', text: 'x', media_type: 'TEXT_POST' }, { id: 'pic', text: 'x', media_type: 'IMAGE' }, { id: 'vid', text: 'x', media_type: 'VIDEO' }]); } });
  ok(th.items.map(i => i.id).join() === 'vid', 'and only videos on Threads, for the same reason');
  const run = (inventory, ledger, network) => R.compare({ inventory, ledger, index: R.titleIndex(CARDS, network), cards: CARDS, network });
  const cap = 'The word for alms in Arabic means growth, not deduction. Giving is how wealth is cleaned';
  const far = run([inv('P2', cap, '2026-09-20')], [led('know-zakat', 'REMOVED', '2026-06-01')], 'instagram');
  ok(far.absent.length === 1 && far.unrecorded.length === 1 && far.clean === false,
     'a record from June and a post from September are two sends, a removed one and an unrecorded resend, and both are reported');
  const fb = run([inv('P2', cap, '2026-09-10')], [led('know-zakat', 'OTHER', '2026-09-10')], 'facebook');
  ok(fb.absent.length === 1 && fb.unrecorded.length === 1, 'Facebook\'s ids are exact, so it is never paired there either');
  const near = run([inv('P1', cap, '2026-09-11')], [led('know-zakat', 'C1', '2026-09-10')], 'threads');
  ok(!near.absent.length && !near.unrecorded.length, 'while a Threads record a day from its post is the same send, as Threads keeps container ids too');
  ok(R.captionKey('\u0628\u0650\u0633\u0652\u0645\u0650 \u0671\u0644\u0644\u0651\u064e\u0647\u0650') === '\u0628\u0633\u0645 \u0671\u0644\u0644\u0647', 'Arabic is keyed by its letters, its vowel marks set aside rather than splitting every word');
  const meta = run([inv('P1', cap, '2026-09-10')], [led('know-zakat', 'P1', '2026-09-10')], 'instagram');
  ok(meta.caveats.some(c => /no upload status/.test(c)), 'and a clean verdict on these networks says it could not see an upload rejected after an ok');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
