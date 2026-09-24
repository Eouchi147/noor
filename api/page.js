// The rooms, rendered on the server: one Light, one verse, one surah, one
// chapter of the Path, and the day, each as a whole page in the second cut's
// shell, with the shelves that list them.
//
// Why this exists. The library's material lived behind scripts: a Light was a
// tile the home page fetched, a chapter was a JSON file the Path opened in
// place, a verse was a reel with nowhere to land. None of it had an address a
// crawler could read, a messaging app could preview, or a reader could keep.
// This route gives each of them one, built whole from the library's own files
// on request and cached at the edge for a day.
//
// Every fact on these pages comes from the files beside this one (lights/,
// node/, study/, nodes-index.js, the dictionary index, the reels manifest,
// the reels' Qur'an table) or from api.alquran.cloud (the Uthmani text and
// Saheeh International, cached in memory and in the store for thirty days).
// Nothing is written here.
//
// Reached through rewrites in vercel.json:
//   /light/<id>   ?kind=light&id=      /light    ?kind=lights  (/lights is
//   taken by the lights/ folder on the filesystem, so the shelf is singular)
//   /path/<n>     ?kind=path&n=        /path     ?kind=paths
//   /verse/<ref>  ?kind=verse&ref=     /verses   ?kind=verses
//   /surah/<n>    ?kind=surah&n=       /today    ?kind=today[&date=]
//   /prophet/<id>    ?kind=prophet&id=      (prophets-data.js, 25)
//   /companion/<id>  ?kind=companion&id=    (characters.js, the companions)
//   /character/<id>  ?kind=character&id=    (characters.js, the angels, jinn,
//                                            animals and end time figures)
//   /place/<id>      ?kind=place&id=        (places.js, 34)
//   /name/<n>        ?kind=name&n=          (allah.html's NAMES, the 99)
// The loaders are exported so api/sitemap.js lists the same rooms.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { kv, kvReady } from "./_kv.js";
import { pickWord, pickChapter } from "./_schedule.js";
import { scoreLights, hijriOf, hijriName } from "./_lights.js";
import { manifestHost } from "./_reels.js";

const SITE = "https://noorcodex.com";
const OG_DEFAULT = SITE + "/assets/brand/og.png";
const V = "14";                                 /* the shell's cache-buster; noor-fx.js carries the same */
const CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";
const API = "https://api.alquran.cloud/v1";
const MANIFEST_URL = SITE + "/reels/index.json";
const TTL = "2592000";                           /* thirty days, in seconds */

/* ---------------------------------------------------------------------------
   the files, read once per instance
--------------------------------------------------------------------------- */
const ROOT = process.cwd();
const fileOf = rel => path.join(ROOT, rel);
const readText = rel => { try { return fs.readFileSync(fileOf(rel), "utf8"); } catch { return null; } };
const readJSON = rel => { const t = readText(rel); if (t == null) return null; try { return JSON.parse(t); } catch { return null; } };
const memo = new Map();
const once = (k, fn) => { if (!memo.has(k)) memo.set(k, fn()); return memo.get(k); };

export const lights = () => once("lights", () => { const j = readJSON("lights/all.json"); return (j && Array.isArray(j.lights)) ? j.lights : []; });
export const lightById = id => lights().find(L => L.id === id) || null;
export const dictionary = () => once("dict", () => { const j = readJSON("assets/dict-index.json"); return (j && j.words && typeof j.words === "object") ? j.words : {}; });
const menuIndex = () => once("menu", () => readJSON("assets/menu-index.json") || { words: [], path: [] });
/* i18n/en.json is a pack of five shelves -- ui, nodes, characters, places,
   words -- and the hand-written chrome keys live on the ui shelf. This read
   the whole pack and looked the keys up on the outside of it, so every
   lookup missed: /path has been heading its seven sections "bidaya",
   "qisas", "jahiliyyah" since the pack was reshaped, and every chapter page
   has been saying "chapter 55 of 71 - nihaya". Seven names and seven
   descriptions, translated into twenty-one languages, went nowhere. */
const labels = () => once("labels", () => (readJSON("i18n/en.json") || {}).ui || {});
/* nodes-index.js is a script: `const NODES=[...]`; the array literal is sliced out */
export const chapters = () => once("nodes", () => {
  const s = readText("nodes-index.js") || "";
  const m = s.match(/const\s+NODES\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return [];
  try { return JSON.parse(m[1]); } catch { return []; }
});
export const chapter = n => (n >= 1 && n <= 71 && Number.isInteger(n)) ? once("node:" + n, () => readJSON("node/" + n + ".json")) : null;
export const study = n => (n >= 1 && n <= 114 && Number.isInteger(n)) ? once("study:" + n, () => readJSON("study/" + n + ".json")) : null;
/* the reels' own Qur'an table: surah names and the Uthmani text, as the API
   served them, kept beside the renderer so a page never has to guess a name */
const quranTable = () => once("quran", () => readJSON("tools/reels/quran-uthmani.json") || { surahs: {}, verses: {} });
export const surahRow = n => (quranTable().surahs || {})[String(n)] || null;
const shelfRefs = () => once("shelf", () => (readText("tools/reels/verses.txt") || "").split("\n")
  .map(l => l.split("#")[0].trim()).filter(l => /^\d{1,3}:\d{1,3}(-\d{1,3})?$/.test(l)));
/* the shelf's own English, one file, for every one of its 600 verses:
   tools/reels/verses.json, the master table verses.txt's own header
   comment says the reel captions' meaning is drawn from (Saheeh
   International, keyed "surah:ayah", one entry per verse). api/_package.js
   reads this as its fallback when a verse has no locally written note
   (verse/<s>.json), so a shelf verse's Content Factory draft never falls
   back to Arabic alone while its own reel already carries the meaning. */
const shelfVerses = () => once("shelfVerses", () => readJSON("tools/reels/verses.json") || { edition: "", verses: {} });
export const shelfVerseMeaning = (s, a) => (shelfVerses().verses || {})[s + ":" + a] || null;
export const shelfVerseEdition = () => shelfVerses().edition || "";

/* The people, the places and the Names. prophets-data.js, characters.js and
   places.js are page scripts, object literals rather than JSON
   (window.NOOR_PROPHETS = [...]; const CHARACTERS = {...}), so each is run
   once in an empty sandbox with nothing in it but a window object, and the
   literal is what comes out; a file that will not run costs its family of
   rooms and never an error. allah.html keeps the 99 Names as `const NAMES =
   [...]`, written as JSON, and is read the way tools/reels/library.py reads
   it: the literal between "const NAMES" and the line that closes it. */
const scriptObject = (rel, name) => once("js:" + rel, () => {
  const s = readText(rel);
  if (!s) return null;
  try {
    const ctx = { window: {} };
    vm.runInNewContext(s + "\n;__n2 = (typeof " + name + ' !== "undefined") ? ' + name + " : window." + name + ";", ctx, { timeout: 3000 });
    return ctx.__n2 || null;
  } catch { return null; }
});
export const prophets = () => once("prophets", () => { const w = scriptObject("prophets-data.js", "NOOR_PROPHETS"); return Array.isArray(w) ? w.filter(p => p && p.id && p.en) : []; });
export const prophetById = id => prophets().find(p => p.id === id) || null;
/* the hubs' own order of their sections, which is the order of the rooms */
const CHAR_GROUPS = ["companions", "angels", "jinn", "animals", "endtime"];
const PLACE_GROUPS = ["sanctuaries", "mountains", "cities", "waters", "endtimes"];
const grouped = (rel, name, groups) => once("list:" + rel, () => {
  const o = scriptObject(rel, name);
  return (o && typeof o === "object") ? groups.flatMap(g => (Array.isArray(o[g]) ? o[g] : []).filter(e => e && e.id && e.titleEn).map(e => ({ ...e, group: g }))) : [];
});
export const characters = () => grouped("characters.js", "CHARACTERS", CHAR_GROUPS);
export const places = () => grouped("places.js", "PLACES", PLACE_GROUPS);
export const characterById = id => characters().find(c => c.id === id) || null;
export const placeById = id => places().find(p => p.id === id) || null;
/* a companion's room is /companion/<id>; an angel's, a jinn's, an animal's or
   an end time figure's is /character/<id>: one family, two doors */
export const characterRoom = c => (c.group === "companions" ? "/companion/" : "/character/") + c.id;
export const names = () => once("names", () => {
  const s = readText("allah.html") || "";
  const i = s.indexOf("const NAMES");
  const j = i < 0 ? -1 : s.indexOf("\n];", i);
  if (j < 0) return [];
  try { const rows = JSON.parse(s.slice(s.indexOf("[", i), j + 2)); return Array.isArray(rows) ? rows.filter(r => Array.isArray(r) && r.length >= 3) : []; } catch { return []; }
});
/* the n-th Name (1 to 99) as a record: [ar, translit, meaning, [root, gloss,
   essay, ref, verse_ar, verse_en, fromList, practice]] */
export const nameRow = n => {
  const r = names()[n - 1];
  if (!r) return null;
  const x = Array.isArray(r[3]) ? r[3] : [];
  return { n, ar: r[0], translit: r[1], meaning: r[2], root: x[0] || "", gloss: x[1] || "", essay: x[2] || "", ref: x[3] || "", verseAr: x[4] || "", verseEn: x[5] || "", fromList: !!x[6], practice: x[7] || "" };
};
/* what the Content Graph ties each of these rooms to (assets/entity-graph.json,
   derived from the audit's graph at confidence 0.8 and above): the Lights that
   name it, the chapters, its word, the words that name it, people, places */
const entityGraph = () => once("egraph", () => { const j = readJSON("assets/entity-graph.json"); return (j && typeof j === "object") ? j : {}; });
/* exported for api/_package.js: the content factory's "related rooms" for a
   prophet, a companion, a character, a place or a Name reads the same edges
   this room's own "Read beside it" section does, rather than opening
   entity-graph.json a second time or walking the source files again */
export const edgesOf = key => { const e = entityGraph()[key]; return (e && typeof e === "object") ? e : {}; };

/* the manifest of rendered reels: on disk when the shelf's pull request has
   landed, else fetched from the site; absent, the shelf is the reference list */
let MAN = { at: 0, rows: null, ok: false, written: "" };
export async function manifest() {
  const now = Date.now();
  /* a manifest that was read is good for six hours; a failed fetch is tried
     again after ten minutes rather than remembered all day */
  if (MAN.rows && now - MAN.at < (MAN.ok ? 6 * 3600e3 : 600e3)) return MAN.rows;
  const local = readJSON("reels/index.json");
  if (local && Array.isArray(local.cards)) { MAN = { at: now, rows: local.cards, ok: true, written: local.written || "" }; return MAN.rows; }
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(MANIFEST_URL, { signal: ctrl.signal }); clearTimeout(t);
    if (!r.ok) throw new Error("http " + r.status);
    const j = await r.json();
    MAN = { at: now, rows: Array.isArray(j.cards) ? j.cards : [], ok: true, written: j.written || "" };
  } catch { MAN = { at: now, rows: MAN.rows || [], ok: false, written: MAN.written }; }
  return MAN.rows;
}
export async function verseRows() {
  const rows = (await manifest()).filter(r => r && r.kind === "verse" && parseRef(refOfRow(r)));
  if (rows.length) return rows.map(r => ({ ...r, ref: refOfRow(r) }));
  return shelfRefs().map(ref => ({ id: "verse-" + ref.replace(":", "-"), kind: "verse", ref, shelf: true }));
}
const refOfRow = r => String(r.id || "").replace(/^verse-/, "").replace(/^(\d+)-/, "$1:");

/* ---------------------------------------------------------------------------
   the Qur'an API, remembered here and in the store
--------------------------------------------------------------------------- */
const apiMemo = new Map();
async function remembered(key, fetcher) {
  if (apiMemo.has(key)) return apiMemo.get(key);
  if (kvReady()) {
    try { const hit = (await kv([["GET", key]]))[0]; if (hit) { const v = JSON.parse(hit); apiMemo.set(key, v); return v; } } catch {}
  }
  const v = await fetcher();
  if (v) {
    apiMemo.set(key, v);
    if (kvReady()) kv([["SET", key, JSON.stringify(v)], ["EXPIRE", key, TTL]]).catch(() => {});
  }
  return v;
}
async function getJSON(url) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000);
  try { const r = await fetch(url, { signal: ctrl.signal }); if (!r.ok) return null; return await r.json(); }
  catch { return null; } finally { clearTimeout(t); }
}
const surahShape = s => s ? { number: s.number, name: s.name, englishName: s.englishName,
  englishNameTranslation: s.englishNameTranslation, numberOfAyahs: s.numberOfAyahs, revelationType: s.revelationType } : null;
