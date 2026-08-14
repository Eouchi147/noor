/* ============================================================
   NOOR Search · one magnifier, every page
   ------------------------------------------------------------
   Before this, the search field existed only on the landing
   page and looked at forty timeline nodes. A reader who typed
   "qadr" was told, truthfully, that there was no match, because
   nothing on the site indexed a single word of vocabulary.

   Now the magnifier in the header opens the same overlay on
   every page and searches three things: the encyclopedia, the
   rooms, and the stations of the Path. Spelling is folded, so
   qadar, taqdeer and kadar all arrive at qadr.
   ============================================================ */
(function () {
  "use strict";
  var IDX = null, loading = null, box = null, input = null, out = null, openNow = false;

  function fold(s) {
    return (s || "").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/['’ʻʼ`]/g, "")
      .replace(/[^a-z0-9؀-ۿ ]+/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  function load() {
    if (IDX) return Promise.resolve(IDX);
    if (loading) return loading;
    loading = fetch("/assets/search-index.json", { cache: "force-cache" })
      .then(function (r) { return r.ok ? r.json() : { w: [], r: [] }; })
      .then(function (j) {
        IDX = {
          w: (j.w || []).map(function (e) {
            return { e: e, t: fold(e.t), l: (e.l || []).map(fold), s: fold(e.s), a: e.a || "" };
          }),
          r: (j.r || []).map(function (e) { return { e: e, t: fold(e.t), s: fold(e.s) }; }),
        };
        return IDX;
      })
      .catch(function () { IDX = { w: [], r: [] }; return IDX; });
    return loading;
  }

  function score(rec, n) {
    if (rec.t === n) return 100;
    if (rec.l && rec.l.indexOf(n) >= 0) return 92;
    if (rec.t.indexOf(n) === 0) return 80;
    if (rec.l) for (var i = 0; i < rec.l.length; i++) if (rec.l[i].indexOf(n) === 0) return 72;
    if (rec.a && rec.a.indexOf(n) >= 0) return 70;
    if (rec.t.indexOf(n) >= 0) return 55;
    if (rec.l) for (var j = 0; j < rec.l.length; j++) if (rec.l[j].indexOf(n) >= 0) return 46;
    if ((" " + rec.s).indexOf(" " + n) >= 0) return 28;
    if (rec.s.indexOf(n) >= 0) return 12;
    return 0;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function shell() {
    if (box) return;
    box = document.createElement("div");
    box.id = "noor-search";
    box.innerHTML =
      '<div class="ns-back"></div>' +
      '<div class="ns-panel" role="dialog" aria-modal="true" aria-label="Search the Codex">' +
        '<label class="ns-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
        'stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
        '<input type="search" id="ns-q" autocomplete="off" spellcheck="false" ' +
        'placeholder="Search the Path: a word, a prophet, a place, a room" aria-label="Search"/>' +
        '<button type="button" class="ns-x" aria-label="Close">esc</button></label>' +
        '<div class="ns-out" id="ns-out"></div>' +
      "</div>";
    document.body.appendChild(box);
    input = box.querySelector("#ns-q");
    out = box.querySelector("#ns-out");
    box.querySelector(".ns-back").addEventListener("click", close);
    box.querySelector(".ns-x").addEventListener("click", close);
    input.addEventListener("input", function () { render(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { var a = out.querySelector("a"); if (a) a.click(); }
    });
    out.addEventListener("click", function (e) { if (e.target.closest("a")) close(); });
  }

  function render(term) {
    var n = fold(term);
    if (!n || n.length < 2) {
      out.innerHTML = '<p class="ns-hint">Type two letters. Every word of the encyclopedia is in here, ' +
        'in every spelling we know.</p>';
      return;
    }
    load().then(function (I) {
      var words = [], rooms = [];
      I.w.forEach(function (r) { var s = score(r, n); if (s) words.push({ s: s, e: r.e }); });
      I.r.forEach(function (r) { var s = score(r, n); if (s) rooms.push({ s: s, e: r.e }); });
      words.sort(function (a, b) { return b.s - a.s; });
      rooms.sort(function (a, b) { return b.s - a.s; });
      var h = "";
      if (words.length) {
        h += '<p class="ns-g">Words of the Path</p>';
        h += words.slice(0, 8).map(function (x) {
          return '<a class="ns-hit" href="/dictionary#' + esc(x.e.i) + '">' +
            '<b>' + esc(x.e.t) + '</b>' +
            (x.e.a ? '<span class="ns-ar notranslate" translate="no">' + x.e.a + "</span>" : "") +
            '<span class="ns-s">' + esc(x.e.s) + "</span></a>";
        }).join("");
      }
      if (rooms.length) {
        h += '<p class="ns-g">Rooms</p>';
        h += rooms.slice(0, 5).map(function (x) {
          return '<a class="ns-hit" href="' + esc(x.e.u) + '"><b>' + esc(x.e.t) +
            '</b><span class="ns-s">' + esc(x.e.s) + "</span></a>";
        }).join("");
      }
      if (!h) {
        h = '<p class="ns-hint">Nothing under that spelling yet. Try fewer letters, or the plain English ' +
          'word. <a href="/feedback">Tell us what was missing</a> and it gets added.</p>';
      }
      out.innerHTML = h;
    });
  }

  function open() {
    shell(); load();
    openNow = true;
    document.body.classList.add("ns-open");
    box.classList.add("on");
    render(input.value || "");
    setTimeout(function () { input.focus(); input.select(); }, 30);
  }
  function close() {
    if (!box) return;
    openNow = false;
    box.classList.remove("on");
    document.body.classList.remove("ns-open");
  }

  addEventListener("keydown", function (e) {
    if (e.key === "Escape" && openNow) close();
    else if ((e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) && !openNow) {
      var t = e.target.tagName;
      if (t === "INPUT" || t === "TEXTAREA" || e.target.isContentEditable) return;
      e.preventDefault(); open();
    }
  });

  function wire() {
    var b = document.getElementById("search-toggle");
    if (b) b.addEventListener("click", function (e) { e.preventDefault(); open(); });
    /* the landing page keeps its own inline field; do not fight it */
    if (document.getElementById("search-bar")) {
      var bar = document.getElementById("search-bar");
      if (bar) bar.remove();
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
  window.NOOR_SEARCH = { open: open, close: close };
})();
