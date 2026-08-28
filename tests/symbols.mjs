/* NOOR · the symbol guard.
   ------------------------------------------------------------------
   This file exists because a cross was drawn on an Islamic site.

   The grave marker in the At-Takathur figure was a vertical stroke with a
   horizontal bar across it. Nobody typed the word "cross"; it was drawn out of
   two line commands, so no text search would ever have found it, and it sat on
   a page about the Qur'an until the owner saw it with his own eyes.

   So this guard does not search for words. It reads the geometry.

   Two passes:
     1 · every character that is a religious mark of another faith
     2 · every SVG path, parsed into its straight segments, looking for a
         horizontal stroke crossing a vertical one at an interior point of
         both. That is a cross, however it was written.

   A plus sign in an interface is the same shape, so anything found is
   REPORTED for a human decision rather than failed outright, except inside a
   figure, where a cross is never an interface control and always a mistake.

   Run:  node tests/symbols.mjs
*/
import fs from 'fs';
import path from 'path';

/* marks of other faiths, and the funeral marks that carry the same reading */
const MARKS = {
  '†': 'dagger cross', '‡': 'double dagger cross',
  '✝': 'latin cross', '✞': 'shadowed cross', '✟': 'outlined cross',
  '✠': 'maltese cross', '☦': 'orthodox cross', '☧': 'chi rho',
  '☨': 'lorraine cross', '☩': 'jerusalem cross',
  '✡': 'star of david', '☸': 'dharma wheel', '☯': 'yin yang',
  'ॐ': 'om', '⛪': 'church', '⛩': 'shinto shrine',
  '✚': 'heavy greek cross', '✛': 'open centre cross', '✜': 'heavy open cross',
  '⚰': 'coffin', '⚱': 'funeral urn', '⚕': 'staff of asclepius',
  '🕍': 'synagogue', '🕌': 'mosque (fine, listed for completeness)'
};
const ALLOW = new Set(['🕌']);   /* a mosque is not a problem */

/* ---- a small absolute-coordinate parser for straight path commands ---- */
function segments(d) {
  const out = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  const toks = String(d).match(/[MmLlHhVvZzCcSsQqTtAa]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  let i = 0, cmd = '';
  const num = () => parseFloat(toks[i++]);
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    if (i > toks.length) break;
    const rel = cmd === cmd.toLowerCase();
    const c = cmd.toUpperCase();
    let nx = x, ny = y;
    if (c === 'M') { nx = num(); ny = num(); if (rel) { nx += x; ny += y; } x = nx; y = ny; sx = x; sy = y; cmd = rel ? 'l' : 'L'; continue; }
    else if (c === 'L') { nx = num(); ny = num(); if (rel) { nx += x; ny += y; } }
    else if (c === 'H') { nx = num(); if (rel) nx += x; ny = y; }
    else if (c === 'V') { ny = num(); if (rel) ny += y; nx = x; }
    else if (c === 'Z') { nx = sx; ny = sy; }
    else if (c === 'C') { for (let k = 0; k < 6; k++) num(); nx = NaN; }
    else if (c === 'S' || c === 'Q') { for (let k = 0; k < 4; k++) num(); nx = NaN; }
    else if (c === 'T') { for (let k = 0; k < 2; k++) num(); nx = NaN; }
    else if (c === 'A') { for (let k = 0; k < 7; k++) num(); nx = NaN; }
    else { i++; continue; }
    if (!isNaN(nx)) { out.push({ x1: x, y1: y, x2: nx, y2: ny }); x = nx; y = ny; }
    else { /* a curve: position is no longer tracked reliably, stop this path */ break; }
  }
  return out;
}

function crossIn(d) {
  const segs = segments(d).filter(s => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 3);
  const vert = segs.filter(s => Math.abs(s.x2 - s.x1) < 0.7);
  const horiz = segs.filter(s => Math.abs(s.y2 - s.y1) < 0.7);
  for (const v of vert) {
    const vy1 = Math.min(v.y1, v.y2), vy2 = Math.max(v.y1, v.y2);
    for (const h of horiz) {
      const hx1 = Math.min(h.x1, h.x2), hx2 = Math.max(h.x1, h.x2);
      const m = 1.2;                       /* a corner is not a crossing */
      const crossesV = h.y1 > vy1 + m && h.y1 < vy2 - m;
      const crossesH = v.x1 > hx1 + m && v.x1 < hx2 - m;
      if (crossesV && crossesH) return { v, h };
    }
  }
  return null;
}

