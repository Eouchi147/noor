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
function telegram(opts = {}) {
  const calls = [];
  return {
    calls,
    fetch: async (url, init = {}) => {
      const u = String(url);
      const body = init.body ? JSON.parse(init.body) : {};
      const method = u.slice(u.lastIndexOf("/") + 1);
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
  ok(r3.ok && T3.calls[0].method === "sendVideo" && T3.calls[0].body.video === "https://h/r.mp4" && T3.calls[0].body.supports_streaming === true, 'a video is sendVideo by url, streaming on');
  ok(!("photo" in T3.calls[0].body), 'and the cover is not sent as a photo beside it');
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
  const big = await TG.send({ ...sh, video: "https://h/r.mp4" }, { fetch: mk(400, "Bad Request: file is too big").fetch });
  ok(!big.ok && big.fatal && /20 MB/.test(big.err), 'a file over the url limit is refused with the limit named');
  const cold = await TG.send(sh, { fetch: mk(400, "Bad Request: failed to get HTTP URL content").fetch });
  ok(!cold.ok && !cold.fatal && /retried next hour/.test(cold.err), 'a card Telegram could not fetch is retried, not abandoned');
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
  ok(r.ok && T.calls[0].method === "sendVideo" && T.calls[0].body.video === REEL.video && T.calls[0].body.caption === REEL.caption, 'the sender posts it as a video by url with the caption');
  const card = S.buildSlot('word', { date: '2026-09-07', link: 'https://h/', image: 'https://h/api/card?slot=word', entry: { term: 'Sabr', ar: 'ص', short: 's', long: 'l', id: 'sabr' }, words: [] });
  ok(!card || !CH.shape(card, 'telegram').video, 'a word card carries no video to it');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
