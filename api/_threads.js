/* NOOR · Threads, Meta's text network
   ===========================================================================
   Threads is the one Meta surface that reads like a page of sentences rather
   than a grid of pictures. A post there is 500 characters, with a picture, a
   video or nothing, and a link in the text becomes a link card. The house
   posts a card as its picture with the title, one line of the body and the
   link; a reel goes as the video with its audited caption cut to 500.

   WHAT IT NEEDS. The Threads use case on the Meta app, which gives the app a
   Threads app id and secret of its own (TH_APP_ID, TH_APP_SECRET); one
   consent from the owner, given at /api/threads?action=auth, which yields a
   long-lived token (TH_TOKEN, 60 days) and the account's Threads user id
   (TH_USER_ID); both are shown once and pasted into Vercel. The user id is
   optional: with the token alone the house asks /me for it and keeps the
   answer in memory for the life of the lambda.

   WHAT IT COSTS. Nothing. The API is free; a profile may publish 250 posts
   in 24 hours and the house sends about ten. That ceiling is NOT counted
   here: a counter that can never be reached is a place for a bug to hide,
   and the API says "limit reached" in words when it is, which is answered
   with a wait rather than a guess.

   HOW A POST LANDS. Two calls: a container is created with the text and the
   media url, then it is published by its id. A video container has to be
   processed first, and Meta says to allow about thirty seconds; the function
   that posts the day's slot has no thirty seconds to spare after Facebook and
   Instagram have had theirs. So a video gets one short look, and if it is not
   FINISHED the container id is handed back as `pending`: finishPendingReels
   in social.js publishes it on the next hourly run, exactly as it finishes an
   Instagram story container. A post an hour late is a post.

   THE TOKEN. A long-lived token lives sixty days and cannot be refreshed once
   it has expired. The house keeps no copy of it and therefore cannot renew it
   for the owner: /api/threads?action=renew asks Meta for a fresh sixty days
   on the token in the environment and shows the new one once, to be pasted
   in again. The first day a token is seen working is noted in the store (a
   date beside a fingerprint, never the token), so the console can say how
   long it has been in use and when to renew. The token appears in no URL and
   in no sentence that leaves this module.
--------------------------------------------------------------------------- */
import { kv, kvReady } from "./_kv.js";
import crypto from "crypto";

const env = k => (process.env[k] || "").trim();
export const API = "https://graph.threads.net/v1.0";
const AUTH_URL = "https://threads.net/oauth/authorize";
const CODE_URL = "https://graph.threads.net/oauth/access_token";
const LONG_URL = "https://graph.threads.net/access_token";
const REFRESH_URL = "https://graph.threads.net/refresh_access_token";
export const SCOPE = "threads_basic,threads_content_publish";
export const TEXT_MAX = 500;
export const DAILY_LIMIT = 250;        /* Meta's ceiling, stated, not enforced: see the note above */
export const TOKEN_LIFE_DAYS = 60;
export const RENEW_AFTER_DAYS = 50;
const K_SEEN = "nsoc:th:seen";        /* { fp, since } : the day this token was first seen working */

/* the short poll a video gets before it is handed back */
const POLL_WAIT_MS = Number(process.env.TH_POLL_WAIT_MS || 3000);
const sleep = ms => new Promise(r => setTimeout(r, ms));

export const configured = () => !!env("TH_TOKEN");
export const doorReady = () => !!(env("TH_APP_ID") && env("TH_APP_SECRET"));

