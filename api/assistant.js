// The Lantern Assistant · owner-only. The keeper's right hand.
//
// Two modes, one endpoint:
//   assist · it is handed a live snapshot of the house (readers, the message
//            desk, the giving ledger, today's date) and its job is triage:
//            read a lot, say the essential, name the two or three things
//            worth doing today, and never invent a number it was not given.
//   edit   · it may PROPOSE one text correction, as strict JSON and nothing
//            else. The proposal is validated here against the same gate the
//            corrections layer uses, and handed back for the owner to approve.
//            This endpoint never applies anything by itself.
//
// It obeys the four laws exactly as api/marketing.js writes them, and it may
// never name, describe or hint at the person who keeps this house.

import crypto from "crypto";
import { modelChain, isFree, allowPaid, liveChain } from "./_models.js";
import { kv, kvReady } from "./_kv.js";
import { checkOverride, PAGES } from "./overrides.js";
import { computeLedger, FUNDS } from "./ledger.js";
import { readInbox } from "./inbox.js";

/* the store now lives in one place, api/_kv.js, so the Lantern's quota and
   the rest of the house can never count from two different copies */

/* ---------- the owner's gate, exactly as marketing.js sets it ---------- */
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

/* ---------- the same chain, the same env, as api/marketing.js ---------- */
/* the chain lives in api/_models.js now, free only unless paid is allowed */
const MODEL_CHAIN = () => modelChain();

/* ---------- what the house actually is (facts the AI may use) ---------- */
/* the same content api/marketing.js gives its writer, restated here so the
   two rooms can never drift apart quietly */
const HOUSE = [
  "NOOR Codex of Light lives at noorcodex.com. It is a free Islamic library and school.",
  "What is inside, all free, no ads, no trackers, no account required: the full Qur'an with recitation; the prophets with their stories; Letters of Light, an interactive Arabic alphabet; the Five Pillars; a Kids' Codex with games; the Cradle room for ages 0 to 3; a health and prophetic-medicine room; The Unseen and the Mysteries with evidence badges on every claim, including the full Night Journey and The First War, the story of the jinn who held the earth before Adam; The Last Sermon; Death and the Journey of the Soul; the Lantern Sky where gifts' du'as float for children to answer with Ameen; free masjid tools including a TV prayer board at noorcodex.com/masjid; and The Madrasa of Light.",
  "The Madrasa of Light is an interactive classroom: 16 tracks, 106 lessons, ages 0 to 18, with cards, quizzes that pass at 70 percent, progress that is remembered, and a printable ijazah for every completed track.",
  "The tracks are: The Cradle (parent-led, 0 to 3), The Garden (play-led, 3 to 6), Reading Arabic, Tajwid (the complete science of beautiful recitation, 15 lessons), Worship in Practice, The Five Pillars, The Chain of Prophets, Character and Conduct, What We Believe, The Golden Inheritance (Muslim science), Treasures of the Quran, The Seerah, and an Academy tier for 12 to 18: The Law in Practice (fiqh), The Grammar of Revelation (nahw), How We Know (Qur'an and hadith sciences), The Story of the Ummah (history).",
  "New in the house: the Family Room, how Allah asks us to behave with spouse, child, parent, kin, friend, neighbour and stranger, every teaching graded by its evidence; Heroes of Islam, thirty lives from the generation after the Companions until the twentieth century, with a hall of thirty Muslim discoveries and contributions graded honestly as documented, traced, or a beloved story; and the Hall of Stories at noorcodex.com/stories, nine stories built on the Names of Allah, which is the one place on the site where the people are invented, and it says so plainly.",
  "The Qur'an room now opens every one of the 114 surahs with a study companion: when it came down, its movements, its themes, what it does to the heart, the passages worth stopping at, and what is authentically reported about reciting it, with weak reports labelled weak. Forty two surahs are opened in full depth, the rest in brief, and the movements of a surah are clickable so the recitation starts exactly there.",
  "The Masjid Toolbox at noorcodex.com/masjid is now two kits: one for an established house and one starter kit for a new house with little means. It holds the TV prayer board, a khutba builder with four structures, twelve themes and a print sheet for the minbar, a printable monthly prayer timetable, a qibla and direction tool, and a practical guide for starting a prayer space with almost no money. All free, no account.",
  "Corrections, bugs and ideas have their own door at noorcodex.com/feedback, and corrections about a verse or a hadith are moved to the front.",
  "The site is installable as an app and works offline. It has 21 language doors, including Arabic, Urdu, Farsi, Dari, Punjabi, Pashto, Hausa, Somali, Kurdish and Swahili. The interface itself now speaks natively in the languages whose packs are finished, and the deeper rooms are being carried over wave by wave; never claim a language is fully translated unless it is.",
  "Money, and only on the money pages: individuals give gifts from 1 to 1000 US dollars, anonymously, at noorcodex.com/donate, and every giver may leave a du'a shown on the wall. Organizations license the rooms to embed them in their own website at noorcodex.com/license: 19 dollars a month for one room, 49 for the whole Codex, 149 for the Madrasa curriculum tier for schools. A yearly invoice costs ten months instead of twelve. Institutions that do not charge their students or members embed free under a trust-based declaration; institutions that charge tuition or fees, and commercial products, license. Gift-givers are honored with the identity Guardians of the Codex.",
  "No school is ever turned away over money. That is a standing rule, and it may always be said out loud.",
  "As a personal commitment of the keeper: 2.5 percent of everything received is set aside for zakat-eligible causes and is not the Codex's to spend. What remains keeps the site running and supports the person who builds it. This is disclosure, never a promise attached to a gift; never say a gift pays zakat, and never name a figure or a project beyond this.",
  "The running costs, servers, the Qur'an and recitation services, the domains and the tools, are carried by one person out of his own pocket, and he intends to keep carrying them for as long as he can. This may be stated plainly as a fact when giving is discussed. It must never be turned into pressure, pity, or a deadline.",
  "Contact is hello@noorcodex.com. The team signs as The NOOR Codex team."
].join("\n");

