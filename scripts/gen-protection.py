#!/usr/bin/env python3
# NOOR · Protection & the Light of Truth
# Builds /protection.html from build/protection.json through the canonical room
# shell. The shell (room.py) supplies head, menu, ink hero and footer; this file
# supplies the room: its CSS, its <main>, its eight figures, its script.
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from room import shell                      # noqa: E402
from _protection_figs import FIGURES        # noqa: E402

SRC = os.path.join(ROOT, "build", "protection.json")
OUT = os.path.join(ROOT, "protection.html")

LEVELS = {
    "quran": ("Qur’an", "Stated directly in the Qur’an"),
    "sunnah": ("Sunnah", "Established in the authentic Sunnah"),
    "debated": ("Scholars differ", "The scholars read this one differently"),
    "editorial": ("Editorial", "Our own counsel, drawn from the sources named"),
}
# which figure closes which section
SEC_FIG = {"ground": ["permission"], "fortress": ["day", "shield"], "ruqya": ["ruqya"],
           "myths": ["rooms"], "week": ["days"], "heart": ["heart", "week"]}


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def badge(k):
    name, why = LEVELS.get(k, LEVELS["editorial"])
    return '<span class="evb %s mo-pop" title="%s">%s</span>' % (esc(k), esc(why), esc(name))


def refs(rs):
    if not rs:
        return ""
    out = []
    for r in rs:
        k = r.get("k", "editorial")
        cls = "ref q" if k == "quran" else "ref"
        body = "<b>%s</b>" % esc(r.get("r", ""))
        if r.get("note"):
            body += ' <span class="rn">%s</span>' % esc(r["note"])
        out.append('<span class="%s">%s</span>' % (cls, body))
    return '<div class="refs">' + "".join(out) + "</div>"


def teaching(t):
    lead = badge(t["refs"][0]["k"]) if t.get("refs") else badge("editorial")
    h = ['<article class="card mo">',
         '<div class="ch"><h3>%s</h3>%s</div>' % (esc(t["t"]), lead)]
    if t.get("claim"):
        h.append('<p class="claim"><b>What is claimed.</b> %s</p>' % esc(t["claim"]))
    for pgh in t["ps"]:
        h.append("<p>%s</p>" % esc(pgh))
    if t.get("ar"):
        h.append('<div class="dua"><p class="ar notranslate" translate="no" dir="rtl">%s</p>' % t["ar"])
        if t.get("trl"):
            h.append('<p class="trl">%s</p>' % esc(t["trl"]))
        h.append('<p class="mean">%s</p></div>' % esc(t.get("arl", "")))
    elif t.get("arl"):
        h.append('<p class="mean">%s</p>' % esc(t["arl"]))
    h.append(refs(t.get("refs")))
    h.append("</article>")
    return "".join(h)


def section(s):
    h = ['<section class="rsec" id="%s">' % esc(s["id"]),
         '<p class="sh-n">%s</p>' % esc(s["n"]),
         '<div class="sh"><h2>%s</h2><span class="ar notranslate" translate="no">%s</span></div>'
         % (esc(s["title"]), s["ar"]),
         '<p class="tr">%s</p>' % esc(s["tr"]),
         '<p class="sub">%s</p>' % esc(s["lead"])]
    if s.get("teachings"):
        h.append('<div data-mo-stagger>')
        for t in s["teachings"]:
            h.append(teaching(t))
        h.append("</div>")
    if s.get("items"):                       # the seven day list, tickable
        h.append('<div class="week"><div class="wk-top"><p class="wk-k">Seven days</p>'
                 '<span class="wk-r">%s<span class="wk-c" id="wk-count">0 of %d</span></span></div>'
                 % (badge("editorial"), len(s["items"])))
        h.append('<p class="wk-l">%s</p><ul class="wk-list">' % esc(s["lead"]))
        for i, it in enumerate(s["items"]):
            h.append('<li><label class="wkl"><input type="checkbox" data-wk="%d"/><span class="bx"></span>'
                     '<span class="tx">%s</span></label></li>' % (i, esc(it)))
        h.append('</ul><button type="button" class="wk-reset" id="wk-reset">Clear the week</button></div>')
        if s.get("foot"):
            h.append('<p class="foot">%s</p>' % esc(s["foot"]))
    for key in SEC_FIG.get(s["id"], []):
        h.append(FIGURES[key]())
    h.append("</section>")
    return "".join(h)


