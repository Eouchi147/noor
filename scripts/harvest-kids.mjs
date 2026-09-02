/* NOOR · harvest the children's wing into the translation corpus.
   The hub and the fifteen rooms build most of their text in JavaScript, so a
   static read of the HTML misses it, and a child reading in Turkish met English.
   This opens each room in a real browser, plays it enough to render what a
   child would see, folds in the sidecar lists each room's build left behind,
   and ADDS what it finds to i18n/text/en.json. It never removes a key: the
   translations hang off them.
     node scripts/harvest-kids.mjs          (server on :8433)
     node scripts/harvest-kids.mjs --dry    (report only)  */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8433';
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SIDECARS = process.env.NOOR_KIDS_STRINGS || '/root/mushaf/kids/strings';
const DRY = process.argv.includes('--dry');

const ROOMS = fs.readdirSync(path.join(ROOT, 'kids')).filter(f => f.endsWith('.html')).sort();
const PAGES = ['/kids.html', ...ROOMS.map(f => '/kids/' + f)];

const HARVEST = () => {
  const SKIP = { SCRIPT:1, STYLE:1, NOSCRIPT:1, TEXTAREA:1, CODE:1, PRE:1 };
  const out = new Set();
  const norm = s => s.replace(/\s+/g, ' ').trim();
  const AR = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
  const CJK = /[　-ヿ一-鿿가-힯]/;
  const keep = s => s.length >= 2 && /[A-Za-z]/.test(s) && !AR.test(s) && !CJK.test(s) && !/^[\W\d\s]+$/.test(s);
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let n;
  while ((n = w.nextNode())) {
    const p = n.parentNode;
    if (!p || p.nodeType !== 1 || SKIP[p.tagName]) continue;
    if (p.closest('.notranslate,[translate=no],.trl,.translit,.pctrl,.nk-sound')) continue;
    if (p.hasAttribute && p.hasAttribute('data-i18n')) continue;
    const s = norm(n.nodeValue || '');
    if (keep(s)) out.add(s);
  }
  ['placeholder','aria-label','title','alt'].forEach(a => {
    document.querySelectorAll('[' + a + ']').forEach(el => {
      if (el.closest('.nk-sound')) return;
      const s = norm(el.getAttribute(a) || '');
      if (keep(s)) out.add(s);
    });
  });
  return [...out];
};

const b = await chromium.launch({ executablePath: EXE });
const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', () => {});
await p.route(/cdn\.islamic\.network|everyayah\.com|fonts\.gstatic|fonts\.googleapis/, r => r.abort());
await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });

const found = new Set();
for (const u of PAGES) {
  let before = found.size;
  try {
    await p.goto(BASE + u, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await p.waitForTimeout(700);
    for (const s of await p.evaluate(HARVEST)) found.add(s);
    /* play it: open what opens, press what presses, so the JS-built text renders */
    for (let round = 0; round < 14; round++) {
      await p.evaluate(() => {
        document.querySelectorAll('details').forEach(d => (d.open = true));
      }).catch(() => {});
      /* never touch the language picker: one stray click and the harvest
         reads French back into the English corpus */
      const btns = await p.$$('button:visible, [role=button]:visible, .tab:visible');
      const safe = [];
      for (const bt of btns) {
        const skip = await bt.evaluate(el => !!(el.closest('[data-setlang],[data-doorlang],.klang,.klang-pop,.lang-grid,.lang-pane,.nk-sound') || el.hasAttribute('data-setlang') || el.hasAttribute('data-doorlang')));
        if (!skip) safe.push(bt);
      }
      if (!safe.length) break;
      const bt = safe[round % safe.length];
      try { await bt.click({ timeout: 900, force: true }); } catch (e) {}
      await p.waitForTimeout(230);
      const lang = await p.evaluate(() => document.documentElement.lang || 'en');
      if (lang !== 'en') { console.log('  ! ' + u + ' slipped into ' + lang + ', reloading'); break; }
      for (const s of await p.evaluate(HARVEST)) found.add(s);
    }
    await p.evaluate(async () => {
      const H = document.body.scrollHeight;
      for (let y = 0; y < H; y += 800) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
    }).catch(() => {});
    await p.waitForTimeout(250);
    for (const s of await p.evaluate(HARVEST)) found.add(s);
  } catch (e) { console.log('  ! ' + u + ' ' + String(e).slice(0, 70)); }
  console.log(`  ${u.padEnd(28)} +${found.size - before}`);
}
await b.close();

/* the sidecars: strings a room only shows deep in a game, which no amount of
   clicking reaches in one pass. Each room's build wrote its own list. */
let side = 0;
if (fs.existsSync(SIDECARS)) {
  for (const f of fs.readdirSync(SIDECARS).filter(f => f.endsWith('.json'))) {
    try {
      const arr = JSON.parse(fs.readFileSync(path.join(SIDECARS, f), 'utf8'));
      for (const s of (Array.isArray(arr) ? arr : Object.values(arr))) {
        const t = String(s).replace(/\s+/g, ' ').trim();
        if (t.length >= 2 && /[A-Za-z]/.test(t) && !found.has(t)) { found.add(t); side++; }
      }
    } catch (e) { console.log('  ! sidecar ' + f); }
  }
}
console.log(`\n${found.size} strings from the wing (${side} only in the sidecars)`);

function fnv(s, h) { const b = Buffer.from(s, 'utf16le');
  for (let i = 0; i < b.length; i += 2) { h ^= (b[i] | (b[i+1] << 8)) & 0xFFFF; h = Math.imul(h, 0x01000193) >>> 0; } return h; }
const key = s => ('0000000' + fnv(s, 0x811C9DC5).toString(16)).slice(-8) + ('0000000' + fnv(s, 0x7B5C1A9F).toString(16)).slice(-8);

const outPath = path.join(ROOT, 'i18n/text/en.json');
const cur = JSON.parse(fs.readFileSync(outPath, 'utf8'));
const S = cur.s;
const added = [];
for (const s of found) { const k = key(s); if (!(k in S)) { S[k] = s; added.push(s); } }
const words = added.reduce((a, s) => a + s.split(/\s+/).length, 0);
console.log(`${added.length} new to the corpus, ${words} words; corpus ${Object.keys(S).length} strings`);
if (DRY) { console.log('(dry run, nothing written)'); process.exit(0); }
cur._meta.strings = Object.keys(S).length;
cur._meta.words = Object.values(S).reduce((a, s) => a + s.split(/\s+/).length, 0);
fs.writeFileSync(outPath, JSON.stringify(cur));
fs.writeFileSync(path.join(ROOT, 'i18n/kids-added.json'), JSON.stringify(added, null, 1));
console.log('wrote i18n/text/en.json and i18n/kids-added.json');
