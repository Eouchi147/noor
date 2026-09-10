/* NOOR · the home page, second cut.
   ------------------------------------------------------------------
   The home page was rebuilt on the second cut's shell (assets/noor2.css and
   noor2.js). Two things are held here.

   THE WIRING. Everything the old page wired that other rooms still lean on is
   still there: the search -- which the arrival wears as a field of its own
   now, while the menu door and the bar's fifth door still open it as the More
   sheet, the map of the house -- the language layer with its hreflang doors,
   the beacon and the service worker (noor-fx.js), the dials, the Path's
   ?node= and #node- deep links, the give door, the footer
   doors, the structured data, the meta tags and the canonical. Every room
   in assets/menu-index.json is a real link on the page, grouped as the menu
   groups them, and every internal link resolves to a file or a rewrite.

   THE PROMISE. Pinch zoom is allowed, nothing glows of itself -- the one
   action is the field, and it lights only under the hand -- there is one door
   of giving and no word that hurries anyone. The verse screen walks the
   reels shelf with the same stride as api/_schedule.js, so what the page
   shows is what the poster shows. And when the library's answers cannot be
   fetched (a static server has no /api) both living screens stay calm doors,
   never an error.

   THE SHAPE. Six screens, so the shell's marks column draws. The first is a
   question and nothing else: an eyebrow, the question in two lines, ONE
   paragraph of prose, the field, six questions as rows with hairlines and a
   chevron, and one quiet way on. The six stand clear of the bar at 390 by 844
   and at 360 by 780, and at 390 the whole arrival does. Six real links and a
   real form ship in the HTML, so the arrival works with no script at all; the
   script then turns the six into disclosures that open their answer in place,
   one at a time, and the field into live search over the whole library. The
   four destinations the signpost used to carry are rows of the library now,
   like every other room. Then the verse of 2:186 with the three Names on
   a screen of its own, Today's light, One verse, the library (eight sections
   folded but the first) and No catch. Every screen carries at most one
   paragraph of prose, and every list is rows under hairlines. On a laptop the
   arrival holds one reading column in the middle, the marks column clear to
   its right. The shell is loaded with a version tail, and the tail is
   checked only for being there: it moves whenever assets/noor2.css or
   assets/noor2.js changes, which is the whole point of it.

   Static checks need nothing. The browser checks serve the repository on
   :8766 themselves (python3 -m http.server) unless NOOR_BASE names a server,
   and write screenshots to $NOOR_SHOTS (default tests/.shots/home).

   Run:  node tests/home2.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const count = (s, re) => (s.match(re) || []).length;
const MENU = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/menu-index.json'), 'utf8'));
const menuItem = title => { for (const s of MENU.sections) for (const it of s.items) if (it.t === title) return it; return null; };

console.log('\n=== 1. the file parses ===');
{
  ok(/^<!DOCTYPE html>/i.test(html), 'opens with a doctype');
  ok(/<html lang="en"[^>]*data-n2="[^"]*night[^"]*"/.test(html), 'the html element carries lang and the shell\'s data-n2');
  ok(/<\/html>\s*$/.test(html), 'closes the html element');
  /* every container tag opened is closed; the file has no self-closing containers */
  const body = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  for (const tag of ['html', 'head', 'body', 'header', 'main', 'footer', 'section', 'div', 'ul', 'li', 'p', 'a', 'h1', 'h2', 'h3', 'span', 'b', 'small', 'button', 'kbd', 'svg', 'i'])
    ok(count(body, new RegExp('<' + tag + '(?=[\\s>])', 'g')) === count(body, new RegExp('</' + tag + '>', 'g')), 'every <' + tag + '> is closed');
  ok(count(html, /<script[\s>]/g) === count(html, /<\/script>/g), 'every script is closed');
  ok(count(html, /<style[\s>]/g) === count(html, /<\/style>/g), 'every style is closed');
  const inline = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '';
  let parses = true; try { new Function(inline); } catch (e) { parses = false; console.log('     ' + e.message); }
  ok(parses, 'the inline script is valid JavaScript');
  const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  ok(count(css, /\{/g) === count(css, /\}/g), 'the inline style has balanced braces');
  const size = Buffer.byteLength(html);
  ok(size < 60 * 1024, 'the page is under 60 KB (' + size + ' bytes)');
}

console.log('\n=== 2. the shell and the wiring ===');
{
  const need = {
    'the shell\'s stylesheet, with a version tail': /<link[^>]+href="\/assets\/noor2\.css\?v=\d+"/,
    'the shell\'s script, with a version tail': /<script[^>]+src="\/assets\/noor2\.js\?v=\d+"[^>]*defer/,
    'the search overlay styles (noor-rtl.css)': /href="\/assets\/noor-rtl\.css/,
    
    'the search (noor-search.js)': /src="\/assets\/noor-search\.js/,
    
    'the language prose layer (noor-text.js)': /src="\/assets\/noor-text\.js/,
    'the beacon, the service worker and NOOR_I18N (noor-fx.js)': /src="\/noor-fx\.js"/,
    'the Path index (nodes-index.js)': /src="\/nodes-index\.js/,
    'the dials, with the #noor-notice machinery': /src="\/assets\/noor-dials\.js/,
    'the corrections layer': /src="\/assets\/noor-overrides\.js/,
    'the canonical': /<link rel="canonical" href="https:\/\/noorcodex\.com\/"\/>/,
    'the web manifest': /<link rel="manifest" href="\/manifest\.webmanifest"\/>/,
    'the icons': /mark\.svg[\s\S]*mark-64\.png[\s\S]*mark-180\.png/,
    'the description': /<meta name="description" content="NOOR · Codex of Light\./,
    'og:title, og:image, og:type': /og:title[\s\S]*og:image" content="https:\/\/noorcodex\.com\/assets\/brand\/og\.png"[\s\S]*/,
    'twitter:card': /<meta name="twitter:card" content="summary_large_image"\/>/,
    'theme-color': /<meta name="theme-color" content="#04060F"\/>/,
    'the site verifications': /p:domain_verify[\s\S]*google-site-verification/,
    'the Today fetch, as the old page asked it': /\/api\/illuminations\?kind=light&lang=/,
    'the reels manifest fetch': /"\/reels\/index\.json"/,
    'the chapter fetch': /"\/node\/" \+ n \+ "\.json"/,
    'the ?node= and #node- deep links': /sp\.get\("node"\)[\s\S]*#node-\(\\d\+\)/,
    'the #search arrival': /location\.hash === "#search"/,
    'the language pill NOOR_I18N syncs (#lang-cur)': /id="lang-cur"/,
    'the language door sets the house language': /NOOR_I18N\.setLang\(b\.getAttribute\("data-setlang"\)\)/,
    'the asking field\'s own block (noor-ask.css)': /href="\/assets\/noor-ask\.css/,
    'the asking field, and the script that upgrades it (noor-ask.js)': /src="\/assets\/noor-ask\.js[^>]*defer[\s\S]*<section[^>]*id="top"[^>]*data-noor-ask/,
    'the menu door, which opens the More sheet the field used to': /data-nm-open/,
    'the share buttons use the shell': /data-n2-share=/,
    'the play button and a video that waits for a tap': /<video playsinline controls preload=\\?"none\\?"/,
    'the noor:lang event re-lights the day': /addEventListener\("noor:lang"/
  };
  for (const k of Object.keys(need)) ok(need[k].test(html), k + ' is wired');
  ok(fs.existsSync(path.join(ROOT, 'assets/noor2.css')) && fs.existsSync(path.join(ROOT, 'assets/noor2.js')), 'the shell files exist');
  ok(!/data-n2="[^"]*\bhome\b/.test(html), 'the home-screen offer is not raised on the arrival page');
}

