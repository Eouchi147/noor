/* NOOR · the claim, the verified reel, and the private Short.
   ------------------------------------------------------------------
   Three promises made on 15 September 2026, after the function log of every
   reel slot had been read:

     a slot is claimed in the store before anything is sent, so two runs in
     the same minute cannot both send it;

     a Facebook reel is not "sent" because "finish" answered 200: the video is
     asked what became of it, and the record says ready (with the permalink),
     still processing (the finisher asks again), or refused in Meta's words;

     an upload YouTube kept private is uploaded, not published, and does not
     retire the reel.

   Meta and the store are stubbed. This repository has no credentials.

   Run:  node tests/claim.mjs
*/
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

process.env.FB_PAGE_ID = '123'; process.env.FB_PAGE_TOKEN = 'tok';
process.env.KV_REST_API_URL = 'https://kv.test';
process.env.KV_REST_API_TOKEN = 't';

const STORE = new Map();
let statusAnswers = [];
let statusCalls = 0;
globalThis.fetch = async (url, opt) => {
  const u = String(url);
  const J = (j, status = 200) => ({ ok: status < 400, status, headers: { get: () => '' }, json: async () => j });
  if (u.startsWith('https://kv.test')) {
    const cmds = JSON.parse(opt.body);
    return J(cmds.map(c => {
      const [v, k, val, ...rest] = c;
      if (v === 'SET') {
        if (rest.includes('NX') && STORE.has(k)) return { result: null };
        STORE.set(k, val); return { result: 'OK' };
      }
      if (v === 'GET') return { result: STORE.has(k) ? STORE.get(k) : null };
      return { result: null };
    }));
  }
  if (/\/V9\?fields=status,permalink_url/.test(u)) {
    statusCalls++;
    return J(statusAnswers.length > 1 ? statusAnswers.shift() : statusAnswers[0]);
  }
  throw new Error('unexpected fetch ' + u);
};

const S = await import('../api/social.js');

console.log('\n=== the claim ===');
{
  const a = await S.claimSlot('2026-09-15', 'reelA');
  const b = await S.claimSlot('2026-09-15', 'reelA');
  const c = await S.claimSlot('2026-09-15', 'reelB');
  ok(a === true, 'the first run claims the slot');
  ok(b === false, 'the second run in the same minute is refused');
  ok(c === true, 'another slot is another claim');
  const cmd = STORE.has('nsoc:claim:2026-09-15#reelA');
  ok(cmd, 'the claim is written under its own key');
}

console.log('\n=== the reel, asked what became of it ===');
{
  statusAnswers = [{ status: { video_status: 'ready' }, permalink_url: '/reel/V9/', published: true }];
  const r = await S.fbReelStatus('V9', 'tok', 1);
  ok(r.ok === true && r.id === 'V9', 'ready is sent');
  ok(r.url === 'https://www.facebook.com/reel/V9/', 'with the permalink on the record');
  ok(!!r.verified, 'and the moment it was verified');

  statusAnswers = [{ status: { video_status: 'processing' } }];
  statusCalls = 0;
  const p = await S.fbReelStatus('V9', 'tok', 2);
  ok(p.ok === false && p.pending && p.pending.fb === 'V9', 'processing is pending, for the finisher');
  ok(statusCalls === 2, 'asked as many times as allowed (' + statusCalls + ')');

  statusAnswers = [{ status: { video_status: 'error', processing_phase: { errors: [{ message: 'The video could not be fetched', code: 6000 }] } } }];
  const e = await S.fbReelStatus('V9', 'tok', 1);
  ok(e.ok === false && !e.pending, 'an error is refused, not pending');
  ok(/could not be fetched/.test(e.error), 'in Meta\'s own words: ' + e.error);

  statusAnswers = [{ status: { video_status: 'processing' } }, { status: { video_status: 'ready' }, permalink_url: '/reel/V9/', published: true }];
  const later = await S.fbReelStatus('V9', 'tok', 2);
  ok(later.ok === true, 'processing then ready, within the same look, is sent');
}

console.log('\n=== the private Short ===');
{
  const rec = { reel: 'verse-1-1', state: 'sent', results: {
    facebook: { ok: true, id: 'V9' },
    youtube: { ok: true, id: 'y1', private: true } } };
  ok(S.reelDone(rec) === false, 'a private YouTube upload does not retire the reel');
  rec.results.youtube.private = false;
  ok(S.reelDone(rec) === true, 'a public one does');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
