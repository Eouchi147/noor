/* ============================================================
   NOOR Search · one magnifier, every page
   ------------------------------------------------------------
   Before this, the search field existed only on the landing
   page and looked at forty timeline nodes. A reader who typed
   "qadr" was told, truthfully, that there was no match, because
   nothing on the site indexed a single word of vocabulary.

   Now it searches the whole house: the encyclopedia, the 114
   surahs, every prophet, companion, place, hero and figure, the
   stations of the Path, the masjid tools and the children's
   rooms. Spelling is folded, so qadar, taqdeer and kadar all
   arrive at qadr.

   Results come back grouped, and the groups are ordered by their
   own best match, so a search for Uhud opens with Places and a
   search for riba opens with the encyclopedia.
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
    loading = fetch("/assets/search-index.json?v=78", { cache: "force-cache" })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) {
        var groups = j.g || [], order = {}, names = {};
        groups.forEach(function (g, i) { order[g.k] = i; names[g.k] = g.n; });
        function prep(e, g, url) {
          return { e: e, g: g, u: url, t: fold(e.t), l: (e.l || []).map(fold),
                   s: fold(e.s), a: e.a || "",
                   w: (groups[order[g]] || {}).w || 0 };
        }
        var all = [];
        (j.w || []).forEach(function (e) { all.push(prep(e, "words", "/dictionary/" + e.i)); });
        (j.e || []).forEach(function (e) { all.push(prep(e, e.g, e.u)); });
        /* a room is worth finding by name, but it should never crowd out the
           thing inside it that the reader actually asked for */
        (j.r || []).forEach(function (e) { all.push(prep(e, "rooms", e.u)); });
        IDX = { all: all, names: names, order: order };
        return IDX;
      })
      .catch(function () { IDX = { all: [], names: {}, order: {} }; return IDX; });
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
        'with the prophets, the companions, the places, the surahs and every room.</p>';
      return;
    }
    load().then(function (I) {
      var buckets = {}, best = {};
      for (var i = 0; i < I.all.length; i++) {
        var r = I.all[i], sc = score(r, n);
        if (!sc) continue;
        sc += r.w;                       /* a named prophet beats a passing mention */
        (buckets[r.g] || (buckets[r.g] = [])).push({ s: sc, r: r });
        if (sc > (best[r.g] || 0)) best[r.g] = sc;
      }
      /* the group that answered best comes first: that is the whole point */
      var keys = Object.keys(buckets).sort(function (a, b) {
        if (best[b] !== best[a]) return best[b] - best[a];
        return (I.order[a] || 99) - (I.order[b] || 99);
      });
      if (!keys.length) {
        out.innerHTML = '<p class="ns-hint">Nothing under that spelling yet. Try fewer letters, or the ' +
          'plain English word. <a href="/feedback">Tell us what was missing</a> and it gets added.</p>';
        return;
      }
      var h = "", shown = 0;
      for (var k = 0; k < keys.length && shown < 34; k++) {
        var g = keys[k], list = buckets[g];
        list.sort(function (a, b) { return b.s - a.s || a.r.e.t.length - b.r.e.t.length; });
        /* the best answering group gets room to breathe; the rest stay tidy */
        var cap = k === 0 ? 8 : 5;
        h += '<p class="ns-g">' + esc(I.names[g] || g) + "</p>";
        h += list.slice(0, cap).map(function (x) {
          shown++;
          return '<a class="ns-hit" href="' + esc(x.r.u) + '">' +
            "<b>" + esc(x.r.e.t) + "</b>" +
            (x.r.e.a ? '<span class="ns-ar notranslate" translate="no">' + esc(x.r.e.a) + "</span>" : "") +
            (x.r.e.s ? '<span class="ns-s">' + esc(x.r.e.s) + "</span>" : "") +
            "</a>";
        }).join("");
        if (list.length > cap) {
          h += '<p class="ns-more">and ' + (list.length - cap) + " more in " +
               esc(I.names[g] || g) + "</p>";
        }
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

  /* One search on a page, not two.

     The library has two doors and they are not the same job. The Menu pill
     opens assets/noor-menu.js's dial: the map of the house, browsed by
     section. Search -- the bar's Search, the field on the arrival, the "/"
     key -- opens this sheet: you type a word and the answer is under your
     thumb. Until 9 September 2026 the bar's Search carried the dial's own
     attribute as well, so on one screen the field opened the sheet and the
     bar opened the dial: two different products from two controls a finger
     apart. Now Search is this, everywhere, and the Menu is the dial. */
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
