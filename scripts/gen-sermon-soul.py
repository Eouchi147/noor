#!/usr/bin/env python3
# NOOR v49 · The Last Sermon · Death and the Journey of the Soul
# Builds /sermon.html and /soul.html from build/sermon-soul.json through the
# canonical room shell. The shell (room.py) supplies head, the house menu, the
# ink hero and the footer; this file supplies only the two rooms: their CSS,
# their <main>, their seven figures and their small script.
#
#   python3 scripts/gen-sermon-soul.py
#
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from room import shell  # noqa: E402

SRC = os.path.join(ROOT, "build", "sermon-soul.json")
OUT_SERMON = os.path.join(ROOT, "sermon.html")
OUT_SOUL = os.path.join(ROOT, "soul.html")

LEVELS = {
    "quran": ("Qur’an", "Stated directly in the Qur’an"),
    "sunnah": ("Sunnah", "Established in the authentic Sunnah"),
    "mixed": ("Mixed evidence", "This part carries claims of different strength, each one named as it comes"),
    "debated": ("Scholars differ", "The scholars read this one differently, and the difference is named"),
    "editorial": ("Editorial", "Our own counsel, drawn from the sources named, never revelation"),
}

ORD = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"]


# --------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------

def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "’"))


def att(s):
    return esc(s).replace("&quot;", "'")


def badge(level):
    label, hint = LEVELS.get(level, LEVELS["editorial"])
    return ('<span class="evb %s mo-pop" title="%s">%s</span>'
            % (esc(level if level in LEVELS else "editorial"), att(hint), esc(label)))


QREF = re.compile(r"^(?:Qur’an|Qur'an|Quran)\s+(\d{1,3}):(\d{1,3})(?:\s*-\s*(\d{1,3}))?$")

SENT = re.compile(r"[.!?][’\"]?\s")


def paras(text, target=2):
    """Two breathing paragraphs instead of one wall, without altering a word."""
    text = str(text).strip()
    if len(text) < 420:
        return [text]
    cuts = [m.end() for m in SENT.finditer(text) if 120 < m.end() < len(text) - 120]
    if not cuts:
        return [text]
    mid = len(text) / 2.0
    cut = min(cuts, key=lambda c: abs(c - mid))
    return [text[:cut].rstrip(), text[cut:].lstrip()]


def qbtn(sura, aya, label):
    ref = "%s:%s" % (sura, aya)
    return ('<button type="button" class="vplay" data-ref="%s" '
            'aria-label="Listen to the recitation of Qur’an %s">%s ▸</button>'
            % (ref, label, label))


def ref_chip(r):
    """One evidence chip. Qur’an references carry a working play button."""
    m = QREF.match(str(r).strip())
    if m:
        sura, aya, to = m.group(1), m.group(2), m.group(3)
        label = "%s:%s" % (sura, aya) + ("-" + to if to else "")
        return ('<span class="ref q"><b>Qur’an</b>%s</span>' % qbtn(sura, aya, label))
    return '<span class="ref"><b>%s</b></span>' % esc(r)


def refs_html(refs, cls="refs"):
    if not refs:
        return ""
    return '<div class="%s">%s</div>' % (cls, "".join(ref_chip(r) for r in refs))


def fig(svg, legend, cap):
    leg = "".join("<li>%s</li>" % l for l in legend)
    return ('<div class="fig mo-pop mo-draw">' + svg +
            ('<ul class="leg">' + leg + "</ul>" if legend else "") +
            '<p class="cap">' + cap + "</p></div>")


def keys_html():
    rows = [("quran", "Qur’an", "stated in the Book itself"),
            ("sunnah", "Sunnah", "established in authentic hadith"),
            ("mixed", "Mixed evidence", "parts of differing strength"),
            ("debated", "Scholars differ", "read differently by the scholars"),
            ("editorial", "Editorial", "our own counsel, never revelation")]
    return '<div class="keys">%s</div>' % "".join(
        '<div><span class="evb %s">%s</span><span>%s</span></div>' % (k, esc(a), esc(b))
        for k, a, b in rows)


def band(line):
    return ('<section class="band mo"><p>%s</p><div class="bl">'
            '<a class="ghost" href="feedback.html">Send a correction</a>'
            '<a class="gpill" href="donate.html">Keep the lamp lit ✦</a>'
            "</div></section>" % line)


# ==========================================================================
# SERMON · figures
# ==========================================================================

def fig_arafah():
    base = 150
    rings, dots = [], []
    for i in range(6):
        r = 82 + i * 30
        d = 26 + i * 22
        rings.append('<path class="s3" d="M%d %d Q240 %d %d %d"/>'
                     % (240 - r, base, base + 2 * d, 240 + r, base))
        for t in (0.18, 0.38, 0.62, 0.82):
            x = (1 - t) ** 2 * (240 - r) + 2 * (1 - t) * t * 240 + t * t * (240 + r)
            y = base + 4 * t * (1 - t) * d
            dots.append('<circle class="f2 dt" cx="%.0f" cy="%.0f" r="2.4"/>' % (x, y))
    svg = (
        '<svg viewBox="0 0 480 340" role="img" aria-label="The plain of Arafah: the mount of '
        'mercy standing in the middle, and ring after ring of pilgrims drawn outward from it '
        'across the valley floor, about a hundred thousand of them.">'
        '<path class="s3" d="M14 %d H466"/>' % base +
        '<path class="s1" d="M158 %d L240 54 L322 %d"/>' % (base, base) +
        '<path class="s3" d="M196 106 L240 82 L284 106"/>'
        '<path class="s1" d="M240 54V42"/>'
        '<circle class="f2" cx="240" cy="36" r="4"/>'
        '<circle class="s3" cx="240" cy="36" r="13"/>'
        '<circle class="s3" cx="240" cy="36" r="24"/>'
        + "".join(rings) + "".join(dots) +
        '<text class="fl" x="392" y="74" text-anchor="middle">Jabal al Rahmah</text>'
        '<text class="fs" x="392" y="92" text-anchor="middle">the mount of mercy</text>'
        '<text class="fs" x="88" y="84" text-anchor="middle">the belly of</text>'
        '<text class="fs" x="88" y="100" text-anchor="middle">the valley</text>'
        '<text class="fl" x="240" y="330" text-anchor="middle">about '
        '<tspan class="fg mo-count" data-n="100000">100,000</tspan> standing</text>'
        "</svg>")
    legend = [
        "One valley, one afternoon, the ninth of Dhul Hijjah in the year 10 AH. He rode into the "
        "middle of it so that the rings of listeners could face inward from every side.",
        "Criers were posted through the crowd to repeat each sentence outward, so the far rings "
        "heard the same words as the near ones.",
        "It was the largest gathering of his life, and the last time he would address it: about a "
        "hundred thousand pilgrims, most of whom would never see him again.",
    ]
    cap = ("<b>Muslim 1218 and Bukhari 1741.</b> Jabir ibn Abdullah, who rode with him, preserved "
           "the fullest account of that day: the camel, the valley, the sermon, and the sun going "
           "down over the standing.")
    return fig(svg, legend, cap)


def fig_rights():
    rows = [
        (42, "دَم", "dam", "life", "your blood is sacred"),
        (122, "مَال", "mal", "property", "your wealth is sacred"),
        (202, "عِرْض", "ird", "honour", "your good name is sacred"),
    ]
    parts = []
    for y, ar, tr, en, line in rows:
        parts.append('<rect class="s1 f1" x="70" y="%d" width="340" height="60" rx="30"/>' % y)
        parts.append('<text class="fa fg" x="124" y="%d" text-anchor="middle">%s</text>'
                     % (y + 30, ar))
        parts.append('<text class="fs" x="124" y="%d" text-anchor="middle">%s</text>'
                     % (y + 48, tr))
        parts.append('<text class="fl" x="178" y="%d">%s</text>' % (y + 28, en))
        parts.append('<text class="fs" x="178" y="%d">%s</text>' % (y + 46, line))
    parts.append('<path class="s2" d="M240 102V122"/>')
    parts.append('<path class="s2" d="M240 182V202"/>')
    parts.append('<circle class="f2" cx="240" cy="112" r="3"/>')
    parts.append('<circle class="f2" cx="240" cy="192" r="3"/>')
    svg = ('<svg viewBox="0 0 480 300" role="img" aria-label="Three linked bands, one above the '
           'other: life, property and honour, each one named with the phrase he gave it, and the '
           'three joined into a single sanctity.">'
           + "".join(parts) +
           '<text class="fs" x="240" y="26" text-anchor="middle">one sanctity, in three bands</text>'
           '<text class="fl" x="240" y="288" text-anchor="middle">as sacred as this day, this month, this land</text>'
           "</svg>")
    legend = [
        "At Arafah he named two: your blood and your wealth. Days later at Mina he added the "
        "third: your honour, the good name of the person beside you.",
        "He measured them against the three holiest things his listeners knew, the day of Arafah, "
        "the month of Dhul Hijjah and the precincts of the Haram, and made an ordinary believer’s "
        "life and property their equal.",
        "The bands are linked on purpose. A community that keeps two of them and breaks the third "
        "has broken the sanctity itself.",
    ]
    cap = ("<b>Muslim 1218 and Bukhari 1741.</b> Indeed your blood and your wealth are sacred to "
           "you, as sacred as this day of yours, in this month of yours, in this land of yours.")
    return fig(svg, legend, cap)


