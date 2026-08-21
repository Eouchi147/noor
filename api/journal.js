// The Guardian's Journal · one man's reflections, and the room where people answer back.
//
// This is deliberately NOT the Codex's voice. Every other room in this house
// carries an evidence badge on every claim, because it is teaching. The journal
// is the opposite: it is opinion, signed, dated, and clearly labelled as the
// thoughts of one contemporary Muslim who may simply be wrong. The two must
// never be mistaken for each other, so they do not share a theme, a voice, or
// a promise.
//
// It is also a blog engine that needs no build and no redeploy. Entries live in
// the store, are written from the owner's console, and appear the moment they
// are saved.
//
// On moderation, plainly: opinions are not moderated here, including opinions
// about the journal, the author, or the Codex. What is filtered is the machine
// noise that would otherwise bury them, spam, scams and floods, and that
// filtering only ever HOLDS a comment for the owner to look at. Nothing is
// deleted by a rule. A person decides.
//
// Keys:
//   nj:e:<id>       one entry, JSON
//   nj:list         entry ids, newest first
//   nj:slug:<slug>  slug to id
//   nj:c:<id>       comments on one entry, newest first
//   nj:held         comments a filter held, for the owner to release or bin
//   nj:rl:*         short lived flood counters, keyed by a one way hash
import crypto from "crypto";
import { kv, kvReady } from "./_kv.js";

const LIST_CAP = 500, COMMENT_CAP = 400;
const PER_DAY = 20, PER_MIN = 3;

/* ---------- the same owner lock every private endpoint here uses ---------- */
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

/* one way, salted, short lived: enough to notice a flood, useless afterwards */
function fingerprint(req) {
  const ip = String((req.headers && req.headers["x-forwarded-for"]) || "").split(",")[0].trim() || "0";
  const salt = (process.env.ADMIN_SECRET || "noor") + new Date().toISOString().slice(0, 10);
  return crypto.createHmac("sha256", salt).update(ip).digest("hex").slice(0, 20);
}

/* ---------- cleaning ----------
   Control characters out, angle brackets out, dashes folded to the house
   middot. Invisible marks that can hide text or flip its direction go too. */
const CTRL = "[\\u0000-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u2028-\\u202E\\u2060-\\u2064\\uFEFF]";
const CTRL_KEEP_LINES = new RegExp("[\\u0000-\\u0009\\u000B-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u2028-\\u202E\\u2060-\\u2064\\uFEFF]", "g");
const CTRL_ALL = new RegExp(CTRL, "g");
/* keepMarks preserves the > that begins a quotation. Dropping it silently
   robbed the writer of block quotes, and it was never the thing keeping the
   page safe: render() escapes every angle bracket before it formats. The <
   that could open a tag still goes. */
const strip = (s, keepLines, keepMarks) => String(s == null ? "" : s)
  .replace(/\r\n?/g, "\n")
  .replace(keepLines ? CTRL_KEEP_LINES : CTRL_ALL, " ")
  .replace(keepMarks ? /</g : /[<>]/g, "")
  .replace(/[—–]/g, "·")
  .replace(/[ \t]{3,}/g, "  ")
  .replace(/\n{4,}/g, "\n\n\n")
  .trim();

const esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function slugify(s) {
  return String(s || "").toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "entry";
}
function newId() {
  return String(Date.now()).padStart(14, "0") + "-" + crypto.randomBytes(3).toString("hex");
}
const ID_OK = /^\d{14}-[0-9a-f]{6}$/;

/* ---------- the smallest markup a writer will actually use ----------
   A blank line makes a paragraph. ## makes a heading. > makes a quotation.
   --- makes a divider. *word* is emphasis, **word** is strong, and a link is
   written the ordinary way. Everything else is escaped first, so an entry can
   never inject anything into its own page. */
