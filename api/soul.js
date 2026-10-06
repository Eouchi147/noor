// NOOR · the Soul's door: the console's view of it, and the cron's tick.
// ---------------------------------------------------------------------------
// GET  /api/soul?view=home             the owner's Home (LANTERN.md section
//   2, 3 October 2026): the brief, his decisions, Done, Next, what is
//   coming, the goals, the ideas, today, the voice and the spend, each part
//   failing soft on its own (null, with its reason in `missing`).
// POST {action:"decide", id, option} | {action:"do-now", id} |
//      {action:"skip", id} | {action:"idea", id, choice}: the Home's buttons,
//   each answering {ok, message} in plain words, never a throw.
// GET  /api/soul?view=today            the morning at a glance: paused, the
//   mission, the north star and its series, the goals, the last cycle, the
//   month's spend and today's public actions against the cap.
// GET  /api/soul?view=chronicle&limit= what the soul did, cycle by cycle.
// GET  /api/soul?view=metrics&days=    the daily snapshots.
// GET  /api/soul?view=cycle&id=        one cycle whole: intents, verdicts.
// GET  /api/soul?view=audit&limit=     the audit chain, and whether it holds.
// GET  /api/soul?view=evolution        the playbook, proposals, upgrades.
// GET  /api/soul?view=trajectories|effects|scorecard&week=|search|speed|
//      youtube|radar|coverage           the instruments (SOUL.md section 11).
// POST {action:"pause"|"resume"|"run"|"undo"|"goal"|"upgrade"|"benchmarks"|
//      "tg-code"|"tg-link"|"tg-test"}
// GET  /api/soul?action=tick           the cron, every fifteen minutes.
// GET  /api/soul?action=indexnow-key&key=  PUBLIC: the IndexNow key file,
//   reached at /<key>.txt through vercel.json's rewrite. It answers the key
//   as plain text when the name asked for is the key, and 404 otherwise;
//   it reads one store key and writes nothing.
//
// Owner-gated exactly like api/experiments.js (the console's signed cookie,
// or ADMIN_SECRET in a header for a hand-run request), the whole handler in
// one try/catch so a fault anywhere answers a plain refusal, never a stack.
// The cron is admitted for `tick` alone, the way api/social.js admits it for
// `due`: with CRON_SECRET set, its bearer is the only proof; a house that
// never set one keeps the Vercel cron's own user agent as the proof.
//
// This file only wires the gate and the HTTP shape. Every decision lives in
// api/_soul.js, api/_hands.js, api/_council.js, api/_mind.js and
// api/_evolve.js, which is what tests/soul.mjs tests.
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import { ownerGate } from "./_owner.js";
import {
  MISSION, K, CAP_LIMITS, store, parse, isPaused, setPaused, readGoals, setOwnerGoal, chronicleRead,
  readSeries, auditVerify, spendView, countsToday, dayOf, storeReady, setRequest, actionsList, sayLantern
} from "./_soul.js";
import * as I from "./_instruments.js";
import { undoAction } from "./_hands.js";
import { tick, readCycle } from "./_mind.js";
import { readPlaybook, listProposals, listUpgrades, setUpgradeStatus } from "./_evolve.js";
import { homeView, doNow, skipNext, ideaChoice } from "./_home.js";
import { decide, closeByRef } from "./_decisions.js";

const json = (res, code, obj) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(obj);
};
export const KEY_MISS_MS = 60000;
export const KEY_MISSES = new Map();
const int = (v, d, lo, hi) => Math.max(lo, Math.min(hi, parseInt(v, 10) || d));
const text = (res, code, body, cache) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  if (cache) res.setHeader("Cache-Control", cache);
  res.status(code);
  return typeof res.send === "function" ? res.send(body) : res.end(body);
};

function cronAdmitted(req) {
  const h = req.headers || {};
  const fromVercelCron = !!h["x-vercel-signature"] || /vercel-cron/i.test(String(h["user-agent"] || ""));
  const bearer = String(h.authorization || "").replace(/^Bearer\s+/i, "");
  const secret = process.env.CRON_SECRET || "";
  const bearerOk = !!secret && bearer.length === secret.length && crypto.timingSafeEqual(Buffer.from(bearer), Buffer.from(secret));
  return secret ? bearerOk : fromVercelCron;
}

