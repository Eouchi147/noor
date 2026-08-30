/* NOOR · the menu
   ===========================================================================
   The command bar and the map are not two features that agree with each other.
   They are two drawings of one array: every row in the rail IS a light in the
   sky, the same object. A thing therefore cannot be lit in one and missing
   from the other, which is the whole design.

   The index is fetched once, on first open, so 54 pages do not each carry
   120KB of it.

   The motion is a spring system rather than a set of CSS transitions. A camera
   that springs, keeps momentum when you let go of it and pulls back when you
   over-zoom feels like a thing with weight; one that eases linearly feels like
   a slideshow. Every light also has its own small spring, so the field parts
   around the cursor and settles again after.
   =========================================================================== */
(function () {
  "use strict";
  if (window.__noorMenu) return; window.__noorMenu = 1;

  var INDEX = "/assets/menu-index.json?v=1";
  var REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NARROW = matchMedia("(max-width:39.99rem)");
  var ZMIN = 0.1, ZMAX = 3.6;

  function fold(s){
    return (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
      .replace(/['’ʻʼ`]/g,"").replace(/[^a-z0-9؀-ۿ ]+/g," ")
      .replace(/\s+/g," ").trim();
  }
  function esc(s){
    return String(s==null?"":s).replace(/[&<>"]/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; });
  }

  /* ---------------------------------------------------------------- shell */
  var root = document.createElement("div");
  root.className = "nm-root"; root.setAttribute("role","dialog");
  root.setAttribute("aria-modal","true"); root.setAttribute("aria-label","Search the library");
  root.innerHTML =
    '<div class="nm-head">'
    + '<label class="nm-field">'
    +   '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
    +   '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>'
    +   '<input id="nm-q" type="search" autocomplete="off" spellcheck="false" aria-label="Search the library">'
    + '</label>'
    + '<div class="nm-modes" role="group" aria-label="View">'
    +   '<button class="nm-mode" data-nm="list" aria-pressed="false">List</button>'
    +   '<button class="nm-mode" data-nm="map" aria-pressed="true">Map</button>'
    + '</div>'
    + '<button class="nm-shut" data-nm="shut" aria-label="Close">&times;</button>'
    + '</div>'
    + '<div class="nm-body" data-show="map">'
    +   '<div class="nm-rail"></div>'
    +   '<div class="nm-sky"><canvas></canvas>'
    +     '<div class="nm-tip" role="status"></div><div class="nm-crumb"></div>'
    +     '<div class="nm-tools">'
    +       '<button class="nm-tool" data-nm="whole">&larr; Whole library</button>'
    +       '<button class="nm-tool" data-nm="in" aria-label="Zoom in">+</button>'
    +       '<button class="nm-tool" data-nm="out" aria-label="Zoom out">&minus;</button>'
    +       '<span class="nm-hint">drag to pan &middot; scroll to zoom &middot; click a constellation to fly in</span>'
    +     '</div></div>'
    + '</div>'
    + '<div class="nm-sr"><nav aria-label="Everything in the library"><ul></ul></nav></div>'
    + '<p class="nm-sr" role="status" aria-live="polite"></p>';
  var qEl, railEl, bodyEl, skyEl, C, X, tipEl, crumbEl, sayEl, srEl;

  /* ------------------------------------------------------------- the list */
  var THINGS = [], SPINE = [], SECTIONS = [], matched = null, ready = false, loading = null;
  var ERAC = { bidaya:"#8FB8FF", qisas:"#E8C874", jahiliyyah:"#8C8F9E",
    seerah:"#FFF0C4", khulafa:"#F0C9A0", umam:"#C8A2E8", nihaya:"#F08A8A" };
  var RING = [[-360,-300],[360,-300],[-455,-95],[455,-95],[-455,110],[455,110],[-360,310],[360,310]];
  var ORDER = ["Rooms","Words of the Path","The Path","Surahs","Sections"];

  function build(D){
    SECTIONS = D.sections;
    D.path.forEach(function(n,i){
      var f = i/(D.path.length-1);
      THINGS.push({ kind:"The Path", t:n.t, a:n.a, d:"chapter "+n.i+" · "+(D.eras[n.p]||n.p),
        u:"/#node-"+n.i, hx:Math.sin(f*Math.PI*2)*30, hy:-340+f*700, r:3.4,
        c:ERAC[n.p]||"#E8C874", spine:i, depth:1 });
    });
    D.sections.forEach(function(s,i){
      var c = RING[i % RING.length], cx = c[0], cy = c[1];
      THINGS.push({ kind:"Sections", t:s.n, d:s.s, u:s.items[0].u, hx:cx, hy:cy, r:9,
        c:"#E8C874", big:true, label:s.n, count:s.items.length+" rooms", sec:i, depth:1 });
      s.items.forEach(function(it,j){
        var a = (j/s.items.length)*Math.PI*2 + i*0.7, rad = 58+(j%3)*15;
        THINGS.push({ kind:"Rooms", t:it.t, d:it.d, u:it.u, sec:i, ang:a, rad:rad,
          cx:cx, cy:cy, hx:cx+Math.cos(a)*rad, hy:cy+Math.sin(a)*(rad*0.8), r:3.2,
          c:"#DCD8CB", depth:1, spin:(i%2?1:-1)*0.012 });
      });
    });
    for (var k=1;k<=114;k++){
      var a2 = k*0.38, rr2 = 7*Math.sqrt(k)*1.5;
      THINGS.push({ kind:"Surahs", t:"Surah "+k, d:"open the Mushaf at "+k, u:"/quran?surah="+k,
        hx:-360+Math.cos(a2)*rr2*1.25, hy:-560+Math.sin(a2)*rr2*.7, r:1.7,
        c:"rgba(143,184,255,.75)", tiny:true, depth:.94 });
    }
    D.words.forEach(function(w,i){
      var a3 = i*2.39996, rr3 = 26*Math.sqrt(i);
      THINGS.push({ kind:"Words of the Path", t:w.t, a:w.a, d:w.s, u:"/dictionary#"+w.i,
        hx:Math.cos(a3)*rr3*.95, hy:640+Math.sin(a3)*rr3*.42, r:1.6,
        c:"rgba(214,210,198,.7)", tiny:true, depth:.86 });
    });
    THINGS.forEach(function(o){
      o.f = fold(o.t+" "+(o.d||"")) + " " + (o.a||"");
      o.ph = Math.random()*6.2832;
      o.x = o.hx; o.y = o.hy;      /* where it is */
      o.vx = 0; o.vy = 0;          /* how fast it is going there */
      o.lit = 1; o.flare = 1; o.pop = 0; o.vpop = 0;
    });
    SPINE = THINGS.filter(function(o){ return o.spine !== undefined; });
    srEl.innerHTML = THINGS.map(function(o){
      return '<li><a href="'+esc(o.u)+'">'+esc(o.t)+' — '+esc(o.d||"")+'</a></li>'; }).join("");
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

  /* ---------------------------------------------------------- the search */
  function runSearch(v){
    var q = fold(v);
    if (!q){ matched = null; THINGS.forEach(function(o){ o.lit = 1; }); return; }
    var hits = [];
    for (var i=0;i<THINGS.length;i++){
      var o = THINGS[i], at = o.f.indexOf(q);
      var was = o.lit; o.lit = at < 0 ? 0 : 1;
      if (at < 0) continue;
      /* a new match gets a shove, so the eye is caught by movement, not only light */
      if (!was){ var a = Math.random()*6.2832, s = 26+Math.random()*22;
        o.vx += Math.cos(a)*s; o.vy += Math.sin(a)*s; o.vpop += 7; }
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

  /* ------------------------------------------------------------ the rail */
  function drawRail(){
    var v = qEl.value.trim();
    if (!ready){ railEl.innerHTML = "<p class='nm-tally'>Opening the library&hellip;</p>"; return; }
    if (!matched){
      railEl.innerHTML = "<p class='nm-grp'>The library</p><div class='nm-doors'>"
        + SECTIONS.map(function(s,i){ return "<button class='nm-door' data-sec='"+i+"'><b>"
          + esc(s.n)+"</b><span>"+esc(s.s)+"</span><i>"+s.items.length+" rooms</i></button>"; }).join("")
        + "</div><p class='nm-tally'>"+THINGS.length+" places in the library. Type to narrow it, "
        + "or press a section to fly there on the map.</p>";
      sayEl.textContent = ""; return;
    }
    if (!matched.length){
      railEl.innerHTML = "<p class='nm-tally'>Nothing by that name. Try fewer letters.</p>";
      sayEl.textContent = "No matches"; return;
    }
    var by = {}, i;
    for (i=0;i<Math.min(60,matched.length);i++){
      var o = matched[i]; (by[o.kind] = by[o.kind] || []).push(o);
    }
    var h = "";
    ORDER.forEach(function(k){
      var g = by[k]; if (!g) return;
      h += "<p class='nm-grp'>"+esc(k)+"</p>";
      g.slice(0,8).forEach(function(o){
        h += "<button class='nm-row' data-i='"+THINGS.indexOf(o)+"'><span class='nm-a'>"
          + esc(o.a||"")+"</span><span><span class='nm-t'>"+mark(o.t,v)
          + "</span><span class='nm-d'>"+esc(o.d||"")+"</span></span></button>";
      });
    });
    railEl.innerHTML = h + "<p class='nm-tally'>"+matched.length+" of "+THINGS.length+" lit.</p>";
    sayEl.textContent = matched.length + " matches";
  }

  /* ======================= the sky, and its physics ======================= */
  var VW=0, VH=0, hover=null, dragging=false, moved=0, last=0, acc=0, raf=0;
  var cam = { x:0, y:0, z:.5, vx:0, vy:0, vz:0 };
  var aim = { x:0, y:0, z:.5 };
  var pointers = {}, nP = 0, pinch0 = 0, z0 = 1, mx = -1e5, my = -1e5, onCanvas = false;
  var vhist = [];
  var spread = -1;              /* which constellation has been flown into */

  function bounds(){
    var x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
    THINGS.forEach(function(o){
      if(o.hx<x0)x0=o.hx; if(o.hx>x1)x1=o.hx; if(o.hy<y0)y0=o.hy; if(o.hy>y1)y1=o.hy; });
    return [x0,x1,y0,y1];
  }
  function frameTo(x0,x1,y0,y1,maxZ){
    var pad = VW < 640 ? 30 : 74;
    var z = Math.min((VW-pad*2)/Math.max(80,x1-x0), (VH-pad*2)/Math.max(80,y1-y0));
    aim.z = Math.max(0.14, Math.min(maxZ||1.1, z));
    aim.x = -(x0+x1)/2; aim.y = -(y0+y1)/2;
  }
  function whole(snap){
    var b = bounds(); frameTo(b[0],b[1],b[2],b[3],1.1);
    spread = -1; crumb("");
    if (snap){ cam.x=aim.x; cam.y=aim.y; cam.z=aim.z; cam.vx=cam.vy=cam.vz=0; }
  }
  function flyTo(o){
    aim.z = Math.min(2.1, Math.max(1.15, VW<640?1.0:1.55));
    aim.x = -o.hx; aim.y = -o.hy; cam.vx = cam.vy = 0;
    spread = o.sec; crumb(o.label || o.t);
  }
  function crumb(s){ crumbEl.textContent = s || ""; crumbEl.classList.toggle("nm-on", !!s); }
  function size(){
    var r = skyEl.getBoundingClientRect(); if (!r.width || !r.height) return;
    var d = Math.min(devicePixelRatio||1, 2);
    VW = r.width; VH = r.height;
    C.width = Math.round(VW*d); C.height = Math.round(VH*d);
    X.setTransform(d,0,0,d,0,0);
  }
  /* one transform, used by the drawing and by the hit test, so they cannot disagree */
  function sx(o){ return VW/2 + (o.x + cam.x)*cam.z*(o.depth||1); }
  function sy(o){ return VH/2 + (o.y + cam.y)*cam.z*(o.depth||1); }

  /* --- the integrator: fixed steps, so the feel does not change with framerate --- */
  var K_CAM = 150, D_CAM = 21;      /* stiff, just under critically damped: a little overshoot */
  var K_NODE = 62, D_NODE = 9;      /* looser, so a light drifts back rather than snapping */
  function step(h){
    var i, o, dx, dy, d2, f;

    /* the camera springs at its aim, and rubber-bands if zoom is out of range */
    var az = aim.z;
    if (az < ZMIN) az = ZMIN; if (az > ZMAX) az = ZMAX;
    cam.vx += (K_CAM*(aim.x-cam.x) - D_CAM*cam.vx)*h;
    cam.vy += (K_CAM*(aim.y-cam.y) - D_CAM*cam.vy)*h;
    cam.vz += (K_CAM*(az-cam.z)     - D_CAM*cam.vz)*h;
    cam.x += cam.vx*h; cam.y += cam.vy*h; cam.z += cam.vz*h;
    if (cam.z < ZMIN*0.85){ cam.z = ZMIN*0.85; cam.vz = 0; }

    /* every light is on a spring back to where it belongs */
    var pushing = onCanvas && !dragging && !REDUCE;
    var wx = 0, wy = 0;
    if (pushing){ wx = (mx - VW/2)/cam.z - cam.x; wy = (my - VH/2)/cam.z - cam.y; }
    for (i=0;i<THINGS.length;i++){
      o = THINGS[i];
      var hx = o.hx, hy = o.hy;
      /* a constellation that has been opened spreads its rooms into a readable ring */
      if (o.rad !== undefined){
        var g = (spread === o.sec) ? 1.75 : 1;
        hx = o.cx + Math.cos(o.ang)*o.rad*g;
        hy = o.cy + Math.sin(o.ang)*o.rad*0.8*g;
      }
      o.vx += (K_NODE*(hx-o.x) - D_NODE*o.vx)*h;
      o.vy += (K_NODE*(hy-o.y) - D_NODE*o.vy)*h;
      /* and the field parts around the cursor */
      if (pushing && !o.big){
        dx = o.x - wx; dy = o.y - wy; d2 = dx*dx + dy*dy;
        var R = 120/cam.z;
        if (d2 < R*R && d2 > 1){
          f = (1 - Math.sqrt(d2)/R); f = f*f*680;
          var inv = 1/Math.sqrt(d2);
          o.vx += dx*inv*f*h; o.vy += dy*inv*f*h;
        }
      }
      o.x += o.vx*h; o.y += o.vy*h;
      /* how bright, and how big, it wants to be */
      var want = matched ? (o.lit?1:0) : 1;
      o.flare += (want - o.flare)*Math.min(1, 9*h);
      var pw = (o===hover?1:0) + (matched && o.lit?1:0);
      o.vpop += (K_NODE*1.6*(pw-o.pop) - D_NODE*0.8*o.vpop)*h;
      o.pop += o.vpop*h;
    }
  }

  function paint(T){
    X.clearRect(0,0,VW,VH);
    var i, o, x, y;

    X.beginPath();
    for (i=0;i<SPINE.length;i++){ o = SPINE[i]; x = sx(o); y = sy(o); i?X.lineTo(x,y):X.moveTo(x,y); }
    X.strokeStyle = matched ? "rgba(232,200,116,.08)" : "rgba(232,200,116,.2)";
    X.lineWidth = 1.2; X.stroke();
    var pulse = REDUCE ? -1 : (T*0.055) % 1.35;

    for (i=0;i<THINGS.length;i++){
      o = THINGS[i]; x = sx(o); y = sy(o);
      if (x < -60 || x > VW+60 || y < -60 || y > VH+60) continue;
      var alpha = 0.14 + o.flare*0.86, scale = 1 + Math.max(0,o.pop)*0.9;
      if (!REDUCE){
        alpha *= 0.78 + Math.sin(T*0.9 + o.ph)*0.22;
        if (o.spine !== undefined){
          var dd = Math.abs(o.spine/(SPINE.length-1) - pulse);
          if (dd < 0.06){ var g = 1-dd/0.06; alpha = Math.min(1, alpha+g*0.9); scale += g*1.5; }
        }
      }
      if (o === hover){ alpha = 1; scale *= 1.55; }
      var won = matched && o.lit;
      var r = Math.max(won ? 2.2 : .65, o.r*cam.z*scale);
      if (!o.tiny || won || o === hover){
        var gr = X.createRadialGradient(x,y,0,x,y,r*5.5);
        gr.addColorStop(0,o.c); gr.addColorStop(1,"rgba(0,0,0,0)");
        X.globalAlpha = alpha*0.5; X.fillStyle = gr;
        X.beginPath(); X.arc(x,y,r*5.5,0,6.2832); X.fill();
      }
      X.globalAlpha = alpha < 0 ? 0 : (alpha > 1 ? 1 : alpha);
      X.fillStyle = o.c; X.beginPath(); X.arc(x,y,r,0,6.2832); X.fill();
    }
    X.globalAlpha = 1; X.textAlign = "center";

    for (i=0;i<THINGS.length;i++){
      o = THINGS[i];
      var named = o.big || (o.flare > .55 && o.kind !== "Sections"
        && (matched ? matched.length <= 24 : cam.z > 1.25));
      if (!named) continue;
      x = sx(o); y = sy(o);
      if (x<-130||x>VW+130||y<-60||y>VH+80) continue;
      var fs = o.big ? Math.max(11,Math.min(18,15*cam.z)) : Math.max(9,Math.min(13,11*cam.z));
      X.save(); X.shadowColor = "rgba(6,7,12,.96)"; X.shadowBlur = 9;
      X.globalAlpha = o.big ? (matched ? .32 + o.flare*.68 : 1) : o.flare;
      X.font = "600 "+fs.toFixed(0)+"px Inter,system-ui,sans-serif";
      X.fillStyle = o === hover ? "#FFF0C4" : "#EFE9D8";
      var ty = y + Math.max(.7,o.r*cam.z) + fs + 9;
      X.fillText(o.label || o.t, x, ty);
      if (o.count){
        X.font = "500 "+(fs*.7).toFixed(0)+"px Inter,system-ui,sans-serif";
        X.fillStyle = "rgba(232,200,116,.75)"; X.fillText(o.count, x, ty+fs*1.05);
      }
      X.restore();
    }
    X.globalAlpha = matched ? .3 : .85;
    X.save(); X.shadowColor="rgba(6,7,12,.96)"; X.shadowBlur=9;
    X.font = "600 "+Math.max(10,Math.min(14,12*cam.z)).toFixed(0)+"px Inter,system-ui,sans-serif";
    X.fillStyle = "rgba(232,200,116,.85)";
    var e1 = {x:0,y:640,depth:.86}, e2 = {x:-360,y:-560,depth:.94};
    X.fillText("The Encyclopedia · 523 words", sx(e1), sy(e1)+Math.max(24,170*cam.z));
    X.fillText("The Mushaf · 114 surahs", sx(e2), sy(e2)-Math.max(20,86*cam.z));
    X.restore(); X.globalAlpha = 1;
  }

  function loop(now){
    raf = requestAnimationFrame(loop);
    if (!ready || !VW) return;
    var dt = Math.min(0.05, (now - last)/1000 || 0.016); last = now;
    acc += dt;
    var n = 0;
    while (acc > 1/120 && n++ < 6){ step(1/120); acc -= 1/120; }
    paint(now/1000);
  }

  function pick(px,py){
    var best=null, bd=1e9;
    for (var i=0;i<THINGS.length;i++){
      var o = THINGS[i];
      if (matched && !o.lit) continue;
      var dx = sx(o)-px, dy = sy(o)-py, d = dx*dx+dy*dy;
      var rad = Math.max(o.big?18:12, o.r*cam.z+9); rad *= rad;
      if (d < rad && d < bd){ bd = d; best = o; }
    }
    return best;
  }
  function tipAt(o,px,py){
    if (!o){ tipEl.classList.remove("nm-on"); return; }
    tipEl.innerHTML = "<b>"+esc(o.t)+"</b><small>"+esc(o.d||"")+"</small>";
    tipEl.style.left = px+"px"; tipEl.style.top = py+"px"; tipEl.classList.add("nm-on");
  }
  function enter(o){ if (o) location.href = o.u; }

  /* ------------------------------------------------------- pointer input */
  function local(e){ var r = C.getBoundingClientRect(); return [e.clientX-r.left, e.clientY-r.top]; }
  function onDown(e){
    C.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = {x:e.clientX,y:e.clientY}; nP++;
    if (nP === 2){ var p = vals(); pinch0 = Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y); z0 = cam.z; }
    else { dragging = true; moved = 0; vhist.length = 0; C.classList.add("nm-drag");
           cam.vx = cam.vy = 0; }
  }
  function vals(){ var a=[]; for (var k in pointers) a.push(pointers[k]); return a; }
  function onMove(e){
    var L = local(e); mx = L[0]; my = L[1];
    var prev = pointers[e.pointerId];
    if (prev) pointers[e.pointerId] = {x:e.clientX,y:e.clientY};
    if (nP === 2 && pinch0){
      var p = vals(), d = Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y);
      aim.z = Math.max(ZMIN*0.7, Math.min(ZMAX*1.15, z0*(d/pinch0)));
      cam.z = aim.z; return;
    }
    if (dragging && prev){
      var ddx = (e.clientX-prev.x)/cam.z, ddy = (e.clientY-prev.y)/cam.z;
      cam.x += ddx; cam.y += ddy; aim.x = cam.x; aim.y = cam.y;
      moved += Math.abs(e.clientX-prev.x) + Math.abs(e.clientY-prev.y);
      vhist.push([performance.now(), ddx, ddy]);
      if (vhist.length > 6) vhist.shift();
      return;
    }
    if (e.pointerType === "touch") return;
    var h = pick(mx,my);
    if (h !== hover){ hover = h; tipAt(h,mx,my); }
    else if (h) { tipEl.style.left = mx+"px"; tipEl.style.top = my+"px"; }
  }
  function onUp(e){
    var L = local(e), tap = moved < 8 && nP === 1;
    if (pointers[e.pointerId]){ delete pointers[e.pointerId]; nP = Math.max(0,nP-1); }
    if (nP < 2) pinch0 = 0;
    if (nP === 0){
      if (dragging && !tap && vhist.length > 1){
        /* let go of it and it keeps going, then slows: momentum from the last few frames */
        var t0 = vhist[0][0], t1 = vhist[vhist.length-1][0], sx2=0, sy2=0;
        vhist.forEach(function(v){ sx2 += v[1]; sy2 += v[2]; });
        var ms = Math.max(16, t1-t0);
        cam.vx = sx2/ms*1000*0.55; cam.vy = sy2/ms*1000*0.55;
        aim.x = cam.x + cam.vx*0.34; aim.y = cam.y + cam.vy*0.34;
      }
      dragging = false; C.classList.remove("nm-drag");
    }
    if (!tap) return;
    var h = pick(L[0],L[1]); if (!h) return;
    if (h.big){ flyTo(h); return; }
    hover = h; enter(h);
  }
  function onCancel(e){
    if (pointers[e.pointerId]){ delete pointers[e.pointerId]; nP = Math.max(0,nP-1); }
    if (nP === 0){ dragging = false; C.classList.remove("nm-drag"); }
  }

  /* -------------------------------------------------------- open / close */
  var opener = null, typeT = 0;
  function phone(){ return NARROW.matches; }
  function show(which){
    bodyEl.dataset.show = which;
    root.querySelector('[data-nm=map]').setAttribute("aria-pressed", which==="map");
    root.querySelector('[data-nm=list]').setAttribute("aria-pressed", which==="list");
    if (which === "map") requestAnimationFrame(function(){ size(); });
  }
  function onType(){
    if (!ready) return;
    runSearch(qEl.value); drawRail();
    if (phone()) show(qEl.value.trim() ? "list" : "map");
    if (matched && matched.length){
      var x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
      matched.forEach(function(o){
        if(o.hx<x0)x0=o.hx; if(o.hx>x1)x1=o.hx; if(o.hy<y0)y0=o.hy; if(o.hy>y1)y1=o.hy; });
      frameTo(x0,x1,y0,y1,2.4); spread = -1; crumb("");
    } else if (!matched) whole(false);
  }
  function open(){
    root.classList.add("nm-on");
    document.documentElement.classList.add("nm-open");
    document.body.classList.add("nm-open");
    load().then(function(){
      drawRail(); size(); whole(true);
      if (!phone()) qEl.focus();
    });
    requestAnimationFrame(function(){ size(); });
  }
  function close(){
    root.classList.remove("nm-on");
    document.documentElement.classList.remove("nm-open");
    document.body.classList.remove("nm-open");
    if (opener) opener.focus();
  }

  /* ------------------------------------------------------------- wiring */
  function init(){
    document.body.appendChild(root);
    qEl = root.querySelector("#nm-q");
    railEl = root.querySelector(".nm-rail");
    bodyEl = root.querySelector(".nm-body");
    skyEl = root.querySelector(".nm-sky");
    C = skyEl.querySelector("canvas"); X = C.getContext("2d");
    tipEl = root.querySelector(".nm-tip");
    crumbEl = root.querySelector(".nm-crumb");
    srEl = root.querySelector(".nm-sr ul");
    sayEl = root.querySelector("p.nm-sr");

    function setPh(){ qEl.placeholder = phone() ? "Search the library"
      : "A word, a surah, a prophet, a room…"; }
    NARROW.addEventListener ? NARROW.addEventListener("change", setPh) : NARROW.addListener(setPh);
    setPh();

    root.addEventListener("click", function(e){
      var b = e.target.closest("[data-nm]");
      if (b){ var k = b.dataset.nm;
        if (k === "shut") close();
        else if (k === "map" || k === "list") show(k);
        else if (k === "whole") whole(false);
        else if (k === "in")  aim.z = Math.min(ZMAX, aim.z*1.45);
        else if (k === "out") aim.z = Math.max(ZMIN, aim.z/1.45);
        return; }
      var d = e.target.closest(".nm-door");
      if (d){ var s = THINGS.filter(function(o){ return o.big && o.sec === +d.dataset.sec; })[0];
        if (s){ show("map"); requestAnimationFrame(function(){ size(); flyTo(s); }); } return; }
      var r = e.target.closest(".nm-row");
      if (r) enter(THINGS[+r.dataset.i]);
    });
    railEl.addEventListener("mouseover", function(e){
      var r = e.target.closest(".nm-row"); if (r) hover = THINGS[+r.dataset.i]; });

    C.addEventListener("pointerdown", onDown);
    C.addEventListener("pointermove", onMove);
    C.addEventListener("pointerup", onUp);
    C.addEventListener("pointercancel", onCancel);
    C.addEventListener("pointerenter", function(){ onCanvas = true; });
    C.addEventListener("pointerleave", function(){ onCanvas = false;
      if (!dragging){ hover = null; tipEl.classList.remove("nm-on"); } });
    C.addEventListener("wheel", function(e){
      e.preventDefault();
      aim.z = Math.max(ZMIN*0.7, Math.min(ZMAX*1.15, aim.z*Math.exp(-e.deltaY*0.0014)));
    }, {passive:false});

    qEl.addEventListener("input", function(){
      clearTimeout(typeT); typeT = setTimeout(onType, 80); });

    addEventListener("keydown", function(e){
      var open_ = root.classList.contains("nm-on");
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)
        || document.activeElement.isContentEditable;
      if (!open_){
        if ((e.key === "/" && !typing) || (e.key === "k" && (e.metaKey||e.ctrlKey))){
          e.preventDefault(); opener = document.activeElement; open(); }
        return;
      }
      if (e.key === "Escape"){ if (qEl.value){ qEl.value=""; onType(); } else close(); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp"){
        var rows = [].slice.call(root.querySelectorAll(".nm-row")); if (!rows.length) return;
        e.preventDefault();
        var i = rows.findIndex(function(r){ return r.classList.contains("nm-sel"); });
        i = e.key === "ArrowDown" ? Math.min(rows.length-1,i+1) : Math.max(0,i-1);
        rows.forEach(function(r){ r.classList.remove("nm-sel"); });
        rows[i].classList.add("nm-sel"); rows[i].scrollIntoView({block:"nearest"});
        hover = THINGS[+rows[i].dataset.i];
      }
      if (e.key === "Enter"){
        var s = root.querySelector(".nm-row.nm-sel"); if (s) enter(THINGS[+s.dataset.i]); }
    });
    addEventListener("resize", function(){ if (root.classList.contains("nm-on")) size(); });

    /* CAPTURE, not bubble. The magnifier in the header already had a handler
       bound to it by noor-search.js, which opens the old drawer. Listening on
       the way down and stopping there means the menu answers the click and the
       drawer never hears it -- without either file having to know about the
       other, and with the old drawer left intact as a fallback. */
    document.addEventListener("click", function(e){
      var b = e.target.closest("[data-nm-open]");
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      opener = b; open();
    }, true);
    raf = requestAnimationFrame(loop);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
