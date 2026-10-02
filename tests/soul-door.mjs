/* NOOR · the Soul room against the real door: an integration check.
   ---------------------------------------------------------------------------
   The console room (admin2.html, "The Soul") was first built against a stub
   of SOUL.md section 10, and a stub can drift from the door it stands for.
   This runs the REAL handler, api/soul.js, over the in-memory store of
   tests/_soul-harness.mjs after three weeks of stubbed daily cycles (every
   network stood in for: the live site, PageSpeed, YouTube, IndexNow and Jev),
   then:
     saves every GET view's JSON to a folder (argument 1, default
       /tmp/qa/soul-door), so tests/console-soul.mjs can drive the room with
       exactly what the door answers;
     checks that every field the room reads is present in what the door
       sends (the list below is the room's own reads, view by view, written
       out from admin2.html), so a field renamed on either side fails here.

   Run:  node tests/soul-door.mjs [out-dir]
*/
import fs from 'node:fs';
import path from 'node:path';
import {
  S, L, resetStore, SOUL, MIND, INST, door, AUTH, ROUTER, DEPS, OBS, setDay, today, addDays, worldOn, jevOn
} from './_soul-harness.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const OUT = process.argv[2] || '/tmp/qa/soul-door';
fs.mkdirSync(OUT, { recursive: true });

/* ---------------------------------------------------------------- three weeks */
resetStore(); worldOn();
jevOn(() => 0.04);
await INST.setBenchmarks(['UCaaaaaaaaaaaaaaaaaaaaaa', 'UCbbbbbbbbbbbbbbbbbbbbbb']);
const START = '2026-09-21', END = '2026-10-12';   /* Monday to Monday */
let dayN = 0;
const baseObs = OBS;
DEPS.observatory = async () => {
  const o = baseObs();
  const grow = 150 * dayN;
  o.summary.networks = [
    { net: 'instagram', posts: 30, reach: 12000 + grow, views: null, engagement: 0.05 },
    { net: 'facebook', posts: 30, reach: 3000 + Math.round(grow / 5), views: null },
    { net: 'youtube', posts: 12, reach: null, views: 4000 + Math.round(grow / 3) },
    { net: 'threads', posts: 0, reach: null, views: null }
  ];
  /* the last morning, visitors leap: the anomaly watch has something to say */
  o.summary.visitors = { value: today() === END ? 1400 : 420 + (dayN % 3) * 6 };
  return o;
};
S.set('nexp:state', JSON.stringify({ current: { id: 'verse-length', start: addDays(START, -3), args: {} }, history: [] }));
ROUTER.guardian = 'approve'; ROUTER.skeptic = 'approve';
ROUTER.plan = JSON.stringify({ intents: [
  { action: 'insights-refresh', args: {}, why: 'The numbers the plan reads are a day old.', expectedEffect: 'fresh numbers behind tomorrow\'s plan', metric: 'northStar' },
  { action: 'note', args: { text: 'Verse reels lead the week.' }, why: 'worth remembering', metric: '' },
  { action: 'trajectories', args: {}, why: 'where the goals are heading' }
] });
ROUTER.reflect = JSON.stringify({ lessons: [{ text: 'Short verse reels hold people longer than long ones.', why: 'the learn block' }], goals: [],
  upgrades: [{ title: 'Read Telegram reach', why: 'Telegram has no reading in any snapshot', spec: 'Add a reader for the channel view counts.', metric: 'northStar', expectedEffect: 'a fuller north star', priority: 'medium' }] });
ROUTER.guardian = 'smart';
for (let d = START; d <= END; d = addDays(d, 1)) {
  setDay(d, '05:20');
  const t = await MIND.tick({});
  if (t.status !== 'done') console.log('  note: the cycle of ' + d + ' ended ' + t.status + ' ' + (t.error || ''));
  setDay(d, '09:15');
  await MIND.tick({});          /* the YouTube reads, after the quota day turns */
  dayN++;
}
ok(S.has(SOUL.K.scorecard('2026-W41')) && S.has(SOUL.K.scorecard('2026-W40')), 'three weeks of daily cycles ran, Mondays filing their scorecards');

/* ---------------------------------------------------------------- every view */
const ptr = JSON.parse(S.get(SOUL.K.cycleCurrent));
const VIEWS = {
  today: { view: 'today' }, metrics: { view: 'metrics', days: '90' }, chronicle: { view: 'chronicle', limit: '30' },
  cycle: { view: 'cycle', id: ptr.id }, audit: { view: 'audit', limit: '50' }, evolution: { view: 'evolution' },
  trajectories: { view: 'trajectories' }, effects: { view: 'effects' }, scorecard: { view: 'scorecard' },
  'scorecard-W40': { view: 'scorecard', week: '2026-W40' },
  search: { view: 'search' }, speed: { view: 'speed' }, youtube: { view: 'youtube' }, radar: { view: 'radar' }, coverage: { view: 'coverage' }
};
const J = {};
for (const [name, query] of Object.entries(VIEWS)) {
  const r = await door({ query, headers: AUTH });
  J[name] = r.body;
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(r.body, null, 2));
  ok(r.statusCode === 200 && r.body && r.body.ok === true, 'view=' + query.view + (query.week ? '&week=' + query.week : '') + ' answers 200 ok, saved to ' + path.join(OUT, name + '.json'));
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ at: new Date().toISOString(), views: Object.keys(VIEWS), cycle: ptr.id }, null, 2));