def build():
    d = json.load(open(SRC, encoding="utf-8"))
    m, fr = d["meta"], d["frame"]
    body = []
    # the section rail spans the page, not the reading column
    body.append('<nav class="secnav" aria-label="Sections of this room"><div class="secnav-in">')
    for s in d["sections"]:
        body.append('<a href="#%s">%s</a>' % (esc(s["id"]), esc(s.get("nav") or s["title"])))
    body.append('</div></nav><div class="wrap">')

    # the frame
    body.append('<article class="card open mo"><p class="kk">%s</p><h3>%s</h3>' % (esc(fr["kk"]), esc(fr["title"])))
    for p in fr["ps"]:
        body.append("<p>%s</p>" % esc(p))
    body.append('<div class="keys">')
    for k in ("quran", "sunnah", "debated", "editorial"):
        body.append("<div>%s<span>%s</span></div>" % (badge(k), esc(LEVELS[k][1])))
    body.append("</div></article>")

    for s in d["sections"]:
        body.append(section(s))
        if s["id"] == "myths":               # the printable checklist sits inside the myths
            t = d["tells"]
            body.append('<div class="tells mo" id="tells"><div class="tl-top"><p class="kk">%s</p>'
                        '<div class="tl-r">%s<button type="button" class="tl-print" id="tl-print">Print this page</button></div></div>'
                        '<h3>%s</h3><p class="tl-l">%s</p><ol class="tl-list">'
                        % (esc(t["kk"]), badge("editorial"), esc(t["title"]), esc(t["lead"])))
            for it in t["items"]:
                body.append("<li>%s</li>" % esc(it))
            body.append('</ol><p class="tl-f">%s</p></div>' % esc(t["foot"]))
        if s["id"] == "heart":               # the weekly shape closes the movement
            pl = d["plan"]
            body.append('<div class="plan mo"><div class="tl-top"><p class="kk">%s</p>%s</div>'
                        '<h3>%s</h3><p class="tl-l">%s</p><dl class="pl">'
                        % (esc(pl["kk"]), badge("editorial"), esc(pl["title"]), esc(pl["lead"])))
            for when, what in pl["rows"]:
                body.append("<dt>%s</dt><dd>%s</dd>" % (esc(when), esc(what)))
            body.append('</dl><p class="tl-f">%s</p></div>' % esc(pl["foot"]))

    nx = d["next"]
    body.append('<section class="wgo"><h2>%s</h2><p class="wgo-s">%s</p><div class="wgo-g" data-mo-stagger>'
                % (esc(nx["title"]), esc(nx["lead"])))
    for href, name, blurb in nx["cards"]:
        body.append('<a class="wgo-c mo" href="%s"><b>%s</b><span>%s</span></a>' % (esc(href), esc(name), esc(blurb)))
    body.append("</div></section></div>")

    jsonld = ('<script type="application/ld+json">' + json.dumps({
        "@context": "https://schema.org", "@type": "Article",
        "headline": m["h1"], "description": m["desc"],
        "isPartOf": {"@type": "WebSite", "name": "NOOR Codex of Light", "url": "https://noorcodex.com/"},
        "inLanguage": "en", "isAccessibleForFree": True,
    }, ensure_ascii=False) + "</script>")

    html = shell(slug="protection", title=m["title"], desc=m["desc"], ar=m["ar"], kick=m["kick"],
                 h1=m["h1"], lead=m["lead"], css=CSS, main="".join(body), jsonld=jsonld, extra_js=JS,
                 footline="Free forever, and it will never sell you a cure.")
    open(OUT, "w", encoding="utf-8").write(html)
    figs = html.count('class="fig mo-pop mo-draw')
    print("protection.html written · %d KB · %d figures · %d cards"
          % (len(html) / 1024, figs, html.count('<article class="card mo">')))


