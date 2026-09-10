/* NOOR · generate assets/noor2-legible.css from what the browser actually paints
   ------------------------------------------------------------------------------
   The house is 600 pages written over months, and its small print drifted: the
   same secondary label is 8.8px on one page and 11.9 on another, and the ink was
   dimmed with whatever alpha looked right on parchment at the time. Then the 76
   parchment rooms were turned into the night, and an alpha that read comfortably
   as dark-on-light stopped reading as light-on-dark.

   Rather than guess at that from the stylesheets, this walks the real pages, at
   the width of a phone, and asks of every visible piece of text: what is the
   contrast against what is genuinely behind it, and how big is it. Then it writes
   the smallest sheet that fixes what failed.

   Two floors, and nothing else:

     · ink        every piece of text reaches 4.5:1 against its own ground
                  (3.0 for large or bold), by raising alpha or lifting a colour
                  that is too dark for the ground it ended up on -- the hue is
                  kept, so gold stays gold.
     · size       nothing a reader is meant to read is under 12px.

   What it deliberately leaves alone: decorative text. A 74px Arabic name at 14%
   alpha behind a card is a watermark, not a sentence, and "fixing" it to 4.5:1
   would put a wall of letters through the design. Anything under DECOR_ALPHA at
   over DECOR_SIZE is treated as ornament and skipped -- and marked aria-hidden by
   the house layer instead, so a screen reader does not read it out either.

     node scripts/build-legible.mjs           write the sheet
     node scripts/build-legible.mjs --dry     say what it would write
*/
import { chromium } from 'playwright';
import fs from 'fs';

const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8231';
const OUT = 'assets/noor2-legible.css';
const DRY = process.argv.includes('--dry');

const MIN_PX = 12;        /* nothing meant to be read is smaller than this */
const AA = 4.5, AA_BIG = 3.0;
const TARGET = 4.8;       /* aim past the line, so a browser's rounding cannot fail it */
const DECOR_ALPHA = 0.22; /* below this, and large, it is ornament */
const DECOR_SIZE = 40;

/* one of every kind of page, and every room the night script touched that
   carries its own small print */
const PAGES = [
  '/index.html', '/ask', '/today', '/quran', '/dictionary', '/dictionary/abu-bakr',
  '/prophets', '/allah', '/companions', '/heroes', '/places', '/arabic',
  '/hajj', '/hajj-plan', '/ramadan', '/kids', '/teens', '/madrasa', '/family',
  '/soul', '/unseen', '/theology', '/pillars', '/words', '/begin', '/donate',
  '/journal', '/marriage', '/health', '/good-life', '/school', '/eid',
  '/characters', '/three-lives', '/protection', '/simulation', '/sermon',
  '/stories/adl', '/stories/index.html', '/masjid/qibla', '/masjid/timetable',
  '/masjid/khutba', '/masjid/index.html'
];

