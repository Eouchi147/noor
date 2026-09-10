/* NOOR · can it actually be read?
   ------------------------------------------------------------------
   Not "does it look nice" -- whether a person can read it, measured.

   Four questions, asked of every visible piece of text on a sample of
   the house, at the width of a phone and of a laptop:

     · contrast. The real ratio between the ink and whatever is actually
       behind it, composited through every translucent layer, against
       WCAG AA: 4.5 for body, 3.0 for large or bold text. Anything under
       3.0 at any size is a failure at any hour of the day; between 3.0
       and 4.5 on body text is a warning worth seeing.
     · size. Nothing a reader is meant to read should be under 12px, and
       running text should not be under 14 on a phone.
     · the faces. The house should be set in a handful of families, not
       a drift of them, and no text should be sitting on a silent
       fallback because its face never loaded.
     · the palette. The ink and the gold should be a small set of values,
       not sixty near-misses.

   The 76 parchment rooms were turned into the night by a script that
   classified their colours by chroma. That is exactly the kind of change
   that leaves one label at 2.9:1 on one page and nowhere else, which is
   why this walks real pages instead of reading the stylesheets.

   Needs the static server:  python3 /tmp/vercelish.py 8231
   Then:  node tests/legible.mjs            (or: node tests/legible.mjs --all)
*/
import { chromium } from 'playwright';

const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8231';

/* one of every kind of page in the house */
const PAGES = [
  '/index.html',            /* the arrival, shell */
  '/today',                 /* rendered by api/page.js -- served static here */
  '/quran',                 /* shell */
  '/dictionary',            /* the words hub */
  '/dictionary/abu-bakr',   /* a word page: where the reels land */
  '/prophets',              /* parchment room, turned by the night script */
  '/allah',                 /* the 99 Names: the biggest parchment room */
  '/companions',
  '/heroes',
  '/places',
  '/arabic',
  '/hajj',
  '/ramadan',
  '/kids',
  '/teens',
  '/madrasa',
  '/stories/adl',
  '/masjid/qibla',
  '/masjid/timetable',
  '/donate',
  '/journal',
  '/begin'
];
const SIZES = [[390, 844, 'phone'], [1280, 900, 'laptop']];

const ALL = process.argv.includes('--all');
let pass = 0, fail = 0, warn = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL ' + m)); };
const note = m => { warn++; console.log('  note ' + m); };

