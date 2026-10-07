// NOOR · the Lantern's decisions: only what needs the owner, in one store.
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS (3 October 2026, LANTERN.md section 3)
//
// The owner is the decision maker; the Lantern does everything else. So
// whatever the house cannot settle on its own reaches him here, and only
// here: one store (nsoul:decisions), at most OPEN_MAX open at once, each a
// card on his Home with a title, one line of why, the goal it serves and
// the buttons he can press. Four producers write to it:
//
//   the daily cycle's report (api/_mind.js): the needs it knows by name
//     (link Telegram, add OpenRouter credit, Google Search Console, a goal
//     behind for seven days, a test's verdict) as structured decisions, and
//     anything else it says needs him as a plain "you" card;
//   the Steward's owner-only findings (new inbox messages, journal replies
//     waiting, a token near expiry), folded in by the same report;
//   the conversation's proposals (api/lantern-agent.js): "approve" cards
//     whose Yes runs the hand with his approval;
//   the weekly reflection's upgrade proposals: "build" cards.
//
// THE RULES
//   one need, one card: every decision carries a stable key, and a second
//     raise of the same key updates the open card in place;
//   a need already decided is not raised again for QUIET_DAYS while its
//     stamp (what it says, its count) is the same; a "No" is remembered by
//     its key for NO_DAYS, whatever the stamp;
//   "Later" hides a card for SNOOZE_DAYS; an open card expires on its own
//     date; decided, expired and resolved cards are archived for
//     ARCHIVE_DAYS;
//   every option names what it does, and does exactly that: run a hand with
//     the owner's approval (api/_hands.js runHand, which still applies the
//     red lines, pause, the caps and the audit), accept or decline an
//     upgrade, record a yes, mark done, open a link (no server effect at
//     all), snooze, or say no.
//
// The open list is one JSON value written only by a compare and set on its
// version (the same idiom the goals use), so a cycle writing its needs and
// the owner pressing a button at the same moment never lose each other.
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import { K, nowIso, dayOf, addDays, newId, store, parse, getJSON, setJSON, casWrite, casUpdate, auditAppend, sayLantern } from "./_soul.js";
import { lineupArgsConcrete } from "./_agent.js";

export const OPEN_MAX = 12;
export const ARCHIVE_DAYS = 30;
export const ARCHIVE_KEEP = 200;
export const NO_DAYS = 30;
export const SNOOZE_DAYS = 3;
export const QUIET_DAYS = 7;
export const EXPIRE_DAYS = 14;
export const KINDS = Object.freeze(["approve", "choose", "you", "build"]);
export const STYLES = Object.freeze(["primary", "plain", "danger"]);
const EFFECTS = ["hand", "upgrade", "done", "open", "snooze", "no", "record"];
/* the console's rooms an "Open" may lead to (the hashes admin2.html already
   answers), and the engine room, which is the old Soul room's hash */
export const ROOM = Object.freeze({
  posts: "/admin2#posts", readers: "/admin2#readers", system: "/admin2#system",
  observatory: "/admin2#observatory", engine: "/admin2#soul", lantern: "/admin2#lantern", night: "/admin2#night"
});
/* and the old console's panes (/admin#giving, 3 October 2026): round nine
   retired that console, so the console reads such a link as its own room
   (/admin#giving opens the Giving room), and the old address redirects */
const HREF_OK = h => /^\/admin2?#[a-z]+$/.test(h) || /^https:\/\/[A-Za-z0-9.-]+(\/[\w./?=&%#-]*)?$/.test(h)
  || /^https:\/\/mail\.google\.com\/mail\/u\/0\/#search\/rfc822msgid:[A-Za-z0-9._%+-]+$/.test(h);   /* mail: a message in Gmail (LANTERN.md section 11) */
const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n || 200);
const realDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
export const hashOf = t => crypto.createHash("sha1").update(String(t || "")).digest("hex").slice(0, 12);
/* a need's words with its numbers taken out, the same reading the Telegram
   memory keeps (api/_mind.js toldHash), so "posting health is 96.5 percent"
   and "97.1 percent" are one need, not two */
export const wordsKey = t => hashOf(String(t || "").toLowerCase().replace(/[0-9.,]+/g, "#").replace(/\s+/g, " ").trim());

/* ---------------------------------------------------------------------------
   1. THE OPTIONS. Each carries `do`, what the server does when it is
      pressed; the Home never sees `do`, only the label, the style and the
      line it asks him to confirm.
--------------------------------------------------------------------------- */
export const opt = {
  yes: (effect, label) => ({ id: "yes", label: label || "Yes", style: "primary", confirm: null, do: effect }),
  no: (label, then) => ({ id: "no", label: label || "No", style: "danger", confirm: "The Lantern will not ask about this again for " + NO_DAYS + " days.", do: { type: "no", ...(then ? { then } : {}) } }),
  later: () => ({ id: "later", label: "Later", style: "plain", confirm: null, do: { type: "snooze", days: SNOOZE_DAYS } }),
  done: label => ({ id: "done", label: label || "Done", style: "primary", confirm: null, do: { type: "done" } }),
  open: label => ({ id: "open", label: label || "Open", style: "plain", confirm: null, do: { type: "open" } }),
  choice: (id, label, effect, style, confirm) => ({ id, label, style: style || "plain", confirm: confirm || null, do: effect })
};

