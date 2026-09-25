/* NOOR - the reading view, carried from the prototype approved 17 September
   2026 into the live Mushaf.
   ------------------------------------------------------------------
   This file holds the new surface to its own promises, on top of the ones
   tests/mushaf.mjs and tests/quran-player.mjs already keep:

     · a word tapped on a written verse opens its meaning, and does not
       start the recitation
     · a word on an unwritten verse, or on a verse whose rendered spans do
       not match verse/<n>.json's own count, opens nothing: the tap falls
       through to the verse's ordinary behaviour -- pausing it, not
       restarting it, if that verse is already the one sounding
     · a held tap marks the word quietly while its fetch is in flight, and
       a fetch that fails is not remembered as empty for the rest of the
       visit: a later tap tries again
     · transliteration is off until asked for, appears only under a verse
       that has words written for it, and the choice survives a reload
     · one sheet drives the Arabic's size, the translation (in step with
       the player's own switch), and night, without either surface
       disagreeing with the other
     · the top bar and the idle player step back on a scroll down and
       return on a scroll up; a sounding player never leaves
     · the verse is sealed at its end in Arabic-Indic digits, aria-hidden,
       and the sweep never counts it as a word
     · Escape closes whichever sheet is open and hands focus back; Tab
       cannot leave it either -- the surah picker included -- and "How
       you read" fits its own row
     · a Bismillah written with a shadda on its ba (surahs 95 and 97) is
       recognised the same as the plain form every other surah carries
     · every piece of text on the page reads at WCAG's own AA contrast
       against whatever it actually sits on, composited, in both Day and
       Night, with the study companion drawn and each sheet open in turn
     · nothing throws, and nothing runs wider than the phone that opened it

   It needs the static server running: python3 /tmp/vercelish.py 8433
   Then:  node tests/mushaf-reading.mjs
   The Qur'an text service and the recitation are stubbed, so this runs
   with no network at all; verse/*.json and verse/index.json are read from
   this working tree exactly as the live page reads them. */
import { chromium } from 'playwright';
import { readFileSync as fsReadFileSync } from 'fs';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = 'http://127.0.0.1:8433';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
/* the same relative luminance WCAG's own contrast ratio is built from,
   used on its own below to ask a plain question a full contrast pairing
   does not: is the player's own ground actually light, or actually dark. */
const luminance = rgb => {
  const m = (rgb.match(/[\d.]+/g) || [0, 0, 0]).map(Number);
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]);
};

/* Al-Fatiha's own Uthmani text, Tanzil, the same source verse/1.json's own
   words[] was written against -- copied here rather than read from
   another project's tree, so this file depends on nothing outside it. */
const FATIHA = [
  'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
  'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
  'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
  'مَٰلِكِ يَوْمِ ٱلدِّينِ',
  'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
  'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
  'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
];
/* the same seven verses, verse 1 carrying one extra token that verse/1.json's
   words[] for it (four entries) does not: the count-mismatch fixture */
const FATIHA_MISMATCH = FATIHA.slice();
FATIHA_MISMATCH[0] = FATIHA[0] + ' زَائِدَة';

function wav(seconds, hz) {
  const sr = 8000, n = Math.round(sr * seconds), body = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) body.writeInt16LE(Math.round(6000 * Math.sin(2 * Math.PI * hz * i / sr)), i * 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + body.length, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22); head.writeUInt32LE(sr, 24); head.writeUInt32LE(sr * 2, 28);
  head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(body.length, 40);
  return Buffer.concat([head, body]);
}
const TONE = wav(3.0, 330);

function surahJSON(n, count, edition, arabicLines) {
  const ayahs = [];
  for (let v = 1; v <= count; v++) ayahs.push({
    number: v, numberInSurah: v,
    text: edition ? ('Verse ' + v + ' translated.') : (arabicLines ? arabicLines[v - 1] : 'كلمة ' + v)
  });
  return { code: 200, status: 'OK', data: { number: n, ayahs } };
}

const b = await chromium.launch({ executablePath: EXE, args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, serviceWorkers: 'block' });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', r => {
  const why = (r.failure() && r.failure().errorText) || '';
  if (/ERR_ABORTED/.test(why)) return;
  errors.push('reqfail: ' + r.url() + ' (' + why + ')');
});

let arabicFixture = FATIHA;
const audioHits = [];
await page.route('**/api.alquran.cloud/**', r => {
  const u = new URL(r.request().url()); const p = u.pathname.split('/');
  const n = +p[3], ed = p[4] !== 'quran-uthmani';
  const count = { 1: 7, 3: 5 }[n] || 5;
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(surahJSON(n, count, ed, n === 1 ? arabicFixture : null)) });
});
await page.route(u => /(islamic\.network|everyayah|verses\.quran)/.test(u.href), r => {
  audioHits.push(r.request().url());
  r.fulfill({ status: 200, contentType: 'audio/wav', body: TONE });
});

console.log('\n=== 1. a word on a written verse opens its meaning, and starts nothing ===');
await page.goto(BASE + '/quran?surah=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ayah');
/* this wait is for verse/index.json, the one file still fetched as soon
   as the room opens (it is what .hw itself is drawn from) -- verse/1.json
   is not fetched until something actually needs it, and the tap below is
   the first thing that does; it holds itself open on that fetch, so the
   wait that matters for it is after the click, not before it */
