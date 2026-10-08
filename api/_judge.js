/* NOOR · Jev wherever a judgement is enough
   ===========================================================================
   Round four, 7 October 2026. The owner: "I want to take advantage of JEV or
   any new ultra cheap but efficient tool like JEV." Jev (api/_jev.js) cannot
   write, but it can answer a typed question about a text in a tenth of a
   second for a few thousandths of a cent, keeping nothing and learning
   nothing (zero data retention and no training on every call). So wherever
   the Lantern needs a judgement and not a sentence, it asks Jev first, and a
   writing model only when words are needed or Jev is unsure:

     mailKind      the inbox's first pass: which of the house's 17 kinds an
                   email is, a choice with a probability for each. Taken as
                   it is when the top probability is SURE_AT (0.7) or more;
                   below that, or with any real chance of distress, the mail
                   tier reads it as before (api/_mail.js).
     letterRisk    every letter and reply the house would send, seven yes or
                   no questions (money promised, pressure to give, a ruling,
                   claiming to be a person, someone's details, asking for
                   anything improper, off topic). Any at RISK_AT (0.5) or
                   above holds the email, on top of the red-line guard and
                   the Guardian (api/_mail.js queueOutgoing). Round five (the
                   letterhead): an eighth, whether it reads as written by an
                   AI; and before Jev, in code, the house's own rules over the
                   words (api/_letterhead.js slopCheck: a dash, an emoji, the
                   machine's stock phrases), which hold a letter judge or no
                   judge. A held letter says so in `slop`, with its `hits` as
                   words to avoid, so the writer may try once more.
     jevScorePlace how well a place the research found fits the house's
                   offer, a score from its own pages' facts (api/_outreach.js
                   research, optional: it only adds to a place's order).
     screenBrief   the morning brief, the five religious questions and two of
                   its own (thinking aloud, a promise); a risky paragraph
                   gives way to the template.
     screenIdeas   the weekly reflection's ideas to grow: an idea that would
                   break the house's rules, misrepresent Islam or name no
                   concrete step is dropped before it reaches the owner.

   THE RULE OF A DOWN JUDGE. Every function here answers {unavailable: true}
   when Jev cannot be reached, gave an incomplete answer or no credential is
   set, and every caller then behaves exactly as it did before Jev was asked:
   a down judge never sends anything that would otherwise be held, and never
   holds anything that would otherwise go. Jev can only take away or save a
   model call; it never adds a word.
--------------------------------------------------------------------------- */
import { ask, prob, RISK_AT, SURE_AT, TEXT_QUESTIONS, TEXT_LABEL } from "./_jev.js";
import { slopCheck } from "./_letterhead.js";   /* round five: the house's rules over the words */

const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n || 200);

/* ---------------------------------------------------------------------------
   1. THE INBOX'S FIRST PASS: a choice among the house's own kinds
--------------------------------------------------------------------------- */
export const MAIL_KIND_CRITERIA = Object.freeze({
  question: "a reader asks something about Islam, the Qur'an, prayer, the library or one of its pages",
  thanks: "a reader thanks the house, or says the library helped them",
  feedback: "a reader gives an opinion or a suggestion about the library",
  correction: "someone says a fact, a page, a date or a translation in the library may be wrong",
  "outreach-answer": "a mosque, school, society or other place answers a letter the house wrote to it",
  partnership: "an offer to work together, collaborate, sponsor or join a project, or a request to meet or to call",
  press: "a journalist, newspaper, magazine, podcast or broadcaster asks for an interview or a comment",
  money: "money: a donation, a gift, a receipt, a payment, a refund, an invoice, a grant or a sponsorship amount",
  notice: "an automatic notice from a platform or a service",
  security: "a security, sign in, password, account or billing notice",
  spam: "spam, a scam, phishing, or a sales pitch unrelated to the library",
  personal: "a personal message for the owner himself, not about the library",
  no: "they decline, unsubscribe or ask not to be written to again",
  legal: "a legal matter: copyright, a takedown request, a lawyer, a court or terms",
  complaint: "a complaint about the library, its content or the way it wrote to someone",
  distress: "someone who may be at risk, in crisis, or thinking of harming themselves",
  newsletter: "a newsletter or a message from a mailing list"
});
const MAIL_KIND_Q = Object.freeze({
  kind: { type: "choice", instructions: "What kind of email is this? It came to the inbox of NOOR Codex of Light, a free online library of Islam.", criteria: MAIL_KIND_CRITERIA }
});
/* any real chance of someone at risk is never left to a choice: the mail
   tier reads it, and the house's own fixed words still go first there */
