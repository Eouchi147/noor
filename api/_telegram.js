/* NOOR · Telegram, the channel that is only a channel
   ===========================================================================
   A Telegram channel is the plainest of the seven: no feed algorithm, no
   review, no quota worth counting. Whoever subscribes sees every post, in
   order, with the picture or the reel inline and the link under it. For a
   library that is the whole point.

   WHAT IT NEEDS. A bot, made in Telegram by talking to @BotFather (/newbot),
   which answers with a token; a public channel; and the bot made an
   administrator of that channel with the right to post. Two variables then
   carry it: TG_BOT_TOKEN, the token BotFather gave, and TG_CHAT_ID, the
   channel's public username with its @ (or the numeric id of a private one).

   WHAT IT COSTS. Nothing. The Bot API is free and unmetered beyond a courtesy
   rate limit, which it states as a number of seconds to wait; that number is
   handed back so the healer waits it rather than guessing.

   HOW A FILE TRAVELS. A picture goes by url: Telegram fetches it itself, one
   JSON call, and the picture is on the channel. A REEL used to go the same
   way -- first the store's own signed link, then this house's own door
   (api/reel.js) -- and failed both times with the same words, "failed to
   get HTTP URL content" (the record of 15 and 16 September 2026, four tries
   a slot, never a reel on Telegram). Telegram's own fetch of a url is on
   ITS clock, not this house's, and two hops to reach a reel (the door reads
   the manifest, then resolves the store's redirect) outran it far more
   often than not. So as of 16 September 2026 a video is not handed over as
   a url at all: this module fetches the bytes itself, on the five minutes
   the run is given, and uploads them to Telegram directly, the way a
   person attaching a video would. A reel of this house is a few megabytes;
   Telegram's own ceiling for a file handed to it this way is 50 MB, and
   anything over that is skipped, not guessed at, with a reason a person can
   read (MULTIPART_MAX below).

   THE ONE RULE. The token is in the URL of every call, which is how the Bot
   API is built, so any error that echoes a URL would echo the token. Nothing
   that leaves this module carries it: every sentence passes through mask().
--------------------------------------------------------------------------- */

const env = k => (process.env[k] || "").trim();
const API = "https://api.telegram.org";
export const CAPTION_MAX = 1024;   /* under a photo or a video, after entities are parsed */
export const TEXT_MAX = 4096;      /* a message with no media */

export const configured = () => !!(env("TG_BOT_TOKEN") && env("TG_CHAT_ID"));

/* the token is never shown, in an error, a log or a url that got echoed */
export function mask(s) {
  const tok = env("TG_BOT_TOKEN");
  let out = String(s || "");
  if (tok) out = out.split(tok).join("<token>");
  /* and any other thing shaped like one, in case the environment changed
     between the call and the sentence */
  return out.replace(/\b\d{6,}:[A-Za-z0-9_-]{20,}/g, "<token>");
}

/* HTML parse mode reads only these three characters as markup */
export const esc = s => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* the same trim the other channels use: runs of spaces collapse, line breaks
   survive, and a cut lands on a word rather than in one */
