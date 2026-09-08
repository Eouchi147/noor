/* NOOR · the Mushaf player, driven the way a thumb drives it.
   ------------------------------------------------------------------
   The Qur'an room was rebuilt around its player: a bar on the bottom edge of
   the phone, a verse that carries a little gold light while it is recited, a
   hairline that fills under it as the ayah goes by, and a word that brightens
   as the voice crosses it. This file holds that to its promises at a phone's
   width and at a desk's:

     · the room opens without a single script error
     · the bar is fixed to the bottom edge and stays there through a scroll
     · one tap plays, the next pauses, and the player says which it is
     · the verse being recited is the one lit, and its line follows the audio
     · next and previous move the light, and tapping a verse starts there
     · a reader who scrolls away is offered the recitation back on a pill
     · reduced motion keeps the glow and drops the sweep
     · nothing scrolls sideways and nothing tappable is under 44 pixels

   The recitation is stubbed with a fake media element: no audio is fetched
   from any mirror, and the test runs with no network at all.

   Needs the static server:  python3 -m http.server 8300 --bind 127.0.0.1
   Then:                     node tests/quran-player.mjs
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8300';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
mkdirSync('tests/shots', { recursive: true });

/* ---- a surah the text service would answer with ---- */
const COUNT = { 1: 7, 2: 286, 112: 4 };
/* The Uthmani text sets the marks of pausing off by a space of their own, so
   one verse here carries four of them, exactly as the mushaf does: ۖ after the
   second word, ۗ ۚ and ۛ later. They are not words and the sweep must not
   count them. */
const WAQF_TEXT = 'الْحَمْدُ لِلَّهِ ۖ رَبِّ الْعَالَمِينَ ۗ الرَّحْمَٰنِ ۚ الرَّحِيمِ مَالِكِ ۛ يَوْمِ الدِّينِ';
const PLAIN_TEXT = 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ الرَّحْمَٰنِ الرَّحِيمِ مَالِكِ يَوْمِ الدِّينِ';
/* a translation that carries markup, because the text service is somebody
   else's and its answer is not the house's to trust */
const TRICK_TRANS = 'A verse <b>x</b> & "quoted", in a line long enough to wrap.';
function surahJSON(n, count, translated) {
  const ayahs = []; const base = (n - 1) * 1000;
  for (let v = 1; v <= count; v++) ayahs.push({
    number: base + v, numberInSurah: v,
    text: translated
      ? (v === 5 ? TRICK_TRANS : 'Verse ' + v + ' translated, in a line long enough to wrap on a phone.')
      : (v === 3 ? WAQF_TEXT : PLAIN_TEXT)
  });
  return { code: 200, status: 'OK', data: { number: n, ayahs } };
}

/* ---- the fake reciter ----------------------------------------------------
   Everything the room asks of a media element and nothing else: a source, a
   duration, a clock that runs while it plays, and the four callbacks the
   engine hangs on it. It sounds nothing and fetches nothing. */
const FAKE = () => {
  /* a long verse, so that no ayah runs out mid-assertion and the bar under
     test is never put away by the recitation simply finishing */
  const DUR = 60, STEP = 0.6;
  class FakeAudio {
    constructor() {
      this.src = ''; this.paused = true; this.currentTime = 0; this.duration = DUR;
      this.playbackRate = 1; this.muted = false; this.readyState = 4; this.error = null;
      this.preload = 'auto'; this.crossOrigin = null; this._t = 0;
      this.buffered = { length: 1, end: () => DUR };
      window.__AUDIO_ELS = (window.__AUDIO_ELS || 0) + 1;
      /* every element the room ever makes, kept so a test can ask the plain
         question the reader asks: is anything still sounding? The room's own
         `paused` flag is what the bar draws, and a bar that says playing over
         an element somebody paused is exactly the fault this guards. */
      (window.__ELS = window.__ELS || []).push(this);
    }
    setAttribute() { } getAttribute() { return null; }
    removeAttribute(k) { if (k === 'src') this.src = ''; }
    addEventListener() { } removeEventListener() { }
    load() { this.currentTime = 0; }
    play() {
      const me = this;
      this.paused = false;
      if (/^data:/.test(this.src)) return Promise.resolve();   /* the silent blessing */
      window.__PLAYS = (window.__PLAYS || 0) + 1;
      clearInterval(this._t);
      setTimeout(() => { if (!me.paused && me.onplaying) me.onplaying(); }, 10);
      this._t = setInterval(() => {
        if (me.paused) return;
        me.currentTime = Math.min(DUR, me.currentTime + STEP * me.playbackRate);
        if (me.currentTime >= DUR) {
          clearInterval(me._t); me.paused = true;
          if (me.onended) me.onended();
          return;
        }
        if (me.ontimeupdate) me.ontimeupdate();
      }, 100);
      return Promise.resolve();
    }
    pause() { this.paused = true; clearInterval(this._t); }
  }
  window.Audio = FakeAudio;
};

