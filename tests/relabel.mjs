/* A page built with the old Search door must show the same fifth door as
   every other page: called More, drawn as the map, and opening the sheet. */
import { chromium } from 'playwright';
const OLD = '<a href="/dictionary" data-n2-search data-nm-open>' +
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.4"/>' +
  '<path d="M15.6 15.6L21 21"/></svg>Search</a>';
const br = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
let pass=0, fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  FAIL '+m));};

for (const path of ['/dictionary/abu-bakr','/dictionary','/prophets']) {
  const ctx = await br.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  // put the page back into the state the live site is in
  await ctx.addInitScript(o => {
    document.addEventListener('DOMContentLoaded', function once(){
      const bar = document.querySelector('.n2-bar');
      if (!bar) return;
      const a = bar.querySelector('a[data-n2-more]');
      if (a) a.outerHTML = o;
    }, {once:true});
  }, OLD);
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://127.0.0.1:8231'+path,{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3000);

  const d = await pg.evaluate(()=>{
    const a = document.querySelector('.n2-bar a[data-n2-more], .n2-bar a[data-n2-search]');
    if (!a) return null;
    return { label:a.textContent.trim(), href:a.getAttribute('href'),
      more:a.hasAttribute('data-n2-more'),
      dots:(a.querySelector('svg')||{}).innerHTML ? /circle cx="5.5"/.test(a.querySelector('svg').innerHTML) : false,
      count:document.querySelectorAll('.n2-bar a').length };
  });
  ok(d, path+': a fifth door is there');
  ok(d && d.label === 'More', path+': it is called More (got "'+(d&&d.label)+'")');
  ok(d && d.dots, path+': and drawn as the map, not a magnifier');
  ok(d && d.href === '/#search', path+': pointing at the sheet');
  ok(d && d.count === 5, path+': the bar still has exactly five doors ('+(d&&d.count)+')');

  await pg.evaluate(()=>document.querySelector('.n2-bar a[data-n2-more]').click());
  await pg.waitForTimeout(800);
  const m = await pg.evaluate(()=>{const b=document.querySelector('.nmr');
    return b && b.classList.contains('on') ? b.querySelectorAll('.nmr-r').length : 0;});
  ok(m === 42, path+': and it still opens all 42 rooms ('+m+')');
  ok(errs.length===0, path+': no page errors'+(errs.length?' → '+errs[0].slice(0,80):''));
  await ctx.close();
}
await br.close();
console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
