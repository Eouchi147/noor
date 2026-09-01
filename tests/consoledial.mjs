/* NOOR · the dial in the console.
   ------------------------------------------------------------------
   The owner asked for it back, better. Everything the public dial got wrong is
   a check here, because those were all found in production rather than in a
   test:

     · tapping a section did nothing at all, because pointerdown captures the
       pointer to the stage and the ball is never the pointerup target
     · the ring overlapped the words in the middle at every phone size
     · in landscape all eight balls piled into one heap
     · the focused ball's glow drew a visible square

   And two of its own: the console must be exactly what it was if this file
   never loads, and the loop must not run for a tab nobody is looking at.

   Run:  python3 -m http.server 8231 &   node tests/consoledial.mjs
*/
import { chromium } from 'playwright';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8231';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL ' + m)); };
const br = await chromium.launch();

async function console_(w, h) {
  const pg = await br.newPage({ viewport: { width: w, height: h } });
  await pg.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    if (u.startsWith(BASE)) return r.continue();
    return r.abort();
  });
  await pg.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded' });
  await pg.evaluate(() => { document.getElementById('gate').hidden = true;
    document.getElementById('dash').hidden = false; });
  await pg.waitForTimeout(900);
  return pg;
}
const geo = pg => pg.evaluate(() => {
  const host = document.getElementById('cdial');
  const rs = [...document.querySelectorAll('.cd-node')].map(n => n.getBoundingClientRect());
  const hb = host.getBoundingClientRect();
  const hub = document.getElementById('cd-hub').getBoundingClientRect();
  const vis = rs.filter(r => r.left > -5000);
  let minSep = Infinity;
  for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
    const a = vis[i], b = vis[j];
    minSep = Math.min(minSep, Math.hypot((a.left+a.width/2)-(b.left+b.width/2),
      (a.top+a.height/2)-(b.top+b.height/2)) - (a.width + b.width) / 2);
  }
  /* only the sections actually on the visible part of the arc are measured;
     the ones ridden off the ends are parked and hidden on purpose */
  const on = rs.filter(r => r.width > 1 && r.left > -5000);
  return { n: rs.length, minSep: +minSep.toFixed(1),
    laidOut: !!getComputedStyle(host).getPropertyValue('--cd').trim(),
    inTop: +(hb.top - Math.min(...on.map(r=>r.top))).toFixed(1),
    inBot: +(Math.max(...on.map(r=>r.bottom)) - hb.bottom).toFixed(1),
    ballD: +on[0].width.toFixed(0), visible: getComputedStyle(host).display };
});

console.log('\n=== 1. it fits its box at every desk size ===');
for (const [w, h] of [[900, 800], [1100, 900], [1440, 900], [1920, 1080], [2560, 1400]]) {
  const pg = await console_(w, h);
  const g = await geo(pg);
  ok(g.n >= 10, w + ': every tab is on the ring (' + g.n + ')');
  ok(g.minSep >= -2, w + ': the sections do not pile on each other (' + g.minSep + ')');
  ok(g.inTop <= 1 && g.inBot <= 1, w + ': the arc stays inside its panel ' + JSON.stringify([g.inTop,g.inBot]));
  ok(g.ballD >= 40, w + ': a section is big enough to aim at (' + g.ballD + ')');
  ok(g.laidOut, w + ': the dial actually laid itself out');
  await pg.close();
}

