/* ============================================================
   NOOR Ramadan · the season engine
   ------------------------------------------------------------
   Loaded on every page of the Codex, all year, and asleep for
   eleven months of it. On load it asks NOOR_HIJRI what today is.
   It wakes only when the Hijri month is Ramadan, the ninth, or
   when it is the first day of Shawwal, which is Eid al-Fitr, and
   on that one day it becomes a greeting and then goes back to
   sleep for a year.

   Awake, it does exactly two things: it puts the class `ramadan`
   on the html element, which is what noor-ramadan.css waits for,
   and it places one slim bar in the normal flow directly under
   the site header. The bar is in the flow on purpose, so it can
   never cover a line of anything, and it can be dismissed for
   the session.

   The owner's switches, so the season can be inspected in July:
     ?season=ramadan   force it on,  kept for this browser session
     ?season=off       force it off, kept for this browser session
     NOOR_RAMADAN.preview(14)      look at day fourteen
     NOOR_RAMADAN.preview("eid")   look at the Eid greeting
     NOOR_RAMADAN.refresh()        re-decide from the calendar
     NOOR_RAMADAN.state()          what it thinks is true

   Resilience is the whole design. If NOOR_HIJRI is missing, if
   the prayer engine will not load, if geolocation is refused, if
   storage is walled off, or if anything at all throws, the page
   is left exactly as it was. Every entry point is wrapped, and
   a time is never guessed: no location means no times and an
   invitation, because a wrong time here is worse than none.
   ============================================================ */
