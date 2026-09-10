/* NOOR film · the figures.
   ---------------------------------------------------------------------------
   These are not decoration around an explanation. They ARE the explanation:
   the thing moves, and the movement is the argument. A viewer who watched with
   the sound off should still come away with the idea.

   Everything here is drawn from numbers into SVG and animated with anime.js
   springs and drawables. There is no footage, no stock and no clip art in this
   film, so there is nothing in it anyone else owns. Where a picture is wanted
   rather than a diagram, `card` frames one of the library's own public-domain
   manuscript plates and says where it came from.

   Every builder takes (b, svg, tl, t0) and hangs its own tweens on the film's
   paused timeline at absolute milliseconds. None of them starts a clock.
*/
(function () {
  "use strict";
  var A = window.anime;
  var NS = "http://www.w3.org/2000/svg";

  function n(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    return e;
  }
  function txt(parent, s, attrs) {
    var t = n("text", attrs); t.textContent = s; parent.appendChild(t); return t;
  }
  /* the drawable proxy: animate {draw:['0 0','0 1']} and the line draws itself */
  function drawable(el) { return A.svg.createDrawable(el); }

  /* NEVER ANIMATE `y` ON AN SVG <text>.
     anime.js writes to an element's ATTRIBUTE when it has one of that name,
     and <text> has a real y: an animation from -26 to 0 does not nudge the
     line down, it moves its baseline to the top of the viewBox. The first cut
     of the root figure had its three letters marooned at the top of the frame
     with the stems growing out of empty space. Everything here moves on
     translateX/translateY, which are transforms and mean the same thing on
     every element in the file. */
  var F = {};

  /* ------------------------------------------------------------------ GROW
     The whole of chapter one in one picture: three letters sit on a line, and
     two stems physically grow out of the SAME three letters into two words.
     The viewer is not told the words share a root. They watch it happen. */
  F.grow = function (b, svg, tl, t0) {
    svg.setAttribute("viewBox", "0 0 1000 620");
    var seedY = 120, leftX = 230, rightX = 770;

    /* the root, as three marks on one line */
    var root = n("g", { opacity: 0 });
    var lettersG = n("g", null);
    var rl = (b.root || "").trim().split(/\s+/);
    var spread = 92;
    rl.forEach(function (ch, i) {
      var x = 500 + (i - (rl.length - 1) / 2) * spread;
      var t = txt(lettersG, ch, { x: x, y: seedY, "text-anchor": "middle",
        "font-family": "Amiri, serif", "font-size": 104, fill: "var(--goldpale)" });
      t.setAttribute("opacity", "0");
    });
    root.appendChild(lettersG);
    var bar = n("path", { d: "M" + (500 - spread * 1.5) + " " + (seedY + 42) +
      " H " + (500 + spread * 1.5), stroke: "var(--goldhi)", "stroke-width": 2.2,
      fill: "none", opacity: .5, "stroke-linecap": "round" });
    root.appendChild(bar);
    svg.appendChild(root);

    /* two stems, drawn out of the bar and up */
    function stem(x) {
      return n("path", {
        d: "M500 " + (seedY + 46) + " C 500 " + (seedY + 190) + ", " + x + " " + (seedY + 170) +
           ", " + x + " " + (seedY + 300),
        stroke: "var(--goldhi)", "stroke-width": 2.5, fill: "none",
        "stroke-linecap": "round", opacity: .7 });
    }
    var s1 = stem(leftX), s2 = stem(rightX);
    svg.appendChild(s1); svg.appendChild(s2);

    var caps = [];
    (b.grew || []).slice(0, 2).forEach(function (g, i) {
      var x = i === 0 ? leftX : rightX;
      var gg = n("g", { opacity: 0 });
      var t = txt(gg, g.ar || "", { x: x, y: seedY + 385, "text-anchor": "middle",
        "font-family": "Amiri, serif", "font-size": 78, fill: "var(--goldpale)" });
      t.setAttribute("filter", "url(#soft)");
      txt(gg, (g.say || "").toUpperCase(), { x: x, y: seedY + 437, "text-anchor": "middle",
        "font-family": "NoorMono, monospace", "font-size": 24, "letter-spacing": 4,
        fill: "rgba(255,254,247,.62)" });
      txt(gg, g.means || "", { x: x, y: seedY + 483, "text-anchor": "middle",
        "font-family": "NoorCard, sans-serif", "font-size": 28, fill: "rgba(255,254,247,.86)" });
      svg.appendChild(gg); caps.push(gg);
    });

    tl.add(root, { opacity: [0, 1], ease: "outExpo", duration: 500 }, t0);
    tl.add(lettersG.querySelectorAll("text"),
      { opacity: [0, 1], translateY: [-26, 0], ease: "spring(1, 92, 16, 0)", duration: 900,
        delay: A.stagger(150, { from: "center" }) }, t0 + 120);
    tl.add(drawable(bar), { draw: ["0.5 0.5", "0 1"], ease: "outQuint", duration: 900 }, t0 + 620);
    tl.add([drawable(s1), drawable(s2)],
      { draw: ["0 0", "0 1"], ease: "outQuart", duration: 1100, delay: A.stagger(180) }, t0 + 1200);
    caps.forEach(function (c, i) {
      tl.add(c, { opacity: [0, 1], translateY: [34, 0], ease: "spring(1, 74, 14, 0)", duration: 1200 },
             t0 + 1900 + i * 340);
    });
  };

  /* ---------------------------------------------------------------- SHELLS
     Three words that are not synonyms, drawn as what they are: an outer frame,
     an inner conviction, and a finish over both. The rings assemble from the
     outside in, each labelled as it lands, and they stay together, because the
     point of the hadith of Jibril is the SET. */
  F.shells = function (b, svg, tl, t0) {
    svg.setAttribute("viewBox", "0 0 1000 620");
    var cx = 360, cy = 310;
    var R = [220, 150, 82];
    var items = (b.items || []).slice(0, 3);
    items.forEach(function (it, i) {
      var r = R[i];
      var ring = n("circle", { cx: cx, cy: cy, r: r, fill: "none",
        stroke: i === 2 ? "var(--goldhi)" : "rgba(233,200,106,.42)",
        "stroke-width": i === 2 ? 2.5 : 1.6,
        "stroke-dasharray": i === 1 ? "9 11" : null });
      svg.appendChild(ring);

      var glow = n("circle", { cx: cx, cy: cy, r: r, fill: "rgba(233,200,106,.05)", opacity: 0 });
      svg.insertBefore(glow, ring);

      /* the label sits to the right, on its own line, with a leader */
      var ly = cy - 150 + i * 150;
      var lead = n("path", { d: "M" + (cx + r) + " " + cy + " C " + (cx + r + 90) + " " + cy +
        ", " + (cx + 240) + " " + ly + ", " + 700 + " " + ly,
        stroke: "rgba(233,200,106,.5)", "stroke-width": 1.4, fill: "none" });
      svg.appendChild(lead);

      var lab = n("g", { opacity: 0 });
      txt(lab, it.ar || "", { x: 716, y: ly - 6, "font-family": "Amiri, serif",
        "font-size": 52, fill: "var(--goldpale)" });
      txt(lab, (it.name || "").toUpperCase(), { x: 716, y: ly + 30, "font-family": "NoorMono, monospace",
        "font-size": 22, "letter-spacing": 3.5, fill: "rgba(255,254,247,.62)" });
      txt(lab, it.means || "", { x: 716, y: ly + 70, "font-family": "NoorCard, sans-serif",
        "font-size": 26, fill: "rgba(255,254,247,.86)" });
      svg.appendChild(lab);

      var at = t0 + i * 900;
      tl.add(drawable(ring), { draw: ["0.5 0.5", "0 1"], ease: "outQuart", duration: 1100 }, at);
      tl.add(glow, { opacity: [0, 1], ease: "outExpo", duration: 900 }, at + 400);
      tl.add(drawable(lead), { draw: ["0 0", "0 1"], ease: "outQuart", duration: 700 }, at + 700);
      tl.add(lab, { opacity: [0, 1], translateX: [22, 0], ease: "spring(1, 92, 16, 0)", duration: 900 }, at + 900);
    });
  };

  /* -------------------------------------------------------------- TIMELINE
     A line that draws itself with marks arriving along it in order. What it
     is for: a sequence the viewer must feel the LENGTH of -- the prophets,
     the signs of the Hour -- where the spacing is the point. */
  F.timeline = function (b, svg, tl, t0) {
    svg.setAttribute("viewBox", "0 0 1000 420");
    var y = 210, x0 = 70, x1 = 930;
    var line = n("path", { d: "M" + x0 + " " + y + " H " + x1,
      stroke: "rgba(233,200,106,.55)", "stroke-width": 2, fill: "none", "stroke-linecap": "round" });
    svg.appendChild(line);
    tl.add(drawable(line), { draw: ["0 0", "0 1"], ease: "inOutQuart", duration: 1600 }, t0);

    var marks = (b.marks || []);
    marks.forEach(function (m, i) {
      var x = x0 + (x1 - x0) * (marks.length === 1 ? .5 : i / (marks.length - 1));
      var up = i % 2 === 0;
      var g = n("g", { opacity: 0 });
      g.appendChild(n("circle", { cx: x, cy: y, r: 7, fill: "var(--night)",
        stroke: "var(--goldhi)", "stroke-width": 2 }));
      g.appendChild(n("path", { d: "M" + x + " " + (y + (up ? -12 : 12)) + " V " + (y + (up ? -46 : 46)),
        stroke: "rgba(233,200,106,.45)", "stroke-width": 1.3 }));
      txt(g, m.t || "", { x: x, y: y + (up ? -62 : 92), "text-anchor": "middle",
        "font-family": "NoorCard, sans-serif", "font-size": 27, fill: "rgba(255,254,247,.9)" });
      if (m.d) txt(g, m.d, { x: x, y: y + (up ? -94 : 124), "text-anchor": "middle",
        "font-family": "NoorMono, monospace", "font-size": 19, "letter-spacing": 2.4,
        fill: "rgba(255,254,247,.5)" });
      svg.appendChild(g);
      tl.add(g, { opacity: [0, 1], scale: [.7, 1], ease: "spring(1, 140, 18, 0)", duration: 800 },
             t0 + 700 + i * (1400 / Math.max(1, marks.length)) );
    });
  };

  /* ------------------------------------------------------------------ CARD
     Where a point wants a picture rather than a diagram. The frame is drawn,
     the plate arrives inside it, and the plate is CREDITED: these are the
     library's own public-domain manuscript pictures, and the film says so. */
  F.card = function (b, svg, tl, t0) {
    svg.setAttribute("viewBox", "0 0 1000 620");
    var w = 720, h = 420, x = (1000 - w) / 2, y = 40;
    var clip = n("clipPath", { id: "cardclip" });
    clip.appendChild(n("rect", { x: x, y: y, width: w, height: h, rx: 22 }));
    var defs = n("defs", null); defs.appendChild(clip); svg.appendChild(defs);

    var img = n("image", { href: b.src, x: x - 30, y: y - 30, width: w + 60, height: h + 60,
      preserveAspectRatio: "xMidYMid slice", "clip-path": "url(#cardclip)", opacity: 0 });
    svg.appendChild(img);
    var frame = n("rect", { x: x, y: y, width: w, height: h, rx: 22, fill: "none",
      stroke: "rgba(233,200,106,.5)", "stroke-width": 1.8 });
    svg.appendChild(frame);

    var cap = n("g", { opacity: 0 });
    txt(cap, b.caption || "", { x: 500, y: y + h + 62, "text-anchor": "middle",
      "font-family": "NoorCard, sans-serif", "font-size": 30, fill: "rgba(255,254,247,.9)" });
    if (b.credit) txt(cap, b.credit, { x: 500, y: y + h + 104, "text-anchor": "middle",
      "font-family": "NoorMono, monospace", "font-size": 19, "letter-spacing": 2.4,
      fill: "rgba(255,254,247,.45)" });
    svg.appendChild(cap);

    tl.add(drawable(frame), { draw: ["0.5 0.5", "0 1"], ease: "outQuart", duration: 1100 }, t0);
    tl.add(img, { opacity: [0, .92], scale: [1.08, 1], ease: "spring(1, 60, 15, 0)", duration: 1800 }, t0 + 320);
    /* a slow drift for the whole hold, so the picture is never a dead rectangle */
    tl.add(img, { translateX: [0, -18], translateY: [0, -10], ease: "linear", duration: 6500 }, t0 + 320);
    tl.add(cap, { opacity: [0, 1], translateY: [18, 0], ease: "spring(1, 92, 16, 0)", duration: 900 }, t0 + 1200);
  };

  /* ----------------------------------------------------------------- COUNT
     A field of marks where a few separate from the many. What a ratio looks
     like when it is shown instead of stated. */
  F.count = function (b, svg, tl, t0) {
    svg.setAttribute("viewBox", "0 0 1000 560");
    var total = b.total || 100, take = b.take || 0, cols = b.cols || 20;
    var gap = 40, r = 8, x0 = 500 - (cols - 1) * gap / 2, y0 = 90;
    var dots = [], taken = [];
    for (var i = 0; i < total; i++) {
      var cx = x0 + (i % cols) * gap, cy = y0 + Math.floor(i / cols) * gap;
      var isTake = i < take;
      var c = n("circle", { cx: cx, cy: cy, r: r, opacity: 0,
        fill: isTake ? "var(--goldhi)" : "rgba(255,254,247,.30)" });
      svg.appendChild(c); dots.push(c); if (isTake) taken.push(c);
    }
    tl.add(dots, { opacity: [0, 1], scale: [.4, 1], ease: "outQuart", duration: 520,
                   delay: A.stagger(9) }, t0);
    /* the few lift out of the many, and the many stay */
    tl.add(taken, { translateY: [0, 170], scale: [1, 1.45], ease: "spring(1, 74, 14, 0)", duration: 1400,
                    delay: A.stagger(60) }, t0 + 1500);
    if (b.label) {
      var lab = n("g", { opacity: 0 });
      txt(lab, b.label, { x: 500, y: y0 + Math.ceil(total / cols) * gap + 210, "text-anchor": "middle",
        "font-family": "NoorCard, sans-serif", "font-size": 34, fill: "rgba(255,254,247,.9)" });
      svg.appendChild(lab);
      tl.add(lab, { opacity: [0, 1], translateY: [18, 0], ease: "outExpo", duration: 800 }, t0 + 2300);
    }
  };

  window.NOORFIG = F;
})();
