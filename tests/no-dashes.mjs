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

   Widened 17 September 2026 (content-005): the JSON scan below caught the
   film scripts only, and 186 dashes sat unseen in reader facing HTML, the
   99 Names' worst offender among them. HTML_FILES adds the exact content
   files the audit named; a page found to carry a dash joins this list the
   same day it is cleaned, so the rule holds for it from then on.

   Widened 26 September 2026 (audit-house-rule): a repo-wide sweep found
   dashes sitting unseen in comments, prompts and error strings. Every one
   found in a served or hand-read file was rewritten in the house's own
   punctuation (a comma, a colon, a semicolon, parentheses or a plain
   hyphen for a number range). What was NOT touched, and stays listed in
   EXEMPT on purpose: code that deliberately detects or scrubs a dash (a
   regex like DASH_RX, the dash-to-middot replace() calls in the api/
   routes that clean owner text before it is spoken or posted, a fixture
   in tests/house.mjs that feeds a dash in on purpose to prove the refusal
   works, or an entity table mapping the name "mdash" to the character);
   an i18n string pack (i18n/text/*.json), keyed by a hash of the page
   text and only ever written by the i18n build, never by hand; and the
   content patch scripts under scripts/patches/ and .build-src/, which are
   build INPUTS, not served text: scripts/build.mjs's own scrubDashes()
   pass (build.mjs:295-326) rewrites every dash in every string field of
   every node, character and place it walks (SKIP_KEYS there is only
   `ar` and `titleAr`, so even a quoted hadith's `en`/`text`/`source`
   field is scrubbed, not merely the ones this file happens to exempt)
   before any of it reaches node/*.json. A first pass here (found and
   fixed 26 September 2026, reverted the same day on review) rewrote
   those patch files by hand instead: it left `node scripts/build.mjs`
   unable to find text its own clarity pass expects word for word, and
   would have rewritten 66 served files under the build's own scrubbing
   if that check had been bypassed. The lesson stays here rather than in
   a commit message: a dash inside scripts/patches/ or .build-src/ is the
   build's job, never this file's or a hand edit's.
   EXEMPT below is that list, file by file, with the exact count each one
   is allowed to carry; a file not listed here must carry none at all, and
   a listed file whose count has grown past its number has picked up a new
   dash that was not reviewed. Shrinking a count (a file cleaned further)
   should update the number down, not be silenced by raising it.
*/
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Derived from this file's own path, not process.cwd(), so the suite reads
// and scans the right tree whether it is run from the repo root, from
// tests/, or from anywhere else (a session that cd'd out, a CI step that
// never cd's in at all).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DASH = /[–—]/;
const DASH_G = /[–—]/g;
const ROOTS = ['tools/films/films'];
const HTML_FILES = ['allah.html', 'index.html', 'muhammad.html', 'mizan.html'];
const bad = [];

// file (repo-relative) -> the exact number of dashes it is known and
// reviewed to carry: dash-detecting or dash-scrubbing code, an entity
// table, one deliberate test fixture, a generated i18n pack, or a
// scripts/patches or .build-src build input scripts/build.mjs scrubs.
const EXEMPT = {
  '.build-src/characters.src.html': 28,  // build input; scripts/build.mjs scrubs dashes from the built output
  '.build-src/nodes.src.js': 198,        // build input; scripts/build.mjs scrubs dashes from the built output
  'api/_nightshift.js': 2,               // DASH detection regex
  'api/_steward.js': 2,                  // DASH detection regex
  'api/admin-vet.js': 4,                 // dash-to-middot scrub, twice over
  'api/ask.js': 2,                       // DASH detection/scrub regex
  'api/dedications.js': 2,               // dash-to-middot scrub
  'api/guide.js': 2,                     // dash-to-middot scrub
  'api/illuminations.js': 2,             // dash-to-middot scrub
  'api/journal.js': 2,                   // dash-to-middot scrub
  'api/marketing.js': 2,                 // dash-to-middot scrub
  'i18n/text/en.json': 7,               // i18n string packs keyed by a hash of the page text; regenerated by the i18n build, never hand-edited
  'i18n/text/priority.json': 1,         // same
  'i18n/text/qa.json': 5,               // same
  'scripts/build.mjs': 14,               // scrubDashes(): the pass that cleans the built content
  'scripts/compile-clarity.mjs': 2,      // DASH detection regex
  'scripts/gen-lights.py': 2,            // DASH detection regex
  'scripts/gen-quran-study.py': 2,       // dash character-class check
  'scripts/i18n.py': 4,                  // dash detection and scrub for i18n packs
  'scripts/patches/bidaya-qisas.mjs': 281,  // build input; scripts/build.mjs scrubs dashes from the built output
  'scripts/patches/books-v4.mjs': 42,       // build input; scripts/build.mjs scrubs dashes from the built output
  'scripts/patches/characters.mjs': 170,    // build input; scripts/build.mjs scrubs dashes from the built output
  'scripts/patches/nihaya.mjs': 490,        // build input; scripts/build.mjs scrubs dashes from the built output
  'scripts/patches/seerah.mjs': 280,        // build input; scripts/build.mjs scrubs dashes from the built output
  'scripts/recs.mjs': 2,                 // dash-to-comma scrub
  'tests/ask.mjs': 2,                    // NAMED entity table (mdash/ndash characters)
  'tests/e2e.mjs': 4,                    // page-content dash assertions
  'tests/house.mjs': 3,                  // 1 detection regex, 1 deliberate refusal fixture (2 chars)
  'tests/no-dashes.mjs': 4,              // this file's own DASH and DASH_G literals
  'tests/package.mjs': 2,                // DASH detection regex
  'tools/reels/BRIEF.md': 2,             // a fenced code block showing the audit's own assert
  'tools/reels/copy_audit.py': 2,        // dash detection check
  'tools/reels/library.py': 2,           // dash detection check
};
const TEXT_EXT = new Set(['.js', '.mjs', '.html', '.css', '.md', '.json', '.txt', '.py', '.yml']);
const SKIP_DIR = /(^|\/)(node_modules|\.git)(\/|$)/;

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
  const abs = path.join(ROOT, root);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs).filter(f => f.endsWith('.json'))) {
    const p = path.join(root, f);
    scan(JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')), '', p);
  }
}

