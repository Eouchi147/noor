/* NOOR · the menu
   ===========================================================================
   Eight sections on a ring, each opening into its rooms; everything else —
   71 chapters, 114 surahs, 523 words — is reached by typing.

   The <details> mega-menu in the header is untouched and remains the fallback:
   it is what a crawler reads, what a visitor without JS gets, and what still
   works in the moment before this file arrives.

   Every room is a real <a href>. The version this replaces used buttons and
   location.href, so nobody could middle-click a room open — on a library,
   where people open five things at once, that is a real loss.
   =========================================================================== */
(function(){
"use strict";
const ICON={"quran": "<path d=\"M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z\"/><path d=\"M8 7h7M8 11h5\"/>", "belief": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5 19 19M19 5l-2.5 2.5M7.5 16.5 5 19\"/>", "worship": "<path d=\"M12 3v3M6.5 8 12 6l5.5 2v6a6 6 0 0 1-11 0z\"/><path d=\"M9 21h6M12 20v-3\"/>", "story": "<path d=\"M4 20 L9 14 L14 17 L20 6\"/><circle cx=\"9\" cy=\"14\" r=\"1.6\"/><circle cx=\"14\" cy=\"17\" r=\"1.6\"/><circle cx=\"20\" cy=\"6\" r=\"1.6\"/>", "life": "<circle cx=\"12\" cy=\"11\" r=\"3.6\"/><path d=\"M12 3v2M12 17v.5M4.5 11H3M21 11h-1.5M6.3 5.3 5.2 4.2M18.8 4.2l-1.1 1.1M3 20h18\"/>", "look": "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m16.5 16.5 4 4\"/>", "kids": "<circle cx=\"12\" cy=\"9\" r=\"4\"/><path d=\"M5 21c0-4 3.5-6 7-6s7 2 7 6\"/>", "house": "<path d=\"M4 21V9l8-6 8 6v12z\"/><path d=\"M10 21v-6h4v6\"/>"};
const INDEX="/assets/menu-index.json?v=2";
/* Bound in buildShell(). Declared out here on purpose: the overlay does not
   exist when this file is parsed, and these are shared by buildShell, wire and
   the frame loop, so they cannot live inside any one of them. */
let cv=null,cx=null,stage=null;
"use strict";
const $=i=>document.getElementById(i);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const REDUCE=matchMedia("(prefers-reduced-motion: reduce)").matches;
const COARSE=matchMedia("(pointer:coarse)").matches;
const CANHOVER=matchMedia("(hover:hover)").matches;

/* ===================================================================
   WHY THIS IS EIGHT AND NOT SEVEN HUNDRED AND FIFTY

   The console dial holds twelve rooms and that is the whole console. This
   library holds 750 things, and a ring cannot hold 750 of anything -- that
   was the lesson of the star map: past a couple of hundred nodes a field
   becomes a hairball, and on a phone an unlabelled dot cannot be read before
   it is committed to.

   So the ring holds the eight sections, which is the one number that is
   stable, small, and covers everything. Each section opens into its three to
   eight rooms -- readable at a glance, every one named. The other 708 things
   (71 chapters, 114 surahs, 523 words) are not navigation, they are lookup,
   and lookup belongs to the search field, which is where a thumb already is.

   Eight balls also means each one is half again as big as the console's
   twelve, which matters more here than there: this is the public door.
   =================================================================== */

/* ---------------- the overlay builds itself ----------------
   Nothing is added to the 54 pages but a link and a script tag. The header they
   already carry has the magnifier; everything else hangs off it from here. */
function buildShell(){
  if(document.getElementById("nd"))return;
  const d=document.createElement("div");
  d.className="nd"; d.id="nd"; d.setAttribute("role","dialog");
  d.setAttribute("aria-modal","true"); d.setAttribute("aria-label","Find anything");
  d.innerHTML=
   '<canvas id="ndsky" aria-hidden="true"></canvas>'
  +'<div class="nd-bloom" id="ndbloom" aria-hidden="true"></div>'
  +'<div class="nd-top"><label class="nd-find">'
  +'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">'
  +'<circle cx="11" cy="11" r="7"></circle><path d="m16.5 16.5 4 4"></path></svg>'
  +'<input id="ndq" type="search" autocomplete="off" spellcheck="false" '
  +'placeholder="A word, a surah, a prophet, a room\u2026" aria-label="Search the library"></label>'
  +'<button class="nd-x" id="ndclose" aria-label="Close">&times;</button></div>'
  +'<div class="nd-stage" id="ndstage"><div class="nd-rig" id="ndrig"></div>'
  +'<div class="nd-hub" id="ndhub" aria-live="polite"></div></div>'
  +'<div class="nd-res" id="ndres"><div class="wrap" id="ndreswrap"></div></div>'
  +'<p class="nd-hint" id="ndhint"></p>'
  +'<div class="nd-scrim" id="ndscrim"></div>'
  +'<div class="nd-panel" id="ndpanel" role="dialog" aria-modal="true" aria-labelledby="ndptitle">'
  +'<div class="nd-ph"><span class="pi" id="ndpicon"></span>'
  +'<span><h2 id="ndptitle"></h2><p id="ndpsub"></p></span>'
  +'<button class="x" id="ndpx" aria-label="Close section">&times;</button></div>'
  +'<div class="nd-pb" id="ndpb"></div></div>';
  document.body.appendChild(d);
  cv=$("ndsky"); cx=cv.getContext("2d"); stage=$("ndstage");
  wire();
}

/* ---------------- the index, fetched once ----------------
   120KB, so it is not inlined into 54 pages. It is fetched on the first hover
   or touch of the magnifier rather than on the click, so the door is not
   waiting on a download when someone presses it. */
let SECTIONS=[],RING=[],PATH=[],WORDS=[],loading=null,ready=false;
function loadIndex(){
  if(ready)return Promise.resolve();
  if(loading)return loading;
  loading=fetch(INDEX,{cache:"force-cache"})
    .then(r=>r.ok?r.json():null)
    .then(j=>{ if(!j||!j.sections)return;
      SECTIONS=j.sections; PATH=j.path||[]; WORDS=j.words||[];
      RING=SECTIONS.map(s=>({...s,n_:(s.items||[]).length}));
      buildThings(); ready=true; })
    .catch(()=>{});
  return loading;
}


/* ===================================================================
   THE SET

   Depth on a flat screen is made of exactly one thing: layers that disagree
   about how far they have moved. So the sky is not one field of dots, it is
   four planes with different parallax coefficients —

     haze   0.18   slow indigo and gold clouds, the furthest thing
     far    0.35   small dim stars
     mid    0.70   medium
     near   1.20   a few large bright ones that overshoot the pointer

   — plus a bloom that is not part of the sky at all but the light the focused
   section throws back into the room. The parallax follows the pointer on a
   mouse and drifts on its own on a phone, where there is no pointer to follow
   and a static backdrop is what makes a thing feel like a screenshot.
   =================================================================== */

let VW=0,VH=0,LAYERS=[],HAZE=[];
function sizeSky(){
  /* A retina phone asks for four times the pixels of a plain one, and this is
     a soft, blurred backdrop where nobody can tell. Capped at 1.5 on touch: the
     single cheapest thing that can be done for a small GPU. */
  const r=Math.min(devicePixelRatio||1,COARSE?1.5:2);
  VW=innerWidth;VH=innerHeight;cv.width=VW*r;cv.height=VH*r;
  cx.setTransform(r,0,0,r,0,0);
  const dens=VW*VH/(COARSE?34000:16000);
  LAYERS=[
    {k:.18,st:[],n:0},
    {k:.35,st:[],n:Math.round(dens*.55),r:[.3,.9], o:[.14,.34]},
    {k:.70,st:[],n:Math.round(dens*.32),r:[.5,1.3],o:[.22,.5]},
    {k:1.20,st:[],n:Math.round(dens*.10),r:[.9,2.0],o:[.34,.72]}
  ];
  for(const L of LAYERS){
    for(let i=0;i<(L.n||0);i++)L.st.push({
      x:Math.random()*VW*1.3-VW*.15, y:Math.random()*VH*1.3-VH*.15,
      r:L.r[0]+Math.random()*(L.r[1]-L.r[0]),
      o:L.o[0]+Math.random()*(L.o[1]-L.o[0]), p:Math.random()*6.28});
  }
  /* THE HAZE, BAKED ONCE.
     Four soft clouds is four full-screen radial gradients composited in
     `lighter`, and redrawing them every frame is pure fill rate — on a throttled
     phone it was most of what was left of the frame budget. But they are soft
     and they only ever drift, so they can be painted once into an offscreen
     canvas at half resolution and blitted with an offset. One bitmap draw
     instead of four gradient fills, and at half res the upscale costs nothing
     because the thing is a blur to begin with. */
  HAZE=[
    {x:.22,y:.28,r:.62,c:"56,74,170",a:.15,s:.045,ph:0},
    {x:.78,y:.34,r:.54,c:"120,92,168",a:.10,s:.037,ph:2.1},
    {x:.50,y:.76,r:.70,c:"140,110,52",a:.09,s:.029,ph:4.2},
    {x:.12,y:.80,r:.45,c:"40,62,140",a:.11,s:.052,ph:1.1}
  ];
  bakeHaze();
}

let HZ=null,HZW=0,HZH=0;
function bakeHaze(){
  /* padded, so the bitmap can be pushed around by the parallax without an edge
     ever entering the frame */
  const pad=.35, sc=.5;
  HZW=Math.max(2,Math.round(VW*(1+pad*2)*sc));
  HZH=Math.max(2,Math.round(VH*(1+pad*2)*sc));
  HZ=document.createElement("canvas"); HZ.width=HZW; HZ.height=HZH;
  const g2=HZ.getContext("2d"), D=Math.max(VW,VH)*sc;
  /* the ground wash is baked in here too. It was a full-screen radial gradient
     recomputed and filled on every single frame, and it never changes — the
     most expensive constant on the page. Now it is part of the same bitmap. */
  const wash=g2.createRadialGradient(HZW/2,HZH*.46,0,HZW/2,HZH*.46,Math.max(HZW,HZH)*.62);
  wash.addColorStop(0,"rgba(30,42,96,.30)");wash.addColorStop(1,"rgba(7,11,28,0)");
  g2.fillStyle=wash;g2.fillRect(0,0,HZW,HZH);
  g2.globalCompositeOperation="lighter";
  for(const h of HAZE){
    const X=(h.x+pad/(1+pad*2))*HZW, Y=(h.y+pad/(1+pad*2))*HZH, RR=h.r*D*.5;
    const hg=g2.createRadialGradient(X,Y,0,X,Y,RR);
    hg.addColorStop(0,"rgba("+h.c+","+h.a+")");
    hg.addColorStop(.55,"rgba("+h.c+","+(h.a*.34).toFixed(3)+")");
    hg.addColorStop(1,"rgba("+h.c+",0)");
    g2.fillStyle=hg; g2.beginPath(); g2.arc(X,Y,RR,0,6.2832); g2.fill();
  }
}
function drawSky(T){
  cx.clearRect(0,0,VW,VH);
  const D=Math.max(VW,VH);

  /* 1 + 2 · wash and haze, one blit of a bitmap baked at half resolution */
  if(HZ){
    const pad=.35;
    /* on the lightest tier the haze stops drifting: it is the largest thing on
       screen, so moving it is the most fill the compositor can be asked for */
    const still=REDUCE||QUAL.tier<=1;
    const dx=still?0:Math.sin(T*.038)*D*.045, dy=still?0:Math.cos(T*.031)*D*.03;
    cx.drawImage(HZ, -VW*pad+dx-cam.px*D*.18, -VH*pad+dy-cam.py*D*.18,
                 VW*(1+pad*2), VH*(1+pad*2));
  }

  /* 3 · three star planes that disagree about how far they moved.
     A star is one to two pixels across, and at that size a filled path and a
     filled rectangle are the same picture — but the path costs a beginPath, an
     arc and a fill each, sixty times a frame. On touch they are rectangles, and
     that alone is most of the difference between thirty and sixty on a small
     phone. On a desktop the circles stay, because there they are free. */
  cx.fillStyle="#FFF0C4";
  for(const L of LAYERS){
    if(!L.st.length)continue;
    const ox=-cam.px*D*L.k*.09, oy=-cam.py*D*L.k*.09;
    if(COARSE){
      for(const s of L.st){
        const tw=REDUCE?1:(.55+Math.sin(T*(.7+L.k)+s.p)*.45);
        cx.globalAlpha=s.o*tw;
        const d2=s.r*1.8;
        cx.fillRect(s.x+ox-s.r,s.y+oy-s.r,d2,d2);
      }
    }else{
      for(const s of L.st){
        const tw=REDUCE?1:(.55+Math.sin(T*(.7+L.k)+s.p)*.45);
        cx.globalAlpha=s.o*tw;
        cx.beginPath();cx.arc(s.x+ox,s.y+oy,s.r,0,6.2832);cx.fill();
      }
    }
  }
  cx.globalAlpha=1;
}

/* ---------------- physics ----------------
   The same feel as the console, tuned once more for a public door: slower on a
   thumb than a mouse, and every constant that governs speed has a ceiling, so
   a hard flick is a fast turn rather than a blur. */
const MAXV  = COARSE ? 3.6  : 5.4;
const COAST = COARSE ? .944 : .958;
const FLING = COARSE ? .32  : .5;
const TRACK = COARSE ? .55  : .85;
const SNAP_K= COARSE ? 118  : 150, SNAP_C = COARSE ? 14.6 : 15.0;
const LAGF=.11, LOOKAHEAD=2, GOO_K=210, GOO_C=7.2, GOO_W=.45, GOO_V=9;
const clampV=v=>v>MAXV?MAXV:(v<-MAXV?-MAXV:v);

const S={th:0,thV:0}, J={detent:-1,lag:0};
/* the camera. px/py are where it is, pxT/pyT where it is going. On a mouse the
   target is the pointer; on a phone there is no pointer, so it breathes on a
   slow lissajous instead — a still backdrop is what makes a screen feel dead. */
const cam={px:0,py:0,pxT:0,pyT:0};
/* the glow spring. Arriving at a section overshoots into light and settles
   back: under-damped on purpose, because the bounce IS the effect. */
const BLOOM={v:0,vv:0};
/* where layout() last put the focused ball, so the bloom never has to measure */
const FOCUS_XY={x:0,y:0,ok:false};

/* ===================================================================
   THE GOVERNOR

   Measured across three simulated devices, the same code runs at a locked 60
   on anything mid-range or better and a locked 30 on a low-end phone. Thirty
   is not broken — it is consistent, not stuttering — but shipping one version
   that halves itself on weaker hardware is worse than shipping a lighter one.

   Device sniffing is the wrong tool: hardwareConcurrency and deviceMemory lie,
   are missing on Safari, and say nothing about what the GPU is doing right
   now with eleven other tabs open. So this measures instead. It samples the
   first two dozen frames after opening and, if they are not keeping up, drops
   a tier and stops paying for the things the eye will miss least — the bloom
   first, then the haze drift, then most of the stars.

   Tiers only ever fall. A frame that recovers does not re-enable anything,
   because a menu whose effects switch back on mid-gesture is worse than one
   that is simply lighter.
   =================================================================== */
const QUAL={tier:2, n:0, ds:[], judged:false};
function judgeQuality(){
  const s=[...QUAL.ds].sort((a,b)=>a-b), med=s[Math.floor(s.length/2)];
  let t=2;
  if(med>26)t=1;
  if(med>45)t=0;
  QUAL.judged=true;
  if(t<QUAL.tier){
    QUAL.tier=t;
    if(t<=1){ const b=$("ndbloom"); if(b)b.style.display="none"; }
    if(t<=0){ for(const L of LAYERS) L.st.length=Math.floor(L.st.length*.35); }
    else    { for(const L of LAYERS) L.st.length=Math.floor(L.st.length*.65); }
  }
}
let nodes=[],focus=0,R=0,ND=0,snapTo=null,born=0,running=false,rafId=0,openedAt=0;

function metrics(){
  const w=innerWidth,h=innerHeight,small=Math.min(w,h);
  ND=COARSE?Math.max(78,Math.min(104,small*.215)):Math.max(92,Math.min(124,small*.155));
  const M=ND*.5*1.55;
  R=Math.min(w*.5-M,(h*.5-M)/Math.cos(.34)*.9,300);
  R=Math.max(R,ND*1.3);
  document.documentElement.style.setProperty("--d",ND+"px");
  document.documentElement.style.setProperty("--hd",(ND*2.1)+"px");
}
function render(){
  metrics();
  $("ndrig").innerHTML=RING.map((s,i)=>
    '<a class="nd-node" href="'+esc(s.items[0]?s.items[0].u:"#")+'" data-i="'+i+'" '
    +'aria-label="'+esc(s.n)+' — '+s.n_+' rooms">'
    +'<span class="nd-in"><svg viewBox="0 0 24 24" aria-hidden="true">'+(ICON[s.k]||"")+'</svg>'
    +'<b>'+esc(s.n)+'</b><span class="cnt">'+s.n_+'</span></span></a>').join("");
  nodes=[].slice.call($("ndrig").children);
  nodes.forEach(n=>{n._w=0;n._wv=0;});
  born=performance.now();
  $("ndhint").textContent=COARSE
    ? "Swipe to turn · tap a section · type to search everything"
    : "Drag or ← → to turn · Enter to open · type to search everything";
  paintHub();
}
function paintHub(){
  const s=RING[focus]; if(!s)return;
  $("ndhub").innerHTML='<span><span class="hn">'+esc(s.n)+'</span>'
    +'<span class="hs">'+esc(s.s)+'</span>'
    +'<span class="hv">'+s.n_+' rooms</span></span>';
}
const TILT=.34;
function layout(T){
  const n=nodes.length;if(!n)return;
  const age=(T*1000-born)/1000;
  for(let i=0;i<n;i++){
    const a=-Math.PI/2+(i/n)*Math.PI*2+S.th;
    const x=Math.cos(a)*R, y=Math.sin(a)*R*Math.cos(TILT), z=Math.sin(a)*R*Math.sin(TILT)*-1;
    const k=Math.max(0,Math.min(1,(age-i*.045)/.6));
    const e=REDUCE?1:1-Math.pow(1-k,3);
    const near=(z+R)/(2*R), base=(0.82+near*.3)*(i===focus?1.18:1);
    const el=nodes[i];
    el._wv+=(-GOO_K*el._w-GOO_C*el._wv)*(1/60); el._w+=el._wv*(1/60);
    if(el._wv>GOO_V)el._wv=GOO_V; else if(el._wv<-GOO_V)el._wv=-GOO_V;
    if(el._w>GOO_W)el._w=GOO_W;   else if(el._w<-GOO_W)el._w=-GOO_W;
    if(Math.abs(el._w)<6e-4&&Math.abs(el._wv)<4e-3){el._w=0;el._wv=0;}
    const w=REDUCE?0:el._w;
    el.style.transform="translate3d("+(x*e).toFixed(1)+"px,"+(y*e).toFixed(1)+"px,"+(z*e).toFixed(1)
      +"px) scale("+(base*(1+w*.55)).toFixed(4)+","+(base*(1-w*.42)).toFixed(4)+")";
    /* same reason: the far side dims, but never below the point where its name
       can be read and aimed at */
    el.style.opacity=(e*(0.70+near*.30)).toFixed(3);
    el.style.zIndex=String(1000+Math.round(z));
    /* DEPTH OF FIELD — and the two mistakes it cost to get right.
       First, `near` was measured against the ring radius rather than the ring's
       actual z range, so the FRONT ball came out at 0.67 and every one of the
       eight was being blurred, focus included. Second, and far worse, the
       filter was written on every element on every frame: CSS blur forces a
       repaint of the layer, and eight repaints a frame is what took a throttled
       phone to 133ms. Now the depth is measured properly, only the back half
       is ever softened, and the value is quantised to a quarter pixel and
       written ONLY when that quarter-pixel bucket changes — which during a
       steady spin is a handful of writes a second instead of 480. */
    /* and on a phone the softening is skipped outright: the effect is barely
       readable at that size and blur is the one thing a small GPU truly hates */
    if(!REDUCE && !COARSE){
      const depth=(z/(R*Math.sin(TILT))+1)/2;        /* 0 at the back, 1 at the front */
      /* Softened from 5.2 to 3.4 after looking at it: at the old strength the
         back of the ring was a depth cue AND unreadable, and this is navigation
         before it is atmosphere. A section a person might be reaching for has to
         stay legible even while it is out of focus. */
      const dof=depth>.55?0:(.55-depth)*3.4;
      const q=Math.round(dof*4)/4;
      if(el._dof!==q){ el._dof=q; el.style.filter = q>0 ? "blur("+q+"px)" : ""; }
    }
    el.classList.toggle("on",i===focus);
    el.style.setProperty("--lit", i===focus ? BLOOM.v.toFixed(3) : "0");
    if(i===focus){ FOCUS_XY.x=innerWidth/2+x*e; FOCUS_XY.y=innerHeight/2+y*e; FOCUS_XY.ok=true; }
    const inn=el.firstElementChild;
    if(inn)inn.style.transform="scale("+(1-w*.3).toFixed(4)+","+(1+w*.24).toFixed(4)+") "
      +"translateX("+J.lag.toFixed(1)+"px)";
  }
}
let drag=false,lastX=0,vel=0,moved=0;
let _lastT=0;
function frame(now){
  if(!running)return;
  rafId=requestAnimationFrame(frame);
  /* sample the opening frames, then decide once */
  if(!QUAL.judged){
    if(_lastT){ QUAL.n++; if(QUAL.n>4) QUAL.ds.push(now-_lastT); }
    _lastT=now;
    if(QUAL.ds.length>=24) judgeQuality();
  }
  const T=now/1000,h=1/60,n=nodes.length||1,per=Math.PI*2/n;
  if(!drag){
    const nearest=Math.round(-S.th/per), goal=(snapTo===null)?nearest:snapTo;
    const err=(-goal*per)-S.th;
    if(snapTo!==null){
      S.thV+=(SNAP_K*err-SNAP_C*S.thV)*h;
      if(Math.hypot(err,S.thV/Math.sqrt(SNAP_K))<.004){S.th=-goal*per;S.thV=0;snapTo=null;}
    }else{
      const grip=1/(1+Math.abs(S.thV)*5.5);
      S.thV+=(34*err*grip-3.6*S.thV*grip)*h; S.thV*=COAST;
      if(Math.hypot(err,S.thV/5.5)<.006){S.th=-nearest*per;S.thV=0;}
    }
    S.thV=clampV(S.thV);
    if(nearest!==J.detent){
      if(J.detent!==-1&&!REDUCE&&navigator.vibrate){try{navigator.vibrate(7);}catch(e){}}
      J.detent=nearest; focus=((nearest%n)+n)%n; paintHub();
    }
    S.th+=S.thV*h;
  }else{ S.th+=S.thV*h; S.thV*=.88; }
  J.lag+=((-(S.thV/MAXV)*(ND*LAGF))-J.lag)*.18;
  if(Math.abs(J.lag)<.15&&S.thV===0)J.lag=0;

  /* the camera eases toward its target and never quite snaps, which is what
     makes it read as a camera rather than a cursor */
  if(!CANHOVER&&!REDUCE){
    cam.pxT=Math.sin(T*.16)*.55; cam.pyT=Math.cos(T*.11)*.4;
  }
  cam.px+=(cam.pxT-cam.px)*.045; cam.py+=(cam.pyT-cam.py)*.045;

  /* the glow spring: target 1 while a section is focused and the dial is calm,
     falling away while it turns, so light gathers as it settles */
  /* At C=17 this was damped to 0.69 and overshot by half a percent — a spring
     nobody could see. At 12 the ratio is 0.49: the light arrives about a fifth
     brighter than it rests, then falls back. That overshoot IS the effect. */
  const want=REDUCE?1:Math.max(0,1-Math.abs(S.thV)*.42);
  BLOOM.vv+=(150*(want-BLOOM.v)-12*BLOOM.vv)*h; BLOOM.v+=BLOOM.vv*h;
  if(BLOOM.v<0)BLOOM.v=0; if(BLOOM.v>1.35)BLOOM.v=1.35;

  /* the dolly. On open the whole rig pushes in from slightly small and far, so
     the ring arrives rather than appears. */
  const since=(now-openedAt)/1000;
  const dolly=REDUCE?1:(since<1.1?(1-Math.pow(1-Math.min(1,since/1.1),3))*.14+.86:1);
  const lean=REDUCE?0:1;
  $("ndrig").style.transform=
     "translateZ("+((dolly-1)*260).toFixed(1)+"px) scale("+dolly.toFixed(4)+") "
    +"rotateX("+((-cam.py*7-5)*lean).toFixed(2)+"deg) "
    +"rotateY("+((cam.px*9)*lean).toFixed(2)+"deg)";

  /* The light the focused section throws back into the room.
     This used to call getBoundingClientRect() on the focused ball every frame,
     which forces a synchronous layout of the whole page 60 times a second —
     the second half of the frame-budget problem. layout() already knows where
     it put every ball, so it leaves the focused one's centre behind and this
     just reads it. No measurement, no layout, no cost. */
  if(!REDUCE && QUAL.tier>=2 && FOCUS_XY.ok){
    const size=ND*(3.6+BLOOM.v*1.5), b=$("ndbloom");
    b.style.transform="translate("+(FOCUS_XY.x-size/2).toFixed(0)+"px,"
      +(FOCUS_XY.y-size/2).toFixed(0)+"px) translateZ(0)";
    b.style.width=b.style.height=size.toFixed(0)+"px";
    b.style.opacity=(Math.min(1,BLOOM.v)*.9).toFixed(3);
  }
  drawSky(T); layout(T);
}

/* ---------------- open / close ----------------
   The loop only runs while the menu is open. A public page must not keep a
   canvas and a spring solver alive behind a closed door on someone's phone. */
let lastFocus=null;
function openDial(){
  if(!ready||!RING.length)return;
  lastFocus=document.activeElement;
  $("nd").classList.add("on"); document.body.style.overflow="hidden";
  sizeSky(); render();
  openedAt=performance.now(); BLOOM.v=0; BLOOM.vv=0; _lastT=0;
  cam.px=cam.py=cam.pxT=cam.pyT=0;
  if(!running){running=true;rafId=requestAnimationFrame(frame);}
  setTimeout(()=>$("ndq").focus({preventScroll:true}),80);
}
function closeDial(){
  closeSection();
  $("nd").classList.remove("on"); document.body.style.overflow="";
  running=false; cancelAnimationFrame(rafId);
  $("ndq").value=""; showResults(null);
  if(lastFocus&&lastFocus.focus)lastFocus.focus();
}
/* ---------------- wiring, once the overlay exists ---------------- */
/* ---------------- declarations the whole module shares ----------------
   These were swept into wire() by an over-eager split, which put buildThings,
   THINGS and the search helpers out of reach of the fetch that needs them.
   wire() below now holds listener registrations and nothing else. */
let openIdx=-1;
function openSection(i){
  const s=RING[i]; if(!s)return;
  openIdx=i;
  const b=nodes[i].getBoundingClientRect();
  const p=$("ndpanel");
  p.style.setProperty("--ox",(b.left+b.width/2-innerWidth/2).toFixed(0)+"px");
  p.style.setProperty("--oy",(b.top+b.height/2-innerHeight/2).toFixed(0)+"px");
  $("ndpicon").innerHTML='<svg viewBox="0 0 24 24">'+(ICON[s.k]||"")+'</svg>';
  $("ndptitle").textContent=s.n; $("ndpsub").textContent=s.s;
  /* real anchors. The old menu used buttons and location.href, so nobody could
     middle-click or ⌘-click a room open — on a library people do that constantly. */
  $("ndpb").innerHTML=s.items.map(it=>
    '<a class="nd-room" href="'+esc(it.u)+'"><b>'+esc(it.t)+'</b><span>'+esc(it.d)+'</span></a>').join("");
  requestAnimationFrame(()=>{$("ndscrim").classList.add("on");p.classList.add("on");});
  setTimeout(()=>{const a=$("ndpb").querySelector("a");if(a)a.focus({preventScroll:true});},120);
}
function closeSection(){
  $("ndscrim").classList.remove("on"); $("ndpanel").classList.remove("on");
  if(openIdx>=0&&nodes[openIdx]){nodes[openIdx]._wv+=2.4;nodes[openIdx].focus({preventScroll:true});}
  openIdx=-1;
}
function step(dir){
  const per=Math.PI*2/(nodes.length||1), cur=Math.round(-S.th/per);
  snapTo=Math.max(cur-LOOKAHEAD,Math.min(cur+LOOKAHEAD,((snapTo===null)?cur:snapTo)+dir));
}
const WNOTCH=120,WGAP=175,WIDLE=260;
let wAcc=0,wLast=0,wStep=0,wSign=0;
let kStep=0;
const fold=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
let THINGS=[];
function buildThings(){
  THINGS=[];
  SECTIONS.forEach(s=>(s.items||[]).forEach(it=>THINGS.push({kind:"Rooms",t:it.t,d:it.d,u:it.u})));
  PATH.forEach(n=>THINGS.push({kind:"The Path",t:n.t,d:"chapter "+n.i,u:"/#node-"+n.i}));
  for(let i=1;i<=114;i++)THINGS.push({kind:"Surahs",t:"Surah "+i,d:"open the Mushaf at "+i,u:"/quran?surah="+i});
  WORDS.forEach(w=>THINGS.push({kind:"Words",t:w.t,d:w.s,u:"/dictionary#"+w.i}));
  THINGS.forEach(o=>o.f=fold(o.t+" "+(o.d||"")));
}
const ORDER=["Rooms","Words","The Path","Surahs"];
function showResults(html){
  const r=$("ndres");
  if(html===null){r.classList.remove("on");$("ndreswrap").innerHTML="";$("ndstage").style.display="";return;}
  r.classList.add("on");$("ndreswrap").innerHTML=html;$("ndstage").style.display="none";
}
let qt;

function wire(){
  $("ndclose").addEventListener("click",closeDial);

  /* ---------------- a section opens ---------------- */
  $("ndpx").addEventListener("click",closeSection);
  $("ndscrim").addEventListener("click",closeSection);

  /* ---------------- turning it ---------------- */

  stage.addEventListener("pointerdown",e=>{
    if(openIdx>=0)return;
    stage.setPointerCapture(e.pointerId);drag=true;snapTo=null;moved=0;lastX=e.clientX;vel=0;S.thV*=.3;
    const el=e.target.closest(".nd-node"); if(el)nodes[+el.dataset.i]._wv+=3.2;
  });
  stage.addEventListener("pointermove",e=>{
    if(CANHOVER){cam.pxT=(e.clientX/innerWidth-.5)*2;cam.pyT=(e.clientY/innerHeight-.5)*2;}
    if(!drag)return;
    const dx=e.clientX-lastX;lastX=e.clientX;moved+=Math.abs(dx);
    S.th+=dx*(COARSE?.0043:.0052);S.thV=clampV(dx*TRACK);vel=dx;
  });
  stage.addEventListener("pointerup",e=>{
    const tap=moved<8;
    if(drag){drag=false;S.thV=clampV(S.thV+vel*FLING);}
    if(!tap)return;
    const el=e.target.closest(".nd-node");
    if(el){e.preventDefault();const i=+el.dataset.i;nodes[i]._wv+=4.5;openSection(i);}
  });
  stage.addEventListener("pointercancel",()=>{drag=false;});
  /* an anchor still navigates on a real click (middle/⌘ included); a plain left
     click is intercepted above and opens the section instead */
  $("ndrig").addEventListener("click",e=>{
    const el=e.target.closest(".nd-node");
    if(el&&!e.metaKey&&!e.ctrlKey&&e.button===0)e.preventDefault();
  });
  stage.addEventListener("wheel",e=>{
    if(openIdx>=0)return;
    e.preventDefault();
    const now=performance.now();
    const unit=e.deltaMode===1?16:e.deltaMode===2?innerHeight:1;
    const raw=Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX;
    const d=raw*unit,sg=d<0?-1:1;
    if(sg!==wSign||now-wLast>WIDLE){wAcc=0;wSign=sg;}
    wLast=now;wAcc+=d;
    if(Math.abs(wAcc)<WNOTCH)return;
    if(now-wStep<WGAP){wAcc=sg*WNOTCH;return;}
    wStep=now;wAcc=0;step(sg);
  },{passive:false});
  if(CANHOVER){
    $("ndrig").addEventListener("pointerover",e=>{
      const el=e.target.closest(".nd-node"); if(!el||el._hot)return; el._hot=1;nodes[+el.dataset.i]._wv+=3.1;});
    $("ndrig").addEventListener("pointerout",e=>{
      const el=e.target.closest(".nd-node"); if(!el||el.contains(e.relatedTarget))return;
      el._hot=0;nodes[+el.dataset.i]._wv-=1.4;});
  }
  addEventListener("keydown",e=>{
    if(!$("nd").classList.contains("on"))return;
    if(e.key==="Escape"){e.preventDefault();openIdx>=0?closeSection():closeDial();return;}
    if(openIdx>=0)return;
    if($("ndres").classList.contains("on"))return;
    const dir=(e.key==="ArrowRight"||e.key==="ArrowDown")?1:(e.key==="ArrowLeft"||e.key==="ArrowUp")?-1:0;
    if(dir){e.preventDefault();const t=performance.now();if(t-kStep>=WGAP){kStep=t;step(dir);}return;}
    if((e.key==="Enter")&&document.activeElement===$("ndq")&&!$("ndq").value){e.preventDefault();openSection(focus);}
  });
  addEventListener("resize",()=>{if(running){sizeSky();metrics();}});

  /* ---------------- search: the other 708 ---------------- */
  $("ndq").addEventListener("input",()=>{
    clearTimeout(qt);
    qt=setTimeout(()=>{
      const q=fold($("ndq").value.trim());
      if(!q){showResults(null);return;}
      const hits=[];
      for(const o of THINGS){
        const at=o.f.indexOf(q); if(at<0)continue;
        hits.push([(at===0||o.f.charAt(at-1)===" "?0:1)*100+ORDER.indexOf(o.kind)*10+Math.min(at,9),o]);
        if(hits.length>400)break;
      }
      if(!hits.length){showResults('<p class="none">Nothing by that name. Try fewer letters.</p>');return;}
      hits.sort((a,b)=>a[0]-b[0]);
      let out="",kind="";
      for(const [,o] of hits.slice(0,40)){
        if(o.kind!==kind){kind=o.kind;out+='<p class="nd-kind">'+esc(kind)+'</p>';}
        out+='<a class="nd-room" href="'+esc(o.u)+'"><b>'+esc(o.t)+'</b><span>'+esc(o.d||"")+'</span></a>';
      }
      showResults(out);
    },110);
  });
/* the magnifier the header already carries */
  document.addEventListener("click",e=>{
    const t=e.target.closest&&e.target.closest("[data-nm-open]"); if(!t)return;
    e.preventDefault(); e.stopPropagation();
    loadIndex().then(()=>{ ready?openDial():(location.href="/#search"); });
  },true);
}
/* warm the index before it is wanted */
["pointerenter","touchstart","focusin"].forEach(ev=>
  document.addEventListener(ev,e=>{
    if(e.target.closest&&e.target.closest("[data-nm-open]"))loadIndex();
  },{capture:true,passive:true}));

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",buildShell);
else buildShell();
})();