await page.waitForTimeout(300);
ok(await page.locator('#a-4').evaluate(el => el.classList.contains('hw')), '2:4 no -- 1:4 carries the affordance class');
ok(await page.locator('#a-4 .ar .w').count() === 3, 'and it is cut into the three words verse/1.json was written against');
audioHits.length = 0;
const tappedWord = page.locator('#a-4 .ar .w').nth(0);
await tappedWord.click();
await page.waitForTimeout(250);
ok(await page.locator('#wordsheet.on').count() === 1, 'the word sheet opens');
ok(await page.locator('#wordsheet').getAttribute('role') === 'dialog' && await page.locator('#wordsheet').getAttribute('aria-modal') === 'true', 'as a labelled modal dialog');
ok(await page.locator('#w-ar').innerText() === 'مَٰلِكِ', 'the Arabic is the word under the finger');
ok(await page.locator('#w-tr').innerText() === 'māliki', 'its transliteration is with it');
ok(await page.locator('#w-gl').innerText() === 'Master of', 'and its gloss');
ok(/Al-Fatiha 1:4/.test(await page.locator('#w-ref').innerText()), 'the reference names the surah in English, and the verse');
ok(audioHits.length === 0, 'and nothing was asked of a reciter (' + audioHits.length + ' requests)');
ok(await page.evaluate(() => NOOR_MUSHAF.playingIdx) === -1, 'nor did the recitation start');
ok(await page.locator('#a-4').evaluate(el => !el.classList.contains('playing')), 'the verse itself was not marked playing');

console.log('\n=== 2. Escape closes it, and hands focus back ===');
const beforeFocus = await page.evaluate(() => document.activeElement && document.activeElement.id);
ok(beforeFocus === 'w-close' || beforeFocus === null || beforeFocus === '', 'the sheet itself holds focus before Escape (' + beforeFocus + ')');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
ok(await page.locator('#wordsheet.on').count() === 0, 'the sheet closes');
ok(await page.locator('#wordsheet').isHidden(), 'and leaves the page');
ok(await tappedWord.evaluate(el => el === document.activeElement), 'and focus lands back on the very word that was tapped, not merely somewhere');

console.log('\n=== 3. Tab does not leave an open sheet ===');
/* "How you read" has several focusable rows, a richer dialog to trap than
   the word sheet's own single close button */
await page.locator('#t-settings').click();
await page.waitForTimeout(300);
const firstFocused = await page.evaluate(() => document.activeElement && document.activeElement.dataset.k);
ok(firstFocused === '0', 'opening the sheet focuses its first row (size step ' + firstFocused + ')');
await page.keyboard.press('Shift+Tab');
const afterShiftTab = await page.evaluate(() => document.activeElement && (document.activeElement.dataset.v || document.activeElement.id));
ok(afterShiftTab === 'night', 'shift+Tab from the first row wraps to the sheet\'s own last one (' + afterShiftTab + '), not out to the page behind it');
await page.keyboard.press('Tab');
const afterWrap = await page.evaluate(() => document.activeElement && document.activeElement.dataset.k);
ok(afterWrap === '0', 'and Tab from that last row wraps forward back to the first, not out past it (' + afterWrap + ')');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

/* the picker is its own modal, hidden by an attribute rather than the
   .on class the other two sheets share -- trapped Tab the same way, or
   not trapped by a shared check that only ever looked for .on */
await page.locator('#q-pick').click();
await page.waitForTimeout(300);
const pickerFirst = await page.evaluate(() => document.activeElement && document.activeElement.id);
ok(pickerFirst === 's-search', 'the surah picker focuses its own search box on open (' + pickerFirst + ')');
await page.keyboard.press('Shift+Tab');
const pickerWrapped = await page.evaluate(() => {
  const sheet = document.getElementById('s-sheet');
  const ae = document.activeElement;
  return !!(sheet && sheet.contains(ae) && ae.tagName === 'BUTTON' && ae.classList.contains('srow'));
});
ok(pickerWrapped, 'shift+Tab from the search box wraps to the picker\'s own last row, not out past it');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

