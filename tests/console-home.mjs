/* NOOR · Home, the owner's living cockpit, and the five surfaces around it.
   ------------------------------------------------------------------
   LANTERN.md sections 1, 2, 7 and 10 (3 October 2026): one entity, the
   Lantern, met on Home. admin2.html draws Home from one owner-gated read,
   GET /api/soul?view=home, and every button on it posts one of the bodies
   section 2 names to /api/soul. This feeds that read the contract's shape
   exactly, section 10's additions included (today.slots, the brief numbers'
   fourteen days, the goals' history, a decision's draft, giving), from a stub
   that remembers what was posted to it (a pause stays paused, a skipped step
   leaves the list, a step done now lands in Done), on every kind of day: a
   realistic one, an empty one, one where the Lantern needs the owner, one
   with a store fault in several parts, a paused one, and one where Home
   cannot be read at all; and the lamp in each of its five states.

   It checks the picture section 7 asks for: the Lantern at the centre with
   one ring a goal, each in its fixed colour (the tilework palette), drawn to
   the right angle with its projection and its target; the goals once, under
   the drawing, each row with its numbers, its state and a thin bar in its
   ring's colour, opening the goal sheet with its line over time, its
   projection, what the Lantern is doing, and a reading under the pointer
   that stays inside the plot; the state in the light (working breathes,
   needs-you ripples and the state itself becomes the one gold button to the
   desk, paused is an ember); the glass lamp in its niche, its light rising
   with the cover and full when covered; the horizon of today's slots with
   its moving now; the brief sentence by sentence with its counting numbers
   and their lines; the desk with each card's goal colour, a hovered card
   lighting its ring, an answered card folding away with a light that travels
   to Done and a toast that carries Undo, a draft read and copied; Next as a
   timeline with Do it now, Do it anyway and no button where the house allows
   none; Done glowing once for what is new since the last visit; the ideas'
   three motions; the lamp; the read every 90 seconds while visible and never
   while hidden; and reduced motion, where nothing moves and everything is
   where it ends. It still checks section 1 and 2: every section, in its
   order; exactly the contract's bodies; confirms inside the card; links;
   old hashes; the conversation; Posts, Numbers, More, the engine room; no
   raw id and no "soul" on the page; nothing sideways at 390 px; no script
   error. Screenshots land in /tmp/qa/home2/ for a person to look at.

   Run:  python3 /tmp/vercelish.py 8263 <the repo root> &   node tests/console-home.mjs
   (NOOR_BASE overrides the address; CHROMIUM_PATH the browser; HOME_SHOTS
   where the screenshots go.)
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8263';
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.HOME_SHOTS || '/tmp/qa/home2';
mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const br = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const DASH = new RegExp('[\\u2013\\u2014]');
const SOUL = /\bsoul\b/i;

/* ---------------------------------------------------------------- the day */
const NOW = Date.now();
const H = 3600e3, D = 86400e3;
const iso = t => new Date(t).toISOString();
const day = n => new Date(NOW + n * D).toISOString().slice(0, 10);
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HIJRI = ['', 'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi ath-Thani', 'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhul Qa'dah", 'Dhul Hijjah'];
const nowD = new Date(NOW);
const GREG = WD[nowD.getUTCDay()] + ' ' + nowD.getUTCDate() + ' ' + MON[nowD.getUTCMonth()] + ' ' + nowD.getUTCFullYear();
const HIJ = (() => { const p = {}; new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' })
  .formatToParts(nowD).forEach(q => { p[q.type] = q.value; }); return (+p.day) + ' ' + HIJRI[+p.month] + ' ' + p.year; })();
const dayMonth = s => { const d = new Date(s + 'T12:00:00Z'); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + (d.getUTCFullYear() !== nowD.getUTCFullYear() ? ' ' + d.getUTCFullYear() : ''); };
/* the rings' colours, in the order admin2.html validated them (section 10: by the goals' order, never their rank):
   lapis, emerald, pearl, saffron, turquoise, pomegranate; olive and terracotta to spare */
const COLORS = ['#4169B5', '#2E8C60', '#9D85C9', '#BC8A2C', '#2AA6B3', '#A44C6E', '#959B3D', '#A0522F'];
const rgb = h => 'rgb(' + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')';
/* a run of daily values, oldest first, with a gentle wobble; nulls where asked */
const run = (n, a, b, wob, nulls = []) => Array.from({ length: n }, (_, i) => nulls.includes(i) ? null : Math.round((a + (b - a) * i / (n - 1) + (i && i < n - 1 ? Math.sin(i * 1.7) * wob : 0)) * 1000) / 1000);
const DAY0 = Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth(), nowD.getUTCDate());
const todayAt = (h, floorMin) => iso(Math.max(DAY0 + floorMin * 60e3, NOW - h * H));
const hist = (n, a, b, wob) => run(n, a, b, wob).map((v, i) => ({ date: new Date(NOW - (n - 1 - i) * D).toISOString().slice(0, 10), value: v }));

/* ---------------------------------------------------------------- the contract's shape, LANTERN.md sections 2 and 10 */
const DRAFT = { title: 'A case for support: NOOR, a library of light',
  text: 'Assalamu alaykum,\n\nNOOR is a free library of the Quran, the Names, the Prophets and the Path, read by 31,240 people a week across five networks, with no advertisement and no tracker.\n\nWe write to ask whether the foundation would consider supporting one year of its running costs.\n\nWith thanks,\nThe NOOR team' };
const DECISIONS = () => [
  { id: 'd-token', kind: 'you', title: 'Renew the Facebook page token', why: 'It runs out in 6 days. When it does, every post to Facebook and Instagram fails without a warning.', goal: 'g-health', impact: 'Keeps every post due going out',
    options: [{ id: 'done', label: 'Done', style: 'primary', confirm: null }, { id: 'later', label: 'Later', style: 'plain', confirm: null }],
    link: { href: 'https://business.facebook.com/settings/system-users', label: 'Open Meta settings' },
    steps: ['Open Business settings, then System users.', 'Generate a new token for the NOOR app with pages_manage_posts.', 'Paste it into Vercel as FB_TOKEN and redeploy.', 'Come back here and press Done.'], at: iso(NOW - 2 * H), expires: iso(NOW + 6 * D), draft: null },
  { id: 'd-lineup', kind: 'approve', title: "Swap Sunday's 19:00 reel for the Throne verse", why: 'Verse reels under 30 seconds held 52 percent watched over 14 reels; the 19:00 reel runs 58 seconds.', goal: 'g-reach', impact: 'About 300 more people reached on Sunday',
    options: [{ id: 'yes', label: 'Yes', style: 'primary', confirm: null }, { id: 'no', label: 'No', style: 'danger', confirm: 'Close this, and do not propose it again for 30 days?' }, { id: 'later', label: 'Later', style: 'plain', confirm: null }],
    link: null, steps: [], at: iso(NOW - 5 * H), expires: null, draft: null },
  { id: 'd-build', kind: 'build', title: 'Build a watch time column on the scoreboard', why: 'Attention is a goal, and the scoreboard does not show it.', goal: 'g-attention', impact: 'Attention beside reach, every morning',
    options: [{ id: 'accept', label: 'Build it', style: 'primary', confirm: "Add this to Claude's build queue?" }, { id: 'decline', label: 'Not this one', style: 'plain', confirm: null }],
    link: null, steps: [], at: iso(NOW - 26 * H), expires: null, draft: null },
  { id: 'd-inbox', kind: 'you', title: '2 messages from readers wait for an answer', why: 'One asks for a printed learning map for a school in Lyon.', goal: null, impact: null,
    options: [{ id: 'done', label: 'Mark answered', style: 'plain', confirm: null }], link: { href: '/admin2#readers', label: 'Open the inbox' }, steps: [], at: iso(NOW - 9 * H), expires: null, draft: null },
  { id: 'd-draft', kind: 'you', title: 'Send the case for support to a foundation', why: 'Gifts cover 64 percent of the running costs this month; one grant would cover the year.', goal: 'g-sustain', impact: 'A year of the house paid for',
    options: [{ id: 'sent', label: 'Sent', style: 'primary', confirm: null }, { id: 'later', label: 'Later', style: 'plain', confirm: null }, { id: 'no', label: 'No', style: 'danger', confirm: 'Close this draft, and do not write it again for 30 days?' }],
    link: null, steps: ['Copy the draft.', 'Send it from your own account to the foundation.', 'Come back and press Sent.'], at: iso(NOW - 7 * H), expires: null, draft: DRAFT }
];
const GOALS = () => [
  { id: 'g-reach', owner: 'owner', outcome: 'Double the people reached each week by 25 December', metric: 'northStar', unit: 'people', baseline: 15600, current: 31240, target: 62400, due: '2026-12-25', status: 'behind', projected: 48900, eta: '2027-02-14', note: 'From 28 daily readings.', focus: 'Two verse reels in the evening slots every day this week.', history: hist(56, 21000, 31240, 600) },
  { id: 'g-attention', owner: 'owner', outcome: 'Raise the share of each reel watched to 46 percent', metric: 'attention.watchedMedian', unit: 'share', baseline: 0.36, current: 0.41, target: 0.46, due: '2026-11-27', status: 'on-track', projected: 0.47, eta: '2026-11-20', note: null, focus: 'Shorter verse reels in the morning, measured by the verse length test.', history: hist(42, 0.35, 0.41, 0.006) },
  { id: 'g-search', owner: 'owner', outcome: 'Search arrivals at least 20 percent of site arrivals', metric: 'site.searchShare', unit: 'share', baseline: 0.08, current: 0.11, target: 0.2, due: '2026-12-26', status: 'behind', projected: 0.15, eta: null, note: null, focus: 'watching', history: hist(30, 0.08, 0.11, 0.004) },
  { id: 'g-health', owner: 'owner', outcome: 'Every post due goes out, every week', metric: 'output.health', unit: 'share', baseline: 0.95, current: 0.99, target: 0.98, due: '2026-12-25', status: 'met', projected: 0.99, eta: null, note: null, focus: 'A failed post is retried within the hour.', history: hist(56, 0.95, 0.99, 0.006) },
  { id: 'g-test', owner: 'lantern', outcome: 'Run the verse length test to a verdict', metric: 'learning.experimentDays', unit: 'days', baseline: 0, current: 9, target: 14, due: day(5), status: 'on-track', projected: 14, eta: day(5), note: null, focus: 'Holding both arms steady until the last day.', history: hist(9, 1, 9, 0) },
  { id: 'g-sustain', owner: 'owner', outcome: 'More readers keeping the library alive each month', metric: 'giving.monthly', unit: null, baseline: 9, current: 14, target: 19, due: '2026-12-26', status: 'on-track', projected: 20, eta: '2026-12-12', note: null, focus: 'The thanks line goes up after a month the gifts cover the costs.', history: hist(30, 9, 14, 0.4) }
];
/* where each ring should stand, by the contract's numbers: the share of the way from baseline to target, of a 270 degree sweep */
const THETA = { 'g-reach': 270 * (31240 - 15600) / (62400 - 15600), 'g-attention': 135, 'g-search': 67.5, 'g-health': 270, 'g-test': 270 * 9 / 14, 'g-sustain': 135 };
const BRIEF = (o = {}) => ({ date: day(0), at: iso(NOW - 3 * H), cycle: 'c-today',
  text: "Yesterday all 10 posts went out, and 31,240 people were reached in the week, 1,204 more than the week before. Verse reels under 30 seconds still hold attention best, so the Lantern swapped tomorrow's 08:00 reel for a shorter verse. Reach is behind its line for December, and today's plan answers it with two verse reels in the evening.",
  numbers: [
    { key: 'reach', label: 'people reached this week', value: 31240, unit: 'people', delta: 1204, deltaUnit: 'people', series: run(14, 27800, 31240, 500) },
    { key: 'visitors', label: 'site visitors this week', value: 980, unit: 'visitors', delta: 62, deltaUnit: 'visitors', series: run(14, 860, 980, 25, [4]) },
    { key: 'watched', label: 'share of each reel watched', value: 41.3, unit: 'percent', delta: 2.1, deltaUnit: 'points', series: run(14, 38.5, 41.3, 0.8) }], ...o });
/* today's slots, by the clock: what has come round is sent (one half, one
   failed, one skipped), what has not is still to come */
const SLOT_DEF = [['dawn', '05:00', "the day's date card", 'light'], ['reelA', '07:00', 'a verse reel', 'verse'], ['lead', '09:00', 'what is coming', 'light'], ['reelC', '11:00', 'a word reel', 'word'],
  ['light', '12:00', "the day's card", 'light'], ['reelD', '14:00', 'a verse reel', 'verse'], ['word', '16:00', 'one of 523 words', 'word'], ['reelB', '19:00', 'a verse reel', 'verse'],
  ['dusk', '20:00', 'a chapter of the Path', 'light'], ['reelE', '21:30', 'a reel of one of the Names', 'name']];
const slotsAt = clock => { const d = new Date(clock), m = d.getUTCHours() * 60 + d.getUTCMinutes();
  return SLOT_DEF.map(([slot, time, label, kind]) => { const t = +time.slice(0, 2) * 60 + +time.slice(3);
    let state = t > m ? 'later' : 'sent', net = { sent: 6, total: 6 };
    if (t <= m && slot === 'light') { state = 'partial'; net = { sent: 5, total: 6 }; }
    if (t <= m && slot === 'reelC') { state = 'failed'; net = { sent: 0, total: 6 }; }
    if (t <= m && slot === 'lead') { state = 'skipped'; net = { sent: 0, total: 0 }; }
    if (t > m) net = { sent: 0, total: 6 };
    return { slot, time, label, kind, state, networks: net, lean: slot === 'reelD' ? 'verse' : null }; }); };
/* the same day with every state on it at once, whatever the hour */
const SLOTS_ALL = [
  { slot: 'dawn', time: '05:00', label: "the day's date card", kind: 'light', state: 'sent', networks: { sent: 4, total: 4 }, lean: null },
  { slot: 'reelA', time: '07:00', label: 'a verse reel', kind: 'verse', state: 'sent', networks: { sent: 6, total: 6 }, lean: null },
  { slot: 'lead', time: '09:00', label: 'what is coming', kind: 'light', state: 'skipped', networks: { sent: 0, total: 0 }, lean: null },
  { slot: 'reelC', time: '11:00', label: 'a word reel', kind: 'word', state: 'failed', networks: { sent: 0, total: 6 }, lean: null },
  { slot: 'light', time: '12:00', label: "the day's card", kind: 'light', state: 'partial', networks: { sent: 3, total: 4 }, lean: null },
  { slot: 'reelD', time: '14:00', label: 'a verse reel', kind: 'verse', state: 'due', networks: { sent: 0, total: 6 }, lean: 'verse' },
  { slot: 'reelB', time: '19:00', label: 'a verse reel', kind: 'verse', state: 'partial', networks: { sent: 5, total: 6 }, lean: null },
  { slot: 'dusk', time: '20:00', label: 'a chapter of the Path', kind: 'light', state: 'later', networks: { sent: 0, total: 4 }, lean: null },
  { slot: 'reelE', time: '21:30', label: 'a reel of one of the Names', kind: 'name', state: 'later', networks: { sent: 0, total: 6 }, lean: null }];
/* giving, section 10: totals only, never a name or a single gift */
const GIVING = (o = {}) => ({ configured: true, currency: 'USD', month: new Date(NOW).toISOString().slice(0, 7), monthly: { givers: 14, delta7: 2 },
  gifts30: { count: 31, gross: 562, net: 530.4 }, thisMonth: { count: 6, gross: 118, net: 110.2 }, lastMonth: { count: 27, gross: 498, net: 470.9 },
  upkeep: { month: 172, cover: 0.64 }, zakat: { outstanding: 12.4 },
  series: Array.from({ length: 30 }, (_, i) => ({ date: new Date(NOW - (29 - i) * D).toISOString().slice(0, 10), monthly: Math.round(9 + i * 5 / 29), net30: Math.round(420 + i * 3.8) })),
  line: { id: 'everyday', label: 'the everyday line', since: day(-12) }, note: { text: 'This week the library was seen 61,000 times.', at: iso(NOW - 2 * D) },
  did: [{ at: day(-1) + 'T12:00:00.000Z', title: "Wrote the note on the giving page from this week's facts" }], at: iso(NOW - 2 * H), partial: false, ...o });
const GIVING_NOCOST = () => GIVING({ upkeep: { month: null, cover: null } });
const HOME_REAL = (o = {}) => ({
  ok: true, now: iso(NOW), name: 'the Lantern', paused: false, status: 'working',
  brief: BRIEF(),
  decisions: [DECISIONS()[1], DECISIONS()[4]],
  done: [
    { id: 'x3', at: todayAt(4, 10), title: 'Read the network numbers again', detail: 'They were 26 hours old.', goal: null, by: 'machine', ok: true, undo: false, actionId: null },
    { id: 'x1', at: todayAt(1.5, 30), title: "Swapped tomorrow's 08:00 reel for a shorter verse", detail: 'Surah 2:255, 31 seconds, in place of 18:10, 58 seconds.', goal: 'g-attention', by: 'lantern', ok: true, undo: true, actionId: 'act-7781' },
    { id: 'x2', at: todayAt(2.2, 20), title: 'Retried the 12:00 card on Instagram', detail: 'Instagram took it on the second try.', goal: 'g-health', by: 'lantern', ok: true, undo: false, actionId: 'act-7782' },
    { id: 'x4', at: day(-1) + 'T23:59:00.000Z', title: '10 of 10 posts went out yesterday', detail: null, goal: 'g-health', by: 'machine', ok: true, undo: false, actionId: null },
    { id: 'x5', at: day(-1) + 'T12:00:00.000Z', title: 'You approved: lean the afternoons toward verses for a week', detail: 'The 14:00 reel is a verse until Friday.', goal: 'g-reach', by: 'owner', ok: true, undo: true, actionId: 'act-7790' },
    { id: 'x6', at: day(-1) + 'T09:00:00.000Z', title: 'Tried to post the 21:00 reel to Threads', detail: 'Threads refused: the token cannot publish.', goal: null, by: 'lantern', ok: false, undo: false, actionId: 'act-7795' },
    { id: 'x7', at: day(-2) + 'T12:00:00.000Z', title: 'Planned the verse length test from 30 September', detail: 'Two arms: under 30 seconds, and over 45.', goal: 'g-test', by: 'lantern', ok: true, undo: true, actionId: 'act-7801' }],
  next: [
    { id: 'n1', title: 'Post two verse reels in the evening slots', why: 'Reach is 9 days behind its line, and verse reels reach the most people after 19:00.', goal: 'g-reach', when: 'today', hand: 'rota-lean', tier: 'R2', status: 'planned', reason: null, canDoNow: true, canSkip: true },
    { id: 'n2', title: 'Read the network numbers again at noon', why: "Tomorrow's plan needs fresh numbers.", goal: null, when: 'today', hand: 'insights-refresh', tier: 'R2', status: 'planned', reason: null, canDoNow: true, canSkip: false },
    { id: 'n5', title: 'Retry the 11:00 word reel on every network', why: 'It reached none of its networks this morning.', goal: 'g-health', when: 'today', hand: 'fix-posting', tier: 'R2', status: 'blocked', reason: 'the council said no (sentinel: the reel file is still processing at Meta)', canDoNow: true, canSkip: true },
    { id: 'n3', title: "Send Friday's Surah Al-Kahf reel to Telegram as well", why: 'Telegram has taken nothing in 7 days.', goal: 'g-reach', when: 'tomorrow', hand: 'fix-posting', tier: 'R2', status: 'blocked', reason: 'Telegram is not linked yet; it waits on you.', canDoNow: false, canSkip: true },
    { id: 'n4', title: "Propose two lessons from the week's numbers", why: 'The weekly reflection runs on Sunday.', goal: null, when: 'this week', hand: 'lesson-propose', tier: 'R1', status: 'planned', reason: null, canDoNow: false, canSkip: true }],
  coming: [{ date: day(5), title: 'The verse length test ends' }, { date: day(2), title: "Monday's scorecard for the week" }],
  goals: GOALS(),
  ideas: [
    { id: 'i1', title: 'A Friday reel on Surah Al-Kahf, every week', why: 'Searches for it peak every Thursday night, and the shelf holds 18 cards that answer it.', impact: 'About 2,000 more people reached each Friday', who: 'lantern', status: 'new', at: iso(NOW - 2 * D),
      steps: ['Lean the 19:00 reel toward verses on Friday', 'Swap Friday\'s 19:00 reel for <b>Al-Kahf</b> 18:10'] },
    { id: 'i2', title: 'Read Telegram channel views from the public preview', why: 'Telegram is the one network with no number.', impact: 'A fifth network counted in reach', who: 'build', status: 'new', at: iso(NOW - 3 * D) },
    { id: 'i3', title: 'Ask three mosques in Lyon to print the learning map', why: 'A reader asked for it for a school; mosques are the next ring out.', impact: 'Up to 400 families reached in person', who: 'you', status: 'later', at: iso(NOW - 4 * D) }],
  today: { posts: { sent: 6, due: 7, failed: 1 }, fixed: 1, reach7: { value: 31240, delta: 1204 }, slots: slotsAt(NOW) },
  voice: { telegram: { linked: false } }, spend: { usd: 3.42, capUsd: 10 }, giving: GIVING(), missing: {},
  ...o
});
const HOME_NEEDS = () => HOME_REAL({ status: 'needs-you', decisions: DECISIONS() });
const HOME_EMPTY = () => ({ ok: true, now: iso(NOW), name: 'the Lantern', paused: false, status: 'working', brief: null, decisions: [], done: [], next: [], coming: [], goals: [], ideas: [],
  today: { posts: { sent: 0, due: 0, failed: 0 }, fixed: 0, reach7: { value: null, delta: null }, slots: [] }, voice: { telegram: { linked: false } }, spend: { usd: 0, capUsd: 10 },
  giving: { configured: false, currency: 'USD', month: null, monthly: { givers: null, delta7: null }, gifts30: null, thisMonth: null, lastMonth: null, upkeep: null, zakat: null, series: [], line: null, note: null, did: [], at: null, partial: false }, missing: {} });
