/* NOOR · the Lantern's mail in the console (LANTERN.md section 11.4).
   ------------------------------------------------------------------
   The Lantern runs the house's inbox and writes to places for the owner;
   the console shows him what it does and lets him hold it. This drives
   admin2.html against a stub of exactly the contract the server is built
   to, from a stub that remembers what was posted to it:

     Home's `mail` part, in every state (on, switched off, no mailbox, the
       part missing, a house that has no mail part yet);
     a decision carrying a `letter`: the whole email shown as text, Send
       asking first inside its card, the bodies posted for Send, Not this
       one and Later, the card folding away, and the sent email arriving in
       Done with no Undo and its door to Gmail;
     the Mail room (#mail, in More after the engine room): the switch and
       its confirm, the caps, the three tabs (Inbox, Places, Do not contact)
       with their filters and sheets, adding to and removing from do not
       contact;
     and the rules: markup in every field is shown as text, only https and
     console links are drawn (with no referrer), an address never reaches a
     URL, no "soul", no dash, every tap target 44 px, nothing sideways at
     390 px, reduced motion respected, no script error.

   Screenshots land in /tmp/qa/mail/ for a person to look at.

   Run:  python3 /tmp/vercelish.py 8263 <the repo root> &   node tests/console-mail.mjs
   (NOOR_BASE overrides the address; CHROMIUM_PATH the browser; MAIL_SHOTS
   where the screenshots go.)
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8263';
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.MAIL_SHOTS || '/tmp/qa/mail';
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
const hist = (n, a, b) => Array.from({ length: n }, (_, i) => ({ date: new Date(NOW - (n - 1 - i) * D).toISOString().slice(0, 10), value: Math.round(a + (b - a) * i / (n - 1)) }));
/* markup a correspondent, a page or a model could put in any field: it must arrive as text */
const XSS = '<img src=x onerror="window.__xss=1">';
const BOLD = '<b>bold</b>';
const GMAIL = 'https://mail.google.com/mail/u/0/#sent/18c2f0a9e1';

/* ---------------------------------------------------------------- the contract, LANTERN.md 11.4 */
const LETTER1 = { to: 'info@alnoor.example', toName: 'Al Noor Islamic Centre', subject: 'Free printables for your weekend school', kind: 'outreach',
  text: 'Assalamu alaykum,\n\nWe are NOOR Codex of Light, a free library of the Quran, the Names and the Prophets, with no advertisement and no tracker.\n\nYour weekend school teaches children from 7 to 12. Our printables (a page a day on the Names of Allah) are free for your classes, and we would be glad to send them.\n\nIf you would rather not hear from us, a short reply of "no thanks" is enough and you will not hear from us again.\n\nWith peace,\nNOOR Codex of Light' };
const LETTERS = () => [
  { id: 'd-letter-1', kind: 'approve', title: 'A letter to the Al Noor Islamic Centre, Toronto', why: 'Its weekend school teaches 120 children, and the library\'s printables fit its classes.', goal: 'g-outreach', impact: 'A first collaboration in Canada',
    options: [{ id: 'send', label: 'Send', style: 'primary', confirm: null }, { id: 'no', label: 'Not this one', style: 'plain', confirm: null }, { id: 'later', label: 'Later', style: 'plain', confirm: null }],
    link: null, steps: [], at: iso(NOW - 2 * H), expires: null, draft: null, letter: LETTER1 },
  { id: 'd-letter-2', kind: 'approve', title: 'A reply to ' + XSS, why: 'A reader wrote ' + BOLD + ' to the house.', goal: null, impact: null,
    options: [{ id: 'send', style: 'primary' }, { id: 'no' }, { id: 'later' }],
    link: null, steps: [], at: iso(NOW - 3 * H), expires: null, draft: null,
    letter: { to: 'reader' + XSS + '@example.org', toName: XSS, subject: 'Re: ' + BOLD, text: 'First line ' + BOLD + '\nSecond line ' + XSS + '\n\nNOOR Codex of Light', kind: 'reply' } },
  { id: 'd-letter-3', kind: 'approve', title: 'A follow-up to the Leeds Islamic Society', why: 'It has not answered in 8 days; one follow-up, then never again.', goal: 'g-outreach', impact: null,
    options: [{ id: 'send', label: 'Send', style: 'primary', confirm: null }, { id: 'no', label: 'Not this one', style: 'plain', confirm: null }, { id: 'later', label: 'Later', style: 'plain', confirm: null }],
    link: null, steps: [], at: iso(NOW - 5 * H), expires: null, draft: null,
    letter: { to: 'contact@leedsisoc.example', toName: 'Leeds Islamic Society', subject: 'Re: The library for your study circles', text: 'Assalamu alaykum,\n\nA short note after our letter of last week.\n\nWith peace,\nNOOR Codex of Light', kind: 'followup' } }];
const SETUP = { id: 'mail-setup', kind: 'you', title: 'Give the Lantern its mailbox', why: 'It needs the Gmail app password to read and write for you: about five minutes.', goal: null, impact: null,
  options: [{ id: 'done', label: 'Done', style: 'primary', confirm: null }, { id: 'later', label: 'Later', style: 'plain', confirm: null }],
  link: { href: 'https://noorcodex.com/guide/mail', label: 'Open the guide' },
  steps: ['Open the security page of the Google account.', 'Create an app password named NOOR.', 'Paste it into Vercel as GMAIL_APP_PASSWORD.', 'Press Done here.'], at: iso(NOW - 1 * H), expires: null, draft: null };
const DONE = () => [
  { id: 'x-mail-1', at: iso(NOW - 1 * H), title: 'Wrote to the Al Noor Islamic Centre, Toronto: a free library for its weekend school', detail: null, goal: 'g-outreach', by: 'lantern', ok: true, undo: false, actionId: 'act-m1', link: { href: GMAIL, label: 'Open in Gmail' } },
  { id: 'x-mail-2', at: iso(NOW - 2 * H), title: 'Answered ' + XSS, detail: BOLD, goal: null, by: 'lantern', ok: true, undo: false, actionId: 'act-m2', link: 'javascript:alert(1)' },
  { id: 'x-mail-3', at: iso(NOW - 3 * H), title: 'Wrote to a mosque in Leeds', detail: null, goal: null, by: 'lantern', ok: true, undo: false, actionId: 'act-m3', link: { href: 'http://mail.google.com/mail/u/0/#sent/1' } },
  { id: 'x-mail-4', at: iso(NOW - 4 * H), title: 'Answered a reader in Dublin', detail: null, goal: null, by: 'lantern', ok: true, undo: false, actionId: 'act-m4', link: { href: 'mailto:reader@example.org' } },
  { id: 'x-mail-5', at: iso(NOW - 5 * H), title: 'Filed a newsletter', detail: null, goal: null, by: 'lantern', ok: true, undo: false, actionId: 'act-m5', link: { href: 'data:text/html,hello' } },
  { id: 'x-mail-6', at: iso(NOW - 6 * H), title: 'Sorted the morning\'s mail', detail: null, goal: null, by: 'lantern', ok: true, undo: false, actionId: null, link: { href: '#mail', label: 'See the inbox' } }];
const GOALS = () => [
  { id: 'g-reach', owner: 'owner', outcome: 'Double the people reached each week by 25 December', metric: 'northStar', unit: 'people', baseline: 15600, current: 31240, target: 62400, due: '2026-12-25', status: 'behind', projected: 48900, eta: null, note: null, focus: null, history: hist(20, 21000, 31240) },
  { id: 'g-outreach', owner: 'owner', outcome: 'At least 50 places invited to work together, helpfully and respectfully, within 6 weeks', metric: 'outreach.contacted', unit: 'places', baseline: 0, current: 24, target: 50, due: day(30), status: 'on-track', projected: 52, eta: day(25), note: null, focus: 'Ten letters a day at most, the most useful places first.', history: hist(10, 0, 24) }];
const MAIL_ON = () => ({ configured: true, on: true, firstTen: { sent: 3, of: 10 }, today: { received: 14, answered: 6, filed: 5, forYou: 2, sent: 4 },
  outreach: { places: 132, contacted: 24, replied: 3, working: 1, target: 50 },
  last: [{ at: iso(NOW - 26 * H), title: 'Found 20 new places in Ireland and New Zealand' },
    { at: iso(NOW - 1 * H), title: 'Wrote to the Al Noor Islamic Centre, Toronto: a free library for its weekend school' },
    { at: iso(NOW - 3 * H), title: 'Answered a question on the night prayer, with the library\'s page' },
    { at: iso(NOW - 2 * H), title: 'Filed ' + XSS }] });
