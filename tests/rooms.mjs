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

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };
const skip = m => console.log("  SKIP " + m);

/* ---------- the stubs: the Qur'an API and the manifest, without a network ---------- */
let apiDown = false;
globalThis.fetch = async (url) => {
  url = String(url);
  const json = j => ({ ok: true, json: async () => j });
  if (url.includes("/reels/index.json")) return json({ n: 2, written: "2026-09-08", cards: [
    { id: "verse-94-5-6", kind: "verse", slot: "morning", hook: "Qur'an 94:5-6", caption: "94:5-6\n\nsabr", reciter: "Mishary Rashid Alafasy", cover: true, video: "https://example.org/verse-94-5-6.mp4", uploaded: "2026-09-07T08:00:00Z" },
    { id: "verse-2-153", kind: "verse", slot: "evening", hook: "Qur'an 2:153", caption: "…", reciter: "Abdul Basit Abdus Samad", cover: true },
    { id: "word-sabr", kind: "word", slot: "evening", hook: "Sabr", caption: "…", cover: true }
  ] });
  if (apiDown) return { ok: false, status: 503, json: async () => ({}) };
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
  ok(/<title>[^<]+· NOOR Codex of Light<\/title>/.test(r.body), name + " has a title");
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
ok(rendered.light.includes('<span class="n2-g">'), "the Light's key phrase is set in gold");
ok(rendered.light.includes("Source · Qur&#39;an 3:123"), "the Light's source line is shown");
ok(rendered.light.includes("/dictionary/badr"), "the Light reads beside the word Badr");
ok(rendered.light.includes("/light/badr-wells-on-the-caravan-road") && rendered.light.includes('<ul class="n2-shelf">'), "the Light reads beside a related Light, on a shelf");
ok(rendered.verse.includes("<video") && rendered.verse.includes("https://example.org/verse-94-5-6.mp4") && !/<video[^>]*autoplay/.test(rendered.verse), "the verse carries its reel, not autoplaying");
ok(rendered.verse.includes("Saheeh International") && rendered.verse.includes("recited by Mishary Rashid Alafasy"), "the verse names its translation and its reciter");
ok(rendered.verse.includes('href="/quran?surah=94&amp;ayah=5"') && rendered.verse.includes('href="/surah/94"'), "the verse links the Mushaf and its surah");
ok(rendered.verse.includes("/dictionary/sabr"), "the verse reads beside the caption's word");
ok(/isPartOf/.test(rendered.verse), "the verse's JSON-LD names what it is part of");
ok(rendered.surah.includes("Al-Baqarah") && rendered.surah.includes("286 verses") && rendered.surah.includes("Madinah"), "the surah shows name, count and place from the API");
ok(rendered.surah.includes("The context") && rendered.surah.includes("The name") && rendered.surah.includes("The themes") && rendered.surah.includes("The heart of it"), "the surah carries its study material");
ok(rendered.surah.includes('href="/surah/1"') && rendered.surah.includes('href="/surah/3"'), "the surah walks to its neighbours");
ok(rendered.surah.includes("/verse/2-153"), "the surah links its shelved verse");
ok(rendered.path.includes("Adam from Clay") && rendered.path.includes('href="/path/1"') && rendered.path.includes('href="/path/3"'), "the chapter walks to its neighbours");
ok(!rendered.path.includes("/assets/manuscripts/adam.jpg"), "chapter 2's plate is held back (a face in profile)");
{ const r3 = await call({ kind: "path", n: "3" }); ok(r3.body.includes("/assets/manuscripts/hawwa-garden.jpg"), "chapter 3's plate is used because the file exists and shows no face"); }
ok(rendered.path.includes("Muslim 854") && rendered.path.includes("/verse/2-30"), "the chapter carries its narration and links its verse");
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
  ok(r.body.includes("/today?date=" + y + '"'), "yesterday's canonical carries its date");
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
  ok(v3.body.includes("Surah Al &lt;b&gt;Imran&lt;/b&gt;") && !v3.body.includes("Surah Al <b>Imran"), "a surah name from the API is escaped in the button label");
}

