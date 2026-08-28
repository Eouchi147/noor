/* NOOR · the dials must actually turn something.
   ------------------------------------------------------------------
   The owner turned the Guardian's Journal off in the console and the journal
   went on working: the link stayed in the menu on all fifty four pages that
   carry it, and /journal still rendered its hero, its rules and its promise.

   The API was right the whole time. GET /api/journal returns 404 when
   journal.on is false, and the server-rendered entry pages return not-found.
   The gap was entirely on the static side, and it is a structural one: the
   menu is baked into every page at generation time, so no server-side dial can
   ever reach it. Only the page itself can.

   So this file reads the public dials and applies the ones that decide what a
   reader may see. It is deliberately small and deliberately fail-open: if the
   request never lands, the site behaves exactly as it was built, because a
   library that hides itself when a network hiccups is worse than one that
   shows a section the owner meant to close for an hour.

   The last answer is kept for the session, so after the first page there is no
   flash of a link that is about to disappear.
*/
(function () {
  "use strict";
  var KEY = "noor-dials-v1";

  function hideLink(a) {
    /* hide the whole row the link sits in, not just the words, or a menu is
       left with a gap and a stray bullet where the journal used to be */
    var row = a.closest("li, .shl, .door-in > a, .wgo-c") || a;
    row.setAttribute("hidden", "hidden");
    row.style.display = "none";
  }

  function closeJournalPage() {
    var main = document.querySelector("main");
    if (!main) return;
    var hero = main.querySelector(".rhero");
    Array.prototype.forEach.call(main.children, function (el) {
      if (el !== hero) { el.setAttribute("hidden", "hidden"); el.style.display = "none"; }
    });
    var note = document.createElement("div");
    note.style.cssText = "max-width:34rem;margin:2.6rem auto 4rem;padding:0 1rem;text-align:center";
    note.innerHTML =
      '<p style="font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;' +
      'color:rgba(44,36,22,.45);margin:0 0 .7rem">The journal is closed</p>' +
      '<p style="font-size:.95rem;line-height:1.9;color:rgba(44,36,22,.78);margin:0 0 1.2rem">' +
      'This section is resting. It is one man&rsquo;s opinions, offered so that people who know ' +
      'more can correct him, and it is switched off from time to time. Nothing else in the ' +
      'Codex is affected, and the library is open as always.</p>' +
      '<a href="/" style="display:inline-block;background:linear-gradient(135deg,#C9A227,#E9C86A);' +
      'color:#1A160F;font-weight:800;border-radius:999px;padding:.62rem 1.25rem;font-size:.8rem;' +
      'text-decoration:none">Back to the Codex</a>';
    main.appendChild(note);
    document.title = "The journal is closed · NOOR Codex of Light";
  }

  function apply(s) {
    if (!s) return;

    /* ---- the Guardian's Journal ---- */
    if (s["journal.on"] === false) {
      var links = document.querySelectorAll(
        'a[href="/journal"], a[href="journal.html"], a[href="/journal.html"], ' +
        'a[href^="/journal/"], a[href^="journal.html#"], a[href="/journal-rules"], ' +
        'a[href="journal-rules.html"]');
      Array.prototype.forEach.call(links, hideLink);
      if (/^\/journal(-rules)?(\.html)?(\/|$)/.test(location.pathname)) closeJournalPage();
    }

    /* ---- a notice the owner wants across the top of the house ---- */
    var notice = (s["notice.text"] || "").trim();
    if (notice && !document.getElementById("noor-notice")) {
      var bar = document.createElement("div");
      bar.id = "noor-notice";
      bar.textContent = notice;
      bar.style.cssText = "background:linear-gradient(90deg,#14100A,#241D12);color:#F4D46A;" +
        "font-size:.76rem;line-height:1.6;text-align:center;padding:.5rem 1rem;font-weight:700";
      var hdr = document.getElementById("site-header");
      if (hdr && hdr.parentNode) hdr.parentNode.insertBefore(bar, hdr);
    }
  }

  /* the remembered answer first, so a link never flickers on the second page */
  try {
    var cached = sessionStorage.getItem(KEY);
    if (cached) apply(JSON.parse(cached));
  } catch (e) { }

  fetch("/api/settings", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      var s = j && j.s;
      if (!s) return;
      try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { }
      apply(s);
    })
    .catch(function () { /* fail open: the site stands as it was built */ });
})();
