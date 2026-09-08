// The dials · one place the owner turns things on and off.
//
// Until now every switch in this house was an environment variable, which
// means a redeploy to change a number and no way to see, from one screen,
// what is actually in force. This holds the same switches in the store, so
// they can be turned by hand and take effect on the next request.
//
// Three rules it keeps:
//   · env is the FLOOR, not the ceiling. A setting saved here overrides the
//     environment default, and deleting it falls back to the environment,
//     so nothing is ever stranded in a state only this endpoint can undo.
//   · with no store configured, every read returns the environment default
//     and every write is refused, loudly. Silent half-working control is
//     worse than none.
//   · nothing secret lives here. Keys, salts and tokens stay in env, where
//     they cannot be read back out over HTTP by anyone at all.
//
// GET  /api/settings            · the public subset, for the site itself
// GET  /api/settings?all=1      · everything, with defaults and sources (owner)
// POST /api/settings {k:v,...}  · save (owner). null removes a key.

import crypto from "crypto";
import { kv, kvReady } from "./_kv.js";

const KEY = "nb:settings";

/* Every dial this house has. `env` names the variable it falls back to,
   `pub` marks the ones the public site is allowed to read. */
export const DIALS = {
  /* ---- the Lantern -------------------------------------------------- */
  "lantern.on":        { t: "bool", env: "ASK_PUBLIC", envTrue: "1", def: false, pub: true,
                         g: "The Lantern", n: "The Lantern answers readers",
                         h: "Off means the lamp is not offered at all. Nothing is drawn and nothing is spent." },
  "lantern.free":      { t: "int", env: "LANTERN_FREE_PER_DAY", def: 6, min: 0, max: 100, pub: true,
                         g: "The Lantern", n: "Questions a day · a reader",
                         h: "Counted per device and per address, whichever runs out first." },
  "lantern.keyed":     { t: "int", env: "LANTERN_KEYED_PER_DAY", def: 30, min: 0, max: 500, pub: true,
                         g: "The Lantern", n: "Questions a day · a licensed masjid",
                         h: "Applies to anyone holding a licence key." },
  "lantern.paid":      { t: "bool", env: "ALLOW_PAID_MODELS", envTrue: "1", def: false,
                         g: "The Lantern", n: "May fall back to paid models",
                         h: "Off keeps every request on the free chain. On means a busy day can bill you." },

  /* ---- reading aids -------------------------------------------------- */
  "guide.on":          { t: "bool", env: "GUIDE_PUBLIC", envTrue: "1", def: false, pub: true,
                         g: "Reading aids", n: "The per-passage Guide",
                         h: "Lets a reader ask about the passage in front of them. Uses the same key as the Lantern." },
  "light.ai":          { t: "bool", def: true, pub: true,
                         g: "Reading aids", n: "Today's Light may be written fresh",
                         h: "Off serves only the curated treasury, which never invents and never costs anything." },

  /* ---- the house ----------------------------------------------------- */
  "jumuah.mode":       { t: "enum", def: "auto", opts: ["auto", "on", "off"], pub: true,
                         g: "The house", n: "The Jumu'ah banner",
                         h: "Auto shows it from Thursday evening to Friday evening. On and off are for testing." },
  "sponsor.band":      { t: "bool", def: true, pub: true,
                         g: "The house", n: "The Guardians band",
                         h: "The quiet single line a sponsor is shown on." },
  "notice.text":       { t: "text", def: "", max: 160, pub: true,
                         g: "The house", n: "A notice across the top",
                         h: "Plain text only, 160 characters. Empty means no notice. For an outage or a closure, not for marketing." },

  /* ---- traffic ------------------------------------------------------- */
  "traffic.duration": { t: "bool", def: true,
                         g: "Traffic", n: "Measure how long visits last",
                         h: "Aggregate seconds only, no identifier travels with them. Off stops collection on the next request." },

  /* ---- the ledger ----------------------------------------------------
     A floor, not a share. Below this figure the work cannot become the
     keeper's occupation; above it, what is left is meant to leave. Zakat is
     never affected by this number, because a due is not a remainder.
     The figure itself is private: it is set here in the console or in the
     LEDGER_FLOOR variable, and the code carries no default but zero, so the
     repository never states what the household lives on. */
  "ledger.floor": { t: "num", env: "LEDGER_FLOOR", def: 0, min: 0, max: 1000000,
                    g: "The Ledger", n: "Household floor each month",
                    h: "In whole units of your currency. The private ledger counts this per month elapsed since the first gift arrived, and treats everything above it as onward giving. Never shown to a reader, never written in the repository: zero until you set it." },

  /* ---- the journal ---------------------------------------------------
     Three switches rather than one, because a section can go wrong in three
     different ways and the owner should be able to answer each of them
     without silencing the others. The whole point of the section is that it
     must never put the rest of the Codex at risk. */
  "journal.on":      { t: "bool", def: true, pub: true,
                       g: "The Journal", n: "The journal is open",
                       h: "Off hides /journal from readers entirely and stops serving every entry. The Codex is unaffected. Use this if the section ever becomes a liability." },
  "journal.replies": { t: "bool", def: true, pub: true,
                       g: "The Journal", n: "Readers may reply",
                       h: "Off keeps the entries readable but closes the reply form and hides the replies already there. Nothing is deleted." },
  "journal.triage":  { t: "bool", def: true,
                       g: "The Journal", n: "The Lantern sorts replies monthly",
                       h: "Once a month the Lantern scores approved replies for usefulness and relevance so the most substantial rise and the noise sinks. Readers' own votes are weighed alongside it. Off leaves replies in the order they arrived." },

  /* ---- the social machine -------------------------------------------
     The house posts the day's light to Facebook and Instagram once a morning.
     Nothing here writes a fact: the card comes from the validated library, so
     the worst that can happen is a caption phrased badly. The schedule is OFF
     until the owner has previewed a post and sent one by hand. */
  "social.mode":       { t: "enum", def: "off", opts: ["off", "approve", "auto"],
                         g: "The social machine", n: "How the day's post goes out",
                         h: "off: nothing is ever sent on a schedule, and you can still post by hand from this room. approve: every morning it writes the post and leaves it in the queue for you, and nothing reaches a network until you press Post. auto: it posts once a morning with nobody in the loop. Climb one rung at a time. Sit on approve for a fortnight and read what the feed actually looks like before you trust auto, because the two network calls have never been run against your live accounts." },
  "social.stories":    { t: "bool", def: true,
                         g: "The social machine", n: "Also post each thing as a story",
                         h: "Every reel and every card that lands on Facebook or Instagram is posted there a second time as a story: a surface followers open without scrolling, gone in a day, never in the grid. Off means the feed post only." },
  "social.fb":         { t: "bool", def: true,
                         g: "The social machine", n: "Send to Facebook",
                         h: "Needs FB_PAGE_ID and FB_PAGE_TOKEN in Vercel. Posts the card as a photo with the caption underneath." },
  "social.ig":         { t: "bool", def: true,
                         g: "The social machine", n: "Send to Instagram",
                         h: "Needs IG_USER_ID and a token. Instagram will only accept a real JPEG or PNG at a public address, which is what /api/card?fmt=png serves." },
  "social.polish":     { t: "bool", def: true,
                         g: "The social machine", n: "Let the Lantern tighten the caption",
                         h: "It may reorder and shorten words. It may not add a fact: any number it introduces that the card did not contain causes the plain caption to be used instead. It is never asked at all about a card carrying a Qur'an or hadith citation, because a model can change the sense of a sentence without touching a number. Off writes every caption straight from the card." },

  /* ---- the night shift ----------------------------------------------
     The Lantern's background work. Every job here reads material the house
     has already published and files a finding; none of them may edit,
     publish or delete anything. See api/_nightshift.js. */
  "nightshift.on":     { t: "bool", def: true,
                         g: "The night shift", n: "The Lantern works while you sleep",
                         h: "Off stops all of the background jobs below at once. Nothing on the site changes either way: every job files a finding for you to read and none of them can edit a page." },
  "nightshift.audit":  { t: "int", def: 12, min: 0, max: 60,
                         g: "The night shift", n: "Passages checked a night",
                         h: "It reads that many published passages, in order, and says which ones an editor should look at again. Twelve a night walks the whole library about three times a year. Zero switches the audit off. Each passage is one call on the free chain." },
  "nightshift.triage": { t: "bool", def: true,
                         g: "The night shift", n: "Sort the inbox",
                         h: "Puts a kind and a one line gist on every unread message, so a correction about a citation never sits behind forty messages of thanks. It never replies, publishes or deletes. Capped at twenty messages a night." },

  /* ---- the desk ------------------------------------------------------ */
  "inbox.open":        { t: "bool", def: true, pub: true,
                         g: "The desk", n: "Readers may send corrections",
                         h: "Off closes the form and says so politely." },
  "marketing.daily":   { t: "int", env: "MARKETING_PER_DAY", def: 10, min: 0, max: 60,
                         g: "The desk", n: "Drafts written a day",
                         h: "The pipeline stops at this many, so a runaway loop cannot spend the whole month." },
  "marketing.paid":    { t: "bool", def: false,
                         g: "The desk", n: "Marketing may use a stronger paid model",
                         h: "On lets outreach drafts use a low-cost paid model through your OpenRouter key when the free chain writes poorly. Off keeps every draft free." },
};

