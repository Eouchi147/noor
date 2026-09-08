/* NOOR · the row of doors under every footer.
   ------------------------------------------------------------------
   The house has doors on other people's platforms and, until this row,
   a reader had to already know they existed to find one. The row is not
   pasted into sixty-one pages: it is one constant and one block in
   noor-fx.js, the only script every page in the house already loads, and
   it draws itself into whatever shape that page's footer takes.

   Three shapes exist, and all three are proved here:
     · a real <footer> (the thirty-eight rooms),
     · the About band that carries footer.note (the front page),
     · the bare languages line at the foot of a translated index.

   What is measured rather than looked at:
     · the row appears exactly ONCE per page -- a second copy is the
       failure a shared script makes, and it is silent;
     · Facebook is NOT drawn, because its href is empty until Sam pastes
       the Page's own URL in: an empty door is worse than no door;
     · every target is a real 44px thumb target, not a 22px icon;
     · nothing pushes the page sideways at 390, in Arabic either, where
       the row has to centre under dir="rtl";
     · index.html's JSON-LD still parses and its sameAs names the doors.

   Needs a static server for the site and playwright:
     python3 -m http.server 8310 --bind 127.0.0.1 &
     node tests/social-footer.mjs
*/
import { chromium } from 'playwright';
import fs from 'fs';
import vm from 'vm';
import path from 'path';

const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8310';
const SHOT = 'tests/shots/footer-390.png';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

/* ---------- 0. the one list, read out of the shared script ---------- */
console.log('=== 0. one constant, one script, no pasted markup ===');
const FX = fs.readFileSync('noor-fx.js', 'utf8');
const src = FX.slice(FX.indexOf('var NOOR_SOCIAL = ['), FX.indexOf('];', FX.indexOf('var NOOR_SOCIAL = [')) + 2);
const box = {};
vm.createContext(box);
vm.runInContext(src.replace('var NOOR_SOCIAL', 'this.S'), box);
const S = box.S;
const OPEN = S.filter(s => s.href);

ok(Array.isArray(S) && S.length === 6, 'NOOR_SOCIAL is one block of six networks at the top of noor-fx.js');
ok(S.map(s => s.id).join(' ') === 'instagram facebook youtube pinterest telegram threads',
   'the order is the owner\'s order: ' + S.map(s => s.id).join(' · '));
ok(/facebook\.com\/profile\.php\?id=\d+$/.test(S.find(s => s.id === 'facebook').href),
   'Facebook is the Page\'s own door, by its id until it has a name');
ok(OPEN.length === 6, 'all six doors are open');
ok(OPEN.every(s => /^https:\/\/|^https:\/\/t\.me/.test(s.href)), 'every open door is an https link');

/* the point of a shared row is that no page carries the markup */
const allHtml = [...fs.readdirSync('.').filter(f => f.endsWith('.html')),
                 ...fs.readdirSync('.', { withFileTypes: true }).filter(d => d.isDirectory())
                    .map(d => path.join(d.name, 'index.html')).filter(p => fs.existsSync(p))];
const pasted = allHtml.filter(f => /noor-social|data-noor-social/.test(fs.readFileSync(f, 'utf8')));
ok(pasted.length === 0, 'not one of the ' + allHtml.length + ' pages carries the markup itself' +
   (pasted.length ? ' → ' + pasted.join(', ') : ''));

/* ---------- the pages the row has to reach ---------- */
const rooms = fs.readdirSync('.').filter(f => f.endsWith('.html'))
  .filter(f => /<footer[\s>]/.test(fs.readFileSync(f, 'utf8')));
const indexes = fs.readdirSync('.', { withFileTypes: true }).filter(d => d.isDirectory())
  .map(d => path.join(d.name, 'index.html')).filter(p => fs.existsSync(p));
/* the front page has no <footer> element: its footer is the About band that
   carries footer.note, and the row belongs directly under that line */
const PAGES = [...rooms, ...indexes, 'index.html'];

const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 390, height: 844 } });
const jsErrors = [];
pg.on('pageerror', e => jsErrors.push(e.message));

