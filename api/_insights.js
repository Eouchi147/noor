/* NOOR · what strangers watch
   ===========================================================================
   Ten posts a day for two weeks is a hundred and forty posts, and the rota
   that chose them was written from taste. This reads back what each one did
   -- how many people it reached, how many watched it -- and folds the numbers
   by kind, by hour and by network, so the rota can lean on what happened
   rather than on what was hoped.

   WHERE THE NUMBERS COME FROM. Every slot record (api/social.js, readSlot)
   carries the id each network gave the post. For an Instagram id this asks
   GET /{ig-media-id}/insights; for a Facebook post GET /{post-id}/insights;
   for a YouTube Short GET videos?part=statistics; for a Threads post GET
   /{threads-media-id}/insights (below). Nothing here is computed from
   anything the house made up: a number is Meta's or Google's, or it is
   absent and the post is counted as "not read".

   THREADS. GET https://graph.threads.net/v1.0/{media-id}/insights?metric=
   views,likes,replies,reposts,quotes,shares, per Meta's Threads API
   documentation (developers.facebook.com/docs/threads/insights): a media's
   views stand for what Instagram calls reach (Threads gives no separate
   reach metric), likes and replies are counted as they are named, and
   reposts and quotes are kept beside shares rather than folded into it,
   since none of the three is the other. The permission is
   threads_manage_insights: a token made only for threads_content_publish
   (api/_threads.js's own SCOPE) answers with the same code 10 or 200 the
   Instagram path already reads, detected on the first media exactly as the
   Instagram permission is, so the batch stops and the console names
   TH_TOKEN rather than showing a column of refusals.

   WHAT IS CACHED. Each media's answer is kept in the store under
   nsoc:ins:<network>:<id> with the time it was fetched, and asked for again
   only after six hours (an hour after a refusal). A refusal is recorded as
   { error } and the aggregate goes on; no single post can stop the read.

   WHAT A CALL MAY COST. Vercel gives a function sixty seconds. One call reads
   at most forty media, the oldest cache first, and answers partial: true
   when there is more to do; the console simply asks again.

   THE METRIC NAMES. Meta retired `plays` and `impressions` for every API
   version on 21 April 2025 and replaced both with `views`; so "plays" in the
   brief is `views` here, and a post's views on Instagram are what the
   console calls watched. The reel set is views, reach, likes, comments,
   saved, shares, total_interactions and the average watch time; a card has
   the same set without the watch time. If Meta refuses a name (code 100) the
   call is made once more with the bare set, so a renamed metric costs a
   column, not the read.

   THE FACEBOOK NAMES, AND WHAT META RETIRED, read from Meta's own pages on
   9 September 2026 (the house speaks v21.0, available until 21 January
   2027 per https://developers.facebook.com/docs/graph-api/changelog/):

     15 November 2025  `post_impressions` retired for every API version.
                       Meta's notice of 15 August 2025, 90 days ahead, names
                       the "impressions" and "page fans" metrics as retired
                       and "views" as the replacement for impressions, and
                       names no replacement for page fans:
                       https://developers.facebook.com/blog/post/2025/08/15/page-insights-api-updates/
                       "the API will return an invalid metric error", which
                       is the (#100) this file was seeing. The post-level
                       name that stands for views, `post_media_view`, is the
                       v21.0 reference's (Post Media View), not the blog's;
                       the same reference lists `page_follows`, not a
                       `page_followers`, so nothing here relies on the latter.
     15 June 2026      `post_impressions_unique` retired, replaced by
                       `post_total_media_view_unique`; with it every unique
                       impressions variant (paid, organic, viral, nonviral,
                       fan) and `post_video_views_unique`, none replaced.
                       https://docs.supermetrics.com/docs/facebook-insights-field-changes-june-30-2026
                       The v21.0 reference marks the same names "Deprecated
                       above Graph API v25":
                       https://developers.facebook.com/docs/graph-api/reference/v21.0/insights
     earlier           `post_engaged_users` (the unique engagement family,
                       gone with the 30 October 2024 batch) and
                       `post_media_view_unique`, which was never a documented
                       name, are dropped from the candidates below.

   So a post is asked for post_total_media_view_unique (reach),
   post_media_view (views), post_clicks and post_reactions_like_total, all
   four standing in the v21.0 reference. A Facebook REEL is a video node and
   answers under /video_insights with the reel names Meta introduced on
   15 December 2022 (https://developers.facebook.com/blog/post/2022/12/15/introducing-reels-metrics-api/):
   blue_reels_play_count and fb_reels_total_plays (plays),
   post_video_avg_time_watched, post_video_view_time,
   post_video_social_actions, post_video_likes_by_reaction_type; its reach
   was `post_impressions_unique`, retired 15 June 2026 as above, so
   post_total_media_view_unique is tried in its place and the total_video_*
   names (https://developers.facebook.com/docs/graph-api/reference/video/video_insights/)
   stay as candidates for an ordinary video. The learner below keeps only
   what Meta actually accepts, so a name that is refused costs a probe and
   not the read.

   THE PERMISSION. An Instagram token made for publishing may lack
   instagram_manage_insights. Meta answers code 10 or 200, or names the
   permission in its sentence. That is detected on the first media, the
   batch stops, and the owner is told what to generate rather than being
   shown a hundred and forty refusals.
--------------------------------------------------------------------------- */
import fs from "node:fs";
import path from "node:path";
import { kv, kvReady } from "./_kv.js";
import { SLOTS, SLOT_IDS, REEL_SLOTS, chooseReel } from "./_schedule.js";
import { readSlot, igToken, graphBase, pageToken, igConfigured, fbConfigured } from "./social.js";
import * as YT from "./_youtube.js";
import * as TH from "./_threads.js";

export const K_INS = (net, id) => "nsoc:ins:" + net + ":" + id;
export const CACHE_MS = 6 * 3600 * 1000;      /* an answer is good for six hours */
export const ERR_MS = 3600 * 1000;            /* a refusal is asked again after one */
export const BATCH = 40;                      /* media per call */
export const BUDGET_MS = 42000;               /* of the sixty seconds, leaving room to answer */
export const MIN_BUCKET = 5;                  /* a sentence needs this many in a bucket */
export const NEEDS_IG = "instagram_manage_insights";
export const NEEDS_TH = "threads_manage_insights";

const GRAPH_FB = "https://graph.facebook.com/v21.0";
const YT_VIDEOS = "https://www.googleapis.com/youtube/v3/videos";

/* the two metric sets, and the bare set each falls back to */
export const IG_METRICS = {
  reel: ["views", "reach", "likes", "comments", "saved", "shares", "total_interactions", "ig_reels_avg_watch_time"],
  reelBare: ["reach", "likes", "comments", "saved", "shares"],
  image: ["views", "reach", "likes", "comments", "saved", "shares", "total_interactions"],
  imageBare: ["reach", "likes", "comments", "saved", "shares"]
};
export const FB_METRICS = {
  full: ["post_total_media_view_unique", "post_media_view", "post_clicks", "post_reactions_like_total"],
  bare: ["post_media_view", "post_clicks", "post_reactions_like_total"]
};
/* Threads media insights, one set, no fallback: Meta's Threads API names
   these six for a single post (developers.facebook.com/docs/threads/insights)
   and none of them has been retired the way the Facebook names above were. */
