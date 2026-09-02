/* NOOR · the Mushaf regression.
   ------------------------------------------------------------------
   The player and the verse layer are the two parts of this room a reader
   touches most, and both of them are easy to break quietly. This file holds
   them to the promises they were built to keep:

     · an expander appears only where a note has actually been written
     · a panel opens on real content, badged, with its sources printed
     · following brings an off-screen verse up, and leaves an on-screen one
       exactly where it is
     · one gesture from the reader stops the following, and the automatic
       advance then never moves the page
     · the next verse is fetched while the current one is still sounding
     · the recitation crosses into the next surah instead of stopping dead
     · a stop leaves nothing marked, lit, or held

   It needs the static server running:  python3 /tmp/vercelish.py   (port 8433)
   Then:                               node tests/mushaf.mjs
   The Qur'an text service and the recitation servers are stubbed, so this
   runs with no network at all.
*/
import { chromium } from 'playwright';

const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
/* two test tones, built here so this file depends on nothing outside it */
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
const TONE_LONG=wav(3.0,330), TONE_SHORT=wav(0.9,440);
let TONE=TONE_LONG;
const BASE='http://127.0.0.1:8433';
let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  PASS '+m);} else {fail++;console.log('  FAIL '+m);} };

/* a plausible surah, so the page renders exactly as it does live */
function surahJSON(n,count,edition){
  const ayahs=[];
  let base=0; for(let i=1;i<n;i++) base+=1000;
  for(let v=1;v<=count;v++) ayahs.push({
    number: base+v, numberInSurah: v,
    text: edition? ('Verse '+v+' translated.') :
      'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ'
  });
  return {code:200,status:'OK',data:{number:n,ayahs}};
}
const COUNT={1:7,2:286,3:200,103:3,112:4,113:5,114:6};

const b=await chromium.launch({executablePath:EXE,args:[
  '--autoplay-policy=no-user-gesture-required','--no-sandbox','--mute-audio']});
const ctx=await b.newContext({viewport:{width:390,height:780},serviceWorkers:'block'});
const page=await ctx.newPage();

const errors=[]; page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{ if(m.type()==='error') errors.push('console: '+m.text()); });
page.on('requestfailed',r=>errors.push('reqfail: '+r.url()));
page.on('response',r=>{ if(r.status()>=400) errors.push('http '+r.status()+': '+r.url()); });

const audioHits=[];
await page.route('**/api.alquran.cloud/**', r=>{
  const u=new URL(r.request().url()); const p=u.pathname.split('/');
  const n=+p[3], ed=p[4]!=='quran-uthmani';
  r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify(surahJSON(n,COUNT[n]||10,ed))});
});
const audioRe=/(islamic\.network|everyayah|verses\.quran)/;
await page.route(u=>audioRe.test(u.href), r=>{
  audioHits.push({url:r.request().url(),t:Date.now()});
  r.fulfill({status:200,contentType:'audio/wav',body:TONE});
});

console.log('\n=== 1. verse expanders appear only where a note is written ===');
await page.goto(BASE+'/quran?surah=1',{waitUntil:'domcontentloaded'});
await page.waitForSelector('.ayah',{timeout:15000});
ok(await page.locator('.vx').count()===7,'Al-Fatiha: 7 expanders for 7 written verses');
await page.goto(BASE+'/quran?surah=3',{waitUntil:'domcontentloaded'});
await page.waitForSelector('.ayah');
ok(await page.locator('.vx').count()===0,'Aal Imran: nothing written, so no expanders at all');
await page.goto(BASE+'/quran?surah=2',{waitUntil:'domcontentloaded'});
await page.waitForSelector('.ayah');
ok(await page.locator('.vx').count()===141,'Al-Baqarah: 141 expanders among 286 verses (2-141 and 255)');
ok(await page.locator('#a-255 .vx').count()===1,'and one of them is on verse 255');
ok(await page.locator('#a-2 .vx').count()===1,'and 2:2 has one too');
ok(await page.locator('#a-141 .vx').count()===1,'so does 2:141, the far end of this stretch');
ok(await page.locator('#a-142 .vx').count()===0,'2:142, the next verse over, does not');

