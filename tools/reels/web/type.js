/* NOOR reel · the type layer, animated with the same anime.js build the site
   uses (assets/anime.min.js, v4.5.0, custom NOOR build).

   The reel is rendered a frame at a time by a headless browser, so the
   timeline never plays: it is built paused and seeked to an exact millisecond
   for every frame. That is why nothing here uses requestAnimationFrame.

   The first second is where a reel lives or dies, so it gets the most work:
   a bloom opens, a streak of light crosses the frame, the mark draws itself,
   and the claim arrives word by word out of blur, with the phrase that carries
   the surprise turning gold and underlining itself as it lands. */
(function () {
  "use strict";
  var A = window.anime;
  var SAFE_T = 270, SAFE_B = 1500;
  var HOOK_SIZES = [78, 72, 66, 60, 56, 52, 48];
  /* the body has a legibility floor: on a phone, 36px of a 1080px frame is
     about the size Instagram sets its own caption at, and below that the
     substance stops being read. So the hook gives way first, and only if no
     hook size at all can house a 36px body does the body drop further. */
  var BODY_SIZES = [44, 42, 40, 38, 36];
  var BODY_TIGHT = [34, 32];

  var el = function (id) { return document.getElementById(id); };
  var T = null, INFO = null, FIT = null, SECS = 0;

  function letters(node, text, cls) {
    node.textContent = "";
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement("span");
      s.textContent = text[i];
      if (cls) s.className = cls;
      node.appendChild(s);
    }
    return node.querySelectorAll("span");
  }

  /* the hook is split into words so it can arrive as speech does, and the key
     phrase is marked so it can be coloured and underlined on its own */
  function splitHook(text, key) {
    var hook = el("hook");
    hook.textContent = "";
    var keyWords = [];
    if (key) {
      var i = text.toLowerCase().indexOf(key.toLowerCase());
      if (i >= 0) keyWords = text.slice(i, i + key.length).split(/\s+/);
    }
    var need = keyWords.slice();
    var words = text.split(/\s+/);
    words.forEach(function (w, i) {
      var s = document.createElement("span");
      s.className = "w";
      s.textContent = w;
      if (need.length && w.replace(/[^\w'’-]/g, "") ===
          need[0].replace(/[^\w'’-]/g, "")) {
        s.classList.add("key"); need.shift();
      }
      hook.appendChild(s);
      if (i < words.length - 1) hook.appendChild(document.createTextNode(" "));
    });
    return hook.querySelectorAll(".w");
  }

  function fit(card) {
    var hook = el("hook"), body = el("body"), col = el("col");
    var avail = SAFE_B - SAFE_T - 46;   // descenders, and the rise a block
                                        // still has to travel when it arrives
    function tryPass(sizes, tight) {
      for (var a = 0; a < HOOK_SIZES.length; a++) {
        hook.style.fontSize = HOOK_SIZES[a] + "px";
        var lines = Math.round(hook.getBoundingClientRect().height /
                               (HOOK_SIZES[a] * 1.17));
        if (lines > 4) continue;
        for (var b = 0; b < sizes.length; b++) {
          var bs = sizes[b];
          body.querySelectorAll(".blk div").forEach(function (d) {
            d.style.fontSize = bs + "px";
            d.style.lineHeight = Math.round(bs * 1.34) + "px";
          });
          if (col.getBoundingClientRect().height <= avail)
            return { hook: HOOK_SIZES[a], body: bs, lines: lines,
                     fits: true, tight: !!tight };
        }
      }
      return null;
    }
    return tryPass(BODY_SIZES, false) || tryPass(BODY_TIGHT, true) ||
           { hook: 48, body: 32, lines: 99, fits: false, tight: true };
  }

  function applyBody(px) {
    el("body").querySelectorAll(".blk div").forEach(function (d) {
      d.style.fontSize = px + "px";
      d.style.lineHeight = Math.round(px * 1.34) + "px";
    });
  }

  /* The coarse fit measures the column while it is being built, and that is
     not the same column that renders: with the timeline in place the resting
     layout came out eighty pixels taller. So the last word belongs to a
     measurement taken with everything at rest, driven from outside and checked
     against the rendered pixels rather than trusted. */
  function rest() {
    T.seek(SECS * 1000);
    var b = el("close").getBoundingClientRect().bottom;
    T.seek(0);
    return b;
  }

  function shrink() {
    var f = FIT;
    if (f.body > 30) { f.body -= 2; applyBody(f.body); f.tight = f.body < 36; }
    else if (f.hook > 44) {
      f.hook -= 4; el("hook").style.fontSize = f.hook + "px"; f.tight = true;
    } else { f.fits = false; return false; }
    underline();
    INFO.hookPx = f.hook; INFO.bodyPx = f.body;
    INFO.tight = !!f.tight; INFO.fits = f.fits;
    return true;
  }

  /* the gold rule under the surprise, measured once the type has settled */
  function underline() {
    var keys = el("hook").querySelectorAll(".w.key");
    var u = el("uline");
    if (!keys.length) { u.style.display = "none"; return; }
    var col = el("col").getBoundingClientRect();
    var last = keys[keys.length - 1].getBoundingClientRect();
    var l = last.left, r = last.right, t = last.bottom;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i].getBoundingClientRect();
      if (Math.abs(k.bottom - t) < 6) { l = Math.min(l, k.left); r = Math.max(r, k.right); }
    }
    u.style.left = (l - col.left) + "px";
    u.style.top = (t - col.top - 8) + "px";
    u.style.width = (r - l) + "px";
  }

  window.NOORREEL = {
    build: function (card, secs) {
      el("cat").textContent = (card.eyebrow || "").toUpperCase();
      letters(el("brand"), "NOOR");
      var words = splitHook(card.hook, card.key);
      var dsp = letters(el("date"), (card.date || "").toUpperCase());

      var body = el("body");
      body.textContent = "";
      (card.lines || []).forEach(function (line) {
        var blk = document.createElement("div");
        blk.className = "blk";
        var d = document.createElement("div");
        d.textContent = line;
        blk.appendChild(d);
        body.appendChild(blk);
      });
      var blocks = body.querySelectorAll(".blk");

      var f = fit(card);

      /* --- when everything happens, in seconds --- */
      var n = words.length;
      var HK_START = 0.18, HK_STEP = Math.min(0.062, Math.max(0.030, 0.62 / n));
      var hookEnd = HK_START + (n - 1) * HK_STEP + 0.52;
      var tDate = Math.max(hookEnd + 0.18, 1.25);
      var tBody = tDate + 1.15;
      var tClose = secs - 3.2;
      var step = Math.max(2.1, (tClose - tBody - 0.6) / Math.max(1, blocks.length));
      var ms = function (s) { return Math.round(s * 1000); };

      var tl = A.createTimeline({ autoplay: false, defaults: { ease: "outCubic" } });

      /* the opening: a bloom, a streak, the mark */
      tl.add("#flare", { opacity: [0, .70, 0], scale: [.25, 1.30],
                         duration: 780, ease: "outQuad" }, 0);
      tl.add("#streak", { opacity: [0, 1, 0], top: ["18%", "34%"],
                          scaleX: [.2, 1], duration: 620, ease: "outQuint" }, 40);
      tl.add(".mrule", { scaleX: [0, 1], duration: 460 }, 120);
      tl.add("#brand span", { opacity: [0, 1], translateY: [14, 0],
                              duration: 380, delay: A.stagger(38) }, 200);
      tl.add(".mdiv", { opacity: [0, .55], scaleY: [0, 1], duration: 320 }, 420);
      tl.add("#cat", { opacity: [0, 1], translateX: [-10, 0], duration: 420 }, 470);

      /* the claim, word by word, out of blur */
      tl.add("#hook .w", {
        opacity: [0, 1], translateY: [42, 0], scale: [1.03, 1],
        "--b": ["8px", "0px"],
        duration: 520, delay: A.stagger(ms(HK_STEP))
      }, ms(HK_START));

      /* the surprise turns gold, then underlines itself */
      if (el("hook").querySelector(".w.key")) {
        tl.add("#hook .w.key", { color: ["#FFF9E3", "#E9C86A"], duration: 420 },
               ms(hookEnd - 0.30));
        tl.add("#uline", { scaleX: [0, 1], duration: 560, ease: "outExpo" },
               ms(hookEnd - 0.12));
      }

      /* where and when */
      tl.add(".drule", { scaleX: [0, 1], duration: 620 }, ms(tDate));
      tl.add("#date span", { opacity: [0, 1], translateY: [8, 0],
                             duration: 280, delay: A.stagger(9) }, ms(tDate + 0.18));

      /* the substance, one block at a time, the earlier ones stepping back */
      blocks.forEach(function (blk, i) {
        var at = tBody + i * step;
        tl.add(blk, { opacity: [0, 1], translateY: [18, 0], "--b": ["6px", "0px"],
                      duration: 640 }, ms(at));
        for (var j = 0; j < i; j++)
          tl.add(blocks[j], { opacity: 1 - Math.min(.52, .26 * (i - j)),
                              duration: 520 }, ms(at));
      });

      /* the way home */
      tl.add("#close", { opacity: [0, 1], translateY: [18, 0], duration: 620 },
             ms(tClose));

      tl.pause();
      T = tl;
      SECS = secs;
      FIT = f;
      underline();
      INFO = { fits: f.fits, tight: !!f.tight, hookPx: f.hook, bodyPx: f.body, lines: f.lines,
               tDate: tDate, tBody: tBody, tClose: tClose, step: step,
               hookEnd: hookEnd, height: el("col").getBoundingClientRect().height };
      tl.seek(0);
      return INFO;
    },
    seek: function (t) { T.seek(Math.max(0, t * 1000)); },
    rest: rest,
    shrink: shrink,
    /* the opening bloom and streak are light, not information: the safe area
       audit measures the words, so it turns them off first */
    decor: function (on) {
      var v = on ? "" : "none";
      el("flare").style.display = v; el("streak").style.display = v;
    },
    info: function () { return INFO; }
  };
})();
