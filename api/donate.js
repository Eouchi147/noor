// NOOR giving gate. One-time or monthly gifts, any amount within honest
// bounds, billed in the giver's own currency where supported. Stripe live.
// Gifts are sadaqa for a free library: no goods, no perks, no influence.

const CURRENCIES = {
  /* one US dollar to one thousand US dollars, in each currency's own
     minor units, rounded to kind numbers */
  usd: { min: 100, max: 100000 },
  cad: { min: 150, max: 140000 },    gbp: { min: 100, max: 80000 },
  eur: { min: 100, max: 95000 },     aud: { min: 150, max: 155000 },
  aed: { min: 400, max: 365000 },    sar: { min: 400, max: 375000 },
  qar: { min: 400, max: 365000 },    sgd: { min: 150, max: 135000 },
  myr: { min: 500, max: 445000 },    try: { min: 4500, max: 4200000 },
  egp: { min: 5000, max: 4950000 },  mad: { min: 1000, max: 1000000 },
  pkr: { min: 30000, max: 28000000 }, inr: { min: 10000, max: 8400000 },
  idr: { min: 1600000, max: 1600000000 }, ngn: { min: 150000, max: 155000000 }
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
      "line_items[0][price_data][product_data][name]": monthly ? "A monthly gift of light (sadaqa jariyah)" : "A gift of light for the Codex (sadaqa)",
      "line_items[0][price_data][product_data][description]": "Keeps NOOR Codex of Light free, ad-free and tracker-free for every reader.",
      /* optional du'a, shown anonymously so the community prays with the giver.
         Stripe caps custom-field labels at 50 characters; keep it under. */
      "custom_fields[0][key]": "dua",
      "custom_fields[0][label][type]": "custom",
      "custom_fields[0][label][custom]": "Your du'a · shown anonymously for the community",
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
