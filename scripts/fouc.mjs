// On the older rooms the night is put on by noor-fx.js after the page has
// painted: sample the body's computed background and the presence of the
// shell's header every 50 ms to see what a reader sees first.
import { chromium } from "playwright";
process.env.PLAYWRIGHT_BROWSERS_PATH = "/opt/pw-browsers";
const INIT = `(() => { window.__f = []; const iv = setInterval(() => { const b = document.body; if (!b) return; const cs = getComputedStyle(b); window.__f.push([Math.round(performance.now()), cs.backgroundColor, document.documentElement.classList.contains("n2-night") ? 1 : 0, !!document.querySelector("header.n2-top") ? 1 : 0, (document.getElementById("site-header") && getComputedStyle(document.getElementById("site-header")).display !== "none") ? 1 : 0]); if (performance.now() > 6000) clearInterval(iv); }, 50); })();`;
const b = await chromium.launch();
for (const u of ["/hajj", "/quran", "/heroes", "/prophets", "/begin", "/dictionary", "/kids"]) for (const [vp, cpu] of [["desktop", 1], ["mobile4x", 4]]) {
  const ctx = await b.newContext(vp === "desktop" ? { viewport: { width: 1366, height: 768 } } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); await p.addInitScript(INIT);
  await p.route("**/*", r => new URL(r.request().url()).hostname !== "127.0.0.1" ? r.abort() : r.continue());
  const cdp = await ctx.newCDPSession(p); if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  await p.goto("http://127.0.0.1:8765" + u, { waitUntil: "load" }); await p.waitForTimeout(4500);
  const f = await p.evaluate("window.__f");
  const runs = []; for (const s of f) { const k = s.slice(1).join("|"); const last = runs[runs.length - 1]; if (last && last.k === k) last.to = s[0]; else runs.push({ k, from: s[0], to: s[0] }); }
  console.log(u.padEnd(12), vp.padEnd(9), runs.map(r => `[${r.from}-${r.to}] bg=${r.k.split("|")[0].replace("rgb", "")} night=${r.k.split("|")[1]} n2top=${r.k.split("|")[2]} oldHeaderShown=${r.k.split("|")[3]}`).join("  "));
  await ctx.close();
}
await b.close();
