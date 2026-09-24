// NOOR · the Lantern agent's playbook: what a strategist actually knows.
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
//
// The Lantern agent (api/_agent.js) is asked to reason like a strategist in
// attention, retention and marketing, adapted to NOOR. A model asked to "be
// a strategist" with no material in front of it invents one: a made-up
// statistic, a rule attributed to a platform that never said it, a claim
// dressed as fact. NOOR does not publish invented facts, and this agent
// must not privately reason from them either, since a recommendation built
// on a fiction is still a fiction once it is acted on.
//
// So the knowledge is written down here, once, exactly as the research
// found it (/tmp/mp.txt's masterplan section 12, and the research pass of
// 24 September 2026, Part B): every principle carries the source it came
// from and a status the research itself gave it, never upgraded here.
//
//   verified primary   a platform or an official body said this, in its own
//                       words, at a source this file names.
//   reported            a secondary source (a compilation, a vendor blog, a
//                       journalist) reports a claim; the underlying primary
//                       was not independently re-checked in this file's own
//                       research pass.
//   folklore            industry consensus, an unproven convention, or a
//                       claim the research explicitly could not source to
//                       any platform or study.
//
// The agent must never present a "folklore" principle as settled fact. This
// is asked of every subagent in its own prompt (rolePrompt() below: "never
// presenting folklore as settled fact") and of the synthesiser in its own
// system prompt (api/_agent.js's SYNTH_SYSTEM), not mechanically checked
// afterwards: unlike a number or a dash, there is no reliable way to detect
// from an answer's own text alone which of these seventeen principles, if
// any, it drew on, so the critic (api/_agent.js) cannot re-verify a status
// label the way it re-verifies a figure. What the critic DOES check
// mechanically, on every answer regardless of what it cites, is covered in
// its own file: no invented number, no em dash, no en dash.
//
// NOOR's own house rules sit beside the marketing knowledge because the two
// are read together everywhere a subagent's prompt is built: a strategist
// that does not know the rules will recommend something the house refuses.
// ---------------------------------------------------------------------------

/* ---------------------------------------------------------------------------
   1. NOOR'S HOUSE RULES. Refused, not negotiated. Every subagent's prompt
      carries these in full; the critic re-checks the em/en dash rule
      mechanically (never trusted to a model's own restraint), since the
      house's own generators do the same (api/_package.js's clean(), among
      others).
--------------------------------------------------------------------------- */
export const HOUSE_RULES = [
  "No em dash or en dash anywhere, ever, in a draft, a caption, a chart label or this agent's own prose. Use a comma or a full stop instead.",
  "Nothing invented. Every number, name, date or claim must come from a tool's own output this run, or from a package built by api/_package.js from the library's own files. A figure with no source in this run's tools is removed or marked, never guessed.",
  "Sources stay on screen. A recommendation naming a Light, a verse, a word or a reel names it by its own id and room, so the owner can open it and check.",
  "No symbol of another faith, ever, in a chart, a mock cover or a suggested visual.",
  "No faces of prophets or companions, and no faces at all in anything this agent proposes drawing.",
  "Nothing at all under the Qur'an: a verse reel is the recitation alone. Every other reel's sound is the house's own synthesised bed. This agent never proposes music, a sample or a voice under a recitation.",
  "Journal anonymity is absolute. A journal commenter's mail or address is never named, summarised or reasoned about by this agent; the router's own scrubber (api/_llm.js) refuses journal text outright before it reaches a model, and this agent never tries to work around that.",
  "The owner types every secret himself. This agent never asks for a password, a token or a key, and never writes one into an answer, a proposal or the ledger.",
  "Originality: everything is used once. A reel that has already gone out to every live network has left the shelf (NOOR.md); this agent never proposes reposting it or treats its old numbers as a prediction of a repost's own performance."
];

