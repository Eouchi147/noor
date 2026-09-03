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
import { planDay, buildSlot, dueNow, slotExtras, SLOT_IDS, SLOTS, REEL_SLOTS } from "./_schedule.js";
import * as CH from "./_channels.js";
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
const graphBase = tok => (/^IG/.test(String(tok || "")) ? GRAPH_IG : GRAPH_FB);
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

export async function dials() {
  /* the shipped state, and the state a store that will not answer gets */
  const v = { mode: "off", fb: true, ig: true, polish: true, storeOk: false };
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
  } catch { return { mode: "off", fb: true, ig: true, polish: true, storeOk: false }; }
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
export async function imageReachable(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
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
const igToken = () => process.env.IG_TOKEN || process.env.IG_ACCESS_TOKEN || process.env.FB_PAGE_TOKEN;

const metaErr = (j, fallback) =>
  (j && j.error && (j.error.error_user_msg || j.error.message)) ||
  (j && j.error_message) || fallback;

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

async function pageToken() {
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
    if (!r.ok) return { ok: false, error: metaErr(j, "http " + r.status) };
    return { ok: true, id: j.post_id || j.id || "" };
  } catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 160) }; }
}

async function postInstagram(post) {
  if (!igConfigured()) return { ok: false, skipped: "IG_USER_ID or a token is not set" };
  const id = process.env.IG_USER_ID, tok = igToken(), G = graphBase(tok);
  try {
    /* two steps: create a container from the public image URL, then publish it */
    const c = await fetch(`${G}/${id}/media`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ image_url: post.image, caption: post.caption, access_token: tok })
    });
    const cj = await c.json().catch(() => ({}));
    if (!c.ok || !cj.id) return { ok: false, error: metaErr(cj, "container http " + c.status) };
    const p = await fetch(`${G}/${id}/media_publish`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ creation_id: cj.id, access_token: tok })
    });
    const pj = await p.json().catch(() => ({}));
    if (!p.ok) return { ok: false, error: metaErr(pj, "publish http " + p.status) };
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
const IG_POLL_EVERY = Number(process.env.IG_POLL_EVERY_MS || 3000);
/* Vercel gives a function sixty seconds; this leaves room for the create call,
   the publish call and the rest of the run. */
const IG_POLL_BUDGET = Number(process.env.IG_POLL_BUDGET_MS || 32000);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function igPublish(creationId, id, tok, G) {
  const p = await fetch(`${G}/${id}/media_publish`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: tok })
  });
  const pj = await p.json().catch(() => ({}));
  if (!p.ok) return { ok: false, error: metaErr(pj, "publish http " + p.status) };
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

async function postInstagramReel(post) {
  if (!igConfigured()) return { ok: false, skipped: "IG_USER_ID or a token is not set" };
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
    if (!c.ok || !cj.id) return { ok: false, error: metaErr(cj, "container http " + c.status) };

    const started = Date.now();
    while (Date.now() - started < IG_POLL_BUDGET) {
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

async function readSlot(date, slot) {
  if (!kvReady()) return null;
  try { const r = (await kv([["GET", K_SLOT(date, slot)]]))[0];
    return r ? (typeof r === "string" ? JSON.parse(r) : r) : null; } catch { return null; }
}
async function writeSlot(date, slot, rec) {
  if (!kvReady()) return;
  try { await kv([["SET", K_SLOT(date, slot), JSON.stringify(rec)],
                  ["LPUSH", K_LOG, JSON.stringify({ at: rec.at, date, slot, state: rec.state })],
                  ["LTRIM", K_LOG, "0", "200"]]); } catch { }
}

/* which channels are live right now, minus the ones that must never auto-send */
export function liveChannels() {
  return CH.ALL.filter(c => !CH.draftOnly.has(c) && CH.configured[c] && CH.configured[c]());
}

async function sendOne(ch, shaped, post) {
  const p = { ...post, caption: shaped.text };
  if (ch === "facebook")  return await (p.video ? postFacebookReel(p) : postFacebook(p));
  if (ch === "instagram") return await (p.video ? postInstagramReel(p) : postInstagram(p));
  const fn = CH.SENDERS[ch];
  if (!fn) return { ok: false, err: "no sender for " + ch };
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
      tags: [], link: c.link, image: c.image, imageSvg: c.imageSvg, card: c.light };
  }
  let index = opts.index || null;
  if (!index) { try { const r = await fetch(base + "/assets/menu-index.json");
    if (r.ok) index = await r.json(); } catch { } }
  /* the day's chapter and word, in full, so the caption carries the material
     the library actually wrote rather than the index's one line */
  const extras = opts.extras || await slotExtras(base, date, index, slotId);
  return buildSlot(slotId, {
    date, hijri: plan.hijri, day: plan.day, leads: plan.leads,
    words: index && index.words, path: index && index.path,
    node: extras.node, entry: extras.entry,
    link: base + "/?light=" + date,
    /* its OWN card, not the day's light. Handing one url to every slot is what
       made four different posts a day look like one post four times. */
    image: base + "/api/card?date=" + date + "&slot=" + encodeURIComponent(slotId) + "&fmt=png"
  });
}

