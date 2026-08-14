import { askOpenRouter, allowPaid } from "./_models.js";
// NOOR Guide: optional live clarifier for a passage being read.
// Runs on OPENROUTER_API_KEY (same key as The Lantern); falls back to
// ANTHROPIC_API_KEY if that is set instead. Site works fully without either.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  /* Public per-article AI is off by default to keep usage disciplined.
     Set GUIDE_PUBLIC=1 in Vercel env to light it. */
  if (process.env.GUIDE_PUBLIC !== "1") return res.status(501).json({ error: "guide API not enabled" });
  const orKey = process.env.OPENROUTER_API_KEY;
  const key = process.env.ANTHROPIC_API_KEY;
  /* the Anthropic branch bills directly, so it is only reachable when paid
     models have been allowed in as many words */
  if (!orKey && !(key && allowPaid())) return res.status(501).json({ error: "guide API not enabled" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const question = String((body && body.question) || "").slice(0, 400).trim();
  const title = String((body && body.title) || "").slice(0, 160);
  const excerpt = String((body && body.excerpt) || "").slice(0, 6000);
  if (!question || !excerpt) return res.status(400).json({ error: "question and excerpt required" });

  const system = [
    "You are the quiet reading guide of NOOR, an Islamic chronological history site.",
    "Answer ONLY from the article excerpt provided. If the excerpt does not settle the question, say so plainly and suggest asking a trusted scholar or local imam.",
    "Never give religious rulings (fatwa), never speculate beyond the text, never cite sources not present in the excerpt.",
    "Tone: warm, plain, reverent. Length: 2 to 3 sentences. Use ﷺ after the Prophet's name. Do not use em dashes."
  ].join(" ");

  try {
    const userMsg = `Chapter: ${title}\n\nArticle excerpt:\n${excerpt}\n\nReader's question: ${question}`;
    let answer = "";
    if (orKey) {
      /* this used to be openrouter/auto, which routes to the BEST model rather
         than the cheapest, and quietly billed every question a reader asked */
      const got = await askOpenRouter(
        [{ role: "system", content: system }, { role: "user", content: userMsg }],
        { max_tokens: 250, temperature: 0.2 }
      );
      if (!got.text) return res.status(502).json({ error: "upstream error" });
      answer = got.text;
    } else if (allowPaid()) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 250,
          temperature: 0.2,
          system,
          messages: [{ role: "user", content: userMsg }]
        })
      });
      if (!r.ok) return res.status(502).json({ error: "upstream error" });
      const j = await r.json();
      answer = (j.content || []).map(c => c.text || "").join(" ").trim();
    }
    answer = answer.replace(/—|–/g, "·");
    if (!answer) return res.status(502).json({ error: "empty answer" });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ answer });
  } catch {
    return res.status(502).json({ error: "guide unavailable" });
  }
}
