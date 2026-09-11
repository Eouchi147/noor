/* NOOR film · the diagrams.
   ===========================================================================
   WHY THIS FILE EXISTS

   The first cut of this film put the argument in the words and a glowing
   shape behind them. That is a lyric video. An explainer does the opposite:
   the PICTURE carries the argument and the words are labels on it. The test
   is simple and brutal. Turn the sound off and cover the captions. If nothing
   is left, it was never an explainer.

   So the explanatory beats are drawn here, as diagrams, and they are drawn
   the way a diagram is actually read: an axis before the marks on it, a bar
   that grows to its value, a number that counts to the number, a set that
   visibly closes. Nothing appears finished. If it arrives all at once it is
   a slide.

   ---------------------------------------------------------------------------
   WHY CANVAS AND NOT GEOMETRY

   Every other figure in this film is built from three dimensional objects,
   and for an orb or a chain of transmission that is right. A diagram is not
   that. A diagram is exact: a tick has to land on its value, a label has to
   sit beside the thing it names and not through it, and the type has to be
   crisp at eleven pixels. That is what a 2D canvas is for.

   The canvas is then mapped onto a plane in the same 3D scene as everything
   else, so it takes the same camera, the same bloom, the same tone curve and
   the same grain. It is drawn fresh every frame from the beat's own clock, so
   it is still a pure function of time and two renders are still identical.

   ---------------------------------------------------------------------------
   THE RULES OF THE HOUSE, IN PICTURES

   No faces, ever, including the stick figure kind. No symbol of another
   faith. Nothing is drawn that is not generated here from numbers, so there
   is no stock, no clip art and no traced reference. Where a diagram states a
   fact it carries its source in the frame, because a diagram that cannot be
   checked is a decoration with numbers on it.
*/
(function () {
  "use strict";

  var G = {};

  /* ---- the palette, matching the light layer ---------------------------- */
  /* THE GOLD IS LIGHT, NOT METAL.
   #E9C86A is the house gold and it is right on a page. Blown up to a numeral
   a fifth of the frame high and then given a halo, it reads as bronze: there
   is more red in it than a light has. The diagrams use a lifted gold whose
   hue is the same and whose value is higher, which under the bloom comes back
   as golden light rather than as a cast object. */
  var GOLD = "#D4AE2E", GOLDHI = "#F4D46A", PALE = "#FBEFC8", WHITE = "#FFFEF7";
  var COOL = "#7FA3D8";              /* the one cool accent, for "the other" */
  var DIM  = "rgba(255,254,247,0.26)";
  var RULE = "rgba(233,200,106,0.30)";

  /* ---- easings, the same names the rest of the film uses ---------------- */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(u) { u = clamp01(u); return 1 - Math.pow(1 - u, 3); }        /* outCubic */
  function easeQ(u) { u = clamp01(u); return 1 - Math.pow(1 - u, 5); }       /* outQuint */
  function smooth(u) { u = clamp01(u); return u * u * (3 - 2 * u); }
  function seg(u, at, len) { return clamp01((u - at) / Math.max(1e-6, len)); }

  /* a seeded hash, so anything scattered scatters the same way twice */
  function hash(i, s) {
    var n = (i * 374761393 + s * 668265263) >>> 0;
    n = (n ^ (n >>> 13)) >>> 0; n = (n * 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  /* THE SAFE AREA.
     The plate is a plane very nearly the size of the frame, and the film sets
     its captions in the lower band. A diagram that uses its whole canvas
     therefore draws its axis through the sentence describing it, which is how
     the first pass came out: a hundred marks running off the top of the frame
     and a counter below the bottom of it.
     So every diagram composes inside the top three quarters and the bottom
     quarter belongs to the words. These are the only vertical numbers any of
     them should use. */
  function SAFE(H) {
    /* The caption occupies only the last fifth of the frame, and the first
       pass reserved a quarter of the canvas for it and then drew small inside
       what was left, so every diagram came out sitting in the top forty per
       cent of the picture with a lake of black beneath it. A diagram is the
       subject of its shot. It takes the room. */
    return { top: H * 0.05, mid: H * 0.38, low: H * 0.70, foot: H * 0.80,
             h: H * 0.78 };
  }

  /* ---- WHAT THE BLOOM DOES TO INK ---------------------------------------
     This canvas is not the picture. It is mapped onto a plane, ADDED to the
     scene, and then run through a bright pass that cuts at 0.57 and smears
     everything above it across four blur passes. Ink laid down at full white
     with a 26 pixel shadow under it does not come back out of that as a
     letter. It comes back as a lozenge with a ghost of a letter inside, which
     is what the Arabic on the root plate and the numeral on the hundred plate
     both were.

     So the drawing is governed once, here, rather than tuned forty times in
     seven diagrams: glow radii are set against what the bloom will add rather
     than against what looks right on a white page, and large solid type is
     laid down under the cut and allowed to pick its halo up from the bloom.
     Small type is left alone -- a thin stroke never accumulates enough to
     clip, and dimming it only makes it grey. */
  var GLOWK = 0.42;
  function inkA(size, a) { return a * ((size || 34) > 96 ? 0.50 : (size || 34) > 56 ? 0.66 : 0.90); }

  /* ---- the primitives -------------------------------------------------- */

  /* A LINE IS DRAWN, NOT REVEALED. A diagram whose axis fades up has no
     direction in it; one whose axis is drawn from its origin tells you where
     to start reading. */
  function line(c, x0, y0, x1, y1, t, col, w, glow) {
    t = clamp01(t); if (t <= 0) return;
    c.save();
    c.strokeStyle = col || RULE;
    c.lineWidth = w || 3;
    c.lineCap = "round";
    if (glow) { c.shadowColor = col || GOLD; c.shadowBlur = glow * GLOWK; }
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    c.stroke();
    c.restore();
  }

  function dot(c, x, y, r, col, a, glow) {
    if (r <= 0 || a <= 0) return;
    c.save();
    c.globalAlpha = clamp01(a === undefined ? 1 : a);
    c.fillStyle = col || GOLDHI;
    if (glow) { c.shadowColor = col || GOLDHI; c.shadowBlur = glow * GLOWK; }
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  /* an arc drawn from its start, for rings and clock faces */
  function arc(c, x, y, r, a0, a1, t, col, w, glow) {
    t = clamp01(t); if (t <= 0) return;
    c.save();
    c.strokeStyle = col || RULE; c.lineWidth = w || 3; c.lineCap = "round";
    if (glow) { c.shadowColor = col || GOLD; c.shadowBlur = glow * GLOWK; }
    c.beginPath(); c.arc(x, y, r, a0, a0 + (a1 - a0) * t); c.stroke();
    c.restore();
  }

  /* a bar that grows to its value, which is the only honest way to draw one */
  function bar(c, x, y, w, h, t, col, a) {
    t = clamp01(t); if (t <= 0) return;
    c.save();
    c.globalAlpha = clamp01(a === undefined ? 1 : a);
    c.fillStyle = col || GOLD;
    var r = Math.min(h / 2, 10);
    var ww = w * t;
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, Math.max(ww, r * 2), h, r);
    else c.rect(x, y, ww, h);
    c.fill();
    c.restore();
  }

  function text(c, s, x, y, o) {
    o = o || {};
    var a = clamp01(o.a === undefined ? 1 : o.a);
    if (a <= 0 || !s) return;
    c.save();
    c.globalAlpha = inkA(o.size, a);
    c.fillStyle = o.col || WHITE;
    c.textAlign = o.align || "center";
    c.textBaseline = o.base || "middle";
    var fam = o.fam || "'NoorCard', system-ui, sans-serif";
    c.font = (o.weight || 500) + " " + (o.size || 34) + "px " + fam;
    if (o.track) {
      /* letter-spacing by hand: canvas has none, and an eyebrow without it is
         not an eyebrow */
      var chars = String(s).split(""), tr = o.track, tot = 0, i;
      for (i = 0; i < chars.length; i++) tot += c.measureText(chars[i]).width + tr;
      tot -= tr;
      var cx = o.align === "left" ? x : o.align === "right" ? x - tot : x - tot / 2;
      c.textAlign = "left";
      for (i = 0; i < chars.length; i++) {
        c.fillText(chars[i], cx, y);
        cx += c.measureText(chars[i]).width + tr;
      }
    } else {
      if (o.glow) { c.shadowColor = o.col || GOLDHI; c.shadowBlur = o.glow * GLOWK; }
      c.fillText(String(s), x, y);
    }
    c.restore();
  }

  function label(c, s, x, y, o) {
    o = o || {};
    text(c, s, x, y, { size: o.size || 26, weight: 500, col: o.col || DIM,
                       align: o.align || "center", track: o.track === undefined ? 3 : o.track,
                       a: o.a, fam: "'NoorMono', ui-monospace, monospace" });
  }

  function arabic(c, s, x, y, o) {
    o = o || {};
    text(c, s, x, y, { size: o.size || 92, weight: 400, col: o.col || PALE,
                       align: o.align || "center", a: o.a, glow: o.glow === undefined ? 9 : o.glow * 0.36,
                       fam: "'Amiri', serif" });
  }

  /* a leader: the short line from a mark to the words that name it. This is
     the single thing that makes a picture read as a diagram rather than an
     arrangement. */
  function leader(c, x0, y0, x1, y1, t, a) {
    t = clamp01(t); if (t <= 0) return;
    c.save();
    c.globalAlpha = clamp01(a === undefined ? 1 : a);
    line(c, x0, y0, x1, y1, t, RULE, 2);
    if (t > 0.98) dot(c, x0, y0, 4, GOLD, 1);
    c.restore();
  }

  /* a number that counts to its value, because a number that is simply there
     was never measured */
  function counted(v, t, dp) {
    var x = v * easeQ(t);
    return dp ? x.toFixed(dp) : String(Math.round(x));
  }

  /* ======================================================================
     THE DIAGRAMS
     Each takes (ctx, W, H, u, tsec) where u is 0..1 across its own beat.
     ====================================================================== */

  /* ---- 1 · twenty six in every hundred ---------------------------------
     "About one person in four" is a sentence nobody feels. A hundred marks,
     twenty six of them lit one after another, is a fraction you have watched
     being counted out. */
  G.hundred = function (c, W, H, u) {
    var S = SAFE(H);
    /* A HUNDRED IS A SHAPE, AND THE SHAPE DEPENDS ON THE FRAME.
       Ten by ten is how a person counts a hundred, and in a 9:16 frame it is
       exactly right. In 16:9 it is a small square sitting in the middle of a
       wide picture with nothing either side of it, so the same hundred is laid
       out twenty across and five down, which fills the frame it is actually
       in. Same hundred, same twenty six, a different arrangement of them. */
    var wide = W > H;
    var cols = wide ? 20 : 10, rows = wide ? 5 : 10;
    var gap = wide ? Math.min(W * 0.0340, H * 0.108) : H * 0.062;
    var r = gap * 0.185;
    var gw = gap * (cols - 1), gh = gap * (rows - 1);
    var gx = (wide ? W * 0.645 : W * 0.50) - gw / 2;
    var gy = (wide ? S.mid + H * 0.02 : S.mid) - gh / 2;

    var appear = seg(u, 0.02, 0.20);
    var lit = seg(u, 0.26, 0.44);
    var nLit = 26;

    for (var i = 0; i < 100; i++) {
      var cx = gx + (i % cols) * gap, cy = gy + Math.floor(i / cols) * gap;
      var k = clamp01(appear * 130 - i);
      if (k <= 0) continue;
      dot(c, cx, cy, r * ease(k), WHITE, 0.24 * ease(k));
    }
    /* the share, counted out in a fixed order so it is the same every render */
    var order = [];
    for (var q = 0; q < 100; q++) order.push({ i: q, k: hash(q, 41) });
    order.sort(function (a, b) { return a.k - b.k; });
    for (var j = 0; j < nLit; j++) {
      var idx = order[j].i;
      var bx = gx + (idx % cols) * gap, by = gy + Math.floor(idx / cols) * gap;
      var kk = clamp01((ease(lit) * nLit) - j);
      if (kk <= 0) continue;
      dot(c, bx, by, r * (1 + 0.40 * (1 - kk)), GOLDHI, kk, 16 * kk);
    }

    /* the number, beside the marks rather than under them: below the grid is
       where the film sets its caption, and two lines of type in one place is
       one line of type too many */
    var num = seg(u, 0.26, 0.44);
    if (num > 0) {
      var nx = wide ? W * 0.145 : W / 2;
      var ny = wide ? S.mid : S.low;
      text(c, counted(26, num), nx, ny,
           { size: wide ? H * 0.235 : H * 0.095, weight: 700, col: GOLDHI,
             glow: 30, a: clamp01(num * 3) });
      label(c, "IN EVERY HUNDRED", nx, ny + (wide ? H * 0.150 : H * 0.070),
            { a: clamp01(num * 2 - 0.5), size: wide ? H * 0.023 : H * 0.020 });
    }
  };

  /* ---- 2 · the root and what grows from it ----------------------------
     Three letters, and the two words they both stand behind. The lines are
     the argument: the same three letters run down into both. */
  G.root = function (c, W, H, u) {
    var S = SAFE(H);
    /* SIX CROSSING LINES ARE A TANGLE, NOT AN ARGUMENT.
       The first pass drew a line from each of the three letters to each of the
       two words, which is six diagonals through the middle of the frame and
       reads as a cat's cradle. What the picture has to say is simpler than
       that: there is ONE root, and both words stand on it. So the three
       letters sit on a single bar, and two drops come off the bar. The bar is
       the idea. */
    var L = ["س", "ل", "م"];
    var cy = S.top + H * 0.07;
    var sp = Math.min(W * 0.125, H * 0.24);
    var lx = [W / 2 + sp, W / 2, W / 2 - sp];          /* right to left */
    for (var i = 0; i < 3; i++) {
      var k = seg(u, 0.03 + i * 0.06, 0.16);
      arabic(c, L[i], lx[i], cy, { size: Math.min(W * 0.082, H * 0.152), a: ease(k), glow: 26 });
    }
    /* the bar: one root, drawn from the middle out, so it reads as a thing
       the letters are standing on rather than a line through them */
    var by = cy + H * 0.105, half = sp * 1.58;
    var kb = ease(seg(u, 0.24, 0.18));
    line(c, W / 2, by, W / 2 - half, by, kb, GOLD, 4, 16);
    line(c, W / 2, by, W / 2 + half, by, kb, GOLD, 4, 16);
    label(c, "ONE ROOT", W / 2, by + H * 0.042, { a: ease(seg(u, 0.32, 0.14)), size: 22 });

    var wy = S.mid + H * 0.22;
    var wx = [W / 2 - half * 0.74, W / 2 + half * 0.74];
    var kd = ease(seg(u, 0.42, 0.18));
    for (var d = 0; d < 2; d++) line(c, wx[d], by, wx[d], wy - H * 0.075, kd, RULE, 2);

    var WORDS = [
      { ar: "إِسْلَام", say: "ISLAM", mean: "handing the whole self over" },
      { ar: "سَلَام",  say: "SALAM", mean: "peace" }
    ];
    for (var w = 0; w < 2; w++) {
      var kw = seg(u, 0.54 + w * 0.11, 0.20);
      if (kw <= 0) continue;
      arabic(c, WORDS[w].ar, wx[w], wy, { size: Math.min(W * 0.058, H * 0.108), a: ease(kw) });
      label(c, WORDS[w].say, wx[w], wy + H * 0.072, { a: ease(seg(u, 0.62 + w * 0.11, 0.16)), size: 27 });
      text(c, WORDS[w].mean, wx[w], wy + H * 0.120,
           { size: H * 0.030, col: "rgba(255,254,247,0.64)", a: ease(seg(u, 0.66 + w * 0.11, 0.16)) });
    }
  };

  /* ---- 3 · three words, three layers -----------------------------------
     The outward frame, the inner conviction, and the finish that lies over
     both. Drawn as what it is: two rings, and a light across them. */
  G.layers = function (c, W, H, u) {
    var S = SAFE(H), cx = W / 2, cy = H * 0.42;
    /* the radius has to leave room above it for the ring's own name, or the
       name is drawn off the top of the canvas and the outer ring loses its
       label entirely, which is what happened */
    var R1 = Math.min(W * 0.28, H * 0.48) * 0.58, R2 = R1 * 0.57;
    var k1 = seg(u, 0.04, 0.18), k2 = seg(u, 0.30, 0.18), k3 = seg(u, 0.58, 0.22);
    arc(c, cx, cy, R1, -Math.PI / 2, Math.PI * 1.5, ease(k1), GOLD, 4, 18);
    arc(c, cx, cy, R2, -Math.PI / 2, Math.PI * 1.5, ease(k2), GOLDHI, 4, 18);
    /* ihsan is not a third ring inside the other two. It is the finish on
       both, so it is drawn as a sweep of light across them. */
    if (k3 > 0) {
      c.save();
      var g = c.createLinearGradient(cx - R1, cy - R1, cx + R1, cy + R1);
      g.addColorStop(0, "rgba(244,226,174,0)");
      g.addColorStop(clamp01(ease(k3)), "rgba(244,226,174,0.55)");
      g.addColorStop(1, "rgba(244,226,174,0)");
      c.strokeStyle = g; c.lineWidth = 10; c.shadowColor = PALE; c.shadowBlur = 34;
      c.beginPath(); c.arc(cx, cy, R1, -Math.PI / 2, Math.PI * 1.5); c.stroke();
      c.beginPath(); c.arc(cx, cy, R2, -Math.PI / 2, Math.PI * 1.5); c.stroke();
      c.restore();
    }
    arabic(c, "إِسْلَام", cx, cy - R1 - H * 0.085, { size: H * 0.062, a: ease(seg(u, 0.14, 0.16)) });
    label(c, "THE OUTWARD FRAME", cx, cy - R1 - H * 0.032, { a: ease(seg(u, 0.18, 0.16)), size: 25 });
    arabic(c, "إِيمَان", cx, cy, { size: H * 0.058, a: ease(seg(u, 0.40, 0.16)) });
    label(c, "THE INNER CONVICTION", cx, cy + H * 0.052, { a: ease(seg(u, 0.44, 0.16)), size: 24 });
    /* ihsan is named beside the rings, not beneath them. Beneath them is the
       caption band, and a leader line that ends inside a sentence is not a
       label, it is a collision. */
    var ly = cy - R1 * 0.42;
    leader(c, cx + R1 * 0.72, cy - R1 * 0.72, cx + R1 * 1.12, ly - H * 0.032,
           ease(seg(u, 0.64, 0.14)));
    arabic(c, "إِحْسَان", cx + R1 * 1.18, ly, { size: H * 0.054, a: ease(seg(u, 0.68, 0.16)), align: "left" });
    label(c, "THE FINISH ON BOTH", cx + R1 * 1.18, ly + H * 0.048,
          { a: ease(seg(u, 0.72, 0.16)), size: 22, align: "left" });
  };

  /* ---- 4 · closing the set ---------------------------------------------
     The chapter says it in words: not one of a kind, the best of a set, but
     the only one. That sentence is a set diagram, and it was a caption on a
     glowing ball. Here it is drawn. A boundary with many members, one of them
     lit; then the others go out, and the boundary closes around what is left
     until there is nothing outside it to be best of. */
  G.closingSet = function (c, W, H, u) {
    var S = SAFE(H), cx = W / 2, cy = H * 0.44;
    var R = Math.min(W * 0.30, H * 0.50) * 0.60;
    var N = 9;
    var open = seg(u, 0.03, 0.16);
    var pick = seg(u, 0.22, 0.14);
    var fade = seg(u, 0.48, 0.20);
    var close = seg(u, 0.58, 0.30);
    var shut = smooth(close);

    /* the boundary, and then the boundary closing */
    var rr = R * (1 - 0.66 * shut);
    c.save();
    c.setLineDash([16, 13]);
    c.lineDashOffset = -R * 0.4 * shut;
    arc(c, cx, cy, rr, -Math.PI / 2, Math.PI * 1.5, ease(open),
        shut > 0.5 ? GOLD : RULE, 3 + 2 * shut, 8 + 22 * shut);
    c.restore();

    for (var i = 0; i < N; i++) {
      var a = (i / N) * Math.PI * 2 - Math.PI / 2;
      var d = R * 0.60;
      var x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      var here = clamp01(ease(open) * N * 1.3 - i);
      if (here <= 0) continue;
      if (i === 0) continue;
      dot(c, x, y, 19 * here, WHITE, 0.46 * here * (1 - smooth(fade)), 8);
    }
    /* the one, drawn last so it sits over the rest, and lit from the moment
       it is chosen rather than at the end */
    var a0 = -Math.PI / 2, d0 = R * 0.60;
    var ox = cx + Math.cos(a0) * d0, oy = cy + Math.sin(a0) * d0;
    var mx = cx + (ox - cx) * (1 - shut), my = cy + (oy - cy) * (1 - shut);
    var rad = 20 + 18 * ease(pick) + 16 * shut;
    dot(c, mx, my, rad * 2.1, GOLD, 0.16 * ease(pick), 40);
    dot(c, mx, my, rad, GOLDHI, clamp01(0.4 + ease(pick)), 34);

    /* the naming goes ABOVE the set. Below it is where the film sets its
       captions, and a diagram that labels itself into the caption band is a
       diagram nobody can read and a sentence nobody can read either. */
    var ly2 = cy - R - H * 0.075;
    label(c, "ONE OF A KIND, THE BEST OF A SET", cx, ly2,
          { a: ease(seg(u, 0.26, 0.14)) * (1 - smooth(seg(u, 0.50, 0.14))), size: 27 });
    label(c, "THE ONLY ONE", cx, ly2,
          { a: ease(seg(u, 0.70, 0.18)), size: 30, col: GOLDHI });
    label(c, "NOTHING OUTSIDE IT TO BE BEST OF", cx, cy + R + H * 0.070,
          { a: ease(seg(u, 0.80, 0.16)), size: 22 });
  };

  /* ---- 5 · twenty three years of speech --------------------------------
     Not a finished book let down at once, which is what most people picture,
     but speech arriving in pieces against dated events. So both are drawn:
     the block first, then the block breaks into the marks that are actually
     on the record. */
  G.years = function (c, W, H, u) {
    var S = SAFE(H), x0 = W * 0.09, x1 = W * 0.91, y = S.mid + H * 0.12;
    var block = seg(u, 0.04, 0.16);
    var brk = seg(u, 0.30, 0.26);
    var axis = seg(u, 0.34, 0.20);
    var marks = seg(u, 0.48, 0.40);

    if (block > 0 && brk < 1) {
      bar(c, x0, y - H * 0.042, x1 - x0, H * 0.084, ease(block), GOLD, 0.38 * (1 - smooth(brk)));
      label(c, "ALL AT ONCE", W / 2, y - H * 0.105,
            { a: ease(seg(u, 0.12, 0.14)) * (1 - smooth(seg(u, 0.30, 0.14))), size: 26 });
    }
    line(c, x0, y, x1, y, ease(axis), RULE, 3);
    var YEARS = 23;
    for (var i = 0; i <= YEARS; i++) {
      var t = i / YEARS, x = x0 + (x1 - x0) * t;
      var k = clamp01(ease(axis) * (YEARS + 4) - i);
      if (k <= 0) continue;
      line(c, x, y, x, y + H * 0.018, k, RULE, 2);
    }
    /* the marks: irregular on purpose, because the record is irregular */
    var n = 34;
    for (var m = 0; m < n; m++) {
      var p = hash(m, 7), h2 = H * 0.030 + hash(m, 11) * H * 0.155;
      var mx = x0 + (x1 - x0) * p;
      var kk = clamp01(ease(marks) * (n + 6) - m);
      if (kk <= 0) continue;
      line(c, mx, y, mx, y - h2 * ease(kk), 1, GOLDHI, 3, 14);
      dot(c, mx, y - h2 * ease(kk), 4.5, PALE, kk, 16);
    }
    label(c, "610", x0, y + H * 0.050, { a: ease(seg(u, 0.40, 0.14)), size: 25 });
    label(c, "632", x1, y + H * 0.050, { a: ease(seg(u, 0.44, 0.14)), size: 25 });
    label(c, "TWENTY THREE YEARS", W / 2, S.low, { a: ease(seg(u, 0.60, 0.18)), size: 25 });
  };

  /* ---- 6 · the parchment, and the year -------------------------------
     The measurement beat, and the one the whole chapter is built to reach.
     A radiocarbon range is an interval, so it is drawn as an interval, and
     the year the recitation ended is drawn as a line through it. The overlap
     is the point and it is visible without a word. */
  G.dated = function (c, W, H, u) {
    var S = SAFE(H), x0 = W * 0.09, x1 = W * 0.91, y = S.mid;
    var A = 540, B = 700;                       /* the axis, in years CE */
    var at = function (yr) { return x0 + (x1 - x0) * ((yr - A) / (B - A)); };
    var axis = seg(u, 0.03, 0.16);
    var grow = seg(u, 0.24, 0.24);
    var mark = seg(u, 0.54, 0.14);
    var over = seg(u, 0.68, 0.18);

    line(c, x0, y + H * 0.105, x1, y + H * 0.105, ease(axis), RULE, 3);
    for (var yr = 550; yr <= 700; yr += 25) {
      var k = clamp01(ease(axis) * 9 - (yr - 550) / 25);
      if (k <= 0) continue;
      line(c, at(yr), y + H * 0.105, at(yr), y + H * 0.126, k, RULE, 2);
      label(c, String(yr), at(yr), y + H * 0.165, { a: k * 0.9, size: 25, col: "rgba(255,254,247,0.55)" });
    }
    /* the parchment */
    var bx = at(568), bw = at(645) - at(568);
    bar(c, bx, y - H * 0.034, bw, H * 0.068, ease(grow), GOLD, 0.92);
    label(c, "THE PARCHMENT, 568 TO 645", bx, y - H * 0.082,
          { a: ease(seg(u, 0.34, 0.16)), size: 28, align: "left", track: 3, col: GOLDHI });
    label(c, "RADIOCARBON, 95.4% CONFIDENCE", bx, y - H * 0.148,
          { a: ease(seg(u, 0.40, 0.16)), size: 22, align: "left", track: 3,
            col: "rgba(255,254,247,0.58)" });
    /* the year the recitation ended */
    if (mark > 0) {
      line(c, at(632), y - H * 0.115, at(632), y + H * 0.126, ease(mark), COOL, 4, 16);
      label(c, "632", at(632), y + H * 0.215, { a: ease(mark), size: 26, col: COOL });
    }
    if (over > 0) {
      c.save();
      c.globalAlpha = 0.30 * ease(over);
      c.fillStyle = PALE;
      c.fillRect(bx, y - H * 0.034, at(632) - bx, H * 0.068);
      c.restore();
      label(c, "WITHIN A LIFETIME OF THE RECITATION", W / 2, S.low + H * 0.018,
            { a: ease(seg(u, 0.76, 0.16)), size: 24, col: PALE });
    }
    label(c, "MINGANA 1572A  ·  CADBURY RESEARCH LIBRARY  ·  DATED BY OXFORD", W / 2, S.foot,
          { a: ease(seg(u, 0.84, 0.14)), size: 18, col: "rgba(233,200,106,0.55)" });
  };

  /* ---- 7 · the five, as five shapes -----------------------------------
     Four of the five are quantities, and a quantity drawn is a quantity
     understood: five marks on a day, a whole month filled, one fortieth of
     what is kept, one point on a life. The fifth is a sentence, so it is
     left as one. */
  G.five = function (c, W, H, u) {
    var S = SAFE(H);
    var n = 5, sp = W / (n + 0.3), y = S.mid, r = Math.min(sp * 0.36, H * 0.150);
    var NAMES = ["SHAHADAH", "SALAH", "ZAKAH", "SAWM", "HAJJ"];
    var UNDER = ["said once, and meant", "five times a day",
                 "one fortieth of what is kept", "one month in twelve", "once in a life"];
    for (var i = 0; i < n; i++) {
      var cx = sp * (0.65 + i), k = ease(seg(u, 0.05 + i * 0.13, 0.20));
      if (k <= 0) continue;
      c.save(); c.globalAlpha = k;
      if (i === 0) {                                   /* a single struck line */
        line(c, cx - r * 0.8, y, cx + r * 0.8, y, k, GOLDHI, 5, 20);
        dot(c, cx, y, 9, PALE, k, 20);
      } else if (i === 1) {                            /* a day, with five marks */
        arc(c, cx, y, r, -Math.PI / 2, Math.PI * 1.5, k, RULE, 3);
        for (var p = 0; p < 5; p++) {
          var a = -Math.PI / 2 + (p / 5) * Math.PI * 2;
          dot(c, cx + Math.cos(a) * r, y + Math.sin(a) * r, 9,
              GOLDHI, clamp01(k * 6 - p), 18);
        }
      } else if (i === 2) {                            /* one fortieth of a bar */
        var bw = r * 1.9, bh = r * 0.5;
        c.save(); c.strokeStyle = RULE; c.lineWidth = 3;
        c.strokeRect(cx - bw / 2, y - bh / 2, bw, bh); c.restore();
        bar(c, cx - bw / 2, y - bh / 2, bw / 40, bh, k, GOLDHI, 1);
        label(c, "1/40", cx, y + bh, { a: clamp01(k * 2 - 1), size: 20, col: GOLDHI });
      } else if (i === 3) {                            /* a month, filled */
        var cols = 7, rows = 4, g2 = r * 0.42;
        var gx = cx - g2 * (cols - 1) / 2, gy = y - g2 * (rows - 1) / 2;
        for (var q = 0; q < 28; q++) {
          var kk = clamp01(k * 34 - q);
          if (kk <= 0) continue;
          dot(c, gx + (q % cols) * g2, gy + Math.floor(q / cols) * g2, 5.5, GOLDHI, kk, 10);
        }
      } else {                                         /* a life, and one point */
        line(c, cx - r, y, cx + r, y, k, RULE, 3);
        dot(c, cx - r * 0.18, y, 10, GOLDHI, clamp01(k * 2 - 1), 22);
      }
      c.restore();
      label(c, NAMES[i], cx, y + r + H * 0.072, { a: ease(seg(u, 0.09 + i * 0.13, 0.18)), size: 25 });
      text(c, UNDER[i], cx, y + r + H * 0.122,
           { size: H * 0.026, col: "rgba(255,254,247,0.58)", a: ease(seg(u, 0.12 + i * 0.13, 0.18)) });
    }
    label(c, "SAHIH MUSLIM 8A  ·  BOOK OF FAITH", W / 2, S.foot,
          { a: ease(seg(u, 0.80, 0.16)), size: 18, col: "rgba(233,200,106,0.55)" });
  };

  window.NOORDIAG = G;
})();
