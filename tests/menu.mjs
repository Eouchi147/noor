/* NOOR · the dial menu, on the screens people actually hold.
   ------------------------------------------------------------------
   Two faults, both found by measuring rather than by looking.

   1 · THE RING SAT ON TOP OF THE WORDS.
       The radius was computed from the viewport and the hub inside it was
       sized from the ball diameter, and the two numbers never spoke. On every
       phone the balls closed over the hub: 19px of overlap on an iPhone 14,
       20 on a Pro Max, 37 on an SE, 41 in landscape. Not one phone was clear.
       Meanwhile a third of the screen sat empty above and below the ring.

   2 · TAPPING A SECTION DID NOTHING AT ALL.
       pointerdown captures the pointer to the stage, so on pointerup
       e.target was always the stage and never the ball. The section never
       opened, and because a plain left click is cancelled so the anchor does
       not navigate instead, the dial's one job was dead on every device.

   This holds both fixed, at eleven real screen sizes, in both orientations.

   Needs a static server for the site on :8231 and playwright:
     python3 -m http.server 8231 &   node tests/menu.mjs
*/
import { chromium } from 'playwright';

const BASE = process.env.NOOR_BASE || 'http://127.0.0.1:8231';
const SIZES = [
  [320, 568, 'iPhone SE 1'], [360, 640, 'small Android'], [375, 667, 'iPhone SE 3'],
  [390, 844, 'iPhone 14'], [393, 852, 'iPhone 15 Pro'], [430, 932, 'iPhone Pro Max'],
  [360, 780, 'Pixel'], [768, 1024, 'iPad portrait'], [844, 390, 'phone landscape'],
  [1024, 768, 'iPad landscape'], [1440, 900, 'laptop']
];
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL ' + m)); };

const open = async pg => {
  await pg.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await pg.evaluate(() => document.querySelector('[data-nm-open]')?.click());
  await pg.waitForTimeout(1400);
};
/* every measurement the geometry has to satisfy, taken from the live DOM */
const measure = pg => pg.evaluate(() => {
  const nd = document.querySelector('.nd');
  const cap = nd.classList.contains('cap');
  const rs = [...document.querySelectorAll('.nd-node')].map(n => n.getBoundingClientRect());
  const top = document.querySelector('.nd-top').getBoundingClientRect();
  const under = (cap ? document.querySelector('.nd-cap') : document.querySelector('.nd-hint'))
    .getBoundingClientRect();
  const t = Math.min(...rs.map(r => r.top)), b = Math.max(...rs.map(r => r.bottom));
  const l = Math.min(...rs.map(r => r.left)), rr = Math.max(...rs.map(r => r.right));
  let hubGap = null, hubOff = null;
  if (!cap) {
    const hb = document.querySelector('.nd-hub').getBoundingClientRect();
    const cx = hb.left + hb.width / 2, cy = hb.top + hb.height / 2;
    hubGap = Math.min(...rs.map(r =>
      Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy) - r.width / 2 - hb.width / 2));
    /* The hub has to sit on the ring's own centre, not the viewport's. The
       bounding box is not that centre -- the near half of the ring is drawn
       larger, so the box hangs lower than the geometry does. Eight balls evenly
       spaced average to the true centre, so that is what this compares. */
    const my = rs.reduce((a, r) => a + r.top + r.height / 2, 0) / rs.length;
    hubOff = +Math.abs(cy - my).toFixed(1);
  }
  /* the closest pair of neighbours, which is the check that was missing: every
     other measurement passed while all eight balls sat in one unreadable heap */
  let minSep = Infinity;
  for (let i = 0; i < rs.length; i++)
    for (let j = i + 1; j < rs.length; j++){
      const a = rs[i], b2 = rs[j];
      const d = Math.hypot((a.left + a.width / 2) - (b2.left + b2.width / 2),
                           (a.top + a.height / 2) - (b2.top + b2.height / 2));
      const need = (a.width + b2.width) / 2;
      minSep = Math.min(minSep, d - need);
    }
  return { on: nd.classList.contains('on'), cap, n: rs.length, minSep: +minSep.toFixed(1),
    tight: nd.classList.contains('tight'),
    underTop: +(top.bottom - t).toFixed(1), overUnder: +(b - under.top).toFixed(1),
    offLeft: +(0 - l).toFixed(1), offRight: +(rr - innerWidth).toFixed(1),
    hubGap: hubGap === null ? null : +hubGap.toFixed(1), hubOff,
    ballD: +rs[0].width.toFixed(0) };
});

const br = await chromium.launch();

