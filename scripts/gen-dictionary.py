#!/usr/bin/env python3
# NOOR · The Encyclopedia of the Path
# Builds /dictionary.html and the 523 word pages under /dictionary/ from
# build/dict-*.json, both in the second cut's shell (assets/noor2.css and
# assets/noor2.js, the same files api/page.js links): the night, one idea per
# screen, the five doors under the thumb. A reader who does not know a word
# must be able to type it, half spelled, in any of its transliterations, and
# land on the meaning in one motion; a stranger who arrives from a reel must
# meet the word, its Arabic and its meaning on the first screen, and nothing
# else. Every fact on a page is the entry's own text: the Arabic, the term,
# the spellings, the two definitions, the level of evidence, the neighbours
# the editors named. Nothing is added to it here.
import json, os, re, glob, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

OUT = os.path.join(ROOT, "dictionary.html")
SITE = "https://noorcodex.com"
OG = SITE + "/assets/brand/og.png"
V = "2"                                   # the shell's cache-buster; api/page.js carries the same
CATS = [("aqidah", "Belief", "العَقِيدَة"), ("ibadah", "Worship", "العِبَادَة"),
        ("quran", "The Qur’an", "القُرْآن"), ("hadith", "Hadith", "الحَدِيث"),
        ("fiqh", "Law & life", "الفِقْه"), ("tazkiyah", "The heart", "التَّزْكِيَة"),
        ("tarikh", "History", "التَّارِيخ")]
CATNAME = {c: n for c, n, _ in CATS}
CATAR = {c: a for c, _, a in CATS}
LEVELS = {"quran": ("Qur’an", "Stated directly in the Qur’an"),
          "sunnah": ("Sunnah", "Established in the authentic Sunnah"),
          "debated": ("Scholars differ", "The scholars read this one differently"),
          "editorial": ("Editorial", "Our own summary, drawn from the sources named")}


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))


def fold(s):
    """Every spelling a reader might use, down to one shape: no case, no
       apostrophes, no diacritics, no dashes. "Qadhar" == "qadar"."""
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = re.sub(r"[\u0300-\u036f]", "", s)
    s = re.sub(r"[’'ʻʼ`]", "", s)
    s = re.sub(r"[^a-z0-9\u0600-\u06ff]+", " ", s)
    return s.strip()


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



# ---------------------------------------------------------------------------
# THE SHELL
#
# The same frame api/page.js renders for a Light, a verse or a chapter, written
# here in Python so a static page and a served room are one thing: the head a
# crawler and a messaging app read, the top line, the main, the footer line,
# the bar of five doors. Nothing of the shell's CSS is pasted: the two files
# are linked with the version the rooms link, so a change to the shell reaches
# the encyclopedia the same hour it reaches everything else.
# ---------------------------------------------------------------------------
BAR = [
    ("Today", "/today", '<circle cx="12" cy="12" r="3.6"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>'),
    ("Qur'an", "/quran", '<path d="M12 6.4C10.4 4.9 8 4.4 3 4.7v13.8c5-.3 7.4.2 9 1.8 1.6-1.6 4-2.1 9-1.8V4.7c-5-.3-7.4.2-9 1.7z"/><path d="M12 6.4v13.9"/>'),
    ("Story", "/path", '<path d="M4.5 19.5c6.5 0 3.5-9 8-9s2-6 7-6"/><circle cx="4.5" cy="19.5" r="1.6"/><circle cx="19.5" cy="4.5" r="1.6"/>'),
    ("Words", "/dictionary", '<path d="M4 18h16M4 6h16M4 12h10"/>'),
    ("Search", "/dictionary", '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.3-4.3"/>'),
]
SVG_SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/></svg>'
SVG_RIGHT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
SVG_FIND = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.3-4.3"/></svg>'
FOOT = ('<footer class="n2-foot">NOOR Codex of Light · free, no ads, no account · '
        '<a href="/">the library</a> · <a href="/legal">legal</a></footer>')