function cleanEffect(e) {
  const t = e && EFFECTS.includes(e.type) ? e.type : null;
  if (!t) return null;
  if (t === "hand") {
    const it = e.intent && typeof e.intent === "object" ? e.intent : null;
    if (!it || !it.action) return null;
    return { type: "hand", intent: { action: str(it.action, 60), args: it.args && typeof it.args === "object" && !Array.isArray(it.args) ? it.args : {},
      why: str(it.why, 600), metric: str(it.metric, 60) || "", expectedEffect: str(it.expectedEffect, 300) || "" } };
  }
  if (t === "upgrade") return { type: "upgrade", id: str(e.id, 60), status: e.status === "declined" ? "declined" : "accepted" };
  if (t === "snooze") return { type: "snooze", days: Math.max(1, Math.min(14, parseInt(e.days, 10) || SNOOZE_DAYS)) };
  if (t === "no") return { type: "no", ...(e.then ? { then: cleanEffect(e.then) } : {}) };
  return { type: t };
}

/* a decision as it is kept: every field checked, every owner-facing word in
   the Lantern's name, the effects whole */
export function normalize(input) {
  const d = input && typeof input === "object" ? input : {};
  const kind = KINDS.includes(d.kind) ? d.kind : null;
  const key = str(d.key, 120);
  const title = sayLantern(str(d.title, 160));
  if (!kind || !key || !title) return { ok: false, error: "a decision needs a kind, a key and a title" };
  const seen = new Set();
  const options = (Array.isArray(d.options) ? d.options : []).map(o => {
    if (!o || typeof o !== "object") return null;
    const id = str(o.id, 30).replace(/[^a-z0-9-]/gi, "").toLowerCase();
    const effect = cleanEffect(o.do);
    if (!id || seen.has(id) || !effect) return null;
    seen.add(id);
    return { id, label: sayLantern(str(o.label, 40)) || id, style: STYLES.includes(o.style) ? o.style : "plain",
      confirm: o.confirm ? sayLantern(str(o.confirm, 200)) : null, do: effect };
  }).filter(Boolean).slice(0, 5);
  if (!options.length) return { ok: false, error: "a decision needs at least one option" };
  const link = d.link && typeof d.link === "object" && HREF_OK(String(d.link.href || "")) ? { href: String(d.link.href), label: sayLantern(str(d.link.label, 60)) || "Open" } : null;
  const steps = (Array.isArray(d.steps) ? d.steps : []).map(s => sayLantern(str(s, 220))).filter(Boolean).slice(0, 6);
  return { ok: true, value: {
    key, stamp: str(d.stamp == null ? "1" : d.stamp, 60), kind, title, why: sayLantern(str(d.why, 400)),
    goal: d.goal ? str(d.goal, 60) : null, impact: d.impact ? sayLantern(str(d.impact, 200)) : null,
    options, link, steps, source: str(d.source || "lantern", 30), sticky: d.sticky !== false,
    ref: d.ref ? str(d.ref, 120) : null, expires: realDate(d.expires) ? d.expires : addDays(dayOf(), EXPIRE_DAYS),
    ...draftOf(d.draft),   /* mission: a letter the card carries (LANTERN.md sections 8 and 10, api/_mission.js) */
    ...letterOf(d.letter)   /* mail: an email waiting for his Send (LANTERN.md section 11.1, api/_mail.js) */
  } };
}
/* mail (LANTERN.md section 11.1): the whole email a card carries, {to,
   toName, subject, text, kind}, its line breaks kept and never passed
   through sayLantern, since it is the letter itself */
function letterOf(v) {
  if (!v || typeof v !== "object") return {};
  const text = String(v.text == null ? "" : v.text).replace(/\r\n?/g, "\n").slice(0, 6000).trim();
  const to = String(v.to == null ? "" : v.to).trim().toLowerCase().slice(0, 200);
  if (!text || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(to)) return {};
  return { letter: { to, toName: str(v.toName, 120), subject: str(v.subject, 200), text, kind: ["outreach", "followup", "reply"].includes(v.kind) ? v.kind : "reply" } };
}
/* mission (LANTERN.md section 8): a draft letter, {title, text}, its line
   breaks kept; never passed through sayLantern, since a letter may name
   "The Journey of the Soul" and mean it */
function draftOf(v) {
  if (!v || typeof v !== "object") return {};
  const text = String(v.text == null ? "" : v.text).replace(/\r\n?/g, "\n").slice(0, 4000).trim();
  return text ? { draft: { title: str(v.title, 160), text } } : {};
}

