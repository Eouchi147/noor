// NOOR i18n pack assembler + validator
// Usage: node scripts/merge-pack.mjs <code>
// Merges i18n/tmp-<code>-p*.json parts into i18n/<code>.json,
// validates full key parity against en.json, ref integrity, and style bans.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = process.argv[2];
if (!code) { console.error('usage: node scripts/merge-pack.mjs <code>'); process.exit(1); }

const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n/en.json'), 'utf8'));
const dir = path.join(ROOT, 'i18n');
const parts = fs.readdirSync(dir).filter(f => f.startsWith(`tmp-${code}-p`) && f.endsWith('.json')).sort();
if (!parts.length) { console.error(`no parts found: i18n/tmp-${code}-p*.json`); process.exit(1); }

function deepMerge(a, b) {
  for (const k of Object.keys(b)) {
    if (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) && b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) deepMerge(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
}

const pack = {};
for (const f of parts) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
  catch (e) { console.error(`PARSE ERROR in ${f}: ${e.message}`); process.exit(1); }
  deepMerge(pack, j);
}
pack._meta = { language: code, source: false, base: 'en v49', note: 'Translation of the meaning; the Quran itself is only its Arabic.' };

const errs = [];
const cov = {};
function walk(e, p, trail, sec) {
  if (typeof e === 'string') {
    cov[sec].total++;
    if (p === undefined || p === null) return;            // not yet carried: English shows through
    if (typeof p !== 'string') { errs.push(`TYPE: ${trail}`); return; }
    cov[sec].done++;
    const key = trail.replace(/\[\d+\]/g, '').split('.').pop();
    if (key === 'ref' && p !== e) errs.push(`REF CHANGED: ${trail} "${e}" -> "${p}"`);
    if (/[\u2014\u2013]/.test(p)) errs.push(`DASH: ${trail}`);
    if (/[\u{1F300}-\u{1FAFF}]/u.test(p)) errs.push(`EMOJI: ${trail}`);
    return;
  }
  if (Array.isArray(e)) {
    if (p == null) { e.forEach((x, i) => walk(x, undefined, `${trail}[${i}]`, sec)); return; }
    if (!Array.isArray(p)) { errs.push(`NOT ARRAY: ${trail}`); return; }
    if (p.length !== e.length) { errs.push(`ARRAY LEN: ${trail} en=${e.length} got=${p.length}`); return; }
    e.forEach((x, i) => walk(x, p[i], `${trail}[${i}]`, sec));
    return;
  }
  if (e && typeof e === 'object') {
    if (p == null) { for (const k of Object.keys(e)) walk(e[k], undefined, `${trail}.${k}`, sec); return; }
    if (typeof p !== 'object') { errs.push(`NOT OBJ: ${trail}`); return; }
    for (const k of Object.keys(e)) walk(e[k], p[k], trail ? `${trail}.${k}` : k, sec);
  }
}
for (const sec of ['ui', 'nodes', 'characters', 'places', 'words']) {
  cov[sec] = { done: 0, total: 0 };
  walk(en[sec], pack[sec], sec, sec);
}
if (errs.length) {
  console.error(`FAILED: ${errs.length} problems. First 25:`);
  errs.slice(0, 25).forEach(e => console.error('  ' + e));
  process.exit(1);
}
const uiPct = Math.round(cov.ui.done / cov.ui.total * 100);
if (uiPct < 100) {
  console.error(`FAILED: the ui section must be 100% translated (it is the chrome of every page). Currently ${uiPct}% (${cov.ui.done}/${cov.ui.total}). Missing keys fall back to English, so finish ui first.`);
  const miss = [];
  for (const k of Object.keys(en.ui)) if (!pack.ui || typeof pack.ui[k] !== 'string') miss.push(k);
  console.error('  missing ui keys (first 30): ' + miss.slice(0, 30).join(', '));
  process.exit(1);
}
let dn = 0, tt = 0;
for (const sec of Object.keys(cov)) { dn += cov[sec].done; tt += cov[sec].total; }
pack._meta.coverage = { strings: dn, of: tt, percent: Math.round(dn / tt * 100) };
fs.writeFileSync(path.join(dir, `${code}.json`), JSON.stringify(pack, null, 1));
for (const f of parts) fs.unlinkSync(path.join(dir, f));
console.log(`OK ${code}.json written (${Math.round(fs.statSync(path.join(dir, `${code}.json`)).size / 1024)} KB) | ui 100% | overall ${Math.round(dn / tt * 100)}% (${dn}/${tt}) | ` +
  Object.keys(cov).map(k => `${k} ${Math.round(cov[k].done / cov[k].total * 100)}%`).join(' \u00b7 '));
