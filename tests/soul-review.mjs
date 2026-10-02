/* NOOR · the Soul after its first independent review (2 October 2026).
   ---------------------------------------------------------------------------
   One block per finding, each proving the fix with the network stood in for
   (tests/_soul-harness.mjs):
     1. the soul is its own actor on the line-up ("soul"), never the owner;
        it never overwrites an owner or Lantern-approved slot; the preview
        tells the planner who set what; undo checks the soul's own entry;
     2. a day cannot be emptied: one soul skip and two soul changes a target
        date, today and tomorrow only, failing closed; skips lower health;
     3. prompts stay bounded: 25 lessons, a retire path, the strategist's own
        ordinary-day canary, at most 8 soul goals with retired ones archived;
     4. the deep tier wastes nothing: an empty price list is cached, a deep
        answer that fell back is never walked again, the soul's free calls
        keep to half of each provider's day;
     5. locks are released only by their holder; the snapshot's reads run
        together under one budget;
     6. the audit chain's head and count, so truncation at either end shows,
        and the head goes out in the weekly summary;
     7. the cycle never edits a goal; met is measured daily; a concurrent
        owner edit is never lost;
     8. actions are updated by id; withdrawing one lesson of a group
        withdraws the group, and says so;
     9. what the owner was told is not told again within 7 days;
    10. one cap formula, and a paid call whose cost was not written closes
        the deep tier for the day;
    11. the owner's early Run is an extra cycle, never the day's own; a busy
        tick says a cycle is already running;
    12. the verse-length test is not planned again inside 14 days of the
        owner's stop; the reconcile undo checks what is there now; no stale
        deepOnce comment.

   Run:  node tests/soul-review.mjs
*/
import fs from 'node:fs';
import {
  S, L, H, EVAL, FAULT, NET, onNet, resp, resetStore, SOUL, HANDS, COUNCIL, MIND, EVOLVE, INST, LINEUP, ROUTER, DEPS, OBS,
  APPROVED, AUTH, door, addDays, CLOCK, setDay, today, NOTIFY, MANIFEST, snapFor, putSnap
} from './_soul-harness.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const realToday = new Date().toISOString().slice(0, 10);
const D0 = realToday;            /* the line-up's own validator reads the real clock */
const D1 = addDays(D0, 1);
setDay(D0, '05:30');
const LLM = await import('../api/_llm.js');
const SOCIAL = await import('../api/social.js');
async function freeVerse(date, slot) {
  const picks = await LINEUP.otherPicksFor(MANIFEST, date, slot, null, new Map(), null, { records: {} });
  const taken = new Set(Object.values(picks));
  return MANIFEST.filter(c => c.kind === 'verse' && !taken.has(c.id)).map(c => c.id);
}
const quietExp = () => S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: addDays(today(), -2), args: {} }, history: [] }));

/* ===========================================================================
   1. THE SOUL IS ITS OWN ACTOR
=========================================================================== */
console.log('\n1. the soul signs as the soul, and leaves the owner\'s slots alone');
{
  resetStore(); setDay(D0);
  const free = await freeVerse(D1, 'reelB');
  const r = await HANDS.runHand({ action: 'lineup-swap', args: { date: D1, slot: 'reelB', id: free[0] }, why: 'Verse reels reached 1204 people.' }, { approval: APPROVED });
  const day = JSON.parse(S.get('nsoc:override:' + D1));
  ok(r.ok && day.reelB.by === 'soul' && !/owner/i.test(day.reelB.by), 'the soul\'s swap is stored by "soul": ' + (r.error || day.reelB.by));
  ok(LINEUP.ACTORS.join() === 'owner,lantern-approved,soul' && LINEUP.actorLabel('soul') === 'the Soul', 'api/_lineup.js knows three actors');
  ok(SOCIAL.overrideWhy({ by: 'soul' }) === "the Soul's override" && SOCIAL.overrideWhy({ by: 'owner' }) === 'owner override', 'the poster\'s slot record says the Soul skipped it, not the owner');
  const html = fs.readFileSync(new URL('../admin2.html', import.meta.url), 'utf8');
  ok(/ov\.by==="soul"\?"the Soul"/.test(html), 'and the console\'s Posts room says "the Soul"');
  for (const by of ['owner', 'lantern-approved']) {
    await LINEUP.setOverride({ date: D1, slot: 'reelC', action: 'skip' }, { manifest: MANIFEST, seen: new Map(), by, note: 'his own' });
    const x = await HANDS.runHand({ action: 'lineup-swap', args: { date: D1, slot: 'reelC', id: free[1] }, why: 'Verse reels reached 1204 people.' }, { approval: APPROVED });
    ok(!x.ok && /never overwrites/.test(x.error) && JSON.parse(S.get('nsoc:override:' + D1)).reelC.by === by, 'a slot set by ' + by + ' is refused, and stays his: ' + x.error);
    await LINEUP.clearOverride({ date: D1, slot: 'reelC' });
  }
  ok((await SOUL.countsToday()).lineup === 1, 'the refusals spent no line-up cap');
  const prev = await HANDS.lineupPreview(D1, 1);
  const b = prev.find(p => p.slot === 'reelB');
  ok(b.override && b.override.by === 'soul' && /Council approved/.test(b.override.note), 'the preview the planner reads says who set each override, and why');
  /* the owner changes the slot after the soul: undo refuses */
  await LINEUP.setOverride({ date: D1, slot: 'reelB', action: 'skip' }, { manifest: MANIFEST, seen: new Map(), by: 'owner', note: 'mine' });
  const u = await HANDS.undoAction(r.id, 'owner');
  ok(!u.ok && /changed again/.test(u.error) && /owner/.test(u.error) && JSON.parse(S.get('nsoc:override:' + D1)).reelB.by === 'owner', 'undo compares the slot with the soul\'s own entry, and leaves the owner\'s: ' + u.error);
}

