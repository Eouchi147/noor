/* NOOR · the calendar the dated posts stand on
   ===========================================================================
   Everything in this file exists because of one measurement.

   The site already had a Hijri date function: hijriOf() in _lights.js, the
   tabular arithmetic. It is fine for saying "this card is from Rajab". It is
   not fine for telling a person what to do today. Checked against two
   published authorities it drifts:

       31 Aug 2026   tabular says 17 Rabi al-Awwal   ·   really the 18th
        9 Mar 2027   tabular says 30 Ramadan         ·   really Eid al-Fitr
       15 May 2027   tabular says  8 Dhul Hijjah     ·   really the 9th

   A day out on Eid means telling someone to keep fasting on a day when
   fasting is forbidden. Two days out on Arafah means calling the fast on the
   wrong day and missing the right one. Those are not display bugs.

   So dated claims come from here, and here has exactly one source: the Umm
   al-Qura calendar of the High Judicial Council of Saudi Arabia, read through
   aladhan.com, which also names the observance itself so the mapping is not
   hand-maintained. The tabular arithmetic is deliberately NOT wired in as a
   fallback. If this file cannot answer, it returns null, and every caller
   treats null as "say nothing today" rather than "guess". Silence is a
   recoverable failure. A confident wrong date is not.

   And even when it does answer, the copy it feeds says which calendar it
   followed and sends the reader to their own mosque, because Umm al-Qura and
   the Fiqh Council of North America genuinely disagree by a day on Eid
   al-Adha 2027 and neither is making a mistake.
--------------------------------------------------------------------------- */

import { kv, kvReady } from "./_kv.js";

const API = "https://api.aladhan.com/v1/gToH/";
export const METHOD = "Umm al-Qura";
export const METHOD_NOTE = "by the Umm al-Qura calendar · your local mosque confirms the day";

const K = d => "nhij:" + d;
/* a date that has already been converted never converts differently, so the
   cache is allowed to be long. Six months. */
const TTL = 60 * 60 * 24 * 180;
const MEM = new Map();

const MONTHS = ["", "Muharram", "Safar", "Rabi al-Awwal", "Rabi ath-Thani",
  "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Sha'ban", "Ramadan",
  "Shawwal", "Dhul Qa'dah", "Dhul Hijjah"];
export const monthName = m => MONTHS[m] || "";

const iso = d => d.toISOString().slice(0, 10);
export function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
const ddmmyyyy = s => { const [y, m, d] = s.split("-"); return `${d}-${m}-${y}`; };

/* ---------------------------------------------------------------------------
   one date, verified or nothing
--------------------------------------------------------------------------- */
export async function verifiedHijri(dateStr, opts = {}) {
  const fetcher = opts.fetch || globalThis.fetch;
  if (MEM.has(dateStr)) return MEM.get(dateStr);

  if (kvReady() && !opts.noCache) {
    try {
      const raw = (await kv([["GET", K(dateStr)]]))[0];
      if (raw) {
        const v = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (v && v.m) { MEM.set(dateStr, v); return v; }
      }
    } catch { }
  }

  let j = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeout || 6000);
    const r = await fetcher(API + ddmmyyyy(dateStr), { signal: ctrl.signal });
    clearTimeout(t);
    if (!r || !r.ok) return null;
    j = await r.json();
  } catch { return null; }

  const h = j && j.data && j.data.hijri;
  if (!h || !h.month || !h.day || !h.year) return null;

  const m = parseInt(h.month.number, 10), d = parseInt(h.day, 10), y = parseInt(h.year, 10);
  /* a shape we do not recognise is a shape we do not trust */
  if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 30) || !(y > 1400 && y < 1600)) return null;

  const out = {
    g: dateStr, d, m, y,
    name: monthName(m),
    holidays: Array.isArray(h.holidays) ? h.holidays : [],
    method: (h.method && h.method.toString()) || "HJCoSA",
    source: "aladhan.com · " + METHOD
  };
  MEM.set(dateStr, out);
  if (kvReady()) {
    try { await kv([["SET", K(dateStr), JSON.stringify(out), "EX", String(TTL)]]); } catch { }
  }
  return out;
}

/* the next N days, verified. Any day that will not verify comes back null and
   stays null -- the caller decides what to do with a hole, and the answer is
   always "post nothing dated for that day". */
export async function verifiedRange(startDate, days, opts = {}) {
  const out = [];
  for (let i = 0; i < days; i++) {
    out.push(await verifiedHijri(addDays(startDate, i), opts));
  }
  return out;
}
