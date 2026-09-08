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
   for a YouTube Short GET videos?part=statistics. Nothing here is computed
   from anything the house made up: a number is Meta's or Google's, or it is
   absent and the post is counted as "not read".

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
   column, not the read. The Facebook post metrics are the ones Meta's own
   changelog leaves standing after June 2026 (post_total_media_view_unique
   for reach, post_impressions, post_clicks, post_reactions_like_total); the
   same fallback covers them.

   THE PERMISSION. An Instagram token made for publishing may lack
   instagram_manage_insights. Meta answers code 10 or 200, or names the
   permission in its sentence. That is detected on the first media, the
   batch stops, and the owner is told what to generate rather than being
   shown a hundred and forty refusals.
--------------------------------------------------------------------------- */
import { kv, kvReady } from "./_kv.js";
import { SLOTS, SLOT_IDS, REEL_SLOTS, chooseReel } from "./_schedule.js";
import { readSlot, igToken, graphBase, pageToken, igConfigured, fbConfigured } from "./social.js";
import * as YT from "./_youtube.js";

export const K_INS = (net, id) => "nsoc:ins:" + net + ":" + id;
export const CACHE_MS = 6 * 3600 * 1000;      /* an answer is good for six hours */
export const ERR_MS = 3600 * 1000;            /* a refusal is asked again after one */
export const BATCH = 40;                      /* media per call */
export const BUDGET_MS = 42000;               /* of the sixty seconds, leaving room to answer */
export const MIN_BUCKET = 5;                  /* a sentence needs this many in a bucket */
export const NEEDS_IG = "instagram_manage_insights";

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
  full: ["post_total_media_view_unique", "post_impressions", "post_clicks", "post_reactions_like_total"],
  bare: ["post_impressions", "post_clicks", "post_reactions_like_total"]
};

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
  "reel:day": "This day reels", "reel:light": "day's-card reels", "reel:codex": "Codex reels", "reel:reel": "reels",
  "card:dawn": "dawn cards", "card:light": "day's cards", "card:word": "word cards", "card:dusk": "chapter cards", "card:lead": "coming-up cards"
};
export const kindLabel = k => KIND_LABEL[k] || String(k || "").replace(/^(reel|card):/, "");
export const hourOf = slot => { const s = SLOTS.find(x => x.id === slot); return s ? s.at : null; };
const halfOf = slot => (SLOTS.find(x => x.id === slot) || {}).reel || "";

export function kindOf(rec, manifest) {
  const slot = rec && rec.slot;
  if (!REEL_SLOTS.includes(slot)) return "card:" + slot;
  const cards = (manifest && Array.isArray(manifest.cards)) ? manifest.cards : [];
  const title = String(rec.title || "").trim();
  if (title) {
    const hit = cards.find(c => c && String(c.hook || "").trim() === title);
    if (hit) return "reel:" + (hit.kind || "light");
  }
  if (cards.length && rec.date) {
    const c = chooseReel(cards, rec.date, halfOf(slot), null);
    if (c) return "reel:" + (c.kind || "light");
  }
  return "reel:reel";
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
    const kind = kindOf(r, opts.manifest);
    const media = {};
    for (const net of ["instagram", "facebook", "youtube"]) {
      const x = r.results[net];
      if (x && x.ok && x.id) media[net] = String(x.id);
    }
    if (!Object.keys(media).length) continue;
    posts.push({ date: r.date, slot: r.slot, hour: hourOf(r.slot), kind, reel: REEL_SLOTS.includes(r.slot),
                 title: String(r.title || ""), at: r.at || "", media });
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

async function graphGet(url, tok, fetcher) {
  const r = await (fetcher || fetch)(url, { headers: { authorization: "Bearer " + tok } });
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
  let last = null;
  for (const set of [FB_METRICS.full, FB_METRICS.bare]) {
    let r;
    try { r = await graphGet(`${GRAPH_FB}/${id}/insights?metric=${set.join(",")}`, tok, opts.fetch); }
    catch (e) { return { at: now, error: String(e && e.message || e).slice(0, 160) }; }
    if (r.ok) {
      const m = rows(r.j);
      return { at: now, reach: m.post_total_media_view_unique != null ? m.post_total_media_view_unique : null,
               views: m.post_impressions != null ? m.post_impressions : null,
               clicks: m.post_clicks, likes: m.post_reactions_like_total, metrics: set.join(",") };
    }
    const code = metaCode(r.j), msg = metaErr(r.j) || ("http " + r.status);
    last = { at: now, error: msg, code };
    if (!unknownMetric(code, msg)) break;
  }
  return last;
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
      r = await fetcher(YT_VIDEOS + "?part=statistics&id=" + chunk.map(encodeURIComponent).join(","),
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
  let needs = "";
  const canIG = opts.igToken || igConfigured();
  const canFB = opts.fbToken || fbConfigured();

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
      if (v && v.needs) { needs = v.needs; break; }   /* not cached: fix the token and it reads at once */
    } else if (x.net === "facebook") {
      v = canFB ? await fetchFacebook(x.id, opts) : { at: new Date(nowMs).toISOString(), error: "Facebook is not configured" };
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
    out.say = "The Instagram token can post but cannot read what a post did: it was made without " + needs + ". " +
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
  const perNet = { instagram: [], facebook: [], youtube: [] };
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
      const row = { date: p.date, slot: p.slot, hour: p.hour, kind: p.kind, title: p.title, net, id: p.media[net],
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
  top.sort((a, b) => b.n - a.n);
  return {
    posts: posts.length, read, unread, refused, refusedBy,
    byKind, byHour, byNetwork, byFamily,
    top: top.slice(0, 10).map(t => ({ title: t.title, kind: t.kind, label: kindLabel(t.kind), hour: t.hour, at: HH(t.hour), net: t.net,
                                       id: t.id, url: t.url, measure: t.measure, n: t.n, reach: t.reach, views: t.views, date: t.date, slot: t.slot })),
    sentences: sentences({ byKind, byHour, byNetwork, byFamily, read })
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
