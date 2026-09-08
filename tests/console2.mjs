/* NOOR · the new console, driven the way a thumb drives it.
   ------------------------------------------------------------------
   admin2.html is one file that talks to the same endpoints as the old
   console. This opens it at a phone's width and at a desk's, feeds every
   endpoint a day that actually happened, and checks that the four surfaces
   draw, that nothing scrolls sideways, that no script throws, and that each
   button asks the server for exactly what its label says.

   Run:  python3 /tmp/vercelish.py . 8231 &   node tests/console2.mjs
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8231';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
mkdirSync('tests/shots', { recursive: true });
const br = await chromium.launch();

const TODAY = {
  ok: true, date: '2026-09-07', nowHour: 18, plan: { hijri: { d: 24, name: 'Rabi al-Awwal', y: 1448 }, verified: true },
  slots: [
    { id: 'dawn', at: 5, state: 'sent', title: '24 Rabi al-Awwal', results: { facebook: { ok: true }, instagram: { ok: true } } },
    { id: 'reelA', at: 8, state: 'due', title: 'A reel that did not go' },
    { id: 'lead', at: 9, state: 'skipped', title: '' },
    { id: 'light', at: 12, state: 'partial', title: 'The word for human nature also means breaking a fast',
      results: { facebook: { ok: true, id: 'F' }, instagram: { ok: false, error: 'Meta could not fetch the image', code: 9004 } } },
    { id: 'word', at: 16, state: 'partial', title: 'Qalqalah', results: { facebook: { ok: true }, instagram: { ok: true },
      pinterest: { ok: false, fatal: true, trial: true, waiting: true, err: 'Pinterest is waiting on its Standard-access review; pins resume by themselves when it is granted' } } },
    { id: 'reelB', at: 17, state: 'pending', title: 'A reel', results: { facebook: { ok: true }, instagram: { ok: false, pending: 'CONT' } } },
    { id: 'dusk', at: 20, state: 'waiting', title: 'A chapter' }
  ]
};
const DIAG = { ok: true, where: 'instagram', slot: 'light', said: 'Meta could not fetch the image', code: 9004,
  cause: 'Instagram could not fetch or process the card image', fix: 'retry', canRetry: true,
  checks: [{ name: 'the card image', ok: true, detail: 'image/png, 41 KB, reachable now' }],
  steps: ['Press Retry.'] };
const DIALS = { ok: true, dials: { mode: 'auto' }, configured: { fb: true, ig: true },
  channels: [{ id: 'facebook', live: true, draftOnly: false, spec: {} }, { id: 'instagram', live: true, draftOnly: false, spec: {} },
             { id: 'youtube', live: true, draftOnly: false, spec: { video: 'required' } }, { id: 'pinterest', live: true, draftOnly: false, spec: {} },
             { id: 'x', live: false, draftOnly: false, spec: {} }, { id: 'reddit', live: false, draftOnly: true, spec: {} }] };
const TOKENS = { tokens: { fb: { daysLeft: 41, renewedAt: '2026-08-19' }, ig: { daysLeft: 41 }, lifeDays: 60 } };
const REDDIT = { held: [{ slot: 'light', title: 'A draft for r/islam', text: 'Body of the draft', links: [] }] };
const LOG = { log: [{ at: '2026-09-07T12:00:00Z', slot: 'light', state: 'partial' }], queue: [] };
const VIS = { enabled: true, store: 'redis', totals: { views30: 310, people30: 85 }, cleanFrom: '2026-09-04',
  days: [{ date: '2026-08-30', views: 60, people: 20, filtered: 30 }, { date: '2026-09-04', views: 80, people: 34, filtered: 28 }, { date: '2026-09-07', views: 90, people: 31, filtered: 30 }],
  rooms: [{ r: 'quran', n: 40 }, { r: 'names', n: 12 }], countries: [{ c: 'FR', n: 30 }, { c: 'MA', n: 20 }], sources: [{ s: 'google', n: 25 }],
  filtered: { total: 88, by: { bot: 80, noua: 8 } } };
const INBOX = { ok: true, counts: { new: 1 }, items: [{ id: 'm1', at: '2026-09-07T09:00:00Z', body: 'Salam, thank you for the library', from: 'a reader', kind: 'note', status: 'new' }] };
const QUEUE = { queue: [{ entry: 'e1', slug: 'first-light', title: 'First light', cid: 'c9', name: 'anon', body: 'A reply that waits, and goes on for long enough that the row can only show the start of it, which is why the whole of it opens when the row is tapped', at: '2026-09-07T08:00:00Z', state: 'pending', why: 'link' }] };
const HOUSE = { store: true, storeKind: 'redis', lanternConfigured: true, lanternModel: 'x/inkling:free', moneyMode: 'quiet', weekly: 3, mrr: 120, activeCount: 4,
  guardians: [{ market: 'FR', status: 'active', amount: 15, cadence: 'month', currency: 'EUR', email: 'g@x.y', name: 'A', started: '2026-05-01', renews: '2026-10-01', endsAfterWeek: false, approved: true, gname: 'Amina', gurl: '', gline: '', subscription: 'sub_FR1' },
              { market: 'ID', status: 'trialing', amount: 6, cadence: 'week', currency: 'USD', email: 'h@x.y', name: 'B', started: '2026-09-01', renews: '2026-09-14', endsAfterWeek: false, approved: false, gname: '', gurl: '', gline: '', subscription: 'sub_ID2' }],
  gifts: { total30d: 90, count30d: 3, monthly: 60, recent: [{ amount: 30, currency: 'USD', when: '2026-09-01', email: 'a@b.c' }] } };
const LANTERN = { ok: true, answered: 'x/inkling:free', reply: 'lit', tried: [{ model: 'x/inkling:free', ms: 900, err: '' }], ms: 950 };
const INS = { ok: true, enabled: true, days: 14, media: 70, read: 62, unread: 6, refused: 2, stale: 8, readAt: '2026-09-07T11:00:00Z',
  byKind: [{ kind: 'reel:verse', label: 'verse reels', n: 12, reach: { median: 2400, mean: 2510 }, views: { median: 7100, mean: 7300 } },
           { kind: 'card:word', label: 'word cards', n: 9, reach: { median: 1000, mean: 1040 }, views: { median: 1200, mean: 1250 } },
           { kind: 'reel:word', label: 'word reels', n: 11, reach: { median: 300, mean: 320 }, views: { median: 900, mean: 950 } }],
  byHour: [{ hour: 8, label: '08:00', n: 12, reach: { median: 2400 }, views: { median: 7100 } }, { hour: 21, label: '21:00', n: 11, reach: { median: 300 }, views: { median: 900 } }],
  byNetwork: [{ net: 'instagram', n: 32, reach: { median: 1000 }, views: { median: 1900 } }, { net: 'facebook', n: 30, reach: { median: 500 }, views: { median: 800 } }],
  top: [{ title: 'One verse about light', kind: 'reel:verse', label: 'verse reels', hour: 8, at: '08:00', net: 'instagram', id: 'ig1', url: '', measure: 'reach', n: 4100, date: '2026-09-02', slot: 'reelA' },
        { title: 'A Short', kind: 'reel:verse', label: 'verse reels', hour: 8, at: '08:00', net: 'youtube', id: 'y1', url: 'https://youtube.com/shorts/y1', measure: 'views', n: 3900, date: '2026-09-03', slot: 'reelA' }],
  sentences: ['Verse reels reach 8× the median of word reels (2,400 against 300, 12 and 11 posts).', 'The 21:00 slot reaches least (median 300 over 11 posts).'] };

/* ---- the six rooms, fed the shapes their endpoints really answer with ---- */
const LIGHTS = { probe: 'lights', date: '2026-09-07', hijri: { y: 1448, m: 3, d: 24, name: 'Rabi al-Awwal' },
  today: { date: '2026-09-07', source: 'library+lantern', id: 'lt-0421', category: 'A word', title: 'The lamp in the niche',
    story: 'A verse that names God as the light of the heavens and the earth.', detail: 'Qur\'an 24:35, the Verse of Light.',
    kind: 'verse', lvl: 'gentle', why: 'the week has been dark', editor: 'x/inkling:free', motif: 'lamp', pool: 421, ranked: 6 },
  index: { n: 421, exact: 38, hdays: 22, months: { 1: 30, 2: 20, 3: 44, 9: 12 }, kinds: { verse: 200, word: 140, day: 81 } },
  lib: { n: 421 },
  doubts: [{ at: '2026-09-05T04:10:00Z', id: 'lt-0088', title: 'A number that grew in the telling',
    doubt: 'The figure is given as fact but the earliest source gives a range.' }] };
const NIGHT = { probe: 'night', at: '2026-09-07T04:00:00Z',
  brief: { text: 'Readers held steady, one message wants an answer, and nothing broke.', at: '2026-09-07T04:02:00Z', model: 'x/inkling:free' },
  findings: [{ at: '2026-09-07T04:01:00Z', id: 'nf-12', kind: 'attribution', why: 'A hadith is quoted without a collection or a number.', where: 'pillars.html' }],
  last: { at: '2026-09-07T04:00:00Z', jobs: { audit: { looked: 40, of: 900, found: 1, pace: '40 a night' }, triage: { sorted: 6, urgent: 1 } } },
  perNight: 40 };
const JOURNAL = { ok: true, entries: [
  { id: 'e1', slug: 'first-light', title: 'First light', dek: 'Why this exists', at: '2026-09-01T10:00:00Z', tags: ['why'], comments: 3, status: 'published', words: 640 },
  { id: 'e2', slug: 'a-draft', title: 'A draft nobody sees', dek: '', at: '2026-09-06T10:00:00Z', tags: [], comments: 0, status: 'draft', words: 90 }] };
const ENTRY = { ok: true, entry: { id: 'e1', slug: 'first-light', title: 'First light', dek: 'Why this exists', body: 'The body of the entry.', tags: ['why'], status: 'published', at: '2026-09-01T10:00:00Z' }, comments: [] };
const OVR = { v: 3, ok: true, items: [{ id: 'o1', page: 'pillars.html', find: 'seven ounces', replace: 'seven grams', why: 'the nisab was misread', at: '2026-09-06T09:00:00Z' }] };
const MARKETING = { kind: 'outreach', variants: [
  { label: 'Email to a school', subject: 'A free learning map for your class', title: '', body: 'Assalamu alaykum. Here is a one page map [name of school] can print.' },
  { label: 'Shorter', subject: 'One page, free, for your class', title: '', body: 'A shorter second option.' }] };
const WEEK = { kind: 'week', week: [
  { day: 'Monday', channel: 'r/islam', title: 'A word that carries two meanings', body: 'The Monday post.', leads_with: 'the Madrasa' },
  { day: 'Tuesday', channel: 'masjid email', title: 'A free learning map', body: 'The Tuesday email.', leads_with: 'the Cradle' }] };
const VET = { verdict: 'review', score: 62, reasons: ['The site sells clothing and says nothing about its finance.'], questions: ['Do you take interest bearing credit?'] };

/* ---- the house, read in one call: GET /api/house?action=steward|flow ----
   The shapes are api/_steward.js's findings and api/_flow.js's stages and
   edges exactly as tests/house.mjs proves them: a level, a title, a sentence,
   an action that is a call some route already handles, and the evidence the
   sentence stands on; stages that name their source and are unread rather
   than nought; edges that carry a rate only where two grains agree. */
