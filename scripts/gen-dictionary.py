#!/usr/bin/env python3
# NOOR · The Encyclopedia of the Path
# Builds /dictionary.html from build/dict-*.json through the room shell.
# A reader who does not know a word must be able to type it, half spelled, in
# any of its transliterations, and land on the meaning in one motion.
import json, os, re, sys, glob, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from room import shell                    # noqa: E402
from _dict_figs import fig_domains, fig_root, fig_isnad, fig_ahkam   # noqa: E402

OUT = os.path.join(ROOT, "dictionary.html")
CATS = [("aqidah", "Belief", "العَقِيدَة"), ("ibadah", "Worship", "العِبَادَة"),
        ("quran", "The Qur’an", "القُرْآن"), ("hadith", "Hadith", "الحَدِيث"),
        ("fiqh", "Law & life", "الفِقْه"), ("tazkiyah", "The heart", "التَّزْكِيَة"),
        ("tarikh", "History", "التَّارِيخ")]
CATNAME = {c: n for c, n, _ in CATS}
LEVELS = {"quran": ("Qur’an", "Stated directly in the Qur’an"),
          "sunnah": ("Sunnah", "Established in the authentic Sunnah"),
          "debated": ("Scholars differ", "The scholars read this one differently"),
          "editorial": ("Editorial", "Our own summary, drawn from the sources named")}


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))


def load():
    out, seen, dropped = [], set(), []
    for f in sorted(glob.glob(os.path.join(ROOT, "build", "dict-*.json"))):
        try:
            data = json.load(open(f, encoding="utf-8"))
        except Exception as e:
            print("  ! skipping %s: %s" % (os.path.basename(f), e))
            continue
        for e in data:
            i = re.sub(r"[^a-z0-9-]", "", str(e.get("id", "")).lower())
            # silence here is how a word disappears from a reference book: a
            # duplicate id used to drop the later entry with no sign of it, and
            # six see-also links then pointed the reader at the wrong meaning.
            if not i:
                dropped.append((os.path.basename(f), e.get("term", "?"), "no usable id")); continue
            if i in seen:
                dropped.append((os.path.basename(f), e.get("term", "?"), "id already taken by " + i)); continue
            if not e.get("term") or not e.get("short"):
                dropped.append((os.path.basename(f), e.get("term", "?"), "missing term or short")); continue
            seen.add(i)
            e["id"] = i
            e["cat"] = e.get("cat") if e.get("cat") in CATNAME else "aqidah"
            e["k"] = e.get("k") if e.get("k") in LEVELS else "editorial"
            e["also"] = [a for a in (e.get("also") or []) if isinstance(a, str)][:14]
            e["see"] = [re.sub(r"[^a-z0-9-]", "", str(s).lower()) for s in (e.get("see") or [])][:8]
            out.append(e)
    out.sort(key=lambda e: (e["term"].lower(), e["id"]))
    # only keep cross references that actually resolve
    ids = {e["id"] for e in out}
    dead = 0
    for e in out:
        keep = [s for s in e["see"] if s in ids and s != e["id"]]
        dead += len(e["see"]) - len(keep)
        e["see"] = keep
    if dropped:
        print("  !! %d entr%s dropped:" % (len(dropped), "y" if len(dropped) == 1 else "ies"))
        for f_, t, why in dropped[:10]:
            print("     %-22s %-26s %s" % (f_, t, why))
    if dead:
        print("  !! %d see-also link%s pointed nowhere and were removed" % (dead, "" if dead == 1 else "s"))
    return out