const MAIL_NONE = () => ({ configured: false, on: false, firstTen: { sent: 0, of: 10 }, today: null, outreach: null, last: [] });
const HOME = (o = {}) => ({
  ok: true, now: iso(NOW), name: 'the Lantern', paused: false, status: 'needs-you',
  brief: null,
  decisions: LETTERS(),
  done: DONE(),
  next: [], coming: [], goals: GOALS(), ideas: [],
  today: { posts: { sent: 6, due: 6, failed: 0 }, fixed: 0, reach7: { value: 31240, delta: 1204 }, slots: [] },
  voice: { telegram: { linked: true } }, spend: { usd: 3.42, capUsd: 10 }, giving: null, missing: { giving: 'not configured' },
  mail: MAIL_ON(), ...o });
/* GET /api/soul?view=mail */
const PLACES = () => [
  { id: 'p1', name: 'Al Noor Islamic Centre', kind: 'mosque', city: 'Toronto', country: 'Canada', website: 'https://alnoor.example', email: 'info@alnoor.example', source: 'osm', evidence: 'https://alnoor.example/contact', score: 0.92, status: 'written',
    history: [{ at: iso(NOW - 3 * D), what: 'Found on OpenStreetMap, with its own contact page' }, { at: iso(NOW - 1 * H), what: 'Wrote: a free library for its weekend school' }] },
  { id: 'p2', name: 'Leeds Islamic Society', kind: 'student society', city: 'Leeds', country: 'United Kingdom', website: 'https://leedsisoc.example', email: 'contact@leedsisoc.example', source: 'wikidata', evidence: 'https://leedsisoc.example/about', score: 0.8, status: 'replied',
    history: [{ at: iso(NOW - 9 * D), what: 'Wrote: the library for its study circles' }, { at: iso(NOW - 2 * D), what: 'They answered, and asked for the printables' }] },
  { id: 'p3', name: 'Masjid As Salam', kind: 'mosque', city: 'Dublin', country: 'Ireland', website: 'http://insecure.example', email: '', source: 'website', evidence: 'javascript:alert(1)', score: 0.6, status: 'new', history: [] },
  { id: 'p4', name: XSS + BOLD, kind: XSS, city: XSS, country: 'Australia', website: 'https://ok.example', email: XSS, source: XSS, evidence: 'https://ok.example/page', score: 0.5, status: 'working', history: [{ at: iso(NOW - 2 * D), what: XSS + BOLD }] },
  { id: 'p5', name: 'Cape Town Madrasah', kind: 'school', city: 'Cape Town', country: 'South Africa', website: 'https://ctm.example', email: 'office@ctm.example', source: 'search', evidence: 'https://ctm.example/contact', score: 0.7, status: 'declined',
    history: [{ at: iso(NOW - 1 * D), what: 'Said no thanks; added to do not contact' }] },
  { id: 'p6', name: 'Auckland Muslim Youth', kind: 'youth group', city: 'Auckland', country: 'New Zealand', website: 'https://amy.example', email: 'hello@amy.example', source: 'osm', evidence: 'https://amy.example', score: 0.65, status: 'followed', history: [] },
  { id: 'p7', name: 'Brooklyn Weekend School', kind: 'weekend school', city: 'New York', country: 'United States', website: 'https://bws.example', email: 'info@bws.example', source: 'website', evidence: 'https://bws.example/contact', score: 0.75, status: 'new', history: [] },
  { id: 'p8', name: 'Toronto Muslim Students', kind: 'student society', city: 'Toronto', country: 'Canada', website: 'https://tms.example', email: 'board@tms.example', source: 'wikidata', evidence: 'https://tms.example/contact', score: 0.55, status: 'dnc', history: [{ at: iso(NOW - 4 * D), what: 'Asked not to be written to again' }] }];
const THREADS = () => [
  { id: 't1', at: iso(NOW - 1 * H), from: 'aisha.reader@example.org', fromName: 'Aisha', subject: 'A question about the night prayer', kind: 'question', action: 'answered',
    summary: 'She asked how the night prayer is prayed; the Lantern answered from the library\'s page on it, with the link.',
    reply: { at: iso(NOW - 50 * 60e3), text: 'Wa alaykum assalam Aisha,\n\nThank you for writing. The library\'s page on the night prayer gathers what the scholars say:\nhttps://noorcodex.com/prayer#qiyam\n\nWith peace,\nNOOR Codex of Light' } },
  { id: 't2', at: iso(NOW - 2 * H), from: 'desk@paper.example', fromName: 'A newspaper', subject: 'An interview about the library', kind: 'press', action: 'for-you', summary: 'A journalist asks for a short interview about the library.', reply: null },
  { id: 't3', at: iso(NOW - 3 * H), from: 'news@platform.example', fromName: 'A platform', subject: 'Your weekly digest', kind: 'newsletter', action: 'filed', summary: 'A newsletter, filed.', reply: null },
  { id: 't4', at: iso(NOW - 4 * H), from: 'imam@masjid.example', fromName: 'The imam of a masjid', subject: 'Re: Free printables', kind: 'outreach_answer', action: 'waiting', summary: 'He thanks the house and asks which printables suit ages 7 to 10.', reply: null },
  { id: 't5', at: iso(NOW - 5 * H), from: XSS, fromName: XSS, subject: XSS + BOLD, kind: XSS, action: 'answered', summary: XSS + '\n' + BOLD, reply: { at: iso(NOW - 4 * H), text: 'Reply line ' + BOLD + '\n' + XSS } }];
const MAILV = (o = {}) => ({ ok: true,
  mail: { configured: true, on: true, reason: null, caps: { outreach: 10, replies: 30, followups: 10, total: 50 }, firstTen: { sent: 3, of: 10 }, today: { received: 14, answered: 6, filed: 5, forYou: 2, sent: 4 } },
  threads: THREADS(), places: PLACES(), counts: { places: 132, contacted: 24, replied: 3, working: 1, declined: 2, dnc: 2 },
  dnc: [{ address: 'office@ctm.example', at: iso(NOW - 1 * D), why: 'They said no thanks' }, { address: 'spam.example', at: iso(NOW - 9 * D), why: XSS }],
  missing: {}, ...o });
/* every address in the fixtures: none of them may ever reach a URL */
const ADDRS = ['info@alnoor.example', 'contact@leedsisoc.example', 'office@ctm.example', 'hello@amy.example', 'info@bws.example', 'board@tms.example', 'aisha.reader@example.org', 'desk@paper.example',
  'news@platform.example', 'imam@masjid.example', 'someone@example.org', 'spam.example', 'reader@example.org'];

/* ---------------------------------------------------------------- the rest of the house, for More and its rooms */
const HOUSE = { store: true, storeKind: 'redis', lanternConfigured: true, lanternModel: 'x/inkling:free', moneyMode: 'quiet', weekly: 3, activeCount: 2, guardians: [], gifts: { total30d: 90, count30d: 3, monthly: 60, recent: [] } };
const SOUL_TODAY = { ok: true, paused: false, mission: 'Serve Allah.', northStar: { value: 31240, weekAgo: 30036, series: [] }, goals: [], lastCycle: null, spend: { month: '2026-10', usd: 3.42, capUsd: 10 }, counts: { actionsToday: 2, capToday: 6 }, telegram: { linked: true } };
const SAID = { 'mail-switch': b => b.on ? 'Mail is on: the Lantern reads and writes again.' : 'Mail is off. The Lantern keeps reading and writes nothing.',
  'dnc-add': b => 'Added: the Lantern never writes to ' + b.address + '.', 'dnc-remove': b => 'Taken off the list: ' + b.address + '.' };

