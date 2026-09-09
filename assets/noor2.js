/* NOOR · noor2.js · the second cut's shell, for any page that wants it.
   Draws the reels' night on a fixed canvas (half resolution, 30 fps, paused
   when hidden, one frame under reduced motion, the CSS still beneath when
   WebGL2 is absent); reveals each .n2-idea as it enters; hides the top line
   while reading down; lights the bar's link and slides its pill; shares
   with the phone's own sheet or the clipboard; offers the home screen once
   after the second visit. The physics: buttons lean to a pointer and press
   on a spring under a thumb; sheets rise and are pulled shut; the glow
   eases behind the words being read and swells on each arrival and press;
   a hairline under the top line shows how far a long screen is read. All
   off under reduced motion. No dependency, no build. Runs by itself when
   <html> or <body> carries data-n2 (empty: everything; or the parts wanted).
   window.NOOR2 = { night, reveal, share, bar, sheet, homePrompt, hideNotice }. */
(function () {
  "use strict";
  var doc = document, W = window;
  var reduce = W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var bloom = 0, focus = 0.46, focusTo = 0.46;

  function q(s, r) { return (r || doc).querySelector(s); }
  function all(s, r) { return [].slice.call((r || doc).querySelectorAll(s)); }
  function el(tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* the night */
  var VS = "#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  var FS = "#version 300 es\nprecision mediump float;out vec4 O;uniform vec2 R;uniform float t,bloom,focus;" +
    "const vec3 skyA=vec3(.016,.024,.059),skyB=vec3(.039,.063,.141),gold=vec3(.788,.635,.153),goldHi=vec3(.914,.784,.416);" +
    "float hash(vec2 p){uvec2 q=uvec2(ivec2(floor(p*64.)))*uvec2(1597334677u,3812015801u);uint h=(q.x^q.y^7000u)*1597334677u;h^=h>>15u;h*=2246822519u;h^=h>>13u;return float(h)*(1./4294967296.);}" +
    "float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}" +
    "float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*noise(p);p=p*2.03+7.1;a*=.5;}return v;}" +
    "float starD(vec2 p,float r,float nn,float kk,float ph){float a=atan(p.y,p.x)+ph;float L=length(p);float inner=r*cos(3.14159265*kk/nn)/cos(3.14159265*(kk-1.)/nn);float seg=6.2831853/nn;float m=mod(a,seg);vec2 A=vec2(r,0.);vec2 B=vec2(inner*cos(seg*.5),inner*sin(seg*.5));vec2 C=vec2(r*cos(seg),r*sin(seg));vec2 q=vec2(L*cos(m),L*sin(m));vec2 e1=B-A,e2=C-B;float d1=length(q-A-e1*clamp(dot(q-A,e1)/dot(e1,e1),0.,1.));float d2=length(q-B-e2*clamp(dot(q-B,e2)/dot(e2,e2),0.,1.));return min(d1,d2);}" +
    "void main(){vec2 fc=gl_FragCoord.xy;vec2 uv=(fc-.5*R)/R.y;vec2 centre=vec2(0.,.5-focus);" +
    "float v=clamp(uv.y+.55,0.,1.);vec3 col=mix(skyB,skyA,v*.82+.10);" +
    "float breath=.62+.16*sin(t*.42)+.10*sin(t*.17+1.3);float amt=breath*(.74+.55*bloom);" +
    "vec2 g=(uv-centre)*vec2(1.,.86);float L=length(g);" +
    "col+=goldHi*exp(-L*L*6.)*.16*amt;col+=gold*exp(-L*2.8)*.055*amt;" +
    "float hz=fbm(uv*1.7+vec2(t*.013,-t*.008));col+=gold*hz*.018*(.5+.5*amt)*(1.-smoothstep(.25,.85,L));" +
    "float d1=starD(uv-centre*.55,.88,8.,3.,-1.5708+t*.017);col+=gold*exp(-d1*d1/(.0019*.0019))*(.055+.045*bloom);" +
    "for(int i=0;i<2;i++){float sc=15.+float(i)*11.;vec2 p=uv*sc+vec2(t*.004*(1.+float(i)),t*.006);vec2 cell=floor(p),f=fract(p)-.5;float h=hash(cell+float(i)*31.7);" +
    "if(h>.972){vec2 o=vec2(hash(cell+1.3),hash(cell+2.7))-.5;float tw=.55+.45*sin(t*(.5+1.4*hash(cell+5.1))+h*40.);col+=.22*tw*exp(-dot(f-o*.6,f-o*.6)*300.)*vec3(1.,.985,.94);}}" +
    "col=1.-exp(-col*1.25);col=pow(max(col,0.),vec3(.96));col*=1.-.62*pow(length(uv*vec2(.80,.58)),2.1);" +
    "col+=(hash(fc+floor(t*30.)*.37)-.5)*.02;O=vec4(clamp(col,0.,1.),1.);}";

  function night(canvas) {
    if (!canvas) {
      canvas = q("#n2-gl");
      if (!canvas) { canvas = el("canvas"); canvas.id = "n2-gl"; canvas.setAttribute("aria-hidden", "true"); doc.body.insertBefore(canvas, doc.body.firstChild); }
    }
    var gl = null;
    try { gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power" }); } catch (e) {}
    if (!gl) return null;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    var prog;
    try {
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { return null; }
    gl.useProgram(prog);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = { R: gl.getUniformLocation(prog, "R"), t: gl.getUniformLocation(prog, "t"), bloom: gl.getUniformLocation(prog, "bloom"), focus: gl.getUniformLocation(prog, "focus") };
    function size() {
      var s = Math.min(W.devicePixelRatio || 1, 2) * 0.5;
      canvas.width = Math.max(1, Math.round(W.innerWidth * s)); canvas.height = Math.max(1, Math.round(W.innerHeight * s));
      gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform2f(U.R, canvas.width, canvas.height);
    }
    size(); W.addEventListener("resize", size);
    var t0 = performance.now(), last = 0, running = true, stopped = false;
    function frame(now) {
      if (!running || stopped) return;
      if (now - last >= 33) {
        last = now; bloom *= 0.965; focus += (focusTo - focus) * (reduce ? 1 : 0.06);
        gl.uniform1f(U.t, (now - t0) / 1000); gl.uniform1f(U.bloom, bloom); gl.uniform1f(U.focus, focus);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      if (!reduce) requestAnimationFrame(frame);
    }
    canvas.classList.add("n2-on");
    requestAnimationFrame(frame);
    doc.addEventListener("visibilitychange", function () { running = !doc.hidden; if (running && !reduce) requestAnimationFrame(frame); });
    return { stop: function () { stopped = true; }, bloom: function () { bloom = 1; }, focus: function (f) { focusTo = f; } };
  }

  /* the arrivals */
  function reveal(root) {
    var ideas = all(".n2-idea", root);
    if (!ideas.length) return;
    if (!("IntersectionObserver" in W)) { ideas.forEach(function (s) { s.classList.add("n2-in"); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !e.target.classList.contains("n2-in")) { e.target.classList.add("n2-in"); bloom = 1; }
      });
    }, { threshold: [0.18] });
    ideas.forEach(function (s) { io.observe(s); });
  }

  /* ------------------------------------------------- the read, once a frame:
     the screen under the viewport's centre is the one being read; the light
     moves behind its hook, the hairline shows how far down a tall screen the
     reader is, the top line hides on the way down. */
  var lastY = 0, ticking = false;
  function onRead() {
    ticking = false;
    var y = W.scrollY || 0, vh = W.innerHeight, top = q(".n2-top");
    if (top) top.classList.toggle("n2-hide", y > lastY && y > 60);
    lastY = y;
    var cur = null;
    all(".n2-idea").some(function (s) { var r = s.getBoundingClientRect(); if (r.top <= vh * 0.5 && r.bottom > vh * 0.5) { cur = s; return true; } });
    if (!cur) return;
    var hook = q(".n2-h1,.n2-h2,.n2-quran,.n2-word-ar,.n2-reel,.n2-h3", cur), h = cur.getBoundingClientRect();
    if (hook) { var b = hook.getBoundingClientRect(); focusTo = Math.max(0.12, Math.min(0.88, (b.top + b.height / 2) / vh)); }
    if (top) top.style.setProperty("--n2-p", h.height > vh + 40 ? Math.max(0, Math.min(1, -h.top / (h.height - vh))) : 0);
  }
  function topLine() {
    if (q(".n2-top") && !q(".n2-prog")) q(".n2-top").appendChild(el("i", "n2-prog"));
    W.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onRead); } }, { passive: true });
    W.addEventListener("resize", onRead);
    onRead();
  }

  /* ---------------------------------------------------- the touch, the pull:
     a button leans to a pointer within 28 px by 6 px at most and springs
     back; under a thumb it presses to .96 and lets go through 1.02. Transform
     only, one frame at a time, still under reduced motion. */
  function physics() {
    if (reduce) return;
    var sel = ".n2-btn,.n2-bar a", fine = W.matchMedia && W.matchMedia("(hover: hover) and (pointer: fine)").matches, raf = 0;
    if (fine) doc.addEventListener("pointermove", function (e) {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        all(sel).forEach(function (b) {
          var r = b.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
          var near = Math.abs(dx) < r.width / 2 + 28 && Math.abs(dy) < r.height / 2 + 28;
          if (near || b.classList.contains("n2-mag")) { b.classList.toggle("n2-mag", near); b.style.setProperty("--mx", (near ? dx / (r.width / 2 + 28) * 6 : 0).toFixed(1) + "px"); b.style.setProperty("--my", (near ? dy / (r.height / 2 + 28) * 6 : 0).toFixed(1) + "px"); }
        });
      });
    }, { passive: true });
    doc.addEventListener("pointerdown", function (e) {
      var b = e.target.closest && e.target.closest(sel); if (!b) return;
      b.classList.add("n2-press"); bloom = 1;
      var up = function () { b.classList.remove("n2-press"); b.classList.add("n2-release"); setTimeout(function () { b.classList.remove("n2-release"); }, 180); doc.removeEventListener("pointerup", up); };
      doc.addEventListener("pointerup", up, { once: true });
    }, { passive: true });
  }

  /* the share */
  var toastEl, toastT;
  function toast(m) {
    if (!toastEl) { toastEl = el("div", "n2-toast"); toastEl.setAttribute("role", "status"); doc.body.appendChild(toastEl); }
    toastEl.textContent = m; toastEl.classList.add("n2-show");
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("n2-show"); }, 1600);
  }
  function share(d) {
    d = d || {};
    var data = { title: d.title || doc.title, text: d.text || "", url: d.url || location.href };
    if (d.files && d.files.length && navigator.canShare && navigator.canShare({ files: d.files })) data.files = d.files;
    if (navigator.share) return navigator.share(data).catch(function () {});
    var line = [data.text, data.url].filter(Boolean).join(" · ");
    if (navigator.clipboard) return navigator.clipboard.writeText(line).then(function () { toast("Copied"); }, function () { toast("Could not copy"); });
    toast("Sharing is not available here");
    return Promise.resolve();
  }
  function wireShare() {
    doc.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-n2-share]"); if (!b) return;
      e.preventDefault();
      share({ title: b.getAttribute("data-n2-title") || doc.title, text: b.getAttribute("data-n2-share") || "", url: b.getAttribute("data-n2-url") || location.href });
    });
  }

  /* the bar */
  var LINKS = [
    ["Today", "/today", '<path d="M12 3l2.4 5.2L20 9l-4.2 3.8L17 18.5 12 15.6 7 18.5l1.2-5.7L4 9l5.6-.8z"/>'],
    ["Read", "/quran", '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5V5.5M8 7h8M8 11h6"/>'],
    ["Words", "/dictionary", '<path d="M4 18h16M4 6h16M4 12h10"/>'],
    ["Listen", "/quran#listen", '<path d="M5 9v6h4l5 4V5L9 9z"/><path d="M17 8a5 5 0 0 1 0 8"/>'],
    ["Search", "/dictionary", '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.3-4.3"/>']
  ];
  function bar(active) {
    var nav = q(".n2-bar");
    if (!nav) {
      nav = el("nav", "n2-bar"); nav.setAttribute("aria-label", "Rooms");
      nav.innerHTML = LINKS.map(function (l) {
        return '<a href="' + l[1] + '"' + (l[0] === "Search" ? ' data-n2-search data-nm-open' : "") + '><svg viewBox="0 0 24 24" aria-hidden="true">' + l[2] + "</svg>" + l[0] + "</a>";
      }).join("");
      doc.body.appendChild(nav);
    }
    var here = String(active || location.pathname).replace(/\/+$/, "") || "/";
    var links = all("a", nav), hit = null;
    links.forEach(function (a) {
      var p = a.getAttribute("href").split("#")[0].replace(/\/+$/, "") || "/";
      if (!hit && !a.hasAttribute("data-n2-search") && (p === here || (p !== "/" && here.indexOf(p + "/") === 0))) hit = a;
    });
    /* no link owns this address: the page's own choice stands */
    if (hit || !q(".n2-on", nav)) links.forEach(function (a) { a.classList.toggle("n2-on", a === hit); });
    /* the pill slides to the lit room */
    var pill = q(".n2-pill-bg", nav) || nav.insertBefore(el("i", "n2-pill-bg"), nav.firstChild), on = q(".n2-on", nav);
    if (on) { var r = on.getBoundingClientRect(), n = nav.getBoundingClientRect(); pill.style.width = r.width + "px"; pill.style.transform = "translateX(" + (r.left - n.left) + "px)"; pill.classList.add("n2-show"); }
    else pill.classList.remove("n2-show");
    if (!nav.n2wired) { nav.n2wired = 1; W.addEventListener("resize", function () { bar(active); }); }
    /* Search opens the page's own search (the magnifier's box or the menu
       dial); a page with neither goes to the dictionary */
    var s = q("[data-n2-search]", nav);
    if (s) s.addEventListener("click", function (e) {
      if (W.NOOR_SEARCH && W.NOOR_SEARCH.open) { e.preventDefault(); W.NOOR_SEARCH.open(); }
    });
    return nav;
  }

  /* --- a sheet: rises on the spring; closes on a tap outside, its close
     button, or a pull past 80 px */
  function sheet(html) {
    var wrap = el("div", "n2-sheet-wrap", '<div class="n2-sheet" role="dialog"><i class="n2-handle"></i>' + html + "</div>");
    var box = q(".n2-sheet", wrap), y0 = null, dy = 0, raf = 0;
    doc.body.appendChild(wrap);
    function open() { requestAnimationFrame(function () { wrap.classList.add("n2-show"); }); bloom = 1; }
    function close() { wrap.classList.remove("n2-show"); setTimeout(function () { wrap.remove(); }, reduce ? 0 : 500); }
    wrap.addEventListener("click", function (e) { if (e.target === wrap || (e.target.closest && e.target.closest("[data-n2-close]"))) close(); });
    box.addEventListener("pointerdown", function (e) { if (e.target.closest("a,button,input")) return; y0 = e.clientY; box.classList.add("n2-drag"); box.setPointerCapture(e.pointerId); });
    box.addEventListener("pointermove", function (e) {
      if (y0 === null || raf) return;
      raf = requestAnimationFrame(function () { raf = 0; dy = Math.max(0, e.clientY - y0); box.style.transform = "translateY(" + dy + "px)"; });
    });
    var end = function () { if (y0 === null) return; y0 = null; box.classList.remove("n2-drag"); box.style.transform = ""; if (dy > 80) close(); dy = 0; };
    box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
    open();
    return { open: open, close: close, el: box };
  }

  /* the home screen, once */
  var deferredInstall = null;
  W.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferredInstall = e; });
  function homePrompt() {
    if (store("n2-home") === "done") return;
    if (W.matchMedia && W.matchMedia("(display-mode: standalone)").matches) return;
    if (navigator.standalone) return;
    var n = parseInt(store("n2-visits") || "0", 10) + 1; store("n2-visits", String(n));
    if (n < 2) return;
    var ua = navigator.userAgent || "";
    var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var android = /Android/.test(ua);
    if (!ios && !android) return;
    setTimeout(function () {
      if (android && !deferredInstall) return;
      var how = ios ? "Tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>." : "The library opens like an app, offline as well.";
      var sh = sheet('<p><b>Add NOOR to the home screen.</b></p><p>' + how + '</p><div class="n2-row">' +
        (android ? '<button class="n2-btn n2-gold n2-glow" type="button" data-n2-install>Add</button>' : "") +
        '<button class="n2-btn" type="button" data-n2-close>Not now</button></div>');
      store("n2-home", "done");
      var ib = q("[data-n2-install]", sh.el);
      if (ib) ib.addEventListener("click", function () { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } sh.close(); });
    }, 2500);
  }

  function hideNotice() { var n = q("#noor-notice"); if (n && n.parentNode) n.parentNode.removeChild(n); }

  W.NOOR2 = { night: night, reveal: reveal, share: share, bar: bar, sheet: sheet, homePrompt: homePrompt, hideNotice: hideNotice, toast: toast };

  /* the run */
  function boot() {
    var root = doc.documentElement.hasAttribute("data-n2") ? doc.documentElement : (doc.body && doc.body.hasAttribute("data-n2") ? doc.body : null);
    if (!root) return;
    var want = (root.getAttribute("data-n2") || "").trim().split(/\s+/).filter(Boolean);
    var has = function (k) { return !want.length || want.indexOf(k) >= 0; };
    doc.documentElement.classList.add("n2-live");
    if (has("night") && !q(".n2-still")) doc.body.insertBefore(el("div", "n2-still"), doc.body.firstChild);
    if (has("night")) night();
    if (has("reveal")) reveal();
    if (has("top")) topLine();
    if (has("share")) wireShare();
    if (has("bar")) bar();
    physics();
    if (has("home")) homePrompt();
    hideNotice();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})();