export const TH_METRICS = ["views", "likes", "replies", "reposts", "quotes", "shares"];
/* Meta answered "(#100) The value must be a valid insights metric" to the
   old sets, 44 posts running, on the first live read: half the names were
   retired (see the dates at the top) and the API does not say which it
   takes. So the house asks it, once: each candidate below is tried alone on
   a real post, the ones Meta accepts are kept under nsoc:ins:fbset for a
   week, and every read after that asks for exactly those. Every name here
   stands in the v21.0 reference on 9 September 2026; a new name Meta
   introduces is added here and nothing else needs to change. */
export const FB_CANDIDATES = [
  "post_total_media_view_unique", "post_media_view", "post_video_views",
  "post_clicks", "post_reactions_like_total"
];
export const K_FBSET = "nsoc:ins:fbset";
const FBSET_MS = 7 * 86400 * 1000;
const FBSET_EMPTY_MS = 3600 * 1000;           /* a set with nothing in it is asked about again within the hour */
/* A reel on Facebook is a VIDEO node, not a post: its id has no underscore
   (a post's id is <page>_<post>), it answers under /video_insights, and it
   takes none of the post names. The first live learning ran on a reel and
   learned that Meta takes nothing, for a week. So videos have their own
   candidates, their own learned set and their own key. */
/* The reel names first (what the house posts IS a reel), then the names an
   ordinary video answers to, so one learner covers both. The retired
   `post_impressions_unique` (a reel's reach until 15 June 2026) is not
   asked for; its successor is. */
export const FB_VIDEO_CANDIDATES = [
  "post_total_media_view_unique", "blue_reels_play_count", "fb_reels_total_plays",
  "post_video_avg_time_watched", "post_video_view_time", "post_video_social_actions", "post_video_likes_by_reaction_type",
  "total_video_impressions_unique", "total_video_views", "total_video_avg_time_watched"
];
export const K_FBVSET = "nsoc:ins:fbvset";
const isVideoId = id => !/_/.test(String(id));
const FBV_REACH = ["post_total_media_view_unique", "total_video_impressions_unique"];
const FBV_VIEWS = ["blue_reels_play_count", "fb_reels_total_plays", "total_video_views"];
/* which candidate stands for which column, first found first served */
const FB_REACH = ["post_total_media_view_unique"];
const FB_VIEWS = ["post_media_view", "post_video_views"];
const firstOf = (m, names) => { for (const n of names) if (m[n] != null) return m[n]; return null; };

/* the set Meta accepts, learned once on a real post and remembered */
export async function fbMetricSet(id, tok, opts = {}) {
  const nowMs = nowMsOf(opts.now);
  const video = isVideoId(id);
  const key = video ? K_FBVSET : K_FBSET;
  const edge = video ? "video_insights" : "insights";
  const [c] = await cacheRead([key], opts);
  if (c && c.at && Array.isArray(c.set) && nowMs - Date.parse(c.at) < (c.set.length ? FBSET_MS : FBSET_EMPTY_MS)) return c.set;
  const set = [];
  for (const name of (video ? FB_VIDEO_CANDIDATES : FB_CANDIDATES)) {
    let r;
    try { r = await graphGet(`${GRAPH_FB}/${id}/${edge}?metric=${name}`, tok, opts.fetch); } catch { continue; }
    if (r.ok) set.push(name);                   /* accepted, even if empty today: a name Meta takes */
    else if (permissionMissing(metaCode(r.j), metaErr(r.j))) return { needs: metaErr(r.j) || "permission" };
  }
  await cacheWrite(key, { at: new Date(nowMs).toISOString(), set }, opts);
  return set;
}

/* ---------------------------------------------------------------------------
   the kinds

   A card post is its slot: dawn, light, word, dusk, lead. A reel's record
   carries its hook as the title and nothing else, so its kind is found by
   matching the hook against the shelf (/reels/index.json); failing that, the
   rota is asked which reel the day chose; failing that it is a "reel". The
   two families are keyed apart, because the word reel and the word card are
   different things and one sentence must not call them the same.
--------------------------------------------------------------------------- */
export const KIND_LABEL = {
  "reel:verse": "verse reels", "reel:word": "word reels", "reel:know": "Did you know reels",
  "reel:day": "This day reels", "reel:light": "day's-card reels", "reel:name": "Name reels", "reel:dua": "du'a reels", "reel:reel": "reels",
  "reel:short": "silent films",
  "card:dawn": "dawn cards", "card:light": "day's cards", "card:word": "word cards", "card:dusk": "chapter cards", "card:lead": "coming-up cards"
};
export const kindLabel = k => KIND_LABEL[k] || String(k || "").replace(/^(reel|card):/, "");
export const hourOf = slot => { const s = SLOTS.find(x => x.id === slot); return s ? s.at : null; };
const halfOf = slot => (SLOTS.find(x => x.id === slot) || {}).reel || "";

/* the card a record's hook names, so both kindOf and subjectOf read the same
   match rather than guessing twice */
function matchedCard(rec, manifest) {
  const slot = rec && rec.slot;
  if (!REEL_SLOTS.includes(slot)) return null;
  const cards = (manifest && Array.isArray(manifest.cards)) ? manifest.cards : [];
  const title = String(rec.title || "").trim();
  if (title) {
    const hit = cards.find(c => c && String(c.hook || "").trim() === title);
    if (hit) return hit;
  }
  if (cards.length && rec.date) {
    const c = chooseReel(cards, rec.date, halfOf(slot), null);
    if (c) return c;
  }
  return null;
}
export function kindOf(rec, manifest) {
  const slot = rec && rec.slot;
  if (!REEL_SLOTS.includes(slot)) return "card:" + slot;
  const c = matchedCard(rec, manifest);
  return c ? "reel:" + (c.kind || "light") : "reel:reel";
}

/* ---------------------------------------------------------------------------
   THE SUBJECT (masterplan section 12, the learning loop)

   A kind says a reel was a Light, a verse, a word or a silent film; it does
   not say WHICH Light, WHICH surah, WHICH word's category, or WHICH field a
   film's hero worked in. The rota can lean on "verse reels beat word reels"
   already; it cannot yet lean on "Surah al-Baqarah beats Surah an-Nas", and
   that is the finer question a production batch actually needs answered.

   THE DEPLOY GAP THIS FIXES. The first version of this read lights/all.json,
   assets/dict-index.json and the reels' own Qur'an table live, through
   api/page.js's lightById(), groupOf(), dictionary() and surahRow(). A
   refuter's review found that api/page.js's own includeFiles (vercel.json)
   is set on api/page.js and api/sitemap.js alone; api/insights.js,
   api/house.js (which reaches this file's collect() through api/_flow.js)
   and api/warm.js carried none of it, so on Vercel those source files would
   simply not be present in the function's filesystem and the subject fold
   would ship empty, with no error at all -- the same class of fault
   scripts/graph/derive_person_words.py already exists to prevent for
   relatedWords()'s person-word exemptions.

   So this reads a small, pre-derived file instead:
   scripts/graph/derive_reel_subjects.py (run by scripts/graph/run.sh, the
   same step that derives assets/entity-graph.json and
   assets/person-words.json) walks reels/index.json once, at build time, and
   writes assets/reel-subjects.json: one entry per reel id that has a
   subject, `{ group, label }`. This file never touches lights/, tools/reels/
   or api/page.js again; it reads assets/reel-subjects.json the way
   api/page.js's own dictionary() reads assets/dict-index.json, and
   vercel.json's includeFiles for api/insights.js, api/house.js and
   api/warm.js now name it explicitly, so the three functions that can reach
   this code all carry the one small file they need.

   The four kinds a subject exists for, computed by the derive script:
     reel:light  the card's id IS a Light's id (lights/all.json); its group
                 is the same first-shared-tag grouping api/page.js's own
                 groupOf gives the Light's own room.
     reel:verse  the card's id is "verse-<surah>-<ayah...>"; the surah number
                 is the subject, named with its transliteration.
     reel:word   the card's id is "word-<slug>"; the dictionary entry names
                 its own category.
     reel:short  a film's card carries `room`, "heroes.html#f-<field>"; the
                 field after f- is the subject.
   A Name, a Did you know, a This day and a du'a reel are not tied to one of
   these four rooms in the shelf's own data (a Did you know's source Light is
   kept in tools/reels/know.json, not in reels/index.json), so they carry no
   entry in the file and no subject here, rather than a guessed one. */