/* ---------------------------------------------------------------- the page */
const until = async (f, ms = 6000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) return false; await new Promise(r => setTimeout(r, 25)); } return true; };
async function open_(w, h, opts = {}) {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, reducedMotion: opts.motion ? 'no-preference' : 'reduce' });
  const pg = await ctx.newPage();
  const st = { home: (opts.home || HOME)(), mailv: (opts.mailv || MAILV)(), posted: [], urls: [], homeGets: 0, mailGets: 0, errors: [], dialogs: 0, mailMode: opts.mailMode || 'ok', removeOnDecide: true, refuse: null };
  pg.on('pageerror', e => st.errors.push(String(e)));
  pg.on('console', m => { if (m.type() === 'error') st.errors.push(m.text()); });
  pg.on('dialog', d => { st.dialogs++; d.dismiss().catch(() => {}); });
  pg.on('response', r => { if (r.status() >= 400) st.errors.push(r.status() + ' ' + r.url()); });
  pg.on('request', q => st.urls.push(q.url()));
  const J = (b, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(b) });
  await ctx.route('**/*', async r => {
    const q = r.request(), u = q.url(), m = q.method();
    if (u.startsWith('https://noorcodex.com/') || u.startsWith('https://mail.google.com/') || /^https:\/\/[a-z]+\.example\//.test(u)) return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>away</title><p>away</p>' });
    if (u.includes('/api/soul')) {
      if (m === 'POST') {
        const b = JSON.parse(q.postData() || '{}'); st.posted.push({ url: u.replace(BASE, ''), body: b });
        if (st.refuse && b.action === st.refuse) return r.fulfill(J({ ok: false, message: 'The house would not do that just now.' }));
        if (b.action === 'decide') {
          const d = (st.home.decisions || []).find(x => x.id === b.id);
          if (st.removeOnDecide) st.home.decisions = (st.home.decisions || []).filter(x => x.id !== b.id);
          if (d && d.letter && b.option === 'send') {
            st.home.done = [{ id: 'x-' + b.id, at: iso(Date.now()), title: 'Wrote to ' + d.letter.toName, detail: d.letter.subject, goal: d.goal, by: 'owner', ok: true, undo: false, actionId: 'act-' + b.id, link: { href: GMAIL + b.id, label: 'Open in Gmail' } }, ...st.home.done];
            st.home.mail.firstTen.sent++; st.home.mail.today.sent++;
            return r.fulfill(J({ ok: true, executed: true, actionId: 'act-' + b.id, message: 'Sent to ' + d.letter.toName + ', from salam@noorcodex.com.' }));
          }
          return r.fulfill(J({ ok: true, message: b.option === 'no' ? 'Not sent. The Lantern keeps what you did not want as a lesson.' : b.option === 'later' ? 'It waits three days.' : 'Done.' }));
        }
        if (b.action === 'mail-switch') { st.mailv.mail.on = !!b.on; if (st.home.mail) st.home.mail.on = !!b.on; return r.fulfill(J({ ok: true, message: SAID['mail-switch'](b) })); }
        if (b.action === 'dnc-add') { st.mailv.dnc = [{ address: b.address, at: iso(Date.now()), why: 'Added by you' }, ...st.mailv.dnc.filter(x => x.address !== b.address)]; st.mailv.counts.dnc = st.mailv.dnc.length; return r.fulfill(J({ ok: true, message: SAID['dnc-add'](b) })); }
        if (b.action === 'dnc-remove') { st.mailv.dnc = st.mailv.dnc.filter(x => x.address !== b.address); st.mailv.counts.dnc = st.mailv.dnc.length; return r.fulfill(J({ ok: true, message: SAID['dnc-remove'](b) })); }
        return r.fulfill(J({ ok: true, message: 'Done.' }));
      }
      const view = new URL(u).searchParams.get('view');
      if (view === 'home') { st.homeGets++; return r.fulfill(J({ ...st.home, now: iso(Date.now()) })); }
      if (view === 'mail') {
        st.mailGets++;
        if (st.mailMode === 'net') return r.abort('connectionfailed');
        return r.fulfill(J(st.mailv));
      }
      if (view === 'today') return r.fulfill(J(SOUL_TODAY));
      return r.fulfill(J({ ok: true, items: [] }));
    }
    if (u.includes('/api/social')) {
      if (u.includes('action=dials')) return r.fulfill(J({ ok: true, dials: { mode: 'auto' }, channels: [] }));
      return r.fulfill(J({ ok: true }));
    }
    if (u.includes('/api/admin-data?probe=lights')) return r.fulfill(J({ probe: 'lights', today: null, index: { n: 421, months: {}, kinds: {} }, lib: { n: 421 }, doubts: [] }));
    if (u.includes('/api/admin-data?probe=night')) return r.fulfill(J({ probe: 'night', brief: null, findings: [], last: null, perNight: 40 }));
    if (u.includes('/api/admin-data')) return r.fulfill(J(HOUSE));
    if (u.includes('/api/journal') && m === 'POST') return r.fulfill(J({ queue: [] }));
    if (u.includes('/api/journal')) return r.fulfill(J({ ok: true, entries: [] }));
    if (u.includes('/api/inbox')) return r.fulfill(J({ ok: true, counts: { new: 0 }, items: [] }));
    if (u.includes('/api/settings')) return r.fulfill(J({ store: true, dials: [] }));
    if (u.includes('/api/')) return r.fulfill(J({ ok: true }));
    if (u.startsWith(BASE)) return r.continue();
    if (u.includes('fonts.g')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.abort();
  });
  await pg.goto(BASE + '/admin2.html' + (opts.hash || ''), { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#app.on', { timeout: 15000 });
  if (!opts.hash) await pg.waitForSelector('#s-home.on #h-decide .hsec .cnt, #s-home.on #h-decide .hfail', { timeout: 15000 });
  await pg.waitForTimeout(opts.settle != null ? opts.settle : 300);
  return { pg, st, ctx };
}
const text = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const tc = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent : ''; }, sel);
const toastSays = pg => pg.evaluate(() => { const t = document.getElementById('toast'); return t.firstChild ? t.firstChild.textContent : ''; });
const noSideScroll = pg => pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const surfaceOn = pg => pg.evaluate(() => (document.querySelector('.surf.on') || {}).id);
const allWords = (pg, scope) => pg.evaluate(s => [document.querySelector(s).innerText, ...[...document.querySelectorAll(s + ' [title], ' + s + ' [aria-label], ' + s + ' [placeholder]')].map(e => [e.getAttribute('title'), e.getAttribute('aria-label'), e.getAttribute('placeholder')].filter(Boolean).join(' '))].join('\n'), scope);
/* every visible control a thumb must hit, under 44 px tall */
const shortTaps = (pg, scope) => pg.evaluate(s => [...document.querySelectorAll(s + ' button, ' + s + ' a, ' + s + ' select, ' + s + ' input, ' + s + ' [role="switch"]')]
  .filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden')
  .filter(b => b.getBoundingClientRect().height < 43.5).map(b => (b.textContent || b.getAttribute('aria-label') || b.tagName).trim().slice(0, 30) + ':' + Math.round(b.getBoundingClientRect().height)), scope);
const card = (pg, id) => pg.locator('#h-decide article.dc[data-did="' + id + '"]');
async function press(pg, st, loc) {
  const before = st.posted.length;
  await loc.click();
  await until(() => st.posted.length > before);
  await pg.waitForTimeout(450);
  return { sent: st.posted.slice(before), toast: await toastSays(pg) };
}
/* a picture of one part, scrolled to the top of the screen under the bar */
async function shotOf(pg, sel, name) {
  await pg.evaluate(s => { const e = document.querySelector(s); if (e) { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); } }, sel);
  await pg.waitForTimeout(250);
  await pg.screenshot({ path: SHOTS + '/' + name + '.png' });
}
async function openMail(pg) {
  await pg.click('nav.bar [data-s="more"]');
  await pg.waitForSelector('#s-more [data-room="mail"]', { timeout: 10000 });
  await pg.click('#s-more [data-room="mail"]');
  await pg.waitForSelector('#s-mail.on #mail-tabs [data-mtab]', { timeout: 10000 });
  await pg.waitForTimeout(250);
}
const pickTab = async (pg, t) => { await pg.click('#mail-tabs [data-mtab="' + t + '"]'); await pg.waitForTimeout(150); };
const closeSheet = async pg => { await pg.click('#sheet-in #cl'); await pg.waitForTimeout(300); };

