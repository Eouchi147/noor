/* NOOR · round four on the console: what the Lantern's brains cost and
   bought, and its Telegram voice.
   ------------------------------------------------------------------
   The owner, 7 October: the best free models, Jev and anything as cheap
   and good, paid models only when they earn it, and Telegram for what is
   urgent. Against stubs of exactly the server's round four shapes
   (api/_home.js spend.roi and voice, api/lantern-models.js ranking, words,
   gateway, jev and paid, api/_mail.js judged), this proves:

   HOME
     the engine room's door says this month's paid use in one calm phrase
       ("Paid thinking this month: 1.20 dollars, 3 uses, 2 helped"), one use
       and none helped in their own words, and nothing of it when nothing
       was paid for (the month's spend as before);
     the Telegram card: not linked, it says why in the house's words and
       its Link it opens the engine room at the Voice card; linked, one
       quiet line ("Telegram: 2 urgent today · tonight's summary at 22:00
       UTC (4 waiting)"), the evening's summary once it went out, an urgent
       message that did not get through, a quiet day, an older server with
       no evening yet, no card at all when the part is absent, and a calm
       line when it could not be read;
   THE ENGINE ROOM
     a Brains card: the server's own words as its lead; each tier's free
       models in their measured order with a small bar and a plain word
       (excellent, good, fair, poor, too few calls yet, not measured yet)
       and never the number alone; the last fault and when; the fifth and
       later behind "And N more"; the judge's calls today and yesterday and
       what it judged, and in its own words when it is down; the gateway's
       free names, answering or waiting a day; the paid ledger, each use
       with what it was for, its cost, its model and what it led to, the
       newest first, with the day's and the month's spend; and calm
       sentences for a ranking that could not be read, an older server, a
       failed read and no network;
   THE MAIL ROOM
     a thread the judge sorted says "Sorted by the judge (91 percent
       sure)", without a number when it gave none, and nothing when another
       hand sorted it;
   EVERYWHERE
     every word escaped, 44 px targets, no sideways scroll at 390, no
     "soul", no dash, no console error, and with less motion asked for,
     no bar grows; pictures of each in /tmp/qa/brains at 390 and 1440.

   Run:  python3 /tmp/vercelish.py 8263 <the repo root> &   node tests/console-brains.mjs
   (NOOR_BASE overrides the address; CHROMIUM_PATH the browser; BRAINS_SHOTS
   where the screenshots go.)
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8263';
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.BRAINS_SHOTS || '/tmp/qa/brains';
mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const br = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const DASH = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
const SOUL = /\bsoul\b/i;

/* ---------------------------------------------------------------- the day */
const NOW = Date.now(), H = 3600e3, D = 86400e3;
const iso = t => new Date(t).toISOString();
const dayOf = t => new Date(t).toISOString().slice(0, 10);
const hist = (n, a, b) => Array.from({ length: n }, (_, i) => ({ date: dayOf(NOW - (n - 1 - i) * D), value: Math.round(a + (b - a) * i / (n - 1)) }));
const XSS = '<img src=x onerror="window.__xss=1">';
const BOLD = '<b>bold</b>';
const WHY = 'so the Lantern can reach you when something is urgent';

/* ---------------------------------------------------------------- Home, api/_home.js */
const GOALS = () => [
  { id: 'g-reach', owner: 'owner', outcome: 'Double the people reached each week by 25 December', metric: 'northStar', unit: 'people', baseline: 15600, current: 31240, target: 62400, due: '2026-12-25', status: 'behind', projected: 48900, eta: null, note: null, focus: null, history: hist(20, 21000, 31240) }];
const MAIL_ON = () => ({ configured: true, on: true, firstTen: { sent: 10, of: 10 }, today: { received: 14, answered: 6, filed: 5, forYou: 1, sent: 4 },
  outreach: { places: 132, contacted: 24, replied: 3, working: 1, target: 50 }, last: [{ at: iso(NOW - 1 * H), title: 'Filed a newsletter the judge sorted' }] });
const V = {
  not: () => ({ telegram: { linked: false, why: WHY }, digestAt: '22:00 UTC', digestWaiting: 2, today: [] }),
  linked: () => ({ telegram: { linked: true, why: null }, digestAt: '22:00 UTC', digestWaiting: 4,
    today: [{ at: iso(NOW - 3 * H), kind: 'distress', sent: true }, { at: iso(NOW - 1 * H), kind: 'press', sent: true }] }),
  sent: () => ({ telegram: { linked: true, why: null }, digestAt: '22:00 UTC', digestWaiting: 0,
    today: [{ at: iso(NOW - 5 * H), kind: 'money', sent: true }, { at: iso(NOW - 4 * H), kind: 'press', sent: false }, { at: iso(NOW - 1 * H), kind: 'digest', sent: true }] }),
  quiet: () => ({ telegram: { linked: true, why: null }, digestAt: '22:00 UTC', digestWaiting: 0, today: [] }),
  old: () => ({ telegram: { linked: true } }),
  markup: () => ({ telegram: { linked: false, why: WHY + ' ' + XSS + BOLD }, digestAt: '22:00 UTC', digestWaiting: 0, today: [] })
};
const S = {
  none: () => ({ usd: 3.42, capUsd: 10, roi: { calls: 0, usd: 0, helped: 0 } }),
  paid: () => ({ usd: 1.2, capUsd: 10, roi: { calls: 3, usd: 1.2, helped: 2 } }),
  one: () => ({ usd: 0.04, capUsd: 10, roi: { calls: 1, usd: 0.04, helped: 0 } }),
  old: () => ({ usd: 3.42, capUsd: 10 })
};
const HOME = (o = {}) => ({
  ok: true, now: iso(NOW), name: 'the Lantern', paused: false, status: 'working',
  brief: null, decisions: [], done: [], next: [], coming: [], goals: GOALS(), ideas: [],
  today: { posts: { sent: 6, due: 6, failed: 0 }, fixed: 0, reach7: { value: 31240, delta: 1204 }, slots: [] },
  voice: V.linked(), spend: S.paid(), giving: null, missing: { giving: 'not configured' }, mail: MAIL_ON(), ...o });

