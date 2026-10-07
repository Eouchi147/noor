/* NOOR · The Soul, the console room that shows the house's own mind.
   ------------------------------------------------------------------
   admin2.html's room "The Soul" reads one owner-gated route, /api/soul
   (SOUL.md section 10). This feeds that route the shapes the section names,
   from a stub that remembers what was posted to it (a pause stays paused, a
   linked Telegram stays linked), and drives the room the way the owner
   would: at a desk's width and at a phone's, with real data, with nothing
   yet (the first day), and with the store down. It checks that every one of
   the ten sections draws, that each button posts exactly the body the
   contract names and nothing before its confirm, that no script throws, that
   nothing scrolls sideways at 390 px, and that no dash slipped into what the
   room prints. Screenshots land in /tmp/qa/soul/ for a person to look at.

   The instruments (SOUL.md section 11, 2 October 2026): the eight cards
   (Week, Trajectories, What worked, Search readiness, Page speed, YouTube
   position, Topic radar, Coverage) draw from their own views, say so in
   words when empty or failing, and fit at 390 px; the week selector reads
   another week; the benchmark list saves exactly {action:"benchmarks", ids}.

   THE REAL DOOR. The last pass does not use the fixtures above at all: it
   runs tests/soul-door.mjs, which drives the real api/soul.js over three
   weeks of stubbed cycles and saves every view's JSON, and serves exactly
   that to the room, so a field the room reads under one name and the door
   sends under another shows up here as a section that does not draw.

   THE ENGINE ROOM (3 October 2026, LANTERN.md): the owner reads this room as
   the engine room now, reached from More at #engine (the old #soul still
   lands there), and every "Soul" it printed says "the Lantern". The route,
   the views and the bodies are unchanged; only what the owner reads moved.

   Run:  python3 /tmp/vercelish.py 8231 <the repo root> &   node tests/console-soul.mjs
   (NOOR_BASE overrides the address; CHROMIUM_PATH the browser.)
*/
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8231';
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.SOUL_SHOTS || '/tmp/qa/soul';
mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const br = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const DASH = new RegExp('[\\u2013\\u2014]');

/* ---------------------------------------------------------------- fixtures */
const MISSION = 'Serve Allah by bringing Islam, accurately and beautifully, before as many people as possible, as efficiently as possible.';
const END = Date.UTC(2026, 9, 2);
const isoDay = t => new Date(t).toISOString().slice(0, 10);
/* the store holds 140 days of snapshots, so a 365 day window shows 140 */
function snapshot(k, total) {
  const t = END - (total - 1 - k) * 86400000, date = isoDay(t), g = k / total;
  const wave = Math.sin(k / 3.1) * 0.06 + Math.sin(k / 9.7) * 0.04;
  const ig = Math.round(16000 + 15000 * g + 16000 * g * wave);
  const yt = Math.round(7000 + 9000 * g * (1 + wave));
  const fb = Math.round(900 + 600 * g + 300 * wave);
  const th = k < 20 ? null : Math.round(400 + 1400 * g * (1 + wave));
  const day = +date.slice(8, 10);
  return {
    date,
    reach: { instagram: ig, youtube: yt, facebook: fb, threads: th, telegram: { value: null, reason: 'the Bot API does not report channel views' },
      total: ig + yt + fb + (th || 0) },
    site: { visitors7: Math.round(380 + 520 * g * (1 + wave)),
      arrivals: { search: Math.round(30 + 60 * g), social: Math.round(160 + 200 * g * (1 + wave)), direct: Math.round(90 + 40 * g), other: Math.round(12 + 10 * g) } },
    attention: { watchedShare: Math.round((0.36 + 0.05 * g + wave * 0.1) * 1000) / 1000, watchSeconds: 21 },
    output: { posts7: 70, health: k === total - 9 ? 0.86 : Math.round((0.95 + 0.04 * g) * 1000) / 1000 },
    learning: { experiment: 'running', lessons: 5 },
    spend: { usd: Math.round((date.startsWith('2026-10') ? day * 1.71 : Math.min(9.6, day * 0.31)) * 100) / 100 }
  };
}
function METRICS(days) { const total = 140, n = Math.min(days, total); const all = []; for (let k = 0; k < total; k++) all.push(snapshot(k, total)); return { ok: true, series: all.slice(total - n) }; }
const LAST = METRICS(140).series.at(-1), WEEK_AGO = METRICS(140).series.at(-8);
const NS = LAST.reach.total, NS_WA = WEEK_AGO.reach.total;

const GOALS = [
  { id: 'g-reach', owner: 'owner', outcome: 'Double the north star within 12 weeks', metric: 'northStar', baseline: 31200, target: 62400, due: '2026-12-25', cadence: 'weekly', status: 'on-track',
    history: [{ at: '2026-10-01', value: NS_WA }, { at: '2026-10-02', value: NS }] },
  { id: 'g-attention', owner: 'owner', outcome: 'Raise the median watched share by 10 points within 8 weeks', metric: 'attention.watchedShare', baseline: 0.36, target: 0.46, current: 0.41, due: '2026-11-27', cadence: 'weekly', status: 'behind', history: [] },
  { id: 'g-search', owner: 'owner', outcome: 'Search arrivals at least 20 percent of site arrivals', metric: 'site.searchShare', baseline: 0.09, target: 0.2, current: 0.12, due: '2026-12-25', cadence: 'weekly', status: 'active', history: [] },
  { id: 'g-health', owner: 'owner', outcome: 'Posting health at least 98 percent every week', metric: 'output.health', baseline: 0.95, target: 0.98, current: 0.99, due: '2026-12-25', cadence: 'weekly', status: 'met', history: [] },
  { id: 'g-test', owner: 'soul', outcome: 'Run the verse length test to a verdict', metric: 'learning.experimentDays', baseline: 0, target: 14, current: 9, due: '2026-10-20', cadence: 'daily', status: 'on-track', history: [] }
];
const LAST_CYCLE = { id: 'c-20261002', at: '2026-10-02T05:04:00Z', status: 'done',
  done: ['Swapped tomorrow\'s 08:00 reel for a shorter verse, approved by the council', 'Read the network numbers again; they were 26 hours old'],
  next: ['Watch whether the shorter verse holds attention past 50 percent', 'Plan Friday\'s reel around Surah Al-Kahf'],
  needsYou: ['Facebook\'s page token runs out in 6 days: renew it in Meta Business settings'] };
const TODAY = st => ({ ok: true, paused: st.paused, mission: MISSION,
  northStar: { value: NS, weekAgo: NS_WA, series: METRICS(14).series.map(s => ({ date: s.date, value: s.reach.total })) },
  goals: st.goals, lastCycle: LAST_CYCLE, spend: { month: '2026-10', usd: 3.42, capUsd: 10 }, counts: { actionsToday: 2, capToday: 6 },
  telegram: { linked: st.linked } });
