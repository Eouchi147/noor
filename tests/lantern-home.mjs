/* NOOR · the Lantern's Home: one entity, one record, one place to decide.
   ---------------------------------------------------------------------------
   LANTERN.md (3 October 2026), sections 2 to 5, against the real modules
   (api/soul.js, api/_home.js, api/_decisions.js, api/_hands.js, api/_mind.js,
   api/lantern-agent.js, api/_agent.js) over the in-memory store, the router
   stub and the stood-in network of tests/_soul-harness.mjs. Proves:
     the Home's shape is LANTERN.md section 2's, field by field, after a
       stubbed daily cycle, from caches and the store only, in well under ten
       seconds, with no model asked;
     each part fails soft on its own (null, with its reason in `missing`), a
       hung reader included;
     decisions: one card a key, twelve open at most, Later hides three days,
       No is remembered thirty, a decided need stays quiet seven, the archive
       keeps thirty days, a need gone closes its own card;
     each option does exactly what it names: a hand with the owner's
       approval, an upgrade accepted or declined, done, open (nothing at all
       on the server), snooze, no, a vague yes recorded;
     the owner's approval stands in for the council and for nothing else: a
       red line still refuses, pause still holds, the caps still bind, and the
       audit names him;
     the brief: facts first, a paragraph kept only when every number in it is
       one of the facts', the template otherwise;
     the queue: tomorrow's intents wait, meet the council again on their day,
       can be run now or skipped, and a skip reaches the planner and holds;
     ideas: go, later and never for the Lantern's own, a build and the
       owner's own;
     the conversation: its proposal is a decision whose Yes runs the hand, its
       autonomous actions and its orders run through the hands with the
       council and land in the one ledger, and its answer says what was done;
     every string the owner reads says the Lantern, never the soul.

   Run:  node tests/lantern-home.mjs
*/
import {
  S, L, FAULT, LOG, resetStore, SOUL, HANDS, MIND, EVOLVE, LINEUP, ROUTER, DEPS, OBS, NOTIFY,
  APPROVED, AUTH, door, fakeRes, addDays, setDay, today, MANIFEST
} from './_soul-harness.mjs';

const HOME = await import('../api/_home.js');
const DEC = await import('../api/_decisions.js');
const AGENT = await import('../api/_agent.js');
const LA = await import('../api/lantern-agent.js');
const VOICE = await import('../api/_voice.js');   /* round four: the evening digest */

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const D0 = '2026-10-07';          /* a Wednesday */
const D1 = addDays(D0, 1);
const post = body => door({ method: 'POST', headers: AUTH, body });
const home = async () => (await door({ query: { view: 'home' }, headers: AUTH })).body;
async function lan(req) { const r = fakeRes(); r.write = () => true; r.flushHeaders = () => {}; await LA.default({ method: 'GET', query: {}, headers: AUTH, ...req }, r); return r; }
const roles = () => ROUTER.calls.map(c => c.role);
const councilAsked = since => ROUTER.calls.slice(since).some(c => c.role === 'guardian' || c.role === 'skeptic');
async function freeVerse(date, slot) {
  const picks = await LINEUP.otherPicksFor(MANIFEST, date, slot, null, new Map(), null, { records: {} });
  const taken = new Set(Object.values(picks));
  return MANIFEST.filter(c => c.kind === 'verse' && !taken.has(c.id)).map(c => c.id);
}
const quietExp = (start) => S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: start || addDays(today(), -2), args: {} }, history: [] }));
const slot = (d, s, state, extra) => S.set('nsoc:slot:' + d + '#' + s, JSON.stringify({ state, results: {}, at: d + 'T08:00:00Z', ...(extra || {}) }));
/* the owner reads these; none may say soul */
const SAID = [];
const keep = r => { if (r && typeof r === 'object') { for (const k of ['message', 'error', 'note', 'said']) if (typeof r[k] === 'string') SAID.push(r[k]); } return r; };

/* the Steward, stood in: its owner-only findings (a token near expiry, two
   inbox messages, one journal reply) and a failed slot for the evidence */
const FOLD = { inbox: 2, journal: 1, trouble: [] };
DEPS.stewardFold = async () => ({ at: new Date(Date.parse(today() + 'T05:20:00Z')).toISOString(), inbox: FOLD.inbox, journal: FOLD.journal, trouble: FOLD.trouble,
  findings: [
    { id: 'token-ig', level: 'act', title: 'The Instagram token has 5 days left', say: 'It was marked renewed on 2026-08-13 and a Meta token lives 60 days. When it dies every post to Instagram fails with no warning.', evidence: { network: 'Instagram', daysLeft: 5 } },
    { id: 'slots-failed', level: 'act', title: '1 of today\'s posts reached no network', say: 'The 14:00 slot was refused by every live network.' },
    { id: 'readers', level: 'good', title: 'Readers today: 12', say: '12 readers have been on the site so far today.' }
  ].filter(f => FOLD.token !== false || f.id !== 'token-ig') });

