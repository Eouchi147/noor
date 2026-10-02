/* NOOR · the Soul's instruments, each with its network stood in for.
   ---------------------------------------------------------------------------
   SOUL.md section 11. Proves, with every fetch stubbed (tests/_soul-harness.mjs):
     the Jev sentinel: a high risk rejects and the three reviewers are never
       asked; a low risk lets the three decide; an unreachable or silent Jev
       never blocks; a risky text to the owner is held back with a chronicle
       note; a risky lesson never reaches the canaries;
     trajectories: least squares on known series, projection, the date the
       target is reached, the four statuses and the confidence note;
     the drift alarm after seven behind cycles, told to the owner on the
       seventh and answered by the plan;
     the anomaly watch on a known spike and a known collapse, and silence on
       a quiet month;
     the effects ledger: before, after, the matched baseline, the verdict,
       and the planner told what worked;
     the search readiness audit: sampling, scoring, the failures named;
     IndexNow: the key made once and served at its own name only, 100 URLs a
       day and not one more, a refused ping given back;
     PageSpeed parsed; YouTube parsed, its quota kept; the radar two searches
       a day and mapped to the shelves; the coverage runway; the weekly
       scorecard's fixed shape; every instrument failing soft inside a cycle.

   Run:  node tests/soul-tools.mjs
*/
import fs from 'node:fs';
import {
  S, H, L, NET, onNet, resp, netCalls, resetStore, SOUL, HANDS, COUNCIL, MIND, EVOLVE, INST, DOOR, ROUTER, rolesAsked,
  JEV, jevOn, jevOff, APPROVED, AUTH, door, addDays, CLOCK, setDay, today, NOTIFY, snapFor, putSnap, PAGE, sitemapOf,
  PSI_BODY, YT, worldOn, worldOff, MANIFEST, DEPS
} from './_soul-harness.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const DASH = new RegExp('[\\u2013\\u2014]');
const D0 = '2026-10-07';   /* a Wednesday */
setDay(D0);

/* ===========================================================================
   1. THE SENTINEL
=========================================================================== */
console.log('\nthe Jev sentinel in the council');
{
  resetStore(); ROUTER.calls.length = 0; ROUTER.guardian = 'approve'; ROUTER.skeptic = 'approve';
  const evidence = { byKind: [{ kind: 'verse reels', posts: 12, reach: 1204 }, { kind: 'word reels', posts: 9, reach: 640 }] };
  const swap = { action: 'lineup-swap', args: { date: addDays(D0, 1), slot: 'reelB', id: 'verse-kursi' }, why: 'Verse reels reached 1204 people over 12 posts, against 640 for word reels.', expectedEffect: 'more reach', metric: 'northStar', evidence: { n: 12 } };

  jevOn((k) => k === 'thin_data' ? 0.82 : 0.04);
  let c = await COUNCIL.convene(swap, evidence);
  ok(!c.approved && c.sentinel && c.sentinel.vote === 'reject' && /too little data/.test(c.sentinel.reasons.join(' ')), 'a thin claim (0.82) is rejected by the sentinel with its reason: ' + (c.sentinel && c.sentinel.reasons[0]));
  ok(!rolesAsked().includes('guardian') && !rolesAsked().includes('skeptic'), 'and neither model reviewer was asked (saved two calls)');
  ok(JSON.stringify(c.verdicts) === '{}' && /not asked/.test(c.skipped), 'the record says the three were skipped');
  const sent = JEV.bodies[JEV.bodies.length - 1];
  ok(sent && ['breaks_constitution', 'misrepresents_islam', 'spam_or_bait', 'thin_data'].every(k => sent.questions[k] && sent.questions[k].type === 'noul'), 'Jev was asked the four soul questions, each a probability');
  ok(/lineup-swap/.test(sent.state.text) && /1204/.test(sent.state.text) && !/@/.test(sent.state.text), 'about the intent itself and the totals behind it');
  ok(NET.calls.some(x => x.url === 'https://ai-gateway.vercel.sh/typesafe/v1/systemone' && /Bearer gw-test-key/.test(x.headers.authorization)), 'through the AI Gateway with the deployment\'s credential');

  for (const q of ['breaks_constitution', 'misrepresents_islam', 'spam_or_bait']) {
    jevOn(k => k === q ? 0.5 : 0.1);
    const r = await COUNCIL.convene(swap, evidence);
    ok(!r.approved && r.sentinel.vote === 'reject', q + ' at exactly 0.5 is a reject');
  }

  ROUTER.calls.length = 0;
  jevOn(() => 0.08);
  c = await COUNCIL.convene(swap, evidence);
  ok(c.approved && c.sentinel.vote === 'pass' && rolesAsked().includes('guardian') && rolesAsked().includes('skeptic'), 'every risk low: the sentinel passes it on and the three decide (approved)');

  ROUTER.calls.length = 0;
  jevOn(); JEV.mode = 'down';
  c = await COUNCIL.convene(swap, evidence);
  ok(c.approved && c.sentinel.unavailable && /sentinel unavailable/.test(c.sentinel.reasons[0]), 'Jev unreachable: recorded as "sentinel unavailable", and the three still approve');
  ok(rolesAsked().includes('guardian'), 'the reviewers were asked as before');
  ROUTER.guardian = 'reject';
  c = await COUNCIL.convene(swap, evidence);
  ok(!c.approved && c.verdicts.guardian.vote === 'reject', 'and the Guardian\'s veto still holds without the sentinel');
  ROUTER.guardian = 'approve';

  jevOn(k => k === 'thin_data' ? null : 0.1);
  c = await COUNCIL.convene(swap, evidence);
  ok(c.approved && c.sentinel.unavailable && /incomplete/.test(c.sentinel.reasons[0]), 'an incomplete answer is unavailable, never a pass or a block');
  jevOff();
  const before = JEV.bodies.length;
  c = await COUNCIL.convene(swap, evidence);
  ok(c.approved && c.sentinel.unavailable && /credential/.test(c.sentinel.reasons[0]) && JEV.bodies.length === before, 'no gateway credential: no call at all, and nothing blocked');

  /* through a whole cycle: a rejected intent never reaches the hands */
  resetStore(); setDay(D0); ROUTER.calls.length = 0; NOTIFY.length = 0;
  S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: addDays(D0, -2), args: {} }, history: [] }));
  ROUTER.plan = JSON.stringify({ intents: [swap] });
  jevOn((k, body) => (k === 'spam_or_bait' && /lineup-swap/.test(body.state && body.state.text || '')) ? 0.91 : 0.02);
  const t = await MIND.tick({ force: true });
  const rec = await MIND.readCycle(t.id);
  const it = rec.intents.find(i => i.action === 'lineup-swap');
  ok(t.status === 'done' && it.status === 'rejected' && it.council.sentinel.vote === 'reject', 'in a cycle, the sentinel\'s reject stands: ' + (it && it.status));
  ok(!S.has('nsoc:override:' + addDays(D0, 1)), 'and the line-up was never touched');
  ok(!ROUTER.calls.some(x => x.role === 'guardian'), 'no Guardian call was spent on it');
  const cv = await door({ query: { view: 'cycle', id: t.id }, headers: AUTH });
  ok(cv.body.intents.find(i => i.action === 'lineup-swap').council.sentinel.reasons.length >= 1, 'the cycle view carries the sentinel\'s reasons for the console');
  ok((await SOUL.chronicleRead(1))[0].next.some(n => /sentinel said no/.test(n) && /spam/.test(n)), 'the chronicle names the sentinel as the one that said no');
  jevOff();
}

