/* NOOR film · WHAT THE DRAWING DOES.
   ===========================================================================
   THE THING THAT WAS MISSING, NAMED PLAINLY.

   Up to here a short was a static diagram that drew itself on, dimmed the
   parts it was not talking about, and had a camera pushed over it. Every
   figure got the same treatment, so every short moved the same way, and on
   the sparse figures the verdict was exact: it is literally zoom in and out
   without anything changing on screen except text.

   Drawing a diagram on is not animation. It is a reveal. The thing that
   separates an explainer somebody watches to the end from a slideshow is
   that THE MECHANISM ITSELF MOVES: light travels from the candle, through
   the hole, and lands on the far wall; six hundred thousand reports pour
   into the sieve and eleven come out; a price is not a drawn curve, it is a
   dot falling and climbing back. The motion IS the argument. Everything
   else is delivery.

   Hand animating a hundred and thirty seven figures is not possible, and it
   is not necessary, because those mechanisms are not a hundred and thirty
   seven different things. They are about eight, and every one of them can be
   driven from the figure's own geometry:

       travel   something runs along a path, from one end to the other
       flow     the path itself moves, like a current in a pipe
       pour     many small things fall from here to there, and most stop
       trace    a head rides a line as the line is drawn
       sweep    travel, on several paths at once, out from a centre
       pulse    a shape breathes once, when the sentence reaches it
       count    a printed number counts up to itself
       orbit    something goes round and round something else

   A brief names one of those, points it at part of its plate with an
   ordinary CSS selector, and says which sentence it belongs under. No
   figure is edited and no motion is hand keyed.

   Everything hangs on the film's paused timeline at absolute milliseconds
   and every tween is written from an explicit value to an explicit value,
   so a frame is a pure function of time and the render is reproducible.
   ===========================================================================
   ROUND NINE: THE LIGHT HAD A HARD EDGE.
   The owner watching the rendered sieve and the dark room: it should be
   smooth, gradual, fade and blur, never bleeding onto what sits near it.
   Three separate faults, all in this file, all fixed the same way below.

   ONE. A glow's own radius answered only to the frame (never wider than a
   sixth of the shorter side) and never to the small thing it was lighting.
   On the pinhole -- a five unit circle -- that produced a bloom two hundred
   units across, bright enough (opacity 0.62 at its own core, stacked on a
   gradient already near white) to erase the contrast of a gold ray crossing
   through it, which read as the ray stopping dead in mid-air rather than
   arriving at the light. The radius is now also capped at 1.8 times the lit
   element's own bounding size, and the peak opacity is a shared budget of
   0.55 divided across however many glows a brief points at the same target,
   not a flat number that only happened to look right once.

   TWO. A mote's halo -- the soft circle under a travelling light's hard
   core -- was a FLAT fill at a flat opacity, blurred by an SVG filter whose
   region (the box the blur is allowed to spread into) was only twenty per
   cent wider than the shape itself. A Gaussian blur's own falloff reaches
   past that in either direction, so the filter clipped it: a halo that
   should fade to nothing instead stopped at a straight edge, which is a
   softer-looking hard edge and still a hard edge. Every blurred halo now
   sits inside a region at minus a hundred and fifty per cent on every side,
   four hundred per cent wide and tall, wide enough that nothing a sane
   stdDeviation produces can ever reach its wall; the blur itself scales with
   the halo it is blurring rather than a single number borrowed from the
   plate's own width.

   THREE. A halo that fell inside the flat-disc fault above ALSO had no
   falloff of its own to fall back on: a pour's hundred and ten reports were
   plain circles, one flat colour at one flat opacity, a coin with a ruled
   edge rather than a mote of light. Every halo this file draws is now a
   radial gradient, full colour at the centre fading through a mid stop to
   fully transparent at the rim -- never a flat disc, whatever the filter
   around it is doing.

   AND WHERE THEY SIT. A halo used to be the last thing appended to the
   plate's own root, which paints it on TOP of every stroke already drawn --
   the light was washing the line art it was meant to be lighting rather
   than sitting behind it. Every halo this file creates is now inserted
   before the plate's own first child, so a line always draws over the
   light and never the other way round.
   ========================================================================= */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var A = window.anime;

  /* ---- SHARED LIGHT PLUMBING --------------------------------------------
     Three small, cached helpers used by every behaviour below that draws a
     halo. Cached on the root itself (not module scope) so two plates built
     in the same page never share defs, and so a fresh build starts clean. */

  /* a line always draws over the light: every halo goes in BEFORE root's
     own first child, whatever that child currently is (the knockout mask's
     defs, the masked line-work group, an already-inserted halo), so it
     paints first and everything the plate itself drew stays on top of it. */
  function insertUnder(root, el) {
    root.insertBefore(el, root.firstChild);
    return el;
  }

  /* a real radial falloff, cached per colour and per peak so a hundred
     particles of the same colour share one gradient rather than minting a
     hundred. Three stops always: full colour at the centre, a mid stop, and
     the rim at zero alpha -- never a flat disc. */
  function radialHalo(root, colour, peak) {
    root.__noorGrad = root.__noorGrad || {};
    var key = (colour || "#F4D46A") + "|" + peak.toFixed(2);
    var have = root.__noorGrad[key];
    if (have) return "url(#" + have + ")";
    var id = "noorhalo" + Object.keys(root.__noorGrad).length + "-" + (root.__noorGradN = (root.__noorGradN || 0) + 1);
    var defs = document.createElementNS(NS, "defs");
    var rg = document.createElementNS(NS, "radialGradient");
    rg.setAttribute("id", id);
    [["0%", peak], ["50%", peak * 0.45], ["100%", 0]].forEach(function (st) {
      var s = document.createElementNS(NS, "stop");
      s.setAttribute("offset", st[0]);
      s.setAttribute("stop-color", colour || "#F4D46A");
      s.setAttribute("stop-opacity", st[1].toFixed(3));
      rg.appendChild(s);
    });
    defs.appendChild(rg);
    root.appendChild(defs);
    root.__noorGrad[key] = id;
    return "url(#" + id + ")";
  }

  /* THE FILTER REGION, WIDE ENOUGH THAT A GAUSSIAN NEVER MEETS ITS WALL.
     x/y at -150%, width/height at 400%: whatever the blurred element's own
     box is, the filter has one and a half of that box spare on every side.
     filterUnits is objectBoundingBox stated outright rather than left to the
     spec's own default, so the region is never in doubt. stdDeviation is
     passed in by the caller, computed from the halo's OWN radius -- a wide
     halo gets a wide blur and a small one a small blur, not one figure
     borrowed from the plate's width for everything. Cached per rounded
     stdDeviation so nearby sizes share a filter instead of each minting
     one. */
  function blurFilter(root, stdev) {
    root.__noorBlur = root.__noorBlur || {};
    var key = Math.round(stdev * 10);
    var have = root.__noorBlur[key];
    if (have) return "url(#" + have + ")";
    var id = "noorblur" + key + "-" + (root.__noorBlurN = (root.__noorBlurN || 0) + 1);
    var f = document.createElementNS(NS, "filter");
    f.setAttribute("id", id);
    f.setAttribute("filterUnits", "objectBoundingBox");
    f.setAttribute("x", "-150%"); f.setAttribute("y", "-150%");
    f.setAttribute("width", "400%"); f.setAttribute("height", "400%");
    var b = document.createElementNS(NS, "feGaussianBlur");
    b.setAttribute("stdDeviation", Math.max(0.6, stdev).toFixed(2));
    f.appendChild(b);
    root.appendChild(f);
    root.__noorBlur[key] = id;
    return "url(#" + id + ")";
  }

  /* ---- the light itself -------------------------------------------------
     A mote is not a dot. A dot travelling across a diagram reads as a bug
     crawling; the same dot with a soft halo around it reads as light, which
     is what it nearly always represents here. Two circles: a hard small core
     and a blurred larger one under it, the halo now a real radial gradient
     (never a flat disc) and blurred with a region wide enough to hold its
     own falloff (never a hard rectangle), inserted under whatever the plate
     has already drawn so a line always wins. */
  function mote(root, r, colour) {
    var g = document.createElementNS(NS, "g");
    var halo = document.createElementNS(NS, "circle");
    var hr = r * 2.6;
    halo.setAttribute("r", hr.toFixed(2));
    halo.setAttribute("fill", radialHalo(root, colour || "#F4D46A", 0.5));
    halo.setAttribute("filter", blurFilter(root, hr * 0.28));
    var core = document.createElementNS(NS, "circle");
    core.setAttribute("r", r);
    core.setAttribute("fill", colour || "#FFF6D8");
    g.appendChild(halo); g.appendChild(core);
    g.setAttribute("data-fx", "1");
    g.style.opacity = 0;
    insertUnder(root, g);
    return g;
  }

  function pick(root, sel) {
    if (!sel) return [];
    var out = [];
    try {
      root.querySelectorAll(sel).forEach(function (e) {
        /* NEVER SELECT THIS FILE'S OWN WORK.
           A mote is a <circle>, and a pour is a hundred of them. The glow on
           the hospital asked for "circle", measured the courtyard AND every
           mote already travelling the corridors, and came out a bloom the
           size of the whole plate -- which, clipped to the plate's box, is a
           pale rectangle. Generated elements carry a mark and are invisible
           to every selector. */
        if (e.getAttribute("data-fx")) return;
        if (e.closest && e.closest("[data-fx]")) return;
        out.push(e);
      });
    } catch (err) { return []; }
    return out;
  }

  function boxOf(els) {
    var b = null;
    els.forEach(function (e) {
      var r; try { r = e.getBBox(); } catch (err) { return; }
      if (!r || (!r.width && !r.height)) return;
      if (!b) b = { x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height };
      else { b.x0 = Math.min(b.x0, r.x); b.y0 = Math.min(b.y0, r.y);
             b.x1 = Math.max(b.x1, r.x + r.width); b.y1 = Math.max(b.y1, r.y + r.height); }
    });
    return b;
  }

  /* a deterministic little random, so two renders of the same frame agree */
  function rng(seed) {
    var s = seed || 1;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  /* every fade in this file is a tween on opacity, eased inOutSine, and
     never shorter than this: a fade under it is not a fade, it is a step
     with a name. */
  var FADE_MIN = 400;
  function fadeDur(d) { return Math.max(FADE_MIN, d); }

  /* =====================================================================
     THE BEHAVIOURS
     ===================================================================== */
  var DO = {};

  /* something runs the length of a path, and is brightest in the middle of
     the run, so it arrives and departs rather than switching on and off */
  DO.travel = function (c) {
    var paths = c.targets.filter(function (e) { return e.getTotalLength; });
    if (!paths.length) return;
    var each = c.dur / Math.max(1, c.times);
    paths.forEach(function (p, k) {
      var len = 0;
      try { len = p.getTotalLength(); } catch (e) { return; }
      if (!len) return;
      var m = mote(c.root, c.size, c.colour);
      for (var q = 0; q < c.times; q++) {
        var t0 = c.at + q * each + k * (c.stagger || 0);
        var v = { d: 0 };
        c.tl.add(v, { d: [0, len], ease: c.ease || "inOutSine",
                      duration: each * 0.82,
                      onUpdate: function () {
                        var pt = p.getPointAtLength(v.d);
                        m.setAttribute("transform", "translate(" + pt.x.toFixed(2) +
                                                    "," + pt.y.toFixed(2) + ")");
                      } }, t0);
        var fin = fadeDur(each * 0.16), fout = fadeDur(each * 0.22);
        c.tl.add(m, { opacity: [0, 1], ease: "inOutSine", duration: fin }, t0);
        c.tl.add(m, { opacity: [1, 0], ease: "inOutSine", duration: fout },
                 t0 + each * 0.82 - fout);
      }
    });
  };

  /* the path itself moves. A dashed bright copy laid exactly over the
     original and slid along it, which is what a current looks like, now
     softened by the same blur every other halo carries so the current
     reads as light on the line rather than a second, brighter line drawn
     over the first. */
  DO.flow = function (c) {
    c.targets.forEach(function (p, k) {
      var len = 0;
      try { len = p.getTotalLength(); } catch (e) { return; }
      if (!len) return;
      var q = p.cloneNode(false);
      q.removeAttribute("class");
      q.setAttribute("data-fx", "1");
      q.setAttribute("fill", "none");
      q.setAttribute("stroke", c.colour || "#F4D46A");
      q.setAttribute("stroke-width", (c.size * 0.9).toFixed(2));
      q.setAttribute("stroke-linecap", "round");
      q.setAttribute("filter", blurFilter(c.root, c.size * 0.24));
      var dash = len / Math.max(2, c.times * 2);
      q.setAttribute("stroke-dasharray", (dash * 0.34).toFixed(2) + " " + (dash * 0.66).toFixed(2));
      q.style.opacity = 0;
      insertUnder(c.root, q);
      var v = { o: 0 };
      c.tl.add(q, { opacity: [0, 0.9], ease: "inOutSine", duration: fadeDur(420) }, c.at);
      c.tl.add(v, { o: [0, -dash * c.times], ease: "linear", duration: c.dur,
                    onUpdate: function () { q.setAttribute("stroke-dashoffset", v.o.toFixed(2)); } },
               c.at);
      c.tl.add(q, { opacity: [0.9, 0], ease: "inOutSine", duration: fadeDur(520) }, c.at + c.dur - fadeDur(520));
    });
  };

  /* many small things fall from one place to another, and most of them do
     not make it. The sieve, the filter, the loss along a chain. Each one is
     a real radial falloff now, not a flat disc with a ruled edge. */
  DO.pour = function (c) {
    var from = boxOf(c.targets) || { x0: 0, y0: 0, x1: 1, y1: 1 };
    var to = boxOf(pick(c.root, c.into)) || from;
    /* things fall INTO a thing, so they start above it and usually outside
       the drawing altogether. Without this they appear to pour out of the
       caption they were measured from, which reads as words leaking. */
    if (c.rise) {
      var hh = (from.y1 - from.y0) || 10;
      from = { x0: from.x0, x1: from.x1,
               y0: from.y0 - hh * c.rise, y1: from.y1 - hh * c.rise * 0.55 };
    }
    var r = rng(c.seed || 7);
    var n = c.count || 26;
    var keep = c.keep == null ? 0.18 : c.keep;
    var liveFill = radialHalo(c.root, c.colour || "#F4D46A", 0.92);
    var loseFill = radialHalo(c.root, "rgba(255,254,247,.7)", 0.8);
    for (var i = 0; i < n; i++) {
      var x0 = from.x0 + r() * (from.x1 - from.x0);
      var y0 = from.y0 + r() * (from.y1 - from.y0);
      var lives = r() < keep;
      var x1 = to.x0 + r() * (to.x1 - to.x0);
      var y1 = lives ? to.y1 + (to.y1 - to.y0) * 0.55 : (to.y0 + to.y1) / 2;
      var rad = c.size * (0.55 + r() * 0.5);
      var d = document.createElementNS(NS, "circle");
      d.setAttribute("r", (rad * 1.8).toFixed(2));
      d.setAttribute("fill", lives ? liveFill : loseFill);
      d.setAttribute("data-fx", "1");
      d.style.opacity = 0;
      insertUnder(c.root, d);
      var when = c.at + r() * c.dur * 0.62;
      var span = c.dur * (0.30 + r() * 0.22);
      (function (d, x0, y0, x1, y1, lives, span) {
        var v = { u: 0 };
        c.tl.add(v, { u: [0, 1], ease: "inQuad", duration: span,
                      onUpdate: function () {
                        d.setAttribute("cx", (x0 + (x1 - x0) * v.u).toFixed(2));
                        d.setAttribute("cy", (y0 + (y1 - y0) * v.u).toFixed(2));
                      } }, when);
        var fin = fadeDur(span * 0.18), fout = fadeDur(span * 0.34);
        c.tl.add(d, { opacity: [0, 1], ease: "inOutSine", duration: fin }, when);
        c.tl.add(d, { opacity: [1, lives ? 1 : 0], ease: "inOutSine", duration: fout },
                 when + Math.max(fin, span * (lives ? 0.9 : 0.55)));
        if (lives) c.tl.add(d, { opacity: [1, 0], ease: "inOutSine", duration: fadeDur(700) }, when + span + 900);
      })(d, x0, y0, x1, y1, lives, span);
    }
  };

  /* a head that rides a line while the line is being drawn. Charts */
  DO.trace = function (c) {
    c.size = c.size || 5;
    c.times = 1;
    DO.travel(c);
  };

  /* travel, on every path at once, out from the middle. Networks, spokes,
     anything that radiates */
  DO.sweep = function (c) {
    c.stagger = c.stagger == null ? c.dur * 0.06 : c.stagger;
    DO.travel(c);
  };

  /* a shape breathes once, when the sentence gets to it. No halo of its own
     -- it scales the thing the plate already drew rather than laying
     anything new over it -- so none of the fixes above apply here; left
     exactly as it was. */
  DO.pulse = function (c) {
    c.targets.forEach(function (e, k) {
      e.style.transformBox = "fill-box";
      e.style.transformOrigin = "50% 50%";
      var t0 = c.at + k * (c.stagger || 140);
      c.tl.add(e, { scale: [1, 1.14], ease: "outQuad", duration: c.dur * 0.32 }, t0);
      c.tl.add(e, { scale: [1.14, 1], ease: "outElastic(1, .6)",
                    duration: c.dur * 0.68 }, t0 + c.dur * 0.32);
    });
  };

  /* a printed number counts up to itself. The site's own .mo-count, which
     is the one piece of its motion kit a still figure cannot fake.

     THE COMMA BUG. pre/post used to be sliced out of the ORIGINAL text
     (still carrying its commas) at the position of a match taken from the
     comma STRIPPED text, so the two never lined up: "7,275" matched "7275"
     at an index "7,275" does not contain, indexOf came back -1, and pre/post
     landed one character short and one character long. The count then
     printed "7,277,27575". Matching and slicing now both happen on the same
     comma free string, so the position always lines up. */
  DO.count = function (c) {
    c.targets.forEach(function (e, k) {
      var txt = (e.textContent || "").trim();
      var grouped = txt.indexOf(",") >= 0;
      var plain = txt.replace(/,/g, "");
      var m = plain.match(/-?\d+(\.\d+)?/);
      if (!m) return;
      var end = parseFloat(m[0]);
      var dp = (m[1] || "").length ? (m[1].length - 1) : 0;
      var pre = plain.slice(0, plain.indexOf(m[0])), post = plain.slice(plain.indexOf(m[0]) + m[0].length);
      var v = { n: 0 };
      c.tl.add(v, { n: [0, end], ease: "outQuart", duration: c.dur,
                    onUpdate: function () {
                      var s = v.n.toFixed(dp);
                      if (grouped) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                      e.textContent = pre + s + post;
                    } }, c.at + k * (c.stagger || 0));
    });
  };

  /* ---- LIGHT ON THE ONE THING THAT MATTERS -----------------------------
     Used once per short, never twice. A short has exactly one element that
     IS the point -- the hole in the wall, the zero, the neck of the sieve,
     the arc across the globe -- and a soft bloom sitting on it does in half
     a second what a sentence takes four to do. Screen blended, so it lifts
     the drawing rather than covering it.

     THE DURATION BUG. `for` never reached the glow at all: a dead `hold`
     variable was computed and then ignored, and the breathing loop below it
     was timed off `c.span`, the WHOLE FILM'S length, not `c.dur`, the
     duration this glow was actually given. A two second glow on an early
     sentence kept pulsing every 3.4 s all the way to the credits. Honouring
     `for` means three plain tweens and nothing driven by the film's own
     length: fade in over the first third of `for`, hold at that level for
     the middle third, fade out over the last third, then stop.

     THE HARD EDGE (round nine). The radius answered only to the frame, so a
     five unit pinhole got a two hundred unit bloom, and the peak opacity was
     a flat 0.62 whatever else was lighting the same spot. Now: capped at 1.8
     times the lit element's own bounding size as well as the old frame
     safety, and the peak is a shared budget of 0.55 divided by however many
     glows in this brief point at the same target, so two glows on one
     element never together read brighter than one glow was ever meant to. */
  var GLOWID = 0;
  DO.glow = function (c) {
    var b = boxOf(c.targets);
    if (!b) return;
    var cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    var bboxSize = Math.max(b.x1 - b.x0, b.y1 - b.y0) || (c.size * 2);
    var r = bboxSize * 0.5 + c.size * 2.4;
    /* and it stays well inside the frame: the plate is clipped to its box,
       so a bloom wider than the drawing has its soft edge cut off and stops
       being a bloom and starts being a lighter rectangle */
    var frameCap = Math.min(c.vb[2], c.vb[3]) * 0.16;
    if (r > frameCap) r = frameCap;
    var drawn = r * 3.1;
    /* and it stays close to the thing it is lighting: never wider than 1.8
       times that thing's own bounding size, so a bloom on a five unit
       pinhole cannot grow into a bloom the width of the candle beside it. */
    var elementCap = bboxSize * 1.8;
    if (drawn > elementCap) drawn = elementCap;
    var id = "noorglow" + (GLOWID++);
    var defs = document.createElementNS(NS, "defs");
    var rg = document.createElementNS(NS, "radialGradient");
    rg.setAttribute("id", id);
    [["0%", c.colour || "#FFF3C8", "1"], ["38%", c.colour || "#F4D46A", "0.55"],
     ["100%", c.colour || "#C9A227", "0"]].forEach(function (st) {
      var s2 = document.createElementNS(NS, "stop");
      s2.setAttribute("offset", st[0]);
      s2.setAttribute("stop-color", st[1]);
      s2.setAttribute("stop-opacity", st[2]);
      rg.appendChild(s2);
    });
    defs.appendChild(rg); c.root.appendChild(defs);
    var g = document.createElementNS(NS, "circle");
    g.setAttribute("cx", cx.toFixed(2)); g.setAttribute("cy", cy.toFixed(2));
    g.setAttribute("r", drawn.toFixed(2));
    g.setAttribute("fill", "url(#" + id + ")");
    g.setAttribute("data-fx", "1");
    /* NOT screen blended. A blend mode forces the element into its own
       composited layer, and inside a group that already carries a mask and a
       focus blur Chromium draws the edge of that layer: every glow came out
       sitting in a faintly lighter RECTANGLE. A gold radial on a night ground
       reads as light without any blending at all. */
    g.style.transformBox = "fill-box";
    g.style.transformOrigin = "50% 50%";
    g.style.opacity = 0;
    insertUnder(c.root, g);
    var peak = (c.peak != null ? c.peak : 0.55);
    var third = c.dur / 3;
    var edge = fadeDur(third);
    c.tl.add(g, { opacity: [0, peak], scale: [0.55, 1.0], ease: "inOutSine",
                  duration: edge }, c.at);
    c.tl.add(g, { opacity: [peak, peak], scale: [1.0, 1.0], duration: third }, c.at + edge);
    c.tl.add(g, { opacity: [peak, 0], scale: [1.0, 0.92], ease: "inOutSine",
                  duration: edge }, c.at + edge + third);
  };

  /* something goes round something else */
  DO.orbit = function (c) {
    var b = boxOf(c.targets);
    if (!b) return;
    var cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    var rad = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.62;
    var m = mote(c.root, c.size, c.colour);
    var v = { a: 0 };
    c.tl.add(m, { opacity: [0, 1], ease: "inOutSine", duration: fadeDur(400) }, c.at);
    c.tl.add(v, { a: [0, Math.PI * 2 * (c.times || 2)], ease: "linear", duration: c.dur,
                  onUpdate: function () {
                    m.setAttribute("transform", "translate(" +
                      (cx + Math.cos(v.a - Math.PI / 2) * rad).toFixed(2) + "," +
                      (cy + Math.sin(v.a - Math.PI / 2) * rad).toFixed(2) + ")");
                  } }, c.at);
    c.tl.add(m, { opacity: [1, 0], ease: "inOutSine", duration: fadeDur(500) }, c.at + c.dur - fadeDur(500));
  };

  /* =====================================================================
     APPLYING A BRIEF'S MOTION LIST
     ===================================================================== */
  window.NOORMOTION = {
    apply: function (root, list, tl, t0, lineTimes, vb, span) {
      if (!list || !list.length) return;
      var unit = Math.max(1.2, vb[2] * 0.010);      // a mote, in the figure's own units
      /* THE 0.55 BUDGET IS SHARED, NOT PER GLOW.
         "Used once per short, never twice" is the rule DO.glow was written
         under, and almost every brief keeps it -- but the cap has to hold
         even when one does not, so every glow's peak opacity is 0.55
         divided by however many other glows in THIS list point at the same
         selector, counted once here rather than trusted to each call. */
      var glowShares = {};
      list.forEach(function (spec) {
        if (spec["do"] !== "glow") return;
        glowShares[spec.on] = (glowShares[spec.on] || 0) + 1;
      });
      list.forEach(function (spec, i) {
        var fn = DO[spec["do"]];
        if (!fn) { console.warn("no behaviour " + spec["do"]); return; }
        var targets = pick(root, spec.on);
        if (!targets.length) {
          console.warn("MOTION MISS " + spec["do"] + " on " + spec.on);
          return;
        }
        /* `at` is a SENTENCE, not a second, so retiming the words retimes
           the motion with them and the two can never drift apart. */
        var when = (spec.at != null && spec.at < 100 && lineTimes && lineTimes.length)
                   ? (lineTimes[Math.min(spec.at, lineTimes.length - 1)] || 0) * 1000
                   : (spec.sec || 0) * 1000;
        fn({ root: root, targets: targets, tl: tl,
             at: t0 + when + (spec.delay || 0) * 1000,
             dur: (spec["for"] || 3.0) * 1000,
             times: spec.times || 1,
             size: (spec.size || 1) * unit,
             colour: spec.colour, ease: spec.ease,
             stagger: spec.stagger != null ? spec.stagger * 1000 : null,
             into: spec.into, count: spec.count, keep: spec.keep, rise: spec.rise,
             peak: spec["do"] === "glow" ? (0.55 / glowShares[spec.on]) : null,
             seed: 7 + i * 31, span: span || 40000, vb: vb });
      });
    }
  };
})();