const br = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--mute-audio'] });

/* every control a finger can hit in the rooms this file rebuilt */
const TAPPABLE = '#qnav button, #qnav select, #qnav input, #player button, #p-sheet button, ' +
  '#s-sheet button, #s-sheet input, #p-pill, .ayah button, #gates-aside button, #gates-aside input';

async function room(width, height, opts) {
  const ctx = await br.newContext(Object.assign({
    viewport: { width, height }, serviceWorkers: 'block',
    permissions: ['clipboard-read', 'clipboard-write']
  }, opts || {}));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(FAKE);
  await page.route('**/api.alquran.cloud/**', r => {
    const p = new URL(r.request().url()).pathname.split('/');
    const n = +p[3];
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(surahJSON(n, COUNT[n] || 10, p[4] !== 'quran-uthmani')) });
  });
  /* if a mirror is ever asked for a byte, this catches it */
  const audioAsks = [];
  await page.route(u => /(islamic\.network|everyayah|verses\.quran)/.test(u.href), r => { audioAsks.push(r.request().url()); r.abort(); });
  return { ctx, page, errors, audioAsks };
}

async function open(page, surah) {
  await page.goto(BASE + '/quran.html?surah=' + surah, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ayah', { timeout: 15000 });
  await page.waitForTimeout(250);
}

/* the errors that belong to the harness, not to the room: the static server
   runs no /api routes and the sandbox has no way to Google's font host */
const mine = e => !/favicon|net::ERR_|fonts\.(googleapis|gstatic)|\/api\/|mark\.svg|Failed to load resource/.test(e);

for (const W of [390, 1280]) {
  const H = W === 390 ? 844 : 900;
  console.log('\n================ ' + W + '×' + H + ' ================');
  const { ctx, page, errors, audioAsks } = await room(W, H);

  console.log('\n=== 1. the room opens ===');
  await open(page, 1);
  ok(errors.filter(mine).length === 0, 'the page loads with no script error (' + (errors.filter(mine)[0] || 'clean') + ')');
  ok(await page.locator('.ayah').count() === 7, 'Al-Fatiha renders its seven verses');
  ok(await page.locator('#a-1 .ar .w').count() === 9, 'and the first verse is cut into its nine words for the sweep');
  ok(await page.locator('#a-1 .kline').count() === 1, 'every verse carries the karaoke line it will fill');

  console.log('\n=== 1b. the text is the text, and a mark of pausing is not a word ===');
  /* THE SWEEP WAS COUNTING SYMBOLS. The Uthmani text sets ۖ ۗ ۚ ۛ off by a
     space, so cutting at spaces made each one a word of its own and the light
     spent a step on something nobody recites. The mark now rides in the span of
     the word before it: same characters, same order, same spaces, one fewer
     thing for the sweep to count. */
  const waqf = await page.evaluate(src => {
    const ws = [...document.querySelectorAll('#a-3 .ar .w')];
    return {
      spans: ws.length,
      joined: ws.map(w => w.textContent).join(' '),
      alone: ws.filter(w => /^[ۖ-ۭ]+$/.test(w.textContent)).length,
      source: src.trim().replace(/\s+/g, ' ')
    };
  }, WAQF_TEXT);
  ok(waqf.spans === 9, 'a verse carrying four marks of pausing is nine words, not thirteen (' + waqf.spans + ')');
  ok(waqf.alone === 0, 'no span is a mark on its own');
  ok(waqf.joined === waqf.source, 'and not one character of the verse moved or was lost');
  const trans5 = await page.evaluate(() => ({
    text: document.querySelector('#a-5 .trans').textContent,
    tags: document.querySelectorAll('#a-5 .trans *').length
  }));
  ok(trans5.text === TRICK_TRANS, 'a translation that carries markup is shown as the text it is: ' + JSON.stringify(trans5.text));
  ok(trans5.tags === 0, 'and the text service cannot put an element into this page');
  /* the navigator is folded away on a deep link, so the search is typed into
     the way the room hears it rather than through a control that is off screen */
  const filt = await page.evaluate(() => {
    const s = document.getElementById('gate-search');
    s.value = '<b>zz</b>';
    s.dispatchEvent(new Event('input', { bubbles: true }));
    const w = document.getElementById('gates-wrap');
    const out = { tags: w.querySelectorAll('b,img,script').length, text: w.textContent };
    s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true }));
    return out;
  });
  ok(filt.tags === 0 && /<b>zz<\/b>/.test(filt.text), 'and what the reader typed comes back to them as text: ' + JSON.stringify(filt.text.trim()));

  console.log('\n=== 2. the player bar ===');
  ok(await page.locator('#player').isVisible(), 'the bar is in the page before a note is played');
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('player')).position) === 'fixed',
    'it is fixed to the viewport, not laid out in the flow');
  const hidden = await page.evaluate(() => {
    const r = document.getElementById('player').getBoundingClientRect();
    return r.top >= innerHeight - 2;
  });
  ok(hidden, 'and it waits off the bottom edge until there is something to play');
  await page.screenshot({ path: 'tests/shots/quran-' + W + '-idle.png', fullPage: false });

  console.log('\n=== 3. one tap plays, the next pauses ===');
  await page.locator('#a-2 .playbtn').click();
  await page.waitForFunction(() => NOOR_MUSHAF.playingIdx === 1, { timeout: 8000 });
  await page.waitForTimeout(500);                       /* the bar rises in a third of a second */
  ok(await page.evaluate(() => !NOOR_MUSHAF.paused), 'tapping a verse starts it playing');
  ok(await page.evaluate(() => document.body.classList.contains('has-player')), 'the bar comes up and the page makes room for it');
  const seated = await page.evaluate(() => {
    const r = document.getElementById('player').getBoundingClientRect();
    return Math.abs(r.bottom - innerHeight) < 2;
  });
  ok(seated, 'the bar sits on the bottom edge of the viewport');
  ok(await page.locator('#p-title').innerText().then(t => /verse 2 \/ 7/.test(t)), 'and it names the verse being recited');
  await page.locator('#p-toggle').click();
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => NOOR_MUSHAF.paused), 'the round control pauses it');
  ok(await page.locator('#p-sub').innerText().then(t => /paused/i.test(t)), 'and the player says so in words');
  await page.locator('#p-toggle').click();
  await page.waitForTimeout(250);
  ok(await page.evaluate(() => !NOOR_MUSHAF.paused), 'and starts it again');

  console.log('\n=== 4. the verse being recited carries the light ===');
  ok(await page.locator('.ayah.playing').count() === 1, 'exactly one verse is lit');
  ok(await page.locator('#a-2.playing').count() === 1, 'and it is the verse that is sounding');
  const shadow = await page.evaluate(() => getComputedStyle(document.querySelector('.ayah.playing .ar')).textShadow);
  ok(/rgb/.test(shadow) && shadow !== 'none', 'the light is a text shadow on the verse, not a block of colour (' + shadow + ')');
  const f1 = await page.evaluate(() => NOOR_MUSHAF.fill);
  await page.waitForTimeout(420);
  const f2 = await page.evaluate(() => NOOR_MUSHAF.fill);
  ok(f2 > f1, 'the gold line under it fills as the ayah plays (' + f1.toFixed(2) + ' → ' + f2.toFixed(2) + ')');
  ok(f2 <= 1, 'and never past the end of the verse');
  const swept = await page.evaluate(() => NOOR_MUSHAF.wordAt);
  ok(swept >= 0, 'a word inside the verse is lit with it (word ' + swept + ')');
  ok(await page.locator('.ayah.playing .w.now').count() === 1, 'one word at a time, never two');
  await page.screenshot({ path: 'tests/shots/quran-' + W + '-playing.png', fullPage: false });

  console.log('\n=== 5. next and previous move the light ===');
  await page.locator('#p-next').click();
  await page.waitForFunction(() => NOOR_MUSHAF.playingIdx === 2, { timeout: 8000 });
  ok(await page.locator('#a-3.playing').count() === 1, 'next moves the light to verse 3');
  ok(await page.locator('.ayah.playing').count() === 1, 'and leaves nothing lit behind it');
  await page.locator('#p-prev').click();
  await page.waitForFunction(() => NOOR_MUSHAF.playingIdx === 1, { timeout: 8000 });
  ok(await page.locator('#a-2.playing').count() === 1, 'previous brings it back to verse 2');
  const back = await page.evaluate(() => NOOR_MUSHAF.fill);
  ok(back < 0.5, 'and the karaoke line starts again from nothing (' + back.toFixed(2) + ')');

  /* WHAT WENT SILENT ON PREVIOUS. Next always plays the verse already fetched
     ahead, so the preload was handed over and cleared. Previous never does:
     it took the idle element, which is the very element the preload was
     holding, and left the preload pointing at it. The first thing the new
     verse does when it starts is fetch the one after it, and that drops the
     old preload -- pausing the element now reciting. The voice stopped, the
     bar went on saying playing, and nothing ever ended so nothing came next.
     A verse is left to run one whole preload cycle here, which is what it
     takes for the fault to happen at all. */
  await page.waitForTimeout(500);
  const afterPrev = await page.evaluate(() => ({
    flag: !NOOR_MUSHAF.paused,
    sounding: (window.__ELS || []).filter(e => !e.paused).length,
    pre: NOOR_MUSHAF.preloaded, at: NOOR_MUSHAF.playingIdx
  }));
  ok(afterPrev.flag && afterPrev.sounding === 1,
     'after previous a media element is still sounding, not only the bar saying so (' + JSON.stringify(afterPrev) + ')');
  ok(afterPrev.pre === 2 && afterPrev.at === 1, 'and the verse after it is being fetched ahead, exactly once');
  const t1 = await page.evaluate(() => NOOR_MUSHAF.fill);
  await page.waitForTimeout(420);
  ok(await page.evaluate(() => NOOR_MUSHAF.fill) > t1, 'the recitation survives that preload and keeps moving');

  console.log('\n=== 6. tapping a verse starts the recitation there ===');
  await page.locator('#a-6 .ar').click();
  await page.waitForFunction(() => NOOR_MUSHAF.playingIdx === 5, { timeout: 8000 });
  ok(await page.locator('#a-6.playing').count() === 1, 'the tapped verse is the one reciting');
  ok(await page.evaluate(() => NOOR_MUSHAF.follow), 'and the room follows it: the reader chose it');
  /* the same fault reached the room by this door too: a tap on the body of a
     verse is a jump, and a jump is never the verse fetched ahead */
  await page.waitForTimeout(500);
  const afterTap = await page.evaluate(() => ({
    flag: !NOOR_MUSHAF.paused,
    sounding: (window.__ELS || []).filter(e => !e.paused).length,
    pre: NOOR_MUSHAF.preloaded
  }));
  ok(afterTap.flag && afterTap.sounding === 1,
     'a media element is still sounding after the tap and its preload (' + JSON.stringify(afterTap) + ')');
  ok(afterTap.pre === 6, 'and verse 7 is the one being fetched ahead');

  console.log('\n=== 6b. a verse leaves with its reference ===');
  await page.locator('#a-4 .copyb').click();
  await page.waitForSelector('#q-toast', { timeout: 4000 });
  ok(await page.locator('#q-toast').innerText().then(t => /1:4 copied/.test(t)), 'the copy button says which verse it took');
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok(/Qur'an 1:4/.test(clip), 'the clipboard carries the reference');
  ok(/quran\?surah=1&ayah=4/.test(clip), 'and the link back to the verse');
  ok(/Verse 4 translated/.test(clip), 'with the translation the reader was reading');
  ok(await page.evaluate(() => NOOR_MUSHAF.playingIdx) === 5, 'and copying does not start the recitation somewhere else');

  console.log('\n=== 7. the reader who walks away is offered the way back ===');
  await open(page, 2);
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('#a-3 .playbtn').click();
  await page.waitForFunction(() => NOOR_MUSHAF.playingIdx === 2, { timeout: 8000 });
  ok(await page.locator('#p-pill').isHidden(), 'while the reader is with the recitation there is no pill');
  await page.mouse.wheel(0, 1400);
  await page.waitForTimeout(350);
  ok(await page.evaluate(() => !NOOR_MUSHAF.follow), 'one scroll of the reader\'s own stops the following');
  ok(await page.locator('#p-pill').isVisible(), 'and the pill offers the recitation back');
  await page.locator('#p-pill').click();
  await page.waitForTimeout(700);
  ok(await page.evaluate(() => NOOR_MUSHAF.follow), 'tapping it follows again');
  ok(await page.locator('#p-pill').isHidden(), 'and the pill steps out of the way');
  const y = await page.locator('.ayah.playing').boundingBox();
  ok(y && y.y > 0 && y.y < H * 0.42, 'the verse is carried into the upper third of the screen (y=' + (y ? Math.round(y.y) : 'null') + ')');

  console.log('\n=== 8. the settings the bar folds away ===');
  ok(await page.evaluate(() => !NOOR_MUSHAF.sheet), 'the settings start folded');
  await page.locator('#p-more').click();
  await page.waitForTimeout(320);
  ok(await page.evaluate(() => NOOR_MUSHAF.sheet), 'the settings button opens them');
  ok(await page.locator('#p-sheet').innerText().then(t => /Alafasy/.test(t)), 'the reciter the room carries is named (Alafasy)');
  await page.locator('#o-repeat').click();
  ok(await page.evaluate(() => NOOR_MUSHAF.repeat), 'repeat can be turned on');
  await page.locator('#o-repeat').click();
  ok(await page.evaluate(() => !NOOR_MUSHAF.repeat), 'and off again');
  await page.locator('#o-rate button[data-rate="1.25"]').click();
  ok(await page.evaluate(() => NOOR_MUSHAF.rate) === 1.25, 'the speed can be set to 1.25×');
  ok(await page.locator('#p-sub').innerText().then(t => /1\.25×/.test(t)), 'and the player names the speed it is reciting at');
  await page.locator('#o-rate button[data-rate="1"]').click();
  const wasSize = await page.evaluate(() => NOOR_MUSHAF.size);
  await page.locator('#o-size button[data-size="+"]').click();
  ok(await page.evaluate(() => NOOR_MUSHAF.size) > wasSize, 'the Arabic can be made larger');
  await page.locator('#o-size button[data-size="-"]').click();
  ok(await page.evaluate(() => NOOR_MUSHAF.size) === wasSize, 'and put back');
  await page.locator('#o-trans').click();
  ok(await page.locator('#a-1 .trans').isHidden(), 'the translation can be put away');
  await page.locator('#o-trans').click();
  ok(await page.locator('#a-1 .trans').isVisible(), 'and brought back');
  ok(await page.locator('#o-lang option').count() === 2, 'the two translations the room carries are both offered (Saheeh, Hamidullah)');
  await page.locator('#p-more').click();
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => !NOOR_MUSHAF.sheet), 'and the settings fold away again');

  console.log('\n=== 9. the surah sheet ===');
  const picker = W === 390 ? '#q-pick' : '#p-open';
  await page.locator(picker).click();
  await page.waitForTimeout(250);
  ok(await page.evaluate(() => NOOR_MUSHAF.picker), 'the picker opens as a sheet');
  ok(await page.locator('#s-list .srow').count() === 114, 'with all 114 surahs in it');
  await page.locator('#s-search').fill('112');
  await page.waitForTimeout(120);
  ok(await page.locator('#s-list .srow').count() === 1, 'a number finds one surah');
  await page.locator('#s-search').fill('sincer');
  await page.waitForTimeout(120);
  ok(await page.locator('#s-list .srow').count() === 1, 'and so does what the name means');
  await page.locator('#s-list .srow').first().click();
  await page.waitForFunction(() => NOOR_MUSHAF.cur === 112, { timeout: 10000 });
  ok(await page.evaluate(() => !NOOR_MUSHAF.picker), 'choosing one closes the sheet');
  await page.waitForFunction(() => location.search.indexOf('surah=112') >= 0, { timeout: 10000 })
    .then(() => ok(true, 'and the deep link follows the reader (' + page.url().split('?')[1] + ')'))
    .catch(() => ok(false, 'and the deep link follows the reader (' + page.url().split('?')[1] + ')'));

  console.log('\n=== 10. the shape of the room ===');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(wide <= 1, 'nothing pushes the page sideways (' + wide + 'px over)');
  await page.evaluate(() => scrollTo(0, 0));
  await open(page, 2);
  await page.evaluate(() => scrollTo(0, 600));
  await page.waitForTimeout(350);
  ok(await page.evaluate(() => document.body.classList.contains('qscrolled')), 'the navigator collapses once the reading has started');
  ok(await page.locator(picker).isVisible(), 'and the surah picker stays reachable in it');
  const small = await page.evaluate(sel => {
    const bad = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;                     /* not on screen */
      if (getComputedStyle(el).visibility === 'hidden') continue;
      if (r.height < 44 || r.width < 44) bad.push((el.id || el.className || el.tagName) + ' ' + Math.round(r.width) + '×' + Math.round(r.height));
    }
    return bad;
  }, TAPPABLE);
  ok(small.length === 0, 'nothing tappable is under 44 pixels (' + (small.join(', ') || 'all clear') + ')');
  const focus = await page.evaluate(() => {
    const b = document.getElementById('p-toggle'); b.focus();
    return document.activeElement === b && getComputedStyle(b, ':focus-visible') !== null;
  });
  ok(focus, 'the play control takes keyboard focus');

  console.log('\n=== 11. no byte of audio was fetched from a mirror ===');
  ok(audioAsks.length === 0, 'the recitation was stubbed end to end (' + audioAsks.length + ' requests)');
  ok(errors.filter(mine).length === 0, 'and nothing threw along the way (' + (errors.filter(mine)[0] || 'clean') + ')');
  await ctx.close();
}

