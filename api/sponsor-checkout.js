// NOOR Guardian checkout v3, weekly lamps edition. Stripe live.
// One Guardian per region at a time. Lamps are held by the week: weekly
// billing, weekly rotation, so a taken region opens again within days.
// The server owns the market→price mapping; the client can only name a
// market id, never a price. Weekly USD: t0 $89 · t1 $59 · t2 $29 · t3 $15 · t4 $6.
// If a region already has a paying Guardian, checkout REFUSES (409) and
// tells the caller when the current week of light ends.

const GUARDIAN_PRODUCT = "prod_V0xxFgmX793e9L";

const PRICE_BY_TIER = {
  0: "price_1U12lYA8jBUhkhi7BZWYj7Ud",  // $89/week Worldwide + capitals
  1: "price_1U12m7A8jBUhkhi7ELu7WiFG",  // $59/week
  2: "price_1U12mMA8jBUhkhi7Dr6SZFhd",  // $29/week
  3: "price_1U12mbA8jBUhkhi7igLMTRW1",  // $15/week
  4: "price_1U12mjA8jBUhkhi7PsB9EcU3"   // $6/week
};

const MARKET_TIER = {
  CA:1,"CA-TOR":1,"CA-QC-FR":1,"CA-VAN":1,"CA-AB":1,"CA-PR":1,"CA-ATL":1,
  "US-EAST":1,"US-CEN":1,"US-MTN":1,"US-WEST":1,"US-AKHI":2,US:1,
  UK:1,IE:1,FR:1,DE:1,NL:1,BE:1,CH:1,AT:1,SE:1,NO:1,DK:1,
  ES:2,IT:2,PT:2,PL:2,BALKAN:3,UA:3,RU:3,
  AE:1,SA:1,QA:1,KW:1,BH:1,OM:2,JO:3,LB:3,IQ:3,SY:4,YE:4,IR:3,"IL-PS":3,TR:2,
  EG:3,MA:3,DZ:3,TN:3,LY:3,SD:4,NG:3,GH:3,KE:3,ZA:2,
  PK:3,IN:3,BD:3,LK:3,NP:4,AF:4,MV:3,KZ:3,AZ:3,
  ID:3,MY:2,SG:1,BN:2,PH:3,MM:4,JP:1,KR:2,"CN-HK":2,
  "AU-SYD":1,"AU-MEL":1,"AU-BRI":1,"AU-PER":1,AU:1,NZ:1,
  MX:2,BR:2,"AR-CL":2,"CO-PE":3,CARIB:3,
  "L-AR":2,"L-FR":2,"L-UR":3,"L-TR":3,"L-ID":3,"L-BN":3,"L-FA":3,"L-ES":3,
  GLOBAL:0
};

/* Local-currency billing: markets below are charged in their own currency via
   the prices' currency_options (set in Stripe). Everyone else pays USD. */
const MARKET_CURRENCY = {
  CA:"cad","CA-TOR":"cad","CA-QC-FR":"cad","CA-VAN":"cad","CA-AB":"cad","CA-PR":"cad","CA-ATL":"cad",
  UK:"gbp", IE:"eur",FR:"eur",DE:"eur",NL:"eur",BE:"eur",AT:"eur",ES:"eur",IT:"eur",PT:"eur","L-FR":"eur",
  "AU-SYD":"aud","AU-MEL":"aud","AU-BRI":"aud","AU-PER":"aud",AU:"aud",
  AE:"aed",SA:"sar",QA:"qar",SG:"sgd",MY:"myr",TR:"try",EG:"egp",MA:"mad",PK:"pkr",IN:"inr",ID:"idr",NG:"ngn"
};

const OCCUPYING = ["active", "trialing", "past_due"];

/* Is this market's lamp already held? Returns null (free) or the epoch
   seconds when the current week ends. */
async function occupiedUntil(key, market) {
  const q = "metadata['noor_market']:'" + market.replace(/'/g, "") + "'";
  const r = await fetch("https://api.stripe.com/v1/subscriptions/search?limit=20&query=" + encodeURIComponent(q), {
    headers: { Authorization: "Bearer " + key }
  });
  if (!r.ok) return null;   /* fail open rather than block a sale on a hiccup */
  const j = await r.json();
  let until = null;
  (j.data || []).forEach(s => {
    if (OCCUPYING.indexOf(s.status) === -1) return;
    const end = s.current_period_end || 0;
    if (!until || end > until) until = end;
  });
  return until;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.STRIPE_SECRET_KEY;
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const market = (typeof body.market === "string" && /^[A-Z0-9_-]{1,12}$/i.test(body.market) && MARKET_TIER[body.market] !== undefined)
    ? body.market : "GLOBAL";
  const tier = MARKET_TIER[market];
  const price = process.env["SPONSOR_PRICE_ID_" + market.replace(/-/g, "_")] || PRICE_BY_TIER[tier];

  if (!key || !price) {
    if (body.probe) return res.status(200).json({ enabled: false });
    return res.status(501).json({ error: "checkout not enabled" });
  }
  if (body.probe) return res.status(200).json({ enabled: true, market, tier });

  try {
    /* One lamp per region: refuse while another Guardian's week still burns. */
    const until = await occupiedUntil(key, market);
    if (until) {
      return res.status(409).json({
        taken: true,
        market,
        until: new Date(until * 1000).toISOString().slice(0, 10),
        message: "This region's lamp is lit by another Guardian. It opens again on " +
                 new Date(until * 1000).toISOString().slice(0, 10) + ", usually within a week."
      });
    }

    const params = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      "subscription_data[metadata][noor_market]": market,
      "metadata[noor_market]": market,
      /* Guardian intake, right inside checkout: name, link, one line. */
      "custom_fields[0][key]": "business_name",
      "custom_fields[0][label][type]": "custom",
      "custom_fields[0][label][custom]": "Business or brand name (shown on the site)",
      "custom_fields[0][type]": "text",
      "custom_fields[0][text][maximum_length]": "60",
      "custom_fields[1][key]": "website",
      "custom_fields[1][label][type]": "custom",
      "custom_fields[1][label][custom]": "Your website or link",
      "custom_fields[1][type]": "text",
      "custom_fields[1][text][maximum_length]": "120",
      "custom_fields[2][key]": "tagline",
      "custom_fields[2][label][type]": "custom",
      "custom_fields[2][label][custom]": "One short line about you (optional)",
      "custom_fields[2][type]": "text",
      "custom_fields[2][optional]": "true",
      "custom_fields[2][text][maximum_length]": "80",
      success_url: "https://" + (req.headers.host || "noorcodex.com") + "/sponsor.html?paid=1&market=" + encodeURIComponent(market),
      cancel_url: "https://" + (req.headers.host || "noorcodex.com") + "/sponsor.html?market=" + encodeURIComponent(market)
    });
    if (body.email) params.set("customer_email", String(body.email).slice(0, 120));
    const cur = MARKET_CURRENCY[market];
    if (cur) params.set("currency", cur);   /* bill Guardians in their own money */
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