export function render(md) {
  const src = String(md || "").replace(/\r\n?/g, "\n");
  const blocks = src.split(/\n{2,}/);
  const inline = t => esc(t)
    .replace(/\*\*([^*]{1,200})\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]{1,200})\*/g, "<em>$1</em>")
    .replace(/\[([^\]]{1,120})\]\((https?:\/\/[^\s)]{1,300}|\/[^\s)]{0,200})\)/g,
             '<a href="$2" rel="noopener">$1</a>')
    .replace(/\n/g, "<br>");
  const out = [];
  for (const raw of blocks) {
    const b = raw.trim();
    if (!b) continue;
    if (/^---+$/.test(b)) { out.push('<hr class="jrule">'); continue; }
    if (/^###\s+/.test(b)) { out.push("<h4>" + inline(b.replace(/^###\s+/, "")) + "</h4>"); continue; }
    if (/^##\s+/.test(b)) { out.push("<h3>" + inline(b.replace(/^##\s+/, "")) + "</h3>"); continue; }
    if (/^>\s?/.test(b)) {
      out.push("<blockquote>" + inline(b.split("\n").map(l => l.replace(/^>\s?/, "")).join("\n")) + "</blockquote>");
      continue;
    }
    if (/^[-*]\s+/.test(b)) {
      out.push("<ul>" + b.split("\n").filter(l => /^[-*]\s+/.test(l))
        .map(l => "<li>" + inline(l.replace(/^[-*]\s+/, "")) + "</li>").join("") + "</ul>");
      continue;
    }
    out.push("<p>" + inline(b) + "</p>");
  }
  return out.join("\n");
}

/* ---------- what a filter may hold, and what it may never touch ----------
   Every rule here is about SHAPE, never about opinion. A furious comment that
   disagrees with every word of an entry passes untouched. A polite comment
   selling watches does not. Held is not deleted: it waits for a person. */
export function smells(name, body) {
  const t = (String(name) + " " + String(body)).toLowerCase();
  const links = (String(body).match(/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|ru|xyz|top|shop|info|biz|link|click)\b/gi) || []).length;
  const reasons = [];
  if (links >= 2) reasons.push("several links");
  if (links >= 1 && String(body).replace(/\s+/g, "").length < 90) reasons.push("a link and almost no words");
  if (/\b(seo|backlink|casino|forex|binary option|loan offer|investment opportunity)\b/i.test(t) ||
      /\b(crypto|bitcoin) ?(signal|pump|recovery)\b/i.test(t) ||
      /\bhack(er|ing)? (service|recovery)\b/i.test(t) ||
      /\brecover (your )?(funds|bitcoin|wallet)\b/i.test(t) ||
      /\bwhatsapp \+?\d/i.test(t) || /\btelegram @/i.test(t))
    reasons.push("a known selling pattern");
  if (/(.)\1{14,}/.test(String(body))) reasons.push("a long run of one character");
  const letters = String(body).replace(/[^a-z]/gi, "");
  if (letters.length > 40 && (letters.replace(/[^A-Z]/g, "").length / letters.length) > 0.75)
    reasons.push("almost entirely capitals");
  return reasons;
}

async function readEntry(id) {
  const got = await kv([["GET", "nj:e:" + id], ["LLEN", "nj:c:" + id]]);
  if (!got[0]) return null;
  let e; try { e = JSON.parse(got[0]); } catch { return null; }
  e.comments = parseInt(got[1], 10) || 0;
  return e;
}
const card = e => ({ id: e.id, slug: e.slug, title: e.title, dek: e.dek, at: e.at,
                     edited: e.edited || "", tags: e.tags || [], comments: e.comments || 0,
                     status: e.status, words: e.words || 0 });

function json(res, code, obj, cache) {
  res.setHeader("Cache-Control", cache || "no-store");
  return res.status(code).json(obj);
}