/* ---------------------------------------------------------------------------
   2. THE STORE: the open list (compare and set), the archive (a list, 30
      days), and the "No" memory (key to the day it is forgotten)
--------------------------------------------------------------------------- */
async function readOpenRaw() {
  const r = await store([["GET", K.decisions], ["GET", K.decisionsVer]]);
  const v = parse(r[0], []);
  return { list: Array.isArray(v) ? v.filter(x => x && x.id && x.key) : [], ver: r[1] == null ? "" : String(r[1]) };
}
export async function readOpen() { return (await readOpenRaw()).list; }
export async function readArchive(limit) {
  const r = await store([["LRANGE", K.decisionsArchive, "0", String(ARCHIVE_KEEP - 1)]]);
  const cutoff = addDays(dayOf(), -ARCHIVE_DAYS);
  return (r[0] || []).map(s => parse(s, null)).filter(a => a && String(a.decidedAt || "").slice(0, 10) >= cutoff).slice(0, limit || ARCHIVE_KEEP);
}
async function archivePush(items) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return;
  try {
    await store([["LPUSH", K.decisionsArchive, ...list.map(a => JSON.stringify(a))], ["LTRIM", K.decisionsArchive, "0", String(ARCHIVE_KEEP - 1)]]);
  } catch { /* the open list already moved on; the archive is a record, never a gate */ }
}
export async function readNo() {
  let v = {};
  try { v = (await getJSON(K.decisionsNo, {})) || {}; } catch { v = {}; }
  const today = dayOf(), out = {};
  for (const [k, until] of Object.entries(v && typeof v === "object" ? v : {})) if (realDate(until) && until >= today) out[k] = until;
  return out;
}
/* written by a compare and set on its own version (6 October 2026, the
   review), so two No answers at the same moment are both remembered */
const K_NO_VER = "nsoul:decisions:no:ver";
async function rememberNo(key) {
  const today = dayOf(), until = addDays(today, NO_DAYS);
  await casUpdate(K.decisionsNo, K_NO_VER, cur => {
    const out = {};
    for (const [k, u] of Object.entries(cur && typeof cur === "object" && !Array.isArray(cur) ? cur : {})) if (realDate(u) && u >= today) out[k] = u;
    out[key] = until;
    return { write: true, value: out, result: true };
  });
}
/* the open list changed only through this: read with its version, change,
   write back only on that version, again on a clash (four tries) */
async function update(fn) {
  for (let i = 0; i < 4; i++) {
    const { list, ver } = await readOpenRaw();
    const out = await fn(list.map(d => ({ ...d })));
    if (!out || !out.write) return out ? out.result : { ok: false, error: "nothing to write" };
    const n = await casWrite(K.decisions, K.decisionsVer, ver, JSON.stringify(out.list));
    if (n != null) { await archivePush(out.archive); return out.result; }
  }
  return { ok: false, error: "the decisions changed while this was being written; try again" };
}
/* an open card past its own date leaves for the archive as expired */
function expire(list, today) {
  const keep = [], gone = [];
  for (const d of list) {
    if (realDate(d.expires) && d.expires < today) gone.push({ ...d, status: "expired", decidedAt: nowIso() });
    else keep.push(d);
  }
  return { list: keep, archived: gone };
}
const CLOSED_BY_OWNER = new Set(["done", "yes", "no", "approved", "declined", "refused"]);

/* ---------------------------------------------------------------------------
   3. RAISING A NEED: upsert (one card a key), sync (a producer's whole set,
      closing its own cards that are no longer true)
--------------------------------------------------------------------------- */
export async function upsert(input) {
  const n = normalize(input);
  if (!n.ok) return n;
  const d = n.value, today = dayOf();
  let no = {}, arch = [];
  try { no = await readNo(); } catch { no = {}; }
  if (no[d.key]) return { ok: false, suppressed: "no", key: d.key, until: no[d.key] };
  try { arch = await readArchive(); } catch { arch = []; }
  const quiet = addDays(today, -QUIET_DAYS);
  const recent = arch.find(a => a.key === d.key && String(a.stamp || "1") === d.stamp && CLOSED_BY_OWNER.has(a.status) && String(a.decidedAt || "").slice(0, 10) >= quiet);
  return update(list => {
    const t = expire(list, today);
    const i = t.list.findIndex(x => x.key === d.key);
    if (i !== -1) {
      const cur = t.list[i];
      /* round four: a card that offers no Later cannot stay snoozed */
      const canSnooze = (d.options || []).some(o => o && o.do && o.do.type === "snooze");
      t.list[i] = { ...cur, ...d, id: cur.id, at: cur.at, status: "open", snoozedUntil: canSnooze ? (cur.snoozedUntil || null) : null, updatedAt: nowIso() };
      return { write: true, list: t.list, archive: t.archived, result: { ok: true, id: cur.id, updated: true } };
    }
    if (recent) return { write: t.archived.length > 0, list: t.list, archive: t.archived, result: { ok: false, suppressed: "recent", key: d.key } };
    const rec = { ...d, id: newId("d"), at: nowIso(), status: "open", snoozedUntil: null };
    const next = [rec, ...t.list];
    const archived = t.archived.slice();
    /* the cap: the oldest open card gives way to the newest need, and is
       archived as overflow (raised again by its producer when still true) */
    while (next.length > OPEN_MAX) archived.push({ ...next.pop(), status: "overflow", decidedAt: nowIso() });
    return { write: true, list: next, archive: archived, result: { ok: true, id: rec.id, created: true } };
  });
}
/* a producer's whole set at once: each raised, and every open card of that
   producer that is not sticky and not raised this time is resolved (the
   inbox was read, the token renewed, Telegram linked). opts.keep names the
   keys whose source could not be read this time: a card is never closed
   because its reader failed, only because the need is gone. */
