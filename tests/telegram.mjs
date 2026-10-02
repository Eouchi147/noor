/* NOOR · Telegram, with the Bot API stubbed.
   ------------------------------------------------------------------
   The channel that is only a channel. What has to be true: two variables
   make it live and one missing makes it not; the caption under a picture
   never passes 1,024 characters counted after escaping; the three markup
   characters are escaped and the title is bold; the link is there; a reel's
   audited caption is carried whole; a reel goes as sendVideo by url, a card
   as sendPhoto, a bare post as sendMessage; the token appears in no sentence
   that leaves the module; a 429 hands back the seconds to wait; and a bot
   that is not an administrator is told so in words a person can act on.

   Run:  node tests/telegram.mjs        (no server, no network: fetch is stubbed)
*/
process.env.TG_BOT_TOKEN = "123456789:AAHsecretsecretsecretsecretsecret12";
process.env.TG_CHAT_ID = "@noorcodex";
delete process.env.KV_REST_API_URL; delete process.env.REDIS_URL; delete process.env.KV_URL;

import * as TG from "../api/_telegram.js";
import * as CH from "../api/_channels.js";
import * as S from "../api/_schedule.js";
import * as SOC from "../api/social.js";

const TOKEN = process.env.TG_BOT_TOKEN;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

/* ---------- a Telegram that answers ---------- */
const reply = (status, obj) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(obj), json: async () => obj });
const API_HOST = "https://api.telegram.org/";
/* a FormData, read back the way the assertions below want it: every field
   as its value, the file kept as the Blob it is so its type and size can
   be checked */
