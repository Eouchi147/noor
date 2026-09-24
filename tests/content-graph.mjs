/* NOOR - the Content Graph, built and checked as a promise: masterplan step 5.

   Runs the graph builder for real (scripts/graph/extract_js.mjs then
   build_graph.py, both via child_process, python3 and node already on the
   machine) into a scratch folder under build/graph so it never touches the
   one the site reads mid-suite, then:
     - the build succeeds and validate_graph.py passes it (unique ids, no
       dangling edge, every mentions edge carries a confidence);
     - every node of the rendered room families (light, chapter, surah,
       verse on the shelf, word, prophet, companion, character, place, name)
       has a url, since a room with no url is a room nothing can link to;
     - every one of the 1,565 planned reel cards traces to a content object
       by a reel_of edge; the 52 heroes/Hajj "short" reels (outside that
       count, named by a room field or a film's own brief instead of a plan
       card) either trace the same way or are named in an explicit
       allow-list with a reason that still matches their own flag, so none
       is merely shrugged off;
     - assets/entity-graph.json matches what derive_entity_graph.py produces
       from the graph right now byte for byte, order included, since
       besideEntity() (api/page.js) shows only the first 8 of a list and the
       order is ranked by relevance, not an accident (a drift guard: if this
       fails, the file in the repository was hand edited, resorted, or the
       rules changed without a regeneration; proved sensitive to order by
       reversing one room's own list and checking that is caught too);
     - assets/person-words.json matches what derive_person_words.py produces
       from scripts/graph/same-as.json right now, byte for byte: the file
       relatedWords() (api/page.js) actually reads, since same-as.json
       itself never deploys, and drift here is the live site quietly losing
       khadijah, fatimah and the rest of the curated word: pairs;
     - assets/reel-subjects.json matches what derive_reel_subjects.py
       produces from the shelf right now, byte for byte: the file
       subjectOf() (api/_insights.js) actually reads, since lights/all.json,
       the dictionary and tools/reels/quran-uthmani.json never deploy, and
       drift here is the console's subject fold quietly falling silent;
     - two builds over the same unchanged tree write byte-identical graphs.
   The full build is a few seconds (about 5 on this machine); the suite
   builds it twice for the determinism check, so budget under a minute.

   Run:  node tests/content-graph.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GRAPH_DIR = path.join(ROOT, 'scripts', 'graph');
const SCRATCH = path.join(ROOT, 'build', 'graph', '.test-scratch');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const skip = m => console.log('  SKIP ' + m);

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 * 200 });
  return { code: r.status, out: String(r.stdout || ''), err: String(r.stderr || '') };
}
function buildOnce(outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  const x = run('node', [path.join(GRAPH_DIR, 'extract_js.mjs'), ROOT, path.join(outDir, 'out', 'js')]);
  if (x.code !== 0) return { ok: false, why: 'extract_js.mjs: ' + x.err.slice(-400) };
  const b = run('python3', [path.join(GRAPH_DIR, 'build_graph.py'), '--repo', ROOT, '--out', outDir]);
  if (b.code !== 0) return { ok: false, why: 'build_graph.py: ' + b.err.slice(-400) };
  return { ok: true, file: path.join(outDir, 'noor-content-graph.json') };
}

console.log('\n=== building the graph ===');
const outA = path.join(SCRATCH, 'a');
const buildA = buildOnce(outA);
ok(buildA.ok, buildA.ok ? 'scripts/graph/extract_js.mjs then build_graph.py run clean' : buildA.why || '');

let graph = null;
if (buildA.ok) {
  const v = run('python3', [path.join(GRAPH_DIR, 'validate_graph.py'), buildA.file]);
  ok(v.code === 0 && /VALID\s*$/.test(v.out.trim()), 'validate_graph.py: unique ids, no dangling edge, every mentions edge has a confidence');
  try { graph = JSON.parse(fs.readFileSync(buildA.file, 'utf8')); } catch (e) { ok(false, 'the graph file parses as JSON: ' + e.message); }
} else {
  skip('validate_graph.py (no graph to check)');
}

console.log('\n=== every rendered room has a url ===');
if (graph) {
  const nodes = graph.nodes;
  const ROOM_TYPES = { light: true, chapter: true, surah: true, word: true, prophet: true, companion: true, place: true, name: true };
  // a character room is a figure that is not the Unseen page's own copy;
  // a verse only needs a url once it is on the shelf (the rest are cited only)
  const roomNodes = nodes.filter(n =>
    ROOM_TYPES[n.type]
    || (n.type === 'figure' && !n.id.startsWith('figure:unseen-'))
    || (n.type === 'verse' && n.on_shelf));
  const noUrl = roomNodes.filter(n => !n.url);
  ok(roomNodes.length > 0 && noUrl.length === 0,
     'every node of a rendered room family carries a url (' + (roomNodes.length - noUrl.length) + '/' + roomNodes.length + ')'
     + (noUrl.length ? '; missing: ' + noUrl.slice(0, 5).map(n => n.id).join(', ') : ''));
} else skip('room urls (no graph)');

console.log('\n=== every reel traces to a content object ===');
if (graph) {
  const reelOfFrom = new Set(graph.edges.filter(e => e.rel === 'reel_of').map(e => e.from));
  const reels = graph.nodes.filter(n => n.type === 'reel');
  const planReels = reels.filter(n => !n.id.startsWith('reel:short-'));
  const shortReels = reels.filter(n => n.id.startsWith('reel:short-'));
  const untracedPlan = planReels.filter(n => !reelOfFrom.has(n.id));
  ok(planReels.length === 1565, 'the reel plan holds 1,565 cards (found ' + planReels.length + ')');
  ok(untracedPlan.length === 0,
     'every one of the 1,565 planned cards traces to a content object by a reel_of edge (' + untracedPlan.length + ' do not)'
     + (untracedPlan.length ? ': ' + untracedPlan.slice(0, 5).map(n => n.id).join(', ') : ''));

  // the 52 heroes/Hajj "short" films (the masterplan's flagship derivatives,
  // outside the plan): build_graph.py traces each one's `room` field to the
  // one graph node its fragment names, where that is unambiguous; a heroes
  // field section (several gifts, not one record) is instead read against
  // the film's own brief at tools/films/briefs/plate-<x>.json, matched by a
  // name the brief's eyebrow or note shares with exactly one gift there,
  // and a hajj.html fragment naming nothing traces to page:hajj itself (see
  // resolve_short_room(), resolve_field() and ARCHITECTURE.md). Every film
  // still untraced after all of that must be named here, with why, so a
  // newly added film that should have traced and silently did not is
  // caught rather than shrugged off.
  const ALLOW_UNTRACED_SHORT = {
    // a field section with no brief on file: nothing to match the gifts against
    'reel:short-canon': 'field-no-brief', 'reel:short-circulation': 'field-no-brief',
    'reel:short-coffee': 'field-no-brief', 'reel:short-courses': 'field-no-brief',
    'reel:short-dome': 'field-no-brief', 'reel:short-earthsize': 'field-no-brief',
    'reel:short-lens': 'field-no-brief', 'reel:short-loanwords': 'field-no-brief',
    'reel:short-lute': 'field-no-brief', 'reel:short-monsoon': 'field-no-brief',
    'reel:short-orchard': 'field-no-brief', 'reel:short-papermill': 'field-no-brief',
    'reel:short-qanat': 'field-no-brief', 'reel:short-starnames': 'field-no-brief',
    'reel:short-wisdom': 'field-no-brief',
    // a brief on file, but the field section itself is genuinely ambiguous:
    // Ibn al-Haytham's name is shared by two gifts under Seeing
    'reel:short-darkroom': 'field-ambiguous',
    // a brief on file, but no gift's name or distinctive title word is in it
    'reel:short-road': 'field-no-match', 'reel:short-zero': 'field-no-match',
  };
  const REASON_SHAPE = {
    'field-no-brief': /^a field section on heroes\.html, several gifts, not one record$/,
    'field-ambiguous': /^brief (eyebrow|note) names more than one gift: .+$/,
    'field-no-match': /^no gift in f-[a-z-]+ shares a name with the brief$/,
  };
  const untracedShort = shortReels.filter(n => !reelOfFrom.has(n.id));
  const unlisted = untracedShort.filter(n => !(n.id in ALLOW_UNTRACED_SHORT));
  ok(unlisted.length === 0,
     'every untraced "short" film is named in the allow-list with why (' + unlisted.length + ' are not)'
     + (unlisted.length ? ': ' + unlisted.map(n => n.id).join(', ') : ''));
  const nowTraced = Object.keys(ALLOW_UNTRACED_SHORT).filter(id => reelOfFrom.has(id));
  ok(nowTraced.length === 0, 'nothing in the allow-list traces now (stale entries: ' + nowTraced.join(', ') + ')');
  const wrongShape = untracedShort.filter(n => {
    const want = REASON_SHAPE[ALLOW_UNTRACED_SHORT[n.id]];
    const flag = (n.quality.flags || []).find(f => f.startsWith('short_untraced:'));
    return !want || !flag || !want.test(flag.slice('short_untraced:'.length));
  });
  ok(wrongShape.length === 0,
     'every allow-listed film\'s own flag still matches the reason it is listed under (' + wrongShape.length + ' do not)'
     + (wrongShape.length ? ': ' + wrongShape.map(n => n.id).join(', ') : ''));
  console.log('  · ' + shortReels.length + ' "short" films: ' + (shortReels.length - untracedShort.length)
              + ' traced by a reel_of edge, ' + untracedShort.length + ' named in the allow-list, every film accounted for');

  // a film traced to a gift by its brief must carry the matched brief text
  // as the edge's evidence (coordinator's rule: record what matched)
  const giftEdges = graph.edges.filter(e => e.rel === 'reel_of' && shortReels.some(n => n.id === e.from) && e.to.startsWith('hero:gift-'));
  const noEvidence = giftEdges.filter(e => !e.via || !e.via.startsWith('brief '));
  ok(giftEdges.length > 0 && noEvidence.length === 0,
     'every short film traced to a field gift carries the matched brief text as its edge evidence (' + giftEdges.length + ' such edges)'
     + (noEvidence.length ? '; missing on: ' + noEvidence.map(e => e.from).join(', ') : ''));

  // a brief that names a Light explicitly earns that film an extra reel_of
  const lightEdges = graph.edges.filter(e => e.rel === 'reel_of' && shortReels.some(n => n.id === e.from) && e.to.startsWith('light:'));
  ok(lightEdges.length === 1 && lightEdges[0].from === 'reel:short-astrolabe' && lightEdges[0].to === 'light:al-ijliyya-astrolabe-maker',
     'the one brief that cites a Light by id earns its film an extra reel_of to that Light (' + lightEdges.length + ' found)');
} else skip('reel tracing (no graph)');

console.log('\n=== assets/entity-graph.json matches what the graph derives right now ===');
if (buildA.ok) {
  const derivedOut = path.join(SCRATCH, 'entity-graph.derived.json');
  const d = run('python3', [path.join(GRAPH_DIR, 'derive_entity_graph.py'), '--graph', buildA.file, '--out', derivedOut]);
  ok(d.code === 0, 'derive_entity_graph.py runs against the freshly built graph: ' + d.err.slice(-300));
  if (d.code === 0) {
    const shipped = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'entity-graph.json'), 'utf8'));
    const derived = JSON.parse(fs.readFileSync(derivedOut, 'utf8'));
    const sKeys = Object.keys(shipped).filter(k => k !== '_about').sort();
    const dKeys = Object.keys(derived).filter(k => k !== '_about').sort();
    const sameKeys = JSON.stringify(sKeys) === JSON.stringify(dKeys);
    ok(sameKeys, 'the same set of rooms carry a shelf (' + sKeys.length + ')');
    // byte for byte, order included: besideEntity() shows only the first 8
    // of a list (api/page.js), ranked by relevance (derive_entity_graph.py's
    // by_relevance()), so which 8 and in what order is the actual promise
    // to a reader, not merely which ids are present; a list resorted by
    // hand, or by a change to the ranking rule that was never rerun, is
    // exactly the drift this guard exists to catch
    let fieldDrift = [];
    if (sameKeys) {
      for (const k of sKeys) {
        if (JSON.stringify(shipped[k]) !== JSON.stringify(derived[k])) fieldDrift.push(k);
      }
    }
    ok(fieldDrift.length === 0,
       'every room\'s shelf matches the graph\'s own derivation byte for byte, order included (' + fieldDrift.length + ' drifted)'
       + (fieldDrift.length ? ': ' + fieldDrift.slice(0, 5).join(', ') + ', run scripts/graph/run.sh to regenerate' : ''));

    // prove the check above is not a rubber stamp: reversing one room's own
    // list by hand must be caught, not shrugged off as "the same set, order
    // aside" (the drift this exact guard used to let through)
    const withList = sKeys.find(k => Array.isArray(derived[k].words) && derived[k].words.length > 1)
      || sKeys.find(k => Array.isArray(derived[k].lights) && derived[k].lights.length > 1);
    if (withList) {
      const field = Array.isArray(derived[withList].words) && derived[withList].words.length > 1 ? 'words' : 'lights';
      const mutated = { ...derived[withList], [field]: [...derived[withList][field]].reverse() };
      const caught = JSON.stringify(shipped[withList]) !== JSON.stringify(mutated);
      ok(caught, 'reversing ' + withList + '\'s own "' + field + '" list by hand is caught by the same comparison (proof the guard is order-sensitive)');
    } else {
      skip('order-sensitivity proof (no room\'s list is long enough to reverse)');
    }
  }
} else skip('entity-graph drift (no graph)');

console.log('\n=== assets/person-words.json matches same-as.json right now ===');
{
  // api/page.js's relatedWords() reads this file, not same-as.json itself,
  // since scripts/ never deploys (.vercelignore's /scripts/): a drift here
  // is the live site quietly losing the exemption a Light like
  // "Khadijah bint Khuwaylid" depends on, the exact bug a refuter found.
  const derivedOut = path.join(SCRATCH, 'person-words.derived.json');
  const d = run('python3', [path.join(GRAPH_DIR, 'derive_person_words.py'), '--same-as', path.join(GRAPH_DIR, 'same-as.json'), '--out', derivedOut]);
  ok(d.code === 0, 'derive_person_words.py runs against same-as.json: ' + d.err.slice(-300));
  if (d.code === 0) {
    const shipped = fs.readFileSync(path.join(ROOT, 'assets', 'person-words.json'), 'utf8');
    const derived = fs.readFileSync(derivedOut, 'utf8');
    ok(shipped === derived, 'assets/person-words.json is byte-identical to what run.sh\'s derive step produces right now');
    const shippedWords = JSON.parse(shipped).words;
    ok(shippedWords.includes('khadijah') && shippedWords.includes('fatimah'), 'and it carries khadijah and fatimah, the pair a refuter\'s review named');
  }
  fs.rmSync(derivedOut, { force: true });
}

console.log('\n=== assets/reel-subjects.json matches the shelf right now ===');
{
  // api/_insights.js's subjectOf() reads this file, not lights/all.json,
  // assets/dict-index.json or tools/reels/quran-uthmani.json themselves,
  // since none of those deploy: a drift here is the live subject fold
  // quietly falling out of step with the Lights or the shelf's own plan,
  // the exact deploy gap a refuter's review found (api/_insights.js used
  // to import api/page.js's groupOf()/dictionary() for this, which none
  // of api/insights.js, api/house.js or api/warm.js carried includeFiles
  // for).
  const derivedOut = path.join(SCRATCH, 'reel-subjects.derived.json');
  const d = run('python3', [path.join(GRAPH_DIR, 'derive_reel_subjects.py'), '--repo', ROOT, '--out', derivedOut]);
  ok(d.code === 0, 'derive_reel_subjects.py runs against the shelf: ' + d.err.slice(-300));
  if (d.code === 0) {
    const shipped = fs.readFileSync(path.join(ROOT, 'assets', 'reel-subjects.json'), 'utf8');
    const derived = fs.readFileSync(derivedOut, 'utf8');
    ok(shipped === derived, 'assets/reel-subjects.json is byte-identical to what run.sh\'s derive step produces right now');
    const shippedSubjects = JSON.parse(shipped).subjects;
    ok(shippedSubjects && shippedSubjects['abdurrahman-ibn-awf-market'] && shippedSubjects['verse-2-255'] && shippedSubjects['word-abu-bakr'] && shippedSubjects['short-algebra'],
       'and it carries a Light, a verse, a word and a film, the four kinds a subject can be derived for');
  }
  fs.rmSync(derivedOut, { force: true });
}

console.log('\n=== deterministic: two builds over an unchanged tree agree ===');
if (buildA.ok) {
  const outB = path.join(SCRATCH, 'b');
  const buildB = buildOnce(outB);
  ok(buildB.ok, 'a second build runs clean');
  if (buildB.ok) {
    const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    ok(hash(buildA.file) === hash(buildB.file), 'the two graphs are byte-identical');
  }
} else skip('determinism (no first graph to compare)');

fs.rmSync(SCRATCH, { recursive: true, force: true });

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
