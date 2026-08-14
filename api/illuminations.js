// The Lantern's illuminations · every shared, cached AI light of the Codex
// in one endpoint (Vercel's free plan allows 12 functions; this one holds
// five lights). Each kind is generated once per day (Friday: once per week)
// and CDN-cached, so all readers on earth share a handful of queries a day.
//   ?kind=light     · Today's Light (history fact, 30-day memory via ?date=)
//   ?kind=verse     · The Verse Lamp (curated ayah + reflection)
//   ?kind=thread    · The Hidden Thread (a connection between two rooms)
//   ?kind=question  · The Seeker's Question (one honest answer a day)
//   ?kind=friday    · Friday Light (weekly Jumu'ah reflection)
// Truth rules: verses and questions come from curated static lists, links
// only from a whitelist; the AI writes reflection, never scripture, and
// every kind has a hand-written fallback so no tile ever goes dark.

/* The lantern's minds: free models only. OPENROUTER_MODEL is honoured only if
   it names a free one, unless ALLOW_PAID_MODELS=1 says otherwise. See
   api/_models.js. (The reader-set model first (env OPENROUTER_MODEL,
   which now requires ALLOW_PAID_MODELS=1 to be paid), then the best free
   lights of the day, in order. First to answer wins. */
import net from "node:net";
import { modelChain, isFree, allowPaid } from "./_models.js";
import tls from "node:tls";

/* ---------- the store, whoever provides it ----------
   Reads readers' counts from either an Upstash-style REST endpoint
   (KV_REST_API_URL + KV_REST_API_TOKEN, which Vercel's KV and the
   Upstash marketplace both set) or from ANY ordinary Redis over its
   native protocol (REDIS_URL, as Redis Cloud and the rest give it),
   spoken by hand so the project needs no npm package and no build.
   This block is deliberately repeated in the two files that count,
   so a bundler can never come between the lamp and its oil. */