export async function sync(source, items, opts = {}) {
  const out = { raised: [], suppressed: [], resolved: [] };
  const keys = new Set((opts.keep || []).map(k => str(k, 120)));
  for (const it of items || []) {
    const r = await upsert({ ...it, source });
    if (r && r.ok) { out.raised.push(r.id); keys.add(str(it.key, 120)); }
    else if (r && r.suppressed) { out.suppressed.push(it.key); keys.add(str(it.key, 120)); }
  }
  const res = await update(list => {
    const gone = list.filter(d => d.source === source && !d.sticky && !keys.has(d.key));
    if (!gone.length) return { write: false, result: [] };
    return { write: true, list: list.filter(d => !gone.includes(d)), archive: gone.map(d => ({ ...d, status: "resolved", decidedAt: nowIso() })), result: gone.map(d => d.id) };
  });
  out.resolved = Array.isArray(res) ? res : [];
  return out;
}
/* close one card from outside (an upgrade moved in the engine room, a
   proposal answered through the conversation's own door) */
export async function closeByKey(key, status) {
  return update(list => {
    const d = list.find(x => x.key === key);
    if (!d) return { write: false, result: { ok: false } };
    return { write: true, list: list.filter(x => x !== d), archive: [{ ...d, status: status || "resolved", decidedAt: nowIso() }], result: { ok: true, id: d.id } };
  });
}
/* close the open card a producer made about one thing, found by what it
   refers to (an upgrade moved in the engine room) */
export async function closeByRef(source, ref, status) {
  return update(list => {
    const d = list.find(x => x.source === source && x.ref === String(ref || ""));
    if (!d) return { write: false, result: { ok: false } };
    return { write: true, list: list.filter(x => x !== d), archive: [{ ...d, status: status || "resolved", decidedAt: nowIso() }], result: { ok: true, id: d.id } };
  });
}
export async function findByKey(key) {
  const open = (await readOpen()).find(d => d.key === key);
  if (open) return { open: true, decision: open };
  const a = (await readArchive()).find(d => d.key === key);
  return a ? { open: false, decision: a } : null;
}

/* ---------------------------------------------------------------------------
   4. WHAT THE HOME SHOWS: the contract's own fields, nothing internal
--------------------------------------------------------------------------- */
const KIND_ORDER = { approve: 0, choose: 1, build: 2, you: 3 };
export function viewOne(d) {
  return { id: d.id, kind: d.kind, title: sayLantern(d.title), why: sayLantern(d.why || ""), goal: d.goal || null, impact: d.impact ? sayLantern(d.impact) : null,
    options: (d.options || []).map(o => ({ id: o.id, label: sayLantern(o.label), style: o.style, confirm: o.confirm ? sayLantern(o.confirm) : null })),
    link: d.link ? { href: d.link.href, label: sayLantern(d.link.label) } : null,
    steps: (d.steps || []).map(sayLantern), at: d.at, expires: d.expires || null,
    draft: d.draft && d.draft.text ? { title: d.draft.title || "", text: d.draft.text } : null,   /* mission: section 10 */
    letter: d.letter && d.letter.text ? { to: d.letter.to, toName: d.letter.toName || "", subject: d.letter.subject || "", text: d.letter.text, kind: d.letter.kind } : null };   /* mail: section 11.4 */
}
/* the open cards the owner sees now: not snoozed, not past their date,
   the ones that ask a yes first, then the newest */
export function visible(list, today) {
  const d = today || dayOf();
  return (list || []).filter(x => x && !(x.snoozedUntil && x.snoozedUntil > d) && !(realDate(x.expires) && x.expires < d))
    .sort((a, b) => (KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) || String(b.at || "").localeCompare(String(a.at || "")));
}
export async function forHome() {
  return visible(await readOpen()).map(viewOne);
}

