/* NOOR · the menu
   ===========================================================================
   The first two versions of this were a pan-and-zoom star map. It photographed
   beautifully and it did not work, for two reasons that are well documented
   rather than particular to us:

     · a force-directed field collapses into a "hairball" somewhere past two
       hundred nodes, and we have 758;
     · on a touch screen, free pan-and-zoom fights the tap. Every finger-down
       is ambiguous, and an unlabelled 2px dot cannot be read before it is
       committed to.

   The Tube map works with a thumb because it does neither: fixed layout, every
   station named, no infinite zoom. So the sky here is now a painting behind
   the menu, taking no input at all, and in front of it each kind of content
   gets the pattern that fits its shape -- shelves for a small set, a lit path
   for a sequence, a keypad for numbers, an A-Z rail for an alphabet.

   The index is fetched once, on first open, so 54 pages do not each carry
   120KB of it.
   =========================================================================== */
(function () {
  "use strict";
  if (window.__noorMenu) return; window.__noorMenu = 1;

  var INDEX = "/assets/menu-index.json?v=1";
  var REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fold(s){
    return (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
      .replace(/['’ʻʼ`]/g,"").replace(/[^a-z0-9؀-ۿ ]+/g," ").replace(/\s+/g," ").trim();
  }
  function esc(s){
    return String(s==null?"":s).replace(/[&<>"]/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; });
  }

  var root = document.createElement("div");
  root.className = "nm-root"; root.setAttribute("role","dialog");
  root.setAttribute("aria-modal","true"); root.setAttribute("aria-label","The library");
  root.innerHTML =
      '<canvas class="nm-canvas" aria-hidden="true"></canvas>'
    + '<div class="nm-head">'
    +   '<label class="nm-field">'
    +     '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
    +     '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>'
    +     '<input id="nm-q" type="search" autocomplete="off" spellcheck="false" aria-label="Search the library">'
    +   '</label>'
    +   '<button class="nm-shut" data-nm="shut" aria-label="Close">&times;</button>'
    + '</div>'
    + '<div class="nm-page"><nav class="nm-jump"></nav><div class="nm-body"></div></div>'
    + '<div class="nm-bubble" aria-hidden="true"></div>'
    + '<p class="nm-sr" role="status" aria-live="polite"></p>';

  var qEl, pageEl, bodyEl, jumpEl, bubbleEl, sayEl, cv, cx;
  var D = null, THINGS = [], matched = null, ready = false, loading = null;
  var ORDER = ["Rooms","Words of the Path","The Path","Surahs"];
  var ERAC = { bidaya:"#8FB8FF", qisas:"#E8C874", jahiliyyah:"#8C8F9E",
    seerah:"#FFF0C4", khulafa:"#F0C9A0", umam:"#C8A2E8", nihaya:"#F08A8A" };

  /* ---------------------------------------------------------------- data */
  function build(j){
    D = j;
    j.sections.forEach(function(s){ s.items.forEach(function(it){
      THINGS.push({kind:"Rooms", t:it.t, d:it.d, u:it.u}); }); });
    j.path.forEach(function(n){
      THINGS.push({kind:"The Path", t:n.t, a:n.a, u:"/#node-"+n.i,
        d:"chapter "+n.i+" · "+(j.eras[n.p]||n.p)}); });
    for (var i=1;i<=114;i++)
      THINGS.push({kind:"Surahs", t:"Surah "+i, d:"open the Mushaf at "+i, u:"/quran?surah="+i});
    j.words.forEach(function(w){
      THINGS.push({kind:"Words of the Path", t:w.t, a:w.a, d:w.s, u:"/dictionary#"+w.i}); });
    THINGS.forEach(function(o){ o.f = fold(o.t+" "+(o.d||"")) + " " + (o.a||""); });
    ready = true;
  }
  function load(){
    if (ready) return Promise.resolve();
    if (loading) return loading;
    loading = fetch(INDEX, {cache:"force-cache"})
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){ if (j) build(j); })
      .catch(function(){});
    return loading;
  }

  /* -------------------------------------------------------------- search */
  function runSearch(v){
    var q = fold(v);
    if (!q){ matched = null; return; }
    var hits = [];
    for (var i=0;i<THINGS.length;i++){
      var o = THINGS[i], at = o.f.indexOf(q);
      if (at < 0) continue;
      var starts = at === 0 || o.f.charAt(at-1) === " ";
      hits.push([(starts?0:1)*100 + ORDER.indexOf(o.kind)*10 + Math.min(at,9), i, o]);
    }
    hits.sort(function(a,b){ return a[0]-b[0] || a[1]-b[1]; });
    matched = hits.map(function(h){ return h[2]; });
  }
  function mark(text,q){
    if (!q) return esc(text);
    var i = fold(text).indexOf(fold(q));
    if (i < 0) return esc(text);
    return esc(text.slice(0,i)) + "<span class='nm-hit'>" + esc(text.slice(i,i+q.length))
      + "</span>" + esc(text.slice(i+q.length));
  }

  /* ------------------------------------------------------------ browsing */
  var ZONES = [["rooms","The rooms"],["path","The Path"],["quran","The Mushaf"],["words","The words"]];

  function drawJump(){
    jumpEl.innerHTML = matched ? "" : ZONES.map(function(z){
      return '<button class="nm-jc" data-jump="'+z[0]+'">'+esc(z[1])+'</button>'; }).join("");
  }

  function shelves(){
    return '<section class="nm-zone" id="nm-z-rooms"><div class="nm-wrap">'
      + '<p class="nm-zt"><span>Eight sections</span></p>'
      + '<div class="nm-zt"><h2>The rooms</h2></div>'
      + '<p class="nm-zs">Every room in the house, grouped so each one has a single obvious home.</p>'
      + D.sections.map(function(s){
          return '<div class="nm-shelf"><p class="nm-sh"><b>'+esc(s.n)+'</b><em>'
            + s.items.length+' rooms</em></p><div class="nm-rail">'
            + s.items.map(function(it){
                return '<button class="nm-card" data-u="'+esc(it.u)+'"><b>'+esc(it.t)
                  + '</b><span>'+esc(it.d)+'</span></button>'; }).join("")
            + '</div></div>'; }).join("")
      + '</div></section>';
  }

  function pathZone(){
    var out = '<section class="nm-zone" id="nm-z-path"><div class="nm-wrap">'
      + '<div class="nm-zt"><h2>The Path</h2><span>' + D.path.length + ' chapters</span></div>'
      + '<p class="nm-zs">Creation to the Hour, in the order it happened. Scroll down through it.</p>'
      + '<div class="nm-path"><svg class="nm-spine" aria-hidden="true"></svg>';
    var era = null;
    D.path.forEach(function(n){
      if (n.p !== era){
        era = n.p;
        out += '<p class="nm-era" style="color:'+(ERAC[era]||"#E8C874")+'">'
             + esc(D.eras[era]||era) + '</p>';
      }
      out += '<button class="nm-step" data-u="/#node-'+n.i+'" data-era="'+esc(n.p)+'">'
           + '<b>'+esc(n.t)+'</b><i>Chapter '+n.i+'</i>'
           + (n.a ? '<span class="nm-ar">'+esc(n.a)+'</span>' : '')
           + '</button>';
    });
    return out + '</div></div></section>';
  }

  function quranZone(){
    var cells = "";
    for (var i=1;i<=114;i++)
      cells += '<button class="nm-cell" data-u="/quran?surah='+i+'" aria-label="Surah '+i+'">'+i+'</button>';
    return '<section class="nm-zone" id="nm-z-quran"><div class="nm-wrap">'
      + '<div class="nm-zt"><h2>The Mushaf</h2><span>114 surahs</span></div>'
      + '<p class="nm-zs">Every surah by number, with recitation for each ayah.</p>'
      + '<div class="nm-grid">'+cells+'</div></div></section>';
  }

  function wordsZone(){
    var by = {}, letters = [];
    D.words.forEach(function(w){
      var L = (fold(w.t)[0]||"#").toUpperCase();
      if (!/[A-Z]/.test(L)) L = "#";
      if (!by[L]){ by[L] = []; letters.push(L); }
      by[L].push(w);
    });
    letters.sort();
    var out = '<section class="nm-zone" id="nm-z-words"><div class="nm-wrap">'
      + '<div class="nm-zt"><h2>The words</h2><span>' + D.words.length + '</span></div>'
      + '<p class="nm-zs">Every word this library uses, defined. Drag the letters down the '
      + 'right-hand edge to move through them.</p><div class="nm-words">'
      + '<div class="nm-az" aria-hidden="true">'
      + letters.map(function(L){ return '<b data-l="'+L+'">'+L+'</b>'; }).join("") + '</div>';
    letters.forEach(function(L){
      out += '<p class="nm-letter" id="nm-l-'+L+'">'+L+'</p>';
      by[L].forEach(function(w){
        out += '<button class="nm-word" data-u="/dictionary#'+esc(w.i)+'">'
          + '<span class="nm-t"><b>'+esc(w.t)+'</b><span>'+esc(w.s)+'</span></span>'
          + (w.a ? '<span class="nm-ar">'+esc(w.a)+'</span>' : '') + '</button>';
      });
    });
    return out + '</div></div></section>';
  }

  function drawBrowse(){
    bodyEl.innerHTML = shelves() + pathZone() + quranZone() + wordsZone();
    drawSpine();
    sayEl.textContent = "";
  }

  /* the lit rail beside the Path: drawn from where the steps actually landed,
     so it can never disagree with the layout */
  function drawSpine(){
    var wrap = bodyEl.querySelector(".nm-path"); if (!wrap) return;
    var svg = wrap.querySelector(".nm-spine");
    var steps = [].slice.call(wrap.querySelectorAll(".nm-step"));
    if (!steps.length) return;
    var top = wrap.getBoundingClientRect().top, H = wrap.offsetHeight;
    svg.setAttribute("viewBox", "0 0 56 " + H);
    svg.setAttribute("width", 56); svg.setAttribute("height", H);
    var pts = steps.map(function(b,i){
      var r = b.getBoundingClientRect();
      return [28 + Math.sin(i*0.55)*13, r.top - top + r.height/2, b.dataset.era];
    });
    var d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    for (var i=1;i<pts.length;i++){
      var a = pts[i-1], b = pts[i], my = (a[1]+b[1])/2;
      d += " C" + a[0].toFixed(1) + " " + my.toFixed(1) + "," + b[0].toFixed(1) + " "
         + my.toFixed(1) + "," + b[0].toFixed(1) + " " + b[1].toFixed(1);
    }
    var dots = pts.map(function(p){
      return '<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="4.5" fill="'
        + (ERAC[p[2]]||"#E8C874") + '"/>'
      + '<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="9" fill="'
        + (ERAC[p[2]]||"#E8C874") + '" opacity=".18"/>'; }).join("");
    svg.innerHTML = '<path d="'+d+'" fill="none" stroke="rgba(232,200,116,.28)" stroke-width="2"/>' + dots;
  }

  function drawResults(){
    var v = qEl.value.trim();
    if (!matched){ drawJump(); drawBrowse(); return; }
    drawJump();
    var oldAz = root.querySelector(".nm-az");
    if (oldAz && oldAz.parentNode === root) oldAz.remove();
    if (azObs){ azObs.disconnect(); azObs = null; }
    if (!matched.length){
      bodyEl.innerHTML = '<div class="nm-wrap"><p class="nm-tally">Nothing by that name. '
        + 'Try fewer letters.</p></div>';
      sayEl.textContent = "No matches"; return;
    }
    var by = {}, i;
    for (i=0;i<Math.min(80,matched.length);i++){
      var o = matched[i]; (by[o.kind] = by[o.kind] || []).push(o);
    }
    var h = '<div class="nm-wrap">';
    ORDER.forEach(function(k){
      var g = by[k]; if (!g) return;
      h += '<p class="nm-grp">'+esc(k)+'</p>';
      g.slice(0,10).forEach(function(o){
        h += '<button class="nm-row" data-u="'+esc(o.u)+'">'
          + (o.a ? '<span class="nm-a">'+esc(o.a)+'</span>' : '')
          + '<span class="nm-c"><span class="nm-t">'+mark(o.t,v)+'</span>'
          + '<span class="nm-d">'+esc(o.d||"")+'</span></span></button>';
      });
    });
    h += '<p class="nm-tally">'+matched.length+' of '+THINGS.length+' in the library.</p></div>';
    bodyEl.innerHTML = h;
    pageEl.scrollTop = 0;
    sayEl.textContent = matched.length + " matches";
  }

  /* ------------------------------------------------------- the A-Z rail */
  var azObs = null;
  function azSetup(){
    var az = bodyEl.querySelector(".nm-az");
    if (az) root.appendChild(az);                 /* fixed to the viewport, not the list */
    else az = root.querySelector(".nm-az");
    if (!az) return;
    /* and it is only there while the words are */
    if (azObs) azObs.disconnect();
    var zone = bodyEl.querySelector("#nm-z-words");
    if (zone && window.IntersectionObserver){
      azObs = new IntersectionObserver(function(es){
        az.classList.toggle("nm-on", es[0].isIntersecting); }, {root: pageEl, threshold: 0});
      azObs.observe(zone);
    } else az.classList.add("nm-on");
    var letters = [].slice.call(az.querySelectorAll("b"));
    function pickAt(clientY){
      var best = null, bd = 1e9;
      letters.forEach(function(b){
        var r = b.getBoundingClientRect(), d = Math.abs(r.top + r.height/2 - clientY);
        if (d < bd){ bd = d; best = b; }
      });
      return best;
    }
    function goTo(b, y){
      if (!b) return;
      letters.forEach(function(x){ x.classList.toggle("nm-hot", x === b); });
      var head = bodyEl.querySelector("#nm-l-" + b.dataset.l);
      if (head) head.scrollIntoView({block:"start", behavior:"auto"});
      bubbleEl.textContent = b.dataset.l;
      bubbleEl.style.top = (y - 32) + "px";
      bubbleEl.classList.add("nm-on");
    }
    var live = false;
    az.addEventListener("pointerdown", function(e){
      live = true; az.setPointerCapture(e.pointerId);
      pageEl.style.scrollBehavior = "auto";
      goTo(pickAt(e.clientY), e.clientY); e.preventDefault();
    });
    az.addEventListener("pointermove", function(e){
      if (!live) return; goTo(pickAt(e.clientY), e.clientY); e.preventDefault();
    });
    function end(){
      if (!live) return; live = false;
      pageEl.style.scrollBehavior = "";
      bubbleEl.classList.remove("nm-on");
      letters.forEach(function(x){ x.classList.remove("nm-hot"); });
    }
    az.addEventListener("pointerup", end);
    az.addEventListener("pointercancel", end);
  }

  /* --------------------------------------------------- the sky, as paint */
  var motes = [], W = 0, H = 0, raf = 0;
  function sizeSky(){
    var r = root.getBoundingClientRect(); if (!r.width) return;
    var d = Math.min(devicePixelRatio||1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W*d); cv.height = Math.round(H*d);
    cx.setTransform(d,0,0,d,0,0);
    var n = Math.round(Math.min(150, W/7));
    motes = [];
    for (var i=0;i<n;i++) motes.push({
      x:Math.random()*W, y:Math.random()*H, r:Math.random()*1.4+.3,
      s:Math.random()*.14+.02, o:Math.random()*.45+.12, p:Math.random()*6.283 });
  }
  function sky(t){
    raf = requestAnimationFrame(sky);
    if (!W) return;
    cx.clearRect(0,0,W,H);
    var g = cx.createRadialGradient(W/2, H*.12, 0, W/2, H*.12, Math.max(W,H)*.8);
    g.addColorStop(0,"rgba(232,200,116,.07)"); g.addColorStop(1,"rgba(232,200,116,0)");
    cx.fillStyle = g; cx.fillRect(0,0,W,H);
    for (var i=0;i<motes.length;i++){
      var m = motes[i];
      if (!REDUCE){ m.y -= m.s; m.p += .008; if (m.y < -6){ m.y = H+6; m.x = Math.random()*W; } }
      var o = m.o * (REDUCE ? 1 : (.55 + Math.sin(m.p)*.45));
      cx.beginPath(); cx.arc(m.x, m.y, m.r, 0, 6.2832);
      cx.fillStyle = "rgba(255,240,196," + o.toFixed(3) + ")"; cx.fill();
    }
  }

  /* -------------------------------------------------------- open / close */
  var opener = null, typeT = 0;
  function open(){
    root.classList.add("nm-on");
    document.documentElement.classList.add("nm-open");
    document.body.classList.add("nm-open");
    sizeSky();
    load().then(function(){
      if (!bodyEl.innerHTML.trim()){ drawJump(); drawBrowse(); azSetup(); }
      if (!matchMedia("(max-width:39.99rem)").matches) qEl.focus();
    });
  }
  function close(){
    root.classList.remove("nm-on");
    document.documentElement.classList.remove("nm-open");
    document.body.classList.remove("nm-open");
    if (opener) opener.focus();
  }

  function init(){
    document.body.appendChild(root);
    qEl = root.querySelector("#nm-q");
    pageEl = root.querySelector(".nm-page");
    bodyEl = root.querySelector(".nm-body");
    jumpEl = root.querySelector(".nm-jump");
    bubbleEl = root.querySelector(".nm-bubble");
    sayEl = root.querySelector(".nm-sr");
    cv = root.querySelector(".nm-canvas"); cx = cv.getContext("2d");

    function setPh(){
      qEl.placeholder = matchMedia("(max-width:39.99rem)").matches
        ? "Search the library" : "A word, a surah, a prophet, a room…"; }
    setPh(); addEventListener("resize", setPh);

    root.addEventListener("click", function(e){
      var b = e.target.closest("[data-nm]");
      if (b && b.dataset.nm === "shut"){ close(); return; }
      var j = e.target.closest("[data-jump]");
      if (j){
        var z = bodyEl.querySelector("#nm-z-" + j.dataset.jump);
        if (z) z.scrollIntoView({block:"start"});
        [].forEach.call(jumpEl.children, function(c){
          c.setAttribute("aria-current", c === j ? "true" : "false"); });
        return;
      }
      var go = e.target.closest("[data-u]");
      if (go){ location.href = go.dataset.u; }
    });

    qEl.addEventListener("input", function(){
      clearTimeout(typeT);
      typeT = setTimeout(function(){
        runSearch(qEl.value); drawResults();
        if (!matched) azSetup();
      }, 90);
    });

    addEventListener("keydown", function(e){
      var isOpen = root.classList.contains("nm-on");
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)
        || document.activeElement.isContentEditable;
      if (!isOpen){
        if ((e.key === "/" && !typing) || (e.key === "k" && (e.metaKey||e.ctrlKey))){
          e.preventDefault(); opener = document.activeElement; open(); }
        return;
      }
      if (e.key === "Escape"){
        if (qEl.value){ qEl.value = ""; runSearch(""); drawResults(); azSetup(); }
        else close();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp"){
        var rows = [].slice.call(root.querySelectorAll(".nm-row")); if (!rows.length) return;
        e.preventDefault();
        var i = rows.findIndex(function(r){ return r.classList.contains("nm-sel"); });
        i = e.key === "ArrowDown" ? Math.min(rows.length-1,i+1) : Math.max(0,i-1);
        rows.forEach(function(r){ r.classList.remove("nm-sel"); });
        rows[i].classList.add("nm-sel"); rows[i].scrollIntoView({block:"nearest"});
      }
      if (e.key === "Enter"){
        var s = root.querySelector(".nm-row.nm-sel");
        if (s) location.href = s.dataset.u;
      }
    });

    addEventListener("resize", function(){
      if (!root.classList.contains("nm-on")) return;
      sizeSky(); if (!matched) drawSpine();
    });

    /* the magnifier already has a handler from noor-search.js, so this listens
       on the way down and stops there: one of them answers, not both */
    document.addEventListener("click", function(e){
      var b = e.target.closest("[data-nm-open]");
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      opener = b; open();
    }, true);

    raf = requestAnimationFrame(sky);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
