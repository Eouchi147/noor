// NOOR sponsor vetting, owner-only (valid noor_admin cookie required).
// The Lantern reads a would-be Guardian (name, link, tagline, notes) and
// checks them against the house rules, so the owner can approve in seconds.
// Uses the same OPENROUTER_API_KEY as the public Lantern.

import crypto from "crypto";
import { askOpenRouter } from "./_models.js";

function verify(cookieHeader, secret) {
  const m = /(?:^|;\s*)noor_admin=([^;]+)/.exec(cookieHeader || "");
  if (!m) return false;
  const [expStr, sig] = m[1].split(".");
  const exp = parseInt(expStr, 10);
  if (!exp || Date.now() > exp) return false;
  const want = crypto.createHmac("sha256", secret).update(String(exp)).digest("hex");
  const A = Buffer.from(sig || ""), B = Buffer.from(want);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

const RUBRIC = [
  "You vet sponsors for NOOR Codex of Light, a free Islamic library. One sponsor per region, shown as a single quiet line sitewide. Judge ONLY whether this sponsor fits the house rules. Reply in JSON only, no other text, shaped exactly:",
  '{"verdict":"approve"|"decline"|"review","score":0-100,"reasons":["..."],"questions":["..."]}',
  "Decline if the core business is any of: interest-based lending or conventional banking products, alcohol, pork or non-halal meat, gambling or lotteries or betting, adult content, tobacco or vaping or drugs, fortune telling or astrology, predatory or get-rich-quick schemes, weapons sales, dating apps outside marriage frameworks.",
  "Review (human judgment needed) if: conventional insurance, mixed retail that may carry haram lines, entertainment or music heavy brands, finance that claims to be Islamic without evidence, anything political, any charity (verify registration), a website that cannot be verified from the given link, or claims that read exaggerated or deceptive.",
  "Approve if the offering is clearly halal, the tagline is truthful and modest, and nothing above applies.",
  "Also check the tagline: no deception, no engagement bait, no disparaging competitors, no religious one-upmanship. Flag reasons briefly. In questions, list what to ask the sponsor if verdict is review. Never use the em dash character; use commas or · instead."
].join("\n");

export default async function handler(req, res) {
  /* An admin or per reader answer must never sit in a shared cache.
     Nine routes were shipping with no Cache-Control at all, which
     leaves the decision to whatever proxy is in front of them. */
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const SECRET = process.env.ADMIN_SECRET, KEY = process.env.OPENROUTER_API_KEY;
  if (!SECRET) return res.status(501).json({ error: "admin not configured" });
  if (!verify(req.headers.cookie, SECRET)) return res.status(401).json({ error: "locked" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  if (body.probe) return res.status(200).json({ enabled: !!KEY });
  if (!KEY) return res.status(501).json({ error: "OPENROUTER_API_KEY not set" });

  const sponsor = [
    "Business name: " + String(body.name || "").slice(0, 80),
    "Website: " + String(body.url || "").slice(0, 200),
    "Tagline: " + String(body.line || "").slice(0, 120),
    "Region requested: " + String(body.market || "").slice(0, 20),
    "Owner notes: " + String(body.notes || "").slice(0, 400)
  ].join("\n");

  try {
    const got = await askOpenRouter(
      [{ role: "system", content: RUBRIC }, { role: "user", content: sponsor }],
      { max_tokens: 500, temperature: 0.1 }
    );
    if (!got.text) return res.status(502).json({ error: "vetting unavailable" });
    const raw = got.text;
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    if (!parsed || !parsed.verdict) return res.status(200).json({ verdict: "review", score: 50, reasons: ["The Lantern could not settle this one. Judge by hand."], questions: [] });
    return res.status(200).json({
      verdict: ["approve", "decline", "review"].indexOf(parsed.verdict) !== -1 ? parsed.verdict : "review",
      score: Math.max(0, Math.min(100, parseInt(parsed.score, 10) || 0)),
      reasons: (Array.isArray(parsed.reasons) ? parsed.reasons : []).slice(0, 6).map(x => String(x).replace(/—|–/g, "·").slice(0, 200)),
      questions: (Array.isArray(parsed.questions) ? parsed.questions : []).slice(0, 4).map(x => String(x).replace(/—|–/g, "·").slice(0, 200))
    });
  } catch {
    return res.status(502).json({ error: "vetting unavailable" });
  }
}