/* ---------------------------------------------------------------------------
   5. DECIDING. Every answer is {ok, message} in plain words; nothing throws
      out of here.
--------------------------------------------------------------------------- */
async function archiveOne(id, status, extra) {
  const d = await update(list => {
    const x = list.find(y => y.id === id);
    if (!x) return { write: false, result: null };
    return { write: true, list: list.filter(y => y !== x), archive: [{ ...x, status, decidedAt: nowIso(), ...(extra || {}) }], result: x };
  });
  /* a conversation's proposal answered on the Home leaves the conversation's
     own list too (nlan:proposals, api/lantern-agent.js), so its older room
     never offers it again */
  if (d && d.source === "conversation" && d.ref) await forgetProposal(d.ref);
  return d;
}
const K_LAN_PROPOSALS = "nlan:proposals";
async function forgetProposal(ref) {
  try {
    const r = await store([["LRANGE", K_LAN_PROPOSALS, "0", "99"]]);
    const raw = r[0] || [];
    const keep = raw.filter(s => { const p = parse(s, null); return !(p && p.id === ref); });
    if (keep.length === raw.length) return;
    const cmds = [["DEL", K_LAN_PROPOSALS]];
    if (keep.length) cmds.push(["RPUSH", K_LAN_PROPOSALS, ...keep.map(String)]);
    await store(cmds);
  } catch { /* the conversation's own door still answers it, by this card */ }
}
async function auditDecision(d, optionId, outcome) {
  try { await auditAppend({ kind: "decision", actor: "owner", summary: "the owner answered \"" + str(d.title, 100) + "\": " + optionId + " (" + outcome + ")", data: { id: d.id, key: d.key, option: optionId, outcome } }); } catch { }
}
export async function decide(id, optionId, opts = {}) {
  let list;
  try { list = (await readOpenRaw()).list; } catch { return { ok: false, code: 503, message: "The decisions could not be read just now, so nothing was done." }; }
  const d = list.find(x => x.id === String(id || ""));
  if (!d) {
    let a = null;
    try { a = (await readArchive()).find(x => x.id === String(id || "")); } catch { a = null; }
    return a ? { ok: false, code: 409, message: "That was already answered (" + a.status + ")." } : { ok: false, code: 404, message: "There is no such decision." };
  }
  /* a card past its own date is put away as expired, never carried out
     (6 October 2026, the review): the Home no longer shows it */
  if (realDate(d.expires) && d.expires < dayOf()) {
    try { await archiveOne(d.id, "expired"); } catch { }
    return { ok: false, code: 410, message: "That card passed its own date (" + d.expires + ") and was put away; nothing was done.", decision: d.id };
  }
  const o = (d.options || []).find(x => x.id === String(optionId || ""));
  if (!o) return { ok: false, code: 400, message: "That is not one of this card's choices." };
  const eff = o.do || { type: "done" };
  const title = sayLantern(d.title);
  try {
    if (eff.type === "open") {
      return { ok: true, message: d.link ? "Nothing changed here; the link is where to act." : "Nothing to open here.", link: d.link || null, decision: d.id };
    }
    if (eff.type === "snooze") {
      const until = addDays(dayOf(), eff.days || SNOOZE_DAYS);
      await update(l => { const x = l.find(y => y.id === d.id); if (!x) return { write: false, result: null }; x.snoozedUntil = until; return { write: true, list: l, result: true }; });
      await auditDecision(d, o.id, "later until " + until);
      return { ok: true, message: "Later. It comes back on " + until + ".", until, decision: d.id };
    }
    if (eff.type === "done") {
      await archiveOne(d.id, "done", { option: o.id });
      await auditDecision(d, o.id, "done");
      return { ok: true, message: "Marked done.", decision: d.id };
    }
    if (eff.type === "record") {
      await archiveOne(d.id, "approved", { option: o.id });
      await auditDecision(d, o.id, "approved, recorded");
      return { ok: true, executed: false, message: "Recorded. Nothing was changed by itself; " + (d.steps && d.steps.length ? "the steps on the card say where to do it." : "it is noted for the Lantern."), decision: d.id };
    }
    if (eff.type === "no") {
      let thenMsg = "";
      if (eff.then && eff.then.type === "upgrade") { const u = await upgradeTo(eff.then.id, "declined"); thenMsg = u.ok ? " The upgrade was declined." : " The upgrade could not be moved: " + u.error; }
      /* mail: a No that also runs its own hand with his approval (Not this
         one on a waiting letter: api/_mail.js mail-decline) */
      if (eff.then && eff.then.type === "hand") {
        const H = await import("./_hands.js");
        const r = await H.runHand(eff.then.intent, { actor: opts.actor || "owner", approval: { owner: true, source: "decision", id: d.id } });
        thenMsg = r.ok ? (r.entry && r.entry.result && r.entry.result.note ? " " + sayLantern(str(r.entry.result.note, 200)) + "." : "") : " " + sayLantern(str(r.error, 200)) + ".";
      }
      await archiveOne(d.id, "no", { option: o.id });
      await rememberNo(d.key);
      await auditDecision(d, o.id, "no");
      return { ok: true, message: "No. The Lantern will not raise this again for " + NO_DAYS + " days." + thenMsg, decision: d.id };
    }
    if (eff.type === "upgrade") {
      const u = await upgradeTo(eff.id, eff.status);
      if (!u.ok) return { ok: false, message: "The upgrade could not be moved: " + sayLantern(u.error || "it refused") + ".", decision: d.id };
      await archiveOne(d.id, eff.status === "declined" ? "declined" : "yes", { option: o.id });
      await auditDecision(d, o.id, "upgrade " + eff.status);
      return { ok: true, message: eff.status === "declined" ? "Declined. It will not be built." : "Accepted. It is in Claude's build queue now.", decision: d.id };
    }
    if (eff.type === "hand") {
      /* claimed once, so two taps never run the hand twice */
      const claimKey = K.once("decide:" + d.id);
      let first = false;
      try { first = (await store([["SET", claimKey, nowIso(), "NX", "EX", "600"]]))[0] === "OK"; } catch { first = false; }
      if (!first) return { ok: false, code: 409, message: "This is already being carried out.", decision: d.id };
      const H = await import("./_hands.js");
      const r = await H.runHand(eff.intent, { actor: opts.actor || "owner", approval: { owner: true, source: "decision", id: d.id } });
      if (r.ok) {
        await archiveOne(d.id, "yes", { option: o.id, actionId: r.id });
        return { ok: true, executed: true, message: "Done: " + title.replace(/\?$/, "") + ".", actionId: r.id, entry: r.entry, decision: d.id };
      }
      const permanent = r.refused === "R3" || r.refused === "unknown";
      if (permanent) await archiveOne(d.id, "refused", { option: o.id, error: str(r.error, 300) });
      else { try { await store([["DEL", claimKey]]); } catch { } }
      return { ok: false, executed: false, refused: r.refused || null, message: (permanent ? "Refused, and closed: " : "Not done: ") + sayLantern(str(r.error, 300)) + (permanent ? "" : ". The card stays open."), decision: d.id };
    }
  } catch (e) {
    return { ok: false, message: "That could not be done: " + sayLantern(str(e && e.message || e, 200)) + ".", decision: d.id };
  }
  return { ok: false, message: "That choice does nothing the server knows.", decision: d.id };
}
async function upgradeTo(id, status) {
  try {
    const E = await import("./_evolve.js");
    return await E.setUpgradeStatus(id, status, "owner");
  } catch (e) { return { ok: false, error: str(e && e.message || e, 160) }; }
}

