/* NOOR · the seerah room's citations.
   ------------------------------------------------------------------
   Every hadith number on muhammad.html was opened on sunnah.com and read at
   source. Twelve of them did not say what the page said they said:

     · Bukhari 112     the elephant hadith, with a second sentence spliced in
                       from Bukhari 104 / Muslim 1354. Bukhari 112's own word
                       is "the killing", not "the elephant".
     · Bukhari 3906    Suraqah's safety ran the wrong way: he offered it, and
                       the text does not say he kept their secret.
     · Muslim 1399     never mentions Saturday; Bukhari 1193 never mentions the
                       two rak'ahs. The page had fused them into one sentence.
     · Ibn Majah 1334  does not contain "keep the ties of kinship", and carries
                       no grading on sunnah.com, so "sahih" was unsupported.
     · Muslim 2444     supports neither half of the last words.
     · Bukhari 428     says the opposite of the claim made from it: Banu
                       an-Najjar refused payment.
     · Muslim 285      does not contain "sent to make things easy".
     · Ahmad 22211     and Ahmad 8952 are real, but sit in the unpublished part
                       of the Musnad, so they could not be opened and checked.
     · Muslim 725      is the sunnah of Fajr, prayed after dawn, not before it.
     · Bukhari 6314    has the hand under the cheek; the right side is 6315.
     · Muslim 1162 / 162 land on the wrong sub-narration at the bare number.
     · the night journey carried no number at all, though the two standard
                       Mi'raj narrations differ and only one has that line.

   This holds the corrections in place.

   Run:  node tests/seerah.mjs
*/
import fs from 'fs';
const html = fs.readFileSync(new URL('../muhammad.html', import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL ' + m)); };

const grab = name => {
  const i = html.indexOf('const ' + name + ' = [');
  if (i < 0) return null;
  return new Function(html.slice(i, html.indexOf('\n];', i) + 3) + '\nreturn ' + name + ';')();
};
const STATIONS = grab('STATIONS'), WITNESSES = grab('WITNESSES'),
      CASES = grab('CASES'), HABITS = grab('HABITS');
ok(STATIONS && STATIONS.length === 21, 'the twenty-one stations are all there');
ok(WITNESSES && WITNESSES.length === 6, 'the witnesses are all there');
ok(CASES && CASES.length === 9, 'the nine cases are all there');
ok(HABITS && HABITS.length === 8, 'the habits are all there');

/* everything with a number, wherever it lives on the page */
const cites = [
  ...(STATIONS || []).map(r => r[7]),
  ...(WITNESSES || []).map(r => r[2]),
  ...(CASES || []).map(r => r[4]),
  ...(HABITS || []).map(r => r[4]),
  ...(html.match(/<p class="ref">([^<]*)<\/p>/g) || []).map(s => s.replace(/<[^>]+>/g, ''))
].filter(Boolean).map(s => s.replace(/&middot;/g, '·').trim());

/* a citation either carries a collection and a number, or says plainly that it
   is from the sirah, or names the Qur'an. Nothing else is allowed. */
/* a collection, a number, and optionally a plain-words tail after a comma
   ("Bukhari 3, from Aisha") -- the number is what has to be there */
const NUMBERED = /^(Sahih al-Bukhari|Sahih Muslim|Bukhari|Muslim|Jami' at-Tirmidhi|Tirmidhi|Sunan Abu Dawud|Abu Dawud|Sunan an-Nasa'i|Nasa'i|Sunan Ibn Majah|Ibn Majah|al-Adab al-Mufrad)\s+\d{1,5}[a-z]?(,\s+[^,]+)?$/;
const PROSE = /sirah|Qur'an|Musnad Ahmad|revealed after|recited at|hadith literature/i;
for (const c of cites) {
  const parts = c.split('·').map(x => x.trim()).filter(Boolean);
  const good = parts.every(p => NUMBERED.test(p) || PROSE.test(p) || /graded sahih/.test(p) || /^from Aisha$/.test(p));
  ok(good, 'citation is either numbered or plainly unnumbered: "' + c + '"');
}

console.log('');
/* the twelve corrections, named, so none of them can quietly come back */
const gone = [
  ['Muslim 2444', 'the last words no longer rest on Muslim 2444'],
  ['Ahmad 22211', 'no number is given for the part of the Musnad that cannot be opened'],
  ['Ahmad 8952', 'nor for the other one'],
  ['Ibn Majah 1334', 'the four-part hadith is no longer cited to Ibn Majah 1334'],
  ['Muslim 285', '"make things easy" is no longer attributed to Muslim'],
  ['Muslim 1399', 'the Quba report no longer fuses two narrations'],
  ['Bukhari 112', 'the elephant hadith no longer rests on Bukhari 112'],
];
for (const [needle, msg] of gone) {
  const hits = cites.filter(c => c.includes(needle));
  ok(hits.length === 0, msg + ' (still in: ' + hits.join(' / ') + ')');
}
ok(!/["']He bought the ground for the masjid from two orphan boys/.test(html),
   'the orphans claim is no longer made from Bukhari 428');
ok(!/two rak'ahs before dawn/.test(html), 'the Fajr sunnah is no longer called "before dawn"');
ok(!/its sanctity yesterday/i.test(html), 'the spliced sentence is gone from the elephant hadith');
ok(!/turned back and kept their secret/.test(html), 'Suraqah no longer keeps a secret the text does not mention');

const present = [
  ['Bukhari 349', 'the night journey carries a number now'],
  ['Bukhari 4438', 'the last words carry the narration that actually has them'],
  ['Bukhari 6315', 'sleeping on the right side is cited where it is written'],
  ['Bukhari 1194', 'the two rak\'ahs at Quba are cited where they are written'],
  ['Ibn Majah 3251', 'the four-part hadith is cited where all four parts are'],
  ['Muslim 1162e', 'the Monday narration points at the right sub-narration'],
  ['Muslim 162c', 'and so does the chest-splitting one'],
];
for (const [needle, msg] of present) ok(html.includes(needle), msg);

console.log('');
ok(!/class="draft"/.test(html), 'the draft badge is gone');
ok(/opened on sunnah\.com and read at the number given/.test(html),
   'and the page says instead what was actually checked');
ok(/send it to us/.test(html), 'and gives the reader a way to report an error');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