console.log('\n=== 4. a word on an unwritten verse opens nothing ===');
await page.goto(BASE + '/quran?surah=3', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ayah');
await page.waitForTimeout(250);
ok(await page.locator('.vx').count() === 0, 'Aal Imran: nothing written here (mushaf.mjs already holds this)');
ok(await page.locator('#a-1').evaluate(el => !el.classList.contains('hw')), 'so 3:1 carries no word-tap affordance');
await page.locator('#a-1 .ar .w').nth(0).click();
await page.waitForTimeout(300);
ok(await page.locator('#wordsheet.on').count() === 0, 'no sheet opens');
ok(await page.evaluate(() => NOOR_MUSHAF.playingIdx) === 0, 'the tap fell through to the verse\'s own behaviour: it started reciting');
await page.locator('#p-stop').click();
await page.waitForTimeout(200);

console.log('\n=== 5. a verse whose spans do not match verse/1.json opens nothing either ===');
arabicFixture = FATIHA_MISMATCH;
await page.goto(BASE + '/quran?surah=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ayah');
await page.waitForTimeout(300);
ok(await page.locator('#a-1 .ar .w').count() === 5, 'the Bismillah renders five spans here, not the four verse/1.json holds');
ok(await page.locator('#a-1').evaluate(el => el.classList.contains('hw')), 'the verse is still a written one');
await page.locator('#a-1 .ar .w').nth(0).click();
await page.waitForTimeout(300);
ok(await page.locator('#wordsheet.on').count() === 0, 'the mismatch is caught, and nothing new opens');
ok(await page.evaluate(() => NOOR_MUSHAF.playingIdx) === 0, 'the tap fell through to the verse\'s own behaviour instead');
await page.locator('#p-stop').click();
await page.waitForTimeout(200);
arabicFixture = FATIHA;

console.log('\n=== 6. a held tap marks the word quietly while it waits, and clears it either way ===');
/* verse/1.json is real and small in this tree, so the fetch a held tap
   waits on usually resolves before a human could see anything -- delayed
   here, once, so the wait itself is observable rather than assumed */
await page.route('**/verse/1.json', route => setTimeout(() => route.continue(), 500), { times: 1 });
await page.goto(BASE + '/quran?surah=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ayah');
await page.waitForTimeout(300);
const heldWord = page.locator('#a-1 .ar .w').nth(0);
await heldWord.click();
await page.waitForTimeout(80);
ok(await heldWord.evaluate(el => el.classList.contains('w-pending')), 'the tapped word is quietly marked while the fetch it is waiting on is in flight');
await page.waitForTimeout(700);
ok(await heldWord.evaluate(el => !el.classList.contains('w-pending')), 'and the mark is gone once the wait is over, whichever way the tap fell');
ok(await page.locator('#wordsheet.on').count() === 1, 'this word does match verse/1.json, so the sheet is what opened');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

console.log('\n=== 7. a mismatched held tap on the verse already sounding pauses it, not restarts it ===');
arabicFixture = FATIHA_MISMATCH;
await page.route('**/verse/1.json', route => setTimeout(() => route.continue(), 400), { times: 1 });
await page.goto(BASE + '/quran?surah=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ayah');
await page.waitForTimeout(300);
await page.locator('#a-1 .vlisten').click();   /* the verse's own Listen pill: 1:1 starts sounding */
await page.waitForFunction(() => NOOR_MUSHAF.playingIdx === 0 && NOOR_MUSHAF.sounding, { timeout: 8000 });
await page.locator('#a-1 .ar .w').nth(0).click();   /* held: verse/1.json has not been asked for yet this visit */
await page.waitForTimeout(700);
ok(await page.locator('#wordsheet.on').count() === 0, 'the mismatch is still caught; no sheet opens on the verse already sounding');
ok(await page.evaluate(() => NOOR_MUSHAF.playingIdx) === 0, 'it is still the same verse, not moved to a different one');
ok(await page.evaluate(() => NOOR_MUSHAF.sounding) === false, 'but it is now paused -- the same thing an ordinary tap on a sounding verse does');
ok(await page.evaluate(() => NOOR_MUSHAF.paused) === true, 'and the player itself agrees it is paused, not stopped or restarted');
await page.locator('#p-stop').click();
await page.waitForTimeout(200);
arabicFixture = FATIHA;

console.log('\n=== 8. a broken fetch is not remembered forever; a later tap tries again ===');
/* the first request for verse/1.json this visit fails outright; a held
   tap on it must fall through, not hang, and must not brand the whole
   surah empty for the rest of the visit the way caching that emptiness
   once did -- a second tap, once the file is reachable again, should
   reach it */
await page.route('**/verse/1.json', route => route.abort(), { times: 1 });
await page.goto(BASE + '/quran?surah=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ayah');
await page.waitForTimeout(300);
const firstTry = page.locator('#a-4 .ar .w').nth(0);
await firstTry.click();
await page.waitForTimeout(400);
ok(await page.locator('#wordsheet.on').count() === 0, 'the broken fetch opens nothing the first time');
ok(await page.evaluate(() => NOOR_MUSHAF.playingIdx) === 3, 'and the tap fell through to 1:4\'s own ordinary behaviour instead');
await page.locator('#p-stop').click();
await page.waitForTimeout(200);
await firstTry.click();   /* the route above was consumed once; this request reaches the real file */
await page.waitForTimeout(400);
ok(await page.locator('#wordsheet.on').count() === 1, 'a later tap is not still living with the first one\'s failure, and reaches the file');
ok(await page.locator('#w-ar').innerText() === 'مَٰلِكِ', 'and opens the very word that was tapped');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

console.log('\n=== 9. transliteration: off until asked for, only under a written verse, and it survives a reload ===');
await page.goto(BASE + '/quran?surah=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ayah');
await page.waitForTimeout(250);
ok(await page.evaluate(() => document.body.classList.contains('no-tl')), 'transliteration starts off');
ok(await page.locator('#a-4 .tl').count() === 1, 'a written verse still carries the line in the page, hidden');
ok(await page.locator('#a-4 .tl').isHidden(), 'and it is hidden while the setting is off');
await page.locator('#t-settings').click();
await page.waitForTimeout(300);
await page.locator('#rs-tl').click();
await page.waitForTimeout(400);
ok(await page.locator('#rs-tl').getAttribute('aria-checked') === 'true', 'the switch says on');
ok(await page.locator('#a-4 .tl').isVisible(), 'the line under 1:4 is now shown');
ok((await page.locator('#a-4 .tl').innerText()) === 'māliki yawmi ad-dīn', 'and it reads the same words the notes were written from');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ayah');
await page.waitForTimeout(300);
ok(!(await page.evaluate(() => document.body.classList.contains('no-tl'))), 'the choice survived the reload');
ok(await page.locator('#a-4 .tl').isVisible(), 'and the line is there without being asked again');

console.log('\n=== 10. one sheet, four rows, one state ===');
await page.locator('#t-settings').click();
await page.waitForTimeout(300);
ok(await page.locator('#rsheet.on').count() === 1, 'the sheet opens');
ok(await page.locator('#rsheet').getAttribute('aria-modal') === 'true', 'as a modal dialog');
const sizeBefore = await page.evaluate(() => NOOR_MUSHAF.size);
await page.locator('#rs-size button[data-k="5"]').click();
await page.waitForTimeout(150);
ok(await page.evaluate(() => NOOR_MUSHAF.size) !== sizeBefore, 'the size step changed the Arabic size');
ok(await page.locator('#rs-size button[data-k="5"]').getAttribute('aria-pressed') === 'true', 'and the row says which step is chosen');
ok(await page.locator('#a-4 .ar').evaluate(el => getComputedStyle(el).fontSize) !== '', 'the text itself is sized');
/* translation: the same function the player sheet's own switch calls */
const transBefore = await page.evaluate(() => !document.querySelector('.ayah .trans').classList.contains('hidden'));
await page.locator('#rs-trans').click();
await page.waitForTimeout(150);
const transAfter = await page.evaluate(() => !document.querySelector('.ayah .trans').classList.contains('hidden'));
ok(transBefore !== transAfter, 'the translation toggled');
/* read as textContent, not innerText: the player's own sheet is folded
   away (visibility:hidden) until something is playing, which this section
   never asks for, and innerText follows visibility where textContent
   reads the state underneath it */
ok(await page.locator('#o-trans').evaluate(el => el.textContent) === (transAfter ? 'On' : 'Off'), 'the player sheet\'s own switch agrees with it');
await page.locator('#rs-trans').click();   /* put it back on, for the next surfaces this file reads */
await page.waitForTimeout(150);
/* day / night: html.noor-day is Day, and Day is the room's own default now
   (agreed with the owner 25 September 2026) -- the tiny script at the top
   of <head> already put it there before this page ever painted. */
ok(await page.evaluate(() => document.documentElement.classList.contains('noor-day')), 'Day is the default');
ok(await page.locator('#a-4 .ar').evaluate(el => getComputedStyle(el).color) === 'rgb(36, 29, 18)', 'and the Arabic itself is ink on parchment to start with');
await page.locator('#rs-theme button[data-v="night"]').click();
await page.waitForTimeout(200);
ok(!(await page.evaluate(() => document.documentElement.classList.contains('noor-day'))), 'Night can be asked for');
ok(await page.locator('#a-4 .ar').evaluate(el => getComputedStyle(el).color) === 'rgb(255, 254, 247)', 'and the Arabic turns to light on the deep ground');
await page.locator('#rs-theme button[data-v="day"]').click();
await page.waitForTimeout(200);
ok(await page.evaluate(() => document.documentElement.classList.contains('noor-day')), 'and Day is one tap back');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

console.log('\n=== 11. the seal at the end of the verse ===');
ok(await page.locator('#a-4 .ar .seal').count() === 1, 'a seal sits at the end of the Arabic line');
ok(await page.locator('#a-4 .ar .seal').getAttribute('aria-hidden') === 'true', 'aria-hidden, so a screen reader is not told the number twice');
ok(!(await page.locator('#a-4 .ar .seal').evaluate(el => el.classList.contains('w'))), 'and it is never a .w: the sweep must not count it');
ok(await page.locator('#a-4 .ar .w').count() === 3, 'the word count under it is still exactly the words, seal excluded');
const sealText = await page.locator('#a-4 .ar .seal').innerText();
ok(/^[٠-٩]+$/.test(sealText) && sealText === '٤', 'set in Arabic-Indic digits (' + sealText + ')');

console.log('\n=== 12. the notes expander reads "Study this verse" ===');
ok((await page.locator('#a-4 .vx span').evaluate(el => el.textContent)) === 'Study this verse', 'not the bare "Study" it used to say');

console.log('\n=== 13. the chrome leaves on a scroll down, and returns on a scroll up ===');
await page.evaluate(() => { window.scrollTo(0, 0); if (document.activeElement) document.activeElement.blur(); });
await page.waitForTimeout(150);
ok(!(await page.evaluate(() => NOOR_MUSHAF.chromeHidden)), 'the bars start shown');
await page.mouse.move(180, 300);
await page.mouse.wheel(0, 900);
await page.waitForTimeout(250);
ok(await page.evaluate(() => NOOR_MUSHAF.chromeHidden), 'a real scroll down past the threshold hides them');
ok(await page.locator('#qnav').evaluate(el => el.getBoundingClientRect().bottom <= 0), 'the top bar is actually off the top of the screen');
await page.mouse.wheel(0, -900);
await page.waitForTimeout(250);
ok(!(await page.evaluate(() => NOOR_MUSHAF.chromeHidden)), 'and a scroll back up brings them back');

console.log('\n=== 14. a sounding player never leaves, even scrolled past ===');
/* the verse's own Listen pill, not the Arabic: on this surah every word now
   aligns, so a tap on the text itself would open the word sheet instead */
await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
await page.locator('#a-2 .vlisten').click();
await page.waitForFunction(() => NOOR_MUSHAF.playingIdx === 1, { timeout: 8000 });
await page.waitForTimeout(400);
ok(await page.evaluate(() => NOOR_MUSHAF.sounding), 'the recitation is sounding');
await page.mouse.wheel(0, 900);
await page.waitForTimeout(250);
ok(await page.evaluate(() => NOOR_MUSHAF.chromeHidden), 'the top bar still steps back');
const pBox = await page.locator('#player').boundingBox();
ok(pBox && pBox.y + pBox.height <= 782, 'but the player stays seated on the screen while it sounds (bottom=' + (pBox ? Math.round(pBox.y + pBox.height) : 'null') + ')');
await page.locator('#p-stop').click();
await page.waitForTimeout(300);
await page.mouse.wheel(0, 900);
await page.waitForTimeout(250);
ok(await page.evaluate(() => NOOR_MUSHAF.chromeHidden), 'once it stops, a scroll down puts the idle player away too');

console.log('\n=== 15. "How you read" fits on the row it always had ===');
/* an icon button with an aria-label, not a third line of text next to
   "Browse the 114 gates" and "Listen to surah": the bar's own collapsed
   height (once a scroll has folded the translation/reciter row away, the
   same state the reader is left in above) is the same with the button
   there as it was without it */
const navH = await page.locator('#qnav').evaluate(el => Math.round(el.getBoundingClientRect().height));
ok(navH <= 110, 'the sticky bar is still one collapsed row (h=' + navH + ')');
await page.mouse.wheel(0, -900);
await page.waitForTimeout(250);

console.log('\n=== 16. nothing runs wider than the phone that opened it ===');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(overflow <= 0, 'no horizontal overflow at 360px (' + overflow + 'px over)');
await page.locator('#t-settings').click();
await page.waitForTimeout(250);
const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(overflow2 <= 0, 'nor with the settings sheet open (' + overflow2 + 'px over)');
await page.keyboard.press('Escape');
await page.waitForTimeout(250);

console.log('\n=== 17. the Bismillah is recognised with a shadda on its ba too ===');
/* surahs 95 and 97 are written "بِّسْمِ" -- ba, shadda (U+0651), then the
   kasra -- not the plain "بِسْمِ" every other surah opens with; a regex
   that only knew the plain form left it standing, showing the Bismillah
   twice and lighting the sweep four words too many on those two surahs.
   Read the room's own regex out of quran.html rather than copy it a
   second time here, so this fails the moment the two ever disagree. */
const roomSource = fsReadFileSync(new URL('../quran.html', import.meta.url), 'utf8');
const bismillahSrc = roomSource.match(/const BISMILLAH=\/(.*)\//);
ok(!!bismillahSrc, 'the room still defines BISMILLAH where this test expects it');
const BISMILLAH = new RegExp(bismillahSrc[1]);
const BA = 'ب', SHADDA = 'ّ', KASRA = 'ِ', SEEN = 'س', SUKUN = 'ْ', MEEM = 'م';
const shaddaBa = BA + SHADDA + KASRA + SEEN + SUKUN + MEEM + KASRA;   /* بِّسْمِ, exactly that codepoint order */
const restOfBismillah = ' ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ';
const surah95First = shaddaBa + restOfBismillah + 'والتِّينِ';   /* وَٱلتِّينِ follows the Bismillah in 95:1 */
ok(BISMILLAH.test(surah95First), 'the shadda-on-ba Bismillah is recognised at all');
ok(!BISMILLAH.test(surah95First.replace(BISMILLAH, '')), 'and stripping it leaves no second copy behind');
ok(surah95First.replace(BISMILLAH, '') === 'والتِّينِ', 'leaving exactly 95:1\'s own first word, nothing else');

console.log('\n=== 18. every word on the page reads against what it actually sits on ===');
/* WCAG's own formula, not a guess at it: relative luminance from sRGB,
   contrast as (lighter+.05)/(darker+.05), 4.5:1 for ordinary text and
   3:1 for anything 24px or larger (or 18.66px and bold). A translucent
   ink or a translucent chip is composited over everything under it --
   "over", the way a real ink wash sits on the page under it, not the
   raw rgba() alone -- because a chip's own rgba(...,.14) over cream
   reads far paler than that rgba() would suggest on its own, and a page
   that only checked the rgba() would pass chips no reader could read. */
function auditContrast() {
  const lum = (r, g, b) => {
    const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
  };
  const parse = c => {
    if (!c) return null;
    if (c.startsWith('color(')) {   /* color-mix() serialises as color(srgb r g b / a), 0..1 not 0..255 */
      const m = c.match(/[\d.]+/g);
      if (!m) return null;
      return { r: +m[0] * 255, g: +m[1] * 255, b: +m[2] * 255, a: m[3] !== undefined ? +m[3] : 1 };
    }
    const m = c.match(/[\d.]+/g);
    if (!m) return null;
    return { r: +m[0], g: +m[1], b: +m[2], a: m[3] !== undefined ? +m[3] : 1 };
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1
  });
  /* a gradient with no reader standing on any one point of it is fairly
     read as the average of its stops. A gradient with a line of text set
     across it is not: the picker's own selected row once read at 1.3:1 in
     Night because its own name sat on the gradient's dark end while the
     average of that same gradient's two stops looked pale enough to pass.
     This is the fallback for a gradient this file cannot place on the
     page (radial, conic, one this parser does not follow) -- a flat
     average is still closer to true than skipping it outright. */
  const gradientAverage = img => {
    if (!img || img === 'none') return null;
    const stops = [...img.matchAll(/rgba?\([^)]*\)|color\([^)]*\)/g)].map(m => parse(m[0])).filter(Boolean);
    if (!stops.length) return null;
    let result = { r: 255, g: 255, b: 255, a: 0 };
    for (const s of stops) result = { ...over(s, result), a: Math.max(result.a, s.a) };
    return result.a > 0 ? result : null;
  };
  /* a linear-gradient's own colour at one exact point, the way the page
     itself paints it: the CSS gradient line runs through the box at the
     angle given (0deg is "to top", clockwise from there), its full length
     set by the box's own width and height, and every point in the box
     projects onto that line to read off a position between the stops.
     Reading the stops out needs the gradient's own parentheses kept
     balanced -- a stop can be an rgba(...) or a color(...), each already
     carrying parentheses of its own -- so this is walked by hand rather
     than matched by one regex the way the average above is. */
  const balancedArgs = (s, open) => {
    const i = s.indexOf(open);
    if (i === -1) return null;
    let d = 1, j = i + open.length;
    for (; j < s.length && d > 0; j++) { if (s[j] === '(') d++; else if (s[j] === ')') d--; }
    return d === 0 ? s.slice(i + open.length, j - 1) : null;
  };
  const splitTop = s => {
    const out = []; let d = 0, cur = '';
    for (const ch of s) {
      if (ch === '(') d++; else if (ch === ')') d--;
      if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };
  const dirAngle = tok => {
    const m = tok.match(/(-?[\d.]+)deg/);
    if (m) return parseFloat(m[1]) * Math.PI / 180;
    const map = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270,
      'to top right': 45, 'to right top': 45, 'to bottom right': 135, 'to right bottom': 135,
      'to bottom left': 225, 'to left bottom': 225, 'to top left': 315, 'to left top': 315 };
    return (tok.trim() in map) ? map[tok.trim()] * Math.PI / 180 : Math.PI;
  };
  const gradientAtPoint = (img, rect, x, y) => {
    if (!img || !img.includes('linear-gradient(')) return null;
    const inner = balancedArgs(img, 'linear-gradient(');
    if (inner === null) return null;
    const parts = splitTop(inner);
    if (!parts.length) return null;
    let angle = Math.PI, stopParts = parts;
    if (/deg\s*$/.test(parts[0]) || /^to\s/.test(parts[0])) { angle = dirAngle(parts[0]); stopParts = parts.slice(1); }
    const stops = [];
    for (const p of stopParts) {
      const m = p.match(/(-?[\d.]+)%\s*$/);
      const colorStr = m ? p.slice(0, m.index).trim() : p;
      const c = parse(colorStr);
      if (c) stops.push({ c, pos: m ? parseFloat(m[1]) / 100 : null });
    }
    if (!stops.length) return null;
    if (stops.length === 1) return stops[0].c;
    for (let i = 0; i < stops.length; i++) {
      if (stops[i].pos !== null) continue;
      let j = i; while (j < stops.length && stops[j].pos === null) j++;
      const startPos = i === 0 ? 0 : stops[i - 1].pos, endPos = j < stops.length ? stops[j].pos : 1;
      const span = j - i + 1;
      for (let k = i; k < j; k++) stops[k].pos = startPos + (endPos - startPos) * (k - i + 1) / span;
      i = j - 1;
    }
    const dx = Math.sin(angle), dy = -Math.cos(angle);
    const L = Math.abs(rect.width * dx) + Math.abs(rect.height * dy);
    let t = 0;
    if (L > 0) {
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const proj = (x - cx) * dx + (y - cy) * dy;
      t = Math.max(0, Math.min(1, (proj + L / 2) / L));
    }
    let i = 0;
    while (i < stops.length - 1 && t > stops[i + 1].pos) i++;
    const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
    const span = (b.pos - a.pos) || 1;
    const f = b === a ? 0 : Math.max(0, Math.min(1, (t - a.pos) / span));
    return { r: a.c.r + (b.c.r - a.c.r) * f, g: a.c.g + (b.c.g - a.c.g) * f, b: a.c.b + (b.c.b - a.c.b) * f, a: a.c.a + (b.c.a - a.c.a) * f };
  };
  const bgAt = (el, x, y) => {
    const chain = [];
    let e = el;
    while (e) {
      const cs = getComputedStyle(e);
      const img = cs.backgroundImage;
      if (img && img !== 'none') {
        const grad = gradientAtPoint(img, e.getBoundingClientRect(), x, y) || gradientAverage(img);
        if (grad) { chain.unshift(grad); if (grad.a >= 1) break; e = e.parentElement; continue; }
      }
      const bc = parse(cs.backgroundColor);
      if (bc && bc.a > 0) chain.unshift(bc);
      if (bc && bc.a >= 1) break;   /* fully opaque: nothing further under it can show through */
      e = e.parentElement;
    }
    let result = { r: 255, g: 255, b: 255, a: 1 };   /* the page itself, if nothing else was opaque */
    for (const layer of chain) result = over(layer, result);
    return result;
  };
  const ratio = (fg, bg) => {
    const L1 = lum(fg.r, fg.g, fg.b), L2 = lum(bg.r, bg.g, bg.b);
    const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
    return (hi + .05) / (lo + .05);
  };
  /* the worst point under the actual footprint of the text, not one
     guessed point and not an average either -- a gradient can read fine
     at its own centre and fail at the corner a reader's eye is on. Four
     corners and the middle of every line box the text itself occupies
     (the range's own client rects, not its parent's, since a parent can
     run wider than the words inside it) are asked, and the reddest
     answer among them is the one kept. */
  const worstOver = (rects, fgRaw, el) => {
    let bestRatio = Infinity, bestBg = null;
    for (const rect of rects) {
      if (!rect.width || !rect.height) continue;
      const pts = [
        [rect.left + 1, rect.top + 1], [rect.right - 1, rect.top + 1],
        [rect.left + 1, rect.bottom - 1], [rect.right - 1, rect.bottom - 1],
        [(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2]
      ];
      for (const [x, y] of pts) {
        const bg = bgAt(el, x, y);
        const fg = fgRaw.a < 1 ? over(fgRaw, bg) : fgRaw;
        const r = ratio(fg, bg);
        if (r < bestRatio) { bestRatio = r; bestBg = bg; }
      }
    }
    return { ratio: bestRatio, bg: bestBg };
  };
  const offenders = [];
  const threshold = (fs, bold) => (fs >= 24 || (fs >= 18.66 && bold)) ? 3 : 4.5;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      const s = getComputedStyle(p);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return NodeFilter.FILTER_REJECT;
      const r = p.getClientRects();
      if (!r.length) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n;
  while (n = walker.nextNode()) {
    const p = n.parentElement;
    const s = getComputedStyle(p);
    const fgRaw = parse(s.color);
    if (!fgRaw) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()];
    if (!rects.length) continue;
    const { ratio: r, bg } = worstOver(rects, fgRaw, p);
    if (!bg) continue;
    const fs = parseFloat(s.fontSize);
    const bold = +s.fontWeight >= 700;
    if (r < threshold(fs, bold)) {
      offenders.push({
        text: n.nodeValue.trim().slice(0, 40),
        tag: p.tagName, cls: p.className && String(p.className).slice(0, 60),
        ratio: +r.toFixed(2), fg: s.color, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`, fs, bold
      });
    }
  }
  /* a select's own displayed value and an input's own value or placeholder
     are drawn by the browser itself, not as text nodes any TreeWalker can
     reach -- #t-lang and #t-recite read at .18 alpha for exactly this
     reason once, invisible to every check that only walked text nodes.
     Each control is asked for its own ink, its own rect, and (for a
     placeholder) the ::placeholder pseudo-element's own colour, since
     that is not always the control's plain colour either. */
  for (const el of document.querySelectorAll('select, input')) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) continue;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    let text = '', fgRaw = null, fgDisplay = s.color;
    if (el.tagName === 'SELECT') {
      const opt = el.selectedOptions && el.selectedOptions[0];
      text = ((opt ? opt.textContent : el.value) || '').trim();
      if (!text) continue;
      fgRaw = parse(s.color);
    } else {
      if (['hidden', 'checkbox', 'radio', 'range', 'color', 'file'].includes(el.type)) continue;
      if (el.value) { text = el.value; fgRaw = parse(s.color); }
      else if (el.placeholder) {
        text = el.placeholder;
        const ph = getComputedStyle(el, '::placeholder');
        fgRaw = parse(ph.color) || parse(s.color);
        fgDisplay = ph.color || s.color;   /* the placeholder's own ink, not the control's plain colour */
      } else continue;
    }
    if (!fgRaw) continue;
    const midY = rect.top + rect.height / 2;
    const rects = [{ left: rect.left + 4, right: rect.right - 4, top: midY - 1, bottom: midY + 1, width: rect.width - 8, height: 2 }];
    const { ratio: r, bg } = worstOver(rects, fgRaw, el);
    if (!bg) continue;
    const fs = parseFloat(s.fontSize);
    const bold = +s.fontWeight >= 700;
    if (r < threshold(fs, bold)) {
      offenders.push({
        text: text.slice(0, 40), tag: el.tagName, cls: el.className && String(el.className).slice(0, 60),
        ratio: +r.toFixed(2), fg: fgDisplay, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`, fs, bold
      });
    }
  }
  return offenders;
}
const uthmaniRef = JSON.parse(fsReadFileSync('/root/mushaf/quran-uthmani.json', 'utf8')).verses;
const S1 = FATIHA;
const S2 = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(v => uthmaniRef['2:' + v]);
const REF_TEXT = { 1: S1, 2: S2 };
async function auditScenario(label, night, surah, openSheet) {
  const actx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await actx.addInitScript(`try{localStorage.setItem('noor-quran-night','${night ? '1' : '0'}')}catch(e){}`);
  const apage = await actx.newPage();
  await apage.route('**/api.alquran.cloud/**', r => {
    const u = new URL(r.request().url()); const p = u.pathname.split('/');
    const n = +p[3], ed = p[4] !== 'quran-uthmani';
    const arabic = REF_TEXT[n];
    const count = arabic ? arabic.length : 7;
    const ayahs = [];
    for (let v = 1; v <= count; v++) ayahs.push({
      number: v, numberInSurah: v,
      text: ed ? ('Verse ' + v + ' translated, long enough to wrap onto a phone screen twice over.') : (arabic ? arabic[v - 1] : 'كلمة ' + v)
    });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, status: 'OK', data: { number: n, ayahs } }) });
  });
  await apage.route(u => /(islamic\.network|everyayah|verses\.quran)/.test(u.href), r => r.fulfill({ status: 200, contentType: 'audio/wav', body: TONE }));
  await apage.route(u => /fonts\.(googleapis|gstatic)/.test(u.href), r => r.abort());
  await apage.goto(BASE + '/quran?surah=' + surah, { waitUntil: 'domcontentloaded' });
  await apage.waitForSelector('.ayah');
  await apage.waitForTimeout(600);
  if (openSheet) await openSheet(apage);
  await apage.waitForTimeout(350);
  const offenders = await apage.evaluate(auditContrast);
  ok(offenders.length === 0, label + (offenders.length ? ': ' + offenders.length + ' offenders -- ' +
    offenders.slice(0, 6).map(o => o.ratio + ':1 <' + o.tag.toLowerCase() + '.' + o.cls + '> "' + o.text + '" fg=' + o.fg + ' bg=' + o.bg).join(' | ') : ''));
  await actx.close();
}
for (const night of [false, true]) {
  const mode = night ? 'Night' : 'Day';
  for (const surah of [1, 2]) {
    await auditScenario(mode + ', surah ' + surah + ', base reading surface', night, surah, null);
    await auditScenario(mode + ', surah ' + surah + ', "How you read" sheet open', night, surah, async p => { await p.locator('#t-settings').click(); await p.waitForTimeout(250); });
    await auditScenario(mode + ', surah ' + surah + ', word sheet open', night, surah, async p => { await p.locator('#a-4 .ar .w').first().click(); await p.waitForTimeout(250); });
    await auditScenario(mode + ', surah ' + surah + ', surah picker sheet open', night, surah, async p => { await p.locator('#q-pick').click(); await p.waitForTimeout(250); });
    await auditScenario(mode + ', surah ' + surah + ', study companion sheet open', night, surah, async p => {
      await p.locator('#t-study-open').waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
      await p.locator('#t-study-open').click(); await p.waitForTimeout(400);
    });
  }
}

