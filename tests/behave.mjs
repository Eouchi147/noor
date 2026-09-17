/* NOOR film engine · behave.js's glow and count, proved without a browser
   ------------------------------------------------------------------
   behave.js runs inside a headless Chromium page in the real pipeline
   (plates.sh), driven by anime.js's own timeline. This proves two of its
   pure behaviours against a hand built stub of the handful of DOM and
   timeline calls each one actually makes, so both fixes are checked here
   rather than only on the owner's Mac.

   THE COUNT BUG: a comma formatted number ("7,275") was matched against a
   comma stripped copy of itself, then sliced out of the ORIGINAL string at
   the match's position in the STRIPPED one; the two never lined up, and the
   count rendered "7,277,27575".

   THE GLOW BUG: `for` never reached the glow. A dead `hold` variable was
   computed and ignored, and the breathing loop was timed off `c.span`, the
   whole film's length, not `c.dur`, the duration this glow was actually
   given, so a short glow kept pulsing to the credits.

   Run:  node tests/behave.mjs
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

/* ---- a stub SVG element: only what behave.js actually calls ---- */
function makeEl(tag) {
  return {
    tag,
    attrs: {},
    style: {},
    children: [],
    textContent: '',
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] || null; },
    appendChild(c) { this.children.push(c); return c; },
    insertBefore(c) { this.children.unshift(c); return c; },
    querySelector() { return null; },          // "#noormoteblur" never exists yet
    querySelectorAll(sel) { return (this._targets && this._targets[sel]) || []; },
    closest() { return null; },
    getBBox() { return this._bbox || { x: 0, y: 0, width: 0, height: 0 }; },
  };
}

/* ---- a stub timeline: records every .add() call, animates nothing ---- */
function makeTimeline() {
  const calls = [];
  return { calls, add(target, props, position) { calls.push({ target, props, position }); } };
}

/* ---- load behave.js into a throwaway window/document, once ---- */
const src = fs.readFileSync(path.join(__dirname, '..', 'tools', 'films', 'web', 'behave.js'), 'utf8');
const documentStub = { createElementNS(ns, tag) { return makeEl(tag); } };
const windowStub = { anime: null };
const load = new Function('window', 'document', 'console', src + '\nreturn window.NOORMOTION;');
const NOORMOTION = load(windowStub, documentStub, console);

ok(!!NOORMOTION && typeof NOORMOTION.apply === 'function', 'behave.js loads and exports NOORMOTION.apply');

const VB = [0, 0, 600, 800];

console.log('\nglow honours `for`');
{
  const root = makeEl('g');
  const target = makeEl('circle');
  target._bbox = { x: 10, y: 10, width: 40, height: 30 };
  root._targets = { '.thing': [target] };

  const tl = makeTimeline();
  const forSecs = 2.4, dur = forSecs * 1000, third = dur / 3, t0 = 1000;
  NOORMOTION.apply(root, [{ do: 'glow', on: '.thing', at: 0, for: forSecs }], tl, t0, [], VB, 40000 /* a long film */);
  const glowCalls = tl.calls.filter(c => c.target && c.target.tag === 'circle' && c.target !== target)
    .sort((a, b) => a.position - b.position);
  ok(glowCalls.length === 3, 'exactly three tweens: fade in, hold, fade out (' + glowCalls.length + ')');
  ok(glowCalls.every(c => Math.abs(c.props.duration - third) < 1e-9), 'each tween is exactly a third of `for`: ' + glowCalls.map(c => c.props.duration));
  ok(glowCalls[0].position === t0, 'the first tween starts at `at`: ' + glowCalls[0].position);
  const lastEnd = glowCalls[2].position + glowCalls[2].props.duration;
  ok(lastEnd === t0 + dur, 'the last tween ends exactly at at + for: ' + lastEnd);
  ok(lastEnd < t0 + 40000, 'and nowhere near the end of a forty second film');
  ok(glowCalls[0].props.opacity[0] === 0 && glowCalls[0].props.opacity[1] > 0, 'fades in from zero');
  ok(glowCalls[2].props.opacity[1] === 0, 'fades out to zero, and stops there');
}

console.log('\na short glow on a long film still stops early');
{
  const root = makeEl('g');
  const target = makeEl('circle');
  target._bbox = { x: 10, y: 10, width: 40, height: 30 };
  root._targets = { '.thing': [target] };

  const tl = makeTimeline();
  NOORMOTION.apply(root, [{ do: 'glow', on: '.thing', at: 0, for: 1.5 }], tl, 0, [], VB, 120000 /* a two minute film */);
  const glowCalls = tl.calls.filter(c => c.target && c.target.tag === 'circle' && c.target !== target);
  const last = Math.max(...glowCalls.map(c => c.position + c.props.duration));
  ok(last === 1500, 'a 1.5s glow on a two minute film ends at 1500ms, not somewhere near 120000: ' + last);
}

console.log('\ncount rebuilds a comma formatted number');
{
  for (const start of ['7,275', '600,000', '12', '1,000,000']) {
    const root = makeEl('g');
    const e = makeEl('text');
    e.textContent = start;
    root._targets = { '.num': [e] };
    const tl = makeTimeline();
    NOORMOTION.apply(root, [{ do: 'count', on: '.num', at: 0, for: 1 }], tl, 0, [], VB, 40000);
    const call = tl.calls[0];
    ok(!!call, 'a tween was recorded for "' + start + '"');
    if (call) {
      call.target.n = parseFloat(start.replace(/,/g, ''));   // drive the tween to its end value
      call.props.onUpdate();
      ok(e.textContent === start, '"' + start + '" round trips: got "' + e.textContent + '"');
    }
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