console.log('\nthe sentinel reads every text to the owner and every lesson');
{
  resetStore(); setDay(D0); NOTIFY.length = 0; ROUTER.calls.length = 0;
  S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: addDays(D0, -2), args: {} }, history: [] }));
  ROUTER.plan = '{"intents":[]}';
  jevOn((k, body) => (body.questions.ruling && k === 'ruling') ? 0.77 : 0.03);
  const t = await MIND.tick({ force: true });
  const rec = await MIND.readCycle(t.id);
  ok(t.status === 'done' && NOTIFY.length === 0 && rec.notified && rec.notified.held, 'a message judged risky (a ruling, 0.77) is not sent: ' + JSON.stringify(rec.notified) + t.status);
  const chron = await SOUL.chronicleRead(1);
  ok(chron[0].highlights.some(h => /held back/.test(h) && /ruling/.test(h)), 'and the chronicle says it was held back, and why');

  resetStore(); NOTIFY.length = 0;
  S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: addDays(D0, -2), args: {} }, history: [] }));
  JEV.mode = 'down';
  const t2 = await MIND.tick({ force: true });
  ok(t2.status === 'done' && NOTIFY.length === 1, 'Jev down: the message goes as before');

  resetStore(); ROUTER.calls.length = 0; ROUTER.guardian = 'smart';
  jevOn((k, body) => /Bukhari/.test(body.state.text) && k === 'hadith_number' ? 0.93 : 0.02);
  await HANDS.runHand({ action: 'lesson-propose', args: { text: 'Lead with the hadith in Bukhari 6018 about guests.', why: 'reach' }, why: 'reach' }, {});
  await HANDS.runHand({ action: 'lesson-propose', args: { text: 'Verse reels under 20 seconds hold people longer.', why: 'the learn block' }, why: 'the learn block' }, {});
  const ev = await EVOLVE.evaluatePending({});
  const props = await EVOLVE.listProposals();
  const bad = props.find(p => /Bukhari/.test(p.lesson.text)), good = props.find(p => /20 seconds/.test(p.lesson.text));
  ok(bad.status === 'refused' && /sentinel/.test(bad.evals.failed[0]) && /hadith/.test(bad.evals.failed[0]), 'a lesson citing a hadith number is refused by the sentinel: ' + bad.evals.failed[0]);
  ok(good.status === 'applied', 'the clean one goes on to the canaries and is applied');
  ok(ROUTER.calls.filter(c => c.role === 'guardian' && c.tier === 'strong').length === 7, 'the canaries ran once, for the clean lesson only (7 Guardian answers)');
  ok(ev.results.length === 2, 'both are reported');
  ROUTER.guardian = 'approve';
  jevOff();
}

/* ===========================================================================
   2. TRAJECTORIES
=========================================================================== */
console.log('\ntrajectories: least squares on known series');
{
  const ls = INST.leastSquares([{ date: '2026-10-01', value: 1 }, { date: '2026-10-02', value: 3 }, { date: '2026-10-03', value: 2 }, { date: '2026-10-04', value: 5 }]);
  ok(Math.abs(ls.slope - 1.1) < 1e-9 && Math.abs(ls.intercept - 1.1) < 1e-9, 'slope 1.1 and intercept 1.1 on (1,3,2,5)');
  const hist = Array.from({ length: 14 }, (_, i) => ({ date: addDays('2026-09-24', i), value: 100 + 10 * i }));   /* 100 .. 230, last on 2026-10-07 */
  const g = (target, due, extra) => ({ id: 'g-x', owner: 'owner', metric: 'northStar', target, due, history: hist, status: 'active', ...(extra || {}) });
  let t = INST.trajectory(g(400, addDays(D0, 10)), D0);
  ok(t.slopePerDay === 10 && t.projected === 330 && t.status === 'behind', 'a line of 10 a day lands on 330 against 400 at the due date: behind');
  ok(t.eta === addDays(D0, 17), 'and reaches 400 seventeen days on: ' + t.eta);
  ok(t.confidence === 'good' && /14 daily readings/.test(t.note), 'fourteen points: good confidence, and says so');
  t = INST.trajectory(g(300, addDays(D0, 10)), D0);
  ok(t.status === 'on-track' && t.eta === addDays(D0, 7), 'the same line against 300: on track, there in 7 days');
  t = INST.trajectory(g(200, addDays(D0, 10)), D0);
  ok(t.status === 'met', 'already past the target: met');
  t = INST.trajectory({ ...g(400, addDays(D0, 10)), history: hist.slice(-1) }, D0);
  ok(t.status === 'no-data' && t.confidence === 'low', 'one point: no-data, low confidence');
  t = INST.trajectory({ ...g(400, addDays(D0, 10)), history: hist.slice(-5) }, D0);
  ok(t.confidence === 'low' && /5 daily readings/.test(t.note), 'five points: low confidence, with the count');
  t = INST.trajectory({ ...g(0.98, addDays(D0, -30)), metric: 'output.health', history: hist.map(h => ({ date: h.date, value: 0.95 })) }, D0);
  ok(t.status === 'behind' && t.projected == null, 'a standing goal under its target (due date passed): behind, nothing projected');
  t = INST.trajectory({ ...g(400, addDays(D0, 10)), history: hist.map(h => ({ date: h.date, value: 230 - (h.value - 100) })) }, D0);
  ok(t.status === 'behind' && t.eta == null && /does not reach/.test(t.note), 'a falling line never reaches it, and says so');
  t = INST.trajectory({ id: 'g-test', owner: 'soul', metric: 'learning.experiment', target: 'verdict', status: 'active', history: [] }, D0);
  ok(t.status === 'no-data' && /not a numeric goal/.test(t.note), 'a goal with no numeric target: no-data, explained');
  t = INST.trajectory({ id: 'g-s', metric: 'spend.usd', target: 5, due: addDays(D0, 10), status: 'active', history: hist.map((h, i) => ({ date: h.date, value: 9 - i * 0.1 })) }, D0);
  ok(t.status === 'on-track' || t.status === 'behind', 'a lower-is-better metric is read downward: ' + t.status + ', slope ' + t.slopePerDay);
  ok(t.slopePerDay < 0 && t.eta != null, 'its falling line reaches the lower target');
  const long = Array.from({ length: 40 }, (_, i) => ({ date: addDays('2026-08-29', i), value: i < 12 ? 1000 : 100 + 10 * i }));
  t = INST.trajectory({ ...g(1e6, addDays(D0, 10)), history: long }, D0);
  ok(t.points === 28, 'only the last 28 points are fitted');
}