const formToObj = fd => { const o = {}; for (const [k, v] of fd.entries()) o[k] = v; return o; };
function telegram(opts = {}) {
  const calls = [];
  return {
    calls,
    fetch: async (url, init = {}) => {
      const u = String(url);
      if (!u.startsWith(API_HOST)) {
        /* the video's own url, not Telegram's: since 16 September 2026 this
           module fetches the bytes itself, so a test that never sets one up
           gets a small, ordinary "video" back rather than a thrown error */
        calls.push({ url: u, method: "GET" });
        if (opts.videoFetch) return opts.videoFetch(u);
        /* a stand-in reel, sized past MULTIPART_MIN (_telegram.js): since 16
           September 2026 anything under 100 KB is read as a fetch failure
           (a truncated body, a stub, a door's error page), never uploaded,
           so a test of a reel that actually sends needs a body that size */
        const bytes = opts.videoBytes || Buffer.alloc(200 * 1024, 7);
        return { ok: true, status: 200,
          headers: { get: k => (String(k).toLowerCase() === "content-length" ? String(bytes.length) : null) },
          arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
      }
      const method = u.slice(u.lastIndexOf("/") + 1);
      const body = init.body instanceof FormData ? formToObj(init.body) : (init.body ? JSON.parse(init.body) : {});
      calls.push({ url: u, method, body });
      if (opts.answer) return opts.answer(method, body);
      return reply(200, { ok: true, result: { message_id: 4471, chat: { id: -1001, username: "noorcodex" } } });
    }
  };
}

const CARD = { title: "The cave in the Qur'an held two men for three nights", body: "Jabal Thawr rises south of Makkah.",
  todo: ["Read Surah 9, ayah 40", "Find Thawr on the Hajj map"], basis: "Bukhari 3615", link: "https://noorcodex.com/?node=12",
  image: "https://noorcodex.com/api/card?slot=light&fmt=png", tags: ["#Seerah", "#Islam"] };

console.log('\nconfigured');
{
  ok(TG.configured() === true && CH.configured.telegram() === true, 'a token and a chat id make the channel live');
  ok(CH.SPEC.telegram && CH.SPEC.telegram.live === true && CH.ALL.includes('telegram'), 'and the spec lists it among the places a post can go');
  delete process.env.TG_CHAT_ID;
  ok(TG.configured() === false, 'without the chat id it is not');
  process.env.TG_CHAT_ID = "noorcodex";
  ok(TG.chatId() === "@noorcodex", 'a username typed without its @ is given one');
  process.env.TG_CHAT_ID = "-1001234567890";
  ok(TG.chatId() === "-1001234567890", 'a numeric id goes as it is');
  process.env.TG_CHAT_ID = "@noorcodex";
  const off = { ...process.env }; delete process.env.TG_BOT_TOKEN;
  ok(TG.configured() === false && !SOC.liveChannels(CARD).includes('telegram'), 'without the token it is not live and never among the live channels');
  process.env.TG_BOT_TOKEN = off.TG_BOT_TOKEN;
  ok(SOC.liveChannels(CARD).includes('telegram'), 'with both, a card is offered to it');
}

console.log('\nthe shape');
{
  const sh = CH.shape(CARD, 'telegram');
  ok(sh.text.startsWith("<b>The cave in the Qur'an held two men for three nights</b>"), 'the title is bold, and an apostrophe is left alone');
  ok(/Jabal Thawr rises south of Makkah\./.test(sh.text), 'the body follows');
  ok(/• Read Surah 9, ayah 40\n• Find Thawr on the Hajj map/.test(sh.text), 'the todo lines are bulleted');
  ok(/Bukhari 3615/.test(sh.text), 'the basis is there');
  ok(sh.text.includes("https://noorcodex.com/?node=12") && sh.link === "https://noorcodex.com/?node=12", 'and the link home, in the text and beside it');
  ok(!/#Seerah/.test(sh.text), 'the house adds no hashtag wall to a channel post');
  ok(sh.image === CARD.image && sh.video === null, 'the card image rides along, no video');

  const dirty = CH.shape({ ...CARD, title: "Sabr & <patience>", body: "a < b && c > d" }, 'telegram');
  ok(dirty.text.startsWith("<b>Sabr &amp; &lt;patience&gt;</b>"), 'ampersand and angle brackets are escaped in the title: ' + dirty.text.split("\n")[0]);
  ok(/a &lt; b &amp;&amp; c &gt; d/.test(dirty.text), 'and in the body');
  ok((dirty.text.match(/<b>/g) || []).length === 1 && !/<[^b/]/.test(dirty.text), 'the only tags in the message are the bold ones');

  const long = CH.shape({ ...CARD, body: ("Thawr & the spider's web. ").repeat(80) }, 'telegram');
  ok(long.text.length <= 1024, 'a long card is cut to fit under a picture, escaping counted (' + long.text.length + ')');
  ok(long.text.startsWith("<b>The cave"), 'the title survives the cut');
  ok(!/&[a-z]*$/.test(long.text.replace(/…$/, "")) && !/<b>[^<]*$/.test(long.text), 'the cut lands on a word, not inside an entity or a tag');

  const bare = CH.shape({ ...CARD, image: null, body: ("Thawr and the web. ").repeat(100) }, 'telegram');
  ok(bare.text.length > 1024 && bare.text.length <= 4096, 'a post with no picture has room for a message, 4,096 (' + bare.text.length + ')');

  const reel = CH.shape({ title: "The word sine is a translation mistake", caption: "Indian astronomers called the half chord jya & the Arabs wrote jayb.\n\n#DidYouKnow #Islam", body: "x",
    link: "https://noorcodex.com/", image: "https://noorcodex.com/reels/know-sine-cover.jpg", video: "https://noorcodex.com/reels/know-sine.mp4", reel: true, kind: "know" }, 'telegram');
  ok(reel.text === "Indian astronomers called the half chord jya &amp; the Arabs wrote jayb.\n\n#DidYouKnow #Islam", 'a reel carries its audited caption whole, escaped and nothing else');
  ok(reel.video === "https://noorcodex.com/reels/know-sine.mp4", 'and the video');
}

console.log('\nthe send');
{
  const T = telegram();
  const sh = CH.shape(CARD, 'telegram');
  const r = await TG.send(sh, { fetch: T.fetch });
  ok(r.ok && r.id === "4471", 'a card goes up and the message id comes back');
  ok(r.url === "https://t.me/noorcodex/4471", 'with where to read it on a public channel');
  const c = T.calls[0];
  ok(c.method === "sendPhoto" && c.body.photo === CARD.image, 'as sendPhoto, the picture by url');
  ok(c.body.chat_id === "@noorcodex" && c.body.parse_mode === "HTML" && c.body.caption === sh.text, 'to the channel, in HTML, with the shaped caption');
  ok(c.url === "https://api.telegram.org/bot" + TOKEN + "/sendPhoto", 'on the Bot API with the token in the path, as Telegram is built');

  const T2 = telegram();
  const r2 = await TG.send({ ...sh, image: null }, { fetch: T2.fetch });
  ok(r2.ok && T2.calls[0].method === "sendMessage" && T2.calls[0].body.text === sh.text && T2.calls[0].body.disable_web_page_preview === false, 'without a picture it is sendMessage, preview allowed');

  const T3 = telegram();
  const r3 = await TG.send({ text: "caption", image: "https://h/c.jpg", video: "https://h/r.mp4" }, { fetch: T3.fetch });
  ok(r3.ok, 'a reel sends');
  ok(T3.calls.some(c => c.url === "https://h/r.mp4"), 'its bytes are fetched from the url first, by this module, not handed to Telegram to fetch');
  const v = T3.calls.find(c => c.method === "sendVideo");
  ok(v && v.body.chat_id === "@noorcodex" && v.body.supports_streaming === "true", 'and posted to Telegram directly, as a video');
  ok(v.body.video instanceof Blob && v.body.video.type === "video/mp4", 'the file itself, not a url');
  ok(!("photo" in v.body), 'and the cover is not sent as a photo beside it');
}

console.log('\nwhat Telegram can say back');
{
  const mk = (status, description, extra) => telegram({ answer: () => reply(status, { ok: false, error_code: status, description, ...(extra || {}) }) });
  const sh = CH.shape(CARD, 'telegram');

  const slow = await TG.send(sh, { fetch: mk(429, "Too Many Requests: retry after 35", { parameters: { retry_after: 35 } }).fetch });
  ok(!slow.ok && slow.wait === 35 && !slow.fatal, '429 hands back the seconds to wait, and is not fatal');
  ok(SOC.healable(slow), 'so the healer comes back for it');

  const member = await TG.send(sh, { fetch: mk(403, "Forbidden: bot is not a member of the channel chat").fetch });
  ok(!member.ok && member.fatal && member.admin && /administrator of the channel/.test(member.err) && /Post messages/.test(member.err), '403 not a member says, in words, to make the bot an administrator with the right to post');
  ok(!SOC.healable(member), 'and the healer leaves it to a person');
  const chat = await TG.send(sh, { fetch: mk(400, "Bad Request: chat not found").fetch });
  ok(!chat.ok && chat.fatal && /administrator/.test(chat.err) && /TG_CHAT_ID/.test(chat.err), '400 chat not found says the same, and names the variable');
  const rights = await TG.send(sh, { fetch: mk(400, "Bad Request: need administrator rights in the channel chat").fetch });
  ok(!rights.ok && rights.admin, 'as does a bot in the channel without the rights');

  const auth = await TG.send(sh, { fetch: mk(401, "Unauthorized").fetch });
  ok(!auth.ok && auth.fatal && /BotFather/.test(auth.err), 'a token Telegram does not know is fatal and points at BotFather');
  /* the url limit is gone with the url upload: since 16 September 2026 this
     module reads the file itself and checks ITS OWN 50 MB ceiling before
     ever calling Telegram, so the refusal is a skip, not a fatal answer
     from the network */
  const bigT = telegram({ videoBytes: Buffer.alloc(0), videoFetch: () => ({ ok: true, status: 200,
    headers: { get: k => (String(k).toLowerCase() === "content-length" ? "60000000" : null) }, arrayBuffer: async () => new ArrayBuffer(0) }) });
  const big = await TG.send({ ...sh, video: "https://h/r.mp4" }, { fetch: bigT.fetch });
  ok(!big.ok && big.skipped && /50 MB/.test(big.err), 'a file over the upload limit is skipped, the limit named, before Telegram is ever asked');
  ok(!SOC.healable(big), 'and the healer leaves a permanent size skip alone');
  ok(!bigT.calls.some(c => c.url.startsWith(API_HOST)), 'and Telegram is never called for it');
  const cold = await TG.send(sh, { fetch: mk(400, "Bad Request: failed to get HTTP URL content").fetch });
  ok(!cold.ok && !cold.fatal && /retried next hour/.test(cold.err), 'a card Telegram could not fetch is retried, not abandoned');

  /* the refuter's two notes, 16 September 2026: a body shorter than its own
     declared content-length is a dropped connection, not a small file, and
     a body under 100 KB whatever its length said is not a real reel -- both
     are read as a fetch failure and never handed to Telegram as an upload */
  const declaredLen = 200 * 1024, gotShort = Buffer.alloc(9, 7);
  const short = telegram({ videoFetch: () => ({ ok: true, status: 200,
    headers: { get: k => (String(k).toLowerCase() === "content-length" ? String(declaredLen) : null) },
    arrayBuffer: async () => gotShort.buffer.slice(gotShort.byteOffset, gotShort.byteOffset + gotShort.byteLength) }) });
  const truncated = await TG.send({ ...sh, video: "https://h/r.mp4" }, { fetch: short.fetch });
  ok(!truncated.ok && !truncated.skipped && /dropped partway|9 of/.test(truncated.err), 'a body shorter than its own declared length is a fetch failure, not an upload: ' + truncated.err);
  ok(!short.calls.some(c => c.url.startsWith(API_HOST)), 'and Telegram is never called with the partial file');

  const tiny = telegram({ videoBytes: Buffer.alloc(9, 7) });
  const small = await TG.send({ ...sh, video: "https://h/r.mp4" }, { fetch: tiny.fetch });
  ok(!small.ok && !small.skipped && /too small/.test(small.err), 'a body under 100 KB is a fetch failure too, whatever it claims to be: ' + small.err);
  ok(!tiny.calls.some(c => c.url.startsWith(API_HOST)), 'and Telegram is never called with it either');
  const other = await TG.send(sh, { fetch: mk(400, "Bad Request: something else").fetch });
  ok(!other.ok && other.err === "Bad Request: something else" && other.code === 400, 'anything else is quoted verbatim with its code');
  const html = await TG.send(sh, { fetch: telegram({ answer: () => ({ ok: false, status: 502, text: async () => "<html>bad gateway</html>" }) }).fetch });
  ok(!html.ok && html.err === "http 502", 'a non-JSON answer is its status, nothing more');

  const down = await TG.send(sh, { fetch: async () => { throw new Error("fetch failed https://api.telegram.org/bot" + TOKEN + "/sendPhoto"); } });
  ok(!down.ok && /did not answer/.test(down.err), 'a network fault is reported, not thrown');
  const echo = await TG.send(sh, { fetch: mk(400, "Bad Request: see https://api.telegram.org/bot" + TOKEN + "/sendPhoto").fetch });
  const all = [slow, member, chat, rights, auth, big, cold, other, html, down, echo].map(x => JSON.stringify(x)).join("\n");
  ok(!all.includes(TOKEN) && !all.includes("AAHsecret"), 'the token appears in no sentence that leaves the module, even one that echoes the url');
  ok(/<token>/.test(down.err) && /<token>/.test(echo.err), 'it is masked where the url was echoed');

  delete process.env.TG_CHAT_ID;
  const off = await TG.send(sh, { fetch: telegram().fetch });
  ok(!off.ok && off.skipped && /TG_CHAT_ID/.test(off.err), 'not connected is a skip that names the variables');
  ok(!SOC.healable(off), 'and is not healed');
  process.env.TG_CHAT_ID = "@noorcodex";
  const empty = await TG.send({ text: "" }, { fetch: telegram().fetch });
  ok(!empty.ok && empty.fatal, 'nothing to say is not sent');
}

console.log('\na reel, end to end through the channel table');
{
  const REEL = { id: 'know-sine', kind: 'know', hook: 'The word sine is a translation mistake', caption: 'Indian astronomers called the half chord jya.\n\nThe whole story, free, at noorcodex.com\n\n#DidYouKnow #Islam',
    video: 'https://noorcodex.com/reels/know-sine.mp4', cover: 'https://noorcodex.com/reels/know-sine-cover.jpg' };
  const p = S.buildSlot('reelA', { date: '2026-09-07', link: 'https://noorcodex.com/', reel: REEL });
  ok(p.only.includes('telegram'), 'a reel names Telegram among the channels that can show it');
  ok(SOC.liveChannels(p).includes('telegram'), 'and it is live for one');
  const sh = CH.shape(p, 'telegram');
  ok(sh.video === REEL.video && sh.text === REEL.caption, 'the shape carries the video and the caption whole');
  const T = telegram();
  const r = await CH.SENDERS.telegram(sh, { fetch: T.fetch });
  ok(r.ok, 'the reel sends');
  ok(T.calls.some(c => c.url === REEL.video), 'the sender reads the video from its own url first');
  const v = T.calls.find(c => c.method === "sendVideo");
  ok(v && v.body.caption === REEL.caption && v.body.video instanceof Blob, 'and hands Telegram the file directly, with the caption');
  const card = S.buildSlot('word', { date: '2026-09-07', link: 'https://h/', image: 'https://h/api/card?slot=word', entry: { term: 'Sabr', ar: 'ص', short: 's', long: 'l', id: 'sabr' }, words: [] });
  ok(!card || !CH.shape(card, 'telegram').video, 'a word card carries no video to it');
}

/* ===========================================================================
   The owner's line: a private chat with the same bot, linked once by a code.
   The store is a tiny in-memory one with its own clock (so a 15 minute
   expiry can be watched happen), handed in as opts.kv/opts.kvReady the way
   tests/lineup.mjs hands one to api/_lineup.js.
=========================================================================== */
function makeKv() {
  const strings = new Map();
  const st = { clock: Date.parse('2026-10-02T09:00:00Z'), broken: false, cmds: [] };
  const live = k => { const e = strings.get(k); if (!e) return null; if (e.exp && e.exp <= st.clock) { strings.delete(k); return null; } return e; };
  st.strings = strings;
  st.kvReady = () => true;
  st.kv = async cmds => {
    if (st.broken) throw new Error('kv rest 500');
    return cmds.map(c => {
      st.cmds.push(c);
      const [op, k, ...a] = c;
      if (op === 'GET') { const e = live(k); return e ? e.v : null; }
      if (op === 'SET') { const i = a.indexOf('EX'); strings.set(k, { v: String(a[0]), exp: i >= 0 ? st.clock + Number(a[i + 1]) * 1000 : 0 }); return 'OK'; }
      if (op === 'DEL') { strings.delete(k); return 1; }
      if (op === 'INCR') { const e = live(k); const n = (e ? Number(e.v) : 0) + 1; strings.set(k, { v: String(n), exp: e ? e.exp : 0 }); return n; }
      if (op === 'EXPIRE') { const e = live(k); if (e) e.exp = st.clock + Number(a[0]) * 1000; return e ? 1 : 0; }
      return null;
    });
  };
  return st;
}
const OWNER_CHAT = 778899001;
const pm = (id, text, extra = {}) => ({ update_id: id, message: { message_id: id, text, chat: { id: OWNER_CHAT, type: 'private', first_name: 'Sam', ...extra }, from: { id: OWNER_CHAT, first_name: 'Sam' } } });
const gm = (id, text, type = 'group') => ({ update_id: id, message: { message_id: id, text, chat: { id: -100555, type, title: 'A group' }, from: { id: 42, first_name: 'Stranger' } } });
function bot(updates = [], opts = {}) {
  return telegram({ answer: (method, body) => {
    if (method === 'getMe') return opts.getMe || reply(200, { ok: true, result: { id: 1, is_bot: true, username: 'noor_codex_bot' } });
    if (method === 'getUpdates') {
      if (opts.webhook) return reply(409, { ok: false, error_code: 409, description: "Conflict: can't use getUpdates method while webhook is active; use deleteWebhook to delete the webhook first" });
      return reply(200, { ok: true, result: updates.filter(u => !body.offset || u.update_id >= body.offset) });
    }
    if (method === 'sendMessage') {
      if (opts.send) return opts.send(body);
      return reply(200, { ok: true, result: { message_id: 9, chat: { id: body.chat_id, type: 'private' } } });
    }
    return reply(404, { ok: false, description: 'Not Found' });
  } });
}
const returned = [];
const keep = r => { returned.push(r); return r; };

console.log('\nthe owner\'s line: the code');
{
  const st = makeKv(), B = bot();
  const o = { kv: st.kv, kvReady: st.kvReady, fetch: B.fetch, now: st.clock };
  const a = keep(await TG.ownerLinkCode(o));
  ok(a.ok && /^NOOR-[A-Z0-9]{6}$/.test(a.code), 'a code is NOOR- and six uppercase letters or digits: ' + a.code);
  ok(a.expiresAt === new Date(st.clock + 15 * 60000).toISOString(), 'it expires in fifteen minutes: ' + a.expiresAt);
  ok(a.botUsername === 'noor_codex_bot', 'and names the bot to write to');
  const set = st.cmds.find(c => c[0] === 'SET' && c[1] === TG.K_TG_CODE);
  ok(set && set.includes('EX') && set[set.indexOf('EX') + 1] === 900, 'the store keeps it with a 900 second expiry');
  const codes = new Set(Array.from({ length: 200 }, () => TG.makeOwnerCode()));
  ok(codes.size > 195 && [...codes].every(c => /^NOOR-[A-Z0-9]{6}$/.test(c)), 'two hundred codes are all well formed and nearly all different');
  const b = keep(await TG.ownerLinkCode(o));
  ok(B.calls.filter(c => c.method === 'getMe').length === 1, 'the bot name is asked of Telegram once and then kept a day');
  ok(b.code !== a.code, 'a second press gives a new code, replacing the first');
  const noMe = makeKv();
  const c = keep(await TG.ownerLinkCode({ kv: noMe.kv, kvReady: noMe.kvReady, fetch: bot([], { getMe: reply(401, { ok: false, description: 'Unauthorized' }) }).fetch, now: noMe.clock }));
  ok(c.ok && c.botUsername === null, 'when getMe fails the code still comes, with botUsername null');

  st.clock += 16 * 60000;
  const late = keep(await TG.ownerLink({ ...o, now: st.clock, fetch: bot([pm(10, b.code)]).fetch }));
  ok(!late.ok && /expired/.test(late.reason), 'sixteen minutes later the code is gone and Check says so: ' + late.reason);
}

console.log('\nthe owner\'s line: linking');
{
  const st = makeKv();
  const o = { kv: st.kv, kvReady: st.kvReady, now: st.clock };
  const { code } = keep(await TG.ownerLinkCode({ ...o, fetch: bot().fetch }));

  const none = keep(await TG.ownerLink({ ...o, fetch: bot([]).fetch }));
  ok(!none.ok && /not arrived yet/.test(none.reason), 'nothing sent yet is a reason, not a link');

  const wrong = keep(await TG.ownerLink({ ...o, fetch: bot([pm(11, 'NOOR-ZZZZZ9'), pm(12, code.toLowerCase())]).fetch }));
  ok(!wrong.ok && /not arrived/.test(wrong.reason), 'a wrong code, or the right one in other letters, is ignored');

  const G = bot([gm(13, code), gm(14, 'here: ' + code, 'supergroup'), gm(15, code, 'channel')]);
  const grp = keep(await TG.ownerLink({ ...o, fetch: G.fetch }));
  ok(!grp.ok && !G.calls.some(c => c.method === 'sendMessage'), 'the right code from a group, a supergroup or a channel never links');
  ok((await TG.ownerStatus(o)).linked === false, 'and the house is still not linked');
  ok(st.strings.get(TG.K_TG_OFFSET) && st.strings.get(TG.K_TG_OFFSET).v === '16', 'the offset moves past every update read: ' + (st.strings.get(TG.K_TG_OFFSET) || {}).v);

  const P = bot([gm(13, code), pm(16, 'my code is ' + code + ' thanks')]);
  const yes = keep(await TG.ownerLink({ ...o, fetch: P.fetch }));
  ok(yes.ok && yes.linked && yes.chatTitle === 'Sam', 'the code inside a private message links, naming the first name only: ' + JSON.stringify(yes));
  const gu = P.calls.find(c => c.method === 'getUpdates');
  ok(gu && gu.body.offset === 16, 'getUpdates is asked only from the stored offset');
  const said = P.calls.find(c => c.method === 'sendMessage');
  ok(said && said.body.chat_id === OWNER_CHAT && said.body.text === 'Linked. NOOR will write to you here only when it needs you, and once a week.', 'the owner is told, in that chat, in the agreed words');
  ok(!st.strings.has(TG.K_TG_CODE), 'the code is spent');
  const own = JSON.parse(st.strings.get(TG.K_TG_OWNER).v);
  ok(own.chat === OWNER_CHAT && !st.strings.get(TG.K_TG_OWNER).exp, 'the chat is kept, with no expiry');
  const s = keep(await TG.ownerStatus(o));
  ok(s.linked === true && s.since === new Date(st.clock).toISOString() && Object.keys(s).sort().join() === 'linked,since', 'status says linked and since when, and nothing else');
  const again = keep(await TG.ownerLink({ ...o, fetch: P.fetch }));
  ok(!again.ok && /no code/.test(again.reason), 'a second Check with the code spent asks for a new one');

  const st2 = makeKv();
  const o2 = { kv: st2.kv, kvReady: st2.kvReady, now: st2.clock };
  await TG.ownerLinkCode({ ...o2, fetch: bot().fetch });
  const hook = keep(await TG.ownerLink({ ...o2, fetch: bot([], { webhook: true }).fetch }));
  ok(!hook.ok && hook.reason === 'the bot uses a webhook; linking needs getUpdates', 'a bot with a webhook (409) is named, not guessed at: ' + hook.reason);

  const un = keep(await TG.ownerUnlink(o));
  ok(un.ok && un.linked === false && (await TG.ownerStatus(o)).linked === false, 'unlink forgets the chat');
}

console.log('\nthe owner\'s line: messages');
{
  const st = makeKv();
  const o = { kv: st.kv, kvReady: st.kvReady, now: st.clock };
  const B0 = bot();
  const nl = keep(await TG.notifyOwner('hello', { ...o, fetch: B0.fetch }));
  ok(!nl.ok && nl.reason === 'not linked' && B0.calls.length === 0, 'not linked is said, and Telegram is never called');

  st.strings.set(TG.K_TG_OWNER, { v: JSON.stringify({ chat: OWNER_CHAT, name: 'Sam', since: '2026-10-02T09:00:00.000Z' }), exp: 0 });
  const B = bot();
  const long = 'The house needs you. '.repeat(400) + '<b>not markup</b> & more';
  const r1 = keep(await TG.notifyOwner(long, { ...o, fetch: B.fetch }));
  const m1 = B.calls.find(c => c.method === 'sendMessage');
  ok(r1.ok && m1 && m1.body.chat_id === OWNER_CHAT, 'a linked owner is written to');
  ok(m1.body.text.length <= TG.TEXT_MAX && m1.body.text.length > 4000, 'a long message is cut to 4,096: ' + m1.body.text.length);
  ok(m1.body.parse_mode === undefined && m1.body.disable_web_page_preview === true, 'plain text, no parse mode, no link preview');
  const B2 = bot();
  await TG.notifyOwner('a <b>tag</b> & an ampersand', { ...o, fetch: B2.fetch });
  ok(B2.calls.find(c => c.method === 'sendMessage').body.text === 'a <b>tag</b> & an ampersand', 'and the text goes as written, nothing read as markup');

  for (let i = 0; i < 4; i++) keep(await TG.notifyOwner('message ' + i, { ...o, fetch: B.fetch }));
  const B7 = bot();
  const seventh = keep(await TG.notifyOwner('the seventh', { ...o, fetch: B7.fetch }));
  ok(!seventh.ok && /daily limit/.test(seventh.reason) && B7.calls.length === 0, 'the seventh message of a UTC day is refused and never reaches Telegram: ' + seventh.reason);
  const next = keep(await TG.notifyOwner('a new day', { ...o, now: st.clock + 86400000, fetch: bot().fetch }));
  ok(next.ok, 'the next UTC day counts afresh');

  st.broken = true;
  const Bf = bot();
  const fault = keep(await TG.notifyOwner('during a store fault', { ...o, fetch: Bf.fetch }));
  ok(!fault.ok && Bf.calls.length === 0, 'a store fault sends nothing: the limit fails closed: ' + fault.reason);
  const sf = keep(await TG.ownerStatus(o));
  ok(sf.linked === false && sf.since === null, 'and status under a fault says not linked rather than throwing');
  st.broken = false;
  /* a store that can read the owner but cannot count: fail closed too */
  const half = { ...o, kv: async cmds => { if (cmds[0][0] === 'INCR') throw new Error('kv rest 500'); return st.kv(cmds); } };
  const Bh = bot();
  const h = keep(await TG.notifyOwner('count fault', { ...half, now: st.clock + 2 * 86400000, fetch: Bh.fetch }));
  ok(!h.ok && /could not count/.test(h.reason) && Bh.calls.length === 0, 'a counter that cannot count sends nothing');

  const blocked = keep(await TG.notifyOwner('x', { ...o, now: st.clock + 3 * 86400000, fetch: bot([], { send: () => reply(403, { ok: false, description: 'Forbidden: bot was blocked by the user ' + OWNER_CHAT + ' https://api.telegram.org/bot' + TOKEN + '/sendMessage' }) }).fetch }));
  ok(!blocked.ok && /blocked/.test(blocked.reason), 'a bot the owner blocked is said in words: ' + blocked.reason);
  delete process.env.TG_BOT_TOKEN;
  const notok = keep(await TG.notifyOwner('x', { ...o, fetch: bot().fetch }));
  ok(!notok.ok && /TG_BOT_TOKEN/.test(notok.reason), 'without a token nothing is sent');
  process.env.TG_BOT_TOKEN = TOKEN;
}

console.log('\nthe owner\'s line keeps its secrets');
{
  const all = returned.map(x => JSON.stringify(x)).join('\n');
  ok(returned.length > 20, 'every answer above was kept to be read: ' + returned.length);
  ok(!all.includes(TOKEN) && !all.includes('AAHsecret'), 'no answer carries the bot token');
  ok(!all.includes(String(OWNER_CHAT)), 'no answer carries the owner\'s chat id');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
