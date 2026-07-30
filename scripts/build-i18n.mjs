// NOOR i18n master pack generator — writes i18n/en.json (source of truth for translators)
// Translators copy en.json → {lang}.json and translate values; Arabic ayah text & refs stay untouched.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// UI dictionary from noor-fx.js
const fx = read('noor-fx.js');
const uiSrc = fx.match(/const UI_EN = \{[\s\S]*?\n\};/);
if (!uiSrc) throw new Error('UI_EN not found');
const sb = {}; vm.createContext(sb);
vm.runInContext(uiSrc[0].replace('const UI_EN','this.UI_EN'), sb);

// nodes + characters
vm.runInContext(read('nodes.js') + ';this.N=NODES;', sb);
vm.runInContext(read('characters.js') + ';this.C=CHARACTERS;', sb);

const pack = {
  _meta: {
    language: 'en', source: true, generated: 'scripts/build-i18n.mjs',
    instructions: 'Copy this file to i18n/{code}.json and translate every string VALUE. Never translate keys, ids, refs, or Arabic ayah text (quran[].ar is intentionally absent here — it is language-invariant). Keep {{n:ID|label}} and {{c:id|label}} markers intact: translate only the label after the pipe.'
  },
  ui: sb.UI_EN,
  nodes: {}, characters: {}
};
for (const n of sb.N) {
  pack.nodes[n.id] = {
    titleEn: n.titleEn, metric: n.metric || undefined, summary: n.summary,
    details: n.details,
    sequence: n.sequence ? { phase: n.sequence.phase, position: n.sequence.position, note: n.sequence.note } : undefined,
    timeline: n.timeline ? n.timeline.map(s => ({ label: s.label, detail: s.detail })) : undefined,
    protection: n.protection || undefined,
    facts: (n.facts||[]).map(f => ({ label: f.label, value: f.value })),
    quran: (n.quran||[]).map(q => ({ ref: q.ref, en: q.en })),
    hadith: (n.hadith||[]).map(h => ({ text: h.text, source: h.source })),
    lessons: n.lessons || []
  };
}
for (const [sec, list] of Object.entries(sb.C)) {
  for (const c of list) {
    pack.characters[c.id] = {
      section: sec, titleEn: c.titleEn, role: c.role, summary: c.summary, details: c.details,
      facts: (c.facts||[]).map(f => ({ label: f.label, value: f.value })),
      quran: (c.quran||[]).map(q => ({ ref: q.ref, en: q.en }))
    };
  }
}
fs.mkdirSync(path.join(ROOT, 'i18n'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'i18n/en.json'), JSON.stringify(pack, null, 1));
console.log('i18n/en.json written:', (fs.statSync(path.join(ROOT,'i18n/en.json')).size/1024).toFixed(0) + ' KB',
  '· ui keys:', Object.keys(pack.ui).length, '· nodes:', Object.keys(pack.nodes).length, '· characters:', Object.keys(pack.characters).length);