CSS = """
html{scroll-behavior:auto}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
.secnav{position:sticky;top:3.5rem;z-index:30;background:rgba(255,254,247,.93);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid rgba(44,36,22,.08)}
.secnav-in{display:flex;gap:.38rem;align-items:center;max-width:62rem;margin:0 auto;padding:.5rem 1rem;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}
.secnav-in::-webkit-scrollbar{display:none}
.secnav a{flex:0 0 auto;font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(44,36,22,.55);text-decoration:none;border:1px solid rgba(44,36,22,.13);border-radius:999px;padding:.3rem .68rem;background:#fff;transition:color .2s,border-color .2s,background .2s,box-shadow .2s;white-space:nowrap}
.secnav a:hover{color:#2C2416;border-color:rgba(201,162,39,.5)}
.secnav a.on{color:#1A160F;background:linear-gradient(135deg,#C9A227,#E9C86A);border-color:transparent;box-shadow:0 2px 12px rgba(201,162,39,.3)}
.rsec{scroll-margin-top:6.6rem}
.open{margin-top:1.7rem;border-color:rgba(201,162,39,.3);box-shadow:0 8px 30px rgba(44,36,22,.07)}
.open .kk,.tells .kk,.plan .kk{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .6rem}
.keys{display:grid;grid-template-columns:1fr 1fr;gap:.5rem .9rem;margin-top:.95rem;padding-top:.9rem;border-top:1px solid rgba(44,36,22,.1)}
.keys div{display:flex;align-items:center;gap:.45rem;font-size:.71rem;color:rgba(44,36,22,.55);line-height:1.5}
.keys .evb{flex:0 0 auto}
@media (max-width:560px){.keys{grid-template-columns:1fr}}
.sh-n{font-size:.6rem;letter-spacing:.22em;text-transform:uppercase;font-weight:800;color:rgba(201,162,39,.95);margin:0 0 .35rem}
.rsec .sh{gap:.7rem}
.rsec .sh .ar{font-family:Amiri,serif;font-size:1.55rem;line-height:1.2;color:var(--gold)}
.tr{font-size:.73rem;color:rgba(44,36,22,.48);margin:.3rem 0 0;letter-spacing:.02em}
.ch{display:flex;align-items:flex-start;justify-content:space-between;gap:.7rem;margin-bottom:.5rem}
.ch h3{margin:0}
.ch .evb{flex:0 0 auto;margin-top:.12rem}
.claim{font-size:.83rem;line-height:1.8;color:#6b4f92;background:rgba(107,79,146,.07);border:1px solid rgba(107,79,146,.22);border-radius:12px;padding:.55rem .7rem;margin:0 0 .75rem}
.claim b{color:#57407a;font-weight:800}
.dua{margin:.85rem 0 .2rem;background:linear-gradient(168deg,#FFFCEF,#FFF6DB);border:1px solid rgba(201,162,39,.32);border-radius:16px;padding:.9rem 1rem}
.dua .ar{font-family:Amiri,serif;font-size:1.3rem;line-height:2.15;color:#2C2416;margin:0;text-align:center}
.dua .trl{font-size:.77rem;font-style:italic;color:rgba(44,36,22,.6);margin:.5rem 0 0;line-height:1.7;text-align:center}
.dua .mean{font-size:.82rem;color:rgba(44,36,22,.82);margin:.42rem 0 0;line-height:1.75;text-align:center}
.refs{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.7rem}
.ref{display:inline-flex;align-items:center;gap:.35rem;font-size:.68rem;font-weight:700;color:rgba(44,36,22,.6);background:rgba(44,36,22,.05);border-radius:999px;padding:.26rem .6rem;border:1px solid rgba(44,36,22,.1);line-height:1.4}
.ref b{color:#8a6d13}
.ref .rn{font-weight:600;color:rgba(44,36,22,.5)}
.ref.q{background:rgba(201,162,39,.09);border-color:rgba(201,162,39,.26)}
.foot{font-size:.79rem;line-height:1.8;color:rgba(44,36,22,.6);margin:.85rem 0 0;font-style:italic}
.fig svg{width:100%;max-width:33rem;height:auto;display:block;margin:0 auto}
.fig.figwide svg{max-width:38rem}
.fig svg text{font-family:Inter,system-ui,sans-serif}
.fg{fill:#F4D46A;font-size:19px;font-weight:800;letter-spacing:.01em}
.fl{fill:#FFFEF7;fill-opacity:.82;font-size:16px;font-weight:600}
.fs{fill:#FFFEF7;fill-opacity:.5;font-size:13.5px;font-weight:500}
.s1{fill:none;stroke:#E9C86A;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.s2{fill:none;stroke:#FFFEF7;stroke-opacity:.6;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.s3{fill:none;stroke:#F4D46A;stroke-opacity:.32;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.f1{fill:#F4D46A;fill-opacity:.16}
.f2{fill:#F4D46A;fill-opacity:.9}
.b1{fill:#F4D46A;fill-opacity:.22;stroke:#E9C86A;stroke-width:1.4}
.b2{fill:#F4D46A;fill-opacity:.92;stroke:none}
.b3{fill:#FFFEF7;fill-opacity:.55;stroke:none}
.leg{list-style:none;margin:1rem 0 0;padding:0;display:grid;gap:.45rem}
.leg li{position:relative;padding-inline-start:1rem;font-size:.75rem;line-height:1.7;color:rgba(255,254,247,.66)}
.leg li::before{content:"";position:absolute;inset-inline-start:0;top:.62rem;width:.36rem;height:.36rem;border-radius:50%;background:#E9C86A}
.fig .cap b{color:rgba(244,212,106,.85);font-weight:700}
.tells{margin-top:1.5rem;background:#fff;border:1px solid rgba(143,45,45,.28);border-radius:18px;padding:1.1rem 1.15rem 1.2rem;box-shadow:0 6px 26px rgba(143,45,45,.07)}
.tl-top{display:flex;align-items:flex-start;justify-content:space-between;gap:.7rem}
.tl-r{display:flex;align-items:center;gap:.5rem;flex:0 0 auto}
.wk-r{display:flex;align-items:center;gap:.5rem;flex:0 0 auto}
.tl-print{flex:0 0 auto;border:1px solid rgba(44,36,22,.2);background:#fff;color:rgba(44,36,22,.7);border-radius:999px;padding:.32rem .78rem;font:inherit;font-size:.66rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
.tl-print:hover{border-color:rgba(201,162,39,.6);color:#2C2416}
.tells h3{font-size:1.05rem;font-weight:800;margin:0 0 .4rem}
.tl-l{font-size:.83rem;line-height:1.8;color:rgba(44,36,22,.68);margin:0 0 .8rem}
.tl-list{list-style:none;counter-reset:t;margin:0;padding:0}
.tl-list li{counter-increment:t;position:relative;padding-block:.42rem .42rem;padding-inline:2rem 0;font-size:.85rem;line-height:1.75;color:rgba(44,36,22,.84)}
.tl-list li+li{border-top:1px solid rgba(44,36,22,.06)}
.tl-list li::before{content:counter(t);position:absolute;inset-inline-start:0;top:.5rem;width:1.35rem;height:1.35rem;border-radius:999px;background:rgba(143,45,45,.09);border:1px solid rgba(143,45,45,.3);color:#8f2d2d;font-size:.66rem;font-weight:800;display:flex;align-items:center;justify-content:center}
.tl-f{font-size:.8rem;line-height:1.8;color:#1d6b3f;background:rgba(29,107,63,.07);border:1px solid rgba(29,107,63,.24);border-radius:12px;padding:.6rem .75rem;margin:.9rem 0 0}
.plan{margin-top:1.4rem;background:linear-gradient(168deg,#FFFCEF,#FFF6DB);border:1px solid rgba(201,162,39,.3);border-radius:18px;padding:1.1rem 1.15rem 1.2rem}
.plan h3{font-size:1.05rem;font-weight:800;margin:0 0 .4rem}
.pl{margin:0;display:grid;grid-template-columns:9.5rem 1fr;gap:.1rem .9rem}
.pl dt{font-size:.72rem;letter-spacing:.09em;text-transform:uppercase;font-weight:800;color:#8a6d13;padding:.45rem 0;line-height:1.6}
.pl dd{margin:0;font-size:.84rem;line-height:1.8;color:rgba(44,36,22,.8);padding:.45rem 0;border-top:1px solid rgba(201,162,39,.2)}
.pl dt{border-top:1px solid rgba(201,162,39,.2)}
.pl dt:first-of-type,.pl dd:first-of-type{border-top:0}
@media (max-width:560px){.pl{grid-template-columns:1fr;gap:0}.pl dd{border-top:0;padding-top:0}.pl dt{padding-bottom:.1rem}}
.week{margin-top:1.1rem;border-radius:18px;padding:1.05rem 1.15rem 1.15rem;background:#fff;border:1px solid rgba(201,162,39,.3)}
.wk-top{display:flex;align-items:baseline;justify-content:space-between;gap:.7rem}
.wk-k{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0}
.wk-c{font-size:.65rem;color:rgba(44,36,22,.45);margin:0;font-weight:700;white-space:nowrap}
.wk-l{font-size:.78rem;color:rgba(44,36,22,.6);line-height:1.75;margin:.4rem 0 .75rem}
.wk-list{list-style:none;margin:0;padding:0}
.wkl{position:relative;display:flex;gap:.62rem;align-items:flex-start;padding:.45rem .35rem;border-radius:12px;cursor:pointer;transition:background .18s}
.wkl:hover{background:rgba(201,162,39,.09)}
.wkl input{position:absolute;opacity:0;width:0;height:0}
.bx{flex:0 0 auto;width:1.08rem;height:1.08rem;margin-top:.14rem;border-radius:7px;border:1.5px solid rgba(201,162,39,.55);background:#fff;position:relative;transition:background .2s,border-color .2s}
.bx::after{content:"";position:absolute;inset-inline-start:.33rem;top:.13rem;width:.26rem;height:.52rem;border:solid #1A160F;border-width:0 2px 2px 0;transform:rotate(42deg) scale(.35);opacity:0;transition:opacity .2s,transform .2s}
.wkl input:checked+.bx{background:linear-gradient(135deg,#C9A227,#E9C86A);border-color:transparent}
.wkl input:checked+.bx::after{opacity:1;transform:rotate(42deg) scale(1)}
.wkl input:focus-visible+.bx{outline:2px solid #8a6d13;outline-offset:2px}
.wkl .tx{font-size:.83rem;line-height:1.7;color:rgba(44,36,22,.82)}
.wkl input:checked~.tx{color:rgba(44,36,22,.42)}
.wk-reset{margin-top:.65rem;background:none;border:0;font:inherit;font-size:.67rem;font-weight:700;color:rgba(44,36,22,.4);cursor:pointer;text-decoration:underline;padding:.25rem .35rem}
.wk-reset:hover{color:rgba(44,36,22,.65)}
.wgo{max-width:62rem;margin:2.9rem auto 0;padding:1.75rem 0 .4rem;border-top:1px solid rgba(44,36,22,.12)}
.wgo>h2{font-size:1.06rem;font-weight:800;margin:0;color:#2C2416}
.wgo>.wgo-s{font-size:.8rem;line-height:1.8;color:rgba(44,36,22,.6);margin:.35rem 0 0;max-width:34rem}
.wgo-g{display:grid;grid-template-columns:1fr;gap:.65rem;margin-top:1.05rem}
@media(min-width:38rem){.wgo-g{grid-template-columns:1fr 1fr}}
.wgo-c{display:block;text-decoration:none;background:#fff;border:1px solid rgba(44,36,22,.12);border-radius:16px;padding:.85rem .95rem;transition:border-color .18s,transform .18s,box-shadow .18s}
.wgo-c:hover{border-color:rgba(201,162,39,.7);transform:translateY(-1px);box-shadow:0 5px 18px rgba(44,36,22,.07)}
.wgo-c b{display:block;font-size:.9rem;font-weight:800;color:#2C2416;line-height:1.45}
.wgo-c b::after{content:" \\2192";color:#C9A227}
.wgo-c span{display:block;font-size:.8rem;line-height:1.8;color:rgba(44,36,22,.68);margin-top:.28rem}
@media print{
  .secnav,.wk-reset,.tl-print,.wgo{display:none!important}
  .rsec{page-break-before:always;break-before:page}
  .card,.fig,.tells,.plan,.week,.dua{page-break-inside:avoid;break-inside:avoid}
  .tl-list li,.wkl,.pl dt,.pl dd{page-break-inside:avoid;break-inside:avoid}
  h2,h3,.sh,.sh-n,.kk{page-break-after:avoid;break-after:avoid}
  body.tells-only main>*{display:none!important}
  body.tells-only main>.wrap{display:block!important}
  body.tells-only .wrap>*:not(#tells){display:none!important}
  body.tells-only #tells{page-break-before:avoid!important;break-before:avoid!important;border:0;box-shadow:none;padding:0}
}
"""