/* ---------------------------------------------------------------- the room's reads */
/* "a.b[].c": every element of a.b has c. A key that is present with null
   counts as present: the room says "not read" for a null, but a missing
   key means the two sides disagree on the name. */
function has(obj, p) {
  const parts = p.split('.');
  const walk = (o, i) => {
    if (i === parts.length) return true;
    let k = parts[i], each = false;
    if (k.endsWith('[]')) { k = k.slice(0, -2); each = true; }
    if (o == null || typeof o !== 'object' || !Object.prototype.hasOwnProperty.call(o, k)) return false;
    const v = o[k];
    if (!each) return i === parts.length - 1 ? true : (v == null ? true : walk(v, i + 1));
    if (!Array.isArray(v) || !v.length) return false;
    return v.every(x => i === parts.length - 1 ? true : walk(x, i + 1));
  };
  return walk(obj, 0);
}
const READS = {
  today: ['ok', 'paused', 'mission', 'northStar.value', 'northStar.weekAgo', 'northStar.series[].date', 'northStar.series[].value',
    'goals[].id', 'goals[].owner', 'goals[].outcome', 'goals[].metric', 'goals[].baseline', 'goals[].target', 'goals[].due', 'goals[].status', 'goals[].history',
    'goals[].trajectory.status', 'goals[].trajectory.projected', 'goals[].trajectory.eta',
    'lastCycle.id', 'lastCycle.at', 'lastCycle.status', 'lastCycle.done', 'lastCycle.next', 'lastCycle.needsYou',
    'spend.month', 'spend.usd', 'spend.capUsd', 'counts.actionsToday', 'counts.capToday', 'telegram.linked', 'telegram.at'],
  metrics: ['series[].date', 'series[].northStar', 'series[].reach.instagram', 'series[].reach.youtube', 'series[].reach.facebook', 'series[].reach.threads',
    'series[].reach.telegram', 'series[].site.visitors7', 'series[].site.arrivals', 'series[].attention.watchedMedian', 'series[].output.health',
    'series[].spend.usd', 'series[].missing'],
  chronicle: ['items[].at', 'items[].cycle', 'items[].done', 'items[].next', 'items[].needsYou', 'items[].highlights'],
  cycle: ['cycle.id', 'cycle.kind', 'cycle.stage', 'cycle.status', 'cycle.startedAt', 'cycle.intents[].action', 'cycle.intents[].tier', 'cycle.intents[].why',
    'cycle.intents[].status', 'cycle.intents[].council', 'cycle.intents[].result'],
  audit: ['items[].at', 'items[].kind', 'items[].actor', 'items[].summary', 'chainOk'],
  evolution: ['playbook.version', 'playbook.lessons[].text', 'playbook.lessons[].why', 'playbook.lessons[].at', 'proposals[].kind', 'proposals[].status',
    'proposals[].lesson', 'proposals[].evals', 'upgrades[].id', 'upgrades[].title', 'upgrades[].why', 'upgrades[].spec', 'upgrades[].metric',
    'upgrades[].expectedEffect', 'upgrades[].priority', 'upgrades[].status', 'upgrades[].at'],
  trajectories: ['items[].id', 'items[].outcome', 'items[].metric', 'items[].status', 'items[].value', 'items[].target', 'items[].due', 'items[].projected',
    'items[].eta', 'items[].slopePerDay', 'items[].confidence', 'items[].note', 'items[].series', 'items[].drift', 'items[].behindStreak'],
  effects: ['items[].action', 'items[].metric', 'items[].date', 'items[].before', 'items[].after', 'items[].delta', 'items[].baselineDelta', 'items[].verdict',
    'summary.helped', 'summary.hurt', 'summary.unclear', 'pending'],
  scorecard: ['week', 'weeks', 'scorecard.week', 'scorecard.from', 'scorecard.to', 'scorecard.builtOn', 'scorecard.northStar.value', 'scorecard.northStar.deltaPct',
    'scorecard.northStar.trend4w', 'scorecard.metrics[].path', 'scorecard.metrics[].label', 'scorecard.metrics[].value', 'scorecard.metrics[].delta',
    'scorecard.metrics[].trend4w', 'scorecard.goals[].id', 'scorecard.goals[].status', 'scorecard.goals[].outcome', 'scorecard.posts.top', 'scorecard.posts.bottom',
    'scorecard.actions.count', 'scorecard.effects.total', 'scorecard.effects.helped', 'scorecard.effects.hurt', 'scorecard.effects.unclear', 'scorecard.anomalies',
    'scorecard.search.score', 'scorecard.speed.score', 'scorecard.youtube.subscribers', 'scorecard.coverage.low', 'scorecard.spend.usd', 'scorecard.spend.capUsd',
    'scorecard.radar'],
  search: ['audit.score', 'audit.week', 'audit.passed', 'audit.sampled', 'audit.sitemapUrls', 'audit.counts', 'audit.failures', 'lastTry',
    'indexnow.keySet', 'indexnow.verified', 'indexnow.submittedToday', 'indexnow.perDay', 'indexnow.pending', 'indexnow.last'],
  speed: ['speed.score', 'speed.week', 'speed.pages[].name', 'speed.pages[].url', 'speed.pages[].ok', 'speed.pages[].score', 'speed.pages[].lcpMs',
    'speed.pages[].cls', 'speed.pages[].inpMs', 'lastTry'],
  youtube: ['youtube.house.subscribers', 'youtube.house.views', 'youtube.house.videos', 'youtube.week', 'youtube.benchmarks[].title', 'youtube.benchmarks[].subscribers',
    'youtube.benchmarks[].views', 'youtube.benchmarks[].videos', 'youtube.note', 'benchmarks', 'lastTry'],
  radar: ['radar.week', 'radar.rising[].query', 'radar.rising[].views', 'radar.rising[].kinds', 'radar.rising[].videos[].title', 'progress.done', 'progress.of', 'lastTry'],
  coverage: ['coverage.kinds[].kind', 'coverage.kinds[].cards', 'coverage.kinds[].remaining', 'coverage.kinds[].perWeek', 'coverage.kinds[].runwayDays',
    'coverage.kinds[].low', 'coverage.kinds[].note', 'coverage.low', 'minDays']
};
console.log('\nevery field the room reads is in what the door sends');
for (const [view, paths] of Object.entries(READS)) {
  const missing = paths.filter(p => !has(J[view], p));
  ok(!missing.length, view + ': ' + paths.length + ' fields' + (missing.length ? ', missing ' + missing.join(', ') : ''));
}

