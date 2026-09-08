/* NOOR · the flow
   ===========================================================================
   Where the energy goes. A funnel the console can draw: posts made, the
   people they reached, what was watched, the clicks that came back to the
   site, the readers who arrived, the pages they read, and the few who left a
   gift, a du'a, or stayed as a guardian.

   THE ONE RULE. Every number here comes from a record that exists: a slot
   record, the insights cache, the beacon's counters, Stripe's own charges and
   sessions. Nothing is modelled, nothing is scaled, nothing is estimated from
   something else. A stage the house cannot measure carries `value: null` and
   `unread: true`, and the reason is written in `notes` in a sentence.

   THE TWO THINGS THAT TURNED OUT NOT TO EXIST, said here rather than faked:

   · CLICKS ARE ATTRIBUTED BY MONTH, NOT BY DAY. api/beacon.js counts a
     referrer once per person per day into `nm:<YYYY-MM>:s:<source>`, a key
     per month. So the house does know that a reader came from Instagram; it
     does not know which day they came, and a fortnight cannot be cut out of a
     month's counter. The stage carries `attribution: "month"` and names the
     months it summed. Only when the store holds no source counter at all is
     the attribution "none".

   · A RETURNING READER IS NOT COUNTED AT ALL. The beacon is cookieless and
     keeps no identifier, so "the same person, twice" is a thing it cannot
     know by design. `nv:<date>:people` is first-ping-of-the-day, not people
     the house recognises. There is no returning-reader stage and there is a
     note saying why.

   Everything is injected, so tests run with no store, no Stripe and no
   network. Fifteen minutes of cache, and ?fresh=1 goes round it.
--------------------------------------------------------------------------- */

import { kv, kvReady } from "./_kv.js";
import { collect, cacheRead, K_INS } from "./_insights.js";
import { computeLedger } from "./ledger.js";

export const K_FLOW = days => "nsoc:flow:" + days;
export const CACHE_MS = 15 * 60 * 1000;
export const MAX_DAYS = 30;
export const DEFAULT_DAYS = 14;
/* Stripe is walked one sequential page of a hundred at a time and the funnel
   is drawn inside a request that cannot sit there all afternoon, so every walk
   here stops at a few pages or a few seconds, whichever comes first. A walk
   that stopped early is `partial`, and a stage built on a partial walk is
   unread rather than a number that is quietly too small: the ONE RULE above
   allows an absence and does not allow an under-count worn as a total. */
export const MAX_PAGES = 5;
export const READ_MS = 6000;

/* the networks the beacon can name a referrer as, in the spelling api/beacon.js
   writes them. Anything else it saw is not one of ours and is not summed. */
export const CLICK_NETS = ["instagram", "facebook", "youtube", "telegram", "pinterest", "x", "linkedin", "reddit", "tiktok"];
export const INSIGHT_NETS = ["instagram", "facebook", "youtube"];

const iso = t => new Date(t).toISOString().slice(0, 10);
const nowMsOf = now => { const t = now instanceof Date ? now.getTime() : (typeof now === "string" ? Date.parse(now) : now); return isFinite(t) && t ? t : Date.now(); };
export function daysBack(days, now) {
  const out = [], t = nowMsOf(now);
  for (let i = 0; i < days; i++) out.push(iso(t - i * 86400000));
  return out.reverse();
}
const num = x => { const n = parseInt(x, 10); return Number.isFinite(n) ? n : null; };
const sum = xs => xs.reduce((t, x) => t + (Number(x) || 0), 0);
/* a rate is only a rate when both ends are real numbers and the top is not zero */
const rate = (to, from) => (typeof to === "number" && typeof from === "number" && from > 0) ? Math.round((to / from) * 1000) / 1000 : null;

/* ---------------------------------------------------------------------------
   the stages, one reader each
--------------------------------------------------------------------------- */

/* posts made, by network, from the slot records themselves */
export async function postsMade(days, opts = {}) {
  const posts = opts.posts || await collect(days, opts);
  const by = {};
  let total = 0;
  for (const p of posts) {
    total++;
    for (const net of Object.keys(p.media || {})) by[net] = (by[net] || 0) + 1;
  }
  return { total, by, posts };
}