/* ---------------------------------------------------------------- GET /api/lantern-models, api/_llm.js rankingReport */
const ROW = (provider, model, o = {}) => ({ provider, model, quality: 0.75, calls: 0, answered: 0, failed: 0, checks: 0, passed: 0, msAvg: null, lastError: null, lastErrorAt: null, ...o });
const LINES = () => [
  { id: 'paid-3', at: iso(NOW - 2 * H), task: 'letter-retry', model: 'anthropic/claude-sonnet-4.5', costUsd: 0.06, outcome: null },
  { id: 'paid-1', at: iso(NOW - 5 * D), task: 'weekly-strategy', model: 'anthropic/claude-opus-4.1', costUsd: 0.09, outcome: { helped: false, note: 'the plan was not used', at: iso(NOW - 4 * D) } },
  { id: 'paid-2', at: iso(NOW - 2 * D), task: 'tie-break', model: 'openai/gpt-5', costUsd: 0.004, outcome: { helped: true, note: 'the council could decide ' + BOLD, at: iso(NOW - 2 * D) } }];
const MODELS = () => ({
  ok: true, providers: { groq: 'set', gemini: 'set', openrouter: 'set', cerebras: 'set', gateway: 'set' },
  ranking: {
    fast: [
      ROW('groq', 'llama-3.1-8b-instant', { quality: 0.934, calls: 50, answered: 49, failed: 1, checks: 12, passed: 12, msAvg: 410 }),
      ROW('gemini', 'gemini-2.0-flash', { quality: 0.78, calls: 40, answered: 37, failed: 3, checks: 4, passed: 4, msAvg: 1260 }),
      ROW('openrouter', 'meta-llama/llama-3.3-70b-instruct:free', { quality: 0.6, calls: 30, answered: 22, failed: 8, msAvg: 2900 }),
      ROW('cerebras', 'qwen-3-32b', { quality: 0.31, calls: 20, answered: 7, failed: 13, msAvg: 80, lastError: '429 rate limited', lastErrorAt: iso(NOW - 2 * H) }),
      ROW('gateway', 'openai/gpt-oss-20b', { calls: 0 })],
    strong: [
      ROW('groq', 'openai/gpt-oss-120b', { quality: 0.88, calls: 30, answered: 30, checks: 9, passed: 9, msAvg: 1700 }),
      ROW('openrouter', 'deepseek/deepseek-chat-v3:free', { quality: 0.52, calls: 12, answered: 8, failed: 4, msAvg: 5400, lastError: 'upstream said ' + XSS + BOLD, lastErrorAt: iso(NOW - 26 * H) })],
    long: [],
    mail: [ROW('groq', 'openai/gpt-oss-120b', { quality: 0.75, calls: 3, answered: 3, msAvg: 900 })]
  },
  words: [
    'Quick work: first Groq\'s llama-3.1-8b-instant (answered 49 of 50, passed 12 of 12 checks, 0.4 seconds), then Gemini\'s gemini-2.0-flash (answered 37 of 40, passed 4 of 4 checks, 1.3 seconds), then OpenRouter\'s llama-3.3-70b-instruct:free (answered 22 of 30, 2.9 seconds), and 2 more after them.',
    'Writing and judging: first Groq\'s gpt-oss-120b (answered 30 of 30, passed 9 of 9 checks, 1.7 seconds), then OpenRouter\'s deepseek-chat-v3:free (answered 8 of 12, 5.4 seconds).',
    'Long reading: no free model is configured or live today.',
    'Mail: first Groq\'s gpt-oss-120b (answered 3 of 3, 0.9 seconds). A model said ' + BOLD + '.'],
  gateway: { free: ['openai/gpt-oss-120b', 'meta/llama-4-scout', 'google/gemma-3-27b'], waiting: ['meta/llama-4-scout'] },
  jev: { today: { day: dayOf(NOW), calls: 214, ok: 212, failed: 2, msAvg: 96, costUsd: 0.0041, by: { 'mail-kind': 120, letter: 40, light: 30, text: 24 } },
    yesterday: { day: dayOf(NOW - D), calls: 380, ok: 380, failed: 0, msAvg: 88, costUsd: 0.007, by: {} } },
  paid: { roi: { month: '2026-10', calls: 3, usd: 0.15, helped: 1, waiting: 1, uses: { 'letter-retry': 1, 'tie-break': 1, 'weekly-strategy': 1 }, line: 'Paid models this month: 0.15 dollars, 3 uses.' },
    lines: LINES(), spend: { month: '2026-10', usd: 0.15, capUsd: 10, calls: 3, noCredit: '', dayUsd: 0.06, dayCapUsd: 0.5, callMaxUsd: 0.1 } }
});
const M = {
  full: MODELS,
  down: () => ({ ...MODELS(), jev: { today: { day: dayOf(NOW), calls: 6, ok: 0, failed: 6, msAvg: null, costUsd: 0, by: { 'mail-kind': 6 } }, yesterday: { day: dayOf(NOW - D), calls: 0, ok: 0, failed: 0, msAvg: null, costUsd: 0, by: {} } },
    paid: { roi: { month: '2026-10', calls: 0, usd: 0, helped: 0, waiting: 0, uses: {}, line: null }, lines: [], spend: { month: '2026-10', usd: 0, capUsd: 10, calls: 0, dayUsd: 0, dayCapUsd: 0.5, callMaxUsd: 0.1 } } }),
  nul: () => ({ ok: true, providers: { groq: 'set' }, ranking: null, words: [], gateway: null, jev: { today: null, yesterday: null },
    paid: { roi: null, lines: [], spend: { month: '2026-10', usd: null, capUsd: 10, calls: null, error: 'the spend ledger could not be read' } } }),
  old: () => ({ ok: true, providers: { groq: 'set', gemini: 'set' }, tiers: { fast: [] }, good: {}, usage: {} }),
  failed: () => ({ ok: false, error: 'the store did not answer ' + BOLD }),
  /* round six: the judge closed for the hour (jev.today.closed, its reason in
     plain words, and skipped, what went on without it), and a gateway whose
     free names all lack a provider that keeps nothing (gateway.without) */
  closed: () => ({ ...MODELS(), jev: { today: { day: dayOf(NOW), calls: 40, ok: 40, failed: 0, msAvg: 90, costUsd: 0.0008, by: { 'mail-kind': 40 }, closed: 'its free hour of questions is spent ' + BOLD + '.', skipped: 12 },
    yesterday: { day: dayOf(NOW - D), calls: 380, ok: 380, failed: 0, msAvg: 88, costUsd: 0.007, by: {} } },
    gateway: { free: [], waiting: [], without: 7 } }),
  closedOne: () => ({ ...MODELS(), jev: { today: { day: dayOf(NOW), calls: 0, ok: 0, failed: 0, msAvg: null, costUsd: 0, by: {}, closed: 'the judge said to come back later', skipped: 1 },
    yesterday: { day: dayOf(NOW - D), calls: 0, ok: 0, failed: 0, msAvg: null, costUsd: 0, by: {} } },
    gateway: { free: [], waiting: [], without: 1 } }),
  open: () => ({ ...MODELS(), jev: { today: { ...MODELS().jev.today, closed: '', skipped: 0 }, yesterday: MODELS().jev.yesterday }, gateway: { free: [], waiting: [], without: 0 } })
};

