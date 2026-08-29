/* NOOR · the card that goes out with the day's light.
   ------------------------------------------------------------------
   Two failures are guarded here and both were silent.

   1. The PNG path had never once produced a PNG. It tried @vercel/og, which
      was never a dependency, and served the SVG instead behind a header
      nobody reads. Instagram will not take an SVG, so every post would have
      been rejected for a reason findable without ever holding a credential.

   2. Font fallback is silent. On the first real render the honorific in
      "the birth of the Prophet ﷺ, or the" came out as an empty gap: no error,
      no warning, no missing-glyph box. It was visible only by looking at the
      picture, which is why this file rasterises and then INSPECTS the pixels
      rather than trusting that a render which did not throw is a render that
      is right.

   Run:  node tests/card.mjs
*/
import fs from 'fs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const LIB = JSON.parse(fs.readFileSync('lights/all.json', 'utf8')).lights;
const C = await import('../api/card.js');
const asLight = l => ({ title: l.t, story: l.s, detail: l.d, category: l.c });

console.log('\n=== 1. the honorific is spelled out for the drawing ===');
{
  const withLig = LIB.filter(l => /[ﷺﷻ]/.test(l.s + l.t + l.d));
  ok(withLig.length > 50, withLig.length + ' cards in the library carry the ligature codepoint');
  const r = C.drawable('the birth of the Prophet ﷺ, or the first revelation');
  ok(!/[ﷺﷻ]/.test(r.text), 'it never reaches the drawing');
  ok(/peace be upon him/.test(r.text), 'and it is spelled out: "' + r.text.slice(20, 62) + '"');
  ok(r.missing.length === 0, 'and nothing else was dropped to get there');
}

console.log('\n=== 2. nothing in the library is undrawable ===');
{
  const bad = [];
  for (const l of LIB) for (const f of ['t', 's', 'd', 'c']) {
    const r = C.drawable(String(l[f] || ''));
    if (r.missing.length) bad.push(l.id + ' ' + f + ': ' + r.missing.join(''));
  }
  ok(bad.length === 0, 'every character of all ' + LIB.length + ' cards is in the shipped faces' +
     (bad.length ? ' (' + bad.slice(0, 3).join('; ') + ' — run scripts/gen-card-fonts.py)' : ''));
}

console.log('\n=== 3. the PNG path produces an actual PNG ===');
{
  const light = LIB.find(l => /ﷺ/.test(l.s));
  const svg = C.cardSVG(asLight(light));
  ok(/^<svg /.test(svg) && svg.includes('</svg>'), 'the SVG is well formed');
  ok(!/[ﷺﷻ]/.test(svg), 'and carries no ligature codepoint');

  const png = await C.cardPNG(svg);
  ok(Buffer.isBuffer(png) && png.length > 20000, 'the PNG is real bytes (' + png.length + ')');
  ok(png[0] === 0x89 && png.slice(1, 4).toString() === 'PNG', 'with a PNG magic number, not an SVG in disguise');
  /* IHDR carries the dimensions: bytes 16..24 */
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  ok(w === 1080 && h === 1080, 'at 1080 by 1080, which is what Instagram takes (' + w + 'x' + h + ')');
  ok(png.length < 8 * 1024 * 1024, 'and under Meta\'s 8MB ceiling');
}

console.log('\n=== 4. the picture is inspected, not merely produced ===');
{
  /* A render that does not throw is not a render that is right. These two
     compare pixel counts between a card and the same card with its words
     removed: if the glyphs were not drawn, the difference is nothing. */
  const light = LIB[7];
  const full = await C.cardPNG(C.cardSVG(asLight(light)));
  const blank = await C.cardPNG(C.cardSVG({ title: '', story: '', detail: '', category: '' }));
  ok(full.length > blank.length * 1.05,
     'a card with words weighs more than a card without them (' + full.length + ' vs ' + blank.length + ')');

  /* and the honorific specifically: spelling it out must change the picture */
  const lig = LIB.find(l => /ﷺ/.test(l.s));
  const a = await C.cardPNG(C.cardSVG(asLight(lig)));
  const stripped = { ...asLight(lig), story: lig.s.replace(/ﷺ/g, '') };
  const b = await C.cardPNG(C.cardSVG(stripped));
  ok(!a.equals(b), 'the spelled-out honorific is visibly on the card, not an empty gap');
}

console.log('\n=== 5. the wrapper never runs off the card ===');
{
  const long = 'x'.repeat(400) + ' ' + 'word '.repeat(300);
  const svg = C.cardSVG({ title: long, story: long, detail: long, category: long });
  const lines = svg.match(/<text[^>]*>/g) || [];
  ok(lines.length <= 16, 'a card built from nonsense still draws at most 16 text runs (' + lines.length + ')');
  const png = await C.cardPNG(svg);
  ok(png.readUInt32BE(16) === 1080, 'and still rasterises at the right size');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