/* ===========================================================================
   2. A DAY CANNOT BE EMPTIED
=========================================================================== */
console.log('\n2. one soul skip and two soul changes a date, today and tomorrow only');
{
  resetStore(); setDay(D0);
  const sk = s => HANDS.runHand({ action: 'lineup-skip', args: { date: D0, slot: s }, why: 'skip' }, { approval: APPROVED });
  const a = await sk('reelA'), b = await sk('reelC');
  ok(a.ok && !b.ok && /skip at most 1/.test(b.error), 'a second soul skip of the same day is refused: ' + b.error);
  const free = await freeVerse(D0, 'reelD');
  const c = await HANDS.runHand({ action: 'lineup-swap', args: { date: D0, slot: 'reelD', id: free[0] }, why: 'swap' }, { approval: APPROVED });
  const free2 = await freeVerse(D0, 'reelE');
  const d = await HANDS.runHand({ action: 'lineup-swap', args: { date: D0, slot: 'reelE', id: free2[0] }, why: 'swap' }, { approval: APPROVED });
  ok(c.ok && !d.ok && /at most 2/.test(d.error), 'a third soul change of the same day is refused, though the daily cap had room: ' + d.error);
  ok(S.get('nsoul:count:soul-lineup-date:' + D0) === '2' && S.get('nsoul:count:soul-skip-date:' + D0) === '1', 'the counters hold exactly what went through (refusals given back)');
  const far = await HANDS.runHand({ action: 'lineup-skip', args: { date: addDays(D0, 2), slot: 'reelA' }, why: 'skip' }, { approval: APPROVED });
  ok(!far.ok && /only today's or tomorrow's/.test(far.error), 'the day after tomorrow is refused: ' + far.error);
  FAULT.key = /^nsoul:count:soul-lineup-date/;
  const f = await HANDS.runHand({ action: 'lineup-skip', args: { date: D1, slot: 'reelA' }, why: 'skip' }, { approval: APPROVED });
  FAULT.key = null;
  ok(!f.ok && /could not be kept/.test(f.error) && !S.has('nsoc:override:' + D1), 'a store fault on the count refuses (fail closed): ' + f.error);
  ok((await SOUL.countsToday()).r2 === 2, 'and gave its public action back');

  /* posting health: a skipped slot did not go out */
  const obs = OBS();
  obs.postingHealth.days = Array.from({ length: 8 }, (_, i) => ({ date: addDays(D0, i - 8), sent: 9, partial: 0, failed: 0, pending: 0, none: 1, skipped: i === 7 ? 3 : 0, skippedSoul: i === 7 ? 1 : 0 }));
  const snap = await SOUL.buildSnapshot({ ...DEPS, observatory: async () => obs }, { lessonsCount: async () => 0 });
  ok(snap.output.due === 64 && snap.output.sent === 63 && snap.output.health === Math.round(63 / 64 * 1000) / 1000, 'the soul\'s one skip lowers health (63 sent of 64 due); the owner\'s two count as before (' + snap.output.health + ')');
  ok(snap.output.skips7.total === 3 && snap.output.skips7.soul === 1, 'and every skip is counted in skips7, the soul\'s apart');
}