console.log('\nthe drift alarm');
{
  let prev = {};
  const behind = [{ id: 'g-reach', status: 'behind', metric: 'northStar' }];
  const days = Array.from({ length: 15 }, (_, i) => addDays('2026-10-01', i));
  const fired = [];
  for (const d of days) { const r = INST.stepDrift(prev, behind, d); prev = r.next; fired.push(r.alarms[0] || null); }
  ok(fired.slice(0, 6).every(x => !x) && fired[6] && fired[6].streak === 7 && fired[6].tellOwner, 'six behind days: nothing; the seventh: the alarm, told to the owner');
  ok(fired[7] && !fired[7].tellOwner && fired[13] && fired[13].tellOwner, 'the eighth day is quiet for the owner; the fourteenth tells him again');
  const again = INST.stepDrift(prev, behind, days[14]);
  ok(again.next['g-reach'].streak === prev['g-reach'].streak, 'a cycle run twice on one day counts once');
  const reset = INST.stepDrift(prev, [{ id: 'g-reach', status: 'on-track' }], addDays(days[14], 1));
  ok(reset.next['g-reach'].streak === 0 && !reset.alarms.length, 'a day back on track resets it');

  /* through the mind: the plan answers it, the owner hears of it */
  resetStore(); setDay(D0); NOTIFY.length = 0; ROUTER.calls.length = 0;
  S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: addDays(D0, -2), args: {} }, history: [] }));
  const hist = Array.from({ length: 10 }, (_, i) => ({ date: addDays(D0, i - 10), value: 19000 + i }));
  S.set(SOUL.K.goals, JSON.stringify([{ id: 'g-reach', owner: 'owner', outcome: 'Double the north star', metric: 'northStar', baseline: 18000, target: 40000, due: addDays(D0, 20), cadence: 'weekly', status: 'active', history: hist, at: addDays(D0, -10) }]));
  S.set(SOUL.K.drift, JSON.stringify({ 'g-reach': { streak: 6, lastDate: addDays(D0, -1), status: 'behind' } }));
  ROUTER.plan = '{"intents":[]}';
  const t = await MIND.tick({ force: true });
  const rec = await MIND.readCycle(t.id);
  ok(rec.drift.length === 1 && rec.drift[0].streak === 7, 'assess raises the alarm on the seventh behind cycle');
  const strat = ROUTER.calls.find(c => c.role === 'strategist');
  ok(strat && /DRIFT ALARMS/.test(strat.messages[1].content) && /g-reach/.test(strat.messages[1].content), 'the planner is told, by goal, and asked to answer each');
  const note = rec.intents.find(i => i.drift === 'g-reach');
  ok(note && note.action === 'note' && note.status === 'done', 'a plan that named nothing for it still answers it: a note in the soul\'s memory');
  const chron = await SOUL.chronicleRead(1);
  ok(chron[0].needsYou.some(n => /g-reach/.test(n) && /7 daily cycles/.test(n)), 'and the owner hears of it once, in needsYou');
}

/* ===========================================================================
   3. ANOMALIES
=========================================================================== */
console.log('\nthe anomaly watch');
{
  const days = Array.from({ length: 29 }, (_, i) => addDays('2026-09-09', i));
  const wob = i => (i % 3) - 1;
  const quiet = days.map((d, i) => ({ date: d, snap: snapFor(d, { northStar: 19000 + wob(i) * 150, 'reach.instagram': 12000 + wob(i) * 100, 'output.health': 0.98 + wob(i) * 0.005, 'site.visitors7': 420 + wob(i) * 8, 'spend.usd': Math.round((0.1 * (i + 1)) * 100) / 100 }) }));
  ok(INST.findAnomalies(quiet).length === 0, 'a quiet month raises nothing');
  const spiky = quiet.slice();
  const last = spiky.length - 1, d = spiky[last].date;
  spiky[last] = { date: d, snap: snapFor(d, { northStar: 6000, 'reach.instagram': 3000, 'output.health': 0.82, 'site.visitors7': 980, 'spend.usd': Math.round((0.1 * last + 3.1) * 100) / 100 }) };
  const flags = INST.findAnomalies(spiky);
  const byId = id => flags.find(f => f.id === id);
  ok(byId('posting-health') && byId('posting-health').direction === 'down' && byId('posting-health').severity === 'severe', 'posting health 0.82 against 0.98: a severe drop');
  ok(byId('reach') && byId('reach').kind === 'reach collapse' && byId('reach').changePct < -60 && byId('reach').severity === 'severe', 'people reached 6000 against 19000: a reach collapse (' + byId('reach').changePct + ' percent)');
  ok(byId('visitors') && byId('visitors').kind === 'visitors spike' && byId('visitors').direction === 'up', 'visitors 980 against 420: a spike');
  ok(byId('spend') && byId('spend').kind === 'spend spike' && byId('spend').value >= 3 && byId('spend').severity === 'severe', 'a day of 3 dollars against 10 cents a day: a severe spend spike (the day\'s own spend, not the month\'s)');
  ok(flags.every(f => typeof f.z === 'number' && f.sentence && !DASH.test(f.sentence)), 'each flag carries its size and a plain sentence: ' + byId('reach').sentence);
  ok(INST.findAnomalies(spiky.slice(-6)).length === 0, 'fewer than a week of history: nothing is called an anomaly');
  const upReach = quiet.slice(); upReach[last] = { date: d, snap: snapFor(d, { northStar: 40000 }) };
  ok(!INST.findAnomalies(upReach).some(f => f.id === 'reach'), 'a reach jump upward is not a collapse');

  /* through the mind: highlights and needsYou */
  resetStore(); setDay(d); NOTIFY.length = 0;
  for (const x of spiky.slice(0, -1)) putSnap(x.snap);
  S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: addDays(d, -2), args: {} }, history: [] }));
  const obsSaved = DEPS.observatory;
  DEPS.observatory = async () => { const o = { ...(await obsSaved()) }; o.summary = { ...o.summary, networks: [{ net: 'instagram', reach: 3000 }, { net: 'facebook', reach: 2000 }, { net: 'youtube', views: 1000 }, { net: 'threads' }] }; return o; };
  const t = await MIND.tick({ force: true });
  DEPS.observatory = obsSaved;
  const chron = await SOUL.chronicleRead(1);
  ok(t.status === 'done' && chron[0].highlights.some(h => /reach collapse|people reached this week fell/.test(h) || /anomaly/.test(h)), 'the chronicle highlights carry the anomaly');
  ok(chron[0].needsYou.some(n => /severe anomaly/.test(n)), 'and a severe one reaches needsYou');
  const stored = JSON.parse(S.get(SOUL.K.anomalies));
  ok(stored[0].date === d && stored[0].flags.length >= 1, 'the day\'s flags are kept for the scorecard');
}

