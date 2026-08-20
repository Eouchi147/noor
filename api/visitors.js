// Owner-only visitor map, read from the Codex's own lamp counter.
// Requires the noor_admin cookie plus any connected store: an
// Upstash-style REST endpoint, or any ordinary Redis via REDIS_URL.

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

export default async function handler(req, res) {
  const SECRET = process.env.ADMIN_SECRET;
  if (!SECRET) return res.status(501).json({ error: "admin not configured" });
  if (!verify(req.headers.cookie, SECRET)) return res.status(401).json({ error: "locked" });
  const enabled = kvReady();
  const out = { enabled, store: kvKind(), days: [], countries: [], rooms: [], sources: [], totals: { views30: 0, people30: 0 } };
  if (!enabled) return res.status(200).json(out);

  try {
    const days = [];
    for (let i = 29; i >= 0; i--) days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
    const months = [...new Set(days.map(d => d.slice(0, 7)))];

    const viewKeys = days.map(d => "nv:" + d + ":views");
    const peopleKeys = days.map(d => "nv:" + d + ":people");
    const keyLists = await kv(months.map(m => ["KEYS", "nm:" + m + ":*"]));
    const dimKeys = [].concat(...keyLists.map(x => x || []));

    const values = await kv([
      ["MGET", ...viewKeys],
      ["MGET", ...peopleKeys],
      ...(dimKeys.length ? [["MGET", ...dimKeys]] : [])
    ]);
    /* the finer grain: hour-of-day, visit length, per-day rooms, and how
       long each room holds a reader. All hashes, all aggregate. */
    const hashes = await kv([
      ...days.map(d => ["HGETALL", "nvh:" + d + ":hh"]),
      ...days.map(d => ["HGETALL", "nvh:" + d + ":dur"]),
      ...days.map(d => ["HGETALL", "nvh:" + d + ":rr"]),
      ...months.map(m => ["HGETALL", "nmh:" + m + ":rt"])
    ]).catch(() => []);
    function toObj(x) {
      if (!x) return {};
      if (Array.isArray(x)) { const o = {}; for (let i = 0; i + 1 < x.length; i += 2) o[x[i]] = parseInt(x[i + 1], 10) || 0; return o; }
      const o = {}; for (const k of Object.keys(x)) o[k] = parseInt(x[k], 10) || 0; return o;
    }
    const N = days.length;
    const hh = (hashes.slice(0, N) || []).map(toObj);
    const du = (hashes.slice(N, 2 * N) || []).map(toObj);
    const rr = (hashes.slice(2 * N, 3 * N) || []).map(toObj);
    const rt = (hashes.slice(3 * N) || []).map(toObj);
    const views = (values[0] || []).map(x => parseInt(x, 10) || 0);
    const people = (values[1] || []).map(x => parseInt(x, 10) || 0);
    const dims = dimKeys.length ? (values[2] || []).map(x => parseInt(x, 10) || 0) : [];

    out.days = days.map((d, i) => ({ date: d, views: views[i], people: people[i] }));
    out.totals.views30 = views.reduce((a, b) => a + b, 0);
    out.totals.people30 = people.reduce((a, b) => a + b, 0);

    const cAgg = {}, rAgg = {}, sAgg = {};
    dimKeys.forEach((k, i) => {
      const m = k.match(/^nm:\d{4}-\d{2}:(c|r|s):(.+)$/);
      if (!m) return;
      if (m[1] === "c") cAgg[m[2]] = (cAgg[m[2]] || 0) + dims[i];
      else if (m[1] === "s") sAgg[m[2]] = (sAgg[m[2]] || 0) + dims[i];
      else rAgg[m[2]] = (rAgg[m[2]] || 0) + dims[i];
    });
    /* hours 0-23, summed over the window */
    out.hours = Array.from({ length: 24 }, (_, h) => hh.reduce((t, d) => t + (d[h] || 0), 0));
    /* visit length: totals, four buckets, and a per-day average */
    const dtot = { secs: 0, n: 0, b1: 0, b2: 0, b3: 0, b4: 0 };
    du.forEach(d => { for (const k of Object.keys(dtot)) dtot[k] += d[k] || 0; });
    out.duration = {
      n: dtot.n, avg: dtot.n ? Math.round(dtot.secs / dtot.n) : 0,
      buckets: { b1: dtot.b1, b2: dtot.b2, b3: dtot.b3, b4: dtot.b4 },
      days: days.map((d, i) => ({ date: d, n: du[i].n || 0, avg: du[i].n ? Math.round((du[i].secs || 0) / du[i].n) : 0 }))
    };
    /* which rooms, day by day (only days that counted anything) */
    out.dayRooms = days.map((d, i) => ({ date: d, rooms: rr[i] })).filter(x => Object.keys(x.rooms).length);
    /* how long each room holds a reader, over the window months */
    const rtAgg = {};
    rt.forEach(h => {
      for (const k of Object.keys(h)) {
        const m2 = k.match(/^(s|n):(.+)$/); if (!m2) continue;
        (rtAgg[m2[2]] = rtAgg[m2[2]] || { s: 0, n: 0 })[m2[1]] += h[k];
      }
    });
    out.roomTime = Object.entries(rtAgg)
      .filter(([, v]) => v.n >= 3)
      .map(([r, v]) => ({ r, n: v.n, avg: Math.round(v.s / v.n) }))
      .sort((a, b) => b.n - a.n).slice(0, 16);

    out.countries = Object.entries(cAgg).map(([k, v]) => ({ c: k, n: v })).sort((a, b) => b.n - a.n).slice(0, 20);
    out.rooms = Object.entries(rAgg).map(([k, v]) => ({ r: k, n: v })).sort((a, b) => b.n - a.n).slice(0, 14);
    out.sources = Object.entries(sAgg).map(([k, v]) => ({ s: k, n: v })).sort((a, b) => b.n - a.n).slice(0, 14);
    return res.status(200).json(out);
  } catch {
    return res.status(200).json(out);
  }
}
