// The licensing gate. Organizations (masjids, schools, apps, websites)
// subscribe to embed NOOR's rooms in their own spaces. This is the one
// business door of the house: readers never see it; the library stays
// free and non-commercial for every person. Stripe live, USD.

const TIERS = {
  room:  { m: 1900,  y: 19000,  name: "NOOR Embed · One Room",
           desc: "License to embed one chosen room of NOOR Codex of Light (the Mushaf, the 25 Prophets, Learn Arabic, the Kids' Codex, the Pillars, or any other) in one website or app." },
  codex: { m: 4900,  y: 49000,  name: "NOOR Embed · The Whole Codex",
           desc: "License to embed every room of NOOR Codex of Light in one website or app, with all future rooms included." },
  org:   { m: 14900, y: 149000, name: "NOOR Embed · Schools & Apps",
           desc: "License to embed every room of NOOR Codex of Light, including the complete Madrasa curriculum (ages 0 to 18), across up to five domains or apps of one organization, with priority email support." }
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.STRIPE_SECRET_KEY;
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  if (body.probe) return res.status(200).json({ enabled: !!key });
  if (!key) return res.status(501).json({ error: "licensing not enabled yet" });

  const tier = TIERS[body.tier] ? String(body.tier) : "codex";
  const t = TIERS[tier];
  const yearly = !!body.yearly;

  try {
    const host = "https://" + (req.headers.host || "noorcodex.com");
    const params = new URLSearchParams({
      mode: "subscription",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(yearly ? t.y : t.m),
      "line_items[0][price_data][recurring][interval]": yearly ? "year" : "month",
      "line_items[0][price_data][product_data][name]": t.name + (yearly ? " · yearly" : " · monthly"),
      "line_items[0][price_data][product_data][description]": t.desc,
      /* Stripe caps custom-field labels at 50 characters. */
      "custom_fields[0][key]": "domain",
      "custom_fields[0][label][type]": "custom",
      "custom_fields[0][label][custom]": "Website or app where NOOR will live",
      "custom_fields[0][type]": "text",
      "custom_fields[0][optional]": "false",
      "custom_fields[0][text][maximum_length]": "80",
      "metadata[noor_license]": "1",
      "metadata[tier]": tier,
      "subscription_data[metadata][noor_license]": "1",
      "subscription_data[metadata][tier]": tier,
      success_url: host + "/license.html?welcome=1&tier=" + tier,
      cancel_url: host + "/license.html"
    });
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
    return res.status(502).json({ error: "licensing unavailable" });
  }
}
