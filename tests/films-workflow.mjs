/* NOOR - the films workflow, read as text.

   .github/workflows/films.yml is not run here (it needs Actions, a browser,
   ffmpeg and a real token); this checks the file itself the way
   tests/retire.mjs already checks reels.yml, a small set of string and
   regex assertions against the raw YAML rather than a full parser, since
   the suite runs on Node 22 with no extra packages. What it proves: the
   three inputs and the three jobs exist, each job carries a timeout, the
   runs never race (one concurrency group), the music release is named
   "films-music", the render and assemble jobs call render_ci.py and
   shortmanifest.py, and the only two secrets read anywhere in the file are
   GITHUB_TOKEN (supplied by Actions itself) and BLOB_READ_WRITE_TOKEN (the
   owner's own token for the shelf, the same one tools/reels/README.md and
   reels.yml already ask for). The original orders for this file expected
   the shelf to need no secret beyond GITHUB_TOKEN; a later note changed
   that (the films shelf writes to the same Vercel Blob store the reels
   engine's own shelf can use, not a GitHub Release), so this checks against
   the two secrets the shipped design actually reads, both already an
   established part of this house's own shelf.

   Run:  node tests/films-workflow.mjs
*/
import fs from 'fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const PATH = '.github/workflows/films.yml';
const wf = fs.readFileSync(PATH, 'utf8');

console.log('\n=== the workflow file itself ===');
ok(fs.existsSync(PATH), 'films.yml exists at ' + PATH);
//  built from code points, not typed literally, so this file itself never
//  carries the two characters it exists to catch (the house rule, kept the
//  same way tests/no-dashes.mjs and tools/films/shortmanifest.py's own
//  no_dash keep it)
const DASH = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
ok(!DASH.test(wf), 'no em dash or en dash anywhere in the file');

console.log('\n=== workflow_dispatch inputs ===');
const inputsBlock = (wf.match(/workflow_dispatch:\s*\n\s*inputs:\n([\s\S]*?)\n\s*permissions:/) || [, ''])[1];
ok(/^\s*briefs:/m.test(inputsBlock), 'input "briefs" (comma separated brief names, without the plate- prefix)');
ok(/^\s*machines:/m.test(inputsBlock), 'input "machines" (how many machines may render)');
ok(/^\s*proof:/m.test(inputsBlock), 'input "proof" (12 fps, shutter 1, for a quick look)');
ok(/default:\s*"4"/.test(inputsBlock), 'machines defaults to 4');
ok(/type:\s*boolean/.test(inputsBlock), 'proof is a boolean input');

console.log('\n=== the three jobs ===');
ok(/^\s*plan:\s*$/m.test(wf), 'a "plan" job');
ok(/^\s*render:\s*$/m.test(wf), 'a "render" job');
ok(/^\s*assemble:\s*$/m.test(wf), 'an "assemble" job');
const jobsBlock = (wf.match(/\njobs:\n([\s\S]*)$/) || [, ''])[1];
const timeouts = [...jobsBlock.matchAll(/timeout-minutes:\s*\d+/g)];
ok(timeouts.length >= 3, 'a timeout-minutes on every job (found ' + timeouts.length + ')');
ok(/render:\s*\n[\s\S]*?strategy:\s*\n\s*fail-fast:\s*false\s*\n\s*matrix:/.test(wf),
   'the render job is a matrix, fail-fast off (one machine\'s death does not stop the others)');

console.log('\n=== the runs never race ===');
ok(/concurrency:\s*\n\s*group:\s*films\s*\n\s*cancel-in-progress:\s*false/.test(wf),
   'one concurrency group "films", never cancelled mid run');

console.log('\n=== the music release ===');
ok(/films-music/.test(wf), 'the release tag "films-music" is named in the file');
ok(/gh release download/.test(wf), 'the render job fetches it with the gh CLI');
ok(/exit 1/.test(wf) && /films-music.*README/.test(wf.replace(/\n/g, ' ')),
   'a missing release or missing assets fails the run with a line naming the README');

console.log('\n=== the two entry points ===');
ok(/render:\s*\n[\s\S]*?render_ci\.py/.test(wf), 'the render job calls render_ci.py');
ok(/assemble:\s*\n[\s\S]*?shortmanifest\.py/.test(wf), 'the assemble job calls shortmanifest.py');
//  publish-shorts.sh is named in the file's own prose (explaining why the
//  pathname and the 50 MB ceiling below match it); what must never appear
//  is actually RUNNING it, which only a leading ./, bash or sh would do
ok(!/(\.\/|bash |sh )publish-shorts\.sh/.test(wf),
   'publish-shorts.sh itself is never invoked (it is written for the owner\'s own shell)');
//  the plan job's own use of shortplate.py --check is explicit in the
//  marching orders ("compiles each with shortplate.py"); it is a third
//  script by name, and deliberately so, not a stand in for either entry
//  point above
ok(/plan:\s*\n[\s\S]*?shortplate\.py/.test(wf), 'the plan job validates every brief with shortplate.py --check first');

console.log('\n=== the secrets ===');
const secretNames = [...wf.matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map(m => m[1]);
const uniq = [...new Set(secretNames)].sort();
ok(uniq.length > 0, 'at least one secrets.* reference exists (found: ' + uniq.join(', ') + ')');
ok(uniq.every(n => n === 'GITHUB_TOKEN' || n === 'BLOB_READ_WRITE_TOKEN'),
   'no secret beyond GITHUB_TOKEN and BLOB_READ_WRITE_TOKEN is read (found: ' + uniq.join(', ') + ')');
ok(uniq.includes('BLOB_READ_WRITE_TOKEN'), 'BLOB_READ_WRITE_TOKEN is read (the shelf, same token reels.yml already asks for)');
ok(!/[A-Za-z0-9+/]{30,}={0,2}(['"\s]|$)/.test(wf.replace(/https:\/\/\S+/g, '')),
   'nothing that looks like a bare secret or token is written into the file');

console.log('\n=== the shelf: blob, not a release, and the reels engine\'s own helper ===');
ok(/blob_put/.test(wf), 'shelf_store.py\'s own blob_put is called (imported, not re-typed)');
ok(/import shelf_store/.test(wf), 'shelf_store.py is imported rather than duplicated');
ok(/reels\/["'\s]|"reels\/"|'reels\/'/.test(wf) || /"reels\/" \+ pathname/.test(wf),
   'a film uploads under the same "reels/<id>.mp4" pathname publish-shorts.sh uses');
ok(/52428800/.test(wf), 'the same 50 MB ceiling publish-shorts.sh keeps (52428800 bytes)');

console.log('\n=== the pull request ===');
ok(/create-pull-request@v7/.test(wf), 'opens a pull request with peter-evans/create-pull-request');
ok(/branch:\s*films\/built/.test(wf), 'on branch films/built');
ok(/Co-Authored-By:/.test(wf) && /Claude-Session:/.test(wf), 'the commit message carries the attribution lines');
ok(/Generated with \[Claude Code\]/.test(wf), 'the pull request body carries the attribution line');
ok(/reels\/index\.json/.test(wf) && /reels\/home\.json/.test(wf),
   'the manifest and the home page sidecar are what the pull request carries');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