/* ===========================================================================
   1. THE HOME, FIELD BY FIELD, AFTER A STUBBED CYCLE
=========================================================================== */
console.log('\n1. the Home answers LANTERN.md section 2, field by field');
let CYCLE1, H1;
{
  resetStore(); setDay(D0, '05:20'); quietExp('2026-10-05'); ROUTER.calls.length = 0;
  ROUTER.guardian = 'smart'; ROUTER.skeptic = 'approve';
  ROUTER.plan = JSON.stringify({ intents: [
    { action: 'insights-refresh', args: {}, why: 'The numbers the plan reads are a day old.', expectedEffect: 'fresh numbers', metric: 'northStar' },
    { action: 'note', args: { text: 'Verse reels lead the week.' }, why: 'worth remembering', metric: '' },
    /* the smart Guardian refuses anything about a face: blocked, for Next */
    { action: 'lineup-skip', args: { date: D1, slot: 'reelD' }, why: 'The afternoon reel showed a face, and reached a median of 640.', metric: 'northStar' },
    /* dated tomorrow: into the queue */
    { action: 'insights-refresh', args: { why: 'again' }, why: 'Read the numbers again tomorrow, after the weekend posts settle.', metric: 'northStar', when: 'tomorrow' }
  ] });
  slot(addDays(D0, -1), 'reelA', 'sent'); slot(addDays(D0, -1), 'reelC', 'sent'); slot(addDays(D0, -1), 'reelD', 'failed');
  slot(D0, 'dawn', 'sent');
  const t = await MIND.tick({});
  CYCLE1 = t.id;
  ok(t.status === 'done', 'the daily cycle of ' + D0 + ' ran to its end: ' + t.status);
  await HOME.addIdeas([{ title: 'A Friday verse series', why: 'Verse reels lead the week.', impact: 'more people on Fridays', who: 'lantern', metric: 'northStar' }], 'test');
  await DEC.upsert(DEC.fromUpgrade({ id: 'u-test-1', title: 'Read Telegram reach', why: 'Telegram has no reading.', spec: 'A reader for the channel.', metric: 'northStar', expectedEffect: 'a fuller north star' }, () => 'g-reach'));
  await DEC.upsert({ ...DEC.fromReport({ verdict: { id: 'verse-length', start: '2026-09-01', verdict: 'A', sentence: 'Shorter verses held people longer over 12 posts each.' } })[0], source: 'cycle' });
  const before = ROUTER.calls.length;
  const t0 = Date.now();
  const r = await door({ query: { view: 'home' }, headers: AUTH });
  const ms = Date.now() - t0;
  H1 = r.body;
  const h = H1;
  ok(r.statusCode === 200 && h.ok === true, 'GET ?view=home answers 200 ok');
  ok(ms < 10000 && ROUTER.calls.length === before, 'in ' + ms + ' ms, well under ten seconds, and no model was asked');
  /* 3 October 2026: and `giving` (LANTERN.md section 10) */
  /* mail: 6 October 2026, and `mail` (LANTERN.md section 11.4; tests/mail.mjs holds the rest) */
  const TOP = ['ok', 'now', 'name', 'paused', 'status', 'brief', 'decisions', 'done', 'next', 'coming', 'goals', 'ideas', 'today', 'voice', 'spend', 'giving', 'mail'];
  ok(TOP.every(k => Object.prototype.hasOwnProperty.call(h, k)) && Object.keys(h).filter(k => !TOP.includes(k)).join() === 'missing', 'the top level is the contract\'s, plus the one documented `missing`: ' + Object.keys(h).join(','));
  ok(h.name === 'the Lantern' && h.paused === false && h.status === 'needs-you' && Object.keys(h.missing).join() === 'giving' && h.giving === null && /not configured/.test(h.missing.giving),
    'the Lantern, not paused, needs you; nothing missing but the gifts, which this deployment has no Stripe key to read: ' + h.missing.giving);
  const keys = o => Object.keys(o || {}).sort().join();
  const same = (o, list) => keys(o) === list.slice().sort().join();
  ok(same(h.brief, ['date', 'text', 'numbers', 'at', 'cycle']) && h.brief.date === D0 && h.brief.cycle === CYCLE1, 'brief: {date, text, numbers, at, cycle}, this morning\'s');
  ok(h.brief.numbers.length === 3 && h.brief.numbers.every(n => same(n, ['key', 'label', 'value', 'unit', 'delta', 'deltaUnit', 'series']) && n.series.length === 14) && h.brief.numbers.map(n => n.key).join() === 'reach,visitors,watched',
    'brief.numbers: reach, visitors, watched, each {key, label, value, unit, delta, deltaUnit, series} with 14 days in its series');
  ok(h.brief.numbers[0].value === 19000 && h.brief.numbers[0].unit === 'people' && h.brief.numbers[2].value === 40 && h.brief.numbers[2].unit === 'percent' && h.brief.numbers[2].deltaUnit === 'points',
    'with the snapshot\'s own numbers: 19000 people, 40 percent watched');
  /* draft: LANTERN.md section 10 (a letter, section 8), null on every card that carries none; tests/mission.mjs holds the rest */
  /* mail: and `letter` (an email waiting for his Send, section 11.4), null here */
  const DECISION = ['id', 'kind', 'title', 'why', 'goal', 'impact', 'options', 'link', 'steps', 'at', 'expires', 'draft', 'letter'];
  ok(h.decisions.length >= 6 && h.decisions.every(d => same(d, DECISION) && d.draft === null && d.letter === null), 'decisions: ' + h.decisions.length + ' cards, each exactly {' + DECISION.join(', ') + '}, no letter on any');
  ok(h.decisions.every(d => d.options.length && d.options.every(o => same(o, ['id', 'label', 'style', 'confirm']) && ['primary', 'plain', 'danger'].includes(o.style))), 'every option is {id, label, style, confirm}, its style the contract\'s');
  ok(h.decisions.every(d => (d.link === null || same(d.link, ['href', 'label'])) && Array.isArray(d.steps) && d.steps.every(s => typeof s === 'string')), 'every link is null or {href, label}; steps are strings');
  const kinds = new Set(h.decisions.map(d => d.kind));
  ok(['build', 'choose', 'you'].every(k => kinds.has(k)), 'the kinds the cycle raises: ' + [...kinds].join(', '));
  ok(h.decisions[0].kind === 'choose' || h.decisions[0].kind === 'approve', 'a question that asks a choice comes first');
  const titles = h.decisions.map(d => d.title).join(' | ');
  ok(/2 new messages in the inbox/.test(titles) && /1 journal reply/.test(titles) && /Instagram token has 5 days left/.test(titles), 'the Steward\'s owner-only findings are cards: ' + titles.slice(0, 200));
  ok(/Link Telegram/.test(titles) && /Search Console/.test(titles) && /No token for threads/.test(titles), 'and the cycle\'s needs: Telegram, Search Console, the missing Threads token');
  const inbox = h.decisions.find(d => /inbox/.test(d.title));
  ok(inbox.kind === 'you' && inbox.link.href === '/admin2#readers' && inbox.options.some(o => o.id === 'open'), 'an inbox card opens the Readers room (#readers)');
  const tok = h.decisions.find(d => /Instagram token/.test(d.title));
  ok(tok.link.href === '/admin2#posts' && tok.steps.length === 3, 'a token card opens the token clock in Posts, with its steps');
  /* mail: and `link` (a sent email's own link in Gmail, section 11.4), null here */
  const DONE = ['id', 'at', 'title', 'detail', 'goal', 'by', 'ok', 'undo', 'actionId', 'link'];
  ok(h.done.length >= 3 && h.done.every(d => same(d, DONE) && ['lantern', 'owner', 'machine'].includes(d.by) && typeof d.undo === 'boolean' && d.link === null), 'done: each {' + DONE.join(', ') + '}');
  const refresh = h.done.find(d => d.title === 'Read the networks\' numbers again');
  ok(refresh && refresh.by === 'lantern' && refresh.ok && refresh.undo === false && refresh.goal === 'g-reach' && /^act-/.test(refresh.actionId), 'the morning\'s refresh is in Done: the Lantern\'s, for g-reach, no Undo for a read of public numbers');
  const note = h.done.find(d => /^Wrote a note/.test(d.title));
  ok(note && note.undo === true, 'its note carries an Undo');
  const routine = h.done.find(d => d.by === 'machine' && /yesterday/.test(d.title));
  ok(routine && routine.title === '2 of 3 posts went out yesterday' && /1 reached no network/.test(routine.detail) && routine.ok === false && routine.goal === 'g-health', 'the routine: "' + (routine && routine.title) + '"');
  ok(!h.done.some(d => d.id === 'routine:' + D0) && h.today.posts.due >= 1, 'today\'s own count is in today.posts, not said twice in Done');
  ok(h.done.every((d, i) => i === 0 || String(h.done[i - 1].at) >= String(d.at)), 'newest first');
  const NEXT = ['id', 'title', 'why', 'goal', 'when', 'hand', 'tier', 'status', 'reason', 'canDoNow', 'canSkip'];
  ok(h.next.length === 2 && h.next.every(n => same(n, NEXT)), 'next: two steps, each {' + NEXT.join(', ') + '}');
  const blocked = h.next.find(n => n.status === 'blocked');
  ok(blocked && blocked.hand === 'lineup-skip' && blocked.when === 'today' && /council said no/.test(blocked.reason) && blocked.canDoNow && blocked.canSkip && /^i:/.test(blocked.id),
    'the skip the council refused is blocked, with the reason, and the owner may still do it now: ' + (blocked && blocked.reason));
  const queued = h.next.find(n => n.status === 'planned');
  ok(queued && queued.when === 'tomorrow' && queued.tier === 'R2' && /^q-/.test(queued.id) && /council reviews it again/.test(queued.reason), 'the intent dated tomorrow waits in the queue: ' + (queued && queued.title));
  ok(h.coming.every(c => same(c, ['date', 'title'])) && h.coming.map(c => c.date).join() === [D1, '2026-10-12', '2026-11-02'].join(),
    'coming: the next cycle tomorrow, Monday\'s scorecard, the test\'s end: ' + h.coming.map(c => c.date + ' ' + c.title).join('; '));
  const GOAL = ['id', 'owner', 'outcome', 'metric', 'unit', 'baseline', 'current', 'target', 'due', 'status', 'projected', 'eta', 'note', 'focus', 'history'];
  ok(h.goals.length === 6 && h.goals.every(g => same(g, GOAL) && Array.isArray(g.history)) && h.goals.some(g => g.id === 'g-sustain'), 'goals: five seeded and the sustain goal, each {' + GOAL.join(', ') + '}');
  const reach = h.goals.find(g => g.id === 'g-reach');
  ok(reach.unit === 'people' && reach.current === 19000 && reach.target === 38000 && ['on-track', 'behind', 'met', 'no-data'].includes(reach.status), 'g-reach: people, 19000 of 38000, ' + reach.status);
  ok(/Read the networks' numbers again/.test(reach.focus) && h.goals.find(g => g.id === 'g-search').focus === 'watching', 'each goal says what the Lantern is doing about it, else "watching": ' + reach.focus);
  ok(h.goals.find(g => g.id === 'g-test').owner === 'lantern' && h.goals.find(g => g.id === 'g-attention').unit === 'share', 'the Lantern\'s own goal says so; a share is a share');
  const fri = h.ideas.find(i => i.title === 'A Friday verse series');
  /* 6 October 2026 (the review of money): each idea also carries the steps Go will run */
  ok(fri && h.ideas.every(i => same(i, ['id', 'title', 'why', 'impact', 'who', 'status', 'at', 'steps']) && Array.isArray(i.steps)) && fri.who === 'lantern' && fri.status === 'new', 'ideas: {id, title, why, impact, who, status, at, steps}');
  /* slots: LANTERN.md section 10, the day across the horizon; tests/mission.mjs holds its fields */
  ok(same(h.today, ['posts', 'fixed', 'reach7', 'slots']) && same(h.today.posts, ['sent', 'due', 'failed']) && h.today.posts.sent === 1 && h.today.posts.due === 1 && h.today.fixed === 0 && same(h.today.reach7, ['value', 'delta']) && h.today.reach7.value === 19000 && Array.isArray(h.today.slots),
    'today: {posts {sent 1, due 1, failed 0}, fixed 0, reach7 {value 19000, delta}, slots}');
  /* round four (7 October 2026): the voice says why the link matters while it is missing, and when the evening digest goes;
     spend carries roi {calls, usd, helped}, what the month's paid calls bought */
  ok(same(h.voice, ['telegram', 'digestAt', 'digestWaiting', 'today']) && same(h.voice.telegram, ['linked', 'why']) && h.voice.telegram.linked === false
    && h.voice.telegram.why === 'so the Lantern can reach you when something is urgent' && h.voice.digestAt === '22:00 UTC'
    && same(h.spend, ['usd', 'capUsd', 'roi']) && h.spend.capUsd === 10 && same(h.spend.roi, ['calls', 'usd', 'helped']) && h.spend.roi.calls === 0,
    'voice {telegram {linked, why}, digestAt, digestWaiting, today} and spend {usd, capUsd, roi {calls, usd, helped}}');
}

/* ===========================================================================
   2. EACH PART FAILS SOFT ON ITS OWN
=========================================================================== */
console.log('\n2. each part fails soft on its own, with its reason');
{
  const cases = [['decisions', /^nsoul:decisions/], ['brief', /^nsoul:brief/], ['next', /^nsoul:queue/], ['done', /^nsoul:actions?/], ['goals', /^nsoul:goals/], ['coming', /^nsoul:cycle:daily/], ['ideas', /^nsoul:ideas/]];
  for (const [part, rx] of cases) {
    FAULT.key = rx;
    const h = await home();
    FAULT.key = null;
    const others = ['brief', 'decisions', 'done', 'next', 'coming', 'goals', 'ideas', 'today', 'voice', 'spend'].filter(p => p !== part && !(part === 'goals' && p === 'goals'));
    ok(h.ok === true && h[part] === null && typeof h.missing[part] === 'string' && h.missing[part].length > 0 && others.every(p => h[p] !== null),
      part + ' alone is null when its store key fails, the reason given ("' + String(h.missing[part]).slice(0, 60) + '"), every other part answers');
  }
  const ES = DEPS.expState;
  DEPS.expState = () => new Promise(() => {});
  const t0 = Date.now();
  const h = await home();
  const ms = Date.now() - t0;
  DEPS.expState = ES;
  ok(h.coming === null && /longer than/.test(h.missing.coming) && h.goals && h.decisions && ms < 10000, 'a reader that never answers costs its own part only, at its own clock: ' + ms + ' ms, "' + h.missing.coming + '"');
  FAULT.all = true;
  const down = await door({ query: { view: 'home' }, headers: AUTH });
  FAULT.all = false;
  ok(down.statusCode === 200 && down.body.ok === true && down.body.brief === null && down.body.decisions === null && down.body.status === 'paused' && Object.keys(down.body.missing).length >= 5,
    'a store that answers nothing: still an answer, every part null with its reason, and paused (an unreadable pause reads as paused)');
  const noRead = await door({ query: { view: 'home' }, headers: {} });
  ok(noRead.statusCode === 401, 'and the Home is the owner\'s alone');
}

/* ===========================================================================
   3. DECISIONS: ONE CARD A KEY, TWELVE OPEN, LATER, NO, QUIET, ARCHIVE
=========================================================================== */
console.log('\n3. the decisions store keeps its rules');
{
  resetStore(); setDay(D0, '10:00');
  const card = (key, title, extra) => ({ kind: 'you', key, title, why: 'a test need', options: [DEC.opt.done(), DEC.opt.later(), DEC.opt.no()], source: 'test', ...(extra || {}) });
  const a = await DEC.upsert(card('t:one', 'One thing'));
  const b = await DEC.upsert(card('t:one', 'One thing, said again', { stamp: '2' }));
  const open = await DEC.readOpen();
  ok(a.ok && b.ok && b.updated && b.id === a.id && open.length === 1 && open[0].title === 'One thing, said again', 'the same key twice is one card, updated in place');
  for (let i = 0; i < 13; i++) await DEC.upsert(card('t:many' + i, 'Need ' + i));
  const after = await DEC.readOpen();
  const arch = await DEC.readArchive();
  ok(after.length === DEC.OPEN_MAX && after.length === 12, 'twelve open at most: ' + after.length);
  ok(arch.filter(x => x.status === 'overflow').length === 2 && arch.some(x => x.key === 't:one' && x.status === 'overflow'), 'the oldest give way to the newest, archived as overflow');
  const later = after.find(d => d.key === 't:many12');
  const sn = keep(await DEC.decide(later.id, 'later'));
  ok(sn.ok && sn.until === addDays(D0, 3) && !DEC.visible(await DEC.readOpen()).some(d => d.id === later.id), 'Later hides a card: back on ' + sn.until);
  setDay(addDays(D0, 2), '10:00');
  ok(!DEC.visible(await DEC.readOpen()).some(d => d.id === later.id), 'still hidden two days on');
  setDay(addDays(D0, 3), '10:00');
  ok(DEC.visible(await DEC.readOpen()).some(d => d.id === later.id), 'and back on the third day');
  setDay(D0, '10:00');
  const no = (await DEC.readOpen()).find(d => d.key === 't:many11');
  const nr = keep(await DEC.decide(no.id, 'no'));
  const again = await DEC.upsert(card('t:many11', 'Need 11, raised again', { stamp: 'other' }));
  ok(nr.ok && /30 days/.test(nr.message) && again.suppressed === 'no', 'No closes it, and the same need is not raised again: ' + nr.message);
  const dn = (await DEC.readOpen()).find(d => d.key === 't:many10');
  keep(await DEC.decide(dn.id, 'done'));
  ok((await DEC.upsert(card('t:many10', 'Need 10'))).suppressed === 'recent', 'a need marked done is quiet while it says the same thing');
  ok((await DEC.upsert(card('t:many10', 'Need 10, changed', { stamp: 'new' }))).ok, 'and raised again when it changes');
  ok((await DEC.readArchive()).some(x => x.key === 't:many10' && x.status === 'done'), 'the decided card is in the archive');
  setDay(addDays(D0, 31), '10:00');
  ok((await DEC.upsert(card('t:many11', 'Need 11, a month on'))).ok, 'thirty one days on, a No is forgotten and the need may be raised again');
  ok(!(await DEC.readArchive()).some(x => x.key === 't:many10' && x.status === 'done'), 'and the decided card is let go after thirty days');
  ok(!(await DEC.readOpen()).some(d => d.key === 't:many1') && (await DEC.readArchive()).some(d => d.key === 't:many1' && d.status === 'expired'), 'an open card nobody answered leaves after fourteen days, archived as expired');
  setDay(D0, '10:00');
  await DEC.upsert(card('t:old', 'An old need', { expires: addDays(D0, 1) }));
  setDay(addDays(D0, 2), '10:00');
  ok(!DEC.visible(await DEC.readOpen()).some(d => d.key === 't:old'), 'a card past its own date is not shown');
  await DEC.upsert(card('t:fresh', 'A fresh need'));
  ok(!(await DEC.readOpen()).some(d => d.key === 't:old') && (await DEC.readArchive()).some(d => d.key === 't:old' && d.status === 'expired'), 'and is archived as expired at the next write');
  setDay(D0, '10:00');
  resetStore();
  await DEC.sync('steward', DEC.fromSteward({ inbox: 3, journal: 0, findings: [] }));
  ok((await DEC.readOpen()).some(d => d.key === 'inbox' && d.title === '3 new messages in the inbox'), 'the Steward raises the inbox');
  await DEC.sync('steward', DEC.fromSteward({ inbox: null, journal: 0, findings: [] }), { keep: ['inbox'] });
  ok((await DEC.readOpen()).some(d => d.key === 'inbox'), 'an inbox that could not be read never closes its card');
  await DEC.sync('steward', DEC.fromSteward({ inbox: 0, journal: 0, findings: [] }));
  ok(!(await DEC.readOpen()).some(d => d.key === 'inbox') && (await DEC.readArchive()).some(d => d.key === 'inbox' && d.status === 'resolved'), 'an inbox read empty closes it, resolved');
}

/* ===========================================================================
   4. EACH OPTION DOES WHAT IT NAMES
=========================================================================== */
console.log('\n4. every option kind does what it names, and nothing else');
{
  resetStore(); setDay(D0, '10:00'); ROUTER.calls.length = 0; ROUTER.guardian = 'approve';
  /* a hand, with the owner's approval: an R2 runs with no council at all */
  const d1 = await DEC.upsert({ kind: 'approve', key: 't:hand', title: 'Read the numbers again now?', why: 'a test', source: 'test',
    options: [DEC.opt.yes({ type: 'hand', intent: { action: 'insights-refresh', args: {}, why: 'the owner said yes', metric: 'northStar' } }), DEC.opt.no()] });
  const calls = ROUTER.calls.length;
  const r1 = keep((await post({ action: 'decide', id: d1.id, option: 'yes' })).body);
  const act = (await SOUL.actionsList()).find(a => a.id === r1.actionId);
  ok(r1.ok && r1.executed && /^Done/.test(r1.message) && act && act.hand === 'insights-refresh', 'POST decide yes runs the hand: ' + r1.message);
  ok(!councilAsked(calls), 'and no reviewer was asked: the owner\'s yes is the council\'s vote');
  ok(act.approval && act.approval.owner === true && act.approval.source === 'decision' && act.approval.id === d1.id && act.approvedBy === 'owner' && act.actor === 'owner', 'the action records his approval: decision ' + d1.id);
  const audit = await SOUL.auditAll();
  ok(audit.some(e => e.kind === 'act' && /approved by the owner \(decision /.test(e.summary) && e.data.approval && e.data.approval.owner), 'and the audit names it: ' + (audit.find(e => e.kind === 'act') || {}).summary);
  ok((await DEC.readArchive()).some(a => a.id === d1.id && a.status === 'yes' && a.actionId === r1.actionId), 'the card is archived yes, with the action\'s id');
  const twice = keep((await post({ action: 'decide', id: d1.id, option: 'yes' })).body);
  ok(!twice.ok && /already answered/.test(twice.message), 'a second tap answers plainly that it was already answered');
  /* an upgrade accepted, another declined */
  const up1 = (await EVOLVE.addUpgrade({ title: 'Read Telegram reach', why: 'w', spec: 's', metric: 'northStar' })).upgrade;
  const up2 = (await EVOLVE.addUpgrade({ title: 'A second build', why: 'w', spec: 's', metric: 'northStar' })).upgrade;
  const b1 = await DEC.upsert(DEC.fromUpgrade(up1, () => 'g-reach'));
  const b2 = await DEC.upsert(DEC.fromUpgrade(up2, () => 'g-reach'));
  const rb1 = keep(await DEC.decide(b1.id, 'build'));
  const rb2 = keep(await DEC.decide(b2.id, 'no'));
  const ups = await EVOLVE.listUpgrades();
  ok(rb1.ok && ups.find(u => u.id === up1.id).status === 'accepted', 'Build it accepts the upgrade: ' + rb1.message);
  ok(rb2.ok && ups.find(u => u.id === up2.id).status === 'declined' && (await DEC.readNo())['upgrade:' + DEC.wordsKey('A second build')], 'No declines it, and remembers the No');
  /* done, record, open */
  const dd = await DEC.upsert({ kind: 'you', key: 't:done', title: 'Renew a token', why: 'w', source: 'test', options: [DEC.opt.open(), DEC.opt.done(), DEC.opt.later()], link: { href: '/admin2#posts', label: 'Open Posts' } });
  const storeBefore = JSON.stringify([...S.entries()].filter(([k]) => !k.startsWith('nsoul:once')));
  const listBefore = JSON.stringify(L.get(SOUL.K.audit) || []);
  const ro = keep(await DEC.decide(dd.id, 'open'));
  ok(ro.ok && ro.link.href === '/admin2#posts' && JSON.stringify([...S.entries()].filter(([k]) => !k.startsWith('nsoul:once'))) === storeBefore && JSON.stringify(L.get(SOUL.K.audit) || []) === listBefore,
    'Open is a link and nothing else: the store and the audit are untouched');
  /* every option that only leads somewhere is the card's one "open", so the
     console can draw it as the card's link and never post it */
  const drift = DEC.fromReport({ drift: [{ id: 'g-reach', metric: 'northStar', tellOwner: true, streak: 7, projected: 30000, target: 38000, due: '2026-12-25' }], goals: [{ id: 'g-reach', outcome: 'Double the people reached' }] })[0];
  ok(drift.options.map(o => o.id).join() === 'keep,open,later' && drift.options[1].label === 'Change the goal' && drift.link.href === '/admin2#soul',
    'a goal behind for 7 days: Keep the goal, Change the goal (its Open, to the goals), Later');
  const rd = keep(await DEC.decide(dd.id, 'done'));
  ok(rd.ok && (await DEC.readArchive()).some(a => a.id === dd.id && a.status === 'done'), 'Done archives it as done');
  const vague = await DEC.upsert(DEC.fromProposal({ id: 'p-vague', type: 'other', requested: 'lineup-change', args: { suggestion: 'more verse reels in the evening' }, why: 'the conversation suggested it' }));
  const rv = keep(await DEC.decide(vague.id, 'yes'));
  ok(rv.ok && rv.executed === false && /Recorded/.test(rv.message) && (await DEC.readArchive()).some(a => a.id === vague.id && a.status === 'approved'), 'a vague proposal\'s Yes is recorded, nothing run: ' + rv.message);
  const bad = keep(await DEC.decide(dd.id, 'nonsense'));
  ok(!bad.ok && bad.message, 'an unknown card answers plainly: ' + bad.message);
}

/* ===========================================================================
   5. THE OWNER'S APPROVAL CROSSES NO RED LINE AND LIFTS NO CAP
=========================================================================== */
console.log('\n5. the owner\'s approval stands in for the council, and for nothing else');
{
  resetStore(); setDay(D0, '10:00');
  const own = { owner: true, source: 'decision', id: 'd-test' };
  const red = await HANDS.runHand({ action: 'delete-post', args: { network: 'instagram', id: 'x' }, why: 'the owner wants it gone' }, { actor: 'owner', approval: own });
  ok(!red.ok && red.refused === 'R3', 'a red line is refused with his approval in hand: ' + red.error);
  ok((await SOUL.auditAll()).some(e => e.kind === 'refused' && /the owner approved it/.test(e.summary) && e.data.approval && e.data.approval.owner), 'and the refusal is audited, naming his approval');
  const redCard = await DEC.upsert({ kind: 'approve', key: 't:red', title: 'Hide the old reels?', why: 'tidier', source: 'test',
    options: [DEC.opt.yes({ type: 'hand', intent: { action: 'note', args: { text: 'hide the old reels from the grid' }, why: 'tidier' } }), DEC.opt.no()] });
  const rr = keep(await DEC.decide(redCard.id, 'yes'));
  ok(!rr.ok && rr.refused === 'R3' && /Refused, and closed/.test(rr.message) && (await DEC.readArchive()).some(a => a.id === redCard.id && a.status === 'refused'), 'a card whose Yes crosses a red line is refused and closed: ' + rr.message);
  const rs = [];
  for (let i = 0; i < 7; i++) rs.push(await HANDS.runHand({ action: 'insights-refresh', args: {}, why: 'the owner asked' }, { actor: 'owner', approval: { ...own, id: 'd-' + i } }));
  ok(rs.slice(0, 6).every(r => r.ok) && !rs[6].ok && rs[6].refused === 'cap', 'six public acts a day with his approval, the seventh refused by the cap: ' + rs[6].error);
  resetStore();
  const lk = [];
  for (const s of ['reelA', 'reelC', 'reelD', 'reelE']) lk.push(await HANDS.runHand({ action: 'lineup-skip', args: { date: D1, slot: s }, why: 'the owner asked' }, { actor: 'owner', approval: own }));
  ok(lk.slice(0, 3).every(r => r.ok) && !lk[3].ok && /line-up changes/.test(lk[3].error), 'three line-up changes a day with his approval, the fourth refused: ' + lk[3].error);
  ok(lk.slice(0, 3).every(r => r.entry.result.override.by === 'lantern-approved'), 'his changes are written as his (lantern-approved), never as the Lantern\'s own');
  ok(!S.has('nsoul:count:soul-skip-date:' + D1), 'the Lantern\'s own per-day skip limit is its alone, never counted against his');
  resetStore();
  await SOUL.setPaused(true, 'owner');
  const p = await HANDS.runHand({ action: 'note', args: { text: 'x' }, why: 'y' }, { actor: 'owner', approval: own });
  await SOUL.setPaused(false, 'owner');
  ok(!p.ok && p.refused === 'paused' && /Lantern is paused/.test(p.error), 'pause holds for him too: ' + p.error);
  for (const half of [{ owner: true }, { owner: true, source: 'chat', id: 'x' }, { owner: 'yes', source: 'decision', id: 'x' }]) {
    const r = await HANDS.runHand({ action: 'insights-refresh', args: {}, why: 'x' }, { approval: half });
    ok(!r.ok && r.refused === 'council', 'a half-made approval ' + JSON.stringify(half) + ' is no approval: the council is required');
  }
  ok(HANDS.OWNER_SOURCES.join() === 'decision,next,idea', 'his approval comes through three doors only: a decision, a Next step, an idea');
}

/* ===========================================================================
   6. THE BRIEF: FACTS FIRST, A PARAGRAPH HELD TO THEM
=========================================================================== */
console.log('\n6. the brief keeps to its facts');
{
  const f = { date: D0, reach: { value: 19000, weekAgo: 18650, delta: 350 }, visitors: { value: 420, weekAgo: 400, delta: 20 }, watched: { value: 40, weekAgo: 38, delta: 2 },
    posts: { date: addDays(D0, -1), sent: 9, due: 10 }, goals: { met: 1, onTrack: 2, behind: 1 }, did: ['Read the networks\' numbers again'], plans: ['Skip the morning reel tomorrow'], decisions: 2 };
  const good = 'This week the house reached 19,000 people, 350 more than the week before. Yesterday 9 of 10 posts went out, and the site had 420 visitors. The Lantern read the numbers again this morning, and 2 decisions wait for you.';
  ok(HOME.guardBrief(good, f).ok, 'a paragraph whose every number is a fact\'s is kept');
  const inv = HOME.guardBrief(good.replace('19,000', '21,000'), f);
  ok(!inv.ok && /21000/.test(inv.why), 'an invented number is refused: ' + inv.why);
  ok(HOME.guardBrief(good.replace('Yesterday 9', 'Yesterday nine'), f).ok, 'a fact\'s number may be written in words');
  ok(!HOME.guardBrief(good.replace('Yesterday 9', 'Yesterday eleven'), f).ok, 'but not a number in words the facts do not carry');
  ok(!HOME.guardBrief('The soul reached 19,000 people. It did well. It will do more.', f).ok, 'and a name the owner no longer reads');
  ok(!HOME.guardBrief('We need to write a paragraph about 19,000 people. It did well. It will do more.', f).ok && !HOME.guardBrief('Reach rose ' + String.fromCharCode(0x2014) + ' to 19,000. It did well. It will do more.', f).ok, 'and thinking aloud, and a dash');
  ok(!HOME.guardBrief('The reelA slot reached 19,000 people. It did well. It will do more.', f).ok && !HOME.guardBrief('It reached 19,000 people.', f).ok, 'and an internal id, and fewer than three sentences');
  const tpl = HOME.briefTemplate(f);
  const ss = tpl.split(/(?<=\.)\s+/);
  ok(ss.length >= 3 && ss.length <= 5 && /19,000 people, 350 more/.test(tpl) && /9 of 10 posts/.test(tpl) && /2 decisions wait for you/.test(tpl) && !/soul/i.test(tpl), 'the template: ' + ss.length + ' plain sentences, from the facts alone');
  /* through writeBrief: a model that invents is replaced by the template */
  resetStore(); setDay(D0, '10:00');
  const h0 = await home();
  ok(h0.brief === null && !('brief' in h0.missing), 'before any cycle wrote one, the brief is null with no reason: the Home\'s empty state, not a failure');
  const rec = { id: D0 + '-daily', date: D0, snapshot: { northStar: 19000, site: { visitors7: 420 }, attention: { watchedMedian: 0.4 } }, intents: [{ action: 'insights-refresh', args: {}, status: 'done', tier: 'R2' }], assess: { trajectories: [] } };
  const liar = async () => ({ ok: true, content: 'This week the house reached 25,000 people. Everything went out. The Lantern read the numbers again.', model: 'stub' });
  const w1 = await HOME.writeBrief(rec, { think: liar, D: DEPS });
  const stored = JSON.parse(S.get(SOUL.K.brief(D0)));
  ok(w1.ok && stored.by === 'template' && /25000/.test(stored.why) && stored.text === HOME.briefTemplate(stored.facts) && S.get(SOUL.K.briefLast) === D0, 'a paragraph with an invented number falls back to the template (' + stored.why + '), stored as nsoul:brief:' + D0);
  const honest = async () => ({ ok: true, content: 'This week the house reached 19,000 people. The Lantern read the networks again this morning. Nothing more is planned for now.', model: 'stub' });
  const w2 = await HOME.writeBrief(rec, { think: honest, D: DEPS });
  ok(w2.ok && w2.brief.by === 'model' && /19,000/.test(w2.brief.text), 'an honest one is kept as the model wrote it');
  const held = await HOME.writeBrief(rec, { think: honest, D: DEPS, risk: async () => ({ risky: true }) });
  ok(held.brief.by === 'template' && /sentinel/.test(held.brief.why), 'and the sentinel may still hold it back');
  /* a note's own words never ride into the brief: no dash, no id, no figure of its own */
  const DASH = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']');
  const rec2 = { ...rec, intents: [{ action: 'insights-refresh', args: {}, status: 'done', tier: 'R2' },
    { action: 'note', args: { text: 'reelA ' + String.fromCharCode(0x2014) + ' g-reach lost 9999 people' }, status: 'done', tier: 'R1' },
    { action: 'note', args: { text: 'a second note' }, status: 'done', tier: 'R1' }] };
  const w3 = await HOME.writeBrief(rec2, { D: DEPS });
  ok(w3.brief.by === 'template' && /wrote 2 notes/.test(w3.brief.text) && !/reelA|g-reach|9999/.test(w3.brief.text) && !DASH.test(w3.brief.text),
    'the template says a note by its kind alone, counted, never its text: ' + w3.brief.text.split('. ').find(x => /notes/.test(x)));
  setDay(D1, '04:00');
  const h = await home();
  ok(h.brief && h.brief.date === D0, 'before the next cycle, the Home shows the latest brief with its date: ' + (h.brief && h.brief.date));
}

/* ===========================================================================
   7. THE QUEUE: LATER, AGAIN BEFORE THE COUNCIL, NOW, OR SKIPPED
=========================================================================== */
console.log('\n7. Next: tomorrow waits, meets the council again, may be done now or skipped');
{
  resetStore(); setDay(D0, '05:20'); quietExp(); ROUTER.calls.length = 0; ROUTER.guardian = 'approve';
  ROUTER.plan = JSON.stringify({ intents: [
    { action: 'insights-refresh', args: { round: 'two' }, why: 'Read again tomorrow, when the weekend posts have settled.', metric: 'northStar', when: 'tomorrow' },
    { action: 'trajectories', args: {}, why: 'a read is never queued', when: 'tomorrow' }
  ] });
  const t1 = await MIND.tick({});
  const r1 = await MIND.readCycle(t1.id);
  const q = await HOME.readQueue();
  ok(r1.queued && r1.queued.length === 1 && q.length === 1 && q[0].due === D1 && q[0].when === 'tomorrow' && !r1.intents.some(i => i.action === 'insights-refresh'), 'the intent dated tomorrow is stored in nsoul:queue for ' + D1 + ', not run today');
  ok(r1.dropped.some(d => /never queued/.test(d)), 'a read dated later is not queued');
  ROUTER.plan = '{"intents":[]}';
  setDay(D1, '05:20');
  const before = ROUTER.calls.length;
  const t2 = await MIND.tick({});
  const r2 = await MIND.readCycle(t2.id);
  const taken = r2.intents.find(i => i.queued === q[0].id);
  ok(taken && taken.council && taken.council.verdicts && taken.council.verdicts.guardian && councilAsked(before), 'on its day the cycle took it, and the council reviewed it again');
  ok(taken.status === 'done' && (await HOME.readQueue()).length === 0, 'it ran, and left the queue');
  /* do it now */
  const add = await HOME.queueAdd([{ action: 'insights-refresh', args: { round: 'three' }, why: 'the plan said later', metric: 'northStar', when: 'this week' }], 'test');
  const qid = add.added[0].id;
  const calls = ROUTER.calls.length;
  const dn = keep((await post({ action: 'do-now', id: qid })).body);
  const act = (await SOUL.actionsList()).find(a => a.id === dn.actionId);
  ok(dn.ok && /^Done/.test(dn.message) && act && act.approval.source === 'next' && act.approval.id === qid && !councilAsked(calls), 'Do it now runs it at once with his approval, no council: ' + dn.message);
  ok(!(await HOME.readQueue()).some(x => x.id === qid), 'and it leaves the queue');
  /* skip it */
  const add2 = await HOME.queueAdd([{ action: 'note', args: { text: 'Count the verse reels again.' }, why: 'later', when: 'tomorrow' }], 'test');
  const sk = keep((await post({ action: 'skip', id: add2.added[0].id })).body);
  const skips = await HOME.readSkips();
  ok(sk.ok && /will not plan it again before/.test(sk.message) && skips.length === 1 && skips[0].hand === 'note' && skips[0].until === addDays(D1, 7), 'Skip drops it and remembers it until ' + (skips[0] && skips[0].until));
  ROUTER.plan = JSON.stringify({ intents: [{ action: 'note', args: { text: 'Count the verse reels again.' }, why: 'again' }] });
  ROUTER.calls.length = 0;
  setDay(addDays(D1, 1), '05:20');
  const t3 = await MIND.tick({});
  const r3 = await MIND.readCycle(t3.id);
  const strat = ROUTER.calls.find(c => c.role === 'strategist');
  ok(strat && /SKIPPED BY THE OWNER/.test(strat.messages[1].content) && /Count the verse reels again/.test(strat.messages[1].content), 'the planner is told what he skipped');
  ok(!r3.intents.some(i => i.action === 'note' && i.args.text === 'Count the verse reels again.') && r3.dropped.some(d => /owner skipped until/.test(d)), 'and proposing it again anyway is dropped in code');
  setDay(addDays(D1, 8), '05:20');
  ok((await HOME.readSkips()).length === 0, 'seven days on, the skip is forgotten');
  /* the queue's own limits */
  resetStore(); setDay(D0, '10:00');
  const many = await HOME.queueAdd(Array.from({ length: 12 }, (_, i) => ({ action: 'note', args: { text: 'later ' + i }, why: 'x', when: 'tomorrow' })), 'test');
  ok(many.added.length === HOME.QUEUE_MAX && many.dropped.length === 2 && (await HOME.readQueue()).length === 10, 'ten in the queue at most; the rest are dropped and said');
  setDay(addDays(D0, 9), '05:20'); quietExp(); ROUTER.plan = '{"intents":[]}';
  const tq = await MIND.tick({ force: true });
  const rq = await MIND.readCycle(tq.id);
  ok(rq.dropped.filter(d => /passed its 7 days/.test(d)).length === 10 && (await HOME.readQueueAll()).length === 0, 'after seven days an item that never ran is let go, and the record says so');
  /* do it now and skip, on a step the council refused */
  setDay(D0, '05:20'); resetStore(); quietExp(); ROUTER.guardian = 'smart';
  ROUTER.plan = JSON.stringify({ intents: [
    { action: 'lineup-skip', args: { date: D1, slot: 'reelD' }, why: 'The afternoon reel showed a face, a median of 640.', metric: 'northStar' },
    { action: 'lineup-skip', args: { date: D0, slot: 'reelE' }, why: 'The night reel showed a face, a median of 640.', metric: 'northStar' }
  ] });
  const tb = await MIND.tick({ force: true });
  let h = await home();
  const blocked = h.next.filter(n => n.status === 'blocked');
  const afternoon = blocked.find(n => /afternoon/.test(n.title));
  const night = blocked.find(n => /night/.test(n.title));
  ok(blocked.length === 2 && blocked.every(n => n.canDoNow) && afternoon && night, 'two steps the council refused wait in Next as blocked: ' + blocked.map(n => n.title).join(' | '));
  ok(h.next[0] === afternoon && h.next[1] === night, 'the day\'s steps keep the plan\'s order');
  const dnb = keep((await post({ action: 'do-now', id: afternoon.id })).body);
  ok(dnb.ok && JSON.parse(S.get('nsoc:override:' + D1)).reelD.by === 'lantern-approved', 'Do it now on a refused step: his approval runs it, written as his: ' + dnb.message);
  const skb = keep((await post({ action: 'skip', id: night.id })).body);
  h = await home();
  ok(skb.ok && !h.next.length, 'Skip on the other; Next is empty now');
  const twice = keep((await post({ action: 'do-now', id: afternoon.id })).body);
  ok(!twice.ok && twice.message, 'a second Do it now on the same step is refused: ' + twice.message);
  ROUTER.guardian = 'approve';
}

/* ===========================================================================
   8. IDEAS: GO, LATER, NEVER, FOR EACH WHO
=========================================================================== */
console.log('\n8. ideas to grow: go, not now, never; the Lantern\'s, a build, the owner\'s');
{
  resetStore(); setDay(D0, '10:00'); quietExp();
  const got = await HOME.addIdeas([
    { title: 'Read the numbers twice on Fridays', why: 'Friday posts settle late.', impact: 'fresher Friday plans', who: 'lantern', metric: 'northStar', intents: [{ action: 'insights-refresh', args: { friday: true }, why: 'the Friday read', metric: 'northStar' }, { action: 'post-now', args: {}, why: 'x' }] },
    { title: 'A series on the Names of Allah', why: 'Names reels hold people.', impact: 'more watched share', who: 'lantern' },
    { title: 'Read Threads reach', why: 'Threads has no reading.', impact: 'a fuller north star', who: 'build', spec: 'A reader for Threads views.', metric: 'northStar' },
    { title: 'Ask a scholar to review the captions', why: 'Trust.', impact: 'trust', who: 'you', steps: ['Choose a scholar', 'Send the captions'] },
    { title: 'Buy followers to lift reach', why: 'faster growth', who: 'lantern' },
    { title: 'No who at all', why: 'x' }
  ], 'test');
  ok(got.added.length === 4 && got.dropped.some(d => /red line/.test(d.why)) && got.dropped.some(d => /who acts/.test(d.why)), 'four ideas kept; a red line and one with no one to act are dropped');
  const all = await HOME.readIdeasAll();
  const byTitle = t => all.find(i => i.title === t);
  ok(byTitle('Read the numbers twice on Fridays').intents.length === 1, 'a Lantern idea keeps only registered, lawful hands for its intents');
  const more = await HOME.addIdeas([{ title: 'Fifth', why: 'x', who: 'you' }, { title: 'Sixth', why: 'x', who: 'you' }], 'test');
  ok(more.added.length === 1 && /already open/.test(more.dropped[0].why), 'five open at most');
  /* go: the Lantern's own, with hands: queued with his approval, run by the next cycle without the council */
  const g1 = keep((await post({ action: 'idea', id: byTitle('Read the numbers twice on Fridays').id, choice: 'go' })).body);
  const q = await HOME.readQueue();
  ok(g1.ok && q.length === 1 && q[0].approval && q[0].approval.source === 'idea' && q[0].approval.owner === true, 'Go on a Lantern idea queues its intents for the next cycle, his approval recorded: ' + g1.message);
  ROUTER.plan = '{"intents":[]}'; ROUTER.calls.length = 0;
  setDay(D1, '05:20');
  const t = await MIND.tick({});
  const rec = await MIND.readCycle(t.id);
  const ran = rec.intents.find(i => i.queued === q[0].id);
  const act = (await SOUL.actionsList()).find(a => a.id === ran.actionId);
  ok(ran && ran.status === 'done' && ran.council.owner === true && !councilAsked(0), 'the next cycle ran it with his approval, no reviewer asked');
  ok(act.approval.source === 'idea' && act.approval.id === byTitle('Read the numbers twice on Fridays').id, 'the ledger names the idea he said Go to');
  /* go: the Lantern's own, without hands: a directive for the planner */
  setDay(D1, '10:00');
  const g2 = keep((await post({ action: 'idea', id: byTitle('A series on the Names of Allah').id, choice: 'go' })).body);
  ok(g2.ok && (await HOME.readDirectives()).length === 1, 'Go on a Lantern idea with no hands: the next plan is asked to turn it into steps');
  ROUTER.calls.length = 0;
  setDay(addDays(D1, 1), '05:20');
  await MIND.tick({});
  const strat = ROUTER.calls.find(c => c.role === 'strategist');
  ok(strat && /THE OWNER SAID GO/.test(strat.messages[1].content) && /Names of Allah/.test(strat.messages[1].content) && (await HOME.readDirectives()).length === 0, 'and the planner was told, once');
  /* go: a build */
  const g3 = keep((await post({ action: 'idea', id: byTitle('Read Threads reach').id, choice: 'go' })).body);
  const ups = await EVOLVE.listUpgrades();
  ok(g3.ok && ups.length === 1 && ups[0].status === 'accepted' && ups[0].title === 'Read Threads reach', 'Go on a build: the upgrade is written and accepted, in Claude\'s queue');
  /* go: the owner's own */
  const g4 = keep((await post({ action: 'idea', id: byTitle('Ask a scholar to review the captions').id, choice: 'go' })).body);
  const card = (await DEC.readOpen()).find(d => d.key === 'idea:' + byTitle('Ask a scholar to review the captions').id);
  ok(g4.ok && card && card.kind === 'you' && card.steps.join() === 'Choose a scholar,Send the captions', 'Go on his own: a "you" card with its steps');
  /* later and never */
  const fifth = (await HOME.readIdeasAll()).find(i => i.title === 'Fifth');
  const l = keep((await post({ action: 'idea', id: fifth.id, choice: 'later' })).body);
  ok(l.ok && (await HOME.readIdeasAll()).find(i => i.title === 'Fifth').status === 'later', 'Not now keeps it, as later');
  const n = keep((await post({ action: 'idea', id: fifth.id, choice: 'never' })).body);
  const never = await HOME.readNever();
  ok(n.ok && never.some(x => x.title === 'Fifth'), 'Never is remembered');
  const again = await HOME.addIdeas([{ title: 'Fifth', why: 'once more', who: 'you' }], 'test');
  ok(again.added.length === 0 && /never/.test(again.dropped[0].why), 'and the same idea is never written again');
  ROUTER.calls.length = 0;
  setDay(addDays(D1, 2), '05:20');
  await MIND.tick({});
  const s2 = ROUTER.calls.find(c => c.role === 'strategist');
  ok(s2 && /SAID NEVER TO/.test(s2.messages[1].content) && /Fifth/.test(s2.messages[1].content), 'the planner is told what he said never to');
  const done = keep((await post({ action: 'idea', id: fifth.id, choice: 'go' })).body);
  ok(!done.ok && /already answered/.test(done.message), 'an idea already answered says so');
  const h = await home();
  ok(h.ideas.some(i => i.status === 'go') && h.ideas.some(i => i.status === 'never') && h.ideas.every(i => ['new', 'later', 'go', 'never'].includes(i.status)), 'the Home shows the open ideas and what he decided this week');
}

/* ===========================================================================
   9. THE CONVERSATION'S PROPOSAL IS A DECISION; ITS YES RUNS THE HAND
=========================================================================== */
console.log('\n9. a proposal from the conversation is a decision, and its Yes runs the hand');
{
  resetStore(); setDay(D0, '10:00'); ROUTER.calls.length = 0;
  const card = (await freeVerse(D0, 'reelE'))[0];
  const p = { id: 'p-swap-1', type: 'other', requested: 'lineup-change', args: { date: D0, slot: 'reelE', action: 'swap', id: card }, why: 'Verse reels reached 1204 people this week.', reason: 'x', description: 'Swap reelE.', at: new Date().toISOString() };
  /* what api/lantern-agent.js's emit does with a proposal */
  S.set('x', '1'); L.set('nlan:proposals', [JSON.stringify(p)]);
  const made = await DEC.upsert(DEC.fromProposal(p));
  const h = await home();
  const d = h.decisions.find(x => x.id === made.id);
  ok(d && d.kind === 'approve' && d.title === 'Swap the night reel for ' + card + ' today?' && d.options.map(o => o.id).join() === 'yes,later,no', 'the proposal is an "approve" card on the Home: ' + (d && d.title));
  const r = await lan({ method: 'POST', body: { action: 'approve', id: 'p-swap-1' } });
  const ov = JSON.parse(S.get('nsoc:override:' + D0));
  const act = (await SOUL.actionsList()).find(a => a.id === r.body.entry.id);
  ok(r.body.ok && r.body.executed && r.body.entry.undo.kind === 'lineup-revert' && r.body.entry.before === null, 'the conversation\'s own Approve door still answers, by deciding the card: ' + r.body.message);
  ok(ov.reelE.id === card && ov.reelE.by === 'lantern-approved', 'the swap ran through the hand, written as the owner\'s approval');
  ok(act && act.hand === 'lineup-swap' && act.approval.source === 'decision' && act.approval.id === made.id, 'and it is in the one ledger, under his decision');
  ok(!(L.get('nlan:proposals') || []).length && (await DEC.readArchive()).some(a => a.id === made.id && a.status === 'yes'), 'the proposal left the conversation\'s list, the card the Home');
  /* the same, answered on the Home */
  const p2 = { id: 'p-skip-2', type: 'other', requested: 'lineup-change', args: { date: D1, slot: 'reelA', action: 'skip' }, why: 'The morning reel reached least.', at: new Date().toISOString() };
  L.set('nlan:proposals', [JSON.stringify(p2)]);
  const made2 = await DEC.upsert(DEC.fromProposal(p2));
  const r2 = keep((await post({ action: 'decide', id: made2.id, option: 'yes' })).body);
  ok(r2.ok && JSON.parse(S.get('nsoc:override:' + D1)).reelA.action === 'skip' && !(L.get('nlan:proposals') || []).length, 'answered Yes on the Home: it runs, and the conversation\'s list forgets it: ' + r2.message);
  const p3 = { id: 'p-skip-3', type: 'other', requested: 'lineup-change', args: { date: D1, slot: 'reelC', action: 'skip' }, why: 'x', at: new Date().toISOString() };
  L.set('nlan:proposals', [JSON.stringify(p3)]);
  const made3 = await DEC.upsert(DEC.fromProposal(p3));
  const r3 = await lan({ method: 'POST', body: { action: 'decline', id: 'p-skip-3' } });
  ok(r3.body.ok && (await DEC.readArchive()).some(a => a.id === made3.id && a.status === 'no') && !S.get('nsoc:override:' + D1).includes('reelC'), 'the Decline door answers the card No, and nothing ran');
  /* an older proposal, made before decisions existed, still approves */
  const p4 = { id: 'p-old-4', type: 'refresh-insights', requested: 'refresh-insights', args: {}, why: 'the daily limit was reached', at: new Date().toISOString() };
  L.set('nlan:proposals', [JSON.stringify(p4)]);
  const r4 = await lan({ method: 'POST', body: { action: 'approve', id: 'p-old-4' } });
  ok(r4.body.ok && r4.body.executed && (await SOUL.actionsList()).some(a => a.hand === 'insights-refresh' && a.approval && a.approval.owner), 'a proposal with no card yet gets one, and its Yes runs the hand with his approval');
}

/* ===========================================================================
   10. THE CONVERSATION ACTS THROUGH THE HANDS, IN THE ONE LEDGER
=========================================================================== */
console.log('\n10. the conversation\'s actions and orders run through the hands, with the council, in the one ledger');
let OUTCOMES = [];
{
  resetStore(); setDay(D0, '10:00'); ROUTER.calls.length = 0; ROUTER.guardian = 'approve'; ROUTER.skeptic = 'approve';
  const tools = LA.buildTools({ headers: {} });
  const r = await tools.action_refresh_insights({}, { why: 'the owner asked for fresh numbers', toolOutputs: [] });
  const act = (await SOUL.actionsList()).find(a => a.id === r.actionId);
  ok(r.ok && act && act.actor === 'lantern' && act.approvedBy === 'council' && roles().includes('guardian') && roles().includes('skeptic'), 'refresh-insights: through the council, then runHand, in the one ledger as the Lantern\'s');
  /* through the orchestrator, as a run would: the entry streamed carries the ledger's own id */
  const emitted = [];
  const ledger = { newId: () => 'legacy-id', reserve: async () => ({ ok: true, count: 1 }), release: async () => {}, record: async e => emitted.push(['record', e]) };
  const route = async ({ messages }) => {
    if (/planner/.test(messages[0].content)) return { ok: true, content: JSON.stringify({ steps: [{ kind: 'action', name: 'refresh-insights', args: {}, why: 'the owner asked' }] }) };
    return { ok: true, content: JSON.stringify({ answer: 'The numbers were read again.', artifacts: [] }) };
  };
  const out = await AGENT.runAgent({ message: 'read the numbers again', tools, route, ledger, emit: async (t, d) => emitted.push([t, d]) });
  const streamed = emitted.find(e => e[0] === 'action');
  ok(streamed && streamed[1].unified === true && /^act-/.test(streamed[1].id) && (await SOUL.actionsList()).some(a => a.id === streamed[1].id), 'the action streamed to the console carries the one ledger\'s id, so its Undo reaches the same record');
  /* an order that names a hand */
  const hands = LA.handsFor();
  ok(hands.has('lineup-skip') && !hands.has('observatory') && /lineup-skip/.test(hands.text), 'the planner is handed the hands the owner may order (never the reads)');
  const order = steps => async ({ messages }) => {
    if (/planner/.test(messages[0].content)) return { ok: true, content: JSON.stringify({ steps }) };
    return { ok: true, content: JSON.stringify({ answer: 'As you asked.', artifacts: [] }) };
  };
  ROUTER.calls.length = 0;
  const o1 = await AGENT.runAgent({ message: 'skip tomorrow\'s morning reel', tools: {}, hands, route: order([{ kind: 'action', name: 'lineup-skip', args: { date: D1, slot: 'reelA' }, why: 'the owner asked to skip tomorrow\'s morning reel' }]) });
  const sk = (await SOUL.actionsList()).find(a => a.hand === 'lineup-skip');
  ok(sk && sk.actor === 'lantern' && sk.approvedBy === 'council' && JSON.parse(S.get('nsoc:override:' + D1)).reelA.by === 'soul' && roles().includes('guardian'), 'an order naming a hand ran through the council and the hand, in the one ledger');
  ok(/Done, with the council's approval: skip the morning reel tomorrow\./.test(o1.answer), 'and the answer says what was done: "' + o1.answer + '"');
  const o2 = await AGENT.runAgent({ message: 'and skip the noon reel tomorrow too', tools: {}, hands, route: order([{ kind: 'action', name: 'lineup-skip', args: { date: D1, slot: 'reelC' }, why: 'the owner asked' }]) });
  ok(/Not done \(skip the noon reel tomorrow\): the Lantern may skip at most 1 slot/.test(o2.answer) && !/soul/i.test(o2.answer), 'a second skip of the day is refused by the hand, and the answer says why, in the Lantern\'s name: "' + o2.answer.slice(-110) + '"');
  const o3 = await AGENT.runAgent({ message: 'note it', tools: {}, hands, route: order([{ kind: 'action', name: 'note', args: { text: 'delete the old reels from the grid' }, why: 'tidier' }]) });
  ok(/Not done/.test(o3.answer) && /red line/.test(o3.answer), 'a red line in an order is refused before any model: "' + o3.answer.slice(-90) + '"');
  OUTCOMES = [o1.answer, o2.answer, o3.answer, ...(o1.outcomes || [])];
  /* the ledger door reads the one ledger; its Undo reaches it */
  const lg = await lan({ query: { action: 'ledger' } });
  const row = lg.body.items.find(i => i.id === sk.id);
  ok(lg.body.ok && row && row.unified && row.what === 'lineup-change' && row.who === 'lantern' && row.title === 'Skipped the morning reel tomorrow', 'GET ?action=ledger reads the one ledger, in the shape the console draws: ' + (row && row.title));
  const un = await lan({ method: 'POST', body: { action: 'undo', id: sk.id } });
  ok(un.body.ok && !(JSON.parse(S.get('nsoc:override:' + D1) || '{}').reelA), 'its Undo, through the conversation\'s own door, runs the hand\'s exact recipe');
  const un2 = await lan({ method: 'POST', body: { action: 'undo', id: sk.id } });
  ok(!un2.body.ok && /already undone/.test(un2.body.error), 'and a second Undo is refused');
  SAID.push(...lg.body.items.flatMap(i => [i.title, i.why, i.who, i.error].filter(Boolean)));
  /* the Lantern's own state, as the conversation reads it */
  const st = await tools.lantern({});
  ok(st.data && !('spend' in st.data) && Array.isArray(st.data.done) && Array.isArray(st.data.goals) && /the Lantern is/.test(st.summary), 'the "lantern" tool reads the Home without the spend: ' + st.summary);
  ok(AGENT.TOOL_NAMES.includes('lantern') && AGENT.fallbackPlan('What did you do this morning?').steps.some(s => s.name === 'lantern'), 'and the planner reaches for it when the owner asks what the Lantern did');
  SAID.push(JSON.stringify(st.data));
}

/* ===========================================================================
   11. THE OWNER READS ONE NAME: THE LANTERN
=========================================================================== */
console.log('\n11. every string the owner reads says the Lantern, never the soul');
{
  const TEXT = new Set(['title', 'why', 'detail', 'reason', 'text', 'label', 'focus', 'note', 'message', 'outcome', 'impact', 'confirm', 'name', 'said', 'error']);
  const found = [];
  const walk = (v, key) => {
    if (typeof v === 'string') { if ((TEXT.has(key) || key === 'steps') && /soul/i.test(v)) found.push(key + ': ' + v.slice(0, 80)); return; }
    if (Array.isArray(v)) { v.forEach(x => walk(x, key)); return; }
    if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], k);
  };
  walk(H1, '');
  resetStore(); setDay(D0, '05:20'); quietExp(); NOTIFY.length = 0; ROUTER.guardian = 'approve';
  ROUTER.plan = JSON.stringify({ intents: [{ action: 'lineup-swap', args: { date: D1, slot: 'reelB', id: 'no-such-card' }, why: 'Verse reels reached 1204 people.', metric: 'northStar' }] });
  await LINEUP.setOverride({ date: D1, slot: 'reelD', action: 'skip' }, { manifest: MANIFEST, seen: new Map(), by: 'owner', note: 'his own' });
  await MIND.tick({});
  const h = await home();
  walk(h, '');
  for (const s of SAID.concat(OUTCOMES)) if (/soul/i.test(s)) found.push('said: ' + s.slice(0, 80));
  ok(found.length === 0, 'the Home, every answer to its buttons, the ledger door, the conversation\'s outcomes: no "soul" anywhere' + (found.length ? ': ' + found.join(' | ') : ''));
  /* round four: the morning's message reaches him in the evening digest */
  await VOICE.eveningDigest({ force: true });
  ok(NOTIFY.length === 1 && /^NOOR Lantern/.test(NOTIFY[0]) && /Home/.test(NOTIFY[0]) && !/soul/i.test(NOTIFY[0]), 'the Telegram message too: ' + NOTIFY[0].slice(0, 60));
  ok(SOUL.sayLantern('that slot was set by the Soul; the soul never overwrites it') === 'that slot was set by the Lantern; the Lantern never overwrites it'
    && SOUL.sayLantern("The soul's own goals, a soul skip, the Soul room") === "The Lantern's own goals, a Lantern skip, the engine room", 'one function turns the old name into the one the owner reads');
  /* and only the name: the word in its meaning in the faith is never touched */
  const FAITH = ['Allah does not burden a soul beyond what it can carry.', 'Every soul shall taste death.', 'A reel on how the soul is purified reached 2,400 people.', 'The page /soul has no meta description.', 'The soul at rest returns to its Lord.'];
  ok(FAITH.every(s => SOUL.sayLantern(s) === s), 'and never the word in its meaning in the faith: a verse, a reel on the soul, the /soul page stay exactly as written');
  resetStore(); setDay(D0, '05:20'); quietExp(); ROUTER.guardian = 'approve';
  ROUTER.plan = JSON.stringify({ intents: [{ action: 'note', args: { text: 'The reel on the purification of the soul held people longest.' }, why: 'A reel on how the soul is purified held 40 percent of each viewing.', when: 'tomorrow' }] });
  await MIND.tick({});
  const hf = await home();
  const nx = (hf.next || []).find(n => /purif/.test(n.why));
  ok(nx && nx.why === 'A reel on how the soul is purified held 40 percent of each viewing.' && /purification of the soul/.test(nx.title), 'a planner\'s reason that quotes a reel on the soul reaches Next word for word: ' + (nx && nx.title));
  const strat = ROUTER.calls.filter(c => c.role === 'strategist').pop();
  ok(strat && /You are the strategist of the Lantern/.test(strat.messages[0].content) && /the word soul is kept for its meaning in the faith/.test(strat.messages[0].content), 'and the planner is told to call the house\'s mind the Lantern, and why');
  const ch = (await SOUL.chronicleRead(1))[0];
  ok(!ch.needsYou.concat(ch.highlights).some(x => /soul/i.test(x)), 'and the cycle\'s own chronicle speaks of the Lantern');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
