/* NOOR · the owner's voice: what is urgent now, everything else at 22:00
   ===========================================================================
   Round four, 7 October 2026. The owner: "I need the lantern to communicate
   with me on telegram for important or urgent things." So the Lantern's
   private line (api/_telegram.js notifyOwner, which keeps its own cap of six
   messages a UTC day and fails closed) now speaks in two ways.

   AT ONCE, for what cannot wait (URGENT below): someone in distress; a
   security, account or billing notice; a complaint; the press; a question
   of money; a place that wants to work together or to meet; posting down or
   a severe anomaly; the paid budget near its cap; the mailbox unable to log
   in; letters waiting for his Send (at most once in six hours). Each is said
   once (a key in the store, a day for most, six hours for the letters, one
   thread for distress), and the next of the same kind that day waits for the
   evening instead.

   ONCE IN THE EVENING, at 22:00 UTC (the first tick after it), everything
   else in one message: what the morning's cycle found that needs him (each
   need told once a week, the memory api/_mind.js kept and now keeps here),
   Monday's weekly summary, the mailbox's other handovers by kind, and any
   urgent message the day's cap stopped. One slot of the six is always left
   for something urgent after the digest: a digest that would take the last
   one waits for the next evening, carried whole.

   WHAT NO MESSAGE EVER CARRIES. An email's body, its subject, a sender's
   name or address, a phone number or anything about a person: only what it
   is, and "Open Home". Every text here is the house's own fixed words and
   its own numbers, passed through the router's scrubber before it leaves
   (a shape like an address or a token is redacted, a journal marker refused).

   ROUND FIVE, 7 October 2026 (the models review). D2: a Telegram outage no
   longer spends the day's six (api/_telegram.js gives back the slot of a
   message that did not go), and what did not get through is asked again at
   a measured pace, never every tick: its mark stays thirty minutes
   (RETRY_S), and an urgent message waits in the retry list, sent again at
   most once in thirty minutes and named in the evening if it never went; an
   evening message that met a fault is tried again thirty minutes on. D9: a
   need is remembered as told only when its words were in a message that
   went, so a carried Monday no longer swallows Tuesday's needs.
--------------------------------------------------------------------------- */
import crypto from "node:crypto";
import { K, seams, nowMs, nowIso, dayOf, addDays, store, parse, sayLantern } from "./_soul.js";
import { scrub } from "./_llm.js";

export const DIGEST_HOUR_UTC = 22;
export const LETTERS_EVERY_S = 6 * 3600;
export const TOLD_DAYS = 7;
export const RETRY_S = 30 * 60;   /* round five (D2): what did not get through is asked again at most this often */
const RETRY_KEEP = 20;
const DAY_S = 26 * 3600;
const LOG_KEEP = 40;
export const VK = Object.freeze({
  said: (kind, ref) => "nsoul:voice:said:" + kind + ":" + ref,
  digest: day => "nsoul:voice:digest:" + day,
  digestSent: day => "nsoul:voice:digest:sent:" + day,
  carry: "nsoul:voice:carry",
  log: "nsoul:voice:log",
  cardDay: day => "nsoul:voice:card:" + day,
  retry: "nsoul:voice:retry",           /* round five: urgent messages that did not get through */
  retryPace: "nsoul:voice:retry:pace"   /* round five: one try of them in RETRY_S */
});
const isRetryMark = v => /^retry\b/.test(String(v || ""));
const hashOf = t => crypto.createHash("sha1").update(String(t || "")).digest("hex").slice(0, 16);
const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n || 200);
/* a number or a short house phrase may ride along; a detail with anything
   the router's scrubber would redact (an address, a phone, a token) or a
   journal marker is dropped whole, and a name in quotes becomes "a goal" */
const detailOf = d => {
  const raw = str(d, 160).replace(/"[^"]*"/g, "a goal");
  const s = scrub(raw);
  if (!s.ok || s.text !== raw) return "";
  return raw.replace(/[.;:\s]+$/, "");
};
const plural = (n, one, many) => (n === 1 ? "1 " + one : n + " " + many);