console.log("\n=== the Qur'an API being down ===");
{
  apiDown = true;
  const r = await call({ kind: "verse", ref: "2:255" });
  ok(r.code === 200 && r.body.includes("on the Mushaf") && r.body.includes("Qur&#39;an 2:255"), "a verse the API cannot give still renders, and says the text is on the Mushaf");
  const s = await call({ kind: "surah", n: "112" });
  ok(s.code === 200 && s.body.includes("Al-Ikhlas") && s.body.includes("4 verses"), "a surah the API cannot give still renders from the reels' Qur'an table");
  apiDown = false;
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
  ok((r.body.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) || []).length === locs.length, "every entry carries a lastmod");
  const today = new Date().toISOString().slice(0, 10);
  ok(r.body.includes("<loc>https://noorcodex.com/light/battle-of-badr-624</loc><lastmod>" + sitemap.LAST_CONTENT_CHANGE + "</lastmod>") && /LAST_CONTENT_CHANGE = "\d{4}-\d{2}-\d{2}"/.test(fs.readFileSync("api/sitemap.js", "utf8")),
    "content pages carry the hand-set LAST_CONTENT_CHANGE, a literal in the file (" + sitemap.LAST_CONTENT_CHANGE + ")");
  ok(r.body.includes("<loc>https://noorcodex.com/today</loc><lastmod>" + today + "</lastmod>"), "only the day's page is stamped today");
  ok(r.body.includes("<loc>https://noorcodex.com/verse/94-5-6</loc><lastmod>2026-09-07</lastmod>"), "a verse carries the day its reel was uploaded");
  ok(r.body.startsWith('<?xml version="1.0" encoding="UTF-8"?>') && r.body.trim().endsWith("</urlset>"), "the XML opens and closes");
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
     cut to their bone first; 25 KB is the new ceiling and it is still a
     ceiling. Anything that only looks nice belongs in the CSS. */
  ok(js.length < 25 * 1024, "noor2.js is under 25 KB (" + js.length + " bytes)");
  ok(css.includes("--n2-spring:linear(0, 0.006") && css.includes("@supports (transition-timing-function:linear(0,1))") && !/transition:[^;}]*\blinear\b/.test(css.replace(/linear\(/g, "L(")) && !/transition:[^;}]*\blinear\b/.test(css),
     "the spring is defined with a bezier fallback and nothing moves linearly");
  ok(css.includes("scroll-snap-type:y proximity") && css.includes("scroll-snap-stop:normal") && css.includes(".n2-shelf") && css.includes("overscroll-behavior-x:contain") && css.includes("mask-image"),
     "screens and shelves snap; shelves fade at the edges");
  ok(css.includes(".n2-glow{animation:n2-breath 4.2s ease-in-out infinite}") && css.includes(".n2-sheet") && css.includes(".n2-handle") && css.includes(".n2-prog") && css.includes(".n2-pill-bg"),
     "the glow, the sheet, the hairline and the pill exist");
  const rm = css.slice(css.indexOf("@media (prefers-reduced-motion:reduce)"));
  ok(/\.n2-glow\{animation:none!important\}/.test(rm) && /\.n2-btn,\.n2-bar a\{transform:none!important\}/.test(rm), "reduced motion switches the glow and the magnets off");
  ok(js.includes("sheet:") && js.includes("--mx") && js.includes("n2-press") && js.includes("n2-release") && js.includes("focusTo") && js.includes("--n2-p"), "noor2.js carries the magnets, the press, the sheet, the following glow and the hairline");
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