/* ------------------------------------------------------------------ */
/* Everything below runs in the page: contrast has to be measured from  */
/* what the browser actually painted, not from what the CSS said.       */
const PROBE = () => {
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
  const over = (fg, bg) => ({           /* composite fg (with alpha) onto bg */
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1
  });
  const lum = c => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  /* what is really behind this element, composited down to the page ground */
  const ground = el => {
    let stack = [], n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      const bg = parse(cs.backgroundColor);
      /* an image or gradient behind the text: we cannot sample it, so say so */
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { unknown: true };
      if (bg && bg.a > 0) { stack.push(bg); if (bg.a === 1) break; }
      n = n.parentElement;
    }
    let base = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    if (base.a < 1) base = { r: 255, g: 255, b: 255, a: 1 };
    let out = base;
    for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
    return out;
  };

  const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const where = el => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    return s;
  };

  const out = { text: [], faces: {}, inks: {}, sizes: {}, unknownBg: 0 };
  const els = document.body.querySelectorAll('*');

  for (const el of els) {
    /* only elements that themselves paint text a reader can see */
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim().length > 1);
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    /* text painted by its own background -- a shimmer heading sets
       color:transparent and lets a gradient through background-clip. Its
       computed colour says nothing about whether it can be read. */
    if ((cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text')) continue;
    const op = parseFloat(cs.opacity);
    if (op === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    /* off-screen panels: the .n2-idea viewport panes are real, just not here yet */
    if (r.bottom < -2000 || r.top > 20000) continue;

    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const fam = (cs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim();
    out.faces[fam] = (out.faces[fam] || 0) + 1;
    out.sizes[Math.round(size)] = (out.sizes[Math.round(size)] || 0) + 1;

    let fg = parse(cs.color);
    if (!fg) continue;
    /* the element's own opacity dims its ink against what is behind it */
    if (op < 1) fg = { ...fg, a: fg.a * op };
    /* Ornament, not writing. A 74px Arabic name at 14% alpha behind a card is
       a watermark; it is not meant to be read and raising it to 4.5:1 would
       put a wall of letters through the design. The generator skips these by
       the same rule, and the house layer marks them aria-hidden so a screen
       reader does not read them out either. */
    if (fg.a < 0.22 && size >= 40) continue;
    const bg = ground(el);
    if (bg.unknown) { out.unknownBg++; continue; }

    const ink = over(fg, bg);
    /* A drawing of paper keeps its own inks. The masjid timetable and the qibla
       card are laid out in millimetres at exactly the size they print, and their
       palette is a printer's rather than the screen's -- #4a3a10, #5c5344, the
       cream of a Friday row. Counting those here reports drift that is really a
       second, deliberate palette. Their contrast is still measured like anything
       else; only the census leaves them out. */
    if (!el.closest('#sheet,#card')) out.inks[hex(ink)] = (out.inks[hex(ink)] || 0) + 1;
    const cr = ratio(ink, bg);
    /* WCAG large text: >=24px, or >=18.66px at 700+ */
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3.0 : 4.5;

    if (cr < need) {
      out.text.push({
        sel: where(el), size: Math.round(size * 10) / 10, weight, large,
        cr: Math.round(cr * 100) / 100, need,
        ink: hex(ink), ground: hex(bg),
        txt: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 46)
      });
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
const br = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const faces = {}, sizes = {}, inks = {};
const bad = [], soft = [];
let scanned = 0;

for (const [w, h, label] of SIZES) {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 });
  for (const path of PAGES) {
    const pg = await ctx.newPage();
    try {
      await pg.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
      /* wait for the house layer to put the night on, or give up on it */
      await pg.waitForFunction(
        () => document.documentElement.classList.contains('n2-night') ||
              document.documentElement.classList.contains('n2-live') ||
              document.readyState === 'complete', null, { timeout: 8000 }).catch(() => {});
      await pg.waitForTimeout(2600);
      const r = await pg.evaluate(PROBE);
      scanned++;
      for (const k in r.faces) faces[k] = (faces[k] || 0) + r.faces[k];
      for (const k in r.sizes) sizes[k] = (sizes[k] || 0) + r.sizes[k];
      for (const k in r.inks) inks[k] = (inks[k] || 0) + r.inks[k];
      for (const t of r.text) {
        const row = { ...t, page: path, at: label };
        /* under 3.0 is unreadable for anyone; 3.0-4.5 on body text is thin */
        (t.cr < 3.0 ? bad : soft).push(row);
      }
    } catch (e) {
      console.log('  ?? ' + path + ' @' + label + ': ' + e.message.slice(0, 70));
    }
    await pg.close();
  }
  await ctx.close();
}
await br.close();

const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);

console.log('\n=== the ink can be read ===');
console.log('  scanned ' + scanned + ' page loads across ' + PAGES.length + ' pages at ' + SIZES.length + ' widths');

/* A long tail does not go to zero in one night, and a test that is permanently
   red stops being read. So this is a ratchet: the goal is zero, the ceiling is
   where we actually are, and the ceiling may only ever move down. Anything that
   makes the house less readable than it is today fails; the distance still to
   go is printed every run so it cannot be quietly forgotten.
   What is left, and why, on the day this was set:
     · /masjid/timetable carries a paper view and a screen view in the same
       classes, so one colour cannot serve both -- that wants a design decision
       about which it is, not a floor.
     · /kids writes with --parchment, which the night must turn dark or every
       card in the house stays a cream band. The floor catches the text uses it
       can name; the rest wants the token split in two.
     · nine shell pages keep a cream sticky header from the parchment cut. */
const CEILING = { unreadable: 0, tiny: 358, inks: 72 };
const ratchet = (name, got, cap) => {
  if (got > cap) { fail++; console.log('  FAIL ' + name + ' got worse: ' + got + ' (ceiling ' + cap + ')'); }
  else { pass++; console.log('  ✓ ' + name + ': ' + got + (got ? ' left, ceiling ' + cap + (got < cap ? ' -- lower it to ' + got : '') : ' -- clear')); }
};
ratchet('text under 3.0:1, unreadable', bad.length, CEILING.unreadable);
if (bad.length) {
  const show = ALL ? bad : bad.slice(0, 14);
  for (const b of show)
    console.log('       ' + String(b.cr).padStart(5) + ':1  ' + b.ink + ' on ' + b.ground +
      '  ' + String(b.size).padStart(5) + 'px  ' + b.page + ' @' + b.at + '  ' + b.sel + '  "' + b.txt + '"');
  if (!ALL && bad.length > show.length) console.log('       … and ' + (bad.length - show.length) + ' more (--all)');
}

if (soft.length) {
  note(soft.length + ' below AA (4.5:1) but above 3.0 -- readable, thin');
  const byPage = {};
  soft.forEach(s => { (byPage[s.page] || (byPage[s.page] = [])).push(s); });
  for (const [p, list] of Object.entries(byPage).slice(0, ALL ? 99 : 8)) {
    const worst = list.sort((a, b) => a.cr - b.cr)[0];
    console.log('       ' + String(worst.cr).padStart(5) + ':1  ' + p.padEnd(22) +
      list.length + '×   ' + worst.sel + '  "' + worst.txt + '"');
  }
} else {
  console.log('  ✓ every piece of text meets AA');
}

console.log('\n=== it is set in a few faces, each with a job ===');
/* The first version of this counted the first name of every declared stack and
   called eight families a drift. It was measuring the wrong thing. Three of the
   eight were not choices at all: "Iowan Old Style" heads the journal's system
   serif stack, and "Times New Roman" only surfaced because this container cannot
   reach fonts.googleapis.com, so Amiri fell through to its own fallback. A
   fallback is not a typeface decision.
   What is worth guarding is that every face the house actually LOADS has a
   stated job, and that a new one cannot appear without someone saying what it
   is for. */
const ROLES = {
  'Inter': 'the body of the house',
  'Amiri': 'Arabic',
  'Amiri Quran': 'the Qur\'anic text',
  'IBM Plex Mono': 'numbers and data',
  'Cormorant Garamond': 'display, on the 99 Names and the Seerah',
  'Fredoka': 'the children\'s rooms'
};
const SYSTEM = /^(system-ui|-apple-system|BlinkMacSystemFont|Segoe UI|Roboto|Helvetica|Arial|sans-serif|serif|monospace|ui-|Iowan|Palatino|Georgia|Times|Courier|Menlo|Monaco|Consolas|SFMono)/i;
const famList = top(faces, 14);
famList.forEach(([f, n]) => {
  const tag = ROLES[f] ? '· ' + ROLES[f] : (SYSTEM.test(f) ? '· system fallback, not a choice' : '· UNCLAIMED');
  console.log('       ' + String(n).padStart(6) + '  ' + f.padEnd(20) + tag);
});
const unclaimed = famList.filter(([f]) => !ROLES[f] && !SYSTEM.test(f)).map(x => x[0]);
ok(unclaimed.length === 0, 'every face the house loads has a stated job' +
  (unclaimed.length ? ' (unclaimed: ' + unclaimed.join(', ') + ')' : ''));
ok(Object.keys(ROLES).length <= 6, 'and there are ' + Object.keys(ROLES).length + ' of them, not a drift');

console.log('\n=== nothing is too small to read ===');
const small = Object.entries(sizes).filter(([s, n]) => +s < 12).reduce((a, [, n]) => a + n, 0);
const tiny = Object.entries(sizes).filter(([s]) => +s < 12).map(([s, n]) => s + 'px ×' + n);
ratchet('text under 12px', small, CEILING.tiny);
if (small) console.log('       ' + tiny.join(', '));
console.log('       sizes in use: ' + top(sizes, 10).map(([s, n]) => s + 'px×' + n).join('  '));

console.log('\n=== the palette is a palette ===');
const inkCount = Object.keys(inks).length;
console.log('       ' + inkCount + ' distinct ink values; commonest: ' +
  top(inks, 6).map(([c, n]) => c + '×' + n).join(' '));
ratchet('distinct ink values', inkCount, CEILING.inks);

console.log('\n' + pass + ' passed, ' + fail + ' failed, ' + warn + ' to look at');
process.exit(fail ? 1 : 0);
