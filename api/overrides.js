// The corrections layer · a live text patch for urgent fixes.
//
// The Codex is static files on a CDN, so nothing here rewrites a source
// file. An override is an additive, reversible note that says: on this
// page, wherever this exact run of plain text appears, show that instead.
// assets/noor-overrides.js applies them in the reader's browser, in text
// nodes only. Nothing is ever injected as markup.
//
// What may never be touched, enforced here and not merely asked for:
//   · Arabic script of any kind, so the Qur'an and the sacred text are safe
//   · anything with angle brackets or curly braces, so markup is safe
//   · anything containing "script" or "http", so no code and no link
//   · anything longer than 400 characters, so no page is rewritten wholesale
//
// An override is a bandage. The permanent fix belongs in the next release.
//
// Keys:
//   nb:ovr   · the list of overrides, JSON, newest first
//   nb:ovrv  · a version number, raised on every change

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

/* ---------- the pages an override may name ---------- */
export const PAGES = [
  "index", "begin", "quran", "prophets", "arabic", "pillars", "school", "madrasa",
  "kids", "donate", "license", "legal", "feedback", "health", "theology",
  "characters", "companions", "places", "words", "latif", "family", "heroes",
  "unseen", "sermon", "soul", "ramadan", "sponsor", "ask", "404",
  "masjid/index", "masjid/board", "masjid/khutba", "masjid/qibla",
  "masjid/setup", "masjid/start", "masjid/timetable",
  "stories/index", "stories/adl", "stories/ghaffar", "stories/hadi",
  "stories/jabbar", "stories/razzaq", "stories/sabur", "stories/shakur",
  "stories/wadud",
  "kids/cradle", "kids/letters", "kids/lanterns", "kids/practice",
  "kids/ark-pairs", "kids/echo", "kids/island", "kids/kaaba-builder",
  "kids/orchard", "kids/star-catcher", "kids/story-steps", "kids/strong",
  "kids/yunus", "kids/zamzam"
];

/* every Arabic and Arabic-adjacent block. Sacred text can never be reached. */
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u0870-\u089F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const FORBIDDEN = /[<>{}]/;
const WORDS = /script|http/i;
const LIST_CAP = 200;

