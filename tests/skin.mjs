/* The older rooms, dressed by the second cut's skin, looked at on a phone.
   Serves the working tree with python's http.server, opens the Mushaf, the
   Names, the Kids' Codex and the Prophets at an iPhone 13's size in
   headless Chromium (the dictionary and its words are shell pages now, and
   are checked only for not being dressed twice), and checks what
   noor-fx.js and NOOR2.inject() promise: the bar of five doors is there
   and every door can be tapped; nothing of the page's own fixed furniture
   is covered by the bar or covers it (the Kids' sound button is lifted
   above it); nothing scrolls sideways; the page's last line clears the bar;
   every room is read in the night now and a night page's header goes
   translucent night; the share sits in the footer (in ink on a light
   footer); the notice is hidden; the Mushaf's player, when it shows, sends
   the bar away and is usable, and the bar returns when it hides; a kids'
   game is left untouched; and no script throws. Screenshots go to
   tests/shots (or NOOR_SHOTS).

   Run:  node tests/skin.mjs */
import { chromium, devices } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
process.chdir(ROOT);
const OUT = process.env.NOOR_SHOTS || "tests/shots";
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS " + m); } else { fail++; console.log("  FAIL " + m); } };

/* a free port, then python's server on it */
const port = await new Promise(r => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
const srv = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const BASE = "http://127.0.0.1:" + port;
for (let i = 0; i < 50; i++) { try { const r = await fetch(BASE + "/robots.txt"); if (r.ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }

const PAGES = [
  ["quran", "/quran.html", "dark", "was parchment"],
  ["allah", "/allah.html", "dark"],
  ["kids", "/kids.html", "dark"],
  ["prophets", "/prophets.html", "dark", "was parchment"]
];
/* A night sheet answers what a room painted; it does not re-lay foundations.
   scripts/build-night.py reads assets/tw.css among the rooms' shared styles,
   and Tailwind's preflight carries `*, ::before, ::after { border: 0 solid
   #e5e7eb }`. That grey is a neutral on an ink property, so the first build
   turned it over and emitted it back universally -- later in the cascade and
   equal in weight to every rule a room writes -- which reset `border` on
   every element in all 76 rooms and deleted every border in the house. It
   surfaced as two pixels of label overlap on one figure at one width. */
{
  const night = fs.readFileSync("assets/noor2-night.css", "utf8");
  const universal = [...night.matchAll(/(^|\n)([^{}\n]+)\{/g)]
    .map(m => m[2])
    .filter(sel => sel.split(",").some(one => /(^|[\s,>+~])\*(?![-\w])/.test(one.trim())));
  ok(universal.length === 0, "the night speaks to no element in general, only to the ones the rooms painted" +
     (universal.length ? " (" + universal[0].trim().slice(0, 60) + ")" : ""));
  ok(!/border\s*:\s*0/.test(night), "and it never resets a border to nothing");
}

const br = await chromium.launch();
const ctx = await br.newContext({ ...devices["iPhone 13"], locale: "en-GB" });
/* nothing leaves the machine: fonts and any other host are refused */
await ctx.route("**/*", route => { const u = new URL(route.request().url()); return u.hostname === "127.0.0.1" ? route.continue() : route.abort(); });

const measure = () => {
  const vw = innerWidth, vh = innerHeight, H = document.documentElement;
  const nav = document.querySelector(".n2-bar"), bar = nav && nav.getBoundingClientRect();
  const doors = nav ? [...nav.querySelectorAll("a")].map(a => { const r = a.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { t: a.textContent.trim(), href: a.getAttribute("href"), h: r.height, reach: !!hit && (hit === a || a.contains(hit)) }; }) : [];
  /* the page's own fixed furniture that is visible and touches the bar's band */
  const fixed = [...document.querySelectorAll("body *")].filter(e => { const s = getComputedStyle(e); return s.position === "fixed" && s.display !== "none" && s.visibility !== "hidden" && +s.opacity > .05; })
    .filter(e => !(e.closest(".n2-bar,.n2-toast,.n2-sheet-wrap,.n2-dots")))
    .map(e => ({ e, r: e.getBoundingClientRect(), s: getComputedStyle(e) })).filter(x => x.r.height > 0 && x.r.width > 0 && x.r.top < vh && x.r.bottom > 0);
  const overlap = bar ? fixed.filter(x => x.r.bottom > bar.top + 1 && x.r.top < bar.bottom - 1 && +x.s.zIndex >= 0 && x.r.width < vw * .8).map(x => (x.e.id ? "#" + x.e.id : x.e.className)) : [];
  const share = document.querySelector("footer [data-n2-share]"), footBg = share ? getComputedStyle(share.closest("footer")).backgroundColor : "";
  const fm = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(footBg), footLight = !fm || (fm[4] !== undefined && +fm[4] < .5) ? true : (.2126 * fm[1] + .7152 * fm[2] + .0722 * fm[3]) / 255 >= .5;
  const header = document.getElementById("site-header");
  const notice = document.getElementById("noor-notice");
  return { vw, vh, sideways: H.scrollWidth > vw + 1, skin: H.classList.contains("n2-skin"), tone: H.classList.contains("n2-dark") ? "dark" : (H.classList.contains("n2-parch") ? "parch" : "none"),
    bar: !!nav, barBottom: bar ? bar.bottom : 0, barTop: bar ? bar.top : 0, doors, overlap, lifted: fixed.filter(x => x.e.n2lift).map(x => x.e.className),
    body: getComputedStyle(document.body).backgroundColor, pad: parseFloat(getComputedStyle(document.body).paddingBottom),
    share: !!share, shareInk: share ? getComputedStyle(share).color : "", shareH: share ? share.getBoundingClientRect().height : 0, footBg, footLight,
    headerBg: header ? getComputedStyle(header).backgroundColor : "", headerBlur: header ? (getComputedStyle(header).backdropFilter || getComputedStyle(header).webkitBackdropFilter) : "",
    notice: notice ? getComputedStyle(notice).display : "absent", away: nav ? nav.classList.contains("n2-away") : false,
    ease: nav ? getComputedStyle(nav).transitionTimingFunction : "" };
};

for (const [name, p, tone, was] of PAGES) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(BASE + p, { waitUntil: "load" });
  await page.waitForSelector(".n2-bar", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);
  /* a notice the owner may put across the top: hidden under the skin */
  await page.evaluate(() => { const n = document.createElement("div"); n.id = "noor-notice"; n.textContent = "A notice"; document.body.prepend(n); });
  const m = await page.evaluate(measure);
  console.log("\n=== " + p + " at " + m.vw + "x" + m.vh + " (" + m.body + ") ===");
  ok(errors.length === 0, "no script threw" + (errors.length ? " (" + errors[0] + ")" : ""));
  ok(m.skin && m.tone === tone, "the skin reads the page as " + tone + " (" + m.tone + ")");
  ok(m.bar && m.doors.map(d => d.t).join(",") === "Today,Qur'an,Story,Words,More", "the bar of five doors is there (" + m.doors.map(d => d.t).join(", ") + ")");
  ok(m.doors.length === 5 && m.doors.every(d => d.reach && d.h >= 46), "every door can be tapped, at 46 px or more");
  ok(Math.abs(m.barBottom - m.vh) < 1, "the bar sits on the bottom edge");
  ok(!m.sideways, "nothing scrolls sideways");
  ok(m.overlap.length === 0, "nothing of the page's own fixed furniture sits under the bar" + (m.overlap.length ? " (" + m.overlap.join(", ") + ")" : "") + (m.lifted.length ? " · lifted: " + m.lifted.join(", ") : ""));
  ok(m.pad >= m.vh - m.barTop - 1, "the page keeps room for the bar at its foot (" + Math.round(m.pad) + " px)");
  ok(m.share && m.shareH >= 46, "the share sits in the footer");
  ok(m.notice === "none", "the notice is hidden");
  ok(/linear\(|cubic-bezier/.test(m.ease), "the bar moves on the spring");
  if (was) {
    /* This used to hold the opposite -- "a parchment page stays parchment" --
       because the shell's night went to the arrival, the words and the
       generated rooms and left every room a person had written in the first
       cut's light, with a dark bar bolted underneath it. Two lights on one
       site, and the older one was on the rooms people came for. Now
       assets/noor2-night.css turns their own palette over (generated from
       their own styles by scripts/build-night.py), so the skin reads them as
       night pages of their own accord and there is one light in the house. */
    ok(/rgb\(10, 16, 36\)|rgb\(4, 6, 15\)/.test(m.body), "a room that was parchment is read in the night (" + m.body + ")");
    if (m.share) ok(/rgb\(255, 254, 247\)/.test(m.shareInk), "and the share in its footer wears parchment (" + m.shareInk + ")");
  }
  {
    if (m.headerBg) ok(/rgba\(4, 6, 15/.test(m.headerBg) && /blur/.test(m.headerBlur), "the night page's header is translucent night with a blur (" + m.headerBg + ")");
  }
  await page.screenshot({ path: path.join(OUT, "skin-" + name + ".png") });
  /* to the end, in steps: the long rooms grow as they are scrolled */
  for (let i = 0; i < 8; i++) {
    const more = await page.evaluate(() => { const h = document.documentElement.scrollHeight; scrollTo(0, h); return h; });
    await page.waitForTimeout(500);
    if (await page.evaluate(h => document.documentElement.scrollHeight === h && Math.abs(scrollY + innerHeight - h) < 2, more)) break;
  }
  const tail = await page.evaluate(() => {
    const bar = document.querySelector(".n2-bar").getBoundingClientRect();
    /* the last visible line of the page's last footer: its own box, or a
       child's that overflows it where the footer does not clip */
    const foots = [...document.querySelectorAll("footer")], foot = foots[foots.length - 1], fr = foot.getBoundingClientRect();
    const clip = getComputedStyle(foot).overflow === "hidden";
    const last = clip ? fr.bottom : [...foot.querySelectorAll("*")].map(e => e.getBoundingClientRect()).filter(r => r.height > 0 && r.top < fr.bottom + 200).reduce((a, r) => Math.max(a, r.bottom), fr.bottom);
    return { clear: last <= bar.top + 1, last: Math.round(last), barTop: Math.round(bar.top), end: Math.abs(scrollY + innerHeight - document.documentElement.scrollHeight) < 2 };
  });
  ok(tail.end && tail.clear, "at the end of the page the footer's last line clears the bar (" + tail.last + " ≤ " + tail.barTop + ")");
  await page.screenshot({ path: path.join(OUT, "skin-" + name + "-end.png") });

  if (name === "quran") {
    /* the player shows the way the page shows it; the bar steps away, the
       player is usable, and when the player hides the bar returns */
    await page.evaluate(() => scrollTo(0, 0));
    await page.evaluate(() => { document.getElementById("player").classList.add("show"); document.body.classList.add("has-player"); document.documentElement.style.setProperty("--ph", Math.round(document.getElementById("player").getBoundingClientRect().height) + "px"); });
    await page.waitForTimeout(900);
    const pl = await page.evaluate(() => {
      const p = document.getElementById("player").getBoundingClientRect(), nav = document.querySelector(".n2-bar"), b = nav.getBoundingClientRect();
      const btn = document.querySelector("#player .pbtn.main") || document.querySelector("#player button"); const r = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { away: nav.classList.contains("n2-away"), barOff: b.top >= innerHeight - 1, playerOn: p.bottom <= innerHeight + 1 && p.top < innerHeight, usable: !!hit && (hit === btn || btn.contains(hit)), pad: parseFloat(getComputedStyle(document.body).paddingBottom), ph: p.height };
    });
    ok(pl.away && pl.barOff && pl.playerOn, "the Mushaf's player sends the bar away while it shows");
    ok(pl.usable, "the player's play button is on top and can be pressed");
    ok(pl.pad >= pl.ph - 1, "the page's own room for the player stands (" + Math.round(pl.pad) + " px for a " + Math.round(pl.ph) + " px player)");
    await page.screenshot({ path: path.join(OUT, "skin-quran-player.png") });
    await page.evaluate(() => { document.getElementById("player").classList.remove("show"); document.body.classList.remove("has-player"); document.documentElement.style.setProperty("--ph", "0px"); });
    await page.waitForTimeout(900);
    const back = await page.evaluate(() => { const nav = document.querySelector(".n2-bar"); return !nav.classList.contains("n2-away") && Math.abs(nav.getBoundingClientRect().bottom - innerHeight) < 1; });
    ok(back, "and comes back when the player hides");
  }
  if (name === "kids") ok(m.lifted.some(c => /nk-sound/.test(c)), "the Kids' sound button is lifted above the bar");
  await page.close();
}

console.log("\n=== a kids' game keeps its own screen ===");
{
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(BASE + "/kids/lanterns.html", { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const g = await page.evaluate(() => ({ bar: !!document.querySelector(".n2-bar"), skin: document.documentElement.classList.contains("n2-skin"), css: !![...document.styleSheets].find(s => /noor2/.test(s.href || "")), pad: getComputedStyle(document.body).paddingBottom }));
  ok(!g.bar && !g.skin && !g.css, "the Lantern Sky carries no bar, no skin, no shell stylesheet");
  ok(errors.length === 0, "no script threw" + (errors.length ? " (" + errors[0] + ")" : ""));
  await page.screenshot({ path: path.join(OUT, "skin-kids-game.png") });
  await page.close();
}

console.log("\n=== a page with its own shell is left to it ===");
for (const p of ["/index.html", "/dictionary.html", "/dictionary/salah.html"]) {
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(BASE + p, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const h = await page.evaluate(() => ({ n2: document.documentElement.hasAttribute("data-n2"), bars: document.querySelectorAll(".n2-bar").length, skin: document.documentElement.classList.contains("n2-skin"),
    skinCss: !![...document.styleSheets].find(s => /noor2-skin/.test(s.href || "")), shells: [...document.querySelectorAll('link[href*="noor2.css"],script[src*="noor2.js"]')].length,
    sideways: document.documentElement.scrollWidth > innerWidth + 1, doors: [...document.querySelectorAll(".n2-bar a")].map(a => a.textContent.trim()).join(",") }));
  ok(h.n2 && h.bars === 1 && !h.skin && !h.skinCss && h.shells === 2, p + ": one bar, no skin, the shell loaded once (" + h.bars + " bar, " + h.shells + " shell files)");
  ok(h.doors === "Today,Qur'an,Story,Words,More" && !h.sideways && errors.length === 0, p + ": the five doors, nothing sideways, no script threw" + (errors.length ? " (" + errors[0] + ")" : ""));
  await page.close();
}

await ctx.close(); await br.close(); srv.kill();
console.log("\nscreenshots in " + path.resolve(OUT));
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
