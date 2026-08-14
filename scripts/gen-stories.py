#!/usr/bin/env python3
# NOOR v49 · The Hall of Stories
# Builds /stories/index.html and one page per story from build/stories-a.json
# and build/stories-b.json through the canonical room shell.
#
# The stories are the one invented thing in the Codex. Everything the shell
# gives them (head, menu, hero, footer) is shared with every other room; this
# file supplies only the hall: its CSS, its doors, its reading page.
#
# Every page lives one folder deep, so every call passes prefix="../".
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from room import shell  # noqa: E402

SRC = [os.path.join(ROOT, "build", "stories-a.json"),
       os.path.join(ROOT, "build", "stories-b.json")]
OUTDIR = os.path.join(ROOT, "stories")

# Surah names for the references the stories cite. Anything unlisted simply
# shows its number, which is still a complete citation.
SURAH = {
    2: "Al-Baqarah", 21: "Al-Anbiya", 28: "Al-Qasas", 35: "Fatir",
    39: "Az-Zumar", 65: "At-Talaq", 85: "Al-Buruj", 94: "Ash-Sharh",
}


def esc(s):
    """Escape only what would corrupt the markup. The prose is finished:
    its curly apostrophes, quotation marks and ﷺ pass through untouched."""
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def words(n):
    return "{:,}".format(n)


def surah_line(ref):
    m = re.match(r"^\s*(\d{1,3})\s*:", str(ref))
    if not m:
        return "Qur’an · " + esc(ref)
    name = SURAH.get(int(m.group(1)))
    return "Qur’an · " + (esc(name) + " " if name else "") + esc(ref)


# ----------------------------------------------------------------------------
# the CSS of the hall
# ----------------------------------------------------------------------------

HUB_CSS = """
.honest{border:1px solid rgba(201,162,39,.45);background:linear-gradient(180deg,rgba(244,212,106,.10),rgba(244,212,106,.028));border-radius:20px;padding:1.2rem 1.3rem 1.25rem;margin:1.9rem 0 .2rem;box-shadow:0 2px 14px rgba(201,162,39,.07)}
.honest .hh{display:flex;align-items:center;gap:.55rem;margin:0 0 .7rem}
.honest .hh i{font-family:Amiri,serif;font-style:normal;color:var(--gold);font-size:.85rem;line-height:1}
.honest .hh b{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:#8a6d13;font-weight:800}
.honest p{font-size:.885rem;line-height:1.92;color:rgba(44,36,22,.82);margin:0 0 .65rem}
.honest p:last-child{margin-bottom:0}
.honest strong{font-weight:800;color:#2C2416}
.hallnote{font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:rgba(44,36,22,.4);font-weight:800;text-align:center;margin:2.6rem 0 0}
.hall{display:grid;grid-template-columns:repeat(auto-fill,minmax(17.5rem,1fr));gap:.9rem;margin:1.15rem 0 .3rem}
.door{display:flex;flex-direction:column;background:#fff;border:1px solid rgba(44,36,22,.12);border-radius:18px;padding:1.05rem 1.1rem 1rem;text-decoration:none;color:inherit;position:relative;overflow:hidden;box-shadow:0 2px 10px rgba(44,36,22,.04);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
.door::before{content:"";position:absolute;inset-inline-start:1.1rem;inset-inline-end:1.1rem;top:0;height:2px;border-radius:0 0 2px 2px;background:linear-gradient(90deg,transparent,rgba(201,162,39,.85),transparent);opacity:.45;transition:opacity .18s ease}
.door:hover{transform:translateY(-2px);border-color:rgba(201,162,39,.45);box-shadow:0 14px 30px rgba(44,36,22,.09)}
.door:hover::before{opacity:1}
.door .nm{font-family:Amiri,serif;font-size:1.72rem;line-height:1.5;color:var(--gold)}
.door .tr{font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:.05rem 0 0}
.door .tr em{font-style:normal;color:rgba(44,36,22,.5);letter-spacing:.12em}
.door h3{font-size:1.04rem;font-weight:800;line-height:1.35;margin:.55rem 0 .3rem;color:#2C2416}
.door .set{font-size:.775rem;line-height:1.7;color:rgba(44,36,22,.63);margin:0}
.door .note{font-size:.74rem;line-height:1.75;font-style:italic;color:rgba(44,36,22,.5);margin:.55rem 0 0}
.door .foot{display:flex;align-items:center;justify-content:space-between;gap:.6rem;margin-top:auto;padding-top:.85rem}
.door .wc{font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:rgba(44,36,22,.38)}
.door .go{font-size:.68rem;font-weight:800;color:#8a6d13;opacity:.75;transition:opacity .18s ease}
.door:hover .go{opacity:1}
.door .pill{align-self:flex-start;margin-bottom:.45rem}
.close{border-top:1px solid rgba(44,36,22,.1);margin-top:2.6rem;padding-top:1.7rem;text-align:center}
.close p{font-size:.85rem;line-height:1.9;color:rgba(44,36,22,.68);margin:0 auto;max-width:34rem}
.close .bl{display:flex;flex-wrap:wrap;gap:.6rem;justify-content:center;margin-top:1.15rem}
"""

