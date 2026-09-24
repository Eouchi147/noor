// NOOR · the Content Factory: one library object, every platform's draft.
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
//
// Masterplan step 6, in the owner's narrow form of 24 September 2026: a
// single research object -- a Light, a verse, a word, a prophet, a
// companion, a place, a chapter of the Path, a surah, one of the Names --
// becomes a full package of per-platform drafts, on command, owner only,
// nothing posted, no bulk run, no paid compute, and no language model. The
// masterplan's own words: "keep the research object, source list and
// factual claims canonical. Transform presentation for each platform
// instead of copying the same asset blindly everywhere."
//
// So this file invents nothing. Every field on the object it resolves comes
// from a loader api/page.js already exports (the same ones the rendered
// rooms read), and every draft is built by rearranging that object's own
// words through the shaping rules api/_channels.js and api/_youtube.js
// already enforce for a reel's caption. There is no fetch here, no model
// call, no store write: a package is pure arithmetic over files already on
// disk, which is what makes it safe to run on command and cheap enough to
// run often.
//
// content_id follows ARCHITECTURE.md's "The Content Graph": <type>:<id>,
// the same 18-type vocabulary build_graph.py writes (light, verse, word,
// prophet, companion, place, chapter, surah, name, figure for the other
// characters). A verse's id is the hyphenated form api/page.js's parseRef()
// already produces (verse:2-255), never re-invented here.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import * as PAGE from "./page.js";
import { shape } from "./_channels.js";
import * as YT from "./_youtube.js";
import { oneLine as threadsOneLine } from "./_threads.js";

const SITE = "https://noorcodex.com";

/* scripts/graph/derive_reel_sources.py's own answer: which reel cards and
   which "short" films the shelf carries for a content_id, and the Names'
   own graph slug (position -> "name:<slug>"), read once and kept in
   memory for the life of the function instance -- the same read-once
   habit page.js's own once() gives every other file it opens. A missing
   file (a checkout before scripts/graph/run.sh has ever been run) costs
   the derivatives their reel and film rows and a Name its graph slug,
   never an error: the same "a missing file costs a feature, not a crash"
   rule page.js's own entityGraph() already keeps. */
let REEL_SOURCES = null;
function reelSources() {
  if (REEL_SOURCES) return REEL_SOURCES;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets/reel-sources.json"), "utf8"));
    REEL_SOURCES = (j && typeof j === "object") ? j : { sources: {}, names: {} };
  } catch { REEL_SOURCES = { sources: {}, names: {} }; }
  return REEL_SOURCES;
}

/* The house prints no em dash and no en dash, anywhere, including a draft
   built here from raw source text. Every string pulled out of the data
   passes through this before it is used: a dash becomes a comma, the way
   page.js's own dedash() treats the 99 Names, and the same collapsing of
   stray whitespace _channels.js's cut() already does to a caption, so a
   paragraph break survives but a run of spaces or blank lines does not.
   The two marks are built from their code points, not typed as literal
   characters, so this file's own text never carries one (a rule that
   binds the house's code and comments, not only what a reader sees). */
const DASH_SURROUNDED = new RegExp("\\s*[" + String.fromCharCode(0x2014, 0x2013) + "]\\s*", "g");
const clean = s => String(s == null ? "" : s)
  .replace(DASH_SURROUNDED, ", ")
  .replace(/[ \t]+/g, " ")
  .replace(/\n{3,}/g, "\n\n")
  .split("\n").map(l => l.trim()).join("\n")
  .trim();

/* the Path's own cross links, {{n:2|Adam}}, unwound to their plain label:
   a caption reads as prose, never as the room's own markup */
const stripTokens = s => String(s || "").replace(/\{\{[a-z]+:[^|{}]+\|([^{}]*)\}\}/g, "$1");

/* A Name's own content_id, read off assets/reel-sources.json's "names" map
   (the graph's own slug, keyed by the room's position, 1 to 99): this is
   the graph's real id, never a second, guessed one. Only if that file is
   somehow missing does this build its own slug, the same deterministic
   way the shelf's card ids are built from a transliteration (name-ad-darr
   for "Ad-Darr"), as a last resort rather than a first choice. */
