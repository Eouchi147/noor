/* NOOR · the encyclopedia in the second cut.
   ------------------------------------------------------------------
   The promise this file keeps: every one of the 523 word pages and the
   hub come out of scripts/gen-dictionary.py in the shell the rooms wear
   (data-n2, assets/noor2.css and noor2.js at v2, the top line, the bar
   of five doors with Words lit, the footer line), with nothing of the
   shell's CSS pasted in; each word page is three screens (the word, the
   meaning, what sits beside it) and stays under 14 KB; its canonical,
   title, description, Arabic, spellings, both definitions, evidence and
   neighbours are the ones the old parchment page carried; its JSON-LD
   still parses as DefinedTerm + WebPage + BreadcrumbList and now names
   its language and the shell's og:image; the Twitter card is there; the
   viewport keeps viewport-fit=cover and never forbids zoom; no page
   pastes the social row; nothing the generator writes speaks in the
   second person (the entries' own text is the library's and is reported,
   not judged here); and the hub is one screen of introduction, the words
   as rows by domain, a finder that narrows them in any spelling, and the
   whole library's search one door away, under 400 KB.

   Then a phone: salah and the hub at iPhone 13, the bar reachable, the
   marks at the edge, the numerals on the eyebrows, nothing pushing the
   page sideways, the finder narrowing 523 rows to the one typed, a link
   to #salah landing on its row. Two pictures are written to tests/shots.

   The old page to compare against is `git show HEAD:dictionary/salah.html`
   when the index has it, else the copy kept beside the scratchpad
   (live/dictionary/salah.html); without either the comparison is skipped
   and the canonical is still checked against the address it must be.

   Needs playwright (in node_modules). Serves the repository itself.
   Run:  node tests/dictionary2.mjs */
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn, execFileSync } from "node:child_process";
import { chromium, devices } from "playwright";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
process.chdir(ROOT);
const SITE = "https://noorcodex.com";
const OG = SITE + "/assets/brand/og.png";
const CAP = 14 * 1024, HUB_CAP = 400 * 1024;
const SCRATCH = "/tmp/claude-0/-home-claude/5dedf661-c8ba-5c14-a599-be4645864117/scratchpad/live/dictionary/salah.html";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };
const info = m => console.log("  INFO " + m);
const skip = m => console.log("  SKIP " + m);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const text = html => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ");
const meta = (html, re) => { const m = html.match(re); return m ? m[1] : null; };
const canon = html => meta(html, /<link rel="canonical" href="([^"]+)"\/>/);
const ldOf = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const YOU = /\b(you|your|yours|yourself|yourselves)\b/i;

/* ---------- 0. the sources, read the way the generator reads them ---------- */
console.log("=== 0. the sources and the files ===");
const entries = [], seen = new Set();
for (const f of fs.readdirSync("build").filter(f => /^dict-.*\.json$/.test(f)).sort()) {
  for (const e of JSON.parse(fs.readFileSync(path.join("build", f), "utf8"))) {
    const id = String(e.id || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!id || seen.has(id) || !e.term || !e.short) continue;
    seen.add(id);
    entries.push({ ...e, id, also: (e.also || []).filter(a => typeof a === "string").slice(0, 14),
      see: (e.see || []).map(s => String(s).toLowerCase().replace(/[^a-z0-9-]/g, "")).slice(0, 8) });
  }
}
const byId = new Map(entries.map(e => [e.id, e]));
for (const e of entries) e.see = e.see.filter(s => byId.has(s) && s !== e.id);
const pages = fs.readdirSync("dictionary").filter(f => f.endsWith(".html")).sort();
ok(entries.length === 523, "build/dict-*.json holds 523 usable entries (" + entries.length + ")");
ok(pages.length === entries.length, "dictionary/ holds one page per entry (" + pages.length + ")");
ok(entries.every(e => pages.includes(e.id + ".html")), "and every entry has its page");
ok(fs.existsSync("dictionary.html"), "the hub dictionary.html exists");
const secondPerson = entries.filter(e => YOU.test(e.short + " " + (e.long || ""))).length;
info(secondPerson + " of the entries' own definitions use the second person; they are the library's text and are passed through unchanged");

