// The social machine.
//
// Once a day the house takes the light it has already chosen and audited, and
// puts it where people are. Nothing here writes a fact: the card came from the
// library and the library was validated, so the worst this file can do is
// phrase a caption badly.
//
// WHAT IT DOES
//   compose   builds the caption and the image URL for a given day
//   preview   the same thing, returned and never sent  (the default)
//   post      actually publishes, and ONLY when three things agree:
//               the social.auto dial is on, the channel's own dial is on,
//               and the credentials for that channel exist
//
// WHAT IT REFUSES TO DO
//   It will not post twice for the same day. The day's key is written before
//   the request goes out, so a cron that fires twice, or a retry after a
//   timeout, cannot double post.
//
// HONEST NOTE FOR WHOEVER MAINTAINS THIS
//   The composer, the guard rails, the de-duplication and the dry run are
//   tested in tests/social.mjs. The two network calls at the bottom, to
//   Facebook and to Instagram, are written to Meta's documented Graph API and
//   have NOT been run against live credentials, because this repository has
//   none. Use Preview, then Post once by hand from the console, and read what
//   comes back, BEFORE turning the daily schedule on.

import { kv, kvReady } from "./_kv.js";
import { chooseLight } from "./_lights.js";
import { askOpenRouter } from "./_models.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const K_LOG = "nsoc:log";
const K_DAY = d => "nsoc:day:" + d;

const json = (res, code, obj) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(obj);
};

async function dials() {
  const v = { auto: false, fb: true, ig: true, polish: true };
  if (!kvReady()) return v;
  try {
    const raw = (await kv([["GET", "nb:settings"]]))[0];
    const o = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
    if (o["social.auto"] === true) v.auto = true;
    if (o["social.fb"] === false) v.fb = false;
    if (o["social.ig"] === false) v.ig = false;
    if (o["social.polish"] === false) v.polish = false;
  } catch { }
  return v;
}

const TAGS = "#Islam #IslamicHistory #Quran #Muslim #NoorCodexOfLight";

/* The caption is assembled from the card, never invented. The Lantern is
   allowed one job on it: tighten the opening line. It is given the story and
   told it may not add a fact. If it returns anything that introduces a number
   or a name the card did not contain, the plain version is used instead. */
async function caption(light, host, polish) {
  const base = light.story.length > 300 ? light.story.slice(0, 297).replace(/\s+\S*$/, "") + "…" : light.story;
  const plain = `${light.title}\n\n${base}\n\n${light.detail}\n\nRead free at noorcodex.com\n\n${TAGS}`;
  if (!polish) return { text: plain, polished: false };
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
    /* the guard: every number in the polished text must already exist in ours */
    const nums = s => (s.match(/\d+/g) || []);
    const ours = new Set(nums(plain));
    if (nums(out).some(n => !ours.has(n))) return { text: plain, polished: false, refused: "it introduced a number" };
    if (/[—–!]|[\u{1F300}-\u{1FAFF}]/u.test(out)) return { text: plain, polished: false, refused: "house style" };
    if (out.length > 2100) return { text: plain, polished: false, refused: "too long" };
    return { text: out, polished: true, model: got.model };
  } catch { return { text: plain, polished: false }; }
}

