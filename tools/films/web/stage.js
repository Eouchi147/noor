/* NOOR film · the stage.
   ---------------------------------------------------------------------------
   A chapter is a list of BEATS. A beat is one idea, held on screen long enough
   to be understood and gone before the next one arrives. Each beat is a full
   layer; only one is ever lit.

   Two rules the whole file obeys:

   1 · THE TIMELINE NEVER PLAYS. It is built paused and seeked to an exact
       millisecond for every frame, then screenshotted. Nothing here uses
       requestAnimationFrame or Date.now, and the ground is drawn from the same
       millisecond, so the film is a pure function of time and two renders of
       it are identical.

   2 · THE SCENE NEVER NAMES A PIXEL. The wide frame and the tall frame are two
       CSS compositions of the same DOM, chosen by one attribute on <html>.
       Motion is transforms and opacity, which are the same in both.

   Motion: things ARRIVE on a spring and LEAVE on an outExpo. A spring is what
   a real object does when it is put down; an ease-out is what a thing does
   when it is taken away. Nothing snaps, nothing bounces for fun, and nothing
   moves that has no reason to.
*/
(function () {
  "use strict";
  var A = window.anime;
  var hold = document.getElementById("hold");

  /* ---- the springs, named once so the film has one physics ------------- */
  var SP = {
    settle: A.createSpring({ stiffness: 92, damping: 16, mass: 1 }),   /* type arriving */
    lift:   A.createSpring({ stiffness: 74, damping: 14, mass: 1.1 }), /* a figure rising */
    snap:   A.createSpring({ stiffness: 140, damping: 18, mass: .9 }), /* a small mark */
    open:   A.createSpring({ stiffness: 60, damping: 15, mass: 1.3 })  /* something wide */
  };
  var OUT = "outExpo";

  /* ---- small helpers --------------------------------------------------- */
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  /* one span per word, so a sentence can arrive a word at a time and still
     wrap like a sentence */
  function words(node, text) {
    var parts = String(text).split(/(\s+)/);
    for (var i = 0; i < parts.length; i++) {
      if (/^\s+$/.test(parts[i])) { node.appendChild(document.createTextNode(parts[i])); continue; }
      node.appendChild(el("span", "tok", parts[i]));
    }
    return node.querySelectorAll(".tok");
  }
  /* ARABIC IS NEVER SPLIT BELOW A WORD.
     The first cut animated a verse letter by letter, and a letter of Arabic
     in a span of its own is a letter that cannot see its neighbours: the
     shaper gives every one of them its isolated form and the word comes apart
     on the screen. It looked like an effect. It was a mangled ayah. So text
     is only ever split at spaces, which is a boundary Arabic joining does not
     cross, and a word arrives whole or not at all. */
  function letters(node, text) { return words(node, text); }
  function layer() {
    var d = el("div", "beat");
    d.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;" +
      "align-items:center;justify-content:center;gap:inherit;opacity:0";
    return d;
  }

  /* ---- the beats ------------------------------------------------------- *
     Every builder gets (beat, node, tl, t0) and returns nothing. It hangs its
     own tweens on the timeline at absolute positions measured from t0, in ms.
     Every beat is faded up by the caller and faded out by the caller, so a
     builder only ever describes what happens INSIDE its own time.           */
  var KIND = {};

  /* an opening line: an eyebrow, a headline, a line under it */
  KIND.title = function (b, node, tl, t0) {
    var wrap = el("div", "words");
    if (b.eyebrow) wrap.appendChild(el("p", "eyebrow", b.eyebrow));
    var h = el("h1", "h1"); wrap.appendChild(h);
    if (b.sub) wrap.appendChild(el("p", "body", ""));
    node.appendChild(wrap);
    var toks = words(h, b.text || "");
    if (b.eyebrow) {
      tl.add(wrap.querySelector(".eyebrow"),
        { opacity: [0, 1], letterSpacing: [".55em", null], ease: OUT, duration: 900 }, t0);
    }
    tl.add(toks, { opacity: [0, 1], y: [46, 0], ease: SP.settle, duration: 1100,
                   delay: A.stagger(70) }, t0 + 140);
    if (b.sub) {
      var s = wrap.querySelector(".body");
      var st = words(s, b.sub);
      tl.add(st, { opacity: [0, 1], y: [22, 0], ease: SP.settle, duration: 900,
                   delay: A.stagger(28) }, t0 + 620);
    }
  };

  /* a sentence, set large, arriving a word at a time */
  KIND.statement = function (b, node, tl, t0) {
    var wrap = el("div", "words");
    var p = el("p", b.size === "big" ? "h2" : "body");
    wrap.appendChild(p); node.appendChild(wrap);
    var toks = words(p, b.text || "");
    tl.add(toks, { opacity: [0, 1], y: [30, 0], filter: ["blur(7px)", "blur(0px)"],
                   ease: SP.settle, duration: 1000, delay: A.stagger(46) }, t0);
    if (b.src) {
      var s = el("p", "src", b.src); wrap.appendChild(s);
      tl.add(s, { opacity: [0, .96], y: [14, 0], ease: OUT, duration: 700 }, t0 + 700);
    }
  };

  /* THE ROOT.
     Three letters, which are the whole idea of the chapter: the same root
     gives the word for surrender and the word for peace. So the letters land
     first, alone; then the two words grow out of them, each with what it
     means underneath. */
  KIND.root = function (b, node, tl, t0) {
    var fig = el("div", "fig");
    var box = el("div"); box.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:.35em";
    var rootLine = el("p", "ar ar-xl"); rootLine.style.letterSpacing = ".18em";
    box.appendChild(rootLine); fig.appendChild(box); node.appendChild(fig);
    var lt = words(rootLine, b.root || "");

    tl.add(lt, { opacity: [0, 1], scale: [.72, 1], y: [34, 0],
                 ease: SP.snap, duration: 900, delay: A.stagger(110, { from: "center" }) }, t0);
    /* they open out, and stay open: the point is that they are shared */
    tl.add(rootLine, { letterSpacing: [".18em", ".46em"], ease: SP.open, duration: 1400 }, t0 + 900);

    var pair = el("div");
    pair.style.cssText = "display:flex;gap:2.2em;align-items:flex-start;justify-content:center;flex-wrap:wrap";
    var wrap = el("div", "words"); wrap.appendChild(pair); node.appendChild(wrap);
    (b.grew || []).forEach(function (g, i) {
      var col = el("div");
      col.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:.28em;opacity:0";
      var w = el("p", "ar ar-lg"); w.textContent = g.ar;
      col.appendChild(w);
      col.appendChild(el("p", "gloss", g.say || ""));
      col.appendChild(el("p", "body sm", g.means || ""));
      pair.appendChild(col);
      tl.add(col, { opacity: [0, 1], y: [56, 0], ease: SP.lift, duration: 1200 },
             t0 + 1500 + i * 520);
    });
  };

  /* a verse: the Uthmani line, what it says, and where it is */
  KIND.quote = function (b, node, tl, t0) {
    var wrap = el("div", "words");
    var ar = el("p", "quran"); wrap.appendChild(ar);
    var en = el("p", "body"); wrap.appendChild(en);
    var src = el("p", "src", b.src || ""); wrap.appendChild(src);
    node.appendChild(wrap);
    var lt = words(ar, b.ar || "");
    tl.add(lt, { opacity: [0, 1], y: [26, 0], filter: ["blur(9px)", "blur(0px)"],
                 ease: SP.settle, duration: 1300, delay: A.stagger(150, { from: "last" }) }, t0);
    var et = words(en, b.en || "");
    tl.add(et, { opacity: [0, 1], y: [22, 0], ease: SP.settle, duration: 900,
                 delay: A.stagger(34) }, t0 + 900);
    tl.add(src, { opacity: [0, .95], ease: OUT, duration: 700 }, t0 + 1600);
  };

  /* three things that are not the same thing: islam, iman, ihsan.
     They arrive in order and stay together, because the point is the set. */
  KIND.three = function (b, node, tl, t0) {
    var wrap = el("div", "words");
    var row = el("div");
    row.style.cssText = "display:flex;gap:1.6em;align-items:stretch;justify-content:center;flex-wrap:wrap";
    wrap.appendChild(row); node.appendChild(wrap);
    (b.items || []).forEach(function (it, i) {
      var card = el("div");
      card.style.cssText = "flex:1 1 0;min-width:8em;display:flex;flex-direction:column;align-items:center;" +
        "gap:.3em;padding:1.1em .9em;border:1px solid var(--line);border-radius:22px;" +
        "background:rgba(233,200,106,.045);opacity:0";
      var a = el("p", "ar ar-md"); a.textContent = it.ar || "";
      card.appendChild(a);
      card.appendChild(el("p", "gloss", it.name || ""));
      var d = el("p", "body sm"); d.textContent = it.means || "";
      card.appendChild(d);
      row.appendChild(card);
      tl.add(card, { opacity: [0, 1], y: [64, 0], scale: [.94, 1], ease: SP.lift, duration: 1250 },
             t0 + i * 460);
    });
  };

  /* THE FIGURE BEAT.
     Most of a film is this: a drawing that explains itself. web/figures.js
     holds the vocabulary; this puts one on the stage, gives it the frame's
     own proportions, and lets it hang its tweens on the film's timeline. A
     figure may carry one line of words under it, and no more: if a picture
     needs a paragraph to be understood it is the wrong picture. */
  KIND.figure = function (b, node, tl, t0) {
    var fig = el("div", "fig");
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("width", "100%");
    /* one soft filter, declared once per figure, for anything that wants to
       sit in its own light */
    var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = '<filter id="soft" x="-40%" y="-40%" width="180%" height="180%">' +
      '<feGaussianBlur stdDeviation="9" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
    svg.appendChild(defs);
    fig.appendChild(svg); node.appendChild(fig);

    var draw = (window.NOORFIG || {})[b.figure];
    if (draw) draw(b, svg, tl, t0);

    if (b.say) {
      var wrap = el("div", "words");
      var p = el("p", "body"); wrap.appendChild(p);
      if (b.src) wrap.appendChild(el("p", "src", b.src));
      node.appendChild(wrap);
      var toks = words(p, b.say);
      tl.add(toks, { opacity: [0, 1], y: [22, 0], ease: SP.settle, duration: 900,
                     delay: A.stagger(38) }, t0 + (b.sayAt != null ? b.sayAt * 1000 : 1.6) * (b.sayAt != null ? 1 : 1000));
      if (b.src) tl.add(wrap.querySelector(".src"), { opacity: [0, .95], ease: OUT, duration: 700 },
                        t0 + 2400);
    }
  };

  /* ---- the camera ------------------------------------------------------
     Every beat is shot, not just displayed. A move is named in the scene
     description and means the same thing in both frame shapes, because it is
     a transform on two planes rather than a crop:

       push     the camera walks in over the whole beat. The default, and the
                one that makes a still picture feel like it is being looked at.
       pull     it walks out: for a beat that ends by showing you the size of
                the thing you were just inside.
       in       a fast arrival, on a spring, then still. For a beat that lands.
       drift    almost nothing: a slow lateral, for a beat that is being read.
       hold     nothing at all. Kept, because a film with no still shot in it
                is exhausting, and the eye needs somewhere to rest.

     The ground answers each move at PARALLAX of its rate. That fraction is
     the whole of the depth: at 0.34 the world behind moves a third as far as
     the thing in front, which is what a real lens does to a far wall. */
  var PARALLAX = 0.34;
  var MOVE = {
    push:  { s: [1.00, 1.16],  x: [0, 0],    y: [0, -26], ease: "linear" },
    pull:  { s: [1.22, 1.00],  x: [0, 0],    y: [-18, 0], ease: "outQuint" },
    "in":  { s: [0.84, 1.00],  x: [0, 0],    y: [40, 0],  ease: SP.open },
    drift: { s: [1.06, 1.12],  x: [-44, 44], y: [0, 0],   ease: "linear" },
    hold:  null
  };

  function shoot(name, tl, at, dur) {
    var m = MOVE[name === undefined ? "push" : name];
    if (!m) return;
    var st = document.getElementById("stage"), gr = document.getElementById("ground");
    tl.add(st, { scale: m.s, translateX: m.x, translateY: m.y, ease: m.ease, duration: dur }, at);
    /* the ground takes the same move, reduced: that is the depth */
    var f = function (a) { return [1 + (a[0] - 1) * PARALLAX, 1 + (a[1] - 1) * PARALLAX]; };
    var g = function (a) { return [a[0] * PARALLAX, a[1] * PARALLAX]; };
    tl.add(gr, { scale: f(m.s), translateX: g(m.x), translateY: g(m.y),
                 ease: m.ease, duration: dur }, at);
  }

  /* ---- building a chapter --------------------------------------------- */
  var TL = null, DUR = 0;

  function build(chapter, frame) {
    document.documentElement.setAttribute("data-frame", frame);
    hold.innerHTML = "";
    TL = A.createTimeline({ autoplay: false, defaults: { ease: OUT } });
    var t = 0;
    var FADE_IN = 520, FADE_OUT = 620;

    (chapter.beats || []).forEach(function (b) {
      var node = layer();
      hold.appendChild(node);
      var hold_ms = Math.max(1200, Math.round((b.hold || 4) * 1000));
      TL.add(node, { opacity: [0, 1], ease: OUT, duration: FADE_IN }, t);
      (KIND[b.kind] || KIND.statement)(b, node, TL, t + 120);
      /* the shot runs the length of the beat AND its outgoing fade, so the
         camera is still moving as the beat leaves. A move that stops before
         the picture does is a move you notice. */
      shoot(b.shot, TL, t, hold_ms + FADE_OUT);
      TL.add(node, { opacity: [1, 0], y: [0, -34], ease: OUT, duration: FADE_OUT }, t + hold_ms);
      t += hold_ms + Math.round((b.gap != null ? b.gap : .45) * 1000);
    });

    DUR = t;
    TL.pause();
    return { duration: DUR, beats: (chapter.beats || []).length };
  }

  function seek(ms) {
    if (window.NOORGROUND) NOORGROUND.draw(ms);
    if (TL) TL.seek(Math.max(0, Math.min(DUR, ms)));
  }

  window.NOORFILM = {
    build: build, seek: seek,
    get duration() { return DUR; },
    kinds: Object.keys(KIND)
  };
})();