/* everything one page has to answer, taken from the live DOM */
const measure = () => pg.evaluate(() => {
  const rows = document.querySelectorAll('[data-noor-social]');
  const out = { n: rows.length, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  if (!rows.length) return out;
  const row = rows[0], links = [...row.querySelectorAll('a')];
  const note = document.querySelector('[data-i18n="footer.note"]');
  const langs = document.querySelector('nav[aria-label="Languages"],.langs');
  out.links = links.map(a => ({
    label: a.getAttribute('aria-label'), href: a.getAttribute('href'),
    target: a.getAttribute('target'), rel: a.getAttribute('rel'),
    w: a.getBoundingClientRect().width, h: a.getBoundingClientRect().height,
    svg: a.querySelectorAll('svg').length, paths: a.querySelectorAll('svg path,svg rect,svg circle').length,
    img: a.querySelectorAll('img').length, text: a.textContent.trim()
  }));
  out.label = (row.querySelector('.noor-social-label') || {}).textContent;
  out.inFooter = !!row.closest('footer');
  out.afterNote = !!(note && row.previousElementSibling === note);
  out.beforeLangs = !!(langs && row.nextElementSibling === langs);
  out.lastInFooter = out.inFooter && row.closest('footer').lastElementChild === row;
  out.rowLeft = row.getBoundingClientRect().left;
  out.rowRight = row.getBoundingClientRect().right;
  out.dir = getComputedStyle(row).direction;
  out.color = getComputedStyle(links[0]).color;
  out.hasFooter = !!document.querySelector('footer');
  return out;
});

/* ---------- 1. every page, at the width of a phone ---------- */
console.log('\n=== 1. sixty-one footers, at 390 ===');
const want = OPEN.map(s => s.name).join(' ');
const bad = { once: [], five: [], order: [], aria: [], rel: [], target: [], touch: [], href: [], placed: [], scroll: [], mark: [] };
for (const p of PAGES) {
  await pg.goto(BASE + '/' + p, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-noor-social]', { timeout: 8000 }).catch(() => {});
  const m = await measure();
  if (m.n !== 1) { bad.once.push(p + ' (' + m.n + ')'); continue; }
  if (m.links.length !== 6) bad.five.push(p + ' (' + m.links.length + ')');
  if (m.links.map(l => l.label).join(' ') !== want) bad.order.push(p);
  if (!m.links.every(l => l.label)) bad.aria.push(p);
  if (!m.links.every(l => l.rel === 'me noopener')) bad.rel.push(p);
  if (!m.links.every(l => l.target === '_blank')) bad.target.push(p);
  if (!m.links.every(l => l.w >= 44 && l.h >= 44)) bad.touch.push(p);
  if (m.links.map(l => l.href).join(' ') !== OPEN.map(s => s.href).join(' ')) bad.href.push(p);
  /* a drawn mark, not a fetched picture and not a letter of text */
  if (!m.links.every(l => l.svg === 1 && l.paths >= 1 && l.img === 0 && l.text === '')) bad.mark.push(p);
  /* the row belongs to the footer, in whichever of the three shapes it has */
  if (!(m.afterNote || m.beforeLangs || m.lastInFooter)) bad.placed.push(p);
  if (m.hasFooter && !m.inFooter && !m.afterNote && !m.beforeLangs) bad.placed.push(p);
  if (m.sw > m.cw) bad.scroll.push(p + ' (' + m.sw + '>' + m.cw + ')');
}
const say = (k, m) => ok(bad[k].length === 0, m + (bad[k].length ? ' → ' + bad[k].slice(0, 5).join(', ') : ''));
ok(PAGES.length === 62, PAGES.length + ' pages carry a footer: ' + rooms.length +
   ' rooms, ' + indexes.length + ' language indexes, and the front page');
say('once', 'the row is drawn exactly once on every page');
say('five', 'six links on every page');
say('order', 'and always in the owner\'s order: ' + want);
say('aria', 'every link says its network in an aria-label');
say('rel', 'every link carries rel="me noopener"');
say('target', 'every link opens in a new tab');
say('touch', 'every target is at least 44 by 44');
say('href', 'every link points where NOOR_SOCIAL says');
say('mark', 'every mark is one inline SVG the house draws: no image, no letter, no emoji');
say('placed', 'the row sits in the footer: under footer.note, above the languages line, or last inside <footer>');
say('scroll', 'nothing pushes a page sideways at 390');

/* ---------- 2. the front page, where the anchor is footer.note ---------- */
console.log('\n=== 2. the front page ===');
await pg.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
await pg.waitForSelector('[data-noor-social]', { timeout: 8000 });
const front = await measure();
ok(front.afterNote, 'the row comes directly after "Qur\'an · authentic Hadith · classical sirah"');
ok(front.beforeLangs, 'and directly before the languages nav');
ok(/Follow the light/.test(front.label || ''), 'the line above it reads "Follow the light"');
ok(/201,\s*162,\s*39/.test(front.color), 'the marks are the house gold, held back: ' + front.color);

/* the gold comes all the way up when a thumb or a keyboard reaches one */
await pg.hover('.noor-social-link');
await pg.waitForTimeout(350);
const lit = await pg.evaluate(() => {
  const a = document.querySelector('.noor-social-link');
  const rules = k => [...document.styleSheets].some(s => {
    try { return [...s.cssRules].some(r => k(r)); } catch (e) { return false; }
  });
  return {
    hovered: getComputedStyle(a).color,
    focusRule: rules(r => /noor-social-link:focus-visible/.test(r.cssText || '')),
    reduced: rules(r => /prefers-reduced-motion/.test(r.conditionText || '') && /noor-social/.test(r.cssText || ''))
  };
});
ok(/^rgb\(201,\s*162,\s*39\)$/.test(lit.hovered), 'hover brings it to full gold: ' + lit.hovered);
ok(lit.focusRule, 'a keyboard gets the same rise, and a ring, on :focus-visible');
ok(lit.reduced, 'and prefers-reduced-motion is answered for the transition');

/* ---------- 3. Arabic, under dir="rtl" ---------- */
console.log('\n=== 3. the row under dir="rtl" ===');
/* the Arabic index declares dir="rtl" in its own markup; ?lang=ar is what
   makes the shared script agree with it, so that is where the row is read */
ok(/<html[^>]+dir="rtl"/.test(fs.readFileSync('ar/index.html', 'utf8')), 'ar/index.html is written right to left');
await pg.goto(BASE + '/ar/index.html?lang=ar', { waitUntil: 'domcontentloaded' });
await pg.waitForSelector('[data-noor-social]', { timeout: 8000 });
await pg.waitForFunction(() => document.documentElement.dir === 'rtl', null, { timeout: 8000 });
const rtl = await pg.evaluate(() => {
  const row = document.querySelector('[data-noor-social]');
  const r = row.getBoundingClientRect();
  const links = [...row.querySelectorAll('a')].map(a => a.getBoundingClientRect());
  const mid = links.reduce((a, b) => a + b.left + b.width / 2, 0) / links.length;
  return {
    dir: document.documentElement.dir, n: links.length,
    left: r.left, right: r.right, vw: document.documentElement.clientWidth,
    sw: document.documentElement.scrollWidth,
    off: Math.abs(mid - document.documentElement.clientWidth / 2),
    inRow: Math.min(...links.map(l => l.left)) >= r.left - 0.5 &&
           Math.max(...links.map(l => l.right)) <= r.right + 0.5,
    rightToLeft: links[0].left > links[links.length - 1].left
  };
});
ok(rtl.dir === 'rtl', 'and it is served that way, with the row inside it');
ok(rtl.n === 6, 'the six doors are all drawn');
ok(rtl.sw <= rtl.vw, 'nothing overflows the 390 viewport (scrollWidth ' + rtl.sw + ')');
ok(rtl.off < 2, 'the row is centred, not stuck to an edge (' + rtl.off.toFixed(1) + 'px off centre)');
ok(rtl.inRow, 'and every mark stays inside the row');
ok(rtl.rightToLeft, 'the row reads right to left with the page');

/* ---------- 4. the JSON-LD the search engines read ---------- */
console.log('\n=== 4. sameAs on the front page ===');
{
  const html = fs.readFileSync('index.html', 'utf8');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  let parsed = 0, org = null;
  for (const b of blocks) {
    try {
      const j = JSON.parse(b[1]); parsed++;
      const graph = j['@graph'] || [j];
      for (const n of graph) if (n['@type'] === 'Organization') org = n;
    } catch (e) { /* counted by parsed */ }
  }
  ok(blocks.length > 0 && parsed === blocks.length, 'every JSON-LD block on index.html still parses (' + parsed + ')');
  ok(!!org, 'the Organization node is there');
  const same = (org && org.sameAs) || [];
  ok(same.length === OPEN.length, 'sameAs holds the ' + OPEN.length + ' open doors, and only those');
  const missing = OPEN.filter(s => !same.includes(s.href)).map(s => s.id);
  ok(missing.length === 0, 'each one is named in sameAs' + (missing.length ? ' → ' + missing.join(', ') : ''));
  ok(same.some(u => /facebook\.com/i.test(u)), 'the Facebook door is claimed there too');
}

/* ---------- 5. nothing broke on the way ---------- */
console.log('\n=== 5. the pages are still quiet ===');
const real = [...new Set(jsErrors)].filter(e => !/\/api\/|Failed to load resource/i.test(e));
ok(real.length === 0, 'no JS error on any of the ' + PAGES.length + ' pages' +
   (real.length ? ' → ' + real.slice(0, 3).join(' | ') : ''));

/* ---------- the picture ---------- */
fs.mkdirSync('tests/shots', { recursive: true });
/* a fresh context: the Arabic pass above left a language in localStorage, and
   the picture should be the footer a first reader meets */
const shot = await br.newPage({ viewport: { width: 390, height: 844 } });
await shot.goto(BASE + '/index.html', { waitUntil: 'load' });
await shot.waitForSelector('[data-noor-social]', { timeout: 8000 });
/* the front page is 35,000px of reveals: walk to the end, let them settle,
   then put the row in the middle of the frame */
await shot.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await shot.waitForTimeout(1200);
await shot.evaluate(() => document.querySelector('[data-noor-social]').scrollIntoView({ block: 'center' }));
await shot.waitForTimeout(900);
await shot.screenshot({ path: SHOT });
console.log('\n  ' + SHOT + ' written at 390 wide');

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
