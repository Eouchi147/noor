/* The mission line. Once this file ran the regional sponsorship system;
   that program is retired. What remains is the one sentence every page
   carries: the library is free, forever, on the gifts of its readers. */
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

  function mount() {
    var hdr = document.getElementById("site-header");
    if (!hdr || !hdr.parentNode || document.querySelector("[data-noor-sponsor]")) return;
    var d = document.createElement("div");
    d.setAttribute("data-noor-sponsor", "");
    d.style.cssText = "position:relative;z-index:35;background:linear-gradient(90deg,rgba(44,36,22,.035),transparent 70%);border-bottom:1px solid rgba(44,36,22,.06)";
    d.innerHTML = '<div style="max-width:72rem;margin:0 auto;padding:.4rem 1rem;display:flex;align-items:center;gap:.55rem;font-size:.71rem;color:rgba(44,36,22,.55);font-family:Inter,system-ui,sans-serif">' +
      '<span aria-hidden="true" style="color:rgba(201,162,39,.75)">✦</span>' +
      "<span>This library is free for everyone, forever · no ads, no trackers · it runs on the gifts of its readers</span>" +
      '<a href="donate.html" style="margin-left:auto;flex:none;color:#8a6d13;font-weight:700;text-decoration:none">Keep it lit →</a>' +
      "</div>";
    hdr.parentNode.insertBefore(d, hdr.nextSibling);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
