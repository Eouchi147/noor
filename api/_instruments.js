// NOOR · the Soul's instruments: what it reads to keep its direction steady.
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS (2 October 2026, SOUL.md section 11)
//
// The owner asked for "any tool that would help the explorer assess the
// situation better and track progress in order to keep the direction steady
// towards success". The soul already took one snapshot a day; it could see
// where it stood but not where it was heading, not whether what it did had
// worked, and not what the world outside the house was asking for. Each tool
// below answers one of those, and each keeps the same four promises:
//
//   it fails soft: a tool that cannot read answers {ok:false, why} and never
//     throws, so no instrument can ever stop a cycle;
//   it is time boxed: every network read has its own clock, and the whole
//     tool has one more around it (TIME_BOX);
//   it carries totals only: counts, scores, medians, the house's own URLs
//     and the public titles of public videos; never a reader, never a person;
//   it writes only to the soul's own memory (nsoul:*), with one exception
//     that goes through the hands and the council like every public act:
//     the IndexNow ping (R2), capped at 100 URLs a day in code.
//
// THE TOOLS
//   trajectories   each goal's least squares line, where it lands on its due
//                  date, when it reaches its target, and a drift alarm after
//                  seven behind cycles in a row
//   anomalies      each day's numbers against their own trailing 28 days
//                  (median and median absolute deviation)
//   effects        what each public action did to the metric it named, seven
//                  days on, against the same weekday of the weeks before
//   search         a weekly audit of 25 pages from sitemap.xml, read live
//   indexnow       the changed pages offered to Bing, Yandex and the rest
//   speed          Google PageSpeed Insights, mobile, four pages, weekly
//   youtube        the channel's own public totals and a benchmark list
//   radar          what people search on YouTube this month, weekly
//   coverage       how many days each shelf of reels lasts at the rota
//   scorecard      one fixed page a week, built on Mondays
//
// Every network call reaches the network through api/_soul.js netFetch(),
// so a test stands the whole world in with seams.fetch.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  K, seams, netFetch, nowIso, nowMs as nowMsI, dayOf, addDays, store, parse, getJSON, setJSON,
  readSeries, metricValue, readGoals, actionsList, actionsUpdate
} from "./_soul.js";
import { rotaPerWeek } from "./_schedule.js";

const env = k => (process.env[k] || "").trim();
export const SITE_HOST = () => (env("SITE_HOST") || "noorcodex.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
const num = v => (typeof v === "number" && isFinite(v) ? v : null);
const r3 = n => (n == null ? null : Math.round(n * 1000) / 1000);
const r1 = n => (n == null ? null : Math.round(n * 10) / 10);
const str = (v, n) => String(v == null ? "" : v).slice(0, n || 200);
export const median = xs => {
  const a = (xs || []).filter(x => typeof x === "number" && isFinite(x)).sort((p, q) => p - q);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

/* ---------------------------------------------------------------------------
   0. THE CLOCKS: a promise against a timer, a fetch against an abort, and a
      runner that turns any fault into {ok:false, why}
--------------------------------------------------------------------------- */
export const TIME_BOX = Object.freeze({ coverage: 10000, search: 60000, speed: 75000, youtube: 15000, radar: 30000 });
export function withTimeout(p, ms, what) {
  let t;
  const said = ms < 1000 ? ms + " ms" : Math.round(ms / 1000) + " s";
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error((what || "it") + " timed out after " + said)), ms); })])
    .finally(() => clearTimeout(t));
}
export async function soft(name, ms, fn) {
  try {
    const v = await withTimeout(Promise.resolve().then(fn), ms, name);
    if (v == null) return { ok: false, why: name + " answered nothing" };
    return v;
  } catch (e) { return { ok: false, why: str(e && e.message || e, 200) }; }
}
export async function fetchT(url, init, ms) {
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), ms || 8000) : null;
  try { return await netFetch()(url, { ...(init || {}), signal: ctl ? ctl.signal : undefined }); }
  catch (e) { throw new Error(e && e.name === "AbortError" ? "no answer in " + Math.round((ms || 8000) / 1000) + " s" : str(e && e.message || e, 160)); }
  finally { if (t) clearTimeout(t); }
}

/* ---------------------------------------------------------------------------
   1. WEEKS. The ISO week a date falls in ("2026-W40"), and its Monday and
      Sunday. A scorecard is filed under the week it describes.
--------------------------------------------------------------------------- */
export function isoWeek(date) {
  const t = new Date(String(date).slice(0, 10) + "T00:00:00Z");
  const dow = (t.getUTCDay() + 6) % 7;
  const thu = new Date(t.getTime() + (3 - dow) * 86400000);
  const year = thu.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = 1 + Math.floor((thu.getTime() - jan1) / (7 * 86400000));
  return year + "-W" + String(week).padStart(2, "0");
}
export function weekBounds(week) {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(week || ""));
  if (!m) return null;
  const jan4 = new Date(Date.UTC(+m[1], 0, 4));
  const mon1 = jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000;
  const from = new Date(mon1 + (+m[2] - 1) * 7 * 86400000).toISOString().slice(0, 10);
  return { from, to: addDays(from, 6) };
}
const weekIndex = week => { const m = /^(\d{4})-W(\d{2})$/.exec(String(week || "")); return m ? (+m[1]) * 53 + (+m[2]) : 0; };

/* ---------------------------------------------------------------------------
   2. TRAJECTORIES. For each goal, the least squares line through its last
      28 daily readings (14 or more gives a good confidence), the value that
      line reaches on the due date, the date it reaches the target, and a
      status: met, on-track, behind or no-data.
--------------------------------------------------------------------------- */
export const TRAJ_POINTS = 28;
/* the metrics where less is better; every seeded goal reads better upward */
export const LOWER_IS_BETTER = new Set(["spend.usd"]);
const dayNum = d => Math.round(Date.parse(String(d).slice(0, 10) + "T00:00:00Z") / 86400000);

export function leastSquares(points) {
  const pts = (points || []).filter(p => p && typeof p.value === "number" && isFinite(p.value) && /^\d{4}-\d{2}-\d{2}/.test(String(p.date || "")));
  const n = pts.length;
  if (!n) return null;
  const x0 = dayNum(pts[0].date);
  const xs = pts.map(p => dayNum(p.date) - x0), ys = pts.map(p => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) * (xs[i] - mx); sxy += (xs[i] - mx) * (ys[i] - my); }
  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  return { n, slope, intercept, x0, firstDate: pts[0].date, last: pts[n - 1], at: x => intercept + slope * x };
}
export function confidenceOf(n) {
  if (!n) return { level: "none", note: "no daily reading yet" };
  if (n < 7) return { level: "low", note: "from " + n + " daily reading" + (n === 1 ? "" : "s") + "; a line needs a week before it means much" };
  if (n < 14) return { level: "medium", note: "from " + n + " daily readings" };
  return { level: "good", note: "from " + n + " daily readings" };
}
export function trajectory(goal, today) {
  const g = goal || {};
  const d = today || dayOf();
  const lower = LOWER_IS_BETTER.has(String(g.metric || ""));
  const better = (a, b) => (lower ? a <= b : a >= b);
  const hist = (Array.isArray(g.history) ? g.history : []).filter(h => h && typeof h.value === "number" && isFinite(h.value)).slice(-TRAJ_POINTS);
  const fit = leastSquares(hist);
  const value = hist.length ? hist[hist.length - 1].value : null;
  const target = num(g.target);
  const conf = confidenceOf(hist.length);
  const out = { id: g.id, owner: g.owner || null, outcome: str(g.outcome, 300), metric: g.metric || null, baseline: num(g.baseline), target: target == null ? (g.target == null ? null : String(g.target)) : target,
    due: g.due || null, value, points: hist.length, slopePerDay: fit ? r3(fit.slope) : null, projected: null, eta: null,
    status: "no-data", confidence: conf.level, note: conf.note, series: hist.map(h => ({ date: h.date, value: h.value })) };
  if (g.status === "met" || g.status === "done") { out.status = "met"; if (target == null) out.note = "reached (" + g.status + ")"; return out; }
  if (g.status === "retired") { out.status = "no-data"; out.note = "retired"; return out; }
  if (target == null) { out.note = "not a numeric goal; its own status says how it stands"; return out; }
  if (value != null && better(value, target)) { out.status = "met"; return out; }
  if (!fit || fit.n < 2) return out;
  const xToday = dayNum(d) - fit.x0;
  const dueOpen = g.due && /^\d{4}-\d{2}-\d{2}$/.test(String(g.due)) && String(g.due) > d;
  if (dueOpen) out.projected = r3(fit.at(dayNum(g.due) - fit.x0));
  const goodSlope = lower ? fit.slope < 0 : fit.slope > 0;
  if (goodSlope) {
    const xT = (target - fit.intercept) / fit.slope;
    const daysAway = Math.ceil(xT - xToday);
    if (isFinite(xT)) {
      if (daysAway <= 0) out.eta = d;
      else if (daysAway <= 3 * 365) out.eta = addDays(d, daysAway);
      else out.note += "; the target is more than three years away at this pace";
    }
  } else out.note += "; at this pace it does not reach the target";
  /* a goal whose due date has passed, or one kept every week (posting
     health), is judged on where it stands now; one still open on where its
     line lands on the due date */
  out.status = dueOpen ? (out.projected != null && better(out.projected, target) ? "on-track" : "behind") : "behind";
  return out;
}