const REST_URL = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REST_TOK = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const CONN = () => process.env.REDIS_URL || process.env.KV_URL || process.env.REDIS_TLS_URL || "";
function restFromConn() {
  const c = CONN();
  if (!/^https?:\/\//i.test(c)) return null;
  try { const u = new URL(c); const t = u.password || u.username || REST_TOK(); return t ? { url: u.origin, token: t } : null; }
  catch { return null; }
}
function kvKind() {
  if (REST_URL() && REST_TOK()) return "rest";
  if (restFromConn()) return "rest";
  if (/^rediss?:\/\//i.test(CONN())) return "socket";
  return "none";
}
const kvReady = () => kvKind() !== "none";
async function viaRest(cmds) {
  const f = restFromConn();
  const url = (REST_URL() && REST_TOK()) ? REST_URL() : f.url;
  const token = (REST_URL() && REST_TOK()) ? REST_TOK() : f.token;
  const r = await fetch(url.replace(/\/+$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error("kv rest " + r.status);
  const j = await r.json();
  return (Array.isArray(j) ? j : []).map(x => (x && Object.prototype.hasOwnProperty.call(x, "result")) ? x.result : null);
}
function respEncode(cmd) {
  const p = cmd.map(String);
  let s = "*" + p.length + "\r\n";
  for (const a of p) s += "$" + Buffer.byteLength(a) + "\r\n" + a + "\r\n";
  return s;
}
function respParse(buf) {
  const values = []; let i = 0;
  function one() {
    if (i >= buf.length) return undefined;
    const t = buf[i], nl = buf.indexOf("\r\n", i);
    if (nl === -1) return undefined;
    const head = buf.slice(i + 1, nl);
    if (t === 43 || t === 45) { i = nl + 2; return t === 45 ? null : head.toString(); }
    if (t === 58) { i = nl + 2; return parseInt(head.toString(), 10); }
    if (t === 36) {
      const len = parseInt(head.toString(), 10);
      if (len === -1) { i = nl + 2; return null; }
      const st = nl + 2, en = st + len;
      if (buf.length < en + 2) return undefined;
      const v = buf.slice(st, en).toString(); i = en + 2; return v;
    }
    if (t === 42) {
      const n = parseInt(head.toString(), 10); i = nl + 2;
      if (n === -1) return null;
      const arr = [];
      for (let k = 0; k < n; k++) { const v = one(); if (v === undefined) return undefined; arr.push(v); }
      return arr;
    }
    i = nl + 2; return null;
  }
  for (;;) { const mark = i; const v = one(); if (v === undefined) { i = mark; break; } values.push(v); }
  return { values, rest: buf.slice(i) };
}
function viaSocket(cmds) {
  const u = new URL(CONN());
  const secure = u.protocol === "rediss:";
  const pass = decodeURIComponent(u.password || ""), user = decodeURIComponent(u.username || "");
  const db = (u.pathname || "").replace(/^\//, "");
  const pre = [];
  if (pass) pre.push(user ? ["AUTH", user, pass] : ["AUTH", pass]);
  if (db && db !== "0") pre.push(["SELECT", db]);
  const all = pre.concat(cmds);
  return new Promise((resolve, reject) => {
    let done = false;
    const opts = { host: u.hostname, port: parseInt(u.port, 10) || 6379 };
    const sock = secure ? tls.connect({ ...opts, servername: u.hostname }) : net.connect(opts);
    const finish = (e, v) => { if (done) return; done = true; try { sock.end(); } catch {} e ? reject(e) : resolve(v); };
    sock.setTimeout(6000);
    let buf = Buffer.alloc(0), got = [];
    sock.on(secure ? "secureConnect" : "connect", () => sock.write(all.map(respEncode).join("")));
    sock.on("data", d => {
      buf = Buffer.concat([buf, d]);
      const p = respParse(buf); buf = p.rest; got = got.concat(p.values);
      if (got.length >= all.length) finish(null, got.slice(pre.length));
    });
    sock.on("timeout", () => finish(new Error("kv timeout")));
    sock.on("error", e => finish(e));
    sock.on("close", () => { if (!done) finish(null, got.slice(pre.length)); });
  });
}
async function kv(cmds) {
  if (!cmds || !cmds.length) return [];
  const k = kvKind();
  if (k === "rest") return viaRest(cmds);
  if (k === "socket") return viaSocket(cmds);
  throw new Error("no store configured");
}

/* the chain lives in api/_models.js now, free only unless paid is allowed */
const MODEL_CHAIN = () => modelChain();

/* ---------- Today's Light treasury (fallback) ---------- */
const TREASURY = [
  { category: "Founders", title: "A woman founded the world's oldest university", story: "In 859 CE, Fatima al-Fihri, a Muslim woman in Fez, spent her inheritance to found al-Qarawiyyin, recognized by UNESCO and Guinness as the oldest continuously operating degree-granting university on earth. It still teaches today.", detail: "Fez, Morocco · 859 CE" },
  { category: "Optics", title: "The scientific method has a father from Basra", story: "Ibn al-Haytham's Book of Optics (c. 1021) proved vision happens when light enters the eye, built the first camera obscura experiments, and insisted every claim be tested by repeatable experiment, centuries before Europe's scientific revolution.", detail: "Ibn al-Haytham · c. 965-1040 CE" },
  { category: "Mathematics", title: "Algorithm is a man's name", story: "The word algorithm comes from al-Khwarizmi, the Baghdad scholar whose 9th-century book on completion and balancing gave the world algebra (al-jabr). Every app you touch today runs on ideas that pass through his name.", detail: "House of Wisdom, Baghdad · 9th century" },
  { category: "Medicine", title: "Europe studied a Muslim's medical book for 600 years", story: "Ibn Sina's Canon of Medicine, finished in 1025, organized the world's medical knowledge so completely that European universities used it as a core textbook into the 17th century, and it described contagion long before germ theory.", detail: "Ibn Sina (Avicenna) · 980-1037 CE" },
  { category: "Preservation", title: "A book memorized by millions, letter-perfect", story: "The Qur'an is the only book on earth memorized cover to cover by millions of living people, in its original language, across every continent. This unbroken human chain of memory has guarded its text for over 14 centuries.", detail: "From revelation to today" },
  { category: "Travel", title: "He out-traveled Marco Polo three times over", story: "Ibn Battuta left Tangier in 1325 for hajj and kept going for 29 years: some 117,000 km across Africa, Arabia, India, Southeast Asia and China, leaving one of history's greatest travel accounts, the Rihla.", detail: "Ibn Battuta · 1304-1369 CE" },
  { category: "Coffee", title: "Your morning coffee has Sufi roots", story: "Coffee spread through the world from 15th-century Yemen, where Sufis in Mocha drank qahwa to stay awake for night devotion. From their gatherings it reached Makkah, Cairo, Istanbul, and eventually every café on earth.", detail: "Yemen · 15th century" }
];
const THEMES = [
  "a Muslim scientific or medical breakthrough, classical golden age",
  "a moment from the life of a companion of the Prophet ﷺ",
  "an on-this-day event of Islamic history near this date",
  "a wonder of Islamic architecture or a sacred place",
  "a modern discovery, invention or achievement by a Muslim",
  "the story behind a word, practice or tradition of the ummah",
  "libraries, books and the preservation of knowledge in Islam"
];

/* ---------- The Verse Lamp · curated refs, rotated by day ---------- */
const VERSES = ["2:286","2:255","94:5","13:28","65:3","3:139","39:53","2:152","21:107","24:35","93:5","2:216","29:69","8:2","17:24","31:18","49:13","55:13","67:2","103:1","2:186","16:97","33:70","25:63","28:24","12:87","20:25","40:60","42:19","57:4","76:9","4:110","3:159","23:1","62:9","59:22","112:1","1:5","18:10","19:96"];
const VERSE_FALLBACK = { ref: "2:286", reflection: "Allah does not burden a soul beyond what it can carry. Whatever today weighs, the verse is a scale in your favor: the load was measured by the One who made your shoulders. Read it slowly, then stand up again.", theme: "capacity" };

/* ---------- The Hidden Thread · whitelisted doors ---------- */
const DOORS = {
  quran: "/quran", prophets: "/prophets", musa: "/prophets#musa", yusuf: "/prophets#yusuf", nuh: "/prophets#nuh",
  ibrahim: "/prophets#ibrahim", yunus: "/prophets#yunus", isa: "/prophets#isa", muhammad: "/prophets#muhammad",
  ayyub: "/prophets#ayyub", sulayman: "/prophets#sulayman", dawud: "/prophets#dawud", maryamline: "/prophets#isa",
  companions: "/companions", characters: "/characters", places: "/places", words: "/words",
  health: "/health", theology: "/theology", latif: "/latif", begin: "/begin", kids: "/kids"
};
const THREAD_FALLBACK = { text: "Yusuf was thrown into a well by his brothers; Yunus was swallowed by a whale after leaving his. Two darknesses, two prisons no one could open, and one exit: honest words spoken to Allah from the bottom.", a: { label: "Yusuf · the well", href: "/prophets#yusuf" }, b: { label: "Yunus · the whale", href: "/prophets#yunus" } };

/* ---------- The Seeker's Question · curated, rotated ---------- */
const QUESTIONS = [
  "Why do Muslims pray five times a day?","What does the word Islam actually mean?","Why do Muslims fast in Ramadan?",
  "Who was Muhammad ﷺ, in one honest minute?","Is the Qur'an really unchanged?","What is the Kaaba and why face it?",
  "What does Allah mean, and is it the same God?","Why is Friday special to Muslims?","What happens in the five daily prayers?",
  "What is halal and why does it matter?","Do Muslims believe in Jesus?","What is zakat and who receives it?",
  "Why do some Muslim women wear hijab?","What is the Sunnah?","What does 'Allahu akbar' really mean?",
  "How does someone become a Muslim?","What do Muslims believe happens after death?","Why is Arabic so central to Islam?",
  "What is Laylat al-Qadr?","What are the five pillars, briefly?","Why no images of the prophets?",
  "What is a hadith and how is one trusted?","What is the difference between Sunni and Shia?","Is Islam only for Arabs?",
  "What is wudu and why wash before prayer?","What does jihad actually mean?","Why do Muslims say 'insha'Allah'?",
  "What is Hajj and why once in a lifetime?","How do Muslims view the Bible and Torah?","What is sadaqa jariyah?"
];
const QUESTION_FALLBACK = { q: "What does the word Islam actually mean?", a: "Islam comes from the Arabic root s-l-m, the same root as salam, peace. It means entering peace by surrendering to the One who made you: not defeat, but the relief of putting down a weight on the only shoulders that can carry everything. A Muslim is simply one who does that.", href: "/begin", room: "Begin the path" };

const FRIDAY_FALLBACK = { text: "Jumu'ah Mubarak. The Prophet ﷺ called Friday the best day the sun rises upon. Wash, wear your good clothes, send prayers upon him ﷺ abundantly, and give something, even small. There is an hour in this day when du'a is not refused; spend it like treasure.", kahf: true };

/* ---------- shared plumbing ---------- */
const cache = new Map();
function remember(k, v) { cache.set(k, v); if (cache.size > 96) cache.delete(cache.keys().next().value); return v; }
function dayIndexOf(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
}
const clean = x => String(x || "").replace(/—|–/g, "·").trim();
async function lantern(system, user, maxTokens) {
  const _ac = new AbortController(); const _tt = setTimeout(() => _ac.abort(), 6500);
  try {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw 0;
  for (const model of MODEL_CHAIN()) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", { signal: _ac.signal,
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "HTTP-Referer": "https://noorcodex.com", "X-Title": "NOOR illuminations" },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.4, messages: [{ role: "system", content: system }, { role: "user", content: user }] })
      });
      if (!r.ok) continue;
      const j = await r.json();
      const raw = (((j.choices || [])[0] || {}).message || {}).content || "";
      let p = null;
      try { p = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]); } catch {} } }
      if (p) return p;
    } catch {}
  }
  throw 0;
  } finally { clearTimeout(_tt); }
}
const BASE_RULES = "Accuracy is sacred: well-established facts and mainstream Sunni understanding only; never invent dates, quotes, hadith or verses; no rulings, no fatwas. Warm, vivid, plain language. Never use the em dash character; use commas or · instead. Reply with JSON only.";