const CHRONICLE = { ok: true, items: [
  { at: '2026-09-29T05:03:00Z', cycle: 'c-20260929', done: ['Planned the verse length test from 30 September'], next: ['Let the test run seven days'], needsYou: [], highlights: ['Weekly cycle: three lessons proposed, one passed every canary'] },
  { at: '2026-10-02T05:04:00Z', cycle: 'c-20261002', done: LAST_CYCLE.done, next: LAST_CYCLE.next, needsYou: LAST_CYCLE.needsYou, highlights: ['People reached this week: ' + NS.toLocaleString('en-US') + ', up from ' + NS_WA.toLocaleString('en-US')] },
  { at: '2026-10-01T05:02:00Z', cycle: 'c-20261001', done: ['Nothing changed: the council found no action worth today\'s caps'], next: [], needsYou: [], highlights: [] },
  { at: '2026-09-30T05:05:00Z', cycle: 'c-20260930', done: [], next: [], needsYou: [], highlights: [] }
] };
const CYCLE = { ok: true, cycle: { id: 'c-20261002', at: '2026-10-02T05:04:00Z', kind: 'daily', status: 'done', stage: 'report',
  failedReason: 'report was cut off 3 times',
  dropped: ['the strategist proposed "delete-post", which crosses a red line (deleting or hiding any post on any network, or any content of the library); refused in code before any review'], intents: [
  { id: 'i1', action: 'lineup.swap', tier: 'R2', args: { date: '2026-10-03', slot: 'reelA' },
    why: 'Verse reels under 30 seconds held 52 percent watched over 14 reels; tomorrow\'s 08:00 reel runs 58 seconds.',
    expectedEffect: 'Watched share on the 08:00 slot up 5 points', metric: 'attention.watchedShare',
    evidence: ['14 short verse reels, median watched 52 percent', '9 long verse reels, median watched 37 percent'],
    council: { guardian: { vote: 'approve', reasons: ['A swap within the house\'s own shelf, inside the schedule'] },
      auditor: { vote: 'approve', reasons: ['52 and 37 both appear in the insights learn block', 'n is 14 and 9, enough to act on'] },
      skeptic: { vote: 'reject', reasons: ['The verse length test already measures this; a swap blurs its arms'] } },
    approved: true, result: { ok: true, id: 'act-7781', summary: 'Tomorrow\'s 08:00 reel is now 2:255 (31 s) instead of 18:10 (58 s).', undo: { kind: 'lineup-restore' } } },
  { id: 'i2', action: 'insights.refresh', tier: 'R2', why: 'The numbers were 26 hours old.', expectedEffect: 'Fresh numbers for tomorrow\'s plan', metric: 'reach.total',
    council: [{ role: 'guardian', vote: 'approve', reasons: ['It only reads'] }, { role: 'auditor', vote: 'approve', reasons: ['26 hours appears in the evidence'] }, { role: 'skeptic', vote: 'approve', reasons: ['Cheap, and the plan needs it'] }],
    approved: true, result: { ok: true, id: 'act-7782', summary: 'Read 62 posts again.', undo: { kind: 'noop' } } },
  { id: 'i3', action: 'experiment.stop', tier: 'R2', why: 'One day of the long arm reached more people.', expectedEffect: 'A verdict sooner', metric: 'reach.total',
    council: { guardian: { vote: 'reject', reasons: ['Stopping a test after one day to chase one number is not honest measurement'] }, auditor: { vote: 'approve', reasons: ['The number is in the evidence'] } },
    approved: false, result: {} },
  { id: 'i4', action: 'chronicle.note', tier: 'R1', why: 'Record what moved this week', result: { ok: true, id: 'act-7783', summary: 'Noted in the chronicle.', undo: { kind: 'delete-note' } } }
] } };
const EVOLUTION = st => ({ ok: true,
  playbook: { version: 4, lessons: [
    { id: 'l1', text: 'Lead a verse reel with the verse itself, never a title card', why: 'Watched share rose 6 points over 20 reels', from: 'c-20260915', at: '2026-09-15T05:00:00Z' },
    { id: 'l2', text: 'Post the morning reel at 08:00 UTC, not 07:00', why: 'Reach was a third higher across 4 weeks', from: 'c-20260908', at: '2026-09-08T05:00:00Z' },
    { id: 'l3', text: 'Keep a Name card to one line of meaning', why: 'Saves doubled when the meaning fit one line', from: 'c-20260901', at: '2026-09-01T05:00:00Z' }
  ] },
  proposals: [
    { id: 'p1', kind: 'add', lesson: { text: 'Prefer reciters with a slower pace for verses over 40 words', why: 'Watched share 9 points higher over 11 reels' }, status: 'pending', eval: { passed: 7, total: 7, ok: true } },
    { id: 'p2', kind: 'retire', text: 'Post the word card at 16:00', why: 'The word card reached fewer people at 16:00 than at 12:00', status: 'refused',
      eval: { passed: 6, total: 7, ok: false, failures: [{ case: 'a post beyond the schedule', reason: 'the candidate playbook let the Guardian approve an extra post' }] } }
  ],
  upgrades: [
    { id: 'u1', title: 'A watch time column on the Observatory scoreboard', why: 'Attention is a goal, and the scoreboard does not show it', spec: 'Add watched share (median, 7 days) per network to obsSummary, from the insights learn block.',
      metric: 'attention.watchedShare', expectedEffect: 'The owner sees attention beside reach', priority: 'high', status: st.u1, at: '2026-09-28T05:10:00Z' },
    { id: 'u2', title: 'Read Telegram channel views from the public preview', why: 'Telegram is the one network with no number', metric: 'reach.telegram', expectedEffect: 'A fifth network counted', priority: 'medium', status: 'building', at: '2026-09-21T05:10:00Z' },
    { id: 'u3', title: 'Retry a failed reel upload once after 10 minutes', why: 'Two reels failed and were not retried', priority: 'low', status: 'shipped', at: '2026-09-14T05:10:00Z' }
  ] });
const KINDS = ['cycle', 'action', 'council', 'snapshot', 'report'];
const AUDIT = { ok: true, chainOk: true, items: Array.from({ length: 50 }, (_, i) => ({
  at: new Date(END + 5 * 3600000 - i * 1800000).toISOString(), kind: KINDS[i % 5], actor: i % 5 === 1 ? 'hands' : 'mind',
  summary: ['A daily cycle began', 'Swapped the 08:00 reel for 2:255', 'The council approved 2 of 3 intents', 'Took the day\'s snapshot', 'Wrote the chronicle entry'][i % 5],
  data: {}, prev: 'h' + (i + 1), hash: 'h' + i })) };

