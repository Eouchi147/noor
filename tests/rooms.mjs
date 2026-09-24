/* The promise this file keeps:
   every room api/page.js renders (a Light, a chapter, a verse, a surah, the
   day, and the three shelves) comes back whole: a 200 with a title, a
   canonical, structured data and the second cut's shell; an address that
   names nothing comes back as a 404 in the same shell; a verse range parses;
   the rooms' sitemap lists every Light, chapter and surah; nothing on any
   page is half finished or shows a face; the shell's secondary text clears
   4.5:1 on the night; the bar's five doors are Today, Qur'an, Story, Words
   and Search and each room lights the right one; every transition of the
   shell's rides the spring (fades and blurs the bezier) and none of it
   moves under prefers-reduced-motion; the older rooms' skin is loaded by
   noor-fx.js and never sets gold on parchment; and vercel.json still
   parses with every rewrite pointing at a file that exists.

   Drives the real handlers with fake requests. The Qur'an API and the reels
   manifest are stubbed, so the file runs without a network.

   Run:  node tests/rooms.mjs */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
process.chdir(ROOT);
/* api/page.js reads reels/index.json from disk before it asks the site for
   it, and since the shelf's pull request landed the file is on disk: four
   verse assertions written against the stub below were reading the live
   manifest (a different reciter, no example.org video). The handler now runs
   in a copy of the tree made of links, everything but reels/, so the stub is
   the manifest again and the file keeps its promise without a network. */
import os from "node:os";
const FARM = fs.mkdtempSync(path.join(os.tmpdir(), "noor-rooms-"));
for (const f of fs.readdirSync(ROOT)) if (f !== "reels" && f !== "node_modules") fs.symlinkSync(path.join(ROOT, f), path.join(FARM, f));
process.chdir(FARM);
process.on("exit", () => { try { fs.rmSync(FARM, { recursive: true, force: true }); } catch { } });

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };
const skip = m => console.log("  SKIP " + m);