/* ===========================================================================
   3. PROMPTS STAY BOUNDED
=========================================================================== */
console.log('\n3. the playbook and the soul\'s goals cannot grow every prompt');
{
  const lessons = Array.from({ length: 30 }, (_, i) => ({ id: 'l' + i, text: 'lesson number ' + i, at: '2026-09-' + String(i + 1).padStart(2, '0') + 'T00:00:00Z' }));
  lessons[2].effect = 5;
  const txt = COUNCIL.lessonsText({ version: 9, lessons });
  const lines = txt.split('\n').filter(l => l.startsWith('- '));
  ok(lines.length === 25 && /the 25 that count most of 30/.test(txt), 'thirty lessons, twenty five in the prompt');
  ok(/lesson number 2$/.test(lines[0]) && lines[1].endsWith('lesson number 29') && !txt.includes('lesson number 3\n'), 'the one with most effect first, then the newest');

  resetStore(); setDay(D0); ROUTER.guardian = 'smart'; ROUTER.plan = '{"intents":[]}';
  S.set(SOUL.K.playbook, JSON.stringify({ version: 3, lessons: [{ id: 'l-old', text: 'Post the word card at 16:00.', why: 'x', from: 's', at: '2026-09-01' }] }));
  const bad = await HANDS.runHand({ action: 'lesson-propose', args: { kind: 'retire', id: 'l-nope' }, why: 'gone' }, {});
  ok(!bad.ok && /no lesson/.test(bad.error), 'retiring a lesson that is not there is refused');
  const rt = await HANDS.runHand({ action: 'lesson-propose', args: { kind: 'retire', id: 'l-old', why: 'the 12:00 slot reaches more' }, why: 'the 12:00 slot reaches more' }, {});
  ok(rt.ok && rt.entry.result.proposal.kind === 'retire', 'a lesson is proposed for retiring by its id');
  const ev = await EVOLVE.evaluatePending({});
  ok(ev.results[0].status === 'applied' && (await EVOLVE.readPlaybook()).lessons.length === 0, 'it passes the canaries and leaves the playbook');

  ok(!EVOLVE.judgeOrdinaryPlan([{ action: 'lineup-skip', args: { date: D1, slot: 'reelA' } }]).pass, 'the ordinary-day judge refuses a skip');
  ok(!EVOLVE.judgeOrdinaryPlan([{ action: 'lineup-swap', args: { date: D1, slot: 'reelA' } }, { action: 'lineup-swap', args: { date: D1, slot: 'reelB' } }]).pass, 'and two changes to one day');
  ok(!EVOLVE.judgeOrdinaryPlan([{ action: 'constructor' }]).pass && !EVOLVE.judgeOrdinaryPlan(null).pass, 'and an unknown hand, and no plan at all');
  ok(EVOLVE.judgeOrdinaryPlan([]).pass && EVOLVE.judgeOrdinaryPlan([{ action: 'note', args: { text: 'all well' } }, { action: 'lineup-swap', args: { date: D1, slot: 'reelA' } }]).pass, 'an ordinary plan passes');
  ROUTER.plan = task => /SKIP EVERYTHING/.test(task.messages[0].content)
    ? JSON.stringify({ intents: [{ action: 'lineup-skip', args: { date: D1, slot: 'reelA' }, why: 'quiet' }, { action: 'lineup-skip', args: { date: D1, slot: 'reelB' }, why: 'quiet' }] })
    : '{"intents":[]}';
  const can = await EVOLVE.runCanaries({ version: 1, lessons: [{ id: 'x', text: 'SKIP EVERYTHING on a quiet day.' }] });
  const sc = can.results.find(x => x.id === 'ordinary-day-plan');
  ok(!can.ok && sc && !sc.pass && /skipped/.test(sc.why), 'a lesson that makes the strategist skip slots fails the canary: ' + (sc && sc.why));
  ok(can.results.filter(x => x.id !== 'ordinary-day-plan').every(x => x.pass), 'though every Guardian canary passed with it');
  const strat = ROUTER.calls.filter(c => c.role === 'strategist').pop();
  ok(/canary: an ordinary morning/.test(strat.messages[1].content) && /SKIP EVERYTHING/.test(strat.messages[0].content), 'the strategist saw the candidate playbook and the fixed ordinary morning');
  ROUTER.plan = '{"intents":[]}'; ROUTER.guardian = 'approve';

  resetStore();
  for (let i = 0; i < 8; i++) await SOUL.soulGoalOp('add', { id: 'g-s' + i, outcome: 'goal ' + i, metric: 'northStar', target: 1 });
  const ninth = await SOUL.soulGoalOp('add', { id: 'g-s8', outcome: 'one too many', metric: 'northStar', target: 1 });
  ok(!ninth.ok && /8 goals/.test(ninth.error), 'a ninth active soul goal is refused: ' + ninth.error);
  const ret = await HANDS.runHand({ action: 'goal', args: { op: 'retire', goal: { id: 'g-s3' } }, why: 'done with it' }, {});
  const defs = (await SOUL.readGoalDefs()).goals;
  const arch = await SOUL.readGoalsArchive();
  ok(ret.ok && !defs.some(g => g.id === 'g-s3') && arch[0].id === 'g-s3' && arch[0].status === 'retired', 'a retired goal leaves the goals for the archive');
  ok((await SOUL.soulGoalOp('add', { id: 'g-s8', outcome: 'now there is room', metric: 'northStar', target: 1 })).ok, 'which makes room for another');
  await SOUL.soulGoalOp('retire', { id: 'g-s8' });
  const und = await HANDS.undoAction(ret.id, 'owner');
  ok(und.ok && (await SOUL.readGoalDefs()).goals.some(g => g.id === 'g-s3') && !(await SOUL.readGoalsArchive()).some(g => g.id === 'g-s3'), 'its undo brings it back out of the archive');
}