const nameSlug = s => String(s || "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const nameContentId = (n, translit) => (reelSources().names || {})[String(n)] || ("name:" + nameSlug(translit));

/* the reverse of the map above: a Name's own content_id ("name:al-majeed",
   the very id buildPackage prints) is a real address, not only an output,
   so name:<slug> is accepted as input too, built once from the same file
   and kept for the life of the function instance. */
let NAME_SLUG_TO_POSITION = null;
function namePositionForSlug(slug) {
  if (!NAME_SLUG_TO_POSITION) {
    NAME_SLUG_TO_POSITION = new Map();
    const names = reelSources().names || {};
    for (const pos of Object.keys(names)) {
      const cid = String(names[pos] || "");
      NAME_SLUG_TO_POSITION.set(cid.startsWith("name:") ? cid.slice(5) : cid, pos);
    }
  }
  return NAME_SLUG_TO_POSITION.get(String(slug || "").toLowerCase()) || null;
}

const TYPE_LABEL = {
  light: "Light", verse: "verse", word: "word", prophet: "prophet",
  companion: "companion", character: "character", place: "place",
  chapter: "chapter of the Path", surah: "surah", name: "Name"
};

/* ---------------------------------------------------------------------------
   resolving the input: a content_id ("light:<id>") or a site path
   ("/light/<id>"), the two forms the marching orders name
--------------------------------------------------------------------------- */
const ROOM_TYPE = { light: "light", verse: "verse", dictionary: "word", prophet: "prophet",
  companion: "companion", character: "character", place: "place", path: "chapter",
  surah: "surah", name: "name" };
const ID_TYPE = { figure: "character" };

function parseInput(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (s[0] === "/") {
    const m = s.match(/^\/(light|verse|dictionary|prophet|companion|character|place|path|surah|name)\/([^/?#]+)/);
    if (!m) return null;
    return { type: ROOM_TYPE[m[1]], id: decodeURIComponent(m[2]) };
  }
  const m = s.match(/^([a-z]+):(.+)$/);
  if (!m) return null;
  const type = ID_TYPE[m[1]] || m[1];
  if (!TYPE_LABEL[type]) return null;
  return { type, id: m[2] };
}

/* the sources a hadith-and-Qur'an-carrying entity holds, kept only where
   the fact a source documents is one the drafted text actually states.
   A hadith's own source is included only when a run of the hadith's own
   words (four in a row: long enough to survive a paraphrase, rare enough
   that it does not turn up by accident) is actually found in the body
   this package is about to quote, or the hadith's whole text is short and
   quoted whole. Found corpus-wide while fixing the surah case below, the
   same mistake in every other room that carries a hadith list: 21 of a
   prophet's 26 hadith citations, 9 of 54 on a companion or a character,
   and 37 of 169 on a chapter of the Path, named a fact never mentioned in
   the very text the draft was about to quote (Adam's story never says he
   was created on a Friday, though a hadith on his own record does; citing
   that hadith beside the story reads as though the story said it too).
   Every Qur'an ref stays: it is the same record's own curated verse for
   this same story, whether or not the prose happens to give its number
   in parentheses, unlike a hadith's specific, separable claim. */
function sourcesOf(E, body) {
  const norm = s => String(s || "").toLowerCase().replace(/[‘’']/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const hay = norm(body);
  const hayWords = hay.split(" ").filter(Boolean);
  const hayGrams = new Set();
  for (let i = 0; i + 4 <= hayWords.length; i++) hayGrams.add(hayWords.slice(i, i + 4).join(" "));
  const seen = new Set(), out = [];
  const add = s => { if (s && !seen.has(s)) { seen.add(s); out.push(s); } };
  for (const h of Array.isArray(E.hadith) ? E.hadith : []) {
    const src = clean((h && (h.source || h.src)) || "");
    if (!src) continue;
    const hw = norm((h && h.text) || "").split(" ").filter(Boolean);
    if (!hw.length) continue;
    let tied = hay.includes(hw.join(" "));
    if (!tied && hw.length >= 4) {
      for (let i = 0; i + 4 <= hw.length && !tied; i++) if (hayGrams.has(hw.slice(i, i + 4).join(" "))) tied = true;
    }
    if (tied) add(src);
  }
  const refs = Array.isArray(E.quran) ? E.quran : (Array.isArray(E.verses) ? E.verses : []);
  for (const v of refs) if (v && v.ref) add("Qur'an " + v.ref);
  return out.filter(Boolean);
}

const tagsFor = (type, extra) => {
  const out = [];
  if (type === "light" && extra && extra.c) out.push("#" + String(extra.c).replace(/[^A-Za-z0-9]/g, ""));
  if (type === "word" && extra && extra.cat) out.push("#" + String(extra.cat).replace(/[^A-Za-z0-9]/g, ""));
  out.push("#Islam", "#NoorCodexOfLight");
  return out;
};

function buildLight(id) {
  const L = PAGE.lightById(id);
  if (!L) return null;
  return { type: "light", id: L.id, title: clean(L.t), url: SITE + "/light/" + L.id,
    text: clean(L.s || ""), detail: "", arabic: "", sources: L.src ? [clean(L.src)] : [],
    tags: tagsFor("light", L), date: L.d ? clean(L.d) : "" };
}

/* the reel's own credit line for this edition (api/page.js's verse room
   prints it under the English as n2-credit, "Saheeh International"), reused
   here verbatim rather than invented a second time for the draft */
const TRANSLATION_LABEL = { "en.sahih": "Saheeh International" };

/* A verse's draft must carry the verse itself, not merely its own title.
   page.js's first LOCAL source of an English meaning is verseNotes' own
   .sense (verse/<s>.json, written for 1,280 verses). Where that is silent,
   the second local source is the shelf itself: tools/reels/verses.json,
   the very file every one of the 600 shelf reels already draws its own
   caption's meaning from (PAGE.shelfVerseMeaning), so a verse whose reel
   is already carrying its English never has to say locally that none is
   held -- the gap the owner found live on the best-performing post of the
   fortnight, verse:19-36. A range only takes the shelf's word when every
   verse in it has one; one missing verse leaves the whole range short
   rather than quietly reading half a passage as if it were whole. An
   English rendering from api.alquran.cloud (page.js's own ayah()) is a
   network fetch and this file makes none, so it is never a third source
   here. Where a note exists, its sense leads (text); failing that, the
   shelf's own wording, labelled the way the reel labels it; the Arabic
   always follows (detail), so buildDrafts' body reads text-then-Arabic.
   Only when neither local source holds a meaning is text empty and detail
   left to carry the Arabic alone -- the fault a verse with neither note
   nor shelf entry still has. gapsFor names that honestly rather than
   silently dropping the English half. */
function buildVerse(idRaw) {
  const ref = PAGE.parseRef(idRaw);
  if (!ref) return null;
  const parts = [];
  for (let a = ref.a; a <= ref.b; a++) { const t = PAGE.localArabic(ref.s, a); if (t) parts.push(t); }
  const arabic = parts.join(" ");
  const vn = PAGE.verseNotes(ref.s, ref.a);
  const row = PAGE.surahRow(ref.s);
  const name = row ? row.translit : "";
  let text = vn && vn.sense ? clean(vn.sense) : "";
  if (!text) {
    const shelfParts = [];
    for (let a = ref.a; a <= ref.b; a++) {
      const m = PAGE.shelfVerseMeaning(ref.s, a);
      if (!m || !m.text) { shelfParts.length = 0; break; }
      shelfParts.push(clean(m.text));
    }
    if (shelfParts.length) {
      const label = TRANSLATION_LABEL[PAGE.shelfVerseEdition()] || "";
      text = shelfParts.join(" ") + (label ? " (" + label + ")" : "");
    }
  }
  return { type: "verse", id: ref.id, title: "Qur'an " + ref.label + (name ? ", " + name : ""),
    url: SITE + "/verse/" + ref.id, text, detail: arabic,
    arabic, sources: ["Qur'an " + ref.label], tags: tagsFor("verse"), surah: name };
}

/* word:__proto__, word:constructor and word:toString all answered "ok:true"
   with an empty entry, because a plain object's bracket lookup climbs its
   prototype chain: dictionary()["__proto__"] is Object.prototype itself,
   truthy, never a real word. Only the dictionary's own key, held directly
   on the object JSON.parse built, counts as a match. */
function buildWord(id) {
  const dict = PAGE.dictionary();
  if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(dict, id)) return null;
  const e = dict[id];
  if (!e || typeof e !== "object") return null;
  return { type: "word", id, title: clean(e.t), url: SITE + "/dictionary/" + id,
    text: clean(e.s || ""), detail: clean(e.l || ""), arabic: e.a || "", sources: [],
    tags: tagsFor("word", e), category: e.cat || "" };
}

function buildProphet(id) {
  const P = PAGE.prophetById(id);
  if (!P) return null;
  const story = Array.isArray(P.story) ? P.story.filter(t => typeof t === "string") : [];
  const text = clean(P.blurb || story[0] || ""), detail = clean(story.join("\n\n"));
  return { type: "prophet", id: P.id, title: clean(P.en), url: SITE + "/prophet/" + P.id,
    text, detail, arabic: P.ar || "",
    sources: sourcesOf(P, text + " " + detail), tags: tagsFor("prophet") };
}

function buildEntity(type, id) {
  const E = type === "place" ? PAGE.placeById(id) : PAGE.characterById(id);
  if (!E) return null;
  if (type === "companion" && E.group !== "companions") return null;
  if (type === "character" && E.group === "companions") return null;
  const url = type === "place" ? "/place/" + E.id : PAGE.characterRoom(E);
  const text = clean(E.summary || ""), detail = clean(stripTokens(E.details || ""));
  return { type, id: E.id, title: clean(E.titleEn), url: SITE + url,
    text, detail, arabic: E.titleAr || "",
    sources: sourcesOf(E, text + " " + detail), tags: tagsFor(type), role: E.role || "" };
}

function buildChapter(nRaw) {
  const n = Number(nRaw);
  const N = PAGE.chapter(n);
  if (!N) return null;
  const text = clean(N.summary || ""), detail = clean(stripTokens(N.details || ""));
  return { type: "chapter", id: n, title: clean(N.titleEn), url: SITE + "/path/" + n,
    text, detail, arabic: N.titleAr || "",
    sources: sourcesOf(N, text + " " + detail), tags: tagsFor("chapter") };
}

/* Surah metadata that needs a live fetch (api.alquran.cloud's meaning,
   count and place of revelation) is left out on purpose: this file never
   reaches the network, so the surah's own local rows carry it instead --
   tools/reels/quran-uthmani.json's translit and Arabic name, and
   study/<n>.json's own written context, never the API. */
/* study/<n>.json's own `virtue` is a different fact from `context`: virtue
   is a hadith about the merit of RECITING the surah, context is the house's
   own written account of when and why it came down, and the two are not
   about the same claim. Citing virtue.src beside context's text printed
   "Source: no authentic virtue report..." on 17 surahs (virtue.src's own
   honest disclaimer, quoted as though it were a citation) and, on 44 more,
   a real hadith source standing beside a history paragraph it never spoke
   to. A surah's drafts carry no source line at all: the paragraph is the
   house's own account of when and why the surah came down, drawn from the
   early commentators, and naming the Qur'an as its source would claim the
   Qur'an says what the commentators say. The room link carries the reader to
   the surah itself; the gap below says no source is recorded for the text. */
function buildSurah(nRaw) {
  const n = Number(nRaw);
  if (!(Number.isInteger(n) && n >= 1 && n <= 114)) return null;
  const row = PAGE.surahRow(n) || {};
  const S = PAGE.study(n) || {};
  const text = (Array.isArray(S.context) && S.context[0]) ? clean(S.context[0]) : (S.name_story ? clean(S.name_story) : "");
  return { type: "surah", id: n, title: "Surah " + (row.translit || n), url: SITE + "/surah/" + n,
    text, detail: "", arabic: row.name || "", sources: [],
    tags: tagsFor("surah"), count: row.count || 0 };
}

/* a Name's own content_id, name:<slug>, is what buildPackage prints back
   (nameContentId, above): it has to be a real address too, not a dead end,
   so a non-numeric id is looked up as the graph's own slug before this
   gives up on it. */
function buildName(nRaw) {
  let n = Number(nRaw);
  if (!(Number.isInteger(n) && n >= 1)) {
    const pos = namePositionForSlug(nRaw);
    n = pos ? Number(pos) : NaN;
  }
  const N = (Number.isInteger(n) && n >= 1) ? PAGE.nameRow(n) : null;
  if (!N) return null;
  return { type: "name", id: n, title: clean(N.translit), url: SITE + "/name/" + n,
    text: clean(N.meaning || ""), detail: clean(N.essay || ""), arabic: N.ar || "",
    sources: N.ref ? ["Qur'an " + N.ref] : [], tags: tagsFor("name") };
}

function resolveObject(parsed) {
  if (!parsed) return null;
  switch (parsed.type) {
    case "light": return buildLight(parsed.id);
    case "verse": return buildVerse(parsed.id);
    case "word": return buildWord(parsed.id);
    case "prophet": return buildProphet(parsed.id);
    case "companion": return buildEntity("companion", parsed.id);
    case "character": return buildEntity("character", parsed.id);
    case "place": return buildEntity("place", parsed.id);
    case "chapter": return buildChapter(parsed.id);
    case "surah": return buildSurah(parsed.id);
    case "name": return buildName(parsed.id);
    default: return null;
  }
}

export function resolveContent(idOrPath) {
  let parsed;
  try { parsed = parseInput(idOrPath); } catch { return null; }
  return resolveObject(parsed);
}

function contentId(o) {
  if (o.type === "character") return "figure:" + o.id;
  if (o.type === "name") return nameContentId(o.id, o.title);
  return o.type + ":" + o.id;
}

/* ---------------------------------------------------------------------------
   derivatives: read from the graph's own reel_of edges
   (assets/reel-sources.json, scripts/graph/derive_reel_sources.py), never
   guessed from an id pattern. A Did you know card's own id (know-abu-al-wafa)
   carries no trace of the Light it was written from at all, and a "short"
   film is named by a page and a fragment (heroes.html#f-mathematics), not a
   record id: only the graph, which walked every source file to make the
   trace, can answer this completely. reels/index.json (already loaded for
   other reasons) is read once more here only to turn a bare id and a
   confidence into a row worth showing: the card's own hook, kind or, for a
   film, its title and room.
--------------------------------------------------------------------------- */
function derivativesOf(cid, cards) {
  const entry = (reelSources().sources || {})[cid] || {};
  const byId = new Map();
  for (const c of cards) if (c && c.id) byId.set(c.id, c);
  const rows = list => (Array.isArray(list) ? list : []).map(r => {
    const c = byId.get(r.id);
    return c ? { id: c.id, kind: c.kind, hook: c.hook || "", title: c.title || "", room: c.room || "", confidence: r.confidence }
              : { id: r.id, confidence: r.confidence };
  });
  return { reels: rows(entry.reels), films: rows(entry.films) };
}

function entityRefLite(key) {
  const [fam, id] = String(key || "").split(":");
  if (fam === "prophet") { const p = PAGE.prophetById(id); return p && { type: "prophet", title: p.en, url: SITE + "/prophet/" + p.id }; }
  if (fam === "companion" || fam === "character") { const c = PAGE.characterById(id); return c && { type: fam, title: c.titleEn, url: SITE + PAGE.characterRoom(c) }; }
  if (fam === "place") { const p = PAGE.placeById(id); return p && { type: "place", title: p.titleEn, url: SITE + "/place/" + p.id }; }
  return null;
}

function relatedRooms(obj) {
  if (obj.type === "light") {
    const L = PAGE.lightById(obj.id);
    return L ? PAGE.relatedLights(L, 4).map(x => ({ type: "light", title: x.t, url: SITE + "/light/" + x.id })) : [];
  }
  if (obj.type === "chapter") {
    const N = PAGE.chapter(Number(obj.id));
    const list = PAGE.chapters();
    return (N && Array.isArray(N.connections) ? N.connections : []).map(i => list.find(c => c.id === i)).filter(Boolean)
      .map(c => ({ type: "chapter", title: c.titleEn, url: SITE + "/path/" + c.id }));
  }
  if (obj.type === "surah") {
    const S = PAGE.study(Number(obj.id)) || {};
    return (Array.isArray(S.connections) ? S.connections : []).map(c => {
      const row = PAGE.surahRow(+c.to);
      return row ? { type: "surah", title: row.translit, url: SITE + "/surah/" + c.to } : null;
    }).filter(Boolean);
  }
  if (obj.type === "prophet" || obj.type === "companion" || obj.type === "character" || obj.type === "place" || obj.type === "name") {
    const key = obj.type === "name" ? "name:" + obj.id : obj.type + ":" + obj.id;
    const E = PAGE.edgesOf(key);
    const out = [];
    for (const id of (Array.isArray(E.lights) ? E.lights : []).slice(0, 4)) { const L = PAGE.lightById(id); if (L) out.push({ type: "light", title: L.t, url: SITE + "/light/" + L.id }); }
    for (const n of (Array.isArray(E.chapters) ? E.chapters : []).slice(0, 4)) { const c = PAGE.chapters().find(x => x.id === n); if (c) out.push({ type: "chapter", title: c.titleEn, url: SITE + "/path/" + c.id }); }
    for (const p of (Array.isArray(E.people) ? E.people : []).slice(0, 4)) { const r = entityRefLite(p); if (r) out.push(r); }
    for (const p of (Array.isArray(E.places) ? E.places : []).slice(0, 4)) { const r = entityRefLite("place:" + p); if (r) out.push(r); }
    return out;
  }
  return [];
}

function gapsFor(obj, der) {
  const label = TYPE_LABEL[obj.type] || obj.type;
  const out = [];
  if (!obj.sources.length) out.push("No sources are recorded for this " + label + ".");
  if (!der.reels.length) out.push("No reel exists yet for this " + label + ".");
  if (!der.films.length) out.push("No film exists yet for this " + label + ".");
  if (obj.type !== "light" && !obj.arabic) out.push("No Arabic text is recorded for this " + label + ".");
  if (obj.type === "verse" && !obj.text) out.push("No English meaning is held locally for this verse.");
  if (!der.related.length) out.push("No related rooms are linked from this " + label + " yet.");
  return out;
}

/* ---------------------------------------------------------------------------
   drafts: the object's own words, shaped per platform. Every network that
   api/_channels.js already knows how to cut a caption for is cut by that
   same code (shape()), never a second, competing rule written here.
--------------------------------------------------------------------------- */
const PIN_KIND = { light: "light", word: "word", verse: "verse" };

/* Several of the house's own network rules (api/_channels.js's generic
   Facebook/Instagram branch, YT.shape()'s hard slice(0,4900)) cut a caption
   from the END once it runs over the limit, which is right for a reel's
   caption, written to fit already, and wrong for an object whose own
   detail can run to several thousand characters (a prophet's whole story,
   a long Path chapter's hadith list): a plain end cut drops the closing
   source and link lines along with everything after them, a caption with
   no way back to the room it came from. So the body handed to a
   fixed-limit network is capped in advance, word-boundary and ellipsis the
   same way page.js's own clip() shortens a description, leaving enough
   room for the title, the sources line, the link and the tags to survive
   whatever the network's own cut then does. */
const clipText = (s, n) => { s = String(s || ""); return s.length <= n ? s : s.slice(0, Math.max(0, n - 1)).replace(/\s+\S*$/, "") + "…"; };
const capBody = (body, limit, reserve) => clipText(body, Math.max(150, limit - reserve));

function buildYouTube(obj, body, basis) {
  const cappedBody = capBody(body, 4900, basis.length + obj.url.length + 12);
  const desc = [cappedBody, basis, obj.url].filter(Boolean).join("\n\n");
  const shaped = YT.shape({ title: obj.title, caption: desc });
  /* YT.shape()'s own title() always appends " #Shorts", correct for a
     video actually filed as one; a package is a draft, not yet a video, so
     the title here is capped the same way (100 characters) without a
     suffix that would claim a Short exists when none has been made. */
  return { title: YT.titlePlain({ title: obj.title }), description: shaped.description, tags: shaped.tags };
}

/* A sentence boundary is not "wherever a . ! or ? sits": that also matches
   "29.53" (splitting it into "29." and "53"), "2.5" and every decimal in
   between, and it strands a closing quote at the front of the next chunk
   ('He answered, "...in Jannah." He answered' used to become "...Jannah."
   and '" He answered', the mark orphaned). A real boundary is terminal
   punctuation, plus whatever closing quote or bracket belongs to it (kept
   HERE, on the sentence that is ending), followed by whitespace and then
   the next sentence actually starting: a capital letter, an opening
   bracket, or an opening quote that is not itself quoting a bare number.
   Nothing that fails that test is a boundary, so "29.53", "2.5" and a
   quoted question a lowercase "he asked" answers all stay one sentence,
   and a period is never asked to fall between two digits. Found on 139 of
   1,324 objects, corpus-wide, 24 September 2026. */
const CLOSE_MARK = "\"'’”)\\]}";
const OPEN_QUOTE = "\"'‘“";
function sentencesOf(text) {
  const s = String(text || "");
  if (!s.trim()) return [];
  const RE = new RegExp("[.!?]+[" + CLOSE_MARK + "]*", "g");
  const out = [];
  let start = 0, m;
  while ((m = RE.exec(s))) {
    const end = m.index + m[0].length;
    let k = end;
    while (k < s.length && /\s/.test(s[k])) k++;
    const atEnd = k >= s.length;
    const hasGap = k > end;
    const c = s[k] || "";
    const isCap = /[A-Z]/.test(c);
    const isBracket = "([{".includes(c);
    const isQuoteOpen = OPEN_QUOTE.includes(c) && !/\d/.test(s[k + 1] || "");
    if (atEnd || (hasGap && (isCap || isBracket || isQuoteOpen))) {
      out.push(s.slice(start, end).trim());
      start = k;
      RE.lastIndex = k;
    }
  }
  if (start < s.length) out.push(s.slice(start).trim());
  return out.map(x => x.trim()).filter(Boolean);
}
const xCut = (s, n) => { s = String(s || ""); return s.length <= n ? s : s.slice(0, Math.max(0, n - 1)).replace(/\s+\S*$/, "") + "…"; };

/* A single sentence longer than a post is split at a clause boundary (a
   comma or a semicolon), each piece carrying only whole words, so the
   pieces read on across posts without a word ever going missing; a clause
   that is STILL too long on its own falls back to a plain word boundary,
   never a word cut in half, which is why an ellipsis never appears here --
   nothing is shortened, only carried to the next post. */
function splitAtClauses(sentence, room) {
  if (sentence.length <= room) return [sentence];
  const clauses = sentence.split(/(?<=[,;])\s+/);
  const chunks = [];
  let cur = "";
  const flush = () => { if (cur) { chunks.push(cur); cur = ""; } };
  for (const clause of clauses) {
    if (clause.length > room) {
      for (const w of clause.split(" ")) {
        const cand = cur ? cur + " " + w : w;
        if (cand.length <= room) cur = cand; else { flush(); cur = w; }
      }
      continue;
    }
    const cand = cur ? cur + " " + clause : clause;
    if (cand.length <= room) cur = cand; else { flush(); cur = clause; }
  }
  flush();
  return chunks;
}

/* Packs every sentence of the body into posts of at most `room` characters,
   in order, dropping nothing: two or more short whole sentences share one
   post when they fit; a sentence too long for one post is split at
   splitAtClauses() above, each of its own chunks taking its own post, never
   merged with a neighbour, so a post that is mid-sentence is always easy to
   tell from one that safely ends a thought (its own `safe` flag) -- the cap
   below only ever stops the thread on a `safe` post, never inside one. */
function packBody(sentences, room) {
  const posts = [];
  let pending = "";
  const flushPending = () => { if (pending) { posts.push({ text: pending, safe: true }); pending = ""; } };
  for (const sentence of sentences) {
    if (sentence.length <= room) {
      const cand = pending ? pending + " " + sentence : sentence;
      if (cand.length <= room) pending = cand;
      else { flushPending(); pending = sentence; }
      continue;
    }
    flushPending();
    const chunks = splitAtClauses(sentence, room);
    chunks.forEach((c, i) => posts.push({ text: c, safe: i === chunks.length - 1 }));
  }
  flushPending();
  return posts;
}

/* the final post: the sources and the link together, the sources cut short
   (word boundary, ellipsis) before the link itself is ever touched, so an
   object with many citations never costs the thread its own way back */
function tailPost(basis, url, prefixReserve) {
  const room = 280 - prefixReserve;
  const whole = [basis, url].filter(Boolean).join(" ");
  if (whole.length <= room) return whole || url;
  return xCut(basis, Math.max(0, room - url.length - 1)) + " " + url;
}

/* A thread, not a truncated caption. The title is always its own first
   post, with a full stop if it did not already end on one, so it never
   runs into the sentence after it with no punctuation between the two.
   Every sentence of the body then appears in full, across as many posts
   as it needs, until the cap (8 posts, a sensible length for a thread):
   past that, the thread stops at the last SAFE post -- a complete
   sentence, never a fragment -- and says plainly that the rest is at the
   link, rather than silently dropping words mid-sentence. */
function buildXThread(obj, body, basis) {
  const CAP = 8, ROOM = 264, PREFIX_RESERVE = 12;
  const titleText = obj.title.trim();
  const titlePost = /[.!?]$/.test(titleText) ? titleText : titleText + ".";
  const bodyPosts = packBody(sentencesOf(body), ROOM);

  const budget = Math.max(0, CAP - 2);        /* room left once the title and the final post are set aside */
  let kept = bodyPosts, truncated = false;
  if (bodyPosts.length > budget) {
    let k = budget;
    while (k > 0 && !bodyPosts[k - 1].safe) k--;
    kept = bodyPosts.slice(0, k);
    truncated = true;
  }

  const notice = truncated ? "The rest, and every source, is at the link. " : "";
  const finalText = notice + tailPost(basis, obj.url, PREFIX_RESERVE + notice.length);
  const texts = [titlePost, ...kept.map(p => p.text), finalText];
  const n = texts.length;
  return texts.map((text, i) => {
    const prefix = (i + 1) + "/" + n + " ";
    const full = prefix + text;
    /* a safety net only, never expected to fire on the body posts above
       (each already built to fit): a title or a source list long enough
       to still overflow is shortened at a word boundary with an ellipsis,
       the same as everywhere else in this file, the link itself untouched
       since tailPost() above already put it last and kept it whole */
    return full.length <= 280 ? full : prefix + xCut(text, 280 - prefix.length);
  });
}

function buildDrafts(obj) {
  const body = [obj.text, obj.detail].filter(Boolean).join("\n\n") || obj.title;
  const basis = obj.sources.length ? "Source: " + obj.sources.join("; ") : "";
  const tagsLine = obj.tags.join(" ");
  const igfbBody = capBody(body, 2200, obj.title.length + basis.length + obj.url.length + tagsLine.length + 24);
  const redditBody = capBody(body, 4000, basis.length + obj.url.length + 40);
  /* Pinterest's own shape() (api/_channels.js) joins body and basis into
     one 500-character description and cuts the join from the end, the
     same plain end-cut that dropped Facebook and Instagram's closing
     lines on a long object; capped here the same way, so the sources
     survive rather than falling off the far end of a long body. */
  const pinterestBody = capBody(body, 500, basis.length + 10);
  const pIgFb = { title: obj.title, body: igfbBody, basis, link: obj.url, tags: obj.tags };
  const p = { title: obj.title, body, basis, link: obj.url, tags: obj.tags, kind: PIN_KIND[obj.type] };
  const pPinterest = { ...p, body: pinterestBody };
  const pReddit = { ...p, body: redditBody };
  /* api/_threads.js's own card path (shape(), when there is no p.caption)
     takes only the FIRST sentence of whatever p.body it is given, oneLine()'s
     own rule, and never reads p.basis at all: the ordinary body handed to
     every other network left the Source line off every Threads card that
     had one, on 493 objects, unconditionally, not only once it ran long.
     Rather than change _threads.js's own posting behaviour, the body built
     here for Threads alone joins the lead sentence (its own closing full
     stop dropped) to the source with a comma, so oneLine() reads the two as
     ONE sentence and keeps both; only if that combined line still cannot
     fit 500 does its own cut() shorten it, word-boundary and ellipsis, from
     the end, same as everywhere else. An object with no source is untouched. */
  let threadsBody = body;
  if (basis) {
    /* the source gets first claim on the room, capped to fit on its own
       (word boundary, ellipsis) before the lead sentence is given whatever
       is left, so a long citation list never costs itself the very thing
       it was just given room for; TH_ROOM mirrors api/_threads.js's own
       shape() arithmetic (title cut to 200, then link and up to two tags
       reserved) so this rarely has to cut at all */
    const thTags = (obj.tags || []).slice(0, 2).join(" ");
    const thTitle = clipText(obj.title, 200);
    const thFixed = [thTitle, obj.url, thTags].filter(Boolean).reduce((n, s) => n + s.length + 2, 0);
    const thRoom = Math.max(0, 500 - thFixed);
    const cappedBasis = basis.length <= thRoom ? basis : clipText(basis, thRoom);
    const leadRoom = thRoom - cappedBasis.length - 2;
    const lead = threadsOneLine(body).replace(/[.!?]+$/, "");
    const cappedLead = leadRoom > 10 ? (lead.length <= leadRoom ? lead : clipText(lead, leadRoom)) : "";
    threadsBody = cappedLead ? cappedLead + ", " + cappedBasis : cappedBasis;
  }
  const pThreads = { ...p, body: threadsBody };
  return {
    instagram: shape(pIgFb, "instagram"),
    facebook: shape(pIgFb, "facebook"),
    threads: shape(pThreads, "threads"),
    pinterest: shape(pPinterest, "pinterest"),
    reddit: shape(pReddit, "reddit"),
    youtube: buildYouTube(obj, body, basis),
    x: buildXThread(obj, body, basis)
  };
}

/* ---------------------------------------------------------------------------
   the one door: resolve, gather, shape

   Three things an owner-only route still has to refuse politely rather
   than crash on, since the id in ?id= is whatever was typed or pasted: an
   id absurdly long (capped at 200, the same order of size as a site path
   ever needs, so nothing real is ever refused); a %-escape malformed
   enough that decodeURIComponent itself throws (a site-path id only,
   /light/%zz); and, either way, an error that never echoes more than a
   short prefix of what was sent, so a probe cannot use this door to get
   its own arbitrary text reflected back in the response. `status` is
   carried on the answer so api/package.js can send the honest code (400
   for a malformed or oversized id, 404 for one that is simply not on the
   shelf) without this file importing anything about HTTP. */
const MAX_ID_LEN = 200;
const idPrefix = s => String(s || "").slice(0, 60);

export async function buildPackage(idOrPath) {
  const raw = String(idOrPath == null ? "" : idOrPath);
  if (raw.length > MAX_ID_LEN)
    return { ok: false, status: 400, error: "the id is too long (over " + MAX_ID_LEN + " characters)" };
  let obj;
  try { obj = resolveObject(parseInput(raw)); }
  catch { return { ok: false, status: 400, error: "the id could not be read: " + idPrefix(raw) }; }
  if (!obj) return { ok: false, status: 404, error: "no such object: " + idPrefix(raw) };
  const cid = contentId(obj);
  const cards = await PAGE.manifest();
  const { reels, films } = derivativesOf(cid, cards);
  const related = relatedRooms(obj);
  const der = { reels, films, related };
  const drafts = buildDrafts(obj);
  const gaps = gapsFor(obj, der);
  return { ok: true, status: 200, content_id: cid, object: obj, derivatives: der, drafts, gaps };
}