/* ---------- 1. every word page ---------- */
console.log("\n=== 1. the 523 word pages ===");
const bad = {};
const mark = (k, id) => { (bad[k] = bad[k] || []).push(id); };
let largest = ["", 0];
const DOORS = ["Today", "Qur'an", "Story", "Words", "Search"];
for (const e of entries) {
  const html = fs.readFileSync(path.join("dictionary", e.id + ".html"), "utf8");
  const size = Buffer.byteLength(html);
  if (size > largest[1]) largest = [e.id, size];
  if (size > CAP) mark("size", e.id + " (" + (size / 1024).toFixed(1) + " KB)");
  if (!/^<!DOCTYPE html>\n<html lang="en" dir="ltr" data-n2=""/.test(html)) mark("shell", e.id);
  if (!html.includes('<link rel="stylesheet" href="/assets/noor2.css?v=2"/>') || !html.includes('<script src="/assets/noor2.js?v=2" defer></script>')) mark("links", e.id);
  if (/<style/.test(html)) mark("inline", e.id);
  if (!html.includes('<header class="n2-top">') || !html.includes('<footer class="n2-foot">') || !html.includes('<main class="n2-main">')) mark("frame", e.id);
  const nav = html.match(/<nav class="n2-bar" aria-label="Rooms">([\s\S]*?)<\/nav>/);
  const doors = nav ? [...nav[1].matchAll(/<a href="([^"]+)"([^>]*)>[\s\S]*?<\/svg>([^<]+)<\/a>/g)] : [];
  if (doors.map(d => d[3]).join(" ") !== DOORS.join(" ")) mark("doors", e.id);
  if (!doors.some(d => d[3] === "Words" && / class="n2-on"/.test(d[2]))) mark("lit", e.id);
  if (!doors.some(d => d[3] === "Search" && /data-n2-search/.test(d[2]))) mark("search", e.id);
  if (!html.includes('content="width=device-width,initial-scale=1,viewport-fit=cover"') || /user-scalable/.test(html)) mark("viewport", e.id);
  if (canon(html) !== SITE + "/dictionary/" + e.id) mark("canonical", e.id);
  if (meta(html, /<title>([^<]+)<\/title>/) !== esc(e.term) + " · meaning in Islam · NOOR Codex of Light") mark("title", e.id);
  if (meta(html, /<meta name="description" content="([^"]*)"\/>/) !== esc(e.short)) mark("desc", e.id);
  if (!html.includes('<meta property="og:image" content="' + OG + '"/>') || !html.includes('<meta name="twitter:card" content="summary_large_image"/>')
    || !html.includes('<meta name="twitter:image" content="' + OG + '"/>')) mark("social", e.id);
  if (/data-noor-social|noor-social/.test(html)) mark("pasted", e.id);
  let ld = null;
  try { ld = ldOf(html); } catch { mark("ldparse", e.id); }
  if (ld) {
    const g = ld.length === 1 && Array.isArray(ld[0]["@graph"]) ? ld[0]["@graph"] : [];
    const term = g.find(x => x["@type"] === "DefinedTerm"), page = g.find(x => x["@type"] === "WebPage");
    const crumbs = page && page.breadcrumb && page.breadcrumb["@type"] === "BreadcrumbList" ? page.breadcrumb.itemListElement : [];
    if (!term || term.name !== e.term || term.url !== SITE + "/dictionary/" + e.id || term.inLanguage !== "en" || term.description !== e.short
      || JSON.stringify(term.alternateName) !== JSON.stringify(e.also.slice(0, 8))) mark("ldterm", e.id);
    if (!page || page.url !== SITE + "/dictionary/" + e.id || page.inLanguage !== "en" || page.image !== OG) mark("ldpage", e.id);
    if (crumbs.length !== 3 || crumbs[2].item !== SITE + "/dictionary/" + e.id || crumbs[2].name !== e.term) mark("ldcrumb", e.id);
  }
  /* the word screen: the Arabic, shielded from translation; the term in gold; the short; the spellings */
  const first = html.match(/<section class="n2-idea" id="word">([\s\S]*?)<\/section>/);
  const s1 = first ? first[1] : "";
  if (!s1.startsWith('\n<p class="n2-eyebrow">The word <small>· ')) mark("eyebrow", e.id);
  if (e.ar && !s1.includes('<p class="n2-word-ar notranslate" lang="ar" translate="no">' + e.ar + "</p>")) mark("arabic", e.id);
  if (!s1.includes('<h1 class="n2-h1"><span class="n2-g">' + esc(e.term) + "</span></h1>")) mark("term", e.id);
  if (!s1.includes('<p class="n2-meaning">' + esc(e.short) + "</p>")) mark("short", e.id);
  if (e.also.length && !s1.includes('<p class="n2-src">Also written · ' + esc(e.also.join(" · ")) + "</p>")) mark("also", e.id);
  if (!/data-n2-share="[^"]+" data-n2-url="https:\/\/noorcodex\.com\/dictionary\//.test(s1)) mark("share", e.id);
  /* the meaning screen: the long definition and the evidence */
  const second = html.match(/<section class="n2-idea" id="meaning">([\s\S]*?)<\/section>/);
  const s2 = second ? second[1] : "";
  if (!s2.includes('<p class="n2-p">' + esc(e.long || e.short) + "</p>")) mark("long", e.id);
  if (!/<p class="n2-src">Evidence · (Qur’an|Sunnah|Scholars differ|Editorial) · /.test(s2)) mark("evidence", e.id);
  /* beside it: the editors' neighbours, six from the domain, every link a page that exists */
  const third = html.match(/<section class="n2-idea n2-short" id="beside">([\s\S]*?)<\/section>/);
  const s3 = third ? third[1] : "";
  const links = [...s3.matchAll(/href="\/dictionary\/([a-z0-9-]+)"/g)].map(m => m[1]);
  if (links.some(id => !fs.existsSync(path.join("dictionary", id + ".html")))) mark("dead", e.id);
  if (e.see.some(s => !links.includes(s))) mark("see", e.id);
  if (!s3.includes('href="/dictionary#cat-' + e.cat + '"') || !s3.includes('href="/dictionary#' + e.id + '"')) mark("hub", e.id);
  for (const v of [...s3.matchAll(/href="\/verse\/(\d+-\d+(?:-\d+)?)"/g)]) if (!/^\d{1,3}-\d{1,3}(-\d{1,3})?$/.test(v[1])) mark("verse", e.id);
  if ((html.match(/<section class="n2-idea/g) || []).length !== 3) mark("screens", e.id);
  /* the generator's own words, with the entries' text lifted out */
  let chrome = html.replace(/<li><a href="\/verse\/[^"]+"><span class="n2-num">[^<]*<\/span><b>[^<]*<\/b><\/a><\/li>/g, " ");
  /* the definitions first, whole, then the spellings: a short spelling ("verse") would otherwise cut a definition in two */
  const own = [e.id, ...links].map(id => byId.get(id)).filter(Boolean);
  for (const t of [...own.flatMap(x => [x.long, x.short]), ...own.flatMap(x => x.also)]) if (t) chrome = chrome.split(esc(t)).join(" ").split(t).join(" ");
  if (YOU.test(text(chrome))) mark("you", e.id);
}
const say = (k, m) => ok(!bad[k], m + (bad[k] ? " → " + bad[k].slice(0, 4).join(", ") + (bad[k].length > 4 ? " +" + (bad[k].length - 4) : "") : ""));
say("size", "every page is under 14 KB · largest " + largest[0] + " at " + (largest[1] / 1024).toFixed(1) + " KB");
say("shell", "every page opens <html lang=\"en\" dir=\"ltr\" data-n2>");
say("links", "every page links assets/noor2.css and noor2.js at ?v=2");
say("inline", "no page carries a <style> of its own: the shell is the two files");
say("frame", "the top line, the main and the footer line are the rooms'");
say("doors", "the bar is the five doors, in order: " + DOORS.join(" · "));
say("lit", "Words is lit on every word page");
say("search", "Search carries data-n2-search, so it opens the site's search where there is one");
say("viewport", "the viewport keeps viewport-fit=cover and never forbids zoom");
say("canonical", "every canonical is https://noorcodex.com/dictionary/<id>");
say("title", "every title is '<term> · meaning in Islam · NOOR Codex of Light'");
say("desc", "every description is the entry's short definition");
say("social", "og:image is the shell's og.png and the Twitter card is set");
say("pasted", "no page pastes the social row: noor-fx.js draws it");
say("ldparse", "every JSON-LD block parses");
say("ldterm", "the DefinedTerm names the term, its spellings, its short, its url and inLanguage");
say("ldpage", "the WebPage names the url, inLanguage and the og image");
say("ldcrumb", "the BreadcrumbList is NOOR › The Encyclopedia › the word");
say("eyebrow", "the first screen opens with the eyebrow 'The word · <domain>'");
say("arabic", "the Arabic is on the first screen, large, with translate=\"no\"");
say("term", "the term is the h1, set in gold");
say("short", "the short definition is the first screen's line");
say("also", "the alternate spellings are a muted mono line");
say("share", "every page shares itself by data-n2-share with its own address");
say("long", "the long definition is the second screen");
say("evidence", "and the level of evidence is a source line under it");
say("screens", "every page is three screens: the word, the meaning, beside it");
say("dead", "every related link points at a page that exists");
say("see", "every neighbour the editors named is on the page");
say("hub", "every page has doors to its domain on the hub and to its own entry there");
say("verse", "every verse door is /verse/<ref> as api/page.js reads it");
say("you", "nothing the generator writes speaks in the second person (the entries' own text and the shelf's quoted labels aside)");
const withVerses = entries.filter(e => /Verses on the shelf that name it/.test(fs.readFileSync(path.join("dictionary", e.id + ".html"), "utf8")));
info(withVerses.length + " page" + (withVerses.length === 1 ? "" : "s") + " carr" + (withVerses.length === 1 ? "ies" : "y") + " verse doors, where the shelf's own labels name the word: " + withVerses.map(e => e.id).join(", "));

/* ---------- 2. salah against the page it replaces ---------- */
console.log("\n=== 2. salah, against the old page ===");
let old = null, from = "";
try { old = execFileSync("git", ["show", "HEAD:dictionary/salah.html"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); from = "git HEAD"; } catch {}
if (!old && fs.existsSync(SCRATCH)) { old = fs.readFileSync(SCRATCH, "utf8"); from = "the kept copy"; }
const now = fs.readFileSync("dictionary/salah.html", "utf8");
ok(canon(now) === SITE + "/dictionary/salah", "the canonical is " + SITE + "/dictionary/salah");
if (old) {
  info("the old page read from " + from);
  ok(canon(old) === canon(now), "the canonical is unchanged from the old page");
  ok(meta(old, /<title>([^<]+)<\/title>/) === meta(now, /<title>([^<]+)<\/title>/), "the title is unchanged");
  ok(meta(old, /<meta name="description" content="([^"]*)"\/>/) === meta(now, /<meta name="description" content="([^"]*)"\/>/), "the description is unchanged");
  ok(meta(old, /<meta property="og:title" content="([^"]*)"\/>/) === meta(now, /<meta property="og:title" content="([^"]*)"\/>/), "og:title is unchanged");
  const oldSee = [...(old.match(/Words that sit beside it<\/h2><div class="see">([\s\S]*?)<\/div>/) || ["", ""])[1].matchAll(/href="\/dictionary\/([a-z0-9-]+)"/g)].map(m => m[1]);
  const newSee = [...(now.match(/Words that sit beside it<\/p><ul class="n2-list">([\s\S]*?)<\/ul>/) || ["", ""])[1].matchAll(/href="\/dictionary\/([a-z0-9-]+)"/g)].map(m => m[1]);
  ok(oldSee.length && oldSee.join(" ") === newSee.join(" "), "the neighbours are the same four: " + newSee.join(", "));
  const oldAlso = (old.match(/<p class="alt">([^<]+)<\/p>/) || ["", ""])[1];
  ok(oldAlso && now.includes("Also written · " + oldAlso), "the spellings are the same twelve");
  const oldLong = (old.match(/mean in Islam\?<\/h2>\n<p>([^<]+)<\/p>/) || ["", ""])[1];
  ok(oldLong && now.includes('<p class="n2-p">' + oldLong + "</p>"), "the long definition is the same text");
  const oldLd = ldOf(old)[0]["@graph"], newLd = ldOf(now)[0]["@graph"];
  ok(oldLd[0].name === newLd[0].name && JSON.stringify(oldLd[0].alternateName) === JSON.stringify(newLd[0].alternateName) && oldLd[1].breadcrumb.itemListElement.length === newLd[1].breadcrumb.itemListElement.length,
    "the JSON-LD keeps the term, its spellings and the three crumbs");
  ok(!("inLanguage" in oldLd[0]) && newLd[0].inLanguage === "en" && newLd[1].image === OG, "and is extended with inLanguage and the og image");
} else skip("no old page to compare with (git HEAD lacks dictionary/, and no kept copy)");

/* ---------- 3. the hub ---------- */
console.log("\n=== 3. the hub ===");
const hub = fs.readFileSync("dictionary.html", "utf8");
const hubSize = Buffer.byteLength(hub);
ok(hubSize < HUB_CAP, "dictionary.html is " + (hubSize / 1024).toFixed(0) + " KB, under 400");
ok(/^<!DOCTYPE html>\n<html lang="en" dir="ltr" data-n2="reveal top bar share home"/.test(hub), "it is a shell page (reveal top bar share home; no shader over 523 rows)");
ok(hub.includes('/assets/noor2.css?v=2') && hub.includes('/assets/noor2.js?v=2'), "it links the shell at v2");
ok(canon(hub) === SITE + "/dictionary", "its canonical is " + SITE + "/dictionary");
ok(hub.includes('<meta property="og:image" content="' + OG + '"/>') && hub.includes('<meta name="twitter:card" content="summary_large_image"/>'), "og image and Twitter card");
ok(!/user-scalable/.test(hub) && hub.includes("viewport-fit=cover"), "viewport-fit=cover, zoom allowed");
const hubNav = hub.match(/<nav class="n2-bar" aria-label="Rooms">([\s\S]*?)<\/nav>/);
ok(!!hubNav && [...hubNav[1].matchAll(/<\/svg>([^<]+)<\/a>/g)].map(m => m[1]).join(" ") === DOORS.join(" ") && /href="\/dictionary" class="n2-on"/.test(hubNav[1]), "the bar's five doors, Words lit");
const cats = [...hub.matchAll(/<section class="n2-idea n2-short n2-group" id="cat-([a-z]+)">\n<h2 class="n2-h3">([^<]+) <span class="n2-g">· (\d+)<\/span>/g)];
ok(cats.length === 7 && cats.map(c => c[1]).join(" ") === "aqidah ibadah quran hadith fiqh tazkiyah tarikh", "seven domains, in the book's order");
ok(cats.every(c => +c[3] === entries.filter(e => e.cat === c[1]).length), "each domain's count is its entries'");
const rows = [...hub.matchAll(/<li id="([a-z0-9-]+)" data-k="([^"]*)"><a href="\/dictionary\/([a-z0-9-]+)"><b>([^<]+)<small>([^<]*)<\/small><\/b><span class="n2-ar" lang="ar" translate="no">([^<]*)<\/span><\/a><\/li>/g)];
ok(rows.length === entries.length, "one row per word (" + rows.length + ")");
ok(rows.every(r => r[1] === r[3] && byId.has(r[1]) && r[4] === esc(byId.get(r[1]).term) && r[5] === esc(byId.get(r[1]).short) && r[6] === esc(byId.get(r[1]).ar || "")),
  "each row is its word's term, short line and Arabic, linked to its page");
const inOrder = cats.every(c => { const sec = hub.slice(hub.indexOf('id="cat-' + c[1] + '"'), hub.indexOf("</section>", hub.indexOf('id="cat-' + c[1] + '"'))); const ids = [...sec.matchAll(/<li id="([a-z0-9-]+)"/g)].map(m => m[1]); return ids.every(id => byId.get(id).cat === c[1]); });
ok(inOrder, "every row sits under its own domain");
const foldJs = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’'ʻʼ`]/g, "").replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").trim();
ok(rows.every(r => { const e = byId.get(r[1]); return e.also.every(a => foldJs(a) === "" || r[2].split("|").includes(foldJs(a))); }), "every alternate spelling is folded into the row's data-k, whole, for the finder");
ok(hub.includes('id="dq"') && hub.includes('type="search"') && hub.includes('id="dcount"') && hub.includes('id="dnone"'), "the finder: a field, a count, a line for nothing found");
ok(hub.includes('/assets/noor-search.js?v=78') && hub.includes('/assets/noor-rtl.css?v=77') && /id="dsite"/.test(hub) && /NOOR_SEARCH\.open\(\)/.test(hub), "the whole library's search is loaded and wired the way the home page wires it");
ok(/The Encyclopedia <span class="n2-g">of the Path<\/span>/.test(hub) && /Every word this library uses, defined plainly\./.test(hub), "one screen of introduction, the old page's own opening");
ok(!/data-noor-social|noor-social/.test(hub), "the hub does not paste the social row");
ok(!/\.n2-(idea|bar|top|list|main|eyebrow)\s*\{/.test(hub), "the hub's own <style> carries only what is particular to it, nothing of the shell");
try {
  const g = ldOf(hub)[0]["@graph"], set = g.find(x => x["@type"] === "DefinedTermSet"), crumbs = g.find(x => x["@type"] === "BreadcrumbList");
  ok(set && set.url === SITE + "/dictionary" && set.inLanguage === "en" && set.hasDefinedTerm.length === 60 && set.hasDefinedTerm.every(t => t.url.startsWith(SITE + "/dictionary/")), "the JSON-LD is a DefinedTermSet of sixty terms, each with its url");
  ok(crumbs && crumbs.itemListElement.length === 2, "and a BreadcrumbList");
} catch (e) { ok(false, "the hub's JSON-LD parses (" + e.message + ")"); }
{
  let chrome = hub;
  for (const e of entries) chrome = chrome.split(esc(e.short)).join(" ");
  ok(!YOU.test(text(chrome)), "nothing the generator writes on the hub speaks in the second person");
}
ok(!fs.existsSync("salah.html") && fs.existsSync("hajj.html") && fs.existsSync("quran.html"), "the old root word pages stay retired; hajj.html and quran.html, which are rooms, stand");

/* ---------- 4. on a phone ---------- */
console.log("\n=== 4. on a phone ===");
const port = await new Promise(r => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
const srv = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const BASE = "http://127.0.0.1:" + port;
for (let i = 0; i < 50; i++) { try { const r = await fetch(BASE + "/robots.txt"); if (r.ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
fs.mkdirSync("tests/shots", { recursive: true });
const br = await chromium.launch();
const ctx = await br.newContext({ ...devices["iPhone 13"], locale: "en-GB" });
/* nothing leaves the machine: fonts and any other host are refused */
await ctx.route("**/*", route => { const u = new URL(route.request().url()); return u.hostname === "127.0.0.1" ? route.continue() : route.abort(); });
/* the home-screen offer is the shell's and is proved in tests/rooms-shots.mjs; here it would cover the pictures */
await ctx.addInitScript(() => { try { localStorage.setItem("n2-home", "done"); } catch (e) {} });
const errors = [];
const page = await ctx.newPage();
page.on("pageerror", e => errors.push(e.message));

await page.goto(BASE + "/dictionary/salah.html", { waitUntil: "load" });
await page.waitForFunction(() => document.documentElement.classList.contains("n2-live"), null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(900);
const w = await page.evaluate(() => {
  const vw = innerWidth, vh = innerHeight;
  const bar = document.querySelector(".n2-bar"), r = bar && bar.getBoundingClientRect();
  const doors = bar ? [...bar.querySelectorAll("a")].map(a => { const b = a.getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { t: a.textContent.trim(), on: a.classList.contains("n2-on"), h: b.height, reach: !!hit && (hit === a || a.contains(hit)) }; }) : [];
  const ar = document.querySelector(".n2-word-ar"), h1 = document.querySelector(".n2-h1 .n2-g");
  const first = document.querySelector("#word");
  return {
    live: document.documentElement.classList.contains("n2-live"),
    barIn: !!r && r.bottom <= vh + 1 && r.top < vh, doors,
    marks: document.querySelectorAll(".n2-dots i").length,
    numeral: (document.querySelector("#word .n2-eyebrow .n2-of") || {}).textContent || "",
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    arFont: ar ? getComputedStyle(ar).fontFamily : "", arColor: ar ? getComputedStyle(ar).color : "", arSize: ar ? parseFloat(getComputedStyle(ar).fontSize) : 0,
    gold: h1 ? getComputedStyle(h1).color : "",
    firstIn: !!first && first.classList.contains("n2-in"),
    inView: !!ar && ar.getBoundingClientRect().top >= 0 && ar.getBoundingClientRect().bottom <= vh,
    night: getComputedStyle(document.body).backgroundColor,
    share: !!document.querySelector("#word [data-n2-share]"),
    social: document.querySelectorAll("[data-noor-social]").length
  };
});
ok(w.live, "the shell wakes (html.n2-live)");
ok(w.barIn && w.doors.length === 5 && w.doors.every(d => d.reach && d.h >= 44), "the bar sits at the foot of the phone, five doors, each a real thumb target");
ok(w.doors.map(d => d.t).join(" ") === DOORS.join(" ") && w.doors.filter(d => d.on).map(d => d.t).join() === "Words", "Today · Qur'an · Story · Words · Search, with Words lit");
ok(w.marks === 3, "three marks at the right edge, one per screen (" + w.marks + ")");
ok(w.numeral === "01 / 03", "the first eyebrow is numbered 01 / 03 (" + w.numeral + ")");
ok(w.sw <= w.cw, "nothing pushes the page sideways at 390 (" + w.sw + " ≤ " + w.cw + ")");
ok(/Amiri/i.test(w.arFont) && /rgb\(233,\s*200,\s*106\)/.test(w.arColor) && w.arSize >= 48, "the Arabic is Amiri, gold, " + Math.round(w.arSize) + " px");
ok(/rgb\(233,\s*200,\s*106\)/.test(w.gold), "the term is in gold");
ok(w.firstIn && w.inView, "the first screen is revealed and the Arabic is within the first view");
ok(/rgb\(4,\s*6,\s*15\)/.test(w.night), "the page is the night");
ok(w.share, "the share is on the first screen");
ok(w.social === 1, "the social row is drawn once, by noor-fx.js, not pasted (" + w.social + ")");
await page.screenshot({ path: "tests/shots/dictionary2-salah-390.png" });
console.log("  tests/shots/dictionary2-salah-390.png written");

await page.goto(BASE + "/dictionary.html", { waitUntil: "load" });
await page.waitForFunction(() => document.documentElement.classList.contains("n2-live"), null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(600);
const h0 = await page.evaluate(() => ({
  rows: document.querySelectorAll(".n2-list li:not([hidden])").length,
  count: document.getElementById("dcount").textContent,
  sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  field: !!document.getElementById("dq"), fieldPx: parseFloat(getComputedStyle(document.getElementById("dq")).fontSize),
  site: !!document.getElementById("dsite"), search: typeof NOOR_SEARCH === "object" && typeof NOOR_SEARCH.open === "function",
  marks: document.querySelectorAll(".n2-dots i").length,
  groups: [...document.querySelectorAll(".n2-group")].filter(g => !g.hidden).length
}));
ok(h0.rows === 523 && /^523 words$/.test(h0.count), "523 rows, and the count says so");
ok(h0.sw <= h0.cw, "nothing pushes the hub sideways at 390");
ok(h0.field && h0.fieldPx >= 16, "the field is there, at 16 px so the phone does not zoom into it");
ok(h0.site && h0.search, "the whole library's search is loaded, and its door is beside the field");
ok(h0.marks === 9 && h0.groups === 7, "nine screens carry marks: the introduction, seven domains, the rooms");
await page.fill("#dq", "qadr");
await page.waitForTimeout(250);
const h1 = await page.evaluate(() => ({
  rows: [...document.querySelectorAll(".n2-list li:not([hidden])")].map(li => li.id),
  hit: (document.querySelector(".n2-list li.hit") || {}).id,
  count: document.getElementById("dcount").textContent,
  groups: [...document.querySelectorAll(".n2-group")].filter(g => !g.hidden).length,
  none: document.getElementById("dnone").hidden
}));
ok(h1.rows.length > 0 && h1.rows.length < 30 && h1.rows.includes("qadr"), "typing qadr narrows 523 rows to " + h1.rows.length + ", qadr among them");
ok(h1.hit === "qadr", "and qadr is the lit row");
ok(h1.count === h1.rows.length + (h1.rows.length === 1 ? " word" : " words") && h1.groups < 7 && h1.none, "the count follows, empty domains step aside");
await page.fill("#dq", "taqdeer");
await page.waitForTimeout(250);
ok(await page.evaluate(() => (document.querySelector(".n2-list li.hit") || {}).id) === "qadr", "taqdeer, an alternate spelling, lands on qadr");
await page.fill("#dq", "zzzzzz");
await page.waitForTimeout(250);
ok(await page.evaluate(() => !document.getElementById("dnone").hidden && document.querySelectorAll(".n2-list li:not([hidden])").length === 0), "a spelling the book lacks shows the line for nothing found");
await page.fill("#dq", "");
await page.waitForTimeout(250);
await page.screenshot({ path: "tests/shots/dictionary2-hub-390.png" });
console.log("  tests/shots/dictionary2-hub-390.png written");
await page.fill("#dq", "riba");
await page.waitForTimeout(250);
await page.evaluate(() => document.querySelector(".n2-group:not([hidden])").scrollIntoView({ block: "start" }));
await page.waitForTimeout(900);
await page.screenshot({ path: "tests/shots/dictionary2-hub-riba-390.png" });
console.log("  tests/shots/dictionary2-hub-riba-390.png written (the finder at work)");

/* a link into the book: /dictionary#salah lands on the row */
await page.goto(BASE + "/dictionary.html#salah", { waitUntil: "load" });
await page.waitForTimeout(1200);
const land = await page.evaluate(() => { const li = document.getElementById("salah"); const r = li.getBoundingClientRect(); return { hit: li.classList.contains("hit"), inView: r.top >= 0 && r.bottom <= innerHeight, total: document.querySelectorAll(".n2-list li:not([hidden])").length }; });
ok(land.hit && land.inView && land.total === 523, "#salah lands on its row, lit, with the whole book still open");
await page.goto(BASE + "/dictionary.html?w=iman", { waitUntil: "load" });
await page.waitForTimeout(1200);
ok(await page.evaluate(() => document.getElementById("iman").classList.contains("hit")), "?w=iman, the daily post's spelling of the same door, lands too");

const real = [...new Set(errors)].filter(e => !/Failed to load resource|net::ERR/i.test(e));
ok(real.length === 0, "no page error on either page" + (real.length ? " → " + real.slice(0, 3).join(" | ") : ""));
await br.close();
srv.kill();

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
