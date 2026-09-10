/* NOOR · the More sheet, on the screens people actually hold.
   ------------------------------------------------------------------
   This file used to hold the dial menu: an orrery of eight balls on a canvas
   sky, opened from one page. It was retired on 9 September 2026 for two
   reasons the owner named and one the measuring found.

     · it existed only on the arrival, so a reader standing in any room on a
       phone had no way to the Prophets at all -- the bar's five doors reach
       five of the forty-two rooms, and the other thirty-seven were behind a
       door that was not on the page they were standing on;
     · it cost 161 KB, 41 of script and 120 of index, on every page carrying it;
     · and it no longer looked like the site it belonged to.

   What replaced it is one sheet, drawn by noor-fx.js and opened by the bar's
   fifth door on every page in the house: the map when the field is empty, the
   search once two letters are typed. So this file's subject moved with it.
   What is held here is what a map has to do:

     · open from the bar, at every size a phone comes in
     · carry the whole library -- 8 sections, 42 rooms, each with its line --
       and agree with assets/menu-index.json, which is where the house keeps it
     · every room in it is a real address, not a link to nowhere
     · fit the screen it is on: nothing off the edge, nothing on top of
       anything, and the field reachable before anything is scrolled
     · close on Escape, on the ground behind it, and on its own button
     · and never trap a reader

   Needs the static server on :8231:  python3 /tmp/vercelish.py 8231
   Then:  node tests/menu.mjs
*/
import { chromium } from 'playwright';
import fs from 'fs';

const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8231';
const SIZES = [
  [320, 568, 'iPhone SE 1'], [360, 640, 'small Android'], [375, 667, 'iPhone SE 3'],
  [390, 844, 'iPhone 14'], [393, 852, 'iPhone 15 Pro'], [430, 932, 'iPhone Pro Max'],
  [360, 780, 'Pixel'], [768, 1024, 'iPad portrait'], [844, 390, 'phone landscape'],
  [1024, 768, 'iPad landscape'], [1440, 900, 'laptop']
];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL ' + m)); };

const br = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

async function open(pg, path = '/index.html') {
  await pg.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2400);
  await pg.evaluate(() => document.querySelector('.n2-bar [data-n2-more]').click());
  await pg.waitForTimeout(900);
}

/* what the sheet has to satisfy, taken from the live DOM */
const measure = pg => pg.evaluate(() => {
  const box = document.querySelector('.nmr');
  if (!box || !box.classList.contains('on')) return { on: false };
  const p = box.querySelector('.nmr-p').getBoundingClientRect();
  const f = box.querySelector('.nmr-f').getBoundingClientRect();
  const body = box.querySelector('.nmr-b');
  const rows = [...box.querySelectorAll('.nmr-r')];
  const rs = rows.map(r => r.getBoundingClientRect());
  return {
    on: true, vw: innerWidth, vh: innerHeight,
    sections: box.querySelectorAll('.nmr-s').length,
    rooms: rows.length,
    hrefs: rows.map(r => r.getAttribute('href')),
    titles: rows.map(r => ((r.querySelector('b') || {}).firstChild || {}).nodeValue || ''),
    left: Math.round(p.left), right: Math.round(p.right),
    top: Math.round(p.top), bottom: Math.round(p.bottom),
    /* the field has to be reachable without scrolling the sheet first */
    fieldTop: Math.round(f.top), fieldH: Math.round(f.height),
    shortest: rs.length ? Math.round(Math.min(...rs.map(r => r.height))) : 0,
    /* no row may sit on top of another */
    overlaps: rs.filter((r, i) => rs.some((q, j) => j > i &&
      r.left < q.right - 1 && q.left < r.right - 1 && r.top < q.bottom - 1 && q.top < r.bottom - 1)).length,
    pageLocked: getComputedStyle(document.body).overflow === 'hidden',
    sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  };
});

/* the house's own list of what the map should contain */
const HOUSE = JSON.parse(fs.readFileSync('assets/menu-index.json', 'utf8'));
const WANT_ROOMS = HOUSE.sections.flatMap(s => (s.items || []).map(i => [i.t, i.u]));

