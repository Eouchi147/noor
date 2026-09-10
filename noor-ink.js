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
    mobile:  { size: 256, wisps: 1, grainOp: .034, edgeOp: .70, wispOp: .14, dpr: 1 },
    tablet:  { size: 384, wisps: 2, grainOp: .034, edgeOp: .74, wispOp: .13, dpr: 1.25 },
    /* desktop screens are wide: the same wisp count reads as fog, not ink.
       Fewer, fainter wisps keep the scene legible on 1280 to 2560 glass. */
    desktop: { size: 512, wisps: 2, grainOp: .030, edgeOp: .68, wispOp: .10, dpr: Math.min(devicePixelRatio || 1, 1.5) }
  }[TIER];
  /* short laptop windows: the smoke sits right on the art. Thin it further. */
  if (TIER !== "mobile" && innerHeight < 820) { CFG.wispOp *= .8; CFG.edgeOp *= .88; }
  if (SOFT) { CFG.wisps = Math.max(1, CFG.wisps - 1); CFG.grainOp *= .85; CFG.edgeOp *= .7; CFG.wispOp *= .65; }
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
    /* the third octave was 17 cells across the tile -- thirty-pixel blobs, the
       exact frequency the eye reads as dirt rather than atmosphere. A wisp is
       light falling through smoke: low frequency, or nothing. */
    var c = fractal(size, [[5, .5], [9, .3]]);
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
  /* Grain, at one device pixel.

     This was "paper fiber": a fractal of 256- and 128-cell octaves smoothed up
     to a 512 tile, laid down at background-size:512px. Do that arithmetic on a
     retina screen and one grain cell is four device pixels across -- so what
     landed on the Prophets hero was not grain, it was a field of soft grey
     blobs the size of a full stop, and against a near-black gradient that
     reads exactly like a badly compressed JPEG. September 2026: "the
     background is so ugly and pixelated".

     Grain has one correct size and it is one device pixel. Anything larger is
     a cloud. So the tile is generated in device pixels and laid down divided
     by the ratio, so a canvas pixel and a screen pixel are the same thing, at
     any zoom, on any display.

     It is white at a random alpha, laid down normally at about three percent.
     The two blend modes that suggest themselves are both wrong against a
     near-black ground: overlay is violent there (a top of 154 on a base of 20
     lands at 69, a jump you can see), and soft-light lifts blacks, because its
     lighten branch runs through a square root and the square root of a very
     small number is not small -- it took the hero from luminance 16 to 43.
     Plain alpha does neither. It raises the whole field by the same three or
     four levels, which on #14100A nobody can see, and varies each pixel by the
     same amount, which is exactly the dither a seventeen-step gradient needs
     to stop banding. Uniform lift is invisible; uneven quantisation is not. */
  function grainTile(px) {
    var c = document.createElement("canvas");
    c.width = c.height = px;
    var x = c.getContext("2d");
    var img = x.createImageData(px, px);
    for (var i = 0; i < img.data.length; i += 4) {
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.random() * 255;
    }
    x.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  }
  /* The edge is a vignette, and a vignette is a gradient.

     It used to be a 512-square canvas of fractal ink with a hole carved out of
     it, laid down at background-size:100% 100%. A hero is about 1800 by 500,
     so that square was stretched three and a half times wider than tall: every
     blotch that made it "hand-inked" became a smear, and the smears were the
     largest ugly thing on the page. A radial-gradient does the same job at the
     element's real aspect ratio, with no texture to distort, in no bytes, and
     it cannot band because the grain above it dithers it. */
  var EDGE = "radial-gradient(ellipse 62% 66% at 50% 46%," +
             "transparent 0%,transparent 62%,rgba(4,6,15,.55) 84%,rgba(4,6,15,.92) 100%)";

  var S = CFG.size;
  /* the grain is measured in device pixels and laid down divided by the ratio,
     so one canvas pixel is one screen pixel. */
  var DPR = Math.max(1, Math.min(devicePixelRatio || 1, 3));
  var GP = 150;
  var smokeURL = smokeTile(S), grainURL = grainTile(GP);

  /* ---------- css ---------- */
  var css = document.createElement("style");
  css.id = "ink-css";
  css.textContent =
  "#ink-stage{position:absolute;inset:0;z-index:6;pointer-events:none;overflow:hidden}" +
  ".ink-paper{position:absolute;inset:0;background-image:url(" + grainURL + ");background-size:" + (GP / DPR).toFixed(3) + "px;opacity:" + CFG.grainOp + "}" +
  ".ink-edge{position:absolute;inset:0;background-image:" + EDGE + ";opacity:" + CFG.edgeOp + ";transform-origin:50% 46%}" +
  ".ink-wisp{position:absolute;width:170%;height:170%;left:-35%;background-image:url(" + smokeURL + ");background-size:" + Math.round(S * 1.6) + "px;background-repeat:repeat;mix-blend-mode:soft-light;opacity:calc(" + CFG.wispOp + " * (1 - var(--dp,0) * .85));-webkit-mask-image:radial-gradient(70% 60% at 50% 50%,#000 55%,transparent 100%);mask-image:radial-gradient(70% 60% at 50% 50%,#000 55%,transparent 100%)}" +
  ".ink-wisp.w1{top:-42%;animation:inkdrift1 120s linear infinite}" +
  ".ink-wisp.w2{top:-16%;animation:inkdrift2 170s linear infinite;transform:rotate(180deg)}" +
  ".ink-wisp.w3{top:6%;animation:inkdrift3 210s linear infinite}" +
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
