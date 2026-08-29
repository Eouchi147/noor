// The Lantern's night shift.
//
// THE DOCTRINE, WHICH EVERY JOB IN THIS FILE OBEYS
//
//   The Lantern does not write facts. It exercises judgment over material
//   that is already true.
//
// The day's light was the first thing moved onto this footing: it used to ask
// a free model to produce a historical fact every morning, which is the single
// worst job a language model can be given, because being confidently wrong is
// invisible, unbounded, and published under the name of an Islamic library.
// Now the model chooses among six real cards and may doubt its own choice.
//
// Everything here has the same shape. Each job hands the model material the
// house already published, asks it one bounded question about that material,
// and files what comes back as a FINDING for the owner to read. No job in this
// file may edit a page, publish anything, or delete anything. The worst a
// broken job can do is waste a call and put a wrong note in a list nobody has
// to act on.
//
// WHY THIS IS WORTH SPENDING CALLS ON
//
// The site is roughly a thousand published passages and grows every week. One
// person cannot re-read it. Twelve passages a night is four and a half
// thousand a year, which is the whole corpus several times over, and the only
// thing being asked is the question that actually matters: does this state
// something as fact without sourcing it, misattribute a hadith, or read as a
// ruling rather than a teaching.
//
// COST
//   audit   12 calls a night   (the number is a dial)
//   brief    1 call a night
//   triage   1 call per unread inbox message, capped at 20 a night
//   Everything runs on the free chain, in the nightly cron, off the request
//   path. A reader never waits for any of it.

import { kv, kvReady } from "./_kv.js";
/* askOpenRouter returns { text, model, error, tried } and has NO `ok` field.
   Three jobs here were written against an `ok` that never existed, so every
   successful reply looked like a dark Lantern and every job silently did
   nothing at all while reporting success. Read got.text. */
import { askOpenRouter } from "./_models.js";

const K_FIND = "nl:find";        /* what the Lantern flagged, newest first */
const K_CURSOR = "nl:auditcur";  /* how far through the corpus it has walked */
const K_BRIEF = "nl:brief";      /* the day in three sentences */
const K_RUN = "nl:shift";        /* what the last night shift actually did */

export const DEFAULT_AUDIT = 12;
const TRIAGE_CAP = 20;

const nums = s => (String(s).match(/\d+/g) || []);

/* ---------------------------------------------------------------------------
   gathering the material

   Everything audited is something the house has already published. The cursor
   walks the whole corpus rather than sampling, so a passage is looked at once
   before any passage is looked at twice, exactly like the light rotation.
--------------------------------------------------------------------------- */
async function fetchJSON(base, path, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(base + path, { signal: ctrl.signal });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

export async function corpus(host) {
  const base = "https://" + String(host).replace(/^https?:\/\//, "");
  const out = [];

  const lights = await fetchJSON(base, "/lights/all.json", 9000);
  for (const l of (lights && lights.lights) || [])
    out.push({ kind: "light", id: l.id, where: "build/lights-*.json",
               lvl: l.lvl, src: l.src || "", text: l.t + "\n" + l.s + "\n" + l.d });

  const ix = await fetchJSON(base, "/verse/index.json");
  const surahs = (ix && (ix.surahs || ix.list || Object.keys(ix.n || {}))) || [];
  for (const sRaw of surahs.slice(0, 60)) {
    const s = typeof sRaw === "object" ? (sRaw.n || sRaw.id) : sRaw;
    const doc = await fetchJSON(base, "/verse/" + s + ".json");
    const verses = (doc && doc.v) || {};
    for (const a of Object.keys(verses)) {
      const v = verses[a];
      const notes = (v.notes || []).map(n => n.t || "").join("\n");
      out.push({ kind: "verse", id: s + ":" + a, where: "verse/" + s + ".json",
                 lvl: "", src: "", text: (v.sense || "") + "\n" + notes });
    }
  }
  return out.filter(p => String(p.text).trim().length > 120);
}

/* ---------------------------------------------------------------------------
   job one: the corpus auditor
--------------------------------------------------------------------------- */
const AUDIT_SYSTEM =
  "You are checking one passage from a free Islamic library, on behalf of its editor. " +
  "You are NOT rewriting it and you are NOT adding to it. Answer one question: is there " +
  "anything here an editor should look at again? Flag only these: a hadith or a Qur'anic " +
  "verse attributed without a collection, number or reference; a claim of fact that would " +
  "surprise a specialist; something that reads as a ruling or a fatwa rather than teaching; " +
  "a place where scholars differ being presented as settled; a date or a number that looks " +
  "wrong. Do NOT flag style, tone, length, spelling, or anything you merely find unusual. " +
  "Most passages are fine and \"clear\" is the correct answer for most of them. " +
  'Reply with JSON only: {"verdict":"clear"} or {"verdict":"look","why":"<under 25 words>"}';

export async function auditOne(passage) {
  const got = await askOpenRouter([
    { role: "system", content: AUDIT_SYSTEM },
    { role: "user", content:
        (passage.lvl ? "The card claims evidence level: " + passage.lvl + ".\n" : "") +
        (passage.src ? "It cites: " + passage.src + ".\n" : "") +
        "Passage:\n" + String(passage.text).slice(0, 2400) }
  ], { max_tokens: 160, temperature: 0, timeout: 9000, budget: 12000, maxTries: 2,
       title: "NOOR Codex of Light · corpus audit" });
  if (!got || !String(got.text || "").trim())
    return { verdict: "skip", why: (got && got.error) || "the Lantern is dark" };
  let p = null;
  try { p = JSON.parse(String(got.text).trim()); }
  catch { const m = String(got.text).match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]); } catch { } } }
  if (!p || (p.verdict !== "look" && p.verdict !== "clear"))
    return { verdict: "skip", why: "the reply was not usable" };
  if (p.verdict === "clear") return { verdict: "clear", model: got.model };

  const why = String(p.why || "").slice(0, 180);
  /* The same guard the caption uses. A finding that invents a number is a
     finding about a passage that does not exist, and the owner would go
     looking for something that was never there. */
  const ours = new Set(nums(passage.text));
  if (nums(why).some(n => !ours.has(n)))
    return { verdict: "skip", why: "the finding introduced a number the passage does not contain" };
  return { verdict: "look", why, model: got.model };
}

