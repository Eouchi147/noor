// NOOR builder v3: applies content patches, renumbers, remaps and weaves links,
// scrubs every em/en dash (with a hard guard), validates the 4-way link graph,
// and regenerates nodes.js, characters.js, places.js, words.js.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);

// ---------- load pristine data ----------
const sb = {}; vm.createContext(sb);
vm.runInContext(read('.build-src/nodes.src.js') + ';this.__N=NODES;', sb);
let nodes = sb.__N;

const srcCharHtml = read('.build-src/characters.src.html');
const srcCharMatch = srcCharHtml.match(/const CHARACTERS = \{[\s\S]*?\n\};/);
if (!srcCharMatch) throw new Error('CHARACTERS block not found in source snapshot');
const sb2 = {}; vm.createContext(sb2);
vm.runInContext(srcCharMatch[0] + ';this.__C=CHARACTERS;', sb2);
let chars = sb2.__C;

// ---------- id remap (old → new) ----------
const MAP = {44:48,45:49,46:50,47:52,48:53,49:54,50:56,51:55,52:57,53:58,54:59,55:60,56:62,57:63,58:64};
const remapId = id => MAP[id] ?? id;
const remapText = t => String(t).replace(/\{\{n:(\d+)\|/g, (_, d) => `{{n:${remapId(+d)}|`);
nodes.forEach(n => {
  n.id = remapId(n.id);
  if (n.details) n.details = remapText(n.details);
  if (Array.isArray(n.connections)) n.connections = n.connections.map(remapId);
});
for (const k of Object.keys(chars)) chars[k].forEach(c => { if (c.details) c.details = remapText(c.details); });

// ---------- helpers ----------
function normHadith(h) {
  if (h == null) return null;
  if (typeof h === 'object') return { text: String(h.text||'').trim(), source: String(h.source||'').trim() };
  const s = String(h).trim();
  const m = s.match(/^(.*)\(([^()]{2,60})\)\s*$/s);
  if (m) return { text: m[1].trim(), source: m[2].trim() };
  return { text: s, source: '' };
}
function linkFirst(details, name, target) {
  if (!details || !name || !target) return details;
  const marker = target.startsWith('n:') ? `{{n:${target.slice(2)}|${name}}}`
              : /^\d+$/.test(target)     ? `{{n:${target}|${name}}}`
              : target.startsWith('p-')  ? `{{p:${target}|${name}}}`
              : target.startsWith('w-')  ? `{{w:${target}|${name}}}`
              :                            `{{c:${target}|${name}}}`;
  const parts = details.split(/(\{\{[^}]*\}\})/);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith('{{')) continue;
    const idx = parts[i].indexOf(name);
    if (idx !== -1) {
      parts[i] = parts[i].slice(0, idx) + marker + parts[i].slice(idx + name.length);
      return parts.join('');
    }
  }
  return details;
}

// ---------- apply node patches ----------
const patchFiles = ['bidaya-qisas.mjs','seerah.mjs','nihaya.mjs'];
let patches = [];
for (const f of patchFiles) patches = patches.concat((await import(path.join(ROOT,'scripts/patches',f))).default);
const byId = new Map(nodes.map(n => [n.id, n]));
for (const p of patches) {
  if (p.insert) {
    if (byId.has(p.id)) throw new Error(`insert collision id ${p.id}`);
    const n = { id: p.id, ...p.insert };
    nodes.push(n); byId.set(p.id, n);
  } else if (p.replace) {
    const n = byId.get(p.id); if (!n) throw new Error(`replace: no node ${p.id}`);
    Object.assign(n, p.replace);
  } else if (p.merge) {
    const n = byId.get(p.id); if (!n) throw new Error(`merge: no node ${p.id}`);
    const m = p.merge;
    if (m.metric) n.metric = m.metric;
    if (m.linkNames) for (const [name, tgt] of Object.entries(m.linkNames))
      if (tgt && !n.details.includes(`|${name}}}`)) n.details = linkFirst(n.details, name, tgt);
    const addTo = (key, items, keyFn) => {
      if (!items || !items.length) return;
      n[key] = n[key] || [];
      const have = new Set(n[key].map(keyFn));
      for (const it of items) if (!have.has(keyFn(it))) n[key].push(it);
    };
    addTo('hadith', (m.hadith||m.addHadith||[]).map(normHadith), h => (typeof h==='object'?h.text:String(h)).slice(0,40));
    addTo('facts', m.addFacts, f => f.label);
    addTo('lessons', m.addLessons, l => l);
    addTo('quran', m.addQuran, q => q.ref);
  }
}
nodes.forEach(n => { if (Array.isArray(n.hadith)) n.hadith = n.hadith.map(normHadith).filter(Boolean); });
nodes.sort((a,b) => a.id - b.id);

