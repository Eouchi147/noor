/* NOOR · every narration names where it can be found, and names it one way.
   ------------------------------------------------------------------
   OPERATIONS.md, section 10: a wrong hadith number is worse than no note.
   The audit of 15 September found the house citing the same sentence under
   different numbers in two rooms (content-001), 26 prophet narrations and a
   dozen chapter ones with no number at all or a blank source, and four
   Qur'an verses filed as narrations (content-002). All of them were checked
   against the collections on sunnah.com and corrected on 22 September. This
   holds the line so the next edit cannot quietly undo it.

   Run:  node tests/citations.mjs
*/
import fs from 'fs';
import vm from 'vm';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const load = (file, expr) => { const sb = { window: {} }; vm.createContext(sb); vm.runInContext(fs.readFileSync(file, 'utf8') + ';this.__X=' + expr + ';', sb); return sb.__X; };
const rows = [];   /* { where, text, src } */
for (const p of load('prophets-data.js', 'window.NOOR_PROPHETS')) (p.hadith || []).forEach((h, i) => rows.push({ where: 'prophet ' + p.id + '[' + i + ']', text: h.text, src: h.src || '' }));
for (const f of fs.readdirSync('node').filter(f => /^\d+\.json$/.test(f))) {
  const d = JSON.parse(fs.readFileSync('node/' + f, 'utf8'));
  (d.hadith || []).forEach((h, i) => rows.push({ where: 'chapter ' + d.id + '[' + i + ']', text: typeof h === 'string' ? h : h.text, src: typeof h === 'string' ? '' : (h.source || '') }));
}
for (const [file, name] of [['characters.js', 'CHARACTERS'], ['places.js', 'PLACES']]) {
  const all = load(file, name);
  for (const list of Object.values(all)) for (const e of (Array.isArray(list) ? list : [])) (e.hadith || []).forEach((h, i) => rows.push({ where: file + ' ' + e.id + '[' + i + ']', text: h.text, src: h.source || '' }));
}
console.log('\n' + rows.length + ' narrations read');

console.log('\nevery narration names a source');
{
  const blank = rows.filter(r => !String(r.src).trim());
  ok(!blank.length, 'no narration carries a blank source' + (blank.length ? ': ' + blank.map(r => r.where).join(', ') : ''));
  const verses = rows.filter(r => /^\s*(Qur'?an|Quran)\s+\d+:\d+/i.test(r.src));
  ok(!verses.length, 'no Qur’an verse is filed as a narration; verses live in quran[]' + (verses.length ? ': ' + verses.map(r => r.where).join(', ') : ''));
}

console.log('\nthe prophets’ narrations are numbered');
{
  const pr = rows.filter(r => r.where.startsWith('prophet '));
  const bare = pr.filter(r => !/\d/.test(r.src));
  ok(pr.length >= 26 && !bare.length, pr.length + ' prophet narrations, every one with a number' + (bare.length ? '; missing: ' + bare.map(r => r.where).join(', ') : ''));
}

console.log('\none text, one citation');
{
  /* the audit's own rule (xc-10): two entries whose words overlap by 0.6 or
     more are the same narration, and their collection numbers must share at
     least one reference. A different number for the same sentence is the
     fault this file exists to stop. */
  const words = t => new Set(String(t || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length > 2));
  const refs = s => new Set((String(s).match(/(Bukhari|Muslim|Tirmidhi|Majah|Dawud|Nasa'?i|Ahmad|Adab|Tabarani)[^0-9]{0,24}\d+/gi) || [])
    .map(x => x.replace(/^(\w+).*?(\d+)$/, (m, c, n) => c.toLowerCase().replace(/[^a-z]/g, '') + ' ' + n)));
  const jac = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };
  const clash = [];
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const A = rows[i], B = rows[j];
    const wa = words(A.text), wb = words(B.text);
    if (wa.size < 5 || wb.size < 5 || jac(wa, wb) < 0.6) continue;
    const ra = refs(A.src), rb = refs(B.src);
    if (!ra.size || !rb.size) continue;
    if (![...ra].some(x => rb.has(x))) clash.push(A.where + ' (' + A.src + ') against ' + B.where + ' (' + B.src + ')');
  }
  ok(!clash.length, 'no sentence is cited under disjoint numbers anywhere in the library' + (clash.length ? ':\n      ' + clash.join('\n      ') : ''));
}

console.log('\nthe three resolved in September stay resolved');
{
  const has = (needle, src) => rows.some(r => r.text && r.text.includes(needle) && r.src.includes(src));
  const hasNot = (needle, src) => !rows.some(r => r.text && r.text.includes(needle) && r.src.includes(src));
  ok(has('Highest Companion', 'Bukhari 4586') && hasNot('Highest Companion', 'Bukhari 4463'), 'the deathbed words: Bukhari 4586 and 4438, never 4463');
  ok(has('feed food', 'Ibn Majah 3251') && hasNot('feed food', 'Ibn Majah 1334'), 'spread salam, feed food: Ibn Majah 3251, the narration that carries all four clauses');
  ok(has('give the banner', 'Muslim 2406') && hasNot('give the banner', '3701'), 'the banner at Khaybar: the narration that carries both loves, in every room');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
