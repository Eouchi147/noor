/* NOOR · the figure fitter.
   ------------------------------------------------------------------
   A diagram drawn in a 900 unit viewBox and rendered into 320 points of phone
   is being shown at roughly a third of the size it was drawn at, and its
   labels come out at six pixels. Six pixel type is not small type. It is
   decoration in the shape of words, and every figure on this site was built
   on the promise that the still frame carries the meaning.

   So a figure whose smallest label would fall below the legibility floor is
   not shrunk any further. It keeps the width at which its type is still
   readable and scrolls inside its own box. The page itself never scrolls
   sideways; only the figure does, and only when it must.

   This runs on every page, measures rather than guesses, and does nothing at
   all to a figure that already fits. Nothing here is decorative: a figure that
   cannot be read is a figure that is not there.
*/
(function () {
  "use strict";
  var FLOOR = 7.6;        /* rendered px below which a label stops being words */
  var CEIL = 940;         /* never demand more width than a tablet can show */

  function fit(svg) {
    try {
      var vb = svg.viewBox && svg.viewBox.baseVal;
      if (!vb || !vb.width) return;
      var texts = svg.getElementsByTagName("text");
      if (!texts.length) return;
      var w = svg.getBoundingClientRect().width;
      if (!w) return;

      var smallest = Infinity;
      for (var i = 0; i < texts.length; i++) {
        if (!(texts[i].textContent || "").trim()) continue;
        var s = parseFloat(getComputedStyle(texts[i]).fontSize) || 0;
        if (s && s < smallest) smallest = s;
      }
      if (smallest === Infinity) return;

      /* the width at which the smallest label finally reaches the floor */
      var need = vb.width * (FLOOR / smallest);
      var box = svg.parentNode;
      if (!box || box.nodeType !== 1) return;

      if (need > w + 1) {
        box.classList.add("figscroll");
        svg.style.minWidth = Math.min(Math.ceil(need), CEIL) + "px";
      } else if (box.classList.contains("figscroll")) {
        /* the window grew: give the figure back to the page */
        box.classList.remove("figscroll");
        svg.style.minWidth = "";
      }
    } catch (e) { /* a figure that cannot be measured is left exactly as it is */ }
  }

  function run() {
    var all = document.getElementsByTagName("svg");
    for (var i = 0; i < all.length; i++) fit(all[i]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();

  var t = null;
  addEventListener("resize", function () { clearTimeout(t); t = setTimeout(run, 180); }, { passive: true });
})();
