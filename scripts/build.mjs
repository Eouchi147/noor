// NOOR builder — applies content patches, renumbers chronologically, remaps links,
// regenerates nodes.js and the CHARACTERS block inside characters.html.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);

// ---------- load pristine data (snapshotted from git; build is reproducible) ----------
const sb = {}; vm.createContext(sb);
vm.runInContext(read('.build-src/nodes.src.js') + ';this.__N=NODES;', sb);
let nodes = sb.__N;

const srcCharHtml = read('.build-src/characters.src.html');
const srcCharMatch = srcCharHtml.match(/const CHARACTERS = \{[\s\S]*?\n\};/);
if (!srcCharMatch) throw new Error('CHARACTERS block not found in source snapshot');
const sb2 = {}; vm.createContext(sb2);
vm.runInContext(srcCharMatch[0] + ';this.__C=CHARACTERS;', sb2);
let chars = sb2.__C;

// characters data now ships as characters.js (same zero-build pattern as nodes.js)

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
// wrap first plain-text occurrence of `name` (outside {{...}} markers) with a link marker
function linkFirst(details, name, target) {
  if (!details || !name || !target) return details;
  const marker = target.startsWith('n:') ? `{{n:${target.slice(2)}|${name}}}`
              : /^\d+$/.test(target)     ? `{{n:${target}|${name}}}`
              :                            `{{c:${target}|${name}}}`;
  const parts = details.split(/(\{\{[^}]*\}\})/);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith('{{')) continue;
    const idx = parts[i].indexOf(name);
    if (idx !== -1) {
      // skip if already directly adjacent to a marker label (rare); plain replace
      parts[i] = parts[i].slice(0, idx) + marker + parts[i].slice(idx + name.length);
      return parts.join('');
    }
  }
  return details;
}

// ---------- apply node patches ----------
const patchFiles = ['bidaya-qisas.mjs','seerah.mjs','nihaya.mjs'];
let patches = [];
for (const f of patchFiles) {
  const mod = await import(path.join(ROOT, 'scripts/patches', f));
  patches = patches.concat(mod.default);
}
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
    if (m.linkNames) for (const [name, tgt] of Object.entries(m.linkNames)) {
      if (tgt && !n.details.includes(`|${name}}}`)) n.details = linkFirst(n.details, name, tgt);
    }
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
// normalize all hadith to {text, source}
nodes.forEach(n => { if (Array.isArray(n.hadith)) n.hadith = n.hadith.map(normHadith).filter(Boolean); });
nodes.sort((a,b) => a.id - b.id);

// ---------- apply character patches ----------
const cp = (await import(path.join(ROOT, 'scripts/patches/characters.mjs'))).default;
for (const rid of cp.removeIds||[]) for (const k of Object.keys(chars)) chars[k] = chars[k].filter(c => c.id !== rid);
for (const [cid, map] of Object.entries(cp.linkExisting||{})) {
  for (const k of Object.keys(chars)) {
    const c = chars[k].find(x => x.id === cid); if (!c) continue;
    for (const [name, tgt] of Object.entries(map)) if (tgt && !c.details.includes(`|${name}}}`)) c.details = linkFirst(c.details, name, tgt);
  }
}
for (const [section, list] of Object.entries(cp.addCharacters||{})) {
  chars[section] = chars[section] || [];
  const have = new Set(chars[section].map(c => c.id));
  for (const c of list) if (!have.has(c.id)) chars[section].push(c);
}

