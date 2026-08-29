// The Illuminations Library, and the Lantern's new job.
//
// ---------------------------------------------------------------------------
// WHAT WAS WRONG
//
// Today's Light came from fourteen written cards chosen by
// `dayIndexOf(today) % 14`. That is not a rotation. It is a fortnight on a
// loop, and a reader who opens the site every morning saw the same card
// twenty six times a year. The owner noticed, which means every daily reader
// had noticed long before.
//
// WHAT IT IS NOW
//
// A library of hundreds of cards, each anchored to the calendar where it has a
// real anchor, and a picker that remembers what it has already shown. The
// house keeps a ring of the last two hundred ids and will not show one of them
// again until the ring has turned.
//
// AND WHAT THE LANTERN DOES WITH IT
//
// This is the part worth reading. The Lantern no longer writes the day's card.
// It is a bad author of facts and a very good editor of them, so it has been
// moved to the job it is actually suited for:
//
//   1. it is handed the six best candidates for today and picks the one that
//      fits the date, the season and the week best, and says why in a line
//   2. it AUDITS the card it picked against the house rules, and if it finds a
//      claim it doubts, it says so, the card is skipped, and the doubt is
//      written where the owner will see it
//
// So the corpus is the truth and the Lantern is the editor over it. When the
// Lantern is dark, the picker still picks, by score alone, and the reader sees
// a card that a human wrote and a validator checked. Nothing degrades to
// nothing.
// ---------------------------------------------------------------------------

import { kv, kvReady } from "./_kv.js";
import { askOpenRouter } from "./_models.js";

/* How many ids we refuse to repeat. This was a fixed 200 and it was wrong:
   with 350 cards, a card that fell out of the ring on day 201 was picked again
   ahead of cards that had never been shown at all, because it had scored well
   enough to be picked early in the first place. A year of mornings gave 232
   different cards instead of 350. The ring has to be a proportion of the
   library, not a number somebody typed. */
/* A shuffle bag: every card shows once before any card shows twice. Holding
   one fewer than the library keeps the bag from emptying to nothing on the
   last day, which would leave the picker with no legal move. */
const ringSize = n => Math.min(1500, Math.max(30, n - 1));
const K_SEEN = "nl:seen";         /* the ring itself */
const K_DOUBT = "nl:doubt";       /* cards the Lantern raised a question about */
const SIX_HOURS = 6 * 3600 * 1000;

let LIB = { at: 0, lights: [], err: "" };

/* ---------------------------------------------------------------------------
   the tabular Islamic calendar, the same arithmetic the rest of the site uses.
   It has never looked at the sky and it does not pretend to.
--------------------------------------------------------------------------- */
export function hijriOf(dateStr) {
  const [Y, M, D] = String(dateStr).split("-").map(Number);
  const a = Math.floor((14 - M) / 12), yy = Y + 4800 - a, mm = M + 12 * a - 3;
  const jd = D + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
           - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  const l0 = jd - 1948440 + 10632;
  const n = Math.floor((l0 - 1) / 10631);
  let l = l0 - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719)
          + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
        - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const hm = Math.floor((24 * l) / 709);
  const hd = l - Math.floor((709 * hm) / 24);
  return { y: 30 * n + j - 30, m: hm, d: hd };
}
const HIJRI_NAMES = ["", "Muharram", "Safar", "Rabi al-Awwal", "Rabi ath-Thani",
  "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Sha'ban", "Ramadan",
  "Shawwal", "Dhul Qa'dah", "Dhul Hijjah"];
export const hijriName = m => HIJRI_NAMES[m] || "";

/* ---------------------------------------------------------------------------
   the library itself, fetched from this deployment's own static files
--------------------------------------------------------------------------- */
export async function library(host) {
  const now = Date.now();
  if (LIB.lights.length && now - LIB.at < SIX_HOURS) return LIB.lights;
  const base = "https://" + String(host || "noorcodex.com").replace(/^https?:\/\//, "");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(base + "/lights/all.json", { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    if (Array.isArray(j.lights) && j.lights.length) LIB = { at: now, lights: j.lights, err: "" };
  } catch (e) {
    LIB = { at: LIB.at, lights: LIB.lights, err: String(e && e.message || e).slice(0, 60) };
  }
  return LIB.lights;
}
export const libraryInfo = () => ({ n: LIB.lights.length, ageMs: LIB.at ? Date.now() - LIB.at : null, err: LIB.err });