/* ---------------------------------------------------------------------------
   1. WHAT IS URGENT, in the house's own words
--------------------------------------------------------------------------- */
export const URGENT = Object.freeze({
  distress: { word: "someone who wrote to the mailbox may be at risk", text: () => "NOOR Lantern: someone who wrote to the mailbox may be at risk. Please open Home today." },
  security: { word: "a security, account or billing notice", text: () => "NOOR Lantern: a security, account or billing notice came to the mailbox. Open Home." },
  complaint: { word: "a complaint", text: () => "NOOR Lantern: a complaint came to the mailbox. Open Home." },
  press: { word: "the press wrote to the house", text: () => "NOOR Lantern: the press wrote to the house. Open Home." },
  money: { word: "a message about money", text: () => "NOOR Lantern: a message about money needs you. Open Home." },
  partner: { word: "a place that wants to work together or to meet", text: () => "NOOR Lantern: a place would like to work together, or to meet. Open Home." },
  posting: { word: "posting is down", text: o => "NOOR Lantern: posting is down" + (detailOf(o.detail) ? " (" + detailOf(o.detail) + ")" : "") + ". Open Home." },
  anomaly: { word: "a severe anomaly in the numbers", text: o => "NOOR Lantern: a severe anomaly in today's numbers" + (detailOf(o.detail) ? ": " + detailOf(o.detail) : "") + ". Open Home." },
  budget: { word: "the paid budget is near its cap", text: o => "NOOR Lantern: the paid budget is near its cap" + (detailOf(o.detail) ? " (" + detailOf(o.detail) + ")" : "") + ". Open Home." },
  mailbox: { word: "the mailbox could not log in", text: () => "NOOR Lantern: the mailbox could not log in to Gmail, so nothing is read or sent until it can. Open Home." },
  letters: { word: "letters wait for your Send", text: o => "NOOR Lantern: " + plural(Math.max(1, Number(o.n) || 1), "letter waits", "letters wait") + " for your Send. Open Home." },
  /* merge, 7 October: the morning when no model could answer (api/_mind.js asks for it by this name) */
  models: { word: "no model could answer this morning", text: o => "NOOR Lantern: no model could answer this morning" + (detailOf(o.detail) ? " (" + detailOf(o.detail) + ")" : "") + ", so the Lantern only kept its own standing work. Open Home." }
});
/* the mailbox's kinds that are urgent, and the rest, said by kind alone */
/* round six (7 October 2026): a security or account notice is no longer the
   owner's at all (api/_mail.js files it quietly), so it never reaches his phone */
export const MAIL_URGENT = Object.freeze({ distress: "distress", complaint: "complaint", press: "press", money: "money", partnership: "partner", meeting: "partner" });
const MAIL_WORD = { personal: "a personal message", legal: "a legal matter", correction: "a correction", long: "a long conversation", held: "a reply the Lantern would not send on its own",
  needs: "a message that needs you", unread: "a message the Lantern could not read", question: "a question", feedback: "feedback", thanks: "thanks", "outreach-answer": "an answer from a place" };

/* ---------------------------------------------------------------------------
   2. THE LINE ITSELF: the soul's seam in a test, Telegram otherwise
--------------------------------------------------------------------------- */
async function line(text) {
  const s = scrub(sayLantern(text));
  if (!s.ok) return { ok: false, reason: "the message was refused by the scrubber" };
  try {
    if (typeof seams.notify === "function") { const r = await seams.notify(s.text); return r && typeof r === "object" ? { ok: r.ok !== false, reason: r.reason || null } : { ok: true }; }
    const T = await import("./_telegram.js");
    if (typeof T.notifyOwner !== "function") return { ok: false, reason: "the private Telegram line is not built on this deployment" };
    const r = await T.notifyOwner(s.text);
    return r && typeof r === "object" ? { ok: r.ok !== false, reason: r.reason || null } : { ok: true };
  } catch (e) { return { ok: false, reason: str(e && e.message || e, 120) }; }
}
async function log(kind, ok, why) {
  try { await store([["LPUSH", VK.log, JSON.stringify({ at: nowIso(), kind: str(kind, 30), sent: !!ok, why: ok ? null : str(why, 120) })], ["LTRIM", VK.log, "0", String(LOG_KEEP - 1)]]); } catch { }
}
export async function voiceLog(limit) {
  try { return ((await store([["LRANGE", VK.log, "0", String(Math.max(0, (limit || 10) - 1))]]))[0] || []).map(x => parse(x, null)).filter(Boolean); } catch { return []; }
}

