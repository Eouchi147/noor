/* NOOR film · THE PLATE, and how it moves.
   ===========================================================================
   A plate is one of the library's own figures, from web/plates.js, laid on a
   1080 by 1920 frame and given a life.

   WHY THE FILM STOPPED DRAWING ITS OWN DIAGRAMS

   The shorts used to carry figures built out of discs, rays and rings. Two
   things went wrong with that and neither was fixable by tuning it.

   An abstract mark needs a key to say what it means and a leader line to say
   which mark is being talked about. So the frame filled up with a fan of
   rays, a pointer across them, and a legend naming a colour. The owner's
   verdict: too many lines, and the legend shows a colour that is nowhere in
   the demonstration.

   And an abstract mark cannot be recognised. A gold disc is a lamp only
   because a caption says so. A drawn lamp is a lamp.

   The library's own figures have neither problem. A candle is a candle, the
   wall has a gap in it, the image on the far wall is the same candle upside
   down, and that is the whole of what Ibn al-Haytham proved, sitting in one
   picture. Every label is already written beside the thing it names. There
   are a hundred and thirty nine of them and they were drawn by hand over the
   life of the site.

   ===========================================================================
   THE THREE LAWS OF THIS FILE
   ===========================================================================

   1. THE PICTURE IS NEVER CROPPED AND NEVER SMALL.

      A figure drawn for a page is about twice as wide as it is tall; a phone
      is nine by sixteen. The first attempt answered that with a camera that
      travelled over the drawing, and it cut labels in half on four frames out
      of six, because a window the shape of a phone laid over a wide drawing
      cannot hold a line of text.

      The answer is not a camera, it is arithmetic. A 520 unit figure laid
      across 1010 of the 1080 is enlarged 1.94 times, and its 20 unit label
      lands at 39 pixels -- larger than this film's own subtitle. It does not
      need to be filmed. It needs to be PLACED, and the box it is placed in
      has to be the shape of the drawing rather than the shape of the phone.
      So the plate's box on the frame is computed from the artwork, the empty
      room goes to the words, and the whole composition is centred.

      Only a drawing too wide to enlarge past 1.20 is filmed, and then the
      window is as tall as the artwork, so it travels sideways only and no
      label is ever cut. See BOX below, which is the same arithmetic
      buildplates.py uses to size the type.

   2. NOTHING APPEARS.

      Every line draws itself along its own path, every solid grows from a
      point, every label rises as it fades up, and the whole thing is built
      in the order it was drawn, which is the order the argument runs. There
      is not one cut-in anywhere in a plate. The words underneath are timed to
      the same list, so the sentence and the stroke land together.

   3. THE EYE IS TOLD WHERE TO LOOK.

      This is what carries the storytelling now that the camera does not. When
      a line of words is about one part of the drawing, that part comes to
      full strength and lifts very slightly, and everything already drawn goes
      back to half. Nothing moves off the screen, nothing is cropped, and the
      viewer never has to hunt for what the sentence is talking about. It is
      the oldest device in explanatory film and it is the right one, because
      the whole picture stays visible the entire time -- which is the point of
      an infographic and the thing a travelling camera destroys.

   Everything hangs on the film's paused timeline at absolute milliseconds.
   Nothing here starts a clock, reads the wall, or holds state, so a frame is
   a pure function of time and the render is reproducible.
   ========================================================================= */
