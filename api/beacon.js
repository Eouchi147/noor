// The Codex's own visitor lamp counter. First-party, cookieless, halal:
// it records only WHEN (day), WHERE FROM (country code Vercel already
// attaches to the request), WHICH ROOM, and WHICH SOURCE brought them
// (a coarse name such as reddit or google, never a full URL, never a
// query string). Never an IP, never an ID, never a fingerprint.
// Dormant until a store is connected: either an Upstash-style REST
// endpoint (KV_REST_API_URL + KV_REST_API_TOKEN) or any ordinary Redis
// (REDIS_URL). Whichever the owner already has.

import net from "node:net";
import tls from "node:tls";
import { settings } from "./settings.js";

/* ---------- the store, whoever provides it ----------
   Reads readers' counts from either an Upstash-style REST endpoint
   (KV_REST_API_URL + KV_REST_API_TOKEN, which Vercel's KV and the
   Upstash marketplace both set) or from ANY ordinary Redis over its
   native protocol (REDIS_URL, as Redis Cloud and the rest give it),
   spoken by hand so the project needs no npm package and no build.
   This block is deliberately repeated in the two files that count,
   so a bundler can never come between the lamp and its oil. */
const REST_URL = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REST_TOK = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const CONN = () => process.env.REDIS_URL || process.env.KV_URL || process.env.REDIS_TLS_URL || "";
function restFromConn() {
  const c = CONN();
  if (!/^https?:\/\//i.test(c)) return null;
  try { const u = new URL(c); const t = u.password || u.username || REST_TOK(); return t ? { url: u.origin, token: t } : null; }
  catch { return null; }
}
function kvKind() {
  if (REST_URL() && REST_TOK()) return "rest";
  if (restFromConn()) return "rest";
  if (/^rediss?:\/\//i.test(CONN())) return "socket";
  return "none";
}
const kvReady = () => kvKind() !== "none";
async function viaRest(cmds) {
  const f = restFromConn();
  const url = (REST_URL() && REST_TOK()) ? REST_URL() : f.url;
  const token = (REST_URL() && REST_TOK()) ? REST_TOK() : f.token;
  const r = await fetch(url.replace(/\/+$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error("kv rest " + r.status);
  const j = await r.json();
  return (Array.isArray(j) ? j : []).map(x => (x && Object.prototype.hasOwnProperty.call(x, "result")) ? x.result : null);
}
function respEncode(cmd) {
  const p = cmd.map(String);
  let s = "*" + p.length + "\r\n";
  for (const a of p) s += "$" + Buffer.byteLength(a) + "\r\n" + a + "\r\n";
  return s;
}
function respParse(buf) {
  const values = []; let i = 0;
  function one() {
    if (i >= buf.length) return undefined;
    const t = buf[i], nl = buf.indexOf("\r\n", i);
    if (nl === -1) return undefined;
    const head = buf.slice(i + 1, nl);
    if (t === 43 || t === 45) { i = nl + 2; return t === 45 ? null : head.toString(); }
    if (t === 58) { i = nl + 2; return parseInt(head.toString(), 10); }
    if (t === 36) {
      const len = parseInt(head.toString(), 10);
      if (len === -1) { i = nl + 2; return null; }
      const st = nl + 2, en = st + len;
      if (buf.length < en + 2) return undefined;
      const v = buf.slice(st, en).toString(); i = en + 2; return v;
    }
    if (t === 42) {
      const n = parseInt(head.toString(), 10); i = nl + 2;
      if (n === -1) return null;
      const arr = [];
      for (let k = 0; k < n; k++) { const v = one(); if (v === undefined) return undefined; arr.push(v); }
      return arr;
    }
    i = nl + 2; return null;
  }
  for (;;) { const mark = i; const v = one(); if (v === undefined) { i = mark; break; } values.push(v); }
  return { values, rest: buf.slice(i) };
}
function viaSocket(cmds) {
  const u = new URL(CONN());
  const secure = u.protocol === "rediss:";
  const pass = decodeURIComponent(u.password || ""), user = decodeURIComponent(u.username || "");
  const db = (u.pathname || "").replace(/^\//, "");
  const pre = [];
  if (pass) pre.push(user ? ["AUTH", user, pass] : ["AUTH", pass]);
  if (db && db !== "0") pre.push(["SELECT", db]);
  const all = pre.concat(cmds);
  return new Promise((resolve, reject) => {
    let done = false;
    const opts = { host: u.hostname, port: parseInt(u.port, 10) || 6379 };
    const sock = secure ? tls.connect({ ...opts, servername: u.hostname }) : net.connect(opts);
    const finish = (e, v) => { if (done) return; done = true; try { sock.end(); } catch {} e ? reject(e) : resolve(v); };
    sock.setTimeout(6000);
    let buf = Buffer.alloc(0), got = [];
    sock.on(secure ? "secureConnect" : "connect", () => sock.write(all.map(respEncode).join("")));
    sock.on("data", d => {
      buf = Buffer.concat([buf, d]);
      const p = respParse(buf); buf = p.rest; got = got.concat(p.values);
      if (got.length >= all.length) finish(null, got.slice(pre.length));
    });
    sock.on("timeout", () => finish(new Error("kv timeout")));
    sock.on("error", e => finish(e));
    sock.on("close", () => { if (!done) finish(null, got.slice(pre.length)); });
  });
}
async function kv(cmds) {
  if (!cmds || !cmds.length) return [];
  const k = kvKind();
  if (k === "rest") return viaRest(cmds);
  if (k === "socket") return viaSocket(cmds);
  throw new Error("no store configured");
}

const ROOMS = {
  "": "home", "index": "home", "quran": "quran", "prophets": "prophets",
  "characters": "characters", "companions": "companions", "places": "places",
  "words": "words", "health": "health", "theology": "theology",
  "latif": "latif", "begin": "begin", "kids": "kids", "arabic": "arabic", "pillars": "pillars", "license": "license", "school": "school", "madrasa": "madrasa", "kids/cradle": "kids",
  "kids/letters": "kids", "donate": "give",
  "sponsor": "sponsor", "legal": "legal",
  "family": "family", "protection": "protection", "marriage": "marriage", "teens": "teens", "dictionary": "dictionary", "heroes": "heroes", "feedback": "feedback",
  "hajj": "hajj", "hajj-plan": "hajjplan", "ramadan": "ramadan", "eid": "eid",
  "stories": "stories", "stories/index": "stories",
  "unseen": "unseen", "sermon": "sermon", "soul": "soul",
  "masjid": "masjid", "masjid/index": "masjid", "masjid/khutba": "masjid",
  "masjid/timetable": "masjid", "masjid/qibla": "masjid",
  "masjid/start": "masjid", "masjid/setup": "masjid", "masjid/board": "masjid",
  "kids/lanterns": "lanterns"
};

/* referrer hostnames folded into the handful of names that matter for
   the money plan. Anything unknown is kept only as its bare hostname. */
const SOURCES = [
  [/(^|\.)reddit\.com$|^redd\.it$/, "reddit"],
  [/(^|\.)facebook\.com$|^fb\.me$|^m\.facebook\.com$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/, "x"],
  [/(^|\.)t\.me$|(^|\.)telegram\.(org|me)$/, "telegram"],
  [/(^|\.)whatsapp\.com$|^wa\.me$/, "whatsapp"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "youtube"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\.com$|(^|\.)duckduckgo\.com$|(^|\.)yahoo\./, "search"],
  [/(^|\.)chat\.openai\.com$|(^|\.)chatgpt\.com$|(^|\.)perplexity\.ai$|(^|\.)claude\.ai$|(^|\.)gemini\.google\.com$/, "ai"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin"],
  [/(^|\.)pinterest\./, "pinterest"],
  [/(^|\.)islamicboard\.com$|(^|\.)turntoislam\.com$|(^|\.)ummah\.com$/, "forum"],
  [/(^|\.)mail\.google\.com$|(^|\.)outlook\.|(^|\.)mail\.yahoo\./, "email"]
];
function sourceOf(raw) {
  var v = String(raw || "").slice(0, 60).toLowerCase();
  if (!v) return "";
  if (v === "direct") return "direct";
  for (var i = 0; i < SOURCES.length; i++) if (SOURCES[i][0].test(v)) return SOURCES[i][1];
  if (/^[a-z0-9.-]{1,40}$/.test(v)) return v.slice(0, 24);
  return "other";
}

/* ---------------------------------------------------------------------------
   WHAT IS NOT A READER

   Until now the count was every POST that arrived, and three kinds of thing
   were arriving that are not people:

     the owner, who is on this site more than anyone else alive;
     crawlers that execute JavaScript -- Google and Bing render pages, so do
       the SEO suites, and so does a growing number of AI collectors;
     link previewers, uptime monitors, and anything driving a real browser.

   A first-party beacon written in JavaScript already turns away the crawlers
   that only read HTML, which is most of them, and that is why this list is
   shorter than a server log's would be. What is left is named here.

   Two rules kept this list honest. Match the crawler, never the app: Pinterest
   the previewer is "Pinterestbot" while Pinterest the phone app is a real
   reader holding a real phone, so only the first is named. And when in doubt,
   count it -- an over-eager filter that quietly eats real readers is a worse
   lie than the one being fixed.

   What is turned away is counted in its own key, so the filter can be seen
   working rather than believed in.
--------------------------------------------------------------------------- */
const NOT_A_READER = new RegExp([
  /* the plain words, which catch most of the long tail on their own.
     "bot" is deliberately NOT matched loosely: Cubot is a phone brand, and a
     bare /bot\\b/ would have thrown away every reader holding one. A crawler
     names itself "SomethingBot/1.0" or "compatible; SomethingBot;", so the
     punctuation after the word is what makes it safe to match. */
  "bot/", "\\bbot\\b", "bot;", "bot\\)", "spider", "crawler", "slurp",
  "scraper", "archiver", "indexer",
  /* the AI collectors */
  "gptbot", "chatgpt-user", "oai-searchbot", "claudebot", "claude-web",
  "anthropic-ai", "perplexitybot", "perplexity-user", "google-extended",
  "ccbot", "bytespider", "amazonbot", "applebot", "meta-externalagent",
  "meta-externalfetcher", "cohere-ai", "diffbot", "imagesift", "omgili",
  "timpibot", "youbot", "petalbot", "webzio", "awario", "peer39", "brightbot",
  /* search and the SEO suites */
  "googlebot", "bingbot", "yandex", "baiduspider", "duckduckbot", "sogou",
  "ahrefs", "semrush", "mj12", "dotbot", "dataforseo", "screaming frog",
  "seokicks", "serpstat", "sitebulb", "blexbot", "megaindex", "barkrowler",
  /* link previewers: a card being unfurled is not a visit */
  "facebookexternalhit", "twitterbot", "linkedinbot", "whatsapp", "telegrambot",
  "discordbot", "slackbot", "skypeuripreview", "redditbot", "pinterestbot",
  "embedly", "quora link", "vkshare", "flipboard", "nuzzel", "iframely",
  /* monitors, and the machinery that measures a page */
  "uptimerobot", "pingdom", "statuscake", "betteruptime", "site24x7",
  "newrelic", "datadog", "vercel-screenshot", "vercel-favicon",
  "lighthouse", "pagespeed", "gtmetrix", "webpagetest", "headlesschrome",
  /* and anything that is not a browser at all */
  "puppeteer", "playwright", "selenium", "phantomjs", "cypress",
  "curl/", "wget", "python-requests", "python-urllib", "aiohttp", "httpx",
  "node-fetch", "axios/", "go-http-client", "java/", "okhttp", "libwww",
  "guzzle", "postman", "insomnia", "apache-httpclient", "restsharp", "scrapy"
].join("|"), "i");

/* Only the live site counts. A preview deployment is the owner looking at his
   own work in a different coat, and localhost is a laptop. */
const PROD_HOST = String(process.env.PUBLIC_HOST || "noorcodex.com").toLowerCase();
function isLiveSite(h) {
  h = String(h || "").toLowerCase().split(":")[0];
  return h === PROD_HOST || h === "www." + PROD_HOST;
}

/* Why a ping was not counted, for the one counter that makes this visible.
   Returns "" when it IS a reader. */
function notAReader(req) {
  const ua = String(req.headers["user-agent"] || "");
  if (!ua.trim()) return "noua";        /* every real browser sends one */
  if (NOT_A_READER.test(ua)) return "bot";
  if (!isLiveSite(req.headers.host)) return "preview";
  return "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  if (!kvReady()) return res.status(204).end();   /* counting not set up yet */

  const day = new Date().toISOString().slice(0, 10);

  /* the gate. Counted in its own key so the tab can show what it turned away:
     a filter nobody can see the effect of is a filter nobody should trust. */
  const why = notAReader(req);
  if (why) {
    try {
      await kv([
        ["INCR", "nv:" + day + ":filtered"],
        ["EXPIRE", "nv:" + day + ":filtered", "8000000"],
        ["HINCRBY", "nvh:" + day + ":filt", why, "1"],
        ["EXPIRE", "nvh:" + day + ":filt", "8000000"]
      ]);
    } catch {}
    return res.status(204).end();
  }
  /* the first day the gate was in place, so the tab can mark the line between
     numbers that were inflated and numbers that were not. Set once, ever. */
  try { await kv([["SETNX", "nv:cleanfrom", day]]); } catch {}

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const month = day.slice(0, 7);
  const cc = String(req.headers["x-vercel-ip-country"] || "??").slice(0, 2).toUpperCase();
  let room = String(body.p || "").replace(/^\/+|\.html$/g, "").split("/")[0].toLowerCase();
  room = ROOMS[room] !== undefined ? ROOMS[room] : (room && /^[a-z0-9-]{1,20}$/.test(room) ? "other" : "home");

  /* ---- the second ping: how long the visit lasted -------------------
     Aggregate seconds only, in one hash per day and one per month/room,
     so the owner can see how long people stay and where. The dial
     traffic.duration switches this off without a deploy. */
  const dur = parseInt(body.d, 10);
  if (Number.isFinite(dur) && dur > 0) {
    let dial = null;
    try { dial = await settings(); } catch {}
    if (dial && dial["traffic.duration"] === false) return res.status(204).end();
    const secs = Math.min(7200, dur);
    const bucket = secs < 30 ? "b1" : secs < 120 ? "b2" : secs < 600 ? "b3" : "b4";
    try {
      await kv([
        ["HINCRBY", "nvh:" + day + ":dur", "secs", String(secs)],
        ["HINCRBY", "nvh:" + day + ":dur", "n", "1"],
        ["HINCRBY", "nvh:" + day + ":dur", bucket, "1"],
        ["EXPIRE", "nvh:" + day + ":dur", "8000000"],
        ["HINCRBY", "nmh:" + month + ":rt", "s:" + room, String(secs)],
        ["HINCRBY", "nmh:" + month + ":rt", "n:" + room, "1"],
        ["EXPIRE", "nmh:" + month + ":rt", "35000000"]
      ]);
    } catch {}
    return res.status(204).end();
  }

  const firstToday = body.n === 1;
  const src = sourceOf(body.s);
  /* the visitor's own hour of day, 0-23, so the owner can see WHEN people
     read. Sent by the page, never derived from anything identifying. */
  const hour = parseInt(body.h, 10);

  const cmds = [
    ["INCR", "nv:" + day + ":views"],
    ["EXPIRE", "nv:" + day + ":views", "8000000"],
    ["INCR", "nm:" + month + ":c:" + cc],
    ["EXPIRE", "nm:" + month + ":c:" + cc, "35000000"],
    ["INCR", "nm:" + month + ":r:" + room],
    ["EXPIRE", "nm:" + month + ":r:" + room, "35000000"]
  ];
  /* the source is counted once per person per day, so one reader
     browsing ten rooms does not look like ten arrivals. */
  if (firstToday && src) {
    cmds.push(["INCR", "nm:" + month + ":s:" + src]);
    cmds.push(["EXPIRE", "nm:" + month + ":s:" + src, "35000000"]);
  }
  if (firstToday) {
    cmds.push(["INCR", "nv:" + day + ":people"]);
    cmds.push(["EXPIRE", "nv:" + day + ":people", "8000000"]);
  }
  /* by hour and by room, per day, in one hash each */
  if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
    cmds.push(["HINCRBY", "nvh:" + day + ":hh", String(hour), "1"]);
    cmds.push(["EXPIRE", "nvh:" + day + ":hh", "8000000"]);
  }
  cmds.push(["HINCRBY", "nvh:" + day + ":rr", room, "1"]);
  cmds.push(["EXPIRE", "nvh:" + day + ":rr", "8000000"]);
  try { await kv(cmds); } catch {}
  return res.status(204).end();
}
