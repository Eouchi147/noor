# NOOR v49 · one calm menu for the whole house
# Generates the canonical header (desktop mega + mobile sheet + language switcher)
# and swaps it into every content page. Idempotent.
import re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TOP = [
    ("quran.html", "nav.quran", "Qur'an"),
    ("prophets.html", "nav.prophets", "Prophets"),
    ("hajj.html", "nav.hajj", "Hajj"),
    ("madrasa.html", "nav.madrasa", "Madrasa"),
    ("kids.html", "nav.kids", "Kids"),
]

# ---------------------------------------------------------------------------
# The library, arranged by what a reader is actually trying to do.
#
# The old arrangement was five headings and thirty eight links, all visible at
# once. Every one of them was a good room, and the effect of showing them
# together was that the owner of the site could not find his own work. Volume
# was the problem, not the labels.
#
# So the menu now answers a question before it offers a list. Six doors, each
# named for an intent rather than for a category:
#
#   READ    the text itself, and the words needed to hold it
#   LEARN   what to believe and how to pray it
#   LIVE    the practice as it meets an ordinary week
#   STORY   where all of it came from, and where it is going
#   LITTLE  the rooms built for children
#   HOUSE   the building itself: its tools, its keeper, its terms
#
# And above the doors, PINNED, sit the five rooms most people actually came
# for. The common case now costs no taps at all; the uncommon case costs one.
# ---------------------------------------------------------------------------

PINNED = [
    ("quran.html", "p.quran", "The Mushaf"),
    ("good-life.html", "p.goodlife", "How to Live Well"),
    ("prophets.html", "p.prophets", "The 25 Prophets"),
    ("pillars.html", "p.pillars", "The Five Pillars"),
    ("stories/", "p.stories", "The Hall of Stories"),
]

GROUPS = [
    ("g.read", "Read", [
        ("quran.html", "m.quran", "The Mushaf &middot; Study the Qur'an"),
        ("words.html", "m.words", "The Words of the Path"),
        ("dictionary.html", "m.dictionary", "The Encyclopedia of the Path"),
        ("arabic.html", "m.arabic", "Learn Arabic &middot; The Letters"),
    ]),
    ("g.learn", "Learn", [
        ("begin.html", "m.begin", "Begin &middot; New Muslim"),
        ("pillars.html", "m.pillars", "The Five Pillars"),
        ("theology.html", "m.theology", "Theology &middot; The Branches"),
        ("allah.html", "m.allah", "The Ninety-Nine Names"),
        ("madrasa.html", "m.madrasa", "The Classroom &middot; Madrasa"),
        ("school.html", "m.school", "The School &middot; Full Curriculum"),
    ]),
    ("g.live", "Live", [
        ("good-life.html", "m.goodlife", "How to Live a Good Life"),
        ("three-lives.html", "m.threelives", "Three Lives &middot; Weigh Your Own"),
        ("health.html", "m.health", "Prophetic Health"),
        ("family.html", "m.family", "The Family Room"),
        ("marriage.html", "m.marriage", "Marriage &amp; the Home"),
        ("teens.html", "m.teens", "For Teenagers"),
        ("protection.html", "m.protection", "Protection &amp; the Light"),
        ("ramadan.html", "m.ramadan", "Ramadan"),
        ("eid.html", "m.eid", "The Two Eids"),
        ("hajj.html", "m.hajj", "Hajj &amp; Umrah"),
        ("hajj-plan.html", "m.hajjplan", "Your Pilgrim Plan"),
    ]),
    ("g.story", "The Story", [
        ("index.html#timeline", "m.path", "The Path of Creation"),
        ("prophets.html", "m.prophets", "The 25 Prophets"),
        ("muhammad.html", "m.seerah", "The Seerah &middot; Twenty-Three Years"),
        ("companions.html", "m.companions", "The Companions"),
        ("characters.html", "m.characters", "Characters"),
        ("places.html", "m.places", "Places"),
        ("heroes.html", "m.heroes", "Heroes of Islam"),
        ("sermon.html", "m.sermon", "The Last Sermon"),
        ("unseen.html", "m.unseen", "The Unseen &amp; the Mysteries"),
        ("soul.html", "m.soul", "The Journey of the Soul"),
        ("index.html#mizan", "m.mizan", "Two Lives"),
        ("simulation.html", "m.simulation", "Are We in a Simulation?"),
    ]),
    ("g.little", "Little Ones", [
        ("stories/", "m.stories", "The Hall of Stories"),
        ("kids.html", "m.kidscodex", "The Kids' Codex"),
        ("kids/lanterns.html", "m.lanterns", "The Lantern Sky"),
    ]),
    ("g.house", "The House", [
        ("masjid/", "m.masjid", "The Masjid Toolbox"),
        ("license.html", "m.orgs", "For Schools &amp; Organizations"),
        ("journal.html", "m.journal", "The Guardian's Journal"),
        ("donate.html", "m.give", "Give a Gift"),
        ("feedback.html", "m.feedback", "Corrections &amp; Ideas"),
        ("legal.html", "m.legal", "Terms &amp; Transparency"),
    ]),
]

