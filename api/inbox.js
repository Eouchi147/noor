// The Message Desk · the door at /feedback, and the owner's reading of it.
// Anyone may push a note through the slot (POST, no account, no login).
// Only the owner may read the pile (GET), mark it, or throw a note away
// (PATCH), and the guard is the same noor_admin cookie every owner-only
// endpoint in this house checks.
//
// What is kept: the kind, the words, which page, an optional reply address
// the sender chose to give, the moment, and a two letter country code if the
// platform already attached one to the request. What is never kept: the IP,
// any identifier, any fingerprint. The rate limiter needs to recognise a
// flood, so it counts against a one-way HMAC of the address that expires
// within the day; the address itself is never written anywhere.
//
// Keys:
//   nb:msg:<id>  · one message, JSON
//   nb:list      · the ids, newest first
//   nb:unread    · how many are still new
//   nb:rl:d:<h>  · a day's count for one hashed sender
//   nb:rl:m:<h>  · a minute's count for one hashed sender

import crypto from "crypto";
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

/* ---------- the owner's gate, exactly as marketing.js sets it ---------- */
function verify(cookieHeader, secret) {
  const m = /(?:^|;\s*)noor_admin=([^;]+)/.exec(cookieHeader || "");
  if (!m) return false;
  const [expStr, sig] = m[1].split(".");
  const exp = parseInt(expStr, 10);
  if (!exp || Date.now() > exp) return false;
  const want = crypto.createHmac("sha256", secret).update(String(exp)).digest("hex");
  const A = Buffer.from(sig || ""), B = Buffer.from(want);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

/* ---------- limits ---------- */
const PER_DAY = 12;
const PER_MINUTE = 3;
const KINDS = ["correction", "bug", "idea", "other"];
const STATUSES = ["new", "read", "done"];
const LIST_CAP = 2000;

/* ---------- cleaning ---------- */
/* control characters out, angle brackets out, dashes folded to the house
   middot. Newlines survive in the body and nowhere else. Invisible marks
   that hide text (zero width joiners, direction overrides) go too. */
const CTRL_ALL = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u2064\uFEFF]/g;
const CTRL_KEEP = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u2064\uFEFF]/g;
const strip = (s, keepLines) => String(s == null ? "" : s)
  .replace(/\r\n?/g, "\n")
  .replace(keepLines ? CTRL_KEEP : CTRL_ALL, " ")
  .replace(/[<>]/g, "")
  .replace(/[\u2014\u2013]/g, "\u00b7")
  .replace(/[ \t]{3,}/g, "  ")
  .replace(/\n{4,}/g, "\n\n\n")
  .trim();
const EMAIL = /^[^\s@]{1,64}@[^\s@.]{1,63}(\.[^\s@.]{1,63}){1,4}$/;

/* a sortable id: milliseconds, zero padded so string order is time order,
   plus a little noise so two notes in the same millisecond never collide. */
function newId() {
  return String(Date.now()).padStart(14, "0") + "-" +
    crypto.randomBytes(3).toString("hex");
}
const ID_OK = /^\d{14}-[0-9a-f]{6}$/;

/* one way, salted, short lived: enough to notice a flood, useless afterwards */
function fingerprint(req) {
  const raw = String(
    req.headers["x-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    (req.socket && req.socket.remoteAddress) || "?"
  ).split(",")[0].trim();
  const salt = process.env.ADMIN_SECRET || process.env.NOOR_RATE_SALT || "noor-inbox";
  return crypto.createHmac("sha256", salt).update(raw).digest("hex").slice(0, 16);
}

async function readBody(req) {
  let body = req.body;
  if (body === undefined || body === null || body === "") {
    body = await new Promise(resolve => {
      let s = "";
      try {
        req.on("data", c => { s += c; if (s.length > 64000) s = s.slice(0, 64000); });
        req.on("end", () => resolve(s));
        req.on("error", () => resolve(""));
      } catch { resolve(""); }
    });
  }
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  return body || {};
}

const json = (res, code, obj) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(obj);
};

/* ---------- reading the pile ---------- */
export async function readInbox(limit, status) {
  const ids = (await kv([["LRANGE", "nb:list", "0", String(LIST_CAP - 1)]]))[0] || [];
  const counts = { new: 0, read: 0, done: 0, total: 0 };
  if (!ids.length) return { items: [], counts };
  const rows = (await kv([["MGET", ...ids.map(i => "nb:msg:" + i)]]))[0] || [];
  const all = [];
  rows.forEach((r, i) => {
    if (!r) return;
    let m = null;
    try { m = JSON.parse(r); } catch { return; }
    if (!m || typeof m !== "object") return;
    m.id = m.id || ids[i];
    m.status = STATUSES.indexOf(m.status) !== -1 ? m.status : "new";
    counts[m.status] += 1;
    counts.total += 1;
    all.push(m);
  });
  all.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  const want = STATUSES.indexOf(status) !== -1 ? status : "";
  const picked = (want ? all.filter(m => m.status === want) : all).slice(0, limit);
  return { items: picked, counts };
}