const readAt = () => new Date(Date.now() - 4 * 60000).toISOString();
/* The steward of the ordinary day. Not one of its findings names a slot that
   Waiting for you also carries, so the two lists do not overlap here; the
   dedupe has a scenario of its own further down. */
const STEWARD = () => ({
  ok: true, enabled: true, store: 'redis', cached: false, at: readAt(), date: '2026-09-07',
  say: 'The Instagram token has 6 days left and Telegram has taken nothing in 7 days, and both want a hand before the evening slot.',
  lantern: true, refused: '', counts: { act: 2, watch: 2, good: 4 },
  findings: [
    { id: 'token-ig', level: 'act', title: 'The Instagram token has 6 days left',
      say: 'It was marked renewed on 2026-07-25 and a Meta token lives 60 days. When it dies every post to Instagram fails with no warning.',
      action: { label: 'I have just renewed it', kind: 'post', body: { action: 'renewed', which: 'ig' }, route: '/api/social' },
      evidence: { network: 'Instagram', daysLeft: 6, renewedAt: '2026-07-25', lifeDays: 60 } },
    { id: 'channel-silent:telegram', level: 'act', title: 'Telegram is connected and has posted nothing',
      say: 'Telegram is configured, so the house believes it can send there, and no post of the last 7 days landed on it. Nothing was even attempted.',
      action: { label: 'Send the last slot to Telegram', kind: 'post', body: { action: 'retry-channel', date: '2026-09-06', slot: 'dusk', where: 'telegram' }, route: '/api/social' },
      evidence: { network: 'telegram', days: 7, sent: 0, failed: 0, last: { date: '2026-09-06', slot: 'dusk' } } },
    { id: 'token-threads', level: 'watch', title: 'The Threads token is 55 days old',
      say: 'A Threads token lives 60 days and this one has been in place 55. It can be exchanged for a fresh one while it still works.',
      action: { label: 'See the Threads connection', kind: 'open', href: '/api/threads?action=status' },
      evidence: { days: 55, since: '2026-07-14', lifeDays: 60 } },
    { id: 'slots-waiting', level: 'watch', title: 'Pinterest is waiting on its review',
      say: 'Pinterest refused 1 post in 7 days because the account is not open yet. That is a stage and not a fault.',
      action: null, evidence: { networks: ['pinterest'], refused: 1, days: 7 } },
    { id: 'mode', level: 'good', title: 'The schedule is running',
      say: 'The ladder is on "auto", so the hourly run sends what the day owes without anybody in the loop.',
      action: null, evidence: { mode: 'auto' } },
    { id: 'readers', level: 'good', title: 'Readers today: 31',
      say: '31 readers have been on the site so far today and 34 were counted yesterday. Today is not over, so the two are not a like for like comparison.',
      action: null, evidence: { todayPeople: 31, yesterdayPeople: 34, hourUTC: 18 } },
    { id: 'gifts', level: 'good', title: '3 gifts in 30 days',
      say: '3 gifts arrived in the last 30 days, 90.00 USD in all, counted from Stripe\'s own charges.',
      action: null, evidence: { count: 3, grossMinor: 9000, currency: 'usd', days: 30 } },
    { id: 'slots-sent', level: 'good', title: 'The store answered every reader',
      say: 'Every reader of the house answered this time, so no finding below is missing because something would not be read.',
      action: null, evidence: { storeOk: true } }
  ],
  read: { mode: 'auto', slots: 8, windowDays: 7, media: 70, trouble: [] }
});
/* The steward of a day that speaks for two of the slots Waiting for you also
   carries, and whose Lantern was dark so the paragraph is the template. */
const STEWARD_SLOTS = () => ({
  ok: true, enabled: true, cached: false, at: readAt(), date: '2026-09-07',
  say: '2 things need you today, beginning with 1 of today\'s posts have no record.',
  lantern: false, refused: 'no OpenRouter key on this deployment', counts: { act: 1, watch: 1, good: 0 },
  findings: [
    { id: 'slots-unrecorded', level: 'act', title: '1 of today\'s posts have no record',
      say: 'The 08:00 slot has no record at all, its hour has passed, and the ladder is on "auto". The last line in the log was written 2026-09-07T12:01:00Z.',
      action: { label: 'Send the 08:00 slot now', kind: 'post', body: { action: 'send-slot', slot: 'reelA' }, route: '/api/social?date=2026-09-07' },
      evidence: { owed: 1, slots: ['reelA'], hours: ['08:00'], mode: 'auto' } },
    { id: 'reddit-drafts', level: 'watch', title: '1 Reddit draft is waiting for you',
      say: 'The machine wrote 1 Reddit post today and sent it nowhere: Reddit is drafts only, always.',
      action: { label: 'Open the Reddit drafts', kind: 'open', href: '/admin2#posts' },
      evidence: { drafts: 1, slots: ['word'] } }
  ]
});
const FLOW = days => ({
  ok: true, enabled: true, store: 'redis', cached: false, days, at: readAt(),
  from: '2026-08-25', to: '2026-09-07',
  stages: [
    { id: 'posts', label: 'Posts made', value: 8, unit: 'posts', by: { instagram: 8, youtube: 4, facebook: 4 },
      source: 'the slot records, nsoc:slot:<date>#<slot>', unread: false },
    { id: 'reach', label: 'People reached', value: 1200, unit: 'people', by: { instagram: 1200, facebook: null, youtube: null },
      source: 'the insights cache, nsoc:ins:<network>:<id>', unread: false },
    { id: 'views', label: 'Views', value: null, unit: 'views', by: { instagram: null, facebook: null, youtube: null },
      source: 'the insights cache, nsoc:ins:<network>:<id>', unread: true },
    { id: 'clicks', label: 'Clicks to the site', value: 57, unit: 'arrivals', by: { instagram: 52, facebook: 5 }, attribution: 'month',
      source: 'the beacon\'s referrer counters, nm:<month>:s:<network>', unread: false },
    { id: 'readers', label: 'Readers', value: 140, unit: 'people', by: null,
      source: 'the beacon\'s counters, nv:<date>:people', unread: false },
    { id: 'pages', label: 'Pages read', value: 420, unit: 'pages', by: null,
      source: 'the beacon\'s counters, nv:<date>:views', unread: false },
    { id: 'gifts', label: 'Gifts', value: 3, unit: 'gifts', by: null,
      source: 'Stripe\'s own charges, through the ledger', unread: false },
    { id: 'given', label: 'What arrived', value: 45, unit: 'USD', by: null,
      source: 'Stripe\'s own charges, through the ledger', unread: false },
    { id: 'duas', label: 'Du\'as left', value: 2, unit: 'du\'as', by: null,
      source: 'the du\'a field on Stripe\'s checkout sessions', unread: false },
    { id: 'guardians', label: 'Guardians standing', value: null, unit: 'guardians', by: null,
      source: 'Stripe\'s active subscriptions', unread: true }
  ],
  edges: [
    { from: 'posts', to: 'reach', value: 1200, rate: 150 },
    { from: 'reach', to: 'views', value: null, rate: null },
    { from: 'reach', to: 'clicks', value: 57, rate: null },
    { from: 'clicks', to: 'readers', value: 140, rate: 2.456 },
    { from: 'readers', to: 'pages', value: 420, rate: 3 },
    { from: 'readers', to: 'gifts', value: 3, rate: 0.021 },
    { from: 'readers', to: 'duas', value: 2, rate: 0.014 }
  ],
  notes: [
    'Nothing has been read back for facebook, youtube yet, so those networks are unread rather than zero. Press Read in the insights room.',
    'The beacon counts a referrer once per person per day into a key per month, so these arrivals are the whole of 2026-08 and 2026-09 and not only the ' + days + ' days asked for.',
    'A returning reader is not counted anywhere: the beacon is cookieless and keeps no identifier, so the house cannot know the same person twice.',
    'The step from reach to arrivals carries no rate: one is the window\'s and the other is the month\'s, and dividing them would invent a number.'
  ]
});