// ---------- validation ----------
const nodeIds = new Set(nodes.map(n => n.id));
const charIds = new Set(Object.values(chars).flat().map(c => c.id));
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
  for (const m of String(t||'').matchAll(/\{\{(n|c):([^|}]+)\|/g)) {
    if (m[1] === 'n' && !nodeIds.has(+m[2])) errs.push(`${owner}: dead node link {{n:${m[2]}}}`);
    if (m[1] === 'c' && !charIds.has(m[2])) errs.push(`${owner}: dead char link {{c:${m[2]}}}`);
  }
};
nodes.forEach(n => { checkText(`node ${n.id}`, n.details); (n.connections||[]).forEach(c => { if (!nodeIds.has(c)) errs.push(`node ${n.id}: dead connection ${c}`); }); });
Object.values(chars).flat().forEach(c => checkText(`char ${c.id}`, c.details));
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
  let s = '{' + parts.join(',') + ',\n';
  s += 'details:`' + esc(n.details) + '`';
  if (n.sequence) s += ',\nsequence:' + J(n.sequence);
  if (n.timeline) s += ',\ntimeline:[\n' + n.timeline.map(t => ' ' + J(t)).join(',\n') + ']';
  if (n.protection) s += ',\nprotection:[\n' + n.protection.map(p => ' ' + J(p)).join(',\n') + ']';
  if (n.quran && n.quran.length) s += ',\nquran:[\n' + n.quran.map(q => ' ' + J(q)).join(',\n') + ']';
  if (n.hadith && n.hadith.length) s += ',\nhadith:[\n' + n.hadith.map(h => ' ' + J(h)).join(',\n') + ']';
  if (n.lessons && n.lessons.length) s += ',\nlessons:[\n' + n.lessons.map(l => ' ' + J(l)).join(',\n') + ']';
  if (n.connections && n.connections.length) s += ',\nconnections:' + J(n.connections);
  if (n.facts && n.facts.length) s += ',\nfacts:[\n' + n.facts.map(f => ' ' + J(f)).join(',\n') + ']';
  return s + '}';
}
function serChar(c) {
  const parts = [`id:${J(c.id)}`, `titleEn:${J(c.titleEn)}`, `titleAr:${J(c.titleAr||'')}`, `role:${J(c.role||'')}`, `summary:${J(c.summary||'')}`, `pattern:${J(c.pattern||'pattern-sahaba')}`];
  let s = '{' + parts.join(',') + ',\n';
  s += 'details:`' + esc(c.details||'') + '`';
  if (c.facts && c.facts.length) s += ',\nfacts:[' + c.facts.map(f => J(f)).join(',') + ']';
  if (c.quran && c.quran.length) s += ',\nquran:[' + c.quran.map(q => J(q)).join(',') + ']';
  return s + '}';
}

const sections = ['companions','angels','jinn','animals','endtime'];
const totalChars = Object.values(chars).flat().length;
const totalQuran = nodes.reduce((a,n)=>a+((n.quran||[]).length),0);
const totalHadith = nodes.reduce((a,n)=>a+((n.hadith||[]).length),0);
const meta = `const NOOR_META={nodes:${nodes.length},characters:${totalChars},quran:${totalQuran},hadith:${totalHadith}};\n`;

const nodesOut = '// NOOR Codex — ' + nodes.length + ' nodes · Kun Fayakun → Jannah\n// Generated by scripts/build.mjs — edit scripts/patches/* then re-run: node scripts/build.mjs\n' + meta + 'const NODES = [\n' + nodes.map(serNode).join(',\n\n') + '\n];\n';
write('nodes.js', nodesOut);

const charsOut = '// NOOR Characters — generated by scripts/build.mjs\nconst CHARACTERS = {\n' + sections.map(k => k + ': [\n' + (chars[k]||[]).map(serChar).join(',\n\n') + '\n]').join(',\n\n') + '\n};\n';
write('characters.js', charsOut);
// legacy: if characters.html still embeds a CHARACTERS block, swap it for the external file reference
const liveChar = read('characters.html');
const liveMatch = liveChar.match(/const CHARACTERS = \{[\s\S]*?\n\};/);
if (liveMatch) write('characters.html', liveChar.replace(liveMatch[0], '/* CHARACTERS moved to characters.js */'));

// ---------- stats ----------
const wc = s => String(s||'').replace(/\{\{[^}]+\}\}/g,' x ').split(/\s+/).filter(Boolean).length;
const pad = (s,n) => String(s).padEnd(n);
console.log(pad('id',4), pad('period',7), pad('title',42), pad('words',6), pad('facts',6), pad('qur',4), pad('had',4), pad('les',4), pad('lnk',4), 'extras');
for (const n of nodes) {
  const extras = [n.sequence?'seq':'', n.timeline?'tl'+n.timeline.length:'', n.protection?'shield':''].filter(Boolean).join('+');
  console.log(pad(n.id,4), pad(n.period,7), pad(n.titleEn.slice(0,42),42), pad(wc(n.details),6), pad((n.facts||[]).length,6), pad((n.quran||[]).length,4), pad((n.hadith||[]).length,4), pad((n.lessons||[]).length,4), pad((String(n.details).match(/\{\{/g)||[]).length,4), extras);
}
console.log(`\nNODES: ${nodes.length} · total words ${nodes.reduce((a,n)=>a+wc(n.details),0)}`);
console.log('CHARACTERS:', sections.map(k => `${k}:${(chars[k]||[]).length}`).join(' '), '· total', Object.values(chars).flat().length);
console.log('nodes.js bytes:', nodesOut.length);