for (const f of HTML_FILES) {
  const abs = path.join(ROOT, f);
  if (!fs.existsSync(abs)) continue;
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (DASH.test(line)) bad.push({ file: f, where: ':' + (i + 1), text: line.trim().slice(0, 90) });
  });
}

// The whole-repo guard: every tracked file, and every untracked file git
// would still let in (not gitignored: a new file this very session, not
// yet added), must carry zero dashes unless it is named in EXEMPT, and
// then exactly its reviewed count. `git ls-files` failing outright (no
// git on the machine, ROOT not a repo) or coming back empty (run from the
// wrong directory, a shallow or broken checkout) is not "nothing to
// check", it is this guard unable to see the repo at all, so it fails
// loudly rather than passing on an empty list.
console.log('=== no em dashes, no en dashes ===');
let tracked = null;
let gitError = '';
try {
  const t = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  const u = execSync('git ls-files --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  tracked = t.concat(u);
} catch (e) {
  gitError = String(e && e.message || e);
}
if (!tracked || !tracked.length) {
  console.log('  FAIL git ls-files could not list the repo at ' + ROOT
    + (gitError ? ' (' + gitError.split('\n')[0] + ')' : ' (returned nothing)')
    + ': the whole-repo guard has no file list to check, which is a failure, not a pass');
  process.exit(1);
}
const seen = new Set();
const drift = [];
for (const rel of tracked) {
  if (seen.has(rel)) continue;
  seen.add(rel);
  if (SKIP_DIR.test(rel)) continue;
  const ext = path.extname(rel);
  if (!TEXT_EXT.has(ext)) continue;
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  const text = fs.readFileSync(abs, 'utf8');
  const count = (text.match(DASH_G) || []).length;
  const allowed = EXEMPT[rel] || 0;
  if (count !== allowed) {
    drift.push({ file: rel, count, allowed });
  }
}

if (drift.length) {
  console.log('  FAIL ' + drift.length + ' file' + (drift.length > 1 ? 's' : '') + ' drifted from the reviewed dash count');
  for (const d of drift.slice(0, 30)) {
    console.log('     ' + d.file + ': has ' + d.count + ', reviewed and allowed ' + d.allowed
      + (d.count > d.allowed ? ' (a new dash needs review)' : ' (cleaned further, lower EXEMPT to match)'));
  }
  process.exit(1);
}
if (!bad.length) {
  console.log('  PASS every line of every film script and content file is clean, and the whole'
    + ' repo carries only the ' + Object.keys(EXEMPT).length + ' reviewed, counted exceptions');
  process.exit(0);
}
console.log('  FAIL ' + bad.length + ' line' + (bad.length > 1 ? 's' : '') + ' carry a dash');
for (const b of bad.slice(0, 20)) console.log(`     ${b.file}${b.where}\n       ${b.text}`);
process.exit(1);
