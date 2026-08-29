/* NOOR · does the card's text come from OUR faces, or from the machine's?
   ------------------------------------------------------------------
   This test exists because a green test lied.

   The card shipped with an embedded face called "DejaVu Sans". It rendered
   perfectly on the machine it was written on, and went out to production
   completely blank: border, gradient, gold rule, not one letter. The reason is
   that the build machine had DejaVu Sans installed system wide, so the system
   copy was quietly doing the drawing while the embedded bytes were being
   ignored. Vercel has no system fonts. Nothing drew.

   The old test compared a card with words against a card with none and passed,
   because the words really were there -- drawn by the wrong font.

   So this one withholds the faces on purpose and insists the card collapses.
   A card that still has words when its faces are taken away is a card being
   drawn by something that will not exist in production.

   Run:  node tests/card-fonts.mjs
*/
import { Resvg } from '@resvg/resvg-js';
import { cardSVG, cardPNG } from '../api/card.js';
import { REGULAR, BOLD, FAMILY } from '../api/_cardfont.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const LIGHT = {
  title: 'A woman built the instruments that read the sky',
  story: 'In tenth century Aleppo, Mariam al-Ijliya made astrolabes, the finest navigation and timekeeping instruments of the age, and served the city court as a celebrated maker.',
  detail: 'Aleppo, 10th century', category: 'Astronomy'
};
const svg = cardSVG(LIGHT);
const render = opts => new Resvg(svg, { fitTo: { mode: 'width', value: 1080 }, font: opts }).render().asPng().length;

console.log('\n=== 1. the faces are really in the repository ===');
{
  ok(Buffer.isBuffer(REGULAR) && REGULAR.length > 8000, 'the regular face is real bytes (' + REGULAR.length + ')');
  ok(Buffer.isBuffer(BOLD) && BOLD.length > 8000, 'the bold face is real bytes (' + BOLD.length + ')');
  ok(REGULAR.slice(0, 4).toString('hex') === '00010000' || REGULAR.slice(0, 4).toString() === 'OTTO',
     'and they are actual font files, not something that merely decoded');
}

console.log('\n=== 2. the family name cannot be satisfied by accident ===');
{
  const REAL = ['dejavu', 'arial', 'helvetica', 'times', 'georgia', 'verdana', 'roboto',
                'inter', 'noto', 'liberation', 'sans-serif', 'serif', 'monospace', 'system-ui'];
  ok(!REAL.some(r => FAMILY.toLowerCase().includes(r)),
     'the card asks for "' + FAMILY + '", which is nobody else\'s font name');
  ok(svg.includes('font-family="' + FAMILY + '"'), 'and every text run in the drawing asks for it');
}

console.log('\n=== 3. take the faces away and the card must collapse ===');
{
  const withOurs = render({ loadSystemFonts: false, fontFiles: [], fontBuffers: [REGULAR, BOLD], defaultFontFamily: FAMILY });
  const real = (await cardPNG(svg)).length;
  const bare = render({ loadSystemFonts: false, fontFiles: [], defaultFontFamily: FAMILY });
  ok(real > bare * 1.15,
     'the card drawn with our faces is heavier than one drawn with none (' + real + ' vs ' + bare + ')');
  ok(bare < real * 0.9,
     'and with nothing supplied the card really is empty, so this test can tell the difference');
  void withOurs;

  /* Note on what is NOT asserted here, because an earlier version asserted it
     and was wrong. Rendering with system fonts alone gives a byte-identical
     result on this machine, since the embedded faces are a subset of a font
     the machine also has. Size cannot separate the two. What CAN be checked is
     the condition production actually runs under: no system fonts at all. That
     is the check above, and it is the check that matters, so long as the
     shipped path really does switch them off. */
}

console.log('\n=== 4. the shipped path cannot borrow a face ===');
{
  const fs = await import('fs');
  const src = fs.readFileSync(new URL('../api/card.js', import.meta.url), 'utf8');
  ok(/loadSystemFonts:\s*false/.test(src),
     'cardPNG switches system fonts off, so it cannot quietly borrow one');
  ok(/fontFiles/.test(src),
     'and hands resvg real FILES, which is the only thing the native build reads');
}

console.log('\n=== 5. the shipped path draws words ===');
{
  const png = await cardPNG(svg);
  ok(png[0] === 0x89 && png.slice(1, 4).toString() === 'PNG', 'cardPNG returns a PNG');
  ok(png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === 1080, 'at 1080 by 1080');
  const bare = render({ loadSystemFonts: false, fontFiles: [], defaultFontFamily: FAMILY });
  ok(png.length > bare * 1.15, 'and it is not the blank card (' + png.length + ' vs ' + bare + ' blank)');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
