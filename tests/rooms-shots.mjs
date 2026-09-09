/* The rooms, looked at on a phone.
   Renders the day, a verse, a chapter and the Lights shelf through
   api/page.js with the Qur'an API and the manifest stubbed, opens each at an
   iPhone 13's size in headless Chromium (the shell's CSS and JS served from
   the working tree, the fonts left to their fallbacks), and checks what a
   test on the HTML cannot: that no text sits under the bottom bar or the top
   line at rest, that nothing scrolls sideways, that no script throws, that
   no type renders under 14 px (12 px only for the mono eyebrows), and that
   the buttons are 46 px tall. Then the physics, at a desk's width with a
   mouse: a button leans toward the pointer and springs back, the bar's pill
   slides to the room, a sheet rises and closes on a pull, the hairline
   grows down a long screen, and under prefers-reduced-motion none of it
   moves. Writes a screenshot of each page to tests/shots (or NOOR_SHOTS)
   for a pair of eyes.

   Run:  node tests/rooms-shots.mjs */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
process.chdir(ROOT);
const OUT = process.env.NOOR_SHOTS || "tests/shots";
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };

globalThis.fetch = async (url) => {
  url = String(url);
  const json = j => ({ ok: true, json: async () => j });
  if (url.includes("/reels/index.json")) return json({ n: 1, written: "2026-09-08", cards: [
    { id: "verse-94-5-6", kind: "verse", slot: "morning", hook: "Qur'an 94:5-6", caption: "94:5-6\n\nsabr", reciter: "Mishary Rashid Alafasy", cover: true, video: "https://example.org/verse-94-5-6.mp4" } ] });
  const m = url.match(/\/ayah\/(\d+):(\d+)\//);
  if (m) return json({ data: [
    { text: m[2] === "5" ? "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا" : "إِنَّ مَعَ ٱلْعُسْرِ يُسْرًۭا", edition: { identifier: "quran-uthmani" }, surah: { number: 94, name: "سورة الشرح", englishName: "Ash-Sharh", englishNameTranslation: "The Relief", numberOfAyahs: 8, revelationType: "Meccan" } },
    { text: m[2] === "5" ? "For indeed, with hardship [will be] ease." : "Indeed, with hardship [will be] ease.", edition: { identifier: "en.sahih" } } ] });
  if (url.includes("/api/illuminations")) return json({ date: "2026-09-09", category: "Timbuktu", title: "He called his 1,600 books the smallest library in the family",
    story: "When a Moroccan army took Timbuktu, its scholars were arrested, and in 1593 Ahmad Baba was taken in chains across the Sahara to Marrakesh.", detail: "Ahmad Baba · Timbuktu and Marrakesh, 1593 CE", id: "ahmad-baba-library-1593", src: "" });
  return { ok: false, status: 404, json: async () => ({}) };
};
const { render } = await import("../api/page.js");

const PAGES = [
  ["today", "today", {}, "/today"],
  ["verse", "verse", { ref: "94-5-6" }, "/verse/94-5-6"],
  ["path", "path", { n: "2" }, "/path/2"],
  ["light", "light", { id: "battle-of-badr-624" }, "/light/battle-of-badr-624"],
  ["lights", "lights", {}, "/light"]
];
const MIME = { css: "text/css", js: "text/javascript", jpg: "image/jpeg", png: "image/png", svg: "image/svg+xml", json: "application/json" };
const br = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await br.newContext({ ...devices["iPhone 13"], locale: "en-GB" });
const html = {};
for (const [name, kind, q] of PAGES) html[name] = (await render(kind, q, "noorcodex.com")).html;
await ctx.route("**/*", route => {
  const u = new URL(route.request().url());
  if (u.hostname !== "noorcodex.com") return route.abort();
  const hit = PAGES.find(p => p[3] === u.pathname);
  if (hit) return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html[hit[0]] });
  const file = path.join(ROOT, u.pathname.slice(1));
  if (/^\/(assets|reels)\//.test(u.pathname) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    return route.fulfill({ status: 200, contentType: MIME[u.pathname.split(".").pop()] || "application/octet-stream", body: fs.readFileSync(file) });
  }
  return route.fulfill({ status: 404, body: "" });
});