/* ===========================================================================
   4. THE EFFECTS LEDGER
=========================================================================== */
console.log('\nthe effects ledger: before, after, baseline, verdict');
{
  ok(INST.judgeEffect({ before: 1000, after: 1300, baseline: { delta: 50, deltas: [50, 50, 50], n: 3 } }).verdict === 'helped', '+300 against a usual +50: helped');
  ok(INST.judgeEffect({ before: 1000, after: 900, baseline: { delta: 50, deltas: [50, 50, 50], n: 3 } }).verdict === 'hurt', '-100 against a usual +50: hurt');
  ok(INST.judgeEffect({ before: 1000, after: 1060, baseline: { delta: 50, deltas: [50, 50, 50], n: 3 } }).verdict === 'unclear', '+60 against a usual +50: unclear');
  const nb = INST.judgeEffect({ before: 1000, after: 1080, baseline: { delta: null, deltas: [], n: 0 } });
  ok(nb.verdict === 'unclear' && /no baseline/.test(nb.note), 'with no baseline it asks for twice the margin: +80 is unclear');
  ok(INST.judgeEffect({ before: 5, after: 3, baseline: { delta: 0, deltas: [0, 0], n: 2 }, lower: true }).verdict === 'helped', 'a lower-is-better metric that fell: helped');
  ok(INST.judgeEffect({ before: null, after: 3 }).verdict === 'unclear', 'a missing reading: unclear, never guessed');

  resetStore(); setDay(D0);
  const A = addDays(D0, -7);
  /* the four weeks around the action: the same weekday rises 50 a week, and
     the week of the action rose 300 */
  for (let k = 3; k >= 1; k--) { putSnap(snapFor(addDays(A, -7 * k), { northStar: 1000 - 50 * k })); }
  putSnap(snapFor(A, { northStar: 1000 })); putSnap(snapFor(D0, { northStar: 1300 }));
  const r = await HANDS.runHand({ action: 'insights-refresh', args: {}, why: 'stale numbers', metric: 'northStar' }, { approval: APPROVED, before: { metric: 'northStar', value: 1000, date: A } });
  ok(r.ok && r.entry.before && r.entry.before.metric === 'northStar' && r.entry.before.value === 1000 && r.entry.before.date === A, 'an R2 action keeps the metric it named and its value that morning');
  const r2 = await HANDS.runHand({ action: 'insights-refresh', args: {}, why: 'stale numbers', metric: 'northStar' }, { approval: APPROVED, before: { metric: 'northStar', value: 1300, date: D0 } });
  const m = await INST.measureEffects(D0);
  ok(m.measured.length === 1 && m.waiting === 1, 'the seven day old one is measured; today\'s waits');
  const e = m.measured[0];
  ok(e.before === 1000 && e.after === 1300 && e.delta === 300 && e.baselineDelta === 50 && e.baselineN === 3 && e.verdict === 'helped', 'stored {before 1000, after 1300, delta 300, baseline 50 over 3 weeks, helped}');
  ok(e.action === 'insights-refresh' && e.metric === 'northStar' && e.id === r.id, 'with the action and the metric');
  const acts = await SOUL.actionsList();
  ok(acts.find(a => a.id === r.id).effect.verdict === 'helped' && !acts.find(a => a.id === r2.id).effect, 'the action itself is marked measured, and only it');
  const m2 = await INST.measureEffects(D0);
  ok(m2.measured.length === 0, 'and never measured twice');
  const ev = await door({ query: { view: 'effects' }, headers: AUTH });
  ok(ev.body.ok && ev.body.items.length === 1 && ev.body.summary.helped === 1 && ev.body.pending === 1, 'the door\'s effects view: the item, the summary and one pending');

  /* a missing day-seven snapshot waits two days, then is unclear */
  resetStore(); setDay(D0);
  const B = addDays(D0, -8);
  await HANDS.runHand({ action: 'insights-refresh', args: {}, why: 'x', metric: 'northStar' }, { approval: APPROVED, before: { metric: 'northStar', value: 900, date: B } });
  ok((await INST.measureEffects(D0)).waiting === 1, 'no snapshot on day seven: it waits');
  setDay(addDays(D0, 2));
  const late = await INST.measureEffects(today());
  ok(late.measured.length === 1 && late.measured[0].verdict === 'unclear', 'two days later it is written down as unclear, not guessed');

  /* the planner is told what worked */
  resetStore(); setDay(D0); ROUTER.calls.length = 0;
  S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: addDays(D0, -2), args: {} }, history: [] }));
  for (let i = 0; i < 3; i++) S.set('x', '1');
  L.set(SOUL.K.effects, [JSON.stringify({ action: 'lineup-swap', metric: 'northStar', date: A, before: 1000, after: 1300, delta: 300, baselineDelta: 50, verdict: 'helped', at: D0 + 'T05:00:00Z' })]);
  await MIND.tick({ force: true });
  const strat = ROUTER.calls.find(c => c.role === 'strategist');
  ok(strat && /WHAT WORKED/.test(strat.messages[1].content) && /"verdict":"helped"/.test(strat.messages[1].content), 'the strategist\'s prompt carries what worked, as totals');

  /* through a cycle: the act stage records before, reflect measures later */
  resetStore(); setDay(D0); ROUTER.calls.length = 0;
  S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: addDays(D0, -2), args: {} }, history: [] }));
  ROUTER.plan = JSON.stringify({ intents: [{ action: 'insights-refresh', args: {}, why: 'The numbers are stale.', expectedEffect: 'fresh numbers', metric: 'northStar' }] });
  const t1 = await MIND.tick({ force: true });
  const rec1 = await MIND.readCycle(t1.id);
  const act = (await SOUL.actionsList()).find(a => a.hand === 'insights-refresh');
  ok(act && act.before && act.before.value === rec1.snapshot.northStar && act.before.date === D0, 'a cycle\'s public action keeps the snapshot\'s own value: ' + JSON.stringify(act && act.before));
  ROUTER.plan = '{"intents":[]}';
  setDay(addDays(D0, 7));
  const t2 = await MIND.tick({ force: true });
  const rec2 = await MIND.readCycle(t2.id);
  ok(rec2.reflect.measured.n === 1 && ['helped', 'hurt', 'unclear'].includes(rec2.reflect.measured.items[0].verdict), 'seven days later the reflect stage measures it: ' + rec2.reflect.measured.items[0].verdict);
  ok((await SOUL.chronicleRead(1))[0].highlights.some(h => /seven days on/.test(h)), 'and the chronicle says what it found');
  ROUTER.plan = '{"intents":[]}';
}