def fig_chain():
    rings = [(68, "1", "Arafah, 10 AH", 198),
             (158, "2", "a hundred thousand hear it", 226),
             (248, "3", "the companions carry it", 198),
             (338, "4", "Bukhari, Muslim, Ahmad", 226),
             (428, "5", "this page", 198)]
    parts = []
    for cx, n, label, ly in rings:
        parts.append('<circle class="s1" cx="%d" cy="112" r="45"/>' % cx)
        parts.append('<circle class="s3" cx="%d" cy="112" r="35"/>' % cx)
        parts.append('<text class="fg" x="%d" y="120" text-anchor="middle">%s</text>' % (cx, n))
        parts.append('<path class="s3" d="M%d 157V%d"/>' % (cx, ly - 14))
        parts.append('<text class="fs" x="%d" y="%d" text-anchor="middle">%s</text>'
                     % (cx, ly, label))
    svg = ('<svg viewBox="0 0 480 248" role="img" aria-label="Five linked rings in a row: the '
           'valley at Arafah, the hundred thousand who heard it, the companions who carried it, '
           'the collections that recorded it, and the page being read now.">'
           + "".join(parts) +
           '<text class="fs" x="240" y="30" text-anchor="middle">every link named, none of them assumed</text>'
           "</svg>")
    legend = [
        "One sentence in the sermon set this chain in motion: let the one who is present convey "
        "it to the one who is absent.",
        "By the end of that first century the community carrying these words reached from "
        "Andalusia in the west to Sindh in the east, and a whole science grew up to test every "
        "link between the valley and the page.",
        "The rings only hold if each one is named. Where a link is weak, this room says so rather "
        "than closing the ring quietly.",
    ]
    cap = ("<b>Bukhari 1741 and Bukhari 67.</b> Perhaps the one who is told will retain it better "
           "than the one who heard it: the reason the sermon outlived every man in that valley.")
    return fig(svg, legend, cap)


# ==========================================================================
# SERMON · the passages
# ==========================================================================

SHORT = ["Farewell", "Sanctity", "Jahiliyyah", "Women", "Brotherhood", "Taqwa",
         "The Book", "Convey", "Witness"]

WORDS = [
    ("لِتَأْخُذُوا مَنَاسِكَكُمْ، فَإِنِّي لَا أَدْرِي لَعَلِّي لَا أَحُجُّ بَعْدَ حَجَّتِي هَذِهِ",
     "Take your rites from me, for I do not know; perhaps I shall not perform Hajj after this Hajj of mine."),
    ("إِنَّ دِمَاءَكُمْ وَأَمْوَالَكُمْ عَلَيْكُمْ حَرَامٌ، كَحُرْمَةِ يَوْمِكُمْ هَذَا، فِي شَهْرِكُمْ هَذَا، فِي بَلَدِكُمْ هَذَا",
     "Indeed your blood and your wealth are sacred to you, as sacred as this day of yours, in this month of yours, in this land of yours."),
    ("أَلَا كُلُّ شَيْءٍ مِنْ أَمْرِ الْجَاهِلِيَّةِ تَحْتَ قَدَمَيَّ مَوْضُوعٌ",
     "Every matter of Jahiliyyah, the age of ignorance, is laid down beneath these two feet of mine."),
    ("فَاتَّقُوا اللَّهَ فِي النِّسَاءِ، فَإِنَّكُمْ أَخَذْتُمُوهُنَّ بِأَمَانِ اللَّهِ",
     "Fear Allah concerning women, for you have taken them by the covenant of Allah."),
    ("لَا تَرْجِعُوا بَعْدِي كُفَّارًا يَضْرِبُ بَعْضُكُمْ رِقَابَ بَعْضٍ",
     "Do not return after me to being unbelievers, striking the necks of one another."),
    ("يَا أَيُّهَا النَّاسُ، إِنَّ رَبَّكُمْ وَاحِدٌ، وَإِنَّ أَبَاكُمْ وَاحِدٌ. لَا فَضْلَ لِعَرَبِيٍّ عَلَى أَعْجَمِيٍّ، "
     "وَلَا لِعَجَمِيٍّ عَلَى عَرَبِيٍّ، وَلَا لِأَحْمَرَ عَلَى أَسْوَدَ، وَلَا أَسْوَدَ عَلَى أَحْمَرَ، إِلَّا بِالتَّقْوَى",
     "O people, your Lord is one, and your father is one. No Arab has superiority over a "
     "non-Arab, nor a non-Arab over an Arab; no red over black, nor black over red, except by "
     "taqwa, the mindfulness of Allah."),
    ("وَقَدْ تَرَكْتُ فِيكُمْ مَا لَنْ تَضِلُّوا بَعْدَهُ إِنِ اعْتَصَمْتُمْ بِهِ: كِتَابَ اللَّهِ",
     "I have left among you that which, if you hold fast to it, you will never go astray: the Book of Allah."),
    ("فَلْيُبَلِّغِ الشَّاهِدُ الْغَائِبَ",
     "Let the one who is present convey it to the one who is absent."),
    ("اللَّهُمَّ اشْهَدْ، اللَّهُمَّ اشْهَدْ",
     "O Allah, bear witness. O Allah, bear witness."),
]

BESIDE = [
    ("110:1", "110:1-3", "When the help of Allah comes, and the victory, and you see people "
     "entering the religion of Allah in crowds, then glorify the praise of your Lord and ask His "
     "forgiveness. Ibn Abbas said the companions understood this surah as the announcement of the "
     "Messenger’s ﷺ approaching death."),
    ("5:32", "5:32", "Whoever kills a soul, unless for a soul or for corruption in the land, it "
     "is as if he had killed all mankind; and whoever saves one, it is as if he had saved all "
     "mankind."),
    ("2:278", "2:278-279", "O you who believe, fear Allah and give up what remains of riba, of "
     "usury, if you are believers."),
    ("4:19", "4:19", "And live with them in kindness. For if you dislike them, perhaps you "
     "dislike a thing and Allah makes in it much good."),
    ("49:10", "49:10", "The believers are but brothers, so make peace between your brothers, and "
     "fear Allah, that you may receive mercy."),
    ("49:13", "49:13", "O mankind, We created you from a male and a female and made you peoples "
     "and tribes so that you may know one another. Indeed the most noble of you before Allah is "
     "the most mindful of Him."),
    ("3:103", "3:103", "And hold fast, all of you together, to the rope of Allah, and do not be "
     "divided."),
    ("5:67", "5:67", "O Messenger, convey what has been revealed to you from your Lord; and if "
     "you do not, then you have not conveyed His message."),
    ("33:45", "33:45-46", "O Prophet, indeed We have sent you as a witness, a bringer of good "
     "tidings and a warner, and one who invites to Allah by His permission, and an illuminating "
     "lamp."),
]

COLOUR_NOTE = (
    "<p class=\"as-k\">A note on the words red and black</p>"
    "<p>The sermon’s own wording is left exactly as it stands above. This note is only the "
    "meaning those two words carried in the ears that first heard them. In the Arabic of that "
    "century <span class=\"fa notranslate\" translate=\"no\">أَحْمَر</span>, ahmar, red, was how "
    "the Arabs named the light-skinned or white-skinned peoples, the Persians and the Byzantines "
    "among them; and <span class=\"fa notranslate\" translate=\"no\">أَسْوَد</span>, aswad, "
    "black, named the dark-skinned peoples. Naming the two together was an idiom for the whole "
    "span of humanity, the way one might say from one end of the earth to the other.</p>"
    "<p>So the sentence is not weighing two tribes or two shades against each other in some "
    "narrow comparison. It gathers every human colour there is into one line and cancels the "
    "ranking of all of them at once, in the same breath that cancels the ranking of Arab over "
    "non-Arab. What is left standing as the only measure is taqwa, the mindfulness of Allah, "
    "which no lineage and no complexion can inherit or lose.</p>")