LANGS = [
    ("en", "English"), ("ar", "العربية"), ("fr", "Français"), ("es", "Español"),
    ("de", "Deutsch"), ("ru", "Русский"), ("tr", "Türkçe"), ("ur", "اردو"),
    ("hi", "हिन्दी"), ("bn", "বাংলা"), ("id", "Bahasa Indonesia"), ("fa", "فارسی"),
    ("prs", "دری"), ("pa", "پنجابی"), ("ha", "Hausa"), ("ps", "پښتو"),
    ("so", "Soomaali"), ("ku", "Kurdî"), ("sw", "Kiswahili"),
    ("zh", "中文"), ("ja", "日本語"), ("ko", "한국어"),
]

STYLE = """<style id="nav49">
/* --- self-contained header layout (works with or without the shared sheet) --- */
/* While the sheet is open the body carries overflow:hidden, and on iOS that
   quietly breaks position:sticky: the header stops sticking and scrolls away,
   leaving page content in the strip above the menu and no way to close it
   without scrolling back to the top. Pinning it for the duration fixes that.
   The swap is invisible because at any scroll position a sticky header and a
   fixed one both render at the top of the viewport, and everything behind is
   covered by the sheet. */
body.sheet-open #site-header{position:fixed;left:0;right:0;top:0;z-index:70}
#site-header{position:sticky;top:0;z-index:40;background:rgba(255,254,247,.9);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid rgba(44,36,22,.05);font-family:Inter,system-ui,sans-serif}
#site-header>div:not(#nav-sheet):not(#search-bar){max-width:72rem;margin-left:auto;margin-right:auto;padding-inline-start:1rem;padding-inline-end:1rem;height:3.5rem;display:flex;align-items:center;justify-content:space-between;gap:.75rem}
@media (min-width:640px){#site-header>div:not(#nav-sheet):not(#search-bar){padding-inline-start:1.5rem;padding-inline-end:1.5rem}}
#site-header a{text-decoration:none;color:inherit}
#site-header>div>a:first-child{display:flex;align-items:center;gap:.625rem}
#site-header>div>a:first-child>div:first-child{width:2rem;height:2rem;border-radius:9999px;background:#2C2416;color:#C9A227;display:flex;align-items:center;justify-content:center;font-family:Amiri,serif;font-size:1rem;font-weight:700;box-shadow:0 0 0 1px rgba(201,162,39,.4);flex:none}
#site-header>div>a:first-child>div:last-child>div:first-child{font-family:Amiri,serif;font-size:1.125rem;line-height:1;color:#2C2416}
#site-header>div>a:first-child>div:last-child>div:last-child{font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:rgba(44,36,22,.45)}
#site-header nav[aria-label="Primary"]{display:none;align-items:center;gap:1rem;font-size:.875rem;font-weight:500;color:rgba(44,36,22,.65)}
@media (min-width:1024px){#site-header nav[aria-label="Primary"]{display:flex}}
#site-header nav[aria-label="Primary"] a{color:inherit;transition:color .15s}
#site-header nav[aria-label="Primary"] a:hover{color:#2C2416}
#site-header nav[aria-label="Primary"] a.text-ink{color:#2C2416;font-weight:700}
#site-header>div>div:last-child{display:flex;align-items:center;gap:.5rem}
#site-header .give-pill{display:none}
@media (min-width:640px){#site-header .give-pill{display:inline-block}}
.dd{position:relative}
.dd-btn{display:inline-flex;align-items:center;gap:.3rem;cursor:pointer;background:none;border:0;font:inherit;color:inherit;padding:0}
.dd-btn::after{content:"";width:.42rem;height:.42rem;border-inline-end:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg) translateY(-1px);transition:transform .25s}
.dd:hover .dd-btn::after,.dd:focus-within .dd-btn::after{transform:rotate(225deg) translateY(-2px)}
.dd-mega{position:absolute;right:0;top:100%;padding-top:.65rem;display:none;z-index:70;width:min(46rem,calc(100vw - 2rem))}
.dd:hover .dd-mega,.dd:focus-within .dd-mega{display:block}
.dd-mega .mp{display:grid;grid-template-columns:repeat(4,1fr);gap:.3rem 1.1rem;background:#fff;border:1px solid rgba(44,36,22,.1);border-radius:1.25rem;box-shadow:0 28px 64px rgba(44,36,22,.22);padding:1.05rem 1.15rem 1.15rem}
@media (max-width:1200px){.dd-mega{width:min(31rem,calc(100vw - 2rem))}.dd-mega .mp{grid-template-columns:1fr 1fr}}
.dd-mega .mg{min-width:0}
.dd-mega .dd-h{font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;color:#C9A227;font-weight:800;padding:.4rem .45rem .25rem;border-bottom:1px solid rgba(201,162,39,.22);margin-bottom:.25rem}
.dd-mega .dd-h + .dd-h{margin-top:.8rem}
.dd-mega a{display:block;padding:.32rem .45rem;font-size:.8rem;color:rgba(44,36,22,.75);text-decoration:none;border-radius:.55rem;line-height:1.4}
.dd-mega a:hover{background:#FFF7DF;color:#2C2416}
.dd-mega a.mg-give{color:#8a6d13;font-weight:700}
.give-pill{background:linear-gradient(135deg,#C9A227,#E9C86A);color:#1A160F!important;font-weight:800;border-radius:999px;padding:.38rem .95rem;font-size:.78rem;text-decoration:none;transition:transform .15s;white-space:nowrap}
.give-pill:hover{transform:translateY(-1px)}
.lang-dd .dd-menu49{position:absolute;right:0;top:100%;padding-top:.6rem;display:none;z-index:75}
.lang-dd:hover .dd-menu49,.lang-dd:focus-within .dd-menu49{display:block}
.lang-pane{background:#fff;border:1px solid rgba(44,36,22,.12);border-radius:1rem;box-shadow:0 24px 56px rgba(44,36,22,.22);padding:.8rem;width:19rem;max-height:min(70vh,26rem);overflow:auto}
.lang-pane .lp-h{font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:#C9A227;font-weight:800;padding:0 .3rem .45rem}
.lang-grid{display:grid;grid-template-columns:1fr 1fr;gap:.25rem}
.lang-grid button{display:flex;align-items:center;justify-content:space-between;gap:.4rem;background:none;border:1px solid transparent;border-radius:.6rem;padding:.34rem .55rem;font-size:.78rem;color:rgba(44,36,22,.8);cursor:pointer;font-family:inherit;text-align:start}
.lang-grid button:hover{background:#FFF7DF;color:#2C2416}
.lang-grid button.on{border-color:rgba(201,162,39,.55);background:rgba(244,212,106,.14);color:#2C2416;font-weight:700}
.lang-grid button.on::after{content:"✓";color:#C9A227;font-weight:800}
.lang-note{font-size:.64rem;color:rgba(44,36,22,.5);line-height:1.55;padding:.55rem .3rem 0}
.lang-chip{display:inline-flex;align-items:center;gap:.35rem;border:1px solid rgba(44,36,22,.15);border-radius:999px;padding:.3rem .6rem;font-size:.68rem;font-weight:700;color:rgba(44,36,22,.7);background:none;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:.04em}
.lang-chip:hover{border-color:rgba(201,162,39,.5);color:#2C2416}
#nav-burger{display:none;background:none;border:0;cursor:pointer;padding-block:.45rem .45rem;padding-inline:.45rem .2rem}
#nav-burger span{display:block;width:1.15rem;height:2px;background:rgba(44,36,22,.75);border-radius:2px;margin:4px 0;transition:transform .3s,opacity .3s}
@media (max-width:1023.5px){#nav-burger{display:block}}
body.sheet-open #nav-burger span:nth-child(1){transform:translateY(6px) rotate(45deg)}
body.sheet-open #nav-burger span:nth-child(2){opacity:0}
body.sheet-open #nav-burger span:nth-child(3){transform:translateY(-6px) rotate(-45deg)}
#nav-sheet{position:fixed;left:0;right:0;top:calc(3.5rem + var(--safetop,0px));bottom:0;z-index:60;background:#FFFEF7;overflow:auto;padding:1.1rem 1.25rem 4rem;display:none}
body.sheet-open #nav-sheet{display:block}
body.sheet-open{overflow:hidden}
/* Installed to a home screen there is no browser chrome above the page, so the
   header sits under the clock and the signal bars. Scoped to standalone on
   purpose: in an ordinary mobile browser the chrome already holds this space
   and adding the inset there would push the header down for no reason. */
:root{--safetop:0px}
@media (display-mode:standalone),(display-mode:fullscreen){
  :root{--safetop:env(safe-area-inset-top,0px)}
  #site-header{padding-top:env(safe-area-inset-top,0px)}
}
html.standalone{--safetop:env(safe-area-inset-top,0px)}
html.standalone #site-header{padding-top:env(safe-area-inset-top,0px)}
/* ---- the pinned strip -------------------------------------------------
   Five rooms, two across, sitting above everything else. This is the whole
   point of the redesign: the common case is answered before the reader has
   to choose anything. */
#nav-sheet .pins{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin:.35rem 0 .4rem}
#nav-sheet .pin{display:flex;align-items:center;justify-content:center;text-align:center;
  min-height:3.4rem;padding:.6rem .7rem;border:1px solid rgba(201,162,39,.4);
  background:linear-gradient(160deg,#FFFDF4,#FFF6E2);border-radius:14px;
  font-size:.8rem;font-weight:800;color:#2C2416;text-decoration:none;line-height:1.35}
#nav-sheet .pin:active{background:#FFF1CE}
#nav-sheet .pin:first-child{grid-column:1 / -1}

/* ---- the doors ---------------------------------------------------------
   <details> rather than a script: they open with JavaScript unavailable, and
   a screen reader already knows what a disclosure is. */
#nav-sheet .door{border-bottom:1px solid rgba(201,162,39,.18)}
#nav-sheet .door summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:.5rem;
  padding:.85rem .1rem;font-size:.95rem;font-weight:800;color:#2C2416;
  font-family:Inter,system-ui,sans-serif}
#nav-sheet .door summary::-webkit-details-marker{display:none}
#nav-sheet .door summary::after{content:"";margin-inline-start:auto;width:.5rem;height:.5rem;flex:none;
  border-inline-end:2px solid #C9A227;border-block-end:2px solid #C9A227;
  transform:rotate(45deg);transition:transform .2s ease}
#nav-sheet .door[open] summary::after{transform:rotate(-135deg)}
#nav-sheet .door .cnt{font-size:.62rem;font-weight:700;color:rgba(44,36,22,.38);
  border:1px solid rgba(44,36,22,.14);border-radius:999px;padding:.05rem .4rem;line-height:1.6}
#nav-sheet .door-in{padding:0 0 .6rem}
/* Said explicitly rather than left to the browser: the sheet's own
   a.shl{display:block} was out-specifying the built-in hiding, so every
   door stood open and the redesign achieved nothing. */
#nav-sheet .door:not([open]) .door-in{display:none}
@media (prefers-reduced-motion:reduce){#nav-sheet .door summary::after{transition:none}}

#nav-sheet .sh-g{font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:#C9A227;font-weight:800;margin:1.15rem 0 .35rem;padding-bottom:.3rem;border-bottom:1px solid rgba(201,162,39,.22)}
#nav-sheet .sh-g:first-child{margin-top:.2rem}
#nav-sheet a.shl{display:block;padding:.5rem .15rem;font-size:.92rem;color:rgba(44,36,22,.8);text-decoration:none;border-radius:.5rem}
#nav-sheet a.shl:active{background:#FFF7DF}
#nav-sheet .lang-grid{grid-template-columns:1fr 1fr 1fr}
@media (max-width:480px){#nav-sheet .lang-grid{grid-template-columns:1fr 1fr}}
#nav-sheet .sh-give{display:block;text-align:center;margin:1.4rem auto 0;max-width:22rem;background:linear-gradient(135deg,#C9A227,#E9C86A);color:#1A160F;font-weight:800;border-radius:999px;padding:.7rem 1.2rem;text-decoration:none}

/* --- the search drawer -------------------------------------------------
   The magnifier at top right is the only search chrome the house shows.
   The panel is hard-hidden until it is opened, and it is a floating drawer,
   never a band across the page. These rules live in the generator so a nav
   rebuild can never strip them again. */
#search-bar{display:none}
#search-bar.open{display:block;position:fixed;top:3.5rem;right:1rem;z-index:72;width:min(26rem,calc(100vw - 2rem))}
@media (min-width:640px){#search-bar.open{right:1.5rem}}
body.sheet-open #search-bar{display:none}
#search-bar .sb-in{background:#FFFEF7;border:1px solid rgba(44,36,22,.14);border-radius:16px;box-shadow:0 20px 48px rgba(26,22,15,.18);padding:.5rem}
#search-bar input#search-input{display:block;width:100%;box-sizing:border-box;font:inherit;font-size:.9rem;line-height:1.4;color:#2C2416;background:#fff;border:1px solid rgba(44,36,22,.15);border-radius:11px;padding:.62rem .8rem;outline:0;-webkit-appearance:none;appearance:none}
#search-bar input#search-input::placeholder{color:rgba(44,36,22,.4)}
#search-bar input#search-input:focus{border-color:rgba(201,162,39,.8);box-shadow:0 0 0 3px rgba(201,162,39,.16)}
#search-bar #search-results{margin-top:.4rem;max-height:min(58vh,24rem);overflow:auto;background:transparent;border-radius:12px}
#search-bar #search-results.hidden{display:none}

/* --- the three new doors: let each system supply the face it renders best --- */
html[lang="zh"] body,html[lang="ja"] body,html[lang="ko"] body{font-family:Inter,system-ui,"PingFang SC","Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans CJK SC","Noto Sans CJK JP","Noto Sans CJK KR","Microsoft YaHei","Malgun Gothic","Apple SD Gothic Neo",sans-serif}
html[lang="zh"] .font-amiri,html[lang="ja"] .font-amiri,html[lang="ko"] .font-amiri{font-family:Amiri,serif}
html[lang="zh"] p,html[lang="ja"] p,html[lang="ko"] p{line-height:1.95}
html[lang="ja"] h1,html[lang="ja"] h2,html[lang="ja"] h3,html[lang="zh"] h1,html[lang="zh"] h2,html[lang="zh"] h3,html[lang="ko"] h1,html[lang="ko"] h2,html[lang="ko"] h3{letter-spacing:0}

/* --- paper ---------------------------------------------------------------
   Choreography must never cost a reader the words. Anything the motion
   layer is holding back is forced visible before it reaches a printer. */
@media print{
  #site-header,#nav-sheet,#search-bar{display:none!important}
  .mo,.mo-pop,.mo-draw,[data-mo-stagger] .mo,[data-mo-stagger] .mo-pop{
    opacity:1!important;visibility:visible!important;transform:none!important}
  .mo-draw path,.mo-draw line,.mo-draw circle,.mo-draw rect,.mo-draw polyline,.mo-draw ellipse{
    stroke-dasharray:none!important;stroke-dashoffset:0!important;opacity:1!important}
}
</style>"""