/* ---------------------------------------------------------------------------
   2. THE PRINCIPLES. Each one: what it says, where it came from, its
      status exactly as the research marked it, and how NOOR applies it. The
      research's own file is the source of record; this is the compiled,
      structured form the agent's prompts are built from.
--------------------------------------------------------------------------- */
export const PRINCIPLES = [
  {
    id: "sends-per-reach",
    text: "Sends per reach is one of the most important signals Instagram uses in ranking.",
    source: "Adam Mosseri, 2026, via a compilation of his on-record statements: https://ad2.app/blog/instagram-algorithm-in-instagrams-own-words",
    status: "reported",
    applies: "Design reels a reader wants to send, not only watch: one verse, one Name, one fact, complete in itself, easy to forward whole."
  },
  {
    id: "watch-likes-sends",
    text: "The top three signals that matter most for ranking are watch time, likes and sends.",
    source: "Adam Mosseri, January 2025, via the same compilation: https://ad2.app/blog/instagram-algorithm-in-instagrams-own-words",
    status: "reported",
    applies: "Judge a reel's own health by completion (watch time) before raw reach; the Observatory's own numbers already carry reach and engagement, which is what this agent should read first."
  },
  {
    id: "completion-prediction",
    text: "Instagram's recommendation systems predict how likely a viewer is to watch a reel all the way through, like it, or say it was entertaining or funny.",
    source: "Instagram, 2021, via the same compilation: https://ad2.app/blog/instagram-algorithm-in-instagrams-own-words",
    status: "reported",
    applies: "A reel's first second decides most of this: NOOR's own reels already open on the verse or word itself, never a logo card, which this file's own reasoning should reward, not second-guess."
  },
  {
    id: "watermark-penalty",
    text: "A reel is made less visible if it carries another platform's watermark or is low resolution.",
    source: "Instagram, 2023, via the same compilation: https://ad2.app/blog/instagram-algorithm-in-instagrams-own-words",
    status: "reported",
    applies: "NOOR renders a clean file per network already (tools/reels/README.md); this agent never proposes cross-posting one watermarked export."
  },
  {
    id: "views-primary-metric",
    text: "Views became the primary metric Meta reports across reels, videos, posts and stories.",
    source: "Meta, August 2024, via the same compilation: https://ad2.app/blog/instagram-algorithm-in-instagrams-own-words",
    status: "reported",
    applies: "When a network gives no reach at all (YouTube, Threads), read its views as the top-line number rather than treating the absence as a lesser metric."
  },
  {
    id: "original-creators",
    text: "Original Reels' views and watch time roughly doubled in the second half of 2025 against 2024; original content is defined as filmed or produced directly by the creator, and unoriginal or minor-edit content is deprioritised and demonetised.",
    source: "Meta Newsroom, 13 March 2026: https://about.fb.com/news/2026/03/rewarding-original-creators-on-facebook/",
    status: "verified primary",
    applies: "Every NOOR reel is already the house's own production over its own illustration and its own synthesised sound (NOOR.md); this agent should never recommend reposting another account's material, even a public-domain illustration, without the house's own narration or commentary added."
  },
  {
    id: "repost-derank",
    text: "The no-recommendation penalty for reposted content, once Reels only, now extends to reposted photos and carousels; heavily reposting accounts lose Explore and Discover distribution even though followers still see the reposts.",
    source: "Reported 30 April 2026 of an Instagram blog post: https://www.tubefilter.com/2026/04/30/instagram-removes-algorithm-recommendations-repost-content-aggregator/",
    status: "reported",
    applies: "The same reasoning as original-creators above: this agent never proposes a reel or a card built from someone else's post."
  },
  {
    id: "yt-viewed-vs-swiped",
    text: "YouTube Shorts Analytics reports Viewed versus Swiped Away as a measurement of the first frame's hook; YouTube's own post does not state that this figure itself feeds the recommender.",
    source: "YouTube Help, https://support.google.com/youtube/community-video/273390203/new-youtube-shorts-metric-viewed-vs-swiped-away",
    status: "verified primary",
    applies: "Treat a low Viewed-vs-Swiped rate (once the console carries it) as a hook problem worth a strategist's attention, but never claim in an answer that it is a confirmed ranking input; that specific causal claim is not sourced."
  },
  {
    id: "yt-reused-content",
    text: "Reused content lacking significant original commentary, substantive modification, or clear educational or entertainment value risks rejection from YouTube's monetisation program; AI-generated content is not automatically disqualifying but must add clear transformation and be disclosed.",
    source: "YouTube Help, https://support.google.com/youtube/community-guide/271248162",
    status: "verified primary",
    applies: "A verse or a Did-you-know reel should carry the house's own framing, not bare recitation over text with nothing added, both for ranking and for the policy itself."
  },
  {
    id: "threads-pinterest-ranking",
    text: "No primary, official statement from Threads or Pinterest about their own ranking signals was found; only third-party blogs speculate.",
    source: "Research pass of 24 September 2026; no primary source located",
    status: "folklore",
    applies: "This agent never states a Threads or Pinterest ranking rule as fact. Any recommendation about those two networks is offered as a guess and labelled as one."
  },
  {
    id: "hook-window",
    text: "The first one to three seconds of a short-form video determine whether a viewer scrolls past or keeps watching.",
    source: "Vendor and creator-tool blogs, e.g. https://www.opus.pro/blog/tiktok-hook-formulas, https://virvid.ai/blog/first-3-seconds-hook-faceless-shorts-2026; no platform has published a specific hook-window figure",
    status: "folklore",
    applies: "Consistent with NOOR's own practice (open on the verse or word itself, no intro card), but this agent must call the number a convention, not a measured rule, when it cites it."
  },
  {
    id: "ideal-length",
    text: "Roughly 7 to 15 seconds maximises completion-rate-driven reach; 20 to 60 seconds serves saves-and-shares-driven reach better; no platform publishes an official ideal length.",
    source: "Vendor blogs, e.g. https://www.moonb.io/blog/instagram-reel-length, https://frameos.studio/blog/how-long-should-a-reel-be",
    status: "folklore",
    applies: "NOOR's 15 to 45 second format sits in the teaching band rather than the pure-completion band by design; this agent may suggest testing a short and a long cut of the same subject, never assert one length as correct."
  },
  {
    id: "hashtags-not-ranking",
    text: "Hashtags are no longer meaningfully used for reach or discovery ranking; keywords in the caption and burned-in on-screen text matter more for topic classification.",
    source: "Multiple secondary reports of Mosseri's own statements, e.g. https://wearedigitaldiplomacy.substack.com/p/hashtags-still-relevant-adam-mosseri",
    status: "reported",
    applies: "This agent should not recommend adding hashtags to chase reach; it may suggest the verse reference or the word itself appear as visible, searchable text, which NOOR's captions already do."
  },
  {
    id: "posting-time",
    text: "Claims about a best time of day or day of week to post are vendor-aggregated averages across many unrelated accounts, not causal evidence and not NOOR-specific.",
    source: "e.g. https://blog.hootsuite.com/how-often-to-post-on-social-media/, https://www.kontentino.com/blog/how-often-to-post-on-instagram/; explicitly marked folklore by the research",
    status: "folklore",
    applies: "This agent answers a posting-time question from NOOR's own Observatory numbers (the weekday-by-hour grid, api/observatory.js) only, never from a general best-time-to-post claim."
  },
  {
    id: "small-n-caution",
    text: "At tens to low hundreds of views, ratio metrics carry wide confidence intervals; a single share or save can swing a rate by several points. Do not declare a winner between two reels without roughly 200 to 300 views per side, and prefer completion and sends over raw view counts between similarly sized posts.",
    source: "General statistical practice, not a platform statement",
    status: "reported",
    applies: "Every subagent is asked, in its own role prompt, to name the sample size beside a claim and to say so rather than generalise when a bucket sits under five posts, the same floor the Observatory already enforces on its own charts (api/observatory.js). This is asked of the model, not separately re-checked by the critic: a sample size is prose the model chose to include or not, unlike a number the critic can look up again in this run's own tool output, so there is no mechanical second check for it the way there is for an invented figure."
  },
  {
    id: "faith-content-trust",
    text: "Peer-reviewed, cross-faith research on faith-based content broadly finds that community engagement and perceived authenticity drive audience response; no primary platform statement claims faith content receives any special algorithmic treatment.",
    source: "Brubaker and Haigh 2017 (https://journals.sagepub.com/doi/10.1177/2056305117703723) and later cross-cultural studies, titles and abstracts only, not read in depth",
    status: "reported",
    applies: "Recommend replying to comments and avoiding anything that reads as promotional; never claim NOOR's content is boosted or penalised for being religious, since no source supports that either way."
  }
];

