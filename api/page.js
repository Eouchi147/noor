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
// The loaders are exported so api/sitemap.js lists the same rooms.

import fs from "node:fs";
import path from "node:path";
import { kv, kvReady } from "./_kv.js";
import { pickWord, pickChapter } from "./_schedule.js";
import { scoreLights, hijriOf, hijriName } from "./_lights.js";
import { manifestHost } from "./_reels.js";

const SITE = "https://noorcodex.com";
const OG_DEFAULT = SITE + "/assets/brand/og.png";
const V = "2";                                  /* the shell's cache-buster; noor-fx.js carries the same */
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
const labels = () => once("labels", () => readJSON("i18n/en.json") || {});
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
/* the Path's own cross links: {{n:2|Adam}} is a chapter, {{c:id|Iblis}} a figure */
const unmark = s => esc(s).replace(/\{\{n:(\d+)\|([^{}]*)\}\}/g, (m, n, l) => `<a href="/path/${n}">${l}</a>`).replace(/\{\{[a-z]+:[^|{}]+\|([^{}]*)\}\}/g, "$1");
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

/* the dictionary words a text mentions, by term or id, whole words only */
export function relatedWords(text, limit = 6) {
  const D = dictionary();
  const hay = " " + fold(text) + " ";
  const out = [];
  for (const id of Object.keys(D)) {
    const e = D[id];
    const keys = [fold(e.t), fold(id.replace(/-/g, " "))].filter(k => k.length >= 3);
    if (keys.some(k => hay.includes(" " + k + " "))) out.push({ id, ...e });
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
  return { s, a, b, id: s + "-" + a + (b > a ? "-" + b : ""), label: s + ":" + a + (b > a ? "–" + b : "") };
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
const crumbs = list => ({ "@type": "BreadcrumbList", itemListElement: list.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + url })) });
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
  ["Search", "/dictionary", '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.3-4.3"/>']
];
export function shell(o) {
  const title = o.title + " · NOOR Codex of Light";
  const canonical = SITE + o.path;
  /* Search opens the sheet (assets/noor-search.js, fetched by noor-fx.js on a
     room that does not carry it) and nothing else. It used to carry the menu
     dial's data-nm-open as well, which on a page that loads the dial always
     won -- so the bar's Search and the field on the arrival opened two
     different searches. The dial is the Menu's. */
  const bar = BAR.map(l => `<a href="${l[1]}"${l[0] === "Search" ? " data-n2-search" : ""}${l[1] === o.active ? ' class="n2-on"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${l[2]}</svg>${l[0]}</a>`).join("");
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
<meta property="og:url" content="${attr(canonical)}"/>
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
${jsonld(ld)}
</head>
<body>
<div class="n2-still"></div>
<i class="n2-prog" aria-hidden="true"></i>
<header class="n2-top">
  <a class="n2-brand" href="/"><span class="n2-ar" lang="ar">نُور</span><span class="n2-en">Codex of Light</span></a>
  ${o.pill ? `<a class="n2-pill" href="${attr(o.pill[0])}">${esc(o.pill[1])}</a>` : ""}
</header>
<main class="n2-main">
${o.body}
</main>
<footer class="n2-foot">NOOR Codex of Light · free, no ads, no account · <a href="/">the library</a> · <a href="/legal">legal</a></footer>
<nav class="n2-bar" aria-label="Rooms"><i class="n2-pill-bg" aria-hidden="true"></i>${bar}</nav>
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
  const body = `<section class="n2-idea">
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
  const body = `<section class="n2-idea">
<p class="n2-eyebrow">The Path <small>· chapter ${n} of ${list.length} · ${esc(periodName(N.period))}</small></p>
${N.titleAr ? `<p class="n2-title-ar" lang="ar">${esc(N.titleAr)}</p>` : ""}
<h1 class="n2-h1">${hook}</h1>
<p class="n2-meaning">${esc(N.summary || "")}</p>
${img ? `<div class="n2-image" role="img" aria-label="${attr(N.titleEn)}" style="background-image:url('${attr(img)}')"></div>` : ""}
<div class="n2-row">${go("#story", "Read on", true)}${shareBtn(N.titleEn + " · The Path of Creation, chapter " + n + " · NOOR", SITE + url)}</div>
</section>
<section class="n2-idea n2-short" id="story">
<p class="n2-eyebrow">The chapter</p>
${paras(unmark(N.details || ""))}
</section>
${(N.quran || []).length ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The Qur'an on it</p>` + N.quran.map(q => {
  const r = parseRef(q.ref);
  return `<div class="n2-quote">${q.ar ? `<p class="n2-quran" lang="ar">${esc(q.ar)}</p>` : ""}<p class="n2-p">${esc(q.en || "")}</p><p class="n2-ref">${r ? `<a href="/verse/${r.id}">Qur'an ${esc(q.ref)}</a>` : "Qur'an " + esc(q.ref)}</p></div>`;
}).join("") + "</section>" : ""}
${(N.hadith || []).length ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The narrations</p>` + N.hadith.map(h =>
  `<div class="n2-quote"><p class="n2-p">${esc(h.text)}</p><p class="n2-src">${esc(h.source || "")}</p></div>`).join("") + "</section>" : ""}
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
    title: N.titleEn + " · The Path, chapter " + n, path: url, desc: clip(N.summary || N.details, 158), active: "/path",
    crumbs: [["The Path of Creation", "/path"], [N.titleEn, url]], pill: ["/path", "The Path"],
    image: img ? SITE + img : "",
    ld: [{ "@context": "https://schema.org", "@type": "Article", headline: N.titleEn, alternativeHeadline: N.titleAr || undefined, description: clip(N.summary, 200),
      url: SITE + url, mainEntityOfPage: SITE + url, image: img ? SITE + img : OG_DEFAULT, inLanguage: "en", position: n,
      isPartOf: { "@type": "CreativeWorkSeries", name: "The Path of Creation", url: SITE + "/path" },
      author: { "@type": "Organization", name: "NOOR Codex of Light", url: SITE },
      publisher: { "@type": "Organization", name: "NOOR Codex of Light", url: SITE, logo: { "@type": "ImageObject", url: SITE + "/assets/brand/mark-512.png" } } }],
    body, tail: GUIDE_TAIL(n) }) };
}
/* The quiet guide. noor-guide.js has answered from the sources on the thirty
   chapters that carry a curated topic -- the Dajjal, the grave, the trials --
   since it was written, and the two scripts came off the site the day the home
   was rebuilt. This is the chapter's own room, the fullest telling of it and
   what search sends a reader to, so it is the first place the pill belongs.
   Both files sit at the root, outside /assets, so they revalidate: a change to
   an answer reaches a reader who has been here before. attach() is a no-op on
   a chapter with no topic, so this costs those chapters one 304. */
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
/* 61KB of curated answers, so only the thirty chapters that have one pay for
   them; on the other forty-one the pill would never have appeared. */
const GUIDE_TAIL = n => guideKeys().has("n:" + Number(n)) ? `<script src="/noor-guide-data.js" defer></script>
<script src="/noor-guide.js" defer></script>
<script>addEventListener("load",function(){var g=window.NoorGuide,c=document.getElementById("story");
if(g&&g.attach&&c)g.attach(c,"n:${Number(n)}",document.title);});</script>` : "";
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
  for (let a = ref.a; a <= ref.b; a++) { const t = await ayah(ref.s, a); if (!t) { texts.length = 0; break; } texts.push(t); }
  const meta = texts[0] ? texts[0].surah : (surahRow(ref.s) ? { number: ref.s, name: surahRow(ref.s).name, englishName: surahRow(ref.s).translit } : null);
  const name = meta ? meta.englishName : "";
  const mushaf = "/quran?surah=" + ref.s + "&ayah=" + ref.a;
  const english = texts.map(t => t.en).join(" ");
  const reciter = row && row.reciter ? String(row.reciter) : "";
  const shareText = "Qur'an " + ref.label + (english ? ": " + clip(english, 200) : "") + " · NOOR Codex of Light";
  /* the reel has a screen of its own after the text: a reader who arrived
     from the reel wants the words first, and a phone cannot hold both */
  const reel = row ? `<section class="n2-idea" id="reel">
<p class="n2-eyebrow">The reel${reciter ? ` <small>· recited by ${esc(reciter)}</small>` : ""}</p>
<div class="n2-reel" id="reelbox">
<video playsinline preload="metadata"${cover ? ` poster="${attr(cover)}"` : ""} src="${attr(video)}" aria-label="The reel for Qur'an ${attr(ref.label)}"></video>
<button class="n2-play" type="button" aria-label="Play the reel"><span>${SVG.play}</span></button>
</div>
<p class="n2-credit">The recitation alone, nothing under it</p>
</section>` : "";
  const textBlock = texts.length
    ? `<p class="n2-quran" lang="ar" translate="no">${texts.map(t => esc(t.ar)).join(" ")}</p>
<p class="n2-ref">Qur'an ${esc(ref.label)}${name ? " · " + esc(name) : ""}</p>
<p class="n2-meaning">${texts.map(t => `<span class="n2-s">${esc(t.en)}</span>`).join("")}</p>
<p class="n2-credit">Saheeh International</p>`
    : `<p class="n2-ref">Qur'an ${esc(ref.label)}${name ? " · " + esc(name) : ""}</p>
<p class="n2-p">The text of this verse, in the Uthmani script with its meaning, is on the Mushaf.</p>
${reciter ? `<p class="n2-credit">Recited by ${esc(reciter)}</p>` : ""}`;
  const words = relatedWords((row && row.caption ? row.caption : "") + " " + english);
  const others = (await verseRows()).filter(r => r.ref && r.ref.split(":")[0] === String(ref.s) && r.id !== "verse-" + ref.id).slice(0, 8);
  const body = `<section class="n2-idea">
<p class="n2-eyebrow">One verse${name ? ` <small>· ${esc(name)}</small>` : ""}</p>
${textBlock}
<div class="n2-row">${row ? go("#reel", "The reel", true) : ""}${go(mushaf, "The Mushaf", !row)}${shareBtn(shareText, SITE + url)}</div>
</section>
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
    desc: english ? clip(english, 158) : "Qur'an " + ref.label + " on the Mushaf, with its recitation.",
    active: "/quran", crumbs: [["The verses", "/verses"], ["Qur'an " + ref.label, url]], pill: ["/verses", "The shelf"],
    image: cover && isUrl(cover) ? cover : (cover ? SITE + cover : ""),
    ld: [{ "@context": "https://schema.org", "@type": "CreativeWork", name: "Qur'an " + ref.label + (name ? " · " + name : ""), url: SITE + url,
      description: english ? clip(english, 200) : undefined, inLanguage: ["ar", "en"],
      isPartOf: { "@type": "Book", name: name ? "Surah " + name : "The Qur'an", url: SITE + "/surah/" + ref.s },
      ...(row ? { video: { "@type": "VideoObject", name: "Qur'an " + ref.label, description: english ? clip(english, 200) : "A verse of the Qur'an, recited.",
        contentUrl: isUrl(video) ? video : SITE + video, thumbnailUrl: cover ? (isUrl(cover) ? cover : SITE + cover) : OG_DEFAULT, uploadDate: MAN.written || undefined } } : {}) }],
    body, tail }) };
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
async function surahPage(nRaw) {
  const n = Number(nRaw);
  if (!(Number.isInteger(n) && n >= 1 && n <= 114)) return notFound("surah");
  const url = "/surah/" + n;
  const api = await surahMeta(n);
  const row = surahRow(n);
  const name = (api && api.englishName) || (row && row.translit) || ("Surah " + n);
  const ar = (api && api.name) || (row && row.name) || "";
  const meaning = api && api.englishNameTranslation || "";
  const count = (api && api.numberOfAyahs) || (row && row.count) || 0;
  const place = (api && api.revelationType) || (row && row.type) || "";
  const placeName = /mecc|makk/i.test(place) ? "Makkah" : (/medin|madin/i.test(place) ? "Madinah" : place);
  const S = study(n) || {};
  const verses = (await verseRows()).filter(r => +r.ref.split(":")[0] === n);
  const prevRow = n > 1 ? surahRow(n - 1) : null, nextRow = n < 114 ? surahRow(n + 1) : null;
  const body = `<section class="n2-idea">
<p class="n2-eyebrow">Surah ${n} of 114${placeName ? ` <small>· ${esc(placeName)}</small>` : ""}</p>
${ar ? `<p class="n2-title-ar" lang="ar">${esc(ar)}</p>` : ""}
<h1 class="n2-h1">${esc(name)}${meaning ? ` <span class="n2-g">${esc(meaning)}</span>` : ""}</h1>
<p class="n2-dim">${count ? count + " verses" : ""}${count && placeName ? " · " : ""}${placeName ? "revealed in " + esc(placeName) : ""}</p>
<div class="n2-row">${go("/quran?surah=" + n, "Read and listen", true)}${shareBtn("Surah " + name + (meaning ? " (" + meaning + ")" : "") + " · NOOR Codex of Light", SITE + url)}</div>
</section>
${(S.context || []).length ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The context</p>${S.context.map(p => `<p class="n2-p">${esc(p)}</p>`).join("")}</section>` : ""}
${S.name_story ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The name</p>${paras(esc(S.name_story))}</section>` : ""}
${(S.themes || []).length ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The themes</p>${S.themes.map(t => `<h2 class="n2-h3">${esc(t.t)}</h2><p class="n2-p">${esc(t.d)}</p>`).join("")}</section>` : ""}
${(S.heart || []).length ? `<section class="n2-idea n2-short"><p class="n2-eyebrow">The heart of it</p>${S.heart.map(p => `<p class="n2-p">${esc(p)}</p>`).join("")}</section>` : ""}
<section class="n2-idea n2-short" id="beside">
<p class="n2-eyebrow">Read beside it</p>
${verses.length ? `<p class="n2-eyebrow">On the shelf</p><ul class="n2-list">${verses.map(r => `<li><a href="/verse/${attr(r.ref.replace(":", "-"))}"><span class="n2-num">${esc(r.ref)}</span><b>${esc(r.hook && r.hook !== r.ref ? r.hook : "Qur'an " + r.ref)}</b></a></li>`).join("")}</ul>` : ""}
${walk(prevRow && ["/surah/" + (n - 1), prevRow.translit, "Surah " + (n - 1)], nextRow && ["/surah/" + (n + 1), nextRow.translit, "Surah " + (n + 1)])}
<div class="n2-row">${go("/quran?surah=" + n, "The Mushaf")}${go("/verses", "Every verse on the shelf")}</div>
</section>`;
  const desc = clip((count ? count + " verses" : "") + (placeName ? ", revealed in " + placeName + ". " : ". ") + ((S.context || [])[0] || S.name_story || ""), 158);
  return { status: 200, html: shell({
    title: "Surah " + name + " (" + n + ")", path: url, desc, active: "/quran", crumbs: [["The Mushaf", "/quran"], ["Surah " + name, url]], pill: ["/quran", "The Mushaf"],
    ld: [{ "@context": "https://schema.org", "@type": "Chapter", name: "Surah " + name, alternateName: ar || undefined, position: n, url: SITE + url,
      description: desc, inLanguage: ["ar", "en"],
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
  const body = `<section class="n2-idea">
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
  return { status: 200, html: shell({
    title: isToday ? "Today's light" : "The light of " + longDate(date), path: url, ogType: "website",
    desc: card ? clip(card.title + ". " + card.story, 158) : "One Light, one word and one chapter of the Path, every day.",
    active: "/today", crumbs: [["Today", "/today"]],
    ld: [{ "@context": "https://schema.org", "@type": "WebPage", name: "Today's light", url: SITE + url, datePublished: date,
      description: card ? clip(card.story, 200) : undefined, inLanguage: "en" }],
    body }), cache };
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
