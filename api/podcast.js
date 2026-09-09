// One Verse, as a podcast.
//
// The verse reels are a recitation and nothing else: one verse, one reciter
// named on screen, silence before and after. That is a podcast episode
// already, and a podcast is the one distribution channel that asks for no
// token, no review and no consent flow: an RSS file at a stable address, and
// every podcast app in the world fetches it. So /podcast.xml (a rewrite in
// vercel.json) draws the verse reels off the manifest as episodes, newest
// first, each enclosure the reel's own video URL on the store.
//
// The feed is RSS 2.0 with the itunes namespace, which is what Apple, Spotify
// and the rest read. Every field is the manifest's: the title is the verse's
// reference and its hook, the description the audited caption, the guid the
// reel's id, the duration the sidecar's seconds when the row carries them,
// and the enclosure length its bytes when the row carries those (and omitted
// when it does not, because a made-up length is worse than none). Nothing
// here writes a word the library did not.
//
// Cached a day: the shelf changes weekly and the apps poll hourly.

import { readManifest, rowUrls } from "./_reels.js";

const SITE = () => (process.env.SITE_HOST || "noorcodex.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
const TITLE = "One Verse · NOOR Codex of Light";
const ABOUT = "One verse of the Qur'an, recited and nothing else, with its meaning. From NOOR Codex of Light, a free Islamic library: the whole Qur'an recited with its meaning, free, at noorcodex.com/quran. No ads, no trackers, no account.";
/* the channel's picture: the largest square the site has (assets/brand,
   512 px). Apple Podcasts asks for 1400 to 3000 px square; until the brand
   has one at that size, this is what is offered, and Apple will say so. */
const IMAGE = "/assets/brand/mark-512.png";
const CACHE = "public, max-age=86400, stale-while-revalidate=86400";

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* characters XML 1.0 will not carry, whatever the escaping */
const clean = s => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "");

/* a date the row carries (uploaded, or written on the manifest) as RFC 822 */
function rfc822(d) {
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? d + "T08:00:00Z" : String(d || ""));
  return new Date(isFinite(t) ? t : Date.now()).toUTCString();
}
/* seconds as the H:MM:SS itunes wants */
function hms(secs) {
  const n = Math.round(Number(secs));
  if (!isFinite(n) || n < 0) return "";
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60;
  return (h ? h + ":" : "") + String(m).padStart(h ? 2 : 1, "0") + ":" + String(s).padStart(2, "0");
}

/* the verse rows, newest first: by `uploaded` when the rows carry it, and
   by the manifest's own order (last written last) when they do not */
export function episodes(doc, host) {
  const cards = (doc && Array.isArray(doc.cards) ? doc.cards : []).filter(c => c && c.id && (c.kind || "light") === "verse");
  const rows = cards.map((c, i) => ({ ...rowUrls(c, host), _i: i }));
  const dated = rows.some(r => r.uploaded);
  rows.sort((a, b) => {
    if (dated) {
      const ta = Date.parse(String(a.uploaded || "") + "T00:00:00Z") || 0, tb = Date.parse(String(b.uploaded || "") + "T00:00:00Z") || 0;
      if (ta !== tb) return tb - ta;
    }
    return b._i - a._i;
  });
  return rows;
}

export function itemXml(r, doc) {
  const ref = String(r.ref || r.hook || r.id);
  const hook = String(r.hook || "");
  const title = ref && hook && ref !== hook ? ref + " · " + hook : (ref || hook);
  const bytes = Number(r.bytes);
  const when = r.uploaded || (doc && doc.written) || "";
  const dur = r.secs != null ? hms(r.secs) : "";
  return "<item>"
    + "<title>" + esc(clean(title)) + "</title>"
    + "<description>" + esc(clean(r.caption || "")) + "</description>"
    + "<itunes:summary>" + esc(clean(r.caption || "")) + "</itunes:summary>"
    + '<enclosure url="' + esc(r.video) + '" type="video/mp4"' + (isFinite(bytes) && bytes > 0 ? ' length="' + Math.round(bytes) + '"' : "") + "/>"
    + '<guid isPermaLink="false">' + esc(r.id) + "</guid>"
    + "<pubDate>" + esc(rfc822(when)) + "</pubDate>"
    + (r.cover ? '<itunes:image href="' + esc(r.cover) + '"/>' : "")
    + (dur ? "<itunes:duration>" + esc(dur) + "</itunes:duration>" : "")
    + (r.reciter ? "<itunes:author>" + esc(clean(r.reciter)) + "</itunes:author>" : "")
    + "<itunes:explicit>false</itunes:explicit>"
    + "</item>";
}

export function feedXml(doc, host) {
  const base = "https://" + SITE();
  const eps = episodes(doc, host);
  const last = eps.length ? rfc822(eps[0].uploaded || (doc && doc.written) || "") : rfc822("");
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">'
    + "<channel>"
    + "<title>" + esc(TITLE) + "</title>"
    + "<link>" + esc(base + "/quran") + "</link>"
    + '<atom:link href="' + esc(base + "/podcast.xml") + '" rel="self" type="application/rss+xml"/>'
    + "<description>" + esc(ABOUT) + "</description>"
    + "<language>en</language>"
    + "<lastBuildDate>" + esc(last) + "</lastBuildDate>"
    + "<itunes:author>NOOR Codex of Light</itunes:author>"
    + "<itunes:summary>" + esc(ABOUT) + "</itunes:summary>"
    + '<itunes:image href="' + esc(base + IMAGE) + '"/>'
    + '<itunes:category text="Religion &amp; Spirituality"><itunes:category text="Islam"/></itunes:category>'
    + "<itunes:explicit>false</itunes:explicit>"
    + eps.map(r => itemXml(r, doc)).join("")
    + "</channel></rss>";
}

export default async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL || "noorcodex.com";
  const doc = await readManifest(host);
  if (!doc) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).send("the shelf could not be read");
  }
  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.setHeader("Cache-Control", CACHE);
  return res.status(200).send(feedXml(doc, host));
}
