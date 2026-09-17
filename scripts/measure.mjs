// Runtime measurements for the NOOR Phase 1 performance, mobile and
// accessibility audit. Loads each page in Chromium (Playwright) twice: as a
// mid-range phone (390x844, DPR 3, touch, CPU throttled 4x) and as a desktop
// (1366x768). External hosts are unreachable from this box and are aborted at
// the network layer; they are counted as evidence of third-party dependence.
// Output: out/measurements.json (everything), measurements.csv (the summary
// the brief asks for), out/axe/<page>-<vp>.json and shots/*.png.
//   node scripts/measure.mjs [page-filter]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH = "/opt/pw-browsers";
const BASE = "http://127.0.0.1:8765";
const OUT = new URL("../out/", import.meta.url).pathname;
const SHOTS = new URL("../shots/", import.meta.url).pathname;
fs.mkdirSync(path.join(OUT, "axe"), { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });
const AXE = fs.readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const PAGES = [
  ["home", "/"],
  ["light-room", "/light/al-biruni-earth-radius"],
  ["light-shelf", "/light"],
  ["today", "/today"],
  ["word", "/dictionary/badr"],
  ["dictionary", "/dictionary"],
  ["surah-2", "/surah/2"],
  ["path-1", "/path/1"],
  ["path-shelf", "/path"],
  ["verse-2-255", "/verse/2-255"],
  ["verses-shelf", "/verses"],
  ["allah", "/allah"],
  ["muhammad", "/muhammad"],
  ["quran", "/quran"],
  ["heroes", "/heroes"],
  ["prophets", "/prophets"],
  ["hajj", "/hajj"],
  ["kids", "/kids"],
  ["kids-lanterns", "/kids/lanterns"],
  ["kids-star-catcher", "/kids/star-catcher"],
  ["kids-practice", "/kids/practice"],
  ["ask", "/ask"],
  ["mizan", "/mizan"],
  ["stories", "/stories"],
  ["masjid", "/masjid"],
  ["begin", "/begin"],
  ["ar-door", "/ar"],
  ["404", "/no-such-room"],
];
const filter = process.argv[2];

const VIEWPORTS = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, cpu: 4,
    userAgent: "Mozilla/5.0 (Linux; Android 10; Moto G (4)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36" },
  desktop: { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, cpu: 1 },
};

// installed before any page script: the observers the page cannot install for us
const INIT = `
(() => {
  const P = window.__perf = { long: [], lcp: null, cls: 0, clsEntries: 0, fcp: null, raf: 0, rafT0: 0 };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: "longtask", buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => { const es = l.getEntries(); const e = es[es.length - 1]; P.lcp = { t: Math.round(e.renderTime || e.loadTime || e.startTime), size: e.size, tag: e.element ? (e.element.tagName + (e.element.className ? "." + String(e.element.className).split(" ")[0] : "")) : "", url: e.url || "" }; }).observe({ type: "largest-contentful-paint", buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) { P.cls += e.value; P.clsEntries++; } }).observe({ type: "layout-shift", buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === "first-contentful-paint") P.fcp = Math.round(e.startTime); }).observe({ type: "paint", buffered: true }); } catch (e) {}
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) { P.raf++; return raf(cb); };
})();`;

