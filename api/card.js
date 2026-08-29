// The picture that goes out with the day's light.
//
// One square card, drawn as SVG so it can be produced, tested and read without
// a rasteriser, a browser or a font binary. It is the same drawing whether it
// is shown in the console as a preview, attached to a post, or opened directly.
//
// Instagram's Graph API will only accept a JPEG or PNG at a public URL, so the
// PNG path is served by /api/card?fmt=png, which renders through @vercel/og
// when that package is installed and falls back to the SVG when it is not.
// Facebook accepts either.

import { chooseLight } from "./_lights.js";

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
  const title = wrap(light.title || "", 26, 3);
  const body = wrap(light.story || "", 46, opts.story ? 12 : 8);
  const cat = (light.category || "Light").toUpperCase();
  const det = light.detail || "";
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
<text x="${W / 2}" y="150" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif"
      font-size="26" font-weight="800" letter-spacing="7" fill="rgba(244,212,106,.85)">${esc(cat)}</text>
${title.map((l, i) => `<text x="${W / 2}" y="${titleY + i * 62}" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif" font-size="54" font-weight="800" fill="#FFFEF7">${esc(l)}</text>`).join("\n")}
<line x1="${W / 2 - 60}" y1="${titleY + title.length * 62 + 6}" x2="${W / 2 + 60}" y2="${titleY + title.length * 62 + 6}" stroke="rgba(244,212,106,.6)" stroke-width="3" stroke-linecap="round"/>
${body.map((l, i) => `<text x="${W / 2}" y="${titleY + title.length * 62 + 74 + i * 42}" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif" font-size="30" fill="rgba(255,254,247,.86)">${esc(l)}</text>`).join("\n")}
<text x="${W / 2}" y="${H - 150}" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif"
      font-size="26" fill="rgba(255,254,247,.5)">${esc(det)}</text>
<text x="${W / 2}" y="${H - 88}" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif"
      font-size="30" font-weight="800" letter-spacing="4" fill="rgba(244,212,106,.9)">NOORCODEX.COM</text>
<text x="${W / 2}" y="${H - 52}" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif"
      font-size="22" fill="rgba(255,254,247,.38)">A free Islamic library. No ads, no trackers, no account.</text>
</svg>`;
}

export default async function handler(req, res) {
  const q = req.query || {};
  const host = req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL || "noorcodex.com";
  let date = String(q.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = new Date().toISOString().slice(0, 10);

  /* peek: reading the card must never consume a light from the shuffle bag */
  const light = await chooseLight(host, date, { useLantern: false, peek: true });
  if (!light) { res.setHeader("Cache-Control", "no-store"); return res.status(503).send("the library is not reachable"); }

  const svg = cardSVG(light, { story: String(q.shape || "") === "story" });

  if (String(q.fmt || "") === "png") {
    /* @vercel/og turns markup into a PNG at the edge. If it is not installed,
       the SVG is served instead and says so in a header, so a caller that
       genuinely needs raster can tell rather than silently posting nothing. */
    try {
      const og = await import("@vercel/og");
      const { ImageResponse } = og;
      const img = new ImageResponse(
        { type: "img", props: { src: "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"), width: 1080, height: 1080 } },
        { width: 1080, height: 1080 });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      return res.status(200).send(Buffer.from(await img.arrayBuffer()));
    } catch (e) {
      res.setHeader("X-Card-Format", "svg-fallback");
      res.setHeader("X-Card-Reason", String(e && e.message || e).slice(0, 80));
    }
  }

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  return res.status(200).send(svg);
}