console.log('\n=== 3. the promises ===');
{
  const vp = (html.match(/<meta name="viewport" content="([^"]*)"/) || [])[1] || '';
  ok(vp && !/user-scalable\s*=\s*no/i.test(vp) && !/maximum-scale/i.test(vp), 'pinch zoom is allowed (' + vp + ')');
  ok(/viewport-fit=cover/.test(vp), 'the viewport reaches the safe area');
  const kept = ['en', 'x-default', 'ar', 'fr', 'es', 'de', 'ru', 'tr', 'ur', 'hi', 'bn', 'id', 'fa', 'prs', 'pa'];
  const have = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="https:\/\/noorcodex\.com\/([a-z-]*)"\/>/g)].map(m => [m[1], m[2]]);
  ok(have.map(h => h[0]).sort().join(',') === kept.slice().sort().join(','), 'the hreflang list is exactly the kept set (' + have.length + ')');
  ok(have.every(h => h[0] === 'en' || h[0] === 'x-default' ? h[1] === '' : h[1] === h[0]), 'every hreflang points at its own door');
  for (const d of ['ha', 'ja', 'ko', 'ku', 'so', 'sw', 'zh', 'ps']) ok(!new RegExp('hreflang="' + d + '"').test(html), 'hreflang ' + d + ' is dropped');
  ok(count(html, /href="\/donate"/g) === 1, 'the door of giving is one link');
  ok(/Open the door of giving/.test(html), 'and it is worded as a door, not an ask');
  for (const w of ['only today', 'hurry', 'limited', 'urgent', 'last chance', 'countdown', 'don\'t miss', 'act now'])
    ok(!new RegExp(w, 'i').test(html), 'no "' + w + '"');
  ok(count(html, /n2-glow/g) === 0 && count(html, /class="ask-field"/g) === 1, 'nothing glows of itself, and there is one action to glow: the field');
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ');
  ok(!/!/.test(visible), 'no exclamation mark anywhere on the page');
  ok(!/user-scalable/.test(html), 'user-scalable is not set at all');
  for (const bad of ['hero-stats', 'mo-count', 'h2mq', 'marquee', 'countUp', 'codex-count'])
    ok(!html.includes(bad), 'no ' + bad + ' (no counters, no marquee)');
  ok(!/autoplay/.test(html), 'no auto-playing video');
  {
    const rows = [...html.matchAll(/<li><span>([^<]+)<\/span><b>([^<]+)<\/b><\/li>/g)].map(m => m[1] + ': ' + m[2]);
    ok(rows.length === 6 && /^Ads: None$/.test(rows[0]) && rows.some(r => /^Account: None/.test(r)) && rows.some(r => /^Tracking: None/.test(r)) && rows.some(r => /^Paywall: None$/.test(r)),
      'the line of truth is told as rows, one guarantee to a line (' + rows.length + ')');
  }
  ok(html.includes('<h2 class="n2-h2">The whole library, <span class="n2-g">free</span></h2>'), 'the library screen says the same, with the key word in gold');
  ok(html.includes('with its date, and its source where the card names one'), 'the Lights claim a source only where a card names one');
  ok(!/whole of Islam/i.test(html), 'no "the whole of Islam"');
  /* the arrival: the question, the verse, the three Names, the toolkit */
  ok(/<p class="n2-eyebrow ask-eyebrow">Free · No ads · No account<\/p>/.test(html), 'the arrival opens with the short guarantee, three words wide');
  ok(/<h1 class="n2-h1 ask-h1">What do you want <span class="g">to know\?<\/span><\/h1>/.test(html), 'the headline is the question itself, its second half in gold');
  {
    const lead = (html.match(/<p class="ask-lead">([^<]*)<\/p>/) || [])[1] || '';
    ok(lead === 'The whole religion in one library, free and complete, and every answer carries the source it came from. Ask in your own words.', 'one paragraph under the question says what the library is, and what to do');
    ok(lead.length <= 140, 'and it is short enough to read in a breath (' + lead.length + ' characters)');
    ok(count(html.slice(html.indexOf('id="top"'), html.indexOf('id="ayah"')), /<p class="(n2-p|n2-dim|ask-lead)"/g) === 1, 'the arrival carries exactly one paragraph of prose');
  }
  ok(/<p class="n2-quran" lang="ar" translate="no">وَإِذَا سَأَلَكَ عِبَادِى عَنِّى فَإِنِّى قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ ٱلدَّاعِ إِذَا دَعَانِ<\/p>/.test(html), 'Qur\'an 2:186, the first half, in the Uthmani script');
  ok(html.includes('<p class="n2-meaning">And when My servants ask you concerning Me — indeed I am near.</p>'), 'with the first sentence of the Saheeh International meaning; the rest is on /verse/2-186');
  ok(/<p class="n2-ref"><a href="\/verse\/2-186">Qur'an 2:186 · Al-Baqarah<\/a><\/p>/.test(html), 'and its reference links to /verse/2-186');
  {
    const q = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/reels/quran-uthmani.json'), 'utf8'));
    ok(String(q.verses['2:186'] || '').startsWith('وَإِذَا سَأَلَكَ عِبَادِى عَنِّى فَإِنِّى قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ ٱلدَّاعِ إِذَا دَعَانِ'), 'the Arabic is the library\'s own Uthmani text, letter for letter');
    const src = fs.readFileSync(path.join(ROOT, 'allah.html'), 'utf8');
    for (const [ar, tr, gloss] of [['الرَّقِيب', 'Ar-Raqib', 'The Watchful'], ['الْقَادِر', 'Al-Qadir', 'The All-Powerful'], ['الرَّحْمَٰن', 'Ar-Rahman', 'The Most Merciful, whose mercy reaches all that is']]) {
      ok(src.includes('["' + ar + '","' + tr + '","' + gloss + '"'), 'allah.html glosses ' + tr + ' as "' + gloss + '"');
      ok(html.includes('<span lang="ar" translate="no">' + ar + '</span>' + tr + '</a>') && html.includes(gloss), 'the arrival carries ' + tr + ' with that gloss, linking to /allah');
    }
    ok(count(html, /<a href="\/allah"><span lang="ar"/g) === 3, 'three Names, three doors to /allah');
    /* the six questions: what somebody actually asks, a chevron at the edge;
       rows under hairlines, and every one of them a real link before any
       script runs, so the arrival works with JavaScript switched off */
    const asked = [...html.matchAll(/<li><a class="ask-q" href="([^"]+)"><span>([^<]+)<\/span><svg class="cv"[^>]*>[\s\S]*?<\/svg><\/a><\/li>/g)];
    ok(asked.length === 6 && count(html, /<ul class="ask-list" data-ask-list>/g) === 1, 'the six questions are one list of rows, not a grid of tiles (' + asked.length + ')');
    ok(asked.every(m => /^\/[a-z]/.test(m[1])) && new Set(asked.map(m => m[1])).size === 6, 'each ships as a real link into the room that answers it (' + asked.map(m => m[1]).join(' ') + ')');
    ok(asked.every(m => /\?$/.test(m[2])), 'and each is worded the way somebody would ask it, question mark and all');
    /* the field before the upgrade: a form, an action, a named input. With no
       script at all, typing and pressing enter is a GET to /ask */
    ok(/<form class="ask-field" role="search" action="\/ask" method="get">/.test(html)
      && /<input id="ask-in" name="q" type="search"/.test(html)
      && /<label class="notranslate" for="ask-in" hidden>Ask anything<\/label>/.test(html),
      'the field is a real search form with a named input and a label: without a script it is a GET to /ask');
    /* the four destinations the signpost used to carry by hand are still one
       tap from the arrival: they are rows of the library, in the menu's words */
    const shelf = html.slice(html.indexOf('id="library"'), html.indexOf('id="free"'));
    for (const [href, room] of [['/quran', 'The Mushaf'], ['/path', 'The Path of Creation'], ['/kids', "The Kids' Codex"], ['/masjid', 'The Masjid Toolbox']]) {
      const item = menuItem(room);
      ok(item && (item.u === href || (href === '/path' && item.u === '/#timeline')) && shelf.includes('<a href="' + href + '"><b>' + room + '<small>'), 'the door to ' + room + ' is a row of the library now, at ' + href);
    }
    ok(/<p class="ask-more"><a href="\/ask">Every question →<\/a><span aria-hidden="true">·<\/span><a href="#library">The whole library →<\/a><\/p>/.test(html), 'and one quiet way on: every question, and the whole library');
    ok(!/hm-ayah|hm-names[^{]*>[\s\S]{0,40}<\/section>/.test(html.slice(html.indexOf('id="top"'), html.indexOf('id="ayah"'))), 'no verse, no Names and no second paragraph on the arrival');
    /* the verse at the door is the second screen, set whole */
    const ideas = [...html.matchAll(/<section class="n2-idea[^"]*" id="([^"]+)"/g)].map(m => m[1]);
    ok(ideas.join(' ') === 'top ayah today verse library free', 'six screens, in order: ' + ideas.join(' · '));
    ok(/<section class="n2-idea" id="ayah">\s*<p class="n2-eyebrow">The promise<\/p>\s*<p class="n2-quran"[\s\S]*?<p class="n2-meaning">[\s\S]*?<p class="n2-ref">[\s\S]*?<div class="hm-names">[\s\S]*?<\/section>/.test(html), 'the verse screen is the Arabic, the meaning, the reference and the three Names, in that order');
    {
      const arrival = html.slice(html.indexOf('id="top"'), html.indexOf('id="ayah"'));
      ok(count(arrival, /<form/g) === 1 && !/n2-btn/.test(arrival), 'the field is the one action on the arrival: no button stands beside it');
    }
    ok(!/<section[^>]*id="(timeline|mizan|lib-[a-z]+)"/.test(html), 'no screen for the books of the Path, Two Lives or a single group: they are rows of the library');
    ok(/<ul class="n2-list hm-truths">/.test(html) && !/n2-facts/.test(html), 'the guarantees are rows under hairlines, not a grid of boxes');
    /* one paragraph of prose per screen, everywhere */
    {
      const secs = html.replace(/<script[\s\S]*?<\/script>/g, '').split(/<section class="n2-idea/).slice(1);
      const loud = secs.map(x => ({ id: (x.match(/id="([^"]+)"/) || [])[1], n: count(x, /<p class="(n2-p|n2-dim|ask-lead)"/g) })).filter(x => x.n > 1);
      ok(!loud.length, 'no screen carries more than one paragraph of prose' + (loud.length ? ' (' + loud.map(x => x.id + ':' + x.n).join(', ') + ')' : ''));
    }
  }
  /* No second person outside a control's label, the quoted verse and the one
     question the arrival asks. The field speaks to the reader because it is a
     question put to them and a request to answer it; those two lines are the
     whole of it, and the rest of the page keeps the house's voice. */
  {
    let text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '');
    text = text.replace(/aria-label="[^"]*"/g, '').replace(/<p class="n2-meaning">[^<]*<\/p>/g, '').replace(/<div class="n2-quote">[\s\S]*?<\/div>/g, '');
    const askedIt = [text.replace(/[\s\S]*(<h1 class="n2-h1 ask-h1">[\s\S]*?<\/h1>)[\s\S]*/, '$1'), text.replace(/[\s\S]*(<p class="ask-lead">[^<]*<\/p>)[\s\S]*/, '$1')];
    ok(askedIt.every(s => /\b(you|your)\b/i.test(s)), 'the arrival asks its question in the second person, and asks for an answer');
    text = text.replace(/<h1 class="n2-h1 ask-h1">[\s\S]*?<\/h1>/, '').replace(/<p class="ask-lead">[^<]*<\/p>/, '');
    /* the rooms' own lines out of the menu index are the library's words, not this page's */
    const menu = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/menu-index.json'), 'utf8'));
    for (const s of menu.sections) for (const it of s.items) { text = text.split(it.d.replace(/&/g, '&amp;')).join(''); text = text.split(it.t.replace(/&/g, '&amp;')).join(''); text = text.split(s.s).join(''); }
    const hits = [...text.replace(/<[^>]+>/g, ' ').matchAll(/\b(you|your|yours|yourself)\b/gi)].map(m => m[0]);
    ok(!hits.length, 'no second person in the page\'s own copy' + (hits.length ? ' (' + hits.length + ': ' + hits.slice(0, 4).join(', ') + ')' : ''));
  }
  ok(html.includes('Nothing here is asked for. The door of giving is open for whoever wishes; nothing is expected.'), 'the stance on giving is the owner\'s, as structural copy');
  ok(Buffer.byteLength(html) < 45 * 1024, 'the page is under 45 KB (' + Buffer.byteLength(html) + ')');
}

console.log('\n=== 4. the structured data ===');
{
  const ld = (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  let j = null; try { j = JSON.parse(ld); } catch (e) {}
  ok(j && Array.isArray(j['@graph']), 'the JSON-LD parses');
  const types = j ? j['@graph'].map(x => x['@type']) : [];
  ok(types.includes('Organization') && types.includes('WebSite'), 'it carries the Organization and the WebSite');
  const org = j && j['@graph'].find(x => x['@type'] === 'Organization');
  ok(org && org.sameAs && org.sameAs.length === 6, 'the Organization names its six doors');
}

console.log('\n=== 5. every door is real ===');
{
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const rewrites = (vercel.rewrites || []).map(r => new RegExp('^' + r.source.replace(/:[a-z]+/g, '[^/]+') + '$'));
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(h => /^[\/#]/.test(h) && !/^\/\//.test(h));
  const missing = [];
  for (const h of new Set(hrefs)) {
    if (h.startsWith('#')) { if (!ids.has(h.slice(1))) missing.push(h); continue; }
    const p = h.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
    if (p === '/') continue;
    const rel = p.slice(1);
    const found = fs.existsSync(path.join(ROOT, rel)) || fs.existsSync(path.join(ROOT, rel + '.html')) || fs.existsSync(path.join(ROOT, rel, 'index.html'))
      || rewrites.some(re => re.test(p));
    if (!found) missing.push(h);
  }
  ok(!missing.length, 'every internal href resolves to a file or a rewrite' + (missing.length ? ' (missing: ' + missing.join(', ') + ')' : ' (' + new Set(hrefs).size + ' checked)'));
  for (const id of ['top', 'today', 'verse', 'library', 'timeline', 'mizan', 'free', 'langs']) ok(ids.has(id), '#' + id + ' is on the page');
  const links = new Set([...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]));
  const menu = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/menu-index.json'), 'utf8'));
  let rooms = 0, lost = [];
  for (const s of menu.sections) for (const it of s.items) {
    if (it.u === '/donate') continue;                     /* the door of giving is its own screen */
    rooms++;
    /* the menu sends the Path to /#timeline: on this page that is the row of the Path itself, whose door is /path; /#mizan is the Two Lives row, which opens its sheet */
    const u = it.u === '/#timeline' ? '/path' : it.u.replace(/^\/#/, '#');
    const re = new RegExp((it.u === '/#timeline' ? '<li id="timeline">' : it.u === '/#mizan' ? '<li id="mizan">' : '<li>') + '<a href="' + u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"' + (it.u === '/#mizan' ? ' id="hm-mizan"' : '') + '><b>' + it.t.replace(/&/g, '&amp;').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '<small>' + it.d.replace(/&/g, '&amp;').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</small>');
    if (!re.test(html)) lost.push(it.u);
  }
  ok(!lost.length, 'every room of the menu index is a door on the page' + (lost.length ? ' (lost: ' + lost.join(', ') + ')' : ' (' + rooms + ')'));
  ok(new RegExp('<p class="hm-count">' + rooms + ' rooms · ' + menu.sections.length + ' sections').test(html), 'the count of rooms is the menu\'s own (' + rooms + ' · ' + menu.sections.length + ')');
  const rx = s => s.replace(/&/g, '&amp;').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const s of menu.sections) ok(new RegExp('<div class="hm-grp">\\s*<h3 class="n2-h3">' + rx(s.n) + '</h3>\\s*<ul class="n2-list">').test(html), 'the section "' + s.n + '" is a name over its doors, without the group\'s blurb');
  ok(!/hm-sub/.test(html) && !menu.sections.some(s => html.includes(s.s)), 'no group blurb anywhere');
  ok(/function fold\(\)/.test(html) && /aria-expanded/.test(html) && /hm-fold-w/.test(html), 'the script folds the sections; the file itself leaves every room open');
  ok(!/hm-shut|hm-fold"/.test(html.slice(html.indexOf('<main'), html.indexOf('</main>'))), 'nothing is folded in the markup, so a crawler and a reader without JavaScript see all 41 rooms');
  const src = fs.readFileSync(path.join(ROOT, 'nodes-index.js'), 'utf8');
  const NODES = JSON.parse(src.match(/const\s+NODES\s*=\s*(\[[\s\S]*?\]);/)[1]);
  ok(new RegExp(NODES.length + ' chapters, from Kun Fayakun').test(html), 'the Path counts ' + NODES.length + ' chapters in the library');
  ok(/"#mizan"/.test(html) && /Muslim 2858/.test(html) && /Bukhari 6416/.test(html) && /Bukhari 6412/.test(html) && /function mizan\(\)/.test(html), 'Two Lives keeps its three narrations, in a sheet');
  /* the footer's doors are the house's one list */
  const fx = fs.readFileSync(path.join(ROOT, 'noor-fx.js'), 'utf8');
  const social = [...fx.matchAll(/href: "(https:[^"]+)"/g)].map(m => m[1]);
  ok(social.length === 6 && !social.some(u => links.has(u)) && !/noor-social/.test(html), 'the page carries none of the six doors of NOOR_SOCIAL itself: noor-fx.js draws the row');
  ok(/<p data-i18n="footer.note">Qur'an · authentic Hadith · classical sirah<\/p>\s*<nav aria-label="Languages"/.test(html), 'the footer has the note line and the languages nav the row is placed between');
  for (const h of ['/license', '/journal', '/feedback', '/legal']) ok(new RegExp('<footer[\\s\\S]*href="' + h + '"').test(html), 'the footer links ' + h);
}

console.log('\n=== 6. the verse walks the shelf with the poster\'s stride ===');
{
  const S = await import('../api/_schedule.js');
  const inline = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '';
  const from = inline.indexOf('function hash32'), to = inline.indexOf('function verse()');
  const walk = new Function(inline.slice(from, to) + '; return { reelStep: reelStep, pickStep: pickStep, ROTA: ROTA, HALVES: HALVES };')();
  const cards = [];
  for (let i = 0; i < 37; i++) cards.push({ id: 'verse-' + i, kind: 'verse', slot: i % 2 ? 'evening' : 'morning', hook: '1:' + (i + 1), caption: 'c' });
  let same = 0, tried = 0;
  for (let d = 0; d < 120; d++) {
    const date = new Date(Date.UTC(2026, 8, 6) + d * 86400000).toISOString().slice(0, 10);
    const dow = new Date(date + 'T12:00:00Z').getUTCDay();
    for (const half of walk.HALVES) {
      if (walk.ROTA[half][dow] !== 'verse') continue;
      tried++;
      const theirs = S.chooseReel(cards, date, half, null);
      const ours = walk.pickStep(cards, walk.reelStep('verse', date, half), 'reel:verse');
      if (theirs && ours && theirs.id === ours.id) same++;
    }
  }
  ok(tried > 100 && same === tried, 'the page picks what chooseReel picks on every verse slot of 120 days (' + same + '/' + tried + ')');
  const rota = html.match(/var ROTA = \{([\s\S]*?)\};/)[1].replace(/\s+/g, '');
  const src = fs.readFileSync(path.join(ROOT, 'api/_schedule.js'), 'utf8');
  const theirRota = src.match(/const ROTA = \{([\s\S]*?)\};/)[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '');
  ok(rota === theirRota, 'the ROTA is copied letter for letter');
  ok(/REEL_EPOCH = Date\.UTC\(2026, 8, 6\)/.test(html) && /REEL_EPOCH = Date\.UTC\(2026, 8, 6\)/.test(src), 'the epoch is the same Sunday');
  ok(/copied faithfully from api\/_schedule\.js/.test(html), 'the copy names its source');
}

/* ------------------------------------------------------------------------
   the browser: the page on a phone and a laptop, with the library's answers
   and without them
------------------------------------------------------------------------ */
console.log('\n=== 7. in a browser ===');
let server = null;
const PORT = 8766;
const listening = p => new Promise(r => { const s = net.createConnection(p, '127.0.0.1'); s.once('connect', () => { s.end(); r(true); }); s.once('error', () => r(false)); });
let BASE = process.env.NOOR_BASE || '';
if (!BASE) {
  if (!(await listening(PORT))) {
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
    for (let i = 0; i < 40 && !(await listening(PORT)); i++) await new Promise(r => setTimeout(r, 150));
  }
  BASE = 'http://127.0.0.1:' + PORT;
}
const SHOTS = process.env.NOOR_SHOTS || path.join(ROOT, 'tests', '.shots', 'home');
fs.mkdirSync(SHOTS, { recursive: true });
let chromium = null;
try { ({ chromium } = await import('playwright')); } catch (e) { console.log('  playwright is not installed; the browser checks are skipped'); }
if (chromium) {
  const br = await chromium.launch();
  const LIGHT = { date: '2026-09-09', category: 'Libraries', title: 'He called his 1,600 books the smallest library in the family',
    story: 'When a Moroccan army took Timbuktu, its scholars were arrested, and in 1593 Ahmad Baba was taken in chains across the Sahara to Marrakesh.',
    detail: 'Ahmad Baba · Timbuktu and Marrakesh, 1593 CE', id: 'ahmad-baba', src: 'Hunwick, Timbuktu and the Songhay Empire' };
  /* the rows as the live manifest writes them (seen on noorcodex.com):
     the reference lives in the id, the hook carries the surah name too,
     cover is the boolean true (the file is /reels/<id>-cover.jpg) and the
     video is the release's own https URL */
  const REELS = { n: 2, written: '2026-09-09', cards: [
    { id: 'verse-1-1-7', kind: 'verse', slot: 'morning', hook: 'Al-Fatiha · 1:1-7', caption: 'Al-Fatiha · 1:1-7\n\nIn the name of Allah, the Entirely Merciful, the Especially Merciful. [All] praise is [due] to Allah, Lord of the worlds.\n\nRecited by Maher al-Muaiqly. Read the whole surah with its meaning, and hear every verse, free: noorcodex.com/quran\n\n#OneVerse', secs: 34.89, cover: true, video: 'https://github.com/Eouchi147/noor/releases/download/reels-verse/verse-1-1-7.mp4', reciter: 'Maher al-Muaiqly' },
    { id: 'verse-2-153', kind: 'verse', slot: 'evening', hook: 'Al-Baqarah · 2:153', caption: 'Al-Baqarah · 2:153\n\nO you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.\n\nRecited by Abdul Basit. Read the whole surah: noorcodex.com/quran', secs: 24, cover: true, reciter: 'Abdul Basit' }
  ] };
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const withFixtures = async pg => {
    await pg.route('**/api/illuminations**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LIGHT) }));
    await pg.route('**/reels/index.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(REELS) }));
    await pg.route('**/reels/*-cover.jpg', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  };
  const errors = [];
  const newPage = async (vp, mobile) => {
    const pg = await br.newPage({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    pg.on('pageerror', e => errors.push(String(e.message || e)));
    return pg;
  };
  const settle = pg => pg.waitForTimeout(1500);

  /* --- the phone, without the API: a static server has none --- */
  {
    const pg = await newPage({ width: 390, height: 844 }, true);
    await pg.goto(BASE + '/', { waitUntil: 'load' }); await settle(pg);
    const st = await pg.evaluate(() => ({
      glow: document.querySelectorAll('.n2-glow').length,
      still: !!document.querySelector('.n2-still'), gl: !!document.querySelector('#n2-gl'),
      bar: document.querySelectorAll('.n2-bar a').length, top: !!document.querySelector('.n2-top .n2-brand'),
      ideas: document.querySelectorAll('.n2-idea').length,
      today: document.querySelector('#today').innerText, verse: document.querySelector('#verse').innerText,
      wide: document.documentElement.scrollWidth <= window.innerWidth + 1,
      title: document.title, give: document.querySelectorAll('a[href="/donate"]').length,
      firstIn: document.querySelector('#top').classList.contains('n2-in'),
      notice: !!document.querySelector('#noor-notice'),
      social: document.querySelectorAll('[data-noor-social]').length,
      socialIn: (r => r ? { foot: !!r.closest('footer'), links: [...r.querySelectorAll('a')].map(a => a.getAttribute('href')), left: r.getBoundingClientRect().left, x: r.querySelector('a svg').getBoundingClientRect().left, tx: r.previousElementSibling.getBoundingClientRect().left } : null)(document.querySelector('[data-noor-social]')),
      minFont: Math.min(...[...document.querySelectorAll('main *')].filter(e => e.innerText && e.children.length === 0 && !e.closest('.ask-more')).map(e => parseFloat(getComputedStyle(e).fontSize))),
      wayOn: (a => a ? { size: parseFloat(getComputedStyle(a).fontSize), face: getComputedStyle(a).fontFamily, caps: getComputedStyle(a).textTransform } : null)(document.querySelector('.ask-more a')),
      field: document.querySelectorAll('.ask-field').length
    }));
    ok(st.glow === 0 && st.field === 1, 'nothing glows of itself in the DOM, and there is one action to glow: the field');
    ok(st.still && st.gl, 'the night is drawn (the still, and the canvas over it)');
    ok(st.bar === 5 && st.top, 'the bar has its five rooms and the top line its mark');
    ok(st.ideas >= 6 && st.ideas <= 7, 'six or seven screens, so the marks column draws (' + st.ideas + ')');
    const marks = await pg.evaluate(() => ({ n: document.querySelectorAll('.n2-dots i').length, pill: !!document.querySelector('.n2-dots .n2-dots-pill'), of: (document.querySelector('#top .n2-eyebrow .n2-of') || {}).textContent || '' }));
    ok(marks.n === st.ideas && marks.pill && /^01 \/ 0[67]$/.test(marks.of), 'the marks column has one mark per screen and its pill; the first eyebrow is numbered (' + marks.of + ')');
    ok(/One Light a day/.test(st.today) && !/error|could not|failed|resting/i.test(st.today), 'without the API, Today is a calm door');
    ok(/One verse, one thought/.test(st.verse) && !/error|could not|failed/i.test(st.verse), 'without the manifest, the verse is a calm door');
    ok(st.wide, 'the page does not scroll sideways on a phone');
    ok(st.give === 1, 'one door of giving in the DOM');
    ok(st.firstIn, 'the arrival is lit before the observer runs');
    ok(st.social === 1 && st.socialIn && st.socialIn.foot && st.socialIn.links.length === 6, 'noor-fx.js drew the row of six doors once, inside the footer');
    ok(st.socialIn && Math.abs(st.socialIn.x - st.socialIn.tx) < 2, 'and its first mark sits on the footer\'s left edge with the text');
    ok(st.minFont >= 12, 'no type under 12 px on a phone, the way on apart (' + st.minFont + ')');
    /* the way on is the eyebrow's register -- mono, caps, tracked -- and it is
       the one place on the page that sits under the floor, at 11.5 */
    ok(st.wayOn && st.wayOn.size >= 11 && /Mono|mono/.test(st.wayOn.face) && st.wayOn.caps === 'uppercase', 'and the way on is a tracked mono label, not prose (' + (st.wayOn || {}).size + ' px)');
    const box = e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height, w: r.width, left: r.left, right: r.right }; };
    const fitOf = () => pg.evaluate(() => {
      const bx = e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height, w: r.width, left: r.left, right: r.right }; };
      const t = document.getElementById('top'), a = document.getElementById('ayah'), q = a.querySelector('.n2-quran'), r = q.getBoundingClientRect();
      const lines = e => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight));
      const qs = [...t.querySelectorAll('.ask-q')].map(x => Object.assign(bx(x), { tag: x.tagName, href: x.getAttribute('data-url') || x.getAttribute('href'),
        expanded: x.getAttribute('aria-expanded'), chev: !!x.querySelector('svg.cv'), size: parseFloat(getComputedStyle(x).fontSize) }));
      const eb = t.querySelector('.n2-eyebrow'), h = t.querySelector('.n2-h1'), fd = t.querySelector('.ask-field'), list = t.querySelector('.ask-list'), more = t.querySelector('.ask-more');
      const want = ['p.ask-eyebrow', 'h1.ask-h1', 'p.ask-lead', 'form.ask-field', 'p[data-ask-live]', 'ul.ask-list', 'p.ask-more'];
      return { end: bx(more).bottom, bar: bx(document.querySelector('.n2-bar')).top, clip: q.scrollWidth > q.clientWidth + 1 || r.left < 0 || r.right > innerWidth,
        qs, eyebrow: bx(eb), eyebrowLines: lines(eb), h1: bx(h), h1Lines: lines(h), lead: bx(t.querySelector('.ask-lead')), leadLines: lines(t.querySelector('.ask-lead')),
        field: bx(fd), list: bx(list), more: bx(more),
        kids: [...t.children].length, inOrder: [...t.children].every((c, i) => !!want[i] && c.matches(want[i])),
        input: (i => i ? { name: i.name, type: i.type } : null)(t.querySelector('.ask-field input')),
        names: a.querySelectorAll('.hm-names a').length, verse: !!a.querySelector('a[href="/verse/2-186"]'), second: document.querySelectorAll('.n2-idea')[1] === a,
        wide: document.documentElement.scrollWidth <= innerWidth + 1 }; });
    let fit = await fitOf();
    /* the arrival, measured: the question, then the field, then the six */
    ok(fit.list.bottom <= fit.bar, 'the six questions stand clear of the bar at 390 by 844 (' + Math.round(fit.list.bottom) + ' <= ' + Math.round(fit.bar) + ')');
    ok(fit.end <= fit.bar, 'and so does the way on beneath them (' + Math.round(fit.end) + ')');
    ok(fit.eyebrowLines === 1, 'the eyebrow holds one line beside its numeral');
    ok(fit.h1Lines <= 2 && fit.h1.h >= 60, 'the question is two lines, not three (' + fit.h1Lines + ')');
    ok(fit.leadLines <= 4, 'the paragraph under it is four lines at most (' + fit.leadLines + ')');
    ok(Math.round(fit.field.top - fit.lead.bottom) >= 20, 'air before the field (' + Math.round(fit.field.top - fit.lead.bottom) + ' px)');
    ok(fit.field.h >= 50 && fit.field.h <= 58, 'the field is the one action, about 54 px tall (' + Math.round(fit.field.h) + ')');
    ok(fit.input && fit.input.name === 'q' && fit.input.type === 'search', 'and it is a named search input, so the form degrades to a GET (' + JSON.stringify(fit.input) + ')');
    ok(Math.round(fit.qs[0].top - fit.field.bottom) >= 16, 'air before the questions (' + Math.round(fit.qs[0].top - fit.field.bottom) + ' px)');
    ok(fit.qs.length === 6 && fit.qs.every(d => d.h >= 44 && d.h <= 76), 'six rows, each 44 to 76 px tall (' + fit.qs.map(d => Math.round(d.h)).join(', ') + ')');
    ok(fit.qs.every((d, i) => i === 0 || d.top > fit.qs[i - 1].top + 20), 'they stack as a vertical list, one under the other');
    ok(fit.qs.every(d => Math.abs(d.w - fit.qs[0].w) < 2 && d.w > 250), 'each row is the full width, so the whole row is the question');
    ok(fit.qs.every(d => d.chev && d.size >= 15), 'each row has its chevron and its 15 px line (' + fit.qs[0].size + ')');
    /* the upgrade has run: the six links are six disclosures now, all shut,
       each still carrying the href it shipped with as the room it opens */
    ok(fit.qs.every(d => d.tag === 'BUTTON' && d.expanded === 'false'), 'once the script has run each question is a button, shut (' + fit.qs.map(d => d.tag.toLowerCase() + ':' + d.expanded).join(' ') + ')');
    ok(fit.qs.map(d => d.href).join(' ') === '/dictionary/islam /dictionary/tawhid /theology#women /dictionary/nuzul-isa /dictionary/salah /dictionary/shahadah', 'and keeps the room it shipped with (' + fit.qs.map(d => d.href).join(' ') + ')');
    ok(fit.h1.top < fit.field.top && fit.field.top < fit.qs[0].top && fit.qs[5].bottom <= fit.more.top, 'the question, then the field, then the six, then the way on');
    ok(fit.kids === 7 && fit.inOrder, 'the arrival holds seven things and no more: the eyebrow, the question, the line under it, the field, the live line, the six and the way on (' + fit.kids + ')');
    ok(fit.second && fit.names === 3 && fit.verse, 'the verse of 2:186 with the three Names is the second screen');
    ok(!fit.clip, 'the Arabic of 2:186 is not clipped');
    /* the verse screen breathes, measured where it is read */
    await pg.evaluate(() => document.getElementById('ayah').scrollIntoView({ behavior: 'instant', block: 'start' })); await pg.waitForTimeout(900);
    const air = await pg.evaluate(() => { const a = document.getElementById('ayah'), q = a.querySelector('.n2-quran'), m = a.querySelector('.n2-meaning'), e = a.querySelector('.n2-eyebrow'), n = a.querySelector('.hm-names');
      const cs = getComputedStyle(q); return { above: q.getBoundingClientRect().top - e.getBoundingClientRect().bottom, below: m.getBoundingClientRect().top - q.getBoundingClientRect().bottom,
        centred: cs.textAlign === 'center', big: parseFloat(cs.fontSize), namesAir: n.getBoundingClientRect().top - a.querySelector('.n2-ref').getBoundingClientRect().bottom,
        rule: getComputedStyle(n, '::before').height, end: n.getBoundingClientRect().bottom, bar: document.querySelector('.n2-bar').getBoundingClientRect().top }; });
    ok(air.centred && air.big >= 26, 'the Arabic is large and centred (' + Math.round(air.big) + ' px)');
    ok(air.above >= 30 && air.below >= 30, 'with about 32 px of air above and below (' + Math.round(air.above) + ', ' + Math.round(air.below) + ')');
    ok(air.namesAir >= 22 && air.rule === '1px', 'the three Names sit under a hairline, 24 px down (' + Math.round(air.namesAir) + ')');
    ok(air.end <= air.bar, 'and the verse screen fits above the bar (' + Math.round(air.end) + ' <= ' + Math.round(air.bar) + ')');
    await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(700);
    const namesRow = () => pg.evaluate(() => { const as = [...document.querySelectorAll('.hm-names a')].map(a => a.getBoundingClientRect()); return { oneRow: Math.max(...as.map(r => r.top)) - Math.min(...as.map(r => r.top)) < 2, clipped: [...document.querySelectorAll('.hm-names a')].some(a => a.scrollWidth > a.clientWidth + 1) }; });
    let nr = await namesRow();
    ok(nr.oneRow && !nr.clipped, 'the three Names hold one row at 390');
    await pg.setViewportSize({ width: 360, height: 780 }); await pg.waitForTimeout(500);
    nr = await namesRow();
    fit = await fitOf();
    ok(nr.oneRow && !nr.clipped, 'and at 360');
    /* at 360 by 780 the six still stand whole above the bar; the way on under
       them falls behind it, a hair of scroll away, which is the price of six
       questions rather than four doors */
    ok(fit.list.bottom <= fit.bar, 'the six questions stand clear of the bar at 360 by 780 too (' + Math.round(fit.list.bottom) + ' <= ' + Math.round(fit.bar) + ')');
    ok(!fit.clip && fit.wide, 'the Arabic is whole there, and nothing scrolls sideways');
    ok(fit.h1Lines <= 2 && fit.leadLines <= 4 && fit.eyebrowLines === 1, 'the question, the paragraph and the eyebrow keep their line counts at 360');
    ok(fit.qs.length === 6 && fit.qs.every(d => d.h >= 44 && d.h <= 76), 'the rows keep their height at 360 (' + fit.qs.map(d => Math.round(d.h)).join(', ') + ')');
    await pg.screenshot({ path: path.join(SHOTS, 'phone-1-arrival-360.png') });
    await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(400);
    await pg.screenshot({ path: path.join(SHOTS, 'phone-1-arrival.png') });
    for (const [id, name] of [['ayah', 'phone-2-verse-at-the-door'], ['today', 'phone-3-today-bare'], ['verse', 'phone-4-verse-bare'], ['library', 'phone-5-library'], ['free', 'phone-8-no-catch']]) {
      await pg.evaluate(i => document.getElementById(i).scrollIntoView({ behavior: 'instant', block: 'start' }), id);
      await pg.waitForTimeout(1300);
      await pg.screenshot({ path: path.join(SHOTS, name + '.png') });
    }
    await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await pg.waitForTimeout(1200);
    await pg.screenshot({ path: path.join(SHOTS, 'phone-9-footer.png') });
    /* the library reads as a directory: eight headings, only the first open */
    await pg.evaluate(() => document.getElementById('library').scrollIntoView({ behavior: 'instant', block: 'start' })); await pg.waitForTimeout(900);
    const lib = await pg.evaluate(() => {
      const gs = [...document.querySelectorAll('.hm-grp')];
      const shown = [...document.querySelectorAll('.hm-grp .n2-list')].filter(u => getComputedStyle(u).visibility !== 'hidden').reduce((n, u) => n + u.children.length, 0);
      return { groups: gs.length, folded: gs.filter(g => g.classList.contains('hm-fold')).length, shut: gs.filter(g => g.classList.contains('hm-shut')).length,
        buttons: document.querySelectorAll('.hm-grp .n2-h3 button').length, counts: gs.map(g => (g.querySelector('.hm-n') || {}).textContent),
        rooms: document.querySelectorAll('.hm-grp .n2-list a').length, shown,
        height: document.getElementById('library').getBoundingClientRect().height, vh: innerHeight,
        first: gs[0].querySelector('button').getAttribute('aria-expanded'),
        heads: gs.map(g => Math.round(g.querySelector('button').getBoundingClientRect().height)) };
    });
    ok(lib.groups === 8 && lib.folded === 8 && lib.buttons === 8, 'the library is eight sections, each heading its own control');
    ok(lib.shut === 7 && lib.first === 'true', 'seven are folded shut and the first stands open');
    ok(lib.rooms === 41 && lib.shown <= 12, 'all 41 rooms are in the DOM, only the open section reachable (' + lib.shown + ' shown)');
    ok(lib.counts.join(' ') === '3 6 6 7 8 3 3 5', 'each heading carries its own count of rooms (' + lib.counts.join(' ') + ')');
    ok(lib.heads.every(h => h >= 48), 'every heading is a 48 px control or taller (' + lib.heads.join(', ') + ')');
    ok(lib.height < lib.vh * 2, 'the library screen is under two phone heights, a directory rather than a wall (' + Math.round(lib.height) + ' vs ' + lib.vh + ')');
    await pg.screenshot({ path: path.join(SHOTS, 'phone-5b-library-folded.png') });
    /* a heading opens its section on the spring */
    await pg.evaluate(() => document.querySelectorAll('.hm-grp')[3].querySelector('button').click()); await pg.waitForTimeout(1000);
    ok(await pg.evaluate(() => { const g = document.querySelectorAll('.hm-grp')[3]; return !g.classList.contains('hm-shut') && g.querySelector('button').getAttribute('aria-expanded') === 'true'; }), 'a heading opens its section');
    await pg.evaluate(() => document.getElementById('mizan').scrollIntoView({ behavior: 'instant', block: 'center' })); await pg.waitForTimeout(500);
    await pg.screenshot({ path: path.join(SHOTS, 'phone-6-library-story.png') });
    /* the Two Lives row, inside that section, opens its sheet */
    await pg.click('#hm-mizan'); await pg.waitForTimeout(900);
    const mz = await pg.evaluate(() => (document.querySelector('.n2-sheet-wrap.n2-show .n2-sheet') || {}).textContent || '');
    ok(/Two lives, in true scale/.test(mz) && /Muslim 2858/.test(mz) && /Bukhari 6412/.test(mz), 'the Two Lives row opens the three narrations in a sheet');
    await pg.screenshot({ path: path.join(SHOTS, 'phone-7-two-lives.png') });
    await pg.click('.n2-sheet [data-n2-close]'); await pg.waitForTimeout(600);
    /* A question opens its answer where it stands: the words of the room that
       answers it, and the door into that room. One at a time, so tapping a
       second shuts the first -- the arrival never becomes a wall of prose. */
    await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(600);
    /* the one action lights only under the hand: dark until it is used */
    const lit = await pg.evaluate(async () => {
      const f = document.querySelector('.ask-field'), off = getComputedStyle(f).boxShadow;
      document.getElementById('ask-in').focus();
      let on = off;                                   /* the ring is a transition: wait it out */
      for (let i = 0; i < 40 && !/233, 200, 106/.test(on); i++) { await new Promise(r => setTimeout(r, 50)); on = getComputedStyle(f).boxShadow; }
      document.getElementById('ask-in').blur(); window.scrollTo(0, 0);
      return { off: off, on: on };
    });
    ok(lit.off === 'none' && /233, 200, 106/.test(lit.on), 'the field is dark until it is used, and then it carries the gold ring (' + lit.off + ' → ' + lit.on.split(')')[0] + ')');
    await pg.waitForTimeout(400);
    await pg.evaluate(() => document.querySelectorAll('.ask-q')[0].click()); await pg.waitForTimeout(900);
    const one = await pg.evaluate(() => {
      const b = document.querySelectorAll('.ask-q')[0], p = b.parentNode.querySelector('.ask-a');
      return { exp: b.getAttribute('aria-expanded'), open: document.querySelectorAll('.ask-a.on').length,
        tall: p ? Math.round(p.getBoundingClientRect().height) : 0,
        prose: p ? ((p.querySelector('p.p') || {}).textContent || '').length : 0,
        go: p ? (p.querySelector('a.go') || {}).getAttribute('href') : null,
        inside: p ? p.closest('li') === b.parentNode : false };
    });
    ok(one.exp === 'true' && one.open === 1 && one.tall > 100, 'tapping a question opens its answer where it stands (' + one.tall + ' px)');
    ok(one.prose > 80 && one.go === '/dictionary/islam' && one.inside, 'the panel is a paragraph and a door into the room that answers it (' + one.prose + ' characters)');
    await pg.screenshot({ path: path.join(SHOTS, 'phone-10-answer.png') });
    await pg.evaluate(() => document.querySelectorAll('.ask-q')[3].click()); await pg.waitForTimeout(900);
    const two = await pg.evaluate(() => ({ exp: [...document.querySelectorAll('.ask-q')].map(b => b.getAttribute('aria-expanded')),
      open: document.querySelectorAll('.ask-a.on').length, go: [...document.querySelectorAll('.ask-a.on a.go')].map(a => a.getAttribute('href')) }));
    ok(two.open === 1 && two.go.join('') === '/dictionary/nuzul-isa' && two.exp.join(' ') === 'false false false true false false', 'a second question shuts the first: one answer is open at a time (' + two.exp.join(' ') + ')');
    /* two letters and the whole library answers in the same list: the
       questions that match first, then the rooms, the words, the people */
    await pg.fill('#ask-in', 'pray'); await pg.waitForTimeout(1600);
    const found = await pg.evaluate(() => ({ rows: document.querySelectorAll('.ask-list a.ask-r').length,
      qs: document.querySelectorAll('.ask-list .ask-q').length, first: (document.querySelector('.ask-list li') || {}).className,
      groups: [...document.querySelectorAll('.ask-grp')].map(g => g.textContent), live: (document.querySelector('[data-ask-live]') || {}).textContent || '' }));
    ok(found.rows > 4 && found.first === 'ask-grp' && found.groups[0] === 'Answered here', 'two letters replace the six with results, the questions that match put first (' + found.groups.slice(0, 3).join(' · ') + ')');
    ok(/^\d+ results? for pray$/.test(found.live), 'and the live line says how many, in the reader\'s own words (' + found.live + ')');
    await pg.screenshot({ path: path.join(SHOTS, 'phone-10b-results.png') });
    await pg.fill('#ask-in', ''); await pg.waitForTimeout(1200);
    const back = await pg.evaluate(() => ({ qs: [...document.querySelectorAll('.ask-list .ask-q')].map(b => b.tagName + ':' + b.getAttribute('aria-expanded') + ':' + b.getAttribute('data-url')),
      items: document.querySelectorAll('.ask-list > li').length, open: document.querySelectorAll('.ask-a.on').length }));
    ok(back.items === 6 && back.qs.length === 6 && back.open === 0, 'clearing the field puts the six back, all shut (' + back.items + ')');
    ok(back.qs.every(q => /^BUTTON:false:\//.test(q)), 'and they are buttons again, each with its room (' + back.qs[0] + ')');
    /* the More sheet the field used to open is the menu door's now, and the
       bar's fifth door: the map of the house, whole */
    await pg.click('.hm-menu'); await pg.waitForTimeout(900);
    ok(await pg.evaluate(() => !!document.querySelector('.nmr.on')), 'the menu door opens the More sheet');
    ok(await pg.evaluate(() => document.querySelectorAll('.nmr .nmr-r').length === 42),
       'and it is the whole library: forty-two rooms');
    ok(await pg.evaluate(() => !document.getElementById('nd')), 'and the dial it replaced is gone');
    await pg.screenshot({ path: path.join(SHOTS, 'phone-10-search.png') });
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
    /* the language door */
    await pg.click('#lang-btn'); await pg.waitForTimeout(900);
    const langs = await pg.evaluate(() => document.querySelectorAll('.n2-sheet [data-setlang]').length);
    ok(langs === 14, 'the language door offers the fourteen marked languages (' + langs + ')');
    await pg.screenshot({ path: path.join(SHOTS, 'phone-11-language.png') });
    await pg.click('.n2-sheet [data-setlang="ar"]'); await pg.waitForTimeout(1500);
    const rtl = await pg.evaluate(() => [document.documentElement.dir, document.documentElement.lang, document.querySelector('#lang-cur').textContent]);
    ok(rtl[0] === 'rtl' && rtl[1] === 'ar' && rtl[2] === 'AR', 'choosing Arabic turns the page (' + rtl.join(' · ') + ')');
    await pg.screenshot({ path: path.join(SHOTS, 'phone-12-arabic.png') });
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'and it still does not scroll sideways');
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await pg.close();
  }
  /* --- ?node=2 opens the chapter, #node-2 too, ?lang= is honoured --- */
  {
    const pg = await newPage({ width: 390, height: 844 }, true);
    await pg.goto(BASE + '/?node=2', { waitUntil: 'load' }); await pg.waitForTimeout(1800);
    const sh = await pg.evaluate(() => { const s = document.querySelector('.n2-sheet-wrap.n2-show .n2-sheet'); return s ? s.textContent : ''; });
    ok(/chapter 2 of 71/.test(sh) && /Adam from Clay/.test(sh) && /Read the chapter/.test(sh), '?node=2 opens the chapter in a sheet');
    ok(/Pride refused the command/.test(sh), 'with its first lesson from /node/2.json');
    await pg.screenshot({ path: path.join(SHOTS, 'phone-13-chapter.png') });
    await pg.goto(BASE + '/#node-71', { waitUntil: 'load' }); await pg.waitForTimeout(1800);
    ok(await pg.evaluate(() => /chapter 71 of 71/.test((document.querySelector('.n2-sheet-wrap.n2-show .n2-sheet') || {}).textContent || '')), '#node-71 opens the last chapter');
    await pg.goto('about:blank'); await pg.goto(BASE + '/#mizan', { waitUntil: 'load' }); await pg.waitForTimeout(1800);
    ok(await pg.evaluate(() => /Muslim 2858/.test((document.querySelector('.n2-sheet-wrap.n2-show .n2-sheet') || {}).textContent || '')), '/#mizan, the door 56 rooms point at, opens Two Lives');
    await pg.goto('about:blank'); await pg.goto(BASE + '/#timeline', { waitUntil: 'load' }); await pg.waitForTimeout(1800);
    /* the Path's row lives in a folded section, so the anchor must unfold it */
    ok(await pg.evaluate(() => { const el = document.getElementById('timeline'), g = el.closest('.hm-grp'); return !g.classList.contains('hm-shut') && el.getBoundingClientRect().height > 0; }), '/#timeline, the menu\'s door to the Path, unfolds the section it lives in');
    await pg.goto(BASE + '/?lang=fr', { waitUntil: 'load' }); await pg.waitForTimeout(1500);
    ok(await pg.evaluate(() => document.documentElement.lang === 'fr'), '?lang=fr is honoured by the language layer');
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await pg.close();
  }
  /* --- the phone, with the library's answers --- */
  {
    const pg = await newPage({ width: 390, height: 844 }, true);
    await withFixtures(pg);
    await pg.goto(BASE + '/', { waitUntil: 'load' }); await settle(pg);
    const st = await pg.evaluate(() => ({
      gold: (document.querySelector('#today .n2-h2 .n2-g') || {}).textContent || '',
      title: document.querySelector('#today .n2-h2').textContent,
      share: document.querySelectorAll('#today [data-n2-share]').length,
      light: (document.querySelector('#today a.n2-gold') || {}).getAttribute('href'),
      ref: (document.querySelector('#verse .n2-ref') || {}).textContent || '',
      meaning: (document.querySelector('#verse .n2-meaning') || {}).textContent || '',
      video: (v => v ? { preload: v.preload, paused: v.paused, poster: v.poster, src: v.getAttribute('src'), controls: v.hasAttribute('controls'), inline: v.hasAttribute('playsinline') } : null)(document.querySelector('#verse video')),
      verseLink: (document.querySelector('#verse a.n2-gold') || {}).getAttribute('href'),
      glow: document.querySelectorAll('.n2-glow').length
    }));
    ok(st.title.includes('1,600 books') && st.gold === '1,600 books', 'the day\'s Light is on the page with its key phrase in gold');
    ok(st.share === 1 && st.light === '/light/ahmad-baba', 'with a Share button and the door to the whole Light');
    /* the page reads the real clock and takes the FIRST verse half of today
       in HALVES order, so the expected card is what api/_schedule.js's
       chooseReel picks for that half today, not a card typed here: a typed
       card held only on the day it was typed */
    const S2 = await import('../api/_schedule.js');
    const inline2 = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '';
    const walk2 = new Function(inline2.slice(inline2.indexOf('function hash32'), inline2.indexOf('function verse()')) + '; return { ROTA: ROTA, HALVES: HALVES };')();
    const todayISO = new Date().toISOString().slice(0, 10), dow = new Date(todayISO + 'T12:00:00Z').getUTCDay();
    const halfUsed = walk2.HALVES.filter(h => walk2.ROTA[h][dow] === 'verse')[0] || 'morning';
    const want = S2.chooseReel(REELS.cards, todayISO, halfUsed, null);
    const wantId = String(want.id).replace(/^verse-/, ''), wantRef = wantId.replace(/^(\d+)-(\d+)/, '$1:$2');
    const wantMeaning = want.caption.split(/\n\s*\n/)[1].trim();
    const wantVideo = /^https:/.test(want.video) ? want.video : '/reels/' + want.id + '.mp4';
    ok(st.ref === 'Qur\u2019an ' + wantRef, 'the verse is the reel the rota picks today for the ' + halfUsed + ' half, its reference read from the id (' + st.ref + ')');
    ok(st.meaning === wantMeaning, 'with its meaning, the caption\'s second paragraph');
    ok(st.video && st.video.preload === 'none' && st.video.paused && st.video.controls && st.video.inline && new RegExp('/reels/' + want.id + '-cover\\.jpg$').test(st.video.poster) && st.video.src === wantVideo, 'the reel waits for a tap: the video where the row says, the cover at /reels/<id>-cover.jpg');
    ok(st.verseLink === '/verse/' + wantId, 'and the verse has its own room');
    ok((await pg.evaluate(() => document.querySelector('#verse .n2-eyebrow').textContent)).includes(want.reciter), 'the reciter is named');
    ok(st.glow === 0, 'still nothing glowing of itself');
    const nums = await pg.evaluate(() => [...document.querySelectorAll('.n2-idea')].map(s => ((s.firstElementChild || {}).querySelector ? (s.firstElementChild.querySelector('.n2-of') || {}).textContent : '') || ''));
    ok(nums.join(' ') === '01 / 06 02 / 06 03 / 06 04 / 06 05 / 06 06 / 06', 'every screen keeps its numeral once the library has answered (' + nums.join(' · ') + ')');
    await pg.evaluate(() => document.getElementById('today').scrollIntoView({ behavior: 'instant' })); await pg.waitForTimeout(1300);
    await pg.screenshot({ path: path.join(SHOTS, 'phone-14-today.png') });
    await pg.evaluate(() => document.getElementById('verse').scrollIntoView({ behavior: 'instant' })); await pg.waitForTimeout(1300);
    await pg.screenshot({ path: path.join(SHOTS, 'phone-15-verse.png') });
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll with the reel in place');
    await pg.close();
  }
  /* --- the laptop --- */
  {
    const pg = await newPage({ width: 1280, height: 800 }, false);
    await withFixtures(pg);
    await pg.goto(BASE + '/', { waitUntil: 'load' }); await settle(pg);
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'the page does not scroll sideways on a laptop');
    const dk = await pg.evaluate(() => { const t = document.getElementById('top'), h = t.querySelector('.n2-h1').getBoundingClientRect(), s = t.querySelector('.ask-field').getBoundingClientRect(), d = t.querySelector('.ask-list').getBoundingClientRect(), e = t.querySelector('.n2-eyebrow').getBoundingClientRect();
      const dots = document.querySelector('.n2-dots').getBoundingClientRect(), box = t.getBoundingClientRect();
      return { oneCol: Math.abs(s.left - h.left) < 2 && Math.abs(d.left - h.left) < 2 && Math.abs(e.left - h.left) < 2 && s.top > h.bottom && d.top > s.bottom,
        centred: Math.abs((box.left + box.right) / 2 - innerWidth / 2) < 2, column: box.width <= 620 && box.width >= 480, width: Math.round(box.width),
        above: d.bottom <= document.querySelector('.n2-bar').getBoundingClientRect().top,
        dotsClear: dots.left + 8 >= box.right && dots.right <= innerWidth,
        h1Lines: Math.round(h.height / parseFloat(getComputedStyle(t.querySelector('.n2-h1')).lineHeight)), rows: [...t.querySelectorAll('.ask-q')].map(a => Math.round(a.getBoundingClientRect().height)) }; });
    ok(dk.oneCol && dk.h1Lines <= 2, 'on a laptop the arrival is one column: the question in two lines, then the field, then the six');
    ok(dk.above, 'and the six questions sit above the bar at 1280 by 800');
    ok(dk.centred && dk.column && dk.dotsClear, 'the arrival holds a reading column in the middle of the screen (' + dk.width + ' px wide), the marks column clear to its right');
    ok(dk.rows.length === 6 && dk.rows.every(h => h >= 44 && h <= 60), 'the six rows keep their height on a laptop (' + dk.rows.join(', ') + ')');
    await pg.screenshot({ path: path.join(SHOTS, 'desk-1-arrival.png') });
    await pg.evaluate(() => document.getElementById('today').scrollIntoView({ behavior: 'instant' })); await pg.waitForTimeout(1300);
    await pg.screenshot({ path: path.join(SHOTS, 'desk-2-today.png') });
    await pg.evaluate(() => document.getElementById('verse').scrollIntoView({ behavior: 'instant' })); await pg.waitForTimeout(1300);
    await pg.screenshot({ path: path.join(SHOTS, 'desk-3-verse.png') });
    await pg.evaluate(() => document.getElementById('library').scrollIntoView({ behavior: 'instant' })); await pg.waitForTimeout(1300);
    await pg.screenshot({ path: path.join(SHOTS, 'desk-4-library.png') });
    await pg.evaluate(() => document.getElementById('free').scrollIntoView({ behavior: 'instant' })); await pg.waitForTimeout(1300);
    await pg.screenshot({ path: path.join(SHOTS, 'desk-5-no-catch.png') });
    /* every screen lit once scrolled, for the whole-page shot */
    await pg.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await pg.waitForTimeout(1500);
    await pg.screenshot({ path: path.join(SHOTS, 'desk-6-whole.png'), fullPage: true });
    await pg.close();
  }
  ok(!errors.length, 'no script error in any page' + (errors.length ? ' (' + errors.slice(0, 3).join(' | ') + ')' : ''));
  await br.close();
  console.log('  screenshots in ' + SHOTS);
}
if (server) server.kill();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
