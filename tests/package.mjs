/* NOOR · the Content Factory, checked as a promise.
   ---------------------------------------------------------------------------
   Masterplan step 6, owner narrow form of 24 September 2026: one library
   object becomes a full package of per-platform drafts, on command, nothing
   posted, nothing invented, no model. This file proves api/_package.js's
   pure logic (resolve one of each room family, every draft within its own
   platform's limit, no em dash or en dash anywhere, the canonical link on
   every draft, no source quoted that the object's own data does not carry,
   the X thread numbered and each post within 280, the Reddit body carrying
   its sources before the link, the gaps named honestly) and api/package.js's
   owner gate (refuses without ADMIN_SECRET, refuses without the cookie or
   the key, answers with it).

   Also proves, over the WHOLE corpus (1,907 objects: every Light, every
   verse the shelf's table covers, every dictionary word, every prophet,
   companion, character and place, all 71 chapters, all 114 surahs, all 99
   Names), that the X thread never drops or changes a word: the joined
   posts, minus the numbering and the tail's own notice, are the object's
   own title-then-text-then-detail exactly, whitespace collapsed, or, once
   the thread is too long for its own cap, an honest, unbroken prefix of
   it, never a prefix with a gap in the middle; that Pinterest and Threads
   keep their closing lines (the link, and the Source line when there is
   room for it, since the fix of 24 September 2026) and never cut a word
   in half; that a surah cites only itself, never a virtue hadith that
   does not back the text it is quoting; that a prophet, a companion, a
   character or a chapter of the Path cites a hadith only where the text
   it drafted actually states the hadith's own claim; that a verse always
   carries its own Arabic and, only when the house holds one locally,
   its own English sense; that word:__proto__ and its kin answer 404, not
   the prototype chain; that a Name's own printed content_id (name:<slug>)
   is accepted back as input; and that a malformed, oversized or merely
   unresolved id is refused honestly (400 or 404), never crashed on or
   echoed back whole.

   Run:  node tests/package.mjs
*/
process.env.ADMIN_SECRET = "a-test-admin-secret-long-enough-for-hmac";

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { buildPackage } from "../api/_package.js";
import * as PAGE from "../api/page.js";

/* the whole corpus, the same 1,907 objects a real "Make a package" run can
   ever be asked about: every Light, every verse the shelf's own table
   covers, every dictionary word, every prophet, companion, character and
   place, all 71 chapters, all 114 surahs, all 99 Names. Built once, used
   by every corpus-wide check below rather than each one reading the data
   files again. */
async function wholeCorpus() {
  const ids = [];
  const lightsFile = JSON.parse(fs.readFileSync(path.join(process.cwd(), "lights/all.json"), "utf8"));
  for (const L of (Array.isArray(lightsFile.lights) ? lightsFile.lights : [])) ids.push("light:" + L.id);
  for (const v of await PAGE.verseRows()) ids.push("verse:" + v.ref.replace(":", "-"));
  for (const w of Object.keys(PAGE.dictionary())) ids.push("word:" + w);
  for (const p of PAGE.prophets()) ids.push("prophet:" + p.id);
  for (const c of PAGE.characters()) ids.push((c.group === "companions" ? "companion:" : "character:") + c.id);
  for (const pl of PAGE.places()) ids.push("place:" + pl.id);
  for (let n = 1; n <= 71; n++) ids.push("chapter:" + n);
  for (let n = 1; n <= 114; n++) ids.push("surah:" + n);
  for (let n = 1; n <= 99; n++) ids.push("name:" + n);
  return ids;
}
const CORPUS = await wholeCorpus();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };
const DASH = /[–—]/;

const LIMITS = { instagram: 2200, facebook: 2200, threads: 500 };

