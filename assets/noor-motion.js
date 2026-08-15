/* ============================================================
   NOOR Motion · the house motion language, built on GSAP 3.15
   ------------------------------------------------------------
   Satisfying physics, reduced-motion safe, resilient by design:
   nothing is hidden until JS is alive, so a failed script never
   hides content. Pages opt in with small classes:

     .mo          rise + fade in when scrolled into view
     .mo-pop      spring pop (back.out) for icons, tiles, marks
     .mo-draw     SVG strokes inside draw themselves on
     .mo-float    gentle endless float (ambient, decorative)
     .mo-count    counts data-n upward when seen
     [data-mo-stagger]  parent whose .mo children cascade

   For dialogs and modals (not scroll-revealed):
     NOOR_MO.animate(rootElement)  plays everything inside now.
   ============================================================ */
(function () {
  "use strict";
  if (!window.gsap) return;
  var g = window.gsap;
  if (window.ScrollTrigger) g.registerPlugin(window.ScrollTrigger);
  if (window.DrawSVGPlugin) g.registerPlugin(window.DrawSVGPlugin);

  var REDUCE = false;
  try { REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  g.defaults({ duration: 0.7, ease: "power2.out" });

  var D = REDUCE ? 0.01 : 1; /* global duration scale */

  function drawTargets(root) {
    return (root || document).querySelectorAll(".mo-draw path, .mo-draw line, .mo-draw circle, .mo-draw rect, .mo-draw polyline, .mo-draw ellipse");
  }

  /* Play every motion element inside a root, immediately (modals, tabs). */
  function animate(root, opts) {
    root = root || document;
    opts = opts || {};
    var tl = g.timeline({ defaults: { ease: "power3.out" } });
    var rises = root.querySelectorAll ? root.querySelectorAll(".mo") : [];
    var pops = root.querySelectorAll ? root.querySelectorAll(".mo-pop") : [];
    var draws = drawTargets(root);
    if (rises.length) tl.fromTo(rises, { y: REDUCE ? 0 : 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.65 * D, stagger: 0.08 * D }, 0);
    if (pops.length) tl.fromTo(pops, { scale: REDUCE ? 1 : 0.55, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7 * D, ease: "back.out(1.9)", stagger: 0.09 * D }, 0.1 * D);
    if (draws.length) {
      if (window.DrawSVGPlugin) {
        tl.fromTo(draws, { drawSVG: REDUCE ? "0% 100%" : "0%" }, { drawSVG: "0% 100%", duration: 1.1 * D, ease: "power2.inOut", stagger: 0.1 * D }, 0.15 * D);
      } else {
        draws.forEach(function (p, i) {
          var len = 0; try { len = p.getTotalLength ? p.getTotalLength() : 0; } catch (e) {}
          if (!len) return;
          tl.fromTo(p, { strokeDasharray: len, strokeDashoffset: REDUCE ? 0 : len }, { strokeDashoffset: 0, duration: 1.1 * D, ease: "power2.inOut" }, (0.15 + i * 0.1) * D);
        });
      }
    }
    /* counters */
    var counts = root.querySelectorAll ? root.querySelectorAll(".mo-count[data-n]") : [];
    counts.forEach(function (el) {
      var n = parseFloat(el.getAttribute("data-n")) || 0;
      var o = { v: 0 };
      tl.to(o, { v: n, duration: 1.2 * D, ease: "power1.inOut", onUpdate: function () { el.textContent = (n % 1 === 0 ? Math.round(o.v) : o.v.toFixed(1)).toLocaleString ? Number(n % 1 === 0 ? Math.round(o.v) : o.v.toFixed(1)).toLocaleString("en-US") : String(Math.round(o.v)); } }, 0.2 * D);
    });
    /* floats loop forever, outside the timeline */
    floats(root);
    return tl;
  }

  function floats(root) {
    if (REDUCE) return;
    (root || document).querySelectorAll(".mo-float").forEach(function (el, i) {
      if (el.__moFloat) return; el.__moFloat = 1;
      g.to(el, { y: "-=7", duration: 2.6 + (i % 3) * 0.7, ease: "sine.inOut", yoyo: true, repeat: -1, delay: i * 0.35 });
    });
  }

  /* Scroll reveals: batched, resilient (elements start visible; we hide
     then reveal only when JS is definitely running).

     Held with opacity, never with visibility. GSAP's autoAlpha adds
     visibility:hidden, which takes an element out of the selection and out of
     the accessibility tree as well as out of sight, so a reader who selected
     the whole dictionary and copied it got bare bullets for every part of the
     page they had not scrolled past. Words the eye has not reached yet are
     still words. pointerEvents keeps an unseen card from being clicked. */
  function initScroll() {
    if (!window.ScrollTrigger) { floats(document); return; }
    var singles = [].slice.call(document.querySelectorAll(".mo")).filter(function (el) { return !el.closest("[data-mo-stagger]") && !el.closest("dialog") && !el.closest(".encx"); });
    var pops = [].slice.call(document.querySelectorAll(".mo-pop")).filter(function (el) { return !el.closest("[data-mo-stagger]") && !el.closest("dialog") && !el.closest(".encx"); });
    if (singles.length) {
      g.set(singles, { y: REDUCE ? 0 : 24, opacity: 0, pointerEvents: "none" });
      ScrollTrigger.batch(singles, {
        start: "top 88%", once: true,
        onEnter: function (els) { g.to(els, { y: 0, opacity: 1, pointerEvents: "auto", duration: 0.75 * D, ease: "power3.out", stagger: 0.09 * D, overwrite: true }); }
      });
    }
    if (pops.length) {
      g.set(pops, { scale: REDUCE ? 1 : 0.6, opacity: 0, pointerEvents: "none" });
      ScrollTrigger.batch(pops, {
        start: "top 88%", once: true,
        onEnter: function (els) { g.to(els, { scale: 1, opacity: 1, pointerEvents: "auto", duration: 0.7 * D, ease: "back.out(1.8)", stagger: 0.08 * D, overwrite: true }); }
      });
    }
    document.querySelectorAll("[data-mo-stagger]").forEach(function (wrap) {
      if (wrap.closest("dialog") || wrap.closest(".encx")) return;
      var kids = wrap.querySelectorAll(".mo, .mo-pop");
      if (!kids.length) return;
      g.set(kids, { y: REDUCE ? 0 : 20, opacity: 0, pointerEvents: "none" });
      ScrollTrigger.create({
        trigger: wrap, start: "top 85%", once: true,
        onEnter: function () { g.to(kids, { y: 0, opacity: 1, pointerEvents: "auto", duration: 0.7 * D, ease: "power3.out", stagger: { each: 0.07 * D, from: "start" }, overwrite: true }); }
      });
    });
    /* standalone draw figures revealed on scroll */
    document.querySelectorAll(".mo-draw").forEach(function (fig) {
      if (fig.closest("dialog") || fig.closest(".encx")) return;
      ScrollTrigger.create({
        trigger: fig, start: "top 85%", once: true,
        onEnter: function () { animateDraw(fig); }
      });
    });
    document.querySelectorAll(".mo-count[data-n]").forEach(function (el) {
      if (el.closest("dialog") || el.closest(".encx")) return;
      ScrollTrigger.create({
        trigger: el, start: "top 90%", once: true,
        onEnter: function () {
          var n = parseFloat(el.getAttribute("data-n")) || 0, o = { v: 0 };
          g.to(o, { v: n, duration: 1.2 * D, ease: "power1.inOut", onUpdate: function () { el.textContent = Number(Math.round(o.v)).toLocaleString("en-US"); } });
        }
      });
    });
    floats(document);
  }

  function animateDraw(fig) {
    var paths = drawTargets(fig.parentNode ? fig : document);
    var inside = fig.querySelectorAll("path, line, circle, rect, polyline, ellipse");
    var list = inside.length ? inside : paths;
    var tl = g.timeline();
    if (window.DrawSVGPlugin) {
      tl.fromTo(list, { drawSVG: REDUCE ? "0% 100%" : "0%" }, { drawSVG: "0% 100%", duration: 1.2 * D, ease: "power2.inOut", stagger: 0.08 * D });
    } else {
      [].forEach.call(list, function (p, i) {
        var len = 0; try { len = p.getTotalLength ? p.getTotalLength() : 0; } catch (e) {}
        if (!len) return;
        tl.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.2 * D, ease: "power2.inOut" }, i * 0.08 * D);
      });
    }
    return tl;
  }

  /* ---- failsafe ----------------------------------------------------
     Nothing this layer touches may ever stay invisible. If a trigger
     never fires (stale positions after fonts or images load, a layout
     shift, an oddity in an old browser), reveal it anyway. Content
     always wins over choreography. */
  function revealAll(reason) {
    var hidden = document.querySelectorAll(".mo, .mo-pop");
    var fixed = 0;
    for (var i = 0; i < hidden.length; i++) {
      var el = hidden[i], cs = window.getComputedStyle(el);
      if (parseFloat(cs.opacity) < 0.99 || cs.visibility === "hidden") {
        g.set(el, { autoAlpha: 1, opacity: 1, pointerEvents: "auto", y: 0, scale: 1, clearProps: "transform" });
        fixed++;
      }
    }
    return fixed;
  }
  function guard() {
    if (window.ScrollTrigger) { try { ScrollTrigger.refresh(); } catch (e) {} }
    /* anything already inside or above the fold must be visible now */
    document.querySelectorAll(".mo, .mo-pop").forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 1.1) {
        var cs = window.getComputedStyle(el);
        if (parseFloat(cs.opacity) < 0.99 || cs.visibility === "hidden") {
          g.to(el, { autoAlpha: 1, opacity: 1, pointerEvents: "auto", y: 0, scale: 1, duration: 0.4 * D, overwrite: true });
        }
      }
    });
  }
  /* paper: whatever the choreography is still holding, let it go before the
     print engine takes its snapshot. */
  function beforePrint() { try { revealAll("print"); } catch (e) {} }
  addEventListener("beforeprint", beforePrint);
  try {
    var mq = window.matchMedia("print");
    if (mq && mq.addListener) mq.addListener(function (m) { if (m.matches) beforePrint(); });
  } catch (e) {}

  addEventListener("load", function () {
    guard();
    setTimeout(guard, 600);
    /* last resort: after eight seconds nothing stays hidden, ever */
    setTimeout(function () { revealAll("failsafe"); }, 8000);
  });
  /* fonts change metrics, which moves every trigger */
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(function () { setTimeout(guard, 120); });
  }

  /* ---- lazily sized pages -------------------------------------------
     ScrollTrigger measures the whole document once and remembers where
     every trigger sits. The dictionary breaks that promise: its 523
     entries carry content-visibility:auto, so the browser renders them
     only as they approach the fold and guesses the rest at 118px each.
     The page therefore grows by thousands of pixels WHILE you scroll,
     and every trigger below the list is pointing at a page that no
     longer exists. That is why the three plates and the closing cards
     at the foot of the dictionary stayed hidden until the eight second
     failsafe caught them, and why their text would not even copy:
     visibility:hidden takes an element out of the selection too.

     So watch the height and re-measure when it settles. A page whose
     height is stable never pays for this. */
  /* ---- the reader is the authority --------------------------------
     ScrollTrigger decides when to reveal from positions it measured once.
     On a page that grows underneath it, those positions are fiction, and
     the dictionary is exactly that page. So do not argue with it: watch
     the scroll directly and release anything the reader has actually
     reached. The list only ever shrinks, and the listener retires itself
     when nothing is left waiting, so a settled page costs nothing. */
  function sweeper() {
    var pending = [].slice.call(document.querySelectorAll(".mo, .mo-pop"));
    if (!pending.length) return;
    var ticking = false;
    function sweep() {
      ticking = false;
      var vh = window.innerHeight || 800, still = [];
      for (var i = 0; i < pending.length; i++) {
        var el = pending[i], r = el.getBoundingClientRect();
        if (r.top < vh * 1.05) {
          var cs = window.getComputedStyle(el);
          if (parseFloat(cs.opacity) < 0.99 || cs.visibility === "hidden") {
            /* Something the reader has already scrolled past should simply be
               there. Only what is arriving at the fold is worth animating: a
               card fading in above the fold reads as a glitch, not a flourish. */
            var arriving = r.top > 0;
            g.to(el, { autoAlpha: 1, opacity: 1, pointerEvents: "auto", y: 0, scale: 1,
                       duration: arriving ? 0.45 * D : 0, overwrite: true });
          }
        } else {
          still.push(el);          /* still below the fold, ask again later */
        }
      }
      pending = still;
      if (!pending.length) removeEventListener("scroll", onScroll);
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      (window.requestAnimationFrame || function (f) { setTimeout(f, 16); })(sweep);
    }
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    sweep();
  }

  function watchHeight() {
    if (!window.ScrollTrigger || !window.ResizeObserver) return;
    var last = document.documentElement.scrollHeight, timer = null, runs = 0, ro;
    function settle() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        /* guard() re-measures AND reveals anything already in view, which is
           what a jump to the foot of the page needs: after a long scroll the
           trigger for a plate has not been crossed, it has been leapt over,
           and a crossing that never happened will not fire on its own. */
        try { guard(); } catch (e) {}
        /* a page that never stops moving is not worth chasing forever */
        if (++runs > 40 && ro) ro.disconnect();
      }, 220);
    }
    try {
      ro = new ResizeObserver(function () {
        var h = document.documentElement.scrollHeight;
        if (Math.abs(h - last) < 40) return;   /* ignore ordinary reflow noise */
        last = h;
        settle();
      });
      ro.observe(document.body);
    } catch (e) {}
  }

  window.NOOR_MO = { animate: animate, draw: animateDraw, floats: floats, revealAll: revealAll, reduce: REDUCE, gsap: g };
  function boot() { initScroll(); watchHeight(); sweeper(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