STORY_CSS = """
.rprog{position:fixed;left:0;right:0;top:0;height:2px;z-index:90;pointer-events:none}
.rprog span{display:block;height:100%;width:100%;transform:scaleX(0);transform-origin:0 50%;background:linear-gradient(90deg,#C9A227,#F4D46A);box-shadow:0 0 10px rgba(244,212,106,.6)}
@media (prefers-reduced-motion:no-preference){.rprog span{transition:transform .1s linear}}
.sread{padding-bottom:1rem}
.before{max-width:34rem;margin:2rem auto 0;background:#fff;border:1px solid rgba(44,36,22,.13);border-radius:16px;padding:.95rem 1.15rem 1rem;box-shadow:0 2px 10px rgba(44,36,22,.04)}
.before b{display:block;font-size:.58rem;letter-spacing:.2em;text-transform:uppercase;color:#8a6d13;font-weight:800;margin-bottom:.42rem}
.before p{font-size:.85rem;line-height:1.88;font-style:italic;color:rgba(44,36,22,.72);margin:0}
.epi{max-width:29rem;margin:2.8rem auto 2.5rem;text-align:center;font-family:Amiri,serif;font-size:1.36rem;line-height:1.9;color:rgba(44,36,22,.7)}
.epi::before{content:"✦";display:block;font-family:Inter,system-ui,sans-serif;font-size:.68rem;color:var(--gold);opacity:.85;margin-bottom:1rem}
.prose{max-width:34rem;margin:0 auto}
.mv h2{font-size:1.06rem;font-weight:800;line-height:1.42;color:#2C2416;margin:0 0 1.1rem}
.mv h2::after{content:"";display:block;width:2.3rem;height:1px;margin-top:.62rem;background:linear-gradient(90deg,rgba(201,162,39,.9),rgba(201,162,39,0))}
.mv p{font-size:1.02rem;line-height:1.95;color:rgba(44,36,22,.87);margin:0 0 1.2rem}
.mv p:last-child{margin-bottom:0}
.mv>p:first-of-type::first-letter{font-family:Amiri,serif;font-weight:700;font-size:3.15rem;line-height:.9;color:var(--gold);float:left;padding-block:.34rem 0;padding-inline:0 .5rem}
.orn{display:flex;align-items:center;justify-content:center;gap:.95rem;margin:2.9rem 0}
.orn::before,.orn::after{content:"";height:1px;width:3.6rem}
.orn::before{background:linear-gradient(90deg,rgba(201,162,39,0),rgba(201,162,39,.6))}
.orn::after{background:linear-gradient(90deg,rgba(201,162,39,.6),rgba(201,162,39,0))}
.orn i{font-style:normal;color:var(--gold);font-size:.72rem;opacity:.9;line-height:1}
.ayah{max-width:34rem;margin:3.2rem auto 0}
.ayah .ar{font-family:Amiri,serif;font-size:1.42rem;line-height:2.15;color:#F4D46A;text-align:end;margin:.2rem 0 0}
.ayah .en{font-size:.86rem;line-height:1.85;color:rgba(255,254,247,.78);margin:1rem 0 0}
.ayah .rw{display:flex;align-items:center;justify-content:space-between;gap:.7rem;flex-wrap:wrap;margin-top:1rem;padding-top:.85rem;border-top:1px solid rgba(244,212,106,.18)}
.ayah .rf{font-size:.63rem;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:rgba(244,212,106,.7)}
.ayah .vplay{color:#F4D46A;border-color:rgba(244,212,106,.45);background:rgba(244,212,106,.13)}
.ayah .vplay.playing{background:#F4D46A;color:#14100A;border-color:#F4D46A}
.snav{max-width:34rem;margin:2.6rem auto 0;padding-top:1.5rem;border-top:1px solid rgba(44,36,22,.1);display:grid;grid-template-columns:1fr auto 1fr;gap:.6rem;align-items:stretch}
.snav a,.snav span.off{display:flex;flex-direction:column;justify-content:center;text-decoration:none;background:#fff;border:1px solid rgba(44,36,22,.12);border-radius:14px;padding:.72rem .85rem;font-size:.78rem;line-height:1.55;color:rgba(44,36,22,.75);transition:border-color .18s ease,color .18s ease}
.snav a:hover{border-color:rgba(201,162,39,.5);color:#2C2416}
.snav .k{font-size:.55rem;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:rgba(44,36,22,.4);margin-bottom:.25rem}
.snav .nx{text-align:end}
.snav .mid{align-items:center;text-align:center;font-weight:800;font-size:.72rem;letter-spacing:.03em}
.snav span.off{border-style:dashed;color:rgba(44,36,22,.45);background:transparent}
@media (max-width:36rem){.snav{grid-template-columns:1fr}.snav .nx{text-align:start}.mv>p:first-of-type::first-letter{font-size:2.85rem}}
"""