let REEL_SUBJECTS = null;
function reelSubjects() {
  if (REEL_SUBJECTS) return REEL_SUBJECTS;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(process.cwd(), "assets", "reel-subjects.json"), "utf8"));
    REEL_SUBJECTS = (j && j.subjects && typeof j.subjects === "object") ? j.subjects : {};
  } catch { REEL_SUBJECTS = {}; }
  return REEL_SUBJECTS;
}
export function subjectOf(kind, card) {
  if (!card || !card.id) return null;
  const s = reelSubjects()[card.id];
  return s ? { group: s.group, label: s.label } : null;
}

/* ---------------------------------------------------------------------------
   the records of the window: one entry per (post, network) that landed
--------------------------------------------------------------------------- */
const nowMsOf = now => { const t = now instanceof Date ? now.getTime() : (typeof now === "string" ? Date.parse(now) : now); return isFinite(t) && t ? t : Date.now(); };
export function datesBack(days, now) {
  const out = [];
  const t = nowMsOf(now);
  for (let i = 0; i < days; i++) out.push(new Date(t - i * 86400000).toISOString().slice(0, 10));
  return out;
}

export async function collect(days, opts = {}) {
  const read = opts.readSlot || readSlot;
  const dates = datesBack(Math.max(1, Math.min(60, Number(days) || 14)), opts.now);
  const wanted = [];
  for (const d of dates) for (const s of SLOT_IDS) wanted.push([d, s]);
  const recs = [];
  /* a few at a time: a hundred and forty single reads in a row is slow, a
     hundred and forty at once is rude to the store */
  for (let i = 0; i < wanted.length; i += 10) {
    const chunk = wanted.slice(i, i + 10);
    const got = await Promise.all(chunk.map(([d, s]) => read(d, s).catch(() => null)));
    got.forEach((r, k) => { if (r && r.results) recs.push({ ...r, date: chunk[k][0], slot: chunk[k][1] }); });
  }
  const posts = [];
  for (const r of recs) {
    const card = matchedCard(r, opts.manifest);
    const kind = card ? "reel:" + (card.kind || "light") : kindOf(r, opts.manifest);
    const media = {};
    for (const net of ["instagram", "facebook", "youtube", "threads"]) {
      const x = r.results[net];
      /* a card sent as a story only (social.cardsFeed off) carries the
         STORY's id: a story is gone in a day and answers under no post
         edge, so it is not read and not counted as a post */
      if (x && x.ok && x.id && !x.storyOnly) media[net] = String(x.id);
    }
    if (!Object.keys(media).length) continue;
    posts.push({ date: r.date, slot: r.slot, hour: hourOf(r.slot), kind, reel: REEL_SLOTS.includes(r.slot),
                 title: String(r.title || ""), at: r.at || "", media, subject: subjectOf(kind, card) });
  }
  return posts;
}

/* ---------------------------------------------------------------------------
   the cache
--------------------------------------------------------------------------- */
const parse = v => { if (!v) return null; try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return null; } };

export async function cacheRead(keys, opts = {}) {
  const store = opts.kv || kv;
  const ready = opts.kvReady || kvReady;
  if (!keys.length || !ready()) return keys.map(() => null);
  try { const r = await store([["MGET", ...keys]]); return (r[0] || []).map(parse); } catch { return keys.map(() => null); }
}
async function cacheWrite(key, val, opts = {}) {
  const store = opts.kv || kv;
  const ready = opts.kvReady || kvReady;
  if (!ready()) return;
  try { await store([["SET", key, JSON.stringify(val), "EX", String(30 * 86400)]]); } catch { }
}
/* `force` is the owner's hand on the button: a refusal is asked again at
   once rather than after its hour, because the reason for pressing Read again
   is usually that the reason for the refusal has just been fixed (a token
   with the permission it lacked). An answer that was read is still kept for
   its six hours; forcing never spends a call on a number already in hand. */
const rank = (x, force) => (force && x.c && x.c.error) ? -1 : (x.c && x.c.at ? Date.parse(x.c.at) : 0);
export const fresh = (c, nowMs, force) => {
  if (!c || !c.at) return false;
  const age = nowMs - Date.parse(c.at);
  return c.error ? (!force && age < ERR_MS) : age < CACHE_MS;
};

/* ---------------------------------------------------------------------------
   asking the networks
--------------------------------------------------------------------------- */
const metaErr = j => (j && j.error && (j.error.error_user_msg || j.error.message)) || "";
const metaCode = j => (j && j.error && j.error.code != null) ? Number(j.error.code) : null;
const permissionMissing = (code, msg) =>
  code === 10 || code === 200 || /permission|manage_insights/i.test(String(msg || ""));
const unknownMetric = (code, msg) => code === 100 || /metric|not supported|invalid parameter/i.test(String(msg || ""));

/* Meta's insight rows come as values[0].value or, on some, total_value.value */
function rows(j) {
  const out = {};
  for (const d of (j && Array.isArray(j.data) ? j.data : [])) {
    let v = null;
    if (d && Array.isArray(d.values) && d.values.length) v = d.values[0] && d.values[0].value;
    else if (d && d.total_value && d.total_value.value != null) v = d.total_value.value;
    if (typeof v === "number") out[d.name] = v;
  }
  return out;
}

/* no single Meta or YouTube call is left to hang past eight seconds: the
   night shift has one clock for everything it does, and a stuck fetch that
   never rejects on its own would otherwise spend the whole run waiting on
   one post while the rest of the batch, and the store write after it, never
   get their turn. */
const FETCH_TIMEOUT_MS = 8000;
async function timedFetch(fetcher, url, init) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try { return await (fetcher || fetch)(url, { ...init, signal: ac.signal }); }
  finally { clearTimeout(timer); }
}