console.log('\n=== 18b. on a wide screen the sheet is a sheet, not a sliver ===');
{
  /* above 640px the sheets are centred with left:50% and no right edge, so
     without a width of their own they shrink to their content: on the live
     site at 1710px the word sheet came out 140px wide around a single word */
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE + '/quran?surah=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ayah');
  await page.waitForTimeout(300);
  await page.locator('#a-4 .ar .w').nth(0).click();
  await page.waitForSelector('#wordsheet.on');
  await page.waitForTimeout(350);
  const r = await page.locator('#wordsheet').evaluate(el => { const b = el.getBoundingClientRect(); return { w: b.width, l: b.left, rt: b.right }; });
  ok(r.w >= 480 && r.w <= 560, 'the word sheet is a reading width at 1280px (' + Math.round(r.w) + 'px)');
  ok(Math.abs((r.l + r.rt) / 2 - 640) < 4, 'and centred');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.locator('[aria-label*="How you read"]').first().click();
  await page.waitForSelector('#rsheet.on');
  await page.waitForTimeout(350);
  const r2 = await page.locator('#rsheet').evaluate(el => el.getBoundingClientRect().width);
  ok(r2 >= 480 && r2 <= 560, 'and so is How you read (' + Math.round(r2) + 'px)');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.locator('#t-study-open').waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  await page.locator('#t-study-open').click();
  await page.waitForSelector('#studysheet.on');
  await page.waitForTimeout(350);
  const r3 = await page.locator('#studysheet').evaluate(el => el.getBoundingClientRect().width);
  ok(r3 >= 480 && r3 <= 560, 'and so is the study companion (' + Math.round(r3) + 'px)');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 360, height: 780 });
}