STORY_JS = """<script>
(function(){
  /* the reading line: a thin gold rule that fills as the story is read.
     Under prefers-reduced-motion it still updates, it simply does not glide. */
  var bar = document.getElementById("rprogbar");
  if (bar) {
    var queued = false;
    var paint = function () {
      queued = false;
      var d = document.documentElement;
      var span = d.scrollHeight - d.clientHeight;
      var p = span > 0 ? (d.scrollTop || document.body.scrollTop) / span : 0;
      if (p < 0) { p = 0; }
      if (p > 1) { p = 1; }
      bar.style.transform = "scaleX(" + p + ")";
    };
    var ask = function () {
      if (queued) { return; }
      queued = true;
      if (window.requestAnimationFrame) { window.requestAnimationFrame(paint); } else { paint(); }
    };
    window.addEventListener("scroll", ask, { passive: true });
    window.addEventListener("resize", ask, { passive: true });
    paint();
  }
  /* the closing verse, in the shared Mushaf voice */
  Array.prototype.forEach.call(document.querySelectorAll(".vplay"), function (b) {
    b.addEventListener("click", function () {
      if (window.playAyah) { window.playAyah(b.getAttribute("data-ref"), b); }
    });
  });
})();
</script>"""


# ----------------------------------------------------------------------------
# the hall
# ----------------------------------------------------------------------------

HONESTY = (
    '<section class="honest">'
    '<p class="hh"><i>✦</i><b>Please read this before the stories</b></p>'
    "<p>This hall is the <strong>one place in the Codex where the people are "
    "invented</strong>. Everywhere else on this site you are reading history and "
    "evidence: named narrators, dated events, verses and hadith carried with their "
    "chains and their references, and our own reasoning marked plainly wherever we "
    "add it.</p>"
    "<p>These stories make no claim to have happened. There was no such diver, no "
    "such baker, no such scribe. What they carry is true: the Names of Allah, set "
    "down into lives that could have been lived, in places and centuries that "
    "really existed.</p>"
    "<p>The verses inside them are real and cited. Not one word of the Qur’an here "
    "has been imagined, softened or rearranged; every ayah is given in Arabic with "
    "its meaning and its reference, and you can hear it recited on the page.</p>"
    "</section>"
)


