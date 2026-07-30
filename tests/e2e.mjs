// NOOR e2e v2: 4 pages, 4-way cross-links, deep links, i18n/RTL, em-dash guard, mobile, reduced motion
import { chromium } from 'playwright';
const BASE = 'http://localhost:8123';
let failures = 0;
const ok = (cond, name) => { console.log((cond ? '  ✓ ' : '  ✗ FAIL ') + name); if (!cond) failures++; };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
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
  ok(await page.locator('.tile').count() === 64, '64 tiles');
  ok(await page.locator('.gate').count() === 4, '4 period gates');
  ok(await page.locator('#hero-stats .hero-stat').count() === 6, '6 hero stats');
  ok(await page.locator('.crescent').count() === 1, 'crescent rendered');
  await page.waitForTimeout(1300);
  const statVal = await page.locator('#hero-stats [data-count]').first().textContent();
  ok(statVal === '64', `count-up completed (${statVal})`);
  await page.screenshot({ path: 'tests/shots/v3-01-hero.png' });
  await noDash(page, 'index surface');

  await page.locator('.tile[data-id="37"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.locator('.tile[data-id="37"]').click();
  await page.waitForTimeout(700);
  ok(await page.locator('#modal-backdrop.open').count() === 1, 'Badr modal opens');
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
  ok(await page.locator('#modal-body .entity-link').count() >= 3, 'Kaaba modal richly linked');
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
  await page.goto(BASE + '/index.html?node=48', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  ok(await page.locator('#modal-backdrop.open').count() === 1, '?node=48 auto-opens');
  ok(await page.locator('.seq-strip').count() === 1 && await page.locator('.mtimeline li').count() >= 6 && await page.locator('.shield-box li').count() >= 3, 'sequence + timeline + shield intact');
  await noDash(page, 'Dajjal modal');
  await page.keyboard.press('Escape');
  await page.selectOption('#lang-switch', 'ar'); await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.documentElement.dir) === 'rtl', 'AR → dir=rtl');
  await page.selectOption('#lang-switch', 'en'); await page.waitForTimeout(300);
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
  ok(await page.locator('header .md\\:hidden a[href="places.html"]').count() === 1, 'mobile pill nav has Places');
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
  ok(errors.length === 0 && await page.locator('.tile').count() === 64, 'reduced motion healthy');
  await page.click('#search-toggle');
  await page.fill('#search-input', 'kawthar');
  await page.waitForTimeout(300);
  ok(await page.locator('#search-results button').count() >= 1, 'search finds Kawthar (Hawd)');
  await page.locator('#search-results button').first().click();
  await page.waitForTimeout(400);
  ok(await page.locator('#modal-backdrop.open').count() === 1, 'search opens modal');
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? '\nALL TESTS PASSED ✅' : `\n${failures} TEST(S) FAILED ❌`);
process.exit(failures ? 1 : 0);
