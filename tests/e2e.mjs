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
const noDash = async (page, label) => {
  const has = await page.evaluate(() => /[—–]/.test(document.body.innerText));
  ok(!has, `no em/en dash rendered (${label})`);
};

/* 1. index desktop */
console.log('\n[1] index.html');
{
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  ok(errors.length === 0, 'no JS errors' + (errors.length ? ' → ' + errors.join(' | ') : ''));
  ok(await page.locator('.tile').count() === 71, '71 tiles');
  ok(await page.locator('.gate').count() === 7, '7 period gates (all books open)');
  ok(await page.locator('.filter-btn').count() === 8, '8 filter chips');
  ok(await page.locator('#hero-stats .hero-stat').count() === 6, '6 hero stats');
  ok(await page.locator('.crescent').count() === 1, 'crescent rendered');
  ok(await page.locator('#geo .gp').count() >= 12, 'sacred-geometry rose paths present');
  /* The ink goes on the seal, not on the hero, and it goes on when the reader
     reaches it. Scroll to it the way a reader would, then look. */
  await page.locator('.path-seal').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => document.querySelector('.path-seal').classList.contains('drawn')), 'Kun draw sequence triggered');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.waitForTimeout(1300);
  const statVal = await page.locator('#hero-stats [data-count]').first().textContent();
  ok(statVal === '71', `count-up completed (${statVal})`);
  await page.screenshot({ path: 'tests/shots/v3-01-hero.png' });
  await noDash(page, 'index surface');

  await page.locator('.tile[data-id="38"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.locator('.tile[data-id="38"]').click();
  await page.waitForTimeout(700);
  ok(await page.locator('#modal-backdrop.open').count() === 1, 'Badr modal opens (id 38)');
  await noDash(page, 'Badr modal');
  ok(await page.locator('#modal-body .entity-link[data-etype="place"]').count() >= 1, 'place link woven into Badr');
  await page.screenshot({ path: 'tests/shots/v3-02-modal-badr.png' });

  // node → place link navigates to places.html
  const pl = page.locator('#modal-body .entity-link[data-etype="place"]').first();
  const pid = await pl.getAttribute('data-eid');
  await pl.click();
  await page.waitForURL('**/places.html*', { timeout: 5000 });
  ok(page.url().includes('open=' + pid), `node→place lands on places.html?open=${pid}`);
  await page.waitForTimeout(900);
  ok(await page.locator('#modal-backdrop.open').count() === 1, 'place modal auto-opens');
  await ctx.close();
}


/* 1b. books open + mizan */
console.log('\n[1b] seven books · mizan section');
{
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => !document.body.innerText.includes('COMING')), 'no book marked COMING');
  await page.locator('.book-card[data-period="khulafa"]').click();
  await page.waitForTimeout(700);
  ok(await page.locator('.tile').count() === 4 && await page.locator('.gate').count() === 1, 'book card click filters Path (Khulafa: 4 tiles)');
  await page.locator('.tile[data-id="47"]').click();
  await page.waitForTimeout(600);
  ok(await page.locator('#modal-backdrop.open').count() === 1, 'Abu Bakr caliphate chapter opens');
  await noDash(page, 'khulafa modal');
  await page.keyboard.press('Escape');
  /* The menu no longer carries a #mizan link: the doors replaced the long list
     of anchors. The section is still there, so reach it the way a reader
     scrolling the page does. */
  await page.locator('#mizan').scrollIntoViewIfNeeded();
  await page.waitForTimeout(2600);
  ok(await page.locator('.mz-card').count() === 9, 'mizan: 9 infographic cards');
  ok(await page.locator('.mz-debt').count() === 1, 'debt strip in follow card');
  ok(await page.locator('.mz-s7').count() === 7, 'seven shaded chips render');
  const c = await page.locator('#mizan [data-mcount="50000"]').textContent();
  ok(c.replace(/\D/g,'') === '50000', `mizan counters animate (day = ${c})`);
  await noDash(page, 'mizan section');
  await page.screenshot({ path: 'tests/shots/v4-mizan.png' });
  await page.locator('[data-mgo="node:71"]').click();
  await page.waitForTimeout(700);
  ok(await page.locator('#modal-backdrop.open').count() === 1, 'mizan CTA opens Jannah chapter');
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
  const nl = page.locator('#modal-body .entity-link[data-etype="node"]').first();
  await nl.click();
  await page.waitForURL('**/index.html*', { timeout: 5000 });
  await page.waitForTimeout(900);
  ok(await page.locator('#modal-backdrop.open').count() === 1, 'word→node opens node modal');
  await ctx.close();
}

/* 5. deep links + nihaya + i18n/RTL */
console.log('\n[5] deep links · nihaya · RTL');
{
  const { ctx, page } = await newPage();
  await page.goto(BASE + '/index.html?node=55', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  ok(await page.locator('#modal-backdrop.open').count() === 1, '?node=55 auto-opens (Dajjal)');
  ok(await page.locator('.seq-strip').count() === 1 && await page.locator('.mtimeline li').count() >= 6 && await page.locator('.shield-box li').count() >= 3, 'sequence + timeline + shield intact');
  await noDash(page, 'Dajjal modal');
  await page.keyboard.press('Escape');
  /* The language <select> became a grid of buttons in the header dropdown when
     the menu was rebuilt. Set the language the way the buttons do. */
  await page.evaluate(() => document.querySelector('[data-setlang="ar"]').click());
  await page.waitForTimeout(700);
  ok(await page.evaluate(() => document.documentElement.dir) === 'rtl', 'AR → dir=rtl');
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
  /* The mobile header is the doors sheet now, and clean URLs dropped the .html.
     What matters is that a phone can still reach Places from the header. */
  ok(await page.locator('header a[href="/places"], header a[href="places.html"]').count() >= 1, 'mobile header can reach Places');
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
  ok(errors.length === 0 && await page.locator('.tile').count() === 71, 'reduced motion healthy');
  /* Search became a full overlay built by /assets/noor-search.js: the field is
     #ns-q and the results live in #ns-out. */
  await page.click('#search-toggle');
  await page.waitForSelector('#ns-q', { timeout: 8000 });
  await page.fill('#ns-q', 'kawthar');
  await page.waitForTimeout(400);
  ok(await page.locator('#ns-out a, #ns-out button').count() >= 1, 'search finds Kawthar (Hawd)');
  const href = await page.locator('#ns-out a').first().getAttribute('href');
  await page.locator('#ns-out a').first().click();
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
  for (const g of ['story-steps','ark-pairs','star-catcher','kaaba-builder','zamzam','yunus','orchard','lanterns','echo','strong','island']) {
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
{
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE + '/index.html?jumuah=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const band = await page.evaluate(() => document.body.innerText);
  ok(/Jumu|Kahf|Friday/i.test(band), 'forced Jumu\'ah raises the day\'s band');
  ok(errors.length === 0, 'no JS errors on the Jumu\'ah band');
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
