/* ============================================================
   NOOR Text · the deep translation layer
   ------------------------------------------------------------
   The chrome of the site is translated by data-i18n keys. This
   layer translates the prose: every visible text node is hashed
   with the same cheap FNV pair the build uses, looked up in the
   loaded language, and swapped in place.

   Three properties matter, and they are all deliberate:

     · Nothing in the markup changes. No attributes were added to
       50 pages, so there is nothing to keep in sync and nothing
       that can rot.
     · A half finished language is not a broken page. A string
       with no translation yet simply stays in English.
     · Switching back to English is exact, because the original
       is kept on the node itself.
   ============================================================ */
(function () {
  "use strict";
  var CACHE = {};          /* lang -> {hash: translation} */
  var ORIG = "__noorEn";   /* where the English is parked on each node */
  var CUR = "en";
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };

  function fnv(s, h) {
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i) & 0xFFFF;
      h = Math.imul(h, 0x01000193) >>> 0;   /* imul, because a plain multiply
                                               overflows 53 bit float precision
                                               and silently loses the low bits */
    }
    return h;
  }
  function key(s) {
    return ("0000000" + fnv(s, 0x811C9DC5).toString(16)).slice(-8) +
           ("0000000" + fnv(s, 0x7B5C1A9F).toString(16)).slice(-8);
  }
  function norm(s) { return s.replace(/\s+/g, " ").trim(); }

  function translatable(node) {
    var p = node.parentNode;
    if (!p || p.nodeType !== 1) return false;
    if (SKIP[p.tagName]) return false;
    if (p.closest && p.closest(".notranslate,[translate=no]")) return false;
    /* a transliteration is how to SAY the Arabic; carrying it into the
       reader's own script turns it into a copy of the line above it */
    if (p.closest && p.closest(".trl,.translit,.pctrl")) return false;
    if (p.hasAttribute && p.hasAttribute("data-i18n")) return false;  /* the chrome owns it */
    return true;
  }

  function walk(root, fn) {
    var w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, null, false), n;
    while ((n = w.nextNode())) fn(n);
  }

  var ATTRS = ["placeholder", "aria-label", "title", "alt"];

  function applyTo(root, pack) {
    var swapped = 0;
    walk(root, function (n) {
      var raw = n.nodeValue;
      if (!raw || !/\S/.test(raw)) return;
      if (!translatable(n)) return;
      if (n[ORIG] === undefined) {
        var s = norm(raw);
        if (s.length < 2 || !/[A-Za-z]/.test(s)) return;
        n[ORIG] = raw;
      }
      var en = norm(n[ORIG]);
      if (!pack) { if (n.nodeValue !== n[ORIG]) n.nodeValue = n[ORIG]; return; }
      var t = pack[key(en)];
      if (t === undefined) { if (n.nodeValue !== n[ORIG]) n.nodeValue = n[ORIG]; return; }
      /* keep whatever spacing the original text node carried around it */
      var lead = (n[ORIG].match(/^\s*/) || [""])[0];
      var tail = (n[ORIG].match(/\s*$/) || [""])[0];
      n.nodeValue = lead + t + tail;
      swapped++;
    });
    var scope = (root && root.querySelectorAll) ? root : document;
    ATTRS.forEach(function (a) {
      scope.querySelectorAll("[" + a + "]").forEach(function (el) {
        var mem = ORIG + a;
        if (el[mem] === undefined) el[mem] = el.getAttribute(a);
        var en = norm(el[mem] || "");
        if (!en || !/[A-Za-z]/.test(en)) return;
        var t = pack && pack[key(en)];
        el.setAttribute(a, t === undefined ? el[mem] : t);
        if (t !== undefined) swapped++;
      });
    });
    return swapped;
  }

  function load(code) {
    if (code === "en") return Promise.resolve(null);
    if (CACHE[code]) return Promise.resolve(CACHE[code]);
    /* PACK_V: bump with every release that ships new packs, or readers keep stale translations forever */
    return fetch("/i18n/text/" + code + ".json?v=83", { cache: "force-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return null;
        CACHE[code] = j.s || j;
        return CACHE[code];
      })
      .catch(function () { return null; });
  }

  var pending = null;
  function setLang(code) {
    CUR = code || "en";
    return load(CUR).then(function (pack) {
      pending = pack;
      var n = applyTo(document.body, pack);
      observe();
      return n;
    });
  }

  /* content the pages render themselves (search hits, the planner, the wizard)
     arrives after the swap, so translate it as it lands */
  var obs = null, queued = false;
  function observe() {
    if (obs || !window.MutationObserver) return;
    obs = new MutationObserver(function (ms) {
      if (queued) return;
      var touched = false;
      for (var i = 0; i < ms.length; i++) if (ms[i].addedNodes && ms[i].addedNodes.length) { touched = true; break; }
      if (!touched) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        if (CUR !== "en" || pending) applyTo(document.body, pending);
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  window.NOOR_TEXT = { setLang: setLang, key: key, apply: applyTo, lang: function () { return CUR; } };

  /* follow the chrome: whenever the language door is used, the prose follows */
  function boot() {
    var l = "en";
    try { l = (window.NOOR_I18N && NOOR_I18N.lang) || localStorage.getItem("noor_lang") || "en"; } catch (e) {}
    if (l && l !== "en") setLang(l); else observe();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