console.log('\n================ reduced motion ================');
{
  const { ctx, page, errors } = await room(390, 844, { reducedMotion: 'reduce' });
  await open(page, 1);
  await page.locator('#a-2 .playbtn').click();
  await page.waitForFunction(() => NOOR_MUSHAF.playingIdx === 1, { timeout: 8000 });
  await page.waitForTimeout(600);
  ok(await page.locator('.ayah.playing').count() === 1, 'the verse being recited is still lit');
  const glow = await page.evaluate(() => getComputedStyle(document.querySelector('.ayah.playing .ar')).textShadow);
  ok(/rgb/.test(glow) && glow !== 'none', 'and the glow still shows, without moving');
  ok(await page.locator('.ayah.playing .w.now').count() === 0, 'no word sweeps under reduced motion');
  ok(await page.evaluate(() => NOOR_MUSHAF.wordAt) === -1, 'the sweep is not merely hidden: it never runs');
  const before = await page.evaluate(() => scrollY);
  await page.locator('#p-next').click();
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => scrollY) !== null && Math.abs(await page.evaluate(() => scrollY) - before) >= 0,
    'and following still places the verse, without a smooth scroll');
  ok(errors.filter(mine).length === 0, 'nothing threw (' + (errors.filter(mine)[0] || 'clean') + ')');
  await ctx.close();
}

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