async function graphGet(url, tok, fetcher) {
  const r = await timedFetch(fetcher, url, { headers: { authorization: "Bearer " + tok } });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

/* one Instagram media */
export async function fetchInstagram(id, reel, opts = {}) {
  const now = opts.now ? new Date(opts.now).toISOString() : new Date().toISOString();
  const tok = opts.igToken || igToken();
  if (!tok) return { at: now, error: "no Instagram token" };
  const G = graphBase(tok);
  const sets = reel ? [IG_METRICS.reel, IG_METRICS.reelBare] : [IG_METRICS.image, IG_METRICS.imageBare];
  let last = null;
  for (const set of sets) {
    let r;
    try { r = await graphGet(`${G}/${id}/insights?metric=${set.join(",")}`, tok, opts.fetch); }
    catch (e) { return { at: now, error: String(e && e.message || e).slice(0, 160) }; }
    if (r.ok) {
      const m = rows(r.j);
      return { at: now, reach: m.reach != null ? m.reach : null, views: m.views != null ? m.views : null,
               likes: m.likes, comments: m.comments, saved: m.saved, shares: m.shares,
               interactions: m.total_interactions, watch: m.ig_reels_avg_watch_time, metrics: set.join(",") };
    }
    const code = metaCode(r.j), msg = metaErr(r.j) || ("http " + r.status);
    if (permissionMissing(code, msg)) return { at: now, error: msg, code, needs: NEEDS_IG };
    last = { at: now, error: msg, code };
    if (!unknownMetric(code, msg)) break;
  }
  return last;
}

/* one Facebook post: reach is the unique media view, or impressions when
   the newer name is refused */
export async function fetchFacebook(id, opts = {}) {
  const now = opts.now ? new Date(opts.now).toISOString() : new Date().toISOString();
  const tok = opts.fbToken || await pageToken();
  if (!tok) return { at: now, error: "no Facebook token" };
  const learned = await fbMetricSet(id, tok, opts);
  if (learned && learned.needs) return { at: now, error: "Facebook refused the insights: " + learned.needs, code: 10 };
  const set = Array.isArray(learned) ? learned : [];
  const video = isVideoId(id);
  if (!set.length) return { at: now, error: "Meta accepts none of the " + (video ? "video" : "post") + " metrics the house knows; the names need a look", code: 100 };
  let r;
  try { r = await graphGet(`${GRAPH_FB}/${id}/${video ? "video_insights" : "insights"}?metric=${set.join(",")}`, tok, opts.fetch); }
  catch (e) { return { at: now, error: String(e && e.message || e).slice(0, 160) }; }
  if (r.ok) {
    const m = rows(r.j);
    return { at: now, reach: firstOf(m, video ? FBV_REACH : FB_REACH), views: firstOf(m, video ? FBV_VIEWS : FB_VIEWS),
             clicks: m.post_clicks != null ? m.post_clicks : null,
             likes: m.post_reactions_like_total != null ? m.post_reactions_like_total : null, metrics: set.join(",") };
  }
  const code = metaCode(r.j), msg = metaErr(r.j) || ("http " + r.status);
  /* a set that was accepted last week and is refused today is forgotten, so
     the next read learns again rather than failing for six more days */
  if (unknownMetric(code, msg)) { try { await cacheWrite(video ? K_FBVSET : K_FBSET, { at: new Date(0).toISOString(), set: [] }, opts); } catch { } }
  return { at: now, error: msg, code };
}

/* one Threads post: the six names above, one call, no fallback set (see the
   THREADS note at the top of the file for the source and the permission) */
export async function fetchThreads(id, opts = {}) {
  const now = opts.now ? new Date(opts.now).toISOString() : new Date().toISOString();
  const tok = opts.thToken || TH.token();
  if (!tok) return { at: now, error: "no Threads token" };
  let r;
  try { r = await graphGet(`${TH.API}/${id}/insights?metric=${TH_METRICS.join(",")}`, tok, opts.fetch); }
  catch (e) { return { at: now, error: String(e && e.message || e).slice(0, 160) }; }
  if (r.ok) {
    const m = rows(r.j);
    return { at: now, reach: null, views: m.views != null ? m.views : null,
             likes: m.likes != null ? m.likes : null, comments: m.replies != null ? m.replies : null,
             shares: m.shares != null ? m.shares : null, reposts: m.reposts, quotes: m.quotes, metrics: TH_METRICS.join(",") };
  }
  const code = metaCode(r.j), msg = metaErr(r.j) || ("http " + r.status);
  if (permissionMissing(code, msg)) return { at: now, error: msg, code, needs: NEEDS_TH };
  return { at: now, error: msg, code };
}

/* YouTube answers for up to fifty ids in one call */
export async function fetchYouTube(ids, opts = {}) {
  const now = opts.now ? new Date(opts.now).toISOString() : new Date().toISOString();
  const out = {};
  const fetcher = opts.fetch || fetch;
  let tok = opts.ytToken || "";
  if (!tok) {
    if (!YT.configured()) { ids.forEach(id => { out[id] = { at: now, error: "YouTube is not connected" }; }); return out; }
    const t = await YT.accessToken(fetcher).catch(e => ({ ok: false, err: String(e && e.message || e) }));
    if (!t.ok) { ids.forEach(id => { out[id] = { at: now, error: "YouTube token: " + t.err }; }); return out; }
    tok = t.token;
  }
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    let r, j;
    try {
      r = await timedFetch(fetcher, YT_VIDEOS + "?part=statistics&id=" + chunk.map(encodeURIComponent).join(","),
                        { headers: { authorization: "Bearer " + tok } });
      j = await r.json().catch(() => ({}));
    } catch (e) { chunk.forEach(id => { out[id] = { at: now, error: String(e && e.message || e).slice(0, 160) }; }); continue; }
    if (!r.ok) {
      const why = (j && j.error && (j.error.message || j.error.status)) || ("http " + r.status);
      chunk.forEach(id => { out[id] = { at: now, error: "YouTube refused: " + why }; });
      continue;
    }
    const seen = {};
    for (const it of (j && Array.isArray(j.items) ? j.items : [])) {
      const s = it.statistics || {};
      seen[it.id] = { at: now, reach: null, views: s.viewCount != null ? Number(s.viewCount) : null,
                      likes: s.likeCount != null ? Number(s.likeCount) : null, comments: s.commentCount != null ? Number(s.commentCount) : null };
    }
    chunk.forEach(id => { out[id] = seen[id] || { at: now, error: "YouTube lists no such video" }; });
  }
  return out;
}