export function normalisePage(p) {
  let s = String(p == null ? "" : p).trim().toLowerCase();
  s = s.replace(/^https?:\/\/[^/]+/, "");
  s = s.replace(/[?#].*$/, "");
  s = s.replace(/^\/+/, "").replace(/\/+$/, "");
  s = s.replace(/\.html$/, "");
  if (s === "" || s === "home") s = "index";
  if (s === "masjid") s = "masjid/index";
  if (s === "stories") s = "stories/index";
  if (s === "give") s = "donate";
  return s;
}

/* one gate, used by this endpoint and by the assistant's edit mode */
export function checkOverride(o) {
  const page = normalisePage(o && o.page);
  const find = String((o && o.find) == null ? "" : o.find).replace(/\r\n?/g, "\n");
  const replace = String((o && o.replace) == null ? "" : o.replace).replace(/\r\n?/g, "\n");
  if (PAGES.indexOf(page) === -1) return { ok: false, reason: "That is not a page of this house." };
  if (find.length < 3) return { ok: false, reason: "The text to find must be at least 3 characters." };
  if (find.length > 400) return { ok: false, reason: "The text to find must be 400 characters or fewer." };
  if (replace.length > 400) return { ok: false, reason: "The replacement must be 400 characters or fewer." };
  if (FORBIDDEN.test(find) || FORBIDDEN.test(replace)) return { ok: false, reason: "Angle brackets and curly braces are never allowed: markup can never be touched." };
  if (WORDS.test(find) || WORDS.test(replace)) return { ok: false, reason: "The words script and http are never allowed: no code and no link may be patched in." };
  if (ARABIC.test(find) || ARABIC.test(replace)) return { ok: false, reason: "Arabic script is never touched. The Qur'an, the hadith and every sacred line are out of reach of this layer, by design." };
  if (find === replace) return { ok: false, reason: "The two are the same, so there is nothing to change." };
  return { ok: true, page, find, replace };
}

async function readBody(req) {
  let body = req.body;
  if (body === undefined || body === null || body === "") {
    body = await new Promise(resolve => {
      let s = "";
      try {
        req.on("data", c => { s += c; if (s.length > 32000) s = s.slice(0, 32000); });
        req.on("end", () => resolve(s));
        req.on("error", () => resolve(""));
      } catch { resolve(""); }
    });
  }
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  return body || {};
}

function newId() {
  return String(Date.now()).padStart(14, "0") + "-" + crypto.randomBytes(3).toString("hex");
}
const ID_OK = /^\d{14}-[0-9a-f]{6}$/;

const json = (res, code, obj) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(code).json(obj);
};

async function readAll() {
  const got = await kv([["LRANGE", "nb:ovr", "0", String(LIST_CAP - 1)], ["GET", "nb:ovrv"]]);
  const rows = got[0] || [];
  const v = parseInt(got[1], 10) || 0;
  const items = [];
  rows.forEach(r => {
    let o = null;
    try { o = JSON.parse(r); } catch { return; }
    const c = checkOverride(o);
    /* a record that would not pass the gate today never reaches a reader */
    if (!c.ok) return;
    items.push({ id: String(o.id || ""), page: c.page, find: c.find, replace: c.replace, why: String(o.why || "").slice(0, 300), at: String(o.at || "") });
  });
  return { v, items };
}

export default async function handler(req, res) {
  const SECRET = process.env.ADMIN_SECRET;
  const owner = !!SECRET && verify(req.headers.cookie, SECRET);

  /* ============ public: what every page asks for once ============ */
  if (req.method === "GET") {
    if (owner) res.setHeader("Cache-Control", "no-store");
    else res.setHeader("Cache-Control", "public, s-maxage=60, max-age=30, stale-while-revalidate=300");
    if (!kvReady()) return json(res, 200, { v: 0, items: [], ok: false, reason: "store" });
    try {
      const all = await readAll();
      return json(res, 200, {
        v: all.v,
        items: all.items.map(o => owner ? o : { page: o.page, find: o.find, replace: o.replace }),
        ok: true
      });
    } catch {
      return json(res, 200, { v: 0, items: [], ok: false, reason: "store" });
    }
  }

  /* ============ below here, the owner alone ============ */
  if (!SECRET) return json(res, 501, { ok: false, reason: "admin not configured" });
  if (!owner) return json(res, 401, { ok: false, reason: "locked" });
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "POST") {
    const body = await readBody(req);
    const c = checkOverride(body);
    if (!c.ok) return json(res, 400, { ok: false, reason: c.reason });
    if (!kvReady()) return json(res, 200, { ok: false, reason: "store" });
    try {
      const rec = {
        id: newId(), page: c.page, find: c.find, replace: c.replace,
        why: String(body.why || "").replace(/[<>]/g, "").slice(0, 300),
        at: new Date().toISOString()
      };
      await kv([
        ["LPUSH", "nb:ovr", JSON.stringify(rec)],
        ["LTRIM", "nb:ovr", "0", String(LIST_CAP - 1)],
        ["INCR", "nb:ovrv"]
      ]);
      const all = await readAll();
      return json(res, 200, { ok: true, id: rec.id, v: all.v, items: all.items });
    } catch {
      return json(res, 200, { ok: false, reason: "store" });
    }
  }

  if (req.method === "DELETE") {
    const body = await readBody(req);
    let q = null;
    try { q = new URL(req.url || "/", "http://x").searchParams; } catch { q = new URLSearchParams(); }
    const all = body.all === true || q.get("all") === "1" || q.get("all") === "true";
    const id = String(body.id || q.get("id") || "");
    if (!kvReady()) return json(res, 200, { ok: false, reason: "store" });
    try {
      if (all) {
        /* the one click back to the pristine site */
        await kv([["DEL", "nb:ovr"], ["INCR", "nb:ovrv"]]);
        const fresh = await readAll();
        return json(res, 200, { ok: true, cleared: true, v: fresh.v, items: fresh.items });
      }
      if (!ID_OK.test(id)) return json(res, 400, { ok: false, reason: "id" });
      const rows = (await kv([["LRANGE", "nb:ovr", "0", String(LIST_CAP - 1)]]))[0] || [];
      const keep = rows.filter(r => {
        let o = null;
        try { o = JSON.parse(r); } catch { return false; }
        return String(o && o.id) !== id;
      });
      const cmds = [["DEL", "nb:ovr"]];
      if (keep.length) cmds.push(["RPUSH", "nb:ovr", ...keep]);
      cmds.push(["INCR", "nb:ovrv"]);
      await kv(cmds);
      const fresh = await readAll();
      return json(res, 200, { ok: true, removed: id, v: fresh.v, items: fresh.items });
    } catch {
      return json(res, 200, { ok: false, reason: "store" });
    }
  }

  return json(res, 405, { ok: false, reason: "method" });
}