/* a stable number per id per year, so the order varies between years but two
   servers answering the same morning always agree */
function jitter(id, year) {
  let h = 2166136261;
  const s = id + ":" + year;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 100;
}

const SEASON_TAGS = {
  9: ["ramadan", "fasting", "qiyam", "night", "quran"],
  10: ["eid", "charity"],
  12: ["hajj", "pilgrimage", "sacrifice", "makkah", "arafah"],
  1: ["muharram", "ashura", "hijra", "newyear"],
  3: ["mawlid", "seerah", "prophet"]
};

export function scoreLights(lights, dateStr, seen) {
  const [Y, M, D] = String(dateStr).split("-").map(Number);
  const h = hijriOf(dateStr);
  const season = SEASON_TAGS[h.m] || [];
  const skip = new Set(seen || []);
  return lights.map(L => {
    let s = 20, why = "the general pool";
    /* Every rule below both raises the score and names itself, and it may only
       name itself if it actually won. An earlier version used Math.max for the
       score but assigned `why` unconditionally, so a card that won on 17
       Ramadan was shown to the reader as "the season" -- the right card with
       the wrong reason printed under it. `lift` makes the two inseparable. */
    const lift = (n, r) => { if (n > s) { s = n; why = r; } };
    const w = L.w || {};

    if (w.m === M && w.d === D) lift(1000, "this exact day");
    else if (w.m === M) lift(260, "this month in history");

    /* The Islamic day outranks the Gregorian one. A reader keeping Ashura or
       the last ten nights is living in the hijri calendar that morning, and a
       card about the day they are in beats a card about the anniversary of
       something that fell on the same Western date. The tabular calendar can
       sit a day either side of the sighted moon, so the neighbouring day still
       scores well above a plain month match. */
    if (L.h === h.m && L.hd) {
      const nm = L.hd + " " + hijriName(h.m);
      if (L.hd === h.d) lift(1200, nm);
      else if (Math.abs(L.hd - h.d) === 1) lift(620, "around " + nm);
    }
    if (L.h === h.m) lift(210, "the month of " + hijriName(h.m));
    if (season.length && (L.tags || []).some(t => season.includes(t))) lift(130, "the season");

    /* an anniversary of a round number is worth surfacing */
    if (w.y && ((Y - w.y) % 100 === 0 || (Y - w.y) % 50 === 0)) {
      s += 90;
      if (why === "the general pool") why = (Y - w.y) + " years ago this year";
    }
    s += jitter(L.id, Y) / 100;                 /* breaks ties without breaking agreement */
    if (skip.has(L.id)) s -= 5000;              /* shown lately: only if nothing else is left */
    return { L, s, why };
  }).sort((a, b) => b.s - a.s);
}