let insPosts = 0;
async function open_(w, h, posted, errors, opts = {}) {
  const pg = await br.newPage({ viewport: { width: w, height: h } });
  insPosts = 0;
  pg.on('pageerror', e => errors.push(String(e)));
  pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  pg.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  const J = (b, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(b) });
  await pg.route('**/*', r => {
    const q = r.request(), u = q.url();
    if (q.method() === 'POST' && u.includes('/api/')) {
      const b = JSON.parse(q.postData() || '{}'); posted.push({ url: u.replace(BASE, ''), body: b });
      if (u.includes('/api/journal') && b.action === 'queue') return r.fulfill(J(QUEUE));
      if (u.includes('/api/journal') && b.action === 'triage') return r.fulfill(J({ ok: true, entries: 2, replies: 7 }));
      if (u.includes('/api/journal') && b.action === 'save') return r.fulfill(J({ ok: true, entry: { id: 'e3', slug: 'a-new-entry' } }));
      if (u.includes('/api/admin-auth')) return r.fulfill(J({ ok: true }));
      if (u.includes('/api/admin-vet')) return r.fulfill(J(VET));
      if (u.includes('/api/admin-guardians') && b.action === 'intake') return r.fulfill(J({ name: 'Amina Textiles', url: 'https://example.org', line: 'Modest cloth, honestly made' }));
      if (u.includes('/api/marketing')) return r.fulfill(J(b.kind === 'week' ? WEEK : MARKETING));
      if (u.includes('/api/assistant')) return r.fulfill(J(b.mode === 'edit'
        ? { ok: true, mode: 'edit', valid: true, proposal: { page: 'pillars.html', find: 'seven ounces', replace: 'seven grams', why: 'the nisab was misread' } }
        : { ok: true, mode: 'assist', reply: 'Answer one message and the day is clear.' }));
      if (u.includes('/api/overrides')) return r.fulfill(J({ ok: true, v: 4, items: OVR.items }));
      /* Read again: the first batch says there is more, the second says done */
      if (u.includes('/api/insights')) { insPosts++; return r.fulfill(J(insPosts === 1 ? { ok: true, fetched: 40, left: 30, partial: true } : { ok: true, fetched: 30, left: 0, partial: false })); }
      return r.fulfill(J({ ok: true, where: 'instagram', state: 'sent', results: {} }));
    }
    /* the rooms delete as well as post: a DELETE is recorded like a POST is */
    if (q.method() === 'DELETE' && u.includes('/api/')) {
      const b = JSON.parse(q.postData() || '{}'); posted.push({ url: u.replace(BASE, ''), method: 'DELETE', body: b });
      return r.fulfill(J({ ok: true, v: 5, items: b.all ? [] : OVR.items.filter(x => x.id !== b.id) }));
    }
    /* the house in one call: both actions on the one owner-gated route */
    if (u.includes('/api/house')) {
      posted.push({ url: u.replace(BASE, ''), method: 'GET', body: {} });
      if (u.includes('action=flow')) {
        const d = parseInt((u.match(/days=(\d+)/) || [, '14'])[1], 10);
        return r.fulfill(J(opts.flow ? opts.flow(d) : FLOW(d)));
      }
      return r.fulfill(J(opts.steward ? opts.steward() : STEWARD()));
    }
    if (u.includes('/api/admin-data?probe=lantern')) return r.fulfill(J(LANTERN));
    if (u.includes('/api/admin-data?probe=lights')) {
      if (u.includes('date=')) posted.push({ url: u.replace(BASE, ''), method: 'GET', body: {} });
      return r.fulfill(J(LIGHTS));
    }
    if (u.includes('/api/admin-data?probe=night')) {
      if (u.includes('clear=')) { posted.push({ url: u.replace(BASE, ''), method: 'GET', body: {} }); return r.fulfill(J({ ok: true, cleared: true })); }
      return r.fulfill(J(NIGHT));
    }
    if (u.includes('/api/admin-data')) return r.fulfill(J(opts.house ? opts.house() : HOUSE));
    if (u.includes('/api/journal')) return r.fulfill(J(u.includes('slug=') ? ENTRY : JOURNAL));
    if (u.includes('/api/overrides')) return r.fulfill(J(OVR));
    if (u.includes('/api/social')) {
      if (u.includes('action=diagnose')) return r.fulfill(J(DIAG));
      if (u.includes('action=dials')) return r.fulfill(J(DIALS));
      if (u.includes('action=tokens')) return r.fulfill(J(TOKENS));
      if (u.includes('action=reddit')) return r.fulfill(J(REDDIT));
      if (u.includes('action=log')) return r.fulfill(J(LOG));
      if (u.includes('action=slot')) return r.fulfill(J({ ok: true, slot: 'light', state: 'partial',
        post: { title: TODAY.slots.find(s => s.id === 'light').title, body: 'The card text', image: '/api/card?slot=light' }, shaped: { instagram: { text: 'The card text #noor' } } }));
      if (opts.legacy) { const t = JSON.parse(JSON.stringify(TODAY)); t.slots = t.slots.map(x => x.id === 'light' ? { id: 'light', at: 12, state: 'due', title: '' } : x); t.legacy = { state: 'sent', at: '2026-09-07T12:01:00Z', title: 'The card' }; return r.fulfill(J(t)); }
      return r.fulfill(J(TODAY));
    }
    if (u.includes('/api/insights')) return r.fulfill(J(INS));
    if (u.includes('/api/visitors')) return r.fulfill(J(VIS));
    if (u.includes('/api/inbox')) return r.fulfill(J(INBOX));
    if (u.includes('/reels/index.json')) return r.fulfill(J({ n: 2, cards: [{ id: 'a', slot: 'morning', hook: 'A', caption: 'x' }, { id: 'b', slot: 'evening', hook: 'B', caption: 'y' }] }));
    if (u.includes('/api/card') || /\/reels\/.*\.(jpg|png)$/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') });
    if (u.includes('/api/')) return r.fulfill(J({ ok: true }));
    if (u.startsWith(BASE)) return r.continue();
    if (u.includes('fonts.g')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.abort();
  });
  await pg.goto(BASE + '/admin2.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#app.on, #app:not([hidden])', { timeout: 15000 });
  await pg.waitForSelector('#s-today .card, #s-today .row, #s-today .strip', { timeout: 15000 });
  await pg.waitForTimeout(400);
  return pg;
}

const noSideScroll = pg => pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const surfaceOn = pg => pg.evaluate(() => (document.querySelector('.surf.on') || {}).id);

for (const [label, w, h] of [['phone 390', 390, 844], ['desk 1280', 1280, 900]]) {
  const posted = [], errors = [];
  const pg = await open_(w, h, posted, errors);
  console.log('\n' + label + ' · the gate and Today');
  ok(await pg.evaluate(() => document.getElementById('gate').hidden || getComputedStyle(document.getElementById('gate')).display === 'none'),
     'the probe unlocked the console without a password prompt');
  ok(await pg.evaluate(() => { try { return localStorage.getItem('noor_nocount') === '1'; } catch { return false; } }),
     'this browser is marked as not-a-reader for the traffic count');
  ok((await surfaceOn(pg)) === 's-today', 'Today is the first surface');
  const today = await pg.evaluate(() => document.getElementById('s-today').innerText);
  ok(/Rabi al-Awwal/.test(today), 'the Hijri date is named');
  ok(/dawn/.test(today) && /dusk/.test(today) && (today.match(/\d\d:00/g) || []).length >= 7, 'every slot of the day is on the strip');
  ok(/reelA is owed/.test(today) && /light is half sent/.test(today), 'what needs a hand is listed first');
  ok(!/word is half sent/.test(today), 'a slot whose only unanswered network is waiting on its own review is not called half sent');
  ok(!/dusk is owed/.test(today), 'a slot whose hour has not come is not called owed');
  ok(await noSideScroll(pg), 'nothing scrolls sideways');
  ok(await pg.evaluate(() => getComputedStyle(document.getElementById('sheet')).visibility === 'hidden'), 'the closed sheet is out of the way of screen readers and the tab key');
  await pg.screenshot({ path: 'tests/shots/console2-' + w + '-today.png', fullPage: true });

  console.log(label + ' · the steward, at the top of Today');
  const stw = await pg.evaluate(() => {
    const c = document.querySelector('#s-today .stw');
    if (!c) return null;
    return {
      first: document.querySelector('#s-today > *').className,
      label: c.querySelector('.lab').textContent,
      read: (c.querySelector('.rd') || {}).textContent || '',
      say: (c.querySelector('p.say') || {}).textContent || '',
      levels: [...c.querySelectorAll('.fnd > .f')].map(f => f.className.replace('f ', '')),
      titles: [...c.querySelectorAll('.fnd > .f b')].map(b => b.textContent),
      fold: (c.querySelector('.fnd details.q summary') || {}).textContent || '',
      foldOpen: !!(c.querySelector('.fnd details.q') || {}).open,
      foldRows: c.querySelectorAll('.fnd details.q .f').length,
      posts: [...c.querySelectorAll('[data-sact]')].map(b => b.textContent),
      opens: [...c.querySelectorAll('[data-sopen]')].map(a => ({ t: a.textContent, href: a.getAttribute('href'), tgt: a.getAttribute('target'), rel: a.getAttribute('rel') })),
      noBtnOnGood: !c.querySelector('.fnd details.q [data-sact], .fnd details.q [data-sopen]')
    };
  });
  ok(stw && /^stw/.test(stw.first), 'the steward is the first thing on Today, above everything else');
  ok(stw.label === 'The Lantern', 'a small mono label says whose paragraph this is: ' + stw.label);
  ok(/^read \d+ min ago$/.test(stw.read), 'with when it was read: ' + JSON.stringify(stw.read));
  ok(/Instagram token has 6 days left/.test(stw.say) && /Telegram has taken nothing/.test(stw.say), 'and the paragraph the server sent, whole');
  ok(stw.levels.join(',') === 'act,act,watch,watch', 'the findings that need a person are act first, then watch: ' + stw.levels.join(','));
  ok(/^4 things are as they should be$/.test(stw.fold.trim()), 'and the good ones are folded into one quiet line: ' + JSON.stringify(stw.fold.trim()));
  ok(!stw.foldOpen && stw.foldRows === 4, 'closed to begin with, and it holds all four');
  ok(stw.noBtnOnGood, 'nothing that is as it should be carries a button');
  ok(stw.posts.join('|') === 'I have just renewed it|Send the last slot to Telegram', 'each action is a button with the label the server wrote: ' + stw.posts.join('|'));
  ok(stw.opens.length === 1 && stw.opens[0].tgt === '_blank' && stw.opens[0].rel === 'noopener' && stw.opens[0].href === '/api/threads?action=status',
     'an open action is a link into a new tab, at the href the server gave: ' + JSON.stringify(stw.opens[0]));
  ok(await pg.evaluate(() => [...document.querySelectorAll('#s-today .stw .f')].every(f => !!f.querySelector('b') && !!f.querySelector('span.sy'))),
     'every finding shows its title and its sentence');
  await pg.click('#s-today .fnd details.q summary');
  await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => document.querySelector('#s-today .fnd details.q').open && /Readers today: 31/.test(document.getElementById('s-today').innerText)),
     'and the quiet line expands to show them');

  posted.length = 0;
  await pg.click('#s-today [data-sact="1"]');
  await pg.waitForTimeout(700);
  const acted = posted.filter(x => !x.method && /^\/api\/social/.test(x.url));
  ok(acted.length === 1 && acted[0].url === '/api/social'
     && JSON.stringify(acted[0].body) === JSON.stringify({ action: 'retry-channel', date: '2026-09-06', slot: 'dusk', where: 'telegram' }),
     'the action posts exactly the route and the body the server sent, and nothing else: ' + JSON.stringify(acted));
  ok(posted.some(x => x.method === 'GET' && /action=steward/.test(x.url) && /fresh=1/.test(x.url)), 'and the house is read again afterwards');
  posted.length = 0;
  await pg.waitForSelector('#s-today #stw-again', { timeout: 10000 });
  await pg.click('#stw-again');
  await pg.waitForTimeout(600);
  ok(posted.some(x => x.method === 'GET' && /\/api\/house\?action=steward&fresh=1/.test(x.url)), 'Read again asks for the answer past its ten minutes, with fresh=1');
  ok(await noSideScroll(pg), 'the steward does not widen the page');

  console.log(label + ' · Posts');
  await pg.click('nav.bar [data-s="posts"]');
  await pg.waitForSelector('#s-posts .slot', { timeout: 15000 });
  await pg.waitForTimeout(300);
  ok((await surfaceOn(pg)) === 's-posts', 'the bar moves to Posts');
  const p = await pg.evaluate(() => ({
    retry: [...document.querySelectorAll('[data-retry]')].map(b => b.getAttribute('data-retry')),
    fix: [...document.querySelectorAll('[data-fix]')].map(b => b.getAttribute('data-fix')),
    why: [...document.querySelectorAll('[data-why]')].map(b => b.getAttribute('data-why')),
    send: [...document.querySelectorAll('[data-send]')].map(b => b.getAttribute('data-send')),
    mode: (document.querySelector('#seg button.on') || {}).dataset && document.querySelector('#seg button.on').dataset.mode,
    text: document.getElementById('s-posts').innerText,
    gridEmpty: document.getElementById('reel-grid').children.length === 0
  }));
  ok(p.retry.includes('light|instagram'), 'the network that refused is a Retry button');
  ok(!p.retry.includes('light|facebook'), 'the one that worked is not');
  ok(!p.retry.some(x => x === 'word|facebook' || x === 'word|instagram'), 'a row where both worked offers no retry of either');
  ok(!p.retry.includes('reelB|instagram'), 'a container still transcoding is not offered a retry');
  ok(p.fix.includes('light|instagram') && p.why.includes('light|instagram'), "Fix it and What's wrong? sit on the half-failed row");
  ok(!p.send.includes('light'), 'Post now is NOT on the half-failed row (it would post twice)');
  ok(p.send.includes('reelA') && !p.send.includes('dusk'), 'the owed row leads with Post now; the one still to come does not');
  ok(p.mode === 'auto', 'the ladder shows the rung the server holds');
  ok(/41 days/.test(p.text) || /41/.test(p.text), 'the token clocks show days left');
  ok(/r\/islam/.test(p.text), 'the Reddit draft waits for a hand');
  ok(p.gridEmpty, 'the reels grid is not built until the fold opens');
  ok(await noSideScroll(pg), 'nothing scrolls sideways');
  await pg.screenshot({ path: 'tests/shots/console2-' + w + '-posts.png', fullPage: true });

  /* a network that joined after the post went out is offered on the sent rows */
  ok(await pg.$('#slot-dawn [data-retry="dawn|pinterest"]') !== null, 'a sent card offers + pinterest, which was not live when it went out');
  ok(await pg.$('#slot-word [data-retry="word|pinterest"]') === null && /pinterest · waiting/.test(p.text), 'a network waiting on its own review is a quiet grey chip, not a retry button');
  ok(/pinterest is waiting on its own review/.test(p.text), 'said once at the top of the day: ' + (p.text.match(/.{0,40}waiting on its own.{0,40}/) || ['(missing)'])[0]);
  ok(/Qalqalah[^]{0,300}?\bsent\b/.test(p.text) && !/Qalqalah[^]{0,300}?half sent/.test(p.text), 'and the slot reads sent: ' + JSON.stringify((p.text.match(/Qalqalah[^]{0,120}/) || [''])[0]));
  ok(await pg.$('#slot-dawn [data-retry="dawn|youtube"]') === null, 'but not YouTube, which takes only video');
  ok(await pg.$('#slot-dawn [data-retry="dawn|x"]') === null && await pg.$('#slot-dawn [data-retry="dawn|reddit"]') === null, 'and nothing that is off or draft-only');
  ok(await pg.$('#slot-dawn [data-retry="dawn|facebook"]') === null, 'a network that already took the post is not offered again');
  ok(await pg.$('#slot-reelA [data-retry="reelA|pinterest"]') === null, 'an owed slot offers nothing extra: Post now covers it');
  posted.length = 0;
  await pg.click('#slot-dawn [data-retry="dawn|pinterest"]');
  await pg.waitForTimeout(500);
  ok(posted.length === 1 && posted[0].body.action === 'retry-channel' && posted[0].body.slot === 'dawn' && posted[0].body.where === 'pinterest' && !posted[0].body.force,
     '+ pinterest asks for retry-channel on that network alone, without force');

  posted.length = 0;
  await pg.click('[data-retry="light|instagram"]');
  await pg.waitForTimeout(500);
  ok(posted.length === 1 && posted[0].body.action === 'retry-channel' && posted[0].body.slot === 'light' && posted[0].body.where === 'instagram',
     'Retry asks for retry-channel on that one network');
  ok(!posted.some(x => x.body.force), 'and never sends force');

  await pg.click('[data-why="light|instagram"]');
  await pg.waitForTimeout(600);
  const why = await pg.evaluate(() => ({ open: document.getElementById('sheet').classList.contains('on'), text: document.getElementById('sheet-in').innerText,
    retry: !!document.querySelector('#sheet-in [data-retry="light|instagram"]') }));
  ok(why.open, "What's wrong? opens a sheet");
  ok(/could not fetch or process/.test(why.text) && /9004/.test(why.text) && /reachable now/.test(why.text), 'that names the cause, the code, and the checks it ran');
  ok(why.retry, 'and offers Retry right there');
  await pg.click('#sheet-in #cl');
  await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => !document.getElementById('sheet').classList.contains('on') && document.body.style.overflow === ''), 'Close puts the sheet away and gives the page back');

  await pg.click('[data-prev="light"]');
  await pg.waitForTimeout(600);
  const pv = await pg.evaluate(() => ({ text: document.getElementById('sheet-in').innerText, img: !!document.querySelector('#sheet-in img') }));
  if (!(/human nature/.test(pv.text) && pv.img)) console.log('   preview text:', JSON.stringify(pv));
  ok(/human nature/.test(pv.text) && pv.img && /#noor/.test(pv.text), 'Preview shows the card, its title and the caption as Instagram would get it');
  await pg.evaluate(() => { document.getElementById('veil').click(); });
  await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => !document.getElementById('sheet').classList.contains('on')), 'tapping the veil closes it');

  posted.length = 0;
  await pg.click('[data-fix="light|instagram"]');
  await pg.waitForTimeout(700);
  ok(posted.some(x => x.body.action === 'retry-channel'), 'Fix it follows the diagnosis (fix: retry) and retries');

  await pg.click('#reels-fold summary');
  await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => document.getElementById('reel-grid').children.length === 2), 'opening the fold builds the reels grid');

  posted.length = 0;
  await pg.click('#seg [data-mode="approve"]');
  await pg.waitForSelector('#sheet.on #yes, #sheet:not([hidden]) #yes', { timeout: 5000 });
  ok(posted.length === 0, 'touching a rung asks first, posting nothing yet');
  await pg.click('#yes');
  await pg.waitForTimeout(500);
  ok(posted.some(x => x.url.startsWith('/api/settings') && x.body['social.mode'] === 'approve'), 'confirming posts {"social.mode":"approve"} to /api/settings');
  ok(await noSideScroll(pg), 'the sheet did not widen the page');

  console.log(label + ' · Readers');
  await pg.click('nav.bar [data-s="readers"]');
  await pg.waitForSelector('#s-readers .card', { timeout: 15000 });
  await pg.waitForTimeout(300);
  const r = await pg.evaluate(() => document.getElementById('s-readers').innerText);
  ok(/31/.test(r) && /85/.test(r), 'today and the 30 days are counted');
  ok(/filtered from/.test(r), 'the day the count became honest is marked');
  ok(/not counted/.test(r), 'and this browser is shown as not counted');
  ok(/88/.test(r) && /crawlers/.test(r), 'the turned-away total is explained');
  ok(/thank you for the library/.test(r), 'the inbox lists what arrived');
  ok(/A reply that waits/.test(r) && /flagged: link/.test(r), 'a held reply shows with why it was held');
  /* what strangers watch */
  const rAll = await pg.evaluate(() => document.getElementById('s-readers').textContent);   /* the folds too */
  ok(/what strangers watch/i.test(r) && /62 of 70 read/.test(r) && /8 to read again/.test(r), 'the fortnight\'s read is summed up: read, of how many, how many are stale');
  ok(/verse reels/.test(r) && /word cards/.test(r) && /word reels/.test(r), 'every kind is a bar');
  const kb = await pg.evaluate(() => [...document.querySelectorAll('#s-readers details[open] .bars .b')].map(b => ({ n: b.querySelector('.n').textContent, w: b.querySelector('.t i').dataset.w, v: b.querySelector('.v').textContent })));
  ok(kb.length === 3 && /verse reels/.test(kb[0].n) && kb[0].w === '100' && kb[0].v === '2,400' && kb[2].w === '13', 'the kind bars are median reach against the best, with the count: ' + JSON.stringify(kb));
  ok(/08:00 UTC/.test(rAll) && /21:00 UTC/.test(rAll), 'the hours are rows, in a fold');
  ok(/Verse reels reach 8× the median of word reels/.test(r) && /21:00 slot reaches least/.test(r), 'the sentences the numbers support are printed');
  ok(/One verse about light/.test(rAll) && /A Short/.test(rAll) && /views/.test(rAll), 'the top ten lists the posts, a Short by its views');
  ok(await pg.evaluate(() => !!document.querySelector('#s-readers a[href="https://youtube.com/shorts/y1"]')), 'with a link where the network gives one');
  ok(!/needs a permission/.test(r), 'no permission is asked for when none is missing');
  posted.length = 0;
  await pg.click('#ins-read');
  await pg.waitForTimeout(900);
  const rf = posted.filter(x => x.url.startsWith('/api/insights'));
  ok(rf.length === 2 && rf.every(x => x.body.action === 'refresh' && x.body.days === 14), 'Read again posts refresh, and again while the answer is partial, then stops: ' + rf.length);
  ok(await pg.evaluate(() => /Read again/.test(document.getElementById('ins-read').textContent) && !document.getElementById('ins-read').disabled), 'and the button comes back');
  ok(await pg.evaluate(() => /Read 70/.test(document.getElementById('toast').textContent)), 'the owner is told how many were read');
  await pg.click('[data-held="0"]');
  await pg.waitForTimeout(400);
  const held = await pg.evaluate(() => ({ open: document.getElementById('sheet').classList.contains('on'), text: document.getElementById('sheet-in').innerText }));
  ok(held.open && /opens when the row is tapped/.test(held.text) && /flagged: link/.test(held.text), 'tapping a held reply opens the whole of it, with why it was held');
  posted.length = 0;
  await pg.click('#sheet-in [data-rm="e1|c9"]');
  await pg.waitForTimeout(400);
  ok(posted.some(x => x.url.startsWith('/api/journal') && x.body.action === 'comment-state' && x.body.state === 'reject'), 'Remove from the sheet posts comment-state reject');
  ok(await pg.evaluate(() => !document.getElementById('sheet').classList.contains('on')), 'and the sheet closes');
  await pg.waitForSelector('[data-rel="e1|c9"]', { timeout: 5000 });
  posted.length = 0;
  await pg.click('[data-rel="e1|c9"]');
  await pg.waitForTimeout(500);
  ok(posted.some(x => x.url.startsWith('/api/journal') && x.body.action === 'comment-state' && x.body.id === 'e1' && x.body.cid === 'c9' && x.body.state === 'approve'),
     'Release posts comment-state approve with the entry and the comment');
  ok(await noSideScroll(pg), 'nothing scrolls sideways');
  await pg.screenshot({ path: 'tests/shots/console2-' + w + '-readers.png', fullPage: true });

  console.log(label + ' · House');
  await pg.click('nav.bar [data-s="house"]');
  await pg.waitForSelector('#s-house .row', { timeout: 15000 });
  await pg.waitForTimeout(600);
  const hs = await pg.evaluate(() => document.getElementById('s-house').innerText);
  ok(/first in line: inkling/.test(hs), 'the Lantern row comes from the cheap probe-free read, naming the model first in line');
  await pg.click('#lantern-test');
  await pg.waitForTimeout(700);
  const lt = await pg.evaluate(() => document.getElementById('lantern-sub').textContent);
  if (!/Lit · inkling answered in/.test(lt)) console.log('   lantern sub:', lt);
  ok(/Lit · inkling answered in (0\.9|1\.0) s/.test(lt), 'Test it asks OpenRouter for one word and reports who answered and how fast');
  ok(/redis/i.test(hs) || /store/i.test(hs), 'the store is reported');
  ok(/\$90/.test(hs) && /30 USD/.test(hs), 'giving is shown');
  ok(/Amina/.test(hs) && /15 EUR/.test(hs) && /lit on the wall/.test(hs), 'a guardian is shown by the name they chose, with what they give');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#s-house [data-room]')].map(b => b.dataset.room).join(',')) === 'lights,legacy,marketing,journal,night,system',
     'the six rooms are cards on the hub, in order');
  ok(await pg.evaluate(() => !document.querySelector('#s-house a[href^="/admin#"]')) && !/rest of the house/i.test(hs),
     'and nothing on the hub points back into the old console');
  ok(/421/.test(hs) && /questioned/.test(hs), 'the Lights card carries a live number: the library is counted');
  ok(/2\s*entries/.test(hs) && /1 waiting/.test(hs), 'the Journal card counts the entries and what waits');
  ok(/1\s*\n?flagged/.test(hs.replace(/\s+/g, ' ')) || /flagged/.test(hs), 'the Night card counts what was flagged');
  ok(/2 of 3/.test(hs), 'the System card counts the keys that are set, and this house has no Stripe key');
  ok(await noSideScroll(pg), 'nothing scrolls sideways');
  await pg.screenshot({ path: 'tests/shots/console2-' + w + '-house.png', fullPage: true });

  console.log(label + ' · Flow');
  posted.length = 0;
  await pg.click('nav.bar [data-s="flow"]');
  await pg.waitForSelector('#s-flow svg.flow', { timeout: 15000 });
  await pg.waitForTimeout(400);
  ok((await surfaceOn(pg)) === 's-flow', 'the bar moves to Flow');
  ok(await pg.evaluate(() => location.hash) === '#flow', 'and the hash follows it to #flow');
  ok(await pg.evaluate(() => document.getElementById('title').textContent) === 'Flow', 'the top bar names it');
  ok(posted.some(x => x.method === 'GET' && /\/api\/house\?action=flow&days=14/.test(x.url)), 'it draws GET /api/house?action=flow with the fortnight');
  const map = await pg.evaluate(() => {
    const s = document.querySelector('#s-flow svg.flow');
    const stages = [...s.querySelectorAll('[data-stage]')].map(g => g.getAttribute('data-stage'));
    const edges = [...s.querySelectorAll('path[data-edge]')].map(p => ({ id: p.getAttribute('data-edge'), w: p.getAttribute('stroke-width'), cls: p.getAttribute('class') }));
    const hollow = [...s.querySelectorAll('.node.unread')].map(g => g.getAttribute('data-stage'));
    return {
      stages, edges,
      nets: [...s.querySelectorAll('[data-net]')].map(g => g.getAttribute('data-net')),
      srcs: s.querySelectorAll('path[data-src]').length,
      hollow, hollowText: [...s.querySelectorAll('.node.unread .nv')].map(t => t.textContent),
      rates: [...s.querySelectorAll('text.rt')].map(t => ({ id: t.getAttribute('data-rate'), t: t.textContent })),
      viewBox: s.getAttribute('viewBox'),
      table: [...document.querySelectorAll('#flow-table .row')].map(r => ({
        id: r.getAttribute('data-trow'),
        label: r.querySelector('.t b').textContent,
        source: r.querySelector('.t span').textContent,
        value: r.querySelector('.r').innerText.replace(/\s+/g, ' ').trim() })),
      notes: (document.getElementById('flow-notes') || {}).innerText || '',
      days: (document.querySelector('#flow-seg button.on') || {}).textContent
    };
  });
  ok(map.stages.join(',') === 'posts,reach,views,clicks,readers,pages,gifts,duas,given,guardians',
     'one node per stage the server sent, in the order the energy runs: ' + map.stages.join(','));
  ok(map.edges.length === 7 && map.edges.map(e => e.id).join(' ') === 'posts>reach reach>views reach>clicks clicks>readers readers>pages readers>gifts readers>duas',
     'and one path per edge: ' + map.edges.map(e => e.id).join(' '));
  ok(map.nets.join(',') === 'instagram,youtube,facebook' && map.srcs === 3,
     'the networks are small source nodes on the left, one connector each: ' + map.nets.join(','));
  ok(map.hollow.join(',') === 'views,guardians' && map.hollowText.every(t => t === 'unread'),
     'a stage that could not be read is a hollow node saying unread, never a nought: ' + JSON.stringify(map.hollowText));
  ok(map.edges.every(e => e.w === null || (+e.w >= 1.5 && +e.w <= 8)), 'every measured step is between a hairline and eight: ' + map.edges.map(e => e.w).join(','));
  ok(map.edges.filter(e => /big/.test(e.cls)).length === 1 && /big/.test(map.edges.find(e => e.id === 'readers>pages').cls) === false
     && /big/.test(map.edges.find(e => e.id === 'posts>reach').cls), 'gold marks the one largest step and no other');
  ok(/none/.test(map.edges.find(e => e.id === 'reach>views').cls), 'a step whose end could not be measured is dotted');
  ok(map.rates.map(r => r.id).sort().join(' ') === 'clicks>readers posts>reach readers>duas readers>gifts readers>pages',
     'a rate is written only where the server sent one: ' + map.rates.map(r => r.id).join(' '));
  ok(!map.rates.some(r => r.id === 'reach>clicks') && !map.rates.some(r => r.id === 'reach>views'),
     'the two steps the server gave no rate for carry no label at all');
  ok(map.rates.find(r => r.id === 'readers>gifts').t === '2.1 % of readers' && map.rates.find(r => r.id === 'posts>reach').t === '150 × posts',
     'a share reads as a percentage and a multiple reads as a multiple: ' + JSON.stringify(map.rates.map(r => r.t)));
  const vb = map.viewBox.split(' ').map(Number);
  if (w < 900) ok(vb[3] > vb[2], 'on a phone the map runs top to bottom: ' + map.viewBox);
  else ok(vb[2] > vb[3], 'at a desk the map runs left to right: ' + map.viewBox);
  const cell = id => (map.table.find(t => t.id === id) || {});
  ok(map.table.map(t => t.id).join(',') === 'posts,reach,views,clicks,readers,pages,gifts,given,duas,guardians',
     'every stage the server sent is a row under the picture, in the order the server sent them: ' + map.table.map(t => t.id).join(','));
  ok(map.table.length === map.stages.length && map.table.every(t => map.stages.indexOf(t.id) >= 0), 'the list and the drawing hold the same stages and no others');
  ok(cell('reach').value === '1,200 people' && cell('readers').value === '140 people' && cell('pages').value === '420 pages' && cell('given').value === '45 USD',
     'the same numbers are written out with their units, so the drawing is never the only encoding: ' + JSON.stringify(map.table.map(t => t.value)));
  ok(cell('views').value === 'unread' && cell('guardians').value === 'unread', 'and the two unread stages say unread there too, never a nought');
  ok(cell('readers').source === "the beacon's counters, nv:<date>:people", 'with the record each number came from: ' + cell('readers').source);
  ok(/cookieless/.test(map.notes) && /once per person per day into a key per month/.test(map.notes) && /would invent a number/.test(map.notes),
     'the server\'s notes are printed whole, in muted text');
  ok(map.days === '14 days', 'the fortnight is the rung the control shows');
  ok(await noSideScroll(pg), 'nothing scrolls sideways');
  await pg.screenshot({ path: 'tests/shots/console2-' + w + '-flow.png', fullPage: true });

  posted.length = 0;
  await pg.click('#flow-seg [data-fd="7"]');
  await pg.waitForTimeout(600);
  ok(posted.some(x => x.method === 'GET' && /\/api\/house\?action=flow&days=7/.test(x.url)), 'the days control asks the house again with days=7');
  ok(await pg.evaluate(() => document.querySelector('#flow-seg button.on').dataset.fd) === '7', 'and the control moves to it');
  posted.length = 0;
  await pg.click('#flow-seg [data-fd="30"]');
  await pg.waitForTimeout(600);
  ok(posted.some(x => x.method === 'GET' && /days=30/.test(x.url)) && /30 days asked for/.test(await pg.evaluate(() => document.getElementById('flow-notes').innerText)),
     'and again with days=30, notes and all');
  await pg.click('#flow-seg [data-fd="14"]');
  await pg.waitForTimeout(600);

  await pg.click('#s-flow [data-stage="posts"]');
  await pg.waitForTimeout(400);
  const nodeSheet = await pg.evaluate(() => ({ open: document.getElementById('sheet').classList.contains('on'),
    text: document.getElementById('sheet-in').innerText,
    bars: [...document.querySelectorAll('#sheet-in .bars .b')].map(b => b.querySelector('.n').textContent + ':' + b.querySelector('.v').textContent) }));
  ok(nodeSheet.open && /nsoc:slot:<date>#<slot>/.test(nodeSheet.text), 'tapping a node opens a sheet with the sentence naming its source');
  ok(nodeSheet.bars.join(' ') === 'instagram:8 youtube:4 facebook:4', 'and its by-network breakdown as a bar list: ' + nodeSheet.bars.join(' '));
  await pg.click('#sheet-in #cl');
  await pg.waitForTimeout(250);
  await pg.click('#s-flow [data-stage="reach"]');
  await pg.waitForTimeout(400);
  ok(/unread rather than nought/.test(await pg.evaluate(() => document.getElementById('sheet-in').innerText)),
     'a network the cache holds nothing for is named as unread inside the sheet, never drawn as a nought bar');
  await pg.click('#sheet-in #cl');
  await pg.waitForTimeout(250);

  posted.length = 0;
  await pg.click('#flow-trace');
  await pg.waitForTimeout(200);
  const moving = await pg.evaluate(() => ({ m: document.querySelectorAll('#s-flow animateMotion').length, dots: document.querySelectorAll('#flow-pulses .pulse').length }));
  ok(moving.m === 10 && moving.dots === 10, 'Trace sends one dot along every step, once: ' + JSON.stringify(moving));
  ok(posted.length === 0, 'and it asks the house for nothing to do it');
  await pg.waitForTimeout(3200);
  ok(await pg.evaluate(() => document.querySelectorAll('#s-flow animateMotion').length) === 0, 'the motion is finite: when it has run, nothing is left moving');

  /* a reload must land back on the map */
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#s-flow.on svg.flow', { timeout: 15000 });
  ok((await surfaceOn(pg)) === 's-flow', 'a reload on #flow lands back on the map');
  ok(await noSideScroll(pg), 'nothing scrolls sideways');

  console.log(label + ' · the six rooms open, route and draw');
  const ROOMS = [['lights', 'Lights'], ['legacy', 'Legacy'], ['marketing', 'Marketing'],
                 ['journal', 'Journal desk'], ['night', 'Night shift'], ['system', 'System']];
  for (const [id, name] of ROOMS) {
    await pg.click('nav.bar [data-s="house"]');
    await pg.waitForSelector('#s-house [data-room="' + id + '"]', { timeout: 15000 });
    await pg.click('#s-house [data-room="' + id + '"]');
    await pg.waitForSelector('#s-' + id + '.on .card, #s-' + id + '.on .row', { timeout: 15000 });
    await pg.waitForTimeout(250);
    ok((await surfaceOn(pg)) === 's-' + id, name + ' opens from House');
    ok(await pg.evaluate(() => location.hash) === '#' + id, 'the hash follows it to #' + id);
    ok(await pg.evaluate(() => document.getElementById('title').textContent) === name, 'the top bar names it: ' + name);
    ok(await pg.evaluate(() => !!document.querySelector('.surf.on .back')), 'and a way back to House sits at the top of it');
    ok(await pg.evaluate(() => document.querySelector('nav.bar [data-s="house"]').classList.contains('on')), 'the bar still lights House, the door it is behind');
    ok(await noSideScroll(pg), name + ' does not scroll sideways');
    await pg.screenshot({ path: 'tests/shots/console2-' + w + '-' + id + '.png', fullPage: true });
    /* a reload must land in the same room */
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('#s-' + id + '.on', { timeout: 15000 });
    await pg.waitForTimeout(200);
    ok((await surfaceOn(pg)) === 's-' + id, 'a reload lands back in ' + name);
    await pg.click('.surf.on .back');
    await pg.waitForTimeout(200);
    ok((await surfaceOn(pg)) === 's-house', 'and the back affordance returns to House');
  }

  console.log(label + ' · what each room says');
  const roomText = async id => {
    await pg.click('nav.bar [data-s="house"]');
    await pg.waitForSelector('#s-house [data-room="' + id + '"]', { timeout: 15000 });
    await pg.click('#s-house [data-room="' + id + '"]');
    await pg.waitForSelector('#s-' + id + '.on .card', { timeout: 15000 });
    await pg.waitForTimeout(250);
    return pg.evaluate(i => document.getElementById('s-' + i).innerText, id);
  };

  const ltx = await roomText('lights');
  ok(/lamp in the niche/.test(ltx) && /the week has been dark/.test(ltx), 'Lights shows the day\'s card and why it was chosen');
  ok(/421/.test(ltx) && /38/.test(ltx) && /22/.test(ltx), 'the library is counted: cards, western dates, Islamic dates');
  ok(await pg.evaluate(() => document.querySelectorAll('#s-lights .mon i').length === 12), 'the twelve months are drawn as bars');
  ok(/A number that grew in the telling/.test(ltx), 'and every card the editor questioned is listed');
  posted.length = 0;
  await pg.fill('#lt-date', '2026-10-01');
  await pg.click('#lt-go');
  await pg.waitForTimeout(500);
  ok(posted.some(x => x.url.includes('probe=lights') && x.url.includes('date=2026-10-01')), 'See that day asks the library for that day');

  const lg = await roomText('legacy');
  ok(/Amina/.test(lg) && /FR/.test(lg) && /15 EUR/.test(lg), 'Legacy lists the Guardian, the region and what they give');
  ok(/\$3/.test(lg) && /\$120/.test(lg), 'the week and the monthly pace are tiles');
  ok(/retired/.test(lg), 'and the room says plainly that the program is closed');
  posted.length = 0;
  await pg.click('#s-legacy [data-act="vet"]');
  await pg.waitForTimeout(700);
  const vetSaid = await pg.evaluate(() => document.getElementById('sheet-in').innerText);
  ok(posted.some(x => x.url.startsWith('/api/admin-guardians') && x.body.action === 'intake'), 'Vet reads the sponsor\'s own answers first');
  ok(posted.some(x => x.url.startsWith('/api/admin-vet') && x.body.name === 'Amina Textiles' && x.body.market === 'FR'), 'then hands them to the Lantern against the charter');
  ok(/review/.test(vetSaid) && /62/.test(vetSaid) && /interest bearing/.test(vetSaid), 'and the verdict, the confidence and the questions come back in a sheet');
  await pg.click('#sheet-in #cl');
  await pg.waitForTimeout(300);
  posted.length = 0;
  await pg.click('#s-legacy [data-act="approve"]');
  await pg.waitForSelector('#ap-name', { timeout: 5000 });
  ok(await pg.evaluate(() => document.getElementById('ap-name').value) === 'Amina Textiles', 'Approve asks in a sheet, filled in with what they wrote at checkout, never a browser prompt');
  await pg.click('#ap-go');
  await pg.waitForTimeout(500);
  ok(posted.some(x => x.url.startsWith('/api/admin-guardians') && x.body.action === 'approve' && x.body.subscription === 'sub_ID2' && x.body.name === 'Amina Textiles'),
     'and Light it posts approve for that subscription, with the name that will be shown');
  posted.length = 0;
  await pg.waitForSelector('#s-legacy [data-act="release"]', { timeout: 5000 });
  await pg.click('#s-legacy [data-act="release"]');
  await pg.waitForSelector('#rl-go', { timeout: 5000 });
  ok(posted.length === 0, 'Release asks from a sheet first, ending nothing yet');
  await pg.click('#rl-go');
  await pg.waitForTimeout(500);
  ok(posted.some(x => x.body.action === 'release' && x.body.subscription === 'sub_FR1'), 'and only then does it end that Guardianship');
  posted.length = 0;
  await pg.waitForSelector('#s-legacy [data-act="unlight"]', { timeout: 5000 });
  await pg.click('#s-legacy [data-act="unlight"]');
  await pg.waitForTimeout(500);
  ok(posted.some(x => x.body.action === 'extinguish' && x.body.subscription === 'sub_FR1'), 'Unlight puts out a lamp that is already lit');
  posted.length = 0;
  await pg.waitForSelector('#v-go', { timeout: 5000 });
  await pg.fill('#v-name', 'A shop');
  await pg.click('#v-go');
  await pg.waitForTimeout(500);
  ok(posted.some(x => x.url.startsWith('/api/admin-vet') && x.body.name === 'A shop'), 'vetting by hand posts the typed name to the same endpoint');

  const mk = await roomText('marketing');
  ok(/Unseen/.test(mk) && /Never pushy/.test(mk) && /Pure/.test(mk), 'Marketing states the four laws before anything else');
  ok(/outreaches/i.test(mk) && /to go/.test(mk), 'the day\'s ten is counted with what is left to do');
  await pg.click('#ten-add');
  await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => document.getElementById('ten-n').textContent) === '1', 'one more sent moves the count');
  posted.length = 0;
  await pg.fill('#mk-target', 'Al-Huda Islamic School');
  await pg.click('#mk-go');
  await pg.waitForTimeout(600);
  const mkOut = await pg.evaluate(() => document.getElementById('mk-out').innerText);
  ok(posted.some(x => x.url.startsWith('/api/marketing') && x.body.kind === 'outreach' && x.body.target === 'Al-Huda Islamic School'),
     'Write it posts the kind and every field to /api/marketing');
  const kitVals = await pg.evaluate(() => ({ sub: document.querySelector('#mk-out [data-sub]').value, body: document.querySelector('#mk-out [data-body]').value }));
  ok(/Email to a school/.test(mkOut) && /one page map/.test(kitVals.body) && /free learning map/.test(kitVals.sub),
     'and what comes back is a paste kit, editable in place, each field in its own box');
  ok(await pg.evaluate(() => !!document.querySelector('#mk-out [data-sub]') && !!document.querySelector('#mk-out [data-cp="both"]')),
     'with the subject in its own box and a copy for each field');
  ok(/Fill in before sending/.test(mkOut), 'a bracketed blank is named before it can be sent as written');
  posted.length = 0;
  await pg.click('#wk-go');
  await pg.waitForTimeout(700);
  ok(posted.some(x => x.url.startsWith('/api/marketing') && x.body.kind === 'week'), 'Write my week asks for the week');
  ok(/Monday/.test(await pg.evaluate(() => document.getElementById('wk-out').innerText)), 'and the days come back one card each');
  await pg.click('#pipe-add');
  await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => document.querySelectorAll('#pipe-list .card').length) >= 2, 'the pipeline adds a row');
  await pg.click('#pipe-list [data-pc="0|sent"]');
  await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => document.querySelector('#pipe-list [data-pc="0|sent"]').classList.contains('good')), 'and a stage marks itself');
  await pg.click('#armor-list [data-ar="gh"]');
  await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => /1 of 7 closed/.test(document.getElementById('armor-list').innerText)), 'the armor counts what is still open');

  const jw = await roomText('journal');
  ok(/First light/.test(jw) && /published/.test(jw) && /draft/.test(jw), 'the Journal desk lists every entry with its state');
  ok(/A reply that waits/.test(jw) && /flagged: link/.test(jw), 'and the replies waiting to be read, with why they were held');
  ok(!/author/i.test(jw) && !/your name/i.test(jw), 'nothing on the desk asks who is writing');
  await pg.click('#jw-new');
  await pg.waitForSelector('#jw-title', { timeout: 5000 });
  ok(await pg.evaluate(() => [...document.querySelectorAll('#s-journal .card .fi')].map(i => i.id).join(',')) === 'jw-title,jw-dek,jw-body,jw-tags,jw-slug',
     'the writing desk has five fields and none of them is a byline');
  await pg.fill('#jw-title', 'A new entry');
  await pg.fill('#jw-body', 'Two paragraphs.\n\n## A heading');
  await pg.click('#jw-preview');
  await pg.waitForTimeout(300);
  ok(/A heading/.test(await pg.evaluate(() => document.getElementById('s-journal').innerText)), 'Preview renders the markup without saving anything');
  posted.length = 0;
  await pg.click('#jw-publish');
  await pg.waitForTimeout(600);
  ok(posted.some(x => x.url.startsWith('/api/journal') && x.body.action === 'save' && x.body.status === 'published' && x.body.title === 'A new entry'),
     'Publish posts save with the title, the body and published');
  await pg.waitForSelector('#s-journal [data-ed="0"]', { timeout: 5000 });
  await pg.click('#s-journal [data-ed="0"]');
  await pg.waitForTimeout(600);
  ok(await pg.evaluate(() => document.getElementById('jw-title').value) === 'First light'
     && await pg.evaluate(() => document.getElementById('jw-body').value) === 'The body of the entry.',
     'Edit reads the whole entry back into the desk');
  await pg.click('#jw-close');
  await pg.waitForTimeout(300);
  posted.length = 0;
  await pg.click('#s-journal [data-jrel="e1|c9"]');
  await pg.waitForTimeout(500);
  ok(posted.some(x => x.body.action === 'comment-state' && x.body.id === 'e1' && x.body.cid === 'c9' && x.body.state === 'approve'),
     'Release posts comment-state approve');
  await pg.waitForSelector('#s-journal [data-jrm="e1|c9"]', { timeout: 5000 });
  posted.length = 0;
  await pg.click('#s-journal [data-jrm="e1|c9"]');
  await pg.waitForTimeout(300);
  ok(posted.length === 0 && /Sure/.test(await pg.evaluate(() => document.querySelector('#s-journal [data-jrm="e1|c9"]').textContent)),
     'Refuse asks a second time before anything is refused');
  await pg.click('#s-journal [data-jrm="e1|c9"]');
  await pg.waitForTimeout(500);
  ok(posted.some(x => x.body.action === 'comment-state' && x.body.state === 'reject'), 'and the second tap refuses it');
  posted.length = 0;
  await pg.click('#jw-triage');
  await pg.waitForTimeout(600);
  ok(posted.some(x => x.body.action === 'triage'), 'the sorting is asked for by hand');
  ok(/Sorted 7 replies across 2 entries/.test(await pg.evaluate(() => document.getElementById('s-journal').innerText)), 'and it says what it sorted');

  const ns = await roomText('night');
  ok(/Readers held steady/.test(ns), 'the Night shift opens with the brief it wrote');
  ok(/40 of 900/.test(ns) && /nf-12/.test(ns) && /without a collection/.test(ns), 'what it read, what it flagged, and why');
  ok(/pillars\.html/.test(ns) && /seven grams/.test(ns), 'and the corrections already live on the site');
  posted.length = 0;
  await pg.fill('#ns-in', 'What should I do today?');
  await pg.click('#ns-go');
  await pg.waitForTimeout(600);
  ok(posted.some(x => x.url.startsWith('/api/assistant') && x.body.mode === 'assist' && x.body.messages[0].content === 'What should I do today?'),
     'the Lantern is asked with the whole turn, in assist mode');
  ok(/Answer one message/.test(await pg.evaluate(() => document.getElementById('ns-chat').innerText)), 'and its answer joins the conversation');
  await pg.click('#ns-modes [data-nsmode="edit"]');
  await pg.waitForTimeout(300);
  posted.length = 0;
  await pg.fill('#ns-in', 'The nisab line says ounces');
  await pg.click('#ns-go');
  await pg.waitForTimeout(600);
  ok(posted.some(x => x.url.startsWith('/api/assistant') && x.body.mode === 'edit'), 'proposing a correction asks in edit mode');
  const strip = await pg.evaluate(() => document.getElementById('ns-strip').innerText);
  ok(/seven ounces/.test(strip) && /seven grams/.test(strip), 'and what comes back is shown as before and after, changing nothing');
  posted.length = 0;
  await pg.click('#ns-apply');
  await pg.waitForTimeout(600);
  ok(posted.some(x => x.url.startsWith('/api/overrides') && x.body.page === 'pillars.html' && x.body.find === 'seven ounces' && x.body.replace === 'seven grams'),
     'Apply posts the correction to /api/overrides');
  posted.length = 0;
  await pg.click('#s-night [data-ovrm="o1"]');
  await pg.waitForTimeout(500);
  ok(posted.some(x => x.method === 'DELETE' && x.body.id === 'o1'), 'a live correction is removed by its id');
  posted.length = 0;
  await pg.click('#ovr-clear');
  await pg.waitForSelector('#ovr-go', { timeout: 5000 });
  ok(posted.length === 0, 'Revert everything asks from a sheet first, deleting nothing yet');
  await pg.click('#ovr-go');
  await pg.waitForTimeout(500);
  ok(posted.some(x => x.method === 'DELETE' && x.body.all === true), 'and only then does it revert them all');
  posted.length = 0;
  await pg.click('#s-night [data-clear="nf-12"]');
  await pg.waitForTimeout(300);
  ok(posted.length === 0, 'a finding is not dismissed on the first tap');
  await pg.click('#s-night [data-clear="nf-12"]');
  await pg.waitForTimeout(600);
  ok(posted.some(x => x.url.includes('probe=night') && x.url.includes('clear=nf-12')), 'the second tap dismisses it');

  const sy = await roomText('system');
  ok(/OPENROUTER_API_KEY/.test(sy) && /set/.test(sy), 'System shows every key as set or unset');
  ok(!/sk_|redis:\/\/|http.*token/i.test(sy), 'and never a value');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#s-system [data-door]')].map(b => b.dataset.door).join(' ')).then(s => /dashboard\.stripe\.com/.test(s) && /vercel\.com/.test(s) && /openrouter\.ai\/activity/.test(s) && /noor-preview=GLOBAL/.test(s)),
     'the quick doors are buttons onto the same four addresses');
  await pg.click('#sys-lantern');
  await pg.waitForTimeout(700);
  const sl = await pg.evaluate(() => document.getElementById('sys-lantern-out').innerText);
  ok(/lantern is lit/.test(sl) && /inkling/.test(sl) && /950 ms/.test(sl), 'and the lantern is asked for one word, model by model');
  await pg.click('nav.bar [data-s="house"]');
  await pg.waitForTimeout(300);

  console.log(label + ' · the bar and the rail');
  const bar = await pg.evaluate(() => { const b = document.querySelector('nav.bar').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, vw: innerWidth, vh: innerHeight }; });
  if (w < 900) ok(bar.y + bar.h >= bar.vh - 2 && bar.w >= bar.vw - 2, 'on a phone the bar sits along the bottom');
  else ok(bar.x < 40 && bar.h > bar.w, 'at a desk the bar is a rail on the left');
  await pg.click('nav.bar [data-s="posts"]');
  await pg.waitForTimeout(200);
  const tap = await pg.evaluate(() => {
    const vis = b => b.getBoundingClientRect().height;
    return [...document.querySelectorAll('nav.bar button, .slot .b .btn')].every(b => vis(b) >= 32)
      && [...document.querySelectorAll('.slot .b button.chan')].every(b => vis(b) >= 28);
  });
  ok(tap, 'every control on the Posts surface is tall enough for a thumb');
  ok(errors.length === 0, 'no script threw: ' + (errors[0] || 'clean'));
  await pg.close();
}

