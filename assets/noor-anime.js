/* NOOR Illumination · the house motion language, now on anime.js
   ------------------------------------------------------------------
   One file, every page. It does two jobs the site used to split between a
   loader and a library it could only afford on thirty pages:

     1. It speaks the house motion language that the rooms already write
        into their markup, exactly as GSAP did:

          .mo           rise and fade in when scrolled into view
          .mo-pop       spring pop for icons, tiles, marks
          .mo-draw      the SVG strokes inside draw themselves on
          .mo-float     a gentle endless float, ambient and decorative
          .mo-count     counts data-n upward when seen
          [data-mo-stagger]   a parent whose .mo children cascade
          NOOR_MO.animate(root)   plays everything inside a root now

     2. On the pages that were never marked up, it finds the things a reader
        arrives at and gives them the same telling: the cards and panels of a
        room, the entries of the Encyclopedia, the figures and ornaments, the
        opening line of the page and the gold rule under it, a panel that
        opens, a verse that is being recited. Nothing is invented; it is the
        same restraint applied where nobody had yet applied it.

   THE RULES, WHICH ARE OLDER THAN THIS FILE

     · Nothing is hidden until the animation is alive. The library is fetched
       after the page has painted; if it never arrives, every word is where
       it was. A failed script may not cost a reader a paragraph.
     · Held with opacity, never with visibility. An unseen card is still in
       the selection and still in the accessibility tree.
     · The reader is the authority. Whatever the reader has scrolled to is
       released whether or not an observer agreed, and after eight seconds
       nothing stays hidden, ever.
     · Reduced motion means no motion. The library is not even downloaded.
     · Small devices, slow connections and data saver are left in peace.
     · The Mushaf's verses are never moved. The player measures where a
       verse sits to decide whether to scroll, and a verse that is animating
       lies about where it sits. Verses get a glow, never a transform.

   Weight: this file plus a custom anime.js build of forty kilobytes,
   fetched once, cached, and only on a page that has something to move.
   The GSAP trio it replaces was a hundred and sixteen.

     <script src="/assets/noor-anime.js?v=1" defer></script>
*/
(function () {
  "use strict";
  if (window.NOOR_MO && window.NOOR_MO.engine === "anime") return;   /* loaded twice */

  var LIB = "/assets/anime.min.js?v=1";
  var REDUCE = false;
  try { REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}

  /* ---------------------------------------------------------------
     what may and may not be touched
  --------------------------------------------------------------- */
  /* the house classes, written by the rooms' own generators */
  var MARKED = ".mo, .mo-pop, .mo-draw, .mo-float, .mo-count, [data-mo-stagger]";
  /* the things a reader arrives at on an unmarked page */
  var REVEAL = ".card, .panel, .stat, .wgo-c, .dent, .tile, .station, .band, .room, .plate, .pcard, " +
               ".see a, .deep, main > h2, section > h2, .chip, .kick, .lede, main h1";
  var DRAW   = ".fig svg, .figsvg, .orn svg, svg.crescent, .seal svg";
  /* never touched: chrome, the dial, search, dialogs, the console, and the
     verses of the Mushaf, which the player measures */
  var NEVER  = "#site-header, header, nav, footer, .nd, #noor-search, .dd-mega, .dd-menu49, dialog, " +
               ".encx, .ayah, #roomBody, .modal, [data-no-anime], .no-anime, canvas, .h2c, #hero, .hero, " +
               ".reveal, #timeline, .lang-chip, .lbtn, .cchip, form, [role=dialog], [aria-modal]";

  function denied() {
    if (REDUCE) return "reduced motion";
    if (document.documentElement.hasAttribute("data-no-anime")) return "page opted out";
    if (/^\/admin(\.html)?$/.test(location.pathname)) return "the console stays still";
    try {
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return "small device";
      if (navigator.deviceMemory && navigator.deviceMemory <= 2) return "small device";
    } catch (e) {}
    try {
      var c = navigator.connection;
      if (c && (c.saveData || /^(slow-)?2g$/.test(c.effectiveType || ""))) return "slow connection";
    } catch (e) {}
    return "";
  }

  function inNever(el) { try { return !!el.closest(NEVER); } catch (e) { return true; } }
  function q(sel, root) { try { return [].slice.call((root || document).querySelectorAll(sel)); } catch (e) { return []; } }

  /* ---------------------------------------------------------------
     the engine, once the library is here
  --------------------------------------------------------------- */
  var A = null;                      /* window.anime */
  var pending = [];                  /* elements held, waiting for the fold */
  var io = null;

  function hold(el, kind) {
    if (el.__na) return;
    el.__na = kind;
    el.style.opacity = "0";
    if (kind === "pop") el.style.transform = "scale(.6)";
    else el.style.transform = "translateY(24px)";
    pending.push(el);
  }

  function release(els, animated) {
    els = els.filter(function (el) { return el.__na && !el.__naDone; });
    if (!els.length) return;
    els.forEach(function (el) { el.__naDone = 1; });
    if (!animated || !A) {
      els.forEach(function (el) { el.style.opacity = ""; el.style.transform = ""; });
      return;
    }
    var pops = els.filter(function (el) { return el.__na === "pop"; });
    var rises = els.filter(function (el) { return el.__na !== "pop"; });
    var done = function (el) { el.style.opacity = ""; el.style.transform = ""; };
    if (rises.length) A.animate(rises, {
      translateY: [24, 0], opacity: [0, 1], duration: 720, ease: "outCubic",
      delay: A.stagger(70, { start: 0 }),
      onComplete: function () { rises.forEach(done); }
    });
    if (pops.length) A.animate(pops, {
      scale: [0.6, 1], opacity: [0, 1], duration: 680, ease: "outBack(1.7)",
      delay: A.stagger(70, { start: 60 }),
      onComplete: function () { pops.forEach(done); }
    });
  }

  /* strokes draw themselves on: only what is actually a stroke, so a filled
     ornament is not given a hairline it never had */
  function drawables(root) {
    return q("path, line, circle, rect, polyline, ellipse", root).filter(function (p) {
      var cs; try { cs = getComputedStyle(p); } catch (e) { return false; }
      if (!cs || cs.stroke === "none" || !cs.stroke) return false;
      var w = parseFloat(cs.strokeWidth); if (!(w > 0)) return false;
      try { if (p.getTotalLength && p.getTotalLength() < 6) return false; } catch (e) { return false; }
      return true;
    });
  }
  function draw(fig, delayEach) {
    if (!A || fig.__naDrawn) return; fig.__naDrawn = 1;
    var list = drawables(fig);
    if (!list.length) return;
    var d = A.createDrawable(list);
    A.animate(d, { draw: ["0 0", "0 1"], duration: 1200, ease: "inOutQuad", delay: A.stagger(delayEach || 80) });
  }

  function count(el) {
    if (!A || el.__naCounted) return; el.__naCounted = 1;
    var n = parseFloat(el.getAttribute("data-n")) || 0, o = { v: 0 };
    var whole = n % 1 === 0;
    A.animate(o, { v: n, duration: 1200, ease: "inOutQuad",
      onUpdate: function () { el.textContent = (whole ? Math.round(o.v) : +o.v.toFixed(1)).toLocaleString("en-US"); },
      onComplete: function () { el.textContent = (whole ? n : +n.toFixed(1)).toLocaleString("en-US"); } });
  }

  function floats(root) {
    if (!A) return;
    q(".mo-float", root).forEach(function (el, i) {
      if (el.__naFloat || inNever(el)) return; el.__naFloat = 1;
      A.animate(el, { translateY: [0, -7], duration: 2600 + (i % 3) * 700, ease: "inOutSine",
        loop: true, alternate: true, delay: i * 350 });
    });
  }

  /* ---------------------------------------------------------------
     NOOR_MO.animate(root): a modal, a tab, a panel that just appeared
  --------------------------------------------------------------- */
  function animateNow(root) {
    root = root || document;
    if (!A || !root.querySelectorAll) return null;
    var rises = q(".mo", root), pops = q(".mo-pop", root);
    var tl = A.createTimeline({ defaults: { ease: "outCubic" } });
    if (rises.length) tl.add(rises, { translateY: [22, 0], opacity: [0, 1], duration: 650, delay: A.stagger(80) }, 0);
    if (pops.length) tl.add(pops, { scale: [0.55, 1], opacity: [0, 1], duration: 700, ease: "outBack(1.9)", delay: A.stagger(90) }, 100);
    q(".mo-draw", root).forEach(function (fig) { fig.__naDrawn = 0; draw(fig, 100); });
    q(".mo-count[data-n]", root).forEach(function (el) { el.__naCounted = 0; count(el); });
    floats(root);
    return tl;
  }

  /* ---------------------------------------------------------------
     the fold: an observer that releases in batches, so a row of cards
     cascades instead of popping one at a time
  --------------------------------------------------------------- */
  var batch = [], batchTimer = 0;
  function flush() {
    batchTimer = 0;
    var els = batch.slice(); batch = [];
    /* whatever is already above the fold when it is noticed is simply there:
       a card fading in above the reader's eye reads as a glitch */
    var vh = window.innerHeight || 800;
    var arriving = [], already = [];
    els.forEach(function (el) { (el.getBoundingClientRect().top > 0 ? arriving : already).push(el); });
    release(already, false);
    release(arriving, true);
  }
  function watch(el) {
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          batch.push(en.target);
        });
        if (batch.length && !batchTimer) batchTimer = setTimeout(flush, 40);
      }, { rootMargin: "0px 0px -10% 0px", threshold: 0.01 });
    }
    io.observe(el);
  }
  function register(el, kind) {
    if (el.__na || inNever(el)) return;
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || 800;
    /* in view already, or above: never held. Only what is below the fold
       is asked to arrive. */
    if (r.top < vh * 0.92) return;
    hold(el, kind);
    watch(el);
  }

  var drawSeen = null;
  function watchDraw(fig) {
    if (fig.__naDrawQ || inNever(fig)) return; fig.__naDrawQ = 1;
    if (!drawSeen) drawSeen = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { drawSeen.unobserve(en.target); draw(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    drawSeen.observe(fig);
  }
  var countSeen = null;
  function watchCount(el) {
    if (el.__naCountQ || inNever(el)) return; el.__naCountQ = 1;
    if (!countSeen) countSeen = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { countSeen.unobserve(en.target); count(en.target); } });
    }, { rootMargin: "0px 0px -6% 0px" });
    countSeen.observe(el);
  }

  /* ---------------------------------------------------------------
     what to move on this page
  --------------------------------------------------------------- */
  function scan(root) {
    root = root || document;
    /* the marked-up language first */
    q(".mo", root).forEach(function (el) { if (!el.closest("[data-mo-stagger]")) register(el, "rise"); });
    q(".mo-pop", root).forEach(function (el) { if (!el.closest("[data-mo-stagger]")) register(el, "pop"); });
    q("[data-mo-stagger]", root).forEach(function (wrap) {
      if (inNever(wrap)) return;
      q(".mo, .mo-pop", wrap).forEach(function (el) { register(el, el.classList.contains("mo-pop") ? "pop" : "rise"); });
    });
    q(".mo-draw", root).forEach(watchDraw);
    q(".mo-count[data-n]", root).forEach(watchCount);
    floats(root);
    /* then the unmarked page */
    q(REVEAL, root).forEach(function (el) {
      if (el.matches(MARKED) || el.closest(MARKED)) return;      /* already spoken for */
      if (el.closest(".dbody, .pc-body, .vpan, details")) return; /* inside something that opens */
      register(el, "rise");
    });
    q(DRAW, root).forEach(function (svg) {
      if (svg.closest(".mo-draw")) return;
      var fig = svg.closest(".fig, .orn, .seal") || svg;
      watchDraw(fig);
    });
  }

  /* ---------------------------------------------------------------
     the first thing the reader sees
     The opening line and the rule under it arrive together, once. This is
     the one place the page moves before the reader asks it to, so it is
     brief and it never runs where the room already has its own opening.
  --------------------------------------------------------------- */
  function arrival() {
    if (!A) return;
    var main = document.querySelector("main") || document.body;
    if (document.querySelector("#hero, .hero, .h2c")) return;        /* the landing page speaks for itself */
    var h1 = main.querySelector("h1");
    if (!h1 || inNever(h1) || h1.__na) return;
    var kick = main.querySelector(".kick, .eyebrow");
    var lede = main.querySelector(".lede, .lead");
    var rule = main.querySelector("hr, .rule");
    var seq = [kick, h1, lede].filter(function (el) { return el && !inNever(el); });
    seq.forEach(function (el) { el.__na = "arrival"; el.__naDone = 1; });
    var tl = A.createTimeline({ defaults: { ease: "outCubic" } });
    tl.add(seq, { translateY: [14, 0], opacity: [0, 1], duration: 620, delay: A.stagger(110),
      onComplete: function () { seq.forEach(function (el) { el.style.opacity = ""; el.style.transform = ""; }); } }, 0);
    if (rule && !inNever(rule)) {
      rule.style.transformOrigin = "left center";
      tl.add(rule, { scaleX: [0, 1], duration: 700, ease: "inOutQuad",
        onComplete: function () { rule.style.transform = ""; } }, 250);
    }
  }

  /* ---------------------------------------------------------------
     things that open while the reader is here
       details that toggle, panels that lose [hidden], a modal that gains
       .open, a verse that begins to sound
  --------------------------------------------------------------- */
  function opened(el, mode) {
    if (!A || !el) return;
    /* a modal and a verse are in the never list for the scroll layer, and
       are exactly what this layer is for */
    if (mode === "panel" && inNever(el) && !el.closest(".ayah")) return;
    if (mode === "panel") {
      /* opacity only: a panel inside a verse must not move the verse */
      A.animate(el, { opacity: [0, 1], duration: 420, ease: "outQuad",
        onComplete: function () { el.style.opacity = ""; } });
      var kids = q(":scope > *", el).slice(0, 8);
      if (kids.length && !el.closest(".ayah")) A.animate(kids, { translateY: [10, 0], duration: 460, ease: "outCubic",
        delay: A.stagger(45), onComplete: function () { kids.forEach(function (k) { k.style.transform = ""; }); } });
    }
    if (mode === "modal") {
      A.animate(el, { opacity: [0, 1], scale: [0.97, 1], duration: 380, ease: "outCubic",
        onComplete: function () { el.style.opacity = ""; el.style.transform = ""; } });
    }
    if (mode === "verse") {
      A.animate(el, { boxShadow: ["0 0 0 0 rgba(201,162,39,0)", "0 0 0 6px rgba(201,162,39,.16)", "0 0 0 0 rgba(201,162,39,0)"],
        duration: 1500, ease: "outSine", onComplete: function () { el.style.boxShadow = ""; } });
    }
  }
  function listen() {
    document.addEventListener("toggle", function (e) {
      var d = e.target;
      if (!d || d.tagName !== "DETAILS" || !d.open) return;
      var body = d.querySelector(":scope > :not(summary)");
      if (body) opened(body, "panel");
    }, true);
    if (!window.MutationObserver) return;
    var mo = new MutationObserver(function (muts) {
      var fresh = false;
      muts.forEach(function (m) {
        if (m.type === "attributes") {
          var t = m.target;
          if (m.attributeName === "hidden" && !t.hidden && t.matches(".vpan, .dbody, .panel, [data-anime-panel]")) opened(t, "panel");
          if (m.attributeName === "class") {
            if (t.classList.contains("ayah") && t.classList.contains("playing") && !/playing/.test(m.oldValue || "")) opened(t, "verse");
            if (t.classList.contains("open") && !/\bopen\b/.test(m.oldValue || "") && t.id === "modal-backdrop") {
              var panel = t.firstElementChild; if (panel) opened(panel, "modal");
            }
          }
        } else if (m.type === "childList" && m.addedNodes.length) fresh = true;
      });
      if (fresh) scheduleScan();
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeOldValue: true,
      attributeFilter: ["hidden", "class"] });
  }
  var scanTimer = 0;
  function scheduleScan() { if (!scanTimer) scanTimer = setTimeout(function () { scanTimer = 0; scan(document); }, 120); }

  /* ---------------------------------------------------------------
     the reader is the authority: failsafes, all of them
  --------------------------------------------------------------- */
  function releaseAll() {
    var held = pending.filter(function (el) { return !el.__naDone; });
    release(held, false);
    pending = [];
  }
  function sweep() {
    var vh = window.innerHeight || 800, still = [], hit = [];
    pending.forEach(function (el) {
      if (el.__naDone) return;
      var r = el.getBoundingClientRect();
      if (r.top < vh * 1.05) hit.push(el); else still.push(el);
    });
    pending = still;
    if (hit.length) { var arriving = hit.filter(function (el) { return el.getBoundingClientRect().top > 0; });
      release(hit.filter(function (el) { return arriving.indexOf(el) < 0; }), false); release(arriving, true); }
  }
  var ticking = false;
  function onScroll() { if (ticking) return; ticking = true; (window.requestAnimationFrame || setTimeout)(function () { ticking = false; sweep(); }); }

  function boot() {
    A = window.anime;
    if (!A || !A.animate) return;
    window.NOOR_MO = { animate: animateNow, scan: scan, engine: "anime", version: A.version };
    scan(document);
    arrival();
    listen();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    addEventListener("beforeprint", releaseAll);
    try { var pm = window.matchMedia("print"); if (pm && pm.addListener) pm.addListener(function (m) { if (m.matches) releaseAll(); }); } catch (e) {}
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) document.fonts.ready.then(function () { setTimeout(sweep, 120); });
    setTimeout(sweep, 600);
    setTimeout(releaseAll, 8000);            /* after eight seconds nothing stays hidden, ever */
  }

  function load() {
    if (window.anime && window.anime.animate) return boot();
    var s = document.createElement("script");
    s.src = LIB; s.async = true;
    s.onload = boot;
    s.onerror = function () { /* the page is already correct without it */ };
    document.head.appendChild(s);
  }

  function go() {
    var why = denied();
    if (why) { window.NOOR_MO = window.NOOR_MO || { animate: function () { return null; }, engine: "still", why: why }; return; }
    /* is there anything at all to move? A room renders most of itself after
       this runs, so the presence of a main or a heading is enough to ask
       for the library; the observer picks up whatever arrives later. */
    if (!document.querySelector("main, h1, " + MARKED + ", " + REVEAL + ", " + DRAW)) return;
    if (window.requestIdleCallback) requestIdleCallback(load, { timeout: 1800 });
    else setTimeout(load, 300);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true });
  else go();
})();
