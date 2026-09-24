// NOOR Content Graph, step 1: evaluate the data that lives in JavaScript files
// and in inline <script> blocks, and write it out as JSON so the graph builder
// (Python) can read every collection the same way. Ported from the content
// audit's /root/audit/content/scripts/extract_js.mjs on 24 September 2026 so
// the graph can be rebuilt inside the repository, not only outside it; the
// only change from the audit's copy is where it reads and writes by default.
//
//   node extract_js.mjs [repo] [outdir]
//
// With no arguments it reads the repository this file lives in (two folders
// up from scripts/graph/) and writes under build/graph/out/js. Nothing under
// the repository itself is written. Every evaluation runs in a bare vm
// context with a stub `window` and `document`, so a data file that touches the
// DOM fails loudly instead of doing anything.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT = path.resolve(HERE, '..', '..');
const REPO = process.argv[2] || REPO_DEFAULT;
const OUT = process.argv[3] || path.join(REPO_DEFAULT, 'build', 'graph', 'out', 'js');
fs.mkdirSync(OUT, { recursive: true });

const read = f => fs.readFileSync(path.join(REPO, f), 'utf8');
const save = (name, obj) => fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(obj, null, 0));

function evalFile(src, expr, label) {
  const sb = { window: {}, document: undefined, console };
  vm.createContext(sb);
  try {
    vm.runInContext(src + `\n;this.__OUT = (${expr});`, sb, { filename: label, timeout: 20000 });
  } catch (e) {
    throw new Error(`${label}: ${e.message}`);
  }
  return sb.__OUT;
}

// whole data files
const files = [
  ['characters.js', 'CHARACTERS', 'characters'],
  ['places.js', 'PLACES', 'places'],
  ['words.js', 'WORDS', 'path-words'],
  ['prophets-data.js', 'window.NOOR_PROPHETS', 'prophets'],
  ['madrasa-data.js', 'window.NOOR_CURRICULUM', 'madrasa'],
  ['unseen-data.js', 'window.NOOR_UNSEEN', 'unseen'],
  ['noor-guide-data.js', 'NOOR_GUIDE', 'guide'],
  ['nodes-index.js', '({meta: NOOR_META, nodes: NODES})', 'nodes-index'],
  ['nodes.js', '({meta: NOOR_META, nodes: NODES})', 'nodes-full'],
  ['markets.js', 'typeof MARKETS !== "undefined" ? MARKETS : (typeof window.NOOR_MARKETS !== "undefined" ? window.NOOR_MARKETS : null)', 'markets'],
];
for (const [f, expr, name] of files) {
  try {
    const v = evalFile(read(f), expr, f);
    save(name, v);
    const n = Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : 0);
    console.log(`${f}: ok (${n} top level entries) -> ${name}.json`);
  } catch (e) { console.log(`${f}: FAILED ${e.message}`); }
}

// inline arrays inside pages: pull the `const NAME = [...]` literal by bracket
// matching (the arrays contain no nested script tags) and evaluate only that.
function inlineConst(html, name) {
  const re = new RegExp(`(?:const|var|let)\\s+${name}\\s*=\\s*`);
  const m = html.match(re);
  if (!m) return null;
  let i = m.index + m[0].length;
  const open = html[i];
  const close = open === '[' ? ']' : '}';
  let depth = 0, inStr = null, esc = false, j = i;
  for (; j < html.length; j++) {
    const ch = html[j];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) { j++; break; } }
  }
  const literal = html.slice(i, j);
  return evalFile('', literal, name);
}

const inline = [
  ['allah.html', ['NAMES', 'HASHR_VERSES', 'HASHR_NAMES'], 'names'],
  ['muhammad.html', ['STATIONS', 'ACTS', 'WITNESSES', 'CASES', 'HABITS'], 'seerah'],
  ['kids.html', ['HEROES', 'G', 'R'], 'kids-hub'],
];
for (const [f, names, out] of inline) {
  const html = read(f);
  const o = {};
  for (const n of names) {
    try { o[n] = inlineConst(html, n); console.log(`${f} ${n}: ${o[n] ? (Array.isArray(o[n]) ? o[n].length : Object.keys(o[n]).length) : 'missing'}`); }
    catch (e) { console.log(`${f} ${n}: FAILED ${e.message}`); o[n] = null; }
  }
  save(out, o);
}
// the site's own name table: scripts/build.mjs AUTOLINK maps every name it
// recognises in prose to a chapter, character, place or word id. The graph
// uses it for exact-name mentions, so the matching is the house's own.
try {
  const b = read('scripts/build.mjs');
  const o = { AUTOLINK: inlineConst(b, 'AUTOLINK'), NODE_WEAVE: inlineConst(b, 'NODE_WEAVE') };
  save('autolink', o);
  console.log(`scripts/build.mjs AUTOLINK: ${Object.keys(o.AUTOLINK || {}).length} names, NODE_WEAVE: ${Object.keys(o.NODE_WEAVE || {}).length}`);
} catch (e) { console.log('build.mjs AUTOLINK: FAILED', e.message); }
console.log('written to', OUT);