/* ---------------------------------------------------------------------------
   THE STEWARD AND THE OLD LIST DO NOT SAY THE SAME THING TWICE
--------------------------------------------------------------------------- */
for (const [label, w, h] of [['phone 390', 390, 844], ['desk 1280', 1280, 900]]) {
  console.log('\n' + label + ' · the steward speaks for a slot, so Waiting for you drops that line');
  const posted = [], errors = [];
  const pg = await open_(w, h, posted, errors, { steward: STEWARD_SLOTS });
  const t = await pg.evaluate(() => document.getElementById('s-today').innerText);
  const waits = await pg.evaluate(() => [...document.querySelectorAll('#s-today .row[data-go]')].map(r => r.querySelector('b').textContent));
  ok(await pg.evaluate(() => (document.querySelector('#s-today .stw .lab') || {}).textContent) === 'From the record',
     'with the Lantern dark the label says the paragraph came from the record instead');
  ok(/2 things need you today/.test(t), 'and the paragraph the house templated for itself still reads');
  ok(!waits.some(x => /^reelA is owed$/.test(x)), 'the slot the steward carries is gone from Waiting for you: ' + JSON.stringify(waits));
  ok(waits.some(x => /^light is half sent$/.test(x)), 'the slot it does not carry is still there');
  ok(!waits.some(x => /Reddit draft/.test(x)), 'and the Reddit drafts, which the steward also carries, are said once');
  ok(waits.some(x => /new message/.test(x)) && waits.some(x => /waiting to be read/.test(x)), 'everything the steward is silent about stays');
  /* the paragraph the house templates for itself opens with the first act's
     own title, so the count is taken over the lists rather than over the whole
     surface: what must not happen twice is the finding being LISTED twice */
  const listed = await pg.evaluate(() =>
    [...document.querySelectorAll('#s-today .stw .fnd .f b, #s-today .row[data-go] b')].map(b => b.textContent).join('\n'));
  ok((listed.match(/1 of today's posts have no record/g) || []).length === 1, 'the finding itself is listed exactly once');
  posted.length = 0;
  await pg.click('#s-today [data-sact="0"]');
  await pg.waitForTimeout(700);
  const sent = posted.filter(x => !x.method && /^\/api\/social/.test(x.url));
  ok(sent.length === 1 && sent[0].url === '/api/social?date=2026-09-07'
     && JSON.stringify(sent[0].body) === JSON.stringify({ action: 'send-slot', slot: 'reelA' }),
     'a route the server wrote with a query on it is posted to exactly as given: ' + JSON.stringify(sent));
  ok(await pg.evaluate(() => /done|Sent/.test(document.getElementById('toast').textContent)), 'and the owner is told in one sentence');
  ok(await noSideScroll(pg), 'nothing scrolls sideways');
  ok(errors.length === 0, 'no script threw: ' + (errors[0] || 'clean'));
  await pg.screenshot({ path: 'tests/shots/console2-' + w + '-steward-dedupe.png', fullPage: true });
  await pg.close();
}

/* ---------------------------------------------------------------------------
   THE MAP UNDER PREFERS-REDUCED-MOTION: NOTHING MOVES AT ALL
--------------------------------------------------------------------------- */
for (const [label, w, h] of [['phone 390', 390, 844], ['desk 1280', 1280, 900]]) {
  console.log('\n' + label + ' · the flow with motion turned off');
  const posted = [], errors = [];
  const pg = await br.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  pg.on('pageerror', e => errors.push(String(e)));
  pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const J = b => ({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  await pg.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/house') && u.includes('action=flow')) return r.fulfill(J(FLOW(14)));
    if (u.includes('/api/house')) return r.fulfill(J(STEWARD()));
    if (u.includes('/api/social') && u.includes('action=today')) return r.fulfill(J(TODAY));
    if (u.includes('/api/visitors')) return r.fulfill(J(VIS));
    if (u.includes('/api/inbox')) return r.fulfill(J(INBOX));
    if (u.includes('/api/admin-data')) return r.fulfill(J(HOUSE));
    if (u.includes('/api/')) return r.fulfill(J({ ok: true }));
    if (u.startsWith(BASE)) return r.continue();
    if (u.includes('fonts.g')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.abort();
  });
  await pg.goto(BASE + '/admin2.html#flow', { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#s-flow.on svg.flow', { timeout: 15000 });
  await pg.waitForTimeout(500);
  ok(await pg.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'the browser says it wants no motion');
  ok(await pg.evaluate(() => document.querySelectorAll('#s-flow animateMotion, #s-flow animate').length) === 0,
     'so the map is drawn with no animation element in it at all');
  await pg.click('#flow-trace');
  await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => document.querySelectorAll('#s-flow animateMotion').length) === 0 &&
     await pg.evaluate(() => document.getElementById('flow-pulses').children.length) === 0,
     'and Trace makes not one dot: the map stays exactly as it was');
  ok(await pg.evaluate(() => document.querySelectorAll('#s-flow svg.flow [data-stage]').length) === 10,
     'the map itself is whole, motion or none');
  ok(await noSideScroll(pg), 'nothing scrolls sideways');
  ok(errors.length === 0, 'no script threw: ' + (errors[0] || 'clean'));
  await pg.screenshot({ path: 'tests/shots/console2-' + w + '-flow-still.png', fullPage: true });
  await pg.close();
}

console.log('\nwhen the house has no store to read itself from');
{
  const posted = [], errors = [];
  const NOSTORE = () => ({ ok: false, enabled: false, store: 'none', action: 'steward',
    error: 'no store is configured, so there is nothing to read the house from' });
  const pg = await open_(390, 844, posted, errors, { steward: NOSTORE, flow: NOSTORE });
  const t = await pg.evaluate(() => document.getElementById('s-today').innerText);
  ok(/no store is configured/.test(t), 'the steward says in one plain sentence why it has nothing to say');
  ok(!(await pg.evaluate(() => !!document.querySelector('#s-today .stw .f'))), 'and invents no finding to fill the space');
  ok(/reelA is owed/.test(t) && /light is half sent/.test(t), 'with the steward silent, Waiting for you drops nothing');
  await pg.click('nav.bar [data-s="flow"]');
  await pg.waitForSelector('#s-flow.on .card', { timeout: 15000 });
  await pg.waitForTimeout(300);
  const f = await pg.evaluate(() => document.getElementById('s-flow').innerText);
  ok(/The flow could not be read/.test(f) && /no store is configured/.test(f), 'and the map says the same, rather than drawing an empty funnel');
  ok(await pg.evaluate(() => !document.querySelector('#s-flow svg.flow')), 'nothing is drawn at all');
  ok(await pg.evaluate(() => !!document.getElementById('flow-seg')), 'but the days control stays, so it can be asked again');
  ok(await noSideScroll(pg), 'nothing scrolls sideways');
  ok(errors.length === 0, 'no script threw: ' + (errors[0] || 'clean'));
  await pg.close();
}

/* ---------------------------------------------------------------------------
   AN ACTION THE CONSOLE DOES NOT RECOGNISE DRAWS NO BUTTON

   A finding is JSON arriving over a route: the room posted to whatever route it
   named and rendered whatever href it carried, and one wrong answer was a
   javascript: URL under the owner's thumb or a POST at a door in somebody
   else's house. Both shapes are checked now before either is drawn.
--------------------------------------------------------------------------- */
console.log('\nan action the console cannot make sense of');
{
  const posted = [], errors = [];
  const BAD = () => ({
    ok: true, enabled: true, store: 'redis', cached: false, at: readAt(), date: '2026-09-07',
    say: 'Two of the actions in this answer are not shapes this room knows.',
    lantern: false, refused: '', counts: { act: 2, watch: 1, good: 0 },
    findings: [
      { id: 'bad-href', level: 'act', title: 'A door that is not an address',
        say: 'The action on this finding carries a script where an address should be.',
        action: { label: 'Open it', kind: 'open', href: 'javascript:alert(1)' },
        evidence: { shape: 'href' } },
      { id: 'bad-route', level: 'act', title: 'A route in another house',
        say: 'The action on this finding posts to a host that is not this one.',
        action: { label: 'Send it away', kind: 'post', route: 'https://evil.example.com/api/social', body: { action: 'mode', mode: 'auto' } },
        evidence: { shape: 'route' } },
      { id: 'mode', level: 'watch', title: 'The schedule is off',
        say: 'Nothing goes out on a schedule: the ladder is on "off", which is the shipped state.',
        action: { label: 'Move it up to approve', kind: 'post', route: '/api/social', body: { action: 'mode', mode: 'approve' } },
        evidence: { mode: 'off' } }
    ]
  });
  const pg = await open_(390, 844, posted, errors, { steward: BAD });
  const seen = await pg.evaluate(() => ({
    hrefs: [...document.querySelectorAll('#s-today .stw a')].map(a => a.getAttribute('href')),
    opens: document.querySelectorAll('#s-today .stw [data-sopen]').length,
    posts: [...document.querySelectorAll('#s-today .stw [data-sact]')].map(b => b.textContent),
    rows: document.querySelectorAll('#s-today .stw .fnd > .f').length,
    text: document.getElementById('s-today').innerText
  }));
  ok(seen.hrefs.every(h => !/^javascript:/i.test(h)), 'a javascript: href never reaches the page: ' + JSON.stringify(seen.hrefs));
  ok(seen.opens === 0, 'and no link is drawn for it at all');
  ok(seen.posts.join('|') === 'Move it up to approve',
     'a route pointing at another house draws no button, and the one action this room knows still does: ' + JSON.stringify(seen.posts));
  ok(seen.rows === 3, 'all three findings are still shown: a refused action hides the action, never the finding');
  ok((seen.text.match(/an action the console did not recognise/g) || []).length === 2,
     'and each one says where its button would have been, rather than going quiet');
  posted.length = 0;
  await pg.click('#s-today [data-sact="2"]');
  await pg.waitForTimeout(700);
  ok(posted.some(x => x.url === '/api/social' && x.body && x.body.action === 'mode'), 'the one good action still works');
  ok(!posted.some(x => /evil\.example\.com/.test(x.url)), 'and nothing was posted to the other house: ' + JSON.stringify(posted.map(x => x.url)));
  ok(await noSideScroll(pg), 'nothing scrolls sideways');
  ok(errors.length === 0, 'no script threw: ' + (errors[0] || 'clean'));
  await pg.close();
}

/* ---------------------------------------------------------------------------
   ONE ESCAPING, NOT TWO

   The health rows escape their own title and their own sentence, and the
   callers were escaping first, so a store called "Upstash & Vercel KV" was
   written on the screen as "Upstash &amp; Vercel KV". Escaping belongs in
   exactly one place, and the row is it.
--------------------------------------------------------------------------- */
console.log('\nan ampersand in a value is written once, not twice');
{
  const posted = [], errors = [];
  const AMP = () => Object.assign({}, HOUSE, { stripeConfigured: true,
    storeKind: 'Upstash & Vercel KV', moneyMode: 'gifts & guardians' });
  const pg = await open_(390, 844, posted, errors, { house: AMP });
  await pg.click('nav.bar [data-s="house"]');
  await pg.waitForSelector('#s-house .list .row', { timeout: 15000 });
  await pg.waitForTimeout(400);
  const h = await pg.evaluate(() => document.getElementById('s-house').innerText);
  ok(/On · Upstash & Vercel KV/.test(h), 'the House health row shows the ampersand itself');
  ok(!/&amp;/.test(h), 'and never the escape of it: ' + JSON.stringify((h.match(/.{0,26}&amp;.{0,14}/) || [''])[0]));
  ok(/Configured · gifts & guardians mode/.test(h), 'the same for the mode the money is in');
  await pg.evaluate(() => window.NOOR_CONSOLE.show('system', true));
  await pg.waitForSelector('#s-system .list .row', { timeout: 15000 });
  await pg.waitForTimeout(400);
  const sy = await pg.evaluate(() => document.getElementById('s-system').innerText);
  ok(/On · Upstash & Vercel KV/.test(sy) && /Configured · gifts & guardians mode/.test(sy),
     'and the System room, which keeps a health list of its own, reads the same');
  ok(!/&amp;/.test(sy), 'with nothing escaped twice there either');
  ok(errors.length === 0, 'no script threw: ' + (errors[0] || 'clean'));
  await pg.close();
}

console.log('\nthe locked gate');
{
  const posted = [], errors = [];
  const pg = await br.newPage({ viewport: { width: 390, height: 844 } });
  pg.on('pageerror', e => errors.push(String(e)));
  await pg.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/admin-auth')) { posted.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 401, contentType: 'application/json', body: '{"ok":false}' }); }
    if (u.includes('/api/')) return r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"locked"}' });
    if (u.startsWith(BASE)) return r.continue();
    if (u.includes('fonts.g')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.abort();
  });
  await pg.goto(BASE + '/admin2.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(600);
  ok(await pg.evaluate(() => !document.getElementById('gate').hidden && getComputedStyle(document.getElementById('app')).display === 'none'), 'a locked house shows the gate, not the rooms');
  await pg.fill('#pw', 'wrong');
  await pg.click('#enter');
  await pg.waitForTimeout(400);
  ok(posted.length === 1 && posted[0].password === 'wrong', 'the key goes to /api/admin-auth as a POST');
  ok(await pg.evaluate(() => /not the key/.test(document.getElementById('err').textContent)), 'a wrong key is said plainly');
  ok(await pg.evaluate(() => !document.getElementById('enter').disabled), 'and the button is usable again');
  ok(errors.length === 0, 'no script threw');
  await pg.close();
}


console.log('\nthe day after a card went through the old path');
{
  const posted = [], errors = [];
  const pg = await open_(390, 844, posted, errors, { legacy: true });
  const t = await pg.evaluate(() => document.getElementById('s-today').innerText);
  ok(!/light is owed/.test(t), 'a card sent through the old day path is not called owed');
  await pg.click('nav.bar [data-s="posts"]');
  await pg.waitForSelector('#s-posts .slot', { timeout: 15000 });
  const send = await pg.evaluate(() => [...document.querySelectorAll('[data-send]')].map(b => b.getAttribute('data-send')));
  ok(!send.includes('light'), 'and Post now is not offered for it, so it cannot go out twice');
  ok(errors.length === 0, 'no script threw');
  await pg.close();
}

console.log('\nwhen the Instagram token cannot read insights');
{
  const posted = [], errors = [];
  const pg = await open_(390, 844, posted, errors);
  await pg.click('nav.bar [data-s="readers"]');
  await pg.waitForSelector('#ins-read', { timeout: 15000 });
  await pg.route('**/api/insights', r => r.request().method() === 'POST'
    ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, fetched: 0, partial: false, needs: 'instagram_manage_insights', say: 'The Instagram token can post but cannot read what a post did: it was made without instagram_manage_insights. Generate a new token with that permission added and paste it into Vercel as IG_TOKEN, then redeploy and press Read again.' }) })
    : r.continue());
  await pg.click('#ins-read');
  await pg.waitForTimeout(900);
  const t = await pg.evaluate(() => document.getElementById('s-readers').innerText);
  ok(/needs a permission/.test(t) && /instagram_manage_insights/.test(t) && /IG_TOKEN/.test(t), 'the missing permission is named where the numbers would be, with what to paste and where');
  ok(await pg.evaluate(() => !document.getElementById('ins-read').disabled), 'and Read again is offered for after the token is replaced');
  ok(errors.length === 0, 'no script threw');
  await pg.close();
}

