/* NOOR Motion · the loader that decides whether motion is worth its weight.
   ------------------------------------------------------------------
   GSAP, ScrollTrigger and DrawSVG come to about a hundred and sixteen
   kilobytes, and they were being downloaded and parsed on every page that
   included them. Eight pages of the site loaded all three and used none of
   them: there was not a single .mo element on any of those pages.

   Worse, the weight fell hardest on the readers least able to carry it. A
   phone in battery saver mode parses that library on a throttled core before
   it can lay out a page, and the reader feels every millisecond of it.

   So this file, three kilobytes, decides. It loads nothing unless the page
   actually contains something to animate, and it declines in three further
   cases where the motion would be unwanted, unseen, or unaffordable:

     · the reader has asked for reduced motion
     · the device reports a small number of cores or little memory
     · the connection reports itself as slow, or data saver is on

   In every declining case the page is already correct. The house rule for
   these classes is that nothing is hidden until the animation is alive, so a
   page with no GSAP shows all of its content immediately. Motion is the
   second telling here exactly as it is in the figure kit.

   Load this instead of the three library tags:
     <script src="/assets/noor-motion-boot.js?v=101" defer></script>
*/
(function () {
  "use strict";

  var BASE = "/assets/";
  var LIBS = ["gsap.min.js", "ScrollTrigger.min.js", "DrawSVGPlugin.min.js", "noor-motion.js?v=101"];

  function wanted() {
    /* nothing on the page asks to move */
    if (!document.querySelector(".mo,.mo-pop,.mo-draw,.mo-float,.mo-count,[data-mo-stagger]")) return false;

    /* the reader has said no */
    try {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    } catch (e) {}

    /* the device is small: four cores or fewer, or two gigabytes or less.
       These are the phones the complaint came from. */
    try {
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return false;
      if (navigator.deviceMemory && navigator.deviceMemory <= 2) return false;
    } catch (e) {}

    /* the connection is poor, or the reader has asked the browser to save data */
    try {
      var c = navigator.connection;
      if (c) {
        if (c.saveData) return false;
        if (/^(slow-)?2g$/.test(c.effectiveType || "")) return false;
      }
    } catch (e) {}

    return true;
  }

  function load(list, done) {
    if (!list.length) return done && done();
    var s = document.createElement("script");
    s.src = BASE + list[0];
    s.async = false;               /* order matters: gsap before its plugins */
    s.onload = function () { load(list.slice(1), done); };
    s.onerror = function () { /* the page is already correct without it */ };
    document.head.appendChild(s);
  }

  function go() {
    if (!wanted()) return;
    /* after paint, and after anything the reader is waiting on */
    if (window.requestIdleCallback) requestIdleCallback(function () { load(LIBS); }, { timeout: 2500 });
    else setTimeout(function () { load(LIBS); }, 350);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true });
  else go();
})();