/* ---------- kinds ---------- */
async function kindLight(today, want) {
  const p = await lantern(
    ["You write one small daily illumination for NOOR Codex of Light, a free Islamic library.",
     'JSON exactly: {"category":"...","title":"...","story":"...","detail":"..."}',
     "category: one or two words. title: striking, truthful, under 60 characters.",
     "story: 55 to 90 words. Theme for this day: " + THEMES[dayIndexOf(want) % THEMES.length] + ".",
     "detail: one short line: who / where / when.", BASE_RULES].join("\n"),
    "The light for " + want + ". Choose the single best-documented fact fitting the theme.", 350);
  if (!p.title || !p.story) throw 0;
  return { date: want, source: "lantern", category: clean(p.category).slice(0, 24) || "History", title: clean(p.title).slice(0, 90), story: clean(p.story).slice(0, 700), detail: clean(p.detail).slice(0, 90) };
}
function lightFallback(want) {
  const f = TREASURY[dayIndexOf(want) % TREASURY.length];
  return Object.assign({ date: want, source: "treasury" }, f);
}
async function kindVerse(today) {
  const ref = VERSES[dayIndexOf(today) % VERSES.length];
  try {
    const p = await lantern(
      ["You write the daily Verse Lamp for NOOR Codex of Light. The verse is Qur'an " + ref + ".",
       'JSON exactly: {"reflection":"...","theme":"one or two words"}',
       "reflection: 55 to 85 words on this verse's meaning for an ordinary person's day, grounded in its classical context. Do not paraphrase the whole verse; illuminate it. Address the reader gently as you.",
       BASE_RULES].join("\n"),
      "The reflection for Qur'an " + ref + " on " + today + ".", 260);
    if (!p.reflection) throw 0;
    return { date: today, ref, reflection: clean(p.reflection).slice(0, 600), theme: clean(p.theme).slice(0, 24), source: "lantern" };
  } catch { return Object.assign({ date: today, source: "treasury" }, VERSE_FALLBACK, { ref }); }
}
async function kindThread(today) {
  try {
    const doors = Object.keys(DOORS).join(", ");
    const p = await lantern(
      ["You write the daily Hidden Thread for NOOR Codex of Light: one surprising, TRUE connection between two things in the library (prophets' stories, companions, places, words, practices).",
       'JSON exactly: {"text":"...","aLabel":"...","aDoor":"...","bLabel":"...","bDoor":"..."}',
       "text: 40 to 70 words revealing the connection, ending with a note of wonder. aDoor and bDoor MUST each be one of exactly these door names: " + doors + ".",
       "aLabel/bLabel: 2 to 4 words naming each side.", BASE_RULES].join("\n"),
      "The thread for " + today + ". Choose a pairing unlikely to repeat often.", 300);
    const a = DOORS[String(p.aDoor || "").toLowerCase()], b = DOORS[String(p.bDoor || "").toLowerCase()];
    if (!p.text || !a || !b) throw 0;
    return { date: today, text: clean(p.text).slice(0, 500), a: { label: clean(p.aLabel).slice(0, 40) || "Open", href: a }, b: { label: clean(p.bLabel).slice(0, 40) || "Open", href: b }, source: "lantern" };
  } catch { return Object.assign({ date: today, source: "treasury" }, THREAD_FALLBACK); }
}
async function kindQuestion(today) {
  const q = QUESTIONS[dayIndexOf(today) % QUESTIONS.length];
  try {
    const doors = Object.keys(DOORS).join(", ");
    const p = await lantern(
      ["You answer the daily Seeker's Question for NOOR Codex of Light. Today's question: " + q,
       'JSON exactly: {"a":"...","door":"...","room":"..."}',
       "a: 70 to 110 words, honest, warm, precise, for someone who may not be Muslim. Cite Qur'an by number only when certain. door MUST be one of: " + doors + ". room: 2 to 4 words naming that door for the reader.",
       BASE_RULES].join("\n"),
      "Answer for " + today + ".", 320);
    const href = DOORS[String(p.door || "").toLowerCase()];
    if (!p.a || !href) throw 0;
    return { date: today, q, a: clean(p.a).slice(0, 800), href, room: clean(p.room).slice(0, 40) || "Explore", source: "lantern" };
  } catch { return Object.assign({ date: today, source: "treasury" }, QUESTION_FALLBACK, { q: QUESTION_FALLBACK.q }); }
}
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + "-W" + String(Math.ceil((((t - y0) / 86400000) + 1) / 7)).padStart(2, "0");
}
async function kindFriday(weekKey) {
  try {
    const p = await lantern(
      ["You write the weekly Friday Light for NOOR Codex of Light, shown on Jumu'ah.",
       'JSON exactly: {"text":"..."}',
       "text: 60 to 90 words of Jumu'ah encouragement rooted in authentic sunnah of Friday (ghusl, salawat upon the Prophet ﷺ, Surah al-Kahf, the hour of answered du'a, charity). Begin with Jumu'ah Mubarak.",
       BASE_RULES].join("\n"),
      "Friday Light for week " + weekKey + ".", 240);
    if (!p.text) throw 0;
    return { week: weekKey, text: clean(p.text).slice(0, 700), kahf: true, source: "lantern" };
  } catch { return Object.assign({ week: weekKey, source: "treasury" }, FRIDAY_FALLBACK); }
}