console.log('\n=== 2. the panel opens with real content ===');
await page.goto(BASE+'/quran?surah=1',{waitUntil:'domcontentloaded'});
await page.waitForSelector('.ayah');
await page.locator('#a-4 .vx').click();
await page.waitForSelector('#vp-4 .vsense',{timeout:8000});
const p4=await page.locator('#vp-4').innerText();
ok(await page.locator('#vp-4 .vw').count()===3,'4 words? no: 3 word cards for Maliki yawmi-d-din');
ok(/Owner of the Day/.test(p4),'the two readings are named');
ok(await page.locator('#vp-4 .evb.debated').count()===1,'one Scholars-differ badge');
ok(await page.locator('#vp-4 .evb.sunnah').count()===1,'one Sunnah badge');
ok(/Muslim 395/.test(p4),'the source is printed with it');
ok(await page.locator('#vp-4 .vlink').count()===2,'two cross links');
ok(!/Nothing has been written/.test(p4),'no empty state on a written verse');
ok(await page.locator('#a-4 .vx').getAttribute('aria-expanded')==='true','aria-expanded is true');
await page.locator('#a-4 .vx').click();
ok(await page.locator('#vp-4').isHidden(),'clicking again folds it away');

console.log('\n=== 3. a cross link travels ===');
await page.locator('#a-7 .vx').click();
await page.waitForSelector('#vp-7 .vlink');
await page.locator('#vp-7 .vlink').first().click();
await page.waitForFunction(()=>location.search.indexOf('surah=4')>=0,{timeout:8000});
ok(page.url().includes('surah=4')&&page.url().includes('ayah=69'),'4:69 opened at the right verse');

console.log('\n=== 4. the player follows, and yields ===');
await page.goto(BASE+'/quran?surah=2',{waitUntil:'domcontentloaded'});
await page.waitForSelector('.ayah');
await page.evaluate(()=>window.scrollTo(0,0));
await page.waitForTimeout(200);
/* a verse far below the fold: following must bring it up */
await page.locator('#a-40 .playbtn').click();
await page.waitForTimeout(900);
let box=await page.locator('#a-40').boundingBox();
ok(box && box.y>0 && box.y<420,'a verse below the fold is brought into view (y='+(box?Math.round(box.y):'null')+')');
ok(await page.locator('.ayah.playing').count()===1,'exactly one verse is marked playing');
ok(await page.locator('.playbtn.on').count()===1,'exactly one play button is lit');

/* the next verse down is now comfortably on screen. Playing it must not move
   the page at all: that is the whole difference from scrollIntoView. */
const comfy=await page.evaluate(()=>{
  const h=document.getElementById('site-header').getBoundingClientRect().height+8;
  const bot=innerHeight-92;
  for(const el of document.querySelectorAll('.ayah')){
    const r=el.getBoundingClientRect();
    if(r.top>=h+30&&r.bottom<=bot&&!el.classList.contains('playing'))return el.id;
  }
  return null;
});
ok(!!comfy,'found a verse sitting comfortably in view ('+comfy+')');
const before=await page.evaluate(()=>scrollY);
/* force:true, because Playwright's own actionability check auto-scrolls a
   target it judges too close to the viewport edge before clicking, which
   is exactly the false move this assertion is checking the page itself
   never makes. The click still lands the same; only Playwright's own
   pre-click scroll is skipped so it cannot masquerade as the page's. */
await page.locator('#'+comfy+' .playbtn').click({force:true});
await page.waitForTimeout(800);
const after=await page.evaluate(()=>scrollY);
ok(Math.abs(after-before)<8,'a verse already in view is left exactly where it is ('+before+' -> '+after+')');

/* the reader's own gesture stops the following */
await page.evaluate(()=>window.scrollTo(0,0));
await page.locator('#a-60 .playbtn').click();
await page.waitForTimeout(800);
await page.mouse.wheel(0,700);
await page.waitForTimeout(300);
ok(await page.evaluate(()=>!NOOR_MUSHAF.follow),'one wheel gesture turns following off');
ok(await page.locator('#p-follow.off').count()===1,'and the player says so');
/* the verse the reader is NOT looking at advances on its own: with following
   off, that advance must not drag the page anywhere */
