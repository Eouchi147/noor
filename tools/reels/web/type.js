/* NOOR reel · the type layer, animated with the same anime.js build the site
   uses (assets/anime.min.js, v4.5.0, custom NOOR build).

   The reel is rendered a frame at a time by a headless browser, so the
   timeline never plays: it is built paused and seeked to an exact millisecond
   for every frame. That is why nothing here uses requestAnimationFrame.

   Five kinds of card share this file and one opening: a bloom, a streak of
   light across the frame, and the mark drawing itself.

     light   the day's card: a claim, a dateline, three sentences   (top left)
     know    Did you know?: the same column, one sentence, gone by 13 s
     day     This day: the numeral of the Hijri date, the name of the day
     word    The word: the Arabic word itself, centred, then what it means
     verse   One verse: the Arabic in the Quran cut, the meaning arriving
             sentence by sentence under the recitation, whose length the
             renderer measured from the audio file and passed in

   Every build hands back INFO with the moments the sound is placed on, so the
   notes land on what the picture does. */
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
  var T = null, INFO = null, FIT = null, SECS = 0, KIND = "light";
  var ms = function (s) { return Math.round(s * 1000); };

  /* THE GRID. Every kind has a tempo, and every moment in its timeline is
     quantised to an eighth of that tempo, so the words, the swells and the
     notes all land together. No beat is ever sounded: the grid is felt.
     One verse has no grid, because the recitation sets the time. */
  var BPM = { light: 96, know: 108, day: 84, word: 92, verse: 0, codex: 120 };
  var GRID = { bpm: 0, eighth: 0, beat: 0, bar: 0 };
  function grid(kind) {
    var b = BPM[kind] || 0;
    GRID = b ? { bpm: b, beat: 60 / b, eighth: 30 / b, bar: 240 / b } : { bpm: 0, beat: 0, eighth: 0, bar: 0 };
    return GRID;
  }
  /* to the nearest eighth, never earlier than `min` */
  function q(t, min) {
    if (!GRID.eighth) return t;
    var v = Math.round(t / GRID.eighth) * GRID.eighth;
    if (min != null && v < min) v += GRID.eighth;
    return v;
  }
  /* to the next beat at or after t */
  function qb(t) { if (!GRID.beat) return t; return Math.ceil(t / GRID.beat - 1e-6) * GRID.beat; }

  /* what the picture is told each frame, from what the type is doing */
  var SCENE = { cue: 0, blooms: [], hits: [], recede: 0, focus: 0.42, secs: 0, pulse: null, pulseStart: 0, fps: 30 };
  function bloomAt(t, list, rise, fall) {
    var a = 0;
    for (var i = 0; i < list.length; i++) { var u = t - list[i]; if (u < 0) continue; a += Math.min(1, u / rise) * Math.exp(-Math.max(0, u - rise) / fall); }
    return Math.min(1, a);
  }
  function scenePush(t) {
    var pulse = 0;
    if (SCENE.pulse) { var i = Math.floor((t - SCENE.pulseStart) * SCENE.fps); if (i >= 0 && i < SCENE.pulse.length) pulse = SCENE.pulse[i]; }
    var lift = Math.max(0, Math.min(1, (t - 0.2) / 2.2));
    window.NOORSCENE.frame({
      t: t,
      cue: Math.max(0, Math.min(1, (t - SCENE.cue) / 1.6)),
      bloom: bloomAt(t, SCENE.blooms, 0.22, 0.9),
      hit: bloomAt(t, SCENE.hits, 0.06, 0.35),
      pulse: pulse,
      recede: SCENE.recede ? Math.max(0, Math.min(1, (t - SCENE.recede) / 1.4)) : 0,
      focus: SCENE.focus,
      scrim: 0.25 + 0.45 * lift,
      progress: SCENE.secs ? t / SCENE.secs : 0,
      beat: GRID.beat ? (t / GRID.beat) % 1 : 0
    });
  }

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
    /* the key is located by position, not by its first word, so "a straight
       line" in "turn a circle into a straight line" golds the right "a" */
    var keyWords = [], firstKey = -1;
    if (key) {
      var i = text.toLowerCase().indexOf(key.toLowerCase());
      if (i >= 0) {
        keyWords = text.slice(i, i + key.length).split(/\s+/);
        firstKey = text.slice(0, i).trim() ? text.slice(0, i).trim().split(/\s+/).length : 0;
      }
    }
    var need = keyWords.slice();
    var words = text.split(/\s+/);
    words.forEach(function (w, i) {
      var s = document.createElement("span");
      s.className = "w";
      s.textContent = w;
      if (need.length && i >= firstKey && w.replace(/[^\w'’-]/g, "") ===
          need[0].replace(/[^\w'’-]/g, "")) {
        s.classList.add("key"); need.shift();
      }
      hook.appendChild(s);
      if (i < words.length - 1) hook.appendChild(document.createTextNode(" "));
    });
    return hook.querySelectorAll(".w");
  }

  function applyBody(px) {
    el("body").querySelectorAll(".blk div").forEach(function (d) {
      d.style.fontSize = px + "px";
      d.style.lineHeight = Math.round(px * 1.34) + "px";
    });
  }

  function fitColumn() {
    var hook = el("hook"), col = el("col");
    var avail = SAFE_B - SAFE_T - 46;   // descenders, and the rise a block
                                        // still has to travel when it arrives
    function tryPass(sizes, tight) {
      for (var a = 0; a < HOOK_SIZES.length; a++) {
        hook.style.fontSize = HOOK_SIZES[a] + "px";
        var lines = Math.round(hook.getBoundingClientRect().height /
                               (HOOK_SIZES[a] * 1.17));
        if (lines > 4) continue;
        for (var b = 0; b < sizes.length; b++) {
          applyBody(sizes[b]);
          if (col.getBoundingClientRect().height <= avail)
            return { hook: HOOK_SIZES[a], body: sizes[b], lines: lines,
                     fits: true, tight: !!tight };
        }
      }
      return null;
    }
    return tryPass(BODY_SIZES, false) || tryPass(BODY_TIGHT, true) ||
           { hook: 48, body: 32, lines: 99, fits: false, tight: true };
  }

  /* The coarse fit measures the column while it is being built, and that is
     not the same column that renders: with the timeline in place the resting
     layout came out eighty pixels taller. So the last word belongs to a
     measurement taken with everything at rest, driven from outside and checked
     against the rendered pixels rather than trusted. */
  function rest() {
    T.seek(SECS * 1000);
    var b = el(KIND === "codex" ? "hud-ask" : (KIND === "word" || KIND === "verse") ? "close2" : "close")
              .getBoundingClientRect().bottom;
    T.seek(0);
    return b;
  }

  function shrink() {
    var f = FIT;
    if (KIND === "codex") { f.fits = false; INFO.fits = false; return false; }
    if (KIND === "word") {
      if (f.short > 36) { f.short -= 2; el("short").style.fontSize = f.short + "px"; }
      else if (f.ar > 110) { f.ar -= 20; el("ar").style.fontSize = f.ar + "px"; }
      else if (f.long > 28) { f.long -= 2; el("long").style.fontSize = f.long + "px"; }
      else { f.fits = false; INFO.fits = false; return false; }
      f.tight = f.short < 40; INFO.tight = f.tight; return true;
    }
    if (KIND === "verse") {
      if (f.trans > 32) { f.trans -= 2; setTrans(f.trans); }
      else if (f.ayah > 40) { f.ayah -= 6; el("ayah").style.fontSize = f.ayah + "px"; el("ayah").style.lineHeight = (f.ayah >= 60 ? 1.9 : 1.75) + ""; }
      else { f.fits = false; INFO.fits = false; return false; }
      f.tight = f.trans < 36; INFO.tight = f.tight; return true;
    }
    if (f.body > 30) { f.body -= 2; applyBody(f.body); f.tight = f.body < 36; }
    else if (f.hook > 44) {
      f.hook -= 4; el("hook").style.fontSize = f.hook + "px"; f.tight = true;
    } else { f.fits = false; INFO.fits = false; return false; }
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
    u.style.display = "";
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

  function setTrans(px) {
    el("trans").querySelectorAll(".s").forEach(function (d) {
      d.style.fontSize = px + "px";
      d.style.lineHeight = Math.round(px * 1.40) + "px";
    });
  }

  /* which of the two stages a kind uses, and a clean slate on it */
  function stage(kind) {
    var mid = kind === "word" || kind === "verse";
    var hud = kind === "codex";
    /* a previous card's timeline leaves its last values as inline styles:
       an opacity 1 on the close, a transform on a word. Every one of them
       goes, so each card starts from the stylesheet and nothing else. */
    if (T) { try { T.revert(); } catch (e) { } T = null; }
    document.querySelectorAll("#stage [style]").forEach(function (e) { e.removeAttribute("style"); });
    el("mid").style.top = "";
    el("col").style.display = (mid || hud) ? "none" : "flow-root";
    el("mid").style.display = mid ? "flex" : "none";
    el("hud").style.display = hud ? "flex" : "none";
    SCENE = { cue: 0, blooms: [], hits: [], recede: 0, focus: 0.42, secs: 0, pulse: null, pulseStart: 0, fps: 30 };
    el("daynum").style.display = "none";
    el("todo").style.display = "none";
    el("body").style.marginTop = "";
    el("date").parentNode.style.display = "";
    ["ar", "term", "ayah", "ref", "short", "long", "trans", "reciter"].forEach(function (id) {
      el(id).textContent = ""; el(id).style.display = "";
    });
    el("crule2").style.display = "";
    el("trans").classList.remove("replace"); el("trans").style.height = "";
  }

  /* the opening every kind shares: a bloom, a streak, the mark */
  function opening(tl, brand, cat, rule, div) {
    tl.add("#flare", { opacity: [0, .70, 0], scale: [.25, 1.30],
                       duration: 780, ease: "outQuad" }, 0);
    tl.add("#streak", { opacity: [0, 1, 0], top: ["18%", "34%"],
                        scaleX: [.2, 1], duration: 620, ease: "outQuint" }, 40);
    tl.add(rule, { scaleX: [0, 1], duration: 460 }, 120);
    tl.add(brand + " span", { opacity: [0, 1], translateY: [14, 0],
                              duration: 380, delay: A.stagger(38) }, 200);
    tl.add(div, { opacity: [0, .55], scaleY: [0, 1], duration: 320 }, 420);
    tl.add(cat, { opacity: [0, 1], translateX: [-10, 0], duration: 420 }, 470);
  }

  /* ------------------------------------------------------------------ light / know */
  function buildLight(card, secs) {
    el("cat").textContent = (card.eyebrow || "").toUpperCase();
    letters(el("brand"), "NOOR");
    var words = splitHook(card.hook, card.key);
    letters(el("date"), (card.date || "").toUpperCase());

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
    var f = fitColumn();

    /* --- when everything happens, in seconds, on the grid --- */
    var n = words.length;
    var HK_START = q(0.18), HK_STEP = GRID.eighth ? Math.max(GRID.eighth / 2, Math.min(GRID.eighth, 0.62 / n)) : Math.min(0.062, Math.max(0.030, 0.62 / n));
    var hookEnd = q(HK_START + (n - 1) * HK_STEP + 0.52);
    var tDate = qb(Math.max(hookEnd + 0.18, 1.25));
    var tBody = qb(tDate + 1.15);
    var tClose = q(secs - 3.2);
    var step = q(Math.max(2.1, (tClose - tBody - 0.6) / Math.max(1, blocks.length)));

    var tl = A.createTimeline({ autoplay: false, defaults: { ease: "outCubic" } });
    opening(tl, "#brand", "#cat", "#col .mrule", "#col .mdiv");

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
    T = tl; FIT = f;
    underline();
    INFO = { fits: f.fits, tight: !!f.tight, hookPx: f.hook, bodyPx: f.body, lines: f.lines,
             tDate: tDate, tBody: tBody, tClose: tClose, step: step,
             hookEnd: hookEnd, height: el("col").getBoundingClientRect().height,
             cover: tDate + 1.1, grid: GRID };
    SCENE.cue = tBody + step * 0.5; SCENE.blooms = [0, hookEnd - 0.3, tClose]; SCENE.hits = [0, hookEnd - 0.3, tBody, tClose];
    SCENE.recede = tBody - 0.5; SCENE.focus = 0.30;
    tl.seek(0);
    return INFO;
  }

  /* ------------------------------------------------------------------ day */
  function buildDay(card, secs) {
    /* card: num "10", month "Muharram", ar "المحرم", hook "Ashura", key,
       lines [one or two], todo "Fast, if you are able." (optional) */
    el("cat").textContent = (card.eyebrow || "THIS DAY").toUpperCase();
    letters(el("brand"), "NOOR");
    var dn = el("daynum"); dn.style.display = "flex";
    el("dayn").textContent = String(card.num || "");
    el("daym").textContent = String(card.month || "").toUpperCase();
    el("dayar").textContent = card.ar || "";
    var words = splitHook(card.hook, card.key);
    el("date").parentNode.style.display = "none";
    var body = el("body");
    body.textContent = "";
    body.style.marginTop = "40px";
    (card.lines || []).forEach(function (line) {
      var blk = document.createElement("div"); blk.className = "blk";
      var d = document.createElement("div"); d.textContent = line;
      blk.appendChild(d); body.appendChild(blk);
    });
    var blocks = body.querySelectorAll(".blk");
    var todo = el("todo");
    if (card.todo) { todo.style.display = "block"; todo.textContent = card.todo; }
    var f = fitColumn();

    var n = words.length;
    var tNum = q(0.42), tHook = qb(1.10), HK_STEP = GRID.eighth ? GRID.eighth / 2 : Math.min(0.062, Math.max(0.030, 0.62 / n));
    var hookEnd = q(tHook + (n - 1) * HK_STEP + 0.52);
    var tBody = qb(hookEnd + 0.55);
    var tClose = q(secs - 3.0);
    var step = q(Math.max(1.9, (tClose - tBody - (card.todo ? 1.6 : 0.4)) / Math.max(1, blocks.length)));
    var tTodo = q(tBody + blocks.length * step - 0.2);

    var tl = A.createTimeline({ autoplay: false, defaults: { ease: "outCubic" } });
    opening(tl, "#brand", "#cat", "#col .mrule", "#col .mdiv");
    /* the date, big, out of blur; the month beside it */
    tl.add("#dayn", { opacity: [0, 1], translateY: [30, 0], scale: [1.06, 1], "--b": ["10px", "0px"],
                      duration: 700, ease: "outQuint" }, ms(tNum));
    tl.add("#daym", { opacity: [0, 1], translateX: [-14, 0], duration: 460 }, ms(tNum + 0.30));
    tl.add("#dayar", { opacity: [0, .9], translateX: [-10, 0], duration: 460 }, ms(tNum + 0.44));
    tl.add("#hook .w", { opacity: [0, 1], translateY: [42, 0], scale: [1.03, 1], "--b": ["8px", "0px"],
                         duration: 520, delay: A.stagger(ms(HK_STEP)) }, ms(tHook));
    if (el("hook").querySelector(".w.key")) {
      tl.add("#hook .w.key", { color: ["#FFF9E3", "#E9C86A"], duration: 420 }, ms(hookEnd - 0.30));
      tl.add("#uline", { scaleX: [0, 1], duration: 560, ease: "outExpo" }, ms(hookEnd - 0.12));
    }
    blocks.forEach(function (blk, i) {
      var at = tBody + i * step;
      tl.add(blk, { opacity: [0, 1], translateY: [18, 0], "--b": ["6px", "0px"], duration: 640 }, ms(at));
      for (var j = 0; j < i; j++)
        tl.add(blocks[j], { opacity: 1 - Math.min(.52, .26 * (i - j)), duration: 520 }, ms(at));
    });
    if (card.todo)
      tl.add("#todo", { opacity: [0, 1], translateY: [14, 0], "--b": ["6px", "0px"], duration: 600 }, ms(tTodo));
    tl.add("#close", { opacity: [0, 1], translateY: [18, 0], duration: 620 }, ms(tClose));
    tl.pause();
    T = tl; FIT = f;
    underline();
    INFO = { fits: f.fits, tight: !!f.tight, hookPx: f.hook, bodyPx: f.body, lines: blocks.length,
             tDate: tNum, tBody: tBody, tClose: tClose, step: step, hookEnd: hookEnd,
             tTodo: card.todo ? tTodo : null,
             height: el("col").getBoundingClientRect().height, cover: hookEnd + 0.9, grid: GRID };
    SCENE.cue = tNum; SCENE.blooms = [0, tNum, hookEnd - 0.3, tClose]; SCENE.hits = [0, tNum, hookEnd - 0.3, tBody, tClose];
    if (card.todo) { SCENE.blooms.push(tTodo); SCENE.hits.push(tTodo); }
    SCENE.recede = tBody - 0.5; SCENE.focus = 0.30;
    tl.seek(0);
    return INFO;
  }

  /* ------------------------------------------------------------------ the centred stage */
  function fitMid(f, apply) {
    var avail = SAFE_B - SAFE_T - 46;
    var mid = el("mid");
    for (var i = 0; i < 40; i++) {
      apply(f);
      var h = mid.getBoundingClientRect().height;
      if (h <= avail) {
        f.fits = true;
        /* the block stands in the middle of the safe rectangle, not at its top */
        mid.style.top = Math.round(SAFE_T + Math.max(0, (avail - h) * 0.5)) + "px";
        return f;
      }
      if (!step(f)) break;
    }
    f.fits = false; return f;
    function step(f) {
      if (f.short != null) {
        if (f.short > 36) { f.short -= 2; return true; }
        if (f.ar > 110) { f.ar -= 20; return true; }
        if (f.long > 28) { f.long -= 2; return true; }
        return false;
      }
      if (f.trans > 32) { f.trans -= 2; return true; }
      if (f.ayah > 40) { f.ayah -= 6; return true; }
      return false;
    }
  }

  function buildWord(card, secs) {
    /* card: ar "العَقِيدَة", term "Aqidah", eyebrow "The word · belief",
       short "...", long "one sentence" */
    el("cat2").textContent = (card.eyebrow || "THE WORD").toUpperCase();
    letters(el("brand2"), "NOOR");
    el("ar").textContent = card.ar || "";
    letters(el("term"), card.term || "");
    el("ayah").style.display = "none"; el("ref").style.display = "none";
    el("trans").style.display = "none"; el("reciter").style.display = "none";
    el("short").textContent = card.short || "";
    el("long").textContent = card.long || "";
    if (!card.long) el("long").style.display = "none";
    el("site2").textContent = "NOORCODEX.COM/DICTIONARY";
    el("sub2").textContent = "one of 523 words, explained free";

    var f = fitMid({ ar: 170, short: 44, long: 32, tight: false }, function (f) {
      el("ar").style.fontSize = f.ar + "px";
      el("short").style.fontSize = f.short + "px";
      el("long").style.fontSize = f.long + "px";
      f.tight = f.short < 40;
    });

    var tAr = qb(0.55), tTerm = q(tAr + 0.7), tRule = q(tTerm + 0.6), tShort = qb(tRule + 0.4);
    var tLong = qb(Math.min(tShort + 3.6, secs - 6.4));
    var tClose = q(secs - 3.0);
    var tl = A.createTimeline({ autoplay: false, defaults: { ease: "outCubic" } });
    opening(tl, "#brand2", "#cat2", "#mid .mrule", "#mid .mdiv");
    /* the word itself, out of light */
    tl.add("#ar", { opacity: [0, 1], scale: [1.08, 1], "--b": ["14px", "0px"],
                    duration: 1100, ease: "outQuint" }, ms(tAr));
    tl.add("#term span", { opacity: [0, 1], translateY: [10, 0], duration: 320,
                           delay: A.stagger(22) }, ms(tTerm));
    tl.add("#crule2", { scaleX: [0, 1], duration: 620, ease: "outExpo" }, ms(tRule));
    tl.add("#short", { opacity: [0, 1], translateY: [18, 0], "--b": ["6px", "0px"], duration: 700 }, ms(tShort));
    if (card.long) {
      tl.add("#long", { opacity: [0, 1], translateY: [16, 0], "--b": ["6px", "0px"], duration: 700 }, ms(tLong));
      tl.add("#short", { opacity: .74, duration: 520 }, ms(tLong));
    }
    tl.add("#close2", { opacity: [0, 1], translateY: [18, 0], duration: 620 }, ms(tClose));
    tl.pause();
    T = tl; FIT = f;
    var ab = el("ar").getBoundingClientRect();
    SCENE.cue = tAr; SCENE.blooms = [0, tAr, tShort, tClose]; SCENE.hits = [0, tAr, tRule, tShort, tClose];
    if (card.long) SCENE.hits.push(tLong);
    SCENE.recede = tShort - 0.5; SCENE.focus = (ab.top + ab.height * 0.5) / 1920;
    INFO = { fits: f.fits, tight: !!f.tight, arPx: f.ar, shortPx: f.short, grid: GRID,
             focus: (ab.top + ab.height * 0.5) / 1920,
             tAr: tAr, tTerm: tTerm, tRule: tRule, tShort: tShort, tLong: card.long ? tLong : null,
             tClose: tClose, tDate: tTerm, tBody: tShort, step: 3.6, hookEnd: tAr + 0.9,
             height: el("mid").getBoundingClientRect().height, cover: tShort + 0.9 };
    tl.seek(0);
    return INFO;
  }

  function buildVerse(card, secs) {
    /* card: ar "...", ref "AL-BAQARAH · 2:255", sents ["..",".."], reciter
       "Recited by Abdul Basit Abd us-Samad", rec {start, dur} measured by the
       renderer from the audio file itself */
    el("cat2").textContent = (card.eyebrow || "ONE VERSE").toUpperCase();
    letters(el("brand2"), "NOOR");
    el("ar").style.display = "none"; el("term").style.display = "none";
    el("short").style.display = "none"; el("long").style.display = "none";
    el("crule2").style.display = "none";
    el("ayah").textContent = card.ar || "";
    el("ref").textContent = String(card.ref || "").toUpperCase();
    var trans = el("trans"); trans.textContent = "";
    (card.sents || []).forEach(function (s) {
      var d = document.createElement("span"); d.className = "s"; d.textContent = s;
      trans.appendChild(d);
    });
    var sents = trans.querySelectorAll(".s");
    el("reciter").textContent = card.reciter || "";
    el("site2").textContent = "NOORCODEX.COM/QURAN";
    el("sub2").textContent = "read it, hear it, understand it, free";

    var applyV = function (f) {
      el("ayah").style.fontSize = f.ayah + "px";
      el("ayah").style.lineHeight = (f.ayah >= 60 ? 1.9 : 1.75) + "";
      setTrans(f.trans);
      f.tight = f.trans < 36;
    };
    var f = fitMid({ ayah: 76, trans: 40, tight: false }, applyV);
    /* a long verse: the sentences of the meaning take turns in one box
       instead of stacking, so the Arabic keeps its size and the whole still
       stands inside the safe rectangle */
    var replace = false;
    if (!f.fits && sents.length > 1) {
      replace = true;
      trans.classList.add("replace");
      f = fitMid({ ayah: 76, trans: 40, tight: false }, function (f) {
        applyV(f);
        var hmax = 0;
        sents.forEach(function (x) { hmax = Math.max(hmax, x.getBoundingClientRect().height); });
        trans.style.height = Math.ceil(hmax) + "px";
      });
    }

    var rec = card.rec || { start: 2.6, dur: Math.max(4, secs - 8) };
    var tAyah = 0.70, tRef = 1.45;
    var tEnd = rec.start + rec.dur;              // the recitation ends here
    var tRec = tEnd + 1.1, tClose = tEnd + 1.9;   // the bed is back by tEnd + 0.55
    /* each sentence arrives where its share of the words falls in the
       recitation, so the meaning keeps pace with the voice */
    var lens = [], total = 0;
    sents.forEach(function (s) { lens.push(s.textContent.length); total += s.textContent.length; });
    var at = [], acc = 0;
    for (var i = 0; i < lens.length; i++) {
      at.push(rec.start + 0.35 + (rec.dur - 1.2) * (acc / Math.max(1, total)));
      acc += lens[i];
    }
    var tl = A.createTimeline({ autoplay: false, defaults: { ease: "outCubic" } });
    opening(tl, "#brand2", "#cat2", "#mid .mrule", "#mid .mdiv");
    tl.add("#ayah", { opacity: [0, 1], scale: [1.04, 1], "--b": ["12px", "0px"],
                      duration: 1300, ease: "outQuint" }, ms(tAyah));
    tl.add("#ref", { opacity: [0, 1], translateY: [8, 0], duration: 480 }, ms(tRef));
    sents.forEach(function (s, i) {
      tl.add(s, { opacity: [0, 1], translateY: [16, 0], "--b": ["6px", "0px"], duration: 720 }, ms(at[i]));
      if (replace) {
        /* the sentence before leaves as this one arrives */
        if (i) tl.add(sents[i - 1], { opacity: 0, translateY: -10, duration: 420 }, ms(at[i] - 0.1));
      } else {
        for (var j = 0; j < i; j++)
          tl.add(sents[j], { opacity: 1 - Math.min(.45, .22 * (i - j)), duration: 600 }, ms(at[i]));
      }
    });
    tl.add("#reciter", { opacity: [0, 1], translateY: [8, 0], duration: 560 }, ms(tRec));
    tl.add("#close2", { opacity: [0, 1], translateY: [18, 0], duration: 620 }, ms(tClose));
    tl.pause();
    T = tl; FIT = f;
    var yb = el("ayah").getBoundingClientRect();
    SCENE.cue = tAyah; SCENE.blooms = [0, tAyah, tEnd + 0.9, tClose]; SCENE.hits = [0, tAyah, tEnd + 0.9];
    SCENE.recede = rec.start - 0.5; SCENE.focus = (yb.top + yb.height * 0.5) / 1920;
    INFO = { fits: f.fits, tight: !!f.tight, ayahPx: f.ayah, transPx: f.trans, grid: GRID,
             focus: (yb.top + yb.height * 0.5) / 1920,
             tAyah: tAyah, tRef: tRef, recStart: rec.start, recEnd: tEnd, sentAt: at,
             tReciter: tRec, tClose: tClose,
             tDate: tRef, tBody: rec.start, step: 3.0, hookEnd: tAyah + 1.0,
             height: el("mid").getBoundingClientRect().height, cover: tAyah + 1.5 };
    tl.seek(0);
    return INFO;
  }

  /* ------------------------------------------------------------------ codex */
  function buildCodex(card, secs) {
    /* card: build "1448.03", counts [[523,"words"],[114,"surahs"],...] (six),
       zeros [[0,"ads"],[0,"accounts"],[0,"tracking"]], room {k,t,d},
       ask {l1,l2,l3} */
    el("hud-build").textContent = card.build || "";
    var g = el("hud-grid"); g.textContent = "";
    var counts = (card.counts || []).concat(card.zeros || []);
    counts.forEach(function (c) {
      var d = document.createElement("div"); d.className = "cnt" + (Number(c[0]) === 0 ? " zero" : "");
      var b = document.createElement("b"); b.textContent = "0"; b.dataset.to = String(c[0]);
      var sp = document.createElement("span"); sp.textContent = c[1];
      d.appendChild(b); d.appendChild(sp); g.appendChild(d);
    });
    var room = card.room || {};
    el("hud-room-k").textContent = room.k || "today's room";
    el("hud-room-t").textContent = room.t || "";
    el("hud-room-d").textContent = room.d || "";
    var ask = card.ask || {};
    el("hud-l1").textContent = ask.l1 || "One light a day.";
    el("hud-l2").textContent = ask.l2 || "Follow. Save this. Send it to one person.";
    el("hud-l3").textContent = ask.l3 || "NOORCODEX.COM";

    var cells = g.querySelectorAll(".cnt");
    var f = { fits: true, tight: false };
    var avail = SAFE_B - SAFE_T - 46;
    for (var pass = 0; pass < 6; pass++) {
      if (el("hud").getBoundingClientRect().height <= avail) break;
      var b = cells[0] ? parseInt(getComputedStyle(cells[0].querySelector("b")).fontSize) : 60;
      cells.forEach(function (c) { c.querySelector("b").style.fontSize = (b - 10) + "px"; });
      el("hud-room-t").style.fontSize = (parseInt(getComputedStyle(el("hud-room-t")).fontSize) - 4) + "px";
      f.tight = true;
    }
    f.fits = el("hud").getBoundingClientRect().height <= avail;

    /* hard cadence: everything on the beat at 120 */
    var B = GRID.beat, E = GRID.eighth;
    var tHead = q(0.25), tRule = tHead + E, tCount = qb(tHead + B), tRoom = qb(tCount + B * cells.length * 0.5 + B);
    var tAsk = qb(tRoom + 2 * B), tClose = tAsk;
    if (tAsk > secs - 3.0) { tAsk = q(secs - 3.0); tClose = tAsk; }
    var tl = A.createTimeline({ autoplay: false, defaults: { ease: "outExpo" } });
    tl.add("#flare", { opacity: [0, .5, 0], scale: [.25, 1.2], duration: 500, ease: "outQuad" }, 0);
    tl.add("#hud .h", { opacity: [0, 1], translateY: [10, 0], duration: 260 }, ms(tHead));
    tl.add("#hud .rule", { scaleX: [0, 1], duration: 380 }, ms(tRule));
    cells.forEach(function (c, i) {
      var at = tCount + i * B * 0.5;
      tl.add(c, { opacity: [0, 1], translateY: [14, 0], "--b": ["4px", "0px"], duration: 240 }, ms(at));
      /* the number counts up over one beat, in steps that land on eighths */
      var b = c.querySelector("b"), to = Number(b.dataset.to);
      tl.add({ v: 0 }, { v: to, duration: ms(B * 1.5), ease: "outCubic", modifier: A.utils.round(0),
        onUpdate: function (self) { b.textContent = String(Math.round(self.targets[0].v)); } }, ms(at));
    });
    tl.add("#hud-room", { opacity: [0, 1], translateY: [16, 0], "--b": ["6px", "0px"], duration: 320 }, ms(tRoom));
    tl.add("#hud-ask", { opacity: [0, 1], translateY: [18, 0], duration: 320 }, ms(tAsk));
    tl.add("#hud-l1", { scale: [1.06, 1], duration: 380 }, ms(tAsk));
    tl.pause();
    T = tl; FIT = f;
    var hits = [0, tHead, tRule];
    cells.forEach(function (c, i) { hits.push(tCount + i * B * 0.5); });
    hits.push(tRoom, tAsk);
    SCENE.cue = tRoom; SCENE.blooms = [0, tCount, tRoom, tAsk]; SCENE.hits = hits;
    SCENE.recede = 0; SCENE.focus = 0.66;
    INFO = { fits: f.fits, tight: f.tight, tHead: tHead, tCount: tCount, tRoom: tRoom, tAsk: tAsk, tClose: tClose,
             cells: cells.length, tDate: tHead, tBody: tCount, step: B * 0.5, hookEnd: tRule, grid: GRID,
             cover: tRoom + 0.6, height: el("hud").getBoundingClientRect().height };
    tl.seek(0);
    return INFO;
  }

  window.NOORREEL = {
    build: function (card, secs) {
      KIND = card.kind || "light";
      SECS = secs;
      grid(KIND);
      stage(KIND);
      SCENE.secs = secs;
      if (!window.NOORSCENE) throw new Error("scene.js did not load: no picture");
      var lk = card.look || {};
      window.NOORSCENE.card({ kind: KIND, seed: lk.seed, n: lk.n, k: lk.k, pal: lk.pal, month: card.hm || 1 });
      var info;
      if (KIND === "day") info = buildDay(card, secs);
      else if (KIND === "word") info = buildWord(card, secs);
      else if (KIND === "verse") info = buildVerse(card, secs);
      else if (KIND === "codex") info = buildCodex(card, secs);
      else info = buildLight(card, secs);
      info.scene = { cue: SCENE.cue, blooms: SCENE.blooms, hits: SCENE.hits, focus: SCENE.focus };
      scenePush(0);
      return info;
    },
    /* the recitation's loudness per frame, so the picture can breathe with it */
    pulse: function (arr, start, fps) { SCENE.pulse = arr; SCENE.pulseStart = start; SCENE.fps = fps || 30; },
    seek: function (t) { T.seek(Math.max(0, t * 1000)); scenePush(Math.max(0, t)); },
    rest: rest,
    shrink: shrink,
    /* the opening bloom and streak are light, not information: the safe area
       audit measures the words, so it turns them off first */
    decor: function (on) {
      var v = on ? "" : "none";
      el("flare").style.display = v; el("streak").style.display = v;
      document.body.classList.toggle("type-only", !on);
    },
    info: function () { return INFO; }
  };
})();
