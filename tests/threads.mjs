/* NOOR · Threads, with Meta stubbed.
   ------------------------------------------------------------------
   Meta's text network. What has to be true: one variable makes it live and
   its absence makes it not; a card is the title, one line, the link and at
   most two tags inside 500; a reel carries its audited caption cut to 500;
   a text post is one container and one publish, an image post the same
   with the picture by url, a video post a container, one short look, and
   the publish; a video still processing is handed back as pending and the
   real finishPendingReels publishes it from the record next hour; the
   250-a-day ceiling is stated and NOT counted here; an expired token is
   fatal and says what to do; the token appears in no url and no sentence;
   and the door signs its state, refuses a stale one, trades the code
   short-for-long and shows TH_TOKEN and TH_USER_ID once.

   Run:  node tests/threads.mjs        (no server, no network: fetch is stubbed)
*/
process.env.TH_APP_ID = "1234567890";
process.env.TH_APP_SECRET = "s3cret-app-secret";
process.env.TH_TOKEN = "THAAQZAlongLivedTokenThatIsQuiteLongIndeedAndSecret0123456789";
process.env.TH_USER_ID = "17841400000000001";
process.env.ADMIN_SECRET = "admin-secret";
process.env.TH_POLL_WAIT_MS = "5";
process.env.TH_IMAGE_WAIT_MS = "5";
delete process.env.KV_REST_API_URL; delete process.env.REDIS_URL; delete process.env.KV_URL;

import * as TH from "../api/_threads.js";
import * as CH from "../api/_channels.js";
import * as S from "../api/_schedule.js";
import * as SOC from "../api/social.js";
import door, { state, stateOk } from "../api/threads.js";
import fs from "fs";

const TOKEN = process.env.TH_TOKEN;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