export default async function handler(req, res) {
  const SECRET = process.env.ADMIN_SECRET;
  const owner = !!SECRET && verify(req.headers && req.headers.cookie, SECRET);
  const q = req.query || {};

  if (!kvReady()) {
    if (req.method === "GET") return json(res, 200, { ok: true, entries: [], store: false });
    return json(res, 200, { ok: false, reason: "store" });
  }

  /* ---------------- reading, open to everyone ---------------- */
  if (req.method === "GET") {
    if (q.slug) {
      const id = (await kv([["GET", "nj:slug:" + slugify(q.slug)]]))[0];
      if (!id) return json(res, 404, { ok: false, reason: "not found" });
      const e = await readEntry(id);
      if (!e || (e.status !== "published" && !owner)) return json(res, 404, { ok: false, reason: "not found" });
      const rows = (await kv([["LRANGE", "nj:c:" + id, "0", String(COMMENT_CAP)]]))[0] || [];
      const comments = rows.map(r => { try { return JSON.parse(r); } catch { return null; } })
        .filter(Boolean).filter(c => owner || !c.held);
      return json(res, 200, { ok: true, entry: e, html: render(e.body), comments },
                  e.status === "published" ? "public, s-maxage=60, stale-while-revalidate=600" : "no-store");
    }
    const ids = (await kv([["LRANGE", "nj:list", "0", String(LIST_CAP)]]))[0] || [];
    if (!ids.length) return json(res, 200, { ok: true, entries: [] }, "public, s-maxage=60, stale-while-revalidate=600");
    const raws = await kv(ids.map(i => ["GET", "nj:e:" + i]));
    const counts = await kv(ids.map(i => ["LLEN", "nj:c:" + i]));
    const entries = raws.map((r, i) => {
      if (!r) return null;
      try { const e = JSON.parse(r); e.comments = parseInt(counts[i], 10) || 0; return e; } catch { return null; }
    }).filter(Boolean).filter(e => owner || e.status === "published").map(card);
    return json(res, 200, { ok: true, entries }, "public, s-maxage=60, stale-while-revalidate=600");
  }

  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return json(res, 405, { ok: false }); }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const action = String(body.action || "");

  /* ---------------- anyone may answer back ---------------- */
  if (action === "comment") {
    const slug = slugify(body.slug);
    const name = strip(body.name, false).slice(0, 40) || "A reader";
    const text = strip(body.body, true).slice(0, 4000);
    if (text.length < 2) return json(res, 400, { ok: false, reason: "empty" });

    const id = (await kv([["GET", "nj:slug:" + slug]]))[0];
    if (!id) return json(res, 404, { ok: false, reason: "not found" });

    const h = fingerprint(req);
    const dayKey = "nj:rl:d:" + h, minKey = "nj:rl:m:" + h;
    const counted = await kv([["INCR", dayKey], ["EXPIRE", dayKey, "90000"],
                              ["INCR", minKey], ["EXPIRE", minKey, "70"]]);
    const perDay = parseInt(counted[0], 10) || 0, perMin = parseInt(counted[2], 10) || 0;
    /* A flood is told the same calm yes as everyone else and is simply not
       kept. Arguing with a script only teaches it. */
    if (perDay > PER_DAY || perMin > PER_MIN) return json(res, 200, { ok: true, queued: true });

    const reasons = smells(name, text);
    const c = { cid: newId(), name, body: text, at: new Date().toISOString(),
                held: reasons.length ? 1 : 0, why: reasons.join(", ") };
    const cmds = [["LPUSH", "nj:c:" + id, JSON.stringify(c)],
                  ["LTRIM", "nj:c:" + id, "0", String(COMMENT_CAP)]];
    if (reasons.length) {
      cmds.push(["LPUSH", "nj:held", JSON.stringify({ entry: id, slug, cid: c.cid, at: c.at })]);
      cmds.push(["LTRIM", "nj:held", "0", "300"]);
    }
    await kv(cmds);
    return json(res, 200, { ok: true, held: !!reasons.length, comment: reasons.length ? null : c });
  }

  /* ---------------- everything below is the owner's ---------------- */
  if (!owner) return json(res, 401, { ok: false, reason: "locked" });

  if (action === "save") {
    const id = ID_OK.test(String(body.id || "")) ? String(body.id) : newId();
    const title = strip(body.title, false).slice(0, 160);
    if (!title) return json(res, 400, { ok: false, reason: "title" });
    const text = strip(body.body, true, true).slice(0, 60000);
    const wanted = slugify(body.slug || title);
    const prevRaw = (await kv([["GET", "nj:e:" + id]]))[0];
    let prev = null;
    if (prevRaw) { try { prev = JSON.parse(prevRaw); } catch { prev = null; } }

    /* a slug already spoken for by a different entry gets a suffix rather than
       silently stealing another entry's address */
    let slug = wanted;
    const taken = (await kv([["GET", "nj:slug:" + slug]]))[0];
    if (taken && taken !== id) slug = slug + "-" + String(Date.now()).slice(-4);

    const e = {
      id, slug, title,
      dek: strip(body.dek, false).slice(0, 300),
      body: text,
      tags: (Array.isArray(body.tags) ? body.tags : String(body.tags || "").split(","))
              .map(t => strip(t, false).slice(0, 28)).filter(Boolean).slice(0, 6),
      status: body.status === "published" ? "published" : "draft",
      at: prev && prev.at ? prev.at : new Date().toISOString(),
      edited: prev ? new Date().toISOString() : "",
      words: text.split(/\s+/).filter(Boolean).length
    };
    if (body.at) { const d = new Date(body.at); if (!isNaN(d.getTime())) e.at = d.toISOString(); }

    const cmds = [["SET", "nj:e:" + id, JSON.stringify(e)], ["SET", "nj:slug:" + slug, id]];
    if (prev && prev.slug && prev.slug !== slug) cmds.push(["DEL", "nj:slug:" + prev.slug]);
    if (!prev) { cmds.push(["LPUSH", "nj:list", id]); cmds.push(["LTRIM", "nj:list", "0", String(LIST_CAP)]); }
    await kv(cmds);
    return json(res, 200, { ok: true, entry: card(e) });
  }

  if (action === "delete") {
    const id = String(body.id || "");
    if (!ID_OK.test(id)) return json(res, 400, { ok: false });
    const e = await readEntry(id);
    const cmds = [["DEL", "nj:e:" + id], ["LREM", "nj:list", "0", id], ["DEL", "nj:c:" + id]];
    if (e && e.slug) cmds.push(["DEL", "nj:slug:" + e.slug]);
    await kv(cmds);
    return json(res, 200, { ok: true });
  }

  /* release a held comment, hold one, or remove it for good.
     All three are a person's act, never a rule's. */
  if (action === "comment-state") {
    const id = String(body.id || ""), cid = String(body.cid || "");
    if (!ID_OK.test(id) || !ID_OK.test(cid)) return json(res, 400, { ok: false });
    const key = "nj:c:" + id;
    const rows = (await kv([["LRANGE", key, "0", String(COMMENT_CAP)]]))[0] || [];
    const keep = [];
    let touched = false;
    for (const r of rows) {
      let c; try { c = JSON.parse(r); } catch { continue; }
      if (c.cid === cid) {
        touched = true;
        if (body.state === "remove") continue;
        c.held = body.state === "hold" ? 1 : 0;
        if (!c.held) c.why = "";
      }
      keep.push(JSON.stringify(c));
    }
    if (!touched) return json(res, 404, { ok: false });
    const cmds = [["DEL", key]];
    if (keep.length) cmds.push(["RPUSH", key].concat(keep));
    await kv(cmds);
    return json(res, 200, { ok: true });
  }

  if (action === "held") {
    const rows = (await kv([["LRANGE", "nj:held", "0", "300"]]))[0] || [];
    return json(res, 200, { ok: true, held: rows.map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean) });
  }

  return json(res, 400, { ok: false, reason: "unknown action" });
}
