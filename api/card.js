// The picture that goes out with the day's light.
//
// One square card, drawn once as SVG and rasterised from that same drawing, so
// the preview in the console and the image on Instagram are provably the same
// picture rather than two drawings that agree today.
//
// THREE THINGS HERE WERE PAID FOR IN BLOOD
//
// 1. THIS FILE MAY NOT USE `import.meta`. IT WILL CRASH IN PRODUCTION.
//    package.json has no "type":"module", so Vercel compiles every route from
//    ESM to CommonJS at build time. It says so in the build log:
//      Warning: Node.js functions are compiled from ESM to CommonJS.
//    Almost everything survives that rewrite. `import.meta.url` cannot: there
//    is no import.meta in CommonJS, so the file dies at load with
//      SyntaxError: Cannot use 'import.meta' outside a module
//    and every path through the route 500s, including the ones that never
//    touch the code that used it. A first cut of this file called
//    createRequire(import.meta.url) to find the wasm rasteriser, and took the
//    whole card route down with it. Node printed a warning about exactly this
//    on every local test run and it was filtered out as noise.
//    tests/esm-cjs.mjs now compiles this file the way Vercel does and loads
//    the result, so the same mistake fails on a laptop instead of in public.
//
// 2. Instagram will not accept an SVG. This route used to try @vercel/og,
//    which was never a dependency, and served the SVG instead behind a header
//    nobody reads, so the PNG path had NEVER ONCE produced a PNG.
//
// 3. Font fallback is silent. On the first real render, "the birth of the
//    Prophet ﷺ, or the" came out as "the birth of the Prophet  , or the": an
//    empty gap, no error, no warning, no missing-glyph box. U+FDFA and U+FDFB
//    are the least reliably supported codepoints this project will touch, and
//    a broken one on a card about the Prophet, peace be upon him, is not an
//    ordinary bug. So the honorific is SPELLED OUT before the card is drawn,
//    the faces are carried in the repository, system fonts are switched off
//    entirely, and anything outside the faces' coverage is reported rather
//    than dropped.
//
//    The caption is different and deliberately so: it is text, not a picture,
//    and Facebook and Instagram both draw ﷺ correctly in a caption. It keeps
//    the honorific. Only the drawing spells it out.

import { chooseLight } from "./_lights.js";
import { planDay, buildSlot, SLOT_IDS } from "./_schedule.js";
import { ornament, motifFor } from "./_art.js";
import { REGULAR, BOLD, FAMILY, COVERAGE } from "./_cardfont.js";
import { fitSentences } from "./_prose.js";

/* The honorifics, written out for the drawing only. */
const HONORIFIC = [
  [/ﷺ/g, "(peace be upon him)"],
  [/ﷻ/g, "(glorified and exalted)"]
];

/* Everything the faces cannot draw, named rather than dropped. A card that
   trips this is a card that needs scripts/gen-card-fonts.py re-run, and
   tests/card.mjs fails the build long before it reaches a reader. */
export function drawable(text) {
  let out = String(text == null ? "" : text);
  for (const [re, w] of HONORIFIC) out = out.replace(re, w);
  const bad = [];
  out = [...out].map(ch => {
    if (ch === "\n" || COVERAGE.has(ch.codePointAt(0))) return ch;
    bad.push(ch); return "";
  }).join("");
  return { text: out.replace(/\s{2,}/g, " ").trim(), missing: [...new Set(bad)] };
}

const esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* a very small greedy wrapper: SVG has no text flow of its own */
function wrap(text, perLine, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > perLine) { lines.push(line.trim()); line = w; }
    else line = (line + " " + w).trim();
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line.trim());
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (words.join(" ").length > lines.join(" ").length) lines[maxLines - 1] = last.replace(/[,.;:]?$/, "") + "…";
  }
  return lines;
}

