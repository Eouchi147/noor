/* The menu showed "m.threelives" to every reader on the live site.
   The string was missing from the inline UI_EN pack in noor-fx.js, and t()
   fell back to the key itself, so the translator painted its own internal
   name over English that was already correct in all 106 pages.

   Two things are guarded here, and the second is the one that matters:
     1. every key the pages use has an English string;
     2. even when it does not, nothing that looks like a key ever renders. */
import { chromium } from '../node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path';

const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8433';
let pass = 0, fail = 0;
const ok = (c, m) => { console.log('  ' + (c ? 'PASS ' : 'FAIL ') + m); c ? pass++ : fail++; };

/* ---- 1. static: every key used has an English string ---- */
const fx = fs.readFileSync('noor-fx.js', 'utf8');
const block = fx.slice(fx.indexOf('const UI_EN = {'), fx.indexOf('const NOOR_I18N'));
const UI_EN = new Set([...block.matchAll(/"([^"]+)"\s*:/g)].map(m => m[1]));

/* The 523 words moved into dictionary/ on 9 September 2026, and the masjid,
   the stories and the children have had rooms of their own for longer. Reading
   only the root left most of the house unaudited -- and the day the words
   moved, the count fell from 106 pages to 45 while this floor went on passing
   at "> 100". So the walk is the whole site now, minus what is not a page a
   reader is ever served. */
const SKIP = new Set(['node_modules', 'tests', '.git', '.build-src', 'build', 'i18n']);
function htmlUnder(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) htmlUnder(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const pages = htmlUnder('.', []);
const used = new Map();
for (const f of pages) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g))
    if (!used.has(m[1])) used.set(m[1], f);
}
console.log('=== 1. the English pack ===');
const missing = [...used.keys()].filter(k => !UI_EN.has(k));
/* No magic floor on the count. It used to be "> 100" and it measured a world
   that no longer exists: it counted the root, the root held 521 word pages,
   and the day they moved into dictionary/ the number fell to 79 -- a number
   that says nothing is wrong. What must hold is that the layer is in use and
   that every key it uses has an English string; the count is printed because
   a sudden collapse in it is worth a human noticing, not because a threshold
   can tell one apart from a migration. */
ok(used.size > 0, used.size + ' distinct keys across ' + pages.length + ' pages');
ok(missing.length === 0, 'every key has an English string' +
   (missing.length ? ' (missing: ' + missing.slice(0, 6).join(', ') + ')' : ''));

/* ---- 2. rendered: nothing that looks like a key is ever visible ---- */
console.log('\n=== 2. no reader ever sees a key ===');
const KEYISH = /^(m|g|nav|hero|hero2|lang|p|stats|books|book|path|filter|period|mizan)\.[a-z0-9.]+$/i;
const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));

const sample = ['/', '/arabic', '/three-lives', '/quran', '/ramadan', '/kids'];
/* every language, not only English: a pack that is 47 keys short used to paint
   47 raw keys into the menu of a Japanese reader */
const langs = ['en', 'fr', 'ja', 'ar'];
let leaks = [];
for (const url of sample) {
  for (const lang of langs) {
    await p.goto(BASE + url, { waitUntil: 'domcontentloaded' });
    await p.evaluate(l => { try { localStorage.setItem('noor_lang', l); } catch (e) {} }, lang);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(260);
    const bad = await p.evaluate(re => {
      const rx = new RegExp(re);
      const out = [];
      document.querySelectorAll('[data-i18n],[data-i18n-ph]').forEach(el => {
        const t = (el.textContent || '').trim();
        if (t && rx.test(t)) out.push(t);
        const ph = el.placeholder;
        if (ph && rx.test(ph.trim())) out.push(ph.trim());
      });
      return out;
    }, KEYISH.source);
    if (bad.length) leaks.push(url + ' [' + lang + '] ' + [...new Set(bad)].slice(0, 4).join(', '));
  }
}
ok(leaks.length === 0, sample.length * langs.length + ' page/language pairs render no raw key' +
   (leaks.length ? ':\n      ' + leaks.slice(0, 5).join('\n      ') : ''));

/* ---- 3. the specific label the owner reported ---- */
console.log('\n=== 3. the label that was reported ===');
await p.goto(BASE + '/arabic', { waitUntil: 'domcontentloaded' });
await p.evaluate(() => { try { localStorage.setItem('noor_lang', 'en'); } catch (e) {} });
await p.reload({ waitUntil: 'domcontentloaded' });
await p.waitForTimeout(260);
const tl = await p.evaluate(() =>
  [...document.querySelectorAll('[data-i18n="m.threelives"]')].map(e => e.textContent.trim()));
ok(tl.length > 0, 'the Three Lives link is in the menu (' + tl.length + ' places)');
ok(tl.every(t => /Three Lives/.test(t)), 'and it reads "' + (tl[0] || '') + '"');

/* ---- 4. English survives a round trip through another language ---- */
console.log('\n=== 4. English survives a round trip ===');
const trip = await p.evaluate(async () => {
  const sel = '[data-i18n="m.threelives"]';
  const before = document.querySelector(sel).textContent.trim();
  await window.NOOR_I18N.setLang('fr');
  await new Promise(r => setTimeout(r, 300));
  await window.NOOR_I18N.setLang('en');
  await new Promise(r => setTimeout(r, 300));
  return { before, after: document.querySelector(sel).textContent.trim() };
});
ok(trip.after === trip.before, 'en -> fr -> en leaves the label unchanged ("' + trip.after + '")');
ok(errs.length === 0, 'no page errors' + (errs.length ? ' (' + errs[0] + ')' : ''));

await b.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
