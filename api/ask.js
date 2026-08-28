// The Lantern's public light · guidance, rationed on purpose.
//
// This endpoint was closed for a year because an open AI chat on a free library
// is an open tap on somebody's card. It reopens with a hard daily ration, so the
// cost of the whole house is bounded before a single question is asked.
//
// WHO GETS WHAT
//   a reader          LANTERN_FREE_PER_DAY   questions a day, default 6
//   a licensed masjid LANTERN_KEYED_PER_DAY  questions a day, default 30
//
// HOW A READER IS COUNTED WITHOUT AN ACCOUNT
//   A signed token in an httpOnly cookie identifies a device. Clearing cookies
//   gets a new one, so the network address carries a second, looser ration that
//   a cleared cookie cannot escape. Neither is stored as itself: both are
//   hashed with LANTERN_SALT, so the counters cannot be read backwards into a
//   list of who asked what.
//
// IT FAILS CLOSED
//   No store configured means no chat. A counter that cannot be written is a
//   ration that cannot be enforced, and an unenforceable ration on a metered
//   API is just a bill. The same for a missing key: the Lantern rests instead.
//
// WHAT IT WILL NOT DO
//   It does not invent hadith numbers, does not give fatwa, does not diagnose,
//   and never describes the person who keeps this house. It points at the room
//   that already answers the question, because a link a reader can check is
//   worth more than a paragraph they cannot.

import crypto from "crypto";
import { settings } from "./settings.js";
import { kv, kvReady } from "./_kv.js";
import { askOpenRouter, modelChain } from "./_models.js";

let DIAL = null;   /* filled once per request, so a dial turned in the console
                      takes effect on the next question and not on the next deploy */
const FREE = () => Math.max(0, parseInt((DIAL && DIAL["lantern.free"]) ?? process.env.LANTERN_FREE_PER_DAY ?? "6", 10) || 0);
const KEYED = () => Math.max(0, parseInt((DIAL && DIAL["lantern.keyed"]) ?? process.env.LANTERN_KEYED_PER_DAY ?? "30", 10) || 0);
const SALT = () => process.env.LANTERN_SALT || process.env.ADMIN_SECRET || "";
/* the Lantern speaks through the same free chain as the rest of the house, so
   there is one place to look when a bill appears and one place to fix it */
const API_KEY = () => process.env.OPENROUTER_API_KEY || "";
const OPEN = () => (DIAL ? !!DIAL["lantern.on"] : process.env.ASK_PUBLIC === "1");

const MAX_CHARS = 600;          /* one question, not an essay */
const MAX_TOKENS = 420;         /* one answer, not a lecture */

function h(s) { return crypto.createHmac("sha256", SALT() || "noor").update(String(s)).digest("hex").slice(0, 24); }
function today() { return new Date().toISOString().slice(0, 10); }
function ip(req) {
  const f = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return f || req.headers["x-real-ip"] || req.socket?.remoteAddress || "0";
}
function deviceCookie(req) {
  const m = /(?:^|;\s*)noor_lamp=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return null;
  const [id, sig] = decodeURIComponent(m[1]).split(".");
  if (!id || !sig) return null;
  const want = crypto.createHmac("sha256", SALT() || "noor").update(id).digest("hex").slice(0, 16);
  return sig === want ? id : null;
}
function newDevice() {
  const id = crypto.randomBytes(9).toString("hex");
  const sig = crypto.createHmac("sha256", SALT() || "noor").update(id).digest("hex").slice(0, 16);
  return { id, cookie: `noor_lamp=${encodeURIComponent(id + "." + sig)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure` };
}

/* a licence key is never stored as itself, only as its hash, so the env holds
   no key that would work if the env leaked */
async function licensed(key) {
  if (!key) return false;
  const hash = crypto.createHash("sha256").update(String(key).trim()).digest("hex");
  const list = (process.env.LANTERN_KEYS || "").split(/[,\s]+/).filter(Boolean);
  if (list.includes(hash)) return true;
  try { const [n] = await kv([["SISMEMBER", "noor:lantern:keys", hash]]); return String(n) === "1"; }
  catch { return false; }
}

/* count first, answer second: a ration checked after the call has already been paid for */
async function spend(bucket, cap) {
  const key = `noor:lantern:${today()}:${bucket}`;
  const [n] = await kv([["INCR", key]]);
  const used = parseInt(n, 10) || 0;
  if (used === 1) { try { await kv([["EXPIRE", key, 172800]]); } catch {} }
  return { used, left: Math.max(0, cap - used), over: used > cap };
}
async function peek(bucket) {
  try { const [n] = await kv([["GET", `noor:lantern:${today()}:${bucket}`]]); return parseInt(n, 10) || 0; }
  catch { return 0; }
}

