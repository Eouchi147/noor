/* NOOR reel · the type layer, v2, animated with the same anime.js build the
   site uses (assets/anime.min.js, v4.5.0, custom NOOR build).

   The reel is rendered a frame at a time by a headless browser, so the
   timeline never plays: it is built paused and seeked to an exact millisecond
   for every frame. That is why nothing here uses requestAnimationFrame.

   ONE IDEA PER SCREEN. A card is a short sequence of screens, each centred in
   the safe rectangle, each arriving on a beat, holding long enough to be
   read, and leaving before the next one comes. Nothing is stacked, nothing
   is crowded, and there is no furniture: no stat grid, no build number, no
   ticks, no category label, no end card asking to be followed.

   Seven kinds share this file:

     light  the day's card:  hook, dateline, three lines, the hook again
     know   Did you know?:   the same shape, one line of evidence
     day    This day:        the numeral of the Hijri date, the day, its lines
     word   The word:        the Arabic, how to say it, what it means
     name   One of the 99:   the Name, how to say it, what it means, one line
     dua    Words of the Path: the du'a, how to say it, what it means, one line
     verse  One verse:       the Uthmani text, breathing with the recitation,
                             the meaning arriving beneath it sentence by
                             sentence, and the reciter credited at the end

   Motion: outExpo and outQuint, nothing shorter than 300 ms, nothing that
   snaps. Every build hands back INFO with the moments the sound is placed on,
   and how long the card wants to be, so the picture and the bed are one
   timeline. */
