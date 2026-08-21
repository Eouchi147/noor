/* NOOR · the records the prose corpus never covered.
   ------------------------------------------------------------------
   The site has two translation layers and they are easy to confuse.
   i18n/text/<code>.json is prose: static page text, matched by hash.
   i18n/<code>.json is DATA: the 71 timeline nodes, 98 characters,
   34 places and 18 words that the pages build at runtime from
   nodes.js, characters.js, places.js and words.js. A language can be
   at 100% in the first and almost empty in the second, which is
   exactly what happened: an Arabic reader met an Arabic page with an
   English node inside it.

     node scripts/recs.mjs extract <code>     write job files
     node scripts/recs.mjs merge   <code>     fold parts into the pack
     node scripts/recs.mjs status            coverage of both packs
*/
import fs from "node:fs";
import path from "node:path";

const ROOT = "/home/claude/noor";
const T = path.join(ROOT, "i18n");
/* Sacred text, ids, refs and images are never sent to a translator. */
const FIELDS = ["titleEn", "role", "summary", "details", "metric", "type", "meaning", "whenNow"];
const ARRAYS = ["facts", "lessons", "timeline", "connections"];

function load(file, name) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  const fn = new Function(src + `\n;return typeof ${name} !== "undefined" ? ${name} : null;`);
  return fn();
}
export function sections() {
  const out = {};
  out.nodes = load("nodes.js", "NODES");
  for (const [file, arr, key] of [["characters.js", "CHARACTERS", "characters"],
                                  ["places.js", "PLACES", "places"],
                                  ["words.js", "WORDS", "words"]]) {
    out[key] = Object.values(load(file, arr)).flat();
  }
  return out;
}

/* the translatable skeleton of one record, mirroring its own shape so the
   site's overlay can merge it field by field */
function skeleton(rec) {
  const o = {};
  for (const f of FIELDS) if (typeof rec[f] === "string" && rec[f].trim()) o[f] = rec[f];
  for (const k of ARRAYS) {
    const v = rec[k];
    if (!Array.isArray(v) || !v.length) continue;
    o[k] = v.map(el => {
      if (typeof el === "string") return el;
      if (el && typeof el === "object") {
        const e = {};
        for (const kk of Object.keys(el)) if (typeof el[kk] === "string" && !/^(id|href|icon|pattern|image|ref)$/.test(kk)) e[kk] = el[kk];
        return e;
      }
      return el;
    });
  }
  return o;
}

function pack(code) {
  const p = path.join(T, code + ".json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
}

function cmdStatus() {
  const S = sections();
  const codes = fs.readdirSync(T).filter(f => /^[a-z]{2,3}\.json$/.test(f)).map(f => f.replace(".json", ""));
  const totals = Object.entries(S).map(([k, v]) => k + ":" + v.length).join("  ");
  console.log("record corpus ·", totals, "\n");
  for (const code of codes.sort()) {
    if (code === "en") continue;
    const d = pack(code);
    const row = Object.entries(S).map(([k, v]) => {
      const have = d[k] ? Object.keys(d[k]).length : 0;
      return `${k} ${String(have).padStart(3)}/${v.length}`;
    }).join("   ");
    const done = Object.entries(S).reduce((a, [k, v]) => a + (d[k] ? Object.keys(d[k]).length : 0), 0);
    const all = Object.values(S).reduce((a, v) => a + v.length, 0);
    console.log(`  ${code.padEnd(4)} ${String(Math.round(100 * done / all)).padStart(3)}%   ${row}`);
  }
}

function cmdExtract(code, perJob = 6) {
  const S = sections();
  const have = pack(code);
  const dir = path.join(T, "recjobs");
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.startsWith(code + "-")) fs.unlinkSync(path.join(dir, f));
  let jobs = 0, recs = 0;
  for (const [sec, list] of Object.entries(S)) {
    const done = have[sec] || {};
    const todo = list.filter(r => !done[r.id]);
    for (let i = 0; i < todo.length; i += perJob) {
      const chunk = todo.slice(i, i + perJob);
      const body = {};
      for (const r of chunk) body[r.id] = skeleton(r);
      const name = `${code}-${sec}-${String(jobs + 1).padStart(2, "0")}.json`;
      fs.writeFileSync(path.join(dir, name), JSON.stringify({ section: sec, records: body }, null, 1));
      jobs++; recs += chunk.length;
    }
  }
  console.log(`${code}: ${recs} records still to carry, in ${jobs} job files under i18n/recjobs/`);
}

function cmdMerge(code) {
  const S = sections();
  const p = path.join(T, code + ".json");
  const d = pack(code);
  const dir = path.join(T, "_" + code + "recs");
  if (!fs.existsSync(dir)) { console.log("no parts at", dir); return; }
  let got = 0;
  const walk = dd => fs.readdirSync(dd).forEach(f => {
    const full = path.join(dd, f);
    if (fs.statSync(full).isDirectory()) return walk(full);
    if (!f.endsWith(".json")) return;
    let j; try { j = JSON.parse(fs.readFileSync(full, "utf8")); } catch { return; }
    const sec = j.section, body = j.records || j;
    if (!sec || !S[sec]) return;
    /* node ids are numbers in nodes.js and strings as JSON keys: compare as text */
    const valid = new Set(S[sec].map(r => String(r.id)));
    d[sec] = d[sec] || {};
    for (const [id, rec] of Object.entries(body)) {
      if (!valid.has(String(id)) || !rec || typeof rec !== "object") continue;
      /* dashes are banned in the house style, in every language */
      const clean = JSON.parse(JSON.stringify(rec).replace(/—|–/g, ", "));
      d[sec][id] = Object.assign({}, d[sec][id], clean);
      got++;
    }
  });
  walk(dir);
  d._meta = Object.assign({}, d._meta, { records: Object.fromEntries(Object.entries(S).map(([k, v]) => [k, (d[k] ? Object.keys(d[k]).length : 0) + "/" + v.length])) });
  fs.writeFileSync(p, JSON.stringify(d));
  console.log(`${code}: merged ${got} records ·`, JSON.stringify(d._meta.records));
}

const [cmd, code] = process.argv.slice(2);
if (cmd === "extract") cmdExtract(code);
else if (cmd === "merge") cmdMerge(code);
else cmdStatus();
