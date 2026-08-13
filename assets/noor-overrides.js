/* NOOR corrections layer · the reader's side.
 *
 * The Codex is static files, so an urgent correction cannot wait for a
 * release. This script asks /api/overrides once per session for the small
 * list of approved text patches, keeps only the ones written for this page,
 * and applies them by walking TEXT NODES and swapping exact matches.
 *
 * What it will never do:
 *   · touch an attribute of any kind
 *   · touch anything inside script, style, noscript, textarea, code or pre
 *   · touch anything inside an element marked notranslate or translate="no",
 *     which is how every line of Arabic in this house is already marked
 *   · touch any text containing Arabic script, whatever its container says
 *   · use innerHTML, or build a single node
 *
 * If the endpoint is missing, dark, or empty, this file does nothing at all
 * and costs one cached request. Every step is guarded; a failure here can
 * never reach the page.
 *
 * An override is a bandage on a live page. The permanent fix belongs in the
 * next release of the file itself.
 */
(function () {
  "use strict";
  try {
    if (typeof document === "undefined" || !document.body) {
      /* the script is deferred, so this should not happen; if it somehow
         does, wait for the document rather than doing anything clever */
      if (typeof document !== "undefined") {
        document.addEventListener("DOMContentLoaded", function () { try { start(); } catch (e) {} });
        return;
      }
      return;
    }
    start();
  } catch (e) { /* the page is never harmed by this file */ }

  function start() {
    var KEY = "noor_ovr_v1";
    var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, TITLE: 1, CODE: 1, PRE: 1, SVG: 1, CANVAS: 1, IFRAME: 1, HEAD: 1 };
    var ARABIC = /[\u0600-\u06FF\u0750-\u077F\u0870-\u089F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

    function page() {
      var p = "";
      try { p = String(location.pathname || ""); } catch (e) { return "index"; }
      p = p.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\.html$/, "").toLowerCase();
      if (!p) return "index";
      if (p === "masjid") return "masjid/index";
      if (p === "stories") return "stories/index";
      return p;
    }

    function cached() {
      try {
        var raw = sessionStorage.getItem(KEY);
        if (!raw) return null;
        var v = JSON.parse(raw);
        return v && Object.prototype.toString.call(v.items) === "[object Array]" ? v : null;
      } catch (e) { return null; }
    }
    function remember(v) {
      try { sessionStorage.setItem(KEY, JSON.stringify({ items: v || [] })); } catch (e) {}
    }

    /* one entry is usable only if it survives the same rules the endpoint
       enforces. A store that somehow held a bad row still cannot reach a
       reader, because the check happens again here. */
    function usable(o) {
      if (!o || typeof o !== "object") return false;
      var f = typeof o.find === "string" ? o.find : "";
      var r = typeof o.replace === "string" ? o.replace : "";
      if (f.length < 3 || f.length > 400 || r.length > 400) return false;
      if (/[<>{}]/.test(f) || /[<>{}]/.test(r)) return false;
      if (/script|http/i.test(f) || /script|http/i.test(r)) return false;
      if (ARABIC.test(f) || ARABIC.test(r)) return false;
      if (f === r) return false;
      return true;
    }

    function mine(items) {
      var here = page(), out = [];
      for (var i = 0; i < (items || []).length && out.length < 60; i++) {
        var o = items[i];
        if (!o || String(o.page || "").toLowerCase() !== here) continue;
        if (!usable(o)) continue;
        out.push({ find: o.find, replace: String(o.replace || "") });
      }
      return out;
    }

    function guarded(node) {
      /* walk up: any forbidden container, anywhere above, disqualifies */
      var el = node.parentNode;
      var depth = 0;
      while (el && el.nodeType === 1 && depth < 60) {
        var tag = String(el.nodeName || "").toUpperCase();
        if (SKIP[tag]) return true;
        try {
          if (el.getAttribute && el.getAttribute("translate") === "no") return true;
          if (el.classList && el.classList.contains("notranslate")) return true;
          if (el.hasAttribute && el.hasAttribute("data-no-override")) return true;
        } catch (e) { return true; }
        el = el.parentNode;
        depth++;
      }
      return false;
    }

    function apply(list) {
      if (!list.length) return 0;
      var hits = 0, walker, node, seen = 0;
      try {
        walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      } catch (e) { return 0; }
      var nodes = [];
      while ((node = walker.nextNode()) && seen < 40000) {
        seen++;
        var t = node.nodeValue;
        if (!t || t.length < 3) continue;
        var wanted = false;
        for (var i = 0; i < list.length; i++) {
          if (t.indexOf(list[i].find) !== -1) { wanted = true; break; }
        }
        if (wanted) nodes.push(node);
      }
      for (var n = 0; n < nodes.length; n++) {
        var target = nodes[n];
        if (guarded(target)) continue;
        var before = target.nodeValue;
        if (ARABIC.test(before)) continue;   /* never touch a line of Arabic */
        var after = before;
        for (var k = 0; k < list.length; k++) {
          if (after.indexOf(list[k].find) === -1) continue;
          after = after.split(list[k].find).join(list[k].replace);
        }
        if (after !== before) {
          /* nodeValue only. No markup is parsed, no node is created. */
          target.nodeValue = after;
          hits++;
        }
      }
      return hits;
    }

    function run(items) {
      var list;
      try { list = mine(items); } catch (e) { return; }
      if (!list.length) return;              /* nothing for this page, nothing done */
      try {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", function () { try { apply(list); } catch (e) {} });
        } else {
          apply(list);
        }
      } catch (e) {}
    }

    var have = cached();
    if (have) { run(have.items); return; }   /* one request per session, no more */

    /* nothing above this line has touched the network */
    try {
      if (typeof fetch !== "function") return;
      fetch("/api/overrides", { credentials: "omit", cache: "default" })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (j) {
          var items = (j && Object.prototype.toString.call(j.items) === "[object Array]") ? j.items : [];
          remember(items);
          if (items.length) run(items);
        })
        .catch(function () { remember([]); });   /* dark endpoint: quiet for the session */
    } catch (e) {}
  }
})();