/* ===========================================================================
   5. SEARCH READINESS
=========================================================================== */
console.log('\nthe search readiness audit');
{
  resetStore(); setDay(D0); worldOff();
  const base = 'https://noorcodex.com';
  const urls = ['/a', '/b', '/c', '/d', '/e'].map(p => base + p);
  SOUL.setSeams({ files: { sitemap: sitemapOf(urls), manifest: { cards: MANIFEST } } });
  const pages = {
    [base + '/a']: () => resp(200, PAGE(base + '/a')),
    [base + '/b']: () => resp(200, PAGE(base + '/b', { description: null })),
    [base + '/c']: () => resp(200, PAGE(base + '/c', { canonical: base + '/elsewhere', noindex: true })),
    [base + '/d']: () => resp(404, 'gone'),
    [base + '/e']: () => resp(200, PAGE(base + '/e', { words: 40, jsonld: false }))
  };
  onNet(base + '/', async u => (pages[u] || (() => resp(500, '')))());
  const a = await INST.searchAudit(D0);
  ok(a.ok && a.sampled === 5 && a.sitemapUrls === 5, 'all five sitemap pages read');
  ok(a.score === 66, 'the score is the share of the seven checks passed, averaged: ' + a.score);
  ok(a.passed === 1 && a.failures.length === 4, 'one page clean, four named');
  const f = u => (a.failures.find(x => x.url === base + u) || { fails: [] }).fails;
  ok(f('/b').includes('no meta description'), '/b: no meta description');
  ok(f('/c').includes('canonical points elsewhere') && f('/c').includes('noindex'), '/c: canonical elsewhere, and noindex');
  ok(f('/d').join() === 'status 404', '/d: status 404 and nothing else judged');
  ok(f('/e').some(x => /^thin: (4\d) words$/.test(x)) && f('/e').includes('no structured data'), '/e: thin (scripts not counted), no structured data: ' + f('/e').join(', '));
  ok(a.counts.description === 1 && a.counts.status === 1 && a.counts.indexable === 1, 'the failures counted by check');
  ok(INST.wordCount('<p>one two</p><script>three four</script><style>.x{}</style>') === 2, 'the word count leaves out scripts and styles');

  const many = Array.from({ length: 60 }, (_, i) => base + '/p' + String(i).padStart(2, '0'));
  const entries = many.map(loc => ({ loc }));
  const w1 = INST.sampleUrls(entries, '2026-W41', 25), w2 = INST.sampleUrls(entries, '2026-W42', 25);
  ok(w1.length === 25 && new Set(w1).size === 25 && w1.join() !== w2.join(), '25 a week, a different 25 the next week');
  const seen = new Set(); for (let w = 1; w <= 12; w++) INST.sampleUrls(entries, '2026-W' + String(w).padStart(2, '0'), 25).forEach(u => seen.add(u));
  ok(seen.size === 60, 'and every page is read within a few weeks');
  ok(INST.parseSitemap(fs.readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8')).length > 100, 'the real sitemap.xml parses');

  NET.handlers = NET.handlers.filter(h => h.prefix !== base + '/');
  const down = await INST.searchAudit(D0);
  ok(!down.ok && /could not be reached/.test(down.why), 'a site that cannot be reached is an honest null, not a zero score');
  onNet(base + '/', async () => new Promise(() => {}));
  const slow = await INST.soft('the search audit', 120, () => INST.searchAudit(D0));
  ok(!slow.ok && /timed out/.test(slow.why), 'and the whole audit is time boxed: ' + slow.why);
  NET.handlers = NET.handlers.filter(h => h.prefix !== base + '/');
  SOUL.setSeams({ files: { manifest: { cards: MANIFEST } } });
}

/* ===========================================================================
   6. INDEXNOW
=========================================================================== */
console.log('\nIndexNow: one key, served at its own name, 100 URLs a day');
{
  resetStore(); setDay(D0); worldOff();
  const k1 = await INST.indexnowKey(true), k2 = await INST.indexnowKey(true);
  ok(/^[0-9a-f]{32}$/.test(k1.key) && k1.key === k2.key, 'the key is made once and kept: ' + k1.key);
  let r = await door({ query: { action: 'indexnow-key', key: k1.key } });
  ok(r.statusCode === 200 && r.sent === k1.key && /text\/plain/.test(r.headers['Content-Type']), 'the door answers the key, as plain text, with no cookie');
  r = await door({ query: { action: 'indexnow-key', key: '0'.repeat(32) } });
  ok(r.statusCode === 404 && r.sent === 'not found', 'any other name is a 404: the route gives out nothing else');
  r = await door({ query: { action: 'indexnow-key' } });
  ok(r.statusCode === 404, 'and no name at all is a 404');
  const v = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const rw = v.rewrites.find(x => /indexnow-key/.test(x.destination));
  ok(rw && rw.destination === '/api/soul?action=indexnow-key&key=:key' && new RegExp('^' + rw.source.replace(':key([0-9a-f]{32})', '([0-9a-f]{32})') + '$').test('/' + k1.key + '.txt'), 'vercel.json rewrites /<key>.txt to the door: ' + rw.source);
  const inc = v.functions['api/soul.js'].includeFiles;
  ok(inc.includes('sitemap.xml') && inc.length <= 256, 'api/soul.js ships sitemap.xml, its includeFiles under 256 characters (' + inc.length + ')');

  const urls = Array.from({ length: 150 }, (_, i) => 'https://noorcodex.com/page-' + i);
  SOUL.setSeams({ files: { sitemap: sitemapOf(urls.concat(['https://elsewhere.example/x'])), manifest: { cards: MANIFEST } } });
  const sent = [];
  onNet(INST.INDEXNOW_ENDPOINT, async (u, init) => { sent.push(JSON.parse(init.body)); return resp(202, ''); });
  const a = await HANDS.runHand({ action: 'indexnow-submit', args: { max: 100 }, why: '150 pages changed.', metric: 'site.searchShare' }, { approval: APPROVED });
  ok(a.ok && sent.length === 1 && sent[0].urlList.length === 100, 'the first offer carries 100 URLs: ' + (a.error || sent[0].urlList.length));
  ok(sent[0].key === k1.key && sent[0].host === 'noorcodex.com' && sent[0].keyLocation === 'https://noorcodex.com/' + k1.key + '.txt', 'with the key, the host and the key\'s location');
  ok(!sent[0].urlList.some(u => /elsewhere/.test(u)), 'and only the house\'s own pages');
  ok(a.entry.undo && a.entry.undo.kind === 'noop', 'its undo is a plain note (a ping changes nothing anyone sees)');
  const b = await HANDS.runHand({ action: 'indexnow-submit', args: { max: 100 }, why: '50 pages changed.', metric: 'site.searchShare' }, { approval: APPROVED });
  ok(!b.ok && /already spent/.test(b.error) && sent.length === 1, 'a second offer the same day is refused before any call: ' + b.error);
  ok(parseInt(S.get(SOUL.K.count('indexnow', D0)), 10) === 100, 'the day\'s count stands at exactly 100');
  ok((await SOUL.countsToday()).r2 === 1, 'and the refused one gave its public action back');
  setDay(addDays(D0, 1));
  const c = await HANDS.runHand({ action: 'indexnow-submit', args: { max: 100 }, why: '50 pages changed.', metric: 'site.searchShare' }, { approval: APPROVED });
  ok(c.ok && sent.length === 2 && sent[1].urlList.length === 50 && !sent[1].urlList.some(u => sent[0].urlList.includes(u)), 'the next day the other 50 go, none twice');
  const d = await HANDS.runHand({ action: 'indexnow-submit', args: { max: 100 }, why: 'x', metric: 'site.searchShare' }, { approval: APPROVED });
  ok(d.ok && d.entry.result.submitted === 0 && sent.length === 2, 'with nothing changed, nothing is sent');
  const changed = urls.slice(0, 3);
  SOUL.setSeams({ files: { sitemap: sitemapOf(changed, '2026-10-08') + '', manifest: { cards: MANIFEST } } });
  NET.handlers = NET.handlers.filter(h => h.prefix !== INST.INDEXNOW_ENDPOINT);
  onNet(INST.INDEXNOW_ENDPOINT, async () => resp(403, ''));
  setDay(addDays(D0, 2));
  const e = await HANDS.runHand({ action: 'indexnow-submit', args: {}, why: 'x', metric: 'site.searchShare' }, { approval: APPROVED });
  ok(!e.ok && /403/.test(e.error) && (parseInt(S.get(SOUL.K.count('indexnow', today())), 10) || 0) === 0, 'a refused ping (403) gives its URLs back to the day\'s count: ' + e.error);
  ok(HANDS.HANDS['indexnow-submit'].tier === 'R2', 'and the hand is a public act (R2): it runs only with the council');

  /* the plan seeds it once the key file is served */
  resetStore(); setDay(D0); ROUTER.calls.length = 0;
  SOUL.setSeams({ files: { sitemap: sitemapOf(urls.slice(0, 40)), manifest: { cards: MANIFEST } } });
  NET.handlers = NET.handlers.filter(h => h.prefix !== INST.INDEXNOW_ENDPOINT);
  onNet(INST.INDEXNOW_ENDPOINT, async () => resp(200, ''));
  onNet('https://noorcodex.com/', async u => { const k = JSON.parse(S.get(SOUL.K.indexnowKey)).key; return u.endsWith(k + '.txt') ? resp(200, k) : resp(404, ''); });
  S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: addDays(D0, -2), args: {} }, history: [] }));
  ROUTER.plan = '{"intents":[]}';
  const t = await MIND.tick({ force: true });
  const rec = await MIND.readCycle(t.id);
  const ix = rec.intents.find(i => i.action === 'indexnow-submit');
  ok(rec.instruments.indexnow.ok && ix && ix.seeded && /40 pages/.test(ix.why), 'the key file answers, so the plan seeds the offer: ' + (ix && ix.why));
  ok(ix && ix.status === 'done' && ix.council.verdicts.auditor.vote === 'approve', 'the council approved it (every number is in the evidence) and it ran');
  ok(JSON.parse(L.get(SOUL.K.indexnowLog)[0]).submitted === 40, 'and the log says 40 went');
  const sv = await door({ query: { view: 'search' }, headers: AUTH });
  ok(sv.body.ok && sv.body.indexnow.keySet && sv.body.indexnow.submittedToday === 40 && sv.body.indexnow.pending === 0 && sv.body.indexnow.perDay === 100, 'the search view shows the queue: 40 today, none pending');
  NET.handlers = NET.handlers.filter(h => h.prefix !== 'https://noorcodex.com/' && h.prefix !== INST.INDEXNOW_ENDPOINT);
  SOUL.setSeams({ files: { manifest: { cards: MANIFEST } } });
}

