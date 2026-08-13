/* ============================================================
   NOOR Hijri · the calculated calendar
   ------------------------------------------------------------
   The tabular Islamic calendar, the arithmetic one, in the form
   most widely used for civil work: a thirty year cycle in which
   the years 2, 5, 7, 10, 13, 16, 18, 21, 24, 26 and 29 carry an
   extra day, and the months alternate thirty and twenty nine.

   This is arithmetic, not the sky. It does not see the crescent
   and it never will. It is here so a page can know roughly what
   month it is without asking anyone for anything. Your masjid's
   announcement is the date. This is the estimate that waits for
   it, and it can be nudged by up to three days in either
   direction because moonsighting differs from place to place.

   window.NOOR_HIJRI
     .toHijri(dateOrNothing)      -> { hy, hm, hd, ... }
     .toGregorian(hy, hm, hd)     -> Date at local midnight
     .ramadanStart(gregorianYear) -> [Date, ...]  (one, sometimes two)
     .eidAlFitr(hijriYear)        -> Date  (1 Shawwal)
     .RAMADAN_YEARS               -> { 2026: [ {...} ], ... } 2026 to 2042
     .getOffset() / .setOffset(n) -> integer days, clamped to -3 .. +3
     .isCalculated  = true
     .note          = the honest sentence, in plain words
     .selfTest()    -> logs the anchors and the seventeen year table
   ============================================================ */
