/* NOOR · the house does not use em dashes or en dashes.
   ---------------------------------------------------------------------------
   A project rule, and one worth enforcing rather than remembering. The dash is
   the single loudest tell that a sentence was written by a machine, and a
   library whose whole claim is that a human stands behind every line cannot
   afford to read like one that does not. A date range takes "to" or a hyphen;
   an aside takes a comma, a colon or a full stop, and is usually better for it.

   This walks the film scripts and the copy the site ships, and fails on the
   first one it finds. It is deliberately dumb: there is no allowed list, and
   no exception, because the moment there is one the rule stops holding.
*/
import fs from 'node:fs';
import path from 'node:path';

const DASH = /[–—]/;
const ROOTS = ['tools/films/films'];
const bad = [];

function scan(v, where, file) {
  if (typeof v === 'string') {
    if (DASH.test(v)) bad.push({ file, where, text: v.slice(0, 90) });
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => scan(x, where + '[' + i + ']', file));
  } else if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) scan(v[k], where + '.' + k, file);
  }
}

for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const f of fs.readdirSync(root).filter(f => f.endsWith('.json'))) {
    const p = path.join(root, f);
    scan(JSON.parse(fs.readFileSync(p, 'utf8')), '', p);
  }
}

console.log('=== no em dashes, no en dashes ===');
if (!bad.length) {
  console.log('  PASS every line of every film script is clean');
  process.exit(0);
}
console.log('  FAIL ' + bad.length + ' line' + (bad.length > 1 ? 's' : '') + ' carry a dash');
for (const b of bad.slice(0, 20)) console.log(`     ${b.file}${b.where}\n       ${b.text}`);
process.exit(1);
