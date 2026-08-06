// The Codex's own visitor lamp counter. First-party, cookieless, halal:
// it records only WHEN (day), WHERE FROM (country code Vercel already
// attaches to the request), WHICH ROOM, and WHICH SOURCE brought them
// (a coarse name such as reddit or google, never a full URL, never a
// query string). Never an IP, never an ID, never a fingerprint. Dormant until a Vercel KV store is connected
// (env KV_REST_API_URL + KV_REST_API_TOKEN appear automatically then).

const ROOMS = {
  "": "home", "index": "home", "quran": "quran", "prophets": "prophets",
  "characters": "characters", "companions": "companions", "places": "places",
  "words": "words", "health": "health", "theology": "theology",
  "latif": "latif", "begin": "begin", "kids": "kids", "arabic": "arabic", "pillars": "pillars", "license": "license", "school": "school", "madrasa": "madrasa", "kids/cradle": "kids",
  "kids/letters": "kids", "donate": "give",
  "sponsor": "sponsor", "legal": "legal"
};

/* referrer hostnames folded into the handful of names that matter for
   the money plan. Anything unknown is kept only as its bare hostname. */
const SOURCES = [
  [/(^|\.)reddit\.com$|^redd\.it$/, "reddit"],
  [/(^|\.)facebook\.com$|^fb\.me$|^m\.facebook\.com$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/, "x"],
  [/(^|\.)t\.me$|(^|\.)telegram\.(org|me)$/, "telegram"],
  [/(^|\.)whatsapp\.com$|^wa\.me$/, "whatsapp"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "youtube"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\.com$|(^|\.)duckduckgo\.com$|(^|\.)yahoo\./, "search"],
  [/(^|\.)chat\.openai\.com$|(^|\.)chatgpt\.com$|(^|\.)perplexity\.ai$|(^|\.)claude\.ai$|(^|\.)gemini\.google\.com$/, "ai"],
  [/(^|\.)noorhalal\.ca$/, "noorhalal"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin"],
  [/(^|\.)pinterest\./, "pinterest"],
  [/(^|\.)islamicboard\.com$|(^|\.)turntoislam\.com$|(^|\.)ummah\.com$/, "forum"],
  [/(^|\.)mail\.google\.com$|(^|\.)outlook\.|(^|\.)mail\.yahoo\./, "email"]
];
function sourceOf(raw) {
  var v = String(raw || "").slice(0, 60).toLowerCase();
  if (!v) return "";
  if (v === "direct") return "direct";
  for (var i = 0; i < SOURCES.length; i++) if (SOURCES[i][0].test(v)) return SOURCES[i][1];
  if (/^[a-z0-9.-]{1,40}$/.test(v)) return v.slice(0, 24);
  return "other";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  const URL0 = process.env.KV_REST_API_URL, TOK = process.env.KV_REST_API_TOKEN;
  if (!URL0 || !TOK) return res.status(204).end();   /* counting not set up yet */

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const day = new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const cc = String(req.headers["x-vercel-ip-country"] || "??").slice(0, 2).toUpperCase();
  let room = String(body.p || "").replace(/^\/+|\.html$/g, "").split("/")[0].toLowerCase();
  room = ROOMS[room] !== undefined ? ROOMS[room] : (room && /^[a-z0-9-]{1,20}$/.test(room) ? "other" : "home");
  const firstToday = body.n === 1;
  const src = sourceOf(body.s);

  const cmds = [
    ["INCR", "nv:" + day + ":views"],
    ["EXPIRE", "nv:" + day + ":views", "8000000"],
    ["INCR", "nm:" + month + ":c:" + cc],
    ["EXPIRE", "nm:" + month + ":c:" + cc, "35000000"],
    ["INCR", "nm:" + month + ":r:" + room],
    ["EXPIRE", "nm:" + month + ":r:" + room, "35000000"]
  ];
  /* the source is counted once per person per day, so one reader
     browsing ten rooms does not look like ten arrivals. */
  if (firstToday && src) {
    cmds.push(["INCR", "nm:" + month + ":s:" + src]);
    cmds.push(["EXPIRE", "nm:" + month + ":s:" + src, "35000000"]);
  }
  if (firstToday) {
    cmds.push(["INCR", "nv:" + day + ":people"]);
    cmds.push(["EXPIRE", "nv:" + day + ":people", "8000000"]);
  }
  try {
    await fetch(URL0 + "/pipeline", {
      method: "POST",
      headers: { Authorization: "Bearer " + TOK, "Content-Type": "application/json" },
      body: JSON.stringify(cmds)
    });
  } catch {}
  return res.status(204).end();
}
