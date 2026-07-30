// NOOR end-to-end tests — desktop + mobile, cross-links both directions, deep links, i18n, audio UI
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

/* ---------- 1. index desktop ---------- */
console.log('\n[1] index.html — desktop');
{
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  ok(errors.length === 0, 'no JS errors on load' + (errors.length ? ' → ' + errors.join(' | ') : ''));
  ok(await page.locator('.tile').count() === 64, '64 tiles rendered');
  ok(await page.locator('.gate').count() === 4, '4 period gates rendered');
  ok(await page.locator('#hero-stats .hero-stat').count() === 4, 'hero stats rendered');
  const loadedAtTop = await page.locator('.tile-bg.bg-loaded').count();
  await page.screenshot({ path: 'tests/shots/01-hero-desktop.png' });
  await page.locator('#timeline').scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const loadedAfterScroll = await page.locator('.tile-bg.bg-loaded').count();
  ok(loadedAfterScroll > 0 && loadedAtTop < 64, `lazy images: ${loadedAtTop} at top → ${loadedAfterScroll} after scroll (deferred correctly)`);
  await page.screenshot({ path: 'tests/shots/01b-path-desktop.png' });

  // open Badr (37)
  await page.locator('.tile[data-id="37"]').scrollIntoViewIfNeeded();
  await page.locator('.tile[data-id="37"]').click();
  await page.waitForTimeout(700);
  ok(await page.locator('#modal-backdrop.open').count() === 1, 'modal opens (Badr)');
  const prose = await page.locator('.modal-prose').innerText();
  ok(prose.split(/\s+/).length > 900, `Badr prose ≥ 900 words in DOM (${prose.split(/\s+/).length})`);
  ok(await page.locator('.hadith-src').count() >= 3, 'hadith source chips rendered');
  ok(await page.locator('.audio-btn').count() >= 1, 'tilawah buttons rendered');
  ok(page.url().includes('?node=37'), 'URL reflects open node');
  await page.screenshot({ path: 'tests/shots/02-modal-badr.png' });

  // node→node link inside modal
  const nodeLink = page.locator('#modal-body .entity-link[data-etype="node"]').first();
  const target = await nodeLink.getAttribute('data-eid');
  await nodeLink.click(); await page.waitForTimeout(500);
  ok(page.url().includes('?node=' + target), `node→node cross-link works (→ ${target})`);

  // node→character link navigates to characters.html
  const charLink = page.locator('#modal-body .entity-link[data-etype="char"]').first();
  if (await charLink.count()) {
    const cid = await charLink.getAttribute('data-eid');
    await charLink.click();
    await page.waitForURL('**/characters.html*', { timeout: 5000 });
    ok(page.url().includes('open=' + cid), `node→character cross-link lands on characters.html?open=${cid}`);
    await page.waitForTimeout(900);
    ok(await page.locator('#modal-backdrop.open').count() === 1, 'character modal auto-opens from deep link');
  } else ok(false, 'char link present in modal chain');
  await ctx.close();
}

/* ---------- 2. deep link + Nihaya extras ---------- */
console.log('\n[2] deep links + Nihaya infographic sections');
{
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE + '/index.html?node=48', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  ok(await page.locator('#modal-backdrop.open').count() === 1, '?node=48 auto-opens Dajjal');
  ok((await page.locator('.seq-strip').count()) === 1, 'sequence strip rendered');
  ok((await page.locator('.mtimeline li').count()) >= 6, 'order-of-events timeline rendered');
  ok((await page.locator('.shield-box li').count()) >= 3, 'Shield protection box rendered');
  ok((await page.locator('.fact-item').count()) >= 6, 'facts grid dense (≥6)');
  await page.screenshot({ path: 'tests/shots/03-modal-dajjal.png', fullPage: false });
  ok(errors.length === 0, 'no JS errors' + (errors.length ? ' → ' + errors.join(' | ') : ''));

  // audio button toggles state or toasts (network may be blocked in sandbox)
  const btn = page.locator('.audio-btn').first();
  await btn.click(); await page.waitForTimeout(1200);
  const playing = await btn.evaluate(b => b.classList.contains('playing'));
  const toasted = await page.locator('.noor-toast').count();
  ok(playing || toasted > 0, `tilawah click → ${playing ? 'playing state' : 'graceful toast fallback'}`);
  await ctx.close();
}