/* ===========================================================================
   7. PAGE SPEED
=========================================================================== */
console.log('\nPageSpeed Insights');
{
  resetStore(); setDay(D0); worldOff();
  const p = INST.parsePsi(PSI_BODY(0.87, 2512.3, 0.0512, 180));
  ok(p.score === 87 && p.lcpMs === 2512 && p.cls === 0.051 && p.inpMs === 180, 'parsed: score 87, LCP 2512 ms, CLS 0.051, INP 180 ms');
  ok(INST.parsePsi(PSI_BODY(0.5, 3000, 0.1, null)).inpMs === null, 'INP only when the field data has it');
  ok(INST.parsePsi({ error: { message: 'x' } }) === null, 'an answer with no score is null');
  const asked = [];
  onNet(INST.PSI_URL, async u => { asked.push(decodeURIComponent(u)); return resp(200, PSI_BODY(asked.length === 2 ? 0.55 : 0.9, 2000, 0.02, 150)); });
  process.env.PSI_API_KEY = 'psi-key';
  const s = await INST.pageSpeed(D0, MANIFEST);
  delete process.env.PSI_API_KEY;
  ok(s.ok && s.pages.length === 4 && s.pages.every(x => x.ok), 'four pages read: ' + s.pages.map(x => x.name).join(', '));
  ok(asked.some(u => /url=https:\/\/noorcodex.com\/&/.test(u)) && asked.some(u => /\/quran&/.test(u)) && asked.some(u => /\/light\/light-dawn&/.test(u)) && asked.some(u => /\/dictionary\//.test(u)), 'home, the Qur\'an, a Light, a dictionary word');
  ok(asked.every(u => /strategy=mobile/.test(u) && /key=psi-key/.test(u)), 'mobile, with PSI_API_KEY when it is set');
  ok(s.score === 90, 'the median score: ' + s.score);
  NET.handlers = NET.handlers.filter(h => h.prefix !== INST.PSI_URL);
  onNet(INST.PSI_URL, async () => resp(429, { error: { message: 'Quota exceeded' } }));
  const bad = await INST.pageSpeed(D0, MANIFEST);
  ok(!bad.ok && /429/.test(bad.why), 'a refusal is an honest null: ' + bad.why);
  NET.handlers = NET.handlers.filter(h => h.prefix !== INST.PSI_URL);
}

/* ===========================================================================
   8. YOUTUBE: position and quota
=========================================================================== */
console.log('\nthe YouTube position, and its quota');
{
  resetStore(); setDay(D0); worldOff();
  const none = await INST.youtubePosition(D0);
  ok(!none.ok && /no YouTube credentials/.test(none.why), 'no credentials: says so, and calls nothing');
  worldOn(); YT.channelCalls = 0;
  const p0 = await INST.youtubePosition(D0);
  ok(p0.ok && p0.house.subscribers === 1520 && p0.house.views === 284000 && p0.house.videos === 412, 'the house: 1520 subscribers, 284000 views, 412 videos');
  ok(p0.benchmarks.length === 0 && /no benchmark/.test(p0.note) && INST.BENCHMARKS.length === 0, 'no benchmark list yet (the code list is empty on purpose), said plainly');
  const ids = ['UCaaaaaaaaaaaaaaaaaaaaaa', 'UCbbbbbbbbbbbbbbbbbbbbbb'];
  let r = await door({ method: 'POST', headers: AUTH, body: { action: 'benchmarks', ids } });
  ok(r.statusCode === 200 && r.body.ok && r.body.ids.length === 2, 'the owner sets benchmarks through the door');
  r = await door({ method: 'POST', headers: AUTH, body: { action: 'benchmarks', ids: ['not-a-channel'] } });
  ok(r.statusCode === 400 && /channel id/.test(r.body.error), 'a malformed id is refused');
  r = await door({ method: 'POST', headers: AUTH, body: { action: 'benchmarks', ids: Array.from({ length: 11 }, (_, i) => 'UC' + String(i).padStart(22, 'x')) } });
  ok(r.statusCode === 400 && /at most 10/.test(r.body.error), 'and more than ten');
  r = await door({ method: 'POST', body: { action: 'benchmarks', ids } });
  ok(r.statusCode === 401, 'and nobody but the owner sets them');
  resetStore(); await INST.setBenchmarks(ids);
  const p1 = await INST.youtubePosition(D0);
  ok(p1.ok && p1.benchmarks.length === 2 && p1.benchmarks[1].subscribers === 20000 && p1.benchmarks[0].title === 'Benchmark 1', 'the benchmarks\' public totals');
  ok(parseInt(S.get(SOUL.K.ytUnits(D0)), 10) === 2, 'two units spent (two channels.list calls)');
  S.set(SOUL.K.ytUnits(D0), String(INST.YT_UNITS_DAY - 1));
  const p2 = await INST.youtubePosition(D0);
  ok(p2.ok && p2.benchmarks.length === 0 && /quota/.test(p2.note) && parseInt(S.get(SOUL.K.ytUnits(D0)), 10) === INST.YT_UNITS_DAY, 'at the day\'s ceiling the house is read and the benchmarks wait');
  const p3 = await INST.youtubePosition(D0);
  ok(!p3.ok && /quota/.test(p3.why), 'past it, nothing is called at all');
  ok(INST.YT_UNITS_DAY + 6 * 1600 <= 10000, 'the soul\'s ceiling (' + INST.YT_UNITS_DAY + ') plus the poster\'s six uploads stays inside YouTube\'s 10,000');
}

console.log('\nthe topic radar: two searches a day, mapped to the shelves');
{
  resetStore(); setDay(D0); worldOn(); YT.searches = 0; YT.videosCalls = 0;
  const s1 = await INST.radarStep(D0);
  ok(s1.ok && !s1.complete && s1.progress.done === 2 && YT.searches === 2 && YT.videosCalls === 2, 'day one: two searches, two view counts, 2 of 8 read');
  ok(parseInt(S.get(SOUL.K.ytUnits(D0)), 10) === 2 * INST.RADAR_UNITS, 'the units counted: ' + S.get(SOUL.K.ytUnits(D0)));
  const s1b = await INST.radarStep(D0);
  ok(YT.searches === 2 && /two searches a day/.test(s1b.note), 'the same day again: no search');
  let last;
  for (let i = 1; i <= 3; i++) last = await INST.radarStep(addDays(D0, i));
  ok(last.complete && YT.searches === 8 && last.rising.length === 8, 'four days later all eight are read');
  const call = NET.calls.find(c => c.url.startsWith(INST.YT_API + '/search'));
  ok(/order=viewCount/.test(call.url) && /publishedAfter=/.test(call.url) && /maxResults=5/.test(call.url), 'ordered by views, published in the last 30 days, top five');
  const qv = last.rising.find(x => x.query === 'quran explained');
  ok(qv.videos.length === 5 && qv.videos[0].title === "quran explained part 1 'explained'" && qv.views > 0, 'titles decoded and views summed: ' + qv.views);
  ok(qv.kinds.includes('verse') && qv.kinds.includes('know'), 'quran explained maps to the verse and know shelves');
  ok(last.rising.find(x => x.query === 'names of allah').kinds.includes('name') && last.rising.find(x => x.query === 'prophet stories').kinds.includes('light') && last.rising.find(x => x.query === 'dua').kinds.includes('dua'), 'names to name, prophet stories to light, dua to dua');
  ok(last.rising[0].views >= last.rising[7].views && last.signals.length >= 1 && /views/.test(last.signals[0]), 'ranked by views, with the demand signals in words');
  ok(INST.mapKinds('99 Names of Allah explained').join() === 'name,know' && INST.mapKinds('Learn Arabic word roots').join() === 'word' && INST.mapKinds('random vlog').length === 0, 'the word map on its own');

  /* the planner is given the demand signals */
  resetStore(); setDay(D0); ROUTER.calls.length = 0; worldOff();
  S.set(SOUL.K.inst('radar'), JSON.stringify({ ok: true, week: INST.isoWeek(D0), date: D0, ...last }));
  S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: addDays(D0, -2), args: {} }, history: [] }));
  ROUTER.plan = '{"intents":[]}';
  await MIND.tick({ force: true });
  const strat = ROUTER.calls.find(c => c.role === 'strategist');
  ok(strat && /DEMAND SIGNALS/.test(strat.messages[1].content) && strat.messages[1].content.includes(last.signals[0].slice(0, 40).replace(/"/g, '\\"')), 'the strategist reads the radar\'s demand signals, as data');
  worldOn();

  resetStore(); setDay(D0); YT.searches = 0;
  S.set(SOUL.K.ytUnits(D0), '200');
  const q = await INST.radarStep(D0);
  ok(q.ok && YT.searches === 0 && /quota/.test(q.note) && parseInt(S.get(SOUL.K.ytUnits(D0)), 10) === 200, 'with 200 units already spent today, no search of 101 is started');
  worldOff();
}

/* ===========================================================================
   9. COVERAGE
=========================================================================== */
console.log('\nthe coverage map');
{
  const cards = [
    ...Array.from({ length: 100 }, (_, i) => ({ id: 'v' + i, kind: 'verse' })),
    ...Array.from({ length: 20 }, (_, i) => ({ id: 'w' + i, kind: 'word' })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: 'd' + i, kind: 'day' })),
    ...Array.from({ length: 10 }, (_, i) => ({ id: 'n' + i, kind: 'name' }))
  ];
  const posted = new Set(['v0', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'w0', 'w1']);
  const c = INST.coverageOf(cards, posted, { verse: 19, word: 9, name: 5 });
  const k = id => c.kinds.find(x => x.kind === id);
  ok(k('verse').cards === 100 && k('verse').posted === 10 && k('verse').remaining === 90 && k('verse').runwayDays === 33 && !k('verse').low, 'verse: 90 left at 19 a week is 33 days, not low');
  ok(k('word').remaining === 18 && k('word').runwayDays === 14 && k('word').low, 'word: 18 left at 9 a week is 14 days: flagged');
  ok(k('name').runwayDays === 14 && k('name').low, 'name: 10 left at 5 a week is 14 days: flagged');
  ok(k('day').runwayDays === null && /dated/.test(k('day').note) && !k('day').low, 'the dated day cards have no runway, and say why');
  ok(c.low.join() === 'word,name' || c.low.join() === 'name,word', 'the low list: ' + c.low.join());
  ok(c.minRunwayDays === 14 && c.total === 133 && c.postedTotal === 12, 'the shortest runway and the totals');

  resetStore(); setDay(D0);
  H.set(INST.POSTED_LEDGER, new Map([['verse-fatiha|instagram', D0 + '#reelA'], ['verse-fatiha|facebook', D0 + '#reelA'], ['word-sabr|youtube', D0 + '#reelB']]));
  const t = await INST.takeCoverage(D0, null);
  ok(t.ok && t.kinds.find(x => x.kind === 'verse').posted === 1 && t.kinds.find(x => x.kind === 'word').posted === 1, 'from the poster\'s own ledger, a reel posted to two networks counts once');
  ok(t.kinds.find(x => x.kind === 'verse').perWeek === 19, 'at the rota\'s own pace (19 verses a week while the shelf has no short)');
  const cv = await door({ query: { view: 'coverage' }, headers: AUTH });
  ok(cv.body.ok && cv.body.coverage.kinds.length >= 3 && cv.body.minDays === 30, 'the door\'s coverage view');
}