export async function sendSlot(host, date, slotId, opts = {}) {
  const D = await dials();
  const out = { date, slot: slotId, at: new Date().toISOString() };
  if (!SLOT_IDS.includes(slotId)) return { ...out, ok: false, error: "no such slot" };

  const prev = await readSlot(date, slotId);
  if (prev && prev.state === "sent" && !opts.force)
    return { ...out, ok: false, error: "that slot has already gone today" };

  const post = await composeSlot(host, date, slotId, opts);
  if (!post) return { ...out, ok: false, error: "nothing to say for that slot" };

  /* a preview is always allowed to render, including of something already said */
  if (opts.dry) return { ...out, ok: true, dry: true, post };

  const key = saidKey(post);
  if (!opts.force && key && (await recentlySaid()).includes(key))
    return { ...out, ok: false, repeat: true, title: post.title,
             error: "this has already been published recently, so it was not sent again" };

  const results = {};
  for (const ch of liveChannels()) {
    const shaped = CH.shape(post, ch);
    if (CH.SPEC[ch].image === "required" && !shaped.image) { results[ch] = { ok: false, err: "needs an image" }; continue; }
    try { results[ch] = await sendOne(ch, shaped, { ...post, date }); }
    catch (e) { results[ch] = { ok: false, err: String(e && e.message || e).slice(0, 120) }; }
  }
  let lastRedditAt = null;
  if (kvReady()) { try { lastRedditAt = (await kv([["GET", K_RED]]))[0] || null; } catch { } }
  results.reddit = await CH.sendReddit(CH.shape(post, "reddit"), { lastRedditAt });
  if (results.reddit.links && results.reddit.links.length && kvReady()) {
    try { await kv([["SET", K_RED, out.at]]); } catch { }
  }

  const anySent = Object.entries(results).some(([c, r]) => r.ok && !CH.draftOnly.has(c));
  const rec = { at: out.at, slot: slotId, state: anySent ? "sent" : "failed",
    title: post.title, lvl: post.lvl, results };
  await writeSlot(date, slotId, rec);
  if (anySent) await noteSaid(key);
  return { ...out, ok: anySent, state: rec.state, title: post.title, results };
}

