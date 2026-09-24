/* NOOR · the Lantern agent, with the router, the tools and the store all
   stubbed, and no network reached.
   ---------------------------------------------------------------------------
   Part A proves api/_agent.js on its own: plan parsing survives malformed
   JSON with one local repair then a safe fallback, the three budgets are
   enforced, a tool's own numbers survive the critic while an invented one
   is removed, per-person data never reaches a subagent's prompt, the two
   autonomous actions are logged with a real undo recipe and capped at five
   a day, anything else (a lineup change above all) is always a proposal.

   Part B proves api/lantern-agent.js, the HTTP wiring: the owner gate
   refuses without the cookie, the SSE event stream is in order and each
   event parses as JSON, the ledger and proposal doors answer, and an undo
   really reverses what teachGuard wrote (through api/social.js's own
   revertTaught, checked against a small in-memory store).

   Run:  node tests/agent.mjs
*/
import crypto from 'node:crypto';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

/* ===========================================================================
   PART A · api/_agent.js, pure
=========================================================================== */
const A = await import('../api/_agent.js');

console.log('plan parsing: malformed JSON, one repair, then the fallback');
{
  ok(JSON.stringify(A.parsePlan('{"steps":[{"kind":"tool","name":"observatory","args":{},"why":"x"}]}').steps.length) === '1',
    'clean JSON parses straight through');
  const fenced = '```json\n{"steps":[{"kind":"tool","name":"numbers","args":{},"why":"y"}]}\n```';
  ok(A.parsePlan(fenced).steps[0].name === 'numbers', 'a code fence around the JSON is stripped and read');
  const trailingComma = 'noise before {"steps":[{"kind":"tool","name":"visitors","args":{},"why":"z"},]} noise after';
  ok(A.parsePlan(trailingComma).steps[0].name === 'visitors', 'a trailing comma and stray prose around the braces are repaired');
  ok(A.parsePlan('not json at all, no braces here') === null, 'text with nothing to repair returns null rather than guessing');
  ok(A.parsePlan(null) === null, 'no text at all returns null');
}

console.log('\nthe fallback plan: no longer one fixed read, chosen from the question\'s own keywords (2026-09-24, a live run: the planner could not be read, and observatory alone had nothing that answered "which kind of reel")');
{
  const names = plan => plan.steps.map(s => s.kind + ':' + s.name);
  const bare = A.fallbackPlan('');
  ok(names(bare).join() === 'tool:observatory,subagent:analyst,subagent:strategist',
    'nothing named in the question still gets the whole picture and a reading of it: ' + names(bare).join());
  const kind = A.fallbackPlan('Which kind of reel reaches most people on Instagram, and what should we post more of?');
  ok(names(kind).includes('tool:insights') && names(kind).includes('tool:numbers'),
    'a question about kind or what to post reaches for insights and numbers: ' + names(kind).join());
  const site = A.fallbackPlan('How many visitors does the site get from readers each day?');
  ok(names(site).includes('tool:visitors'), 'a question about the site itself reaches for visitors: ' + names(site).join());
  const net = A.fallbackPlan('Why is Facebook at zero?');
  ok(names(net).includes('tool:numbers') && names(net).includes('tool:reconcileRead'),
    'a question naming a network reaches for numbers and reconcileRead: ' + names(net).join());
  const reconcileStep = net.steps.find(s => s.name === 'reconcileRead');
  ok(reconcileStep && reconcileStep.args.network === 'facebook', 'and reconcileRead is asked about that exact network: ' + JSON.stringify(reconcileStep));
  const pkg = A.fallbackPlan('Make a package for the best verse of the month');
  ok(names(pkg).includes('tool:package'), 'a question asking for a package reaches for package: ' + names(pkg).join());
  const line = A.fallbackPlan("Plan next week's line-up");
  ok(names(line).includes('tool:lineup') && names(line).includes('tool:shelf'), 'a question about the line-up reaches for lineup and shelf: ' + names(line).join());
  ok(names(bare).join() === names(A.fallbackPlan()).join(), 'no message at all is the same as an empty one, never a crash');
  for (const p of [bare, kind, site, net, pkg, line]) {
    ok(p.steps[0].kind === 'tool' && p.steps[0].name === 'observatory', 'observatory always runs first');
    ok(p.steps[p.steps.length - 1].name === 'strategist' || p.steps.length >= A.BUDGETS.maxSteps,
      'the analyst and strategist subagents always run last, reading whatever the tools above them found');
    ok(p.steps.length <= A.BUDGETS.maxSteps, 'never more than the step budget, even a question that matches every keyword at once: ' + p.steps.length);
  }
}

console.log('\nplan parsing survives what a real free model actually answers, not only strict JSON (2026-09-24, a live run: nvidia/nemotron-3-ultra-550b-a55b on OpenRouter)');
{
  const shape = { steps: [{ kind: 'tool', name: 'insights', args: {}, why: 'x' }] };
  const think = '<think>I should read insights first.</think>\n' + JSON.stringify(shape);
  ok(A.parsePlan(think) && A.parsePlan(think).steps[0].name === 'insights', 'a <think>...</think> block is stripped before the JSON is ever read');
  const preamble = 'Sure, here is my plan for this request:\n\n' + JSON.stringify(shape) + '\n\nLet me know if you would like changes.';
  ok(A.parsePlan(preamble) && A.parsePlan(preamble).steps[0].name === 'insights', 'a reasoning preamble before the JSON, and trailing prose after it, are both read past');
  const nested = 'Here is the plan, as requested: ' + JSON.stringify(shape) + ' -- that should cover it.';
  ok(A.parsePlan(nested) && A.parsePlan(nested).steps[0].name === 'insights', 'a JSON object nested inside surrounding text is extracted whole');
  const singleQuoted = "{'steps':[{'kind':'tool','name':'insights','args':{},'why':'x'}]}";
  ok(A.parsePlan(singleQuoted) && A.parsePlan(singleQuoted).steps[0].name === 'insights', 'single quotes throughout are repaired to real JSON');
  const trailingComma = '{"steps":[{"kind":"tool","name":"insights","args":{},"why":"x"},]}';
  ok(A.parsePlan(trailingComma) && A.parsePlan(trailingComma).steps[0].name === 'insights', 'a trailing comma is still repaired');
  const bareArray = '[{"kind":"tool","name":"insights","args":{},"why":"x"}]';
  ok(A.parsePlan(bareArray) && A.parsePlan(bareArray).steps[0].name === 'insights', 'a bare array of steps is read as the steps list itself, not only {"steps":[...]}');
  const everything = '<think>hmm</think>Sure, my plan:\n' + "{'steps': [{'kind': 'tool', 'name': 'insights', 'args': {}, 'why': 'x'},]}" + '\nHope that helps!';
  ok(A.parsePlan(everything) && A.parsePlan(everything).steps[0].name === 'insights', 'a think block, a preamble, single quotes and a trailing comma together, all in one answer, still parse');
  ok(A.parsePlan('not json at all, no braces here') === null, 'text with nothing to repair returns null rather than guessing');

  /* names in a different case or with spaces, or a subagent named with a
     different case, both fold to the same canonical name; an unknown name
     is still dropped, never guessed at */
  const cased = { steps: [
    { kind: 'TOOL', name: 'Reconcile Read', args: { network: 'facebook' }, why: 'a' },
    { kind: 'Subagent', name: 'STRATEGIST', args: {}, why: 'b' },
    { kind: 'tool', name: 'site-search', args: {}, why: 'c' },
    { kind: 'tool', name: 'not-a-real-tool', args: {}, why: 'd' }
  ] };
  const v = A.validatePlan(cased);
  ok(v.length === 3, 'case and spacing differences still match a real tool or subagent name: ' + JSON.stringify(v.map(s => s.name)));
  ok(v.some(s => s.name === 'reconcileRead') && v.some(s => s.name === 'strategist') && v.some(s => s.name === 'siteSearch'),
    'each one folds to its own canonical name, not a guess at a new one');
}

