/* NOOR - word alignment report.
   ------------------------------------------------------------------
   The word sheet (item 1 of the reading-view brief) maps a tapped .w span
   to verse/<n>.json's words[i] by POSITION. That is only honest when the
   two lists are the same length: the Uthmani text split into spans by
   renderAyahs, against the words this verse's notes were written against.
   A mismatch must fall through to the verse's ordinary tap rather than
   show the wrong word's meaning, so this is not a test with a pass or
   fail line -- it is a census, run once, of how many written verses can
   carry the feature at all.

   The real Uthmani text is not shipped inside this working tree (the page
   fetches it from api.alquran.cloud at read time, and no local file here
   holds it). /root/mushaf/quran-uthmani.json, the source the verse notes
   were themselves written against, does -- so this script reads it as a
   reference only. It is a sibling project, not this one, and nothing here
   writes to it. If that file is ever unavailable this script says so and
   stops rather than guess.

   Run:  node tests/word-align-report.mjs
*/
import { readFileSync, readdirSync } from 'fs';

const REF = '/root/mushaf/quran-uthmani.json';
const VDIR = new URL('../verse/', import.meta.url).pathname;
const ROOM = new URL('../quran.html', import.meta.url).pathname;

let ref;
try {
  ref = JSON.parse(readFileSync(REF, 'utf8'));
} catch (e) {
  console.log('Could not read the reference Uthmani text at ' + REF + ' (' + e.message + ').');
  console.log('No local file inside this working tree carries the Uthmani text either: the page');
  console.log('fetches it from api.alquran.cloud at read time. Alignment cannot be checked without it.');
  process.exit(0);
}
const verses = ref.verses || ref;

/* the exact split renderAyahs uses, copied rather than approximated: a
   waqf mark is not a word, and it is folded into the word before it.
   BISMILLAH itself is read out of the room's own quran.html rather than
   copied a second time here, so the census cannot silently drift from
   what the page actually strips (a hand-copied regex here once still
   used the plain ba, after the page had already been fixed to allow the
   shadda surahs 95 and 97 carry on theirs, and this file kept counting
   both as unaligned long after they were not). */
let BISMILLAH;
try {
  const roomSource = readFileSync(ROOM, 'utf8');
  const m = roomSource.match(/const BISMILLAH=\/(.*)\//);
  if (!m) throw new Error('quran.html no longer defines BISMILLAH where this file expects it');
  BISMILLAH = new RegExp(m[1]);
} catch (e) {
  console.log('Could not read the room\'s own BISMILLAH regex from ' + ROOM + ' (' + e.message + ').');
  process.exit(0);
}
function splitCount(n, v, text) {
  if (v === 1 && n !== 1 && n !== 9) text = text.replace(BISMILLAH, '');
  const toks = String(text).trim().split(/\s+/).filter(Boolean);
  const out = [];
  for (const w of toks) {
    if (/^[ۖ-ۭ]+$/.test(w) && out.length) out[out.length - 1] += ' ' + w;
    else out.push(w);
  }
  return out.length;
}

let files;
try { files = readdirSync(VDIR).filter(f => /^\d+\.json$/.test(f)); }
catch (e) { console.log('Could not read ' + VDIR + ': ' + e.message); process.exit(0); }

let total = 0, aligned = 0, mismatched = 0;
const bad = [];
for (const f of files) {
  const n = +f.replace('.json', '');
  let data;
  try { data = JSON.parse(readFileSync(VDIR + f, 'utf8')); } catch (e) { continue; }
  const vmap = data.v || {};
  for (const vs of Object.keys(vmap)) {
    const v = +vs;
    const rec = vmap[vs];
    if (!rec || !Array.isArray(rec.words) || !rec.words.length) continue;
    total++;
    const key = n + ':' + v;
    const text = verses[key];
    if (text == null) { bad.push(key + ' (no reference text)'); mismatched++; continue; }
    const spanCount = splitCount(n, v, text);
    if (spanCount === rec.words.length) aligned++;
    else { mismatched++; bad.push(key + ' (spans ' + spanCount + ', words ' + rec.words.length + ')'); }
  }
}

console.log('Word alignment, verse/*.json against /root/mushaf/quran-uthmani.json:');
console.log('  ' + total + ' written verses carry a words[] array');
console.log('  ' + aligned + ' align by count (the word sheet can map them span for span)');
console.log('  ' + mismatched + ' do not (the word sheet must fall through on these)');
if (bad.length) {
  console.log('  mismatches:');
  for (const b of bad.slice(0, 40)) console.log('    ' + b);
  if (bad.length > 40) console.log('    ... and ' + (bad.length - 40) + ' more');
}