/* the token is never shown, in an error, a log or a url that got echoed */
export function mask(s) {
  const tok = env("TH_TOKEN");
  let out = String(s || "");
  if (tok) out = out.split(tok).join("<token>");
  return out.replace(/\bTH[A-Za-z0-9_-]{40,}/g, "<token>").replace(/access_token=[^&\s"']+/g, "access_token=<token>");
}

/* the same trim the other channels use: runs of spaces collapse, line breaks
   survive, and a cut lands on a word rather than in one */
const cut = (s, n) => {
  s = String(s || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n")
       .split("\n").map(l => l.trim()).join("\n").trim();
  return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
};

/* one line of the body: its first sentence, or its first line if the
   sentence never ends */
export function oneLine(body) {
  const first = String(body || "").split("\n").map(l => l.trim()).find(Boolean) || "";
  const m = first.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : first).trim();
}

/* what the sender needs from the post, in one place */
export function shape(p) {
  const link = p.link || "";
  if (p.caption) {
    /* a reel's caption was written and audited beside the video: carried
       whole where it fits, cut on a word where it does not */
    return { text: cut(p.caption, TEXT_MAX), image: p.image || null, video: p.video || null, link };
  }
  /* a card: the title, one line, the link, and at most two tags. Not the
     caption wall the feeds get: Threads reads as sentences. The link is a
     fixed cost and the line gives way to it. */
  const tags = (p.tags || []).slice(0, 2).map(t => String(t).trim()).filter(Boolean).join(" ");
  const title = cut(p.title, 200);
  const fixed = [title, link, tags].filter(Boolean);
  const room = TEXT_MAX - fixed.reduce((n, s) => n + s.length + 2, 0);
  const line = room > 20 ? cut(oneLine(p.body), room) : "";
  const text = cut([title, line, link, tags].filter(Boolean).join("\n\n"), TEXT_MAX);
  return { text, image: p.image || null, video: p.video || null, link };
}

/* ---------------------------------------------------------------------------
   the door
--------------------------------------------------------------------------- */
export function redirectUri(host) {
  return "https://" + String(host).replace(/^https?:\/\//, "") + "/threads/callback";
}

export function authUrl(host, state) {
  return AUTH_URL + "?" + new URLSearchParams({
    client_id: env("TH_APP_ID"), redirect_uri: redirectUri(host), scope: SCOPE, response_type: "code", state
  }).toString();
}

async function readJson(r) {
  const t = await r.text().catch(() => "");
  try { return JSON.parse(t); } catch { return null; }
}
/* Meta sends the user id as a bare number, and a Threads id has seventeen
   digits: two more than a JavaScript number keeps. JSON.parse would round it,
   silently, and every post would go to an account that does not exist. So the
   digits are read off the text before it is parsed. */
const bigId = (text, key) => { const m = String(text || "").match(new RegExp('"' + key + '"\\s*:\\s*"?(\\d+)"?')); return m ? m[1] : ""; };
const metaSaid = (j, fallback) => mask(String((j && j.error && (j.error.message || j.error.type)) || (j && j.error_message) || fallback || ""));

/* the code from the consent screen, traded for a short-lived token and the
   user id, then the short one for the long one. Both are handed back to be
   shown once. Meta appends "#_" to the code it sends back; it is not part of it. */
export async function exchange(host, code, fetcher) {
  const f = fetcher || fetch;
  code = String(code || "").replace(/#_$/, "");
  if (!doorReady()) return { ok: false, err: "TH_APP_ID and TH_APP_SECRET are not set" };
  let r, j, text;
  try {
    r = await f(CODE_URL, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env("TH_APP_ID"), client_secret: env("TH_APP_SECRET"), grant_type: "authorization_code",
                                  redirect_uri: redirectUri(host), code }).toString()
    });
    text = await r.text().catch(() => "");
    try { j = JSON.parse(text); } catch { j = null; }
  } catch (e) { return { ok: false, err: "Threads did not answer: " + mask(String(e && e.message || e)).slice(0, 120) }; }
  if (!r.ok || !j || !j.access_token) return { ok: false, err: metaSaid(j, "http " + r.status) };
  const short = j.access_token, userId = bigId(text, "user_id");
  const long = await exchangeLong(short, f);
  if (!long.ok) return { ok: false, err: "the short-lived token came but the long-lived exchange failed: " + long.err, userId };
  return { ok: true, token: long.token, expiresIn: long.expiresIn, userId };
}

/* a short-lived token (an hour) becomes a long-lived one (sixty days) */
export async function exchangeLong(shortToken, fetcher) {
  const f = fetcher || fetch;
  let r, j;
  try {
    r = await f(LONG_URL + "?" + new URLSearchParams({ grant_type: "th_exchange_token", client_secret: env("TH_APP_SECRET"), access_token: shortToken }).toString());
    j = await readJson(r);
  } catch (e) { return { ok: false, err: "Threads did not answer: " + mask(String(e && e.message || e)).slice(0, 120) }; }
  if (!r.ok || !j || !j.access_token) return { ok: false, err: metaSaid(j, "http " + r.status) };
  return { ok: true, token: j.access_token, expiresIn: Number(j.expires_in || 0) };
}

/* sixty more days on a long-lived token that is at least a day old and not
   yet expired. The answer is a new token, shown once by the renew door. */
export async function refresh(token, fetcher) {
  const f = fetcher || fetch;
  let r, j;
  try {
    r = await f(REFRESH_URL + "?" + new URLSearchParams({ grant_type: "th_refresh_token", access_token: token || env("TH_TOKEN") }).toString());
    j = await readJson(r);
  } catch (e) { return { ok: false, err: "Threads did not answer: " + mask(String(e && e.message || e)).slice(0, 120) }; }
  if (!r.ok || !j || !j.access_token) return { ok: false, err: metaSaid(j, "http " + r.status) };
  return { ok: true, token: j.access_token, expiresIn: Number(j.expires_in || 0) };
}

/* ---------------------------------------------------------------------------
   the account
--------------------------------------------------------------------------- */
let USER_MEM = { id: "", name: "", tok: "" };   /* for the life of the lambda */

/* who the token belongs to: TH_USER_ID if it is set, otherwise /me, once */
export async function me(fetcher, opts = {}) {
  const f = fetcher || fetch;
  const tok = env("TH_TOKEN");
  if (!tok) return { ok: false, err: "no TH_TOKEN" };
  if (!opts.fresh && USER_MEM.id && USER_MEM.tok === tok) return { ok: true, id: USER_MEM.id, username: USER_MEM.name };
  let r, j, text;
  try {
    r = await f(API + "/me?fields=id,username", { headers: { authorization: "Bearer " + tok } });
    text = await r.text().catch(() => "");
    try { j = JSON.parse(text); } catch { j = null; }
  } catch (e) { return { ok: false, err: "Threads did not answer: " + mask(String(e && e.message || e)).slice(0, 120) }; }
  if (!r.ok || !j || !j.id) return explain(r.status, j);
  /* /me answers the id as a string; read off the text all the same */
  USER_MEM = { id: bigId(text, "id") || String(j.id), name: String(j.username || ""), tok };
  return { ok: true, id: USER_MEM.id, username: USER_MEM.name };
}

async function userId(fetcher) {
  const fixed = env("TH_USER_ID");
  if (fixed) return { ok: true, id: fixed };
  return me(fetcher);
}

/* ---------------------------------------------------------------------------
   how old the token is, without keeping the token
--------------------------------------------------------------------------- */
const fingerprint = tok => crypto.createHash("sha256").update(String(tok || "")).digest("hex").slice(0, 12);

export async function tokenAge() {
  const tok = env("TH_TOKEN");
  if (!tok || !kvReady()) return { days: null };
  try {
    const raw = (await kv([["GET", K_SEEN]]))[0];
    const j = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
    if (!j || j.fp !== fingerprint(tok) || !j.since) return { days: null };
    const days = Math.floor((Date.now() - Date.parse(j.since)) / 86400000);
    return { days, since: j.since, renew: days >= RENEW_AFTER_DAYS };
  } catch { return { days: null }; }
}

async function noteSeen() {
  const tok = env("TH_TOKEN");
  if (!tok || !kvReady()) return;
  try {
    const raw = (await kv([["GET", K_SEEN]]))[0];
    const j = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
    if (j && j.fp === fingerprint(tok) && j.since) return;
    await kv([["SET", K_SEEN, JSON.stringify({ fp: fingerprint(tok), since: new Date().toISOString() })]]);
  } catch { }
}

/* ---------------------------------------------------------------------------
   Meta's sentences, read for the ones that need a person or a wait
--------------------------------------------------------------------------- */
function explain(status, j) {
  const e = (j && j.error) || {};
  const code = Number(e.code || 0), sub = Number(e.error_subcode || 0);
  const said = metaSaid(j, "http " + status);
  if (code === 190 || status === 401 || /session has expired|invalid oauth access token|access token.*(expired|invalid)|cannot parse access token/i.test(said)) {
    return { ok: false, fatal: true, code: 190, sub, err:
      "Threads does not accept the token: it has expired (a long-lived token lives " + TOKEN_LIFE_DAYS + " days) or was revoked. " +
      "Open /api/threads?action=auth, give consent again, and paste the new TH_TOKEN into Vercel." };
  }
  if (status === 429 || code === 4 || code === 17 || code === 32 || code === 613 || sub === 2207051 || /rate limit|limit reached|too many|application request limit/i.test(said)) {
    return { ok: false, code: code || 429, sub, wait: 3600, err:
      "Threads is rate limiting the account for now (" + said + "). A profile may publish " + DAILY_LIMIT + " posts in 24 hours; the hourly run retries by itself." };
  }
  if (code === 10 || code === 200 || code === 803 || status === 403 || /permission|not authorized|does not have permission/i.test(said)) {
    return { ok: false, fatal: true, code: code || status, sub, err:
      "Threads refused (" + said + "). The token must carry threads_content_publish for this account: while the app is in development the account must accept the Threads tester invitation in the Threads app (Settings, Account, Website permissions), then the door is opened again." };
  }
  if (/could not fetch|unable to fetch|media.*(url|download)|not a valid (image|video)|unsupported/i.test(said) || (sub >= 2207000 && sub <= 2207099)) {
    /* the file was not there when Meta came for it: a cold card, or a reel
       not on the site yet. The next hour usually finds it. */
    return { ok: false, code: code || status, sub, err: "Threads could not fetch the file from its url (" + said + "); retried next hour" };
  }
  return { ok: false, code: code || status, sub, err: said };
}

/* the container's state, in one look */
async function status(id, tok, f) {
  const r = await f(API + "/" + id + "?fields=status,error_message", { headers: { authorization: "Bearer " + tok } });
  const j = await readJson(r);
  if (!r.ok || !j) return { ok: false, ...explain(r.status, j) };
  return { ok: true, status: String(j.status || ""), error: mask(String(j.error_message || "")) };
}

async function publish(id, uid, tok, f) {
  let r, j;
  try {
    r = await f(API + "/" + uid + "/threads_publish", {
      method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + tok },
      body: JSON.stringify({ creation_id: id })
    });
    j = await readJson(r);
  } catch (e) { return { ok: false, err: "Threads did not answer: " + mask(String(e && e.message || e)).slice(0, 120), step: "publish" }; }
  if (!r.ok || !j || !j.id) return { ...explain(r.status, j), step: "publish" };
  const out = { ok: true, id: String(j.id) };
  /* where it can be read; a nicety, and never the reason a post fails */
  try {
    const p = await f(API + "/" + j.id + "?fields=permalink", { headers: { authorization: "Bearer " + tok } });
    const pj = await readJson(p);
    if (p.ok && pj && pj.permalink) out.url = String(pj.permalink);
  } catch { }
  await noteSeen();
  return out;
}

