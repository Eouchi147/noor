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
V = "14"                                  # the shell's cache-buster; api/page.js and noor-fx.js carry the same
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
    # the fifth door is the map of the house and the search in one sheet, drawn
    # by noor-fx.js; without a script it is a link to /#search, which the
    # arrival answers. The same door api/page.js draws on every room.
    ("More", "/#search", '<circle cx="5.5" cy="6" r="1.6"/><circle cx="5.5" cy="12" r="1.6"/><circle cx="5.5" cy="18" r="1.6"/><path d="M11 6h8M11 12h8M11 18h8"/>'),
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
        % (href, " data-n2-more" if name == "More" else "",
           ' class="n2-on"' if href == active and name != "More" else "", icon, esc(name))
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
      none=document.getElementById("dnone");
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
  /* the whole-library door is data-n2-more now: noor-fx.js answers it with the
     map of the house and the search in one sheet, the same door the bar opens.
     Nothing is wired here, so there is nothing here to go stale. */
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
        '<div class="n2-row">%s<a class="n2-btn" href="/#search" id="dsite" data-n2-more>The whole library %s</a></div>\n'
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
    lib = {"lights": load_lights(), "chapters": load_chapters(), "surahs": load_surahs(), "names": load_names()}
    print("library: %d Lights · %d chapters · %d surahs · %d Names" % (len(lib["lights"]), len(lib["chapters"]), len(lib["surahs"]), len(lib["names"])))
    rooms = rooms_for_words(D, lib["lights"], lib["chapters"], lib["surahs"])
    print("rooms that name a word: %d words have at least one · %d links in all"
          % (len(rooms), sum(len(v) for v in rooms.values())))
    n, biggest = build_pages(D, shelf, rooms)
    print("dictionary/ written · %d word pages · largest %s at %.1f KB" % (n, biggest[0], biggest[1] / 1024))
    r = retire_root_pages(D)
    if r: print("root · %d old word page%s removed" % (r, "" if r == 1 else "s"))
    return D, lib


# ---------------------------------------------------------------------------
# THE ROOMS: the Lights, the chapters of the Path, the surahs, the Names
#
# Read once, from the same files api/page.js renders the rooms from, for two
# jobs below: the search index carries every room by its own title, and a
# word page can point at the rooms whose own text names the word. Every
# loader answers an empty list when its file is missing or unreadable, and
# says so; nothing is invented to fill the gap.
# ---------------------------------------------------------------------------
def _read_json(rel):
    try:
        return json.load(open(os.path.join(ROOT, rel), encoding="utf-8"))
    except Exception as e:
        print("  ! %s not read: %s" % (rel, e))
        return None


def clip(s, n):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    if len(s) <= n:
        return s
    return re.sub(r"\s+\S*$", "", s[:n - 1]) + "…"


def load_lights():
    """lights/all.json: id, k, c, t, s, d, tags"""
    j = _read_json("lights/all.json")
    rows = (j or {}).get("lights") if isinstance(j, dict) else None
    return [L for L in (rows or []) if isinstance(L, dict) and L.get("id") and L.get("t")]


def load_chapters():
    """node/<n>.json for n in 1..71, in order; a missing file is skipped"""
    out = []
    for n in range(1, 72):
        N = _read_json("node/%d.json" % n) if os.path.exists(os.path.join(ROOT, "node", "%d.json" % n)) else None
        if isinstance(N, dict) and N.get("titleEn"):
            N = dict(N); N["n"] = n
            out.append(N)
    return out


def load_surahs():
    """the 114 surahs: number, name in Arabic, transliteration, meaning, count,
       place. The Mushaf's own table (quran.html, SURAHS) carries the English
       meaning; tools/reels/quran-uthmani.json, which api/page.js reads, is the
       fallback and carries everything but the meaning. study/<n>.json is
       attached where it exists."""
    rows = {}
    try:
        src = open(os.path.join(ROOT, "quran.html"), encoding="utf-8").read()
        m = re.search(r"const SURAHS=(\[\[.*?\]\]);", src)
        for r in json.loads(m.group(1)):
            rows[int(r[0])] = {"n": int(r[0]), "translit": r[1], "name": r[2], "meaning": r[3],
                               "count": int(r[4]), "place": "Makkah" if r[5] == "M" else "Madinah"}
    except Exception as e:
        print("  ! quran.html SURAHS not read: %s" % e)
    if len(rows) != 114:
        q = _read_json("tools/reels/quran-uthmani.json") or {}
        for k, r in (q.get("surahs") or {}).items():
            n = int(k)
            if n not in rows:
                rows[n] = {"n": n, "translit": r.get("translit", "Surah %d" % n), "name": r.get("name", ""), "meaning": "",
                           "count": int(r.get("count") or 0), "place": "Makkah" if str(r.get("type", "")).startswith("Mec") else "Madinah"}
    out = []
    for n in sorted(rows):
        r = rows[n]
        p = os.path.join(ROOT, "study", "%d.json" % n)
        r["study"] = (_read_json("study/%d.json" % n) or {}) if os.path.exists(p) else {}
        out.append(r)
    return out