console.log('\nthe shapes that matter to the room');
{
  const c = J.cycle.cycle;
  const r2 = c.intents.filter(i => i.tier === 'R2');
  ok(r2.length >= 1 && r2.every(i => i.council && i.council.verdicts && ['guardian', 'auditor', 'skeptic'].every(k => i.council.verdicts[k] && i.council.verdicts[k].vote)),
    'an R2 intent\'s three verdicts sit under council.verdicts (the room reads them there)');
  ok(r2.every(i => i.council.sentinel && i.council.sentinel.vote === 'pass'), 'with the sentinel beside them');
  const ran = c.intents.filter(i => i.status === 'done' && i.tier !== 'R0');
  ok(ran.length >= 1 && ran.every(i => i.result && i.result.entry && i.result.entry.id && typeof i.result.entry.undo === 'string'), 'a step that ran carries result.entry {id, undo kind} (the room\'s Undo)');
  const r1 = c.intents.filter(i => i.tier !== 'R2');
  ok(r1.every(i => i.council && i.council.skipped === true), 'a step with no review says council.skipped');
  ok(J.today.goals.some(g => g.trajectory && g.trajectory.status === 'behind'), 'the goals carry their trajectory');
  ok(J.trajectories.items.some(t => t.drift), 'and a goal three weeks behind has drifted');
  ok(J.effects.items.length >= 5 && J.effects.items.every(e => ['helped', 'hurt', 'unclear'].includes(e.verdict)), 'the effects ledger holds the measured actions: ' + J.effects.items.length);
  ok(J.scorecard.weeks.join() === '2026-W41,2026-W40,2026-W39,2026-W38' && J.scorecard.week === '2026-W41' && J['scorecard-W40'].scorecard.week === '2026-W40', 'four Mondays, four weeks listed, newest first, each readable');
  ok(J.radar.radar && J.radar.radar.rising.length === 8, 'a full radar week is held');
  const log = (L.get(SOUL.K.indexnowLog) || []).map(x => JSON.parse(x));
  const site = INST.readSitemap().filter(e => /^https:\/\/noorcodex\.com\//.test(e.loc)).length;
  ok(J.search.indexnow.keySet && J.search.indexnow.verified && J.search.indexnow.pending === 0 && log.every(x => x.submitted <= 100) && log.reduce((a, x) => a + x.submitted, 0) === site,
    'IndexNow: the key is served, and the sitemap\'s ' + site + ' pages went at most 100 a day (' + log.map(x => x.submitted).reverse().join(', ') + ')');
  ok((J.chronicle.items[0].highlights || []).some(h => /visitors/.test(h)), 'the last morning\'s visitors spike is in the chronicle');
  ok(J.today.telegram && J.today.telegram.linked === false, 'the today view says whether Telegram is linked');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
