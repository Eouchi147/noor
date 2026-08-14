/* NOOR · the rendered harvest.
   The static harvest reads the HTML files. That misses every string the pages
   build themselves at runtime: the timeline, the characters, the planner, the
   madrasa tracks. Since the translation layer works on rendered text nodes, the
   corpus has to be gathered the same way, from a real browser, or the two will
   never agree. One browser, every page, everything it renders. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/claude/noor';
const GATEWAYS = new Set(['ar','fr','es','de','ru','tr','ur','hi','bn','id','fa','prs','pa','ha','ps','so','ku','sw','zh','ja','ko']);
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8433';

function pages() {
  const out = [];
  const walk = (d, pre) => {
    for (const f of fs.readdirSync(d).sort()) {
      const full = path.join(d, f);
      if (fs.statSync(full).isDirectory()) {
        if (['.git','node_modules','i18n','build','scripts','tests','tracks','api','assets'].includes(f)) continue;
        // a language gateway is already written in its own language; harvesting it
        // puts Indonesian marketing copy in front of an Arabic translator
        if (GATEWAYS.has(f)) continue;
        walk(full, pre + f + '/');
      } else if (f.endsWith('.html')) {
        let u = pre + f.replace(/\.html$/, '');
        if (u === 'index') u = '';
        out.push('/' + u.replace(/index$/, ''));
      }
    }
  };
  walk(ROOT, '');
  return [...new Set(out)];
}

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
    if (p.closest('.notranslate,[translate=no]')) continue;
    if (p.hasAttribute && p.hasAttribute('data-i18n')) continue;   /* the UI pack owns the chrome */
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

const b = await chromium.launch({ executablePath: process.env.NOOR_CHROME || undefined });
const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
p.on('pageerror', () => {});
const corpus = new Set();
const list = pages();
let i = 0;
for (const u of list) {
  i++;
  try {
    await p.goto(BASE + u, { waitUntil: 'networkidle', timeout: 25000 });
    await p.waitForTimeout(500);
    /* make the page show everything it can: open what opens, render what renders */
    await p.evaluate(() => {
      document.querySelectorAll('details').forEach(d => (d.open = true));
      document.querySelectorAll('[data-tab],.tab,.filter-btn').forEach(el => { try { el.click(); } catch (e) {} });
    }).catch(() => {});
    await p.waitForTimeout(400);
    for (const s of await p.evaluate(HARVEST)) corpus.add(s);
    /* scroll: lazy sections and scroll built content */
    await p.evaluate(async () => {
      const H = document.body.scrollHeight;
      for (let y = 0; y < H; y += 900) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
    }).catch(() => {});
    await p.waitForTimeout(250);
    for (const s of await p.evaluate(HARVEST)) corpus.add(s);
  } catch (e) {
    console.log('  ! ' + u + ' ' + String(e).slice(0, 60));
  }
  if (i % 20 === 0) console.log(`  ${i}/${list.length} pages, ${corpus.size} strings`);
}
await b.close();

function fnv(s, h) { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i) & 0xFFFF; h = Math.imul(h, 0x01000193) >>> 0; } return h; }
const key = s => ('0000000' + fnv(s, 0x811C9DC5).toString(16)).slice(-8) + ('0000000' + fnv(s, 0x7B5C1A9F).toString(16)).slice(-8);

const S = {};
for (const s of corpus) S[key(s)] = s;
const words = [...corpus].reduce((a, s) => a + s.split(/\s+/).length, 0);
const outPath = path.join(ROOT, 'i18n/text/en.json');
const prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : { s: {} };
for (const [k, v] of Object.entries(prev.s || {})) if (!S[k]) S[k] = v;   // keep static-only finds
fs.writeFileSync(outPath, JSON.stringify({ _meta: { strings: Object.keys(S).length, pages: list.length, words }, s: S }, null, 0));
console.log(`harvest: ${Object.keys(S).length} strings (${corpus.size} from the DOM), ~${words} words, ${list.length} pages`);