function envDefault(d) {
  if (!d.env) return d.def;
  const raw = process.env[d.env];
  if (raw === undefined || raw === "") return d.def;
  if (d.t === "bool") return d.envTrue ? raw === d.envTrue : raw === "1" || raw === "true";
  if (d.t === "int") { const n = parseInt(raw, 10); return Number.isFinite(n) ? n : d.def; }
  if (d.t === "num") {
    const n = parseFloat(String(raw).replace(/[\s,]/g, ""));
    return Number.isFinite(n) && n >= (d.min ?? 0) ? Math.min(d.max ?? 1e9, n) : d.def;
  }
  return raw;
}

function coerce(d, v) {
  if (v === null || v === undefined) return null;
  if (d.t === "bool") return v === true || v === "1" || v === "true";
  if (d.t === "int") {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return null;
    return Math.max(d.min ?? 0, Math.min(d.max ?? 1e9, n));
  }
  /* "num" was declared on ledger.floor and never handled here, so the one
     figure in the house that decides what counts as onward giving fell to the
     `return null` at the bottom of this function and could not be saved from
     the console at all. It read as its built-in default and stayed there,
     silently, however many times it was set. */
  if (d.t === "num") {
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[\s,]/g, ""));
    if (!Number.isFinite(n)) return null;
    return Math.max(d.min ?? 0, Math.min(d.max ?? 1e9, n));
  }
  if (d.t === "enum") return d.opts.includes(String(v)) ? String(v) : null;
  if (d.t === "text") {
    /* a notice is prose the whole site will show, so it may not smuggle
       markup, a link, or a script in through this door */
    let s = String(v).replace(/[<>{}]/g, "").replace(/\s+/g, " ").trim();
    if (/https?:|script|javascript:/i.test(s)) return null;
    return s.slice(0, d.max || 200);
  }
  return null;
}

