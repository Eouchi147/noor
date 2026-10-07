/* NOOR · one console, with what needs the owner on every screen (LANTERN.md section 15).
   ------------------------------------------------------------------
   The owner, 7 October 2026: "The whole admin should be managed and run by
   the lantern, I am the human who owns Noor but also has a family with
   young kids and doesn't have time to chase and dig and search. I need
   clarity and simplicity at all time. I want to be able to find easily
   what I need to attend to everywhere in the admin console. Also some
   buttons (At least the "Ledger" button) bring me to the old admin console
   that we retired. I need 1 admin console, unified and optimized for me and
   the lantern to work synergistically."

   This drives admin2.html against a stub of exactly the contract the server
   is built to, from a stub that remembers what was posted to it:

     Needs you: GET /api/soul?view=needs, its count in the top bar of every
       screen (gold with its number, calm when nothing waits, absent on a
       house without the view), its list in a sheet, and each item one tap
       to where it is done (a letter opening whole in the Mail room, the
       held letters, the mail's inbox, the readers' messages, the journal's
       replies, a card on Home brought into view); read again after a change;
     Giving, the ledger, in this console: the zakat still owed, the gifts,
       where the money stands, recording what was given (and its exact POST),
       taking a record back after asking (its exact DELETE), month by month,
       the recent gifts, the du'as on the wall, Stripe's own pages; Home's
       "The ledger" and a card's old /admin#giving link both open it here;
     the readers' inbox with its own buttons: New first, a new message read
       when opened (one PATCH), Done, Back to read, Delete after asking;
     and the rules: no link to the retired console anywhere, markup shown as
       text, every tap target 44 px, nothing sideways at 390 px, no "soul",
       no dash, no script error.

   Screenshots land in /tmp/qa/needs/ for a person to look at.

   Run:  python3 -m http.server 8263 --bind 127.0.0.1 &   node tests/console-needs.mjs
   (NOOR_BASE overrides the address; CHROMIUM_PATH the browser; NEEDS_SHOTS
   where the screenshots go.)
*/
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8263';
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.NEEDS_SHOTS || '/tmp/qa/needs';
mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const br = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const DASH = new RegExp('[\\u2013\\u2014]');
const SOUL = /\bsoul\b/i;

/* ---------------------------------------------------------------- the day */
const NOW = Date.now(), H = 3600e3, D = 86400e3;
const iso = t => new Date(t).toISOString();
const day = n => new Date(NOW + n * D).toISOString().slice(0, 10);
const XSS = '<img src=x onerror="window.__xss=1">';
const BOLD = '<b>bold</b>';

/* ---------------------------------------------------------------- the house */
const LETTER = (n, o = {}) => ({ id: 'd-lt-' + n, kind: 'approve', title: 'Send this letter to Place ' + n + '?', why: 'One of the first 10 emails the Lantern writes.', goal: 'g-outreach', impact: null,
  options: [{ id: 'send', label: 'Send', style: 'primary', confirm: null }, { id: 'no', label: 'Not this one', style: 'danger', confirm: null }, { id: 'later', label: 'Later', style: 'plain', confirm: null }],
  link: null, steps: [], at: iso(NOW - (5 - n) * H), expires: null, draft: null,
  letter: { to: 'office' + n + '@place.example', toName: 'Place ' + n, subject: 'A free library for your classes', text: 'Assalamu alaykum,\n\nA letter to place ' + n + '.\n\nWith peace,\nNOOR Codex of Light', kind: 'outreach' }, ...o });
const CARDS = () => [LETTER(1), LETTER(2),
  { id: 'd-drift', kind: 'choose', title: '"Reach more people each week" has been behind for 4 days', why: 'The Lantern is answering it in its plan every day; the goal itself is yours to keep or change.', goal: 'g-reach', impact: null,
    options: [{ id: 'keep', label: 'Keep the goal', style: 'primary', confirm: null }, { id: 'open', label: 'Change the goal', style: 'plain', confirm: null }, { id: 'later', label: 'Later', style: 'plain', confirm: null }],
    link: { href: '/admin2#soul', label: 'Open the goals' }, steps: [], at: iso(NOW - 6 * H), expires: null, draft: null },
  { id: 'd-zakat', kind: 'you', title: 'Zakat waits to be given', why: 'The ledger holds what is still owed.', goal: null, impact: null,
    options: [{ id: 'open', label: 'Open the ledger', style: 'primary', confirm: null }, { id: 'done', label: 'Given', style: 'plain', confirm: null }, { id: 'later', label: 'Later', style: 'plain', confirm: null }],
    link: { href: '/admin#giving', label: 'Open the ledger' }, steps: ['12.50 USD waits to be given', 'Record it in the ledger once it has gone'], at: iso(NOW - 7 * H), expires: null, draft: null },
  { id: 'd-old-inbox', kind: 'you', title: '2 new messages in the inbox', why: 'Readers wrote through the site\'s message door; only you can answer them.', goal: null, impact: null,
    options: [{ id: 'open', label: 'Open the inbox', style: 'primary', confirm: null }, { id: 'done', label: 'Done', style: 'plain', confirm: null }],
    link: { href: '/admin#inbox', label: 'Open the inbox' }, steps: [], at: iso(NOW - 8 * H), expires: null, draft: null }];
const GOALS = () => [
  { id: 'g-reach', owner: 'owner', outcome: 'Reach more people each week', metric: 'northStar', unit: 'people', baseline: 15600, current: 31240, target: 62400, due: '2026-12-25', status: 'behind', projected: 48900, eta: null, note: null, focus: null, history: [] },
  { id: 'g-outreach', owner: 'owner', outcome: 'At least 50 places invited to work together', metric: 'outreach.contacted', unit: 'places', baseline: 0, current: 2, target: 50, due: day(30), status: 'on-track', projected: 52, eta: day(25), note: null, focus: null, history: [] }];
const GIVING = () => ({ configured: true, currency: 'USD', month: new Date(NOW).toISOString().slice(0, 7), monthly: { givers: 14, delta7: 2 },
  gifts30: { count: 31, gross: 562, net: 530.4 }, thisMonth: { count: 6, gross: 118, net: 110.2 }, lastMonth: { count: 27, gross: 498, net: 470.9 },
  upkeep: { month: 172, cover: 0.64 }, zakat: { outstanding: 12.5 }, series: [], line: null, note: null, did: [], at: iso(NOW - 2 * H), partial: false });