(function () {
  "use strict";
  var A = window.anime;
  var SAFE_T = 270, SAFE_B = 1500;
  var MID = (SAFE_T + SAFE_B) / 2;          /* every screen is centred here */
  var AVAIL = SAFE_B - SAFE_T - 60;         /* 30px of air top and bottom */
  var COL_L = 146, COL_W = 788;             /* inset from the safe edges: a
                                               blurred, glowing word bleeds */
  var FLOOR = 0.52;                         /* the smallest a screen may be set */

  /* every kind has a tempo, between 76 and 88, and every moment of its
     timeline is quantised to an eighth of it, so the words, the swells of
     light and the drum all land together. One verse has no tempo: the
     recitation sets the time. */
  var BPM = { light: 80, know: 84, day: 76, word: 80, name: 78, dua: 76, verse: 0 };

  var el = function (id) { return document.getElementById(id); };
  var ms = function (s) { return Math.round(s * 1000); };
  var T = null, INFO = null, SECS = 0, KIND = "light";
  var STAGE = null, SCREENS = [], AYAH = null;
  var GRID = { bpm: 0, beat: 0, eighth: 0, bar: 0 };

  function grid(kind) {
    var b = BPM[kind] || 0;
    GRID = b ? { bpm: b, beat: 60 / b, eighth: 30 / b, bar: 240 / b }
             : { bpm: 0, beat: 0, eighth: 0, bar: 0 };
    return GRID;
  }
  /* to the nearest eighth, and always to a whole millisecond, so a time and
     the cue the audit reads back off the timeline are the same number */
  function q(t) {
    if (GRID.eighth) t = Math.round(t / GRID.eighth) * GRID.eighth;
    return Math.round(t * 1000) / 1000;
  }

  /* ---------------------------------------------------------------- the scene */
  var SCENE = { cue: 0, blooms: [], hits: [], recede: 0, focus: 0.46, secs: 0,
                pulse: null, pulseStart: 0, fps: 30 };

  function bloomAt(t, list, rise, fall) {
    var a = 0;
    for (var i = 0; i < list.length; i++) {
      var u = t - list[i];
      if (u < 0) continue;
      a += Math.min(1, u / rise) * Math.exp(-Math.max(0, u - rise) / fall);
    }
    return Math.min(1, a);
  }

  function scenePush(t) {
    var pulse = 0;
    if (SCENE.pulse) {
      var i = Math.floor((t - SCENE.pulseStart) * SCENE.fps);
      if (i >= 0 && i < SCENE.pulse.length) pulse = SCENE.pulse[i];
    }
    /* the Qur'an breathes with the voice: the glow on the Uthmani text is the
       reciter's own loudness, frame by frame */
    if (AYAH) AYAH.style.setProperty("--g", pulse.toFixed(3));
    window.NOORSCENE.frame({
      t: t,
      cue: Math.max(0, Math.min(1, (t - SCENE.cue) / 1.8)),
      bloom: bloomAt(t, SCENE.blooms, 0.30, 1.1),
      hit: bloomAt(t, SCENE.hits, 0.09, 0.42),
      pulse: pulse,
      recede: SCENE.recede ? Math.max(0, Math.min(1, (t - SCENE.recede) / 1.6)) : 0,
      focus: SCENE.focus,
      scrim: 0.35,
      progress: SCENE.secs ? t / SCENE.secs : 0
    });
  }

  /* ---------------------------------------------------------------- the screens */
  function reset() {
    if (T) { try { T.revert(); } catch (e) { } T = null; }
    STAGE = el("stage");
    STAGE.textContent = "";
    SCREENS = []; AYAH = null;
    SCENE = { cue: 0, blooms: [], hits: [], recede: 0, focus: 0.46, secs: 0,
              pulse: null, pulseStart: 0, fps: 30 };
  }

  function screen() {
    var d = document.createElement("div");
    d.className = "screen";
    d.style.left = COL_L + "px"; d.style.width = COL_W + "px";
    STAGE.appendChild(d);
    SCREENS.push(d);
    d._items = [];
    return d;
  }

  /* one element on a screen. `base` is its size before the fitter has had its
     say; `lh` its line height; `gap` the air above it. */
  function put(scr, cls, text, base, lh, gap) {
    var d = document.createElement("div");
    d.className = cls;
    if (text != null) d.textContent = text;
    d.dataset.base = base;
    d.style.lineHeight = String(lh);
    if (gap) d.dataset.gap = gap;
    scr.appendChild(d);
    scr._items.push(d);
    return d;
  }

  /* a line of substance gets a screen to itself, set large and at full
     brightness with its number or name in gold. 42px is the floor: a line
     smaller than that is not read on a phone in a feed, so a card whose line
     will not fit at 42 is unfit rather than unreadable. */
  function lineScreen(text) {
    var s = screen();
    var d = put(s, "line", null, 56, 1.40, 0);
    d.dataset.min = 42;
    goldLine(d, text);
    return s;
  }

  /* THE GOLD IN A LINE. One thing in a line of substance is turned gold: the
     first number in it, or the first proper name, whichever comes first, and
     nothing at all if it has neither. The rule is mechanical on purpose,
     because a rule that guessed would sooner or later gild the wrong word:

       a number is a run of digits with its thousands commas and its ordinal
       ending if it has one (964, 1,000, 14th);
       a name is a capitalised word that is not the first word of the line
       (that one is capitalised by grammar, not by being a name) and is not
       one of the words grammar capitalises anyway, run forward through the
       words after it while they are capitalised too, or are the particles
       that hold an Arabic name together, so "Ibn al-Haytham" and
       "Abd al-Rahman al-Sufi" arrive whole.
  */
  /* the words grammar capitalises at the head of a sentence, which are not
     names however they are set. A name that is also one of these does not
     exist in the library's own text, and if it ever does it simply stays
     white, which is the safe way to be wrong. */
  var NOT_A_NAME = new RegExp("^(" + (
    "The A An In On At By For From And But Not No Nor Neither Both Or If So As Of To With " +
    "It Its He She They We You His Her Their That This These Those There Here " +
    "When What Where Who Why How Which While Since Until Because Though Although " +
    "Each Every Any All Many Most Some Few Several Other Another Such Only Just " +
    "One Two Three Four Five Six Seven Eight Nine Ten Half Twice Once " +
    "Today Now Then Later Earlier Still Yet Even Like Unlike Together " +
    "After Before During Within Under Over Above Below Across Around Between " +
    "Among Along Behind Beyond Near Next Into Through Without Against About " +
    "Nobody Anyone Everyone Nothing Something Everything Its").split(" ").join("|") + ")$");
  var A_NUMBER = /^\d[\d,.]*(?:st|nd|rd|th)?[.,;:]?$/;
  var PARTICLE = /^(al|ad|ar|as|az|ash|el|ul|ibn|bin|bint|abu|abd|umm)-?[A-Za-z]/;
  var bare = function (w) { return String(w).replace(/[.,;:!?]$/, ""); };

  function namey(w) {
    var b = bare(w);
    return (/^[A-Z][A-Za-z'’\-]*$/.test(b) && !NOT_A_NAME.test(b)) ||
           (PARTICLE.test(b) && /[A-Z]/.test(b));
  }
  var ENDS_CLAUSE = /[,;:]$/;                       /* a name stops at a comma */

  function goldRun(list) {
    for (var i = 0; i < list.length; i++) {
      if (A_NUMBER.test(list[i])) return [i, i];
      if (i === 0) continue;                       /* grammar, not a name */
      var w = bare(list[i]);
      if (!/^[A-Z][A-Za-z'’\-]*$/.test(w) || NOT_A_NAME.test(w)) continue;
      var j = i;
      if (ENDS_CLAUSE.test(list[i])) return [i, i];
      while (j + 1 < list.length && j - i < 3) {   /* four words is a long name */
        if (!namey(list[j + 1])) break;
        j++;
        if (ENDS_CLAUSE.test(list[j])) break;
      }
      /* the first word of the line was passed over because grammar capitalises
         it; if the name runs on from it, it belongs to the name after all
         ("Abu Bakr al-Razi", "Zubayda bint Ja'far") */
      while (i > 0 && namey(list[i - 1]) && !ENDS_CLAUSE.test(list[i - 1]) && j - i < 3) i--;
      return [i, j];
    }
    return null;
  }

  function goldLine(node, text) {
    node.textContent = "";
    var list = String(text).split(/\s+/);
    var run = goldRun(list);
    if (!run) { node.textContent = text; return node; }
    var before = list.slice(0, run[0]).join(" ");
    var gold = list.slice(run[0], run[1] + 1).join(" ");
    var after = list.slice(run[1] + 1).join(" ");
    var tail = gold.match(/[.,;:!?]$/);            /* the stop belongs to the
                                                      sentence, not the name */
    if (tail) { gold = gold.slice(0, -1); after = tail[0] + (after ? " " + after : ""); }
    if (before) node.appendChild(document.createTextNode(before + " "));
    var g = document.createElement("i");
    g.className = "g"; g.style.fontStyle = "normal"; g.textContent = gold;
    node.appendChild(g);
    if (after) node.appendChild(document.createTextNode((tail ? "" : " ") + after));
    return node;
  }

  /* a line of type split into words, so it can arrive as speech does.
     The box itself is lit: only the words inside it are animated, and a box
     left at the stylesheet's opacity 0 would hide every one of them. */
  function words(node, text, key) {
    node.textContent = "";
    node.style.opacity = 1;
    var keyWords = [], firstKey = -1;
    if (key) {
      var i = text.toLowerCase().indexOf(String(key).toLowerCase());
      if (i >= 0) {
        keyWords = text.slice(i, i + key.length).split(/\s+/);
        firstKey = text.slice(0, i).trim() ? text.slice(0, i).trim().split(/\s+/).length : 0;
      }
    }
    var need = keyWords.slice();
    var list = text.split(/\s+/);
    list.forEach(function (w, i) {
      var s = document.createElement("span");
      s.className = "w";
      s.textContent = w;
      if (need.length && i >= firstKey && w.replace(/[^\w'’-]/g, "") ===
          need[0].replace(/[^\w'’-]/g, "")) { s.classList.add("key"); need.shift(); }
      node.appendChild(s);
      if (i < list.length - 1) node.appendChild(document.createTextNode(" "));
    });
    return node.querySelectorAll(".w");
  }

  /* the fitter: each screen is set as large as it can be and still stand
     inside the safe rectangle with air above and below, then centred there.
     It is measured at rest, with everything in place, because a column
     measured while it is being built is not the column that renders. */
  function applyScale(scr, sc) {
    scr._sc = sc;
    scr.querySelectorAll("[data-base],[data-gap]").forEach(function (e) {
      if (e.dataset.base)
        e.style.fontSize = Math.max(parseFloat(e.dataset.min || 16),
                                    Math.round(parseFloat(e.dataset.base) * sc)) + "px";
      if (e.dataset.gap)
        e.style.marginTop = Math.round(parseFloat(e.dataset.gap) * sc) + "px";
    });
    if (scr._trans) sizeTrans(scr._trans);
  }

  function sizeTrans(box) {
    var h = 0;
    box.querySelectorAll(".s").forEach(function (s) { h = Math.max(h, s.getBoundingClientRect().height); });
    box.style.height = Math.ceil(h) + "px";
  }

  function place(scr) {
    var h = scr.getBoundingClientRect().height;
    scr.style.top = Math.round(MID - h / 2) + "px";
    return h;
  }

  /* too tall, or too wide. Wide happens: a transliteration is one word set in
     capitals with a fifth of an em between the letters, and
     "Muhammadur-rasulullah" at 40px is fifty pixels wider than the column,
     which centres it and hangs it over both safe edges. A word cannot be
     broken, so the screen is set smaller until it is inside. */
  function over(scr) {
    return scr.getBoundingClientRect().height > AVAIL || scr.scrollWidth > COL_W;
  }

  function fitAll() {
    var ok = true, tight = false;
    SCREENS.forEach(function (scr) {
      var sc = 1.0;
      applyScale(scr, sc);
      while (over(scr) && sc > FLOOR) {
        sc -= 0.04; applyScale(scr, sc);
      }
      if (over(scr)) ok = false;
      if (sc < 0.8) tight = true;
      place(scr);
    });
    return { fits: ok, tight: tight };
  }

  function rest() {
    var b = 0;
    SCREENS.forEach(function (s) {
      var r = s.getBoundingClientRect();
      b = Math.max(b, r.bottom);
    });
    return b;
  }

  function shrink() {
    /* the screen that is furthest out of its rectangle gives way first; when
       none of them can give any more, the card is unfit */
    var worst = null, h = 0;
    SCREENS.forEach(function (s) {
      var r = Math.max(s.getBoundingClientRect().height / AVAIL, s.scrollWidth / COL_W);
      if (r > h) { h = r; worst = s; }
    });
    if (!worst || (worst._sc || 1) <= FLOOR) { INFO.fits = false; return false; }
    applyScale(worst, (worst._sc || 1) - 0.05);
    place(worst);
    INFO.tight = true;
    return true;
  }

  /* ---------------------------------------------------------------- the motion */
  function arrive(tl, target, at, o) {
    o = o || {};
    tl.add(target, {
      opacity: [0, o.to == null ? 1 : o.to],
      translateY: [o.dy == null ? 26 : o.dy, 0],
      "--b": [(o.blur == null ? 9 : o.blur) + "px", "0px"],
      duration: o.dur || 860,
      ease: o.ease || "outExpo",
      delay: o.delay || 0
    }, ms(at));
  }

  function depart(tl, target, at, o) {
    o = o || {};
    tl.add(target, {
      opacity: 0, translateY: -14, "--b": "5px",
      duration: o.dur || 680, ease: "inOutQuad"
    }, ms(at));
  }

  /* a screen: its items arrive one after another from `at`, and the whole of
     it leaves at `out`. Returns when the last item has landed. */
  function showScreen(tl, scr, at, out, stepIn) {
    var step = stepIn == null ? (GRID.eighth ? GRID.eighth * 2 : 0.75) : stepIn;
    var t = at;
    scr._items.forEach(function (item, i) {
      if (item._custom) { t = item._custom(tl, t); return; }
      arrive(tl, item, t, item._in);
      SCENE.hits.push(t);
      t += (i === 0 ? step : step * 0.85);
    });
    if (out != null) depart(tl, scr._items, out);
    return t - step * 0.85;
  }

  /* ---------------------------------------------------------------- light, know */
  function buildLight(card) {
    var lines = card.lines || [];
    var s1 = screen();
    var hook = put(s1, "hook", null, 74, 1.20, 0);
    var ws = words(hook, card.hook || "", card.key);

    var s2 = screen();
    put(s2, "date", (card.date || "").replace(/\s+/g, " "), 38, 1.42, 0);

    var body = lines.map(lineScreen);

    var s9 = screen();
    put(s9, "smallhook", card.hook || "", 40, 1.30, 0);
    put(s9, "site", "noorcodex.com", 30, 1.4, 46);

    var f = fitAll();

    var E = GRID.eighth, B = GRID.beat;
    var step = Math.min(0.19, Math.max(0.11, E / 2));
    var tHook = 0;
    var hookEnd = q(tHook + (ws.length - 1) * step + 0.46);
    var outHook = q(hookEnd + B * 2.4);
    var tDate = q(outHook + B * 0.5);
    var outDate = q(tDate + B * 3);
    /* one line of evidence is held longer than one of three: a Did you know
       has only that line, and the reel is over as soon as it is read */
    var hold = lines.length > 1 ? B * 4 : B * 6.2;

    var tl = A.createTimeline({ autoplay: false, defaults: { ease: "outExpo" } });
    tl.add(ws, { opacity: [0.38, 1], translateY: [15, 0], "--b": ["8px", "0px"],
                 duration: 440, delay: A.stagger(ms(step)) }, ms(tHook));
    /* the surprise does not rule itself under: it warms */
    var keys = s1.querySelectorAll(".w.key");
    if (keys.length) {
      tl.add(keys, { color: ["#FFFEF7", "#E9C86A"], "--g": [0, 1],
                     duration: 1000, ease: "outQuad" }, ms(hookEnd - 0.2));
      tl.add(keys, { "--g": 0.45, duration: 900, ease: "inOutQuad" }, ms(hookEnd + 1.1));
    }
    depart(tl, s1._items, outHook);

    arrive(tl, s2._items[0], tDate, { dy: 18, blur: 7, dur: 900 });
    depart(tl, s2._items, outDate);

    /* one screen leaves as the next arrives: half a beat of overlap, so the
       frame is never empty and nothing ever snaps */
    var at = q(outDate + B * 0.5), tBody = at;
    body.forEach(function (s) {
      arrive(tl, s._items[0], at, { dy: 22, dur: 900 });
      SCENE.hits.push(at);
      depart(tl, s._items, q(at + hold));
      at = q(at + hold + B * 0.5);
    });
    var tClose = q(at);
    arrive(tl, s9._items[0], tClose, { dy: 20, dur: 900 });
    arrive(tl, s9._items[1], q(tClose + B), { dy: 14, dur: 820 });
    tl.pause();
    T = tl;

    SCENE.cue = tBody;
    SCENE.blooms = [0.15, hookEnd - 0.2, tBody, tClose];
    SCENE.hits = [0.15, hookEnd - 0.2, tDate, tClose, q(tClose + B)].concat(SCENE.hits);
    SCENE.recede = 0; SCENE.focus = 0.46;
    return { fits: f.fits, tight: f.tight, hookPx: Math.round(74 * (s1._sc || 1)),
             bodyPx: Math.round(56 * ((body[0] || s2)._sc || 1)),
             lines: lines.length, secs: Math.round((tClose + B * 4.4) * 100) / 100,
             tHook: tHook, hookEnd: hookEnd, tDate: tDate, tBody: tBody,
             step: hold + B, tClose: tClose, cover: q(hookEnd + 0.6) };
  }

  /* ---------------------------------------------------------------- this day */
  function buildDay(card) {
    var lines = card.lines || [];
    var s1 = screen();
    put(s1, "num", String(card.num || ""), 210, 0.9, 0);
    put(s1, "month", String(card.month || "").toUpperCase(), 44, 1.3, 34);
    put(s1, "monthar", card.ar || "", 52, 1.4, 14);

    var s2 = screen();
    var hook = put(s2, "hook", null, 72, 1.20, 0);
    var ws = words(hook, card.hook || "", card.key);

    var body = lines.map(lineScreen);

    var s4 = null;
    if (card.todo) { s4 = screen(); put(s4, "todo", card.todo, 52, 1.34, 0); }

    var s9 = screen();
    put(s9, "smallhook", card.hook || "", 40, 1.30, 0);
    put(s9, "site", "noorcodex.com", 30, 1.4, 46);

    var f = fitAll();
    var E = GRID.eighth, B = GRID.beat;
    var step = Math.min(0.19, Math.max(0.11, E / 2));

    var tl = A.createTimeline({ autoplay: false, defaults: { ease: "outExpo" } });
    var tNum = q(0.5);
    arrive(tl, s1._items[0], tNum, { dy: 34, blur: 14, dur: 1100, ease: "outQuint" });
    arrive(tl, s1._items[1], q(tNum + B), { dy: 16, dur: 820 });
    arrive(tl, s1._items[2], q(tNum + B * 1.5), { dy: 14, dur: 820, to: 0.85 });
    var outNum = q(tNum + B * 4.4);
    depart(tl, s1._items, outNum);

    var tHook = q(outNum + B * 0.5);
    tl.add(ws, { opacity: [0.38, 1], translateY: [15, 0], "--b": ["8px", "0px"],
                 duration: 440, delay: A.stagger(ms(step)) }, ms(tHook));
    var hookEnd = q(tHook + (ws.length - 1) * step + 0.86);
    var keys = s2.querySelectorAll(".w.key");
    if (keys.length) {
      tl.add(keys, { color: ["#FFFEF7", "#E9C86A"], "--g": [0, 1], duration: 1000, ease: "outQuad" },
             ms(hookEnd - 0.2));
      tl.add(keys, { "--g": 0.45, duration: 900, ease: "inOutQuad" }, ms(hookEnd + 1.1));
    }
    var outHook = q(hookEnd + B * 2.4);
    depart(tl, s2._items, outHook);

    var at = q(outHook + B * 0.5), tBody = at, hold = B * 4.6;
    body.forEach(function (s) {
      arrive(tl, s._items[0], at, { dy: 22, dur: 900 });
      SCENE.hits.push(at);
      depart(tl, s._items, q(at + hold));
      at = q(at + hold + B * 0.5);
    });
    var tTodo = null;
    if (s4) {
      tTodo = at;
      arrive(tl, s4._items[0], at, { dy: 22, dur: 900 });
      SCENE.hits.push(at);
      depart(tl, s4._items, q(at + B * 4));
      at = q(at + B * 4.5);
    }
    var tClose = q(at);
    arrive(tl, s9._items[0], tClose, { dy: 20, dur: 900 });
    arrive(tl, s9._items[1], q(tClose + B), { dy: 14, dur: 820 });
    tl.pause();
    T = tl;

    SCENE.cue = tNum;
    SCENE.blooms = [0.15, tNum, hookEnd - 0.2, tClose];
    SCENE.hits = [0.15, tNum, tHook, hookEnd - 0.2, tClose].concat(SCENE.hits);
    SCENE.focus = 0.46;
    return { fits: f.fits, tight: f.tight, hookPx: Math.round(72 * (s2._sc || 1)),
             bodyPx: Math.round(56 * ((body[0] || s1)._sc || 1)), lines: lines.length,
             secs: Math.round((tClose + B * 4.4) * 100) / 100,
             tHook: tHook, hookEnd: hookEnd, tDate: tNum, tBody: tBody, tTodo: tTodo,
             step: hold + B, tClose: tClose, cover: q(tNum + 1.2) };
  }

  /* ------------------------------------------------- the word, a Name, a du'a */
  function buildArabic(card, kind) {
    /* three shapes of the same reel: the Arabic, how to say it, what it
       means, and one sentence of substance. A reader should be able to say
       the word by the end, so the transliteration is on screen twice. */
    var big = kind === "dua" ? 96 : (kind === "name" ? 150 : 156);
    var s1 = screen();
    var ar = put(s1, "ar", card.ar || "", big, kind === "dua" ? 1.7 : 1.34, 0);
    var tr = put(s1, "translit", null, 40, 1.32, 52);
    var tws = words(tr, card.translit || card.term || "", null);

    var s2 = screen();
    put(s2, "translit", card.translit || card.term || "", 34, 1.3, 0);
    put(s2, "meaning", card.meaning || card.short || "", 50, 1.40, 44);

    var s3 = null, sentence = card.line || card.long || "";
    if (sentence) { s3 = screen(); put(s3, "sentence", sentence, 44, 1.44, 0); }

    var s9 = screen();
    put(s9, "smallar", card.ar || "", kind === "dua" ? 44 : 64, 1.5, 0);
    put(s9, "site", "noorcodex.com", 30, 1.4, 46);

    var f = fitAll();
    var B = GRID.beat, E = GRID.eighth;

    var tl = A.createTimeline({ autoplay: false, defaults: { ease: "outExpo" } });
    /* The opening used to be: nothing for 0.6s, the Arabic easing in over
       1.5s, the transliteration two beats behind it, and the English meaning
       at 5.85s. Measured against Facebook's own numbers -- 332 views, 27 of
       them lasting three seconds -- the reel was still fading in when the
       viewer had already gone. So the card now says what it is in the first
       frame: the word is there at 0.05s, its name a fifth of a second later,
       and the whole opening screen is legible before the second one begins.
       The ease and the bloom are untouched; only the waiting is gone. */
    var tAr = 0;
    tl.add(ar, { opacity: [0.42, 1], scale: [1.03, 1], "--b": ["11px", "0px"],
                 duration: 460, ease: "outQuint" }, ms(tAr));
    var tTerm = q(tAr + 0.14);
    tl.add(tws, { opacity: [0.22, 1], translateY: [9, 0], duration: 380,
                  delay: A.stagger(60) }, ms(tTerm));
    var outAr = q(tTerm + B * 3.0);
    depart(tl, s1._items, outAr);

    var tMean = q(outAr + B * 0.35);
    arrive(tl, s2._items[0], tMean, { dy: 12, dur: 540, to: 0.8 });
    arrive(tl, s2._items[1], q(tMean + B * 0.55), { dy: 16, dur: 620 });
    var outMean = q(tMean + B * 5.4);
    depart(tl, s2._items, outMean);

    var tSent = null, at = outMean;
    if (s3) {
      tSent = q(outMean + B * 0.5);
      arrive(tl, s3._items[0], tSent, { dy: 22, dur: 940 });
      at = q(tSent + B * 5.4);
      depart(tl, s3._items, at);
    }
    var tClose = q(at + B * 0.5);
    arrive(tl, s9._items[0], tClose, { dy: 18, dur: 940 });
    arrive(tl, s9._items[1], q(tClose + B), { dy: 14, dur: 820 });
    tl.pause();
    T = tl;

    SCENE.cue = tAr;
    SCENE.blooms = [0.15, tAr, tMean, tClose].concat(tSent ? [tSent] : []);
    SCENE.hits = [0.15, tAr, tTerm, tMean, q(tMean + B), tClose].concat(tSent ? [tSent] : []);
    SCENE.focus = 0.46;
    return { fits: f.fits, tight: f.tight, arPx: Math.round(big * (s1._sc || 1)),
             hookPx: Math.round(big * (s1._sc || 1)),
             bodyPx: Math.round(50 * (s2._sc || 1)), shortPx: Math.round(50 * (s2._sc || 1)),
             secs: Math.round((tClose + B * 4.4) * 100) / 100,
             tAr: tAr, tTerm: tTerm, tShort: tMean, tLong: tSent,
             tHook: tAr, hookEnd: q(tAr + 1.5), tDate: tTerm, tBody: tMean,
             step: B * 5.4, tClose: tClose, cover: q(tAr + 1.6) };
  }

  /* ---------------------------------------------------------------- one verse */
  function buildVerse(card) {
    /* the Uthmani text large and centred, breathing with the recitation; the
       meaning beneath it, sentence by sentence, one at a time; the reference
       small. Nothing else moves. The end is the reciter, in one line. */
    var rec = card.rec || { start: 2.0, dur: 8.0 };
    var s1 = screen();
    AYAH = put(s1, "quran", card.ar || "", 80, 1.95, 0);
    put(s1, "ref", String(card.ref || "").toUpperCase(), 28, 1.4, 40);
    var box = document.createElement("div");
    box.className = "trans"; box.dataset.gap = 52;
    box.style.opacity = 1;            /* the sentences inside it do the fading */
    s1.appendChild(box);
    (card.sents || []).forEach(function (txt) {
      var d = document.createElement("span");
      d.className = "s"; d.textContent = txt;
      d.dataset.base = 42; d.style.lineHeight = "1.42";
      box.appendChild(d);
    });
    s1._trans = box;
    s1._items = [AYAH, s1.querySelector(".ref"), box];
    var sents = box.querySelectorAll(".s");

    var s9 = screen();
    put(s9, "credit", card.reciter || "", 30, 1.4, 0);

    var f = fitAll();

    var tAyah = 0, tRef = 0.42;
    var tEnd = rec.start + rec.dur;
    var tCredit = Math.round((tEnd + 1.35) * 1000) / 1000;
    var secs = Math.round((tEnd + 4.2) * 100) / 100;

    /* each sentence of the meaning arrives where its share of the words falls
       in the recitation, so the meaning keeps pace with the voice */
    var lens = [], total = 0;
    sents.forEach(function (s) { lens.push(s.textContent.length); total += s.textContent.length; });
    var at = [], acc = 0;
    for (var i = 0; i < lens.length; i++) {
      at.push(Math.round((rec.start + 0.5 + (rec.dur - 1.4) * (acc / Math.max(1, total))) * 1000) / 1000);
      acc += lens[i];
    }

    var tl = A.createTimeline({ autoplay: false, defaults: { ease: "outExpo" } });
    tl.add(AYAH, { opacity: [0.40, 1], scale: [1.02, 1], "--b": ["11px", "0px"],
                   duration: 580, ease: "outQuint" }, ms(tAyah));
    arrive(tl, s1._items[1], tRef, { dy: 8, dur: 520 });
    sents.forEach(function (s, i) {
      arrive(tl, s, at[i], { dy: 18, dur: 900 });
      if (i) depart(tl, sents[i - 1], Math.round((at[i] - 0.12) * 1000) / 1000, { dur: 620 });
    });
    var outAll = Math.round((tEnd + 0.8) * 1000) / 1000;
    depart(tl, [AYAH, s1._items[1], sents[sents.length - 1]], outAll, { dur: 900 });
    arrive(tl, s9._items[0], tCredit, { dy: 14, dur: 940 });
    tl.pause();
    T = tl;

    SCENE.cue = tAyah;
    SCENE.blooms = [0.15, tAyah, tCredit];
    SCENE.hits = [0.15, tAyah, tRef, tCredit];
    SCENE.focus = 0.46;
    return { fits: f.fits, tight: f.tight, ayahPx: Math.round(80 * (s1._sc || 1)),
             hookPx: Math.round(80 * (s1._sc || 1)), transPx: Math.round(42 * (s1._sc || 1)),
             bodyPx: Math.round(42 * (s1._sc || 1)),
             secs: secs, tAyah: tAyah, tRef: tRef, recStart: rec.start, recEnd: tEnd,
             sentAt: at, tReciter: tCredit, tHook: tAyah, hookEnd: tAyah + 1.7,
             tDate: tRef, tBody: rec.start, step: 3.0, tClose: tCredit,
             cover: Math.round((tAyah + 1.9) * 100) / 100 };
  }

  /* ---------------------------------------------------------------- the door */
  window.NOORREEL = {
    build: function (card, secs) {
      KIND = card.kind || "light";
      grid(KIND);
      reset();
      if (!window.NOORSCENE) throw new Error("scene.js did not load: no picture");
      var lk = card.look || {};
      window.NOORSCENE.card({ seed: lk.seed, n: lk.n, k: lk.k });
      var info;
      if (KIND === "day") info = buildDay(card);
      else if (KIND === "word") info = buildArabic(card, "word");
      else if (KIND === "name") info = buildArabic(card, "name");
      else if (KIND === "dua") info = buildArabic(card, "dua");
      else if (KIND === "verse") info = buildVerse(card);
      else info = buildLight(card);
      SECS = info.secs || secs;
      SCENE.secs = SECS;
      info.height = rest() - (SCREENS.length ? SCREENS[0].getBoundingClientRect().top : 0);
      info.grid = GRID;
      info.scene = { cue: SCENE.cue, blooms: SCENE.blooms, hits: SCENE.hits, focus: SCENE.focus };
      INFO = info;
      T.seek(0);
      scenePush(0);
      return info;
    },
    /* the recitation's loudness per frame, so the light can breathe with it */
    pulse: function (arr, start, fps) { SCENE.pulse = arr; SCENE.pulseStart = start; SCENE.fps = fps || 30; },
    seek: function (t) { T.seek(Math.max(0, t * 1000)); scenePush(Math.max(0, t)); },
    rest: rest,
    shrink: shrink,
    /* the glow is light, not information: the safe area audit measures the
       words, so it turns the glow and the picture off first */
    decor: function (on) {
      document.body.classList.toggle("type-only", !on);
    },
    info: function () { return INFO; },
    /* every moment the timeline moves something, for the safe-area audit:
       one entry per tween of every target, [start, end, property, from, to]
       in seconds, walked off the built timeline itself so a staggered word is
       listed at its own time, not its group's */
    cues: function () {
      var out = [];
      if (!T) return out;
      for (var c = T._head; c; c = c._next)
        for (var w = c._head; w; w = w._next) {
          var s = (c._offset + w._startTime) / 1000,
              a = Number(w._fromNumber), b = Number(w._toNumber);
          out.push([s, s + w._changeDuration / 1000, String(w.property),
                    isFinite(a) ? a : null, isFinite(b) ? b : null]);
        }
      return out;
    }
  };
})();
