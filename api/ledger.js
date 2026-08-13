// The Giving Ledger · owner-only. The promise, kept in arithmetic.
//
// The house sets aside, as a personal commitment of the keeper and never as
// a condition of any gift, 2.5 percent of money received for zakat-eligible
// causes and 17.5 percent toward a fund to help build masajid. No giver was
// ever told that their particular gift would go to either. This endpoint
// exists so the keeper always knows the one number that matters: what is
// still owed.
//
// It reads Stripe for succeeded payments, page by page, subtracts refunds,
// reads the Stripe fee where the balance transaction gives it, and holds the
// disbursements the owner has actually made in the store under nb:given.
// Every amount here is in minor units (cents, fils, paise) and integer, so
// nothing drifts.
//
// Keys:
//   nb:given · the list of disbursements actually made, JSON

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

/* ---------- the two set-asides, in basis points so the maths is exact ---- */
export const FUNDS = {
  zakat: { bp: 250, label: "Zakat", pct: "2.5 percent", of: "zakat-eligible causes" },
  masjid: { bp: 1750, label: "Masjid fund", pct: "17.5 percent", of: "a fund to help build masajid" }
};
export const HONEST_LINE =
  "These two are set aside from money received. They are a commitment of the keeper, " +
  "not a condition of any gift, and no giver was ever promised that their particular " +
  "gift would go to zakat or to a masjid.";

const share = (grossMinor, bp) => Math.round((grossMinor * bp) / 10000);
const KINDS = ["zakat", "masjid"];
const LIST_CAP = 500;
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;

function newId() {
  return String(Date.now()).padStart(14, "0") + "-" + crypto.randomBytes(3).toString("hex");
}
const ID_OK = /^\d{14}-[0-9a-f]{6}$/;

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

const json = (res, code, obj) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(obj);
};

/* ---------- Stripe, properly paginated ---------- */
export async function fetchCharges(key, from, to, fetchImpl) {
  const F = fetchImpl || fetch;
  const rows = [];
  let starting = "";
  for (let page = 0; page < 25; page++) {
    const q = new URLSearchParams({ limit: "100" });
    q.append("expand[]", "data.balance_transaction");
    if (from) q.set("created[gte]", String(from));
    if (to) q.set("created[lte]", String(to));
    if (starting) q.set("starting_after", starting);
    const r = await F("https://api.stripe.com/v1/charges?" + q.toString(), {
      headers: { Authorization: "Bearer " + key }
    });
    if (!r.ok) throw new Error("stripe " + r.status);
    const j = await r.json();
    const data = j.data || [];
    rows.push(...data);
    if (!j.has_more || !data.length) break;
    starting = data[data.length - 1].id;
  }
  return rows;
}

