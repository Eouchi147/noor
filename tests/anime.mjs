/* NOOR · the illumination layer keeps its promises.
   ------------------------------------------------------------------
   assets/noor-anime.js is on every page. Motion is the second telling;
   the first is that every word is there. So this holds the layer to what
   it says at the top of its own file:

     · the house language plays (.mo rises, .mo-draw draws, counters count)
     · nothing a reader has scrolled to stays hidden, on any page
     · reduced motion means the library is not even fetched
     · a small device is left alone, and still sees everything
     · the Mushaf's verses are never transformed, only lit
     · NOOR_MO.animate() is there for the rooms that call it
     · no page throws, and none grows a horizontal scrollbar

   Needs the static server on :8433:  python3 /tmp/vercelish.py
   Then:  node tests/anime.mjs
*/
import { chromium } from 'playwright';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8433';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL ' + m)); };

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

/* the sandbox reports few cores, which the layer reads as a small device;
   a capable profile is what most readers actually have */
async function open(path, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 },
    reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  if (!opts.small) await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  return { ctx, page, errors };
}
const walk = page => page.evaluate(async () => {
  for (let y = 0; y <= document.body.scrollHeight; y += 450) { scrollTo(0, y); await new Promise(r => setTimeout(r, 70)); }
});
/* anything the layer held that the reader has now reached and that is
   still faint: at the foot of the page that must be nothing */
const faint = page => page.evaluate(() => [...document.querySelectorAll('*')].filter(el => {
  if (!el.__na) return false;
  const r = el.getBoundingClientRect(); if (!r.height) return false;
  return r.top < innerHeight && parseFloat(getComputedStyle(el).opacity) < 0.99;
}).length);

console.log('\n=== 1. the layer is alive on a room, and speaks the house language ===');
{
  const { ctx, page, errors } = await open('/heroes.html');
  const s = await page.evaluate(() => ({
    engine: window.NOOR_MO && window.NOOR_MO.engine, lib: !!(window.anime && window.anime.animate),
    api: !!(window.NOOR_MO && typeof window.NOOR_MO.animate === 'function'),
    held: document.querySelectorAll('.mo[style*="opacity: 0"]').length,
    marked: document.querySelectorAll('.mo').length
  }));
  ok(s.engine === 'anime' && s.lib, 'anime.js is loaded and the engine reports itself');
  ok(s.api, 'NOOR_MO.animate is there for the rooms that call it');
  ok(s.held > 0 && s.held < s.marked, 'cards below the fold are held, cards above it are not (' + s.held + ' of ' + s.marked + ')');
  await walk(page); await page.waitForTimeout(1800);
  ok((await faint(page)) === 0, 'after reading to the foot, nothing is left faint');
  const drawn = await page.evaluate(() => [...document.querySelectorAll('.mo-draw')].filter(f => f.__naDrawn).length);
  ok(drawn > 0, 'the figures drew themselves on (' + drawn + ')');
  ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
  ok(errors.length === 0, 'no page errors (' + errors.join(' | ').slice(0, 120) + ')');
  await ctx.close();
}

console.log('\n=== 2. an unmarked room gets the same telling ===');
{
  const { ctx, page, errors } = await open('/prophets.html');
  const held = await page.evaluate(() => document.querySelectorAll('[style*="opacity: 0"]').length);
  ok(held > 0, 'cards the generator never marked are held below the fold (' + held + ')');
  await walk(page); await page.waitForTimeout(1800);
  ok((await faint(page)) === 0, 'and every one of them is released by the foot of the page');
  ok(errors.length === 0, 'no page errors');
  await ctx.close();
}

console.log('\n=== 3. the Encyclopedia, a page that grows while you scroll ===');
{
  const { ctx, page, errors } = await open('/dictionary.html');
  await walk(page); await page.waitForTimeout(1800);
  ok((await faint(page)) === 0, 'no entry the reader reached stays faint');
  ok(errors.length === 0, 'no page errors');
  await ctx.close();
}

