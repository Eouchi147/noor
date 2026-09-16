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
   ========================================================================= */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var A = window.anime;

  /* ---- the light itself -------------------------------------------------
     A mote is not a dot. A dot travelling across a diagram reads as a bug
     crawling; the same dot with a soft halo around it reads as light, which
     is what it nearly always represents here. Two circles: a hard small core
     and a blurred larger one under it. */
  var GLOWID = 0;
  function mote(root, r, colour) {
    var g = document.createElementNS(NS, "g");
    var halo = document.createElementNS(NS, "circle");
    halo.setAttribute("r", r * 2.6);
    halo.setAttribute("fill", colour || "#F4D46A");
    halo.setAttribute("opacity", "0.20");
    halo.setAttribute("filter", "url(#noormoteblur)");
    var core = document.createElementNS(NS, "circle");
    core.setAttribute("r", r);
    core.setAttribute("fill", colour || "#FFF6D8");
    g.appendChild(halo); g.appendChild(core);
    g.setAttribute("data-fx", "1");
    g.style.opacity = 0;
    root.appendChild(g);
    return g;
  }

  function ensureDefs(root, vb) {
    if (root.querySelector("#noormoteblur")) return;
    var defs = document.createElementNS(NS, "defs");
    var f = document.createElementNS(NS, "filter");
    f.setAttribute("id", "noormoteblur");
    f.setAttribute("x", "-120%"); f.setAttribute("y", "-120%");
    f.setAttribute("width", "340%"); f.setAttribute("height", "340%");
    var b = document.createElementNS(NS, "feGaussianBlur");
    b.setAttribute("stdDeviation", Math.max(1.2, vb[2] * 0.006).toFixed(2));
    f.appendChild(b); defs.appendChild(f);
    root.appendChild(defs);
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
        c.tl.add(m, { opacity: [0, 1], duration: each * 0.16 }, t0);
        c.tl.add(m, { opacity: [1, 0], duration: each * 0.22 },
                 t0 + each * 0.82 - each * 0.22);
      }
    });
  };

  /* the path itself moves. A dashed bright copy laid exactly over the
     original and slid along it, which is what a current looks like */
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
      var dash = len / Math.max(2, c.times * 2);
      q.setAttribute("stroke-dasharray", (dash * 0.34).toFixed(2) + " " + (dash * 0.66).toFixed(2));
      q.style.opacity = 0;
      c.root.appendChild(q);
      var v = { o: 0 };
      c.tl.add(q, { opacity: [0, 0.9], duration: 420 }, c.at);
      c.tl.add(v, { o: [0, -dash * c.times], ease: "linear", duration: c.dur,
                    onUpdate: function () { q.setAttribute("stroke-dashoffset", v.o.toFixed(2)); } },
               c.at);
      c.tl.add(q, { opacity: [0.9, 0], duration: 520 }, c.at + c.dur - 520);
    });
  };

  /* many small things fall from one place to another, and most of them do
     not make it. The sieve, the filter, the loss along a chain */
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
    for (var i = 0; i < n; i++) {
      var x0 = from.x0 + r() * (from.x1 - from.x0);
      var y0 = from.y0 + r() * (from.y1 - from.y0);
      var lives = r() < keep;
      var x1 = to.x0 + r() * (to.x1 - to.x0);
      var y1 = lives ? to.y1 + (to.y1 - to.y0) * 0.55 : (to.y0 + to.y1) / 2;
      var d = document.createElementNS(NS, "circle");
      d.setAttribute("r", (c.size * (0.55 + r() * 0.5)).toFixed(2));
      d.setAttribute("fill", lives ? (c.colour || "#F4D46A") : "rgba(255,254,247,.55)");
      d.setAttribute("data-fx", "1");
      d.style.opacity = 0;
      c.root.appendChild(d);
      var when = c.at + r() * c.dur * 0.62;
      var span = c.dur * (0.30 + r() * 0.22);
      (function (d, x0, y0, x1, y1, lives) {
        var v = { u: 0 };
        c.tl.add(v, { u: [0, 1], ease: "inQuad", duration: span,
                      onUpdate: function () {
                        d.setAttribute("cx", (x0 + (x1 - x0) * v.u).toFixed(2));
                        d.setAttribute("cy", (y0 + (y1 - y0) * v.u).toFixed(2));
                      } }, when);
        c.tl.add(d, { opacity: [0, 1], duration: span * 0.18 }, when);
        c.tl.add(d, { opacity: [1, lives ? 1 : 0], duration: span * 0.34 },
                 when + span * (lives ? 0.9 : 0.55));
        if (lives) c.tl.add(d, { opacity: [1, 0], duration: 700 }, when + span + 900);
      })(d, x0, y0, x1, y1, lives);
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

  /* a shape breathes once, when the sentence gets to it */
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
     is the one piece of its motion kit a still figure cannot fake */
  DO.count = function (c) {
    c.targets.forEach(function (e, k) {
      var txt = (e.textContent || "").trim();
      var m = txt.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
      if (!m) return;
      var end = parseFloat(m[0]);
      var dp = (m[1] || "").length ? (m[1].length - 1) : 0;
      var grouped = txt.indexOf(",") >= 0;
      var pre = txt.slice(0, txt.indexOf(m[0])), post = txt.slice(txt.indexOf(m[0]) + m[0].length);
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
     the drawing rather than covering it, and it breathes rather than sitting
     still, because a light that does not move is a sticker. */
  DO.glow = function (c) {
    var b = boxOf(c.targets);
    if (!b) return;
    var cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    var r = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.5 + c.size * 2.4;
    /* and it stays well inside the frame: the plate is clipped to its box,
       so a bloom wider than the drawing has its soft edge cut off and stops
       being a bloom and starts being a lighter rectangle */
    var cap = Math.min(c.vb[2], c.vb[3]) * 0.16;
    if (r > cap) r = cap;
    var id = "noorglow" + (GLOWID++);
    var defs = document.createElementNS(NS, "defs");
    var rg = document.createElementNS(NS, "radialGradient");
    rg.setAttribute("id", id);
    [["0%", c.colour || "#FFF3C8", "0.85"], ["38%", c.colour || "#F4D46A", "0.42"],
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
    g.setAttribute("r", (r * 3.1).toFixed(2));
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
    c.root.insertBefore(g, c.root.firstChild);
    var hold = Math.max(2600, c.dur);
    c.tl.add(g, { opacity: [0, 0.62], scale: [0.55, 1.0], ease: "outQuad",
                  duration: 900 }, c.at);
    c.tl.add(g, { opacity: [0.62, 0.34], duration: 1400 }, c.at + 900);
    var n = Math.max(2, Math.round((c.span - (c.at)) / 3400));
    for (var q = 0; q < n; q++) {
      c.tl.add(g, { scale: [q % 2 ? 1.10 : 1.0, q % 2 ? 1.0 : 1.10],
                    opacity: [q % 2 ? 0.42 : 0.28, q % 2 ? 0.28 : 0.42],
                    ease: "inOutSine", duration: 3400 }, c.at + 2300 + q * 3400);
    }
  };

  /* something goes round something else */
  DO.orbit = function (c) {
    var b = boxOf(c.targets);
    if (!b) return;
    var cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    var rad = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.62;
    var m = mote(c.root, c.size, c.colour);
    var v = { a: 0 };
    c.tl.add(m, { opacity: [0, 1], duration: 400 }, c.at);
    c.tl.add(v, { a: [0, Math.PI * 2 * (c.times || 2)], ease: "linear", duration: c.dur,
                  onUpdate: function () {
                    m.setAttribute("transform", "translate(" +
                      (cx + Math.cos(v.a - Math.PI / 2) * rad).toFixed(2) + "," +
                      (cy + Math.sin(v.a - Math.PI / 2) * rad).toFixed(2) + ")");
                  } }, c.at);
    c.tl.add(m, { opacity: [1, 0], duration: 500 }, c.at + c.dur - 500);
  };

  /* =====================================================================
     APPLYING A BRIEF'S MOTION LIST
     ===================================================================== */
  window.NOORMOTION = {
    apply: function (root, list, tl, t0, lineTimes, vb, span) {
      if (!list || !list.length) return;
      ensureDefs(root, vb);
      var unit = Math.max(1.2, vb[2] * 0.010);      // a mote, in the figure's own units
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
             seed: 7 + i * 31, span: span || 40000, vb: vb });
      });
    }
  };
})();
