# NOOR v49 · the room shell
# One canonical page frame for every room of the Codex: head, the calm menu,
# the ink hero, the footer, the motion layer. Rooms supply only their own
# CSS and their own <main>.
#
#   from room import shell
#   html = shell(slug="family", title="...", desc="...", ar="الأُسْرَة",
#                h1="...", lead="...", css="...", main="...", extra_head="", extra_js="")
#
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nav49 import nav_html

ROOM_CSS = """
:root{--parchment:#FFFEF7;--ink:#2C2416;--gold:#C9A227;--gold-hi:#F4D46A;--night:#14100A}
body{background:var(--parchment);color:var(--ink);font-family:Inter,system-ui,sans-serif;margin:0}
.font-amiri{font-family:Amiri,serif}
.rhero{position:relative;overflow:hidden;background:linear-gradient(178deg,#14100A,#151b2e 55%,#1d2a45 100%);color:#FFFEF7;text-align:center;padding:3.4rem 1rem 3.6rem}
.rhero .ar{font-family:Amiri,serif;font-size:2.2rem;color:#F4D46A;filter:drop-shadow(0 0 18px rgba(244,212,106,.45));position:relative;z-index:2}
.rhero h1{font-size:clamp(1.6rem,4.6vw,2.3rem);font-weight:800;margin:.4rem 0 0;position:relative;z-index:2;line-height:1.18}
.rhero .lead{font-size:.88rem;color:rgba(255,254,247,.72);max-width:36rem;margin:.75rem auto 0;line-height:1.75;position:relative;z-index:2}
.rhero .kick{font-size:.6rem;letter-spacing:.22em;text-transform:uppercase;color:rgba(244,212,106,.75);font-weight:800;position:relative;z-index:2}
.wrap{max-width:46rem;margin:0 auto;padding:0 1rem}
.wrapw{max-width:62rem;margin:0 auto;padding:0 1rem}
.rsec{padding:2.6rem 0 .4rem}
.rsec h2{font-size:1.32rem;font-weight:800;letter-spacing:-.01em;margin:0}
.rsec .sub{font-size:.85rem;color:rgba(44,36,22,.62);line-height:1.75;margin:.5rem 0 0;max-width:38rem}
.rsec .sh{display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap}
.rsec .sh .ar{font-family:Amiri,serif;font-size:1.35rem;color:var(--gold)}
.card{background:#fff;border:1px solid rgba(44,36,22,.12);border-radius:18px;padding:1.1rem 1.15rem;margin-top:.85rem;box-shadow:0 2px 10px rgba(44,36,22,.04)}
.card h3{font-size:1rem;font-weight:800;margin:0 0 .45rem}
.card p{font-size:.87rem;line-height:1.85;color:rgba(44,36,22,.8);margin:0 0 .7rem}
.card p:last-child{margin-bottom:0}
.pill{display:inline-block;font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;font-weight:800;border-radius:999px;padding:.28rem .62rem;background:rgba(201,162,39,.13);color:#8a6d13;border:1px solid rgba(201,162,39,.3)}
.gpill{background:linear-gradient(135deg,#C9A227,#E9C86A);color:#1A160F;font-weight:800;border-radius:999px;padding:.62rem 1.25rem;font-size:.8rem;text-decoration:none;display:inline-block;transition:transform .15s}
.gpill:hover{transform:translateY(-1px)}
.ghost{border:1px solid rgba(44,36,22,.22);color:rgba(44,36,22,.75);border-radius:999px;padding:.6rem 1.2rem;font-size:.8rem;font-weight:700;text-decoration:none;display:inline-block}
.fig{background:linear-gradient(170deg,#14100A,#1b2440);border:1px solid rgba(244,212,106,.22);border-radius:18px;padding:1.1rem;margin:.95rem 0}
.fig .cap{font-size:.72rem;color:rgba(255,254,247,.62);text-align:center;margin:.7rem 0 0;line-height:1.6}
.rfoot{border-top:1px solid rgba(44,36,22,.1);padding:2.2rem 1rem 2.6rem;text-align:center;margin-top:2.6rem}
.rfoot p{font-size:.74rem;color:rgba(44,36,22,.45);line-height:1.9;margin:0}
.rfoot a{color:rgba(44,36,22,.6);text-decoration:underline}
.evb{display:inline-flex;align-items:center;gap:.3rem;font-size:.6rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:.24rem .55rem;border:1px solid}
.evb.quran{color:#1d6b3f;border-color:rgba(29,107,63,.55);background:rgba(29,107,63,.13)}
.evb.quran::before{content:"";width:.46rem;height:.46rem;border-radius:999px;background:#1d6b3f;box-shadow:0 0 0 2px rgba(29,107,63,.28);flex:none}
.evb.sunnah{color:#8a6d13;border-color:rgba(201,162,39,.5);background:rgba(201,162,39,.13)}
.evb.sunnah::before{content:"";width:.46rem;height:.46rem;background:#C9A227;flex:none;transform:rotate(45deg)}
.evb.debated{color:#6b4f92;border-color:rgba(107,79,146,.5);background:rgba(107,79,146,.11)}
.evb.debated::before{content:"";width:.46rem;height:.46rem;border-radius:999px;border:1.5px dashed #6b4f92;flex:none}
.evb.editorial{color:rgba(44,36,22,.62);border-color:rgba(44,36,22,.28);background:rgba(44,36,22,.05)}
.evb.editorial::before{content:"";width:.46rem;height:.1rem;background:rgba(44,36,22,.5);flex:none}
.refs{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.6rem}
.ref{font-size:.68rem;font-weight:700;color:rgba(44,36,22,.6);background:rgba(44,36,22,.05);border-radius:999px;padding:.26rem .6rem;border:1px solid rgba(44,36,22,.1)}
.ref b{color:#8a6d13}
.vplay{cursor:pointer;border:1px solid rgba(201,162,39,.45);background:rgba(244,212,106,.12);color:#8a6d13;border-radius:999px;padding:.24rem .6rem;font-size:.66rem;font-weight:800;font-family:inherit}
.vplay.playing{background:#2C2416;color:#F4D46A;border-color:#2C2416}
@media (prefers-reduced-motion:no-preference){.mo,.mo-pop{will-change:transform,opacity}}
"""