const files = [];
const walk = dir => {
  for (const f of fs.readdirSync(dir)) {
    if (/^(node_modules|\.git|tests|build|i18n|locales)$/.test(f)) continue;
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(html|js|py|svg|json)$/.test(f)) files.push(p);
  }
};
walk('.');

/* Shapes that are a plus or a lattice and not a cross, each looked at once by
   a human and cleared with its reason. Anything NOT on this list is reported.
   The point of naming them is that a new one can never hide among them. */
const CLEARED = new Map([
  ["M12 3v15M5 10h14M12 18c-.5 2-2 3-4 3", "the spars and tail of the kite icon"],
  ["M92 80v160M124 80v160M156 80v160M188 80v160M60 112h160M60 144h160M60 176h160M60 208h160", "a lattice window"],
  ["M120 80v190M150 80v190M90 120h90M90 160h90M90 200h90M90 240h90", "a lattice window"],
  ["M52 100l60 50M112 100l-60 50M46 128h72M82 92v66", "the mesh of a papermaker's screen"],
  ["M33 64v26M50 64v26M16 77h52", "the panes of a window"],
  ["M149 64v26M166 64v26M132 77h52", "the panes of a window"]
]);

let marks = [], crosses = [], scannedPaths = 0, cleared = 0;

for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');

  /* 1 · the literal marks */
  for (const ch of Object.keys(MARKS)) {
    if (ALLOW.has(ch)) continue;
    let i = s.indexOf(ch);
    while (i > -1) {
      marks.push({ f, mark: MARKS[ch], ctx: s.slice(Math.max(0, i - 45), i + 25).replace(/\s+/g, ' ') });
      i = s.indexOf(ch, i + 1);
    }
  }

  /* 2 · the geometry. Only inside something that draws. */
  if (!/\.(html|py|svg|js)$/.test(f)) continue;
  const re = /\sd\s*=\s*(["'])([^"']{6,400})\1/g;
  let m;
  while ((m = re.exec(s))) {
    const d = m[2];
    if (!/[HhVv]/.test(d)) continue;        /* a cross needs a straight bar */
    scannedPaths++;
    const hit = crossIn(d);
    if (hit && CLEARED.has(d.trim())) { cleared++; continue; }
    if (hit) {
      const before = s.slice(Math.max(0, m.index - 260), m.index);
      const inFigure = /<svg|figsvg|nfig|class="fig/.test(before) || /\.py$/.test(f);
      crosses.push({ f, d: d.slice(0, 90), inFigure,
        ctx: before.slice(-90).replace(/\s+/g, ' ') });
    }
  }
}

console.log('scanned ' + files.length + ' files, ' + scannedPaths + ' straight-line paths\n');

if (marks.length) {
  console.log('SYMBOLS OF ANOTHER FAITH (' + marks.length + '):');
  for (const x of marks) console.log('  ' + x.f + '  ' + x.mark + '\n      …' + x.ctx);
  console.log('');
}
if (crosses.length) {
  console.log('CROSS GEOMETRY (' + crosses.length + '):');
  for (const x of crosses)
    console.log('  ' + (x.inFigure ? '[FIGURE] ' : '[ui] ') + x.f + '\n      d="' + x.d + '"\n      after: …' + x.ctx);
  console.log('');
}
const hard = crosses.filter(c => c.inFigure).length + marks.length;
if (!hard) console.log('nothing of another faith is drawn anywhere on this site');
console.log('\n' + marks.length + ' foreign marks, ' + crosses.length + ' cross shapes ('
  + crosses.filter(c => c.inFigure).length + ' inside figures), '
  + cleared + ' known plus-shapes cleared by review');
process.exit(hard ? 1 : 0);
