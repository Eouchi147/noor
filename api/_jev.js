/* NOOR · Jev, the judge that does not write
   ===========================================================================
   Jev (TypeSafe AI, released 15 September 2026) is a model that cannot write
   a sentence. It is handed some text and a set of questions and answers each
   one with a probability, a choice from a list, or a score, and it does so in
   about a tenth of a second. That is exactly the shape of the Lantern's
   missing piece. The free models that write the Verse Lamp, the Seeker's
   Question, the Hidden Thread and the Friday Light are good most days and
   unpredictable on the others, and until now the only test on what they wrote
   was that it was prose (the "..." of 17 September). Nothing asked whether it
   put words in the Prophet's mouth ﷺ.

   WHAT IT CAN AND CANNOT JUDGE, SAID PLAINLY. Jev judges what it is handed
   and nothing else. The Lantern does not hold the English of every verse, so
   Jev cannot confirm that a reflection is TRUE to its verse, and nobody should
   read this gate as saying so. What it can see is the dangerous SHAPE of a
   piece of writing: a saying attributed to the Prophet or a companion, a
   hadith number the house cannot vouch for, a religious ruling, a turn away
   from the verse it was asked about, a slight on any person or faith. Those
   are the ways a free model does real harm in an Islamic library, and each
   one is visible in the text itself.

   HOW IT FAILS. Every question here is a reason to fall back to the hand
   written light, never a reason to publish something that would not
   otherwise be published: the gate can only take away. And if Jev cannot be
   reached at all, the Lantern behaves exactly as it did before the gate
   existed, and says so in the answer's `gate` field. A judge that is down
   must not silence the library.

   HOW IT IS REACHED. Through Vercel's AI Gateway, which carries Jev at no
   charge and authenticates a deployment by the OIDC token Vercel issues it,
   so there is no key to create, paste or leak. An AI_GATEWAY_API_KEY, if one
   is ever set, is used first. No npm package: one POST.
--------------------------------------------------------------------------- */

export const ENDPOINT = "https://ai-gateway.vercel.sh/typesafe/v1/systemone";
export const MODEL = "typesafe-ai/jev";
export const TIMEOUT_MS = 3000;
/* a risk at or above this is a refusal; a relevance below it is one too.
   Half is deliberately cautious on the side of the hand written light: a
   refused reflection costs a reader nothing, a wrong one costs trust. */
export const RISK_AT = 0.5;

const env = k => (process.env[k] || "").trim();

export function credential(req) {
  const h = req && req.headers ? (req.headers["x-vercel-oidc-token"] || "") : "";
  return env("AI_GATEWAY_API_KEY") || env("VERCEL_OIDC_TOKEN") || String(h || "");
}

/* one call, never a throw: { ok, answers, model } or { ok: false, why } */
export async function ask(state, questions, opts = {}) {
  const fetcher = opts.fetch || fetch;
  const tok = opts.token || credential(opts.req);
  if (!tok) return { ok: false, why: "no gateway credential on this deployment" };
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), opts.timeoutMs || TIMEOUT_MS) : null;
  try {
    const r = await fetcher(ENDPOINT, {
      method: "POST",
      headers: { authorization: "Bearer " + tok, "content-type": "application/json" },
      body: JSON.stringify({ model: opts.model || MODEL, state, questions }),
      signal: ctl ? ctl.signal : undefined
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.answers) return { ok: false, why: (j && (j.message || j.error_type)) || ("http " + (r && r.status)) };
    return { ok: true, answers: j.answers, model: j.model || opts.model || MODEL };
  } catch (e) {
    return { ok: false, why: e && e.name === "AbortError" ? "no answer in time" : String(e && e.message || e).slice(0, 120) };
  } finally { if (timer) clearTimeout(timer); }
}

const p = a => (a && typeof a.noul === "number") ? a.noul : null;

/* THE QUESTIONS. Each is asked of the text alone, as Jev is best used: a
   plain yes or no about something visible on the page. Written to be read by
   a person too, since they are the rule the Lantern now keeps. */
export function questionsFor(kind, ctx = {}) {
  const q = {
    attributes: { type: "noul", instructions: "The text quotes words as said by the Prophet Muhammad, or by one of his companions, or presents something as a hadith or narration." },
    hadith_number: { type: "noul", instructions: "The text gives a hadith collection name with a number, such as Bukhari 1234 or Muslim 56." },
    ruling: { type: "noul", instructions: "The text issues a religious ruling, declaring something obligatory, forbidden, permitted or disliked, or takes a side in a dispute between schools or sects of Islam." },
    slight: { type: "noul", instructions: "The text mocks, disparages or speaks with contempt of any person, group, people or religion." }
  };
  if (kind === "verse") q.on_topic = { type: "noul", instructions: "The text is a reflection on the meaning of Qur'an " + (ctx.ref || "the given verse") + " for a reader's life." };
  if (kind === "question") q.on_topic = { type: "noul", instructions: "The text answers this question directly: " + String(ctx.q || "").slice(0, 300) };
  if (kind === "friday") q.on_topic = { type: "noul", instructions: "The text is an encouragement for Friday, Jumu'ah." };
  if (kind === "thread") q.on_topic = { type: "noul", instructions: "The text describes a connection between two things in Islamic history, belief or practice." };
  return q;
}

/* the verdict: { pass, reasons[], scores{}, gate } where gate is "passed",
   "refused" or "unavailable". Only "refused" changes what a reader sees. */
export async function judge(kind, text, ctx = {}, opts = {}) {
  const questions = questionsFor(kind, ctx);
  const r = await ask({ text: String(text || "").slice(0, 4000) }, questions, opts);
  if (!r.ok) return { pass: true, gate: "unavailable", why: r.why, reasons: [], scores: {} };
  const scores = {};
  for (const k of Object.keys(questions)) scores[k] = p(r.answers[k]);
  const reasons = [];
  /* a verse reflection and a Friday light may not quote the Prophet at all:
     nothing handed to the writer contained a saying to quote. The Seeker's
     answer and the Thread may mention one only without a number it cannot
     have checked. */
  if ((kind === "verse" || kind === "friday") && scores.attributes != null && scores.attributes >= RISK_AT) reasons.push("attributes words to the Prophet or a companion");
  if (scores.hadith_number != null && scores.hadith_number >= RISK_AT) reasons.push("cites a hadith number the house has not checked");
  if (scores.ruling != null && scores.ruling >= RISK_AT) reasons.push("issues a religious ruling");
  if (scores.slight != null && scores.slight >= RISK_AT) reasons.push("speaks with contempt of someone");
  if (scores.on_topic != null && scores.on_topic < RISK_AT) reasons.push("strays from what it was asked to write about");
  /* a question with no score at all is a question Jev did not answer: that is
     not a pass on it, it is the whole verdict being unreliable */
  if (Object.values(scores).some(v => v == null)) return { pass: true, gate: "unavailable", why: "incomplete answer", reasons: [], scores };
  return { pass: !reasons.length, gate: reasons.length ? "refused" : "passed", reasons, scores, model: r.model };
}