function checkPackage(id, label) {
  return buildPackage(id).then(r => {
    ok(r.ok, label + " resolves (" + id + ")");
    if (!r.ok) return null;
    ok(/^[a-z]+:.+/.test(r.content_id), label + " carries a content_id of the graph's own shape (" + r.content_id + ")");
    ok(!!r.object.url && r.object.url.startsWith("https://noorcodex.com/"), label + " carries a canonical site url");
    const blob = JSON.stringify(r);
    ok(!DASH.test(blob), label + " carries no em dash or en dash anywhere in the package");

    for (const ch of Object.keys(LIMITS)) {
      ok(r.drafts[ch].text.length <= LIMITS[ch], label + "'s " + ch + " draft is within " + LIMITS[ch] + " characters (" + r.drafts[ch].text.length + ")");
      ok(r.drafts[ch].text.includes(r.object.url), label + "'s " + ch + " draft carries the canonical link");
    }
    ok(r.drafts.pinterest.title.length <= 100, label + "'s Pinterest title is within 100 characters");
    ok(r.drafts.pinterest.text.length <= 500, label + "'s Pinterest description is within 500 characters");
    ok(r.drafts.youtube.title.length <= 100, label + "'s YouTube title is within 100 characters (" + r.drafts.youtube.title.length + ")");
    ok(r.drafts.youtube.description.includes(r.object.url), label + "'s YouTube description carries the room link");
    ok(r.drafts.reddit.title.length <= 300, label + "'s Reddit title is within 300 characters");

    /* the X thread: numbered, every post within 280, the last carries the
       link, and, when the object has sources, the same last post carries
       at least the first of them */
    const x = r.drafts.x;
    ok(Array.isArray(x) && x.length > 0, label + "'s X thread has at least one post");
    ok(x.every(p => p.length <= 280), label + "'s X thread never exceeds 280 characters a post (max " + Math.max(...x.map(p => p.length)) + ")");
    ok(x.every((p, i) => p.startsWith((i + 1) + "/" + x.length + " ")), label + "'s X thread is numbered k/n in order");
    ok(x[x.length - 1].includes(r.object.url), label + "'s X thread ends on the room link");
    if (r.object.sources.length) ok(x[x.length - 1].includes(r.object.sources[0].slice(0, 20)), label + "'s X thread carries a source on its last post");

    /* Reddit: source-backed discussion first, the link only at the end
       (masterplan section 9: "not an automated link dump") */
    if (r.object.sources.length) {
      const body = r.drafts.reddit.text;
      const srcAt = body.indexOf("Source:"), linkAt = body.indexOf(r.object.url);
      ok(srcAt >= 0 && linkAt > srcAt, label + "'s Reddit body carries its sources before the link");
    }
    ok(r.drafts.reddit.text.split("#").length === 1, label + "'s Reddit body carries no hashtag wall");

    /* nothing invented: every "Source: ..." line in a draft is built only
       from strings the object's own sources array holds */
    for (const s of r.object.sources) ok(typeof s === "string" && s.length > 0, label + "'s every source is a real, non-empty string");
    const igText = r.drafts.instagram.text;
    if (r.object.sources.length) {
      const claimed = igText.match(/Source:\s*(.+)/);
      ok(!!claimed && claimed[1].startsWith(r.object.sources.join("; ")), label + "'s Instagram source line quotes only the object's own sources");
    } else {
      ok(!/Source:/.test(igText), label + "'s Instagram draft names no source it does not have");
    }
    return r;
  });
}

console.log("\none of each room family");
const cases = [
  ["light:quran-guards-itself", "a Light"],
  ["verse:2-255", "a verse"],
  ["word:tawhid", "a word"],
  ["prophet:musa", "a prophet"],
  ["companion:c-bilal", "a companion"],
  ["place:p-badr", "a place"],
  ["chapter:8", "a chapter of the Path"],
  ["surah:19", "a surah"],
  ["name:1", "a Name"]
];
let results = {};
for (const [id, label] of cases) { results[id] = await checkPackage(id, label); }

/* ---------------------------------------------------------------------------
   the X thread never drops a word or changes it (coordinator's fixes,
   both rounds, 24 September 2026)

   The first version of this check re-split the body into sentences itself
   and asked whether each one turned up; that made the test only as honest
   as its own copy of the splitter, and a splitter bug (splitting "29.53"
   into "29." and "53", or stranding a closing quote) would have passed
   its own test cleanly since both sides used the same broken rule. This
   version never re-splits anything: it collapses whitespace on both
   sides, and asks whether the joined posts (title post and body posts,
   the tail post left out since it is the source and the link, never the
   object's own words) are the object's own text (title, then its text,
   then its detail) byte for byte, or, once the thread is too long for the
   cap, an honest, unbroken PREFIX of it, never a prefix with a gap torn
   out of the middle. Run over the whole corpus, not a sample: every
   Light, verse, word, prophet, companion, character, place, chapter,
   surah and Name that resolves at all. */
