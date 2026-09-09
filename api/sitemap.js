// The rooms' sitemap: every server-rendered address api/page.js can answer,
// listed once for the crawlers, beside the static sitemap.xml that lists the
// hand-made pages. The rooms are generated on request, so the file is built
// from the same loaders the pages use and cached at the edge for a day.
// Reached as /sitemap-rooms.xml through a rewrite in vercel.json, and named
// in robots.txt.

import { lights, chapters, verseRows } from "./page.js";

const SITE = "https://noorcodex.com";
/* The Lights, the chapters and the surah study are edited by hand, so their
   lastmod is a date a hand sets: bump LAST_CONTENT_CHANGE when lights/,
   node/ or study/ change. A lastmod that said "today" every day would be
   discounted by the crawlers that read it. A verse takes the day its reel
   was uploaded, from the manifest row. */
export const LAST_CONTENT_CHANGE = "2026-09-09";
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const day = v => { const m = String(v || "").match(/^\d{4}-\d{2}-\d{2}/); return m ? m[0] : ""; };
export async function urls() {
  const out = [];
  const today = new Date().toISOString().slice(0, 10);
  out.push(["/today", today], ["/light", LAST_CONTENT_CHANGE], ["/path", LAST_CONTENT_CHANGE], ["/verses", LAST_CONTENT_CHANGE]);
  for (const L of lights()) out.push(["/light/" + L.id, LAST_CONTENT_CHANGE]);
  for (const c of chapters()) out.push(["/path/" + c.id, LAST_CONTENT_CHANGE]);
  for (let n = 1; n <= 114; n++) out.push(["/surah/" + n, LAST_CONTENT_CHANGE]);
  for (const r of await verseRows()) out.push(["/verse/" + r.ref.replace(":", "-"), day(r.uploaded) || day(r.written) || LAST_CONTENT_CHANGE]);
  return out;
}

export async function xml() {
  const rows = (await urls()).map(([u, d]) => "  <url><loc>" + esc(SITE + u) + "</loc><lastmod>" + d + "</lastmod></url>");
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + rows.join("\n") + "\n</urlset>\n";
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  res.status(200).end(await xml());
}