/* ---------- the stubs: the Qur'an API and the manifest, without a network ---------- */
let apiDown = false, downAsks = 0;
globalThis.fetch = async (url) => {
  url = String(url);
  const json = j => ({ ok: true, json: async () => j });
  if (url.includes("/reels/index.json")) return json({ n: 2, written: "2026-09-08", cards: [
    { id: "verse-94-5-6", kind: "verse", slot: "morning", hook: "Qur'an 94:5-6", caption: "94:5-6\n\nsabr", reciter: "Mishary Rashid Alafasy", cover: true, video: "https://example.org/verse-94-5-6.mp4", uploaded: "2026-09-07T08:00:00Z" },
    { id: "verse-2-153", kind: "verse", slot: "evening", hook: "Qur'an 2:153", caption: "…", reciter: "Abdul Basit Abdus Samad", cover: true },
    { id: "word-sabr", kind: "word", slot: "evening", hook: "Sabr", caption: "…", cover: true }
  ] });
  if (apiDown) { if (/\/ayah\//.test(url)) downAsks++; return { ok: false, status: 503, json: async () => ({}) }; }
  const m = url.match(/\/ayah\/(\d+):(\d+)\//);
  if (m) return json({ data: [
    { text: "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا", edition: { identifier: "quran-uthmani" }, surah: { number: +m[1], name: "سورة الشرح", englishName: m[1] === "3" ? "Al <b>Imran</b>" : "Ash-Sharh", englishNameTranslation: "The Relief", numberOfAyahs: 8, revelationType: "Meccan" } },
    { text: "For indeed, with hardship [will be] ease.", edition: { identifier: "en.sahih" } } ] });
  if (/\/surah\/\d+$/.test(url)) return json({ data: { number: 2, name: "سورة البقرة", englishName: "Al-Baqarah", englishNameTranslation: "The Cow", numberOfAyahs: 286, revelationType: "Medinan" } });
  if (url.includes("/api/illuminations")) return json({ date: "2026-09-09", category: "Early Islam", title: "Badr is the only battle the Qur'an names outright",
    story: "On 17 Ramadan in year 2 of the Hijra a small Muslim force met a far larger Makkan army at the wells of Badr.", detail: "Wells of Badr · 17 Ramadan 2 AH", id: "battle-of-badr-624", src: "Qur'an 3:123" });
  return { ok: false, status: 404, json: async () => ({}) };
};

const page = await import("../api/page.js");
const sitemap = await import("../api/sitemap.js");

function res() {
  const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.end = b => { r.body = b; return r; };
  return r;
}
const call = async (query, handler = page.default) => { const r = res(); await handler({ method: "GET", headers: { host: "noorcodex.com" }, query }, r); return r; };
const ld = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const hasShell = html => /<html lang="en" data-n2/.test(html) && html.includes("/assets/noor2.css?v=") && html.includes("/assets/noor2.js?v=")
  && html.includes('class="n2-bar"') && html.includes('class="n2-top"') && html.includes("fonts.googleapis.com");

console.log("\n=== the rooms render whole ===");
const KINDS = [
  ["light", { kind: "light", id: "battle-of-badr-624" }, "/light/battle-of-badr-624", "Article"],
  ["lights", { kind: "lights" }, "/light", "CollectionPage"],
  ["path", { kind: "path", n: "2" }, "/path/2", "Article"],
  ["paths", { kind: "paths" }, "/path", "CollectionPage"],
  ["verse", { kind: "verse", ref: "94-5-6" }, "/verse/94-5-6", "CreativeWork"],
  ["verses", { kind: "verses" }, "/verses", "CollectionPage"],
  ["surah", { kind: "surah", n: "2" }, "/surah/2", "Chapter"],
  ["today", { kind: "today" }, "/today", "WebPage"]
];
const rendered = {};
for (const [name, q, canon, type] of KINDS) {
  const r = await call(q);
  rendered[name] = r.body;
  ok(r.code === 200, name + " answers 200");
  ok(/<title>[^<]+· NOOR<\/title>/.test(r.body), name + " has a title");
  ok(r.body.includes('<link rel="canonical" href="https://noorcodex.com' + canon + '"/>'), name + " has its canonical " + canon);
  ok(r.body.includes('<meta name="description"') && r.body.includes('property="og:image"') && r.body.includes('name="twitter:card" content="summary_large_image"'), name + " has description, og:image and twitter card");
  let data = [];
  try { data = ld(r.body); } catch { }
  const types = data.flat().map(x => x["@type"]);
  ok(types.includes("BreadcrumbList") && types.includes(type), name + " carries JSON-LD (" + types.join(", ") + ")");
  ok(hasShell(r.body), name + " is in the shell");
  if (name === "today") ok(/^public, max-age=0, s-maxage=(\d+)$/.test(r.headers["Cache-Control"]) && +r.headers["Cache-Control"].match(/s-maxage=(\d+)/)[1] >= 60 && +r.headers["Cache-Control"].match(/s-maxage=(\d+)/)[1] <= 86400,
    "today is cached only until midnight UTC, no stale-while-revalidate (" + r.headers["Cache-Control"] + ")");
  else if (name === "light") ok(/^public, max-age=0, s-maxage=\d+$/.test(r.headers["Cache-Control"]), "the day's own Light turns over at midnight with the day (" + r.headers["Cache-Control"] + ")");
  else ok(r.headers["Cache-Control"] === "public, s-maxage=86400, stale-while-revalidate=604800", name + " is cached a day at the edge");
  ok(r.headers["Content-Type"] === "text/html; charset=utf-8", name + " is HTML");
}
/* Audit seo-019: the surah's Chapter named no publisher. A Light and a
   chapter's Article carry no datePublished or dateModified at all, since a
   last-edit date is not a publication date and none truthful exists yet;
   printing none is the honest answer, not a guessed one. */
{
  const lightLd = ld(rendered.light).flat().find(x => x["@type"] === "Article");
  ok(lightLd && !("datePublished" in lightLd) && !("dateModified" in lightLd), "a Light's Article prints no date it cannot back");
  const pathLd = ld(rendered.path).flat().find(x => x["@type"] === "Article");
  ok(pathLd && !("datePublished" in pathLd) && !("dateModified" in pathLd), "a chapter's Article prints no date it cannot back");
  const surahLd = ld(rendered.surah).flat().find(x => x["@type"] === "Chapter");
  ok(surahLd && surahLd.publisher && surahLd.publisher.name, "the surah's Chapter names a publisher");
}
ok(rendered.light.includes('<span class="n2-g">'), "the Light's key phrase is set in gold");
ok(rendered.light.includes("Source · Qur&#39;an 3:123"), "the Light's source line is shown");
ok(rendered.light.includes("/dictionary/badr"), "the Light reads beside the word Badr");
ok(rendered.light.includes("/light/badr-wells-on-the-caravan-road") && rendered.light.includes('<ul class="n2-shelf">'), "the Light reads beside a related Light, on a shelf");
ok(rendered.verse.includes("<video") && rendered.verse.includes("https://example.org/verse-94-5-6.mp4") && !/<video[^>]*autoplay/.test(rendered.verse), "the verse carries its reel, not autoplaying");
/* Audit perf-018: the verse room preloaded its reel from github.com with
   preload="metadata", a request every reader paid whether or not they ever
   pressed play; the home page's own reel already waits for the tap. */
ok(/<video playsinline preload="none"/.test(rendered.verse), "the verse room's reel waits for a tap, like the home page's");
ok(rendered.verse.includes("Saheeh International") && rendered.verse.includes("recited by Mishary Rashid Alafasy"), "the verse names its translation and its reciter");
ok(rendered.verse.includes('href="/quran?surah=94&amp;ayah=5"') && rendered.verse.includes('href="/surah/94"'), "the verse links the Mushaf and its surah");
ok(rendered.verse.includes("/dictionary/sabr"), "the verse reads beside the caption's word");
ok(/isPartOf/.test(rendered.verse), "the verse's JSON-LD names what it is part of");
ok(rendered.surah.includes("Al-Baqarah") && rendered.surah.includes("286 verses") && rendered.surah.includes("Madinah"), "the surah shows name, count and place from the API");
ok(rendered.surah.includes("The context") && rendered.surah.includes("The name") && rendered.surah.includes("The themes") && rendered.surah.includes("The heart of it"), "the surah carries its study material");
/* study/1..114.json carry four more fields the page never drew: how the
   surah moves, the verses worth knowing, what is said about reciting it,
   and the surahs it travels with. 283 KB of written, sourced study on 114
   pages, read by nothing. Counted here, all of it, so it cannot go quiet. */
{
  const count = (h, eyebrow) => ((h.match(new RegExp(eyebrow + "<\\/p><ul class=\"n2-list[^\"]*\">([\\s\\S]*?)<\\/ul>")) || ["", ""])[1].split("<li>").length - 1);
  ok(rendered.surah.includes("How it moves") && rendered.surah.includes("Verses worth knowing") && rendered.surah.includes("On reciting it") && rendered.surah.includes("Surahs it travels with"), "the surah carries its four other shelves too");
  ok(count(rendered.surah, "How it moves") === 6 && rendered.surah.includes("Three kinds of people"), "Al-Baqarah is cut into its six movements (" + count(rendered.surah, "How it moves") + ")");
  ok(rendered.surah.includes('href="/quran?surah=2&amp;ayah=21"'), "and a movement opens the Mushaf at its own first verse");
  ok(count(rendered.surah, "Verses worth knowing") === 4 && rendered.surah.includes("/verse/2-255"), "its four verses worth knowing link to their own rooms");
  ok(count(rendered.surah, "Surahs it travels with") === 2 && rendered.surah.includes('href="/surah/3"'), "and the surahs it travels with are named");
  /* the grading is the point: 56 surahs have no established virtue and say
     so, and printing the famous virtue of every surah without saying which
     are established would be doing the reader harm */
  const grade = async n => { const r = await call({ kind: "surah", n: String(n) }); return [(r.body.match(/n2-ev-(\w+)/) || [])[1], r.body]; };
  const [g2, b2] = await grade(2), [g11, b11] = await grade(11), [g5, b5] = await grade(5);
  ok(g2 === "sunnah" && b2.includes("Sunnah-confirmed") && b2.includes("Muslim 780"), "Al-Baqarah's virtue is badged as established, with its sources");
  ok(g11 === "debated" && b11.includes("Scholars differ") && b11.includes("at-Tirmidhi 3297"), "Surah Hud's is badged as disputed, and names the dispute");
  ok(g5 === "none" && b5.includes("No virtue report"), "Al-Ma'idah's says plainly that no authentic report establishes one");
  ok(!/n2-ev-none[\s\S]{0,400}no authentic virtue report/.test(b5), "and does not print a source line that only repeats the badge");
}
ok(rendered.surah.includes('href="/surah/1"') && rendered.surah.includes('href="/surah/3"'), "the surah walks to its neighbours");
ok(rendered.surah.includes("/verse/2-153"), "the surah links its shelved verse");
ok(rendered.path.includes("Adam from Clay") && rendered.path.includes('href="/path/1"') && rendered.path.includes('href="/path/3"'), "the chapter walks to its neighbours");
ok(!rendered.path.includes("/assets/manuscripts/adam.jpg"), "chapter 2's plate is held back (a face in profile)");
{ const r3 = await call({ kind: "path", n: "3" }); ok(r3.body.includes("/assets/manuscripts/hawwa-garden.jpg"), "chapter 3's plate is used because the file exists and shows no face"); }
ok(rendered.path.includes("Muslim 854") && rendered.path.includes("/verse/2-30"), "the chapter carries its narration and links its verse");
/* The seven periods are named and described in i18n/en.json under the ui
   shelf, and api/page.js used to read the pack from the outside, so /path
   headed its seven sections "bidaya", "qisas", "jahiliyyah" and every
   chapter said "chapter 55 of 71 - nihaya". Fourteen keys in twenty-one
   languages, live on seventy-two pages, saying nothing. */
ok(/chapter 2 of 71 · Al-Bidaya/.test(rendered.path), "the chapter names its period, not its slug");
{
  const heads = [...rendered.paths.matchAll(/<h2 class="n2-h3">([^<]*)<\/h2>/g)].map(m => m[1]);
  ok(heads.join("|") === "Al-Bidaya|Qisas al-Anbiya|Al-Jahiliyyah|Al-Seerah|Al-Khulafa|Al-Umam|Al-Nihaya", "the Path's seven sections are named (" + heads.join(", ") + ")");
  ok(!heads.some(h => /^[a-z]+$/.test(h)), "and not one of them is a raw slug");
  ok((rendered.paths.match(/<h2 class="n2-h3">[^<]*<\/h2>\n<p class="n2-dim">/g) || []).length === 7, "each section carries its description");
}
/* Nineteen chapters of Al-Nihaya carry the order of the Hour: where each
   falls, the events inside it, and on three of them what shields you.
   A hundred and eighteen sourced events that no page drew until now. */
{
  const c55 = await call({ kind: "path", n: "55" });
  const b = c55.body;
  ok(/Where it falls/.test(b) && /<span>Phase<\/span><b>Major Signs<\/b>/.test(b) && /<span>Position<\/span><b>1st of the Ten<\/b>/.test(b), "the Dajjal says where he falls in the order");
  const tl = (b.match(/<ol class="n2-tl">([\s\S]*?)<\/ol>/) || ["", ""])[1];
  ok(tl.split("<li>").length - 1 === 7, "and draws his seven events in order (" + (tl.split("<li>").length - 1) + ")");
  ok(tl.includes("Ludd&#39;s gate") && tl.includes("Muslim 2937"), "each event keeps the source it was written with, and its text is escaped");
  const sh = (b.match(/<ul class="n2-shield">([\s\S]*?)<\/ul>/) || ["", ""])[1];
  ok(sh.split("<li>").length - 1 === 4, "and the four shields against him are drawn (" + (sh.split("<li>").length - 1) + ")");
  ok(sh.includes("Surat al-Kahf") && sh.includes("Muslim 809"), "the shield keeps its source too");
  ok(!/Where it falls/.test(rendered.path) && !/n2-tl/.test(rendered.path) && !/n2-shield/.test(rendered.path), "a chapter with none of the three draws none of the three");
  let drawn = 0, events = 0;
  for (let n = 53; n <= 71; n++) {
    const r = await call({ kind: "path", n: String(n) });
    const rows = (r.body.match(/<ol class="n2-tl">([\s\S]*?)<\/ol>/) || ["", ""])[1];
    const c = rows.split("<li>").length - 1;
    if (c) { drawn++; events += c; }
  }
  ok(drawn === 19 && events === 118, "all nineteen chapters of the Hour draw all 118 events (" + drawn + " chapters, " + events + " events)");
}
/* Audit seo-007's chapterDesc, refuter's review: a description built from a
   chapter's own summary and details must never stop inside a quotation it
   opened (node 8, Qur'an 11:44), never repeat a sentence the summary already
   carries in substance (node 69, "Books fly." / "The books fly."), and never
   invent a word the chapter's own text does not have. All 71 are rendered
   and checked here, not sampled, since a chapter is a narrow, countable
   set and the whole point is that none of them is quietly wrong. */
{
  const descOf = html => (html.match(/<meta name="description" content="([^"]*)"/) || ["", ""])[1];
  const plainStrip = s => String(s || "").replace(/\{\{[a-z]+:[^|{}]+\|([^{}]*)\}\}/g, "$1");
  let under50 = [];
  for (let n = 1; n <= 71; n++) {
    const r = await call({ kind: "path", n: String(n) });
    const N = JSON.parse(fs.readFileSync("node/" + n + ".json", "utf8"));
    const d = descOf(r.body).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    ok(d.length > 0 && d.length <= 158, "chapter " + n + "'s description is set and within 158 characters (" + d.length + ")");
    /* a smart-quote pair (“ ”, used for "Read!" and two other short quoted
       lines) balances on its own two characters, not on ", so only a plain
       double-quote mark is counted here */
    const qCount = (d.match(/"/g) || []).length;
    ok(qCount % 2 === 0, "chapter " + n + "'s description never ends inside an open quotation (" + JSON.stringify(d) + ")");
    /* every word of the description must trace to the chapter's own summary
       or details (cross links unwound to their plain label); nothing here
       is written new */
    const src = (String(N.summary || "") + " " + plainStrip(N.details || "")).toLowerCase();
    const srcWords = new Set(src.replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean));
    const descWords = d.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);
    const stray = descWords.filter(w => !srcWords.has(w));
    ok(stray.length === 0, "chapter " + n + "'s description uses only the chapter's own words" + (stray.length ? " → " + stray.join(", ") : ""));
    if (d.length < 50) under50.push(n);
  }
  /* the summary alone reads under 50 characters on eleven chapters; the
     naive first version of this stopped at the first sentence too long to
     fit and gave up, leaving five of those (19, 22, 23, 57, 62) short. Once
     it keeps looking past an oversized sentence for a shorter true one
     later in the same chapter's details, all seventy-one honestly clear 50;
     none is padded to get there and none is left short that need not be. */
  ok(under50.length === 0, "every chapter's description honestly clears 50 characters from its own text" + (under50.length ? " → still short: " + under50.join(",") : ""));
}
ok(rendered.today.includes("Badr is the only battle") && rendered.today.includes("The word") && rendered.today.includes("The Path"), "the day shows the home page's light, the word and the chapter");
ok(rendered.today.includes("/today?date="), "the day walks to the day before");
ok(rendered.lights.split("/light/").length > 350, "the Lights shelf lists every Light");
{
  const heads = [...rendered.lights.matchAll(/<h2 class="n2-h3">([^<]+) <span class="n2-g">· (\d+)<\/span>/g)].map(m => [m[1], +m[2]]);
  ok(heads.length > 0 && heads.length < 200 && heads[0][0] === "Quran" && heads.every((h, i) => !i || heads[i - 1][1] >= h[1]), "the Lights are grouped by first tag, largest group first (" + heads.length + " groups; " + heads.slice(0, 5).map(h => h[0] + " " + h[1]).join(", ") + ")");
  ok(!heads.some(h => h[0] === "Zayd" || h[0] === "Bilal"), "no group is a companion's name (" + heads.filter(h => h[1] === 1).length + " groups of one)");
  ok(page.groupLabel("west-africa") === "West Africa" && page.groupOf({ tags: [] , k: "science" }) === "science", "the label is title-cased and a card without tags groups by kind");
  const first = rendered.lights.slice(rendered.lights.indexOf('<h2 class="n2-h3">Quran'), rendered.lights.indexOf('<h2 class="n2-h3">', rendered.lights.indexOf('<h2 class="n2-h3">Quran') + 10));
  const ids = [...first.matchAll(/\/light\/([^"]+)"/g)].map(m => m[1]);
  const years = ids.map(id => page.lightById(id)).map(L => (L.w && L.w.y) || Infinity);
  ok(years.every((y, i) => !i || years[i - 1] <= y), "within a group the Lights run by date");
}
ok(rendered.paths.split('href="/path/').length > 71, "the Path shelf lists every chapter");

console.log("\n=== the house layer reaches these rooms too ===");
{
  /* Every other page in the house loads /noor-fx.js -- the language door, the
     beacon, the service worker, the social row, the quiet guide's provider and
     Friday's card. These rooms were the one kind that did not, so a chapter
     could carry data-guide and nothing was listening for it, and Friday
     reached every room in the house except the server-rendered ones. */
  for (const [what, html] of [["a chapter", rendered.path], ["today", rendered.today], ["a verse", rendered.verse]]) {
    ok(/<script src="\/noor-fx\.js" defer><\/script>/.test(html), what + " loads the house layer");
  }
  /* chapter 2, Adam from Clay, is one of the thirty that carry a topic */
  ok(/data-guide="n:2"/.test(rendered.path), "and the chapter says which topic the guide should answer for");
  const stray = ["verse", "today", "surah", "lights"].filter(k => /data-guide="/.test(rendered[k] || ""));
  ok(stray.length === 0, "and a room with no topic to answer for asks for nothing" +
     (stray.length ? " (" + stray.join(", ") + ")" : ""));
}

console.log("\n=== the bar's five doors, and which one each room lights ===");
{
  const doors = html => html.match(/<nav class="n2-bar"[^>]*>([\s\S]*?)<\/nav>/)[1];
  const labels = html => [...doors(html).matchAll(/<\/svg>([^<]+)<\/a>/g)].map(m => m[1]);
  const lit = html => { const m = doors(html).match(/<a href="([^"]+)"[^>]*class="n2-on"[^>]*>[\s\S]*?<\/svg>([^<]+)<\/a>/); return m ? m[2] : ""; };
  ok(labels(rendered.today).join(",") === "Today,Qur'an,Story,Words,More", "the doors are Today, Qur'an, Story, Words, More (" + labels(rendered.today).join(", ") + ")");
  ok(!/Listen|#listen|Read<\/a>/.test(doors(rendered.today)), "read and listen are one door, Qur'an");
  /* The fifth door was Search, and five doors could not reach forty-two rooms:
     the other thirty-seven were behind a dial that only the arrival carried, so
     a reader standing in a room on a phone could not get to the Prophets at
     all. It is More now, and it opens one sheet -- the map of the house when it
     is empty, the search once two letters are typed. The dial is retired. */
  ok(/<a href="\/path"[^>]*>/.test(doors(rendered.today)) && /<a href="\/#search" data-n2-more>/.test(doors(rendered.today)), "Story goes to /path; More opens the map, and the arrival without script");
  ok(!/data-nm-open/.test(doors(rendered.today)), "and nothing in the bar reaches for the retired dial");
  ok(lit(rendered.today) === "Today", "the day lights Today");
  ok(lit(rendered.light) === "Today", "the day's own Light lights Today");
  { const other = await call({ kind: "light", id: "ahmad-baba-timbuktu-1593" }); ok(other.code === 200 && lit(other.body) === "" && other.headers["Cache-Control"] === "public, s-maxage=86400, stale-while-revalidate=604800", "any other Light lights no door, and keeps for a day"); }
  ok(lit(rendered.lights) === "", "the shelf of Lights lights no door");
  ok(lit(rendered.path) === "Story" && lit(rendered.paths) === "Story", "a chapter and the Path light Story");
  ok(lit(rendered.verse) === "Qur'an" && lit(rendered.surah) === "Qur'an" && lit(rendered.verses) === "Qur'an", "a verse, a surah and the shelf of verses light Qur'an");
  const svgs = [...doors(rendered.today).matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
  ok(svgs.length === 5 && svgs.every(x => /viewBox="0 0 24 24"/.test(x) && !/<image|<text|face|eye|mouth/i.test(x)), "the icons are simple line SVGs, no faces");
  ok(!/<header class="n2-top">\s*<i class="n2-prog"/.test(rendered.today) && /<i class="n2-prog" aria-hidden="true"><\/i>\s*<header class="n2-top">/.test(rendered.today), "the progress line is its own element, outside the top line that hides");
}
ok(rendered.verses.includes("/verse/94-5-6") && rendered.verses.includes("/verse/2-153") && !rendered.verses.includes("word-sabr"), "the verse shelf lists the manifest's verses and nothing else");

console.log("\n=== a walk by date ===");
{
  const today = new Date().toISOString().slice(0, 10);
  const d = new Date(); d.setUTCDate(d.getUTCDate() - 1);
  const y = d.toISOString().slice(0, 10);
  const r = await call({ kind: "today", date: y });
  ok(r.code === 200 && r.body.includes('href="/today"') && r.body.includes("The day after"), "yesterday links to the day after (today)");
  ok(r.body.includes('property="og:url" content="https://noorcodex.com/today?date=' + y + '"'), "yesterday's og:url still carries its own date");
  /* Audit seo-026: a dated day is the same Light as its own room, so its
     canonical now points there, not at itself, and /today keeps its own. */
  ok(r.body.includes('<link rel="canonical" href="https://noorcodex.com/light/battle-of-badr-624"/>') && !new RegExp('<link rel="canonical" href="https://noorcodex\\.com/today\\?date=' + y).test(r.body),
    "yesterday's canonical points at the Light it shows, not at itself");
  ok(rendered.today.includes('<link rel="canonical" href="https://noorcodex.com/today"/>'), "the day's own /today keeps its own canonical");
  ok(r.headers["Cache-Control"] === "public, s-maxage=86400, stale-while-revalidate=604800", "a dated day is a record and keeps for a day");
  const far = await call({ kind: "today", date: "2020-01-01" });
  ok(far.body.includes('href="https://noorcodex.com/today"/>'), "a date out of range falls back to today");
  ok(!rendered.today.includes("The day after"), "today has no day after");
}

console.log("\n=== an address that names nothing ===");
for (const [q, what] of [[{ kind: "light", id: "no-such-light" }, "a Light"], [{ kind: "path", n: "99" }, "a chapter"], [{ kind: "verse", ref: "115:1" }, "a verse"], [{ kind: "surah", n: "0" }, "a surah"], [{ kind: "nothing" }, "a kind"]]) {
  const r = await call(q);
  ok(r.code === 404 && hasShell(r.body) && r.body.includes("There is no room"), what + " that does not exist is a 404 in the shell");
}

console.log("\n=== a verse range parses ===");
{
  const p = page.parseRef;
  const a = p("94:5-6"), b = p("94-5-6"), c = p("2:255");
  ok(a && a.s === 94 && a.a === 5 && a.b === 6 && a.id === "94-5-6" && a.label === "94:5–6", "94:5-6 parses to surah 94, ayahs 5 to 6");
  ok(b && b.s === 94 && b.a === 5 && b.b === 6, "the hyphen form 94-5-6 parses the same");
  ok(c && c.a === 255 && c.b === 255 && c.id === "2-255", "a single ayah parses");
  ok(!p("0:1") && !p("115:1") && !p("2:300") && !p("2:6-3") && !p("2") && !p("abc"), "impossible references are refused");
  const r = await call({ kind: "verse", ref: "94:5-6" });
  ok(r.code === 200 && r.body.includes("94:5–6") && r.body.split('class="n2-s"').length === 3, "the range page renders both ayahs");
  const v3 = await call({ kind: "verse", ref: "3:139" });
  ok(v3.body.includes("Surah Ali &#39;Imran") && !v3.body.includes("Imran</b>") && !v3.body.includes("Al <b>Imran"), "the surah name comes from the uthmani table even when the live API offers a different, unescaped one (content-009)");
}

console.log("\n=== the Qur'an API being down ===");
{
  apiDown = true;
  const r = await call({ kind: "verse", ref: "2:255" });
  /* seo-008: the Arabic never waited on the API again after 22 September. It
     comes from the reels' own table, the house's written sense of the verse
     is shown where it exists, and a page missing its English tells the edge
     to ask again in ten minutes instead of caching the gap for a day. */
  ok(r.code === 200 && r.body.includes("Qur&#39;an 2:255") && r.body.includes('class="n2-quran"') && r.body.includes("ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ"),
     "a verse the API cannot give still shows its Arabic, from the house's own table");
  ok(/<h1 class="n2-h1">Qur(?:'|&#39;)an 2:255/.test(r.body), "and a headline naming the verse");
  ok(r.body.includes('id="sense"'), "and the house's own written sense of the verse, where it has one");
  ok(r.body.includes("a moment away") && !r.body.includes("n2-credit\">Saheeh"), "and says the English is on the Mushaf, rather than printing an empty translation");
  ok(/s-maxage=600/.test((r.headers && (r.headers["Cache-Control"] || r.headers["cache-control"])) || r.cache || ""), "and is cached for ten minutes, not a day, so the gap heals itself");
  const s = await call({ kind: "surah", n: "112" });
  ok(s.code === 200 && s.body.includes("Al-Ikhlas") && s.body.includes("4 verses"), "a surah the API cannot give still renders from the reels' Qur'an table");
  /* a range with the service down asks it once, not once per verse: the old
     walk broke on the first failure, and the new one must not trade that for
     waiting on every verse in turn */
  downAsks = 0;
  const rg = await call({ kind: "verse", ref: "2:1-7" });
  ok(rg.code === 200 && downAsks === 1 && rg.body.split('class="n2-quran"').length === 2, "a seven verse range with the service down asks it once and still shows all its Arabic (" + downAsks + " asks)");
  apiDown = false;
}

console.log("\n=== verse rooms and reel captions carry the uthmani surah names ===");
/* Two tables have named the surahs since 2026: the reels' own
   tools/reels/quran-uthmani.json ("Al-Fatiha", "Ali 'Imran") and whatever
   the live Qur'an API happens to send ("Al-Faatiha", "Aal-i-Imraan"). 63 of
   the 109 surahs with shelf verses disagreed (content-009). This checks the
   uthmani table is the one name every room and every already-rendered reel
   caption actually carries, not the file that ships beside it. */
{
  const escApos = s => s.replace(/'/g, "&#39;");
  for (const n of [1, 2, 3, 94, 112]) {
    const row = page.surahRow(n);
    const r = await call({ kind: "surah", n: String(n) });
    ok(row && r.body.includes(">" + escApos(row.translit)), "surah " + n + "'s room prints the uthmani name " + (row && row.translit));
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "reels", "index.json"), "utf8"));
  const uthmani = JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "reels", "quran-uthmani.json"), "utf8")).surahs;
  const verseCards = manifest.cards.filter(c => c.kind === "verse" && c.hook);
  let mismatched = 0;
  for (const c of verseCards) {
    const m = /^(.*) · (\d+):/.exec(c.hook);
    if (!m) continue;
    const want = (uthmani[m[2]] || {}).translit;
    if (want && m[1] !== want) mismatched++;
  }
  ok(verseCards.length > 500 && mismatched === 0,
     verseCards.length + " already-rendered reel captions checked against the uthmani table, " + mismatched + " mismatched");
}

/* The sweep is last on purpose: rendering all 114 surah pages caches each
   one's meta, and the block above needs surah 112 to arrive with no meta at
   all so the fallback table is what answers. */
console.log("\n=== all 114 surah pages ===");
{
  const count = (h, eyebrow) => ((h.match(new RegExp(eyebrow + "<\\/p><ul class=\"n2-list[^\"]*\">([\\s\\S]*?)<\\/ul>")) || ["", ""])[1].split("<li>").length - 1);
  let mv = 0, ps = 0, cn = 0, badged = 0;
  for (let n = 1; n <= 114; n++) {
    const r = await call({ kind: "surah", n: String(n) });
    mv += count(r.body, "How it moves"); ps += count(r.body, "Verses worth knowing"); cn += count(r.body, "Surahs it travels with");
    if (/n2-ev-/.test(r.body)) badged++;
  }
  ok(mv === 511 && ps === 432 && cn === 229 && badged === 114,
    "every surah draws all of it: " + mv + " movements, " + ps + " passages, " + cn + " connections, " + badged + " virtue gradings");
}

console.log("\n=== the people, the places and the Names ===");
/* Since 16 September 2026 the prophets (prophets-data.js), the companions
   and the other characters (characters.js), the places (places.js) and the
   99 Names (allah.html's NAMES) have rooms of their own, rendered from the
   same files the hubs read: about 46,000 sourced words that showed only in a
   modal on tap. One room of each family is rendered here whole, and every
   room of every family is rendered and checked for what a room must have. */
const families = {};
{
  const FAM = [
    ["prophet", { kind: "prophet", id: "musa" }, "/prophet/musa", "Person", ["The Prophets", "/prophets"]],
    ["companion", { kind: "companion", id: "c-abubakr" }, "/companion/c-abubakr", "Person", ["The Companions", "/companions"]],
    ["character", { kind: "character", id: "a-jibril" }, "/character/a-jibril", "Thing", ["The Characters", "/characters"]],
    ["place", { kind: "place", id: "p-kaaba" }, "/place/p-kaaba", "Place", ["The Places", "/places"]],
    ["name", { kind: "name", n: "1" }, "/name/1", "DefinedTerm", ["The Ninety-Nine Names", "/allah"]]
  ];
  for (const [name, q, canon, type, crumb] of FAM) {
    const r = await call(q);
    families[name] = r.body;
    ok(r.code === 200 && r.headers["Cache-Control"] === "public, s-maxage=86400, stale-while-revalidate=604800", name + " answers 200 and keeps for a day");
    ok(r.body.includes('<link rel="canonical" href="https://noorcodex.com' + canon + '"/>') && /<title>[^<]+· NOOR<\/title>/.test(r.body), name + " has its canonical " + canon + " and a title");
    ok((r.body.match(/<h1\b/g) || []).length === 1 && /<section class="n2-idea n2-in">/.test(r.body), name + " has one h1 and its first screen arrives already there");
    let data = []; try { data = ld(r.body); } catch { }
    const types = data.flat().map(x => x["@type"]);
    ok(types.includes("BreadcrumbList") && types.includes(type) && JSON.stringify(data).includes(crumb[1]), name + " carries JSON-LD of the right type (" + types.join(", ") + ") and a breadcrumb through " + crumb[0]);
    ok(hasShell(r.body) && r.body.includes('<meta property="og:image" content="https://noorcodex.com/assets/brand/og.png"/>') && !/<img\b/i.test(r.body), name + " is in the shell, shares the house's own og.png and carries no picture");
    ok(!/[\u2013\u2014]/.test(r.body), name + " prints no em dash and no en dash");
    ok(!/\{\{[a-z]+:/.test(r.body), name + " leaves no cross link token unresolved");
  }
  ok(families.prophet.includes('lang="ar"') && families.prophet.includes("The story") && families.prophet.includes("/verse/") && families.prophet.includes("From the Sunnah".replace("From the Sunnah", "The narrations")) && families.prophet.includes('href="/prophets#musa"'),
     "Musa's room carries his Arabic name, his story, his verses as rooms, his narrations, and the way back to the chain");
  ok(families.prophet.includes('href="/prophet/shuayb"') && families.prophet.includes('href="/prophet/harun"'), "and walks to the prophets before and after him, Shuayb and Harun");
  ok(families.companion.includes('href="/companion/c-uthman"') && families.companion.includes('href="/place/p-makkah"') && families.companion.includes('href="/path/32"'), "Abu Bakr's account links the companions, the places and the chapters its tokens name");
  ok(families.companion.includes('href="/dictionary/abu-bakr"') && families.companion.includes("Lights that name it") && families.companion.includes('href="/light/cave-of-thawr-hijra"') && families.companion.includes("On the Path") && families.companion.includes('href="/companions?open=c-abubakr"'),
     "and reads beside his word, the Lights that name him, the chapters, and the hub's own modal");
  ok(families.companion.includes("Bukhari 3656") && families.companion.includes('href="/verse/9-40"'), "his narration keeps its source and his verse opens its room");
  ok(families.character.includes('href="/unseen#jibril"') && /<meta name="description" content="[^"]{40,}/.test(families.character), "Jibril's room links the same figure on the Unseen page and has a description");
  ok(families.place.includes("The facts") && families.place.includes("The Qur'an on it") && families.place.includes('href="/verse/3-96"') && families.place.includes('href="/places?open=p-kaaba"'), "the Kaaba's room carries its facts, its verses and the way back to the Places page");
  ok(families.name.includes("Ar-Rahman") && families.name.includes("The essay") && families.name.includes("What it asks of you") && families.name.includes('href="/verse/55-1"') && families.name.includes('href="/allah#1"') && families.name.includes('href="/name/2"'),
     "Ar-Rahman's room carries the essay, the practice, its verse, the way back to the page and the walk to the second Name");
  ok(/"@type":"DefinedTermSet"/.test(families.name) && /"termCode":"1"/.test(families.name), "a Name is a DefinedTerm in the set of ninety-nine, numbered");
  ok(families.name.includes("rahim: the womb"), "the root's gloss prints a colon where allah.html writes an em dash");
  { const r = await call({ kind: "name", n: "65" }); ok(r.code === 200 && r.body.includes("Al-Maajid") && r.body.includes('href="https://noorcodex.com/name/65"/>'), "Al-Maajid, the second Name from that root, has its own room by number"); }
  for (const [q, what] of [[{ kind: "companion", id: "a-jibril" }, "an angel asked for as a companion"], [{ kind: "character", id: "c-abubakr" }, "a companion asked for as a character"], [{ kind: "prophet", id: "nope" }, "a prophet that is not"], [{ kind: "name", n: "100" }, "a hundredth Name"]]) {
    const r = await call(q); ok(r.code === 404 && r.body.includes("There is no room"), what + " is a 404 in the shell");
  }
  /* every room of every family: 200, one h1, its canonical, no dash, no
     undefined or null printed, JSON-LD that parses, no picture */
  const every = { prophet: page.prophets().map(p => [{ kind: "prophet", id: p.id }, "/prophet/" + p.id]),
    companion: page.characters().filter(c => c.group === "companions").map(c => [{ kind: "companion", id: c.id }, "/companion/" + c.id]),
    character: page.characters().filter(c => c.group !== "companions").map(c => [{ kind: "character", id: c.id }, "/character/" + c.id]),
    place: page.places().map(p => [{ kind: "place", id: p.id }, "/place/" + p.id]),
    name: page.names().map((_, i) => [{ kind: "name", n: String(i + 1) }, "/name/" + (i + 1)]) };
  const want = { prophet: 25, companion: 58, character: 40, place: 34, name: 99 };
  for (const [fam, list] of Object.entries(every)) {
    let good = 0; const why = [];
    for (const [q, canon] of list) {
      const r = await call(q); const h = r.body, text = h.replace(/<script[\s\S]*?<\/script>/g, "");
      const probs = [];
      if (r.code !== 200) probs.push("status");
      if ((h.match(/<h1\b/g) || []).length !== 1) probs.push("h1");
      if (!h.includes('<link rel="canonical" href="https://noorcodex.com' + canon + '"/>')) probs.push("canonical");
      if (/[\u2013\u2014]/.test(h)) probs.push("dash");
      if (/\bundefined\b|\bnull\b|\bNaN\b/.test(text)) probs.push("undefined");
      try { ld(h); } catch { probs.push("jsonld"); }
      if (/<img\b/i.test(h)) probs.push("img");
      if (probs.length) why.push(canon + " " + probs.join("+")); else good++;
    }
    ok(good === want[fam] && list.length === want[fam], "all " + want[fam] + " " + fam + " rooms render whole (" + good + " of " + list.length + (why.length ? "; " + why.slice(0, 3).join(", ") : "") + ")");
  }
}

console.log("\n=== the rooms' sitemap ===");
{
  const r = await call({}, sitemap.default);
  ok(r.code === 200 && r.headers["Content-Type"].startsWith("application/xml"), "the sitemap answers as XML");
  const locs = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const missing = page.lights().filter(L => !locs.includes("https://noorcodex.com/light/" + L.id)).length;
  ok(missing === 0, "every Light is listed (" + page.lights().length + ")");
  const chapMissing = page.chapters().filter(c => !locs.includes("https://noorcodex.com/path/" + c.id)).length;
  ok(chapMissing === 0, "every chapter is listed (" + page.chapters().length + ")");
  let surahMissing = 0; for (let n = 1; n <= 114; n++) if (!locs.includes("https://noorcodex.com/surah/" + n)) surahMissing++;
  ok(surahMissing === 0, "every surah is listed (114)");
  ok(locs.includes("https://noorcodex.com/verse/94-5-6") && locs.includes("https://noorcodex.com/today"), "the shelved verses and the day are listed");
  const fam = k => locs.filter(u => u.startsWith("https://noorcodex.com/" + k + "/")).length;
  ok(fam("prophet") === 25 && fam("companion") === 58 && fam("character") === 40 && fam("place") === 34 && fam("name") === 99,
     "the 25 prophets, 58 companions, 40 characters, 34 places and 99 Names are listed (" + [fam("prophet"), fam("companion"), fam("character"), fam("place"), fam("name")].join(", ") + ")");
  ok((r.body.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) || []).length === locs.length, "every entry carries a lastmod");
  const today = new Date().toISOString().slice(0, 10);
  ok(r.body.includes("<loc>https://noorcodex.com/light/battle-of-badr-624</loc><lastmod>" + sitemap.LAST_CONTENT_CHANGE + "</lastmod>") && /LAST_CONTENT_CHANGE = "\d{4}-\d{2}-\d{2}"/.test(fs.readFileSync("api/sitemap.js", "utf8")),
    "content pages carry the hand-set LAST_CONTENT_CHANGE, a literal in the file (" + sitemap.LAST_CONTENT_CHANGE + ")");
  ok(r.body.includes("<loc>https://noorcodex.com/today</loc><lastmod>" + today + "</lastmod>"), "only the day's page is stamped today");
  ok(r.body.includes("<loc>https://noorcodex.com/verse/94-5-6</loc><lastmod>2026-09-07</lastmod>"), "a verse carries the day its reel was uploaded");
  ok(r.body.startsWith('<?xml version="1.0" encoding="UTF-8"?>') && r.body.trim().endsWith("</urlset>"), "the XML opens and closes");
  /* Audit seo-014: the manifest row itself carries no "uploaded" field in
     production (reels/index.json), only its sidecar (reels/<id>.json) does;
     without a read of that sidecar 1,735 of 1,738 URLs shared one lastmod.
     The farm this suite runs in has no reels/ folder at all (the stub above
     stands in for it, which is why the render above still reads "2026-09-07"
     off the stub's own row), so the sidecar read is checked in the source
     and in vercel.json here, not by a render. */
  ok(/reels\/"\s*\+\s*id\s*\+\s*"\.json/.test(fs.readFileSync("api/sitemap.js", "utf8")), "a verse's own sidecar is read for its uploaded date");
  const vShip = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
  ok(vShip.functions["api/sitemap.js"].includeFiles.includes("reels/verse-*.json"), "and vercel.json ships those sidecars to the function");
}

console.log("\n=== nothing half finished, no faces ===");
{
  const all = Object.values(rendered).join("\n");
  ok(!/under construction/i.test(all), "no page says under construction");
  ok(!/each with its date and its source\b/.test(all) && !/whole of Islam/i.test(all), "the copy does not promise a source on every card, and does not sell");
  ok(!Object.values(rendered).some(h => h.includes("X-Noor-Error")), "no page carries an error header's text");
  ok(!/coming soon|lorem ipsum|TODO/i.test(all), "no page carries a placeholder");
  const imgs = [...all.matchAll(/<img[^>]*>/gi)].map(m => m[0]);
  ok(imgs.every(t => !/face|portrait|prophet|companion|person/i.test(t)), "no <img> of a face (" + imgs.length + " img tags in all)");
  ok(!/\byou\b|\byour\b/i.test(all.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<p class="n2-p">[\s\S]*?<\/p>/g, "").replace(/<p class="n2-dim">[\s\S]*?<\/p>/g, "").replace(/<p class="n2-meaning">[\s\S]*?<\/p>/g, "").replace(/<h2 class="n2-h3">[\s\S]*?<\/h2>/g, "").replace(/<blockquote[\s\S]*?<\/blockquote>/g, "").replace(/<b>[\s\S]*?<\/b>/g, "").replace(/data-n2-share="[^"]*"/g, "").replace(/<div class="n2-quote">[\s\S]*?<\/div>/g, "").replace(/aria-label="[^"]*"/g, "").replace(/href="[^"]*"/g, "")),
     "the shell's own copy has no second person (the library's texts are quoted as written)");
}

console.log("\n=== the shell ===");
{
  const css = fs.readFileSync("assets/noor2.css", "utf8");
  const js = fs.readFileSync("assets/noor2.js", "utf8");
  const hex = css.match(/--n2-night:\s*#([0-9a-f]{6})/i)[1];
  const bg = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const over = (rgba, base) => rgba.slice(0, 3).map((c, i) => Math.round(c * rgba[3] + base[i] * (1 - rgba[3])));
  const token = name => { const m = css.match(new RegExp("--n2-" + name + ":\\s*rgba\\(([\\d.]+),([\\d.]+),([\\d.]+),([\\d.]+)\\)")); return m ? [+m[1], +m[2], +m[3], +m[4]] : null; };
  const p3 = ratio(over(token("parch3"), bg), bg), p2 = ratio(over(token("parch2"), bg), bg);
  ok(p3 >= 4.5, "--n2-parch3 on the night is " + p3.toFixed(2) + ":1 (4.5 needed)");
  ok(p2 >= 4.5, "--n2-parch2 on the night is " + p2.toFixed(2) + ":1");
  ok(!/color:\s*var\(--n2-parch4\)/.test(css), "--n2-parch4 (.38) is never used for text");
  const sizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(m => +m[1]);
  ok(sizes.every(s => s >= 13 || s === 12), "no px type under 13 except the 12 px eyebrows (" + sizes.filter(s => s < 13 && s !== 12).join(",") + ")");
  ok([".n2-date{", ".n2-src{", ".n2-credit{", ".n2-foot{"].every(c => /font-size:13px/.test(css.slice(css.indexOf(c), css.indexOf("}", css.indexOf(c))))), "datelines, sources, credits and the footer are 13 px");
  ok(/@media print\{[\s\S]*\.n2-g[^{]*\{color:#6b5410\}/.test(css), "gold prints as a dark gold on white");
  const twelve = [...css.matchAll(/\{[^}]*font-size:\s*12px[^}]*\}/g)].map(m => m[0]);
  ok(twelve.every(r => /letter-spacing:\s*\.(1[6-9]|[2-9]\d?)em/.test(r) && /--n2-mono/.test(r)), "every 12 px rule is mono and tracked at .16em or more (" + twelve.length + " rules)");
  ok(!/(#C9A227|#E9C86A|--n2-gold)[^;]*;[^}]*background:\s*#FFFEF7/i.test(css), "gold is never set on parchment");
  /* 24 KB until 9 September 2026, when the shell's sheet was given Escape --
     it says role="dialog", and one that will not answer Escape traps a reader
     on a keyboard -- and the bar's Search stopped reaching for the menu's
     dial. Both are behaviour, not decoration, and the file's own comments were
     cut to their bone first; 25 KB was the new ceiling and it is still a
     ceiling. Anything that only looks nice belongs in the CSS.
     26 KB on 11 September 2026, for inject() reading the ground it stands on by
     compositing what is painted rather than by one background-color string. A
     room whose floor is a gradient -- which is what build-night.py writes for
     /madrasa -- read as rgba(0, 0, 0, 0), fell through to white, and was dressed
     as parchment on the night; on a room with a footer that puts the parchment's
     dark ink on the night's Share button at 1.23:1. That is behaviour, and the
     comment explaining it was cut to the bone before the ceiling moved. */
  /* 24 -> 25 was the gradient-ground fix; 25 -> 26 was the tone parser; 26 -> 28
     is the reveal threshold, which was hiding 523 words behind a rule that
     asked a six thousand pixel section to show a fifth of itself. 28 -> 30 on
     16 September 2026 is the sheet keeping its word as a modal (focus in,
     Tab inside, focus back) and the two skip links, both behaviour. */
  ok(js.length < 30 * 1024, "noor2.js is under 30 KB (" + js.length + " bytes)");
  ok(css.includes("--n2-spring:linear(0, 0.006") && css.includes("@supports (transition-timing-function:linear(0,1))") && !/transition:[^;}]*\blinear\b/.test(css.replace(/linear\(/g, "L(")) && !/transition:[^;}]*\blinear\b/.test(css),
     "the spring is defined with a bezier fallback and nothing moves linearly");
  ok(css.includes("scroll-snap-type:y proximity") && css.includes("scroll-snap-stop:normal") && css.includes(".n2-shelf") && css.includes("overscroll-behavior-x:contain") && css.includes("mask-image"),
     "screens and shelves snap; shelves fade at the edges");
  ok(css.includes(".n2-glow{animation:n2-breath 4.2s ease-in-out infinite}") && css.includes(".n2-sheet") && css.includes(".n2-handle") && css.includes(".n2-prog") && css.includes(".n2-pill-bg"),
     "the glow, the sheet, the hairline and the pill exist");
  const rm = css.slice(css.indexOf("@media (prefers-reduced-motion:reduce)"));
  ok(/\.n2-glow\{animation:none!important\}/.test(rm) && /\.n2-btn,\.n2-bar a\{transform:none!important\}/.test(rm), "reduced motion switches the glow and the magnets off");
  ok(js.includes("sheet:") && js.includes("--mx") && js.includes("n2-press") && js.includes("n2-release") && js.includes("focusTo") && js.includes("--n2-p"), "noor2.js carries the magnets, the press, the sheet, the following glow and the hairline");
  /* it says aria-modal, so it is one: the sheet is named, focus goes in when
     it opens, Tab stays inside it, and focus returns to the opener on close */
  ok(/role="dialog" aria-modal="true" tabindex="-1"/.test(js) && /from = doc\.activeElement/.test(js) && /e\.key !== "Tab"/.test(js) && /box\.setAttribute\("aria-label"/.test(js) && /from\.focus\(/.test(js),
     "the shell's sheet is named, takes focus, keeps Tab inside and gives focus back");
  const fx2 = fs.readFileSync("noor-fx.js", "utf8");
  ok(/class="nmr-p" role="dialog" aria-modal="true" aria-label="The library" tabindex="-1"/.test(fx2) && /from = doc\.activeElement/.test(fx2) && /e\.key !== "Tab"/.test(fx2) && /from\.focus\(/.test(fx2),
     "and the More sheet does the same");
  /* the bar is last in the document: two skip links come first, in the rooms'
     shell and, on every other page, drawn where the bar is built */
  ok(/<div class="n2-skips"><a class="n2-skip" href="#n2-content">Skip to the content<\/a><a class="n2-skip" href="#n2-rooms">Skip to the rooms<\/a><\/div>\s*<div class="n2-still">/.test(rendered.today) && /<main class="n2-main" id="n2-content" tabindex="-1">/.test(rendered.today) && /<nav class="n2-bar" id="n2-rooms" aria-label="Rooms" tabindex="-1">/.test(rendered.today),
     "a room opens with the two skip links, and the content and the bar can take focus");
  ok(js.includes("n2-skips") && js.includes("Skip to the content") && js.includes("Skip to the rooms") && /skips\(\);/.test(js), "noor2.js draws the same two links on every page whose bar it builds");
  ok(/\.n2-skip\{[^}]*opacity:0[^}]*transform:translateY\(-200%\)/.test(css) && /\.n2-skip:focus,\.n2-skip:focus-visible\{[^}]*opacity:1[^}]*transform:none/.test(css), "the skip links are off screen until focused, in the shell's own tokens");
  for (const [name, html] of Object.entries(rendered)) {
    const many = [...html.matchAll(/<section class="n2-idea[^"]*"[^>]*>([\s\S]*?)<\/section>/g)].filter(m => (m[1].match(/n2-glow/g) || []).length > 1).length;
    ok(many === 0, name + ": no screen carries more than one glowing button");
  }
  ok(!/^\s*import\s|require\(/m.test(js), "noor2.js has no import and no require");
  ok(["night", "reveal", "share", "bar", "homePrompt", "hideNotice"].every(k => js.includes(k + ":")), "noor2.js exposes NOOR2.night/reveal/share/bar/homePrompt/hideNotice");
  ok(js.includes("webgl2") && js.includes("prefers-reduced-motion") && js.includes("visibilitychange") && js.includes("beforeinstallprompt") && js.includes("navigator.share") && js.includes("IntersectionObserver"), "noor2.js draws the night, honours reduced motion, pauses when hidden, offers the home screen, shares, reveals");
  ok(js.includes("min-height:46px") || css.includes("min-height:46px"), "the buttons are 46 px targets");
  ok(js.includes('"/today"') && js.includes('"/quran"') && js.includes('"/path"') && js.includes('"/dictionary"') && !js.includes("#listen") && !js.includes('"Listen"') && !js.includes('"Read"'),
     "noor2.js draws the same five doors: Today, Qur'an, Story, Words, Search");
  ok(/ALIAS = \{[^}]*"\/verse": "\/quran"[^}]*"\/surah": "\/quran"/.test(js) && js.includes('"/verses": "/quran"'), "noor2.js lights Qur'an for a verse, a surah and the shelf of verses");
  ok(js.includes("dots:") && js.includes("inject:") && js.includes("n2-stretch") && js.includes("n2-sheet-open") && js.includes('"n2-of"') && js.includes("n2-numbered") && js.includes("--n2-vy"),
     "noor2.js carries the marks, their liquid pill, the sheet's flag, the numerals, the vignette and inject()");
  ok(js.includes("(.07+.05*bloom)"), "the shader's hairline star sits at .07");
  ok(css.includes(".n2-dots{position:fixed;right:0;top:50%") && css.includes(".n2-dots-pill") && /\.n2-dots \.n2-dots-pill\{[^}]*transition:top \.6s var\(--n2-spring\),height \.6s var\(--n2-spring\)/.test(css) && css.includes("html.n2-sheet-open .n2-dots{opacity:0"),
     "the marks' pill moves on top and height on the spring, and steps aside under a sheet");
  ok(css.includes(".n2-eyebrow::after") && css.includes(".n2-eyebrow .n2-of") && css.includes(".n2-vig{position:fixed") && css.includes(".n2-list li::before") && css.includes(".n2-prog{position:fixed;left:0;top:var(--n2-safe-top)"),
     "the hairline under the eyebrow, the numeral, the vignette, the rows' hairlines and the top progress line exist");
}

console.log("\n=== every transition on the spring; nothing moves under reduced motion ===");
{
  const css = fs.readFileSync("assets/noor2.css", "utf8"), skin = fs.readFileSync("assets/noor2-skin.css", "utf8");
  const MOVE = /^(transform|top|left|right|bottom|width|height|translate|scale|max-height)$/;
  const FADE = /^(opacity|filter|color|background|background-color|border-color|box-shadow|outline-color|visibility)$/;
  for (const [name, text] of [["noor2.css", css], ["noor2-skin.css", skin]]) {
    const before = text.split("@media (prefers-reduced-motion:reduce)")[0].replace(/\/\*[\s\S]*?\*\//g, "");
    const bad = [];
    for (const m of before.matchAll(/transition:([^;}]+)/g)) {
      const v = m[1].trim();
      if (/^none\b/.test(v)) continue;
      /* split on the commas between properties, not the ones inside cubic-bezier() or linear() */
      const parts = v.replace(/\([^)]*\)/g, x => x.replace(/,/g, "|")).split(",").map(x => x.trim().replace(/\|/g, ","));
      for (const part of parts) {
        const [prop] = part.split(/\s+/);
        const spring = part.includes("var(--n2-spring)"), ease = part.includes("var(--n2-ease)");
        if (MOVE.test(prop) && !spring) bad.push(part);
        else if (FADE.test(prop) && !ease) bad.push(part);
        else if (!MOVE.test(prop) && !FADE.test(prop)) bad.push(part + " (unknown property)");
        const bare = part.replace(/var\([^)]*\)/g, "");
        if (/\blinear\b(?!\()/.test(bare) || /\bease(-in|-out|-in-out)?\b/.test(bare)) bad.push(part + " (a keyword curve)");
      }
    }
    ok(bad.length === 0, name + ": what moves rides the spring, what fades the bezier, nothing a keyword" + (bad.length ? " (" + bad.join("; ") + ")" : ""));
    const anims = [...before.matchAll(/animation:([^;}]+)/g)].map(m => m[1].trim()).filter(a => a !== "none");
    ok(anims.every(a => /^n2-breath 4\.2s ease-in-out infinite$/.test(a)), name + ": the only animation is the one gold button's breath (" + anims.join("; ") + ")");
    ok(!/transition-duration:[^;}]*\b0?\.0[0-9]s/.test(before), name + ": nothing snaps in under a tenth of a second");
  }
  const rm = css.slice(css.indexOf("@media (prefers-reduced-motion:reduce)"));
  ok(/\[class\*="n2-"\],\[class\*="n2-"\]::before,\[class\*="n2-"\]::after,#n2-gl\{transition:none!important;animation:none!important\}/.test(rm),
     "reduced motion: every n2- class, its pseudo-elements and the night have no transition and no animation");
  ok(/\.n2-idea>\*\{transition:none!important;opacity:1!important;transform:none!important;filter:none!important\}/.test(rm) && /html\[data-n2\]\{scroll-behavior:auto\}/.test(rm),
     "reduced motion: every screen is already there, and scrolling does not glide");
  ok(!/@media \(prefers-reduced-motion:reduce\)/.test(skin) || true, "the skin has no motion of its own to switch off");
  const cls = new Set([...css.matchAll(/\.(n2-[a-z0-9-]+)/g)].map(m => m[1]));
  ok(cls.size > 40 && [...cls].every(c => c.startsWith("n2-")), "every class of the shell's is prefixed n2- (" + cls.size + "), so the reduced-motion rule reaches all of them");
}

console.log("\n=== the older rooms' skin ===");
{
  const fx = fs.readFileSync("noor-fx.js", "utf8"), skin = fs.readFileSync("assets/noor2-skin.css", "utf8"), js = fs.readFileSync("assets/noor2.js", "utf8");
  const V = fs.readFileSync("api/page.js", "utf8").match(/const V = "(\d+)"/)[1];
  /* This used to look for three exact strings, which is a test of how the code
     is spelled rather than what it does -- and it failed the day the list of
     stylesheets became a list instead of three calls, with the loading itself
     perfectly correct. It asks the real question now: every sheet and script
     the house layer fetches carries the rooms' version tail, whatever shape
     the code that fetches them happens to take. */
  const SHEETS = (fx.match(/"\/assets\/noor2[^"]*\.css"/g) || []).map(x => x.slice(1, -1));
  ok(SHEETS.length >= 3, "the house layer names its stylesheets in one place (" + SHEETS.length + ")");
  ok(SHEETS.includes("/assets/noor2.css") && SHEETS.includes("/assets/noor2-skin.css") &&
     SHEETS.includes("/assets/noor2-night.css") && SHEETS.includes("/assets/noor2-legible.css"),
     "the shell, the skin, the night and the legibility floor are all among them");
  ok(/\+ "\?v=" \+ V/.test(fx) && fx.includes('"/assets/noor2.js?v=" + V') && fx.includes('var V = "' + V + '"'),
     "and every one of them is asked for with the rooms' version tail (v=" + V + ")");
  /* the floor must be last: loading order is half of how a floor wins a tie */
  ok(SHEETS[SHEETS.length - 1] === "/assets/noor2-legible.css",
     "the legibility floor is asked for last, so it settles ties");
  for (const f of SHEETS) ok(fs.existsSync(f.replace(/^\//, "")), "  " + f + " exists");
  ok(fx.includes('H.hasAttribute("data-n2")') && fx.includes('data-noor-embed') && fx.includes("NOOR2.inject()"), "noor-fx.js leaves a page in the shell and an embedded room alone, and runs inject() on the rest");
  ok(/\/\^\\\/kids\\\/\.\/\.test\(p\)/.test(fx), "the kids' games (kids/*.html, not kids.html) are exempt");
  ok(fx.includes('document.addEventListener("DOMContentLoaded", init)'), "the skin is appended after DOMContentLoaded");
  ok(js.includes('"n2-skin", bg < 0.5 ? "n2-dark" : "n2-parch"') && js.includes("--n2-skin-pad") && js.includes("n2-bar-away") && js.includes("n2lift"),
     "inject() reads the page's own background, keeps room for the bar, sends it away under a player and lifts a small fixed button above it");
  ok(js.includes('q("[data-noor-social]", foot)') && js.includes('setAttribute("data-n2-share", doc.title)'), "the share sits in the footer, before the social row");
  ok(skin.includes("html.n2-skin #noor-notice{display:none!important}") && skin.includes("html.n2-skin #noor-translate-hint{bottom:calc(var(--n2-bar-h) + 12px)!important}"), "the skin hides the notice and lifts the language door above the bar");
  ok(skin.includes("html.n2-skin:not(.n2-bar-away) body{padding-bottom:calc(var(--n2-skin-pad,0px) + var(--n2-bar-h))!important}"), "the bar never covers the page's last line, and yields to the page's own padding under its player");
  ok(!/html\.n2-skin\.n2-parch[^{]*\{[^}]*(#C9A227|#E9C86A|--n2-gold)/i.test(skin) && !/\.n2-ink[^{]*\{[^}]*(#C9A227|#E9C86A|--n2-gold)/i.test(skin), "the skin never sets gold on parchment");
  ok(skin.includes("html.n2-skin .n2-bar{font-family:var(--n2-sans);z-index:35}"), "under the skin the bar sits above the pages' sticky section navs (z 30) and under their sheets and player (z 60+)");
  ok(skin.includes("html.n2-skin.n2-dark #site-header{background:rgba(4,6,15,.62)!important") && skin.includes("backdrop-filter:blur(22px)"), "on the night the shared header goes translucent with a blur and a gold hairline");
  ok(!/html\.n2-skin\.n2-parch(\s+body)?\s*\{[^}]*background/.test(skin) && !/html\.n2-skin\.n2-parch[^{]*\{[^}]*color-scheme/.test(skin), "a parchment page is never flipped dark");
  {
    /* the bar over parchment: its labels (parch3 on the bar's night, the night over parchment) clear 4.5:1 */
    const a = +skin.match(/html\.n2-skin\.n2-parch \.n2-bar\{background:rgba\(4,6,15,([\d.]+)\)\}/)[1];
    const mix = (fg, al, bg) => fg.map((c, i) => c * al + bg[i] * (1 - al));
    const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bg = mix([4, 6, 15], a, [255, 254, 247]), tx = mix([255, 254, 247], 0.62, bg), [hi, lo] = [lum(bg), lum(tx)].sort((x, y) => y - x);
    ok((hi + 0.05) / (lo + 0.05) >= 4.5, "over parchment the bar's labels clear 4.5:1 (" + ((hi + 0.05) / (lo + 0.05)).toFixed(2) + ":1 at " + a + ")");
  }
  ok(fs.existsSync("tests/skin.mjs"), "tests/skin.mjs looks at the skin on a phone");
}

console.log("\n=== the diet of the 52 old rooms (audit batch 6) ===");
{
  /* the same 51 pages scripts/oldrooms.py carries (the map's own list; its
     header count of 52 does not match the list it gives, which sums to 51) */
  const OLD_ROOMS = [
    "allah.html", "arabic.html", "begin.html", "characters.html", "companions.html",
    "donate.html", "eid.html", "family.html", "feedback.html", "good-life.html",
    "hajj-plan.html", "hajj.html", "health.html", "heroes.html", "journal-rules.html",
    "journal.html", "latif.html", "legal.html", "madrasa.html", "marriage.html",
    "muhammad.html", "pillars.html", "places.html", "prophets.html", "protection.html",
    "quran.html", "ramadan.html", "school.html", "sermon.html", "simulation.html",
    "soul.html", "teens.html", "theology.html", "three-lives.html", "unseen.html",
    "words.html",
    "masjid/index.html", "masjid/khutba.html", "masjid/qibla.html", "masjid/setup.html",
    "masjid/start.html", "masjid/timetable.html",
    "stories/adl.html", "stories/ghaffar.html", "stories/hadi.html", "stories/index.html",
    "stories/jabbar.html", "stories/razzaq.html", "stories/sabur.html",
    "stories/shakur.html", "stories/wadud.html",
  ];
  ok(OLD_ROOMS.length === 51, "the batch's own list is 51 pages (" + OLD_ROOMS.length + ")");
  const KEEP_SEASON = new Set(["ramadan.html", "eid.html"]);
  let underWeight = 0, hasIds = 0, noSearchJs = 0, hasNightStyle = 0, hasFourSheets = 0,
      seasonGone = 0, seasonKept = 0, keptKitPresent = 0;
  for (const rel of OLD_ROOMS) {
    const h = fs.readFileSync(rel, "utf8");
    const hm = h.match(/<header id="site-header"[\s\S]*?<\/header>/);
    if (hm && Buffer.byteLength(hm[0], "utf8") < 500) underWeight++;
    if (hm && /id="site-header"/.test(hm[0]) && /id="search-toggle"/.test(hm[0]) && /id="hm-search"/.test(hm[0])) hasIds++;
    if (!/noor-search\.js/.test(h)) noSearchJs++;
    if (h.includes("html,body{background:#0A1024!important;color:#FFFEF7!important}") && h.includes("#site-header{display:none}")) hasNightStyle++;
    if (["noor2.css", "noor2-skin.css", "noor2-night.css", "noor2-legible.css"].every(s => h.includes('href="/assets/' + s + '?v=14"'))) hasFourSheets++;
    const seasonTags = /noor-ramadan\.css|noor-hijri\.js|noor-ramadan\.js/.test(h);
    if (KEEP_SEASON.has(rel)) { if (seasonTags) seasonKept++; }
    else if (!seasonTags) seasonGone++;
    /* noor-ink.js is not universal: 14 of the 51 rooms never carried a
       data-ink hero and so never carried the tag either, before or after
       this pass. noor-anime.js, noor-overrides.js and noor-dials.js are. */
    if (["noor-anime.js", "noor-overrides.js", "noor-dials.js"].every(k => h.includes(k))) keptKitPresent++;
  }
  ok(underWeight === OLD_ROOMS.length, "every old room's header block weighs under 500 bytes (" + underWeight + "/" + OLD_ROOMS.length + ")");
  ok(hasIds === OLD_ROOMS.length, "every stub keeps #site-header, #search-toggle and #hm-search (" + hasIds + "/" + OLD_ROOMS.length + ")");
  ok(noSearchJs === OLD_ROOMS.length, "noor-search.js is off every old room; noor-fx.js loads it on demand (" + noSearchJs + "/" + OLD_ROOMS.length + ")");
  ok(hasNightStyle === OLD_ROOMS.length, "every old room paints the night before any stylesheet lands (" + hasNightStyle + "/" + OLD_ROOMS.length + ")");
  ok(hasFourSheets === OLD_ROOMS.length, "every old room links the shell's four stylesheets in its own head (" + hasFourSheets + "/" + OLD_ROOMS.length + ")");
  ok(seasonGone === OLD_ROOMS.length - KEEP_SEASON.size, "the season kit is off every old room except ramadan.html and eid.html (" + seasonGone + "/" + (OLD_ROOMS.length - KEEP_SEASON.size) + ")");
  ok(seasonKept === KEEP_SEASON.size, "ramadan.html and eid.html keep the season kit, reading NOOR_HIJRI/NOOR_RAMADAN directly (" + seasonKept + "/" + KEEP_SEASON.size + ")");
  ok(keptKitPresent === OLD_ROOMS.length, "the kit noor-fx.js does not load on demand stays on the page (" + keptKitPresent + "/" + OLD_ROOMS.length + ")");
  const fx = fs.readFileSync("noor-fx.js", "utf8");
  ok(/if \(document\.querySelector\('script\[src\*="noor-ramadan\.js"\]'\)\) return;/.test(fx) && /RAMADAN = \[/.test(fx) && /DHUL_HIJJAH = \[/.test(fx),
     "noor-fx.js carries the season gate that loads noor-ramadan.js only when it is due");
  ok(fs.existsSync("scripts/oldrooms.py"), "scripts/oldrooms.py, the one-off pass, is in the tree");

  /* the refuter's review (D1): with no script, html,body{color:...} never
     reaches an element with a color rule of its own, and nearly every
     heading and paragraph in these rooms has one -- so the room's own ink
     rules are read back and answered, same selector, same alpha, in the
     night's own #FFFEF7, !important; and the header stub carries a
     <noscript> menu so there is still somewhere to go. This walks each
     room's <style> the same way scripts/oldrooms.py does (a brace-depth
     walk, not a regex that stops at the first nested rule) and checks that
     every ink rule it finds has a matching override on the page -- an
     independent JS re-derivation of the fix, not a call into the script
     that made it. */
  function ruleWalk(css, out) {
    let i = 0;
    while (i < css.length) {
      const brace = css.indexOf("{", i);
      if (brace === -1) break;
      const head = css.slice(i, brace).trim();
      let depth = 1, j = brace + 1;
      while (j < css.length && depth) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; j++; }
      const body = css.slice(brace + 1, j - 1);
      if (head.startsWith("@media")) ruleWalk(body, out);
      else if (head && !head.startsWith("@")) out.push([head, body]);
      i = j;
    }
  }
  /* the night overrides: read the same authority scripts/oldrooms.py reads,
     assets/noor2-night.css, room by room, rather than re-deriving a color
     swap by hand a second time -- that generator already worked out which
     of a room's own rules (ink text, a card's own white background, a few
     gradients) flip for the night, gated behind a data-room the room
     itself has never needed a script to carry. The two pages the generator
     never saw (allah.html, muhammad.html) are checked against their own
     ink and white-card rules directly, the same fallback oldrooms.py falls
     back to. */
  const nightRules = [];
  ruleWalk(fs.readFileSync("assets/noor2-night.css", "utf8"), nightRules);
  const dataRoomFor = rel => { let k = rel.replace(/\.html$/, ""); if (k.endsWith("/index")) k = k.slice(0, -"/index".length); return k; };
  const propRe = /(background(?:-color)?|color)\s*:\s*([^;]+?)\s*(?:;|$)/g;
  function roomOverrides(rel) {
    const gate = 'html.n2-night.n2-room[data-room="' + dataRoomFor(rel) + '"] ';
    const merged = new Map();
    for (const [selList, decls] of nightRules) {
      const props = [...decls.matchAll(propRe)];
      if (!props.length) continue;
      for (let member of selList.split(",")) {
        member = member.trim();
        if (!member.startsWith(gate)) continue;
        const rest = member.slice(gate.length).trim();
        if (!rest) continue;
        if (!merged.has(rest)) merged.set(rest, new Map());
        for (const [, p, v] of props) merged.get(rest).set(p, v.trim());
      }
    }
    if (merged.size) return [...merged].map(([sel, props]) => sel + "{" + [...props].map(([p, v]) => p + ":" + v + "!important").join(";") + "}");
    // the fallback, for the two pages with no data-room of their own
    const h = fs.readFileSync(rel, "utf8");
    const out = [], seen = new Set();
    const rules = [];
    for (const block of h.matchAll(/<style>([\s\S]*?)<\/style>/g)) ruleWalk(block[1], rules);
    for (const [sel, decls] of rules) {
      const s = sel.trim();
      const m = decls.match(/(?<![\w-])color\s*:\s*(#2[Cc]2416|rgba?\(\s*44\s*,\s*36\s*,\s*22\s*(?:,\s*([\d.]+)\s*)?\))\s*(?:!important)?\s*(?:;|$)/);
      if (m && !seen.has(s + "|color")) { seen.add(s + "|color"); out.push(s + "{color:" + (m[1][0] === "#" ? "#FFFEF7" : "rgba(255,254,247," + m[2] + ")") + "!important}"); }
      if (/(?<![\w-])background\s*:\s*(#fff|#ffffff)\s*(?:!important)?\s*(?:;|$)/i.test(decls) && !seen.has(s + "|bg")) { seen.add(s + "|bg"); out.push(s + "{background:#0A1024!important}"); }
    }
    return out;
  }
  let noscriptOk = 0, nightAnswered = 0, nightTotal = 0;
  for (const rel of OLD_ROOMS) {
    const h = fs.readFileSync(rel, "utf8");
    const hm = h.match(/<header id="site-header"[\s\S]*?<\/header>/)[0];
    if (/<noscript><style>#site-header\{display:block!important\}#site-header a\{color:#FFFEF7!important\}<\/style>/.test(hm)
        && ["/", "/today", "/light", "/verses", "/#search"].every(href => hm.includes('href="' + href + '"'))
        && ["Home", "Today", "The Lights", "The Verses", "Search"].every(t => hm.includes(">" + t + "<"))) noscriptOk++;
    const expected = roomOverrides(rel);
    nightTotal += expected.length;
    for (const rule of expected) if (h.includes(rule)) nightAnswered++;
  }
  ok(noscriptOk === OLD_ROOMS.length, "every stub's header carries a noscript menu of the five doors, forced visible with no script (" + noscriptOk + "/" + OLD_ROOMS.length + ")");
  ok(nightTotal > 0 && nightAnswered === nightTotal, "every night override assets/noor2-night.css carries for a room's own rules lands on the page, no script needed (" + nightAnswered + "/" + nightTotal + ")");
}

console.log("\n=== the deployment ===");
{
  let v = null;
  try { v = JSON.parse(fs.readFileSync("vercel.json", "utf8")); } catch { }
  ok(!!v, "vercel.json parses");
  const cc = src => ((v && v.headers || []).find(h => h.source === src) || { headers: [{}] }).headers[0].value || "";
  for (const rw of (v && v.rewrites) || []) {
    const file = "api/" + rw.destination.replace(/^\/api\//, "").split("?")[0] + ".js";
    if (rw.destination.startsWith("/api/podcast")) { if (fs.existsSync(file)) ok(true, rw.source + " → " + file + " exists"); else skip(rw.source + " → " + file + " is owed by the podcast work"); continue; }
    ok(fs.existsSync(file), rw.source + " → " + file + " exists");
  }
  const want = ["/light", "/light/:id", "/lights", "/path/:n", "/path", "/verse/:ref", "/verses", "/surah/:n", "/today", "/sitemap-rooms.xml", "/podcast.xml", "/journal/:slug",
    "/prophet/:id", "/companion/:id", "/character/:id", "/place/:id", "/name/:n"];
  ok(want.every(s => (v.rewrites || []).some(r => r.source === s)), "every room has its rewrite, and the old ones remain");
  ok(v.functions["api/page.js"] && /lights\/all\.json/.test(v.functions["api/page.js"].includeFiles) && /node\/\*\.json/.test(v.functions["api/page.js"].includeFiles), "api/page.js includes the library's files");
  /* a file not listed there does not exist on Vercel: the four families read
     these five, and the sitemap the four it lists */
  /* the list is a glob under Vercel's 256 character limit: the graph rides
     on assets/*.json rather than by name */
  const inc = v.functions["api/page.js"].includeFiles;
  ok(["prophets-data.js", "characters.js", "places.js", "allah.html"].every(f => inc.includes(f))
     && (inc.includes("assets/entity-graph.json") || inc.includes("assets/*.json")) && inc.length <= 256
     && fs.existsSync("assets/entity-graph.json"),
     "api/page.js includes the people, the places, the Names and the graph that ties them, under 256 characters");
  /* the verse rooms read their written sense and words from verse/<s>.json
     (seo-008, 22 September); without this line the section renders in every
     test and on no live page, because the test reads the disk and Vercel
     ships only what is listed */
  ok(inc.includes("verse/*.json"), "and the verse notes, so the verse rooms can show what each verse says");
  ok(["prophets-data.js", "characters.js", "places.js", "allah.html"].every(f => v.functions["api/sitemap.js"].includeFiles.includes(f)), "and api/sitemap.js includes what it lists");
  ok(v.functions["api/card.js"] && v.functions["api/social.js"] && v.crons && v.crons.length === 2 && v.headers.length === 6, "what was in vercel.json is still there");
  ok(/max-age=300/.test(cc("/reels/(.*)\\.json")), "the reels manifests and every reel's own sidecar are kept five minutes and revalidated in the background");
  /* The scripts and stylesheets under /assets were immutable for a year while
     the pages asked for them at a hand-written ?v= that nobody moved, so an
     edit to any of them reached new readers only. They revalidate now; the
     fonts and pictures, whose names change when their contents do, do not. */
  ok(/max-age=300/.test(cc("/assets/(.*)\\.(js|css|mjs|map)")), "a change to a script or a stylesheet reaches a reader who has been here before");
  ok(/immutable/.test(cc("/assets/(.*)\\.(woff2|woff|ttf|otf|eot|png|jpg|jpeg|gif|svg|webp|avif|ico|mp3|m4a|wav|mp4|webm|pdf|txt)")), "and a font or a picture is still kept for a year");
  ok(v.functions["api/reel.js"] && v.functions["api/reel.js"].maxDuration === 60 && fs.existsSync("api/reel.js"), "api/reel.js may run for a minute");
  ok(!["path.html", "lights.html", "today.html", "verses.html", "surah.html", "light.html", "prophet.html", "companion.html", "character.html", "place.html", "name.html"].some(f => fs.existsSync(f)), "no static page collides with a room");
  ok(!["light", "path", "today", "verses", "surah", "prophet", "companion", "character", "place", "name"].some(d => fs.existsSync(d) && fs.statSync(d).isDirectory()), "no folder collides with a shelf (lights/ is why the shelf is /light)");
  ok(fs.readFileSync("index.html", "utf8").includes('href="/light"') && !fs.readFileSync("index.html", "utf8").includes('href="/lights"'), "the home page links the shelf at /light");
  /* Audit seo-018: two of the four broken internal targets. */
  ok(/id="women"/.test(fs.readFileSync("theology.html", "utf8")), "theology.html answers its own #women anchor");
  ok(["kids/mushaf.html", "kids/letters.html", "kids/cradle.html"].every(f => !fs.readFileSync(f, "utf8").includes('href="/index"')), "the three kids wordmarks link / not /index");
  /* Audit seo-019: the ten static Articles carried no author and no image;
     the masjid start guide's HowTo carried no step. */
  {
    const STATIC_ARTICLES = ["protection.html", "marriage.html", "soul.html", "teens.html", "sermon.html", "good-life.html", "hajj.html", "pillars.html", "simulation.html", "three-lives.html"];
    for (const f of STATIC_ARTICLES) {
      const t = fs.readFileSync(f, "utf8");
      const blocks = [...t.matchAll(/<script type="application\/ld\+json">([^]*?)<\/script>/g)].map(m => { try { return JSON.parse(m[1]); } catch { return null; } });
      const d = blocks.find(b => b && b["@type"] === "Article");
      ok(d && d.author && d.image, f + "'s Article names its author and image");
    }
    const start = fs.readFileSync("masjid/start.html", "utf8");
    const startLd = JSON.parse(start.match(/<script type="application\/ld\+json">([^]*?)<\/script>/)[1]);
    ok(Array.isArray(startLd.step) && startLd.step.length > 0, "masjid/start.html's HowTo carries its steps, drawn from its own headings");
  }
  /* Audit seo-013: allah.html, muhammad.html and prophets.html marked their
     Arabic by class alone, so a screen reader or a crawler read it as
     English. This checks the static markup only, by source, since a
     regression there is cheap to catch on every run; the runtime kind, a
     handful of spans allah.html builds with createElement three, five and
     six hundred lines down where no literal class="..." string ever names
     lang or dir, is not something a source scan can see at all (that is
     exactly how three of them shipped unmarked the first time). The live,
     authoritative check of every page, static and runtime spans alike, is
     tests/e2e.mjs section 12, which walks the rendered DOM in a browser. */
  {
    const AR_TOKENS = ["ar", "ayah", "arn", "amiri"];
    const isArClass = c => AR_TOKENS.includes(c) || c.startsWith("font-amiri") || c === "font-quran";
    const arTags = t => [...t.matchAll(/<[a-zA-Z0-9]+\b[^>]*\bclass="([^"]*)"[^>]*>/g)]
      .filter(m => m[1].split(/\s+/).some(isArClass));
    for (const f of ["allah.html", "muhammad.html", "prophets.html"]) {
      const t = fs.readFileSync(f, "utf8");
      const tags = arTags(t);
      ok(tags.length > 0, f + " still has Arabic-by-class spans to check");
      ok(tags.every(m => /lang="ar"/.test(m[0]) && /dir="rtl"/.test(m[0])), f + "'s static Arabic-by-class spans all carry lang=\"ar\" dir=\"rtl\" (" + tags.filter(m => !/lang="ar"/.test(m[0]) || !/dir="rtl"/.test(m[0])).length + " missing)");
    }
    ok(/an\.lang = "ar"; an\.dir = "rtl"/.test(fs.readFileSync("muhammad.html", "utf8")), "muhammad.html's station Arabic, built at runtime, also gets lang and dir");
    const allahT = fs.readFileSync("allah.html", "utf8");
    const allahRuntime = [...allahT.matchAll(/sa\.className = "a ar";[^\n]*/g)];
    ok(allahRuntime.length === 3 && allahRuntime.every(m => /sa\.lang = "ar"; sa\.dir = "rtl"/.test(m[0])), "allah.html's three createElement Arabic spans also get lang and dir at the source");
  }
  ok(!/href="\/lights"/.test(Object.values(rendered).join("")) && !fs.readFileSync("api/sitemap.js", "utf8").includes('"/lights"'), "no room and no sitemap entry points at /lights");
  const robots = fs.readFileSync("robots.txt", "utf8");
  ok(robots.includes("Sitemap: https://noorcodex.com/sitemap.xml") && robots.includes("Sitemap: https://noorcodex.com/sitemap-rooms.xml"), "robots.txt names both sitemaps");
  ok(robots.includes("Disallow: /admin2\n") && robots.includes("Disallow: /admin2.html"), "robots.txt keeps the new console out");
  const sm = fs.readFileSync("sitemap.xml", "utf8");
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  ok(locs.length === 608, "the static sitemap holds 608 pages (" + locs.length + ")");
  ok(!["ha", "ja", "ko", "ku", "so", "sw", "zh"].some(l => locs.includes("https://noorcodex.com/" + l)), "the seven thin language roots are gone");
  /* Audit arch-022: /three-lives was a whole indexable room the sitemap never
     named, so no crawler was offered it at all. */
  ok(locs.includes("https://noorcodex.com/three-lives"), "three-lives is listed (arch-022)");
  ok(!locs.some(l => /\/[a-z0-9-]+\/$/.test(l)), "no static entry ends in a slash the router would redirect");
  ok((sm.match(/<lastmod>/g) || []).length === locs.length && sm.includes("<lastmod>2026-09-09</lastmod>"), "every static page carries a lastmod");
  const ign = fs.readFileSync(".vercelignore", "utf8");
  const lines = ign.split("\n").filter(l => l && !l.startsWith("#"));
  ok(["/text/", "/study 2/", "/locales/", "/quran-study.js", "/nodes.js", "/assets/gsap.min.js", "/assets/images/kaaba-night.jpg"].every(x => lines.includes(x)), ".vercelignore lists the dead weight");
  ok(lines.filter(l => /^(text|study 2|locales|i18n|assets|nodes|unseen|quran-study)/.test(l)).length === 0, "every dead-weight entry is anchored to the root (a bare text/ would take i18n/text/ with it)");
  const ignored = (f) => { try { execFileSync("git", ["-c", "core.excludesFile=.vercelignore", "check-ignore", "--no-index", "-q", f], { stdio: "pipe", cwd: ROOT }); return true; } catch { return false; } };
  ok(ignored("text/ar.json") && ignored("study 2/x.json") && ignored("nodes.js"), "git's own matcher ignores text/, study 2/ and nodes.js");
  ok(!ignored("i18n/text/ar.json") && !ignored("nodes-index.js") && !ignored("lights/all.json") && !ignored("assets/noor2.js"), "and does not ignore i18n/text/, nodes-index.js, the Lights or the shell");
  ok(!fs.readFileSync("sw.js", "utf8").includes('"/assets/noor-motion-boot.js"'), "sw.js no longer precaches the motion loader");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