def load_names():
    """the 99 Names from allah.html's NAMES table: the Arabic, how it is said,
       its one line of meaning. /allah#<k> opens the k-th on the page and
       /name/<k> is its own room."""
    out = []
    try:
        src = open(os.path.join(ROOT, "allah.html"), encoding="utf-8").read()
        i = src.index("const NAMES = [")
        j = src.index("\n];", i)
        for m in re.finditer(r'^\["([^"]*)","([^"]*)","([^"]*)",', src[i:j], re.M):
            out.append({"ar": m.group(1), "translit": m.group(2), "meaning": m.group(3)})
    except Exception as e:
        print("  ! allah.html NAMES not read: %s" % e)
    if len(out) != 99:
        print("  ! allah.html NAMES: %d rows read, 99 expected" % len(out))
    return out


def fold_js(s):
    """api/page.js's fold(), letter for letter, so the reverse of its
       relatedWords() is computed with the same eyes"""
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = re.sub(r"[\u0300-\u036f]", "", s)
    s = re.sub(r"[‘’'ʻʼ`]", "", s)
    s = re.sub(r"[^a-z0-9\u0600-\u06ff]+", " ", s)
    return s.strip()


def rooms_for_words(D, lights, chapters, surahs):
    """The reverse of api/page.js relatedWords(): that function lists, on a
       Light or a chapter, up to six words whose term or id appears whole in
       the room's own text, the longest term first. This walks the same texts
       once with the same rule and answers, for each word, the rooms on which
       it is one of those six: a Light (its title and story), a chapter (its
       title, summary and lessons), a surah (its name, its meaning and the
       study written for it; the surah room prints no words, so this is the
       same rule over the surah's own prose). A room whose title carries the
       word comes before one that only mentions it; then the library's own
       order. The words are walked in assets/dict-index.json's order, as
       api/page.js walks them, so a tie between two terms of one length falls
       the same way here as there."""
    by_id = {e["id"]: e for e in D}
    di = _read_json("assets/dict-index.json") if os.path.exists(os.path.join(ROOT, "assets", "dict-index.json")) else None
    order = [i for i in ((di or {}).get("words") or {}) if i in by_id] if isinstance(di, dict) else []
    order += [e["id"] for e in D if e["id"] not in set(order)]
    keys = []                                    # (word id, [keys], length of the term)
    for wid in order:
        e = by_id[wid]
        ks = [k for k in (fold_js(e["term"]), fold_js(e["id"].replace("-", " "))) if len(k) >= 3]
        if ks:
            keys.append((wid, list(dict.fromkeys(ks)), len(fold_js(e["term"]))))
    hits = {}                                    # word id -> {kind: [(rank, order, room)]}

    def scan(kind, order, title, text, room):
        head = " " + fold_js(title) + " "
        hay = " " + fold_js(text) + " "
        found = []
        for wid, ks, n in keys:
            rank = None
            for k in ks:
                probe = " " + k + " "
                if probe in head:
                    rank = 0; break
                if probe in hay:
                    rank = 1
            if rank is not None:
                found.append((wid, rank, n))
        # the longer term is the more particular one: Badr before Qur'an, and
        # six of them, exactly as the room prints them
        found.sort(key=lambda f: -f[2])
        for wid, rank, _ in found[:6]:
            hits.setdefault(wid, {}).setdefault(kind, []).append((rank, order, room))

    for i, L in enumerate(lights):
        scan("light", i, L.get("t", ""), L.get("t", "") + " " + str(L.get("s", "")),
             ("/light/" + L["id"], L["t"], "A Light · " + (L.get("d") or L.get("c") or "")))
    for N in chapters:
        scan("chapter", N["n"], N.get("titleEn", ""),
             " ".join([N.get("titleEn", ""), str(N.get("summary", "")), " ".join(N.get("lessons") or [])]),
             ("/path/%d" % N["n"], N["titleEn"], "The Path · chapter %d" % N["n"]))
    for S in surahs:
        st = S.get("study") or {}
        text = " ".join([S["translit"], S.get("meaning", ""), " ".join(st.get("context") or []), str(st.get("name_story") or ""),
                         " ".join(str(t.get("t", "")) + " " + str(t.get("d", "")) for t in (st.get("themes") or []) if isinstance(t, dict)),
                         " ".join(st.get("heart") or [])])
        scan("surah", S["n"], S["translit"] + " " + S.get("meaning", ""), text,
             ("/surah/%d" % S["n"], "Surah " + S["translit"], "Surah %d%s" % (S["n"], (" · " + S["meaning"]) if S.get("meaning") else "")))

    out = {}
    for wid, kinds in hits.items():
        lists = [sorted(kinds.get(k, [])) for k in ("light", "chapter", "surah")]
        picks = []
        while len(picks) < 3 and any(lists):
            for lst in lists:
                if lst:
                    picks.append(lst.pop(0)[2])
                    if len(picks) == 3:
                        break
        out[wid] = picks
    return out


