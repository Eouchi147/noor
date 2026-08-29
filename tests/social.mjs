/* NOOR · the social machine.
   ------------------------------------------------------------------
   The composer, the guard rails and the de-duplication are tested here with
   the store, the library and the Lantern all stubbed. The two network calls to
   Meta are NOT tested against live credentials, because this repository has
   none, and the file says so at the top of itself.

   What is held:
     · a caption is assembled from the card and never invented
     · the Lantern may tighten it but may NOT introduce a number
     · nor an emoji, an exclamation mark or a long dash
     · nothing is sent while the schedule is off
     · nothing is sent twice for the same day, even on a double cron
     · a dry run reaches no network at all

   Run:  node tests/social.mjs
*/
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const LIB = JSON.parse(fs.readFileSync('lights/all.json', 'utf8'));
const STORE = new Map();
let lantern = null, net = [];

process.env.KV_REST_API_URL = 'https://kv.test';
process.env.KV_REST_API_TOKEN = 't';
process.env.OPENROUTER_API_KEY = 'sk-test';
process.env.ADMIN_SECRET = 'secret';
process.env.FB_PAGE_ID = '123'; process.env.FB_PAGE_TOKEN = 'tok';
process.env.IG_USER_ID = '456';

globalThis.fetch = async (url, opt) => {
  url = String(url);
  if (url.startsWith('https://kv.test')) {
    const cmds = JSON.parse(opt.body);
    return { ok: true, status: 200, json: async () => cmds.map(c => {
      const [v, k, ...r] = c;
      if (v === 'GET') return { result: STORE.has(k) ? STORE.get(k) : null };
      if (v === 'SET') { STORE.set(k, r[0]); return { result: 'OK' }; }
      if (v === 'LPUSH') { const l = STORE.get(k) || []; l.unshift(r[0]); STORE.set(k, l); return { result: l.length }; }
      if (v === 'LRANGE') { const l = STORE.get(k) || []; return { result: l.slice(0, +r[1] + 1) }; }
      if (v === 'LTRIM') { const l = STORE.get(k) || []; STORE.set(k, l.slice(0, +r[1] + 1)); return { result: 'OK' }; }
      return { result: null };
    }) };
  }
  if (url.includes('/lights/all.json')) return { ok: true, status: 200, json: async () => LIB };
  if (url.includes('/api/v1/models')) return { ok: true, status: 200, json: async () => ({ data: [{ id: 'x/y:free', context_length: 9000, pricing: { prompt: '0', completion: '0', request: '0' }, architecture: { input_modalities: ['text'], output_modalities: ['text'] } }] }) };
  if (url.includes('/chat/completions')) {
    if (lantern === null) return { ok: false, status: 404, json: async () => ({ error: { message: 'dark' } }), text: async () => 'dark' };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: lantern } }] }) };
  }
  if (url.includes('graph.facebook.com')) {
    net.push(url);
    return { ok: true, status: 200, json: async () => ({ id: 'posted_1', post_id: 'p_1' }) };
  }
  throw new Error('unexpected fetch ' + url);
};

const S = await import('../api/social.js');
const setDials = d => STORE.set('nb:settings', JSON.stringify(d));

console.log('\n=== 1. the caption is built from the card ===');
{
  STORE.clear(); lantern = null;            /* the Lantern is dark */
  const p = await S.compose('h', '2026-05-05', {});
  ok(!!p && p.caption.includes(p.light.title), 'the title is in the caption');
  ok(p.caption.includes('noorcodex.com'), 'and so is where to read it');
  ok(/#Islam/.test(p.caption), 'and the tags');
  ok(p.polished === false, 'with no polish when the Lantern is dark');
  ok(/\/api\/card\?date=2026-05-05&fmt=png/.test(p.image), 'the image is the day\'s card as a PNG');
}

console.log('\n=== 2. the Lantern may tighten, not invent ===');
{
  STORE.clear();
  const plain = await S.compose('h', '2026-05-06', { polish: false });
  lantern = 'A tighter opening line. ' + plain.caption.slice(0, 200);
  const good = await S.compose('h', '2026-05-06', {});
  ok(good.polished === true, 'a clean rewrite is accepted');

  lantern = 'In 1492 exactly 40000 scholars gathered. ' + plain.caption.slice(0, 100);
  const bad = await S.compose('h', '2026-05-06', {});
  ok(bad.polished === false, 'a rewrite that introduces a number is REFUSED');
  ok(/number/.test(bad.refused), 'and the reason is recorded (' + bad.refused + ')');

  lantern = 'Amazing story! ' + plain.caption.slice(0, 100);
  const bang = await S.compose('h', '2026-05-06', {});
  ok(bang.polished === false, 'an exclamation mark is refused');

  lantern = 'A line — with a long dash. ' + plain.caption.slice(0, 100);
  const dash = await S.compose('h', '2026-05-06', {});
  ok(dash.polished === false, 'a long dash is refused');
  lantern = null;
}

console.log('\n=== 3. nothing is sent while the schedule is off ===');
{
  STORE.clear(); net = [];
  setDials({ 'social.auto': false });
  const r = await S.runDaily('h', '2026-05-07', {});
  ok(net.length === 0, 'no network call is made');
  ok(/off/.test(r.skipped), 'and it says why (' + r.skipped + ')');
}

console.log('\n=== 4. a dry run reaches no network ===');
{
  STORE.clear(); net = [];
  setDials({ 'social.auto': true });
  const r = await S.runDaily('h', '2026-05-08', { force: true, dry: true });
  ok(net.length === 0, 'still no network call');
  ok(!!r.post && !!r.post.caption, 'but the whole post is returned for review');
}

console.log('\n=== 5. it posts, once, and only once ===');
{
  STORE.clear(); net = [];
  setDials({ 'social.auto': true, 'social.fb': true, 'social.ig': true });
  const first = await S.runDaily('h', '2026-05-09', {});
  ok(first.ran.length === 2, 'both channels are used (' + first.ran.map(x => x.where).join(', ') + ')');
  ok(first.ran.every(x => x.ok), 'and both report success');
  ok(net.some(u => /\/123\/photos/.test(u)), 'facebook got a photo post');
  ok(net.some(u => /\/456\/media$/.test(u)) && net.some(u => /media_publish/.test(u)),
     'instagram got a container and then a publish');

  const before = net.length;
  const second = await S.runDaily('h', '2026-05-09', {});
  ok(net.length === before, 'a second run the same day sends NOTHING');
  ok(/already/.test(second.skipped), 'and says so (' + second.skipped + ')');
}

console.log('\n=== 6. one channel off ===');
{
  STORE.clear(); net = [];
  setDials({ 'social.auto': true, 'social.fb': true, 'social.ig': false });
  const r = await S.runDaily('h', '2026-05-10', {});
  ok(r.ran.length === 1 && r.ran[0].where === 'facebook', 'only the channel left on is used');
  ok(!net.some(u => /media_publish/.test(u)), 'instagram is never touched');
}

console.log('\n=== 7. a missing credential is reported, not crashed on ===');
{
  STORE.clear(); net = [];
  delete process.env.FB_PAGE_TOKEN;
  setDials({ 'social.auto': true, 'social.fb': true, 'social.ig': false });
  const r = await S.runDaily('h', '2026-05-11', {});
  ok(r.ran[0].ok === false && /FB_PAGE/.test(r.ran[0].skipped || ''),
     'it names the variable that is missing');
  process.env.FB_PAGE_TOKEN = 'tok';
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