const CHECKS = `
(() => {
  const vw = innerWidth, vh = innerHeight, de = document.documentElement;
  const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const sel = e => { let s = e.tagName.toLowerCase(); if (e.id) s += "#" + e.id; else if (e.className && typeof e.className === "string") s += "." + e.className.trim().split(/\\s+/).slice(0, 2).join("."); return s; };
  // 1. horizontal overflow
  const overflow = Math.max(0, de.scrollWidth - vw, document.body ? document.body.scrollWidth - vw : 0);
  const wide = [];
  if (overflow > 0) for (const e of document.querySelectorAll("body *")) { const r = e.getBoundingClientRect(); if (r.right > vw + 1 && r.width > 0 && getComputedStyle(e).position !== "fixed") { wide.push(sel(e) + " right=" + Math.round(r.right) + " w=" + Math.round(r.width)); if (wide.length >= 8) break; } }
  // 2. tap targets
  const inter = [...document.querySelectorAll("a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=link],[tabindex]:not([tabindex='-1'])")].filter(vis);
  const small24 = [], small44 = [];
  for (const e of inter) { const r = e.getBoundingClientRect(); const m = Math.min(r.width, r.height); if (m < 24) small24.push(sel(e) + " " + Math.round(r.width) + "x" + Math.round(r.height) + " '" + (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30) + "'"); else if (m < 44) small44.push(sel(e) + " " + Math.round(r.width) + "x" + Math.round(r.height)); }
  // 3. small text, weighted by characters
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let chars = 0, under14 = 0, under12 = 0; const samples14 = new Map(), samples12 = new Map();
  while (walker.nextNode()) { const n = walker.currentNode; const t = n.textContent.trim(); if (!t) continue; const p = n.parentElement; if (!p || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(p.tagName)) continue; if (!vis(p)) continue; const fs = parseFloat(getComputedStyle(p).fontSize); chars += t.length; if (fs < 14) { under14 += t.length; const k = sel(p) + " " + fs + "px"; if (!samples14.has(k)) samples14.set(k, t.slice(0, 40)); } if (fs < 12) { under12 += t.length; const k = sel(p) + " " + fs + "px"; if (!samples12.has(k)) samples12.set(k, t.slice(0, 40)); } }
  // 4. fixed elements
  const fixed = [...document.querySelectorAll("body *")].filter(e => getComputedStyle(e).position === "fixed" && vis(e)).map(e => { const r = e.getBoundingClientRect(); return { s: sel(e), top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) }; });
  const bar = document.querySelector(".n2-bar"); let barCover = null;
  if (bar) { const br = bar.getBoundingClientRect(); const pb = parseFloat(getComputedStyle(document.body).paddingBottom); barCover = { barH: Math.round(br.height), barTop: Math.round(br.top), bodyPadBottom: Math.round(pb), safeAreaCSS: getComputedStyle(de).getPropertyValue("--n2-bar-h").trim() }; }
  // 5. viewport meta, lang, landmarks, headings
  const vm = document.querySelector("meta[name=viewport]");
  const heads = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(vis).map(h => +h.tagName[1]);
  let skips = 0; for (let i = 1; i < heads.length; i++) if (heads[i] > heads[i - 1] + 1) skips++;
  const lm = { main: document.querySelectorAll("main,[role=main]").length, nav: document.querySelectorAll("nav,[role=navigation]").length, header: document.querySelectorAll("header,[role=banner]").length, footer: document.querySelectorAll("footer,[role=contentinfo]").length, h1: document.querySelectorAll("h1").length, skipLink: !!document.querySelector("a[href^='#'][class*=skip],a[href='#main'],a[href='#content']") };
  const imgs = [...document.querySelectorAll("img")]; const noAlt = imgs.filter(i => !i.hasAttribute("alt")).length; const lazy = imgs.filter(i => i.loading === "lazy").length;
  const arabicNoLang = [...document.querySelectorAll("body *")].filter(e => e.children.length === 0 && /[\\u0600-\\u06FF]{3,}/.test(e.textContent || "") && !e.closest("[lang^=ar],[lang=fa],[lang=ur],[lang=ps],[lang=prs],[lang=pa]") && vis(e)).length;
  const dialogs = [...document.querySelectorAll("[role=dialog],dialog")].map(d => ({ s: sel(d), modal: d.getAttribute("aria-modal"), labelled: !!(d.getAttribute("aria-label") || d.getAttribute("aria-labelledby")) }));
  const anims = (document.getAnimations ? document.getAnimations() : []).filter(a => a.playState === "running").length;
  return { overflow, wide, interactive: inter.length, small24: small24.length, small24s: small24.slice(0, 12), small44: small44.length, small44s: small44.slice(0, 6), chars, under14, under12, samples14: [...samples14].slice(0, 12), samples12: [...samples12].slice(0, 12), fixed, barCover, viewport: vm ? vm.content : null, lang: de.lang, dir: de.dir, heads, headingSkips: skips, lm, imgs: imgs.length, noAlt, lazy, arabicNoLang, dialogs, anims, nodes: document.getElementsByTagName("*").length, fonts: [...document.fonts].filter(f => f.status === "loaded").map(f => f.family + " " + f.weight).slice(0, 12), fontsLoading: [...document.fonts].filter(f => f.status === "loading").length };
})()`;

