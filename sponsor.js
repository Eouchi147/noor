/* NOOR Guardian system v3, weekly lamps edition.
   One Guardian per market, held one week at a time. A reader ever sees
   ONE seal (or one quiet invitation). Region resolution is fully
   on-device: hostname → metro timezone → country (from language region
   tags) → language → worldwide. Nothing about the reader leaves the
   device. The only network call asks our own server one question:
   "who holds the lamps this week."

   ===== OWNER OVERRIDE (optional) =====
   Lamps normally light themselves from paid + approved subscriptions
   (managed in /admin.html). This object lets the owner hand-place a
   Guardian without Stripe; server lamps win when both exist.           */
window.NOOR_GUARDIANS = {
  /* "CA-TOR": { name:"Example Halal Foods", url:"https://example.com",
                 line:"Halal groceries across the GTA", start:"2026-08-01",
                 end:"", halalAttested:true, approvedBy:"owner" },       */
};
/* ===== END OWNER OVERRIDE ===== */

(function () {
  "use strict";
  var M = (window.NOOR_MARKETS && NOOR_MARKETS.list) || [];
  var G = window.NOOR_GUARDIANS || {};
  var PRICES = (window.NOOR_MARKETS && NOOR_MARKETS.tierPrices) || {};
  var CUR = (window.NOOR_MARKETS && NOOR_MARKETS.currencyOf) || {};
  var LOCAL = (window.NOOR_MARKETS && NOOR_MARKETS.localPrices) || {};
  var SYM = (window.NOOR_MARKETS && NOOR_MARKETS.curSymbol) || {};

  function signals() {
    var tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    var langs = [];
    try { langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""]).map(function (l) { return String(l || "").toLowerCase(); }); } catch (e) {}
    var regions = [];
    langs.forEach(function (l) { var p = l.split("-"); if (p[1] && p[1].length === 2) regions.push(p[1].toUpperCase()); });
    return { host: (location.hostname || "").toLowerCase(), tz: tz, langs: langs, regions: regions };
  }

  function matches(m, s, layer) {
    var mm = m.match || {};
    if (layer === "domain") return (mm.domains || []).indexOf(s.host) !== -1;
    if (layer === "metro")  return m.kind === "metro" && (
      (mm.tz || []).indexOf(s.tz) !== -1 ||
      (mm.langs || []).some(function (L) { return s.langs.indexOf(L.toLowerCase()) !== -1; }));
    if (layer === "country") return m.kind === "country" && (mm.regions || []).some(function (r) { return s.regions.indexOf(r) !== -1; });
    if (layer === "lang")   return m.kind === "lang" && (mm.langs || []).some(function (L) {
      return s.langs.some(function (l) { return l === L || l.indexOf(L + "-") === 0; }); });
    if (layer === "global") return !!mm.catchAll;
    return false;
  }

  /* Resolve reader → exactly one market, most specific first. */
  function resolveMarket(s) {
    var layers = ["domain", "metro", "country", "lang", "global"];
    for (var i = 0; i < layers.length; i++) {
      for (var j = 0; j < M.length; j++) if (matches(M[j], s, layers[i])) return M[j];
    }
    return null;
  }

  /* Live lamp map from the server (5 min memory via sessionStorage). */
  var SERVER = { lit: {}, taken: {} };
  function loadLamps(done) {
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem("noor_lamps") || "null"); } catch (e) {}
    if (cached && Date.now() - cached.t < 300000) { SERVER = cached.d || SERVER; return done(); }
    var finished = false;
    var timer = setTimeout(function () { if (!finished) { finished = true; done(); } }, 1800);
    try {
      fetch("/api/guardians").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (j) {
          SERVER = { lit: j.lit || {}, taken: j.taken || {} };
          try { sessionStorage.setItem("noor_lamps", JSON.stringify({ t: Date.now(), d: SERVER })); } catch (e) {}
        }
        if (!finished) { finished = true; clearTimeout(timer); done(); }
      }).catch(function () { if (!finished) { finished = true; clearTimeout(timer); done(); } });
    } catch (e) { if (!finished) { finished = true; clearTimeout(timer); done(); } }
  }

  function manualGuardian(m) {
    if (!m) return null;
    var g = G[m.id];
    if (!g || !g.name || !g.halalAttested || !g.approvedBy) return null;
    var today = new Date().toISOString().slice(0, 10);
    if (g.start && today < g.start) return null;
    if (g.end && today > g.end) return null;
    return g;
  }

  function liveGuardian(m) {
    if (!m) return null;
    return (SERVER.lit && SERVER.lit[m.id]) || manualGuardian(m);
  }

  function weeklyLabel(m) {
    var cur = CUR[m.id];
    if (cur && LOCAL[cur] && LOCAL[cur][m.tier] != null) return (SYM[cur] || "") + LOCAL[cur][m.tier] + "/week";
    return "$" + PRICES[m.tier] + "/week";
  }

  function el(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function esc(x) { return String(x || "").replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); }

  function render() {
    document.querySelectorAll("[data-noor-sponsor]").forEach(function (n) { n.remove(); });
    var s = signals();
    var pin = null;
    try { pin = new URLSearchParams(location.search).get("noor-preview"); } catch (e) {}
    var m = null;
    if (pin) { M.forEach(function (x) { if (x.id === pin) m = x; }); }
    if (!m) m = resolveMarket(s);
    if (!m) return;
    var isAdmin = /(^|\/)admin(\.html)?$/.test(location.pathname);
    var isSponsorPage = /(^|\/)sponsor(\.html)?$/.test(location.pathname);
    if (isAdmin || isSponsorPage) return;
    var g = liveGuardian(m);
    var hdr = document.getElementById("site-header");
    if (!hdr || !hdr.parentNode) return;

    if (g) {
      /* The lit lamp: one understated golden bar, framed as support. */
      var nm = g.url
        ? '<a href="' + esc(g.url) + '" rel="sponsored noopener" target="_blank" style="color:#8a6d13;font-weight:600;text-decoration:none">' + esc(g.name) + "</a>"
        : '<b style="color:#8a6d13;font-weight:600">' + esc(g.name) + "</b>";
      var bar = el('<div data-noor-sponsor style="position:relative;z-index:35;background:linear-gradient(90deg,rgba(201,162,39,.10),rgba(201,162,39,.045) 55%,transparent);border-bottom:1px solid rgba(201,162,39,.22)">' +
        '<div style="max-width:72rem;margin:0 auto;padding:.42rem 1rem;display:flex;align-items:center;gap:.6rem;font-size:.72rem;color:rgba(44,36,22,.72);font-family:Inter,system-ui,sans-serif">' +
        '<span aria-hidden="true" style="color:#C9A227">✦</span>' +
        "<span>This week's Guardian of " + esc(m.label) + ": " + nm +
        (g.line ? ', <span style="color:rgba(44,36,22,.55)">' + esc(g.line) + "</span>" : "") +
        ' <span style="color:rgba(44,36,22,.45)">· their support keeps the Codex free for everyone</span></span>' +
        '<a href="sponsor.html" style="margin-left:auto;flex:none;color:rgba(44,36,22,.4);text-decoration:none;font-size:.66rem" title="About Guardianship">what is this?</a>' +
        "</div></div>");
      hdr.parentNode.insertBefore(bar, hdr.nextSibling);
    } else {
      /* The quiet invitation: visible, dignified, one line of support. */
      var inv = el('<div data-noor-sponsor style="position:relative;z-index:35;background:linear-gradient(90deg,rgba(44,36,22,.035),transparent 70%);border-bottom:1px solid rgba(44,36,22,.06)">' +
        '<div style="max-width:72rem;margin:0 auto;padding:.4rem 1rem;display:flex;align-items:center;gap:.55rem;font-size:.71rem;color:rgba(44,36,22,.55);font-family:Inter,system-ui,sans-serif">' +
        '<span aria-hidden="true" style="color:rgba(201,162,39,.75)">✦</span>' +
        "<span>Support the Codex so it stays free for everyone · be the one Guardian readers in <b style=\"color:rgba(44,36,22,.7);font-weight:600\">" + esc(m.label) + "</b> see this week" +
        ' · <span style="color:#8a6d13">' + weeklyLabel(m) + "</span></span>" +
        '<a href="sponsor.html?market=' + encodeURIComponent(m.id) + '" style="margin-left:auto;flex:none;color:#8a6d13;font-weight:700;text-decoration:none">Become the Guardian →</a>' +
        "</div></div>");
      hdr.parentNode.insertBefore(inv, hdr.nextSibling);
    }
  }

  function start() { loadLamps(render); }

  /* Exposed for sponsor.html + admin.html */
  window.NOOR_SPONSOR_API = { resolveMarket: resolveMarket, signals: signals, liveGuardian: liveGuardian, loadLamps: loadLamps, lamps: function () { return SERVER; }, weeklyLabel: weeklyLabel };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