console.log('\n=== 4. reduced motion means no motion, and no download ===');
{
  const { ctx, page, errors } = await open('/heroes.html', { reduce: true });
  const s = await page.evaluate(() => ({ engine: window.NOOR_MO && window.NOOR_MO.engine, why: window.NOOR_MO && window.NOOR_MO.why,
    lib: !!window.anime, held: document.querySelectorAll('[style*="opacity: 0"]').length }));
  ok(s.engine === 'still' && /reduced/.test(s.why || ''), 'the layer stands down and says why (' + s.why + ')');
  ok(!s.lib, 'the library is not even fetched');
  ok(s.held === 0, 'nothing is held');
  ok(errors.length === 0, 'no page errors');
  await ctx.close();
}

console.log('\n=== 5. a small device is left alone and still sees everything ===');
{
  const { ctx, page } = await open('/prophets.html', { small: true });
  const s = await page.evaluate(() => ({ engine: window.NOOR_MO && window.NOOR_MO.engine,
    held: [...document.querySelectorAll('*')].filter(el => el.__na).length, lib: !!window.anime }));
  ok(s.engine === 'still' || s.engine === 'anime', 'the layer decided (' + s.engine + ')');
  if (s.engine === 'still') { ok(s.held === 0, 'and declining means the layer held nothing'); ok(!s.lib, 'and fetched nothing'); }
  await ctx.close();
}

console.log('\n=== 6. the Mushaf: verses are lit, never moved ===');
{
  /* the text service is stubbed, as in tests/mushaf.mjs: this runs with no network */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }); });
  const errors = []; page.on('pageerror', e => errors.push(String(e.message)));
  await page.route('**/api.alquran.cloud/**', r => {
    const u = new URL(r.request().url()); const p = u.pathname.split('/'); const ed = p[4] !== 'quran-uthmani';
    const ayahs = []; for (let i = 1; i <= 7; i++) ayahs.push({ numberInSurah: i, text: ed ? 'T' + i : 'ا'.repeat(3) });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, status: 'OK', data: { number: 1, ayahs } }) });
  });
  await page.goto(BASE + '/quran.html?surah=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ayah', { timeout: 15000 });
  await page.waitForTimeout(2200);
  const s = await page.evaluate(() => ({
    moved: [...document.querySelectorAll('.ayah')].filter(a => a.__na || (a.style.transform || '') !== '').length,
    engine: window.NOOR_MO && window.NOOR_MO.engine
  }));
  ok(s.moved === 0, 'no verse was held or transformed by the layer');
  ok(errors.length === 0, 'no page errors');
  await ctx.close();
}

console.log('\n=== 7. the word pages arrive quietly ===');
/* The 523 words moved to /dictionary/ on 9 September 2026 and were rebuilt in
   the shell, so this layer is not theirs any more: the shell runs its own
   arrival and noor-anime.js must stay out of the way. The promise the section
   was written for is unchanged -- the opening line and the meaning are fully
   there once the page settles -- only the address and the engine moved. That
   the shell's own reveal holds is tests/dictionary2.mjs's job. */
{
  const { ctx, page, errors } = await open('/dictionary/wudu.html');
  /* the shell reveals a screen when it comes into view and settles it on the
     spring; wait for the settling rather than for a clock */
  const s = await page.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      if (getComputedStyle(document.querySelector('.n2-h1')).opacity === '1') break;
      await new Promise(r => setTimeout(r, 100));
    }
    return {
    h1: getComputedStyle(document.querySelector('.n2-h1')).opacity,
    meaning: getComputedStyle(document.querySelector('.n2-meaning')).opacity,
    shell: document.documentElement.hasAttribute('data-n2'),
    engine: window.NOOR_MO && window.NOOR_MO.engine
  }; });
  ok(s.shell === true, 'a word page is in the shell');
  ok(!s.engine, 'the illumination layer stays out: the shell has its own arrival');
  ok(s.h1 === '1' && s.meaning === '1', 'the opening line and the meaning are fully there after the arrival');
  ok(errors.length === 0, 'no page errors');
  await ctx.close();
}

console.log('\n=== 8. One door to the whole library, on every kind of page ===');
/* The bar's fifth door was Search, and five doors could not reach forty-two
   rooms: the other thirty-seven were behind a dial that only the arrival
   carried, so a reader standing in a room on a phone could not get to the
   Prophets at all. It is More now. One sheet, drawn by noor-fx.js: the map of
   the house when it is empty, the search once two letters are typed. Held on
   all three kinds of page, because each gets its bar a different way -- the
   arrival writes it, the generator bakes it into a word page, and noor2.js
   draws it on an older room. */