/* ---------------------------------------------------------------------------
   6. THE PRODUCERS' CARDS
--------------------------------------------------------------------------- */
const SLOT_WORD = { reelA: "morning reel", reelC: "noon reel", reelD: "afternoon reel", reelB: "evening reel", reelF: "late reel", reelE: "night reel" };
export const slotWord = s => SLOT_WORD[s] || "reel";
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function dayWord(date, today) {
  const t = today || dayOf();
  if (date === t) return "today";
  if (date === addDays(t, 1)) return "tomorrow";
  if (date === addDays(t, -1)) return "yesterday";
  if (!realDate(date)) return String(date || "");
  return Number(date.slice(8, 10)) + " " + MONTH[Number(date.slice(5, 7)) - 1];
}
/* "today", "tomorrow", or "on 5 October": a day as a sentence says it */
export function onDay(date, today) {
  const w = dayWord(date, today);
  return w === "today" || w === "tomorrow" || w === "yesterday" ? w : "on " + w;
}

/* the conversation's proposal (api/_agent.js buildProposal, with the id
   api/lantern-agent.js gives it): an "approve" card. A concrete line-up
   change or a registered test runs its hand on Yes; a vague one is
   recorded, with the room to do it in. */
export function fromProposal(p) {
  const a = (p && p.args && typeof p.args === "object") ? p.args : {};
  const req = String((p && (p.requested || p.type)) || "");
  const why = str(p && (p.why || p.evidence || a.suggestion), 400) || "Proposed in the conversation.";
  const base = { kind: "approve", key: "proposal:" + str(p && p.id, 80), stamp: "1", source: "conversation", sticky: true, ref: str(p && p.id, 80), why };
  if (req === "lineup-change" && lineupArgsConcrete(a)) {
    const skip = a.action === "skip";
    const intent = { action: skip ? "lineup-skip" : "lineup-swap", args: skip ? { date: a.date, slot: a.slot } : { date: a.date, slot: a.slot, id: a.id }, why, metric: "northStar" };
    return { ...base, title: (skip ? "Skip the " + slotWord(a.slot) : "Swap the " + slotWord(a.slot) + " for " + a.id) + " " + onDay(a.date) + "?",
      goal: "g-reach", options: [opt.yes({ type: "hand", intent }), opt.later(), opt.no()],
      link: { href: ROOM.posts, label: "See it in Posts" }, steps: [], expires: addDays(a.date, 1) };
  }
  if (req === "experiment-plan" && /^(verse-length|reciter-pair)$/.test(String(a.id || ""))) {
    const start = realDate(a.start) ? a.start : addDays(dayOf(), 1);
    const intent = { action: "experiment-plan", args: { id: a.id, start, ...(a.args && typeof a.args === "object" ? { args: a.args } : {}) }, why, metric: "learning.experiment" };
    return { ...base, title: "Plan the " + String(a.id).replace(/-/g, " ") + " test, starting " + dayWord(start) + "?", goal: "g-test",
      options: [opt.yes({ type: "hand", intent }), opt.later(), opt.no()], link: { href: ROOM.observatory, label: "Open the Observatory" }, steps: [] };
  }
  if (req === "refresh-insights" || req === "reconcile-teach") {
    const intent = req === "refresh-insights" ? { action: "insights-refresh", args: {}, why } : { action: "reconcile-teach", args: { network: str(a.network, 20) }, why };
    return { ...base, title: req === "refresh-insights" ? "Read the networks' numbers again now?" : "Teach the duplicate guard what " + (str(a.network, 20) || "the network") + " already holds?",
      options: [opt.yes({ type: "hand", intent }), opt.later(), opt.no()], link: null, steps: [] };
  }
  const where = req === "experiment-plan" ? { href: ROOM.observatory, label: "Open the Observatory" } : { href: ROOM.posts, label: "Open Posts" };
  const steps = req === "experiment-plan" ? ["Open the Observatory", "Plan the test from its experiment card"]
    : req === "lineup-change" ? ["Open Posts", "Choose the slot and press Change"] : [];
  return { ...base, title: req === "experiment-plan" ? "Start a test, as the conversation suggested?" : req === "lineup-change" ? "Change a reel in the line-up, as the conversation suggested?" : "Act on what the conversation suggested?",
    options: [opt.yes({ type: "record" }), opt.later(), opt.no()], link: where, steps };
}