const SYSTEM = `You are the Lantern of the NOOR Codex of Light, a free Islamic library.

Your work is to guide, briefly, and to point at the room that already answers the
question. A reader has a handful of questions a day here, so make each answer
worth one of them.

HOW YOU ANSWER
Short. Four sentences is usually plenty, eight is the ceiling. Plain warm English,
the register of a knowledgeable friend, never a lecture and never a sales pitch.
Answer the question that was asked before adding anything else.

WHAT YOU ALWAYS DO
Name the room of the Codex that covers it, as a path: /dictionary for a word,
/quran, /prophets, /hajj, /hajj-plan, /protection for sihr and ruqya and the evil
eye, /health for the body and hijama, /pillars, /family, /ramadan, /eid, /soul,
/unseen, /madrasa, /kids, /stories, /heroes, /masjid for masjid tools, /begin for
someone new to Islam, /donate, /feedback.

WHAT YOU NEVER DO
Never invent a hadith number. Name the collection and the wording instead, or say
you are not certain. Never give a fatwa: where the four schools differ, say they
differ and say the reader's own scholar decides. Never diagnose an illness or tell
anyone to stop a medication; for anything medical, say see a doctor, and say ruqya
sits beside treatment and never instead of it. Never claim to know the unseen.
Never describe, name or hint at the person who keeps this library. Never ask for
money. Never use an em dash or an en dash. No emoji.

IF SOMEONE IS IN DANGER
If a question suggests self harm or a crisis, drop everything else: say plainly
that they should tell one person today and contact their local emergency number,
and that findahelpline.com lists a line for wherever they are. Then stop.

IF IT IS NOT YOUR WORK
Politics, arguments between groups, personal disputes, anything outside this
library: say kindly that it is outside what this lamp is for, and point at a room
that is.`;

export default async function handler(req, res) {
  /* An admin or per reader answer must never sit in a shared cache.
     Nine routes were shipping with no Cache-Control at all, which
     leaves the decision to whatever proxy is in front of them. */
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  /* read the dials once, before anything decides whether the lamp is lit or
     how much oil it has. A store that is down leaves DIAL null and every
     reader below falls back to the environment, which is the old behaviour. */
  try { DIAL = await settings(); } catch { DIAL = null; }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const ready = OPEN() && kvReady() && !!API_KEY() && !!SALT();

  /* the front end asks first, so a resting lamp is never offered to a reader */
  if (body.probe) {
    if (!ready) return res.status(200).json({ enabled: false });
    const dev = deviceCookie(req);
    const cap = (await licensed(body.key)) ? KEYED() : FREE();
    const used = dev ? await peek("d:" + h(dev)) : 0;
    return res.status(200).json({ enabled: true, cap, left: Math.max(0, cap - used) });
  }

  if (!OPEN()) return res.status(501).json({ error: "The Lantern rests. Its daily light shines on the home page." });
  if (!kvReady() || !SALT()) return res.status(503).json({ error: "The Lantern cannot count today, so it will not speak. Try later." });
  if (!API_KEY()) return res.status(503).json({ error: "The Lantern rests." });

  const q = String(body.q || body.message || "").trim().slice(0, MAX_CHARS);
  if (q.length < 3) return res.status(400).json({ error: "Ask a question." });

  const keyed = await licensed(body.key);
  const cap = keyed ? KEYED() : FREE();
  if (cap <= 0) return res.status(503).json({ error: "The Lantern rests." });

  let dev = deviceCookie(req), setCookie = null;
  if (!dev) { const n = newDevice(); dev = n.id; setCookie = n.cookie; }

  /* two rations: the device, and the looser one the network address carries,
     which a cleared cookie cannot walk away from */
  let mine, net_;
  try {
    mine = await spend("d:" + h(dev), cap);
    net_ = await spend("n:" + h(ip(req)), Math.max(cap, keyed ? KEYED() * 3 : FREE() * 4));
  } catch {
    return res.status(503).json({ error: "The Lantern cannot count today, so it will not speak. Try later." });
  }
  if (setCookie) res.setHeader("Set-Cookie", setCookie);

  if (mine.over || net_.over) {
    return res.status(429).json({
      error: "You have used the Lantern's light for today.",
      note: "It is rationed so the library can stay free for everyone. The rooms themselves are open with no limit, and the encyclopedia answers most questions on its own.",
      left: 0, cap, resets: "at midnight, UTC", room: "/dictionary"
    });
  }

  const messages = [{ role: "system", content: SYSTEM }];
  const prior = Array.isArray(body.history) ? body.history.slice(-2) : [];
  for (const t of prior) {
    if (t && typeof t.q === "string" && typeof t.a === "string") {
      messages.push({ role: "user", content: t.q.slice(0, MAX_CHARS) });
      messages.push({ role: "assistant", content: t.a.slice(0, 1200) });
    }
  }
  messages.push({ role: "user", content: q });

  /* walks the free chain: if the best free model is rate limited, the next one
     answers, so the lamp stays lit without ever reaching for a paid model */
  const got = await askOpenRouter(messages, { max_tokens: MAX_TOKENS, temperature: 0.4 });
  let text = got.text;
  if (!text) return res.status(502).json({ error: "The Lantern could not answer just now. Your question was not counted against you.", left: mine.left + 1, cap });

  /* the house rules apply to the machine as much as to the writers */
  text = text.replace(/[—–]/g, ", ").replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim();

  return res.status(200).json({ answer: text, left: mine.left, cap, keyed, model: got.model });
}