console.log('\nplan validation: only known tools and subagents survive, capped at the step budget');
{
  const raw = { steps: [
    { kind: 'tool', name: 'observatory', args: {}, why: 'a' },
    { kind: 'tool', name: 'not-a-real-tool', args: {}, why: 'b' },
    { kind: 'subagent', name: 'analyst', args: {}, why: 'c' },
    { kind: 'subagent', name: 'not-a-real-role', args: {}, why: 'd' },
    { kind: 'action', name: 'refresh-insights', args: {}, why: 'e' },
    { kind: 'nonsense' }
  ] };
  const v = A.validatePlan(raw);
  ok(v.length === 3, 'only the tool, the subagent and the action that name something real survive: ' + v.length);
  ok(v.every(s => s.why && s.why.length), 'every surviving step keeps its own reason');

  const tooMany = { steps: Array.from({ length: 20 }, (_, i) => ({ kind: 'tool', name: 'observatory', args: {}, why: 'n' + i })) };
  ok(A.validatePlan(tooMany).length === A.BUDGETS.maxSteps, 'a plan with 20 steps is capped at the ' + A.BUDGETS.maxSteps + '-step budget');
}

console.log('\nplan coverage: what a real model\'s own plan forgot, the question\'s own keywords supply (2026-09-24, a live run: a real model\'s plan named observatory alone for "which kind of reel reaches most people on Instagram, and what should we post more of")');
{
  const names = steps => steps.map(s => s.kind + ':' + s.name);
  /* the exact live fault: a valid, parsed plan of one step, for a question
     this file's own keyword map already knows needs insights and numbers,
     and "what should" already knows needs a reading */
  const one = A.validatePlan({ steps: [{ kind: 'tool', name: 'observatory', args: {}, why: 'the whole picture' }] });
  const covered = A.ensurePlanCoverage(one, 'Which kind of reel reaches most people on Instagram, and what should we post more of? Keep it short.');
  ok(names(covered).includes('tool:insights') && names(covered).includes('tool:numbers'),
    'a one-step plan for a question that needs numbers gets insights and numbers added: ' + names(covered).join());
  ok(names(covered).includes('subagent:analyst') && names(covered).includes('subagent:strategist'),
    'and "what should" gets a reader added too, even though the model\'s own plan never asked for one: ' + names(covered).join());
  ok(covered[0].kind === 'tool' && covered[0].name === 'observatory', 'the model\'s own first step is kept, never replaced');

  /* a plan that already covers what the question needs is left exactly as
     it was, not padded with a duplicate */
  const full = A.validatePlan({ steps: [
    { kind: 'tool', name: 'observatory', args: {}, why: 'a' },
    { kind: 'tool', name: 'insights', args: {}, why: 'b' },
    { kind: 'tool', name: 'numbers', args: {}, why: 'c' },
    { kind: 'subagent', name: 'analyst', args: {}, why: 'd' },
    { kind: 'subagent', name: 'strategist', args: {}, why: 'e' }
  ] });
  const same = A.ensurePlanCoverage(full, 'what should we post more of?');
  ok(same.length === full.length, 'a plan that already covers the question is never padded: ' + same.length);

  /* a question with none of the keywords and none of "what should/why/plan"
     is left exactly as the model planned it */
  const untouched = A.ensurePlanCoverage(A.validatePlan({ steps: [{ kind: 'tool', name: 'observatory', args: {}, why: 'a' }] }), 'Hello.');
  ok(untouched.length === 1, 'a question that asks for nothing in particular is left as the model planned it: ' + untouched.length);

  /* the step budget still holds even once coverage tops a plan up */
  const nearFull = A.validatePlan({ steps: Array.from({ length: A.BUDGETS.maxSteps - 1 }, (_, i) => ({ kind: 'tool', name: 'observatory', args: { n: i }, why: 'x' })) });
  const topped = A.ensurePlanCoverage(nearFull, 'which kind, why, site visitors, Facebook, package, line-up: what should we post more of?');
  ok(topped.length <= A.BUDGETS.maxSteps, 'coverage never pushes a plan past its own step budget: ' + topped.length);
}

