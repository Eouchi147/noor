/* NOOR service worker · the lamp that works offline.
   Pages: network first, cached copy when the road is dark.
   Assets: cached first, refreshed quietly behind the scenes.
   APIs and other origins are never intercepted. */
var V = "noor-v36";
var CORE = [
  "/", "/quran", "/prophets", "/arabic", "/pillars", "/school", "/madrasa", "/kids", "/begin", "/donate",
  "/assets/tw.css?v=16", "/noor-fx.js", "/noor-ink.js", "/markets.js", "/sponsor.js", "/prophets-data.js", "/madrasa-data.js",
  "/assets/brand/mark.svg", "/assets/brand/mark-192.png", "/assets/brand/mark-512.png",
  "/manifest.webmanifest"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(V).then(function (c) {
      /* best-effort precache: one missing file must not break install */
      return Promise.all(CORE.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;          /* fonts, audio, Stripe: straight through */
  if (url.pathname.indexOf("/api/") === 0) return;     /* live endpoints: never cached here */

  var isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") !== -1;
  if (isHTML) {
    /* pages: fresh when possible, remembered when not */
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(V).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || caches.match("/"); });
      })
    );
    return;
  }
  /* static assets: instant from cache, quietly refreshed */
  e.respondWith(
    caches.match(req).then(function (hit) {
      var refresh = fetch(req).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(V).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () { return hit; });
      return hit || refresh;
    })
  );
});
