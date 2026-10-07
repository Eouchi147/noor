/* NOOR \u00B7 the letterhead: every letter the house sends, in its own light
   ===========================================================================
   7 October 2026. The owner: "I need all the emails sent by the lantern to
   be artistically made in beautiful html with branding, animated graphical
   elements and clear text, as usual the same rules that apply to the
   project apply there (like no em or en dashes, remove AI slop or AI
   recognizable elements, etc...)"

   So two things live here, both pure: no store, no network, no clock.

   renderLetter({subject, text, kind, preheader}) -> {html, text}
     The plain body the mailbox already builds (greeting, paragraphs, short
     lists, links, the signature and, for a first letter, the way out) is
     dressed as a letter on the house's own paper. A night blue head with
     the Lantern's emblem (a GIF, because no mail client runs CSS animation;
     its first frame is the whole picture, because Outlook shows only that)
     and the wordmark, a thin gold rule, the letter in a large calm serif
     (17 px, on a phone too), the signature, the do not contact line small
     and clear, and a quiet footer. Tables and inline styles, as mail
     clients need; one small style block for dark mode, phones and readers
     who ask for less motion. No script, no web font, no external sheet and
     never a tracking pixel: the only pictures are the emblem and its still
     twin, at fixed addresses with no query. Every word is escaped. A link
     becomes a link only when it is https://noorcodex.com or one of its
     subdomains; any other address stays plain words.
     `text` is the clean plain twin for multipart/alternative: the same
     letter, word for word.

   slopCheck(text) -> {ok, hits[]}
     The house's rules over the words themselves, so the mailbox can refuse
     a draft or send it back to be written again: an em or en dash, an
     emoji, and the phrases that mark a letter as written by a machine. Each
     hit is a short phrase saying what was found, never the dash itself.

   Dark mode. The page declares both schemes, so Apple Mail and Outlook.com
   use the colours below rather than guessing. Gmail's apps may still
   invert the page on their own; the design holds there because the only
   colour that must not change, the night behind the star, is inside the
   picture, and a picture is never inverted: the medallion stays night blue
   and gold on whatever the page becomes.
--------------------------------------------------------------------------- */

export const LETTER_KINDS = Object.freeze(["outreach", "followup", "reply"]);
export const SITE = "https://noorcodex.com";
export const MAIL_ASSETS = SITE + "/assets/mail/";
/* scripts/gen-mail-emblem.py draws both; a changed emblem takes a new name
   (vercel.json serves /assets pictures as immutable for a year) */
export const EMBLEM = Object.freeze({
  src: MAIL_ASSETS + "lantern-v1.gif",
  still: MAIL_ASSETS + "lantern-v1-still.png",
  width: 120, height: 120,
  alt: "An eight pointed star of light"
});
export const WORDMARK = Object.freeze({ ar: "\u0646\u0648\u0631", en: "Codex of Light" });
export const FOOTER_LINE = "NOOR Codex of Light \u00B7 noorcodex.com \u00B7 a free library, no ads, no trackers";

/* ---------------------------------------------------------------------------
   1. THE HOUSE'S RULES OVER THE WORDS
--------------------------------------------------------------------------- */
const DASH_CHARS = "\u2012\u2013\u2014\u2015";
/* an emoji: anything shown as a picture by default, anything asked to be
   one (the variation selector), a keycap, and the dingbats and symbols a
   machine scatters through a letter (a sparkle, a heart, a tick, a star) */
const EMOJI_RX = /\p{Emoji_Presentation}|\uFE0F|\u20E3|[\u2600-\u27BF\u2B50\u2B55\u2934\u2935\u3030\u303D\u3297\u3299]/u;
const EMOJI_G = /\p{Emoji_Presentation}|\uFE0F|\u20E3|[\u2600-\u27BF\u2B50\u2B55\u2934\u2935\u3030\u303D\u3297\u3299]/gu;