/* ---------- the arithmetic, on its own, so it can be tested and reused --- */
export function tally(charges, given) {
  const byCur = {};
  const months = {};
  let feesPartial = false;

  (charges || []).forEach(c => {
    if (!c) return;
    if (c.status !== "succeeded" || c.paid !== true) return;
    const captured = Number.isFinite(c.amount_captured) ? c.amount_captured : (c.amount || 0);
    const gross = Math.max(0, Math.round(captured - (c.amount_refunded || 0)));
    if (!gross) return;
    const cur = String(c.currency || "usd").toLowerCase();
    const bt = c.balance_transaction && typeof c.balance_transaction === "object" ? c.balance_transaction : null;
    let fee = 0;
    if (bt && String(bt.currency || "").toLowerCase() === cur && Number.isFinite(bt.fee)) fee = Math.max(0, Math.round(bt.fee));
    else feesPartial = true;

    if (!byCur[cur]) byCur[cur] = { currency: cur, gross: 0, fee: 0, net: 0, count: 0 };
    byCur[cur].gross += gross;
    byCur[cur].fee += fee;
    byCur[cur].count += 1;

    const month = c.created ? new Date(c.created * 1000).toISOString().slice(0, 7) : "unknown";
    const mk = cur + "|" + month;
    if (!months[mk]) months[mk] = { month, currency: cur, gross: 0, fee: 0, net: 0, count: 0, zakat: 0, masjid: 0, givenZakat: 0, givenMasjid: 0 };
    months[mk].gross += gross;
    months[mk].fee += fee;
    months[mk].count += 1;
  });

  Object.values(byCur).forEach(v => { v.net = v.gross - v.fee; });
  const currencies = Object.values(byCur).sort((a, b) => b.gross - a.gross);
  const primary = currencies[0] || { currency: "usd", gross: 0, fee: 0, net: 0, count: 0 };

  /* the accrual is taken on the whole, not month by month, so the total is
     exactly the percentage of the total and no rounding creeps in */
  const funds = {};
  KINDS.forEach(k => {
    const accrued = share(primary.gross, FUNDS[k].bp);
    funds[k] = {
      key: k,
      label: FUNDS[k].label,
      pct: FUNDS[k].pct,
      rateBp: FUNDS[k].bp,
      of: FUNDS[k].of,
      accrued,
      given: 0,
      outstanding: accrued
    };
  });

  const cleanGiven = (given || []).map(g => ({
    id: String((g && g.id) || ""),
    kind: KINDS.indexOf(String(g && g.kind)) !== -1 ? String(g.kind) : "",
    amountMinor: Math.max(0, Math.round(Number((g && g.amountMinor) || 0)) || 0),
    currency: String((g && g.currency) || primary.currency).toLowerCase(),
    note: String((g && g.note) || "").slice(0, 200),
    date: DATE_OK.test(String((g && g.date) || "")) ? String(g.date) : String((g && g.at) || "").slice(0, 10),
    at: String((g && g.at) || "")
  })).filter(g => g.kind && g.amountMinor);

  cleanGiven.forEach(g => {
    if (g.currency !== primary.currency) return;
    funds[g.kind].given += g.amountMinor;
    const month = DATE_OK.test(g.date) ? g.date.slice(0, 7) : "unknown";
    const mk = g.currency + "|" + month;
    if (!months[mk]) months[mk] = { month, currency: g.currency, gross: 0, fee: 0, net: 0, count: 0, zakat: 0, masjid: 0, givenZakat: 0, givenMasjid: 0 };
    if (g.kind === "zakat") months[mk].givenZakat += g.amountMinor;
    else months[mk].givenMasjid += g.amountMinor;
  });

  KINDS.forEach(k => { funds[k].outstanding = funds[k].accrued - funds[k].given; });

  const monthRows = Object.values(months)
    .filter(m => m.currency === primary.currency)
    .map(m => {
      m.net = m.gross - m.fee;
      m.zakat = share(m.gross, FUNDS.zakat.bp);
      m.masjid = share(m.gross, FUNDS.masjid.bp);
      return m;
    })
    .sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0));

  return {
    currency: primary.currency,
    totals: {
      gross: primary.gross,
      fee: primary.fee,
      net: primary.gross - primary.fee,
      count: primary.count,
      feesPartial
    },
    currencies,
    funds,
    months: monthRows,
    given: cleanGiven.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    honest: HONEST_LINE
  };
}

/* ---------- what the assistant and the console both ask for ---------- */
export async function computeLedger(opts) {
  const o = opts || {};
  const key = o.key || process.env.STRIPE_SECRET_KEY;
  if (!key) return { ok: false, reason: "stripe", configured: false, store: kvReady(), ...tally([], []) };

  let given = [];
  let store = kvReady();
  if (store) {
    try {
      const rows = (await kv([["LRANGE", "nb:given", "0", String(LIST_CAP - 1)]]))[0] || [];
      given = rows.map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
    } catch { store = false; }
  }

  let charges = [];
  try {
    charges = await fetchCharges(key, o.from, o.to, o.fetchImpl);
  } catch {
    return { ok: false, reason: "stripe", configured: true, store, ...tally([], given) };
  }
  return { ok: true, configured: true, store, range: { from: o.from || null, to: o.to || null }, ...tally(charges, given) };
}