for (const [where, path] of [['a shell page', '/index.html'],
                             ['an older room', '/heroes.html'],
                             ['a word page', '/dictionary/wudu.html']]) {
  const { ctx, page, errors } = await open(path);
  const s = await page.evaluate(async () => {
    const door = document.querySelector('.n2-bar [data-n2-more]');
    if (!door) return { open: false, why: 'no More door' };
    const label = door.textContent.trim();
    door.click();
    await new Promise(r => setTimeout(r, 800));
    const box = document.querySelector('.nmr');
    if (!box || !box.classList.contains('on')) return { open: false, label };
    const rgb = el => getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number);
    const lum = c => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
    const p = box.querySelector('.nmr-p'), r = p.getBoundingClientRect();
    return {
      open: true, label,
      sections: box.querySelectorAll('.nmr-s').length,
      rooms: box.querySelectorAll('.nmr-r').length,
      prophets: !!box.querySelector('a[href="/prophets"]'),
      night: lum(rgb(p)) < 0.2,
      dial: !!document.getElementById('nd'),
      w: Math.round(r.width), inView: r.top < innerHeight && r.bottom > 0,
      wide: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    };
  });
  ok(s.label === 'More', where + ': the fifth door says More (' + s.label + ')');
  ok(s.open === true, where + ': and it opens the sheet');
  ok(s.open && s.sections === 8 && s.rooms === 42, where + ': the whole library, 8 sections and 42 rooms');
  ok(s.open && s.prophets, where + ': the Prophets among them, two taps from anywhere');
  ok(s.open && s.night, where + ': the sheet is night, not parchment');
  ok(s.open && s.inView && !s.wide, where + ': it is on the screen and pushes nothing sideways');
  ok(s.open && !s.dial, where + ': the dial it replaced is gone');
  ok(errors.length === 0, where + ': no page errors' + (errors.length ? ' \u2192 ' + errors[0].slice(0, 80) : ''));
  await ctx.close();
}

console.log('\n=== 9. two letters, and the map becomes the answer ===');
{
  const { ctx, page, errors } = await open('/index.html');
  const s = await page.evaluate(async () => {
    document.querySelector('.n2-bar [data-n2-more]').click();
    await new Promise(r => setTimeout(r, 500));
    const q = document.getElementById('nmr-q'), out = {};
    for (const term of ['kahf', 'musa', 'sabr']) {
      q.value = term; q.dispatchEvent(new Event('input', { bubbles: true }));
      /* wait for the answer, not for a clock: on a cold index the first query
         waits on 311 KB, and a fixed pause read the map that was still on the
         screen underneath it as though it were the result */
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 100));
        if (document.querySelectorAll('.nmr-r').length !== 42) break;
      }
      out[term] = { n: document.querySelectorAll('.nmr-r').length,
                    first: (document.querySelector('.nmr-r b') || {}).textContent || '',
                    groups: [...document.querySelectorAll('.nmr-s')].map(e => e.firstChild.nodeValue.trim()) };
    }
    q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    out.empty = document.querySelectorAll('.nmr-r').length;
    return out;
  });
  /* The index carries 523 words, 1,183 entities and 66 rooms. When the
     dictionary was regenerated on 9 September 2026 the script rewrote the
     whole file and knew how to build only the words, so for four hours the
     search could find a word and thirty rooms and nothing else -- no prophet,
     no companion, no place, no surah. These three terms each reach a
     different half of it. */
  ok(s.kahf.n > 0 && /Kahf/i.test(s.kahf.first), 'kahf finds the surah (' + s.kahf.first + ')');
  ok(s.musa.n > 4, 'musa finds the prophet and what stands around him (' + s.musa.n + ')');
  ok(s.sabr.n > 0 && /Sabr/i.test(s.sabr.first), 'sabr finds the word');
  ok(s.musa.groups.length > 1, 'and the answers come grouped, best group first (' + s.musa.groups.join(', ') + ')');
  ok(!s.musa.groups.some(g => /^(words|rooms|people|quran)$/.test(g)), 'the groups are named, not keyed');
  ok(s.empty === 42, 'an empty field is the map again');
  ok(errors.length === 0, 'no page errors');
  await ctx.close();
}

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
