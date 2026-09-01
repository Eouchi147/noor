/* NOOR · the console dial
   ===========================================================================
   The owner asked for the dial back, "better, faster, stronger". It is a ring
   of the console's own tabs, turned with a drag, a wheel, the arrow keys or a
   tap, and it drives the tabs that were already there rather than replacing
   them: the list down the left keeps working, the keyboard shortcuts keep
   working, and with this file missing the console is exactly what it was.

   WHAT WAS LEARNED THE HARD WAY, AND IS BUILT IN HERE FROM THE START

   1 · pointerdown captures the pointer to the stage, so on pointerup the ball
       is NEVER the event target. The public dial shipped with its one action
       dead because of it. The ball under the press is remembered.
   2 · the ring has to be fitted to the space that is actually free, measured,
       and nothing may be allowed to overlap anything.
   3 · a big blurred box-shadow on a promoted layer rasterises to the layer
       box and draws a visible SQUARE. The glow is a round gradient.
   4 · balls evenly spaced in angle bunch at the ends of the long axis, and the
       perspective magnifies the near half. The fit checks the closest pair.
   =========================================================================== */
(function () {
  "use strict";
  var host = document.getElementById("cdial");
  if (!host) return;
  var tabs = [].slice.call(document.querySelectorAll(".tab[data-pane]"));
  if (tabs.length < 3) return;

  var REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COARSE = matchMedia("(pointer: coarse)").matches;
  var N = tabs.length, TAU = Math.PI * 2;

  /* A tab carries more than its name: the keyboard shortcut and, on the inbox,
     an unread badge. textContent swept both in and the dial read "Pulsealt1"
     and "Inbox0alt2". Only the tab's own words are taken. */
  function labelOf(t) {
    var c = t.cloneNode(true);
    [].slice.call(c.querySelectorAll(".kbd,.badge,[data-ic]")).forEach(function (x) { x.remove(); });
    return (c.textContent || "").replace(/\s+/g, " ").trim();
  }
  var items = tabs.map(function (t) {
    return { pane: t.dataset.pane, label: labelOf(t), tab: t };
  });

  host.innerHTML = '<div class="cd-stage" id="cd-stage"><div class="cd-rig" id="cd-rig"></div>'
    + '<div class="cd-hub" id="cd-hub"></div></div>';
  var stage = document.getElementById("cd-stage"), rig = document.getElementById("cd-rig"),
      hub = document.getElementById("cd-hub");

  rig.innerHTML = items.map(function (it, i) {
    return '<button class="cd-node" type="button" data-i="' + i + '" tabindex="-1" '
      + 'aria-label="' + it.label.replace(/"/g, "&quot;") + '"><span>' + it.label + '</span></button>';
  }).join("");
  var nodes = [].slice.call(rig.children);

  /* ---- geometry -----------------------------------------------------------
     NOT A RING. A ring of twelve cannot fit a wide, short strip and there is no
     tuning of the numbers that makes it: points spaced evenly in angle bunch at
     the ends of the long axis, so twelve of them need a radius of about 280px
     and therefore 600px of height. The console does not have 600px to give to
     its own navigation.

     So the sections sit on a shallow ARC instead — a tuning dial, which is what
     the word means anyway. The arc is wider than the panel and only the part of
     it inside the panel is lit; sections ride along it, the one in the middle is
     the largest and the ones at the edges fade out. It holds twelve as happily
     as it would hold thirty, and it cannot pile, because the spacing along the
     arc is set before anything is drawn rather than discovered afterwards.
  ------------------------------------------------------------------------- */
  var ND = 0, RA = 0, PITCH = 0, HALF = 0;

  function metrics() {
    var box = host.getBoundingClientRect();
    /* the dashboard is hidden until the owner is through the gate, so the first
       measurement is of a box with no size: not "too tight", just not laid out */
    if (box.width < 40 || box.height < 40) return false;
    var W = box.width, H = box.height;

    /* Work out where the sections will actually land, rather than estimating the
       dip and hoping. Every seat on the arc is walked, given the size layout()
       will give it, and the true top and bottom of the sweep come out of that.
       The arc is then lifted so the middle of what is drawn is the middle of the
       panel, and if it is too tall the sections shrink until it is not. */
    /* the caption under the arc gets a band of its own, and the arc is centred
       in what is left rather than in the whole panel */
    var capH = Math.max(34, Math.min(56, H * .2));
    var arcH = H - capH - 10;
    for (var nd = Math.max(48, Math.min(108, Math.min(arcH * .62, W / 8))); ; nd *= .92) {
      var spacing = nd * 1.24;               /* centre to centre along the arc */
      var half = Math.max(2, Math.ceil((W / 2 + nd) / spacing));
      /* How much the arc is allowed to dip, and therefore how big its radius has
         to be. Fixing the radius and shrinking the sections until the dip fitted
         was backwards: it left the dial with tiny circles whose labels broke
         across three lines. The curve gives way instead of the type. */
      var reach = half * spacing;
      var dipBudget = Math.max(18, arcH - nd * 1.12 - 8);
      var ra = Math.max(W * 1.15, (reach * reach) / (2 * dipBudget));
      var pitch = spacing / ra;
      var top = 1e9, bot = -1e9;
      for (var d = -half; d <= half; d++) {
        var y = ra - Math.cos(d * pitch) * ra;
        var f = Math.min(1, Math.abs(d) / half);
        var rad = nd * .5 * (1.06 - f * .34);
        if (y - rad < top) top = y - rad;
        if (y + rad > bot) bot = y + rad;
      }
      if (bot - top <= arcH || nd <= 42) {
        ND = Math.max(42, nd); RA = ra; PITCH = pitch; HALF = half;
        /* The rig sits at the panel's centre and the arc hangs below it, so the
           lift is worked out from the panel's TOP: put the highest thing drawn
           a few pixels under the top edge, and the caption below the band. */
        /* The sweep and its caption are one block, centred in the panel.

           An earlier version set the panel's height from what it had measured,
           and then measured that height on the next pass — so every resize made
           the band shorter, the sections smaller, and the labels break across
           three lines. The panel's height is the stylesheet's business; this
           only decides where the block sits inside it. */
        var sweep = bot - top;
        var blockTop = -(sweep + capH) / 2;
        rig.style.transform = "translateY(" + (blockTop - top).toFixed(1) + "px)";
        hub.style.transform = "translate(-50%,-50%) translateY("
          + (blockTop + sweep + capH / 2).toFixed(1) + "px)";
        host.style.setProperty("--cd", ND.toFixed(1) + "px");
        host.classList.remove("cd-tight");
        return true;
      }
    }
  }

  /* ---- the spring that turns it ---- */
  var th = 0, thV = 0, focus = 0, raf = 0, last = 0, running = false;
  var step = TAU / N;
  function nearest() { return Math.round(-th / step); }
  function frame(now) {
    var h = Math.min(.05, (now - last) / 1000 || .016); last = now;
    if (!drag) {
      var want = -nearest() * step;
      var err = want - th;
      /* damping rides on how fast it is going, so a flick settles instead of
         ringing, and the rest test is on amplitude rather than on error alone */
      var grip = 1 / (1 + Math.abs(thV) * 5.5);
      thV += (170 * err - (10 + 16 * grip) * thV) * h;
      th += thV * h;
      if (Math.hypot(err, thV / 13) < .0016) { th = want; thV = 0; }
    }
    layout();
    var f = ((nearest() % N) + N) % N;
    if (f !== focus) { focus = f; paintHub(); }
    if (running) raf = requestAnimationFrame(frame);
  }
  function layout() {
    /* `pos` is where the dial is standing, in sections. The item at pos sits at
       the crown of the arc; the others fall away either side of it. */
    var pos = -th / step;
    for (var i = 0; i < N; i++) {
      var n = nodes[i];
      /* the shortest way round, so section 0 and section 11 are neighbours */
      var d = i - pos;
      while (d > N / 2) d -= N;
      while (d < -N / 2) d += N;
      if (Math.abs(d) > HALF) { n.style.opacity = "0"; n.style.pointerEvents = "none";
        n.style.transform = "translate3d(-9999px,0,0)"; continue; }
      var t = d * PITCH;
      var x = Math.sin(t) * RA;
      /* measured down from the crown, so the section in the middle sits on the
         centre line and its neighbours dip away either side */
      var y = RA - Math.cos(t) * RA;
      var f = Math.min(1, Math.abs(d) / (HALF || 1));
      var s2 = 1.06 - f * .34;
      n.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) scale(" + s2.toFixed(3) + ")";
      n.style.opacity = (1 - f * .72).toFixed(3);
      n.style.pointerEvents = "auto";
      n.style.zIndex = String(1000 - Math.round(Math.abs(d) * 10));
      var on = Math.abs(d) < .5;
      n.classList.toggle("on", on);
      n.style.setProperty("--lit", on ? "1" : "0");
    }
  }

  function paintHub() {
    var it = items[focus]; if (!it) return;
    hub.textContent = it.label;
    host.setAttribute("aria-label", "Console sections — " + it.label);
  }
  function go(i) {
    var d = i - (((nearest() % N) + N) % N);
    if (d > N / 2) d -= N; if (d < -N / 2) d += N;
    th = -(nearest() + d) * step - 0;   /* land on it; the spring settles the rest */
    thV = 0; kick();
  }
  function open(i) { var it = items[i]; if (it && it.tab) it.tab.click(); }

  /* ---- pointer: the ball under the PRESS is the one that opens ---- */
  var drag = false, downEl = null, moved = 0, lastX = 0, vel = 0;
  stage.addEventListener("pointerdown", function (e) {
    stage.setPointerCapture(e.pointerId);
    drag = true; moved = 0; lastX = e.clientX; vel = 0; thV *= .3;
    downEl = e.target.closest ? e.target.closest(".cd-node") : null;
    kick();
  });
  stage.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx);
    th += dx * .006; thV = dx * .5; vel = dx;
  });
  stage.addEventListener("pointerup", function (e) {
    var tap = moved < 8;
    if (drag) { drag = false; thV += vel * .9; }
    if (!tap) { downEl = null; return; }
    var el = downEl;
    if (!el) { var u = document.elementFromPoint(e.clientX, e.clientY);
               el = u && u.closest ? u.closest(".cd-node") : null; }
    downEl = null;
    if (el && el.dataset.i != null) {
      var i = +el.dataset.i;
      if (i === focus) open(i); else go(i);
      kick();
    }
  });
  stage.addEventListener("pointercancel", function () { drag = false; downEl = null; });
  stage.addEventListener("wheel", function (e) {
    e.preventDefault();
    /* a ratchet, not a pump: one notch per gesture, however hard it is spun */
    var now = performance.now();
    if (now - (stage._wt || 0) < 220) return;
    stage._wt = now;
    go((((nearest() + (e.deltaY > 0 ? 1 : -1)) % N) + N) % N);
  }, { passive: false });

  host.addEventListener("keydown", function (e) {
    var f = ((nearest() % N) + N) % N;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); go((f + 1) % N); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go((f - 1 + N) % N); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(f); }
  });
  host.tabIndex = 0;
  host.setAttribute("role", "listbox");

  /* ---- run only while it can be seen: a console left open all day must not
          hold a rAF loop for a tab nobody is looking at ---- */
  function kick() {
    if (running) return;
    running = true; last = performance.now(); raf = requestAnimationFrame(frame);
    clearTimeout(host._idle);
    host._idle = setTimeout(function () {
      if (!drag && Math.abs(thV) < .002) { running = false; cancelAnimationFrame(raf); }
    }, 2600);
  }
  function rebuild() {
    if (!metrics()) return false;
    layout(); paintHub(); kick(); return true;
  }

  /* A ResizeObserver rather than a load-time measurement: the panel has no size
     until the dashboard is shown, and it changes size again whenever the window
     does. This is the only signal that is true in both cases. */
  if (window.ResizeObserver) new ResizeObserver(function () { rebuild(); }).observe(host);
  else addEventListener("resize", function () { rebuild(); }, { passive: true });

  /* and the loop only runs while the thing can be seen */
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) rebuild();
        else { running = false; cancelAnimationFrame(raf); }
      });
    }, { threshold: .05 }).observe(host);
  }

  /* follow the tabs when they are changed any other way */
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { if (i !== focus) { go(i); } });
  });

  /* The dashboard is hidden until the owner is through the gate, so at load the
     panel has no size and there is nothing to measure. A ResizeObserver should
     catch the moment it gains one — but it is the only thing that would, and if
     it does not fire the dial is simply never drawn. A short bounded poll costs
     nothing and removes that single point of failure entirely. */
  var tries = 0;
  (function settle() {
    if (rebuild()) return;
    if (++tries > 40) return;                 /* ~3s, then leave it to the observers */
    setTimeout(settle, 75);
  })();
  if (REDUCE) { running = false; cancelAnimationFrame(raf); }
})();