/* ---------------------------------------------------------------------------
   3. URGENT: said at once, once
--------------------------------------------------------------------------- */
/* o: {ref (a thread for distress), n (letters), detail (house numbers only)}.
   {ok, sent, deduped?, queued?, reason?}; never throws */
export async function urgent(kind, o = {}) {
  const def = URGENT[kind];
  if (!def) return { ok: false, sent: false, reason: "not an urgent kind" };
  const ref = kind === "distress" && o.ref ? hashOf(o.ref) : kind === "letters" ? "window" : dayOf();
  const ttl = kind === "letters" ? LETTERS_EVERY_S : kind === "distress" ? 7 * 86400 : DAY_S;
  let first = false;
  try { first = (await store([["SET", VK.said(kind, ref), nowIso(), "NX", "EX", String(ttl)]]))[0] === "OK"; }
  catch { return { ok: false, sent: false, reason: "the store could not keep the mark, so nothing was sent" }; }
  if (!first) {
    /* told already today: the evening says how many more came */
    if (kind !== "letters") await digestAdd({ kind: "again", what: kind });
    return { ok: true, sent: false, deduped: true };
  }
  const r = await line(def.text(o));
  await log(kind, r.ok, r.reason);
  if (!r.ok && /daily limit/i.test(String(r.reason || ""))) { await digestAdd({ kind: "missed", what: kind }); return { ok: false, sent: false, queued: true, reason: r.reason }; }
  /* a passing fault (Telegram busy, the network). Round five (D2): paced,
     never every tick. The mark stays RETRY_S (the letters ask again after
     it, no sooner), and any other kind waits in the retry list: voiceTick
     sends it again at most once in RETRY_S, and the evening names it if it
     never went */
  if (!r.ok && !NO_LINE.test(String(r.reason || ""))) {
    try { await store([["SET", VK.said(kind, ref), "retry " + nowIso(), "EX", String(RETRY_S)]]); } catch { }
    if (kind !== "letters") await retryAdd(kind, o, ref);
    return { ok: false, sent: false, queued: kind !== "letters", reason: r.reason };
  }
  return { ok: r.ok, sent: r.ok, reason: r.ok ? null : r.reason };
}
/* round five (D2): the urgent messages that did not get through, the house's
   own words and numbers only (the kind, and its ref and detail) */
async function retryAdd(kind, o, ref) {
  const it = { at: nowIso(), kind, ref: String(ref || ""), o: { ...(o && o.n != null ? { n: Number(o.n) || 1 } : {}), ...(o && o.detail ? { detail: str(o.detail, 160) } : {}) } };
  try { await store([["RPUSH", VK.retry, JSON.stringify(it)], ["LTRIM", VK.retry, String(-RETRY_KEEP), "-1"], ["EXPIRE", VK.retry, String(2 * 86400)]]); } catch { }
}
async function retryItems() {
  let raw = [];
  try { raw = (await store([["LRANGE", VK.retry, "0", "-1"]]))[0] || []; } catch { raw = []; }
  return { n: raw.length, items: raw.map(x => parse(x, null)).filter(x => x && URGENT[x.kind]) };
}
/* the list's first n are dealt with; what waits still goes back on its end */
async function retryKeep(n, keep) {
  const cmds = [["LTRIM", VK.retry, String(n), "-1"]];
  if (keep.length) cmds.push(["RPUSH", VK.retry, ...keep.map(x => JSON.stringify(x))], ["EXPIRE", VK.retry, String(2 * 86400)]);
  try { await store(cmds); } catch { }
}
/* at most once in RETRY_S: each waiting message tried once more, the same
   one only once; the first that meets a fault again stops the round */