HEAD = """<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta name="description" content="{desc}"/>
<meta property="og:title" content="{title} · NOOR Codex of Light"/>
<meta property="og:description" content="{desc}"/>
<meta property="og:image" content="https://noorcodex.com/assets/brand/og.png"/>
<meta name="theme-color" content="#14100A"/>
<link rel="icon" type="image/svg+xml" href="/assets/brand/mark.svg"/>
<link rel="manifest" href="/manifest.webmanifest"/>
<title>{title} · NOOR Codex of Light</title>
<link rel="canonical" href="https://noorcodex.com/{canon}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="{p}assets/tw.css?v=49"/>
<script src="{p}noor-fx.js" defer></script>
<script src="{p}noor-ink.js" defer></script>
<script src="/assets/noor-anime.js?v=1" defer></script>
<link rel="stylesheet" href="/assets/noor-ramadan.css?v=1"/>
<link rel="stylesheet" href="/assets/figfit.css?v=106"/>
<script src="/assets/figfit.js?v=106" defer></script>
<script src="/assets/noor-dials.js?v=109" defer></script>
<link rel="stylesheet" href="/assets/noor-rtl.css?v=77"/>
<script src="/assets/noor-hijri.js?v=1" defer></script>
<script src="/assets/noor-ramadan.js?v=1" defer></script>
<script src="/assets/noor-overrides.js?v=1" defer></script>
<script src="/assets/noor-text.js?v=82" defer></script>
<script src="/assets/noor-search.js?v=77" defer></script>
<script src="/sponsor.js" defer></script>
{jsonld}
<style>html{{-webkit-text-size-adjust:100%}}html,body{{overflow-x:clip}}*{{-webkit-tap-highlight-color:transparent}}a,button{{touch-action:manipulation}}</style>
<style>{roomcss}{css}</style>
{extra_head}
</head>
<body>
"""

FOOT = """
<footer class="rfoot">
<p>{footline}<br/>
<a href="/">Return to the Codex</a> · <a href="/feedback">Send a correction</a> · <a href="/donate">Keep the lamp lit ✦</a></p>
</footer>
{extra_js}
</body>
</html>
"""


def shell(slug, title, desc, ar, h1, lead, main, css="", kick="", jsonld="", extra_head="",
          extra_js="", footline="Free forever, like every room in the Codex.", prefix="", canon=None):
    p = prefix
    head = HEAD.format(desc=desc, title=title, canon=canon or slug, p=p, roomcss=ROOM_CSS, css=css,
                       jsonld=jsonld, extra_head=extra_head)
    nav = nav_html(p, slug + ".html")
    hero = ('<section class="rhero" data-ink=soft>\n' +
            (('<p class="kick">' + kick + '</p>\n') if kick else '') +
            ('<div class="ar notranslate" translate="no">' + ar + '</div>\n' if ar else '') +
            '<h1>' + h1 + '</h1>\n' +
            '<p class="lead">' + lead + '</p>\n' +
            '</section>\n')
    foot = FOOT.format(footline=footline, p=p, extra_js=extra_js)
    return head + nav + "\n<main>\n" + hero + main + "\n</main>\n" + foot
