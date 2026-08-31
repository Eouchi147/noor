/* NOOR · the Ninety-Nine Names guard.
   ------------------------------------------------------------------
   Every verse cited in allah.html was checked, once, against the full text of
   the Qur'an: the verse exists, the Arabic shown is a contiguous run of words
   from that verse, and the word the entry claims is there is actually there.
   That check needs the whole corpus, so it does not live in the repo.

   What lives here is the shape it left behind. If someone edits an entry by
   hand and breaks it, this fails -- so a broken entry cannot reach the site
   quietly, the way a wrong hadith number once could.

   Run:  node tests/names.mjs
*/
import fs from 'fs';

const html = fs.readFileSync(new URL('../allah.html', import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL ' + m)); };

const start = html.indexOf('const NAMES = [');
if (start < 0) { console.log('FAIL: no NAMES array'); process.exit(1); }
const end = html.indexOf('\n];', start) + 3;
const NAMES = new Function(html.slice(start, end) + '\nreturn NAMES;')();

ok(NAMES.length === 99, 'there are 99 names, found ' + NAMES.length);

const REF = /^\d{1,3}:\d{1,3}$/;
const ARABIC = /[ء-ي]/;
/* anything that looks like a hadith number: this room cites the Qur'an only,
   because the Qur'an is the part that can be checked to the letter. */
const UNVERIFIABLE = /(bukhari|muslim\s*\d|tirmidhi\s*\d|ibn\s+majah\s*\d|abu\s+dawud\s*\d|hadith\s*(no\.?|#)|\bno\.\s*\d+)/i;

let inQuran = 0, fromList = 0;
NAMES.forEach((row, i) => {
  const n = i + 1;
  const [ar, tr, gloss, x] = row;
  ok(ARABIC.test(ar), n + ': the name is written in Arabic');
  ok(tr && tr.length > 2, n + ': has a transliteration');
  ok(gloss && gloss.length > 3, n + ': has a one-line gloss');   // "The One" is a whole gloss
  ok(Array.isArray(x) && x.length === 8, n + ': has the expansion, 8 fields');
  if (!Array.isArray(x) || x.length !== 8) return;
  const [rootAr, rootEn, meaning, ref, verseAr, verseEn, source, asks] = x;
  ok(ARABIC.test(rootAr), n + ': the root is written in Arabic');
  ok(rootEn.length > 12, n + ': the root is glossed');
  ok(meaning.split(/\s+/).length >= 60, n + ': the meaning is at least 60 words');
  ok(REF.test(ref), n + ': the reference reads surah:ayah, got ' + ref);
  ok(+ref.split(':')[0] >= 1 && +ref.split(':')[0] <= 114, n + ': the surah is 1-114');
  ok(ARABIC.test(verseAr) && verseAr.length > 6, n + ': the verse is shown in Arabic');
  ok(verseEn.split(/\s+/).length >= 2, n + ': the verse is rendered in English');
  ok(source === 0 || source === 1, n + ': the attestation is 0 or 1');
  ok(asks.split(/\s+/).length >= 12, n + ': says what the Name asks');
  ok(!UNVERIFIABLE.test(meaning + ' ' + asks + ' ' + rootEn),
     n + ': makes no citation this room cannot check');
  source ? fromList++ : inQuran++;
});

/* the note in the room states these two numbers to the reader */
ok(inQuran === 74, 'the room says 74 names are used of God in the Qur’an, data says ' + inQuran);
ok(fromList === 25, 'the room says 25 come through the enumeration, data says ' + fromList);
ok(/Seventy-four of them are/.test(html), 'the note still states the count in words');

/* the panel has somewhere to put all of it */
['p-rc','p-rg','p-d','p-va','p-ve','p-vr','p-vs','p-w','p-n'].forEach(id => {
  ok((html.match(new RegExp('id="' + id + '"', 'g')) || []).length === 1,
     'the panel has exactly one #' + id);
});
/* .ayah already means something else on this page; the verse box must not use it */
ok(!/<figure class="ayah">/.test(html), 'the verse box does not reuse the .ayah class');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