def nav_html(prefix, active):
    P = prefix

    def href(h):
        """Root-absolute, extension-free. Immune to whether a hub is served
        with or without a trailing slash, which silently broke relative links."""
        if h.startswith(("http", "mailto:", "#", "/")):
            return h
        path, _, frag = h.partition("#")
        path = path[:-5] if path.endswith(".html") else path
        if path.endswith("/index"):
            path = path[:-6]
        path = path.rstrip("/")
        if path in ("", "index"):
            path = ""
        return "/" + path + (("#" + frag) if frag else "")

    top = []
    for h, k, label in TOP:
        page = h.split("#")[0]
        cls = "text-ink font-bold" if page == active else "hover:text-ink transition-colors"
        top.append('<a href="%s" class="%s" data-i18n="%s">%s</a>' % (href(h), cls, k, label))

    cols = []
    # columns: groups 0,1,2 alone; groups 3+4 share the 4th column
    def group_html(gk, gtitle, items):
        out = ['<p class="dd-h" data-i18n="%s">%s</p>' % (gk, gtitle)]
        for h, k, label in items:
            extra = ' class="mg-give"' if k == "m.give" else ""
            out.append('<a role="menuitem" href="%s"%s data-i18n="%s">%s</a>' % (href(h), extra, k, label))
        return "\n".join(out)

    # Six doors into four columns: the two short ones pair up at each end, so
    # the columns stay close in height and nothing runs off the bottom.
    cols.append('<div class="mg">\n' + group_html(*GROUPS[0]) + "\n" + group_html(*GROUPS[1]) + "\n</div>")
    cols.append('<div class="mg">\n' + group_html(*GROUPS[2]) + "\n</div>")
    cols.append('<div class="mg">\n' + group_html(*GROUPS[3]) + "\n</div>")
    cols.append('<div class="mg">\n' + group_html(*GROUPS[4]) + "\n" + group_html(*GROUPS[5]) + "\n</div>")

    lang_buttons = "\n".join(
        '<button type="button" data-setlang="%s" lang="%s">%s</button>' % (c, c, n) for c, n in LANGS
    )

    # The sheet leads with the five rooms most people came for, then closes
    # everything else behind six doors. <details> is used rather than a script
    # so the doors still open with JavaScript unavailable and screen readers
    # already know what they are.
    pin_rows = "".join(
        '<a class="pin" href="%s" data-i18n="%s">%s</a>' % (href(h), k, label)
        for h, k, label in PINNED)
    sheet_groups = ['<p class="sh-g" data-i18n="g.pinned">Most opened</p>'
                    '<div class="pins">' + pin_rows + '</div>']
    for gk, gtitle, items in GROUPS:
        # the key sits on an inner span: the translator replaces the text of
        # whatever carries data-i18n, and on the summary itself that swallowed
        # the count along with it
        rows = ['<details class="door"><summary><span data-i18n="%s">%s</span>'
                '<span class="cnt">%d</span></summary><div class="door-in">' % (gk, gtitle, len(items))]
        for h, k, label in items:
            rows.append('<a class="shl" href="%s" data-i18n="%s">%s</a>' % (href(h), k, label))
        rows.append("</div></details>")
        sheet_groups.append("\n".join(rows))

    return """<header id="site-header" class="sticky top-0 z-40 bg-parchment/90 backdrop-blur-md border-b border-ink/5">
<!-- The menu is the shell's now. noor-fx.js draws the bar on every page in the
     house and its Search opens assets/noor-search.js, so the two files this
     header used to link -- assets/noor-menu.css and assets/noor-menu.js -- have
     not been on a page for months. They were still being written here, and
     still being uploaded to the deployment. Both are gone from the build; the
     tags go with them, so re-running this generator cannot resurrect a pair of
     404s. -->
%s
<div class="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
<a href="/" class="flex items-center gap-2.5">
<div class="w-8 h-8 rounded-full bg-ink flex items-center justify-center text-gold font-amiri text-base font-bold ring-1 ring-gold/40">ن</div>
<div><div class="font-amiri text-lg leading-none text-ink">نُور</div><div class="text-[9px] tracking-[.22em] uppercase text-ink/45">Codex of Light</div></div>
</a>
<nav class="hidden lg:flex items-center gap-4 text-sm font-medium text-ink/65" aria-label="Primary">
%s
<div class="dd"><button class="dd-btn hover:text-ink" aria-haspopup="menu" data-i18n="nav.library">Library</button>
<div class="dd-mega" role="menu" aria-label="The Library"><div class="mp">
%s
</div></div></div>
</nav>
<div class="flex items-center gap-2">
<div class="dd lang-dd"><button class="lang-chip" id="lang-btn" aria-haspopup="menu" aria-label="Choose your language"><span data-ic=globe></span><span id="lang-cur">EN</span></button>
<div class="dd-menu49"><div class="lang-pane">
<p class="lp-h" data-i18n="lang.choose">Choose your language</p>
<div class="lang-grid" id="lang-grid">
%s
</div>
<p class="lang-note" data-i18n="lang.note">The Codex answers in your language. The deepest rooms are still being carried over, wave by wave; what is not yet carried stays in English.</p>
</div></div></div>
<a href="/donate" class="give-pill hidden sm:inline-block">✦ <span data-i18n="nav.give">Give</span></a>
<a id="search-toggle" data-nm-open href="/#search" aria-label="Search the library" title="Search the library" class="lang-chip" style="padding:.3rem .55rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="width:.82rem;height:.82rem"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></a>
<button id="nav-burger" type="button" aria-label="Menu" aria-expanded="false" aria-controls="nav-sheet"><span></span><span></span><span></span></button>
</div>
</div>
</header>
<div id="nav-sheet" role="dialog" aria-label="Menu">
%s
<p class="sh-g" data-i18n="lang.choose">Choose your language</p>
<div class="lang-grid">
%s
</div>
<p class="lang-note" data-i18n="lang.note">The Codex answers in your language. The deepest rooms are still being carried over, wave by wave; what is not yet carried stays in English.</p>
<a class="sh-give" href="/donate">✦ <span data-i18n="m.give">Give a Gift</span></a>
</div>""" % (STYLE, "\n".join(top), "\n".join(cols), lang_buttons, "\n".join(sheet_groups), lang_buttons)