def door(st, href, first=False):
    pill = '<span class="pill">The first story</span>' if first else ""
    return (
        '<a class="door mo" href="%s">%s'
        '<div class="nm notranslate" translate="no">%s</div>'
        '<div class="tr">%s <em>· %s</em></div>'
        "<h3>%s</h3>"
        '<p class="set">%s</p>'
        '<p class="note">%s</p>'
        '<div class="foot"><span class="wc">%s words</span>'
        '<span class="go">Read ✦</span></div>'
        "</a>"
    ) % (esc(href), pill, esc(st["name_ar"]), esc(st["name_en"]),
         esc(st["name_meaning"]), esc(st["title"]), esc(st["setting"]),
         esc(st["reader_note"]), words(st["words"]))


CLOSING = (
    '<section class="close mo">'
    "<p>More stories are coming, one Name at a time. If there is a Name you have "
    "been carrying, or a life you wish someone had written down so you could see "
    "yourself inside it, tell us and we will take it seriously. The hall is built "
    "slowly and on purpose.</p>"
    '<div class="bl">'
    '<a class="ghost" href="../feedback.html">Ask for the next story</a>'
    '<a class="gpill" href="../donate.html">Keep the lamp lit ✦</a>'
    "</div></section>"
)


def build_hub(stories, latif):
    doors = [door(latif, "../latif.html", first=True)]
    doors += [door(s, s["slug"] + ".html") for s in stories]
    main = ('<div class="wrap">' + HONESTY + "</div>"
            '<div class="wrapw">'
            '<p class="hallnote">Nine doors ✦ nine Names</p>'
            '<div class="hall">' + "".join(doors) + "</div>"
            "</div>"
            '<div class="wrap">' + CLOSING + "</div>")
    return shell(
        slug="stories",
        title="The Hall of Stories",
        desc=("Nine stories, each carrying one Name of Allah into an ordinary life. "
              "The people are invented and said to be; the Names, the verses and the "
              "places are real."),
        ar="حِكَايَات",
        kick="The Hall of Stories",
        h1="Invented lives, true Names",
        lead=("Nine stories, each one carrying a single Name of Allah into an ordinary "
              "life: a pearl diver, a baker in a famine, a scribe who could not undo what "
              "he had written. The people never lived, and we say so on every page; the "
              "Name they meet is real, and so is every verse they are given."),
        main=main,
        css=HUB_CSS,
        footline="The Hall of Stories is free forever, like every room in the Codex.",
        prefix="../",
        canon="stories",
    )


# ----------------------------------------------------------------------------
# one story
# ----------------------------------------------------------------------------

def movement(mv):
    ps = "".join("<p>%s</p>" % esc(p) for p in mv["ps"])
    return '<section class="mv"><h2>%s</h2>%s</section>' % (esc(mv["h"]), ps)


ORN = '<div class="orn" aria-hidden="true"><i>✦</i></div>'


def nav_cell(kind, label, title, href):
    k = ('<span class="k">%s</span>' % esc(label)) if label else ""
    if not href:
        return '<span class="off %s">%s%s</span>' % (kind, k, esc(title))
    return '<a class="%s" href="%s">%s%s</a>' % (kind, esc(href), k, esc(title))


def build_story(st, prev, nxt):
    body = ORN.join(movement(m) for m in st["movements"])

    ayah = (
        '<div class="fig ayah mo">'
        '<p class="ar notranslate" translate="no" dir="rtl" lang="ar">%s</p>'
        '<p class="en">%s</p>'
        '<div class="rw"><span class="rf">%s</span>'
        '<button class="vplay" data-ref="%s">Listen ▸</button></div>'
        "</div>"
    ) % (esc(st["ayah"]["ar"]), esc(st["ayah"]["en"]),
         surah_line(st["ayah"]["ref"]), esc(st["ayah"]["ref"]))

    snav = ('<nav class="snav mo" aria-label="More stories">%s%s%s</nav>' % (
        nav_cell("pv", "Previous story", prev[0] if prev else "", prev[1] if prev else None),
        nav_cell("mid", "", "The Hall of Stories", "index.html"),
        nav_cell("nx", "Next story", nxt[0] if nxt else "More are coming",
                 nxt[1] if nxt else None),
    ))

    main = ('<div class="rprog" aria-hidden="true"><span id="rprogbar"></span></div>'
            '<div class="wrap sread">'
            '<section class="before mo"><b>Before you begin</b><p>%s</p></section>'
            '<p class="epi mo">%s</p>'
            '<article class="prose">%s</article>'
            "%s%s</div>") % (esc(st["reader_note"]), esc(st["epigraph"]), body, ayah, snav)

    return shell(
        slug=st["slug"],
        title=esc("%s · %s" % (st["title"], st["name_en"])),
        desc=esc("%s: a story of %s, %s. %s. The people in it are invented and said to "
                 "be; the Name and the verse are real." %
                 (st["title"], st["name_en"], st["name_meaning"], st["setting"])),
        ar=esc(st["name_ar"]),
        kick=esc("%s · %s" % (st["name_en"], st["name_meaning"])),
        h1=esc(st["title"]),
        lead=esc(st["setting"]),
        main=main,
        css=STORY_CSS,
        extra_js=STORY_JS,
        footline=("A story from the Hall of Stories: the people are invented, "
                  "the Name and the verses are not."),
        prefix="../",
        canon="stories/" + st["slug"],
    )