def room_shelf(rooms):
    """up to three rooms, on the shell's own shelf (api/page.js prints related
       Lights the same way: one card at a time, under the thumb)"""
    if not rooms:
        return ""
    return ('<p class="n2-eyebrow">Rooms that name it</p><ul class="n2-shelf">%s</ul>'
            % "".join('<li><a href="%s"><b>%s</b><small>%s</small></a></li>' % (esc(u), esc(t), esc(s)) for u, t, s in rooms))


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
# it (the rooms of the library whose own text names the word, the neighbours
# the editors named, six more from the domain, the shelf's verses that name
# the word, the doors to the domain and the book).
# ---------------------------------------------------------------------------
PAGE_DIR = os.path.join(ROOT, "dictionary")


def row(x):
    return ('<li><a href="/dictionary/%s"><b>%s<small>%s</small></b><span class="n2-ar" lang="ar" translate="no">%s</span></a></li>'
            % (esc(x["id"]), esc(x["term"]), esc(x["short"]), esc(x.get("ar", ""))))


def build_pages(D, shelf=(), rooms=None):
    os.makedirs(PAGE_DIR, exist_ok=True)
    rooms = rooms or {}
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
            room_shelf(rooms.get(e["id"])),
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


# ---------------------------------------------------------------------------
# THE SEARCH INDEX: assets/search-index.json
#
# One file the magnifier (assets/noor-search.js) loads on any page, in the
# shape that script reads: g, the groups with their names and weights; w, the
# words of the encyclopedia; e, the entities of the house, each with its
# group and its address; r, the rooms. This generator does not own all of
# it. The prophets, companions, heroes, places and the rest of the 1,183
# entities were built once from the parchment pages and no script in the
# repository can rebuild them; a run of this file on 9 September 2026 wrote
# {w, r} over the whole thing and every reader lost every prophet from the
# search until the file was restored by hand. So the shipped file is read
# first and kept: every group, every entity and every room it carries stays,
# and this file only rebuilds what it can build from the library's own data
# (the words, the Lights, the chapters of the Path, the surahs, the Names)
# and adds every room the map of the house names. Three rooms are left out
# on purpose: /404, /masjid/board (noindex) and /license (retired). The
# workflow refuses a result that lost a group or a twentieth of its rows.
# ---------------------------------------------------------------------------
INDEX = os.path.join(ROOT, "assets", "search-index.json")
DROP_ROOMS = {"/404", "/masjid/board", "/license"}
SHELVES = [
    ("/today", "Today", "One Light, one word and one chapter of the Path, every day"),
    ("/light", "The Lights", "350 Lights of history and science, each with its date"),
    ("/verses", "The Verses", "One verse, one thought, each with its recitation and its meaning"),
    ("/path", "The Path of Creation", "71 chapters, from Kun Fayakun to the Hour"),
]
OWNED_GROUPS = {"lights", "surahs", "names"}      # built whole from the library, every run


def _owned(e):
    """an entity this generator rebuilds: the three groups above, and the
       chapters of the Path, which sat in the path group under /#path-flow (an
       anchor the rebuilt home no longer has) and sit under /path/<n> now"""
    g, u = e.get("g"), str(e.get("u", ""))
    return g in OWNED_GROUPS or (g == "path" and (u == "/#path-flow" or re.match(r"^/path/\d+$", u) is not None))


def _bare(translit):
    """Ar-Rahman -> Rahman, Al-Baqarah -> Baqarah: the name without its article,
       which is how a reader types it"""
    m = re.match(r"^(A[lrsdtnz]?[a-z]?)-(.+)$", translit)
    return m.group(2) if m else ""