async function viewToday() {
  const paused = await isPaused();
  const series = await readSeries(30).catch(() => []);
  const points = series.filter(x => x.snap).map(x => ({ date: x.date, value: x.snap.northStar == null ? null : x.snap.northStar }));
  const latest = points.length ? points[points.length - 1] : null;
  const weekAgoDate = latest ? new Date(Date.parse(latest.date + "T00:00:00Z") - 7 * 86400000).toISOString().slice(0, 10) : null;
  const weekAgo = weekAgoDate ? (points.find(p => p.date === weekAgoDate) || {}).value : null;
  const today = dayOf();
  const goals = (await readGoals().catch(() => [])).map(g => {
    let trajectory = null;
    try { const t = I.trajectory(g, today); trajectory = { status: t.status, projected: t.projected, eta: t.eta, slopePerDay: t.slopePerDay, points: t.points, confidence: t.confidence }; } catch { }
    return { ...g, trajectory };
  });
  let lastCycle = null;
  try {
    const ptr = parse((await store([["GET", K.cycleCurrent]]))[0], null);
    const rec = ptr && ptr.id ? await readCycle(ptr.id) : null;
    if (rec) {
      const rep = rec.report || {};
      lastCycle = { id: rec.id, at: rep.at || rec.finishedAt || rec.updatedAt || rec.startedAt, status: rec.status,
        done: rep.done || [], next: rep.next || [], needsYou: rep.needsYou || (rec.failedReason ? [rec.failedReason] : []) };
    }
  } catch { lastCycle = null; }
  const counts = await countsToday();
  /* the owner's Telegram link, yes or no and since when; never the chat */
  let telegram = { linked: false, since: null, at: null };
  try {
    const T = await import("./_telegram.js");
    if (typeof T.ownerStatus === "function") { const st = await T.ownerStatus(); telegram = { linked: !!st.linked, since: st.since || null, at: st.since || null }; }
  } catch { }
  return {
    ok: true, paused, mission: MISSION,
    northStar: { value: latest ? latest.value : null, weekAgo: weekAgo == null ? null : weekAgo, series: points },
    goals, lastCycle,
    spend: await spendView(),
    counts: { actionsToday: counts ? counts.r2 : null, capToday: CAP_LIMITS.r2 },
    telegram
  };
}

/* ---- the instruments (SOUL.md section 11), each view on its own ---- */
async function viewTrajectories() {
  const today = dayOf();
  const goals = await readGoals().catch(() => []);
  let drift = {};
  try { drift = parse((await store([["GET", K.drift]]))[0], {}) || {}; } catch { drift = {}; }
  const items = goals.filter(g => g && g.status !== "retired").map(g => {
    const t = I.trajectory(g, today);
    const d = drift[g.id] || null;
    return { ...t, behindStreak: d ? d.streak : 0, drift: !!(d && d.streak >= I.DRIFT_DAYS) };
  });
  return { ok: true, at: new Date().toISOString(), date: today, items, driftDays: I.DRIFT_DAYS };
}
async function viewEffects(limit) {
  const items = await I.readEffects(limit);
  let pending = 0;
  try {
    pending = (await actionsList()).filter(a => a && a.tier === "R2" && a.ok && a.before && a.before.metric && !a.effect).length;
  } catch { pending = null; }
  return { ok: true, items, summary: I.effectsSummary(items), pending, days: I.EFFECT_DAYS };
}
async function viewInstrument(name) {
  const [latest, last, hist] = await Promise.all([I.readLatest(name), I.readTry(name), I.readHist(name, 12)]);
  return { latest, lastTry: last, history: hist };
}