console.log('\nthe critic: a number this run actually found survives, an invented one drops its whole clause, never spliced');
{
  const toolOutputs = [{ name: 'insights', data: { read: 62, unread: 6, engagement: 0.052 } }];
  const evidence = A.evidenceFromToolOutputs(toolOutputs);
  ok(evidence.has(62) && evidence.has(6), 'the tool\'s own numbers are in the evidence set');
  ok(evidence.has(0.05), 'the fraction itself sits in evidence (rounded to 2 decimals, the same rounding the check itself uses), so its written percent form (5.2%) is checked against it directly, with no blanket x100/100 expansion (removed 2026-09-24)');
  const draft = 'This week 62 posts were read and engagement sits near 5.2%. A record 9,999 readers arrived, which nothing here actually said.';
  const c = A.critic(draft, evidence);
  ok(/\b62\b/.test(c.text) && /5\.2%/.test(c.text), 'the numbers the tools actually gave stay in the answer');
  ok(!/9,999/.test(c.text), 'the invented number is gone from the answer entirely');
  ok(c.removed.length === 1 && /9,999/.test(c.removed[0]), 'the whole sentence carrying it is dropped, not spliced with a placeholder, and the drop is recorded: ' + JSON.stringify(c.removed));
  ok(!c.clean, 'a run that had to drop something never claims to be clean');

  const dashed = 'Reach rose ' + String.fromCharCode(0x2014) + ' by a fair amount ' + String.fromCharCode(0x2013) + ' this week.';
  const cd = A.critic(dashed, new Set());
  const dashRx = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']');
  ok(!dashRx.test(cd.text) && cd.dashesFound, 'an em dash or en dash that slipped through is caught and replaced with a comma');

  /* the refuter's own p1.mjs cases: a literal date passes, a genuinely
     derived percent change passes, an invented percent is dropped */
  const obsEvidence = A.evidenceFromToolOutputs([{ name: 'numbers', data: {
    ig: { reach: 14000, posts: 18, engagement: 0.052 }, fb: { reach: 210, posts: 18 }, hour: '19:00', date: '2026-09-24' } }]);
  ok(A.critic('The numbers were last read on 24 September 2026.', obsEvidence).clean,
     'a literal date written in words passes when the ISO form is in evidence');
  const derived = A.critic('Reach rose 6,567% against Facebook this week.', obsEvidence);
  ok(derived.clean && /6,567%/.test(derived.text), 'a percent change genuinely derived from two of this run\'s own numbers (14000 against 210) survives: ' + JSON.stringify(derived));
  const invented = A.critic('Reach rose 42% this week.', obsEvidence);
  ok(!invented.clean && !/42%/.test(invented.text), 'a percent with no literal and no real derivation behind it is dropped: ' + JSON.stringify(invented));
}

console.log('\nthe critic leaves no debris: a dropped clause inside a parenthesis or a list is tidied, not left as punctuation with a hole in it (2026-09-24, a live run: "reel type (verse, dhikr, )")');
{
  const ev = A.evidenceFromToolOutputs([{ name: 'insights', data: { byKind: [{ kind: 'reel:verse', n: 12 }, { kind: 'reel:dhikr', n: 8 }] } }]);
  ok(A.critic('reel type (verse, dhikr, ). It only shows totals.', ev).text === 'reel type (verse, dhikr). It only shows totals.',
     'a trailing comma left inside a parenthesis by a model that ran out of real names to list is cleaned up');
  ok(A.critic('the kinds that matter (verse, dhikr, and ) this week.', ev).text === 'the kinds that matter (verse, dhikr) this week.',
     'an orphaned "and" right before the closing bracket goes with it');
  ok(A.critic('a list with nothing left (, , ) here.', ev).text === 'a list with nothing left here.',
     'a parenthesis with nothing real left inside it is removed whole, not left as empty brackets');
  ok(A.critic('an empty bracket example [] stays gone.', ev).text === 'an empty bracket example stays gone.',
     'an empty bracket pair left by anything else is removed the same way');
  ok(A.critic('double  spaces   here and  there.', ev).text === 'double spaces here and there.', 'doubled spaces left behind are collapsed to one');
  ok(A.critic('a trailing comma before a period, .', ev).text === 'a trailing comma before a period.', 'and a comma stranded right before a full stop is dropped with it');
  const untouched = 'reel type (verse, dhikr) leads this week, over 12 and 8 posts.';
  ok(A.critic(untouched, ev).text === untouched, 'ordinary, fully evidenced prose is never touched by the tidy-up pass');
}

console.log('\nthe compact tool JSON is cut by priority, not by a flat slice: summary numbers first, then the breakdowns, the long tail last (2026-09-24, a live run: "the data does not break down Instagram reach by reel type" because byKind sat past the truncation point)');
{
  const big = { ok: true, at: '2026-09-24T00:00:00Z', windowDays: 30,
    summary: { reach: { value: 5319 }, views: { value: 17498 } },
    trend30: { dates: Array.from({ length: 30 }, (_, i) => '2026-08-' + (i + 1)),
      networks: { instagram: Array.from({ length: 30 }, (_, i) => ({ date: 'd' + i, reach: 100 + i, views: 200 + i, posts: 1, engagement: 0.05 })) } },
    weekdayHour: Array.from({ length: 42 }, (_, i) => ({ weekday: i % 7, hour: 8 + (i % 6), instagramN: i, youtubeN: i })),
    byKind: [{ kind: 'reel:verse', label: 'verse reels', n: 12, reach: { median: 2400 } }, { kind: 'reel:dhikr', label: 'dhikr reels', n: 8, reach: { median: 1500 } }],
    bySubject: [{ group: 'surah:2', label: 'Al-Baqarah', n: 6, reach: { median: 3000 } }],
    kindDaily: Array.from({ length: 90 }, (_, i) => ({ date: 'd' + i, kind: 'reel:verse', n: 1 })),
    notes: ['Instagram carries the week.', 'Word reels lead engagement.'] };
  ok(JSON.stringify(big).length > 6000, 'the fixture itself is bigger than the whole synthesis budget, on purpose: ' + JSON.stringify(big).length);
  const compact = A.compactToolOutputs([{ name: 'observatory', data: big }]);
  ok(compact[0].json.length <= 6000, 'the compacted form still stays inside the budget: ' + compact[0].json.length);
  const parsed = JSON.parse(compact[0].json);
  ok(Array.isArray(parsed.byKind) && parsed.byKind.length, 'byKind survives, the exact field a "which kind" question needs: ' + JSON.stringify(parsed.byKind));
  ok(parsed.byKind.every(k => typeof k.n === 'number'), 'and every row it kept still carries its own sample size n');
  ok(Array.isArray(parsed.bySubject) && parsed.bySubject.length, 'bySubject survives too');
  ok(parsed.summary && parsed.summary.reach && parsed.summary.reach.value === 5319, 'the summary numbers are kept whole, first, whatever they cost');
  ok(!('kindDaily' in parsed) || JSON.stringify(parsed.kindDaily).length < JSON.stringify(big.kindDaily).length,
     'a long tail like kindDaily (90 rows, no sample size, the least useful breakdown here) is the first thing cut when the budget runs out');

  const insightsShape = { posts: 40, read: 40, unread: 0, refused: 0,
    byKind: [{ kind: 'reel:verse', label: 'verse reels', n: 12, reach: { median: 2400 }, views: { median: 7100 } },
             { kind: 'reel:dhikr', label: 'dhikr reels', n: 8, reach: { median: 1500 }, views: { median: 4000 } }],
    bySubject: [], byHour: [], byNetwork: [], byFamily: [], subjectTop: [], subjectBottom: [], top: [], sentences: [] };
  const ic = A.compactToolOutputs([{ name: 'insights', data: insightsShape }]);
  const ip = JSON.parse(ic[0].json);
  ok(Array.isArray(ip.byKind) && ip.byKind.length === 2 && ip.byKind[0].n === 12, 'api/_insights.js\'s own byKind, with its own n, survives a small run untouched');
}

