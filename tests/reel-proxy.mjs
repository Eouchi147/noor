/* NOOR · the same-origin door to a reel's bytes.
   ------------------------------------------------------------------
   api/reel.js exists so a phone can hand a reel to its share sheet, and as
   the fallback when a network refuses the store's octet-stream URL. What is
   held here, with the store stubbed:

     an id is looked up on the shelf, the release redirect is resolved, and
       the file is STREAMED through, never buffered whole;
     the headers a video needs: video/mp4, the length, Accept-Ranges,
       inline with the id as its name, cached an hour;
     a Range request goes upstream and the 206 with its Content-Range comes
       back;
     an unknown id is 404; a store that does not answer is 502, in words;
     the manifest is read once and kept five minutes.

   Run:  node tests/reel-proxy.mjs
*/
import { Writable } from 'node:stream';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const R = await import('../api/_reels.js');
const { default: handler, resolveVideo } = await import('../api/reel.js');

const MANIFEST = { n: 2, written: '2026-09-09', cards: [
  { id: 'verse-94-5-6', kind: 'verse', slot: 'morning', hook: 'Al-Sharh · 94:5-6', caption: 'A caption.', secs: 14,
    video: 'https://github.com/Eouchi147/noor/releases/download/reels-verse/verse-94-5-6.mp4', cover: true },
  { id: 'word-12', kind: 'word', slot: 'noon', hook: 'Sabr', caption: 'Patience.', secs: 13 },
  { id: 'evil-1', kind: 'word', slot: 'noon', hook: 'x', caption: 'x', video: 'https://evil.example/steal.mp4' },
  { id: 'blob-1', kind: 'word', slot: 'noon', hook: 'x', caption: 'x', video: 'https://abc123.public.blob.vercel-storage.com/reels/blob-1.mp4' },
  { id: 'hop-1', kind: 'word', slot: 'noon', hook: 'x', caption: 'x', video: 'https://github.com/Eouchi147/noor/releases/download/reels-word/hop-1.mp4' }
] };
const SIGNED = 'https://release-assets.githubusercontent.com/github-production-release-asset/abc?sig=1';
const BYTES = Buffer.alloc(200000, 7);           /* 200 KB of a "video", in 16 KB chunks */