def jsonld(obj):
    return ('<script type="application/ld+json">%s</script>'
            % json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c"))


def go(href, label, gold=False):
    """A door. The gold one is the one thing to press on its screen, and it
       breathes; a screen never carries two."""
    return '<a class="n2-btn%s" href="%s">%s %s</a>' % (" n2-gold n2-glow" if gold else "", esc(href), esc(label), SVG_RIGHT)


def share_btn(text, url):
    return ('<button class="n2-btn" type="button" data-n2-share="%s" data-n2-url="%s">Share %s</button>'
            % (esc(text), esc(url), SVG_SHARE))


def shell(title, path, desc, body, mode="", active="", pill=None, ld=None, og_type="article",
          scripts="", style="", tail=""):
    """title is the page's own; ' · NOOR Codex of Light' is added. path is the
       address under the site; the canonical is built from it, nothing else."""
    canonical = SITE + path
    doors = "".join(
        '<a href="%s"%s%s><svg viewBox="0 0 24 24" aria-hidden="true">%s</svg>%s</a>'
        % (href, " data-n2-search data-nm-open" if name == "Search" else "",
           ' class="n2-on"' if href == active and name != "Search" else "", icon, esc(name))
        for name, href, icon in BAR)
    return (
        '<!DOCTYPE html>\n<html lang="en" dir="ltr" data-n2="%s">\n<head>\n<meta charset="utf-8"/>\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>\n'
        '<title>%s · NOOR Codex of Light</title>\n'
        '<meta name="description" content="%s"/>\n'
        '<link rel="canonical" href="%s"/>\n'
        '<meta name="theme-color" content="#04060F"/>\n'
        '<meta property="og:type" content="%s"/>\n'
        '<meta property="og:site_name" content="NOOR Codex of Light"/>\n'
        '<meta property="og:title" content="%s"/>\n'
        '<meta property="og:description" content="%s"/>\n'
        '<meta property="og:url" content="%s"/>\n'
        '<meta property="og:image" content="%s"/>\n'
        '<meta name="twitter:card" content="summary_large_image"/>\n'
        '<meta name="twitter:title" content="%s"/>\n'
        '<meta name="twitter:description" content="%s"/>\n'
        '<meta name="twitter:image" content="%s"/>\n'
        '<link rel="icon" type="image/svg+xml" href="/assets/brand/mark.svg"/>\n'
        '<link rel="icon" href="/assets/brand/mark-32.png" sizes="32x32"/>\n'
        '<link rel="apple-touch-icon" href="/assets/brand/mark-180.png"/>\n'
        '<link rel="manifest" href="/manifest.webmanifest"/>\n'
        '<link rel="preconnect" href="https://fonts.googleapis.com"/>\n'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>\n'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Amiri+Quran&family=Inter:wght@400;500;600;800&family=IBM+Plex+Mono:wght@400;500&display=swap"/>\n'
        '<link rel="stylesheet" href="/assets/noor2.css?v=%s"/>\n'
        '<script src="/assets/noor2.js?v=%s" defer></script>\n'
        '<script src="/noor-fx.js" defer></script>\n'
        '%s%s%s'
        '</head>\n<body>\n'
        '<div class="n2-still"></div>\n<i class="n2-prog" aria-hidden="true"></i>\n'
        '<header class="n2-top">\n'
        '<a class="n2-brand" href="/"><span class="n2-ar" lang="ar" translate="no">نُور</span><span class="n2-en">Codex of Light</span></a>\n'
        '%s</header>\n'
        '<main class="n2-main">\n%s\n</main>\n'
        '%s\n'
        '<nav class="n2-bar" aria-label="Rooms"><i class="n2-pill-bg" aria-hidden="true"></i>%s</nav>\n'
        '%s</body>\n</html>\n'
    ) % (esc(mode), esc(title), esc(desc), esc(canonical), esc(og_type), esc(title), esc(desc), esc(canonical), OG,
         esc(title), esc(desc), OG, V, V,
         scripts, (jsonld(ld) + "\n") if ld else "", ("<style>%s</style>\n" % style) if style else "",
         ('<a class="n2-pill" href="%s">%s</a>\n' % (esc(pill[0]), esc(pill[1]))) if pill else "",
         body, FOOT, doors, tail)


# ---------------------------------------------------------------------------
# THE SHELF: the verses a word page may point at
#
# A word page offers a door to a verse only when the repository's own data
# names the word: the label an editor wrote beside a reference in
# tools/reels/verses.txt ("of the Qur'an, that which is healing and mercy"),
# or the hook and caption of a rendered verse reel in reels/index.json when
# that manifest is present. The match is the term itself, whole and as
# written (apostrophe included, case aside): "Ba'th" does not become "bath",
# so a verse about a cool bath is never offered as a verse about the
# resurrection. Neither the id nor the alternate spellings are used: the id
# is the term with its apostrophe lost, and "will", "say" and "eyes" are
# spellings in this book, and every one of them is also an English word.
# ---------------------------------------------------------------------------
def shelf_verses():
    rows, seen = [], set()

    def add(ref, text):
        m = re.match(r"^(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$", ref or "")
        if not m or ref in seen or not (text or "").strip():
            return
        seen.add(ref)
        rows.append({"ref": ref, "id": m.group(1) + "-" + m.group(2) + (("-" + m.group(3)) if m.group(3) else ""),
                     "text": re.sub(r"\s+", " ", text).strip()})

    man = os.path.join(ROOT, "reels", "index.json")
    if os.path.exists(man):
        try:
            for r in (json.load(open(man, encoding="utf-8")).get("cards") or []):
                if not isinstance(r, dict) or r.get("kind") != "verse":
                    continue
                ref = re.sub(r"^(\d+)-", r"\1:", re.sub(r"^verse-", "", str(r.get("id", ""))))
                add(ref, " ".join(str(r.get(k) or "") for k in ("hook", "caption")))
        except Exception as e:
            print("  ! reels/index.json not read: %s" % e)
    txt = os.path.join(ROOT, "tools", "reels", "verses.txt")
    if os.path.exists(txt):
        for line in open(txt, encoding="utf-8"):
            if "#" not in line:
                continue
            ref, label = line.split("#", 1)
            add(ref.strip(), label)
    return rows


def verses_for(e, shelf, limit=6):
    key = e["term"].lower().replace("’", "'").strip()
    if len(key) < 3:
        return []
    out = []
    for r in shelf:
        hay = " " + re.sub(r"[^a-z0-9'\- ]+", " ", r["text"].lower().replace("’", "'")) + " "
        if (" " + key + " ") in hay:
            out.append(r)
            if len(out) == limit:
                break
    return out


# ---------------------------------------------------------------------------
# THE HUB: /dictionary
#
# One screen of introduction with the field, then the words as rows grouped by
# domain, then the rooms behind them. The old hub carried every long
# definition and a megabyte of markup; the definitions live on the word pages
# now, and the hub is the finder. The finder is a small script below: it
# narrows the rows as the reader types, in any spelling the book knows, and
# still answers #id, ?w=id and #q=word, which the daily posts and the other
# rooms have always used. The whole library's search is one door away, in
# the bar and beside the field, exactly as the home page wires it.
# ---------------------------------------------------------------------------
HUB_STYLE = (
    ".dq{display:flex;align-items:center;gap:10px;min-height:50px;padding:0 16px;border:1px solid var(--n2-line);"
    "border-radius:999px;background:rgba(255,254,247,.06);margin:0 0 10px;transition:border-color .25s var(--n2-ease)}"
    ".dq:focus-within{border-color:rgba(233,200,106,.4)}"
    ".dq svg{width:18px;height:18px;stroke:var(--n2-goldhi);fill:none;stroke-width:2;stroke-linecap:round;flex:none}"
    ".dq input{flex:1;min-width:0;border:0;outline:0;background:none;color:var(--n2-parch);font:500 16px/1.2 var(--n2-sans)}"
    ".dq input::placeholder{color:var(--n2-parch3)}.dq input::-webkit-search-cancel-button{display:none}"
    ".dq button{border:0;background:none;color:var(--n2-parch3);font:20px/1 var(--n2-sans);min-width:32px;min-height:32px;cursor:pointer}"
    ".dq button[hidden]{display:none}"
    ".n2-group[hidden]{display:none}.n2-list li.hit b{color:var(--n2-goldhi)}"
    ".n2-h3 .n2-ar{font-family:var(--n2-ar);font-weight:400;color:var(--n2-goldhi);margin-left:6px}"
    "@media (prefers-reduced-motion:reduce){.dq{transition:none}}"
)

HUB_JS = """<script>
(function(){
  "use strict";
  var q=document.getElementById("dq"),clear=document.getElementById("dclear"),count=document.getElementById("dcount"),
      none=document.getElementById("dnone"),site=document.getElementById("dsite");
  if(!q)return;
  function fold(s){return (s||"").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"")
    .replace(/['\\u2019\\u02bb\\u02bc`]/g,"").replace(/[^a-z0-9\\u0600-\\u06ff ]+/g," ").replace(/\\s+/g," ").trim();}
  var rows=[].map.call(document.querySelectorAll(".n2-list li[data-k]"),function(li){
    var b=li.querySelector("b"),s=li.querySelector("small"),ar=li.querySelector(".n2-ar");
    return {el:li,t:fold(b.firstChild.nodeValue),l:li.getAttribute("data-k").split("|"),a:ar?ar.textContent:"",s:fold(s?s.textContent:"")};});
  var groups=[].slice.call(document.querySelectorAll(".n2-group")),total=rows.length,raf=0,byId={};
  rows.forEach(function(r){byId[r.el.id]=r;});
  function score(r,n){
    if(r.t===n)return 100; if(r.l.indexOf(n)>=0)return 92; if(r.t.indexOf(n)===0)return 80;
    for(var i=0;i<r.l.length;i++)if(r.l[i].indexOf(n)===0)return 72;
    if(r.a&&r.a.indexOf(n)>=0)return 70; if(r.t.indexOf(n)>=0)return 55;
    for(var j=0;j<r.l.length;j++)if(r.l[j].indexOf(n)>=0)return 48;
    if((" "+r.s).indexOf(" "+n)>=0)return 30; if(r.s.indexOf(n)>=0)return 14; return 0;}
  function run(){
    raf=0; var n=fold(q.value),shown=0,best=null,bs=0;
    rows.forEach(function(r){var ok=true;if(n){var s=score(r,n);ok=s>0;if(s>bs){bs=s;best=r;}}
      r.el.hidden=!ok;r.el.classList.remove("hit");if(ok)shown++;});
    groups.forEach(function(g){var k=g.querySelectorAll(".n2-list li:not([hidden])").length,c=g.querySelector(".n2-h3 .n2-g");
      g.hidden=!k; if(c)c.textContent="\u00b7 "+(n?k:g.querySelectorAll(".n2-list li").length);});
    count.textContent=shown===total?total+" words":shown+(shown===1?" word":" words");
    none.hidden=shown>0; clear.hidden=!q.value;
    if(n&&best&&bs>=72)best.el.classList.add("hit");}
  function queue(){if(!raf)raf=requestAnimationFrame(run);}
  q.addEventListener("input",queue);
  clear.addEventListener("click",function(){q.value="";run();q.focus();});
  q.addEventListener("keydown",function(e){
    if(e.key==="Escape"){q.value="";run();q.blur();}
    else if(e.key==="Enter"){var b=document.querySelector(".n2-list li.hit a")||document.querySelector(".n2-list li:not([hidden]) a");if(b)location.href=b.href;}});
  /* the whole library's search, beside the field; without the script a link */
  if(site)site.addEventListener("click",function(e){if(window.NOOR_SEARCH&&NOOR_SEARCH.open){e.preventDefault();NOOR_SEARCH.open();}});
  /* arriving from a link or a post: #id, ?w=id (a caption mangles a fragment
     into a hashtag, so the daily word links with a query), or #q=spelling */
  function land(){
    var h=(location.hash||"").replace(/^#/,"");
    if(!h){try{h=new URLSearchParams(location.search).get("w")||"";}catch(e){}}
    if(!h)return;
    var r=byId[h];
    if(r){q.value="";run();r.el.classList.add("hit");setTimeout(function(){r.el.scrollIntoView({behavior:"smooth",block:"center"});},150);return;}
    var m=h.match(/^q=(.*)$/);
    if(m){try{q.value=decodeURIComponent(m[1]);}catch(e){q.value=m[1];}run();
      setTimeout(function(){var b=document.querySelector(".n2-list li.hit");if(b)b.scrollIntoView({behavior:"smooth",block:"center"});},160);}}
  addEventListener("hashchange",land); land();
})();
</script>"""


def build():
    D = load()
    counts = {c: sum(1 for e in D if e["cat"] == c) for c, _, _ in CATS}
    print("dictionary: %d entries · %s" % (len(D), " · ".join("%s %d" % (c, counts[c]) for c, _, _ in CATS)))
    shelf = shelf_verses()

    main = []
    main.append(
        '<section class="n2-idea n2-short n2-in" id="top">\n'
        '<p class="n2-eyebrow">The words <small>· %d</small></p>\n'
        '<h1 class="n2-h1">The Encyclopedia <span class="n2-g">of the Path</span></h1>\n'
        '<p class="n2-p">Every word this library uses, defined plainly. Any spelling, in any transliteration, '
        'finds the meaning, with its evidence beside it. %d words, and it grows whenever a reader says one was missing.</p>\n'
        '<label class="dq">%s<input id="dq" type="search" autocomplete="off" spellcheck="false" enterkeyhint="go" '
        'placeholder="Type a word: qadr, ihram, riba" aria-label="Search the encyclopedia"/>'
        '<button type="button" id="dclear" aria-label="Clear" hidden>×</button></label>\n'
        '<p class="n2-src" id="dcount">%d words</p>\n'
        '<p class="n2-dim" id="dnone" hidden>Nothing under that spelling yet. Fewer letters, or the plain English word, '
        'may find it: this book indexes every transliteration it knows, and it is still growing. '
        '<a href="/feedback">Tell us what was missing</a> and it will be added.</p>\n'
        '<div class="n2-row">%s<a class="n2-btn" href="/#search" id="dsite">The whole library %s</a></div>\n'
        '</section>' % (len(D), len(D), SVG_FIND, len(D), go("#cat-" + CATS[0][0], "The words, by domain", True), SVG_FIND))

    for c, name, ar in CATS:
        rows = []
        for e in D:
            if e["cat"] != c:
                continue
            rows.append(
                '<li id="%s" data-k="%s"><a href="/dictionary/%s"><b>%s<small>%s</small></b>'
                '<span class="n2-ar" lang="ar" translate="no">%s</span></a></li>'
                % (esc(e["id"]), esc("|".join(sorted({fold(a) for a in e["also"] if fold(a)}))), esc(e["id"]),
                   esc(e["term"]), esc(e["short"]), esc(e.get("ar", ""))))
        main.append(
            '<section class="n2-idea n2-short n2-group" id="cat-%s">\n'
            '<h2 class="n2-h3">%s <span class="n2-g">· %d</span> <span class="n2-ar" lang="ar" translate="no">%s</span></h2>\n'
            '<ul class="n2-list">%s</ul>\n</section>' % (esc(c), esc(name), counts[c], ar, "".join(rows)))

    main.append(
        '<section class="n2-idea n2-short" id="rooms">\n'
        '<p class="n2-eyebrow">Where to go from here</p>\n'
        '<h2 class="n2-h2">Every word here has <span class="n2-g">a room behind it</span></h2>\n'
        '<ul class="n2-rooms">\n'
        '<li><a href="/quran"><b>The Mushaf</b><span>Recited, every ayah</span></a></li>\n'
        '<li><a href="/madrasa"><b>The Classroom</b><span>The words in order</span></a></li>\n'
        '<li><a href="/protection"><b>Protection &amp; the Light</b><span>Sihr, ruqya, the evil eye</span></a></li>\n'
        '<li><a href="/arabic"><b>Learn Arabic</b><span>The letters, then the roots</span></a></li>\n'
        '</ul>\n'
        '<div class="n2-row">%s%s</div>\n</section>'
        % (go("/today", "Today's word", True),
           share_btn("The Encyclopedia of the Path: %d words of Islam, defined plainly · NOOR Codex of Light" % len(D), SITE + "/dictionary")))

    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "NOOR Codex of Light", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": "The Encyclopedia of the Path", "item": SITE + "/dictionary"}]},
        {"@type": "DefinedTermSet", "@id": SITE + "/dictionary#set",
         "name": "The Encyclopedia of the Path", "url": SITE + "/dictionary", "inLanguage": "en",
         "description": "A dictionary of Islamic terms and concepts, each one defined in plain language with its evidence named.",
         "hasDefinedTerm": [{"@type": "DefinedTerm", "name": e["term"], "description": e["short"],
                             "url": SITE + "/dictionary/" + e["id"]} for e in D[:60]]}]}
    desc = ("A free encyclopedia of Islamic terms: %d words defined in plain language, each with its "
            "Arabic, its alternate spellings, its evidence named, and the room that covers it. Search "
            "any spelling." % len(D))
    html = shell(title="The Encyclopedia of the Path", path="/dictionary", desc=desc, body="\n".join(main),
                 mode="reveal top bar share home", active="/dictionary", pill=("/today", "Today's word"),
                 ld=ld, og_type="website", style=HUB_STYLE, tail=HUB_JS,
                 scripts='<link rel="stylesheet" href="/assets/noor-rtl.css?v=77"/>\n'
                         '<script src="/assets/noor-search.js?v=78" defer></script>\n')
    open(OUT, "w", encoding="utf-8").write(html)
    print("dictionary.html written · %d KB · %d entries · %d domains" % (len(html.encode("utf-8")) / 1024, len(D), len(CATS)))
    n, biggest = build_pages(D, shelf)
    print("dictionary/ written · %d word pages · largest %s at %.1f KB" % (n, biggest[0], biggest[1] / 1024))
    r = retire_root_pages(D)
    if r: print("root · %d old word page%s removed" % (r, "" if r == 1 else "s"))
    return D


