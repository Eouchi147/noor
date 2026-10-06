// NOOR · what the Lantern chose for the public, read in the one request
// every page already makes.
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS (3 October 2026, LANTERN.md sections 8 and 9)
//
// The Lantern may change three small things a reader sees, each through its
// own hand, each written into the store by that hand alone:
//
//   nsoul:pub:line  {id, since, until}  the wording of the one quiet support
//                                        line every page carries (sponsor.js),
//                                        chosen from the fixed set below;
//   nsoul:pub:note  {text, at}           the note on the giving page, made by
//                                        a template from facts (api/_giving.js);
//   nsoul:pub:door  {path, title, desc, since, until}
//                                        the door of the week, written by the
//                                        mission's feature-door lever and only
//                                        read here.
//
// publicPicks() reads all three in one store call, with the Hijri date the
// poster already caches (nhij:<date>, api/_hijri.js), and applies the rules
// on the server, so the page is handed only what it may show: a seasonal
// wording out of its season, or one whose date has passed, falls back to the
// everyday line; a note older than two weeks is not shown; a door past its
// date, or of a shape this file does not recognise, is not shown. A store
// fault throws, and the settings answer then carries `lantern: null` and the
// page goes on exactly as it did before.
//
// This file is deliberately light (the store, nothing else): the settings
// answer is the one request every page makes, so it never loads the mind.
// ---------------------------------------------------------------------------

import { kv, kvReady } from "./_kv.js";
import { publicDoor } from "./_door.js";   /* the door's words come from the library's map, never the record (merge, 6 October) */

export const PUB_KEYS = Object.freeze({ line: "nsoul:pub:line", note: "nsoul:pub:note", door: "nsoul:pub:door" });

/* THE WORDINGS, written into the code and nowhere else (Article 11): each
   honest and calm, built like the everyday line with a "·" between its
   parts, never urgent, never a guilt, never a reward. sponsor.js holds the
   same text by the same ids, and tests/giving.mjs keeps the two equal. The
   "Keep it lit →" link beside the line is sponsor.js's own and never
   changes. */
export const LINES = Object.freeze({
  "everyday": "This library is free for everyone, forever · no ads, no trackers · it runs on the gifts of its readers",
  "ramadan": "Ramadan Mubarak · this library is free for everyone, forever · no ads, no trackers · it runs on the gifts of its readers",
  "last-ten": "The last ten nights of Ramadan · this library is free for everyone, forever · no ads, no trackers · it runs on the gifts of its readers",
  "dhul-hijjah": "The first ten days of Dhul Hijjah · this library is free for everyone, forever · no ads, no trackers · it runs on the gifts of its readers",
  "thanks": "Thank you · last month the gifts of readers covered this library's running costs · free for everyone, forever · no ads, no trackers"
});
export const LINE_IDS = Object.freeze(Object.keys(LINES));
export const LINE_LABELS = Object.freeze({
  "everyday": "The everyday line", "ramadan": "The Ramadan line", "last-ten": "The last ten nights line",
  "dhul-hijjah": "The Dhul Hijjah line", "thanks": "The thanks line"
});
/* the wordings that keep a season, by the Hijri date (Umm al-Qura, as the
   poster reads it): Ramadan all month, its last ten nights from the 21st,
   Dhul Hijjah's first ten days. The thanks line keeps its own date instead
   (the month after a month the gifts covered the recorded costs). */
export const SEASONAL = Object.freeze(["ramadan", "last-ten", "dhul-hijjah"]);
export function inSeason(id, hijri) {
  if (id === "everyday" || id === "thanks") return true;
  const h = hijri && typeof hijri === "object" ? hijri : null;
  const m = h ? Number(h.m) : NaN, d = h ? Number(h.d) : NaN;
  if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 30)) return false;
  if (id === "ramadan") return m === 9;
  if (id === "last-ten") return m === 9 && d >= 21;
  if (id === "dhul-hijjah") return m === 12 && d <= 10;
  return false;
}
const realDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const addDays = (date, n) => { const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/* the wording a reader sees today: the chosen one while it is valid, else
   the everyday line */
export function effectiveLine(stored, hijri, today) {
  const s = stored && typeof stored === "object" ? stored : null;
  if (!s || !Object.prototype.hasOwnProperty.call(LINES, String(s.id))) return "everyday";
  if (realDate(s.until) && s.until < today) return "everyday";
  if (!inSeason(s.id, hijri)) return "everyday";
  return s.id;
}
/* today's Hijri date from the poster's own cache, never the network: the
   day's own entry, or yesterday's plus one when that cannot cross a month
   (the 28th or before); otherwise unknown, and a seasonal wording waits */
export function hijriFromCache(todayRaw, yesterdayRaw) {
  const p = v => { if (!v) return null; try { const o = typeof v === "string" ? JSON.parse(v) : v; return o && o.m && o.d ? { m: Number(o.m), d: Number(o.d), y: Number(o.y) || null } : null; } catch { return null; } };
  const t = p(todayRaw);
  if (t) return t;
  const y = p(yesterdayRaw);
  if (y && y.d <= 28) return { m: y.m, d: y.d + 1, y: y.y };
  return null;
}
const NOTE_DAYS = 14;
const parse = v => { if (v == null) return null; if (typeof v === "object") return v; try { return JSON.parse(v); } catch { return null; } };
const str = (v, n) => String(v == null ? "" : v).replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
export function noteView(raw, today) {
  const n = parse(raw);
  if (!n || typeof n !== "object") return null;
  const text = str(n.text, 600), at = String(n.at || "");
  if (!text || !/^\d{4}-\d{2}-\d{2}/.test(at)) return null;
  if (at.slice(0, 10) < addDays(today, -NOTE_DAYS)) return null;
  return { text, at };
}

/* {line, note, door} for the settings answer; throws when the store cannot
   be read (the caller answers lantern: null) */
export async function publicPicks(opts = {}) {
  if (!(await kvReady())) throw new Error("no store");
  const today = opts.today || new Date(opts.now || Date.now()).toISOString().slice(0, 10);
  const r = await kv([["MGET", PUB_KEYS.line, PUB_KEYS.note, PUB_KEYS.door, "nhij:" + today, "nhij:" + addDays(today, -1)]]);
  const v = (r && r[0]) || [];
  const hijri = hijriFromCache(v[3], v[4]);
  return { line: effectiveLine(parse(v[0]), hijri, today), note: noteView(v[1], today), door: publicDoor(parse(v[2]), today) };
}