const collapse = s => String(s || "").replace(/\s+/g, " ").trim();
const TAIL_NOTICE = "The rest, and every source, is at the link.";

function referenceTextOf(obj) {
  const bodyRaw = [obj.text, obj.detail].filter(Boolean).join(" ") || obj.title;
  const titleText = String(obj.title || "").trim();
  const titlePost = /[.!?]$/.test(titleText) ? titleText : titleText + ".";
  return collapse(titlePost + " " + bodyRaw);
}

async function checkThreadFidelity(ids, label) {
  const bad = [];
  let truncatedCount = 0;
  for (const id of ids) {
    const r = await buildPackage(id);
    if (!r.ok) continue;
    const reference = referenceTextOf(r.object);
    const texts = r.drafts.x.map(p => p.replace(/^\d+\/\d+ /, ""));
    const tail = texts[texts.length - 1];
    const truncated = tail.includes(TAIL_NOTICE);
    if (truncated) truncatedCount++;
    const joined = collapse(texts.slice(0, -1).join(" "));
    const matches = truncated ? (joined.length > 0 && reference.startsWith(joined)) : joined === reference;
    if (!matches) bad.push(id);
  }
  const n = ids.length;
  ok(bad.length === 0, label + ": all " + n + " X threads (" + truncatedCount + " honestly truncated) reconstruct the object's own text exactly, whitespace collapsed" +
     (bad.length ? " -- FAILED on " + bad.length + ": " + bad.slice(0, 5).join(", ") : ""));
}

console.log("\nthe X thread never drops or changes a word: the whole corpus, " + CORPUS.length + " objects");
await checkThreadFidelity(CORPUS, "the whole corpus");

/* the three faults named directly: "29.53" and "2.5" never split, a
   quoted question a lowercase "he asked" answers stays one sentence
   (prophet:zakariyya), and a closing quote stays on the sentence that
   just ended rather than starting the next one (companion:c-bilal) */
