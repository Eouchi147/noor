/* NOOR · the home page, second cut.
   ------------------------------------------------------------------
   The home page was rebuilt on the second cut's shell (assets/noor2.css and
   noor2.js). Two things are held here.

   THE WIRING. Everything the old page wired that other rooms still lean on
   is still there: the search and the menu dial, the language layer with its
   hreflang doors, the beacon and the service worker (noor-fx.js), the
   dials, the Path's ?node= and #node- deep links, the give door, the footer
   doors, the structured data, the meta tags and the canonical. Every room
   in assets/menu-index.json is a real link on the page, grouped as the menu
   groups them, and every internal link resolves to a file or a rewrite.

   THE PROMISE. Pinch zoom is allowed, there is one glowing thing, one door
   of giving and no word that hurries anyone. The verse screen walks the
   reels shelf with the same stride as api/_schedule.js, so what the page
   shows is what the poster shows. And when the library's answers cannot be
   fetched (a static server has no /api) both living screens stay calm doors,
   never an error.

   Static checks need nothing. The browser checks serve the repository on
   :8766 themselves (python3 -m http.server) unless NOOR_BASE names a server,
   and write screenshots to $NOOR_SHOTS (default tests/.shots/home).

   Run:  node tests/home2.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const count = (s, re) => (s.match(re) || []).length;

console.log('\n=== 1. the file parses ===');
{
  ok(/^<!DOCTYPE html>/i.test(html), 'opens with a doctype');
  ok(/<html lang="en"[^>]*data-n2="[^"]*night[^"]*"/.test(html), 'the html element carries lang and the shell\'s data-n2');
  ok(/<\/html>\s*$/.test(html), 'closes the html element');
  /* every container tag opened is closed; the file has no self-closing containers */
  const body = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  for (const tag of ['html', 'head', 'body', 'header', 'main', 'footer', 'section', 'div', 'ul', 'li', 'p', 'a', 'h1', 'h2', 'h3', 'span', 'b', 'small', 'button', 'kbd', 'svg', 'i'])
    ok(count(body, new RegExp('<' + tag + '(?=[\\s>])', 'g')) === count(body, new RegExp('</' + tag + '>', 'g')), 'every <' + tag + '> is closed');
  ok(count(html, /<script[\s>]/g) === count(html, /<\/script>/g), 'every script is closed');
  ok(count(html, /<style[\s>]/g) === count(html, /<\/style>/g), 'every style is closed');
  const inline = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '';
  let parses = true; try { new Function(inline); } catch (e) { parses = false; console.log('     ' + e.message); }
  ok(parses, 'the inline script is valid JavaScript');
  const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  ok(count(css, /\{/g) === count(css, /\}/g), 'the inline style has balanced braces');
  const size = Buffer.byteLength(html);
  ok(size < 60 * 1024, 'the page is under 60 KB (' + size + ' bytes)');
}