export async function compose(host, date, opts = {}) {
  const light = await chooseLight(host, date, { useLantern: false, peek: true });
  if (!light) return null;
  const base = "https://" + String(host).replace(/^https?:\/\//, "");
  const cap = await caption(light, host, opts.polish !== false);
  return {
    date, light: { id: light.id, title: light.title, category: light.category, detail: light.detail },
    caption: cap.text, polished: cap.polished, refused: cap.refused || "",
    image: base + "/api/card?date=" + date + "&fmt=png",
    imageSvg: base + "/api/card?date=" + date,
    link: base + "/?light=" + date
  };
}

/* ---------------------------------------------------------------------------
   the two networks. Written to Meta's documented Graph API, and NOT yet run
   against live credentials. Read the honest note at the top of this file.
--------------------------------------------------------------------------- */
async function postFacebook(post) {
  const id = process.env.FB_PAGE_ID, tok = process.env.FB_PAGE_TOKEN;
  if (!id || !tok) return { ok: false, skipped: "FB_PAGE_ID or FB_PAGE_TOKEN is not set" };
  try {
    const r = await fetch(`${GRAPH}/${id}/photos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: post.image, caption: post.caption, access_token: tok })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: (j.error && j.error.message) || ("http " + r.status) };
    return { ok: true, id: j.post_id || j.id || "" };
  } catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 120) }; }
}

async function postInstagram(post) {
  const id = process.env.IG_USER_ID, tok = process.env.IG_TOKEN || process.env.FB_PAGE_TOKEN;
  if (!id || !tok) return { ok: false, skipped: "IG_USER_ID or a token is not set" };
  try {
    /* Instagram is two steps: create a container, then publish it. */
    const c = await fetch(`${GRAPH}/${id}/media`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ image_url: post.image, caption: post.caption, access_token: tok })
    });
    const cj = await c.json().catch(() => ({}));
    if (!c.ok || !cj.id) return { ok: false, error: (cj.error && cj.error.message) || ("container http " + c.status) };
    const p = await fetch(`${GRAPH}/${id}/media_publish`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ creation_id: cj.id, access_token: tok })
    });
    const pj = await p.json().catch(() => ({}));
    if (!p.ok) return { ok: false, error: (pj.error && pj.error.message) || ("publish http " + p.status) };
    return { ok: true, id: pj.id || cj.id };
  } catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 120) }; }
}

async function alreadyPosted(date) {
  if (!kvReady()) return false;
  try { const r = await kv([["GET", K_DAY(date)]]); return !!(r && r[0]); } catch { return false; }
}
async function markPosted(date, rec) {
  if (!kvReady()) return;
  try {
    await kv([["SET", K_DAY(date), JSON.stringify(rec)], ["EXPIRE", K_DAY(date), "7776000"],
              ["LPUSH", K_LOG, JSON.stringify(rec)], ["LTRIM", K_LOG, "0", "120"],
              ["EXPIRE", K_LOG, "31536000"]]);
  } catch { }
}
export async function socialLog() {
  if (!kvReady()) return [];
  try {
    const r = await kv([["LRANGE", K_LOG, "0", "60"]]);
    return ((r && r[0]) || []).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

/* the one call the cron and the console both make */
export async function runDaily(host, date, opts = {}) {
  const D = await dials();
  const out = { date, auto: D.auto, ran: [], skipped: "" };
  if (!opts.force && !D.auto) { out.skipped = "the social.auto dial is off"; return out; }
  if (!opts.force && await alreadyPosted(date)) { out.skipped = "already posted for this day"; return out; }

  const post = await compose(host, date, { polish: D.polish });
  if (!post) { out.skipped = "the library is not reachable"; return out; }
  out.post = post;

  if (opts.dry) { out.skipped = "dry run, nothing was sent"; return out; }

  /* written BEFORE the network calls, so a retry or a double cron cannot
     publish the same day twice */
  await markPosted(date, { at: new Date().toISOString(), date, id: post.light.id,
                           title: post.light.title, state: "sending" });

  if (D.fb) out.ran.push(Object.assign({ where: "facebook" }, await postFacebook(post)));
  if (D.ig) out.ran.push(Object.assign({ where: "instagram" }, await postInstagram(post)));

  await markPosted(date, { at: new Date().toISOString(), date, id: post.light.id,
                           title: post.light.title, state: "sent", ran: out.ran });
  return out;
}

export default async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL || "noorcodex.com";
  const q = req.query || {};
  let date = String(q.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = new Date().toISOString().slice(0, 10);

  /* reading is open to the owner only, and only ever previews */
  const key = req.headers["x-admin-key"] || (q.key || "");
  const owner = process.env.ADMIN_SECRET && key === process.env.ADMIN_SECRET;
  if (!owner) return json(res, 401, { ok: false, reason: "locked" });

  if (req.method === "GET") {
    const action = String(q.action || "preview");
    if (action === "log") return json(res, 200, { ok: true, log: await socialLog() });
    const post = await compose(host, date, { polish: String(q.polish || "1") !== "0" });
    return json(res, 200, { ok: !!post, preview: post, dials: await dials() });
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
    const dry = body.dry !== false && body.live !== true;
    const out = await runDaily(host, date, { force: true, dry });
    return json(res, 200, { ok: true, ...out });
  }

  return json(res, 405, { ok: false, reason: "GET or POST" });
}