export const DISTRESS_WATCH = 0.2;
/* msg: {subject, text}, already masked by the caller (api/_mail.js
   maskForModel). {ok, kind, p, probs, sure} or {ok:false, unavailable, why} */
export async function mailKind(msg, opts = {}) {
  const state = { subject: str(msg && msg.subject, 300), email: String((msg && msg.text) || "").slice(0, 3500) };
  const r = await ask(state, MAIL_KIND_Q, { ...opts, purpose: "mail-kind" });
  if (!r.ok) return { ok: false, unavailable: true, why: r.why };
  const a = r.answers && r.answers.kind;
  const kind = a && typeof a.choice === "string" && Object.prototype.hasOwnProperty.call(MAIL_KIND_CRITERIA, a.choice) ? a.choice : null;
  if (!kind) return { ok: false, unavailable: true, why: "an incomplete answer" };
  const probs = a.probabilities && typeof a.probabilities === "object" ? a.probabilities : {};
  const p = Number.isFinite(Number(probs[kind])) ? Number(probs[kind]) : (Number.isFinite(Number(a.confidence)) ? Number(a.confidence) : 0);
  const distress = Number(probs.distress) || 0;
  const sure = p >= SURE_AT && (kind === "distress" || distress < DISTRESS_WATCH);
  return { ok: true, kind, p: Math.round(p * 1000) / 1000, probs, sure, distressP: distress };
}

/* ---------------------------------------------------------------------------
   2. EVERY LETTER AND REPLY: eight yes or no questions (round five: the
      eighth, and the house's rules over the words before them)
--------------------------------------------------------------------------- */
/* ROUND TEN (7 October 2026). The owner, after nine letters were held one
   evening: "please fix it so it can send on its own with the lantern fixing
   the issues it finds instead of blocking and leaving me in the dust". The
   first question read the house's own free offer as a promise of value,
   and held every letter that made it (0.63, 0.64): giving freely, with
   nothing asked back, is the whole of what the house writes to say. It now
   asks what it was meant to ask: money, a payment, a prize or a reward, or
   an offer that depends on the reader doing something. The second question
   tells a gentle suggestion from pressure. */
export const LETTER_QUESTIONS = Object.freeze({
  promises_money: { type: "boolean", instructions: "The email promises money, a payment, a prize or a reward, or offers to pay for something, or makes anything it offers depend on the reader doing something in return. Offering the library's own free material (its pages, lessons, curriculum, printables or reels) with nothing asked in return is not this." },
  pressure_to_give: { type: "boolean", instructions: "The email asks for money or a donation, or presses the reader to give, share, post or follow, or urges them to act by insisting, setting a deadline or making them feel guilty. One gentle suggestion they may take or leave is not this." },
  religious_ruling: { type: "boolean", instructions: "The email issues a religious ruling in its own words, declaring something obligatory, forbidden, permitted or disliked." },
  claims_person: { type: "boolean", instructions: "The email claims to be written by a person (a named individual, an imam, a scholar or a member of staff) rather than by the library itself." },
  shares_details: { type: "boolean", instructions: "The email shares someone's personal details: another person's contact details, an email address, a phone number or a home address." },
  asks_improper: { type: "boolean", instructions: "The email asks for something improper: personal information, a password or account access, private data about anyone, or anything dishonest." },
  off_topic: { type: "boolean", instructions: "The email strays from what the house writes about: the free library and its pages, its free offer, faith and learning, or the message it answers." },
  /* round five (the letterhead): the eighth, the owner's "remove AI slop" */
  ai_voice: { type: "boolean", instructions: "The email reads as written by an AI: stock phrases, empty praise, or lists of three adjectives." }
});
export const LETTER_LABEL = Object.freeze({
  promises_money: "it promises money or a reward", pressure_to_give: "it presses the reader to give or to act",
  religious_ruling: "it gives a religious ruling", claims_person: "it claims to be written by a person",
  shares_details: "it shares someone's details", asks_improper: "it asks for something improper", off_topic: "it strays from what the house writes about",
  ai_voice: "it reads as written by an AI"
});
/* round ten: what a writer is told to change when a question holds a
   letter, so the Lantern's next draft mends it instead of the letter
   stopping there */