console.log('\nper-person data never reaches a subagent: the router\'s own scrubber is asked a second time here');
{
  const journalLike = { entries: [{ id: 'e1', body: 'a note', nj_marker: 'nj:e:12345' }] };
  const fakeScrub = text => /\bnj:[a-z]/.test(text) ? { ok: false, reason: 'journal text is never sent to a model' } : { ok: true, text };
  const g1 = A.guardToolOutput('journal-ish', journalLike, fakeScrub);
  ok(g1.ok === false && /journal/.test(g1.reason), 'a tool output carrying a journal marker is refused before it ever reaches a message');
  const g2 = A.guardToolOutput('insights', { read: 62 }, fakeScrub);
  ok(g2.ok === true, 'an ordinary aggregate tool output passes the same check untouched');
}

console.log('\nautonomous actions: the two real ones execute and log an undo recipe, anything else is a proposal, the cap holds');
{
  /* the atomic reserve/release/record interface runAction() now uses
     (2026-09-24 review: the old read-then-append shape could race two
     calls past the cap; reserve() is the count itself, an INCR in the
     real store, so a second call can never slip in between a read and a
     write the way the old countToday()+append() pair allowed) */
  const ledgerLog = [];
  function makeLedger(startCount) {
    let count = startCount, idn = startCount;
    return {
      newId: () => 'id-' + (++idn),
      reserve: async () => { count++; return { ok: true, count }; },
      release: async () => { count--; },
      record: async e => { ledgerLog.push(e); }
    };
  }
  const emitted = [];
  const emit = (type, data) => emitted.push({ type, data });

  const toolsA = { action_refresh_insights: async () => ({ ok: true, refreshed: true }) };
  const r1 = await A.runAction({ kind: 'action', name: 'refresh-insights', args: {}, why: 'the owner asked what changed' }, { tools: toolsA, ledger: makeLedger(0), emit });
  ok(r1.kind === 'action' && r1.entry.what === 'refresh-insights' && r1.entry.who === 'lantern', 'refresh-insights runs and logs who did it and why');
  ok(r1.entry.undo && r1.entry.undo.kind === 'noop', 'a read-only refresh carries an honest no-op undo, not a fake one');

  const toolsB = { action_reconcile_teach: async () => ({ ok: true, taught: [{ reel: 'x1', day: '2026-09-01', before: null }], undo: { kind: 'reconcile-teach-revert', keys: [{ reel: 'x1', network: 'youtube', before: null }] } }) };
  const r2 = await A.runAction({ kind: 'action', name: 'reconcile-teach', args: { network: 'youtube' }, why: 'a reconciliation found an untaught reel' }, { tools: toolsB, ledger: makeLedger(1), emit });
  ok(r2.kind === 'action' && r2.entry.undo.kind === 'reconcile-teach-revert' && r2.entry.undo.keys[0].network === 'youtube',
    'reconcile-teach carries a precise, per-network undo recipe from what it actually taught');

  const emittedActions = emitted.filter(e => e.type === 'action').length;
  ok(emittedActions === 2, 'every executed action is emitted to the stream, once each: ' + emittedActions);

  const r3 = await A.runAction({ kind: 'action', name: 'lineup-change', args: { slot: 'reelD' }, why: 'reorder the afternoon reel' }, { tools: {}, ledger: makeLedger(0), emit });
  ok(r3.kind === 'proposal' && r3.proposal.description.includes('no existing, safe'), 'a lineup change is never an autonomous action, only a proposal, and says why');

  const cappedLedger = makeLedger(A.AUTONOMOUS_DAILY_CAP);
  const r4 = await A.runAction({ kind: 'action', name: 'refresh-insights', args: {}, why: 'try a sixth' }, { tools: toolsA, ledger: cappedLedger, emit });
  ok(r4.kind === 'proposal' && /daily limit/.test(r4.proposal.reason), 'a sixth action today becomes a proposal instead of running, even though it is a real action type');
  ok(ledgerLog.length === 2, 'the capped and the lineup-change attempts never touched the ledger: ' + ledgerLog.length);

  const undone = await A.undoAction(r2.entry, { action_undo_reconcile_teach: async recipe => ({ ok: true, reverted: recipe.keys.length }) });
  ok(undone.ok === true && undone.reverted === 1, 'undoAction replays a reconcile-teach recipe through the tool it is given');
  const undoneNoop = await A.undoAction(r1.entry, {});
  ok(undoneNoop.ok === true, 'undoing a no-op action succeeds and says there was nothing to reverse');
  const secondUndo = await A.undoAction({ ...r2.entry, undone: true }, { action_undo_reconcile_teach: async () => ({ ok: true, reverted: 99 }) });
  ok(secondUndo.ok === false && /already/.test(secondUndo.error), 'a second undo of an entry already marked undone is refused before it ever replays anything: ' + JSON.stringify(secondUndo));
}

