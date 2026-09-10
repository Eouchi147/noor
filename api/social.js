// The social machine.
//
// Once a day the house takes the light it has already chosen and audited, and
// puts it where people are.
//
// This is a port of a machine that has been running in production elsewhere,
// and the rules below are not preferences. Each one is here because the other
// way was tried first and broke in public.
//
// THE FOUR RULES
//
// 1. Ships dark, escalates by choice.  off -> approve -> auto. The ladder is
//    climbed one rung at a time and the code must be happy sitting on any rung
//    forever. `off` is the shipped state.
//
// 2. Captions are built, not dreamed. The words come from a card that was
//    written and validated before it entered the library. The Lantern is
//    allowed to tighten a sentence and nothing more, it is not asked at all
//    for a card carrying a Qur'an or hadith citation, and a mechanical guard
//    throws its work away if it introduces so much as a number.
//
// 3. One item, one post, ever. The day's key is written BEFORE the network
//    calls, and each network's own post id is written the moment it lands, so
//    a retry after a half failure sends only the missing half.
//
// 4. The token belongs to the owner. Created in Meta's tools, pasted into the
//    host's environment, never generated, never logged, never stored here.
//
// AND, SINCE 9 SEPTEMBER 2026
//
//    The five daily cards are stories, not feed posts (social.cardsFeed, off
//    by default; see cardIsStoryOnly). The five reels keep the feed, offered
//    to YouTube first. What the owner shares from the phone by hand is noted
//    on the record as results.phone (action=shared) and never mistaken for a
//    network. The console's Today room reads action=today for the day's
//    reels, and api/reel.js hands the phone the bytes.
//
// AND THE RULE UNDER ALL FOUR
//
//    Read failures mean off, in every direction. If the store cannot be read,
//    the answer is "do not post", never "assume it was fine". Not knowing must
//    never be the thing that publishes to a public account.
//
// WHAT HAS AND HAS NOT BEEN RUN
//    The composer, the modes, the guards, the de-duplication, the caption
//    limits and the dry run are covered by tests/social.mjs. The calls to Meta
//    have not been run against live credentials, because this repository holds
//    none. Preview, then Post once by hand from the console, and read what
//    comes back, BEFORE turning the schedule on.

import crypto from "crypto";
import { kv, kvReady } from "./_kv.js";
import { planDay, buildSlot, dueNow, slotExtras, chooseReel, SLOT_IDS, SLOTS, REEL_SLOTS } from "./_schedule.js";
import { readManifest, rowUrls } from "./_reels.js";
import * as CH from "./_channels.js";
import * as TH from "./_threads.js";
import { chooseLight } from "./_lights.js";
import { askOpenRouter } from "./_models.js";
import { ownerGate } from "./_owner.js";
import { trimToSentences } from "./_prose.js";

/* Meta issues two kinds of publishing credential. The classic route, through
   Facebook login and a linked Page, hands out EAA... tokens and speaks
   graph.facebook.com. The newer route, Instagram login from the app dashboard,
   hands out IG... tokens and speaks graph.instagram.com. The publish dance is
   identical on both, so the host is read off the token rather than set by a
   human, and therefore cannot be set wrong. */
const GRAPH_FB = "https://graph.facebook.com/v21.0";
const GRAPH_IG = "https://graph.instagram.com/v21.0";
export const graphBase = tok => (/^IG/.test(String(tok || "")) ? GRAPH_IG : GRAPH_FB);
const prevDate = d => new Date(Date.parse(d + "T00:00:00Z") - 86400000)
  .toISOString().slice(0, 10);

const K_LOG = "nsoc:log";
const K_Q = "nsoc:q";
const K_DAY = d => "nsoc:day:" + d;
const K_TOK = "nsoc:tok";

/* Instagram's own limits, enforced here rather than trusted to whoever writes
   a card. 2200 characters, 30 hashtags. */
const CAP_CHARS = 2200;
const CAP_TAGS = 30;
const TOKEN_LIFE_DAYS = 60;

const json = (res, code, obj) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(obj);
};