const cut = (s, n) => {
  s = String(s || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n")
       .split("\n").map(l => l.trim()).join("\n").trim();
  return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
};

/* A bold title, then the plain parts, inside the limit AFTER escaping: an
   ampersand in the body is five characters to Telegram's parser and one to
   the reader, and the limit is the reader's. So the plain text is cut, the
   result measured with its entities, and the cut deepened until it fits. */
function assemble(title, rest, limit) {
  const head = title ? "<b>" + esc(cut(title, 200)) + "</b>" : "";
  let body = cut(rest, limit);
  for (let i = 0; i < 8; i++) {
    const out = [head, esc(body)].filter(Boolean).join("\n\n");
    if (out.length <= limit) return out;
    body = cut(body, Math.max(0, body.length - (out.length - limit)));
  }
  return head.length <= limit ? head : esc(cut(title, limit));
}

/* what the sender needs from the post, in one place. A message with a picture
   or a reel is a caption and has 1,024 characters; one without has 4,096. */
export function shape(p) {
  const media = !!(p.video || p.image);
  const limit = media ? CAPTION_MAX : TEXT_MAX;
  const link = p.link || "";
  let text;
  if (p.caption) {
    /* a reel's caption was written and audited beside the video: carried
       whole, escaped for the parser and nothing else */
    text = esc(cut(p.caption, limit));
  } else {
    const parts = [p.body];
    if (p.todo && p.todo.length) parts.push("", p.todo.map(t => "• " + t).join("\n"));
    if (p.basis) parts.push("", p.basis);
    if (link) parts.push("", link);
    text = assemble(p.title, parts.filter(x => x != null).join("\n"), limit);
  }
  return { text, image: p.image || null, video: p.video || null, link };
}

/* the chat, as Telegram wants it: a public username keeps its @, a numeric
   id (a private channel's, -100...) goes as it is */
export function chatId() {
  const c = env("TG_CHAT_ID");
  if (!c) return "";
  if (/^-?\d+$/.test(c)) return c;
  return c.startsWith("@") ? c : "@" + c;
}

/* where the post can be read, when the channel is public */
function messageUrl(chat, id) {
  if (!id || !chat || !chat.startsWith("@")) return "";
  return "https://t.me/" + chat.slice(1) + "/" + id;
}

/* Telegram's sentences, read for the three that need a person and the one
   that needs a wait. Everything else is quoted, masked, and retried later. */
function explain(status, j) {
  const said = mask(String((j && j.description) || "") || ("http " + status));
  const params = (j && j.parameters) || {};
  if (status === 429 || params.retry_after != null) {
    const wait = Math.max(1, Number(params.retry_after || 30));
    return { ok: false, err: "Telegram asked for a pause: " + said, wait, code: 429 };
  }
  if (status === 401 || /unauthorized/i.test(said)) {
    return { ok: false, fatal: true, code: 401,
             err: "Telegram does not recognise the bot token: TG_BOT_TOKEN is not the token BotFather issued, or the bot was deleted. Ask @BotFather for /token and paste it again." };
  }
  if (/chat not found|not a member|administrator rights|not enough rights|kicked|write forbidden|CHAT_ADMIN_REQUIRED/i.test(said)) {
    return { ok: false, fatal: true, admin: true, code: status,
             err: "Telegram refused (" + said + "). The bot must be an administrator of the channel named in TG_CHAT_ID with the right to post messages: open the channel, Administrators, Add administrator, pick the bot, and switch on Post messages." };
  }
  if (/too big|file is too large|entity too large/i.test(said)) {
    return { ok: false, fatal: true, code: status,
             err: "Telegram refused the file as too big: a URL upload takes 20 MB at most (" + said + ")" };
  }
  if (/failed to get HTTP URL content|wrong file identifier|wrong HTTP URL|WEBPAGE_CURL_FAILED|WEBPAGE_MEDIA_EMPTY/i.test(said)) {
    /* the file was not there when Telegram came for it: a cold card, or a
       reel not on the site yet. The next hour usually finds it. */
    return { ok: false, code: status, err: "Telegram could not fetch the file from its url (" + said + "); retried next hour" };
  }
  return { ok: false, code: status, err: said };
}

/* Telegram's own ceiling for a file handed to it as an upload rather than
   fetched by it. A reel of this house is a few megabytes (every one under
   8 MB, the sidecar's own bytes field), so this is headroom, not a wall
   anything here is expected to hit. */
const MULTIPART_MAX = 50 * 1024 * 1024;

/* the floor under a real reel. Every reel this house makes is several
   megabytes; a body under 100 KB is not a small reel, it is a door that
   answered 200 with a stub, an error page, or nothing much -- fetched
   fully, never truncated by a client-side size guess. Sending that on
   as a video would put a broken file, or a page of HTML wearing a
   video/mp4 header, on the channel in front of people. */
const MULTIPART_MIN = 100 * 1024;

/* the bytes, read by this function rather than by Telegram: a network
   fault reading them is retried, same as any other network fault, and a
   file too big to hand over is skipped, in words, rather than attempted
   and left to Telegram's own refusal (which a url upload never reached
   here anyway -- see HOW A FILE TRAVELS, above).

   Two more shapes count as a fetch failure, not an upload, since 16
   September 2026: a body that came back shorter than the content-length
   the door itself declared (the connection died partway and Node handed
   back whatever arrived, not an error -- so without this check a
   truncated file was sent to Telegram as if it were whole), and a body
   under MULTIPART_MIN, too small for a real reel whatever the door said
   about its length. Both are retried next hour like any other fetch
   failure; neither is ever handed to Telegram. */
async function fetchVideoBytes(url, fetcher) {
  let r;
  try { r = await fetcher(url); }
  catch (e) { return { ok: false, err: "could not read the reel to send it: " + mask(String(e && e.message || e)).slice(0, 120) }; }
  if (!r || !r.ok) return { ok: false, err: "could not read the reel to send it: http " + (r ? r.status : "no answer") };
  const tooBig = n => ({ ok: false, skipped: true, reason: "too big",
    err: "the reel is " + Math.round(n / 1048576) + " MB, over Telegram's 50 MB upload limit" });
  const len = r.headers && typeof r.headers.get === "function" ? Number(r.headers.get("content-length") || 0) : 0;
  if (len > MULTIPART_MAX) return tooBig(len);
  let buf;
  try { buf = Buffer.from(await r.arrayBuffer()); }
  catch (e) { return { ok: false, err: "could not read the reel to send it: " + mask(String(e && e.message || e)).slice(0, 120) }; }
  if (buf.length > MULTIPART_MAX) return tooBig(buf.length);
  if (len && buf.length < len)
    return { ok: false, err: "could not read the reel to send it: got " + buf.length + " of " + len + " bytes; the connection dropped partway, not sent" };
  if (buf.length < MULTIPART_MIN)
    return { ok: false, err: "could not read the reel to send it: only " + buf.length + " bytes came back, too small to be a real reel; not sent" };
  return { ok: true, buf };
}

/* the send. Never throws: a sender that throws takes the slot's other
   networks down with it, and the poster's own catch would still log the url. */
export async function send(shaped, opts = {}) {
  const fetcher = opts.fetch || fetch;
  const tok = env("TG_BOT_TOKEN"), chat = chatId();
  if (!tok || !chat) return { ok: false, skipped: "Telegram is not connected (TG_BOT_TOKEN, TG_CHAT_ID)", err: "telegram is not configured: set TG_BOT_TOKEN and TG_CHAT_ID" };
  const text = String((shaped && shaped.text) || "");
  if (!text) return { ok: false, fatal: true, err: "nothing to say" };

  let method, body, form;
  if (shaped.video) {
    const got = await fetchVideoBytes(shaped.video, fetcher);
    if (!got.ok) return got;
    method = "sendVideo";
    form = new FormData();
    form.append("chat_id", String(chat));
    form.append("caption", text);
    form.append("parse_mode", "HTML");
    form.append("supports_streaming", "true");
    form.append("video", new Blob([got.buf], { type: "video/mp4" }), "reel.mp4");
  } else if (shaped.image) {
    method = "sendPhoto";
    body = { chat_id: chat, photo: shaped.image, caption: text, parse_mode: "HTML" };
  } else {
    method = "sendMessage";
    /* the preview under the link is the card the site renders for it */
    body = { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: false };
  }

  let r, j = null;
  try {
    const init = form ? { method: "POST", body: form }
                       : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
    r = await fetcher(API + "/bot" + tok + "/" + method, init);
    const t = await r.text();
    try { j = JSON.parse(t); } catch { }
  } catch (e) {
    return { ok: false, err: "Telegram did not answer: " + mask(String(e && e.message || e)).slice(0, 120) };
  }
  if (!r.ok || !j || !j.ok) return explain(r.status, j);
  const m = j.result || {};
  const id = m.message_id != null ? String(m.message_id) : "posted";
  const out = { ok: true, id, method };
  const url = messageUrl(chat, m.message_id);
  if (url) out.url = url;
  return out;
}