// ---------- apply character patches (base + v2 upgrades) ----------
const charPatchFiles = ['characters.mjs','characters-v2a.mjs','characters-v2b.mjs'];
for (const f of charPatchFiles) {
  const cp = (await import(path.join(ROOT,'scripts/patches',f))).default;
  for (const rid of cp.removeIds||[]) for (const k of Object.keys(chars)) chars[k] = chars[k].filter(c => c.id !== rid);
  for (const [cid, map] of Object.entries(cp.linkExisting||{})) {
    for (const k of Object.keys(chars)) {
      const c = chars[k].find(x => x.id === cid); if (!c) continue;
      for (const [name, tgt] of Object.entries(map)) if (tgt && !c.details.includes(`|${name}}}`)) c.details = linkFirst(c.details, name, tgt);
    }
  }
  for (const [cid, fields] of Object.entries(cp.replaceCharacters||{})) {
    let found = false;
    for (const k of Object.keys(chars)) {
      const c = chars[k].find(x => x.id === cid);
      if (c) { Object.assign(c, fields); found = true; break; }
    }
    if (!found) throw new Error(`replaceCharacters: no character ${cid}`);
  }
  for (const [section, list] of Object.entries(cp.addCharacters||{})) {
    chars[section] = chars[section] || [];
    const have = new Set(chars[section].map(c => c.id));
    for (const c of list) if (!have.has(c.id)) chars[section].push(c);
  }
}

// ---------- load places & words ----------
const places = (await import(path.join(ROOT,'scripts/patches/places.mjs'))).default;
const words = (await import(path.join(ROOT,'scripts/patches/words.mjs'))).default;

// ---------- weave place/word links into node prose (first plain occurrence) ----------
const NODE_WEAVE = {
  9:  {"Allah is sufficient for us, and the best Disposer of affairs":"w-hasbunallah"},
  11: {"Zamzam":"p-zamzam"},
  17: {"Tuwa":"p-tuwa"},
  20: {"the Mount":"p-tur"},
  22: {"Saba":"p-saba"},
  25: {"the Kaaba":"p-kaaba"},
  27: {"Zamzam":"p-zamzam"},
  28: {"cave of Hira":"p-hira"},
  29: {"Hira":"p-hira"},
  30: {"Ta'if":"p-taif"},
  33: {"cave of Thawr":"p-thawr","Do not grieve; indeed Allah is with us":"w-la-tahzan"},
  35: {"Quba":"p-quba"},
  37: {"Badr":"p-badr"},
  40: {"Hudaybiyyah":"p-hudaybiyyah"},
  41: {"Makkah":"p-makkah"},
  42: {"Hunayn":"p-hunayn"},
  43: {"Tabuk":"p-tabuk"},
  44: {"Arafat":"p-arafat"},
  59: {"Arafat":"p-arafat"},
  60: {"praised station":"w-adhan-dua"},
  61: {"traces of wudu":"w-subhan"},
  62: {"Subhan Allah wa bi-hamdih":"w-subhan"},
  63: {"Allahumma sallim, sallim":"w-sallim"}
};
for (const [nid, map] of Object.entries(NODE_WEAVE)) {
  const n = byId.get(+nid); if (!n) continue;
  for (const [name, tgt] of Object.entries(map))
    if (!n.details.includes(`|${name}}}`) && !n.details.includes(`{{p:${tgt}`) || !n.details.includes(tgt))
      n.details = linkFirst(n.details, name, tgt);
}

// ---------- targeted text fixes (kept legacy content) ----------
const TEXT_FIXES = [
  { find: "fulfilment", replace: "fulfillment" },
  { find: " at Lod", replace: " at Ludd" }
];
let fixHits = Object.fromEntries(TEXT_FIXES.map(f => [f.find, 0]));
function applyFixes(s) {
  if (typeof s !== 'string') return s;
  for (const f of TEXT_FIXES) if (s.includes(f.find)) { fixHits[f.find] += s.split(f.find).length - 1; s = s.split(f.find).join(f.replace); }
  return s;
}

