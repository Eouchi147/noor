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
// GET  /api/soul?view=mail             the Mail room (LANTERN.md section 11,
//   6 October 2026): the switch and its caps, the first ten, today, the
//   threads the Lantern handled, the places, do not contact, `missing`.
// POST {action:"mail-switch", on} | {action:"dnc-add"|"dnc-remove",
//      address}: the owner's own, each answering {ok, message}.
// GET  /api/soul?action=tick           the cron, every fifteen minutes; after
//   the cycle it reads the mailbox (api/_mail.js mailTick), answered as
//   `mail` beside the cycle's own fields; then (round four) the owner's voice
//   (api/_voice.js voiceTick): letters waiting for his Send, at most once in
//   six hours, and the evening digest from 22:00 UTC, answered as `voice`.
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
  readSeries, auditVerify, spendView, countsToday, dayOf, storeReady, setRequest, actionsList, sayLantern, auditAppend
} from "./_soul.js";
import * as I from "./_instruments.js";
import { undoAction } from "./_hands.js";
import { tick, readCycle } from "./_mind.js";
import { readPlaybook, listProposals, listUpgrades, setUpgradeStatus } from "./_evolve.js";
import { homeView, doNow, skipNext, ideaChoice } from "./_home.js";
import { decide, closeByRef } from "./_decisions.js";
import * as MAIL from "./_mail.js";   /* mail: the Lantern's mailbox (LANTERN.md section 11) */
import * as VOICE from "./_voice.js";   /* round four: the owner's voice, urgent now and the rest at 22:00 */

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
  /* review fix, 7 October 2026: production always carries CRON_SECRET, so a
     production without it admits no tick at all (fail closed): a user agent
     can be typed by anyone. Previews and tests keep the old proof. */
  if (!secret && process.env.VERCEL_ENV === "production") return false;
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

/* mail: the mailbox after the cycle, under a hard clock of its own (its
   minute, its last message and its goodbye to the server); never throws */
export const MAIL_TICK_HARD_MS = 80000;
async function mailAfterTick(t0) {
  let timer;
  try {
    return await Promise.race([MAIL.mailTick({ startedAt: t0 }),
      new Promise(res => { timer = setTimeout(() => res({ ok: false, error: "the mailbox took longer than " + MAIL_TICK_HARD_MS / 1000 + " seconds; it is read again at the next tick" }), MAIL_TICK_HARD_MS); })]);
  } catch (e) { return { ok: false, error: sayLantern(String(e && e.message || e).slice(0, 160)) }; }
  finally { clearTimeout(timer); }
}

/* round seven: one line of counts a search, so the house can see its search
   work (never a place's address: counts, the source and the reason only) */
function logOutreach(from, r) {
  try {
    if (!r || (!r.ran && r.ok !== false)) return;
    console.log(JSON.stringify({ noor: "outreach", from, ran: !!r.ran, ok: r.ok !== false, added: Number(r.added) || 0, checked: Number(r.checked) || 0,
      why: String(r.why || r.error || "").replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, "[an address]").slice(0, 240) }));
  } catch { }
}
/* round six: the outreach's tick (api/_outreach.js outreachTick), never a throw */
export const OUTREACH_TICK_HARD_MS = 60000;
async function outreachAfterTick(t0) {
  let timer;
  try {
    const O = await MAIL.outreachModule();
    if (!O || typeof O.outreachTick !== "function") return { ok: true, ran: false, why: "the outreach tick is not on this deployment" };
    const r = await Promise.race([O.outreachTick({ until: t0 + 285000 }),
      new Promise(res => { timer = setTimeout(() => res({ ok: false, error: "the search for places took longer than " + OUTREACH_TICK_HARD_MS / 1000 + " seconds; it goes on at the next tick" }), OUTREACH_TICK_HARD_MS); })]);
    logOutreach("tick", r);
    return r;
  } catch (e) { return { ok: false, error: sayLantern(String(e && e.message || e).slice(0, 160)) }; }
  finally { clearTimeout(timer); }
}
/* round six: the owner's one-time start of the outreach, in two steps the
   console runs while he watches: research now (one search, its own clock),
   then a plan now (the cycle, as Think again), whose pace step offers the
   first letters. The button is spent only once a plan has started. */
