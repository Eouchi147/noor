// NOOR owner gate · password login for the Guardian Console.
// Requires two Vercel env vars, known only to the owner:
//   ADMIN_PASSWORD  · the owner's password (choose something long)
//   ADMIN_SECRET    · random string used to sign the session cookie
// Issues an HttpOnly, Secure, SameSite=Strict cookie valid 24h.
// No password ever stored client-side; no session survives the secret changing.

import crypto from "crypto";

function sign(exp, secret) {
  return crypto.createHmac("sha256", secret).update(String(exp)).digest("hex");
}
function safeEqual(a, b) {
  const A = Buffer.from(String(a || ""));
  const B = Buffer.from(String(b || ""));
  if (A.length !== B.length) { crypto.timingSafeEqual(B, B); return false; }
  return crypto.timingSafeEqual(A, B);
}

export default async function handler(req, res) {
  /* An admin or per reader answer must never sit in a shared cache.
     Nine routes were shipping with no Cache-Control at all, which
     leaves the decision to whatever proxy is in front of them. */
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const PASS = process.env.ADMIN_PASSWORD, SECRET = process.env.ADMIN_SECRET;
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  if (body.probe) return res.status(200).json({ configured: !!(PASS && SECRET) });

  if (body.logout) {
    res.setHeader("Set-Cookie", "noor_admin=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
    return res.status(200).json({ ok: true });
  }

  if (!PASS || !SECRET) return res.status(501).json({ error: "admin not configured" });
  if (!safeEqual(body.password, PASS)) {
    await new Promise(r => setTimeout(r, 600 + Math.random() * 500)); // slow brute force
    return res.status(401).json({ error: "wrong password" });
  }
  const exp = Date.now() + 24 * 3600 * 1000;
  const token = exp + "." + sign(exp, SECRET);
  res.setHeader("Set-Cookie", "noor_admin=" + token + "; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=86400");
  return res.status(200).json({ ok: true, until: exp });
}
