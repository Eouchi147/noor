/* ================= the prayer-time engine =================
   Pure astronomy, no server: NOAA solar position approximations.
   Methods: MWL 18/17 · ISNA 15/15 · Egypt 19.5/17.5 · Karachi 18/18 ·
   UmmAlQura 18.5 + 90min Isha. Asr: standard (shadow 1) or Hanafi (2).
   Accuracy about one to two minutes at ordinary latitudes. */
(function () {
  "use strict";
  var RAD = Math.PI / 180;

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }
  /* solar declination + equation of time for a julian day */
  function sun(jd) {
    var D = jd - 2451545.0;
    var g = (357.529 + 0.98560028 * D) % 360;
    var q = (280.459 + 0.98564736 * D) % 360;
    var L = (q + 1.915 * Math.sin(g * RAD) + 0.020 * Math.sin(2 * g * RAD)) % 360;
    var e = 23.439 - 0.00000036 * D;
    var RA = Math.atan2(Math.cos(e * RAD) * Math.sin(L * RAD), Math.cos(L * RAD)) / (15 * RAD);
    RA = (RA + 24) % 24;
    var decl = Math.asin(Math.sin(e * RAD) * Math.sin(L * RAD));
    var eqt = q / 15 - RA;
    if (eqt > 12) eqt -= 24; if (eqt < -12) eqt += 24;
    return { decl: decl, eqt: eqt };
  }
  /* hour angle (in hours) for the sun at altitude `alt` (radians, negative below horizon) */
  function hourAngle(lat, decl, alt) {
    var cosH = (Math.sin(alt) - Math.sin(lat * RAD) * Math.sin(decl)) / (Math.cos(lat * RAD) * Math.cos(decl));
    if (cosH < -1 || cosH > 1) return null;   /* the sun never reaches it: high latitude */
    return Math.acos(cosH) / (15 * RAD);
  }

  var METHODS = {
    MWL:       { fajr: 18,   isha: 17 },
    ISNA:      { fajr: 15,   isha: 15 },
    Egypt:     { fajr: 19.5, isha: 17.5 },
    Karachi:   { fajr: 18,   isha: 18 },
    UmmAlQura: { fajr: 18.5, ishaMin: 90 }
  };

  /* returns times as fractional local hours, or null when undefined at this latitude */
  window.NOOR_SALAT = function (date, lat, lng, opts) {
    opts = opts || {};
    var method = METHODS[opts.method] || METHODS.ISNA;
    var asrFactor = opts.asr === "hanafi" ? 2 : 1;
    var tzOff = (opts.tzOff != null) ? opts.tzOff : -date.getTimezoneOffset() / 60;
    var jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate());
    var s = sun(jd + 0.5 - lng / 360);             /* solar values near local noon */
    var noon = 12 - s.eqt - lng / 15 + tzOff;      /* Dhuhr: solar transit */
    var H = function (altDeg) { return hourAngle(lat, s.decl, altDeg * RAD); };

    var hSunrise = H(-0.833);
    var hFajr = H(-method.fajr);
    var hIsha = method.ishaMin ? null : H(-method.isha);
    /* Asr: altitude when shadow = factor + shadow at noon */
    var altAsr = Math.atan(1 / (asrFactor + Math.tan(Math.abs(lat * RAD - s.decl))));
    var hAsr = hourAngle(lat, s.decl, altAsr);

    var t = {
      fajr:    hFajr    !== null ? noon - hFajr    : null,
      sunrise: hSunrise !== null ? noon - hSunrise : null,
      dhuhr:   noon + 2 / 60,                     /* transit + a safety sliver */
      asr:     hAsr     !== null ? noon + hAsr     : null,
      maghrib: hSunrise !== null ? noon + hSunrise : null,
      isha:    null
    };
    if (method.ishaMin) { if (t.maghrib !== null) t.isha = t.maghrib + method.ishaMin / 60; }
    else if (hIsha !== null) t.isha = noon + hIsha;

    /* honest high-latitude fallback: nearest day is beyond us without ephemeris;
       use the middle-of-night / seventh-of-night convention, flagged. */
    t.estimated = false;
    if ((t.fajr === null || t.isha === null) && t.sunrise !== null && t.maghrib !== null) {
      var night = 24 - (t.maghrib - t.sunrise);
      if (t.fajr === null) { t.fajr = t.sunrise - night / 7; t.estimated = true; }
      if (t.isha === null) { t.isha = t.maghrib + night / 7; t.estimated = true; }
    }
    return t;
  };

  window.NOOR_QIBLA = function (lat, lng) {
    var kLat = 21.4225 * RAD, kLng = 39.8262 * RAD;
    var la = lat * RAD, lo = lng * RAD;
    var y = Math.sin(kLng - lo);
    var x = Math.cos(la) * Math.tan(kLat) - Math.sin(la) * Math.cos(kLng - lo);
    var b = Math.atan2(y, x) / RAD;
    return (b + 360) % 360;
  };

  window.NOOR_FMT_TIME = function (h, h24) {
    if (h === null || isNaN(h)) return "··";
    h = ((h % 24) + 24) % 24;
    var H = Math.floor(h), M = Math.round((h - H) * 60);
    if (M === 60) { M = 0; H = (H + 1) % 24; }
    if (h24) return (H < 10 ? "0" : "") + H + ":" + (M < 10 ? "0" : "") + M;
    var ap = H >= 12 ? "PM" : "AM"; var hh = H % 12; if (hh === 0) hh = 12;
    return hh + ":" + (M < 10 ? "0" : "") + M + " " + ap;
  };
})();