/* the drift alarm: a goal behind on seven daily cycles in a row. Counted
   per cycle date, so a cycle that runs its assess stage twice never counts
   the same day twice. The owner hears of it on the 7th day, then once a week
   while it lasts; the planner hears of it every day it lasts. */
export const DRIFT_DAYS = 7;
export function stepDrift(prev, trajs, date) {
  const p = (prev && typeof prev === "object") ? prev : {};
  const next = {}, alarms = [];
  for (const t of trajs || []) {
    if (!t || !t.id) continue;
    const was = p[t.id] || { streak: 0, lastDate: null };
    let streak = was.streak || 0;
    if (was.lastDate !== date) streak = t.status === "behind" ? streak + 1 : 0;
    next[t.id] = { streak, lastDate: date, status: t.status };
    if (streak >= DRIFT_DAYS) alarms.push({ id: t.id, metric: t.metric, outcome: t.outcome, streak, tellOwner: (streak - DRIFT_DAYS) % 7 === 0, projected: t.projected, target: t.target, due: t.due });
  }
  return { next, alarms };
}
export async function updateDrift(trajs, date) {
  let prev = {};
  try { prev = (await getJSON(K.drift, {})) || {}; } catch { prev = {}; }
  const r = stepDrift(prev, trajs, date);
  try { await setJSON(K.drift, r.next); } catch { /* the alarm still reaches this cycle */ }
  return r;
}

/* ---------------------------------------------------------------------------
   3. ANOMALIES. Each watched number of today's snapshot against the trailing
      28 days before it: its median and its median absolute deviation (scaled
      to a standard deviation, 1.4826). A robust z of 3.5 is notable, 6 is
      severe; a floor on the scale keeps a perfectly flat month from calling
      the first wobble a catastrophe, and a floor on the size keeps a tiny
      move from being called anything at all.
--------------------------------------------------------------------------- */
export const WATCH = Object.freeze([
  { id: "posting-health", kind: "posting health drop", path: "output.health", label: "posting health", dir: "down", floor: 0.01, minMove: 0.03 },
  { id: "reach", kind: "reach collapse", path: "northStar", label: "people reached this week", dir: "down", floor: 1, minRel: 0.2 },
  { id: "reach-instagram", kind: "reach collapse", path: "reach.instagram", label: "Instagram reach", dir: "down", floor: 1, minRel: 0.25 },
  { id: "reach-youtube", kind: "reach collapse", path: "reach.youtube", label: "YouTube views", dir: "down", floor: 1, minRel: 0.25 },
  { id: "reach-facebook", kind: "reach collapse", path: "reach.facebook", label: "Facebook reach", dir: "down", floor: 1, minRel: 0.25 },
  { id: "spend", kind: "spend spike", path: "spend.usd", label: "paid model spend in a day", dir: "up", floor: 0.05, minMove: 0.25, daily: true },
  { id: "visitors", kind: "visitors spike", path: "site.visitors7", label: "site visitors this week", dir: "up", floor: 1, minRel: 0.3 }
]);
export const Z_NOTABLE = 3.5, Z_SEVERE = 6;
/* spend.usd is the month to date; its day's own spend is the step from the
   day before, or the whole figure on the first reading of a month */
function dailySeries(series, w) {
  return series.map((x, i) => {
    const v = num(metricValue(x.snap, w.path));
    if (!w.daily || v == null) return { date: x.date, v };
    const prev = i > 0 ? num(metricValue(series[i - 1].snap, w.path)) : null;
    const sameMonth = i > 0 && String(series[i - 1].date).slice(0, 7) === String(x.date).slice(0, 7);
    if (prev == null && sameMonth) return { date: x.date, v: null };
    return { date: x.date, v: sameMonth ? Math.max(0, v - prev) : v };
  });
}
/* series: [{date, snap}] oldest first, the last one today */
export function findAnomalies(series) {
  const s = (series || []).filter(x => x && x.date);
  if (s.length < 8) return [];
  const flags = [];
  for (const w of WATCH) {
    const ds = dailySeries(s, w);
    const today = ds[ds.length - 1];
    if (today.v == null) continue;
    const trail = ds.slice(Math.max(0, ds.length - 29), ds.length - 1).map(x => x.v).filter(v => v != null);
    if (trail.length < 7) continue;
    const m = median(trail);
    const mad = median(trail.map(v => Math.abs(v - m)));
    const scale = Math.max(1.4826 * mad, w.floor, 0.02 * Math.abs(m));
    const z = (today.v - m) / scale;
    const move = today.v - m;
    const rel = m ? move / Math.abs(m) : null;
    const dirOk = w.dir === "down" ? z <= -Z_NOTABLE : z >= Z_NOTABLE;
    if (!dirOk) continue;
    if (w.minMove != null && Math.abs(move) < w.minMove) continue;
    if (w.minRel != null && (rel == null || Math.abs(rel) < w.minRel)) continue;
    let severe = Math.abs(z) >= Z_SEVERE;
    if (w.id === "posting-health" && today.v < 0.9) severe = true;
    if (w.kind === "reach collapse" && rel != null && rel <= -0.5) severe = true;
    if (w.id === "spend" && today.v >= 2) severe = true;
    const fmt = v => (w.path === "output.health" ? Math.round(v * 1000) / 10 + " percent" : w.path === "spend.usd" ? v.toFixed(2) + " dollars" : String(Math.round(v)));
    flags.push({ id: w.id, kind: w.kind, label: w.label, metric: w.path, direction: w.dir, value: r3(today.v), median: r3(m), z: r1(z),
      changePct: rel == null ? null : Math.round(rel * 1000) / 10, severity: severe ? "severe" : "notable", date: today.date,
      sentence: w.label + " " + (w.dir === "down" ? "fell" : "rose") + " to " + fmt(today.v) + " against a 28 day median of " + fmt(m)
        + (rel == null ? "" : " (" + (rel > 0 ? "+" : "") + Math.round(rel * 100) + " percent)") });
  }
  return flags;
}
export async function recordAnomalies(date, flags) {
  let list = [];
  try { list = await getJSON(K.anomalies, []); } catch { list = []; }
  list = (Array.isArray(list) ? list : []).filter(x => x && x.date !== date);
  list.unshift({ date, flags: flags || [] });
  try { await setJSON(K.anomalies, list.slice(0, 90)); } catch { }
}
export async function readAnomalies() {
  try { const v = await getJSON(K.anomalies, []); return Array.isArray(v) ? v : []; } catch { return []; }
}