/* the machine's phrases: [what to call it, the pattern] */
const PHRASES = [
  ["\"I hope this email finds you well\"", /\b(i|we) hope (this|that|my|our) (e-?mail|message|letter|note) finds you\b/i],
  ["\"I trust this\"", /\b(i|we) trust (this|that) (e-?mail|message|letter|note|finds|helps|is)\b|\bi trust this\b/i],
  ["\"delve\"", /\bdelv(e|es|ed|ing)\b/i],
  ["\"elevate\"", /\belevat(e|es|ed|ing)\b/i],
  ["\"unlock\"", /\bunlock(s|ed|ing)?\b/i],
  ["\"seamless\"", /\bseamless(ly)?\b/i],
  ["\"leverage\"", /\bleverag(e|es|ed|ing)\b/i],
  ["\"game changer\"", /\bgame[\s-]?chang(er|ers|ing)\b/i],
  ["\"in today's fast paced world\"", /\bin today['\u2019]?s (fast[\s-]?paced|ever[\s-]?changing|digital|modern|busy|hectic|rapidly changing) (world|age|landscape|era|society)\b/i],
  ["\"I wanted to reach out\"", /\b(i|we) (just )?want(ed)? to reach out\b|\b(i am|i'm|we are|we're|just) reaching out\b/i],
  ["\"rest assured\"", /\brest assured\b/i],
  ["\"don't hesitate to\"", /\b(do not|don['\u2019]?t|never) hesitate to\b/i],
  ["\"tapestry\"", /\btapestr(y|ies)\b/i],
  ["\"embark\"", /\bembark(s|ed|ing)?\b/i],
  ["\"navigate the complexities\"", /\bnavigat(e|es|ed|ing) (the |these |those |its |their )?(complexit(y|ies)|intricacies|nuances|challenges)\b/i],
  ["\"foster\"", /\bfoster(s|ed|ing)?\b(?! (care|carers?|parents?|family|families|child|children|homes?|mothers?|fathers?|placements?)\b)/i],
  ["\"empower\"", /\bempower(s|ed|ing|ment)?\b/i],
  ["\"synergy\"", /\bsynerg(y|ies|istic)\b/i],
  ["\"a testament to\"", /\b(a|is a|stands as a) testament to\b/i],
  ["\"in the realm of\"", /\bin the realm of\b/i],
  ["\"it is worth noting\"", /\b(it is|it's|it\u2019s) (worth noting|important to note|worth mentioning)\b/i],
  ["\"treasure trove\"", /\btreasure trove\b/i],
  ["\"a myriad of\"", /\ba myriad of\b|\bplethora\b/i],
  ["\"harness the power\"", /\bharness(es|ed|ing)? the (power|potential)\b/i],
  ["\"unleash\"", /\bunleash(es|ed|ing)?\b/i],
  ["\"cutting edge\"", /\bcutting[\s-]edge\b|\bstate[\s-]of[\s-]the[\s-]art\b/i],
  ["\"look no further\"", /\blook no further\b/i],
  ["\"dive into\"", /\b(deep[\s-]dive|dive (deep )?into|diving into)\b/i],
  ["\"a beacon of\"", /\ba beacon of\b/i],
  ["\"vibrant\"", /\bvibrant\b/i],
  ["\"plays a vital role\"", /\bplay(s|ed|ing)? an? (crucial|vital|pivotal|key|integral) role\b/i],
  ["\"holistic\"", /\bholistic(ally)?\b/i],
  ["\"revolutionize\"", /\brevolution[iz]{2}(e|es|ed|ing)\b|\brevolutionis(e|es|ed|ing)\b/i],
  ["\"next level\"", /\bnext[\s-]level\b|\bsupercharg(e|es|ed|ing)\b/i],
  ["\"invaluable\"", /\binvaluable\b|\bunparalleled\b/i]
];

/* "journey" is a plain word in a library of history (the Night Journey,
   the journey to Madinah), and a machine's metaphor everywhere else ("your
   learning journey", "on this journey together"). Only the second is a hit:
   a journey to or from a named place, or one with a name of its own, never
   is. */
const J_ADJ = "learning|spiritual|faith|educational|personal|lifelong|incredible|amazing|exciting|transformative|beautiful|wonderful|inner|growth|healing|reading|study|unique|shared|collective|digital|meaningful|life";
const J_LEAD = new RegExp("\\b(your|our|their|my)\\s+((" + J_ADJ + ")\\s+)?$|\\b(on|begin|start|continue|join\\s+us\\s+on|join|part\\s+of|every\\s+step\\s+of|along)\\s+(this|a|an|your|our|their)\\s+((" + J_ADJ + ")\\s+)?$|\\b(" + J_ADJ + ")\\s+$", "i");
const J_TAIL = /^\s+(of\s+(learning|faith|discovery|growth|life|self|knowledge|understanding|healing|transformation|the heart|the soul|a lifetime)|with\s+us|together|ahead|so\s+far)\b/i;
const J_PLACE = /^\s+(to|from|towards?|across|through|into|between)\s+(the\s+)?([A-Z]|[\u0600-\u06FF])/;
const J_NAMED = /\b(night|hajj|hijra|isra|umrah)\s+$/i;
function journeyHits(text) {
  const out = [];
  for (const m of String(text).matchAll(/\bjourneys?\b/gi)) {
    const before = text.slice(Math.max(0, m.index - 60), m.index);
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 60);
    if (J_NAMED.test(before) || J_PLACE.test(after)) continue;
    if (J_TAIL.test(after) || J_LEAD.test(before))
      out.push("\"journey\" as a metaphor (\"" + ((before.match(/(\S+\s+){0,2}$/) || [""])[0] + m[0]).trim() + "\")");
  }
  return out;
}

/* "not just X but Y", and its cousin "it isn't just X, it's Y" */
const NOT_JUST = [
  /\bnot (just|only|merely|simply) [^.!?;:\n]{1,80}?,?\s+but( also| rather)?\b/i,
  /\b(isn['\u2019]?t|is not|aren['\u2019]?t|are not|wasn['\u2019]?t|was not) (just|only|merely|simply) [^.!?\n]{1,60}?[,;]\s*(it['\u2019]?s|it is|they['\u2019]?re|they are|this is|that is)\b/i,
  /\bmore than just\b/i
];

/* three adjectives in a row ("warm, welcoming and inclusive"): a list of
   the adjectives a machine stacks, because a guess by suffix would take
   "English, Arabic and Turkish" for one */
const ADJ = new Set(("warm welcoming inclusive vibrant diverse rich engaging accessible comprehensive meaningful impactful innovative dynamic "
  + "robust holistic authentic beautiful free open simple clear calm deep kind gentle thoughtful practical reliable trusted safe modern "
  + "timeless powerful transformative unique exceptional incredible amazing wonderful valuable insightful informative educational "
  + "interactive intuitive friendly supportive caring loving joyful peaceful vital essential important fresh bright bold creative "
  + "inspiring inspirational enriching rewarding fun exciting easy quick fast affordable flexible personal spiritual sincere humble "
  + "honest respectful compassionate generous patient wise thorough rigorous careful detailed accurate authoritative scholarly reverent "
  + "elegant stunning gorgeous lovely delightful charming captivating compelling fascinating thriving flourishing growing strong "
  + "united cohesive connected vibrant sustainable scalable seamless effortless curated tailored bespoke premium quality "
  + "nurturing empowering uplifting heartfelt profound vast immersive informed").split(/\s+/));
const TRIAD_RX = /\b([a-z]+),\s+([a-z]+),?\s+(?:and|or|&)\s+([a-z]+)\b|\b([a-z]+),\s+([a-z]+),\s+([a-z]+)\b|\b([a-z]+)\s+and\s+([a-z]+)\s+and\s+([a-z]+)\b/gi;
function triadHits(text) {
  const out = [];
  for (const m of String(text).matchAll(TRIAD_RX)) {
    const w = (m[1] ? [m[1], m[2], m[3]] : m[4] ? [m[4], m[5], m[6]] : [m[7], m[8], m[9]]).map(x => x.toLowerCase());
    if (w.every(x => ADJ.has(x))) out.push("three adjectives in a row (\"" + m[0] + "\")");
  }
  return out;
}

const hex = c => "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");

/* {ok, hits[]}: ok only when nothing was found */
export function slopCheck(text) {
  const s = String(text == null ? "" : text);
  const hits = [];
  const d = s.match(new RegExp("[" + DASH_CHARS + "]", "g")) || [];
  if (d.some(c => c === "\u2014")) hits.push("an em dash");
  if (d.some(c => c === "\u2013")) hits.push("an en dash");
  if (d.some(c => c === "\u2012" || c === "\u2015")) hits.push("a dash");
  const e = s.match(new RegExp(EMOJI_RX.source, "gu")) || [];
  if (e.length) hits.push("an emoji (" + [...new Set(e.map(hex))].slice(0, 3).join(", ") + ")");
  for (const [name, rx] of PHRASES) if (rx.test(s)) hits.push(name);
  hits.push(...journeyHits(s));
  for (const rx of NOT_JUST) {
    const m = s.match(rx);
    if (m) { hits.push("the \"not just this but that\" turn (\"" + m[0].replace(/\s+/g, " ").slice(0, 70) + "\")"); break; }
  }
  hits.push(...triadHits(s));
  return { ok: hits.length === 0, hits: [...new Set(hits)] };
}

/* ---------------------------------------------------------------------------
   2. THE LETTER, PLAIN
--------------------------------------------------------------------------- */
/* the plain body, tidied the way the mailbox tidies it (api/_mail.js
   letterText), and never carrying a dash or an emoji whatever came in */
export function plainLetter(text) {
  return String(text == null ? "" : text).replace(/\r\n?/g, "\n")
    .replace(new RegExp("(\\d)[ \\t]*[" + DASH_CHARS + "][ \\t]*(\\d)", "g"), "$1 to $2")
    .replace(new RegExp("[ \\t]*[" + DASH_CHARS + "]+[ \\t]*", "g"), ", ")
    .replace(EMOJI_G, "")
    .split("\n").map(l => l.replace(/[ \t\u00A0]+/g, " ").replace(/^[ ,]+/, "").trimEnd()).join("\n")
    .replace(/ ,/g, ",").replace(/,[ \t]*,/g, ",")
    .replace(/\n{3,}/g, "\n\n").trim();
}

/* ---------------------------------------------------------------------------
   3. LINKS: only the house's own
--------------------------------------------------------------------------- */
export function isHouseLink(raw) {
  let u;
  try { u = new URL(String(raw || "")); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const h = u.hostname.toLowerCase();
  return h === "noorcodex.com" || h.endsWith(".noorcodex.com");
}
const URL_RX = /\bhttps?:\/\/[^\s<>"'`]+/gi;
/* trailing punctuation belongs to the sentence, not the address; a closing
   bracket only when the address did not open one */
function trimUrl(u) {
  let s = u;
  for (;;) {
    const c = s.slice(-1);
    if (/[.,;:!?'"\u2019\u201D]/.test(c)) { s = s.slice(0, -1); continue; }
    if (c === ")" && (s.match(/\(/g) || []).length < (s.match(/\)/g) || []).length) { s = s.slice(0, -1); continue; }
    if (c === "]" && (s.match(/\[/g) || []).length < (s.match(/\]/g) || []).length) { s = s.slice(0, -1); continue; }
    break;
  }
  return s;
}
/* a line as pieces: [{t:"text", v}] and [{t:"link", v, href}] */
function pieces(line) {
  const out = [];
  let at = 0;
  for (const m of line.matchAll(URL_RX)) {
    const raw = trimUrl(m[0]);
    if (!raw) continue;
    if (m.index > at) out.push({ t: "text", v: line.slice(at, m.index) });
    if (isHouseLink(raw)) out.push({ t: "link", v: raw.replace(/^https:\/\//i, "").replace(/^([^/]+)\/$/, "$1"), href: new URL(raw).href });
    else out.push({ t: "text", v: raw });
    at = m.index + raw.length;
  }
  if (at < line.length) out.push({ t: "text", v: line.slice(at) });
  return out;
}

/* ---------------------------------------------------------------------------
   4. THE LETTER, DRESSED
--------------------------------------------------------------------------- */
export const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

/* the house's colours: night blue and gold, on the site's own paper */
const P = Object.freeze({
  page: "#F2EDE2", paper: "#FFFDF8", night: "#0A1024", gold: "#C9A227", goldHi: "#E9C86A",
  ink: "#1F2436", strong: "#0A1024", soft: "#5A6072", link: "#8A6D13", hair: "#E6DECB", foot: "#6B6F7D", word: "#D9D2BE"
});
const SERIF = "Georgia,'Iowan Old Style','Palatino Linotype',Palatino,'Times New Roman',Times,serif";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const ARABIC = "'Amiri','Noto Naskh Arabic','Geeza Pro','Traditional Arabic','Arabic Typesetting','Times New Roman',serif";

const LIST_RX = /^\s*([-*\u2022]|\d{1,2}[.)])\s+(.*)$/;
const GREETING_RX = /^(assalamu|as-salamu|as salamu|asalamu|salaam|salam|salam alaykum|dear|peace be (up)?on you|wa ?alaykum|wa alaikum)\b/i;
const SIGN_RX = /^(with salaam|with salam|with peace|wassalam|was-salam|ma['\u2019]?a ?salama|warm(est)? (regards|wishes)|kind regards|with (warm )?thanks)\b/i;
const isDnc = b => /\bno thanks\b/i.test(b) && /\bnot hear from\b/i.test(b);

function inline(line) {
  return pieces(line).map(p => p.t === "link"
    ? "<a href=\"" + esc(p.href) + "\" class=\"nb-link\" style=\"color:" + P.link + ";text-decoration:underline;\">" + esc(p.v) + "</a>"
    : esc(p.v)).join("");
}
function para(lines, style, cls) {
  return "<p class=\"" + cls + "\" style=\"margin:0 0 18px 0;" + style + "\">" + lines.map(l => inline(l)).join("<br>") + "</p>";
}
const BODY = "font-family:" + SERIF + ";font-size:17px;line-height:28px;mso-line-height-rule:exactly;color:" + P.ink + ";";
function listHtml(items, ordered) {
  const rows = items.map((it, i) => "<tr>"
    + "<td valign=\"top\" class=\"nb-mark\" style=\"width:26px;padding:0 0 10px 0;font-family:" + SERIF + ";font-size:17px;line-height:28px;mso-line-height-rule:exactly;color:" + P.gold + ";\">"
    + (ordered ? esc(it.n) : "&#8226;") + "</td>"
    + "<td valign=\"top\" class=\"nb-ink\" style=\"padding:0 0 10px 0;" + BODY + "\">" + inline(it.text) + "</td></tr>").join("");
  return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"margin:0 0 8px 0;border-collapse:collapse;\">" + rows + "</table>";
}
/* one block of the letter (the text between blank lines) as HTML */
function blockHtml(block, i) {
  const lines = block.split("\n");
  if (i === 0 && lines.length === 1 && block.length <= 80 && GREETING_RX.test(block))
    return para(lines, "font-family:" + SERIF + ";font-size:19px;line-height:30px;mso-line-height-rule:exactly;color:" + P.strong + ";", "nb-strong");
  if (SIGN_RX.test(lines[0]) && lines.length <= 5) {
    return "<p class=\"nb-ink\" style=\"margin:26px 0 22px 0;" + BODY + "\">"
      + "<span style=\"font-style:italic;\">" + inline(lines[0]) + "</span>"
      + lines.slice(1).map((l, k) => "<br>" + (k === 0 && !/\bhttps?:\/\//i.test(l)
        ? "<span class=\"nb-strong\" style=\"color:" + P.strong + ";letter-spacing:0.01em;\">" + inline(l) + "</span>"
        : inline(l))).join("") + "</p>";
  }
  /* runs of list lines and of text lines, each in its own shape */
  let out = "", run = [], items = [], ordered = false;
  const flushText = () => { if (run.length) { out += para(run, BODY, "nb-ink"); run = []; } };
  const flushList = () => { if (items.length) { out += listHtml(items, ordered); items = []; } };
  for (const l of lines) {
    const m = l.match(LIST_RX);
    if (m) {
      flushText();
      const o = /\d/.test(m[1]);
      if (items.length && o !== ordered) flushList();
      ordered = o;
      items.push({ n: m[1], text: m[2] });
    } else { flushList(); run.push(l); }
  }
  flushText(); flushList();
  return out;
}

/* the preview line an inbox shows beside the subject: given, or the
   letter's first sentence after its greeting */
function previewOf(blocks, given) {
  const g = String(given || "").replace(/\s+/g, " ").trim();
  if (g) return plainLetter(g).slice(0, 150);
  const body = blocks.filter((b, i) => !(i === 0 && GREETING_RX.test(b)) && !SIGN_RX.test(b) && !isDnc(b));
  const first = (body[0] || "").replace(/\s+/g, " ").trim();
  const sent = (first.match(/^.+?[.!?](?=\s|$)/) || [first])[0];
  if (sent.length <= 150) return sent;
  return sent.slice(0, 150).replace(/\s+\S*$/, "");
}

const STYLE = [
  ":root{color-scheme:light dark;supported-color-schemes:light dark;}",
  "body{margin:0;padding:0;width:100% !important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}",
  "table{border-collapse:collapse;}",
  "img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}",
  "a.nb-link{text-underline-offset:3px;}",
  /* the inline styles are the phone's; a wider screen gets more air */
  "@media screen and (min-width:621px){",
  ".nb-outer{padding:28px 16px 30px 16px !important;}",
  ".nb-pad{padding-left:44px !important;padding-right:44px !important;}",
  ".nb-head{padding:36px 24px 26px 24px !important;}",
  "}",
  "@media (prefers-reduced-motion:reduce){",
  ".nb-move{display:none !important;}",
  ".nb-still{display:block !important;max-height:none !important;overflow:visible !important;}",
  "}",
  "@media (prefers-color-scheme:dark){",
  ".nb-page{background-color:#04060F !important;}",
  ".nb-paper{background-color:#0D1430 !important;}",
  ".nb-ink{color:#E9E3D3 !important;}",
  ".nb-strong{color:#FFF9E3 !important;}",
  ".nb-soft{color:#A9AFC2 !important;}",
  ".nb-link{color:#E9C86A !important;}",
  ".nb-mark{color:#E9C86A !important;}",
  ".nb-hair{background-color:#273152 !important;}",
  ".nb-foot,.nb-foot a{color:#8F96AB !important;}",
  "}",
  /* Outlook.com and the Outlook apps mark their dark mode on the elements */
  "[data-ogsb] .nb-page{background-color:#04060F !important;}",
  "[data-ogsb] .nb-paper{background-color:#0D1430 !important;}",
  "[data-ogsc] .nb-ink{color:#E9E3D3 !important;}",
  "[data-ogsc] .nb-strong{color:#FFF9E3 !important;}",
  "[data-ogsc] .nb-soft{color:#A9AFC2 !important;}",
  "[data-ogsc] .nb-link,[data-ogsc] .nb-mark{color:#E9C86A !important;}",
  "[data-ogsb] .nb-hair{background-color:#273152 !important;}"
].join("\n");

/* {html, text}; never throws */
export function renderLetter(opts = {}) {
  const o = opts && typeof opts === "object" ? opts : {};
  const kind = LETTER_KINDS.includes(o.kind) ? o.kind : "reply";
  const subject = String(o.subject == null ? "" : o.subject).replace(/\s+/g, " ").trim().slice(0, 200);
  const text = plainLetter(o.text);
  const blocks = text ? text.split(/\n{2,}/) : [];
  const dnc = blocks.filter(isDnc);
  const letter = blocks.filter(b => !isDnc(b));
  const preview = previewOf(blocks, o.preheader);

  const head = "<tr><td class=\"nb-head\" align=\"center\" bgcolor=\"" + P.night + "\" style=\"background-color:" + P.night + ";padding:30px 18px 22px 18px;border-radius:14px 14px 0 0;\">"
    + "<img class=\"nb-move\" src=\"" + EMBLEM.src + "\" width=\"" + EMBLEM.width + "\" height=\"" + EMBLEM.height + "\" alt=\"" + esc(EMBLEM.alt) + "\""
    + " style=\"display:block;margin:0 auto;width:" + EMBLEM.width + "px;height:" + EMBLEM.height + "px;border:0;font-family:" + SERIF + ";font-size:13px;line-height:18px;color:" + P.goldHi + ";text-align:center;\">"
    + "<!--[if !mso]><!--><div class=\"nb-still\" style=\"display:none;max-height:0;overflow:hidden;\">"
    + "<img src=\"" + EMBLEM.still + "\" width=\"" + EMBLEM.width + "\" height=\"" + EMBLEM.height + "\" alt=\"" + esc(EMBLEM.alt) + "\""
    + " style=\"display:block;margin:0 auto;width:" + EMBLEM.width + "px;height:" + EMBLEM.height + "px;border:0;font-family:" + SERIF + ";font-size:13px;color:" + P.goldHi + ";text-align:center;\"></div><!--<![endif]-->"
    + "<p style=\"margin:18px 0 0 0;line-height:34px;mso-line-height-rule:exactly;\">"
    + "<span lang=\"ar\" dir=\"rtl\" style=\"font-family:" + ARABIC + ";font-size:30px;line-height:34px;color:" + P.goldHi + ";\">" + WORDMARK.ar + "</span>"
    + "<span style=\"font-family:" + SANS + ";font-size:12px;line-height:34px;letter-spacing:0.24em;text-transform:uppercase;color:" + P.word + ";\">&nbsp;&nbsp;" + esc(WORDMARK.en) + "</span>"
    + "</p></td></tr>"
    + "<tr><td height=\"2\" bgcolor=\"" + P.gold + "\" style=\"height:2px;background-color:" + P.gold + ";font-size:0;line-height:0;mso-line-height-rule:exactly;\">&nbsp;</td></tr>";

  const body = "<tr><td class=\"nb-paper nb-pad\" bgcolor=\"" + P.paper + "\" style=\"background-color:" + P.paper + ";padding:34px 26px " + (dnc.length ? "4px" : "16px") + " 26px;overflow-wrap:anywhere;word-break:break-word;" + (dnc.length ? "" : "border-radius:0 0 14px 14px;") + "\">"
    + "<!-- letter -->" + letter.map(blockHtml).join("") + "<!-- /letter -->"
    + "</td></tr>";

  const small = dnc.length ? "<tr><td class=\"nb-paper nb-pad\" bgcolor=\"" + P.paper + "\" style=\"background-color:" + P.paper + ";padding:0 26px 28px 26px;border-radius:0 0 14px 14px;\">"
    + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\"><tr><td class=\"nb-hair\" height=\"1\" bgcolor=\"" + P.hair + "\" style=\"height:1px;background-color:" + P.hair + ";font-size:0;line-height:0;\">&nbsp;</td></tr></table>"
    + "<!-- small -->" + dnc.map(b => "<p class=\"nb-soft\" style=\"margin:16px 0 0 0;font-family:" + SANS + ";font-size:14px;line-height:22px;mso-line-height-rule:exactly;color:" + P.soft + ";\">" + b.split("\n").map(l => inline(l)).join("<br>") + "</p>").join("") + "<!-- /small -->"
    + "</td></tr>" : "";

  const foot = "<tr><td class=\"nb-foot\" align=\"center\" style=\"padding:22px 16px 6px 16px;font-family:" + SANS + ";font-size:12px;line-height:19px;mso-line-height-rule:exactly;color:" + P.foot + ";\">"
    + "<span style=\"white-space:nowrap;\">NOOR Codex of Light</span> &#183; <a href=\"" + SITE + "/\" style=\"color:" + P.foot + ";text-decoration:underline;white-space:nowrap;\">noorcodex.com</a> &#183; <span style=\"white-space:nowrap;\">a free library, no ads, no trackers</span>"
    + "</td></tr>";

  const html = "<!DOCTYPE html>\n"
    + "<html lang=\"en\" xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:o=\"urn:schemas-microsoft-com:office:office\">\n<head>\n"
    + "<meta charset=\"utf-8\">\n"
    + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
    + "<meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">\n"
    + "<meta name=\"x-apple-disable-message-reformatting\">\n"
    + "<meta name=\"color-scheme\" content=\"light dark\">\n"
    + "<meta name=\"supported-color-schemes\" content=\"light dark\">\n"
    + "<title>" + esc(subject) + "</title>\n"
    + "<!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->\n"
    + "<style>\n" + STYLE + "\n</style>\n</head>\n"
    + "<body class=\"nb-page\" style=\"margin:0;padding:0;background-color:" + P.page + ";\">\n"
    + "<div style=\"display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:" + P.page + ";\">"
    + esc(preview) + "&nbsp;" + "&#847;&zwnj;&nbsp;".repeat(60) + "</div>\n"
    + "<table role=\"presentation\" class=\"nb-page nb-kind-" + kind + "\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" bgcolor=\"" + P.page + "\" style=\"background-color:" + P.page + ";\">"
    + "<tr><td class=\"nb-outer\" align=\"center\" style=\"padding:12px 8px 20px 8px;\">\n"
    + "<!--[if mso]><table role=\"presentation\" width=\"600\" align=\"center\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td><![endif]-->\n"
    + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"width:100%;max-width:600px;margin:0 auto;\">"
    + head + body + small + "</table>\n"
    + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"width:100%;max-width:600px;margin:0 auto;\">" + foot + "</table>\n"
    + "<!--[if mso]></td></tr></table><![endif]-->\n"
    + "</td></tr></table>\n</body>\n</html>\n";

  return { html, text };
}