/* ------------------------------------------------------------------ page side */
const PROBE = ({ MIN_PX, AA, AA_BIG, DECOR_ALPHA, DECOR_SIZE }) => {
  /* Chrome hands back three different syntaxes and they are not the same units.
     rgb()/rgba() are 0-255. color(srgb r g b / a) -- which is what color-mix()
     resolves to, and the house uses color-mix in a dozen rooms -- is 0-1. The
     first version of this read "color(srgb 1 0.996 0.968 / .62)" as r=1 g=0.99
     b=0.96 and called parchment-at-62% near-black, then reported the footer of
     six pages as unreadable. Measuring instruments need auditing too. */
  const parse = c => {
    c = (c || '').trim();
    if (!c || c === 'transparent' || c === 'none') return null;
    const m = c.match(/[\d.]+(?:e-?\d+)?/g);
    if (!m) return null;
    const unit = /^color\(/i.test(c) ? 255 : 1;      /* color() is 0-1, rgb() is 0-255 */
    const n = /^color\(/i.test(c) ? m.slice(0) : m;   /* color(srgb ...) has no leading number */
    if (n.length < 3) return null;
    return { r: +n[0] * unit, g: +n[1] * unit, b: +n[2] * unit,
             a: n.length > 3 ? +n[3] : 1 };
  };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const ground = el => {
    let st = [], n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { unknown: 1 };
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) { st.push(bg); if (bg.a === 1) break; }
      n = n.parentElement;
    }
    let base = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    if (base.a < 1) base = { r: 255, g: 255, b: 255, a: 1 };
    let o = base; for (let i = st.length - 1; i >= 0; i--) o = over(st[i], o); return o;
  };
  /* a selector that will still mean this element tomorrow: its own classes,
     minus the layout utilities that say nothing about what it is */
  const NOISE = /^(flex|grid|block|inline|hidden|absolute|relative|fixed|static|sticky|w-|h-|min-|max-|m[trblxy]?-|p[trblxy]?-|gap-|space-|items-|justify-|self-|order-|col-|row-|z-|overflow|cursor|select-|transition|duration|ease-|transform|scale-|rotate-|translate|shadow|ring|outline|list-|whitespace|break-|truncate|antialiased|group|peer|sr-only)/;
  /* A utility class says how something looks, not what it is. .underline is on
     every underlined thing in the house and .hover:text-gold is a hover state;
     writing a colour onto either repaints hundreds of unrelated elements and
     kills the hover into the bargain. The first draft of this script did
     exactly that. Utilities may still carry a SIZE floor -- .text-[9px] is
     precisely the right place to say "not 9px" -- but never a colour. */
  const UTILITY = /^(text-|font-|hover:|focus:|active:|underline$|uppercase$|lowercase$|capitalize$|italic$|not-italic$|tracking-|leading-|opacity-|bg-|border-|decoration-|placeholder-|caret-|accent-|notranslate$|sr-only$|visually-hidden$|screen-reader-text$)/;
  const sel = (el, forColour) => {
    const cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/) : [];
    let keep = cls.filter(c => c && !NOISE.test(c));
    if (forColour) keep = keep.filter(c => !UTILITY.test(c));
    if (!keep.length) return null;                       /* nothing stable to aim at */
    const esc = c => '.' + c.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
    let out = keep.slice(0, 2).map(esc).join('');
    /* .s and .u and .d are the house's own shorthand, and they are short enough
       to mean something else three rooms away. Naming the tag as well narrows
       the blast radius and costs nothing. */
    if (keep[0].length <= 2) out = el.tagName.toLowerCase() + out;
    return out;
  };

  /* Every rule in the house that sets a colour or a size, in cascade order.
     Built once: the point is to find, for a given element, the rule that is
     actually winning -- so the floor can be written against that same selector
     rather than a guess at one. A guess loses: the footer says
     .noor-social .noor-social-label, which is two classes, and a floor written
     as .noor-social-label is one, and one never beats two however late it
     loads. Naming the winner settles it by order instead, and leaves :hover
     alone, because a hover rule is strictly more specific than the rule it
     hovers over and still wins. */
  const RULES = { color: [], size: [] };
  for (const sh of document.styleSheets) {
    if (/noor2-legible/.test(sh.href || '')) continue;               /* never read our own answer */
    let rs; try { rs = sh.cssRules; } catch (e) { continue; }        /* cross-origin */
    const walk = list => { for (const r of list || []) {
      if (r.cssRules && !r.selectorText) { walk(r.cssRules); continue; }   /* @media, @supports */
      if (!r.selectorText || !r.style) continue;
      if (r.style.color) RULES.color.push(r.selectorText);
      if (r.style.fontSize) RULES.size.push(r.selectorText);
    } };
    walk(rs);
  }
  /* the winner is the last matching rule, which is what the cascade lands on
     for equal specificity, and a good enough proxy otherwise: if a more
     specific rule earlier wins instead, we are still writing a selector that
     matches this element, and ours loads last. */
  const winner = (el, kind) => {
    let best = null;
    for (const sel of RULES[kind]) {
      /* :hover and friends describe a state, not this element at rest */
      if (/:(hover|focus|active|visited|target|checked)\b/.test(sel)) continue;
      /* A bare element selector is not a place to write a colour. `a` wins the
         cascade on one dim link in one room, and the floor then answers it as
         `html a` -- which is every link in the house. That is how a salmon
         link colour, lifted out of a 1.93:1 failure on one card, arrived on
         all 602 pages. If the winner is `a` or `p` or `h3`, the element's own
         classes are the honest target, even though they are narrower. */
      if (!/[.#[]/.test(sel)) continue;
      for (const one of sel.split(',')) {
        const t = one.trim(); if (!t) continue;
        if (!/[.#[]/.test(t)) continue;
        try { if (el.matches(t)) best = t; } catch (e) {}
      }
    }
    return best;
  };

  const out = [];
  for (const el of document.body.querySelectorAll('*')) {
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim().length > 1);
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    /* text painted by its own background -- a shimmer heading sets
       color:transparent and lets a gradient through background-clip. Its
       computed colour says nothing about whether it can be read. */
    if ((cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text')) continue;
    const op = parseFloat(cs.opacity); if (op === 0) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;

    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    let fg = parse(cs.color); if (!fg) continue;
    const alpha = fg.a * (op < 1 ? op : 1);
    /* ornament: a huge, barely-there letterform behind the content */
    if (alpha < DECOR_ALPHA && size >= DECOR_SIZE) continue;
    fg = { ...fg, a: alpha };

    const bg = ground(el); if (bg.unknown) continue;
    const cr = ratio(over(fg, bg), bg);
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? AA_BIG : AA;
    const failsInk = cr < need, failsSize = size < MIN_PX;
    if (!failsInk && !failsSize) continue;

    /* the rule that is actually winning, if the house names one; otherwise the
       element's own classes, which is all there is to aim at */
    const sInk = failsInk ? (winner(el, 'color') || sel(el, true)) : null;
    const sSize = failsSize ? (winner(el, 'size') || sel(el, false)) : null;
    if (!sInk && !sSize) continue;                       /* cannot be named: skip */
    out.push({
      sel: sInk || sSize, selInk: sInk, selSize: sSize, tag: el.tagName.toLowerCase(),
      size: Math.round(size * 100) / 100, weight, large,
      cr: Math.round(cr * 100) / 100, need,
      fg: [Math.round(fg.r), Math.round(fg.g), Math.round(fg.b)], alpha: Math.round(alpha * 1000) / 1000,
      bg: [Math.round(bg.r), Math.round(bg.g), Math.round(bg.b)],
      failsInk, failsSize
    });
  }
  return out;
};

/* ---------------------------------------------------------------- node side */
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const mix = (fg, bg, a) => fg.map((v, i) => Math.round(v * a + bg[i] * (1 - a)));

/* raise alpha until it reaches the target; null if even solid cannot */
function byAlpha(fg, bg, need) {
  for (let a = 0.30; a <= 1.0001; a += 0.02) {
    if (ratio(mix(fg, bg, a), bg) >= need) return Math.round(a * 100) / 100;
  }
  return null;
}
/* keep the hue, move the lightness until it reads. This is what saves the gold:
   #8a6d13 is a decision, not an accident, and it should stay gold rather than
   become white -- it is simply too dark for a ground it was never drawn for. */
function rgb2hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}
function hsl2rgb([h, s, l]) {
  if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255));
}
function byLightness(fg, bg, need) {
  const [h, s] = rgb2hsl(fg);
  const up = lum(bg) < 0.18;                    /* dark ground: go lighter */
  for (let step = 1; step <= 60; step++) {
    const l = up ? Math.min(0.97, rgb2hsl(fg)[2] + step * 0.012)
                 : Math.max(0.05, rgb2hsl(fg)[2] - step * 0.012);
    const c = hsl2rgb([h, s, l]);
    if (ratio(c, bg) >= need) return c;
  }
  return null;
}
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

/* ------------------------------------------------------------------- gather */
const br = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const found = new Map();
let seenPages = 0, unnamed = 0;

for (const path of PAGES) {
  const pg = await ctx.newPage();
  try {
    await pg.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await pg.waitForTimeout(2300);
    /* Measure the house, not the house wearing last week's floor.
       The floor is injected by noor-fx.js like every other sheet, so a rebuild
       walks pages that are already carrying the previous answer. Two things go
       wrong. Everything the old sheet fixed now measures as passing, so it is
       dropped from the new sheet -- and fails again the moment the new sheet
       ships. And the winner search finds the old sheet's own rules and copies
       them forward, which is how `html .notranslate{color:#a07e16}` survived
       being added to the utility filter: it was no longer being derived, it was
       being read back out of the file it had been written to. A generator that
       reads its own output is not measuring anything.
       So: turn it off, let the style recalc land, then look. */
    await pg.evaluate(() => {
      for (const sh of document.styleSheets) if (/noor2-legible/.test(sh.href || '')) sh.disabled = true;
    });
    await pg.waitForTimeout(250);
    const rows = await pg.evaluate(PROBE, { MIN_PX, AA, AA_BIG, DECOR_ALPHA, DECOR_SIZE });
    seenPages++;
    for (const r of rows) {
      /* One rule per selector -- but a selector is only safe to recolour if it
         stands on one kind of ground. .mer is gold on a dark card on one page
         and gold on a parchment panel on another; a single colour cannot be
         right for both, and the first run of this script cheerfully wrote one
         that was wrong for one of them. So the ground is remembered, and a
         selector seen on both is reported rather than guessed at. */
      const key = (r.selInk || '') + '|' + (r.selSize || '');
      const cur = found.get(key);
      const dark = lum(r.bg) < 0.18;
      if (!cur) { found.set(key, { ...r, n: 1, dark, mixed: false, pages: new Set([path]) }); continue; }
      cur.n++; cur.pages.add(path);
      if (dark !== cur.dark) cur.mixed = true;
      if (r.cr < cur.cr) { cur.cr = r.cr; cur.fg = r.fg; cur.bg = r.bg; cur.alpha = r.alpha; cur.need = r.need; }
      cur.failsInk = cur.failsInk || r.failsInk;
      if (r.size < cur.size) cur.size = r.size;
      cur.failsSize = cur.failsSize || r.failsSize;
    }
  } catch (e) { console.log('  ?? ' + path + ': ' + e.message.slice(0, 60)); }
  await pg.close();
}
await br.close();

/* -------------------------------------------------------------------- write */
const ink = [], small = [], stuck = [], mixed = [], vanished = []; let unnamedInk = 0;
for (let r of [...found.values()].sort((a, b) => b.n - a.n)) {
  if (r.failsInk && r.mixed) { mixed.push(r); }
  else if (r.failsInk && r.cr < 1.25) {
    /* Not dim: absent. The ink and the ground are the same colour, which happens
       when a token that names a colour rather than a role gets turned. --parchment
       is cream, and the night must turn it dark or every card in the house stays
       a cream band; but 59 places in the house also write with it, and those went
       dark on dark. .w-title on the children's page -- the title of the page --
       was #0a1024 on #0d1428, which is nothing at all.
       Lifting the hue is the wrong repair here: a dark navy lifted stays navy,
       and the intent was parchment. So text that has vanished into its ground
       comes back as the house ink, light on a dark ground and dark on a light
       one, which is what it was asking for. */
    const back = lum(r.bg) < 0.18 ? [255, 254, 247] : [44, 36, 22];
    if (r.selInk) ink.push({ ...r, decl: hex(back), restored: true }); else vanished.push(r);
  }
  else if (r.failsInk) {
    const need = Math.max(r.need + 0.3, TARGET);
    let decl = null;
    if (r.alpha < 0.98) {
      const a = byAlpha(r.fg, r.bg, need);
      if (a !== null) decl = a >= 0.98 ? 'rgb(' + r.fg.join(',') + ')'
        : 'rgba(' + r.fg.join(',') + ',' + a + ')';
    }
    if (!decl) { const c = byLightness(r.fg, r.bg, need); if (c) decl = hex(c); }
    /* If neither raising the alpha nor lifting the lightness can reach the
       ground, the colour is simply the wrong one for where it ended up --
       white on cream, in the timetable's case. The house ink for that ground
       is the answer, same as for text that vanished entirely. */
    if (!decl) { const back = lum(r.bg) < 0.18 ? [255, 254, 247] : [44, 36, 22];
                 if (ratio(back, r.bg) >= r.need) { decl = hex(back); r = { ...r, restored: true }; } }
    if (decl && r.selInk) ink.push({ ...r, decl }); else if (decl) unnamedInk++; else stuck.push(r);
  }
  if (r.failsSize && r.selSize) small.push(r);
}

/* A floor has to win a tie. Naming the rule that is winning gets the specificity
   equal, and equal is settled by document order -- but a room's own <style> can
   sit later in the document than a <link> the house layer injected, and then the
   floor loses by exactly nothing. One "html " in front adds a single element to
   the specificity: enough to beat the identical selector, and never enough to
   beat the same selector with :hover or an #id on it, which is precisely the
   escalation a floor is allowed. */
const raise = sel => sel.split(',').map(x => {
  const t = x.trim();
  return /^html\b/.test(t) ? t : 'html ' + t;
}).join(',');

const stamp = new Date().toISOString().slice(0, 10);
let css = `/* NOOR · the legibility floor
   ---------------------------------------------------------------------------
   Generated by scripts/build-legible.mjs on ${stamp} from ${seenPages} real pages
   measured at 390px. Do not edit by hand: run the script again.

   Two floors, and nothing else. Every piece of text reaches 4.5:1 against the
   ground genuinely behind it (3.0 where it is large or bold), and nothing a
   reader is meant to read is under ${MIN_PX}px. Colours keep their hue: a gold that
   was too dark for the night is lifted, not replaced.

   Ornament is left alone on purpose. A 74px Arabic name at 14% alpha behind a
   card is a watermark; raising it to 4.5:1 would put a wall of letters through
   the middle of the design. The house layer marks those aria-hidden instead.

   This sheet is loaded last, after the room's own CSS and after the night, so
   it settles ties. It is the only place in the house that may do that.
   ---------------------------------------------------------------------------
   ${ink.length} colours lifted · ${small.length} sizes floored${stuck.length ? ' · ' + stuck.length + ' could not be reached' : ''} */

`;

if (ink.length) {
  css += '/* ---- the ink reaches its ground ---- */\n';
  for (const r of ink)
    css += `${raise(r.selInk)}{color:${r.decl}}          /* was ${r.cr}:1 on ${hex(r.bg)}${r.restored ? ' -- had vanished into it' : ''} */\n`;
}
if (small.length) {
  css += '\n/* ---- nothing under ' + MIN_PX + 'px ---- */\n';
  /* one rule for the lot: the same floor, said once per selector */
  const bySize = {};
  for (const r of small) (bySize[Math.max(MIN_PX, Math.ceil(r.size))] || (bySize[Math.max(MIN_PX, Math.ceil(r.size))] = [])).push(r);
  for (const [px, list] of Object.entries(bySize)) {
    const sels = [...new Set(list.map(r => raise(r.selSize)))];
    css += sels.join(',\n') + `{font-size:${px}px}   /* was ${Math.min(...list.map(r => r.size))}px */\n`;
  }
}
function block(title, list, extra) {
  if (!list.length) return '';
  let t = '\n/* ' + title + '\n';
  for (const r of list.slice(0, 16))
    t += `     ${r.sel.padEnd(28)} ${String(r.cr).padStart(5)}:1  ${hex(r.fg)} on ${hex(r.bg)}   ${[...r.pages].slice(0, 3).join(' ')}\n`;
  if (list.length > 16) t += `     … and ${list.length - 16} more\n`;
  return t + (extra ? '   ' + extra + '\n' : '') + '*/\n';
}
css += block('Left alone: the same name stands on a light ground on one page and a\n   dark one on another, so no single colour is right for both. These want a\n   look, not a floor:', mixed);
css += block('Left alone: not dim, absent. Ink and ground are the same colour, which\n   is a bug in the room rather than a contrast problem:', vanished);
css += block('Could not be reached by colour alone -- the ground itself is the problem,\n   and that is a design decision:', stuck);

console.log(`\n  ${seenPages} pages read · ${found.size} selectors need help`);
console.log(`  ${ink.length} colours lifted, ${small.length} sizes floored` + (unnamedInk ? `, ${unnamedInk} carried only utility classes and were left` : ''));
const say = (t, l) => { if (!l.length) return; console.log('  ' + l.length + ' ' + t);
  l.slice(0, 8).forEach(r => console.log(`     ${r.sel.padEnd(26)} ${String(r.cr).padStart(5)}:1  ${hex(r.fg)} on ${hex(r.bg)}   ${[...r.pages].slice(0,3).join(' ')}`)); };
say('on two different grounds -- left alone', mixed);
say('ink the same colour as its ground -- a bug, not a floor', vanished);
say('unreachable by colour alone', stuck);
console.log(`  ${css.length} bytes`);

if (DRY) { console.log('\n--dry: not written\n'); console.log(css.slice(0, 2200)); }
else { fs.writeFileSync(OUT, css); console.log('  wrote ' + OUT); }