const MAIL_ON = () => ({ configured: true, on: true, firstTen: { sent: 1, of: 10 }, today: { received: 4, answered: 1, filed: 2, forYou: 1, sent: 1 },
  outreach: { places: 150, contacted: 1, replied: 0, working: 0, target: 50 }, last: [] });
const HOME = (o = {}) => ({ ok: true, now: iso(NOW), name: 'the Lantern', paused: false, status: 'needs-you', brief: null,
  decisions: CARDS(), done: [], next: [], coming: [], goals: GOALS(), ideas: [],
  today: { posts: { sent: 6, due: 6, failed: 0 }, fixed: 0, reach7: { value: 31240, delta: 1204 }, slots: [] },
  voice: { telegram: { linked: true } }, spend: { usd: 3.42, capUsd: 10 }, giving: GIVING(), mail: MAIL_ON(), missing: {}, ...o });
/* GET ?view=needs: the house's own list, in its order */
const NEEDS = (o = {}) => ({ ok: true, at: iso(NOW), planning: false, items: [
  { id: 'letters', n: 2, title: '2 letters wait for your Send', why: 'Read each one whole, then Send or Not this one.', where: 'mail', go: { room: 'mail', tab: 'letters', letter: 'd-lt-2' }, act: 'Read them' },
  { id: 'mail', n: 1, title: '1 message in the mail needs you', why: 'What the Lantern could not settle on its own, and any reply waiting for your Send.', where: 'mail', go: { room: 'mail', tab: 'inbox' }, act: 'Open the inbox' },
  { id: 'inbox', n: 2, title: '2 new messages from readers', why: 'Readers wrote through the site\'s message door; only you can answer them.', where: 'readers', go: { room: 'readers', anchor: 'anchor-inbox' }, act: 'Read them' },
  { id: 'journal', n: 1, title: '1 journal reply waits to be read', why: 'A reply goes on the journal\'s wall only once you release it.', where: 'readers', go: { room: 'readers', anchor: 'anchor-journal' }, act: 'Read it' },
  { id: 'held', n: 1, letters: 4, title: '4 letters held back today', why: 'The checks stopped them before they were written. Plan again brings them back, or choose one by one.', where: 'mail', go: { room: 'mail', tab: 'letters', anchor: 'mail-held' }, act: 'See them' },
  { id: 'card:d-drift', n: 1, kind: 'choose', title: '"Reach more people each week" has been behind for 4 days', why: 'The goal itself is yours to keep or change.', where: 'home', go: { room: 'home', card: 'd-drift' }, act: 'Open' },
  { id: 'card:d-x', n: 1, kind: 'you', title: XSS + BOLD, why: XSS, where: 'home', go: { room: 'home', card: 'd-zakat' }, act: 'Open' }], count: 9, ...o });
/* GET ?view=mail, with the letters */
const LT = n => ({ card: 'd-lt-' + n, kind: 'outreach', toName: 'Place ' + n, to: 'office' + n + '@place.example', subject: 'A free library for your classes',
  text: 'Assalamu alaykum,\n\nA letter to place ' + n + '.\n\nWith peace,\nNOOR Codex of Light', why: 'One of the first 10 emails the Lantern writes.', at: iso(NOW - (5 - n) * H), later: false });
const MAILV = () => ({ ok: true, mail: { configured: true, on: true, reason: null, caps: { outreach: 50, replies: 30, followups: 50, total: 90 }, firstTen: { sent: 1, of: 10 }, today: { received: 4, answered: 1, filed: 2, forYou: 1, sent: 1 } },
  threads: [{ id: 't1', at: iso(NOW - 1 * H), from: 'desk@paper.example', fromName: 'A newspaper', subject: 'An interview', kind: 'press', action: 'for-you', summary: 'A journalist asks for an interview.', reply: null, needsYou: true, ops: ['done', 'answer', 'notours'], gmail: null, card: null, draft: null }],
  places: [], counts: { places: 150, contacted: 1, replied: 0, working: 0, declined: 0, dnc: 0 },
  pace: { date: day(0), letters: 20, followups: 20, written: 1, followupsWritten: 0, scheduled: 0, waiting: 2, ready: 140, found: 150, week: 1, start: day(0), braked: false, until: null, why: 'Week 1 of the warm-up: 20 a day.', sent: 1, bounced: 0 },
  dnc: [], letters: { waiting: [LT(1), LT(2)], repliesWaiting: 0,
    held: [1, 2, 3, 4].map(i => ({ id: 'i:c-9:' + i, title: 'Write to Place held ' + i, why: '', reason: 'the council said no', hand: 'outreach-send', canDoNow: true, canSkip: true })),
    planning: false, writing: 0, scheduled: [], sent: [] }, missing: {} });
/* GET /api/ledger: minor units */
const LEDGER = (o = {}) => ({ ok: true, configured: true, store: true, partial: false, currency: 'usd',
  funds: { zakat: { accrued: 1550, given: 300, outstanding: 1250 } },
  waterfall: { monthsRun: 3, zakat: { due: 1550, given: 300, outstanding: 1250 }, upkeep: { spent: 9000, covered: 9000 },
    household: { floor: 0, target: 0, taken: 0, allowed: 0, undrawn: 0 }, onward: { available: 51450, given: 2000, remaining: 49450 } },
  totals: { gross: 62000, fee: 2100, net: 59900, count: 58, feesPartial: false },
  months: [{ month: '2026-10', currency: 'usd', gross: 11800, fee: 400, net: 11400, count: 6, zakat: 295, givenZakat: 300 }, { month: '2026-09', currency: 'usd', gross: 49800, fee: 1600, net: 48200, count: 27, zakat: 1245, givenZakat: 0 }],
  given: [{ id: 'g1', kind: 'zakat', amountMinor: 300, currency: 'usd', note: 'The local food bank ' + XSS, date: day(-3), at: iso(NOW - 3 * D) },
    { id: 'g2', kind: 'onward', amountMinor: 2000, currency: 'usd', note: '', date: day(-10), at: iso(NOW - 10 * D) }],
  honest: 'The zakat is set aside from everything received. It is a commitment of the keeper, not a condition of any gift.', ...o });
const HOUSE = { store: true, storeKind: 'redis', lanternConfigured: true, lanternModel: 'x/inkling:free', moneyMode: 'quiet', weekly: 3, activeCount: 0, guardians: [],
  gifts: { total30d: 562, count30d: 31, monthly: 140, recent: [{ amount: 25, currency: 'USD', when: day(-1), email: 'giver@example.org' }, { amount: 10, currency: 'EUR', when: day(-2), email: XSS }] } };
