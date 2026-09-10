// NOOR e2e v2: 4 pages, 4-way cross-links, deep links, i18n/RTL, em-dash guard, mobile, reduced motion
import { chromium } from 'playwright';
const BASE = 'http://localhost:8123';
let failures = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ FAIL ') + name); if (!cond) failures++; };

const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
async function newPage(ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...ctxOpts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text()); });
  return { ctx, page, errors };
}
/* The house writes without em or en dashes. Revelation and the words of the
   Prophet, peace be upon him, are quoted, not written, so the guard reads the
   page's own prose and leaves a quoted line as the translator set it: the
   arrival's Qur'an 2:186 carries a dash because Sahih International does. */
const noDash = async (page, label) => {
  const bad = await page.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      if (!/[—–]/.test(n.nodeValue)) continue;
      if (n.parentElement && n.parentElement.closest(
        '.n2-quote,.n2-meaning,.n2-quran,.n2-ayah,.n2-ar,.ayah,blockquote,figure,[lang="ar"],[data-quote]')) continue;
      out.push(n.nodeValue.trim().slice(0, 70));
    }
    return out;
  });
  ok(bad.length === 0, `no em/en dash in the house's own prose (${label})` +
     (bad.length ? ' \u2192 ' + bad.slice(0, 2).join(' | ') : ''));
};

/* 1. the arrival
   ------------------------------------------------------------------
   This section used to describe a page that no longer exists: 71 tiles, seven
   period gates, eight filter chips, a hero stat row, the Kun seal, the nine
   mizan cards. The home was rebuilt as the shell's arrival on 9 September 2026
   -- a signpost of six screens -- and the Path it used to hold in tiles is a
   room of its own at /path, server-rendered, which a static server cannot
   answer. tests/home2.mjs holds the arrival to its 242 particulars; what is
   held here is the shape a reader meets, and that nothing throws. */
console.log('\n[1] the arrival');
{
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  ok(errors.length === 0, 'no JS errors' + (errors.length ? ' \u2192 ' + errors.join(' | ') : ''));
  ok(await page.locator('.n2-idea').count() === 6, 'six screens');
  ok(await page.locator('#top .hm-doors a').count() === 4, 'four destinations on the first screen');
  ok(await page.locator('#hm-search').count() === 1, 'one search, above them');
  ok(await page.locator('.n2-bar a').count() === 5, 'the bar carries five doors');
  ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth + 1), 'nothing pushes the page sideways');
  await page.screenshot({ path: 'tests/shots/v3-01-hero.png' });
  await noDash(page, 'the arrival');
  await ctx.close();
}