/* ===========================================================================
   10. THE WEEKLY SCORECARD, AND EVERYTHING TOGETHER
=========================================================================== */
console.log('\nthe weekly scorecard, built on Monday, and every instrument in one cycle');
{
  resetStore(); NOTIFY.length = 0; ROUTER.calls.length = 0; worldOn();
  const monday = '2026-10-12';
  for (let i = 30; i >= 1; i--) putSnap(snapFor(addDays(monday, -i), { northStar: 18000 + 50 * (30 - i), 'output.health': 0.98 }));
  S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: addDays(monday, -3), args: {} }, history: [] }));
  ROUTER.plan = '{"intents":[]}';
  /* Sunday: the 05:20 cycle defers YouTube; the first tick after 09:00
     reads it (YouTube's quota day has turned by then) */
  const sunday = addDays(monday, -1);
  YT.channelCalls = 0; YT.searches = 0;
  setDay(sunday, '05:20');
  const ts = await MIND.tick({});
  const recS = await MIND.readCycle(ts.id);
  ok(recS.instruments.youtube.deferred && recS.instruments.radar.deferred && YT.channelCalls === 0, 'at 05:20 the YouTube reads wait for 09:00 UTC, and nothing is called');
  setDay(sunday, '08:55');
  ok((await MIND.tick({})).due === false && YT.channelCalls === 0, 'at 08:55 still nothing');
  setDay(sunday, '09:15');
  const yt = await MIND.tick({});
  ok(yt.instruments && yt.instruments.youtube.ok && yt.instruments.youtube.ran && yt.instruments.radar.progress.done === 2, 'the first tick after 09:00 reads the position and two radar searches');
  ok(JSON.parse(S.get(SOUL.K.cycleCurrent)).ytDate === sunday && (await MIND.tick({})).due === false, 'once a day: the next tick rests');
  ok(parseInt(S.get(SOUL.K.ytUnits(sunday)), 10) <= INST.YT_UNITS_DAY, 'inside the soul\'s 250 units: ' + S.get(SOUL.K.ytUnits(sunday)));
  NOTIFY.length = 0;
  putSnap(snapFor(sunday, { northStar: 18000 + 50 * 29, 'output.health': 0.98 }));   /* the week's own Sunday figure, as the fixture set it */
  setDay(monday, '05:20');
  const t = await MIND.tick({});
  const rec = await MIND.readCycle(t.id);
  ok(t.status === 'done' && rec.kind === 'weekly', 'Monday\'s weekly cycle completes');
  ok(['coverage', 'search', 'speed', 'youtube', 'radar'].every(n => rec.instruments[n] && rec.instruments[n].ok), 'every instrument ran or waits its hour: ' + JSON.stringify(Object.fromEntries(Object.entries(rec.instruments).map(([k, v]) => [k, v.ok]))));
  const snap = JSON.parse(S.get(SOUL.K.metrics(monday)));
  ok(snap.instruments && snap.instruments.search.score === 100 && snap.instruments.speed.score > 0 && snap.instruments.youtube.subscribers === 1520 && snap.instruments.coverage, 'the day\'s snapshot carries the instruments\' totals');
  ok(snap.instruments.speed.pages.length === 4 && snap.instruments.speed.pages.every(p => typeof p.lcpMs === 'number'), 'page speed in the snapshot, page by page');
  const week = INST.isoWeek(addDays(monday, -1));
  ok(week === '2026-W41' && INST.weekBounds(week).from === '2026-10-05' && INST.weekBounds(week).to === '2026-10-11', 'the scorecard is for the week just ended: ' + week);
  const card = JSON.parse(S.get(SOUL.K.scorecard(week)));
  const keys = ['week', 'from', 'to', 'builtAt', 'builtOn', 'northStar', 'metrics', 'goals', 'posts', 'actions', 'effects', 'anomalies', 'search', 'speed', 'youtube', 'radar', 'coverage', 'spend'];
  ok(keys.every(k => k in card), 'its fixed shape: ' + Object.keys(card).join(','));
  ok(['path', 'label', 'value', 'weekAgo', 'delta', 'deltaPct', 'trend4w'].every(k => k in card.northStar) && card.northStar.trend4w.length === 4, 'the north star with its week delta and four week trend');
  ok(card.northStar.value === 18000 + 50 * 29 && card.northStar.weekAgo === 18000 + 50 * 22 && card.northStar.delta === 350, 'Sunday against the Sunday before: ' + card.northStar.value + ' vs ' + card.northStar.weekAgo);
  ok(card.metrics.length === INST.SCORE_METRICS.length - 1 && card.metrics.every(m => Array.isArray(m.trend4w)), 'every metric with its trend');
  ok(card.goals.length >= 4 && card.goals.every(g => ['on-track', 'behind', 'met', 'no-data'].includes(g.status)), 'the goals with their trajectory status');
  ok(Array.isArray(card.posts.top) && card.posts.top[0].title === 'The Throne verse', 'the top posts of the fortnight');
  ok(card.search.score === 100 && card.speed.pages.length === 4 && card.youtube.subscribers === 1520, 'search readiness, page speed and the YouTube position');
  ok((await L.get(SOUL.K.scorecards))[0] === week, 'filed in the week index');
  ok(NOTIFY.length === 1 && /Week 2026-W41/.test(NOTIFY[0]) && /people reached/.test(NOTIFY[0]) && !DASH.test(NOTIFY[0]), 'the owner\'s weekly message carries the scorecard as a short text: ' + NOTIFY[0].slice(0, 160));
  const sv = await door({ query: { view: 'scorecard' }, headers: AUTH });
  ok(sv.body.ok && sv.body.week === week && sv.body.scorecard.week === week && sv.body.weeks[0] === week, 'the door gives the latest week and the list');
  const sv2 = await door({ query: { view: 'scorecard', week: '2026-W01' }, headers: AUTH });
  ok(sv2.body.ok && sv2.body.scorecard === null && sv2.body.weeks.length === 1, 'an unknown week is an empty card, not an error');

  /* a second run the same Monday never files the week twice */
  await MIND.tick({ force: true });
  ok(L.get(SOUL.K.scorecards).length === 1, 'a second Monday run re-files the same week once');
  ok(await MIND.tick({}).then(x => !x.ran), 'and the cron then rests');
  setDay(monday, '09:15');
  const ytm = await MIND.tick({});
  ok(ytm.instruments.youtube.ran && ytm.instruments.radar.progress.done === 2, 'Monday after 09:00: the new week\'s position and its first two radar searches');

  /* the second day: the weekly instruments are not read again, the radar goes on */
  const before = NET.calls.filter(c => c.url.startsWith(INST.PSI_URL)).length;
  setDay(addDays(monday, 1), '05:20');
  const t2 = await MIND.tick({});
  const rec2 = await MIND.readCycle(t2.id);
  ok(t2.status === 'done' && !rec2.instruments.speed.ran && NET.calls.filter(c => c.url.startsWith(INST.PSI_URL)).length === before, 'Tuesday: page speed is not read again this week');
  ok(rec2.instruments.coverage.ran, 'coverage is read daily');
  setDay(addDays(monday, 1), '09:20');
  const yt2 = await MIND.tick({});
  ok(yt2.instruments.radar.ran && yt2.instruments.radar.progress.done === 4 && !yt2.instruments.youtube.ran, 'after 09:00 the radar takes its next two, and the position is not read again this week');
  worldOff();

  /* every tool failing at once: the cycle still finishes */
  resetStore(); setDay('2026-10-19', '05:20'); NOTIFY.length = 0;
  process.env.YT_CLIENT_ID = 'a'; process.env.YT_CLIENT_SECRET = 'b'; process.env.YT_REFRESH_TOKEN = 'c';
  SOUL.setSeams({ files: { sitemap: 'not xml at all', manifest: { cards: [] } } });
  const DM = DEPS.manifest; DEPS.manifest = async () => { throw new Error('the shelf is down'); };
  S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: '2026-10-15', args: {} }, history: [] }));
  const t3 = await MIND.tick({});
  DEPS.manifest = DM;
  const rec3 = await MIND.readCycle(t3.id);
  ok(t3.status === 'done', 'every instrument failing, the weekly cycle still completes');
  ok(['coverage', 'search', 'speed'].every(n => rec3.instruments[n] && rec3.instruments[n].ok === false && rec3.instruments[n].why), 'each with its reason: ' + ['search', 'speed'].map(n => rec3.instruments[n].why).join(' | '));
  setDay('2026-10-19', '09:15');
  const y3 = await MIND.tick({});
  ok(y3.instruments.youtube.ok === false && /no network/.test(y3.instruments.youtube.why) && y3.instruments.radar.ok === false, 'and the YouTube reads after 09:00 fail soft too: ' + y3.instruments.youtube.why);
  ok(S.has(SOUL.K.scorecard('2026-W42')) && JSON.parse(S.get(SOUL.K.scorecard('2026-W42'))).search === null, 'the scorecard is still built, the missing readings null');
  for (const k of ['YT_CLIENT_ID', 'YT_CLIENT_SECRET', 'YT_REFRESH_TOKEN']) delete process.env[k];
  SOUL.setSeams({ files: { manifest: { cards: MANIFEST } } });
}