JS = """<script>
(function(){
  var K="noor-protect-week";
  function $(i){return document.getElementById(i)}
  /* the seven day list remembers itself on this device, and nowhere else */
  var boxes=[].slice.call(document.querySelectorAll('[data-wk]'));
  function read(){try{return JSON.parse(localStorage.getItem(K)||"[]")}catch(e){return []}}
  function count(){
    var n=boxes.filter(function(b){return b.checked}).length, el=$("wk-count");
    if(el) el.textContent=n+" of "+boxes.length;
  }
  var saved=read();
  boxes.forEach(function(b){
    if(saved.indexOf(+b.getAttribute("data-wk"))>=0) b.checked=true;
    b.addEventListener("change",function(){
      var on=boxes.filter(function(x){return x.checked}).map(function(x){return +x.getAttribute("data-wk")});
      try{localStorage.setItem(K,JSON.stringify(on))}catch(e){}
      count();
    });
  });
  count();
  var r=$("wk-reset");
  if(r) r.addEventListener("click",function(){
    boxes.forEach(function(b){b.checked=false});
    try{localStorage.removeItem(K)}catch(e){}
    count();
  });
  /* the eleven tells print alone, on one page */
  var tp=$("tl-print");
  if(tp) tp.addEventListener("click",function(){
    document.body.classList.add("tells-only");
    window.print();
  });
  addEventListener("afterprint",function(){document.body.classList.remove("tells-only")});
  /* the section rail follows the reader */
  var links=[].slice.call(document.querySelectorAll(".secnav a"));
  var secs=links.map(function(a){return document.getElementById(a.getAttribute("href").slice(1))}).filter(Boolean);
  if(secs.length && "IntersectionObserver" in window){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){
        if(!e.isIntersecting) return;
        links.forEach(function(a){a.classList.toggle("on", a.getAttribute("href")==="#"+e.target.id)});
      });
    },{rootMargin:"-30% 0px -60% 0px"});
    secs.forEach(function(s){io.observe(s)});
  }
})();
</script>"""

if __name__ == "__main__":
    build()