console.log('\nthe daily cap fails closed: no ledger able to reserve atomically means no autonomous action runs, ever, not a silent zero');
{
  const emitted = [];
  const emit = (type, data) => emitted.push({ type, data });
  const toolsA = { action_refresh_insights: async () => ({ ok: true, refreshed: true }) };

  /* case 1: the ledger object itself has no reserve() at all (the store
     was simply never wired up for this call) */
  const r1 = await A.runAction({ kind: 'action', name: 'refresh-insights', args: {}, why: 'store not wired' }, { tools: toolsA, ledger: {}, emit });
  ok(r1.kind === 'proposal' && /ledger is not available/.test(r1.proposal.reason), 'no reserve() at all becomes a proposal, never a silent run: ' + JSON.stringify(r1.proposal.reason));

  /* case 2: reserve() exists but the store itself is down, so it truthfully
     answers ok:false rather than pretending today's count is zero */
  const downLedger = { reserve: async () => ({ ok: false, count: null }), release: async () => {}, record: async () => {}, newId: () => 'x' };
  const r2 = await A.runAction({ kind: 'action', name: 'refresh-insights', args: {}, why: 'store is down' }, { tools: toolsA, ledger: downLedger, emit });
  ok(r2.kind === 'proposal' && /could not be read/.test(r2.proposal.reason), 'a store that cannot even be read closes the door, rather than defaulting to "0 taken today": ' + JSON.stringify(r2.proposal.reason));

  /* case 3: reserve() is atomic -- a failed action releases its own slot
     back rather than leaving the count permanently one higher than what
     actually ran */
  let count = 0, released = 0;
  const toolsFail = { action_refresh_insights: async () => { throw new Error('the tool itself broke'); } };
  const countingLedger = { reserve: async () => { count++; return { ok: true, count }; }, release: async () => { released++; count--; }, record: async () => {}, newId: () => 'y' };
  const r3 = await A.runAction({ kind: 'action', name: 'refresh-insights', args: {}, why: 'will fail' }, { tools: toolsFail, ledger: countingLedger, emit });
  ok(r3.kind === 'error' && released === 1 && count === 0, 'a reserved slot is released again when the action itself throws, so a failed attempt never eats a real slot from the daily five');
}

console.log('\nthe full run: budgets, the stream\'s own order, and an honest answer when the router is silent');
{
  function makeRoute(scriptedPlan) {
    let calls = 0;
    return async ({ tier, messages }) => {
      calls++;
      if (tier === 'fast' && messages[0].content.includes('planner')) return { ok: true, content: JSON.stringify(scriptedPlan) };
      if (messages[0].content.includes('synthesiser')) return { ok: true, content: JSON.stringify({ answer: 'Reach this week was 4200.', artifacts: [] }) };
      return { ok: true, content: 'a subagent said something useful' };
    };
  }
  const tools = {
    observatory: async () => ({ data: { reach: 4200 }, summary: 'reach 4200 read.' }),
    numbers: async () => ({ data: { posts: 9 }, summary: '9 posts this week.' })
  };
  const plan = { steps: [
    { kind: 'tool', name: 'observatory', args: {}, why: 'look at the whole picture' },
    { kind: 'subagent', name: 'analyst', args: {}, why: 'find a pattern' }
  ] };
  const events = [];
  const out = await A.runAgent({ message: 'What should we post more of?', thread: [], tools, route: makeRoute(plan), emit: (t, d) => events.push(t) });
  ok(events[0] === 'plan', 'the stream opens with the plan: ' + events.join(','));
  ok(events.includes('step') && events.includes('subagent'), 'a tool step and a subagent both appear in the stream');
  ok(!events.includes('done'), 'runAgent itself never emits done: that is the HTTP layer\'s own signal that the stream is closing, and runAgent is also called outside any stream at all');
  ok(/4200|4,200/.test(out.answer), 'the synthesised answer, grounded in a number the tools actually gave, comes through: ' + out.answer);
  /* "what should" adds strategist too, since the model's own plan named
     analyst but forgot the reader that turns a reading into a
     recommendation (ensurePlanCoverage, 2026-09-24): plan + analyst +
     strategist + synthesis = 4 model calls, one more than this plan alone */
  ok(out.plan.some(s => s.kind === 'subagent' && s.name === 'strategist'), 'coverage adds strategist for a "what should" question the model\'s own plan forgot it for: ' + JSON.stringify(out.plan));
  ok(out.toolCalls === 1 && out.modelCalls === 4, 'exactly the calls this topped-up plan needed were spent: plan + analyst + strategist + synthesis = 4 model calls, ' + out.modelCalls + ' spent');
}

console.log('\nartifacts and gists never skip the critic: a malformed or invented one is dropped with a note, a real one keeps its own numbers');
{
  /* the same shape the refuter's own e2e.mjs hands the synthesiser: a
     real chart, a table with a non-array row, and a model-invented
     "proposal" artifact (only a real action step may ever build one) */
  const badSynthesis = {
    answer: 'Instagram carries the week at 14,000, the number this run actually read.',
    artifacts: [
      { type: 'chart', spec: { kind: 'bars', title: 'Reach by network', rows: [{ label: 'Instagram', n: 18, v: 14000 }] } },
      { type: 'table', title: 'Bad rows', headers: ['a'], rows: ['not-an-array-row', ['a real row']] },
      { type: 'proposal', description: 'Model-made proposal', change: 'delete everything' }
    ]
  };
  const route = async ({ messages }) => {
    if (/planner/.test(messages[0].content)) return { ok: true, content: JSON.stringify({ steps: [{ kind: 'tool', name: 'observatory', args: {}, why: 'read it' }] }) };
    if (/synthesiser/.test(messages[0].content)) return { ok: true, content: JSON.stringify(badSynthesis) };
    return { ok: true, content: 'fine' };
  };
  const tools = { observatory: async () => ({ data: { reach: 14000 }, summary: 'reach 14000 read.' }) };
  const out = await A.runAgent({ message: 'How did Instagram do?', thread: [], tools, route });
  ok(/14,000|14000/.test(out.answer), 'the real, evidenced answer survives: ' + out.answer);
  ok(out.artifacts.length === 2, 'the real chart and the real table survive: ' + JSON.stringify(out.artifacts.map(a => a.type)));
  ok(!out.artifacts.some(a => a.type === 'proposal'), 'a model-invented "proposal" artifact never survives to the console; a real proposal only ever comes from an action step');
  const chart = out.artifacts.find(a => a.type === 'chart');
  ok(chart && chart.spec.rows.length === 1 && chart.spec.rows[0].v === 14000, 'the chart keeps the number this run actually read');
  const table = out.artifacts.find(a => a.type === 'table');
  ok(table && table.rows.length === 1 && !table.rows.some(r => !Array.isArray(r)), 'the table\'s own non-array row is dropped without corrupting the row that was real (console2.mjs\'s dt() only ever meets an array here)');
  ok(out.notCompleted.some(x => /artifact was dropped/.test(x) && /proposal/.test(x)), 'the drop of the model-invented proposal is logged so the owner can see it: ' + JSON.stringify(out.notCompleted));
}