(function () {
  "use strict";

  /* one engine per page, however many tags end up pointing here */
  if (window.NOOR_HIJRI && window.NOOR_HIJRI.isCalculated) return;

  /* ---- the twelve months, each with its Arabic ------------------- */
  var MONTHS = [
    { en: "Muharram",          ar: "مُحَرَّم",          gloss: "the forbidden month" },
    { en: "Safar",             ar: "صَفَر",             gloss: "the empty month" },
    { en: "Rabi al-Awwal",     ar: "رَبِيع الأَوَّل",     gloss: "the first spring" },
    { en: "Rabi al-Thani",     ar: "رَبِيع الآخِر",      gloss: "the second spring" },
    { en: "Jumada al-Ula",     ar: "جُمَادَى الأُولَى",   gloss: "the first of the dry months" },
    { en: "Jumada al-Akhira",  ar: "جُمَادَى الآخِرَة",   gloss: "the last of the dry months" },
    { en: "Rajab",             ar: "رَجَب",             gloss: "the month of awe" },
    { en: "Shaban",            ar: "شَعْبَان",           gloss: "the scattering month" },
    { en: "Ramadan",           ar: "رَمَضَان",           gloss: "the burning month" },
    { en: "Shawwal",           ar: "شَوَّال",            gloss: "the lifting month" },
    { en: "Dhul Qadah",        ar: "ذُو القَعْدَة",       gloss: "the month of sitting still" },
    { en: "Dhul Hijjah",       ar: "ذُو الحِجَّة",        gloss: "the month of the pilgrimage" }
  ];

  var RAMADAN = 9;   /* the ninth month */
  var SHAWWAL = 10;  /* the tenth month, whose first day is Eid al-Fitr */

  /* The epoch: 1 Muharram of year 1 as a Julian Day Number.
     1948440 is Friday 16 July 622 in the Julian reckoning, the civil
     epoch that the tabular calendars in ordinary use are built on. */
  var EPOCH = 1948440;

  var LEAP_YEARS = [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29];

  var OFFSET_KEY = "noor_hijri_offset";
  var OFFSET_MIN = -3;
  var OFFSET_MAX = 3;

  var NOTE = ("These dates are calculated, not sighted. They come from the tabular Islamic " +
    "calendar, which is arithmetic and knows nothing of the sky, so they can sit a day or two " +
    "away from the day your community actually begins. Your masjid's announcement is the date. " +
    "If it differs, nudge this calendar by a day or two with the offset and everything on the " +
    "page follows you.");

  var SHORT_NOTE = ("Calculated, not sighted. Your masjid's announcement decides.");

  /* ---- the offset, kept in one small drawer ---------------------- */
  var offsetCache = null;

  function clampOffset(n) {
    n = parseInt(n, 10);
    if (isNaN(n)) return 0;
    if (n < OFFSET_MIN) return OFFSET_MIN;
    if (n > OFFSET_MAX) return OFFSET_MAX;
    return n;
  }

  function getOffset() {
    if (offsetCache !== null) return offsetCache;
    var raw = null;
    try { raw = window.localStorage.getItem(OFFSET_KEY); } catch (e) { raw = null; }
    offsetCache = clampOffset(raw);
    return offsetCache;
  }

  function setOffset(n) {
    var v = clampOffset(n);
    offsetCache = v;
    try { window.localStorage.setItem(OFFSET_KEY, String(v)); } catch (e) {}
    rebuildTable();
    try {
      window.dispatchEvent(new CustomEvent("noor:hijri-offset", { detail: { offset: v } }));
    } catch (e) {}
    return v;
  }

  /* ---- Gregorian day numbers, Fliegel and Van Flandern ----------- */
  function gregToJdn(y, m, d) {
    var a = Math.floor((14 - m) / 12);
    var yy = y + 4800 - a;
    var mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy +
      Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }

  function jdnToGreg(jdn) {
    var a = jdn + 32044;
    var b = Math.floor((4 * a + 3) / 146097);
    var c = a - Math.floor(146097 * b / 4);
    var d = Math.floor((4 * c + 3) / 1461);
    var e = c - Math.floor(1461 * d / 4);
    var m = Math.floor((5 * e + 2) / 153);
    return {
      y: 100 * b + d - 4800 + Math.floor(m / 10),
      m: m + 3 - 12 * Math.floor(m / 10),
      d: e - Math.floor((153 * m + 2) / 5) + 1
    };
  }

  /* ---- the tabular Islamic calendar ------------------------------ */
  function isLeapHijri(hy) {
    var k = ((hy % 30) + 30) % 30;
    if (k === 0) k = 30;
    return LEAP_YEARS.indexOf(k) !== -1;
  }

  function monthLength(hy, hm) {
    if (hm === 12) return isLeapHijri(hy) ? 30 : 29;
    return (hm % 2 === 1) ? 30 : 29;
  }

  function yearLength(hy) {
    return isLeapHijri(hy) ? 355 : 354;
  }

  /* pure arithmetic, no offset: 1 Muharram 1 is EPOCH */
  function hijriToJdnRaw(hy, hm, hd) {
    return hd + Math.ceil(29.5 * (hm - 1)) + (hy - 1) * 354 +
      Math.floor((3 + 11 * hy) / 30) + EPOCH - 1;
  }

  function jdnToHijriRaw(jdn) {
    var hy = Math.floor((30 * (jdn - EPOCH) + 10646) / 10631);
    var hm = Math.min(12, Math.ceil((jdn - (29 + hijriToJdnRaw(hy, 1, 1))) / 29.5) + 1);
    if (hm < 1) hm = 1;
    var hd = jdn - hijriToJdnRaw(hy, hm, 1) + 1;
    /* the ceiling above can land one month early or late at the seams */
    while (hd < 1) {
      hm -= 1;
      if (hm < 1) { hm = 12; hy -= 1; }
      hd = jdn - hijriToJdnRaw(hy, hm, 1) + 1;
    }
    while (hd > monthLength(hy, hm)) {
      hd -= monthLength(hy, hm);
      hm += 1;
      if (hm > 12) { hm = 1; hy += 1; }
    }
    return { hy: hy, hm: hm, hd: hd };
  }

  /* ---- the public shapes ----------------------------------------- */
  function decorate(r, jdn) {
    var mo = MONTHS[r.hm - 1] || MONTHS[0];
    var g = jdnToGreg(jdn);
    return {
      hy: r.hy,
      hm: r.hm,
      hd: r.hd,
      monthEn: mo.en,
      monthAr: mo.ar,
      monthGloss: mo.gloss,
      monthLength: monthLength(r.hy, r.hm),
      isLeap: isLeapHijri(r.hy),
      isRamadan: r.hm === RAMADAN,
      isEidAlFitr: r.hm === SHAWWAL && r.hd === 1,
      ramadanDay: r.hm === RAMADAN ? r.hd : 0,
      offset: getOffset(),
      isCalculated: true,
      jdn: jdn,
      gregorian: { y: g.y, m: g.m, d: g.d },
      text: r.hd + " " + mo.en + " " + r.hy,
      textAr: r.hd + " " + mo.ar + " " + r.hy
    };
  }

  /* date in, Hijri out. The offset moves the reader's day, so a
     positive offset means the month began a day earlier for them. */
  function toHijri(date) {
    var dt = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();
    var jdn = gregToJdn(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()) + getOffset();
    return decorate(jdnToHijriRaw(jdn), jdn);
  }

  /* Hijri in, a Date at local midnight out */
  function toGregorian(hy, hm, hd) {
    hy = parseInt(hy, 10); hm = parseInt(hm, 10); hd = parseInt(hd, 10);
    if (isNaN(hy) || isNaN(hm) || isNaN(hd)) return null;
    var jdn = hijriToJdnRaw(hy, hm, hd) - getOffset();
    var g = jdnToGreg(jdn);
    var out = new Date(g.y, g.m - 1, g.d, 0, 0, 0, 0);
    if (g.y >= 0 && g.y < 100) out.setFullYear(g.y);
    return out;
  }

  function eidAlFitr(hy) {
    return toGregorian(hy, SHAWWAL, 1);
  }

  function fmtISO(dt) {
    if (!dt) return "";
    var m = dt.getMonth() + 1, d = dt.getDate();
    return dt.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d;
  }

  /* Every 1 Ramadan that falls inside one Gregorian year. Usually one.
     Because a Hijri year is about eleven days shorter, a Gregorian year
     now and then holds two, and once in a long while the first lands on
     1 January, so we scan a small window of Hijri years and keep what
     actually falls inside. */
  function ramadanStart(gYear) {
    gYear = parseInt(gYear, 10);
    if (isNaN(gYear)) return [];
    var approx = Math.floor((gYear - 621.5) * 33 / 32);
    var out = [];
    for (var hy = approx - 2; hy <= approx + 2; hy++) {
      var dt = toGregorian(hy, RAMADAN, 1);
      if (dt && dt.getFullYear() === gYear) out.push({ hy: hy, date: dt });
    }
    out.sort(function (a, b) { return a.date - b.date; });
    return out.map(function (r) { return r.date; });
  }

  /* the same scan, but as a full row a page can print */
  function ramadanRows(gYear) {
    return ramadanStart(gYear).map(function (dt) {
      var h = toHijri(dt);
      var end = toGregorian(h.hy, RAMADAN, 30);
      var eid = eidAlFitr(h.hy);
      return {
        hy: h.hy,
        start: dt,
        startISO: fmtISO(dt),
        lastDay: end,
        lastDayISO: fmtISO(end),
        eid: eid,
        eidISO: fmtISO(eid),
        days: 30,
        isCalculated: true
      };
    });
  }

  var RAMADAN_YEARS = {};
  var FIRST_YEAR = 2026, LAST_YEAR = 2042;

  function rebuildTable() {
    for (var k in RAMADAN_YEARS) {
      if (Object.prototype.hasOwnProperty.call(RAMADAN_YEARS, k)) delete RAMADAN_YEARS[k];
    }
    for (var y = FIRST_YEAR; y <= LAST_YEAR; y++) RAMADAN_YEARS[y] = ramadanRows(y);
  }
  rebuildTable();

  /* The next 1 Ramadan on or after a given day, however far ahead. */
  function nextRamadan(from) {
    var dt = (from instanceof Date && !isNaN(from.getTime())) ? from : new Date();
    var today = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    var h = toHijri(today);
    for (var i = 0; i < 3; i++) {
      var start = toGregorian(h.hy + i, RAMADAN, 1);
      if (start && start >= today) return { hy: h.hy + i, date: start };
    }
    return null;
  }

  function daysBetween(a, b) {
    var ja = gregToJdn(a.getFullYear(), a.getMonth() + 1, a.getDate());
    var jb = gregToJdn(b.getFullYear(), b.getMonth() + 1, b.getDate());
    return jb - ja;
  }

  /* ---- the self test: the anchors, spoken aloud ------------------ */
  function selfTest(log) {
    log = log || function () { console.log.apply(console, arguments); };
    var lines = [];
    var kept = getOffset();
    offsetCache = 0;   /* the anchors are tested against the raw arithmetic */

    var a1446 = toGregorian(1446, RAMADAN, 1);
    var a1447 = toGregorian(1447, RAMADAN, 1);
    var t1446 = new Date(2025, 2, 1);   /* 1 March 2025, announced */
    var t1447 = new Date(2026, 1, 18);  /* about 18 February 2026 */
    var d1 = daysBetween(t1446, a1446);
    var d2 = daysBetween(t1447, a1447);

    lines.push("NOOR_HIJRI self test · tabular calendar, no offset");
    lines.push("  1 Ramadan 1446 calculated " + fmtISO(a1446) +
      " · announced 2025-03-01 · difference " + d1 + " day(s)");
    lines.push("  1 Ramadan 1447 calculated " + fmtISO(a1447) +
      " · expected about 2026-02-18 · difference " + d2 + " day(s)");
    lines.push("  anchors within two days: " +
      ((Math.abs(d1) <= 2 && Math.abs(d2) <= 2) ? "yes" : "NO"));

    var count = 0;
    for (var y = FIRST_YEAR; y <= LAST_YEAR; y++) {
      var rows = RAMADAN_YEARS[y];
      count += rows.length;
      lines.push("  " + y + ": " + rows.map(function (r) {
        return r.startISO + " (1 Ramadan " + r.hy + ", Eid " + r.eidISO + ")";
      }).join("  and  "));
    }
    lines.push("  Gregorian years covered: " + (LAST_YEAR - FIRST_YEAR + 1) +
      " · Ramadans listed: " + count);
    lines.push("  " + SHORT_NOTE);

    offsetCache = kept;
    lines.forEach(function (l) { log(l); });
    return {
      ok: Math.abs(d1) <= 2 && Math.abs(d2) <= 2,
      anchor1446: fmtISO(a1446), anchor1447: fmtISO(a1447),
      diff1446: d1, diff1447: d2, ramadanCount: count, lines: lines
    };
  }

  window.NOOR_HIJRI = {
    MONTHS: MONTHS,
    RAMADAN: RAMADAN,
    SHAWWAL: SHAWWAL,
    LEAP_YEARS: LEAP_YEARS,
    EPOCH: EPOCH,
    toHijri: toHijri,
    toGregorian: toGregorian,
    isLeapHijri: isLeapHijri,
    monthLength: monthLength,
    yearLength: yearLength,
    ramadanStart: ramadanStart,
    ramadanRows: ramadanRows,
    nextRamadan: nextRamadan,
    eidAlFitr: eidAlFitr,
    daysBetween: daysBetween,
    fmtISO: fmtISO,
    RAMADAN_YEARS: RAMADAN_YEARS,
    FIRST_YEAR: FIRST_YEAR,
    LAST_YEAR: LAST_YEAR,
    getOffset: getOffset,
    setOffset: setOffset,
    OFFSET_KEY: OFFSET_KEY,
    OFFSET_MIN: OFFSET_MIN,
    OFFSET_MAX: OFFSET_MAX,
    isCalculated: true,
    note: NOTE,
    shortNote: SHORT_NOTE,
    selfTest: selfTest
  };
})();