/* the send. Never throws: a sender that throws takes the slot's other
   networks down with it. */
export async function send(shaped, opts = {}) {
  const f = opts.fetch || fetch;
  const tok = env("TH_TOKEN");
  if (!tok) return { ok: false, skipped: "Threads is not connected (TH_TOKEN)", err: "threads is not configured: open /api/threads?action=auth and set TH_TOKEN" };
  const text = String((shaped && shaped.text) || "");
  if (!text && !shaped.video && !shaped.image) return { ok: false, fatal: true, err: "nothing to say" };
  if (text.length > TEXT_MAX) return { ok: false, fatal: true, err: "the text is " + text.length + " characters and Threads takes " + TEXT_MAX };

  const who = await userId(f);
  if (!who.ok) return { ...who, step: "me" };
  const uid = who.id;

  let body;
  if (shaped.video) body = { media_type: "VIDEO", video_url: shaped.video, text };
  else if (shaped.image) body = { media_type: "IMAGE", image_url: shaped.image, text };
  else {
    body = { media_type: "TEXT", text };
    /* a text post with a link shows it as a card; naming it makes sure */
    if (shaped.link) body.link_attachment = shaped.link;
  }

  let r, j;
  try {
    r = await f(API + "/" + uid + "/threads", {
      method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + tok },
      body: JSON.stringify(body)
    });
    j = await readJson(r);
  } catch (e) { return { ok: false, err: "Threads did not answer: " + mask(String(e && e.message || e)).slice(0, 120), step: "container" }; }
  if (!r.ok || !j || !j.id) return { ...explain(r.status, j), step: "container" };
  const cid = String(j.id);

  if (shaped.video) {
    /* one short look, then the container is handed back if it is not ready:
       finishPendingReels publishes it on the next hourly run */
    await sleep(Math.min(POLL_WAIT_MS, 3000));
    let st;
    try { st = await status(cid, tok, f); } catch (e) { st = { ok: false, err: mask(String(e && e.message || e)) }; }
    if (st.ok && (st.status === "ERROR" || st.status === "EXPIRED"))
      return { ok: false, err: "Threads could not process the video: " + st.status + (st.error ? " (" + st.error + ")" : ""), code: st.status };
    if (!st.ok || (st.status !== "FINISHED" && st.status !== "PUBLISHED"))
      return { ok: false, pending: cid, err: "Threads is still processing the video; it is published on the next run",
               note: "Threads is still processing the video; it is published on the next run" };
  }
  const out = await publish(cid, uid, tok, f);
  if (out.ok) out.media = body.media_type;
  return out;
}

/* a container a run left processing, looked at again and published if it is
   ready. Returns { ok, id } when published, { ok:false, pending } when it
   still is not, { ok:false, err } when Meta gave up on it. */
export async function finish(containerId, opts = {}) {
  const f = opts.fetch || fetch;
  const tok = env("TH_TOKEN");
  if (!tok) return { ok: false, skipped: "Threads is not connected (TH_TOKEN)", err: "threads is not configured" };
  const who = await userId(f);
  if (!who.ok) return { ...who, step: "me" };
  let st;
  try { st = await status(containerId, tok, f); } catch (e) { return { ok: false, err: "Threads did not answer: " + mask(String(e && e.message || e)).slice(0, 120) }; }
  if (!st.ok) return st;
  if (st.status === "ERROR" || st.status === "EXPIRED")
    return { ok: false, err: "Threads could not process the video: " + st.status + (st.error ? " (" + st.error + ")" : ""), code: st.status };
  if (st.status === "PUBLISHED") return { ok: true, id: String(containerId), already: true };
  if (st.status !== "FINISHED") return { ok: false, pending: String(containerId), err: "Threads is still processing the video" };
  return publish(containerId, who.id, tok, f);
}