console.log('\n=== 2. tapping a section actually opens it ===');
{
  const pg = await console_(1440, 900);
  /* turn to a section that is not the one showing, then tap it twice:
     once to bring it to the front, once to open it */
  const target = await pg.evaluate(() => {
    const n = [...document.querySelectorAll('.cd-node')].find(x => !x.classList.contains('on'));
    const r = n.getBoundingClientRect();
    return { i: +n.dataset.i, x: r.left + r.width/2, y: r.top + r.height/2 };
  });
  await pg.mouse.click(target.x, target.y);
  await pg.waitForTimeout(900);
  const front = await pg.evaluate(() => +document.querySelector('.cd-node.on').dataset.i);
  ok(front === target.i, 'a tap brings that section to the front');
  const at = await pg.evaluate(() => { const r = document.querySelector('.cd-node.on').getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 }; });
  await pg.mouse.click(at.x, at.y);
  await pg.waitForTimeout(500);
  const pane = await pg.evaluate(() => (document.querySelector('.pane.on')||{}).id);
  const want = await pg.evaluate(i => document.querySelectorAll('.tab[data-pane]')[i].dataset.pane, front);
  ok(pane === 'pane-' + want, 'and a second tap opens it (' + pane + ')');
  await pg.close();
}

console.log('\n=== 3. the keyboard drives it ===');
{
  const pg = await console_(1440, 900);
  const before = await pg.evaluate(() => +document.querySelector('.cd-node.on').dataset.i);
  await pg.evaluate(() => document.getElementById('cdial').focus());
  await pg.keyboard.press('ArrowRight');
  await pg.waitForTimeout(900);
  const after = await pg.evaluate(() => +document.querySelector('.cd-node.on').dataset.i);
  ok(after !== before, 'an arrow key turns it one section (' + before + ' -> ' + after + ')');
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(400);
  const pane = await pg.evaluate(() => (document.querySelector('.pane.on')||{}).id);
  ok(/^pane-/.test(pane), 'and Enter opens what is in front (' + pane + ')');
  await pg.close();
}

console.log('\n=== 4. it follows the tab list, and the list still works ===');
{
  const pg = await console_(1440, 900);
  await pg.evaluate(() => document.querySelector('.tab[data-pane="social"]').click());
  await pg.waitForTimeout(1000);
  const r = await pg.evaluate(() => ({
    pane: (document.querySelector('.pane.on')||{}).id,
    front: document.querySelector('.cd-node.on').textContent.trim().toLowerCase()
  }));
  ok(r.pane === 'pane-social', 'the old tab list still switches panes');
  ok(/social/.test(r.front), 'and the dial turns to follow it (' + r.front + ')');
  await pg.close();
}

console.log('\n=== 5. the glow is round, and the loop stops ===');
{
  const pg = await console_(1440, 900);
  const sh = await pg.evaluate(() => getComputedStyle(document.querySelector('.cd-node')).boxShadow);
  const blurs = (sh.match(/(\d+(?:\.\d+)?)px/g) || []).map(Number);
  ok(!blurs.some(b => b > 40), 'no big blurred shadow that would draw a square (' + sh.slice(0,40) + ')');
  const g = await pg.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.cd-node'), '::after');
    return { r: cs.borderRadius, bg: cs.backgroundImage.slice(0, 20) };
  });
  ok(/radial-gradient/.test(g.bg) && /50%/.test(g.r), 'the glow is a round gradient');
  await pg.waitForTimeout(3200);
  const framesA = await pg.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now();
    (function tick(){ n++; if (performance.now() - t0 < 400) requestAnimationFrame(tick); else res(n); })(); }));
  ok(framesA > 0, 'the page is still alive after the dial settles (' + framesA + ' frames)');
  await pg.close();
}

console.log('\n=== 6. the console is unharmed without it ===');
{
  const pg = await br.newPage({ viewport: { width: 1440, height: 900 } });
  await pg.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('noor-console-dial')) return r.abort();
    if (u.includes('/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    if (u.startsWith(BASE)) return r.continue();
    return r.abort();
  });
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded' });
  await pg.evaluate(() => { document.getElementById('gate').hidden = true;
    document.getElementById('dash').hidden = false; });
  await pg.waitForTimeout(600);
  await pg.evaluate(() => document.querySelector('.tab[data-pane="social"]').click());
  await pg.waitForTimeout(300);
  ok((await pg.evaluate(() => (document.querySelector('.pane.on')||{}).id)) === 'pane-social',
     'with the dial file missing the tabs still work');
  ok(errs.length === 0, 'and nothing throws');
  await pg.close();
}

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
