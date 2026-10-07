/* NOOR · the outreach, started once by hand from Home (round six).
   ------------------------------------------------------------------
   The owner, 7 October 2026: "I also want to be able to start the mail
   outreach for the first time from a button (Make it a one time button) so
   I can see it in action right now." This drives admin2.html against a stub
   of exactly the contract the server is built to, a stub that remembers
   what was posted to it and moves a cycle along as the test asks:

     GET  ?view=home  mail.start {available, usedAt, why} and
                      mail.outreach.pace (the day's letters, set, waiting,
                      ready, found, the warm-up's sentence, the brake);
     POST {action:"outreach-start", step:"research"}  {ok, added, checked,
                      ready, foundToday, message}, at most four times while
                      fewer than 10 places are ready;
     POST {action:"outreach-start", step:"plan"}  {ok, message, started,
                      usedAt, busy?, cycle?: {id, stage}};
     GET  ?view=cycle[&id=]  the cycle whole: status, stage, intents (the
                      outreach-send ones counted: planned, read by the
                      council, written);
     GET  ?action=tick  once a minute while the cycle runs.

   It proves: the button only while the house offers it, never when used or
   from an older server, the house's reason in small words when it is not
   offered; the run inside the card (never a sheet), its three steps with
   their states, seconds and lines, the exact bodies posted, the cycle's
   stage said in plain words during the plan, the counts and the letters
   during the watch, a tick each minute while it runs and none once done,
   Home read again each minute and the hint to the letters waiting above,
   the end in plain words; the panel surviving a read of Home; no second
   press; a failed search saying the house's words with Try again, which
   resumes there; a busy plan said plainly; the pace line and its brake;
   and the rules: markup as text, no dash, no "soul", 44 px targets, nothing
   sideways at 390 px, reduced motion respected, no script error.

   Screenshots land in /tmp/qa/outreach/ for a person to look at.

   Run:  python3 /tmp/vercelish.py 8263 <the repo root> &   node tests/console-outreach.mjs
   (NOOR_BASE overrides the address; CHROMIUM_PATH the browser; OUT_SHOTS
   where the screenshots go.)
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8263';
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.OUT_SHOTS || '/tmp/qa/outreach';
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
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const XSS = '<img src=x onerror="window.__xss=1">';
const BOLD = '<b>bold</b>';

/* ---------------------------------------------------------------- the contract */
const PACE = (o = {}) => ({ date: day(0), letters: 20, followups: 20, written: 4, followupsWritten: 0, scheduled: 3, waiting: 0, ready: 12, found: 30,
  searches: { runs: 2, added: 30, checked: 74 }, week: 1, start: day(-2), braked: false, until: null,
  why: 'Week 1 of the warm-up: 20 a day, first letters and follow-ups together; 30 from Wednesday 14 October.', sent: 6, bounced: 0, ...o });
const MAIL = (o = {}) => ({ configured: true, on: true, firstTen: { sent: 0, of: 10 }, today: { received: 9, answered: 3, filed: 4, forYou: 1, sent: 0 },
  outreach: { places: 30, contacted: 0, replied: 0, working: 0, target: 1000, pace: PACE() },
  last: [{ at: iso(NOW - 2 * H), title: 'Filed a newsletter' }],
  start: { available: true, usedAt: null, why: null }, ...o });
const GOALS = () => [
  { id: 'g-outreach', owner: 'owner', outcome: 'At least 1000 places invited to work together, helpfully and respectfully, within 6 weeks', metric: 'outreach.contacted', unit: 'places', baseline: 0, current: 0, target: 1000, due: day(42), status: 'on-track', projected: null, eta: null, note: null, focus: null, history: [] }];
const HOME = (o = {}) => ({
  ok: true, now: iso(NOW), name: 'the Lantern', paused: false, status: 'working', brief: null,
  decisions: [], done: [], next: [], coming: [], goals: GOALS(), ideas: [],
  today: { posts: { sent: 6, due: 6, failed: 0 }, fixed: 0, reach7: { value: 31240, delta: 1204 }, slots: [] },
  voice: { telegram: { linked: true } }, spend: { usd: 0.4, capUsd: 10 }, giving: null, missing: { giving: 'not configured' },
  mail: MAIL(), ...o });
/* a first letter waiting for his Send: a card of kind approve with its letter */
const LETTER = (n, name, city) => ({ id: 'mail-card-' + n, kind: 'approve', title: 'A first letter to ' + name + ', ' + city, why: 'Its weekend school fits the library\'s printables.', goal: 'g-outreach', impact: null,
  options: [{ id: 'send', label: 'Send', style: 'primary', confirm: null }, { id: 'no', label: 'Not this one', style: 'plain', confirm: null }, { id: 'later', label: 'Later', style: 'plain', confirm: null }],
  link: null, steps: [], at: iso(Date.now()), expires: null, draft: null,
  letter: { to: 'info@place' + n + '.example', toName: name, subject: 'Free printables for your weekend school', kind: 'outreach', text: 'Assalamu alaykum,\n\nA short letter.\n\nWith peace,\nNOOR Codex of Light' } });