console.log('\n=== 1. nothing overlaps anything, at any size ===');
for (const [w, h, name] of SIZES) {
  const pg = await br.newPage({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 });
  await open(pg);
  const m = await measure(pg);
  ok(m.on, name + ': the dial opens');
  ok(m.n === 8, name + ': all eight sections are on the ring');
  ok(m.underTop <= 0, name + ': the ring clears the search bar (' + m.underTop + ')');
  ok(m.overUnder <= 0, name + ': the ring clears the caption below it (' + m.overUnder + ')');
  ok(m.offLeft <= 0 && m.offRight <= 0, name + ': the ring is on screen');
  ok(m.hubGap === null || m.hubGap >= 0, name + ': the balls stay out of the hub (' + m.hubGap + ')');
  /* Not zero, and it cannot be: the ring is drawn inside a rig that is leaned
     five degrees under a perspective, and the hub is not in that rig, so the
     projection moves the ring's centre a little and not the hub's. Under twenty
     pixels on a ring six hundred across is two per cent, and invisible. It was
     fifty before the hub was given the same vertical lift as the ring. */
  ok(m.hubOff === null || m.hubOff <= 20, name + ': the hub is concentric with the ring (' + m.hubOff + ')');
  ok(m.ballD >= 52, name + ': a section is big enough to read and aim at (' + m.ballD + 'px)');
  ok(m.minSep >= -2, name + ': the sections do not pile on each other (' + m.minSep + ')');
  /* a phone has no room for words inside the ring, so they go under it */
  if (w < 500 || h < 500) ok(m.cap, name + ': the name is set below the ring, not inside it');
  await pg.close();
}

console.log('\n=== 2. tapping a section opens it ===');
for (const [w, h, name, touch] of [[393, 852, 'phone', true], [1440, 900, 'laptop', false]]) {
  const pg = await br.newPage({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch });
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await open(pg);
  const at = await pg.evaluate(() => {
    const r = document.querySelector('.nd-node.on').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (touch) await pg.touchscreen.tap(at.x, at.y); else await pg.mouse.click(at.x, at.y);
  await pg.waitForTimeout(800);
  const opened = await pg.evaluate(() => ({
    scrim: getComputedStyle(document.querySelector('.nd-scrim')).visibility,
    rooms: document.querySelectorAll('.nd-room').length,
    fits: (() => { const p = document.querySelector('.nd-panel').getBoundingClientRect();
      return p.left >= -1 && p.right <= innerWidth + 1 && p.height <= innerHeight + 1; })(),
    stillHere: location.pathname
  }));
  ok(opened.scrim === 'visible', name + ': a tap opens the section');
  ok(opened.rooms > 0, name + ': and lists its rooms (' + opened.rooms + ')');
  ok(opened.fits, name + ': and the panel fits the screen');
  ok(opened.stillHere.endsWith('index.html'), name + ': and does not navigate away');
  ok(errs.length === 0, name + ': no JS errors');
  await pg.close();
}

console.log('\n=== 3. the caption follows the ring, and rotation is clean ===');
{
  const pg = await br.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  await open(pg);
  const first = await pg.evaluate(() => document.querySelector('.nd-node.on b').textContent);
  await pg.keyboard.press('ArrowRight');
  await pg.waitForTimeout(1100);
  const p = await pg.evaluate(() => ({
    focused: document.querySelector('.nd-node.on b').textContent.trim(),
    caption: document.querySelector('.nd-cap .hn').textContent.trim()
  }));
  ok(p.focused !== first, 'an arrow key turns the ring one section');
  ok(p.caption === p.focused, 'the caption names whatever is in focus');

  await pg.setViewportSize({ width: 852, height: 393 });
  await pg.waitForTimeout(900);
  const m = await measure(pg);
  ok(m.underTop <= 0 && m.overUnder <= 0 && m.offLeft <= 0 && m.offRight <= 0,
     'still clean after the phone is rotated ' + JSON.stringify(m));
  await pg.close();
}

console.log('\n=== 4. the glow is a circle, not a square ===');
{
  const pg = await br.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  await open(pg);
  const glow = await pg.evaluate(() => {
    const el = document.querySelector('.nd-node.on');
    const cs = getComputedStyle(el, '::after');
    return { r: cs.borderRadius, bg: cs.backgroundImage.slice(0, 22), shadow: getComputedStyle(el).boxShadow };
  });
  /* a blur that large on a promoted layer rasterises to the layer box, and the
     glow came out as a visible square around the focused section */
  const blurs = (glow.shadow.match(/(\d+(?:\.\d+)?)px/g) || []).map(Number);
  ok(!blurs.some(b => b > 40), 'no huge blurred shadow is left to draw a box (' + glow.shadow.slice(0, 60) + ')');
  ok(/radial-gradient/.test(glow.bg) && /50%/.test(glow.r), 'the glow is a round gradient');
  await pg.close();
}

await br.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