export async function retryTick() {
  let first = false;
  try { first = (await store([["SET", VK.retryPace, nowIso(), "NX", "EX", String(RETRY_S)]]))[0] === "OK"; } catch { return { ok: false, tried: 0 }; }
  if (!first) return { ok: true, paced: true, tried: 0 };
  const { n, items } = await retryItems();
  const keep = [], done = new Set();
  let tried = 0, sent = 0, stopped = false;
  for (const it of items) {
    const key = it.kind + ":" + it.ref;
    if (done.has(key)) continue;
    if (stopped) { keep.push(it); done.add(key); continue; }
    tried++;
    const r = await line(URGENT[it.kind].text(it.o || {}));
    await log(it.kind, r.ok, r.reason);
    done.add(key);
    if (r.ok) {
      sent++;
      const ttl = it.kind === "distress" ? 7 * 86400 : DAY_S;
      try { await store([["SET", VK.said(it.kind, it.ref), nowIso(), "EX", String(ttl)]]); } catch { }
      continue;
    }
    if (NO_LINE.test(String(r.reason || ""))) continue;   /* no line to say it on: Home has it */
    keep.push(it); stopped = true;                          /* still down, or the day's six spent */
  }
  await retryKeep(n, keep);
  return { ok: true, tried, sent, waiting: keep.length };
}
/* a mail kind handed to the owner: urgent when it is one of MAIL_URGENT,
   else a line for the evening, by its kind alone */
export async function mailHanded(kind, ref) {
  const u = MAIL_URGENT[kind];
  if (u) return urgent(u, { ref });
  await digestAdd({ kind: "mail", what: MAIL_WORD[kind] ? kind : "needs" });
  return { ok: true, sent: false, queued: true };
}

/* ---------------------------------------------------------------------------
   4. THE TOLD MEMORY (moved here from api/_mind.js, unchanged): a need is
      told once a week, remembered by a hash of its words with the numbers
      taken out, so a figure that moved is still the same need
--------------------------------------------------------------------------- */
export const toldHash = t => crypto.createHash("sha1").update(String(t || "").toLowerCase().replace(/[0-9.,]+/g, "#").replace(/\s+/g, " ").trim()).digest("hex").slice(0, 16);
export async function newToOwner(items) {
  const list = (items || []).map(String).filter(Boolean);
  if (!list.length) return [];
  let told = {};
  try { const r = await store([["HGETALL", K.told]]); const a = r[0] || []; for (let i = 0; i + 1 < a.length; i += 2) told[a[i]] = a[i + 1]; }
  catch { return list; }
  const cutoff = addDays(dayOf(), -TOLD_DAYS);
  return list.filter(t => { const d = told[toldHash(t)]; return !d || d < cutoff; });
}
export async function rememberTold(items) {
  const list = (items || []).map(String).filter(Boolean);
  if (!list.length) return;
  const d = dayOf();
  try { await store([["HSET", K.told, ...list.flatMap(t => [toldHash(t), d])], ["EXPIRE", K.told, String(30 * 86400)]]); } catch { }
}