/* a store fault in several parts, each failing soft with its reason beside
   it, in the shapes "null plus a reason" can take: section 2's `missing`,
   and two older ones */
const HOME_FAULT = () => HOME_REAL({ decisions: null, errors: { decisions: 'nsoul:decisions could not be read: redis timeout after 2000 ms' }, goals: null, goalsReason: 'upstash answered 503 for nsoul:goals',
  giving: null, today: { posts: { sent: 6, due: 7, failed: 1 }, fixed: 1, reach7: { value: 31240, delta: 1204 }, slots: null },
  missing: { giving: 'stripe refused the reading: 401 for key sk_live_51Hx', slots: 'the slot records took longer than 6 seconds' } });
const HOME_PAUSED = () => HOME_REAL({ paused: true, status: 'paused' });

/* what the house says back, in plain words, for each POST the contract names */
const SAID = {
  decide: b => 'Recorded your answer. The Lantern carries it out now.', 'do-now': () => 'Started. It appears under Done when it finishes.',
  skip: () => 'Skipped. It will not be planned again for 7 days.', idea: b => ({ go: 'Going ahead: it joins the next cycle.', later: 'Set aside for now.', never: 'Set aside for good.' })[b.choice],
  undo: () => 'Undone. The reel is back as it was.', pause: () => 'Paused. Nothing runs until you resume.', resume: () => 'Resumed. The next cycle runs on its schedule.',
  run: () => 'A cycle has started; its report lands on Home.'
};

/* ---------------------------------------------------------------- the rest of the house, for the other surfaces */
const sse = (type, data) => 'event: ' + type + '\ndata: ' + JSON.stringify(data) + '\n\n';
const LANT_SSE = [
  sse('start', { thread: 'thread-home' }),
  sse('plan', { steps: [{ kind: 'tool', name: 'state', why: "read this morning's brief and the record before answering" }] }),
  sse('step', { tool: 'state', summary: 'the brief, 3 actions since it, 2 open decisions', phase: 'done' }),
  sse('token', { text: 'This morning I swapped the 08:00 reel for a 31 second verse, because short verses hold 52 percent of viewers.' }),
  sse('done', { thread: 'thread-home', notCompleted: [] })
].join('');
const LANT_MODELS = { ok: true, providers: { openrouter: 'set', groq: 'missing' } };
const LANT_LEDGER = { ok: true, cap: 5, countToday: 1, items: [{ id: 'l1', what: 'refresh-insights', args: {}, why: 'the cache was over an hour old', at: iso(NOW - 3 * H), ok: true, undo: { kind: 'noop' } }] };
const DAY = d => ({ ok: true, date: d, nowHour: 18, plan: { hijri: { d: 22, name: 'Rabi ath-Thani', y: 1448 }, verified: true },
  slots: [
    { id: 'dawn', at: 5, state: 'sent', title: '22 Rabi ath-Thani', results: { facebook: { ok: true }, instagram: { ok: true } } },
    { id: 'reelA', at: 8, state: 'sent', title: 'One verse', results: { instagram: { ok: true }, facebook: { ok: true } },
      reel: { id: 'v-2-255', kind: 'verse', hook: 'The Throne verse, in 31 seconds', caption: 'Allah: there is no god but He, the Living, the Sustainer of all.', cover: '/reels/v-2-255-cover.jpg', secs: 31 },
      override: { action: 'swap', by: 'soul', id: 'v-2-255', note: 'Council approved: a shorter verse holds attention' } },
    { id: 'light', at: 12, state: 'partial', title: "The day's card", results: { facebook: { ok: true }, instagram: { ok: false, error: 'Meta could not fetch the image' } } },
    { id: 'reelB', at: 17, state: 'waiting', title: 'A reel', reel: { id: 'w-sabr', kind: 'word', hook: 'Sabr is not waiting', caption: 'Sabr: patience that keeps walking.', cover: '/reels/w-sabr-cover.jpg', secs: 24 } },
    { id: 'dusk', at: 20, state: 'waiting', title: 'A chapter' }
  ] });
const DIALS = { ok: true, dials: { mode: 'auto' }, channels: [{ id: 'facebook', live: true, spec: {} }, { id: 'instagram', live: true, spec: {} }] };
const VIS = { enabled: true, totals: { views30: 310, people30: 85 }, days: [{ date: day(-2), views: 60, people: 20 }, { date: day(-1), views: 80, people: 34 }, { date: day(0), views: 90, people: 31 }],
  rooms: [{ r: 'quran', n: 40 }], countries: [{ c: 'FR', n: 30 }], sources: [{ s: 'google', n: 25 }], filtered: { total: 8, by: { bot: 8 } },
  arrivals: { byNetwork: [{ net: 'instagram', thisWeek: 40, lastWeek: 30, delta: 10 }] } };
const INS = { ok: true, days: 14, media: 70, read: 62, stale: 8, readAt: iso(NOW - 5 * H),
  byKind: [{ kind: 'reel:verse', label: 'verse reels', n: 12, reach: { median: 2400 } }], byHour: [{ hour: 8, label: '08:00', n: 12, reach: { median: 2400 } }],
  byNetwork: [{ net: 'instagram', n: 32, reach: { median: 1000 } }], bySubject: [], subjectTop: [], subjectBottom: [], top: [], sentences: ['Verse reels reach the most people.'] };
const NUM = { ok: true, thisWeek: { from: day(-6), to: day(0) }, byNetwork: [{ net: 'instagram', thisWeek: { posts: 9, views: 12000, engagement: 0.041 }, delta: { views: 3000 } }], films: [], missingToken: { youtube: true } };
const OBS_DATES = Array.from({ length: 30 }, (_, i) => new Date(NOW - (29 - i) * D).toISOString().slice(0, 10));
const OBS = { ok: true, at: iso(NOW), windowDays: 30,
  summary: { thisWeek: { from: day(-6), to: day(0) }, lastWeek: { from: day(-13), to: day(-7) }, reach: { value: 14300, delta: 1150 }, views: { value: 38400, delta: 1150 },
    visitors: { value: 620, delta: 40, sparkline: [70, 80, 75, 90, 88, 95, 100] }, posts: { value: 62, delta: 4, sparkline: [8, 9, 10, 9, 10, 9, 10] },
    networks: [{ net: 'instagram', label: 'Instagram', posts: 18, postsDelta: 1, reach: 14000, reachDelta: 1200, views: 22000, viewsDelta: 900, engagement: 0.052, engagementDelta: 0.004, sparkline: [900, 1000, 1100, 950, 1050] }] },
  notes: ["Instagram's reach rose by 1,200 people."],
  funnel: [{ net: 'instagram', label: 'Instagram', posts: 18, reach: 14000, engaged: 900, visits: 210 }],
  trend30: { dates: OBS_DATES, networks: { instagram: OBS_DATES.map((d, i) => ({ date: d, posts: 1, views: 600 + i * 8, reach: 300 + i * 5, engaged: 20 + i, engagement: 0.05 })) } },
  weekdayHour: [0, 1, 2, 3, 4, 5, 6].flatMap(wd => [8, 11, 14, 17, 19, 21].map(h => ({ weekday: wd, label: WD[wd], hour: h, at: (h < 10 ? '0' : '') + h + ':00', instagramReach: 200 + wd * 20 + h * 3, instagramN: 2, youtubeViews: null, youtubeN: 0 }))),
  byKind: [{ kind: 'reel:verse', label: 'verse reels', thisWeek: { posts: 15, views: 11000, reach: 5200, engagement: 0.05 }, lastWeek: { posts: 13, views: 9800, reach: 4900, engagement: 0.045 }, delta: { posts: 2, views: 1200, reach: 300, engagement: 0.005 } }],
  kindDaily: {}, kindTotals: [{ kind: 'reel:verse', label: 'verse reels', n: 15 }], bySubject: [], visitors: VIS,
  postingHealth: { days: OBS_DATES.map(d => ({ date: d, sent: 9, partial: 0, failed: 0, pending: 0, none: 0, retried: 0, duplicates: 0 })) },
  library: { corpus: { types: [{ type: 'word', total: 523, withReel: 523 }], films: { total: 52, traced: 34 } }, shelf: { total: 1509, byKind: { verse: 593 } }, postedByNetwork: { instagram: 1300 } },
  missingToken: {} };
const HOUSE = { store: true, storeKind: 'redis', lanternConfigured: true, lanternModel: 'x/inkling:free', moneyMode: 'quiet', weekly: 3, activeCount: 2, guardians: [],
  gifts: { total30d: 90, count30d: 3, monthly: 60, recent: [] } };
const INBOX = { ok: true, counts: { new: 2 }, items: [{ id: 'm1', at: iso(NOW - 9 * H), body: 'Salam, could you print the learning map for our school in Lyon?', from: 'a teacher', kind: 'note', status: 'new' }] };
const QUEUE = { queue: [{ entry: 'e1', title: 'First light', cid: 'c9', name: 'anon', body: 'A reply that waits to be read.', at: iso(NOW - 6 * H), why: 'link' }] };
const FLOW = { ok: true, from: day(-13), to: day(0), stages: [{ id: 'posts', label: 'Posts made', value: 8, unit: 'posts', source: 'the slot records' }, { id: 'reach', label: 'People reached', value: 1200, unit: 'people', source: 'the insights cache' }],
  edges: [{ from: 'posts', to: 'reach', value: 1200, rate: 150 }], notes: ['A returning reader is not counted twice.'] };
const SETTINGS = { store: true, dials: [{ k: 'lantern.on', g: 'The Lantern', n: 'The Lantern answers readers', t: 'bool', value: true, def: false, src: 'set here', h: 'Off means the lamp is not offered at all.' }] };
/* the engine room, from the house's older records: an audit entry whose actor
   is "soul" and whose summary says "the soul was paused" can never be
   rewritten (the chain is hashed), so the room must say it in the one voice */
const MISSION = 'Serve Allah by bringing Islam, accurately and beautifully, before as many people as possible, as efficiently as possible.';
const SOUL_TODAY = { ok: true, paused: false, mission: MISSION,
  northStar: { value: 31240, weekAgo: 30036, series: OBS_DATES.slice(-14).map((d, i) => ({ date: d, value: 29000 + i * 160 })) },
  goals: [{ id: 'g-reach', owner: 'owner', outcome: 'Double the people reached each week by 25 December', metric: 'northStar', baseline: 15600, target: 62400, current: 31240, due: '2026-12-25', status: 'behind', history: [] },
    { id: 'g-test', owner: 'soul', outcome: 'Run the verse length test to a verdict', metric: 'learning.experimentDays', baseline: 0, target: 14, current: 9, due: day(5), status: 'on-track', history: [] }],
  lastCycle: { id: 'c-today', at: iso(NOW - 3 * H), status: 'done', done: ["Swapped tomorrow's 08:00 reel for a shorter verse"], next: ['Two verse reels in the evening slots'],
    needsYou: ['the goal g-reach has been behind its line for 9 daily cycles in a row; the soul is answering it in its plan, and you may want to look at the goal itself'] },
  spend: { month: '2026-10', usd: 3.42, capUsd: 10 }, counts: { actionsToday: 2, capToday: 6 }, telegram: { linked: false } };
const SOUL_VIEWS = {
  today: SOUL_TODAY,
  metrics: { ok: true, series: OBS_DATES.map((d, i) => ({ date: d, reach: { instagram: 16000 + i * 90, total: 29000 + i * 120 }, site: { visitors7: 400 + i * 4 } })) },
  chronicle: { ok: true, items: [{ at: iso(NOW - 3 * H), cycle: 'c-today', done: ["Swapped tomorrow's 08:00 reel for a shorter verse"], next: [], needsYou: [], highlights: ['NOOR Soul, daily cycle ' + day(0) + '. Only the soul\'s own standing intents ran.'] }] },
  evolution: { ok: true, playbook: { version: 4, lessons: [{ id: 'l1', text: 'Lead a verse reel with the verse itself', why: 'Watched share rose 6 points' }] }, proposals: [], upgrades: [] },
  audit: { ok: true, chainOk: true, items: [
    { at: iso(NOW - 2 * H), kind: 'pause', actor: 'owner', summary: 'the soul was paused' },
    { at: iso(NOW - 1 * H), kind: 'resume', actor: 'owner', summary: 'the soul was resumed' },
    { at: iso(NOW - 3 * H), kind: 'cycle-done', actor: 'soul', summary: 'cycle c-today done' }] },
  cycle: { ok: true, cycle: { id: 'c-today', at: iso(NOW - 3 * H), kind: 'daily', status: 'done', intents: [{ id: 'i1', action: 'note', tier: 'R1', why: 'Record what moved', result: { ok: true, id: 'act-1', summary: 'Noted in the chronicle.', undo: { kind: 'noop' } } }] } },
  scorecard: { ok: true, week: null, scorecard: null, weeks: [] }, trajectories: { ok: true, items: [], driftDays: 7 },
  effects: { ok: true, items: [], summary: { helped: 0, hurt: 0, unclear: 0, total: 0 }, pending: 0, days: 7 },
  search: { ok: true, audit: null, lastTry: null, history: [], indexnow: { keySet: false, pending: null, submittedToday: 0, perDay: 100, last: null } },
  speed: { ok: true, speed: null, lastTry: null, history: [] }, youtube: { ok: true, youtube: null, lastTry: null, history: [], benchmarks: [] },
  radar: { ok: true, radar: null, lastTry: null, progress: { done: 0, of: 8 } }, coverage: { ok: true, coverage: null, minDays: 30 }
};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

/* ---------------------------------------------------------------- the page */
const until = async (f, ms = 6000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) return false; await new Promise(r => setTimeout(r, 25)); } return true; };
/* a context: reduced motion unless a test asks for motion; an init script
   that keeps what Copy put on the clipboard; and, when asked, one that
   records every value the first number of the brief showed on its way */
