/* NOOR · fold a landing batch into the packs.
   Each language's file in /tmp/landing-out is a flat {hash: translation}.
   It is merged into i18n/text/<code>.json under .s, never replacing a
   string that is already there (the batch was built from what was missing,
   so an overlap would mean something moved under us and the older one wins).
   _meta.coverage is rewritten from the true size afterwards. */
import fs from 'node:fs';
const LANGS = ['ar','fr','es','de','ru','tr','ur','hi','bn','id','fa','prs','pa','ha','ku','ps','so','sw','zh','ja','ko'];
const rows = [];
for (const l of LANGS) {
  const add = JSON.parse(fs.readFileSync(`/tmp/landing-out/${l}.json`, 'utf8'));
  const path = `i18n/text/${l}.json`;
  const j = JSON.parse(fs.readFileSync(path, 'utf8'));
  const s = j.s || j;
  const before = Object.keys(s).length;
  let added = 0, kept = 0;
  for (const [k, v] of Object.entries(add)) {
    if (s[k] !== undefined) { kept++; continue; }
    s[k] = v; added++;
  }
  const after = Object.keys(s).length;
  j.s = s;
  j._meta = j._meta || { language: l };
  j._meta.coverage = { strings: after, of: after };
  fs.writeFileSync(path, JSON.stringify(j));
  rows.push([l, before, added, kept, after]);
}
console.log('lang   before   added  already   after');
rows.forEach(r => console.log(r[0].padEnd(6), String(r[1]).padStart(6), String(r[2]).padStart(7), String(r[3]).padStart(8), String(r[4]).padStart(7)));
console.log('\ntotal added:', rows.reduce((a, r) => a + r[2], 0));
