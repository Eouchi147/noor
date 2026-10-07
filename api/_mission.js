// NOOR · the Lantern's mission powers: beyond the reels, toward the goal.
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS (3 October 2026, LANTERN.md section 8)
//
// The owner's words: "More power to act has to encompass everything that
// will help reach the goal: Serve Allah in the most perfect way, shape or
// form possible and spread Islam to everyone in the world with peace, not
// only having power over the reels, but actively working towards the goals
// taking concrete actions."
//
// The Lantern already reads everything and acts on the posting, the numbers
// and search. These are its hands for the rest of what the house controls,
// merged into the one registry (api/_hands.js) the way api/_levers.js is, so
// every rule of LANTERN.md sections 3 and 4 and SOUL.md holds for them: the
// red lines in code, the council for R2, the caps, the audit, an exact undo.
//
//   draft (R1, 3 a day, counted by this hand): a letter for the owner to
//     send himself, from his own account, because messaging people stays a
//     red line for the Lantern. It is kept in nsoul:drafts and raised as a
//     "you" decision carrying `draft: {title, text}` and the steps; Sent
//     (the owner's own, through draft-sent below) records the outreach so
//     the reach that follows is measured, Later hides it, No closes it. At
//     most 3 letters wait at once. The red-line guard reads the hand's own
//     fields (kind, to, purpose, and the intent's why), never the letter,
//     because a letter is addressed to someone by design; this hand reads
//     the letter instead: no personal data (an email address, a phone
//     number, an IP address, a key, a Journal marker), no number the
//     evidence does not carry (api/_agent.js critic), no endorsement the
//     house does not have, no promise it has not made, and no private
//     person found in the house's own records named anywhere in it. The
//     hand cannot send anything: it writes to the store and to the owner's
//     Home, and nothing else.
//   draft-sent (R1, the owner's own): what his Sent on a letter's card
//     runs, and only that: the letter is marked sent with the reach of the
//     morning it went, and seven days on measureOutreach writes what
//     followed into the effects ledger, the same arithmetic api/_instruments
//     .js measureEffects uses for a public act.
//   feature-door (R2, cap door 1 a day): the door of the week, one of the
//     library's own rooms put forward on /today and on the arrival, in the
//     map's own words (api/_door.js); 7 days; undo puts back the door before.
//   searchFixesCard: the weekly search audit's failing pages (no
//     description, no canonical, too few words, not indexable) as ONE build
//     decision for Claude, the pages in its steps and the upgrade's spec,
//     raised again only when the list changes.
//   fieldText: the whole field the planner is told about (section 8 item
//     4), each power with the goal it serves, naming only registered hands.
//
// Only totals reach a model: nothing here hands a model a reader's words, a
// name, a gift or a letter's addressee from the house's own records.
// ---------------------------------------------------------------------------

import {
  K, nowIso, dayOf, addDays, newId, store, parse, casUpdate, reserve, release, readSeries, metricValue, readGoals, CAP_LIMITS
} from "./_soul.js";
import * as DEC from "./_decisions.js";
import { DOOR_KEY, DOOR_DAYS, DOORS, doorOf, readDoorRaw, publicDoor } from "./_door.js";
import * as I from "./_instruments.js";
import { scrub, looksLikeJournal } from "./_llm.js";
import { critic, evidenceFromText } from "./_agent.js";
import { SLOTS, REEL_SLOTS } from "./_schedule.js";

const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n || 200);
const realDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const DASHES_G = new RegExp("\\s*[" + String.fromCharCode(0x2014, 0x2013) + "]\\s*", "g");
/* the decisions an owner answered: a card closed by him is not raised again
   for the same list (api/_decisions.js CLOSED_BY_OWNER) */
const OWNER_ANSWERED = new Set(["done", "yes", "no", "approved", "declined", "refused"]);

/* ---------------------------------------------------------------------------
   1. DRAFTS: the letters the Lantern writes for the owner to send himself
--------------------------------------------------------------------------- */
export const K_DRAFTS = "nsoul:drafts";
export const K_DRAFTS_VER = "nsoul:drafts:ver";
export const DRAFTS_KEEP = 20;
export const DRAFTS_DAYS = 60;
export const DRAFTS_OPEN_MAX = 3;
export const DRAFT_SOURCE = "draft";
export const DRAFT_KINDS = Object.freeze({
  mosque: "a mosque",
  society: "a Muslim student society",
  school: "a teacher or a school",
  creator: "an Islamic creator (an Instagram Collab)",
  sponsor: "a foundation or a sponsor (a case for support, a grant application)",
  press: "the press"
});
export const TEXT_MIN = 80, TEXT_MAX = 2400;
const TITLE_MAX = 120, TO_MAX = 120, PURPOSE_MAX = 300;

/* `to` names a role or a public institution: one of these words, and no
   personal title before a name, no address, no handle, no number */
const ROLE_RX = /\b(imams?|mosques?|masjids?|cent(re|er)s?|societ(y|ies)|isocs?|unions?|associations?|clubs?|schools?|teachers?|headteachers?|principals?|madrasas?|madrasahs?|academ(y|ies)|colleges?|universit(y|ies)|chaplain(s|cy|cies)?|departments?|facult(y|ies)|creators?|channels?|pages?|podcasts?|teams?|editors?|editorial|newsrooms?|desks?|press|magazines?|newspapers?|journalists?|radio|reporters?|foundations?|trusts?|funds?|charit(y|ies)|sponsors?|programmes?|programs?|committees?|councils?|boards?|trustees|organi[sz]ations?|institutes?|librar(y|ies)|networks?|officers?|coordinators?|leaders?|organi[sz]ers?|students?|parents?)\b/i;
/* a personal title before a capitalised name ("Sheikh Yusuf", "Dr Amina")
   names a person; an institution named after one ("the Imam Ali Centre")
   carries its own institution word in the same capitalised run */