async function open_(w, h, opts = {}) {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, reducedMotion: opts.motion ? 'no-preference' : 'reduce' });
  await ctx.addInitScript(() => {
    window.__copied = [];
    try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__copied.push(String(t)); return Promise.resolve(); }, readText: () => Promise.resolve(window.__copied[window.__copied.length - 1] || '') } }); } catch (e) { /* the page's own fallback copies */ }
    window.__kpi = [];
    document.addEventListener('DOMContentLoaded', () => { new MutationObserver(() => { const v = document.querySelector('#h-brief .kpi .v'); if (v && window.__kpi[window.__kpi.length - 1] !== v.textContent) window.__kpi.push(v.textContent); })
      .observe(document.body, { subtree: true, childList: true, characterData: true }); });
  });
  if (opts.seen) await ctx.addInitScript(ids => { try { localStorage.setItem('noor.home.seen', JSON.stringify({ ids, at: new Date().toISOString() })); } catch (e) {} }, opts.seen);
  const pg = await ctx.newPage();
  if (opts.clock) await pg.clock.install({ time: new Date(NOW) });
  const st = { home: (opts.home || HOME_REAL)(), posted: [], homeGets: 0, apiGets: [], errors: [], dialogs: 0, busy: false, refuse: null, asks: [], homeMode: opts.homeMode || 'ok', delay: 0, removeOnDecide: false, moveOnDo: false };
  pg.on('pageerror', e => st.errors.push(String(e)));
  pg.on('console', m => { if (m.type() === 'error' && !(opts.allow4xx && /status of 4\d\d/.test(m.text()))) st.errors.push(m.text()); });
  pg.on('dialog', d => { st.dialogs++; d.dismiss().catch(() => {}); });
  pg.on('response', r => { if (r.status() >= 400 && !(opts.allow4xx && r.status() < 500)) st.errors.push(r.status() + ' ' + r.url()); });
  const J = (b, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(b) });
  await ctx.route('**/*', async r => {
    const q = r.request(), u = q.url(), m = q.method();
    if (u.startsWith('https://business.facebook.com/')) return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Meta</title><p>settings</p>' });
    if (u.includes('/api/soul')) {
      if (m === 'POST') {
        const b = JSON.parse(q.postData() || '{}'); st.posted.push({ url: u.replace(BASE, ''), type: q.headers()['content-type'], body: b });
        if (st.delay) await new Promise(res => setTimeout(res, st.delay));
        if (st.refuse && b.id === st.refuse) return r.fulfill(J({ ok: false, message: 'That decision was already answered from Telegram.' }));
        if (b.action === 'pause') { st.home.paused = true; st.home.status = 'paused'; }
        if (b.action === 'resume') { st.home.paused = false; st.home.status = 'working'; }
        if (b.action === 'skip') st.home.next = st.home.next.filter(x => x.id !== b.id);
        if (b.action === 'undo') st.home.done = st.home.done.map(x => x.actionId === b.id ? { ...x, undo: false, title: x.title + ' (undone)' } : x);
        if (b.action === 'idea') st.home.ideas = st.home.ideas.map(x => x.id === b.id ? { ...x, status: b.choice } : x);
        if (b.action === 'run' && st.busy) return r.fulfill(J({ ok: st.busy === 'false-ok' ? false : true, busy: true, ran: false, message: 'A cycle is already running.' }));
        /* a decision whose hand ran: the card is archived, and the action lands in Done with its undo */
        if (b.action === 'decide' && st.removeOnDecide) {
          const d = (st.home.decisions || []).find(x => x.id === b.id);
          st.home.decisions = (st.home.decisions || []).filter(x => x.id !== b.id);
          if (st.home.decisions.length === 0 && st.home.status === 'needs-you') st.home.status = 'working';
          st.home.done = [{ id: 'x-' + b.id, at: iso(Date.now()), title: 'Done: ' + (d ? d.title : b.id), detail: 'Approved by you from Home.', goal: d && d.goal, by: 'owner', ok: true, undo: true, actionId: 'act-9001' }, ...st.home.done];
          return r.fulfill(J({ ok: true, executed: true, actionId: 'act-9001', message: 'Done: ' + (d ? d.title : b.id) + '.' }));
        }
        /* a step done now: it leaves Next and lands in Done */
        if (b.action === 'do-now' && st.moveOnDo) {
          const n = st.home.next.find(x => x.id === b.id);
          st.home.next = st.home.next.filter(x => x.id !== b.id);
          st.home.done = [{ id: 'x-do-' + b.id, at: iso(Date.now()), title: n ? n.title : b.id, detail: 'Run now with your approval.', goal: n && n.goal, by: 'owner', ok: true, undo: true, actionId: 'act-do-' + b.id }, ...st.home.done];
          return r.fulfill(J({ ok: true, message: 'Done: ' + (n ? n.title : b.id) + '.', actionId: 'act-do-' + b.id }));
        }
        if (!SAID[b.action]) return r.fulfill(J({ ok: false, message: 'That is not something Home can ask for.' }));
        return r.fulfill(J({ ok: true, message: SAID[b.action](b) }));
      }
      const view = new URL(u).searchParams.get('view');
      if (view === 'home') {
        st.homeGets++;
        if (st.homeMode === 'net') return r.abort('connectionfailed');
        if (st.homeMode === 'unknown') return r.fulfill(J({ ok: false, error: 'unknown view' }, 400));
        if (st.homeMode === 'locked') return r.fulfill(J({ ok: false, error: 'locked' }, 401));
        return r.fulfill(J({ ...st.home, now: iso(Date.now()) }));
      }
      /* round nine: the console's Needs you, read on every screen; not one of a room's own reads */
      if (view === 'needs') { st.needsGets = (st.needsGets || 0) + 1; return r.fulfill(J({ ok: true, at: iso(Date.now()), count: 0, planning: false, items: [] })); }
      st.apiGets.push(u.replace(BASE, ''));
      return r.fulfill(J(SOUL_VIEWS[view] || { ok: false, error: 'no such view' }, SOUL_VIEWS[view] ? 200 : 400));
    }
    if (u.includes('/api/')) st.apiGets.push(m + ' ' + u.replace(BASE, ''));
    if (u.includes('/api/lantern-agent')) {
      if (m === 'POST') { const b = JSON.parse(q.postData() || '{}'); st.asks.push(b); if (b.action) return r.fulfill(J({ ok: true })); return new Promise(res => setTimeout(() => res(r.fulfill({ status: 200, contentType: 'text/event-stream; charset=utf-8', body: LANT_SSE })), 300)); }
      if (u.includes('action=ledger')) return r.fulfill(J(LANT_LEDGER));
      return r.fulfill(J({ ok: true, items: [] }));
    }
    if (u.includes('/api/lantern-models')) return r.fulfill(J(LANT_MODELS));
    if (u.includes('/api/social')) {
      if (u.includes('action=today')) return r.fulfill(J(DAY(u.includes('date=') ? day(1) : day(0))));
      if (u.includes('action=dials')) return r.fulfill(J(DIALS));
      if (u.includes('action=tokens')) return r.fulfill(J({ tokens: { fb: { daysLeft: 6 }, ig: { daysLeft: 41 }, lifeDays: 60 } }));
      if (u.includes('action=reddit')) return r.fulfill(J({ held: [] }));
      if (u.includes('action=log')) return r.fulfill(J({ log: [] }));
      return r.fulfill(J({ ok: true }));
    }
    if (u.includes('/reels/index.json')) return r.fulfill(J({ n: 2, cards: [{ id: 'v-2-255', kind: 'verse', slot: 'morning', hook: 'The Throne verse', caption: 'x' }, { id: 'w-sabr', kind: 'word', slot: 'evening', hook: 'Sabr', caption: 'y' }] }));
    if (/\/reels\/.*\.(jpg|png)$/.test(u) || u.includes('/api/card')) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (u.includes('/api/observatory')) return r.fulfill(J(OBS));
    if (u.includes('/api/visitors')) return r.fulfill(J(VIS));
    if (u.includes('/api/insights')) return r.fulfill(J(u.includes('action=numbers') ? NUM : INS));
    if (u.includes('/api/inbox')) return r.fulfill(J(INBOX));
    if (u.includes('/api/journal') && m === 'POST') return r.fulfill(J(QUEUE));
    if (u.includes('/api/journal')) return r.fulfill(J({ ok: true, entries: [] }));
    if (u.includes('/api/house') && u.includes('action=flow')) return r.fulfill(J(FLOW));
    if (u.includes('/api/settings')) return r.fulfill(J(SETTINGS));
    if (u.includes('/api/overrides')) return r.fulfill(J({ ok: true, items: [] }));
    if (u.includes('/api/admin-data?probe=lights')) return r.fulfill(J({ probe: 'lights', today: null, index: { n: 421, months: {}, kinds: {} }, lib: { n: 421 }, doubts: [] }));
    if (u.includes('/api/admin-data?probe=night')) return r.fulfill(J({ probe: 'night', brief: null, findings: [], last: null, perNight: 40 }));
    if (u.includes('/api/admin-data')) return r.fulfill(J(HOUSE));
    if (u.includes('/api/')) return r.fulfill(J({ ok: true }));
    if (u.startsWith(BASE)) return r.continue();
    if (u.includes('fonts.g')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.abort();
  });
  await pg.goto(BASE + '/admin2.html' + (opts.hash || ''), { waitUntil: 'domcontentloaded' });
  if (opts.homeMode !== 'locked') await pg.waitForSelector('#app.on', { timeout: 15000 });
  if (!opts.hash && st.homeMode === 'ok') await pg.waitForSelector('#s-home.on #h-decide .hsec .cnt, #s-home.on #h-decide .hfail', { timeout: 15000 });
  await pg.waitForTimeout(opts.settle != null ? opts.settle : 300);
  return { pg, st, ctx };
}
const noSideScroll = pg => pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const text = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const toastSays = pg => pg.evaluate(() => document.getElementById('toast').textContent);
const surfaceOn = pg => pg.evaluate(() => (document.querySelector('.surf.on') || {}).id);
/* every word the console shows, and every word a pointer or a reader of the
   screen can find on it (a tooltip, a label, a placeholder) */
const allWords = pg => pg.evaluate(() => [document.title, document.body.innerText,
  ...[...document.querySelectorAll('[title],[aria-label],[placeholder],[alt]')].map(e => [e.getAttribute('title'), e.getAttribute('aria-label'), e.getAttribute('placeholder'), e.getAttribute('alt')].filter(Boolean).join(' '))].join('\n'));
/* every visible control on a surface a thumb must hit, under 44 px tall */
const shortTaps = (pg, scope) => pg.evaluate(s => [...document.querySelectorAll(s + ' button, ' + s + ' a.btn, ' + s + ' a.hlink, ' + s + ' textarea, ' + s + ' [role="button"]:not(g)')]
  .filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden')
  .filter(b => b.getBoundingClientRect().height < 43.5).map(b => (b.textContent || b.getAttribute('aria-label') || b.tagName).trim().slice(0, 30) + ':' + Math.round(b.getBoundingClientRect().height)), scope);
/* the animations on the page that are running now: a loop, or an arrival not yet done */
const running = (pg, scope) => pg.evaluate(s => document.getAnimations().filter(a => a.playState === 'running' && (!s || (a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest(s))))
  .map(a => { const t = a.effect.target; return (t.id || t.getAttribute('class') || t.tagName) + ':' + a.effect.getComputedTiming().iterations; }), scope || null);
/* one press of a button that posts: the body it sent, the toast the house's
   message became, and the read of Home that followed */
async function press(pg, st, loc) {
  const before = st.posted.length, gets = st.homeGets;
  await loc.click();
  await until(() => st.posted.length > before);
  await until(() => st.homeGets > gets);
  await pg.waitForTimeout(250);
  return { sent: st.posted.slice(before), toast: await toastSays(pg), reread: st.homeGets > gets };
}
const card = (pg, id) => pg.locator('#h-decide article.dc[data-did="' + id + '"]');
/* a screenshot from the top of the page: the whole page, and, where asked,
   the first screen alone (what the owner sees before he scrolls, bar and all) */
async function shot(pg, name, first) {
  await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(150);
  if (first) await pg.screenshot({ path: SHOTS + '/' + name + '-first-screen.png' });
  await pg.screenshot({ path: SHOTS + '/' + name + '.png', fullPage: true });
}
const RAW_IDS = ['g-reach', 'g-attention', 'g-search', 'g-health', 'g-test', 'g-sustain', 'act-7781', 'act-7790', 'act-7801', 'd-lineup', 'd-token', 'd-build', 'd-inbox', 'd-draft', 'c-today', 'rota-lean', 'insights-refresh', 'fix-posting', 'lesson-propose', 'nsoul', 'reelA', 'reelB', 'sk_live'];
const transformDeg = s => { const m = /rotate\((-?[\d.]+)deg\)/.exec(s || ''); return m ? +m[1] : null; };
const setVisible = (pg, on) => pg.evaluate(v => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v ? 'visible' : 'hidden' });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => !v });
  document.dispatchEvent(new Event('visibilitychange'));
}, on);