/* ---------------------------------------------------------------------------
   4. THE EFFECTS LEDGER, the learning loop. Every public (R2) action keeps
      the metric it named and that metric's value the morning it ran
      (api/_hands.js runHand, entry.before). Seven days later the reflect
      stage reads the same metric again, and sets the change beside a matched
      baseline: the change over the same seven days, from the same weekday,
      in each of the three weeks before. What is left over is the action's
      share, judged helped, hurt or unclear against the noise of those weeks.
--------------------------------------------------------------------------- */
export const EFFECT_DAYS = 7;
export const EFFECTS_KEEP = 200;
export function matchedBaseline(valueOn, date, weeks) {
  const deltas = [];
  for (let k = 1; k <= (weeks || 3); k++) {
    const a = valueOn(addDays(date, -7 * k)), b = valueOn(addDays(date, -7 * k + EFFECT_DAYS));
    if (typeof a === "number" && typeof b === "number") deltas.push(b - a);
  }
  return { deltas, delta: median(deltas), n: deltas.length };
}
export function judgeEffect({ before, after, baseline, lower }) {
  if (typeof before !== "number" || typeof after !== "number") return { delta: null, baselineDelta: baseline && baseline.n ? r3(baseline.delta) : null, excess: null, noise: null, verdict: "unclear", note: "the metric was not read on one of the two days" };
  const delta = after - before;
  const b = baseline && baseline.n ? baseline.delta : null;
  const excess = b == null ? delta : delta - b;
  const spread = baseline && baseline.n >= 2 ? median(baseline.deltas.map(x => Math.abs(x - b))) * 1.4826 : 0;
  let noise = Math.max(0.05 * Math.abs(before), spread, 1e-9);
  if (b == null) noise *= 2;      /* no baseline to stand on: twice as sure before saying anything */
  const good = lower ? -excess : excess;
  const verdict = good > noise ? "helped" : good < -noise ? "hurt" : "unclear";
  return { delta: r3(delta), baselineDelta: b == null ? null : r3(b), excess: r3(excess), noise: r3(noise), verdict,
    note: b == null ? "no baseline: the weeks before were not all measured" : "against the same weekday of " + baseline.n + " earlier week" + (baseline.n === 1 ? "" : "s") };
}
/* the reflect stage's own step: every R2 action now seven days old and not
   yet measured, measured. A snapshot missing on the seventh day is waited
   for two more days, then written down as unclear rather than guessed. */
export async function measureEffects(today) {
  const out = { measured: [], waiting: 0 };
  const acts = (await actionsList()).filter(a => a && a.tier === "R2" && a.ok && a.before && a.before.metric && !a.effect);
  if (!acts.length) return out;
  const series = await readSeries(60, today);
  const byDate = new Map(series.map(x => [x.date, x.snap]));
  for (const a of acts) {
    const date = String(a.before.date || String(a.at || "").slice(0, 10));
    const due = addDays(date, EFFECT_DAYS);
    if (due > today) { out.waiting++; continue; }
    const metric = a.before.metric;
    const valueOn = d => { const v = metricValue(byDate.get(d), metric); return typeof v === "number" ? v : null; };
    const after = valueOn(due);
    if (after == null && addDays(due, 2) > today) { out.waiting++; continue; }
    const baseline = matchedBaseline(valueOn, date, 3);
    const j = judgeEffect({ before: typeof a.before.value === "number" ? a.before.value : valueOn(date), after, baseline, lower: LOWER_IS_BETTER.has(metric) });
    const effect = { id: a.id, action: a.hand, metric, date, measuredOn: due, before: typeof a.before.value === "number" ? a.before.value : null, after,
      ...j, baselineN: baseline.n, undone: !!a.undone, cycle: a.cycle || null, at: nowIso() };
    try { await store([["LPUSH", K.effects, JSON.stringify(effect)], ["LTRIM", K.effects, "0", String(EFFECTS_KEEP - 1)]]); } catch { continue; }
    try { await actionsUpdate(a.id, { effect: { verdict: effect.verdict, delta: effect.delta, excess: effect.excess, at: effect.at } }); } catch { }
    out.measured.push(effect);
  }
  return out;
}
export async function readEffects(n) {
  try {
    const r = await store([["LRANGE", K.effects, "0", String(Math.max(1, Math.min(EFFECTS_KEEP, n || 50)) - 1)]]);
    return (r[0] || []).map(s => parse(s, null)).filter(Boolean);
  } catch { return []; }
}
export function effectsSummary(list) {
  const s = { helped: 0, hurt: 0, unclear: 0, total: 0 };
  for (const e of list || []) { if (!e) continue; s.total++; if (s[e.verdict] != null) s[e.verdict]++; }
  return s;
}
/* the planner's "what worked": totals only, newest first */
export function effectsForPrompt(list) {
  return (list || []).slice(0, 20).map(e => ({ action: e.action, metric: e.metric, date: e.date, before: e.before, after: e.after,
    delta: e.delta, baselineDelta: e.baselineDelta, verdict: e.verdict }));
}

/* ---------------------------------------------------------------------------
   5. THE LATEST READING OF EACH WEEKLY TOOL. Two keys a tool: nsoul:inst:<n>
      holds its last good reading (what the console and the planner see) and
      nsoul:inst:<n>:try its last attempt (what decides whether it is due).
      A tool is due once an ISO week; one whose attempt failed is tried again
      the next day, never twice the same day.
--------------------------------------------------------------------------- */
export const WEEKLY = ["search", "speed", "youtube", "radar"];
export async function readLatest(name) {
  try { return await getJSON(K.inst(name), null); } catch { return null; }
}
export async function readTry(name) {
  try { return await getJSON(K.inst(name + ":try"), null); } catch { return null; }
}
async function saveResult(name, result, date) {
  const tryRec = { ok: !!(result && result.ok), why: result && result.ok ? null : str(result && result.why, 240), date, week: isoWeek(date), at: nowIso() };
  const cmds = [["SET", K.inst(name + ":try"), JSON.stringify(tryRec), "EX", String(120 * 86400)]];
  if (result && result.ok) {
    cmds.push(["SET", K.inst(name), JSON.stringify(result), "EX", String(400 * 86400)]);
    cmds.push(["LPUSH", K.instHist(name), JSON.stringify(histRow(name, result))], ["LTRIM", K.instHist(name), "0", "25"]);
  }
  await store(cmds);
  return tryRec;
}
function histRow(name, r) {
  if (name === "search") return { week: r.week, date: r.date, score: r.score };
  if (name === "speed") return { week: r.week, date: r.date, score: r.score, pages: (r.pages || []).map(p => ({ name: p.name, score: p.score, lcpMs: p.lcpMs })) };
  if (name === "youtube") return { week: r.week, date: r.date, subscribers: r.house && r.house.subscribers, views: r.house && r.house.views, videos: r.house && r.house.videos };
  if (name === "radar") return { week: r.week, date: r.date, top: (r.rising || []).slice(0, 3).map(x => ({ query: x.query, views: x.views })) };
  return { week: r.week, date: r.date };
}
export async function readHist(name, n) {
  try { const r = await store([["LRANGE", K.instHist(name), "0", String((n || 12) - 1)]]); return (r[0] || []).map(s => parse(s, null)).filter(Boolean); }
  catch { return []; }
}
export async function isDue(name, date) {
  const t = await readTry(name);
  if (!t) return true;
  if (name === "coverage") return t.date !== date;
  if (t.week !== isoWeek(date)) return true;
  return !t.ok && t.date !== date;
}

