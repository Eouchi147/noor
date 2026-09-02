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
let cardOk = true, metaFails = '';

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
      if (v === 'LREM') { const l = STORE.get(k) || []; STORE.set(k, l.filter(x => x !== r[1])); return { result: 'OK' }; }
      return { result: null };
    }) };
  }
  if (url.includes('/lights/all.json')) return { ok: true, status: 200, json: async () => LIB };
  if (url.includes('/api/v1/models')) return { ok: true, status: 200, json: async () => ({ data: [{ id: 'x/y:free', context_length: 9000, pricing: { prompt: '0', completion: '0', request: '0' }, architecture: { input_modalities: ['text'], output_modalities: ['text'] } }] }) };
  if (url.includes('/chat/completions')) {
    if (lantern === null) return { ok: false, status: 404, json: async () => ({ error: { message: 'dark' } }), text: async () => 'dark' };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: lantern } }] }) };
  }
  if (url.includes('graph.facebook.com') || url.includes('graph.instagram.com')) {
    net.push(url);
    if (metaFails) return { ok: false, status: 400, json: async () => ({ error: { message: metaFails } }) };
    return { ok: true, status: 200, json: async () => ({ id: 'posted_1', post_id: 'p_1' }) };
  }
  /* the pre-flight fetches the card before anything is sent */
  if (/\/api\/card\?/.test(url)) {
    net.push(url);
    return { ok: cardOk, status: cardOk ? 200 : 503,
             headers: { get: h => (h === 'content-type' ? (cardOk ? 'image/png' : 'text/plain') : '360000') } };
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
  /* The Lantern answers in the shape the composer now asks for: a JSON object
     with a hook and tags. It may only use words the card already uses, so
     each stub hook is built from the card's own opening. */
  STORE.clear();
  const plain = await S.compose('h', '2026-05-06', { polish: false });
  const words = plain.caption.replace(/[#\d]/g, ' ').split(/\s+/).filter(w => /^[A-Za-z]{3,}$/.test(w));
  const own = words.slice(0, 7).join(' ');
  const answer = (hook, tags) => JSON.stringify({ hook, tags: tags || [] });
  lantern = answer('One question about ' + own.toLowerCase());
  const good = await S.compose('h', '2026-05-06', {});
  ok(good.polished === true, 'a clean rewrite is accepted');

  lantern = answer('In 1492 exactly 40000 scholars gathered about ' + own.toLowerCase());
  const bad = await S.compose('h', '2026-05-06', {});
  ok(bad.polished === false, 'a rewrite that introduces a number is REFUSED');
  ok(/not supported|number/.test(bad.refused), 'and the reason is recorded (' + bad.refused + ')');

  lantern = answer('Amazing story about ' + own.toLowerCase() + '!');
  const bang = await S.compose('h', '2026-05-06', {});
  ok(bang.polished === false, 'an exclamation mark is refused');

  lantern = answer('A line \u2014 with a long dash about ' + own.toLowerCase());
  const dash = await S.compose('h', '2026-05-06', {});
  ok(dash.polished === false, 'a long dash is refused');
  lantern = null;
}

console.log('\n=== 3. nothing is sent while the schedule is off ===');
{
  STORE.clear(); net = [];
  setDials({ 'social.mode': 'off' });
  const r = await S.runDaily('h', '2026-05-07', {});
  ok(net.length === 0, 'no network call is made');
  ok(/off/.test(r.skipped), 'and it says why (' + r.skipped + ')');
}

console.log('\n=== 4. a dry run reaches no network ===');
{
  STORE.clear(); net = [];
  setDials({ 'social.mode': 'auto' });
  const r = await S.runDaily('h', '2026-05-08', { force: true, dry: true });
  ok(net.length === 0, 'still no network call');
  ok(!!r.post && !!r.post.caption, 'but the whole post is returned for review');
}

console.log('\n=== 5. it posts, once, and only once ===');
{
  STORE.clear(); net = [];
  setDials({ 'social.mode': 'auto', 'social.fb': true, 'social.ig': true });
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
  setDials({ 'social.mode': 'auto', 'social.fb': true, 'social.ig': false });
  const r = await S.runDaily('h', '2026-05-10', {});
  ok(r.ran.length === 1 && r.ran[0].where === 'facebook', 'only the channel left on is used');
  ok(!net.some(u => /media_publish/.test(u)), 'instagram is never touched');
}

console.log('\n=== 7. a missing credential is reported, not crashed on ===');
{
  STORE.clear(); net = [];
  delete process.env.FB_PAGE_TOKEN;
  setDials({ 'social.mode': 'auto', 'social.fb': true, 'social.ig': false });
  const r = await S.runDaily('h', '2026-05-11', {});
  ok(r.ran[0].ok === false && /FB_PAGE/.test(r.ran[0].skipped || ''),
     'it names the variable that is missing');
  process.env.FB_PAGE_TOKEN = 'tok';
}

console.log('\n=== 8. the image host is forced to production ===');
{
  /* the ported machine learned this twice: a preview hostname handed to
     Instagram is baked into a live post and dead within days */
  const p1 = await S.compose('noor-git-abc123-eouchi.vercel.app', '2026-05-12', { polish: false });
  ok(/^https:\/\/noorcodex\.com\//.test(p1.image),
     'a preview deployment still points the image at production (' + p1.image.slice(0, 34) + ')');
  const p2 = await S.compose('noorcodex.ca', '2026-05-12', { polish: false });
  ok(/^https:\/\/noorcodex\.ca\//.test(p2.image), 'a real domain is left alone');
  ok(S.publicHost('localhost:3000') === 'noorcodex.com', 'localhost never reaches a post');
}

console.log('\n=== 9. it will not post an image Meta cannot fetch ===');
{
  STORE.clear(); net = []; cardOk = false;
  setDials({ 'social.mode': 'auto' });
  const r = await S.runDaily('h', '2026-05-13', {});
  ok(!net.some(u => /graph\./.test(u)), 'no network call is made to Meta');
  ok(/PNG or JPEG|answered|could not be fetched/.test(r.skipped), 'and it says why (' + r.skipped + ')');
  cardOk = true;
}

console.log('\n=== 10. a half failure retries only the missing half ===');
{
  STORE.clear(); net = [];
  setDials({ 'social.mode': 'auto', 'social.fb': true, 'social.ig': true });
  /* Instagram is sick, Facebook is fine */
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, o) => {
    if (String(u).includes('/456/')) { net.push(String(u)); return { ok: false, status: 400, json: async () => ({ error: { message: 'IG is sick' } }) }; }
    return realFetch(u, o);
  };
  const first = await S.runDaily('h', '2026-05-14', {});
  ok(first.state === 'partial', 'the run is recorded as partial');
  ok(first.ran.find(x => x.where === 'facebook').ok === true, 'facebook still went out');
  ok(/IG is sick/.test(first.ran.find(x => x.where === 'instagram').error || ''),
     "and Meta's own words are kept for the one that failed");

  globalThis.fetch = realFetch;
  net = [];
  const second = await S.runDaily('h', '2026-05-14', {});
  const fb = second.ran.find(x => x.where === 'facebook');
  ok(fb.already === true, 'the retry does NOT post to facebook again');
  ok(!net.some(u => /\/123\/photos/.test(u)), 'and no photo call is made');
  ok(net.some(u => /\/456\/media/.test(u)), 'only instagram is retried');
  ok(second.state === 'sent', 'and the day is complete');
}

console.log('\n=== 11. approve mode drafts and stops ===');
{
  STORE.clear(); net = [];
  setDials({ 'social.mode': 'approve' });
  const r = await S.runDaily('h', '2026-05-15', {});
  ok(!net.some(u => /graph\./.test(u)), 'nothing reaches a network');
  ok(/approval/.test(r.skipped), 'it says it is waiting (' + r.skipped + ')');
  const q = await S.queue();
  ok(q.length === 1 && q[0].date === '2026-05-15', 'and the day is in the queue for the owner');
  ok(!!q[0].caption, 'with the caption already written');

  /* the owner presses Post */
  const sent = await S.runDaily('h', '2026-05-15', { force: true });
  ok(sent.state === 'sent', 'pressing Post by hand publishes it');
  const q2 = await S.queue();
  ok(q2.length === 0, 'and it leaves the queue');
  const log = await S.socialLog();
  ok(log.length === 1 && log[0].date === '2026-05-15',
     'and joins the history in the same write, so it never becomes invisible');
}

console.log('\n=== 12. an unreadable store never publishes ===');
{
  STORE.clear(); net = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, o) => {
    if (String(u).startsWith('https://kv.test')) throw new Error('store down');
    return realFetch(u, o);
  };
  const r = await S.runDaily('h', '2026-05-16', {});
  ok(!net.some(u => /graph\./.test(u)), 'not knowing is never the thing that posts');
  ok(/could not be read|off/.test(r.skipped), 'and it says why (' + r.skipped + ')');
  globalThis.fetch = realFetch;
}

console.log('\n=== 13. the caption fits what Instagram accepts ===');
{
  const many = 'word '.repeat(700) + '\n\n' + Array.from({ length: 45 }, (_, i) => '#tag' + i).join(' ');
  const fit = S.fitCaption(many);
  const n = (fit.match(/#[a-z0-9_]+/gi) || []).length;
  ok(fit.length <= 2200, 'never longer than 2200 characters (' + fit.length + ')');
  ok(n === 30, 'trimmed to exactly 30 hashtags (' + n + ')');
  ok(/#tag29\s*$/.test(fit), 'and the tag block SURVIVES the length trim, the body is what shortens');
  const normal = S.fitCaption('short caption\n\n#Islam #Quran');
  ok(normal === 'short caption\n\n#Islam #Quran', 'a caption that already fits is untouched');
}

console.log('\n=== 14. the Lantern is not asked about cited material ===');
{
  /* A model can change the sense of a sentence without touching a number, and
     the numeric guard cannot see that. On Qur'an and hadith a better opening
     line is not worth the risk, so the Lantern is not asked at all. */
  ok(S.polishAllowed({ lvl: 'editorial' }) === true, 'an editorial card may be tightened');
  for (const lvl of ['quran', 'sunnah', 'debated'])
    ok(S.polishAllowed({ lvl }) === false, 'a ' + lvl + ' card may not');
  ok(S.polishAllowed(null) === true, 'and a card with no level is treated as editorial, not as an error');

  /* and end to end: walk real mornings until a cited card comes up */
  /* a hook the guard will accept on any card: three ordinary words it cannot
     mistake for an invented name, and the card's own tags */
  lantern = JSON.stringify({ hook: 'one morning worth stopping for', tags: ['#Islam'] });
  let cited = null, free = null;
  for (let t = 0; t < 60 && !(cited && free); t++) {
    STORE.clear();
    const d = new Date(Date.UTC(2026, 6, 1) + t * 86400000).toISOString().slice(0, 10);
    const p = await S.compose('h', d, {});
    if (!p) continue;
    if (['quran', 'sunnah', 'debated'].includes(p.light.lvl)) cited = cited || p;
    else free = free || p;
  }
  ok(!!cited && cited.polished === false && /citation/.test(cited.refused),
     'a real ' + (cited ? cited.light.lvl : '?') + ' morning goes out unpolished, and says why');
  ok(!!free && free.polished === true, 'a real editorial morning is tightened');
  lantern = null;
}

console.log('\n=== 15. the token clock ===');
{
  STORE.clear();
  const t0 = await S.tokenClock();
  ok(t0.fb.daysLeft === null, 'it says nothing until the owner records a renewal');
  const at = new Date(Date.now() - 50 * 86400000).toISOString().slice(0, 10);
  await S.markTokenRenewed('both', at);
  const t1 = await S.tokenClock();
  ok(t1.fb.daysLeft === 10 && t1.ig.daysLeft === 10,
     'fifty days after a renewal it says ten left (' + t1.fb.daysLeft + ')');
  await S.markTokenRenewed('both', new Date(Date.now() - 70 * 86400000).toISOString().slice(0, 10));
  const t2 = await S.tokenClock();
  ok(t2.fb.daysLeft < 0, 'and it goes negative rather than silently resetting (' + t2.fb.daysLeft + ')');
}

console.log('\n=== 16. the token decides which Graph host is spoken to ===');
{
  STORE.clear(); net = [];
  process.env.IG_TOKEN = 'IGQVJXsomethingsomething';
  setDials({ 'social.mode': 'auto', 'social.fb': false, 'social.ig': true });
  await S.runDaily('h', '2026-05-17', {});
  ok(net.some(u => u.startsWith('https://graph.instagram.com/')),
     'an IG... token is sent to graph.instagram.com');
  net = []; STORE.clear();
  setDials({ 'social.mode': 'auto', 'social.fb': false, 'social.ig': true });
  process.env.IG_TOKEN = 'EAAsomethingsomething';
  await S.runDaily('h', '2026-05-18', {});
  ok(net.some(u => u.startsWith('https://graph.facebook.com/')),
     'an EAA... token is sent to graph.facebook.com');
  delete process.env.IG_TOKEN;
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