console.log('\nthe wall clock budget: a run out of time answers with what it has and says so');
{
  let t = 0;
  const clock = () => t;
  const slowTool = async () => { t += A.BUDGETS.maxWallMs + 1000; return { data: {}, summary: 'this alone used the whole budget' }; };
  const plan = { steps: [
    { kind: 'tool', name: 'observatory', args: {}, why: 'a slow read' },
    { kind: 'tool', name: 'numbers', args: {}, why: 'never gets here' }
  ] };
  const out = await A.runAgent({ message: 'plan me something', thread: [], tools: { observatory: slowTool, numbers: async () => ({ data: {}, summary: 'x' }) },
    route: async ({ messages }) => (messages[0].content.includes('planner') ? { ok: true, content: JSON.stringify(plan) } : { ok: false, error: 'no time left either' }), clock });
  ok(out.notCompleted.some(x => /out of time/.test(x)), 'the second step is marked out of time rather than silently skipped: ' + JSON.stringify(out.notCompleted));
  ok(out.exhausted === true, 'the run reports that it was exhausted');
}

console.log('\nthe model-call budget: by construction plan(1) + up to 8 subagent steps + synthesis(1) never exceeds it');
{
  ok(A.BUDGETS.maxModelCalls >= A.BUDGETS.maxSteps + 2,
    'the model-call budget always has room for a plan call, every step the step budget allows, and a synthesis call: '
    + A.BUDGETS.maxModelCalls + ' >= ' + A.BUDGETS.maxSteps + ' + 2');
}
console.log('the model-call budget really is enforced when it binds (checked with the budget lowered for this one case)');
{
  const savedCap = A.BUDGETS.maxModelCalls;
  A.BUDGETS.maxModelCalls = 3;                      /* plan(1) + one subagent(2) leaves none for a second */
  let calls = 0;
  const route = async ({ messages }) => {
    calls++;
    if (messages[0].content.includes('planner')) {
      const steps = Array.from({ length: 5 }, (_, i) => ({ kind: 'subagent', name: 'analyst', args: {}, why: 'q' + i }));
      return { ok: true, content: JSON.stringify({ steps }) };
    }
    return { ok: true, content: 'fine' };
  };
  const out = await A.runAgent({ message: 'ask a lot', thread: [], tools: {}, route });
  A.BUDGETS.maxModelCalls = savedCap;
  ok(calls <= 3, 'never more than the lowered budget of 3 route() calls were made: ' + calls);
  ok(out.notCompleted.some(x => /out of model calls/.test(x)), 'the steps that could not run say why: ' + JSON.stringify(out.notCompleted));
  ok(out.exhausted === true, 'the run reports that it was exhausted');
}

console.log('\nthread memory: the last 12 turns pass through, anything older is folded into one line');
{
  const short = Array.from({ length: 5 }, (_, i) => ({ role: 'user', content: 'q' + i }));
  ok(A.summariseThread(short).recent.length === 5 && A.summariseThread(short).summary === '', 'a short thread needs no summary at all');
  const long = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'turn ' + i }));
  const s = A.summariseThread(long);
  ok(s.recent.length === 12, 'exactly the last 12 turns pass through verbatim');
  ok(s.summary.includes('turn 0'), 'the folded summary still names what was asked earlier: ' + s.summary);
}

console.log('\nand it really reaches the planner and the synthesiser, not just summariseThread() in isolation (2026-09-24: `recent` used to be computed and then never handed to anything)');
{
  const thread = [
    { role: 'user', content: 'What should we post more of?' },
    { role: 'assistant', content: 'Word reels lead engagement this week, over 11 posts.' }
  ];
  const seenPlanner = [], seenSynth = [];
  const route = async ({ messages }) => {
    const sys = messages.map(m => m.content).join(' | ');
    if (/planner/.test(messages[0].content)) { seenPlanner.push(sys); return { ok: true, content: JSON.stringify({ steps: [] }) }; }
    if (/synthesiser/.test(messages[0].content)) { seenSynth.push(sys); return { ok: true, content: JSON.stringify({ answer: 'Word reels again, the same pattern as before.', artifacts: [] }) }; }
    return { ok: true, content: 'fine' };
  };
  const out = await A.runAgent({ message: 'And which slot works best for them?', thread, tools: {}, route });
  ok(seenPlanner.some(s2 => /Word reels lead engagement/.test(s2)), 'the planner is handed the previous turn, so a follow-up question can be read in its own context');
  ok(seenSynth.some(s2 => /Word reels lead engagement/.test(s2)), 'so is the synthesiser, which is what actually writes the answer');
  ok(/Word reels/.test(out.answer), 'and the answer itself can lean on what the thread already said: ' + out.answer);
}

/* ===========================================================================
   PART B · api/lantern-agent.js, the HTTP wiring, store stubbed
=========================================================================== */
console.log('\n--- api/lantern-agent.js, owner-gated, SSE, store stubbed ---');

process.env.ADMIN_SECRET = 'test-secret-lantern-agent';
delete process.env.OPENROUTER_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.GEMINI_API_KEY;
process.env.KV_REST_API_URL = 'https://kv.lantern-agent.test';
process.env.KV_REST_API_TOKEN = 't';

/* a small, real in-memory Redis, spoken the way Upstash's REST pipeline
   speaks it, wide enough for the ledger (INCR, EXPIRE), the proposal and
   thread lists (LPUSH/LTRIM/LRANGE/RPUSH/DEL) and the hash the duplicate
   guard's own undo writes to (HSET/HDEL/HGETALL) */