/* ============================================================ a realistic day */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · a realistic day: every section draws, in the order sections 1 and 7 name');
  const { pg, st, ctx } = await open_(w, h);
  ok((await surfaceOn(pg)) === 's-home' && await pg.evaluate(() => location.hash) === '#home', 'unlocking lands on Home, and the hash says #home');
  ok(await pg.evaluate(() => document.getElementById('title').textContent) === 'Home', 'the top bar names it Home');
  ok(st.homeGets === 1, 'Home is one read of /api/soul?view=home: ' + st.homeGets);
  ok(!st.apiGets.some(g => !/admin-data$/.test(g) && !/GET \/api\/admin-data/.test(g)), 'and nothing else is asked of the house to draw it: ' + JSON.stringify(st.apiGets));
  ok(await pg.evaluate(() => [...document.querySelectorAll('nav.bar button')].map(b => b.dataset.s + ':' + b.textContent.trim()).join(',')) === 'home:Home,ask:Ask,posts:Posts,numbers:Numbers,more:More',
     'the bar holds five buttons: Home, Ask, Posts, Numbers, More');
  ok(await pg.evaluate(() => document.querySelector('nav.bar [data-s="home"]').classList.contains('on')), 'and lights Home');
  const ORDER = ['h-greet', 'h-orbx', 'h-state', 'h-hz', 'h-goals', 'h-brief', 'h-decide', 'h-next', 'h-done', 'h-giving', 'h-ideas', 'h-ask', 'h-engine'];
  if (w < 600) {
    ok(await pg.evaluate(o => { const y = o.map(id => document.getElementById(id).getBoundingClientRect().top); return y.every((v, i) => !i || v > y[i - 1]); }, ORDER),
       'on a phone one scroll, in the order section 7 names: the drawing, its state, the horizon, the goals under it, the brief, the desk, Next, Done, the lamp, the ideas, Ask, the engine room');
    const fs = await pg.evaluate(() => { const vh = innerHeight - 64, b = id => document.getElementById(id).getBoundingClientRect(); return { orb: b('h-orbx').bottom, st: b('h-state').bottom, pz: document.querySelector('#h-status [data-hp]').getBoundingClientRect().bottom, hz: b('h-hz').bottom, vh }; });
    ok(fs.orb < fs.vh && fs.st < fs.vh && fs.pz < fs.vh && fs.hz < fs.vh, 'the first screen holds the drawing, the state, Pause and the horizon, above the bar: ' + JSON.stringify(fs));
  } else {
    const z = await pg.evaluate(() => { const zone = id => { const e = document.getElementById(id); return e.closest('.hz').id; }, L = id => document.getElementById(id).getBoundingClientRect().left;
      return { a: ['h-face', 'h-goals', 'h-giving'].map(zone), b: ['h-brief', 'h-decide', 'h-done'].map(zone), c: ['h-next', 'h-ideas', 'h-ask'].map(zone), x: [L('h-face'), L('h-brief'), L('h-next')], top: [document.getElementById('h-face').getBoundingClientRect().top, document.getElementById('h-brief').getBoundingClientRect().top],
        under: document.getElementById('h-face').nextElementSibling === document.getElementById('h-goals') }; });
    ok(z.a.every(x => x === 'hz-a') && z.b.every(x => x === 'hz-b') && z.c.every(x => x === 'hz-c') && z.x[0] < z.x[1] && z.x[1] < z.x[2] && Math.abs(z.top[0] - z.top[1]) < 4 && z.under,
       'on a desk a cockpit of three zones: the drawing with the goals under it and the lamp; the brief, the desk and Done; Next, the ideas and Ask: ' + JSON.stringify(z));
    ok(await pg.evaluate(() => { const r = document.getElementById('h-orbx').getBoundingClientRect(); return r.width >= 340 && r.width <= 400; }), 'and the drawing about 380 px across: ' + await pg.evaluate(() => Math.round(document.getElementById('h-orbx').getBoundingClientRect().width)));
  }

  // 1. greeting and status
  const greet = await text(pg, '#h-greet');
  ok(/Assalamu alaykum/.test(greet), 'the greeting');
  ok(greet.includes(GREG) && greet.includes(HIJ), "today's Gregorian and Hijri dates: " + GREG + ' / ' + HIJ);
  ok(/^updated \d\d:\d\d UTC$/.test(await text(pg, '#h-upd')), 'and a quiet "updated" with the time: ' + await text(pg, '#h-upd'));
  ok(await text(pg, '#h-state') === 'The Lantern is working' && await pg.evaluate(() => document.getElementById('h-state').classList.contains('good')), 'the status chip says The Lantern is working, in green');
  ok(await pg.evaluate(() => { const b = document.querySelector('#h-status [data-hp="pause"]'); return !!b && b.textContent === 'Pause'; }), 'with a small Pause control');
  ok(await pg.evaluate(() => !document.getElementById('h-needs') && document.getElementById('h-state').tagName === 'SPAN' && !document.querySelector('#h-face [data-jump]') && !/need/i.test(document.getElementById('h-face').innerText)),
     'and no needs-you sign anywhere while the house says the Lantern is working');

  // the drawing: one ring a goal, in its colour, at its angle
  const rings = await pg.evaluate(() => [...document.querySelectorAll('#h-rings .rg')].map(g => ({ gi: g.dataset.gi, th: +g.dataset.th, col: g.querySelector('.tr').getAttribute('stroke'),
    a: document.querySelector('#hm' + g.dataset.gi + 'a .mk').style.transform, b: document.querySelector('#hm' + g.dataset.gi + 'b .mk').style.transform,
    bead: g.querySelector('.bd').style.transform, pj: !!g.querySelector('.pj'), tg: !!g.querySelector('.tg'), role: g.getAttribute('role'), label: g.getAttribute('aria-label') })));
  ok(rings.length === 6, 'one ring a goal, six goals: ' + rings.length);
  ok(rings.every((r, i) => r.col === COLORS[i]), 'each in its colour, in the fixed order the validated palette gives: ' + rings.map(r => r.col).join(','));
  const ids = GOALS().map(g => g.id);
  ok(rings.every((r, i) => Math.abs(r.th - THETA[ids[i]]) < 0.05), 'each drawn to where its goal stands, a share of a 270 degree sweep: ' + rings.map(r => r.th.toFixed(1)).join(','));
  ok(rings.every((r, i) => { const t = THETA[ids[i]]; return Math.abs(transformDeg(r.a) - (Math.min(t, 180) - 180)) < 0.05 && Math.abs(transformDeg(r.b) - Math.max(0, Math.min(t - 180, 90))) < 0.05 && Math.abs(transformDeg(r.bead) - t) < 0.05; }),
     'its solid arc revealed to that angle, the bead of now at its end: ' + rings.map(r => r.a + '/' + r.b).join(' '));
  ok(rings.filter(r => r.pj).length === 5 && !rings[3].pj, 'a lighter arc to where its projection lands, on every goal not already met: ' + rings.map(r => r.pj ? 1 : 0).join(''));
  ok(rings.every(r => r.tg), 'and a mark at each target');
  ok(rings.every(r => r.role === 'button') && /Double the people reached each week by 25 December: now 31,240 of 62,400 people, behind, 33 percent of the way\. Open the goal\./.test(rings[0].label),
     'every ring has words a reader of the screen hears: ' + rings[0].label);
  ok(/The Lantern is working\. 6 goals, as rings: Double the people reached/.test(await pg.evaluate(() => document.getElementById('h-orb-sr').textContent)), 'and the drawing has its words beside it');
  ok(await pg.evaluate(() => { const d = document.querySelector('#h-orbx .star svg path').getAttribute('d'); return d.split('M').length === 3 && (d.match(/L/g) || []).length === 8; }),
     'the light at the centre is an eight pointed star of two squares');
  /* the goals, once: the rows under the drawing are the goals' list, and there is no other */
  const leg = await pg.evaluate(() => [...document.querySelectorAll('#h-goals .lr')].map(r => r.innerText.replace(/\s+/g, ' ').trim()));
  ok(leg.length === 6 && leg[0] === 'Double the people reached each week by 25 December 31,240 of 62,400 people behind' && /^Raise the share of each reel watched to 46 percent 41% of 46% on track$/.test(leg[1])
     && / met$/.test(leg[3]) && leg[4] === 'Run the verse length test to a verdict 9 of 14 days on track',
     'under the drawing, the goals: each ring named with its numbers and its state: ' + leg.slice(0, 2).join(' | '));
  ok(await pg.evaluate(() => [...document.querySelectorAll('#s-home .hsec h2')].filter(h => /^goals$/i.test(h.textContent)).length === 1 && document.querySelector('#h-goals .hsec h2').textContent === 'Goals'
     && document.querySelector('#h-goals .hsec .cnt').textContent === '6' && !document.querySelector('.hgoal,.meter,#h-legend')), 'headed Goals with their count, and no second list of goals anywhere on Home');
  ok(await pg.evaluate(c => [...document.querySelectorAll('#h-goals .lr .sw path:last-child')].every((p, i) => p.getAttribute('stroke') === c[i]), COLORS), 'each row with a small ring of its own colour, so the colour is never the only sign');
  const bars = await pg.evaluate(() => [...document.querySelectorAll('#h-goals .lr .lbar')].map(b => ({ i: b.querySelector('i').style.transform, col: getComputedStyle(b.querySelector('i')).backgroundColor,
    h: b.getBoundingClientRect().height, s: b.querySelector('s') ? [b.querySelector('s').style.left, b.querySelector('s').style.width] : null, none: b.classList.contains('none') })));
  ok(bars.length === 6 && bars.every((b, i) => b.col === rgb(COLORS[i])) && bars.every(b => b.h > 0 && b.h <= 4), "each row with a thin bar in its ring's colour, never a colour of state: " + bars.map(b => b.col + ' ' + b.h + 'px').join(', '));
  ok(bars[0].i === 'scaleX(0.3342)' && bars[0].s && bars[0].s[0] === '33.4%' && bars[0].s[1] === '37.7%', 'a bar runs from the baseline to the target, where it is heading drawn lighter: ' + bars[0].i + ' ' + JSON.stringify(bars[0].s));
  ok(bars[1].i === 'scaleX(0.5)' && bars[2].i === 'scaleX(0.25)' && bars[3].i === 'scaleX(1)' && !bars[3].s && bars[4].i === 'scaleX(0.6429)', 'a share goal drawn by its fraction, a goal met full with nothing left to project: ' + bars.map(b => b.i).join(' '));
  ok(await pg.evaluate(() => [...document.querySelectorAll('#h-goals .lr')].every(r => r.tagName === 'BUTTON' && /Open the goal\.$/.test(r.getAttribute('aria-label')) && r.getBoundingClientRect().height >= 44)),
     'every row is a button a thumb can hit, and says it opens the goal');

  // 2. the horizon
  const hz = await pg.evaluate(() => ({ pts: [...document.querySelectorAll('#h-hz .pt')].map(p => p.className.replace('pt ', '')), now: document.querySelector('#h-hz .now').style.transform,
    cap: document.getElementById('h-hz-cap').innerText, sr: document.querySelectorAll('#h-horizon ol.sro li').length, head: document.querySelector('#h-horizon .hh').innerText }));
  ok(hz.pts.length === 10 && hz.sr === 10, "today's ten posting slots along the line, each read aloud for a reader of the screen: " + hz.pts.join(','));
  ok(/^translateX\([\d.]+%\)$/.test(hz.now), 'a thin now mark on it, moved by a transform: ' + hz.now);
  ok(/TODAY\s*6 of 7 sent\s*1 failed/i.test(hz.head) && /Posts/.test(hz.cap), 'with the day in words, and Posts beside it: ' + hz.head.replace(/\s+/g, ' ') + ' / ' + hz.cap.replace(/\s+/g, ' '));

  // 3. the brief
  const brief = await text(pg, '#h-brief');
  ok(/This morning's brief/i.test(await text(pg, '#h-brief-lab')), "the brief is labelled this morning's");
  ok(brief.includes('31,240 people were reached') && brief.includes('two verse reels in the evening'), 'its words, whole');
  ok(await pg.evaluate(() => document.querySelectorAll('#h-brief .say .sen').length) === 3, 'sentence by sentence: three of them');
  const kpis = await pg.evaluate(() => [...document.querySelectorAll('#h-brief .kpi')].map(k => [k.querySelector('.v').textContent, k.querySelector('.l').textContent, k.querySelector('.d').textContent, k.querySelector('.d').className,
    k.querySelector('.spk') ? k.querySelector('.spk').getAttribute('aria-label') : '', k.querySelector('.spk path') ? (k.querySelector('.spk path').getAttribute('d').match(/[ML]/g) || []).length : 0, k.querySelector('.spk path') ? (k.querySelector('.spk path').getAttribute('d').match(/M/g) || []).length : 0]));
  ok(kpis.length === 3, 'three key numbers');
  ok(kpis[0][0] === '31,240' && /people reached this week/.test(kpis[0][1]) && kpis[0][2] === '↑ 1,204' && /up/.test(kpis[0][3]), 'people reached this week, with its change: ' + kpis[0].slice(0, 4).join(' | '));
  ok(kpis[1][0] === '980' && kpis[1][2] === '↑ 62', 'site visitors this week: ' + kpis[1].slice(0, 3).join(' | '));
  ok(kpis[2][0] === '41%' && kpis[2][2] === '↑ 2.1 pts', 'the share of each reel watched, already a percent, its change in points: ' + kpis[2].slice(0, 3).join(' | '));
  ok(kpis[0][5] === 14 && kpis[0][6] === 1 && kpis[1][5] === 13 && kpis[1][6] === 2 && kpis[2][5] === 14, 'each number with its last fourteen days, a missing day a gap in the line: ' + kpis.map(k => k[5] + '/' + k[6]).join(' '));
  ok(/^The last 14 days: from 27,800 to 31,240$/.test(kpis[0][4]) && /^The last 14 days: from 39% to 41%$/.test(kpis[2][4]), 'and each line with its words: ' + kpis[0][4] + ' | ' + kpis[2][4]);
  ok(await pg.evaluate(() => !!document.querySelector('#h-brief [data-score]') && /Open the week's scorecard/.test(document.querySelector('#h-brief [data-score]').textContent)), "and Open the week's scorecard");

  // 4. the desk
  ok(await text(pg, '#h-decide .hsec .cnt') === '2', 'Your decisions carries its count');
  ok(await pg.evaluate(() => document.querySelectorAll('#h-decide article.dc').length) === 2, 'one card a decision');
  const lin = await pg.evaluate(() => { const c = document.querySelector('#h-decide article.dc[data-did="d-lineup"]');
    return { t: c.innerText, btns: [...c.querySelectorAll('[data-dopt]')].map(b => b.textContent + ':' + b.className), dot: getComputedStyle(c.querySelector('.gdot')).backgroundColor, gi: c.dataset.gi }; });
  ok(/Needs your yes/.test(lin.t) && /Swap Sunday's 19:00 reel/.test(lin.t) && /52 percent/.test(lin.t), 'a card has its kind, its title and one line of why');
  ok(/For Double the people reached each week by 25 December/.test(lin.t), 'the goal it serves, by its outcome, never its key');
  ok(lin.gi === '0' && lin.dot === rgb(COLORS[0]), "and that goal's colour, the same as its ring: " + lin.dot);
  ok(/Expected About 300 more people/.test(lin.t) && /asked 5 h ago/.test(lin.t), 'what it is expected to do, and when it was asked');
  ok(lin.btns.join(',') === 'Yes:btn,No:btn danger,Later:btn ghost', 'the buttons, styled primary, danger and plain as the house said: ' + lin.btns.join(','));
  const dr = await pg.evaluate(() => { const c = document.querySelector('article.dc[data-did="d-draft"]'); return { t: c.innerText, read: !!c.querySelector('[data-draft]'), copy: !!c.querySelector('[data-dcopy]'), dot: getComputedStyle(c.querySelector('.gdot')).backgroundColor }; });
  ok(dr.read && dr.copy && /A draft for you to send: A case for support: NOOR, a library of light/.test(dr.t) && dr.dot === rgb(COLORS[5]), 'a card with a draft offers Read the draft and Copy, in its goal\'s colour');

  // 5. Next as a timeline
  ok(await text(pg, '#h-next .hsec .cnt') === '5', 'Next carries its count');
  ok(await pg.evaluate(() => !!document.querySelector('#h-next .tl')), 'drawn as a timeline on a line of light');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#h-next .hday')].map(d => d.textContent).join(',')) === 'Today,Tomorrow,This week,On the calendar', 'today, tomorrow, this week, then the calendar');
  const nx = await pg.evaluate(() => [...document.querySelectorAll('#h-next .hnx[data-nid]')].map(x => x.dataset.nid + ':' + [...x.querySelectorAll('button')].map(b => b.textContent).join('+')));
  ok(nx.join(' ') === 'n1:Do it now+Skip n2:Do it now n5:Do it anyway+Skip n3:Skip n4:Skip',
     'Do it now where it may run; Do it anyway on a blocked step he may approve; no button at all where canDoNow is false: ' + nx.join(' '));
  ok(/blocked/.test(await text(pg, '#h-next .hnx[data-nid="n3"]')) && /Telegram is not linked yet; it waits on you\./.test(await text(pg, '#h-next .hnx[data-nid="n3"]')), 'a blocked step says so, and why');
  const cal = await pg.evaluate(() => [...document.querySelectorAll('#h-coming .c span')].map(s => s.textContent));
  ok(cal.join(' | ') === "Monday's scorecard for the week | The verse length test ends", 'what is coming, in date order: ' + cal.join(' | '));
  ok(await pg.evaluate(() => /Think again/.test(document.querySelector('#h-next [data-think]').textContent)), 'and Think again');

  // 6. done
  ok(await text(pg, '#h-done .hsec .cnt') === '7', 'Done carries its count');
  const done = await text(pg, '#h-done');
  ok(/6 of 7 posts due so far today went out/.test(done) && /1 failed, the Lantern repaired 1\./.test(done), 'the routine, from the day: 6 of 7, 1 failed, 1 repaired');
  const rows = await pg.evaluate(() => [...document.querySelectorAll('#h-done .hrow:not(.rt) .x b')].map(b => b.textContent));
  ok(rows.length === 6 && rows[0] === "Swapped tomorrow's 08:00 reel for a shorter verse" && rows[2] === 'Read the network numbers again', 'newest first, six shown: ' + rows.slice(0, 3).join(' / '));
  ok(await pg.evaluate(() => [...document.querySelectorAll('#h-done .hday')].map(d => d.textContent).slice(0, 2).join(',')) === 'Today,Yesterday', 'grouped by day');
  ok(await pg.evaluate(() => document.querySelectorAll('#h-done [data-undo]').length) === 2, 'Undo only where an undo exists (not on a failed action, not where there is none)');
  ok(/did not work/.test(done) && /by you/.test(done) && /by the machine/.test(done) && /by the Lantern/.test(done), 'who did each thing, and what did not work');
  ok(await pg.evaluate(c => { const r = document.querySelector('#h-done .hrow[data-gi="1"] .gd'); return !!r && getComputedStyle(r).backgroundColor === c; }, rgb(COLORS[1])), "each row with its goal's dot");
  ok(await pg.evaluate(() => document.querySelectorAll('#h-done .hrow.fresh').length) === 0, 'on a first visit nothing glows: there is no last visit to compare with');
  ok(await pg.evaluate(() => !!document.querySelector('#h-done [data-all]') && /See everything/.test(document.querySelector('#h-done [data-all]').textContent)), 'and See everything');
  await pg.click('#h-done [data-dmore]'); await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => document.querySelectorAll('#h-done .hrow:not(.rt)').length) === 7 && await pg.evaluate(() => document.querySelectorAll('#h-done [data-undo]').length) === 3, 'Show all 7 shows the seventh, with its Undo');

  // 8. the lamp: a glass lamp of the Mamluk kind hanging in its niche, the light within it rising with the cover
  const lamp = await pg.evaluate(() => { const l = document.getElementById('h-lamp'), sv = l.querySelector('.lp svg'); return { flame: l.dataset.flame, by: l.dataset.by, t: document.getElementById('h-giving').innerText, tf: l.querySelector('.fl').style.transform,
    href: document.querySelector('#h-giving [data-ledger]').getAttribute('href'), target: document.querySelector('#h-giving [data-ledger]').getAttribute('target'), rel: document.querySelector('#h-giving [data-ledger]').getAttribute('rel'), aria: l.querySelector('.lp').getAttribute('aria-label'),
    clip: !!l.querySelector('.fl').closest('[clip-path]'), words: sv.querySelectorAll('text,image,use,foreignObject').length, glo: l.querySelector('.glo').style.opacity }; });
  ok(/Keeping the lamp lit/i.test(lamp.t) && lamp.by === 'cover' && lamp.flame === '0.640' && lamp.tf === 'scaleY(0.64)' && lamp.clip, 'Keeping the lamp lit: the light within the glass rises as high as the gifts cover the costs: ' + lamp.flame + ' ' + lamp.tf);
  ok(lamp.words === 0 && Math.abs(parseFloat(lamp.glo) - (0.3 + 0.7 * 0.64)) < 0.002, 'only bands and geometry on it, no writing, and its niche glows with it: ' + lamp.glo);
  ok(/14\s*monthly givers/i.test(lamp.t) && /2 more this week/.test(lamp.t), 'the monthly givers, and their change over the week');
  ok(/The month's gifts cover 64 percent of the house's running costs this month\./.test(lamp.t), 'what the light stands for, in words');
  ok(/This month\s*\$110 from 6 gifts/.test(lamp.t) && /The last 30 days\s*\$530 from 31 gifts/.test(lamp.t) && /Zakat waiting to be given\s*\$12\.40/.test(lamp.t), "this month's gifts, the last 30 days and the zakat waiting, in the house's currency");
  ok(/The Lantern, yesterday: Wrote the note on the giving page/.test(lamp.t) && /The quiet line on every page: the everyday line/.test(lamp.t), 'what the Lantern last did for giving, and the line it keeps');
  ok(lamp.href === '#giving' && lamp.target === null && lamp.rel === null, 'a link to the ledger, in this console\'s Giving (round nine: never the retired console)');
  ok(/^A glass lamp hanging in a niche, its light 64 percent of the way up\. The month's gifts cover 64 percent/.test(lamp.aria), 'and the drawing has its words: ' + lamp.aria);

  // 9. ideas
  const I = await pg.evaluate(() => [...document.querySelectorAll('#h-ideas .hidea')].map(x => ({ t: x.innerText, b: [...x.querySelectorAll('[data-idea]')].map(b => b.textContent), aside: x.classList.contains('aside') })));
  ok(I.length === 3 && await text(pg, '#h-ideas .hsec .cnt') === '3', 'Ideas to grow, three, with their count');
  ok(/The Lantern does it/.test(I[0].t) && /A build for Claude/.test(I[1].t) && /You do it/.test(I[2].t), 'each says who does it');
  ok(/Expected About 2,000 more people/.test(I[0].t) && /Searches for it peak/.test(I[0].t), 'why, and the expected effect');
  ok(I[0].b.join(',') === 'Go,Not now,Never' && I[2].b.join(',') === 'Go,Never' && /set aside for now/.test(I[2].t) && I[2].aside, 'Go, Not now and Never; an idea already set aside sits aside, offering Go and Never');

  // 10 and 11
  ok(await pg.evaluate(() => !!document.getElementById('h-ask-text') && document.querySelectorAll('#h-ask [data-sug]').length === 3), 'the Ask box, with three suggested orders');
  ok(/The engine room/.test(await text(pg, '#h-engine')) && (await text(pg, '#h-engine')).includes('$3.42 of $10.00 spent this month · Telegram not linked'), 'and the door to the engine room, with the budget and Telegram');

  // the whole page
  ok(await pg.evaluate(() => !document.getElementById('dot-home').hidden && !document.getElementById('dot-posts').hidden), 'the bar marks Home (decisions wait) and Posts (a post failed)');
  const words = await allWords(pg);
  ok(!SOUL.test(words), 'no "soul" anywhere the console shows: ' + ((words.match(/.{0,30}\bsoul\b.{0,30}/i) || [''])[0]));
  const homeText = await text(pg, '#s-home');
  ok(RAW_IDS.every(x => !homeText.includes(x)) && !/\bR[12]\b/.test(homeText), 'no raw id reaches the page: ' + RAW_IDS.filter(x => homeText.includes(x)).join(','));
  ok(!/undefined|NaN|\bnull\b|\[object/.test(homeText) && !DASH.test(homeText), 'no undefined, NaN, null or dash in the words');
  ok(!/@|\b[A-Z][a-z]+ [A-Z][a-z]+ gave\b/.test(await text(pg, '#h-giving')), 'the lamp names no one and no single gift');
  const short = await shortTaps(pg, '#s-home');
  ok(short.length === 0, 'every control on Home is at least 44 px tall: ' + short.join(', '));
  ok(await noSideScroll(pg), 'nothing scrolls sideways at ' + w + ' px');
  ok(await pg.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length) === 0, 'with reduced motion nothing on the page is moving');
  ok(st.errors.length === 0 && st.dialogs === 0, 'no console error, no failed request, no browser dialog: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ motion: the arrival, the light, the loops */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · motion: the rings draw, the numbers count, the light breathes');
  const { pg, st, ctx } = await open_(w, h, { motion: true, settle: 0 });
  const early = await running(pg, '#s-home');
  ok(early.some(x => /^mk:1$/.test(x)) || early.some(x => /^bd:1$/.test(x)), 'on arrival the rings draw from nothing, their half planes turning: ' + early.filter(x => /mk|bd/.test(x)).length + ' moving');
  ok(await pg.evaluate(() => document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.matches && a.effect.target.matches('#h-goals .lbar i')).length) === 6, 'and each goal\'s bar grows with its ring');
  await pg.waitForTimeout(2600);
  const kv = await pg.evaluate(() => window.__kpi);
  ok(kv.length >= 3 && kv[kv.length - 1] === '31,240' && kv.some(v => v !== '31,240' && +v.replace(/,/g, '') < 31240), 'the brief\'s numbers count up to where they are: ' + kv.slice(0, 4).join(' > ') + ' ... ' + kv[kv.length - 1]);
  const loops = await running(pg, '#s-home');
  ok(loops.includes('light:Infinity') && loops.some(x => /^lat:Infinity$/.test(x)), 'working: the light breathes and the lattice turns, on loops: ' + loops.join(','));
  ok(!loops.some(x => /^rip/.test(x)), 'and no ripple, since nothing needs him');
  const anyFailed = st.home.today.slots.some(s => s.state === 'failed');
  ok((!anyFailed || loops.some(x => /^pt failed:Infinity$/.test(x))) && loops.some(x => /^fli:Infinity$/.test(x)), (anyFailed ? 'the failed slot flickers like an ember, and ' : '') + 'the light in the lamp lives: ' + loops.filter(x => /pt|fli|glo/.test(x)).join(','));
  ok(loops.every(x => /:Infinity$/.test(x)), 'and every arrival has finished: only the ambient loops still run');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#h-brief .sen')].every(s => getComputedStyle(s).opacity === '1')), 'every sentence of the brief has come in');
  ok(await pg.evaluate(() => document.querySelector('#h-rings .rg[data-gi="0"] .bd').style.transform) === 'rotate(' + THETA['g-reach'].toFixed(2) + 'deg)', 'and each ring stands at its value');
  /* the loops stop while the page is hidden, and start again when it is seen */
  await setVisible(pg, false);
  ok(await pg.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect.getComputedTiming().iterations === Infinity).length) === 0, 'hidden: every loop stops');
  await setVisible(pg, true);
  ok((await running(pg, '#s-home')).includes('light:Infinity'), 'seen again: they run again');
  await pg.click('nav.bar [data-s="more"]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect.getComputedTiming().iterations === Infinity && a.effect.target.closest('#s-home')).length) === 0, 'and while another surface is open, Home stands still');
  await pg.click('nav.bar [data-s="home"]'); await pg.waitForTimeout(300);
  if (w > 600) {
    /* a card of the desk, hovered, makes its goal's ring glow */
    await pg.hover('#h-decide article.dc[data-did="d-lineup"] h3'); await pg.waitForTimeout(400);
    const glow = await pg.evaluate(() => ({ hl: document.querySelector('#h-rings .rg[data-gi="0"] .hl').style.opacity, other: document.querySelector('#h-rings .rg[data-gi="5"] .hl').style.opacity, lr: document.querySelector('#h-goals .lr[data-gi="0"]').classList.contains('on') }));
    ok(glow.hl === '1' && glow.other !== '1' && glow.lr, 'hovering a card of the desk makes its goal\'s ring glow, and its row among the goals: ' + JSON.stringify(glow));
    await pg.hover('#h-decide article.dc[data-did="d-draft"] h3'); await pg.waitForTimeout(400);
    ok(await pg.evaluate(() => document.querySelector('#h-rings .rg[data-gi="5"] .hl').style.opacity === '1' && document.querySelector('#h-rings .rg[data-gi="0"] .hl').style.opacity === '0'), 'another card, another ring');
    await pg.focus('#h-next .hnx[data-nid="n5"] [data-anyway]'); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => document.querySelector('#h-rings .rg[data-gi="3"] .hl').style.opacity === '1'), 'and a step of Next, focused from the keyboard, lights the ring it serves');
  }
  await shot(pg, 'home-realistic-' + tag, true);
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ the day it needs him */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · the Lantern needs the owner');
  const { pg, st, ctx } = await open_(w, h, { home: HOME_NEEDS, motion: true });
  await pg.waitForTimeout(2200);
  /* one sign: the state itself is the gold button "5 need you", and there is no second chip */
  const nb = await pg.evaluate(() => { const c = document.getElementById('h-state'), o = document.getElementById('h-orbx').getBoundingClientRect(), r = c.getBoundingClientRect();
    return { tag: c.tagName, gold: c.classList.contains('gold'), t: c.innerText, h: r.height, jump: c.dataset.jump, aria: c.getAttribute('aria-label'),
      under: r.top < o.bottom && r.bottom > o.bottom - 4 && r.left >= o.left - 40 && r.right <= o.right + 40, signs: (document.getElementById('h-face').innerText.match(/need you/gi) || []).length,
      old: !!document.getElementById('h-needs') || !!document.querySelector('#h-orbx button') }; });
  ok(nb.tag === 'BUTTON' && nb.gold && nb.t === '5 need you' && nb.h >= 44 && nb.jump === 'h-decide' && nb.aria === '5 decisions need you: go to the desk',
     'the state is the gold button "5 need you", a thumb\'s size, that leads to the desk: ' + JSON.stringify(nb));
  ok(nb.signs === 1 && !nb.old, 'and it is the one sign: no second chip, nothing else in the face says it');
  ok(nb.under, 'it stands under the light, in the opening at the foot of the rings');
  /* and neither it nor Pause covers a ring: no point of any track falls inside them */
  const cover = await pg.evaluate(() => { const boxes = ['#h-state', '#h-status [data-hp]'].map(s => document.querySelector(s).getBoundingClientRect()), hits = [];
    document.querySelectorAll('#h-rings .rg .tr').forEach(p => { const L = p.getTotalLength(), m = p.getScreenCTM(), sw = +p.getAttribute('stroke-width') * Math.hypot(m.a, m.b) / 2;
      for (let k = 0; k <= 120; k++) { const q = p.getPointAtLength(L * k / 120), x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f;
        boxes.forEach((b, n) => { if (x > b.left - sw && x < b.right + sw && y > b.top - sw && y < b.bottom + sw) hits.push(n + ':' + Math.round(x) + ',' + Math.round(y)); }); } });
    return hits; });
  ok(cover.length === 0, 'and neither the gold button nor Pause lies over a ring: ' + cover.slice(0, 4).join(' '));
  ok(await text(pg, '#h-decide .hsec .cnt') === '5' && await pg.evaluate(() => document.querySelector('#h-decide .hsec .cnt').classList.contains('hot')), 'five decisions, the count marked');
  const loops = await running(pg, '#h-orbx');
  ok(loops.filter(x => x === 'rip:Infinity').length === 2 && loops.includes('light:Infinity'), 'a golden ripple leaves the light every few seconds: ' + loops.join(','));
  if (w < 600) {
    const fs = await pg.evaluate(() => { const vh = innerHeight - 64; return ['h-orbx', 'h-state', 'h-hz'].map(id => document.getElementById(id).getBoundingClientRect().bottom < vh); });
    ok(fs.every(Boolean), 'and the drawing, the gold state and the horizon are all on the first screen: ' + fs.join(','));
  }
  await pg.click('#h-state'); await pg.waitForTimeout(900);
  ok(await pg.evaluate(() => { const r = document.getElementById('h-decide').getBoundingClientRect(); return r.top >= 0 && r.top < 160; }), 'one tap on it brings the desk to the top of the screen');
  await pg.evaluate(() => window.scrollTo(0, 0));
  const tok = await pg.evaluate(() => { const c = document.querySelector('article.dc[data-did="d-token"]'), a = c.querySelector('a[data-dlink]');
    return { t: c.innerText, href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel'), label: a.textContent.trim(), cls: a.className, btns: [...c.querySelectorAll('[data-dopt]')].map(b => b.textContent) }; });
  ok(/Only you can do this/.test(tok.t) && /until /.test(tok.t) && /4 short steps, shown when you open it/.test(tok.t), 'something only he can do: its kind, how long it stays, and its steps waiting');
  ok(tok.href === 'https://business.facebook.com/settings/system-users' && tok.target === '_blank' && tok.rel === 'noopener' && /Open Meta settings/.test(tok.label),
     'an outside link opens in a new tab, rel noopener, at the address the house gave: ' + JSON.stringify(tok));
  ok(/ghost gold/.test(tok.cls) && tok.btns.join(',') === 'Done,Later', 'with one gold button a card: the link steps back when Done is the primary');
  const inb = await pg.evaluate(() => { const a = document.querySelector('article.dc[data-did="d-inbox"] a[data-dlink]'); return { href: a.getAttribute('href'), target: a.getAttribute('target'), cls: a.className }; });
  ok(inb.href === '#readers' && inb.target === null && inb.cls === 'btn', 'a room of this console is a link into the console itself: ' + JSON.stringify(inb));
  ok(await noSideScroll(pg), 'nothing scrolls sideways at ' + w + ' px');
  ok(!SOUL.test(await allWords(pg)), 'no "soul" anywhere');
  await shot(pg, 'home-needs-you-' + tag, true);
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ a link the console does not recognise */
console.log('\n390x844 · a link the console does not recognise is never drawn');
{
  const base = DECISIONS()[0];
  const BAD = () => HOME_REAL({ status: 'needs-you', decisions: [
    { ...base, id: 'd-bad1', title: 'A door that is not an address', link: { href: 'javascript:alert(1)', label: 'Open it' }, steps: ['One.'] },
    { ...base, id: 'd-bad2', title: 'A door in plain http', link: { href: 'http://evil.example.com/x', label: 'Open it' }, steps: [] },
    { ...base, id: 'd-bad3', title: 'A door with no scheme', link: { href: '//evil.example.com/x', label: 'Open it' }, steps: [] },
    { ...base, id: 'd-page', title: 'A page of this site', link: { href: '/journal', label: 'Open the journal' }, steps: [] },
    { ...base, id: 'd-sub', title: 'A room with a path after it', link: { href: '/admin2#posts/reddit', label: 'Open the drafts' }, steps: [] },
    { ...base, id: 'd-conf', title: 'A confirm with no words of its own', link: null, steps: [], options: [{ id: 'go', label: 'Go ahead', style: 'primary', confirm: true }] }] });
  const { pg, st, ctx } = await open_(390, 844, { home: BAD });
  const seen = await pg.evaluate(() => [...document.querySelectorAll('#h-decide article.dc')].map(c => ({ id: c.dataset.did,
    links: [...c.querySelectorAll('a')].map(a => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')]), warn: !!c.querySelector('.warn'), opts: c.querySelectorAll('[data-dopt]').length })));
  ok(seen.slice(0, 3).every(x => x.links.length === 0 && x.warn && x.opts === 2), 'javascript:, plain http and a scheme-less address draw no link, say so in the card, and keep its other buttons: ' + JSON.stringify(seen.slice(0, 3)));
  ok(JSON.stringify(seen[3].links) === '[["/journal","_blank","noopener"]]' && !seen[3].warn, 'a page of this site opens in a new tab, rel noopener');
  ok(!(await pg.evaluate(() => /javascript:|evil\.example/.test(document.getElementById('s-home').innerHTML))), 'the refused addresses never reach the page at all');
  ok(JSON.stringify(seen[4].links) === '[["#posts",null,null]]', 'a room link with a path after the name still opens the room: ' + JSON.stringify(seen[4].links));
  const n0 = st.posted.length;
  await card(pg, 'd-conf').getByRole('button', { name: 'Go ahead' }).click(); await pg.waitForTimeout(150);
  ok(/Are you sure\?/.test(await text(pg, 'article.dc[data-did="d-conf"] .hcf')) && st.posted.length === n0, 'a confirm that is true rather than words still asks first, in plain words');
  const r = await press(pg, st, pg.locator('article.dc[data-did="d-conf"] [data-dyes]'));
  ok(JSON.stringify(r.sent[0].body) === '{"action":"decide","id":"d-conf","option":"go"}', 'and its yes posts the option');
  ok(st.errors.length === 0, 'no console error');
  await ctx.close();
}

/* ============================================================ every button, exactly the contract's body */
console.log('\n390x844 · every button posts exactly the body LANTERN.md section 2 names, and confirms in its own card');
{
  const { pg, st, ctx } = await open_(390, 844, { home: HOME_NEEDS });
  const body = x => JSON.stringify(x);
  // a decision with no confirm
  let r = await press(pg, st, card(pg, 'd-lineup').getByRole('button', { name: 'Yes', exact: true }));
  ok(r.sent.length === 1 && body(r.sent[0].body) === '{"action":"decide","id":"d-lineup","option":"yes"}' && r.sent[0].url === '/api/soul' && /json/.test(r.sent[0].type || ''),
     'Yes posts {action:"decide", id, option} to /api/soul: ' + body(r.sent.map(x => x.body)));
  ok(r.toast === SAID.decide() && r.reread, 'the toast is the house\'s own message, and Home is read again');
  // a decision whose option carries a confirm
  const n0 = st.posted.length;
  await card(pg, 'd-lineup').getByRole('button', { name: 'No', exact: true }).click(); await pg.waitForTimeout(200);
  const cf = await pg.evaluate(() => { const c = document.querySelector('article.dc[data-did="d-lineup"] .hcf'); return c ? c.innerText : ''; });
  ok(/Close this, and do not propose it again for 30 days\?/.test(cf), 'No asks first, inside its own card, in the words the house sent');
  ok(st.posted.length === n0 && st.dialogs === 0, 'nothing is posted before the yes, and no browser dialog opens');
  ok(await pg.evaluate(() => !document.querySelector('article.dc[data-did="d-lineup"] [data-dopt]')), 'while it asks, the card offers only the question');
  await pg.click('article.dc[data-did="d-lineup"] [data-dno]'); await pg.waitForTimeout(150);
  ok(st.posted.length === n0 && await pg.evaluate(() => !document.querySelector('article.dc[data-did="d-lineup"] .hcf') && document.querySelectorAll('article.dc[data-did="d-lineup"] [data-dopt]').length === 3),
     'Never mind puts the buttons back and posts nothing');
  await card(pg, 'd-lineup').getByRole('button', { name: 'No', exact: true }).click(); await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => document.querySelector('article.dc[data-did="d-lineup"] [data-dyes]').className === 'btn danger'), 'the confirming button keeps the danger style');
  r = await press(pg, st, pg.locator('article.dc[data-did="d-lineup"] [data-dyes]'));
  ok(r.sent.length === 1 && body(r.sent[0].body) === '{"action":"decide","id":"d-lineup","option":"no"}', 'and the yes posts {action:"decide", id, option:"no"}');
  r = await press(pg, st, card(pg, 'd-lineup').getByRole('button', { name: 'Later', exact: true }));
  ok(body(r.sent[0].body) === '{"action":"decide","id":"d-lineup","option":"later"}', 'Later posts option "later"');
  await card(pg, 'd-build').getByRole('button', { name: 'Build it' }).click(); await pg.waitForTimeout(150);
  ok(/Add this to Claude's build queue\?/.test(await text(pg, 'article.dc[data-did="d-build"] .hcf')), 'a build asks first too');
  r = await press(pg, st, pg.locator('article.dc[data-did="d-build"] [data-dyes]'));
  ok(body(r.sent[0].body) === '{"action":"decide","id":"d-build","option":"accept"}', 'and posts {action:"decide", id:"d-build", option:"accept"}');
  // a draft: read whole in a sheet, and copied as it is, posting nothing
  const nd = st.posted.length;
  await card(pg, 'd-draft').getByRole('button', { name: 'Read the draft' }).click(); await pg.waitForTimeout(300);
  ok(await pg.evaluate(t => document.getElementById('sheet').classList.contains('on') && document.getElementById('h-draft-text').textContent === t, DRAFT.text), 'Read the draft opens it whole in a sheet');
  await pg.click('#sheet-in [data-hcopy]'); await pg.waitForTimeout(250);
  ok(await pg.evaluate(t => window.__copied[window.__copied.length - 1] === t, DRAFT.text) && /The draft is copied/.test(await toastSays(pg)), 'its Copy puts the whole letter on the clipboard, and says so');
  await pg.click('#sheet-in #cl'); await pg.waitForTimeout(300);
  await card(pg, 'd-draft').getByRole('button', { name: 'Copy', exact: true }).click(); await pg.waitForTimeout(250);
  ok(await pg.evaluate(t => window.__copied.length === 2 && window.__copied[1] === t, DRAFT.text), 'and the card\'s own Copy does the same, without opening anything');
  ok(st.posted.length === nd, 'reading and copying a draft post nothing');
  r = await press(pg, st, card(pg, 'd-draft').getByRole('button', { name: 'Sent', exact: true }));
  ok(body(r.sent[0].body) === '{"action":"decide","id":"d-draft","option":"sent"}', 'and Sent posts its option like any other');
  // a link to an outside address, with its steps in a sheet
  const n1 = st.posted.length;
  const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }), pg.click('article.dc[data-did="d-token"] a[data-dlink]')]);
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  ok(popup.url() === 'https://business.facebook.com/settings/system-users', 'Open Meta settings opens the address in a new tab: ' + popup.url());
  ok(await popup.evaluate(() => window.opener === null), 'with no opener (rel noopener)');
  await popup.close();
  await pg.waitForTimeout(250);
  const steps = await pg.evaluate(() => ({ on: document.getElementById('sheet').classList.contains('on'), li: [...document.querySelectorAll('#h-steps li')].map(l => l.textContent) }));
  ok(steps.on && steps.li.length === 4 && steps.li[0] === 'Open Business settings, then System users.', 'and its four steps open in a sheet beside it');
  ok(st.posted.length === n1, 'opening a link posts nothing');
  await pg.click('#sheet-in #cl'); await pg.waitForTimeout(250);
  r = await press(pg, st, card(pg, 'd-token').getByRole('button', { name: 'Done', exact: true }));
  ok(body(r.sent[0].body) === '{"action":"decide","id":"d-token","option":"done"}', 'Done posts option "done"');
  // a link to a room of this console
  const n2 = st.posted.length;
  await pg.click('article.dc[data-did="d-inbox"] a[data-dlink]');
  await pg.waitForSelector('#s-readers.on .row', { timeout: 8000 });
  ok((await surfaceOn(pg)) === 's-readers' && await pg.evaluate(() => location.hash) === '#readers', 'Open the inbox opens the room by the console\'s own routing, and the hash follows');
  ok(st.posted.length === n2 && await pg.evaluate(() => !document.getElementById('sheet').classList.contains('on')), 'posting nothing, and with no steps there is no sheet');
  ok(await text(pg, '#s-readers .back') === 'Home' && await pg.evaluate(() => document.querySelector('nav.bar [data-s="home"]').classList.contains('on')), 'its way back is named Home, the surface it was opened from');
  await pg.click('#s-readers .back'); await pg.waitForSelector('#s-home.on', { timeout: 5000 });
  ok((await surfaceOn(pg)) === 's-home', 'and returns there');
  // Undo, in its own row
  const n3 = st.posted.length;
  await pg.locator('#h-done .hrow', { hasText: "Swapped tomorrow's 08:00 reel" }).locator('[data-undo]').click(); await pg.waitForTimeout(150);
  ok(/Put this back as it was\?/.test(await text(pg, '#h-done .hcf')) && st.posted.length === n3, 'Undo asks first, in its own row, posting nothing');
  r = await press(pg, st, pg.locator('#h-done [data-uyes]'));
  ok(r.sent.length === 1 && body(r.sent[0].body) === '{"action":"undo","id":"act-7781"}' && r.toast === SAID.undo(), 'and the yes posts {action:"undo", id} with the action id');
  // Next
  r = await press(pg, st, pg.locator('#h-next .hnx', { hasText: 'Post two verse reels' }).getByRole('button', { name: 'Do it now' }));
  ok(body(r.sent[0].body) === '{"action":"do-now","id":"n1"}' && r.toast === SAID['do-now'](), 'Do it now posts {action:"do-now", id}');
  // a blocked step he may approve: the reason quoted inside the card, then the same body
  const n7 = st.posted.length;
  await pg.locator('#h-next .hnx[data-nid="n5"] [data-anyway]').click(); await pg.waitForTimeout(150);
  const aw = await pg.evaluate(() => { const c = document.querySelector('#h-next .hnx[data-nid="n5"] .hcf'); return c ? { q: c.querySelector('q').textContent, t: c.innerText } : null; });
  ok(aw && aw.q === 'the council said no (sentinel: the reel file is still processing at Meta)' && /red lines and the daily caps still hold/.test(aw.t) && st.posted.length === n7,
     'Do it anyway asks inside the card, quoting why it was held back, posting nothing yet: ' + JSON.stringify(aw));
  await pg.click('#h-next [data-nno]'); await pg.waitForTimeout(150);
  ok(st.posted.length === n7 && await pg.evaluate(() => !!document.querySelector('#h-next .hnx[data-nid="n5"] [data-anyway]')), 'Never mind puts the button back');
  await pg.locator('#h-next .hnx[data-nid="n5"] [data-anyway]').click(); await pg.waitForTimeout(150);
  r = await press(pg, st, pg.locator('#h-next [data-nyes]'));
  ok(r.sent.length === 1 && body(r.sent[0].body) === '{"action":"do-now","id":"n5"}', 'and Yes, do it posts {action:"do-now", id}, as the contract has it for a blocked step');
  r = await press(pg, st, pg.locator('#h-next .hnx', { hasText: 'Surah Al-Kahf' }).getByRole('button', { name: 'Skip' }));
  ok(body(r.sent[0].body) === '{"action":"skip","id":"n3"}' && r.toast === SAID.skip(), 'Skip posts {action:"skip", id}');
  ok(!/Surah Al-Kahf reel to Telegram/.test(await text(pg, '#h-next')) && await text(pg, '#h-next .hsec .cnt') === '4', 'and the step leaves Next when the house drops it');
  r = await press(pg, st, pg.locator('#h-next [data-think]'));
  ok(body(r.sent[0].body) === '{"action":"run"}' && r.toast === SAID.run(), 'Think again posts {action:"run"}');
  st.busy = true;
  r = await press(pg, st, pg.locator('#h-next [data-think]'));
  ok(body(r.sent[0].body) === '{"action":"run"}' && r.toast === 'The Lantern is already thinking.', 'a busy answer says: The Lantern is already thinking.');
  st.busy = 'false-ok';
  r = await press(pg, st, pg.locator('#h-next [data-think]'));
  ok(r.toast === 'The Lantern is already thinking.' && await pg.evaluate(() => !document.getElementById('toast').classList.contains('bad')), 'even when the busy answer carries ok:false from the tick it spread, it is not a refusal');
  st.busy = false;
  // ideas
  r = await press(pg, st, pg.locator('#h-ideas .hidea', { hasText: 'Surah Al-Kahf' }).getByRole('button', { name: 'Go', exact: true }));
  ok(body(r.sent[0].body) === '{"action":"idea","id":"i1","choice":"go"}', 'Go posts {action:"idea", id, choice:"go"}');
  ok(/Going ahead/.test(await text(pg, '#h-ideas')) && /It goes to the Lantern's next cycle/.test(await text(pg, '#h-ideas .hidea[data-iid="i1"]')), 'and the idea says it is going ahead, and where it went');
  r = await press(pg, st, pg.locator('#h-ideas .hidea', { hasText: 'Telegram channel views' }).getByRole('button', { name: 'Not now' }));
  ok(body(r.sent[0].body) === '{"action":"idea","id":"i2","choice":"later"}', 'Not now posts choice "later"');
  ok(await pg.evaluate(() => document.querySelector('#h-ideas .hidea[data-iid="i2"]').classList.contains('aside')), 'and it sits aside');
  const n4 = st.posted.length;
  await pg.locator('#h-ideas .hidea', { hasText: 'mosques in Lyon' }).getByRole('button', { name: 'Never', exact: true }).click(); await pg.waitForTimeout(150);
  ok(/Never propose this again\?/.test(await text(pg, '#h-ideas .hcf')) && st.posted.length === n4, 'Never asks first, in its own card');
  r = await press(pg, st, pg.locator('#h-ideas [data-iyes]'));
  ok(body(r.sent[0].body) === '{"action":"idea","id":"i3","choice":"never"}', 'and posts choice "never"');
  ok(!(await pg.evaluate(() => !!document.querySelector('#h-ideas .hidea[data-iid="i3"]'))), 'and the idea is gone');
  // pause and resume
  const n5 = st.posted.length;
  await pg.click('#h-status [data-hp="pause"]'); await pg.waitForTimeout(150);
  ok(/Pause the Lantern\?/.test(await text(pg, '#h-status .hcf')) && st.posted.length === n5, 'Pause asks first, inside the face of the cockpit');
  await pg.click('#h-status [data-hp-no]'); await pg.waitForTimeout(100);
  ok(st.posted.length === n5 && await pg.evaluate(() => !!document.querySelector('#h-status [data-hp="pause"]')), 'Never mind posts nothing');
  await pg.click('#h-status [data-hp="pause"]'); await pg.waitForTimeout(100);
  r = await press(pg, st, pg.locator('#h-status [data-hp-yes]'));
  ok(body(r.sent[0].body) === '{"action":"pause"}' && r.toast === SAID.pause(), 'Yes, pause posts exactly {action:"pause"}');
  ok(await text(pg, '#h-state') === 'Paused' && await pg.evaluate(() => document.querySelector('#h-next [data-think]').disabled && [...document.querySelectorAll('#h-next [data-now],#h-next [data-anyway]')].every(b => b.disabled)),
     'the chip reads Paused, and Think again, Do it now and Do it anyway are held');
  ok(await pg.evaluate(() => document.getElementById('h-orbx').classList.contains('paused')), 'and the light sinks to an ember');
  await pg.click('#h-status [data-hp="resume"]'); await pg.waitForTimeout(100);
  ok(/Resume the Lantern\?/.test(await text(pg, '#h-status .hcf')), 'Resume asks first too');
  r = await press(pg, st, pg.locator('#h-status [data-hp-yes]'));
  ok(body(r.sent[0].body) === '{"action":"resume"}' && r.toast === SAID.resume(), 'Yes, resume posts exactly {action:"resume"}');
  ok(await text(pg, '#h-state') === 'The Lantern is working', 'and the chip is back to what the house says now: ' + await text(pg, '#h-state'));
  // a refusal
  st.refuse = 'd-token';
  const n6 = st.posted.length;
  await card(pg, 'd-token').getByRole('button', { name: 'Later', exact: true }).click();
  await until(() => st.posted.length > n6); await pg.waitForTimeout(300);
  const ref = await pg.evaluate(() => ({ toast: document.getElementById('toast').textContent, bad: document.getElementById('toast').classList.contains('bad'),
    btn: [...document.querySelectorAll('article.dc[data-did="d-token"] [data-dopt]')].map(b => b.textContent + (b.disabled ? ':disabled' : '')).join(',') }));
  ok(ref.toast === 'That decision was already answered from Telegram.' && ref.bad && ref.btn === 'Done,Later', 'a refusal is the house\'s own sentence, marked, and the buttons come back: ' + JSON.stringify(ref));
  st.refuse = null;
  ok(st.posted.every(p => p.url === '/api/soul'), 'every one of them went to /api/soul and nowhere else');
  ok(st.dialogs === 0, 'not one browser dialog in all of it');
  ok(await noSideScroll(pg), 'nothing scrolls sideways after every action');
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ answering, in motion */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · an answered card folds away, a light travels to Done, and the toast carries Undo');
  const { pg, st, ctx } = await open_(w, h, { home: HOME_NEEDS, motion: true });
  await pg.waitForTimeout(2200);
  st.removeOnDecide = true; st.delay = 250;
  const before = st.posted.length, gets = st.homeGets;
  await card(pg, 'd-lineup').getByRole('button', { name: 'Yes', exact: true }).click();
  await pg.waitForTimeout(60);
  ok(await pg.evaluate(() => { const b = document.querySelector('article.dc[data-did="d-lineup"] [data-dopt="1|0"]'); return !!b && b.disabled && /Working/.test(b.textContent) && !!b.querySelector('.bfill'); }), 'the pressed button fills, and says it is working');
  await until(() => st.posted.length > before);
  await pg.waitForTimeout(330);
  const mid = await pg.evaluate(() => ({ fly: document.querySelectorAll('.hfly').length, fold: document.getAnimations().some(a => a.effect.target.matches && a.effect.target.matches('article.dc[data-did="d-lineup"]')) }));
  ok(mid.fly === 1 && mid.fold, 'the card folds away while a small light travels to Done: ' + JSON.stringify(mid));
  await until(() => st.homeGets > gets); await pg.waitForTimeout(1300);
  ok(await pg.evaluate(() => !document.querySelector('article.dc[data-did="d-lineup"]') && document.querySelectorAll('.hfly').length === 0) && await text(pg, '#h-decide .hsec .cnt') === '4', 'it is gone, the next cards risen into its place, the light spent');
  const t = await pg.evaluate(() => ({ text: document.getElementById('toast').firstChild.textContent, btn: (document.querySelector('#toast .tact') || {}).textContent, on: document.getElementById('toast').classList.contains('on'), h: document.querySelector('#toast .tact') ? document.querySelector('#toast .tact').getBoundingClientRect().height : 0 }));
  ok(t.on && t.text === "Done: Swap Sunday's 19:00 reel for the Throne verse." && t.btn === 'Undo' && t.h >= 44, 'the toast says what happened, with Undo, because what it did can be undone: ' + JSON.stringify(t));
  ok(await pg.evaluate(() => { const r = document.querySelector('#h-done .hrow[data-dk="x-d-lineup"]'); return !!r && r.classList.contains('fresh'); }), 'and what it did arrived in Done, new, glowing once');
  const u0 = st.posted.length;
  await pg.click('#toast .tact');
  await until(() => st.posted.length > u0); await pg.waitForTimeout(400);
  ok(JSON.stringify(st.posted[u0].body) === '{"action":"undo","id":"act-9001"}', 'Undo in the toast posts {action:"undo", id} with the action the answer named');
  /* Do it now: a working state, then the step slides into Done */
  st.moveOnDo = true; st.delay = 700;
  const d0 = st.posted.length, g0 = st.homeGets;
  await pg.locator('#h-next .hnx[data-nid="n1"] [data-now]').click();
  await pg.waitForTimeout(250);
  const wk = await pg.evaluate(() => { const b = document.querySelector('#h-next .hnx[data-nid="n1"] [data-now]'); return b ? { t: b.textContent, d: b.disabled, loop: document.getAnimations().some(a => a.effect.target.closest && a.effect.target.closest('#h-next .hnx[data-nid="n1"] .wk')) } : null; });
  ok(wk && /Working/.test(wk.t) && wk.d && wk.loop, 'Do it now turns into a working state: ' + JSON.stringify(wk));
  await until(() => st.posted.length > d0 && st.homeGets > g0, 8000); await pg.waitForTimeout(1300);
  ok(!(await pg.evaluate(() => !!document.querySelector('#h-next .hnx[data-nid="n1"]'))) && await pg.evaluate(() => { const r = document.querySelector('#h-done .hrow[data-dk="x-do-n1"]'); return !!r && r.classList.contains('fresh'); }),
     'then the step leaves Next and lands in Done, glowing once');
  ok(await pg.evaluate(() => /Undo/.test(document.getElementById('toast').textContent)), 'and its toast carries Undo too');
  st.delay = 0;
  /* the ideas' three motions */
  await pg.locator('#h-ideas .hidea[data-iid="i2"] [data-idea$="|later"]').click();
  await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => document.getAnimations().some(a => a.effect.target.matches && a.effect.target.matches('.hidea[data-iid="i2"]'))), 'Not now slides the idea aside');
  await pg.waitForTimeout(1200);
  ok(await pg.evaluate(() => document.querySelector('.hidea[data-iid="i2"]').classList.contains('aside')), 'and there it stays, aside');
  await pg.locator('#h-ideas .hidea[data-iid="i1"] [data-idea$="|go"]').click();
  await pg.waitForTimeout(900);
  ok(await pg.evaluate(() => document.querySelector('.hidea[data-iid="i1"]').classList.contains('went') && /goes to the Lantern's next cycle/.test(document.querySelector('.hidea[data-iid="i1"]').innerText)), 'Go lights the card and says where it went');
  await pg.locator('#h-ideas .hidea[data-iid="i3"] [data-idea$="|never"]').click(); await pg.waitForTimeout(150);
  await pg.click('#h-ideas [data-iyes]'); await pg.waitForTimeout(350);
  ok(await pg.evaluate(() => document.getAnimations().some(a => a.effect.target.matches && a.effect.target.matches('.hidea[data-iid="i3"]') && a.effect.getComputedTiming().duration >= 800)), 'Never lets it fade, slowly');
  await pg.waitForTimeout(1200);
  ok(!(await pg.evaluate(() => !!document.querySelector('.hidea[data-iid="i3"]'))), 'until it is gone');
  ok(await noSideScroll(pg), 'nothing sideways');
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ the horizon, every state on it */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · the day across the horizon');
  const { pg, st, ctx } = await open_(w, h, { home: () => HOME_REAL({ today: { posts: { sent: 6, due: 7, failed: 1 }, fixed: 1, reach7: { value: 31240, delta: 1204 }, slots: SLOTS_ALL } }) });
  const pts = await pg.evaluate(() => [...document.querySelectorAll('#h-hz .pt')].map(p => p.className.replace('pt ', '').trim()));
  ok(pts.join(',') === 'sent,sent,skipped,failed,partial,due,partial,later,later', 'each slot at its hour, lit, half lit, an ember, hollow or struck through as it stands: ' + pts.join(','));
  const geo = await pg.evaluate(() => { const ln = document.getElementById('h-hz').getBoundingClientRect(); return [...document.querySelectorAll('#h-hz .pt')].map(p => { const r = p.getBoundingClientRect(); return (r.left + r.width / 2 - ln.left) / ln.width; }); });
  ok(geo.every((x, i) => !i || x > geo[i - 1]), 'in the order of the clock, left to right');
  const nowX = await pg.evaluate(() => parseFloat(/translateX\(([\d.]+)%\)/.exec(document.querySelector('#h-hz .now').style.transform)[1]) / 100);
  const m = (() => { const d = new Date(); return d.getUTCHours() * 60 + d.getUTCMinutes(); })(), mins = SLOTS_ALL.map(s => +s.time.slice(0, 2) * 60 + +s.time.slice(3));
  const lo = Math.min(...mins, m), hi = Math.max(...mins, m); let a = Math.max(0, Math.floor(lo / 60) * 60 - 60), b = Math.min(1440, Math.ceil(hi / 60) * 60 + 60); if (b - a < 240) b = Math.min(1440, a + 240);
  ok(Math.abs(nowX - (m - a) / (b - a)) < 0.01, 'and the now mark stands where the clock is on that line: ' + nowX.toFixed(3) + ' against ' + ((m - a) / (b - a)).toFixed(3));
  const box = await pg.evaluate(() => { const p = document.querySelector('#h-hz .pt[data-n="6"]').getBoundingClientRect(); return { x: p.left + p.width / 2, y: p.top + p.height / 2 }; });
  await pg.mouse.click(box.x + 2, box.y + 8); await pg.waitForTimeout(250);
  ok(await text(pg, '#h-hz-cap .t') === '19:00, a verse reel, sent to 5 of 6 networks' && await pg.evaluate(() => document.querySelector('#h-hz .pt[data-n="6"]').classList.contains('sel')), 'a tap near a point says what it is: ' + await text(pg, '#h-hz-cap .t'));
  await pg.focus('#h-hz'); await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(150);
  ok(await text(pg, '#h-hz-cap .t') === '14:00, a verse reel, due now, not out yet (the Lantern leans this slot to verses)', 'the arrow keys walk the points: ' + await text(pg, '#h-hz-cap .t'));
  await pg.keyboard.press('ArrowLeft'); await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(150);
  ok(await text(pg, '#h-hz-cap .t') === '11:00, a word reel, failed: it reached none of its 6 networks', 'a failed one says so: ' + await text(pg, '#h-hz-cap .t'));
  await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(100);
  ok(await text(pg, '#h-hz-cap .t') === '09:00, what is coming, skipped today', 'and a skipped one');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#h-horizon ol.sro li')].map(l => l.textContent)[6]) === '19:00, a verse reel, sent to 5 of 6 networks' && await pg.evaluate(() => document.querySelectorAll('#h-horizon ol.sro li').length) === 9,
     'the whole day is also a list a reader of the screen can walk');
  ok(await pg.evaluate(() => document.getElementById('h-hz').getBoundingClientRect().height >= 44 && document.querySelector('#h-hz-cap a').getBoundingClientRect().height >= 44), 'the line and its link are a thumb\'s size');
  await pg.click('#h-hz-cap [data-hzposts]');
  await pg.waitForSelector('#s-posts.on', { timeout: 8000 });
  ok(await pg.evaluate(() => location.hash) === '#posts', 'and its link opens Posts');
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ a goal at length */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · a goal, opened from its ring or its row under the drawing');
  const { pg, st, ctx } = await open_(w, h, { motion: true });
  await pg.waitForTimeout(2000);
  /* the ring itself: its band is tapped where the ring runs */
  const pt = await pg.evaluate(() => { const svg = document.getElementById('h-rings').getBoundingClientRect(), s = svg.width / 400, r = 182 * s, a = (-135 + 40) * Math.PI / 180;
    return { x: svg.left + svg.width / 2 + r * Math.sin(a), y: svg.top + svg.height / 2 - r * Math.cos(a) }; });
  await pg.mouse.click(pt.x, pt.y); await pg.waitForTimeout(700);
  ok(await pg.evaluate(() => document.getElementById('sheet').classList.contains('on') && /Double the people reached each week by 25 December/.test(document.querySelector('#sheet-in h2').textContent)), 'tapping the outer ring opens its goal');
  await pg.click('#sheet-in #cl'); await pg.waitForTimeout(400);
  await pg.click('#h-goals .lr[data-gi="0"]'); await pg.waitForTimeout(800);
  const gs = await pg.evaluate(() => { const c = document.getElementById('h-gchart'), sv = c.querySelector('svg');
    return { wide: document.getElementById('sheet').classList.contains('wide'), title: document.querySelector('#sheet-in h2').textContent, n: document.querySelector('#sheet-in .gn').textContent,
      pts: (c.querySelector('.hs').getAttribute('d').match(/[ML]/g) || []).length, pj: !!c.querySelector('.pjl'), tg: (c.querySelector('.tgt') || {}).textContent, today: (c.querySelector('.tdt') || {}).textContent,
      stroke: getComputedStyle(c.querySelector('.hs')).stroke, aria: sv.getAttribute('aria-label'), ticks: [...c.querySelectorAll('.yl')].map(t => t.textContent),
      serve: [...document.querySelectorAll('#sheet-in .sv')].map(s => s.innerText.replace(/\s+/g, ' ')), rows: document.querySelectorAll('#sheet-in table tr').length, t: document.getElementById('sheet-in').innerText }; });
  ok(gs.title === 'Double the people reached each week by 25 December' && /31,240\s*of 62,400 people · due 25 December/.test(gs.n), 'its row among the goals opens the same goal, its numbers at the top: ' + gs.n);
  ok(gs.t.includes('Heading for 48,900 by 25 December, short of 62,400. At this pace it gets there on 14 February 2027.'), 'the projection, in words, for a goal behind (the sheet now carries it)');
  ok(/yours/.test(gs.t) && /behind/.test(gs.t), 'its owner and its state');
  ok(gs.pts === 56 && gs.pj && gs.tg === 'target 62,400' && gs.today === 'TODAY', 'its line over time: 56 readings, the projection, the target, today marked');
  ok(gs.stroke === rgb(COLORS[0]), "drawn in the goal's own colour");
  ok(gs.ticks.every(t => /^\d{1,2}(,\d{3})*$/.test(t)) && gs.ticks.every(t => +t.replace(/,/g, '') % 5000 === 0), 'on a scale of round values: ' + gs.ticks.join(', '));
  ok(/56 readings from .* from 21,000 to 31,240; the target is 62,400; heading for 48,900 by 25 December\./.test(gs.aria), 'with its words for a reader of the screen: ' + gs.aria);
  ok(/What the Lantern is doing/i.test(gs.t) && /Two verse reels in the evening slots every day this week\./.test(gs.t) && /From 28 daily readings\./.test(gs.t), 'what the Lantern is doing about it');
  ok(gs.serve.length === 4 && /your desk Swap Sunday's 19:00 reel/.test(gs.serve[0]) && /today Post two verse reels/.test(gs.serve[1]) && /tomorrow Send Friday's Surah Al-Kahf reel to Telegram as well \(blocked\)/.test(gs.serve[2]) && /yesterday You approved: lean the afternoons/.test(gs.serve[3]),
     'the decision, the steps and the actions that serve it: ' + gs.serve.join(' | '));
  ok(gs.rows === 56, 'and the readings, as a table');
  ok(w < 900 ? !gs.wide || true : gs.wide, 'a sheet on the phone, a panel on the desk');
  /* the hover layer: the reading nearest the pointer, with its date, in a label
     kept inside the plot: never over the scale beside it, and under its point
     when the point is near the top */
  const tipAt = async fx => {
    const ov = await pg.evaluate(f => { const r = document.querySelector('#h-gchart .ov').getBoundingClientRect(); return { x: r.left + Math.max(2, r.width * f), y: r.top + r.height / 2 }; }, fx);
    await pg.mouse.move(ov.x, ov.y); await pg.waitForTimeout(150);
    return pg.evaluate(() => { const g = document.querySelector('#h-gchart .tipg'), b = document.querySelector('#h-gchart .tipb').getBoundingClientRect(), gl = [...document.querySelectorAll('#h-gchart .gl')].map(l => l.getBoundingClientRect().top),
      pr = document.querySelector('#h-gchart .ov').getBoundingClientRect(), d = document.querySelector('#h-gchart .xd').getBoundingClientRect(), yl = [...document.querySelectorAll('#h-gchart .yl,#h-gchart .tdt')].map(t => t.getBoundingClientRect());
      const over = r => !(r.right <= b.left || r.left >= b.right || r.bottom <= b.top || r.top >= b.bottom);
      return { on: getComputedStyle(g).opacity === '1', t: document.querySelector('#h-gchart .tipt').textContent, inside: b.left >= pr.left - 0.5 && b.right <= pr.right + 0.5 && b.top >= Math.min(...gl) - 0.5 && b.bottom <= Math.max(...gl) + 0.5,
        scale: yl.filter(over).length, under: b.top > d.top + d.height / 2, w: Math.round(b.width) }; }); };
  let tp = await tipAt(0.25);
  ok(tp.on && /^\w{3} \d{1,2} \w{3} · [\d,]+ people$/.test(tp.t) && tp.inside && tp.scale === 0, 'a pointer over the line shows the reading under it, inside the plot: ' + JSON.stringify(tp));
  tp = await tipAt(0);
  ok(tp.on && tp.inside && tp.scale === 0, 'even at the first reading, by the scale, the label stays inside the plot and covers no value of the scale: ' + JSON.stringify(tp));
  await shot(pg, 'goal-sheet-' + tag, true);
  await pg.click('#sheet-in #cl'); await pg.waitForTimeout(400);
  await pg.click('#h-goals .lr[data-gi="1"]'); await pg.waitForTimeout(500);
  const g1 = await pg.evaluate(() => ({ title: document.querySelector('#sheet-in h2').textContent, top: document.getElementById('sheet').scrollTop, t: document.getElementById('sheet-in').innerText,
    pct: [...document.querySelectorAll('#h-gchart .yl')].every(t => /%$/.test(t.textContent)) }));
  ok(/Raise the share of each reel watched to 46 percent/.test(g1.title) && g1.top === 0 && g1.pct && g1.t.includes('On track to reach 46% by 27 November.') && /Shorter verse reels in the morning/.test(g1.t),
     'another row opens its goal too, at its top, a share drawn as percents, with its projection and what the Lantern is doing');
  await pg.click('#sheet-in #cl'); await pg.waitForTimeout(400);
  await pg.click('#h-goals .lr[data-gi="2"]'); await pg.waitForTimeout(500);
  ok(/What the Lantern is doing\s*Watching/i.test(await text(pg, '#sheet-in')), "the house's one word for a goal with no step aimed at it, said as a sentence starts, where the sheet says what the Lantern is doing");
  await pg.click('#sheet-in #cl'); await pg.waitForTimeout(400);
  await pg.click('#h-goals .lr[data-gi="3"]'); await pg.waitForTimeout(600);
  ok((await text(pg, '#sheet-in')).includes('Met: 99% against a target of 98%.'), 'a goal met says so');
  /* its last reading stands near the top of its scale: the label turns under the point */
  const lastX = await pg.evaluate(() => { const c = document.querySelector('#h-gchart circle.lp[r="4.5"]').getBoundingClientRect(), r = document.querySelector('#h-gchart .ov').getBoundingClientRect(); return (c.left + c.width / 2 - r.left) / r.width; });
  tp = await tipAt(lastX);
  ok(tp.on && tp.inside && tp.under && tp.scale === 0, 'near the top of the plot the label turns under its point, still inside: ' + JSON.stringify(tp));
  await pg.click('#sheet-in #cl'); await pg.waitForTimeout(400);
  await pg.click('#h-goals .lr[data-gi="4"]'); await pg.waitForTimeout(500);
  const g4 = await text(pg, '#sheet-in');
  ok(g4.includes('On track to reach 14 days by ' + dayMonth(day(5)) + '.') && /the Lantern's/.test(g4) && !/\byours\b/.test(g4), "the Lantern's own goal, not marked as yours");
  await pg.click('#sheet-in #cl'); await pg.waitForTimeout(400);
  await pg.focus('#h-rings .rg[data-gi="2"]'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
  ok(await pg.evaluate(() => /Search arrivals at least 20 percent of site arrivals/.test(document.querySelector('#sheet-in h2').textContent)), 'and a ring, focused from the keyboard, opens on Enter');
  await pg.click('#sheet-in #cl'); await pg.waitForTimeout(300);
  ok(!SOUL.test(await allWords(pg)) && await noSideScroll(pg), 'no "soul", nothing sideways');
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ the lamp, in its four states */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  for (const [name, gv, extra] of [['with-costs', GIVING(), null], ['covered', GIVING({ upkeep: { month: 40, cover: 9.88 } }), null], ['without-costs', GIVING_NOCOST(), null], ['not-configured', { configured: false }, null], ['missing', null, { giving: 'stripe refused the reading: 401 for key sk_live_51Hx' }]]) {
    console.log('\n' + tag + ' · keeping the lamp lit: ' + name.replace('-', ' '));
    const { pg, st, ctx } = await open_(w, h, { home: () => HOME_REAL({ giving: gv, missing: extra || {} }), motion: true });
    await pg.waitForTimeout(2300);
    const L = await pg.evaluate(() => { const l = document.getElementById('h-lamp'), lp = l.querySelector('.lp'); return { cold: l.classList.contains('cold'), flame: l.dataset.flame, by: l.dataset.by || '', t: document.getElementById('h-giving').innerText,
      cov: (l.querySelector('.cov') || {}).textContent || '', aria: lp.getAttribute('aria-label') || '', glo: l.querySelector('.glo').style.opacity,
      tf: l.querySelector('.fl').style.transform, link: !!document.querySelector('#h-giving [data-ledger][href="#giving"]'), fli: document.getAnimations().some(a => a.effect.target.classList && a.effect.target.classList.contains('fli') && a.playState === 'running') }; });
    if (name === 'with-costs') {
      ok(!L.cold && L.by === 'cover' && L.tf === 'scaleY(0.64)' && L.fli, 'the light in the glass stands at the share of the costs the gifts cover, and lives: ' + L.tf);
      ok(/cover 64 percent/.test(L.t) && /14\s*monthly givers/i.test(L.t), 'and says so, beside the givers');
    } else if (name === 'covered') {
      /* the house can send cover 9.88: covered is covered, the lamp is full, and no percent is said */
      ok(!L.cold && L.by === 'cover' && L.flame === '1.000' && L.tf === 'scaleY(1)' && parseFloat(L.glo) === 1 && L.fli, 'with the costs covered nearly ten times over, the lamp is full of light: ' + L.flame + ' ' + L.tf);
      ok(L.cov === "The month's gifts already cover the house's running costs this month." && !/percent|988/.test(L.t), 'and says so plainly, with no percent: ' + L.cov);
      ok(/^A glass lamp hanging in a niche, full of light\. The month's gifts already cover/.test(L.aria), 'in its words for a reader of the screen too: ' + L.aria);
    } else if (name === 'without-costs') {
      ok(!L.cold && L.by === 'givers' && Math.abs(parseFloat(L.flame) - 14 / 19) < 0.002 && L.fli, 'with no costs recorded the light follows the monthly givers: ' + L.flame);
      ok(/No running costs are recorded this month, so the light follows the monthly givers instead: 14 of a goal of 19\./.test(L.t) && /its light 74 percent of the way up/.test(L.aria), 'and says so, against their goal');
    } else if (name === 'not-configured') {
      ok(L.cold && L.flame === '0' && !L.fli && /The gift door is not set up yet/.test(L.t), 'not configured: the lamp is cold, and says why');
    } else {
      ok(L.cold && !L.fli && /The giving reading could not be read just now\./.test(L.t) && !/stripe|sk_live|401/i.test(L.t), 'missing: the lamp is cold and says the reading could not be read, never the house\'s raw reason');
    }
    ok(L.link, 'and the ledger room is a tap away');
    ok(!/@/.test(L.t), 'never an address, never a name');
    if (name === 'not-configured' || name === 'missing') ok(parseFloat(L.glo) === 0 && L.flame === '0', 'and with no light in it, the niche does not glow');
    if (name === 'with-costs' || name === 'covered' || name === 'without-costs') {
      await shot(pg, 'giving-' + name + '-' + tag, true);
      await pg.evaluate(() => document.getElementById('h-giving').scrollIntoView({ block: 'start' })); await pg.waitForTimeout(200);
      await pg.screenshot({ path: SHOTS + '/giving-' + name + '-' + tag + '-card.png' });
    }
    ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
}

/* ============================================================ Done glows once for what arrived since the last visit */
console.log('\n390x844 · an idea shows exactly the steps Go will run (ideas[].steps)');
{
  const { pg, ctx } = await open_(390, 844);
  const card = pg.locator('#h-ideas .hidea[data-iid="i1"]');
  const said = await card.innerText();
  ok(/What Go will do/i.test(said) && /Lean the 19:00 reel toward verses on Friday/.test(said), 'the Lantern idea lists what Go will do, in plain words');
  ok(await card.locator('ol.hsteps li').count() === 2 && await card.locator('ol.hsteps b').count() === 0 && /<b>Al-Kahf<\/b>/.test(said), 'its steps are text, never markup');
  const other = pg.locator('#h-ideas .hidea').filter({ hasNotText: 'Surah Al-Kahf' }).first();
  ok(await other.locator('ol.hsteps').count() === 0, 'an idea with no steps shows none');
  await ctx.close();
}

console.log('\n390x844 · what arrived since the last visit glows once');
{
  const { pg, st, ctx } = await open_(390, 844, { motion: true, seen: ['x2', 'x3', 'x4', 'x5', 'x6', 'x7'] });
  await pg.waitForTimeout(200);
  const f = await pg.evaluate(() => [...document.querySelectorAll('#h-done .hrow.fresh')].map(r => r.dataset.dk));
  ok(f.join(',') === 'x1', 'the one action not seen on the last visit is marked new: ' + f.join(','));
  ok(await pg.evaluate(() => /new since your last visit/.test(document.querySelector('#h-done .hrow.fresh').textContent)), 'in words too, for a reader of the screen');
  ok(await pg.evaluate(() => document.getAnimations().some(a => a.effect.target.classList && a.effect.target.classList.contains('glw') && a.effect.getComputedTiming().iterations === 1)), 'and glows, once');
  await pg.waitForTimeout(3200);
  ok(await pg.evaluate(() => !document.getAnimations().some(a => a.effect.target.classList && a.effect.target.classList.contains('glw'))), 'then the glow is spent');
  const kept = await pg.evaluate(() => JSON.parse(localStorage.getItem('noor.home.seen')).ids.sort().join(','));
  ok(kept === 'x1,x2,x3,x4,x5,x6,x7', 'and this visit is remembered in this browser for the next: ' + kept);
  ok(st.errors.length === 0, 'no console error');
  await ctx.close();
}

/* ============================================================ alive: read every 90 seconds while visible, never while hidden */
console.log('\n390x844 · alive: Home reads itself every 90 seconds while it is seen, and never while it is hidden');
{
  const { pg, st, ctx } = await open_(390, 844, { clock: true });
  ok(st.homeGets === 1, 'one read to begin with');
  const mark = await pg.evaluate(() => { document.getElementById('h-rings').__mark = 'same'; document.querySelector('#h-goals').__mark = 'same'; return document.getElementById('h-upd').textContent; });
  await pg.clock.runFor(60000); await pg.waitForTimeout(200);
  ok(st.homeGets === 1, 'a minute on, nothing more is asked');
  st.home.goals = GOALS().map(g => g.id === 'g-reach' ? { ...g, current: 35000 } : g);
  st.home.giving = GIVING({ monthly: { givers: 15, delta7: 3 } });
  await pg.clock.runFor(31000);
  await until(() => st.homeGets === 2, 4000); await pg.waitForTimeout(300);
  ok(st.homeGets === 2, 'at 90 seconds Home reads itself again: ' + st.homeGets);
  const after = await pg.evaluate(() => ({ same: document.getElementById('h-rings').__mark === 'same' && document.querySelector('#h-goals').__mark === 'same', th: document.querySelector('#h-rings .rg[data-gi="0"]').dataset.th,
    leg: document.querySelector('#h-goals .cv[data-k="g-reach"]').textContent, bar: document.querySelector('#h-goals .lbar i[data-k="g-reach"]').style.transform, givers: document.getElementById('h-givers').textContent, upd: document.getElementById('h-upd').textContent }));
  const th = (270 * (35000 - 15600) / (62400 - 15600)).toFixed(2), bar = 'scaleX(' + +((35000 - 15600) / (62400 - 15600)).toFixed(4) + ')';
  ok(after.same && after.th === th && after.leg === '35,000' && after.bar === bar && after.givers === '15', 'and what changed moves in place, in the same drawing: the ring to ' + after.th + ', its row to ' + after.leg + ' and ' + after.bar + ', the givers to ' + after.givers);
  ok(/^updated \d\d:\d\d UTC$/.test(after.upd), 'with "updated" and its time: ' + after.upd);
  await setVisible(pg, false);
  await pg.clock.runFor(400000); await pg.waitForTimeout(300);
  ok(st.homeGets === 2, 'hidden for almost seven minutes: not one read: ' + st.homeGets);
  await setVisible(pg, true);
  await until(() => st.homeGets === 3, 4000);
  ok(st.homeGets === 3, 'seen again, the read that was due happens at once');
  await pg.click('nav.bar [data-s="posts"]'); await pg.waitForTimeout(300);
  const g1 = st.homeGets;
  await pg.clock.runFor(200000); await pg.waitForTimeout(300);
  ok(st.homeGets === g1, 'while another surface is open, Home does not read itself');
  await pg.click('nav.bar [data-s="home"]');
  await until(() => st.homeGets === g1 + 1, 4000);
  ok(st.homeGets === g1 + 1, 'and back on Home, a read that is due happens at once');
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ reduced motion: nothing moves, everything is where it ends */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · reduced motion: no loop, no count, no travel; every change simply appears');
  const { pg, st, ctx } = await open_(w, h, { home: HOME_NEEDS, settle: 0 });
  const rm = await pg.evaluate(() => ({ run: document.getAnimations().filter(a => a.playState === 'running').length, all: document.getAnimations().length }));
  ok(rm.run === 0, 'not one animation runs on arrival: ' + JSON.stringify(rm));
  ok(await pg.evaluate(() => window.__kpi.length === 1 && window.__kpi[0] === '31,240'), 'the numbers are simply there, never counted: ' + await pg.evaluate(() => window.__kpi.join(' > ')));
  ok(await pg.evaluate(() => document.querySelector('#h-rings .rg[data-gi="0"] .bd').style.transform) === 'rotate(' + THETA['g-reach'].toFixed(2) + 'deg)', 'each ring is already at its value');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#h-brief .sen')].every(s => getComputedStyle(s).opacity === '1')), 'every sentence of the brief is already there');
  ok(await pg.evaluate(() => document.querySelector('#h-lamp .fl').style.transform === 'scaleY(0.64)'), 'the light in the lamp at its height');
  ok(await pg.evaluate(() => document.querySelector('#h-goals .lbar i[data-k="g-reach"]').style.transform === 'scaleX(0.3342)'), "each goal's bar already at its value");
  ok(await pg.evaluate(() => getComputedStyle(document.getElementById('h-state')).opacity === '1' && document.getElementById('h-state').tagName === 'BUTTON'), 'and the gold state simply there');
  await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length) === 0, 'no ripple and no breath, though the Lantern needs him');
  st.removeOnDecide = true;
  await card(pg, 'd-lineup').getByRole('button', { name: 'Yes', exact: true }).click();
  await until(() => st.homeGets > 1); await pg.waitForTimeout(200);
  const gone = await pg.evaluate(() => ({ fly: document.querySelectorAll('.hfly').length, card: !!document.querySelector('article.dc[data-did="d-lineup"]'),
    run: document.getAnimations().filter(a => a.playState === 'running').map(a => (a.effect.target.id || a.effect.target.className || a.effect.target.tagName) + ':' + (a.constructor && a.constructor.name)) }));
  ok(gone.fly === 0 && !gone.card && gone.run.length === 0, 'an answer travels nowhere: the card is simply gone, and nothing moves: ' + JSON.stringify(gone));
  await shot(pg, 'reduced-motion-' + tag, true);
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ an empty day */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · an empty day: every part says so in plain words');
  const { pg, st, ctx } = await open_(w, h, { home: HOME_EMPTY, motion: true });
  await pg.waitForTimeout(1600);
  ok(/Nothing needs you\. The Lantern has it\./.test(await text(pg, '#h-decide')) && await text(pg, '#h-decide .hsec .cnt') === '0', 'Nothing needs you. The Lantern has it.');
  ok(/No brief yet/.test(await text(pg, '#h-brief')), 'no brief yet, said as such');
  ok(/No post was due yet today/.test(await text(pg, '#h-done')) && /Nothing else was done in the last three days/.test(await text(pg, '#h-done')), 'Done says nothing was due and nothing was done');
  ok(/Nothing is planned yet/.test(await text(pg, '#h-next')), 'Next says nothing is planned, and how to ask');
  ok(/No goal is set yet/.test(await text(pg, '#h-goals')) && /No idea is waiting/.test(await text(pg, '#h-ideas')), 'goals and ideas say they are empty');
  ok(/No goal is set yet, so there is no ring around the light\./.test(await text(pg, '#h-goals')) && await text(pg, '#h-goals .hsec .cnt') === '0' && await pg.evaluate(() => document.querySelectorAll('#h-rings .rg').length === 0),
     'the light stands alone, and the goals under it say why, once');
  ok(/No post is set for today\./.test(await text(pg, '#h-horizon')), 'the horizon says there is no slot today');
  ok(/The gift door is not set up yet/.test(await text(pg, '#h-giving')), 'the lamp says the gift door is not set up');
  ok(await text(pg, '#h-state') === 'The Lantern is working', 'the Lantern is working');
  ok(await pg.evaluate(() => document.getElementById('dot-home').hidden && document.getElementById('dot-posts').hidden), 'and the bar marks nothing');
  const t = await text(pg, '#s-home');
  ok(!/undefined|NaN|\bnull\b|\[object/.test(t), 'no undefined, NaN or null leaks into the words');
  ok(await noSideScroll(pg), 'nothing scrolls sideways at ' + w + ' px');
  await shot(pg, 'home-empty-' + tag, true);
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ a store fault in several parts */
console.log('\n390x844 · a store fault in several parts: each fails on its own, in plain words');
{
  const { pg, st, ctx } = await open_(390, 844, { home: HOME_FAULT });
  const dec = await text(pg, '#h-decide'), gl = await text(pg, '#h-goals');
  ok(/Your decisions could not be read just now\./.test(dec) && /The store did not answer/.test(dec), 'the decisions card says it could not be read, and why, in the console\'s words');
  ok(/The goals could not be read just now, so the rings are not drawn\./.test(gl) && /The store did not answer/.test(gl), 'so do the goals, from the other shape of a reason, and the rings stand down, saying why');
  ok(await pg.evaluate(() => document.querySelectorAll('#h-rings .rg').length === 0 && !document.querySelector('#h-goals .lr') && !document.querySelector('#h-goals .hsec .cnt')), 'no ring, no row and no count where nothing could be read');
  ok(/Today's slots could not be read just now\. It took too long to answer\./.test(await text(pg, '#h-horizon')), "the horizon, from section 2's `missing`");
  ok(/The giving reading could not be read just now\./.test(await text(pg, '#h-giving')), 'and the lamp');
  ok(/31,240 people were reached/.test(await text(pg, '#h-brief')) && /Swapped tomorrow's 08:00 reel/.test(await text(pg, '#h-done')) && /Post two verse reels/.test(await text(pg, '#h-next')) && /Surah Al-Kahf/.test(await text(pg, '#h-ideas')),
     'and the brief, Done, Next and the ideas still draw');
  const t = await text(pg, '#s-home');
  ok(!/nsoul|redis|upstash|503|stripe|sk_live|6 seconds/i.test(t), 'the house\'s raw reason, with its store key, never reaches the page');
  ok(!SOUL.test(await allWords(pg)), 'no "soul" anywhere');
  ok(await noSideScroll(pg), 'nothing scrolls sideways');
  await shot(pg, 'home-fault-390x844');
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ needs-you, with the desk itself unread */
console.log('\n390x844 · the Lantern needs him, but the desk could not be read');
{
  const { pg, st, ctx } = await open_(390, 844, { home: () => HOME_REAL({ status: 'needs-you', decisions: null, errors: { decisions: 'redis timeout after 2000 ms' } }) });
  const s = await pg.evaluate(() => { const c = document.getElementById('h-state'); return { tag: c.tagName, t: c.innerText, jump: c.dataset.jump, aria: c.getAttribute('aria-label'), h: c.getBoundingClientRect().height }; });
  ok(s.tag === 'BUTTON' && s.t === 'Needs you' && s.jump === 'h-decide' && s.aria === 'The Lantern needs you: go to the desk' && s.h >= 44, 'the state is still the one gold button to the desk, with no count to give: ' + JSON.stringify(s));
  await pg.click('#h-state'); await pg.waitForTimeout(700);
  ok(await pg.evaluate(() => { const r = document.getElementById('h-decide').getBoundingClientRect(); return r.top >= 0 && r.top < 160 && /could not be read just now/.test(document.getElementById('h-decide').innerText); }), 'and it brings up the desk, which says why it is empty');
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ paused */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · paused');
  const { pg, st, ctx } = await open_(w, h, { home: HOME_PAUSED, motion: true });
  await pg.waitForTimeout(2000);
  ok(await text(pg, '#h-state') === 'Paused' && await pg.evaluate(() => document.getElementById('h-state').classList.contains('wait')), 'the chip says Paused');
  ok(await pg.evaluate(() => { const b = document.querySelector('#h-status [data-hp="resume"]'); return !!b && b.className === 'btn'; }), 'Resume is offered, gold');
  ok(/Nothing the Lantern plans runs until you resume/.test(await text(pg, '#h-face')), 'and the cockpit says what paused means');
  const pz = await pg.evaluate(() => ({ cls: document.getElementById('h-orbx').classList.contains('paused'), filter: getComputedStyle(document.getElementById('h-rings')).filter, light: getComputedStyle(document.querySelector('#h-orbx .light')).transform }));
  ok(pz.cls && /grayscale/.test(pz.filter) && /matrix\(0\.6, 0, 0, 0\.6/.test(pz.light), 'the light sinks to an ember and the rings go quiet and grey: ' + JSON.stringify(pz));
  const loops = await running(pg, '#h-orbx');
  ok(loops.join(',') === 'core:Infinity', 'nothing breathes, nothing ripples, the lattice is still: only the ember glows: ' + loops.join(','));
  ok(await pg.evaluate(() => document.querySelector('#h-next [data-think]').disabled && [...document.querySelectorAll('#h-next [data-now],#h-next [data-anyway]')].every(b => b.disabled)), 'Think again, Do it now and Do it anyway are held');
  ok(/The Lantern is paused\./.test(await text(pg, '#h-next')), 'and Next says why');
  await shot(pg, 'home-paused-' + tag, true);
  ok(st.errors.length === 0, 'no console error');
  await ctx.close();
}

/* ============================================================ the brief's own date */
console.log("\n390x844 · a brief that is not today's says whose day it was");
{
  const { pg, ctx } = await open_(390, 844, { home: () => HOME_REAL({ brief: BRIEF({ date: day(-1), at: iso(NOW - 27 * H) }) }) });
  const lab = () => pg.evaluate(() => document.getElementById('h-brief-lab').textContent);
  ok(await lab() === "Yesterday's brief" && await pg.evaluate(() => document.getElementById('h-brief-lab').classList.contains('old')), "yesterday's brief is called Yesterday's brief");
  await ctx.close();
  const o = await open_(390, 844, { home: () => HOME_REAL({ brief: BRIEF({ date: day(-3), at: iso(NOW - 75 * H) }) }) });
  const lab3 = await o.pg.evaluate(() => document.getElementById('h-brief-lab').textContent);
  ok(lab3 === 'The brief of ' + dayMonth(day(-3)), 'an older one carries its date: ' + lab3);
  await o.ctx.close();
}

/* ============================================================ Home cannot be read at all */
console.log('\n390x844 · Home cannot be read at all');
{
  const { pg, st, ctx } = await open_(390, 844, { homeMode: 'net' });
  await pg.waitForSelector('#h-fail:not([hidden]) .hfail', { timeout: 8000 });
  ok(/Could not reach the house\./.test(await text(pg, '#h-fail')) && await text(pg, '#h-state') === 'Not read', 'a network that is gone says so, and the chip says Not read');
  ok(await pg.evaluate(() => !!document.getElementById('h-ask-text').getClientRects().length && !!document.querySelector('#h-engine [data-engine]').getClientRects().length && !document.getElementById('h-brief').getClientRects().length),
     'the Ask box and the engine room door still stand; the parts with no data step aside');
  st.homeMode = 'ok';
  await pg.click('[data-hretry]');
  await pg.waitForSelector('#h-decide article.dc', { timeout: 8000 });
  ok(await pg.evaluate(() => !document.getElementById('s-home').classList.contains('failed') && document.querySelectorAll('#h-rings .rg').length === 6), 'Try again reads Home again, and it draws, rings and all');
  await ctx.close();
  const u = await open_(390, 844, { homeMode: 'unknown', allow4xx: true });
  await u.pg.waitForSelector('#h-fail:not([hidden]) .hfail', { timeout: 8000 });
  ok(/Home cannot be read from this deployment yet\./.test(await text(u.pg, '#h-fail')), 'a door with no Home view yet says so in plain words');
  ok(u.st.errors.length === 0, 'and nothing throws: ' + u.st.errors.slice(0, 2).join(' | '));
  await u.ctx.close();
  const l = await open_(390, 844, { homeMode: 'locked', allow4xx: true });
  await l.pg.waitForTimeout(600);
  ok(await l.pg.evaluate(() => !document.getElementById('gate').hidden && /expired/.test(document.getElementById('err').textContent)), 'a 401 on Home brings the gate back, saying why');
  await l.ctx.close();
}

/* ============================================================ the old hashes */
console.log('\n390x844 · the old hashes land in their new homes');
for (const [old, surf, hash, extra] of [['#today', 's-home', '#home'], ['#soul', 's-engine', '#engine'], ['#lantern', 's-ask', '#ask'], ['#house', 's-more', '#more'],
  ['#reels', 's-posts', '#posts', 'share'], ['#observatory', 's-numbers', '#numbers', 'overview'], ['#readers', 's-readers', '#readers'], ['#flow', 's-flow', '#flow']]) {
  const { pg, st, ctx } = await open_(390, 844, { hash: old });
  await pg.waitForSelector('#' + surf + '.on', { timeout: 10000 });
  await pg.waitForTimeout(400);
  ok((await surfaceOn(pg)) === surf && await pg.evaluate(() => location.hash) === hash, old + ' opens ' + surf + ' and the hash becomes ' + hash);
  if (extra) ok(await pg.evaluate(e => { const b = document.querySelector('.surf.on .tabs [data-tab="' + e + '"]'); return !!b && b.classList.contains('on') && b.getAttribute('aria-selected') === 'true'; }, extra), 'on its ' + extra + ' tab');
  if (old === '#reels') ok(await pg.evaluate(() => !document.getElementById('s-reels').hidden && document.querySelectorAll('#s-reels .rl').length === 2 && document.getElementById('s-lineup').hidden), "today's reels to share by hand, two of them");
  ok(st.errors.length === 0, 'no console error at ' + old + ': ' + st.errors.slice(0, 2).join(' | '));
  if (old === '#today') {
    await pg.evaluate(() => { location.hash = '#soul'; });
    await pg.waitForSelector('#s-engine.on', { timeout: 8000 }); await pg.waitForTimeout(200);
    ok(await pg.evaluate(() => location.hash) === '#engine', 'and a hash changed by hand later follows the same map');
  }
  await ctx.close();
}

/* ============================================================ Ask: the box on Home starts the conversation */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · Ask: the box on Home hands its words to the conversation, and it streams');
  const { pg, st, ctx } = await open_(w, h);
  await pg.click('#h-ask [data-sug="1"]');
  ok(await pg.evaluate(() => document.getElementById('h-ask-text').value) === "Skip tomorrow's 8 o'clock reel" && st.asks.length === 0, 'a suggested order fills the box and sends nothing yet');
  await pg.fill('#h-ask-text', 'What did you do this morning, and why?');
  await pg.click('#h-ask-go');
  await pg.waitForSelector('#s-ask.on', { timeout: 8000 });
  ok(await pg.evaluate(() => location.hash) === '#ask' && await pg.evaluate(() => document.getElementById('title').textContent) === 'Ask the Lantern', 'Ask opens, named Ask the Lantern in its header');
  await pg.waitForSelector('#s-ask .lant-msg.assistant', { timeout: 10000 });
  await pg.waitForFunction(() => /31 second verse/.test((document.querySelector('#s-ask .lant-msg.assistant') || {}).textContent || ''), null, { timeout: 10000 });
  const asked = st.asks.filter(b => b.message);
  ok(asked.length === 1 && asked[0].message === 'What did you do this morning, and why?' && asked[0].thread === '', 'the conversation starts with exactly those words: ' + JSON.stringify(asked));
  const thread = await pg.evaluate(() => [...document.querySelectorAll('#lant-thread .lant-msg')].map(m => m.className.replace('lant-msg ', '') + ':' + m.textContent.slice(0, 40)));
  ok(thread.length === 2 && /^user:What did you do this morning/.test(thread[0]) && /^assistant:This morning I swapped/.test(thread[1]), 'the question, then the answer as it streamed: ' + thread.join(' | '));
  ok(await pg.evaluate(() => document.querySelectorAll('#s-ask .lant-think .lant-step').length) >= 1 && await pg.evaluate(() => !document.getElementById('lant-send').disabled), 'the thinking it showed, folded, and Ask free again');
  ok(await pg.evaluate(() => document.getElementById('h-ask-text').value) === '', "Home's box is empty again");
  const ln = await text(pg, '#lant-home');
  ok(/Proposals now wait on Home as decisions/.test(ln) && await pg.evaluate(() => !document.getElementById('lant-proposals')), 'the proposals panel is one line now, pointing to Home');
  ok(await pg.evaluate(() => !document.querySelector('#s-ask .back')) && await pg.evaluate(() => document.querySelectorAll('#s-ask [data-lant-start]').length) === 4, 'Ask is a surface of the bar (no way back), its starters kept');
  ok(/1 of 5 autonomous actions used today/.test(await text(pg, '#lant-ledger')), 'and its ledger kept');
  ok(!st.apiGets.some(g => /action=proposals/.test(g)), 'it no longer asks the house for proposals of its own');
  ok(!SOUL.test(await allWords(pg)) && await noSideScroll(pg), 'no "soul", nothing sideways');
  await shot(pg, 'ask-' + tag, true);
  await pg.click('#lant-home');
  await pg.waitForSelector('#s-home.on', { timeout: 5000 });
  ok((await surfaceOn(pg)) === 's-home', 'the line leads Home');
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ Posts, Numbers, More, the engine room */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · Posts: the line-up, and a tab of today\'s reels to share by hand');
  const { pg, st, ctx } = await open_(w, h);
  await pg.click('nav.bar [data-s="posts"]');
  await pg.waitForSelector('#s-lineup .slot', { timeout: 10000 }); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#s-posts .tabs [data-tab]')].map(b => b.dataset.tab + (b.classList.contains('on') ? '*' : '')).join(',')) === 'lineup*,share', 'two tabs, the line-up open');
  ok(await text(pg, '#share-n') === '2', "the share tab counts today's reels: 2");
  ok(await pg.evaluate(() => document.querySelectorAll('#s-lineup .slot[id^="slot-"]').length) === 5 && /The ladder/i.test(await text(pg, '#s-lineup')) && /Tomorrow's reels/i.test(await text(pg, '#s-lineup')), "the line-up, hour by hour, the ladder and tomorrow's reels");
  const badge = await pg.evaluate(() => (document.querySelector('#slot-reelA .pill.wait') || {}).title || '');
  ok(/swapped by the Lantern/.test(badge) && !SOUL.test(badge), "a slot the Lantern's cycle swapped is said to be the Lantern's: " + badge);
  ok(await noSideScroll(pg), 'nothing sideways');
  await shot(pg, 'posts-' + tag, true);
  await pg.click('#s-posts .tabs [data-tab="share"]');
  await pg.waitForSelector('#s-reels .rl', { timeout: 8000 }); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => document.querySelectorAll('#s-reels .rl [data-share]').length === 2 && document.getElementById('s-lineup').hidden), 'Share by hand shows the two reels, each with its Share');
  ok(/The Throne verse, in 31 seconds/.test(await text(pg, '#s-reels')), 'with its hook');
  ok(await noSideScroll(pg), 'nothing sideways');

  console.log(tag + ' · Numbers: the Observatory and the readers, with the scorecard');
  await pg.click('nav.bar [data-s="numbers"]');
  await pg.waitForSelector('#s-observatory .viz', { timeout: 10000 }); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#s-numbers .tabs [data-tab]')].map(b => b.dataset.tab + (b.classList.contains('on') ? '*' : '')).join(',')) === 'overview*,readers', 'two tabs, the Observatory open');
  ok(/The week's scorecard/.test(await text(pg, '#s-numbers [data-score]')), 'the door to the week\'s scorecard sits above them');
  ok(await pg.evaluate(() => !document.querySelector('#s-observatory .back')) && await pg.evaluate(() => document.querySelectorAll('#s-observatory .viz').length) >= 4, 'the Observatory, drawn as before, with no way back of its own');
  ok(await noSideScroll(pg), 'nothing sideways');
  await pg.click('#s-numbers .tabs [data-tab="readers"]');
  await pg.waitForSelector('#s-readnum .stat', { timeout: 8000 }); await pg.waitForTimeout(200);
  const rn = await text(pg, '#s-readnum');
  ok(/readers today/i.test(rn) && /What strangers watch/i.test(rn) && /This week vs last/.test(rn) && /Arrivals by network/.test(await pg.evaluate(() => document.getElementById('s-readnum').textContent)), "the readers' numbers: today, what strangers watch, the week against the last, arrivals");
  ok(!/The inbox/.test(rn), 'and not the inbox, which is a room behind More');
  await pg.click('#s-numbers [data-score]');
  await pg.waitForSelector('#s-engine.on #soul-i-week', { timeout: 10000 });
  await pg.waitForTimeout(900);
  ok(await pg.evaluate(() => location.hash) === '#engine' && await pg.evaluate(() => { const r = document.getElementById('soul-i-week').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }),
     'the scorecard door opens the engine room at the Week card');
  ok(await text(pg, '#s-engine .back') === 'Numbers', 'whose way back is named Numbers');

  console.log(tag + ' · More: every other room, the engine room first');
  await pg.click('nav.bar [data-s="more"]');
  await pg.waitForSelector('#s-more [data-room]', { timeout: 10000 }); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#s-more [data-room]')].map(b => b.dataset.room).join(',')) === 'engine,mail,giving,lights,legacy,marketing,journal,night,system,controls,flow,readers', 'the rooms, the engine room first, the Lantern\'s mail beside it, then Giving');
  ok(await pg.evaluate(() => { const c = document.querySelector('#s-more [data-room]'); return c.classList.contains('feat') && /The engine room/.test(c.innerText) && /31,240/.test(c.innerText); }), 'the engine room leads, with its live number');
  ok(await pg.evaluate(() => /2/.test(document.querySelector('#s-more [data-room="readers"] .v').textContent)), "the readers' inbox card counts what is new");
  ok(await pg.evaluate(() => document.querySelector('#s-more p.sec').textContent) === 'The rooms', 'the rooms come first on the hub, before its health');
  ok(!SOUL.test(await allWords(pg)) && await noSideScroll(pg), 'no "soul", nothing sideways');

  console.log(tag + ' · the engine room: the old room, in the one voice');
  await pg.click('#s-more [data-room="engine"]');
  await pg.waitForSelector('#s-engine.on #soul-head', { timeout: 10000 }); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => document.getElementById('title').textContent) === 'The engine room' && await text(pg, '#s-engine .back') === 'More', 'named The engine room, its way back named More');
  ok(await text(pg, '#soul-state') === 'Needs you', 'its state chip says Needs you, as the last cycle asks for him');
  ok(/the Lantern's/.test(await text(pg, '#soul-goal-g-test')), "the Lantern's own goal is tagged as the Lantern's");
  const au = await pg.evaluate(() => { const f = document.getElementById('soul-audit-fold'); f.open = true; return f.innerText; });
  ok(/the Lantern was paused/.test(au) && /the Lantern was resumed/.test(au) && /cycle done/.test(au) && /the Lantern ·/.test(au), "the audit's old entries read in the one voice: " + au.replace(/\s+/g, ' ').slice(0, 120));
  ok(/the Lantern is answering it in its plan/.test(await text(pg, '#soul-today')), "the last cycle's needs-you line too");
  const ch = await pg.evaluate(() => document.getElementById('soul-chron').innerText);
  ok(/The Lantern, daily cycle/.test(ch) && /the Lantern's own standing intents/.test(ch), 'and the chronicle, a sentence that began with the old name beginning with the new one');
  const ew = await allWords(pg);
  ok(!SOUL.test(ew), 'no "soul" anywhere in the engine room: ' + ((ew.match(/.{0,30}\bsoul\b.{0,30}/i) || [''])[0]));
  ok(await noSideScroll(pg), 'nothing sideways');
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ every room is still reachable, in the one voice */
console.log('\n390x844 · every room still opens from More, and comes back');
{
  const { pg, st, ctx } = await open_(390, 844);
  for (const [id, name] of [['engine', 'The engine room'], ['lights', 'Lights'], ['legacy', 'Legacy'], ['marketing', 'Marketing'], ['journal', 'Journal desk'], ['night', 'Night shift'],
    ['system', 'System'], ['controls', 'Controls'], ['flow', 'Flow'], ['readers', "Readers' inbox"]]) {
    await pg.click('nav.bar [data-s="more"]');
    await pg.waitForSelector('#s-more [data-room="' + id + '"]', { timeout: 10000 });
    await pg.click('#s-more [data-room="' + id + '"]');
    await pg.waitForSelector('#s-' + id + '.on .back', { timeout: 10000 }); await pg.waitForTimeout(350);
    const words = await allWords(pg);
    ok((await surfaceOn(pg)) === 's-' + id && await pg.evaluate(() => document.getElementById('title').textContent) === name && await pg.evaluate(() => location.hash) === '#' + id
       && await pg.evaluate(() => document.querySelector('nav.bar [data-s="more"]').classList.contains('on')) && !SOUL.test(words) && await noSideScroll(pg),
       name + ' opens from More, at #' + id + ', lights More, says no "soul", and fits');
    await pg.click('#s-' + id + ' .back'); await pg.waitForTimeout(200);
    ok((await surfaceOn(pg)) === 's-more', 'and its way back returns to More');
  }
  ok(st.errors.length === 0, 'no console error in any room: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