/* the instruments, in the shapes the door sends (SOUL.md section 11) */
const TSERIES = (n, a, b) => Array.from({ length: n }, (_, i) => ({ date: isoDay(END - (n - 1 - i) * 86400000), value: Math.round(a + b * i) }));
const INST = {
  scorecard: w => {
    const weeks = ['2026-W40', '2026-W39', '2026-W38'];
    const wk = weeks.includes(w) ? w : weeks[0];
    const k = weeks.indexOf(wk);
    return { ok: true, week: wk, weeks, scorecard: { week: wk, from: ['2026-09-28', '2026-09-21', '2026-09-14'][k], to: ['2026-10-04', '2026-09-27', '2026-09-20'][k], builtAt: '2026-10-05T05:21:00Z', builtOn: '2026-10-05',
      northStar: { path: 'northStar', label: 'people reached this week', value: 31200 - 1500 * k, weekAgo: 29700 - 1500 * k, delta: 1500, deltaPct: 5.1, trend4w: [26700, 28200, 29700, 31200] },
      metrics: [
        { path: 'reach.instagram', label: 'Instagram reach', value: 21000, weekAgo: 20000, delta: 1000, deltaPct: 5, trend4w: [18000, 19000, 20000, 21000] },
        { path: 'site.searchShare', label: 'search share of arrivals', value: 0.12, weekAgo: 0.11, delta: 0.01, deltaPct: 9.1, trend4w: [0.09, 0.1, 0.11, 0.12] },
        { path: 'output.health', label: 'posting health', value: 0.97, weekAgo: 0.99, delta: -0.02, deltaPct: -2, trend4w: [0.98, 0.99, 0.99, 0.97] },
        { path: 'spend.usd', label: 'paid model spend this month', value: null, weekAgo: null, delta: null, deltaPct: null, trend4w: [null, null, null, null] }
      ],
      goals: [{ id: 'g-reach', status: 'behind', outcome: 'Double the north star' }, { id: 'g-health', status: 'met', outcome: 'Posting health' }, { id: 'g-test', status: 'no-data', outcome: 'The verse length test' }],
      posts: { top: [{ title: 'The Throne verse', kind: 'reel:verse', reach: 4210 }], bottom: [{ title: 'At dawn', kind: 'reel:light', reach: 310 }] },
      actions: { count: 4, list: [] }, effects: { helped: 2, hurt: 1, unclear: 1, total: 4, list: [] },
      anomalies: [{ date: '2026-10-01', kind: 'visitors spike', label: 'site visitors this week', severity: 'notable', sentence: 'site visitors this week rose to 980 against a 28 day median of 420 (+133 percent)' }],
      search: { score: 84, sampled: 25, failing: 6 }, speed: { score: 71, pages: [] }, youtube: { subscribers: 1520, views: 284000, videos: 412, benchmarks: 2 },
      radar: { signals: ['"quran explained": the top 5 videos of the last 30 days hold 4200000 views; the house\'s shelves that answer it: verse, know'] },
      coverage: { minRunwayDays: 14, low: ['word'] }, spend: { usd: 3.42, capUsd: 10 } } };
  },
  trajectories: { ok: true, date: '2026-10-02', driftDays: 7, items: [
    { id: 'g-reach', owner: 'owner', outcome: 'Double the north star within 12 weeks', metric: 'northStar', target: 62400, due: '2026-12-25', value: 31200, points: 28, slopePerDay: 150, projected: 43650, eta: '2027-03-10', status: 'behind', confidence: 'good', note: 'from 28 daily readings', series: TSERIES(28, 27150, 150), behindStreak: 9, drift: true },
    { id: 'g-health', owner: 'owner', outcome: 'Posting health at least 98 percent every week', metric: 'output.health', target: 0.98, due: '2026-10-02', value: 0.99, points: 20, slopePerDay: 0, projected: null, eta: null, status: 'met', confidence: 'good', note: 'from 20 daily readings', series: TSERIES(20, 0, 0).map(x => ({ date: x.date, value: 0.99 })), behindStreak: 0, drift: false },
    { id: 'g-test', owner: 'soul', outcome: 'Run the verse length test to a verdict', metric: 'learning.experiment', target: 'verdict', due: null, value: null, points: 0, slopePerDay: null, projected: null, eta: null, status: 'no-data', confidence: 'none', note: 'not a numeric goal; its own status says how it stands', series: [], behindStreak: 0, drift: false }
  ] },
  effects: { ok: true, days: 7, pending: 2, summary: { helped: 2, hurt: 1, unclear: 1, total: 4 }, items: [
    { action: 'lineup-swap', metric: 'northStar', date: '2026-09-24', before: 29000, after: 30600, delta: 1600, baselineDelta: 600, verdict: 'helped' },
    { action: 'insights-refresh', metric: 'northStar', date: '2026-09-23', before: 28800, after: 29100, delta: 300, baselineDelta: 600, verdict: 'hurt' },
    { action: 'lineup-skip', metric: 'attention.watchedMedian', date: '2026-09-22', before: 0.41, after: 0.44, delta: 0.03, baselineDelta: 0, verdict: 'helped' },
    { action: 'experiment-plan', metric: 'learning.experiment', date: '2026-09-21', before: null, after: null, delta: null, baselineDelta: null, verdict: 'unclear' }
  ] },
  search: { ok: true, lastTry: { ok: true, date: '2026-09-28', week: '2026-W40' }, history: [],
    audit: { ok: true, date: '2026-09-28', week: '2026-W40', sitemapUrls: 608, sampled: 25, reached: 25, score: 84, passed: 19,
      counts: { status: 1, title: 0, description: 3, canonical: 1, structured: 2, words: 2, indexable: 0, unreachable: 0 },
      failures: [{ url: 'https://noorcodex.com/dictionary/sabr-and-a-very-long-word-that-must-wrap-on-a-phone', fails: ['no meta description', 'thin: 64 words'] }, { url: 'https://noorcodex.com/kids/old', fails: ['status 404'] }] },
    indexnow: { keySet: true, verified: '2026-09-28', pending: 208, submittedToday: 100, perDay: 100, last: { date: '2026-10-02', submitted: 100, status: 200 } } },
  speed: { ok: true, lastTry: { ok: true }, history: [], speed: { ok: true, date: '2026-09-28', week: '2026-W40', strategy: 'mobile', score: 71, pages: [
    { name: 'home', url: 'https://noorcodex.com/', ok: true, score: 88, lcpMs: 2412, cls: 0.02, inpMs: 160 },
    { name: 'quran', url: 'https://noorcodex.com/quran', ok: true, score: 54, lcpMs: 4810, cls: 0.12, inpMs: null },
    { name: 'light', url: 'https://noorcodex.com/light/abdurrahman-ibn-awf-market', ok: true, score: 71, lcpMs: 3100, cls: 0.05, inpMs: 210 },
    { name: 'word', url: 'https://noorcodex.com/dictionary/sabr', ok: false, why: 'PageSpeed answered http 500' }] } },
  youtube: { ok: true, unitsPerDay: 250, lastTry: { ok: true }, history: [], benchmarks: ['UCaaaaaaaaaaaaaaaaaaaaaa', 'UCbbbbbbbbbbbbbbbbbbbbbb'],
    youtube: { ok: true, date: '2026-09-28', week: '2026-W40', house: { subscribers: 1520, views: 284000, videos: 412, hiddenSubscribers: false },
      benchmarks: [{ id: 'UCaaaaaaaaaaaaaaaaaaaaaa', title: 'A benchmark channel', subscribers: 182000, views: 9100000, videos: 640 }, { id: 'UCbbbbbbbbbbbbbbbbbbbbbb', title: 'Another', subscribers: null, views: 120000, videos: 88, hiddenSubscribers: true }], note: null, units: 2 } },
  radar: { ok: true, lastTry: { ok: true, complete: true }, progress: { week: '2026-W40', done: 8, of: 8 }, queries: [],
    radar: { ok: true, week: '2026-W40', windowDays: 30, byKind: { verse: 4200000 }, signals: [],
      rising: ['quran explained', 'what is islam', 'prophet stories', 'islamic history', 'ramadan', 'jesus in islam', 'names of allah', 'dua'].map((q, i) => ({ query: q, views: 4200000 - i * 450000, ok: true,
        kinds: [['verse', 'know'], ['know'], ['light'], ['light'], ['know'], ['light'], ['name'], ['dua']][i], videos: [{ title: q + ': a public title', views: 900000 - i * 9000 }] })) } },
  coverage: { ok: true, minDays: 30, coverage: { ok: true, date: '2026-10-02', week: '2026-W40', minRunwayDays: 14, low: ['word'], total: 1509, postedTotal: 420,
    kinds: [{ kind: 'word', cards: 422, posted: 404, remaining: 18, perWeek: 9, runwayDays: 14, low: true, note: null },
      { kind: 'verse', cards: 593, posted: 120, remaining: 473, perWeek: 19, runwayDays: 174, low: false, note: null },
      { kind: 'day', cards: 21, posted: 2, remaining: 19, perWeek: 0, runwayDays: null, low: false, note: 'dated: each card has its own Hijri day' }] } }
};
const INST_EMPTY = {
  scorecard: { ok: true, week: null, scorecard: null, weeks: [] }, trajectories: { ok: true, items: [], driftDays: 7 },
  effects: { ok: true, items: [], summary: { helped: 0, hurt: 0, unclear: 0, total: 0 }, pending: 0, days: 7 },
  search: { ok: true, audit: null, lastTry: null, history: [], indexnow: { keySet: false, verified: null, pending: null, submittedToday: 0, perDay: 100, last: null } },
  speed: { ok: true, speed: null, lastTry: null, history: [] },
  youtube: { ok: true, youtube: null, lastTry: { ok: false, why: 'no YouTube credentials on this deployment (YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN)', date: '2026-10-02', week: '2026-W40' }, history: [], benchmarks: [], unitsPerDay: 250 },
  radar: { ok: true, radar: null, lastTry: null, progress: { week: '2026-W40', done: 0, of: 8 }, queries: [] },
  coverage: { ok: true, coverage: null, minDays: 30 }
};
const INST_VIEWS = ['scorecard', 'trajectories', 'effects', 'search', 'speed', 'youtube', 'radar', 'coverage'];