def build_search_index(D, lib):
    old = _read_json("assets/search-index.json") if os.path.exists(INDEX) else None
    if not isinstance(old, dict):
        old = {}
        print("  ! assets/search-index.json not found: the entities it carried cannot be rebuilt here")
    groups = [dict(g) for g in (old.get("g") or []) if isinstance(g, dict) and g.get("k")]
    have_g = {g["k"] for g in groups}
    for k, n, w in (("lights", "The Lights", 3), ("surahs", "The surahs", 4), ("names", "The Ninety-Nine Names", 5)):
        if k not in have_g:
            groups.append({"k": k, "n": n, "w": w})

    words = [{"i": e["id"], "t": e["term"], "a": e.get("ar", ""), "l": e["also"][:8], "s": e["short"]} for e in D]

    # the rooms: the shipped list less the three, then every room the map of
    # the house names, then the four shelves the map may not name yet
    rooms, have_r = [], set()
    same = lambda u: u.rstrip("/") or "/"            # /masjid/ and /masjid are one room
    for r in (old.get("r") or []):
        if isinstance(r, dict) and r.get("u") and r["u"] not in DROP_ROOMS and same(r["u"]) not in have_r:
            rooms.append(r); have_r.add(same(r["u"]))
    menu = _read_json("assets/menu-index.json") or {}
    for sec in (menu.get("sections") or []):
        for it in (sec.get("items") or []):
            u = str(it.get("u", ""))
            if not u.startswith("/") or u.startswith("/#") or u in DROP_ROOMS or same(u) in have_r:
                continue
            rooms.append({"u": u, "t": it.get("t", u), "s": it.get("d", ""), "g": "rooms"}); have_r.add(same(u))
    for u, t, s in SHELVES:
        if same(u) not in have_r:
            rooms.append({"u": u, "t": t, "s": s, "g": "rooms"}); have_r.add(same(u))

    # the entities: what was there, with the generator's own groups rebuilt
    chapters = [{"g": "path", "t": N["titleEn"], "a": N.get("titleAr", ""), "s": clip(N.get("summary", ""), 120), "u": "/path/%d" % N["n"]}
                for N in lib["chapters"]]
    lights = [{"g": "lights", "t": L["t"], "a": "", "s": clip(L.get("d") or L.get("c") or "", 120), "u": "/light/" + L["id"],
               "l": [str(x).replace("-", " ") for x in (L.get("tags") or [])][:8]} for L in lib["lights"]]
    surahs = []
    for S in lib["surahs"]:
        alt = ["surah %d" % S["n"], str(S["n"]), S["translit"].replace("-", " ")]
        if S.get("meaning"): alt.append(S["meaning"])
        if _bare(S["translit"]): alt.append(_bare(S["translit"]))
        line = "Surah %d" % S["n"] + (" · " + S["meaning"] if S.get("meaning") else "") + \
               (" · %d verses" % S["count"] if S.get("count") else "") + (" · " + S["place"] if S.get("place") else "")
        surahs.append({"g": "surahs", "t": S["translit"], "a": S.get("name", ""), "s": line, "u": "/surah/%d" % S["n"], "l": list(dict.fromkeys(alt))})
    names = []
    for k, N in enumerate(lib["names"], 1):
        alt = [x for x in (_bare(N["translit"]), N["translit"].replace("-", " ")) if x]
        # a Name's row opens its own room, /name/<k> (api/page.js), since 16
        # September 2026; /allah#<k> opens the same Name on the page
        names.append({"g": "names", "t": N["translit"], "a": N["ar"], "s": N["meaning"], "u": "/name/%d" % k, "l": list(dict.fromkeys(alt))})
    fresh = {"path": chapters, "lights": lights, "surahs": surahs, "names": names}
    kept_owned = {}
    for e in (old.get("e") or []):
        if isinstance(e, dict) and _owned(e):
            kept_owned.setdefault(e["g"], []).append(e)
    # a group whose source could not be read keeps the rows the file had,
    # rather than going out empty: the search must never lose a class of thing
    for k in fresh:
        if not fresh[k] and kept_owned.get(k):
            print("  ! %s: nothing built from the library, the %d rows already in the index are kept" % (k, len(kept_owned[k])))
            fresh[k] = kept_owned[k]
    ents, placed = [], set()
    for e in (old.get("e") or []):
        if not isinstance(e, dict):
            continue
        if _owned(e):
            g = e["g"]
            if g not in placed:            # the rebuilt rows take the place of the first old row of their group
                placed.add(g); ents.extend(fresh.get(g, []))
            continue
        ents.append(e)
    for g in ("path", "lights", "surahs", "names"):
        if g not in placed:
            placed.add(g); ents.extend(fresh[g])

    idx = {"v": old.get("v", 77), "g": groups, "w": words, "r": rooms, "e": ents}
    json.dump(idx, open(INDEX, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    import gzip
    raw = open(INDEX, "rb").read()
    by = {}
    for e in ents: by[e.get("g")] = by.get(e.get("g"), 0) + 1
    print("search-index.json written · %d words · %d rooms · %d entities in %d groups · %d KB, %d KB gzipped"
          % (len(words), len(rooms), len(ents), len(groups), len(raw) / 1024, len(gzip.compress(raw, 9)) / 1024))
    print("  " + " · ".join("%s %d" % (k, by[k]) for k in sorted(by)))
    if len(gzip.compress(raw, 9)) > 250 * 1024:
        print("  !! the index is over 250 KB gzipped: trim descriptions before entries")
    return idx


if __name__ == "__main__":
    D, lib = build()
    build_search_index(D, lib)