/* ---------------------------------------------------------------------------
   6. SEARCH READINESS. The site's own sitemap.xml, read from the deployment's
      files (vercel.json lists it for api/soul.js), and 25 of its pages a week
      read from the live site, walked in a fixed stride so that every page is
      read in turn. Seven checks a page; the score is the share passed.
--------------------------------------------------------------------------- */
export const AUDIT_SAMPLE = 25;
export const MIN_WORDS = 100;
export const AUDIT_CHECKS = ["status", "title", "description", "canonical", "structured", "words", "indexable"];
const decodeXml = s => String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'");
export function parseSitemap(xml) {
  const out = [];
  const rx = /<url>([\s\S]*?)<\/url>/g;
  let m;
  while ((m = rx.exec(String(xml || "")))) {
    const loc = /<loc>\s*([^<\s]+)\s*<\/loc>/.exec(m[1]);
    const lm = /<lastmod>\s*([^<\s]+)\s*<\/lastmod>/.exec(m[1]);
    if (loc) out.push({ loc: decodeXml(loc[1]), lastmod: lm ? lm[1] : null });
  }
  return out;
}
export function readSitemap() {
  if (seams.files && seams.files.sitemap != null) return parseSitemap(seams.files.sitemap);
  return parseSitemap(fs.readFileSync(path.join(process.cwd(), "sitemap.xml"), "utf8"));
}
export function sampleUrls(entries, week, n) {
  const locs = [...new Set((entries || []).map(e => e && e.loc).filter(Boolean))].sort();
  const N = locs.length;
  if (!N) return [];
  const k = Math.min(n || AUDIT_SAMPLE, N);
  const start = (weekIndex(week) * k) % N;
  const out = [];
  for (let i = 0; i < k; i++) out.push(locs[(start + i) % N]);
  return out;
}
function attrsOf(tag) {
  const a = {};
  const rx = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = rx.exec(tag))) a[m[1].toLowerCase()] = m[3] != null ? m[3] : m[4] != null ? m[4] : m[5];
  return a;
}
const normUrl = u => { try { const x = new URL(u); return (x.protocol + "//" + x.host.toLowerCase() + x.pathname.replace(/\/+$/, "") + x.search); } catch { return String(u || "").replace(/\/+$/, ""); } };
export function wordCount(html) {
  const text = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
  const m = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return m ? m.length : 0;
}
export function auditPage(url, status, html, headers) {
  const page = { url, status, title: null, description: null, canonical: null, jsonld: false, words: 0, noindex: false, fails: [], score: 0 };
  if (status !== 200) { page.fails.push("status " + status); return page; }
  const h = String(html || "");
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(h);
  page.title = t ? decodeXml(t[1].replace(/\s+/g, " ").trim()).slice(0, 160) : null;
  const metas = h.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metas) {
    const a = attrsOf(tag);
    const nm = String(a.name || a.property || "").toLowerCase();
    if (nm === "description" && a.content != null) page.description = decodeXml(a.content).trim().slice(0, 300);
    if (nm === "robots" && /noindex/i.test(String(a.content || ""))) page.noindex = true;
  }
  if (headers && /noindex/i.test(String(headers["x-robots-tag"] || ""))) page.noindex = true;
  for (const tag of (h.match(/<link\b[^>]*>/gi) || [])) {
    const a = attrsOf(tag);
    if (String(a.rel || "").toLowerCase().split(/\s+/).includes("canonical") && a.href) { page.canonical = decodeXml(a.href); break; }
  }
  const ld = [...h.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  page.jsonld = ld.some(m => { try { JSON.parse(m[1]); return true; } catch { return false; } });
  page.words = wordCount(h);
  if (!page.title) page.fails.push("no title");
  if (!page.description) page.fails.push("no meta description");
  if (!page.canonical) page.fails.push("no canonical");
  else if (normUrl(page.canonical) !== normUrl(url)) page.fails.push("canonical points elsewhere");
  if (!page.jsonld) page.fails.push(ld.length ? "structured data does not parse" : "no structured data");
  if (page.words < MIN_WORDS) page.fails.push("thin: " + page.words + " words");
  if (page.noindex) page.fails.push("noindex");
  page.score = r3((AUDIT_CHECKS.length - page.fails.length) / AUDIT_CHECKS.length);
  return page;
}
const checkOf = f => /^status/.test(f) ? "status" : /title/.test(f) ? "title" : /description/.test(f) ? "description" : /canonical/.test(f) ? "canonical"
  : /structured/.test(f) ? "structured" : /^thin/.test(f) ? "words" : /noindex/.test(f) ? "indexable" : "other";
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  const run = async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
  return out;
}
export async function searchAudit(date) {
  let entries;
  try { entries = readSitemap(); } catch (e) { return { ok: false, why: "sitemap.xml could not be read from the deployment's files: " + str(e && e.message || e, 120) }; }
  if (!entries.length) return { ok: false, why: "sitemap.xml lists no page" };
  const week = isoWeek(date);
  const urls = sampleUrls(entries, week, AUDIT_SAMPLE);
  const pages = await pool(urls, 5, async url => {
    try {
      const r = await fetchT(url, { headers: { "user-agent": "NOOR-Soul/1.0 (+https://" + SITE_HOST() + ")", accept: "text/html" } }, 8000);
      const hdr = {};
      try { if (r.headers && typeof r.headers.get === "function") hdr["x-robots-tag"] = r.headers.get("x-robots-tag") || ""; } catch { }
      const html = r.status === 200 ? await r.text() : "";
      return auditPage(url, r.status, html, hdr);
    } catch (e) { return { url, unreachable: true, why: str(e && e.message || e, 120), fails: ["unreachable"], score: 0 }; }
  });
  const reached = pages.filter(p => !p.unreachable);
  if (!reached.length) return { ok: false, why: "the live site could not be reached for any of the " + urls.length + " pages (" + (pages[0] && pages[0].why || "no answer") + ")" };
  const counts = {};
  for (const c of AUDIT_CHECKS) counts[c] = 0;
  counts.unreachable = pages.length - reached.length;
  for (const p of reached) for (const f of p.fails) { const c = checkOf(f); counts[c] = (counts[c] || 0) + 1; }
  const score = Math.round(pages.reduce((a, p) => a + (p.score || 0), 0) / pages.length * 100);
  return { ok: true, at: nowIso(), date, week, sitemapUrls: entries.length, sampled: pages.length, reached: reached.length, score,
    passed: pages.filter(p => !p.fails.length).length, counts,
    failures: pages.filter(p => p.fails.length).map(p => ({ url: p.url, fails: p.fails.slice(0, 7) })),
    pages: pages.map(p => ({ url: p.url, status: p.status == null ? null : p.status, score: p.score, words: p.words == null ? null : p.words })) };
}

/* ---------------------------------------------------------------------------
   7. INDEXNOW. One key, made once and kept in the store, served at
      https://<host>/<key>.txt (vercel.json rewrites it to the door, which
      answers the key and nothing else). The changed pages are those whose
      sitemap lastmod differs from the one last offered; at most 100 a day
      leave, counted atomically before the call and given back if it fails.
      The submit itself is a public act (R2, api/_hands.js indexnow-submit).
--------------------------------------------------------------------------- */
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_DAY_MAX = 100;
export async function indexnowKey(create) {
  const r = await store([["GET", K.indexnowKey]]);
  const k = parse(r[0], null);
  if (k && k.key) return k;
  if (!create) return null;
  const key = crypto.randomBytes(16).toString("hex");
  await store([["SET", K.indexnowKey, JSON.stringify({ key, at: nowIso(), verified: null }), "NX"]]);
  return parse((await store([["GET", K.indexnowKey]]))[0], null);
}
/* the key file must answer on the live site before anything is offered:
   IndexNow refuses a key it cannot read back. Checked once a week. */