console.log('\nwhen the key expires under an open console');
{
  const posted = [], errors = [];
  const pg = await open_(390, 844, posted, errors);
  await pg.evaluate(() => { window.__LOCK = true; });
  await pg.route('**/api/social?action=today', r => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"locked"}' }));
  await pg.click('#refresh');
  await pg.waitForTimeout(700);
  ok(await pg.evaluate(() => !document.getElementById('gate').hidden && getComputedStyle(document.getElementById('app')).display === 'none'), 'a 401 brings the gate back instead of printing guesses as facts');
  ok(await pg.evaluate(() => /expired/.test(document.getElementById('err').textContent)), 'and says why');
  const left = errors.filter(e => !/^401 /.test(e) && !/status of 401/.test(e)); if (left.length) console.log('   errors:', left);
  ok(left.length === 0, 'no script threw');
  await pg.close();
}

console.log('\nwhen the network is gone mid-action');
{
  const posted = [], errors = [];
  const pg = await open_(390, 844, posted, errors);
  await pg.click('nav.bar [data-s="posts"]');
  await pg.waitForSelector('[data-send="reelA"]', { timeout: 15000 });
  await pg.route('**/api/social', r => r.abort('connectionfailed'));
  await pg.click('[data-send="reelA"]');
  await pg.waitForTimeout(700);
  const st = await pg.evaluate(() => { const b = document.querySelector('[data-send="reelA"]'); return { disabled: b.disabled, text: b.textContent, toast: document.getElementById('toast').textContent }; });
  ok(!st.disabled && st.text === 'Post now', 'the button comes back instead of staying on Sending… forever');
  ok(/Could not reach the house/.test(st.toast), 'and the owner is told');
  ok(!errors.some(e => /Error|rejection/i.test(e) && !/ERR_CONNECTION/.test(e)), 'no unhandled rejection: ' + (errors.find(e => /Error/.test(e)) || 'clean'));
  await pg.close();
}