const HONORIFICS = new Set(["mr", "mrs", "ms", "miss", "dr", "prof", "sheikh", "shaykh", "shaikh", "ustadh", "ustadha", "ustaz", "brother", "sister", "sr", "br", "imam", "hafiz", "mufti", "maulana", "mawlana"]);
const INSTITUTION_RX = /^(centre|center|foundation|mosque|masjid|society|school|trust|academy|institute|college|university|library|council|association|union|charity|fund|madrasa|madrasah|press|radio|channel)$/i;
export function namesAPerson(to) {
  const words = String(to || "").split(/[\s,;:()]+/).filter(Boolean);
  for (let i = 0; i < words.length - 1; i++) {
    if (!HONORIFICS.has(words[i].toLowerCase().replace(/\.$/, "")) || !/^\p{Lu}/u.test(words[i + 1])) continue;
    let j = i + 1;
    const run = [];
    while (j < words.length && /^\p{Lu}/u.test(words[j])) run.push(words[j++]);
    if (!run.some(w => INSTITUTION_RX.test(w.replace(/['’]s$/i, "")))) return true;
  }
  return false;
}
/* an endorsement or a partnership the house does not have; and a promise it
   has not made: a payment, or a post of someone else's (the house posts
   only its own shelf, on its own schedule). Kept narrow on purpose: "it
   runs on the gifts of its readers" must pass, and the owner reads every
   letter before it goes anywhere */
const ENDORSE_RX = /\b(endorsed|approved|certified|accredited|authori[sz]ed|recommended)\s+by\b|\b(in\s+partnership\s+with|official\s+partners?|partnered\s+with|trusted\s+by|as\s+seen\s+(on|in)|award[- ]winning)\b/i;
const PROMISE_RX = /\b(we|i)\s+(will|shall|can|could|would|guarantee|promise)\s+(to\s+)?(pay|post|repost|share|reshare|feature|publish|promote|advertise)\b|\b(paid|sponsored)\s+(partnerships?|posts?|collabs?|collaborations?)\b|\bcommissions?\b/i;

/* a letter's own text, as it is kept: line breaks kept (a letter has
   paragraphs), runs of blank lines and spaces tidied, no dash the house
   does not write */
function letterText(v) {
  return String(v == null ? "" : v).replace(/\r\n?/g, "\n").replace(DASHES_G, ", ")
    .split("\n").map(l => l.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* the hand's own fields, checked; pure. {ok, value} or {ok:false, error} */
export function checkDraft(args) {
  const a = args && typeof args === "object" ? args : {};
  const kind = String(a.kind || "").trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(DRAFT_KINDS, kind)) return { ok: false, error: "kind must be one of " + Object.keys(DRAFT_KINDS).join(", ") };
  const to = str(a.to, TO_MAX + 1);
  if (to.length < 3 || to.length > TO_MAX) return { ok: false, error: "to names who the letter is for, in a few words" };
  if (/@|https?:|www\.|\d{5,}/i.test(to) || namesAPerson(to) || !ROLE_RX.test(to))
    return { ok: false, error: "to names a role or a public institution (the imam of a mosque, a student society's committee, a newsroom), never a person, an address or a handle" };
  const purpose = str(a.purpose, PURPOSE_MAX + 1);
  if (purpose.length < 10 || purpose.length > PURPOSE_MAX) return { ok: false, error: "purpose says in a sentence what the letter asks for" };
  const title = letterText(a.title).replace(/\n+/g, " ").slice(0, TITLE_MAX + 1);
  if (title.length < 3 || title.length > TITLE_MAX) return { ok: false, error: "title is the letter's subject line, under " + TITLE_MAX + " characters" };
  const text = letterText(a.text);
  if (text.length < TEXT_MIN) return { ok: false, error: "the letter is too short to send (" + text.length + " characters)" };
  if (text.length > TEXT_MAX) return { ok: false, error: "the letter is longer than " + TEXT_MAX + " characters; a first letter is short" };
  return { ok: true, value: { kind, to, purpose, title, text } };
}

/* a link in a letter is to the house's own pages, or none at all */
const SITE_HOST = () => (process.env.SITE_HOST || "noorcodex.com").replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
const URL_RX = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
/* and a bare host as well (review of 6 October 2026): bit.ly/x or
   instagram.com/someone, with no scheme and no www, is still a link out.
   Labels of letters, digits and hyphens, then a top-level name of two
   letters or more in one case, starting a word (never inside an address,
   a link already matched, or a longer word). "2.5 percent", "Dr. Ali",
   "e.g." and "a.m." are not hosts: a number is not a top-level name, a
   space ends a host, and a one-letter last part is not one either. */
const BARE_RX = /(?<![\p{L}\p{N}_.@\/:-])(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+(?:[a-z]{2,24}|[A-Z]{2,24})(?![\p{L}\p{N}_-])(?:[\/:][^\s<>"')\]]*)?/gu;
const hostOfLink = u => { try { return new URL(/^https?:\/\//i.test(u) ? u : "https://" + u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
export const linksIn = text => { const t = String(text || ""); return [...(t.match(URL_RX) || []), ...(t.replace(URL_RX, " ").match(BARE_RX) || [])]; };
const ownLink = u => { const h = hostOfLink(u); const site = SITE_HOST(); return !!h && (h === site || h.endsWith("." + site)); };
/* every link, with or without its scheme, said as "the link" (the critic below) */
const maskLinks = t => String(t || "").replace(URL_RX, " the link ").replace(BARE_RX, " the link ");

/* the letter itself, read for what the red-line guard does not read:
   personal data, a link out of the house, an endorsement the house does
   not have, a promise it has not made; pure. {ok} or {ok:false, error} */
export function checkLetter(v) {
  const all = [v.to, v.purpose, v.title, v.text].join("\n");
  if (looksLikeJournal(all)) return { ok: false, error: "the letter carries a Journal marker; the Journal stays anonymous" };
  const sc = scrub(all);
  if (!sc.ok || sc.text !== all) return { ok: false, error: "the letter carries personal data (an email address, a phone number, an IP address or a key); a draft never does" };
  if (linksIn(all).some(u => !ownLink(u))) return { ok: false, error: "the letter links outside the house; it may link only the library's own pages" };
  if (ENDORSE_RX.test(all)) return { ok: false, error: "the letter claims an endorsement or a partnership the house does not have" };
  if (PROMISE_RX.test(all)) return { ok: false, error: "the letter promises something the house has not made (a payment, or a post of someone else's)" };
  return { ok: true };
}

/* the map's own numbers written in words (the Ninety-Nine Names, the Five
   Pillars, twenty-three years), as digits, so a letter may write them */
const UNITS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
export function wordNumbers(text) {
  const out = [];
  const rx = /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](one|two|three|four|five|six|seven|eight|nine))?\b|\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/gi;
  let m;
  while ((m = rx.exec(String(text || "")))) out.push(m[1] ? TENS[m[1].toLowerCase()] + (m[2] ? UNITS[m[2].toLowerCase()] : 0) : UNITS[m[3].toLowerCase()]);
  return [...new Set(out)];
}

/* the numbers a letter may use: the library's own map (114 surahs, 25
   prophets, the 99 Names, 71 chapters, 350 Lights, 523 words), the day's
   schedule, the year, and the house's headline totals of its latest
   morning */
export async function draftEvidence(today) {
  const map = DOORS.map(d => d.title + ": " + d.desc).join(". ");
  /* the map's own number words as digits, apart: written as a JSON list the
     commas between them would read as one long number */
  const facts = {
    today, map, mapNumbers: wordNumbers(map).join(" "),
    schedule: { postsADay: SLOTS.filter(s => !s.conditional).length, reelsADay: REEL_SLOTS.length }
  };
  try {
    const s = await readSeries(8, today);
    const last = s.slice().reverse().find(x => x && x.snap);
    if (last) facts.house = { date: last.date, reach: metricValue(last.snap, "northStar"), visitors: metricValue(last.snap, "site.visitors7"), posts: metricValue(last.snap, "output.posts7") };
  } catch { /* the map and the schedule still stand */ }
  return evidenceFromText(JSON.stringify(facts));
}

/* full names (two words or more) from a field of the house's own records;
   a single first name is not matched, since it is also the name of a
   companion or a prophet the library speaks of every day */
const NAME_WORD = /^[\p{L}][\p{L}'’-]*$/u;
export function fullNamesIn(v) {
  const s = String(v == null ? "" : v).replace(/<[^>]*>/g, " ").replace(/\S+@\S+/g, " ").replace(/[^\p{L}'’\s-]/gu, " ");
  const words = s.split(/\s+/).filter(w => NAME_WORD.test(w) && w.replace(/['’-]/g, "").length >= 2);
  if (words.length < 2) return [];
  const name = words.slice(0, 4).join(" ").toLowerCase();
  return name.replace(/\s+/g, "").length >= 5 ? [name] : [];
}
const normWords = s => " " + String(s || "").toLowerCase().replace(/[^\p{L}'’\s-]/gu, " ").replace(/\s+/g, " ").trim() + " ";
export function namesInText(text, names) {
  const t = normWords(text);
  return (names || []).filter(n => n && t.includes(" " + n + " "));
}
/* THE NAME IN A BARE ADDRESS (review of 6 October 2026). The inbox keeps
   `from` as the address alone (api/inbox.js refuses "Name <address>"), so
   a full name is read from its own part before the @: two or more parts of
   letters, each two letters or more, once the words that name a role or a
   mailbox are set aside. yusuf.rahman@ is "yusuf rahman"; info@,
   contact.us@, imam.office@ and y.rahman@ are no one's full name. */
const NOT_A_NAME = new Set(["info", "contact", "us", "hello", "hi", "admin", "office", "team", "support", "mail", "email", "noreply",
  "no", "reply", "sales", "enquiries", "enquiry", "inquiries", "inquiry", "help", "news", "press", "media", "web", "webmaster", "the",
  "and", "my", "official", "account", "accounts", "secretary", "general", "mosque", "masjid", "imam", "centre", "center", "islamic",
  "society", "community", "school", "academy", "trust", "foundation", "dept", "desk", "hq", "org", "uk", "usa"]);
export function namesFromEmail(v) {
  const out = new Set();
  for (const m of String(v == null ? "" : v).matchAll(/([A-Za-z0-9._%+-]+)@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g))
    /* split at every mark, and once more keeping a hyphen inside a part,
       so maryam.al-haddad@ is read as "maryam al haddad" and "maryam al-haddad" */
    for (const rx of [/[^A-Za-z]+/, /[^A-Za-z-]+/]) {
      const parts = m[1].split(rx).map(p => p.replace(/^-+|-+$/g, "")).filter(p => p.replace(/-/g, "").length >= 2 && !NOT_A_NAME.has(p.toLowerCase()));
      if (parts.length >= 2) out.add(parts.slice(0, 4).join(" ").toLowerCase());
    }
  return [...out];
}
/* the private people in the house's own records: who wrote to the inbox,
   who commented on the Journal. Read here and never kept, logged or handed
   to a model; a store fault refuses the letter (fail closed) */
export async function privateNames() {
  const names = new Set();
  const add = v => { for (const n of fullNamesIn(v)) names.add(n); for (const n of namesFromEmail(v)) names.add(n); };
  const ids = ((await store([["LRANGE", "nb:list", "0", "99"]]))[0] || []).map(String).filter(Boolean);
  if (ids.length) for (const raw of ((await store([["MGET", ...ids.map(i => "nb:msg:" + i)]]))[0] || [])) { const m = parse(raw, null); if (m && typeof m === "object") add(m.from); }
  const entries = ((await store([["LRANGE", "nj:list", "0", "9"]]))[0] || []).map(String).filter(Boolean);
  if (entries.length) {
    const lists = await store(entries.map(e => ["LRANGE", "nj:c:" + e, "0", "99"]));
    for (const list of lists || []) for (const raw of (list || [])) { const c = parse(raw, null); if (c && typeof c === "object") { add(c.name); add(c.mail); } }
  }
  return [...names];
}

export async function readDraftsRaw() {
  const v = parse((await store([["GET", K_DRAFTS]]))[0], []);
  return Array.isArray(v) ? v.filter(d => d && d.id) : [];
}
export async function readDrafts() {
  try { return await readDraftsRaw(); } catch { return []; }
}
/* the list changed only on the version it was read at; 20 kept, 60 days */
const draftsWrite = fn => casUpdate(K_DRAFTS, K_DRAFTS_VER, cur => {
  const cutoff = addDays(dayOf(), -DRAFTS_DAYS);
  const list = (Array.isArray(cur) ? cur : []).filter(d => d && d.id && String(d.at || "").slice(0, 10) >= cutoff);
  const out = fn(list);
  if (!out || !out.write) return out;
  return { ...out, value: out.value.slice(0, DRAFTS_KEEP) };
});
/* the letters waiting for the owner: open cards of this source, Later or
   not, until their own date passes (api/_decisions.js archives those) */
const openDraftCards = list => { const t = dayOf(); return (list || []).filter(d => d && d.source === DRAFT_SOURCE && !(realDate(d.expires) && d.expires < t)); };

/* the card on the owner's Home: a "you" decision with the letter and its steps */
export function draftCard(d, goal) {
  return {
    kind: "you", key: "draft:" + d.id, stamp: "1", source: DRAFT_SOURCE, sticky: true, ref: d.id,
    title: "A letter to " + d.to, why: d.purpose, goal: goal || null, impact: null,
    draft: { title: d.title, text: d.text },
    options: [
      DEC.opt.choice("sent", "Sent", { type: "hand", intent: { action: "draft-sent", args: { id: d.id }, why: "the owner sent the letter from his own account" } }, "primary"),
      DEC.opt.later(), DEC.opt.no()
    ],
    link: null,
    steps: ["Read the letter, and change anything you wish", "Copy it, and send it yourself from your own account", "Press Sent here, so the reach that follows is measured"],
    expires: addDays(dayOf(), 14)
  };
}

async function draftRun(args, ctx) {
  const c = checkDraft(args);
  if (!c.ok) return c;
  const v = c.value;
  const l = checkLetter(v);
  if (!l.ok) return l;
  const today = dayOf();
  /* the Truth article: every number in the letter is one the evidence
     carries (the house's own links are addresses, not claims) */
  const ev = await draftEvidence(today);
  const cr = critic(maskLinks(v.title + ".\n" + v.text), ev);
  if (cr.removed && cr.removed.length) return { ok: false, error: "the letter carries a number the evidence does not: \"" + String(cr.removed[0]).slice(0, 120) + "\"" };
  /* no private person from the house's own records, anywhere in it */
  let names;
  try { names = await privateNames(); } catch { return { ok: false, error: "the house's records could not be read, so no letter was written (a name is never guessed absent)" }; }
  if (namesInText([v.to, v.purpose, v.title, v.text].join(" "), names).length) return { ok: false, error: "the letter names someone from the house's own records; a draft never does" };
  /* three letters at most wait for the owner */
  let open;
  try { open = openDraftCards(await DEC.readOpen()); } catch { return { ok: false, error: "the decisions could not be read, so no letter was written" }; }
  if (open.length >= DRAFTS_OPEN_MAX) return { ok: false, error: DRAFTS_OPEN_MAX + " letters already wait for the owner; no more until one is answered" };
  /* the cap, counted by this hand (runHand reserves caps for R2 alone) */
  const res = await reserve(["drafts"], today);
  if (!res.ok) return { ok: false, error: res.error };
  const id = newId("dft");
  /* the goal it serves: the one the plan named when it is a live goal,
     else the reach goal kept on the north star */
  let goals = [];
  try { goals = await readGoals(); } catch { goals = []; }
  const goal = goalOf(args && args.goal, "northStar", goals);
  const draft = { id, ...v, goal, at: nowIso(), by: str(ctx && ctx.actor, 30) || "soul", cycle: (ctx && ctx.cycle) || null, status: "open", decision: null };
  try {
    await draftsWrite(list => ({ write: true, value: [draft, ...list], result: true }));
  } catch (e) { await release(["drafts"], today); return { ok: false, error: "the letter could not be kept: " + str(e && e.message || e, 120) }; }
  const undoDraft = async () => { try { await draftsWrite(list => ({ write: true, value: list.filter(x => x.id !== id), result: true })); } catch { } await release(["drafts"], today); };
  let r;
  try { r = await DEC.upsert(draftCard(draft, goal)); } catch (e) { r = { ok: false, error: str(e && e.message || e, 120) }; }
  if (!r || !r.ok) { await undoDraft(); return { ok: false, error: "the letter's card could not be raised: " + str((r && (r.error || r.suppressed)) || "it refused", 120) }; }
  /* two letters written at the same moment may both have seen two waiting */
  try {
    const now = openDraftCards(await DEC.readOpen());
    if (now.length > DRAFTS_OPEN_MAX) { await DEC.closeByKey("draft:" + id, "overflow"); await undoDraft(); return { ok: false, error: DRAFTS_OPEN_MAX + " letters already wait for the owner; no more until one is answered" }; }
  } catch { /* the card stands; the next letter counts it */ }
  try { await draftsWrite(list => { const x = list.find(y => y.id === id); if (!x) return { write: false, result: null }; x.decision = r.id; return { write: true, value: list, result: x }; }); } catch { }
  return { ok: true, id, decision: r.id, kind: v.kind, to: v.to, title: v.title,
    note: "the letter waits on the owner's Home; nothing was sent, and nothing can be from here",
    undo: { kind: "draft-withdraw", id, key: "draft:" + id } };
}
async function draftUndo(u) {
  let d;
  try { d = (await readDraftsRaw()).find(x => x.id === u.id); } catch { return { ok: false, error: "the letters could not be read, so nothing was changed" }; }
  if (d && d.status === "sent") return { ok: false, error: "the owner already sent that letter; a letter that went cannot be taken back" };
  try { await DEC.closeByKey(u.key || "draft:" + u.id, "withdrawn"); } catch { }
  try { await draftsWrite(list => { const x = list.find(y => y.id === u.id); if (!x) return { write: false, result: null }; x.status = "withdrawn"; x.withdrawnAt = nowIso(); return { write: true, value: list, result: x }; }); } catch { }
  return { ok: true, note: "the letter is withdrawn from the owner's Home" };
}

/* the morning's reading of the metric the outreach is measured on */
async function readingOn(today, metric) {
  try {
    const s = await readSeries(8, today);
    const last = s.slice().reverse().find(x => x && x.snap && typeof metricValue(x.snap, metric) === "number");
    return last ? metricValue(last.snap, metric) : null;
  } catch { return null; }
}
async function draftSentRun(args, ctx) {
  const own = ctx && ctx.approval;
  if (!ctx || !ctx.ownerApproved || !own || own.source !== "decision")
    return { ok: false, error: "only the owner says a letter went: he presses Sent on the letter's own card" };
  const id = str(args && args.id, 80);
  let list;
  try { list = await readDraftsRaw(); } catch { return { ok: false, error: "the letters could not be read, so nothing was marked" }; }
  const d = list.find(x => x.id === id);
  if (!d) return { ok: false, error: "there is no such letter" };
  /* that letter's own card, by what the letter kept or by its key */
  let cardId = d.decision || null;
  if (!cardId) { try { const f = await DEC.findByKey("draft:" + id); cardId = f && f.decision ? f.decision.id : null; } catch { cardId = null; } }
  if (!cardId || own.id !== cardId) return { ok: false, error: "Sent is pressed on the letter's own card" };
  if (d.status === "sent") return { ok: false, error: "that letter was already marked sent on " + String(d.sentAt || "").slice(0, 10) };
  const today = dayOf();
  const metric = "northStar";
  const before = { metric, value: await readingOn(today, metric), date: today };
  const sentAt = nowIso();
  try {
    await draftsWrite(l => { const x = l.find(y => y.id === id); if (!x) return { write: false, result: null }; Object.assign(x, { status: "sent", sentAt, before }); return { write: true, value: l, result: x }; });
  } catch (e) { return { ok: false, error: "the letter could not be marked: " + str(e && e.message || e, 120) }; }
  return { ok: true, id, kind: d.kind, to: d.to, sentAt, before,
    note: "the letter is marked sent; the reach that follows is measured seven days on, in the effects ledger",
    undo: { kind: "draft-unsent", id } };
}
async function draftSentUndo(u) {
  try {
    const x = await draftsWrite(l => { const y = l.find(z => z.id === u.id); if (!y || y.status !== "sent") return { write: false, result: null };
      if (y.effect) return { write: false, result: { measured: true } };
      Object.assign(y, { status: "unsent", sentAt: null, before: null }); return { write: true, value: l, result: y }; });
    if (x && x.measured) return { ok: false, error: "what followed that letter is already measured; it stays in the record" };
    if (!x) return { ok: false, error: "that letter is not marked sent" };
  } catch (e) { return { ok: false, error: "the letter could not be changed: " + str(e && e.message || e, 120) }; }
  return { ok: true, note: "the letter is no longer counted as sent, and nothing is measured for it" };
}

/* seven days after a letter went, what followed: the reflect stage's own
   step beside measureEffects (api/_mind.js), into the same effects ledger */
export async function measureOutreach(today) {
  const out = { measured: [], waiting: 0 };
  const list = await readDrafts();
  const due = list.filter(d => d.status === "sent" && d.before && d.before.metric && !d.effect && realDate(d.before.date));
  if (!due.length) return out;
  const series = await readSeries(60, today);
  const byDate = new Map(series.map(x => [x.date, x.snap]));
  for (const d of due) {
    const date = d.before.date, metric = d.before.metric;
    const on = addDays(date, I.EFFECT_DAYS);
    if (on > today) { out.waiting++; continue; }
    const valueOn = x => { const v = metricValue(byDate.get(x), metric); return typeof v === "number" ? v : null; };
    const after = valueOn(on);
    if (after == null && addDays(on, 2) > today) { out.waiting++; continue; }
    const baseline = I.matchedBaseline(valueOn, date, 3);
    const before = typeof d.before.value === "number" ? d.before.value : valueOn(date);
    const j = I.judgeEffect({ before, after, baseline, lower: false });
    const effect = { id: "draft:" + d.id, action: "draft", metric, date, measuredOn: on, before: typeof before === "number" ? before : null, after,
      ...j, baselineN: baseline.n, outreach: { kind: d.kind }, undone: false, cycle: null, at: nowIso() };
    try { await store([["LPUSH", K.effects, JSON.stringify(effect)], ["LTRIM", K.effects, "0", String(I.EFFECTS_KEEP - 1)]]); } catch { continue; }
    try { await draftsWrite(l => { const x = l.find(y => y.id === d.id); if (!x) return { write: false, result: null }; x.effect = { verdict: effect.verdict, delta: effect.delta, excess: effect.excess, at: effect.at }; return { write: true, value: l, result: x }; }); } catch { }
    out.measured.push(effect);
  }
  return out;
}

/* ---------------------------------------------------------------------------
   2. THE DOOR OF THE WEEK (api/_door.js holds the rooms and the record)
--------------------------------------------------------------------------- */
async function featureDoorRun(args, ctx) {
  const d = doorOf(args && args.path);
  if (!d) return { ok: false, error: "the door of the week is one of the library's own rooms in its map, never the gift door or the console; " + str(args && args.path, 60) + " is not one" };
  let prev;
  try { prev = await readDoorRaw(); } catch { return { ok: false, error: "the door of the week could not be read, so nothing was changed" }; }
  const today = dayOf();
  const rec = { id: newId("door"), path: d.path, title: d.title, desc: d.desc, since: today, until: addDays(today, DOOR_DAYS), at: nowIso(),
    by: str(ctx && ctx.actor, 30) || "soul", why: str(ctx && ctx.why, 300) };
  try { await store([["SET", DOOR_KEY, JSON.stringify(rec)]]); }
  catch (e) { return { ok: false, error: "the door could not be written: " + str(e && e.message || e, 120) }; }
  return { ok: true, path: d.path, title: d.title, since: rec.since, until: rec.until,
    note: "\"" + d.title + "\" is the door of the week on /today and the arrival, to " + rec.until,
    undo: { kind: "door-restore", wrote: rec.id, before: prev || null } };
}
async function featureDoorUndo(u) {
  let cur;
  try { cur = await readDoorRaw(); } catch { return { ok: false, error: "the door of the week could not be read, so nothing was changed" }; }
  if (!cur || cur.id !== u.wrote) return { ok: false, error: "a newer door was chosen since; this one is no longer the door of the week" };
  const before = u.before && typeof u.before === "object" && u.before.path ? u.before : null;
  if (before) await store([["SET", DOOR_KEY, JSON.stringify(before)]]);
  else await store([["DEL", DOOR_KEY]]);
  const was = before ? doorOf(before.path) : null;
  return { ok: true, note: before ? "the door before it is back" + (was ? ": \"" + was.title + "\"" : "") : "no door is put forward now" };
}

/* ---------------------------------------------------------------------------
   3. SEARCH FIXES BECOME BUILDS: one card for Claude, the list in its steps
--------------------------------------------------------------------------- */
export const SEARCH_KEY = "search-fixes";
export const SEARCH_SOURCE = "search";
const CHECK_OF = f => /description/.test(f) ? "description" : /canonical/.test(f) ? "canonical" : /^thin/.test(f) ? "words" : /noindex/.test(f) ? "indexable" : null;
const pathOf = u => { try { const x = new URL(u); return x.pathname + x.search || "/"; } catch { return String(u || ""); } };
/* the audit's failing pages, for the four basics a build can mend */
export function failingPages(reading) {
  const out = [];
  for (const p of (reading && Array.isArray(reading.failures) ? reading.failures : [])) {
    if (!p || !p.url) continue;
    const fails = (Array.isArray(p.fails) ? p.fails : []).map(String).filter(f => CHECK_OF(f)).sort();
    if (fails.length) out.push({ url: String(p.url), fails });
  }
  return out.sort((a, b) => a.url.localeCompare(b.url));
}
/* the list as it is stamped: each page and the basics it fails, never their
   numbers, so a page that went from 42 words to 45 is the same list */
export const searchStamp = pages => DEC.hashOf(pages.map(p => p.url + "|" + [...new Set(p.fails.map(CHECK_OF))].sort().join(",")).join("\n"));
export function searchSpec(pages, reading) {
  const lines = pages.map(p => "- " + p.url + ": " + p.fails.join("; "));
  return ("The weekly search audit" + (reading && reading.week ? " (" + reading.week + ")" : "") + " found " + pages.length + " page" + (pages.length === 1 ? "" : "s")
    + " of the library failing a basic a search engine reads first. Give each page a meta description written from its own content, a canonical address pointing at itself, at least "
    + I.MIN_WORDS + " words of real text, and no noindex, without changing what any page says about the faith.\n" + lines.join("\n")).slice(0, 3000);
}
export function searchCard(pages, upgradeId, reading) {
  const n = pages.length;
  const steps = pages.slice(0, n > 6 ? 5 : 6).map(p => (pathOf(p.url) + ": " + p.fails.join("; ")).slice(0, 220));
  if (n > 6) steps.push("and " + (n - 5) + " more pages, listed in the spec");
  return {
    kind: "build", key: SEARCH_KEY, stamp: searchStamp(pages), source: SEARCH_SOURCE, sticky: true, ref: upgradeId,
    title: "Build this? Fix the search basics on " + n + " page" + (n === 1 ? "" : "s"),
    why: "This week's search audit read " + ((reading && reading.sampled) || n) + " pages of the library; " + n + (n === 1 ? " fails" : " fail") + " on a basic a search engine reads first: a description, a canonical, enough words, or being indexable.",
    goal: "g-search", impact: "more of the library found by people searching",
    options: [DEC.opt.choice("build", "Build it", { type: "upgrade", id: upgradeId, status: "accepted" }, "primary"), DEC.opt.later(),
      DEC.opt.no("No", { type: "upgrade", id: upgradeId, status: "declined" })],
    link: { href: DEC.ROOM.engine, label: "Read the spec" }, steps, expires: addDays(dayOf(), 30)
  };
}
/* the report stage's own step (api/_mind.js): the latest reading as one
   card, raised again only when its list changes; a list emptied closes it */
export async function searchFixesCard() {
  const reading = await I.readLatest("search");
  if (!reading || !Array.isArray(reading.failures)) return { ok: true, raised: false, note: "no search reading yet" };
  const pages = failingPages(reading);
  const found = await DEC.findByKey(SEARCH_KEY);
  const E = await import("./_evolve.js");
  const was = found && found.decision ? found.decision : null;
  if (!pages.length) {
    if (found && found.open) {
      await DEC.closeByKey(SEARCH_KEY, "resolved");
      if (was.ref) { try { await E.removeUpgrade(was.ref); } catch { } }
      return { ok: true, resolved: true, pages: 0 };
    }
    return { ok: true, raised: false, pages: 0 };
  }
  const stamp = searchStamp(pages);
  if (was && String(was.stamp) === stamp && (found.open || OWNER_ANSWERED.has(was.status))) return { ok: true, raised: false, same: true, pages: pages.length };
  const no = await DEC.readNo();
  if (no[SEARCH_KEY]) return { ok: true, raised: false, note: "the owner said no to the search fixes until " + no[SEARCH_KEY] };
  /* the upgrade the card's Build it accepts: the same one while the list is
     the same and still only proposed, a new one when the list changed */
  let upId = null;
  if (was && String(was.stamp) === stamp && was.ref) {
    try { const u = (await E.listUpgrades()).find(x => x && x.id === was.ref && x.status === "proposed"); if (u) upId = u.id; } catch { }
  }
  if (!upId) {
    const u = await E.addUpgrade({ title: "Fix the search basics on " + pages.length + " page" + (pages.length === 1 ? "" : "s"), why: "The weekly search audit found pages failing a basic a search engine reads first.",
      spec: searchSpec(pages, reading), metric: "site.searchShare", expectedEffect: "more of the library found by people searching", priority: "medium" });
    if (!u.ok) return { ok: false, error: u.error };
    upId = u.upgrade.id;
  }
  const r = await DEC.upsert(searchCard(pages, upId, reading));
  if (!r || !r.ok) {
    if (!(was && was.ref === upId)) { try { await E.removeUpgrade(upId); } catch { } }
    return { ok: false, error: (r && (r.error || r.suppressed)) || "the card was refused" };
  }
  /* the list the card held before, never taken up, is withdrawn */
  if (was && was.ref && was.ref !== upId) { try { await E.removeUpgrade(was.ref); } catch { } }
  return { ok: true, raised: true, id: r.id, pages: pages.length, upgrade: upId };
}

/* ---------------------------------------------------------------------------
   4. THE WHOLE FIELD, as the planner is told it (LANTERN.md section 8 item 4)
--------------------------------------------------------------------------- */
export const FIELD = Object.freeze([
  { field: "Posting", goals: "g-reach, g-attention, g-health and g-test", hands: ["lineup-skip", "lineup-swap", "rota-lean", "fix-posting", "experiment-plan", "experiment-stop"],
    say: "the day's reels and cards; a network that failed a slot is asked again, and a reel still processing is finished, with fix-posting; a slot owed and not yet sent is the hourly run's, never a hand's; a test of what holds people runs through experiment-plan" },
  { field: "The numbers", goals: "every goal", hands: ["insights-refresh", "reconcile-teach"],
    say: "fresh numbers to judge by, and a duplicate guard that knows what each network already holds" },
  { field: "Search", goals: "g-search", hands: ["indexnow-submit"],
    say: "changed pages offered to the search engines; the weekly search audit's failing pages reach Claude as one build card the house raises itself, never as an intent" },
  { field: "The site", goals: "g-reach and g-search", hands: ["feature-door"],
    say: "one room of the library put forward for a week on /today and the arrival, chosen by the season (Ramadan, the ten days of Dhul Hijjah, Muharram, a Jumu'ah week), the topic radar's demand and the rooms readers stay in" },
  { field: "Borrowing audiences", goals: "g-reach", hands: ["draft"],
    say: "a letter the owner sends himself, to a mosque, a Muslim student society, a teacher or a school, an Islamic creator, a foundation or a sponsor, or the press; to names a role or a public institution; at most 3 a day and 3 waiting" },
  /* outreach (LANTERN.md section 11.3, api/_outreach.js) */
  { field: "Outreach", goals: "g-outreach and g-reach", hands: ["research", "outreach-send", "outreach-followup"],
    say: "places that teach Islam in the English-speaking world, found from their own published pages (a weekend school or youth work first, then student societies, schools and the rest, the countries mixed), each offered one first letter from the house's own address with something concrete and free, and one follow-up a week on when it has not answered; the pace step offers the day's letters itself, in order, so a plan names these only for a reason the pace cannot see" },
  { field: "Sustaining the house", goals: "g-sustain", hands: ["giving", "support-line", "giving-note"],
    say: "the gifts read as totals, the one quiet support line in a wording written in code and in its season, the giving page's note made from facts; never pressure, never an amount or a number of givers in anything public" },
  { field: "Its own memory", goals: "whichever goal the note or the lesson is about", hands: ["note", "goal", "lesson-propose", "upgrade-propose"],
    say: "nothing the public sees; an upgrade is a build Claude makes once the owner says so" }
]);
/* the field, naming only the hands this registry carries */
export function fieldText(hands) {
  const has = n => !!(hands && Object.prototype.hasOwnProperty.call(hands, n));
  const lines = [];
  for (const f of FIELD) {
    const hs = f.hands.filter(has);
    if (!hs.length) continue;
    lines.push("- " + f.field + " (serves " + f.goals + "): " + hs.join(", ") + ". " + f.say.charAt(0).toUpperCase() + f.say.slice(1) + ".");
  }
  return "THE WHOLE FIELD (every power the Lantern has, and the goal each serves; choose the power that serves a goal best, and name that goal in the intent's \"goal\"):\n" + lines.join("\n");
}
/* the goal an intent names: its own when it is a live goal, else the goal
   kept on its metric, else none */
export function goalOf(raw, metric, goals) {
  const live = (goals || []).filter(g => g && g.id && g.status !== "retired");
  const id = String(raw == null ? "" : raw).trim();
  if (id && live.some(g => g.id === id)) return id;
  const g = metric ? live.find(x => x.metric === metric) : null;
  return g ? g.id : null;
}
/* what the planner is told of these powers today: totals only */
export async function missionFacts(today) {
  const d = today || dayOf();
  const out = {};
  try { out.drafts = { waiting: openDraftCards(await DEC.readOpen()).length, waitingMax: DRAFTS_OPEN_MAX, perDay: CAP_LIMITS.drafts }; } catch { out.drafts = null; }
  try { const rec = await readDoorRaw(); const p = publicDoor(rec, d); out.door = p ? { path: p.path, title: p.title, until: rec.until } : null; } catch { out.door = null; }
  try { const f = await DEC.findByKey(SEARCH_KEY); out.searchFixesCard = f ? (f.open ? "waiting for the owner" : String(f.decision.status || "closed")) : null; } catch { out.searchFixesCard = null; }
  return out;
}

/* ---------------------------------------------------------------------------
   5. THE HANDS, merged into api/_hands.js HANDS the way api/_levers.js is.
      The describe lines are what the planner reads and tends to repeat in
      its own why, so they are worded never to trip a red line
      (tests/mission.mjs runs every one through the guard).
--------------------------------------------------------------------------- */
const DOOR_PATHS = DOORS.map(d => d.path).join(", ");
export const MISSION_HANDS = {
  draft: { tier: "R1", args: "{kind: mosque|society|school|creator|sponsor|press, to, purpose, title, text, goal}",
    /* the guard reads these and the intent's why, never the letter itself */
    guardArgs: ["kind", "to", "purpose"],
    describe: "write a letter for the owner to send himself, from his own account: to a mosque, a Muslim student society, a teacher or a school, an Islamic creator (an Instagram Collab), a foundation or a sponsor, or the press; to names a role or a public institution, never a person; purpose says in a sentence what the letter asks; title is its subject line; text is the letter itself, 150 to 250 words in the house's plain voice, every number in it one the evidence carries, with no endorsement the house does not have and no promise it has not made; it waits on the owner's Home with Sent, Later and No, and nothing leaves the house; at most 3 a day and 3 waiting",
    run: draftRun, undo: draftUndo },
  "draft-sent": { tier: "R1", args: "{id}", ownerOnly: true,
    describe: "the owner's own, never planned: marks a letter the Lantern wrote as gone, from the Sent on that letter's card, so the reach that follows is measured",
    run: draftSentRun, undo: draftSentUndo },
  "feature-door": { tier: "R2", caps: ["door"], args: "{path}",
    describe: "put one of the library's own rooms forward for a week as the door of the week, on /today and on the arrival, in the room's own title and line from the library's map, never words of its own; path is one of " + DOOR_PATHS + "; chosen by the season (Ramadan, the ten days of Dhul Hijjah, Muharram, a Jumu'ah week), the topic radar's demand and the rooms readers stay in; it ends after 7 days unless chosen again, and undo puts back the door before it",
    run: featureDoorRun, undo: featureDoorUndo }
};

/* the words the Home says for these hands (api/_home.js NOW_WORDS and
   PAST_WORDS take them in); a letter's addressee is the model's own words,
   so the brief says a draft by its kind alone */
const toWords = a => str(a && a.to, 80) || "someone the Lantern chose";
const doorWords = a => { const d = doorOf(a && a.path); return d ? "\"" + d.title + "\"" : "a room of the library"; };
export const MISSION_WORDS = Object.freeze({
  now: {
    draft: a => "Write a letter for you to send: to " + toWords(a),
    "draft-sent": () => "Mark a letter as sent",
    "feature-door": a => "Put " + doorWords(a) + " forward as the door of the week"
  },
  past: {
    draft: a => "Wrote a letter for you to send: to " + toWords(a),
    "draft-sent": () => "Marked a letter as sent, so what follows is measured",
    "feature-door": a => "Put " + doorWords(a) + " forward as the door of the week"
  }
});