/* ---------------------------------------------------------------- GET /api/soul?view=mail, api/_mail.js (judged) */
const THREADS = () => [
  { id: 't1', at: iso(NOW - 1 * H), from: 'news@platform.example', fromName: 'A platform', subject: 'Your weekly digest', kind: 'newsletter', action: 'filed',
    summary: 'Read by the judge as a newsletter (91 percent sure); no writing model read it.', reply: null, judged: { by: 'jev', p: 0.91 } },
  { id: 't2', at: iso(NOW - 2 * H), from: 'aisha.reader@example.org', fromName: 'Aisha', subject: 'A question about the night prayer', kind: 'question', action: 'answered',
    summary: 'She asked how the night prayer is prayed; the Lantern answered from the library\'s page.', reply: { at: iso(NOW - 90 * 60e3), text: 'Wa alaykum assalam Aisha,\n\nThe library\'s page on the night prayer gathers what the scholars say.\n\nWith salaam,\nNOOR Codex of Light' }, judged: null },
  { id: 't3', at: iso(NOW - 3 * H), from: 'notice@service.example', fromName: 'A service', subject: 'Your plan renews', kind: 'notice', action: 'filed', summary: 'A notice, filed.', reply: null, judged: { by: 'jev' } },
  { id: 't4', at: iso(NOW - 4 * H), from: 'imam@masjid.example', fromName: 'The imam of a masjid', subject: 'Re: Free tools', kind: 'outreach-answer', action: 'waiting', summary: 'He asks which printables suit ages 7 to 10.', reply: null, judged: { by: 'model', p: 0.99 } },
  { id: 't5', at: iso(NOW - 5 * H), from: 'list@letters.example', fromName: 'A list', subject: 'Monthly letters', kind: 'newsletter', action: 'filed', summary: 'A newsletter, filed.', reply: null, judged: { by: 'JEV', p: 87 } }];
const MAILV = () => ({ ok: true,
  mail: { configured: true, on: true, reason: null, caps: { outreach: 10, replies: 30, followups: 10, total: 50 }, firstTen: { sent: 10, of: 10 }, today: { received: 14, answered: 6, filed: 5, forYou: 1, sent: 4 } },
  threads: THREADS(), places: [], counts: { places: 0, contacted: 0, replied: 0, working: 0, declined: 0, dnc: 0 }, dnc: [], missing: {} });

/* ---------------------------------------------------------------- the rest of the house */
const HOUSE = { store: true, storeKind: 'redis', lanternConfigured: true, lanternModel: 'x/inkling:free', moneyMode: 'quiet', weekly: 3, activeCount: 2, guardians: [], gifts: { total30d: 90, count30d: 3, monthly: 60, recent: [] } };
const SOUL_TODAY = { ok: true, paused: false, mission: 'Serve Allah.', northStar: { value: 31240, weekAgo: 30036, series: [] }, goals: [], lastCycle: null,
  spend: { month: '2026-10', usd: 1.2, capUsd: 10 }, counts: { actionsToday: 2, capToday: 6 }, telegram: { linked: true, since: iso(NOW - 9 * D) } };

/* ---------------------------------------------------------------- the page */
async function open_(w, h, opts = {}) {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, reducedMotion: opts.motion ? 'no-preference' : 'reduce' });
  const pg = await ctx.newPage();
  const st = { home: (opts.home || HOME)(), models: opts.models || M.full, modelsMode: opts.modelsMode || 'ok', modelGets: 0, posted: [], errors: [] };
  pg.on('pageerror', e => st.errors.push(String(e)));
  pg.on('console', m => { if (m.type() === 'error') st.errors.push(m.text()); });
  pg.on('response', r => { if (r.status() >= 400) st.errors.push(r.status() + ' ' + r.url()); });
  const J = (b, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(b) });
  await ctx.route('**/*', async r => {
    const q = r.request(), u = q.url(), m = q.method();
    if (u.includes('/api/lantern-models')) {
      st.modelGets++;
      if (st.modelsMode === 'net') return r.abort('connectionfailed');
      return r.fulfill(J(st.models()));
    }
    if (u.includes('/api/soul')) {
      if (m === 'POST') { st.posted.push(JSON.parse(q.postData() || '{}')); return r.fulfill(J({ ok: true, message: 'Done.' })); }
      const view = new URL(u).searchParams.get('view');
      if (view === 'home') return r.fulfill(J({ ...st.home, now: iso(Date.now()) }));
      if (view === 'mail') return r.fulfill(J(MAILV()));
      if (view === 'today') { const tg = st.home.voice && st.home.voice.telegram; return r.fulfill(J({ ...SOUL_TODAY, telegram: { linked: !!(tg && tg.linked), since: tg && tg.linked ? iso(NOW - 9 * D) : null } })); }
      return r.fulfill(J({ ok: true, items: [] }));
    }
    if (u.includes('/api/social')) return r.fulfill(J(u.includes('action=dials') ? { ok: true, dials: { mode: 'auto' }, channels: [] } : { ok: true }));
    if (u.includes('/api/admin-data')) return r.fulfill(J(HOUSE));
    if (u.includes('/api/journal')) return r.fulfill(J(m === 'POST' ? { queue: [] } : { ok: true, entries: [] }));
    if (u.includes('/api/inbox')) return r.fulfill(J({ ok: true, counts: { new: 0 }, items: [] }));
    if (u.includes('/api/settings')) return r.fulfill(J({ store: true, dials: [] }));
    if (u.includes('/api/')) return r.fulfill(J({ ok: true }));
    if (u.startsWith(BASE)) return r.continue();
    if (u.includes('fonts.g')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.abort();
  });
  await pg.goto(BASE + '/admin2.html' + (opts.hash || ''), { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#app.on', { timeout: 15000 });
  if (!opts.hash) await pg.waitForSelector('#s-home.on #h-decide .hsec, #s-home.on #h-decide .hfail', { timeout: 15000 });
  else if (opts.hash === '#engine') await pg.waitForSelector('#s-engine.on #soul-head', { timeout: 15000 });
  await pg.waitForTimeout(opts.settle != null ? opts.settle : 300);
  return { pg, st, ctx };
}
const text = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const has = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); return !!e && !!e.getClientRects().length; }, sel);
const noSideScroll = pg => pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const allWords = (pg, scope) => pg.evaluate(s => { const r = document.querySelector(s); if (!r) return ''; return [r.innerText, ...[...r.querySelectorAll('[title], [aria-label], [placeholder]')].map(e => [e.getAttribute('title'), e.getAttribute('aria-label'), e.getAttribute('placeholder')].filter(Boolean).join(' '))].join('\n'); }, scope);
const shortTaps = (pg, scope) => pg.evaluate(s => [...document.querySelectorAll(s + ' button, ' + s + ' a, ' + s + ' select, ' + s + ' input, ' + s + ' summary, ' + s + ' [role="switch"]')]
  .filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden')
  .filter(b => b.getBoundingClientRect().height < 43.5).map(b => (b.textContent || b.getAttribute('aria-label') || b.tagName).trim().slice(0, 30) + ':' + Math.round(b.getBoundingClientRect().height)), scope);