export async function ayah(s, a) {
  return remembered("n2:ayah:" + s + ":" + a, async () => {
    const j = await getJSON(API + "/ayah/" + s + ":" + a + "/editions/quran-uthmani,en.sahih");
    const d = j && Array.isArray(j.data) ? j.data : null;
    if (!d || d.length < 2) return null;
    const ar = d.find(x => x.edition && x.edition.identifier === "quran-uthmani") || d[0];
    const en = d.find(x => x.edition && x.edition.identifier === "en.sahih") || d[1];
    if (!ar.text || !en.text) return null;
    return { ar: ar.text, en: en.text, surah: surahShape(ar.surah || en.surah) };
  });
}
/* THE ARABIC NEVER WAITS ON A STRANGER (audit seo-008).
   A verse room fetched both its Arabic and its English from api.alquran.cloud
   while the reader waited, and when that service was slow the page printed
   "the text of this verse is on the Mushaf" and was cached at the edge for a
   whole day as a success. The Uthmani text of all 6,236 verses has always
   been beside this file, in the reels' own table; it is read from there now,
   so the Arabic is on the page whatever any other service is doing. Only the
   English still comes from outside, and a page that is missing it says so to
   the cache (see versePage) instead of pretending to be whole. */
export const localArabic = (s, a) => (quranTable().verses || {})[s + ":" + a] || "";
/* the written notes the library already owns for 1,280 verses: the sense of
   the verse in a few sentences and its words one by one, from verse/<s>.json */
export const verseNotes = (s, a) => { const j = once("vn:" + s, () => readJSON("verse/" + s + ".json")); return (j && j.v && j.v[String(a)]) || null; };
export async function verseText(s, a, askEnglish = true) {
  const ar = localArabic(s, a);
  const t = askEnglish ? await ayah(s, a) : null;
  if (t) return { ar: ar || t.ar, en: t.en, surah: t.surah };
  return ar ? { ar, en: "", surah: null } : null;
}
export async function surahMeta(n) {
  return remembered("n2:surah:" + n, async () => {
    const j = await getJSON(API + "/surah/" + n);
    return surahShape(j && j.data);
  });
}