export function cardSVG(light, opts = {}) {
  const W = 1080, H = opts.story ? 1920 : 1080;
  const midY = H / 2;
  /* every string that will be drawn passes through drawable() first, so the
     honorific is spelled out and nothing silently disappears */
  const D = s => drawable(s).text;
  const title = wrap(D(light.title || ""), 26, 3);

  /* THE CARD HAS TO BE READABLE ON ITS OWN.
     It used to fill its box and stop at whatever word landed on the last line,
     so the first thing Noor ever posted ended "a British lawyer who…" -- a
     picture that teaches nothing and reads as careless on an account about a
     religion. Someone scrolling sees the picture and nothing else; the caption
     is not there to rescue it.
     So the card now takes as many WHOLE sentences as its box will hold. The
     caption carries the entire story, which is longer than this, and is
     therefore a real expansion of the card rather than a repetition of it. */
  const PER_LINE = 46, MAX_LINES = opts.story ? 12 : 8;
  const storyText = D(light.story || "");
  const whole = fitSentences(storyText, t => wrap(t, PER_LINE, MAX_LINES + 1).length <= MAX_LINES);
  /* If not even the first sentence fits, an ellipsis beats an empty card. */
  const body = wrap(whole || storyText, PER_LINE, MAX_LINES);
  const cat = D((light.category || "Light").toUpperCase());
  const det = D(light.detail || "");
  const titleY = midY - (title.length * 62) / 2 - (body.length * 21);

  /* THE ORNAMENT.
     Two drawings, both geometry, both a pure function of this card's own words
     so the same card is always drawn the same way and two cards are not drawn
     alike. The large one is a watermark and sits behind everything at an
     opacity that cannot compete with a sentence. The small one is the card's
     emblem, and it is fitted to the gap that actually exists between the
     eyebrow and the first line of the title -- measured, not guessed, so a
     three-line title with a long body can never have a drawing sitting on it. */
  const seed = light.id || light.title || "noor";
  const motif = light.motif || motifFor((light.title || "") + " " + (light.story || ""), seed);
  const gapTop = 172, gapBot = titleY - 46;
  const gap = gapBot - gapTop;
  const emblem = gap >= 92
    ? ornament(motif, { cx: W / 2, cy: gapTop + gap / 2,
        size: Math.min(104, gap * .82), seed, opacity: .5, width: 2.6 })
    : "";
  const wash = ornament(motif, { cx: W / 2, cy: opts.story ? H * .42 : midY,
    size: Math.min(W, H) * .62, seed, opacity: .06, width: 3.2 });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(light.title)}">
<defs>
  <linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${H}">
    <stop offset="0%" stop-color="#14100A"/><stop offset="55%" stop-color="#151b2e"/><stop offset="100%" stop-color="#1d2a45"/>
  </linearGradient>
  <radialGradient id="glow" cx="50%" cy="18%" r="60%">
    <stop offset="0%" stop-color="rgba(244,212,106,.22)"/><stop offset="100%" stop-color="rgba(244,212,106,0)"/>
  </radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
${wash}
<g opacity=".5" stroke="rgba(244,212,106,.35)" fill="none" stroke-width="2">
  <rect x="44" y="44" width="${W - 88}" height="${H - 88}" rx="34"/>
</g>
<text x="${W / 2}" y="150" text-anchor="middle" font-family="${FAMILY}"
      font-size="26" font-weight="800" letter-spacing="7" fill="rgba(244,212,106,.85)">${esc(cat)}</text>
${emblem}
${title.map((l, i) => `<text x="${W / 2}" y="${titleY + i * 62}" text-anchor="middle" font-family="${FAMILY}" font-size="54" font-weight="800" fill="#FFFEF7">${esc(l)}</text>`).join("\n")}
<line x1="${W / 2 - 60}" y1="${titleY + title.length * 62 + 6}" x2="${W / 2 + 60}" y2="${titleY + title.length * 62 + 6}" stroke="rgba(244,212,106,.6)" stroke-width="3" stroke-linecap="round"/>
${body.map((l, i) => `<text x="${W / 2}" y="${titleY + title.length * 62 + 74 + i * 42}" text-anchor="middle" font-family="${FAMILY}" font-size="30" fill="rgba(255,254,247,.86)">${esc(l)}</text>`).join("\n")}
<text x="${W / 2}" y="${H - 150}" text-anchor="middle" font-family="${FAMILY}"
      font-size="26" fill="rgba(255,254,247,.5)">${esc(det)}</text>