// ---------- em/en dash scrub (context-aware; Arabic fields untouched) ----------
const SOURCE_WORD = /^(Bukhari|Muslim|Tirmidhi|Abu Dawud|Ibn Majah|Ahmad|Nasa'i|al-Hakim|Muwatta|cf\.|\d)/;
function scrubDashes(s) {
  if (typeof s !== 'string' || !/[—–]/.test(s)) return s;
  // 1. quote/citation attribution: ” — Bukhari 123  →  ” · Bukhari 123
  s = s.replace(/\s+—\s+(?=(Bukhari|Muslim|Tirmidhi|Abu Dawud|Ibn Majah|Ahmad|Nasa'i|al-Hakim|Muwatta|cf\.|\d+:\d))/g, ' · ');
  // 2. em dash introducing a quote or number → colon
  s = s.replace(/\s+—\s+(?=["“‘\d])/g, ': ');
  // 3. general spaced em dash → comma
  s = s.replace(/\s+—\s+/g, ', ');
  // 4. unspaced em dash → comma-space
  s = s.replace(/—/g, ', ');
  // 5. en dash: numeric ranges → hyphen; otherwise comma
  s = s.replace(/(\d)\s*–\s*(\d)/g, '$1-$2');
  s = s.replace(/\s*–\s*/g, ', ');
  // tidy artifacts
  s = s.replace(/ ,/g, ',').replace(/,{2,}/g, ',').replace(/,\s*,/g, ', ').replace(/  +/g, ' ');
  s = s.replace(/:\s*,/g, ': ').replace(/,\s*\./g, '.').replace(/,\s*:/g, ':');
  return s;
}
const SKIP_KEYS = new Set(['ar','titleAr']);
function walk(obj, fn) {
  if (Array.isArray(obj)) return obj.map(v => walk(v, fn));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = SKIP_KEYS.has(k) ? v : walk(v, fn);
    return out;
  }
  return typeof obj === 'string' ? fn(obj) : obj;
}
const pipeline = s => scrubDashes(applyFixes(s));
nodes = nodes.map(n => walk(n, pipeline));
for (const k of Object.keys(chars)) chars[k] = chars[k].map(c => walk(c, pipeline));
const placesClean = walk(places, pipeline);
const wordsClean = walk(words, pipeline);
if (fixHits['fulfilment'] === 0) console.warn('note: fulfilment fix found nothing (may already be fixed)');

// ---------- validation ----------
const nodeIds = new Set(nodes.map(n => n.id));
const charIds = new Set(Object.values(chars).flat().map(c => c.id));
const placeIds = new Set(Object.values(placesClean).flat().map(p => p.id));
const wordIds = new Set(Object.values(wordsClean).flat().map(w => w.id));
const errs = [];
if (nodes.length !== 64) errs.push(`expected 64 nodes, got ${nodes.length}`);
for (let i = 1; i <= 64; i++) if (!nodeIds.has(i)) errs.push(`missing node id ${i}`);
const order = ['bidaya','qisas','seerah','nihaya'];
let last = 0;
for (const n of nodes) {
  const oi = order.indexOf(n.period);
  if (oi < last) errs.push(`period out of order at node ${n.id}`);
  last = Math.max(last, oi);
}
const checkText = (owner, t) => {
  for (const m of String(t||'').matchAll(/\{\{(n|c|p|w):([^|}]+)\|/g)) {
    const [ , typ, id ] = m;
    if (typ === 'n' && !nodeIds.has(+id)) errs.push(`${owner}: dead node link ${id}`);
    if (typ === 'c' && !charIds.has(id)) errs.push(`${owner}: dead char link ${id}`);
    if (typ === 'p' && !placeIds.has(id)) errs.push(`${owner}: dead place link ${id}`);
    if (typ === 'w' && !wordIds.has(id)) errs.push(`${owner}: dead word link ${id}`);
  }
};
const checkAllStrings = (owner, obj) => {
  if (Array.isArray(obj)) return obj.forEach(v => checkAllStrings(owner, v));
  if (obj && typeof obj === 'object') return Object.entries(obj).forEach(([k,v]) => !SKIP_KEYS.has(k) && checkAllStrings(owner, v));
  if (typeof obj === 'string') checkText(owner, obj);
};
nodes.forEach(n => { checkAllStrings(`node ${n.id}`, n); (n.connections||[]).forEach(c => { if (!nodeIds.has(c)) errs.push(`node ${n.id}: dead connection ${c}`); }); });
Object.values(chars).flat().forEach(c => checkAllStrings(`char ${c.id}`, c));
Object.values(placesClean).flat().forEach(p => checkAllStrings(`place ${p.id}`, p));
Object.values(wordsClean).flat().forEach(w => checkAllStrings(`word ${w.id}`, w));
nodes.forEach(n => { if (n.image && !fs.existsSync(path.join(ROOT, n.image))) errs.push(`node ${n.id}: missing image ${n.image}`); });
if (errs.length) { console.error('VALIDATION ERRORS:\n' + errs.join('\n')); process.exit(1); }

// ---------- serializers ----------
const esc = s => String(s).replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$\{/g,'\\${');
const J = v => JSON.stringify(v);
function serNode(n) {
  const parts = [`id:${n.id}`, `period:${J(n.period)}`, `titleEn:${J(n.titleEn)}`, `titleAr:${J(n.titleAr)}`];
  if (n.metric) parts.push(`metric:${J(n.metric)}`);
  if (n.type) parts.push(`type:${J(n.type)}`);
  parts.push(`summary:${J(n.summary)}`, `pattern:${J(n.pattern)}`);
  if (n.image) parts.push(`image:${J(n.image)}`);
  let s = '{' + parts.join(',') + ',\ndetails:`' + esc(n.details) + '`';
  if (n.sequence) s += ',\nsequence:' + J(n.sequence);
  for (const [key, arr] of [['timeline',n.timeline],['protection',n.protection],['quran',n.quran],['hadith',n.hadith],['lessons',n.lessons]])
    if (arr && arr.length) s += `,\n${key}:[\n` + arr.map(x => ' ' + J(x)).join(',\n') + ']';
  if (n.connections && n.connections.length) s += ',\nconnections:' + J(n.connections);
  if (n.facts && n.facts.length) s += ',\nfacts:[\n' + n.facts.map(f => ' ' + J(f)).join(',\n') + ']';
  return s + '}';
}
function serEntry(c) {
  const keys = ['id','titleEn','titleAr','translit','meaning','role','summary','pattern'];
  const parts = keys.filter(k => c[k] != null).map(k => `${k}:${J(c[k])}`);
  let s = '{' + parts.join(',') + ',\ndetails:`' + esc(c.details||'') + '`';
  for (const [key, arr] of [['whenNow',c.whenNow],['facts',c.facts],['quran',c.quran],['hadith',c.hadith]])
    if (arr && arr.length) s += `,\n${key}:[` + arr.map(x => J(x)).join(',\n ') + ']';
  return s + '}';
}
const serGroup = (name, obj, sections) => `const ${name} = {\n` + sections.map(k => k + ': [\n' + (obj[k]||[]).map(serEntry).join(',\n\n') + '\n]').join(',\n\n') + '\n};\n';

const charSections = ['companions','angels','jinn','animals','endtime'];
const placeSections = ['sanctuaries','mountains','cities','waters','endtimes'];
const wordSections = ['verses'];
const totalChars = Object.values(chars).flat().length;
const totalPlaces = Object.values(placesClean).flat().length;
const totalWords = Object.values(wordsClean).flat().length;
const totalQuran = nodes.reduce((a,n)=>a+((n.quran||[]).length),0);
const totalHadith = nodes.reduce((a,n)=>a+((n.hadith||[]).length),0);
const meta = `const NOOR_META={nodes:${nodes.length},characters:${totalChars},places:${totalPlaces},words:${totalWords},quran:${totalQuran},hadith:${totalHadith}};\n`;

const nodesOut = '// NOOR Codex, ' + nodes.length + ' nodes · Kun Fayakun → Jannah\n// Generated by scripts/build.mjs. Edit scripts/patches/* then re-run: node scripts/build.mjs\n' + meta + 'const NODES = [\n' + nodes.map(serNode).join(',\n\n') + '\n];\n';
const charsOut = '// NOOR Characters, generated by scripts/build.mjs\n' + serGroup('CHARACTERS', chars, charSections);
const placesOut = '// NOOR Places, generated by scripts/build.mjs\n' + serGroup('PLACES', placesClean, placeSections);
const wordsOut = '// NOOR Words of the Path, generated by scripts/build.mjs\n' + serGroup('WORDS', wordsClean, wordSections);

// ---------- em/en dash hard guard on generated output ----------
for (const [name, out] of [['nodes.js',nodesOut],['characters.js',charsOut],['places.js',placesOut],['words.js',wordsOut]]) {
  if (/[—–]/.test(out)) {
    const i = out.search(/[—–]/);
    console.error(`DASH GUARD: ${name} still contains a dash near: …${out.slice(Math.max(0,i-70), i+70)}…`);
    process.exit(1);
  }
}
write('nodes.js', nodesOut);
write('characters.js', charsOut);
write('places.js', placesOut);
write('words.js', wordsOut);

// ---------- stats ----------
const wc = s => String(s||'').replace(/\{\{[^}]+\}\}/g,' x ').split(/\s+/).filter(Boolean).length;
console.log(`NODES: ${nodes.length} · words ${nodes.reduce((a,n)=>a+wc(n.details),0)} · min ${Math.min(...nodes.map(n=>wc(n.details)))}`);
console.log('CHARACTERS:', charSections.map(k => `${k}:${(chars[k]||[]).length}`).join(' '), '· total', totalChars,
  '· min words', Math.min(...Object.values(chars).flat().map(c=>wc(c.details))));
console.log('PLACES:', placeSections.map(k => `${k}:${(placesClean[k]||[]).length}`).join(' '), '· total', totalPlaces);
console.log('WORDS:', totalWords, '· fixes:', JSON.stringify(fixHits));
console.log('bytes:', ['nodes.js','characters.js','places.js','words.js'].map(f => f+':'+fs.statSync(path.join(ROOT,f)).size).join(' '));
