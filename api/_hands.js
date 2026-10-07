// NOOR · the Soul's hands: the only things it can do, and the guard first.
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS (2 October 2026, SOUL.md sections 1 to 3)
//
// The owner gave the soul full freedom inside the constitution. Freedom is
// only safe when its edges are code, not a model's restraint, so every
// intent the soul ever forms passes through this file in one fixed order:
//
//   1. redLineCheck(intent), a PURE function, before any model ever sees the
//      intent and again before any hand runs. A red line is tier R3: refused
//      here whatever the planner, the council or any text in the evidence
//      says. It errs toward refusing: a sentence that merely sounds like a
//      red line is refused too, and the chronicle says so.
//   2. the registry: only a hand named in HANDS can run. An unknown name is
//      refused, never guessed at, never mapped to the nearest real one.
//   3. pause: a paused soul runs nothing, and an unreadable pause flag reads
//      as paused.
//   4. the council: an R2 hand runs only with a council verdict that holds
//      under the rule in api/_soul.js's councilRule (checked again here,
//      never trusted as a bare `approved: true`), OR with the owner's own
//      approval (LANTERN.md section 4, 3 October 2026): {owner: true, source:
//      "decision"|"next"|"idea", id}. The owner is the decision maker, so his
//      yes stands in for the council's vote on that one action, and for
//      nothing else: the red lines (step 1), pause (step 3), the caps (step 5)
//      and the audit (step 6) apply exactly as they do to the Lantern's own
//      actions, and the audit entry names his approval.
//   5. the caps, counted atomically before the run (api/_soul.js reserve),
//      failing closed on any store fault.
//   6. the audit: an entry is written BEFORE the hand runs (a fault there
//      refuses the action) and another after, carrying the exact undo.
//
// THE TIERS. R0 reads (run freely, not audited: a read changes nothing).
// R1 writes only to the soul's own memory (a note, its own goals, a lesson
// proposal, an upgrade proposal): run freely, audited, undoable. R2 changes
// what the public sees or what the house posts, always through the house's
// own validated doors (api/_lineup.js setOverride and restoreOverride,
// api/_experiments.js planExperiment and stopExperiment, api/_insights.js
// refresh, api/social.js teachGuard), never around them.
//
// THE DEPENDENCIES are the rest of the house (the Observatory, the
// insights reader, the poster's own slot records). Real ones are imported
// lazily on first use, so a test can hand in stubs through api/_soul.js's
// seams.deps and never load a module that would reach a network.
// ---------------------------------------------------------------------------

import {
  CAP_LIMITS, K, nowIso, nowMs, dayOf, addDays, newId, store, parse, isPaused, auditAppend,
  actionsRecord, actionsList, actionsUpdate, reserve, release, councilRule, seams,
  soulGoalOp, soulGoalRestore, metricValue, readGoals
} from "./_soul.js";
import { looksLikeJournal } from "./_llm.js";
import { REEL_SLOTS } from "./_schedule.js";
import { getOverrideRaw, setOverride, clearOverride, restoreOverride, otherPicksFor, buildDayContext, chooseReelWithOverride, actorLabel } from "./_lineup.js";
import { EXPERIMENTS, readState as expReadState, resolveCurrent as expResolveCurrent, planExperiment, stopExperiment, biasFor, biasFromAny } from "./_experiments.js";
import * as I from "./_instruments.js";
import { LEVERS } from "./_levers.js";
import { OUTREACH_HANDS } from "./_outreach.js";   /* outreach: research and letters to places (LANTERN.md section 11.3) */
import { GIVING_HANDS, refreshGiving } from "./_giving.js";   /* sustaining the house (LANTERN.md section 9) */
import { MISSION_HANDS } from "./_mission.js";   /* mission: the Lantern's mission powers (LANTERN.md section 8) */
import { MAIL_HANDS } from "./_mail.js";   /* mail: the Lantern's mailbox (LANTERN.md section 11) */

/* ---------------------------------------------------------------------------
   1. THE RED LINES, MACHINE-CHECKED. One pattern family a line, run over the
      action's own name, its arguments and its stated reasons. The owner's
      own seeded goals are named here as well: an intent touching one is the
      "owner's goals" red line however it is phrased.
--------------------------------------------------------------------------- */
const OWNER_GOAL_IDS = ["g-reach", "g-attention", "g-search", "g-health", "g-sustain",
  "g-outreach"];   /* g-sustain: 3 October 2026, added once as his; outreach: g-outreach, 6 October 2026, the same way */
/* 6 October 2026 (the review of money): the words the two lines of Article
   11 read. GIVE is giving money: a gift, a donation, money, sadaqa, zakat,
   a giver, "who give", and "give" itself only where it means giving money
   (at a clause's end, or before what is given, to whom or when), never
   "give comfort" or "give glad tidings". AMOUNT is a sum of money. */
const GIVE = "(?:gifts?|donat\\w*|money|sadaqa\\w*|zakat|contribut\\w*|givers?|who\\s+(?:do\\s+not\\s+|don't\\s+|never\\s+|did\\s+not\\s+)?giv(?:e|es)\\b"
  + "|giv(?:e|es|ing)(?=[ \\t]*(?:[.,;:!?)\"'\u201d\u2019\\n]|$)|\\s+(?:\\$|\\d|to|what|now|today|tonight|this|monthly|weekly|generously|more|again|back|money|gifts?|sadaqa|zakat|towards?|so|if|before|and|or(?!\\s+take)|every|each|once|in(?!\\s+to\\b)|for|at|during|online|here|page|note|line|band|appeal|campaign|season|month|week|day)\\b))";
const AMOUNT = "(?:\\$\\s?\\d|\\b\\d[\\d,.]*\\s*(?:dollars?|usd|euros?|eur|pounds?|gbp|riyals?|sar|dirhams?|aed|rupees?|lira|ringgit|naira)\\b|\\b(?:a|any|the)\\s+(?:set|certain|specific|fixed|minimum)\\s+(?:amount|sum)\\b"
  + "|\\bgifts?\\s+of\\s+(?:at\\s+least\\s+)?\\$?\\d|\\b(?:give|gives|giving|donate\\w*|pay\\w*)\\s+(?:at\\s+least\\s+|just\\s+|only\\s+)?\\$?\\d)";