async function brains(pg) { await pg.waitForSelector('#soul-brains #brains-card', { timeout: 10000 }); await pg.waitForTimeout(120); }
async function openEngine(pg) {
  await pg.click('#h-engine [data-engine]');
  await pg.waitForSelector('#s-engine.on #soul-head', { timeout: 15000 });
  await brains(pg);
}
/* the screen with one part near its top, under the bar (or as near as the
   end of the page allows) */
async function shotOf(pg, sel, name) {
  await pg.evaluate(s => { const e = document.querySelector(s); if (!e) return; const y = e.getBoundingClientRect().top + scrollY - 70;
    window.scrollTo(0, Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight))); }, sel);
  await pg.waitForTimeout(250);
  await pg.screenshot({ path: SHOTS + '/' + name + '.png' });
}
/* one part, whole: the bars fixed to the screen are hidden while it is taken,
   so a tall card is not crossed by them */
async function shotEl(pg, sel, name) {
  await pg.locator(sel).first().scrollIntoViewIfNeeded();
  await pg.evaluate(() => { const s = document.createElement('style'); s.id = '__shot'; s.textContent = 'header.top,nav.bar{visibility:hidden!important}'; document.head.appendChild(s); });
  await pg.waitForTimeout(200);
  const b = await pg.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, W: document.documentElement.clientWidth }; }, sel);
  const pad = 10, x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad);
  await pg.screenshot({ path: SHOTS + '/' + name + '.png', fullPage: true, clip: { x, y, width: Math.min(b.W - x, b.w + 2 * pad), height: b.h + 2 * pad } });
  await pg.evaluate(() => { const s = document.getElementById('__shot'); if (s) s.remove(); });
}
const clean = async (pg, st, scope, what) => {
  const words = await allWords(pg, scope);
  ok(!SOUL.test(words), what + ': "soul" is never visible');
  ok(!DASH.test(words), what + ': no dash in what it says');
  ok(await pg.evaluate(() => window.__xss === undefined), what + ': no markup ran');
  ok(await noSideScroll(pg), what + ': no sideways scroll at ' + await pg.evaluate(() => innerWidth));
  const t = await shortTaps(pg, scope);
  ok(!t.length, what + ': every target is 44 px or more' + (t.length ? ' (' + t.join(', ') + ')' : ''));
};

/* =================================================================== HOME */
console.log('=== Home: the engine room\'s door says what paid thinking cost ===');
for (const [name, sp, want] of [
  ['some paid use', S.paid, 'Paid thinking this month: 1.20 dollars, 3 uses, 2 helped · Telegram linked'],
  ['one paid use, none helped yet', S.one, 'Paid thinking this month: 0.04 dollars, 1 use, none has helped yet · Telegram linked'],
  ['no paid use', S.none, '$3.42 of $10.00 spent this month · Telegram linked'],
  ['an older server, with no ledger', S.old, '$3.42 of $10.00 spent this month · Telegram linked']]) {
  const o = await open_(390, 844, { home: () => HOME({ spend: sp() }) });
  const door = await text(o.pg, '#h-engine .heng .s.live');
  ok(door === want, name + ': "' + door + '"');
  if (name === 'no paid use') ok(!/Paid thinking/.test(await text(o.pg, '#s-home')), 'no paid use: the phrase is not said at all');
  ok(!o.st.errors.length, name + ': no console errors' + (o.st.errors.length ? ' ' + o.st.errors.join(' | ') : ''));
  if (name === 'some paid use') {
    await clean(o.pg, o.st, '#h-engine', 'the door');
    await shotOf(o.pg, '#h-engine', 'home-390-door-paid');
  }
  if (name === 'no paid use') await shotOf(o.pg, '#h-engine', 'home-390-door-no-paid');
  await o.ctx.close();
}