export default async function handler(req, res) {
  const SECRET = process.env.ADMIN_SECRET;
  const owner = !!SECRET && verify(req.headers.cookie, SECRET);

  /* ============ the slot: anyone may push a note through ============ */
  if (req.method === "POST") {
    const body = await readBody(req);

    /* the honeypot. A machine fills every field it finds; a human never
       sees this one. The note is accepted with a smile and dropped. */
    if (String(body.hp || "").trim()) return json(res, 200, { ok: true });

    const kind = KINDS.indexOf(String(body.kind || "")) !== -1 ? String(body.kind) : "other";
    const bodyText = strip(body.body, true).slice(0, 4000);
    const page = strip(body.page, false).slice(0, 200);
    const fromRaw = strip(body.from, false).slice(0, 120);
    const from = EMAIL.test(fromRaw) ? fromRaw : "";
    if (!bodyText || bodyText.length < 1) return json(res, 400, { ok: false, reason: "empty" });
    if (fromRaw && !from) return json(res, 400, { ok: false, reason: "email" });

    if (!kvReady()) return json(res, 200, { ok: false, reason: "store" });

    try {
      const h = fingerprint(req);
      const dayKey = "nb:rl:d:" + h, minKey = "nb:rl:m:" + h;
      const counted = await kv([
        ["INCR", dayKey], ["EXPIRE", dayKey, "90000"],
        ["INCR", minKey], ["EXPIRE", minKey, "70"]
      ]);
      const perDay = parseInt(counted[0], 10) || 0;
      const perMin = parseInt(counted[2], 10) || 0;
      /* over the line: the sender is told the same calm yes as everyone
         else, and nothing is written. A spammer learns nothing. */
      if (perDay > PER_DAY || perMin > PER_MINUTE) return json(res, 200, { ok: true });

      const cc = String(req.headers["x-vercel-ip-country"] || "").slice(0, 2).toUpperCase();
      const id = newId();
      const msg = {
        id,
        kind,
        body: bodyText,
        page,
        from,
        cc: /^[A-Z]{2}$/.test(cc) ? cc : "",
        at: new Date().toISOString(),
        status: "new"
      };
      await kv([
        ["SET", "nb:msg:" + id, JSON.stringify(msg)],
        ["LPUSH", "nb:list", id],
        ["LTRIM", "nb:list", "0", String(LIST_CAP - 1)],
        ["INCR", "nb:unread"]
      ]);
      return json(res, 200, { ok: true });
    } catch {
      return json(res, 200, { ok: false, reason: "store" });
    }
  }

  /* ============ everything below is the owner's alone ============ */
  if (!SECRET) return json(res, 501, { ok: false, reason: "admin not configured" });
  if (!owner) return json(res, 401, { ok: false, reason: "locked" });

  if (req.method === "GET") {
    if (!kvReady()) return json(res, 200, { ok: false, reason: "store", items: [], counts: { new: 0, read: 0, done: 0, total: 0 } });
    try {
      const q = new URL(req.url || "/", "http://x").searchParams;
      let limit = parseInt(q.get("limit"), 10);
      if (!Number.isFinite(limit) || limit < 1) limit = 50;
      limit = Math.min(500, limit);
      const out = await readInbox(limit, q.get("status") || "");
      /* keep the badge honest: the counter follows what is actually there */
      try { await kv([["SET", "nb:unread", String(out.counts.new)]]); } catch {}
      return json(res, 200, { ok: true, items: out.items, counts: out.counts });
    } catch {
      return json(res, 200, { ok: false, reason: "store", items: [], counts: { new: 0, read: 0, done: 0, total: 0 } });
    }
  }

  if (req.method === "PATCH" || req.method === "PUT") {
    if (!kvReady()) return json(res, 200, { ok: false, reason: "store" });
    const body = await readBody(req);
    const id = String(body.id || "");
    if (!ID_OK.test(id)) return json(res, 400, { ok: false, reason: "id" });
    try {
      if (body.delete === true) {
        await kv([["DEL", "nb:msg:" + id], ["LREM", "nb:list", "0", id]]);
        const fresh = await readInbox(1, "");
        try { await kv([["SET", "nb:unread", String(fresh.counts.new)]]); } catch {}
        return json(res, 200, { ok: true, deleted: id, counts: fresh.counts });
      }
      const status = STATUSES.indexOf(String(body.status || "")) !== -1 ? String(body.status) : "";
      if (!status) return json(res, 400, { ok: false, reason: "status" });
      const cur = (await kv([["GET", "nb:msg:" + id]]))[0];
      if (!cur) return json(res, 404, { ok: false, reason: "gone" });
      let m = null;
      try { m = JSON.parse(cur); } catch { return json(res, 200, { ok: false, reason: "store" }); }
      m.status = status;
      await kv([["SET", "nb:msg:" + id, JSON.stringify(m)]]);
      const fresh = await readInbox(1, "");
      try { await kv([["SET", "nb:unread", String(fresh.counts.new)]]); } catch {}
      return json(res, 200, { ok: true, id, status, counts: fresh.counts });
    } catch {
      return json(res, 200, { ok: false, reason: "store" });
    }
  }

  return json(res, 405, { ok: false, reason: "method" });
}