/* ---------------------------------------------------------------------------
   the production host

   Meta FETCHES the image from the server. It cannot be handed bytes, a data
   URI, localhost, or a preview deployment hostname: a preview host baked into
   a live Instagram post is a dead image within days. So the host is forced to
   production no matter which deployment composed the post.
--------------------------------------------------------------------------- */
const SITE = () => (process.env.SITE_HOST || "noorcodex.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
export function publicHost(host) {
  const h = String(host || "").replace(/^https?:\/\//, "").split("/")[0];
  return /(^|\.)noorcodex\.(com|ca)$/.test(h) ? h : SITE();
}

/* ---------------------------------------------------------------------------
   the dials
--------------------------------------------------------------------------- */
const MODES = new Set(["off", "approve", "auto"]);
const K_SET = "nb:settings";

/* READING THE DIAL.

   The owner pressed "Full auto", the page reloaded, and the room came back
   reading "Off". A decision he had made was silently undone, which is the
   worst thing a settings room can do, because it teaches the owner that the
   control does not work and gives him nothing to act on.

   Two separate faults did it. The first is here: this function used to test
   the stored value with MODES.has(), which passes only for the exact strings
   "off", "approve" and "auto". Anything else -- a value a generic settings
   writer JSON-encoded a second time, a string with a space around it, a
   capital letter, the older boolean, the console's own button label -- failed
   that test and fell through to the shipped default, which is "off". A dial
   that was genuinely set came back reading off.

   So the read is now generous and the write is strict: whatever shape a value
   arrives in, if its meaning is unambiguous it is honoured; what gets written
   back by setMode below is always the plain canonical word. Being strict on
   the way in was never protecting anything -- an unrecognised value still
   lands on "off", which is the safe end of the ladder. */
export function normMode(v) {
  if (v === true) return "auto";
  if (v === false) return "off";
  let s = String(v == null ? "" : v).trim().toLowerCase();
  if (s.length > 1 && ((s[0] === '"' && s[s.length - 1] === '"') ||
                       (s[0] === "'" && s[s.length - 1] === "'")))
    s = s.slice(1, -1).trim();
  s = s.replace(/[\s_-]+/g, " ").trim();
  if (MODES.has(s)) return s;
  if (s === "1" || s === "true" || s === "on" || s === "yes" ||
      s === "full" || s === "full auto" || s === "fullauto") return "auto";
  if (s === "0" || s === "false" || s === "no" || s === "none" ||
      s === "stop" || s === "paused") return "off";
  if (s === "manual" || s === "review" || s === "draft" ||
      s === "i approve each post") return "approve";
  return "";
}

/* social.cardsFeed: THE CARDS LEAVE THE FEED.

   The owner's decision of 9 September 2026, after reading the insights: the
   five daily cards (dawn, lead, light, word, dusk) reach nobody in a feed,
   and the reels are what strangers watch. So a card is a story now, on
   Facebook and Instagram, and nothing else: it still greets the followers
   who open stories, it still carries the library's words, and it no longer
   sits in the grid making the account read as a poster of posters. The
   reels keep the feed. The dial is OFF by default (cards to stories only);
   ON is the old behaviour, a feed post with a story after it, kept for the
   day the owner wants it back. */
export async function dials() {
  /* the shipped state, and the state a store that will not answer gets */
  const v = { mode: "off", fb: true, ig: true, polish: true, stories: true, cardsFeed: false, storeOk: false };
  if (!kvReady()) return v;
  try {
    const raw = (await kv([["GET", K_SET]]))[0];
    const o = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
    v.storeOk = true;
    const m = normMode(o["social.mode"]);
    if (m) v.mode = m;
    else {
      const legacy = normMode(o["social.auto"]);   /* the older boolean dial */
      if (legacy) v.mode = legacy;
    }
    if (o["social.fb"] === false) v.fb = false;
    if (o["social.ig"] === false) v.ig = false;
    if (o["social.polish"] === false) v.polish = false;
    if (o["social.stories"] === false) v.stories = false;
    if (o["social.cardsFeed"] === true || normMode(o["social.cardsFeed"]) === "auto") v.cardsFeed = true;
  } catch { return { mode: "off", fb: true, ig: true, polish: true, stories: true, cardsFeed: false, storeOk: false }; }
  return v;
}

/* SETTING THE DIAL.

   The second fault: before this, social.mode was read in five places in this
   file and written in none. This route consumed a dial it had no way to move,
   so the console had to reach some other writer to change the ladder, and
   whether that writer would accept the key was not this file's business and
   therefore nobody's.

   The ladder's own route now owns the ladder's own dial. Three rules:

     - the rest of nb:settings is read, amended and written back, so turning
       the ladder up never wipes a zakat rate or a Facebook switch;
     - the value written is the plain canonical word, and the older boolean is
       kept in step so nothing else in the house disagrees;
     - it READS THE DIAL BACK before answering. The console has already been
       told "auto" once and had it turn back into off. This route does not
       claim a thing it has not seen. */
export async function setMode(mode) {
  const want = normMode(mode);
  if (!want) return { ok: false, code: 400, reason: "mode must be off, approve or auto" };
  if (!kvReady()) return { ok: false, code: 409, reason: "no store is configured, so the dial cannot be remembered" };
  try {
    const raw = (await kv([["GET", K_SET]]))[0];
    let o = {};
    if (raw) { try { o = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { o = {}; } }
    if (!o || typeof o !== "object" || Array.isArray(o)) o = {};
    o["social.mode"] = want;
    o["social.auto"] = want === "auto";
    await kv([["SET", K_SET, JSON.stringify(o)]]);
    const after = await dials();
    if (after.mode !== want)
      return { ok: false, code: 409, reason: "the store did not keep it", mode: after.mode, dials: after };
    return { ok: true, code: 200, mode: after.mode, dials: after };
  } catch (e) {
    return { ok: false, code: 409, reason: "store error: " + String((e && e.message) || e) };
  }
}

/* ---------------------------------------------------------------------------
   the caption

   THE CARD AND THE CAPTION SAY DIFFERENT THINGS, ON PURPOSE.

   The card holds as many whole sentences as its box allows and has to make
   sense to someone who never reads a word below it. The caption carries the
   WHOLE story, which is longer than the card can hold, so it is a real
   expansion of the picture rather than a transcript of it. On the day this was
   written the card ended at "never fully paid" and only the caption reached
   "the consequences were not military so much as demographic" -- which is the
   part that actually explains why the day mattered.

   The Lantern is allowed two things here and nothing else: the opening line,
   and the hashtags. It writes no facts. Both are checked mechanically against
   the card before they are used, and either can fall back on its own without
   taking the other down.
--------------------------------------------------------------------------- */
const BASE_TAGS = ["#Islam", "#IslamicHistory", "#NoorCodexOfLight"];
const FALLBACK_TAGS = "#Islam #IslamicHistory #Quran #Muslim #NoorCodexOfLight";

/* WHAT THE PROMOTION MAY AND MAY NOT CLAIM.
   The first version said "Read it at noorcodex.com" directly under a story
   about eleventh century Anatolia. The library does not teach Seljuk military
   history, so that sentence sent a reader looking for something that is not
   there. A free library cannot afford to overpromise: the one thing it has is
   that it tells the truth for nothing.
   What IS true, and is checked on the live site rather than remembered: a new
   light like this one appears every morning, and the library is the Qur'an
   recited, the prophets, and the words of the Path explained. The card is the
   invitation. The library is what the invitation is to. */
const PROMO =
  "A light like this one every morning, from Noor Codex of Light: a free illuminated library " +
  "of Islam. The whole Qur'an recited, the 25 prophets, and the words of the Path explained, " +
  "one at a time.\n\n" +
  "No ads. No trackers. No account. Free forever.\n\n" +
  "noorcodex.com";

/* Words a hook may capitalise without the card having to name them. Without
   this an opener like "Did" or "Before" reads as an invented proper noun and
   every hook is thrown away. */
const COMMON = new Set(("the a an and but or if so for from at in on by with of to is was were be been "
  + "this that these those it its he she they them his her their there here when where why how what who "
  + "which did does do done can could would should will shall may might must not no yes one two three "
  + "first last next before after until while during since about into over under between among each "
  + "every all most many few some any both then than as up out off down near far new old long short "
  + "great small good bad right left true false "
  /* The list above was written from memory and was too short. The first real
     hook the Lantern produced was thrown away over the word "Because", which
     the card happened not to use. A guard that refuses ordinary English is a
     guard that silently turns itself off, because every hook falls back. */
  + "because since although though whether once unless until without within despite across against "
  + "along around behind beyond during except inside outside through toward towards upon whose whom "
  + "whatever whenever wherever however therefore instead indeed perhaps almost nearly hardly rarely "
  + "often always never sometimes still yet also even just only more less much well back away together "
  + "alone again nothing nobody everything everyone someone something another other others own same "
  + "such enough later earlier today tomorrow yesterday now soon long ago").split(" "));

/* A hashtag may only name something the card already names. Anything else is
   the model inventing a subject, which is how an account about a religion ends
   up tagged with a place or a person the card never mentions. */
const TAG_SAFE = new Set(("islam islamic history islamichistory muslim muslims quran qur deen ummah "
  + "noor codex light noorcodexoflight learn learning knowledge seerah hadith sunnah faith "
  + "muslimhistory islamicart free library").split(" "));

/* THE MODEL WILL COPY YOUR EXAMPLE.
   The first prompt ended with a sample answer, {"hook":"...","tags":["#One",
   "#Two"]}, and the Lantern returned exactly that, verbatim. Both guards let it
   through: a hook of three dots carries no number, no capital and no emoji, and
   #One survived because its only word is under four letters and the escape for
   short words skipped the check. So the machine reported a polished caption and
   published the placeholder out of its own instructions.
   The prompt no longer contains anything copyable, and these are the words that
   are refused outright even if it ever does again. */
const PLACEHOLDER = new Set(("one two three four example examples tag tags hashtag hashtags "
  + "hook keyword keywords placeholder sample yourtag topic subject foo bar lorem ipsum").split(" "));

const words = tag => String(tag).replace(/^#/, "")
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_\-]+/g, " ")
  .toLowerCase().split(/\s+/).filter(Boolean);

export function tagAllowed(tag, source) {
  const bare = String(tag).replace(/^#/, "");
  const w = words(tag);
  if (!w.length || !/^[\p{L}\p{N}_]+$/u.test(bare)) return false;
  if (bare.length < 4) return false;                       /* #One, #Two */
  if (w.some(x => PLACEHOLDER.has(x))) return false;
  /* No escape for short words any more. "alp" is three letters and passes
     because the card says Alp Arslan; "one" is three letters and does not,
     because the only reason it appeared was my own example. */
  return w.every(x => TAG_SAFE.has(x) || source.includes(x));
}

/* ---------------------------------------------------------------------------
   custom hashtags without asking anyone

   The owner's requirement is that the tags are custom EVERY time. A free model
   cannot promise that: the first live answer echoed the placeholder out of the
   prompt and the caption fell back to the same five tags it would have used for
   any card in the library.
   So the card names its own. The people and places are already written in the
   title, the detail line and the category, in capitals, which is what a proper
   noun looks like. Pulling them out is mechanical, needs no model, cannot
   invent anything, and by construction every tag it produces is named by the
   card. The Lantern's suggestions are added on top when they survive the guard.
--------------------------------------------------------------------------- */
const NOT_A_SUBJECT = new Set(("january february march april may june july august september october "
  + "november december monday tuesday wednesday thursday friday saturday sunday "
  + "allah god lord indeed today year years day days night month century centuries "
  + "when what where which while there their they this that then than with without "
  + "after before during until about among between").split(" "));

export function tagsFromCard(light) {
  const fields = [light.category, light.detail, light.title, light.story];
  const seen = new Set(), out = [];
  fields.forEach((f, rank) => {
    const text = String(f || "");
    /* runs of capitalised words: "Alp Arslan", "Romanos IV Diogenes" */
    const runs = text.match(/\b[A-Z][\p{L}'\u2019-]+(?:\s+[A-Z][\p{L}'\u2019-]+)*/gu) || [];
    for (const run of runs) {
      /* Drop only the words that are not part of a name. The length test is
         applied to standalone words, never inside a run: "Alp" is three letters
         and dropping it turned Alp Arslan into #Arslan. */
      const kept = run.split(/\s+/).filter(w =>
        !COMMON.has(w.toLowerCase()) && !NOT_A_SUBJECT.has(w.toLowerCase()));
      if (!kept.length) continue;
      /* A name gives one tag, not one per half: #AlpArslan, never also #Arslan. */
      const cands = kept.length > 1 ? [kept.join("")] : kept.filter(w => w.length > 3);
      for (const c of cands) {
        const tag = "#" + c.replace(/[^\p{L}\p{N}]/gu, "");
        /* Seljuk and Seljuks are one subject, not two */
        const k = tag.toLowerCase().replace(/s$/, "");
        if (tag.length > 4 && !seen.has(k)) { seen.add(k); out.push(tag); }
      }
    }
  });
  return out.slice(0, 8);
}

export function hookAllowed(hook, source) {
  const h = String(hook || "").trim();
  if (!h || h.length > 110) return false;
  /* A hook has to be a sentence a person could read aloud. Three dots is not
     one, and it passed every other check. */
  const letters = (h.match(/\p{L}/gu) || []).length;
  const wordCount = h.split(/\s+/).filter(x => /\p{L}/u.test(x)).length;
  if (letters < 14 || wordCount < 3) return false;
  /* Only a hook made ENTIRELY of placeholder words is refused. Checking word by
     word rejected "One afternoon changed a language", which is ordinary
     English, and a guard that refuses ordinary English refuses every hook. */
  const hw = h.split(/\s+/).map(x => x.toLowerCase().replace(/[^\p{L}]/gu, "")).filter(Boolean);
  if (hw.length && hw.every(x => PLACEHOLDER.has(x))) return false;
  /* The old range started at U+1F300 and let every dingbat through: a sparkle
     is U+2728 and would have gone out on a card about the Prophet. Arrows,
     dingbats, symbols, variation selectors and the emoji planes, all of it. */
  if (/[\u2014\u2013!]/.test(h)) return false;
  if (/[\u2190-\u21FF\u2300-\u27BF\u2B00-\u2BFF\uFE0F\u{1F000}-\u{1FAFF}]/u.test(h)) return false;
  const nums = x => (x.match(/\d+/g) || []);
  const ours = new Set(nums(source));
  if (nums(h).some(n => !ours.has(n))) return false;
  const low = source.toLowerCase();
  /* a capitalised word the card never uses is a name that was made up */
  return (h.match(/\b[A-Z][\p{L}\u2019'-]{2,}/gu) || [])
    .every(w => COMMON.has(w.toLowerCase()) || low.includes(w.toLowerCase()));
}

/* Instagram counts hashtags across the whole caption and rejects past 30, and
   truncates past 2200 characters. Trim rather than trust. */
export function fitCaption(text) {
  let out = String(text);

  /* over thirty hashtags and Instagram rejects the caption outright */
  const tags = out.match(/#[\p{L}\p{N}_]+/gu) || [];
  if (tags.length > CAP_TAGS) {
    let seen = 0;
    out = out.replace(/#[\p{L}\p{N}_]+/gu, m => (++seen > CAP_TAGS ? "" : m));
  }

  /* The trailing hashtag block is held back from the length trim. Trimming the
     tail is the obvious way to fit 2200 characters, and it is wrong here: the
     tags are the last thing in the caption, so a long story would silently
     take the whole block with it and the post would go out untagged. The body
     is what gets shortened. */
  if (out.length > CAP_CHARS) {
    const m = out.match(/(\n+#[\p{L}\p{N}_]+(?:[ \t]+#[\p{L}\p{N}_]+)*\s*)$/u);
    const tail = m ? m[1] : "";
    const head = tail ? out.slice(0, out.length - tail.length) : out;
    const room = CAP_CHARS - tail.length - 1;
    out = (room > 40 ? head.slice(0, room).replace(/\s+\S*$/, "") + "…" : head.slice(0, CAP_CHARS - 1)) + tail;
  }
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* The Lantern's one job here is to tighten the opening line of a caption whose
   every word came out of a validated card. It is NOT asked at all when the card
   carries a Qur'an or hadith citation: a model can change the sense of a
   sentence without touching a single number, and on that material the risk is
   not worth a better opening line. */
const CITED = new Set(["quran", "sunnah", "debated"]);
export const polishAllowed = light => !CITED.has(light && light.lvl);

/* The whole story, never a fragment. 1500 characters is far under Instagram's
   2200 and leaves room for the promotion and the tags underneath. */
const STORY_BUDGET = 1500;

export function buildCaption(light, hook, tags) {
  const story = trimToSentences(light.story || "", STORY_BUDGET) || String(light.story || "");
  const head = hook && hook !== light.title ? hook + "\n\n" + light.title : light.title;
  /* Even with the Lantern switched off entirely, the tags are the card's own. */
  const auto = tags && tags.length ? tags : [...new Set([...tagsFromCard(light), ...BASE_TAGS])];
  const tagLine = (auto.length ? auto.join(" ") : FALLBACK_TAGS);
  return fitCaption(`${head}\n\n${story}\n\n${light.detail}\n\n${PROMO}\n\n${tagLine}`);
}

async function caption(light, polish) {
  const plain = buildCaption(light, "", null);
  if (!polish) return { text: plain, polished: false };
  if (CITED.has(light.lvl)) return { text: plain, polished: false, refused: "it carries a citation" };

  const source = [light.title, light.story, light.detail, light.category].filter(Boolean).join(" ");
  try {
    const got = await askOpenRouter([
      { role: "system", content:
        "You write the opening line and the hashtags for one post from a free Islamic library. " +
        "You do not write facts. Every word you produce must already be supported by the text you are given: " +
        "you may not add a name, number, date, place or claim that is not in it. " +
        "The opening line must make a reader stop scrolling. It may be a question or a plain striking " +
        "statement. Under 90 characters. No emoji, no exclamation marks, no em dashes. " +
        "Then six to ten hashtags naming the people, places and subjects the text actually " +
        "names. Every hashtag must be a word the text itself uses. " +
        "Reply with nothing but a JSON object carrying two keys. The key hook holds your opening " +
        "line as a string. The key tags holds an array of strings, each starting with a hash. " +
        "Do not copy any wording from these instructions into your answer." },
      { role: "user", content: source }
    ], { max_tokens: 300, temperature: 0.5, timeout: 8000, budget: 16000, maxTries: 2,
         title: "NOOR Codex of Light · the day's post" });

    let p = null;
    try { p = JSON.parse(String(got.text || "")); }
    catch { const m = String(got.text || "").match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]); } catch { } } }
    if (!p) return { text: plain, polished: false, refused: "the editor did not answer" };

    /* Each half stands or falls on its own: a bad hook must not cost us good
       tags, and a bad tag must not cost us a good hook. */
    const hookOk = hookAllowed(p.hook, source);
    const kept = (Array.isArray(p.tags) ? p.tags : [])
      .map(x => "#" + String(x).replace(/^#/, "").replace(/[^\p{L}\p{N}_]/gu, ""))
      .filter(x => x.length > 2 && tagAllowed(x, source.toLowerCase()))
      .slice(0, CAP_TAGS - BASE_TAGS.length);
    /* The card's own names come first: they are always custom and always true.
     Whatever the Lantern offered that survived the guard is added after. */
  const mine = tagsFromCard(light);
  const tags = [...new Set([...mine, ...kept, ...BASE_TAGS])].slice(0, CAP_TAGS);
    /* The console has to be able to see a half failure. A caption that quietly
       falls back to the same five tags every day is the failure this whole
       change exists to make visible. */
    const bad = [];
    if (!hookOk) bad.push("the opening line was not supported by the card");
    if (!kept.length) bad.push("the editor's hashtags were refused, so these are the card's own names");

    return {
      text: buildCaption(light, hookOk ? String(p.hook).trim() : "", tags),
      polished: hookOk || kept.length > 0,
      refused: bad.join(" \u00b7 "), model: got.model
    };
  } catch { return { text: plain, polished: false }; }
}

export async function compose(host, date, opts = {}) {
  const light = await chooseLight(host, date, { useLantern: false, peek: true });
  if (!light) return null;
  const base = "https://" + publicHost(host);
  const cap = await caption(light, opts.polish !== false);
  return {
    date, light: { id: light.id, title: light.title, category: light.category, detail: light.detail, lvl: light.lvl },
    caption: cap.text, polished: cap.polished, refused: cap.refused || "",
    image: base + "/api/card?date=" + date + "&fmt=png",
    imageSvg: base + "/api/card?date=" + date,
    link: base + "/?light=" + date
  };
}

/* ---------------------------------------------------------------------------
   the pre-flight

   Failure mode number two in the ported machine's history, and its Meta error
   is uselessly vague: the image URL was not publicly reachable. The image is
   rendered on demand here, so the cheapest possible insurance is to fetch it
   ourselves first and refuse to post if it is not an image.
--------------------------------------------------------------------------- */
export async function imageReachable(url, ms) {
  try {
    const ctrl = new AbortController();
    /* twelve seconds is right when a post is on the line and wrong when this
       is the safety net tidying up: there, a slow card costs the run its
       remaining budget, so the healer asks for a much shorter patience. */
    const t = setTimeout(() => ctrl.abort(), Number(ms) || 12000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "noor-preflight" } });
    clearTimeout(t);
    const type = String(r.headers.get("content-type") || "");
    const len = Number(r.headers.get("content-length") || 0);
    if (!r.ok) return { ok: false, why: "the card URL answered " + r.status };
    if (!/^image\/(png|jpe?g)$/.test(type.split(";")[0].trim()))
      return { ok: false, why: "the card URL is " + (type || "untyped") + ", and Meta will only take a PNG or JPEG" };
    if (len && len > 8 * 1024 * 1024) return { ok: false, why: "the card is over 8MB" };
    return { ok: true, type, bytes: len };
  } catch (e) {
    return { ok: false, why: "the card URL could not be fetched: " + String(e && e.message || e).slice(0, 90) };
  }
}

/* ---------------------------------------------------------------------------
   the two networks

   Each gets its own attempt and its own recorded id. The ported machine's
   first cut returned on the first failure, so a sick Instagram blocked a
   healthy Facebook and the console said only "server error". Meta's own words
   are carried out per channel, because that is the one thing that lets a human
   fix a token instead of guessing.
--------------------------------------------------------------------------- */
export const fbConfigured = () => !!(process.env.FB_PAGE_ID && process.env.FB_PAGE_TOKEN);
export const igConfigured = () => !!(process.env.IG_USER_ID && (process.env.IG_TOKEN || process.env.IG_ACCESS_TOKEN || process.env.FB_PAGE_TOKEN));
export const igToken = () => process.env.IG_TOKEN || process.env.IG_ACCESS_TOKEN || process.env.FB_PAGE_TOKEN;

const metaErr = (j, fallback) =>
  (j && j.error && (j.error.error_user_msg || j.error.message)) ||
  (j && j.error_message) || fallback;

/* Meta's numeric code and subcode, carried beside the message.

   The message is prose, and prose is Meta's to reword whenever it likes; the
   code is the only stable handle anything downstream can hold. The first cut
   of this kept the sentence and threw the number away, which left a diagnosis
   with nothing to match on but English. */
const metaCode = j => {
  const e = (j && j.error) || {};
  const out = {};
  if (e.code != null) out.code = Number(e.code);
  if (e.error_subcode != null) out.sub = Number(e.error_subcode);
  return out;
};

/* ---------------------------------------------------------------------------
   the Page token, fetched rather than asked for

   A System User token is not a Page token. Post to /{page}/photos with one and
   Meta answers by naming a permission it deprecated in 2018:

     (#200) The permission(s) publish_actions are not available.

   which is a true sentence about the wrong thing, and it cost us the first
   real post. Instagram accepts the System User token directly, which is why
   that half went out and this half did not.

   The Page token is derivable from the System User token, so the house fetches
   it instead of asking a human to find, copy and paste a second secret. It is
   sent as a Bearer header, never in a query string, so it cannot be left
   behind in a log or a referrer. If the owner has already pasted a real Page
   token, asking the page for its token with it returns the same value, so this
   works either way and nothing needs to know which kind was pasted.
--------------------------------------------------------------------------- */
let PAGE_TOK = { at: 0, tok: "" };
const PAGE_TOK_TTL = 3600 * 1000;

export async function pageToken() {
  const id = process.env.FB_PAGE_ID, tok = process.env.FB_PAGE_TOKEN;
  if (!id || !tok) return "";
  if (PAGE_TOK.tok && Date.now() - PAGE_TOK.at < PAGE_TOK_TTL) return PAGE_TOK.tok;
  try {
    const r = await fetch(`${GRAPH_FB}/${id}?fields=access_token`, {
      headers: { authorization: "Bearer " + tok }
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j && j.access_token) {
      PAGE_TOK = { at: Date.now(), tok: j.access_token };
      return j.access_token;
    }
  } catch { }
  /* Falling back to what the owner pasted keeps the old behaviour rather than
     turning a fetch wobble into a silent refusal to post. */
  return tok;
}

async function postFacebook(post) {
  if (!fbConfigured()) return { ok: false, skipped: "FB_PAGE_ID or FB_PAGE_TOKEN is not set" };
  const id = process.env.FB_PAGE_ID, tok = await pageToken();
  try {
    const r = await fetch(`${GRAPH_FB}/${id}/photos`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: post.image, caption: post.caption, access_token: tok })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: metaErr(j, "http " + r.status), ...metaCode(j) };
    return { ok: true, id: j.post_id || j.id || "" };
  } catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 160) }; }
}

async function postInstagram(post) {
  if (!igConfigured()) return { ok: false, skipped: "IG_USER_ID or a token is not set" };
  const id = process.env.IG_USER_ID, tok = igToken(), G = graphBase(tok);
  try {
    /* two steps: create a container from the public image URL, then publish it */
    const makeContainer = () => fetch(`${G}/${id}/media`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ image_url: post.image, caption: post.caption, access_token: tok })
    });
    let c = await makeContainer();
    let cj = await c.json().catch(() => ({}));
    /* ONE MORE GO, IMMEDIATELY.

       Instagram fetches the card itself, and the card is rendered on demand by
       a function that may be cold. When that fetch is the thing that failed,
       the second attempt three seconds later is nearly always the one that
       works -- and the difference matters: the healer below would land this
       post an hour late, and a post an hour late is not the same post. Only
       the CREATE is retried. Publishing twice is not a thing to be casual
       about; creating a container that was never made is harmless. */
    if ((!c.ok || !cj.id) && healable({ ok: false, ...metaCode(cj) })) {
      await sleep(3000);
      c = await makeContainer();
      cj = await c.json().catch(() => ({}));
    }
    if (!c.ok || !cj.id)
      return { ok: false, error: metaErr(cj, "container http " + c.status), step: "container", ...metaCode(cj) };
    const p = await fetch(`${G}/${id}/media_publish`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ creation_id: cj.id, access_token: tok })
    });
    const pj = await p.json().catch(() => ({}));
    if (!p.ok)
      return { ok: false, error: metaErr(pj, "publish http " + p.status), step: "publish", ...metaCode(pj) };
    return { ok: true, id: pj.id || cj.id };
  } catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 160) }; }
}

/* ---------------------------------------------------------------------------
   reels

   A reel is not a photo with a longer file. Both platforms take it in stages,
   and both take it BY URL: the video is committed to /reels by the render
   workflow and served from the site, which is why this reuses the same token
   plumbing that already works for images rather than inventing an upload.

   Instagram is the awkward one. Creating the container returns immediately,
   but the video is then transcoded, and publishing before that finishes is
   refused. So this waits, and if the wait runs past what a serverless function
   may spend, it does NOT fail: it hands back the container id as `pending`,
   the slot is recorded as pending, and the next hourly cron publishes it. A
   post that arrives an hour late is a post; a function that dies at the
   timeout is a lost one, and the record would say "failed" about a video
   Instagram had accepted.
--------------------------------------------------------------------------- */
const IG_POLL_EVERY = Number(process.env.IG_POLL_EVERY_MS || 2500);
/* Vercel gives a function sixty seconds; this leaves room for the create call,
   the publish call and the rest of the run. Thirty two seconds was not enough
   for a twenty second 1080x1920 reel even once, so waiting was the exception
   and being handed back a container was the rule. */
const IG_POLL_BUDGET = Number(process.env.IG_POLL_BUDGET_MS || 40000);
/* ...and, since the clock per network (sendWithin), the poll also stops when
   the RUN has this much left, whatever its own budget says: a long recitation
   spent thirty eight seconds here after Facebook's eleven and was cut by the
   clock with its container lost. Handed back as pending instead, the same
   container is published next hour, and the networks behind it in the loop
   get their turn in this one. */
const IG_POLL_FLOOR = Number(process.env.IG_POLL_FLOOR_MS || 20000);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function igPublish(creationId, id, tok, G) {
  const p = await fetch(`${G}/${id}/media_publish`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: tok })
  });
  const pj = await p.json().catch(() => ({}));
  if (!p.ok) return { ok: false, error: metaErr(pj, "publish http " + p.status), step: "publish", ...metaCode(pj) };
  return { ok: true, id: pj.id || creationId };
}

/* Publish a container that was still transcoding when its run ran out of
   time. Called at the top of the next run, for the slots that recorded one. */
