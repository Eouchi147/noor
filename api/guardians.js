// NOOR public lamp map. Which regions are taken this week, and which
// Guardians are approved to shine. Read-only, no reader data touches this:
// the page asks "who holds the lamps" and nothing more.
// CDN-cached five minutes so Stripe is barely touched at any traffic level.

const GUARDIAN_PRODUCT = "prod_V0xxFgmX793e9L";
const OCCUPYING = ["active", "trialing", "past_due"];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
  const KEY = process.env.STRIPE_SECRET_KEY;
  const out = { enabled: !!KEY, taken: {}, lit: {} };
  if (!KEY) return res.status(200).json(out);

  try {
    let url = "https://api.stripe.com/v1/subscriptions?limit=100&status=all";
    const r = await fetch(url, { headers: { Authorization: "Bearer " + KEY } });
    if (!r.ok) return res.status(200).json(out);
    const j = await r.json();
    (j.data || []).forEach(s => {
      if (OCCUPYING.indexOf(s.status) === -1) return;
      const md = s.metadata || {};
      const market = md.noor_market;
      if (!market) return;
      const item = ((s.items && s.items.data) || [])[0] || {};
      const prod = item.price && item.price.product;
      if (prod && prod !== GUARDIAN_PRODUCT) return;
      const until = s.current_period_end ? new Date(s.current_period_end * 1000).toISOString().slice(0, 10) : "";
      const prev = out.taken[market];
      if (!prev || until > prev.until) out.taken[market] = { until };
      /* The lamp only shines after the owner's approval. */
      if (md.noor_approved === "yes" && md.noor_name) {
        out.lit[market] = {
          name: String(md.noor_name).slice(0, 60),
          url: /^https?:\/\//i.test(md.noor_url || "") ? String(md.noor_url).slice(0, 200) : "",
          line: String(md.noor_line || "").slice(0, 90),
          until
        };
      }
    });
    return res.status(200).json(out);
  } catch {
    return res.status(200).json(out);
  }
}
