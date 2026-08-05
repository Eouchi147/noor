// NOOR giving gate. One-time or monthly gifts, any amount within honest
// bounds, billed in the giver's own currency where supported. Stripe live.
// Gifts are sadaqa for a free library: no goods, no perks, no influence.

const CURRENCIES = {
  usd: { min: 200, max: 2000000 },
  cad: { min: 300, max: 2800000 },   gbp: { min: 200, max: 1600000 },
  eur: { min: 200, max: 1900000 },   aud: { min: 300, max: 3100000 },
  aed: { min: 800, max: 7400000 },   sar: { min: 800, max: 7500000 },
  qar: { min: 800, max: 7300000 },   sgd: { min: 300, max: 2700000 },
  myr: { min: 900, max: 8900000 },   try: { min: 8000, max: 84000000 },
  egp: { min: 10000, max: 99000000 }, mad: { min: 2000, max: 20000000 },
  pkr: { min: 56000, max: 560000000 }, inr: { min: 17000, max: 168000000 },
  idr: { min: 3200000, max: 32000000000 }, ngn: { min: 310000, max: 3100000000 }
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.STRIPE_SECRET_KEY;
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  if (body.probe) return res.status(200).json({ enabled: !!key });
  if (!key) return res.status(501).json({ error: "giving not enabled yet" });

  const cur = CURRENCIES[String(body.currency || "").toLowerCase()] ? String(body.currency).toLowerCase() : "usd";
  const bounds = CURRENCIES[cur];
  let amount = parseInt(body.amountMinor, 10);
  if (!Number.isFinite(amount)) return res.status(400).json({ error: "bad amount" });
  amount = Math.max(bounds.min, Math.min(bounds.max, amount));
  const monthly = !!body.monthly;

  try {
    const host = "https://" + (req.headers.host || "noorcodex.com");
    const params = new URLSearchParams({
      mode: monthly ? "subscription" : "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": cur,
      "line_items[0][price_data][unit_amount]": String(amount),
      "line_items[0][price_data][product_data][name]": monthly ? "Monthly light for the Codex (sadaqa jariyah)" : "A light for the Codex (sadaqa)",
      "line_items[0][price_data][product_data][description]": "Keeps NOOR Codex of Light free, ad-free and tracker-free for every reader.",
      /* optional dedication, shown to the owner in Stripe */
      "custom_fields[0][key]": "dedication",
      "custom_fields[0][label][type]": "custom",
      "custom_fields[0][label][custom]": "Dedicate this light to someone (optional)",
      "custom_fields[0][type]": "text",
      "custom_fields[0][optional]": "true",
      "custom_fields[0][text][maximum_length]": "80",
      success_url: host + "/donate.html?lit=1",
      cancel_url: host + "/donate.html"
    });
    if (monthly) params.set("line_items[0][price_data][recurring][interval]", "month");
    params.set("metadata[noor_donation]", "1");
    if (monthly) params.set("subscription_data[metadata][noor_donation]", "1");
    else params.set("payment_intent_data[metadata][noor_donation]", "1");
    if (body.email) params.set("customer_email", String(body.email).slice(0, 120));

    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });
    if (!r.ok) return res.status(502).json({ error: "stripe error" });
    const j = await r.json();
    return res.status(200).json({ url: j.url });
  } catch {
    return res.status(502).json({ error: "giving unavailable" });
  }
}