export async function indexnowVerify(date) {
  const k = await indexnowKey(true);
  if (!k) return { ok: false, why: "no key" };
  if (k.verified && isoWeek(k.verified) === isoWeek(date)) return { ok: true, key: k.key, verified: k.verified };
  try {
    const r = await fetchT("https://" + SITE_HOST() + "/" + k.key + ".txt", {}, 6000);
    const body = r.status === 200 ? String(await r.text()).trim() : "";
    if (body !== k.key) return { ok: false, key: k.key, why: "the key file is not served yet at /" + k.key + ".txt (http " + r.status + ")" };
  } catch (e) { return { ok: false, key: k.key, why: "the key file could not be read: " + str(e && e.message || e, 120) }; }
  const v = { ...k, verified: date };
  try { await store([["SET", K.indexnowKey, JSON.stringify(v)]]); } catch { }
  return { ok: true, key: k.key, verified: date };
}
export async function indexnowSeen() {
  const r = await store([["HGETALL", K.indexnowSeen]]);
  const raw = r[0] || [];
  const pairs = Array.isArray(raw) ? raw : Object.entries(raw).flat();
  const m = {};
  for (let i = 0; i + 1 < pairs.length; i += 2) m[String(pairs[i])] = String(pairs[i + 1]);
  return m;
}
export function changedUrls(entries, seen, host) {
  const h = String(host || SITE_HOST()).toLowerCase();
  return (entries || []).filter(e => {
    if (!e || !e.loc) return false;
    try { if (new URL(e.loc).host.toLowerCase() !== h) return false; } catch { return false; }
    return seen[e.loc] !== String(e.lastmod || "-");
  });
}
export async function indexnowStatus(date) {
  const out = { keySet: false, verified: null, pending: null, submittedToday: 0, perDay: INDEXNOW_DAY_MAX, last: null };
  try {
    const k = await indexnowKey(false);
    out.keySet = !!k; out.verified = k ? (k.verified || null) : null;
    const r = await store([["GET", K.count("indexnow", date)], ["LINDEX", K.indexnowLog, "0"]]);
    out.submittedToday = parseInt(r[0], 10) || 0;
    out.last = parse(r[1], null);
  } catch { }
  try { out.pending = changedUrls(readSitemap(), await indexnowSeen()).length; } catch { out.pending = null; }
  return out;
}
export async function indexnowSubmit(opts = {}) {
  const date = opts.date || dayOf();
  const want = Math.max(1, Math.min(INDEXNOW_DAY_MAX, parseInt(opts.max, 10) || INDEXNOW_DAY_MAX));
  const k = await indexnowKey(false);
  if (!k || !k.key) return { ok: false, error: "no IndexNow key yet; the daily cycle makes one and checks it is served" };
  let entries, seen;
  try { entries = readSitemap(); seen = await indexnowSeen(); }
  catch (e) { return { ok: false, error: "the sitemap or the ledger of offered pages could not be read: " + str(e && e.message || e, 120) }; }
  const pending = changedUrls(entries, seen);
  if (!pending.length) return { ok: true, submitted: 0, note: "no page has changed since it was last offered" };
  /* the day's cap, counted before the call: INCRBY says how many this day
     now holds; any over 100 are given straight back */
  const key = K.count("indexnow", date);
  let total;
  try { total = parseInt((await store([["INCRBY", key, String(Math.min(want, pending.length))], ["EXPIRE", key, "172800"]]))[0], 10); }
  catch { return { ok: false, error: "the daily count could not be kept, so nothing was offered" }; }
  let n = Math.min(want, pending.length);
  if (!isFinite(total)) return { ok: false, error: "the daily count could not be read, so nothing was offered" };
  const over = Math.max(0, total - INDEXNOW_DAY_MAX);
  if (over) { try { await store([["DECRBY", key, String(Math.min(over, n))]]); } catch { } n -= Math.min(over, n); }
  if (n <= 0) return { ok: false, error: "the day's " + INDEXNOW_DAY_MAX + " IndexNow pages are already spent" };
  const batch = pending.slice(0, n);
  const host = SITE_HOST();
  let status = 0, why = "";
  try {
    const r = await fetchT(INDEXNOW_ENDPOINT, { method: "POST", headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key: k.key, keyLocation: "https://" + host + "/" + k.key + ".txt", urlList: batch.map(e => e.loc) }) }, 15000);
    status = r.status;
    if (status !== 200 && status !== 202) why = "IndexNow answered http " + status + (status === 403 ? " (the key file was not accepted)" : status === 422 ? " (a URL did not belong to the host)" : status === 429 ? " (too many requests)" : "");
  } catch (e) { why = "IndexNow could not be reached: " + str(e && e.message || e, 120); }
  if (why) {
    try { await store([["DECRBY", key, String(n)]]); } catch { }
    return { ok: false, error: why, status };
  }
  const cmds = batch.map(e => ["HSET", K.indexnowSeen, e.loc, String(e.lastmod || "-")]);
  const log = { at: nowIso(), date, submitted: n, status, pendingBefore: pending.length };
  cmds.push(["LPUSH", K.indexnowLog, JSON.stringify(log)], ["LTRIM", K.indexnowLog, "0", "59"]);
  try { await store(cmds); } catch { }
  return { ok: true, submitted: n, status, pendingAfter: pending.length - n };
}

/* ---------------------------------------------------------------------------
   8. PAGE SPEED. Google PageSpeed Insights v5, mobile, four pages: the home
      page, the Qur'an, one Light, one dictionary word. No key is needed at
      this volume; PSI_API_KEY is used when it is set.
--------------------------------------------------------------------------- */
export const PSI_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
export function speedTargets(entries, cards) {
  const host = SITE_HOST();
  const light = (cards || []).filter(c => c && (c.kind || "light") === "light" && c.id).map(c => String(c.id)).sort()[0];
  const word = (entries || []).map(e => e.loc).filter(u => /\/dictionary\/[^/]+$/.test(String(u))).sort()[0];
  const out = [{ name: "home", url: "https://" + host + "/" }, { name: "quran", url: "https://" + host + "/quran" }];
  if (light) out.push({ name: "light", url: "https://" + host + "/light/" + light });
  if (word) out.push({ name: "word", url: word });
  return out;
}
export function parsePsi(j) {
  const lr = j && j.lighthouseResult;
  if (!lr || !lr.categories || !lr.categories.performance) return null;
  const a = lr.audits || {};
  const nv = k => (a[k] && typeof a[k].numericValue === "number" ? a[k].numericValue : null);
  const fm = (j.loadingExperience && j.loadingExperience.metrics) || {};
  const field = k => (fm[k] && typeof fm[k].percentile === "number" ? fm[k].percentile : null);
  const score = typeof lr.categories.performance.score === "number" ? Math.round(lr.categories.performance.score * 100) : null;
  const inp = field("INTERACTION_TO_NEXT_PAINT");
  return { score, lcpMs: nv("largest-contentful-paint") == null ? null : Math.round(nv("largest-contentful-paint")),
    cls: nv("cumulative-layout-shift") == null ? null : r3(nv("cumulative-layout-shift")), inpMs: inp,
    fieldLcpMs: field("LARGEST_CONTENTFUL_PAINT_MS"), fieldCls: field("CUMULATIVE_LAYOUT_SHIFT_SCORE") == null ? null : r3(field("CUMULATIVE_LAYOUT_SHIFT_SCORE") / 100) };
}
export async function pageSpeed(date, cards) {
  let entries = [];
  try { entries = readSitemap(); } catch { entries = []; }
  const targets = speedTargets(entries, cards);
  const key = env("PSI_API_KEY");
  const pages = await Promise.all(targets.map(async t => {
    const q = PSI_URL + "?url=" + encodeURIComponent(t.url) + "&strategy=mobile&category=performance" + (key ? "&key=" + encodeURIComponent(key) : "");
    try {
      const r = await fetchT(q, { headers: { accept: "application/json" } }, 70000);
      const j = await r.json().catch(() => null);
      if (!r.ok) return { ...t, ok: false, why: "PageSpeed answered http " + r.status + (j && j.error && j.error.message ? ": " + str(j.error.message, 120) : "") };
      const p = parsePsi(j);
      return p ? { ...t, ok: true, ...p } : { ...t, ok: false, why: "PageSpeed answered without a performance score" };
    } catch (e) { return { ...t, ok: false, why: str(e && e.message || e, 160) }; }
  }));
  const good = pages.filter(p => p.ok);
  if (!good.length) return { ok: false, why: "PageSpeed Insights gave no reading (" + (pages[0] && pages[0].why || "no page") + ")" };
  return { ok: true, at: nowIso(), date, week: isoWeek(date), strategy: "mobile", score: median(good.map(p => p.score)), pages };
}

/* ---------------------------------------------------------------------------
   9. YOUTUBE: the channel's position, and the topic radar. Both use the
      house's own YouTube credentials (api/_youtube.js accessToken: the
      refresh token minted into an hour's access token). YouTube gives a
      project 10,000 units a day; the poster's six uploads are budgeted at
      9,600 of them (api/_youtube.js DAILY_CAP). The soul keeps its own count
      (nsoul:yt:units:<day>) and never spends more than YT_UNITS_DAY: a
      channels.list costs 1 unit, a search.list 100, a videos.list 1.
--------------------------------------------------------------------------- */
export const YT_UNITS_DAY = 250;
export const YT_API = "https://www.googleapis.com/youtube/v3";
export async function ytReserve(units, date) {
  const key = K.ytUnits(date || dayOf());
  try {
    const t = parseInt((await store([["INCRBY", key, String(units)], ["EXPIRE", key, "172800"]]))[0], 10);
    if (!isFinite(t)) return false;
    if (t > YT_UNITS_DAY) { try { await store([["DECRBY", key, String(units)]]); } catch { } return false; }
    return true;
  } catch { return false; }
}
async function ytAuth() {
  let Y;
  try { Y = await import("./_youtube.js"); } catch (e) { return { ok: false, why: "the YouTube module could not be loaded" }; }
  if (!Y.configured()) return { ok: false, why: "no YouTube credentials on this deployment (YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN)" };
  let tok;
  try { tok = await withTimeout(Y.accessToken(netFetch()), 8000, "the YouTube token"); }
  catch (e) { return { ok: false, why: str(e && e.message || e, 160) }; }
  if (!tok || !tok.ok) return { ok: false, why: "YouTube token: " + str(tok && tok.err, 160) };
  return { ok: true, token: tok.token };
}
async function ytGet(pathQ, token) {
  const r = await fetchT(YT_API + pathQ, { headers: { authorization: "Bearer " + token, accept: "application/json" } }, 8000);
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error("YouTube refused: " + str((j && j.error && (j.error.message || j.error.status)) || ("http " + r.status), 160));
  return j || {};
}
const intOrNull = v => (v == null || v === "" ? null : (isFinite(Number(v)) ? Number(v) : null));
export function parseChannels(j) {
  return (j && Array.isArray(j.items) ? j.items : []).map(it => {
    const s = it.statistics || {};
    return { id: String(it.id || ""), title: it.snippet ? str(it.snippet.title, 80) : null,
      subscribers: s.hiddenSubscriberCount ? null : intOrNull(s.subscriberCount), views: intOrNull(s.viewCount), videos: intOrNull(s.videoCount),
      hiddenSubscribers: !!s.hiddenSubscriberCount };
  });
}
/* channel ids are public, but none could be checked offline when this was
   written (2 October 2026), so the code list starts empty rather than carry
   an id that might name the wrong channel. The owner keeps the real list in
   the store (nsoul:benchmarks) from the console: POST {action:"benchmarks",
   ids:[...]}, at most ten. */
