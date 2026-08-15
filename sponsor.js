/* The mission line. Once this file ran the regional sponsorship system;
   that program is retired. What remains is the one sentence every page
   carries: the library is free, forever, on the gifts of its readers.

   And on Friday it steps aside. Jumu'ah has the better claim on the strip
   at the top of the page, so from maghrib on Thursday until maghrib on
   Friday the band carries the day itself and points at al-Kahf. */
(function () {
  "use strict";
  var path = location.pathname;
  if (/(^|\/)admin(\.html)?$/.test(path)) return;
  if (/(^|\/)(sponsor|donate)(\.html)?$/.test(path)) return;
  if (/(^|\/)kids(\/|\.html|$)/.test(path)) return;          /* no bands near children */
  if (/(^|\/)masjid\//.test(path)) return;                    /* the board is a tool, not a page */
  var inFrame = false;
  try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }
  if (inFrame || /[?&]embed=1/.test(location.search)) return;  /* embeds stay commerce-free */

  /* The Islamic day turns at sunset, so Jumu'ah begins on Thursday evening.
     Without a location we cannot know the reader's maghrib, so we take the
     ordinary convention: after six in the evening on Thursday, and all of
     Friday until six. ?jumuah=1 forces it on for a look. */
  var DIALS = null;                 /* filled by /api/settings, may never arrive */
  function isJumuah() {
    try { if (/[?&]jumuah=1/.test(location.search)) return true; } catch (e) {}
    if (DIALS && DIALS["jumuah.mode"] === "on") return true;
    if (DIALS && DIALS["jumuah.mode"] === "off") return false;
    var d = new Date(), day = d.getDay(), h = d.getHours();
    if (day === 5) return h < 18;               /* Friday, until maghrib */
    if (day === 4) return h >= 18;              /* Thursday evening, once it has turned */
    return false;
  }

  var MISSION = {
    mark: "✦",
    text: "This library is free for everyone, forever · no ads, no trackers · it runs on the gifts of its readers",
    href: "/donate",
    cta: "Keep it lit →",
    tone: "rgba(44,36,22,.55)",
    bg: "linear-gradient(90deg,rgba(44,36,22,.035),transparent 70%)",
    border: "rgba(44,36,22,.06)",
  };

  var JUMUAH = {
    mark: "☾",
    text: "<b style=\"color:#8a6d13;font-weight:800\">Jumu’ah Mubarak.</b> The Prophet ﷺ called Friday the best day the sun rises upon. " +
          "Wash, wear your good clothes, send prayers upon him ﷺ abundantly, and give something, even small. " +
          "There is an hour in this day when du’a is not refused; spend it like treasure.",
    href: "/quran?surah=18",
    cta: "Open Surah Al-Kahf →",
    tone: "rgba(44,36,22,.72)",
    bg: "linear-gradient(90deg,rgba(201,162,39,.16),rgba(244,212,106,.07) 55%,transparent 90%)",
    border: "rgba(201,162,39,.28)",
  };

  function remount() {
    var old = document.querySelector("[data-noor-sponsor]");
    if (old && old.parentNode) old.parentNode.removeChild(old);
    mount();
  }
  /* ask the house what it has been told, and correct the band if the answer
     differs from the guess. One small request, cached at the edge. */
  function askDials() {
    try {
      fetch("/api/settings", { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.s) return;
          var before = JSON.stringify(DIALS);
          DIALS = j.s;
          notice(DIALS["notice.text"]);
          if (JSON.stringify(DIALS) !== before) remount();
        }).catch(function () {});
    } catch (e) {}
  }
  /* one plain sentence the owner can put across the top for an outage or a
     closure. Text only, inserted as text, never as markup. */
  function notice(txt) {
    var have = document.getElementById("noor-notice");
    if (!txt) { if (have && have.parentNode) have.parentNode.removeChild(have); return; }
    if (have) { have.textContent = txt; return; }
    var hdr = document.getElementById("site-header");
    if (!hdr || !hdr.parentNode) return;
    var n = document.createElement("div");
    n.id = "noor-notice";
    n.setAttribute("role", "status");
    n.style.cssText = "position:relative;z-index:36;background:#2C2416;color:#FFF3CC;" +
      "font:600 .78rem/1.6 Inter,system-ui,sans-serif;text-align:center;padding:.5rem 1rem";
    n.textContent = txt;
    hdr.parentNode.insertBefore(n, hdr);
  }

  function mount() {
    var hdr = document.getElementById("site-header");
    if (!hdr || !hdr.parentNode || document.querySelector("[data-noor-sponsor]")) return;
    if (DIALS && DIALS["sponsor.band"] === false && !isJumuah()) return;
    var j = isJumuah(), M = j ? JUMUAH : MISSION;
    var d = document.createElement("div");
    d.setAttribute("data-noor-sponsor", "");
    if (j) d.setAttribute("data-jumuah", "");
    d.style.cssText = "position:relative;z-index:35;background:" + M.bg +
      ";border-bottom:1px solid " + M.border;
    d.innerHTML =
      '<div style="max-width:72rem;margin:0 auto;padding:' + (j ? ".5rem" : ".4rem") +
      ' 1rem;display:flex;align-items:center;gap:.55rem;font-size:.71rem;line-height:1.6;color:' + M.tone +
      ';font-family:Inter,system-ui,sans-serif;flex-wrap:wrap">' +
      '<span aria-hidden="true" style="color:' + (j ? "#C9A227" : "rgba(201,162,39,.75)") +
      ';font-size:' + (j ? ".95rem" : "inherit") + '">' + M.mark + "</span>" +
      "<span style=\"flex:1 1 16rem;min-width:0\">" + M.text + "</span>" +
      '<a href="' + M.href + '" style="margin-inline-start:auto;flex:none;color:#8a6d13;font-weight:700;text-decoration:none;white-space:nowrap">' +
      M.cta + "</a></div>";
    hdr.parentNode.insertBefore(d, hdr.nextSibling);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
  askDials();
})();
