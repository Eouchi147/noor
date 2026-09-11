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
    var h = el("h1", "h1"); wrap.appendChild(h);
    if (b.sub) wrap.appendChild(el("p", "body", ""));
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
      tl.add(hh, { opacity: [0, .92], letterSpacing: [".42em", null], ease: OUT,
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
    var FADE = { cut: 520, dissolve: 700, flash: 700, slow: 1000 };
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
      b._speak = !k || k === "orb";
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
      if (covered[i]) node.classList.add("has-lume");
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
      t += hold_ms + Math.round((b.gap != null ? b.gap : 0) * 1000);
    });

    DUR = t;
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
      var flat = kind === "plate";
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
               fov: kind === "plate" ? 35 + 2.0 * Math.sin(n * 0.6)
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

    var board = [], views = [], lcues = [];
    if (window.NOORLUME) {
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
        var NEAR = { plate: 7.70, orb: 10.2, field: 9.4, lattice: 8.6,
                     stream: 9.2, ring: 8.2, card: 8.2 };
        var near = NEAR[kind] || 8.0;
        var v = viewFor(i, home, kind, near);
        v.at = span[i].at;
        v.dur = span[i].dur;
        views.push(v);

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
      NOORLUME.shots(shots);
      NOORLUME.board(board, views);
      NOORLUME.lantern(lcues);
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