(function () {
  "use strict";

  /* never twice on one page, however many tags point at this file */
  if (window.NOOR_RAMADAN) return;

  var VERSION = "1.0";
  var PREF_KEY = "noor_season";          /* session: ramadan | off */
  var HIDE_KEY = "noor_ramadan_bar";     /* session: 1 when dismissed */
  var PLACE_KEY = "noor_place";          /* local: shared with the Ramadan room */
  var ROOM = "/ramadan";
  var RAMADAN_LEN = 30;                  /* the calculated month is always thirty */

  var SELF = "";
  try { SELF = (document.currentScript && document.currentScript.src) || ""; } catch (e) {}

  function safe(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }
  function near(rel) {
    return safe(function () { return new URL(rel, SELF || location.href).href; }, rel);
  }
  function ss(key, val) {
    return safe(function () {
      if (val === undefined) return window.sessionStorage.getItem(key);
      if (val === null) { window.sessionStorage.removeItem(key); return null; }
      window.sessionStorage.setItem(key, val); return val;
    }, null);
  }

  /* ---- the owner's switch, read once and kept for the session ---- */
  var pref = safe(function () {
    var m = /[?&]season=([a-zA-Z]+)/.exec(location.search || "");
    if (m) {
      var v = m[1].toLowerCase();
      if (v === "ramadan" || v === "off") { ss(PREF_KEY, v); return v; }
      if (v === "auto" || v === "reset") { ss(PREF_KEY, null); return ""; }
      return "";
    }
    var kept = ss(PREF_KEY);
    return (kept === "ramadan" || kept === "off") ? kept : "";
  }, "") || "";

  var state = { active: false, mode: "", day: 0, preview: false, hijri: null, times: null };
  var forcedDay = 0;          /* 0 means: use the real day, or day one in preview */
  var forcedEid = false;
  var bar = null, ticker = null, lastCount = "", triedHijri = false, triedSalat = false;
  var place = safe(function () {
    return JSON.parse(window.localStorage.getItem(PLACE_KEY) || "null");
  }, null);
  if (place && (typeof place.lat !== "number" || typeof place.lng !== "number")) place = null;

  /* ---- the calendar engine, fetched from beside this file if absent ---- */
  /* if a page already carries a tag for this file, wait for it rather than
     asking the network for a second copy of the same engine */
  function pending(src, cb) {
    return safe(function () {
      var tags = document.querySelectorAll('script[src]'), i, t;
      for (i = 0; i < tags.length; i++) {
        t = tags[i];
        if (t.src === src) { t.addEventListener("load", cb); return true; }
      }
      return false;
    }, false);
  }

  function withHijri(cb) {
    if (window.NOOR_HIJRI) { safe(function () { cb(window.NOOR_HIJRI); }); return; }
    if (triedHijri) return;
    triedHijri = true;
    var url = near("noor-hijri.js");
    if (pending(url, function () { if (window.NOOR_HIJRI) safe(function () { cb(window.NOOR_HIJRI); }); })) return;
    safe(function () {
      var s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = function () {
        if (window.NOOR_HIJRI) safe(function () { cb(window.NOOR_HIJRI); });
      };
      s.onerror = function () {};   /* no calendar, no season, no harm */
      (document.head || document.documentElement).appendChild(s);
    });
  }

  /* ---- the prayer engine, only ever loaded inside the season ---- */
  function withSalat(cb) {
    if (window.NOOR_SALAT) { safe(cb); return; }
    if (triedSalat) return;
    triedSalat = true;
    var url = near("../masjid/salat.js");
    if (pending(url, function () { if (window.NOOR_SALAT) safe(cb); })) return;
    safe(function () {
      var s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = function () { if (window.NOOR_SALAT) safe(cb); };
      s.onerror = function () {};   /* no engine, no times, and we say so */
      (document.head || document.documentElement).appendChild(s);
    });
  }

  /* ---- what is today, really ------------------------------------- */
  function decide(H) {
    var h = safe(function () { return H.toHijri(new Date()); }, null);
    if (!h) return null;

    if (forcedEid) return previewEid(H, h);
    if (forcedDay) return previewDay(H, h, forcedDay);

    if (h.isRamadan) return { mode: "ramadan", day: h.hd, hijri: h, preview: false };
    if (h.isEidAlFitr) return { mode: "eid", day: 0, hijri: h, preview: false };
    if (pref === "ramadan") return previewDay(H, h, 1);
    return null;
  }

  /* a preview borrows the coming Ramadan so the numbers on screen are real */
  function comingYear(H, h) {
    if (h.hm === 9) return h.hy;
    var nx = safe(function () { return H.nextRamadan(new Date()); }, null);
    return nx ? nx.hy : h.hy;
  }
  function previewDay(H, h, n) {
    n = Math.max(1, Math.min(RAMADAN_LEN, parseInt(n, 10) || 1));
    var real = h.isRamadan && n === h.hd;
    var hy = comingYear(H, h);
    var shown = safe(function () {
      var d = H.toGregorian(hy, 9, n);
      return d ? H.toHijri(d) : null;
    }, null);
    return { mode: "ramadan", day: n, hijri: shown || h, preview: !real };
  }
  function previewEid(H, h) {
    var real = h.isEidAlFitr;
    var hy = comingYear(H, h);
    var shown = safe(function () {
      var d = H.eidAlFitr(hy);
      return d ? H.toHijri(d) : null;
    }, null);
    return { mode: "eid", day: 0, hijri: shown || h, preview: !real };
  }

  /* ---- the crescent, drawn rather than borrowed ------------------- */
  var MOON = ('<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M21.3 14.7A9.2 9.2 0 0 1 9.3 2.7a9.2 9.2 0 1 0 12 12z"/></svg>');

  function fmtTime(h) {
    if (window.NOOR_FMT_TIME) return window.NOOR_FMT_TIME(h, false);
    return "";
  }
  function gap(hours) {
    var s = Math.max(0, Math.round(hours * 3600));
    var hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), sec = s % 60;
    if (hh > 0) return hh + "h " + mm + "m";
    if (mm > 0) return mm + "m " + (sec < 10 ? "0" : "") + sec + "s";
    return sec + "s";
  }

  /* ---- the next thing that happens where the reader is ------------ */
  function nextEvent() {
    if (!place || !window.NOOR_SALAT) return null;
    return safe(function () {
      var opt = { method: place.method || "ISNA", asr: place.asr || "standard" };
      var now = new Date();
      var t = window.NOOR_SALAT(now, place.lat, place.lng, opt);
      if (!t || t.fajr === null || t.maghrib === null) return { none: true };
      var h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
      if (h < t.fajr) return { what: "suhoor ends", left: t.fajr - h, at: t.fajr, est: !!t.estimated };
      if (h < t.maghrib) return { what: "iftar", left: t.maghrib - h, at: t.maghrib, est: !!t.estimated };
      var t2 = window.NOOR_SALAT(new Date(now.getTime() + 86400000), place.lat, place.lng, opt);
      if (!t2 || t2.fajr === null) return { none: true };
      return { what: "suhoor ends", left: (24 - h) + t2.fajr, at: t2.fajr, est: !!t2.estimated };
    }, { none: true });
  }

  /* ---- the bar ---------------------------------------------------- */
  function buildBar() {
    var el = document.createElement("div");
    el.id = "noor-ramadan-bar";
    el.className = "nrb";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", state.mode === "eid" ? "Eid al-Fitr" : "Ramadan");

    var h = state.hijri || {};
    var pv = state.preview ? '<span class="nrb-pv">preview</span>' : "";
    var mid, right;

    /* the spans marked nrb-yr and nrb-at are the first things to go on a
       narrow screen, so the bar stays one slim line and never overlaps */
    if (state.mode === "eid") {
      mid = ('<span class="nrb-c" id="nrb-c">Taqabbal Allahu minna wa minkum' +
        '<span class="nrb-at">, may Allah accept from us and from you</span>.</span>');
      right = '<a class="nrb-link" href="' + ROOM + '#eid">Eid<span class="nrb-long"> morning</span></a>';
      el.innerHTML = '<div class="nrb-in">' +
        '<span class="nrb-moon">' + MOON + "</span>" +
        '<span class="nrb-date"><b>Eid Mubarak</b>' +
        '<span class="nrb-day">1 Shawwal ' + (h.hy || "") + "</span></span>" +
        pv + mid + right +
        '<button type="button" class="nrb-x" aria-label="Hide this for now">×</button>' +
        "</div>";
    } else {
      mid = '<span class="nrb-c" id="nrb-c"></span>';
      right = '<a class="nrb-link" href="' + ROOM + '">Ramadan<span class="nrb-long"> Room</span></a>';
      el.innerHTML = '<div class="nrb-in">' +
        '<span class="nrb-moon">' + MOON + "</span>" +
        '<span class="nrb-date"><b>' + (h.hd || state.day) + " Ramadan" +
        '<span class="nrb-yr"> ' + (h.hy || "") + "</span></b>" +
        '<span class="nrb-day">Day ' + state.day + " of " + RAMADAN_LEN + "</span></span>" +
        pv + mid + right +
        '<button type="button" class="nrb-x" aria-label="Hide this for now">×</button>' +
        "</div>";
    }

    var x = el.querySelector(".nrb-x");
    if (x) x.addEventListener("click", function () { ss(HIDE_KEY, "1"); removeBar(); });
    return el;
  }

  /* the countdown, or the honest absence of one */
  function paintCount() {
    if (!bar || state.mode === "eid") return;
    var slot = bar.querySelector("#nrb-c");
    if (!slot) return;

    if (!place) {
      if (lastCount !== "ask") {
        lastCount = "ask";
        slot.innerHTML = 'No times yet. <button type="button" class="nrb-set">Set your place</button>';
        var b = slot.querySelector(".nrb-set");
        if (b) b.addEventListener("click", askPlace);
      }
      return;
    }
    if (!window.NOOR_SALAT) {
      if (lastCount !== "wait") { lastCount = "wait"; slot.textContent = "working out your times"; }
      return;
    }
    var e = nextEvent();
    if (!e || e.none) {
      if (lastCount !== "none") {
        lastCount = "none";
        slot.innerHTML = 'The sun does not reach that angle here today, so no honest time can be ' +
          'given. <a href="' + ROOM + '#today">What to do instead</a>';
      }
      return;
    }
    var txt = "<b>" + gap(e.left) + "</b> to " + e.what +
      (e.at != null && fmtTime(e.at) ? '<span class="nrb-at">, at ' + fmtTime(e.at) + "</span>" : "") +
      (e.est ? '<span class="nrb-at"> (estimated)</span>' : "");
    if (txt !== lastCount) { lastCount = txt; slot.innerHTML = txt; }
  }

  /* the only place a permission prompt can appear, and only on a click */
  function askPlace() {
    var slot = bar && bar.querySelector("#nrb-c");
    if (!navigator.geolocation) { sendToRoom(slot); return; }
    if (slot) { slot.textContent = "asking your browser"; lastCount = "asking"; }
    safe(function () {
      navigator.geolocation.getCurrentPosition(function (p) {
        setPlace(p.coords.latitude, p.coords.longitude);
      }, function () { sendToRoom(slot); }, { timeout: 10000, maximumAge: 600000 });
    });
  }
  function sendToRoom(slot) {
    lastCount = "room";
    if (slot) {
      slot.innerHTML = 'No location, which is your right. <a href="' + ROOM +
        '#today">Enter it by hand</a>';
    }
  }
  function setPlace(lat, lng) {
    place = {
      lat: lat, lng: lng,
      method: (place && place.method) || "ISNA",
      asr: (place && place.asr) || "standard"
    };
    safe(function () { window.localStorage.setItem(PLACE_KEY, JSON.stringify(place)); });
    lastCount = "";
    withSalat(paintCount);
    paintCount();
  }

  /* quiet geolocation: only when the reader has already said yes, so the
     season never throws a permission prompt at anybody unasked */
  function quietGeo() {
    if (place || !navigator.geolocation) return;
    safe(function () {
      if (!navigator.permissions || !navigator.permissions.query) return;
      var q = navigator.permissions.query({ name: "geolocation" });
      if (!q || !q.then) return;
      q.then(function (p) {
        if (p && p.state === "granted") {
          navigator.geolocation.getCurrentPosition(function (pos) {
            setPlace(pos.coords.latitude, pos.coords.longitude);
          }, function () {}, { timeout: 8000, maximumAge: 900000 });
        }
      })["catch"](function () {});
    });
  }

  function mountBar() {
    if (bar || ss(HIDE_KEY) === "1") return;
    if (!document.body) return;
    bar = buildBar();
    var host = document.getElementById("site-header");
    if (host && host.parentNode) host.parentNode.insertBefore(bar, host.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);
    lastCount = "";
    paintCount();
    if (state.mode !== "eid") {
      if (place) withSalat(paintCount); else quietGeo();
      if (!ticker) ticker = window.setInterval(function () { safe(paintCount); }, 1000);
    }
  }

  function removeBar() {
    if (ticker) { window.clearInterval(ticker); ticker = null; }
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    bar = null;
    lastCount = "";
  }

  /* ---- turning the season on and off ------------------------------ */
  function dress() {
    var root = document.documentElement;
    if (!root) return;
    root.classList.add("ramadan");
    if (state.mode === "eid") root.classList.add("eid"); else root.classList.remove("eid");
  }
  function undress() {
    var root = document.documentElement;
    if (!root) return;
    root.classList.remove("ramadan");
    root.classList.remove("eid");
  }

  function apply(found) {
    if (!found) {
      state = { active: false, mode: "", day: 0, preview: false, hijri: null, times: null };
      removeBar();
      undress();
      return;
    }
    state = {
      active: true, mode: found.mode, day: found.day, preview: found.preview,
      hijri: found.hijri, times: null
    };
    dress();
    if (document.body) { removeBar(); mountBar(); }
    else onReady(function () { removeBar(); mountBar(); });
  }

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { safe(fn); });
    } else { safe(fn); }
  }

  function run() {
    if (pref === "off") { apply(null); return; }
    withHijri(function (H) { apply(decide(H)); });
  }

  /* the reader may nudge the calendar from the Ramadan room while a
     page is open; the season follows them without a reload */
  safe(function () {
    window.addEventListener("noor:hijri-offset", function () { safe(run); });
  });

  /* ---- the small public face -------------------------------------- */
  window.NOOR_RAMADAN = {
    version: VERSION,
    /* look at any day of the month, at any time of year */
    preview: function (day) {
      forcedEid = (day === "eid" || day === "Eid" || day > RAMADAN_LEN);
      forcedDay = forcedEid ? 0 : Math.max(1, Math.min(RAMADAN_LEN, parseInt(day, 10) || 1));
      pref = "ramadan"; ss(PREF_KEY, "ramadan"); ss(HIDE_KEY, null);
      safe(run);
      return this.state();
    },
    on: function () { pref = "ramadan"; ss(PREF_KEY, "ramadan"); ss(HIDE_KEY, null); safe(run); return this.state(); },
    off: function () { pref = "off"; ss(PREF_KEY, "off"); safe(run); return this.state(); },
    auto: function () { pref = ""; forcedDay = 0; forcedEid = false; ss(PREF_KEY, null); safe(run); return this.state(); },
    refresh: function () { forcedDay = 0; forcedEid = false; safe(run); return this.state(); },
    showBar: function () { ss(HIDE_KEY, null); if (state.active) safe(mountBar); },
    hideBar: function () { ss(HIDE_KEY, "1"); safe(removeBar); },
    state: function () {
      return {
        active: state.active, mode: state.mode, day: state.day, preview: state.preview,
        hijri: state.hijri ? state.hijri.text : null,
        place: place ? { lat: place.lat, lng: place.lng, method: place.method } : null,
        isCalculated: true,
        note: (window.NOOR_HIJRI && window.NOOR_HIJRI.shortNote) ||
          "Calculated, not sighted. Your masjid's announcement decides."
      };
    }
  };

  safe(run);
})();