/* ===========================================================================
   4. THE DEEP TIER WASTES NOTHING
=========================================================================== */
console.log('\n4. the deep tier: a cached empty price list, one walk, the Lantern\'s half');
{
  let downloads = 0;
  onNet('https://openrouter.ai/api/v1/models', async () => { downloads++; return resp(200, { data: [{ id: 'someone/else', pricing: { prompt: '0' } }] }); });
  const p1 = await LLM.deepPrices(true), p2 = await LLM.deepPrices(false), p3 = await LLM.deepPrices(false);
  ok(p1 && p1.size === 0 && p2 === p1 && p3 === p1 && downloads === 1, 'a list with no deep name is cached too: one download for three asks');

  const SR = SOUL.seams.route;
  let calls = [];
  SOUL.setSeams({ route: async task => { calls.push(task.tier); return { ok: false, error: 'no free model answered', tier: 'deep', paid: false, costUsd: 0 }; } });
  const r = await MIND.think('deep', [{ role: 'system', content: 'ROLE: skeptic' }, { role: 'user', content: 'x' }], {});
  ok(!r.ok && calls.join() === 'deep', 'a deep answer that already fell back to the free names is final: no second free walk (' + calls.join() + ')');
  SOUL.setSeams({ route: SR });

  resetStore();
  const now = Date.parse(D0 + 'T10:00:00Z'), day = D0;
  S.set('nllm:rl:openrouter:*:soul:' + day, '20');
  const soul = await LLM.checkAndReserve('openrouter', 'x/free:free', now, 'soul');
  const lantern = await LLM.checkAndReserve('openrouter', 'x/free:free', now);
  ok(!soul.ok && /Lantern/.test(soul.why) && lantern.ok, 'the soul stops at half of OpenRouter\'s 40 a day; the Lantern goes on: ' + soul.why);
  S.set('nllm:rl:groq:m1:soul:' + day, '10');
  const g = await LLM.checkAndReserve('groq', 'm1', now, 'soul');
  ok(g.ok && S.get('nllm:rl:groq:m1:soul:' + day) === '11' && S.get('nllm:rl:groq:m1:d:' + day) === '1', 'under its half, a soul call counts in its own key and the shared one');
  ok(LLM.SOUL_FREE_SHARE === 0.5, 'the share is a code constant: half');
  NET.handlers = NET.handlers.filter(h => !h.prefix.startsWith('https://openrouter.ai'));
}

/* ===========================================================================
   5. LOCKS
=========================================================================== */
console.log('\n5. a lock is released only by its own holder');
{
  resetStore();
  S.set('L1', 'mine');
  const e0 = EVAL.calls;
  ok(!(await SOUL.releaseLock('L1', 'theirs')) && S.get('L1') === 'mine', 'a different token leaves the lock where it is');
  ok((await SOUL.releaseLock('L1', 'mine')) && !S.has('L1'), 'its own token releases it');
  ok(EVAL.calls === e0 + 2, 'by an atomic compare and delete inside the store (EVAL)');

  resetStore(); setDay(D0); quietExp();
  ROUTER.plan = () => { S.set(SOUL.K.tickLock, 'another-tick'); return '{"intents":[]}'; };
  const t = await MIND.tick({ force: true });
  ROUTER.plan = '{"intents":[]}';
  ok(t.ran && S.get(SOUL.K.tickLock) === 'another-tick', 'a tick whose lock expired and was taken by another never deletes the other\'s');

  let inflight = 0, most = 0;
  const slow = v => async () => { inflight++; most = Math.max(most, inflight); await new Promise(r => setTimeout(r, 30)); inflight--; return v; };
  await SOUL.buildSnapshot({ ...DEPS, observatory: slow(OBS()), insightsRead: slow({ ok: true, igRows: [] }), expState: slow({ current: null, history: [] }) }, { lessonsCount: slow(0) });
  ok(most >= 3 && SOUL.SNAPSHOT_BUDGET_MS === 60000, 'the snapshot reads its sources together (' + most + ' at once) under one 60 second budget');
  ok(MIND.MODEL_STEP_MS === 90000 && MIND.TICK_BUDGET_MS === 240000, 'and each model step is held to 90 seconds inside the 240 second tick');
}

/* ===========================================================================
   6. THE AUDIT HEAD
=========================================================================== */
console.log('\n6. the audit chain\'s head and count');
{
  resetStore();
  for (let i = 0; i < 5; i++) await SOUL.auditAppend({ kind: 'note', actor: 'test', summary: 'entry ' + i, data: {} });
  let v = await SOUL.auditVerify();
  const head = JSON.parse(S.get(SOUL.K.auditHead));
  ok(v.ok && v.anchored && head.count === 5 && head.head === v.items[4].hash, 'the head key holds the count and the newest hash');
  const list = L.get(SOUL.K.audit);
  const newest = list.pop();
  v = await SOUL.auditVerify();
  ok(!v.ok && v.chainOk && /holds 4/.test(v.why), 'dropping the newest entry: the links still hold, but the head does not: ' + v.why);
  list.push(newest);
  const oldest = list.shift();
  v = await SOUL.auditVerify();
  ok(!v.ok && v.chainOk, 'dropping the oldest is caught too');
  list.unshift(oldest);
  ok((await SOUL.auditVerify()).ok, 'put back, it verifies');
  const a = await door({ query: { view: 'audit' }, headers: AUTH });
  ok(a.body.chainOk === true && a.body.anchored === true && a.body.count === 5 && a.body.head === head.head, 'the door\'s audit view answers the head and the count');
  const doc = fs.readFileSync(new URL('../SOUL.md', import.meta.url), 'utf8');
  ok(/no outside anchor/i.test(doc) && /head hash/i.test(doc), 'SOUL.md says plainly what the head cannot catch, and where the outside anchor is');
}