console.log('\n=== 18c. the Arabic reads against its own right edge, not the left ===');
{
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(BASE + '/quran?surah=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ayah');
  await page.waitForTimeout(300);
  /* the line starts at the column's right edge and runs left, the way
     Arabic itself runs -- text-align:end resolved to the LEFT once,
     since "end" in a direction:rtl block is the left edge, and the
     Arabic hugged the left under its own seal. Line boxes, not the
     paragraph's own box, since a short verse's <p> can run the full
     column width while its text sits nowhere near one edge of it. */
  const edge = await page.evaluate(() => {
    const ar = document.querySelector('.ayah .ar');
    const ayah = document.querySelector('.ayah');
    const cs = getComputedStyle(ayah);
    const colRight = ayah.getBoundingClientRect().right - parseFloat(cs.paddingRight);
    const range = document.createRange();
    range.selectNodeContents(ar);
    const rects = [...range.getClientRects()];
    const lineRight = Math.max(...rects.map(r => r.right));
    return Math.abs(lineRight - colRight);
  });
  ok(edge <= 2, 'the Arabic line box\'s right edge sits within 2px of the verse column\'s own right edge (' + edge.toFixed(1) + 'px off)');
}

console.log('\n=== 18d. the player is its own light in Day and its own dark in Night ===');
{
  await page.evaluate(() => { try { localStorage.setItem('noor-quran-night', '0'); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ayah');
  await page.waitForTimeout(400);
  const dayBg = await page.locator('#player').evaluate(el => getComputedStyle(el).backgroundColor);
  ok(luminance(dayBg) > 0.6, 'the player reads as a light ground in Day, parchment not navy (' + dayBg + ')');

  await page.evaluate(() => { try { localStorage.setItem('noor-quran-night', '1'); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ayah');
  await page.waitForTimeout(400);
  const nightBg = await page.locator('#player').evaluate(el => getComputedStyle(el).backgroundColor);
  ok(luminance(nightBg) < 0.25, 'and its own dark ground in Night, kept (' + nightBg + ')');
}

console.log('\n=== 18e. Listen and Study are one row, the same shape ===');
{
  await page.waitForTimeout(150);
  const cmp = await page.evaluate(() => {
    const listen = document.querySelector('#a-4 .vlisten');
    const study = document.querySelector('#a-4 .vx');
    if (!listen || !study) return null;
    const lr = listen.getBoundingClientRect(), sr = study.getBoundingClientRect();
    return { lTop: Math.round(lr.top), sTop: Math.round(sr.top), lH: Math.round(lr.height), sH: Math.round(sr.height) };
  });
  ok(!!cmp, 'verse 4 carries both a Listen and a Study pill to compare (it always has, for this promise to mean anything)');
  if (cmp) {
    ok(Math.abs(cmp.lTop - cmp.sTop) <= 2, 'Listen and Study share the same offsetTop (' + cmp.lTop + ' vs ' + cmp.sTop + ')');
    ok(Math.abs(cmp.lH - cmp.sH) <= 2, 'and the same height (' + cmp.lH + 'px vs ' + cmp.sH + 'px)');
  }
  await page.evaluate(() => { try { localStorage.setItem('noor-quran-night', '0'); } catch (e) {} });
}

console.log('\n=== 19. nothing threw ===');
const real = errors.filter(e => !/favicon|net::ERR_|fonts\.(googleapis|gstatic)|\/api\/|mark\.svg|Failed to load resource/.test(e));
if (real.length) console.log('  errors:\n   ' + [...new Set(real)].join('\n   '));
ok(real.length === 0, 'no page errors (' + (real[0] || 'clean') + ')');

await b.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
