/* NOOR · the console's first screen.
   ------------------------------------------------------------------
   The Pulse tab opened on a chart of yesterday's readers. That is a real
   number and the wrong first question: on opening the console in the morning
   the owner wants to know whether anything is broken, whether anything is
   owed, and what today is. The chart answers none of those.

   So the tab now opens with a briefing, worst first, and this holds it to it:
   an owed post, a failed send, an unverified calendar and a waiting message
   each have to appear, in that order of severity, and a quiet day has to say
   so rather than showing an empty box.

   Run:  python3 -m http.server 8231 &   node tests/pulse.mjs
*/
import { chromium } from 'playwright';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8231';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL ' + m)); };

const br = await chromium.launch();

async function withData(today, inbox, doubts) {
  const pg = await br.newPage({ viewport: { width: 1200, height: 900 } });
  await pg.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/social?action=today'))
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(today) });
    if (u.includes('/api/inbox'))
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(inbox) });
    if (u.includes('probe=lights'))
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ doubts }) });
    if (u.startsWith(BASE)) return r.continue();
    return r.abort();
  });
  await pg.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { document.getElementById('gate').hidden = true;
    document.getElementById("dash").hidden = false; window.__noorBrief(); });
  await pg.waitForTimeout(600);
  return pg;
}
const slot = (id, at, state, title) => ({ id, at, state, title: title || '', sentAt: null, results: null });

console.log('\n=== 1. a day with things owed and one failure ===');
{
  const pg = await withData({ ok: true, nowHour: 17,
    plan: { verified: true, hijri: { d: 18, name: 'Rabi al-Awwal', y: 1448 },
      day: { fixed: null, recurring: [{ name: 'Monday and Thursday' }] }, leads: [] },
    slots: [slot('dawn',5,'sent','Monday and Thursday'), slot('light',12,'failed','A card'),
            slot('word',16,'due','Khulafa Rashidun'), slot('dusk',20,'waiting','')] },
    { ok: true, counts: { new: 3 } }, []);
  const t = await pg.evaluate(() => document.getElementById('brief-now-list').innerText);
  ok(!(await pg.evaluate(() => document.getElementById('brief-now').hidden)), 'the "needs you" panel shows');
  ok(/failed to send/i.test(t), 'a failed send is reported');
  ok(/owed/i.test(t), 'an owed post is reported');
  ok(/new message/i.test(t), 'waiting messages are reported');
  const order = ['failed to send', 'owed', 'new message'].map(k => t.toLowerCase().indexOf(k));
  ok(order[0] < order[1] && order[1] < order[2], 'and they are in order of severity');
  const d = await pg.evaluate(() => document.getElementById('brief-day').innerText);
  ok(/18 Rabi al-Awwal 1448/.test(d), 'today names the verified date');
  ok(/Monday and Thursday/.test(d), 'and what today is');
  ok(/1 of 4 posts away/.test(d), 'and how much of the day has gone out');
  ok(/05:00[\s\S]*12:00[\s\S]*16:00[\s\S]*20:00/.test(d), 'the day is listed hour by hour');
  await pg.close();
}

console.log('\n=== 2. a quiet day ===');
{
  const pg = await withData({ ok: true, nowHour: 21,
    plan: { verified: true, hijri: { d: 1, name: 'Safar', y: 1448 }, day: { fixed: null, recurring: [] },
      leads: [{ days: 3, obs: { name: 'The Day of Ashura', what: 'A fast the Prophet kept.' } }] },
    slots: [slot('dawn',5,'sent','x'), slot('light',12,'sent','y')] },
    { ok: true, counts: { new: 0 } }, []);
  const t = await pg.evaluate(() => document.getElementById('brief-now-list').innerText);
  ok(/nothing is waiting on you/i.test(t), 'a quiet day says so plainly');
  ok(!(await pg.evaluate(() => document.getElementById('brief-next').hidden)), 'what is coming up shows');
  const nx = await pg.evaluate(() => document.getElementById('brief-next').innerText);
  ok(/Ashura/.test(nx) && /in 3 days/.test(nx), 'with how long there is (' + nx.split('\n')[0] + ')');
  await pg.close();
}

console.log('\n=== 3. the calendar could not be verified ===');
{
  const pg = await withData({ ok: true, nowHour: 9,
    plan: { verified: false, hijri: null, day: { fixed: null, recurring: [] }, leads: [] }, slots: [] },
    { ok: true, counts: { new: 0 } }, []);
  const t = await pg.evaluate(() => document.getElementById('brief-now-list').innerText);
  ok(/calendar could not be verified/i.test(t), 'an unverified calendar is raised');
  await pg.close();
}

console.log('\n=== 4. the desk itself is down ===');
{
  const pg = await br.newPage({ viewport: { width: 1200, height: 900 } });
  await pg.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/social')) return r.abort();
    if (u.includes('/api/inbox') || u.includes('probe=')) return r.abort();
    if (u.startsWith(BASE)) return r.continue();
    return r.abort();
  });
  await pg.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { document.getElementById('gate').hidden = true;
    document.getElementById("dash").hidden = false; window.__noorBrief(); });
  await pg.waitForTimeout(700);
  const t = await pg.evaluate(() => document.getElementById('brief-now-list').innerText);
  ok(/did not answer/i.test(t), 'a dead endpoint is reported, not hidden');
  const d = await pg.evaluate(() => document.getElementById('brief-day').innerText);
  ok(/could not be read/i.test(d), 'and today says it could not be read');
  await pg.close();
}

console.log('\n=== 5. it does not scroll sideways on a phone ===');
{
  const pg = await withData({ ok: true, nowHour: 17,
    plan: { verified: true, hijri: { d: 18, name: 'Rabi al-Awwal', y: 1448 },
      day: { fixed: null, recurring: [] }, leads: [] },
    slots: [slot('word',16,'due','A very long headline that will not fit on a narrow screen at all')] },
    { ok: true, counts: { new: 1 } }, []);
  await pg.setViewportSize({ width: 380, height: 800 });
  await pg.waitForTimeout(300);
  ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)),
     'the briefing fits a narrow screen');
  await pg.close();
}

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