console.log('\n=== 2. the shell and the wiring ===');
{
  const need = {
    'the shell\'s stylesheet': /<link[^>]+href="\/assets\/noor2\.css\?v=\d+"/,
    'the shell\'s script': /<script[^>]+src="\/assets\/noor2\.js\?v=\d+"[^>]*defer/,
    'the search overlay styles (noor-rtl.css)': /href="\/assets\/noor-rtl\.css/,
    'the menu dial styles': /href="\/assets\/noor-menu\.css/,
    'the search (noor-search.js)': /src="\/assets\/noor-search\.js/,
    'the menu dial (noor-menu.js)': /src="\/assets\/noor-menu\.js/,
    'the language prose layer (noor-text.js)': /src="\/assets\/noor-text\.js/,
    'the beacon, the service worker and NOOR_I18N (noor-fx.js)': /src="\/noor-fx\.js"/,
    'the Path index (nodes-index.js)': /src="\/nodes-index\.js/,
    'the dials, with the #noor-notice machinery': /src="\/assets\/noor-dials\.js/,
    'the corrections layer': /src="\/assets\/noor-overrides\.js/,
    'the canonical': /<link rel="canonical" href="https:\/\/noorcodex\.com\/"\/>/,
    'the web manifest': /<link rel="manifest" href="\/manifest\.webmanifest"\/>/,
    'the icons': /mark\.svg[\s\S]*mark-64\.png[\s\S]*mark-180\.png/,
    'the description': /<meta name="description" content="NOOR · Codex of Light\./,
    'og:title, og:image, og:type': /og:title[\s\S]*og:image" content="https:\/\/noorcodex\.com\/assets\/brand\/og\.png"[\s\S]*/,
    'twitter:card': /<meta name="twitter:card" content="summary_large_image"\/>/,
    'theme-color': /<meta name="theme-color" content="#04060F"\/>/,
    'the site verifications': /p:domain_verify[\s\S]*google-site-verification/,
    'the Today fetch, as the old page asked it': /\/api\/illuminations\?kind=light&lang=/,
    'the reels manifest fetch': /"\/reels\/index\.json"/,
    'the chapter fetch': /"\/node\/" \+ n \+ "\.json"/,
    'the ?node= and #node- deep links': /sp\.get\("node"\)[\s\S]*#node-\(\\d\+\)/,
    'the #search arrival': /location\.hash === "#search"/,
    'the language pill NOOR_I18N syncs (#lang-cur)': /id="lang-cur"/,
    'the language door sets the house language': /NOOR_I18N\.setLang\(b\.getAttribute\("data-setlang"\)\)/,
    'the search field opens the search': /NOOR_SEARCH\.open\(\)/,
    'the menu door': /data-nm-open/,
    'the share buttons use the shell': /data-n2-share=/,
    'the play button and a video that waits for a tap': /<video playsinline controls preload=\\?"none\\?"/,
    'the noor:lang event re-lights the day': /addEventListener\("noor:lang"/
  };
  for (const k of Object.keys(need)) ok(need[k].test(html), k + ' is wired');
  ok(fs.existsSync(path.join(ROOT, 'assets/noor2.css')) && fs.existsSync(path.join(ROOT, 'assets/noor2.js')), 'the shell files exist');
  ok(!/data-n2="[^"]*\bhome\b/.test(html), 'the home-screen offer is not raised on the arrival page');
}

console.log('\n=== 3. the promises ===');
{
  const vp = (html.match(/<meta name="viewport" content="([^"]*)"/) || [])[1] || '';
  ok(vp && !/user-scalable\s*=\s*no/i.test(vp) && !/maximum-scale/i.test(vp), 'pinch zoom is allowed (' + vp + ')');
  ok(/viewport-fit=cover/.test(vp), 'the viewport reaches the safe area');
  const kept = ['en', 'x-default', 'ar', 'fr', 'es', 'de', 'ru', 'tr', 'ur', 'hi', 'bn', 'id', 'fa', 'prs', 'pa'];
  const have = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="https:\/\/noorcodex\.com\/([a-z-]*)"\/>/g)].map(m => [m[1], m[2]]);
  ok(have.map(h => h[0]).sort().join(',') === kept.slice().sort().join(','), 'the hreflang list is exactly the kept set (' + have.length + ')');
  ok(have.every(h => h[0] === 'en' || h[0] === 'x-default' ? h[1] === '' : h[1] === h[0]), 'every hreflang points at its own door');
  for (const d of ['ha', 'ja', 'ko', 'ku', 'so', 'sw', 'zh', 'ps']) ok(!new RegExp('hreflang="' + d + '"').test(html), 'hreflang ' + d + ' is dropped');
  ok(count(html, /href="\/donate"/g) === 1, 'the door of giving is one link');
  ok(/Open the door of giving/.test(html), 'and it is worded as a door, not an ask');
  for (const w of ['only today', 'hurry', 'limited', 'urgent', 'last chance', 'countdown', 'don\'t miss', 'act now'])
    ok(!new RegExp(w, 'i').test(html), 'no "' + w + '"');
  ok(count(html, /n2-glow/g) === 1, 'one thing glows, and only one');
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ');
  ok(!/!/.test(visible), 'no exclamation mark anywhere on the page');
  ok(!/user-scalable/.test(html), 'user-scalable is not set at all');
  for (const bad of ['hero-stats', 'mo-count', 'h2mq', 'marquee', 'countUp', 'codex-count'])
    ok(!html.includes(bad), 'no ' + bad + ' (no counters, no marquee)');
  ok(!/autoplay/.test(html), 'no auto-playing video');
  ok(html.includes('<p class="n2-p n2-wide">The whole library, free forever: no ads, no account, no tracking.</p>'), 'the line of truth is on the page, in the register of the house');
  ok(html.includes('<h2 class="n2-h2">The whole library, <span class="n2-g">free</span></h2>'), 'the library screen says the same, with the key word in gold');
  ok(html.includes('with its date, and its source where the card names one'), 'the Lights claim a source only where a card names one');
  ok(!/whole of Islam/i.test(html), 'no "the whole of Islam"');
}