/* a weekly upgrade proposal: "Build this?". Keyed by its title's words, so
   the same upgrade proposed again another week is one card (its Yes takes
   the newest), and a "No" holds against it for 30 days. */
export function fromUpgrade(u, goalOf) {
  const goal = typeof goalOf === "function" ? goalOf(u && u.metric) : null;
  return { kind: "build", key: "upgrade:" + wordsKey(u && u.title), stamp: "1", source: "upgrade", sticky: true, ref: str(u && u.id, 60),
    title: "Build this? " + str(u && u.title, 140), why: str(u && u.why, 400) || "Proposed by the weekly reflection.", goal, impact: str(u && u.expectedEffect, 200) || null,
    options: [opt.choice("build", "Build it", { type: "upgrade", id: u && u.id, status: "accepted" }, "primary"), opt.later(), opt.no("No", { type: "upgrade", id: u && u.id, status: "declined" })],
    link: { href: ROOM.engine, label: "Read the spec" }, steps: [], expires: addDays(dayOf(), 30) };
}

/* the cycle's report, read for the needs it knows by name; anything else it
   says needs the owner becomes a plain "you" card with Done and Later.
   ctx: {needsYou[], drift[], goals[], telegram:{linked}, noCredit, gsc,
   verdict:{id, start, verdict, sentence}, spend:{usd, capUsd}} */
export function fromReport(ctx) {
  const c = ctx || {};
  const out = [];
  const goalTitle = id => { const g = (c.goals || []).find(x => x && x.id === id); return g ? str(g.outcome, 120).replace(/[.\s]+$/, "") : "a goal"; };
  /* round four (7 October 2026): the card stays until the link is made: no
     Done and no Later to put it away, only the way to the link, and it says
     why (the stamp moved to 2, so an old card he put away comes back) */
  if (c.telegram && c.telegram.linked === false) {
    out.push({ kind: "you", key: "tg-link", stamp: "2", sticky: false, title: "Link Telegram, so the Lantern can reach you when something is urgent",
      why: "So the Lantern can reach you when something is urgent: someone at risk, a complaint, the press, money, a place that wants to work with you, posting down, the mailbox locked out. Everything else waits for one message in the evening. It cannot write to you until the link is made once.",
      options: [opt.open("Link Telegram")], link: { href: ROOM.engine, label: "Open the engine room" },
      steps: ["Open the engine room and press Link Telegram", "Send the code it shows to the bot in Telegram", "Press Check to finish the link"] });
  }
  if (c.noCredit) {
    out.push({ kind: "you", key: "openrouter-credit", stamp: str(c.noCredit, 10), sticky: true, title: "Add credit to OpenRouter",
      why: "OpenRouter answered that the account holds no credit, so the Lantern's deep thinking runs on free models until it is topped up. The monthly cap stays 10 dollars.",
      options: [opt.open(), opt.done(), opt.later(), opt.no()], link: { href: "https://openrouter.ai/settings/credits", label: "Open OpenRouter" },
      steps: ["Open OpenRouter's credits page", "Add a small amount of credit", "Nothing else: the Lantern sees it on its next paid call"] });
  }
  if (c.gsc) {
    out.push({ kind: "you", key: "gsc", stamp: "1", sticky: true, expires: addDays(dayOf(), 60), title: "Give Google Search Console access, once",
      why: "Google's own search numbers (queries, clicks, positions) can only be read with your consent; until then the Lantern reads search readiness from the pages themselves.",
      options: [opt.open(), opt.done(), opt.later(), opt.no()], link: { href: "https://search.google.com/search-console", label: "Open Search Console" },
      steps: ["Add the site as a property in Search Console", "Tell Claude in a working session, so the reader can be built"] });
  }
  for (const d of (c.drift || [])) {
    if (!d || !d.tellOwner) continue;
    const v = x => (SHARE_METRICS.has(d.metric) ? Math.round(x * 1000) / 10 + " percent" : String(x));
    const proj = typeof d.projected === "number" && typeof d.target === "number" ? "On its line it reaches " + v(d.projected) + " against a target of " + v(d.target) + (d.due ? " by " + d.due : "") + ". " : "";
    out.push({ kind: "choose", key: "drift:" + str(d.id, 60), stamp: String(d.streak || 0), sticky: true, goal: d.id,
      title: "\"" + goalTitle(d.id) + "\" has been behind for " + d.streak + " days",
      why: proj + "The Lantern is answering it in its plan every day; the goal itself is yours to keep or change.",
      /* 2026-10-03: "Change the goal" is the card's Open, so the console
         draws it as the link to the goals in the engine room */
      options: [opt.choice("keep", "Keep the goal", { type: "done" }, "primary"), opt.open("Change the goal"), opt.later()],
      link: { href: ROOM.engine, label: "Open the goals" }, steps: [] });
  }
  if (c.verdict && c.verdict.id && c.verdict.verdict) {
    const v = c.verdict;
    const sentence = str(v.sentence, 300) || ("The " + String(v.id).replace(/-/g, " ") + " test reached a verdict.");
    out.push({ kind: "choose", key: "verdict:" + str(v.id, 40) + ":" + str(v.start, 10), stamp: "1", sticky: true, goal: "g-test",
      title: "The " + String(v.id).replace(/-/g, " ") + " test has a verdict", why: sentence,
      options: [opt.choice("lesson", "Make it a lesson", { type: "hand", intent: { action: "lesson-propose", args: { text: sentence, why: "the owner chose to keep the test's verdict" }, why: "the owner chose to keep the test's verdict" } }, "primary"),
        opt.open("See the test"), opt.later(), opt.no()],
      link: { href: ROOM.observatory, label: "Open the Observatory" }, steps: [] });
  }
  /* everything else the report says needs him, in its own words; the needs
     named above (and the upgrades, which come as their own cards) are not
     said twice */
  const known = [/Search Console/i, /behind its line/i, /upgrade proposal/i, /Telegram/i];
  for (const n of (c.needsYou || [])) {
    const text = str(n, 400);
    if (!text || known.some(rx => rx.test(text))) continue;
    const first = text.split(/;\s+|\.\s+/)[0];
    /* the first clause is the title; the rest, if any, is the why, so the
       card never says the same thing twice */
    const rest = text.slice(first.length).replace(/^[;.\s]+/, "").trim();
    out.push({ kind: "you", key: "need:" + wordsKey(text), stamp: "1", sticky: true, title: cap1(str(first, 150)),
      why: rest ? cap1(rest).replace(/[;.\s]*$/, ".") : "The morning's cycle found this, and the Lantern cannot settle it on its own.",
      options: [opt.done(), opt.later()], link: null, steps: [] });
  }
  return out;
}
const cap1 = s => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
/* the metrics read as a share of one, said to the owner as a percent */
const SHARE_METRICS = new Set(["site.searchShare", "attention.watchedMedian", "output.health"]);