(function () {
  "use strict";
  var A = window.anime;
  var NS = "http://www.w3.org/2000/svg";

  /* ===================================================================
     THE SITE'S OWN MOTION, NUMBER FOR NUMBER.

     noorcodex.com already has a motion kit, assets/noor-motion.js, and every
     figure on it is played by that kit. There is no reason for the film to
     invent a second one: a short should move the way the page moves, because
     they are the same library. These are that file's values carried over
     exactly; only the engine underneath differs, GSAP there and anime.js
     here, because a film needs a paused timeline it can seek.

         .mo        rise 22 and fade,  0.65s, power3.out, 0.08 stagger
         .mo-pop    scale 0.55 to 1,   0.70s, back.out(1.9), 0.09 stagger
         .mo-draw   the stroke draws,  1.10s, power2.inOut, 0.10 stagger
         .mo-float  y -7, 2.6s sine, back and forth, for ever
     =================================================================== */
  var MO = {
    riseY: 22, riseDur: 650, riseEase: "outCubic", riseStep: 80,
    popFrom: 0.55, popDur: 700, popEase: "outBack(1.9)", popStep: 90, popAt: 100,
    drawDur: 1100, drawEase: "inOutQuad", drawStep: 100, drawAt: 150,
    floatY: 7, floatDur: 2600
  };

  /* how far back a thing goes when the sentence is about something else, and
     how far forward the thing the sentence IS about comes */
    /*  How far back a thing goes when the sentence is about something else.
      0.42 was tried first and it is too deep: at forty seconds the candle,
      the wall and both rays -- the entire argument so far -- were a ghost
      behind two labels. Everything that has been explained stays clearly
      readable; the thing being explained now is simply brighter than it. */
  var DIM = 0.60, FOCUS_DUR = 780, BLUR = true;
  /*  AND THE FOCUS DOES NOT SCALE ANYTHING.
      The first version lifted the active step to 1.045 about its own centre,
      which is a lovely gesture on a small group and a bug on a wide one. The
      candle figure's label step is a single <g> holding BOTH captions, six
      hundred and fifty units across: four and a half per cent of that is
      fifteen units pushed out each way, straight past the edge of the box,
      and the frame came back reading "a candle outside" with the a sliced
      off and "the image arrives" with the s gone. Brightness alone says
      look here, and brightness cannot push anything off the screen. */

  /* ---- THE BOX ----------------------------------------------------------
     The one piece of arithmetic that decides everything about how a plate
     reads. buildplates.py runs the same numbers to know how far to scale the
     figure's type, so if one changes the other has to.

        BOXW   the widest a plate may be laid, inside the frame's gutters
        BOXH   the tallest, which is the frame less the band of words
        SMIN   the least enlargement a drawing is allowed. Below this its
               labels stop being readable at arm's length and it is filmed
               with a travelling window instead of being placed whole.        */
  function box(vb, wide) {
    var BOXW = wide ? 1180 : 1010, BOXH = wide ? 620 : 1240;
    /* The element's box on the frame is the drawing AT REST: the size it is
       when the camera has pulled all the way back and the whole figure is on
       screen. Everything the camera does happens inside that box by moving
       the viewBox, so the picture area never changes shape and the words
       below it never move. See THE CAMERA at the foot of this file. */
    var s = Math.min(BOXW / vb[2], BOXH / vb[3]);
    return { s: s, w: vb[2], h: vb[3],
             px: Math.round(vb[2] * s), py: Math.round(vb[3] * s) };
  }
  window.NOORPLATEBOX = box;

  /* ---- reading the plate ------------------------------------------------
     A figure is a flat list of top level elements: some groups of lines, some
     single paths, some text. Each is one STEP -- the unit the choreography
     works in and the unit a brief can time. */
  var SPLIT_UNDER = 12;

  function kids(e) {
    var out = [];
    for (var i = 0; i < e.childNodes.length; i++) {
      var c = e.childNodes[i];
      if (c.nodeType !== 1) continue;
      var t = c.tagName.toLowerCase();
      if (t === "title" || t === "desc" || t === "style" || t === "defs" ||
          t === "metadata") continue;
      out.push(c);
    }
    return out;
  }

  function steps(root) {
    var out = kids(root);
    /* ---- A FIGURE WITH FOUR PIECES CANNOT CARRY NINE SENTENCES ---------
       The hospital plan is four top level elements: the whole floor plan in
       one group, all eight labels in a second, one arrow, one caption. Given
       a nine line script that is four things happening in forty four
       seconds, and the other five sentences play over a picture that does
       not change -- which is what a camera zooming in and out of a still
       drawing looks like, and it was called exactly that.

       The pieces are in there. They are one level down: seven rooms inside
       the first group, eight labels inside the second. So a sparse figure is
       opened up one level, and the same plan becomes seventeen things that
       arrive one at a time: the courtyard, then each ward branching off it,
       then each ward being named.

       Only sparse figures. A drawing that already has twelve or more top
       level pieces was drawn that way on purpose and is left alone. */
    if (out.length >= SPLIT_UNDER) return out;
    var ex = [];
    out.forEach(function (e) {
      var k = (e.tagName.toLowerCase() === "g") ? kids(e) : [];
      if (k.length >= 2) { k.forEach(function (c) { ex.push(c); }); }
      else ex.push(e);
    });
    return ex;
  }

  /* ---- HOW DOES THIS ARRIVE ---------------------------------------------
     The first cut read the class attribute: ln and rd are strokes, nd and
     flame are fills. That worked for the forty four figures on one page and
     for nothing else, because every page of the site names its own classes
     -- s1 s2 s3 on protection, fs f1 f2 hts on school -- and a figure whose
     vocabulary is not recognised has every one of its lines POPPED instead of
     drawn, which is the difference between a diagram building itself and a
     diagram flickering on.

     So nothing is read off the class any more. The browser has already
     resolved every stylesheet the figure brought with it, so the question is
     asked of the computed style, which is true for all one hundred and thirty
     nine of them and for anything drawn next year: a shape with a stroke and
     no fill is DRAWN, everything else GROWS. */
  function parts(e) {
    var strokes = [], solids = [], words = [];
    function walk(n) {
      if (n.nodeType !== 1) return;
      var tag = n.tagName.toLowerCase();
      if (tag === "style" || tag === "defs" || tag === "title" || tag === "desc") return;
      if (n.getAttribute && n.getAttribute("data-pad")) return;   // a label's own ground
      if (tag === "text") { words.push(n); return; }
      if (tag === "g" || tag === "a" || tag === "switch") {
        for (var i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i]);
        return;
      }
      if (tag === "path" || tag === "line" || tag === "polyline" ||
          tag === "rect" || tag === "circle" || tag === "ellipse" ||
          tag === "polygon") {
        var cs = window.getComputedStyle(n);
        var hasStroke = cs.stroke && cs.stroke !== "none" &&
                        parseFloat(cs.strokeWidth || 0) > 0 &&
                        parseFloat(cs.strokeOpacity || 1) > 0.02;
        var hasFill = cs.fill && cs.fill !== "none" &&
                      parseFloat(cs.fillOpacity || 1) > 0.02;
        if (hasStroke && !hasFill) strokes.push(n);
        else solids.push(n);
      }
    }
    walk(e);
    return { strokes: strokes, solids: solids, words: words };
  }

  /* is this one the light? Rays get half again the time, because a ray is the
     one place in a plate where the motion IS the argument: the eye has to
     follow it from the source to where it lands. */
  function isRay(n) {
    var c = (n.getAttribute("class") || "") + " " +
            ((n.parentNode && n.parentNode.getAttribute)
              ? (n.parentNode.getAttribute("class") || "") : "");
    return /\b(rd|ray|beam|s1)\b/.test(c);
  }
  function isFlame(n) {
    return /\b(flame|fl|lamp|spark)\b/.test(n.getAttribute("class") || "");
  }

  /* ---- the builder ------------------------------------------------------ */
  window.NOORFIG = window.NOORFIG || {};

  window.NOORFIG.plate = function (b, svg, tl, t0) {
    var src = (window.NOORPLATE || {})[b.plate];
    if (!src) { console.warn("no plate named " + b.plate); return; }

    var doc = new DOMParser().parseFromString(src, "image/svg+xml");
    var from = doc.documentElement;
    svg.setAttribute("class", "figsvg " + (from.getAttribute("class") || ""));
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");

    var vb = (from.getAttribute("viewBox") || "0 0 660 340").split(/\s+/).map(Number);
    var hold = document.createElementNS(NS, "g");
    while (from.firstChild) hold.appendChild(from.firstChild);
    svg.appendChild(hold);

    /* ---- THE BOX IS CUT TO THE DRAWING, NOT THE DRAWING TO THE BOX ------
       The plate element used to be a fixed 1010 by 1390 whatever was in it,
       so a figure half as tall as it is wide sat in a box two and a half
       times too tall and the frame was two thirds empty above the words.
       The box is now the artwork's own shape, at the enlargement the type
       needs, and the room left over goes to the composition. */
    var B = box(vb, document.documentElement.getAttribute("data-frame") !== "tall");
    svg.style.width = B.px + "px";
    svg.style.height = B.py + "px";
    var AR = B.w / B.h;

    /* ---- ONE WRAPPER PER STEP ------------------------------------------
       The focus pass writes opacity on a step and the entrance writes opacity
       on the things inside it. When a step IS a single <text> -- and a third
       of these figures have top level labels -- those are the same element
       and the second write erases the first, so a label that should still be
       waiting its turn is already on the screen. A wrapper is one node and it
       ends the whole class of collision. */
    var list = steps(hold).map(function (e) {
      var g = document.createElementNS(NS, "g");
      /* ---- AND IT CARRIES ITS INHERITANCE WITH IT ---------------------
         Opening a group up takes a <rect> out from under <g class="ln">,
         and the paint order pass then moves it somewhere else in the
         document entirely. Either move on its own would strip the stroke
         off it and leave an invisible element, so the wrapper is given
         every class and transform the child was standing under. */
      var cls = [], tr = [], n = e.parentNode;
      while (n && n !== hold && n.getAttribute) {
        var c = n.getAttribute("class"); if (c) cls.unshift(c);
        var t = n.getAttribute("transform"); if (t) tr.unshift(t);
        n = n.parentNode;
      }
      if (cls.length) g.setAttribute("class", cls.join(" "));
      if (tr.length) g.setAttribute("transform", tr.join(" "));
      e.parentNode.insertBefore(g, e);
      g.appendChild(e);
      return g;
    });
    if (!list.length) return;
    var dark = [];

    /* ===================================================================
       NOTHING OVERLAPS TEXT. NOT EVER.

       These figures were drawn for a page at one size, and at that size the
       far wall of the dark room passes a few units clear of the words beside
       it. Enlarged to fill a phone and then travelled over by a camera, "a
       few units clear" became a line straight through the middle of "the
       image arrives". It is not one bad figure either: a hundred and thirty
       eight drawings made over a year will always have a handful of these,
       and going and finding them by eye is a job that has to be done again
       every time a new one is drawn.

       So it is not fixed by hand, it is made impossible, in two moves.

       PAINT ORDER. Every step that carries a label is moved to the end of
       the document, so all type is painted after all line work. The list the
       choreography works from is NOT reordered, so the drawing is still
       built in the order it was drawn and the words underneath still land
       with their own stroke. Only the order the browser paints in changes.

       AND A GROUND OF ITS OWN. Each label is given a soft patch of the
       film's own night behind it, blurred at the edges so it is not a box,
       and painted between the drawing and the word. A line that runs at a
       label now fades out as it reaches it, which is what a technical
       drawing has always done where a leader crosses a dimension.
       =================================================================== */
    var textStep = list.map(function (w) { return !!w.querySelector("text"); });
    (function knockout() {
      var texts = [];
      hold.querySelectorAll("text").forEach(function (t) {
        var r; try { r = t.getBBox(); } catch (e) { return; }
        if (r && (r.width || r.height)) texts.push(r);
      });

      var defs = document.createElementNS(NS, "defs");
      var feather = document.createElementNS(NS, "filter");
      var fid = "noorfeather", mid = "noorknock";
      feather.setAttribute("id", fid);
      feather.setAttribute("x", "-40%"); feather.setAttribute("y", "-60%");
      feather.setAttribute("width", "180%"); feather.setAttribute("height", "220%");
      var blur = document.createElementNS(NS, "feGaussianBlur");
      blur.setAttribute("stdDeviation", Math.max(1.6, vb[2] * 0.006).toFixed(2));
      feather.appendChild(blur);
      defs.appendChild(feather);

      var mask = document.createElementNS(NS, "mask");
      mask.setAttribute("id", mid);
      mask.setAttribute("maskUnits", "userSpaceOnUse");
      mask.setAttribute("x", (vb[0] - vb[2]).toFixed(1));
      mask.setAttribute("y", (vb[1] - vb[3]).toFixed(1));
      mask.setAttribute("width", (vb[2] * 3).toFixed(1));
      mask.setAttribute("height", (vb[3] * 3).toFixed(1));
      var lit = document.createElementNS(NS, "rect");
      lit.setAttribute("x", (vb[0] - vb[2]).toFixed(1));
      lit.setAttribute("y", (vb[1] - vb[3]).toFixed(1));
      lit.setAttribute("width", (vb[2] * 3).toFixed(1));
      lit.setAttribute("height", (vb[3] * 3).toFixed(1));
      lit.setAttribute("fill", "#fff");
      mask.appendChild(lit);
      var holes = document.createElementNS(NS, "g");
      holes.setAttribute("filter", "url(#" + fid + ")");
      texts.forEach(function (r) {
        var px = Math.max(4.5, r.height * 0.26), py = Math.max(3.0, r.height * 0.16);
        var k = document.createElementNS(NS, "rect");
        k.setAttribute("x", (r.x - px).toFixed(2));
        k.setAttribute("y", (r.y - py).toFixed(2));
        k.setAttribute("width", (r.width + px * 2).toFixed(2));
        k.setAttribute("height", (r.height + py * 2).toFixed(2));
        k.setAttribute("rx", (r.height * 0.32).toFixed(2));
        k.setAttribute("fill", "#000");
        holes.appendChild(k);
      });
      mask.appendChild(holes);
      defs.appendChild(mask);
      hold.insertBefore(defs, hold.firstChild);

      /* the drawing goes inside the masked group, the type after it */
      var geom = document.createElementNS(NS, "g");
      geom.setAttribute("mask", "url(#" + mid + ")");
      hold.appendChild(geom);
      list.forEach(function (w, i) { if (!textStep[i]) geom.appendChild(w); });
      list.forEach(function (w, i) { if (textStep[i]) hold.appendChild(w); });
    })();

    /* ---- WHEN EACH STEP ARRIVES ----------------------------------------
       A brief may hand over a list of milliseconds, one per step, so the
       drawing is built exactly in step with the words. Without one they are
       spread across the span, which is never wrong and never as good. */
    var span = Math.max(1200, b.dur || 8000);
    var at = b.at && b.at.length ? b.at : null;

    list.forEach(function (g, i) {
      var when = at ? (at[Math.min(i, at.length - 1)] || 0)
                    : (span * 0.06 + (span * 0.74) * (i / Math.max(1, list.length - 1)));
      var p = parts(g);

      p.strokes.forEach(function (e, j) {
        var d;
        try { d = A.svg.createDrawable(e); } catch (err) { d = null; }
        if (!d) return;
        tl.add(d, { draw: ["0 0", "0 1"], ease: MO.drawEase,
                    duration: isRay(e) ? MO.drawDur * 1.5 : MO.drawDur },
               when + MO.drawAt + j * MO.drawStep);
      });

      /* a solid springs in. Scaling an svg child needs an origin or it flies
         in from the corner of the viewBox; fill-box puts it in the shape's
         own middle. */
      p.solids.forEach(function (e, j) {
        dark.push(e);
        e.style.transformBox = "fill-box";
        e.style.transformOrigin = "50% 50%";
        tl.add(e, { opacity: [0, 1], scale: [MO.popFrom, 1], ease: MO.popEase,
                    duration: MO.popDur },
               when + MO.popAt + j * MO.popStep);
        /* and a flame never stands still */
        if (isFlame(e)) {
          var n = Math.max(2, Math.round((span - when) / MO.floatDur));
          for (var q = 0; q < n; q++) {
            tl.add(e, { translateY: [q % 2 ? -MO.floatY : 0, q % 2 ? 0 : -MO.floatY],
                        ease: "inOutSine", duration: MO.floatDur },
                   when + MO.popAt + MO.popDur + q * MO.floatDur);
          }
        }
      });

      /* a label rises. Never on y: on an svg text y is a real attribute, and
         animating it moves the baseline to the top of the viewBox instead of
         nudging the line up. */
      p.words.forEach(function (w, j) {
        dark.push(w);
        tl.add(w, { opacity: [0, 1], translateY: [MO.riseY, 0], ease: MO.riseEase,
                    duration: MO.riseDur },
               when + 260 + j * MO.riseStep);
      });
    });

    /* ---- WHAT MUST NEVER BE CUT, AND WHAT MAY --------------------------
       The camera was taken out of this film once, because three different
       ways of moving it all ate a word. That was the wrong lesson. The rule
       is not "do not move", it is "do not cut a LABEL": a ray running off
       the edge of the frame is cinema, and half a word is a mistake.

       So every step is measured twice. Its TEXT box is what the camera is
       forbidden to cross. Its whole box is only used to decide where to
       look. A shot may crop as much line work as it likes and no letter of
       any label that has been drawn yet. */
    var tbox = list.map(function (g) {
      var b = null;
      g.querySelectorAll("text").forEach(function (t) {
        var r; try { r = t.getBBox(); } catch (e) { return; }
        if (!r || (!r.width && !r.height)) return;
        //  the label's own transform is a translate on entry, which is zero
        //  at rest, so the raw box is the right one
        if (!b) b = { x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height };
        else { b.x0 = Math.min(b.x0, r.x); b.y0 = Math.min(b.y0, r.y);
               b.x1 = Math.max(b.x1, r.x + r.width); b.y1 = Math.max(b.y1, r.y + r.height); }
      });
      return b;
    });
    var gbox = list.map(function (g) {
      var r; try { r = g.getBBox(); } catch (e) { return null; }
      return (r && (r.width || r.height))
        ? { x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height } : null;
    });

    /* ---- DEPTH ---------------------------------------------------------
       A schematic is flat and a camera moving over a flat thing looks like a
       photograph being slid about. Giving every step a depth and letting the
       near ones travel further than the far ones is what turns a pan into a
       move THROUGH something.

       Depth is read off the drawing rather than authored: the big elements
       of a figure are its structure -- the wall, the ground line, the frame
       of the thing -- and the small ones are what sits on it. Structure goes
       to the back, detail comes to the front. */
    var area = gbox.map(function (b) {
      return b ? (b.x1 - b.x0) * (b.y1 - b.y0) : 0;
    });
    var amax = Math.max.apply(null, area.concat([1]));
    var depth = area.map(function (a, i) {
      /* AND A STEP THAT CARRIES A LABEL DOES NOT TRAVEL.
         The hole that keeps the line work off a word is cut at the word's
         resting place. If the word then slid about on its own parallax it
         would walk out from under its own protection, so anything with type
         in it is pinned to the back plane and only the drawing moves. */
      if (textStep[i]) return 0;
      return a <= 0 ? 0 : (1 - Math.pow(a / amax, 0.34)) * 1.6 - 0.45;
    });

    /* AND THE RESTING STATE IS SET LAST.
       anime does not write a tween's start value until the playhead reaches
       it, so on a paused timeline an element whose entrance is at forty
       seconds sits at full strength for the first forty. Written before the
       tweens were added it was overwritten by the build; written after, it
       stands until the entrance takes it over. */
    dark.forEach(function (n) { n.style.opacity = 0; });

    /* ===================================================================
       THE THIRD LAW: THE EYE IS TOLD WHERE TO LOOK.

       One focus per line of words, never one per stroke. While a line is up,
       the steps it is about are at full strength and lifted a little off the
       page; everything else that has already been drawn falls back to
       four tenths. Nothing leaves the frame, nothing is cropped, and the
       whole picture is visible for the whole minute.

       Every tween is written from an explicit value to an explicit value, so
       seeking to any frame gives the same answer as playing to it.
       =================================================================== */
    var shots = (b.shots && b.shots.length) ? b.shots : [{ at: 0, all: true }];
    var now = list.map(function () { return 1; });

    /* ---- AND IT IS A RACK FOCUS, NOT A DIMMER --------------------------
       Turning the rest of the drawing down is half of the gesture. A lens
       does the other half: what is not being looked at goes soft. It is the
       single cheapest way to make a flat vector drawing read as a thing with
       depth, and it is why one shot in a film costs what it costs.

       The focus of each step is one number written through one object, so
       the opacity and the blur can never disagree and a seek to any frame
       gives the same answer as playing to it. */
    var F = list.map(function () { return { v: 1 }; });
    function paint(k) {
      var v = F[k].v, e = list[k];
      e.style.opacity = v;
      var soft = (1 - v) * 2.4 / Math.max(0.35, 1);
      if (BLUR) e.style.filter = v > 0.985 ? "none" : "blur(" + soft.toFixed(2) + "px)";
    }
    shots.forEach(function (sh) {
      var when = t0 + (sh.at || 0) * 1000;
      list.forEach(function (e, k) {
        var want = sh.all ? 1 : ((k >= sh.i0 && k <= sh.i1) ? 1 : DIM);
        if (want === now[k]) return;
        (function (k) {
          tl.add(F[k], { v: [now[k], want], ease: "outQuad", duration: FOCUS_DUR,
                         onUpdate: function () { paint(k); } }, Math.max(0, when));
        })(k);
        now[k] = want;
      });
    });

    /* ===================================================================
       THE CAMERA.

       A short that does not move is a slideshow, and a feed scrolls past a
       slideshow in half a second. So the camera never stops: it opens tight
       on the first thing drawn, and it is pulled steadily back across the
       whole minute as the drawing fills in, so the picture is always growing
       and the last shot is the only one that holds everything. That arc is
       not decoration. It IS the argument: you are shown a detail, then what
       it belongs to, then the whole.

       WHAT KEEPS IT SAFE. Before every move the shot is grown until it
       contains the text box of every label drawn so far, plus the room the
       parallax needs. Line work is allowed to run off the edge; a letter is
       not. That single rule is what makes it possible to move at all, and
       it is checked in code rather than by looking at frames.

       AND THE PARALLAX. Each step carries a depth taken from its own size,
       and shifts against the camera in proportion to it, so the small marks
       on the surface of the drawing travel further across the frame than the
       structure they sit on. Flat artwork, real move.

       Motion blur is not here. It is in the renderer: noor.py samples three
       times across an open shutter and averages them, which is what a
       shutter physically is, so every one of these moves arrives blurred by
       exactly as much as it is fast.
       =================================================================== */
    var AR = B.w / B.h;
    var PAD = Math.max(10, B.w * 0.020);        // breathing room round a label
    var PARK = 0.085;                            // how hard the parallax bites
    var PARMAX = B.w * 0.030;                    // and how far it may ever go
    var MINW = B.w * 0.42;                       // the tightest the camera goes

    var cam = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
    var cx0 = vb[0] + vb[2] / 2, cy0 = vb[1] + vb[3] / 2;

    function put() {
      svg.setAttribute("viewBox", cam.x.toFixed(2) + " " + cam.y.toFixed(2) + " " +
                                  cam.w.toFixed(2) + " " + cam.h.toFixed(2));
      /* the parallax rides the camera rather than being animated beside it,
         so it can never drift out of step with the move it belongs to */
      var ox = (cam.x + cam.w / 2) - cx0, oy = (cam.y + cam.h / 2) - cy0;
      var z = vb[2] / Math.max(1, cam.w);        // how far in we are
      for (var i = 0; i < list.length; i++) {
        var d = depth[i];
        if (!d) { continue; }
        var dx = -ox * PARK * d * z, dy = -oy * PARK * d * z;
        if (dx > PARMAX) dx = PARMAX; if (dx < -PARMAX) dx = -PARMAX;
        if (dy > PARMAX) dy = PARMAX; if (dy < -PARMAX) dy = -PARMAX;
        list[i].style.transform = "translate(" + dx.toFixed(2) + "px," +
                                                 dy.toFixed(2) + "px)";
      }
    }

    /* the whole drawing, with a hair of margin: where every short ends */
    function whole(pad) {
      var w = vb[2] * (pad || 1.0), h = w / AR;
      return { x: cx0 - w / 2, y: cy0 - h / 2, w: w, h: h };
    }

    /* A SHOT: look at these steps, and be big enough to hold every label
       that is already on the screen. */
    function frameFor(i0s, i1s, revealedTo, tight) {
      var look = null;
      for (var i = i0s; i <= i1s && i < list.length; i++) {
        var g = gbox[i]; if (!g) continue;
        look = look ? { x0: Math.min(look.x0, g.x0), y0: Math.min(look.y0, g.y0),
                        x1: Math.max(look.x1, g.x1), y1: Math.max(look.y1, g.y1) }
                    : { x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1 };
      }
      if (!look) look = { x0: cx0 - 1, y0: cy0 - 1, x1: cx0 + 1, y1: cy0 + 1 };

      var need = null;
      for (var j = 0; j <= revealedTo && j < list.length; j++) {
        var t = tbox[j]; if (!t) continue;
        need = need ? { x0: Math.min(need.x0, t.x0), y0: Math.min(need.y0, t.y0),
                        x1: Math.max(need.x1, t.x1), y1: Math.max(need.y1, t.y1) }
                    : { x0: t.x0, y0: t.y0, x1: t.x1, y1: t.y1 };
      }
      if (need) {
        var m = PAD + PARMAX;
        need = { x0: need.x0 - m, y0: need.y0 - m, x1: need.x1 + m, y1: need.y1 + m };
      }

      /* ---- THE SHOT HOLDS BOTH, OR IT HOLDS NOTHING WORTH SEEING -------
         The first cut sized the shot to the labels and then slid it until
         they fitted, and the thing the sentence was actually about got
         pushed out of frame: at eight seconds the camera was looking at a
         caption while the candle it named sat off the left edge. A shot
         contains the union of what it is LOOKING at and what it must not
         CUT. Whatever slack is left over after that is spent leaning toward
         the subject, which is where the emphasis comes from. */
      var pad = tight ? 1.06 : 1.26;
      var lx = (look.x1 - look.x0) * pad, ly = (look.y1 - look.y0) * pad;
      var lcx = (look.x0 + look.x1) / 2, lcy = (look.y0 + look.y1) / 2;
      var U = { x0: lcx - lx / 2, y0: lcy - ly / 2, x1: lcx + lx / 2, y1: lcy + ly / 2 };
      if (need) {
        U.x0 = Math.min(U.x0, need.x0); U.y0 = Math.min(U.y0, need.y0);
        U.x1 = Math.max(U.x1, need.x1); U.y1 = Math.max(U.y1, need.y1);
      }
      var w = Math.max(U.x1 - U.x0, (U.y1 - U.y0) * AR, tight ? MINW * 0.72 : MINW);
      w = Math.min(w, vb[2] * 1.02);
      var h = w / AR;
      var cx = (U.x0 + U.x1) / 2, cy = (U.y0 + U.y1) / 2;
      //  spend the slack leaning on the subject
      var sx = Math.max(0, (w - (U.x1 - U.x0)) / 2), sy = Math.max(0, (h - (U.y1 - U.y0)) / 2);
      cx += Math.max(-sx, Math.min(sx, (lcx - cx))) * 0.75;
      cy += Math.max(-sy, Math.min(sy, (lcy - cy))) * 0.75;
      //  and it stays over the artwork rather than sailing off it
      cx = Math.min(Math.max(cx, vb[0] + w / 2 - vb[2] * 0.08),
                    vb[0] + vb[2] - w / 2 + vb[2] * 0.08);
      cy = Math.min(Math.max(cy, vb[1] + h / 2 - vb[3] * 0.08),
                    vb[1] + vb[3] - h / 2 + vb[3] * 0.08);
      return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
    }

    /* ---- the moves ------------------------------------------------------
       ONE MOVE PER SENTENCE, AND THE MOVE NEVER ENDS.

       The first cut of this arrived at a shot and then held it, with a two
       per cent creep that was invisible. Half way through a short the
       drawing is complete, every label is on the screen, and the rule that
       no label may be cut pins the camera to the whole figure -- so the last
       twenty five seconds did not move at all, which on a feed is twenty
       five seconds of somebody else's video.

       A shot is therefore not a place, it is a PUSH. The camera arrives
       thirteen per cent wide of where the sentence wants it and closes on it
       for as long as the sentence is up. The far end of that push is the
       safe frame, so the whole push is safe, and there is a continuous
       thirteen per cent zoom running under every line of the film with the
       parallax riding on top of it.
       ------------------------------------------------------------------ */
    var OPEN = 1.13;                    //  how wide of the mark it arrives
    function grow(T, k) {
      var w = Math.min(T.w * k, vb[2] * 1.38), h = w / AR;
      return { x: T.x + T.w / 2 - w / 2, y: T.y + T.h / 2 - h / 2, w: w, h: h };
    }
    var prev = null;
    function push(T, when, dur, hold, sway) {
      var A = grow(T, OPEN);
      A.x += (sway || 0) * A.w * 0.030;
      if (!prev) { prev = A; cam.x = A.x; cam.y = A.y; cam.w = A.w; cam.h = A.h; put(); }
      tl.add(cam, { x: [prev.x, A.x], y: [prev.y, A.y], w: [prev.w, A.w], h: [prev.h, A.h],
                    ease: "inOutQuart", duration: dur, onUpdate: put }, Math.max(0, when));
      var B = { x: T.x, y: T.y, w: T.w, h: T.h };
      tl.add(cam, { x: [A.x, B.x], y: [A.y, B.y], w: [A.w, B.w], h: [A.h, B.h],
                    ease: "outSine", duration: Math.max(900, hold),
                    onUpdate: put }, Math.max(0, when) + dur);
      prev = B;
    }

    var run = 0;
    var ends = shots.map(function (sh, i) {
      return (i + 1 < shots.length ? shots[i + 1].at : span / 1000) - (sh.at || 0);
    });
    shots.forEach(function (sh, i) {
      var last = i === shots.length - 1;
      var upto = sh.all ? (i === 0 ? 0 : list.length - 1) : sh.i1;
      run = Math.max(run, upto);
      var T = (last && sh.all) ? whole(1.0)
            : frameFor(sh.all ? 0 : sh.i0, sh.all ? list.length - 1 : sh.i1,
                       run, i === 0);
      var dur = i ? 1400 : 1000;
      push(T, t0 + (sh.at || 0) * 1000 - 360, dur,
           ends[i] * 1000 - dur + 400, (i % 2) ? 1 : -1);
    });
    //  and it always finishes on the whole drawing, closing on it
    push(whole(1.0), t0 + span - 2600, 1600, 1400, 0);

    /* ---- AND WHAT THE DRAWING ACTUALLY DOES ---------------------------
       Everything above reveals a figure and moves a camera over it. That is
       delivery. The mechanism -- the light travelling, the reports pouring,
       the price falling -- is in web/behave.js, and it is the half of this
       that makes a short worth watching to the end. It is applied last so it
       sits on top of the finished drawing, and it is timed by SENTENCE, so
       rewriting a line moves its motion with it. */
    if (window.NOORMOTION) {
      window.NOORMOTION.apply(hold, b.motion, tl, t0,
                              (b.lines || []).map(function (L) { return L.at || 0; }),
                              vb, span);
    }
  };
})();