const strings = new Map(), lists = new Map(), hashes = new Map();
function pipeline(cmds) {
  return cmds.map(c => {
    const [op, ...a] = c;
    if (op === 'GET') return { result: strings.has(a[0]) ? strings.get(a[0]) : null };
    if (op === 'SET') { strings.set(a[0], a[1]); return { result: 'OK' }; }
    if (op === 'MGET') return { result: a.map(k => strings.has(k) ? strings.get(k) : null) };
    if (op === 'DEL') { strings.delete(a[0]); lists.delete(a[0]); hashes.delete(a[0]); return { result: 1 }; }
    if (op === 'INCR') { const n = (parseInt(strings.get(a[0]) || '0', 10) || 0) + 1; strings.set(a[0], String(n)); return { result: n }; }
    /* DECR and LSET (2026-09-24: missing before, so the daily cap's own
       release() and the ledger's own mark-undone-in-place both silently
       did nothing against this store, which is not what the real one
       does -- both are real Upstash pipeline commands and both are used
       by api/lantern-agent.js's makeLedger() and ledgerMarkUndone()) */
    if (op === 'DECR') { const n = (parseInt(strings.get(a[0]) || '0', 10) || 0) - 1; strings.set(a[0], String(n)); return { result: n }; }
    if (op === 'EXPIRE') return { result: 1 };
    if (op === 'LPUSH') { const l = lists.get(a[0]) || []; l.unshift(...a.slice(1)); lists.set(a[0], l); return { result: l.length }; }
    if (op === 'RPUSH') { const l = lists.get(a[0]) || []; l.push(...a.slice(1)); lists.set(a[0], l); return { result: l.length }; }
    if (op === 'LTRIM') { const l = lists.get(a[0]) || []; lists.set(a[0], l.slice(parseInt(a[1], 10), parseInt(a[2], 10) + 1)); return { result: 'OK' }; }
    if (op === 'LRANGE') { const l = lists.get(a[0]) || []; return { result: l.slice(parseInt(a[1], 10), parseInt(a[2], 10) + 1) }; }
    if (op === 'LSET') { const l = lists.get(a[0]) || []; const i = parseInt(a[1], 10); if (i >= 0 && i < l.length) l[i] = a[2]; return { result: 'OK' }; }
    if (op === 'HSET') { const h = hashes.get(a[0]) || new Map(); for (let i = 1; i + 1 < a.length; i += 2) h.set(a[i], a[i + 1]); hashes.set(a[0], h); return { result: 1 }; }
    if (op === 'HDEL') { const h = hashes.get(a[0]); if (h) h.delete(a[1]); return { result: 1 }; }
    if (op === 'HGET') { const h = hashes.get(a[0]); return { result: h && h.has(a[1]) ? h.get(a[1]) : null }; }
    if (op === 'HGETALL') { const h = hashes.get(a[0]); const flat = []; if (h) for (const [k, v] of h) flat.push(k, v); return { result: flat }; }
    if (op === 'KEYS') { const prefix = String(a[0] || '').replace(/\*$/, ''); return { result: [...strings.keys()].filter(k => k.startsWith(prefix)) }; }
    return { result: null };
  });
}
globalThis.fetch = async (url, opt) => {
  const u = String(url);
  if (u.startsWith('https://kv.lantern-agent.test')) {
    const body = JSON.parse(opt.body);
    return { ok: true, status: 200, json: async () => pipeline(body) };
  }
  throw new Error('unexpected network call in a test that promises none: ' + u);
};

const LA = await import('../api/lantern-agent.js');

function fakeRes() {
  const headers = {};
  return {
    statusCode: 0, body: null, chunks: [], ended: false,
    setHeader(k, v) { headers[k] = v; }, headers,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    write(s) { this.chunks.push(s); return true; },
    end() { this.ended = true; },
    flushHeaders() {}
  };
}
function cookieFor(secret) {
  const exp = Date.now() + 100000;
  const sig = crypto.createHmac('sha256', secret).update(String(exp)).digest('hex');
  return 'noor_admin=' + exp + '.' + sig;
}

console.log('no internal id ever reaches a model or the answer: humanizeIds (2026-09-24, a live run: "generic reels (reel:reel) were posted", the raw internal id read straight out of the tool\'s own JSON)');
{
  const REEL_ID_RX = /\breel:\w+/;
  const SLOT_ID_RX = /\b(reelA|reelB|reelC|reelD|reelE|reelF)\b/;
  const shaped = {
    byKind: [{ kind: 'reel:verse', label: 'verse reels', thisWeek: { posts: 3 } }, { kind: 'reel:reel', label: 'x', thisWeek: { posts: 1 } }],
    kindDaily: { 'reel:word': [{ date: '2026-09-24', posts: 1 }], 'reel:reel': [{ date: '2026-09-24', posts: 1 }] },
    kindTotals: [{ kind: 'reel:name', label: 'x', n: 2 }],
    bySlot: [{ slot: 'reelA', hour: 8, label: '08:00' }, { slot: 'dawn', hour: 5, label: '05:00' }],
    best: { kind: 'reel:verse', label: 'x' },
    nested: { deeper: [{ kind: 'card:light', slot: 'reelE' }] },
    untouched: { network: 'instagram', note: 'a plain sentence, left exactly as it was' }
  };
  const clean = LA.humanizeIds(shaped);
  const flat = JSON.stringify(clean);
  ok(!REEL_ID_RX.test(flat), 'no raw "reel:kind" id survives anywhere in the walked JSON: ' + flat);
  ok(!SLOT_ID_RX.test(flat), 'no raw slot id survives either: ' + flat);
  ok(clean.byKind[0].kind === 'verse reels' && clean.byKind[1].kind === 'reels whose kind could not be matched',
    'a kind id becomes its own human label, the catch-all included: ' + JSON.stringify(clean.byKind));
  ok(Object.keys(clean.kindDaily).includes('word reels') && !('reel:word' in clean.kindDaily),
    'an object KEY shaped like a kind id is renamed the same way a value is: ' + Object.keys(clean.kindDaily).join());
  ok(clean.bySlot[0].slot === 'morning reel' && clean.bySlot[1].slot === 'morning card',
    'a slot id becomes the owner\'s own word for it: ' + JSON.stringify(clean.bySlot));
  ok(clean.nested.deeper[0].kind === 'day\'s cards' && clean.nested.deeper[0].slot === 'night reel',
    'the walk reaches an array nested inside an object, not only the top level: ' + JSON.stringify(clean.nested));
  ok(clean.untouched.network === 'instagram' && clean.untouched.note === 'a plain sentence, left exactly as it was',
    'ordinary text and known network names are left alone, nothing over-corrected');
  ok(Array.isArray(LA.humanizeIds(['reel:verse', 'reelA', 'plain text'])) &&
     JSON.stringify(LA.humanizeIds(['reel:verse', 'reelA', 'plain text'])) === JSON.stringify(['verse reels', 'morning reel', 'plain text']),
    'a bare array of strings is walked the same way as an array of objects');
}