const WALL = { items: ['O Allah, have mercy on my mother.', XSS] };
const INBOX = () => ({ ok: true, counts: { new: 2, read: 1, done: 1, total: 4 }, items: [
  { id: 'm1', at: iso(NOW - 1 * H), status: 'new', from: 'reader@example.org', kind: 'correction', page: '/quran', cc: 'GB', body: 'The verse number on the page is off by one. ' + BOLD },
  { id: 'm2', at: iso(NOW - 2 * H), status: 'new', from: 'a reader', kind: 'note', page: '', cc: '', body: 'Thank you for the library' },
  { id: 'm3', at: iso(NOW - 3 * D), status: 'read', from: 'reader2@example.org', kind: 'note', page: '', cc: '', body: 'A question about prayer times' },
  { id: 'm4', at: iso(NOW - 5 * D), status: 'done', from: XSS, kind: 'note', page: '', cc: '', body: XSS }] });
const QUEUE = () => ({ queue: [{ entry: 'e1', slug: 'first-light', title: 'First light', cid: 'c9', name: 'anon', body: 'A reply that waits for its release.', at: iso(NOW - 4 * H), state: 'pending', why: 'link' }] });
const ADDRS = ['office1@place.example', 'office2@place.example', 'reader@example.org', 'reader2@example.org', 'giver@example.org', 'desk@paper.example'];

