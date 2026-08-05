// The Codex's own visitor lamp counter. First-party, cookieless, halal:
// it records only WHEN (day), WHERE FROM (country code Vercel already
// attaches to the request), and WHICH ROOM. Never an IP, never an ID,
// never a fingerprint. Dormant until a Vercel KV store is connected
// (env KV_REST_API_URL + KV_REST_API_TOKEN appear automatically then).

const ROOMS = {
  "": "home", "index": "home", "quran": "quran", "prophets": "prophets",
  "characters": "characters", "companions": "companions", "places": "places",
  "words": "words", "health": "health", "theology": "theology",
  "latif": "latif", "begin": "begin", "kids": "kids", "arabic": "arabic", "pillars": "pillars", "license": "license",
  "kids/letters": "kids", "donate": "give",
  "sponsor": "sponsor", "legal": "legal"
};

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

  const cmds = [
    ["INCR", "nv:" + day + ":views"],
    ["EXPIRE", "nv:" + day + ":views", "8000000"],
    ["INCR", "nm:" + month + ":c:" + cc],
    ["EXPIRE", "nm:" + month + ":c:" + cc, "35000000"],
    ["INCR", "nm:" + month + ":r:" + room],
    ["EXPIRE", "nm:" + month + ":r:" + room, "35000000"]
  ];
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
