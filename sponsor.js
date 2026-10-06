/* The mission line. Once this file ran the regional sponsorship system;
   that program is retired. What remains is the one sentence every page
   carries: the library is free, forever, on the gifts of its readers.

   Friday used to take this strip from maghrib on Thursday until maghrib on
   Friday. It has moved to a card in noor-fx.js, which reaches every page --
   the arrival among them, which this band cannot, because it hangs off the
   shared header and the arrival has none. A band is furniture, there on
   Tuesday as well, and the eye learns to skip that strip; Jumu'ah is better
   served by something that comes once and then goes. */
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

  /* Friday moved. It is a card in noor-fx.js now -- once, above the thumb, on
     every page including the arrival, which this band cannot reach. The rule
     for when Jumu'ah begins (after six on Thursday, all of Friday until six,
     ?jumuah=1 to force it) lives there with it. What is left here is the one
     sentence the house carries every day. */
  var DIALS = null;                 /* filled by /api/settings, may never arrive */

  /* THE LINE'S WORDINGS (3 October 2026, LANTERN.md section 9). The Lantern
     chooses one of these by id, and only these: each is written here and in
     api/_public.js, word for word, and tests/giving.mjs keeps the two lists
     equal. The settings answer names the id with its season already applied
     on the server ({lantern: {line}}); anything else, or no answer at all,
     is the everyday line. The places the band appears do not change. */
  var LINES = {
    "everyday": "This library is free for everyone, forever · no ads, no trackers · it runs on the gifts of its readers",
    "ramadan": "Ramadan Mubarak · this library is free for everyone, forever · no ads, no trackers · it runs on the gifts of its readers",
    "last-ten": "The last ten nights of Ramadan · this library is free for everyone, forever · no ads, no trackers · it runs on the gifts of its readers",
    "dhul-hijjah": "The first ten days of Dhul Hijjah · this library is free for everyone, forever · no ads, no trackers · it runs on the gifts of its readers",
    "thanks": "Thank you · last month the gifts of readers covered this library's running costs · free for everyone, forever · no ads, no trackers"
  };
  var LINE = "everyday";
  function lineText() { return Object.prototype.hasOwnProperty.call(LINES, LINE) ? LINES[LINE] : LINES.everyday; }

  var MISSION = {
    mark: "✦",
    text: LINES.everyday,             /* the band shows the chosen wording, lineText() */
    href: "/donate",
    cta: "Keep it lit →",
    /* The band paints itself with inline styles, which no stylesheet can
       answer, so it reads the house's own ink token instead of naming a
       colour: parchment by default, and the night wherever noor-fx.js has
       turned the room over. One line, both lights. */
    tone: "color-mix(in srgb, var(--ink,#2C2416) 62%, transparent)",
    bg: "linear-gradient(90deg,color-mix(in srgb, var(--ink,#2C2416) 4%, transparent),transparent 70%)",
    border: "color-mix(in srgb, var(--ink,#2C2416) 8%, transparent)",
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
          var before = JSON.stringify(DIALS), lineBefore = LINE;
          DIALS = j.s;
          var id = j.lantern && typeof j.lantern.line === "string" ? j.lantern.line : "everyday";
          LINE = Object.prototype.hasOwnProperty.call(LINES, id) ? id : "everyday";
          notice(DIALS["notice.text"]);
          if (JSON.stringify(DIALS) !== before || LINE !== lineBefore) remount();
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
    if (DIALS && DIALS["sponsor.band"] === false) return;
    /* On a phone the Jumu'ah reminder ran five lines and pushed the page
       itself below the fold. It keeps its whole text, but folds to three
       lines there; the reminder is a whisper before the door, not the door. */
    if (!document.getElementById("nsp-css")) {
      var st = document.createElement("style");
      st.id = "nsp-css";
      st.textContent = "@media (max-width:56rem){[data-noor-sponsor]>div{padding:.42rem .9rem!important;font-size:.79rem!important;line-height:1.55!important}" +
        "[data-noor-sponsor] .nsp-t{display:-webkit-box;-webkit-line-clamp:3;line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}}";
      document.head.appendChild(st);
    }
    /* Friday is noor-fx.js's now: a card that comes once, a breath after the
       page settles, and goes again -- on every page, the arrival included,
       which this band never reached because it hangs off the shared header
       and the arrival has none. A band is furniture and the eye learns to
       skip it; the day deserves better than a strip it has already learned
       to skip. What is left here is the one sentence, every day. */
    var M = MISSION;
    var d = document.createElement("div");
    d.setAttribute("data-noor-sponsor", "");
    d.style.cssText = "position:relative;z-index:35;background:" + M.bg +
      ";border-bottom:1px solid " + M.border;
    d.innerHTML =
      '<div style="max-width:72rem;margin:0 auto;padding:.4rem 1rem;display:flex;' +
      'align-items:center;gap:.55rem;font-size:.79rem;line-height:1.6;color:' + M.tone +
      ';font-family:Inter,system-ui,sans-serif;flex-wrap:wrap">' +
      '<span aria-hidden="true" style="color:rgba(201,162,39,.9);font-size:inherit">' + M.mark + "</span>" +
      "<span class=\"nsp-t\" style=\"flex:1 1 16rem;min-width:0\">" + lineText() + "</span>" +
      '<a href="' + M.href + '" style="margin-inline-start:auto;flex:none;color:var(--gold-hi,#8a6d13);font-weight:700;text-decoration:none;white-space:nowrap">' +
      M.cta + "</a></div>";
    hdr.parentNode.insertBefore(d, hdr.nextSibling);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
  askDials();
})();
