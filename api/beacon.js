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
  "family": "family", "heroes": "heroes", "feedback": "feedback",
  "hajj": "hajj", "ramadan": "ramadan", "eid": "eid",
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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  if (!kvReady()) return res.status(204).end();   /* counting not set up yet */

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const day = new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const cc = String(req.headers["x-vercel-ip-country"] || "??").slice(0, 2).toUpperCase();
  let room = String(body.p || "").replace(/^\/+|\.html$/g, "").split("/")[0].toLowerCase();
  room = ROOMS[room] !== undefined ? ROOMS[room] : (room && /^[a-z0-9-]{1,20}$/.test(room) ? "other" : "home");
  const firstToday = body.n === 1;
  const src = sourceOf(body.s);

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
  try { await kv(cmds); } catch {}
  return res.status(204).end();
}