/* the cycle, as api/soul.js answers ?view=cycle: its own fields, and again under `cycle` */
const SEND = (n, name, city, status, extra = {}) => ({ n, action: 'outreach-send', args: { placeId: 'p' + n, name, city, country: 'Canada', offer: 'printables' }, tier: 'R2', why: 'A first letter.', status, ...extra });
const CYCLE = (o = {}) => ({ id: 'c-start', kind: 'extra', date: day(0), by: 'owner', status: 'running', stage: 'plan', startedAt: iso(Date.now() - 4000), intents: [], ...o });

/* ---------------------------------------------------------------- the page */
const until = async (f, ms = 6000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) return false; await new Promise(r => setTimeout(r, 25)); } return true; };
async function open_(w, h, opts = {}) {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, reducedMotion: opts.motion ? 'no-preference' : 'reduce' });
  const pg = await ctx.newPage();
  if (opts.clock) await pg.clock.install({ time: new Date(NOW) });
  const st = { home: (opts.home || HOME)(), posted: [], urls: [], homeGets: 0, cycleGets: 0, cycleUrls: [], ticks: 0, errors: [], dialogs: 0,
    research: opts.research || [{ ok: true, added: 3, checked: 12, ready: 3, foundToday: 3, message: 'Found 3 places.' }, { ok: true, added: 9, checked: 30, ready: 12, foundToday: 12, message: 'Found 9 places.' }],
    researchDelay: opts.researchDelay != null ? opts.researchDelay : 0, plan: opts.plan || null, planDelay: opts.planDelay != null ? opts.planDelay : 0,
    cycle: opts.cycle || (() => CYCLE()), onPlan: null };
  pg.on('pageerror', e => st.errors.push(String(e)));
  pg.on('console', m => { if (m.type() === 'error') st.errors.push(m.text()); });
  pg.on('dialog', d => { st.dialogs++; d.dismiss().catch(() => {}); });
  pg.on('response', r => { if (r.status() >= 400) st.errors.push(r.status() + ' ' + r.url()); });
  pg.on('request', q => st.urls.push(q.url()));
  const J = (b, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(b) });
  await ctx.route('**/*', async r => {
    const q = r.request(), u = q.url(), m = q.method();
    if (u.includes('/api/soul')) {
      if (m === 'POST') {
        const b = JSON.parse(q.postData() || '{}'); st.posted.push({ url: u.replace(BASE, ''), body: b });
        if (b.action === 'outreach-start' && b.step === 'research') {
          const i = st.posted.filter(p => p.body.action === 'outreach-start' && p.body.step === 'research').length - 1;
          if (st.researchDelay) await new Promise(res => setTimeout(res, st.researchDelay));
          return r.fulfill(J(st.research[Math.min(i, st.research.length - 1)]));
        }
        if (b.action === 'outreach-start' && b.step === 'plan') {
          if (st.planDelay) await new Promise(res => setTimeout(res, st.planDelay));
          const at = iso(Date.now());
          const a = st.plan || { ok: true, message: 'The Lantern is planning the first letters now: the council reads each one before it goes.', started: true, usedAt: at, cycle: { id: 'c-start', stage: 'council' } };
          if (a.ok) st.home.mail.start = { available: false, usedAt: a.usedAt || at, why: null };
          if (st.onPlan) st.onPlan();
          return r.fulfill(J(a));
        }
        if (b.action === 'decide') { st.home.decisions = st.home.decisions.filter(x => x.id !== b.id); return r.fulfill(J({ ok: true, message: 'Sent.' })); }
        return r.fulfill(J({ ok: true, message: 'Done.' }));
      }
      const sp = new URL(u).searchParams, view = sp.get('view');
      if (sp.get('action') === 'tick') { st.ticks++; if (st.tickFail) return r.fulfill(J({ ok: false, error: 'the lock is held by another tick' })); return r.fulfill(J({ ok: true, ran: true, status: 'running', mail: { ok: true }, voice: { ok: true } })); }
      if (view === 'home') { st.homeGets++; return r.fulfill(J({ ...st.home, now: iso(Date.now()) })); }
      if (view === 'cycle') { st.cycleGets++; st.cycleUrls.push(u.replace(BASE, '')); const c = st.cycle(); return r.fulfill(J({ ok: true, ...c, cycle: c })); }
      if (view === 'mail') return r.fulfill(J({ ok: true, mail: { configured: true, on: true, caps: {}, firstTen: { sent: 0, of: 10 }, today: {} }, threads: [], places: [], counts: {}, dnc: [], missing: {} }));
      return r.fulfill(J({ ok: true, items: [] }));
    }
    if (u.includes('/api/social')) return r.fulfill(J(u.includes('action=dials') ? { ok: true, dials: { mode: 'auto' }, channels: [] } : { ok: true }));
    if (u.includes('/api/admin-data')) return r.fulfill(J({ store: true, lanternConfigured: true, guardians: [], gifts: {} }));
    if (u.includes('/api/')) return r.fulfill(J({ ok: true }));
    if (u.startsWith(BASE)) return r.continue();
    if (u.includes('fonts.g')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.abort();
  });
  await pg.goto(BASE + '/admin2.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#app.on', { timeout: 15000 });
  await pg.waitForSelector('#s-home.on #h-decide .hsec, #s-home.on #h-decide .hfail', { timeout: 15000 });
  await pg.waitForTimeout(opts.settle != null ? opts.settle : 300);
  return { pg, st, ctx };
}
const text = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const tc = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent : ''; }, sel);
const has = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); return !!e && !!e.getClientRects().length; }, sel);
const noSideScroll = pg => pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const allWords = (pg, scope) => pg.evaluate(s => { const r = document.querySelector(s); if (!r) return ''; return [r.innerText, ...[...r.querySelectorAll('[title], [aria-label], [placeholder]')].map(e => [e.getAttribute('title'), e.getAttribute('aria-label'), e.getAttribute('placeholder')].filter(Boolean).join(' '))].join('\n'); }, scope);
const shortTaps = (pg, scope) => pg.evaluate(s => [...document.querySelectorAll(s + ' button, ' + s + ' a, ' + s + ' select, ' + s + ' input')]
  .filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden')
  .filter(b => b.getBoundingClientRect().height < 43.5).map(b => (b.textContent || b.getAttribute('aria-label') || b.tagName).trim().slice(0, 30) + ':' + Math.round(b.getBoundingClientRect().height)), scope);