export const BENCHMARKS = Object.freeze([]);
export const BENCHMARKS_MAX = 10;
export const CHANNEL_ID_RX = /^UC[A-Za-z0-9_-]{22}$/;
export async function readBenchmarks() {
  try { const v = await getJSON(K.benchmarks, null); if (v && Array.isArray(v.ids)) return v.ids.filter(x => CHANNEL_ID_RX.test(String(x))).slice(0, BENCHMARKS_MAX); } catch { }
  return BENCHMARKS.slice(0, BENCHMARKS_MAX);
}
export async function setBenchmarks(ids) {
  if (!Array.isArray(ids)) return { ok: false, error: "ids must be a list of channel ids" };
  const clean = [...new Set(ids.map(x => String(x || "").trim()).filter(Boolean))];
  if (clean.length > BENCHMARKS_MAX) return { ok: false, error: "at most " + BENCHMARKS_MAX + " benchmark channels" };
  const bad = clean.filter(x => !CHANNEL_ID_RX.test(x));
  if (bad.length) return { ok: false, error: "not a YouTube channel id (UC followed by 22 characters): " + bad.slice(0, 3).join(", ") };
  await setJSON(K.benchmarks, { ids: clean, at: nowIso() });
  return { ok: true, ids: clean };
}
export async function youtubePosition(date) {
  const a = await ytAuth();
  if (!a.ok) return a;
  if (!(await ytReserve(1, date))) return { ok: false, why: "the soul's YouTube quota for today is spent" };
  const mine = parseChannels(await ytGet("/channels?part=statistics&mine=true", a.token))[0];
  if (!mine) return { ok: false, why: "YouTube lists no channel for the house's token" };
  const ids = await readBenchmarks();
  let benchmarks = [], note = null;
  if (ids.length) {
    if (await ytReserve(1, date)) {
      try { benchmarks = parseChannels(await ytGet("/channels?part=snippet,statistics&id=" + ids.map(encodeURIComponent).join(","), a.token)); }
      catch (e) { note = str(e && e.message || e, 160); }
    } else note = "the soul's YouTube quota for today is spent; the benchmarks wait for next week";
  } else note = "no benchmark channels are set yet; add up to ten from the console";
  return { ok: true, at: nowIso(), date, week: isoWeek(date), house: { subscribers: mine.subscribers, views: mine.views, videos: mine.videos, hiddenSubscribers: mine.hiddenSubscribers },
    benchmarks, note, units: ids.length ? 2 : 1 };
}