/* ---------------------------------------------------------------- the page */
const until = async (f, ms = 6000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) return false; await new Promise(r => setTimeout(r, 25)); } return true; };
async function open_(w, h, opts = {}) {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const pg = await ctx.newPage();
  const st = { home: (opts.home || HOME)(), needs: (opts.needs || NEEDS)(), mailv: MAILV(), ledger: (opts.ledger || LEDGER)(), inbox: INBOX(), queue: QUEUE(),
    posted: [], urls: [], needsGets: 0, errors: [], dialogs: 0, noNeeds: !!opts.noNeeds, ledgerMode: opts.ledgerMode || 'ok' };
  pg.on('pageerror', e => st.errors.push(String(e)));
  pg.on('console', m => { if (m.type() === 'error' && !(st.noNeeds && /status of 400/.test(m.text()))) st.errors.push(m.text()); });
  pg.on('dialog', d => { st.dialogs++; d.dismiss().catch(() => {}); });
  pg.on('request', q => st.urls.push(q.url()));
  const J = (b, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(b) });
  await ctx.route('**/*', async r => {
    const q = r.request(), u = q.url(), m = q.method();
    if (/^https:\/\/(dashboard\.stripe\.com|noorcodex\.com)\//.test(u)) return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>away</title>' });
    const body = () => { try { return JSON.parse(q.postData() || '{}'); } catch { return {}; } };
    if (u.includes('/api/soul')) {
      if (m === 'POST') {
        const b = body(); st.posted.push({ url: u.replace(BASE, ''), method: m, body: b });
        if (b.action === 'decide') {
          st.home.decisions = st.home.decisions.filter(x => x.id !== b.id);
          st.mailv.letters.waiting = st.mailv.letters.waiting.filter(x => x.card !== b.id);
          const li = st.needs.items.find(x => x.id === 'letters');
          if (li) { li.n--; st.needs.count--; li.title = li.n + ' letter' + (li.n === 1 ? ' waits' : 's wait') + ' for your Send'; if (!li.n) st.needs.items = st.needs.items.filter(x => x !== li); }
          return r.fulfill(J({ ok: true, message: b.option === 'send' ? 'Sent.' : 'Not sent.' }));
        }
        return r.fulfill(J({ ok: true, message: 'Done.' }));
      }
      const view = new URL(u).searchParams.get('view');
      if (view === 'needs') { st.needsGets++; if (st.noNeeds) return r.fulfill(J({ ok: false, error: 'unknown view' }, 400)); return r.fulfill(J(st.needs)); }
      if (view === 'home') return r.fulfill(J({ ...st.home, now: iso(Date.now()) }));
      if (view === 'mail') return r.fulfill(J(st.mailv));
      if (view === 'today') return r.fulfill(J({ ok: true, paused: false, mission: 'Serve.', northStar: { value: 31240, weekAgo: 30036, series: [] }, goals: [], lastCycle: null, spend: { month: '2026-10', usd: 3.42, capUsd: 10 }, counts: { actionsToday: 2, capToday: 6 }, telegram: { linked: true } }));
      return r.fulfill(J({ ok: true, items: [] }));
    }
    if (u.includes('/api/ledger')) {
      if (m === 'GET') {
        if (st.ledgerMode === 'net') return r.abort('connectionfailed');
        if (st.ledgerMode === 'stripe') return r.fulfill(J({ ok: false, reason: 'stripe', configured: false, store: true, funds: {}, months: [], given: [], totals: {} }));
        return r.fulfill(J(st.ledger));
      }
      const b = body(); st.posted.push({ url: u.replace(BASE, ''), method: m, body: b });
      if (st.ledgerRefuse) return r.fulfill(J({ ok: false, reason: 'store' }));
      if (m === 'POST') {
        const rec = { id: 'g' + (st.ledger.given.length + 9), kind: b.kind, amountMinor: b.amountMinor, currency: 'usd', note: b.note || '', date: b.date, at: iso(Date.now()) };
        st.ledger.given = [rec, ...st.ledger.given];
        if (b.kind === 'zakat') { const z = st.ledger.funds.zakat; z.given += b.amountMinor; z.outstanding = z.accrued - z.given; }
        return r.fulfill(J({ ...st.ledger, recorded: rec.id }));
      }
      if (m === 'DELETE') {
        const g = st.ledger.given.find(x => x.id === b.id);
        st.ledger.given = st.ledger.given.filter(x => x.id !== b.id);
        if (g && g.kind === 'zakat') { const z = st.ledger.funds.zakat; z.given -= g.amountMinor; z.outstanding = z.accrued - z.given; }
        return r.fulfill(J({ ...st.ledger, removed: b.id }));
      }
    }
    if (u.includes('/api/inbox')) {
      if (m === 'PATCH') {
        const b = body(); st.posted.push({ url: u.replace(BASE, ''), method: m, body: b });
        if (b.delete === true) st.inbox.items = st.inbox.items.filter(x => x.id !== b.id);
        else { const x = st.inbox.items.find(y => y.id === b.id); if (x) x.status = b.status; }
        const c = { new: 0, read: 0, done: 0 }; st.inbox.items.forEach(x => c[x.status]++); st.inbox.counts = { ...c, total: st.inbox.items.length };
        return r.fulfill(J({ ok: true, counts: st.inbox.counts }));
      }
      return r.fulfill(J(st.inbox));
    }
    if (u.includes('/api/journal')) {
      if (m === 'POST') { const b = body(); if (b.action !== 'queue') st.posted.push({ url: u.replace(BASE, ''), method: m, body: b }); if (b.action === 'comment-state') st.queue.queue = st.queue.queue.filter(c => c.cid !== b.cid); return r.fulfill(J({ ok: true, queue: st.queue.queue })); }
      return r.fulfill(J({ ok: true, entries: [] }));
    }
    if (u.includes('/api/dedications')) return r.fulfill(J(WALL));
    if (u.includes('/api/social')) return r.fulfill(J({ ok: true, dials: { mode: 'auto' }, channels: [] }));
    if (u.includes('/api/admin-data?probe=lights')) return r.fulfill(J({ probe: 'lights', today: null, index: { n: 421, months: {}, kinds: {} }, lib: { n: 421 }, doubts: [] }));
    if (u.includes('/api/admin-data?probe=night')) return r.fulfill(J({ probe: 'night', brief: null, findings: [], last: null, perNight: 40 }));
    if (u.includes('/api/admin-data')) return r.fulfill(J(HOUSE));
    if (u.includes('/api/settings')) return r.fulfill(J({ store: true, dials: [] }));
    if (u.includes('/api/')) return r.fulfill(J({ ok: true }));
    if (u.startsWith(BASE)) return r.continue();
    if (u.includes('fonts.g')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.abort();
  });
  /* the journal's held replies are read through POST {action:"queue"} in this console */
  await pg.goto(BASE + '/admin2.html' + (opts.hash || ''), { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#app.on', { timeout: 15000 });
  if (!opts.hash) await pg.waitForSelector('#s-home.on #h-decide .hsec .cnt, #s-home.on #h-decide .hfail', { timeout: 15000 });
  await pg.waitForTimeout(400);
  return { pg, st, ctx };
}
const tc = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent : ''; }, sel);
const text = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const toastSays = pg => pg.evaluate(() => { const t = document.getElementById('toast'); return t.firstChild ? t.firstChild.textContent : ''; });
const noSideScroll = pg => pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const surfaceOn = pg => pg.evaluate(() => (document.querySelector('.surf.on') || {}).id);
const sheetOn = pg => pg.evaluate(() => document.getElementById('sheet').classList.contains('on'));
const allWords = (pg, scope) => pg.evaluate(s => [document.querySelector(s).innerText, ...[...document.querySelectorAll(s + ' [title], ' + s + ' [aria-label], ' + s + ' [placeholder]')].map(e => [e.getAttribute('title'), e.getAttribute('aria-label'), e.getAttribute('placeholder')].filter(Boolean).join(' '))].join('\n'), scope);
const shortTaps = (pg, scope) => pg.evaluate(s => [...document.querySelectorAll(s + ' button, ' + s + ' a, ' + s + ' select, ' + s + ' input')]
  .filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden')
  .filter(b => b.getBoundingClientRect().height < 43.5).map(b => (b.textContent || b.getAttribute('aria-label') || b.id || b.tagName).trim().slice(0, 30) + ':' + Math.round(b.getBoundingClientRect().height)), scope);
const chip = pg => pg.evaluate(() => { const b = document.getElementById('needs'); return { hidden: b.hidden, hot: b.classList.contains('hot'), n: (b.querySelector('.nn') || {}).textContent || '', t: (b.querySelector('.nt') || {}).textContent || '', label: b.getAttribute('aria-label'), h: b.getBoundingClientRect().height }; });
const needRows = pg => pg.evaluate(() => [...document.querySelectorAll('#needs-list [data-need]')].map(r => r.querySelector('.t b').textContent + ' / ' + r.querySelector('.pill').textContent));
const openNeeds = async pg => { await pg.click('#needs'); await pg.waitForSelector('#sheet.on #needs-sheet', { timeout: 5000 }); await pg.waitForTimeout(200); };
const press = async (pg, st, sel) => { const n = st.posted.length; await pg.click(sel); await until(() => st.posted.length > n); await pg.waitForTimeout(450); return st.posted.slice(n); };
const goMore = async (pg, room) => { await pg.click('nav.bar [data-s="more"]'); await pg.waitForSelector('#s-more [data-room="' + room + '"]', { timeout: 10000 }); await pg.click('#s-more [data-room="' + room + '"]'); await pg.waitForTimeout(400); };

/* ============================================================ Needs you, on every screen */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · Needs you: its count on every screen, its list, each item one tap to where it is done');
  const { pg, st, ctx } = await open_(w, h);
  await until(() => st.needsGets > 0);
  await pg.waitForTimeout(200);
  let c = await chip(pg);
  ok(!c.hidden && c.hot && c.n === '9' && c.t === 'need you' && c.label === '9 things need you. Open the list.', 'the top bar says 9 need you, in gold: ' + JSON.stringify(c));
  ok(c.h >= 40, 'the chip is a thumb\'s size (' + Math.round(c.h) + ' px, its touch area larger)');
  ok(await noSideScroll(pg) && await pg.evaluate(() => { const hd = document.querySelector('header.top'); return hd.scrollWidth <= hd.clientWidth + 1; }), 'the bar fits at ' + w + ' px, nothing sideways');
  if (w < 500) ok(await pg.evaluate(() => getComputedStyle(document.getElementById('when')).display === 'none'), 'on a phone the clock gives its room to the count');
  await pg.screenshot({ path: SHOTS + '/needs-chip-home-' + tag + '.png' });
  for (const room of ['more', 'mail', 'giving']) {
    if (room === 'more') { await pg.click('nav.bar [data-s="more"]'); await pg.waitForTimeout(300); } else await goMore(pg, room);
    c = await chip(pg);
    ok(!c.hidden && c.n === '9', 'it stands on ' + room + ' too: ' + c.n);
  }
  await pg.screenshot({ path: SHOTS + '/needs-chip-giving-' + tag + '.png' });
  await openNeeds(pg);
  const rows = await needRows(pg);
  ok(rows.join(' | ') === '2 letters wait for your Send / Read them | 1 message in the mail needs you / Open the inbox | 2 new messages from readers / Read them | 1 journal reply waits to be read / Read it | 4 letters held back today / See them | "Reach more people each week" has been behind for 4 days / Open | ' + XSS + BOLD + ' / Open',
    'the list, in the house\'s order, each with its one action: ' + rows.length + ' rows');
  ok(await pg.evaluate(() => !document.querySelector('#needs-sheet img, #needs-sheet b b') && !window.__xss), 'markup in an item is shown as text');
  const sh = await shortTaps(pg, '#sheet-in');
  ok(sh.length === 0, 'every control in the list 44 px or more: ' + sh.join(', '));
  await pg.screenshot({ path: SHOTS + '/needs-sheet-' + tag + '.png' });
  /* the letters: the Mail room, the named letter open whole */
  await pg.click('#needs-list [data-need="0"]');
  await pg.waitForSelector('#sheet.on #mail-lsheet', { timeout: 8000 }); await pg.waitForTimeout(300);
  ok(await surfaceOn(pg) === 's-mail' && await tc(pg, '#mail-lsheet h2') === 'Send this letter to Place 2?' && await tc(pg, '#mail-lpos') === 'Letter 2 of 2 waiting', 'Read them opens the Mail room on the letter it named, whole: ' + await tc(pg, '#mail-lsheet h2'));
  ok(await pg.evaluate(() => document.querySelector('#mail-tabs [data-mtab="letters"]').getAttribute('aria-selected') === 'true'), 'on the Letters tab');
  /* Send from there: the chip is read again on its own */
  const g0 = st.needsGets;
  await pg.click('#sheet-in [data-mlsend]'); await pg.waitForTimeout(150);
  await press(pg, st, '#sheet-in [data-mlsendyes]');
  await until(() => st.needsGets > g0, 4000); await pg.waitForTimeout(300);
  c = await chip(pg);
  ok(st.needsGets > g0 && c.n === '8', 'after his Send the count is read again by itself: ' + c.n);
  await pg.evaluate(() => { const s = document.getElementById('sheet'); if (s.classList.contains('on')) document.getElementById('veil').click(); }); await pg.waitForTimeout(300);
  /* the mail's own: the inbox tab, on what needs him */
  await openNeeds(pg); await pg.click('#needs-list [data-need="1"]'); await pg.waitForTimeout(700);
  ok(await surfaceOn(pg) === 's-mail' && await pg.evaluate(() => document.querySelector('#mail-tabs [data-mtab="inbox"]').getAttribute('aria-selected') === 'true' && !!document.querySelector('#mail-pane [data-mfn="needs"].on')), 'the mail\'s own opens the inbox, on Needs you');
  /* the held letters: Letters, Held back in view */
  await openNeeds(pg); await pg.click('#needs-list [data-need="4"]'); await pg.waitForTimeout(900);
  const held = await pg.evaluate(() => { const e = document.getElementById('mail-held'); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), inView: r.top < innerHeight && r.bottom > 0 }; });
  ok(held && held.inView && await pg.evaluate(() => document.querySelector('#mail-tabs [data-mtab="letters"]').getAttribute('aria-selected') === 'true'), 'the held letters: Letters, with Held back brought into view: ' + JSON.stringify(held));
  /* the readers' messages and the journal's replies */
  await openNeeds(pg); await pg.click('#needs-list [data-need="2"]');
  await pg.waitForSelector('#s-readers.on #rd-list', { timeout: 8000 }); await pg.waitForTimeout(400);
  ok(await surfaceOn(pg) === 's-readers' && await pg.evaluate(() => location.hash) === '#readers', 'the readers\' messages open the Readers\' inbox');
  await openNeeds(pg); await pg.click('#needs-list [data-need="3"]'); await pg.waitForTimeout(900);
  ok(await pg.evaluate(() => { const r = document.getElementById('anchor-journal').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }), 'the journal\'s replies: the Readers\' inbox, its replies brought into view');
  /* a card: Home, the card brought into view and glowing */
  await openNeeds(pg); await pg.click('#needs-list [data-need="5"]');
  /* Home may draw itself again as it opens; the glow follows the card, so the two are read together */
  const card = await pg.waitForFunction(() => { const c = document.querySelector('#h-decide article.dc[data-did="d-drift"]'); if (!c || !c.classList.contains('nglow')) return false; const r = c.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 ? { lit: true, inView: true } : false; }, null, { timeout: 8000 })
    .then(h => h.jsonValue(), () => null);
  ok(await surfaceOn(pg) === 's-home' && card && card.lit && card.inView, 'a card opens Home, the card in view and glowing once: ' + JSON.stringify(card));
  await pg.screenshot({ path: SHOTS + '/needs-card-' + tag + '.png' });
  ok(st.errors.length === 0 && st.dialogs === 0, 'no console error, no dialog: ' + st.errors.slice(0, 3).join(' | '));
  ok(!st.urls.some(u => ADDRS.some(a => u.includes(a) || u.includes(encodeURIComponent(a)))), 'no address ever reached a URL');
  await ctx.close();
}