console.log('\nwhile a send is in flight');
{
  const posted = [], errors = [];
  const pg = await open_(390, 844, posted, errors);
  await pg.click('nav.bar [data-s="posts"]');
  await pg.waitForSelector('[data-send="reelA"]', { timeout: 15000 });
  let release, sends = 0; const gate = new Promise(res => { release = res; });
  await pg.route('**/api/social', async r => { if (r.request().method() === 'POST') { if (/send-slot/.test(r.request().postData() || '')) sends++; await gate; return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"state":"sent"}' }); } return r.continue(); });
  await pg.click('[data-send="reelA"]');
  await pg.waitForTimeout(300);
  await pg.evaluate(() => window.NOOR_CONSOLE.show('posts', true));
  await pg.waitForTimeout(500);
  const mid = await pg.evaluate(() => ({ send: [...document.querySelectorAll('[data-send]')].map(b => b.getAttribute('data-send')), sending: [...document.querySelectorAll('#slot-reelA button')].some(b => b.disabled && /Sending/.test(b.textContent)) }));
  ok(!mid.send.includes('reelA') && mid.sending, 'a redraw during the send shows Sending… and offers no second Post now');
  ok(sends === 1, 'exactly one send-slot has been asked for');
  release();
  await pg.waitForTimeout(600);
  ok(errors.length === 0, 'no script threw');
  await pg.close();
}

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
