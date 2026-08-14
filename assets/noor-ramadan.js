/* ============================================================
   NOOR Season · the year engine
   ------------------------------------------------------------
   Loaded on every page of the Codex, all year, and asleep for
   most of it. On load it asks NOOR_HIJRI what today is and
   answers one question only: which phase of the year are we in.

   There are six answers and never more than one at a time.

     dormant      more than fourteen days before 1 Ramadan and
                  inside no other window. The site is untouched:
                  no class, no bar, no listener that shows. A
                  page in August is the same page it would be
                  with these files deleted, and that guarantee
                  outranks every feature below it.
     approach     the last fourteen days of Shaban. One calm bar
                  counting the days down. No theme yet.
     ramadan      1 Ramadan to the last day. The bar carries the
                  day of the month and a live countdown to iftar
                  or to the end of suhoor, and the slight Ramadan
                  theme goes on.
     eid-fitr     1 to 3 Shawwal. The bar becomes a greeting that
                  points at the Eid room, and the Ramadan theme
                  is replaced by the Eid one.
     dhul-hijjah  1 to 9 Dhul Hijjah, the ten best days. A quiet
                  bar pointing at the Hajj room. No theme change.
     eid-adha     10 to 13 Dhul Hijjah, the day of sacrifice and
                  the three days of Tashriq after it. The Eid
                  theme, and the bar points at the Eid room.

   Awake, it does exactly two things: it puts its classes on the
   html element, which is what noor-ramadan.css waits for, and it
   places one slim bar in the normal flow directly under the site
   header. The bar is in the flow on purpose, so it can never
   cover a line of anything, and it can be dismissed for the
   session.

   The owner's switches, so any phase can be inspected in July:
     ?season=approach     ?season=ramadan     ?season=eid-fitr
     ?season=dhul-hijjah  ?season=eid-adha    ?season=off
     ?season=auto         back to the calendar
     NOOR_RAMADAN.preview("eid-adha")   any phase, on any day
     NOOR_RAMADAN.preview(14)           day fourteen of the month
     NOOR_RAMADAN.refresh()             re-decide from the calendar
     NOOR_RAMADAN.state()               what it thinks is true
     NOOR_RAMADAN.phase()               the one word answer
   A preview is kept for the browser session, so the owner can
   walk the whole site inside a phase rather than one page of it.

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

  var VERSION = "2.0";
  var PREF_KEY = "noor_season";          /* session: a phase name, or off */
  var HIDE_KEY = "noor_ramadan_bar";     /* session: 1 when dismissed */
  var PLACE_KEY = "noor_place";          /* local: shared with the Ramadan room */
  var ROOM = "/ramadan";
  var EID_ROOM = "/eid";
  var HAJJ_ROOM = "/hajj";
  var RAMADAN_LEN = 30;                  /* the calculated month is always thirty */
  var APPROACH_DAYS = 14;                /* the countdown opens two weeks out */

  var DORMANT = "dormant";
  var PHASES = ["approach", "ramadan", "eid-fitr", "dhul-hijjah", "eid-adha"];

  /* how alive a room's tools are allowed to be in each phase. The Ramadan
     room reads this so the engine and the room can never disagree. */
  var RANK = {
    dormant: 0, approach: 1, ramadan: 2,
    "eid-fitr": 0, "dhul-hijjah": 0, "eid-adha": 0
  };

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
  function isPhase(v) { return PHASES.indexOf(v) !== -1; }

  /* ---- the owner's switch, read once and kept for the session ---- */
  var pref = safe(function () {
    var m = /[?&]season=([a-zA-Z-]+)/.exec(location.search || "");
    if (m) {
      var v = m[1].toLowerCase();
      /* the old spelling still works, and means the day of sacrifice's
         older sibling: one word, one phase */
      if (v === "eid") v = "eid-fitr";
      if (v === "adha") v = "eid-adha";
      if (v === "fitr") v = "eid-fitr";
      if (isPhase(v) || v === "off") { ss(PREF_KEY, v); return v; }
      if (v === "auto" || v === "reset" || v === "on") { ss(PREF_KEY, null); return ""; }
      return "";
    }
    var kept = ss(PREF_KEY);
    return (isPhase(kept) || kept === "off") ? kept : "";
  }, "") || "";

  var state = {
    active: false, phase: DORMANT, mode: "", day: 0, days: 0,
    preview: false, hijri: null, when: null
  };
  var forcedDay = 0;          /* a day of Ramadan the owner asked to see */
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

  /* ---- the prayer engine, only ever loaded inside the month ---- */
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

  /* ============================================================
     the phase function: one date in, one word out
     ============================================================ */
  function midnight(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }

  /* how many whole days from today to the next 1 Ramadan. Zero means today
     is the first of the month, and null means the calendar could not say. */
  function daysToRamadan(H, day) {
    return safe(function () {
      var nx = H.nextRamadan(day);
      if (!nx || !nx.date) return null;
      return H.daysBetween(day, nx.date);
    }, null);
  }

  /* The whole year, decided in one place. Given a Date it returns
     { phase, day, days, hijri } and nothing else ever decides this. */
  function readDay(H, day) {
    var h = safe(function () { return H.toHijri(day); }, null);
    if (!h) return null;

    /* the ninth month, from the first day to the last */
    if (h.hm === H.RAMADAN) {
      return { phase: "ramadan", day: h.hd, days: 0, hijri: h };
    }
    /* the first three days of Shawwal, which is Eid al-Fitr and the two
       days people actually keep with it */
    if (h.hm === H.SHAWWAL && h.hd <= 3) {
      return { phase: "eid-fitr", day: h.hd, days: 0, hijri: h };
    }
    /* the first nine days of the month of the pilgrimage, the ten best
       days of the year, the last of which is Arafah */
    if (h.hm === H.DHUL_HIJJAH && h.hd <= 9) {
      return { phase: "dhul-hijjah", day: h.hd, days: 9 - h.hd + 1, hijri: h };
    }
    /* the tenth, and the three days of Tashriq that follow it */
    if (h.hm === H.DHUL_HIJJAH && h.hd >= 10 && h.hd <= 13) {
      return { phase: "eid-adha", day: h.hd, days: 0, hijri: h };
    }
    /* and otherwise: is Ramadan close enough to start counting */
    var to = daysToRamadan(H, day);
    if (to !== null && to >= 1 && to <= APPROACH_DAYS) {
      return { phase: "approach", day: 0, days: to, hijri: h };
    }
    return { phase: DORMANT, day: 0, days: (to === null ? 0 : to), hijri: h };
  }

  /* the public form of the same question, safe to call at any hour */
  function phaseFor(date) {
    var H = window.NOOR_HIJRI;
    if (!H) return DORMANT;
    var d = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();
    var r = readDay(H, midnight(d));
    return r ? r.phase : DORMANT;
  }

  /* ---- a preview borrows a real day inside the phase asked for, so every
     number on the screen is a real number and the real code path runs ---- */
  function previewDay(H, want) {
    var now = midnight(new Date());
    return safe(function () {
      var nx;
      if (want === "approach") {
        nx = H.nextRamadan(now);
        if (!nx) return null;
        return new Date(nx.date.getFullYear(), nx.date.getMonth(), nx.date.getDate() - 9);
      }
      if (want === "ramadan") {
        nx = H.nextRamadan(now);
        if (!nx) return null;
        var n = forcedDay || 14;
        return H.toGregorian(nx.hy, H.RAMADAN, n);
      }
      if (want === "eid-fitr") {
        nx = H.nextEidAlFitr(now);
        return nx ? nx.date : null;
      }
      if (want === "dhul-hijjah") {
        nx = H.nextDhulHijjah(now);
        if (!nx) return null;
        return H.toGregorian(nx.hy, H.DHUL_HIJJAH, 5);
      }
      if (want === "eid-adha") {
        nx = H.nextEidAlAdha(now);
        return nx ? nx.date : null;
      }
      return null;
    }, null);
  }

  /* the day the whole engine is looking at: the real one, or the borrowed
     one a preview is standing on */
  function today() {
    var H = window.NOOR_HIJRI;
    var now = new Date();
    if (!H || !isPhase(pref)) return now;
    var d = previewDay(H, pref);
    if (!d) return now;
    /* keep the wall clock, move the calendar day, so a countdown inside a
       preview still ticks against the reader's own afternoon */
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(),
      now.getHours(), now.getMinutes(), now.getSeconds(), 0);
  }

  function decide(H) {
    if (pref === "off") return null;
    var day = today();
    var r = readDay(H, midnight(day));
    if (!r) return null;
    /* a preview only calls itself one when it is standing on a day that is
       not actually today. On the real first of Shawwal, it is not a preview. */
    var real = midnight(day).getTime() === midnight(new Date()).getTime();
    if (isPhase(pref) && r.phase !== pref) {
      /* the borrowed day did not land where it was asked to. Rather than
         lie about the calendar, say nothing. */
      return null;
    }
    if (r.phase === DORMANT) return null;
    return {
      phase: r.phase, day: r.day, days: r.days, hijri: r.hijri,
      when: day, preview: !real
    };
  }

  /* ---- the crescent, drawn rather than borrowed ------------------- */
  var MOON = ('<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M21.3 14.7A9.2 9.2 0 0 1 9.3 2.7a9.2 9.2 0 1 0 12 12z"/></svg>');
  /* a lamp for the two Eids, so the shape itself says which season it is */
  var LAMP = ('<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M12 2.2 13 5h-2zM8.6 5h6.8l1.6 3.2H7zM7 8.2h10l1.4 8.2a6.6 6.6 0 0 1-12.8 0zM9.6 21h4.8v1.2H9.6z"/></svg>');

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
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  var MONTHNAMES = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  var WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function longDate(d) {
    if (!d) return "";
    return WEEK[d.getDay()] + " " + d.getDate() + " " + MONTHNAMES[d.getMonth()];
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

  /* ============================================================
     the bar: one slim line, five faces
     ============================================================ */
  var LABEL = {
    approach: "Ramadan is near",
    ramadan: "Ramadan",
    "eid-fitr": "Eid al-Fitr",
    "dhul-hijjah": "The first ten days of Dhul Hijjah",
    "eid-adha": "Eid al-Adha"
  };

  function faceApproach(h) {
    var n = state.days;
    var head = (n === 1) ? "Ramadan begins tomorrow" : "Ramadan begins in " + plural(n, "day", "days");
    var start = safe(function () {
      var nx = window.NOOR_HIJRI.nextRamadan(midnight(state.when || new Date()));
      return nx ? nx.date : null;
    }, null);
    var mid = start
      ? ('<span class="nrb-c" id="nrb-c">The month opens on ' + longDate(start) +
        '<span class="nrb-at">, calculated, and your masjid decides</span>.</span>')
      : '<span class="nrb-c" id="nrb-c">Calculated, and your masjid decides.</span>';
    return {
      icon: MOON,
      head: head,
      day: (h.hd || "") + " " + (h.monthEn || "") + " " + (h.hy || ""),
      mid: mid,
      link: '<a class="nrb-link" href="' + ROOM + '">Prepare<span class="nrb-long"> for it</span></a>'
    };
  }

  function faceRamadan(h) {
    return {
      icon: MOON,
      head: (h.hd || state.day) + " Ramadan" + '<span class="nrb-yr"> ' + (h.hy || "") + "</span>",
      day: "Day " + state.day + " of " + RAMADAN_LEN,
      mid: '<span class="nrb-c" id="nrb-c"></span>',
      link: '<a class="nrb-link" href="' + ROOM + '">Ramadan<span class="nrb-long"> Room</span></a>'
    };
  }

  function faceEidFitr(h) {
    return {
      icon: LAMP,
      head: "Eid Mubarak",
      day: (h.hd || 1) + " Shawwal " + (h.hy || ""),
      mid: ('<span class="nrb-c" id="nrb-c">Taqabbal Allahu minna wa minkum' +
        '<span class="nrb-at">, may Allah accept from us and from you</span>.</span>'),
      link: '<a class="nrb-link" href="' + EID_ROOM + '">Eid<span class="nrb-long"> Room</span></a>'
    };
  }

  function faceDhulHijjah(h) {
    var left = state.days;
    var tail = (h.hd === 9)
      ? "Today is Arafah, the day the pilgrims stand."
      : "Arafah is in " + plural(Math.max(0, 9 - h.hd), "day", "days") + ".";
    return {
      icon: MOON,
      head: (h.hd || 1) + " Dhul Hijjah" + '<span class="nrb-yr"> ' + (h.hy || "") + "</span>",
      day: "The ten best days" + (left ? ", " + plural(left, "day", "days") + " left" : ""),
      mid: ('<span class="nrb-c" id="nrb-c">No days hold better deeds than these ten.' +
        '<span class="nrb-at"> ' + tail + "</span></span>"),
      link: '<a class="nrb-link" href="' + HAJJ_ROOM + '">Hajj<span class="nrb-long"> Room</span></a>'
    };
  }

  function faceEidAdha(h) {
    var d = h.hd || 10;
    var day = (d === 10) ? "10 Dhul Hijjah " + (h.hy || "")
      : d + " Dhul Hijjah, a day of Tashriq";
    var mid = (d === 10)
      ? ('<span class="nrb-c" id="nrb-c">Taqabbal Allahu minna wa minkum' +
        '<span class="nrb-at">, may Allah accept from us and from you</span>.</span>')
      : ('<span class="nrb-c" id="nrb-c">The days of Tashriq' +
        '<span class="nrb-at">: eating, drinking, and the remembrance of Allah</span>.</span>');
    return {
      icon: LAMP,
      head: "Eid Mubarak",
      day: day,
      mid: mid,
      link: '<a class="nrb-link" href="' + EID_ROOM + '">Eid<span class="nrb-long"> Room</span></a>'
    };
  }

  function face() {
    var h = state.hijri || {};
    if (state.phase === "approach") return faceApproach(h);
    if (state.phase === "ramadan") return faceRamadan(h);
    if (state.phase === "eid-fitr") return faceEidFitr(h);
    if (state.phase === "dhul-hijjah") return faceDhulHijjah(h);
    if (state.phase === "eid-adha") return faceEidAdha(h);
    return null;
  }

  function buildBar() {
    var f = face();
    if (!f) return null;
    var el = document.createElement("div");
    el.id = "noor-ramadan-bar";
    el.className = "nrb";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", LABEL[state.phase] || "The season");
    el.setAttribute("data-phase", state.phase);

    var pv = state.preview ? '<span class="nrb-pv">preview</span>' : "";
    /* the spans marked nrb-yr and nrb-at are the first things to go on a
       narrow screen, so the bar stays one slim line and never overlaps */
    el.innerHTML = '<div class="nrb-in">' +
      '<span class="nrb-moon">' + f.icon + "</span>" +
      '<span class="nrb-date"><b>' + f.head + "</b>" +
      '<span class="nrb-day">' + f.day + "</span></span>" +
      pv + f.mid + f.link +
      '<button type="button" class="nrb-x" aria-label="Hide this for now">×</button>' +
      "</div>";

    var x = el.querySelector(".nrb-x");
    if (x) x.addEventListener("click", function () { ss(HIDE_KEY, "1"); removeBar(); });
    return el;
  }

  /* the countdown, or the honest absence of one. Only the month has one. */
  function paintCount() {
    if (!bar || state.phase !== "ramadan") return;
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
    if (!bar) return;
    var host = document.getElementById("site-header");
    if (host && host.parentNode) host.parentNode.insertBefore(bar, host.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);
    lastCount = "";
    if (state.phase === "ramadan") {
      paintCount();
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
  var ALL_CLASSES = ["noor-season", "noor-ramadan", "noor-eid",
    "noor-phase-approach", "noor-phase-ramadan", "noor-phase-eid-fitr",
    "noor-phase-dhul-hijjah", "noor-phase-eid-adha"];

  function undress() {
    var root = document.documentElement;
    if (!root) return;
    for (var i = 0; i < ALL_CLASSES.length; i++) root.classList.remove(ALL_CLASSES[i]);
    safe(function () { root.removeAttribute("data-season"); });
  }

  function dress() {
    var root = document.documentElement;
    if (!root) return;
    undress();
    root.classList.add("noor-season");
    root.classList.add("noor-phase-" + state.phase);
    /* only two of the five phases change the skin at all */
    if (state.phase === "ramadan") root.classList.add("noor-ramadan");
    if (state.phase === "eid-fitr" || state.phase === "eid-adha") root.classList.add("noor-eid");
    safe(function () { root.setAttribute("data-season", state.phase); });
  }

  function announce() {
    safe(function () {
      window.dispatchEvent(new CustomEvent("noor:season", {
        detail: {
          phase: state.phase, day: state.day, days: state.days,
          preview: state.preview, active: state.active
        }
      }));
    });
  }

  function apply(found) {
    if (!found) {
      state = {
        active: false, phase: DORMANT, mode: "", day: 0, days: 0,
        preview: isPhase(pref) || pref === "off", hijri: null, when: null
      };
      removeBar();
      undress();
      announce();
      return;
    }
    state = {
      active: true,
      phase: found.phase,
      mode: found.phase === "ramadan" ? "ramadan"
        : (found.phase === "eid-fitr" || found.phase === "eid-adha") ? "eid" : found.phase,
      day: found.day, days: found.days, preview: found.preview,
      hijri: found.hijri, when: found.when
    };
    dress();
    if (document.body) { removeBar(); mountBar(); }
    else onReady(function () { removeBar(); mountBar(); });
    announce();
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
    PHASES: PHASES.slice(),
    DORMANT: DORMANT,
    APPROACH_DAYS: APPROACH_DAYS,

    /* the phase function itself, for anything that wants to ask directly */
    phaseFor: phaseFor,
    /* the phase this page is dressed in, preview and all */
    phase: function () { return state.active ? state.phase : DORMANT; },
    /* the day the engine is standing on, real or borrowed */
    today: today,
    /* how many days until the next 1 Ramadan, or null if it cannot say */
    daysToRamadan: function () {
      var H = window.NOOR_HIJRI;
      if (!H) return null;
      return daysToRamadan(H, midnight(today()));
    },
    /* the rank a room uses to decide which of its tools may wake */
    rank: function (p) { return RANK[p] || 0; },
    wakes: function (level) {
      return (RANK[state.active ? state.phase : DORMANT] || 0) >= (RANK[level] || 0);
    },

    /* look at any phase, or at any day of the month, at any time of year */
    preview: function (what) {
      var v = what;
      if (typeof v === "number" || /^\d+$/.test(String(v || ""))) {
        forcedDay = Math.max(1, Math.min(RAMADAN_LEN, parseInt(v, 10) || 1));
        v = "ramadan";
      } else {
        v = String(v || "").toLowerCase();
        if (v === "eid" || v === "fitr") v = "eid-fitr";
        if (v === "adha") v = "eid-adha";
        forcedDay = 0;
      }
      if (!isPhase(v)) return this.state();
      pref = v; ss(PREF_KEY, v); ss(HIDE_KEY, null);
      safe(run);
      return this.state();
    },
    on: function () { return this.preview("ramadan"); },
    off: function () { pref = "off"; ss(PREF_KEY, "off"); safe(run); return this.state(); },
    auto: function () { pref = ""; forcedDay = 0; ss(PREF_KEY, null); safe(run); return this.state(); },
    refresh: function () { forcedDay = 0; safe(run); return this.state(); },
    showBar: function () { ss(HIDE_KEY, null); if (state.active) safe(mountBar); },
    hideBar: function () { ss(HIDE_KEY, "1"); safe(removeBar); },
    state: function () {
      return {
        active: state.active,
        phase: state.active ? state.phase : DORMANT,
        mode: state.mode,
        day: state.day,
        days: state.days,
        preview: state.preview,
        hijri: state.hijri ? state.hijri.text : null,
        when: state.when ? state.when.toString() : null,
        place: place ? { lat: place.lat, lng: place.lng, method: place.method } : null,
        isCalculated: true,
        note: (window.NOOR_HIJRI && window.NOOR_HIJRI.shortNote) ||
          "Calculated, not sighted. Your masjid's announcement decides."
      };
    }
  };

  safe(run);
})();
