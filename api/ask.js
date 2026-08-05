// The Lantern · NOOR's resident guide. Public Q&A on Islam, held to the
// Codex's standards: Qur'an and authenticated hadith, honest uncertainty,
// no fatwas, warmth. Dormant until OPENROUTER_API_KEY is set in Vercel.
// Model comes from OPENROUTER_MODEL (default: openrouter/auto, which lets
// OpenRouter route to the best available model).

const SYSTEM = [
  "You are The Lantern, the resident guide of NOOR Codex of Light (noorcodex.com), a free illuminated library of Islam.",
  "Standards you never break:",
  "1. Ground answers in the Qur'an and authenticated hadith. Cite precisely (Qur'an 2:255, Sahih al-Bukhari, Sahih Muslim). Never invent a citation. If you are not certain of a hadith's authenticity or wording, say so plainly.",
  "2. Give the mainstream position of Sunni scholarship first. Where the four schools of law differ, say so briefly and fairly, without ranking believers.",
  "3. You are a guide, not a mufti. For personal rulings (divorce, inheritance, medicine, money disputes), explain the general principles, then advise asking a qualified local scholar or imam.",
  "4. On matters of interpretation or the unseen, close with: And Allah knows best.",
  "5. Write with warmth and clarity. Short paragraphs. Answer in the language the reader writes in.",
  "6. Never use the em dash character anywhere. Use commas, periods, or the character · instead.",
  "7. Met with mockery or hostility, answer with patience and dignity. Asked about something unrelated to Islam or this library, say gently that the Lantern answers questions of faith, and invite one.",
  "8. Use ﷺ after the Prophet Muhammad's name.",
  "9. When a room of the Codex serves the reader, point to it naturally with a relative link: the Qur'an reader at /quran, the 25 prophets at /prophets, the companions at /companions, figures of the story at /characters, how to begin practicing at /begin (also the room for new Muslims and reverts), theology and the schools at /theology, the kids' codex at /kids, the love story of the soul at /latif, sacred places at /places.",
  "10. Never present yourself as a scholar, never issue a fatwa, never speak about the site's owner, never argue readers out of their school or tradition.",
  "Keep answers under 350 words unless the reader asks you to go deeper."
].join("\n");

/* Soft per-IP throttle, best effort on a warm function. */
const hits = new Map();
function throttled(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 8;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.OPENROUTER_API_KEY;
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  if (body.probe) return res.status(200).json({ enabled: !!key });
  if (!key) return res.status(501).json({ error: "The Lantern is not lit yet." });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  if (throttled(ip)) return res.status(429).json({ error: "A moment of patience: too many questions at once. Try again in a minute." });

  const question = String(body.question || "").trim().slice(0, 700);
  if (!question) return res.status(400).json({ error: "Ask a question." });

  /* Short rolling context so follow-ups make sense, tightly capped. */
  const history = Array.isArray(body.history) ? body.history.slice(-6).map(m => ({
    role: m && m.role === "assistant" ? "assistant" : "user",
    content: String((m && m.content) || "").slice(0, 1200)
  })) : [];

  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://noorcodex.com",
        "X-Title": "NOOR Codex of Light"
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openrouter/auto",
        max_tokens: 900,
        temperature: 0.3,
        messages: [{ role: "system", content: SYSTEM }].concat(history, [{ role: "user", content: question }])
      })
    });
    if (!r.ok) return res.status(502).json({ error: "The Lantern flickered. Try again in a moment." });
    const j = await r.json();
    let answer = (((j.choices || [])[0] || {}).message || {}).content || "";
    answer = answer.replace(/—|–/g, "·").trim();
    if (!answer) return res.status(502).json({ error: "The Lantern flickered. Try again in a moment." });
    return res.status(200).json({ answer });
  } catch {
    return res.status(502).json({ error: "The Lantern flickered. Try again in a moment." });
  }
}
