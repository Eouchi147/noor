// NOOR Guardian checkout: dormant until the owner sets STRIPE_SECRET_KEY and
// SPONSOR_PRICE_ID in Vercel env vars. Probe calls report enabled:false until then.
// The owner sends the approved Guardian to sponsor.html AFTER vetting; payment
// never precedes approval.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.STRIPE_SECRET_KEY;
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  // Per-market pricing: SPONSOR_PRICE_ID_CA, SPONSOR_PRICE_ID_GLOBAL, ...
  // falls back to the shared SPONSOR_PRICE_ID when no market-specific price exists.
  const market = (body && typeof body.market === "string" && /^[A-Z0-9_]{1,12}$/.test(body.market)) ? body.market : "";
  const price = (market && process.env["SPONSOR_PRICE_ID_" + market]) || process.env.SPONSOR_PRICE_ID;
  if (!key || !price) {
    if (body && body.probe) return res.status(200).json({ enabled: false });
    return res.status(501).json({ error: "checkout not enabled" });
  }
  if (body && body.probe) return res.status(200).json({ enabled: true });
  try {
    const params = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      success_url: "https://" + (req.headers.host || "") + "/sponsor.html?paid=1",
      cancel_url: "https://" + (req.headers.host || "") + "/sponsor.html"
    });
    if (body && body.email) params.set("customer_email", String(body.email).slice(0, 120));
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });
    if (!r.ok) return res.status(502).json({ error: "stripe error" });
    const j = await r.json();
    return res.status(200).json({ url: j.url });
  } catch {
    return res.status(502).json({ error: "checkout unavailable" });
  }
}