/* the Steward's owner-only findings: the inbox, the journal's replies
   waiting, and a token near expiry. Not sticky: when the inbox is read or
   the token renewed, the card closes itself. */
export function fromSteward(fold) {
  const f = fold || {};
  const out = [];
  const n = v => (typeof v === "number" && isFinite(v) ? v : 0);
  if (n(f.inbox) > 0) {
    out.push({ kind: "you", key: "inbox", stamp: String(f.inbox), sticky: false,
      title: f.inbox === 1 ? "1 new message in the inbox" : f.inbox + " new messages in the inbox",
      why: "Readers wrote through the site's message door; only you can answer them.",
      options: [opt.open("Open the inbox"), opt.done(), opt.later()], link: { href: ROOM.readers, label: "Open the inbox" }, steps: [] });
  }
  if (n(f.journal) > 0) {
    out.push({ kind: "you", key: "journal", stamp: String(f.journal), sticky: false,
      title: f.journal === 1 ? "1 journal reply waits to be read" : f.journal + " journal replies wait to be read",
      why: "A reply goes on the journal's wall only once you release it.",
      options: [opt.open("Read them"), opt.done(), opt.later()], link: { href: ROOM.readers, label: "Read the replies" }, steps: [] });
  }
  for (const fd of (f.findings || [])) {
    if (!fd || !fd.id) continue;
    if (fd.id === "token-ig" || fd.id === "token-fb") {
      const ev = fd.evidence || {};
      const name = ev.network || (fd.id === "token-ig" ? "Instagram" : "Facebook");
      out.push({ kind: "you", key: fd.id, stamp: String(fd.level || "watch"), sticky: false, title: sayLantern(str(fd.title, 150)),
        why: sayLantern(str(fd.say, 400)), options: [opt.open("Open the token clock"), opt.done(), opt.later()],
        link: { href: ROOM.posts, label: "Open the token clock" },
        steps: ["Make a new " + name + " token in Meta's own tools", "Paste it into Vercel and redeploy", "Press " + name + " renewed on the token clock in Posts"] });
    } else if (fd.id === "token-threads") {
      out.push({ kind: "you", key: fd.id, stamp: "1", sticky: false, title: sayLantern(str(fd.title, 150)), why: sayLantern(str(fd.say, 400)),
        options: [opt.open("Open System"), opt.done(), opt.later()], link: { href: ROOM.system, label: "Open System" },
        steps: ["In this browser, open the Threads renewal page once you mean to", "It shows a fresh token once; paste it into Vercel and redeploy"] });
    } else if (fd.id === "insights-permission") {
      out.push({ kind: "you", key: fd.id, stamp: "1", sticky: false, title: sayLantern(str(fd.title, 150)), why: sayLantern(str(fd.say, 400)),
        options: [opt.open("Open Readers"), opt.done(), opt.later()], link: { href: ROOM.readers, label: "Open Readers" }, steps: [] });
    }
  }
  return out;
}

/* an owner idea he said Go to: a "you" card with its steps */
export function fromIdea(idea) {
  const i = idea || {};
  return { kind: "you", key: "idea:" + str(i.id, 60), stamp: "1", sticky: true, title: str(i.title, 150), why: str(i.why, 400), impact: str(i.impact, 200) || null,
    goal: i.goal || null, options: [opt.done(), opt.later()], link: i.link && HREF_OK(String(i.link.href || "")) ? i.link : null,
    steps: Array.isArray(i.steps) && i.steps.length ? i.steps : ["Do what the idea says, when it suits you", "Press Done here when it is done"] };
}