/* ============================================================ Home: the mail card, mail on */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · Home: the Lantern\'s mail, on');
  const { pg, st, ctx } = await open_(w, h);
  const c = await pg.evaluate(() => { const s = document.getElementById('h-mail'), r = s.getBoundingClientRect();
    const after = s.nextElementSibling;
    return { hidden: s.hidden, head: (s.querySelector('.hsec h2') || {}).textContent, zone: s.closest('.hz').id, prev: s.previousElementSibling && s.previousElementSibling.id, next: after && after.id, then: after && after.nextElementSibling && after.nextElementSibling.id,
      state: s.querySelector('#h-mail-state').textContent, stateCls: s.querySelector('#h-mail-state').className,
      nums: [...s.querySelectorAll('.mn')].map(n => n.querySelector('b').textContent + ' ' + n.querySelector('span').textContent),
      ten: s.querySelector('.mten p').textContent, pips: s.querySelectorAll('.pips i').length, lit: s.querySelectorAll('.pips i.on').length,
      out: s.querySelector('.mout p').textContent, ring: (s.querySelector('.mout svg .arc') || {}).getAttribute ? s.querySelector('.mout svg .arc').getAttribute('stroke') : null,
      last: [...s.querySelectorAll('.mlast .ml span')].map(x => x.textContent), door: !!s.querySelector('.go[data-mroom]') }; });
  ok(!c.hidden && c.head === "The Lantern's mail", 'Home carries "The Lantern\'s mail"');
  /* round four: the Telegram line (#h-voice) follows the mail, then the lamp */
  ok(w < 1200 ? (c.prev === 'h-done' && c.next === 'h-voice' && c.then === 'h-giving') : (c.zone === 'hz-b' && c.prev === 'h-done' && c.next === 'h-voice'), (w < 1200 ? 'on a phone it follows Done, before the Telegram line and the lamp' : 'on a desk it stands under Done, in the middle of the cockpit, the Telegram line under it') + ': ' + JSON.stringify([c.zone, c.prev, c.next, c.then]));
  ok(c.state === 'Mail is on: the Lantern reads and writes' && /good/.test(c.stateCls), 'it says mail is on: the Lantern reads and writes');
  ok(c.nums.join(' | ') === '14 received | 6 answered | 5 filed | 2 for you | 4 sent', "today's numbers: " + c.nums.join(' | '));
  ok(c.ten === '3 of the first 10 approved; then it writes on its own.' && c.pips === 10 && c.lit === 3, 'the first ten: ' + c.ten + ' (' + c.lit + ' of ' + c.pips + ' lit)');
  ok(/^24 of 50 places written to/.test(c.out) && /3 replied · 1 working together · 132 found/.test(c.out), 'the outreach toward fifty: ' + c.out);
  ok(c.ring === '#2E8C60', "its ring in the outreach goal's own colour (the second goal: emerald): " + c.ring);
  ok(c.last.length === 3 && c.last[0] === 'Wrote to the Al Noor Islamic Centre, Toronto: a free library for its weekend school' && c.last[2] === 'Answered a question on the night prayer, with the library\'s page',
    'the last three things it did, newest first: ' + c.last.join(' / '));
  ok(c.last[1] === 'Filed <img src=x onerror="window.__xss=1">' && await pg.evaluate(() => document.querySelectorAll('#h-mail img').length === 0), 'a title with markup in it is shown as text');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#h-mail .mn')].every(m => m.getBoundingClientRect().width > 40)) && await noSideScroll(pg), 'the numbers fit, and nothing scrolls sideways at ' + w + ' px');
  const sh = await shortTaps(pg, '#h-mail');
  ok(sh.length === 0, 'every control on the card is at least 44 px tall: ' + sh.join(', '));
  ok(!SOUL.test(await allWords(pg, '#h-mail')) && !DASH.test(await text(pg, '#h-mail')), 'no "soul" and no dash');
  await shotOf(pg, '#h-mail', 'home-mail-card-' + tag);
  await pg.click('#h-mail .go[data-mroom]');
  await pg.waitForSelector('#s-mail.on #mail-tabs [data-mtab]', { timeout: 8000 });
  ok((await surfaceOn(pg)) === 's-mail' && await pg.evaluate(() => location.hash) === '#mail' && await pg.evaluate(() => document.getElementById('title').textContent) === 'Mail', 'its door opens the Mail room, at #mail');
  ok(st.errors.length === 0 && st.dialogs === 0, 'no console error, no browser dialog: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ Home: the mail card in its other states */
console.log('\n390x844 · Home: mail switched off, no mailbox, the part missing, no mail part at all');
{
  /* switched off: it still reads, so the numbers stay */
  let o = await open_(390, 844, { home: () => HOME({ mail: { ...MAIL_ON(), on: false } }) });
  const off = await o.pg.evaluate(() => ({ state: document.getElementById('h-mail-state').textContent, cls: document.getElementById('h-mail-state').className, nums: document.querySelectorAll('#h-mail .mn').length }));
  ok(off.state === 'Mail is off: the Lantern reads, and writes nothing' && /wait/.test(off.cls) && off.nums === 5, 'switched off, it says so, and the day\'s numbers stay, since reading goes on');
  await shotOf(o.pg, '#h-mail', 'home-mail-off-390x844');
  ok(o.st.errors.length === 0, 'no console error');
  await o.ctx.close();

  /* no mailbox: the setup card's call to action and nothing else */
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    o = await open_(w, h, { home: () => HOME({ mail: MAIL_NONE(), decisions: [SETUP, ...LETTERS().slice(0, 1)] }) });
    const un = await o.pg.evaluate(() => { const s = document.getElementById('h-mail'), a = s.querySelector('a.btn');
      return { b: (s.querySelector('.hcalm b') || {}).textContent, span: (s.querySelector('.hcalm span') || {}).textContent, href: a && a.getAttribute('href'), target: a && a.getAttribute('target'), label: a && a.textContent.trim(),
        rest: s.querySelectorAll('.mn, .mten, .mout, .mlast, #h-mail-state').length, buttons: s.querySelectorAll('a, button').length }; });
    ok(un.b === 'Give the Lantern its mailbox' && /five minutes/.test(un.span) && un.href === 'https://noorcodex.com/guide/mail' && un.target === '_blank' && /Open the guide/.test(un.label),
       w + ' px, no mailbox: the card is the setup card\'s call to action: ' + JSON.stringify(un));
    ok(un.rest === 0 && un.buttons === 1, 'and nothing else: no numbers, no first ten, no outreach, no state');
    await shotOf(o.pg, '#h-mail', 'home-mail-setup-' + w + 'x' + h);
    if (w < 600) {
      const [popup] = await Promise.all([o.ctx.waitForEvent('page', { timeout: 8000 }), o.pg.click('#h-mail a.btn')]);
      await popup.close(); await o.pg.waitForTimeout(300);
      ok(await o.pg.evaluate(() => document.getElementById('sheet').classList.contains('on') && document.querySelectorAll('#h-steps li').length === 4), 'its guide opens in a new tab, and the four steps open beside it, as on the desk');
      ok(o.st.posted.length === 0, 'opening the guide posts nothing');
    }
    ok(o.st.errors.length === 0, 'no console error: ' + o.st.errors.slice(0, 2).join(' | '));
    await o.ctx.close();
  }

  /* the part missing: why, in the console's words, never the house's raw reason */
  o = await open_(390, 844, { home: () => HOME({ mail: null, missing: { giving: 'not configured', mail: 'nsoul:mail took longer than 6 seconds' } }) });
  const ms = await text(o.pg, '#h-mail');
  ok(/The Lantern's mail could not be read just now\./.test(ms) && /It took too long to answer\./.test(ms) && !/nsoul|6 seconds/.test(ms), 'the part missing: it says it could not be read, and why, in plain words: ' + ms.replace(/\s+/g, ' ').slice(0, 120));
  ok(await o.pg.evaluate(() => !!document.querySelector('#h-mail [data-mroom]')), 'with the door to the room still there');
  ok(o.st.errors.length === 0, 'no console error');
  await o.ctx.close();

  /* a house with no mail part yet: no card at all */
  o = await open_(390, 844, { home: () => { const x = HOME(); delete x.mail; return x; } });
  ok(await o.pg.evaluate(() => document.getElementById('h-mail').hidden && !document.getElementById('h-mail').getClientRects().length), 'a Home with no mail part draws no mail card');
  ok(o.st.errors.length === 0, 'no console error');
  await o.ctx.close();
}

/* ============================================================ the letter decision */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · a letter waits on the desk for one tap');
  const { pg, st, ctx } = await open_(w, h);
  const L = await pg.evaluate(() => { const c = document.querySelector('article.dc[data-did="d-letter-1"]'), l = c.querySelector('.ltr');
    return { cls: c.className, kind: c.querySelector('.k .pill').textContent, ten: (c.querySelector('.k .ften') || {}).textContent,
      rows: [...l.querySelectorAll('.lh')].map(r => r.querySelector('.lk').textContent + ': ' + r.querySelector('.lv').textContent.replace(/\s+/g, ' ').trim()),
      body: l.querySelector('.lt').textContent, ws: getComputedStyle(l.querySelector('.lt')).whiteSpace, lines: l.querySelector('.lt').getClientRects().length && Math.round(l.querySelector('.lt').getBoundingClientRect().height),
      btns: [...c.querySelectorAll('[data-dopt]')].map(b => b.textContent + ':' + b.className) }; });
  ok(/letter/.test(L.cls) && L.kind === 'A first letter' && L.ten === 'one of the first 10', 'the card says what it is: a first letter, one of the first ten: ' + L.kind + ' / ' + L.ten);
  ok(L.rows.join(' | ') === 'To: Al Noor Islamic Centre info@alnoor.example | From: NOOR Codex of Light salam@noorcodex.com | Subject: Free printables for your weekend school', 'to whom, from where, and the subject: ' + L.rows.join(' | '));
  ok(L.body === LETTER1.text && L.ws === 'pre-wrap', 'and the whole letter, word for word, its line breaks kept');
  ok(L.btns.join(',') === 'Send:btn,Not this one:btn ghost,Later:btn ghost', 'Send, Not this one and Later: ' + L.btns.join(','));
  await shotOf(pg, 'article.dc[data-did="d-letter-1"]', 'letter-' + tag);
  /* markup in every field of a letter is text */
  const X = await pg.evaluate(() => { const c = document.querySelector('article.dc[data-did="d-letter-2"]');
    return { imgs: c.querySelectorAll('img,b').length, title: c.querySelector('h3').textContent, to: c.querySelector('.lh .lv').textContent, sub: c.querySelectorAll('.lh .lv')[2].textContent, body: c.querySelector('.lt').textContent, kind: c.querySelector('.k .pill').textContent,
      btns: [...c.querySelectorAll('[data-dopt]')].map(b => b.textContent).join(',') }; });
  ok(X.imgs === 0 && X.title === 'A reply to <img src=x onerror="window.__xss=1">' && X.sub === 'Re: <b>bold</b>' && X.body === 'First line <b>bold</b>\nSecond line <img src=x onerror="window.__xss=1">\n\nNOOR Codex of Light' && /<img src=x/.test(X.to),
     'markup in its title, its addressee, its subject and its text is shown as text, never drawn: ' + X.sub);
  ok(X.kind === 'A reply' && X.btns === 'Send,Not this one,Later', 'a reply, its three buttons named even when the house sent no names: ' + X.btns);
  /* Send asks first, inside the card */
  const n0 = st.posted.length;
  await card(pg, 'd-letter-1').getByRole('button', { name: 'Send', exact: true }).click(); await pg.waitForTimeout(200);
  const q = await pg.evaluate(() => { const c = document.querySelector('article.dc[data-did="d-letter-1"] .hcf'); return c ? { t: c.innerText, yes: c.querySelector('[data-dyes]').textContent } : null; });
  ok(q && /Send this letter to Al Noor Islamic Centre now, from salam@noorcodex\.com\? An email cannot be taken back\./.test(q.t) && q.yes === 'Yes, send it' && st.posted.length === n0 && st.dialogs === 0,
     'Send asks first, inside its card, saying to whom and from where, posting nothing yet: ' + (q && q.t.replace(/\s+/g, ' ')));
  await pg.evaluate(() => { const q = document.querySelector('article.dc[data-did="d-letter-1"] .hcf'); q.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(250);
  await pg.screenshot({ path: SHOTS + '/letter-confirm-' + tag + '.png' });
  await pg.click('article.dc[data-did="d-letter-1"] [data-dno]'); await pg.waitForTimeout(150);
  ok(st.posted.length === n0 && await pg.evaluate(() => document.querySelectorAll('article.dc[data-did="d-letter-1"] [data-dopt]').length === 3), 'Never mind brings the buttons back and posts nothing');
  await card(pg, 'd-letter-1').getByRole('button', { name: 'Send', exact: true }).click(); await pg.waitForTimeout(150);
  let r = await press(pg, st, pg.locator('article.dc[data-did="d-letter-1"] [data-dyes]'));
  ok(r.sent.length === 1 && JSON.stringify(r.sent[0].body) === '{"action":"decide","id":"d-letter-1","option":"send"}' && r.sent[0].url === '/api/soul', 'Yes, send it posts {action:"decide", id, option:"send"}: ' + JSON.stringify(r.sent.map(x => x.body)));
  ok(r.toast === 'Sent to Al Noor Islamic Centre, from salam@noorcodex.com.', "the toast is the house's own words: " + r.toast);
  ok(await pg.evaluate(() => !document.querySelector('article.dc[data-did="d-letter-1"]')), 'and the letter leaves the desk');
  const dn = await pg.evaluate(() => { const row = document.querySelector('#h-done .hrow[data-dk="x-d-letter-1"]'); if (!row) return null; const a = row.querySelector('a');
    return { undo: !!row.querySelector('[data-undo]'), href: a && a.getAttribute('href'), target: a && a.getAttribute('target'), rel: a && a.getAttribute('rel'), label: a && a.textContent.trim(), h: a && a.getBoundingClientRect().height }; });
  ok(dn && !dn.undo && dn.href === 'https://mail.google.com/mail/u/0/#sent/18c2f0a9e1d-letter-1' && dn.target === '_blank' && dn.rel === 'noopener noreferrer' && /^Open in Gmail/.test(dn.label) && dn.h >= 44,
     'the sent email lands in Done with no Undo, and a door to it in Gmail (a new tab, no referrer): ' + JSON.stringify(dn));
  ok(await pg.evaluate(() => document.querySelector('#h-mail .mten p').textContent) === '4 of the first 10 approved; then it writes on its own.', 'and the first ten count one more');
  r = await press(pg, st, card(pg, 'd-letter-3').getByRole('button', { name: 'Not this one', exact: true }));
  ok(JSON.stringify(r.sent[0].body) === '{"action":"decide","id":"d-letter-3","option":"no"}', 'Not this one posts option "no", with no question: it sends nothing');
  r = await press(pg, st, card(pg, 'd-letter-2').getByRole('button', { name: 'Later', exact: true }));
  ok(JSON.stringify(r.sent[0].body) === '{"action":"decide","id":"d-letter-2","option":"later"}' && r.toast === 'It waits three days.', 'Later posts option "later"');
  ok(st.posted.every(p => p.url === '/api/soul'), 'every answer went to /api/soul and nowhere else');
  ok(await pg.evaluate(() => typeof window.__xss === 'undefined'), 'no markup ever ran');
  ok(await noSideScroll(pg), 'nothing scrolls sideways');
  ok(st.errors.length === 0 && st.dialogs === 0, 'no console error, no browser dialog: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ the letter, in motion */
console.log('\n390x844 · a sent letter moves like every answered card: it folds, a light travels to Done');
{
  const { pg, st, ctx } = await open_(390, 844, { motion: true });
  await pg.waitForTimeout(2200);
  await card(pg, 'd-letter-1').getByRole('button', { name: 'Send', exact: true }).click(); await pg.waitForTimeout(150);
  const before = st.posted.length;
  await pg.click('article.dc[data-did="d-letter-1"] [data-dyes]');
  await until(() => st.posted.length > before);
  await pg.waitForTimeout(120);
  const mid = await pg.evaluate(() => ({ fly: document.querySelectorAll('.hfly').length, fold: document.getAnimations().some(a => a.effect.target.matches && a.effect.target.matches('article.dc[data-did="d-letter-1"]')), fill: !!document.querySelector('article.dc[data-did="d-letter-1"] .bfill') }));
  ok(mid.fold && mid.fly === 1, 'the card folds away while a small light travels to Done: ' + JSON.stringify(mid));
  await pg.waitForTimeout(1600);
  ok(await pg.evaluate(() => !document.querySelector('article.dc[data-did="d-letter-1"]') && !!document.querySelector('#h-done .hrow[data-dk="x-d-letter-1"]')), 'and it arrives in Done');
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ the Mail room */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · the Mail room: the switch, the caps, three tabs');
  const { pg, st, ctx } = await open_(w, h);
  await pg.click('nav.bar [data-s="more"]');
  await pg.waitForSelector('#s-more [data-room="mail"]', { timeout: 10000 });
  const hub = await pg.evaluate(() => ({ order: [...document.querySelectorAll('#s-more [data-room]')].map(b => b.dataset.room).slice(0, 3).join(','), card: document.querySelector('#s-more [data-room="mail"]').innerText.replace(/\s+/g, ' ') }));
  ok(hub.order === 'engine,mail,lights' && /^Mail /.test(hub.card) && /24 of 50/.test(hub.card) && /mail is on/.test(hub.card), 'Mail is a room in More, after the engine room, with its live number: ' + hub.card);
  const g0 = st.mailGets;
  await pg.click('#s-more [data-room="mail"]');
  await pg.waitForSelector('#s-mail.on #mail-tabs [data-mtab]', { timeout: 10000 }); await pg.waitForTimeout(200);
  ok(st.mailGets === g0 + 1 && st.urls.some(u => u.endsWith('/api/soul?view=mail')), 'the room is one read of /api/soul?view=mail');
  ok(await pg.evaluate(() => location.hash) === '#mail' && await text(pg, '#s-mail .back') === 'More', 'at #mail, its way back named More');
  const top = await pg.evaluate(() => { const s = document.querySelector('#mail-sw [data-msw]');
    return { role: s.getAttribute('role'), checked: s.getAttribute('aria-checked'), b: s.querySelector('b').textContent, caps: document.querySelector('#mail-sw .mcaps').textContent, ten: document.querySelector('#mail-sw .mten p').textContent,
      nums: [...document.querySelectorAll('#mail-sw .mn')].map(n => n.querySelector('b').textContent).join(','), h: s.getBoundingClientRect().height }; });
  ok(top.role === 'switch' && top.checked === 'true' && top.b === 'Mail is on: the Lantern reads and writes' && top.h >= 44, 'the switch at the top: ' + top.b);
  ok(top.caps === 'Each day at most 10 first letters, 30 replies and 10 follow-ups: 50 emails in all. One no is final.', 'the caps, in words: ' + top.caps);
  ok(top.ten === '3 of the first 10 approved; then it writes on its own.' && top.nums === '14,6,5,2,4', 'the first ten, and today\'s numbers');
  const tabs = await pg.evaluate(() => [...document.querySelectorAll('#mail-tabs [data-mtab]')].map(b => b.dataset.mtab + ':' + b.textContent + ':' + b.getAttribute('aria-selected')).join(' | '));
  ok(tabs === 'inbox:Inbox5:true | places:Places8:false | dnc:Do not contact2:false', 'three tabs, each with its count, the inbox open: ' + tabs);

  /* the inbox */
  const ib = await pg.evaluate(() => ({ rows: [...document.querySelectorAll('#mail-threads [data-thread]')].map(r => r.querySelector('.t b').textContent + ' / ' + r.querySelector('.r .pill').textContent),
    chips: [...document.querySelectorAll('#mail-pane [data-mfa]')].map(b => b.dataset.mfa + ':' + b.textContent).join(' | ') }));
  ok(ib.rows.length === 5 && ib.rows[0] === 'A question about the night prayer / answered' && ib.rows[1] === 'An interview about the library / for you' && ib.rows[3] === 'Re: Free printables / waiting',
     'the threads, newest first, each with what the Lantern did: ' + ib.rows.slice(0, 4).join(' | '));
  ok(ib.chips === 'all:All5 | for-you:For you1 | answered:Answered2 | waiting:Waiting1 | filed:Filed1', 'filters by what it did, for him first: ' + ib.chips);
  await pg.click('#mail-pane [data-mfa="for-you"]'); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#mail-threads [data-thread]')].map(r => r.dataset.thread).join(',')) === '1', 'For you shows only what is his');
  await pg.click('#mail-pane [data-mfa="all"]'); await pg.waitForTimeout(100);
  await pg.screenshot({ path: SHOTS + '/room-inbox-' + tag + '.png', fullPage: true });
  await pg.click('#mail-threads [data-thread="0"]'); await pg.waitForTimeout(350);
  const th = await pg.evaluate(() => ({ h2: document.querySelector('#sheet-in h2').textContent, sub: document.querySelector('#sheet-in .sub').textContent, did: document.querySelector('#sheet-in .msh').innerText, reply: document.getElementById('mail-reply').textContent, ws: getComputedStyle(document.getElementById('mail-reply')).whiteSpace }));
  ok(th.h2 === 'A question about the night prayer' && /^From Aisha · aisha\.reader@example\.org · /.test(th.sub), 'a thread opens in a sheet: its subject, who wrote and when: ' + th.sub);
  ok(/The Lantern answered it\./.test(th.did) && /She asked how the night prayer is prayed/.test(th.did), 'what the Lantern did, and the summary');
  ok(th.reply === THREADS()[0].reply.text && th.ws === 'pre-wrap', 'and the reply it sent, word for word, its line breaks kept');
  await pg.screenshot({ path: SHOTS + '/room-thread-' + tag + '.png' });
  await closeSheet(pg);
  await pg.click('#mail-threads [data-thread="1"]'); await pg.waitForTimeout(300);
  ok(/It is for you/.test(await text(pg, '#sheet-in')) && /No reply was sent\./.test(await text(pg, '#sheet-in')), 'a thread for him says so, and that nothing was sent');
  await closeSheet(pg);

  /* the places */
  await pickTab(pg, 'places');
  ok(await pg.evaluate(() => document.querySelector('#mail-tabs [data-mtab="places"]').getAttribute('aria-selected') === 'true' && document.getElementById('mail-pane').getAttribute('aria-labelledby') === 'mail-tab-places'), 'Places opens, the tab marked for a reader of the screen');
  const pl = await pg.evaluate(() => ({ strip: [...document.querySelectorAll('#mail-pane .mstrip .mn')].map(n => n.querySelector('b').textContent + ' ' + n.querySelector('span').textContent).join(' | '),
    prog: document.querySelector('#mail-pane .mprog').getAttribute('aria-label'), bar: document.querySelector('#mail-pane .mprog i').style.transform,
    chips: [...document.querySelectorAll('#mail-pane [data-mfs]')].map(b => b.dataset.mfs + ':' + b.textContent).join(' | '),
    countries: [...document.querySelectorAll('#mail-pane [data-mfc] option')].map(o => o.textContent).join(' | '), rows: document.querySelectorAll('#mail-places [data-place]').length }));
  ok(pl.strip === '132 found | 24 written to | 3 replied | 1 working together | 2 declined | 2 do not contact', 'where the outreach stands: ' + pl.strip);
  ok(pl.prog === '24 of 50 places written to' && pl.bar === 'scaleX(0.48)', 'a calm line toward fifty: ' + pl.prog + ' ' + pl.bar);
  ok(pl.chips === 'all:All8 | new:New2 | written:Written to1 | followed:Followed up1 | replied:Replied1 | working:Working together1 | declined:Declined1 | dnc:Do not contact1', 'filters by where each stands: ' + pl.chips);
  ok(pl.countries === 'Every country | Australia (1) | Canada (2) | Ireland (1) | New Zealand (1) | South Africa (1) | United Kingdom (1) | United States (1)' && pl.rows === 8, 'and by country: ' + pl.countries);
  await pg.screenshot({ path: SHOTS + '/room-places-' + tag + '.png', fullPage: true });
  await pg.click('#mail-pane [data-mfs="new"]'); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#mail-places [data-place]')].map(r => r.querySelector('.t b').textContent).join(',')) === 'Masjid As Salam,Brooklyn Weekend School', 'New shows the two not written to yet');
  await pg.selectOption('#mail-pane [data-mfc]', 'Canada'); await pg.waitForTimeout(100);
  ok(/No place matches these filters\./.test(await text(pg, '#mail-pane')), 'New in Canada: none, and it says so');
  await pg.click('#mail-pane [data-mfs="all"]'); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#mail-places [data-place]')].map(r => r.querySelector('.t b').textContent).join(',') + '|' + document.querySelector('#mail-pane [data-mfc]').value) === 'Al Noor Islamic Centre,Toronto Muslim Students|Canada',
     'every place in Canada, the country kept while the status changes');
  await pg.selectOption('#mail-pane [data-mfc]', 'all'); await pg.waitForTimeout(100);
  await pg.click('#mail-places [data-place="0"]'); await pg.waitForTimeout(350);
  const ps = await pg.evaluate(() => { const s = document.querySelector('#sheet-in .msh'), kv = {};
    s.querySelectorAll('.kv').forEach(k => { kv[k.querySelector('em').textContent] = k.querySelector('span').innerText.trim(); });
    const links = [...s.querySelectorAll('a')].map(a => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel'), Math.round(a.getBoundingClientRect().height)]);
    return { h2: s.querySelector('h2').textContent, sub: s.querySelector('.sub').textContent, tags: [...s.querySelectorAll('.tags .pill')].map(p => p.textContent).join(','), kv, links, hist: [...s.querySelectorAll('.hist li span')].map(x => x.textContent) }; });
  ok(ps.h2 === 'Al Noor Islamic Centre' && ps.sub === 'Mosque · Toronto, Canada' && ps.tags === 'written to,usefulness 0.92', 'a place opens in a sheet: its name, what it is, where, and how it stands: ' + ps.sub + ' / ' + ps.tags);
  ok(ps.kv['Found through'] === 'OpenStreetMap' && ps.kv['Writes to'] === 'info@alnoor.example', 'its source, and the address it published, as text: ' + JSON.stringify(ps.kv));
  ok(JSON.stringify(ps.links) === JSON.stringify([['https://alnoor.example', '_blank', 'noopener noreferrer', 44], ['https://alnoor.example/contact', '_blank', 'noopener noreferrer', 44]]), 'its website and the page it was found on, https only, in a new tab with no referrer: ' + JSON.stringify(ps.links));
  ok(ps.hist.join(' | ') === 'Wrote: a free library for its weekend school | Found on OpenStreetMap, with its own contact page', 'and its history, newest first');
  const shs = await shortTaps(pg, '#sheet-in');
  ok(shs.length === 0, 'every control in the sheet is at least 44 px tall: ' + shs.join(', '));
  await pg.screenshot({ path: SHOTS + '/room-place-' + tag + '.png' });
  await closeSheet(pg);
  /* a place whose addresses are not https: shown, never linked */
  await pg.click('#mail-places [data-place="2"]'); await pg.waitForTimeout(300);
  const p3 = await pg.evaluate(() => ({ links: document.querySelectorAll('#sheet-in .msh a').length, t: document.querySelector('#sheet-in .msh').innerText }));
  ok(p3.links === 0 && /not a secure address, so not opened from here/.test(p3.t) && /no published address/.test(p3.t) && /Nothing has happened with it yet\./.test(p3.t), 'an http website and a javascript evidence are never links: ' + p3.links);
  await closeSheet(pg);

  /* do not contact */
  await pickTab(pg, 'dnc');
  const dc = await pg.evaluate(() => ({ rows: [...document.querySelectorAll('#mail-dnc .mdrow')].map(r => r.querySelector('b').textContent + ' / ' + r.querySelector('.t span').textContent), input: document.getElementById('mail-dnc-in').getAttribute('aria-label') }));
  ok(dc.rows.length === 2 && /^office@ctm\.example \/ added .* · They said no thanks$/.test(dc.rows[0]) && /<img src=x/.test(dc.rows[1]), 'do not contact lists each address, when and why: ' + dc.rows[0]);
  await pg.screenshot({ path: SHOTS + '/room-dnc-' + tag + '.png', fullPage: true });
  let n0 = st.posted.length;
  await pg.fill('#mail-dnc-in', 'not an address'); await pg.click('#mail-pane .mdadd button'); await pg.waitForTimeout(200);
  ok(st.posted.length === n0 && /Write an address such as name@example\.org/.test(await toastSays(pg)), 'what is neither an address nor a domain is not sent, and he is told why');
  let r = await (async () => { await pg.fill('#mail-dnc-in', '  Someone@Example.org '); return press(pg, st, pg.locator('#mail-pane .mdadd button')); })();
  ok(JSON.stringify(r.sent[0].body) === '{"action":"dnc-add","address":"someone@example.org"}' && r.toast === 'Added: the Lantern never writes to someone@example.org.', 'Add posts {action:"dnc-add", address}, the address trimmed and in small letters: ' + JSON.stringify(r.sent[0].body));
  ok(await pg.evaluate(() => document.querySelectorAll('#mail-dnc .mdrow').length === 3 && document.querySelector('#mail-dnc .mdrow b').textContent === 'someone@example.org' && document.querySelector('#mail-tabs [data-mtab="dnc"] .tn').textContent === '3'), 'and it joins the list');
  r = await (async () => { await pg.fill('#mail-dnc-in', '@Example.net'); return press(pg, st, pg.locator('#mail-pane .mdadd button')); })();
  ok(JSON.stringify(r.sent[0].body) === '{"action":"dnc-add","address":"example.net"}', 'a whole domain may be added too: ' + JSON.stringify(r.sent[0].body));
  n0 = st.posted.length;
  await pg.click('#mail-dnc .mdrow:nth-child(3) [data-mdrm]'); await pg.waitForTimeout(150);
  const rq = await pg.evaluate(() => { const c = document.querySelector('#mail-dnc .hcf'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; });
  ok(/Take office@ctm\.example off the list\? The Lantern may write to it again, within its rules\./.test(rq) && st.posted.length === n0, 'Remove asks first, in its own row, posting nothing: ' + rq);
  await pg.click('#mail-dnc [data-mdno]'); await pg.waitForTimeout(100);
  ok(st.posted.length === n0 && await pg.evaluate(() => !document.querySelector('#mail-dnc .hcf') && document.querySelectorAll('#mail-dnc [data-mdrm]').length === 4), 'Never mind posts nothing');
  await pg.click('#mail-dnc .mdrow:nth-child(3) [data-mdrm]'); await pg.waitForTimeout(150);
  r = await press(pg, st, pg.locator('#mail-dnc [data-mdyes]'));
  ok(JSON.stringify(r.sent[0].body) === '{"action":"dnc-remove","address":"office@ctm.example"}' && /Taken off the list/.test(r.toast), 'and its yes posts {action:"dnc-remove", address}: ' + JSON.stringify(r.sent[0].body));
  ok(await pg.evaluate(() => ![...document.querySelectorAll('#mail-dnc b')].some(b => b.textContent === 'office@ctm.example')), 'and the address leaves the list');

  /* the switch: off asks first and says reading goes on; on does not ask */
  n0 = st.posted.length;
  await pg.click('#mail-sw [data-msw]'); await pg.waitForTimeout(150);
  const sq = await pg.evaluate(() => { const c = document.querySelector('#mail-sw .hcf'); return c ? c.innerText.replace(/\s+/g, ' ') : ''; });
  ok(/Turn mail off\?/.test(sq) && /It keeps reading and sorting the inbox/.test(sq) && st.posted.length === n0, 'turning mail off asks first, inside the card, and says reading goes on: ' + sq);
  await pg.screenshot({ path: SHOTS + '/room-switch-confirm-' + tag + '.png' });
  await pg.click('#mail-sw [data-mswno]'); await pg.waitForTimeout(100);
  ok(st.posted.length === n0 && await pg.evaluate(() => document.querySelector('#mail-sw [data-msw]').getAttribute('aria-checked') === 'true'), 'Never mind leaves it on, posting nothing');
  await pg.click('#mail-sw [data-msw]'); await pg.waitForTimeout(150);
  r = await press(pg, st, pg.locator('#mail-sw [data-mswyes]'));
  ok(JSON.stringify(r.sent[0].body) === '{"action":"mail-switch","on":false}' && r.toast === 'Mail is off. The Lantern keeps reading and writes nothing.', 'Yes, turn it off posts {action:"mail-switch", on:false}');
  ok(await pg.evaluate(() => { const s = document.querySelector('#mail-sw [data-msw]'); return s.getAttribute('aria-checked') === 'false' && s.querySelector('b').textContent === 'Mail is off: the Lantern reads, and writes nothing'; }), 'and the switch reads off');
  r = await press(pg, st, pg.locator('#mail-sw [data-msw]'));
  ok(JSON.stringify(r.sent[0].body) === '{"action":"mail-switch","on":true}' && await pg.evaluate(() => document.querySelector('#mail-sw [data-msw]').getAttribute('aria-checked') === 'true'), 'turning it on posts {action:"mail-switch", on:true} at once');
  ok(st.posted.every(p => p.url === '/api/soul'), 'every post went to /api/soul');

  /* the rules of the room */
  for (const t of ['inbox', 'places', 'dnc']) {
    await pickTab(pg, t);
    const sh = await shortTaps(pg, '#s-mail');
    ok(sh.length === 0 && await noSideScroll(pg), t + ': every control at least 44 px tall, and nothing sideways at ' + w + ' px: ' + sh.join(', '));
  }
  const words = await allWords(pg, '#s-mail');
  ok(!SOUL.test(words) && !DASH.test(await text(pg, '#s-mail')), 'no "soul" and no dash in the room');
  ok(await pg.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length) === 0, 'with reduced motion nothing in the room moves');
  ok(st.errors.length === 0 && st.dialogs === 0, 'no console error, no browser dialog: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ the switch reaches Home */
console.log('\n390x844 · turning mail off in the room shows on Home at once');
{
  const { pg, st, ctx } = await open_(390, 844);
  await openMail(pg);
  await pg.click('#mail-sw [data-msw]'); await pg.waitForTimeout(150);
  await press(pg, st, pg.locator('#mail-sw [data-mswyes]'));
  const g = st.homeGets;
  await pg.click('nav.bar [data-s="home"]');
  await until(() => st.homeGets > g, 5000); await pg.waitForTimeout(400);
  ok(st.homeGets > g && await text(pg, '#h-mail-state') === 'Mail is off: the Lantern reads, and writes nothing', 'back on Home, the card reads Home again and says mail is off');
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ the room without a mailbox, and when it cannot be read */
console.log('\n390x844 · the room with no mailbox, and when the mail cannot be read');
{
  let o = await open_(390, 844, { home: () => HOME({ mail: MAIL_NONE(), decisions: [SETUP] }), mailv: () => MAILV({ mail: { configured: false, on: false, reason: 'No app password yet, so nothing is read or sent.', caps: { outreach: 10, replies: 30, followups: 10, total: 50 }, firstTen: { sent: 0, of: 10 }, today: null }, threads: [], places: [], counts: { places: 0, contacted: 0, replied: 0, working: 0, declined: 0, dnc: 0 }, dnc: [] }) });
  await openMail(o.pg);
  const t = await text(o.pg, '#mail-top');
  ok(/No mailbox yet/.test(t) && /No app password yet, so nothing is read or sent\./.test(t) && await o.pg.evaluate(() => !document.querySelector('#mail-top [data-msw]') && document.querySelector('#mail-top a.btn').getAttribute('href') === 'https://noorcodex.com/guide/mail'),
     'no mailbox: no switch, the reason, and the guide');
  ok(/Nothing has arrived yet/.test(await text(o.pg, '#mail-pane')), 'an empty inbox says so');
  await pickTab(o.pg, 'places');
  ok(/No place is found yet/.test(await text(o.pg, '#mail-pane')), 'and so do the places');
  await pickTab(o.pg, 'dnc');
  ok(/No one is on the list/.test(await text(o.pg, '#mail-pane')), 'and do not contact');
  ok(o.st.errors.length === 0, 'no console error');
  await o.ctx.close();
  o = await open_(390, 844, { mailv: () => MAILV({ places: null, missing: { places: 'redis timeout reading nsoul:outreach:places' } }) });
  await openMail(o.pg); await pickTab(o.pg, 'places');
  const pt = await text(o.pg, '#mail-pane');
  ok(/The places could not be read just now\./.test(pt) && /The store did not answer/.test(pt) && !/nsoul|redis/.test(pt), 'places missing: it says so in plain words, never the raw reason');
  ok(o.st.errors.length === 0, 'no console error');
  await o.ctx.close();
  o = await open_(390, 844, { mailMode: 'net' });
  await o.pg.click('nav.bar [data-s="more"]'); await o.pg.waitForSelector('#s-more [data-room="mail"]'); await o.pg.click('#s-more [data-room="mail"]');
  await o.pg.waitForSelector('#mail-top .hfail', { timeout: 8000 });
  ok(/Could not reach the house\./.test(await text(o.pg, '#mail-top')), 'a house that cannot be reached says so');
  o.st.mailMode = 'ok';
  await o.pg.click('#mail-top [data-mretry]');
  await o.pg.waitForSelector('#mail-tabs [data-mtab]', { timeout: 8000 });
  ok(await o.pg.evaluate(() => document.querySelectorAll('#mail-threads [data-thread]').length) === 5, 'and Try again reads it again and draws');
  await o.ctx.close();
}

/* ============================================================ the rules: escaping and links */
console.log('\n390x844 · markup in every field stays text; only https and console links; no address in a URL');
{
  const { pg, st, ctx } = await open_(390, 844);
  /* Done: only the https door and the console's own room are links */
  const d = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('#h-done .hrow[data-dk^="x-mail"]')].map(r => [r.dataset.dk, [...r.querySelectorAll('a')].map(a => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel'), a.textContent.trim()])])));
  ok(JSON.stringify(d['x-mail-1']) === JSON.stringify([[GMAIL, '_blank', 'noopener noreferrer', 'Open in Gmail ↗']]), 'a sent email\'s https door to Gmail is a link, in a new tab with no referrer');
  ok(['x-mail-2', 'x-mail-3', 'x-mail-4', 'x-mail-5'].every(k => d[k] && d[k].length === 0), 'javascript:, plain http, mailto: and data: are never links: ' + ['x-mail-2', 'x-mail-3', 'x-mail-4', 'x-mail-5'].map(k => k + ':' + (d[k] || []).length).join(' '));
  ok(JSON.stringify(d['x-mail-6']) === JSON.stringify([['#mail', null, null, 'See the inbox']]), 'a room of the console is a link into the console itself');
  ok(await pg.evaluate(() => !/javascript:|data:text|mailto:/.test(document.getElementById('s-home').innerHTML)), 'the refused addresses never reach the page at all');
  ok(await pg.evaluate(() => { const r = document.querySelector('#h-done .hrow[data-dk="x-mail-2"]'); return r.querySelectorAll('img').length === 0 && r.querySelectorAll('.x b *, .x .dd *').length === 0 && /Answered <img src=x/.test(r.innerText) && /<b>bold<\/b>/.test(r.innerText); }), 'markup in a Done title and detail is text');
  await pg.click('#h-done .hrow[data-dk="x-mail-6"] a'); await pg.waitForSelector('#s-mail.on #mail-tabs [data-mtab]', { timeout: 8000 });
  ok((await surfaceOn(pg)) === 's-mail', 'the console link opens the Mail room');
  /* the room: every field with markup in it */
  await pg.click('#mail-threads [data-thread="4"]'); await pg.waitForTimeout(300);
  const t5 = await pg.evaluate(() => ({ imgs: document.querySelectorAll('#sheet-in img, #sheet-in b').length, h2: document.querySelector('#sheet-in h2').textContent, sum: document.getElementById('mail-summary').textContent, reply: document.getElementById('mail-reply').textContent, sub: document.querySelector('#sheet-in .sub').textContent }));
  ok(t5.imgs === 0 && t5.h2 === '<img src=x onerror="window.__xss=1"><b>bold</b>' && t5.sum === '<img src=x onerror="window.__xss=1">\n<b>bold</b>' && t5.reply === 'Reply line <b>bold</b>\n<img src=x onerror="window.__xss=1">' && /^From <img src=x/.test(t5.sub),
     'a thread with markup in its sender, subject, kind, summary and reply: all text');
  await closeSheet(pg);
  ok(await pg.evaluate(() => document.querySelectorAll('#s-mail img').length === 0 && [...document.querySelectorAll('#mail-threads .t b, #mail-threads .t span')].every(e => e.children.length === 0)), 'no image is ever drawn in the room, and a row of the inbox is text alone');
  await pickTab(pg, 'places');
  await pg.click('#mail-places [data-place="3"]'); await pg.waitForTimeout(300);
  const p4 = await pg.evaluate(() => ({ imgs: document.querySelectorAll('#sheet-in img, #sheet-in .hist b, #sheet-in h2 b').length, h2: document.querySelector('#sheet-in h2').textContent, t: document.querySelector('#sheet-in .msh').innerText }));
  ok(p4.imgs === 0 && p4.h2 === '<img src=x onerror="window.__xss=1"><b>bold</b>' && (p4.t.match(/<img src=x/g) || []).length >= 5, 'a place with markup in its name, kind, city, address, source and history: all text');
  await closeSheet(pg);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#mail-places [data-place="3"] .t b, #mail-places [data-place="3"] .t span')].every(e => e.children.length === 0)), 'and in its row too');
  await pickTab(pg, 'dnc');
  ok(await pg.evaluate(() => document.querySelectorAll('#mail-dnc img').length === 0 && /<img src=x/.test(document.getElementById('mail-dnc').innerText)), 'and a reason on the do not contact list');
  ok(await pg.evaluate(() => typeof window.__xss === 'undefined'), 'no markup ran anywhere');
  /* links: only https, each in a new tab with no referrer; never a mailto */
  for (const t of ['inbox', 'places', 'dnc']) await pickTab(pg, t);
  await pickTab(pg, 'places');
  const bad = [];
  for (let i = 0; i < 8; i++) {
    await pg.click('#mail-places [data-place="' + i + '"]'); await pg.waitForTimeout(220);
    bad.push(...await pg.evaluate(() => [...document.querySelectorAll('#sheet-in a')].filter(a => !/^https:\/\//.test(a.getAttribute('href')) || a.getAttribute('target') !== '_blank' || !/noreferrer/.test(a.getAttribute('rel') || '')).map(a => a.getAttribute('href'))));
    await closeSheet(pg);
  }
  ok(bad.length === 0, 'every link a place shows is https, in a new tab with no referrer: ' + bad.join(' '));
  ok(await pg.evaluate(() => !document.querySelector('#s-mail a[href^="mailto:"], #s-home a[href^="mailto:"], #s-mail a[href^="http:"], #s-home a[href^="http:"]')), 'no mailto: and no plain http link anywhere in the mail');
  /* no address in any URL the page asked for, or in its own address */
  const urls = st.urls.join('\n');
  ok(!ADDRS.some(a => urls.includes(a) || urls.includes(encodeURIComponent(a))) && !/@/.test(st.urls.filter(u => u.startsWith(BASE)).join('')), 'no address ever reached a URL the console asked for');
  ok(!/@/.test(await pg.evaluate(() => location.href)) && await pg.evaluate(() => location.hash) === '#mail', 'nor its own address: the room is only #mail');
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ reduced motion on Home */
console.log('\n390x844 · reduced motion: the mail card simply appears');
{
  const { pg, st, ctx } = await open_(390, 844, { settle: 0 });
  ok(await pg.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length) === 0, 'not one animation runs');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#h-mail .mn b')].map(b => b.textContent).join(',')) === '14,6,5,2,4', 'the numbers are simply there, never counted');
  ok(st.errors.length === 0, 'no console error');
  await ctx.close();
}

/* ============================================================ motion on Home: the numbers count, the first ten light */
console.log('\n390x844 · motion: on arrival the numbers count up and the first ten light one by one');
{
  const { pg, st, ctx } = await open_(390, 844, { motion: true, settle: 0 });
  await pg.waitForTimeout(300);
  const early = await pg.evaluate(() => ({ pips: document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#h-mail .pips')).length, n: document.querySelector('#h-mail .mn b').textContent }));
  ok(early.pips === 10 && early.n !== '14', 'the pips light in turn while the numbers count: ' + JSON.stringify(early));
  await pg.waitForTimeout(2200);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#h-mail .mn b')].map(b => b.textContent).join(',')) === '14,6,5,2,4', 'and they stand at their values');
  ok(st.errors.length === 0, 'no console error');
  await ctx.close();
}

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
