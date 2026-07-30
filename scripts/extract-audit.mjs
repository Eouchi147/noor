// Dump every English prose string (≥50 chars) from the four generated data files
// into wrapped chunk files for proofreading agents. Locator: dataset|id|path
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'audit');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const load = (file, sym) => {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return vm.runInNewContext(code + ';' + sym, { window: {} });
};

const SKIP = new Set(['ar', 'titleAr', 'translit', 'img', 'image', 'id', 'period', 'connections', 'source', 'surah', 'ref', 'range']);
const records = []; // {loc, text}

function walk(val, loc, keyName) {
  if (typeof val === 'string') {
    if (val.length >= 50 && /[a-z] [a-z]/i.test(val)) records.push({ loc, text: val });
    return;
  }
  if (Array.isArray(val)) { val.forEach((v, i) => walk(v, `${loc}[${i}]`, keyName)); return; }
  if (val && typeof val === 'object') {
    for (const [k, v] of Object.entries(val)) {
      if (SKIP.has(k)) continue;
      walk(v, `${loc}.${k}`, k);
    }
  }
}

const nodes = load('nodes.js', 'NODES');
nodes.forEach(n => walk(n, `nodes|${n.id}|${n.titleEn.slice(0, 30)}`));
const chars = load('characters.js', 'CHARACTERS');
Object.values(chars).flat().forEach(c => walk(c, `characters|${c.id}|${c.titleEn}`));
const places = load('places.js', 'PLACES');
Object.values(places).flat().forEach(p => walk(p, `places|${p.id}|${p.titleEn}`));
const words = load('words.js', 'WORDS');
Object.values(words).flat().forEach(w => walk(w, `words|${w.id}|${w.titleEn}`));

// wrap long strings at spaces ≤150 chars for agent readability
const wrap = s => {
  const out = [];
  let line = '';
  for (const word of s.split(' ')) {
    if ((line + ' ' + word).length > 150 && line) { out.push(line); line = word; }
    else line = line ? line + ' ' + word : word;
  }
  if (line) out.push(line);
  return out.join('\n');
};

// chunk ~140KB each, never splitting a record
const TARGET = 140 * 1024;
let chunkIdx = 0, buf = '', count = 0, total = 0;
const flush = () => {
  if (!buf) return;
  fs.writeFileSync(path.join(OUT, `chunk-${String(++chunkIdx).padStart(2, '0')}.txt`), buf);
  buf = '';
};
for (const r of records) {
  const block = `@@ ${r.loc}\n${wrap(r.text)}\n\n`;
  if (buf.length + block.length > TARGET) flush();
  buf += block; count++; total += r.text.length;
}
flush();
console.log(`records=${count} totalChars=${total} chunks=${chunkIdx}`);
