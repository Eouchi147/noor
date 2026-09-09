/* NOOR · the figure sweep.
   ------------------------------------------------------------------
   Illustrations fail quietly. A label lands on another label, a gradient on a
   straight line paints nothing, a caption runs out of its own box, and none of
   it throws an error, so nothing catches it except somebody looking. This file
   looks, on every page that has a figure, at three widths.

   What it checks, per SVG:
     · two <text> elements whose ink overlaps
     · anything drawn outside its own viewBox
     · a stroke painted with a gradient whose bounding box has zero area,
       which is the bug that made two figures render as nothing at all
     · text too small to read on a phone
   And per page: horizontal overflow of the document itself.

   Run:  node tests/figures.mjs        (server on 8433)
*/
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://127.0.0.1:8433';
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const WIDTHS = [360, 390, 820];

const pages = fs.readdirSync('.')
  .filter(f => f.endsWith('.html') && !/^(404|admin)/.test(f))
  .map(f => '/' + f.replace(/\.html$/, ''))
  .concat(['/stories/', '/masjid/']);

const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let problems = [], scanned = 0, figs = 0;

for (const w of WIDTHS) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  for (const path of pages) {
    let r;
    try { r = await page.goto(BASE + path, { waitUntil: 'load', timeout: 20000 }); }
    catch { continue; }
    if (!r || !r.ok()) continue;
    await page.waitForTimeout(260);
    scanned++;
    const found = await page.evaluate(() => {
      const out = [];
      const rectsOverlap = (a, b2) => {
        const pad = 1.5;   /* a pixel of touching is kerning, not a collision */
        return a.x + a.width - pad > b2.x && b2.x + b2.width - pad > a.x &&
               a.y + a.height - pad > b2.y && b2.y + b2.height - pad > a.y;
      };
      /* --- per SVG --- */
      document.querySelectorAll('svg').forEach((svg, si) => {
        const vb = svg.viewBox && svg.viewBox.baseVal;
        const texts = [...svg.querySelectorAll('text')].filter(t => (t.textContent || '').trim());
        /* Overlapping labels, measured on the SCREEN and not in local units.
           getBBox() reports a box in the element's OWN coordinate system and
           ignores every ancestor transform, so seven labels each drawn at x=0
           inside seven translated groups all look like they are stacked on top
           of one another. That is how this sweep first reported fifty seven
           collisions on pages that had none. getBoundingClientRect() composes
           the whole transform chain, which is what the reader actually sees. */
        for (let i = 0; i < texts.length; i++) {
          for (let j = i + 1; j < texts.length; j++) {
            const ra = texts[i].getBoundingClientRect(), rb = texts[j].getBoundingClientRect();
            if (!ra.width || !rb.width) continue;
            if (rectsOverlap(ra, rb))
              out.push({ kind: 'label overlap', svg: si,
                a: texts[i].textContent.trim().slice(0, 28), b: texts[j].textContent.trim().slice(0, 28) });
          }
        }
        /* a label sitting on top of a solid shape it cannot be read against is
           not detectable from geometry alone, but a label OUTSIDE the drawing
           always is */
        /* Drawn outside the figure's own frame, again measured on screen. A
           figure may set overflow:visible deliberately, so only TEXT is
           checked: a label that leaves the box is always a mistake, a curve
           that does is often the design. */
        {
          const sr = svg.getBoundingClientRect();
          if (sr.width) texts.forEach(el => {
            const r2 = el.getBoundingClientRect();
            if (!r2.width) return;
            const slack = 2;
            if (r2.left < sr.left - slack || r2.top < sr.top - slack ||
                r2.right > sr.right + slack || r2.bottom > sr.bottom + slack)
              out.push({ kind: 'label outside the figure', svg: si,
                a: (el.textContent || '').trim().slice(0, 28) });
          });
        }
        /* a gradient stroke on a shape with zero-area bbox paints nothing */
        svg.querySelectorAll('[stroke^="url("], [fill^="url("]').forEach(el => {
          let bb; try { bb = el.getBBox(); } catch { return; }
          const ref = (el.getAttribute('stroke') || el.getAttribute('fill') || '').match(/url\(#([^)]+)\)/);
          if (!ref) return;
          const g = svg.querySelector('#' + CSS.escape(ref[1]));
          if (!g || g.tagName.toLowerCase() !== 'lineargradient') return;
          const units = g.getAttribute('gradientUnits') || 'objectBoundingBox';
          if (units !== 'objectBoundingBox') return;
          if (bb.width < 0.5 || bb.height < 0.5)
            out.push({ kind: 'gradient cannot paint (zero-area box)', svg: si,
              a: ref[1] + ' on <' + el.tagName + '>' });
        });
        /* unreadably small type */
        texts.forEach(t => {
          const fs2 = parseFloat(getComputedStyle(t).fontSize) || 0;
          const scale = svg.getBoundingClientRect().width / (vb && vb.width ? vb.width : 1);
          if (fs2 * scale > 0 && fs2 * scale < 7)
            out.push({ kind: 'type too small to read', svg: si,
              a: t.textContent.trim().slice(0, 24) + ' (' + (fs2 * scale).toFixed(1) + 'px)' });
        });
      });
      return { out, svgs: document.querySelectorAll('svg').length,
               /* what a reader can actually drag. A decorative wisp that
                  reaches past the edge under overflow-x:clip widens
                  body.scrollWidth and moves nothing, so the measure is the
                  scrolling element against its own visible width. */
               overflow: document.documentElement.scrollWidth >
                         document.documentElement.clientWidth + 1 };
    });
    figs += found.svgs;
    if (found.overflow) problems.push({ page: path, w, kind: 'page scrolls sideways', a: '' });
    for (const f of found.out) problems.push({ page: path, w, ...f });
  }
  await ctx.close();
}
await b.close();

/* one line per distinct problem, not one per width */
const seen = new Set(), uniq = [];
for (const p of problems) {
  const k = p.page + '|' + p.kind + '|' + (p.a || '') + '|' + (p.b || '');
  if (seen.has(k)) continue;
  seen.add(k); uniq.push(p);
}
console.log('scanned ' + scanned + ' page loads, ' + figs + ' svg figures, at ' + WIDTHS.join('/') + 'px');
if (!uniq.length) { console.log('\nno figure problems found'); process.exit(0); }
console.log('\n' + uniq.length + ' problem(s):\n');
const byPage = {};
for (const p of uniq) (byPage[p.page] || (byPage[p.page] = [])).push(p);
for (const pg of Object.keys(byPage).sort()) {
  console.log('  ' + pg);
  for (const p of byPage[pg])
    console.log('    [' + p.w + 'px] ' + p.kind + (p.a ? ' :: ' + p.a : '') + (p.b ? '  ×  ' + p.b : ''));
}
process.exit(1);
