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
  /* The beat's own box used to be written as an inline style, which meant no
     stylesheet could ever move it: the rule that lifts the words clear of a
     figure in the light layer lost to it silently, and a sentence went on
     landing across the middle of the thing it was describing. It is a class
     now, declared in film.html, where the two frame shapes are declared too. */
  /* A BEAT HAS TWO PLACES FOR WORDS AND NO OTHERS.
     `.sky` is the picture: the figure lives behind it and the Qur'anic line is
     set in it, because a verse is the subject of its beat rather than a
     caption on one. `.words` is the subtitle band at the foot of the frame,
     which is where every other word in this film goes, at the same size and
     in the same place every time. Anything that wants to be somewhere else is
     a legend, and legends are drawn on the diagram in web/diagrams.js. */
  function layer() {
    var n = el("div", "beat");
    n.appendChild(el("div", "sky"));
    n.appendChild(el("div", "words"));
    return n;
  }
  function sky(n) { return n.querySelector(".sky"); }
  function band(n) { return n.querySelector(".words"); }

  /* ---- the beats ------------------------------------------------------- *
     Every builder gets (beat, node, tl, t0) and returns nothing. It hangs its
     own tweens on the timeline at absolute positions measured from t0, in ms.
     Every beat is faded up by the caller and faded out by the caller, so a
     builder only ever describes what happens INSIDE its own time.           */
  /* THE STYLESHEET'S OWN TRACKING, so the tweens can land on it.
     These read the frame off the document rather than closing over it,
     because the KIND builders are module scope and `frame` is an argument
     to build(). See film.html .eyebrow / .gloss. */
  function eyeLS()   { return document.documentElement.getAttribute("data-frame")
                              === "tall" ? ".30em" : ".34em"; }
  function glossLS() { return document.documentElement.getAttribute("data-frame")
                              === "tall" ? ".18em" : ".2em"; }

  var KIND = {};

  /* an opening line: an eyebrow, a headline, a line under it */
  KIND.title = function (b, node, tl, t0) {
    var wrap = band(node);
    /* IF THE LANTERN IS SAYING IT, THE BAND DOES NOT ALSO SAY IT.
       A headline set twice, once in the room and once on the glass, is the
       thing that made the first cut read as a slideshow with captions. When
       the beat has a pane, the eyebrow and the headline are painted into the
       pane by the light layer and this builder has only the line underneath
       to place, which is a subtitle like every other subtitle. */
    if (b._pane) {
      if (b.sub) {
        var sp = el("p", "body", ""); wrap.appendChild(sp);
        tl.add(words(sp, b.sub), { opacity: [0, 1], y: [22, 0], ease: SP.settle,
                                   duration: 900, delay: A.stagger(28) }, t0 + 1100);
      }
      return;
    }
    if (b.eyebrow) wrap.appendChild(el("p", "eyebrow", b.eyebrow));
    /* THE HOOK IS SET AT HOOK SIZE, and only the hook. A short opens on a
       claim rather than a title, and that claim is the only thing standing
       between the film and a thumb that is already moving. Everything after
       it is a headline. See the .hook rule in film.html for the arithmetic. */
    var h = el("h1", b.size === "hook" ? "hook" : "h1"); wrap.appendChild(h);
    if (b.sub) wrap.appendChild(el("p", "body", ""));
    var toks = words(h, b.text || "");
    if (b.eyebrow) {
      tl.add(wrap.querySelector(".eyebrow"),
        /* NOT null. anime v4 resolves a null "to" as 0, so this opened the
           eyebrow from .55em and then closed it to NO tracking at all, and
           held it there for the rest of the beat. The DOM eyebrows and the
           pane eyebrows, which lume.js draws itself, therefore disagreed
           inside the same film. The stylesheet value is named instead. */
        { opacity: [0, 1], letterSpacing: [".55em", eyeLS()], ease: OUT,
          duration: 900 }, t0);
    }
    tl.add(toks, { opacity: [0, 1], y: [46, 0], ease: SP.settle, duration: 1100,
                   delay: A.stagger(70) }, t0 + 140);
    if (b.sub) {
      var s = wrap.querySelector(".body");
      var st = words(s, b.sub);
      tl.add(st, { opacity: [0, 1], y: [22, 0], ease: SP.settle, duration: 900,
                   delay: A.stagger(28) }, t0 + 620);
    }
    /* THE SOURCE HAS NEVER HAD A LINE HERE (round four defect). Every other
       KIND that can carry a citation sets it as a ".src" footnote under the
       rest of the text; a title never gained the same three lines, so a
       title beat with a src (only the closing beat of the darkroom scene,
       so far) silently dropped it even once the pane stopped eating the
       headline. Same class, same footnote timing as KIND.statement's own
       below. */
    if (b.src) {
      var sr = el("p", "src", b.src); wrap.appendChild(sr);
      tl.add(sr, { opacity: [0, .96], y: [14, 0], ease: OUT, duration: 700 }, t0 + 1300);
    }
  };

  /* a sentence, set large, arriving a word at a time */
  KIND.statement = function (b, node, tl, t0) {
    var wrap = band(node);
    if (b._pane) {
      /* the sentence is on the Lantern's glass; only its source stays down
         here, because a source is a footnote and never a caption */
      if (b.src) {
        var sq = el("p", "src", b.src); wrap.appendChild(sq);
        tl.add(sq, { opacity: [0, .96], y: [14, 0], ease: OUT, duration: 700 }, t0 + 900);
      }
      return;
    }
    var p = el("p", b.size === "big" ? "h2" : "body");
    wrap.appendChild(p);
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
    node = sky(node) || node;
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
    var wrap = band(node.closest ? node.closest(".beat") : node) || node;
    wrap.appendChild(pair);
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
    /* THE VERSE IS THE PICTURE, THE TRANSLATION IS THE SUBTITLE.
       The Uthmani line is not a caption on something else; for the length of
       its beat it IS the thing being looked at. So it is set in the picture
       area at the size it deserves, and what it says in English goes into the
       band underneath it exactly like every other line in the film. */
    var wrap = band(node);
    var ar = el("p", "quran"); sky(node).appendChild(ar);
    var en = el("p", "body"); wrap.appendChild(en);
    var src = el("p", "src", b.src || ""); wrap.appendChild(src);
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
    var wrap = band(node);
    var row = el("div");
    row.style.cssText = "display:flex;gap:1.6em;align-items:stretch;justify-content:center;flex-wrap:wrap";
    wrap.appendChild(row);
    (b.items || []).forEach(function (it, i) {
      var card = el("div");
      /* A PANEL, NOT A CHIP.
         The first three sat in the bottom of the frame as small dark
         rectangles with a hairline round them: the three words the whole
         chapter turns on, drawn like form fields. They are the figure of
         this beat, so they take the room -- a lit sheet, a rule that can be
         seen, and the Arabic at the size the Arabic deserves. */
      card.style.cssText = "flex:1 1 0;min-width:8em;display:flex;flex-direction:column;align-items:center;" +
        "gap:.42em;padding:1.5em 1.0em 1.35em;border:1px solid rgba(233,200,106,.42);" +
        "border-radius:26px;box-shadow:0 0 60px rgba(233,200,106,.07) inset;" +
        "background:linear-gradient(158deg,rgba(233,200,106,.115),rgba(10,16,36,.30) 62%);" +
        "opacity:0";
      var a = el("p", "ar ar-lg"); a.textContent = it.ar || "";
      card.appendChild(a);
      card.appendChild(el("p", "gloss", it.name || ""));
      var d = el("p", "body sm"); d.textContent = it.means || "";
      card.appendChild(d);
      row.appendChild(card);
      /* they arrive one after another, far enough apart that the eye reads
         them as three answers in order rather than one row appearing */
      tl.add(card, { opacity: [0, 1], y: [78, 0], scale: [.92, 1], ease: SP.lift, duration: 1350 },
             t0 + i * 900);
    });
  };

  /* A LIST OF THINGS THAT BELONG TOGETHER.
     Three fits across a frame as three panels; five does not -- at a fifth of
     the width each the Arabic comes out at the size of a caption and the
     whole point of showing it is lost. Five is a LIST: one per line, the
     Arabic on one side, what it is on the other, a rule between them, landing
     one after another. It is the shape a reader already knows for "here are
     the items", and it is the only shape that lets the fifth item be as
     legible as the first. */
  KIND.list = function (b, node, tl, t0) {
    var wrap = band(node);
    if (b.head) {
      var hh = el("p", "gloss", b.head);
      wrap.appendChild(hh);
      tl.add(hh, { opacity: [0, .92], letterSpacing: [".42em", glossLS()], ease: OUT,
                   duration: 900 }, t0);
    }
    var box = el("div", "listbox");
    wrap.appendChild(box);
    (b.items || []).forEach(function (it, i) {
      var row = el("div", "listrow");
      var ar = el("p", "ar ar-md"); ar.textContent = it.ar || "";
      var mid = el("div", "listmid");
      mid.appendChild(el("p", "gloss", it.name || ""));
      mid.appendChild(el("p", "body sm", it.means || ""));
      row.appendChild(mid); row.appendChild(ar);
      box.appendChild(row);
      tl.add(row, { opacity: [0, 1], x: [-38, 0], ease: SP.lift, duration: 1050 },
             t0 + 420 + i * 620);
    });
    if (b.src) {
      var sr = el("p", "src", b.src); wrap.appendChild(sr);
      tl.add(sr, { opacity: [0, .95], ease: OUT, duration: 800 },
             t0 + 420 + (b.items || []).length * 620);
    }
  };

  /* ===================================================================
     THE PLATE BEAT, which is the whole of a silent short.

     A short used to be nine or ten beats, each one cutting to the next, with
     an abstract figure running underneath on its own clock and callout labels
     pointing into it. That format produced the two faults the owner sent
     back: a frame with too many lines in it, and a legend naming a colour
     the drawing did not contain.

     This is one beat. One of the library's own figures fills the picture
     area and BUILDS across the whole length of the short, piece by piece, in
     the order the figure was drawn in. Under it, one line at a time, the
     words change. There is no legend, because every label is already written
     inside the drawing beside the thing it names. There are no callouts and
     no leader lines, because there is nothing to point at that is not
     already named.

     What is left on screen at any moment is: a picture, and one sentence.
     =================================================================== */
  KIND.plate = function (b, node, tl, t0) {
    node.classList.add("has-plate");
    var holder = el("div", "plate");
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    holder.appendChild(svg);
    (sky(node) || node).appendChild(holder);

    var span = b.hold ? b.hold * 1000 : 60000;
    if (window.NOORFIG && window.NOORFIG.plate) {
      window.NOORFIG.plate({ plate: b.plate, dur: span, at: b.at,
                             shots: b.shots, lines: b.lines, motion: b.motion,
                             aspect: document.documentElement.getAttribute("data-frame") === "tall"
                                       ? 1010 / 1390 : 1180 / 620 },
                           svg, tl, t0);
    }

    /* ---- THE WORDS UNDERNEATH -------------------------------------------
       A track of lines, each with the moment it arrives. One is on screen at
       a time: the one before it leaves as the next one comes, on a short
       cross so the band is never empty and never doubled. A line rises as it
       fades, which is the same movement the type makes everywhere else in
       this film, so a short and a long film feel like one thing. */
    var wrap = el("div", "wordstack");
    (band(node) || node).appendChild(wrap);
    (b.lines || []).forEach(function (L, i) {
      var row = el("div");
      row.style.opacity = 0;
      if (L.eyebrow) {
        var ey = el("p", "eyebrow", L.eyebrow);
        ey.style.letterSpacing = eyeLS();
        row.appendChild(ey);
      }
      if (L.text) row.appendChild(el("p", L.size === "hook" ? "hook" : "h1", L.text));
      if (L.sub) row.appendChild(el("p", "body", L.sub));
      if (L.src) row.appendChild(el("p", "src", L.src));
      wrap.appendChild(row);

      var inAt = t0 + (L.at || 0) * 1000;
      var out = (L.until != null) ? t0 + L.until * 1000 : null;
      /* THE FIRST LINE DOES NOT FADE IN, IT ARRIVES.
         Half the people who leave a short leave inside the first three
         seconds, and nine hundred milliseconds of the hook fading up is a
         third of that spent on a frame with nothing readable on it. The
         opening line takes four hundred; every line after it takes the
         full nine hundred, because by then the viewer has stayed. */
      tl.add(row, { opacity: [0, 1], translateY: [i ? 26 : 14, 0], ease: SP.settle,
                    duration: i ? 900 : 400 }, inAt);
      if (out !== null) {
        tl.add(row, { opacity: [1, 0], translateY: [0, -18], ease: "outQuart",
                      duration: 520 }, out);
      }
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
      var wrap = band(node) || node;
      var p = el("p", "body"); wrap.appendChild(p);
      if (b.src) wrap.appendChild(el("p", "src", b.src));
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
  /* The type takes the same shot as the light layer, reduced: the words are
     flat and the world is not, so they agree in direction and disagree in
     kind. Every name the camera in web/lume.js knows has an entry here, or
     the two layers would move to different music. */
  /* THE WORDS DO NOT TAKE THE WHOLE SHOT.
     They were given the same translation as the picture, so a caption slid
     fifty pixels sideways on a drift and forty down on a descend -- and since
     a different beat gets a different shot, the type appeared to wander
     around the frame from one card to the next. A caption has a place. It may
     breathe with the move; it may not travel with it. Scale stays, because a
     little scale is depth; the translation is a fraction of what the picture
     gets. */
  var MOVE = {
    approach: { s: [0.98, 1.09], x: [0, 0],     y: [7, -9],   ease: "outQuint" },
    withdraw: { s: [1.11, 1.00], x: [0, 0],     y: [-7, 4],   ease: "outQuint" },
    reveal:   { s: [0.90, 1.02], x: [0, 0],     y: [22, -3],  ease: SP.open },
    descend:  { s: [1.06, 1.00], x: [0, 0],     y: [-16, 3],  ease: "outQuint" },
    orbit:    { s: [1.03, 1.07], x: [16, -16],  y: [0, 0],    ease: "inOutQuad" },
    drift:    { s: [1.03, 1.08], x: [-13, 13],  y: [0, 0],    ease: "linear" },
    hold:     { s: [1.00, 1.03], x: [0, 0],     y: [0, 0],    ease: "linear" },
    /* the words take almost nothing of the diagram's lean, so a caption under
       a chart does not drift against the chart it is captioning */
    study:    { s: [1.00, 1.02], x: [0, 0],     y: [2, -2],   ease: "inOutQuad" }
  };
  MOVE.push = MOVE.approach;
  MOVE.pull = MOVE.withdraw;
  MOVE["in"] = MOVE.reveal;

  function shoot(name, tl, at, dur) {
    /* On the board the camera is doing the work and the caption is a fixed
       card in front of it. Sliding the type as well puts two motions on the
       screen that do not agree, which reads as drift rather than as depth. */
    if (window.NOORFILM && window.NOORFILM.board) return;
    var m = MOVE[name === undefined ? "push" : name];
    if (!m) return;
    var st = document.getElementById("stage"), gr = document.getElementById("ground");
    tl.add(st, { scale: m.s, translateX: m.x, translateY: m.y, ease: m.ease, duration: dur }, at);
    /* the ground takes the same move, reduced: that is the depth */
    var f = function (a) { return [1 + (a[0] - 1) * PARALLAX, 1 + (a[1] - 1) * PARALLAX]; };
    var g = function (a) { return [a[0] * PARALLAX, a[1] * PARALLAX]; };
    tl.add(gr, { scale: f(m.s), translateX: g(m.x), translateY: g(m.y),
                 ease: m.ease, duration: dur }, at);
    /* The light layer is NOT given this move. It has a camera of its own --
       a perspective dolly rather than a scale -- and giving it both would be
       the shot applied twice. See SHOT in web/lume.js. */
  }

  /* ---- building a chapter --------------------------------------------- */
  var TL = null, DUR = 0;

  function build(chapter, frame) {
    document.documentElement.setAttribute("data-frame", frame);
    /* THE MARK ONLY SHOWS ON A SCENE.
       A scene film stands alone (it is not part of the corridor a longer
       film shares with its own end card), so it carries its own watermark
       in the DOM, set here rather than per beat because it never animates
       and never leaves: see div#mark in film.html. A chapter with no scene
       clears it, so a multi-chapter film cannot leave it stuck on from an
       earlier chapter that had one. */
    if (chapter.scene) document.documentElement.setAttribute("data-mark", "1");
    else document.documentElement.removeAttribute("data-mark");
    hold.innerHTML = "";
    TL = A.createTimeline({ autoplay: false, defaults: { ease: OUT } });
    var t = 0;
    /* ---- HOW A BEAT ARRIVES AND HOW IT LEAVES ---------------------------
       The first cut of this film had exactly one transition: a 520 ms fade
       up, a 620 ms fade down, and 450 ms of empty screen between every pair
       of beats. Nothing in it was ever CUT to. That is why it read as a
       slideshow with good typography however hard the beats themselves
       worked -- the grammar of film is the cut, and a film made only of
       dissolves has renounced it.

         cut        90 ms. The next thing is simply there. Use it when two
                    beats are the same thought continuing, or for a hard
                    turn: a cut is a full stop or an exclamation, never a
                    comma.
         dissolve   the old fade, for a change of place or of time.
         flash      a blaze of warm light across the join, peaking at the
                    cut itself. For the arrival of something the film has
                    been building toward. Spend these: two in a chapter is
                    generous, four is a music video.
         slow       a long dissolve, for the end of a chapter.

       And the gap between beats is now zero by default. Dead screen between
       two ideas is not a breath, it is a gap in the argument; a beat that
       wants air asks for it by holding longer. */
    /* AND A CUT IS INSTANT, OR IT IS A SHORT DISSOLVE.
       At ninety milliseconds each way the outgoing beat and the incoming one
       are both on screen for two frames at twenty-four -- which on a title
       card reads as a ghost of the last sentence printed through the next
       one. A cut has no duration. */
    /* NO CUTS. The camera never cuts, so the words must not either: a hard
       change of type over a continuous move is the one thing that would give
       the join away. Everything dissolves, and slowly enough that the type is
       leaving while the camera is already carrying you somewhere else. */
    /*  A CUT THAT TAKES HALF A SECOND IS A DISSOLVE.
        The note above says a cut is ninety milliseconds and the table said
        five hundred and twenty, so every beat marked "cut" was crossfading
        with the one before it for half a second -- both cards on screen at
        once, at full strength, which is exactly the double exposure that
        keeps turning up in the stills. The table now says what the note
        says. */
    /*  AND NOW IT ACTUALLY DOES.
        110 was still 110: measured at the beat 0/1 join, both headlines
        were on screen together at 0.62/0.38 and again at 0.25/0.75, which
        is the ghost the note above describes, twice a join, at every one
        of the 148 joins in the corpus. One millisecond is shorter than a
        frame at any rate, so the boundary frame belongs entirely to the
        outgoing beat and the next one entirely to the incoming one. */
    var FADE = { cut: 1, dissolve: 700, flash: 700, slow: 1000 };
    var LASTOUT = 0;
    var flare = document.getElementById("flare");
    /* A beat may ask for an object in the light layer as well as words. It is
       collected here rather than built by the beat, because that layer is not
       DOM and is not on this timeline: it is seeked from the same millisecond
       and computes its own state. */
    var lume = [];
    /* the shots, one per beat, handed to the light layer's camera as their
       own list so that a figure carrying four beats still gets four moves */
    var shots = [];

    /* HOW LONG EACH BEAT IS, BEFORE ANY OF THEM IS BUILT.
       A figure in the light layer may be asked to carry more than one beat --
       `lume.span: 4` means "stay for this beat and the three after it" -- and
       that cannot be worked out while walking the list, because the figure
       has to know how long the beats AFTER it last. So the clock is run
       first and the beats are built against it.

       This is not a convenience. A cold open in which a figure appears,
       fades, and is replaced by a black frame with a sentence on it is a
       slideshow: the thing that makes a sequence feel like film is that the
       PICTURE continues while the words change under it. One field of lights
       across four beats and one light across four more is two movements,
       not eight cards. */
    var beats = chapter.beats || [];
    var span = [], clock = 0;
    beats.forEach(function (b) {
      var h = Math.max(1200, Math.round((b.hold || 4) * 1000));
      span.push({ at: clock, dur: h });
      clock += h + Math.round((b.gap != null ? b.gap : 0) * 1000);
    });

    /* WHICH BEATS HAVE A FIGURE OVER THEM.
       The words move to the lower band when the light layer has an object on
       screen, and stay centred when it does not. With one figure carrying
       four beats, only the FIRST of those four was declaring itself -- so the
       caption jumped from the bottom of the frame back to the middle and out
       again while the picture behind it never changed. Coverage is worked out
       from the spans, not from whether a beat happens to own the cue. */
    var covered = [], overed = [];
    beats.forEach(function (b, i) {
      if (!b.lume) return;
      var last = Math.min(beats.length - 1, i + Math.max(1, b.lume.span || 1) - 1);
      for (var j = i; j <= last; j++) {
        covered[j] = true;
        if (b.lume.place === "over") overed[j] = true;
      }
    });

    /* ---- WHAT THE LANTERN IS DOING, BEAT BY BEAT ------------------------
       There is one light in this film and it is never built twice, so the
       question at every beat is not "is there an orb" but "what posture is
       the Lantern in". It is the SUBJECT wherever the script used to ask for
       an orb and wherever it asks for nothing at all, and it stands ASIDE
       wherever a diagram has the frame. It only ever opens its pane when it
       is the subject and the beat has a phrase worth setting: a sentence of
       explanation belongs in the subtitle band with every other sentence. */
    var ownK = [];
    beats.forEach(function (b, i) {
      if (!b.lume) return;
      var lastK = Math.min(beats.length - 1, i + Math.max(1, b.lume.span || 1) - 1);
      for (var j = i; j <= lastK; j++) ownK[j] = b.lume.kind;
    });
    beats.forEach(function (b, i) {
      var k = ownK[i];
      /* A SCENE HAS NO PER-BEAT lume, SO ownK IS ALWAYS EMPTY FOR ONE
         (round four defect). !k then read as "nobody owns this beat, the
         Lantern may speak it", which is right for a corridor beat with no
         figure at all but wrong for a scene: a scene figure stands under
         EVERY beat, and its cues carry no pane text or bp (finding 2 said
         as much when it hid the pane in scene mode) -- so _pane routed the
         eyebrow and the headline to a pane that was never going to draw
         them, and KIND.title's own branch above left only the sub behind.
         Ten beats, four of which have no sub at all, showed no headline.
         A scene always speaks in the DOM band; never through the pane. */
      b._speak = !chapter.scene && (!k || k === "orb");
      b._pane = b._speak && !!b.text &&
                (b.kind === "title" || (b.kind === "statement" && b.size === "big"));
    });

    beats.forEach(function (b, i) {
      var node = layer();
      hold.appendChild(node);
      var hold_ms = Math.max(1200, Math.round((b.hold || 4) * 1000));
      var inK = b.enter || (i === 0 ? "slow" : "dissolve");
      var outK = b.exit || "dissolve";
      var FADE_IN = FADE[inK] || FADE.dissolve;
      var FADE_OUT = FADE[outK] || FADE.dissolve;
      TL.add(node, { opacity: [0, 1], ease: inK === "cut" ? "linear" : OUT,
                     duration: FADE_IN }, t);
      (KIND[b.kind] || KIND.statement)(b, node, TL, t + (inK === "cut" ? 20 : 120));
      /* the shot runs the length of the beat AND its outgoing fade, so the
         camera is still moving as the beat leaves. A move that stops before
         the picture does is a move you notice. */
      shoot(b.shot, TL, t, hold_ms + FADE_OUT);
      shots.push({ at: t, dur: hold_ms + FADE_OUT, shot: b.shot || "push" });
      if (b.lume) {
        var L = {}; for (var kk in b.lume) L[kk] = b.lume[kk];
        var last = i + Math.max(1, b.lume.span || 1) - 1;
        if (last >= beats.length) last = beats.length - 1;
        L.at = t;
        L.dur = (span[last].at + span[last].dur) - t;
        L.shot = b.shot || "push"; L.fade = FADE_IN;
        lume.push(L);
      }
      /* A SCENE HAS NO PER-BEAT lume FIELD, SO "covered" IS ALWAYS EMPTY FOR
         ONE. Every other kind of chapter marks which beats a figure stands
         over from each beat's own b.lume; a scene names its whole figure
         once, in chapter.scene, so no beat ever sets b.lume and the words
         fell back to the centre of the frame -- straight over the aperture
         at frame centre, which is exactly the one place they may never
         sit. A scene figure is on screen for the whole film, so every beat
         of it gets the lower band. */
      if (covered[i] || chapter.scene) node.classList.add("has-lume");
      if (overed[i]) node.classList.add("over");
      TL.add(node, { opacity: [1, 0], y: [0, outK === "cut" ? 0 : -34],
                     ease: outK === "cut" ? "linear" : OUT, duration: FADE_OUT }, t + hold_ms);
      /* the blaze peaks ON the join, not before or after it, which is the
         whole reason it reads as one event rather than two */
      if (inK === "flash" && flare) {
        TL.add(flare, { opacity: [0, b.flare || 0.82], ease: "outQuad", duration: 130 },
               Math.max(0, t - 130));
        TL.add(flare, { opacity: [b.flare || 0.82, 0], ease: "outQuart", duration: 620 }, t);
      }
      LASTOUT = FADE_OUT;
      t += hold_ms + Math.round((b.gap != null ? b.gap : 0) * 1000);
    });

    /* THE LAST FADE HAS TO FIT INSIDE THE FILM.
       The out-fade of the final beat was scheduled at exactly t, and t was
       DUR, and the renderer stops one frame before DUR. So every chapter
       ended on a card at full brightness and then simply stopped, and at
       each join of a multi-chapter film that read as a hard cut to black
       where a one second dissolve was written. */
    DUR = t + LASTOUT;
    TL.pause();
    /* =====================================================================
       THE BOARD: every figure gets a place, every beat gets a viewpoint.
       =====================================================================
       There are no cuts in this film. The figures stand in one space, laid
       out along a slow curve, and a single camera travels between them: what
       used to be a cut from one beat to the next is now either a move around
       the same object or a journey to a new one. That is also where the
       parallax comes from. Nothing is faked with a transform on a flat layer;
       the near thing passes the far thing because the near thing is nearer.

       The layout is a corridor rather than a ring, because a ring brings you
       back past what you have already explained, and the film is an argument
       that goes somewhere. Height and depth wander so the path is never a
       straight line and the camera is always banking a little. */
    var FIGPOS = [];
    var SPAN = 21.0;
    function figHome(k) {
      if (!FIGPOS[k]) {
        FIGPOS[k] = [
          k * SPAN + Math.sin(k * 1.7) * 2.2,
          Math.sin(k * 0.83) * 2.7,
          Math.cos(k * 0.57) * 5.4
        ];
      }
      return FIGPOS[k];
    }

    /* A VIEWPOINT IS NEVER REUSED.
       Each beat is looked at from somewhere the last beat was not: the angle
       walks, the height alternates, the distance breathes in and out, and the
       roll flips sign. A film that frames twenty beats the same way has one
       shot in it however many times it cuts. */
    function viewFor(n, home, kind, near) {
      var az = 0.42 * Math.sin(n * 1.31) + 0.26 * Math.sin(n * 0.47);
      var el = 0.30 * Math.sin(n * 0.91 + 1.1);
      var d  = near * (0.92 + 0.16 * Math.sin(n * 0.73 + 0.4));
      /* a diagram is read square on, so it is approached rather than circled;
         an object has sides, so the camera takes one */
      /* A DIAGRAM IS LOOKED AT STRAIGHT ON.
         The varied framing is what keeps twenty beats from being one shot
         repeated, and it is right for an object with sides. A chart has no
         sides: swing eight degrees off axis and the axis of the chart slides a
         fifth of the frame off centre, which reads as a mistake rather than as
         a camera angle. Diagrams get the variation in distance and in focal
         length, and almost none in angle, and they are aimed at dead centre. */
      /* WHICH KINDS ARE READ RATHER THAN LOOKED AT.
         This was a single equality against "plate", written when "plate"
         was the only diagram there was. Every nut* figure since is also a
         flat vector drawing meant to be seen square on, and every one of
         them was taking the full swing: measured on who-was-muhammad, up
         to 39 degrees of azimuth, and 35 degrees of it INSIDE a single
         figure span. A time axis rendered on a slope does not read as a
         camera angle. It reads as a broken render. */
      var FLATK = { plate: 1, bars: 1, nutdots: 1, nutarc: 1, nutforty: 1,
                    nutsieve: 1, nutchain: 1, nuttime: 1, nutsort: 1,
                    nutpath: 1, nutlamps: 1, nutbar: 1,
                    nutvalley: 1, nutscale: 1, nutsplit: 1,
                    nutconverge: 1, nuttwin: 1 };
      var flat = !!FLATK[kind];
      if (flat) { az *= 0.11; el *= 0.16; }
      var eye = [ home[0] + Math.sin(az) * d,
                  home[1] + Math.sin(el) * d * 0.55,
                  home[2] + Math.cos(az) * d ];
      var look = flat
        ? [ home[0], home[1], home[2] ]
        : [ home[0] + Math.sin(n * 2.1) * 0.22,
            home[1] + Math.cos(n * 1.7) * 0.18,
            home[2] ];
      return { eye: eye, look: look,
               fov: flat ? 35 + 2.0 * Math.sin(n * 0.6)
                         : 38 + 5.0 * Math.sin(n * 0.53 + 0.9),
               roll: (flat ? 0.004 : 0.016) * Math.sin(n * 1.13) };
    }

    /* ---- WHERE THE LANTERN STANDS, AND WHERE ITS PANE HANGS -------------
       The pane is not a heads-up display. It is hung in the room, at the
       Lantern's own depth, at the place in the frame the beat's own camera
       puts it -- which is why the camera drifts against it while it is being
       read and travels past it when the beat is over, and why the words have
       real parallax instead of a transform faking one on flat glass. */
    var LOFF  = frame === "tall" ? [-0.14, -0.74, 0] : [-0.55, -1.16, 0];
    var LSIDE = frame === "tall" ? [-1.16, -2.05, 1.7] : [-2.55, -1.05, 1.9];
    var PFRAC = frame === "tall" ? 0.86 : 0.44;
    var PRX   = frame === "tall" ? 0.00 : 0.50;
    var PRY   = frame === "tall" ? 0.58 : 0.40;
    var PASP  = frame === "tall" ? 1080 / 1920 : 1920 / 1080;

    /* ---- THE CAMERA FOR A SILENT SHORT ---------------------------------
       A long film travels: a station for each stretch of the argument, and a
       camera that walks between them. A short has ONE figure and therefore
       one station, so there is nowhere to walk to, and viewFor's per beat
       viewpoints would put eight unrelated angles on the same object in
       thirty seconds. On a phone that is not a camera, it is a slideshow with
       a wobble.

       So a short gets one move. The whole thing is a single slow push from
       wide and slightly above down to eye level and in, with fourteen degrees
       of orbit across the entire length and the lens closing five degrees at
       the same time. Because every viewpoint is computed from the beat's
       position in the WHOLE short rather than from its index, consecutive
       beats land on consecutive points of one path, and the board curve joins
       them into a move with no joins in it.

       The push and the lens close together is the cheap half of a dolly zoom,
       which is the most dramatic thing a camera can do while still letting
       somebody read. */
    function shortView(p, home, near) {
      var e = p * p * (3 - 2 * p);
      var az = -0.130 + 0.245 * e;
      var el =  0.100 - 0.140 * e;
      /* HOW CLOSE THE PUSH MAY GET, AND WHY IT IS NO LONGER 0.90.
         This ran from 1.20 to 0.90 of the figure's standing distance, and
         that was tuned against nutsort, which is a compact cloud of motes
         that never fills more than the middle of the frame. Every figure
         wider than it walked out of the picture as the camera came in.
         Measured off contact sheets: in nutscale both pans of the balance
         were cut off by the fifth beat, and in nuttwin the second spiral,
         which is the entire point of that figure, was outside the frame by
         the last one.

         The arithmetic, in 9:16. Half the frame width is
         d * tan(fov/2) * 9/16. At the old closing distance that is
         0.90 * near * tan(16.5 deg) * 0.5625 = 0.150 * near. For nutscale's
         standing distance of 7.8 that is 1.17 world units, against a figure
         whose arm alone is 1.62 either side of centre. It could never have
         fitted, at any point of the move.

         So the push now ends at 1.16, putting the closing half width at
         0.193 * near, and the wide figures get a standing distance to match
         in the table below. It is still a move: thirteen per cent closer
         across the short, and the orbit and the lens carry the rest. A
         camera that ends up outside its own subject is not a move at all. */
      var d  = near * (1.34 - 0.18 * e);
      return {
        eye: [home[0] + Math.sin(az) * d,
              home[1] + Math.sin(el) * d * 0.55,
              home[2] + Math.cos(az) * d],
        look: [home[0], home[1], home[2]],
        fov: 38.0 - 5.0 * e,
        roll: 0.006 * Math.sin(p * 2.4 - 0.4)
      };
    }

    function paneFor(v, lp) {
      var ex = v.eye, lk = v.look;
      var fx = lk[0] - ex[0], fy = lk[1] - ex[1], fz = lk[2] - ex[2];
      var fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
      fx /= fl; fy /= fl; fz /= fl;
      var hh = Math.sqrt(fz * fz + fx * fx) || 1;
      var rx = -fz / hh, ry = 0, rz = fx / hh;
      var ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
      var ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
      ux /= ul; uy /= ul; uz /= ul;
      var dx = lp[0] - ex[0], dy = lp[1] - ex[1], dz = lp[2] - ex[2];
      var dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      var halfH = dist * Math.tan(v.fov * Math.PI / 360);
      var halfW = halfH * PASP;
      return { bw: 2 * halfW * PFRAC,
               bp: [lp[0] + rx * halfW * PRX + ux * halfH * PRY,
                    lp[1] + ry * halfW * PRX + uy * halfH * PRY,
                    lp[2] + rz * halfW * PRX + uz * halfH * PRY] };
    }

    /* WHERE EACH FIGURE ACTUALLY SITS INSIDE ITS OWN STATION, measured by
       measure.py. Declared here rather than inside the beat loop because two
       things need it: the camera, so it looks at the figure instead of the
       empty point the figure hangs on, and the label bands, so they sit above
       and below the picture rather than above and below nothing. */
    /* HOISTED OUT OF THE BEAT LOOP. The standing distance is now read twice:
       once to place the camera, and once to size the words. Both need it
       before the loop runs, so it is declared here rather than halfway
       down the body of the loop where only the camera could see it. */
    var NEAR = { plate: 7.70, orb: 10.2, field: 9.4, lattice: 8.6,
                 stream: 9.2, ring: 8.2, card: 8.2,
                   nutarc:         11.44,
                   nutbar:         22.34,
                   nutchain:        6.55,
                   nutconverge:      9.60,
                   nutdots:         7.97,
                   nutforty:        7.88,
                   nutlamps:        8.61,
                   nutpath:         10.10,
                   nutscale:       12.31,
                   nutsieve:       17.54,
                   nutsort:         7.00,
                   nutsplit:       12.10,
                   nuttime:        10.49,
                   nuttwin:        10.54,
                   nutvalley:       7.63,
                 };

    /* WHEN EACH FIGURE ACTUALLY FINISHES, measured by settle.py. See the
       SHORT WARP below for what is done with it. Two numbers per figure: the
       point on its own clock where it starts to do something, and the point
       after which less than one and a half per cent of its total change is
       still to come. Do not edit by hand; change a figure and run settle.py
       again. */
    var SETTLE = {
      nutarc:        [0.04, 0.94],
      nutbar:        [0.05, 0.87],
      nutchain:      [0.04, 0.96],
      nutconverge:   [0.03, 0.92],
      nutdots:       [0.03, 0.88],
      nutforty:      [0.03, 0.82],
      nutlamps:      [0.03, 0.93],
      nutpath:       [0.03, 0.95],
      nutscale:      [0.01, 0.93],
      nutsieve:      [0.03, 0.87],
      nutsort:       [0.04, 0.70],
      nutsplit:      [0.04, 0.93],
      nuttime:       [0.04, 0.95],
      nuttwin:       [0.04, 0.93],
      nutvalley:     [0.05, 0.82],
    };

    var LOOKUP = {
      nutarc:          1.03,
      nutbar:          1.35,
      nutchain:        0.86,
      nutconverge:     0.92,
      nutdots:         0.88,
      nutforty:        1.06,
      nutlamps:        0.86,
      nutpath:         1.22,
      nutscale:        0.43,
      nutsieve:        0.07,
      nutsort:         0.44,
      nutsplit:        0.90,
      nuttime:         0.88,
      nuttwin:         0.90,
      nutvalley:       0.88,
    };

    /* a short is one figure, one move, and words that cut */
    var SHORT = !!chapter.short;
    var TOTAL = span.length ? span[span.length - 1].at + span[span.length - 1].dur : 1;
    var board = [], views = [], lcues = [];
    if (window.NOORLUME) {
      /* ---- SCENE MODE ----------------------------------------------------
         darkroom, and any future film built the same way, names its own
         camera views and lantern cues per beat instead of asking the
         corridor's figHome()/viewFor() to invent them. WHAT BROKE BEFORE
         THIS BRANCH EXISTED: a chapter with a scene fell straight through
         to the corridor below, which built the figure's home from
         figHome() -- a point on the corridor's own sine wave -- and built
         views from viewFor(), and neither has any idea a room's aperture
         sits at a fixed point in space. The aperture was never at frame
         centre and the lamps stood in empty air behind where the wall
         should have been. A scene skips all of that and hands the board
         exactly what the spec already worked out. */
      if (chapter.scene) {
        var SC = chapter.scene;
        if (!SC.views || SC.views.length !== beats.length)
          throw new Error("scene.views has " + ((SC.views || []).length) +
                           " entries, needs exactly one per beat (" + beats.length + ")");
        if (!SC.lantern || SC.lantern.length !== beats.length)
          throw new Error("scene.lantern has " + ((SC.lantern || []).length) +
                           " entries, needs exactly one per beat (" + beats.length + ")");
        /* one figure, standing at the room's own origin, carrying the
           whole film: see WORLD CONVENTION in the darkroom spec, "the
           figure's root sits at pos [0, 0, 0]; nothing is offset" */
        var SF = {}; for (var scK in SC.figure) SF[scK] = SC.figure[scK];
        SF.pos = [0, 0, 0]; SF.turn = 0; SF.at = 0; SF.dur = TOTAL; SF.dim = 1;
        board = [SF];
        /* each view and lantern cue takes the beat's own span, exactly as
           the corridor does below for its own views and lcues */
        views = SC.views.map(function (v, i) {
          var vv = {}; for (var vk in v) vv[vk] = v[vk];
          vv.at = span[i].at; vv.dur = span[i].dur;
          /* THE SPEC NOW GIVES A HORIZONTAL FIELD OF VIEW (finding 3).
             lume.js's board camera has always read view.fov as the VERTICAL
             field of view of a three.js PerspectiveCamera; one spec composing
             both a tall and a wide frame needs the number that stays true
             across an aspect change, which is the horizontal one, not the
             vertical one a portrait and a landscape frame disagree about by
             a wide margin. Converted once here, at build time, so lume.js
             keeps reading fov as vertical exactly as it always has and never
             has to know hfov exists; a view with no hfov keeps its own fov
             untouched, which is how a corridor view would arrive here too if
             one ever did. aspect is this frame's own actual width over
             height, taken from the same two numbers spec.py's own FRAMES
             uses (1080x1920 tall, 1920x1080 wide), not the 2.2326 wide
             figure in these orders, which does not match a 1920x1080 frame;
             see the report. */
          if (vv.hfov !== undefined) {
            var asp = frame === "tall" ? (1080 / 1920) : (1920 / 1080);
            var hrad = vv.hfov * Math.PI / 180;
            vv.fov = 2 * Math.atan(Math.tan(hrad / 2) / asp) * 180 / Math.PI;
          }
          return vv;
        });
        lcues = SC.lantern.map(function (c, i) {
          var cc = {}; for (var ck in c) cc[ck] = c[ck];
          cc.at = span[i].at; cc.dur = span[i].dur; return cc;
        });
        /* THE DWELL PARKS THE CAMERA IN A SIX UNIT ROOM.
           The corridor's own dwell/travel split (see boardAt in lume.js)
           holds near a knot for 62% of a beat and travels only the last
           38%: fine when the next knot is twenty units down a corridor, a
           lurch when it is across a room six units wide, because the
           travel then covers the whole distance in a third of the time.
           Glide removes the dwell and eases the WHOLE beat with one
           inOutSine, so a six second beat between two views a few units
           apart is one continuous move rather than a park and a dash. */
        if (NOORLUME.pace) NOORLUME.pace("glide");
        /* the corridor's breath (BREATH in lume.js) was tuned for a twenty
           unit corridor; in this six unit room it read as a small
           earthquake, so a scene names its own fraction of it */
        if (NOORLUME.breath) NOORLUME.breath(SC.breath == null ? 0.35 : SC.breath);
      } else {
      var fk = -1;
      beats.forEach(function (b, i) {
        var owner = null;
        for (var j = 0; j <= i; j++) {
          var l = beats[j].lume;
          if (!l) continue;
          var last = j + Math.max(1, l.span || 1) - 1;
          if (i >= j && i <= last) owner = { at: j, lume: l };
        }
        if (owner && owner.at === i) {
          fk++;
          var o = {}; for (var kk in owner.lume) o[kk] = owner.lume[kk];
          /* AN ORB IS NO LONGER A FIGURE. It is a place the Lantern stands.
             The station is empty and exists only so the corridor does not
             close up around a spot that still has a beat happening in it. */
          if (o.kind === "orb") o.kind = "station";
          o.pos = figHome(fk);
          /* a figure that stands behind a title is held back, as it was when
             it was composited under the words rather than standing in a room */
          o.dim = owner.lume.place === "over" ? 0.5 : 1;
          o.at = span[i].at;
          var lastB = Math.min(beats.length - 1, i + Math.max(1, owner.lume.span || 1) - 1);
          o.dur = (span[lastB].at + span[lastB].dur) - span[i].at;
          /* THE SHORT WARP: THE FIGURE FILLS THE FILM, BOTH ENDS.
             Every figure is written to arrive somewhere before the end of its
             own span, because in a long film the last beats of a span are
             spent reading about what already happened. In a silent short
             there is no reading about it: the picture IS the argument, and a
             figure that completes at 26 seconds leaves the last 17 staring at
             a finished drawing.

             The first attempt at this multiplied the figure's duration, which
             does slow the arrival but also slows the DEPARTURE. nutsort fades
             its motes in over u 0.04 to 0.16; at a 1.6x duration on a 42.8 s
             short that fade did not finish until 11 s, so the first two beats
             played over an empty frame. Measured on the contact sheet: beat 0
             had nothing on it but the words. A silent short cannot afford a
             blank opening, because there is no voice covering it.

             So the clock is not scaled, it is REMAPPED, in two straight
             pieces. The first 5.5% of the short covers the figure's own first
             16%, which is every figure's fade-in, so the picture is on screen
             inside two and a half seconds. The remaining 94.5% covers 0.16 up
             to the end mark, which is where the motion lives.

             The end mark is 0.70, and that number is measured rather than
             chosen. These figures ease their arrival and give every element
             its own lag, so the last third of a figure's clock carries almost
             none of its visible change: nutsort is analytically still moving
             until u = 0.79, but on a contact sheet it reads as finished at
             about u = 0.58. Ending the map at 0.86 therefore looked WORSE
             than ending it early, because the picture settled at 26 s of 43
             and the last four beats were one still image. At 0.70 the settle
             lands near four fifths of the way in, which leaves the closing
             card reading over a finished picture and a camera still moving,
             and that is the shape wanted. Continuous at the join, monotonic,
             still a pure function of time. */
          if (SHORT) {
            /* ONE WARP CANNOT FIT FIFTEEN FIGURES, and the cost of pretending
               it could was not a slightly mistimed picture, it was shorts
               that did not make sense.

               0.16 to 0.70 was measured, honestly, on nutsort. Applied to the
               rest: nuttime does everything it does by 0.16 of its clock, so
               the entire film ran over a still image. nuttwin does nothing at
               all until 0.66, so the film was thirty seconds of an empty
               frame and then a rush at the end. nutlamps throws its three
               patches of light onto the wall between 0.62 and 0.86, and
               stopping at 0.70 delivered them at a third of their size in the
               last second -- on a short whose entire subject is that three
               separate images appear on that wall.

               So the two ends of the map are per figure and they are
               measured. A hair before the figure starts, so the opening
               frame is not blank, and a little past where it finishes, so
               the settle reads as a settle rather than as a cut. */
            var sf = SETTLE[o.kind] || [0.16, 0.70];
            /* AND THE OPENING SLICE HAS TO LAND ON SOMETHING VISIBLE.
               settle.py's start is the point where one per cent of the
               figure's total change has happened, which is the right
               definition for "it has begun" and the wrong one for "there is
               a picture". On the lamps it is 0.03, and the lamps themselves
               do not start growing until 0.06: the opening slice was
               delivering the viewer to a frame that was still empty, and the
               first six seconds of the short were a headline over black.
               A feed gives about one second. Eleven one-hundredths of the
               figure's clock past the first stirring is where something is
               actually on screen, and it costs the argument almost nothing. */
            var u0 = Math.max(0, Math.min(0.45, sf[0] + 0.11));
            var u1 = Math.min(1, Math.max(u0 + 0.10, sf[1] + 0.05));
            /* three pieces, not two: see THE SHORT WARP IN THREE PIECES in
               web/lume.js. The figure's whole argument is over by 80% of the
               film, which is where the closing cards begin. */
            o.warp = [0.055, u0, u1, 0.80];
          }
          /* the label bands hang off the same point the camera looks at, so
             the figure gets the middle of the frame and the words get the
             air above and below it */
          o.lift = (SHORT && LOOKUP[o.kind]) ? LOOKUP[o.kind] : 0;
          /* AND HOW FAR BACK THE CAMERA STANDS, because a word is not a
             world object. Every figure is composed to the same fraction of
             the frame, which means each one is shot from its own distance:
             nutdots from 7.18 units and nutsieve from 13.75. A label sized
             in world units is therefore twice the height of the frame on
             one short and a third of it on another, and that is exactly the
             disproportion that showed up on the contact sheets. Passing the
             distance down lets the labels and the bands be sized as a
             FRACTION of the frame instead, so a callout is the same size on
             screen in all fifteen. */
          o.near = (SHORT && NEAR[o.kind]) ? NEAR[o.kind] : 0;
          board.push(o);
        }
        var kind = owner ? owner.lume.kind : null;
        var home = owner ? figHome(fk) : null;
        if (!home) {
          /* a beat with no figure of its own is a moment in transit: the
             camera is between two objects, drifting, and the words hold */
          var a = figHome(Math.max(0, fk)), bnext = figHome(Math.max(0, fk) + 1);
          home = [(a[0] + bnext[0]) / 2, (a[1] + bnext[1]) / 2 + 0.6,
                  (a[2] + bnext[2]) / 2];
        }
        /* EVERY FIGURE IS A DIFFERENT SIZE, SO EVERY FIGURE HAS ITS OWN
           STANDING DISTANCE. The orb is a body of light sixteen units across
           and the diagram plate is seven and a half; parked at one distance
           the first fills the frame with white and the second sits in the
           middle of it like a postage stamp. */
        /* HOW FAR TO STAND, MEASURED RATHER THAN CHOSEN.
           Every number in the NEAR table above came out of measure.py, which
           builds each figure, lets it finish moving, asks three.js for the
           actual size of its marks and then solves for the distance that
           composes it. It is not a taste judgement and it should not be
           edited by hand: change a figure, run measure.py again.

           WHY THE HAND PICKED ONES WERE WRONG, AND WRONG BOTH WAYS. They
           were chosen against 16:9 and then nudged for 9:16 by eye. Measured:
           the sieve is 2.27 units tall and was being shot from 7.4, which is
           half the distance it needs, so it ran off the top and bottom; the
           chain of five links is 1.04 across and 0.08 tall and was being shot
           from 10.1, which is why it came back as a thumbnail in an empty
           frame. One was twice too close and the other half again too far,
           and both were arrived at the same way.

           The solve is in measure.py and it is three constraints: the figure
           takes 82% of the width, or 48% of the height, or the label bands
           have to fit, whichever binds first. A wide figure is therefore
           sized by its width and a tall one by its height, and neither is
           ever sized by the wrong one. */
        /* and nothing multiplies it afterwards. There was a hand written
           table here that pushed the horizontal figures further back in a
           tall frame, and it is gone: the measurement already knows the
           shape of each figure and the solve already knows the shape of the
           frame, so a correction applied on top is a guess overruling a
           measurement. That is exactly what made the chain a thumbnail. */
        /* the measured offset from the station to the figure. See LOOKUP. */
        var near = NEAR[kind] || (kind ? 8.0 : 6.2);
        var lift = (SHORT && LOOKUP[kind]) ? LOOKUP[kind] : 0;
        var aim = [home[0], home[1] + lift, home[2]];
        var v = SHORT
              ? shortView(span[i].at / Math.max(1, TOTAL - span[i].dur), aim, near)
              : viewFor(i, home, kind, near);
        v.at = span[i].at;
        v.dur = span[i].dur;
        views.push(v);

        /* A PLATE BEAT HAS NO LANTERN. The lantern is the light the long
           films speak through, and on a beat that does not speak it is
           parked small and dim off to one side. On a plate short that is a
           soft gold smudge sitting behind the words for the whole minute,
           which is the blur the owner saw under every line. There is nothing
           for it to light here: the picture is its own light. */
        if (b.kind === "plate") { lcues.push({ at: v.at, dur: v.dur,
              pos: [home[0], home[1], home[2]], scale: 0.0001, bright: 0 }); return; }
        var speak = b._speak;
        var lp = speak
          ? [home[0] + LOFF[0],  home[1] + LOFF[1],  home[2] + LOFF[2]]
          : [home[0] + LSIDE[0], home[1] + LSIDE[1], home[2] + LSIDE[2]];
        var cue = { at: v.at, dur: v.dur, pos: lp,
                    scale:  speak ? 1.00 : 0.21,
                    bright: speak ? 1.00 : 0.34 };
        if (b._pane) {
          var pf = paneFor(v, lp);
          cue.text = b.text; cue.eyebrow = b.eyebrow || "";
          cue.size = b.size || ""; cue.bw = pf.bw; cue.bp = pf.bp;
        }
        lcues.push(cue);
      });
      /* the direction first: the figures clone their colours out of the
         palette when they are built, so the theme has to be set before the
         board is mounted or it changes nothing that is already standing */
      if (NOORLUME.pace) NOORLUME.pace(SHORT ? "even" : "dwell");
      }
      if (NOORLUME.theme) NOORLUME.theme(chapter.theme || "night");
      NOORLUME.shots(shots);
      NOORLUME.board(board, views);
      NOORLUME.lantern(lcues);
      /* her breath, if this cut has a voice yet */
      NOORLUME.voice(chapter.voice || null);
    }
    return { duration: DUR, beats: (chapter.beats || []).length, lume: lume.length };
  }

  function seek(ms) {
    var at = Math.max(0, Math.min(DUR, ms));
    if (window.NOORGROUND) NOORGROUND.draw(ms);
    if (window.NOORLUME) NOORLUME.draw(at);
    if (TL) TL.seek(at);
  }

  window.NOORFILM = {
    board: true,
    build: build, seek: seek,
    get duration() { return DUR; },
    kinds: Object.keys(KIND)
  };
})();