/* ---------------------------------------------------------------------------
   a batch: the oldest cache first, forty media, inside the budget
--------------------------------------------------------------------------- */
export async function refresh(days, opts = {}) {
  const t0 = Date.now();
  const nowMs = nowMsOf(opts.now);
  const budget = opts.budgetMs || BUDGET_MS;
  const cap = opts.batch || BATCH;
  const posts = opts.posts || await collect(days, opts);
  const all = [];
  for (const p of posts) for (const net of Object.keys(p.media)) all.push({ net, id: p.media[net], key: K_INS(net, p.media[net]) });
  const cached = await cacheRead(all.map(x => x.key), opts);
  const due = all.map((x, i) => ({ ...x, c: cached[i] }))
    .filter(x => !fresh(x.c, nowMs, !!opts.force))
    /* oldest cache first; and when the owner forces, the refusals first of
       all, because they are what the press is about */
    .sort((a, b) => rank(a, !!opts.force) - rank(b, !!opts.force));
  const batch = due.slice(0, cap);
  const out = { ok: true, days, posts: posts.length, media: all.length, due: due.length, fetched: 0, errors: 0, partial: false };
  let needs = "", needsNet = "";
  const canIG = opts.igToken || igConfigured();
  const canFB = opts.fbToken || fbConfigured();
  const canTH = opts.thToken || TH.configured();

  /* YouTube first, because it is one call for all of them */
  const yt = batch.filter(x => x.net === "youtube");
  if (yt.length) {
    const got = await fetchYouTube(yt.map(x => x.id), opts);
    for (const x of yt) { const v = got[x.id] || { at: new Date(nowMs).toISOString(), error: "no answer" }; await cacheWrite(x.key, v, opts); out.fetched++; if (v.error) out.errors++; }
  }
  for (const x of batch) {
    if (x.net === "youtube") continue;
    if (Date.now() - t0 > budget) break;
    let v;
    if (x.net === "instagram") {
      if (!canIG) v = { at: new Date(nowMs).toISOString(), error: "Instagram is not configured" };
      else {
        const p = posts.find(q => q.media.instagram === x.id);
        v = await fetchInstagram(x.id, !!(p && p.reel), opts);
      }
      if (v && v.needs) { needs = v.needs; needsNet = "instagram"; break; }   /* not cached: fix the token and it reads at once */
    } else if (x.net === "facebook") {
      v = canFB ? await fetchFacebook(x.id, opts) : { at: new Date(nowMs).toISOString(), error: "Facebook is not configured" };
    } else if (x.net === "threads") {
      if (!canTH) v = { at: new Date(nowMs).toISOString(), error: "Threads is not configured" };
      else {
        v = await fetchThreads(x.id, opts);
        if (v && v.needs) { needs = v.needs; needsNet = "threads"; break; }   /* same stop, so a hundred refusals never queue up */
      }
    }
    await cacheWrite(x.key, v, opts);
    out.fetched++;
    if (v && v.error) out.errors++;
  }
  out.left = Math.max(0, due.length - out.fetched);
  out.partial = !needs && out.left > 0;
  out.ms = Date.now() - t0;
  if (needs) {
    out.needs = needs;
    out.say = needsNet === "threads"
      ? "The Threads token can post but cannot read what a post did: it was made without " + needs + ". " +
        "Open /api/threads?action=auth and authorise the app again; Meta will now ask you to approve the insights permission as well. " +
        "Paste the fresh TH_TOKEN it shows into Vercel, then redeploy and press Read again."
      : "The Instagram token can post but cannot read what a post did: it was made without " + needs + ". " +
        "Generate a new token with that permission added and paste it into Vercel as IG_TOKEN, then redeploy and press Read again.";
  }
  return out;
}

