// NOOR Guardian Console data — owner-only (valid noor_admin cookie required).
// Reads live Stripe subscriptions for the Guardian product and returns the
// money map: MRR, every region's subscriber, status, renewal date.

import crypto from "crypto";

const GUARDIAN_PRODUCT = "prod_V0xxFgmX793e9L";

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
  const SECRET = process.env.ADMIN_SECRET, KEY = process.env.STRIPE_SECRET_KEY;
  if (!SECRET) return res.status(501).json({ error: "admin not configured" });
  if (!verify(req.headers.cookie, SECRET)) return res.status(401).json({ error: "locked" });

  const out = {
    stripeConfigured: !!KEY,
    checkoutEnabled: !!KEY,
    mrr: 0, activeCount: 0, guardians: [], fetchedAt: new Date().toISOString()
  };
  if (!KEY) return res.status(200).json(out);

  try {
    let url = "https://api.stripe.com/v1/subscriptions?status=all&limit=100&expand[]=data.customer&expand[]=data.plan.product";
    const r = await fetch(url, { headers: { Authorization: "Bearer " + KEY } });
    if (!r.ok) { out.error = "stripe " + r.status; return res.status(200).json(out); }
    const j = await r.json();
    (j.data || []).forEach(s => {
      const items = (s.items && s.items.data) || [];
      const item = items[0] || {};
      const price = item.price || {};
      const isGuardian = price.product === GUARDIAN_PRODUCT ||
        (price.product && price.product.id === GUARDIAN_PRODUCT) ||
        (s.metadata && s.metadata.noor_market);
      if (!isGuardian) return;
      const live = s.status === "active" || s.status === "trialing";
      const amount = (price.unit_amount || 0) / 100;
      if (live) { out.mrr += amount; out.activeCount += 1; }
      out.guardians.push({
        market: (s.metadata && s.metadata.noor_market) || "?",
        status: s.status,
        amount: amount,
        currency: (price.currency || "usd").toUpperCase(),
        email: (s.customer && s.customer.email) || "",
        name: (s.customer && s.customer.name) || "",
        started: s.start_date ? new Date(s.start_date * 1000).toISOString().slice(0, 10) : "",
        renews: s.current_period_end ? new Date(s.current_period_end * 1000).toISOString().slice(0, 10) : "",
        subscription: s.id
      });
    });
    return res.status(200).json(out);
  } catch (e) {
    out.error = "unreachable";
    return res.status(200).json(out);
  }
}
