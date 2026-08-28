// NOOR Guardian controls, owner-only (valid noor_admin cookie required).
// The owner's hand on every lamp:
//   intake     · read what the sponsor typed at checkout (name, link, line)
//   approve    · light the lamp (writes approved details onto the subscription)
//   extinguish · unlight the lamp but keep the subscription
//   release    · end the Guardianship when the current week finishes
//   relight    · undo a release before the week ends

import crypto from "crypto";

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

export default async function handler(req, res) {
  /* An admin or per reader answer must never sit in a shared cache.
     Nine routes were shipping with no Cache-Control at all, which
     leaves the decision to whatever proxy is in front of them. */
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const SECRET = process.env.ADMIN_SECRET, KEY = process.env.STRIPE_SECRET_KEY;
  if (!SECRET) return res.status(501).json({ error: "admin not configured" });
  if (!verify(req.headers.cookie, SECRET)) return res.status(401).json({ error: "locked" });
  if (!KEY) return res.status(501).json({ error: "stripe not configured" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const sub = String(body.subscription || "");
  if (!/^sub_[A-Za-z0-9]+$/.test(sub)) return res.status(400).json({ error: "bad subscription id" });
  const H = { Authorization: "Bearer " + KEY, "Content-Type": "application/x-www-form-urlencoded" };

  try {
    if (body.action === "intake") {
      const r = await fetch("https://api.stripe.com/v1/checkout/sessions?limit=1&subscription=" + sub, { headers: { Authorization: "Bearer " + KEY } });
      if (!r.ok) return res.status(502).json({ error: "stripe error" });
      const j = await r.json();
      const cf = ((j.data || [])[0] || {}).custom_fields || [];
      const val = k => { const f = cf.find(x => x.key === k); return (f && f.text && f.text.value) || ""; };
      return res.status(200).json({ name: val("business_name"), url: val("website"), line: val("tagline") });
    }

    if (body.action === "approve") {
      const p = new URLSearchParams({
        "metadata[noor_approved]": "yes",
        "metadata[noor_name]": String(body.name || "").slice(0, 60),
        "metadata[noor_url]": String(body.url || "").slice(0, 200),
        "metadata[noor_line]": String(body.line || "").slice(0, 90)
      });
      const r = await fetch("https://api.stripe.com/v1/subscriptions/" + sub, { method: "POST", headers: H, body: p });
      return res.status(r.ok ? 200 : 502).json(r.ok ? { ok: true } : { error: "stripe error" });
    }

    if (body.action === "extinguish") {
      const p = new URLSearchParams({ "metadata[noor_approved]": "" });
      const r = await fetch("https://api.stripe.com/v1/subscriptions/" + sub, { method: "POST", headers: H, body: p });
      return res.status(r.ok ? 200 : 502).json(r.ok ? { ok: true } : { error: "stripe error" });
    }

    if (body.action === "release" || body.action === "relight") {
      const p = new URLSearchParams({ cancel_at_period_end: body.action === "release" ? "true" : "false" });
      const r = await fetch("https://api.stripe.com/v1/subscriptions/" + sub, { method: "POST", headers: H, body: p });
      return res.status(r.ok ? 200 : 502).json(r.ok ? { ok: true } : { error: "stripe error" });
    }

    return res.status(400).json({ error: "unknown action" });
  } catch {
    return res.status(502).json({ error: "unavailable" });
  }
}
