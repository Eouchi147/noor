/* NOOR · YouTube Shorts, with Google stubbed.
   ------------------------------------------------------------------
   The reel's third home. What has to be true: a card never reaches a
   channel that takes only video; the title is the hook with #Shorts on it
   and never over 100; the caption is the description, verbatim; the token
   is minted from the refresh token and never appears in a URL; the daily
   cap holds; an upload Google keeps private is reported as private, not as
   published; and invalid_grant is fatal, not retried.

   Run:  node tests/youtube.mjs
*/
process.env.YT_CLIENT_ID = "id.apps.googleusercontent.com";
process.env.YT_CLIENT_SECRET = "s3cret";
process.env.YT_REFRESH_TOKEN = "1//refresh";
delete process.env.KV_REST_API_URL; delete process.env.REDIS_URL; delete process.env.KV_URL;

import * as YT from "../api/_youtube.js";
import * as CH from "../api/_channels.js";
import * as S from "../api/_schedule.js";
import * as SOC from "../api/social.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const REEL = { id: 'know-sine', hook: 'The word sine is a translation mistake', caption: 'Indian astronomers called the half chord jya.\n\nThe whole story, free, at noorcodex.com\n\n#DidYouKnow #Islam #Arabic #NoorCodexOfLight',
  video: 'https://h/reels/know-sine.mp4', cover: 'https://h/reels/know-sine-cover.jpg' };

console.log('\nthe shape');
{
  const p = S.buildSlot('reelA', { date: '2026-09-07', link: 'https://h/', reel: REEL });
  ok(p.only.includes('youtube'), 'a reel names YouTube among the channels that can show it');
  const sh = CH.shape(p, 'youtube');
  ok(sh.title === 'The word sine is a translation mistake #Shorts', 'the title is the hook with #Shorts: ' + sh.title);
  ok(sh.description === REEL.caption, 'the description is the caption, verbatim');
  ok(sh.tags.includes('NoorCodexOfLight') && sh.tags.includes('Islam') && sh.tags.length <= 15, 'the hashtags become tags, capped at 15');
  const long = YT.title({ hook: 'x'.repeat(140) });
  ok(long.length <= 100 && long.endsWith('#Shorts'), 'a long hook is cut so the title stays within 100 and keeps #Shorts');

  /* the ordinary 16:9 video that rides beside a short's own Short: the
     owner's instruction of 16 September 2026. Not filed as a Short, so no
     #Shorts and the film's own title stands, never the hook. */
  ok(YT.titlePlain({ title: 'The Film\'s Own Title', hook: 'A different hook' }) === 'The Film\'s Own Title',
    'titlePlain prefers the title over the hook: ' + YT.titlePlain({ title: 'The Film\'s Own Title', hook: 'x' }));
  const plainLong = YT.titlePlain({ title: 'x'.repeat(140) });
  ok(plainLong.length <= 100 && !plainLong.includes('#Shorts'), 'a long title is cut to 100 and never carries #Shorts: ' + plainLong);
  const wideShaped = YT.shapeWide({ title: 'The Film\'s Own Title', hook: 'A different hook', caption: 'The long story.\n\nSource: x\n\nhttps://h/room\n\n#Islam #NoorCodexOfLight', video: 'https://h/wide.mp4' });
  ok(wideShaped.title === 'The Film\'s Own Title', 'shapeWide titles the video the film\'s own title');
  ok(wideShaped.video === 'https://h/wide.mp4', 'shapeWide carries the video it is given');
  ok(wideShaped.description.startsWith('The long story.'), 'shapeWide\'s description is the caption it is given, verbatim');

  const card = S.buildSlot('word', { date: '2026-09-07', link: 'https://h/', entry: { term: 'Sabr', ar: 'ص', short: 's', long: 'l', id: 'sabr' }, words: [] });
  ok(!card || !card.video, 'a word card carries no video');
  ok(!SOC.liveChannels(card || {}).includes('youtube'), 'and the live channels for it never include YouTube, even when YouTube is connected');
  ok(SOC.liveChannels(p).includes('youtube'), 'while a reel\'s live channels do');
}