TONE=TONE_SHORT;
await page.evaluate(()=>window.scrollTo(0,0));
await page.locator('#t-listen').click();
await page.waitForTimeout(700);
await page.mouse.wheel(0,900);
await page.waitForTimeout(250);
ok(await page.evaluate(()=>!NOOR_MUSHAF.follow),'a gesture during continuous recitation also stops the following');
const parked=await page.evaluate(()=>scrollY);
const atIdx=await page.evaluate(()=>NOOR_MUSHAF.playingIdx);
await page.waitForFunction(i=>NOOR_MUSHAF.playingIdx>i,atIdx,{timeout:9000});
await page.waitForTimeout(600);
ok(Math.abs(await page.evaluate(()=>scrollY)-parked)<8,'the recitation advanced and the page did not move');
await page.locator('#p-follow').click();
await page.waitForTimeout(900);
ok(await page.evaluate(()=>NOOR_MUSHAF.follow),'the follow button turns it back on');
ok(await page.locator('#p-follow.off').count()===0,'and the button stops looking off');
const nowAt=await page.evaluate(()=>NOOR_MUSHAF.playingIdx);
const back=await page.locator('.ayah.playing').boundingBox();
ok(back&&back.y>0&&back.y<460,'and it jumps straight back to the verse being recited (y='+(back?Math.round(back.y):'null')+')');
await page.locator('#p-stop').click();
await page.waitForTimeout(300);
TONE=TONE_LONG;

/* tapping a verse is itself a request to be shown that verse */
await page.evaluate(()=>window.scrollTo(0,0));
await page.locator('#a-60 .playbtn').click();
await page.waitForTimeout(700);
await page.mouse.wheel(0,900);
await page.waitForTimeout(250);
ok(await page.evaluate(()=>!NOOR_MUSHAF.follow),'following is off again');
await page.locator('#a-61 .playbtn').click();
await page.waitForTimeout(800);
ok(await page.evaluate(()=>NOOR_MUSHAF.follow),'tapping a verse re-arms following: the reader is looking at it');

console.log('\n=== 5. continuous recitation, and the next verse arrives early ===');
await page.goto(BASE+'/quran?surah=112',{waitUntil:'domcontentloaded'});
await page.waitForSelector('.ayah');
audioHits.length=0;
TONE=TONE_SHORT;
await page.locator('#t-listen').click();
await page.waitForTimeout(600);
const early=audioHits.length;
const pre1=await page.evaluate(()=>NOOR_MUSHAF.preloaded);
ok(early>=2,'while verse 1 is still sounding, verse 2 is already being fetched ('+early+' requests)');
ok(pre1===1,'and the player is holding it ready (preloaded index '+pre1+')');
await page.waitForFunction(()=>NOOR_MUSHAF.playingIdx>=2,{timeout:12000});
ok(await page.evaluate(()=>NOOR_MUSHAF.playingIdx)>=2,'it advances by itself');
ok(await page.locator('.ayah.playing').count()===1,'still exactly one verse marked, no leftovers');
const fill=await page.evaluate(()=>getComputedStyle(document.getElementById('p-fill')).transform);
ok(fill!=='none'&&fill!=='matrix(0, 0, 0, 1, 0, 0)','the progress line is moving ('+fill+')');

console.log('\n=== 6. the end of a surah is not the end of the recitation ===');
await page.waitForFunction(()=>NOOR_MUSHAF.cur===113,{timeout:25000}).then(()=>ok(true,'An-Nas? no: it carried on from Al-Ikhlas into Al-Falaq'))
  .catch(()=>ok(false,'it should have carried on into the next surah'));
await page.waitForTimeout(500);
ok(await page.evaluate(()=>NOOR_MUSHAF.continuous)===true,'and it is still in continuous mode');
ok(await page.locator('.ayah').count()===5,'and the new surah really rendered (Al-Falaq, 5 verses)');

console.log('\n=== 7. stop leaves nothing behind ===');
await page.locator('#p-stop').click();
await page.waitForTimeout(400);
ok(await page.locator('.ayah.playing').count()===0,'no verse left marked');
ok(await page.locator('.playbtn.on').count()===0,'no button left lit');
ok(await page.evaluate(()=>!document.body.classList.contains('has-player')),'the player is put away');
ok(await page.evaluate(()=>NOOR_MUSHAF.follow===true),'following is armed again for next time');
ok(await page.evaluate(()=>NOOR_MUSHAF.preloaded===-1),'and the preloaded verse is let go');

console.log('\n=== 8. nothing threw ===');
/* The local server is static: it does not run the /api routes, and the
   sandbox has no route to Google's font host. Those two are the harness, not
   the room, and they are the only things allowed through this filter. */
const real=errors.filter(e=>!/favicon|net::ERR_|fonts\.(googleapis|gstatic)|\/api\/|mark\.svg|Failed to load resource/.test(e));
if(real.length)console.log('  errors:\n   '+[...new Set(real)].join('\n   '));
ok(real.length===0,'no page errors ('+(real[0]||'clean')+')');

await b.close();
console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