# ---------------------------------------------------------------------------
# ONE PAGE PER WORD, UNDER /dictionary/
#
# These used to sit at the root -- /iman, /fiqh, /mudal -- each carrying a
# canonical that pointed at /dictionary/<word>, an address that did not exist.
# The sitemap listed the same 523 non-existent addresses. Two of the words,
# hajj and quran, had the same name as a room, and the room won: those two
# had no page at all. And nothing linked to any of them except each other.
#
# So: they live here now, where their canonical always said they did; the hub
# links to every one; and each links to its neighbours and to the rest of its
# domain, so the encyclopedia is a web and not a well. Three screens: the
# word (its Arabic, its name, its short meaning, its spellings), the meaning
# (the long definition and the level of its evidence), and what sits beside
# it (the neighbours the editors named, six more from the domain, the shelf's
# verses that name the word, the doors to the domain and the book).
# ---------------------------------------------------------------------------
PAGE_DIR = os.path.join(ROOT, "dictionary")


def row(x):
    return ('<li><a href="/dictionary/%s"><b>%s<small>%s</small></b><span class="n2-ar" lang="ar" translate="no">%s</span></a></li>'
            % (esc(x["id"]), esc(x["term"]), esc(x["short"]), esc(x.get("ar", ""))))


def build_pages(D, shelf=()):
    os.makedirs(PAGE_DIR, exist_ok=True)
    by_id = {e["id"]: e for e in D}
    by_cat = {}
    for e in D:
        by_cat.setdefault(e["cat"], []).append(e)
    n, biggest = 0, ("", 0)
    for e in D:
        term, ar = e["term"], e.get("ar", "")
        short, long_ = e["short"], e.get("long", "") or e["short"]
        lvl = LEVELS[e["k"]]
        cat = CATNAME[e["cat"]]
        path = "/dictionary/" + e["id"]
        url = SITE + path
        # the neighbours the editors named, then six more from the same domain
        see = [by_id[s] for s in e["see"] if s in by_id]
        seen = {e["id"]} | {x["id"] for x in see}
        sib = [x for x in by_cat[e["cat"]] if x["id"] not in seen]
        # deterministic, spread across the domain rather than alphabetical neighbours
        step = max(1, len(sib) // 6) if sib else 1
        sib = [sib[(i * step) % len(sib)] for i in range(min(6, len(sib)))] if sib else []
        verses = verses_for(e, shelf)

        ld = {"@context": "https://schema.org", "@graph": [
            {"@type": "DefinedTerm", "@id": url + "#term", "name": term,
             "alternateName": e["also"][:8], "description": short, "url": url, "inLanguage": "en",
             "inDefinedTermSet": {"@type": "DefinedTermSet", "@id": SITE + "/dictionary#set",
                                  "name": "NOOR Codex · The Words of the Path", "url": SITE + "/dictionary"}},
            {"@type": "WebPage", "@id": url, "url": url, "name": "%s · meaning in Islam" % term,
             "description": short, "inLanguage": "en", "image": OG,
             "isPartOf": {"@id": SITE + "/#site"}, "mainEntity": {"@id": url + "#term"},
             "breadcrumb": {"@type": "BreadcrumbList", "itemListElement": [
                 {"@type": "ListItem", "position": 1, "name": "NOOR", "item": SITE + "/"},
                 {"@type": "ListItem", "position": 2, "name": "The Encyclopedia of the Path", "item": SITE + "/dictionary"},
                 {"@type": "ListItem", "position": 3, "name": term, "item": url}]}}]}

        body = [
            '<section class="n2-idea" id="word">',
            '<p class="n2-eyebrow">The word <small>· %s</small></p>' % esc(cat),
            ('<p class="n2-word-ar notranslate" lang="ar" translate="no">%s</p>' % ar) if ar else "",
            '<h1 class="n2-h1"><span class="n2-g">%s</span></h1>' % esc(term),
            '<p class="n2-meaning">%s</p>' % esc(short),
            ('<p class="n2-src">Also written · %s</p>' % esc(" · ".join(e["also"]))) if e["also"] else "",
            '<div class="n2-row">%s%s</div>' % (
                go("#meaning", "The meaning", True),
                share_btn("%s, %s: %s · NOOR Codex of Light" % (term, ar, short) if ar else "%s: %s · NOOR Codex of Light" % (term, short), url)),
            '</section>',
            '<section class="n2-idea" id="meaning">',
            '<p class="n2-eyebrow">The meaning</p>',
            '<h2 class="n2-h3">What %s means in Islam</h2>' % esc(term),
            '<p class="n2-p">%s</p>' % esc(long_),
            '<p class="n2-src">Evidence · %s · %s</p>' % (esc(lvl[0]), esc(lvl[1])),
            '<div class="n2-row">%s</div>' % go("#beside", "Read beside it", True),
            '</section>',
            '<section class="n2-idea n2-short" id="beside">',
            '<p class="n2-eyebrow">Read beside it</p>',
            ('<p class="n2-eyebrow">Words that sit beside it</p><ul class="n2-list">%s</ul>' % "".join(row(x) for x in see)) if see else "",
            ('<p class="n2-eyebrow">More from %s</p><ul class="n2-list">%s</ul>' % (esc(cat), "".join(row(x) for x in sib))) if sib else "",
            ('<p class="n2-eyebrow">Verses on the shelf that name it</p><ul class="n2-list">%s</ul>' % "".join(
                '<li><a href="/verse/%s"><span class="n2-num">%s</span><b>%s</b></a></li>' % (esc(v["id"]), esc(v["ref"]), esc(v["text"]))
                for v in verses)) if verses else "",
            '<div class="n2-row">%s%s</div>' % (
                go("/dictionary#cat-" + e["cat"], "All %d words of %s" % (len(by_cat[e["cat"]]), cat)),
                go("/dictionary#" + e["id"], "The whole encyclopedia")),
            '</section>',
        ]
        html = shell(title="%s · meaning in Islam" % term, path=path, desc=short, body="\n".join(b for b in body if b),
                     mode="", active="/dictionary", pill=("/dictionary", "The words"), ld=ld)
        size = len(html.encode("utf-8"))
        if size > biggest[1]:
            biggest = (e["id"], size)
        open(os.path.join(PAGE_DIR, e["id"] + ".html"), "w", encoding="utf-8").write(html)
        n += 1
    return n, biggest


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