/* ---------------------------------------------------------------------------
   5. THE EVENING DIGEST
--------------------------------------------------------------------------- */
/* item: {kind: "cycle"|"weekly"|"mail"|"again"|"missed"|"fault", text?, told?, what?} */
export async function digestAdd(item) {
  const it = item && typeof item === "object" ? item : {};
  const rec = { at: nowIso(), kind: str(it.kind, 20), ...(it.text ? { text: String(it.text).slice(0, 1400) } : {}), ...(it.what ? { what: str(it.what, 40) } : {}),
    ...(Array.isArray(it.told) ? { told: it.told.map(t => String(t).slice(0, 400)).slice(0, 20) } : {}) };
  /* once this evening's digest has gone, what comes after waits for
     tomorrow's (round five: an evening waiting to be tried again has not gone) */
  const day = dayOf();
  let k = VK.digest(day);
  try { const v = (await store([["GET", VK.digestSent(day)]]))[0]; if (v && !isRetryMark(v)) k = VK.digest(addDays(day, 1)); } catch { }
  try { await store([["RPUSH", k, JSON.stringify(rec)], ["LTRIM", k, "-80", "-1"], ["EXPIRE", k, String(3 * 86400)]]); return { ok: true }; }
  catch { return { ok: false }; }
}
async function digestItems(day) {
  const r = await store([["LRANGE", VK.digest(day), "0", "-1"], ["GET", VK.carry]]);
  const items = (r[0] || []).map(x => parse(x, null)).filter(Boolean);
  const carried = parse(r[1], null);
  return { items: (carried && Array.isArray(carried.items) ? carried.items : []).concat(items), carried: !!carried };
}
const countBy = xs => { const m = new Map(); for (const x of xs) m.set(x, (m.get(x) || 0) + 1); return m; };
export function digestText(items, date, carried, faulted) {
  return digestCompose(items, date, carried, faulted).text;
}
/* round five (D9): {text, told}: told holds only the needs whose words are
   in the text, so a need cut short, dropped with an older morning, or never
   in the morning's three is not remembered as said */
const said = t => sayLantern(String(t == null ? "" : t)).toLowerCase().replace(/\s+/g, " ").replace(/[.;,:\s]+$/, "").trim();
export function digestCompose(items, date, carried, faulted) {
  const list = Array.isArray(items) ? items : [];
  const wIdx = list.map((x, i) => (x && x.kind === "weekly" && x.text ? i : -1)).filter(i => i >= 0).pop();
  const weekly = wIdx == null ? null : list[wIdx];
  const cycles = list.map((x, i) => ({ x, i })).filter(c => c.x && c.x.kind === "cycle" && c.x.text);
  const lastCycle = cycles.length ? cycles[cycles.length - 1] : null;
  /* the morning's own message leads when there is one (Monday's weekly
     summary first of all); else the evening opens on its own. Round five
     (D9): a morning that came after the weekly (a Monday carried into
     Tuesday) is said after it, never dropped */
  const leads = weekly ? [weekly].concat(lastCycle && lastCycle.i > wIdx ? [lastCycle.x] : []) : (lastCycle ? [lastCycle.x] : []);
  const lead = leads.length ? leads.map(x => x.text).join(" ") : null;
  const parts = [];
  const mail = items.filter(i => i.kind === "mail").map(i => MAIL_WORD[i.what] || MAIL_WORD.needs);
  if (mail.length) {
    const c = [...countBy(mail)].map(([w, n]) => (n > 1 ? n + " times " + w : w));
    parts.push("The mailbox handed you " + plural(mail.length, "message", "messages") + (carried ? " since the last evening's message: " : " today: ") + (c.length <= 1 ? c[0] : c.slice(0, -1).join(", ") + " and " + c[c.length - 1]) + ".");
  }
  const again = items.filter(i => i.kind === "again").map(i => i.what);
  if (again.length) {
    const c = [...countBy(again)].map(([k, n]) => n + " more of " + ((URGENT[k] && URGENT[k].word) || k));
    parts.push("Since the first word today: " + c.join("; ") + ".");
  }
  const missed = items.filter(i => i.kind === "missed").map(i => (URGENT[i.what] && URGENT[i.what].word) || i.what);
  if (missed.length) parts.push("Not sent at the time, the day's messages were spent: " + [...new Set(missed)].join("; ") + ".");
  /* round five (D2): what never got through, from the retry list (and a
     "fault" item an older version left in the day's list) */
  const faults = list.filter(i => i.kind === "fault").map(i => i.what).concat(Array.isArray(faulted) ? faulted : [])
    .map(k => (URGENT[k] && URGENT[k].word) || k).filter(Boolean);
  if (faults.length) parts.push("Not sent at the time, Telegram did not answer: " + [...new Set(faults)].join("; ") + ".");
  if (!lead && !parts.length) return { text: null, told: [] };
  const head = lead || "NOOR Lantern, the evening of " + date + ".";
  const body = [head].concat(parts).join(" ");
  const max = weekly ? (leads.length > 1 ? 2100 : 1400) : 700;
  const end = " Open Home.";
  const text = (body.length + end.length > max ? body.slice(0, max - end.length - 3).replace(/\s+\S*$/, "") + "..." : body) + (/Home has the rest\.$/.test(body) ? "" : end);
  const in_ = said(text);
  const told = [];
  for (const x of leads) for (const t of (Array.isArray(x.told) ? x.told : [])) if (said(t) && in_.includes(said(t))) told.push(t);
  return { text, told };
}
/* at or after 22:00 UTC (or opts.force), once a day: the evening's one
   message. {ok, sent, due, reason?}; never throws */