/* 1b. the scale, which is a sheet now and not a section */
console.log('\n[1b] two lives');
{
  const { ctx, page, errors } = await newPage();
  /* #hm-mizan sits inside the library fold, which is closed until a reader
     opens it. #mizan is the address the arrival answers for on its own, and
     it is how a link from another room lands here, so that is the way in. */
  await page.goto(BASE + '/index.html#mizan', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  ok(await page.locator('.hm-sheet').count() === 1, 'the scale opens as a sheet');
  ok(await page.locator('.hm-sheet .n2-quote').count() === 3, 'three narrations on it');
  ok(await page.locator('.hm-sheet a[href="/soul"]').count() === 1, 'and the way on to the Journey of the Soul');
  await noDash(page, 'the scale');
  ok(errors.length === 0, 'no JS errors' + (errors.length ? ' \u2192 ' + errors.join(' | ') : ''));
  await ctx.close();
}

/* 2. characters hub */
console.log('\n[2] characters.html (hub)');
{
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE + '/characters.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  ok(errors.length === 0, 'no JS errors' + (errors.length ? ' → ' + errors.join(' | ') : ''));
  ok(await page.locator('.tile').count() === 98, '98 character tiles');
  ok(await page.locator('.sgate').count() === 5, '5 section gates');
  await noDash(page, 'characters surface');
  await page.locator('.tile[data-id="c-abuhurayrah"]').scrollIntoViewIfNeeded();
  await page.locator('.tile[data-id="c-abuhurayrah"]').click();
  await page.waitForTimeout(600);
  ok(await page.locator('#modal-backdrop.open').count() === 1, 'Abu Hurayrah modal opens');
  ok(await page.locator('.hadith-item').count() >= 1, 'hadith section renders in hub modal');
  await noDash(page, 'character modal');
  const nl = page.locator('#modal-body .entity-link[data-etype="node"], #modal-body .entity-link[data-etype="place"]').first();
  const et = await nl.getAttribute('data-etype'), eid = await nl.getAttribute('data-eid');
  await nl.click();
  await page.waitForURL(et === 'node' ? '**/index.html*' : '**/places.html*', { timeout: 5000 });
  ok(true, `character→${et} cross-link navigates (${eid})`);
  await page.screenshot({ path: 'tests/shots/v3-03-characters.png' });
  await ctx.close();
}

/* 3. places hub */
console.log('\n[3] places.html');
{
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE + '/places.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  ok(errors.length === 0, 'no JS errors' + (errors.length ? ' → ' + errors.join(' | ') : ''));
  ok(await page.locator('.tile').count() === 34, '34 place tiles');
  ok(await page.locator('.sgate').count() === 5, '5 sections');
  await page.screenshot({ path: 'tests/shots/v3-04-places.png' });
  await noDash(page, 'places surface');
  await page.locator('.tile[data-id="p-kaaba"]').click();
  await page.waitForTimeout(600);
  ok(await page.locator('#modal-backdrop.open').count() === 1, 'Kaaba modal opens');
  ok(await page.locator('#modal-body .entity-link').count() >= 5, 'Kaaba modal richly autolinked');
  await page.screenshot({ path: 'tests/shots/v3-05-place-kaaba.png' });
  await ctx.close();
}

/* 4. words hub */
console.log('\n[4] words.html');
{
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE + '/words.html?open=w-hasbunallah', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  ok(errors.length === 0, 'no JS errors' + (errors.length ? ' → ' + errors.join(' | ') : ''));
  ok(await page.locator('.tile').count() === 18, '18 word tiles');
  ok(await page.locator('#modal-backdrop.open').count() === 1, '?open=w-hasbunallah auto-opens');
  ok(await page.locator('.word-ar').count() === 1, 'Arabic block renders');
  ok(await page.locator('.whennow li').count() >= 2, '“Say it now” section renders');
  ok(await page.locator('.audio-btn').count() >= 1, 'tilawah button on word ayah');
  await noDash(page, 'word modal');
  await page.screenshot({ path: 'tests/shots/v3-06-word.png' });
  /* A word's chapter link lands on the arrival at ?node=, which opens the
     chapter as a preview sheet and points at its room. See section 5. */
  const nl = page.locator('#modal-body .entity-link[data-etype="node"]').first();
  await nl.click();
  await page.waitForURL('**/index.html*', { timeout: 5000 });
  await page.waitForTimeout(1600);
  ok(await page.locator('.n2-sheet-wrap.n2-show').count() === 1, 'word\u2192chapter opens the chapter');
  await ctx.close();
}

/* 5. deep links + nihaya + i18n/RTL */
console.log('\n[5] deep links · nihaya · RTL');
{
  const { ctx, page } = await newPage();
  /* ?node= and #node- are links that are out in the world, so they must keep
     landing. What they open changed on 9 September 2026: the arrival gives the
     chapter as a preview sheet -- its name, its Arabic, a few lines -- and the
     chapter itself is a room of its own at /path/:n, server-rendered, with the
     sequence, the timeline and the shield in it. So the deep link is held to
     naming the right chapter and carrying the reader on to it. */
  await page.goto(BASE + '/index.html?node=55', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  ok(await page.locator('.n2-sheet-wrap.n2-show').count() === 1, '?node=55 auto-opens (Dajjal)');
  ok(/Dajjal/i.test(await page.locator('.n2-sheet').innerText()), 'and it is the right chapter');
  ok(await page.locator('.n2-sheet a[href="/path/55"]').count() === 1, 'and it carries the way on to the chapter itself');
  await noDash(page, 'Dajjal preview');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  /* The language <select> became a grid of buttons behind the language door,
     which is opened first. Set the language the way the buttons do. */
  await page.locator('#lang-btn').click();
  await page.waitForTimeout(700);
  await page.evaluate(() => document.querySelector('[data-setlang="ar"]').click());
  await page.waitForTimeout(700);
  ok(await page.evaluate(() => document.documentElement.dir) === 'rtl', 'AR \u2192 dir=rtl');
  /* choosing a language closes the door behind it, so open it again to come back */
  await page.locator('#lang-btn').click();
  await page.waitForTimeout(700);
  await page.evaluate(() => document.querySelector('[data-setlang="en"]').click());
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.documentElement.dir) === 'ltr', 'EN → ltr');
  await ctx.close();
}