async function readSeen(n) {
  if (!kvReady()) return [];
  try { const r = await kv([["LRANGE", K_SEEN, "0", String(ringSize(n))]]); return (r && r[0]) || []; }
  catch { return []; }
}
async function remember(id, n) {
  if (!kvReady() || !id) return;
  try { await kv([["LPUSH", K_SEEN, id], ["LTRIM", K_SEEN, "0", String(ringSize(n) - 1)], ["EXPIRE", K_SEEN, "31536000"]]); }
  catch { }
}
async function recordDoubt(entry) {
  if (!kvReady()) return;
  try { await kv([["LPUSH", K_DOUBT, JSON.stringify(entry)], ["LTRIM", K_DOUBT, "0", "60"], ["EXPIRE", K_DOUBT, "7776000"]]); }
  catch { }
}
export async function doubts() {
  if (!kvReady()) return [];
  try {
    const r = await kv([["LRANGE", K_DOUBT, "0", "60"]]);
    return ((r && r[0]) || []).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

/* ---------------------------------------------------------------------------
   the Lantern as editor: choose among six, and audit the one chosen
--------------------------------------------------------------------------- */
const AUDIT_RULES = [
  "The card must state a fact, not praise. No triumphalism, no grievance.",
  "No claim that a Muslim invented something they refined, and no scientific miracle claims.",
  "A date that is approximate must say so.",
  "Nothing may contradict what is well established in history.",
  "No em dashes, no exclamation marks, no emoji."
].join(" ");

async function lanternEdit(cands, dateStr) {
  const h = hijriOf(dateStr);
  const day = new Date(dateStr + "T12:00:00Z")
    .toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const list = cands.map((c, i) =>
    `${i + 1}. id=${c.L.id} · [${c.L.c}] ${c.L.t}\n   ${c.L.s.slice(0, 220)}`).join("\n");
  const sys = "You are the editor of a daily card on a free Islamic library. You do not write the "
    + "cards, you choose between them and you check them. " + AUDIT_RULES;
  const user =
    `Today is ${day}, ${h.d} ${hijriName(h.m)} ${h.y} AH.\n\n` +
    `Six cards are eligible. Choose the ONE that fits today best, and then read it once more ` +
    `against the rules and say whether anything in it looks wrong.\n\n${list}\n\n` +
    `Reply with JSON only: {"pick":"<the id>","why":"<why it fits today, under 14 words>",` +
    `"doubt":"<a specific factual doubt, or empty string if none>"}`;
  const got = await askOpenRouter(
    [{ role: "system", content: sys }, { role: "user", content: user }],
    { max_tokens: 220, temperature: 0.2, timeout: 8000, budget: 18000, maxTries: 3,
      title: "NOOR Codex of Light · the day's light" });
  if (!got.text) return null;
  let p = null;
  try { p = JSON.parse(got.text); }
  catch { const m = got.text.match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]); } catch { } } }
  if (!p || !p.pick) return null;
  return { pick: String(p.pick).trim(), why: String(p.why || "").slice(0, 90),
           doubt: String(p.doubt || "").trim().slice(0, 200), model: got.model };
}

/* ---------------------------------------------------------------------------
   the one call the rest of the house makes
--------------------------------------------------------------------------- */
export async function chooseLight(host, dateStr, opts = {}) {
  const lights = await library(host);
  if (!lights.length) return null;
  const seen = opts.fresh === false ? [] : await readSeen(lights.length);
  const ranked = scoreLights(lights, dateStr, seen);
  const top = ranked.slice(0, 6);
  let chosen = top[0], why = top[0].why, editor = "", doubt = "";

  if (opts.useLantern !== false) {
    try {
      const ed = await lanternEdit(top, dateStr);
      if (ed) {
        const found = top.find(c => c.L.id === ed.pick);
        if (ed.doubt && found) {
          /* the editor flagged the card it chose. Do not publish a doubt:
             skip it, and put the question where the owner will read it. */
          await recordDoubt({ at: new Date().toISOString(), id: found.L.id,
                              title: found.L.t, doubt: ed.doubt, model: ed.model });
          const next = top.find(c => c.L.id !== ed.pick);
          if (next) { chosen = next; why = next.why; editor = "the first choice was held back for checking"; }
        } else if (found) {
          chosen = found; why = ed.why || found.why; editor = ed.model || "";
        }
      }
    } catch { /* the editor is optional; the picker is not */ }
  }

  if (!opts.peek) await remember(chosen.L.id, lights.length);
  const L = chosen.L;
  return {
    date: dateStr,
    source: editor ? "library+lantern" : "library",
    id: L.id, category: L.c || "Light", title: L.t, story: L.s, detail: L.d,
    kind: L.k, lvl: L.lvl, src: L.src || "",
    why, editor, hijri: hijriOf(dateStr),
    pool: lights.length, ranked: top.length
  };
}
