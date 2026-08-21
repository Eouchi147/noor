// NOOR builder v3: applies content patches, renumbers, remaps and weaves links,
// scrubs every em/en dash (with a hard guard), validates the 4-way link graph,
// and regenerates nodes.js, characters.js, places.js, words.js.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLARITY_FIXES } from './patches/clarity-v5.mjs';

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

// ---------- v4: 64 → 71 shift (open Books 3, 5, 6) ----------
// ids 25-45 shift +1 (Hunafa inserted at 25); ids 46-64 shift +7 (4 Khulafa + 2 Umam + the +1)
const shiftId = id => (id >= 46 ? id + 7 : id >= 25 ? id + 1 : id);
const shiftText = t => String(t).replace(/\{\{n:(\d+)\|/g, (_, d) => `{{n:${shiftId(+d)}|`);
nodes.forEach(n => {
  n.id = shiftId(n.id);
  if (n.details) n.details = shiftText(n.details);
  if (Array.isArray(n.connections)) n.connections = n.connections.map(shiftId);
});
const shiftDataset = obj => { for (const k of Object.keys(obj)) obj[k] = obj[k].map(e => walkText(e, shiftText)); };
function walkText(obj, fn) {
  if (Array.isArray(obj)) return obj.map(v => walkText(v, fn));
  if (obj && typeof obj === 'object') { const o = {}; for (const [k,v] of Object.entries(obj)) o[k] = k==='ar'||k==='titleAr' ? v : walkText(v, fn); return o; }
  return typeof obj === 'string' ? fn(obj) : obj;
}
for (const k of Object.keys(chars)) chars[k] = chars[k].map(e => walkText(e, shiftText));
shiftDataset(places); shiftDataset(words);

const v4 = (await import(path.join(ROOT,'scripts/patches/books-v4.mjs'))).default;
const byId2 = new Map(nodes.map(n => [n.id, n]));
for (const [nid, period] of Object.entries(v4.periodMoves)) {
  const n = byId2.get(+nid); if (!n) throw new Error(`periodMove: no node ${nid}`);
  n.period = period;
}
for (const p of v4.nodes) {
  if (byId2.has(p.id)) throw new Error(`v4 insert collision ${p.id}`);
  const n = { id: p.id, ...p.insert };
  nodes.push(n); byId2.set(p.id, n);
}
nodes.sort((a,b) => a.id - b.id);
nodes.forEach(n => { if (Array.isArray(n.hadith)) n.hadith = n.hadith.map(normHadith).filter(Boolean); });

// ---------- weave place/word links into node prose (final 71-id space) ----------
const NODE_WEAVE = {
  9:  {"Allah is sufficient for us, and the best Disposer of affairs":"w-hasbunallah"},
  11: {"Zamzam":"p-zamzam"},
  17: {"Tuwa":"p-tuwa"},
  20: {"the Mount":"p-tur"},
  22: {"Saba":"p-saba"},
  26: {"the Kaaba":"p-kaaba"},
  28: {"Zamzam":"p-zamzam"},
  29: {"cave of Hira":"p-hira"},
  30: {"Hira":"p-hira"},
  31: {"Ta'if":"p-taif"},
  34: {"cave of Thawr":"p-thawr","Do not grieve; indeed Allah is with us":"w-la-tahzan"},
  36: {"Quba":"p-quba"},
  38: {"Badr":"p-badr"},
  41: {"Hudaybiyyah":"p-hudaybiyyah"},
  42: {"Makkah":"p-makkah"},
  43: {"Hunayn":"p-hunayn"},
  44: {"Tabuk":"p-tabuk"},
  45: {"Arafat":"p-arafat"},
  66: {"Arafat":"p-arafat"},
  67: {"praised station":"w-adhan-dua"},
  68: {"traces of wudu":"w-subhan"},
  69: {"Subhan Allah wa bi-hamdih":"w-subhan"},
  70: {"Allahumma sallim, sallim":"w-sallim"}
};
for (const [nid, map] of Object.entries(NODE_WEAVE)) {
  const n = byId2.get(+nid); if (!n) continue;
  for (const [name, tgt] of Object.entries(map))
    if (!n.details.includes(`|${name}}}`)) n.details = linkFirst(n.details, name, tgt);
}

// ---------- AUTOLINK: every recognizable name becomes a click (first occurrence, details only) ----------
// Longest-first; word-boundary aware (apostrophes allowed inside names); skips self and existing markers.
const AUTOLINK = {
  // full-form people first (protects the short forms below)
  "Uthman ibn Talha":"c-uthman-talha","Khalid ibn al-Walid":"c-khalid","Talha ibn Ubaydillah":"c-talha",
  "Sa'd ibn Abi Waqqas":"c-saad","Sa'd ibn Mu'adh":"c-saad-muadh","Sa'id ibn Zayd":"c-said-zayd",
  "Abdullah ibn Salam":"c-ibnsalam","Amr ibn al-As":"c-amr","Mu'adh ibn Jabal":"c-muadh",
  "Zayd ibn Thabit":"c-zaydthabit","Ubayy ibn Ka'b":"c-ubayy","Ka'b ibn Malik":"c-kab",
  "Abd ar-Rahman ibn Awf":"c-abdurrahman","Hind bint Utbah":"c-hind","Zaynab bint Jahsh":"c-zaynab",
  "Safiyyah bint Huyayy":"c-safiyyah","Abu Ubaydah":"c-abu-ubaydah","Abu Sufyan":"c-abusufyan",
  "Umm Salamah":"c-umm-salamah","Umm Ayman":"c-ummayman","Abu Hurayrah":"c-abuhurayrah",
  "Ibn Abbas":"c-ibnabbas","Ibn Mas'ud":"c-ibnmasud","Ibn Umar":"c-ibnumar","Abu Dharr":"c-abudharr",
  "Abu Ayyub":"c-abuayyub","al-Hasan":"c-hasan","al-Husayn":"c-husayn","az-Zubayr":"c-zubayr",
  "Abu Bakr":"c-abubakr","Nu'aym ibn Mas'ud":"c-nuaym",
  // short-form people
  "Khadijah":"c-khadijah","Aisha":"c-aisha","Hamza":"c-hamza","Bilal":"c-bilal","Salman":"c-salman",
  "Umar":"c-umar","Uthman":"c-uthman","Ali":"c-ali","Fatimah":"c-fatimah","Zubayr":"c-zubayr",
  "Mus'ab":"c-musab","Hudhayfah":"c-hudhayfah","Usama":"c-usama","Hafsah":"c-hafsah","Ikrimah":"c-ikrimah",
  "Waraqah":"c-waraqah","Wahshi":"c-wahshi","Suhayl":"c-suhayl","Ja'far":"c-jafar","Ammar":"c-ammar",
  "Sumayyah":"c-sumayyah","Hanzala":"c-hanzala","Asma":"c-asma","Khalid":"c-khalid",
  // unseen & end-time
  "Jibril":"a-jibril","Israfil":"a-israfil","Iblis":"j-iblis","Buraq":"an-buraq",
  "Dajjal":"e-dajjal","al-Mahdi":"e-mahdi","Jassasah":"e-jassasa",
  // prophets → their chapters
  "Adam":"2","Hawwa":"3","Idris":"5","Nuh":"6","Ibrahim":"9","Yusuf":"12","Musa":"15","Dawud":"21",
  "Sulayman":"22","Isa":"23","Yunus":"an-yunus",
  // events → chapters (final ids)
  "Isra":"32","Hijrah":"34","Badr":"38","Uhud":"39","Khandaq":"40","Hudaybiyyah":"41","Hunayn":"43","Tabuk":"44",
  // places
  "Makkah":"p-makkah","Madinah":"p-madinah","Ta'if":"p-taif","Zamzam":"p-zamzam","Kaaba":"p-kaaba",
  "al-Aqsa":"p-aqsa","al-Quds":"p-jerusalem","Jerusalem":"p-jerusalem","Arafat":"p-arafat","Mina":"p-mina",
  "Tuwa":"p-tuwa","at-Tur":"p-tur","Madyan":"p-madyan","Babylon":"p-babylon","Egypt":"p-egypt",
  "Nile":"p-nile","Tiberias":"p-tiberias","Euphrates":"p-euphrates","Ludd":"p-ludd","Quba":"p-quba",
  "Hira":"p-hira","Thawr":"p-thawr","Khaybar":"p-khaybar","Hudaybiyyah camp":"p-hudaybiyyah"
};
const AUTOKEYS = Object.keys(AUTOLINK).sort((a,b) => b.length - a.length);
const isWordChar = ch => /[A-Za-z'’-]/.test(ch || "");
function autolink(details, selfId) {
  if (!details) return details;
  const linked = new Set([...details.matchAll(/\{\{(?:n|c|p|w):([^|}]+)\|/g)].map(m => m[1]));
  for (const name of AUTOKEYS) {
    const target = AUTOLINK[name];
    const normT = /^\d+$/.test(target) ? target : target;
    if (target === selfId || String(target) === String(selfId)) continue;
    if (linked.has(String(target))) continue;
    // search outside existing markers
    const parts = details.split(/(\{\{[^}]*\}\})/);
    let done = false;
    for (let i = 0; i < parts.length && !done; i++) {
      if (parts[i].startsWith('{{')) continue;
      let idx = -1, from = 0;
      while ((idx = parts[i].indexOf(name, from)) !== -1) {
        const before = parts[i][idx-1], after = parts[i][idx+name.length];
        if (!isWordChar(before) && !isWordChar(after)) {
          const marker = /^\d+$/.test(target) ? `{{n:${target}|${name}}}`
            : target.startsWith('p-') ? `{{p:${target}|${name}}}`
            : target.startsWith('w-') ? `{{w:${target}|${name}}}`
            : `{{c:${target}|${name}}}`;
          parts[i] = parts[i].slice(0, idx) + marker + parts[i].slice(idx + name.length);
          linked.add(String(target)); done = true; break;
        }
        from = idx + 1;
      }
    }
    if (done) details = parts.join('');
  }
  return details;
}
nodes.forEach(n => { n.details = autolink(n.details, String(n.id)); });
for (const k of Object.keys(chars)) chars[k].forEach(c => { c.details = autolink(c.details, c.id); });
for (const k of Object.keys(places)) places[k].forEach(p => { p.details = autolink(p.details, p.id); });
for (const k of Object.keys(words)) words[k].forEach(w => { w.details = autolink(w.details, w.id); });

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
nodes.forEach(n => { n.titleEn = String(n.titleEn).replace(/\s+—\s+/, ': '); });   // titles read as "Name: subtitle"
const pipeline = s => scrubDashes(applyFixes(s));
nodes = nodes.map(n => walk(n, pipeline));
for (const k of Object.keys(chars)) chars[k] = chars[k].map(c => walk(c, pipeline));
let placesClean = walk(places, pipeline);
let wordsClean = walk(words, pipeline);
if (fixHits['fulfilment'] === 0) console.warn('note: fulfilment fix found nothing (may already be fixed)');

// ---------- v5 clarity pass (owner audit: bureaucratic metaphors, garbled lines) ----------
// CLARITY_FIXES is pre-sorted longest-find-first; every entry MUST apply at least once.
const clarityHits = new Map(CLARITY_FIXES.map(f => [f.find, 0]));
const applyClarity = s => {
  if (typeof s !== 'string') return s;
  for (const f of CLARITY_FIXES) if (s.includes(f.find)) {
    clarityHits.set(f.find, clarityHits.get(f.find) + s.split(f.find).length - 1);
    s = s.split(f.find).join(f.replace);
  }
  return s;
};
nodes = nodes.map(n => walk(n, applyClarity));
for (const k of Object.keys(chars)) chars[k] = chars[k].map(c => walk(c, applyClarity));
placesClean = walk(placesClean, applyClarity);
wordsClean = walk(wordsClean, applyClarity);
const clarityMisses = [...clarityHits].filter(([, n]) => n === 0).map(([f]) => f.slice(0, 80));
if (clarityMisses.length) {
  console.error(`CLARITY PASS: ${clarityMisses.length} fix(es) matched nothing:\n` + clarityMisses.join('\n'));
  process.exit(1);
}
const clarityTotal = [...clarityHits.values()].reduce((a, b) => a + b, 0);
console.log(`clarity pass: ${CLARITY_FIXES.length} fixes, ${clarityTotal} application(s)`);

// ---------- validation ----------
const nodeIds = new Set(nodes.map(n => n.id));
const charIds = new Set(Object.values(chars).flat().map(c => c.id));
const placeIds = new Set(Object.values(placesClean).flat().map(p => p.id));
const wordIds = new Set(Object.values(wordsClean).flat().map(w => w.id));
const errs = [];
if (nodes.length !== 71) errs.push(`expected 71 nodes, got ${nodes.length}`);
for (let i = 1; i <= 71; i++) if (!nodeIds.has(i)) errs.push(`missing node id ${i}`);
const order = ['bidaya','qisas','jahiliyyah','seerah','khulafa','umam','nihaya'];
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
// ---------- the split: a light index, and one file per node ----------
// nodes.js carries every node's full record and had grown to 329KB, downloaded
// by every visitor to the homepage although the detail prose is only read when
// somebody opens a node. The list needs nine fields; the rest is fetched on
// demand from node/<id>.json. nodes.js is still written, because it is the
// browsable source of truth and other tooling reads it.
{
  const LIGHT = ['id','period','titleEn','titleAr','metric','type','summary','pattern','image'];
  const light = nodes.map(n => {
    const o = {}; for (const k of LIGHT) if (n[k] !== undefined) o[k] = n[k]; return o;
  });
  const idx = "// NOOR Codex · the timeline index: what the list needs, and nothing more.\n"
    + "// The full record for a node, its details prose, verses and narrations, lives\n"
    + "// in node/<id>.json and is fetched when that node is opened.\n"
    + "// Generated by scripts/build.mjs. Do not edit by hand.\n"
    + meta                                   // already "const NOOR_META={...};\n"
    + "const NODES=" + JSON.stringify(light) + ";\n"
    + "if(typeof window!==\"undefined\")window.NODES=NODES;\n";
  write('nodes-index.js', idx);
  fs.mkdirSync(path.join(ROOT, 'node'), { recursive: true });
  let bytes = 0;
  for (const n of nodes) {
    const t = JSON.stringify(n);
    fs.writeFileSync(path.join(ROOT, 'node', n.id + '.json'), t);
    bytes += Buffer.byteLength(t);
  }
  console.log(`SPLIT: nodes-index.js ${Math.round(Buffer.byteLength(idx)/1024)}KB · `
    + `node/*.json ${nodes.length} files, ${Math.round(bytes/1024)}KB`);
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