console.log('\nGoogle Search Console: asked once, never every day');
{
  resetStore(); setDay(D0); worldOff();
  S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: addDays(D0, -2), args: {} }, history: [] }));
  ROUTER.plan = '{"intents":[]}';
  await MIND.tick({ force: true });
  setDay(addDays(D0, 1)); await MIND.tick({ force: true });
  setDay(addDays(D0, 2)); await MIND.tick({ force: true });
  const ch = await SOUL.chronicleRead(5);
  const asked = ch.filter(c => c.needsYou.some(n => /Search Console/.test(n) && /OAuth/.test(n)));
  ok(ch.length === 3 && asked.length === 1 && asked[0] === ch[2], 'three cycles, and the Search Console note only in the first: ' + MIND.GSC_NOTE.slice(0, 80));
}

console.log('\nthe registry and the views');
{
  for (const h of ['trajectories', 'anomalies', 'effects', 'search-readiness', 'page-speed', 'youtube-position', 'topic-radar', 'coverage', 'scorecard'])
    ok(HANDS.HANDS[h] && HANDS.HANDS[h].tier === 'R0', h + ' is an R0 read hand');
  resetStore(); setDay(D0);
  const r = await HANDS.runHand({ action: 'trajectories', args: {}, why: 'where are we heading' }, {});
  ok(r.ok && Array.isArray(r.data), 'an R0 instrument runs freely');
  ok(/trajectories \(R0\)/.test(HANDS.registryText()) && /indexnow-submit \(R2\)/.test(HANDS.registryText()), 'the planner reads them in the registry');
  for (const v of ['trajectories', 'effects', 'scorecard', 'search', 'speed', 'youtube', 'radar', 'coverage']) {
    const x = await door({ query: { view: v }, headers: AUTH });
    ok(x.statusCode === 200 && x.body.ok === true, 'view=' + v + ' answers on an empty store');
    const y = await door({ query: { view: v }, headers: {} });
    ok(y.statusCode === 401, 'view=' + v + ' is owner only');
  }
  const src = ['../api/_instruments.js', '../api/_council.js', '../api/_mind.js', '../api/soul.js', '../api/_hands.js', '../api/_evolve.js', '../tests/_soul-harness.mjs', '../tests/soul-tools.mjs']
    .map(f => fs.readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');
  ok(!DASH.test(src), 'no em or en dash in any file this work touched');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