console.log('\n=== the map is the house, and the house is in the map ===');
{
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', e => errors.push(String(e.message)));
  await open(pg);
  const m = await measure(pg);
  ok(m.on, 'the fifth door opens the sheet');
  ok(m.sections === HOUSE.sections.length, 'every section of the library is on it (' + m.sections + ' of ' + HOUSE.sections.length + ')');
  ok(m.rooms === WANT_ROOMS.length, 'and every room (' + m.rooms + ' of ' + WANT_ROOMS.length + ')');
  const missing = WANT_ROOMS.filter(([t]) => !m.titles.includes(t));
  ok(missing.length === 0, 'nothing the house lists is left off it' + (missing.length ? ' (' + missing.slice(0, 3).map(x => x[0]).join(', ') + ')' : ''));
  const wrong = WANT_ROOMS.filter(([t, u]) => { const i = m.titles.indexOf(t); return i >= 0 && m.hrefs[i] !== u; });
  ok(wrong.length === 0, 'and every one of them points where the house says' + (wrong.length ? ' (' + wrong[0][0] + ')' : ''));
  ok(m.titles.includes('The 25 Prophets'), 'the Prophets among them: the room that could not be reached at all');
  ok(errors.length === 0, 'no page errors' + (errors.length ? ' → ' + errors[0].slice(0, 80) : ''));
  await ctx.close();
}

console.log('\n=== every room in it is a real address ===');
{
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  await open(pg);
  const hrefs = (await measure(pg)).hrefs;
  const dead = [];
  for (const h of hrefs) {
    const r = await pg.request.get(BASE + h).catch(() => null);
    if (!r || r.status() >= 400) dead.push(h + ' → ' + (r ? r.status() : 'no answer'));
  }
  ok(dead.length === 0, 'all ' + hrefs.length + ' rooms answer' + (dead.length ? ' (' + dead.slice(0, 3).join(', ') + ')' : ''));
  await ctx.close();
}

console.log('\n=== it fits the screen it is on ===');
for (const [w, h, name] of SIZES) {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 });
  const pg = await ctx.newPage();
  await open(pg);
  const m = await measure(pg);
  const label = name.padEnd(16) + w + '×' + h;
  ok(m.on, label + ': it opens');
  ok(m.on && m.left >= 0 && m.right <= w + 1, label + ': nothing hangs off the side');
  ok(m.on && m.bottom <= h + 1, label + ': nor off the bottom');
  ok(m.on && m.fieldTop >= 0 && m.fieldTop + m.fieldH <= h, label + ': the field is on screen before anything is scrolled');
  ok(m.on && m.shortest >= 40, label + ': every row is a thumb tall (' + m.shortest + ' px)');
  ok(m.on && m.overlaps === 0, label + ': no row sits on another (' + m.overlaps + ')');
  ok(m.on && !m.sideways, label + ': the page behind it is not pushed sideways');
  ok(m.on && m.pageLocked, label + ': and does not scroll under the sheet');
  await ctx.close();
}

console.log('\n=== a reader is never trapped ===');
{
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  const shut = () => pg.evaluate(() => !document.querySelector('.nmr').classList.contains('on'));
  await open(pg);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(800);
  ok(await shut(), 'Escape closes it');
  ok(await pg.evaluate(() => getComputedStyle(document.body).overflow !== 'hidden'), 'and the page can be scrolled again');
  await pg.evaluate(() => document.querySelector('.n2-bar [data-n2-more]').click()); await pg.waitForTimeout(800);
  await pg.evaluate(() => document.querySelector('.nmr-back').click()); await pg.waitForTimeout(800);
  ok(await shut(), 'the ground behind it closes it');
  await pg.evaluate(() => document.querySelector('.n2-bar [data-n2-more]').click()); await pg.waitForTimeout(800);
  await pg.evaluate(() => document.querySelector('.nmr-x').click()); await pg.waitForTimeout(800);
  ok(await shut(), 'and so does its own button');
  await ctx.close();
}

console.log('\n=== the dial it replaced is gone from the house ===');
{
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  for (const path of ['/index.html', '/quran', '/dictionary', '/prophets']) {
    await pg.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(2200);
    const s = await pg.evaluate(() => ({
      dial: !!document.getElementById('nd'),
      script: !!document.querySelector('script[src*="noor-menu"]'),
      door: !!document.querySelector('.n2-bar [data-n2-more]')
    }));
    ok(!s.dial && !s.script, path + ': no dial, and its 161 KB is not fetched');
    ok(s.door, path + ': the map is one tap away instead');
  }
  await ctx.close();
}

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
