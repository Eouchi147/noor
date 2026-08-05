// Lights already lit · public dedications from givers.
// Reads recent gift checkouts from Stripe, passes the dedication lines
// through the Lantern's content gate, and returns only what is worthy of
// the wall: heartfelt, private-data-free, ad-free. CDN-cached 6 hours,
// and the AI is consulted only when the set of dedications changes,
// so this costs a handful of small queries per day at most.

const HARD_REJECT = /(https?:|www\.|\.com|\.net|@|\+?\d[\d\s().-]{6,}|<|>)/i;

let memo = { key: "", items: [] };

async function gate(key, candidates) {
  const SYSTEM = [
    "You are the content gate for public gift dedications on NOOR Codex of Light, a free Islamic library. Each dedication may be shown anonymously on the site.",
    'Reply with JSON ONLY: {"approved":[indexes of acceptable dedications]}',
    "Approve only sincere dedications: to parents, family, the deceased (rahimahullah style), teachers, friends, new Muslims, the ummah, or similar heartfelt intents, in any language.",
    "Reject: anything promotional or brand-like, links or contact details, full names with identifying details, politics, insults or mockery, sexual content, spam or gibberish, requests or messages that are not dedications, and anything that would embarrass a sacred library.",
    "When in doubt, reject."
  ].join("\n");
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "HTTP-Referer": "https://noorcodex.com", "X-Title": "NOOR dedication gate" },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.5",
      max_tokens: 200,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: candidates.map((c, i) => i + ": " + c).join("\n") }
      ]
    })
  });
  if (!r.ok) throw 0;
  const j = await r.json();
  const raw = (((j.choices || [])[0] || {}).message || {}).content || "";
  let p = null;
  try { p = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]); } catch {} } }
  if (!p || !Array.isArray(p.approved)) throw 0;
  return candidates.filter((c, i) => p.approved.indexOf(i) !== -1);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
  const SKEY = process.env.STRIPE_SECRET_KEY;
  const AKEY = process.env.OPENROUTER_API_KEY;
  if (!SKEY || !AKEY) return res.status(200).json({ items: [] });   /* no gatekeeper, no wall */

  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions?limit=60", { headers: { Authorization: "Bearer " + SKEY } });
    if (!r.ok) return res.status(200).json({ items: [] });
    const j = await r.json();
    const seen = new Set();
    const candidates = [];
    (j.data || []).forEach(s => {
      if (s.payment_status !== "paid") return;
      if (!(s.metadata && s.metadata.noor_donation === "1")) return;
      const f = (s.custom_fields || []).find(x => x.key === "dedication");
      let v = f && f.text && f.text.value ? String(f.text.value) : "";
      v = v.replace(/—|–/g, "·").replace(/\s+/g, " ").trim().slice(0, 80);
      if (v.length < 3 || HARD_REJECT.test(v)) return;
      const k = v.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      candidates.push(v);
    });
    if (!candidates.length) { memo = { key: "", items: [] }; return res.status(200).json({ items: [] }); }

    const cacheKey = candidates.join("|");
    if (memo.key === cacheKey) return res.status(200).json({ items: memo.items });

    const approved = (await gate(AKEY, candidates.slice(0, 25))).slice(0, 12);
    memo = { key: cacheKey, items: approved };
    return res.status(200).json({ items: approved });
  } catch {
    /* on any stumble, show the last known-good wall or nothing */
    return res.status(200).json({ items: memo.items || [] });
  }
}