console.log('\n=== 4. the structured data ===');
{
  const ld = (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  let j = null; try { j = JSON.parse(ld); } catch (e) {}
  ok(j && Array.isArray(j['@graph']), 'the JSON-LD parses');
  const types = j ? j['@graph'].map(x => x['@type']) : [];
  ok(types.includes('Organization') && types.includes('WebSite'), 'it carries the Organization and the WebSite');
  const org = j && j['@graph'].find(x => x['@type'] === 'Organization');
  ok(org && org.sameAs && org.sameAs.length === 6, 'the Organization names its six doors');
}

console.log('\n=== 5. every door is real ===');
{
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const rewrites = (vercel.rewrites || []).map(r => new RegExp('^' + r.source.replace(/:[a-z]+/g, '[^/]+') + '$'));
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(h => /^[\/#]/.test(h) && !/^\/\//.test(h));
  const missing = [];
  for (const h of new Set(hrefs)) {
    if (h.startsWith('#')) { if (!ids.has(h.slice(1))) missing.push(h); continue; }
    const p = h.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
    if (p === '/') continue;
    const rel = p.slice(1);
    const found = fs.existsSync(path.join(ROOT, rel)) || fs.existsSync(path.join(ROOT, rel + '.html')) || fs.existsSync(path.join(ROOT, rel, 'index.html'))
      || rewrites.some(re => re.test(p));
    if (!found) missing.push(h);
  }
  ok(!missing.length, 'every internal href resolves to a file or a rewrite' + (missing.length ? ' (missing: ' + missing.join(', ') + ')' : ' (' + new Set(hrefs).size + ' checked)'));
  for (const id of ['top', 'today', 'verse', 'library', 'timeline', 'mizan', 'free', 'langs']) ok(ids.has(id), '#' + id + ' is on the page');
  const links = new Set([...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]));
  const menu = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/menu-index.json'), 'utf8'));
  let rooms = 0, lost = [];
  for (const s of menu.sections) for (const it of s.items) {
    if (it.u === '/donate') continue;                     /* the door of giving is its own screen */
    rooms++;
    const u = it.u.replace(/^\/#/, '#');
    const re = new RegExp('<a href="' + u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"><b>' + it.t.replace(/&/g, '&amp;').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '<small>');
    if (!re.test(html)) lost.push(it.u);
  }
  ok(!lost.length, 'every room of the menu index is a door on the page' + (lost.length ? ' (lost: ' + lost.join(', ') + ')' : ' (' + rooms + ')'));
  ok(new RegExp('<p class="hm-count">' + rooms + ' rooms · ' + menu.sections.length + ' sections').test(html), 'the count of rooms is the menu\'s own (' + rooms + ' · ' + menu.sections.length + ')');
  const rx = s => s.replace(/&/g, '&amp;').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const s of menu.sections) ok(new RegExp('<h3 class="n2-h3">' + rx(s.n) + '<small class="hm-sub">' + rx(s.s) + '</small></h3>').test(html), 'the section "' + s.n + '" is grouped as the menu groups it');
  /* the seven books span the chapters nodes-index.js gives their periods */
  const src = fs.readFileSync(path.join(ROOT, 'nodes-index.js'), 'utf8');
  const NODES = JSON.parse(src.match(/const\s+NODES\s*=\s*(\[[\s\S]*?\]);/)[1]);
  const per = {};
  for (const n of NODES) { (per[n.period] = per[n.period] || []).push(n.id); }
  for (const p of Object.keys(per)) {
    const a = Math.min(...per[p]), b = Math.max(...per[p]);
    ok(new RegExp('href="/path#' + p + '"><span class="n2-num">' + a + '–' + b + '</span>').test(html), 'the book of ' + p + ' spans chapters ' + a + '–' + b);
  }
  ok(new RegExp('· ' + NODES.length + ' chapters').test(html) && new RegExp('All ' + NODES.length + ' chapters').test(html), 'the Path counts ' + NODES.length + ' chapters');
  /* the footer's doors are the house's one list */
  const fx = fs.readFileSync(path.join(ROOT, 'noor-fx.js'), 'utf8');
  const social = [...fx.matchAll(/href: "(https:[^"]+)"/g)].map(m => m[1]);
  ok(social.length === 6 && !social.some(u => links.has(u)) && !/noor-social/.test(html), 'the page carries none of the six doors of NOOR_SOCIAL itself: noor-fx.js draws the row');
  ok(/<p data-i18n="footer.note">Qur'an · authentic Hadith · classical sirah<\/p>\s*<nav aria-label="Languages"/.test(html), 'the footer has the note line and the languages nav the row is placed between');
  for (const h of ['/license', '/journal', '/feedback', '/legal']) ok(new RegExp('<footer[\\s\\S]*href="' + h + '"').test(html), 'the footer links ' + h);
}

console.log('\n=== 6. the verse walks the shelf with the poster\'s stride ===');
{
  const S = await import('../api/_schedule.js');
  const inline = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '';
  const from = inline.indexOf('function hash32'), to = inline.indexOf('function verse()');
  const walk = new Function(inline.slice(from, to) + '; return { reelStep: reelStep, pickStep: pickStep, ROTA: ROTA, HALVES: HALVES };')();
  const cards = [];
  for (let i = 0; i < 37; i++) cards.push({ id: 'verse-' + i, kind: 'verse', slot: i % 2 ? 'evening' : 'morning', hook: '1:' + (i + 1), caption: 'c' });
  let same = 0, tried = 0;
  for (let d = 0; d < 120; d++) {
    const date = new Date(Date.UTC(2026, 8, 6) + d * 86400000).toISOString().slice(0, 10);
    const dow = new Date(date + 'T12:00:00Z').getUTCDay();
    for (const half of walk.HALVES) {
      if (walk.ROTA[half][dow] !== 'verse') continue;
      tried++;
      const theirs = S.chooseReel(cards, date, half, null);
      const ours = walk.pickStep(cards, walk.reelStep('verse', date, half), 'reel:verse');
      if (theirs && ours && theirs.id === ours.id) same++;
    }
  }
  ok(tried > 100 && same === tried, 'the page picks what chooseReel picks on every verse slot of 120 days (' + same + '/' + tried + ')');
  const rota = html.match(/var ROTA = \{([\s\S]*?)\};/)[1].replace(/\s+/g, '');
  const src = fs.readFileSync(path.join(ROOT, 'api/_schedule.js'), 'utf8');
  const theirRota = src.match(/const ROTA = \{([\s\S]*?)\};/)[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '');
  ok(rota === theirRota, 'the ROTA is copied letter for letter');
  ok(/REEL_EPOCH = Date\.UTC\(2026, 8, 6\)/.test(html) && /REEL_EPOCH = Date\.UTC\(2026, 8, 6\)/.test(src), 'the epoch is the same Sunday');
  ok(/copied faithfully from api\/_schedule\.js/.test(html), 'the copy names its source');
}

/* ------------------------------------------------------------------------
   the browser: the page on a phone and a laptop, with the library's answers
   and without them
------------------------------------------------------------------------ */
console.log('\n=== 7. in a browser ===');
let server = null;
const PORT = 8766;
const listening = p => new Promise(r => { const s = net.createConnection(p, '127.0.0.1'); s.once('connect', () => { s.end(); r(true); }); s.once('error', () => r(false)); });
let BASE = process.env.NOOR_BASE || '';
if (!BASE) {
  if (!(await listening(PORT))) {
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
    for (let i = 0; i < 40 && !(await listening(PORT)); i++) await new Promise(r => setTimeout(r, 150));
  }
  BASE = 'http://127.0.0.1:' + PORT;
}
const SHOTS = process.env.NOOR_SHOTS || path.join(ROOT, 'tests', '.shots', 'home');
fs.mkdirSync(SHOTS, { recursive: true });
let chromium = null;
try { ({ chromium } = await import('playwright')); } catch (e) { console.log('  playwright is not installed; the browser checks are skipped'); }
if (chromium) {
  const br = await chromium.launch();
  const LIGHT = { date: '2026-09-09', category: 'Libraries', title: 'He called his 1,600 books the smallest library in the family',
    story: 'When a Moroccan army took Timbuktu, its scholars were arrested, and in 1593 Ahmad Baba was taken in chains across the Sahara to Marrakesh.',
    detail: 'Ahmad Baba · Timbuktu and Marrakesh, 1593 CE', id: 'ahmad-baba', src: 'Hunwick, Timbuktu and the Songhay Empire' };
  /* the rows as the live manifest writes them (seen on noorcodex.com):
     the reference lives in the id, the hook carries the surah name too,
     cover is the boolean true (the file is /reels/<id>-cover.jpg) and the
     video is the release's own https URL */
  const REELS = { n: 2, written: '2026-09-09', cards: [
    { id: 'verse-1-1-7', kind: 'verse', slot: 'morning', hook: 'Al-Fatiha · 1:1-7', caption: 'Al-Fatiha · 1:1-7\n\nIn the name of Allah, the Entirely Merciful, the Especially Merciful. [All] praise is [due] to Allah, Lord of the worlds.\n\nRecited by Maher al-Muaiqly. Read the whole surah with its meaning, and hear every verse, free: noorcodex.com/quran\n\n#OneVerse', secs: 34.89, cover: true, video: 'https://github.com/Eouchi147/noor/releases/download/reels-verse/verse-1-1-7.mp4', reciter: 'Maher al-Muaiqly' },
    { id: 'verse-2-153', kind: 'verse', slot: 'evening', hook: 'Al-Baqarah · 2:153', caption: 'Al-Baqarah · 2:153\n\nO you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.\n\nRecited by Abdul Basit. Read the whole surah: noorcodex.com/quran', secs: 24, cover: true, reciter: 'Abdul Basit' }
  ] };
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const withFixtures = async pg => {
    await pg.route('**/api/illuminations**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LIGHT) }));
    await pg.route('**/reels/index.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(REELS) }));
    await pg.route('**/reels/*-cover.jpg', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  };
  const errors = [];
  const newPage = async (vp, mobile) => {
    const pg = await br.newPage({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    pg.on('pageerror', e => errors.push(String(e.message || e)));
    return pg;
  };
  const settle = pg => pg.waitForTimeout(1500);

  /* --- the phone, without the API: a static server has none --- */
  {
    const pg = await newPage({ width: 390, height: 844 }, true);
    await pg.goto(BASE + '/', { waitUntil: 'load' }); await settle(pg);
    const st = await pg.evaluate(() => ({
      glow: document.querySelectorAll('.n2-glow').length,
      still: !!document.querySelector('.n2-still'), gl: !!document.querySelector('#n2-gl'),
      bar: document.querySelectorAll('.n2-bar a').length, top: !!document.querySelector('.n2-top .n2-brand'),
      ideas: document.querySelectorAll('.n2-idea').length,
      today: document.querySelector('#today').innerText, verse: document.querySelector('#verse').innerText,
      wide: document.documentElement.scrollWidth <= window.innerWidth + 1,
      title: document.title, give: document.querySelectorAll('a[href="/donate"]').length,
      firstIn: document.querySelector('#top').classList.contains('n2-in'),
      notice: !!document.querySelector('#noor-notice'),
      social: document.querySelectorAll('[data-noor-social]').length,
      socialIn: (r => r ? { foot: !!r.closest('footer'), links: [...r.querySelectorAll('a')].map(a => a.getAttribute('href')), left: r.getBoundingClientRect().left, x: r.querySelector('a svg').getBoundingClientRect().left, tx: r.previousElementSibling.getBoundingClientRect().left } : null)(document.querySelector('[data-noor-social]')),
      minFont: Math.min(...[...document.querySelectorAll('main *')].filter(e => e.innerText && e.children.length === 0).map(e => parseFloat(getComputedStyle(e).fontSize)))
    }));
    ok(st.glow === 1, 'one glowing thing in the DOM');
    ok(st.still && st.gl, 'the night is drawn (the still, and the canvas over it)');
    ok(st.bar === 5 && st.top, 'the bar has its five rooms and the top line its mark');
    ok(st.ideas >= 14, 'the screens are .n2-idea (' + st.ideas + ')');
    ok(/One Light a day/.test(st.today) && !/error|could not|failed|resting/i.test(st.today), 'without the API, Today is a calm door');
    ok(/One verse, one thought/.test(st.verse) && !/error|could not|failed/i.test(st.verse), 'without the manifest, the verse is a calm door');
    ok(st.wide, 'the page does not scroll sideways on a phone');
    ok(st.give === 1, 'one door of giving in the DOM');
    ok(st.firstIn, 'the arrival is lit before the observer runs');
    ok(st.social === 1 && st.socialIn && st.socialIn.foot && st.socialIn.links.length === 6, 'noor-fx.js drew the row of six doors once, inside the footer');
    ok(st.socialIn && Math.abs(st.socialIn.x - st.socialIn.tx) < 2, 'and its first mark sits on the footer\'s left edge with the text');
    ok(st.minFont >= 12, 'no type under 12 px on a phone (' + st.minFont + ')');
    await pg.screenshot({ path: path.join(SHOTS, 'phone-1-arrival.png') });
    for (const [id, name] of [['today', 'phone-2-today-bare'], ['verse', 'phone-3-verse-bare'], ['library', 'phone-4-library'], ['lib-story', 'phone-5-story'], ['timeline', 'phone-6-path'], ['mizan', 'phone-7-two-lives'], ['free', 'phone-8-no-catch']]) {
      await pg.evaluate(i => document.getElementById(i).scrollIntoView({ behavior: 'instant', block: 'start' }), id);
      await pg.waitForTimeout(1300);
      await pg.screenshot({ path: path.join(SHOTS, name + '.png') });
    }
    await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await pg.waitForTimeout(1200);
    await pg.screenshot({ path: path.join(SHOTS, 'phone-9-footer.png') });
    /* the search field opens the search */
    await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(600);
    await pg.click('#hm-search'); await pg.waitForTimeout(600);
    ok(await pg.evaluate(() => !!document.querySelector('#noor-search.on')), 'the search field opens the search overlay');
    await pg.screenshot({ path: path.join(SHOTS, 'phone-10-search.png') });
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
    /* the language door */
    await pg.click('#lang-btn'); await pg.waitForTimeout(900);
    const langs = await pg.evaluate(() => document.querySelectorAll('.n2-sheet [data-setlang]').length);
    ok(langs === 14, 'the language door offers the fourteen marked languages (' + langs + ')');
    await pg.screenshot({ path: path.join(SHOTS, 'phone-11-language.png') });
    await pg.click('.n2-sheet [data-setlang="ar"]'); await pg.waitForTimeout(1500);
    const rtl = await pg.evaluate(() => [document.documentElement.dir, document.documentElement.lang, document.querySelector('#lang-cur').textContent]);
    ok(rtl[0] === 'rtl' && rtl[1] === 'ar' && rtl[2] === 'AR', 'choosing Arabic turns the page (' + rtl.join(' · ') + ')');
    await pg.screenshot({ path: path.join(SHOTS, 'phone-12-arabic.png') });
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'and it still does not scroll sideways');
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await pg.close();
  }
  /* --- ?node=2 opens the chapter, #node-2 too, ?lang= is honoured --- */
  {
    const pg = await newPage({ width: 390, height: 844 }, true);
    await pg.goto(BASE + '/?node=2', { waitUntil: 'load' }); await pg.waitForTimeout(1800);
    const sh = await pg.evaluate(() => { const s = document.querySelector('.n2-sheet-wrap.n2-show .n2-sheet'); return s ? s.textContent : ''; });
    ok(/chapter 2 of 71/.test(sh) && /Adam from Clay/.test(sh) && /Read the chapter/.test(sh), '?node=2 opens the chapter in a sheet');
    ok(/Pride refused the command/.test(sh), 'with its first lesson from /node/2.json');
    await pg.screenshot({ path: path.join(SHOTS, 'phone-13-chapter.png') });
    await pg.goto(BASE + '/#node-71', { waitUntil: 'load' }); await pg.waitForTimeout(1800);
    ok(await pg.evaluate(() => /chapter 71 of 71/.test((document.querySelector('.n2-sheet-wrap.n2-show .n2-sheet') || {}).textContent || '')), '#node-71 opens the last chapter');
    await pg.goto(BASE + '/?lang=fr', { waitUntil: 'load' }); await pg.waitForTimeout(1500);
    ok(await pg.evaluate(() => document.documentElement.lang === 'fr'), '?lang=fr is honoured by the language layer');
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await pg.close();
  }
  /* --- the phone, with the library's answers --- */
  {
    const pg = await newPage({ width: 390, height: 844 }, true);
    await withFixtures(pg);
    await pg.goto(BASE + '/', { waitUntil: 'load' }); await settle(pg);
    const st = await pg.evaluate(() => ({
      gold: (document.querySelector('#today .n2-h2 .n2-g') || {}).textContent || '',
      title: document.querySelector('#today .n2-h2').textContent,
      share: document.querySelectorAll('#today [data-n2-share]').length,
      light: (document.querySelector('#today a.n2-gold') || {}).getAttribute('href'),
      ref: (document.querySelector('#verse .n2-ref') || {}).textContent || '',
      meaning: (document.querySelector('#verse .n2-meaning') || {}).textContent || '',
      video: (v => v ? { preload: v.preload, paused: v.paused, poster: v.poster, src: v.getAttribute('src'), controls: v.hasAttribute('controls'), inline: v.hasAttribute('playsinline') } : null)(document.querySelector('#verse video')),
      verseLink: (document.querySelector('#verse a.n2-gold') || {}).getAttribute('href'),
      glow: document.querySelectorAll('.n2-glow').length
    }));
    ok(st.title.includes('1,600 books') && st.gold === '1,600 books', 'the day\'s Light is on the page with its key phrase in gold');
    ok(st.share === 1 && st.light === '/light/ahmad-baba', 'with a Share button and the door to the whole Light');
    ok(/^Qur.an 1:1-7$/.test(st.ref), 'the verse is the reel the rota picks today, its reference read from the id (' + st.ref + ')');
    ok(/Lord of the worlds/.test(st.meaning), 'with its meaning, the caption\'s second paragraph');
    ok(st.video && st.video.preload === 'none' && st.video.paused && st.video.controls && st.video.inline && /\/reels\/verse-1-1-7-cover\.jpg$/.test(st.video.poster) && st.video.src === 'https://github.com/Eouchi147/noor/releases/download/reels-verse/verse-1-1-7.mp4', 'the reel waits for a tap: the release video, the cover at /reels/<id>-cover.jpg');
    ok(st.verseLink === '/verse/1-1-7', 'and the verse has its own room');
    ok(/Maher al-Muaiqly/.test(await pg.evaluate(() => document.querySelector('#verse .n2-eyebrow').textContent)), 'the reciter is named');
    ok(st.glow === 1, 'still one glowing thing');
    await pg.evaluate(() => document.getElementById('today').scrollIntoView({ behavior: 'instant' })); await pg.waitForTimeout(1300);
    await pg.screenshot({ path: path.join(SHOTS, 'phone-14-today.png') });
    await pg.evaluate(() => document.getElementById('verse').scrollIntoView({ behavior: 'instant' })); await pg.waitForTimeout(1300);
    await pg.screenshot({ path: path.join(SHOTS, 'phone-15-verse.png') });
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll with the reel in place');
    await pg.close();
  }
  /* --- the laptop --- */
  {
    const pg = await newPage({ width: 1280, height: 800 }, false);
    await withFixtures(pg);
    await pg.goto(BASE + '/', { waitUntil: 'load' }); await settle(pg);
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'the page does not scroll sideways on a laptop');
    await pg.screenshot({ path: path.join(SHOTS, 'desk-1-arrival.png') });
    await pg.evaluate(() => document.getElementById('today').scrollIntoView({ behavior: 'instant' })); await pg.waitForTimeout(1300);
    await pg.screenshot({ path: path.join(SHOTS, 'desk-2-today.png') });
    await pg.evaluate(() => document.getElementById('verse').scrollIntoView({ behavior: 'instant' })); await pg.waitForTimeout(1300);
    await pg.screenshot({ path: path.join(SHOTS, 'desk-3-verse.png') });
    await pg.evaluate(() => document.getElementById('free').scrollIntoView({ behavior: 'instant' })); await pg.waitForTimeout(1300);
    await pg.screenshot({ path: path.join(SHOTS, 'desk-4-no-catch.png') });
    /* every screen lit once scrolled, for the whole-page shot */
    await pg.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await pg.waitForTimeout(1500);
    await pg.screenshot({ path: path.join(SHOTS, 'desk-5-whole.png'), fullPage: true });
    await pg.close();
  }
  ok(!errors.length, 'no script error in any page' + (errors.length ? ' (' + errors.slice(0, 3).join(' | ') + ')' : ''));
  await br.close();
  console.log('  screenshots in ' + SHOTS);
}
if (server) server.kill();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