const steps = pg => pg.evaluate(() => [...document.querySelectorAll('#h-orun [data-ostep]')].map(li => li.dataset.ostep + ':' + li.dataset.state).join(' '));
const lines = (pg, k) => pg.evaluate(k => [...document.querySelectorAll('#h-orun [data-ostep="' + k + '"] .osl li')].map(l => l.textContent), k);
const live = (pg, k) => pg.evaluate(k => { const e = document.querySelector('#h-orun [data-ostep="' + k + '"] [data-olive]'); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; }, k);
const bodies = st => st.posted.map(p => JSON.stringify(p.body));
const setVisible = (pg, on) => pg.evaluate(v => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v ? 'visible' : 'hidden' });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => !v });
  document.dispatchEvent(new Event('visibilitychange'));
}, on);
const clean = async (pg, st, scope, what) => {
  const words = await allWords(pg, scope);
  ok(!SOUL.test(words) && !DASH.test(words), what + ': no "soul" and no dash in what it says');
  ok(await pg.evaluate(() => window.__xss === undefined) && await pg.evaluate(s => !document.querySelector(s + ' img'), scope), what + ': no markup drawn or run');
  ok(await noSideScroll(pg), what + ': nothing scrolls sideways at ' + await pg.evaluate(() => innerWidth) + ' px');
  const t = await shortTaps(pg, scope);
  ok(!t.length, what + ': every control 44 px or more' + (t.length ? ' (' + t.join(', ') + ')' : ''));
};
/* a picture of one part, near the top of the screen, under the bar */
async function shotOf(pg, sel, name) {
  await pg.evaluate(s => { const e = document.querySelector(s); if (!e) return; const y = e.getBoundingClientRect().top + scrollY - 70;
    window.scrollTo(0, Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight))); }, sel);
  await pg.waitForTimeout(250);
  await pg.screenshot({ path: SHOTS + '/' + name + '.png' });
}