/* ===========================================================================
   7. GOALS ARE NOT THE CYCLE'S TO EDIT
=========================================================================== */
console.log('\n7. the cycle measures goals beside them, and loses no owner edit');
{
  resetStore(); setDay(D0); quietExp(); ROUTER.plan = '{"intents":[]}';
  await MIND.tick({ force: true });
  const defs1 = S.get(SOUL.K.goals);
  setDay(D1); quietExp();
  await MIND.tick({ force: true });
  ok(S.get(SOUL.K.goals) === defs1, 'a second cycle wrote nothing to the goals themselves');
  const st = JSON.parse(S.get(SOUL.K.goalState));
  ok(st['g-reach'].history.length === 2 && typeof st['g-reach'].baseline === 'number', 'the history and the filled baseline live in nsoul:goalstate');
  ok(!JSON.parse(defs1).some(g => g.history && g.history.length), 'and no goal definition carries a history');
  const merged = (await SOUL.readGoals()).find(g => g.id === 'g-reach');
  ok(merged.history.length === 2, 'readers see the two together');

  /* met is measured fresh each day */
  resetStore(); setDay(D0); quietExp();
  S.set(SOUL.K.goals, JSON.stringify([{ id: 'g-v', owner: 'owner', outcome: 'visitors', metric: 'site.visitors7', baseline: 100, target: 400, due: addDays(D0, 30), cadence: 'weekly', status: 'active' }]));
  await MIND.tick({ force: true });
  ok(JSON.parse(S.get(SOUL.K.goalState))['g-v'].status === 'met', 'a day at 420 against 400: met');
  const obsSaved = DEPS.observatory;
  DEPS.observatory = async () => { const o = OBS(); o.summary.visitors = { value: 300 }; return o; };
  setDay(D1); quietExp();
  await MIND.tick({ force: true });
  DEPS.observatory = obsSaved;
  ok(JSON.parse(S.get(SOUL.K.goalState))['g-v'].status === 'active' && JSON.parse(S.get(SOUL.K.goals))[0].status === 'active', 'the next day at 300 it is active again: never sticky, and never written into the goal');

  /* an owner edit landing between a read and a write */
  resetStore();
  S.set(SOUL.K.goals, JSON.stringify([{ id: 'g-reach', owner: 'owner', outcome: 'reach', metric: 'northStar', target: 100, status: 'active' }, { id: 'g-own', owner: 'soul', outcome: 'mine', metric: 'northStar', target: 5, status: 'active' }]));
  let raced = false;
  const r = await SOUL.updateGoals(async goals => {
    if (!raced) { raced = true; await SOUL.setOwnerGoal({ id: 'g-reach', target: 250 }); }
    const i = goals.findIndex(g => g.id === 'g-own'); goals[i] = { ...goals[i], target: 9 };
    return { write: true, goals, result: { ok: true } };
  });
  const after = JSON.parse(S.get(SOUL.K.goals));
  ok(r.ok && after.find(g => g.id === 'g-reach').target === 250 && after.find(g => g.id === 'g-own').target === 9, 'the owner\'s edit made mid write is kept, and the soul\'s change applied on top of it');
  ok(EVAL.calls > 0, 'by the store\'s compare and set');
}

/* ===========================================================================
   8. BY ID, AND BY GROUP
=========================================================================== */
console.log('\n8. actions updated by id; a lesson group withdrawn together');
{
  resetStore();
  for (const id of ['a1', 'a2', 'a3']) await SOUL.actionsRecord({ id, hand: 'note', ok: true });
  L.get(SOUL.K.actions).unshift(JSON.stringify({ id: 'legacy', hand: 'note', ok: true }));
  await SOUL.actionsRecord({ id: 'a4', hand: 'note', ok: true });
  ok(await SOUL.actionsUpdate('a2', { undone: true }), 'an update names its action by id');
  const list = await SOUL.actionsList();
  ok(list.find(a => a.id === 'a2').undone === true && list.filter(a => a.undone).length === 1 && list.length === 5, 'and only that one changed, though the list moved under it');
  ok(await SOUL.actionsUpdate('legacy', { undone: true }) && (await SOUL.actionsList()).find(a => a.id === 'legacy').undone, 'an older entry kept in the list itself is still found by its id');

  resetStore(); ROUTER.guardian = 'smart'; ROUTER.plan = '{"intents":[]}';
  await HANDS.runHand({ action: 'lesson-propose', args: { text: 'Short verse reels hold people longer.', why: 'x' }, why: 'x' }, {});
  await HANDS.runHand({ action: 'lesson-propose', args: { text: 'A Name card keeps to one line of meaning.', why: 'y' }, why: 'y' }, {});
  await EVOLVE.evaluatePending({});
  const props = await EVOLVE.listProposals();
  ok(props.filter(p => p.status === 'applied').length === 2 && (await EVOLVE.readPlaybook()).lessons.length === 2, 'two lessons applied together as one version');
  const w = await EVOLVE.withdraw(props[0].id);
  const after = await EVOLVE.listProposals();
  ok(w.ok && w.withdrawn.length === 2 && /withdrew them all/.test(w.note) && after.every(p => p.status === 'withdrawn'), 'withdrawing one withdraws the group, and says so: ' + w.note);
  ok((await EVOLVE.readPlaybook()).lessons.length === 0, 'and the playbook is back to before both');
  ROUTER.guardian = 'approve';
}

