/* NOOR · the asking field
   ---------------------------------------------------------------------------
   The arrival is one question and one field. This file is the upgrade, not the
   page: what ships in the HTML is a working search form and six real links into
   the rooms that answer them, and a reader with no JavaScript gets exactly that
   -- six questions, six answers, one click each. Nothing below is required for
   the page to work; all of it is required for the page to feel like one thing.

   Two behaviours, and they are the same gesture at two speeds:

     tap a question   the answer opens where it stands, in the words of the room
                      that already answers it, with the evidence that room states
                      and a door into it. No page load, no lost place. Every word
                      is lifted verbatim by scripts/build-questions.py; nothing
                      here writes prose, and nothing here can drift from a room.

     type anything    the whole library answers -- 523 words, 114 surahs, every
                      room, every person -- through the index the house already
                      has. Questions that match are put first, because a question
                      answered in place is a better result than a link.

   The height animation measures rather than guesses: `height:auto` cannot be
   animated, so the panel is set to its scrollHeight, transitioned, and released
   to `auto` on the way in so it can reflow if the type wraps differently later.
*/
(function () {
  "use strict";
  var host = document.querySelector("[data-noor-ask]");
  if (!host) return;

  var input = host.querySelector("input[type=search], input[type=text]");
  var list = host.querySelector("[data-ask-list]");
  var live = host.querySelector("[data-ask-live]");
  if (!input || !list) return;

  var REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CHEV = '<svg class="cv" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  var DATA = null, loading = null, open = null, tid = 0, seq = 0;
  var HOME = list.innerHTML;                 /* the six that shipped in the HTML */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ------------------------------------------------------------ the answers */
  function load() {
    if (DATA) return Promise.resolve(DATA);
    if (!loading) loading = fetch("/assets/questions.json", { cache: "no-cache" })
      .then(function (r) { return r.json(); })
      .then(function (d) { DATA = (d && d.q) || []; return DATA; })
      .catch(function () { DATA = []; return DATA; });
    return loading;
  }

  function findQ(url, text) {
    if (!DATA) return null;
    for (var i = 0; i < DATA.length; i++) {
      if (DATA[i].u === url) return DATA[i];
    }
    /* a question whose href was rewritten still matches on its own words */
    var t = (text || "").replace(/\s+/g, " ").trim().toLowerCase();
    for (var j = 0; j < DATA.length; j++) {
      if (DATA[j].q.toLowerCase() === t) return DATA[j];
    }
    return null;
  }

  function panel(rec) {
    var p = document.createElement("div");
    p.className = "ask-a";
    p.innerHTML = '<div class="ask-a-in">' +
      (rec.m ? '<p class="m">' + esc(rec.m) + "</p>" : "") +
      '<p class="p">' + esc(rec.p) + "</p>" +
      '<p class="foot">' +
      (rec.e ? '<span class="ev">Evidence · ' + esc(rec.e) + "</span>" : "") +
      '<a class="go" href="' + esc(rec.u) + '">Read the whole room →</a>' +
      "</p></div>";
    return p;
  }

  function shut(btn) {
    var p = btn.parentNode.querySelector(".ask-a");
    if (!p) return;
    btn.setAttribute("aria-expanded", "false");
    p.classList.remove("on");
    if (REDUCED) { p.style.height = "0px"; return; }
    p.style.height = p.scrollHeight + "px";
    /* one frame at the measured height, so the transition has somewhere to go */
    requestAnimationFrame(function () { p.style.height = "0px"; });
  }

  function show(btn, rec) {
    var li = btn.parentNode;
    var p = li.querySelector(".ask-a");
    if (!p) { p = panel(rec); li.appendChild(p); }
    btn.setAttribute("aria-expanded", "true");
    var h = p.firstChild.offsetHeight;
    if (REDUCED) { p.style.height = "auto"; p.classList.add("on"); return; }
    p.style.height = "0px";
    requestAnimationFrame(function () {
      p.classList.add("on");
      p.style.height = h + "px";
      setTimeout(function () {
        if (btn.getAttribute("aria-expanded") !== "true") return;
        p.style.height = "auto";
        /* An answer that opens below the fold has not been given. Bring only as
           much of it into view as is missing -- never re-centre the screen,
           because moving the thing somebody just tapped is disorienting. The
           bar at the bottom of every page is 72-ish tall and would otherwise
           sit on top of the door into the room. */
        var r = p.getBoundingClientRect();
        var floor = innerHeight - 84;
        if (r.bottom > floor) {
          var top = btn.getBoundingClientRect().top;
          scrollBy({ top: Math.min(r.bottom - floor, Math.max(0, top - 96)), behavior: "smooth" });
        }
      }, 400);
    });
  }

  function toggle(btn) {
    var url = btn.getAttribute("data-url") || btn.getAttribute("href");
    var was = btn.getAttribute("aria-expanded") === "true";
    if (open && open !== btn) shut(open);
    open = null;
    if (was) { shut(btn); return; }
    load().then(function () {
      var rec = findQ(url, btn.getAttribute("data-q") || btn.textContent);
      if (!rec) { location.href = url; return; }   /* no answer to open: just go */
      show(btn, rec);
      open = btn;
    });
  }

  /* Turn the six shipped links into disclosures. The link is kept as the
     fallback the whole design rests on, so it is not thrown away: its href
     moves into the panel as "read the whole room", and it becomes a button,
     which is what a thing that opens and closes actually is. */
  function enhance() {
    var links = list.querySelectorAll("a.ask-q");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ask-q";
      b.setAttribute("aria-expanded", "false");
      b.setAttribute("data-url", a.getAttribute("href"));
      b.setAttribute("data-q", a.textContent.replace(/\s+/g, " ").trim());
      b.innerHTML = a.innerHTML;
      a.parentNode.replaceChild(b, a);
    }
  }

  list.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("button.ask-q") : null;
    if (!b || !list.contains(b)) return;
    e.preventDefault();
    toggle(b);
  });

  /* -------------------------------------------------------------- the field */
  /* The index's snippets are cut at 116 characters, and a good third of them
     land mid-word -- "so that no", "above the nis". That is the index's to fix,
     but a reader does not know that; they see a sentence that stops. An ellipsis
     turns an accident into a deliberate truncation, which is the honest thing
     to show until the harvester cuts on a word boundary. */
  function trim(s) {
    if (!s) return "";
    return /[.!?…”"')\]]$/.test(s.trim()) ? s : s.replace(/\s+\S*$/, "") + "…";
  }

  function row(x) {
    x = { t: x.t, a: x.a, s: trim(x.s), u: x.u };
    return '<a class="ask-r" href="' + esc(x.u) + '"><span><b>' + esc(x.t) +
      (x.a ? '<em class="notranslate" translate="no">' + esc(x.a) + "</em>" : "") +
      "</b>" + (x.s ? "<i>" + esc(x.s) + "</i>" : "") + "</span>" + CHEV + "</a>";
  }

  function qrow(rec) {
    return '<li><button type="button" class="ask-q" aria-expanded="false" data-url="' +
      esc(rec.u) + '" data-q="' + esc(rec.q) + '"><span>' + esc(rec.q) + "</span>" + CHEV +
      "</button></li>";
  }

  function say(n, term) {
    if (!live) return;
    live.textContent = !term ? "" : n ? n + (n === 1 ? " result" : " results") + " for " + term
                                     : "Nothing found for " + term;
  }

  function home() {
    list.innerHTML = HOME;
    enhance();
    open = null;
    say(0, "");
  }

  function look() {
    var term = input.value.trim();
    var mine = ++seq;
    if (term.length < 2) { home(); return; }

    load().then(function (qs) {
      var n = term.toLowerCase();
      var hits = [];
      for (var i = 0; i < qs.length && hits.length < 4; i++) {
        var q = qs[i];
        if (q.q.toLowerCase().indexOf(n) >= 0 ||
            (q.m && q.m.toLowerCase().indexOf(n) >= 0)) hits.push(q);
      }
      var need = window.NOOR_NEED_SEARCH ? window.NOOR_NEED_SEARCH() : Promise.resolve(true);
      return need.then(function () {
        var S = window.NOOR_SEARCH;
        if (!S || !S.find) return { qs: hits, groups: [] };
        return S.find(term).then(function (g) { return { qs: hits, groups: g || [] }; });
      });
    }).then(function (res) {
      if (mine !== seq || input.value.trim() !== term) return;   /* a later keystroke won */
      var h = "", count = 0;
      if (res.qs.length) {
        h += '<li class="ask-grp">Answered here</li>';
        for (var i = 0; i < res.qs.length; i++) { h += qrow(res.qs[i]); count++; }
      }
      for (var g = 0; g < res.groups.length && count < 30; g++) {
        var grp = res.groups[g];
        h += '<li class="ask-grp">' + esc(grp.name) + "</li>";
        var cap = g === 0 ? 6 : 4;
        for (var k = 0; k < grp.hits.length && k < cap && count < 30; k++) {
          h += "<li>" + row(grp.hits[k]) + "</li>";
          count++;
        }
      }
      if (!count) {
        h = '<li class="ask-none">Nothing under that spelling yet. Try fewer letters, ' +
            'or the plain English word. If it should be here, ' +
            '<a href="/feedback">tell us</a> and it will be.</li>';
      }
      list.innerHTML = h;
      open = null;
      say(count, term);
    });
  }

  input.addEventListener("input", function () {
    clearTimeout(tid);
    tid = setTimeout(look, 110);
  });
  input.addEventListener("search", look);          /* the native clear button */
  host.addEventListener("submit", function (e) {
    e.preventDefault();
    clearTimeout(tid);
    look();
  });

  /* Enter opens the first thing offered, whatever kind it is. */
  input.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    var first = list.querySelector("button.ask-q, a.ask-r");
    if (first) first.click();
  });

  /* "/" focuses the field from anywhere on the page, the way the house already
     opens its search -- but never while somebody is typing into something. */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable)) return;
    e.preventDefault();
    input.focus();
    input.select();
  });

  enhance();
  /* Warm the index and the questions on the first sign of intent, so the first
     keystroke answers instantly instead of waiting on 312 KB. */
  var warmed = false;
  function warm() {
    if (warmed) return;
    warmed = true;
    load();
    if (window.NOOR_NEED_SEARCH) window.NOOR_NEED_SEARCH();
    else if (window.NOOR_SEARCH && window.NOOR_SEARCH.find) window.NOOR_SEARCH.find("");
  }
  input.addEventListener("focus", warm);
  host.addEventListener("pointerenter", warm);
  setTimeout(warm, 2500);
})();