export async function auditCorpus(host, n = DEFAULT_AUDIT) {
  const all = await corpus(host);
  if (!all.length) return { ok: false, why: "the corpus could not be read", looked: 0 };

  let cur = 0;
  if (kvReady()) { try { cur = Number((await kv([["GET", K_CURSOR]]))[0] || 0) || 0; } catch { } }

  const found = [], seen = [];
  for (let i = 0; i < n; i++) {
    const p = all[(cur + i) % all.length];
    const r = await auditOne(p);
    seen.push({ id: p.id, verdict: r.verdict });
    if (r.verdict === "look")
      found.push({ at: new Date().toISOString(), job: "audit", id: p.id,
                   where: p.where, kind: p.kind, why: r.why, model: r.model || "" });
  }

  if (kvReady()) {
    const cmds = [["SET", K_CURSOR, String((cur + n) % all.length)]];
    for (const f of found) cmds.push(["LPUSH", K_FIND, JSON.stringify(f)]);
    if (found.length) cmds.push(["LTRIM", K_FIND, "0", "300"], ["EXPIRE", K_FIND, "31536000"]);
    try { await kv(cmds); } catch { }
  }
  return { ok: true, looked: n, of: all.length, from: cur, found: found.length,
           pace: Math.ceil(all.length / Math.max(1, n)) + " nights to walk the whole corpus" };
}

/* ---------------------------------------------------------------------------
   job two: the day in three sentences
--------------------------------------------------------------------------- */
export async function dailyBrief(facts) {
  const plain = Object.entries(facts || {})
    .map(([k, v]) => k + ": " + (v === null || v === undefined ? "unknown" : String(v)))
    .join("\n");
  const got = await askOpenRouter([
    { role: "system", content:
        "You write the owner of a small free Islamic library three short sentences about his own site, " +
        "from the numbers below and nothing else. Sentence one: what changed. Sentence two: what needs " +
        "him today. Sentence three: what can wait. You may not invent a number, a name or an event. " +
        "If a number is unknown, say so plainly rather than guessing. No emoji, no exclamation marks, " +
        "no long dashes, no praise. Reply with the three sentences and nothing else." },
    { role: "user", content: plain }
  ], { max_tokens: 220, temperature: 0.2, timeout: 9000, budget: 9000, maxTries: 2,
       title: "NOOR Codex of Light · the day in three sentences" });
  if (!got || !String(got.text || "").trim()) return { ok: false, why: got && got.error ? got.error : "the Lantern is dark" };
  const text = String(got.text).trim();
  const ours = new Set(nums(plain));
  if (nums(text).some(x => !ours.has(x)))
    return { ok: false, why: "it introduced a number the numbers did not contain" };
  if (/[—–!]|[\u{1F300}-\u{1FAFF}]/u.test(text)) return { ok: false, why: "house style" };
  const rec = { at: new Date().toISOString(), text, model: got.model || "" };
  if (kvReady()) { try { await kv([["SET", K_BRIEF, JSON.stringify(rec)], ["EXPIRE", K_BRIEF, "604800"]]); } catch { } }
  return { ok: true, ...rec };
}

export async function readBrief() {
  if (!kvReady()) return null;
  try {
    const r = (await kv([["GET", K_BRIEF]]))[0];
    return r ? (typeof r === "string" ? JSON.parse(r) : r) : null;
  } catch { return null; }
}

/* ---------------------------------------------------------------------------
   job three: inbox triage

   A correction about a hadith citation is the most valuable message this site
   can receive, and it must not sit behind forty messages of thanks. The
   Lantern sorts; it never replies, publishes or deletes.
--------------------------------------------------------------------------- */
const SORTS = ["correction", "question", "thanks", "problem", "other"];

