/* NOOR · the day, in slots
   ===========================================================================
   One post a day became four, and five when something is coming.

       05:00 UTC  dawn    what today is, and what to do about it
       09:00 UTC  lead    only when an observance is a known number of days out
       12:00 UTC  light   the day's card, the engine that already existed
       16:00 UTC  word    one word of the Path, in Arabic and plain English
       20:00 UTC  dusk    one chapter of the Path

   Two design decisions worth stating, because both were tempting to get wrong.

   FIRST: the dawn slot is the only one allowed to make a dated claim, and it
   refuses to run at all if the calendar could not be verified. Every other
   slot draws on material that is true on any day -- a word means what it means
   whatever the date -- so an unreachable calendar API costs the day's
   announcement and nothing else. The site keeps talking; it just stops
   claiming what today is.

   SECOND: word and dusk are chosen by hashing the date, not at random and not
   by a stored cursor. A hash is stable -- the same day always yields the same
   word, so a retry after a failed send cannot post a different one -- and with
   523 words it is well over a year before anything repeats.
--------------------------------------------------------------------------- */

import { readDay, leadsFor, FIXED } from "./_calendar.js";
import { verifiedHijri, verifiedRange, addDays, METHOD_NOTE } from "./_hijri.js";

export const SLOTS = [
  { id: "dawn",  at: 5,  needsDate: true  },
  { id: "lead",  at: 9,  needsDate: true, conditional: true },
  { id: "light", at: 12, needsDate: false },
  { id: "word",  at: 16, needsDate: false },
  { id: "dusk",  at: 20, needsDate: false }
];
export const SLOT_IDS = SLOTS.map(s => s.id);

/* a small stable hash, so a given date always picks the same item */
/* ---------------------------------------------------------------------------
   picking without repeating

   This was a hash of the date modulo the list length, which is a fresh throw of
   the dice every morning: nothing stopped two throws landing on the same face a
   week apart, and with seventy-one chapters in the Path the collisions were not
   rare. A reader who follows the account daily notices a repeat long before the
   arithmetic says one was due.

   A stride that shares no factor with the length walks the whole list before it
   returns to any item, so every word and every chapter is used once before any
   is used twice, and the order still depends only on the date -- two servers
   waking on the same morning still agree.
--------------------------------------------------------------------------- */
function hash32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const gcd = (a, b) => b ? gcd(b, a % b) : a;
function pick(list, dateStr, salt) {
  if (!list || !list.length) return null;
  const n = list.length;
  if (n === 1) return list[0];
  const day = Math.floor(Date.parse(String(dateStr) + "T00:00:00Z") / 86400000);
  if (!isFinite(day)) return list[hash32(String(dateStr) + "|" + salt) % n];
  let stride = (hash32(salt + "|stride") % (n - 1)) + 1;
  while (gcd(stride, n) !== 1) stride = (stride % (n - 1)) + 1;
  const off = hash32(salt + "|offset") % n;
  return list[(((day * stride + off) % n) + n) % n];
}

const BASE_TAGS = ["#Islam", "#NoorCodexOfLight"];
/* the link arrives as https://host/?light=DATE; strip the whole path, not just
   the query, or every derived link comes out with a doubled slash */
const root = l => String(l || "").replace(/^(https?:\/\/[^/]+).*$/, "$1");
const tags = (...extra) => [...new Set([...extra, ...BASE_TAGS])];

/* ---------------------------------------------------------------------------
   which slots belong to this day
--------------------------------------------------------------------------- */
export async function planDay(dateStr, opts = {}) {
  const h = await verifiedHijri(dateStr, opts);
  const day = readDay(h);                       /* null when unverified */
  let leads = [];
  if (h) {
    const ahead = await verifiedRange(addDays(dateStr, 1), 30, opts);
    leads = leadsFor(h, ahead);
  }
  const plan = [];
  for (const s of SLOTS) {
    if (s.needsDate && !h) continue;            /* no verified date, no dated post */
    if (s.id === "lead" && !leads.length) continue;
    plan.push(s.id);
  }
  return { date: dateStr, hijri: h, day, leads, slots: plan, verified: !!h };
}

