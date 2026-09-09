/* NOOR · One Verse, the podcast feed.
   ------------------------------------------------------------------
   /podcast.xml is the verse reels off the shelf as RSS 2.0 with the itunes
   namespace. What is held here, with the shelf stubbed:

     the document is well-formed XML with the two namespaces and the title;
     one item per VERSE reel, none for the other kinds, newest first;
     each item: "<ref> · <hook>", the caption, an https enclosure of type
       video/mp4 with a length only when the row carries bytes, the id as
       guid, a pubDate, itunes:duration only when the row carries secs;
     nothing the library did not write, and nothing XML cannot carry;
     cached a day; a shelf that cannot be read is 502, not an empty feed.

   Run:  node tests/podcast.mjs
*/
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const R = await import('../api/_reels.js');
const P = await import('../api/podcast.js');

const REL = k => 'https://github.com/Eouchi147/noor/releases/download/reels-' + k + '/';
const MANIFEST = { n: 5, written: '2026-09-09', cards: [
  { id: 'verse-94-5-6', kind: 'verse', slot: 'morning', hook: 'Al-Sharh · 94:5-6', caption: 'Al-Sharh · 94:5-6\n\nFor indeed, with hardship will be ease.\n\nRecited by a reciter & named. noorcodex.com/quran', secs: 14, reciter: 'Mishary Rashid Alafasy', video: REL('verse') + 'verse-94-5-6.mp4', cover: true, bytes: 8123456, uploaded: '2026-09-07' },
  { id: 'word-12', kind: 'word', slot: 'noon', hook: 'Sabr', caption: 'Patience.', secs: 13, video: REL('word') + 'word-12.mp4' },
  { id: 'verse-2-255', kind: 'verse', slot: 'evening', hook: 'Al-Baqarah · 2:255', caption: 'The Throne verse.', secs: 61, reciter: 'A reciter', video: REL('verse') + 'verse-2-255.mp4', cover: REL('verse') + 'verse-2-255-cover.jpg', bytes: 30000000, uploaded: '2026-09-08' },
  { id: 'verse-1-1', kind: 'verse', slot: 'morning', hook: 'Al-Fatihah · 1:1', caption: 'In the name of God <the Most Merciful>.', reciter: 'A reciter', video: REL('verse') + 'verse-1-1.mp4', uploaded: '2026-09-01' },
  { id: 'know-3', kind: 'know', slot: 'noon', hook: 'Did you know', caption: 'x', video: REL('know') + 'know-3.mp4' }
] };

let manifestDown = false, reads = 0;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.endsWith('/reels/index.json')) { reads++; if (manifestDown) throw new Error('down'); return { ok: true, status: 200, json: async () => MANIFEST }; }
  throw new Error('unexpected fetch ' + u);
};
function res() { const r = { code: 0, headers: {}, body: '' }; r.status = c => { r.code = c; return r; }; r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = String(v); }; r.send = b => { r.body = String(b); return r; }; r.json = o => { r.body = JSON.stringify(o); return r; }; return r; }
const call = async () => { const r = res(); await P.default({ method: 'GET', query: {}, headers: { host: 'noorcodex.com' } }, r); return r; };

/* a small, strict-enough XML check: every open tag closes in order, and the
   text between them carries no bare ampersand or angle bracket */