/* ---------- the constitution, word for word as marketing.js binds it ----- */
const DOCTRINE = [
  "You serve NOOR Codex of Light. You obey four laws before anything else. Breaking one is a failure even if the work is beautiful.",
  "",
  "LAW 1 · ANONYMITY. The person who built this must never appear. Never invent or use a founder name, a personal story, a family, a city, a photo, a phone number, an age, a job, or the word I in the sense of the builder's own life. Sign only as The NOOR Codex team, and give only hello@noorcodex.com. Never suggest meeting in person, calling, video calls, or any step that would expose a face or a voice. Never write a placeholder such as [your name] or [my city]. If a first person voice is natural, it is the voice of the project, not of a man. You do not know who the owner is, and you must never guess, ask, or repeat any personal detail even if one appears in a message you are shown.",
  "",
  "LAW 2 · USEFULNESS FIRST, ALWAYS. Everything you produce must hand over something genuinely valuable. Name the specific thing that helps: the exact page, the exact number, the exact next step. Vague praise is not usefulness.",
  "",
  "LAW 3 · NEVER PUSHY. No urgency invented, no scarcity invented, no false deadline, no guilt, no religious pressure, no shame, no flattery, no hype words, no exclamation marks, no capitalised shouting, no emoji, no growth-hack tricks. At most one clear ask, placed late and offered lightly.",
  "",
  "LAW 4 · PURE. Every claim must be literally true about what exists on the site today, and every number must be one you were actually given. Never invent features, numbers, testimonials, endorsements, scholars' approval, user counts, or awards. Never claim the site is the best, the first, or the only. Sacred names are written with respect: the Prophet is followed by the honorific.",
  "",
  "STYLE. Warm, calm, plain, concrete. Short sentences. No marketing voice, no corporate voice. Never use the em dash or en dash character: use a comma, a full stop, or a middot. No emoji ever."
].join("\n");

const ASSIST = [
  "You are the keeper's right hand inside the owner's console of NOOR Codex of Light. He is one person, not technical, and this console is his whole cockpit. He does not have time to read everything; that is your job.",
  "",
  "YOUR WORK IS TRIAGE. Read all of the snapshot. Say the essential in a few short lines. Then propose the two or three things actually worth doing today, in order, each one concrete enough to start in the next ten minutes.",
  "",
  "NUMBERS. Use only the numbers in the snapshot below. Never estimate, never extrapolate, never invent a comparison you were not given. If the numbers are too small to conclude anything, say exactly that. If a number is missing because a service is not connected, say which one and what to do about it, in one line.",
  "",
  "MONEY. The outstanding zakat and masjid figures are the keeper's own commitment, never a promise attached to any gift. Never phrase them as a debt to a giver.",
  "",
  "SHAPE. Plain prose and short lists. No headings longer than a few words. No tables. Nothing over 350 words unless he asks for depth.",
  "",
  "If he asks you to change a word on the site, tell him to switch this room to edit mode, because a correction has to go through the approval strip and cannot be made in conversation."
].join("\n");