def passage_html(i, sec):
    ar, en = WORDS[i]
    href, label, gloss = BESIDE[i]
    body = "".join('<p>%s</p>' % esc(p) for p in paras(sec["body"]))
    aside = ('<aside class="aside mo">%s</aside>' % COLOUR_NOTE) if i == 5 else ""
    beside = ('<div class="beside"><p class="bk">Beside it in the Book</p>'
              '<p class="bt">%s</p><div class="refs"><span class="ref q"><b>Qur’an</b>%s</span></div></div>'
              % (esc(gloss), qbtn(href.split(":")[0], href.split(":")[1], label)))
    return ('<section class="rsec" id="p%d">'
            '<p class="sh-n">Passage %s of nine</p>'
            '<article class="card pass mo">'
            '<div class="ch"><h2>%s</h2>%s</div>'
            '<blockquote class="words">'
            '<p class="wa fa notranslate" translate="no" dir="rtl" lang="ar">%s</p>'
            '<p class="we">%s</p></blockquote>'
            '%s%s%s%s</article></section>'
            % (i + 1, ORD[i], esc(sec["h"]), badge(sec.get("level", "sunnah")),
               esc(ar), esc(en), body, refs_html(sec.get("refs")), aside, beside))


def sermon_page(data):
    s = data["sermon"]
    secs = s["sections"]

    chips = ['<a href="#arafah">Arafah</a>']
    for i in range(len(secs)):
        chips.append('<a href="#p%d">%s</a>' % (i + 1, SHORT[i]))
        if i == 1:
            chips.append('<a href="#rights">The three</a>')
    chips.append('<a href="#chain">The chain</a>')
    nav = ('<nav class="secnav" id="secnav" aria-label="The passages of the sermon">'
           '<div class="secnav-in">%s</div></nav>' % "".join(chips))

    opening = ('<article class="card open mo">'
               '<p class="kk">Read this first</p>'
               '<p>%s</p>'
               '<p>Nothing here is smoothed over. Each passage below carries its own badge and its '
               'own sources, the sermon’s own words are given in Arabic and in English, and where a '
               'beloved line belongs to another day of that same pilgrimage, the page says so '
               'instead of borrowing it quietly.</p>'
               '%s%s</article>'
               % (esc(s["honesty"]), refs_html(s.get("refs")), keys_html()))

    arafah = ('<section class="rsec" id="arafah">'
              '<p class="sh-n">The day itself</p>'
              '<div class="sh"><span class="ar notranslate" translate="no">عَرَفَة</span>'
              '<h2>The plain of Arafah, the ninth of Dhul Hijjah</h2></div>'
              '<p class="sub">Arafah is the standing that Hajj cannot be completed without: a '
              'single afternoon in one wide valley outside Makkah, spent in supplication until the '
              'sun goes down. In the year 10 AH the Prophet ﷺ made that standing once, at sixty '
              'three years of age, about three months before his death, and he used it to speak.</p>'
              + fig_arafah() +
              '<article class="card mo"><div class="ch"><h3>The verse that came down while he stood</h3>%s</div>'
              '<p>Umar ibn al Khattab was once told by a man of the Jews that a verse in the '
              'Muslims’ book was worth a festival of its own, and he named this one. Umar answered '
              'that he knew exactly where and when it came down: on the day of Arafah, on a Friday, '
              'while the Messenger of Allah ﷺ was standing in that valley.</p>'
              '<p class="qv fa notranslate" translate="no" dir="rtl" lang="ar">الْيَوْمَ أَكْمَلْتُ '
              'لَكُمْ دِينَكُمْ وَأَتْمَمْتُ عَلَيْكُمْ نِعْمَتِي وَرَضِيتُ لَكُمُ الْإِسْلَامَ دِينًا</p>'
              '<p class="qe">This day I have perfected for you your religion, and completed My '
              'favour upon you, and approved for you Islam as religion.</p>'
              '%s</article>'
              '</section>'
              % (badge("quran"), refs_html(["Qur’an 5:3", "Bukhari 45", "Muslim 3017"])))

    parts = []
    for i, sec in enumerate(secs):
        parts.append(passage_html(i, sec))
        if i == 1:
            parts.append(fig_rights_section())
    passages = "".join(parts)

    chain = ('<section class="rsec" id="chain">'
             '<p class="sh-n">How it reached you</p>'
             '<div class="sh"><span class="ar notranslate" translate="no">الْإِسْنَاد</span>'
             '<h2>The chain, from the valley to this page</h2></div>'
             '<p class="sub">Al isnad, the chain of transmission, is the machinery Islam built so '
             'that words like these could not drift. Every link is named, every named man is '
             'examined, and where the examination comes back weak the report is labelled weak and '
             'kept out of the sound collections.</p>'
             + fig_chain() +
             '<article class="card mo"><div class="ch"><h3>What this means for the version you have seen</h3>%s</div>'
             '<p>The smooth single speech that circulates online is a stitched text, and stitching '
             'is not transmission. Some of its most quoted lines are authentic but were spoken at '
             'Mina rather than at Arafah, some are authentic from other days entirely, and a few '
             'flourishes have no strong chain at all. None of that touches the core, which stands '
             'in Sahih Muslim and Sahih Bukhari and is quoted above in full.</p>'
             '<p>The honest way to carry the Farewell Sermon is the way the companions carried it: '
             'say what was said, name where it was said, and let the labels stand in the open. A '
             'sermon that survived fourteen centuries on the strength of naming its sources is not '
             'served by a version that hides them.</p>'
             '%s</article>'
             '</section>' % (badge("editorial"), refs_html(["Muslim 1218", "Bukhari 1741",
                                                            "Musnad Ahmad 23489"])))

    main = (nav + '<div class="wrap">' + opening + arafah + passages +
            chain + band("The Last Sermon room keeps being tightened: sourcing checked, wording "
                         "softened, labels made plainer, wave after wave, as readers write back.") +
            "</div>")

    jsonld = ('<script type="application/ld+json">%s</script>' % json.dumps({
        "@context": "https://schema.org", "@type": "Article",
        "headline": "The Last Sermon",
        "url": "https://noorcodex.com/sermon",
        "description": ("The Farewell Sermon of the Prophet Muhammad ﷺ at Arafah, rendered "
                        "faithfully from the authentic narrations, with each part labeled by its "
                        "source strength."),
        "publisher": {"@type": "Organization", "name": "NOOR · Codex of Light"},
    }, ensure_ascii=False))

    return shell(
        slug="sermon",
        title="The Last Sermon",
        desc=("The Farewell Sermon at Arafah, passage by passage, in the Prophet’s ﷺ own words "
              "with their Arabic, every part badged by the strength of its evidence, and the "
              "composite version named honestly for what it is."),
        ar="خُطْبَةُ الْوَدَاع",
        kick="The Farewell Sermon",
        h1="The last thing he said to everyone at once",
        lead=("On the ninth of Dhul Hijjah in the year 10 AH the Prophet ﷺ rode into the valley at "
              "Arafah and spoke to the largest gathering of his life, about a hundred thousand "
              "pilgrims who had come to learn their Hajj from him. It was his last public address, "
              "given roughly three months before his death, and he delivered it like a man setting "
              "his house in order while there was still time."),
        main=main,
        css=CSS_BASE + CSS_SERMON,
        extra_js=JS,
        jsonld=jsonld,
        footline="The Last Sermon is free forever, like every room in the Codex.",
    )


def fig_rights_section():
    return ('<section class="rsec" id="rights">'
            '<p class="sh-n">What he fenced</p>'
            '<div class="sh"><span class="ar notranslate" translate="no">الْحُرُمَات</span>'
            '<h2>The three he made sacred</h2></div>'
            '<p class="sub">Read together, the sanctities he named at Arafah and at Mina form one '
            'fence with three bands around every believer: the life, the property, the good name. '
            'They are the sermon’s legal core, and the part of it that is quoted in courts and in '
            'khutbahs to this day.</p>'
            + fig_rights() + "</section>")


# ==========================================================================
# SOUL · figures
# ==========================================================================