export async function finishInstagramReel(creationId) {
  if (!igConfigured()) return { ok: false, skipped: "IG_USER_ID or a token is not set" };
  const id = process.env.IG_USER_ID, tok = igToken(), G = graphBase(tok);
  try {
    const s = await fetch(`${G}/${creationId}?fields=status_code`, {
      headers: { authorization: "Bearer " + tok }
    });
    const sj = await s.json().catch(() => ({}));
    const code = sj && sj.status_code;
    if (code === "ERROR" || code === "EXPIRED")
      return { ok: false, error: metaErr(sj, "Instagram could not process the video: " + code) };
    if (code !== "FINISHED") return { ok: false, pending: creationId };
    return await igPublish(creationId, id, tok, G);
  } catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 160) }; }
}

async function postInstagramReel(post, left) {
  if (!igConfigured()) return { ok: false, skipped: "IG_USER_ID or a token is not set" };
  const room = () => typeof left === "function" ? left() - IG_POLL_FLOOR : Infinity;
  if (!post.video) return { ok: false, error: "no video for the reel" };
  const id = process.env.IG_USER_ID, tok = igToken(), G = graphBase(tok);
  try {
    const body = {
      media_type: "REELS", video_url: post.video, caption: post.caption,
      share_to_feed: true, access_token: tok
    };
    /* the cover is what the profile grid shows; without one Instagram takes
       the first frame, which is the picture before a single word has arrived */
    if (post.image) body.cover_url = post.image;
    const c = await fetch(`${G}/${id}/media`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const cj = await c.json().catch(() => ({}));
    if (!c.ok || !cj.id)
      return { ok: false, error: metaErr(cj, "container http " + c.status), step: "container", ...metaCode(cj) };

    const started = Date.now();
    while (Date.now() - started < IG_POLL_BUDGET && room() > 0) {
      await sleep(IG_POLL_EVERY);
      const s = await fetch(`${G}/${cj.id}?fields=status_code`, {
        headers: { authorization: "Bearer " + tok }
      });
      const sj = await s.json().catch(() => ({}));
      const code = sj && sj.status_code;
      if (code === "FINISHED") return await igPublish(cj.id, id, tok, G);
      if (code === "ERROR" || code === "EXPIRED")
        return { ok: false, error: metaErr(sj, "Instagram could not process the video: " + code) };
    }
    return { ok: false, pending: cj.id,
      error: "Instagram is still processing the video; it will be published on the next run" };
  } catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 160) }; }
}

/* STORIES: THE SAME THING, ON THE SURFACE THAT DOES NOT COST THE FEED.

   Every reel and every card can also be a story on both networks, for the
   followers who open stories and never scroll a feed. A story is a second
   surface, not a second post: it does not sit in the grid, it does not
   compete with the feed post for reach, and it is gone in a day. So each
   thing the house publishes goes there too, after the feed post has landed,
   and a story that fails is noted on the record and never retried: the feed
   post is the promise, the story is the bonus. */
async function postInstagramStory(post) {
  if (!igConfigured()) return { ok: false, skipped: "not configured" };
  const id = process.env.IG_USER_ID, tok = igToken(), G = graphBase(tok);
  const body = post.video ? { media_type: "STORIES", video_url: post.video, access_token: tok }
                          : { media_type: "STORIES", image_url: post.image, access_token: tok };
  if (!body.video_url && !body.image_url) return { ok: false, error: "nothing to show" };
  try {
    const c = await fetch(`${G}/${id}/media`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const cj = await c.json().catch(() => ({}));
    if (!c.ok || !cj.id) return { ok: false, error: metaErr(cj, "story container http " + c.status), ...metaCode(cj) };
    if (post.video) {
      /* a video story transcodes like a reel, which takes longer than a
         function has left by the time the feed post is up. One look, and if
         it is not ready the container is handed back: finishPendingReels
         publishes it on the next hourly run, well inside a story's day. */
      await sleep(Math.min(IG_POLL_EVERY, 3000));
      const sj = await (await fetch(`${G}/${cj.id}?fields=status_code`, { headers: { authorization: "Bearer " + tok } })).json().catch(() => ({}));
      if (sj.status_code === "ERROR" || sj.status_code === "EXPIRED") return { ok: false, error: "the story could not be processed: " + sj.status_code };
      if (sj.status_code !== "FINISHED") return { ok: false, pending: cj.id, note: "the story is still processing; it is published on the next run" };
    }
    return await igPublish(cj.id, id, tok, G);
  } catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 160) }; }
}

async function postFacebookStory(post) {
  if (!fbConfigured()) return { ok: false, skipped: "not configured" };
  const id = process.env.FB_PAGE_ID, tok = await pageToken();
  try {
    if (post.video) {
      const st = await fetch(`${GRAPH_FB}/${id}/video_stories`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ upload_phase: "start", access_token: tok }) });
      const sj = await st.json().catch(() => ({}));
      if (!st.ok || !sj.video_id || !sj.upload_url) return { ok: false, error: metaErr(sj, "story start http " + st.status) };
      const up = await fetch(sj.upload_url, { method: "POST", headers: { authorization: "OAuth " + tok, file_url: post.video } });
      const uj = await up.json().catch(() => ({}));
      if (!up.ok) return { ok: false, error: metaErr(uj, "story upload http " + up.status) };
      const fin = await fetch(`${GRAPH_FB}/${id}/video_stories`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ video_id: sj.video_id, upload_phase: "finish", access_token: tok }) });
      const fj = await fin.json().catch(() => ({}));
      if (!fin.ok) return { ok: false, error: metaErr(fj, "story finish http " + fin.status) };
      return { ok: true, id: fj.post_id || sj.video_id };
    }
    if (!post.image) return { ok: false, error: "nothing to show" };
    /* a photo story: the photo first, unpublished, then the story from it */
    const ph = await fetch(`${GRAPH_FB}/${id}/photos`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: post.image, published: false, access_token: tok }) });
    const pj = await ph.json().catch(() => ({}));
    if (!ph.ok || !pj.id) return { ok: false, error: metaErr(pj, "story photo http " + ph.status) };
    const stv = await fetch(`${GRAPH_FB}/${id}/photo_stories`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ photo_id: pj.id, access_token: tok }) });
    const sj2 = await stv.json().catch(() => ({}));
    if (!stv.ok) return { ok: false, error: metaErr(sj2, "photo story http " + stv.status) };
    return { ok: true, id: sj2.post_id || pj.id };
  } catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 160) }; }
}

const STORY = { instagram: postInstagramStory, facebook: postFacebookStory };

/* after a feed post landed on a network: the same thing as a story there.
   Bolted onto the channel's own result, so the slot's state (sent, partial,
   pending) is never decided by a story. */
const STORY_RESERVE_MS = Number(process.env.STORY_RESERVE_MS || 12000);
export async function addStories(results, post, D, left) {
  if (!D || D.stories === false) return false;
  let any = false;
  for (const ch of Object.keys(STORY)) {
    const r = results[ch];
    if (!r || !r.ok || r.story) continue;
    /* a story is the bonus: with no time left in the run it is simply not
       tried, and the record says so rather than the function being killed */
    if (typeof left === "function" && left() < STORY_RESERVE_MS) {
      r.story = { ok: false, skipped: "no time left in this run" }; any = true; continue; }
    try { r.story = await STORY[ch](post.video ? { ...post, video: await freshVideoUrl(post.video) } : post); }
    catch (e) { r.story = { ok: false, error: String(e && e.message || e).slice(0, 120) }; }
    any = true;
  }
  return any;
}

/* A CARD IS A STORY, AND NOTHING ELSE.

   With social.cardsFeed off (the shipped state since 9 September 2026) a
   card slot -- dawn, lead, light, word, dusk -- is composed exactly as it
   was: the record, the said-key, the image pre-flight. What changes is where
   it goes. No feed channel is asked. The story senders above are asked
   directly, one per live Meta network, and each answer is put on the record
   under that network in a shape the rest of the file already reads:

       { story: r, ok: r.ok, storyOnly: true, id, error, code, ... }

   `ok`, `pending`, `skipped`, `code` and `error` are lifted off the story's
   own answer so slotState, healable, healDue, diagnoseSlot and the console
   read a story-only slot the way they read a feed post; `story` keeps the
   whole answer so a reader can see it was a story; `storyOnly` is how a
   retry knows to send it as one again. A story-only slot that fails is
   healed like a feed post: retryChannel reads the flag off the record and
   sends the story again, through the same bounded, backing-off net.

   The stories dial (social.stories) does not govern this. That dial is about
   the SECOND surface after a feed post; for a card the story is the post,
   and a card sent nowhere would be a slot that reads sent and never was. */
export const cardIsStoryOnly = (post, D) => !!post && !post.video && !post.reel && !(D && D.cardsFeed === true);

function storyResult(r) {
  const s = r && typeof r === "object" ? r : { ok: false, error: "no answer" };
  const out = { story: s, ok: !!s.ok, storyOnly: true };
  if (s.id) out.id = s.id;
  if (s.pending) out.pending = s.pending;
  if (s.skipped) out.skipped = s.skipped;
  if (s.fatal) out.fatal = true;
  if (s.code != null) out.code = s.code;
  if (s.sub != null) out.sub = s.sub;
  if (!s.ok && (s.error || s.err)) { out.error = String(s.error || s.err); out.err = out.error; }
  return out;
}

async function sendStoryOnly(ch, post) {
  if (!STORY[ch]) {
    const why = "cards go to stories only, and " + ch + " has no story surface";
    return { ok: false, fatal: true, storyOnly: true, error: why, err: why };
  }
  let r;
  try { r = await STORY[ch](post); }
  catch (e) { r = { ok: false, error: String(e && e.message || e).slice(0, 120) }; }
  return storyResult(r);
}

/* the story-only send of one card to the live Meta networks, on the run's
   clock; `imgWhy` is the pre-flight's refusal when the caller ran one */
async function storyOnlyResults(post, date, chans, left, imgWhy) {
  const results = {};
  for (const ch of chans) {
    if (!post.image) {
      results[ch] = { ok: false, fatal: true, storyOnly: true, error: "needs an image", err: "needs an image" }; continue; }
    if (imgWhy) { results[ch] = { ok: false, storyOnly: true, error: imgWhy, err: imgWhy, pre: true }; continue; }
    try { results[ch] = await sendWithin(ch, null, { ...post, date }, left, sendStoryOnly); }
    catch (e) {
      const m = String(e && e.message || e).slice(0, 120);
      results[ch] = { ok: false, storyOnly: true, error: m, err: m };
    }
  }
  /* every result written here is a story-only result, including the ones
     the clock wrote (late) and the ones nothing answered: a slot whose two
     networks were both cut by the clock carried no mark at all, recordWay
     read it as a feed slot, and the healer sent the card to the FEED */
  for (const ch of Object.keys(results)) if (results[ch] && typeof results[ch] === "object") results[ch].storyOnly = true;
  return results;
}

/* which live channels a story-only card is offered to: the ones with a
   story surface, in the order the stories are made */
const storyChannels = post => liveChannels(post).filter(c => !!STORY[c]);

/* how a slot went, read off its record: "story" when any network on it was
   sent a story only, "feed" when networks are on it without that mark (a
   reel, or a card from before 9 September 2026), null when no network has
   answered for it yet. A Reddit draft and the owner's own phone note are
   not networks and do not say. */
function recordWay(rec) {
  const rs = Object.values((rec && rec.results) || {}).filter(r => r && typeof r === "object" && !r.draft && !r.hand);
  if (rs.some(r => r.storyOnly === true)) return "story";
  /* a feed result is one a network actually answered for, yes or no; a
     result the clock wrote, the pre-flight wrote, or nobody wrote (late,
     pre, skipped) decides nothing, and the dial does */
  if (rs.some(r => !r.late && !r.pre && !r.skipped && (r.ok || r.error || r.err || r.pending))) return "feed";
  return null;
}

/* Facebook takes a reel in three phases and fetches the file itself, so none
   of the bytes pass through here. */
async function postFacebookReel(post) {
  if (!fbConfigured()) return { ok: false, skipped: "FB_PAGE_ID or FB_PAGE_TOKEN is not set" };
  if (!post.video) return { ok: false, error: "no video for the reel" };
  const id = process.env.FB_PAGE_ID, tok = await pageToken();
  try {
    const st = await fetch(`${GRAPH_FB}/${id}/video_reels`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ upload_phase: "start", access_token: tok })
    });
    const sj = await st.json().catch(() => ({}));
    if (!st.ok || !sj.video_id || !sj.upload_url)
      return { ok: false, error: metaErr(sj, "start http " + st.status) };

    const up = await fetch(sj.upload_url, {
      method: "POST",
      headers: { authorization: "OAuth " + tok, file_url: post.video }
    });
    const uj = await up.json().catch(() => ({}));
    if (!up.ok) return { ok: false, error: metaErr(uj, "upload http " + up.status) };

    const fin = await fetch(`${GRAPH_FB}/${id}/video_reels`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ video_id: sj.video_id, upload_phase: "finish",
        video_state: "PUBLISHED", description: post.caption, access_token: tok })
    });
    const fj = await fin.json().catch(() => ({}));
    if (!fin.ok) return { ok: false, error: metaErr(fj, "finish http " + fin.status) };
    return { ok: true, id: sj.video_id };
  } catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 160) }; }
}

/* ---------------------------------------------------------------------------
   what a slot's state IS, in one place

   This existed twice, written slightly differently, and the two disagreed about
   a reel whose video Instagram had accepted but not yet finished processing:
   the cron path called it pending and the Post button called it sent. A slot
   marked sent is never looked at again, so a container that only needed another
   minute was stranded, and the reel never appeared on Instagram although
   Instagram had it the whole time.

   pending is not a failure and it is not a success. It means a network took the
   thing and has not finished with it, so it must be left alone by the sender
   and picked up by the finisher.
--------------------------------------------------------------------------- */
export function slotState(results) {
  /* `phone` is the owner's own hand (the Today room's Share button, recorded
     by the `shared` action): a note of what went out by hand, never a
     network, so it can neither make a slot sent nor keep it from going */
  const live = Object.entries(results || {}).filter(([c, r]) => !CH.draftOnly.has(c) && c !== "phone" && !(r && r.hand));
  const anySent = live.some(([, r]) => r && r.ok);
  const anyPending = live.some(([, r]) => r && r.pending && !r.ok);
  /* a channel that is not configured did not fail; it was never asked */
  /* and a network that is not open yet (Pinterest on Trial until its review)
     did not fail either: it is a stage, not a fault, and nobody can act on
     it. Counting it made every slot of the day read "half sent". */
  const anyFailed = live.some(([, r]) => r && !r.ok && !r.pending && !r.skipped && !r.trial && !r.waiting);
  if (anyPending) return "pending";
  /* One landed and one did not. This used to read "sent", which is how a post
     that never reached Instagram sat in the console under a green word for a
     week. It is not sent. It is half sent, and something has to come back. */
  if (anySent && anyFailed) return "partial";
  return anySent ? "sent" : "failed";
}

/* Publish any reel container a run had to leave transcoding.

   Keyed on the RESULT rather than on the slot's state, so it heals a record
   written by either path, including one an older version of this file wrote
   before the two agreed. Instagram keeps a container for about a day, so
   yesterday is as far back as it is worth looking.

   Two networks hand containers back: Instagram (the reel, and the video
   story beside it) and Threads (the reel). Each has a finisher here that
   takes the container id and answers { ok, id } when it is published,
   { pending } when it still is not, and { error } when the network gave up
   on it; the walk below is the same for both. A channel is added by adding
   its finisher. */
/* how long a handed-back container may stay pending before it is given up on */
const PENDING_MAX_MS = Number(process.env.PENDING_MAX_MS || 2 * 3600 * 1000);
const NET_NAME = ch => ({ instagram: "Instagram", threads: "Threads" })[ch] || ch;
const FINISHERS = {
  instagram: finishInstagramReel,
  threads: async cid => { const r = await TH.finish(cid); return r.ok ? r : { ...r, error: r.error || r.err || "" }; }
};

