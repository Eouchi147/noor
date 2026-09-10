/* The whole library must be findable, not only the 523 words: every prophet,
   companion, hero, place and surah is in the index and must answer. */
import { chromium } from 'playwright';
const br = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
let pass=0, fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  FAIL '+m));};
const ctx = await br.newContext({viewport:{width:390,height:844}});
const pg = await ctx.newPage();
await pg.goto('http://127.0.0.1:8231/dictionary/abu-bakr',{waitUntil:'domcontentloaded'});
await pg.waitForFunction(()=>window.NOOR_SEARCH&&window.NOOR_SEARCH.find,null,{timeout:15000});
await pg.evaluate(()=>window.NOOR_SEARCH.find(''));
await pg.waitForTimeout(2500);

/* one term per kind of thing the house holds */
const WANT = [
  ['yusuf',   'a prophet'],
  ['baqara',  'a surah'],
  ['bilal',   'a companion'],
  ['uhud',    'a place'],
  ['taqwa',   'a word'],
  ['prophets','a room']
];
for (const [term, what] of WANT) {
  const groups = await pg.evaluate(t=>window.NOOR_SEARCH.find(t)
    .then(g=>g.map(x=>({k:x.key, n:(x.hits||[]).length, first:(x.hits||[])[0]&&x.hits[0].t}))), term);
  const total = groups.reduce((a,g)=>a+g.n,0);
  ok(total>0, '"'+term+'" (' + what + ') answers → ' + JSON.stringify(groups.slice(0,2)));
}
/* and the groups must not all be "words": the entities have to be reachable */
const kinds = await pg.evaluate(()=>Promise.all(['yusuf','baqara','bilal','uhud']
  .map(t=>window.NOOR_SEARCH.find(t))).then(rs=>[...new Set(rs.flat().map(g=>g.key))]));
ok(kinds.some(k=>k!=='words'&&k!=='rooms'), 'the 1,183 entities are searched, not just words and rooms → '+JSON.stringify(kinds));
const raw = await pg.evaluate(()=>fetch('/assets/search-index.json').then(r=>r.json())
  .then(j=>Object.keys(j).map(k=>k+':'+(Array.isArray(j[k])?j[k].length:typeof j[k]))));
ok(raw.some(x=>x.startsWith('e:')), 'the index served to the page carries the entities → '+JSON.stringify(raw));
await br.close();
console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