# id, Arabic, title, gloss (also used inside the journey figure), nav chip
SOUL_STATIONS = [
    ("breath", "الْمَوْت", "The Final Breath", "al mawt, death", "The breath"),
    ("departure", "قَبْضُ الرُّوح", "The Departure of the Soul",
     "qabd al ruh, the taking of the soul", "Departure"),
    ("washing", "الْغُسْلُ وَالصَّلَاة", "The Washing and the Prayer",
     "al ghusl wa al salah, the washing and the prayer", "Washing"),
    ("grave", "سُؤَالُ الْقَبْر", "The Grave and Its Questioning",
     "su’al al qabr, the questioning of the grave", "The grave"),
    ("barzakh", "الْبَرْزَخ", "The Barzakh, the World Between",
     "al barzakh, the barrier between", "Barzakh"),
    ("trumpet", "النَّفْخُ فِي الصُّور", "The Blowing of the Trumpet",
     "al nafkh fi al sur, the blowing of the horn", "The trumpet"),
    ("gathering", "الْحَشْر", "The Gathering", "al hashr, the gathering", "Gathering"),
    ("scales", "الْمِيزَان", "The Scales", "al mizan, the balance", "The scales"),
    ("bridge", "الصِّرَاط", "The Bridge", "al sirat, the path over the Fire", "The bridge"),
    ("homes", "الدَّارَان", "The Two Homes", "al daran, the two abodes", "Two homes"),
]


def fig_journey():
    top, gap = 52, 56
    parts = []
    ys = [top + gap * i for i in range(10)]
    d = "M104 %d" % (ys[0] - 26)
    for i, y in enumerate(ys):
        d += " L104 %d" % y
    d += " L104 %d" % (ys[-1] + 22)
    parts.append('<path class="s1" d="%s"/>' % d)
    for i, (y, st) in enumerate(zip(ys, SOUL_STATIONS)):
        parts.append('<circle class="s1 f1 nd n%d" cx="104" cy="%d" r="11"/>' % (i + 1, y))
        parts.append('<circle class="f2 nc n%d" cx="104" cy="%d" r="4"/>' % (i + 1, y))
        parts.append('<path class="s3" d="M115 %d H136"/>' % y)
        parts.append('<text class="fl" x="146" y="%d">%s</text>' % (y - 2, st[2]))
        parts.append('<text class="fs" x="146" y="%d">%s</text>' % (y + 16, st[3]))
    ylast = ys[-1] + 22
    parts.append('<path class="s1" d="M104 %d Q104 %d 152 %d"/>' % (ylast, ylast + 28, ylast + 32))
    parts.append('<path class="s3" d="M104 %d Q104 %d 56 %d"/>' % (ylast, ylast + 28, ylast + 32))
    parts.append('<circle class="f1" cx="152" cy="%d" r="15"/>' % (ylast + 32))
    parts.append('<circle class="f2" cx="152" cy="%d" r="4.5"/>' % (ylast + 32))
    parts.append('<circle class="s3" cx="56" cy="%d" r="9"/>' % (ylast + 32))
    parts.append('<text class="fg" x="176" y="%d">the Garden</text>' % (ylast + 38))
    parts.append('<text class="fs" x="56" y="%d" text-anchor="middle">the Fire</text>'
                 % (ylast + 60))
    height = ylast + 78
    svg = ('<svg viewBox="0 0 480 %d" role="img" aria-label="The whole journey drawn as one '
           'thread: ten stations from the final breath down through the grave, the barzakh, the '
           'trumpet, the gathering, the scales and the bridge, ending where the road forks into '
           'two homes.">' % height
           + "".join(parts) +
           '<text class="fs" x="104" y="26" text-anchor="middle">one thread</text>'
           "</svg>")
    legend = [
        "One line, ten stations. Nothing on it is hidden from you: every stage below is named in "
        "the Qur’an or in authentic hadith, and this page walks them in order.",
        "The nodes light one after another because the journey is travelled that way, one station "
        "at a time, and never faster than Allah appoints.",
        "The thread does not end in a place you cannot reach. It ends at a fork, and the whole "
        "religion is about which branch a life was quietly leaning toward.",
    ]
    cap = ("<b>Qur’an 23:100, 39:68 and 75:22.</b> Behind them is a barrier until the day they are "
           "raised; then the Trumpet is blown; and faces that day will be radiant, looking at "
           "their Lord.")
    return fig(svg, legend, cap)


def fig_questioning():
    svg = (
        '<svg viewBox="0 0 480 322" role="img" aria-label="Three questions rising out of the '
        'grave as three drawn arcs toward one light: who is your Lord, what is your religion, and '
        'what did you say about this man.">'
        '<circle class="f1" cx="240" cy="40" r="26"/>'
        '<circle class="f2" cx="240" cy="40" r="6"/>'
        '<circle class="s3" cx="240" cy="40" r="36"/>'
        '<path class="s1" d="M200 236 C142 202 96 162 92 120"/>'
        '<path class="s1" d="M240 236 C266 190 254 148 240 106"/>'
        '<path class="s1" d="M280 236 C338 202 384 162 388 120"/>'
        '<path class="s3" d="M20 236H460"/>'
        '<rect class="s3" x="170" y="236" width="140" height="30" rx="10"/>'
        '<text class="fs" x="92" y="104" text-anchor="middle">who is your Lord?</text>'
        '<text class="fs" x="240" y="90" text-anchor="middle">what is your religion?</text>'
        '<text class="fs" x="388" y="90" text-anchor="middle">what did you say</text>'
        '<text class="fs" x="388" y="106" text-anchor="middle">about this man?</text>'
        '<text class="fl" x="240" y="292" text-anchor="middle">the answer is not learned here</text>'
        '<text class="fs" x="240" y="312" text-anchor="middle">it is the life, handed back to the one who lived it</text>'
        "</svg>")
    legend = [
        "Two angels sit the believer up and ask three questions. They are the shortest exam ever "
        "set and the only one that cannot be revised for at the door.",
        "The Prophet ﷺ taught that the firm answer is the gift named in the verse: Allah keeps "
        "firm those who believe with the firm word, in this life and in the hereafter.",
        "The hypocrite in the same narration answers: I do not know, I used to say what the people "
        "said. Nobody is caught out; each one says in the grave what he was already saying above it.",
    ]
    cap = ("<b>Bukhari 1338, Bukhari 1369 and Qur’an 14:27.</b> The names Munkar and Nakir come in "
           "a narration Tirmidhi graded hasan gharib, good but solitary; the questioning itself is "
           "reported so widely that the scholars describe it as mutawatir in meaning, "
           "mass transmitted.")
    return fig(svg, legend, cap)