const rxw = (src, flags) => new RegExp(src, flags || "i");
const GIVE_RX = rxw("\\b" + GIVE);
const RL = [
  { id: "delete-content", rx: [
    /\b(delete|deleting|remove|removing|hide|hiding|unpublish\w*|take\s+down|taking\s+down|archive|archiving|unlist\w*|trash\w*)\b[^.;\n]{0,50}\b(posts?|reels?|videos?|stor(y|ies)|content|pages?|lights?|library|entr(y|ies)|cards?|comments?|captions?)\b/i,
    /\b(delete|remove|hide|unpublish|takedown|unlist)[-_](post|reel|video|content|page|light|card)s?\b/i ] },
  { id: "external-accounts", rx: [
    /\b(create|creating|open|opening|register\w*|sign\s*up|signing\s*up)\b[^.;\n]{0,40}\baccounts?\b/i,
    /\baccept\w*\b[^.;\n]{0,30}\b(terms|tos|agreement|polic(y|ies))\b/i,
    /* "pay nothing" is the house's promise to readers, never a spend (3 October 2026) */
    /\b(spend|spending|pay|paying)\b(?!\s+(nothing|no\b|zero))[^.;\n]{0,30}(\$|\b(money|dollars?|usd|euros?|pounds?|budget on ads|ads?)\b)/i,
    /\b(purchase|purchasing|buy|buying|boost(ed|ing)?\s+(a\s+)?post|top\s*up|subscribe\s+to\s+(a\s+)?paid|paid\s+promotion|ad\s+campaign|run\s+ads)\b/i,
    /\b(change|changing|rotate|rotating|replace|replacing|set|setting|edit|editing|update|updating|revoke|revoking)\b[^.;\n]{0,40}\b(api\s*keys?|keys|tokens?|credentials?|passwords?|secrets?|account\s+settings|settings\s+of|webhooks?)\b/i,
    /\b(create|open|register)[-_]account\b/i ] },
  /* mail: 6 October 2026 (LANTERN.md section 11, Article 12), the line in two
     parts. `rx` (a direct message, a comment, an inbox) holds for every hand,
     the mail hands too. `rxMail` (writing, emailing, contacting, replying to
     someone) is not read for the sanctioned mail hands (MAIL_SANCTIONED,
     below), whose every email meets Article 12's gates in api/_mail.js
     queueOutgoing instead; for every other hand it holds as before. */
  { id: "message-individuals", rx: [
    /\b(dm|dms|direct\s+messages?|private\s+messages?|inbox\s+them)\b/i,
    /\b(comment\s+on|commenting\s+on)\s+(each|every|all|individual|our|the|those|these|them|him|her|users?|followers?|people|readers?|commenters?|subscribers?)\b/i,
    /\b(dm|comment)[-_](campaign|users?|followers?|people|readers?)\b/i ],
    rxMail: [
    /\b(message|messaging|email|emailing|contact|contacting|reply\s+to|replying\s+to|write\s+to|writing\s+to)\s+(each|every|all|individual|our|the|those|these|them|him|her|users?|followers?|people|readers?|commenters?|subscribers?)\b/i,
    /\bsend\w*\b[^.;\n]{0,30}\b(emails?|messages?|dms?|newsletters?)\b/i,
    /\b(message|email|reply)[-_](campaign|users?|followers?|people|readers?)\b/i ] },
  { id: "off-schedule-posting", rx: [
    /\b(post|posting|publish|publishing|send|sending|upload|uploading)\b[^.;\n]{0,40}\b(now|immediately|right\s+away|extra|additional|another|more\s+often|twice|outside\s+the\s+schedule|beyond\s+the\s+schedule|off\s*schedule)\b/i,
    /\b(extra|additional|unscheduled|bonus)\s+(posts?|slots?|reels?|stories)\b/i,
    /\b(more\s+posts|post\s+more|beyond\s+the\s+(daily\s+)?schedule|above\s+the\s+schedule)\b/i,
    /\b(write|generate|compose|create|make)\b[^.;\n]{0,30}\b(new\s+)?(posts?|reels?|cards?|captions?)\b[^.;\n]{0,30}\b(to\s+post|and\s+post|for\s+posting|to\s+publish)\b/i,
    /^(post|publish|upload|post-now|publish-now|send-post|schedule-post|extra-post|story)$/i ] },
  { id: "self-modification", rx: [
    /\b(change|changing|raise|raising|increase|increasing|lift|lifting|lower|lowering|edit|editing|modify|modifying|disable|disabling|remove|removing|bypass\w*|override|overriding|rewrite|rewriting|delete|deleting|relax\w*|loosen\w*|ignore|ignoring|amend\w*|suspend\w*|update|updating|turn\s+off)\b[^.;\n]{0,50}\b(constitution|articles?\s+of|red\s+lines?|caps?|daily\s+caps?|daily\s+limits?|budget|spending\s+cap|evals?|canar(y|ies)|owner'?s?\s+goals?|guardrails?|the\s+code|source\s+code|codebase|council|guardian|soul_monthly_usd)\b/i,
    /\b(deploy|deploying|commit|committing|push|pushing|merge|merging)\b[^.;\n]{0,30}\b(code|changes?|branch|repo|repository|patch)\b/i,
    /\b(edit|change|modify|patch)[-_](code|constitution|caps?|budget|evals?)\b/i ] },
  { id: "per-person-data", rx: [
    /\bjournal\s+(text|entr(y|ies)|posts?|content|comments?|notes?)\b/i,
    /\b(per[- ]person|personal\s+data|personally\s+identifiable|pii|visitor\s+ids?|reader\s+ids?|email\s+addresses|ip\s+addresses|individual\s+readers?'?\s+(data|records|history))\b/i,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/ ] },
  /* 3 October 2026 (LANTERN.md section 9, Article 11). Read with the
     intent's own denials taken out first (`denials`), so the house's own
     promise ("no ads, no trackers", "no pop up", "without guilt or fear")
     is never read as its breach. 6 October 2026 (the review of money): a
     denial covers only what it names, any advertisement or paywall word
     left after it is refused, the verbs are wider, and the faith's own
     words (Allah's promise, the fear of the Day) are not read as pressure;
     `clauses` refuse when one clause carries every pattern of a group. */
  { id: "ads-paywall-data", denials: true, rx: [
    /* any advertisement or paywall word no denial covered (never 'Ad, the
       people of Hud, nor ad-Din or ad-Duha) */
    /(?<!['‘’`])\b(?:ads|adverts?|advertis\w*|adsense|paywalls?|pay[\s-]?walls?)\b|(?<!['‘’`])\bad\b(?!-[a-z])(?!\s+(?:hoc|infinitum|hominem|nauseam|libitum)\b)/i,
    /\b(show|showing|shows|run|running|display\w*|serv(e|es|ing)|plac(e|es|ing)|insert\w*|add|adding|sell|selling|carry|carrying|put|putting|allow\w*|enabl\w*|turn\s+on|switch\s+on)\s+(an?\s+|some\s+|more\s+|google\s+|paid\s+|display\s+|banner\s+|sponsored\s+)?(ads|adverts?|advertisements?|advertising|adsense)\b/i,
    /\b(adsense|ad\s+networks?|ad\s+slots?|ad\s+revenue|ad[\s-]+supported|banner\s+ads?|programmatic\s+ads?|sponsored\s+(posts?|content|links?)|affiliate\s+links?)\b/i,
    /\badvertis\w*\b[^.;\n]{0,40}\b(library|site|pages?|reels?|codex|hosting|posts?|feed)\b/i,
    /* the paywall: "behind a members login", "open only to members" (6 October) */
    /\b(paywall\w*|pay[\s-]+wall|members?[\s-]+only|subscribers?[\s-]+only|premium\s+(tier|content|access|members?|plan|version)|behind\s+(an?\s+|the\s+)?(?:[\w'-]+\s+){0,2}(payment|paywall|subscription|fee|membership|login|log[\s-]?in|sign[\s-]?(?:in|up)|password|members?(?:'s)?\s+(?:area|section|club))|subscription\s+(required|only|wall)|locked\s+(behind|until)|unlock\w*\s+(with|by|for|after)\s+(an?\s+)?(payment|gift|donation|subscription|fee)|pay(?:s|ing)?\s+to\s+(read|access|unlock|see|listen|download|use)|charg\w*\s+(readers|users|visitors|for\s+(access|reading|downloads?|the\s+(library|tafsir|quran|codex)))|open\w*\s+only\s+to\s+(?:the\s+)?(?:members|subscribers|givers|donors|patrons|those\s+who\s+(?:give|pay|donate))|only\s+(?:for|to)\s+(?:paying\s+)?(?:members|subscribers|givers|donors|patrons))\b/i,
    /\b(?:put\w*|lock\w*|hid(?:e|es|den|ing)|plac\w*|kept|keep\w*|gat(?:e|es|ed|ing)|sit\w*|mov\w*)\b[^.;\n]{0,40}\bbehind\s+(?:an?\s+|the\s+)?(?:[\w'-]+\s+){0,2}(?:gifts?|donations?|accounts?)\b/i,
    /\bcharg(?:e|es|ed|ing)\s+(?:readers\s+|users\s+|visitors\s+|people\s+|members\s+)?(?:\$\s?\d|\d|an?\s+(?:fee|price|subscription|membership))/i,
    /\b(?:giv(?:e|es|ing)|donat\w*|pay(?:s|ing)?|subscrib\w*|members?)\b[^.;\n]{0,30}\bunlock(?:s|ed|ing)?\b(?!\s+nothing)/i,
    /\bunlock(?:s|ed|ing)?\b[^.;\n]{0,40}\b(?:for|to)\s+(?:givers|donors|members|subscribers|patrons|those\s+who\s+(?:give|pay|donate))\b/i,
    /* anything about readers, sold or shared ("monetise", "give the givers'
       emails", "send the donors' names": 6 October) */
    /\b(sell\w*|shar(e|es|ing)|rent\w*|trad(e|es|ing)|giv\w*\s+away|hand\w*\s+over|pass\w*\s+on|export\w*|leak\w*|monetiz\w*|monetis\w*|disclos\w*)\b[^.;\n]{0,30}\b(readers?|visitors?|users?|subscribers?|givers?|donors?|guardians?|members?)'?s?\s+(data|e-?mails?|lists?|addresses|details|information|info|contacts?|names|records|profiles?|analytics|histor(y|ies)|behaviou?r)\b/i,
    /\b(sell\w*|rent\w*|monetiz\w*|monetis\w*)\b[^.;\n]{0,30}\b(data|e-?mail\s+lists?|mailing\s+lists?|audience|contact\s+lists?)\b/i,
    /\b(?:giv(?:e|es|ing)|sen(?:d|ds|ding|t)|upload\w*|forward\w*|transfer\w*|provid\w*|hand(?:s|ed|ing)?\s+over|pass(?:es|ed|ing)?\s+on|export\w*|shar(?:e|es|ed|ing)|sell\w*|rent\w*|leak\w*|monetis\w*|monetiz\w*|disclos\w*|publish\w*|list(?:s|ed|ing)?)\b[^.;\n]{0,30}\b(?:readers?|visitors?|users?|subscribers?|givers?|donors?|guardians?|members?|followers?|audience)(?:'s|')?\s+(?:data|e-?mails?|e-?mail\s+(?:addresses|lists?)|(?:e-?mail|postal|home|ip)\s+addresses|contacts?|contact\s+(?:details|lists?|info\w*)|phone\s+numbers?|personal\s+(?:details|data|information)|profiles?|records|histor(?:y|ies)|behaviou?r|analytics|locations?)\b/i,
    /\b(?:giv(?:e|es|ing)|sen(?:d|ds|ding|t)|upload\w*|forward\w*|transfer\w*|provid\w*|hand(?:s|ed|ing)?\s+over|pass(?:es|ed|ing)?\s+on|export\w*|shar(?:e|es|ed|ing)|sell\w*|rent\w*|leak\w*|monetis\w*|monetiz\w*|disclos\w*|publish\w*|list(?:s|ed|ing)?)\b[^.;\n]{0,30}\b(?:readers?|visitors?|users?|subscribers?|givers?|donors?|guardians?|members?|followers?)(?:'s|')\s+(?:names|details|information|info|lists?|addresses|identit(?:y|ies)|accounts?)\b/i,
    /* and said the other way round: "readers' emails are yours" (never "is never shared") */
    /\b(?:readers?|visitors?|users?|subscribers?|givers?|donors?|guardians?|members?|followers?)(?:'s|')?\s+(?:data|e-?mails?|e-?mail\s+(?:addresses|lists?)|addresses|contacts?|contact\s+(?:details|lists?)|phone\s+numbers?|names|details|records|profiles?)\b(?:(?!\b(?:never|not|no|nobody|nothing|none)\b)[^.;\n]){0,30}\b(?:yours|shared|sold|given|sent|passed|handed|available\s+to|for\s+sale|transferred|exported|uploaded|forwarded|disclosed|rented|traded|leaked)\b/i ] },
  { id: "pressure-giving", denials: true, rx: [
    rxw(String.raw`\b(?:pop[\s-]*ups?|popups?|modals?|interstitials?|overlays?|lightbox(?:es)?|full[\s-]?(?:screen|page)\s+(?:asks?|appeals?|prompts?|requests?|banners?|takeovers?))\b[^.;\n]{0,60}\b(?:` + GIVE + String.raw`|pay(?:s|ing)?\b|support\s+(?:us|the\s+(?:library|house)|noor))`),
    rxw(String.raw`\b(?:` + GIVE + String.raw`|appeal\w*)[^.;\n]{0,40}\b(?:pop[\s-]*ups?|popups?|modals?|interstitials?)\b`),
    rxw(String.raw`\b(?:count[\s-]*downs?|ticking\s+clocks?|timers?|last\s+chance|hurry|act\s+now|before\s+it'?s\s+too\s+late|only\s+\d+\s+(?:hours?|days?|minutes?)\s+(?:left|remain\w*)|ends?\s+(?:tonight|at\s+midnight|in\s+\d+\s+(?:hours?|minutes?))|false\s+urgency|urgent(?:ly)?\s+(?:appeal|need|ask|call|request)\w*)\b[^.;\n]{0,60}\b(?:` + GIVE + String.raw`|support\b|pay(?:s|ing)?\b|appeal\w*)`),
    rxw(String.raw`\b(?:` + GIVE + String.raw`|appeal\w*)[^.;\n]{0,60}\b(?:count[\s-]*downs?|ticking\s+clocks?|timers?|last\s+chance|hurry|act\s+now|before\s+it'?s\s+too\s+late|false\s+urgency)\b`),
    /* guilt and fear, asking for money ("support" and "pay" are not asking
       for money here, and "give comfort" is not giving: 6 October) */
    rxw(String.raw`\b(?:guilt\w*|shame\w*|ashamed|scar(?:e|es|ed|ing|y)|frighten\w*|fear\w*|afraid|threat\w*|will\s+(?:close|die|shut\s+down|disappear|go\s+dark)|going\s+to\s+(?:close|die|shut\s+down|disappear)|go\s+dark|lose\s+the\s+library|could\s+vanish)\b[^.;\n]{0,60}\b` + GIVE),
    rxw(String.raw`\b` + GIVE + String.raw`[^.;\n]{0,60}\b(?:guilt\w*|shame\w*|scar(?:e|es|ed|ing)|frighten\w*|fear\w*|afraid|will\s+(?:close|die|disappear|go\s+dark))\b`),
    /\bwithout\s+(?:your|our\s+readers'?|readers'?|the\s+readers'?|their)\s+(?:gifts?|support|help|donations?|giving|sadaqa)\b[^.;\n]{0,60}\b(?:will|would|could|may|might|must|is\s+going\s+to|are\s+going\s+to)\s+(?:close|die|shut|disappear|vanish|go\s+dark|go\s+offline|end|stop|be\s+lost|go\s+away)\b/i,
    /\b(?:will|would|could|may|might|must)\s+(?:close|die|shut(?:\s+down)?|disappear|vanish|go\s+dark|go\s+offline|be\s+lost)\b[^.;\n]{0,60}\b(?:without|unless)\s+(?:your|readers'?|you|we\s+get|more)\b/i,
    /\bunless\s+(?:you|readers|we\s+get|more\s+readers)\b[^.;\n]{0,40}\b(?:give|gifts?|support|donat\w*|help)\b[^.;\n]{0,60}\b(?:close|die|shut|disappear|vanish|go\s+dark|go\s+offline|be\s+lost|end)\b/i,
    rxw(String.raw`\b(?:ask\w*|appeal\w*\s+to|urg\w*|encourag\w*|invit\w*|get|getting|tell\w*|nudg\w*|push\w*|persuad\w*)\s+(?:the\s+|our\s+|young\s+)?(?:children|kids|child|youngsters|young\s+readers)\b[^.;\n]{0,40}\b(?:` + GIVE + String.raw`|pay(?:s|ing)?\b|support\s+(?:us|the\s+(?:library|house)|noor))`),
    /\b(appeal\w*|gifts?|giving|donat\w*|support\s+(line|band)|band|banner|ask)\b[^.;\n]{0,30}\b(aimed|targeted|targeting|for)\s+(at\s+)?(the\s+)?(children|kids)\b/i,
    /\b(show\w*|put\w*|plac\w*|add\w*|aim\w*|target\w*)\b[^.;\n]{0,30}\b(appeal\w*|gifts?|giving|donat\w*|support\s+(line|band)|band|banner)\b[^.;\n]{0,30}\b(children|kids)\b/i,
    /\b(support\s+line|mission\s+line|band|banner|giving\s+note|giving\s+page|donate\s+page|the\s+note)\b[^.;\n]{0,40}\b(to\s+say|to\s+read|saying|reading|worded\s+as)\s*[:"“'‘]/i,
    /* a prompt in front of the reading, or an ask of every reader (6 October) */
    /\b(?:gifts?|giving|donat\w*|money|payment|support)\s+(?:prompts?|requests?|asks?|appeals?|gates?|walls?|screens?|boxes|banners?|nags?|reminders?)\b[^.;\n]{0,40}\b(?:before|on\s+(?:every|each)|every\s+(?:page|visit|reel|time|reader)|each\s+(?:page|visit|reel|time|reader)|at\s+the\s+door|first)\b/i,
    rxw(String.raw`\b(?:ask\w*|prompt\w*|request\w*|nag\w*|remind\w*|push\w*)\s+(?:every|each|all)\s+(?:the\s+)?(?:readers?|visitors?|users?|people)\b[^.;\n]{0,40}\b` + GIVE) ],
    /* a reward tied to an amount; a promise of Paradise or forgiveness tied
       to a gift (Allah's own promise, with no gift beside it, is the faith's
       word and passes) */
    clauses: [
      [rxw(AMOUNT), /\b(?:paradise|jannah|heaven|forgiveness|forgiven|barakah|blessings?|reward\w*|palace|du'?as?\s+(?:answered|accepted)|answered\s+du'?as?|sins?\s+(?:forgiven|wiped|erased))\b/i],
      [GIVE_RX, /\b(?:guarantee\w*|promis\w*|secur(?:e|es|ed|ing)|assur\w*|ensur\w*|earn(?:s|ed|ing)?|buy(?:s|ing)?|win(?:s|ning)?|unlock\w*|gets?|getting|grant\w*|reward(?:s|ed|ing)?)\b/i, /\b(?:paradise|jannah|heaven|forgiveness|forgiven|a\s+palace|house\s+in\s+(?:paradise|jannah))\b/i] ] }
];
/* the intent's own denials, taken out before the two lines of Article 11
   are read: "no ads, no trackers", "no pop up, no countdown", "without guilt
   or fear", "readers never pay to read"; and the faith's own fear, which is
   never a pressure: of Allah always, and of the Day, the Fire and the
   Hereafter in a clause that asks for no money. 6 October 2026: after a
   comma or "and" each item needs its own denial, and only "or" and "nor"
   carry one over ("no ads or trackers"), so "No nagging, paywall the
   tafsir" keeps its paywall. */
const DENIED_WORD = "(?:pop[\\s-]*ups?|popups?|ads?|adverts?|advertis\\w*|adsense|paywalls?|pay[\\s-]*walls?|pay(?:s|ing)?\\s+to\\s+(?:read|access|unlock|see|listen|download|use)|payments?|subscriptions?|fees?|trackers?|tracking|count[\\s-]*downs?|timers?|(?:false\\s+)?urgency|pressure|guilt|fear|shame|rewards?|nagging|nags?|sponsored\\s+(?:ads?|posts?|content|links?)|banner\\s+ads?)";
const NEG = "(?:no|not|never|neither|without|nothing|zero|nobody|no\\s+one|free\\s+(?:of|from))";
const D_ITEM = "(?:behind\\s+)?(?:an?\\s+|any\\s+)?" + DENIED_WORD + "\\b";
const DENIED = new RegExp("\\b" + NEG + "\\s+" + D_ITEM
  + "(?:(?:\\s*,\\s*(?:and\\s+|or\\s+)?|\\s+and\\s+)" + NEG + "\\s+" + D_ITEM + "|\\s*,?\\s*(?:or|nor)\\s+(?:" + NEG + "\\s+)?" + D_ITEM + ")*", "gi");
const FAITH_FEAR = /\b(?:fear(?:s|ed|ing)?\s+(?:of\s+)?(?:allah|god|him|(?:the|their|his|her|your|our|my)\s+lord)|(?:god|allah)[\s-]?fearing|taqwa|khawf|khashy?ah?)\b/gi;
const FAITH_DREAD = /\b(?:fear(?:s|ed|ing|ful)?|afraid|frightened|scared)\s+(?:of\s+)?(?:standing\s+before\s+(?:allah|god|(?:the|their|his|your|our)\s+lord)|the\s+(?:day(?:\s+of\s+(?:judge?ment|resurrection|reckoning|rising|recompense|standing))?|last\s+day|fire|hell[\s-]?fire|hell|hereafter|grave|punishment|reckoning|judge?ment|resurrection|torment)|hell[\s-]?fire|hell|jahannam|(?:the\s+)?akhirah)\b/gi;
export const withoutDenials = s => String(s || "").split(/(\n|[.;!?](?=\s|$))/).map(c => {
  let x = c.replace(FAITH_FEAR, " ");
  if (!GIVE_RX.test(x)) x = x.replace(FAITH_DREAD, " ");
  return x.replace(DENIED, " ");
}).join("");
/* one line read over a text: its patterns, and its clause groups (every
   pattern of a group in one clause); the action-name patterns (^) only
   where the action is given */
const clausesOf = s => String(s || "").split(/\n|[.;!?](?=\s|$)/);
/* the lines a guarded hand's letter is read by (redLineCheck, below) */
const LETTER_LINES = Object.freeze(["ads-paywall-data", "pressure-giving", "per-person-data"]);
/* mail: the hands that write email within Article 12 (api/_mail.js's, and
   api/_outreach.js's): the messaging line's email part is not read for them,
   and every other line, its direct message and comment part too, is */
export const MAIL_SANCTIONED = Object.freeze(["mail-send", "mail-reply", "mail-triage", "outreach-send", "outreach-followup", "research"]);
function lineHits(line, body, plain, action, sanctioned) {
  const t = line.denials ? plain : body;
  for (const rx of (line.rxMail && !sanctioned ? line.rx.concat(line.rxMail) : line.rx)) {
    if (rx.source.startsWith("^")) { if (action != null && rx.test(action)) return true; continue; }
    if (rx.test(t)) return true;
  }
  for (const group of line.clauses || []) if (clausesOf(t).some(c => group.every(rx => rx.test(c)))) return true;
  return false;
}

function flatText(v, depth) {
  if (v == null) return "";
  if ((depth || 0) > 4) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(x => flatText(x, (depth || 0) + 1)).join(" . ");
  if (typeof v === "object") return Object.keys(v).map(k => k + ": " + flatText(v[k], (depth || 0) + 1)).join(" . ");
  return "";
}

/* {ok:true} or {ok:false, tier:"R3", line, text, reason}. Pure: no store, no
   model, no clock, no import that could reach either at call time. */
export function redLineCheck(intent) {
  const it = (intent && typeof intent === "object") ? intent : {};
  const action = String(it.action || "").trim();
  const args = (it.args && typeof it.args === "object") ? it.args : {};
  const refuse = (id, reason) => {
    const line = RED_LINES_TEXT[id] || id;
    return { ok: false, tier: "R3", line: id, text: line, reason: reason || ("red line: " + line) };
  };
  if (!action) return refuse("unknown", "an intent with no action name is never run");
  /* the action's own name is read as a phrase as well ("delete-post" reads
     as "delete post"), so a red line cannot hide behind a hyphen */
  const nameAsWords = action.replace(/[-_]+/g, " ");
  /* mission (LANTERN.md section 8): a hand may name the arguments the guard
     reads (guardArgs), when one of the others is a letter addressed to
     someone by design (draft); that hand reads the letter itself, for
     personal data and for numbers the evidence does not carry */
  let guardOf = null;
  try { guardOf = Object.prototype.hasOwnProperty.call(HANDS, action) && Array.isArray(HANDS[action].guardArgs) ? HANDS[action].guardArgs : null; } catch { guardOf = null; }
  const guarded = guardOf ? Object.fromEntries(guardOf.filter(k => Object.prototype.hasOwnProperty.call(args, k)).map(k => [k, args[k]])) : args;
  const body = [action, nameAsWords, flatText(guarded), flatText(it.why), flatText(it.expectedEffect), flatText(it.evidence)].join(" \n ");
  if (looksLikeJournal(body)) return refuse("per-person-data", "red line: journal text or a per-person marker is never sent to a model or acted on");
  /* the owner's goals: an intent touching one, by id or by owner */
  const goalArg = (args.goal && typeof args.goal === "object") ? args.goal : args;
  if ((action === "goal" || /goal/i.test(action)) && (OWNER_GOAL_IDS.includes(String(goalArg.id || "")) || goalArg.owner === "owner"))
    return refuse("self-modification", "red line: the owner's goals change only from the console");
  const plain = withoutDenials(body);
  /* mail: for Article 12's hands the messaging line reads only its direct
     message and comment part, and only over what the Lantern says it is
     doing (the action and its reasons), never a letter's own words, which may
     thank a reader "for your comment on the page"; every other line reads
     the whole intent, the letter too */
  const sanctioned = MAIL_SANCTIONED.includes(action);
  const ownWords = sanctioned ? [action, nameAsWords, flatText(it.why), flatText(it.expectedEffect)].join(" \n ") : "";
  for (const line of RL) {
    if (sanctioned && line.rxMail) { if (lineHits(line, ownWords, ownWords, action, true)) return refuse(line.id); continue; }
    if (lineHits(line, body, plain, action, false)) return refuse(line.id);
  }
  /* 6 October 2026 (the review): the fields a guarded hand leaves out (a
     letter's title and text) are still read, by the lines about what a
     letter says: Article 11's two (no advertisement, no paywall, nothing
     about readers, no pressure) and per-person data. Not the lines about
     the Lantern's own acts (deleting, spending, posting, changing code),
     which words for the owner to send cannot do and which an ordinary
     letter ("help pay the hosting", "a joint reel, and another on Eid")
     would trip; and never message-individuals, since a letter is
     addressed to someone by design. */
  if (guardOf) {
    const letter = flatText(Object.fromEntries(Object.entries(args).filter(([k]) => !guardOf.includes(k))));
    if (letter.trim()) {
      if (looksLikeJournal(letter)) return refuse("per-person-data", "red line, in the letter itself: it carries a Journal marker, and the Journal stays anonymous");
      const plainLetter = withoutDenials(letter);
      for (const line of RL) {
        if (!LETTER_LINES.includes(line.id)) continue;
        if (lineHits(line, letter, plainLetter, null)) return refuse(line.id, "red line, in the letter itself: " + (line.id === "per-person-data"
          ? "it carries personal data (an email address, a phone number, an IP address or a key), which a draft never does" : (RED_LINES_TEXT[line.id] || line.id)));
      }
    }
  }
  return { ok: true };
}
const RED_LINES_TEXT = {
  "delete-content": "deleting or hiding any post on any network, or any content of the library",
  "external-accounts": "creating accounts, accepting terms, spending money, changing keys or settings of any external service",
  /* mail: the two lines amended with Article 12 (6 October 2026) */
  "message-individuals": "messaging anyone except as Article 12 allows: never a direct message or a comment on any network, never an email from any address but salam@noorcodex.com, never to an address that was not published for contact or did not write first, never beyond the mail caps, never again after a no",
  "off-schedule-posting": "posting beyond the daily schedule, or posting anything that is not a card or reel already in the house's own shelf",
  "self-modification": "changing the constitution, red lines, caps, budget, evals, the owner's goals, or code",
  "per-person-data": "sending per-person data or Journal text to any model, except the correspondence the house receives and writes, which only models that neither keep nor learn from it may read, to answer it; Journal text never",
  "ads-paywall-data": "showing advertisements, putting any part of the library behind a payment, or selling or sharing anything about readers",
  "pressure-giving": "asking for money with pressure: a pop up, a countdown, guilt or fear, a reward tied to an amount, an appeal aimed at children, or wording not written into the code",
  "unknown": "an intent with no action"
};

/* ---------------------------------------------------------------------------
   2. THE DEPENDENCIES: the rest of the house, lazily
--------------------------------------------------------------------------- */
const SITE = () => (process.env.SITE_HOST || "noorcodex.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
let REAL = null;
/* THE SHELF, READ FROM THIS DEPLOYMENT'S OWN DISK FIRST (3 October 2026).
   api/soul.js and api/lantern-agent.js both ship reels/index.json with the
   function (vercel.json includeFiles), and the site serves that very file,
   so the copy on disk is the copy the poster reads. The live fetch is the
   fallback. The owner's approval of a line-up change used to read the shelf
   this way in api/lantern-agent.js; now that it runs through these hands, the
   hands read it the same way. */
async function shelfCards(host) {
  const local = I.localCards();
  if (Array.isArray(local) && local.length) return local;
  const doc = await (await import("./_reels.js")).readManifest(host);
  return (doc && Array.isArray(doc.cards)) ? doc.cards : [];
}
function realDeps() {
  if (REAL) return REAL;
  const host = SITE();
  const social = () => import("./social.js");
  REAL = {
    host,
    observatory: async () => (await import("./observatory.js")).cached({}),
    observatoryInvalidate: async () => (await import("./observatory.js")).invalidateCache({}),
    insightsRead: async days => (await import("./_insights.js")).read(days, {}),
    insightsNumbers: async () => (await import("./_insights.js")).numbers({}),
    insightsRefresh: async () => {
      const I = await import("./_insights.js");
      const ref = await I.refresh(14, {});
      const snap = await I.snapshot({ force: true, days: 14 });
      return { ok: !!(ref.ok || snap.ok), fetched: ref.fetched, errors: ref.errors, partial: !!(ref.partial || snap.partial) };
    },
    computeVisitors: async () => (await import("./visitors.js")).computeVisitors(),
    manifest: async () => shelfCards(host),
    expState: async () => expReadState({}),
    readSlot: async (d, s) => (await social()).readSlot(d, s),
    recentlyPostedRaw: async d => (await social()).recentlyPostedRaw(d),
    recentlyPosted: async d => (await social()).recentlyPosted(d),
    dayContext: async (date, seen) => {
      let cards;
      try { cards = await shelfCards(host); } catch { cards = null; }
      return buildDayContext(host, date, { seen, biasFor, ...(cards && cards.length ? { cards } : {}) });
    },
    teachGuard: async network => (await social()).teachGuard(network, "https://" + host, {}),
    revertTaught: async keys => (await social()).revertTaught(keys),
    /* the Steward's findings, folded into the cycle (LANTERN.md section 5):
       the deterministic gather and rules of api/_steward.js, never its
       paragraph (a model call) and never Stripe (money stays out of every
       prompt), plus the two counts only the owner acts on, the inbox and the
       journal's replies waiting, read from their own keys */
    stewardFold: async (D) => {
      const SW = await import("./_steward.js");
      /* the cycle's own clock, so the Steward reads the cycle's own day */
      const opts = { now: nowMs(), gifts: async () => ({ configured: false, count: null, grossMinor: null, currency: "" }) };
      if (D && typeof D.readSlot === "function") opts.readSlot = D.readSlot;
      const house = await SW.gather(opts);
      const findings = SW.rules(house);
      const inbox = await inboxNew().catch(() => null);
      const journal = await journalWaiting().catch(() => null);
      return { at: house.at, findings, tokens: house.tokens || null, threads: house.threads || null, inbox, journal, trouble: (house.trouble || []).slice(0, 8) };
    }
  };
  return REAL;
}
/* how many inbox messages are still new: the inbox's own counter, kept by
   api/inbox.js on every arrival and every reading (nb:unread) */
async function inboxNew() {
  const r = await store([["GET", "nb:unread"]]);
  const n = parseInt(r[0], 10);
  return isFinite(n) && n > 0 ? n : 0;
}
/* how many journal replies still wait to be read: the reading queue
   api/journal.js keeps (nj:queue), each mark checked against its entry's own
   comments, the way the journal's own `queue` action reads it; bounded to
   the newest 100 marks and 20 entries */
async function journalWaiting() {
  const marks = ((await store([["LRANGE", "nj:queue", "0", "99"]]))[0] || []).map(m => parse(m, null)).filter(m => m && m.entry);
  if (!marks.length) return 0;
  const entries = [...new Set(marks.map(m => String(m.entry)))].slice(0, 20);
  const got = await store(entries.map(e => ["LRANGE", "nj:c:" + e, "0", "300"]));
  const pending = new Set();
  entries.forEach((e, i) => {
    for (const raw of (got[i] || [])) { const c = parse(raw, null); if (c && c.state === "pending" && c.cid) pending.add(e + "|" + c.cid); }
  });
  return new Set(marks.map(m => String(m.entry) + "|" + String(m.cid)).filter(k => pending.has(k))).size;
}
/* the stubs a test hands in, over the real ones */
export function deps() {
  return { ...realDeps(), ...(seams.deps || {}) };
}

/* what the rota would post on these days, overrides and all: the same
   reading api/lineup.js's own GET and the Lantern's lineup tool give, so the
   soul, the console and the poster agree */
export async function lineupPreview(fromDate, days) {
  const D = deps();
  const out = [];
  const cards = await D.manifest().catch(() => []);
  let state = null;
  try { state = await D.expState(); } catch { state = null; }
  for (let i = 0; i < Math.max(1, Math.min(7, days || 2)); i++) {
    const d = addDays(fromDate, i);
    let bias = null;
    try { bias = state ? biasFromAny(state, d, EXPERIMENTS) : null; } catch { bias = null; }
    let seen = new Map();
    try { seen = await D.recentlyPosted(d); } catch { seen = new Map(); }
    const ctx = await buildDayContext(D.host, d, { cards, bias, seen, ...(D.hijri !== undefined ? { hijri: D.hijri } : {}) });
    for (const slot of REEL_SLOTS) {
      const rec = await D.readSlot(d, slot).catch(() => null);
      /* the day's rota leans ride in the day context (api/_levers.js), so
         the planner sees a leaned slot exactly as the poster will pick it */
      const { card, override, lean } = await chooseReelWithOverride(ctx.cards, d, slot, ctx.hijri, ctx.seen, ctx.bias, null, { rec, leans: ctx.leans });
      out.push({ date: d, slot, sent: !!(rec && rec.state), card: card ? { id: card.id, kind: card.kind || "light", hook: String(card.hook || "").slice(0, 120) } : null,
        override: override ? { action: override.action, id: override.id || null, fellBack: !!override.fellBack,
          by: override.by || "owner", note: String(override.note || "").slice(0, 160) } : null,
        ...(lean ? { lean: { id: lean.id, kind: lean.kind } } : {}) });
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
   3. THE REGISTRY. Each hand: tier, the caps it spends beyond the R2 total,
      the argument shape the planner is told about, run(args, ctx) and
      undo(recipe). A run answers {ok, ..., undo}; an undo answers {ok}.
--------------------------------------------------------------------------- */
const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n || 200);
const realDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const NOOP = note => ({ kind: "noop", note });

/* the line-up change, through api/_lineup.js's own validated door exactly as
   api/lineup.js and the Lantern's approve path call it: the raw reads for
   `before` and the duplicate guard's window (a fault refuses, never guesses
   "nothing there"), the day's context, every other slot's own record, then
   setOverride, whose validation decides. */
/* THE SOUL'S OWN LIMITS ON A DAY (the 2 October review): a day can never be
   emptied by the soul. Per target date, at most SOUL_SKIPS_PER_DATE skips
   and SOUL_CHANGES_PER_DATE line-up changes in all, counted atomically
   (INCR first, then the check on the value INCR returned, given back on
   any refusal or failure), failing closed on a store fault; and only today
   or tomorrow (UTC), never further ahead. A slot that already carries the
   owner's own choice, or a Lantern proposal he approved, is his: the soul
   refuses it outright. */
export const SOUL_SKIPS_PER_DATE = 1;
export const SOUL_CHANGES_PER_DATE = 2;
const K_TARGET = (kind, date) => "nsoul:count:" + kind + ":" + date;
async function reserveTarget(action, date) {
  const keys = [K_TARGET("soul-lineup-date", date)];
  if (action === "skip") keys.push(K_TARGET("soul-skip-date", date));
  let r;
  try { r = await store(keys.flatMap(k => [["INCR", k], ["EXPIRE", k, String(9 * 86400)]])); }
  catch { return { ok: false, error: "the per-day line-up count could not be kept, so nothing was changed" }; }
  const changes = parseInt(r[0], 10), skips = action === "skip" ? parseInt(r[2], 10) : 0;
  const giveBack = async () => { try { await store(keys.map(k => ["DECR", k])); } catch { } };
  if (!isFinite(changes) || !isFinite(skips)) { await giveBack(); return { ok: false, error: "the per-day line-up count could not be read, so nothing was changed" }; }
  if (changes > SOUL_CHANGES_PER_DATE) { await giveBack(); return { ok: false, error: "the Lantern may change at most " + SOUL_CHANGES_PER_DATE + " slots of " + date + ", and has" }; }
  if (skips > SOUL_SKIPS_PER_DATE) { await giveBack(); return { ok: false, error: "the Lantern may skip at most " + SOUL_SKIPS_PER_DATE + " slot of " + date + ", and has" }; }
  return { ok: true, giveBack };
}
async function lineupRun(action, args, ctx) {
  const D = deps();
  const date = str(args.date, 10), slot = str(args.slot, 10), id = action === "swap" ? str(args.id, 120) : undefined;
  if (!realDate(date) || !REEL_SLOTS.includes(slot)) return { ok: false, error: "a line-up change needs a real date and a reel slot (reelA to reelF)" };
  if (action === "swap" && !id) return { ok: false, error: "a swap needs the id of a card on the shelf" };
  /* THE OWNER'S OWN CHANGE (LANTERN.md section 4). With his approval the
     change is his, the way an approved Lantern proposal always was: it is
     written as "lantern-approved", it may stand on a slot he set before,
     its date is any day api/_lineup.js's own validator accepts, and the
     soul's own per-date limits (which exist so the soul acting alone can
     never empty a day) do not count it. The daily caps still do: runHand
     reserved them before this ran. */
  const owner = !!ctx.ownerApproved;
  const today = dayOf();
  if (!owner && date !== today && date !== addDays(today, 1)) return { ok: false, error: "the Lantern changes only today's or tomorrow's line-up (UTC), never " + date };
  let before, seen;
  try { before = await getOverrideRaw(date, slot); }
  catch { return { ok: false, error: "the store could not be read, so nothing was changed" }; }
  if (!owner && before && before.by !== "soul")
    return { ok: false, error: "that slot was set by " + actorLabel(before.by) + "; the Lantern never overwrites it" };
  try { seen = await D.recentlyPostedRaw(date); }
  catch { return { ok: false, error: "the duplicate guard could not be read, so nothing was changed" }; }
  const dctx = await D.dayContext(date, seen);
  const records = {};
  for (const s of REEL_SLOTS) if (s !== slot) records[s] = await D.readSlot(date, s).catch(() => null);
  const otherPicks = await otherPicksFor(dctx.cards, date, slot, dctx.hijri, dctx.seen, dctx.bias, { records });
  /* api/_lineup.js's third actor, "soul": the record, the poster's slot
     record and the console all say the Soul set it, never the owner */
  const held = owner ? { ok: true, giveBack: async () => {} } : await reserveTarget(action, date);
  if (!held.ok) return held;
  const by = owner ? "lantern-approved" : "soul";
  const note = owner ? ("Approved by the owner: " + str(ctx.why, 260)) : ctx.approval ? ("The owner's Go on an idea: " + str(ctx.why, 260)) : ("Council approved: " + str(ctx.why, 260));
  let r;
  try {
    r = await setOverride({ date, slot, action, id },
      { manifest: dctx.cards, seen: dctx.seen, otherPicks, now: nowMs(), by, note: note.slice(0, 300) });
  } catch (e) { r = { ok: false, error: String(e && e.message || e).slice(0, 160) }; }
  if (!r.ok) { await held.giveBack(); return { ok: false, error: r.error }; }
  return { ok: true, date, slot, override: r.override, before: before || null,
    undo: { kind: "lineup-revert", date, slot, before: before || null, after: r.override } };
}
/* the exact inverse: the prior entry put back byte for byte through
   restoreOverride, or the slot cleared, and only while the slot still holds
   exactly what this action wrote (its own at and by: the soul's own, or the
   owner's approved change) */
async function lineupUndo(u) {
  const date = str(u.date, 10), slot = str(u.slot, 10);
  if (!date || !slot || !u.after) return { ok: false, error: "this entry carries nothing to compare against" };
  let current;
  try { current = await getOverrideRaw(date, slot); }
  catch { return { ok: false, error: "the store could not be read, so nothing was undone" }; }
  if (!current) return { ok: true, cleared: true, note: "there was nothing left to clear" };
  if (current.at !== u.after.at || current.by !== u.after.by || (current.by !== "soul" && current.by !== "lantern-approved"))
    return { ok: false, error: "the slot was changed again since (now " + actorLabel(current.by) + "'s); undo it in the Posts room" };
  if (u.before) {
    const r = await restoreOverride({ date, slot, entry: u.before });
    return r.ok ? { ok: true, restored: u.before } : { ok: false, error: r.error };
  }
  const r = await clearOverride({ date, slot });
  return r.ok ? { ok: true, cleared: true } : { ok: false, error: r.error };
}

async function igRowsFor60() {
  const D = deps();
  try { const ins = await D.insightsRead(60); return (ins && ins.igRows) || []; } catch { return []; }
}

export const HANDS = {
  /* R0: reads */
  observatory: { tier: "R0", args: "{}", describe: "the Observatory's own week: reach, views, visitors, posts, posting health, notes",
    run: async () => { const o = await deps().observatory(); return { ok: !!o && o.ok !== false, data: o ? { summary: o.summary, notes: o.notes, learn: o.learn && { sentences: o.learn.sentences }, experiment: o.experiment && { id: o.experiment.id, status: o.experiment.status, sentence: o.experiment.sentence } } : null }; } },
  insights: { tier: "R0", args: "{days}", describe: "what the network readings say, as sentences and medians by kind",
    run: async a => { const days = Math.max(1, Math.min(60, parseInt(a.days, 10) || 14)); const r = await deps().insightsRead(days); return { ok: !!r, data: r ? { days, read: r.read, unread: r.unread, sentences: r.sentences, learn: r.learn && { sentences: r.learn.sentences, watchByKind: r.learn.watchByKind, verseByLength: r.learn.verseByLength } } : null }; } },
  numbers: { tier: "R0", args: "{}", describe: "this week against last, by network and by kind",
    run: async () => { const n = await deps().insightsNumbers(); return { ok: !!n, data: n ? { thisWeek: n.thisWeek, byNetwork: n.byNetwork, byKind: n.byKind, best: n.best, worst: n.worst } : null }; } },
  visitors: { tier: "R0", args: "{}", describe: "site visitors and arrivals by network, totals only",
    run: async () => { const v = await deps().computeVisitors(); return { ok: !!v, data: v ? { totals: v.totals, arrivals: v.arrivals, sources: v.sources } : null }; } },
  lineup: { tier: "R0", args: "{fromDate, days}", describe: "what the rota will post, slot by slot",
    run: async a => ({ ok: true, data: await lineupPreview(realDate(a.fromDate) ? a.fromDate : dayOf(), Math.min(7, parseInt(a.days, 10) || 2)) }) },
  slots: { tier: "R0", args: "{date}", describe: "the day's slot records: what was sent, what failed",
    run: async a => { const d = realDate(a.date) ? a.date : dayOf(); const D = deps(); const out = [];
      for (const s of REEL_SLOTS) { const rec = await D.readSlot(d, s).catch(() => null); if (rec) out.push({ date: d, slot: s, state: rec.state }); }
      return { ok: true, data: out }; } },
  shelf: { tier: "R0", args: "{kind}", describe: "the cards and reels on the shelf, counted by kind",
    run: async a => { const cards = await deps().manifest(); const byKind = {};
      for (const c of cards) { const k = (c && c.kind) || "light"; byKind[k] = (byKind[k] || 0) + 1; }
      const f = a.kind ? cards.filter(c => c && c.kind === a.kind) : cards;
      return { ok: true, data: { total: cards.length, byKind, sample: f.slice(0, 12).map(c => ({ id: c.id, kind: c.kind, hook: String(c.hook || "").slice(0, 100) })) } }; } },
  experiment: { tier: "R0", args: "{}", describe: "the test now planned or running, and the history of finished ones",
    run: async () => { const st = await deps().expState(); const cur = expResolveCurrent(st, EXPERIMENTS);
      return { ok: true, data: { current: cur ? { id: cur.id, start: cur.start } : null, history: (st.history || []).slice(0, 5).map(h => ({ id: h.id, start: h.start, status: h.status, verdict: h.verdict || null, sentence: h.sentence || null })) } }; } },
  playbook: { tier: "R0", args: "{}", describe: "the Lantern's own playbook of lessons",
    run: async () => { const E = await import("./_evolve.js"); return { ok: true, data: await E.readPlaybook() }; } },

  /* R0: the instruments (SOUL.md section 11), read from the soul's memory;
     totals only, never a person */
  trajectories: { tier: "R0", args: "{}", describe: "each goal's trend line: projected value at its due date, the date it reaches its target, on-track, behind, met or no-data",
    run: async () => { const goals = await readGoalsSafe(); const d = dayOf(); return { ok: true, data: goals.map(g => { const t = I.trajectory(g, d); delete t.series; return t; }) }; } },
  anomalies: { tier: "R0", args: "{days}", describe: "the days whose numbers broke from their own trailing 28 days (posting health drop, reach collapse, spend spike, visitors spike)",
    run: async a => { const n = Math.max(1, Math.min(60, parseInt(a.days, 10) || 14)); return { ok: true, data: (await I.readAnomalies()).slice(0, n) }; } },
  effects: { tier: "R0", args: "{limit}", describe: "what past public actions did to the metric each named, seven days on, against the same weekday of earlier weeks",
    run: async a => { const list = await I.readEffects(Math.max(1, Math.min(50, parseInt(a.limit, 10) || 20))); return { ok: true, data: { summary: I.effectsSummary(list), items: I.effectsForPrompt(list) } }; } },
  "search-readiness": { tier: "R0", args: "{}", describe: "the latest weekly audit of 25 sitemap pages (title, description, canonical, structured data, words, indexable) and the IndexNow queue",
    run: async () => { const a = await I.readLatest("search"); return { ok: true, data: { audit: a ? { score: a.score, sampled: a.sampled, counts: a.counts, failures: (a.failures || []).slice(0, 10), week: a.week } : null, indexnow: await I.indexnowStatus(dayOf()) } }; } },
  "page-speed": { tier: "R0", args: "{}", describe: "the latest weekly PageSpeed Insights reading, mobile: performance score, LCP, CLS, INP for four pages",
    run: async () => ({ ok: true, data: await I.readLatest("speed") }) },
  "youtube-position": { tier: "R0", args: "{}", describe: "the channel's subscribers, total views and videos, and the benchmark channels' public totals",
    run: async () => ({ ok: true, data: await I.readLatest("youtube") }) },
  "topic-radar": { tier: "R0", args: "{}", describe: "what people searched on YouTube in the last 30 days, mapped to the house's shelves (demand signals)",
    run: async () => { const r = await I.readLatest("radar"); return { ok: true, data: r ? { week: r.week, signals: r.signals, byKind: r.byKind, rising: (r.rising || []).map(x => ({ query: x.query, views: x.views, kinds: x.kinds })) } : null }; } },
  coverage: { tier: "R0", args: "{}", describe: "cards of each kind on the shelf, posted and left, and days of runway at the rota's pace",
    run: async () => { const c = await I.takeCoverage(dayOf(), deps()); return { ok: !!c.ok, data: c.ok ? c : null, error: c.ok ? undefined : c.why }; } },
  scorecard: { tier: "R0", args: "{week}", describe: "the weekly scorecard (built on Mondays) for a week such as 2026-W40, or the latest",
    run: async a => ({ ok: true, data: (await I.readScorecard(a.week)).scorecard }) },

  /* R1: the soul's own memory */
  note: { tier: "R1", args: "{text}", describe: "a note in the Lantern's own memory",
    run: async a => {
      const text = str(a.text, 600);
      if (!text) return { ok: false, error: "an empty note" };
      const notes = parse((await store([["GET", K.notes]]))[0], []);
      const n = { id: newId("n"), at: nowIso(), text };
      await store([["SET", K.notes, JSON.stringify([n, ...(Array.isArray(notes) ? notes : [])].slice(0, 200))]]);
      return { ok: true, note: n, undo: { kind: "note-remove", id: n.id } };
    },
    undo: async u => {
      const notes = parse((await store([["GET", K.notes]]))[0], []);
      await store([["SET", K.notes, JSON.stringify((Array.isArray(notes) ? notes : []).filter(n => n && n.id !== u.id))]]);
      return { ok: true };
    } },
  goal: { tier: "R1", args: "{op: add|adjust|retire, goal: {id, outcome, metric, target, due, cadence}}", describe: "add, adjust or retire one of the Lantern's OWN goals (never an owner goal)",
    run: async a => {
      const op = str(a.op, 10);
      const r = await soulGoalOp(op, a.goal || {});
      if (!r.ok) return r;
      return { ok: true, goal: r.goal, undo: { kind: "goal-restore", id: r.goal.id, before: r.before } };
    },
    undo: async u => soulGoalRestore(u.id, u.before) },
  "lesson-propose": { tier: "R1", args: "{text, why} to add, or {kind: \"retire\", id, why} to retire a lesson", describe: "propose a playbook lesson, or retiring one (applied only if every canary passes)",
    run: async (a, ctx) => {
      const E = await import("./_evolve.js");
      const retire = a.kind === "retire";
      const r = retire
        ? await E.propose({ kind: "retire", lessonId: str(a.id, 80), lesson: { why: str(a.why || ctx.why, 400) }, from: ctx.cycle || "soul" })
        : await E.propose({ kind: "add", lesson: { text: str(a.text, 400), why: str(a.why || ctx.why, 400) }, from: ctx.cycle || "soul" });
      if (!r.ok) return r;
      return { ok: true, proposal: r.proposal, undo: { kind: "proposal-withdraw", id: r.proposal.id } };
    },
    undo: async u => (await import("./_evolve.js")).withdraw(u.id) },
  "upgrade-propose": { tier: "R1", args: "{title, why, spec, metric, expectedEffect, priority}", describe: "write a code upgrade proposal for the owner and Claude to build (never built by the Lantern)",
    run: async (a, ctx) => {
      const E = await import("./_evolve.js");
      const r = await E.addUpgrade({ title: a.title, why: a.why || ctx.why, spec: a.spec, metric: a.metric, expectedEffect: a.expectedEffect, priority: a.priority });
      if (!r.ok) return r;
      return { ok: true, upgrade: r.upgrade, undo: { kind: "upgrade-remove", id: r.upgrade.id } };
    },
    undo: async u => (await import("./_evolve.js")).removeUpgrade(u.id) },

  /* R2: what the public sees */
  "lineup-skip": { tier: "R2", caps: ["lineup"], args: "{date, slot}", describe: "skip one reel slot not yet sent, today or tomorrow (UTC) only; at most one skip of its own a day",
    run: (a, ctx) => lineupRun("skip", a, ctx), undo: lineupUndo },
  "lineup-swap": { tier: "R2", caps: ["lineup"], args: "{date, slot, id}", describe: "swap one reel slot not yet sent, today or tomorrow (UTC) only, for a named card already on the shelf",
    run: (a, ctx) => lineupRun("swap", a, ctx), undo: lineupUndo },
  "experiment-plan": { tier: "R2", caps: ["experiment"], args: "{id, start, args}", describe: "plan a registered experiment (verse-length, reciter-pair) to start on a date",
    run: async a => {
      const id = str(a.id, 40), start = str(a.start, 10);
      const r = await planExperiment(id, start, (a.args && typeof a.args === "object") ? a.args : {}, {});
      if (!r.ok) return r;
      await deps().observatoryInvalidate().catch(() => {});
      return { ok: true, current: r.state.current, undo: { kind: "experiment-withdraw", id, start } };
    },
    undo: async u => {
      let st;
      try { st = await deps().expState(); } catch { return { ok: false, error: "the experiment state could not be read" }; }
      const cur = st && st.current;
      if (!cur || cur.id !== u.id || cur.start !== u.start) return { ok: false, error: "the test was changed since; nothing was undone" };
      const rows = cur.start > dayOf() ? [] : await igRowsFor60();
      const r = await stopExperiment(rows, { by: "soul" });
      if (!r.ok) return r;
      await deps().observatoryInvalidate().catch(() => {});
      return { ok: true, note: "the plan was withdrawn by stopping it: the test now sits in the history as stopped, the honest record of a plan made and taken back" };
    } },
  "experiment-stop": { tier: "R2", caps: ["experiment"], args: "{}", describe: "stop the current experiment, folding its final reading into history",
    run: async () => {
      const r = await stopExperiment(await igRowsFor60(), { by: "soul" });
      if (!r.ok) return r;
      await deps().observatoryInvalidate().catch(() => {});
      return { ok: true, evaluation: r.evaluation ? { id: r.evaluation.id, status: r.evaluation.status, verdict: r.evaluation.verdict || null } : null,
        undo: { kind: "irreversible", note: "a stopped test cannot be put back as it was; its final reading stays in the history, and it can be planned again from the console" } };
    },
    undo: async u => ({ ok: false, error: u.note }) },
  "insights-refresh": { tier: "R2", args: "{}", describe: "read the networks' public numbers again and take the day's stats snapshot",
    run: async () => {
      const r = await deps().insightsRefresh();
      /* the gifts are read with the networks, at most every 6 hours (LANTERN.md section 9) */
      try { await refreshGiving({}); } catch { }
      return { ...r, ok: !!(r && r.ok), undo: NOOP("this read the numbers the networks already show publicly and cached them; nothing on the site changed") };
    },
    undo: async () => ({ ok: true, note: "nothing to put back" }) },
  /* the changed pages of the sitemap offered to the IndexNow engines (Bing,
     Yandex and the rest), at most 100 a day, counted in code; a ping asks a
     search engine to look again and changes nothing anyone sees, so its undo
     is a plain note */
  "indexnow-submit": { tier: "R2", args: "{max}", describe: "offer up to 100 changed sitemap pages a day to the IndexNow search engines (Bing, Yandex and others)",
    run: async a => {
      const r = await I.indexnowSubmit({ max: a.max, date: dayOf() });
      if (!r.ok) return r;
      return { ...r, undo: NOOP("a ping asks the search engines to read pages again; nothing on the site changed") };
    },
    undo: async () => ({ ok: true, note: "nothing to put back" }) },
  "reconcile-teach": { tier: "R2", args: "{network}", describe: "teach the duplicate guard what a network already holds",
    run: async a => {
      const network = str(a.network, 20);
      if (!network) return { ok: false, error: "which network?" };
      const r = await deps().teachGuard(network);
      if (!r || !r.ok) return { ok: false, error: (r && r.why) || "could not teach the guard" };
      return { ok: true, network, written: r.written, undo: { kind: "reconcile-teach-revert", keys: (r.taught || []).map(t => ({ reel: t.reel, network, before: t.before || null, wrote: t.day ? t.day + "#" : null })) } };
    },
    undo: async u => deps().revertTaught(u.keys) }
};
/* the posting levers (api/_levers.js) join the registry under the same rules */
for (const [n, h] of Object.entries(LEVERS)) { if (!HANDS[n]) HANDS[n] = h; }
/* outreach: and the research and the letters to places (api/_outreach.js, LANTERN.md section 11.3) */
for (const [n, h] of Object.entries(OUTREACH_HANDS)) { if (!HANDS[n]) HANDS[n] = h; }
/* sustaining the house (api/_giving.js, LANTERN.md section 9), the same way */
for (const [n, h] of Object.entries(GIVING_HANDS)) { if (!HANDS[n]) HANDS[n] = h; }
/* mission: and so do the mission powers (api/_mission.js, LANTERN.md section 8) */
for (const [n, h] of Object.entries(MISSION_HANDS)) { if (!HANDS[n]) HANDS[n] = h; }
/* mail: and the mailbox's hands (api/_mail.js, LANTERN.md section 11) */
for (const [n, h] of Object.entries(MAIL_HANDS)) { if (!HANDS[n]) HANDS[n] = h; }

async function readGoalsSafe() {
  try { return await readGoals(); } catch { return []; }
}

/* the registry as the planner reads it */
export function registryText() {
  return Object.keys(HANDS).map(n => n + " (" + HANDS[n].tier + ") " + HANDS[n].args + ": " + HANDS[n].describe).join("\n");
}
export const tierOf = name => (HANDS[name] ? HANDS[name].tier : null);

/* ---------------------------------------------------------------------------
   4. RUN AND UNDO
--------------------------------------------------------------------------- */
function compactResult(r) {
  if (!r || typeof r !== "object") return r;
  const { undo, data, ...rest } = r;
  try { const s = JSON.stringify(rest); return s.length > 1500 ? { ok: rest.ok, note: "result too long to keep in full" } : rest; } catch { return { ok: rest.ok }; }
}

/* THE OWNER'S APPROVAL, read strictly: {owner: true, source, id}, the
   source one of the three doors the Home has (a decision, a Next item, an
   idea) and the id the thing he approved. Anything else is no approval at
   all, and an R2 hand then needs the council like any other. */
export const OWNER_SOURCES = Object.freeze(["decision", "next", "idea"]);
export function ownerApproval(a) {
  if (!a || typeof a !== "object" || a.owner !== true) return null;
  const source = String(a.source || ""), id = String(a.id || "").trim().slice(0, 120);
  if (!OWNER_SOURCES.includes(source) || !id) return null;
  return { owner: true, source, id };
}

/* opts: {actor, cycle, approval (the council's own verdicts, or the owner's
   own {owner: true, source, id}), why, metric, before: {metric, value,
   date}, the named metric's reading the morning the action ran, kept on
   every R2 entry for the effects ledger} */
export async function runHand(intent, opts = {}) {
  const it = (intent && typeof intent === "object") ? intent : {};
  const name = String(it.action || "");
  const own = ownerApproval(opts.approval);
  const rl = redLineCheck(it);
  if (!rl.ok) {
    try { await auditAppend({ kind: "refused", actor: opts.actor || "soul", summary: "refused at the red line: " + rl.text + (own ? " (the owner approved it; the red lines hold for him too)" : ""), data: { action: name.slice(0, 60), line: rl.line, cycle: opts.cycle || null, ...(own ? { approval: own } : {}) } }); } catch { }
    return { ok: false, refused: "R3", line: rl.line, error: rl.reason };
  }
  const hand = Object.prototype.hasOwnProperty.call(HANDS, name) ? HANDS[name] : null;
  if (!hand) return { ok: false, refused: "unknown", error: "no such hand: " + name.slice(0, 60) + "; only a registered hand can run" };
  if (await isPaused()) return { ok: false, refused: "paused", error: "the Lantern is paused; nothing runs until the owner resumes it" };
  const args = (it.args && typeof it.args === "object" && !Array.isArray(it.args)) ? it.args : {};
  /* his own concrete change is a decision he answered or a step he ran from
     Next; a Go on an idea stands in for the council on the steps he was
     shown, and for nothing more: they keep the Lantern's own per-date
     limits and never overwrite a slot he set himself (6 October 2026) */
  const ctx = { why: str(it.why, 600), cycle: opts.cycle || null, actor: opts.actor || "soul", ownerApproved: !!own && own.source !== "idea", approval: own };

  if (hand.tier === "R0") {
    try { const r = await hand.run(args, ctx); return { ok: !!(r && r.ok), tier: "R0", data: r && r.data }; }
    catch (e) { return { ok: false, tier: "R0", error: String(e && e.message || e).slice(0, 200) }; }
  }
  /* the owner's approval stands in for the council's vote, and for nothing
     else: everything below this line applies to him as to the Lantern */
  if (hand.tier === "R2" && !own && !councilRule(opts.approval && opts.approval.verdicts)) {
    return { ok: false, refused: "council", error: "a public action runs only once the council approves it (the Guardian and at least two of three), or the owner does" };
  }
  /* a lever that only repairs what the schedule already owes (ownCapOnly)
     spends its own cap and not the day's total of public actions */
  const kinds = hand.tier === "R2" ? (hand.ownCapOnly ? [...(hand.caps || [])] : ["r2", ...(hand.caps || [])]) : [];
  const day = dayOf();
  const res = await reserve(kinds, day);
  if (!res.ok) return { ok: false, refused: "cap", error: res.error };
  const id = newId("act");
  const approvedBy = own ? "owner" : hand.tier === "R2" ? "council" : null;
  const said = own ? ", approved by the owner (" + own.source + " " + own.id + ")" : "";
  try {
    await auditAppend({ kind: "act", actor: ctx.actor, summary: hand.tier + " " + name + " begins" + said, data: { id, hand: name, tier: hand.tier, args, why: ctx.why, cycle: ctx.cycle, approvedBy, ...(own ? { approval: own } : {}) } });
  } catch (e) {
    await release(kinds, day);
    return { ok: false, refused: "audit", error: "the audit entry could not be written, so nothing ran: " + String(e && e.message || e).slice(0, 120) };
  }
  let r;
  try { r = await hand.run(args, ctx); }
  catch (e) { r = { ok: false, error: "the hand itself failed: " + String(e && e.message || e).slice(0, 200) }; }
  if (!r || !r.ok) await release(kinds, day);
  const entry = {
    id, at: nowIso(), hand: name, tier: hand.tier, args, why: ctx.why, metric: str(it.metric, 60) || null,
    expectedEffect: str(it.expectedEffect, 300) || null, cycle: ctx.cycle, actor: ctx.actor,
    ok: !!(r && r.ok), error: r && !r.ok ? str(r.error, 300) : null,
    result: compactResult(r), undo: (r && r.ok && r.undo) || null, undone: false,
    ...(approvedBy ? { approvedBy } : {}), ...(own ? { approval: own } : {})
  };
  if (hand.tier === "R2" && entry.metric) {
    const b = opts.before && typeof opts.before === "object" ? opts.before : {};
    entry.before = { metric: entry.metric, value: typeof b.value === "number" && isFinite(b.value) ? b.value : null, date: realDate(b.date) ? b.date : day };
  }
  try { await actionsRecord(entry); } catch { /* the audit below still holds the record */ }
  try {
    await auditAppend({ kind: "action", actor: ctx.actor, summary: hand.tier + " " + name + (entry.ok ? " done" : " failed") + said, data: { id, hand: name, ok: entry.ok, error: entry.error, undo: entry.undo, approvedBy, ...(own ? { approval: own } : {}) } });
  } catch { entry.auditMissing = true; }
  return { ok: entry.ok, id, tier: hand.tier, entry, error: entry.error || undefined };
}

export async function undoAction(id, actor) {
  const list = await actionsList();
  const entry = list.find(x => x && x.id === id);
  if (!entry) return { ok: false, code: 404, error: "no such action" };
  if (entry.undone) return { ok: false, error: "this action was already undone" };
  if (!entry.ok) return { ok: false, error: "this action never took effect, so there is nothing to undo" };
  const hand = HANDS[entry.hand];
  if (!hand || typeof hand.undo !== "function" || !entry.undo) return { ok: false, error: "this action carries no undo" };
  let r;
  try { r = await hand.undo(entry.undo); }
  catch (e) { r = { ok: false, error: String(e && e.message || e).slice(0, 200) }; }
  try { await auditAppend({ kind: r.ok ? "undo" : "undo-refused", actor: actor || "owner", summary: (r.ok ? "undid " : "could not undo ") + entry.hand + " " + id, data: { id, hand: entry.hand, result: compactResult(r) } }); } catch { }
  if (r.ok) await actionsUpdate(id, { undone: true, undoneAt: nowIso(), undoneBy: actor || "owner" });
  return { ...r, ok: !!r.ok, id };
}

export { metricValue, CAP_LIMITS };
