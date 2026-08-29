// The picture that goes out with the day's light.
//
// One square card, drawn once as SVG and rasterised from that same drawing, so
// the preview in the console and the image on Instagram are provably the same
// picture rather than two drawings that agree today.
//
// TWO THINGS HERE WERE PAID FOR IN BLOOD, BOTH ABOUT FONTS
//
// 1. Instagram will not accept an SVG. This route used to try @vercel/og and
//    silently serve the SVG when it was missing, and @vercel/og was never a
//    dependency, so the PNG path had NEVER ONCE produced a PNG. Nothing failed
//    loudly: the header said svg-fallback and no one reads headers. Every post
//    to Instagram would have been rejected for a reason findable without ever
//    holding a credential. It rasterises properly now, with resvg.
//
// 2. Font fallback is silent, and it is worse than garbage. On the first real
//    render, "the birth of the Prophet ﷺ, or the" came out as
//    "the birth of the Prophet  , or the": an empty gap, no error, no warning,
//    no missing-glyph box. U+FDFA and U+FDFB are the least reliably supported
//    codepoints this project will ever touch, and a broken one on a card about
//    the Prophet, peace be upon him, is not an ordinary bug. So the honorific
//    is SPELLED OUT before the card is drawn, the faces are carried in the
//    repository, the system fonts are switched off entirely, and anything
//    outside the faces' coverage is reported rather than dropped.
//
//    The caption is different and deliberately so: it is text, not a picture,
//    and Facebook and Instagram both draw ﷺ correctly in a caption. It keeps
//    the honorific. Only the drawing spells it out.

import { chooseLight } from "./_lights.js";
import { REGULAR, BOLD, FAMILY, COVERAGE } from "./_cardfont.js";
import { createRequire } from "module";
import fs from "fs";

/* The honorifics, written out for the drawing only. */
const HONORIFIC = [
  [/\uFDFA/g, "(peace be upon him)"],
  [/\uFDFB/g, "(glorified and exalted)"]
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
  const body = wrap(D(light.story || ""), 46, opts.story ? 12 : 8);
  const cat = D((light.category || "Light").toUpperCase());
  const det = D(light.detail || "");
  const titleY = midY - (title.length * 62) / 2 - (body.length * 21);
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
<g opacity=".5" stroke="rgba(244,212,106,.35)" fill="none" stroke-width="2">
  <rect x="44" y="44" width="${W - 88}" height="${H - 88}" rx="34"/>
</g>
<text x="${W / 2}" y="150" text-anchor="middle" font-family="${FAMILY}"
      font-size="26" font-weight="800" letter-spacing="7" fill="rgba(244,212,106,.85)">${esc(cat)}</text>
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

   resvg draws the same SVG the console previews. The wasm is initialised once
   per process and kept, because a cold start already costs enough. System
   fonts are OFF: with them on, a missing glyph borrows a face from the build
   machine and the card looks fine here and different in production. With them
   off, the only faces in the world are the two carried in _cardfont.js.
--------------------------------------------------------------------------- */
let RESVG = null, RESVG_ERR = "";
async function rasteriser() {
  if (RESVG) return RESVG;
  if (RESVG_ERR) throw new Error(RESVG_ERR);
  try {
    const mod = await import("@resvg/resvg-wasm");
    const req = createRequire(import.meta.url);
    await mod.initWasm(fs.readFileSync(req.resolve("@resvg/resvg-wasm/index_bg.wasm")));
    RESVG = mod.Resvg;
    return RESVG;
  } catch (e) {
    RESVG_ERR = String(e && e.message || e).slice(0, 140);
    throw new Error(RESVG_ERR);
  }
}

export async function cardPNG(svg, width = 1080) {
  const Resvg = await rasteriser();
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: false, fontBuffers: [REGULAR, BOLD], defaultFontFamily: FAMILY }
  });
  return Buffer.from(r.render().asPng());
}

export default async function handler(req, res) {
  const q = req.query || {};
  const host = req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL || "noorcodex.com";
  let date = String(q.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = new Date().toISOString().slice(0, 10);

  /* peek: reading the card must never consume a light from the shuffle bag */
  const light = await chooseLight(host, date, { useLantern: false, peek: true });
  if (!light) { res.setHeader("Cache-Control", "no-store"); return res.status(503).send("the library is not reachable"); }

  const story = String(q.shape || "") === "story";
  const svg = cardSVG(light, { story });

  if (String(q.fmt || "") === "png") {
    /* No silent fallback. A caller asking for a PNG is almost always Meta, and
       Meta will reject an SVG. If the rasteriser cannot run, that is a 503 the
       console shows and the poster refuses on, not a picture nobody can use. */
    try {
      const png = await cardPNG(svg, story ? 1080 : 1080);
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
