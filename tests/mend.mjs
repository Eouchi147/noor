/* NOOR · round ten: the outreach that mends itself (LANTERN.md section 16).
   ---------------------------------------------------------------------------
   The owner, 7 October 2026, with nine letters held one evening ("the judge
   held the letter: it promises money or a gift (0.63)", "guardian: no
   answer: no free model answered today"): "please fix it so it can send on
   its own with the lantern fixing the issues it finds instead of blocking
   and leaving me in the dust".

   Against the real modules over the in-memory store of
   tests/_soul-harness.mjs, this proves:
     the judge asks what it was meant to ask: the house's own free offer is
       not a promise of value; money, a payment, a prize, a reward or a
       condition still is; every question says how a writer mends it;
     a letter's council reviewer that no free model could answer is asked
       once more, the same question, by one paid model (purpose "reviewer"),
       within the paid caps and twelve a day; its verdict is the reviewer's
       and the rule is unchanged; never for an act that is not a letter,
       never over a real no, never past the council's time;
     a letter the judge held is written again, told why and how to mend it;
       one the owner asked for himself, which only the judge doubted, goes to
       his own Send with the doubt beside it; the house's own rules over the
       words are never carried past, not even for him;
     the Lantern mends today's held letters on the tick: which ones (a
       silent council, a writer that could not be reached, the judge), how
       (the council again, or the hand under the approval it has), how often
       (two a tick, three a letter, forty minutes apart), and never a real
       refusal; what it did, shown in the Mail room and kept out of Needs you
       while it is on it; a run that did not go stays in view and may be run
       again from Home; a place a passed reason held is free again, once.

   Run:  node tests/mend.mjs
*/
import {
  S, L, H, Z, FAULT, resetStore, SOUL, HANDS, COUNCIL, ROUTER, setDay, today, addDays, CLOCK, JEV, jevOn, jevOff
} from './_soul-harness.mjs';
const J = await import('../api/_judge.js');
const LLM = await import('../api/_llm.js');
const HOME = await import('../api/_home.js');
const O = await import('../api/_outreach.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const D0 = '2026-10-08';
const realMonth = () => new Date().toISOString().slice(0, 7);
const roleOf = t => (/ROLE: ([\w-]+)/.exec(String(t.messages[0] && t.messages[0].content)) || [])[1];
const SR = SOUL.seams.route;

/* ===========================================================================
   1. THE JUDGE ASKS WHAT IT WAS MEANT TO ASK
=========================================================================== */
console.log('\n1. the judge: a free offer is not a promise of value, and every hold says how to mend it');
{
  const q = J.LETTER_QUESTIONS.promises_money.instructions;
  ok(/money, a payment, a prize or a reward/.test(q) && /depend on the reader doing something in return/.test(q) && /free material/.test(q) && /nothing asked in return is not this/.test(q) && !/a gift, a payment, a reward or anything else of value/.test(q),
    'the money question asks about money, a payment, a prize, a reward or a condition, and says the free offer is not that');
  ok(/gentle suggestion they may take or leave is not this/.test(J.LETTER_QUESTIONS.pressure_to_give.instructions), 'the pressure question tells a gentle suggestion from pressure');
  ok(Object.keys(J.LETTER_MEND).join() === Object.keys(J.LETTER_QUESTIONS).join(), 'every question has its mend: ' + Object.keys(J.LETTER_MEND).join(', '));
  jevOn(k => (k === 'promises_money' ? 0.81 : 0.03));
  const r = await J.letterRisk({ subject: 'For your school', text: 'Assalamu alaykum,\n\nWe will pay your teachers if you share our posts.' });
  ok(r.held && r.reasons.length === 1 && /^it promises money or a reward \(0\.81\)$/.test(r.reasons[0]) && r.mend.length === 1 && /offer only the library's free material/.test(r.mend[0]), 'a real promise is still held, and says how to mend it: ' + r.mend[0]);
  jevOn(() => 0.03);
  const free = await J.letterRisk({ subject: 'For your school', text: 'Assalamu alaykum,\n\nThe School at https://noorcodex.com/school is free and asks nothing in return.' });
  ok(!free.held && free.mend.length === 0, 'the free offer, judged under the line, goes');
  jevOff();
}

/* ===========================================================================
   2. A SILENT REVIEWER IS ASKED ONCE MORE, ON THE PAID TIER
=========================================================================== */
console.log('\n2. the council: a letter\'s reviewer no free model could answer is asked once more, paid; the rule unchanged');
{
  const letter = { action: 'outreach-send', args: { placeId: 'p-1', offer: 'weekend-school' }, why: 'Its weekend school teaches children; the library suits its classes.', expectedEffect: 'a first letter', metric: 'outreach.contacted', evidence: {} };
  const swap = { action: 'lineup-swap', args: { date: addDays(D0, 1), slot: 'reelB', id: 'verse-kursi' }, why: 'Verse reels reached people.', expectedEffect: 'more reach', metric: 'northStar', evidence: {} };
  const T = { tasks: [], paid: { guardian: 'approve', skeptic: 'approve' }, available: true };
  SOUL.setSeams({ route: async task => {
    T.tasks.push(task);
    if (task.tier === 'deep') {
      if (!T.available) return { ok: false, error: 'no paid model answered', tier: 'deep', paid: false, costUsd: 0 };
      const role = roleOf(task);
      const id = await LLM.paidRecord({ task: task.purpose, model: 'openai/gpt-6-luna', costUsd: 0.003 });
      return { ok: true, content: JSON.stringify({ vote: T.paid[role], reasons: ['the paid ' + role] }), tier: 'deep', paid: true, purpose: task.purpose, paidId: id, costUsd: 0.003, spendRecorded: true, model: 'openai/gpt-6-luna' };
    }
    return SR(task);
  } });
  jevOn(() => 0.05); resetStore(); setDay(D0, '09:00');
  ROUTER.failRoles = new Set(['guardian', 'skeptic']);
  let c = await COUNCIL.convene(letter, {});
  const deep = T.tasks.filter(t => t.tier === 'deep');
  ok(c.approved && c.voices && c.voices.length === 2 && c.voices.every(v => v.paid && v.vote === 'approve'), 'both reviewers silent: each asked once more, paid, and their yes stands: ' + JSON.stringify(c.voices && c.voices.map(v => v.role + ':' + v.vote)));
  ok(deep.length === 2 && deep.every(t => t.purpose === 'reviewer' && t.paidOnly === true) && deep.map(roleOf).sort().join() === 'guardian,skeptic', 'asked as "a reviewer the free models could not answer", paid or nothing, the same roles');
  ok(c.verdicts.guardian.paidVoice && /no answer/.test(c.verdicts.guardian.free.reasons[0]) && c.verdicts.skeptic.paidVoice, 'each verdict keeps what the silent free one said');
  const lines = (await LLM.paidLedger(realMonth())).filter(l => l.task === 'reviewer');
  ok(lines.length === 2 && lines.every(l => l.outcome && l.outcome.helped === true), 'two lines in the ledger, each saying the letter went on');
  /* the rule unchanged: the paid Guardian may still say no */
  resetStore(); T.tasks.length = 0; T.paid = { guardian: 'reject', skeptic: 'approve' };
  c = await COUNCIL.convene(letter, {});
  ok(!c.approved && c.voices.length === 2 && c.verdicts.guardian.vote === 'reject', 'a paid Guardian\'s no is a no');
  /* one silent, one real no: nothing paid */
  resetStore(); T.tasks.length = 0; T.paid = { guardian: 'approve', skeptic: 'approve' };
  ROUTER.failRoles = new Set(['guardian']); ROUTER.skeptic = 'reject';
  c = await COUNCIL.convene(letter, {});
  ok(!c.approved && !c.voices && !T.tasks.some(t => t.tier === 'deep'), 'a reviewer who said a real no is never bought back');
  ROUTER.skeptic = 'approve';
  /* not a letter: nothing paid */
  resetStore(); T.tasks.length = 0; ROUTER.failRoles = new Set(['guardian', 'skeptic']);
  c = await COUNCIL.convene(swap, {});
  ok(!c.approved && !c.voices && !T.tasks.some(t => t.tier === 'deep'), 'an act that is not a letter: silence stays a no, nothing paid');
  /* the day's twelve */
  resetStore(); T.tasks.length = 0;
  S.set('nsoul:paid:reviewer:' + today(), '12');
  c = await COUNCIL.convene(letter, {});
  ok(!c.approved && c.voices && c.voices.every(v => !v.asked && /12 paid reviewers are spent/.test(v.why)) && !T.tasks.some(t => t.tier === 'deep'), 'past twelve a day, none is asked: ' + (c.voices && c.voices[0].why));
  ok(COUNCIL.REVIEWER_PAID_DAY === 12, 'twelve a day, written once');
  /* no paid name may answer */
  resetStore(); T.tasks.length = 0; T.available = false;
  c = await COUNCIL.convene(letter, {});
  ok(!c.approved && c.voices.length === 2 && c.voices.every(v => v.asked && !v.paid), 'no paid name could answer: silence stays a no');
  T.available = true;
  /* the council's own time */
  resetStore(); T.tasks.length = 0;
  c = await COUNCIL.convene(letter, {}, { until: Date.now() + 5000 });
  ok(!c.approved && !T.tasks.some(t => t.tier === 'deep'), 'too little of the council\'s time left: nothing paid');
  /* round ten c: a free reviewer may wait for its best name's next minute,
     only inside the council's time less what a paid reviewer needs after
     it; a paid reviewer never waits; no deadline, no wait */
  resetStore(); T.tasks.length = 0;
  const until = Date.now() + 89000;
  c = await COUNCIL.convene(letter, {}, { until });
  const freeT = T.tasks.filter(t => t.tier !== 'deep' && ['guardian', 'skeptic'].includes(roleOf(t)));
  const paidT = T.tasks.filter(t => t.tier === 'deep');
  ok(c.approved && freeT.length === 2 && freeT.every(t => t.opts && t.opts.waitUntil === until - COUNCIL.TIE_LIMITS.needMs - COUNCIL.FREE_WAIT_MARGIN_MS)
    && paidT.length === 2 && paidT.every(t => !t.opts || t.opts.waitUntil === undefined),
    'a free reviewer may wait until the council\'s time less a paid reviewer\'s (' + (freeT[0] && until - freeT[0].opts.waitUntil) + ' ms before its end); a paid one never waits');
  T.tasks.length = 0;
  c = await COUNCIL.convene(letter, {});
  ok(T.tasks.filter(t => t.tier !== 'deep').every(t => !t.opts || t.opts.waitUntil === undefined), 'no deadline given: no wait');
  /* a silent reviewer says which models it asked */
  ROUTER.failRoles = new Set(); SOUL.setSeams({ route: async task => (roleOf(task) === 'guardian' && task.tier !== 'deep'
    ? { ok: false, error: 'no free model answered today', tier: 'strong', tried: [{ provider: 'groq', model: 'openai/gpt-oss-120b', err: '429 rate limited' }, { provider: 'gemini', model: 'gemini-2.5-flash', err: 'quota' }] }
    : SR(task)) });
  resetStore();
  c = await COUNCIL.convene(letter, {}, { voice: false });
  ok(c.verdicts.guardian.failed && c.verdicts.guardian.tried && c.verdicts.guardian.tried.map(t => t.provider + ':' + t.err).join() === 'groq:429 rate limited,gemini:quota', 'a silent reviewer\'s verdict says which models it asked, and why each did not answer');
  SOUL.setSeams({ route: SR }); ROUTER.failRoles = new Set(); ROUTER.guardian = 'approve'; ROUTER.skeptic = 'approve';
  jevOff();
}

/* ===========================================================================
   3. A LETTER THE JUDGE HELD IS WRITTEN AGAIN, TOLD HOW TO MEND IT
=========================================================================== */
console.log('\n3. the writer: told how to mend a judge\'s hold; the owner\'s own ask goes to his Send with the doubt; the house\'s rules never carried past');
{
  const W = { calls: [], body: null };
  const goodBody = task => {
    const user = String(task.messages[1].content);
    const fact = (/FACTS \(from its own pages\):\n- (.*)/.exec(user) || [])[1] || '';
    const offer = (/OFFER: (.*)/.exec(user) || [])[1] || '';
    const step = (/STEP: (.*)/.exec(user) || [])[1] || '';
    return 'Assalamu alaykum,\n\nWe read on your own pages: "' + fact + '" We are NOOR Codex of Light, a free library of Islam with no ads and no account, and we would be glad to help: ' + offer + '.\n\nIf it would help, ' + step + '.';
  };
  SOUL.setSeams({ route: async task => {
    if (roleOf(task) === 'outreach-writer') { W.calls.push(task); return { ok: true, content: JSON.stringify({ body: W.body ? W.body(task) : goodBody(task) }), tier: task.tier, model: 'stub-writer' }; }
    return SR(task);
  } });
  resetStore(); setDay(D0, '09:00');
  const p = { id: 'p-m1', name: 'Al Huda Centre', kind: 'mosque', city: 'Leeds', country: 'GB', score: 0.5, email: 'info@alhuda.example', website: 'https://alhuda.example',
    facts: [{ text: 'Our weekend school teaches Quran and Arabic every Saturday.', url: 'https://alhuda.example/' }] };
  jevOn(() => 0.03);
  const fine = await O.writeLetter(p, 'weekend-school', 'its weekend school');
  ok(fine.ok && /noorcodex\.com\/school/.test(fine.text) && W.calls.length === 1, 'a letter the judge passes is written once');
  W.calls.length = 0;
  jevOn(k => (k === 'promises_money' ? 0.81 : 0.03));
  const held = await O.writeLetter(p, 'weekend-school', 'its weekend school');
  const retry = String(W.calls[1] && W.calls[1].messages[1].content);
  ok(!held.ok && /the judge held the letter: it promises money or a reward/.test(held.error) && W.calls.length === 2, 'held twice, it is not written: ' + held.error);
  ok(/YOUR LAST DRAFT WAS SET ASIDE, because the judge held the letter: it promises money or a reward \(0\.81\); to mend it: offer only the library's free material/.test(retry), 'the second draft is told why, and how to mend it');
  W.calls.length = 0;
  const forHim = await O.writeLetter(p, 'weekend-school', 'its weekend school', { owner: true });
  ok(forHim.ok && forHim.doubt && /it promises money or a reward/.test(forHim.doubt) && /noorcodex\.com\/school/.test(forHim.text), 'the owner\'s own ask: the letter is kept for his Send, the doubt beside it');
  W.body = task => goodBody(task) + ' We hope this letter finds you in good health and we would like to delve into it.';
  W.calls.length = 0;
  jevOn(() => 0.03);
  const slop = await O.writeLetter(p, 'weekend-school', 'its weekend school', { owner: true });
  ok(!slop.ok && !slop.doubt && /the house's rules|never writes|delve/.test(slop.error), 'the house\'s own rules over the words are never carried past, not even for him: ' + String(slop.error).slice(0, 120));
  W.body = null;
  jevOff(); SOUL.setSeams({ route: SR });
  ok(O.MENDABLE_HOLD.test('the judge held the letter: it promises money or a gift (0.63)') && O.MENDABLE_HOLD.test('the letter could not be written: no free model answered today') && !O.MENDABLE_HOLD.test('the mailbox refused the letter: that address asked not to be written to again'),
    'the holds a mend may pass over: the judge, a silent writer; never a refusal');
}

/* ===========================================================================
   4. THE LANTERN MENDS ITS OWN HELD LETTERS ON THE TICK
=========================================================================== */
console.log('\n4. the mend: which held letters, how, how often; never a real refusal');
{
  const silent = { approved: false, sentinel: { role: 'sentinel', vote: 'pass', reasons: [] },
    verdicts: { guardian: { role: 'guardian', vote: 'reject', failed: true, reasons: ['no answer: no free model answered today'] }, auditor: { role: 'auditor', vote: 'approve', reasons: ['ok'] }, skeptic: { role: 'skeptic', vote: 'reject', failed: true, reasons: ['no answer: no free model answered today'] } } };
  const approved = { approved: true, verdicts: { guardian: { vote: 'approve' }, auditor: { vote: 'approve' }, skeptic: { vote: 'approve' } } };
  const realNo = { approved: false, verdicts: { guardian: { role: 'guardian', vote: 'reject', reasons: ['it crosses the constitution'] }, auditor: { vote: 'approve' }, skeptic: { vote: 'approve' } } };
  const send = (n, more) => ({ n, action: 'outreach-send', tier: 'R2', args: { placeId: 'p-' + n, offer: 'weekend-school' }, why: 'a first letter', metric: 'outreach.contacted', ...more });
  const intents = () => [
    send(1, { status: 'rejected', council: silent }),
    send(2, { status: 'failed', council: approved, result: { ok: false, error: 'the judge held the letter: it promises money or a gift (0.63)' } }),
    send(3, { status: 'rejected', council: realNo }),
    send(4, { status: 'failed', council: approved, result: { ok: false, error: 'the day\'s 20 first letters are already written' } }),
    send(5, { status: 'rejected', council: silent }),
    { n: 6, action: 'post-now', tier: 'R2', args: {}, why: 'x', status: 'rejected', council: silent },
    send(7, { status: 'rejected', council: { approved: false, sentinel: { vote: 'reject', reasons: ['spam (0.7)'] }, verdicts: {} } })];
  const RUNS = [];
  const realHand = HANDS.HANDS['outreach-send'];
  const STUB = { outcome: () => ({ ok: true, status: 'waiting-owner', note: 'the stub wrote it' }) };
  HANDS.HANDS['outreach-send'] = { ...realHand, run: async (args, ctx) => { RUNS.push({ args, ctx }); return STUB.outcome(args, ctx); } };
  const setup = () => {
    resetStore(); setDay(D0, '10:00'); RUNS.length = 0;
    S.set('nsoul:cycle:c-m1', JSON.stringify({ id: 'c-m1', date: D0, status: 'done', evidence: {}, intents: intents() }));
    S.set('nsoul:cycle:current', JSON.stringify({ id: 'c-m1', date: D0 }));
    /* n5 was asked for by the owner himself, and the judge held it */
    S.set(SOUL.K.ownerRun('c-m1', 5), JSON.stringify({ by: 'owner', ok: false, error: 'the judge held the letter: it promises money or a gift (0.64)', refused: null, at: D0 + 'T09:00:00.000Z' }));
  };
  /* which, and how */
  const rec0 = { id: 'c-m1', status: 'done' };
  const W = (it, mark) => HOME.mendWay(rec0, it, mark);
  const all = intents();
  ok(W(all[0]).how === 'council' && W(all[1]).how === 'hand' && W(all[2]) === null && W(all[3]) === null && W(all[5]) === null && W(all[6]) === null,
    'a silent council: again; the judge: the hand again; a real no, a cap, an act that is not a letter, the sentinel\'s own no: never');
  ok(W(all[4], { by: 'owner', ok: false, error: 'the judge held the letter: x' }).how === 'hand' && W(all[4], { by: 'owner', ok: false, error: 'the judge held the letter: x' }).owner === true
    && W(all[4], { by: 'owner', ok: true }) === null && W(all[4], { skipped: true }) === null && W(all[4], { pending: true }) === null
    && W(all[4], { by: 'owner', ok: false, error: 'the letter was held: 10 letters already wait for your Send; this one waits for a later run' }) === null,
    'his own Write it anyway that the judge held: again, for him; one done, skipped, running or truly refused: never');
  ok(W(send(8, { status: 'approved', council: approved }), null).how === 'hand' && W(send(9, { status: 'planned' }), null).how === 'council' && HOME.mendWay({ id: 'x', status: 'running' }, send(9, { status: 'planned' }), null) === null,
    'a plan that stopped before a letter: the hand if it was approved, the council if not; never while the plan still runs');
  ok(W(send(10, { status: 'rejected', council: { approved: false, timedOut: true, verdicts: {} } })).how === 'council', 'a council that ran out of time: again');
  /* the tick */
  setup();
  let r = await HOME.mendLetters({ until: Date.now() + 200000 });
  ok(r.ok && r.tried === 2 && r.wrote === 2 && RUNS.map(x => x.args.placeId).join() === 'p-1,p-2', 'two a tick, in the plan\'s order: the silent council convened again, the judge\'s letter written again');
  ok(RUNS.every(x => x.ctx.mend === true && x.ctx.actor === 'soul' && !x.ctx.ownerApproved), 'each by the Lantern, as a mend');
  const m1 = JSON.parse(S.get(SOUL.K.ownerRun('c-m1', 1))), m2 = JSON.parse(S.get(SOUL.K.ownerRun('c-m1', 2)));
  ok(m1.by === 'lantern' && m1.ok && m1.mended && m2.by === 'lantern' && m2.ok, 'each marked done by the Lantern, so Home and the Mail room no longer show it held');
  CLOCK.t += 60000;
  r = await HOME.mendLetters({ until: Date.now() + 200000 });
  ok(r.tried === 1 && RUNS.length === 3 && RUNS[2].args.placeId === 'p-5' && RUNS[2].ctx.ownerApproved === true, 'next tick: his own Write it anyway, tried again for him, with his approval');
  const m5 = JSON.parse(S.get(SOUL.K.ownerRun('c-m1', 5)));
  ok(m5.by === 'owner' && m5.ok && m5.mended, 'and marked done as his, mended');
  CLOCK.t += 60000;
  r = await HOME.mendLetters({ until: Date.now() + 200000 });
  ok(r.tried === 0 && RUNS.length === 3, 'a real no, a cap, the sentinel\'s no and an act that is not a letter are never tried: ' + r.tried);
  /* how often: three a letter, forty minutes apart, then final */
  setup();
  STUB.outcome = () => ({ ok: false, error: 'the letter could not be written: no free model answered today' });
  r = await HOME.mendLetters({ until: Date.now() + 200000 });
  ok(r.tried === 2 && r.wrote === 0 && r.held.length === 2, 'a writer still silent: held again, said in the log');
  let k1 = JSON.parse(S.get('nsoul:mend:c-m1:1'));
  ok(k1.tries === 1 && !k1.final && !S.get(SOUL.K.ownerRun('c-m1', 1)), 'one try kept, not final, no mark (it stays in view)');
  CLOCK.t += 10 * 60000;
  r = await HOME.mendLetters({ until: Date.now() + 200000 });
  ok(r.tried === 1 && RUNS.slice(-1)[0].args.placeId === 'p-5', 'ten minutes on, the two just tried wait; the next one is tried');
  for (let i = 0; i < 4; i++) { CLOCK.t += 41 * 60000; await HOME.mendLetters({ until: Date.now() + 200000 }); }
  k1 = JSON.parse(S.get('nsoul:mend:c-m1:1'));
  ok(k1.tries === 3, 'three tries a letter, forty minutes apart, then it rests: ' + k1.tries);
  const held = await HOME.heldLetters();
  const h1 = held.held.find(x => x.id === 'i:c-m1:1'), h3 = held.held.find(x => x.id === 'i:c-m1:3');
  ok(h1 && /^the Lantern tried again at \d\d:\d\d UTC: the letter could not be written/.test(h1.reason) && h1.mending === false && h1.tries === 3, 'the Mail room says what the Lantern last tried, and that it has stopped trying: ' + (h1 && h1.reason));
  ok(h3 && h3.mending === false && /the council said no/.test(h3.reason), 'a real no is shown as it was, not being tried');
  /* while it is still trying, it needs nothing of him */
  setup();
  STUB.outcome = () => ({ ok: false, error: 'the letter could not be written: no free model answered today' });
  await HOME.mendLetters({ until: Date.now() + 200000 });
  const h2 = (await HOME.heldLetters()).held;
  ok(h2.find(x => x.id === 'i:c-m1:1').mending === true && h2.find(x => x.id === 'i:c-m1:3').mending === false, 'one it will try again is marked as such; a real no is not');
  const nv = await HOME.needsView();
  const nh = nv.items.find(x => x.id === 'held');
  ok(nh && nh.letters === h2.filter(x => !x.mending).length, 'Needs you counts only the held letters the Lantern will not try again: ' + (nh && nh.letters));
  /* a real no found on the second council is final */
  setup();
  ROUTER.guardian = 'reject';
  STUB.outcome = () => ({ ok: true, status: 'waiting-owner' });
  jevOn(() => 0.05);
  await HOME.mendLetters({ until: Date.now() + 200000 });
  const kf = JSON.parse(S.get('nsoul:mend:c-m1:1'));
  ok(kf.final === true && /the council said no/.test(kf.error) && !RUNS.some(x => x.args.placeId === 'p-1'), 'convened again and refused for real: final, never tried again');
  ROUTER.guardian = 'approve'; jevOff();
  /* paused, and a plan still running */
  setup();
  await SOUL.setPaused(true, 'owner');
  r = await HOME.mendLetters({ until: Date.now() + 200000 });
  ok(r.tried === 0 && /paused/.test(r.why), 'paused: nothing');
  await SOUL.setPaused(false, 'owner');
  S.set('nsoul:cycle:c-m1', JSON.stringify({ ...JSON.parse(S.get('nsoul:cycle:c-m1')), status: 'running' }));
  r = await HOME.mendLetters({ until: Date.now() + 200000 });
  ok(r.tried === 0 && /a plan is running/.test(r.why), 'a plan running: nothing');
  /* too little time */
  setup();
  r = await HOME.mendLetters({ until: Date.now() + 30000 });
  ok(r.tried === 0, 'too little of the tick left: nothing');
  /* his Write it anyway that did not go stays in view, and may be run again */
  setup();
  STUB.outcome = () => ({ ok: true, status: 'waiting-owner' });
  const h5 = (await HOME.heldLetters()).held.find(x => x.id === 'i:c-m1:5');
  ok(h5 && /^when you ran it: the judge held the letter/.test(h5.reason) && h5.canDoNow, 'a run of his that did not go stays in view, with why');
  const again = await HOME.doNow('i:c-m1:5');
  ok(again.ok && RUNS.slice(-1)[0].ctx.ownerApproved === true, 'and Do it anyway runs it again: ' + again.message);
  const twice = await HOME.doNow('i:c-m1:5');
  ok(!twice.ok && /already answered/.test(twice.message), 'once done, not again');
  HANDS.HANDS['outreach-send'] = realHand;
}

/* ===========================================================================
   5. A PLACE A PASSED REASON HELD IS FREE AGAIN, ONCE
=========================================================================== */
console.log('\n5. places held by a passed reason are free again, once');
{
  resetStore(); setDay(D0, '10:00');
  const place = (id, why) => ({ id, name: 'Place ' + id, kind: 'mosque', status: 'new', email: id + '@place.example', facts: [{ text: 'A weekend school.' }],
    held: why ? { until: addDays(D0, 6), why } : null, history: [], updatedAt: D0 + 'T08:00:00.000Z' });
  const seed = async ps => SOUL.store(ps.flatMap(p => [['HSET', O.OK_KEYS.places, p.id, JSON.stringify(p)], ['HSET', O.OK_KEYS.index, p.id, JSON.stringify({ s: 'new', h: p.held ? p.held.until : '' })]]));
  await seed([place('a', 'the judge held the letter: it promises money or a gift (0.63)'), place('b', 'the letter could not be written: no free model answered today'),
    place('c', 'the mailbox refused the letter: that address asked not to be written to again'), place('d', null)]);
  const got = async id => JSON.parse((await SOUL.store([['HGET', O.OK_KEYS.places, id]]))[0]);
  const idx = async id => JSON.parse((await SOUL.store([['HGET', O.OK_KEYS.index, id]]))[0]);
  const n = await O.releaseHolds();
  ok(n === 2 && !(await got('a')).held && !(await got('b')).held && (await got('c')).held, 'the judge\'s old question and a silent writer let their places go; a refusal keeps its own: ' + n);
  ok((await idx('a')).h === '' && /free again/.test(JSON.stringify((await got('a')).history)), 'the index knows it, and the place\'s history says why');
  await seed([place('e', 'the judge held the letter: it promises money or a gift (0.64)')]);
  const r1 = await HOME.mendLetters({ until: Date.now() + 200000 });
  await seed([place('f', 'the judge held the letter: it promises money or a gift (0.64)')]);
  const r2 = await HOME.mendLetters({ until: Date.now() + 200000 });
  ok(r1.released === 1 && r2.released === 0 && (await got('f')).held, 'through the tick, once: ' + r1.released + ' then ' + r2.released);
}

/* ===========================================================================
   6. ROUND TEN B: THE DAY'S LETTERS, ONE LINE IN THE LOG
=========================================================================== */
console.log('\n6. the day\'s letters as one line of counts in the log, when it changes and once an hour');
{
  const MAIL = await import('../api/_mail.js');
  const DEC = await import('../api/_decisions.js');
  const { door } = await import('./_soul-harness.mjs');
  resetStore(); setDay(D0, '06:10');
  const T = today();
  const silentTried = [{ provider: 'groq', model: 'openai/gpt-oss-120b', err: 'groq 429: rate limit reached for tokens per minute; write to place-1@place.example' },
    { provider: 'openrouter', model: 'meta-llama/llama-4-maverick:free', err: 'openrouter 429: rate-limited upstream' }];
  const silent = { approved: false, verdicts: { guardian: { role: 'guardian', vote: 'reject', failed: true, reasons: ['no answer: no free model answered today'], tried: silentTried },
    auditor: { role: 'auditor', vote: 'approve', reasons: ['ok'] }, skeptic: { role: 'skeptic', vote: 'reject', failed: true, reasons: ['no answer: no free model answered today'], tried: silentTried.slice(0, 1) } } };
  const paidVoice = { approved: true, verdicts: { guardian: { role: 'guardian', vote: 'approve', paidVoice: true, free: { reasons: ['no answer'], tried: [{ provider: 'cerebras', model: 'gpt-oss-120b', err: 'cerebras 503: busy' }] } }, auditor: { vote: 'approve' }, skeptic: { vote: 'approve' } } };
  const send = (n, more) => ({ n, action: 'outreach-send', tier: 'R2', args: { placeId: 'p-' + n }, why: 'a first letter to Place Al Noor', metric: 'outreach.contacted', ...more });
  S.set('nsoul:cycle:c-p1', JSON.stringify({ id: 'c-p1', date: T, status: 'running', stage: 'act', evidence: {}, intents: [
    send(1, { status: 'done', council: paidVoice }), send(2, { status: 'planned' }), send(3, { status: 'approved', council: { approved: true } }),
    send(4, { status: 'rejected', council: silent }), send(5, { status: 'failed', council: { approved: true }, result: { ok: false, error: 'the judge held the letter: it promises money or a reward (0.66)' } }),
    { n: 6, action: 'post-reel', tier: 'R1', status: 'done', args: {} }] }));
  S.set('nsoul:cycle:current', JSON.stringify({ id: 'c-p1', date: T, status: 'running' }));
  S.set(SOUL.K.cycleDaily, T);
  const card = id => DEC.upsert({ kind: 'approve', key: 'mail:' + id, stamp: '1', sticky: true, source: 'mail', title: 'Send this letter to Place ' + id + '?', why: 'One of the first 10.',
    letter: { to: id + '@place.example', toName: 'Place ' + id, subject: 'S', text: 'Assalamu alaykum.', kind: id === 'r' ? 'reply' : 'outreach' },
    options: [DEC.opt.choice('send', 'Send', { type: 'done' }, 'primary'), DEC.opt.later()], link: null, steps: [], expires: addDays(T, 14) });
  await card('a'); await card('b'); await card('r');
  Z.set(MAIL.MK.sched, new Map([['m-later', Date.parse(T + 'T15:00:00Z')]]));
  const row = (id, kind, status, at) => JSON.stringify({ id, at, kind, toName: 'Place ' + id, subject: 'S', status, ...(status === 'sent' ? { sentAt: at } : {}) });
  L.set(MAIL.MK.outLog, [row('m1', 'outreach', 'sent', T + 'T06:01:00.000Z'), row('m2', 'reply', 'sent', T + 'T06:00:00.000Z'), row('m3', 'outreach', 'waiting-owner', T + 'T05:59:00.000Z'),
    row('m1', 'outreach', 'scheduled', T + 'T05:40:00.000Z'), row('m4', 'followup', 'sent', addDays(T, -1) + 'T10:00:00.000Z')]);
  S.set(MAIL.MK.firstTen, '3');
  S.set('nsoul:paid:reviewer:' + T, '2');
  S.set('nsoul:spend:day:' + T, '123456'); S.set('nsoul:spend:' + T.slice(0, 7), '2500000');
  const p = await MAIL.lettersPulse();
  ok(p.cycle === 'c-p1' && p.stage === 'act' && p.status === 'running' && p.planned === 5 && p.reviewing === 1 && p.toWrite === 1 && p.written === 1,
    'where the plan is, and its letters: planned, read by the council, to be written, written: ' + JSON.stringify({ c: p.cycle, s: p.stage, n: p.planned, r: p.reviewing, w: p.toWrite, d: p.written }));
  ok(p.held === 2 && p.mending === 2 && p.why.length === 2 && /the council said no/.test(p.why[0]) && /the judge held the letter/.test(p.why[1]), 'held, with the first reasons, both of them for the Lantern to try again: ' + JSON.stringify(p.why));
  ok(p.waiting === 2 && p.scheduled === 1 && p.sentToday === 1 && p.firstTen === '3/10' && p.paidReviewers === 2,
    'his Send (never a reply), set for later, gone today (never a reply, never yesterday\'s), the first ten and the paid reviewers: ' + JSON.stringify({ w: p.waiting, s: p.scheduled, t: p.sentToday, f: p.firstTen, r: p.paidReviewers }));
  ok(p.silent.length === 3 && /^groq\/openai\/gpt-oss-120b: groq 429: rate limit reached for tokens per minute; write to \[an address\] \(x2\)$/.test(p.silent[0])
    && p.silent[1] === 'cerebras/gpt-oss-120b: cerebras 503: busy' && /^openrouter\/meta-llama\/llama-4-maverick:free: openrouter 429/.test(p.silent[2]),
    'which free models a reviewer asked and what each said, counted over the day, most first, the free answers under a paid voice too: ' + JSON.stringify(p.silent));
  ok(JSON.stringify(p.voices) === JSON.stringify({ free: 1, paid: 1, silent: 2 }), 'who answered the Guardian and the Skeptic: a free model, the paid voice, no one: ' + JSON.stringify(p.voices));
  ok(p.paidUsdToday === 0.1235 && p.paidUsdMonth === 2.5, 'what the paid models cost today and this month: ' + p.paidUsdToday + ', ' + p.paidUsdMonth);
  const all = JSON.stringify(p);
  ok(!all.includes('@') && /\[an address\]/.test(all) && !/Al Noor|Place a|Place b|Assalamu/.test(all), 'never an address, a place\'s name or a letter\'s words');
  /* the tick writes it when it changes, and once an hour while it does not
     (the pointer says done, so these ticks never move the plan itself) */
  S.set('nsoul:cycle:current', JSON.stringify({ id: 'c-p1', date: T, status: 'done' }));
  const lines = [], mlines = [];
  const realLog = console.log;
  const tickNow = async () => {
    console.log = (...a) => { const s = a.join(' '); if (/^\{"noor":"letters"/.test(s)) lines.push(JSON.parse(s)); else if (/^\{"noor":"models"/.test(s)) mlines.push(JSON.parse(s)); else realLog(...a); };
    try { return await door({ query: { action: 'tick' }, headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }); }
    finally { console.log = realLog; }
  };
  let t = await tickNow();
  ok(t.statusCode === 200 && t.body.letters && t.body.letters.planned === 5 && lines.length === 1 && lines[0].noor === 'letters' && lines[0].held === 2 && lines[0].date === T,
    'the tick writes one line, and answers the counts as letters: ' + lines.length);
  CLOCK.t += 15 * 60000;
  t = await tickNow();
  ok(lines.length === 1, 'fifteen minutes on, nothing changed: no second line');
  ok(mlines.length === 1 && Array.isArray(mlines[0].names) && typeof mlines[0].openrouter === 'string', 'round ten c: the free names\' health, once in the hour: ' + JSON.stringify(mlines[0] || null).slice(0, 160));
  S.set(MAIL.MK.firstTen, '4');
  CLOCK.t += 15 * 60000;
  t = await tickNow();
  ok(lines.length === 2 && lines[1].firstTen === '4/10', 'a change: a new line');
  CLOCK.t += 61 * 60000;
  t = await tickNow();
  ok(lines.length === 3, 'an hour unchanged: the line again, so a quiet log still says where the letters are');
  /* nothing today: no line */
  resetStore(); setDay(addDays(D0, 1), '03:00');
  t = await tickNow();
  ok(lines.length === 3 && t.body.letters && t.body.letters.cycle === null, 'a day with no plan and no letters: no line');
  ok(mlines.length === 3, 'the free names\' health: once in each new hour, whatever the letters (' + mlines.length + ')');
  /* a part that cannot be read is named, the rest stands */
  resetStore(); setDay(D0, '06:10');
  S.set('nsoul:cycle:c-p1', JSON.stringify({ id: 'c-p1', date: T, status: 'done', stage: 'report', intents: [send(1, { status: 'done' })] }));
  S.set('nsoul:cycle:current', JSON.stringify({ id: 'c-p1', date: T }));
  FAULT.cmds = new Set(['ZCARD']);
  const pf = await MAIL.lettersPulse();
  FAULT.cmds = null;
  ok(pf.written === 1 && pf.missing && pf.missing.mail && pf.scheduled === 0, 'a store fault: named in missing, the plan\'s counts stand: ' + JSON.stringify(pf.missing));
}

await new Promise(r => setTimeout(r, 10));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