export const LETTER_MEND = Object.freeze({
  promises_money: "offer only the library's free material, with nothing asked in return, and never mention money, a payment, a prize or a reward",
  pressure_to_give: "make the one step a gentle suggestion they may take or leave, with no urging, no deadline and no request to share or follow",
  religious_ruling: "give no ruling of any kind; point to the library's pages instead",
  claims_person: "speak as the library itself, never as a person, an imam, a scholar or a member of staff",
  shares_details: "carry no one's contact details, no address and no phone number",
  asks_improper: "ask for nothing at all except, if it helps them, a short reply",
  off_topic: "speak only of the free library, its offer to this place and the place's own teaching",
  ai_voice: "write it plainly, as the house speaks, with no stock phrase, no empty praise and no list of three adjectives"
});
/* the house's rules over the words, as one reason a writer can act on */
export function slopReason(hits) {
  const h = (Array.isArray(hits) ? hits : []).map(x => String(x)).filter(Boolean);
  return h.length ? "it uses what the house never writes: " + h.slice(0, 8).join("; ") + "; write it again without any of them" : "";
}
/* m: {subject, text}. {held, reasons[], scores{}, slop, hits[]} or
   {held:false, unavailable}. slop: the hold is one a writer may mend (the
   house's rules over the words, or the eighth question alone) */
export async function letterRisk(m, opts = {}) {
  const subject = str(m && m.subject, 300), body = String((m && m.text) || "");
  /* round five: the house's own rules first, in code, judge or no judge,
     over the words the house wrote (a reply's subject is the sender's own
     "Re:", which is not the house's to mend) */
  const sc = slopCheck(body);
  if (!sc.ok) return { held: true, unavailable: false, slop: true, hits: sc.hits, reasons: [slopReason(sc.hits)], scores: {} };
  const state = { subject, email: body.slice(0, 3800) };
  const r = await ask(state, LETTER_QUESTIONS, { ...opts, purpose: "letter" });
  if (!r.ok) return { held: false, unavailable: true, why: r.why, reasons: [], scores: {} };
  const scores = {};
  for (const k of Object.keys(LETTER_QUESTIONS)) scores[k] = prob(r.answers && r.answers[k]);
  if (Object.values(scores).some(v => v == null)) return { held: false, unavailable: true, why: "an incomplete answer", reasons: [], scores };
  const risky = Object.keys(scores).filter(k => scores[k] >= RISK_AT);
  const reasons = risky.map(k => LETTER_LABEL[k] + " (" + Math.round(scores[k] * 100) / 100 + ")"
    + (k === "ai_voice" ? ": write it plainly, as the house speaks, with no stock phrase, no empty praise and no list of three adjectives" : ""));
  /* round ten: and how to mend each, for the writer's next draft */
  const mend = risky.map(k => LETTER_MEND[k]).filter(Boolean);
  return { held: reasons.length > 0, unavailable: false, reasons, mend, scores, slop: risky.length === 1 && risky[0] === "ai_voice", hits: [] };
}

/* ---------------------------------------------------------------------------
   3. A PLACE THE RESEARCH FOUND: how well it fits the house's offer
--------------------------------------------------------------------------- */
export const PLACE_FIT = Object.freeze([
  "no fit: not a place that teaches Islam or gathers Muslims to learn",
  "a weak fit: a place of worship, with no teaching mentioned",
  "a fair fit: some classes, study circles or community programmes",
  "a good fit: a school, a weekend school, youth work or regular classes",
  "the best fit: a network, a trust or a foundation that teaches many people or runs several schools"
]);
const PLACE_Q = Object.freeze({
  fit: { type: "score", instructions: "Judged only from what this place's own pages say, how well would a free online library of Islam (lessons, a full curriculum, printables for classes, short reels) serve the place's own teaching?", criteria: PLACE_FIT }
});
/* facts: the facts the research kept from the place's own pages ({text}
   or strings); ctx: {name, kind}. {ok, score (0 to 1), rung, label} or
   {ok:false, unavailable} */
export async function jevScorePlace(facts, ctx = {}, opts = {}) {
  const list = (Array.isArray(facts) ? facts : []).map(f => str(f && typeof f === "object" ? f.text : f, 300)).filter(Boolean).slice(0, 8);
  if (!list.length) return { ok: false, unavailable: true, why: "no facts to judge" };
  const state = { place: { name: str(ctx.name, 120) || null, kind: str(ctx.kind, 40) || null }, facts: list };
  const r = await ask(state, PLACE_Q, { ...opts, purpose: "place" });
  if (!r.ok) return { ok: false, unavailable: true, why: r.why };
  const a = r.answers && r.answers.fit;
  const sc = a && Number.isFinite(Number(a.score)) ? Number(a.score) : null;
  if (sc == null) return { ok: false, unavailable: true, why: "an incomplete answer" };
  const top = PLACE_FIT.length - 1;
  const rung = Math.max(0, Math.min(top, Math.round(sc)));
  return { ok: true, score: Math.round(Math.max(0, Math.min(1, sc / top)) * 1000) / 1000, rung, label: PLACE_FIT[rung].split(":")[0] };
}

