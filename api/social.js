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

import { kv, kvReady } from "./_kv.js";
import { chooseLight } from "./_lights.js";
import { askOpenRouter } from "./_models.js";
import { ownerGate } from "./_owner.js";

/* Meta issues two kinds of publishing credential. The classic route, through
   Facebook login and a linked Page, hands out EAA... tokens and speaks
   graph.facebook.com. The newer route, Instagram login from the app dashboard,
   hands out IG... tokens and speaks graph.instagram.com. The publish dance is
   identical on both, so the host is read off the token rather than set by a
   human, and therefore cannot be set wrong. */
const GRAPH_FB = "https://graph.facebook.com/v21.0";
const GRAPH_IG = "https://graph.instagram.com/v21.0";
const graphBase = tok => (/^IG/.test(String(tok || "")) ? GRAPH_IG : GRAPH_FB);

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

export async function dials() {
  /* the shipped state, and the state a store that will not answer gets */
  const v = { mode: "off", fb: true, ig: true, polish: true, storeOk: false };
  if (!kvReady()) return v;
  try {
    const raw = (await kv([["GET", "nb:settings"]]))[0];
    const o = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
    v.storeOk = true;
    if (MODES.has(o["social.mode"])) v.mode = o["social.mode"];
    else if (o["social.auto"] === true) v.mode = "auto";   /* the older boolean dial */
    if (o["social.fb"] === false) v.fb = false;
    if (o["social.ig"] === false) v.ig = false;
    if (o["social.polish"] === false) v.polish = false;
  } catch { return { mode: "off", fb: true, ig: true, polish: true, storeOk: false }; }
  return v;
}

/* ---------------------------------------------------------------------------
   the caption
--------------------------------------------------------------------------- */
const TAGS = "#Islam #IslamicHistory #Quran #Muslim #NoorCodexOfLight";

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

async function caption(light, polish) {
  const s = light.story.length > 300 ? light.story.slice(0, 297).replace(/\s+\S*$/, "") + "…" : light.story;
  const plain = fitCaption(`${light.title}\n\n${s}\n\n${light.detail}\n\nRead free at noorcodex.com\n\n${TAGS}`);
  if (!polish) return { text: plain, polished: false };
  if (CITED.has(light.lvl)) return { text: plain, polished: false, refused: "it carries a citation" };
  try {
    const got = await askOpenRouter([
      { role: "system", content: "You tighten the first sentence of a social caption for a free Islamic library. " +
        "You may reorder and shorten words. You may NOT add any fact, name, number, date or claim that is not " +
        "already in the text you are given. No emoji. No exclamation marks. No em dashes. Reply with the caption only." },
      { role: "user", content: plain }
    ], { max_tokens: 400, temperature: 0.3, timeout: 8000, budget: 16000, maxTries: 2,
         title: "NOOR Codex of Light · the day's post" });
    const out = String(got.text || "").trim();
    if (!out) return { text: plain, polished: false };
    const nums = x => (x.match(/\d+/g) || []);
    const ours = new Set(nums(plain));
    if (nums(out).some(n => !ours.has(n))) return { text: plain, polished: false, refused: "it introduced a number" };
    if (/[—–!]|[\u{1F300}-\u{1FAFF}]/u.test(out)) return { text: plain, polished: false, refused: "house style" };
    if (out.length > CAP_CHARS) return { text: plain, polished: false, refused: "too long" };
    return { text: fitCaption(out), polished: true, model: got.model };
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

async function postFacebook(post) {
  if (!fbConfigured()) return { ok: false, skipped: "FB_PAGE_ID or FB_PAGE_TOKEN is not set" };
  const id = process.env.FB_PAGE_ID, tok = process.env.FB_PAGE_TOKEN;
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

/* Never throws. A network wobble must not take the cron down with it. */
export async function publishAll(rec, post, D) {
  const ran = [];
  if (D.fb && !rec.fbId) {
    const r = await postFacebook(post);
    if (r.ok) rec.fbId = r.id || "posted";
    ran.push({ where: "facebook", ...r });
  } else if (D.fb) ran.push({ where: "facebook", ok: true, id: rec.fbId, already: true });
  if (D.ig && !rec.igId) {
    const r = await postInstagram(post);
    if (r.ok) rec.igId = r.id || "posted";
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
  const gate = ownerGate(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, reason: gate.reason });

  if (req.method === "GET") {
    const action = String(q.action || "preview");
    if (action === "log") return json(res, 200, { ok: true, log: await socialLog(), queue: await queue() });
    if (action === "tokens") return json(res, 200, { ok: true, tokens: await tokenClock() });
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
    if (body.action === "renewed")
      return json(res, 200, await markTokenRenewed(String(body.which || "both"), body.at));
    if (body.action === "skip") {
      const rec = await readDay(date) || { date, id: "", title: "" };
      rec.state = "skipped"; await writeDay(date, rec, true);
      return json(res, 200, { ok: true, skipped: date });
    }
    /* live:true is the only thing that reaches a network from here, and it is
       always force:true, because pressing Post by hand is the whole point of
       approve mode */
    const dry = body.live !== true;
    const out = await runDaily(host, date, { force: true, dry });
    return json(res, 200, { ok: true, ...out });
  }

  return json(res, 405, { ok: false, reason: "GET or POST" });
}