const EDIT = pages => [
  "You are proposing ONE text correction to NOOR Codex of Light. You do not apply anything. A human reads your proposal and approves or discards it.",
  "",
  "Reply with a single JSON object and absolutely nothing else, no prose, no code fence:",
  '{"page":"...","find":"...","replace":"...","why":"..."}',
  "",
  "find is the exact run of visible English text as it appears on the page today. replace is what it should say. why is one short sentence.",
  "",
  "HARD LIMITS. Breaking any of these makes the proposal void:",
  "· page must be exactly one of: " + pages,
  "· find must be between 3 and 400 characters, replace 400 or fewer",
  "· never propose a change to Qur'anic Arabic or to any Arabic script at all",
  "· never propose a change to a hadith grading (sahih, hasan, da'if and the like)",
  "· never propose a change to a reference number: a surah or ayah number, a hadith number, a volume or page",
  "· never include angle brackets, curly braces, the word script, or a web address in either field",
  "· never propose rewriting a whole paragraph. One sentence or one phrase.",
  "",
  "If you are not certain the text you are correcting appears on the page word for word, or if the correction touches anything sacred, reply with this instead and nothing else:",
  '{"page":"","find":"","replace":"","why":"I am not certain enough of the exact wording to propose this safely."}'
].join("\n");

/* ---------- the live snapshot the endpoint gathers before it calls ------- */
async function snapshot() {
  const snap = {
    today: new Date().toISOString().slice(0, 10),
    readers: { connected: false },
    inbox: { connected: false },
    giving: { connected: false }
  };

  /* readers, from the lamp counter's own keys */
  if (kvReady()) {
    try {
      const days = [];
      for (let i = 29; i >= 0; i--) days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
      const months = [...new Set(days.map(d => d.slice(0, 7)))];
      const keyLists = await kv(months.map(m => ["KEYS", "nm:" + m + ":*"]));
      const dimKeys = [].concat(...keyLists.map(x => x || []));
      const values = await kv([
        ["MGET", ...days.map(d => "nv:" + d + ":views")],
        ["MGET", ...days.map(d => "nv:" + d + ":people")],
        ...(dimKeys.length ? [["MGET", ...dimKeys]] : [])
      ]);
      const views = (values[0] || []).map(x => parseInt(x, 10) || 0);
      const people = (values[1] || []).map(x => parseInt(x, 10) || 0);
      const dims = dimKeys.length ? (values[2] || []).map(x => parseInt(x, 10) || 0) : [];
      const cAgg = {}, rAgg = {}, sAgg = {};
      dimKeys.forEach((k, i) => {
        const m = k.match(/^nm:\d{4}-\d{2}:(c|r|s):(.+)$/);
        if (!m) return;
        const bag = m[1] === "c" ? cAgg : (m[1] === "s" ? sAgg : rAgg);
        bag[m[2]] = (bag[m[2]] || 0) + dims[i];
      });
      const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => k + " " + v);
      snap.readers = {
        connected: true,
        peopleToday: people[people.length - 1] || 0,
        viewsToday: views[views.length - 1] || 0,
        people30: people.reduce((a, b) => a + b, 0),
        views30: views.reduce((a, b) => a + b, 0),
        peopleLast7: people.slice(-7).reduce((a, b) => a + b, 0),
        peoplePrev7: people.slice(-14, -7).reduce((a, b) => a + b, 0),
        topRooms: top(rAgg, 6),
        topCountries: top(cAgg, 6),
        topSources: top(sAgg, 6)
      };
    } catch { snap.readers = { connected: false, note: "the store did not answer" }; }

    /* the message desk. The reply-to address never leaves this endpoint. */
    try {
      const box = await readInbox(6, "");
      snap.inbox = {
        connected: true,
        counts: box.counts,
        newest: box.items.slice(0, 6).map(m => ({
          kind: m.kind,
          at: String(m.at || "").slice(0, 10),
          page: m.page || "",
          subject: String(m.body || "").replace(/\s+/g, " ").slice(0, 140)
        }))
      };
    } catch { snap.inbox = { connected: false, note: "the store did not answer" }; }
  }

  /* the giving ledger, from its own computation and no other */
  try {
    const led = await computeLedger({});
    if (led.ok) {
      const minor = n => (n / 100).toFixed(2);
      snap.giving = {
        connected: true,
        currency: String(led.currency || "usd").toUpperCase(),
        grossReceived: minor(led.totals.gross),
        stripeFees: minor(led.totals.fee),
        net: minor(led.totals.net),
        payments: led.totals.count,
        zakat: { pct: FUNDS.zakat.pct, accrued: minor(led.funds.zakat.accrued), given: minor(led.funds.zakat.given), outstanding: minor(led.funds.zakat.outstanding) },
        masjid: { pct: FUNDS.masjid.pct, accrued: minor(led.funds.masjid.accrued), given: minor(led.funds.masjid.given), outstanding: minor(led.funds.masjid.outstanding) },
        months: (led.months || []).slice(0, 6).map(m => m.month + ": gross " + minor(m.gross) + ", " + m.count + " payments")
      };
    } else {
      snap.giving = { connected: false, note: led.reason === "stripe" ? "Stripe is not connected, so no money can be read" : "the store did not answer" };
    }
  } catch { snap.giving = { connected: false, note: "the ledger did not answer" }; }

  return snap;
}