let cache = { at: 0, val: null };
async function readStore() {
  if (cache.val && Date.now() - cache.at < 8000) return cache.val;
  if (!(await kvReady())) return null;
  try {
    const [raw] = await kv([["GET", KEY]]);
    const val = raw ? JSON.parse(raw) : {};
    cache = { at: Date.now(), val };
    return val;
  } catch { return null; }
}

/* What is actually in force right now, for any other endpoint to ask. */
export async function settings() {
  const saved = (await readStore()) || {};
  const out = {};
  for (const [k, d] of Object.entries(DIALS)) {
    out[k] = Object.prototype.hasOwnProperty.call(saved, k) ? saved[k] : envDefault(d);
  }
  return out;
}

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

export default async function handler(req, res) {
  const SECRET = process.env.ADMIN_SECRET;
  const owner = SECRET && verify(req.headers.cookie, SECRET);

  if (req.method === "GET") {
    const now = await settings();
    if (!(req.query && req.query.all === "1")) {
      /* the public site sees only the dials that change what a reader sees */
      const pub = {};
      for (const [k, d] of Object.entries(DIALS)) if (d.pub) pub[k] = now[k];
      res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
      return res.status(200).json({ s: pub });
    }
    if (!owner) return res.status(401).json({ error: "locked" });
    const saved = (await readStore()) || {};
    const store = await kvReady();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      store,
      dials: Object.entries(DIALS).map(([k, d]) => ({
        k, g: d.g, n: d.n, h: d.h, t: d.t, opts: d.opts, min: d.min, max: d.max,
        value: now[k],
        def: envDefault(d),
        /* saying where a value comes from is the difference between a
           control panel and a wall of switches nobody trusts */
        src: Object.prototype.hasOwnProperty.call(saved, k) ? "set here"
             : (d.env && process.env[d.env] !== undefined && process.env[d.env] !== "") ? ("env " + d.env)
             : "built in",
      })),
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "GET or POST" });
  if (!SECRET) return res.status(501).json({ error: "admin not configured" });
  if (!owner) return res.status(401).json({ error: "locked" });
  if (!(await kvReady()))
    return res.status(501).json({ error: "no store configured, so nothing can be saved. Set REDIS_URL." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  /* TWO CALLERS, TWO SHAPES.

     The Dials screen posts the keys flat, which is what the header of this
     file documents. The Social ladder posts { set: { "social.mode": "auto" } }.
     Only the flat shape was ever handled -- and the wrapped one did not fail,
     it fell straight through the loop below, because DIALS["set"] is not a
     dial, so `continue` ran once and the request saved nothing and answered
     ok:true with an empty list. The owner pressed Full auto, was told it had
     worked, and watched the ladder snap back to Off on the next read. Both
     shapes are this endpoint's own callers, so both are accepted. */
  if (body.set && typeof body.set === "object" && !Array.isArray(body.set)) body = body.set;

  const saved = (await readStore()) || {};
  const changed = [], refused = [];
  for (const [k, v] of Object.entries(body)) {
    const d = DIALS[k];
    if (!d) { refused.push(k + " is not a dial"); continue; }
    if (v === null) { if (k in saved) { delete saved[k]; changed.push(k + " → default"); } continue; }
    const c = coerce(d, v);
    if (c === null) { refused.push(k + ": " + JSON.stringify(v) + " is not a value this dial takes"); continue; }
    if (saved[k] !== c) { saved[k] = c; changed.push(k + " = " + c); }
  }

  /* A request that named dials and moved none of them, because every one of
     them was refused, is a failure. Answering 200 ok:true to it is exactly
     what hid the bug above for as long as it hid: the console had no way to
     tell a save from a silent no-op. Setting a dial to the value it already
     holds is NOT that, and stays a 200. */
  if (refused.length && !changed.length)
    return res.status(400).json({ ok: false, error: "nothing was saved", refused });
  try {
    await kv([["SET", KEY, JSON.stringify(saved)]]);
    cache = { at: 0, val: null };
  } catch {
    return res.status(502).json({ error: "the store refused the write" });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: true, changed, refused, count: changed.length });
}