const unix = (s, endOfDay) => {
  if (!DATE_OK.test(String(s || ""))) return 0;
  const t = Date.parse(s + (endOfDay ? "T23:59:59Z" : "T00:00:00Z"));
  return Number.isFinite(t) ? Math.floor(t / 1000) : 0;
};

export default async function handler(req, res) {
  const SECRET = process.env.ADMIN_SECRET;
  if (!SECRET) return json(res, 501, { ok: false, reason: "admin not configured" });
  if (!verify(req.headers.cookie, SECRET)) return json(res, 401, { ok: false, reason: "locked" });

  let q = new URLSearchParams();
  try { q = new URL(req.url || "/", "http://x").searchParams; } catch {}

  if (req.method === "GET") {
    try {
      const out = await computeLedger({ from: unix(q.get("from"), false) || 0, to: unix(q.get("to"), true) || 0 });
      return json(res, 200, out);
    } catch {
      return json(res, 200, { ok: false, reason: "stripe", configured: !!process.env.STRIPE_SECRET_KEY, store: kvReady(), ...tally([], []) });
    }
  }

  /* record what was actually given away */
  if (req.method === "POST") {
    const body = await readBody(req);
    const kind = KINDS.indexOf(String(body.kind || "")) !== -1 ? String(body.kind) : "";
    const amountMinor = Math.round(Number(body.amountMinor));
    if (!kind) return json(res, 400, { ok: false, reason: "kind must be zakat or masjid" });
    if (!Number.isFinite(amountMinor) || amountMinor <= 0 || amountMinor > 1000000000) return json(res, 400, { ok: false, reason: "amount" });
    if (!kvReady()) return json(res, 200, { ok: false, reason: "store" });
    const rec = {
      id: newId(),
      kind,
      amountMinor,
      currency: String(body.currency || "").toLowerCase().replace(/[^a-z]/g, "").slice(0, 3),
      note: String(body.note || "").replace(/[<>]/g, "").slice(0, 200),
      date: DATE_OK.test(String(body.date || "")) ? String(body.date) : new Date().toISOString().slice(0, 10),
      at: new Date().toISOString()
    };
    try {
      if (!rec.currency) {
        /* stamp it with the currency the money actually arrives in */
        const peek = await computeLedger({});
        rec.currency = peek.currency || "usd";
      }
      await kv([
        ["LPUSH", "nb:given", JSON.stringify(rec)],
        ["LTRIM", "nb:given", "0", String(LIST_CAP - 1)]
      ]);
      const out = await computeLedger({ from: unix(q.get("from"), false) || 0, to: unix(q.get("to"), true) || 0 });
      return json(res, 200, { ...out, recorded: rec.id });
    } catch {
      return json(res, 200, { ok: false, reason: "store" });
    }
  }

  /* a mistyped disbursement must be removable, or the number lies forever */
  if (req.method === "DELETE") {
    const body = await readBody(req);
    const id = String(body.id || q.get("id") || "");
    if (!ID_OK.test(id)) return json(res, 400, { ok: false, reason: "id" });
    if (!kvReady()) return json(res, 200, { ok: false, reason: "store" });
    try {
      const rows = (await kv([["LRANGE", "nb:given", "0", String(LIST_CAP - 1)]]))[0] || [];
      const keep = rows.filter(r => {
        let o = null;
        try { o = JSON.parse(r); } catch { return false; }
        return String(o && o.id) !== id;
      });
      const cmds = [["DEL", "nb:given"]];
      if (keep.length) cmds.push(["RPUSH", "nb:given", ...keep]);
      await kv(cmds);
      const out = await computeLedger({});
      return json(res, 200, { ...out, removed: id });
    } catch {
      return json(res, 200, { ok: false, reason: "store" });
    }
  }

  return json(res, 405, { ok: false, reason: "method" });
}