/* ---------------------------------------------------------------------------
   the arithmetic
--------------------------------------------------------------------------- */
export function median(xs) {
  const a = xs.filter(x => typeof x === "number" && isFinite(x)).sort((p, q) => p - q);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
export function mean(xs) {
  const a = xs.filter(x => typeof x === "number" && isFinite(x));
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
}
const r1 = x => x == null ? null : Math.round(x * 10) / 10;
const HH = h => String(h).padStart(2, "0") + ":00";

function bucket(list, keyOf) {
  const b = {};
  for (const it of list) {
    const k = keyOf(it);
    if (k == null) continue;
    (b[k] = b[k] || []).push(it);
  }
  return Object.keys(b).map(k => ({
    key: k, n: b[k].length,
    reach: { median: median(b[k].map(x => x.reach)), mean: r1(mean(b[k].map(x => x.reach))) },
    views: { median: median(b[k].map(x => x.views)), mean: r1(mean(b[k].map(x => x.views))) },
    items: b[k]
  }));
}

/* posts: what collect() returns, each with .ins = { instagram: {...}, ... } */
export function aggregate(posts) {
  /* the Instagram reading is what the kinds and hours are judged by: it is
     the network that shows a reel to people who do not follow the account */
  const ig = [];
  const perNet = { instagram: [], facebook: [], youtube: [], threads: [] };
  const top = [];
  let read = 0, unread = 0, refused = 0;
  /* what each network said when it refused, once per network and counted,
     so "45 refused" is never all the console can say about it */
  const refusedBy = {};
  for (const p of posts) {
    const ins = p.ins || {};
    for (const net of Object.keys(p.media)) {
      const v = ins[net];
      if (!v) { unread++; continue; }
      if (v.error) {
        refused++;
        const r = refusedBy[net] || (refusedBy[net] = { n: 0, said: String(v.error).slice(0, 160), code: v.code || null });
        r.n++;
        continue;
      }
      read++;
      const row = { date: p.date, slot: p.slot, hour: p.hour, kind: p.kind, title: p.title, net, id: p.media[net], subject: p.subject || null,
                    reach: v.reach != null ? v.reach : null, views: v.views != null ? v.views : null,
                    likes: v.likes, comments: v.comments, saved: v.saved, shares: v.shares };
      row.url = net === "youtube" ? "https://youtube.com/shorts/" + p.media[net] : "";
      (perNet[net] = perNet[net] || []).push(row);
      if (net === "instagram") ig.push(row);
      /* the top list is ranked by reach; YouTube gives no reach, its views stand in and are named as such */
      const measure = row.reach != null ? "reach" : (row.views != null ? "views" : "");
      if (measure) top.push({ ...row, measure, n: measure === "reach" ? row.reach : row.views });
    }
  }
  const byKind = bucket(ig, x => x.kind).map(b => ({ kind: b.key, label: kindLabel(b.key), n: b.n, reach: b.reach, views: b.views }))
    .sort((a, b) => (b.reach.median || 0) - (a.reach.median || 0));
  const byHour = bucket(ig, x => x.hour).map(b => ({ hour: Number(b.key), label: HH(b.key), n: b.n, reach: b.reach, views: b.views }))
    .sort((a, b) => a.hour - b.hour);
  const byFamily = bucket(ig, x => String(x.kind).split(":")[0]).map(b => ({ key: b.key, n: b.n, reach: b.reach, views: b.views }));
  const byNetwork = Object.keys(perNet).filter(k => perNet[k].length).map(k => {
    const rowsN = perNet[k];
    return { net: k, n: rowsN.length,
             reach: { median: median(rowsN.map(x => x.reach)), mean: r1(mean(rowsN.map(x => x.reach))) },
             views: { median: median(rowsN.map(x => x.views)), mean: r1(mean(rowsN.map(x => x.views))) },
             likes: { median: median(rowsN.map(x => x.likes)) } };
  });
  /* the subject fold: Instagram's reels with a derivable subject (light,
     verse, word or film, subjectOf above), bucketed by that subject rather
     than by kind. The top ten and bottom five are a plain list, not a
     sentence, so they carry no MIN_BUCKET floor of their own -- the same as
     the top ten by reach above; only a generalisation drawn across a whole
     bucket (the sentence below) needs five posts under it. */
  const igSubj = ig.filter(x => x.subject && x.reach != null);
  const bySubject = bucket(igSubj, x => x.subject.group)
    .map(b => ({ group: b.key, label: b.items[0].subject.label, n: b.n, reach: b.reach, views: b.views }))
    .sort((a, b) => (b.reach.median || 0) - (a.reach.median || 0));
  const bySubjSorted = igSubj.slice().sort((a, b) => b.reach - a.reach);
  const subjectRow = r => ({ title: r.title, subject: r.subject.label, reach: r.reach, date: r.date, slot: r.slot, at: HH(r.hour) });
  const subjectTop = bySubjSorted.slice(0, 10).map(subjectRow);
  /* a refuter's review caught this: top takes the first ten, bottom (before
     the reverse) takes the last five, and those two ranges overlap for any
     list shorter than fifteen -- with, say, six subject-bearing posts the
     "Weakest" list would just repeat the "Best" one in reverse order. Below
     fifteen there is nothing distinct left to call weakest, so the list is
     left empty rather than shown misleadingly. */
  const subjectBottom = bySubjSorted.length >= 15 ? bySubjSorted.slice(-5).reverse().map(subjectRow) : [];
  top.sort((a, b) => b.n - a.n);
  return {
    posts: posts.length, read, unread, refused, refusedBy,
    byKind, byHour, byNetwork, byFamily, bySubject, subjectTop, subjectBottom,
    top: top.slice(0, 10).map(t => ({ title: t.title, kind: t.kind, label: kindLabel(t.kind), hour: t.hour, at: HH(t.hour), net: t.net,
                                       id: t.id, url: t.url, measure: t.measure, n: t.n, reach: t.reach, views: t.views, date: t.date, slot: t.slot })),
    sentences: sentences({ byKind, byHour, byNetwork, byFamily, bySubject, read })
  };
}

/* ---------------------------------------------------------------------------
   what this says

   Only a sentence the numbers support, and none from a bucket of fewer than
   five: two posts do not make a pattern, and a rota moved on the strength of
   two posts is a rota moved by weather.
--------------------------------------------------------------------------- */
const x = (a, b) => (b > 0 ? Math.round((a / b) * 10) / 10 : null);
export function sentences(agg) {
  const out = [];
  const enough = b => b.n >= MIN_BUCKET && b.reach.median != null;
  const kinds = (agg.byKind || []).filter(enough);
  if (kinds.length >= 2) {
    const best = kinds[0], worst = kinds[kinds.length - 1];
    const ratio = x(best.reach.median, worst.reach.median);
    if (ratio != null && ratio >= 1.2)
      out.push(`${cap(best.label)} reach ${ratio}× the median of ${worst.label} (${fmt(best.reach.median)} against ${fmt(worst.reach.median)}, ${best.n} and ${worst.n} posts).`);
    else if (ratio != null)
      out.push(`The kinds reach about the same: ${kinds.map(k => `${k.label} ${fmt(k.reach.median)}`).join(", ")}.`);
  }
  const fam = (agg.byFamily || []).filter(enough);
  const reels = fam.find(f => f.key === "reel"), cards = fam.find(f => f.key === "card");
  if (reels && cards) {
    const rr = x(reels.reach.median, cards.reach.median);
    if (rr != null && rr >= 1.2) out.push(`Reels reach ${rr}× the median of cards (${fmt(reels.reach.median)} against ${fmt(cards.reach.median)}).`);
    else if (rr != null && rr <= 1 / 1.2) out.push(`Cards reach ${x(cards.reach.median, reels.reach.median)}× the median of reels (${fmt(cards.reach.median)} against ${fmt(reels.reach.median)}).`);
  }
  const hours = (agg.byHour || []).filter(enough);
  if (hours.length >= 2) {
    const sorted = hours.slice().sort((a, b) => b.reach.median - a.reach.median);
    const hi = sorted[0], lo = sorted[sorted.length - 1];
    if (x(hi.reach.median, lo.reach.median) >= 1.2) {
      out.push(`The ${hi.label} slot reaches most (median ${fmt(hi.reach.median)} over ${hi.n} posts).`);
      out.push(`The ${lo.label} slot reaches least (median ${fmt(lo.reach.median)} over ${lo.n} posts).`);
    } else out.push(`No hour stands out yet: the medians sit between ${fmt(lo.reach.median)} and ${fmt(hi.reach.median)}.`);
  }
  const nets = (agg.byNetwork || []).filter(enough);
  const igN = nets.find(n => n.net === "instagram"), fbN = nets.find(n => n.net === "facebook");
  if (igN && fbN) {
    const r = x(igN.reach.median, fbN.reach.median);
    if (r != null && r >= 1.2) out.push(`Instagram reaches ${r}× Facebook's median.`);
    else if (r != null && r <= 1 / 1.2) out.push(`Facebook reaches ${x(fbN.reach.median, igN.reach.median)}× Instagram's median.`);
    else if (r != null) out.push(`Instagram and Facebook reach about the same.`);
  }
  /* the subjects (masterplan section 12): which surah, which Light's group,
     which dictionary category, which field of the achievements room, is
     what a next production batch actually needs to hear */
  const subs = (agg.bySubject || []).filter(enough);
  if (subs.length >= 2) {
    const best = subs[0], worst = subs[subs.length - 1];
    const ratio = x(best.reach.median, worst.reach.median);
    if (ratio != null && ratio >= 1.2)
      out.push(`Among the subjects with enough posts, ${best.label} reach ${ratio}× the median of ${worst.label} (${fmt(best.reach.median)} against ${fmt(worst.reach.median)}, ${best.n} and ${worst.n} posts).`);
    else if (ratio != null)
      out.push(`No subject stands out yet: the medians sit between ${fmt(worst.reach.median)} and ${fmt(best.reach.median)}.`);
  }
  if (!out.length) out.push(`Not enough yet: ${agg.read || 0} readings so far, and a sentence needs ${MIN_BUCKET} posts in a bucket.`);
  return out;
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = n => n == null ? "·" : Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

/* ---------------------------------------------------------------------------
   the read: records plus whatever the cache already holds; no network call
--------------------------------------------------------------------------- */
export async function read(days, opts = {}) {
  const posts = opts.posts || await collect(days, opts);
  const all = [];
  for (const p of posts) for (const net of Object.keys(p.media)) all.push({ p, net, key: K_INS(net, p.media[net]) });
  const cached = await cacheRead(all.map(x => x.key), opts);
  all.forEach((x, i) => { if (cached[i]) (x.p.ins = x.p.ins || {})[x.net] = cached[i]; });
  const nowMs = nowMsOf(opts.now);
  const stale = all.filter((x, i) => !fresh(cached[i], nowMs)).length;
  const latest = cached.filter(Boolean).map(c => Date.parse(c.at)).filter(isFinite).sort((a, b) => b - a)[0];
  const agg = aggregate(posts);
  const out = { ok: true, days, media: all.length, stale, readAt: latest ? new Date(latest).toISOString() : null, ...agg };
  /* a refusal for want of the permission is not cached, so the read cannot
     see it; the console learns it from the refresh. What the read can say is
     that nothing has been read at all. */
  if (!all.length) out.note = "No post of the last " + days + " days carries a network id yet.";
  return out;
}

/* ---------------------------------------------------------------------------
   THE DAILY SNAPSHOT (masterplan step 8)

   Everything above answers "what does the cache hold right now" -- a
   photograph of this moment, good for six hours and then retaken. A rota fed
   by "now" cannot tell a Friday from a Monday, because the photograph of
   Friday is gone by the time Monday asks. This takes one photograph a day
   instead and keeps it: nsoc:stats:<date>#<slot>, a small record of its own
   (kind, hour, title, and a `stats` map of what each live network said),
   thirty of them kept per slot before Redis lets the oldest go.

   A separate key, not a rewrite of nsoc:slot:<date>#<slot>: the poster
   (api/social.js) owns that record, writes to it on its own cron every hour,
   and keeps a ledger keyed off its shape; reading it back here and writing a
   `stats` field onto it would mean this file and the poster's could race on
   the same key, and this file must not touch the poster's own writing.

   THE WALK is bounded twice over: SNAPSHOT_DAYS worth of slots, oldest date
   first, and a clock -- stop at the budget, however far the walk got, and
   say so with partial: true, so whatever calls this (the console's Refresh,
   or the nightly warm run) can call it again rather than wait on one run to
   finish everything. A slot already snapshotted today is skipped, not
   re-read, unless opts.force asks for it again -- the same idempotence the
   owner's Read again button already leans on above. */
export const K_STATS = (date, slot) => "nsoc:stats:" + date + "#" + slot;
export const SNAPSHOT_DAYS = 14;
export const SNAPSHOT_KEEP_DAYS = 30;
export const SNAPSHOT_BUDGET_MS = 40000;

/* one network's answer, folded to the one shape every network's row keeps in
   the snapshot: views, reach, likes, comments, shares, saves, watch (only
   when a metric actually gave it) and when it was asked */
function statRow(v, atIso) {
  if (!v) return { error: "no answer", at: atIso };
  if (v.error) return { error: String(v.error).slice(0, 200), code: v.code, at: v.at || atIso };
  return { views: v.views != null ? v.views : null, reach: v.reach != null ? v.reach : null,
           likes: v.likes != null ? v.likes : null, comments: v.comments != null ? v.comments : null,
           shares: v.shares != null ? v.shares : null, saves: v.saved != null ? v.saved : null,
           watch: v.watch != null ? v.watch : null, at: v.at || atIso };
}
/* YT.ytStats answers viewCount/likeCount/commentCount/duration, not the
   reach/shares/saves the two Meta networks can give; a Short has no reach
   metric at all (fetchYouTube, above, has never had one either) and no
   retention figure comes back from videos.list, so watch stays null rather
   than standing in for something it is not */
function statRowYT(v, atIso) {
  if (!v) return { error: "no answer", at: atIso };
  if (v.error) return { error: String(v.error).slice(0, 200), at: atIso };
  return { views: v.viewCount != null ? v.viewCount : null, reach: null,
           likes: v.likeCount != null ? v.likeCount : null, comments: v.commentCount != null ? v.commentCount : null,
           shares: null, saves: null, watch: null, at: atIso };
}

export async function snapshot(opts = {}) {
  const t0 = Date.now();
  const read = opts.readSlot || readSlot;
  const nowMs = nowMsOf(opts.now);
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const budget = opts.budgetMs != null ? opts.budgetMs : SNAPSHOT_BUDGET_MS;
  const dates = datesBack(Math.max(1, Math.min(30, Number(opts.days) || SNAPSHOT_DAYS)), opts.now);
  const wanted = [];
  for (const d of dates) for (const s of SLOT_IDS) wanted.push([d, s]);

  const out = { ok: true, date: today, days: dates.length, slots: wanted.length, walked: 0, written: 0, skipped: 0, errors: 0, partial: false };

  const canIG = opts.igToken || igConfigured();
  const canFB = opts.fbToken || fbConfigured();
  const canTH = opts.thToken || TH.configured();
  let ytToken = opts.ytToken || "";
  if (!ytToken && YT.configured()) {
    const t = await YT.accessToken(opts.fetch).catch(e => ({ ok: false, err: String(e && e.message || e) }));
    if (t.ok) ytToken = t.token;
  }

  /* the token exchange above is a network call this file does not time (it
     lives in _youtube.js); if it alone ran the clock out, the store is
     never touched at all, rather than paying for a batched read the budget
     has no room left to use */
  if (Date.now() - t0 > budget) { out.partial = true; out.ms = Date.now() - t0; return out; }

  /* two batch reads, not one per slot: a hundred and twenty six round trips
     to the store before a single network is asked would be its own kind of
     slow, the same reasoning collect() gives above for the poster's records */
  const recs = [];
  for (let i = 0; i < wanted.length; i += 10) {
    const chunk = wanted.slice(i, i + 10);
    const got = await Promise.all(chunk.map(([d, s]) => read(d, s).catch(() => null)));
    got.forEach(r => recs.push(r));
  }
  const prior = await cacheRead(wanted.map(([d, s]) => K_STATS(d, s)), opts);
  for (let n = 0; n < wanted.length; n++) {
    if (Date.now() - t0 > budget) { out.partial = true; break; }
    const [d, s] = wanted[n];
    out.walked++;
    const rec = recs[n];
    if (!rec || !rec.results) continue;

    const already = prior[n] && prior[n].at && String(prior[n].at).slice(0, 10) === today;
    if (already && !opts.force) { out.skipped++; continue; }

    const atIso = new Date(nowMs).toISOString();
    const stats = {};
    const ig = rec.results.instagram;
    if (ig && ig.ok && ig.id && !ig.storyOnly)
      stats.instagram = canIG ? statRow(await fetchInstagram(ig.id, REEL_SLOTS.includes(s), opts), atIso)
                               : { error: "Instagram is not configured", at: atIso };
    const fb = rec.results.facebook;
    if (fb && fb.ok && fb.id && !fb.storyOnly)
      stats.facebook = canFB ? statRow(await fetchFacebook(fb.id, opts), atIso)
                              : { error: "Facebook is not configured", at: atIso };
    const th = rec.results.threads;
    if (th && th.ok && th.id)
      stats.threads = canTH ? statRow(await fetchThreads(th.id, opts), atIso)
                             : { error: "Threads is not configured", at: atIso };
    const yt = rec.results.youtube;
    const ytWanted = [];
    if (yt && yt.ok && yt.id) ytWanted.push(["youtube", yt.id]);
    if (yt && yt.wide && yt.wide.id) ytWanted.push(["youtubeWide", yt.wide.id]);
    if (ytWanted.length) {
      if (ytToken) {
        const got = await YT.ytStats(ytWanted.map(x => x[1]), ytToken, opts);
        for (const [key, id] of ytWanted) stats[key] = statRowYT(got[id], atIso);
      } else for (const [key] of ytWanted) stats[key] = { error: "YouTube is not connected", at: atIso };
    }
    if (!Object.keys(stats).length) continue;

    for (const k of Object.keys(stats)) if (stats[k].error) out.errors++;
    /* date and slot forced from the walk's own loop, not trusted from the
       record: the same defensiveness collect() keeps above, for a record
       whatever shape an older write left it in */
    const kind = kindOf({ ...rec, date: d, slot: s }, opts.manifest);
    const record = { date: d, slot: s, hour: hourOf(s), kind, reel: REEL_SLOTS.includes(s),
                      title: String(rec.title || ""), at: atIso, stats };
    try {
      const store = opts.kv || kv;
      if ((opts.kvReady || kvReady)()) {
        await store([["SET", K_STATS(d, s), JSON.stringify(record), "EX", String(SNAPSHOT_KEEP_DAYS * 86400)]]);
        out.written++;
      }
    } catch { }
  }
  out.ms = Date.now() - t0;
  return out;
}

/* ---------------------------------------------------------------------------
   THE NUMBERS (masterplan step 8)

   What the daily snapshots above add up to: this week against the seven
   days before it, per network, per kind, per weekday and per slot hour, so
   the console can show the owner a trend and not just a photograph. Every
   figure here is read from nsoc:stats:*, never the network -- no call
   leaves the building for this action, the same restraint read() keeps
   above it. */
const WEEKDAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NET_LABEL = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", threads: "Threads" };
const sum = xs => { const a = xs.filter(x => typeof x === "number" && isFinite(x)); return a.length ? a.reduce((s, x) => s + x, 0) : null; };
function weekBucket(rows) {
  let eng = 0, base = 0;
  for (const r of rows) {
    eng += (r.likes || 0) + (r.comments || 0) + (r.shares || 0) + (r.saves || 0);
    base += r.reach != null ? r.reach : (r.views != null ? r.views : 0);
  }
  return { posts: rows.length, views: sum(rows.map(r => r.views)), reach: sum(rows.map(r => r.reach)),
           engagement: base > 0 ? Math.round((eng / base) * 1000) / 1000 : null };
}
/* a week with nothing at all the week before is not a change of zero, it is
   nothing to compare against; "new" says that in the console instead of a
   blank dash that reads as "no data" for every other reason too */
const delta1 = (av, bv, noPrior, round) => {
  if (av == null) return null;
  if (bv == null) return noPrior ? "new" : null;
  const d = av - bv;
  return round ? Math.round(d * 1000) / 1000 : d;
};
const bucketDelta = (a, b) => {
  const noPrior = !b.posts;
  return {
    posts: a.posts - b.posts,
    views: delta1(a.views, b.views, noPrior),
    reach: delta1(a.reach, b.reach, noPrior),
    engagement: delta1(a.engagement, b.engagement, noPrior, true)
  };
};
function sideBySide(thisRows, lastRows, keyOf, labelOf) {
  const put = (rows, into) => { for (const r of rows) { const k = keyOf(r); if (k == null) continue; (into[k] = into[k] || []).push(r); } };
  const t = {}, l = {}; put(thisRows, t); put(lastRows, l);
  const keys = new Set([...Object.keys(t), ...Object.keys(l)]);
  return [...keys].map(k => {
    const tw = weekBucket(t[k] || []), lw = weekBucket(l[k] || []);
    return { key: k, label: labelOf ? labelOf(k, t[k] || l[k]) : k, thisWeek: tw, lastWeek: lw, delta: bucketDelta(tw, lw) };
  });
}

export async function numbers(opts = {}) {
  const dates = datesBack(14, opts.now);              /* dates[0] is today, dates[6..13] is the week before */
  const keys = [];
  for (const d of dates) for (const s of SLOT_IDS) keys.push(K_STATS(d, s));
  const recs = await cacheRead(keys, opts);

  const rowsThis = [], rowsLast = [], films = [];
  let read = 0, unread = 0;
  recs.forEach((rec, i) => {
    const d = dates[Math.floor(i / SLOT_IDS.length)];
    if (!rec || !rec.stats) { unread++; return; }
    const thisWeek = dates.indexOf(d) < 7;
    const weekday = new Date(d + "T00:00:00Z").getUTCDay();
    /* the wide upload beside a short's own Short is the same post, not a
       second one: its views are folded into the "youtube" row below rather
       than counted as a row of its own, so byKind/byWeekday/bySlot (which
       group by kind, weekday and slot, none of them net) count that slot
       once, the same as byNetwork already did */
    const wideStat = rec.stats.youtubeWide;
    const flat = [];
    for (const net of Object.keys(rec.stats)) {
      const v = rec.stats[net];
      if (!v || v.error) continue;
      read++;
      if (net === "youtubeWide") continue;
      const views = (net === "youtube" && wideStat && !wideStat.error) ? sum([v.views, wideStat.views]) : v.views;
      flat.push({ net, kind: rec.kind, hour: rec.hour, weekday, date: d, slot: rec.slot, title: rec.title,
                  views, reach: v.reach, likes: v.likes, comments: v.comments, shares: v.shares, saves: v.saves });
    }
    (thisWeek ? rowsThis : rowsLast).push(...flat);
    if (rec.kind === "reel:short" && flat.length)
      films.push({ date: d, slot: rec.slot, title: rec.title, week: thisWeek ? "this" : "last", stats: rec.stats });
  });

  /* rowsThis/rowsLast already fold the wide upload's views into its Short's
     own "youtube" row, above, so no remap is needed here */
  const byNetwork = sideBySide(rowsThis, rowsLast, r => r.net)
    .sort((a, b) => (b.thisWeek.posts) - (a.thisWeek.posts));
  /* "per kind" here means the reel kinds and the silent films, the choices
     the rota actually makes; a dawn card and a verse reel are not the same
     kind of thing to compare, so the five card slots stay out of this one
     bucket (they still count in byNetwork, byWeekday and bySlot below) */
  const reelRows = rows => rows.filter(r => String(r.kind).startsWith("reel:"));
  const byKind = sideBySide(reelRows(rowsThis), reelRows(rowsLast), r => r.kind, k => kindLabel(k))
    .sort((a, b) => (b.thisWeek.engagement || 0) - (a.thisWeek.engagement || 0));
  const byWeekday = sideBySide(rowsThis, rowsLast, r => r.weekday, w => WEEKDAY_LABEL[w]).sort((a, b) => Number(a.key) - Number(b.key));
  const bySlot = sideBySide(rowsThis, rowsLast, r => r.slot, (s, rows) => hourOf(s) != null ? HH(hourOf(s)) : s).sort((a, b) => (hourOf(a.key) || 0) - (hourOf(b.key) || 0));

  const ranked = byKind.filter(k => k.thisWeek.engagement != null);
  const best = ranked[0] || null;
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  return {
    ok: true, thisWeek: { from: dates[6], to: dates[0] }, lastWeek: { from: dates[13], to: dates[7] },
    byNetwork: byNetwork.map(x => ({ net: x.key, label: NET_LABEL[x.key] || x.key, thisWeek: x.thisWeek, lastWeek: x.lastWeek, delta: x.delta })),
    byKind: byKind.map(x => ({ kind: x.key, label: x.label, thisWeek: x.thisWeek, lastWeek: x.lastWeek, delta: x.delta })),
    byWeekday: byWeekday.map(x => ({ weekday: Number(x.key), label: x.label, thisWeek: x.thisWeek, lastWeek: x.lastWeek, delta: x.delta })),
    bySlot: bySlot.map(x => ({ slot: x.key, hour: hourOf(x.key), label: x.label, thisWeek: x.thisWeek, lastWeek: x.lastWeek, delta: x.delta })),
    best: best && { kind: best.key, label: best.label, engagement: best.thisWeek.engagement },
    worst: worst && { kind: worst.key, label: worst.label, engagement: worst.thisWeek.engagement },
    films, read, unread,
    missingToken: { instagram: !(opts.igToken || igConfigured()), facebook: !(opts.fbToken || fbConfigured()), youtube: !YT.configured(), threads: !(opts.thToken || TH.configured()) }
  };
}
