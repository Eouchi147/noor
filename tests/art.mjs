/* NOOR · the drawing on a card.
   ------------------------------------------------------------------
   Every post carries its own picture now. The pictures are geometry, drawn by
   this house, chosen from a list of twelve — and the reason they are chosen
   rather than generated is that a model which could emit arbitrary SVG onto a
   card published in the owner's name could emit anything at all: a figure, a
   face, the symbol of another faith, a shape nobody vetted.

   So this checks the whole surface, which is small enough to check:

     · every motif draws, for many seeds, without a stray value
     · no motif contains a horizontal stroke crossing a vertical one — the same
       geometric test tests/symbols.mjs runs over the site, applied here to art
       that only exists at run time and therefore never reaches that file
     · a motif the Lantern asks for is only used if it is on the list
     · two different cards do not get the same drawing
     · the emblem is never placed where the title will be

   Run:  node tests/art.mjs
*/
import { MOTIFS, MOTIF_NAMES, MOTIF_FOR, ornament, motifFor, seedOf } from '../api/_art.js';
import { cardSVG } from '../api/card.js';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL ' + m)); };

console.log('\n=== 1. every motif draws ===');
ok(MOTIF_NAMES.length >= 10, 'there are enough drawings to go round (' + MOTIF_NAMES.length + ')');
for (const name of MOTIF_NAMES) {
  ok(typeof MOTIF_FOR[name] === 'string' && MOTIF_FOR[name].length > 8,
     name + ': is described, so the Lantern chooses with its eyes open');
  let bad = 0;
  for (let s = 0; s < 40; s++) {
    const g = ornament(name, { seed: name + ':' + s, cx: 300, cy: 300, size: 420 });
    if (!/^<g /.test(g) || /NaN|Infinity|undefined/.test(g)) bad++;
  }
  ok(bad === 0, name + ': draws cleanly for 40 seeds');
}

console.log('\n=== 2. nothing draws a cross ===');
/* the same rule the site-wide guard uses: a horizontal stroke crossing a
   vertical one at a point interior to both */
const segs = d => {
  const out = []; let x = 0, y = 0, sx = 0, sy = 0;
  const re = /([MLQAZmlqaz])([^MLQAZmlqaz]*)/g; let m;
  while ((m = re.exec(d))) {
    const cmd = m[1], n = (m[2].match(/-?\d*\.?\d+/g) || []).map(Number);
    if (cmd === 'M') { x = n[0]; y = n[1]; sx = x; sy = y; }
    else if (cmd === 'L') { for (let i = 0; i + 1 < n.length; i += 2) { out.push([x, y, n[i], n[i+1]]); x = n[i]; y = n[i+1]; } }
    else if (cmd === 'Z' || cmd === 'z') { out.push([x, y, sx, sy]); x = sx; y = sy; }
    else if (cmd === 'Q') { x = n[n.length-2]; y = n[n.length-1]; }
    else if (cmd === 'A') { x = n[n.length-2]; y = n[n.length-1]; }
  }
  return out;
};
const EPS = 1.5;
let crosses = 0, checked = 0;
for (const name of MOTIF_NAMES) {
  for (let s = 0; s < 12; s++) {
    const g = ornament(name, { seed: name + ':' + s, cx: 300, cy: 300, size: 420 });
    const all = [];
    for (const d of (g.match(/ d="([^"]+)"/g) || [])) all.push(...segs(d.slice(4, -1)));
    checked += all.length;
    for (const a of all) for (const b of all) {
      if (a === b) continue;
      const aH = Math.abs(a[1] - a[3]) < EPS && Math.abs(a[0] - a[2]) > 6;
      const bV = Math.abs(b[0] - b[2]) < EPS && Math.abs(b[1] - b[3]) > 6;
      if (!aH || !bV) continue;
      const xIn = b[0] > Math.min(a[0], a[2]) + EPS && b[0] < Math.max(a[0], a[2]) - EPS;
      const yIn = a[1] > Math.min(b[1], b[3]) + EPS && a[1] < Math.max(b[1], b[3]) - EPS;
      if (xIn && yIn) { crosses++; console.log('     cross in ' + name + ' seed ' + s); }
    }
  }
}
ok(crosses === 0, 'no motif draws a cross (' + checked + ' straight segments read)');

console.log('\n=== 3. the Lantern may only choose from the list ===');
for (const bad of ['a cross', 'portrait of the prophet', 'crucifix', '<script>', 'star-of-david', '']) {
  const g = ornament(bad, { seed: 'x' });
  const used = MOTIF_NAMES.some(n => {
    const ref = ornament(n, { seed: 'x' });
    return ref === g;
  });
  ok(used, 'an unknown name "' + bad.slice(0, 18) + '" falls back to a vetted drawing');
}

console.log('\n=== 4. two cards are not drawn alike ===');
{
  const seen = new Map();
  const titles = ['The Qur\'an guards itself', 'A lamp in the niche', 'Ayn Jalut, 1260',
    'The Hejaz railway', 'Ibn al-Haytham and the dark room', 'Timbuktu manuscripts rescued',
    'Wudu', 'Ad-Dukhan: The Smoke', 'Monday and Thursday', 'Al-Ghazali leaves Baghdad'];
  for (const t of titles) seen.set(t, motifFor(t, t));
  const distinct = new Set(seen.values()).size;
  ok(distinct >= 5, 'ten different cards draw ' + distinct + ' different motifs');
  ok(motifFor('A lamp in the niche', 'a') === motifFor('A lamp in the niche', 'a'),
     'and the same card is always drawn the same way');
}

console.log('\n=== 5. the emblem never lands on the title ===');
{
  /* the worst case: the longest title and the longest body the card allows */
  const long = 'A very long headline about something that needs three whole lines to say';
  const body = ('This is a long story. ').repeat(30);
  const svg = cardSVG({ id: 'x', title: long, story: body, detail: 'd', category: 'CAT' });
  const ys = [...svg.matchAll(/<text[^>]*y="([\d.]+)"[^>]*font-size="54"/g)].map(m => +m[1]);
  const firstTitleTop = ys.length ? Math.min(...ys) - 42 : 1e9;
  const em = svg.match(/<g opacity="0\.5"[\s\S]*?<\/g>/);
  if (em) {
    const cys = [...em[0].matchAll(/c?y="([\d.]+)"/g)].map(m => +m[1]);
    const lowest = cys.length ? Math.max(...cys) : 0;
    ok(lowest < firstTitleTop, 'the emblem sits above the title (' + lowest + ' < ' + firstTitleTop + ')');
  } else {
    ok(true, 'no room for an emblem on the tightest card, so none is drawn');
  }
  ok(/aria-hidden="true"/.test(svg), 'the drawing is hidden from a screen reader');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
