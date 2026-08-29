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

const pages = fs.readdirSync('.').filter(f => f.endsWith('.html'));
const used = new Map();
for (const f of pages) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g))
    if (!used.has(m[1])) used.set(m[1], f);
}
console.log('=== 1. the English pack ===');
const missing = [...used.keys()].filter(k => !UI_EN.has(k));
ok(used.size > 100, used.size + ' distinct keys across ' + pages.length + ' pages');
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
