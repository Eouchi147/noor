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

   This file drew its own sheet until 9 September 2026. It does not
   any more: the sheet is the More door in noor-fx.js, which carries
   the map of the house and the search in one place, because the bar
   said Search while the field on the arrival opened something else
   and the map of the forty-two rooms existed only behind a dial on
   one page. What is left here is what was always the value --
   the index and the ranking -- and one way in:

     NOOR_SEARCH.find(term)
       -> Promise<[{ key, name, hits: [{ t, a, s, u }] }]>
       best group first; [] for a term under two letters; never rejects.
   ============================================================ */
(function () {
  "use strict";
  var IDX = null, loading = null;

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
    /* By its plain path, and without force-cache. Both mattered.
       ?v=78 is its own key at the edge, and that key was still holding the
       half-destroyed index -- 523 words, 30 rooms, and none of the 1,183
       entities -- so a hard reload fetched the broken file just as faithfully
       as a warm one. force-cache then told the browser never to ask again.
       Between them, every search on every page was answering out of a copy
       that had lost every prophet, companion, place and surah, and no amount
       of restoring the file on the server could reach it.
       The plain path is one key, and the JSON cache rule on it is
       max-age=0, must-revalidate, which is what we actually want here. */
    loading = fetch("/assets/search-index.json", { cache: "no-cache" })
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

  /* The ranking, without a UI around it. Resolves to
     [{ key, name, hits: [{ t, a, s, u }] }], best group first, [] for a term
     under two letters, and never rejects: a search that cannot answer shows
     the map it was already showing rather than an error. */
  function find(term) {
    var n = fold(term);
    /* load() before the length check, so find("") is how the More sheet warms
       the index while a reader is reading the map: 311 KB fetched during the
       second or two before anyone types, instead of after the first letter.
       Without this the first search on a page answered from an index that was
       still arriving, and the map stayed on the screen underneath the query. */
    var idx = load();
    if (!n || n.length < 2) return Promise.resolve([]);
    return idx.then(function (I) {
      var buckets = {}, best = {};
      for (var i = 0; i < I.all.length; i++) {
        var r = I.all[i], sc = score(r, n);
        if (!sc) continue;
        sc += r.w;                       /* a named prophet beats a passing mention */
        (buckets[r.g] || (buckets[r.g] = [])).push({ s: sc, r: r });
        if (sc > (best[r.g] || 0)) best[r.g] = sc;
      }
      /* the group that answered best comes first: that is the whole point */
      return Object.keys(buckets).sort(function (a, b) {
        if (best[b] !== best[a]) return best[b] - best[a];
        return (I.order[a] || 99) - (I.order[b] || 99);
      }).map(function (g) {
        var list = buckets[g].sort(function (a, b) { return b.s - a.s || a.r.e.t.length - b.r.e.t.length; });
        return { key: g, name: I.names[g] || g,
                 hits: list.map(function (x) { return { t: x.r.e.t, a: x.r.e.a || "", s: x.r.e.s || "", u: x.r.u }; }) };
      });
    }).catch(function () { return []; });
  }

  window.NOOR_SEARCH = { find: find };
})();