export async function finishPendingReels(date, out) {
  const ran = (out && out.ran) || [];
  for (const d of [prevDate(date), date]) {
    for (const id of REEL_SLOTS) {
      const rec = await readSlot(d, id);
      if (!rec || !rec.results) continue;
      let changed = false;
      for (const ch of Object.keys(FINISHERS)) {
        const had = rec.results[ch];
        if (!had) continue;
        /* a video story handed back as a container is finished the same way;
           it never touches the slot's state */
        if (had.ok && had.story && had.story.pending) {
          const st = await FINISHERS[ch](had.story.pending);
          if (!st.pending) {
            rec.results = { ...rec.results, [ch]: { ...had, story: st } };
            changed = true;
            ran.push({ slot: id, date: d, state: rec.state, finished: true, where: ch + " story", ok: !!st.ok, error: st.error || "" });
          }
          continue;
        }
        if (had.ok || !had.pending) continue;
        let r = await FINISHERS[ch](had.pending);
        /* A container Instagram never finishes is not transcoding, whatever
           its status says: the 14:00 reel sat IN_PROGRESS from two in the
           afternoon until evening while the owner pressed Finish. After this
           long the container is given up on and the network is recorded as
           refused in words, so the healer sends the reel again as a fresh
           container next hour. Nothing was published from the old one, so
           nothing can be doubled. */
        if (r.pending && rec.at && Date.now() - Date.parse(rec.at) > PENDING_MAX_MS) {
          const hours = Math.round((Date.now() - Date.parse(rec.at)) / 3600000);
          r = { ok: false, gaveUp: true, error: NET_NAME(ch) + " never finished the video in " + hours + " hours; sent again as a fresh one next hour" };
        }
        if (r.pending) { ran.push({ slot: id, date: d, state: "pending", where: ch }); continue; }
        rec.results = { ...rec.results, [ch]: r };
        rec.state = slotState(rec.results);
        if (r.ok && ch === "instagram") rec.igId = r.id || "posted";
        changed = true;
        ran.push({ slot: id, date: d, state: rec.state, finished: true,
                   where: ch, ok: !!r.ok, error: r.error || "" });
      }
      if (changed) await writeSlot(d, id, rec);
    }
  }
  return ran;
}

/* Never throws. A network wobble must not take the cron down with it. */
export async function publishAll(rec, post, D) {
  const ran = [];
  const isReel = !!post.video;
  if (D.fb && !rec.fbId) {
    const r = isReel ? await postFacebookReel(post) : await postFacebook(post);
    if (r.ok) rec.fbId = r.id || "posted";
    ran.push({ where: "facebook", ...r });
  } else if (D.fb) ran.push({ where: "facebook", ok: true, id: rec.fbId, already: true });
  if (D.ig && !rec.igId) {
    const r = isReel ? await postInstagramReel(post) : await postInstagram(post);
    if (r.ok) rec.igId = r.id || "posted";
    else if (r.pending) rec.igPending = r.pending;
    ran.push({ where: "instagram", ...r });
  } else if (D.ig) ran.push({ where: "instagram", ok: true, id: rec.igId, already: true });
  return ran;
}

/* ---------------------------------------------------------------------------
   the record for one day
--------------------------------------------------------------------------- */
async function readDay(date) {
  if (!kvReady()) return { err: "no store" };
  try {
    const r = (await kv([["GET", K_DAY(date)]]))[0];
    if (!r) return null;
    return typeof r === "string" ? JSON.parse(r) : r;
  } catch (e) { return { err: String(e && e.message || e).slice(0, 80) }; }
}

async function writeDay(date, rec, alsoLog) {
  if (!kvReady()) return;
  const cmds = [["SET", K_DAY(date), JSON.stringify(rec)], ["EXPIRE", K_DAY(date), "7776000"]];
  /* The history is not optional. In the ported machine it was missing for
     months, and the cost was that a post which succeeded left the queue and
     therefore became invisible: nobody could see, review or edit anything that
     had gone out. Leaving the queue and joining the history is ONE write. */
  if (alsoLog) {
    cmds.push(["LPUSH", K_LOG, JSON.stringify(rec)], ["LTRIM", K_LOG, "0", "120"],
              ["EXPIRE", K_LOG, "31536000"], ["LREM", K_Q, "0", date]);
  }
  try { await kv(cmds); } catch { }
}