export async function eveningDigest(opts = {}) {
  const t = nowMs();
  const day = dayOf(t);
  if (!opts.force && new Date(t).getUTCHours() < DIGEST_HOUR_UTC) return { ok: true, due: false, sent: false };
  let first = false;
  try { first = (await store([["SET", VK.digestSent(day), nowIso(), "NX", "EX", String(2 * 86400)]]))[0] === "OK"; }
  catch { return { ok: false, due: true, sent: false, reason: "the store could not be reached" }; }
  if (!first) return { ok: true, due: true, sent: false, reason: "already sent this evening" };
  let got;
  try { got = await digestItems(day); } catch { return { ok: false, due: true, sent: false, reason: "the day's items could not be read" }; }
  /* round five (D2): the urgent messages still waiting to get through are
     named in the evening, and dealt with once it went */
  const rt = await retryItems();
  const composed = digestCompose(got.items, day, got.carried, rt.items.map(x => x.kind));
  const text = composed.text;
  if (!text) { if (got.carried) { try { await store([["DEL", VK.carry]]); } catch { } } return { ok: true, due: true, sent: false, reason: "nothing waited for the evening" }; }
  /* one of the day's six is always left for something urgent */
  let spent = 0;
  try { const T = await import("./_telegram.js"); spent = parseInt((await store([["GET", T.K_TG_SENT(day)]]))[0], 10) || 0;
    if (typeof seams.notify !== "function" && spent >= T.OWNER_DAILY_MAX - 1) {
      await carryOver(day, got.items);
      await log("digest", false, "the day's messages were spent; carried to tomorrow evening");
      return { ok: true, due: true, sent: false, carried: true, reason: "the day's messages were spent; carried to tomorrow evening" };
    } } catch { /* a count that cannot be read: notifyOwner keeps its own cap */ }
  const r = await line(text);
  await log("digest", r.ok, r.reason);
  if (r.ok) {
    /* round five (D9): only what the message said is remembered as told */
    await rememberTold(composed.told);
    try { await store([["DEL", VK.carry]]); } catch { }
    if (rt.n) await retryKeep(rt.n, []);
  } else if (!NO_LINE.test(String(r.reason || ""))) {
    /* a passing fault (Telegram busy, the network, the store): the evening's
       words are carried, whole, rather than being lost; round five (D2): and
       tried again RETRY_S on, so a short outage costs half an hour, not a day */
    try { await carryOver(day, got.items); } catch { }
    try { await store([["SET", VK.digestSent(day), "retry " + nowIso(), "EX", String(RETRY_S)]]); } catch { }
    return { ok: false, due: true, sent: false, carried: true, retry: true, reason: r.reason };
  }
  return { ok: r.ok, due: true, sent: r.ok, text: r.ok ? text : undefined, reason: r.ok ? null : r.reason };
}
/* no line to carry for: not linked, no bot, or the owner blocked it */
const NO_LINE = /not linked|TG_BOT_TOKEN is not set|blocked the bot|nothing to say|not built on this deployment/i;
/* what an evening could not say waits for the next, carried whole (the
   newest 60), and the day's own list is emptied so nothing is said twice */