function wellFormed(xml) {
  const body = xml.replace(/^<\?xml[^>]*\?>\s*/, '');
  const stack = [];
  const re = /<(\/?)([\w:-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(body))) {
    if (m[5] != null) { if (/&(?!(amp|lt|gt|quot|#39|#\d+);)/.test(m[5]) || /[<>]/.test(m[5])) return 'bad text: ' + m[5].slice(0, 40); continue; }
    if (m[4]) continue;                      /* self-closing */
    if (m[1]) { if (stack.pop() !== m[2]) return 'mismatch at ' + m[2]; }
    else stack.push(m[2]);
  }
  return stack.length ? 'unclosed ' + stack.join(',') : '';
}

console.log('\nthe feed');
{
  R.forgetManifest();
  const r = await call();
  ok(r.code === 200, 'answers 200');
  ok(/^application\/rss\+xml/.test(r.headers['content-type']), 'as RSS');
  ok(r.headers['cache-control'] === 'public, max-age=86400, stale-while-revalidate=86400', 'cached a day');
  const xml = r.body;
  const wf = wellFormed(xml);
  ok(wf === '', 'the document is well-formed XML' + (wf ? ': ' + wf : ''));
  ok(/^<\?xml version="1\.0" encoding="UTF-8"\?>/.test(xml), 'with the XML declaration');
  ok(/<rss version="2\.0"[^>]*xmlns:itunes="http:\/\/www\.itunes\.com\/dtds\/podcast-1\.0\.dtd"/.test(xml), 'RSS 2.0 with the itunes namespace');
  ok(/<channel><title>One Verse · NOOR Codex of Light<\/title>/.test(xml), 'titled One Verse · NOOR Codex of Light');
  ok(/<atom:link href="https:\/\/noorcodex\.com\/podcast\.xml" rel="self"/.test(xml), 'and names its own address');
  ok(/<description>One verse of the Qur&#39;an, recited and nothing else, with its meaning\./.test(xml), 'and says what it is: one verse, recited, with its meaning');
  ok(/<itunes:image href="https:\/\/noorcodex\.com\/assets\/brand\/mark-512\.png"\/>/.test(xml), 'the channel picture is the largest square the site has');
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  ok(items.length === 3, 'three items: one per verse reel, none for the word or the Did you know: ' + items.length);
  const guids = items.map(i => (i.match(/<guid isPermaLink="false">([^<]+)<\/guid>/) || [])[1]);
  ok(guids.join() === 'verse-2-255,verse-94-5-6,verse-1-1', 'newest first by the rows\' uploaded date: ' + guids.join(' > '));
  const first = items[0], third = items[2];
  ok(/<title>Al-Baqarah · 2:255<\/title>/.test(first), 'a verse whose hook is its reference is titled by it once, not twice');
  ok(/<description>The Throne verse\.<\/description>/.test(first), 'the description is the caption');
  ok(/<enclosure url="https:\/\/github\.com\/Eouchi147\/noor\/releases\/download\/reels-verse\/verse-2-255\.mp4" type="video\/mp4" length="30000000"\/>/.test(first), 'the enclosure is the video URL, video/mp4, with the bytes as its length');
  ok(/<itunes:duration>1:01<\/itunes:duration>/.test(first), 'the duration is the sidecar\'s seconds');
  ok(/<pubDate>Tue, 08 Sep 2026 08:00:00 GMT<\/pubDate>/.test(first), 'the pubDate is the day it was uploaded');
  ok(/<itunes:image href="https:\/\/github\.com\/[^"]+verse-2-255-cover\.jpg"\/>/.test(first), 'the cover is the episode image');
  ok(!/length=/.test(third), 'a row without bytes carries no length rather than a made-up one');
  ok(!/itunes:duration/.test(third), 'and a row without secs no duration');
  ok(/&lt;the Most Merciful&gt;/.test(third) && !/<the Most/.test(third), 'angle brackets in a caption are escaped');
  ok(/reciter &amp; named/.test(items[1]), 'and so is an ampersand');
  ok(items.every(i => /<enclosure url="https:\/\//.test(i)), 'every enclosure URL is https');
  ok(items.every(i => /<pubDate>[A-Z][a-z]{2}, \d\d [A-Z][a-z]{2} \d{4} \d\d:\d\d:\d\d GMT<\/pubDate>/.test(i)), 'every item has an RFC 822 pubDate');
  ok(!/undefined|null|\[object/.test(xml), 'nothing unset leaks into the feed');
}

console.log('\nwithout the uploaded date, the manifest order stands, last written first');
{
  const doc = { written: '2026-09-09', cards: MANIFEST.cards.map(c => { const { uploaded, ...rest } = c; return rest; }) };
  const eps = P.episodes(doc, 'noorcodex.com');
  ok(eps.map(e => e.id).join() === 'verse-1-1,verse-2-255,verse-94-5-6', 'the last row of the manifest is the newest: ' + eps.map(e => e.id).join(' > '));
  ok(/<pubDate>Wed, 09 Sep 2026 08:00:00 GMT<\/pubDate>/.test(P.itemXml(eps[0], doc)), 'and its pubDate is the day the manifest was written');
}

console.log('\nthe shelf is read once, and a shelf that cannot be read is said so');
{
  reads = 0;
  await call(); await call();
  ok(reads === 0, 'a shelf read a moment ago is not read again');
  R.forgetManifest(); manifestDown = true;
  const r = await call();
  ok(r.code === 502 && /shelf/.test(r.body), 'with no shelf, 502 and a sentence, never an empty feed');
  manifestDown = false;
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