console.log('\n390x844 · Needs you, calm; and a house without it');
{
  let o = await open_(390, 844, { needs: () => NEEDS({ items: [], count: 0 }) });
  await until(() => o.st.needsGets > 0); await o.pg.waitForTimeout(200);
  let c = await chip(o.pg);
  ok(!c.hidden && !c.hot && c.t === 'All clear' && c.label === 'Nothing needs you. Open the list.', 'nothing waits: the bar says All clear, calmly');
  await openNeeds(o.pg);
  ok(await tc(o.pg, '#needs-calm b') === 'Nothing needs you. The Lantern has it.' && /every screen/.test(await tc(o.pg, '#needs-calm span')), 'and its list says so: ' + await tc(o.pg, '#needs-calm b'));
  await o.pg.screenshot({ path: SHOTS + '/needs-calm-390x844.png' });
  await o.ctx.close();
  o = await open_(390, 844, { needs: () => NEEDS({ planning: true, items: NEEDS().items.slice(0, 1), count: 2 }) });
  await until(() => o.st.needsGets > 0); await o.pg.waitForTimeout(200);
  await openNeeds(o.pg);
  ok(await tc(o.pg, '#needs-planning') === 'The Lantern is planning now: new letters come to the Mail room as it writes them.', 'while a plan runs, the list says where the new letters will come');
  await o.ctx.close();
  o = await open_(390, 844, { noNeeds: true });
  await until(() => o.st.needsGets > 0); await o.pg.waitForTimeout(300);
  c = await chip(o.pg);
  ok(c.hidden, 'a house without the view: no chip at all, the console as it was');
  await o.ctx.close();
}