/* ---------- a Threads that answers ---------- */
const reply = (status, obj) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(obj), json: async () => obj });
function threads(opts = {}) {
  const calls = [];
  let videoStatus = opts.videoStatus || "FINISHED";
  const T = {
    calls, set: s => { videoStatus = s; },
    fetch: async (url, init = {}) => {
      const u = String(url);
      const body = init.body ? JSON.parse(init.body) : {};
      calls.push({ url: u, body, headers: init.headers || {}, method: init.method || "GET" });
      if (opts.answer) { const a = opts.answer(u, body); if (a) return a; }
      if (/\/me\?fields=id,username$/.test(u)) return reply(200, { id: "17841400000000001", username: "noorcodex" });
      if (/\/threads$/.test(u)) return reply(200, { id: "C" + calls.length });
      if (/\/threads_publish$/.test(u)) return reply(200, { id: "M" + body.creation_id });
      if (/\?fields=status,error_message$/.test(u)) return reply(200, { status: videoStatus, id: "c" });
      if (/\?fields=permalink$/.test(u)) return reply(200, { permalink: "https://www.threads.net/@noorcodex/post/DAbc" });
      return reply(404, { error: { message: "unexpected " + u, code: 100 } });
    }
  };
  return T;
}
const kinds = T => T.calls.map(c => c.url.replace(/^https:\/\/graph\.threads\.net\/v1\.0\//, "").replace(/^17841400000000001\//, "").replace(/^C\d+\?/, "C?").replace(/^MC\d+\?/, "M?"));

const CARD = { title: "The cave in the Qur'an held two men for three nights", body: "Jabal Thawr rises south of Makkah. The Prophet and Abu Bakr hid there.\nA spider is said to have spun across the mouth.",
  todo: ["Read Surah 9, ayah 40"], basis: "Bukhari 3615", link: "https://noorcodex.com/?node=12",
  image: "https://noorcodex.com/api/card?slot=light&fmt=png", tags: ["#Seerah", "#Islam", "#Hijrah", "#NoorCodexOfLight"] };
const REEL = { id: 'know-sine', kind: 'know', hook: 'The word sine is a translation mistake', caption: 'Indian astronomers called the half chord jya.\n\nThe whole story, free, at noorcodex.com\n\n#DidYouKnow #Islam',
  video: 'https://noorcodex.com/reels/know-sine.mp4', cover: 'https://noorcodex.com/reels/know-sine-cover.jpg' };

console.log('\nconfigured');
{
  ok(TH.configured() === true && CH.configured.threads() === true, 'a long-lived token makes the channel live');
  ok(CH.SPEC.threads && CH.SPEC.threads.live === true && CH.SPEC.threads.chars === 500 && CH.SPEC.threads.tags === 2 && CH.ALL.includes('threads'), 'and the spec lists it: 500 characters, two tags');
  ok(CH.SPEC.threads.image === 'optional' && CH.SPEC.threads.video === 'optional', 'a picture and a video are both optional, so cards and reels both reach it');
  const tok = process.env.TH_TOKEN; delete process.env.TH_TOKEN;
  ok(TH.configured() === false && !SOC.liveChannels(CARD).includes('threads'), 'without the token it is not live and never among the live channels');
  process.env.TH_TOKEN = tok;
  ok(SOC.liveChannels(CARD).includes('threads'), 'with it, a card is offered to it');
  ok(TH.DAILY_LIMIT === 250, 'the 250-a-day ceiling is stated');
  /* and NOT enforced: there is no counter in the module. The house posts
     about ten a day; a counter that can never be reached is a place for a
     bug to hide, and Meta says "limit reached" in words when it is. */
  const src = fs.readFileSync(new URL('../api/_threads.js', import.meta.url), 'utf8');
  ok(!/INCR|usedToday|DAILY_CAP/.test(src), 'and not counted client-side: the module keeps no daily counter');
  ok(JSON.stringify(CH.SPEC.threads).indexOf('250') === -1, 'the spec does not pretend to enforce it either');
}

console.log('\nthe shape');
{
  const sh = CH.shape(CARD, 'threads');
  ok(sh.text.startsWith("The cave in the Qur'an held two men for three nights\n\n"), 'the title first');
  ok(/\n\nJabal Thawr rises south of Makkah\.\n\n/.test(sh.text), 'then one line of the body: its first sentence, alone');
  ok(!/Abu Bakr|spider/.test(sh.text), 'the rest of the body stays home');
  ok(!/Read Surah|Bukhari/.test(sh.text), 'no todo, no basis: Threads reads as sentences, the link carries the rest');
  ok(sh.text.includes("https://noorcodex.com/?node=12") && sh.link === CARD.link, 'the link is in the text, and beside it for the card');
  ok(/#Seerah #Islam$/.test(sh.text) && !/#Hijrah|#NoorCodexOfLight/.test(sh.text), 'at most two tags, never a wall');
  ok(sh.text.length <= 500, 'inside 500 (' + sh.text.length + ')');
  ok(sh.image === CARD.image && sh.video === null, 'the card picture rides along, no video');

  const long = CH.shape({ ...CARD, body: ("Thawr rises south of Makkah and the road winds ").repeat(30) + "on." }, 'threads');
  ok(long.text.length <= 500, 'a sentence that never ends is cut so the whole fits (' + long.text.length + ')');
  ok(long.text.includes(CARD.link) && /#Seerah #Islam$/.test(long.text), 'and the link and the tags survive the cut');
  ok(/…\n\nhttps:/.test(long.text), 'the cut lands on the line, on a word');
  const bare = CH.shape({ ...CARD, image: null, tags: [] }, 'threads');
  ok(bare.image === null && !/#/.test(bare.text) && bare.link === CARD.link, 'no picture and no tags is still a post, with the link for its card');
  ok(TH.oneLine("First line without a stop\nSecond") === "First line without a stop", 'a body with no sentence end gives its first line');
  ok(TH.oneLine("Is it so? Yes.") === "Is it so?", 'a question mark ends a sentence');

  const reel = CH.shape({ title: REEL.hook, caption: REEL.caption, body: "x", link: "https://noorcodex.com/", image: REEL.cover, video: REEL.video, reel: true, kind: "know" }, 'threads');
  ok(reel.text === REEL.caption, 'a reel carries its audited caption whole');
  ok(reel.video === REEL.video && reel.image === REEL.cover, 'and the video, and the cover');
  const big = CH.shape({ caption: ("Al-Sufi drew each constellation twice. ").repeat(30), video: REEL.video }, 'threads');
  ok(big.text.length <= 500 && big.text.endsWith('…'), 'a caption over 500 is cut on a word to fit (' + big.text.length + ')');
}

console.log('\nthe send: text, image, video');
{
  const T = threads();
  const r = await TH.send({ text: "A sentence.\n\nhttps://noorcodex.com/", link: "https://noorcodex.com/" }, { fetch: T.fetch });
  ok(r.ok && r.id === "MC1" && r.media === "TEXT", 'a text post goes up and the media id comes back');
  ok(r.url === "https://www.threads.net/@noorcodex/post/DAbc", 'with where to read it');
  ok(kinds(T).join(' > ') === 'threads > threads_publish > M?fields=permalink', 'as a container, then a publish, then the permalink: ' + kinds(T).join(' > '));
  const c = T.calls[0];
  ok(c.method === "POST" && c.body.media_type === "TEXT" && c.body.text === "A sentence.\n\nhttps://noorcodex.com/" && c.body.link_attachment === "https://noorcodex.com/", 'the container is TEXT with the text and the link named as the attachment');
  ok(c.url === "https://graph.threads.net/v1.0/17841400000000001/threads", 'on the Threads graph under the user id in TH_USER_ID');
  ok(T.calls[1].body.creation_id === "C1", 'the publish names the container it made');
  ok(T.calls.every(x => x.headers.authorization === "Bearer " + TOKEN), 'the token travels as a Bearer header on every call');
  ok(T.calls.every(x => !x.url.includes(TOKEN) && !("access_token" in x.body)), 'and never in a url or a body');
  ok(!T.calls.some(x => /\/me\?/.test(x.url)), 'with TH_USER_ID set, /me is not asked');

  const T2 = threads();
  const sh = CH.shape(CARD, 'threads');
  const r2 = await TH.send(sh, { fetch: T2.fetch });
  ok(r2.ok && r2.media === "IMAGE" && T2.calls[0].body.media_type === "IMAGE" && T2.calls[0].body.image_url === CARD.image && T2.calls[0].body.text === sh.text, 'a card is an IMAGE container with the picture by url and the shaped text');
  ok(!("link_attachment" in T2.calls[0].body), 'a picture post carries its link in the text only: Threads allows no attachment beside a picture');
  ok(kinds(T2).slice(0, 3).join(' > ') === 'threads > C?fields=status,error_message > threads_publish', 'container, one look at its status (Meta wants every container looked at before it is published), then publish: ' + kinds(T2).join(' > '));

  const T3 = threads();
  const r3 = await TH.send({ text: "caption", image: "https://h/c.jpg", video: "https://h/r.mp4" }, { fetch: T3.fetch });
  ok(r3.ok && r3.media === "VIDEO" && T3.calls[0].body.media_type === "VIDEO" && T3.calls[0].body.video_url === "https://h/r.mp4", 'a reel is a VIDEO container by url');
  ok(!("image_url" in T3.calls[0].body), 'and the cover is not sent beside it');
  ok(kinds(T3).join(' > ') === 'threads > C?fields=status,error_message > threads_publish > M?fields=permalink', 'container, one look at its status, publish: ' + kinds(T3).join(' > '));
}

console.log('\nthe user id, resolved once when TH_USER_ID is absent');
{
  const uid = process.env.TH_USER_ID; delete process.env.TH_USER_ID;
  const T = threads();
  const a = await TH.send({ text: "one" }, { fetch: T.fetch });
  const b = await TH.send({ text: "two" }, { fetch: T.fetch });
  ok(a.ok && b.ok, 'two posts go up');
  ok(T.calls.filter(x => /\/me\?fields=id,username$/.test(x.url)).length === 1, '/me is asked once and the answer kept in memory');
  ok(T.calls.filter(x => /\/threads$/.test(x.url)).every(x => x.url.includes("/17841400000000001/")), 'and both containers go under the id it answered');
  process.env.TH_USER_ID = uid;
}

console.log('\na video still processing is handed back, and finished later by the real finishPendingReels');
{
  const T = threads({ videoStatus: "IN_PROGRESS" });
  const r = await TH.send({ text: "caption", video: REEL.video }, { fetch: T.fetch });
  ok(!r.ok && r.pending === "C1" && /next run/.test(r.err), 'the container is handed back as pending, with a sentence that says so');
  ok(!T.calls.some(x => /threads_publish/.test(x.url)), 'nothing is published while it processes');
  ok(T.calls.filter(x => /status,error_message/.test(x.url)).length === 1, 'the run spends one look on it, not thirty seconds');
  ok(SOC.slotState({ threads: r, facebook: { ok: true } }) === 'pending', 'and the slot reads pending');
  ok(!SOC.healable(r), 'the healer leaves a pending container alone: it is finished, never re-sent');

  /* the hourly run finds it on the record and finishes it, through the same
     store-backed path that finishes an Instagram story container */
  process.env.KV_REST_API_URL = 'https://kv.test'; process.env.KV_REST_API_TOKEN = 't';
  const STORE = new Map();
  const realFetch = globalThis.fetch;
  const M = threads();
  globalThis.fetch = async (url, opt) => {
    const u = String(url);
    if (u.startsWith('https://kv.test')) {
      const cmds = JSON.parse(opt.body);
      return { ok: true, json: async () => cmds.map(([v, k, val]) => v === 'GET' ? { result: STORE.has(k) ? STORE.get(k) : null } : (v === 'SET' ? (STORE.set(k, val), { result: 'OK' }) : { result: null })) };
    }
    return M.fetch(url, opt);
  };
  const DATE = '2026-09-07';
  STORE.set('nsoc:slot:' + DATE + '#reelA', JSON.stringify({ at: 'x', slot: 'reelA', state: 'pending', title: 'v',
    results: { facebook: { ok: true, id: 'F1' }, threads: { ok: false, pending: 'C1', err: 'processing' } } }));
  M.set("IN_PROGRESS");
  let ran = await SOC.finishPendingReels(DATE, { ran: [] });
  let rec = JSON.parse(STORE.get('nsoc:slot:' + DATE + '#reelA'));
  ok(rec.state === 'pending' && rec.results.threads.pending === 'C1', 'still processing: the record is left as it was');
  ok(ran.some(x => x.where === 'threads' && x.state === 'pending'), 'and the run says so');
  ok(!M.calls.some(x => /threads_publish/.test(x.url)), 'nothing published yet');
  M.set("FINISHED");
  ran = await SOC.finishPendingReels(DATE, { ran: [] });
  rec = JSON.parse(STORE.get('nsoc:slot:' + DATE + '#reelA'));
  ok(rec.results.threads.ok && rec.results.threads.id === 'MC1', 'finished: finishPendingReels publishes the container from the record');
  ok(rec.state === 'sent', 'and the slot moves from pending to sent');
  ok(rec.results.facebook.ok && rec.results.facebook.id === 'F1' && !rec.igId, 'the other network is untouched and no Instagram id is invented');
  ok(ran.some(x => x.where === 'threads' && x.finished && x.ok), 'and the run says it was finished');
  const pub = M.calls.find(x => /threads_publish/.test(x.url));
  ok(pub && pub.body.creation_id === 'C1' && pub.url.includes('/17841400000000001/'), 'by publishing that container under the user');
  ok(M.calls.every(x => !x.url.includes(TOKEN)), 'the token is in no url');
  ok(STORE.has('nsoc:th:seen') && !STORE.get('nsoc:th:seen').includes(TOKEN), 'the day the token was first seen working is noted, without the token');

  /* a container Meta gave up on */
  STORE.set('nsoc:slot:' + DATE + '#reelB', JSON.stringify({ at: 'x', slot: 'reelB', state: 'pending', title: 'v', results: { threads: { ok: false, pending: 'C9' } } }));
  M.set("ERROR");
  ran = await SOC.finishPendingReels(DATE, { ran: [] });
  rec = JSON.parse(STORE.get('nsoc:slot:' + DATE + '#reelB'));
  ok(!rec.results.threads.ok && !rec.results.threads.pending && /could not process/.test(rec.results.threads.error) && rec.state === 'failed', 'an ERROR status ends the wait: the record says failed with the reason');
  ok(SOC.healable(rec.results.threads), 'and the healer may make a new container next hour');

  /* an Instagram story container beside it is still finished: the walk is channel-generic */
  STORE.set('nsoc:slot:' + DATE + '#reelC', JSON.stringify({ at: 'x', slot: 'reelC', state: 'sent', title: 'v', results: { instagram: { ok: true, id: 'IG1', story: { ok: false, pending: 'ig-c1' } } } }));
  process.env.IG_USER_ID = '456'; process.env.IG_TOKEN = 'igtok';
  const igCalls = [];
  globalThis.fetch = async (url, opt) => {
    const u = String(url);
    if (u.startsWith('https://kv.test')) {
      const cmds = JSON.parse(opt.body);
      return { ok: true, json: async () => cmds.map(([v, k, val]) => v === 'GET' ? { result: STORE.has(k) ? STORE.get(k) : null } : (v === 'SET' ? (STORE.set(k, val), { result: 'OK' }) : { result: null })) };
    }
    if (u.includes('graph.facebook.com') || u.includes('graph.instagram.com')) {
      igCalls.push(u);
      if (u.includes('status_code')) return reply(200, { status_code: 'FINISHED' });
      if (u.includes('media_publish')) return reply(200, { id: 'ig-story-1' });
    }
    return M.fetch(url, opt);
  };
  ran = await SOC.finishPendingReels(DATE, { ran: [] });
  rec = JSON.parse(STORE.get('nsoc:slot:' + DATE + '#reelC'));
  ok(rec.results.instagram.story.ok && rec.results.instagram.story.id === 'ig-story-1' && rec.state === 'sent', 'the Instagram story container is still finished by the same walk');
  ok(ran.some(x => x.where === 'instagram story' && x.ok), 'and reported as before');
  delete process.env.IG_USER_ID; delete process.env.IG_TOKEN;
  globalThis.fetch = realFetch;
  delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN;
}

console.log('\nwhat Meta can say back');
{
  const mk = (status, error, extra) => threads({ answer: (u) => /\/threads$|\/me\?/.test(u) ? reply(status, { error: { message: error, type: "OAuthException", ...(extra || {}) } }) : null });
  const sh = CH.shape(CARD, 'threads');

  const expired = await TH.send(sh, { fetch: mk(400, "Error validating access token: Session has expired on Sunday", { code: 190, error_subcode: 463 }).fetch });
  ok(!expired.ok && expired.fatal && expired.code === 190, 'code 190 is fatal: a person, not a retry');
  ok(/expired/.test(expired.err) && /\/api\/threads\?action=auth/.test(expired.err) && /TH_TOKEN/.test(expired.err), 'and says in words to open the door and paste TH_TOKEN: ' + expired.err);
  ok(!SOC.healable(expired), 'the healer leaves it alone');
  const unauth = await TH.send(sh, { fetch: mk(401, "Invalid OAuth access token - Cannot parse access token", { code: 190 }).fetch });
  ok(!unauth.ok && unauth.fatal && unauth.code === 190, 'as is a 401');

  const limit = await TH.send(sh, { fetch: mk(400, "Application request limit reached", { code: 4 }).fetch });
  ok(!limit.ok && !limit.fatal && limit.wait > 0 && /rate limiting/.test(limit.err) && /250/.test(limit.err), 'a rate limit is a wait, with the ceiling named');
  ok(SOC.healable(limit), 'so the healer comes back for it');
  const many = await TH.send(sh, { fetch: mk(429, "Too many requests").fetch });
  ok(!many.ok && many.wait > 0, 'as is a 429');

  const perm = await TH.send(sh, { fetch: mk(400, "(#10) Application does not have permission for this action", { code: 10 }).fetch });
  ok(!perm.ok && perm.fatal && /threads_content_publish/.test(perm.err) && /tester/.test(perm.err), 'a permission fault is fatal and names the scope and the tester invitation');
  ok(!SOC.healable(perm), 'and is left to a person');

  const cold = await TH.send(sh, { fetch: mk(400, "Media could not be fetched from the URL", { code: 9004, error_subcode: 2207052 }).fetch });
  ok(!cold.ok && !cold.fatal && /retried next hour/.test(cold.err), 'a card Meta could not fetch is retried, not abandoned');

  const other = await TH.send(sh, { fetch: mk(400, "Something else entirely", { code: 100 }).fetch });
  ok(!other.ok && other.err === "Something else entirely" && other.code === 100, 'anything else is quoted verbatim with its code');
  const html = await TH.send(sh, { fetch: threads({ answer: () => ({ ok: false, status: 502, text: async () => "<html>bad gateway</html>" }) }).fetch });
  ok(!html.ok && html.err === "http 502", 'a non-JSON answer is its status, nothing more');

  const failed = await TH.send({ text: "c", video: REEL.video }, { fetch: threads({ videoStatus: "ERROR" }).fetch });
  ok(!failed.ok && !failed.pending && /could not process the video: ERROR/.test(failed.err), 'a video Meta could not process is a failure that says so, not a pending');
  const pubFail = await TH.send({ text: "c" }, { fetch: threads({ answer: u => /threads_publish$/.test(u) ? reply(400, { error: { message: "Media ID is not available", code: 9007 } }) : null }).fetch });
  ok(!pubFail.ok && pubFail.step === "publish" && /not available/.test(pubFail.err), 'a publish that fails names its step');

  /* the first real card: created, then "does not exist" a second later,
     because Meta had not finished fetching the picture */
  {
    let n = 0;
    const late = threads({ answer: u => /threads_publish$/.test(u) && ++n < 3 ? reply(400, { error: { message: "The requested resource does not exist", code: 24, error_subcode: 4279009 } }) : null });
    const r = await TH.send(sh, { fetch: late.fetch });
    ok(r.ok && r.media === "IMAGE" && n === 3, 'a publish answered "does not exist" (24 / 4279009) is asked again after a moment, and the third answer is the post: ' + JSON.stringify({ ok: r.ok, n }));
    const pubs = late.calls.filter(x => /threads_publish$/.test(x.url));
    ok(pubs.length === 3 && pubs.every(x => x.body.creation_id === "C1"), 'the same container every time, never a new one');
    let m = 0;
    const never = threads({ answer: u => /threads_publish$/.test(u) && ++m ? reply(400, { error: { message: "The requested resource does not exist", code: 24, error_subcode: 4279009 } }) : null });
    const r2 = await TH.send(sh, { fetch: never.fetch });
    ok(!r2.ok && r2.code === 24 && m === 3 && /had not finished preparing/.test(r2.err), 'three answers of "does not exist" and it fails in words, with the hour to retry: ' + r2.err);
    const slow = threads({ videoStatus: "IN_PROGRESS" });
    const r3 = await TH.send(sh, { fetch: slow.fetch });
    const looks = slow.calls.filter(x => /fields=status/.test(x.url)).length;
    ok(r3.ok && looks === 3, 'a picture still IN_PROGRESS is looked at three times and then published anyway, never handed back as pending: ' + looks + ' looks, ' + JSON.stringify(r3.ok));
  }

  const down = await TH.send(sh, { fetch: async () => { throw new Error("fetch failed access_token=" + TOKEN + " " + TOKEN); } });
  ok(!down.ok && /did not answer/.test(down.err), 'a network fault is reported, not thrown');
  const echo = await TH.send(sh, { fetch: mk(400, "see https://graph.threads.net/v1.0/me?access_token=" + TOKEN, { code: 100 }).fetch });
  const all = [expired, unauth, limit, many, perm, cold, other, html, failed, pubFail, down, echo].map(x => JSON.stringify(x)).join("\n");
  ok(!all.includes(TOKEN), 'the token appears in no sentence that leaves the module, even one that echoes it');
  ok(/<token>/.test(down.err) && /<token>/.test(echo.err), 'it is masked where it was echoed');

  const tok = process.env.TH_TOKEN; delete process.env.TH_TOKEN;
  const off = await TH.send(sh, { fetch: threads().fetch });
  ok(!off.ok && off.skipped && /TH_TOKEN/.test(off.err), 'not connected is a skip that names the variable');
  ok(!SOC.healable(off), 'and is not healed');
  process.env.TH_TOKEN = tok;
  const empty = await TH.send({ text: "" }, { fetch: threads().fetch });
  ok(!empty.ok && empty.fatal, 'nothing to say is not sent');
  const over = await TH.send({ text: "x".repeat(501) }, { fetch: threads().fetch });
  ok(!over.ok && over.fatal && /500/.test(over.err), 'over 500 is refused before any call');
}

console.log('\nthe diagnosis');
{
  process.env.KV_REST_API_URL = 'https://kv.test'; process.env.KV_REST_API_TOKEN = 't';
  const STORE = new Map();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opt) => {
    const u = String(url);
    if (u.startsWith('https://kv.test')) {
      const cmds = JSON.parse(opt.body);
      return { ok: true, json: async () => cmds.map(([v, k, val]) => v === 'GET' ? { result: STORE.has(k) ? STORE.get(k) : null } : (v === 'SET' ? (STORE.set(k, val), { result: 'OK' }) : { result: null })) };
    }
    return { ok: false, status: 404, headers: { get: () => '' }, json: async () => ({}), text: async () => '' };
  };
  const DATE = '2026-09-07';
  const opts = { plan: { hijri: { text: '' }, day: {}, leads: [] }, index: { words: [{ i: 1, t: 'Qalqalah', a: 'ق', s: 'a bounce' }], path: [] },
                 extras: { entry: { s: 'a bounce', l: '', cat: 'Tajwid', k: 'editorial' } }, dials: { polish: false } };
  const expired = await TH.send({ text: "t" }, { fetch: threads({ answer: () => reply(400, { error: { message: "Session has expired", code: 190 } }) }).fetch });
  STORE.set('nsoc:slot:' + DATE + '#word', JSON.stringify({ at: 'x', slot: 'word', state: 'failed', title: 'Qalqalah', results: { threads: expired } }));
  const d = await SOC.diagnoseSlot('noorcodex.com', DATE, 'word', 'threads', opts);
  ok(d.ok && d.fix === 'token' && /expired|revoked/.test(d.cause), 'an expired token is diagnosed as a token fault');
  ok(d.steps.some(s => /\/api\/threads\?action=renew/.test(s)) && d.steps.some(s => /TH_TOKEN/.test(s)), 'with the renew door and the variable named, not Business Suite');
  ok(d.canRetry === false, 'and no retry offered: a person has to act');
  const limit = await TH.send({ text: "t" }, { fetch: threads({ answer: () => reply(400, { error: { message: "Application request limit reached", code: 4 } }) }).fetch });
  STORE.set('nsoc:slot:' + DATE + '#word', JSON.stringify({ at: 'x', slot: 'word', state: 'failed', title: 'Qalqalah', results: { threads: limit } }));
  const d2 = await SOC.diagnoseSlot('noorcodex.com', DATE, 'word', 'threads', opts);
  ok(d2.fix === 'wait' && /250/.test(d2.steps.join(' ')) && d2.canRetry === true, 'a rate limit is a wait, the ceiling named');
  STORE.set('nsoc:slot:' + DATE + '#reelA', JSON.stringify({ at: 'x', slot: 'reelA', state: 'pending', title: 'v', results: { threads: { ok: false, pending: 'C1' } } }));
  const d3 = await SOC.diagnoseSlot('noorcodex.com', DATE, 'reelA', 'threads', opts);
  ok(d3.fix === 'finish' && /^Threads has the video/.test(d3.cause), 'a pending container is named as Threads\' and offered Finish');
  const gaveUp = await TH.send({ text: "c", video: REEL.video }, { fetch: threads({ videoStatus: "EXPIRED" }).fetch });
  STORE.set('nsoc:slot:' + DATE + '#word', JSON.stringify({ at: 'x', slot: 'word', state: 'failed', title: 'Qalqalah', results: { threads: gaveUp } }));
  const d4 = await SOC.diagnoseSlot('noorcodex.com', DATE, 'word', 'threads', opts);
  ok(d4.fix === 'retry' && /could not process the video/.test(d4.cause) && d4.canRetry === true, 'a container Meta let expire is a retry, not a token fault');
  globalThis.fetch = realFetch;
  delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN;
}

console.log('\na reel, end to end through the channel table');
{
  const p = S.buildSlot('reelA', { date: '2026-09-07', link: 'https://noorcodex.com/', reel: REEL });
  ok(p.only.includes('threads'), 'a reel names Threads among the channels that can show it');
  ok(SOC.liveChannels(p).includes('threads'), 'and it is live for one');
  const sh = CH.shape(p, 'threads');
  ok(sh.video === REEL.video && sh.text === REEL.caption, 'the shape carries the video and the caption whole');
  const T = threads();
  const r = await CH.SENDERS.threads(sh, { fetch: T.fetch });
  ok(r.ok && T.calls[0].body.media_type === "VIDEO" && T.calls[0].body.video_url === REEL.video && T.calls[0].body.text === REEL.caption, 'the sender posts it as a video by url with the caption');
  const card = S.buildSlot('word', { date: '2026-09-07', link: 'https://h/', image: 'https://h/api/card?slot=word', entry: { term: 'Sabr', ar: 'ص', short: 's', long: 'l', id: 'sabr' }, words: [] });
  ok(!card || !CH.shape(card, 'threads').video, 'a word card carries no video to it');
}

console.log('\nthe door');
{
  const u = new URL(TH.authUrl('noorcodex.com', 'st.ate'));
  ok(u.origin + u.pathname === 'https://threads.net/oauth/authorize', 'the consent is asked at threads.net');
  ok(u.searchParams.get('redirect_uri') === 'https://noorcodex.com/threads/callback', 'the redirect is /threads/callback on the site');
  ok(u.searchParams.get('scope') === 'threads_basic,threads_content_publish' && u.searchParams.get('response_type') === 'code', 'the two scopes: basic and publish, nothing else');
  ok(u.searchParams.get('client_id') === '1234567890' && u.searchParams.get('state') === 'st.ate', 'the app id and the state ride along');
  const vj = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  ok(vj.rewrites.some(r => r.source === '/threads/callback' && r.destination === '/api/threads?action=callback'), 'vercel.json sends /threads/callback to the door');

  const st = state('admin-secret');
  ok(stateOk(st, 'admin-secret'), 'a state the house signed is accepted');
  ok(!stateOk(st, 'other'), 'and refused under another secret');
  ok(!stateOk(st.replace(/\.[0-9a-f]+$/, '.' + '0'.repeat(64)), 'admin-secret'), 'a forged signature is refused');
  const old = (Date.now() - 1000) + '.' + (await import('crypto')).createHmac('sha256', 'admin-secret').update('th' + (Date.now() - 1000)).digest('hex');
  ok(!stateOk(old, 'admin-secret'), 'an expired state is refused');
  ok(!stateOk(st, ''), 'no secret, no door');

  /* the exchange: the code for a short-lived token, that for a long one */
  const X = threads({ answer: (u, b) => {
    /* Meta sends the id as a bare seventeen-digit number, past what a JS
       number keeps: the raw text is what the module has to read */
    if (u === 'https://graph.threads.net/oauth/access_token') return { ok: true, status: 200, text: async () => '{"access_token":"THshort","user_id":17841400000000001,"junk":1}' };
    if (u.startsWith('https://graph.threads.net/access_token?')) return reply(200, { access_token: 'THlongLived', token_type: 'bearer', expires_in: 5183944 });
    return null;
  } });
  const raw = [];
  const xf = async (url, init = {}) => { raw.push({ url: String(url), body: String(init.body || '') }); return X.fetch(url, { ...init, body: undefined }); };
  const x = await TH.exchange('noorcodex.com', 'the-code#_', xf);
  ok(x.ok && x.token === 'THlongLived' && Math.round(x.expiresIn / 86400) === 60, 'the code becomes a long-lived token, sixty days');
  ok(x.userId === '17841400000000001', 'and the user id, all seventeen digits, not rounded by JSON.parse: ' + x.userId);
  ok(raw[0].url === 'https://graph.threads.net/oauth/access_token' && /grant_type=authorization_code/.test(raw[0].body) && /code=the-code(&|$)/.test(raw[0].body) && /redirect_uri=https%3A%2F%2Fnoorcodex.com%2Fthreads%2Fcallback/.test(raw[0].body), 'the code goes by POST with the redirect, its trailing #_ stripped');
  ok(/client_secret=s3cret-app-secret/.test(raw[0].body), 'the app secret rides in the body');
  ok(raw[1].url.startsWith('https://graph.threads.net/access_token?') && /grant_type=th_exchange_token/.test(raw[1].url) && /access_token=THshort/.test(raw[1].url), 'then the short one is exchanged for the long one');
  const bad = await TH.exchange('noorcodex.com', 'c', async () => reply(400, { error: { message: 'Invalid redirect_uri', code: 100 } }));
  ok(!bad.ok && /redirect_uri/.test(bad.err), 'a refused exchange says what Meta said');

  const rf = [];
  const ren = await TH.refresh(undefined, async url => { rf.push(String(url)); return reply(200, { access_token: 'THrenewed', expires_in: 5184000 }); });
  ok(ren.ok && ren.token === 'THrenewed' && /grant_type=th_refresh_token/.test(rf[0]) && rf[0].startsWith('https://graph.threads.net/refresh_access_token?'), 'a renewal asks for sixty more days on the token');

  /* the callback page, through the handler: the token is shown once */
  const res = () => { const r = { code: 0, headers: {}, body: '', setHeader: (k, v) => { r.headers[k] = v; }, status: c => { r.code = c; return r; }, send: b => { r.body = String(b); return r; }, json: b => { r.body = JSON.stringify(b); return r; }, writeHead: (c, h) => { r.code = c; Object.assign(r.headers, h); }, end: () => r }; return r; };
  const realFetch = globalThis.fetch;
  globalThis.fetch = xf;
  const cb = res();
  await door({ headers: { host: 'noorcodex.com' }, query: { action: 'callback', code: 'the-code#_', state: state('admin-secret') } }, cb);
  ok(cb.code === 200 && /Meta said yes/.test(cb.body), 'the callback page says yes');
  ok(/TH_TOKEN<\/div><span class=v>THlongLived<\/span>/.test(cb.body), 'and shows TH_TOKEN once');
  ok(/TH_USER_ID<\/div><span class=v>17841400000000001<\/span>/.test(cb.body), 'and TH_USER_ID beside it');
  ok(/keeps no copy/.test(cb.body) && cb.headers['Cache-Control'] === 'no-store' && cb.headers['Referrer-Policy'] === 'no-referrer', 'says the house keeps no copy, and the page is not cached or referred');
  ok(!/s3cret-app-secret/.test(cb.body), 'the app secret is not on the page');
  const stale = res();
  await door({ headers: { host: 'noorcodex.com' }, query: { action: 'callback', code: 'c', state: 'bad.state' } }, stale);
  ok(stale.code === 400 && /did not start here/.test(stale.body), 'a callback without the house\'s state is refused');
  const no = res();
  await door({ headers: { host: 'noorcodex.com' }, query: { action: 'callback', error: 'access_denied', state: state('admin-secret') } }, no);
  ok(no.code === 400 && /Meta said no/.test(no.body), 'a refusal at the consent screen is a page, not a crash');
  const auth = res();
  await door({ headers: { host: 'noorcodex.com', 'x-admin-key': 'admin-secret' }, query: { action: 'auth' } }, auth);
  ok(auth.code === 302 && String(auth.headers.Location || '').startsWith('https://threads.net/oauth/authorize?'), 'auth sends the owner to the consent screen');
  ok(/state=\d+\.[0-9a-f]{64}/.test(auth.headers.Location || ''), 'with a signed state');
  const cold = res();
  await door({ headers: { host: 'noorcodex.com' }, query: { action: 'auth' } }, cold);
  ok(cold.code === 401 || cold.code === 403, 'but not a stranger');
  const rn = res();
  globalThis.fetch = async url => reply(200, { access_token: 'THrenewed2', expires_in: 5184000 });
  await door({ headers: { host: 'noorcodex.com', 'x-admin-key': 'admin-secret' }, query: { action: 'renew' } }, rn);
  ok(rn.code === 200 && /TH_TOKEN<\/div><span class=v>THrenewed2<\/span>/.test(rn.body) && /Sixty more days/.test(rn.body), 'renew shows the fresh token once');
  globalThis.fetch = realFetch;
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
