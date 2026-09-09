/* NOOR · the shelf, read once and remembered
   ===========================================================================
   Three doors read the reel manifest (/reels/index.json): the one that hands
   a phone the bytes (api/reel.js), the podcast feed (api/podcast.js), and the
   console's Today (api/social.js, action=today). Each used to fetch it on
   its own, and a manifest of 1,265 rows is not small. So it is read here,
   once per instance, kept for five minutes, and handed to whoever asks.

   The host is forced to production the way publicHost() forces the card's
   host: a preview deployment has no /reels of its own, and the rows carry
   absolute store URLs (GitHub Releases) that are the same whichever
   deployment read them.

   A read that fails hands back what was last read, if anything, rather than
   nothing: a reel whose row was known a minute ago has not stopped existing
   because one fetch of the manifest timed out. Nothing here writes anything.
--------------------------------------------------------------------------- */

const SITE = () => (process.env.SITE_HOST || "noorcodex.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
export const MANIFEST_TTL_MS = Number(process.env.REELS_MANIFEST_TTL_MS || 5 * 60 * 1000);

let MEM = { at: 0, doc: null, host: "" };

/* the production host, whatever host asked; a noorcodex.* host stands */
export function manifestHost(host) {
  const h = String(host || "").replace(/^https?:\/\//, "").split("/")[0];
  return /(^|\.)noorcodex\.(com|ca)$/.test(h) ? h : SITE();
}

/* the manifest document { n, written, cards[] }, or null when it has never
   been read and cannot be read now. `fetcher` is for the tests; `fresh`
   goes round the memory. */
export async function readManifest(host, opts = {}) {
  const f = opts.fetch || fetch;
  const h = manifestHost(host);
  const now = Date.now();
  if (!opts.fresh && MEM.doc && MEM.host === h && now - MEM.at < MANIFEST_TTL_MS) return MEM.doc;
  try {
    const r = await f("https://" + h + "/reels/index.json", { cache: "no-store" });
    if (r && r.ok) {
      const doc = await r.json();
      if (doc && Array.isArray(doc.cards)) { MEM = { at: now, doc, host: h }; return doc; }
    }
  } catch { }
  return MEM.doc && MEM.host === h ? MEM.doc : null;
}

/* one row by id, with its URLs made absolute the way the poster makes them:
   a row from the store carries them; an older row means the file is on the
   site under /reels/ */
export function rowUrls(row, host) {
  if (!row || !row.id) return null;
  const base = "https://" + manifestHost(host);
  const isUrl = v => typeof v === "string" && /^https:\/\//.test(v);
  return { ...row,
    video: isUrl(row.video) ? row.video : base + "/reels/" + row.id + ".mp4",
    cover: isUrl(row.cover) ? row.cover : base + "/reels/" + row.id + "-cover.jpg" };
}

/* for the tests: forget what was read */
export function forgetManifest() { MEM = { at: 0, doc: null, host: "" }; }
