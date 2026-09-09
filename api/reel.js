// A same-origin door to a reel's bytes.
//
// The shelf lives on GitHub Releases. A release download URL answers 302 to
// a signed copy on release-assets.githubusercontent.com that lives about an
// hour and is served as application/octet-stream with a Content-Disposition
// of attachment. That is right for a download and wrong for two things the
// house needs:
//
//   - a phone. The console's Today room hands a reel to the phone's share
//     sheet (TikTok, WhatsApp, X, whichever app the owner picks), which
//     means fetching the file in the page as a Blob. A page on noorcodex.com
//     cannot read a cross-origin body from GitHub, and a file typed
//     octet-stream is not a video to a share sheet;
//   - a network that refuses the octet-stream URL. Meta's fetchers want a
//     video/mp4 at a URL that does not redirect. This door is the fallback
//     to hand them.
//
// So GET /api/reel?id=<id> looks the id up in the manifest, resolves the
// redirect, and STREAMS the file through with the headers a video needs:
// video/mp4, the length, Accept-Ranges, inline. A Range header is passed
// upstream and the 206 with its Content-Range is relayed, because a phone's
// player asks for the tail first and a door that answered 200 to a range
// request would make every reel unplayable in place. The whole file is
// never held in memory: Readable.fromWeb(body).pipe(res), a chunk at a time,
// which is what keeps a 60 MB verse under a serverless function's memory.
//
// An unknown id is 404. A store that does not answer is 502 and says so.
// Nothing here is owner-gated: the reels are public on the feeds already,
// and this hands out nothing the manifest does not already name.

import { Readable } from "node:stream";
import { readManifest, rowUrls, manifestHost } from "./_reels.js";

const RELEASE_URL = /^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\//;
const CACHE = "public, max-age=3600";

/* WHERE THE BYTES MAY COME FROM. The door fetches whatever URL the manifest
   row carries, and the manifest is a file on the site: a row edited to point
   elsewhere would turn this function into a proxy for any host on the
   internet, with the house's name on it. So the host is pinned, before and
   after the redirect, to the places the shelf actually lives: GitHub
   Releases and the two hosts its signed copies come from, Vercel Blob
   (REELS_STORE=blob), and the site itself. Anything else is 502 in words. */
const STORE_HOSTS = [/^github\.com$/, /^objects\.githubusercontent\.com$/, /^release-assets\.githubusercontent\.com$/, /\.public\.blob\.vercel-storage\.com$/];
export function hostAllowed(url, siteHost) {
  let u;
  try { u = new URL(String(url)); } catch { return false; }
  if (u.protocol !== "https:") return false;
  if (siteHost && u.hostname === String(siteHost).toLowerCase()) return true;
  return STORE_HOSTS.some(re => re.test(u.hostname));
}

const json = (res, code, obj) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", code === 404 ? "public, max-age=60" : "no-store");
  return res.status(code).json(obj);
};

/* the signed copy behind a release URL, for this request; anything else is
   handed over as it is. Mirrors freshVideoUrl in social.js without pulling
   the whole poster into this function. */
export async function resolveVideo(url, fetcher) {
  if (!RELEASE_URL.test(String(url || ""))) return url;
  const f = fetcher || fetch;
  try {
    const r = await f(url, { method: "HEAD", redirect: "manual" });
    const loc = r && r.headers && typeof r.headers.get === "function" ? r.headers.get("location") : null;
    if (loc && /^https:\/\//.test(loc)) return loc;
  } catch { }
  return url;
}

/* the headers relayed from upstream: the ones a player needs, and only those */
function relayHeaders(res, up, id) {
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", CACHE);
  res.setHeader("Content-Disposition", 'inline; filename="' + String(id).replace(/[^A-Za-z0-9._-]/g, "") + '.mp4"');
  res.setHeader("X-Content-Type-Options", "nosniff");
  const len = up.headers.get("content-length");
  if (len && /^\d+$/.test(len)) res.setHeader("Content-Length", len);
  const cr = up.headers.get("content-range");
  if (up.status === 206 && cr) res.setHeader("Content-Range", cr);
  const lm = up.headers.get("last-modified");
  if (lm) res.setHeader("Last-Modified", lm);
  const et = up.headers.get("etag");
  if (et) res.setHeader("ETag", et);
}

export default async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL || "noorcodex.com";
  const q = req.query || {};
  const fetcher = fetch;      /* the tests stand a stub in globalThis.fetch, as every test here does */
  if (req.method !== "GET" && req.method !== "HEAD")
    return json(res, 405, { ok: false, reason: "GET" });

  const id = String(q.id || "").trim();
  if (!id) return json(res, 400, { ok: false, reason: "which reel? ?id=<id>" });

  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(id))
    return json(res, 404, { ok: false, reason: "no reel on the shelf with that id" });
  const shelf = await readManifest(host, { fetch: fetcher });
  if (!shelf) return json(res, 502, { ok: false, reason: "the shelf (the reel manifest) could not be read" });
  const hit = shelf.cards.find(c => c && String(c.id) === id);
  const row = hit ? rowUrls(hit, host) : null;
  if (!row) return json(res, 404, { ok: false, reason: "no reel on the shelf with that id" });

  const site = manifestHost(host);
  if (!hostAllowed(row.video, site))
    return json(res, 502, { ok: false, reason: "this reel's row points at a host the shelf does not live on, so it is not fetched" });
  const src = await resolveVideo(row.video, fetcher);
  if (!hostAllowed(src, site))
    return json(res, 502, { ok: false, reason: "the store redirected to a host the shelf does not live on, so it is not fetched" });
  const headers = {};
  const range = String(req.headers.range || "");
  if (/^bytes=\d*-\d*(,\d*-\d*)*$/.test(range)) headers.range = range;

  let up;
  try {
    up = await fetcher(src, { method: req.method === "HEAD" ? "HEAD" : "GET", headers, redirect: "follow" });
  } catch (e) {
    return json(res, 502, { ok: false, reason: "the store did not answer: " + String(e && e.message || e).slice(0, 120) });
  }
  /* a range the store cannot serve is the store's answer to relay, not a fault */
  if (up.status === 416) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Accept-Ranges", "bytes");
    const cr = up.headers.get("content-range");
    if (cr) res.setHeader("Content-Range", cr);
    return res.status(416).end();
  }
  if (!(up.status === 200 || up.status === 206))
    return json(res, 502, { ok: false, reason: "the store answered " + up.status + " for this reel" });

  relayHeaders(res, up, id);
  res.status(up.status);
  if (req.method === "HEAD" || !up.body) return res.end();

  /* the bytes go through a chunk at a time; a client that goes away mid-file
     (a phone that cancelled the share) closes the upstream read with it */
  await new Promise(resolve => {
    let stream;
    try { stream = Readable.fromWeb(up.body); }
    catch (e) { res.end(); return resolve(); }
    stream.on("error", () => { try { res.end(); } catch { } resolve(); });
    res.on("close", () => { try { stream.destroy(); } catch { } resolve(); });
    res.on("finish", resolve);
    stream.pipe(res);
  });
}