# ----------------------------------------------------------------------------

def latif_words():
    """Count the words already standing on latif.html. That page is finished
    and is never touched by this generator; we only read it."""
    path = os.path.join(ROOT, "latif.html")
    if not os.path.exists(path):
        return 0
    s = open(path, encoding="utf-8").read()
    i, j = s.find("<main"), s.find("</main>")
    if i < 0 or j < 0:
        return 0
    part = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", s[i:j])
    part = re.sub(r"<[^>]+>", " ", part)
    return len(part.split())


LATIF = {
    "name_ar": "اللَّطِيف",
    "name_en": "Al-Latif",
    "name_meaning": "The Subtle, the Gentle",
    "title": "The Story of Beauty",
    "setting": "A courtyard with a pomegranate tree in ancient Khorasan",
    "reader_note": ("The first story written for this hall, and the gentlest: for anyone "
                    "who keeps a private ledger of their own failures and believes it."),
}


def build():
    stories = []
    for path in SRC:
        stories.extend(json.load(open(path, encoding="utf-8"))["stories"])
    for s in stories:
        s["words"] = sum(len(p.split()) for m in s["movements"] for p in m["ps"])

    latif = dict(LATIF)
    latif["words"] = latif_words()

    if not os.path.isdir(OUTDIR):
        os.makedirs(OUTDIR)

    written = []
    hub = os.path.join(OUTDIR, "index.html")
    open(hub, "w", encoding="utf-8").write(build_hub(stories, latif))
    written.append(hub)

    for i, st in enumerate(stories):
        if i == 0:
            prev = (LATIF["title"], "../latif.html")
        else:
            prev = (stories[i - 1]["title"], stories[i - 1]["slug"] + ".html")
        nxt = ((stories[i + 1]["title"], stories[i + 1]["slug"] + ".html")
               if i + 1 < len(stories) else None)
        out = os.path.join(OUTDIR, st["slug"] + ".html")
        open(out, "w", encoding="utf-8").write(build_story(st, prev, nxt))
        written.append(out)

    total = sum(s["words"] for s in stories)
    for p in written:
        print("wrote %s  %d bytes" % (p, os.path.getsize(p)))
    print("%d pages · %d stories · %s words of new prose"
          % (len(written), len(stories), words(total)))



def _synergy(*pages):
    """Re-hang the closing cross-link band this generator's rooms carry.
    Kept in scripts/synergy.py so every room's exits live in one place."""
    try:
        import synergy
    except Exception as exc:            # the band is a nicety, not a gate
        print("  synergy skipped: %s" % exc)
        return
    for page in pages:
        if page == "eid.html":
            synergy.apply_eid()
        synergy.apply_to(page)
    synergy.apply_prose()
    print("  synergy band re-hung on: %s" % ", ".join(pages))

if __name__ == "__main__":
    build()
    _synergy("stories/index.html", "latif.html", "stories/adl.html", "stories/ghaffar.html", "stories/hadi.html", "stories/jabbar.html", "stories/razzaq.html", "stories/sabur.html", "stories/shakur.html", "stories/wadud.html")