async function outreachStart(step) {
  const st = await MAIL.outreachStartState();
  if (st.usedAt) return { ok: false, used: true, usedAt: st.usedAt, message: "The outreach has already started; it runs on its own now." };
  if (!st.available) return { ok: false, message: st.why || "The outreach cannot start just now." };
  const O = await MAIL.outreachModule();
  if (!O || typeof O.outreachTick !== "function") return { ok: false, message: "The outreach is not on this deployment yet." };
  if (step === "research") {
    const r = await O.outreachTick({ until: Date.now() + 70000 });
    logOutreach("start", r);
    let pace = null;
    try { pace = typeof O.outreachCounts === "function" ? ((await O.outreachCounts()) || {}).pace || null : null; } catch { pace = null; }
    const added = Number(r && r.added) || 0, checked = Number(r && r.checked) || 0;
    const message = r && r.ran
      ? (added ? "Found " + added + " new place" + (added === 1 ? "" : "s") + " (" + checked + " checked)."
        : r.why ? sayLantern(String(r.why).charAt(0).toUpperCase() + String(r.why).slice(1)).replace(/[.\s]*$/, ".") : "No new place this time (" + checked + " checked).")
      : sayLantern(String((r && (r.why || r.error)) || "No search ran just now."));
    return { ok: !!r && r.ok !== false, ran: !!(r && r.ran), added, checked, ready: pace ? pace.ready : null, foundToday: pace ? pace.found : null, message };
  }
  if (step === "plan") {
    /* spent before the plan runs, so a plan longer than the request still
       counts; given back only when no plan could start */
    await MAIL.markOutreachStart({ cycle: null });
    let r;
    try { r = await tick({ force: true, by: "owner" }); }
    catch (e) { await MAIL.clearOutreachStart(); return { ok: false, message: "The plan could not start: " + sayLantern(String(e && e.message || e).slice(0, 160)) + "." }; }
    if (!r || r.busy || r.fresh === false || r.paused || r.error) {
      await MAIL.clearOutreachStart();
      return { ok: false, busy: !!(r && (r.busy || r.fresh === false)),
        message: r && r.error ? sayLantern(String(r.error)) : r && r.paused ? "The Lantern is paused; resume it first." : "The Lantern is in the middle of a plan. Press Start again in a few minutes; your first letters come with the next one." };
    }
    await MAIL.markOutreachStart({ cycle: r.id || null });
    const st2 = await MAIL.outreachStartState();
    try { await auditAppend({ kind: "outreach-start", actor: "owner", summary: "the owner started the outreach from Home", data: { cycle: r.id || null } }); } catch { }
    /* round seven: what the plan truly holds, never a guess */
    let rec = null;
    try { rec = r.id ? await readCycle(r.id) : null; } catch { rec = null; }
    const letters = rec && Array.isArray(rec.intents) ? rec.intents.filter(i => i && i.action === "outreach-send") : [];
    const written = letters.filter(i => i.status === "done").length;
    const message = r.status !== "done"
      ? (letters.length ? "The Lantern planned " + letters.length + " first letter" + (letters.length === 1 ? "" : "s") + "; the council reads each, then they are written. The first 10 wait here for your Send." : "The Lantern is planning now. Its first letters come as soon as places are ready.")
      : letters.length ? (written ? written + " first letter" + (written === 1 ? " was" : "s were") + " written; they wait above for your Send." : "The Lantern planned " + letters.length + " letters, but none could be written yet; it tries again at its next plan.")
      : "No place was ready for a first letter yet. The search goes on every 15 minutes, and this button stays until the first letter is written.";
    return { ok: true, started: true, usedAt: st2.usedAt, cycle: { id: r.id || null, stage: r.stage || null, status: r.status || null }, letters: letters.length, written, message };
  }
  return { ok: false, message: "Say research or plan." };
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
      if (isTick) {
        /* mail: the mailbox is read after the cycle's own stages, on its own
           lock and clock, never holding them up (LANTERN.md section 11) */
        const t0 = Date.now();
        let r, fault = null;
        try { r = await tick({ by: gate.ok ? "owner" : "cron" }); } catch (e) { fault = e; }
        const mail = await mailAfterTick(t0);
        /* round four: then the voice, under its own short clock, never a throw */
        let voice, vt;
        try { voice = await Promise.race([VOICE.voiceTick(), new Promise(res2 => { vt = setTimeout(() => res2({ ok: false, error: "the voice took longer than 15 seconds" }), 15000); })]); }
        catch (e) { voice = { ok: false, error: sayLantern(String(e && e.message || e).slice(0, 160)) }; }
        finally { clearTimeout(vt); }
        /* round six (7 October 2026): then the outreach's search for places,
           every tick until the day's are found, under its own clock */
        const outreach = await outreachAfterTick(t0);
        if (fault) throw fault;
        return json(res, 200, r && typeof r === "object" ? { ...r, mail, voice, outreach } : r);
      }
      const view = String(q.view || "today");
      if (view === "home") return json(res, 200, await homeView());
      /* mail: the Mail room (threads, places, do not contact, the switch) */
      if (view === "mail") return json(res, 200, await MAIL.mailView());
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
    /* mail: the switch and do not contact (LANTERN.md section 11), the owner's only */
    if (action === "mail-switch") {
      const on = body.on === true || body.on === "true" || body.on === 1 || body.on === "1" ? true : body.on === false || body.on === "false" || body.on === 0 || body.on === "0" ? false : null;
      if (on === null) return json(res, 400, { ok: false, message: "Say on or off." });
      return json(res, 200, await MAIL.mailSwitch(on));
    }
    if (action === "dnc-add") return json(res, 200, await MAIL.addDoNotContact(String(body.address || ""), "the owner"));
    /* round six: the Mail room's buttons on one message, and the one-time start */
    if (action === "mail-thread") return json(res, 200, await MAIL.mailThread(String(body.id || ""), String(body.op || "")));
    if (action === "outreach-start") return json(res, 200, await outreachStart(String(body.step || "")));
    if (action === "dnc-remove") return json(res, 200, await MAIL.removeDoNotContact(String(body.address || "")));
    return json(res, 400, { ok: false, error: "unknown action", message: "That is not something the Lantern knows how to do." });
  } catch (e) {
    const said = sayLantern(String(e && e.message || e).slice(0, 200));
    return json(res, 200, { ok: false, error: said, message: "That could not be done: " + said });
  }
}