async function carryOver(day, items) {
  await store([["SET", VK.carry, JSON.stringify({ from: day, items: (items || []).slice(-60) }), "EX", String(3 * 86400)], ["DEL", VK.digest(day)]]);
}

/* ---------------------------------------------------------------------------
   6. THE TICK'S OWN LOOK (api/soul.js, after the mailbox): letters waiting
      for his Send, at most once in six hours, then the evening digest.
      One round trip to the store when nothing is due.
--------------------------------------------------------------------------- */
export async function voiceTick(opts = {}) {
  const t = nowMs();
  const out = { letters: null, digest: null };
  let r;
  try { r = await store([["MGET", VK.said("letters", "window"), VK.digestSent(dayOf(t)), VK.cardDay(dayOf(t)), K.paused], ["LLEN", VK.retry]]); } catch { return { ok: false, error: "the store could not be read" }; }
  const v = (r && r[0]) || [];
  const waitingRetry = Number(r && r[1]) || 0;   /* round five (D2) */
  /* paused: the voice is silent like the rest of the tick (SOUL.md section
     9); an evening that passes in a pause carries its words to the first
     evening after it, so nothing waiting is lost */
  if (v[3] && parse(v[3], null)) {
    if (!v[1] && new Date(t).getUTCHours() >= DIGEST_HOUR_UTC) {
      try { const got = await digestItems(dayOf(t)); if (got.items.length) await carryOver(dayOf(t), got.items); } catch { }
    }
    return { ok: true, ran: false, why: "the Lantern is paused" };
  }
  /* once a day: while Telegram is not linked, its card is on his Home, even
     before the first cycle of a new deployment has run */
  if (!v[2]) {
    try {
      await store([["SET", VK.cardDay(dayOf(t)), nowIso(), "EX", String(2 * 86400)]]);
      const T = await import("./_telegram.js");
      const st = typeof T.ownerStatus === "function" ? await T.ownerStatus() : null;
      if (st && !st.reason && st.linked === false) {
        const DEC = await import("./_decisions.js");
        const card = DEC.fromReport({ telegram: { linked: false } }).find(c => c.key === "tg-link");
        if (card) { await DEC.upsert({ ...card, source: "cycle" }); out.linkCard = true; }
      }
    } catch { /* the morning cycle raises it as well */ }
  }
  if (!v[0]) {
    try {
      const DEC = await import("./_decisions.js");
      const n = (await DEC.readOpen()).filter(d => d && d.kind === "approve" && d.letter && /^mail:/.test(String(d.key || ""))).length;
      out.letters = n ? await urgent("letters", { n }) : { sent: false, waiting: 0 };
    } catch (e) { out.letters = { sent: false, error: str(e && e.message || e, 120) }; }
  }
  /* round five (D2): what did not get through, again, at most once in
     RETRY_S, before the evening (which names whatever still waits) */
  if (waitingRetry) { try { out.retry = await retryTick(); } catch { } }
  if (!v[1] && (opts.force || new Date(t).getUTCHours() >= DIGEST_HOUR_UTC)) out.digest = await eveningDigest(opts);
  return { ok: true, ...out };
}

/* the Home's voice part: linked or not and why it matters, the evening's
   hour, and today's urgent messages (kinds only) */
export async function voiceView() {
  const today = dayOf();
  const entries = (await voiceLog(20)).filter(x => String(x.at || "").slice(0, 10) === today);
  let waiting = 0;
  try { waiting = ((await store([["LLEN", VK.digest(today)]]))[0]) || 0; } catch { waiting = 0; }
  return { digestAt: DIGEST_HOUR_UTC + ":00 UTC", digestWaiting: Number(waiting) || 0,
    today: entries.map(x => ({ at: x.at, kind: x.kind, sent: x.sent })) };
}