const SCROLL = `
(async () => {
  const P = window.__perf; const frames = []; let last = performance.now(); let stop = false;
  const tick = t => { frames.push(t - last); last = t; if (!stop) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const long0 = P.long.length; const H = document.documentElement.scrollHeight - innerHeight;
  const steps = 12; const t0 = performance.now();
  for (let i = 1; i <= steps; i++) { scrollTo({ top: Math.round(H * i / steps), behavior: "auto" }); await new Promise(r => setTimeout(r, 250)); }
  await new Promise(r => setTimeout(r, 400)); stop = true;
  const dur = performance.now() - t0; const longs = P.long.slice(long0);
  frames.shift();
  const dropped = frames.filter(f => f > 50).length, worst = Math.round(Math.max(0, ...frames)), avg = frames.length ? Math.round(frames.reduce((a, b) => a + b, 0) / frames.length * 10) / 10 : 0;
  return { scrollMs: Math.round(dur), frames: frames.length, avgFrameMs: avg, worstFrameMs: worst, framesOver50: dropped, framesOver100: frames.filter(f => f > 100).length, longDuringScrollMs: longs.reduce((a, b) => a + b[1], 0), longDuringScroll: longs.length, scrollH: H };
})()`;

async function run(browser, name, url, vpName, vp) {
  const ctx = await browser.newContext({ viewport: vp.viewport, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch, userAgent: vp.userAgent, serviceWorkers: "block", locale: "en-GB" });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  const reqs = []; const external = new Map(); let apiCalls = [];
  await page.route("**/*", route => {
    const u = new URL(route.request().url());
    if (u.hostname !== "127.0.0.1") { external.set(u.hostname, (external.get(u.hostname) || 0) + 1); reqs.push({ url: u.href, type: route.request().resourceType(), blocked: true }); return route.abort("connectionfailed"); }
    if (u.pathname.startsWith("/api/")) apiCalls.push(u.pathname + u.search);
    route.continue();
  });
  page.on("response", async r => { const u = new URL(r.url()); if (u.hostname !== "127.0.0.1") return; const h = r.headers(); reqs.push({ url: u.pathname + u.search, type: r.request().resourceType(), status: r.status(), bytes: +(h["content-length"] || 0), raw: +(h["x-raw-bytes"] || h["content-length"] || 0), cache: h["cache-control"] || "" }); });
  const errors = []; page.on("pageerror", e => errors.push(String(e.message).slice(0, 160))); page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160)); });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Performance.enable");
  if (vp.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: vp.cpu });
  const t0 = Date.now();
  let nav;
  try { nav = await page.goto(BASE + url, { waitUntil: "load", timeout: 60000 }); } catch (e) { errors.push("goto: " + e.message.slice(0, 100)); }
  try { await page.waitForLoadState("networkidle", { timeout: 15000 }); } catch (e) {}
  await page.waitForTimeout(2500); // the arrivals: .9s fade after up to .8s delay, plus the deferred loaders
  const wall = Date.now() - t0;
  const timing = await page.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return n ? { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), ttfb: Math.round(n.responseStart) } : {}; });
  const perf = await page.evaluate("window.__perf");
  const rt = await page.evaluate(() => performance.getEntriesByType("resource").map(r => ({ n: new URL(r.name).pathname.slice(0, 60), t: r.initiatorType, enc: r.encodedBodySize, dec: r.decodedBodySize, dur: Math.round(r.duration), rb: r.renderBlockingStatus || "" })));
  const metrics = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));
  const checks = await page.evaluate(CHECKS);
  // 360 px overflow check on mobile
  let overflow360 = null;
  if (vpName === "mobile") { await page.setViewportSize({ width: 360, height: 780 }); await page.waitForTimeout(300); overflow360 = await page.evaluate(() => { const de = document.documentElement; const vw = innerWidth; const o = Math.max(0, de.scrollWidth - vw, document.body.scrollWidth - vw); const w = []; if (o > 0) for (const e of document.querySelectorAll("body *")) { const r = e.getBoundingClientRect(); if (r.right > vw + 1 && r.width > 0 && getComputedStyle(e).position !== "fixed") { w.push(e.tagName.toLowerCase() + (e.id ? "#" + e.id : e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : "") + " right=" + Math.round(r.right)); if (w.length >= 6) break; } } return { o, w }; }); if (overflow360.o > 0) await page.screenshot({ path: path.join(SHOTS, `${name}-360-overflow.png`), fullPage: false }); await page.setViewportSize(vp.viewport); await page.waitForTimeout(300); }
  if (vpName === "mobile" && checks.overflow > 0) await page.screenshot({ path: path.join(SHOTS, `${name}-390-overflow.png`), fullPage: false });
  // axe
  let axe = null;
  try {
    await page.addScriptTag({ content: AXE });
    axe = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] }, resultTypes: ["violations"] }); return { violations: r.violations.map(v => ({ id: v.id, impact: v.impact, tags: v.tags.filter(t => /wcag|best/.test(t)), help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map(n => ({ target: n.target.join(" ").slice(0, 120), summary: (n.failureSummary || "").slice(0, 220) })) })), passes: r.passes ? r.passes.length : 0 }; });
    fs.writeFileSync(path.join(OUT, "axe", `${name}-${vpName}.json`), JSON.stringify(axe, null, 1));
  } catch (e) { errors.push("axe: " + e.message.slice(0, 120)); }
  if (vpName === "mobile" && axe && axe.violations.some(v => v.id === "color-contrast" && v.nodes > 0)) { try { await page.screenshot({ path: path.join(SHOTS, `${name}-contrast.png`), fullPage: false }); } catch (e) {} }
  // scroll test
  let scroll = null; try { scroll = await page.evaluate(SCROLL); } catch (e) { errors.push("scroll: " + e.message.slice(0, 100)); }
  const perf2 = await page.evaluate("window.__perf");
  const metrics2 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));
  await ctx.close();
  const own = reqs.filter(r => !r.blocked);
  const bytes = own.reduce((a, r) => a + (r.bytes || 0), 0), raw = own.reduce((a, r) => a + (r.raw || 0), 0);
  const byType = {}; for (const r of own) { byType[r.type] = byType[r.type] || { n: 0, b: 0 }; byType[r.type].n++; byType[r.type].b += r.bytes || 0; }
  const longMs = perf.long.reduce((a, b) => a + b[1], 0), tbt = perf.long.reduce((a, b) => a + Math.max(0, b[1] - 50), 0);
  return { page: name, url, vp: vpName, status: nav ? nav.status() : null, wallMs: wall, timing, fcp: perf.fcp, lcp: perf.lcp, cls: Math.round(perf.cls * 1000) / 1000, clsEntries: perf.clsEntries,
    longTasks: perf.long.length, longMs, longest: Math.max(0, ...perf.long.map(x => x[1])), tbt, longList: perf.long.slice(0, 20), rafAtSettle: perf.raf,
    cdp: { script: Math.round(metrics.ScriptDuration * 1000), layout: Math.round(metrics.LayoutDuration * 1000), style: Math.round(metrics.RecalcStyleDuration * 1000), task: Math.round(metrics.TaskDuration * 1000), heapMB: Math.round(metrics.JSHeapUsedSize / 1048576 * 10) / 10, nodes: metrics.Nodes, layoutCount: metrics.LayoutCount, styleCount: metrics.RecalcStyleCount },
    cdpAfterScroll: { script: Math.round(metrics2.ScriptDuration * 1000), layout: Math.round(metrics2.LayoutDuration * 1000), style: Math.round(metrics2.RecalcStyleDuration * 1000), task: Math.round(metrics2.TaskDuration * 1000) },
    requests: own.length, bytes, raw, byType, external: Object.fromEntries(external), externalN: [...external.values()].reduce((a, b) => a + b, 0), apiCalls, resources: rt, checks, overflow360, axe: axe ? { serious: axe.violations.filter(v => v.impact === "serious" || v.impact === "critical").reduce((a, v) => a + v.nodes, 0), rules: axe.violations.map(v => v.id + ":" + v.impact + ":" + v.nodes), violations: axe.violations } : null, scroll, longAfterScroll: perf2.long.length, rafAfter: perf2.raf, errors };
}

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const results = [];
const outFile = path.join(OUT, "measurements.json");
for (const [name, url] of PAGES) {
  if (filter && !name.includes(filter)) continue;
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    try {
      const r = await run(browser, name, url, vpName, vp);
      results.push(r);
      console.log(`${name.padEnd(18)} ${vpName.padEnd(7)} req=${String(r.requests).padStart(3)} gz=${String(Math.round(r.bytes / 1024)).padStart(5)}KB raw=${String(Math.round(r.raw / 1024)).padStart(5)}KB ext=${r.externalN} lcp=${r.lcp ? r.lcp.t : "-"} cls=${r.cls} long=${r.longTasks}/${r.longMs}ms tbt=${r.tbt} script=${r.cdp.script}ms ovf=${r.checks.overflow}/${r.overflow360 ? r.overflow360.o : "-"} axeSC=${r.axe ? r.axe.serious : "-"} scroll>50=${r.scroll ? r.scroll.framesOver50 : "-"} err=${r.errors.length}`);
    } catch (e) { console.log(name, vpName, "FAILED", e.message); results.push({ page: name, url, vp: vpName, failed: e.message }); }
    fs.writeFileSync(outFile, JSON.stringify(results, null, 1));
  }
}
await browser.close();
// the CSV the brief asks for
const rows = [["page", "url", "viewport", "bytes_gzip", "bytes_raw", "requests", "external_requests_blocked", "lcp_ms", "fcp_ms", "cls", "long_tasks", "long_tasks_ms", "tbt_ms", "script_ms", "axe_violations_serious_or_worse", "horizontal_overflow_px_390", "horizontal_overflow_px_360", "tap_targets_under_24px", "text_chars_under_14px_pct", "scroll_frames_over_50ms"]];
for (const r of results) if (!r.failed) rows.push([r.page, r.url, r.vp, r.bytes, r.raw, r.requests, r.externalN, r.lcp ? r.lcp.t : "", r.fcp ?? "", r.cls, r.longTasks, r.longMs, r.tbt, r.cdp.script, r.axe ? r.axe.serious : "", r.checks.overflow, r.overflow360 ? r.overflow360.o : "", r.checks.small24, r.checks.chars ? Math.round(r.checks.under14 / r.checks.chars * 1000) / 10 : "", r.scroll ? r.scroll.framesOver50 : ""]);
fs.writeFileSync(path.join(OUT, "..", "measurements.csv"), rows.map(r => r.join(",")).join("\n") + "\n");
console.log("wrote", results.length, "runs");