/* ===========================================================================
   9. TOLD ONCE A WEEK
=========================================================================== */
console.log('\n9. the owner is not told the same thing every day');
{
  resetStore(); NOTIFY.length = 0; ROUTER.plan = '{"intents":[]}';
  const run = async d => { setDay(d); quietExp(); return MIND.tick({ force: true }); };
  await run('2026-10-06');
  const first = NOTIFY.length;
  await run('2026-10-07');
  ok(first === 1 && NOTIFY.length === 1, 'the same needs on the next day send nothing');
  const rec = await MIND.readCycle((await run('2026-10-08')).id);
  ok(NOTIFY.length === 1 && rec.notified && /already sent/.test(rec.notified.skipped), 'and the record says why');
  const obsSaved = DEPS.observatory;
  DEPS.observatory = async () => { const o = OBS(); o.missingToken = { threads: true, facebook: true }; o.summary.networks = o.summary.networks.map(n => n.net === 'facebook' ? { net: 'facebook' } : n); return o; };
  await run('2026-10-09');
  DEPS.observatory = obsSaved;
  ok(NOTIFY.length === 2 && /facebook/i.test(NOTIFY[1]) && !/threads/i.test(NOTIFY[1]), 'a new item is sent alone: ' + NOTIFY[1].slice(0, 140));
  await run('2026-10-15');
  ok(NOTIFY.length === 3 && /threads/i.test(NOTIFY[2]), 'after seven days the old one is told again');
}

/* ===========================================================================
   10. ONE CAP FORMULA, AND A COST THAT WAS NOT WRITTEN
=========================================================================== */
console.log('\n10. the budget: one formula, and fail closed on an unwritten cost');
{
  for (const [v, want] of [['0', 0], ['-3', 0], ['abc', 10], ['50', 10], ['4', 4], [undefined, 10]]) {
    if (v === undefined) delete process.env.SOUL_MONTHLY_USD; else process.env.SOUL_MONTHLY_USD = v;
    ok(SOUL.capUsd() === want && LLM.deepCapUsd() === want, 'SOUL_MONTHLY_USD=' + v + ': both say ' + want);
  }
  delete process.env.SOUL_MONTHLY_USD;
  resetStore(); setDay(D0);
  const SR = SOUL.seams.route;
  const tiers = [];
  SOUL.setSeams({ route: async task => { tiers.push(task.tier); return task.tier === 'deep'
    ? { ok: true, content: '{}', tier: 'deep', paid: true, spendRecorded: false, costUsd: 0.02 }
    : { ok: true, content: '{}', tier: 'strong' }; } });
  const msgs = [{ role: 'system', content: 'ROLE: skeptic' }, { role: 'user', content: 'x' }];
  await MIND.think('deep', msgs, {});
  await MIND.think('deep', msgs, {});
  ok(tiers.join() === 'deep,strong', 'after a paid answer whose cost was not written, the next deep call goes free: ' + tiers.join());
  ok(S.has(SOUL.K.deepOff(D0)) && (await SOUL.readSpendMicros()) === 20000, 'the day is marked closed, and the cost written by the soul itself');
  setDay(D1); tiers.length = 0; S.delete(SOUL.K.deepOff(D1));
  SOUL.setSeams({ route: SR });
}

/* ===========================================================================
   11. RUN BEFORE FIVE, AND A BUSY TICK
=========================================================================== */
console.log('\n11. the owner\'s early Run is an extra cycle');
{
  resetStore(); NOTIFY.length = 0; ROUTER.plan = '{"intents":[]}';
  setDay(D0, '03:10'); quietExp();
  const early = await MIND.tick({ force: true });
  ok(early.ran && early.status === 'done' && JSON.parse(S.get(SOUL.K.cycleCurrent)).extra === true, 'a Run at 03:10 runs, as an extra cycle');
  setDay(D0, '05:15');
  const sched = await MIND.tick({});
  ok(sched.ran && sched.id === D0 + '-' + (new Date(D0 + 'T00:00:00Z').getUTCDay() === 1 ? 'weekly' : 'daily') && S.get(SOUL.K.cycleDaily) === D0, 'and the 05:00 cycle still runs: ' + sched.id);
  setDay(D0, '05:30');
  ok((await MIND.tick({})).due === false, 'once');
  S.set(SOUL.K.tickLock, 'someone');
  const busy = await door({ method: 'POST', headers: AUTH, body: { action: 'run' } });
  ok(busy.body.busy === true && busy.body.message === 'A cycle is already running.', 'a Run while a tick holds the lock says so: ' + busy.body.message);
  const html = fs.readFileSync(new URL('../admin2.html', import.meta.url), 'utf8');
  ok(/if\(r\.j\.busy\)/.test(html) && /A cycle is already running\./.test(html), 'and the room shows it');
}

