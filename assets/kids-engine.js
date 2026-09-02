/* NOOR Little Codex · kids engine v1
   One small file every children's room shares: sound with a volume control,
   spoken pronunciation, Qur'an recitation, a particle layer with real physics,
   spring presses, flying gems, and one way to save progress.
   No dependencies. Everything degrades: no AudioContext, no voices, no canvas,
   reduced motion, a blocked network: the room still works, quietly.

   window.NK
     sfx(name)                       tap pop ding chime sparkle whoosh wrong win cheer coin flip bubble splash drop level gem page
     say(text, {lang, rate})         speechSynthesis, prefers an Arabic voice for Arabic text; resolves false when it cannot speak
     recite(surah, ayah, {teacher})  ayah audio (Alafasy, or the Husary teaching recitation); resolves when it ends
     stopAudio()                     stops recitation and speech
     fx.burst(x, y, opts)            confetti | spark | star | bubble | heart, from a point (page coordinates)
     fx.burstAt(el, opts)            same, from the middle of an element
     fx.confetti(opts)               a rain from the top of the screen
     fx.shower()                     falling stars
     press(el) / release(el)         the squash and the spring back (buttons get this automatically)
     pop(el) / shake(el) / wobble(el)
     flyTo(from, to, {html})         an element flies along an arc to another element; returns a promise
     spring({from, to, stiffness, damping, onUpdate})
     tilt(el)                        3D tilt on devices with a mouse
     autoHideHeader(el)              header slides away on scroll down, back on scroll up
     done(key, extra) / progress(key) / save(key, data)   localStorage "nk-<key>" with {done:true}
     haptic(kind)                    light | success | error (Android)
     volume.get() / set(v) / mute(bool) / muted
     reduced                         prefers-reduced-motion
*/
(function () {
  "use strict";
  if (window.NK) return;
  var RM = false;
  try { RM = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var NK = { version: 1, reduced: RM };
  var doc = document;

  /* ---------- storage ---------- */
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  NK.progress = function (key) { var v = lsGet("nk-" + key, null); return v && typeof v === "object" && !Array.isArray(v) ? v : null; };
  NK.save = function (key, data) { var cur = NK.progress(key) || {}; var next = Object.assign({}, cur, data || {}); lsSet("nk-" + key, next); return next; };
  NK.done = function (key, extra) {
    var next = NK.save(key, Object.assign({}, extra || {}, { done: true, at: Date.now() }));
    try { doc.dispatchEvent(new CustomEvent("kids:done", { detail: { key: key, data: next } })); } catch (e) {}
    return next;
  };
  NK.clear = function (key) { try { localStorage.removeItem("nk-" + key); } catch (e) {} };

  /* ---------- audio core ---------- */
  var AC = null, master = null, vol = lsGet("nk-vol", 0.8), muted = lsGet("nk-mute", false) === true;
  if (typeof vol !== "number" || !(vol >= 0 && vol <= 1)) vol = 0.8;
  function ctx() {
    if (AC) return AC;
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try {
      AC = new C();
      var comp = AC.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 6;
      master = AC.createGain(); master.gain.value = muted ? 0 : vol;
      master.connect(comp); comp.connect(AC.destination);
    } catch (e) { AC = null; }
    return AC;
  }
  var unlocked = false;
  function unlock() {
    var a = ctx(); if (!a) return;
    if (a.state === "suspended") { try { a.resume(); } catch (e) {} }
    if (!unlocked) {
      unlocked = true;
      try { var b = a.createBuffer(1, 1, 22050), s = a.createBufferSource(); s.buffer = b; s.connect(a.destination); s.start(0); } catch (e) {}
      try { doc.dispatchEvent(new CustomEvent("kids:audio-ready")); } catch (e) {}
    }
  }
  ["pointerdown", "touchend", "keydown"].forEach(function (ev) { doc.addEventListener(ev, unlock, { passive: true }); });
  function applyVolume() {
    if (master) { try { master.gain.setTargetAtTime(muted ? 0 : vol, AC.currentTime, 0.02); } catch (e) { master.gain.value = muted ? 0 : vol; } }
    if (current) current.volume = muted ? 0 : vol;
    ui();
    try { doc.dispatchEvent(new CustomEvent("kids:volume", { detail: { volume: vol, muted: muted } })); } catch (e) {}
  }
  NK.volume = {
    get: function () { return muted ? 0 : vol; },
    set: function (v) { v = Math.max(0, Math.min(1, +v || 0)); vol = v; if (v > 0 && muted) muted = false; lsSet("nk-vol", vol); lsSet("nk-mute", muted); applyVolume(); },
    mute: function (m) { muted = m === undefined ? !muted : !!m; lsSet("nk-mute", muted); applyVolume(); return muted; }
  };
  Object.defineProperty(NK.volume, "muted", { get: function () { return muted; } });

  /* one white-noise second, made once */
  var noiseBuf = null;
  function noiseBuffer(a) {
    if (noiseBuf) return noiseBuf;
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function env(a, g, t0, peak, att, dur, curve) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + att);
    if (curve === "lin") g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    else g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }
  /* tone({f, f2, type, t, d, g, a, lp, hp, vib}) */
  function tone(o) {
    var a = ctx(); if (!a || muted) return;
    var t0 = a.currentTime + (o.t || 0), d = o.d || 0.2;
    var osc = a.createOscillator(); osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.fd || d));
    var g = a.createGain(); env(a, g, t0, o.g || 0.25, o.a || 0.006, d, o.curve);
    var node = osc;
    if (o.lp) { var lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = o.lp; node.connect(lp); node = lp; }
    if (o.hp) { var hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = o.hp; node.connect(hp); node = hp; }
    if (o.vib) { var lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = o.vib; lg.gain.value = o.vibDepth || 6; lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t0); lfo.stop(t0 + d + 0.05); }
    node.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + d + 0.05);
  }
  /* noise({t, d, g, bp, q, lp, hp, a}) */
  function noise(o) {
    var a = ctx(); if (!a || muted) return;
    var t0 = a.currentTime + (o.t || 0), d = o.d || 0.15;
    var s = a.createBufferSource(); s.buffer = noiseBuffer(a);
    var node = s;
    if (o.bp) { var bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(o.bp, t0); if (o.bp2) bp.frequency.exponentialRampToValueAtTime(o.bp2, t0 + d); bp.Q.value = o.q || 1; node.connect(bp); node = bp; }
    if (o.lp) { var lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = o.lp; node.connect(lp); node = lp; }
    if (o.hp) { var hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = o.hp; node.connect(hp); node = hp; }
    var g = a.createGain(); env(a, g, t0, o.g || 0.12, o.a || 0.004, d, o.curve);
    node.connect(g); g.connect(master);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + d + 0.05);
  }
  /* a bell: carrier plus a second partial, FM-ish, warm */
  function bell(f, t, d, g) {
    tone({ f: f, type: "sine", t: t, d: d, g: g, a: 0.004 });
    tone({ f: f * 2.01, type: "sine", t: t, d: d * 0.6, g: g * 0.35, a: 0.004 });
    tone({ f: f * 3.02, type: "sine", t: t, d: d * 0.35, g: g * 0.12, a: 0.004 });
  }
  var PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];
  var SFX = {
    tap: function () { tone({ f: 640, f2: 420, type: "sine", d: 0.07, g: 0.12 }); noise({ d: 0.03, g: 0.05, bp: 3000, q: 0.8 }); },
    pop: function () { tone({ f: 260, f2: 820, type: "sine", d: 0.11, g: 0.22, fd: 0.08 }); noise({ d: 0.04, g: 0.06, bp: 1800 }); },
    ding: function () { bell(1046.5, 0, 0.5, 0.22); },
    chime: function () { [0, 0.09, 0.18].forEach(function (t, i) { bell([659.25, 783.99, 1046.5][i], t, 0.55, 0.16); }); },
    sparkle: function () { for (var i = 0; i < 6; i++) tone({ f: PENTA[4 + Math.floor(Math.random() * 5)], type: "triangle", t: i * 0.045, d: 0.16, g: 0.09, a: 0.003 }); },
    whoosh: function () { noise({ d: 0.28, g: 0.16, bp: 500, bp2: 2400, q: 0.7, a: 0.05, curve: "lin" }); },
    wrong: function () { tone({ f: 240, f2: 190, type: "triangle", d: 0.16, g: 0.16, lp: 900 }); tone({ f: 180, f2: 150, type: "triangle", t: 0.14, d: 0.2, g: 0.14, lp: 800 }); },
    coin: function () { tone({ f: 987.77, type: "square", d: 0.08, g: 0.07, lp: 4000 }); tone({ f: 1318.51, type: "square", t: 0.08, d: 0.26, g: 0.07, lp: 4000 }); },
    flip: function () { noise({ d: 0.09, g: 0.09, bp: 900, bp2: 2600, q: 1.2 }); },
    bubble: function () { tone({ f: 320, f2: 760, type: "sine", d: 0.13, g: 0.16, vib: 30, vibDepth: 20 }); },
    splash: function () { noise({ d: 0.32, g: 0.16, lp: 900, a: 0.01 }); tone({ f: 180, f2: 90, type: "sine", d: 0.25, g: 0.12 }); },
    drop: function () { tone({ f: 780, f2: 160, type: "sine", d: 0.16, g: 0.16 }); },
    page: function () { noise({ d: 0.16, g: 0.07, bp: 1400, bp2: 600, q: 0.9 }); },
    level: function () { [0, 1, 2, 4, 5].forEach(function (n, i) { tone({ f: PENTA[n], type: "triangle", t: i * 0.07, d: 0.22, g: 0.12 }); }); },
    gem: function () { bell(1318.51, 0, 0.9, 0.2); bell(1975.53, 0.06, 0.7, 0.1); noise({ d: 0.12, g: 0.05, bp: 6000, q: 0.5 }); },
    win: function () {
      var seq = [[392, 0], [523.25, 0.12], [659.25, 0.24], [783.99, 0.36]];
      seq.forEach(function (p) { tone({ f: p[0], type: "triangle", t: p[1], d: 0.3, g: 0.14 }); tone({ f: p[0] / 2, type: "sine", t: p[1], d: 0.3, g: 0.08 }); });
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f) { tone({ f: f, type: "triangle", t: 0.5, d: 0.9, g: 0.09, a: 0.02 }); });
    },
    cheer: function () {
      SFX.win();
      /* applause: many short claps through a bandpass, swelling then fading */
      for (var i = 0, t = 0; i < 46; i++) {
        t += 0.028 + Math.random() * 0.05;
        var g = (t < 0.5 ? 0.05 + t * 0.16 : Math.max(0.02, 0.13 - (t - 0.5) * 0.09)) * (0.6 + Math.random() * 0.6);
        noise({ t: t, d: 0.045, g: g, bp: 1200 + Math.random() * 1600, q: 1.4, a: 0.002 });
      }
      for (var k = 0; k < 4; k++) tone({ f: 1400 + Math.random() * 900, f2: 2000 + Math.random() * 800, type: "sine", t: 0.3 + k * 0.22, d: 0.18, g: 0.03 });
    }
  };
  var FILES = window.NK_SFX_FILES || {};       /* optional real recordings: { cheer: "/assets/kids-sfx/cheer.mp3" } */
  var fileBuf = {};
  function playFile(name) {
    var a = ctx(); if (!a || muted) return false;
    var url = FILES[name]; if (!url) return false;
    if (fileBuf[name] === "bad") return false;
    if (fileBuf[name] && fileBuf[name] !== "loading") {
      try { var s = a.createBufferSource(); s.buffer = fileBuf[name]; s.connect(master); s.start(0); return true; } catch (e) { return false; }
    }
    if (!fileBuf[name]) {
      fileBuf[name] = "loading";
      fetch(url).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); })
        .then(function (b) { return a.decodeAudioData(b); })
        .then(function (buf) { fileBuf[name] = buf; })
        .catch(function () { fileBuf[name] = "bad"; });
    }
    return false;
  }
  var lastAt = {};
  NK.sfx = function (name) {
    try {
      var now = performance.now();
      if (lastAt[name] && now - lastAt[name] < 35) return;   /* two identical sounds in one frame is a click, not a sound */
      lastAt[name] = now;
      if (playFile(name)) return;
      var f = SFX[name]; if (f) f();
    } catch (e) {}
  };
  NK.sfx.names = Object.keys(SFX);

  /* ---------- speech: the teacher's voice ---------- */
  var voices = [];
  function loadVoices() { try { voices = window.speechSynthesis ? speechSynthesis.getVoices() || [] : []; } catch (e) { voices = []; } }
  loadVoices();
  try { if (window.speechSynthesis) speechSynthesis.addEventListener("voiceschanged", loadVoices); } catch (e) {}
  function pickVoice(lang) {
    var two = lang.slice(0, 2).toLowerCase();
    var cands = voices.filter(function (v) { return (v.lang || "").toLowerCase().indexOf(two) === 0; });
    if (!cands.length) return null;
    var pref = ["majed", "maged", "tarik", "laila", "mariam", "hoda", "naayf", "google", "natural", "premium", "enhanced"];
    cands.sort(function (a, b) {
      var sa = pref.findIndex(function (p) { return a.name.toLowerCase().indexOf(p) >= 0; }), sb = pref.findIndex(function (p) { return b.name.toLowerCase().indexOf(p) >= 0; });
      sa = sa < 0 ? 99 : sa; sb = sb < 0 ? 99 : sb;
      if (sa !== sb) return sa - sb;
      return (b.localService ? 0 : 1) - (a.localService ? 0 : 1);
    });
    return cands[0];
  }
  NK.canSay = function (lang) { loadVoices(); return !!pickVoice(lang || "ar-SA"); };
  NK.say = function (text, opts) {
    opts = opts || {};
    return new Promise(function (res) {
      try {
        var S = window.speechSynthesis;
        if (!S || muted || !text) { res(false); return; }
        loadVoices();
        var lang = opts.lang || (/[؀-ۿ]/.test(text) ? "ar-SA" : (doc.documentElement.lang || "en"));
        var v = pickVoice(lang);
        if (!v && lang.slice(0, 2) === "ar") { res(false); return; }   /* no Arabic voice: do not let an English voice mangle it */
        S.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.lang = v ? v.lang : lang; if (v) u.voice = v;
        u.rate = opts.rate || 0.82; u.pitch = opts.pitch || 1.05; u.volume = vol;
        var settled = false, end = function (ok) { if (!settled) { settled = true; res(ok); } };
        u.onend = function () { end(true); }; u.onerror = function () { end(false); };
        setTimeout(function () { end(true); }, 8000);
        S.speak(u);
      } catch (e) { res(false); }
    });
  };

  /* ---------- recitation ---------- */
  var COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
  var START = [0]; for (var ci = 0; ci < COUNTS.length; ci++) START.push(START[ci] + COUNTS[ci]);
  NK.ayahCount = function (s) { return COUNTS[s - 1] || 0; };
  function pad(n, w) { n = String(n); while (n.length < w) n = "0" + n; return n; }
  var current = null, currentToken = 0;
  NK.reciteSources = function (s, a, opts) {
    var g = START[s - 1] + a, list = [];
    if (opts && opts.teacher) list.push("https://everyayah.com/data/Husary_Muallim_128kbps/" + pad(s, 3) + pad(a, 3) + ".mp3");
    list.push("https://cdn.islamic.network/quran/audio/64/ar.alafasy/" + g + ".mp3",
              "https://everyayah.com/data/Alafasy_64kbps/" + pad(s, 3) + pad(a, 3) + ".mp3",
              "https://cdn.islamic.network/quran/audio/128/ar.alafasy/" + g + ".mp3");
    return list;
  };
  NK.stopAudio = function () {
    currentToken++;
    if (current) { try { current.pause(); current.src = ""; } catch (e) {} current = null; }
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    try { doc.dispatchEvent(new CustomEvent("kids:recite", { detail: { state: "stop" } })); } catch (e) {}
  };
  NK.recite = function (s, a, opts) {
    opts = opts || {};
    NK.stopAudio();
    var token = ++currentToken, list = NK.reciteSources(s, a, opts), i = 0;
    return new Promise(function (res) {
      if (muted && !opts.force) { res(false); return; }
      function next() {
        if (token !== currentToken) { res(false); return; }
        if (i >= list.length) { current = null; try { doc.dispatchEvent(new CustomEvent("kids:recite", { detail: { state: "failed", surah: s, ayah: a } })); } catch (e) {} res(false); return; }
        var au = new Audio(); current = au; au.preload = "auto"; au.volume = muted ? 0 : vol;
        au.src = list[i++];
        au.onended = function () { if (token === currentToken) { current = null; try { doc.dispatchEvent(new CustomEvent("kids:recite", { detail: { state: "ended", surah: s, ayah: a } })); } catch (e) {} res(true); } };
        au.onerror = function () { if (token === currentToken) next(); };
        var p = au.play();
        if (p && p.catch) p.catch(function () { if (token === currentToken) next(); });
        try { doc.dispatchEvent(new CustomEvent("kids:recite", { detail: { state: "play", surah: s, ayah: a } })); } catch (e) {}
      }
      next();
    });
  };
  doc.addEventListener("visibilitychange", function () { if (doc.hidden) NK.stopAudio(); });
  window.addEventListener("pagehide", NK.stopAudio);

  /* ---------- the particle layer ---------- */
  var cv = null, c2 = null, parts = [], loopOn = false, DPR = Math.min(2, window.devicePixelRatio || 1), W = 0, H = 0, lastT = 0;
  var MAX = RM ? 60 : 420;
  function canvas() {
    if (cv) return cv;
    try {
      cv = doc.createElement("canvas"); cv.id = "nk-fx"; cv.setAttribute("aria-hidden", "true");
      cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:90;display:block";
      doc.body.appendChild(cv); c2 = cv.getContext("2d", { alpha: true });
      size(); window.addEventListener("resize", size); window.addEventListener("orientationchange", size);
    } catch (e) { cv = null; }
    return cv;
  }
  function size() { if (!cv) return; W = window.innerWidth; H = window.innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); c2.setTransform(DPR, 0, 0, DPR, 0, 0); }
  var GOLD = ["#C9A227", "#E9C86A", "#FFF3C4", "#FFFEF7"];
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function add(p) { if (parts.length >= MAX) parts.shift(); parts.push(p); if (!loopOn) { loopOn = true; lastT = performance.now(); requestAnimationFrame(loop); } }
  function loop(t) {
    if (!cv) { loopOn = false; return; }
    var dt = Math.min(2.5, (t - lastT) / 16.67); lastT = t;
    c2.clearRect(0, 0, W, H);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life -= dt;
      if (p.life <= 0 || p.y > H + 40 || p.y < -60) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.vx *= Math.pow(p.drag, dt); p.vy *= Math.pow(p.drag, dt);
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.kind === "bubble") p.x += Math.sin(t / 300 + p.seed) * 0.4 * dt;
      var al = Math.min(1, p.life / 18) * p.alpha;
      c2.globalAlpha = al; c2.fillStyle = p.color;
      if (p.kind === "confetti") {
        c2.save(); c2.translate(p.x, p.y); c2.rotate(p.rot); c2.scale(1, Math.max(0.15, Math.abs(Math.cos(p.rot * 1.7 + p.seed))));
        c2.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c2.restore();
      } else if (p.kind === "spark") {
        c2.beginPath(); c2.arc(p.x, p.y, p.w * Math.max(0.2, p.life / p.life0), 0, 6.283); c2.fill();
      } else if (p.kind === "star") {
        c2.save(); c2.translate(p.x, p.y); c2.rotate(p.rot); var r = p.w, r2 = p.w * 0.36;
        c2.beginPath(); for (var k = 0; k < 8; k++) { var ang = k * Math.PI / 4, rr = k % 2 ? r2 : r; c2.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } c2.closePath(); c2.fill(); c2.restore();
      } else if (p.kind === "bubble") {
        c2.strokeStyle = p.color; c2.lineWidth = 1.5; c2.beginPath(); c2.arc(p.x, p.y, p.w, 0, 6.283); c2.stroke();
        c2.globalAlpha = al * 0.5; c2.beginPath(); c2.arc(p.x - p.w * 0.3, p.y - p.w * 0.3, p.w * 0.25, 0, 6.283); c2.fill();
      } else if (p.kind === "heart") {
        c2.save(); c2.translate(p.x, p.y); c2.rotate(p.rot); var s = p.w / 10;
        c2.beginPath(); c2.moveTo(0, 3 * s); c2.bezierCurveTo(-8 * s, -4 * s, -3 * s, -9 * s, 0, -4 * s); c2.bezierCurveTo(3 * s, -9 * s, 8 * s, -4 * s, 0, 3 * s); c2.fill(); c2.restore();
      }
    }
    c2.globalAlpha = 1;
    if (parts.length && !doc.hidden) requestAnimationFrame(loop); else { loopOn = false; c2.clearRect(0, 0, W, H); parts.length = 0; }
  }
  function burst(x, y, o) {
    o = o || {}; if (!canvas()) return;
    var n = o.n || 26; if (RM) n = Math.min(n, 10);
    var kind = o.kind || "confetti", cols = o.colors || GOLD, power = o.power || 1, spread = o.spread == null ? Math.PI * 2 : o.spread, dir = o.dir == null ? -Math.PI / 2 : o.dir;
    for (var i = 0; i < n; i++) {
      var ang = dir + (Math.random() - 0.5) * spread, sp = rnd(2.2, 7.5) * power;
      var p = { kind: kind, x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - (kind === "bubble" ? rnd(0.5, 1.5) : rnd(1, 3) * power),
        g: kind === "bubble" ? -0.02 : (kind === "spark" ? 0.12 : 0.24), drag: kind === "spark" ? 0.94 : 0.985, rot: rnd(0, 6.28), vr: rnd(-0.25, 0.25),
        w: kind === "confetti" ? rnd(5, 10) : (kind === "bubble" ? rnd(3, 9) : rnd(3, 7)), h: rnd(4, 9), color: cols[i % cols.length], seed: rnd(0, 6.28), alpha: 1 };
      p.life0 = p.life = kind === "spark" ? rnd(22, 40) : rnd(55, 95);
      add(p);
    }
  }
  NK.fx = {
    burst: burst,
    burstAt: function (el, o) { try { var r = (el.getBoundingClientRect ? el : doc.querySelector(el)).getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, o); } catch (e) {} },
    confetti: function (o) {
      o = o || {}; if (!canvas()) return;
      var n = o.n || 90; if (RM) n = Math.min(n, 14);
      var cols = o.colors || GOLD.concat(["#38bdf8", "#f9a8d4", "#5eead4", "#a78bfa"]);
      for (var i = 0; i < n; i++) {
        setTimeout((function (i) { return function () {
          add({ kind: "confetti", x: rnd(0, W), y: -12, vx: rnd(-1.2, 1.2), vy: rnd(1, 3), g: 0.06, drag: 0.995, rot: rnd(0, 6.28), vr: rnd(-0.2, 0.2), w: rnd(6, 11), h: rnd(5, 9), color: cols[i % cols.length], seed: rnd(0, 6.28), alpha: 1, life: 240, life0: 240 });
        }; })(i), (i / n) * (o.duration || 1400));
      }
    },
    shower: function (o) {
      o = o || {}; if (!canvas()) return;
      var n = o.n || 34; if (RM) n = Math.min(n, 8);
      for (var i = 0; i < n; i++) {
        setTimeout(function () { add({ kind: "star", x: rnd(0, W), y: -14, vx: rnd(-0.6, 0.2), vy: rnd(2.2, 4.5), g: 0.02, drag: 1, rot: rnd(0, 6.28), vr: rnd(-0.1, 0.1), w: rnd(3, 7), color: GOLD[Math.floor(rnd(0, 4))], seed: 0, alpha: 0.95, life: 260, life0: 260 }); }, Math.random() * (o.duration || 2200));
      }
    },
    sparkle: function (x, y) { burst(x, y, { kind: "spark", n: 8, power: 0.5, colors: ["#FFF3C4", "#E9C86A"] }); },
    clear: function () { parts.length = 0; }
  };

  /* ---------- springs ---------- */
  NK.spring = function (o) {
    var k = o.stiffness || 170, c = o.damping || 16, m = o.mass || 1, x = o.from || 0, v = o.velocity || 0, target = o.to || 0, on = false, raf = 0, last = 0;
    function step(t) {
      var dt = Math.min(0.05, (t - last) / 1000) || 0.016; last = t;
      var acc = (-k * (x - target) - c * v) / m; v += acc * dt; x += v * dt;
      if (o.onUpdate) o.onUpdate(x, v);
      if (Math.abs(v) < 0.002 && Math.abs(x - target) < 0.002) { x = target; v = 0; on = false; if (o.onUpdate) o.onUpdate(x, 0); if (o.onDone) o.onDone(); return; }
      raf = requestAnimationFrame(step);
    }
    var api = { set: function (t, kick) { target = t; if (kick) v += kick; if (!on) { on = true; last = performance.now(); raf = requestAnimationFrame(step); } return api; },
      stop: function () { on = false; cancelAnimationFrame(raf); }, get: function () { return x; } };
    if (o.to !== undefined && o.from !== undefined && o.to !== o.from) api.set(o.to);
    return api;
  };
  /* spring keyframes for WAAPI: scale settles from s0 to s1 with an overshoot that feels like a spring */
  function springFrames(s0, s1, k, c) {
    k = k || 260; c = c || 14; var x = s0, v = 0, fr = [], dt = 1 / 60, tt = 0;
    for (var i = 0; i < 60; i++) { var a = -k * (x - s1) - c * v; v += a * dt; x += v * dt; tt += dt; fr.push({ transform: "scale(" + x.toFixed(4) + ")", offset: Math.min(1, i / 59) }); if (i > 12 && Math.abs(v) < 0.02 && Math.abs(x - s1) < 0.002) break; }
    fr[fr.length - 1] = { transform: "scale(" + s1 + ")", offset: 1 };
    return fr;
  }
  var canAdd = true;
  function anim(el, frames, opts) {
    if (!el || !el.animate) return null;
    try { return el.animate(frames, Object.assign({ duration: 400, easing: "ease-out", composite: canAdd ? "add" : "replace" }, opts || {})); }
    catch (e) { if (canAdd) { canAdd = false; return anim(el, frames, opts); } return null; }
  }
  NK.press = function (el) { if (!el || RM) return; anim(el, [{ transform: "scale(1)" }, { transform: "scale(0.93)" }], { duration: 90, fill: "forwards" }); el.__nkPressed = true; };
  NK.release = function (el) { if (!el || !el.__nkPressed) return; el.__nkPressed = false; if (RM) return; try { el.getAnimations().forEach(function (a) { if (a.effect && a.effect.getKeyframes().length === 2) a.cancel(); }); } catch (e) {} anim(el, springFrames(0.93, 1, 300, 12), { duration: 520 }); };
  NK.pop = function (el, o) { if (!el) return; o = o || {}; if (RM) { el.style.opacity = ""; return; } anim(el, [{ transform: "scale(" + (o.from || 0.5) + ")", opacity: 0 }, { transform: "scale(1.06)", opacity: 1, offset: 0.55 }, { transform: "scale(0.985)", offset: 0.8 }, { transform: "scale(1)", opacity: 1 }], { duration: o.duration || 480, easing: "cubic-bezier(.22,1,.36,1)", composite: "replace" }); };
  NK.shake = function (el) { if (!el || RM) return; anim(el, [{ transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(6px)" }, { transform: "translateX(-4px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }], { duration: 380, easing: "ease-in-out" }); };
  NK.wobble = function (el) { if (!el || RM) return; anim(el, [{ transform: "rotate(0)" }, { transform: "rotate(-6deg)" }, { transform: "rotate(5deg)" }, { transform: "rotate(-3deg)" }, { transform: "rotate(0)" }], { duration: 450 }); };
  NK.bounce = function (el) { if (!el || RM) return; anim(el, [{ transform: "translateY(0)" }, { transform: "translateY(-14px)", offset: 0.35 }, { transform: "translateY(0)", offset: 0.7 }, { transform: "translateY(-5px)", offset: 0.85 }, { transform: "translateY(0)" }], { duration: 560, easing: "cubic-bezier(.34,1.56,.64,1)" }); };

  /* an element flies from A to B along an arc, on a fixed layer, and lands with a little squash */
  NK.flyTo = function (from, to, o) {
    o = o || {};
    return new Promise(function (res) {
      try {
        var fr = from.getBoundingClientRect ? from.getBoundingClientRect() : from, tr = to.getBoundingClientRect ? to.getBoundingClientRect() : to;
        var fl = doc.createElement("div"); fl.className = "nk-flyer"; fl.setAttribute("aria-hidden", "true");
        fl.innerHTML = o.html || (from.outerHTML || "");
        var w = o.size || Math.min(fr.width, 96), s0 = fr.width / w, s1 = (o.scaleTo != null ? o.scaleTo : Math.max(0.3, Math.min(tr.width, tr.height) / w));
        fl.style.cssText = "position:fixed;left:0;top:0;width:" + w + "px;height:" + w + "px;z-index:95;pointer-events:none;will-change:transform";
        doc.body.appendChild(fl);
        var x0 = fr.left + fr.width / 2 - w / 2, y0 = fr.top + fr.height / 2 - w / 2, x1 = tr.left + tr.width / 2 - w / 2, y1 = tr.top + tr.height / 2 - w / 2;
        var lift = o.arc == null ? Math.max(70, Math.abs(x1 - x0) * 0.35) : o.arc, frames = [], N = 28;
        for (var i = 0; i <= N; i++) { var t = i / N, e = 1 - Math.pow(1 - t, 2.2), x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e - Math.sin(t * Math.PI) * lift, sc = s0 + (s1 - s0) * e, rot = (o.spin || 0) * t; frames.push({ transform: "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(" + sc.toFixed(3) + ") rotate(" + rot + "deg)", offset: t }); }
        var dur = RM ? 1 : (o.duration || 900);
        var a = fl.animate(frames, { duration: dur, easing: "linear", fill: "forwards" });
        var ended = false, end = function () { if (ended) return; ended = true; fl.remove(); res(true); };
        a.onfinish = end; a.oncancel = end; setTimeout(end, dur + 120);
      } catch (e) { res(false); }
    });
  };

  /* ---------- 3D tilt for mice ---------- */
  var hoverFine = false; try { hoverFine = matchMedia("(hover:hover) and (pointer:fine)").matches; } catch (e) {}
  NK.tilt = function (el, max) {
    if (!el || !hoverFine || RM) return;
    max = max || 7; el.classList.add("nk-tilt");
    el.addEventListener("pointermove", function (e) { var r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5; el.style.setProperty("--nk-ry", (px * max * 2).toFixed(2) + "deg"); el.style.setProperty("--nk-rx", (-py * max * 2).toFixed(2) + "deg"); el.style.setProperty("--nk-gx", ((px + 0.5) * 100).toFixed(1) + "%"); el.style.setProperty("--nk-gy", ((py + 0.5) * 100).toFixed(1) + "%"); });
    el.addEventListener("pointerleave", function () { el.style.setProperty("--nk-ry", "0deg"); el.style.setProperty("--nk-rx", "0deg"); });
  };

  /* ---------- header that gets out of the way ---------- */
  NK.autoHideHeader = function (el) {
    if (!el) return; var last = window.scrollY, ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () { var y = window.scrollY; if (y > last + 6 && y > 90) el.classList.add("nk-hidden"); else if (y < last - 6 || y < 40) el.classList.remove("nk-hidden"); last = y; ticking = false; });
    }, { passive: true });
  };

  /* ---------- haptics (Android; iOS ignores) ---------- */
  NK.haptic = function (kind) { try { if (!navigator.vibrate) return; navigator.vibrate(kind === "success" ? [12, 40, 22] : kind === "error" ? [40] : 9); } catch (e) {} };

  /* ---------- counting numbers ---------- */
  NK.countTo = function (el, to, o) {
    o = o || {}; var from = o.from || 0, dur = o.dur || 900, t0 = performance.now(), fmt = o.fmt || function (v) { return Math.round(v).toLocaleString("en-US"); };
    if (RM) { el.textContent = fmt(to); return; }
    (function step(t) { var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); })(t0);
  };

  /* ---------- automatic press feedback and tap sounds ---------- */
  var PRESS_SEL = "button,[role=button],[data-nk-press],.kpill,.w-card,.w-hero,.w-sky,.wgo-c,.cta,.tomap";
  function pressTarget(t) { var el = t && t.closest ? t.closest(PRESS_SEL) : null; if (!el || el.closest(".nk-sound") || el.hasAttribute("data-nk-silent") || el.disabled) return null; return el; }
  var pressed = null;
  doc.addEventListener("pointerdown", function (e) {
    if (e.button && e.button !== 0) return;
    var el = pressTarget(e.target); if (!el) return;
    pressed = el; NK.press(el);
    if (!el.hasAttribute("data-nk-quiet")) NK.sfx("tap");
  }, { passive: true });
  function up() { if (pressed) { NK.release(pressed); pressed = null; } }
  doc.addEventListener("pointerup", up, { passive: true }); doc.addEventListener("pointercancel", up, { passive: true });
  doc.addEventListener("pointerleave", up, { passive: true }); window.addEventListener("blur", up);

  /* ---------- the sound pill ---------- */
  var pill = null, pop = null, rng = null, mBtn = null;
  function icon(m) {
    return m ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>'
             : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  }
  function ui() {
    if (!pill) return;
    mBtn.innerHTML = icon(muted); mBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    pill.classList.toggle("is-muted", muted);
    if (rng && doc.activeElement !== rng) rng.value = Math.round((muted ? 0 : vol) * 100);
  }
  function buildPill() {
    if (pill || !doc.body || window.NK_NO_PILL) return;
    pill = doc.createElement("div"); pill.className = "nk-sound"; pill.setAttribute("data-nk-silent", "");
    pill.innerHTML = '<button type="button" class="nk-sound-btn" id="nk-sound-btn" aria-label="Sound" aria-expanded="false" data-nk-silent></button>' +
      '<div class="nk-sound-pop" id="nk-sound-pop" hidden><span class="nk-sound-t">Sound</span>' +
      '<input class="nk-sound-rng" id="nk-sound-rng" type="range" min="0" max="100" step="1" aria-label="Volume" data-nk-silent>' +
      '<button type="button" class="nk-sound-mute" id="nk-sound-mute" data-nk-silent></button></div>';
    doc.body.appendChild(pill);
    mBtn = pill.querySelector("#nk-sound-btn"); pop = pill.querySelector("#nk-sound-pop"); rng = pill.querySelector("#nk-sound-rng");
    var mute = pill.querySelector("#nk-sound-mute");
    function label() { mute.textContent = muted ? "Sound on" : "Mute"; }
    mBtn.addEventListener("click", function () { var open = pop.hidden; pop.hidden = !open; mBtn.setAttribute("aria-expanded", open ? "true" : "false"); if (open) { unlock(); NK.sfx("pop"); } });
    rng.addEventListener("input", function () { NK.volume.set(rng.value / 100); label(); });
    rng.addEventListener("change", function () { unlock(); NK.sfx("ding"); });
    mute.addEventListener("click", function () { NK.volume.mute(); label(); if (!muted) { unlock(); NK.sfx("pop"); } });
    doc.addEventListener("click", function (e) { if (!pop.hidden && !pill.contains(e.target)) { pop.hidden = true; mBtn.setAttribute("aria-expanded", "false"); } });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pop.hidden) { pop.hidden = true; mBtn.setAttribute("aria-expanded", "false"); } });
    label(); ui();
  }
  function init() { buildPill(); try { doc.dispatchEvent(new CustomEvent("kids:engine")); } catch (e) {} }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
  NK.ready = function (fn) { if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { fn(NK); }); else fn(NK); };

  window.NK = NK;
})();
