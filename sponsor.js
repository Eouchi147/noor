/* NOOR Guardian system, per-market edition: several Guardians at once, ONE per
   market, all controlled entirely by the owner. A market renders nothing unless
   its entry is active:true AND halalAttested:true AND today is inside [start,end).
   Edit this file ONLY through admin.html (the Guardian Console), which walks the
   halal checklist per Guardian and generates this file for you to commit.
   Publishing = your git push. No push, no sponsor.

   Market detection is done ON THE READER'S OWN DEVICE from three passive signals:
   the domain they typed, their browser language (e.g. en-CA), their clock's
   timezone. Nothing is sent anywhere, nothing is stored. Readers are never
   tracked; that promise is part of the charter. First matching market wins,
   in the order below. */
/* ===== GUARDIAN CONFIG : do not edit by hand, use admin.html ===== */
var NOOR_SPONSORS = {
  markets: [
    {
      id: "CA", label: "Canada",
      match: {
        domains: ["noorcodex.ca", "www.noorcodex.ca"],
        regions: ["CA"],
        timezones: ["America/St_Johns", "America/Halifax", "America/Moncton", "America/Goose_Bay", "America/Toronto", "America/Montreal", "America/Winnipeg", "America/Regina", "America/Edmonton", "America/Vancouver", "America/Whitehorse", "America/Yellowknife", "America/Iqaluit"],
        catchAll: false
      },
      active: false, name: "", url: "", line: "",
      start: "", end: "",
      placements: { bar: true, aboutSeal: true },
      halalAttested: false, approvedBy: ""
    },
    {
      id: "GLOBAL", label: "Worldwide",
      match: { domains: [], regions: [], timezones: [], catchAll: true },
      active: false, name: "", url: "", line: "",
      start: "", end: "",
      placements: { bar: true, aboutSeal: true },
      halalAttested: false, approvedBy: ""
    }
  ]
};
/* ===== END GUARDIAN CONFIG ===== */
(function () {
  "use strict";
  function marketLive(m) {
    if (!m || !m.active || !m.name || !m.halalAttested) return false;
    var today = new Date().toISOString().slice(0, 10);
    if (m.start && today < m.start) return false;
    if (m.end && today >= m.end) return false;
    return true;
  }
  /* Pure resolver: (hostname, IANA timezone, [language tags]) -> market or null.
     Priority: typed domain > language region > timezone > catch-all. */
  function pickMarket(host, tz, langs) {
    var ms = (NOOR_SPONSORS.markets || []).filter(marketLive);
    if (!ms.length) return null;
    var i, j, m, mm;
    host = String(host || "").toLowerCase();
    for (i = 0; i < ms.length; i++) {
      mm = ms[i].match || {};
      if ((mm.domains || []).indexOf(host) >= 0) return ms[i];
    }
    var regions = [];
    (langs || []).forEach(function (l) {
      var p = String(l || "").split("-");
      if (p[1] && /^[A-Za-z]{2}$/.test(p[1])) regions.push(p[1].toUpperCase());
    });
    for (i = 0; i < ms.length; i++) {
      mm = ms[i].match || {};
      for (j = 0; j < regions.length; j++) if ((mm.regions || []).indexOf(regions[j]) >= 0) return ms[i];
    }
    for (i = 0; i < ms.length; i++) {
      mm = ms[i].match || {};
      if (tz && (mm.timezones || []).indexOf(tz) >= 0) return ms[i];
    }
    for (i = 0; i < ms.length; i++) { if ((ms[i].match || {}).catchAll) return ms[i]; }
    return null;
  }
  function deviceMarket() {
    var tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { }
    var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ""];
    return pickMarket(location.hostname, tz, langs);
  }
  function esc(s) {
    var el = document.createElement("span"); el.textContent = String(s == null ? "" : s);
    return el.innerHTML;
  }
  function nameHtml(m, cls) {
    var inner = esc(m.name);
    var u = /^https:\/\//.test(m.url || "") ? m.url : "";
    return u
      ? '<a class="' + cls + '" href="' + encodeURI(u) + '" rel="noopener sponsored" target="_blank">' + inner + '</a>'
      : '<span class="' + cls + '">' + inner + '</span>';
  }
  function ensureStyle() {
    if (document.getElementById("np-style")) return;
    var st = document.createElement("style");
    st.id = "np-style";
    st.textContent =
      ".np-bar{background:linear-gradient(180deg,#FFFDF4,#F8F1DC);border-bottom:1px solid rgba(201,162,39,.35);text-align:center;padding:.42rem .9rem;font-size:.72rem;color:rgba(44,36,22,.72);font-family:Inter,system-ui,sans-serif}" +
      ".np-bar b,.np-bar a{color:#8a6d1a;font-weight:700;text-decoration:none}" +
      ".np-bar a:hover{text-decoration:underline}" +
      ".np-bar .orn{color:rgba(201,162,39,.8)}" +
      ".np-seal{margin:1.4rem auto 0;max-width:24rem;border:1px solid rgba(233,200,106,.35);background:linear-gradient(165deg,rgba(233,200,106,.08),rgba(233,200,106,.02));border-radius:14px;padding:.7rem .9rem;text-align:center}" +
      ".np-k{font-size:.58rem;letter-spacing:.26em;text-transform:uppercase;color:rgba(233,200,106,.75);font-weight:700;display:block}" +
      ".np-n{display:block;margin-top:.2rem;font-weight:700;font-size:.85rem;color:#F4E3A1;text-decoration:none}" +
      "a.np-n:hover{text-decoration:underline}" +
      ".np-l{display:block;margin-top:.15rem;font-size:.66rem;color:rgba(255,254,247,.5)}";
    document.head.appendChild(st);
  }
  /* Idempotent: clears previous render, then renders the resolved market.
     force=true (Console preview) skips the live gate but still requires a name.
     marketId (Console preview) pins a specific market instead of device signals. */
  function render(force, marketId) {
    var i, old = document.querySelectorAll(".np-bar");
    for (i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
    var slot = document.getElementById("sponsor-slot");
    if (slot) slot.innerHTML = "";
    var m = null;
    if (marketId) {
      (NOOR_SPONSORS.markets || []).forEach(function (x) { if (x.id === marketId) m = x; });
      if (m && !force && !marketLive(m)) m = null;
    } else {
      m = force
        ? (NOOR_SPONSORS.markets || []).filter(function (x) { return x.name; })[0] || null
        : deviceMarket();
    }
    if (!m || !m.name) return;
    ensureStyle();
    if (m.placements && m.placements.bar) {
      var hdr = document.getElementById("site-header");
      if (hdr) {
        var bar = document.createElement("div");
        bar.className = "np-bar";
        bar.setAttribute("role", "note");
        bar.setAttribute("data-market", m.id);
        bar.innerHTML = '<span class="orn">☙</span> This month the Codex shines with the support of ' + nameHtml(m, "") +
          (m.line ? ' · <span>' + esc(m.line) + '</span>' : '') + ' <span class="orn">❧</span>';
        hdr.insertAdjacentElement("afterend", bar);
      }
    }
    if (m.placements && m.placements.aboutSeal && slot) {
      slot.innerHTML = '<div class="np-seal" data-market="' + esc(m.id) + '"><span class="np-k">☙ Guardian of this Codex ❧</span>' + nameHtml(m, "np-n") +
        (m.line ? '<span class="np-l">' + esc(m.line) + '</span>' : '') + '</div>';
    }
  }
  window.NOOR_SPONSOR_PICK = pickMarket;
  window.NOOR_SPONSOR_LIVE = marketLive;
  window.NOOR_SPONSOR_RENDER = render;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { render(false); });
  else render(false);
})();