/* ---------- handler ---------- */
export default async function handler(req, res) {
  const kind = String((req.query && req.query.kind) || "light");
  const today = new Date().toISOString().slice(0, 10);

  if (kind === "light") {
    let want = String((req.query && req.query.date) || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(want)) want = today;
    const age = Math.floor((Date.parse(today) - Date.parse(want)) / 86400000);
    if (!(age >= 0 && age <= 30)) want = today;
    res.setHeader("Cache-Control", want === today ? "public, s-maxage=86400, stale-while-revalidate=172800" : "public, s-maxage=2592000, stale-while-revalidate=2592000");
    const ck = "light:" + want;
    if (cache.has(ck)) return res.status(200).json(cache.get(ck));
    /* past days never wake the AI: they come from the store's memory of
       what actually shone that day, or from the treasury, instantly. */
    if (want !== today) {
      if (kvReady()) {
        try {
          const hit = (await kv([["GET", "nl:" + want]]))[0];
          if (hit) return res.status(200).json(remember(ck, JSON.parse(hit)));
        } catch {}
      }
      return res.status(200).json(remember(ck, lightFallback(want)));
    }
    try {
      const lit = await kindLight(today, want);
      if (kvReady()) { kv([["SET", "nl:" + want, JSON.stringify(lit)], ["EXPIRE", "nl:" + want, "2764800"]]).catch(() => {}); }
      return res.status(200).json(remember(ck, lit));
    }
    catch { return res.status(200).json(remember(ck, lightFallback(want))); }
  }

  if (kind === "friday") {
    const wk = isoWeek(new Date());
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=172800");
    const ck = "friday:" + wk;
    if (cache.has(ck)) return res.status(200).json(cache.get(ck));
    return res.status(200).json(remember(ck, await kindFriday(wk)));
  }

  const makers = { verse: kindVerse, thread: kindThread, question: kindQuestion };
  const make = makers[kind];
  if (!make) return res.status(400).json({ error: "unknown kind" });
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=172800");
  const ck = kind + ":" + today;
  if (cache.has(ck)) return res.status(200).json(cache.get(ck));
  return res.status(200).json(remember(ck, await make(today)));
}