/* ---------------------------------------------------------------------------
   4. THE BRIEF AND THE IDEAS
--------------------------------------------------------------------------- */
export const BRIEF_QUESTIONS = Object.freeze({
  ...TEXT_QUESTIONS,
  thinks_aloud: { type: "boolean", instructions: "The text talks about writing itself, its instructions or its task, instead of simply reporting the house's morning." },
  promises: { type: "boolean", instructions: "The text promises a result, or speaks of a future outcome as certain." }
});
const BRIEF_LABEL = { ...TEXT_LABEL, thinks_aloud: "thinks aloud about its task", promises: "promises a result" };
/* {risky, reasons[], scores{}} or {risky:false, unavailable}: the shape
   api/_home.js writeBrief already reads from its risk() */
export async function screenBrief(text, opts = {}) {
  const r = await ask({ text: String(text || "").slice(0, 4000) }, BRIEF_QUESTIONS, { ...opts, purpose: "brief" });
  if (!r.ok) return { risky: false, unavailable: true, why: r.why, reasons: [], scores: {} };
  const scores = {};
  for (const k of Object.keys(BRIEF_QUESTIONS)) scores[k] = prob(r.answers && r.answers[k]);
  if (Object.values(scores).some(v => v == null)) return { risky: false, unavailable: true, why: "an incomplete answer", reasons: [], scores };
  const reasons = Object.keys(scores).filter(k => scores[k] >= RISK_AT).map(k => BRIEF_LABEL[k]);
  return { risky: reasons.length > 0, unavailable: false, reasons, scores };
}

export const IDEA_QUESTIONS = Object.freeze({
  breaks_rules: { type: "boolean", instructions: "The idea would break one of these rules: never press readers for money or promise them anything for a gift, never show advertisements, never put the library behind a payment, never message an individual person, never create accounts or spend money, never change the house's own rules, caps or code without its owner, never deceive anyone." },
  misrepresents_islam: { type: "boolean", instructions: "The idea or its wording would misrepresent Islam: words put in the mouth of the Prophet or a companion, a ruling, a side taken between schools or sects, a prophet shown, or contempt for any person or faith." },
  vague: { type: "boolean", instructions: "The idea is vague: it names no concrete step, no page, no place and no way to tell whether it worked." }
});
const IDEA_LABEL = { breaks_rules: "it would break the house's rules", misrepresents_islam: "it may misrepresent Islam", vague: "it names no concrete step" };
/* the ideas, each judged on its own: {kept[], dropped[{title, reasons}],
   unavailable}. An idea Jev could not judge is kept, as before. */
export async function screenIdeas(ideas, opts = {}) {
  const list = (Array.isArray(ideas) ? ideas : []).filter(x => x && typeof x === "object");
  const kept = [], dropped = [];
  let unavailable = 0;
  for (const idea of list) {
    const text = [str(idea.title, 200), str(idea.why, 600), str(idea.spec, 600), Array.isArray(idea.steps) ? idea.steps.map(s => str(s, 160)).join("; ") : ""].filter(Boolean).join("\n");
    const r = await ask({ idea: text }, IDEA_QUESTIONS, { ...opts, purpose: "idea" });
    if (!r.ok) { unavailable++; kept.push(idea); continue; }
    const scores = {};
    for (const k of Object.keys(IDEA_QUESTIONS)) scores[k] = prob(r.answers && r.answers[k]);
    if (Object.values(scores).some(v => v == null)) { unavailable++; kept.push(idea); continue; }
    const reasons = Object.keys(scores).filter(k => scores[k] >= RISK_AT).map(k => IDEA_LABEL[k]);
    if (reasons.length) dropped.push({ title: str(idea.title, 160), reasons });
    else kept.push(idea);
  }
  return { kept, dropped, unavailable };
}

/* ---------------------------------------------------------------------------
   5. A PLACE OF HIGH VALUE (round four, the paid letter retry): a
      foundation, or a network of schools, by its own kind and its own words
--------------------------------------------------------------------------- */
const NETWORK_RX = /\b(network|trust|federation|association|academies|group of schools|schools|multi-academy|consortium|alliance)\b/i;
export function isHighValuePlace(p) {
  if (!p || typeof p !== "object") return false;
  if (p.kind === "foundation") return true;
  if (p.kind === "school" || p.kind === "organisation" || p.kind === "educator") {
    const words = [p.name, ...(Array.isArray(p.facts) ? p.facts.map(f => (f && typeof f === "object" ? f.text : f)) : [])].map(x => String(x || "")).join(" ");
    return NETWORK_RX.test(words);
  }
  return false;
}