console.log("\nthe three named faults, by name");
{
  const zak = await buildPackage("prophet:zakariyya");
  const zakPosts = zak.drafts.x.map(p => p.replace(/^\d+\/\d+ /, ""));
  ok(!zakPosts.some(p => /^['‘’]?\s*he asked/i.test(p.trim())), "no post of zakariyya's thread opens as an orphaned \"' he asked\", the quote stranded from its own question");
  ok(zakPosts.some(p => p.includes("'From where is this?' he asked")), "the quoted question and its \"he asked\" stay one sentence together");

  const bilal = await buildPackage("companion:c-bilal");
  const bilalX = bilal.drafts.x.map(p => p.replace(/^\d+\/\d+ /, "")).join(" ");
  ok(bilalX.includes('in Jannah." He answered'), "c-bilal's closing quote stays on the sentence that ends, not the one that starts");

  /* the two decimals the coordinator named by value, both real objects:
     light:sign-crescents-are-timings carries 29.53, light:birmingham-
     quran-2015 and light:tubingen-fragment both carry 95.4 */
  for (const id of ["light:sign-crescents-are-timings", "light:birmingham-quran-2015", "light:tubingen-fragment"]) {
    const r = await buildPackage(id);
    const decimal = (r.object.text.match(/\d+\.\d+/) || [])[0];
    const joined = r.drafts.x.map(p => p.replace(/^\d+\/\d+ /, "")).join(" ");
    ok(decimal && joined.includes(decimal), id + "'s own decimal (" + decimal + ") turns up whole in its X thread, never split at the point");
  }
}

/* ---------------------------------------------------------------------------
   Pinterest and Threads: the same "no silent loss" promise, whole corpus.
   A shortened body ends at a sentence or word boundary with an ellipsis
   (api/_channels.js's own cut() and api/_threads.js's own cut()/
   cutKeepTail() all trim the trailing partial word before adding one),
   and the closing lines survive: the link for Threads (and, since the fix
   of 24 September 2026, the Source line too, whenever it can fit), and
   the sources line for Pinterest (api/_package.js's pinterestBody,
   capBody'd with room reserved for the source, the way Instagram,
   Facebook, Reddit and YouTube's bodies already were).
--------------------------------------------------------------------------- */
async function checkNoSilentLoss(ids, label) {
  const badEllipsis = [], badPinSource = [], badThreadsLink = [], badThreadsSource = [];
  let withSource = 0;
  for (const id of ids) {
    const r = await buildPackage(id);
    if (!r.ok) continue;
    const obj = r.object, pin = r.drafts.pinterest.text, th = r.drafts.threads.text;
    for (const text of [pin, th]) {
      if (!text.includes("…")) continue;
      const before = text.slice(0, text.indexOf("…"));
      if (/\s$/.test(before) || !before.length) badEllipsis.push(id);
    }
    if (!th.includes(obj.url)) badThreadsLink.push(id);
    if (obj.sources.length) {
      withSource++;
      if (!/Source:/.test(pin)) badPinSource.push(id);
      if (!/Source:/.test(th)) badThreadsSource.push(id);
    }
  }
  ok(badEllipsis.length === 0, label + ": no ellipsis in a Pinterest or Threads draft ever lands on a trailing space (" + badEllipsis.length + " bad of " + ids.length + ")");
  ok(badThreadsLink.length === 0, label + ": every Threads draft keeps its closing link (" + badThreadsLink.length + " missing of " + ids.length + ")");
  ok(badPinSource.length === 0, label + ": every Pinterest draft with a source keeps its Source line (" + badPinSource.length + " missing of " + withSource + " sourced)");
  ok(badThreadsSource.length === 0, label + ": every Threads draft with a source keeps its Source line too (" + badThreadsSource.length + " missing of " + withSource + " sourced)");
}

console.log("\nPinterest and Threads: closing lines survive, no word cut in half, the whole corpus");
await checkNoSilentLoss(CORPUS, "the whole corpus");

console.log("\nboth input forms");
{
  const a = await buildPackage("/light/quran-guards-itself");
  const b = await buildPackage("light:quran-guards-itself");
  ok(a.ok && b.ok && a.content_id === b.content_id, "a site path and a content_id resolve to the same object");
}

console.log("\ngaps, named honestly");
{
  const r = results["light:quran-guards-itself"];
  ok(r.derivatives.reels.some(c => c.id === "know-guards-itself"), "the graph traces this Light's own Did you know card, which no exact-id guess would have found");
  ok(r.gaps.some(g => /no film/i.test(g)), "and, honestly, no film exists for it yet");
  ok(!r.gaps.some(g => /arabic/i.test(g)), "a Light is never told it is missing Arabic it was never meant to carry");

  const noShelf = await buildPackage("light:umm-waraqah-household-imam");
  ok(noShelf.ok && !noShelf.derivatives.reels.length, "a Light the graph carries no reel_of edge for shows none");
  ok(noShelf.gaps.some(g => /no reel/i.test(g)), "and is told plainly it has no reel");
  ok(noShelf.gaps.some(g => /no film/i.test(g)), "and no film");

  const withReel = await buildPackage("word:tawhid");
  ok(withReel.derivatives.reels.some(c => c.id === "word-tawhid"), "a word already on the shelf shows its own reel card");
  ok(!withReel.gaps.some(g => /no reel/i.test(g)), "and so is not told it has none");
}

console.log("\nnever invents a source");
{
  const r = await buildPackage("word:tawhid");
  ok(Array.isArray(r.object.sources) && r.object.sources.length === 0, "a dictionary word carries no source field yet, honestly (arch-014)");
  ok(r.gaps.some(g => /no sources/i.test(g)), "and the gap says so");
  ok(!/Source:/.test(r.drafts.instagram.text), "so its Instagram draft names no source");
  ok(!/Source:/.test(r.drafts.reddit.text.split("Fuller version:")[0]), "and its Reddit body names none before the link either");
}

console.log("\na film matched only where the fact is certain (Hajj words, ARCHITECTURE.md)");
{
  const r = await buildPackage("word:ihram");
  ok(r.derivatives.films.some(f => f.id === "short-ihram") && r.derivatives.films.some(f => f.id === "short-miqat"),
     "ihram traces to both shorts that cite hajj.html#ihram, the same as build_graph.py's own documented trace");
}

console.log("\na surah cites no source that does not back its own text");
{
  /* study/<n>.json's virtue is a hadith about the MERIT of reciting the
     surah; a surah's drafted text is context[0] or name_story, the house's
     own written account of the surah, never the virtue report. Citing
     virtue.src beside that text used to print "Source: no authentic virtue
     report..." on 17 surahs and a real but unrelated hadith beside a
     history paragraph on 44 more. The paragraph is the house's own account
     from the commentators, so a surah carries no source line at all. */
  const bad = [];
  for (let n = 1; n <= 114; n++) {
    const r = await buildPackage("surah:" + n);
    if (!r.ok) continue;
    if (r.object.sources.length !== 0) bad.push(n);
    if (Object.values(r.drafts || {}).some(d => /Source:/.test(JSON.stringify(d)))) bad.push(n);
  }
  ok(bad.length === 0, "no surah draft carries a source line: the context paragraph is the house's own account (" + bad.length + " bad)");
  const r19 = await buildPackage("surah:19");
  ok(r19.gaps.some(g => /source/i.test(g)), "and surah:19's gaps say no source is recorded for its text");
}

console.log("\na hadith source is kept only where the drafted text actually states its claim");
{
  /* the same mistake, corpus wide: a prophet, a companion, a character or
     a chapter of the Path could cite a hadith's source though the fact
     that hadith documents (Adam created on a Friday, say) never appears
     anywhere in the text the draft goes on to quote. A Qur'an ref stays:
     it is the same record's own curated verse for the same story. */
  const adam = await buildPackage("prophet:adam");
  ok(!adam.object.sources.includes("Sahih Muslim 854"), "adam's story never mentions Friday, so the Friday hadith is not cited beside it");
  ok(!adam.object.sources.includes("Sahih al-Bukhari 3340"), "nor the Day of Resurrection hadith it never quotes");
  const bilalSrc = await buildPackage("companion:c-bilal");
  ok(bilalSrc.object.sources.includes("Bukhari 1149 · Muslim 2458"), "a hadith actually quoted in the text (c-bilal's own) is still cited");
}

console.log("\na verse carries the verse itself, Arabic always, English when the house holds one locally");
{
  const withNote = await buildPackage("verse:2-255");
  ok(withNote.object.text.length > 0, "a verse with a written note leads with its sense");
  ok(withNote.object.detail === withNote.object.arabic && withNote.object.arabic.length > 0, "and carries the Arabic too");
  ok(!withNote.gaps.some(g => /English meaning/i.test(g)), "so no gap is named for it");

  const noNote = await buildPackage("verse:2-1");
  ok(noNote.object.text === "", "a verse with no local note honestly carries no English text");
  ok(noNote.object.detail === noNote.object.arabic && noNote.object.arabic.length > 0, "but the Arabic itself is always there");
  ok(noNote.gaps.some(g => /no English meaning is held locally for this verse/i.test(g)), "and the gap names exactly what is missing");
  const body = noNote.drafts.instagram.text;
  ok(body.includes(noNote.object.arabic), "so the Instagram draft carries the Arabic rather than repeating only the title");
  ok(body !== noNote.object.title, "the draft is not merely the title with nothing behind it");
}

console.log("\nthe dictionary lookup answers only its own keys (item 4, 24 September 2026)");
{
  for (const bad of ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"]) {
    const r = await buildPackage("word:" + bad);
    ok(!r.ok && r.status === 404, "word:" + bad + " is refused as not found (404), never answered from the prototype chain");
  }
  const real = await buildPackage("word:tawhid");
  ok(real.ok, "a real word still resolves");
}

console.log("\na Name accepts the graph's own slug back as input, the id the package itself prints");
{
  const byPosition = await buildPackage("name:1");
  const bySlug = await buildPackage("name:" + byPosition.content_id.slice("name:".length));
  ok(bySlug.ok && bySlug.content_id === byPosition.content_id, "name:<slug> resolves to the same object as its own position");
  const collision1 = await buildPackage("name:48"), collision2 = await buildPackage("name:65");
  ok(collision1.content_id !== collision2.content_id, "the two Names sharing a transliteration still print two different ids");
  const bySlug1 = await buildPackage("name:" + collision1.content_id.slice("name:".length));
  ok(bySlug1.ok && bySlug1.content_id === collision1.content_id, "and each slug resolves back to its own Name, not the other");
}

console.log("\nan id that is malformed, oversized, or simply not on the shelf");
{
  const r = await buildPackage("light:no-such-light-exists");
  ok(!r.ok && r.status === 404 && /no such object/.test(r.error), "a Light that does not exist is refused honestly, not guessed at (404)");
  const r2 = await buildPackage("");
  ok(!r2.ok, "an empty id is refused");
  const r3 = await buildPackage("banana:1");
  ok(!r3.ok, "an unknown type is refused");
  const r4 = await buildPackage("light:" + "a".repeat(300));
  ok(!r4.ok && r4.status === 400 && /too long/.test(r4.error), "an id over 200 characters is refused (400), not processed");
  const r5 = await buildPackage("/light/%zz");
  ok(!r5.ok && r5.status === 400, "a %-escape decodeURIComponent cannot read is refused (400), not crashed on");
  const probe = "x".repeat(5000);
  const r6 = await buildPackage("light:" + probe);
  ok(!JSON.stringify(r6).includes(probe), "and an oversized id is never echoed back whole into the error");
}

/* ---------------------------------------------------------------------------
   the owner gate, on the route itself
--------------------------------------------------------------------------- */
console.log("\nthe owner gate (api/package.js)");
const { default: handler } = await import("../api/package.js");
function fakeRes() {
  const r = { code: 0, headers: {}, body: null };
  r.status = c => { r.code = c; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.json = o => { r.body = o; return r; };
  return r;
}
function cookieFor(secret, ms = Date.now() + 3600e3) {
  const sig = crypto.createHmac("sha256", secret).update(String(ms)).digest("hex");
  return "noor_admin=" + ms + "." + sig;
}
{
  const secret = process.env.ADMIN_SECRET;
  delete process.env.ADMIN_SECRET;
  const r = fakeRes();
  await handler({ query: { id: "light:quran-guards-itself" }, headers: {} }, r);
  ok(r.code === 501, "with no ADMIN_SECRET configured at all, the route says so (501)");
  process.env.ADMIN_SECRET = secret;
}
{
  const r = fakeRes();
  await handler({ query: { id: "light:quran-guards-itself" }, headers: {} }, r);
  ok(r.code === 401, "with ADMIN_SECRET set but no cookie and no key, the route refuses (401)");
}
{
  const r = fakeRes();
  await handler({ query: { id: "light:quran-guards-itself" }, headers: { "x-admin-key": process.env.ADMIN_SECRET } }, r);
  ok(r.code === 200 && r.body.ok && r.body.content_id === "light:quran-guards-itself", "with the admin key header, the route answers with the package");
  ok(r.headers["Cache-Control"] === "no-store", "and the answer is never cached");
}
{
  const r = fakeRes();
  await handler({ query: { id: "light:quran-guards-itself" }, headers: { cookie: cookieFor(process.env.ADMIN_SECRET) } }, r);
  ok(r.code === 200 && r.body.ok, "with the console's own signed cookie, the route answers too");
}
{
  const r = fakeRes();
  await handler({ query: {}, headers: { "x-admin-key": process.env.ADMIN_SECRET } }, r);
  ok(r.code === 400, "with no ?id= at all, the route says so plainly rather than guessing");
}
{
  const r = fakeRes();
  await handler({ query: { id: "light:" + "a".repeat(300) }, headers: { "x-admin-key": process.env.ADMIN_SECRET } }, r);
  ok(r.code === 400, "the route itself answers 400 for an oversized id, not 500");
}
{
  const r = fakeRes();
  await handler({ query: { id: "/light/%zz" }, headers: { "x-admin-key": process.env.ADMIN_SECRET } }, r);
  ok(r.code === 400, "and 400 for an id whose %-escape cannot be read, not 500");
}
{
  const r = fakeRes();
  await handler({ query: { id: "light:no-such-light-exists" }, headers: { "x-admin-key": process.env.ADMIN_SECRET } }, r);
  ok(r.code === 404, "and 404, not 500, for an id that is simply not on the shelf");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