/* ---------------------------------------------------------------------------
   small tools
--------------------------------------------------------------------------- */
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const attr = esc;
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…"; };
const fold = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[‘’'ʻʼ`]/g, "").replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").trim();
const paras = (text, cls = "n2-p") => String(text || "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => `<p class="${cls}">${p}</p>`).join("\n");
/* the Path's own cross links: {{n:2|Adam}} is a chapter, {{c:id|Iblis}} a
   character, {{p:id|Makkah}} a place, {{w:id|the shahada}} a du'a of the
   Words page. A chapter, a companion and a place all carry them; each one
   that has a room of its own is a link to it, and one that has none is its
   label alone. */
const tokenHref = (typ, id) => {
  if (typ === "n") return "/path/" + id;
  if (typ === "c") { const c = characterById(id); return c ? characterRoom(c) : ""; }
  if (typ === "p") return placeById(id) ? "/place/" + id : "";
  if (typ === "w") return "/words?open=" + encodeURIComponent(id);
  return "";
};
const unmark = s => esc(s).replace(/\{\{([a-z]+):([^|{}]+)\|([^{}]*)\}\}/g, (m, typ, id, label) => { const h = tokenHref(typ, id); return h ? `<a href="${attr(h)}">${label}</a>` : label; });
/* the same cross links, unwound to plain text (no anchor, no escaping) for a
   description or a share line, which read as text and never as markup */
const plainMark = s => String(s || "").replace(/\{\{[a-z]+:[^|{}]+\|([^{}]*)\}\}/g, "$1");
/* Audit seo-007: eleven chapters' summary line alone (the sentence a chapter
   opens on) reads under 50 characters, since it was written as a hook for the
   page's own h1, not as a search description. Nothing here is written new:
   the summary is followed by whole sentences of the chapter's own details
   (its cross links unwound to their plain label) until the description reads
   like one, capped where clip() already caps every other room's. */
/* a plain sentence, folded for comparison only: no leading article, no
   punctuation, one space between words, so "The books fly." and "Books
   fly." (node 69) read as the one sentence they are */
const normSent = s => String(s || "").toLowerCase().replace(/^(the|a|an)\s+/, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
/* a unit that opens on a lower-case letter (once its own leading quote mark
   or comma is looked past) is not a sentence: it is the back half of one
   the split above cut in two, or, in node 69, an aside repeated mid-run
   ("do you recognize this? do you recognize this?"), and reads as a
   non-sequitur on its own */
const startsSentence = u => { const m = String(u || "").match(/[A-Za-z]/); return !m || m[0] === m[0].toUpperCase(); };
const chapterDesc = N => {
  let s = String(N.summary || "").replace(/\s+/g, " ").trim();
  if (s.length < 50 && N.details) {
    const rest = plainMark(N.details).replace(/\s+/g, " ").trim();
    const raw = rest.match(/[^.!?]+[.!?]+/g) || [rest];
    /* [^.!?]+[.!?]+ splits on every sentence-ending mark, including one that
       falls inside a quotation (node 8, Qur'an 11:44's disembarkation order
       runs three sentences deep before the closing mark), so a quote that
       opens here is folded back together with however many of the following
       fragments it takes to close, never left to end mid-thought. A quote
       that never closes before the details run out stays merged into one
       long, honestly unbalanced unit, which the odd-quote-count check below
       then simply never selects: a stray mark two paragraphs later is never
       mistaken for its close. */
    const units = [];
    for (let i = 0; i < raw.length;) {
      let unit = raw[i].trim(), j = i;
      while ((unit.match(/"/g) || []).length % 2 === 1 && j + 1 < raw.length) { j++; unit += " " + raw[j].trim(); }
      units.push(unit);
      i = j + 1;
    }
    let cur = s, safe = s;
    for (const unit of units) {
      if (!unit || (unit.match(/"/g) || []).length % 2 === 1 || !startsSentence(unit)) continue;
      const ns = normSent(unit), nCur = normSent(cur);
      if (ns && nCur && (nCur.includes(ns) || ns.includes(nCur))) continue;
      const joined = cur ? cur + " " + unit : unit;
      if (joined.length > 158) continue;
      cur = joined;
      safe = cur;
      if (safe.length >= 50) break;
    }
    s = safe;
  }
  return clip(s || N.details, 158);
};
/* The house prints no em dash and no en dash. The 99 Names in allah.html
   carry 179 em dashes, written as the page was written (the content audit's
   content-006 asks for them to go); until the data is corrected the room
   prints what scripts/i18n.py prints for the translation packs, a comma, and
   a colon where the dash introduces a root's gloss ("rahim: the womb"). */
const dedash = (s, colon) => String(s || "").replace(/\s*[\u2014\u2013]\s*/g, colon ? ": " : ", ");
/* a reference as the data writes it (2:31, 4:157-158) opens its verse room
   when it parses as one, else the Mushaf at its first verse */
const refHref = ref => { const r = parseRef(ref); if (r) return "/verse/" + r.id; const m = String(ref || "").match(/^(\d{1,3}):(\d{1,3})/); return m ? "/quran?surah=" + m[1] + "&ayah=" + m[2] : "/quran"; };
const ordinal = n => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const SVG = {
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5v14l11-7z"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6h4l5 4V5L9 9z"/><path d="M17 8a5 5 0 0 1 0 8"/></svg>'
};
const shareBtn = (text, url) => `<button class="n2-btn" type="button" data-n2-share="${attr(text)}" data-n2-url="${attr(url)}">Share ${SVG.share}</button>`;
/* the gold button is the one thing to press on its screen, and it breathes;
   a screen never carries two */
const go = (href, label, gold) => `<a class="n2-btn${gold ? " n2-gold n2-glow" : ""}" href="${attr(href)}">${esc(label)} ${SVG.right}</a>`;

/* the key phrase, set in gold: a number with the word after it, else a name
   of two or more capitalised words not opening the line, else the last two
   words. The title itself is never changed, only lit. */
export function keyPhrase(title) {
  const t = String(title || "").trim();
  const wrap = (a, b) => esc(t.slice(0, a)) + '<span class="n2-g">' + esc(t.slice(a, b)) + "</span>" + esc(t.slice(b));
  let m = t.match(/\d[\d,.]*(?:\s+[A-Za-z'’-]+)?/);
  if (m) return wrap(m.index, m.index + m[0].length);
  m = t.match(/(?:^|\s)([A-Z][\w'’-]*(?:\s+(?:ibn|bin|al|of)\s+)?(?:\s+[A-Z][\w'’-]*)+)/);
  if (m && m.index > 0) { const a = m.index + m[0].length - m[1].length; return wrap(a, a + m[1].length); }
  const ws = t.split(/\s+/);
  if (ws.length < 3) return esc(t);
  const a = t.length - ws.slice(-2).join(" ").length;
  return wrap(a, t.length);
}

/* a chapter's title lights what follows its colon, the Path's own habit:
   "Adam from Clay: Ruh Breathed" */
const chapterHook = t => String(t || "").includes(":")
  ? esc(t.split(":")[0]) + ': <span class="n2-g">' + esc(t.split(":").slice(1).join(":").trim()) + "</span>"
  : keyPhrase(t);

/* a citation names a collection and a number ("Bukhari 1834", "Tirmidhi 3925,
   sahih", "Abu Dawud 1522 - Nasa'i (sahih)") and was being read as the
   dictionary's own words: /place/p-makkah quoted "the best of Allah's earth"
   (Tirmidhi 3925, sahih) and grew a "Sahih" word that had nothing to do with
   the room. Stripped before matching: a collection name with its number, a
   bare collection name next to a grading note, a grading word alone in
   parentheses, "Sahih al-Bukhari"/"Sahih Muslim" named outright (always the
   book, never the abstract grade), and a verse reference. */
const CITE_COLLECTIONS = "bukhari|muslim|tirmidhi|abu dawud|nasa['’]?i|ibn majah|ahmad|muwatta|tabarani|sahihayn";
const CITE_GRADES = "sahih|hasan|da['’]?if|gharib|mutawatir|munkar";
const CITATIONS = new RegExp(
  "\\(\\s*(?:al-)?(?:" + CITE_COLLECTIONS + ")\\b[^()]*\\)" +
  "|\\b(?:al-)?(?:" + CITE_COLLECTIONS + ")\\b\\.?\\s*\\d+[a-z]?" +
  "|\\b(?:al-)?(?:" + CITE_COLLECTIONS + ")\\b\\s*\\([^()]*\\)" +
  "|\\bSahih\\s+(?:al-)?(?:Bukhari|Muslim)\\b" +
  "|\\(\\s*(?:graded\\s+)?(?:" + CITE_GRADES + ")(?:\\s*[\\/,]\\s*(?:" + CITE_GRADES + "))*\\s*\\)" +
  "|\\b\\d{1,3}:\\d{1,3}(?:-\\d{1,3})?\\b"
, "gi");
const stripCitations = s => String(s || "").replace(CITATIONS, " ");
const wordTok = s => String(s || "").match(/[A-Za-z0-9؀-ۿ']+/g) || [];
/* ibn/bin/bint/abu/umm are kinship words: nothing else in the library's
   prose is built that way, so they are always a name signal. "al-" is not:
   it is the ordinary Arabic article, and al-Masjid al-Haram is a place, not
   a person, even though "Haram" is also the dictionary's word for
   forbidden. So "al-" only reads as a name when what follows is a given
   name the graph already knows, from the prophets and the characters. */
const NAME_BEFORE = new Set(["ibn", "bin", "bint", "abu", "umm"]);
const NAME_AFTER = new Set(["ibn", "bin", "bint"]);
const TECH_CATS = new Set(["Hadith", "Law and life"]);
/* the prophets and the companions carry real given names (Hasan, Yunus);
   the angels, jinn, animals and end time figures more often carry a
   descriptive epithet with an ordinary noun inside it (Hamalat al-Arsh,
   Bearers of the Throne), so only the first two groups feed this set --
   else "al-Arsh" in that very title would teach the guard that Arsh is a
   given name and cost the room its own best word, the Throne. */
let GIVEN_NAMES = null;
function givenNames() {
  if (!GIVEN_NAMES) {
    GIVEN_NAMES = new Set();
    const skip = new Set(["al", "ibn", "bin", "bint", "abu", "umm", "the", "and", "of"]);
    for (const p of prophets()) for (const t of fold(p.en).split(" ")) if (t.length >= 3 && !skip.has(t)) GIVEN_NAMES.add(t);
    for (const c of characters()) if (c.group === "companions") for (const t of fold(c.titleEn).split(" ")) if (t.length >= 3 && !skip.has(t)) GIVEN_NAMES.add(t);
  }
  return GIVEN_NAMES;
}
/* assets/person-words.json (scripts/graph/derive_person_words.py, run by
   scripts/graph/run.sh from scripts/graph/same-as.json's own curated word:
   pairs; same-as.json itself never deploys, .vercelignore's /scripts/, so
   this small derived file is what the live site actually reads): a
   dictionary word same-as.json already says IS a companion, a place or a
   figure written twice (word:khadijah is companion:c-khadijah). The name
   guard below exists to stop a technical term from being misread as a
   person's name; it must not then strip the very word that names that
   person, or every Light that ever wrote "Khadijah bint Khuwaylid" or
   "Fatimah bint Muhammad" lost her own word the moment her father's name
   followed. */
let PERSON_WORDS = null;
function personWords() {
  if (!PERSON_WORDS) {
    const j = readJSON("assets/person-words.json");
    PERSON_WORDS = new Set(Array.isArray(j && j.words) ? j.words : []);
  }
  return PERSON_WORDS;
}
/* "X of Y", capitalised mid sentence, usually names a person's title (Aziz
   of Egypt) -- unless Y is a collection's own compiler (Sunan of Abu Dawud,
   Muwatta of Malik), which names a book the same way "Sahih al-Bukhari"
   does, so the rule below leaves it alone. */
const BOOK_AUTHOR_WORDS = new Set(fold(CITE_COLLECTIONS.replace(/[|']/g, " ")).split(" ").filter(w => w.length >= 3));
/* true when every sighting of a key in a room's own words reads as someone's
   name rather than the term the dictionary defines: preceded by ibn/bint/
   abu/umm, followed by ibn/bin/bint, preceded by al- when the key itself is
   a given name the graph already knows ("al-Hasan ibn Ali" is a man, not
   the hadith grade "Hasan"; "al-Masjid al-Haram" stays a place, since no
   one in the library is named Haram), or, for a technical word such as a
   hadith grade or a fiqh term, a capitalised title read mid sentence as
   "X of Y" ("Aziz of Egypt" is Yusuf's minister, not the rare hadith the
   dictionary defines; "Sunan of Abu Dawud" is spared, see above). A key
   that also stands free of a name anywhere in the text is kept:
   bukhari-sahih-870 still shows "Sahih" for "his Sahih contains roughly
   7,275 reports", which is the term itself, not a name. */
function everyOccurrenceIsAName(keyWords, rawWords, foldWords, technical) {
  let seen = 0, named = 0;
  for (let i = 0; i + keyWords.length <= foldWords.length; i++) {
    let ok = true;
    for (let j = 0; j < keyWords.length; j++) if (foldWords[i + j] !== keyWords[j]) { ok = false; break; }
    if (!ok) continue;
    seen++;
    const end = i + keyWords.length - 1, before = rawWords[i - 1], after = rawWords[end + 1];
    let isName = (before && NAME_BEFORE.has(fold(before))) || (after && NAME_AFTER.has(fold(after)));
    if (!isName && before && fold(before) === "al" && givenNames().has(keyWords.join(" "))) isName = true;
    if (!isName && technical && i > 0 && /^[A-Z]/.test(rawWords[i]) && after && after.toLowerCase() === "of"
      && rawWords[end + 2] && /^[A-Z]/.test(rawWords[end + 2]) && !BOOK_AUTHOR_WORDS.has(fold(rawWords[end + 2]))) isName = true;
    if (isName) named++;
  }
  return seen > 0 && named === seen;
}
/* the dictionary words a text mentions, by term or id, whole words only.
   `self`, given only by an entity room (besideEntity), is the room's own
   name and the dictionary id the graph's curated same-as already says is
   the same record (assets/entity-graph.json's `word`): the room never
   calls its own name a related word unless the dictionary entry really is
   that entity, the way place:p-makkah's own word "makkah" is. A refuter's
   review found the first cut of this too wide: p-badr's own title is "The
   Wells of Badr", and it lost the dictionary's own word for the battle,
   Badr, along with Mount Uhud losing Uhud, Mina losing Jamarat, the
   Prophet's Mosque losing Rawdah, Iblis losing his other name Shaytan, and
   Hamalat al-Arsh losing the Throne it carries -- six rooms where the
   entity's title names the very thing the word defines, not a look-alike
   sharing its spelling. The guard now fires only when the shared token is
   either a technical word (a hadith grade, a fiqh term: Al-Aziz on the
   Names page is not the rare hadith Aziz) or a given name the prophets or
   companions actually carry (Umm Ayman's own name, Barakah, is not the
   dictionary's word for a blessing, even though nothing else marks it as
   a name in her own account). */
export function relatedWords(text, limit = 6, self) {
  const D = dictionary();
  const cleaned = stripCitations(text);
  const hay = " " + fold(cleaned) + " ";
  const rawWords = wordTok(cleaned), foldWords = rawWords.map(fold);
  const selfTokens = self && self.name ? fold(self.name).split(" ") : [];
  const selfSame = (self && self.same) || "";
  const out = [];
  for (const id of Object.keys(D)) {
    const e = D[id];
    const keys = [fold(e.t), fold(id.replace(/-/g, " "))].filter(k => k.length >= 3);
    const hit = keys.find(k => hay.includes(" " + k + " "));
    if (!hit) continue;
    if (!personWords().has(id) && everyOccurrenceIsAName(hit.split(" "), rawWords, foldWords, TECH_CATS.has(e.cat))) continue;
    if (selfTokens.length && id !== selfSame && selfTokens.includes(fold(e.t))
      && (TECH_CATS.has(e.cat) || givenNames().has(fold(e.t)))) continue;
    out.push({ id, ...e });
  }
  /* the longer term is the more particular one: Badr before Qur'an */
  return out.sort((a, b) => fold(b.t).length - fold(a.t).length).slice(0, limit);
}
/* a Light's group is its first tag (early-islam, west-africa), which is a
   subject; `c` is the card's own eyebrow, a person or a place, and grouping
   by it made a shelf of one card per group. The companions' cards open with
   the companion's own name as a tag (bilal, zayd), which would do the same,
   so the group is the first tag that at least one other card shares, then
   the first tag, then the kind. */
let TAGN = null;
const tagCount = t => { if (!TAGN) { TAGN = new Map(); for (const L of lights()) for (const x of L.tags || []) TAGN.set(x, (TAGN.get(x) || 0) + 1); } return TAGN.get(t) || 0; };
export const groupOf = L => { const t = L.tags || []; return t.find(x => tagCount(x) > 1) || t[0] || L.k || "light"; };
export const groupLabel = g => String(g).split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const yearOf = L => (L.w && Number.isFinite(L.w.y)) ? L.w.y : Infinity;
/* the Lights beside one: a shared tag first (the group's own tag weighs
   most), then the same eyebrow */
export function relatedLights(L, limit = 4) {
  const tags = new Set(L.tags || []);
  return lights().filter(x => x.id !== L.id)
    .map(x => ({ x, s: (x.tags || []).filter(t => tags.has(t)).length * 2 + (groupOf(x) === groupOf(L) ? 2 : 0) + (x.c === L.c ? 1 : 0) }))
    .filter(o => o.s > 0).sort((a, b) => b.s - a.s || yearOf(a.x) - yearOf(b.x)).slice(0, limit).map(o => o.x);
}
export function parseRef(ref) {
  const m = String(ref || "").trim().match(/^(\d{1,3})[:\-.](\d{1,3})(?:-(\d{1,3}))?$/);
  if (!m) return null;
  const s = +m[1], a = +m[2], b = m[3] ? +m[3] : a;
  if (s < 1 || s > 114 || a < 1 || b < a || b - a > 20) return null;
  const row = surahRow(s);
  if (row && b > row.count) return null;
  return { s, a, b, id: s + "-" + a + (b > a ? "-" + b : ""), label: s + ":" + a + (b > a ? "-" + b : "") };
}
const isoDate = d => d.toISOString().slice(0, 10);
const longDate = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).replace(",", "");
const shortDate = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).replace(",", "");
const PERIOD_ORDER = ["bidaya", "qisas", "jahiliyyah", "seerah", "khulafa", "umam", "nihaya"];
const periodName = p => labels()["period." + p] || p;
const periodDesc = p => labels()["period." + p + ".desc"] || "";
const wordList = (ws, eyebrow) => ws.length ? `<p class="n2-eyebrow">${eyebrow}</p><ul class="n2-rooms">` + ws.map(w =>
  `<li><a href="/dictionary/${attr(w.id)}"><span class="n2-ar" lang="ar">${esc(w.a)}</span><b>${esc(w.t)}</b><span>${esc(w.cat || "")}</span></a></li>`).join("") + "</ul>" : "";
/* related Lights ride a shelf: one card at a time, under the thumb */
const lightList = (ls, eyebrow) => ls.length ? `<p class="n2-eyebrow">${eyebrow}</p><ul class="n2-shelf">` + ls.map(L =>
  `<li><a href="/light/${attr(L.id)}"><b>${esc(L.t)}</b><small>${esc(L.d || L.c)}</small></a></li>`).join("") + "</ul>" : "";
const jsonld = objs => `<script type="application/ld+json">${JSON.stringify(objs).replace(/</g, "\\u003c")}</script>`;
const crumbs = list => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: list.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + url })) });
const walk = (prev, next) => (prev || next) ? `<div class="n2-walk">` +
  (prev ? `<a href="${attr(prev[0])}">${SVG.left}<span class="n2-walk-t"><small>${esc(prev[2] || "Before")}</small>${esc(prev[1])}</span></a>` : "<i></i>") +
  (next ? `<a class="n2-next" href="${attr(next[0])}"><span class="n2-walk-t"><small>${esc(next[2] || "After")}</small>${esc(next[1])}</span>${SVG.right}</a>` : "") + "</div>" : "";

/* ---------------------------------------------------------------------------
   the shell
--------------------------------------------------------------------------- */
/* the bar: five doors, no two alike, the same five assets/noor2.js draws.
   Today is the day's light, word and chapter; Qur'an is the Mushaf, read and
   heard in one room; Story is the Path of Creation in order; Words is the
   dictionary; Search opens the page's own search where it has one, else the
   words. `active` names the door a room lights: a verse or a surah lights
   Qur'an, a chapter lights Story, a Light lights Today only when it is the
   day's, and a shelf lights nothing. */
const BAR = [
  ["Today", "/today", '<circle cx="12" cy="12" r="3.6"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>'],
  ["Qur'an", "/quran", '<path d="M12 6.4C10.4 4.9 8 4.4 3 4.7v13.8c5-.3 7.4.2 9 1.8 1.6-1.6 4-2.1 9-1.8V4.7c-5-.3-7.4.2-9 1.7z"/><path d="M12 6.4v13.9"/>'],
  ["Story", "/path", '<path d="M4.5 19.5c6.5 0 3.5-9 8-9s2-6 7-6"/><circle cx="4.5" cy="19.5" r="1.6"/><circle cx="19.5" cy="4.5" r="1.6"/>'],
  ["Words", "/dictionary", '<path d="M4 18h16M4 6h16M4 12h10"/>'],
  ["More", "/#search", '<circle cx="5.5" cy="6" r="1.6"/><circle cx="5.5" cy="12" r="1.6"/><circle cx="5.5" cy="18" r="1.6"/><path d="M11 6h8M11 12h8M11 18h8"/>']
];
/* Audit seo-006: the old suffix, " · NOOR Codex of Light" (22 characters),
   pushed 406 room titles past the 60 characters a result cuts at. The audit
   itself found the sentence titles are the best hooks on the site, so the
   fix is the suffix alone, never the sentence in front of it: a title is
   never trimmed anywhere, room or static page, since a cut sentence can
   assert the opposite of what it said whole. */
const TITLE_SUFFIX = " · NOOR";
export function shell(o) {
  const title = String(o.title || "") + TITLE_SUFFIX;
  const pageUrl = SITE + o.path;
  /* Audit seo-026: a dated /today?date= page renders the same Light as its
     own room, /light/<id>, so it is a near-duplicate of one; o.canonical, set
     only by the dated day page, points a search engine straight at the room
     that owns the content, while og:url below still names the address the
     reader is actually on, for a share to land where it was opened. */
  const canonical = o.canonical || pageUrl;
  /* Search opens the sheet (assets/noor-search.js, fetched by noor-fx.js on a
     room that does not carry it) and nothing else. It used to carry the menu
     dial's data-nm-open as well, which on a page that loads the dial always
     won -- so the bar's Search and the field on the arrival opened two
     different searches. The dial is the Menu's. */
  /* /noor-fx.js is the house layer: the language door, the beacon, the service
     worker, the social row, the quiet guide's provider and Friday's card.
     Every other page in the house loads it -- the 523 word pages of the shell
     among them -- and these rooms were the one kind that did not, so a chapter
     could declare its guide topic with nothing listening, and Friday reached
     every room but these. It knows a page of the shell and leaves it alone. */
  /* The fifth door is the map of the house and the search in one sheet, drawn
     by noor-fx.js. Five doors cannot reach forty-two rooms; the other
     thirty-seven used to be behind a dial that only the arrival carried, so a
     reader standing in a room on a phone could not get to the Prophets at all.
     Without any script it is a link to /#search, which the arrival answers. */
  /* The two skip links are first in the body, off screen until focused: the
     bar is last in the document, so from a keyboard it came after every link
     on the page. assets/noor2.js draws the same two on every other page. */
  const bar = BAR.map(l => `<a href="${l[1]}"${l[0] === "More" ? " data-n2-more" : ""}${l[1] === o.active ? ' class="n2-on"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${l[2]}</svg>${l[0]}</a>`).join("");
  const ld = [crumbs([["NOOR Codex of Light", "/"], ...(o.crumbs || [])]), ...(o.ld || [])];
  return `<!DOCTYPE html>
<html lang="en" data-n2="${attr(o.mode || "")}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${esc(title)}</title>
<meta name="description" content="${attr(o.desc)}"/>
<link rel="canonical" href="${attr(canonical)}"/>
${o.noindex ? '<meta name="robots" content="noindex"/>' : ""}<meta name="theme-color" content="#04060F"/>
<meta property="og:type" content="${attr(o.ogType || "article")}"/>
<meta property="og:site_name" content="NOOR Codex of Light"/>
<meta property="og:title" content="${attr(o.title)}"/>
<meta property="og:description" content="${attr(o.desc)}"/>
<meta property="og:url" content="${attr(pageUrl)}"/>
<meta property="og:image" content="${attr(o.image || OG_DEFAULT)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${attr(o.title)}"/>
<meta name="twitter:description" content="${attr(o.desc)}"/>
<meta name="twitter:image" content="${attr(o.image || OG_DEFAULT)}"/>
<link rel="icon" href="/assets/brand/mark-32.png" sizes="32x32"/>
<link rel="apple-touch-icon" href="/assets/brand/mark-180.png"/>
<link rel="manifest" href="/manifest.webmanifest"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Amiri+Quran&family=Inter:wght@400;500;600;800&family=IBM+Plex+Mono:wght@400;500&display=swap"/>
<link rel="stylesheet" href="/assets/noor2.css?v=${V}"/>
<script src="/assets/noor2.js?v=${V}" defer></script>
<script src="/noor-fx.js" defer></script>
${jsonld(ld)}
</head>
<body>
<div class="n2-skips"><a class="n2-skip" href="#n2-content">Skip to the content</a><a class="n2-skip" href="#n2-rooms">Skip to the rooms</a></div>
<div class="n2-still"></div>
<i class="n2-prog" aria-hidden="true"></i>
<header class="n2-top">
  <a class="n2-brand" href="/"><span class="n2-ar" lang="ar">نُور</span><span class="n2-en">Codex of Light</span></a>
  ${o.pill ? `<a class="n2-pill" href="${attr(o.pill[0])}">${esc(o.pill[1])}</a>` : ""}
</header>
<main class="n2-main" id="n2-content" tabindex="-1">
${o.body}
</main>
<footer class="n2-foot">NOOR Codex of Light · free, no ads, no account · <a href="/">the library</a> · <a href="/legal">legal</a></footer>
<nav class="n2-bar" id="n2-rooms" aria-label="Rooms" tabindex="-1"><i class="n2-pill-bg" aria-hidden="true"></i>${bar}</nav>
${o.tail || ""}
</body>
</html>`;
}
const ROOMS = () => `<ul class="n2-rooms">
<li><a href="/quran"><b>The Mushaf</b><span>114 surahs, recited</span></a></li>
<li><a href="/path"><b>The Path</b><span>${chapters().length || 71} chapters, in order</span></a></li>
<li><a href="/dictionary"><b>The Words</b><span>${Object.keys(dictionary()).length || 523} explained</span></a></li>
<li><a href="/allah"><b>The Names</b><span>the ninety-nine</span></a></li>
<li><a href="/light"><b>The Lights</b><span>${lights().length || 350} true things</span></a></li>
<li><a href="/kids"><b>Little Codex</b><span>for children</span></a></li>
</ul>`;

function notFound(what) {
  return { status: 404, html: shell({
    title: "Not found", path: "/404", desc: "There is no room at this address.", noindex: true, ogType: "website", mode: "reveal top bar share",
    body: `<section class="n2-idea n2-in"><p class="n2-eyebrow">404 <small>· ${esc(what || "no such room")}</small></p>
<h1 class="n2-h1">There is no room <span class="n2-g">at this address</span></h1>
<p class="n2-p">The address may have changed, or the page it named was never made. The library's rooms are below, and under the thumb.</p>
${ROOMS()}</section>` }) };
}

/* ---------------------------------------------------------------------------
   one Light
--------------------------------------------------------------------------- */
async function lightPage(id, host) {
  const L = lightById(String(id || ""));
  if (!L) return notFound("Light");
  const url = "/light/" + L.id;
  /* the day's light lights Today in the bar, and then the page turns over
     at midnight UTC with the day; any other Light lights no door */
  const today = isoDate(new Date());
  const card = await dayLight(host, today, today);
  const isToday = !!(card && card.id === L.id);
  const words = relatedWords(L.t + " " + L.s);
  const more = relatedLights(L);
  /* The first screen of every room arrives already there (n2-in), the way
     the home and the shelves ship theirs: noor2.css holds a screen's children
     at opacity 0 until noor2.js marks it arrived, and on these rooms that
     was 1.3 s of blank night before the first words on a desktop served from
     the same box that paints the home at 144 ms. The screens below still
     arrive as the reader reaches them. */
  const body = `<section class="n2-idea n2-in">
<p class="n2-eyebrow">${esc(L.c || "Light")} <small>· a Light</small></p>
<h1 class="n2-h1">${keyPhrase(L.t)}</h1>
${paras(esc(L.s))}
${L.d ? `<p class="n2-date">${esc(L.d)}</p>` : ""}
${L.src ? `<p class="n2-src">Source · ${esc(L.src)}</p>` : ""}
<div class="n2-row">${go("#beside", "Read beside it", true)}${shareBtn(L.t + " · NOOR Codex of Light", SITE + url)}</div>
</section>
<section class="n2-idea n2-short" id="beside">
<p class="n2-eyebrow">Read beside it</p>
${wordList(words, "The words")}
${lightList(more, "More Lights")}
<div class="n2-row">${go("/light", "All " + lights().length + " Lights")}${go("/today", "Today's light")}</div>
</section>`;
  const html = shell({
    title: L.t, path: url, desc: clip(L.s, 158), active: isToday ? "/today" : "", crumbs: [["The Lights", "/light"], [L.t, url]],
    pill: ["/light", "All Lights"],
    ld: [{ "@context": "https://schema.org", "@type": "Article", headline: L.t, description: clip(L.s, 200), articleSection: L.c || "",
      url: SITE + url, mainEntityOfPage: SITE + url, image: OG_DEFAULT, inLanguage: "en",
      author: { "@type": "Organization", name: "NOOR Codex of Light", url: SITE },
      publisher: { "@type": "Organization", name: "NOOR Codex of Light", url: SITE, logo: { "@type": "ImageObject", url: SITE + "/assets/brand/mark-512.png" } },
      keywords: (L.tags || []).join(", ") }],
    body });
  return { status: 200, html, cache: isToday ? untilMidnight() : undefined };
}
function lightsIndex() {
  const groups = new Map();
  for (const L of lights()) { const k = groupOf(L); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(L); }
  for (const list of groups.values()) list.sort((a, b) => yearOf(a) - yearOf(b));
  const keys = [...groups.keys()].sort((a, b) => groups.get(b).length - groups.get(a).length || a.localeCompare(b));
  const body = `<section class="n2-idea n2-short n2-in">
<p class="n2-eyebrow">The Lights <small>· ${lights().length} true things</small></p>
<h1 class="n2-h1">Things that <span class="n2-g">happened</span>, one at a time</h1>
<p class="n2-dim">${lights().length} Lights of history and science, each with its date, and its source where the card names one, in ${keys.length} subjects, the largest first.</p>
<div class="n2-row">${go("/today", "Today's light", true)}</div>
</section>` + keys.map(k => `<section class="n2-idea n2-short n2-group" id="${attr(fold(k).replace(/\s+/g, "-"))}">
<h2 class="n2-h3">${esc(groupLabel(k))} <span class="n2-g">· ${groups.get(k).length}</span></h2>
<ul class="n2-list">${groups.get(k).map(L => `<li><a href="/light/${attr(L.id)}"><b>${esc(L.t)}<small>${esc(L.d || "")}</small></b></a></li>`).join("")}</ul>
</section>`).join("\n");
  return { status: 200, html: shell({ title: "The Lights", path: "/light", desc: lights().length + " Lights of history and science, each with its date, and its source where the card names one.",
    ogType: "website", mode: "reveal top bar share home", active: "", crumbs: [["The Lights", "/light"]],
    ld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "The Lights", url: SITE + "/light", numberOfItems: lights().length }], body }) };
}

/* ---------------------------------------------------------------------------
   one chapter of the Path
--------------------------------------------------------------------------- */
/* The Path's pictures are the manuscript plates the room already uses as
   its backgrounds. All fifty-nine were looked at before this page shipped:
   landscapes, plates, silhouettes without a face. One shows a prophet's face
   in profile and is held back here, by the house rule, whatever the room
   does with it. */
const HELD_BACK = new Set(["assets/manuscripts/adam.jpg"]);
/* Nineteen chapters of Al-Nihaya were written with three fields no page has
   ever drawn: where the chapter falls in the order of the Hour, the events
   it contains in the order they come, and -- on the three that describe a
   trial a person can actually be caught in -- what shields you from it.
   A hundred and eighteen sourced events, sitting in node/53..71.json since
   they were written, read by nothing.

   They are drawn here because this is the chapter's own room. The order of
   the Hour is the one place on the site where sequence is the content: a
   reader who wants to know whether the Sun rising in the west comes before
   or after the Dajjal is asking exactly what these fields answer, and the
   answer was already written. */
const seqBand = q => (q && (q.phase || q.position || q.note)) ? `<section class="n2-idea n2-short">
<p class="n2-eyebrow">Where it falls</p>
<ul class="n2-facts">${q.phase ? `<li><span>Phase</span><b>${esc(q.phase)}</b></li>` : ""}${q.position ? `<li><span>Position</span><b>${esc(q.position)}</b></li>` : ""}</ul>
${q.note ? `<p class="n2-dim" style="margin-top:12px">${esc(q.note)}</p>` : ""}
</section>` : "";
/* The label is the event; the line under it is where it is written. Nothing
   is invented here: every detail line in the data already carries its own
   source, so the spine is the data and not a gloss on it. */
const timeline = rows => (rows && rows.length) ? `<p class="n2-eyebrow">The order of events</p><ol class="n2-tl">${rows.map(r =>
  `<li><b>${esc(r.label || "")}</b>${r.detail ? `<small>${esc(r.detail)}</small>` : ""}</li>`).join("")}</ol>` : "";
const shield = rows => (rows && rows.length) ? `<p class="n2-eyebrow" style="margin-top:26px">The shield</p><ul class="n2-shield">${rows.map(r =>
  `<li>${esc(r)}</li>`).join("")}</ul>` : "";
function chapterPage(nRaw) {
  const n = Number(nRaw);
  const N = chapter(n);
  if (!N) return notFound("chapter");
  const list = chapters();
  const prev = list.find(c => c.id === n - 1), next = list.find(c => c.id === n + 1);
  const url = "/path/" + n;
  const img = (N.image && /^assets\/[\w./-]+\.(jpg|jpeg|png|webp)$/.test(N.image) && !HELD_BACK.has(N.image) && fs.existsSync(fileOf(N.image))) ? "/" + N.image : "";
  const hook = chapterHook(N.titleEn);
  const words = relatedWords(N.titleEn + " " + N.summary + " " + (N.lessons || []).join(" "));
  const conns = (N.connections || []).map(i => list.find(c => c.id === i)).filter(Boolean);
  const body = `<section class="n2-idea n2-in">
<p class="n2-eyebrow">The Path <small>· chapter ${n} of ${list.length} · ${esc(periodName(N.period))}</small></p>
${N.titleAr ? `<p class="n2-title-ar" lang="ar">${esc(N.titleAr)}</p>` : ""}
<h1 class="n2-h1">${hook}</h1>
<p class="n2-meaning">${esc(N.summary || "")}</p>
${img ? `<div class="n2-image" role="img" aria-label="${attr(N.titleEn)}" style="background-image:url('${attr(img)}')"></div>` : ""}
<div class="n2-row">${go("#story", "Read on", true)}${shareBtn(N.titleEn + " · The Path of Creation, chapter " + n + " · NOOR", SITE + url)}</div>
</section>
${seqBand(N.sequence)}
<section class="n2-idea n2-short" id="story"${guideKeys().has("n:" + n) ? ` data-guide="n:${n}"` : ""}>
<p class="n2-eyebrow">The chapter</p>
${paras(unmark(N.details || ""))}
</section>
${(N.quran || []).length ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The Qur'an on it</p>` + N.quran.map(q => {
  const r = parseRef(q.ref);
  return `<div class="n2-quote">${q.ar ? `<p class="n2-quran" lang="ar">${esc(q.ar)}</p>` : ""}<p class="n2-p">${esc(q.en || "")}</p><p class="n2-ref">${r ? `<a href="/verse/${r.id}">Qur'an ${esc(q.ref)}</a>` : "Qur'an " + esc(q.ref)}</p></div>`;
}).join("") + "</section>" : ""}
${(N.hadith || []).length ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The narrations</p>` + N.hadith.map(h =>
  `<div class="n2-quote"><p class="n2-p">${esc(h.text)}</p><p class="n2-src">${esc(h.source || "")}</p></div>`).join("") + "</section>" : ""}
${(N.timeline || []).length || (N.protection || []).length ? `<section class="n2-idea n2-short" id="order">` +
  timeline(N.timeline) + shield(N.protection) + "</section>" : ""}
${(N.lessons || []).length || (N.facts || []).length ? `<section class="n2-idea n2-short">` +
  ((N.lessons || []).length ? `<p class="n2-eyebrow">What it teaches</p><ul class="n2-list">${N.lessons.map(l => `<li><a href="#story"><b>${esc(l)}</b></a></li>`).join("")}</ul>` : "") +
  ((N.facts || []).length ? `<p class="n2-eyebrow" style="margin-top:22px">The facts</p><ul class="n2-facts">${N.facts.map(f => `<li><span>${esc(f.label)}</span><b>${esc(f.value)}</b></li>`).join("")}</ul>` : "") + "</section>" : ""}
<section class="n2-idea n2-short" id="beside">
<p class="n2-eyebrow">Read beside it</p>
${wordList(words, "The words")}
${conns.length ? `<p class="n2-eyebrow">Connected chapters</p><ul class="n2-list">${conns.map(c => `<li><a href="/path/${c.id}"><span class="n2-num">${c.id}</span><b>${esc(c.titleEn)}</b><span class="n2-ar" lang="ar">${esc(c.titleAr || "")}</span></a></li>`).join("")}</ul>` : ""}
${walk(prev && ["/path/" + prev.id, prev.titleEn, "Chapter " + prev.id], next && ["/path/" + next.id, next.titleEn, "Chapter " + next.id])}
<div class="n2-row">${go("/path", "All " + list.length + " chapters")}${go("/?node=" + n, "In the Path room")}</div>
</section>`;
  return { status: 200, html: shell({
    title: N.titleEn + " · The Path, chapter " + n, path: url, desc: chapterDesc(N), active: "/path",
    crumbs: [["The Path of Creation", "/path"], [N.titleEn, url]], pill: ["/path", "The Path"],
    image: img ? SITE + img : "",
    ld: [{ "@context": "https://schema.org", "@type": "Article", headline: N.titleEn, alternativeHeadline: N.titleAr || undefined, description: clip(N.summary, 200),
      url: SITE + url, mainEntityOfPage: SITE + url, image: img ? SITE + img : OG_DEFAULT, inLanguage: "en", position: n,
      isPartOf: { "@type": "CreativeWorkSeries", name: "The Path of Creation", url: SITE + "/path" },
      author: { "@type": "Organization", name: "NOOR Codex of Light", url: SITE },
      publisher: { "@type": "Organization", name: "NOOR Codex of Light", url: SITE, logo: { "@type": "ImageObject", url: SITE + "/assets/brand/mark-512.png" } } }],
    body }) };
}
/* The quiet guide. noor-guide.js has answered from the sources on the thirty
   chapters that carry a curated topic -- the Dajjal, the grave, the trials,
   Harut and Marut -- since it was written, and its two scripts came off the
   site the day the home was rebuilt. This is the chapter's own room, the
   fullest telling of it and what search sends a reader to, so it is the first
   place the pill belongs.

   The room says nothing but which topic its story wants; noor-fx.js, which is
   on every page already, fetches the 61KB of answers and hangs the pill. One
   mechanism for the arrival and the rooms both, and the room ships no script
   of its own. The keys are read here so a chapter with no topic asks for
   nothing at all -- which is why noor-guide-data.js is in this function's
   includeFiles, and why losing it costs a missing pill and never an error. */
let GUIDE_KEYS = null;
function guideKeys() {
  if (GUIDE_KEYS) return GUIDE_KEYS;
  GUIDE_KEYS = new Set();
  try {
    const src = fs.readFileSync(fileOf("noor-guide-data.js"), "utf8");
    for (const m of src.matchAll(/"(n:\d+|c:[a-z0-9-]+)"\s*:/g)) GUIDE_KEYS.add(m[1]);
  } catch { /* no data file, no pill: attach() would be a no-op anyway */ }
  return GUIDE_KEYS;
}
function pathIndex() {
  const list = chapters();
  const body = `<section class="n2-idea n2-short n2-in">
<p class="n2-eyebrow">The Path of Creation <small>· ${list.length} chapters</small></p>
<h1 class="n2-h1">The whole story, <span class="n2-g">in order</span></h1>
<p class="n2-dim">From Kun Fayakun to the Hour, in ${list.length} chapters, each with its verses, its narrations and its facts.</p>
</section>` + PERIOD_ORDER.filter(p => list.some(c => c.period === p)).map(p => `<section class="n2-idea n2-short n2-group" id="${p}">
<h2 class="n2-h3">${esc(periodName(p))}</h2>
${periodDesc(p) ? `<p class="n2-dim">${esc(periodDesc(p))}</p>` : ""}
<ul class="n2-list">${list.filter(c => c.period === p).map(c => `<li><a href="/path/${c.id}"><span class="n2-num">${c.id}</span><b>${esc(c.titleEn)}${c.metric ? `<small>${esc(c.metric)}</small>` : ""}</b><span class="n2-ar" lang="ar">${esc(c.titleAr || "")}</span></a></li>`).join("")}</ul>
</section>`).join("\n");
  return { status: 200, html: shell({ title: "The Path of Creation", path: "/path", desc: "The story of Islam told in order, from Kun Fayakun to the Hour, in " + list.length + " chapters.",
    ogType: "website", mode: "reveal top bar share home", active: "/path", crumbs: [["The Path of Creation", "/path"]],
    ld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "The Path of Creation", url: SITE + "/path", numberOfItems: list.length }], body }) };
}

/* ---------------------------------------------------------------------------
   one verse, with its reel
--------------------------------------------------------------------------- */
async function versePage(refRaw) {
  const ref = parseRef(refRaw);
  if (!ref) return notFound("verse");
  const url = "/verse/" + ref.id;
  const rows = await manifest();
  const row = rows.find(r => r && r.kind === "verse" && refOfRow(r) === ref.s + ":" + ref.a + (ref.b > ref.a ? "-" + ref.b : "")) || null;
  const isUrl = v => typeof v === "string" && /^https:\/\//.test(v);
  const video = row ? (isUrl(row.video) ? row.video : "/reels/" + row.id + ".mp4") : "";
  const cover = row ? (isUrl(row.cover) ? row.cover : (row.cover ? "/reels/" + row.id + "-cover.jpg" : "")) : "";
  const texts = [];
  /* once the English fails for one verse of a range, it is not asked for the
     rest: the service is down or slow, and waiting on it once per verse
     turned a 21 verse range into two minutes of nothing for the reader */
  let askEnglish = true;
  for (let a = ref.a; a <= ref.b; a++) {
    const t = await verseText(ref.s, a, askEnglish);
    if (!t) { texts.length = 0; break; }
    if (!t.en) askEnglish = false;
    texts.push(t);
  }
  /* the English came back for every verse, or the page is not whole */
  const whole = texts.length > 0 && texts.every(t => t.en);
  /* the surah's name always comes from the reels' own uthmani table, never
     the live API's englishName: the API and the table spell 63 of the 109
     surahs with shelf verses differently, and a room, a caption and a
     sitemap must all print the same one (content-009) */
  const name = (surahRow(ref.s) || {}).translit || "";
  const mushaf = "/quran?surah=" + ref.s + "&ayah=" + ref.a;
  const english = whole ? texts.map(t => t.en).join(" ") : "";
  const reciter = row && row.reciter ? String(row.reciter) : "";
  const shareText = "Qur'an " + ref.label + (english ? ": " + clip(english, 200) : "") + " · NOOR Codex of Light";
  /* the reel has a screen of its own after the text: a reader who arrived
     from the reel wants the words first, and a phone cannot hold both */
  const reel = row ? `<section class="n2-idea" id="reel">
<p class="n2-eyebrow">The reel${reciter ? ` <small>· recited by ${esc(reciter)}</small>` : ""}</p>
<div class="n2-reel" id="reelbox">
<video playsinline preload="none"${cover ? ` poster="${attr(cover)}"` : ""} src="${attr(video)}" aria-label="The reel for Qur'an ${attr(ref.label)}"></video>
<button class="n2-play" type="button" aria-label="Play the reel"><span>${SVG.play}</span></button>
</div>
<p class="n2-credit">The recitation alone, nothing under it</p>
</section>` : "";
  const textBlock = texts.length
    ? `<p class="n2-quran" lang="ar" translate="no">${texts.map(t => esc(t.ar)).join(" ")}</p>
${whole ? `<p class="n2-meaning">${texts.map(t => `<span class="n2-s">${esc(t.en)}</span>`).join("")}</p>
<p class="n2-credit">Saheeh International</p>` : `<p class="n2-p">Its meaning in English is a moment away on the <a href="${attr(mushaf)}">Mushaf</a>.</p>`}`
    : `<p class="n2-ref">Qur'an ${esc(ref.label)}${name ? " · " + esc(name) : ""}</p>
<p class="n2-p">The text of this verse, in the Uthmani script with its meaning, is on the Mushaf.</p>
${reciter ? `<p class="n2-credit">Recited by ${esc(reciter)}</p>` : ""}`;
  /* WHAT IT SAYS, BEFORE ANYTHING ELSE ASKS. Where the library has already
     written a verse's sense and its words one by one (1,280 verses), the room
     now shows them under the text: the plain answer to "what does this verse
     mean", in the house's own checked words, with nothing generated. For a
     range, the first verse carries the sense. */
  const vn = verseNotes(ref.s, ref.a);
  const gloss = vn && Array.isArray(vn.words) && vn.words.length && ref.a === ref.b
    ? `<p class="n2-eyebrow">Word by word</p><p class="n2-p">${vn.words.map(w => `<span lang="ar" translate="no">${esc(w.a)}</span> <small>${esc(w.t || "")}</small> ${esc(w.g || "")}`).join(" · ")}</p>` : "";
  const sense = vn && vn.sense ? `<section class="n2-idea n2-short" id="sense">
<p class="n2-eyebrow">What it says${ref.b > ref.a ? ` <small>· verse ${ref.a}</small>` : ""}</p>
<p class="n2-p">${esc(vn.sense)}</p>
${gloss}
</section>` : "";
  const words = relatedWords((row && row.caption ? row.caption : "") + " " + english + " " + (vn && vn.sense ? vn.sense : ""));
  const others = (await verseRows()).filter(r => r.ref && r.ref.split(":")[0] === String(ref.s) && r.id !== "verse-" + ref.id).slice(0, 8);
  const body = `<section class="n2-idea n2-in">
<h1 class="n2-h1">Qur'an ${esc(ref.label)}${name ? ` <span class="n2-g">${esc(name)}</span>` : ""}</h1>
${textBlock}
<div class="n2-row">${row ? go("#reel", "The reel", true) : ""}${go(mushaf, "The Mushaf", !row)}${shareBtn(shareText, SITE + url)}</div>
</section>
${sense}
${reel}
<section class="n2-idea n2-short" id="beside">
<p class="n2-eyebrow">Read beside it</p>
${wordList(words, "The words")}
${others.length ? `<p class="n2-eyebrow">More of ${esc(name || "the surah")} on the shelf</p><ul class="n2-list">${others.map(r => `<li><a href="/verse/${attr(r.ref.replace(":", "-"))}"><span class="n2-num">${esc(r.ref)}</span><b>${esc(r.hook && r.hook !== r.ref ? r.hook : "Qur'an " + r.ref)}</b></a></li>`).join("")}</ul>` : ""}
<div class="n2-row">${go("/surah/" + ref.s, "Surah " + (name || ref.s))}${go(mushaf, "The Mushaf")}${go("/verses", "Every verse on the shelf")}</div>
</section>`;
  const tail = row ? `<script>(function(){var r=document.getElementById("reelbox"),v=r&&r.querySelector("video"),b=r&&r.querySelector(".n2-play");if(!v||!b)return;
b.addEventListener("click",function(){v.setAttribute("controls","");v.play().then(function(){r.classList.add("n2-playing")}).catch(function(){})});
v.addEventListener("pause",function(){r.classList.remove("n2-playing")});v.addEventListener("play",function(){r.classList.add("n2-playing")});})();</script>` : "";
  return { status: 200, html: shell({
    title: "Qur'an " + ref.label + (name ? ", " + name : ""), path: url,
    desc: english ? clip(english, 158) : (vn && vn.sense ? clip(vn.sense, 158) : "Qur'an " + ref.label + (name ? ", Surah " + name : "") + ": the Arabic, its meaning and its recitation."),
    active: "/quran", crumbs: [["The verses", "/verses"], ["Qur'an " + ref.label, url]], pill: ["/verses", "The shelf"],
    image: cover && isUrl(cover) ? cover : (cover ? SITE + cover : ""),
    ld: [{ "@context": "https://schema.org", "@type": "CreativeWork", name: "Qur'an " + ref.label + (name ? " · " + name : ""), url: SITE + url,
      description: english ? clip(english, 200) : undefined, inLanguage: ["ar", "en"],
      isPartOf: { "@type": "Book", name: name ? "Surah " + name : "The Qur'an", url: SITE + "/surah/" + ref.s },
      ...(row ? { video: { "@type": "VideoObject", name: "Qur'an " + ref.label, description: english ? clip(english, 200) : "A verse of the Qur'an, recited.",
        contentUrl: isUrl(video) ? video : SITE + video, thumbnailUrl: cover ? (isUrl(cover) ? cover : SITE + cover) : OG_DEFAULT, uploadDate: MAN.written || undefined } } : {}) }],
    body, tail }), cache: whole ? undefined : "public, s-maxage=600, stale-while-revalidate=3600" };
}
async function versesIndex() {
  const rows = await verseRows();
  const groups = new Map();
  for (const r of rows) { const s = +r.ref.split(":")[0]; if (!groups.has(s)) groups.set(s, []); groups.get(s).push(r); }
  const keys = [...groups.keys()].sort((a, b) => a - b);
  const fromShelf = rows.length && rows[0].shelf;
  const body = `<section class="n2-idea n2-short n2-in">
<p class="n2-eyebrow">One verse <small>· ${rows.length} on the shelf</small></p>
<h1 class="n2-h1">One verse, <span class="n2-g">one thought</span></h1>
<p class="n2-dim">${rows.length} verses${fromShelf ? " chosen for the shelf" : ", each with its reel, its recitation and its meaning"}, grouped by surah.</p>
<div class="n2-row">${go("/quran", "The whole Mushaf", true)}</div>
</section>` + keys.map(s => { const sr = surahRow(s); return `<section class="n2-idea n2-short n2-group" id="s${s}">
<h2 class="n2-h3"><a class="n2-list-a" href="/surah/${s}">${sr ? esc(sr.translit) : "Surah " + s} <span class="n2-g">· ${s}</span></a></h2>
<ul class="n2-list">${groups.get(s).map(r => `<li><a href="/verse/${attr(r.ref.replace(":", "-"))}"><span class="n2-num">${esc(r.ref)}</span><b>${esc(r.hook && r.hook !== r.ref ? r.hook : "Qur'an " + r.ref)}</b></a></li>`).join("")}</ul>
</section>`; }).join("\n");
  return { status: 200, html: shell({ title: "The verses", path: "/verses", desc: rows.length + " verses of the Qur'an on the shelf, each with its recitation and its meaning, grouped by surah.",
    ogType: "website", mode: "reveal top bar share home", active: "/quran", crumbs: [["The verses", "/verses"]],
    ld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "The verses", url: SITE + "/verses", numberOfItems: rows.length }], body }) };
}

/* ---------------------------------------------------------------------------
   one surah
--------------------------------------------------------------------------- */
/* study/1..114.json were each written with four fields the surah page has
   never drawn: movements (the surah cut into its passages, 511 of them,
   each with its verse range), passages (432 verses worth knowing, each with
   why), virtue (what is said about reciting it, with its source AND a
   grading of that source), and connections (229 links between surahs, each
   with the reason they travel together). Two hundred and eighty-three
   kilobytes of written, sourced study, on every one of the hundred and
   fourteen surah pages, read by nothing.

   The grading is the reason virtue is drawn at all. Fifty-six surahs are
   marked "none" and say so plainly -- no authentic report establishes a
   merit for reciting this one -- and twenty-two are marked "debated" and
   name the dispute. A library that prints the famous virtue of every surah
   without saying which are established is doing the reader harm; this data
   was written not to. The badge is the house's own, the one the parchment
   rooms have worn since the first cut, in the shell's dialect. */
const EV = { sunnah: ["n2-ev-sunnah", "Sunnah-confirmed", "established by authentic hadith"],
             debated: ["n2-ev-debated", "Scholars differ", "the gradings are not settled"],
             none: ["n2-ev-none", "No virtue report", "no authentic report establishes a merit for reciting it"] };
const evBadge = level => { const e = EV[level]; return e ? `<span class="n2-ev ${e[0]}" role="img" aria-label="${attr(e[1] + ": " + e[2])}">${esc(e[1])}</span>` : ""; };
/* A movement is a range of the surah, so it opens the Mushaf at its first
   verse rather than telling the reader to go and find it. */
const movements = (rows, n) => (rows && rows.length) ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">How it moves</p><ul class="n2-list">${rows.map(m => {
  const start = String(m.range || "").match(/\d+/);
  const href = start ? "/quran?surah=" + n + "&ayah=" + start[0] : "/quran?surah=" + n;
  return `<li><a href="${attr(href)}"><span class="n2-num">${esc(m.range || "")}</span><b>${esc(m.h || "")}${m.note ? `<small>${esc(m.note)}</small>` : ""}</b></a></li>`;
}).join("")}</ul></section>` : "";
const passages = (rows, n) => (rows && rows.length) ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">Verses worth knowing</p><ul class="n2-list n2-notes">${rows.map(v => {
  const r = parseRef(v.ref);
  const href = r ? "/verse/" + r.id : "/quran?surah=" + n;
  return `<li><a href="${attr(href)}"><span class="n2-num">${esc(v.ref || "")}</span><b>${esc(v.why || "")}</b></a></li>`;
}).join("")}</ul></section>` : "";
/* On the fifty-six surahs with no established virtue, src is the sentence
   "no authentic virtue report" -- which is what the badge already says. A
   source line is printed only when it cites something: a book and a number. */
const cites = src => /\d/.test(String(src || ""));
const virtue = v => (v && v.text) ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">On reciting it</p>
<p class="n2-p">${esc(v.text)}</p>
<p class="n2-src">${evBadge(v.level)}${cites(v.src) ? esc(v.src) : ""}</p></section>` : "";
async function surahPage(nRaw) {
  const n = Number(nRaw);
  if (!(Number.isInteger(n) && n >= 1 && n <= 114)) return notFound("surah");
  const url = "/surah/" + n;
  const api = await surahMeta(n);
  const row = surahRow(n);
  /* the name is always the reels' own uthmani table, never the live API's
     englishName (content-009); the API still supplies the meaning, the
     ayah count and the place of revelation, none of which the table has */
  const name = (row && row.translit) || ("Surah " + n);
  const ar = (api && api.name) || (row && row.name) || "";
  const meaning = api && api.englishNameTranslation || "";
  const count = (api && api.numberOfAyahs) || (row && row.count) || 0;
  const place = (api && api.revelationType) || (row && row.type) || "";
  const placeName = /mecc|makk/i.test(place) ? "Makkah" : (/medin|madin/i.test(place) ? "Madinah" : place);
  const S = study(n) || {};
  const verses = (await verseRows()).filter(r => +r.ref.split(":")[0] === n);
  const prevRow = n > 1 ? surahRow(n - 1) : null, nextRow = n < 114 ? surahRow(n + 1) : null;
  const body = `<section class="n2-idea n2-in">
<p class="n2-eyebrow">Surah ${n} of 114${placeName ? ` <small>· ${esc(placeName)}</small>` : ""}</p>
${ar ? `<p class="n2-title-ar" lang="ar">${esc(ar)}</p>` : ""}
<h1 class="n2-h1">${esc(name)}${meaning ? ` <span class="n2-g">${esc(meaning)}</span>` : ""}</h1>
<p class="n2-dim">${count ? count + " verses" : ""}${count && placeName ? " · " : ""}${placeName ? "revealed in " + esc(placeName) : ""}</p>
<div class="n2-row">${go("/quran?surah=" + n, "Read and listen", true)}${shareBtn("Surah " + name + (meaning ? " (" + meaning + ")" : "") + " · NOOR Codex of Light", SITE + url)}</div>
</section>
${(S.context || []).length ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The context</p>${S.context.map(p => `<p class="n2-p">${esc(p)}</p>`).join("")}</section>` : ""}
${S.name_story ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The name</p>${paras(esc(S.name_story))}</section>` : ""}
${movements(S.movements, n)}
${(S.themes || []).length ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The themes</p>${S.themes.map(t => `<h2 class="n2-h3">${esc(t.t)}</h2><p class="n2-p">${esc(t.d)}</p>`).join("")}</section>` : ""}
${(S.heart || []).length ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The heart of it</p>${S.heart.map(p => `<p class="n2-p">${esc(p)}</p>`).join("")}</section>` : ""}
${passages(S.passages, n)}
${virtue(S.virtue)}
<section class="n2-idea n2-short" id="beside">
<p class="n2-eyebrow">Read beside it</p>
${verses.length ? `<p class="n2-eyebrow">On the shelf</p><ul class="n2-list">${verses.map(r => `<li><a href="/verse/${attr(r.ref.replace(":", "-"))}"><span class="n2-num">${esc(r.ref)}</span><b>${esc(r.hook && r.hook !== r.ref ? r.hook : "Qur'an " + r.ref)}</b></a></li>`).join("")}</ul>` : ""}
${(S.connections || []).length ? `<p class="n2-eyebrow">Surahs it travels with</p><ul class="n2-list">${S.connections.map(c => {
  const to = surahRow(+c.to);
  return to ? `<li><a href="/surah/${+c.to}"><span class="n2-num">${+c.to}</span><b>${esc(to.translit)}${c.why ? `<small>${esc(c.why)}</small>` : ""}</b><span class="n2-ar" lang="ar">${esc(to.name || "")}</span></a></li>` : "";
}).join("")}</ul>` : ""}
${walk(prevRow && ["/surah/" + (n - 1), prevRow.translit, "Surah " + (n - 1)], nextRow && ["/surah/" + (n + 1), nextRow.translit, "Surah " + (n + 1)])}
<div class="n2-row">${go("/quran?surah=" + n, "The Mushaf")}${go("/verses", "Every verse on the shelf")}</div>
</section>`;
  const desc = clip((count ? count + " verses" : "") + (placeName ? ", revealed in " + placeName + ". " : ". ") + ((S.context || [])[0] || S.name_story || ""), 158);
  return { status: 200, html: shell({
    title: "Surah " + name + " (" + n + ")", path: url, desc, active: "/quran", crumbs: [["The Mushaf", "/quran"], ["Surah " + name, url]], pill: ["/quran", "The Mushaf"],
    ld: [{ "@context": "https://schema.org", "@type": "Chapter", name: "Surah " + name, alternateName: ar || undefined, position: n, url: SITE + url,
      description: desc, inLanguage: ["ar", "en"], publisher: PUBLISHER,
      isPartOf: { "@type": "Book", name: "The Qur'an", inLanguage: "ar", url: SITE + "/quran" } }],
    body }) };
}

/* ---------------------------------------------------------------------------
   the day: the same light the home page shows, then the day's word and chapter
--------------------------------------------------------------------------- */
async function dayLight(host, date, today) {
  /* the home page's own answer first: the record of what shone that day,
     already chosen and audited, cached at the edge. The host is pinned the
     way the reels pin theirs (noorcodex.com and its own previews), never a
     header a client can write. */
  const j = await getJSON("https://" + manifestHost(host) + "/api/illuminations?kind=light" + (date === today ? "" : "&date=" + date));
  if (j && j.title) return j;
  /* the picker's arithmetic on the library file, without the store's memory:
     the same score, so on most days the same card; never nothing */
  const ranked = scoreLights(lights(), date, [], []);
  const top = ranked[0] && ranked[0].L;
  if (!top) return null;
  return { date, category: top.c, title: top.t, story: top.s, detail: top.d, id: top.id, src: top.src || "", source: "library" };
}
const untilMidnight = () => {
  const now = Date.now(), midnight = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() + 1);
  return "public, max-age=0, s-maxage=" + Math.max(60, Math.floor((midnight - now) / 1000));
};
async function todayPage(dateRaw, host) {
  const today = isoDate(new Date());
  let date = String(dateRaw || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = today;
  const age = Math.floor((Date.parse(today) - Date.parse(date)) / 86400000);
  if (!(age >= 0 && age <= 30)) date = today;
  const isToday = date === today;
  const card = await dayLight(host, date, today);
  const h = hijriOf(date);
  const menu = menuIndex();
  const w = pickWord(menu.words || [], date);
  const entry = w && dictionary()[w.i] ? { id: w.i, ...dictionary()[w.i] } : null;
  const c = pickChapter(menu.path || [], date);
  const node = c && c.i != null ? chapter(Number(c.i)) : null;
  const url = "/today" + (isToday ? "" : "?date=" + date);
  /* today's page turns over at midnight UTC, so the edge may keep it only
     until then; a dated page is a record and keeps for a day */
  const cache = isToday ? untilMidnight() : CACHE;
  const shift = k => { const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + k); return isoDate(d); };
  const prev = age < 30 ? ["/today?date=" + shift(-1), longDate(shift(-1)), "The day before"] : null;
  const next = age > 0 ? [(age === 1 ? "/today" : "/today?date=" + shift(1)), longDate(shift(1)), "The day after"] : null;
  const body = `<section class="n2-idea n2-in">
<p class="n2-eyebrow">${isToday ? "Today's light" : "The light of the day"} <small>· ${esc(shortDate(date))}</small></p>
${card ? `<h1 class="n2-h1">${keyPhrase(card.title)}</h1>
${paras(esc(card.story))}
${card.detail ? `<p class="n2-date">${esc(card.detail)}</p>` : ""}
${card.src ? `<p class="n2-src">Source · ${esc(card.src)}</p>` : ""}
<p class="n2-src">${esc(longDate(date))} · ${h.d} ${esc(hijriName(h.m))} ${h.y} AH</p>
<div class="n2-row">${card.id && lightById(card.id) ? go("/light/" + card.id, "The whole Light", true) : go("/light", "The Lights", true)}${shareBtn(card.title + " · NOOR Codex of Light", SITE + (card.id && lightById(card.id) ? "/light/" + card.id : "/today"))}</div>`
  : `<h1 class="n2-h1">The lantern is <span class="n2-g">resting</span></h1><p class="n2-p">The day's Light could not be read just now. The rest of the library is open.</p><div class="n2-row">${go("/light", "The Lights", true)}</div>`}
</section>
${entry ? `<section class="n2-idea">
<p class="n2-eyebrow">The word <small>· ${esc(entry.cat || "")}</small></p>
<p class="n2-word-ar" lang="ar">${esc(entry.a)}</p>
<p class="n2-translit">${esc(entry.t)}</p>
<p class="n2-meaning">${esc(entry.s)}</p>
${entry.l ? `<p class="n2-dim">${esc(clip(entry.l, 420))}</p>` : ""}
<div class="n2-row">${go("/dictionary/" + entry.id, "The whole entry", true)}${shareBtn(entry.t + ", " + entry.a + ": " + entry.s + " · NOOR Codex of Light", SITE + "/dictionary/" + entry.id)}</div>
</section>` : ""}
${node ? `<section class="n2-idea">
<p class="n2-eyebrow">The Path <small>· chapter ${node.id} of ${chapters().length}</small></p>
${node.titleAr ? `<p class="n2-title-ar" lang="ar">${esc(node.titleAr)}</p>` : ""}
<h2 class="n2-h2">${chapterHook(node.titleEn)}</h2>
<p class="n2-p">${esc(node.summary || "")}</p>
${(node.lessons || []).length ? `<p class="n2-dim">${esc(node.lessons[0])}</p>` : ""}
<div class="n2-row">${go("/path/" + node.id, "Read the chapter", true)}</div>
</section>` : ""}
<section class="n2-idea n2-short">
<p class="n2-eyebrow">The library</p>
<h2 class="n2-h2">The whole library, <span class="n2-g">free</span></h2>
<p class="n2-dim">No ads, no account, no tracking. Every room on the phone, under the thumb.</p>
${ROOMS()}
${walk(prev, next)}
</section>`;
  /* Audit seo-026: a dated day (not /today itself) shows the same Light as
     /light/<id>; its canonical points there rather than at itself, so the
     two are not near-duplicates competing in the index. /today, the day's
     own address, keeps its own canonical, since nothing else answers it. */
  const canonical = (!isToday && card && card.id && lightById(card.id)) ? SITE + "/light/" + card.id : undefined;
  return { status: 200, html: shell({
    title: isToday ? "Today's light" : "The light of " + longDate(date), path: url, ogType: "website", canonical,
    desc: card ? clip(card.title + ". " + card.story, 158) : "One Light, one word and one chapter of the Path, every day.",
    active: "/today", crumbs: [["Today", "/today"]],
    ld: [{ "@context": "https://schema.org", "@type": "WebPage", name: "Today's light", url: SITE + url, datePublished: date,
      description: card ? clip(card.story, 200) : undefined, inLanguage: "en" }],
    body }), cache };
}

/* ---------------------------------------------------------------------------
   the prophets, the companions and the other characters, the places, the Names
--------------------------------------------------------------------------- */
/* About 46,000 sourced words sat in three script files and one page and
   showed only in a modal on tap: no title, no address, no preview, no
   structured data, nothing a crawler could read or a reader could keep.
   These rooms are those files, whole, in the shell: the concise answer
   first, the Arabic, the account, the facts, the Qur'an and the narrations
   with their sources as the data carries them, then what the library ties
   the entity to. No room carries a picture of a person; the share image is
   the house's own og.png. */
const PUBLISHER = { "@type": "Organization", name: "NOOR Codex of Light", url: SITE, logo: { "@type": "ImageObject", url: SITE + "/assets/brand/mark-512.png" } };
const factsList = rows => (rows && rows.length) ? `<ul class="n2-facts">${rows.filter(f => f && f.label != null && f.value != null).map(f => `<li><span>${esc(f.label)}</span><b>${esc(f.value)}</b></li>`).join("")}</ul>` : "";
const quranBlock = rows => (rows && rows.length) ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The Qur'an on it</p>` + rows.filter(q => q && q.ref).map(q =>
  `<div class="n2-quote">${q.ar ? `<p class="n2-quran" lang="ar">${esc(q.ar)}</p>` : ""}${q.en ? `<p class="n2-p">${esc(q.en)}</p>` : ""}${q.note ? `<p class="n2-p">${esc(q.note)}</p>` : ""}<p class="n2-ref"><a href="${attr(refHref(q.ref))}">Qur'an ${esc(q.ref)}</a></p></div>`).join("") + "</section>" : "";
const hadithBlock = rows => (rows && rows.length) ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The narrations</p>` + rows.filter(Boolean).map(h =>
  `<div class="n2-quote"><p class="n2-p">${esc(typeof h === "string" ? h : h.text)}</p>${(h.source || h.src) ? `<p class="n2-src">${esc(h.source || h.src)}</p>` : ""}</div>`).join("") + "</section>" : "";
/* a person or a place of the graph as a row: its room, its name, its Arabic */
function entityRef(key) {
  const [fam, id] = String(key || "").split(":");
  if (fam === "prophet") { const p = prophetById(id); return p && { href: "/prophet/" + p.id, t: p.en, ar: p.ar || "", s: p.epithet || "" }; }
  if (fam === "companion" || fam === "character") { const c = characterById(id); return c && { href: characterRoom(c), t: c.titleEn, ar: c.titleAr || "", s: c.role || "" }; }
  if (fam === "place") { const p = placeById(id); return p && { href: "/place/" + p.id, t: p.titleEn, ar: p.titleAr || "", s: p.role || "" }; }
  return null;
}
const refList = (rows, eyebrow) => rows.length ? `<p class="n2-eyebrow">${eyebrow}</p><ul class="n2-list">${rows.map(r =>
  `<li><a href="${attr(r.href)}"><b>${esc(r.t)}${r.s ? `<small>${esc(r.s)}</small>` : ""}</b>${r.ar ? `<span class="n2-ar" lang="ar">${esc(r.ar)}</span>` : ""}</a></li>`).join("")}</ul>` : "";
const chapterList = (ns, eyebrow) => { const rows = ns.map(n => chapters().find(c => c.id === n)).filter(Boolean); return rows.length ? `<p class="n2-eyebrow">${eyebrow}</p><ul class="n2-list">${rows.map(c =>
  `<li><a href="/path/${c.id}"><span class="n2-num">${c.id}</span><b>${esc(c.titleEn)}</b><span class="n2-ar" lang="ar">${esc(c.titleAr || "")}</span></a></li>`).join("")}</ul>` : ""; };
/* the room's own name, for relatedWords()'s self guard: a prophet, a
   companion, a character, a place or one of the Names, by the same key
   besideEntity is called with */
function selfNameOf(key) {
  const [fam, id] = String(key || "").split(":");
  if (fam === "prophet") return (prophetById(id) || {}).en || "";
  if (fam === "companion" || fam === "character") return (characterById(id) || {}).titleEn || "";
  if (fam === "place") return (placeById(id) || {}).titleEn || "";
  if (fam === "name") { const n = nameRow(Number(id)); return n ? n.translit : ""; }
  return "";
}
/* "Read beside it" for one of these rooms: the word for the same entity
   first, then the words its own text names, then the words that name it;
   the Lights that name it; the chapters; the people and places named either
   way; the stories written from a Name. All of it from the graph's edges,
   except the words the text names, which relatedWords() reads as every
   room does, told never to call the room's own name a related word unless
   the dictionary entry really is this entity (E.word, the graph's curated
   same-as). */
function besideEntity(key, text, extra) {
  const E = edgesOf(key), D = dictionary();
  const word = id => (id && D[id]) ? { id, ...D[id] } : null;
  const seen = new Set(), words = [];
  const self = { name: selfNameOf(key), same: E.word || "" };
  for (const w of [word(E.word), ...relatedWords(text, 6, self), ...(Array.isArray(E.words) ? E.words : []).map(word)]) if (w && !seen.has(w.id)) { seen.add(w.id); words.push(w); }
  const lightsL = (Array.isArray(E.lights) ? E.lights : []).map(lightById).filter(Boolean).slice(0, 8);
  const people = (Array.isArray(E.people) ? E.people : []).map(entityRef).filter(Boolean);
  const placesL = (Array.isArray(E.places) ? E.places : []).map(id => entityRef("place:" + id)).filter(Boolean);
  /* the eight stories are static pages, not in this function's bundle, so
     their existence cannot be asked of the disk here: the graph's ids were
     read from stories/ itself and are trusted as read */
  const stories = (Array.isArray(E.stories) ? E.stories : []).filter(s => /^[a-z0-9-]+$/.test(s));
  return `<section class="n2-idea n2-short" id="beside">
<p class="n2-eyebrow">Read beside it</p>
${wordList(words.slice(0, 8), "The words")}
${lightList(lightsL, "Lights that name it")}
${chapterList(Array.isArray(E.chapters) ? E.chapters : [], "On the Path")}
${refList(people, "People beside it")}
${refList(placesL, "Places")}
${stories.length ? `<p class="n2-eyebrow">A story</p><ul class="n2-list">${stories.map(s => `<li><a href="/stories/${attr(s)}"><b>${esc(s.charAt(0).toUpperCase() + s.slice(1))}<small>one of the eight stories of the Names</small></b></a></li>`).join("")}</ul>` : ""}
${typeof E.unseen === "string" && /^\/unseen#[\w-]+$/.test(E.unseen) ? `<p class="n2-eyebrow">The Unseen</p><ul class="n2-list"><li><a href="${attr(E.unseen)}"><b>The same figure on the Unseen page</b></a></li></ul>` : ""}
${extra || ""}
</section>`;
}

function prophetPage(idRaw) {
  const list = prophets();
  const i = list.findIndex(p => p.id === String(idRaw || ""));
  const P = i >= 0 ? list[i] : null;
  if (!P) return notFound("prophet");
  const url = "/prophet/" + P.id;
  const prev = list[i - 1], next = list[i + 1];
  const story = Array.isArray(P.story) ? P.story.filter(t => typeof t === "string") : [];
  const text = [P.en, P.epithet, P.blurb, ...story].join(" ");
  const facts = [P.era && { label: "Era", value: P.era }, P.place && { label: "Place", value: P.place },
    Number.isFinite(P.mentions) && { label: "Named in the Qur'an", value: P.mentions + " times" + (P.id === "muhammad" ? ", once as Ahmad" : "") }].filter(Boolean);
  const split = P.split && P.split.a && P.split.b ? [{ label: P.split.a.label, value: P.split.a.years + " years" }, { label: P.split.b.label, value: P.split.b.years + " years" }] : [];
  const body = `<section class="n2-idea n2-in">
<p class="n2-eyebrow">A prophet <small>· link ${i + 1} of ${list.length} in the chain</small></p>
${P.ar ? `<p class="n2-title-ar" lang="ar" translate="no">${esc(P.ar)}</p>` : ""}
<h1 class="n2-h1">${esc(P.en)}</h1>
<p class="n2-meaning">${esc(P.epithet || "")}${P.azm ? (P.epithet ? " · " : "") + "one of the five of firm resolve" : ""}</p>
${P.blurb ? `<p class="n2-p">${esc(P.blurb)}</p>` : ""}
${factsList(facts)}
<div class="n2-row">${go("#story", "The story", true)}${shareBtn(P.en + ", " + (P.epithet || "a prophet") + " · NOOR Codex of Light", SITE + url)}</div>
</section>
<section class="n2-idea n2-short" id="story">
<p class="n2-eyebrow">The story</p>
${story.map(t => `<p class="n2-p">${esc(t)}</p>`).join("\n")}
</section>
${split.length ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">Twenty-three years, two cities</p>${factsList(split)}</section>` : ""}
${Array.isArray(P.seerah) && P.seerah.length ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The Seerah at a glance</p><ol class="n2-tl">${P.seerah.map(e => `<li><b>${esc(e.t)}</b>${e.y ? `<small>${esc(e.y)}</small>` : ""}</li>`).join("")}</ol></section>` : ""}
${quranBlock(Array.isArray(P.verses) ? P.verses : [])}
${hadithBlock(Array.isArray(P.hadith) ? P.hadith : [])}
${Array.isArray(P.figures) && P.figures.length ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">In numbers</p>${factsList(P.figures)}</section>` : ""}
${Array.isArray(P.journey) && P.journey.length ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The journey</p><ol class="n2-tl">${P.journey.map(s => `<li><b>${esc(s)}</b></li>`).join("")}</ol></section>` : ""}
${besideEntity("prophet:" + P.id, text,
  walk(prev && ["/prophet/" + prev.id, prev.en, "Link " + i], next && ["/prophet/" + next.id, next.en, "Link " + (i + 2)]) +
  `<div class="n2-row">${go("/prophets#" + P.id, "On the chain of " + list.length)}${P.id === "muhammad" ? go("/muhammad", "The Seerah, at length") : ""}${go("/path", "The Path")}</div>`)}`;
  return { status: 200, html: shell({
    title: P.en + " · " + (P.epithet || "a prophet"), path: url, desc: clip(P.blurb || story[0] || P.epithet, 158), active: "",
    crumbs: [["The Prophets", "/prophets"], [P.en, url]], pill: ["/prophets", "All prophets"],
    ld: [{ "@context": "https://schema.org", "@type": "Person", name: P.en, alternateName: P.ar || undefined, description: clip(P.blurb || story[0], 200),
      url: SITE + url, mainEntityOfPage: SITE + url, subjectOf: { "@type": "Article", headline: P.en + " · " + (P.epithet || ""), url: SITE + url, inLanguage: "en", publisher: PUBLISHER } }],
    body }) };
}

/* a companion, or one of the other characters: the same file, the same room */
function characterPage(idRaw, family) {
  const C = characterById(String(idRaw || ""));
  if (!C || (family === "companion") !== (C.group === "companions")) return notFound(family);
  const group = characters().filter(x => x.group === C.group);
  const i = group.findIndex(x => x.id === C.id);
  const hub = C.group === "companions" ? "/companions" : "/characters";
  return entityRoom({ url: characterRoom(C), hub, hubLabel: C.group === "companions" ? "The Companions" : "The Characters",
    key: (C.group === "companions" ? "companion:" : "character:") + C.id, E: C, label: labels()["chars." + C.group] || groupLabel(C.group),
    i, n: group.length, prev: group[i - 1], next: group[i + 1], type: C.group === "companions" ? "Person" : "Thing",
    roomOf: characterRoom, pill: [hub, C.group === "companions" ? "All companions" : "All characters"] });
}
function placePage(idRaw) {
  const P = placeById(String(idRaw || ""));
  if (!P) return notFound("place");
  const group = places().filter(x => x.group === P.group);
  const i = group.findIndex(x => x.id === P.id);
  return entityRoom({ url: "/place/" + P.id, hub: "/places", hubLabel: "The Places", key: "place:" + P.id, E: P, label: labels()["places." + P.group] || groupLabel(P.group),
    i, n: group.length, prev: group[i - 1], next: group[i + 1], type: "Place", roomOf: x => "/place/" + x.id, pill: ["/places", "All places"] });
}
/* the room a companion, a character and a place share: titleEn, titleAr,
   role, summary, details with the Path's tokens, facts, quran, hadith */
function entityRoom(o) {
  const E = o.E, url = o.url;
  const text = [E.titleEn, E.role, E.summary, String(E.details || "").replace(/\{\{[a-z]+:[^|{}]+\|([^{}]*)\}\}/g, "$1")].join(" ");
  const body = `<section class="n2-idea n2-in">
<p class="n2-eyebrow">${esc(o.label)}${E.role ? ` <small>· ${esc(E.role)}</small>` : ""}</p>
${E.titleAr ? `<p class="n2-title-ar" lang="ar" translate="no">${esc(E.titleAr)}</p>` : ""}
<h1 class="n2-h1">${esc(E.titleEn)}</h1>
<p class="n2-meaning">${esc(E.summary || "")}</p>
<div class="n2-row">${go("#account", "The whole account", true)}${shareBtn(E.titleEn + (E.summary ? ": " + clip(E.summary, 160) : "") + " · NOOR Codex of Light", SITE + url)}</div>
</section>
<section class="n2-idea n2-short" id="account">
<p class="n2-eyebrow">The account</p>
${paras(unmark(E.details || E.summary || ""))}
</section>
${Array.isArray(E.facts) && E.facts.length ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The facts</p>${factsList(E.facts)}</section>` : ""}
${quranBlock(Array.isArray(E.quran) ? E.quran : [])}
${hadithBlock(Array.isArray(E.hadith) ? E.hadith : [])}
${besideEntity(o.key, text,
  walk(o.prev && [o.roomOf(o.prev), o.prev.titleEn], o.next && [o.roomOf(o.next), o.next.titleEn]) +
  `<div class="n2-row">${go(o.hub + "?open=" + encodeURIComponent(E.id), "On the " + o.hubLabel.replace(/^The /, "") + " page")}${go("/path", "The Path")}</div>`)}`;
  return { status: 200, html: shell({
    title: E.titleEn, path: url, desc: clip(E.summary || E.role, 158), active: "",
    crumbs: [[o.hubLabel, o.hub], [E.titleEn, url]], pill: o.pill,
    ld: [{ "@context": "https://schema.org", "@type": o.type, name: E.titleEn, alternateName: E.titleAr || undefined, description: clip(E.summary, 200),
      url: SITE + url, mainEntityOfPage: SITE + url, subjectOf: { "@type": "Article", headline: E.titleEn + (E.role ? " · " + E.role : ""), url: SITE + url, inLanguage: "en", publisher: PUBLISHER } }],
    body }) };
}

/* one of the 99 Names, by its number: the page addresses them /allah#n */
function namePage(nRaw) {
  const n = Number(nRaw);
  const N = (Number.isInteger(n) && n >= 1) ? nameRow(n) : null;
  if (!N) return notFound("Name");
  const url = "/name/" + n, count = names().length;
  const prev = n > 1 ? nameRow(n - 1) : null, next = n < count ? nameRow(n + 1) : null;
  const essay = dedash(N.essay), gloss = dedash(N.gloss, true), practice = dedash(N.practice);
  const head = String(N.meaning || "").split(/[,;]/)[0].trim();
  /* the verse's own note, in the page's words: whether the Name is in the
     Qur'an as written, or comes from the enumeration with the verse that
     carries its meaning */
  const where = N.fromList ? "from the enumeration · the verse carries the meaning" : "this Name is in the Qur’an";
  const body = `<section class="n2-idea n2-in">
<p class="n2-eyebrow">The Ninety-Nine Names <small>· the ${ordinal(n)} name</small></p>
<p class="n2-word-ar" lang="ar" translate="no">${esc(N.ar)}</p>
<h1 class="n2-h1">${esc(N.translit)}</h1>
<p class="n2-meaning">${esc(N.meaning)}</p>
${N.root ? `<ul class="n2-facts"><li><span>The root</span><b lang="ar">${esc(N.root)}</b></li>${gloss ? `<li><span>From the root</span><b>${esc(gloss)}</b></li>` : ""}</ul>` : ""}
<div class="n2-row">${go("#essay", "The essay", true)}${shareBtn(N.translit + ", " + N.ar + ": " + N.meaning + " · NOOR Codex of Light", SITE + url)}</div>
</section>
${essay ? `<section class="n2-idea n2-short" id="essay">
<p class="n2-eyebrow">The essay</p>
${paras(esc(essay))}
</section>` : ""}
${N.ref ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">In the Qur'an</p>
<div class="n2-quote">${N.verseAr ? `<p class="n2-quran" lang="ar">${esc(N.verseAr)}</p>` : ""}${N.verseEn ? `<p class="n2-p">${esc(N.verseEn)}</p>` : ""}<p class="n2-ref"><a href="${attr(refHref(N.ref))}">Qur'an ${esc(N.ref)}</a></p><p class="n2-credit">${esc(where)}</p></div></section>` : ""}
${practice ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">What it asks of you</p><p class="n2-p">${esc(practice)}</p></section>` : ""}
${besideEntity("name:" + n, [N.translit, N.meaning, essay].join(" "),
  walk(prev && ["/name/" + (n - 1), prev.translit, "Name " + (n - 1)], next && ["/name/" + (n + 1), next.translit, "Name " + (n + 1)]) +
  `<div class="n2-row">${go("/allah#" + n, "All " + count + " Names")}</div>`)}`;
  return { status: 200, html: shell({
    title: N.translit + (head ? ", " + head : ""), path: url, desc: clip(N.meaning + ". " + essay, 158), active: "",
    crumbs: [["The Ninety-Nine Names", "/allah"], [N.translit, url]], pill: ["/allah", "The Names"],
    ld: [{ "@context": "https://schema.org", "@type": "DefinedTerm", name: N.translit, alternateName: N.ar, description: clip(N.meaning + (gloss ? ". " + gloss : ""), 200),
      termCode: String(n), url: SITE + url, inLanguage: ["ar", "en"],
      inDefinedTermSet: { "@type": "DefinedTermSet", name: "The Ninety-Nine Names of Allah", url: SITE + "/allah" } }],
    body }) };
}

/* ---------------------------------------------------------------------------
   the handler
--------------------------------------------------------------------------- */
export async function render(kind, q = {}, host = "") {
  switch (kind) {
    case "light": return lightPage(q.id, host);
    case "lights": return lightsIndex();
    case "path": return chapterPage(q.n);
    case "paths": return pathIndex();
    case "verse": return versePage(q.ref);
    case "verses": return versesIndex();
    case "surah": return surahPage(q.n);
    case "today": return todayPage(q.date, host);
    case "prophet": return prophetPage(q.id);
    case "companion": return characterPage(q.id, "companion");
    case "character": return characterPage(q.id, "character");
    case "place": return placePage(q.id);
    case "name": return namePage(q.n);
    default: return notFound("kind");
  }
}
export default async function handler(req, res) {
  const q = req.query || {};
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL || "").split(",")[0].trim();
  let out;
  try { out = await render(String(q.kind || ""), q, host); }
  catch (e) { out = notFound("error"); console.error("page.js", String(q.kind || ""), e && e.stack || e); }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", out.status === 200 ? (out.cache || CACHE) : "public, s-maxage=600, stale-while-revalidate=3600");
  res.status(out.status).end(out.html);
}