def build():
    D = load()
    counts = {c: sum(1 for e in D if e["cat"] == c) for c, _, _ in CATS}
    print("dictionary: %d entries · %s" % (len(D), " · ".join("%s %d" % (c, counts[c]) for c, _, _ in CATS)))

    chips = "".join(
        '<button type="button" class="cchip" data-cat="%s"><span>%s</span><i>%d</i></button>'
        % (esc(c), esc(n), counts[c]) for c, n, _ in CATS)

    letters = sorted({(e["term"][0].upper() if e["term"][:1].isalpha() else "#") for e in D})
    rail = "".join('<button type="button" class="lbtn" data-l="%s">%s</button>' % (l, l) for l in letters)

    main = []
    main.append('<div class="wrapw">')
    main.append(fig_domains(counts))

    main.append('<div class="finder" id="finder">'
                '<div class="fin-in">'
                '<label class="fsearch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
                'stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/>'
                '<path d="M20 20l-3.5-3.5"/></svg>'
                '<input id="dq" type="search" autocomplete="off" spellcheck="false" '
                'placeholder="Type a word: qadr, ihram, isnad, riba, taqwa" aria-label="Search the encyclopedia"/>'
                '<button type="button" id="dclear" aria-label="Clear">×</button></label>'
                '<p class="fcount" id="dcount">%d words</p></div>'
                '<div class="cchips" id="cchips">'
                '<button type="button" class="cchip on" data-cat="all"><span>All</span><i>%d</i></button>%s</div>'
                '<div class="lrail" id="lrail">%s</div></div>' % (len(D), len(D), chips, rail))

    main.append('<div class="dlist" id="dlist">')
    cur = None
    for e in D:
        L = e["term"][0].upper() if e["term"][:1].isalpha() else "#"
        if L != cur:
            cur = L
            main.append('<h2 class="dletter" id="L-%s">%s</h2>' % (L, L))
        lvl = LEVELS[e["k"]]
        also = " · ".join(e["also"][:6])
        # A real <a>, not a button. The buttons were fine for a reader and
        # invisible to a crawler, which is how 523 pages came to hang off a hub
        # that never linked to them. The href is the page; data-go keeps the
        # in-page jump for anyone who has the whole book open.
        see = "".join('<a class="seelink" href="/dictionary/%s" data-go="%s">%s</a>' % (esc(s), esc(s), esc(s.replace("-", " ")))
                      for s in e["see"])
        main.append(
            '<article class="dent" id="%s" data-cat="%s" data-term="%s" data-also="%s">'
            '<button type="button" class="dhead" aria-expanded="false">'
            '<span class="dt">%s</span>'
            '<span class="dar notranslate" translate="no">%s</span>'
            '<span class="dcat">%s</span>'
            '<span class="evb %s" title="%s">%s</span>'
            '<span class="dchev" aria-hidden="true"></span></button>'
            '<p class="dshort">%s</p>'
            '<div class="dbody"><div class="dbi"><p class="dlong">%s</p>%s%s'
            '<p class="dpage"><a href="/dictionary/%s">Open %s on its own page &rarr;</a></p></div></div>'
            '</article>'
            % (esc(e["id"]), esc(e["cat"]), esc(e["term"].lower()), esc(" ".join(e["also"]).lower()),
               esc(e["term"]), e.get("ar", ""), esc(CATNAME[e["cat"]]), esc(e["k"]), esc(lvl[1]), esc(lvl[0]),
               esc(e["short"]), esc(e.get("long", "")),
               ('<p class="dalso"><b>also written</b> %s</p>' % esc(also)) if also else "",
               ('<div class="dsee"><b>see also</b>%s</div>' % see) if see else "",
               esc(e["id"]), esc(e["term"])))
    main.append('</div>')
    main.append('<p class="dnone" id="dnone" hidden>Nothing under that spelling yet. Try fewer letters, or the '
                'plain English word: this dictionary indexes every transliteration it knows, and it is still growing. '
                '<a href="/feedback">Tell us what was missing</a> and it will be added.</p>')

    main.append('<section class="plates"><h2 class="ph">How to read this book</h2>'
                '<p class="ps">Three plates that make the rest of the encyclopedia easier to use.</p>')
    main.append(fig_root())
    main.append(fig_isnad())
    main.append(fig_ahkam())
    main.append('</section>')

    main.append('<section class="wgo"><h2>Where to go from here</h2>'
                '<p class="wgo-s">Every word here has a room behind it.</p><div class="wgo-g" data-mo-stagger>'
                '<a class="wgo-c mo" href="/quran"><b>The Mushaf</b><span>The Qur’an itself, with recitation for every ayah.</span></a>'
                '<a class="wgo-c mo" href="/madrasa"><b>The Classroom</b><span>The words in order, as a course rather than a list.</span></a>'
                '<a class="wgo-c mo" href="/protection"><b>Protection &amp; the Light of Truth</b><span>Sihr, ruqya, the evil eye, and the myths around them.</span></a>'
                '<a class="wgo-c mo" href="/arabic"><b>Learn Arabic</b><span>The letters, so the roots in this book start to open on their own.</span></a>'
                '</div></section>')
    main.append('</div>')

    data = [{"i": e["id"], "t": e["term"], "a": e.get("ar", ""), "l": e["also"],
             "c": e["cat"], "s": e["short"]} for e in D]
    payload = ('<script id="dict-data" type="application/json">%s</script>'
               % json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"))

    jsonld = ('<script type="application/ld+json">' + json.dumps({
        "@context": "https://schema.org", "@type": "DefinedTermSet",
        "name": "The Encyclopedia of the Path",
        "description": "A dictionary of Islamic terms and concepts, each one defined in plain language with its evidence named.",
        "url": "https://noorcodex.com/dictionary",
        "hasDefinedTerm": [{"@type": "DefinedTerm", "name": e["term"], "description": e["short"]} for e in D[:60]],
    }, ensure_ascii=False) + "</script>")

    html = shell(slug="dictionary", title="The Encyclopedia of the Path",
                 desc=("A free encyclopedia of Islamic terms: %d words defined in plain language, each with its "
                       "Arabic, its alternate spellings, its evidence named, and the room that covers it. Search "
                       "any spelling." % len(D)),
                 ar="المُعْجَم", kick="A Room of the Codex",
                 h1="The Encyclopedia of the Path",
                 lead=("Every word this library uses, defined plainly. Type any spelling you have seen, in any "
                       "transliteration, and the meaning arrives with its evidence beside it. %d words, and it "
                       "grows whenever a reader tells us one was missing." % len(D)),
                 css=CSS, main="".join(main), jsonld=jsonld, extra_js=payload + JS,
                 footline="Free forever, and it will never sell you a definition.")
    open(OUT, "w", encoding="utf-8").write(html)
    print("dictionary.html written · %d KB · %d entries · 4 plates" % (len(html) / 1024, len(D)))
    n = build_pages(D)
    print("dictionary/ written · %d word pages" % n)
    r = retire_root_pages(D)
    if r: print("root · %d old word page%s removed" % (r, "" if r == 1 else "s"))
    return D


CSS = """
.wrapw{max-width:60rem;margin:0 auto;padding:0 1rem}
.fig{background:linear-gradient(170deg,#14100A,#1b2440);border:1px solid rgba(244,212,106,.22);border-radius:18px;padding:1.1rem;margin:1.4rem 0}
.fig svg{width:100%;max-width:32rem;height:auto;display:block;margin:0 auto}
.fig.figwide svg{max-width:38rem}
.fig svg text{font-family:Inter,system-ui,sans-serif}
.fig .cap{font-size:.74rem;color:rgba(255,254,247,.62);text-align:center;margin:.8rem 0 0;line-height:1.7}
.fig .cap b{color:rgba(244,212,106,.85)}
.fg{fill:#F4D46A;font-size:22px;font-weight:800}
.fgar{fill:#F4D46A;font-size:26px;font-weight:700;font-family:Amiri,serif}
.fl{fill:#FFFEF7;fill-opacity:.85;font-size:15px;font-weight:700}
.fs{fill:#FFFEF7;fill-opacity:.5;font-size:12.5px;font-weight:500}
.s1{fill:none;stroke:#E9C86A;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.s2{fill:none;stroke:#FFFEF7;stroke-opacity:.55;stroke-width:2;stroke-linecap:round}
.s3{fill:none;stroke:#F4D46A;stroke-opacity:.32;stroke-width:1.6;stroke-linecap:round}
.f1{fill:#F4D46A;fill-opacity:.16}
.f2{fill:#F4D46A;fill-opacity:.85}
.w0{fill:rgba(244,212,106,.85);stroke:#14100A;stroke-width:1.5}
.w1{fill:rgba(244,212,106,.55);stroke:#14100A;stroke-width:1.5}
.w2{fill:rgba(255,254,247,.42);stroke:#14100A;stroke-width:1.5}
.w3{fill:rgba(244,212,106,.3);stroke:#14100A;stroke-width:1.5}
.leg{list-style:none;margin:1rem 0 0;padding:0;display:grid;gap:.45rem}
.leg li{position:relative;padding-inline-start:1rem;font-size:.76rem;line-height:1.7;color:rgba(255,254,247,.66)}
.leg li::before{content:"";position:absolute;inset-inline-start:0;top:.62rem;width:.36rem;height:.36rem;border-radius:50%;background:#E9C86A}

/* ---------- the finder: one motion from not knowing to knowing ---------- */
.finder{position:sticky;top:3.5rem;z-index:32;background:rgba(255,254,247,.94);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);margin:1.4rem -1rem 0;padding:.7rem 1rem .55rem;border-bottom:1px solid rgba(44,36,22,.09)}
.fin-in{display:flex;align-items:center;gap:.7rem;max-width:60rem;margin:0 auto}
.fsearch{flex:1 1 auto;display:flex;align-items:center;gap:.55rem;background:#fff;border:1px solid rgba(44,36,22,.16);border-radius:999px;padding:.5rem .85rem;transition:border-color .2s,box-shadow .2s}
.fsearch:focus-within{border-color:rgba(201,162,39,.8);box-shadow:0 0 0 4px rgba(201,162,39,.14)}
.fsearch svg{width:1rem;height:1rem;color:rgba(44,36,22,.4);flex:none}
.fsearch input{flex:1;border:0;outline:0;font:inherit;font-size:.92rem;color:#2C2416;background:none;min-width:0}
.fsearch input::placeholder{color:rgba(44,36,22,.36)}
.fsearch input::-webkit-search-cancel-button{display:none}
#dclear{border:0;background:none;font:inherit;font-size:1.2rem;line-height:1;color:rgba(44,36,22,.35);cursor:pointer;padding:0 .1rem;opacity:0;pointer-events:none;transition:opacity .2s}
#dclear.on{opacity:1;pointer-events:auto}
#dclear:hover{color:#2C2416}
.fcount{flex:0 0 auto;font-size:.7rem;font-weight:700;color:rgba(44,36,22,.45);margin:0;white-space:nowrap;font-variant-numeric:tabular-nums}
.cchips{display:flex;gap:.35rem;overflow-x:auto;scrollbar-width:none;margin-top:.55rem;padding-bottom:.1rem}
.cchips::-webkit-scrollbar{display:none}
.cchip{flex:0 0 auto;display:inline-flex;align-items:center;gap:.35rem;border:1px solid rgba(44,36,22,.14);background:#fff;border-radius:999px;padding:.3rem .68rem;font:inherit;font-size:.72rem;font-weight:700;color:rgba(44,36,22,.6);cursor:pointer;transition:all .18s}
.cchip i{font-style:normal;font-size:.62rem;font-weight:800;color:rgba(44,36,22,.35);font-variant-numeric:tabular-nums}
.cchip:hover{border-color:rgba(201,162,39,.55);color:#2C2416}
.cchip.on{background:linear-gradient(135deg,#C9A227,#E9C86A);border-color:transparent;color:#1A160F;box-shadow:0 2px 12px rgba(201,162,39,.3)}
.cchip.on i{color:rgba(26,22,15,.55)}
.lrail{display:flex;gap:.12rem;overflow-x:auto;scrollbar-width:none;margin-top:.45rem}
.lrail::-webkit-scrollbar{display:none}
.lbtn{flex:0 0 auto;border:0;background:none;font:inherit;font-size:.7rem;font-weight:800;color:rgba(44,36,22,.4);cursor:pointer;padding:.18rem .38rem;border-radius:6px;transition:color .15s,background .15s}
.lbtn:hover{color:#2C2416;background:rgba(201,162,39,.14)}
.lbtn[hidden]{display:none}

/* ---------- the entries ---------- */
.dlist{margin-top:1.3rem}
.dletter{font-family:Amiri,serif;font-size:1.5rem;font-weight:700;color:#C9A227;margin:1.7rem 0 .5rem;padding-bottom:.3rem;border-bottom:1px solid rgba(201,162,39,.28);scroll-margin-top:11rem}
.dent{background:#fff;border:1px solid rgba(44,36,22,.11);border-radius:16px;margin-top:.5rem;overflow:hidden;transition:border-color .2s,box-shadow .2s;content-visibility:auto;contain-intrinsic-size:auto 118px;scroll-margin-top:11.5rem}
.dent:hover{border-color:rgba(201,162,39,.5)}
.dent.open{border-color:rgba(201,162,39,.65);box-shadow:0 6px 26px rgba(44,36,22,.08)}
.dent.hit{border-color:rgba(201,162,39,.9);box-shadow:0 0 0 3px rgba(201,162,39,.18)}
.dhead{width:100%;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;background:none;border:0;font:inherit;text-align:start;padding:.8rem .95rem .2rem;cursor:pointer}
.dt{font-size:1rem;font-weight:800;color:#2C2416;letter-spacing:-.01em}
.dar{font-family:Amiri,serif;font-size:1.15rem;color:#8a6d13;line-height:1.4}
.dcat{font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;font-weight:800;color:rgba(44,36,22,.4);border:1px solid rgba(44,36,22,.13);border-radius:999px;padding:.16rem .48rem}
.dchev{margin-inline-start:auto;width:.5rem;height:.5rem;border-inline-end:2px solid rgba(44,36,22,.3);border-bottom:2px solid rgba(44,36,22,.3);transform:rotate(45deg);transition:transform .28s cubic-bezier(.22,1,.36,1);flex:none}
.dent.open .dchev{transform:rotate(-135deg)}
.dshort{font-size:.86rem;line-height:1.8;color:rgba(44,36,22,.8);margin:0;padding:0 .95rem .85rem}
.dbody{height:0;overflow:hidden}
.dbi{padding:0 .95rem 1rem;border-top:1px solid rgba(44,36,22,.07);margin-top:.1rem}
.dlong{font-size:.85rem;line-height:1.85;color:rgba(44,36,22,.78);margin:.75rem 0 0}
.dalso{font-size:.75rem;line-height:1.7;color:rgba(44,36,22,.5);margin:.6rem 0 0}
.dalso b,.dsee b{font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;color:#8a6d13;margin-inline-end:.4rem}
.dsee{margin-top:.6rem;display:flex;align-items:center;gap:.3rem;flex-wrap:wrap}
.seelink{border:1px solid rgba(201,162,39,.35);background:rgba(201,162,39,.09);color:#8a6d13;border-radius:999px;padding:.2rem .55rem;font:inherit;font-size:.72rem;font-weight:700;cursor:pointer;transition:background .16s}
.seelink:hover{background:rgba(201,162,39,.22)}
.evb{display:inline-flex;align-items:center;gap:.3rem;font-size:.56rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:.2rem .48rem;border:1px solid}
.evb.quran{color:#1d6b3f;border-color:rgba(29,107,63,.5);background:rgba(29,107,63,.11)}
.evb.sunnah{color:#8a6d13;border-color:rgba(201,162,39,.5);background:rgba(201,162,39,.13)}
.evb.debated{color:#6b4f92;border-color:rgba(107,79,146,.5);background:rgba(107,79,146,.1)}
.evb.editorial{color:rgba(44,36,22,.55);border-color:rgba(44,36,22,.24);background:rgba(44,36,22,.04)}
.dent[hidden]{display:none}
.dpage{margin:.7rem 0 0;font-size:.78rem}.dpage a{font-weight:800;color:#8a6d13;text-decoration:none}.dpage a:hover{text-decoration:underline}
a.seelink{display:inline-block;text-decoration:none}
.dletter[hidden]{display:none}
.dnone{font-size:.88rem;line-height:1.85;color:rgba(44,36,22,.6);background:#fff;border:1px dashed rgba(201,162,39,.45);border-radius:16px;padding:1.1rem 1.15rem;margin-top:1.2rem}
.dnone a{color:#8a6d13;font-weight:700}
.plates{margin-top:3rem;padding-top:1.6rem;border-top:1px solid rgba(44,36,22,.12)}
.ph{font-size:1.15rem;font-weight:800;margin:0;color:#2C2416}
.ps{font-size:.82rem;line-height:1.8;color:rgba(44,36,22,.6);margin:.3rem 0 0}
.wgo{max-width:60rem;margin:2.9rem auto 0;padding:1.75rem 0 .4rem;border-top:1px solid rgba(44,36,22,.12)}
.wgo>h2{font-size:1.06rem;font-weight:800;margin:0;color:#2C2416}
.wgo>.wgo-s{font-size:.8rem;line-height:1.8;color:rgba(44,36,22,.6);margin:.35rem 0 0}
.wgo-g{display:grid;grid-template-columns:1fr;gap:.65rem;margin-top:1.05rem}
@media(min-width:38rem){.wgo-g{grid-template-columns:1fr 1fr}}
.wgo-c{display:block;text-decoration:none;background:#fff;border:1px solid rgba(44,36,22,.12);border-radius:16px;padding:.85rem .95rem;transition:border-color .18s,transform .18s,box-shadow .18s}
.wgo-c:hover{border-color:rgba(201,162,39,.7);transform:translateY(-1px);box-shadow:0 5px 18px rgba(44,36,22,.07)}
.wgo-c b{display:block;font-size:.9rem;font-weight:800;color:#2C2416}
.wgo-c b::after{content:" \\2192";color:#C9A227}
.wgo-c span{display:block;font-size:.8rem;line-height:1.8;color:rgba(44,36,22,.68);margin-top:.28rem}
@media (max-width:560px){.fin-in{gap:.5rem}.fcount{display:none}}
@media print{.finder,.lrail,.cchips,.wgo{display:none!important}.dbody{height:auto!important}.dent{break-inside:avoid}}
"""

JS = """<script>
(function(){
  "use strict";
  var raw = document.getElementById("dict-data");
  var D = []; try { D = JSON.parse(raw.textContent); } catch(e){}
  var list = document.getElementById("dlist");
  var q = document.getElementById("dq"), clear = document.getElementById("dclear");
  var count = document.getElementById("dcount"), none = document.getElementById("dnone");
  var ents = {}, order = [];
  [].forEach.call(list.querySelectorAll(".dent"), function(el){ ents[el.id] = el; order.push(el); });

  /* fold every spelling a reader might use down to the same shape:
     no case, no apostrophes, no diacritics, no dashes. "Qadhar" == "qadar". */
  function fold(s){
    return (s||"").toLowerCase()
      .normalize("NFD").replace(/[\\u0300-\\u036f]/g,"")
      .replace(/['\\u2019\\u02bb\\u02bc`]/g,"")
      .replace(/[^a-z0-9\\u0600-\\u06ff ]+/g," ")
      .replace(/\\s+/g," ").trim();
  }
  var IDX = D.map(function(e){
    return { i:e.i, t:fold(e.t), a:e.a||"", l:(e.l||[]).map(fold), c:e.c, s:fold(e.s) };
  });

  function score(rec, needle){
    if (rec.t === needle) return 100;
    if (rec.l.indexOf(needle) >= 0) return 92;
    if (rec.t.indexOf(needle) === 0) return 80;
    for (var i=0;i<rec.l.length;i++) if (rec.l[i].indexOf(needle) === 0) return 72;
    if (rec.a && rec.a.indexOf(needle) >= 0) return 70;
    if (rec.t.indexOf(needle) >= 0) return 55;
    for (var j=0;j<rec.l.length;j++) if (rec.l[j].indexOf(needle) >= 0) return 48;
    if ((" "+rec.s).indexOf(" "+needle) >= 0) return 30;
    if (rec.s.indexOf(needle) >= 0) return 14;
    return 0;
  }

  var cat = "all", term = "", raf = 0;
  function run(){
    raf = 0;
    var needle = fold(term), n = 0, best = null, bestScore = 0;
    for (var i=0;i<IDX.length;i++){
      var rec = IDX[i], el = ents[rec.i];
      if (!el) continue;
      var ok = (cat === "all" || rec.c === cat);
      if (ok && needle) { var s = score(rec, needle); ok = s > 0;
        if (s > bestScore) { bestScore = s; best = el; } }
      el.hidden = !ok;
      el.classList.remove("hit");
      if (ok) n++;
    }
    /* a letter heading with nothing under it is noise */
    var heads = list.querySelectorAll(".dletter");
    for (var h=0; h<heads.length; h++){
      var el2 = heads[h].nextElementSibling, any = false;
      while (el2 && !el2.classList.contains("dletter")){
        if (el2.classList.contains("dent") && !el2.hidden) { any = true; break; }
        el2 = el2.nextElementSibling;
      }
      heads[h].hidden = !any;
    }
    count.textContent = n === D.length ? (D.length + " words") : (n + (n === 1 ? " word" : " words"));
    none.hidden = n > 0;
    clear.classList.toggle("on", !!term);
    if (needle && best && bestScore >= 72) best.classList.add("hit");
    syncRail();
  }
  function queue(){ if (!raf) raf = requestAnimationFrame(run); }

  function syncRail(){
    var have = {};
    [].forEach.call(list.querySelectorAll(".dletter"), function(h){ if(!h.hidden) have[h.textContent.trim()] = 1; });
    [].forEach.call(document.querySelectorAll(".lbtn"), function(b){ b.hidden = !have[b.dataset.l]; });
  }

  q.addEventListener("input", function(){ term = q.value; queue(); });
  clear.addEventListener("click", function(){ q.value = ""; term = ""; q.focus(); run(); });
  document.getElementById("cchips").addEventListener("click", function(e){
    var b = e.target.closest(".cchip"); if (!b) return;
    [].forEach.call(this.querySelectorAll(".cchip"), function(x){ x.classList.toggle("on", x === b); });
    cat = b.dataset.cat; run();
  });
  document.getElementById("lrail").addEventListener("click", function(e){
    var b = e.target.closest(".lbtn"); if (!b) return;
    var h = document.getElementById("L-" + b.dataset.l);
    if (h) h.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* expand and collapse, measured rather than guessed, so it never jumps */
  var G = window.gsap;
  function toggle(el, force){
    var open = force === undefined ? !el.classList.contains("open") : force;
    var body = el.querySelector(".dbody"), inner = el.querySelector(".dbi");
    el.classList.toggle("open", open);
    el.querySelector(".dhead").setAttribute("aria-expanded", open ? "true" : "false");
    var h = inner.getBoundingClientRect().height;
    if (G) {
      G.killTweensOf(body);
      G.fromTo(body, { height: open ? 0 : h }, { height: open ? h : 0, duration: .42,
        ease: open ? "power3.out" : "power2.inOut",
        onComplete: function(){ if (open) body.style.height = "auto"; } });
    } else { body.style.height = open ? "auto" : "0px"; }
  }
  list.addEventListener("click", function(e){
    var go = e.target.closest(".seelink");
    /* a see-also is a real link now, for the crawler; for a reader with the
       whole book open, the in-page jump is still the better thing */
    if (go) { e.preventDefault(); open(go.dataset.go); return; }
    var head = e.target.closest(".dhead");
    if (head) toggle(head.parentNode);
  });

  function open(id){
    var el = ents[id]; if (!el) return;
    if (el.hidden) { cat = "all"; term = ""; q.value = ""; run(); }
    if (!el.classList.contains("open")) toggle(el, true);
    [].forEach.call(list.querySelectorAll(".dent.hit"), function(x){ x.classList.remove("hit"); });
    el.classList.add("hit");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    history.replaceState(null, "", "#" + id);
  }
  window.NOOR_DICT = { open: open, size: D.length };

  /* arriving from a link, or from the search on any other page.
     ?w=id is read as a fallback spelling of #id: a social caption mangles a
     fragment into a hashtag, so the daily word post links with a query
     instead, and both spellings land on the same entry. */
  function fromHash(){
    var h = (location.hash || "").replace(/^#/, "");
    if (!h) { try { h = new URLSearchParams(location.search).get("w") || ""; } catch (e) {} }
    if (!h) return;
    if (ents[h]) { setTimeout(function(){ open(h); }, 120); return; }
    var pre = h.match(/^q=(.*)$/);           /* /dictionary#q=qadr */
    if (pre) { q.value = decodeURIComponent(pre[1]); term = q.value; run();
               setTimeout(function(){ var b = list.querySelector(".dent.hit"); if (b) b.scrollIntoView({behavior:"smooth",block:"center"}); }, 160); }
  }
  addEventListener("hashchange", fromHash);
  fromHash();

  /* the keyboard, for people who live on it */
  addEventListener("keydown", function(e){
    if (e.key === "/" && document.activeElement !== q) { e.preventDefault(); q.focus(); q.select(); }
    else if (e.key === "Escape" && document.activeElement === q) { q.value=""; term=""; run(); q.blur(); }
    else if (e.key === "Enter" && document.activeElement === q) {
      var b = list.querySelector(".dent.hit") || list.querySelector(".dent:not([hidden])");
      if (b) { if (!b.classList.contains("open")) toggle(b, true); b.scrollIntoView({behavior:"smooth",block:"center"}); }
    }
  });
})();
</script>"""




# ---------------------------------------------------------------------------
# ONE PAGE PER WORD, UNDER /dictionary/
#
# These used to sit at the root -- /iman, /fiqh, /mudal -- each carrying a
# canonical that pointed at /dictionary/<word>, an address that did not exist.
# The sitemap listed the same 523 non-existent addresses. Two of the words,
# hajj and quran, had the same name as a room, and the room won: those two
# had no page at all. And nothing linked to any of them except each other.
#
# So: they live here now, where their canonical always said they did; they are
# richer than the hub's entry for the same word, so a crawler has a reason to
# keep both; the hub links to every one; and each links to its neighbours and
# to the rest of its domain, so the encyclopedia is a web and not a well.
# ---------------------------------------------------------------------------
PAGE_DIR = os.path.join(ROOT, "dictionary")

PAGE_CSS = """
:root{--ink:#2C2416;--gold:#C9A227;--hi:#F4D46A}
*{box-sizing:border-box}
body{margin:0;background:#FFFEF7;color:var(--ink);font-family:Inter,system-ui,sans-serif;line-height:1.85}
a{color:#8a6d13}
.top{display:flex;align-items:center;gap:.6rem;padding:.8rem 1rem;border-bottom:1px solid rgba(44,36,22,.08);font-size:.8rem}
.top .mark{width:1.9rem;height:1.9rem;border-radius:999px;background:#14100A;color:var(--hi);display:flex;align-items:center;justify-content:center;font-family:Amiri,serif;text-decoration:none;font-size:1rem}
.top .home{font-weight:800;color:var(--ink);text-decoration:none}
.top .enc{margin-inline-start:auto;text-decoration:none;font-weight:700}
main{max-width:42rem;margin:0 auto;padding:2.2rem 1.1rem 3rem}
.crumb{font-size:.72rem;color:rgba(44,36,22,.55);margin:0 0 .9rem}.crumb a{text-decoration:none;font-weight:700}
.kick{font-size:.6rem;letter-spacing:.22em;text-transform:uppercase;color:#8a6d13;font-weight:800;margin:0}
h1{font-size:2rem;font-weight:800;letter-spacing:-.01em;margin:.3rem 0 0;display:flex;align-items:baseline;gap:.8rem;flex-wrap:wrap}
h1 .ar{font-family:Amiri,serif;font-weight:400;font-size:1.9rem;color:var(--gold)}
.badge{display:inline-block;font-size:.6rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;border:1px solid #6b6257;color:#6b6257;border-radius:999px;padding:.24rem .6rem;margin-top:.8rem}
.lede{font-size:1.02rem;font-weight:600;margin:1rem 0 0}
h2{font-size:.95rem;font-weight:800;margin:1.8rem 0 .4rem}
p{font-size:.9rem;margin:.4rem 0;color:rgba(44,36,22,.85)}
.alt{font-size:.78rem;color:rgba(44,36,22,.55);line-height:2}
.see{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.5rem}
.see a{font-size:.76rem;font-weight:700;text-decoration:none;border:1px solid rgba(44,36,22,.15);border-radius:999px;padding:.34rem .75rem;color:var(--ink);background:#fff}
.see a:hover{border-color:var(--gold)}
.see a .a{font-family:Amiri,serif;color:var(--gold);margin-inline-start:.35rem;font-weight:400}
.deep{margin-top:2rem;background:linear-gradient(170deg,#14100A,#1b2440);border-radius:16px;padding:1.1rem 1.2rem;color:#FFFEF7}
.deep p{color:rgba(255,254,247,.75);font-size:.82rem;margin:0 0 .7rem}
.deep a{color:var(--hi);font-weight:800;text-decoration:none}
footer{max-width:42rem;margin:0 auto;padding:0 1.1rem 2.4rem;font-size:.7rem;color:rgba(44,36,22,.45)}
"""


def build_pages(D):
    os.makedirs(PAGE_DIR, exist_ok=True)
    by_id = {e["id"]: e for e in D}
    by_cat = {}
    for e in D:
        by_cat.setdefault(e["cat"], []).append(e)
    n = 0
    for e in D:
        term, ar = e["term"], e.get("ar", "")
        short, long_ = e["short"], e.get("long", "")
        lvl = LEVELS[e["k"]]
        url = "https://noorcodex.com/dictionary/" + e["id"]
        # the neighbours the editors named, then six more from the same domain
        see = [by_id[s] for s in e["see"] if s in by_id]
        seen = {e["id"]} | {x["id"] for x in see}
        sib = [x for x in by_cat[e["cat"]] if x["id"] not in seen]
        # deterministic, spread across the domain rather than alphabetical neighbours
        step = max(1, len(sib) // 6) if sib else 1
        sib = [sib[(i * step) % len(sib)] for i in range(min(6, len(sib)))] if sib else []
        chip = lambda x: '<a href="/dictionary/%s">%s%s</a>' % (esc(x["id"]), esc(x["term"]),
               ('<span class="a" translate="no">%s</span>' % x["ar"]) if x.get("ar") else "")
        ld = {"@context": "https://schema.org", "@graph": [
            {"@type": "DefinedTerm", "@id": url + "#term", "name": term,
             "alternateName": e["also"][:8], "description": short, "url": url,
             "inDefinedTermSet": {"@type": "DefinedTermSet", "name": "NOOR Codex · The Words of the Path",
                                  "url": "https://noorcodex.com/dictionary"}},
            {"@type": "WebPage", "@id": url, "url": url, "name": "%s · meaning in Islam" % term,
             "description": short, "inLanguage": "en", "isPartOf": {"@id": "https://noorcodex.com/#site"},
             "breadcrumb": {"@type": "BreadcrumbList", "itemListElement": [
                 {"@type": "ListItem", "position": 1, "name": "NOOR", "item": "https://noorcodex.com/"},
                 {"@type": "ListItem", "position": 2, "name": "The Encyclopedia of the Path", "item": "https://noorcodex.com/dictionary"},
                 {"@type": "ListItem", "position": 3, "name": term, "item": url}]}}]}
        html = (
            '<!DOCTYPE html>\n<html lang="en" dir="ltr">\n<head>\n<meta charset="UTF-8"/>\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>\n'
            '<title>%s · meaning in Islam · NOOR Codex of Light</title>\n'
            '<meta name="description" content="%s"/>\n'
            '<link rel="canonical" href="%s"/>\n'
            '<meta property="og:title" content="%s · meaning in Islam"/>\n'
            '<meta property="og:description" content="%s"/>\n'
            '<meta property="og:image" content="https://noorcodex.com/assets/brand/og.png"/>\n'
            '<meta property="og:url" content="%s"/>\n'
            '<meta name="theme-color" content="#14100A"/>\n'
            '<link rel="icon" type="image/svg+xml" href="/assets/brand/mark.svg"/>\n'
            '<link rel="preconnect" href="https://fonts.googleapis.com"/>\n'
            '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>\n'
            '<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet"/>\n'
            '<script type="application/ld+json">%s</script>\n'
            '<style>%s</style>\n'
            '<script src="/noor-fx.js" defer></script>\n'
            '</head>\n<body>\n'
            '<nav class="top">\n<a class="mark" href="/" aria-label="NOOR Codex of Light">ن</a>\n'
            '<a class="home" href="/">NOOR Codex of Light</a>\n'
            '<a class="enc" href="/dictionary">The Encyclopedia &rarr;</a>\n</nav>\n'
            '<main>\n'
            '<p class="crumb"><a href="/">NOOR</a> &rsaquo; <a href="/dictionary">The Encyclopedia of the Path</a> &rsaquo; <a href="/dictionary#cat-%s">%s</a></p>\n'
            '<p class="kick">A word of the Path</p>\n'
            '<h1>%s <span class="ar" translate="no">%s</span></h1>\n'
            '<span class="badge" title="%s">%s</span>\n'
            '<p class="lede">%s</p>\n'
            '<h2>What does %s mean in Islam?</h2>\n<p>%s</p>\n'
            '%s'
            '%s'
            '%s'
            '<div class="deep">\n<p>This entry lives inside a free encyclopedia of %d words of the Path, each with its meaning, its Arabic, its evidence, and its neighbours. No ads, no account, no tracking.</p>\n'
            '<a href="/dictionary#%s">Open %s in the full encyclopedia &rarr;</a>\n</div>\n'
            '</main>\n'
            '<footer>NOOR Codex of Light · free forever, no ads, no trackers · <a href="/">noorcodex.com</a></footer>\n'
            '</body>\n</html>\n'
        ) % (
            esc(term), esc(short), url, esc(term), esc(short), url,
            json.dumps(ld, ensure_ascii=False), PAGE_CSS,
            esc(e["cat"]), esc(CATNAME[e["cat"]]),
            esc(term), ar, esc(lvl[1]), esc(lvl[0]), esc(short),
            esc(term), esc(long_) if long_ else esc(short),
            ('<h2>Also written</h2><p class="alt">%s</p>\n' % esc(" · ".join(e["also"]))) if e["also"] else "",
            ('<h2>Words that sit beside it</h2><div class="see">%s</div>\n' % "".join(chip(x) for x in see)) if see else "",
            ('<h2>More from %s</h2><div class="see">%s</div>\n' % (esc(CATNAME[e["cat"]]), "".join(chip(x) for x in sib))) if sib else "",
            len(D), esc(e["id"]), esc(term))
        open(os.path.join(PAGE_DIR, e["id"] + ".html"), "w", encoding="utf-8").write(html)
        n += 1
    return n


def retire_root_pages(D):
    """Remove the word pages that used to sit at the site root.

    Guarded twice. A file is removed only if it is named for a dictionary id
    AND its own canonical says it belongs under /dictionary/ -- so hajj.html
    and quran.html, which are rooms that happen to share a word's name, are
    never touched, and neither is anything else that merely shares a slug.
    """
    n = 0
    for e in D:
        f = os.path.join(ROOT, e["id"] + ".html")
        if not os.path.exists(f):
            continue
        try:
            head = open(f, encoding="utf-8", errors="ignore").read(4000)
        except Exception:
            continue
        if 'rel="canonical" href="https://noorcodex.com/dictionary/%s"' % e["id"] not in head:
            continue
        os.remove(f)
        n += 1
    return n


def build_search_index(D):
    """One small index the magnifier can load on any page: every word of the
       encyclopedia, every room, and the stations of the Path."""
    import glob as _g
    rooms = [
        ("/quran", "The Mushaf", "Study the Qur’an, with recitation for every ayah"),
        ("/prophets", "The 25 Prophets", "Every prophet named in the Qur’an"),
        ("/hajj", "Hajj & Umrah", "The rites, step by step, with their evidence"),
        ("/hajj-plan", "Your Pilgrim Plan", "A plan written from your own answers"),
        ("/madrasa", "The Classroom", "The whole curriculum, in order"),
        ("/school", "The School", "The full course for schools and organisations"),
        ("/kids", "The Kids’ Codex", "The Greatest Game, for children"),
        ("/kids/lanterns", "The Lantern Sky", "Light the whole day with prayer"),
        ("/dictionary", "The Encyclopedia of the Path", "Every word this library uses, defined"),
        ("/protection", "Protection & the Light of Truth", "Sihr, ruqya, the evil eye, and the myths"),
        ("/health", "Prophetic Health", "The body, the plate, the fast, and hijama"),
        ("/family", "The Family Room", "Marriage, children, parents, neighbours"),
        ("/heroes", "Heroes of Islam", "The people who carried it"),
        ("/unseen", "The Unseen & the Mysteries", "Angels, jinn, the barzakh"),
        ("/soul", "The Journey of the Soul", "What happens after the last breath"),
        ("/pillars", "The Five Pillars", "Shahadah, salah, zakat, sawm, hajj"),
        ("/ramadan", "Ramadan", "The month, and the tools for it"),
        ("/eid", "The Two Eids", "Fitr and Adha"),
        ("/stories", "The Hall of Stories", "The names of Allah, told as stories"),
        ("/arabic", "Learn Arabic", "The letters, and how to read them"),
        ("/words", "The Words of the Path", "The du’as worth carrying"),
        ("/theology", "Theology", "The branches, and where they part"),
        ("/companions", "The Companions", "Those who saw him ﷺ"),
        ("/characters", "Characters", "Everyone the Codex names"),
        ("/places", "Places", "Where it happened"),
        ("/begin", "Begin", "For anyone new to Islam"),
        ("/masjid", "The Masjid Toolbox", "Boards, timetables and printables"),
        ("/sermon", "The Last Sermon", "The final khutbah, line by line"),
        ("/donate", "Give a Gift", "Keep the lamp lit"),
        ("/feedback", "Corrections & Ideas", "Tell us what is missing"),
    ]
    idx = {
        "w": [{"i": e["id"], "t": e["term"], "a": e.get("ar", ""),
               "l": e["also"][:8], "s": e["short"]} for e in D],
        "r": [{"u": u, "t": t, "s": s} for u, t, s in rooms],
    }
    p = os.path.join(ROOT, "assets", "search-index.json")
    json.dump(idx, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("search-index.json written · %d words · %d rooms · %d KB"
          % (len(idx["w"]), len(idx["r"]), os.path.getsize(p) / 1024))


if __name__ == "__main__":
    build_search_index(build())