async function telegramCall(fnName, ...args) {
  let T;
  try { T = await import("./_telegram.js"); } catch (e) { return { ok: false, error: "the Telegram module could not be loaded: " + String(e && e.message || e).slice(0, 120) }; }
  if (typeof T[fnName] !== "function")
    return { ok: false, error: "the private Telegram link is not built on this deployment yet (api/_telegram.js has no " + fnName + ")" };
  const r = await T[fnName](...args);
  return (r && typeof r === "object") ? { ok: r.ok !== false, ...r } : { ok: true, result: r == null ? null : r };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const q = req.query || {};
  setRequest(req);
  /* the one public answer: the IndexNow key file, and only its own name. A
     name that is not the key is remembered for a minute in this instance's
     memory, so a crawler walking random names costs the store nothing */
  if (req.method === "GET" && String(q.action || "") === "indexnow-key") {
    const asked = String(q.key || "").replace(/\.txt$/, "").slice(0, 64);
    const now = Date.now();
    const miss = KEY_MISSES.get(asked);
    if (miss && miss > now) return text(res, 404, "not found");
    try {
      const k = storeReady() ? await I.indexnowKey(false) : null;
      if (!k || !k.key || asked !== k.key) {
        if (KEY_MISSES.size > 500) KEY_MISSES.clear();
        KEY_MISSES.set(asked, now + KEY_MISS_MS);
        return text(res, 404, "not found");
      }
      return text(res, 200, k.key, "public, max-age=3600");
    } catch { return text(res, 404, "not found"); }
  }
  const isTick = req.method === "GET" && String(q.action || "") === "tick";
  const gate = ownerGate(req);
  if (!gate.ok && !(isTick && cronAdmitted(req))) return json(res, gate.code, { ok: false, error: gate.reason });

  try {
    if (!storeReady()) return json(res, 200, { ok: false, error: "no store is configured, so the Lantern has nowhere to live", message: "No store is configured, so the Lantern has nowhere to live." });

    if (req.method === "GET") {
      if (isTick) return json(res, 200, await tick({ by: gate.ok ? "owner" : "cron" }));
      const view = String(q.view || "today");
      if (view === "home") return json(res, 200, await homeView());
      if (view === "today") return json(res, 200, await viewToday());
      if (view === "chronicle") return json(res, 200, { ok: true, items: await chronicleRead(int(q.limit, 20, 1, 400)) });
      if (view === "metrics") {
        const series = await readSeries(int(q.days, 30, 1, 400));
        return json(res, 200, { ok: true, series: series.filter(x => x.snap).map(x => ({ ...x.snap, date: x.date })) });
      }
      if (view === "cycle") {
        let id = String(q.id || "").slice(0, 80);
        if (!id) { const ptr = parse((await store([["GET", K.cycleCurrent]]))[0], null); id = ptr && ptr.id || ""; }
        const rec = id ? await readCycle(id) : null;
        if (!rec) return json(res, 404, { ok: false, error: "no such cycle" });
        /* the record whole, its own fields at the top level as well as under
           `cycle`, so a reader may take either */
        return json(res, 200, { ok: true, ...rec, cycle: rec });
      }
      if (view === "audit") {
        const v = await auditVerify();
        const limit = int(q.limit, 50, 1, 500);
        return json(res, 200, { ok: true, items: v.items.slice(-limit).reverse(), chainOk: v.ok, linksOk: v.chainOk, anchored: v.anchored,
          head: v.head, count: v.count, why: v.why, total: v.items.length });
      }
      if (view === "evolution") {
        return json(res, 200, { ok: true, playbook: await readPlaybook(), proposals: await listProposals(), upgrades: await listUpgrades() });
      }
      if (view === "trajectories") return json(res, 200, await viewTrajectories());
      if (view === "effects") return json(res, 200, await viewEffects(int(q.limit, 50, 1, 200)));
      if (view === "scorecard") {
        const r = await I.readScorecard(String(q.week || ""));
        return json(res, 200, { ok: true, week: r.week, scorecard: r.scorecard, weeks: r.weeks });
      }
      if (view === "search") {
        const v = await viewInstrument("search");
        return json(res, 200, { ok: true, audit: v.latest, lastTry: v.lastTry, history: v.history, indexnow: await I.indexnowStatus(dayOf()) });
      }
      if (view === "speed") { const v = await viewInstrument("speed"); return json(res, 200, { ok: true, speed: v.latest, lastTry: v.lastTry, history: v.history }); }
      if (view === "youtube") { const v = await viewInstrument("youtube"); return json(res, 200, { ok: true, youtube: v.latest, lastTry: v.lastTry, history: v.history, benchmarks: await I.readBenchmarks(), unitsPerDay: I.YT_UNITS_DAY }); }
      if (view === "radar") { const v = await viewInstrument("radar"); return json(res, 200, { ok: true, radar: v.latest, lastTry: v.lastTry, progress: await I.radarProgress(dayOf()), queries: I.RADAR_QUERIES }); }
      if (view === "coverage") {
        let cov = await I.takeCoverage(dayOf(), null).catch(e => ({ ok: false, why: String(e && e.message || e).slice(0, 160) }));
        if (!cov.ok) { const l = await I.readLatest("coverage"); cov = l ? { ...l, stale: true, why: cov.why } : null; }
        return json(res, 200, { ok: true, coverage: cov, minDays: I.RUNWAY_MIN_DAYS });
      }
      return json(res, 400, { ok: false, error: "unknown view" });
    }

    if (req.method !== "POST") return json(res, 405, { ok: false, error: "GET or POST only" });
    let body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    const action = String(body.action || "");

    if (action === "pause") return json(res, 200, { ...(await setPaused(true, "owner")), message: "Paused. The Lantern takes no action until you resume it; posting itself goes on." });
    if (action === "resume") return json(res, 200, { ...(await setPaused(false, "owner")), message: "Resumed. The Lantern is working again." });
    if (action === "run") {
      const r = await tick({ force: true, by: "owner" });
      /* a tick that found a cycle already in hand says so in plain words */
      /* 3 October 2026: a busy run is not a failure; the Home says so plainly */
      if (r && (r.busy || r.fresh === false)) return json(res, 200, { ...r, ok: true, busy: true, message: "The Lantern is already thinking." });
      if (r && r.error) return json(res, 200, { ...r, error: sayLantern(r.error), message: sayLantern(r.error) });
      return json(res, 200, { ...r, message: r && r.status === "done" ? "The Lantern thought again: a cycle ran now, and the Home shows what it did." : "A cycle started now; it goes on at the next tick." });
    }
    if (action === "undo") {
      const r = await undoAction(String(body.id || ""), "owner");
      return json(res, r.code === 404 ? 404 : 200, { ...r, ...(r.error ? { error: sayLantern(r.error) } : {}),
        message: r.ok ? "Undone." + (r.note ? " " + sayLantern(r.note) : "") : "Not undone: " + sayLantern(r.error || "it refused") + "." });
    }
    /* the Home's buttons (LANTERN.md section 2): each answers {ok, message}
       in plain words, and never throws */
    if (action === "decide") return json(res, 200, await decide(String(body.id || ""), String(body.option || "")));
    if (action === "do-now") return json(res, 200, await doNow(String(body.id || "")));
    if (action === "skip") return json(res, 200, await skipNext(String(body.id || "")));
    if (action === "idea") return json(res, 200, await ideaChoice(String(body.id || ""), String(body.choice || "")));
    if (action === "goal") {
      const r = await setOwnerGoal(body.goal);
      return json(res, r.ok ? 200 : 400, r);
    }
    if (action === "upgrade") {
      const r = await setUpgradeStatus(String(body.id || ""), String(body.status || ""), "owner");
      /* moved in the engine room: its "Build this?" card on the Home closes */
      if (r.ok && r.upgrade && r.upgrade.status !== "proposed") { try { await closeByRef("upgrade", r.upgrade.id, r.upgrade.status === "declined" ? "declined" : "yes"); } catch { } }
      return json(res, r.ok ? 200 : 400, r);
    }
    if (action === "benchmarks") {
      const r = await I.setBenchmarks(body.ids);
      return json(res, r.ok ? 200 : 400, r);
    }
    if (action === "tg-code") return json(res, 200, await telegramCall("ownerLinkCode"));
    if (action === "tg-link") return json(res, 200, await telegramCall("ownerLink"));
    if (action === "tg-test") return json(res, 200, await telegramCall("notifyOwner", "NOOR Lantern: a test message from the console, " + dayOf() + ". If you can read this, the link works."));
    return json(res, 400, { ok: false, error: "unknown action", message: "That is not something the Lantern knows how to do." });
  } catch (e) {
    const said = sayLantern(String(e && e.message || e).slice(0, 200));
    return json(res, 200, { ok: false, error: said, message: "That could not be done: " + said });
  }
}