/* the first day: the soul exists, nothing has run */
const EMPTY = {
  today: { ok: true, paused: false, mission: MISSION, northStar: { value: null, weekAgo: null, series: [] }, goals: [], lastCycle: null,
    spend: { month: '2026-10', usd: 0, capUsd: 10 }, counts: { actionsToday: 0, capToday: 6 }, telegram: { linked: false } },
  metrics: { ok: true, series: [] }, chronicle: { ok: true, items: [] },
  evolution: { ok: true, playbook: { version: 1, lessons: [] }, proposals: [], upgrades: [] }, audit: { ok: true, items: [], chainOk: true }
};

/* ---------------------------------------------------------------- the page */
async function open_(w, h, opts = {}) {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, colorScheme: opts.scheme || 'dark', reducedMotion: 'reduce' });
  const pg = await ctx.newPage();
  const st = { paused: false, linked: false, goals: JSON.parse(JSON.stringify(GOALS)), u1: 'proposed', tgChecks: 0, posted: [], gets: [], errors: [] };
  pg.on('pageerror', e => st.errors.push(String(e)));
  pg.on('console', m => { if (m.type() === 'error') st.errors.push(m.text()); });
  if (opts.mode !== 'error') pg.on('response', r => { if (r.status() >= 400) st.errors.push(r.status() + ' ' + r.url()); });
  const J = (b, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(b) });
  await pg.route('**/*', r => {
    const q = r.request(), u = q.url();
    if (u.includes('/api/soul')) {
      if (opts.mode === 'error') return r.fulfill(J({ ok: false, error: 'store unreachable' }, 503));
      if (q.method() === 'POST') {
        const b = JSON.parse(q.postData() || '{}'); st.posted.push(b);
        if (b.action === 'pause') { st.paused = true; return r.fulfill(J({ ok: true, paused: true })); }
        if (b.action === 'resume') { st.paused = false; return r.fulfill(J({ ok: true, paused: false })); }
        if (b.action === 'run') return r.fulfill(J(st.busyRun ? { ok: true, busy: true, ran: false, message: 'A cycle is already running.' } : { ok: true, id: 'c-20261002b' }));
        if (b.action === 'undo') return r.fulfill(J({ ok: true, undone: b.id }));
        if (b.action === 'goal') { st.goals = st.goals.map(g => g.id === b.goal.id ? { ...g, ...b.goal } : g); return r.fulfill(J({ ok: true, goal: b.goal })); }
        if (b.action === 'upgrade') { if (b.id === 'u1') st.u1 = b.status; return r.fulfill(J({ ok: true })); }
        if (b.action === 'tg-code') return r.fulfill(J({ ok: true, code: 'NOOR-4821', bot: '@NoorHouseBot', expiresAt: '2026-10-02T06:04:00Z' }));
        if (b.action === 'tg-link') { st.tgChecks++; if (st.tgChecks === 1) return r.fulfill(J({ ok: true, linked: false })); st.linked = true; return r.fulfill(J({ ok: true, linked: true })); }
        if (b.action === 'tg-test') return r.fulfill(J({ ok: true, sent: true }));
        if (b.action === 'benchmarks') return r.fulfill(J({ ok: true, ids: b.ids }));
        return r.fulfill(J({ ok: false, error: 'unknown action' }, 400));
      }
      const view = new URL(u).searchParams.get('view');
      /* round nine: the console's Needs you reads the house on every screen; this room's own reads are what is counted here */
      if (view === 'needs') return r.fulfill(J({ ok: true, at: new Date().toISOString(), count: 0, planning: false, items: [] }));
      st.gets.push(u.replace(BASE, ''));
      if (opts.mode === 'real') {
        const wk = new URL(u).searchParams.get('week');
        const file = view === 'scorecard' && wk === '2026-W40' ? 'scorecard-W40' : view;
        try { return r.fulfill(J(JSON.parse(readFileSync(path.join(opts.dir, file + '.json'), 'utf8')))); }
        catch { return r.fulfill(J({ ok: false, error: 'no such view' }, 400)); }
      }
      if (INST_VIEWS.includes(view)) {
        if (opts.mode === 'empty') return r.fulfill(J(INST_EMPTY[view]));
        return r.fulfill(J(view === 'scorecard' ? INST.scorecard(new URL(u).searchParams.get('week')) : INST[view]));
      }
      if (opts.mode === 'empty') return r.fulfill(J(view === 'metrics' ? EMPTY.metrics : view === 'chronicle' ? EMPTY.chronicle : view === 'evolution' ? EMPTY.evolution : view === 'audit' ? EMPTY.audit : EMPTY.today));
      if (view === 'today') return r.fulfill(J(TODAY(st)));
      if (view === 'metrics') return r.fulfill(J(METRICS(parseInt(new URL(u).searchParams.get('days') || '90', 10))));
      if (view === 'chronicle') return r.fulfill(J(CHRONICLE));
      if (view === 'cycle') return r.fulfill(J(CYCLE));
      if (view === 'evolution') return r.fulfill(J(EVOLUTION(st)));
      if (view === 'audit') return r.fulfill(J(AUDIT));
      return r.fulfill(J({ ok: false, error: 'no such view' }, 400));
    }
    if (u.includes('/api/admin-data')) return r.fulfill(J({ store: true, storeKind: 'redis', lanternConfigured: true, lanternModel: 'x/inkling:free', activeCount: 4, gifts: {} }));
    if (u.includes('/api/settings')) return r.fulfill(J({ ok: true, store: true, dials: [] }));
    if (u.includes('/api/journal') && q.method() === 'POST') return r.fulfill(J({ queue: [] }));
    if (u.includes('/api/')) return r.fulfill(J({ ok: true }));
    if (u.startsWith(BASE)) return r.continue();
    if (u.includes('fonts.g')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.abort();
  });
  await pg.goto(BASE + '/admin2.html' + (opts.hash ?? '#soul'), { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#app.on', { timeout: 15000 });
  if ((opts.hash ?? '#soul') === '#soul') await pg.waitForSelector(opts.mode === 'error' ? '#s-engine.on .soul-err' : '#s-engine.on #soul-head', { timeout: 15000 });
  await pg.waitForTimeout(300);
  return { pg, st, ctx };
}
const noSideScroll = pg => pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const text = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const toastSays = pg => pg.evaluate(() => document.getElementById('toast').textContent);
const settle = pg => pg.waitForTimeout(350);

/* ============================================================ full, desk */
for (const [label, w, h] of [['desk 1440', 1440, 900], ['phone 390', 390, 844]]) {
  const tag = w > 600 ? 'desk-1440' : 'phone-390';
  console.log('\n' + label + ' · every section draws from the route');
  const { pg, st, ctx } = await open_(w, h);
  ok(await pg.evaluate(() => document.getElementById('title').textContent) === 'The engine room', 'the top bar names the room: The engine room');
  ok(await pg.evaluate(() => location.hash) === '#engine', 'the old #soul lands at #engine');
  ok(await pg.evaluate(() => { const b = document.querySelector('#s-engine .back'); return !!b && b.textContent === 'More'; }), 'a way back to More sits at the top');
  ok(await pg.evaluate(() => document.querySelector('nav.bar [data-s="more"]').classList.contains('on')), 'the bar lights More, the door it is behind');
  const views = st.gets.map(g => new URL('http://x' + g).searchParams.get('view'));
  ok(['today', 'metrics', 'chronicle', 'evolution', 'audit'].every(v => views.includes(v)), 'it reads today, metrics, chronicle, evolution and audit');
  ok(st.gets.some(g => /view=metrics&days=90/.test(g)), 'the north star line asks for 90 days of metrics');

  // 1. header
  const head = await text(pg, '#soul-head');
  ok(head.includes(MISSION), 'the mission is the header\'s line');
  ok(await pg.evaluate(() => document.getElementById('soul-state').textContent) === 'Needs you', 'the status chip says Needs you when the last cycle asks for him');
  ok(/2 of 6 public actions today/.test(head), 'today\'s action count against the cap');
  // 2. north star
  ok((await text(pg, '#soul-ns-value')) === NS.toLocaleString('en-US'), 'the big number is the route\'s north star: ' + NS.toLocaleString('en-US'));
  const pct = Math.round(Math.abs((NS - NS_WA) / NS_WA * 100) * 10) / 10;
  const delta = await text(pg, '#soul-ns-delta');
  ok(delta.includes((NS >= NS_WA ? '↑ ' : '↓ ') + pct + '%') && delta.includes(NS_WA.toLocaleString('en-US')), 'the change on a week ago, arrow and percent: ' + delta);
  ok(await pg.evaluate(() => document.querySelectorAll('#soul-nsc .soul-ch svg .hx').length) === 90, 'the line carries 90 days, one hover target each');
  const svgW = await pg.evaluate(() => { const s = document.querySelector('#soul-nsc .soul-ch svg'); return [s.getBoundingClientRect().width, +s.getAttribute('width')]; });
  ok(Math.abs(svgW[0] - svgW[1]) <= 1, 'the chart is drawn at its own pixel width, never stretched (' + svgW.join(' / ') + ')');
  const mid = await pg.$('#soul-nsc .hx:nth-of-type(60) rect');
  await mid.hover({ force: true });
  await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => getComputedStyle(document.querySelector('#soul-nsc .hx:nth-of-type(60) .gd')).opacity === '1'), 'a hovered day shows its guide line and dot');
  await pg.screenshot({ path: SHOTS + '/' + tag + '-dark-northstar-hover.png', clip: await pg.evaluate(() => { const r = document.getElementById('soul-nsc').getBoundingClientRect(); return { x: 0, y: r.y + scrollY, width: innerWidth, height: r.height }; }) }).catch(() => {});
  const hx = await pg.$('#soul-nsc .hx:last-of-type rect');
  await hx.hover({ force: true });
  await pg.waitForTimeout(150);
  const tip = await pg.evaluate(() => { const t = document.getElementById('obs-tip'); return t.classList.contains('on') ? t.innerText : ''; });
  ok(tip.includes('2 Oct 2026') && tip.includes(NS.toLocaleString('en-US')), 'hovering the last day shows its date and value: ' + tip.replace(/\n/g, ' '));
  await pg.mouse.move(1, 1);
  // 3. goals
  ok(await pg.evaluate(() => document.querySelectorAll('#soul-goals .soul-goal').length) === 5, 'one row per goal');
  ok(await pg.evaluate(() => document.querySelectorAll('#soul-goals [data-soul-edit]').length) === 4, 'the four owner goals can be edited, the soul\'s cannot');
  const reachRow = await text(pg, '#soul-goal-g-reach');
  ok(/yours/.test(reachRow) && /on track/.test(reachRow) && /25 Dec 2026/.test(reachRow), 'a goal row carries its owner, status and due date');
  ok(/the Lantern's/.test(await text(pg, '#soul-goal-g-test')), 'the house\'s own goal is tagged as the Lantern\'s');
  ok(/41%/.test(await text(pg, '#soul-goal-g-attention')) && /46%/.test(await text(pg, '#soul-goal-g-attention')), 'a share kept as a fraction reads as a percent');
  const bw = await pg.evaluate(() => document.querySelector('#soul-goal-g-attention .bar2 i').style.width);
  ok(bw === '50%', 'the progress bar runs from baseline to target (0.36 to 0.46, now 0.41, is 50%): ' + bw);
  // 4. today
  ok(await pg.evaluate(() => document.querySelectorAll('#soul-today .soul-col').length) === 3, 'Done, Next and Needs you');
  ok(await pg.evaluate(() => !!document.querySelector('#soul-today .soul-col.you li')), 'the needs-you column is the marked one');
  ok((await text(pg, '#soul-today .soul-col.you')).includes('page token'), 'and it says what he must do');
  // 5. metrics
  ok(await pg.evaluate(() => document.querySelectorAll('#soul-metrics .viz').length) === 3, 'three small-multiple cards: reach, the site, attention and spend');
  ok(await pg.evaluate(() => document.querySelectorAll('#soul-metrics .trendp').length) === 13, 'thirteen panels, one line each');
  ok(/the Bot API does not report channel views/.test(await text(pg, '#soul-v-reach')), 'a source recorded as null says why instead of drawing a zero');
  // 6. chronicle
  ok(await pg.evaluate(() => document.querySelectorAll('#soul-chron details.fold').length) === 4, 'every cycle in the chronicle');
  ok(await pg.evaluate(() => document.querySelector('#soul-chron details.fold').open && /2 Oct/.test(document.querySelector('#soul-chron summary').innerText)), 'newest first, and the newest is open');
  // 7. evolution
  const evo = await text(pg, '#soul-evo');
  ok(/version 4/.test(evo) && /3 lessons/.test(evo), 'the playbook, its version and its lessons');
  ok(/7 of 7 canaries passed/.test(evo) && /6 of 7 canaries passed/.test(evo) && /candidate playbook let the Guardian/.test(evo), 'each proposal carries its eval result and why it failed');
  ok(await pg.evaluate(() => document.querySelectorAll('#soul-evo select[data-soul-up]').length) === 3, 'every upgrade has a status control');
  // 8. budget
  const bud = await text(pg, '#soul-budget');
  ok(/\$3\.42/.test(bud) && /of \$10\.00/.test(bud) && /34%/.test(bud) && /Oct 2026/i.test(bud), 'spend against the cap, as a meter');
  // 9. voice, 10. audit
  ok(/is not linked/.test(await text(pg, '#soul-voice')), 'Telegram says it is not linked');
  ok(await pg.evaluate(() => document.getElementById('soul-chain').textContent) === 'chain intact', 'the audit chain chip');
  ok(await pg.evaluate(() => document.querySelectorAll('#soul-audit .soul-au .e').length) === 50, 'the last 50 audit entries');
  // 11. the instruments
  ok(INST_VIEWS.every(v => views.includes(v)), 'it reads every instrument view: ' + INST_VIEWS.join(', '));
  ok(await pg.evaluate(() => document.querySelectorAll('#soul-inst .soul-ic').length) === 8 && await pg.evaluate(() => !document.querySelector('#soul-inst .soul-err')), 'eight instrument cards, none in error');
  ok((await text(pg, '#soul-week-ns')) === '31,200' && /5\.1% on the week before/.test(await text(pg, '#soul-i-week')), 'Week: the north star and its change on the week before');
  ok(await pg.evaluate(() => document.querySelectorAll('#soul-week-metrics .soul-row').length) === 4 && await pg.evaluate(() => document.querySelectorAll('#soul-i-week svg.soul-b4').length) >= 4, 'each metric with its delta and a four week bar');
  const wtext = await text(pg, '#soul-i-week');
  ok(/12%/.test(wtext) && /-2%/.test(wtext) && /g-reach behind/.test(wtext) && /The Throne verse/.test(wtext) && /visitors spike/.test(wtext) && /2 helped, 1 hurt, 1 unclear/.test(wtext) && /search readiness 84 of 100/.test(wtext) && /\$3\.42 of \$10\.00/.test(wtext), 'goals, posts, actions and effects, anomalies, instruments and spend');
  ok(await pg.evaluate(() => document.querySelectorAll('#soul-week-sel option').length) === 3, 'the earlier weeks are selectable');
  ok(await pg.evaluate(() => document.querySelectorAll('#soul-i-traj .soul-tj').length) === 3 && await pg.evaluate(() => document.querySelectorAll('#soul-i-traj svg').length) === 2, 'Trajectories: a row per goal, a line where there are readings');
  ok(await pg.evaluate(() => document.querySelector('#soul-tj-g-reach svg').querySelectorAll('line[stroke-dasharray]').length) === 2, 'the fitted line and the target, dashed');
  const tj = await text(pg, '#soul-tj-g-reach');
  ok(/behind/.test(tj) && /drifting 9 days/.test(tj) && /43,650/.test(tj) && /10 Mar 2027/.test(tj) && /Confidence good/.test(tj), 'with its status, its drift, where it lands, when it gets there');
  ok(/no data yet/.test(await text(pg, '#soul-tj-g-test')) && /no line to draw/.test(await text(pg, '#soul-tj-g-test')), 'a goal with no reading says so');
  const tsv = await pg.evaluate(() => { const s = document.querySelector('#soul-tj-g-reach svg'); return [s.getBoundingClientRect().width, +s.getAttribute('width')]; });
  ok(Math.abs(tsv[0] - tsv[1]) <= 1, 'drawn at its own pixel width');
  const eff = await text(pg, '#soul-i-eff');
  ok(/2 helped/.test(eff) && /2 waiting/.test(eff) && await pg.evaluate(() => document.querySelectorAll('#soul-i-eff .soul-row').length) === 4 && /29,000 to 30,600/.test(eff) && /usually \+600/.test(eff), 'What worked: the verdicts, the change and the usual change');
  const se = await text(pg, '#soul-i-search');
  ok((await text(pg, '#soul-search-score')) === '84' && /19 of 25 pages clean/.test(se) && /22 of 25/.test(se) && /208 changed pages waiting/.test(se) && /100 of 100 offered today/.test(se), 'Search readiness: the score, each check, the IndexNow queue');
  const sp = await text(pg, '#soul-i-speed');
  ok((await text(pg, '#soul-speed-score')) === '71' && /LCP 2\.4 s/.test(sp) && /INP 160 ms/.test(sp) && /INP not in the field data/.test(sp) && /http 500/.test(sp), 'Page speed: the median, each page, a failed page in words');
  const yt = await text(pg, '#soul-i-yt');
  ok((await text(pg, '#soul-yt-subs')) === '1,520' && /A benchmark channel/.test(yt) && /hidden/.test(yt), 'YouTube: the house and the benchmarks, a hidden count in words');
  ok(await pg.evaluate(() => document.querySelectorAll('#soul-i-radar .soul-row').length) === 8 && /8 of 8 searches/.test(await text(pg, '#soul-i-radar')) && await pg.evaluate(() => document.querySelectorAll('#soul-i-radar .pill.blue').length) >= 8, 'Topic radar: eight searches, mapped to the shelves');
  ok(/Under 30 days left: word/.test(await text(pg, '#soul-i-cov')) && /dated/.test(await text(pg, '#soul-i-cov [data-kind="day"]')), 'Coverage: the short shelf flagged, the dated one explained');
  await pg.screenshot({ path: SHOTS + '/' + tag + '-dark-instruments.png', fullPage: true, clip: await pg.evaluate(() => { const r = document.getElementById('soul-inst').getBoundingClientRect(); return { x: 0, y: r.y + scrollY, width: innerWidth, height: Math.min(r.height, 6000) }; }) }).catch(() => {});
  ok(await noSideScroll(pg), 'nothing scrolls sideways at ' + w + 'px');
  ok(!DASH.test(await pg.evaluate(() => document.getElementById('s-engine').innerText)), 'no em or en dash anywhere the room prints');
  await pg.screenshot({ path: SHOTS + '/' + tag + '-dark-full.png', fullPage: true });

  console.log(label + ' · the window selector');
  await pg.click('[data-soul-days="30"]'); await settle(pg);
  ok(st.gets.some(g => /view=metrics&days=30/.test(g)), '30 days asks the route for 30 days');
  ok(await pg.evaluate(() => document.querySelectorAll('#soul-v-reach .soul-ch svg')[0].querySelectorAll('.hx').length) === 30, 'and the panels draw 30 days');
  await pg.click('[data-soul-days="365"]'); await settle(pg);
  ok(st.gets.some(g => /view=metrics&days=365/.test(g)), '365 days asks for a year');
  ok(await pg.evaluate(() => document.querySelectorAll('#soul-v-reach .soul-ch svg')[0].querySelectorAll('.hx').length) === 140, 'and draws every day the store holds (140)');
  await pg.click('#soul-v-site [data-tv]'); await settle(pg);
  ok(await pg.evaluate(() => !document.querySelector('#soul-v-site .vtb').hidden && document.querySelectorAll('#soul-v-site .vtb tbody tr').length === 140), 'the Table twin lists every day');
  ok(await noSideScroll(pg), 'the table does not widen the page');
  await pg.click('#soul-v-site [data-tv]'); await settle(pg);
  ok(await pg.evaluate(() => !!document.querySelector('#soul-v-site .soul-ch svg')), 'and Chart brings the picture back');
  await pg.click('[data-soul-days="90"]'); await settle(pg);

  console.log(label + ' · pause asks in the card, then posts');
  await pg.click('[data-soul="pause-ask"]'); await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => !!document.getElementById('soul-confirm')), 'Pause asks first, inside the card');
  ok(!st.posted.some(b => b.action === 'pause'), 'and nothing is posted before the yes');
  await pg.click('[data-soul="confirm-no"]'); await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => !document.getElementById('soul-confirm') && !!document.querySelector('[data-soul="pause-ask"]')), 'Never mind puts the buttons back');
  await pg.click('[data-soul="pause-ask"]'); await pg.waitForTimeout(100);
  await pg.click('[data-soul="pause-yes"]'); await settle(pg);
  const pz = st.posted.filter(b => b.action === 'pause');
  ok(pz.length === 1 && JSON.stringify(pz[0]) === '{"action":"pause"}', 'Yes, pause posts exactly {action:"pause"}');
  await pg.waitForFunction(() => (document.getElementById('soul-state') || {}).textContent === 'Paused', null, { timeout: 5000 }).catch(() => {});
  ok(await pg.evaluate(() => document.getElementById('soul-state').textContent) === 'Paused', 'the chip now reads Paused');
  ok(await pg.evaluate(() => document.querySelector('[data-soul="run"]').disabled && !!document.querySelector('[data-soul="resume-ask"]')), 'Run is held while paused and Resume is offered');
  if (w < 600) await pg.screenshot({ path: SHOTS + '/' + tag + '-dark-paused-head.png' });
  await pg.click('[data-soul="resume-ask"]'); await pg.waitForTimeout(100);
  await pg.click('[data-soul="resume-yes"]'); await settle(pg);
  ok(st.posted.some(b => JSON.stringify(b) === '{"action":"resume"}'), 'Yes, resume posts exactly {action:"resume"}');
  await pg.waitForFunction(() => (document.getElementById('soul-state') || {}).textContent === 'Needs you', null, { timeout: 5000 }).catch(() => {});
  await pg.click('[data-soul="run"]'); await settle(pg);
  ok(st.posted.some(b => JSON.stringify(b) === '{"action":"run"}'), 'Run a cycle now posts exactly {action:"run"}');
  ok(/A cycle has started/.test(await toastSays(pg)), 'and says so');
  st.busyRun = true;
  await pg.waitForSelector('[data-soul="run"]:not([disabled])', { timeout: 5000 }).catch(() => {});
  await pg.click('[data-soul="run"]'); await settle(pg);
  ok(/A cycle is already running\./.test(await toastSays(pg)), 'a Run while a tick holds the lock says a cycle is already running');
  st.busyRun = false;

  console.log(label + ' · the cycle in full, and Undo');
  await pg.click('#soul-today [data-soul-cycle]');
  await pg.waitForSelector('#sheet.on .soul-int', { timeout: 5000 });
  ok(st.gets.some(g => /view=cycle&id=c-20261002/.test(g)), 'Open the cycle reads view=cycle with its id');
  ok(await pg.evaluate(() => document.querySelectorAll('#sheet .soul-int').length) === 4, 'every intent is shown');
  const first = await text(pg, '#sheet .soul-int');
  ok(/Verse reels under 30 seconds/.test(first) && /Watched share on the 08:00 slot/.test(first), 'each intent with its why and its expected effect');
  ok(/Guardian/.test(first) && /Auditor/.test(first) && /Skeptic/.test(first) && /blurs its arms/.test(first), 'the three verdicts with their votes and reasons');
  ok(await pg.evaluate(() => document.querySelectorAll('#sheet .soul-int')[0].querySelectorAll('.soul-cn .v').length) === 3, 'three council rows on a reviewed intent');
  ok(/did not answer/.test(await pg.evaluate(() => document.querySelectorAll('#sheet .soul-int')[2].innerText)), 'a reviewer that did not answer is shown as such');
  ok(/2:255/.test(first), 'and the result');
  ok(/This cycle failed: report was cut off 3 times/.test(await text(pg, '#soul-cyc-failed')), 'a failed cycle says why, at the top of the sheet');
  ok(/delete-post/.test(await text(pg, '#soul-cyc-dropped')) && /red line/.test(await text(pg, '#soul-cyc-dropped')), 'and what was refused at the red line before any review');
  ok(await pg.evaluate(() => document.querySelectorAll('#sheet [data-soul-undo]').length) === 2, 'Undo only where the action has an undo (not on a noop, not on what never ran)');
  await pg.screenshot({ path: SHOTS + '/' + tag + '-dark-cycle-sheet.png' });
  await pg.click('#sheet [data-soul-undo]'); await settle(pg);
  const un = st.posted.filter(b => b.action === 'undo');
  ok(un.length === 1 && un[0].id === 'act-7781', 'Undo posts {action:"undo", id:"act-7781"}: ' + JSON.stringify(un[0] || {}));
  ok(/Undone/.test(await toastSays(pg)), 'and the toast confirms it');
  await pg.waitForSelector('#sheet.on #cl', { timeout: 5000 });
  await pg.click('#sheet #cl'); await pg.waitForTimeout(300);

  console.log(label + ' · a goal edited inline');
  await pg.click('#soul-goal-g-reach [data-soul-edit]'); await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => !!document.querySelector('#soul-goal-g-reach #sg-t')), 'Edit opens the row in place');
  await pg.fill('#sg-t', '60000');
  await pg.fill('#sg-d', '2027-01-15');
  await pg.click('#soul-goal-g-reach [data-soul-save]'); await settle(pg);
  const gp = st.posted.filter(b => b.action === 'goal');
  ok(gp.length === 1 && gp[0].goal.id === 'g-reach' && gp[0].goal.target === 60000 && gp[0].goal.due === '2027-01-15' && gp[0].goal.owner === 'owner' && !('history' in gp[0].goal),
     'Save posts {action:"goal", goal} with the new target and due date');
  await pg.waitForFunction(() => /60,000/.test((document.getElementById('soul-goal-g-reach') || {}).innerText || ''), null, { timeout: 5000 }).catch(() => {});
  ok(/60,000/.test(await text(pg, '#soul-goal-g-reach')) && /15 Jan 2027/.test(await text(pg, '#soul-goal-g-reach')), 'and the row shows what the route now holds');
  await pg.click('#soul-goal-g-attention [data-soul-edit]'); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => document.getElementById('sg-t').value) === '46', 'a share is edited in percent');
  await pg.fill('#sg-t', '50');
  await pg.click('#soul-goal-g-attention [data-soul-save]'); await settle(pg);
  const gp2 = st.posted.filter(b => b.action === 'goal')[1];
  ok(gp2 && gp2.goal.target === 0.5, 'and saved back as the fraction the route keeps (0.5)');

  console.log(label + ' · an upgrade moves');
  await pg.selectOption('#soul-us-u1', 'accepted'); await settle(pg);
  ok(st.posted.some(b => JSON.stringify(b) === '{"action":"upgrade","id":"u1","status":"accepted"}'), 'the status control posts {action:"upgrade", id, status}');

  console.log(label + ' · the instruments: another week, and the benchmark list');
  await pg.selectOption('#soul-week-sel', '2026-W39'); await settle(pg);
  ok(st.gets.some(g => /view=scorecard&week=2026-W39/.test(g)), 'choosing a week reads view=scorecard&week=2026-W39');
  ok(/Week 39, 2026/.test(await text(pg, '#soul-i-week')) && (await text(pg, '#soul-week-ns')) === '29,700', 'and the card shows that week');
  await pg.evaluate(() => { document.querySelector('#soul-bm').open = true; });
  await pg.fill('#soul-bm-ids', 'UCaaaaaaaaaaaaaaaaaaaaaa, UCcccccccccccccccccccccc');
  await pg.click('[data-soul-bm="save"]'); await settle(pg);
  const bm = st.posted.filter(b => b.action === 'benchmarks');
  ok(bm.length === 1 && JSON.stringify(bm[0]) === '{"action":"benchmarks","ids":["UCaaaaaaaaaaaaaaaaaaaaaa","UCcccccccccccccccccccccc"]}', 'Save the list posts exactly {action:"benchmarks", ids}');
  ok(await noSideScroll(pg), 'nothing sideways after the instruments\' actions');

  console.log(label + ' · Telegram, linked by a code');
  await pg.click('[data-soul="tg-code"]'); await settle(pg);
  ok(st.posted.some(b => JSON.stringify(b) === '{"action":"tg-code"}'), 'Link Telegram asks for a code');
  ok((await text(pg, '#soul-tg-code')) === 'NOOR-4821', 'the code is shown, large');
  const steps = await text(pg, '#soul-voice');
  ok(/Open @NoorHouseBot, the NOOR bot, in Telegram/.test(steps) && /Send it this code/.test(steps) && /press Check/.test(steps), 'with the plain steps');
  if (w < 600) await pg.screenshot({ path: SHOTS + '/' + tag + '-dark-telegram-code.png', clip: await pg.evaluate(() => { const r = document.getElementById('soul-voice').getBoundingClientRect(); return { x: 0, y: r.y + scrollY - 10, width: innerWidth, height: r.height + 20 }; }) }).catch(() => {});
  await pg.click('[data-soul="tg-link"]'); await settle(pg);
  ok(st.posted.filter(b => b.action === 'tg-link').length === 1, 'Check posts {action:"tg-link"}');
  ok(/has not seen the code yet/.test(await text(pg, '#soul-voice')) && !!(await text(pg, '#soul-tg-code')), 'a code not yet seen says so and keeps the code up');
  await pg.click('[data-soul="tg-link"]'); await settle(pg);
  await pg.waitForFunction(() => /is linked/.test((document.getElementById('soul-tg-state') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  ok(/is linked/.test(await text(pg, '#soul-tg-state')), 'the second Check links it');
  await pg.click('[data-soul="tg-test"]'); await settle(pg);
  ok(st.posted.some(b => JSON.stringify(b) === '{"action":"tg-test"}'), 'Send a test posts {action:"tg-test"}');
  ok(/Sent/.test(await toastSays(pg)), 'and says it went');

  ok(await noSideScroll(pg), 'still nothing sideways after every action');
  ok(st.errors.length === 0, 'no console error and no failed request: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ the console has one palette */
console.log('\nlight colour scheme · the console keeps its own palette');
for (const [w, h, tag] of [[1440, 900, 'desk-1440'], [390, 844, 'phone-390']]) {
  const { pg, st, ctx } = await open_(w, h, { scheme: 'light' });
  const bg = await pg.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(bg === 'rgb(11, 13, 22)', 'a light-scheme browser still gets the console\'s ink ground (' + bg + '), so every colour keeps its contrast');
  ok(await noSideScroll(pg), 'nothing sideways at ' + w + 'px');
  ok(st.errors.length === 0, 'no console error');
  await pg.screenshot({ path: SHOTS + '/' + tag + '-light-scheme-full.png', fullPage: true });
  await ctx.close();
}

/* ============================================================ the first day */
console.log('\nthe first day · nothing has run yet');
for (const [w, h, tag] of [[1440, 900, 'desk-1440'], [390, 844, 'phone-390']]) {
  const { pg, st, ctx } = await open_(w, h, { mode: 'empty' });
  const all = await pg.evaluate(() => document.getElementById('s-engine').innerText);
  ok(/No cycle has run yet/.test(await text(pg, '#soul-today')), 'Today says no cycle has run yet');
  ok(/No goal is set yet/.test(await text(pg, '#soul-goals')), 'Goals say none is set');
  ok((await text(pg, '#soul-ns-value')) === 'No reading yet' && /no figure for a week ago yet/.test(await text(pg, '#soul-ns')) && /No day has been measured yet/.test(await text(pg, '#soul-ns')), 'the north star says it has nothing yet, never a zero');
  ok(/No snapshot has been taken yet/.test(await text(pg, '#soul-metrics')), 'the metrics say no snapshot exists');
  ok(/chronicle is empty/.test(await text(pg, '#soul-chron')), 'the chronicle says it is empty');
  ok(/no lessons yet/.test(await text(pg, '#soul-evo')) && /No upgrade has been proposed yet/.test(await text(pg, '#soul-evo')), 'evolution says nothing is proposed');
  ok(await pg.evaluate(() => document.getElementById('soul-state').textContent) === 'Working', 'the chip reads Working, the word Home uses');
  ok(/\$0\.00/.test(await text(pg, '#soul-budget')), 'the budget reads zero spent, as the route said');
  const ins = await text(pg, '#soul-inst');
  ok(/No scorecard yet/.test(ins) && /No goal is set yet/.test(ins) && /nothing has been measured/.test(ins) && /Not audited yet/.test(ins) && /Not measured yet/.test(ins)
     && /no YouTube credentials/.test(ins) && /No week has been read in full/.test(ins) && /could not be read/.test(ins), 'each instrument says in words that it has nothing yet, and why when it knows');
  ok(!/undefined|NaN|null/.test(all), 'no undefined, NaN or null leaks into the words');
  ok(await noSideScroll(pg), 'nothing sideways at ' + w + 'px');
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await pg.screenshot({ path: SHOTS + '/' + tag + '-dark-empty.png', fullPage: true });
  await ctx.close();
}

/* ============================================================ the store is down */
console.log('\nthe store is down');
{
  const { pg, st, ctx } = await open_(390, 844, { mode: 'error' });
  ok(/The store is unreachable/.test(await text(pg, '#s-engine')), 'the room says the store is unreachable');
  ok(st.errors.filter(e => !/503/.test(e)).length === 0, 'and nothing throws: ' + st.errors.filter(e => !/503/.test(e)).slice(0, 2).join(' | '));
  await pg.screenshot({ path: SHOTS + '/phone-390-dark-error.png', fullPage: true });
  await ctx.close();
}

/* ============================================================ the real door */
console.log('\nthe real door · the room drawn from what api/soul.js actually sends');
{
  const dir = mkdtempSync(path.join(os.tmpdir(), 'soul-door-'));
  let made = true;
  try { execFileSync(process.execPath, [new URL('./soul-door.mjs', import.meta.url).pathname, dir], { stdio: 'pipe' }); }
  catch (e) { made = false; console.log(String(e.stdout || '').split('\n').filter(l => /FAIL/.test(l)).join('\n')); }
  ok(made, 'tests/soul-door.mjs ran the real door and saved every view');
  const R = n => JSON.parse(readFileSync(path.join(dir, n + '.json'), 'utf8'));
  for (const [w, h, tag] of [[1440, 900, 'desk-1440'], [390, 844, 'phone-390']]) {
    const { pg, st, ctx } = await open_(w, h, { mode: 'real', dir });
    const today = R('today'), cyc = R('cycle').cycle;
    ok((await text(pg, '#soul-ns-value')) === today.northStar.value.toLocaleString('en-US'), w + 'px: the north star the door sent: ' + today.northStar.value);
    ok(await pg.evaluate(() => document.querySelectorAll('#soul-goals .soul-goal').length) === today.goals.length, 'a row per goal the door holds');
    ok(await pg.evaluate(() => !!document.querySelector('#soul-goals [data-traj="behind"]')), 'a goal shows its trajectory beside its status');
    ok(await pg.evaluate(() => !!document.querySelector('#soul-v-work .trendp .lv')), 'the watched share panel draws (attention.watchedMedian)');
    ok(await pg.evaluate(() => document.querySelectorAll('#soul-chron details.fold').length) === R('chronicle').items.length, 'the chronicle, cycle by cycle');
    ok(await pg.evaluate(() => document.querySelectorAll('#soul-inst .soul-ic').length) === 8 && await pg.evaluate(() => !document.querySelector('#soul-inst .soul-err')), 'all eight instrument cards, none in error');
    ok(/Week 41, 2026/.test(await text(pg, '#soul-i-week')) && (await text(pg, '#soul-week-ns')) !== '·', 'the Week card holds the latest scorecard');
    ok(await pg.evaluate(() => document.querySelectorAll('#soul-i-traj svg').length) >= 3, 'the trajectories draw');
    ok(await pg.evaluate(() => document.querySelectorAll('#soul-i-eff .soul-row').length) >= 5, 'what worked lists the measured actions');
    ok(/of 100/.test(await text(pg, '#soul-i-search')) && /of 100 offered today/.test(await text(pg, '#soul-i-search')), 'search readiness and the IndexNow queue');
    ok(await pg.evaluate(() => document.querySelectorAll('#soul-i-speed .soul-row').length) === 4 && await pg.evaluate(() => document.querySelectorAll('#soul-i-radar .soul-row').length) === 8, 'page speed, four pages; the radar, eight searches');
    ok(/is not linked/.test(await text(pg, '#soul-voice')), 'Telegram, as the door says');
    await pg.click('#soul-today [data-soul-cycle]');
    await pg.waitForSelector('#sheet.on .soul-int', { timeout: 5000 });
    const ints = await pg.evaluate(() => [...document.querySelectorAll('#sheet .soul-int')].map(x => x.innerText));
    const r2 = cyc.intents.map((it, i) => [it, ints[i]]).filter(([it]) => it.tier === 'R2');
    ok(ints.length === cyc.intents.length && r2.length >= 1 && r2.every(([, t]) => /Guardian/.test(t) && /approves/.test(t) && !/did not answer/.test(t) && /Sentinel/.test(t) && /passes it on/.test(t)), 'an R2 intent shows the sentinel and the three verdicts the door kept (not "did not answer")');
    ok(cyc.intents.map((it, i) => [it, ints[i]]).filter(([it]) => it.tier !== 'R2').every(([, t]) => /No council review/.test(t)), 'a step run without review says so');
    const undoable = cyc.intents.filter(it => it.status === 'done' && it.result && it.result.entry && it.result.entry.undo && it.result.entry.undo !== 'noop').length;
    ok(undoable >= 1 && await pg.evaluate(() => document.querySelectorAll('#sheet [data-soul-undo]').length) === undoable, 'Undo on every step the door says can be undone (' + undoable + ')');
    await pg.click('#sheet #cl'); await pg.waitForTimeout(250);
    const all = await pg.evaluate(() => document.getElementById('s-engine').innerText);
    ok(!/undefined|NaN|\bnull\b|\[object/.test(all), 'no undefined, NaN, null or [object leaks into the words');
    ok(!DASH.test(all), 'no em or en dash');
    ok(await noSideScroll(pg), 'nothing sideways at ' + w + 'px');
    ok(st.errors.length === 0, 'no console error and no failed request: ' + st.errors.slice(0, 3).join(' | '));
    await pg.screenshot({ path: SHOTS + '/' + tag + '-dark-real-door.png', fullPage: true });
    await ctx.close();
  }
}

/* ============================================================ the hub */
console.log('\nthe More hub (the House of before)');
{
  const { pg, st, ctx } = await open_(390, 844, { hash: '#house' });
  await pg.waitForSelector('#s-more [data-room="engine"]', { timeout: 15000 });
  const card = await text(pg, '#s-more [data-room="engine"]');
  ok(/The engine room/.test(card) && card.includes(NS.toLocaleString('en-US')) && /needs you/.test(card), 'the engine room card carries the north star and the state: ' + card.replace(/\n/g, ' / '));
  ok(await pg.evaluate(() => document.querySelector('#s-more [data-room]').dataset.room) === 'engine', 'and it is the first room on the hub');
  await pg.click('#s-more [data-room="engine"]');
  await pg.waitForSelector('#s-engine.on #soul-head', { timeout: 15000 });
  ok(await pg.evaluate(() => location.hash) === '#engine', 'it opens the room, and the hash follows');
  ok(st.errors.length === 0, 'no console error');
  await ctx.close();
}

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
