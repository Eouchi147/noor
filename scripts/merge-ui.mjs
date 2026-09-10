/* NOOR · fold a chrome batch into the UI packs.
   /tmp/ui-out/<code>.json is {key: translation} for the keys that language
   was missing. It is merged into i18n/<code>.json under .ui, never replacing
   a key that is already there. */
import fs from 'node:fs';
const LANGS = ['ar','fr','es','de','ru','tr','ur','hi','bn','id','fa','prs','pa','ha','ku','ps','so','sw','zh','ja','ko'];
const rows = [];
for (const l of LANGS) {
  let add;
  try { add = JSON.parse(fs.readFileSync(`/tmp/ui-out/${l}.json`, 'utf8')); }
  catch (e) { rows.push([l, '-', 'no batch', '-']); continue; }
  const path = `i18n/${l}.json`;
  const j = JSON.parse(fs.readFileSync(path, 'utf8'));
  j.ui = j.ui || {};
  const before = Object.keys(j.ui).length;
  let added = 0;
  for (const [k, v] of Object.entries(add)) if (j.ui[k] === undefined || j.ui[k] === '') { j.ui[k] = v; added++; }
  fs.writeFileSync(path, JSON.stringify(j));
  rows.push([l, before, added, Object.keys(j.ui).length]);
}
console.log('lang   before  added   after');
rows.forEach(r => console.log(r[0].padEnd(6), String(r[1]).padStart(6), String(r[2]).padStart(6), String(r[3]).padStart(7)));