console.log('=== Home: the Telegram card ===');
{
  const o = await open_(390, 844, { home: () => HOME({ voice: V.not() }) });
  const pg = o.pg;
  ok(await has(pg, '#h-voice #h-tg') && !(await pg.evaluate(() => document.getElementById('h-voice').hidden)), 'not linked: the card is there');
  ok(await text(pg, '#h-tg .x b') === 'Telegram is not linked', 'not linked: it says so');
  ok(await text(pg, '#h-tg-why') === 'So the Lantern can reach you when something is urgent.', 'not linked: it says why, in the house\'s words (voice.telegram.why)');
  ok(await text(pg, '#h-tg [data-tglink]') === 'Link it', 'and offers Link it');
  const order = await pg.evaluate(() => [...document.querySelectorAll('#hz-a > *')].map(e => e.id).filter(Boolean).join(','));
  ok(/h-mail,h-voice,h-giving/.test(order), 'on a phone it sits after the mail, before giving (' + order + ')');
  await clean(pg, o.st, '#h-voice', 'Telegram, not linked');
  await shotOf(pg, '#h-voice', 'home-390-telegram-not-linked');
  await pg.click('#h-tg [data-tglink]');
  await pg.waitForSelector('#s-engine.on #soul-voice', { timeout: 15000 });
  await pg.waitForTimeout(900);
  ok(await pg.evaluate(() => location.hash) === '#engine', 'Link it opens the engine room');
  const vr = await pg.evaluate(() => { const r = document.getElementById('soul-voice').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }; });
  ok(vr.top >= 0 && vr.bottom <= vr.vh, 'at the Voice card, where the link is made, whole on the screen (' + vr.top + ' to ' + vr.bottom + ' of ' + vr.vh + ')');
  ok(/Link it once, so the Lantern can reach you when something is urgent, with one summary each evening at 22:00 UTC\./.test(await text(pg, '#soul-voice')), 'and the Voice card says what the link is for, round four\'s way (urgent at once, the rest at 22:00 UTC)');
  ok(!o.st.errors.length, 'no console errors' + (o.st.errors.length ? ' ' + o.st.errors.join(' | ') : ''));
  await o.ctx.close();
}
for (const [name, v, want, extra] of [
  ['linked, two urgent today', V.linked, 'Telegram: 2 urgent today · tonight\'s summary at 22:00 UTC (4 waiting)', ''],
  ['linked, the summary went out and one did not get through', V.sent, 'Telegram: 1 urgent today · tonight\'s summary went out · 1 did not get through', 'missed'],
  ['linked, a quiet day', V.quiet, 'Telegram: nothing urgent today · tonight\'s summary at 22:00 UTC (nothing waiting yet)', ''],
  ['linked, an older server with no evening yet', V.old, 'Telegram is linked: the Lantern writes there when something is urgent', '']]) {
  const o = await open_(390, 844, { home: () => HOME({ voice: v() }) });
  const pg = o.pg;
  const line = await text(pg, '#h-tg-line');
  ok(line === want, name + ': "' + line + '"');
  if (extra === 'missed') ok(await pg.evaluate(() => { const e = document.querySelector('#h-tg-line em'); return !!e && /did not get through/.test(e.textContent) && getComputedStyle(e).color !== getComputedStyle(e.parentElement).color; }), name + ': what did not get through is marked in its own colour');
  ok(await pg.evaluate(() => document.getElementById('h-tg').tagName === 'BUTTON' && document.getElementById('h-tg').classList.contains('line')), name + ': one quiet line, and it is a button');
  if (name === 'linked, two urgent today') {
    ok(/Opens the Voice card in the engine room/.test(await pg.evaluate(() => document.getElementById('h-tg').textContent)), 'a screen reader hears where the line goes');
    await clean(pg, o.st, '#h-voice', 'Telegram, linked');
    await shotOf(pg, '#h-voice', 'home-390-telegram-linked');
    await pg.click('#h-tg');
    await pg.waitForSelector('#s-engine.on #soul-voice', { timeout: 15000 });
    await pg.waitForTimeout(700);
    ok(await pg.evaluate(() => location.hash) === '#engine', 'the line opens the engine room at the Voice card');
    ok(/at once when something is urgent, and once each evening, at 22:00 UTC, with everything else/.test(await text(pg, '#soul-voice')), 'where the Voice card says how it writes now');
  }
  ok(!o.st.errors.length, name + ': no console errors' + (o.st.errors.length ? ' ' + o.st.errors.join(' | ') : ''));
  await o.ctx.close();
}
{
  let o = await open_(390, 844, { home: () => { const h = HOME(); delete h.voice; return h; } });
  ok(await o.pg.evaluate(() => document.getElementById('h-voice').hidden && !document.getElementById('h-tg')), 'no voice part from an older server: no card at all');
  await o.ctx.close();
  o = await open_(390, 844, { home: () => HOME({ voice: null, missing: { giving: 'not configured', voice: 'the store did not answer' } }) });
  ok(await text(o.pg, '#h-tg .x b') === 'Telegram: its state could not be read just now' && /The store did not answer/.test(await text(o.pg, '#h-tg .x span')), 'a voice part that could not be read: one calm line, and why');
  ok(!o.st.errors.length, 'no console errors');
  await o.ctx.close();
  o = await open_(390, 844, { home: () => HOME({ voice: V.markup() }) });
  ok((await text(o.pg, '#h-tg-why')).includes('<img src=x onerror="window.__xss=1"><b>bold</b>') && await o.pg.evaluate(() => !document.querySelector('#h-voice img, #h-voice b b') && window.__xss === undefined), 'the why is escaped: markup in it arrives as words');
  await o.ctx.close();
}
/* the desk: three zones, the line in the middle with the mail */
{
  const o = await open_(1440, 900, { home: () => HOME({ voice: V.linked() }) });
  const z = await o.pg.evaluate(() => ({ b: [...document.querySelectorAll('#hz-b > *')].map(e => e.id).join(','), desk: document.getElementById('s-home').classList.contains('desk') }));
  ok(z.desk && /h-mail,h-voice$/.test(z.b), 'on a desk the line sits in the middle zone, under the mail (' + z.b + ')');
  await o.pg.screenshot({ path: SHOTS + '/home-1440-linked.png' });
  await shotOf(o.pg, '#h-voice', 'home-1440-telegram-linked');
  await o.pg.evaluate(() => { const e = document.getElementById('h-engine'); e.scrollIntoView({ block: 'center' }); });
  await o.pg.waitForTimeout(200);
  await o.pg.screenshot({ path: SHOTS + '/home-1440-door.png' });
  ok(await noSideScroll(o.pg), 'no sideways scroll on a desk');
  await o.ctx.close();
  const n = await open_(1440, 900, { home: () => HOME({ voice: V.not(), spend: S.none() }) });
  await shotOf(n.pg, '#h-voice', 'home-1440-telegram-not-linked');
  ok(await text(n.pg, '#h-tg .x b') === 'Telegram is not linked', 'not linked on a desk too');
  await n.ctx.close();
}