/* ============================================================ the button: only while the house offers it */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · the one time button, offered');
  const { pg, st, ctx } = await open_(w, h);
  const b = await pg.evaluate(() => { const s = document.getElementById('h-ostart'); if (!s) return null; const btn = s.querySelector('[data-ostart]');
    return { label: btn.textContent.trim(), cls: btn.className, tag: btn.tagName, h: Math.round(btn.getBoundingClientRect().height), line: s.querySelector('p').textContent,
      inCard: !!s.closest('#h-mailc'), afterState: s.previousElementSibling && s.previousElementSibling.className }; });
  ok(b && b.label === 'Start the outreach' && /^btn/.test(b.cls) && !/ghost/.test(b.cls) && b.tag === 'BUTTON' && b.h >= 44, 'the mail card offers one primary button, "Start the outreach": ' + JSON.stringify(b && [b.label, b.cls, b.h]));
  ok(b && b.line === 'Once: the Lantern looks for places now, then plans and writes its first letters while you watch. The first 10 wait here for your Send.', 'with one line under it, saying what it does, once: ' + (b && b.line));
  ok(b && b.inCard && b.afterState === 'mtop', 'inside the mail card, under its state');
  ok(await tc(pg, '#h-mpace') === 'Today: 4 of 20 letters written, 3 set to go in their own working day. 12 places ready, 30 found today.', 'the day\'s pace in one quiet line: ' + await tc(pg, '#h-mpace'));
  ok(!(await has(pg, '#h-mbrake')) && !(await has(pg, '#h-ostarted')), 'no brake said while there is none, and no "started" line before it starts');
  ok(st.posted.length === 0, 'nothing is posted until he presses it');
  await clean(pg, st, '#h-mail', 'the card with the button');
  await pg.evaluate(() => document.fonts && document.fonts.ready);
  await shotOf(pg, '#h-mail', 'start-button-' + tag);
  ok(st.errors.length === 0 && st.dialogs === 0, 'no console error, no browser dialog: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

console.log('\n390x844 · the button when it is used, when the house does not offer it, and from an older server');
{
  const usedAt = '2026-10-05T09:12:00.000Z';
  let o = await open_(390, 844, { home: () => HOME({ mail: MAIL({ start: { available: false, usedAt, why: null } }) }) });
  ok(!(await has(o.pg, '[data-ostart]')) && await tc(o.pg, '#h-ostarted') === 'Outreach started 5 October.', 'used: the button never shows again, one line says when it started: ' + await tc(o.pg, '#h-ostarted'));
  await o.ctx.close();
  /* used, even if the house still said available: usedAt wins */
  o = await open_(390, 844, { home: () => HOME({ mail: MAIL({ start: { available: true, usedAt, why: null } }) }) });
  ok(!(await has(o.pg, '[data-ostart]')), 'a start with usedAt is never offered, whatever else it says');
  await o.ctx.close();
  o = await open_(390, 844, { home: () => { const x = HOME(); delete x.mail.start; return x; } });
  ok(!(await has(o.pg, '[data-ostart]')) && !(await has(o.pg, '#h-ostart-why')) && !(await has(o.pg, '#h-ostarted')), 'an older server with no start: nothing at all');
  ok(await tc(o.pg, '#h-mpace') !== '', 'and the pace line still stands');
  await o.ctx.close();
  o = await open_(390, 844, { home: () => HOME({ mail: MAIL({ start: { available: false, usedAt: null, why: 'the mail switch is off, so no letter could go ' + BOLD } }) }) });
  ok(!(await has(o.pg, '[data-ostart]')) && await tc(o.pg, '#h-ostart-why') === 'The mail switch is off, so no letter could go <b>bold</b>.', 'not offered: no button, and the house\'s reason in small words, as text: ' + await tc(o.pg, '#h-ostart-why'));
  ok(await o.pg.evaluate(() => getComputedStyle(document.getElementById('h-ostart-why')).fontSize) === '12.5px', 'quietly, in small letters');
  await o.ctx.close();
  o = await open_(390, 844, { home: () => { const x = HOME(); delete x.mail.outreach.pace; return x; } });
  ok(!(await has(o.pg, '#h-mpace')) && await has(o.pg, '[data-ostart]'), 'an older server with no pace: no pace line, the rest as it was');
  await o.ctx.close();
  o = await open_(390, 844, { home: () => HOME({ mail: MAIL({ outreach: { places: 30, contacted: 40, replied: 2, working: 0, target: 1000, pace: PACE({ letters: 10, braked: true, until: day(5), written: 10, scheduled: 0, waiting: 2, why: 'Half pace until Monday 12 October: 3 of the 40 letters that went in the last 7 days bounced; 10 a day, first letters and follow-ups together. ' + XSS }) } }) }) });
  ok(await tc(o.pg, '#h-mpace') === 'Today: 10 of 10 letters written, 2 wait for your Send. 12 places ready, 30 found today.', 'a braked day: ' + await tc(o.pg, '#h-mpace'));
  const brk = await o.pg.evaluate(() => { const e = document.getElementById('h-mbrake'); return e ? { t: e.textContent, icon: !!e.querySelector('svg'), color: getComputedStyle(e).color, base: getComputedStyle(document.getElementById('h-mpace')).color } : null; });
  ok(brk && brk.t.startsWith('Half pace until Monday 12 October: 3 of the 40 letters') && brk.t.endsWith('<img src=x onerror="window.__xss=1">') && brk.icon && brk.color !== brk.base, 'and the brake as a gentle warning, in the house\'s words, escaped: ' + (brk && brk.t.slice(0, 60)));
  await shotOf(o.pg, '#h-mail', 'pace-braked-390x844');
  ok(await o.pg.evaluate(() => window.__xss === undefined && !document.querySelector('#h-mail img')), 'no markup ran');
  ok(o.st.errors.length === 0, 'no console error: ' + o.st.errors.slice(0, 3).join(' | '));
  await o.ctx.close();
}

/* ============================================================ the run, start to end */
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const tag = w + 'x' + h;
  console.log('\n' + tag + ' · the run: the places, the plan, the first letters');
  const { pg, st, ctx } = await open_(w, h, { clock: true, motion: w === 390, researchDelay: 700, planDelay: 3800,
    cycle: () => CYCLE({ stage: st.stage || 'plan', status: st.status || 'running', intents: st.intents || [] }) });
  st.stage = 'assess';
  /* the press: the button gives way to the run, inside the card */
  await pg.click('[data-ostart]');
  await pg.waitForSelector('#h-orun', { timeout: 4000 });
  const p0 = await pg.evaluate(() => { const r = document.getElementById('h-orun'); r.__mark = 'kept';
    return { inCard: !!r.closest('#h-mailc'), sheet: document.getElementById('sheet').classList.contains('on'), veil: document.getElementById('veil').classList.contains('on'), button: !!document.querySelector('[data-ostart]'),
      head: r.querySelector('.orh b').textContent, titles: [...r.querySelectorAll('.osh b')].map(b => b.textContent) }; });
  ok(p0.inCard && !p0.sheet && !p0.veil, 'the run opens inside the mail card, with no sheet and no veil over Home');
  ok(!p0.button, 'and the button is gone: it cannot be pressed twice');
  ok(p0.titles.join(' | ') === 'Looking for places that teach | Planning the first letters | Watching the first letters', 'three steps, in plain words: ' + p0.titles.join(' | '));
  ok(await steps(pg) === 'research:work plan:wait watch:wait', 'the first step works, the others wait: ' + await steps(pg));
  await pg.waitForTimeout(250);
  if (w === 390) {
    const pulse = await pg.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('[data-ostep="research"] .osd')).length);
    ok(pulse >= 1, 'with motion, the working step\'s light breathes (' + pulse + ' animation)');
    await shotOf(pg, '#h-orun', 'run-research-' + tag);
  }
  await until(() => st.posted.filter(p => p.body.step === 'research').length === 2, 5000);
  await until(() => st.posted.some(p => p.body.step === 'plan'), 5000);
  await pg.waitForTimeout(200);
  ok(JSON.stringify(bodies(st)) === JSON.stringify(['{"action":"outreach-start","step":"research"}', '{"action":"outreach-start","step":"research"}', '{"action":"outreach-start","step":"plan"}']),
    'the search runs twice (3, then 12 ready), then the plan: ' + bodies(st).join(' '));
  ok(st.posted.every(p => p.url === '/api/soul'), 'every post goes to /api/soul');
  ok(JSON.stringify(await lines(pg, 'research')) === JSON.stringify(['Found 3 new places (12 checked). 3 ready for a first letter.', 'Found 9 new places (30 checked). 12 ready for a first letter.']),
    'a line for each search: ' + (await lines(pg, 'research')).join(' / '));
  ok(await steps(pg) === 'research:done plan:work watch:wait', 'the search done, the plan working: ' + await steps(pg));
  /* the plan takes its time: the cycle is read meanwhile, its stage said in plain words */
  await until(() => st.cycleGets >= 1, 5000); await pg.waitForTimeout(200);
  ok(await live(pg, 'plan') === 'Now: Weighing the goals', 'while the plan is made, the cycle\'s stage in plain words: ' + await live(pg, 'plan'));
  ok(st.cycleUrls[0] === '/api/soul?view=cycle', 'read from ?view=cycle: ' + st.cycleUrls[0]);
  const secs = await pg.evaluate(() => document.querySelector('[data-ostep="plan"] .ose').textContent);
  ok(/^\d+ s$/.test(secs), 'with its seconds: ' + secs);
  if (w === 390) await shotOf(pg, '#h-orun', 'run-plan-' + tag);
  ok(st.ticks === 0, 'no tick is asked while the plan itself is being made');
  /* the plan answers */
  st.stage = 'council';
  st.intents = [SEND(0, 'Al Noor Islamic Centre', 'Toronto', 'approved', { council: { approved: true } }), SEND(1, 'Masjid ' + XSS, 'Ottawa', 'planned'), SEND(2, 'Leeds Islamic Society', 'Leeds', 'done', { council: { approved: true }, result: { ok: true } })];
  const h0 = st.homeGets;
  await until(() => st.cycleUrls.some(u => u.includes('id=c-start')), 8000); await pg.waitForTimeout(300);
  ok(JSON.stringify(await lines(pg, 'plan')) === JSON.stringify(['The Lantern is planning the first letters now: the council reads each one before it goes.']), 'the plan\'s own words: ' + (await lines(pg, 'plan')).join(' / '));
  ok(await steps(pg) === 'research:done plan:done watch:work', 'the plan done, the watch begun: ' + await steps(pg));
  ok(st.cycleUrls.some(u => u === '/api/soul?view=cycle&id=c-start'), 'the cycle the plan named is read by its id');
  ok(await live(pg, 'watch') === '3 letters planned, 2 read by the council, 1 written Now: The council reads each letter', 'the counts, and the stage: ' + await live(pg, 'watch'));
  const lt = await pg.evaluate(() => [...document.querySelectorAll('#h-orun .olt li')].map(li => li.dataset.ls + ':' + li.querySelector('span').textContent + ':' + li.querySelector('em').textContent));
  ok(lt.join(' | ') === 'read:Al Noor Islamic Centre, Toronto:the council said yes | :Masjid <img src=x onerror="window.__xss=1">, Ottawa:planned | done:Leeds Islamic Society, Leeds:written', 'each letter, by its place, and where it stands (a name with markup as text): ' + lt.join(' | '));
  await until(() => st.ticks >= 1, 4000);
  ok(st.ticks === 1 && st.urls.some(u => u.endsWith('/api/soul?action=tick')), 'the cycle running, a tick moves it on: ' + st.ticks);
  await until(() => st.homeGets > h0, 4000);
  ok(st.homeGets === h0 + 1, 'and Home is read again at once, for the letters waiting for his Send');
  ok(await pg.evaluate(() => document.getElementById('h-orun').__mark === 'kept' && !!document.getElementById('h-orun').closest('#h-mailc')), 'the run survives a read of Home: the same panel, in its place');
  ok(!(await has(pg, '[data-ostart]')), 'and the button does not come back: the house says it is used');
  ok(!(await has(pg, '#h-orun-letters')), 'no letter waits above yet, so nothing points there');
  await clean(pg, st, '#h-mail', 'the run, watching');
  await shotOf(pg, '#h-orun', 'run-watch-' + tag);
  /* a minute on: the letters wait above; the hint says so */
  st.home.decisions = [LETTER(1, 'Leeds Islamic Society', 'Leeds'), LETTER(2, 'Al Noor Islamic Centre', 'Toronto')];
  st.intents = st.intents.map(x => x.n === 0 ? { ...x, status: 'done', result: { ok: true } } : x);
  st.stage = 'act';
  const g1 = st.homeGets;
  for (let i = 0; i < 3 && st.homeGets === g1; i++) { const c = st.cycleGets; await pg.clock.runFor(20000); await until(() => st.cycleGets > c, 4000); await pg.waitForTimeout(250); }
  await until(() => st.homeGets > g1, 4000); await pg.waitForTimeout(300);
  ok(st.homeGets === g1 + 1, 'every minute Home is read again (' + (st.homeGets - g1) + ')');
  ok(st.ticks === 2, 'and a tick each minute while the cycle runs: ' + st.ticks);
  ok(await live(pg, 'watch') === '3 letters planned, 2 read by the council, 2 written Now: Writing and sending', 'the counts move: ' + await live(pg, 'watch'));
  const hint = await pg.evaluate(() => { const e = document.getElementById('h-orun-letters'); return e && !e.hidden ? { t: e.querySelector('p').textContent, b: e.querySelector('button').textContent.trim(), h: Math.round(e.querySelector('button').getBoundingClientRect().height) } : null; });
  ok(hint && hint.t === 'Your first letters wait above for your Send.' && hint.b === 'See them' && hint.h >= 44, 'the letters on the desk above: "' + (hint && hint.t) + '" with ' + (hint && hint.b));
  ok(await pg.evaluate(() => { const d = document.querySelector('#h-decide article.dc.letter'), r = document.getElementById('h-orun'); return !!d && !!(d.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING); }), 'and they are indeed above it, as cards with their letter');
  await shotOf(pg, '#h-orun', 'run-letters-wait-' + tag);
  await pg.click('#h-orun-letters [data-oletters]'); await pg.waitForTimeout(500);
  const seen = await pg.evaluate(() => { const c = document.querySelector('#h-decide article.dc.letter'), r = c.getBoundingClientRect(); return { lit: c.classList.contains('lit'), on: r.top < innerHeight && r.bottom > 0 }; });
  ok(seen.lit && seen.on, 'See them brings the letters into view, each ringed in light a moment');
  await pg.waitForTimeout(200);
  if (w === 390) await pg.screenshot({ path: SHOTS + '/run-see-letters-' + tag + '.png' });
  /* the cycle done: the end in plain words; nothing more is asked */
  st.intents = st.intents.map(x => x.n === 1 ? { ...x, status: 'done', council: { approved: true }, result: { ok: true } } : x);
  st.status = 'done'; st.stage = 'report';
  const t2 = st.ticks, c2 = st.cycleGets;
  await pg.clock.runFor(20000); await until(() => st.cycleGets > c2, 4000); await pg.waitForTimeout(400);
  ok(await steps(pg) === 'research:done plan:done watch:done', 'the cycle done, every step done: ' + await steps(pg));
  ok(await tc(pg, '#h-orun-said') === 'Done: 3 letters written. The rest of the outreach now runs on its own, every day.', 'and it says how many were written, and that the rest runs on its own: ' + await tc(pg, '#h-orun-said'));
  ok(await live(pg, 'watch') === '3 letters planned, 3 read by the council, 3 written', 'the final counts: ' + await live(pg, 'watch'));
  const c3 = st.cycleGets;
  await pg.clock.runFor(130000); await pg.waitForTimeout(500);
  ok(st.cycleGets === c3 && st.ticks === t2, 'once done, nothing more is read and no tick is asked (' + (st.cycleGets - c3) + ' reads, ' + (st.ticks - t2) + ' ticks)');
  ok(bodies(st).filter(b => /outreach-start/.test(b)).length === 3, 'and nothing more is posted: the start ran once');
  await clean(pg, st, '#h-mail', 'the run, done');
  await shotOf(pg, '#h-orun', 'run-done-' + tag);
  /* folded away: the quiet line in its place */
  await pg.click('#h-orun [data-ohide]'); await pg.waitForTimeout(300);
  ok(!(await has(pg, '#h-orun')) && /^Outreach started \d{1,2} [A-Z][a-z]+\.$/.test(await tc(pg, '#h-ostarted')) && !(await has(pg, '[data-ostart]')), 'folded away, one quiet line says when the outreach started, and still no button: ' + await tc(pg, '#h-ostarted'));
  ok(await pg.evaluate(() => window.__xss === undefined), 'no markup ran');
  ok(st.errors.length === 0 && st.dialogs === 0, 'no console error, no browser dialog: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ a search that fails, and Try again */
console.log('\n390x844 · a search that fails says the house\'s words, and Try again resumes there');
{
  const { pg, st, ctx } = await open_(390, 844, { research: [{ ok: false, message: 'The search for places could not run: the store did not answer. ' + BOLD }], planDelay: 300,
    cycle: () => CYCLE({ status: st.status || 'running', stage: 'act', intents: [SEND(0, 'A Mosque', 'Hull', 'done', { result: { ok: true } })] }) });
  await pg.click('[data-ostart]');
  await pg.waitForSelector('#h-orun-fail:not([hidden])', { timeout: 5000 }); await pg.waitForTimeout(200);
  const f = await pg.evaluate(() => { const e = document.getElementById('h-orun-fail'); return { t: e.querySelector('p').textContent, b: e.querySelector('[data-oretry]').textContent, h: Math.round(e.querySelector('[data-oretry]').getBoundingClientRect().height), role: e.getAttribute('role') }; });
  ok(f.t === 'The search for places could not run: the store did not answer. <b>bold</b>' && f.b === 'Try again' && f.h >= 44 && f.role === 'alert', 'the house\'s own words, as text, and Try again: ' + f.t);
  ok(await steps(pg) === 'research:fail plan:wait watch:wait' && bodies(st).length === 1, 'the run stops at the search; the plan is not asked: ' + await steps(pg));
  ok(await pg.evaluate(() => !document.querySelector('#h-mail b b, #h-mail img')), 'the message is never drawn as markup');
  await shotOf(pg, '#h-orun', 'run-failed-390x844');
  st.research = [{ ok: true, added: 12, checked: 40, ready: 12, foundToday: 12, message: 'Found 12.' }];
  st.status = 'done';
  await pg.click('[data-oretry]');
  await until(() => st.posted.some(p => p.body.step === 'plan'), 5000);
  await pg.waitForSelector('#h-orun-said', { timeout: 8000 }); await pg.waitForTimeout(300);
  ok(JSON.stringify(bodies(st)) === JSON.stringify(['{"action":"outreach-start","step":"research"}', '{"action":"outreach-start","step":"research"}', '{"action":"outreach-start","step":"plan"}']), 'Try again resumes from the search, then plans: ' + bodies(st).join(' '));
  ok(await pg.evaluate(() => document.getElementById('h-orun-fail').hidden) && JSON.stringify(await lines(pg, 'research')) === JSON.stringify(['Found 12 new places (40 checked). 12 ready for a first letter.']), 'the failure leaves, and the search says what it found');
  ok(await tc(pg, '#h-orun-said') === 'Done: 1 letter written. The rest of the outreach now runs on its own, every day.', 'one letter, said so: ' + await tc(pg, '#h-orun-said'));
  ok(st.errors.length === 0, 'no console error: ' + st.errors.slice(0, 3).join(' | '));
  await ctx.close();
}

/* ============================================================ a plan that is refused, a busy plan, four searches at most */
console.log('\n390x844 · a refused plan, a Lantern already thinking, and four searches at most');
{
  let o = await open_(390, 844, { clock: true, research: [{ ok: true, added: 0, checked: 8, ready: 2 }], plan: { ok: false, message: 'The plan could not start: mail is off.' } });
  o.st.tickFail = true;
  await o.pg.click('[data-ostart]');
  await o.pg.waitForSelector('#h-orun-fail:not([hidden])', { timeout: 8000 }); await o.pg.waitForTimeout(200);
  ok(bodies(o.st).filter(b => /research/.test(b)).length === 4, 'fewer than 10 ready: the search is asked four times, and no more: ' + bodies(o.st).filter(b => /research/.test(b)).length);
  ok(JSON.stringify(await lines(o.pg, 'research')) === JSON.stringify(Array(4).fill('Found no new place (8 checked). 2 ready for a first letter.')), 'each said plainly');
  await o.ctx.close();
  /* round seven: an empty round with the house's own reason says it */
  o = await open_(390, 844, { clock: true, research: [{ ok: true, added: 0, checked: 0, ready: 0, message: 'No new place this time (0 checked); OpenStreetMap (GB) did not answer.' }], plan: { ok: false, message: 'The plan could not start: mail is off.' } });
  await o.pg.click('[data-ostart]');
  await o.pg.waitForSelector('#h-orun-fail:not([hidden])', { timeout: 8000 }); await o.pg.waitForTimeout(200);
  ok((await lines(o.pg, 'research'))[0] === 'No new place this time (0 checked); OpenStreetMap (GB) did not answer. None is ready for a first letter yet.', 'an empty round says why, in the house\'s words: ' + (await lines(o.pg, 'research'))[0]);
  await o.ctx.close();
  o = await open_(390, 844, { clock: true, research: [{ ok: true, added: 0, checked: 8, ready: 2 }], plan: { ok: false, message: 'The plan could not start: mail is off.' } });
  o.st.tickFail = true;
  await o.pg.click('[data-ostart]');
  await o.pg.waitForSelector('#h-orun-fail:not([hidden])', { timeout: 8000 }); await o.pg.waitForTimeout(200);
  ok(await steps(o.pg) === 'research:done plan:fail watch:wait' && await tc(o.pg, '#h-orun-fail p') === 'The plan could not start: mail is off.', 'a plan the house refused: its words, and Try again at the plan');
  o.st.plan = { ok: true, busy: true, message: 'The Lantern is already thinking.', started: false, usedAt: iso(Date.now()) };
  await o.pg.click('[data-oretry]');
  await until(() => bodies(o.st).filter(b => /plan/.test(b)).length === 2, 5000); await o.pg.waitForTimeout(400);
  ok(bodies(o.st).filter(b => /research/.test(b)).length === 4, 'Try again at the plan asks the plan again, not the search');
  ok(JSON.stringify(await lines(o.pg, 'plan')) === JSON.stringify(['The Lantern is already thinking: the first letters come with that plan.']), 'busy: it says the Lantern is already thinking, and the letters come with that plan');
  ok(await steps(o.pg) === 'research:done plan:done watch:work', 'and it watches that plan: ' + await steps(o.pg));
  /* a tick the house could not take is said once, and the watch goes on */
  await until(() => o.st.ticks >= 1, 4000); await o.pg.waitForTimeout(300);
  ok(JSON.stringify(await lines(o.pg, 'watch')) === JSON.stringify(['The Lantern could not be moved on just now; it is asked again in a minute.']), 'a tick that failed is said once, in plain words: ' + (await lines(o.pg, 'watch')).join(' / '));
  ok(await live(o.pg, 'watch') === 'No letter is planned yet. Now: Planning', 'a plan with no letter yet says so: ' + await live(o.pg, 'watch'));
  /* the page hidden: the watch sleeps; seen again, it reads at once */
  await setVisible(o.pg, false);
  const c0 = o.st.cycleGets, t0 = o.st.ticks;
  for (let i = 0; i < 3; i++) { await o.pg.clock.runFor(30000); await o.pg.waitForTimeout(150); }
  ok(o.st.cycleGets === c0 && o.st.ticks === t0, 'hidden for a minute and a half, nothing is asked of the house (' + (o.st.cycleGets - c0) + ' reads, ' + (o.st.ticks - t0) + ' ticks)');
  await setVisible(o.pg, true);
  await until(() => o.st.cycleGets > c0, 4000); await o.pg.waitForTimeout(300);
  ok(o.st.cycleGets === c0 + 1 && o.st.ticks === t0 + 1, 'seen again, it reads the cycle at once, and asks the tick that is due');
  ok((await lines(o.pg, 'watch')).length === 1, 'the failed tick is still said only once');
  /* fifteen minutes on, the watch ends calmly; the rest goes on by itself */
  const c1 = o.st.cycleGets;
  await o.pg.clock.runFor(15 * 60000); await until(() => o.st.cycleGets > c1, 4000);
  await o.pg.waitForSelector('#h-orun-said', { timeout: 6000 }); await o.pg.waitForTimeout(200);
  ok(await tc(o.pg, '#h-orun-said') === 'The letters are still being written; each one lands above as it is ready. The rest of the outreach now runs on its own, every day.', 'after fifteen minutes the watch ends, in plain words: ' + await tc(o.pg, '#h-orun-said'));
  ok(await steps(o.pg) === 'research:done plan:done watch:done', 'every step done: ' + await steps(o.pg));
  const c2 = o.st.cycleGets;
  await o.pg.clock.runFor(120000); await o.pg.waitForTimeout(300);
  ok(o.st.cycleGets === c2, 'and nothing more is read');
  ok(o.st.errors.length === 0, 'no console error: ' + o.st.errors.slice(0, 3).join(' | '));
  await o.ctx.close();
}

/* ============================================================ reduced motion: nothing moves */
console.log('\n390x844 · with less motion asked for, the run simply appears');
{
  const { pg, st, ctx } = await open_(390, 844, { researchDelay: 1500 });
  await pg.dblclick('[data-ostart]');
  await pg.waitForSelector('#h-orun', { timeout: 4000 }); await pg.waitForTimeout(300);
  ok(st.posted.length === 1 && await pg.evaluate(() => document.querySelectorAll('#h-orun').length === 1 && !document.querySelector('[data-ostart]')), 'a double press starts one run and posts one search: ' + st.posted.length);
  ok(await pg.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length) === 0, 'not one animation runs: no pulse, no rise');
  ok(/^\d+ s$/.test(await pg.evaluate(() => document.querySelector('[data-ostep="research"] .ose').textContent)), 'the seconds still say how long it has worked');
  ok(await pg.evaluate(() => document.querySelector('[data-ostep="research"] [data-osr]').textContent) === 'working', 'and a reader of the screen hears that the step is working');
  ok(st.errors.length === 0, 'no console error');
  await ctx.close();
}

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