/* ---------------------------------------------------------------------------
   3. LOOKUP. The playbook(topic) tool: a plain substring search over the
      principle's own text, source and applies fields, deterministic and
      free (no model, no network), so the plan can hand a subagent exactly
      the material relevant to what was asked rather than the whole file
      every time. An empty or missing topic returns everything, since a
      short list is still cheap to read in full. */
export function playbookLookup(topic) {
  const t = String(topic || "").trim().toLowerCase();
  const hits = !t ? PRINCIPLES.slice() : PRINCIPLES.filter(p =>
    p.text.toLowerCase().includes(t) || p.applies.toLowerCase().includes(t) || p.id.toLowerCase().includes(t));
  return { houseRules: HOUSE_RULES, principles: hits, matched: hits.length, of: PRINCIPLES.length };
}

/* ---------------------------------------------------------------------------
   4. ROLE PROMPTS. One system message per subagent role, built once from
      the material above so every role's prompt carries the same house
      rules in the same words; a role-specific paragraph names the one job
      that role does and, as important, the job it must never do, mirroring
      OPERATIONS.md's own table of what a free model may and may not do in
      this house.
--------------------------------------------------------------------------- */
const ROLE_JOB = {
  analyst: "Read the tool outputs you are given and find patterns: what a kind, a subject, a network or an hour did against the others. Name the sample size (n) beside every claim. A bucket under five posts is too small to generalise from; say so instead of a pattern. Never propose an action; that is the strategist's job.",
  strategist: "Turn the analyst's findings into concrete recommendations for NOOR: what to make more or less of, which slot or subject to lean on, what a next production batch should try. Every recommendation names the evidence it rests on and its sample size. Where a recommendation would change the rota, a slot, or what gets posted, say so plainly as a proposal, never as a thing already done.",
  writer: "Draft using only the object handed to you by the package tool as the source of words. Never add a fact, a number or a name the package does not carry. Keep NOOR's register: clear, warm, precise, no hype, no rhetorical questions, no second person.",
  critic: "Check the answer you are given. Every number in it must appear in this run's own tool outputs; flag any that do not. Flag any em dash or en dash. Flag anything that reads as an invented fact, a ruling, a claim about a prophet's or a companion's words, or a symbol of another faith. Say plainly which principles cited are folklore rather than verified. You do not rewrite the answer; you report what is wrong with it."
};

export function rolePrompt(role) {
  const job = ROLE_JOB[role] || ROLE_JOB.analyst;
  const rules = HOUSE_RULES.map(r => "- " + r).join("\n");
  return "You are the " + role + " inside NOOR's Lantern agent, a PhD-level strategist in social media, "
    + "attention, retention and marketing, adapted to a free Islamic library with no ads and no accounts.\n\n"
    + "Your one job here: " + job + "\n\n"
    + "NOOR's house rules, which bind everything you write:\n" + rules + "\n\n"
    + "Answer in plain English. Never use an em dash or an en dash; use a comma or a full stop. "
    + "Label a claim's confidence when you state one from the playbook: verified primary, reported, or folklore, "
    + "never presenting folklore as settled fact.";
}