/* reach and views, per network, summed out of the insights cache. A network
   whose cache holds nothing is unread, and unread is not zero. */
export async function watched(posts, opts = {}) {
  const media = [];
  for (const p of posts) for (const net of Object.keys(p.media || {})) media.push({ net, id: p.media[net], key: K_INS(net, p.media[net]) });
  const got = media.length ? await (opts.cacheRead || cacheRead)(media.map(m => m.key), opts) : [];
  const acc = {};
  for (const net of INSIGHT_NETS) acc[net] = { media: 0, read: 0, reach: 0, views: 0, reachSeen: false, viewsSeen: false };
  media.forEach((m, i) => {
    const a = acc[m.net] || (acc[m.net] = { media: 0, read: 0, reach: 0, views: 0, reachSeen: false, viewsSeen: false });
    a.media++;
    const v = got[i];
    /* `needs` is a permission the token does not carry, which is a refusal
       exactly as `error` is: the network answered and gave nothing. Counting
       it as read would put a post in the denominator of a reach the house was
       never allowed to see. */
    if (!v || v.error || v.needs) return;
    a.read++;
    if (typeof v.reach === "number") { a.reach += v.reach; a.reachSeen = true; }
    if (typeof v.views === "number") { a.views += v.views; a.viewsSeen = true; }
  });
  const reachBy = {}, viewsBy = {};
  const unread = [];
  for (const net of Object.keys(acc)) {
    const a = acc[net];
    if (!a.media) continue;
    reachBy[net] = a.reachSeen ? a.reach : null;
    viewsBy[net] = a.viewsSeen ? a.views : null;
    if (!a.read) unread.push(net);
  }
  const anyReach = Object.values(reachBy).some(v => typeof v === "number");
  const anyViews = Object.values(viewsBy).some(v => typeof v === "number");
  return {
    media: media.length,
    reach: { value: anyReach ? sum(Object.values(reachBy).filter(v => typeof v === "number")) : null, by: reachBy },
    views: { value: anyViews ? sum(Object.values(viewsBy).filter(v => typeof v === "number")) : null, by: viewsBy },
    unread
  };
}

/* the readers on the site, day by day, out of the beacon's own counters */
export async function readers(dates, opts = {}) {
  if (opts.readers) return await opts.readers(dates);
  const ready = opts.kvReady || kvReady;
  if (!ready()) return { store: false, people: null, views: null, days: [] };
  const store = opts.kv || kv;
  const r = await store([["MGET", ...dates.map(d => "nv:" + d + ":people")],
                         ["MGET", ...dates.map(d => "nv:" + d + ":views")]]);
  const people = ((r && r[0]) || []).map(num);
  const views = ((r && r[1]) || []).map(num);
  return { store: true, people: sum(people), views: sum(views),
           days: dates.map((d, i) => ({ date: d, people: people[i] || 0, views: views[i] || 0 })) };
}

/* the clicks the beacon could attribute, per month, per network */
export async function clicks(dates, opts = {}) {
  if (opts.clicks) return await opts.clicks(dates);
  const ready = opts.kvReady || kvReady;
  if (!ready()) return { attribution: "none", by: {}, months: [], value: null };
  const months = [...new Set(dates.map(d => d.slice(0, 7)))];
  const keys = [];
  for (const m of months) for (const n of CLICK_NETS) keys.push("nm:" + m + ":s:" + n);
  const store = opts.kv || kv;
  const r = await store([["MGET", ...keys]]);
  const vals = ((r && r[0]) || []).map(num);
  const by = {};
  let seen = false;
  keys.forEach((k, i) => {
    const net = k.split(":s:")[1];
    if (vals[i] == null) return;
    seen = true;
    by[net] = (by[net] || 0) + vals[i];
  });
  if (!seen) return { attribution: "none", by: {}, months, value: null };
  return { attribution: "month", by, months, value: sum(Object.values(by)) };
}

/* gifts: the count and what arrived, from Stripe's charges. Never the
   household floor: that figure lives in the ledger and leaves it nowhere. */
