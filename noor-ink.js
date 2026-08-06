/* ================= v35 · the living ink =================
   Handmade atmosphere for the hero: real generated noise, not flat
   gradients. At load we synthesize three organic textures ONCE
   (paper fiber, ink-blotch edge, smoke wisp) on small canvases,
   then animate them purely with GPU transforms, so the scene feels
   hand-inked and alive at ~0 per-frame cost.

   Tiered separately, as asked:
     desktop · 3 smoke wisps, 512px tiles, full breathing
     tablet  · 2 wisps, 384px tiles
     mobile  · 1 wisp + paper + edge, 256px tiles, gentler opacity
   Everything pauses off-screen and honors reduced motion. */
(function () {
  "use strict";
  var REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hero = document.getElementById("hero") || document.querySelector("[data-ink]");
  if (!hero) return;
  var SOFT = hero.getAttribute && hero.getAttribute("data-ink") === "soft";

  /* ---------- device tier ---------- */
  var w = Math.min(screen.width, innerWidth) || innerWidth;
  var coarse = matchMedia("(pointer: coarse)").matches;
  var TIER = w < 768 ? "mobile" : (coarse && w < 1200 ? "tablet" : "desktop");
  var CFG = {
    mobile:  { size: 256, wisps: 1, paperOp: .05, edgeOp: .42, wispOp: .16, dpr: 1 },
    tablet:  { size: 384, wisps: 2, paperOp: .06, edgeOp: .46, wispOp: .15, dpr: 1.25 },
    /* desktop screens are wide: the same wisp count reads as fog, not ink.
       Fewer, fainter wisps keep the scene legible on 1280 to 2560 glass. */
    desktop: { size: 512, wisps: 2, paperOp: .06, edgeOp: .40, wispOp: .12, dpr: Math.min(devicePixelRatio || 1, 1.5) }
  }[TIER];
  /* short laptop windows: the smoke sits right on the art. Thin it further. */
  if (TIER !== "mobile" && innerHeight < 820) { CFG.wispOp *= .8; CFG.edgeOp *= .88; }
  if (SOFT) { CFG.wisps = Math.max(1, CFG.wisps - 1); CFG.paperOp *= .8; CFG.edgeOp *= .7; CFG.wispOp *= .65; }
  document.documentElement.classList.add("ink-" + TIER);

  /* ---------- noise synthesis (once) ----------
     value-noise by stacking blurred random octaves: tiny random
     canvases scaled up with smoothing produce soft organic blobs. */
  function octave(size, cells, alpha) {
    var t = document.createElement("canvas");
    t.width = t.height = cells;
    var tc = t.getContext("2d");
    var img = tc.createImageData(cells, cells);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = v * alpha;
    }
    tc.putImageData(img, 0, 0);
    var o = document.createElement("canvas");
    o.width = o.height = size;
    var oc = o.getContext("2d");
    oc.imageSmoothingEnabled = true;
    oc.imageSmoothingQuality = "high";
    oc.drawImage(t, 0, 0, size, size);
    return o;
  }
  function fractal(size, spec) {           /* spec: [[cells,alpha],..] */
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var x = c.getContext("2d");
    spec.forEach(function (s) { x.drawImage(octave(size, s[0], s[1]), 0, 0); });
    return c;
  }
  /* smoke wisp: low-frequency fractal, radially feathered so tiles never show seams */
  function smokeTile(size) {
    var c = fractal(size, [[5, .5], [9, .35], [17, .22]]);
    var x = c.getContext("2d");
    x.globalCompositeOperation = "destination-in";
    var g = x.createRadialGradient(size / 2, size / 2, size * .12, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(.75, "rgba(0,0,0,.55)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
    /* tint: moonlit gold-grey */
    x.globalCompositeOperation = "source-in";
    x.fillStyle = "rgb(214,201,164)";
    x.fillRect(0, 0, size, size);
    return c.toDataURL("image/png");
  }
  /* paper fiber: high-frequency grain, faint vertical laid-lines like handmade paper */
  function paperTile(size) {
    var c = fractal(size, [[Math.floor(size / 2), .55], [Math.floor(size / 4), .3]]);
    var x = c.getContext("2d");
    x.globalCompositeOperation = "source-atop";
    x.strokeStyle = "rgba(255,255,255,.05)";
    for (var i = 0; i < size; i += 7) {
      x.beginPath(); x.moveTo(i + Math.random() * 2, 0); x.lineTo(i + Math.random() * 2, size); x.stroke();
    }
    return c.toDataURL("image/png");
  }
  /* ink edge: blotched border, made by carving a soft hole out of fractal ink */
  function edgeTile(size) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var x = c.getContext("2d");
    x.fillStyle = "rgb(4,6,15)";
    x.fillRect(0, 0, size, size);
    x.globalCompositeOperation = "destination-out";
    var g = x.createRadialGradient(size / 2, size * .46, size * .18, size / 2, size * .46, size * .62);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(.82, "rgba(0,0,0,.96)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
    /* bite blotches out of the rim so the edge looks hand-inked, not geometric */
    var n = fractal(size, [[7, .8], [13, .5]]);
    x.globalCompositeOperation = "destination-out";
    x.globalAlpha = .5;
    x.drawImage(n, 0, 0);
    x.globalAlpha = 1;
    return c.toDataURL("image/png");
  }

  var S = CFG.size;
  var smokeURL = smokeTile(S), paperURL = paperTile(S), edgeURL = edgeTile(S);

  /* ---------- css ---------- */
  var css = document.createElement("style");
  css.id = "ink-css";
  css.textContent =
  "#ink-stage{position:absolute;inset:0;z-index:6;pointer-events:none;overflow:hidden}" +
  ".ink-paper{position:absolute;inset:-4%;background-image:url(" + paperURL + ");background-size:" + S + "px;mix-blend-mode:overlay;opacity:" + CFG.paperOp + "}" +
  ".ink-edge{position:absolute;inset:-6%;background-image:url(" + edgeURL + ");background-size:100% 100%;opacity:" + CFG.edgeOp + ";transform-origin:50% 46%}" +
  ".ink-wisp{position:absolute;width:150%;height:120%;left:-25%;background-image:url(" + smokeURL + ");background-size:" + Math.round(S * 1.6) + "px;background-repeat:repeat;mix-blend-mode:soft-light;opacity:calc(" + CFG.wispOp + " * (1 - var(--dp,0) * .85))}" +
  ".ink-wisp.w1{top:-14%;animation:inkdrift1 120s linear infinite}" +
  ".ink-wisp.w2{top:18%;animation:inkdrift2 170s linear infinite;transform:rotate(180deg)}" +
  ".ink-wisp.w3{top:44%;animation:inkdrift3 210s linear infinite}" +
  ".ink-edge{animation:inkbreathe 11s ease-in-out infinite}" +
  "@keyframes inkdrift1{from{transform:translate3d(-4%,0,0) rotate(0.001deg)}50%{transform:translate3d(4%,1.5%,0) rotate(.6deg)}to{transform:translate3d(-4%,0,0) rotate(0.001deg)}}" +
  "@keyframes inkdrift2{from{transform:translate3d(3%,0,0) rotate(180deg)}50%{transform:translate3d(-3%,-1.2%,0) rotate(180.5deg)}to{transform:translate3d(3%,0,0) rotate(180deg)}}" +
  "@keyframes inkdrift3{from{transform:translate3d(-2.5%,0,0)}50%{transform:translate3d(2.5%,1%,0)}to{transform:translate3d(-2.5%,0,0)}}" +
  "@keyframes inkbreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.018)}}" +
  "#ink-stage.paused *{animation-play-state:paused}" +
  "html.ink-mobile .ink-wisp{background-size:" + Math.round(S * 1.35) + "px}" +
  (REDUCED ? "#ink-stage *{animation:none!important}" : "");
  document.head.appendChild(css);

  /* ---------- mount ---------- */
  var stage = document.createElement("div");
  stage.id = "ink-stage";
  stage.setAttribute("aria-hidden", "true");
  var h = '<div class="ink-paper"></div>';
  for (var i = 1; i <= CFG.wisps; i++) h += '<div class="ink-wisp w' + i + '"></div>';
  h += '<div class="ink-edge"></div>';
  stage.innerHTML = h;
  /* the stage is absolute: if its host is not a positioning context the ink
     escapes and paints down the page. Guarantee the anchor, always. */
  var hcs = getComputedStyle(hero);
  if (hcs.position === "static") hero.style.position = "relative";
  if (hcs.overflow === "visible") hero.style.overflow = "hidden";

  /* under the UI captions, above the scene: before .hero-content */
  var content = hero.querySelector(".hero-content");
  hero.insertBefore(stage, content || null);

  /* replace the old flat grain if the dolly added one */
  var oldGrain = document.getElementById("rv-grain");
  if (oldGrain) oldGrain.style.display = "none";

  /* ---------- lifecycle: pay nothing off-screen ---------- */
  try {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { stage.classList.toggle("paused", !e.isIntersecting); });
    }, { threshold: 0.01 }).observe(hero);
  } catch (e) {}
  document.addEventListener("visibilitychange", function () {
    stage.classList.toggle("paused", document.hidden);
  });
})();