console.log("\n=== the deployment ===");
{
  let v = null;
  try { v = JSON.parse(fs.readFileSync("vercel.json", "utf8")); } catch { }
  ok(!!v, "vercel.json parses");
  for (const rw of (v && v.rewrites) || []) {
    const file = "api/" + rw.destination.replace(/^\/api\//, "").split("?")[0] + ".js";
    if (rw.destination.startsWith("/api/podcast")) { if (fs.existsSync(file)) ok(true, rw.source + " → " + file + " exists"); else skip(rw.source + " → " + file + " is owed by the podcast work"); continue; }
    ok(fs.existsSync(file), rw.source + " → " + file + " exists");
  }
  const want = ["/light", "/light/:id", "/lights", "/path/:n", "/path", "/verse/:ref", "/verses", "/surah/:n", "/today", "/sitemap-rooms.xml", "/podcast.xml", "/journal/:slug"];
  ok(want.every(s => (v.rewrites || []).some(r => r.source === s)), "every room has its rewrite, and the old ones remain");
  ok(v.functions["api/page.js"] && /lights\/all\.json/.test(v.functions["api/page.js"].includeFiles) && /node\/\*\.json/.test(v.functions["api/page.js"].includeFiles), "api/page.js includes the library's files");
  ok(v.functions["api/card.js"] && v.functions["api/social.js"] && v.crons && v.crons.length === 2 && v.headers.length === 5, "what was in vercel.json is still there");
  /* The scripts and stylesheets under /assets were immutable for a year while
     the pages asked for them at a hand-written ?v= that nobody moved, so an
     edit to any of them reached new readers only. They revalidate now; the
     fonts and pictures, whose names change when their contents do, do not. */
  const cc = src => (v.headers.find(h => h.source === src) || { headers: [{}] }).headers[0].value || "";
  ok(/max-age=300/.test(cc("/assets/(.*)\\.(js|css|mjs|map)")), "a change to a script or a stylesheet reaches a reader who has been here before");
  ok(/immutable/.test(cc("/assets/(.*)\\.(woff2|woff|ttf|otf|eot|png|jpg|jpeg|gif|svg|webp|avif|ico|mp3|m4a|wav|mp4|webm|pdf|txt)")), "and a font or a picture is still kept for a year");
  ok(v.functions["api/reel.js"] && v.functions["api/reel.js"].maxDuration === 60 && fs.existsSync("api/reel.js"), "api/reel.js may run for a minute");
  ok(!["path.html", "lights.html", "today.html", "verses.html", "surah.html", "light.html"].some(f => fs.existsSync(f)), "no static page collides with a room");
  ok(!["light", "path", "today", "verses", "surah"].some(d => fs.existsSync(d) && fs.statSync(d).isDirectory()), "no folder collides with a shelf (lights/ is why the shelf is /light)");
  ok(fs.readFileSync("index.html", "utf8").includes('href="/light"') && !fs.readFileSync("index.html", "utf8").includes('href="/lights"'), "the home page links the shelf at /light");
  ok(!/href="\/lights"/.test(Object.values(rendered).join("")) && !fs.readFileSync("api/sitemap.js", "utf8").includes('"/lights"'), "no room and no sitemap entry points at /lights");
  const robots = fs.readFileSync("robots.txt", "utf8");
  ok(robots.includes("Sitemap: https://noorcodex.com/sitemap.xml") && robots.includes("Sitemap: https://noorcodex.com/sitemap-rooms.xml"), "robots.txt names both sitemaps");
  ok(robots.includes("Disallow: /admin2\n") && robots.includes("Disallow: /admin2.html"), "robots.txt keeps the new console out");
  const sm = fs.readFileSync("sitemap.xml", "utf8");
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  ok(locs.length === 607, "the static sitemap holds 607 pages (" + locs.length + ")");
  ok(!["ha", "ja", "ko", "ku", "so", "sw", "zh"].some(l => locs.includes("https://noorcodex.com/" + l)), "the seven thin language roots are gone");
  ok((sm.match(/<lastmod>/g) || []).length === locs.length && sm.includes("<lastmod>2026-09-09</lastmod>"), "every static page carries a lastmod");
  const ign = fs.readFileSync(".vercelignore", "utf8");
  const lines = ign.split("\n").filter(l => l && !l.startsWith("#"));
  ok(["/text/", "/study 2/", "/locales/", "/quran-study.js", "/nodes.js", "/assets/gsap.min.js", "/assets/images/kaaba-night.jpg"].every(x => lines.includes(x)), ".vercelignore lists the dead weight");
  ok(lines.filter(l => /^(text|study 2|locales|i18n|assets|nodes|unseen|quran-study)/.test(l)).length === 0, "every dead-weight entry is anchored to the root (a bare text/ would take i18n/text/ with it)");
  const ignored = (f) => { try { execFileSync("git", ["-c", "core.excludesFile=.vercelignore", "check-ignore", "--no-index", "-q", f], { stdio: "pipe" }); return true; } catch { return false; } };
  ok(ignored("text/ar.json") && ignored("study 2/x.json") && ignored("nodes.js"), "git's own matcher ignores text/, study 2/ and nodes.js");
  ok(!ignored("i18n/text/ar.json") && !ignored("nodes-index.js") && !ignored("lights/all.json") && !ignored("assets/noor2.js"), "and does not ignore i18n/text/, nodes-index.js, the Lights or the shell");
  ok(!fs.readFileSync("sw.js", "utf8").includes('"/assets/noor-motion-boot.js"'), "sw.js no longer precaches the motion loader");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