/* ============================================================ Giving: the ledger, here */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · Giving: the ledger in this console');
  const { pg, st, ctx } = await open_(w, h);
  const lk = await pg.evaluate(() => { const a = document.querySelector('#h-giving [data-ledger]'); return { href: a.getAttribute('href'), target: a.getAttribute('target') }; });
  ok(lk.href === '#giving' && lk.target === null, 'Home\'s "The ledger" leads to this console\'s Giving, never the old one: ' + JSON.stringify(lk));
  await pg.click('#h-giving [data-ledger]');
  await pg.waitForSelector('#s-giving.on #gv-owed', { timeout: 8000 }); await pg.waitForTimeout(300);
  ok(await surfaceOn(pg) === 's-giving' && await pg.evaluate(() => location.hash) === '#giving' && await tc(pg, '#title') === 'Giving' && await text(pg, '#s-giving .back') === 'Home', 'it opens Giving, its way back named Home');
  ok(await tc(pg, '#gv-owe') === '$12.50' && await tc(pg, '#gv-owed .gvs') === 'Set aside $15.50 · already given $3.00', 'first, the zakat still owed: ' + await tc(pg, '#gv-owe') + ' / ' + await tc(pg, '#gv-owed .gvs'));
  ok(/commitment of the keeper/.test(await tc(pg, '#gv-honest')), 'with the house\'s honest line');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#gv-gifts .mn')].map(m => m.querySelector('b').textContent + ' ' + m.querySelector('span').textContent).join(' | ')) === '$562 gifts, 30 days | 31 givers, 30 days | $140 monthly gifts a month', 'the gifts of the last 30 days');
  const wf = await pg.evaluate(() => [...document.querySelectorAll('#gv-water .gvw')].map(r => r.querySelector('.t b').textContent + ' = ' + r.querySelector('.gvv').textContent));
  ok(wf.join(' | ') === 'Zakat, off the gross = $12.50 | Upkeep, at what it costs = $90.00 | Household floor = $0.00 left | Above the floor, to give onward = $494.50', 'where the money stands, in the order it moves: ' + wf.join(' | '));
  ok(await pg.evaluate(() => document.querySelector('#gv-water .gvw').classList.contains('due')), 'the zakat line marked while some is owed');
  const gl = await pg.evaluate(() => [...document.querySelectorAll('#gv-given .mdrow')].map(r => r.querySelector('.t b').textContent + ' / ' + r.querySelector('.t span').textContent));
  ok(gl.length === 2 && gl[0] === '$3.00 · Zakat / ' + day(-3) + ' · The local food bank ' + XSS && gl[1] === '$20.00 · Onward / ' + day(-10), 'what he has given, its note shown as text: ' + gl[0]);
  ok(await pg.evaluate(() => document.querySelectorAll('#gv-months tbody tr').length) === 2 && await tc(pg, '#gv-total') === 'All time: $620.00 received across 58 payments, $21.00 in Stripe fees, $599.00 net.', 'month by month, and all time');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#gv-recent .row')].map(r => r.querySelector('.t b').textContent).join(',')) === '$25,$10 EUR' && await pg.evaluate(() => !document.querySelector('#gv-recent a')), 'the recent gifts, an address never a link');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#gv-wall p')].map(p => p.textContent).join(' | ')) === 'O Allah, have mercy on my mother. | ' + XSS, 'the du\'as on the wall, as text');
  const links = await pg.evaluate(() => [...document.querySelectorAll('#gv-links a')].map(a => a.getAttribute('href') + ' ' + a.getAttribute('rel')));
  ok(links.join(' | ') === 'https://dashboard.stripe.com/payments noopener noreferrer | https://dashboard.stripe.com/subscriptions noopener noreferrer | /donate noopener', 'Stripe\'s own pages and the giving page: ' + links.join(' | '));
  ok(await pg.evaluate(() => !document.querySelector('#s-giving img, #s-giving b b') && !window.__xss), 'markup in every field stays text');
  let sh = await shortTaps(pg, '#s-giving');
  ok(sh.length === 0 && await noSideScroll(pg), 'every control 44 px or more, nothing sideways (the table scrolls in its own box): ' + sh.join(', '));
  ok(await pg.evaluate(() => { const t = document.getElementById('gv-months'); return getComputedStyle(t).overflowX === 'auto'; }), 'the table scrolls inside its box');
  ok(!SOUL.test(await allWords(pg, '#s-giving')) && !DASH.test(await text(pg, '#s-giving')), 'no "soul" and no dash');
  await pg.screenshot({ path: SHOTS + '/giving-' + tag + '.png', fullPage: true });
  /* recording: a wrong amount is said in place; a right one posts exactly */
  await pg.fill('#gv-amount', 'twelve');
  let n0 = st.posted.length;
  await pg.click('#gv-form button[type="submit"]'); await pg.waitForTimeout(200);
  ok(st.posted.length === n0 && await tc(pg, '#gv-msg') === 'Write the amount the way you would say it, for example 25 or 25.50.' && await pg.evaluate(() => document.getElementById('gv-msg').classList.contains('bad')), 'a wrong amount is said in place, nothing posted');
  await pg.fill('#gv-amount', '$1,250.75'); await pg.selectOption('#gv-kind', 'zakat'); await pg.fill('#gv-note', 'The masjid\'s food drive'); await pg.fill('#gv-date', day(-1));
  const sent = await press(pg, st, '#gv-form button[type="submit"]');
  ok(JSON.stringify(sent.map(x => [x.method, x.url, x.body])) === JSON.stringify([['POST', '/api/ledger', { kind: 'zakat', amountMinor: 125075, note: 'The masjid\'s food drive', date: day(-1) }]]), 'Record it posts exactly the record, in minor units: ' + JSON.stringify(sent.map(x => x.body)));
  ok(await toastSays(pg) === 'Recorded: $1,250.75 to Zakat.' && await tc(pg, '#gv-owe') === '$0.00' && await pg.evaluate(() => document.getElementById('gv-owed').classList.contains('clear')), 'the house says so, and what is owed comes down: ' + await tc(pg, '#gv-owe'));
  ok(await pg.evaluate(() => document.getElementById('gv-amount').value === '' && document.getElementById('gv-note').value === '' && document.querySelectorAll('#gv-given .mdrow').length === 3), 'the form is ready for the next, the record in the list');
  /* taking a record back asks first, in its row */
  await pg.click('#gv-given [data-gvrm="0"]'); await pg.waitForTimeout(150);
  const q = await pg.evaluate(() => ({ p: (document.querySelector('#gv-given .hcf p') || {}).textContent, f: document.activeElement.textContent }));
  ok(q.p === 'Take this record back? What is still owed goes back up by $1,250.75 if it was zakat.' && q.f === 'Yes, take it back' && st.posted.length === n0 + 1, 'Take back asks first, in the row: ' + q.p);
  await pg.click('#gv-given [data-gvrmno]'); await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => !document.querySelector('#gv-given .hcf') && document.activeElement.textContent === 'Take back'), 'Never mind puts it back, under the finger');
  await pg.click('#gv-given [data-gvrm="0"]'); await pg.waitForTimeout(150);
  const del = await press(pg, st, '#gv-given [data-gvrmyes]');
  ok(JSON.stringify(del.map(x => [x.method, x.url, x.body])) === JSON.stringify([['DELETE', '/api/ledger', { id: 'g11' }]]) && await tc(pg, '#gv-owe') === '$12.50' && await toastSays(pg) === 'Taken back. The ledger is as it was before it.', 'Yes takes it back with exactly its id, and the number goes back up');
  /* a refusal stays in place, in plain words */
  st.ledgerRefuse = true;
  await pg.fill('#gv-amount', '5');
  await press(pg, st, '#gv-form button[type="submit"]');
  ok(await tc(pg, '#gv-msg') === 'The store is not connected, so this cannot be kept yet.' && await pg.evaluate(() => document.getElementById('gv-amount').value === '5'), 'a refusal is said in place, what he typed kept');
  st.ledgerRefuse = false;
  ok(st.errors.length === 0 && st.dialogs === 0, 'no console error, no dialog: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

console.log('\n390x844 · Giving: from More, before Stripe, when the ledger cannot be read; an old link to /admin#giving opens it here');
{
  let o = await open_(390, 844);
  await o.pg.click('nav.bar [data-s="more"]');
  await o.pg.waitForSelector('#s-more [data-room="giving"]', { timeout: 10000 });
  const hub = await o.pg.evaluate(() => { const c = document.querySelector('#s-more [data-room="giving"]'); return { order: [...document.querySelectorAll('#s-more [data-room]')].map(b => b.dataset.room).slice(0, 3).join(','), v: c.querySelector('.v').textContent, w: [...c.querySelectorAll('.w')].map(x => x.textContent) }; });
  ok(hub.order === 'engine,mail,giving' && hub.v === '$562' && hub.w[1] === '31 gifts in 30 days · the ledger', 'More has Giving after Mail, with its one live number: ' + JSON.stringify(hub));
  await o.pg.click('#s-more [data-room="giving"]');
  await o.pg.waitForSelector('#s-giving.on #gv-owed', { timeout: 8000 });
  ok(await text(o.pg, '#s-giving .back') === 'More', 'from More, its way back is More');
  await o.ctx.close();
  o = await open_(390, 844, { ledgerMode: 'stripe' });
  await o.pg.evaluate(() => { location.hash = '#giving'; }); await o.pg.waitForSelector('#s-giving.on #gv-setup', { timeout: 8000 });
  ok(/^The ledger reads Stripe\./.test(await tc(o.pg, '#gv-setup')) && /STRIPE_SECRET_KEY/.test(await tc(o.pg, '#gv-setup')) && await o.pg.evaluate(() => document.querySelectorAll('#gv-recent .row').length === 2), 'before Stripe: what it needs, and the gifts and the wall still shown');
  await o.ctx.close();
  o = await open_(390, 844, { ledgerMode: 'net' });
  await o.pg.evaluate(() => { location.hash = '#giving'; }); await o.pg.waitForSelector('#s-giving.on #gv-fail', { timeout: 8000 });
  ok(/The ledger could not be read just now\./.test(await tc(o.pg, '#gv-fail')) && await o.pg.evaluate(() => !!document.querySelector('#gv-fail [data-gvretry]')), 'a ledger that cannot be read says so, with Try again');
  await o.ctx.close();
  /* the card raised before this round still names the old console: it opens here */
  o = await open_(390, 844);
  const zl = await o.pg.evaluate(() => { const a = document.querySelector('#h-decide article.dc[data-did="d-zakat"] [data-dlink]'); return a ? { href: a.getAttribute('href'), target: a.getAttribute('target') } : null; });
  ok(zl && zl.href === '#giving' && zl.target === null, 'a card\'s old /admin#giving link is this console\'s Giving: ' + JSON.stringify(zl));
  await o.pg.click('#h-decide article.dc[data-did="d-zakat"] [data-dlink]');
  await o.pg.waitForSelector('#s-giving.on #gv-owed', { timeout: 8000 }); await o.pg.waitForTimeout(300);
  ok(await surfaceOn(o.pg) === 's-giving', 'and it opens there, never a new tab');
  ok(await sheetOn(o.pg) && /Here is what to do, in order\./.test(await tc(o.pg, '#sheet-in .sub')) && /12\.50 USD waits to be given/.test(await tc(o.pg, '#h-steps')), 'its steps open beside it, as for every card that has them');
  await o.pg.click('#sheet-in #cl'); await o.pg.waitForTimeout(300);
  await o.pg.click('#s-giving .back'); await o.pg.waitForSelector('#s-home.on', { timeout: 5000 }); await o.pg.waitForTimeout(300);
  const il = await o.pg.evaluate(() => { const a = document.querySelector('#h-decide article.dc[data-did="d-old-inbox"] [data-dlink]'); return a ? a.getAttribute('href') : null; });
  ok(il === '#inbox', 'an old /admin#inbox link is this console\'s Readers\' inbox: ' + il);
  await o.pg.click('#h-decide article.dc[data-did="d-old-inbox"] [data-dlink]');
  await o.pg.waitForSelector('#s-readers.on', { timeout: 8000 });
  ok(await surfaceOn(o.pg) === 's-readers', 'and opens it');
  const html = readFileSync(new URL('../admin2.html', import.meta.url), 'utf8');
  ok(!/href=["']\/admin(?:\.html)?(?:#[a-z]*)?["']/.test(html) && !/full console/i.test(html), 'no link in the console leads to the retired console');
  const vj = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  ok(vj.redirects.some(r => r.source === '/admin' && r.destination === '/admin2') && vj.redirects.some(r => r.source === '/admin.html' && r.destination === '/admin2'), 'the old address itself leads here');
  ok(o.st.errors.length === 0, 'no console error: ' + o.st.errors.slice(0, 3).join(' | '));
  await o.ctx.close();
}

/* ============================================================ the readers' inbox, with its own buttons */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · the readers\' inbox: New first, read when opened, Done, Back to read, Delete after asking');
  const { pg, st, ctx } = await open_(w, h);
  await goMore(pg, 'readers');
  await pg.waitForSelector('#s-readers.on #rd-list', { timeout: 8000 }); await pg.waitForTimeout(200);
  const chips = await pg.evaluate(() => [...document.querySelectorAll('#rd-fil [data-rdf]')].map(b => b.dataset.rdf + ':' + b.textContent + ':' + b.getAttribute('aria-pressed')).join(' | '));
  ok(chips === 'new:New2:true | read:Read1:false | done:Done1:false | all:All4:false', 'the inbox opens on New, each filter with its count: ' + chips);
  const rows = await pg.evaluate(() => [...document.querySelectorAll('#rd-list [data-msg]')].map(r => r.querySelector('.t b').textContent + ' / ' + r.querySelector('.pill').textContent));
  ok(rows.join(' | ') === 'reader@example.org / new | a reader / new', 'the new ones: ' + rows.join(' | '));
  let sh = await shortTaps(pg, '#s-readers');
  ok(sh.length === 0 && await noSideScroll(pg), 'every control 44 px or more, nothing sideways: ' + sh.join(', '));
  await pg.screenshot({ path: SHOTS + '/readers-' + tag + '.png', fullPage: true });
  /* opened, a new message is read: one quiet PATCH */
  let n0 = st.posted.length;
  await pg.click('#rd-list [data-msg="0"]');
  await until(() => st.posted.length > n0); await pg.waitForTimeout(400);
  ok(JSON.stringify(st.posted.slice(n0).map(x => [x.method, x.url, x.body])) === JSON.stringify([['PATCH', '/api/inbox', { id: 'm1', status: 'read' }]]), 'opening a new message marks it read, once: ' + JSON.stringify(st.posted.slice(n0).map(x => x.body)));
  const s1 = await pg.evaluate(() => ({ h: document.querySelector('#rd-sheet h2').textContent, sub: document.querySelector('#rd-sheet .sub').textContent, body: document.getElementById('rd-body').textContent, pill: document.querySelector('#rd-sheet .tags .pill').textContent,
    acts: [...document.querySelectorAll('#rd-sheet .acts > *')].map(b => b.textContent + (b.tagName === 'A' ? '@' + b.getAttribute('href').split('?')[0] : '')).join(',') }));
  ok(s1.h === 'reader@example.org' && s1.sub === '/quran · GB · ' + s1.sub.split(' · ').pop() && s1.body === 'The verse number on the page is off by one. ' + BOLD && s1.pill === 'read', 'its sheet: who, where, the whole message as text, now read: ' + s1.sub);
  ok(s1.acts === 'Reply by mail@mailto:reader@example.org,Done,Delete,Close', 'Reply by mail, Done, Delete, Close: ' + s1.acts);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#rd-fil [data-rdf]')].map(b => b.textContent).join(',')) === 'New1,Read2,Done1,All4', 'the room behind it counts it read already');
  sh = await shortTaps(pg, '#sheet-in');
  ok(sh.length === 0, 'the sheet: every control 44 px or more: ' + sh.join(', '));
  await pg.screenshot({ path: SHOTS + '/readers-sheet-' + tag + '.png' });
  /* Done */
  n0 = st.posted.length;
  await pg.click('#sheet-in [data-ibst="done"]'); await until(() => st.posted.length > n0); await pg.waitForTimeout(500);
  ok(JSON.stringify(st.posted.slice(n0).map(x => x.body)) === JSON.stringify([{ id: 'm1', status: 'done' }]) && await toastSays(pg) === 'Done. It moves to Done.' && !(await sheetOn(pg)), 'Done marks it done, says so, and the sheet closes');
  /* Back to read, on a done message */
  await pg.click('#rd-fil [data-rdf="done"]'); await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#rd-list [data-msg]')].map(r => r.dataset.msg).join(',')) === '0,3', 'Done holds the one just done and the one done before');
  await pg.click('#rd-list [data-msg="3"]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#rd-sheet .acts > *')].map(b => b.textContent).join(',')) === 'Back to read,Delete,Close', 'a done message offers Back to read');
  n0 = st.posted.length;
  await pg.click('#sheet-in [data-ibst="read"]'); await until(() => st.posted.length > n0); await pg.waitForTimeout(500);
  ok(JSON.stringify(st.posted.slice(n0).map(x => x.body)) === JSON.stringify([{ id: 'm4', status: 'read' }]), 'Back to read posts exactly that');
  /* Delete asks first */
  await pg.click('#rd-fil [data-rdf="all"]'); await pg.waitForTimeout(150);
  await pg.click('#rd-list [data-msg="3"]'); await pg.waitForTimeout(300);
  n0 = st.posted.length;
  await pg.click('#sheet-in [data-ibdel]'); await pg.waitForTimeout(150);
  ok(await tc(pg, '#rd-sheet .hcf p') === 'Delete this message for good? It cannot be brought back.' && await pg.evaluate(() => document.activeElement.textContent) === 'Yes, delete it' && st.posted.length === n0, 'Delete asks first, nothing posted yet');
  await pg.click('#sheet-in [data-ibdelno]'); await pg.waitForTimeout(150);
  ok(await pg.evaluate(() => !document.querySelector('#rd-sheet .hcf') && document.activeElement.textContent === 'Delete'), 'Never mind puts it back');
  await pg.click('#sheet-in [data-ibdel]'); await pg.waitForTimeout(150);
  await pg.click('#sheet-in [data-ibdelyes]'); await until(() => st.posted.length > n0); await pg.waitForTimeout(500);
  ok(JSON.stringify(st.posted.slice(n0).map(x => x.body)) === JSON.stringify([{ id: 'm4', delete: true }]) && await toastSays(pg) === 'Deleted.' && await pg.evaluate(() => document.querySelectorAll('#rd-list [data-msg]').length === 3), 'Yes deletes exactly it, and it is gone');
  /* the journal's replies, as before */
  n0 = st.posted.length;
  await pg.click('#s-readers [data-rel="e1|c9"]'); await until(() => st.posted.length > n0); await pg.waitForTimeout(400);
  ok(st.posted.slice(n0).some(x => x.url.startsWith('/api/journal') && x.body.action === 'comment-state' && x.body.state === 'approve'), 'Release still releases a journal reply');
  ok(!SOUL.test(await allWords(pg, '#s-readers')) && !DASH.test(await text(pg, '#s-readers')), 'no "soul" and no dash');
  ok(await pg.evaluate(() => !document.querySelector('#s-readers img') && !window.__xss), 'markup stays text');
  ok(st.errors.length === 0 && st.dialogs === 0, 'no console error, no browser dialog: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
