/* NOOR · noor2.js · the second cut's shell, for any page that wants it.
   The reels' night on a fixed canvas (half resolution, 30 fps, paused when
   hidden, one frame under reduced motion, the CSS still beneath without
   WebGL2); each .n2-idea revealed as it enters; the top line hidden while
   reading down; the bar's door lit, its pill slid; the phone's own share or
   the clipboard; the home screen offered once after the second visit. The
   physics: buttons lean to a pointer and press on a spring; sheets rise and
   are pulled shut; the glow and a soft vignette ease behind the words being
   read; a hairline at the very top shows how far down the page the reader
   is; marks at the right edge, one per screen, carry a gold pill that moves
   as a liquid; each screen's eyebrow is numbered. All off under reduced
   motion. No dependency, no build. Runs by itself when <html> or <body>
   carries data-n2 (empty: everything; or the parts wanted). NOOR2.inject()
   dresses a page that is not in the shell (the older rooms, via noor-fx.js):
   the bar, the share in the footer, the home-screen offer, and the classes
   noor2-skin.css dresses by (n2-skin; n2-dark or n2-parch by the page's own
   background; n2-bar-away while a player or sheet of its own holds the
   bottom edge). window.NOOR2 = { night, reveal, share, bar, sheet,
   homePrompt, hideNotice, toast, dots, inject }. */
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
    /* the hairline star behind the hook, .07 at rest */
    "float d1=starD(uv-centre*.55,.88,8.,3.,-1.5708+t*.017);col+=gold*exp(-d1*d1/(.0019*.0019))*(.07+.05*bloom);" +
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

  /* the marks: one per screen (two to twelve; forty groups are a list), the
     read one under a gold pill that stretches over both and settles. */
  var marks = null, pill = null, curIdx = -1, pillT, hold = 0;
  function dots(root) {
    var ideas = all(".n2-idea", root);
    if (ideas.length < 2 || ideas.length > 12 || q(".n2-dots")) return null;
    var box = el("div", "n2-dots"); box.setAttribute("aria-hidden", "true");
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    ideas.forEach(function (s, i) {
      var m = el("i"); m.addEventListener("click", function () { mark(i); hold = Date.now() + 900; s.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); bloom = 1; });
      box.appendChild(m);
      var e = s.firstElementChild;
      if (e && e.classList.contains("n2-eyebrow") && !q(".n2-of", e)) { e.classList.add("n2-numbered"); e.insertBefore(el("span", "n2-of", pad(i + 1) + " / " + pad(ideas.length)), e.firstChild); }
    });
    pill = el("b", "n2-dots-pill"); box.appendChild(pill);
    doc.body.appendChild(box); marks = all("i", box);
    return box;
  }
  function mark(i) {
    if (!marks || i === curIdx || !marks[i]) return;
    var from = curIdx; curIdx = i;
    marks.forEach(function (m, k) { m.classList.toggle("n2-on", k === i); });
    var t = marks[i].offsetTop - 1, h = marks[i].offsetHeight + 2;
    var settle = function () { pill.classList.remove("n2-stretch"); pill.style.top = t + "px"; pill.style.height = h + "px"; };
    clearTimeout(pillT);
    if (from < 0 || reduce) return settle();
    var f = marks[from].offsetTop - 1;
    pill.classList.add("n2-stretch");
    pill.style.top = Math.min(f, t) + "px"; pill.style.height = (Math.abs(t - f) + h) + "px";
    pillT = setTimeout(settle, 240);
  }

  /* the read, once a frame: the screen under the viewport's centre is the
     one being read; the light, the vignette and the mark follow it. */
  var lastY = 0, ticking = false;
  function onRead() {
    ticking = false;
    var y = W.scrollY || 0, vh = W.innerHeight, top = q(".n2-top"), prog = q(".n2-prog"), vig = q(".n2-vig");
    if (top) top.classList.toggle("n2-hide", y > lastY && y > 60);
    lastY = y;
    var room = doc.documentElement.scrollHeight - vh;
    if (prog) prog.style.setProperty("--n2-p", room > 40 ? Math.max(0, Math.min(1, y / room)) : 0);
    var cur = null, idx = -1, ideas = all(".n2-idea");
    ideas.some(function (s, i) { var r = s.getBoundingClientRect(); if (r.top <= vh * 0.5 && r.bottom > vh * 0.5) { cur = s; idx = i; return true; } });
    if (!cur) return;
    if (Date.now() > hold) mark(idx);
    var hook = q(".n2-h1,.n2-h2,.n2-quran,.n2-word-ar,.n2-reel,.n2-h3", cur);
    if (hook) {
      var b = hook.getBoundingClientRect(), c = b.top + b.height / 2;
      focusTo = Math.max(0.12, Math.min(0.88, c / vh));
      if (vig) vig.style.setProperty("--n2-vy", Math.round(Math.max(vh * 0.15, Math.min(vh * 0.85, c))) + "px");
    }
  }
  function topLine() {
    if (!q(".n2-prog")) { var p = el("i", "n2-prog"); p.setAttribute("aria-hidden", "true"); doc.body.appendChild(p); }
    if (!q(".n2-vig")) { var v = el("i", "n2-vig"); v.setAttribute("aria-hidden", "true"); doc.body.insertBefore(v, q(".n2-main") || doc.body.firstChild); }
    W.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onRead); } }, { passive: true });
    W.addEventListener("resize", onRead);
    onRead();
  }

  /* the touch: a lean to the pointer by 6 px at most; a press to .96 */
  function physics() {
    if (reduce || doc.n2phys) return;
    doc.n2phys = 1;
    var sel = ".n2-btn,.n2-bar a,.n2-pill", fine = W.matchMedia && W.matchMedia("(hover: hover) and (pointer: fine)").matches, raf = 0;
    if (fine) doc.addEventListener("pointermove", function (e) {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        all(".n2-btn,.n2-bar a").forEach(function (b) {
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
    if (doc.n2share) return; doc.n2share = 1;
    doc.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-n2-share]"); if (!b) return;
      e.preventDefault();
      share({ title: b.getAttribute("data-n2-title") || doc.title, text: b.getAttribute("data-n2-share") || "", url: b.getAttribute("data-n2-url") || location.href });
    });
  }

  /* the bar: five doors, no two alike. Today: the day's light, word and
     chapter. Qur'an: the Mushaf, read and heard in one room. Story: the Path
     in order. Words: the dictionary. Search: the page's own search, else the
     words. A verse or surah lights Qur'an, a chapter Story, a Light lights
     Today only when it is the day's (the page says so). */
  var LINKS = [
    ["Today", "/today", '<circle cx="12" cy="12" r="3.6"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>'],
    ["Qur'an", "/quran", '<path d="M12 6.4C10.4 4.9 8 4.4 3 4.7v13.8c5-.3 7.4.2 9 1.8 1.6-1.6 4-2.1 9-1.8V4.7c-5-.3-7.4.2-9 1.7z"/><path d="M12 6.4v13.9"/>'],
    ["Story", "/path", '<path d="M4.5 19.5c6.5 0 3.5-9 8-9s2-6 7-6"/><circle cx="4.5" cy="19.5" r="1.6"/><circle cx="19.5" cy="4.5" r="1.6"/>'],
    ["Words", "/dictionary", '<path d="M4 18h16M4 6h16M4 12h10"/>'],
    ["More", "/#search", '<circle cx="5.5" cy="6" r="1.6"/><circle cx="5.5" cy="12" r="1.6"/><circle cx="5.5" cy="18" r="1.6"/><path d="M11 6h8M11 12h8M11 18h8"/>']
  ];
  var ALIAS = { "/verse": "/quran", "/verses": "/quran", "/surah": "/quran", "/words": "/dictionary" };
  function bar(active) {
    var nav = q(".n2-bar");
    if (!nav) {
      nav = el("nav", "n2-bar"); nav.setAttribute("aria-label", "Rooms");
      nav.innerHTML = LINKS.map(function (l) {
        /* The fifth door is the map of the house and the search, one sheet,
           drawn by noor-fx.js. Five doors cannot reach forty-two rooms, and
           until this door existed the other thirty-seven were behind a dial
           that only the arrival carried: on a phone, standing in a room,
           there was no way to the Prophets at all. Without any script it is
           a link to /#search, which the arrival answers. */
        return '<a href="' + l[1] + '"' + (l[0] === "More" ? ' data-n2-more' : "") + '><svg viewBox="0 0 24 24" aria-hidden="true">' + l[2] + "</svg>" + l[0] + "</a>";
      }).join("");
      doc.body.appendChild(nav);
    }
    var here = String(active || location.pathname).replace(/\.html$/, "").replace(/\/+$/, "") || "/";
    Object.keys(ALIAS).forEach(function (k) { if (here === k || here.indexOf(k + "/") === 0) here = ALIAS[k]; });
    var links = all("a", nav), hit = null;
    links.forEach(function (a) {
      var p = a.getAttribute("href").split("#")[0].replace(/\/+$/, "") || "/";
      if (!hit && !a.hasAttribute("data-n2-more") && (p === here || (p !== "/" && here.indexOf(p + "/") === 0))) hit = a;
    });
    if (hit || !q(".n2-on", nav)) links.forEach(function (a) { a.classList.toggle("n2-on", a === hit); });
    var pb = q(".n2-pill-bg", nav) || nav.insertBefore(el("i", "n2-pill-bg"), nav.firstChild), on = q(".n2-on", nav);
    if (on) { var r = on.getBoundingClientRect(), n = nav.getBoundingClientRect(); pb.style.width = r.width + "px"; pb.style.transform = "translateX(" + (r.left - n.left) + "px)"; pb.classList.add("n2-show"); }
    else pb.classList.remove("n2-show");
    if (!nav.n2wired) {
      nav.n2wired = 1; W.addEventListener("resize", function () { bar(active); });
    }
    return nav;
  }

  /* a sheet: rises on the spring; closes on a tap outside, its close button, a
     pull past 80 px, or Escape (it says role="dialog", and one that will not
     answer Escape traps a keyboard); the marks step aside while it is open */
  function sheet(html) {
    var wrap = el("div", "n2-sheet-wrap", '<div class="n2-sheet" role="dialog" aria-modal="true"><i class="n2-handle"></i>' + html + "</div>");
    var box = q(".n2-sheet", wrap), y0 = null, dy = 0, raf = 0;
    doc.body.appendChild(wrap);
    function esc(e) { if (e.key === "Escape") close(); }
    function open() { requestAnimationFrame(function () { wrap.classList.add("n2-show"); }); doc.documentElement.classList.add("n2-sheet-open"); doc.addEventListener("keydown", esc); bloom = 1; }
    function close() { doc.removeEventListener("keydown", esc); wrap.classList.remove("n2-show"); doc.documentElement.classList.remove("n2-sheet-open"); setTimeout(function () { wrap.remove(); }, reduce ? 0 : 500); }
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

  /* the skin: a wide fixed thing of the page's own at the bottom edge (a
     player) sends the bar away while it shows; a small one is lifted */
  function lum(c) {
    var m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c || "");
    if (!m || (m[4] !== undefined && +m[4] < 0.5)) return -1;
    return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
  }
  function inject() {
    var H = doc.documentElement, B = doc.body;
    if (!B || H.hasAttribute("data-n2") || B.hasAttribute("data-n2") || H.classList.contains("n2-skin")) return;
    var bg = lum(getComputedStyle(B).backgroundColor); if (bg < 0) bg = lum(getComputedStyle(H).backgroundColor); if (bg < 0) bg = 1;
    H.style.setProperty("--n2-skin-pad", getComputedStyle(B).paddingBottom || "0px");
    H.classList.add("n2-skin", bg < 0.5 ? "n2-dark" : "n2-parch");
    var nav = bar(); wireShare(); physics();
    var foot = q("footer");
    if (foot && !q("[data-n2-share]", foot)) {
      var fl = lum(getComputedStyle(foot).backgroundColor); if (fl < 0) fl = bg;
      var row = el("div", "n2-row n2-skin-share" + (fl >= 0.5 ? " n2-ink" : ""));
      var btn = el("button", "n2-btn", 'Share <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/></svg>');
      btn.type = "button"; btn.setAttribute("data-n2-share", doc.title); row.appendChild(btn);
      var soc = q("[data-noor-social]", foot); if (soc) foot.insertBefore(row, soc); else foot.appendChild(row);
    }
    homePrompt(); hideNotice();
    var cand = [], scanned = 0, raf = 0;
    function scan() { scanned = Date.now(); cand = all("body *").filter(function (e) { return getComputedStyle(e).position === "fixed"; }); }
    function check() {
      raf = 0;
      var vh = W.innerHeight, vw = W.innerWidth, barH = nav.offsetHeight || 72, away = false;
      cand.forEach(function (e) {
        if (e === nav || e.n2lift || (e.closest && e.closest(".n2-bar,.n2-toast,.n2-sheet-wrap,.n2-dots,#noor-translate-hint"))) return;
        var cs = getComputedStyle(e), r = e.getBoundingClientRect();
        if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05 || cs.pointerEvents === "none" || +cs.zIndex < 0 || r.height < 1 || r.top >= vh - 1 || r.bottom <= vh - barH) return;
        if (r.width >= vw * 0.8 && r.height >= 40) away = true;
        else if (r.top > vh * 0.5 && r.width < vw * 0.5) { e.n2lift = 1; e.style.setProperty("bottom", Math.round(vh - r.bottom + barH) + "px", "important"); }
      });
      nav.classList.toggle("n2-away", away); H.classList.toggle("n2-bar-away", away);
    }
    function ask() { if (!raf) raf = requestAnimationFrame(check); }
    scan(); check();
    W.addEventListener("resize", ask); doc.addEventListener("transitionend", ask, true);
    try {
      new MutationObserver(function (ms) {
        if (ms.some(function (m) { return m.type === "childList"; }) && Date.now() - scanned > 500) scan();
        ask(); setTimeout(ask, 450);
      }).observe(B, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    } catch (e) { setInterval(function () { scan(); check(); }, 1500); }
    return nav;
  }

  W.NOOR2 = { night: night, reveal: reveal, share: share, bar: bar, sheet: sheet, homePrompt: homePrompt, hideNotice: hideNotice, toast: toast, dots: dots, inject: inject };

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
    if (has("reveal")) dots();
    if (has("top")) topLine();
    if (has("share")) wireShare();
    if (has("bar")) bar();
    physics();
    if (has("home")) homePrompt();
    hideNotice();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})();
