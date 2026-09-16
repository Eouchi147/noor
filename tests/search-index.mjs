/* The whole library must be findable, not only the 523 words: every prophet,
   companion, hero, place and surah is in the index and must answer. */
import { chromium } from 'playwright';
const br = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
let pass=0, fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  FAIL '+m));};
const ctx = await br.newContext({viewport:{width:390,height:844}});
const pg = await ctx.newPage();
await pg.goto('http://127.0.0.1:8231/dictionary/abu-bakr',{waitUntil:'domcontentloaded'});
/* the search arrives through the fifth door, as it does for a reader: on a
   page carrying the v13 door (More) nothing is fetched until the sheet opens,
   and on a page still carrying the retired Search door noor-fx.js relabels
   it and fetches the search itself. Either way the door is pressed. */
await pg.waitForFunction(()=>document.querySelector('.n2-bar [data-n2-more], .n2-bar [data-n2-search]'),null,{timeout:15000});
await pg.evaluate(()=>document.querySelector('.n2-bar [data-n2-more], .n2-bar [data-n2-search]').click());
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
  ['prophets','a room'],
  /* the rooms api/page.js renders and the Names, in the index since 16 September 2026 */
  ['ar-rahman',  'a Name'],
  ['al-baqarah', 'a surah room'],
  ['badr',       'a Light'],
  ['today',      'the day, a shelf']
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
/* a Name, a surah room, a Light and a chapter room each answer in their own group, at their own address;
   and the prophets, companions, characters and places answer at their rooms, not at a hub's anchor */
/* since 16 September 2026 a Name's row opens its own room, /name/<n> */
const rooms = await pg.evaluate(()=>Promise.all([['ar-rahman','names','/name/1'],['al-baqarah','surahs','/surah/2'],['badr','lights','/light/'],['adam from clay','path','/path/2']]
  .map(([t,g,u])=>window.NOOR_SEARCH.find(t).then(gs=>{const grp=gs.find(x=>x.key===g); return {t, g, hit: !!grp && grp.hits.some(h=>h.u.startsWith(u))};}))));
for (const r of rooms) ok(r.hit, '"'+r.t+'" answers in the group '+r.g+' with the room\'s own address');
const ents = await pg.evaluate(()=>Promise.all([['yusuf','prophets','/prophet/yusuf'],['abu bakr','people','/companion/c-abubakr'],['jibril','people','/character/a-jibril'],['kaaba','places','/place/p-kaaba']]
  .map(([t,g,u])=>window.NOOR_SEARCH.find(t).then(gs=>{const grp=gs.find(x=>x.key===g); return {t, g, hit: !!grp && grp.hits.some(h=>h.u===u)};}))));
for (const r of ents) ok(r.hit, '"'+r.t+'" answers in the group '+r.g+' at its own room');
const anchors = await pg.evaluate(()=>fetch('/assets/search-index.json').then(r=>r.json()).then(j=>j.e.filter(x=>/^\/(allah#\d+|prophets#art-|characters#(companions|angels|jinn|animals|endtime)|places#)/.test(x.u)).length));
ok(anchors===0, 'no entity row points at a hub anchor where a room exists ('+anchors+')');
const three = await pg.evaluate(()=>fetch('/assets/search-index.json').then(r=>r.json()).then(j=>({
  rooms: j.r.map(x=>x.u), groups: j.g.map(x=>x.k), lights: j.e.filter(x=>x.g==='lights').length, surahs: j.e.filter(x=>x.g==='surahs').length, names: j.e.filter(x=>x.g==='names').length, chapters: j.e.filter(x=>/^\/path\/\d+$/.test(x.u)).length })));
ok(!three.rooms.includes('/404') && !three.rooms.includes('/masjid/board') && !three.rooms.includes('/license'), 'the 404, the noindex board and the retired licence door are not offered');
ok(['/allah','/muhammad','/mizan','/three-lives','/dictionary','/light','/path','/today','/verses'].every(u=>three.rooms.includes(u)), 'every reader room the map names is offered, the shelves among them');
ok(three.lights===350 && three.surahs===114 && three.names===99 && three.chapters===71, 'the 350 Lights, 114 surahs, 99 Names and 71 chapters are in it ('+[three.lights,three.surahs,three.names,three.chapters].join(', ')+')');
const raw = await pg.evaluate(()=>fetch('/assets/search-index.json').then(r=>r.json())
  .then(j=>Object.keys(j).map(k=>k+':'+(Array.isArray(j[k])?j[k].length:typeof j[k]))));
ok(raw.some(x=>x.startsWith('e:')), 'the index served to the page carries the entities → '+JSON.stringify(raw));
await br.close();
console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