export async function giftsIn(dates, opts = {}) {
  if (opts.gifts) return await opts.gifts(dates);
  if (!process.env.STRIPE_SECRET_KEY) return { configured: false, count: null, grossMinor: null, currency: "" };
  const from = Math.floor(Date.parse(dates[0] + "T00:00:00Z") / 1000);
  const to = Math.floor(Date.parse(dates[dates.length - 1] + "T23:59:59Z") / 1000);
  const led = await computeLedger({ from, to, fetchImpl: opts.fetchImpl,
    maxPages: opts.maxPages || MAX_PAGES,
    deadline: opts.deadline || (Date.now() + (opts.readMs || READ_MS)) });
  return { configured: true, ok: !!led.ok, partial: !!led.partial,
           count: (led.totals && led.totals.count) || 0,
           grossMinor: (led.totals && led.totals.gross) || 0, currency: led.currency || "" };
}

/* du'as left at checkout, and guardians standing today. Both are Stripe's own
   records; the du'a text is never read here, only counted. */
const STRIPE = "https://api.stripe.com/v1/";
async function stripeGet(path, opts) {
  const key = process.env.STRIPE_SECRET_KEY;
  const F = opts.fetchImpl || fetch;
  const r = await F(STRIPE + path, { headers: { Authorization: "Bearer " + key } });
  if (!r.ok) throw new Error("stripe " + r.status);
  return await r.json();
}

/* Stripe answers a hundred rows at a time and sets `has_more` when there are
   others behind them. A count made from the first page alone is right until
   the day the house is busy and then it is silently wrong, so the pages are
   walked exactly as api/ledger.js walks the charges: until Stripe says there
   are no more, or until the page cap or the deadline stops the walk. A walk
   that stopped with `has_more` still true has counted a part, and it says so.
   `path` must already carry a query, because the cursor is appended to it. */
async function stripeAll(path, opts) {
  const cap = opts.maxPages || MAX_PAGES;
  const deadline = opts.deadline || (Date.now() + (opts.readMs || READ_MS));
  const rows = [];
  let starting = "", partial = false;
  for (let page = 0; page < cap; page++) {
    /* the clock is read before a page is asked for, never in the middle of
       one: a request already in flight is finished and counted */
    if (page > 0 && Date.now() >= deadline) { partial = true; break; }
    const j = await stripeGet(path + (starting ? "&starting_after=" + encodeURIComponent(starting) : ""), opts);
    const data = (j && j.data) || [];
    rows.push(...data);
    if (!j || !j.has_more || !data.length) return { rows, partial };
    if (page === cap - 1) partial = true;      /* Stripe has more and the cap stopped us */
    starting = data[data.length - 1].id;
  }
  return { rows, partial };
}

export async function duasIn(dates, opts = {}) {
  if (opts.duas) return await opts.duas(dates);
  if (!process.env.STRIPE_SECRET_KEY) return { configured: false, count: null };
  const from = Math.floor(Date.parse(dates[0] + "T00:00:00Z") / 1000);
  const to = Math.floor(Date.parse(dates[dates.length - 1] + "T23:59:59Z") / 1000);
  const { rows, partial } = await stripeAll("checkout/sessions?limit=100&created[gte]=" + from + "&created[lte]=" + to, opts);
  let count = 0;
  for (const s of rows) {
    if (s.payment_status !== "paid") continue;
    const f = (s.custom_fields || []).find(x => x.key === "dua" || x.key === "dedication");
    const text = (f && f.text && f.text.value) || (s.metadata && s.metadata.noor_dua) || "";
    if (String(text).trim().length >= 3) count++;
  }
  return { configured: true, count, partial };
}

export async function guardiansNow(opts = {}) {
  if (opts.guardians) return await opts.guardians();
  if (!process.env.STRIPE_SECRET_KEY) return { configured: false, count: null };
  const { rows, partial } = await stripeAll("subscriptions?status=active&limit=100", opts);
  let count = 0;
  for (const s of rows) {
    if (s.metadata && s.metadata.noor_donation === "1") continue;   /* a monthly gift is not a guardian */
    count++;
  }
  return { configured: true, count, partial };
}