<text x="${W / 2}" y="${H - 88}" text-anchor="middle" font-family="${FAMILY}"
      font-size="30" font-weight="800" letter-spacing="4" fill="rgba(244,212,106,.9)">NOORCODEX.COM</text>
<text x="${W / 2}" y="${H - 52}" text-anchor="middle" font-family="${FAMILY}"
      font-size="22" fill="rgba(255,254,247,.38)">A free Islamic library. No ads, no trackers, no account.</text>
</svg>`;
}

/* ---------------------------------------------------------------------------
   the rasteriser

   resvg draws the same SVG the console previews. The native build is a plain
   import with no file to locate, which is the whole point after the
   import.meta crash: there is nothing here for the ESM to CommonJS rewrite to
   break. System fonts are OFF, so a missing glyph cannot quietly borrow a face
   from the build machine and look right here and wrong in production. The only
   faces in the world are the two carried in _cardfont.js.
--------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------
   the rasteriser, and the one thing that decides whether the card has words

   There are two resvg builds and THEY TAKE FONTS DIFFERENTLY. That single
   fact cost two blank deploys.

     @resvg/resvg-wasm  takes fontBuffers. Bytes. No filesystem involved.
     @resvg/resvg-js    (native) has fontFiles and fontDirs and NOTHING else.
                        It silently ignores fontBuffers.

   The native build drew perfectly on a laptop and produced a completely blank
   card on Vercel: border, gradient, gold rule, not one letter. Writing the
   faces to the function's /tmp and passing fontFiles did not save it either.
   Nothing threw. It returned a valid 1080 by 1080 PNG of nothing.

   So the WASM build goes first, because handing it bytes cannot fail for any
   environmental reason: no path, no write, no tracing, no permission. The
   native build stays as a fallback for the day the wasm binary is missing.

   The wasm binary is the one file that must be findable on disk, and Vercel's
   tracer does not follow it on its own. vercel.json pulls it into the bundle:
       "functions": { "api/card.js": { "includeFiles": "node_modules/@resvg/resvg-wasm/**" } }
   Take that out and the card goes blank again.
--------------------------------------------------------------------------- */
let RESVG = null, RESVG_KIND = "", RESVG_ERR = "";
export const rasteriserKind = () => RESVG_KIND;

async function wasmBinary() {
  const [{ default: fs }, { default: path }] = await Promise.all([import("fs"), import("path")]);
  const tries = [
    path.join(process.cwd(), "node_modules/@resvg/resvg-wasm/index_bg.wasm"),
    "/var/task/node_modules/@resvg/resvg-wasm/index_bg.wasm",
    path.join(process.cwd(), "api/node_modules/@resvg/resvg-wasm/index_bg.wasm")
  ];
  for (const p of tries) { try { if (fs.existsSync(p)) return fs.readFileSync(p); } catch { } }
  throw new Error("index_bg.wasm is not in the bundle (see vercel.json includeFiles)");
}

async function rasteriser() {
  if (RESVG) return RESVG;
  if (RESVG_ERR) throw new Error(RESVG_ERR);
  const tried = [];

  /* first: wasm, fed bytes, nothing to find on disk except the binary itself */
  try {
    const mod = await import("@resvg/resvg-wasm");
    await mod.initWasm(await wasmBinary());
    RESVG = mod.Resvg; RESVG_KIND = "wasm";
    return RESVG;
  } catch (e) { tried.push("wasm: " + String(e && e.message || e).slice(0, 90)); }

  /* second: the native build, which can only read faces from files */
  try {
    const mod = await import("@resvg/resvg-js");
    const R = mod.Resvg || (mod.default && mod.default.Resvg);
    if (!R) throw new Error("loaded without a Resvg export");
    RESVG = R; RESVG_KIND = "native";
    return RESVG;
  } catch (e) { tried.push("native: " + String(e && e.message || e).slice(0, 90)); }

  RESVG_ERR = tried.join(" \u00b7 ");
  throw new Error(RESVG_ERR);
}

/* The native build needs the faces as files, so they are written once to the
   function's own /tmp. The wasm build never looks at these. */
let FONT_FILES = null;
async function fontFiles() {
  if (FONT_FILES) return FONT_FILES;
  const [{ default: fs }, { default: os }, { default: path }] =
    await Promise.all([import("fs"), import("os"), import("path")]);
  const dir = path.join(os.tmpdir(), "noor-card-fonts");
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (const [name, buf] of [["regular.ttf", REGULAR], ["bold.ttf", BOLD]]) {
    const p = path.join(dir, name);
    if (!fs.existsSync(p) || fs.statSync(p).size !== buf.length) fs.writeFileSync(p, buf);
    files.push(p);
  }
  FONT_FILES = files;
  return files;
}

export async function cardPNG(svg, width = 1080) {
  const Resvg = await rasteriser();
  const font = {
    loadSystemFonts: false,          /* nothing may quietly stand in for our faces */
    defaultFontFamily: FAMILY,
    sansSerifFamily: FAMILY, serifFamily: FAMILY, monospaceFamily: FAMILY
  };
  if (RESVG_KIND === "wasm") font.fontBuffers = [REGULAR, BOLD];
  else { const files = await fontFiles(); font.fontFiles = files; font.fontDirs = [files[0].replace(/[\\/][^\\/]+$/, "")]; }
  const r = new Resvg(svg, { fitTo: { mode: "width", value: width }, font });
  return Buffer.from(r.render().asPng());
}

/* What the renderer actually saw, so a blank card never again has to be
   diagnosed by guesswork. /api/card?debug=1 */
export async function fontReport() {
  const out = { family: FAMILY, regularBytes: REGULAR.length, boldBytes: BOLD.length,
                isBuffer: Buffer.isBuffer(REGULAR), coverage: COVERAGE.size, cwd: process.cwd() };
  try { await rasteriser(); out.renderer = RESVG_KIND; }
  catch (e) { out.renderer = "NONE"; out.rendererError = String(e && e.message || e); }
  try {
    const { default: fs } = await import("fs");
    out.files = (await fontFiles()).map(p => p + " = " + (fs.existsSync(p) ? fs.statSync(p).size + " bytes" : "MISSING"));
  } catch (e) { out.files = "could not be written: " + String(e && e.message || e); }
  try {
    const svg = cardSVG({ title: "Test", story: "Test story for the font report.", detail: "d", category: "c" });
    out.drawn = (await cardPNG(svg)).length;
    const { Resvg } = { Resvg: await rasteriser() };
    out.blank = Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: 1080 },
      font: { loadSystemFonts: false, defaultFontFamily: FAMILY } }).render().asPng()).length;
    out.verdict = out.drawn > out.blank * 1.1
      ? "OK: the faces are drawing"
      : "BLANK: the renderer is not using our faces";
  } catch (e) { out.verdict = "could not render: " + String(e && e.message || e); }
  return out;
}

/* ---------------------------------------------------------------------------
   one picture per post

   THE BUG THIS FIXES

   This endpoint only ever drew the day's light. The poster then handed the SAME
   url to every slot it sent, so the dawn reminder, the word of the day and the
   chapter of the Path all went out wearing the light's card. Three or four
   posts a day, all different in their words, all identical in the one thing
   Instagram actually shows. To a follower that is the same post over and over,
   and it is what the owner saw on his own feed.

   Now a slot can ask for its own card: /api/card?date=YYYY-MM-DD&slot=dawn.
   The slot is composed exactly as the poster composes it, so the picture and
   the caption can never drift apart. If the slot cannot be built -- an
   unverified calendar, an index that did not answer -- it falls back to the
   light rather than posting with a broken image.
--------------------------------------------------------------------------- */
const SLOT_EYEBROW = { dawn: "TODAY", lead: "COMING UP", word: "A WORD", dusk: "THE PATH" };

async function slotCard(host, date, slot) {
  if (!SLOT_IDS.includes(slot) || slot === "light") return null;
  let plan; try { plan = await planDay(date); } catch { return null; }
  if (!plan) return null;
  let index = null;
  try {
    const r = await fetch("https://" + String(host).replace(/^https?:\/\//, "") + "/assets/menu-index.json");
    if (r.ok) index = await r.json();
  } catch { }
  const post = buildSlot(slot, {
    date, hijri: plan.hijri, day: plan.day, leads: plan.leads,
    words: index && index.words, path: index && index.path, link: "", image: ""
  });
  if (!post || !post.title) return null;
  /* The body of a slot is built for a caption, where it opens by restating the
     title and the date because the caption has no headline of its own. A card
     HAS a headline and a footer, so those lines are dropped here rather than
     printed twice -- "Khulafa Rashidun Khulafa Rashidun The four caliphs…" */
  const hd = plan.hijri ? (plan.hijri.d + " " + plan.hijri.name + " " + plan.hijri.y) : "";
  const norm = t => String(t || "").replace(/\s+/g, " ").trim().toLowerCase();
  const lines = String(post.body || post.oneLine || "").split(/\n+/);
  while (lines.length > 1) {
    const first = lines[0].trim();
    const isTitle  = norm(first) === norm(post.title);
    /* month names have spaces in them: "18 Rabi al-Awwal 1448." */
    const isDate   = /^\d{1,2}\s+[^\d]{2,30}\s+\d{3,4}\s*\.?$/.test(first);
    const isArabic = first.length > 0 && !/[A-Za-z]/.test(first);
    if (isTitle || isDate || isArabic) lines.shift(); else break;
  }
  const body = lines.join(" ").replace(/\s+/g, " ").trim();
  return { title: post.title, story: body,
           category: SLOT_EYEBROW[slot] || "NOOR",
           detail: [hd, post.key ? "" : ""].filter(Boolean).join(" · ") || hd };
}

export default async function handler(req, res) {
  const q = req.query || {};
  const host = req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL || "noorcodex.com";
  let date = String(q.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = new Date().toISOString().slice(0, 10);
  const story = String(q.shape || "") === "story";

  /* a slot asking for its own picture */
  const slot = String(q.slot || "");
  if (slot && slot !== "light") {
    const card = await slotCard(host, date, slot);
    if (card) {
      const svgS = cardSVG(card, { story });
      return await send(req, res, svgS, q);
    }
    /* fall through to the light rather than answer with nothing */
  }

  /* peek: reading the card must never consume a light from the shuffle bag */
  const light = await chooseLight(host, date, { useLantern: false, peek: true });
  if (!light) { res.setHeader("Cache-Control", "no-store"); return res.status(503).send("the library is not reachable"); }

  const svg = cardSVG(light, { story });

  if (String(q.debug || "")) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send(JSON.stringify(await fontReport(), null, 1));
  }
  return await send(req, res, svg, q);
}

async function send(req, res, svg, q) {
  if (String(q.fmt || "") === "png") {
    /* No silent fallback. A caller asking for a PNG is almost always Meta, and
       Meta will reject an SVG. If the rasteriser cannot run, that is a 503 the
       console shows and the poster refuses on, not a picture nobody can use. */
    try {
      const png = await cardPNG(svg, 1080);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Length", String(png.length));
      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      return res.status(200).send(png);
    } catch (e) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(503).send("the card could not be rasterised: " + String(e && e.message || e).slice(0, 160));
    }
  }

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  return res.status(200).send(svg);
}