console.log('\nthe upload');
{
  const calls = [];
  const fetcher = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('oauth2.googleapis.com/token'))
      return { ok: true, status: 200, json: async () => ({ access_token: 'ya29.token', expires_in: 3599 }) };
    if (String(url).endsWith('.mp4'))
      return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(30000).buffer };
    if (String(url).includes('upload/youtube/v3/videos'))
      return { ok: true, status: 200, json: async () => ({ id: 'abc123', status: { privacyStatus: 'public', uploadStatus: 'uploaded' } }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const sh = { ...YT.shape({ hook: REEL.hook, caption: REEL.caption }), video: REEL.video };
  const r = await YT.upload(sh, { fetch: fetcher, date: '2026-09-07' });
  ok(r.ok && r.id === 'abc123' && r.url === 'https://youtube.com/shorts/abc123', 'a good upload returns the Shorts url');
  ok(!r.private, 'and is not marked private');
  const up = calls.find(c => c.url.includes('upload/youtube'));
  ok(up && /^Bearer ya29\.token$/.test(up.init.headers.authorization), 'the access token travels in the Authorization header');
  ok(calls.every(c => !/refresh|s3cret|ya29/.test(c.url)), 'no token or secret ever appears in a URL');
  const bodyStr = up.init.body.toString('latin1');
  ok(/"privacyStatus":"public"/.test(bodyStr) && /"selfDeclaredMadeForKids":false/.test(bodyStr), 'it asks for public, not made for kids');
  ok(/"title":"The word sine is a translation mistake #Shorts"/.test(bodyStr), 'the metadata carries the title');
  ok(/content-type: video\/mp4/.test(bodyStr) && /multipart\/related/.test(up.init.headers['content-type']), 'the file rides in one multipart request');
  const tok = calls.find(c => c.url.includes('oauth2.googleapis.com/token'));
  ok(tok && /grant_type=refresh_token/.test(tok.init.body) && /refresh_token=1%2F%2Frefresh/.test(tok.init.body), 'the refresh token is exchanged for an access token in the POST body');
}

console.log('\nthe wide upload\'s own url is not filed under /shorts/');
{
  const fetcher = async (url) => {
    if (String(url).includes('oauth2.googleapis.com/token'))
      return { ok: true, status: 200, json: async () => ({ access_token: 'ya29.token', expires_in: 3599 }) };
    if (String(url).endsWith('.mp4'))
      return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(30000).buffer };
    if (String(url).includes('upload/youtube/v3/videos'))
      return { ok: true, status: 200, json: async () => ({ id: 'wide1', status: { privacyStatus: 'public' } }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const sh = YT.shapeWide({ title: 'The Film\'s Own Title', caption: 'A caption', video: REEL.video });
  const r = await YT.upload(sh, { fetch: fetcher, date: '2026-09-07', short: false });
  ok(r.ok && r.url === 'https://www.youtube.com/watch?v=wide1', 'an ordinary video\'s url is a plain watch link, not a Shorts one: ' + r.url);
  const s2 = { ...sh, video: REEL.video };
  const r2 = await YT.upload(s2, { fetch: fetcher, date: '2026-09-07' });
  ok(r2.ok && r2.url === 'https://youtube.com/shorts/wide1', 'omitting opts.short keeps the old Shorts url, the default for every call before this existed');
}

console.log('\nthe status check, the way fbReelStatus reads Facebook\'s');
{
  const mkStatus = reply => async (url) => {
    if (String(url).includes('oauth2.googleapis.com/token'))
      return { ok: true, status: 200, json: async () => ({ access_token: 'ya29.token', expires_in: 3599 }) };
    return reply;
  };
  const processed = await YT.status('v1', { fetch: mkStatus({ ok: true, status: 200, json: async () => ({ items: [{ status: { uploadStatus: 'processed' } }] }) }) });
  ok(processed.ok === true, 'a processed video reads clean');
  const dup = await YT.status('v2', { fetch: mkStatus({ ok: true, status: 200, json: async () => ({ items: [{ status: { uploadStatus: 'rejected', rejectionReason: 'duplicate' } }] }) }) });
  ok(dup.ok === false && dup.duplicate === true && dup.reason === 'duplicate', 'a rejection reads as a duplicate when YouTube names it one: ' + JSON.stringify(dup));
  const other = await YT.status('v3', { fetch: mkStatus({ ok: true, status: 200, json: async () => ({ items: [{ status: { uploadStatus: 'rejected', rejectionReason: 'copyright' } }] }) }) });
  ok(other.ok === false && other.duplicate === false && other.reason === 'copyright', 'a rejection for another reason is not read as a duplicate: ' + JSON.stringify(other));
  const stillGoing = await YT.status('v4', { fetch: mkStatus({ ok: true, status: 200, json: async () => ({ items: [{ status: { uploadStatus: 'uploaded' } }] }) }) });
  ok(stillGoing.ok === false && stillGoing.pending === true, 'accepted but not yet processed is pending, not a failure: ' + JSON.stringify(stillGoing));
  const gone = await YT.status('v5', { fetch: mkStatus({ ok: true, status: 200, json: async () => ({ items: [] }) }) });
  ok(gone.ok === false && gone.pending === true, 'no such video yet is also pending, one look is never enough to call it gone');
}

console.log('\nwhat Google can say back');
{
  const mk = (uploadReply, tokenReply) => async (url, init = {}) => {
    if (String(url).includes('oauth2.googleapis.com/token')) return tokenReply || { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3599 }) };
    if (String(url).endsWith('.mp4')) return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(30000).buffer };
    return uploadReply;
  };
  const sh = { ...YT.shape({ hook: 'h', caption: 'c #Islam #NoorCodexOfLight' }), video: REEL.video };
  const priv = await YT.upload(sh, { fetch: mk({ ok: true, status: 200, json: async () => ({ id: 'p1', status: { privacyStatus: 'private' } }) }), date: '2026-09-07' });
  ok(priv.ok && priv.private && /audit/.test(priv.note), 'a video Google keeps private is reported as uploaded but private, with the audit named');
  const quota = await YT.upload(sh, { fetch: mk({ ok: false, status: 403, json: async () => ({ error: { message: 'The request cannot be completed because you have exceeded your quota.', errors: [{ reason: 'quotaExceeded' }] } }) }), date: '2026-09-07' });
  ok(!quota.ok && quota.quota, 'quotaExceeded is named as a quota fault, which clears by itself');
  const grant = await YT.upload(sh, { fetch: mk(null, { ok: false, status: 400, json: async () => ({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }) }), date: '2026-09-07' });
  ok(!grant.ok && grant.fatal && grant.code === 'invalid_grant', 'a revoked consent is fatal: a person, not a retry');
  ok(!SOC.healable(grant), 'and the healer leaves it alone');
  ok(SOC.healable(quota), 'while a spent quota is healed later');
  const novid = await YT.upload({ ...sh, video: null }, { fetch: mk(null), date: '2026-09-07' });
  ok(!novid.ok && /no video/.test(novid.error), 'no video, no upload');
  delete process.env.YT_REFRESH_TOKEN;
  const off = await YT.upload(sh, { fetch: mk(null), date: '2026-09-07' });
  ok(!off.ok && off.skipped, 'not connected is a skip, not a failure');
  ok(!CH.configured.youtube(), 'and the channel reads as not configured');
  process.env.YT_REFRESH_TOKEN = '1//refresh';
}

console.log('\nthe consent');
{
  const u = new URL(YT.authUrl('noorcodex.com', 'st.ate'));
  ok(u.searchParams.get('redirect_uri') === 'https://noorcodex.com/youtube/callback', 'the redirect is /youtube/callback on the site');
  ok(u.searchParams.get('access_type') === 'offline' && u.searchParams.get('prompt') === 'consent', 'offline access with a forced consent, so a refresh token comes back');
  ok(u.searchParams.get('scope') === 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly', 'two scopes: upload to put a Short up, readonly to read what it did; nothing else');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