HEADER_RE = re.compile(r"<header id=\"site-header\"[\s\S]*?</header>|<header class=\"sticky top-0 z-40 bg-parchment/90 backdrop-blur(?:-md)? border-b border-ink/(?:5|8)\">[\s\S]*?</header>")

# Pages that keep a header of their own by design and must never be rewritten.
OWN_HEADER = {"kids.html"}


def _strip_sheets(s):
    """Remove every <div id="nav-sheet"> block, balanced. Running the generator
    twice used to leave a second sheet behind; six had piled up before this."""
    n = 0
    while True:
        i = s.find('<div id="nav-sheet"')
        if i < 0:
            break
        j, depth = i, 0
        while j < len(s):
            if s.startswith("<div", j):
                depth += 1; j += 4
            elif s.startswith("</div>", j):
                depth -= 1; j += 6
                if depth == 0:
                    break
            else:
                j += 1
        s = s[:i] + s[j:]; n += 1
    return s, n


def _pages():
    out = []
    for f in sorted(os.listdir(ROOT)):
        if f.endswith(".html") and f not in OWN_HEADER:
            out.append(f)
    for sub in ("stories", "masjid"):
        d = os.path.join(ROOT, sub)
        if os.path.isdir(d):
            out += [sub + "/" + f for f in sorted(os.listdir(d)) if f.endswith(".html")]
    return out


def apply_all():
    changed, skipped = [], []
    for rel in _pages():
        path = os.path.join(ROOT, rel)
        s = open(path, encoding="utf-8").read()
        if 'id="site-header"' not in s:
            skipped.append(rel); continue
        m = HEADER_RE.search(s)
        if not m:
            print("!! no header match:", rel); continue
        s2 = s[:m.start()] + "\x00NAV\x00" + s[m.end():]
        s2, nsheets = _strip_sheets(s2)
        s2 = s2.replace("\x00NAV\x00", nav_html("", os.path.basename(rel)), 1)
        if s2 != s:
            open(path, "w", encoding="utf-8").write(s2)
            changed.append((rel, nsheets))
    print("updated: %d  (skipped %d with no shared header)" % (len(changed), len(skipped)))
    for rel, n in changed:
        if n != 1:
            print("   %s: removed %d stale sheet(s)" % (rel, n))


if __name__ == "__main__":
    apply_all()