export async function runDue(host, date, now, opts = {}) {
  const D = await dials();
  const out = { date, mode: D.mode, at: (now || new Date()).toISOString(), ran: [], skipped: "" };

  if (!opts.force) {
    if (D.mode === "off") { out.skipped = "the machine is off"; return out; }
    if (!D.storeOk) { out.skipped = "the settings could not be read, so nothing was sent"; return out; }
  }

  /* Instagram keeps a container for a day, so yesterday is as far back as it
     is worth looking, and looking further would risk republishing something a
     human has since posted by hand. */
  if (!opts.dry) {
    for (const d of [prevDate(date), date]) {
      for (const id of REEL_SLOTS) {
        const rec = await readSlot(d, id);
        if (!rec || rec.state !== "pending" || !rec.pending) continue;
        for (const p of rec.pending) {
          if (p.where !== "instagram") continue;
          const r = await finishInstagramReel(p.creation);
          if (r.ok) {
            rec.state = "sent"; delete rec.pending;
            rec.results = { ...(rec.results || {}), instagram: r };
            await writeSlot(d, id, rec);
            out.ran.push({ slot: id, date: d, state: "sent", finished: true });
          } else if (!r.pending) {
            rec.state = "failed"; delete rec.pending;
            rec.results = { ...(rec.results || {}), instagram: r };
            await writeSlot(d, id, rec);
            out.ran.push({ slot: id, date: d, state: "failed", error: r.error || "" });
          }
        }
      }
    }
  }

  const plan = await planDay(date, opts);
  out.verified = plan.verified;
  if (!plan.verified) out.note = "the calendar could not be verified, so nothing dated was planned";

  const sent = [];
  for (const id of plan.slots) { const r = await readSlot(date, id); if (r && r.state === "sent") sent.push(id); }

  const due = dueNow(plan.slots, now || new Date(), sent, { cap: opts.cap == null ? 1 : opts.cap });
  if (!due.length) { out.skipped = "nothing is due"; return out; }

  const base = "https://" + publicHost(host);
  const idx = opts.index || null;
  for (const slot of due) {
    let post;
    if (slot.id === "light") {
      const c = await compose(host, date, { polish: D.polish });
      if (!c) { out.ran.push({ slot: "light", skipped: "the library is not reachable" }); continue; }
      post = { lvl: (c.light && c.light.lvl) || "editorial", title: c.light.title,
        oneLine: c.light.title, body: c.caption, todo: [], basis: "", note: "",
        tags: [], link: c.link, image: c.image };
    } else {
      const extras = await slotExtras(base, date, idx, slot.id);
      post = buildSlot(slot.id, {
        date, hijri: plan.hijri, day: plan.day, leads: plan.leads,
        words: idx && idx.words, path: idx && idx.path,
        node: extras.node, entry: extras.entry,
        link: base + "/?light=" + date,
        image: base + "/api/card?date=" + date + "&slot=" + encodeURIComponent(slot.id) + "&fmt=png"
      });
    }
    if (!post) { out.ran.push({ slot: slot.id, skipped: "nothing to say" }); continue; }

    if (opts.dry) { out.ran.push({ slot: slot.id, dry: true, post }); continue; }

    if (D.mode === "approve" && !opts.force) {
      await writeSlot(date, slot.id, { at: out.at, state: "queued", slot: slot.id, post });
      if (kvReady()) { try { await kv([["LPUSH", K_Q, date + "#" + slot.id], ["LTRIM", K_Q, "0", "60"]]); } catch { } }
      out.ran.push({ slot: slot.id, state: "queued" });
      continue;
    }

    const results = {};
    /* A reel names the channels that can show one. The others would fall back
       to its cover, and a still frame of a video is a poor post. */
    const chans = post.only ? liveChannels().filter(c => post.only.includes(c))
                            : liveChannels();
    for (const ch of chans) {
      const shaped = CH.shape(post, ch);
      if (CH.SPEC[ch].image === "required" && !shaped.image) { results[ch] = { ok: false, err: "needs an image" }; continue; }
      try { results[ch] = await sendOne(ch, shaped, { ...post, date }); }
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

    const anySent = Object.entries(results).some(([c, r]) => r.ok && !CH.draftOnly.has(c));
    const pending = Object.entries(results)
      .filter(([, r]) => r && r.pending)
      .map(([c, r]) => ({ where: c, creation: r.pending }));
    const rec = { at: out.at, slot: slot.id,
      state: anySent && !pending.length ? "sent" : (pending.length ? "pending" : "failed"),
      title: post.title, lvl: post.lvl, results };
    if (pending.length) rec.pending = pending;
    await writeSlot(date, slot.id, rec);
    out.ran.push({ slot: slot.id, state: rec.state, results });
  }
  return out;
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

  const gate = ownerGate(req);
  if (!gate.ok && !cronMayRun && !pinCallback) return json(res, gate.code, { ok: false, reason: gate.reason });

  if (req.method === "GET") {
    const action = String(q.action || "preview");
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
      const rows = [["PIN_REFRESH_TOKEN", j.refresh_token]];
      if (board) rows.push(["PIN_BOARD_ID", board]);
      return pinPage(res, "Pinterest connected",
        "<h1 class=ok>Pinterest said yes</h1>" +
        "<p>Copy these into Vercel now, under Settings, Environment Variables. This page is the only time they are shown, and the house keeps no copy of them.</p>" +
        rows.map(([k, v]) => "<div class=k>" + esc(k) + "</div><span class=v>" + esc(v) + "</span>").join("") +
        boardNote +
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
    if (action === "plan" || action === "today") {
      const plan = await planDay(date);
      const now = new Date(), hour = now.getUTCHours();
      const slots = [];
      for (const s of SLOTS) {
        if (!plan.slots.includes(s.id)) continue;
        const rec = await readSlot(date, s.id);
        slots.push({
          id: s.id, at: s.at,
          state: rec ? rec.state : (hour >= s.at ? "due" : "waiting"),
          title: rec ? rec.title : "",
          sentAt: rec ? rec.at : null,
          results: rec ? rec.results : null
        });
      }
      /* the legacy single-post record, so a hand-sent day still reads as sent */
      const legacy = await readDay(date);
      return json(res, 200, { ok: true, plan, slots, nowHour: hour,
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
    /* send one named slot now, regardless of its hour */
    if (body.action === "send-slot") {
      const r = await sendSlot(host, date, String(body.slot || ""), { force: !!body.force });
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