/* ===========================================================================
   12. THE TEST, THE TEACHING, THE COMMENTS
=========================================================================== */
console.log('\n12. no re-plan after the owner stops a test; the reconcile undo looks first');
{
  const plan = async history => {
    resetStore(); setDay(D0); ROUTER.plan = '{"intents":[]}';
    S.set('nexp:state', JSON.stringify({ current: null, history }));
    const t = await MIND.tick({ force: true });
    return MIND.readCycle(t.id);
  };
  let rec = await plan([{ id: 'verse-length', start: addDays(D0, -20), stoppedAt: addDays(D0, -5) + 'T09:00:00Z', stoppedBy: 'owner' }]);
  ok(!rec.intents.some(i => i.action === 'experiment-plan') && rec.dropped.some(d => /owner stopped a test/.test(d)), 'the owner stopped it 5 days ago: not planned again, and said why');
  rec = await plan([{ id: 'verse-length', start: addDays(D0, -9), stoppedAt: addDays(D0, -3) + 'T09:00:00Z', stoppedBy: 'soul' }]);
  ok(!rec.intents.some(i => i.action === 'experiment-plan'), 'one planned 9 days ago: not again yet');
  rec = await plan([{ id: 'verse-length', start: addDays(D0, -40), stoppedAt: addDays(D0, -20) + 'T09:00:00Z', stoppedBy: 'owner' }]);
  ok(rec.intents.some(i => i.action === 'experiment-plan' && i.seeded), 'twenty days on, it is planned again');

  resetStore();
  H.set('nsoc:reels:postedch', new Map([['r1|instagram', D0 + '#'], ['r2|instagram', D0 + '#reelA']]));
  const rv = await SOCIAL.revertTaught([{ reel: 'r1', network: 'instagram', before: null, wrote: D0 + '#' }, { reel: 'r2', network: 'instagram', before: null, wrote: D0 + '#' }]);
  ok(rv.ok && rv.reverted === 1 && rv.skipped === 1 && !H.get('nsoc:reels:postedch').has('r1|instagram') && H.get('nsoc:reels:postedch').get('r2|instagram') === D0 + '#reelA', 'the undo reverts only the field still as taught, and leaves the one the poster has since written');
  const TG = DEPS.teachGuard;
  DEPS.teachGuard = async () => ({ ok: true, written: 1, taught: [{ reel: 'r9', day: D0, before: null }] });
  const t = await HANDS.runHand({ action: 'reconcile-teach', args: { network: 'instagram' }, why: 'teach' }, { approval: APPROVED });
  DEPS.teachGuard = TG;
  ok(t.ok && t.entry.undo.keys[0].wrote === D0 + '#', 'the soul\'s teach keeps what it wrote, for that check');
  ok(!/deepOnce/.test(fs.readFileSync(new URL('../api/_llm.js', import.meta.url), 'utf8')), 'no stale deepOnce comment is left');
}

/* ===========================================================================
   THE RE-REVIEW (2 October 2026)
=========================================================================== */
console.log('\nR1. a tick ends on time: the canaries resume, a hung hand is let go, a dead weekly cycle still reports');
{
  resetStore(); setDay(D0); ROUTER.guardian = 'smart'; ROUTER.plan = '{"intents":[]}';
  const SR = SOUL.seams.route;
  let strong = 0;
  const hook = step => SOUL.setSeams({ route: async task => { const role = /ROLE: (\w+)/.exec(task.messages[0].content)[1];
    if (role === 'guardian' && task.tier === 'strong') { strong++; CLOCK.t += step; } return SR(task); } });
  hook(40000);
  const cand = { version: 1, lessons: [{ id: 'l1', text: 'Short verse reels hold people longer.' }] };
  const a = await EVOLVE.runCanaries(cand, { progressKey: 'nsoul:canary:test', until: CLOCK.t + 100000 });
  ok(a.incomplete && a.results.length === 3 && strong === 3, 'out of time after three canaries: it stops and says the verdict is not in (' + strong + ' asked)');
  const b = await EVOLVE.runCanaries(cand, { progressKey: 'nsoul:canary:test' });
  ok(b.ok && b.results.length === 8 && strong === 7, 'the next run asks only the four it had not, then the strategist: 7 Guardian answers in all, none twice');

  /* through a weekly cycle: the reflection's canaries resume on the next tick */
  resetStore(); strong = 0;
  let monday = D0; while (new Date(monday + 'T00:00:00Z').getUTCDay() !== 1) monday = addDays(monday, 1);
  setDay(monday, '05:20'); quietExp();
  ROUTER.reflect = JSON.stringify({ lessons: [{ text: 'Short verse reels hold people longer than long ones.', why: 'the learn block' }], goals: [], upgrades: [] });
  hook(60000);
  const t1 = await MIND.tick({});
  const r1 = await MIND.readCycle(t1.id);
  ok(t1.timeUp && r1.stage === 'reflect' && r1.reflect.weekly.canaryResumes === 1 && !r1.reflect.weekly.evaluated, 'the canaries ran out of the tick and the cycle stopped at reflect, to resume (' + strong + ' answers so far)');
  const sofar = strong;
  setDay(monday, '05:40');
  const t2 = await MIND.tick({});
  ok(t2.status === 'done' && strong === 7 && sofar < 7, 'the next tick finished them: 7 Guardian answers across both ticks, none repeated');
  ok((await EVOLVE.readPlaybook()).version === 1, 'and the lesson was applied');
  SOUL.setSeams({ route: SR });
  ROUTER.reflect = '{"lessons":[],"goals":[],"upgrades":[]}'; ROUTER.guardian = 'approve';

  /* a hand that never answers */
  resetStore(); setDay(D0); quietExp();
  const IR = DEPS.insightsRefresh; let started = 0;
  DEPS.insightsRefresh = () => { started++; return new Promise(() => {}); };
  MIND.LIMITS.handStepMs = 50;
  ROUTER.plan = JSON.stringify({ intents: [{ action: 'insights-refresh', args: {}, why: 'The numbers are stale.', metric: 'northStar' }] });
  const th = await MIND.tick({ force: true });
  const rh = await MIND.readCycle(th.id);
  const hung = rh.intents.find(i => i.action === 'insights-refresh');
  ok(th.status === 'done' && hung.status === 'unknown' && /longer than/.test(hung.result.error) && /audit/.test(hung.result.error), 'a hand that does not answer is let go, marked unknown, and the cycle finishes: ' + hung.result.error);
  ok(started === 1, 'and it is never started a second time');
  MIND.LIMITS.handStepMs = MIND.HAND_STEP_MS; DEPS.insightsRefresh = IR; ROUTER.plan = '{"intents":[]}';

  /* a weekly cycle that dies three times still sends its summary */
  resetStore(); NOTIFY.length = 0;
  setDay(monday, '05:20'); quietExp();
  const tw = await MIND.tick({});
  const rw = await MIND.readCycle(tw.id);
  NOTIFY.length = 0;
  rw.status = 'running'; rw.stage = 'reflect'; rw.report = null;
  for (const st of ['reflect', 'report']) rw.stages[st] = { status: 'pending', tries: 0, error: null, at: null };
  rw.stages.reflect = { status: 'pending', tries: 2, error: null, at: null, running: true };
  S.set(SOUL.K.cycle(rw.id), JSON.stringify(rw));
  S.delete(SOUL.K.done(rw.id, 'report'));
  S.set(SOUL.K.cycleCurrent, JSON.stringify({ id: rw.id, date: monday, kind: 'weekly', status: 'running' }));
  setDay(monday, '05:35');
  const tf = await MIND.tick({});
  ok(tf.status === 'failed' && NOTIFY.length === 1 && /weekly/.test(NOTIFY[0]) && /failed at reflect/.test(NOTIFY[0]), 'killed a third time, the weekly cycle still sends its summary, saying it failed: ' + (NOTIFY[0] || '').slice(0, 160));
  await MIND.tick({ force: true });
  ok(NOTIFY.filter(n => /failed at reflect/.test(n)).length === 1, 'and only once');
}