/* ---------------------------------------------------------------------------
   what each slot actually says
--------------------------------------------------------------------------- */
export function buildSlot(slot, ctx) {
  const { date, hijri: h, day, leads, words, path, link, image } = ctx;

  if (slot === "dawn") {
    if (!h || !day) return null;
    const hd = `${h.d} ${h.name} ${h.y}`;
    const f = day.fixed, rec = day.recurring;
    if (f) {
      return {
        lvl: f.lvl, key: f.key,
        title: f.name,
        /* the names already carry their article -- "The Day of Arafah" -- so
           "Today is The Day of Arafah" reads like a machine wrote it */
        oneLine: `${f.name} — ${hd}.`,
        body: `${hd}.\n\n${f.what}`,
        todo: f.todo || [],
        basis: f.basis ? (f.url ? `${f.basis} · ${f.url}` : f.basis) : "",
        note: [f.note, METHOD_NOTE].filter(Boolean).join(" · "),
        tags: tags(f.tag || "#Islam", "#Muslim"),
        link, image
      };
    }
    if (rec.length) {
      const r = rec[0];
      return {
        lvl: r.lvl, key: r.key, title: r.name,
        oneLine: `${r.name} — ${r.what}`,
        body: `${hd}.\n\n${r.what}`,
        todo: r.todo || [],
        basis: r.url ? `${r.basis} · ${r.url}` : r.basis,
        note: [r.note, METHOD_NOTE].filter(Boolean).join(" · "),
        tags: tags(r.tag || "#Islam", "#Muslim"), link, image
      };
    }
    return {
      lvl: "editorial", key: "date", title: hd,
      oneLine: `Today is ${hd}.`,
      body: `${hd}.\n\nAn ordinary day in the Muslim year, which is most of them, and the ones the rest are built out of.`,
      todo: [], basis: "", note: METHOD_NOTE,
      tags: tags("#HijriCalendar"), link, image
    };
  }

  if (slot === "lead") {
    if (!leads || !leads.length) return null;
    const L = leads[0], o = L.obs;
    const when = L.days === 1 ? "tomorrow" : `in ${L.days} days`;
    return {
      lvl: o.lvl, key: o.key + "-lead", title: `${o.name} is ${when}`,
      oneLine: `${o.name} is ${when}.`,
      body: `${o.name} falls ${when}.\n\n${o.what}`,
      todo: o.todo || [],
      basis: o.basis ? (o.url ? `${o.basis} · ${o.url}` : o.basis) : "",
      note: [o.note, METHOD_NOTE].filter(Boolean).join(" · "),
      tags: tags(o.tag || "#Islam", "#Muslim"), link, image
    };
  }

  if (slot === "word") {
    const w = pick(words, date, "word");
    if (!w) return null;
    return {
      lvl: "editorial", key: "word-" + w.i, title: w.t,
      oneLine: `${w.t} (${w.a}) — ${w.s}`,
      body: `${w.t}\n${w.a}\n\n${w.s}`,
      todo: [], basis: "", note: "",
      tags: tags("#Arabic", "#Quran"),
      link: root(link) + "/dictionary#" + w.i, image
    };
  }

  if (slot === "dusk") {
    const c = pick(path, date, "path");
    if (!c) return null;
    return {
      lvl: "editorial", key: "path-" + c.i, title: c.t,
      oneLine: `${c.t} — chapter ${c.i} of the Path.`,
      body: `${c.t}\n${c.a || ""}\n\nChapter ${c.i} of the Path of Creation: the story from Kun Fayakun to the Hour, in seventy-one chapters.`,
      todo: [], basis: "", note: "",
      tags: tags("#IslamicHistory"),
      link: root(link) + "/#node-" + c.i, image
    };
  }

  return null;   /* "light" is built by compose() in social.js, not here */
}

/* ---------------------------------------------------------------------------
   which slots are due right now and have not been sent

   The catch-up cap is the important line. If a cron is down for a day and
   comes back, the honest thing is to post the one most recent thing, not to
   empty a backlog of nine posts into a feed at once -- which is precisely the
   pattern that gets an account flagged as automated.
--------------------------------------------------------------------------- */
export function dueNow(planSlots, nowUTC, sent, opts = {}) {
  const hour = nowUTC.getUTCHours();
  const due = SLOTS
    .filter(s => planSlots.includes(s.id))
    .filter(s => hour >= s.at)
    .filter(s => !sent.includes(s.id));
  const cap = opts.cap == null ? 1 : opts.cap;
  return due.slice(-cap);          /* the most recent unsent, not the whole backlog */
}