console.log('the owner gate: no secret, no cookie, the right cookie');
{
  const saved = process.env.ADMIN_SECRET;
  delete process.env.ADMIN_SECRET;
  const r1 = fakeRes();
  await LA.default({ method: 'POST', query: {}, headers: {}, body: { message: 'hi' } }, r1);
  ok(r1.statusCode === 501, 'no ADMIN_SECRET at all answers 501');
  process.env.ADMIN_SECRET = saved;

  const r2 = fakeRes();
  await LA.default({ method: 'POST', query: {}, headers: {}, body: { message: 'hi' } }, r2);
  ok(r2.statusCode === 401, 'a secret is set but no cookie rides with the request: locked');
}

function parseSSE(chunks) {
  const text = chunks.join('');
  const events = [];
  for (const block of text.split('\n\n')) {
    if (!block.trim()) continue;
    const m = /event: (\S+)\ndata: ([\s\S]*)/.exec(block);
    if (!m) continue;
    let data = null; try { data = JSON.parse(m[2]); } catch { }
    events.push({ type: m[1], data });
  }
  return events;
}

console.log('\nasking a question: the SSE stream is in order and every event parses');
{
  const res = fakeRes();
  await LA.default({ method: 'POST', query: {}, headers: { cookie: cookieFor(process.env.ADMIN_SECRET) },
    body: { message: 'What should we post more of?', thread: 'thread-1' } }, res);
  ok(res.statusCode === 200, 'the stream opens with 200');
  ok(String(res.headers['Content-Type']).includes('text/event-stream'), 'the content type is text/event-stream');
  ok(res.ended === true, 'the response is closed once the run finishes');
  const events = parseSSE(res.chunks);
  const order = events.map(e => e.type);
  ok(order[0] === 'start' && order.includes('plan') && order[order.length - 1] === 'done', 'start, then a plan, and done at the close: ' + order.join(','));
  ok(events.every(e => e.data !== null), 'every event\'s data is valid JSON');
  const done = events.find(e => e.type === 'done');
  ok(done.data.thread === 'thread-1', 'the console\'s own thread id is carried back on done');
}

console.log('\nthe ledger door and an undo that really reverses a taught entry');
{
  hashes.set('nsoc:reels:postedch', new Map([['film-9|youtube', '2026-09-05#']]));
  const entry = {
    id: 'undo-test-1', who: 'lantern', what: 'reconcile-teach', args: { network: 'youtube' }, why: 'test',
    before: null, at: new Date().toISOString(), ok: true,
    undo: { kind: 'reconcile-teach-revert', keys: [{ reel: 'film-9', network: 'youtube', before: '2026-08-01' }] }
  };
  strings.set('nlan:actions', JSON.stringify([JSON.stringify(entry)]));
  lists.set('nlan:actions', [JSON.stringify(entry)]);

  const resU = fakeRes();
  await LA.default({ method: 'POST', query: {}, headers: { cookie: cookieFor(process.env.ADMIN_SECRET) }, body: { action: 'undo', id: 'undo-test-1' } }, resU);
  ok(resU.body && resU.body.ok === true, 'undo answers ok: ' + JSON.stringify(resU.body));
  const h = hashes.get('nsoc:reels:postedch');
  ok(h && h.get('film-9|youtube') === '2026-08-01', 'the guard\'s own field was put back to exactly what it held before, ' + (h && h.get('film-9|youtube')));

  const resL = fakeRes();
  await LA.default({ method: 'GET', query: { action: 'ledger' }, headers: { cookie: cookieFor(process.env.ADMIN_SECRET) } }, resL);
  ok(resL.body.ok === true && Array.isArray(resL.body.items) && resL.body.items.length >= 1, 'the ledger door lists what has been logged');
  ok(resL.body.cap === A.AUTONOMOUS_DAILY_CAP, 'the ledger answer names the same daily cap the orchestrator enforces');
  const undoneItem = resL.body.items.find(x => x.id === 'undo-test-1');
  ok(undoneItem && undoneItem.undone === true, 'the entry itself is marked undone in the store, through a real LSET, not just answered ok in the moment: ' + JSON.stringify(undoneItem));

  /* the exact same door, asked a second time: refused before it ever
     touches teachGuard's own hash again */
  const resU2 = fakeRes();
  await LA.default({ method: 'POST', query: {}, headers: { cookie: cookieFor(process.env.ADMIN_SECRET) }, body: { action: 'undo', id: 'undo-test-1' } }, resU2);
  ok(resU2.body && resU2.body.ok === false, 'a second undo of the same entry is refused: ' + JSON.stringify(resU2.body));
  ok(hashes.get('nsoc:reels:postedch').get('film-9|youtube') === '2026-08-01', 'and the guard\'s own field is untouched by the refused second attempt');
}

console.log('\nthe proposal door: approve and decline');
{
  const p = { id: 'prop-1', type: 'lineup-change', requested: 'lineup-change', args: { slot: 'reelD' }, why: 'test', reason: 'no mechanism', description: 'a lineup change', at: new Date().toISOString() };
  lists.set('nlan:proposals', [JSON.stringify(p)]);

  const resGet = fakeRes();
  await LA.default({ method: 'GET', query: { action: 'proposals' }, headers: { cookie: cookieFor(process.env.ADMIN_SECRET) } }, resGet);
  ok(resGet.body.items.length === 1, 'the open proposal is listed');

  const resApprove = fakeRes();
  await LA.default({ method: 'POST', query: {}, headers: { cookie: cookieFor(process.env.ADMIN_SECRET) }, body: { action: 'approve', id: 'prop-1' } }, resApprove);
  ok(resApprove.body.ok === true && resApprove.body.executed === false,
    'approving a lineup-change records the decision only, since no safe endpoint exists to run it: ' + JSON.stringify(resApprove.body));

  const p2 = { id: 'prop-2', type: 'lineup-change', requested: 'lineup-change', args: {}, why: '', reason: '', description: 'another', at: new Date().toISOString() };
  lists.set('nlan:proposals', [JSON.stringify(p2)]);
  const resDecline = fakeRes();
  await LA.default({ method: 'POST', query: {}, headers: { cookie: cookieFor(process.env.ADMIN_SECRET) }, body: { action: 'decline', id: 'prop-2' } }, resDecline);
  ok(resDecline.body.ok === true, 'declining a proposal is a plain ok');
  ok((lists.get('nlan:proposals') || []).length === 0, 'a declined proposal is removed from the open list');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