export async function socialLog() {
  if (!kvReady()) return [];
  try {
    const r = await kv([["LRANGE", K_LOG, "0", "60"]]);
    return ((r && r[0]) || []).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

export async function queue() {
  if (!kvReady()) return [];
  try {
    const r = await kv([["LRANGE", K_Q, "0", "30"]]);
    const dates = (r && r[0]) || [];
    const out = [];
    for (const d of dates) { const rec = await readDay(d); if (rec && !rec.err) out.push(rec); }
    return out;
  } catch { return []; }
}

/* ---------------------------------------------------------------------------
   the token clock

   Meta's long-lived tokens expire every sixty days, silently: no warning, no
   email, no error until the next post fails. This is the single most common
   operational failure in the machine this was ported from. The owner taps
   "renewed it" and the console counts down. The code never sees the token.
--------------------------------------------------------------------------- */
export async function tokenClock() {
  const out = {
    fb: { configured: fbConfigured(), renewedAt: "", daysLeft: null },
    ig: { configured: igConfigured(), renewedAt: "", daysLeft: null },
    lifeDays: TOKEN_LIFE_DAYS
  };
  if (kvReady()) {
    try {
      const raw = (await kv([["GET", K_TOK]]))[0];
      const o = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
      for (const k of ["fb", "ig"]) {
        const at = String(o[k] || "");
        if (/^\d{4}-\d{2}-\d{2}$/.test(at)) {
          out[k].renewedAt = at;
          const age = Math.floor((Date.now() - Date.parse(at + "T00:00:00Z")) / 86400000);
          out[k].daysLeft = TOKEN_LIFE_DAYS - age;
        }
      }
    } catch { }
  }
  return out;
}

export async function markTokenRenewed(which, date) {
  if (!kvReady()) return { ok: false, why: "no store" };
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? date : new Date().toISOString().slice(0, 10);
  try {
    const raw = (await kv([["GET", K_TOK]]))[0];
    const o = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
    if (which === "fb" || which === "both") o.fb = day;
    if (which === "ig" || which === "both") o.ig = day;
    await kv([["SET", K_TOK, JSON.stringify(o)]]);
    return { ok: true, at: day };
  } catch (e) { return { ok: false, why: String(e && e.message || e).slice(0, 80) }; }
}

/* ---------------------------------------------------------------------------
   the daily run

   Exactly one post per run, success or failure. One a day, never two:
   consistency reads as considered, flooding reads as noise.
--------------------------------------------------------------------------- */
export async function runDaily(host, date, opts = {}) {
  const D = await dials();
  const out = { date, mode: D.mode, ran: [], skipped: "" };

  /* rule 1: off means off, and a store that will not answer means off too */
  if (!opts.force) {
    if (D.mode === "off") { out.skipped = "the machine is off"; return out; }
    if (!D.storeOk) { out.skipped = "the settings could not be read, so nothing was sent"; return out; }
  }

  /* rule 3: one item, one post. A day already recorded is never sent again,
     except for the missing half of a half failure. */
  const prev = await readDay(date);
  if (prev && prev.err && !opts.force) {
    out.skipped = "the store could not be read, so nothing was sent"; return out;
  }
  const done = prev && !prev.err ? prev : null;
  if (done && done.state === "sent" && (!D.fb || done.fbId) && (!D.ig || done.igId)) {
    out.skipped = "already posted for this day"; out.post = done; return out;
  }

  const post = await compose(host, date, { polish: D.polish });
  if (!post) { out.skipped = "the library is not reachable"; return out; }
  out.post = post;

  if (opts.dry) { out.skipped = "dry run, nothing was sent"; return out; }

  const rec = done || { at: new Date().toISOString(), date, id: post.light.id, title: post.light.title };
  rec.caption = post.caption;
  rec.image = post.image;
  rec.polished = post.polished;

  /* rule 1 again: approve mode drafts and stops. Nothing reaches a network
     until a human presses the button. */
  if (D.mode === "approve" && !opts.force) {
    rec.state = "queued";
    if (kvReady()) { try { await kv([["LPUSH", K_Q, date], ["LTRIM", K_Q, "0", "60"]]); } catch { } }
    await writeDay(date, rec, false);
    out.skipped = "queued for your approval";
    return out;
  }

  /* the pre-flight. Meta fetches this URL; if we cannot, neither can it. */
  const img = await imageReachable(post.image);
  if (!img.ok) {
    rec.state = "blocked"; rec.error = img.why;
    await writeDay(date, rec, false);
    out.skipped = img.why;
    return out;
  }

  /* written BEFORE the network calls, so a double cron or a retry after a
     timeout cannot publish the same day twice */
  rec.state = "sending";
  await writeDay(date, rec, false);

  out.ran = await publishAll(rec, post, D);
  const errs = out.ran.filter(r => !r.ok && !r.skipped);
  rec.state = errs.length ? "partial" : "sent";
  rec.at = new Date().toISOString();
  rec.ran = out.ran.map(r => ({ where: r.where, ok: !!r.ok, id: r.id || "", error: r.error || r.skipped || "" }));
  rec.error = errs.map(e => e.where + ": " + e.error).join(" · ");
  await writeDay(date, rec, true);
  out.state = rec.state;
  return out;
}

/* ===========================================================================
   THE DISPATCHER
   One post a day became four or five, so the question changed from "has today
   been posted?" to "which of today's slots are due, and which have already
   gone?". The record is per slot, and per channel inside that, because a
   Facebook success and a LinkedIn failure in the same slot must not be one
   verdict -- the half that failed has to be retryable without re-sending the
   half that worked.

   The cap in dueNow() is the thing standing between a recovered outage and an
   account that looks automated. A cron down for nine hours owes five posts.
   Sending five at once is how the network decides what you are.
=========================================================================== */
const K_SLOT = (d, s) => "nsoc:slot:" + d + "#" + s;
const K_RED = "nsoc:reddit:last";
const K_SAID = "nsoc:said";        /* the last things actually published */
const K_POSTED = "nsoc:reels:posted";   /* reel id -> the date every network had it */

/* ---------------------------------------------------------------------------
   a reel leaves the shelf once every network has it

   The owner's rule of 9 September 2026: a reel that is up on the networks is
   not needed any more. So the poster keeps a ledger, reel id to the date the
   whole slot went out, and the weekly render run reads it (the public
   `posted` action below) and drops those cards from the plan; a card that
   leaves the plan leaves the shelf, video, sidecar and store asset together,
   by the rule render_missing.py already keeps. Nothing here deletes anything.

   "Every network has it" is the slot's own state: `sent` means each live
   network that was asked answered yes, none is still processing and none
   refused (a half sent slot is `partial` and stays until the healer mends it).
   A network that is not open yet (Pinterest on Trial until its review,
   YouTube until its consent) is not waited for: it could not take the reel
   and may not be able to for months; when it opens, it starts with the
   reels of that day. A slot is not final the minute it is written -- a
   video story can still be in a network's hands, the healer may still be at
   work -- so the ledger follows the record (a pending story takes the reel
   off it again until the finisher has published the story) and is read
   with a margin besides: a reel counts as posted POSTED_GRACE_DAYS after
   its date. This day, the Names and the du'as are on the ledger like the
   rest; which kinds actually retire is the plan builder's decision (they
   recur by design, and it keeps them).
--------------------------------------------------------------------------- */
const POSTED_GRACE_DAYS = Number(process.env.POSTED_GRACE_DAYS) > 0 ? Number(process.env.POSTED_GRACE_DAYS) : 3;

export function reelDone(rec) {
  if (!rec || !rec.reel || rec.state !== "sent") return false;
  const rs = Object.values(rec.results || {});
  /* a video story still in a network's hands needs the file a little longer */
  if (rs.some(r => r && r.story && r.story.pending)) return false;
  return true;
}

/* a reel's record names the card, so the ledger can say which reel went;
   a record written again (a retry, a finished container) keeps the name */
function nameReel(rec, post, prev) {
  if (post && post.reel && post.key) { rec.reel = String(post.key); rec.kind = post.kind || "light"; }
  else if (prev && prev.reel) { rec.reel = prev.reel; rec.kind = prev.kind; }
  return rec;
}

async function notePosted(date, rec) {
  if (!kvReady() || !rec || !rec.reel) return;
  /* the record is written more than once as a slot goes out (the feed post,
     then the stories, then whatever the finisher and the healer mend), and
     the ledger says what the latest record says */
  const cmd = reelDone(rec) ? ["HSET", K_POSTED, String(rec.reel), String(date)]
                            : ["HDEL", K_POSTED, String(rec.reel)];
  try { await kv([cmd]); } catch { }
}

/* the ledger, less the last few days: what the render run may retire */
export async function postedReels(today, grace) {
  if (!kvReady()) return {};
  const g = grace == null ? POSTED_GRACE_DAYS : grace;
  const cut = Date.parse(String(today || new Date().toISOString().slice(0, 10)) + "T00:00:00Z") - g * 86400000;
  let raw = [];
  try { raw = (await kv([["HGETALL", K_POSTED]]))[0] || []; } catch { return {}; }
  /* a REST store answers a hash as a flat list, a socket store the same; an
     object is accepted too, for the day one of them changes its mind */
  const pairs = Array.isArray(raw) ? raw : Object.entries(raw).flat();
  const out = {};
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const id = String(pairs[i]), d = String(pairs[i + 1]);
    const t = Date.parse(d + "T00:00:00Z");
    if (isFinite(t) && t <= cut) out[id] = d;
  }
  return out;
}

/* ---------------------------------------------------------------------------
   what has already been said

   The slot record answers "has this slot gone today". It cannot answer "have we
   published this exact post before", and on the morning the picker was stuck
   that was the question that mattered: the same card went out three days
   running and every one of them was a fresh, legitimate, unsent slot.

   So the poster keeps a short list of what it has actually published and
   refuses to say the same thing twice inside a fortnight. It is deliberately
   the last check rather than the first -- the picker upstream should make this
   unreachable -- and if the store cannot answer, the send still goes ahead,
   because a poster that stays silent whenever the store hiccups is its own
   kind of failure.
--------------------------------------------------------------------------- */
const SAID_KEEP = 40;
function saidKey(post) {
  const k = String((post && (post.key || post.title)) || "").toLowerCase().trim();
  return k.replace(/\s+/g, " ").slice(0, 120);
}
async function recentlySaid() {
  if (!kvReady()) return [];
  try { const r = await kv([["LRANGE", K_SAID, "0", String(SAID_KEEP)]]); return (r && r[0]) || []; }
  catch { return []; }
}
async function noteSaid(key) {
  if (!kvReady() || !key) return;
  try { await kv([["LPUSH", K_SAID, key], ["LTRIM", K_SAID, "0", String(SAID_KEEP - 1)],
                  ["EXPIRE", K_SAID, "7776000"]]); } catch { }
}

export async function readSlot(date, slot) {
  if (!kvReady()) return null;
  try { const r = (await kv([["GET", K_SLOT(date, slot)]]))[0];
    return r ? (typeof r === "string" ? JSON.parse(r) : r) : null; } catch { return null; }
}
async function writeSlot(date, slot, rec) {
  if (!kvReady()) return;
  try { await kv([["SET", K_SLOT(date, slot), JSON.stringify(rec)],
                  ["LPUSH", K_LOG, JSON.stringify({ at: rec.at, date, slot, state: rec.state })],
                  ["LTRIM", K_LOG, "0", "200"]]); } catch { }
  /* every path that finishes a reel (the send, the healer, a retry, a
     container finished later) writes its record here, so here is the one
     place the ledger is kept */
  await notePosted(date, rec);
}

/* ---------------------------------------------------------------------------
   what went out by hand

   The Today room hands a reel to the phone's share sheet, and the phone
   tells nobody where it went. So the console asks the owner's browser to
   say "shared", once, after the sheet closes, and the slot's record gains
   results.phone = { ok, at }. It is a note, not a network: slotState
   ignores it, the healer never reads it, the ledger of posted reels does
   not count it. Idempotent: a second press keeps the first time. A slot the
   machine has not reached yet gets a record with no state, so it stays due.
--------------------------------------------------------------------------- */
export async function markShared(date, slotId, where) {
  const at = new Date().toISOString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return { ok: false, code: 400, error: "date must be YYYY-MM-DD" };
  if (!SLOT_IDS.includes(slotId)) return { ok: false, code: 400, date, slot: slotId, error: "no such slot" };
  if (!kvReady()) return { ok: false, code: 409, error: "no store is configured, so nothing can be remembered" };
  /* THE ONLY KEY IS "phone". The first cut took any lower-case word, which
     meant a body saying where=instagram would have written { ok: true }
     over Instagram's real answer and the slot would have read sent about a
     post no network had. A hand is not a network; it gets one key and the
     record's networks are never written by this route. */
  const w = String(where == null || where === "" ? "phone" : where);
  if (w !== "phone") return { ok: false, code: 400, error: "a share by hand is noted as \"phone\" and nothing else; " + JSON.stringify(w).slice(0, 40) + " is not accepted" };
  const rec = (await readSlot(date, slotId)) || { at, slot: slotId, title: "", results: {} };
  rec.results = rec.results || {};
  const had = rec.results[w];
  if (had && had.ok) return { ok: true, date, slot: slotId, where: w, at: had.at, already: true };
  rec.results = { ...rec.results, [w]: { ok: true, at, hand: true } };
  await writeSlot(date, slotId, rec);
  return { ok: true, date, slot: slotId, where: w, at };
}

/* which channels are live right now, minus the ones that must never auto-send */
export function liveChannels(post) {
  return CH.ALL.filter(c => !CH.draftOnly.has(c) && CH.configured[c] && CH.configured[c]())
    /* a channel that takes only video is not a channel for a card */
    .filter(c => !(CH.SPEC[c] && CH.SPEC[c].video === "required") || (post && post.video));
}

/* a video pin is a fetch, an upload and a wait: not started without the room
   to finish, and handed to the hourly heal instead */
const PIN_VIDEO_RESERVE_MS = Number(process.env.PIN_VIDEO_RESERVE_MS || 36000);
/* THE CLOCK, PER CHANNEL.

   Three hourly runs in a row died at Vercel's sixty seconds with nothing on
   the record: the 11:00 reel, then the noon card twice. The loop below asked
   every live network in turn and consulted the clock only for a video pin;
   a slow Instagram fetch or a long YouTube upload spent the whole minute,
   the function was cut before writeSlot ran, and the slot stayed owed -- so
   whatever HAD landed was sent again the next hour. The opposite of the
   promise never to double-post.

   So each network is given what is left of the run, less a reserve for
   writing the record, and no more. A network that does not answer in its
   room is recorded as late, the record is written with the others' answers
   intact, and healFailures asks that one network again next hour, alone.
   The clock does not cancel the request underneath (fetch has no such
   handle here); it makes sure the record is written first, which is the
   thing that keeps a slot from going out twice. */
const WRITE_RESERVE_MS = Number(process.env.WRITE_RESERVE_MS || 6000);
const CHANNEL_MIN_MS = Number(process.env.CHANNEL_MIN_MS || 8000);
const OUT_OF_TIME = "no time left in this run for this network; retried next hour";
/* `send` is the sender put on the clock: the feed sender by default, the
   story-only sender for a card (it takes the channel and the post). */
async function sendWithin(ch, shaped, post, left, send) {
  const began = Date.now();
  const go = send ? () => send(ch, post) : () => sendOne(ch, shaped, post, left);
  const stamp = r => { if (r && typeof r === "object") r.ms = Date.now() - began; return r; };
  if (typeof left !== "function") return stamp(await go());
  const room = left() - WRITE_RESERVE_MS;
  if (room < CHANNEL_MIN_MS) return stamp({ ok: false, err: OUT_OF_TIME, error: OUT_OF_TIME, late: true });
  let timer;
  const clock = new Promise(r => { timer = setTimeout(() => r({ ok: false, err: OUT_OF_TIME, error: OUT_OF_TIME, late: true, cut: true }), room); });
  try { return stamp(await Promise.race([go(), clock])); }
  finally { clearTimeout(timer); }
}

/* THE ORDER A REEL IS OFFERED IN.

   YouTube Shorts is the network that shows a reel to the most strangers,
   and its upload is the slowest thing in the run: the bytes are fetched and
   forwarded, not handed over by URL. Asked last, it was the one cut by the
   clock. So a reel goes to YouTube first, then Instagram, Facebook, Threads,
   Telegram, Pinterest. This only orders; the SET of channels is still the
   reel's `only` list met with what is live. A card keeps the old order. */
const SEND_ORDER = ["youtube", "instagram", "facebook", "threads", "telegram", "pinterest"];
export function orderChannels(chans, post) {
  if (!post || !post.video) return chans;
  const rank = c => { const i = SEND_ORDER.indexOf(c); return i < 0 ? SEND_ORDER.length + Math.max(0, CH.ALL.indexOf(c)) : i; };
  return chans.slice().sort((a, b) => rank(a) - rank(b));
}

/* ---------------------------------------------------------------------------
   the file, at the moment it is handed over

   The shelf lives on GitHub Releases now. A release download URL is stable
   for years and answers with a 302 to a signed copy that lives for minutes,
   and Meta's fetchers do not reliably follow a redirect. So the URL a
   network is given is the signed one, resolved here, for this network, this
   second; the manifest keeps the stable one. Anything else (the site's own
   /reels/ path, a Blob URL) is handed over as it is. Pinterest and YouTube
   fetch the bytes themselves through fetch(), which follows redirects.
--------------------------------------------------------------------------- */
const RELEASE_URL = /^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\//;
export async function freshVideoUrl(url, fetcher) {
  if (!RELEASE_URL.test(String(url || ""))) return url;
  const f = fetcher || fetch;
  try {
    const r = await f(url, { method: "HEAD", redirect: "manual" });
    const loc = r && r.headers && typeof r.headers.get === "function" ? r.headers.get("location") : null;
    if (loc && /^https:\/\//.test(loc)) return loc;
  } catch { }
  return url;
}

async function sendOne(ch, shaped, post, left) {
  const p = { ...post, caption: shaped.text };
  if (p.video) p.video = await freshVideoUrl(p.video);
  if (ch === "pinterest" && shaped.video && typeof left === "function" && left() < PIN_VIDEO_RESERVE_MS)
    return { ok: false, err: "no time left in this run for the video pin; retried next hour", error: "no time left in this run for the video pin; retried next hour" };
  if (ch === "facebook")  return await (p.video ? postFacebookReel(p) : postFacebook(p));
  if (ch === "instagram") return await (p.video ? postInstagramReel(p, left) : postInstagram(p));
  const fn = CH.SENDERS[ch];
  if (!fn) return { ok: false, err: "no sender for " + ch };
  if (ch === "youtube") return await fn({ ...shaped, video: p.video }, { date: p.date });
  /* a reel goes to the channel as a video, by url: Telegram fetches it */
  if (ch === "telegram") return await fn({ ...shaped, video: p.video || null });
  /* and Threads takes it the same way, as a VIDEO container it processes */
  if (ch === "threads") return await fn({ ...shaped, video: p.video || null });
  return await fn(shaped);
}

/* ONE SLOT, ON DEMAND.
   The schedule is a promise about when things go out, not a rule about when
   they MAY. A slot whose hour has passed and whose cron never fired sits there
   owed, and the owner looking at it should be able to read it and send it —
   not wait a day for a machine that already missed. So composing a slot and
   sending a slot are separable, and neither consults the clock. runDue() is
   just the caller that does consult it. */
export async function composeSlot(host, date, slotId, opts = {}) {
  const plan = opts.plan || await planDay(date, opts);
  const base = "https://" + publicHost(host);
  if (slotId === "light") {
    const D = opts.dials || await dials();
    const c = await compose(host, date, { polish: D.polish });
    if (!c) return null;
    return { lvl: (c.light && c.light.lvl) || "editorial", title: c.light.title,
      oneLine: c.light.title, body: c.caption, todo: [], basis: "", note: "",
      tags: [], link: c.link, image: c.image, imageSvg: c.imageSvg, card: c.light, slot: "light" };
  }
  let index = opts.index || null;
  if (!index) { try { const r = await fetch(base + "/assets/menu-index.json");
    if (r.ok) index = await r.json(); } catch { } }
  /* the day's chapter and word, in full, so the caption carries the material
     the library actually wrote rather than the index's one line */
  const extras = opts.extras || await slotExtras(base, date, index, slotId, plan.hijri);
  return buildSlot(slotId, {
    date, hijri: plan.hijri, day: plan.day, leads: plan.leads,
    words: index && index.words, path: index && index.path,
    node: extras.node, entry: extras.entry, reel: extras.reel,
    link: base + "/?light=" + date,
    /* its OWN card, not the day's light. Handing one url to every slot is what
       made four different posts a day look like one post four times. */
    image: base + "/api/card?date=" + date + "&slot=" + encodeURIComponent(slotId) + "&fmt=png"
  });
}

export async function sendSlot(host, date, slotId, opts = {}) {
  /* a caller with the dials in hand (the tests, a run that read them
     already) hands them down; the store is asked otherwise */
  const D = opts.dials || await dials();
  const out = { date, slot: slotId, at: new Date().toISOString() };
  if (!SLOT_IDS.includes(slotId)) return { ...out, ok: false, error: "no such slot" };

  const prev = await readSlot(date, slotId);
  if (prev && prev.state === "sent" && !opts.force)
    return { ...out, ok: false, error: "that slot has already gone today" };
  /* Half sent is still sent, as far as sending the whole slot goes: one
     network has it, and Post now would give it to that network again. The
     missing half is a job for retryChannel, which touches only the network
     that refused. The console hides the button; this is for anyone who calls
     the API without it. */
  if (prev && prev.state === "partial" && !opts.force)
    return { ...out, ok: false, error: "that slot is half sent; retry the network that refused, not the whole slot" };
  /* pressing Post on a slot a network is still processing would send it twice
     everywhere else; finishing it is what the owner actually wants */
  if (prev && prev.state === "pending" && !opts.force) {
    const ran = await finishPendingReels(date, { ran: [] });
    return { ...out, ok: true, state: (await readSlot(date, slotId) || {}).state || "pending",
      finished: ran, note: "that slot was already sent; a network was still processing the video" };
  }

  const began = Date.now();
  /* a caller already on a clock (the healer, inside the hourly run) hands
     its own down, so a slot sent late in a run cannot start a fresh minute */
  const left = typeof opts.left === "function" ? opts.left : () => RUN_BUDGET_MS - (Date.now() - began);
  const post = await composeSlot(host, date, slotId, opts);
  if (!post) return { ...out, ok: false, error: "nothing to say for that slot" };

  /* a preview is always allowed to render, including of something already said */
  if (opts.dry) return { ...out, ok: true, dry: true, post };

  const key = saidKey(post);
  if (!opts.force && key && (await recentlySaid()).includes(key))
    return { ...out, ok: false, repeat: true, title: post.title,
             error: "this has already been published recently, so it was not sent again" };

  let results = {};
  /* the same narrowing the cron does: a reel names the only channels that can
     show one, and there is no Reddit draft to write from a video; a card
     with the feed switched off names the story surfaces and nothing else */
  const storyOnly = cardIsStoryOnly(post, D);
  const chans = storyOnly ? storyChannels(post)
    : orderChannels(post.only ? liveChannels(post).filter(c => post.only.includes(c)) : liveChannels(post), post);

  /* THE PRE-FLIGHT, ON THE PATH THAT ACTUALLY POSTS.

     imageReachable() was written for exactly one failure and then wired only
     into the old whole-day publish, which is not what sends a slot. So on the
     day it happened the check existed and was not running.

     It matters more than it looks, because the two networks are not symmetric:
     Instagram REQUIRES an image and Facebook does not. A card Meta cannot
     fetch therefore takes out Instagram alone and leaves Facebook looking
     perfectly healthy -- which is precisely the shape of "it posted on
     Facebook but not Instagram", and reads like an Instagram fault when it is
     nothing of the kind.

     Fetching it here is also the cheapest possible warm-up. The card is
     rendered on demand by a function that may be cold; Meta comes for the URL
     seconds later and does not wait long. Asking for it first means the render
     has already happened by the time it does. */
  let imgWhy = "";
  /* a story is a picture on both networks, so a story-only card is checked
     whatever the feed specs say */
  if (post.image && (storyOnly || chans.some(c => CH.SPEC[c] && CH.SPEC[c].image === "required"))) {
    const img = await imageReachable(post.image);
    if (!img.ok) imgWhy = img.why;
  }

  if (storyOnly) results = await storyOnlyResults(post, date, chans, left, imgWhy);
  else for (const ch of chans) {
    const shaped = CH.shape(post, ch);
    if (CH.SPEC[ch].image === "required" && !shaped.image) {
      results[ch] = { ok: false, fatal: true, error: "needs an image", err: "needs an image" }; continue; }
    if (CH.SPEC[ch].image === "required" && imgWhy) {
      results[ch] = { ok: false, error: imgWhy, err: imgWhy, pre: true }; continue; }
    try { results[ch] = await sendWithin(ch, shaped, { ...post, date }, left); }
    catch (e) {
      const m = String(e && e.message || e).slice(0, 120);
      results[ch] = { ok: false, error: m, err: m };
    }
  }

  if (!post.only) {
    let lastRedditAt = null;
    if (kvReady()) { try { lastRedditAt = (await kv([["GET", K_RED]]))[0] || null; } catch { } }
    results.reddit = await CH.sendReddit(CH.shape(post, "reddit"), { lastRedditAt });
    if (results.reddit.links && results.reddit.links.length && kvReady()) {
      try { await kv([["SET", K_RED, out.at]]); } catch { }
    }
  }

  const rec = { at: out.at, slot: slotId, state: slotState(results),
    title: post.title, lvl: post.lvl, results };
  nameReel(rec, post);
  /* the record is written BEFORE the stories: if the function is cut off
     while a story is being made, the feed post is already on the record and
     cannot be sent a second time next hour */
  await writeSlot(date, slotId, rec);
  if (rec.state !== "failed") await noteSaid(key);
  /* the same thing, as a story, wherever the feed post landed (a story-only
     card already IS its stories, and addStories passes it by) */
  if (await addStories(results, { ...post, date }, D, left))
    await writeSlot(date, slotId, rec);
  return { ...out, ok: rec.state !== "failed", state: rec.state, title: post.title, storyOnly: storyOnly || undefined, results };
}

/* ---------------------------------------------------------------------------
   ONE CHANNEL, AGAIN

   Post now is the wrong tool when one network took the post and another
   refused it. The slot is already recorded "sent" -- slotState says sent if
   ANY live channel got it -- so sending again needs force, and force would
   publish it a second time everywhere it already worked.

   So a retry names its channel. It touches that channel's result and nothing
   else, and it refuses outright to re-send a channel that already succeeded.
   That refusal is the whole safety of the button: it can be pressed twice, or
   by two people, and the second press cannot double-post.
--------------------------------------------------------------------------- */
export async function retryChannel(host, date, slotId, ch, opts = {}) {
  const out = { date, slot: slotId, where: ch, at: new Date().toISOString() };
  if (!SLOT_IDS.includes(slotId)) return { ...out, ok: false, error: "no such slot" };
  if (!CH.ALL.includes(ch)) return { ...out, ok: false, error: "no such channel" };
  if (CH.draftOnly.has(ch))
    return { ...out, ok: false, error: ch + " is written as a draft for you, never sent by the machine" };
  if (!(CH.configured[ch] && CH.configured[ch]()))
    return { ...out, ok: false, error: ch + " is not configured, so there is nothing to retry with" };

  const rec = await readSlot(date, slotId);
  const had = rec && rec.results && rec.results[ch];
  if (had && had.ok && !opts.force)
    return { ...out, ok: false, already: true, state: rec.state,
             error: "that already went to " + ch + ", so it was not sent again" };
  /* a container Instagram is still transcoding is finished, never re-sent */
  if (had && had.pending && !opts.force) {
    const ran = await finishPendingReels(date, { ran: [] });
    const now = await readSlot(date, slotId);
    return { ...out, ok: true, finished: ran, state: (now && now.state) || "pending",
             results: (now && now.results) || {},
             note: (ch === "threads" ? "Threads" : "Instagram") + " already had this one; it was asked again rather than sent again" };
  }

  const post = await composeSlot(host, date, slotId, opts);
  if (!post) return { ...out, ok: false, error: "nothing to say for that slot" };
  if (post.only && !post.only.includes(ch))
    return { ...out, ok: false, error: "this post is not offered to " + ch };
  /* The post is composed again, and composing is not always a pure function
     of the date: the day's light consults a memory of what has been shown
     lately, so a card rebuilt the morning after can come out as a DIFFERENT
     card. Sending that would put one thing on Facebook and another on
     Instagram under the same slot. So the rebuilt post has to be the post the
     record says went out, or it does not go. */
  if (rec && rec.title && post.title && rec.title !== post.title) {
    const why = "the slot rebuilt as a different card (\"" + String(post.title).slice(0, 60)
              + "\") from the one that went out (\"" + String(rec.title).slice(0, 60)
              + "\"), so it was not sent";
    /* written down, so the healer stops asking and the console can say why.
       A person pressing the button still gets a fresh comparison, so once
       the day is pinned to the right card the retry works again. */
    const stamped = { ...(had || {}), ok: false, fatal: true, drift: true, error: why, lastTry: out.at };
    await writeSlot(date, slotId, { ...rec, results: { ...(rec.results || {}), [ch]: stamped } });
    return { ...out, ok: false, fatal: true, drift: true, error: why };
  }

  /* A retry sends the thing the way the SLOT went, read off its record: a
     record whose networks took (or refused) stories is sent a story again,
     whatever the dial says today; a record from before the cards left the
     feed, with no such mark on any network, is sent a feed post, so the
     missing half of a feed-era slot matches the half that landed; a card
     with no network on its record yet is offered what the dial says now. */
  const D = opts.dials || await dials();
  const way = recordWay(rec);
  const asStory = way ? way === "story" : cardIsStoryOnly(post, D);
  if (asStory && !STORY[ch])
    return { ...out, ok: false, fatal: true, storyOnly: true,
             error: "cards go to stories only, and " + ch + " has no story surface" };

  const shaped = CH.shape(post, ch);
  const needsImage = asStory || CH.SPEC[ch].image === "required";
  if (needsImage && !(asStory ? post.image : shaped.image))
    return { ...out, ok: false, fatal: true, error: "needs an image and has none" };
  if (needsImage) {
    const img = await imageReachable(asStory ? post.image : shaped.image, opts.preflightMs);
    if (!img.ok) return { ...out, ok: false, pre: true, error: img.why };
  }

  let r;
  try { r = asStory ? await sendStoryOnly(ch, { ...post, date }) : await sendOne(ch, shaped, { ...post, date }); }
  catch (e) { const m = String(e && e.message || e).slice(0, 160); r = { ok: false, error: m, err: m }; }

  /* every attempt is stamped on the result, so the healer can be bounded and
     can wait between tries instead of hammering a network that is down */
  /* the send that failed in the first place was attempt one, whether or not
     it was stamped -- records written before this existed carry no count */
  /* A person pressing Retry is not the healer using up its budget. The count
     bounds the automatic net (HEAL_MAX_TRIES, four); counting a human's press
     against it meant three presses on a stubborn row silently switched the
     hourly net off for that row, for the rest of the day, without saying so.
     A hand and a machine are stamped separately now. */
  const byHand = !!(opts && opts.byHand);
  r = byHand
    ? { ...r, hands: Number((had && had.hands) || 0) + 1, lastTry: out.at,
        tries: Number((had && had.tries) || 1) }
    : { ...r, tries: Number((had && had.tries) || 1) + 1, lastTry: out.at };
  const results = { ...((rec && rec.results) || {}), [ch]: r };
  const next = { at: (rec && rec.at) || out.at, slot: slotId, state: slotState(results),
                 title: post.title, lvl: (rec && rec.lvl) || post.lvl, results };
  /* the reel's name stays on the record through a retry, so the slot the
     healer mends lands on the ledger like one that went out clean */
  nameReel(next, post, rec);
  await writeSlot(date, slotId, next);
  return { ...out, ok: !!r.ok, state: next.state, result: r, results };
}

/* ---------------------------------------------------------------------------
   WHAT IS ACTUALLY WRONG

   Two kinds of evidence, and they are not worth the same. The first is what
   can be checked right now: is the card there, is it a PNG, is the caption
   inside the limit, how many days are left on the token. Those are facts.
   The second is what Meta said, which is a sentence plus a number -- the
   number is worth matching on, the sentence is worth quoting and not parsing,
   because it is Meta's to change.

   So this runs the checks, quotes Meta verbatim, and names a cause only where
   one of the two establishes it. Where nothing does, it says so and offers the
   retry, which is the honest answer for a network that simply had a bad
   minute. It never guesses at a cause to look confident.
--------------------------------------------------------------------------- */
const FAULTS = [
  { when: c => c === 190,
    cause: "the access token is expired or has been revoked",
    fix: "token",
    steps: ["Open Meta Business Suite and generate a fresh token.",
            "Put it into the Vercel project settings as IG_TOKEN (or FB_PAGE_TOKEN).",
            "Redeploy, then press Renewed on the token card here so the clock resets.",
            "Come back and press Retry on this row."] },
  { when: c => c === 10 || c === 200 || c === 803,
    cause: "the token is valid but is not permitted to publish for this account",
    fix: "manual",
    steps: ["Check the Instagram account is a Business or Creator account, not personal.",
            "Check it is still linked to the Facebook Page in Business Suite.",
            "Confirm the app has instagram_content_publish and pages_manage_posts.",
            "Then press Retry on this row."] },
  { when: c => c === 4 || c === 17 || c === 32 || c === 613,
    cause: "Meta is rate limiting the account for now",
    fix: "wait",
    steps: ["Nothing is broken; the account has hit a posting or API limit.",
            "Instagram allows 50 published posts in a rolling 24 hours.",
            "Wait an hour, then press Retry on this row."] },
  { when: (c, sub) => c === 9004 || (sub >= 2207000 && sub <= 2207099) || c === 2207003 || c === 2207020,
    cause: "Instagram could not fetch or process the card image",
    fix: "retry",
    steps: ["The card is rendered on demand, so a cold start can outrun Meta's patience.",
            "The check below says whether it is reachable now.",
            "If it is, press Retry -- asking for it once has already warmed it."] },
  { when: c => c === 36003 || c === 36001,
    cause: "Instagram rejected the image itself, for its shape or its format",
    fix: "manual",
    steps: ["Instagram takes aspect ratios between 4:5 and 1.91:1, PNG or JPEG.",
            "Open the card in Preview and check what it is rendering.",
            "This one needs the card template changed, not a retry."] }
];

export async function diagnoseSlot(host, date, slotId, ch, opts = {}) {
  const out = { date, slot: slotId, where: ch, checks: [], steps: [], cause: "", fix: "retry" };
  if (!SLOT_IDS.includes(slotId)) return { ...out, ok: false, error: "no such slot" };
  if (!CH.ALL.includes(ch)) return { ...out, ok: false, error: "no such channel" };

  const rec = await readSlot(date, slotId);
  const r = (rec && rec.results && rec.results[ch]) || null;
  out.state = rec ? rec.state : null;
  out.said = r ? String(r.error || r.err || "") : "";
  if (r && r.code != null) out.code = r.code;
  if (r && r.sub != null) out.sub = r.sub;
  if (r && r.step) out.step = r.step;
  if (r && r.storyOnly) out.storyOnly = true;     /* a card sent as a story: the retry is a story too */

  if (r && r.ok) return { ...out, ok: true, cause: "nothing: this one went out", fix: "none", canRetry: false };
  if (r && r.pending)
    return { ...out, ok: true, fix: "finish", canRetry: true,
      cause: (ch === "threads" ? "Threads" : "Instagram") + " has the video and is still processing it",
      steps: ["Nothing failed. The container was accepted and is transcoding.",
              "Press Finish it, or leave it: the next hourly run publishes it by itself."] };

  /* the facts, gathered now rather than inferred from a sentence */
  const post = await composeSlot(host, date, slotId, opts).catch(() => null);
  if (!post) {
    out.checks.push({ name: "the post", ok: false, detail: "this slot builds to nothing today" });
    return { ...out, ok: true, canRetry: false, cause: "there is nothing for this slot to say",
             fix: "manual", steps: ["Nothing is broken. This slot has no card for today."] };
  }
  const shaped = CH.shape(post, ch);
  const spec = CH.SPEC[ch] || { chars: 2200, tags: 30, image: "optional" };

  if (spec.image === "required" || post.image) {
    const img = await imageReachable(shaped.image || post.image);
    out.checks.push({ name: "the card image", ok: !!img.ok,
      detail: img.ok ? ((img.type || "image") + (img.bytes ? ", " + Math.round(img.bytes / 1024) + " KB" : "") + ", reachable now")
                     : img.why });
  }
  const text = String(shaped.text || "");
  out.checks.push({ name: "the caption", ok: text.length <= spec.chars,
    detail: text.length + " of " + spec.chars + " characters" });
  /* the same shape the shaper counts with, so the two never disagree */
  const tags = (text.match(/#[\p{L}\p{N}_]+/gu) || []).length;
  out.checks.push({ name: "the hashtags", ok: tags <= spec.tags,
    detail: tags + " of " + spec.tags + " allowed" });
  try {
    const tk = await tokenClock();
    const t = ch === "facebook" ? tk.fb : ch === "instagram" ? tk.ig : null;
    if (t) out.checks.push({ name: "the token", ok: t.daysLeft == null || t.daysLeft > 3,
      detail: t.daysLeft == null ? "never marked renewed, so its age is unknown"
                                 : t.daysLeft + " days left of " + tk.lifeDays });
  } catch { }

  /* YouTube speaks in words, not codes: the three that need a person */
  if (ch === "youtube") {
    const said = String(out.said || "") + " " + String(out.code || "");
    if (r && r.quota || /quota/i.test(said)) {
      out.cause = "YouTube's daily quota for uploads is spent"; out.fix = "wait";
      out.steps = ["Nothing is broken: the API allows about six uploads a day and the day's are used.",
                   "It resets at midnight Pacific time; the hourly run will retry after that."];
    } else if (/invalid_grant|token/i.test(said)) {
      out.cause = "the YouTube consent has expired or been revoked"; out.fix = "token";
      out.steps = ["Open /api/youtube?action=auth and give consent again.",
                   "Paste the new YT_REFRESH_TOKEN into Vercel and redeploy.",
                   "If this keeps happening every week, the OAuth app is still in Testing: publish it in the Google Cloud console."];
    } else if (/not connected/i.test(said)) {
      out.cause = "YouTube is not connected yet"; out.fix = "manual";
      out.steps = ["Follow the YouTube steps page once: a Google Cloud project, the consent, three variables in Vercel."];
    } else if (r && r.private) {
      out.cause = "uploaded, but YouTube kept it private: the project has not passed the API audit"; out.fix = "manual";
      out.steps = ["Fill in the YouTube API Services audit form once; a non-commercial library is normally approved.",
                   "Until then every upload lands private; set each one public by hand in YouTube Studio if you wish."];
    }
    if (out.cause) { out.canRetry = out.fix === "retry" || out.fix === "wait"; return { ...out, ok: true }; }
  }

  /* Pinterest speaks in words too */
  if (ch === "pinterest") {
    const said = String(out.said || "");
    if (r && r.trial || /trial access/i.test(said)) {
      out.cause = "Pinterest keeps the app on Trial access: pins are refused on the real API until Standard access is granted"; out.fix = "manual";
      out.steps = ["Nothing is broken and nothing is retried.",
                   "For the recording Pinterest asks for, set PIN_API_BASE to https://api-sandbox.pinterest.com in Vercel, redeploy, open /api/social?action=pin-auth again and paste the PIN_SANDBOX_REFRESH_TOKEN it shows.",
                   "When Standard access is granted, remove PIN_API_BASE: the house then pins for real with the token it already has."];
      out.canRetry = false; return { ...out, ok: true };
    }
    if (/refresh|401|unauthor|expired/i.test(said)) {
      out.cause = "the Pinterest token no longer works"; out.fix = "token";
      out.steps = ["Open /api/social?action=pin-auth and give access again.", "Paste the refresh token it shows into Vercel and redeploy."];
      out.canRetry = false; return { ...out, ok: true };
    }
  }

  /* Telegram: a pause it names in seconds, or a bot that is not yet an
     administrator of the channel. Both are said in words, not Meta codes. */
  if (ch === "telegram") {
    const said = String(out.said || "");
    if ((r && r.wait) || /too many requests|retry after|asked for a pause/i.test(said)) {
      out.cause = "Telegram is rate limiting the bot for now"; out.fix = "wait";
      out.steps = ["Nothing is broken; Telegram asked for a pause" + (r && r.wait ? " of " + r.wait + " seconds" : "") + ".",
                   "The hourly run retries by itself; or wait a minute and press Retry on this row."];
      out.canRetry = true; return { ...out, ok: true };
    }
    if ((r && r.admin) || /chat not found|not a member|administrator|not enough rights|kicked|write forbidden/i.test(said)) {
      out.cause = "the bot cannot post to the channel: it is not an administrator of it, or TG_CHAT_ID names the wrong channel"; out.fix = "manual";
      out.steps = ["In Telegram, open the channel, then Administrators, then Add administrator, and pick the bot by its username.",
                   "Switch on Post messages for it; the other rights are not needed.",
                   "Check TG_CHAT_ID in Vercel is the channel's public username with its @ (a private channel takes its -100... id instead).",
                   "Then press Retry on this row."];
      out.canRetry = false; return { ...out, ok: true };
    }
    if (/does not recognise the bot token|unauthorized/i.test(said)) {
      out.cause = "the bot token is not one Telegram knows"; out.fix = "token";
      out.steps = ["Open @BotFather in Telegram, send /token, pick the bot, and copy the token it shows.",
                   "Paste it into Vercel as TG_BOT_TOKEN and redeploy, then press Retry on this row."];
      out.canRetry = false; return { ...out, ok: true };
    }
    if (/not configured|not connected/i.test(said)) {
      out.cause = "Telegram is not connected yet"; out.fix = "manual";
      out.steps = ["Follow the Telegram steps page once: a bot from @BotFather, a public channel, the bot as its administrator, two variables in Vercel."];
      out.canRetry = false; return { ...out, ok: true };
    }
  }
  /* Threads: Meta's codes, but a token of its own and a door of its own, so
     the token and permission faults point at /api/threads, not at Business
     Suite. A rate limit there is the 250-a-day ceiling and clears by itself. */
  if (ch === "threads") {
    const said = String(out.said || "");
    /* "expired" alone would also catch a container Meta let EXPIRE, which is
       a retry, not a token; so the token is named, not the word */
    if ((r && r.code === 190) || /does not accept the token|session has expired|invalid oauth/i.test(said)) {
      out.cause = "the Threads token has expired or been revoked"; out.fix = "token";
      out.steps = ["A Threads token lives sixty days. Open /api/threads?action=renew while it still works; once it has expired, open /api/threads?action=auth and give consent again.",
                   "Paste the new TH_TOKEN into Vercel and redeploy, then press Retry on this row."];
      out.canRetry = false; return { ...out, ok: true };
    }
    if ((r && r.wait) || /rate limit|limit reached|too many/i.test(said)) {
      out.cause = "Threads is rate limiting the account for now"; out.fix = "wait";
      out.steps = ["Nothing is broken; a profile may publish 250 posts in 24 hours and the API also limits calls per hour.",
                   "The hourly run retries by itself; or wait an hour and press Retry on this row."];
      out.canRetry = true; return { ...out, ok: true };
    }
    if (/threads_content_publish|tester|permission|not authorized/i.test(said)) {
      out.cause = "the token is not permitted to publish for this account"; out.fix = "manual";
      out.steps = ["While the Meta app is in development, the Threads account must accept the tester invitation: in the Threads app, Settings, Account, Website permissions, Invites.",
                   "Then open /api/threads?action=auth again so the token carries threads_content_publish, paste TH_TOKEN and TH_USER_ID into Vercel, redeploy, and press Retry on this row."];
      out.canRetry = false; return { ...out, ok: true };
    }
    if (/could not process the video|ERROR|EXPIRED/.test(said)) {
      out.cause = "Threads could not process the video, or the container expired before it was published"; out.fix = "retry";
      out.steps = ["The file is fetched from the site by url; check the reel plays at its address.",
                   "Press Retry on this row: a new container is made and published."];
      out.canRetry = true; return { ...out, ok: true };
    }
    if (/could not fetch the file/i.test(said)) {
      out.cause = "Threads could not fetch the picture or the video from its url"; out.fix = "retry";
      out.steps = ["The card is rendered on demand, so a cold start can outrun Meta's patience; the check above says whether it is reachable now.",
                   "Press Retry on this row."];
      out.canRetry = true; return { ...out, ok: true };
    }
    if (/not configured|not connected/i.test(said)) {
      out.cause = "Threads is not connected yet"; out.fix = "manual";
      out.steps = ["Follow the Threads steps page once: the Threads use case on the Meta app, the consent at /api/threads?action=auth, two variables in Vercel."];
      out.canRetry = false; return { ...out, ok: true };
    }
  }
  const NET = ch === "pinterest" ? "Pinterest" : ch === "youtube" ? "YouTube" : ch === "telegram" ? "Telegram" : ch === "threads" ? "Threads" : "Meta";

  /* the network's own code first, because it is the only thing here it stands behind */
  const hit = FAULTS.find(f => f.when(Number(out.code), Number(out.sub || 0)));
  if (hit) { out.cause = hit.cause; out.fix = hit.fix; out.steps = hit.steps.slice(); }
  else if (/no time left in this run/i.test(String(out.said || ""))) {
    /* Nothing is wrong with the post. Six networks are served from one
       55-second run and this one was at the back of the queue when the clock
       ran out. Saying "fix the hashtags" under that sentence sent the owner
       looking for a fault that was not there. */
    out.cause = "nothing is wrong with this post: the run ran out of time before it reached "
      + NET + ", because six networks are served from one 55-second function";
    out.fix = "retry";
    out.steps = ["Press Retry: on its own, with the whole budget to itself, it sends.",
                 "The hourly run also retries it by itself.",
                 "If this keeps happening to the same networks every day, the run needs splitting, not the post fixing."];
    out.canRetry = true;
  }
  else {
    const broke = out.checks.filter(c => !c.ok);
    if (broke.length) {
      out.cause = broke.map(c => c.name + " is wrong: " + c.detail).join("; ");
      out.fix = broke.some(c => c.name === "the card image") ? "retry" : "manual";
      out.steps = broke.map(c => "Fix " + c.name + " -- " + c.detail);
      if (out.fix === "retry") out.steps.push("Then press Retry on this row.");
    } else if (/hashtag|character|too long|caption/i.test(String(out.said || ""))) {
      /* It failed on the shape, and the shape it would go out with now is
         within what this network states for itself. The caption is not written
         again -- CH.shape() trims the trailing hashtag wall to the network's
         own cap and cuts the length after -- so pressing Retry sends a post
         this network can accept, rather than the identical refusal. */
      out.cause = "it was refused for its shape, and the shape has been corrected: "
        + "the post now sits inside what " + NET + " allows";
      out.fix = "retry";
      out.steps = ["The caption was written for the network with the widest limits and reused here.",
                   "It is trimmed to " + NET + "'s own cap before sending now.",
                   "Press Retry."];
      out.canRetry = true;
    } else {
      out.cause = out.said
        ? "no cause we can establish. Every check above passes now, so this reads as a bad minute at " + NET + " rather than something wrong with the post"
        : "nothing was recorded against this channel";
      out.fix = "retry";
      out.steps = ["Everything checks out on our side right now.",
                   "Press Retry. If it fails again with the same words, the message above is " + NET + "'s, verbatim, and worth searching."];
    }
  }
  out.canRetry = out.fix !== "none";
  return { ...out, ok: true };
}

/* ---------------------------------------------------------------------------
   THE SAFETY NET

   Reels got healed and nothing else did. finishPendingReels walks REEL_SLOTS
   only, and the one thing that could retry an ordinary failed channel was a
   button a human had to notice and press. So a card that Instagram refused at
   noon stayed refused: the slot read "sent" because Facebook had taken it, a
   slot that reads sent is never revisited, and the post simply never existed
   on Instagram. That is the whole of "some posts don't fire on Instagram".

   This closes it. Every hourly run walks yesterday and today, finds live
   channels that failed, and sends that one channel again -- through the same
   path the button uses, which refuses outright to touch a channel that already
   succeeded, so a heal can never double-post.

   Three rules keep it from becoming a nuisance:

     it stops after four attempts, because a fifth is not going to work;
     it waits longer between each, because a network having a bad minute needs
       a minute, not four requests inside one;
     it does not retry what a retry cannot fix. An expired token is not a bad
       minute -- retrying it four times a day for a week writes noise into the
       log and still does not post. Those are left alone and shown to a human,
       which is what the diagnosis is for.
--------------------------------------------------------------------------- */
const HEAL_MAX_TRIES = Number(process.env.HEAL_MAX_TRIES || 4);
/* minutes to wait before attempt 2, 3, 4. The cron is hourly, so the first of
   these is really "the very next run" and the rest space out from there. */
const HEAL_BACKOFF = [0, 15, 60, 180];

export function healable(r) {
  if (!r || r.ok || r.pending) return false;
  if (r.skipped) return false;          /* never asked: not configured */
  if (r.fatal) return false;            /* nothing to send, or nothing to send it with */
  const hit = FAULTS.find(f => f.when(Number(r.code), Number(r.sub || 0)));
  /* a token or a permission is a person's job, not a retry's */
  if (hit && (hit.fix === "token" || hit.fix === "manual")) return false;
  return true;
}

export function healDue(r, nowMs) {
  /* A network the clock cut was never asked, so it did not fail: counting it
     as a try spends the healer's four on a queue problem and then gives up on
     a post that nothing is wrong with. Threads, Telegram and Pinterest sit at
     the back of a six-network queue in a 55-second run and are cut most days;
     before this they exhausted their tries by lunchtime and stayed red until
     midnight. A cut is a postponement. */
  if (r && r.late) return true;
  const tries = Number(r.tries || 1);
  if (tries >= HEAL_MAX_TRIES) return false;
  const wait = (HEAL_BACKOFF[Math.min(tries, HEAL_BACKOFF.length - 1)] || 0) * 60000;
  const last = Date.parse(r.lastTry || "") || 0;
  if (!last) return true;
  return (nowMs - last) >= wait;
}

/* At most this many repairs in one run, and never one that cannot finish
   inside the time left. The net is hourly; it does not have to catch
   everything on the first pass, and trying to is what cost a post. */
const HEAL_PER_RUN = Number(process.env.HEAL_PER_RUN || 2);

/* A reel is not a card. Instagram takes it in stages and the sender may poll
   for forty seconds before handing back a container, so a reel repair needs
   nearly the whole function to itself. It is only attempted when it has it. */
const HEAL_REEL_RESERVE_MS = Number(process.env.HEAL_REEL_RESERVE_MS || 48000);

export async function healFailures(host, date, out, now, hasTime) {
  const ran = (out && out.ran) || [];
  const nowMs = now ? +new Date(now) : Date.now();
  const room = typeof hasTime === "function" ? hasTime : () => true;
  let done = 0;
  for (const d of [prevDate(date), date]) {
    for (const id of SLOT_IDS) {
      if (done >= HEAL_PER_RUN || !room()) return ran;
      let rec = null;
      try { rec = await readSlot(d, id); } catch { continue; }
      if (!rec || !rec.results) continue;
      if (rec.state === "queued") continue;     /* still waiting for a human */
      const isReel = REEL_SLOTS.includes(id);
      for (const ch of liveChannels()) {
        if (done >= HEAL_PER_RUN || !room()) return ran;
        const r = rec.results[ch];
        if (!healable(r) || !healDue(r, nowMs)) continue;
        if (isReel && (ch === "instagram" || ch === "pinterest") && !room(HEAL_REEL_RESERVE_MS)) continue;
        done++;
        /* one repair that throws must not take the others with it */
        try {
          const res = await retryChannel(host, d, id, ch, { preflightMs: 5000 });
          ran.push({ slot: id, date: d, where: ch, healed: true, ok: !!res.ok,
                     state: res.state || "", tries: Number(r.tries || 1) + 1,
                     error: res.ok ? "" : String(res.error || (res.result && res.result.error) || "") });
        } catch (e) {
          ran.push({ slot: id, date: d, where: ch, healed: true, ok: false,
                     error: String(e && e.message || e).slice(0, 120) });
        }
      }
    }
  }
  return ran;
}

/* api/social.js is given sixty seconds. The scheduled post must own them:
   whatever else this run would like to do, it does with what is left over. */
const RUN_BUDGET_MS = Number(process.env.RUN_BUDGET_MS || 55000);
/* the longest a single repair can plausibly take -- a card fetch, a container,
   a wait, a publish -- so one is never STARTED without room to finish it */
const HEAL_RESERVE_MS = Number(process.env.HEAL_RESERVE_MS || 22000);

export async function runDue(host, date, now, opts = {}) {
  const began = Date.now();
  const left = () => RUN_BUDGET_MS - (Date.now() - began);
  const D = await dials();
  const out = { date, mode: D.mode, at: (now || new Date()).toISOString(), ran: [], skipped: "" };

  if (!opts.force) {
    if (D.mode === "off") { out.skipped = "the machine is off"; return out; }
    if (!D.storeOk) { out.skipped = "the settings could not be read, so nothing was sent"; return out; }
  }

  const plan = await planDay(date, opts);
  out.verified = plan.verified;
  if (!plan.verified) out.note = "the calendar could not be verified, so nothing dated was planned";

  /* Settled means dealt with, not necessarily posted. "skipped" is a slot that
     had nothing to say today; "queued" is one already waiting for the owner on
     the middle rung; "pending" is one a network has taken and not finished with,
     which must not be sent twice. Leaving any of them owed had them picked again every hour for
     the rest of the day, ahead of slots that did have something to say, and on
     the middle rung it pushed a fresh copy into the queue each time. */
  const sent = [];
  for (const id of plan.slots) {
    const r = await readSlot(date, id);
    /* "partial" is settled as far as COMPOSING goes: the slot has been said,
       and running it again would post a second time everywhere it landed. The
       channel that refused is healed one channel at a time, by healFailures. */
    if (r && (r.state === "sent" || r.state === "skipped" ||
              r.state === "queued" || r.state === "pending" || r.state === "partial"))
      sent.push(id);
  }

  const due = dueNow(plan.slots, now || new Date(), sent, { all: true });
  /* an hour with nothing owed is the hour with the most time to spare, so it
     is exactly when the tidying should happen */
  if (!due.length) {
    out.skipped = "nothing is due";
    await tidyUp(host, date, out, now, began, opts);
    return out;
  }
  /* the cap counts POSTS, not attempts. Walking newest first keeps the old
     promise -- a cron that was down sends the most recent thing owed, never the
     backlog -- while letting the run fall through a slot that turns out to have
     nothing to say and reach the one behind it in the same minute. */
  const cap = opts.cap == null ? 1 : opts.cap;
  let posted = 0;

  const base = "https://" + publicHost(host);
  const idx = opts.index || null;
  for (const slot of due) {
    if (posted >= cap) break;
    let post;
    if (slot.id === "light") {
      const c = await compose(host, date, { polish: D.polish });
      if (!c) { out.ran.push({ slot: "light", skipped: "the library is not reachable" }); continue; }
      post = { lvl: (c.light && c.light.lvl) || "editorial", title: c.light.title,
        oneLine: c.light.title, body: c.caption, todo: [], basis: "", note: "",
        tags: [], link: c.link, image: c.image, slot: "light" };
    } else {
      const extras = await slotExtras(base, date, idx, slot.id, plan.hijri);
      post = buildSlot(slot.id, {
        date, hijri: plan.hijri, day: plan.day, leads: plan.leads,
        words: idx && idx.words, path: idx && idx.path,
        node: extras.node, entry: extras.entry, reel: extras.reel,
        link: base + "/?light=" + date,
        image: base + "/api/card?date=" + date + "&slot=" + encodeURIComponent(slot.id) + "&fmt=png"
      });
    }
    if (!post) {
      /* written down, so the console stops calling it owed and the next run
         does not spend itself on it again */
      await writeSlot(date, slot.id, { at: out.at, slot: slot.id, state: "skipped",
        title: "", why: "nothing to say for this slot today" });
      out.ran.push({ slot: slot.id, state: "skipped" });
      continue;
    }

    if (opts.dry) { out.ran.push({ slot: slot.id, dry: true, post }); continue; }

    if (D.mode === "approve" && !opts.force) {
      await writeSlot(date, slot.id, { at: out.at, state: "queued", slot: slot.id, post });
      if (kvReady()) { try { await kv([["LPUSH", K_Q, date + "#" + slot.id], ["LTRIM", K_Q, "0", "60"]]); } catch { } }
      out.ran.push({ slot: slot.id, state: "queued" });
      posted++;                       /* the rung says one a run, queued or sent */
      continue;
    }

    let results = {};
    /* A reel names the channels that can show one. The others would fall back
       to its cover, and a still frame of a video is a poor post. A card with
       the feed switched off goes to the story surfaces and nowhere else. */
    const storyOnly = cardIsStoryOnly(post, D);
    const chans = storyOnly ? storyChannels(post)
      : orderChannels(post.only ? liveChannels(post).filter(c => post.only.includes(c)) : liveChannels(post), post);
    if (storyOnly) results = await storyOnlyResults(post, date, chans, left, "");
    else for (const ch of chans) {
      const shaped = CH.shape(post, ch);
      if (CH.SPEC[ch].image === "required" && !shaped.image) { results[ch] = { ok: false, err: "needs an image" }; continue; }
      try { results[ch] = await sendWithin(ch, shaped, { ...post, date }, left); }
      catch (e) { results[ch] = { ok: false, err: String(e && e.message || e).slice(0, 120) }; }
    }
    /* Reddit is composed and kept, never sent. What is paced here is how often
       a draft is OFFERED -- there is no way to know when he actually posts one,
       and guessing would be worse than pacing the offer. If he skips one, the
       next comes round on the same rhythm and nothing is lost. */
    const rd = post.only ? null : CH.shape(post, "reddit");
    let lastRedditAt = null;
    if (rd) {
      if (kvReady()) { try { lastRedditAt = (await kv([["GET", K_RED]]))[0] || null; } catch { } }
      results.reddit = await CH.sendReddit(rd, { lastRedditAt });
      if (results.reddit.links && results.reddit.links.length && kvReady()) {
        try { await kv([["SET", K_RED, out.at]]); } catch { }
      }
    }

    const rec = { at: out.at, slot: slot.id, state: slotState(results),
      title: post.title, lvl: post.lvl, results };
    nameReel(rec, post);
    /* on the record first, then the stories: see sendSlot */
    await writeSlot(date, slot.id, rec);
    if (await addStories(results, { ...post, date }, D, left)) await writeSlot(date, slot.id, rec);
    out.ran.push({ slot: slot.id, state: rec.state, results });
    posted++;
    /* one line in the function log, so a slow hour can be read afterwards:
       which network took the time. Never a token, never a caption. */
    logRun("sent", { slot: slot.id, state: rec.state, msLeft: left(), took: tookBy(results) });
  }
  await tidyUp(host, date, out, now, began, opts);
  logRun("run", { ran: out.ran.map(r => r.slot + ":" + (r.state || (r.skipped ? "skipped" : "?"))), msLeft: out.msLeft, tidy: out.tidyError || "" });
  return out;
}

/* the per-network milliseconds of one slot's results, for the log */
function tookBy(results) {
  const t = {};
  for (const [ch, r] of Object.entries(results || {})) if (r && typeof r.ms === "number") t[ch] = r.ms + (r.late ? " late" : "");
  return t;
}
function logRun(what, fields) {
  try { console.log(JSON.stringify({ noor: what, ...fields })); } catch { }
}

/* ---------------------------------------------------------------------------
   THE TIDYING, AND WHY IT COMES LAST

   It used to come first, and that is how a 12:00 card came to be marked owed
   on a day the machine was working. The healer walked two days of slots,
   composed each repair, waited up to twelve seconds on a card fetch and three
   more between Instagram attempts -- and the function is given sixty seconds
   in total. On a day with something to repair, the run spent its whole budget
   in the net and never reached the posting loop at all. The safety net took
   down the thing it was there to protect.

   So: the scheduled post goes first and owns the clock. Repair happens after
   it, only with time genuinely left over, at most twice per run, and inside a
   guard -- because an exception here must cost a tidy-up, never a post.
--------------------------------------------------------------------------- */
async function tidyUp(host, date, out, now, began, opts = {}) {
  if (opts.dry) return;
  const left = () => RUN_BUDGET_MS - (Date.now() - began);
  try {
    if (left() > 6000) await finishPendingReels(date, out);
  } catch (e) {
    out.tidyError = "finishing reels: " + String(e && e.message || e).slice(0, 120);
  }
  try {
    await healFailures(host, date, out, now, need => left() > (need || HEAL_RESERVE_MS));
  } catch (e) {
    out.tidyError = (out.tidyError ? out.tidyError + " · " : "")
      + "healing: " + String(e && e.message || e).slice(0, 120);
  }
  out.msLeft = Math.max(0, left());
}

/* ===========================================================================
   PINTEREST · TURNING AN APPROVAL INTO A TOKEN
   ---------------------------------------------------------------------------
   Everything else about Pinterest was written months ago and has never posted,
   because the one step between "Pinterest approved the app" and "the house can
   post" was missing: the OAuth round trip. There was no redirect target, so
   there was no way to obtain the refresh token the sender needs, and the code
   sat waiting for an environment variable nobody could produce.

   Two actions close that gap, and they are deliberately in this route rather
   than a new file: the deployment is already near its function limit, and this
   route is the one that owns posting.

     /api/social?action=pin-auth       sends the owner to Pinterest to approve
     /pinterest/callback               Pinterest sends him back here with a code

   The callback cannot rely on the admin cookie, because Pinterest may return
   the owner in a different browser context than the one that unlocked the
   console. So the `state` carries its own proof: it is signed with
   ADMIN_SECRET and expires in fifteen minutes. That is what authorises the
   callback, and it is also what makes the round trip CSRF safe.

   The tokens are shown once, in the browser, and never written to the store.
   A refresh token is a password; the house does not keep a copy it was not
   asked to keep. The owner copies it into Vercel, which is the only place it
   belongs. */
const PIN_SCOPES = "boards:read,boards:write,pins:read,pins:write,user_accounts:read";
function pinRedirect(host) {
  return "https://" + String(host).replace(/^https?:\/\//, "") + "/pinterest/callback";
}
function pinState(secret) {
  const exp = Date.now() + 15 * 60 * 1000;
  return exp + "." + crypto.createHmac("sha256", secret).update("pin" + exp).digest("hex");
}
function pinStateOk(state, secret) {
  if (!secret) return false;
  const [expStr, sig] = String(state || "").split(".");
  const exp = parseInt(expStr, 10);
  if (!exp || Date.now() > exp) return false;
  const want = crypto.createHmac("sha256", secret).update("pin" + exp).digest("hex");
  const A = Buffer.from(sig || ""), B = Buffer.from(want);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}
const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function pinPage(res, title, bodyHtml, code = 200) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  return res.status(code).send('<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">' +
    "<title>" + esc(title) + " \u00b7 NOOR</title><style>" +
    "body{margin:0;background:#0F1630;color:#EEF1FA;font:16px/1.6 system-ui,sans-serif;padding:28px 18px}" +
    ".w{max-width:640px;margin:0 auto}h1{font-size:26px;margin:0 0 14px;color:#E9C86A}" +
    "p{color:#A9B3D6;max-width:60ch}code,.v{font-family:ui-monospace,Menlo,monospace;font-size:13px}" +
    ".v{display:block;background:#0B1129;border:1px solid #2B3766;border-radius:10px;padding:12px 14px;" +
    "margin:6px 0 16px;word-break:break-all;color:#EEF1FA}" +
    ".k{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#E9C86A;margin-top:14px}" +
    "a{color:#E9C86A}.ok{color:#7FD1AE}.no{color:#F0876A}" +
    "</style><div class=w>" + bodyHtml + "</div>");
}

export default async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL || "noorcodex.com";
  const q = req.query || {};
  let date = String(q.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = new Date().toISOString().slice(0, 10);

  /* Who is allowed to drive this.
     The console proves itself with the signed noor_admin cookie it was handed
     when the owner unlocked it. The nightly cron and a hand-run request have no
     cookie and carry the secret in a header instead. This route used to accept
     only the second kind, so every request the console ever made to it came
     back 401, the Social room rendered empty, and the empty state blamed
     ADMIN_SECRET -- which was set, and had been since the fifth of August.
     One check now, in _owner.js, shared rather than reinvented per route. */
  /* WHO IS ALLOWED TO DRIVE THIS — AND THE HOLE THAT WAS IN IT.
     ownerGate accepts two proofs: the console's signed cookie, or the secret in
     a header. A Vercel cron has neither. It arrives as an anonymous GET with a
     signature header and a vercel-cron user agent, and nothing else.

     So the hourly job that sends the day's posts was answered 401 every hour
     from the moment it shipped, and not one of the four daily slots ever ran.
     The calendar was right, the schedule was right, the posts were composed
     correctly — and the delivery was locked behind a door built for a person.

     api/warm.js already knew how to recognise a cron; this route did not, and
     the two were never compared. Now the cron is admitted for exactly one
     action, `due`, which only sends what the schedule already says is owed.
     Every other action stays owner-only. */
  const q0 = req.query || {};
  const fromVercelCron = !!req.headers["x-vercel-signature"]
    || /vercel-cron/i.test(String(req.headers["user-agent"] || ""));
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const cronSecret = process.env.CRON_SECRET || "";
  const bearerOk = !!cronSecret && bearer.length === cronSecret.length
    && crypto.timingSafeEqual(Buffer.from(bearer), Buffer.from(cronSecret));
  const cronMayRun = String(q0.action || "") === "due" && (fromVercelCron || bearerOk);
  /* Pinterest returns the owner to the callback in whatever browser he
     approved in, which may not be the one holding the console cookie. The
     signed, fifteen minute `state` this route issued is the proof instead. */
  const pinCallback = String(q0.action || "") === "pin-callback"
    && pinStateOk(q0.state, process.env.ADMIN_SECRET || "");
  /* the ledger of posted reels is public: it names reels that are already on
     the public feeds and nothing else, and the render run on GitHub reads it
     with no key of the house's in its hands */
  const publicLedger = req.method === "GET" && String(q0.action || "") === "posted";

  const gate = ownerGate(req);
  if (!gate.ok && !cronMayRun && !pinCallback && !publicLedger) return json(res, gate.code, { ok: false, reason: gate.reason });

  if (req.method === "GET") {
    const action = String(q.action || "preview");
    if (action === "posted") {
      const posted = await postedReels(new Date().toISOString().slice(0, 10));
      /* cacheable, unlike the rest of this route: it changes five times a day
         at most and the ledger is read once a week */
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.status(200).json({ ok: true, n: Object.keys(posted).length, grace_days: POSTED_GRACE_DAYS, posted });
    }
    /* Step one: send the owner to Pinterest. */
    if (action === "pin-auth") {
      const id = process.env.PIN_APP_ID, secret = process.env.ADMIN_SECRET || "";
      if (!id) return pinPage(res, "Pinterest", "<h1>Pinterest is not ready</h1><p>Set <code>PIN_APP_ID</code> in Vercel first. It is the app id on the Pinterest developer page, and it is not a secret.</p>", 400);
      const u = "https://www.pinterest.com/oauth/?" + new URLSearchParams({
        client_id: id, redirect_uri: pinRedirect(host), response_type: "code",
        scope: PIN_SCOPES, state: pinState(secret)
      }).toString();
      res.setHeader("Cache-Control", "no-store");
      res.writeHead(302, { Location: u });
      return res.end();
    }

    /* Step two: Pinterest hands back a code. Trade it for the tokens, show
       them once, and keep no copy. */
    if (action === "pin-callback") {
      const id = process.env.PIN_APP_ID, sec = process.env.PIN_APP_SECRET;
      if (String(q.error || "")) return pinPage(res, "Pinterest", "<h1>Pinterest said no</h1><p>It returned <code>" + esc(q.error) + "</code>" + (q.error_description ? ": " + esc(q.error_description) : "") + ".</p><p><a href=\"/api/social?action=pin-auth\">Try again</a></p>", 400);
      const code = String(q.code || "");
      if (!code) return pinPage(res, "Pinterest", "<h1>No code came back</h1><p>Start again from <a href=\"/api/social?action=pin-auth\">the beginning</a>.</p>", 400);
      if (!id || !sec) return pinPage(res, "Pinterest", "<h1>Half configured</h1><p>Both <code>PIN_APP_ID</code> and <code>PIN_APP_SECRET</code> must be set in Vercel before the code can be exchanged.</p>", 400);
      let j = null, err = "";
      try {
        const r = await fetch(CH.pinBase() + "/v5/oauth/token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded",
                     Authorization: "Basic " + Buffer.from(id + ":" + sec).toString("base64") },
          body: new URLSearchParams({ grant_type: "authorization_code", code,
                                      redirect_uri: pinRedirect(host) }).toString()
        });
        j = await r.json().catch(() => null);
        if (!r.ok) err = "Pinterest answered " + r.status + (j && j.message ? ": " + j.message : "");
      } catch (e) { err = String(e && e.message || e); }
      if (err || !j || !j.refresh_token) {
        return pinPage(res, "Pinterest", "<h1>The exchange failed</h1><p class=no>" + esc(err || "no refresh token came back") + "</p><p>The usual cause is a redirect URI on the Pinterest app that does not match this one exactly:</p><span class=v>" + esc(pinRedirect(host)) + "</span><p><a href=\"/api/social?action=pin-auth\">Try again</a></p>", 502);
      }
      /* the board, named rather than numbered, resolved while a token is in hand */
      let board = process.env.PIN_BOARD_ID || "", boardNote = "";
      if (!board) {
        board = await CH.pinBoardId(j.access_token).catch(() => "");
        if (!board) boardNote = "<p class=no>No board matched <code>PIN_BOARD_NAME</code>" + (process.env.PIN_BOARD_NAME ? " (" + esc(process.env.PIN_BOARD_NAME) + ")" : ", which is not set") + ". Create the board on Pinterest, then set the name, or paste a <code>PIN_BOARD_ID</code>.</p>";
      }
      const sandbox = CH.pinSandbox();
      const rows = [[sandbox ? "PIN_SANDBOX_REFRESH_TOKEN" : "PIN_REFRESH_TOKEN", j.refresh_token]];
      if (board && !sandbox) rows.push(["PIN_BOARD_ID", board]);
      return pinPage(res, "Pinterest connected",
        "<h1 class=ok>Pinterest said yes</h1>" +
        "<p>Copy these into Vercel now, under Settings, Environment Variables. This page is the only time they are shown, and the house keeps no copy of them.</p>" +
        rows.map(([k, v]) => "<div class=k>" + esc(k) + "</div><span class=v>" + esc(v) + "</span>").join("") +
        (sandbox ? "<p class=no>This token is for Pinterest's <b>sandbox</b> (PIN_API_BASE is set to it): pins made with it appear on your own profile and nowhere else, which is what Trial access allows. Keep PIN_REFRESH_TOKEN as it is; when Standard access lands, remove PIN_API_BASE and the house pins for real.</p>" : boardNote) +
        "<p>The access token lives thirty days and the house mints a new one from the refresh token whenever it needs to, so this is the last time you have to do this by hand.</p>" +
        "<p>Redeploy after saving them, then open the console's Social room: Pinterest should read as live.</p>");
    }

    if (action === "log") return json(res, 200, { ok: true, log: await socialLog(), queue: await queue() });
    if (action === "tokens") return json(res, 200, { ok: true, tokens: await tokenClock() });
    /* The console re-renders the ladder after every change. Composing a whole
       post just to read three booleans made that reload slow enough to look
       like the page had hung, so the dials answer on their own. */
    if (action === "dials") return json(res, 200, {
      ok: true, dials: await dials(),
      configured: { fb: fbConfigured(), ig: igConfigured() },
      channels: CH.ALL.map(c => ({ id: c, live: CH.configured[c] ? CH.configured[c]() : false,
        draftOnly: CH.draftOnly.has(c), spec: CH.SPEC[c] })),
      slots: SLOT_IDS
    });
    /* THE DAY, AS THE CONSOLE NEEDS TO SEE IT.
       The plan alone says what is scheduled. It does not say what already went,
       which is the half the owner actually asks about -- and without it the
       room kept offering to send a post that had already been sent. So the
       state of each slot is read back and returned alongside. */
    /* `today` is `plan` with the reels named: for each reel slot, the card
       the rota chose (id, kind, hook, caption, cover, video) read off the
       shelf once, so the console's Today room can show the day's five reels
       and hand one to the phone without composing five posts. */
    if (action === "plan" || action === "today") {
      const plan = await planDay(date);
      const now = new Date(), hour = now.getUTCHours();
      const slots = [];
      const shelf = action === "today" ? await readManifest(host) : null;
      for (const s of SLOTS) {
        if (!plan.slots.includes(s.id)) continue;
        const rec = await readSlot(date, s.id);
        const row = {
          id: s.id, at: s.at,
          /* a record with no state is the owner's own note (a phone share)
             on a slot the machine has not reached: still due, or waiting */
          state: rec && rec.state ? rec.state : (hour >= s.at ? "due" : "waiting"),
          title: rec ? rec.title : "",
          sentAt: rec ? rec.at : null,
          results: rec ? rec.results : null
        };
        if (shelf && s.reel) {
          const c = chooseReel(shelf.cards, date, s.reel, plan.hijri || null);
          const r = c ? rowUrls(c, host) : null;
          row.reel = r ? { id: r.id, kind: r.kind || "light", hook: r.hook || "", caption: r.caption || "",
                           cover: r.cover, video: r.video, secs: r.secs != null ? r.secs : null } : null;
        }
        slots.push(row);
      }
      /* the legacy single-post record, so a hand-sent day still reads as sent */
      const legacy = await readDay(date);
      return json(res, 200, { ok: true, plan, slots, nowHour: hour, date,
        shelf: shelf ? { n: shelf.n, written: shelf.written } : undefined,
        legacy: legacy && !legacy.err ? { state: legacy.state, at: legacy.at, title: legacy.title } : null });
    }
    /* the Reddit drafts waiting for a human, with their one-click links */
    /* read one slot without sending it, so a row can be opened and inspected */
    if (action === "slot") {
      const id = String(q.slot || "");
      if (!SLOT_IDS.includes(id)) return json(res, 400, { ok: false, error: "no such slot" });
      const post = await composeSlot(host, date, id);
      if (!post) return json(res, 200, { ok: true, slot: id, post: null,
        note: "Nothing to say for this slot today." });
      const shaped = {};
      for (const ch of CH.ALL) shaped[ch] = CH.shape(post, ch);
      const rec = await readSlot(date, id);
      return json(res, 200, { ok: true, slot: id, post, shaped,
        state: rec ? rec.state : null, sentAt: rec ? rec.at : null });
    }
    /* why one channel of one slot did not go, in facts rather than guesses */
    if (action === "diagnose") {
      const r = await diagnoseSlot(host, String(q.date || date), String(q.slot || ""), String(q.where || ""));
      return json(res, r.ok === false ? 400 : 200, r);
    }
    if (action === "reddit") {
      let last = null;
      if (kvReady()) { try { last = (await kv([["GET", K_RED]]))[0] || null; } catch { } }
      const held = [];
      for (const id of SLOT_IDS) {
        const r = await readSlot(date, id);
        if (r && r.results && r.results.reddit && r.results.reddit.links && r.results.reddit.links.length)
          held.push({ slot: id, title: r.results.reddit.title,
                      text: r.results.reddit.text, links: r.results.reddit.links });
      }
      return json(res, 200, { ok: true, lastOfferedAt: last,
        everyDays: CH.redditEveryDays(), subs: CH.redditSubs(), held });
    }
    /* the hourly cron lands here. It asks one question -- what is due that has
       not gone? -- and on most hours the answer is nothing, which costs a KV
       read and stops. */
    if (action === "due") {
      let index = null;
      try { const r = await fetch("https://" + publicHost(host) + "/assets/menu-index.json");
            if (r.ok) index = await r.json(); } catch { }
      return json(res, 200, { ok: true, due: await runDue(host, date, new Date(), { index }) });
    }
    const post = await compose(host, date, { polish: String(q.polish || "1") !== "0" });
    return json(res, 200, {
      ok: !!post, preview: post, dials: await dials(), tokens: await tokenClock(),
      configured: { fb: fbConfigured(), ig: igConfigured() },
      publicHost: publicHost(host)
    });
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
    if (body.action === "mode") {
      const r = await setMode(body.mode);
      const code = r.code || (r.ok ? 200 : 409);
      delete r.code;
      return json(res, code, r);
    }
    if (body.action === "renewed")
      return json(res, 200, await markTokenRenewed(String(body.which || "both"), body.at));
    /* the owner shared a reel from the phone (the Today room's Share button:
       TikTok, WhatsApp, X, whichever app the share sheet offered), and says
       so, so the console shows what went out by hand beside what the
       machine sent */
    if (body.action === "shared") {
      const r = await markShared(String(body.date || date), String(body.slot || ""), String(body.where || "phone"));
      return json(res, r.ok ? 200 : (r.code || 409), r);
    }
    /* send one named slot now, regardless of its hour */
    /* publish anything a network took and had not finished with, now, rather
       than at the top of the next hour */
    if (body.action === "finish-reels") {
      const ran = await finishPendingReels(date, { ran: [] });
      return json(res, 200, { ok: true, date, ran,
        note: ran.length ? "" : "nothing was waiting to be finished" });
    }
    if (body.action === "send-slot") {
      const r = await sendSlot(host, date, String(body.slot || ""), { force: !!body.force });
      return json(res, r.ok ? 200 : 409, r);
    }
    /* send one slot to ONE network, leaving the ones that already took it
       alone. This is what a half-failed slot needs; send-slot with force is
       what would post it twice. */
    if (body.action === "retry-channel") {
      /* byHand: this arrived from the console, so it does not spend the
         automatic healer's four tries. See the note in retryChannel. */
      const r = await retryChannel(host, String(body.date || date), String(body.slot || ""),
                                   String(body.where || ""), { force: !!body.force, byHand: true });
      return json(res, r.ok ? 200 : 409, r);
    }
    if (body.action === "skip") {
      const rec = await readDay(date) || { date, id: "", title: "" };
      rec.state = "skipped"; await writeDay(date, rec, true);
      return json(res, 200, { ok: true, skipped: date });
    }
    /* WHY AN UNKNOWN ACTION IS NOW AN ERROR AND NOT A RUN.

       This is almost certainly what the owner was actually hitting. The
       console posted a mode change, nothing above matched the action, and
       execution fell straight through to here -- so pressing "Full auto" did
       not set the ladder to auto, it RAN THE DAILY JOB. That job answers with
       an object whose own `mode` field is the mode it read on the way in, so
       the console got back { ok: true, mode: "off" } for a request that meant
       "make it auto", re-rendered the ladder from that field, and showed Off.
       Truthfully, from its point of view. The compose it did on the way is
       also slow, which is what made the room look like it was reloading.

       A route that silently does something else when it does not understand a
       request will keep producing bugs of exactly this shape, so it now says
       so instead. Only a request that actually asks for a run gets a run. */
    const act = String(body.action || "").trim().toLowerCase();
    const RUNS = new Set(["", "run", "post", "preview", "daily", "compose"]);
    if (!RUNS.has(act))
      return json(res, 400, { ok: false, reason: "unknown action: " + act, dials: await dials() });

    /* live:true is the only thing that reaches a network from here, and it is
       always force:true, because pressing Post by hand is the whole point of
       approve mode */
    const dry = body.live !== true;
    const out = await runDaily(host, date, { force: true, dry });
    return json(res, 200, { ok: true, ...out });
  }

  return json(res, 405, { ok: false, reason: "GET or POST" });
}