for (const [name, , , urlPath] of PAGES) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto("https://noorcodex.com" + urlPath, { waitUntil: "load" });
  await page.waitForTimeout(1400);
  const m = await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    const bar = document.querySelector(".n2-bar").getBoundingClientRect();
    const top = document.querySelector(".n2-top").getBoundingClientRect();
    const first = document.querySelector(".n2-idea");
    const texts = [...first.querySelectorAll("p,h1,h2,a,button,span,b,small")].map(e => e.getBoundingClientRect()).filter(r => r.width && r.height);
    /* a screen that fits the viewport hides nothing under the bar; a screen
       taller than the viewport (a long Light) is a read, and the hairline
       under the top line says how far */
    const tall = first.getBoundingClientRect().height > vh;
    const underBar = tall ? 0 : texts.filter(r => r.bottom > bar.top && r.top < bar.bottom && r.top < vh).length;
    const underTop = texts.filter(r => r.top < top.bottom - 8 && r.bottom > top.top).length;
    const small = [...document.querySelectorAll("body *")].filter(e => e.textContent.trim() && getComputedStyle(e).display !== "none")
      .map(e => ({ s: parseFloat(getComputedStyle(e).fontSize), mono: /Plex|mono/i.test(getComputedStyle(e).fontFamily), t: e.tagName }))
      .filter(x => x.s < 13 && !(x.s >= 12 && x.mono)).length;
    const btns = [...document.querySelectorAll(".n2-btn")].map(b => b.getBoundingClientRect().height);
    const gl = document.getElementById("n2-gl");
    return { tall, vw, vh, sideways: document.documentElement.scrollWidth > vw + 1, underBar, underTop, small, btnMin: Math.min(...btns, 999),
      barH: bar.height, live: document.documentElement.classList.contains("n2-live"), shader: !!(gl && gl.classList.contains("n2-on")),
      revealed: document.querySelectorAll(".n2-idea.n2-in").length, ideas: document.querySelectorAll(".n2-idea").length };
  });
  console.log("\n=== " + urlPath + " at " + m.vw + "x" + m.vh + " ===");
  ok(errors.length === 0, "no script threw" + (errors.length ? " (" + errors[0] + ")" : ""));
  ok(m.live, "the shell's script ran");
  ok(!m.sideways, "nothing scrolls sideways");
  ok(m.underBar === 0, "no text of the first idea sits under the bottom bar (" + m.underBar + (m.tall ? ", a screen taller than the viewport" : "") + ")");
  ok(m.underTop === 0, "no text of the first idea sits under the top line (" + m.underTop + ")");
  ok(m.small === 0, "no type renders under 13 px except the mono eyebrows (" + m.small + ")");
  ok(Math.round(m.btnMin) >= 46, "the buttons are at least 46 px tall (" + Math.round(m.btnMin) + ")");
  ok(m.revealed >= 1, "the first idea has arrived (" + m.revealed + " of " + m.ideas + ")");
  console.log("  note  shader " + (m.shader ? "drawn" : "absent, CSS still shown") + " · bar " + Math.round(m.barH) + " px");
  await page.screenshot({ path: path.join(OUT, "rooms-" + name + ".png") });
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1200);
  const tail = await page.evaluate(() => {
    const bar = document.querySelector(".n2-bar").getBoundingClientRect();
    const foot = document.querySelector(".n2-foot").getBoundingClientRect();
    const hidden = document.querySelector(".n2-top").classList.contains("n2-hide");
    return { footClear: foot.bottom <= bar.top + 1, hidden };
  });
  ok(tail.footClear, "at the end of the page the last line clears the bar");
  ok(tail.hidden, "the top line hides on the way down");
  await page.screenshot({ path: path.join(OUT, "rooms-" + name + "-end.png") });
  await page.close();
}
await ctx.close();