let manifestReads = 0, calls = [], storeDown = false, manifestDown = false;
function chunked(buf, from, to) {
  const slice = buf.subarray(from, to + 1);
  let i = 0;
  return new ReadableStream({ pull(c) { if (i >= slice.length) return c.close(); c.enqueue(slice.subarray(i, i + 16384)); i += 16384; } });
}
globalThis.fetch = async (url, opt = {}) => {
  const u = String(url); calls.push({ u, method: opt.method || 'GET', headers: opt.headers || {}, redirect: opt.redirect });
  const H = h => ({ get: k => (h[k.toLowerCase()] != null ? String(h[k.toLowerCase()]) : null) });
  if (u.endsWith('/reels/index.json')) { manifestReads++; if (manifestDown) throw new Error('no manifest'); return { ok: true, status: 200, json: async () => MANIFEST }; }
  if (/github\.com\/.*\/releases\/download\//.test(u)) {
    if (u.endsWith('/hop-1.mp4')) return { ok: false, status: 302, headers: H({ location: 'https://evil.example/hop.mp4' }), body: null };
    if (storeDown) throw new Error('socket hang up');
    return { ok: false, status: 302, headers: H({ location: SIGNED }), body: null };
  }
  if (u.startsWith(SIGNED)) {
    if (storeDown) return { ok: false, status: 503, headers: H({}), body: null };
    const range = String((opt.headers || {}).range || '');
    const m = range.match(/^bytes=(\d*)-(\d*)$/);
    if (m) {
      const from = m[1] ? +m[1] : BYTES.length - +m[2], to = m[2] && m[1] ? Math.min(+m[2], BYTES.length - 1) : BYTES.length - 1;
      return { ok: true, status: 206, headers: H({ 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename=verse-94-5-6.mp4', 'accept-ranges': 'bytes',
        'content-length': String(to - from + 1), 'content-range': 'bytes ' + from + '-' + to + '/' + BYTES.length }), body: opt.method === 'HEAD' ? null : chunked(BYTES, from, to) };
    }
    return { ok: true, status: 200, headers: H({ 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename=verse-94-5-6.mp4', 'accept-ranges': 'bytes', 'content-length': String(BYTES.length), etag: '"e1"' }),
      body: opt.method === 'HEAD' ? null : chunked(BYTES, 0, BYTES.length - 1) };
  }
  if (u.includes('evil.example')) { calls.push({ u: 'EVIL ' + u }); return { ok: true, status: 200, headers: H({ 'content-length': '3' }), body: chunked(Buffer.from('bad'), 0, 2) }; }
  if (u.includes('.public.blob.vercel-storage.com')) return { ok: true, status: 200, headers: H({ 'content-type': 'video/mp4', 'content-length': '4' }), body: chunked(Buffer.from('blob'), 0, 3) };
  if (u.endsWith('/reels/word-12.mp4')) return { ok: true, status: 200, headers: H({ 'content-type': 'video/mp4', 'content-length': '5' }), body: chunked(Buffer.from('hello'), 0, 4) };
  throw new Error('unexpected fetch ' + u);
};

/* a response that is a writable stream, the way Node's is */
function res() {
  const chunks = []; let peak = 0, pending = 0;
  const w = new Writable({ write(c, e, cb) { chunks.push(Buffer.from(c)); pending += c.length; peak = Math.max(peak, pending); setImmediate(() => { pending = 0; cb(); }); } });
  w.code = 0; w.headers = {}; w.body = null;
  w.status = function (c) { w.code = c; return w; };
  w.setHeader = function (k, v) { w.headers[k.toLowerCase()] = String(v); };
  w.json = function (o) { w.body = o; w.end(); return w; };
  w.bytes = () => Buffer.concat(chunks);
  w.done = () => new Promise(r => { if (w.writableFinished) r(); else w.on('finish', r); });
  w.peak = () => peak;
  return w;
}
const call = async (query, headers = {}, method = 'GET') => { const r = res(); await handler({ method, query, headers: { host: 'noorcodex.com', ...headers } }, r); await r.done(); return r; };

console.log('\nthe whole file');
{
  calls = []; R.forgetManifest();
  const r = await call({ id: 'verse-94-5-6' });
  ok(r.code === 200, 'answers 200');
  ok(r.headers['content-type'] === 'video/mp4', 'as video/mp4, not the store\'s octet-stream');
  ok(r.headers['content-length'] === String(BYTES.length), 'with the length');
  ok(r.headers['accept-ranges'] === 'bytes', 'and Accept-Ranges: bytes');
  ok(r.headers['cache-control'] === 'public, max-age=3600', 'cached an hour');
  ok(r.headers['content-disposition'] === 'inline; filename="verse-94-5-6.mp4"', 'inline, named by its id');
  ok(r.bytes().length === BYTES.length && r.bytes().equals(BYTES), 'every byte comes through');
  const head = calls.find(c => /releases\/download/.test(c.u));
  ok(head && head.method === 'HEAD' && head.redirect === 'manual', 'the release redirect is resolved with a HEAD, not followed blind');
  ok(calls.some(c => c.u.startsWith(SIGNED) && c.method === 'GET'), 'and the signed copy is what is fetched');
  ok(r.peak() < BYTES.length, 'the file is streamed, never held whole: peak in flight ' + r.peak() + ' of ' + BYTES.length);
}

console.log('\na range');
{
  calls = [];
  const r = await call({ id: 'verse-94-5-6' }, { range: 'bytes=100-299' });
  ok(r.code === 206, 'answers 206');
  ok(r.headers['content-range'] === 'bytes 100-299/' + BYTES.length, 'with the Content-Range the store gave');
  ok(r.headers['content-length'] === '200' && r.bytes().length === 200, 'and exactly those bytes');
  const up = calls.find(c => c.u.startsWith(SIGNED));
  ok(up && up.headers.range === 'bytes=100-299', 'the Range header went upstream as it came');
  const tail = await call({ id: 'verse-94-5-6' }, { range: 'bytes=-1000' });
  ok(tail.code === 206 && tail.bytes().length === 1000, 'a suffix range (what a player asks for first) works too');
  const bad = await call({ id: 'verse-94-5-6' }, { range: 'lines=1-2' });
  ok(bad.code === 200 && !calls[calls.length - 1].headers.range, 'a Range that is not bytes is ignored, not relayed');
}

console.log('\nwhat it refuses');
{
  const r = await call({ id: 'no-such-reel' });
  ok(r.code === 404 && r.body && /no reel/.test(r.body.reason), 'an unknown id is 404, in words');
  const none = await call({});
  ok(none.code === 400, 'no id is 400');
  const bad = await call({ id: '../../etc/passwd' });
  ok(bad.code === 404, 'an id that is not an id is not looked up');
  const p = await call({ id: 'verse-94-5-6' }, {}, 'POST');
  ok(p.code === 405, 'only GET and HEAD');
  storeDown = true; calls = [];
  const down = await call({ id: 'verse-94-5-6' });
  ok(down.code === 502 && down.body && /store/.test(down.body.reason), 'a store that does not answer is 502: ' + (down.body && down.body.reason));
  storeDown = false;
}

console.log('\nan older row, with the file on the site');
{
  const r = await call({ id: 'word-12' });
  ok(r.code === 200 && r.bytes().toString() === 'hello' && r.headers['content-disposition'] === 'inline; filename="word-12.mp4"', 'a row without a store URL is served from /reels/ on the site');
  ok(!calls.some(c => c.u.includes('word-12') && c.method === 'HEAD'), 'and nothing is resolved for it');
}

console.log('\nthe host is pinned');
{
  const { hostAllowed } = await import('../api/reel.js');
  calls = [];
  const r = await call({ id: 'evil-1' });
  ok(r.code === 502 && /host/.test(r.body.reason), 'a row pointing off the shelf is 502, in words: ' + r.body.reason);
  const hop = await call({ id: 'hop-1' });
  ok(hop.code === 502 && /redirected/.test(hop.body.reason), 'and so is a release URL whose redirect leaves the store: ' + hop.body.reason);
  ok(!calls.some(c => /^EVIL/.test(c.u)), 'nothing was fetched from the other host in either case');
  const bl = await call({ id: 'blob-1' });
  ok(bl.code === 200 && bl.bytes().toString() === 'blob', 'Vercel Blob is a store the shelf may live on');
  ok(hostAllowed('https://github.com/x/y/releases/download/a/b.mp4') && hostAllowed('https://objects.githubusercontent.com/x') && hostAllowed('https://release-assets.githubusercontent.com/x') && hostAllowed('https://noorcodex.com/reels/x.mp4', 'noorcodex.com'), 'the store hosts and the site are allowed');
  ok(!hostAllowed('http://github.com/x') && !hostAllowed('https://github.com.evil.example/x') && !hostAllowed('https://noorcodex.com/x', 'noorcodex.ca') && !hostAllowed('https://public.blob.vercel-storage.com.evil.example/x'), 'plain http, a look-alike host and another site are not');
}

console.log('\nHEAD');
{
  const r = await call({ id: 'verse-94-5-6' }, {}, 'HEAD');
  ok(r.code === 200 && r.headers['content-type'] === 'video/mp4' && r.headers['content-length'] === String(BYTES.length) && r.bytes().length === 0, 'HEAD answers the headers and no body');
}

console.log('\nthe manifest is read once');
{
  ok(manifestReads === 1, 'every call above read the shelf once: ' + manifestReads);
  R.forgetManifest(); manifestDown = true;
  const r = await call({ id: 'verse-94-5-6' });
  ok(r.code === 502 && /shelf/.test(r.body.reason), 'with no shelf ever read and none reachable, the door says so rather than calling every reel unknown: ' + r.code);
  manifestDown = false; R.forgetManifest();
  await call({ id: 'verse-94-5-6' });
  manifestDown = true;
  const again = await call({ id: 'verse-94-5-6' });
  ok(again.code === 200, 'a shelf read a minute ago still answers when the manifest is not reachable now');
  manifestDown = false;
}

console.log('\nresolveVideo');
{
  ok(await resolveVideo('https://noorcodex.com/reels/x.mp4') === 'https://noorcodex.com/reels/x.mp4', 'a site URL is left alone');
  ok(await resolveVideo('https://github.com/Eouchi147/noor/releases/download/reels-verse/x.mp4') === SIGNED, 'a release URL becomes the signed copy');
  ok(await resolveVideo('https://github.com/Eouchi147/noor/releases/download/reels-verse/x.mp4', async () => { throw new Error('down'); }) === 'https://github.com/Eouchi147/noor/releases/download/reels-verse/x.mp4', 'and stays itself when the redirect cannot be read');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