/* ---------- 3. characters.html ---------- */
console.log('\n[3] characters.html');
{
  const { ctx, page, errors } = await newPage();
  await page.goto(BASE + '/characters.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  ok(errors.length === 0, 'no JS errors on load' + (errors.length ? ' → ' + errors.join(' | ') : ''));
  ok(await page.locator('.tile').count() === 71, '71 character tiles rendered');
  ok(await page.locator('.sgate').count() === 5, '5 section gates');
  await page.screenshot({ path: 'tests/shots/04-characters.png' });

  await page.locator('.tile[data-id="c-musab"]').scrollIntoViewIfNeeded();
  await page.locator('.tile[data-id="c-musab"]').click();
  await page.waitForTimeout(500);
  ok(await page.locator('#modal-backdrop.open').count() === 1, "Mus'ab modal opens");
  const nl = page.locator('#modal-body .entity-link[data-etype="node"]').first();
  const nid = await nl.getAttribute('data-eid');
  await nl.click();
  await page.waitForURL('**/index.html*', { timeout: 5000 });
  ok(page.url().includes('node=' + nid), `character→node cross-link lands on index.html?node=${nid}`);
  await page.waitForTimeout(900);
  ok(await page.locator('#modal-backdrop.open').count() === 1, 'node modal auto-opens from character link');
  await ctx.close();
}

/* ---------- 4. ?open deep link + i18n + RTL ---------- */
console.log('\n[4] ?open= deep link · language switcher · RTL');
{
  const { ctx, page } = await newPage();
  await page.goto(BASE + '/characters.html?open=e-jassasa', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  ok(await page.locator('#modal-backdrop.open').count() === 1, '?open=e-jassasa auto-opens');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  ok(await page.locator('#modal-backdrop.open').count() === 0, 'Escape closes modal');
  await page.selectOption('#lang-switch', 'ar'); await page.waitForTimeout(700);
  ok(await page.evaluate(() => document.documentElement.dir) === 'rtl', 'AR switch sets dir=rtl');
  ok(await page.evaluate(() => document.documentElement.lang) === 'ar', 'AR switch sets lang');
  await page.selectOption('#lang-switch', 'en'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.documentElement.dir) === 'ltr', 'EN restores ltr');
  await ctx.close();
}

/* ---------- 5. mobile (iPhone 14-ish) ---------- */
console.log('\n[5] mobile 390×844');
{
  const { ctx, page, errors } = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  ok(errors.length === 0, 'no JS errors mobile' + (errors.length ? ' → ' + errors.join(' | ') : ''));
  ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
  await page.screenshot({ path: 'tests/shots/05-hero-mobile.png' });
  await page.locator('.tile[data-id="64"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator('.tile[data-id="64"]').click();
  await page.waitForTimeout(800);
  ok(await page.locator('#modal-backdrop.open').count() === 1, 'Jannah modal opens on mobile');
  await page.screenshot({ path: 'tests/shots/06-modal-jannah-mobile.png' });
  await ctx.close();
}

/* ---------- 6. reduced motion ---------- */
console.log('\n[6] prefers-reduced-motion');
{
  const { ctx, page, errors } = await newPage({ reducedMotion: 'reduce' });
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  ok(errors.length === 0, 'no JS errors under reduced motion');
  ok(await page.locator('.tile').count() === 64, 'content fully visible without animation');
  await ctx.close();
}

/* ---------- 7. search ---------- */
console.log('\n[7] search');
{
  const { ctx, page } = await newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.click('#search-toggle');
  await page.fill('#search-input', 'trench');
  await page.waitForTimeout(300);
  const hits = await page.locator('#search-results button').count();
  ok(hits >= 1, `search "trench" → ${hits} hit(s)`);
  await page.locator('#search-results button').first().click();
  await page.waitForTimeout(500);
  ok(await page.locator('#modal-backdrop.open').count() === 1, 'search hit opens modal');
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? '\nALL TESTS PASSED ✅' : `\n${failures} TEST(S) FAILED ❌`);
process.exit(failures ? 1 : 0);
