/* NOOR · the arrival's own corpus.
   The full harvest walks 600 pages and takes minutes. The arrival is three
   rooms — the front page, /ask and /mizan — and it is the first thing every
   reader sees, so it gets its own pass that can be run in seconds while a
   translation is being worked on.

   It gathers exactly what assets/noor-text.js would translate, by the same
   rules and in the same shapes, including a heading marked data-noor-1,
   which is read as one sentence with a bar where the styling breaks it. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8231';
const ROOMS = ['/', '/ask', '/mizan'];

const HARVEST = () => {
  const SKIP = { SCRIPT:1, STYLE:1, NOSCRIPT:1, TEXTAREA:1, CODE:1, PRE:1 };
  const out = new Set();
  const norm = s => s.replace(/\s+/g, ' ').trim();
  const AR = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
  const CJK = /[　-ヿ一-鿿가-힯]/;
  const keep = s => s.length >= 2 && /[A-Za-z]/.test(s) && !AR.test(s) && !CJK.test(s) && !/^[\W\d\s]+$/.test(s);

  /* the joined headings first, and their children are then not offered alone */
  const done = new Set();
  document.querySelectorAll('[data-noor-1]').forEach(el => {
    const parts = [], ns = [];
    for (let c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) { parts.push(c.nodeValue); ns.push(c); }
      else if (c.nodeType === 1 && c.firstChild && c.firstChild.nodeType === 3 && !c.firstChild.nextSibling) {
        parts.push(c.firstChild.nodeValue); ns.push(c.firstChild);
      } else return;
    }
    if (ns.length < 2) return;
    ns.forEach(n => done.add(n));
    const s = norm(parts.join('|'));
    if (keep(s)) out.add(s);
  });

  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let n;
  while ((n = w.nextNode())) {
    if (done.has(n)) continue;
    const p = n.parentNode;
    if (!p || p.nodeType !== 1 || SKIP[p.tagName]) continue;
    if (p.closest('.notranslate,[translate=no]')) continue;
    if (p.closest('.trl,.translit,.pctrl')) continue;
    if (p.hasAttribute && p.hasAttribute('data-i18n')) continue;
    const s = norm(n.nodeValue || '');
    if (keep(s)) out.add(s);
  }
  ['placeholder','aria-label','title','alt'].forEach(a => {
    document.querySelectorAll('[' + a + ']').forEach(el => {
      if (el.hasAttribute('data-i18n-ph') && a === 'placeholder') return;
      const s = norm(el.getAttribute(a) || '');
      if (keep(s)) out.add(s);
    });
  });
  return [...out];
};

const b = await chromium.launch({ executablePath: process.env.NOOR_CHROME || undefined, args: ['--no-proxy-server'] });
const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
p.on('pageerror', () => {});
const corpus = new Set();
for (const u of ROOMS) {
  await p.goto(BASE + u, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(900);
  /* unfold the library and open every question, so nothing hides from the harvest */
  await p.evaluate(() => {
    document.querySelectorAll('.hm-grp button[aria-expanded="false"]').forEach(b => { try { b.click(); } catch (e) {} });
    document.querySelectorAll('details').forEach(d => (d.open = true));
  }).catch(() => {});
  await p.waitForTimeout(700);
  /* the whole page has to have been scrolled for the reveals to have run */
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } });
  await p.waitForTimeout(700);
  const got = await p.evaluate(HARVEST);
  got.forEach(s => corpus.add(s));
  console.log(u.padEnd(8), got.length);
}
await b.close();
const list = [...corpus].sort();
fs.writeFileSync('/tmp/landing-corpus.json', JSON.stringify(list, null, 1));
console.log('\n' + list.length + ' strings -> /tmp/landing-corpus.json');