export async function triageOne(msg) {
  const got = await askOpenRouter([
    { role: "system", content:
        "Sort one message sent to a free Islamic library into exactly one of: " +
        SORTS.join(", ") + ". A correction says something on the site is wrong. " +
        "A problem is a broken page or a technical fault. Then say in under twelve words what it " +
        "is about, using only words from the message. " +
        'Reply with JSON only: {"sort":"<one>","gist":"<under 12 words>","urgent":true|false}' },
    { role: "user", content: String(msg.body || msg.text || "").slice(0, 1800) }
  ], { max_tokens: 120, temperature: 0, timeout: 8000, budget: 8000, maxTries: 2,
       title: "NOOR Codex of Light · inbox triage" });
  if (!got || !String(got.text || "").trim()) return null;
  let p = null;
  try { p = JSON.parse(String(got.text).trim()); }
  catch { const m = String(got.text).match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]); } catch { } } }
  if (!p || SORTS.indexOf(p.sort) === -1) return null;
  return { sort: p.sort, gist: String(p.gist || "").slice(0, 90), urgent: p.urgent === true, model: got.model };
}

export async function triageInbox(cap = TRIAGE_CAP) {
  if (!kvReady()) return { ok: false, why: "no store", sorted: 0 };
  let ids = [];
  try { ids = ((await kv([["LRANGE", "nb:list", "0", String(cap * 3)]]))[0]) || []; } catch { return { ok: false, sorted: 0 }; }
  if (!ids.length) return { ok: true, sorted: 0, why: "the inbox is empty" };
  let rows = [];
  try { rows = ((await kv([["MGET", ...ids.map(i => "nb:msg:" + i)]]))[0]) || []; } catch { return { ok: false, sorted: 0 }; }

  const cmds = [];
  let sorted = 0, urgent = 0;
  for (let i = 0; i < rows.length && sorted < cap; i++) {
    if (!rows[i]) continue;
    let m; try { m = typeof rows[i] === "string" ? JSON.parse(rows[i]) : rows[i]; } catch { continue; }
    if (m.sort) continue;                     /* already sorted */
    const t = await triageOne(m);
    if (!t) continue;
    m.sort = t.sort; m.gist = t.gist; m.urgent = t.urgent; m.sortedBy = t.model;
    cmds.push(["SET", "nb:msg:" + ids[i], JSON.stringify(m)]);
    sorted++; if (t.urgent || t.sort === "correction") urgent++;
  }
  if (cmds.length) { try { await kv(cmds); } catch { } }
  return { ok: true, sorted, urgent };
}

/* ---------------------------------------------------------------------------
   the findings the owner reads
--------------------------------------------------------------------------- */
export async function findings(n = 60) {
  if (!kvReady()) return [];
  try {
    const r = (await kv([["LRANGE", K_FIND, "0", String(n)]]))[0] || [];
    return r.map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

export async function clearFinding(id) {
  if (!kvReady() || !id) return { ok: false };
  const all = await findings(300);
  const keep = all.filter(f => f.id !== id);
  try {
    const cmds = [["DEL", K_FIND]];
    for (let i = keep.length - 1; i >= 0; i--) cmds.push(["LPUSH", K_FIND, JSON.stringify(keep[i])]);
    await kv(cmds);
    return { ok: true, removed: all.length - keep.length };
  } catch { return { ok: false }; }
}

export async function lastShift() {
  if (!kvReady()) return null;
  try {
    const r = (await kv([["GET", K_RUN]]))[0];
    return r ? (typeof r === "string" ? JSON.parse(r) : r) : null;
  } catch { return null; }
}

/* ---------------------------------------------------------------------------
   the whole shift, called once a night by /api/warm

   `on` is read from the dials so the owner can switch off any job without a
   redeploy, and every job is wrapped: a job that throws must not take the rest
   of the night down with it.
--------------------------------------------------------------------------- */
export async function runNightShift(host, opts = {}) {
  const out = { at: new Date().toISOString(), jobs: {} };
  const run = async (name, fn) => {
    if (opts.only && opts.only !== name) return;
    const t0 = Date.now();
    try { out.jobs[name] = await fn(); }
    catch (e) { out.jobs[name] = { ok: false, why: String(e && e.message || e).slice(0, 100) }; }
    out.jobs[name].ms = Date.now() - t0;
  };

  if (opts.audit !== 0) await run("audit", () => auditCorpus(host, opts.audit || DEFAULT_AUDIT));
  if (opts.brief !== false) await run("brief", () => dailyBrief(opts.facts || {}));
  if (opts.triage !== false) await run("triage", () => triageInbox());

  if (kvReady()) { try { await kv([["SET", K_RUN, JSON.stringify(out)], ["EXPIRE", K_RUN, "2764800"]]); } catch { } }
  return out;
}