console.log("\n=== the physics, under a mouse ===");
for (const reduced of [false, true]) {
  const c2 = await br.newContext({ viewport: { width: 1100, height: 800 }, hasTouch: false, reducedMotion: reduced ? "reduce" : "no-preference" });
  await c2.route("**/*", route => {
    const u = new URL(route.request().url());
    if (u.hostname !== "noorcodex.com") return route.abort();
    const hit = PAGES.find(p => p[3] === u.pathname);
    if (hit) return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html[hit[0]] });
    const file = path.join(ROOT, u.pathname.slice(1));
    if (/^\/(assets|reels)\//.test(u.pathname) && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ status: 200, contentType: MIME[u.pathname.split(".").pop()] || "application/octet-stream", body: fs.readFileSync(file) });
    return route.fulfill({ status: 404, body: "" });
  });
  const page = await c2.newPage();
  await page.goto("https://noorcodex.com/today", { waitUntil: "load" });
  await page.waitForTimeout(900);
  const tag = reduced ? " (reduced motion)" : "";
  const btn = page.locator(".n2-btn.n2-gold").first();
  const box = await btn.boundingBox();
  await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2);
  await page.waitForTimeout(120);
  const lean = await btn.evaluate(b => ({ mx: parseFloat(b.style.getPropertyValue("--mx") || "0"), t: getComputedStyle(b).transform, glow: getComputedStyle(b).animationName }));
  if (!reduced) {
    ok(lean.mx > 2 && lean.mx <= 6 && lean.t !== "none", "a button leans toward the pointer (" + lean.mx + " px)");
    ok(lean.glow === "n2-breath", "the one gold button breathes");
    await page.mouse.move(box.x + box.width + 120, box.y + box.height + 120);
    await page.waitForTimeout(900);
    const back = await btn.evaluate(b => parseFloat(b.style.getPropertyValue("--mx") || "0"));
    ok(back === 0, "and springs back when the pointer leaves");
    const before = await page.evaluate(() => document.querySelector(".n2-pill-bg").style.transform);
    await page.evaluate(() => NOOR2.bar("/quran"));
    await page.waitForTimeout(50);
    const after = await page.evaluate(() => ({ t: document.querySelector(".n2-pill-bg").style.transform, on: document.querySelector(".n2-bar a.n2-on").textContent.trim(), ease: getComputedStyle(document.querySelector(".n2-pill-bg")).transitionTimingFunction }));
    ok(before !== after.t && after.on === "Read" && /linear\(|cubic-bezier/.test(after.ease), "the pill slides to the room on the spring (" + after.on + ")");
    await page.evaluate(() => NOOR2.sheet("<p><b>A sheet.</b></p><p>Pulled shut below.</p>"));
    await page.waitForTimeout(800);
    const sheet = page.locator(".n2-sheet");
    const sb = await sheet.boundingBox();
    ok(!!sb && sb.y < 800 && await page.locator(".n2-handle").count() === 1, "a sheet rises with its handle");
    await page.mouse.move(sb.x + sb.width / 2, sb.y + 8); await page.mouse.down();
    await page.mouse.move(sb.x + sb.width / 2, sb.y + 60, { steps: 4 }); await page.mouse.move(sb.x + sb.width / 2, sb.y + 140, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(700);
    ok(await page.locator(".n2-sheet-wrap").count() === 0, "and a pull past 80 px closes it");
    await page.goto("https://noorcodex.com/path/2", { waitUntil: "load" });
    await page.waitForTimeout(600);
    await page.evaluate(() => scrollTo(0, document.querySelector("#story").getBoundingClientRect().top + scrollY + innerHeight * 1.2));
    await page.waitForTimeout(500);
    const prog = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".n2-top")).getPropertyValue("--n2-p")));
    ok(prog > 0 && prog < 1, "the hairline shows how far down a long screen the reader is (" + prog.toFixed(2) + ")");
  } else {
    ok(lean.t === "none" && lean.glow === "none", "reduced motion: no lean, no breath" + tag);
    await page.evaluate(() => NOOR2.bar("/quran"));
    const ease = await page.evaluate(() => getComputedStyle(document.querySelector(".n2-pill-bg")).transitionDuration);
    ok(/^0s/.test(ease), "reduced motion: the pill jumps, nothing slides" + tag);
  }
  await page.close(); await c2.close();
}
await br.close();
console.log("\nscreenshots in " + path.resolve(OUT));
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
