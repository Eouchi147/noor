// The Lantern's public chat is resting to keep AI usage disciplined.
// The AI core still serves the owner (vetting in /admin) and the daily
// light tile (api/daily-light). To re-open public chat one day, set
// ASK_PUBLIC=1 in Vercel env and restore the previous version of this
// file from git history (v15.1).

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body && body.probe) return res.status(200).json({ enabled: false });
  return res.status(501).json({ error: "The Lantern rests. Its daily light shines on the home page." });
}