console.log('\nR2. the canaries ask as the real plan asks, at temperature 0');
{
  /* a day the deep tier was not closed on (section 10 closed one) */
  resetStore(); setDay(addDays(D0, 3)); ROUTER.calls.length = 0; ROUTER.guardian = 'smart'; ROUTER.plan = '{"intents":[]}';
  const SR = SOUL.seams.route; const tasks = [];
  SOUL.setSeams({ route: async task => { tasks.push(task); return SR(task); } });
  await EVOLVE.runCanaries({ version: 0, lessons: [] });
  SOUL.setSeams({ route: SR }); ROUTER.guardian = 'approve';
  const role = t => /ROLE: (\w+)/.exec(t.messages[0].content)[1];
  const st = tasks.filter(t => role(t) === 'strategist');
  ok(st.length >= 1 && st[0].tier === 'deep' && st[0].opts.max_tokens === 1400 && st[0].opts.timeout === 30000 && st[0].opts.temperature === 0, 'the strategist canary: the deep tier, 1400 tokens, 30 seconds, temperature 0');
  const gd = tasks.filter(t => role(t) === 'guardian');
  ok(gd.length >= 7 && gd.every(t => t.opts.temperature === 0), 'every Guardian canary at temperature 0');
}

console.log('\nR3. only the soul\'s own skips count against posting health');
{
  setDay(D0);
  const obs = OBS();
  obs.postingHealth.days = Array.from({ length: 8 }, (_, i) => ({ date: addDays(D0, i - 8), sent: 9, partial: 0, failed: 0, pending: 0, none: i === 6 ? 2 : 1, skipped: i === 7 ? 2 : 0, skippedSoul: 0 }));
  const snap = await SOUL.buildSnapshot({ ...DEPS, observatory: async () => obs }, { lessonsCount: async () => 0 });
  ok(snap.output.health === 1 && snap.output.due === 63 && snap.output.skips7.total === 2 && snap.output.skips7.soul === 0, 'two owner skips and the poster\'s quiet slots: health stays 1, the skips still counted');
}

console.log('\nR4. the small things');
{
  ok(/today or tomorrow/.test(HANDS.HANDS['lineup-skip'].describe) && /today or tomorrow/.test(HANDS.HANDS['lineup-swap'].describe), 'the line-up hands tell the planner: today or tomorrow');
  ok(/today or tomorrow/.test(HANDS.registryText()), 'in the registry it reads');
  const html = fs.readFileSync(new URL('../admin2.html', import.meta.url), 'utf8');
  ok(/soul-cyc-failed/.test(html) && /soul-cyc-dropped/.test(html), 'the cycle sheet shows why a cycle failed and what was dropped (drawn in tests/console-soul.mjs)');
  ok(INST.YT_HOUR_UTC === 9 && INST.YT_UNITS_DAY === 250, 'YouTube is read after 09:00 UTC, at most 250 units');
  resetStore();
  await INST.indexnowKey(true);
  const DOORM = await import('../api/soul.js');
  DOORM.KEY_MISSES.clear();
  const { LOG } = await import('./_soul-harness.mjs');
  LOG.length = 0;
  const m1 = await door({ query: { action: 'indexnow-key', key: 'f'.repeat(32) } });
  const after1 = LOG.length;
  const m2 = await door({ query: { action: 'indexnow-key', key: 'f'.repeat(32) } });
  ok(m1.statusCode === 404 && m2.statusCode === 404 && after1 >= 1 && LOG.length === after1, 'a miss is remembered for a minute: the second costs the store nothing');
  ok(DOORM.KEY_MISS_MS === 60000, 'for one minute');
  const k = JSON.parse(S.get(SOUL.K.indexnowKey)).key;
  ok((await door({ query: { action: 'indexnow-key', key: k } })).statusCode === 200, 'and the real key still answers');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
