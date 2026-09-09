/* The promise this file keeps:
   every room api/page.js renders (a Light, a chapter, a verse, a surah, the
   day, and the three shelves) comes back whole: a 200 with a title, a
   canonical, structured data and the second cut's shell; an address that
   names nothing comes back as a 404 in the same shell; a verse range parses;
   the rooms' sitemap lists every Light, chapter and surah; nothing on any
   page is half finished or shows a face; the shell's secondary text clears
   4.5:1 on the night; and vercel.json still parses with every rewrite
   pointing at a file that exists.

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
  ok(js.length < 18 * 1024, "noor2.js is under 18 KB (" + js.length + " bytes)");
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
  ok(js.includes('"/today"') && js.includes('"/quran"') && js.includes('"/dictionary"') && js.includes('"/quran#listen"'), "the bar's five links are Today, Read, Words, Listen, Search");
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
  ok(v.functions["api/card.js"] && v.functions["api/social.js"] && v.crons && v.crons.length === 2 && v.headers.length === 4, "what was in vercel.json is still there");
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
  ok(locs.length === 606, "the static sitemap holds 606 pages (" + locs.length + ")");
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