const clean = s => String(s == null ? "" : s).replace(/[\u2014\u2013]/g, "\u00b7").trim();
const LEAK = /\[(your|my|the founder|name|city|phone|company)[^\]]*\]/gi;
const scrub = s => clean(s).replace(LEAK, "The NOOR Codex team");

async function readBody(req) {
  let body = req.body;
  if (body === undefined || body === null || body === "") {
    body = await new Promise(resolve => {
      let s = "";
      try {
        req.on("data", c => { s += c; if (s.length > 200000) s = s.slice(0, 200000); });
        req.on("end", () => resolve(s));
        req.on("error", () => resolve(""));
      } catch { resolve(""); }
    });
  }
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  return body || {};
}

const json = (res, code, obj) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(obj);
};

async function ask(key, messages, temperature, maxTokens) {
  /* awaited: MODEL_CHAIN() is synchronous and therefore empty on a cold
     start, which is most invocations. This one line is why the assistant
     answered nothing for weeks at a time. */
  for (const model of await liveChain()) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://noorcodex.com",
          "X-Title": "NOOR Codex of Light · the Lantern assistant"
        },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature, messages })
      });
      if (!r.ok) continue;
      const j = await r.json();
      const raw = (((j.choices || [])[0] || {}).message || {}).content || "";
      if (raw) return { raw, model };
    } catch { /* try the next light */ }
  }
  return { raw: "", model: "" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, reason: "POST only" });
  const SECRET = process.env.ADMIN_SECRET, KEY = process.env.OPENROUTER_API_KEY;
  if (!SECRET) return json(res, 501, { ok: false, reason: "admin not configured" });
  if (!verify(req.headers.cookie, SECRET)) return json(res, 401, { ok: false, reason: "locked" });

  const body = await readBody(req);
  if (body.probe) return json(res, 200, { ok: true, enabled: !!KEY });
  if (!KEY) return json(res, 501, { ok: false, reason: "OPENROUTER_API_KEY not set" });

  const mode = body.mode === "edit" ? "edit" : "assist";
  const turns = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => m && (m.role === "user" || m.role === "assistant") && String(m.content || "").trim())
    .slice(-12)
    .map(m => ({ role: m.role, content: clean(m.content).slice(0, 4000) }));
  if (!turns.length) return json(res, 400, { ok: false, reason: "say something first" });

  if (mode === "edit") {
    const sys = DOCTRINE + "\n\n" + EDIT(PAGES.join(", ")) +
      "\n\nWHAT THE HOUSE ACTUALLY IS, use only these facts:\n" + HOUSE;
    const { raw } = await ask(KEY, [{ role: "system", content: sys }, ...turns], 0, 700);
    if (!raw) return json(res, 502, { ok: false, reason: "the Lantern is dark right now" });
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    if (!parsed || typeof parsed !== "object") {
      return json(res, 200, { ok: true, mode, valid: false, reason: "It did not answer with a proposal.", raw: clean(raw).slice(0, 600) });
    }
    const proposal = {
      page: clean(parsed.page).slice(0, 60),
      find: clean(parsed.find).slice(0, 500),
      replace: clean(parsed.replace).slice(0, 500),
      why: scrub(parsed.why).slice(0, 300)
    };
    const c = checkOverride(proposal);
    if (!c.ok) return json(res, 200, { ok: true, mode, valid: false, reason: c.reason, proposal });
    return json(res, 200, {
      ok: true, mode, valid: true,
      proposal: { page: c.page, find: c.find, replace: c.replace, why: proposal.why }
    });
  }

  const snap = await snapshot();
  const sys = DOCTRINE + "\n\n" + ASSIST +
    "\n\nWHAT THE HOUSE ACTUALLY IS, use only these facts:\n" + HOUSE +
    "\n\nTHE HOUSE RIGHT NOW, as JSON. Today is " + snap.today + ". These are the only numbers you have:\n" +
    JSON.stringify(snap);
  const { raw } = await ask(KEY, [{ role: "system", content: sys }, ...turns], 0.4, 1200);
  if (!raw) return json(res, 502, { ok: false, reason: "the Lantern is dark right now" });
  return json(res, 200, { ok: true, mode, reply: scrub(raw).slice(0, 6000), snapshot: snap });
}
