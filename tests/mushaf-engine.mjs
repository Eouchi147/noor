/* NOOR · the recitation engine's promises.
   ------------------------------------------------------------------
   The old player skipped verses. A five-second timer decided a verse that
   had not STARTED in five seconds had failed, and "continued" past it. On a
   phone, on a cold connection, that is a verse of the Qur'an missing from a
   recitation, with a message that vanished before anyone read it.

   Three promises are held here that the Mushaf suite cannot see:

     · a verse that is slow is waited for, not skipped
     · a verse that will not load at all stops the recitation ON that verse,
       says so, and play resumes from it -- it is never passed over
     · the first tap blesses both players, so later verses need no gesture

   Needs the static server:  python3 /tmp/vercelish.py . 8433
   Then:                     node tests/mushaf-engine.mjs
*/
import { chromium } from 'playwright';
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
function wav(seconds, hz){
  const sr=8000, n=Math.round(sr*seconds), body=Buffer.alloc(n*2);
  for(let i=0;i<n;i++) body.writeInt16LE(Math.round(6000*Math.sin(2*Math.PI*hz*i/sr)), i*2);
  const head=Buffer.alloc(44);
  head.write('RIFF',0); head.writeUInt32LE(36+body.length,4); head.write('WAVE',8);
  head.write('fmt ',12); head.writeUInt32LE(16,16); head.writeUInt16LE(1,20);
  head.writeUInt16LE(1,22); head.writeUInt32LE(sr,24); head.writeUInt32LE(sr*2,28);
  head.writeUInt16LE(2,32); head.writeUInt16LE(16,34);
  head.write('data',36); head.writeUInt32LE(body.length,40);
  return Buffer.concat([head,body]);
}
const TONE=wav(1.2,330);
const BASE='http://127.0.0.1:8433';
let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  PASS '+m);} else {fail++;console.log('  FAIL '+m);} };
function surahJSON(n,count,edition){
  const ayahs=[]; let base=0; for(let i=1;i<n;i++) base+=1000;
  for(let v=1;v<=count;v++) ayahs.push({ number: base+v, numberInSurah: v,
    text: edition? ('Verse '+v+' translated.') : 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' });
  return {code:200,status:'OK',data:{number:n,ayahs}};
}
const b=await chromium.launch({executablePath:EXE,args:['--autoplay-policy=no-user-gesture-required','--no-sandbox','--mute-audio']});
const ctx=await b.newContext({viewport:{width:390,height:780},serviceWorkers:'block'});
const page=await ctx.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(String(e)));

/* verse 2 of Al-Fatiha is slow; verse 4 is dead on every mirror; the rest are fine */
const SLOW_MS=7000;
let slowServed=0, deadAsked=0;
await page.route('**/api.alquran.cloud/**', r=>{
  const p=new URL(r.request().url()).pathname.split('/');
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(surahJSON(+p[3],7,p[4]!=='quran-uthmani'))});
});
await page.route(u=>/(islamic\.network|everyayah|verses\.quran)/.test(u.href), async r=>{
  const u=r.request().url();
  const isV2=/\/2\.mp3$|001002\.mp3$/.test(u), isV4=/\/4\.mp3$|001004\.mp3$/.test(u);
  if(isV4){ deadAsked++; return r.abort('failed'); }
  if(isV2){ slowServed++; await new Promise(res=>setTimeout(res,SLOW_MS)); }
  r.fulfill({status:200,contentType:'audio/wav',body:TONE});
});

await page.goto(BASE+'/quran?surah=1',{waitUntil:'domcontentloaded'});
await page.waitForSelector('.ayah',{timeout:15000});
const st=()=>page.evaluate(()=>({i:NOOR_MUSHAF.playingIdx,stuck:NOOR_MUSHAF.stuckAt,paused:NOOR_MUSHAF.paused,
  blessed:NOOR_MUSHAF.blessed,cont:NOOR_MUSHAF.continuous,status:document.getElementById('t-status').textContent,
  sub:document.getElementById('p-sub').textContent}));

console.log('\n=== the first tap blesses the players ===');
await page.click('#t-listen');
await page.waitForTimeout(400);
ok((await st()).blessed===true,'both players carry the reader\'s tap from the first verse on');

console.log('\n=== a slow verse is waited for, not skipped ===');
await page.waitForFunction(()=>NOOR_MUSHAF.playingIdx===1,{timeout:15000});
const t0=Date.now();
await page.waitForTimeout(5600);            /* past the old five-second guillotine */
let s=await st();
ok(s.i===1,'after 5.6s the player is still on verse 2, not "continuing" past it (idx '+s.i+')');
await page.waitForFunction(()=>NOOR_MUSHAF.playingIdx===2,{timeout:SLOW_MS+9000});
ok(true,'and verse 2 played through to verse 3 in '+Math.round((Date.now()-t0)/100)/10+'s');
ok(slowServed===1,'without asking a second mirror for it ('+slowServed+' request)');

console.log('\n=== a dead verse stops the recitation on that verse ===');
await page.waitForFunction(()=>NOOR_MUSHAF.playingIdx===3,{timeout:15000});
/* four mirrors, refused, then two retry rounds of four -- give it time */
await page.waitForFunction(()=>NOOR_MUSHAF.stuckAt===3,{timeout:60000}).then(()=>ok(true,'the recitation stops ON verse 4'))
  .catch(async()=>ok(false,'the recitation stops ON verse 4 (state '+JSON.stringify(await st())+')'));
s=await st();
ok(s.i===3,'verse 4 is still the current verse -- it was not passed over');
ok(s.paused===true,'and the player is paused there, not playing something else');
ok(/could not be loaded|tap play/i.test(s.status+' '+s.sub),'and it says so in words: "'+s.sub+'"');
ok(deadAsked>=8,'after trying every mirror and trying again ('+deadAsked+' asks)');
ok(s.cont===true,'continuous mode is kept, so play resumes the run');

console.log('\n=== play resumes from the verse that failed ===');
await page.unroute(u=>/(islamic\.network|everyayah|verses\.quran)/.test(u.href));
await page.route(u=>/(islamic\.network|everyayah|verses\.quran)/.test(u.href), r=>r.fulfill({status:200,contentType:'audio/wav',body:TONE}));
await page.click('#p-toggle');
await page.waitForFunction(()=>NOOR_MUSHAF.playingIdx===4,{timeout:15000}).then(()=>ok(true,'tapping play retried verse 4 and carried on to verse 5'))
  .catch(async()=>ok(false,'tapping play retried verse 4 (state '+JSON.stringify(await st())+')'));
ok((await st()).stuck===-1,'and nothing is marked stuck any more');

console.log('\n=== nothing threw ===');
ok(errors.length===0,'no page errors'+(errors.length?' ('+errors[0]+')':''));

await b.close();
console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