/* 6. mobile */
console.log('\n[6] mobile 390×844');
{
  const { ctx, page, errors } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  ok(errors.length === 0, 'no JS errors mobile');
  ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
  /* The arrival has no header list of rooms any more: the bar under the thumb
     carries the five doors, and everything else is one tap behind the library
     fold or the search. What matters is that a phone can still reach a room. */
  ok(await page.locator('.n2-bar a').count() === 5, 'the bar under the thumb carries five doors');
  ok(await page.locator('#library a[href="/places"], #library a[href="/places.html"]').count() >= 1,
     'the library fold can still reach Places');
  await page.screenshot({ path: 'tests/shots/v3-07-hero-mobile.png' });
  await page.goto(BASE + '/words.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth + 1), 'words page: no overflow mobile');
  await ctx.close();
}

/* 7. reduced motion + search */
console.log('\n[7] reduced motion · search');
{
  const { ctx, page, errors } = await newPage({ reducedMotion: 'reduce' });
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  ok(errors.length === 0 && await page.locator('.n2-idea').count() === 6, 'reduced motion healthy: the six screens are all there');
  /* The "/" key opens the one sheet the whole site now has: the map of the
     house when it is empty, the search once two letters are typed. It used to
     open assets/noor-search.js's own overlay while the bar's Search opened a
     dial, which is the split this replaced. */
  await page.keyboard.press('/');
  await page.waitForSelector('#nmr-q', { timeout: 8000 });
  ok(await page.locator('.nmr .nmr-r').count() === 42, 'the whole library is under the key');
  await page.fill('#nmr-q', 'kawthar');
  await page.waitForTimeout(700);
  ok(await page.locator('.nmr-r').count() >= 1, 'and two letters make it the search: Kawthar (Hawd)');
  const href = await page.locator('.nmr-r').first().getAttribute('href');
  await page.locator('.nmr-r').first().click();
  await page.waitForTimeout(900);
  const landed = await page.evaluate(() => ({
    modal: document.querySelectorAll('#modal-backdrop.open').length,
    url: location.pathname + location.search,
    text: document.body.innerText.length
  }));
  /* A result either opens a chapter in place, or carries the reader to the room
     that answers. Searching "kawthar" landing on the Mushaf at surah 108 is the
     right answer, not a miss. */
  ok(landed.modal === 1 || !/index\.html$/.test(landed.url),
     `search result leads somewhere real (${href} \u2192 ${landed.url})`);
  ok(!/^\/dictionary#/.test(href || ''),
     'a word result opens the word\'s own room, not an anchor on the 220KB hub');
  await ctx.close();
}

/* 8. kids: The Greatest Game */
console.log('\n[8] kids.html');
{
  const { ctx, page, errors } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(BASE + '/kids.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  ok(errors.length === 0, 'no JS errors' + (errors.length ? ' → ' + errors.join(' | ') : ''));
  ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
  ok(await page.locator('button:has-text("Fastest")').count() >= 1, 'star map shows rounds');
  await noDash(page, 'kids map');
  await page.locator('button:has-text("Fastest")').first().click();
  await page.waitForTimeout(700);
  ok(await page.evaluate(() => document.body.innerText.includes('FASTEST')), 'round question shown');
  for (let i = 0; i < 6; i++) {
    const btn = page.locator('main button:visible').last();
    if (await btn.count()) { await btn.click(); await page.waitForTimeout(850); }
  }
  ok(await page.evaluate(() => /1 of 7/.test(document.body.innerText)), 'gem collected, back on star map');
  /* The list of games grows. Pinning a number here made every addition look
     like a break, so what is checked is that the page counts itself: every
     game card, every hero story, plus the star map, and the line the child
     reads agrees with the cards on the screen. */
  const cards = await page.locator('.w-card').count();
  const heroes = await page.locator('.w-hero').count();
  ok(cards >= 9, `More Wonders: ${cards} game cards`);
  ok(heroes === 2, 'Hero Stories: 2 highlighted cards');
  const wtext = await page.evaluate(() => document.getElementById('wcount').textContent);
  ok(new RegExp('\\b' + (cards + heroes + 1) + '\\b').test(wtext),
     `wonders counter agrees with the cards on the page (${cards}+${heroes}+1, reads "${wtext.trim()}")`);
  await ctx.close();
}

/* 8b. nine game pages smoke */
console.log('\n[8b] nine little games');
{
  const { ctx, page, errors } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  for (const g of ['story-steps','ark-pairs','star-catcher','kaaba-builder','zamzam','yunus','orchard','lanterns','echo','strong','island','mushaf','letters','practice','cradle']) {
    errors.length = 0;
    await page.goto(BASE + '/kids/' + g + '.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const ov = await page.evaluate(() => document.body.scrollWidth > innerWidth + 1);
    const dash = await page.evaluate(() => /[—–]/.test(document.body.innerText));
    ok(errors.length === 0 && !ov && !dash, `${g}: loads clean, no overflow, no dashes` + (errors.length ? ' → ' + errors.join('|') : ''));
    ok(await page.locator('a[href="/kids"], a[href="../kids.html"]').count() >= 1, `${g}: links back to Little Codex`);
  }
  await ctx.close();
}

/* 9. guide: quiet clarifier */
console.log('\n[9] guide');
{
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE + '/index.html?node=55', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  ok(await page.locator('.ng-pill').count() === 1, 'guide pill on sensitive chapter (Dajjal)');
  await page.locator('.ng-pill').click();
  await page.waitForTimeout(400);
  ok(await page.locator('.ng-chip').count() === 3, 'three suggested questions');
  await page.locator('.ng-chip').first().click();
  await page.waitForTimeout(300);
  ok(await page.locator('.ng-a').count() === 1, 'curated answer renders');
  await page.fill('.ng-in', 'what is isnad');
  await page.locator('.ng-go').click();
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.querySelector('.ng-a')?.innerText.toLowerCase().includes('isnad')), 'free text hits glossary');
  await noDash(page, 'guide sheet');
  await page.keyboard.press('Escape');
  await page.goto(BASE + '/index.html?node=38', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  ok(await page.locator('.ng-pill').count() === 0, 'no pill on non-sensitive chapter (Badr)');
  await page.goto(BASE + '/characters.html?open=j-iblis', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  ok(await page.locator('.ng-pill').count() === 1, 'guide pill on Iblis seal');
  ok(errors.length === 0, 'no JS errors in guide flows' + (errors.length ? ' → ' + errors.join(' | ') : ''));
  await ctx.close();
}

/* 10. health page */
console.log('\n[10] health.html');
{
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE + '/health.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  ok(errors.length === 0, 'no JS errors' + (errors.length ? ' → ' + errors.join(' | ') : ''));
  ok(await page.locator('.th-sec').count() === 9, '9 sections render');
  ok(await page.locator('.duo').count() >= 6, 'sunnah|science duo cards');
  ok(await page.locator('.food').count() === 6, 'six plate medallions');
  ok(await page.locator('#rail a').count() === 8, 'scrollspy rail');
  const cnt = await page.locator('#th-hero [data-count]').first().textContent();
  ok(cnt === '5', `hero counters animate (${cnt})`);
  await page.locator('#measure').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1800);
  ok(await page.locator('.v-band').count() === 3, 'vessel of thirds present');
  await noDash(page, 'health surface');
  await page.screenshot({ path: 'tests/shots/v8-health-e2e.png' });
  await ctx.close();
}
{
  const { ctx, page } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(BASE + '/health.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth + 1), 'health mobile: no overflow');
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  /* clean URLs dropped the .html, and the pill row became the doors sheet */
  ok(await page.locator('a[href="/health"], a[href="health.html"]').count() >= 1, 'Health reachable from the home page');
  await ctx.close();
}

/* 11. the mission line, and Friday's claim on the strip
   The per-market sponsorship program was retired: sponsor.js now carries one
   sentence, and steps aside for Jumu'ah from Thursday evening to Friday
   maghrib. These are the promises left to keep. */
console.log('\n[11] the mission line · Jumu\'ah');
{
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  ok(await page.evaluate(() => !window.NOOR_SPONSORS && !window.NOOR_SPONSOR_PICK),
     'the retired market system left no globals behind');
  ok(await page.locator('a[href="/sponsor"], a[href="sponsor.html"], a[href="/donate"], a[href="donate.html"]').count() >= 1,
     'the reader can still reach the way to give');
  ok(errors.length === 0, 'no JS errors' + (errors.length ? ' \u2192 ' + errors.join(' | ') : ''));
  await ctx.close();
}
/* Friday is a card now, not a band. The band hung off #site-header, which the
   arrival has not had since it was rebuilt, so the best day of the week
   reached every room in the house except the one every reader arrives
   through. And a band is furniture -- there on Tuesday too, so the eye has
   learned to skip that strip. The card comes once, a breath after the page
   settles, above the thumb, and goes again whether it is answered or not.
   What is held: that it comes on Friday and on Thursday evening, on every
   kind of page; that it asks once and not twice; that it is not there on a
   Tuesday; that it blocks nothing; and that it does not move for a reader who
   has asked for no motion. */
console.log('\n[11b] Friday, once');
{
  const FRIDAY = '2026-09-11T10:00:00', TUESDAY = '2026-09-08T10:00:00', EVE = '2026-09-10T19:30:00';
  /* the clock, pinned before anything on the page runs. The stamp has to be
     passed in as an argument: an init script is serialised and sent, so a
     closure over a variable in this file arrives undefined, and the page gets
     an Invalid Date and no card -- which looks exactly like the bug it would
     be reporting. */
  const pin = when => {
    const F = new Date(when), R = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends R { constructor(...a) { return a.length ? new R(...a) : new R(F.getTime()); } static now() { return F.getTime(); } };
  };
  async function look(when, paths) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript(pin, when);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const out = [];
    for (const path of paths) {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3400);
      out.push(await page.evaluate(() => {
        const c = document.querySelector('.nj');
        if (!c) return { card: false };
        const b = c.getBoundingClientRect();
        return { card: true, on: c.classList.contains('on'), w: Math.round(b.width),
                 link: c.querySelector('.nj-a').getAttribute('href'),
                 locked: getComputedStyle(document.body).overflow === 'hidden',
                 wide: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
                 bands: document.querySelectorAll('[data-jumuah]').length };
      }));
    }
    await ctx.close();
    return { out, errors };
  }
  const fri = await look(FRIDAY, ['/index.html', '/quran', '/dictionary/sabr']);
  ok(fri.out[0].card && fri.out[0].on, 'Friday: the card comes on the arrival');
  ok(fri.out[0].link === '/quran?surah=18', 'and it opens al-Kahf');
  ok(!fri.out[0].locked && !fri.out[0].wide, 'and it locks nothing and pushes nothing sideways');
  ok(fri.out[0].bands === 0, 'and no page carries the old band as well');
  ok(!fri.out[1].card && !fri.out[2].card, 'and it asks once, not on every room after it');
  ok(fri.errors.length === 0, 'no JS errors on Friday' + (fri.errors.length ? ' \u2192 ' + fri.errors[0].slice(0, 90) : ''));
  const eve = await look(EVE, ['/index.html']);
  ok(eve.out[0].card, "Thursday evening: the day has turned, so the card is there");
  const tue = await look(TUESDAY, ['/index.html', '/quran']);
  ok(!tue.out[0].card && !tue.out[1].card, 'Tuesday: nothing');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(BASE + '/index.html?jumuah=1', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3400);
    const r = await page.evaluate(() => {
      const c = document.querySelector('.nj');
      return c ? { card: true, t: getComputedStyle(c).transitionDuration,
                   a: getComputedStyle(c.querySelector('.nj-m')).animationName } : { card: false };
    });
    ok(r.card && r.t === '0s' && r.a === 'none', 'a reader who asked for no motion is given none');
    await ctx.close();
  }
}
{
  /* the one sentence the band still carries, every day */
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE + '/quran', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1100);
  const band = await page.evaluate(() => {
    const d = document.querySelector('[data-noor-sponsor]');
    return d ? d.innerText : '';
  });
  ok(/free|gifts/i.test(band), 'the mission line is on a room that carries the shared header');
  ok(errors.length === 0, 'no JS errors on the mission line');
  await ctx.close();
}
{
  /* The sponsor page no longer carries an application form for a market
     program that was retired. What it must still do is open cleanly and point
     a willing reader at the way to give. */
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE + '/sponsor.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  ok(errors.length === 0, 'sponsor page: no JS errors' + (errors.length ? ' \u2192 ' + errors.join(' | ') : ''));
  ok(await page.locator('a[href="/donate"], a[href="donate.html"], a[href*="donate"]').count() >= 1, 'the way to give is one click away');
  await noDash(page, 'sponsor page');
  await ctx.close();
}
{
  /* The console. The structural guard lives in scripts/check-admin.mjs and runs
     on the file; this is the live half of it, because the bug that actually hit
     was a pane that existed in the markup and could not be reached in a
     browser. Every tab must reveal its own pane and no other. */
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE + '/admin.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  ok(errors.length === 0, 'admin.html: no JS errors' + (errors.length ? ' \u2192 ' + errors.join(' | ') : ''));
  ok(await page.evaluate(() => document.querySelector('meta[name="robots"]').content.includes('noindex')), 'console is noindex');
  /* The console lives behind a password gate that needs the api/ folder. The
     tests run against a static server, so open the dashboard the way a
     successful login does and then walk it. */
  await page.evaluate(() => {
    const g = document.getElementById('gate'), d = document.getElementById('dash');
    if (g) g.hidden = true;
    if (d) d.hidden = false;
  });
  await page.waitForTimeout(300);
  const tabs = await page.locator('.tab').count();
  ok(tabs >= 8, `console has its tabs (${tabs})`);
  let reachable = 0, blank = [];
  for (let i = 0; i < tabs; i++) {
    await page.locator('.tab').nth(i).click();
    await page.waitForTimeout(120);
    const st = await page.evaluate(() => {
      const on = [...document.querySelectorAll('.pane.on')];
      if (on.length !== 1) return { bad: 'panes on: ' + on.length };
      const p = on[0], r = p.getBoundingClientRect();
      return { ok: r.width > 0 && r.height > 0 && p.innerText.trim().length > 0, id: p.id || '(no id)' };
    });
    if (st.ok) reachable++; else blank.push(st.id || st.bad);
  }
  ok(reachable === tabs, `every tab opens a pane that is visible and not blank${blank.length ? ' \u2192 ' + blank.join(', ') : ''}`);
  /* /api/* is not served here, so its 401s and 404s are the harness. */
  const admErr = errors.filter(e => !/\/api\/|Failed to load resource|Unexpected token|JSON/i.test(e));
  ok(admErr.length === 0, 'no JS errors after walking every tab' + (admErr.length ? ' \u2192 ' + admErr.join(' | ') : ''));
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? '\nALL TESTS PASSED ✅' : `\n${failures} TEST(S) FAILED ❌`);
process.exit(failures ? 1 : 0);