def fig_scales():
    scrolls = []
    for i in range(5):
        w = 66 - i * 8
        scrolls.append('<rect class="s2" x="%d" y="%d" width="%d" height="8" rx="4"/>'
                       % (96 - w // 2, 140 - i * 10, w))
    svg = (
        '<svg viewBox="0 0 480 342" role="img" aria-label="A balance: ninety nine scrolls of '
        'wrongdoing heaped in one pan and rising, and a single small card bearing the testimony of '
        'faith in the other pan, weighing it down.">'
        '<path class="s1" d="M240 290V116"/>'
        '<path class="s1" d="M182 290H298"/>'
        '<path class="s3" d="M150 302H330"/>'
        '<path class="s1" d="M96 86 L240 116 L384 146"/>'
        '<circle class="f2" cx="240" cy="116" r="5"/>'
        '<path class="s3" d="M96 86V150"/>'
        '<path class="s1" d="M58 150 Q96 190 134 150"/>'
        '<path class="s3" d="M384 146V208"/>'
        '<path class="s1" d="M346 208 Q384 248 422 208"/>'
        + "".join(scrolls) +
        '<rect class="s1 f1" x="361" y="178" width="46" height="30" rx="8"/>'
        '<path class="s3" d="M369 190h30M369 199h20"/>'
        '<text class="fs" x="104" y="48" text-anchor="middle">ninety nine scrolls,</text>'
        '<text class="fs" x="104" y="64" text-anchor="middle">each as far as the eye sees</text>'
        '<text class="fl" x="384" y="264" text-anchor="middle">one card</text>'
        '<text class="fs" x="384" y="282" text-anchor="middle">there is no god but Allah</text>'
        '<text class="fs" x="240" y="332" text-anchor="middle">you will not be wronged</text>'
        "</svg>")
    legend = [
        "The scale in the Qur’an is described as exact rather than frightening: not the weight of "
        "a mustard seed is lost, and no soul is treated unjustly at all.",
        "In the hadith of the card, the scrolls are real and are not denied by the man they belong "
        "to. What tips the balance is the weight of a word he meant.",
        "It is not a licence to sin. The man in the report is a believer whose record is being "
        "weighed, not someone who chose wrong on the calculation that a word would cancel it.",
    ]
    cap = ("<b>Qur’an 21:47 and Tirmidhi 2639.</b> Tirmidhi records the hadith of the card and "
           "grades it hasan gharib, good but solitary in its route; Ibn Majah and Ahmad carry it "
           "too, and hadith scholars of our era have graded the chain sahih, sound. Nothing is "
           "heavy beside the name of Allah.")
    return fig(svg, legend, cap)


def fig_bridge():
    hatch = []
    for i, w in enumerate((152, 138, 124, 108, 92, 74, 54)):
        y = 198 + i * 11
        hatch.append('<path class="s3" d="M%d %d H%d"/>' % (240 - w, y, 240 + w))
    svg = (
        '<svg viewBox="0 0 480 300" role="img" aria-label="A thin span drawn across a dark gulf, '
        'small lights crossing it at different speeds, and one lamp waiting on the far side.">'
        '<text class="fg" x="240" y="44" text-anchor="middle">al sirat</text>'
        '<text class="fs" x="240" y="64" text-anchor="middle">the path laid over the Fire</text>'
        '<circle class="s3" cx="434" cy="80" r="20"/>'
        '<circle class="f1" cx="434" cy="80" r="12"/>'
        '<circle class="f2" cx="434" cy="80" r="4.5"/>'
        '<path class="s1" d="M46 132 Q240 168 434 132"/>'
        '<path class="s2" d="M22 132H70"/>'
        '<path class="s2" d="M410 132H458"/>'
        '<path class="s3" d="M46 132V184"/>'
        '<path class="s3" d="M434 132V184"/>'
        '<circle class="f2 cross c1" cx="46" cy="132" r="4"/>'
        '<circle class="f2 cross c2" cx="46" cy="132" r="3"/>'
        '<circle class="f2 cross c3" cx="46" cy="132" r="3.4"/>'
        + "".join(hatch) +
        '<text class="fs" x="22" y="120">from the gathering</text>'
        '<text class="fs" x="462" y="122" text-anchor="end">to the two homes</text>'
        '<text class="fl" x="240" y="288" text-anchor="middle">O Allah, grant safety, grant safety</text>'
        "</svg>")
    legend = [
        "The prophets stand at the sides of it with one prayer on their lips, and it is a prayer "
        "for other people: O Allah, grant safety, grant safety.",
        "The believers cross by the light they carry, and the light is not issued at the edge. It "
        "is what an ordinary life was already made of.",
        "Nobody crosses on his own strength. The narrations end the same way each time, with "
        "people delivered by the mercy of Allah rather than by their own speed.",
    ]
    cap = ("<b>Bukhari 7439 and Muslim 183.</b> The long hadith of the intercession describes some "
           "crossing like the blink of an eye, some like lightning, some like the wind, some like "
           "fine horses, and some walking or barely getting across. Honesty requires the note that "
           "these details come through several narrations whose wording and order differ; what is "
           "agreed across the sound collections is the crossing itself, the light carried over it, "
           "and the prayer of the prophets beside it.")
    return fig(svg, legend, cap)


# ==========================================================================
# SOUL · the stations
# ==========================================================================

def soul_card(title, level, ps, refs, cls="card mo"):
    body = "".join("<p>%s</p>" % esc(p) for p in ps)
    return ('<article class="%s"><div class="ch"><h3>%s</h3>%s</div>%s%s</article>'
            % (cls, esc(title), badge(level), body, refs_html(refs)))


def json_card(sec):
    return soul_card(sec["h"], sec.get("level", "sunnah"), paras(sec["body"]), sec.get("refs"))


def stop(text):
    return ('<div class="stop mo"><p class="sk">A thought to stop on</p><p>%s</p></div>'
            % esc(text))


NEW = {}

NEW["body_rights"] = soul_card(
    "What the Living Owe the Body", "sunnah",
    ["The body that carried a soul is not waste to be disposed of. It is a trust with rights, and "
     "the community around it owes four: al ghusl, the washing; al kafan, the shrouding; salat al "
     "janazah, the prayer over it; and al dafn, the burial. They are fard kifayah, a duty on the "
     "community as a whole, which means that if nobody does them everybody has sinned, and once "
     "enough hands take them up the rest are released.",
     "Umm Atiyya reported that when his daughter died the Prophet ﷺ came to the women and said: "
     "’Wash her three times, or five, or more than that if you see fit, with water and lotus "
     "leaves, and put camphor in the last washing.’ Then he handed them his own waist wrapper and "
     "said: ’Shroud her in it.’ He himself ﷺ was shrouded in three plain white Yemeni cloths, "
     "with no shirt and no turban, dressed at the end no differently from any other man.",
     "Every instruction points the same direction: modesty, gentleness, speed without hurry, no "
     "display and no expense. He taught that the funeral should be carried without delay, and he "
     "forbade the wailing and the tearing of clothes that the age of ignorance had made into "
     "theatre. The last kindness a person receives from human hands is meant to be quiet."],
    ["Bukhari 1253", "Muslim 939", "Bukhari 1264", "Muslim 941", "Muslim 944"])

NEW["janazah"] = soul_card(
    "The Prayer With No Bowing In It", "sunnah",
    ["Salat al janazah, the funeral prayer, has no ruku, no bowing, and no sujud, no prostration. "
     "It is four takbirat, four sayings of Allahu akbar, standing: praise of Allah, then the "
     "sending of blessings upon the Prophet ﷺ, then, in the place where a worshipper would "
     "ordinarily ask something for himself, an undivided plea for someone who can no longer ask "
     "for anything.",
     "Awf ibn Malik once heard the wording so clearly that he wished he were the dead man: ’O "
     "Allah, forgive him and have mercy on him, grant him peace and pardon him. Make his entry "
     "generous and his resting place wide. Wash him with water and snow and hail, and cleanse him "
     "of his sins as a white garment is cleansed of dirt. Give him a home better than his home, a "
     "family better than his family, and a spouse better than his spouse.’",
     "The reward for standing there is named plainly, so that nobody treats it as a formality. "
     "Whoever follows a funeral until the prayer is offered has one qirat, a measure of reward, "
     "and whoever stays until the burial has two, and the Prophet ﷺ said each qirat is like a "
     "great mountain. And when forty believers who associate nothing with Allah stand and ask for "
     "a dead person, he ﷺ said their intercession for him is accepted."],
    ["Muslim 963", "Muslim 945", "Muslim 948"])

NEW["tears"] = soul_card(
    "The Tears He Wept", "sunnah",
    ["When his infant son Ibrahim was dying in his arms, the Prophet ﷺ wept. Abd al Rahman ibn "
     "Awf, seeing it, asked him about it, and he answered: ’This is mercy,’ and then said: ’The "
     "eye sheds tears and the heart grieves, and we say nothing except what pleases our Lord. And "
     "we are grieved by your parting, O Ibrahim.’",
     "This is the boundary the Sunnah draws around grief, and it is drawn wide. Tears are mercy, "
     "not weakness of faith. What he forbade was the practice of the age of ignorance: the hired "
     "wailing, the striking of cheeks, the tearing of clothes, the calling out against the decree. "
     "You may weep for as long as you weep. You are asked only not to say, while weeping, what you "
     "would not want to be answered for."],
    ["Bukhari 1303", "Muslim 2315", "Bukhari 1294"])

NEW["gathering_bare"] = soul_card(
    "Barefoot, Bare, and Unmarked", "sunnah",
    ["’You will be gathered barefoot, naked and uncircumcised,’ he ﷺ said, and then recited: ’As "
     "We began the first creation, We will repeat it.’ Aisha asked whether the men and the women "
     "would be looking at one another, and he answered: ’The matter is graver than that for them "
     "to be looking at one another.’",
     "The gathering removes every mark a person is ranked by in this world: no cloth, no title, no "
     "property, no lineage, no accent, no address. It is the same levelling he announced from the "
     "camel at Arafah, only now visible. Whatever you are quietly ashamed of in your "
     "circumstances, it is not what you will be standing in."],
    ["Bukhari 6527", "Muslim 2859", "Qur’an 21:104"])

NEW["gathering_shade"] = soul_card(
    "The Shade on a Day With No Shade", "sunnah",
    ["On that day the sun is brought near, and the only shade is the shade Allah gives. He ﷺ "
     "named seven whom Allah shelters in His shade on a day when there is no shade but His: a just "
     "ruler; a young person raised in the worship of Allah; a man whose heart is attached to the "
     "mosques; two who loved one another for Allah, meeting upon that and parting upon that; a man "
     "called by a woman of position and beauty who answered, I fear Allah; one who gave charity so "
     "secretly that his left hand did not know what his right hand had given; and one who "
     "remembered Allah alone and his eyes overflowed.",
     "Not one of the seven is a spectacular life. They are a fair decision, a young habit, a "
     "walk to the mosque, a friendship, a refusal nobody saw, a gift nobody counted, and tears in "
     "an empty room. The shade of that day is being built now, in ordinary weeks."],
    ["Bukhari 660", "Muslim 1031"])

NEW["gathering_questions"] = soul_card(
    "The Questions Before the Feet Move", "sunnah",
    ["’The two feet of a servant will not move on the Day of Resurrection until he is asked about "
     "four things: his life, and how he spent it; his knowledge, and what he did with it; his "
     "wealth, where he earned it and where he spent it; and his body, and in what he wore it out.’ "
     "Tirmidhi transmits it and grades it hasan, good: strong enough to act upon, below the "
     "highest grade of sahih, sound.",
     "Every one of the four is about ordinary hours rather than extraordinary ones. Not what you "
     "achieved, but what you spent; not what you knew, but what you did with it; not how much you "
     "had, but where it came from and where it went."],
    ["Tirmidhi 2417"])

NEW["mizan"] = soul_card(
    "The Scale That Wrongs Nobody", "quran",
    ["’And We place the scales of justice for the Day of Resurrection, so no soul will be treated "
     "unjustly at all. And if there is the weight of a mustard seed, We will bring it forth. And "
     "sufficient are We as accountant.’ (21:47) The mizan, the balance, is described in the Qur’an "
     "as exact rather than terrifying. Its whole point is that nothing is lost and nothing is "
     "counted twice.",
     "’So whoever does an atom’s weight of good will see it, and whoever does an atom’s weight of "
     "evil will see it.’ (99:7-8) ’Then as for one whose scales are heavy, he will be in a "
     "pleasant life; but as for one whose scales are light, his refuge will be an abyss.’ (101:6-9) "
     "Nothing small enough to be beneath the weighing, and nothing large enough to escape it."],
    ["Qur’an 21:47", "Qur’an 99:7-8", "Qur’an 101:6-9"])

NEW["bitaqa"] = soul_card(
    "The Card That Outweighed Ninety Nine Scrolls", "sunnah",
    ["A man will be brought out before all creation, and ninety nine scrolls of his wrongdoing "
     "will be unrolled, each one stretching as far as the eye can see. He will be asked whether he "
     "denies any of it or was wronged by the recording angels, and he will say no. Then a single "
     "card will be brought out, a bitaqa the size of a palm, and on it: there is no god but Allah, "
     "and Muhammad is His servant and His Messenger. He will say: what is this card beside all "
     "these scrolls? And he will be told: you will not be wronged. The scrolls are set in one pan "
     "and the card in the other, and the scrolls fly up, and the card weighs heavier. ’And nothing "
     "is heavy beside the name of Allah.’",
     "Grading it honestly: Tirmidhi records it and calls it hasan gharib, good but solitary in its "
     "route; Ibn Majah and Ahmad carry it as well, and hadith scholars of our era have graded the "
     "chain sahih, sound. It is not a licence. The man in the report is a believer whose record is "
     "being weighed, not someone who chose wrong on the calculation that a word would cancel it. "
     "What the report measures is the weight of a word that was meant."],
    ["Tirmidhi 2639", "Ibn Majah 4300", "Musnad Ahmad"])

NEW["sirat"] = soul_card(
    "The Crossing", "sunnah",
    ["Al sirat, the path, is laid over Jahannam, the Fire, and the crossing of it is described in "
     "the long "
     "hadith of the intercession recorded by Bukhari and Muslim. The believers cross by the light "
     "they carry and at the speed of their deeds: some like the blink of an eye, some like "
     "lightning, some like the wind, some like fine horses, some walking, and some at the very "
     "last barely getting over. The prophets stand at its sides with one prayer repeated: ’O "
     "Allah, grant safety, grant safety.’",
     "The honest note belongs here rather than in a footnote. These details reach us through "
     "several narrations whose wording and order differ from one another, and the hadith scholars "
     "recorded that variation openly rather than smoothing it away. What is agreed and repeated "
     "across the sound collections is the crossing itself, the light carried over it, and the fact "
     "that everyone who arrives on the far side arrives by mercy and not by his own strength."],
    ["Bukhari 7439", "Muslim 183"])

NEW["light"] = soul_card(
    "The Light Each One Carries", "quran",
    ["’On the Day you see the believing men and believing women, their light proceeding before "
     "them and on their right.’ (57:12) The Qur’an sets that light beside the scene of those who "
     "ask the believers to wait so they can borrow from it, and are told to go back and look for a "
     "light of their own. (57:13)",
     "The light is not handed out at the edge of the crossing. It is what an ordinary life was "
     "already made of, gathered up and given back visibly. This is the reason the Sunnah keeps "
     "insisting on small steady acts over large intentions: the small ones are the fuel."],
    ["Qur’an 57:12", "Qur’an 57:13", "Qur’an 66:8"])

NEW["mercy"] = soul_card(
    "Two Homes, and Which Way the Mercy Leans", "sunnah",
    ["Both homes are real, and the Qur’an names them without softening either one. But the "
     "proportion between them was given to the Prophet ﷺ to announce: ’When Allah decreed the "
     "creation, He wrote in His book, which is with Him above the Throne: My mercy prevails over "
     "My wrath.’",
     "He described the last man to come out of the Fire and the last to enter the Garden, crawling "
     "out, asking for a little and then a little more, and given the world and ten times its like; "
     "and he ﷺ laughed as he told it, until his back teeth showed. He saw a woman among some "
     "captives searching for her child, and when she found him she pressed him to her and nursed "
     "him, and he asked his companions: do you think this woman would throw her child into the "
     "fire? They said no, never, not if she could help it. He said: ’Allah is more merciful to His "
     "servants than this woman is to her child.’",
     "And what waits in the Garden he refused to describe, except by saying it has never been "
     "seen: Allah says, ’I have prepared for My righteous servants what no eye has seen, no ear "
     "has heard, and no heart of any human being has ever conceived.’ Read the whole page again "
     "with that sentence in your hand. Nothing on this road was built to frighten you off it."],
    ["Bukhari 3194", "Muslim 2751", "Bukhari 6571", "Muslim 186", "Bukhari 5999", "Muslim 2754",
     "Bukhari 3244", "Muslim 2824"])

NEW["grief"] = (
    '<article class="card open mo">'
    '<p class="kk">If you have come here carrying a loss</p>'
    '<p>Read slowly, and take only what you can carry today. Nothing on this page was written to '
    'frighten you, and nothing here is a verdict on anyone you love: what happens to a particular '
    'soul is knowledge Allah kept for Himself, and the Sunnah forbids us from assigning anybody a '
    'seat in either home.</p>'
    '<p>The Prophet ﷺ wept when his own son died and called those tears mercy. If you are weeping, '
    'you are inside the Sunnah, not outside it. And there is something you can still do tonight: '
    'ask forgiveness for them by name, give something small on their behalf, settle a debt they '
    'left, keep a promise they made, and speak of them without malice. The door between you is not '
    'sealed; it only runs one way now, and it runs from you to them.</p>'
    '<p>Every station below carries its evidence in the open, with an honest badge where the '
    'scholars differ or where a beloved report is weaker than it is usually presented. Where a '
    'narration is weak, this page says so instead of borrowing its comfort quietly.</p>'
    + keys_html() + "</article>")


def station(i, sid, ar, title, gloss, cards, figure="", stopline=""):
    return ('<section class="rsec station" id="%s">'
            '<p class="sh-n">Station %s of ten</p>'
            '<div class="sh"><span class="ar notranslate" translate="no">%s</span><h2>%s</h2></div>'
            '<p class="tr">%s</p>'
            '%s%s%s</section>'
            % (sid, ORD[i], ar, esc(title), esc(gloss), figure, "".join(cards), stopline))


def soul_page(data):
    s = data["soul"]
    j = {i: sec for i, sec in enumerate(s["sections"])}

    chips = "".join('<a href="#%s">%s</a>' % (st[0], esc(st[4])) for st in SOUL_STATIONS)
    chips += '<a href="#after">Back in the world</a>'
    nav = ('<nav class="secnav" id="secnav" aria-label="The stations of the journey">'
           '<div class="secnav-in">%s</div></nav>' % chips)

    stops = [
        "If you are turning over what might have been done differently, the Qur’an answers before "
        "you finish the sentence: the term was written, and it was never yours to move. What is "
        "still yours is the du’a, the supplication, that you can make for them tonight.",
        "Two souls leave the same way and meet two different receptions, and the difference is not "
        "made at the end. It is made in ordinary weeks, in what a person kept saying and doing when "
        "nothing was at stake.",
        "Everything the living do for the dead is done gently, quickly, modestly and without "
        "display. It is the last kindness a body receives from human hands, and the Sunnah made it "
        "a duty rather than a favour.",
        "What is asked in the grave is not scholarship. It is allegiance, and it is answered in "
        "the language a life has already been speaking. Nobody is tricked at that door.",
        "They are not gone into nothing. They are held, and they can still receive. Give something "
        "on their behalf tonight, even something small, and ask for steadiness for them by name.",
        "The long waiting ends with a sound rather than a silence. Everyone who ever grieved is on "
        "the other side of that sound, standing, and the separation you are carrying has a "
        "known end.",
        "Every mark you are ranked by here is taken off at that door. Whatever you are quietly "
        "ashamed of in your circumstances, it is not what you will be standing in.",
        "Nothing is too small to be weighed, which means nothing is too small to be worth doing "
        "tonight. The scale was made exact so that no good you did in private is lost in the crowd.",
        "Nobody crosses on his own strength. The prophets stand there asking for the safety of "
        "people they never met, and the light you carry over it is the one being built now, in the "
        "ordinary week you are in.",
        "The road ends in a seeing. For the believer, everything before it, including the part "
        "that hurt, was the journey toward the One he already loved.",
    ]

    figs = {"breath": "", "departure": "", "washing": "", "grave": fig_questioning(),
            "barzakh": "", "trumpet": "", "gathering": "", "scales": fig_scales(),
            "bridge": fig_bridge(), "homes": ""}

    cards = {
        "breath": [json_card(j[0])],
        "departure": [json_card(j[1]), json_card(j[2])],
        "washing": [NEW["body_rights"], NEW["janazah"], NEW["tears"], json_card(j[7])],
        "grave": [json_card(j[3]), json_card(j[4])],
        "barzakh": [json_card(j[5]), json_card(j[6])],
        "trumpet": [json_card(j[8])],
        "gathering": [NEW["gathering_bare"], NEW["gathering_shade"], NEW["gathering_questions"]],
        "scales": [NEW["mizan"], NEW["bitaqa"]],
        "bridge": [NEW["sirat"], NEW["light"]],
        "homes": [json_card(j[9]), NEW["mercy"]],
    }

    body = "".join(
        station(i, st[0], st[1], st[2], st[3], cards[st[0]], figs[st[0]], stop(stops[i]))
        for i, st in enumerate(SOUL_STATIONS))

    after = ('<section class="rsec" id="after">'
             '<p class="sh-n">Back in the world</p>'
             '<div class="sh"><span class="ar notranslate" translate="no">الِاسْتِعْدَاد</span>'
             '<h2>Preparing, without dread</h2></div>'
             '<p class="sub">The page ends where you are standing: alive, with a week in front of '
             'you. The Sunnah asks for a remembrance that sweetens ordinary things, never a fear '
             'that poisons them.</p>'
             + json_card(j[10]) +
             '<article class="card mo"><div class="ch"><h3>What to do this week</h3>%s</div>'
             '<p>Write the will, even a short one, and tell someone where it is. Settle a debt, or '
             'ask for time in writing. Mend one severed tie, starting with the relative you have '
             'not called. Choose one small deed and keep it daily rather than choosing five and '
             'keeping none. Visit a grave, and say the greeting he taught for the people of those '
             'dwellings. Then go back to your life without gloom: he ﷺ forbade wishing for death, '
             'and he asked that nobody die except thinking the best of Allah.</p>'
             '<p>If you are the one grieving tonight, the shortest version of this whole page is '
             'three lines: their term was written and nobody left early; they are held, and they '
             'can still receive; and you can give to them tonight, by name.</p>%s</article>'
             '</section>' % (badge("editorial"),
                             refs_html(["Bukhari 2738", "Bukhari 5671", "Muslim 976",
                                        "Muslim 2877", "Muslim 1631"])))

    main = (nav + '<div class="wrap">' + NEW["grief"] + fig_journey() + body + after +
            band("The Journey of the Soul room is read most often by people in the middle of a "
                 "loss. If a line here was cold where it should have been merciful, write and "
                 "tell us, and it will be changed.") + "</div>")

    jsonld = ('<script type="application/ld+json">%s</script>' % json.dumps({
        "@context": "https://schema.org", "@type": "Article",
        "headline": "Death and the Journey of the Soul",
        "url": "https://noorcodex.com/soul",
        "description": ("Death and the journey of the soul in Islam: the appointed term, the "
                        "taking of the soul, the questioning, the barzakh, and the return, from "
                        "the Qur'an and authentic hadith, honestly graded."),
        "publisher": {"@type": "Organization", "name": "NOOR · Codex of Light"},
    }, ensure_ascii=False))

    return shell(
        slug="soul",
        title="Death and the Journey of the Soul",
        desc=("The ten stations of the journey after death in Islam: the final breath, the taking "
              "of the soul, the washing and the prayer, the grave and its questioning, the "
              "barzakh, the Trumpet, the gathering, the scales, the bridge and the two homes, "
              "each one carrying its evidence and its honest grading."),
        ar="رِحْلَةُ الرُّوح",
        kick="Death and the Journey of the Soul",
        h1="The one journey every reader of this page will make",
        lead=("The Qur’an and the Sunnah map this road in detail: the last breath, the leaving of "
              "the soul, the washing and the prayer of the living, the grave and its questioning, "
              "the long barzakh, the Trumpet, the gathering, the scales, the bridge and the two "
              "homes. None of it was revealed to frighten you, but so that a believer travels a "
              "road already drawn, toward a Lord already known, and so that grief, when it comes, "
              "has somewhere true to stand."),
        main=main,
        css=CSS_BASE + CSS_SOUL,
        extra_js=JS,
        jsonld=jsonld,
        footline="The Journey of the Soul is free forever, like every room in the Codex.",
    )


# ==========================================================================
# CSS
# ==========================================================================

CSS_BASE = """
/* the house menu: the shipped tailwind build carries no lg:flex utility, so the
   desktop row of the canonical header stays hidden above the burger breakpoint.
   Restored here for this room without touching the shared asset. */
@media (min-width:1024px){#site-header nav[aria-label="Primary"]{display:flex}}
html{scroll-behavior:auto}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
.secnav{position:sticky;top:3.5rem;z-index:30;background:rgba(255,254,247,.93);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid rgba(44,36,22,.08)}
.secnav-in{position:relative;display:flex;gap:.38rem;align-items:center;max-width:62rem;margin:0 auto;padding:.5rem 1rem;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}
.secnav-in::-webkit-scrollbar{display:none}
.secnav a{flex:0 0 auto;font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(44,36,22,.55);text-decoration:none;border:1px solid rgba(44,36,22,.13);border-radius:999px;padding:.3rem .68rem;background:#fff;transition:color .2s,border-color .2s,background .2s,box-shadow .2s;white-space:nowrap}
.secnav a:hover{color:#2C2416;border-color:rgba(201,162,39,.5)}
.secnav a.on{color:#1A160F;background:linear-gradient(135deg,#C9A227,#E9C86A);border-color:transparent;box-shadow:0 2px 12px rgba(201,162,39,.3)}
.rsec{scroll-margin-top:6.8rem}
.sh-n{font-size:.6rem;letter-spacing:.22em;text-transform:uppercase;font-weight:800;color:rgba(201,162,39,.95);margin:0 0 .35rem}
.rsec .sh{gap:.7rem}
.rsec .sh .ar{font-size:1.5rem;line-height:1.25}
.tr{font-size:.73rem;color:rgba(44,36,22,.48);margin:.3rem 0 0;letter-spacing:.02em}
.ch{display:flex;align-items:flex-start;justify-content:space-between;gap:.7rem;margin-bottom:.5rem}
.ch h2,.ch h3{margin:0}
.ch h2{font-size:1.32rem;font-weight:800;letter-spacing:-.01em}
.ch .evb{flex:0 0 auto;margin-top:.22rem}
.evb.mixed{color:#2b5f7a;border-color:rgba(43,95,122,.4);background:rgba(43,95,122,.08)}
.ref{display:inline-flex;align-items:center;gap:.35rem;line-height:1.4}
.ref.q{background:rgba(201,162,39,.09);border-color:rgba(201,162,39,.26);padding-inline-start:.3rem}
.vplay{transition:background .18s,color .18s}
.vplay:hover{background:rgba(244,212,106,.3)}
.open{margin-top:1.7rem;border-color:rgba(201,162,39,.3);box-shadow:0 8px 30px rgba(44,36,22,.07)}
.open .kk{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .6rem}
.keys{display:grid;grid-template-columns:1fr 1fr;gap:.5rem .9rem;margin-top:.95rem;padding-top:.9rem;border-top:1px solid rgba(44,36,22,.1)}
.keys div{display:flex;align-items:center;gap:.45rem;font-size:.71rem;color:rgba(44,36,22,.55);line-height:1.5}
.keys .evb{flex:0 0 auto}
@media (max-width:560px){.keys{grid-template-columns:1fr}}
.fig svg{width:100%;max-width:33rem;height:auto;display:block;margin:0 auto}
.fig svg text{font-family:Inter,system-ui,sans-serif}
.fa{font-family:Amiri,serif}
.fg{fill:#F4D46A;font-size:19px;font-weight:800;letter-spacing:.01em}
.fl{fill:#FFFEF7;fill-opacity:.82;font-size:15.5px;font-weight:600}
.fs{fill:#FFFEF7;fill-opacity:.5;font-size:13px;font-weight:500}
.s1{fill:none;stroke:#E9C86A;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.s2{fill:none;stroke:#FFFEF7;stroke-opacity:.6;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.s3{fill:none;stroke:#F4D46A;stroke-opacity:.32;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.f1{fill:#F4D46A;fill-opacity:.16}
.f2{fill:#F4D46A}
.leg{list-style:none;margin:1rem 0 0;padding:0;display:grid;gap:.45rem}
.leg li{position:relative;padding-inline-start:1rem;font-size:.75rem;line-height:1.7;color:rgba(255,254,247,.66)}
.leg li::before{content:"";position:absolute;inset-inline-start:0;top:.62rem;width:.36rem;height:.36rem;border-radius:50%;background:#E9C86A}
.fig .cap b{color:rgba(244,212,106,.85);font-weight:700}
.band{margin:3rem 0 .5rem;text-align:center;background:linear-gradient(170deg,#FFFDF3,#FFF6DB);border:1px solid rgba(201,162,39,.26);border-radius:20px;padding:1.6rem 1.2rem}
.band p{font-size:.82rem;color:rgba(44,36,22,.62);line-height:1.85;margin:0 auto .95rem;max-width:32rem}
.band .bl{display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap}
"""

CSS_SERMON = """
.rsec{padding-top:2.9rem}
.card.pass{padding:1.5rem 1.7rem 1.35rem;border-color:rgba(201,162,39,.24);box-shadow:0 6px 26px rgba(44,36,22,.055)}
@media (max-width:560px){.card.pass{padding:1.15rem 1.15rem 1.1rem}}
.pass p{font-size:.93rem;line-height:1.9;color:rgba(44,36,22,.82);max-width:34rem;margin:0 0 1rem}
.pass .ch h2{font-size:1.24rem}
.words{margin:.2rem 0 1.25rem;padding-block:1.05rem 1.05rem;padding-inline:1.15rem 0;border-inline-start:3px solid rgba(201,162,39,.55);max-width:34rem}
.words .wa{font-family:Amiri,serif;font-size:1.42rem;line-height:2.05;color:#2C2416;margin:0 0 .7rem;max-width:none}
.words .we{font-size:1.02rem;line-height:1.85;color:rgba(44,36,22,.9);font-weight:600;margin:0;max-width:none}
.aside{margin:.2rem 0 1.1rem;max-width:34rem;background:rgba(44,36,22,.03);border:1px dashed rgba(44,36,22,.2);border-radius:14px;padding:.9rem 1rem}
.aside .as-k{font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:rgba(44,36,22,.5);margin:0 0 .5rem}
.aside p{font-size:.8rem;line-height:1.8;color:rgba(44,36,22,.68);margin:0 0 .6rem}
.aside p:last-child{margin-bottom:0}
.aside .fa{font-size:1.05rem;color:#8a6d13}
.beside{margin:0 0 .4rem;max-width:34rem;border-top:1px solid rgba(201,162,39,.28);padding-top:.75rem}
.beside .bk{font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .4rem}
.beside .bt{font-size:.82rem;line-height:1.8;color:rgba(44,36,22,.62);margin:0 0 .5rem;font-style:italic}
.qv{font-family:Amiri,serif;font-size:1.3rem;line-height:2;color:#8a6d13;text-align:center;margin:.9rem 0 .5rem}
.qe{font-size:.86rem;line-height:1.8;color:rgba(44,36,22,.72);text-align:center;font-weight:600;margin:0 0 .6rem}
.dt{fill-opacity:.55}
"""

CSS_SOUL = """
.station{padding-top:2.9rem}
.station .card p{font-size:.89rem;line-height:1.88}
.stop{margin-top:1rem;border-radius:16px;padding:.95rem 1.1rem;background:linear-gradient(168deg,#FFFCEF,#FFF6DB);border:1px solid rgba(201,162,39,.3)}
.stop .sk{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .45rem}
.stop p{font-size:.83rem;line-height:1.85;color:rgba(44,36,22,.7);margin:0;max-width:34rem}
.nd{fill-opacity:.16}
@media (prefers-reduced-motion:no-preference){
.nc{animation:soulnode 6.5s ease-in-out infinite}
@keyframes soulnode{0%,72%,100%{opacity:.35}12%{opacity:1}}
.n1{animation-delay:0s}.n2{animation-delay:.28s}.n3{animation-delay:.56s}.n4{animation-delay:.84s}
.n5{animation-delay:1.12s}.n6{animation-delay:1.4s}.n7{animation-delay:1.68s}.n8{animation-delay:1.96s}
.n9{animation-delay:2.24s}.n10{animation-delay:2.52s}
.cross{animation:soulcross 8s linear infinite;transform-box:view-box;transform-origin:46px 132px}
@keyframes soulcross{0%{transform:translate(0,0);opacity:0}7%{opacity:1}50%{transform:translate(194px,18px)}93%{opacity:1}100%{transform:translate(388px,0);opacity:0}}
.c1{animation-duration:7s}
.c2{animation-duration:11s;animation-delay:2.2s}
.c3{animation-duration:15s;animation-delay:4.4s}
}
"""

# ==========================================================================
# JS · shared by both rooms
# ==========================================================================

JS = """<script>
(function(){
"use strict";
/* verse audio through the shared Mushaf voice */
document.querySelectorAll(".vplay").forEach(function(b){
  b.addEventListener("click",function(){
    if(window.playAyah){window.playAyah(b.getAttribute("data-ref"),b);}
  });
});
/* the rail follows the passage or station you are reading */
var rail=document.getElementById("secnav");
if(rail){
  var inn=rail.firstElementChild;
  var chips=[].slice.call(rail.querySelectorAll("a"));
  var secs=chips.map(function(a){return document.getElementById(a.getAttribute("href").slice(1));});
  var cur=-2, queued=false;
  function mark(){
    queued=false;
    var line=rail.getBoundingClientRect().bottom+28, i=-1;
    for(var j=0;j<secs.length;j++){
      if(secs[j]&&secs[j].getBoundingClientRect().top<=line)i=j;
    }
    if(i===cur)return;
    cur=i;
    chips.forEach(function(c,k){
      if(k===i){c.classList.add("on");c.setAttribute("aria-current","true");}
      else{c.classList.remove("on");c.removeAttribute("aria-current");}
    });
    var el=chips[i];
    if(el&&inn&&inn.scrollWidth>inn.clientWidth+4){
      var to=el.offsetLeft-(inn.clientWidth-el.offsetWidth)/2;
      if(inn.scrollTo){inn.scrollTo({left:to,behavior:"smooth"});}else{inn.scrollLeft=to;}
    }
  }
  window.addEventListener("scroll",function(){
    if(!queued){queued=true;window.requestAnimationFrame(mark);}
  },{passive:true});
  window.addEventListener("resize",mark,{passive:true});
  mark();
}
})();
</script>"""


# ==========================================================================

def build():
    data = json.load(open(SRC, encoding="utf-8"))
    for out, html, name in ((OUT_SERMON, sermon_page(data), "sermon.html"),
                            (OUT_SOUL, soul_page(data), "soul.html")):
        open(out, "w", encoding="utf-8").write(html)
        figs = html.count('class="fig mo-pop mo-draw"')
        plays = html.count('class="vplay"')
        print("%s written: %d bytes, %d figures, %d verse buttons, menu %s"
              % (name, len(html.encode("utf-8")), figs, plays,
                 "present" if 'id="site-header"' in html else "MISSING"))
    sm = open(OUT_SERMON, encoding="utf-8").read()
    print("red and black clarification note in sermon.html: %s"
          % ("present" if "A note on the words red and black" in sm else "MISSING"))



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
    _synergy("sermon.html", "soul.html")