/* ---------------------------------------------------------------------------
   the funnel
--------------------------------------------------------------------------- */
export async function flow(days, opts = {}) {
  const d = Math.max(1, Math.min(MAX_DAYS, Number(days) || DEFAULT_DAYS));
  const dates = daysBack(d, opts.now);
  const at = new Date(nowMsOf(opts.now)).toISOString();
  const notes = [];
  const stages = [];
  const tryTo = async (what, fn, fallback) => {
    try { return await fn(); }
    catch (e) { notes.push("The " + what + " could not be read: " + String((e && e.message) || e).slice(0, 90) + "."); return fallback; }
  };

  const made = await tryTo("slot records", () => postsMade(d, { ...opts, days: d }), { total: 0, by: {}, posts: [] });
  stages.push({ id: "posts", label: "Posts made", value: made.total, unit: "posts",
    by: Object.keys(made.by).length ? made.by : null, source: "the slot records, nsoc:slot:<date>#<slot>", unread: false });
  if (!made.total) notes.push("No slot record in the last " + d + " days carries a network id, so every stage below it is empty rather than zero.");

  const w = await tryTo("insights cache", () => watched(made.posts, opts),
    { media: 0, reach: { value: null, by: {} }, views: { value: null, by: {} }, unread: [] });
  stages.push({ id: "reach", label: "People reached", value: w.reach.value, unit: "people",
    by: Object.keys(w.reach.by).length ? w.reach.by : null,
    source: "the insights cache, nsoc:ins:<network>:<id>", unread: w.reach.value == null });
  stages.push({ id: "views", label: "Views", value: w.views.value, unit: "views",
    by: Object.keys(w.views.by).length ? w.views.by : null,
    source: "the insights cache, nsoc:ins:<network>:<id>", unread: w.views.value == null });
  if (w.unread.length)
    notes.push("Nothing has been read back for " + w.unread.join(", ") + " yet, so " + (w.unread.length === 1 ? "that network is" : "those networks are") + " unread rather than zero. Press Read in the insights room.");

  const c = await tryTo("beacon's referrers", () => clicks(dates, opts), { attribution: "none", by: {}, months: [], value: null });
  stages.push({ id: "clicks", label: "Clicks to the site", value: c.value, unit: "arrivals",
    by: Object.keys(c.by).length ? c.by : null, attribution: c.attribution,
    source: c.attribution === "month" ? "the beacon's referrer counters, nm:<month>:s:<network>" : "nothing attributes an arrival to a network",
    unread: c.value == null });
  if (c.attribution === "month")
    notes.push("The beacon counts a referrer once per person per day into a key per month, so these arrivals are the whole of " + c.months.join(" and ") + " and not only the " + d + " days asked for.");
  else notes.push("No referrer counter exists in the store, so no arrival on the site can be attributed to a network.");

  const r = await tryTo("visitor counters", () => readers(dates, opts), { store: false, people: null, views: null, days: [] });
  stages.push({ id: "readers", label: "Readers", value: r.store ? r.people : null, unit: "people",
    by: null, source: "the beacon's counters, nv:<date>:people", unread: !r.store });
  stages.push({ id: "pages", label: "Pages read", value: r.store ? r.views : null, unit: "pages",
    by: null, source: "the beacon's counters, nv:<date>:views", unread: !r.store });
  if (!r.store) notes.push("The store did not answer, so the readers on the site could not be counted.");
  notes.push("A returning reader is not counted anywhere: the beacon is cookieless and keeps no identifier, so the house cannot know the same person twice. The readers stage is first-ping-of-the-day.");

  /* A Stripe walk that stopped at its page cap or its deadline read some of
     the rows and not all of them. Half a count is not a smaller count, it is
     an absence with a misleading number attached, so the stage is unread and
     the reason is a sentence in the notes, exactly as the ONE RULE says. */
  const g = await tryTo("ledger", () => giftsIn(dates, opts), { configured: false, count: null, grossMinor: null, currency: "" });
  const gShort = !g.configured || !!g.partial;
  stages.push({ id: "gifts", label: "Gifts", value: gShort ? null : g.count, unit: "gifts",
    by: null, source: "Stripe's own charges, through the ledger", unread: gShort, partial: !!g.partial });
  stages.push({ id: "given", label: "What arrived", value: !gShort && g.grossMinor != null ? Math.round(g.grossMinor) / 100 : null,
    unit: (g.currency || "").toUpperCase() || "currency", by: null,
    source: "Stripe's own charges, through the ledger", unread: gShort, partial: !!g.partial });
  if (!g.configured) notes.push("Stripe is not configured here, so no gift can be counted.");
  else if (g.partial) notes.push("Stripe held more pages of charges than this read had pages or seconds for, so the gifts and what arrived are unread rather than a total that would be short. The ledger reads every page of them.");

  const du = await tryTo("du'as", () => duasIn(dates, opts), { configured: false, count: null });
  const duShort = !du.configured || !!du.partial;
  stages.push({ id: "duas", label: "Du'as left", value: duShort ? null : du.count, unit: "du'as",
    by: null, source: "the du'a field on Stripe's checkout sessions", unread: duShort, partial: !!du.partial });
  if (du.partial) notes.push("Stripe held more pages of checkout sessions than this read had pages or seconds for, so the du'as are unread rather than counted short.");

  const gd = await tryTo("guardians", () => guardiansNow(opts), { configured: false, count: null });
  const gdShort = !gd.configured || !!gd.partial;
  stages.push({ id: "guardians", label: "Guardians standing", value: gdShort ? null : gd.count, unit: "guardians",
    by: null, source: "Stripe's active subscriptions", unread: gdShort, partial: !!gd.partial });
  if (gd.partial) notes.push("Stripe held more pages of active subscriptions than this read had pages or seconds for, so the guardians standing are unread rather than counted short.");
  else if (gd.configured) notes.push("Guardians are counted as they stand today, not over the window: a subscription is not a thing that happens on a day.");

  const val = id => { const s = stages.find(x => x.id === id); return s && typeof s.value === "number" ? s.value : null; };
  const edge = (from, to, withRate = true) => ({ from, to, value: val(to), rate: withRate ? rate(val(to), val(from)) : null });
  const edges = [
    edge("posts", "reach"),
    edge("reach", "views"),
    /* the arrivals are a month's and the reach is the window's, so the two
       cannot honestly be divided by one another */
    { ...edge("reach", "clicks", false), rate: null },
    edge("clicks", "readers"),
    edge("readers", "pages"),
    edge("readers", "gifts"),
    edge("readers", "duas")
  ];
  if (c.attribution === "month")
    notes.push("The step from reach to arrivals carries no rate: one is the window's and the other is the month's, and dividing them would invent a number.");

  return { ok: true, days: d, at, from: dates[0], to: dates[dates.length - 1], stages, edges, notes };
}

/* ---------------------------------------------------------------------------
   the quarter hour it keeps
--------------------------------------------------------------------------- */
export async function readCache(days, opts = {}) {
  const ready = opts.kvReady || kvReady;
  if (!ready()) return null;
  try {
    const store = opts.kv || kv;
    const raw = (await store([["GET", K_FLOW(days)]]))[0];
    if (!raw) return null;
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!v || !v.at) return null;
    const nowMs = nowMsOf(opts.now);
    if (nowMs - Date.parse(v.at) > (opts.cacheMs || CACHE_MS)) return null;
    return v;
  } catch { return null; }
}

export async function cached(days, opts = {}) {
  const d = Math.max(1, Math.min(MAX_DAYS, Number(days) || DEFAULT_DAYS));
  if (!opts.fresh) {
    const hit = await readCache(d, opts);
    if (hit) return { ...hit, cached: true };
  }
  const out = await flow(d, opts);
  const ready = opts.kvReady || kvReady;
  if (ready()) {
    try { await (opts.kv || kv)([["SET", K_FLOW(d), JSON.stringify(out), "EX", "3600"]]); } catch { }
  }
  return { ...out, cached: false };
}