export const RADAR_QUERIES = Object.freeze(["what is islam", "quran explained", "prophet stories", "islamic history", "dua", "names of allah", "jesus in islam", "ramadan"]);
export const RADAR_PER_DAY = 2;
export const RADAR_UNITS = 101;          /* one search.list (100) and one videos.list (1) */
export const KIND_WORDS = Object.freeze({
  verse: ["quran", "qur'an", "surah", "sura", "ayah", "ayat", "verse", "verses", "recitation", "recite", "tafsir"],
  word: ["arabic", "word", "words", "meaning", "dictionary", "root"],
  name: ["names of allah", "name of allah", "asma", "husna", "99 names", "attributes of allah"],
  light: ["prophet", "prophets", "story", "stories", "seerah", "sirah", "companion", "companions", "sahaba", "history", "muhammad", "jesus", "isa", "musa", "moses", "ibrahim"],
  know: ["what is", "explained", "facts", "did you know", "islam", "ramadan", "hajj", "belief", "pillars"],
  short: ["shorts", "#shorts"],
  dua: ["dua", "du'a", "duaa", "supplication"]
});
export function mapKinds(text) {
  const t = " " + String(text || "").toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9#' ]+/g, " ").replace(/\s+/g, " ") + " ";
  return Object.keys(KIND_WORDS).filter(k => KIND_WORDS[k].some(w => t.includes(" " + w + " ")));
}
const decodeEnt = s => String(s || "").replace(/&#39;/g, "'").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
export function summariseRadar(results) {
  const rising = Object.keys(results || {}).map(q => {
    const r = results[q] || {};
    const videos = (r.videos || []).map(v => ({ title: str(decodeEnt(v.title), 100), views: intOrNull(v.views) }));
    const views = videos.reduce((a, v) => a + (v.views || 0), 0);
    const kinds = [...new Set([...mapKinds(q), ...videos.flatMap(v => mapKinds(v.title))])];
    return { query: q, views, videos, kinds, ok: r.ok !== false, why: r.why || null };
  }).sort((a, b) => b.views - a.views);
  const byKind = {};
  for (const x of rising) for (const k of x.kinds) byKind[k] = (byKind[k] || 0) + x.views;
  const signals = rising.filter(x => x.views > 0).slice(0, 5).map(x => "\"" + x.query + "\": the top 5 videos of the last 30 days hold " + x.views + " views" + (x.kinds.length ? "; the house's shelves that answer it: " + x.kinds.join(", ") : ""));
  return { rising, byKind, signals };
}
/* a step a day: at most two searches, until all eight of the week are read */
export async function radarStep(date) {
  const week = isoWeek(date);
  let st;
  try { st = (await getJSON(K.radar(week), null)) || { week, results: {}, days: {} }; } catch { return { ok: false, why: "the radar's week could not be read" }; }
  const left = RADAR_QUERIES.filter(q => !st.results[q]);
  if (!left.length) return { ok: true, complete: true, progress: { done: RADAR_QUERIES.length, of: RADAR_QUERIES.length }, already: true };
  const todayCount = st.days[date] || 0;
  if (todayCount >= RADAR_PER_DAY) return { ok: true, complete: false, progress: { done: RADAR_QUERIES.length - left.length, of: RADAR_QUERIES.length }, note: "two searches a day; the rest tomorrow" };
  const a = await ytAuth();
  if (!a.ok) return a;
  const after = new Date(Date.parse(date + "T00:00:00Z") - 30 * 86400000).toISOString();
  let ran = 0, note = null;
  for (const q of left.slice(0, RADAR_PER_DAY - todayCount)) {
    if (!(await ytReserve(RADAR_UNITS, date))) { note = "the soul's YouTube quota for today is spent; the radar goes on tomorrow"; break; }
    try {
      const s = await ytGet("/search?part=snippet&type=video&order=viewCount&maxResults=5&publishedAfter=" + encodeURIComponent(after) + "&q=" + encodeURIComponent(q), a.token);
      const items = (s.items || []).map(it => ({ id: it.id && it.id.videoId, title: it.snippet && it.snippet.title })).filter(x => x.id);
      let stats = {};
      if (items.length) {
        const v = await ytGet("/videos?part=statistics&id=" + items.map(x => encodeURIComponent(x.id)).join(","), a.token);
        for (const it of (v.items || [])) stats[it.id] = intOrNull(it.statistics && it.statistics.viewCount);
      }
      st.results[q] = { ok: true, at: nowIso(), videos: items.map(x => ({ title: str(decodeEnt(x.title), 100), views: stats[x.id] == null ? null : stats[x.id] })) };
    } catch (e) { st.results[q] = { ok: false, why: str(e && e.message || e, 160), videos: [] }; }
    ran++;
    st.days[date] = (st.days[date] || 0) + 1;
  }
  try { await setJSON(K.radar(week), st, 30 * 86400); } catch { }
  const done = RADAR_QUERIES.filter(q => st.results[q]).length;
  const progress = { done, of: RADAR_QUERIES.length };
  if (done < RADAR_QUERIES.length) return { ok: true, complete: false, progress, ran, note };
  const sum = summariseRadar(st.results);
  return { ok: true, complete: true, at: nowIso(), date, week, progress, ran, ...sum, windowDays: 30 };
}
export async function radarProgress(date) {
  try {
    const st = await getJSON(K.radar(isoWeek(date)), null);
    const done = st ? RADAR_QUERIES.filter(q => st.results && st.results[q]).length : 0;
    return { week: isoWeek(date), done, of: RADAR_QUERIES.length };
  } catch { return { week: isoWeek(date), done: null, of: RADAR_QUERIES.length }; }
}

/* ---------------------------------------------------------------------------
   10. COVERAGE. How many cards of each kind the shelf holds (reels/index.json,
       read from the deployment's files), how many have ever gone out (the
       poster's per-network ledger, nsoc:reels:postedch, `<reel>|<network>`),
       and how many days the rest last at the rota's own pace
       (api/_schedule.js rotaPerWeek). Under 30 days is flagged.
--------------------------------------------------------------------------- */
export const RUNWAY_MIN_DAYS = 30;
export const POSTED_LEDGER = "nsoc:reels:postedch";
export function localCards() {
  if (seams.files && seams.files.manifest != null) return Array.isArray(seams.files.manifest.cards) ? seams.files.manifest.cards : [];
  try {
    const j = JSON.parse(fs.readFileSync(path.join(process.cwd(), "reels", "index.json"), "utf8"));
    return j && Array.isArray(j.cards) ? j.cards : null;
  } catch { return null; }
}
export function coverageOf(cards, posted, perWeek) {
  const byKind = {};
  for (const c of cards || []) {
    if (!c || !c.id) continue;
    const k = c.kind || "light";
    const b = byKind[k] = byKind[k] || { kind: k, cards: 0, posted: 0, remaining: 0 };
    b.cards++;
    if (posted.has(String(c.id))) b.posted++; else b.remaining++;
  }
  const kinds = Object.values(byKind).map(b => {
    const pw = (perWeek && perWeek[b.kind]) || 0;
    const runwayDays = pw > 0 ? Math.floor(b.remaining * 7 / pw + 1e-9) : null;
    return { ...b, perWeek: pw, runwayDays, low: runwayDays != null && runwayDays < RUNWAY_MIN_DAYS,
      note: pw > 0 ? null : b.kind === "day" ? "dated: each card has its own Hijri day" : "not on the rota" };
  }).sort((a, b) => (a.runwayDays == null ? 1e9 : a.runwayDays) - (b.runwayDays == null ? 1e9 : b.runwayDays));
  const ranked = kinds.filter(k => k.runwayDays != null);
  return { kinds, low: kinds.filter(k => k.low).map(k => k.kind), minRunwayDays: ranked.length ? ranked[0].runwayDays : null,
    total: kinds.reduce((a, k) => a + k.cards, 0), postedTotal: kinds.reduce((a, k) => a + k.posted, 0) };
}
export async function takeCoverage(date, D) {
  let cards = localCards();
  if (!cards && D && typeof D.manifest === "function") { try { cards = await D.manifest(); } catch { cards = null; } }
  if (!cards || !cards.length) return { ok: false, why: "the reels manifest could not be read" };
  let raw;
  try { raw = (await store([["HGETALL", POSTED_LEDGER]]))[0] || []; } catch { return { ok: false, why: "the poster's ledger could not be read" }; }
  const pairs = Array.isArray(raw) ? raw : Object.entries(raw).flat();
  const posted = new Set();
  for (let i = 0; i + 1 < pairs.length; i += 2) { const f = String(pairs[i]); const bar = f.lastIndexOf("|"); if (bar > 0) posted.add(f.slice(0, bar)); }
  const noShorts = !cards.some(c => c && c.kind === "short");
  return { ok: true, at: nowIso(), date, week: isoWeek(date), ...coverageOf(cards, posted, rotaPerWeek(noShorts)) };
}

/* ---------------------------------------------------------------------------
   11. THE DAY'S RUN: each tool once when due, on its own clock, its result
       kept; the mind calls this between its own time checks
--------------------------------------------------------------------------- */
/* YouTube's daily quota resets at midnight Pacific time (07:00 or 08:00
   UTC). The soul's own YouTube reads wait until 09:00 UTC, so everything it
   spends in a UTC day (at most YT_UNITS_DAY, counted per UTC day) falls in
   one YouTube quota day, after the reset, never straddling it. The daily
   cycle runs at 05:00, so these two are taken by the first tick after 09:00
   (api/_mind.js tick), or by any cycle that runs later in the day. */
export const YT_HOUR_UTC = 9;
export const youtubeHourOk = () => new Date(nowMsI()).getUTCHours() >= YT_HOUR_UTC;
export async function takeIfDue(name, ctx = {}) {
  const date = ctx.date || dayOf();
  if ((name === "youtube" || name === "radar") && !youtubeHourOk())
    return { ran: false, ok: true, deferred: true, note: "YouTube is read after " + YT_HOUR_UTC + ":00 UTC, once its daily quota has reset" };
  let due = true;
  try { due = name === "radar" ? true : await isDue(name, date); } catch { due = true; }
  if (!due) return { ran: false, ok: true, latest: await readLatest(name) };
  const box = TIME_BOX[name] || 30000;
  let r;
  if (name === "coverage") r = await soft("coverage", box, () => takeCoverage(date, ctx.D));
  else if (name === "search") r = await soft("the search audit", box, () => searchAudit(date));
  else if (name === "speed") r = await soft("page speed", box, () => pageSpeed(date, localCards() || []));
  else if (name === "youtube") r = await soft("the YouTube position", box, () => youtubePosition(date));
  else if (name === "radar") {
    const t = await readTry("radar");
    if (t && t.week === isoWeek(date) && t.ok && t.complete) return { ran: false, ok: true, latest: await readLatest("radar") };
    r = await soft("the topic radar", box, () => radarStep(date));
    if (r && r.ok && !r.complete) {
      try { await store([["SET", K.inst("radar:try"), JSON.stringify({ ok: true, complete: false, date, week: isoWeek(date), progress: r.progress, at: nowIso() }), "EX", String(120 * 86400)]]); } catch { }
      return { ran: true, ok: true, partial: true, progress: r.progress, note: r.note || null };
    }
    if (r && r.ok && r.already) return { ran: false, ok: true, latest: await readLatest("radar") };
  } else return { ran: false, ok: false, why: "no such instrument: " + name };
  try {
    const tr = await saveResult(name, r, date);
    if (name === "radar" && r.ok) await store([["SET", K.inst("radar:try"), JSON.stringify({ ...tr, complete: true }), "EX", String(120 * 86400)]]);
  } catch { }
  return { ran: true, ...(r || { ok: false, why: "no answer" }) };
}

/* the totals each tool adds to the day's snapshot (SOUL.md section 6):
   carried forward from its latest reading, with the date it was read */
export async function snapshotPart() {
  const [search, speed, yt, cov, radar] = await Promise.all(["search", "speed", "youtube", "coverage", "radar"].map(readLatest));
  return {
    search: search ? { score: search.score, sampled: search.sampled, failing: (search.failures || []).length, date: search.date } : null,
    speed: speed ? { score: speed.score, pages: (speed.pages || []).map(p => ({ name: p.name, score: p.ok ? p.score : null, lcpMs: p.ok ? p.lcpMs : null, cls: p.ok ? p.cls : null, inpMs: p.ok ? p.inpMs : null })), date: speed.date } : null,
    youtube: yt && yt.house ? { subscribers: yt.house.subscribers, views: yt.house.views, videos: yt.house.videos, date: yt.date } : null,
    coverage: cov ? { minRunwayDays: cov.minRunwayDays, low: cov.low || [], date: cov.date } : null,
    radar: radar ? { top: (radar.rising || []).slice(0, 3).map(x => ({ query: x.query, views: x.views })), date: radar.date } : null
  };
}

/* the same readings, as the evidence pack the planner and the council read:
   totals only, the radar's public search signals, and the IndexNow queue
   (ready only once the key file is served on the live site) */
export async function evidencePart(date, ready) {
  const [search, speed, yt, cov, radar] = await Promise.all(["search", "speed", "youtube", "coverage", "radar"].map(readLatest));
  let ix = null;
  try { ix = await indexnowStatus(date); } catch { ix = null; }
  return {
    search: search ? { score: search.score, sampled: search.sampled, counts: search.counts, week: search.week } : null,
    speed: speed ? { score: speed.score, pages: (speed.pages || []).map(p => ({ name: p.name, score: p.ok ? p.score : null, lcpMs: p.ok ? p.lcpMs : null, cls: p.ok ? p.cls : null, inpMs: p.ok ? p.inpMs : null })), week: speed.week } : null,
    youtube: yt && yt.house ? { ...yt.house, benchmarks: (yt.benchmarks || []).map(b => ({ title: b.title, subscribers: b.subscribers, views: b.views, videos: b.videos })), week: yt.week } : null,
    coverage: cov ? { minRunwayDays: cov.minRunwayDays, low: (cov.kinds || []).filter(k => k.low).map(k => ({ kind: k.kind, remaining: k.remaining, runwayDays: k.runwayDays })) } : null,
    demand: radar ? { week: radar.week, signals: radar.signals || [], byKind: radar.byKind || {} } : null,
    indexnow: ix ? { pending: ix.pending, perDay: INDEXNOW_DAY_MAX, submittedToday: ix.submittedToday, ready: !!ready } : null
  };
}

/* ---------------------------------------------------------------------------
   12. THE WEEKLY SCORECARD, one fixed shape, built on Mondays for the week
       that has just ended, kept as nsoul:scorecard:<YYYY-Www>
--------------------------------------------------------------------------- */
export const SCORE_METRICS = Object.freeze([
  ["northStar", "people reached this week"], ["reach.instagram", "Instagram reach"], ["reach.youtube", "YouTube views"],
  ["reach.facebook", "Facebook reach"], ["reach.threads", "Threads views"], ["site.visitors7", "site visitors"],
  ["site.searchShare", "search share of arrivals"], ["attention.watchedMedian", "median watched share"],
  ["output.health", "posting health"], ["output.posts7", "posts sent"], ["spend.usd", "paid model spend this month"]
]);
export async function buildScorecard(opts = {}) {
  const today = opts.date || dayOf();
  const week = isoWeek(addDays(today, -1));
  const b = weekBounds(week);
  const series = await readSeries(36, b.to);
  const byDate = new Map(series.map(x => [x.date, x.snap]));
  /* a week's figure is its Sunday's, or the latest day of that week read */
  const weekEnd = to => { for (let i = 0; i < 7; i++) { const s = byDate.get(addDays(to, -i)); if (s) return s; } return null; };
  const ends = [3, 2, 1, 0].map(k => weekEnd(addDays(b.to, -7 * k)));
  const metric = (p, label) => {
    const trend = ends.map(s => { const v = metricValue(s, p); return typeof v === "number" ? v : null; });
    const value = trend[3], weekAgo = trend[2];
    return { path: p, label, value, weekAgo, delta: value != null && weekAgo != null ? r3(value - weekAgo) : null,
      deltaPct: value != null && weekAgo ? Math.round((value - weekAgo) / Math.abs(weekAgo) * 1000) / 10 : null, trend4w: trend };
  };
  const metrics = SCORE_METRICS.map(([p, l]) => metric(p, l));
  const goals = (await readGoals().catch(() => [])).filter(g => g && g.status !== "retired").map(g => trajectory(g, today))
    .map(t => ({ id: t.id, owner: t.owner, outcome: t.outcome, metric: t.metric, status: t.status, value: t.value, target: t.target, due: t.due, projected: t.projected, eta: t.eta, confidence: t.confidence }));
  const acts = (await actionsList().catch(() => [])).filter(a => a && a.tier === "R2" && a.ok && String(a.at || "").slice(0, 10) >= b.from && String(a.at || "").slice(0, 10) <= b.to);
  const effects = (await readEffects(100)).filter(e => e && String(e.at || "").slice(0, 10) >= b.from && String(e.at || "").slice(0, 10) <= today);
  const anomalies = (await readAnomalies()).filter(x => x.date >= b.from && x.date <= b.to).flatMap(x => (x.flags || []).map(f => ({ date: x.date, kind: f.kind, label: f.label, severity: f.severity, sentence: f.sentence })));
  const [search, speed, yt, radar, cov] = await Promise.all(["search", "speed", "youtube", "radar", "coverage"].map(readLatest));
  const end = ends[3] || {};
  const card = {
    week, from: b.from, to: b.to, builtAt: nowIso(), builtOn: today,
    northStar: metrics[0],
    metrics: metrics.slice(1),
    goals,
    posts: opts.posts || { top: [], bottom: [] },
    actions: { count: acts.length, list: acts.slice(0, 12).map(a => ({ id: a.id, action: a.hand, date: String(a.at || "").slice(0, 10), metric: a.metric || null, verdict: a.effect ? a.effect.verdict : null })) },
    effects: { ...effectsSummary(effects), list: effects.slice(0, 10).map(e => ({ action: e.action, metric: e.metric, date: e.date, delta: e.delta, baselineDelta: e.baselineDelta, verdict: e.verdict })) },
    anomalies,
    search: search ? { score: search.score, sampled: search.sampled, failing: (search.failures || []).length, week: search.week } : null,
    speed: speed ? { score: speed.score, pages: (speed.pages || []).map(p => ({ name: p.name, score: p.ok ? p.score : null, lcpMs: p.ok ? p.lcpMs : null })), week: speed.week } : null,
    youtube: yt && yt.house ? { subscribers: yt.house.subscribers, views: yt.house.views, videos: yt.house.videos, benchmarks: (yt.benchmarks || []).length, week: yt.week } : null,
    radar: radar ? { signals: (radar.signals || []).slice(0, 3), week: radar.week } : null,
    coverage: cov ? { minRunwayDays: cov.minRunwayDays, low: cov.low || [] } : null,
    spend: { usd: num(metricValue(end, "spend.usd")), capUsd: num(metricValue(end, "spend.capUsd")) }
  };
  return card;
}
export async function saveScorecard(card) {
  await store([["SET", K.scorecard(card.week), JSON.stringify(card), "EX", String(400 * 86400)]]);
  const r = await store([["LRANGE", K.scorecards, "0", "59"]]);
  if (!(r[0] || []).includes(card.week)) await store([["LPUSH", K.scorecards, card.week], ["LTRIM", K.scorecards, "0", "59"]]);
}
export async function readScorecard(week) {
  let weeks = [];
  try { weeks = ((await store([["LRANGE", K.scorecards, "0", "59"]]))[0] || []).map(String); } catch { weeks = []; }
  const w = week && /^\d{4}-W\d{2}$/.test(String(week)) ? String(week) : weeks[0];
  const card = w ? await getJSON(K.scorecard(w), null).catch(() => null) : null;
  return { week: w || null, scorecard: card, weeks };
}
/* the short text sent to the owner on Telegram with the weekly summary */
export function scorecardText(c) {
  if (!c) return "";
  const n = v => (v == null ? "not read" : String(Math.round(v)));
  const ns = c.northStar || {};
  const parts = ["Week " + c.week + ": " + n(ns.value) + " people reached" + (ns.deltaPct != null ? " (" + (ns.deltaPct > 0 ? "+" : "") + ns.deltaPct + " percent on the week before)" : "") + "."];
  const counts = { "on-track": 0, behind: 0, met: 0, "no-data": 0 };
  for (const g of c.goals || []) counts[g.status] = (counts[g.status] || 0) + 1;
  parts.push("Goals: " + counts["on-track"] + " on track, " + counts.behind + " behind, " + counts.met + " met.");
  if (c.actions) parts.push(c.actions.count + " public action" + (c.actions.count === 1 ? "" : "s") + (c.effects && c.effects.total ? "; measured: " + c.effects.helped + " helped, " + c.effects.hurt + " hurt, " + c.effects.unclear + " unclear" : "") + ".");
  if (c.anomalies && c.anomalies.length) parts.push(c.anomalies.length + " anomal" + (c.anomalies.length === 1 ? "y" : "ies") + ".");
  if (c.search && c.search.score != null) parts.push("Search readiness " + c.search.score + " of 100.");
  if (c.speed && c.speed.score != null) parts.push("Page speed " + c.speed.score + " of 100.");
  if (c.coverage && c.coverage.low && c.coverage.low.length) parts.push("Under 30 days of reels left: " + c.coverage.low.join(", ") + ".");
  return parts.join(" ").slice(0, 600);
}