/* =================================================================== THE ENGINE ROOM */
console.log('=== the engine room: Brains ===');
{
  const o = await open_(390, 844);
  const pg = o.pg;
  await openEngine(pg);
  const secs = await pg.evaluate(() => [...document.querySelectorAll('#s-engine p.sec')].map(e => e.textContent.trim()));
  ok(secs.indexOf('Brains') > 0 && secs.indexOf('Brains') === secs.indexOf('Budget') - 1, 'a Brains card, just before the Budget (' + secs.join(', ') + ')');
  ok(o.st.modelGets >= 1, 'it reads GET /api/lantern-models');
  const words = await pg.evaluate(() => [...document.querySelectorAll('#brain-words p')].map(p => p.textContent));
  ok(words.length === 4 && /^Quick work: first Groq's llama-3\.1-8b-instant/.test(words[0]) && /^Long reading: no free model/.test(words[2]), 'the server\'s own words lead the card, a sentence each (' + words.length + ')');
  ok(words[3].includes('A model said <b>bold</b>.') && await pg.evaluate(() => !document.querySelector('#brain-words b')), 'and they are escaped');
  const tiers = await pg.evaluate(() => [...document.querySelectorAll('#brains-card .btier')].map(t => t.id + ':' + t.querySelector('b').textContent));
  ok(tiers.join(',') === 'brain-tier-fast:Quick work,brain-tier-strong:Writing and judging,brain-tier-long:Long reading,brain-tier-mail:Mail', 'each tier by its plain name, in the house\'s order (' + tiers.join(', ') + ')');
  const fast = await pg.evaluate(() => [...document.querySelectorAll('#brain-tier-fast > ol.bml > li')].map(li => ({
    no: li.querySelector('.no').textContent, nm: li.querySelector('.nm').textContent, w: li.querySelector('.qw').textContent,
    sx: (li.querySelector('.qb i') || { style: {} }).style.transform || '', lab: li.querySelector('.qb').getAttribute('aria-label'), cls: li.querySelector('.qb').className,
    dt: li.querySelector('.dt').textContent, er: (li.querySelector('.er') || {}).textContent || '' })));
  ok(fast.length === 4 && fast.map(r => r.no).join('') === '1234', 'four models shown, numbered in the order the next call asks them');
  ok(fast.map(r => r.nm).join(' | ') === 'llama-3.1-8b-instant | gemini-2.0-flash | llama-3.3-70b-instruct:free | qwen-3-32b', 'their measured order, by model name (' + fast.map(r => r.nm).join(' | ') + ')');
  ok(fast.map(r => r.w).join(',') === 'excellent,good,fair,poor', 'quality in a plain word: excellent, good, fair, poor');
  const sx = r => parseFloat((/scaleX\(([\d.]+)\)/.exec(r.sx) || [])[1]);
  ok(sx(fast[0]) === 0.934 && sx(fast[1]) === 0.78 && sx(fast[2]) === 0.6 && sx(fast[3]) === 0.31 && /poor/.test(fast[3].cls) && /fair/.test(fast[2].cls), 'and a small bar, as long as the quality, a poor one in its own colour (' + fast.map(sx).join(', ') + ')');
  ok(fast.every(r => /^Quality: /.test(r.lab)) && !fast.some(r => /\d/.test(r.lab)), 'a screen reader hears the word, never the number alone');
  ok(fast[0].dt === 'on Groq · answered 49 of 50 · passed 12 of 12 checks · 0.4 seconds', 'what it showed these two weeks: "' + fast[0].dt + '"');
  ok(fast[3].dt === 'on Cerebras · answered 7 of 20 · under a tenth of a second' && /^The last fault, 2 h ago: 429 rate limited$/.test(fast[3].er), 'the last fault, and when: "' + fast[3].er + '"');
  const more = await pg.evaluate(() => { const d = document.querySelector('#brain-tier-fast details.more'); return d ? { s: d.querySelector('summary').textContent, open: d.open, li: [...d.querySelectorAll('li')].map(li => li.querySelector('.no').textContent + ' ' + li.querySelector('.nm').textContent + ' ' + li.querySelector('.qw').textContent + ' / ' + li.querySelector('.dt').textContent) } : null; });
  ok(more && more.s === 'And 1 more after them' && !more.open && more.li[0] === '5 gpt-oss-20b not measured yet / on the AI Gateway · not asked these two weeks', 'the fifth behind "And 1 more after them": ' + JSON.stringify(more));
  ok(await pg.evaluate(() => { const q = document.querySelector('#brain-tier-fast details.more .qb'); return q.classList.contains('none') && !q.querySelector('i'); }), 'a model not measured yet has an empty, dotted bar');
  const strong = await pg.evaluate(() => [...document.querySelectorAll('#brain-tier-strong li')].map(li => li.querySelector('.qw').textContent + ' / ' + ((li.querySelector('.er') || {}).textContent || '')));
  ok(strong[0] === 'excellent / ' && strong[1].startsWith('fair / The last fault, 1 d ago: upstream said <img src=x onerror="window.__xss=1"><b>bold</b>'), 'a fault with markup in it arrives as words: ' + strong[1].slice(0, 90));
  ok((await text(pg, '#brain-tier-long')).split(/\n+/).join(' / ') === 'Long reading / No free model is configured or live today.', 'a tier with nothing live says so');
  ok(await pg.evaluate(() => document.querySelector('#brain-tier-mail .qw').textContent === 'too few calls yet' && document.querySelector('#brain-tier-mail .qb').classList.contains('none')), 'a model with too few calls is not judged yet (Mail)');
  const jev = await pg.evaluate(() => [...document.querySelectorAll('#brain-jev p')].map(p => p.className + ' :: ' + p.textContent));
  ok(jev[0] === 'jv :: Today: 214 calls, 212 answered, under a tenth of a second each, for under a cent.', 'the judge today: ' + jev[0]);
  ok(jev[1] === 'jv :: Yesterday: 380 calls, all answered, under a tenth of a second each, for under a cent.', 'and yesterday: ' + jev[1]);
  ok(jev[2] === 'sp :: Today\'s calls: sorting the inbox (120), letters before they go (40), the daily lights (30), the Lantern\'s own writing (24).', 'and what it was asked about, in the house\'s words: ' + jev[2]);
  const gw = await pg.evaluate(() => ({ chips: [...document.querySelectorAll('#brain-gw span')].map(s => s.className + ':' + s.textContent), after: document.querySelector('#brain-gw').nextElementSibling.textContent }));
  ok(gw.chips.join(' | ') === ':gpt-oss-120b · answering | wait:llama-4-scout · waiting a day | :gemma-3-27b · answering', 'the gateway\'s free models, answering or waiting a day: ' + gw.chips.join(' | '));
  ok(gw.after === '1 of them found no provider that keeps nothing and learns nothing, so it waits a day before it is asked again.', 'and why one waits');
  ok(await text(pg, '#brain-roi') === 'This month: 0.15 dollars, 3 uses, 1 helped, 1 still to be judged.', 'paid thinking, this month: ' + await text(pg, '#brain-roi'));
  ok(await text(pg, '#brain-spend') === 'Today 0.06 of 0.50 dollars; this month 0.15 of 10.00 dollars. No single paid call may cost more than 0.10 dollars.', 'the day\'s and the month\'s spend against their caps');
  const paid = await pg.evaluate(() => [...document.querySelectorAll('#brain-paid li')].map(li => ({ h: li.querySelector('.h b').textContent, c: li.querySelector('.h code').textContent, m: li.querySelector('.m').textContent, o: li.querySelector('.o').textContent, cls: li.querySelector('.o').className })));
  ok(paid.map(p => p.h).join(' | ') === 'A letter retry for a place of high value | A tie break between the free judges | The Monday strategy', 'each paid use, the newest first, by what it was for: ' + paid.map(p => p.h).join(' | '));
  ok(paid.map(p => p.c).join(',') === '0.06 dollars,under a cent,0.09 dollars', 'with its cost: ' + paid.map(p => p.c).join(', '));
  const WHEN = /^(\d{1,2}:\d{2} UTC|yesterday|[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}) · /;
  ok(WHEN.test(paid[0].m) && paid[0].m.endsWith(' · anthropic/claude-sonnet-4.5') && WHEN.test(paid[2].m) && paid[2].m.endsWith(' · anthropic/claude-opus-4.1'), 'when, and which model: ' + paid.map(p => p.m).join(' | '));
  ok(paid[0].o === 'Waiting to see whether it helped.' && paid[0].cls === 'o', 'what it led to: waiting');
  ok(paid[1].o === 'It helped: the council could decide <b>bold</b>' && /good/.test(paid[1].cls), 'what it led to: it helped, the note escaped');
  ok(paid[2].o === 'It did not help: the plan was not used' && /\bno\b/.test(paid[2].cls), 'what it led to: it did not help');
  await clean(pg, o.st, '#soul-brains', 'the Brains card');
  ok(!o.st.errors.length, 'no console errors' + (o.st.errors.length ? ' ' + o.st.errors.join(' | ') : ''));
  await shotEl(pg, '#soul-brains', 'engine-390-brains');
  await pg.click('#brain-tier-fast details.more summary');
  await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => document.querySelector('#brain-tier-fast details.more').open), '"And 1 more" opens');
  await shotEl(pg, '#brain-tier-fast', 'engine-390-brains-more-open');
  await o.ctx.close();
}
for (const [name, models, checks] of [
  ['the judge down', M.down, async pg => {
    const jv = await pg.evaluate(() => [...document.querySelectorAll('#brain-jev p')].map(p => p.className + ' :: ' + p.textContent));
    ok(jv[0] === 'jv down :: Today: 6 calls, 0 answered. The judge did not answer; while it is down, everything it would judge goes on exactly as before it existed.', 'the judge down, in its own words and colour: ' + jv[0]);
    ok(jv[1] === 'jv :: Yesterday: not asked.', 'a day it was not asked: ' + jv[1]);
    ok(jv[2] === 'sp :: Today\'s calls: sorting the inbox (6).', 'and what it was asked about, never "judged" when it did not answer: ' + jv[2]);
    ok(await text(pg, '#brain-roi') === 'No paid model was used this month: the free ones did all the work.' && !await has(pg, '#brain-paid'), 'no paid use: said plainly, and no ledger');
    ok(await pg.evaluate(() => getComputedStyle(document.querySelector('#brain-jev .jv.down')).color !== getComputedStyle(document.querySelector('#brain-jev .jv:not(.down)')).color), 'the down line stands apart');
  }],
  ['a ranking that could not be read', M.nul, async pg => {
    ok(await text(pg, '#brain-rank-fail') === 'The ranking could not be read just now. The free models are still asked, in each tier\'s own order.', 'the ranking: one calm sentence');
    ok(!await has(pg, '#brain-words') && await pg.evaluate(() => !document.querySelector('#brains-card .btier')), 'no lead and no tiers when there is nothing to say');
    ok((await text(pg, '#brain-jev')).split(/\n+/).join(' / ') === 'Today: the count could not be read. / Yesterday: the count could not be read.', 'the judge\'s counts that could not be read say so');
    ok(await text(pg, '#brain-gw') === 'The AI Gateway is not set up on this deployment, so its free models are not asked.', 'no gateway: said plainly');
    ok(await text(pg, '#brain-roi') === 'What paid thinking bought this month could not be read just now.' && await text(pg, '#brain-spend') === 'The spend ledger could not be read just now.', 'a ledger that could not be read is never shown as nothing spent');
  }],
  ['an older server', M.old, async pg => {
    ok(await text(pg, '#brain-rank-old') === 'The measured order comes with the next deployment; until then each tier asks its free models in its own order.', 'an older server: the measured order comes with the next deployment');
    ok(await pg.evaluate(() => !document.querySelector('#brain-jev, #brain-gw, #brain-roi')), 'and nothing it cannot know is drawn');
  }],
  ['a read that failed', M.failed, async pg => {
    ok(await text(pg, '#brain-fail') === 'The models could not be read just now (the store did not answer <b>bold</b>). The rest of this room is unaffected; press refresh at the top to ask again.', 'a failed read: what happened, escaped, and what to do');
    ok(await has(pg, '#soul-budget') && await has(pg, '#soul-voice'), 'and the rest of the room stands');
  }],
  /* round six */
  ['the judge waiting', M.closed, async pg => {
    const jv = await pg.evaluate(() => [...document.querySelectorAll('#brain-jev p')].map(p => (p.id ? p.id + ' ' : '') + p.className + ' :: ' + p.textContent));
    ok(jv[0] === 'jv :: Today: 40 calls, all answered, under a tenth of a second each, for under a cent.', 'Today first, as before: ' + jv[0]);
    ok(jv[1] === 'brain-jev-closed jv down :: The judge is waiting: its free hour of questions is spent <b>bold</b>. It is asked again within the hour; meanwhile everything it would judge goes on exactly as before it existed. 12 things it would have judged have gone on without it today.',
      'under Today, the judge\'s pause in its own words, escaped, and what went on without it: ' + jv[1]);
    ok(/^jv :: Yesterday: /.test(jv[2]), 'then Yesterday, in its place: ' + jv[2]);
    ok(await pg.evaluate(() => !document.querySelector('#brain-jev b') && getComputedStyle(document.getElementById('brain-jev-closed')).color !== getComputedStyle(document.querySelector('#brain-jev .jv:not(.down)')).color), 'the pause stands apart in the waiting colour, and its markup is text');
    ok(await text(pg, '#brain-gw') === 'Today the AI Gateway\'s 7 free models have no provider that keeps nothing and learns nothing, so none is asked.', 'the gateway\'s free list read, none fit to ask: said plainly');
    ok(!await has(pg, '#brain-gw span'), 'and no name is drawn as if it answered');
  }],
  ['the judge waiting, one thing', M.closedOne, async pg => {
    const c = await text(pg, '#brain-jev-closed');
    ok(c === 'The judge is waiting: the judge said to come back later. It is asked again within the hour; meanwhile everything it would judge goes on exactly as before it existed. One thing it would have judged has gone on without it today.', 'one thing, in words: ' + c);
    ok(await text(pg, '#brain-gw') === 'Today the AI Gateway\'s one free model has no provider that keeps nothing and learns nothing, so it is not asked.', 'one free model, in words: ' + await text(pg, '#brain-gw'));
  }],
  ['the judge open, an empty free list', M.open, async pg => {
    ok(!await has(pg, '#brain-jev-closed'), 'an empty reason: no pause line at all');
    ok(await text(pg, '#brain-gw') === 'Its free list could not be read today, or holds no language model.', 'no free name and none without a provider: the old line');
  }]]) {
  const o = await open_(390, 844, { models: models, hash: '#engine' });
  await brains(o.pg);
  await checks(o.pg);
  await clean(o.pg, o.st, '#soul-brains', name);
  ok(!o.st.errors.length, name + ': no console errors' + (o.st.errors.length ? ' ' + o.st.errors.join(' | ') : ''));
  await shotEl(o.pg, '#soul-brains', 'engine-390-' + name.replace(/[^a-z]+/gi, '-').replace(/^-|-$/g, '').toLowerCase());
  await o.ctx.close();
}
{
  const o = await open_(390, 844, { modelsMode: 'net', hash: '#engine' });
  await brains(o.pg);
  ok((await text(o.pg, '#brain-fail')).startsWith('The models could not be read just now.'), 'no network: the card says the models could not be read, and the room stands');
  await o.ctx.close();
}
/* the desk */
{
  const o = await open_(1440, 900, { hash: '#engine' });
  await brains(o.pg);
  ok(await noSideScroll(o.pg), 'the engine room on a desk: no sideways scroll');
  const w = await o.pg.evaluate(() => Math.round(document.getElementById('brains-card').getBoundingClientRect().width));
  ok(w > 500, 'the card has the room\'s width on a desk (' + w + ' px)');
  await shotEl(o.pg, '#soul-brains', 'engine-1440-brains');
  await o.ctx.close();
  const d = await open_(1440, 900, { hash: '#engine', models: M.down });
  await brains(d.pg);
  await shotEl(d.pg, '#soul-brains', 'engine-1440-brains-judge-down');
  await d.ctx.close();
}
/* motion: the bars grow in once; asked for less, nothing moves */
{
  const o = await open_(390, 844, { motion: true, hash: '#engine', settle: 0 });
  await o.pg.waitForSelector('#soul-brains #brains-card', { timeout: 10000 });
  const n = await o.pg.evaluate(() => document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#soul-brains')).length);
  ok(n >= 4, 'with motion, the quality bars grow in (' + n + ' animations)');
  await o.ctx.close();
  const r = await open_(390, 844, { hash: '#engine' });
  await r.pg.waitForSelector('#soul-brains #brains-card', { timeout: 10000 });
  const m = await r.pg.evaluate(() => document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#soul-brains, #h-voice')).length);
  ok(m === 0, 'with less motion asked for, nothing in the card moves (' + m + ')');
  await r.ctx.close();
}

/* =================================================================== THE MAIL ROOM */
console.log('=== the mail room: what the judge sorted ===');
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const o = await open_(w, h);
  const pg = o.pg;
  await pg.evaluate(() => { location.hash = '#mail'; });
  await pg.waitForSelector('#s-mail.on #mail-threads [data-thread]', { timeout: 15000 });
  await pg.waitForTimeout(250);
  const sheetOf = async i => { await pg.click('#mail-threads [data-thread="' + i + '"]'); await pg.waitForTimeout(350); const r = { j: await text(pg, '#mail-judged'), has: await has(pg, '#sheet-in #mail-judged') }; return r; };
  let s = await sheetOf(0);
  ok(s.j === 'Sorted by the judge (91 percent sure)', w + ': a thread the judge sorted says "' + s.j + '"');
  if (w === 390) {
    await clean(pg, o.st, '#sheet-in', 'the thread sheet');
    const pos = await pg.evaluate(() => { const a = [...document.querySelectorAll('#sheet-in h3')].find(h => h.textContent === 'What the Lantern did'), j = document.getElementById('mail-judged'); return !!a && !!(a.compareDocumentPosition(j) & Node.DOCUMENT_POSITION_FOLLOWING); });
    ok(pos, 'under "What the Lantern did"');
  }
  await pg.screenshot({ path: SHOTS + '/mail-' + w + '-judged-sheet.png' });
  await pg.click('#sheet-in #cl'); await pg.waitForTimeout(300);
  if (w === 390) {
    s = await sheetOf(1); ok(!s.has, 'a thread a writing model read has no judge line'); await pg.click('#sheet-in #cl'); await pg.waitForTimeout(300);
    s = await sheetOf(2); ok(s.j === 'Sorted by the judge', 'a judge that gave no number: "' + s.j + '"'); await pg.click('#sheet-in #cl'); await pg.waitForTimeout(300);
    s = await sheetOf(3); ok(!s.has, 'another hand ("model") is not called the judge'); await pg.click('#sheet-in #cl'); await pg.waitForTimeout(300);
    s = await sheetOf(4); ok(s.j === 'Sorted by the judge (87 percent sure)', 'a sureness given as a percentage reads the same: "' + s.j + '"'); await pg.click('#sheet-in #cl'); await pg.waitForTimeout(300);
  }
  ok(!o.st.errors.length, w + ': no console errors' + (o.st.errors.length ? ' ' + o.st.errors.join(' | ') : ''));
  await o.ctx.close();
}

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
