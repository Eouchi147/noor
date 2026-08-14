#!/usr/bin/env python3
# NOOR v49 - The Eid Room
# Builds /eid.html from build/eid-content.json through the canonical room
# shell. The shell (room.py) supplies head, menu, ink hero and footer; this
# file supplies the room: its CSS, its <main>, its six figures, its script.
#
# One room, both Eids. The page leads with whichever Eid is near or running
# and keeps the other one fully readable underneath it, because a reader who
# arrives in Rajab wanting to know how the Eid prayer works should not have
# to wait eight months to be told.
#
# House rules kept here on purpose:
#   no em dashes and no en dashes anywhere, in output or in comments
#   every Arabic term carries its English meaning immediately
#   Arabic in Amiri, dir rtl, class notranslate, translate no
#   every claim carries its evidence in the open, with an honest badge
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from room import shell  # noqa: E402

SRC = os.path.join(ROOT, "build", "eid-content.json")
OUT = os.path.join(ROOT, "eid.html")

LEVELS = {
    "quran": ("Qur’an", "Stated directly in the Qur’an"),
    "sunnah": ("Sunnah", "Established in the authentic Sunnah"),
    "debated": ("Scholars differ", "The scholars read this one differently"),
    "editorial": ("Editorial", "Our own counsel, drawn from the sources named"),
}


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "’"))


# ---------------------------------------------------------------------------
# evidence: the same badge system every other room uses
# ---------------------------------------------------------------------------

def refs_html(refs):
    if not refs:
        return ""
    out = []
    for r in refs:
        note = esc(r.get("note", ""))
        if r.get("k") == "quran":
            ref = esc(r.get("r", ""))
            out.append('<span class="ref q"><b>Qur’an</b>'
                       '<button type="button" class="vplay" data-ref="%s" '
                       'aria-label="Listen to Qur’an %s">%s ▸</button>'
                       '<span class="rn">%s</span></span>' % (ref, ref, ref, note))
        else:
            head = (esc(r.get("src", "")) + " " + esc(r.get("r", ""))).strip()
            out.append('<span class="ref"><b>%s</b><span class="rn">%s</span></span>'
                       % (head, note))
    return '<div class="refs">' + "".join(out) + "</div>"


def dua_html(c):
    if not c.get("arabic"):
        return ""
    extra = ('<p class="dx">' + esc(c["extra"]) + "</p>") if c.get("extra") else ""
    return ('<div class="dua">'
            '<p class="ar notranslate" translate="no" dir="rtl" lang="ar">%s</p>'
            '<p class="tl">%s</p>'
            '<p class="mn">%s</p>%s</div>'
            % (c["arabic"], esc(c.get("translit", "")), esc(c.get("meaning", "")), extra))


def card_html(c):
    label, hint = LEVELS.get(c.get("level", "editorial"), LEVELS["editorial"])
    ps = "".join("<p>%s</p>" % esc(p) for p in c.get("ps", []))
    return ('<article class="card mo">'
            '<div class="ch"><h3>%s</h3>'
            '<span class="evb %s mo-pop" title="%s">%s</span></div>%s%s%s</article>'
            % (esc(c.get("t", "")), esc(c.get("level", "editorial")), esc(hint),
               esc(label), ps, dua_html(c), refs_html(c.get("refs"))))


def section_html(sec, fig="", extra="", cls="", tag="section"):
    ar = esc(sec.get("ar", ""))
    return ('<%s class="rsec %s" id="%s">'
            '<div class="sh"><span class="ar notranslate" translate="no" dir="rtl" lang="ar">%s</span>'
            '<h2>%s</h2></div>'
            '<p class="tr">%s</p>'
            '<p class="sub">%s</p>%s%s%s</%s>'
            % (tag, cls, esc(sec["id"]), ar, esc(sec.get("title", "")),
               esc(sec.get("tr", "")), esc(sec.get("lead", "")), fig,
               "".join(card_html(c) for c in sec.get("cards", [])), extra, tag))


# ---------------------------------------------------------------------------
# the six figures. Every one is drawn on, every one carries meaning.
# ---------------------------------------------------------------------------

def fig(svg, legend, cap, cls=""):
    leg = "".join("<li>%s</li>" % l for l in legend)
    return ('<div class="fig mo-pop mo-draw ' + cls + '">' + svg +
            ('<ul class="leg">' + leg + "</ul>" if legend else "") +
            '<p class="cap">' + cap + "</p></div>")


def fig_wheel():
    """The Hijri year as a wheel, with the two Eids marked where they fall.

    Month names live outside the ring, the two Eids are numbered markers on it,
    and the two names are spelled out under the wheel. Nothing overlaps
    anything, which is the whole reason the numbers are there."""
    cx, cy, r = 240, 172, 96
    months = ["Muharram", "Safar", "Rabi I", "Rabi II", "Jumada I", "Jumada II",
              "Rajab", "Shaban", "Ramadan", "Shawwal", "Dhul Qadah", "Dhul Hijjah"]
    hot = (8, 9, 11)

    def pt(deg, rad):
        a = math.radians(deg)
        return cx + rad * math.cos(a), cy + rad * math.sin(a)

    def anchor(deg):
        c = math.cos(math.radians(deg))
        if abs(c) < 0.02:
            return "middle"
        return "start" if c > 0 else "end"

    ticks, labels = [], []
    for i in range(12):
        d = -90 + i * 30
        x1, y1 = pt(d, r - 7)
        x2, y2 = pt(d, r + 7)
        ticks.append('<line class="s3" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (x1, y1, x2, y2))
        md = -90 + (i + 0.5) * 30
        lx, ly = pt(md, r + 22)
        labels.append('<text class="%s" x="%.1f" y="%.1f" text-anchor="%s">%s</text>'
                      % ("fxg" if i in hot else "fx", lx, ly + 4, anchor(md), months[i]))

    def arc(d0, d1, cls):
        x0, y0 = pt(d0, r)
        x1, y1 = pt(d1, r)
        big = 1 if (d1 - d0) > 180 else 0
        return ('<path class="%s" d="M%.1f %.1f A%d %d 0 %d 1 %.1f %.1f"/>'
                % (cls, x0, y0, r, r, big, x1, y1))

    def mark(deg, n):
        mx, my = pt(deg, r)
        return ('<g class="eid-mark"><circle class="s1" cx="%.1f" cy="%.1f" r="15"/>'
                '<circle class="f2" cx="%.1f" cy="%.1f" r="9"/>'
                '<text class="fk" x="%.1f" y="%.1f" text-anchor="middle">%s</text></g>'
                % (mx, my, mx, my, mx, my + 4, n))

    def key(y, n, head, sub):
        return ('<circle class="f2" cx="44" cy="%d" r="7"/>'
                '<text class="fk" x="44" y="%d" text-anchor="middle">%s</text>'
                '<text class="fm" x="62" y="%d" text-anchor="start">%s</text>'
                '<text class="fx" x="62" y="%d" text-anchor="start">%s</text>'
                % (y - 5, y - 1, n, y, sub, y + 18, head))

    svg = (
        '<svg viewBox="0 0 480 412" role="img" aria-label="A wheel of the twelve Hijri months '
        'with Ramadan drawn as a lit arc, marker one at the first of Shawwal for Eid al-Fitr and '
        'marker two at the tenth of Dhul Hijjah for Eid al-Adha.">'
        '<circle class="s3" cx="240" cy="172" r="96"/>'
        + arc(-90 + 8 * 30, -90 + 9 * 30, "s1 arc-ram")
        + arc(-90 + 11 * 30, -90 + 11 * 30 + 10, "s1 arc-ten")
        + "".join(ticks) + "".join(labels)
        + mark(-90 + 9 * 30, "1")
        + mark(-90 + 11 * 30 + 9, "2")
        + '<text class="fl" x="240" y="168" text-anchor="middle">one Hijri year</text>'
        '<text class="fx" x="240" y="190" text-anchor="middle">354 days, so both move back</text>'
        + key(300, "1", "the first of Shawwal, the morning after the fast ends", "Eid al-Fitr")
        + key(348, "2", "the tenth of Dhul Hijjah, the morning after Arafah", "Eid al-Adha")
        + '<text class="fx" x="240" y="400" text-anchor="middle">the lit arc is Ramadan, the '
          'short one is the first ten days of Dhul Hijjah</text>'
        "</svg>")
    legend = [
        "Eid al-Fitr is the very next sunrise after Ramadan, the first of Shawwal, and it is "
        "never more than one day away from the end of the fasting.",
        "Eid al-Adha is the tenth of Dhul Hijjah, the morning after the pilgrims have stood at "
        "Arafah. The two are about seventy days apart, every year, forever.",
        "A Hijri year is about eleven days shorter than a Gregorian one, so both Eids walk "
        "backwards through the seasons and come round to the same weather roughly every "
        "thirty three years.",
    ]
    cap = ("<b>Qur\u2019an 9:36.</b> The number of months with Allah is twelve, in the register of "
           "Allah, from the day He created the heavens and the earth.")
    return fig(svg, legend, cap, cls="fig-wheel")


def fig_takbirat():
    """The extra takbirs of the Eid prayer, counted, both readings side by side."""
    def dots(y, n, cls, x0=200, gap=30):
        return "".join('<circle class="%s tk" cx="%d" cy="%d" r="8"/>' % (cls, x0 + i * gap, y)
                       for i in range(n))

    def row(y, label, n, cls, tail):
        return ('<text class="fl" x="30" y="%d" text-anchor="start">%s</text>' % (y + 5, label)
                + dots(y, n, cls)
                + '<text class="fs" x="%d" y="%d" text-anchor="start">%s</text>'
                % (200 + n * 30 + 4, y + 5, tail))

    svg = (
        '<svg viewBox="0 0 480 306" role="img" aria-label="The extra takbirs of the Eid prayer '
        'drawn as rows of counters: seven then five in the reading of the majority, three then '
        'three in the reading of Abu Hanifah.">'
        '<text class="fm" x="30" y="30" text-anchor="start">The majority</text>'
        '<text class="fx" x="30" y="50" text-anchor="start">Malik, al-Shafi\u2019i and Ahmad. All of '
        'them before the recitation.</text>'
        + row(88, "first rak\u2019ah", 7, "f2", "seven")
        + row(132, "second rak\u2019ah", 5, "f2", "five")
        + '<path class="s3" d="M30 166H450"/>'
        '<text class="fm" x="30" y="196" text-anchor="start">Abu Hanifah</text>'
        '<text class="fx" x="30" y="216" text-anchor="start">Three in each, and the second three '
        'come after the recitation.</text>'
        + row(252, "first rak\u2019ah", 3, "f1 s1", "before reciting")
        + row(292, "second rak\u2019ah", 3, "f1 s1", "after it, before bowing")
        + "</svg>")
    legend = [
        "Takbir here means saying Allahu akbar, Allah is greater, with the hands raised. These "
        "are the extra ones that only the Eid prayer has.",
        "The two counts come from different narrations, both of which exist. The schools are "
        "not guessing and neither of them is a modern invention.",
        "Nothing is invalidated by following your imam and losing count. There is no prostration "
        "of forgetfulness owed for a missed extra takbir in any school.",
    ]
    cap = ("<b>Abu Dawud 1149</b> for seven and five, <b>Ibn Abi Shaybah 5697</b> for the reports "
           "the Hanafis read. Follow the imam in front of you.")
    return fig(svg, legend, cap)


def fig_roads():
    """One road out, another road back."""
    svg = (
        '<svg viewBox="0 0 480 312" role="img" aria-label="A house on the left and a prayer '
        'ground with a dome on the right, joined by two different curving roads, one for going '
        'and one for returning.">'
        '<g class="hs"><path class="s1" d="M46 210h58v-46H46Z"/>'
        '<path class="s1" d="M38 164 75 134l37 30"/>'
        '<path class="s2" d="M66 210v-24h18v24"/></g>'
        '<text class="fx" x="75" y="244" text-anchor="middle">your door</text>'
        '<g class="ms"><path class="s1" d="M376 210h64v-56h-64Z"/>'
        '<path class="s1" d="M382 154a26 26 0 0 1 52 0"/>'
        '<path class="s2" d="M408 128v-9"/>'
        '<path class="s2" d="M392 210v-28a16 16 0 0 1 32 0v28"/></g>'
        '<text class="fx" x="408" y="244" text-anchor="middle">the prayer ground</text>'
        '<path class="s1 rd-out" d="M112 164q126 -62 250 -16"/>'
        '<path class="f2" d="M356 139l18 8-16 10Z"/>'
        '<path class="s2 rd-back" d="M370 192q-126 62 -250 16"/>'
        '<path class="f2" d="M126 201l-18 8 16 10Z"/>'
        '<text class="fm" x="240" y="112" text-anchor="middle">going</text>'
        '<text class="fm" x="240" y="270" text-anchor="middle">returning</text>'
        '<text class="fx" x="240" y="296" text-anchor="middle">a different street on the way '
        'home, every Eid, on purpose</text>'
        "</svg>")
    legend = [
        "Jabir reported it as a plain observed habit: on the day of Eid he \uFDFA would come back a "
        "different way. No reason was given with it.",
        "The reasons the scholars offer are their own reading and they say so. Both roads bearing "
        "witness, more people greeted, more houses that see a Muslim family walking to prayer.",
        "It costs nothing and takes an extra three minutes. Children remember the route.",
    ]
    cap = "<b>Bukhari 986.</b> When it was the day of Eid he would take a different way back."
    return fig(svg, legend, cap)


def fig_zakat_flow():
    """Household, a sa\u2019 measure, and the neighbour\u2019s door, all before the prayer."""
    svg = (
        '<svg viewBox="0 0 480 336" role="img" aria-label="A household on the left, a measure of '
        'grain in the middle and a neighbour on the right, the whole flow drawn inside a window '
        'that closes the moment the Eid prayer begins.">'
        '<path class="s3" d="M28 56h424v104H28Z"/>'
        '<text class="fx" x="40" y="44" text-anchor="start">the window: it must be in their '
        'hands before the prayer</text>'
        '<g class="zg"><path class="s1" d="M56 142h56v-40H56Z"/>'
        '<path class="s1" d="M48 102 84 78l36 24"/></g>'
        '<path class="s2" d="M132 122h48"/><path class="f2" d="M180 116l16 6-16 6Z"/>'
        '<g class="zsa"><path class="s1" d="M212 100h56l-9 42h-38Z"/>'
        '<path class="s1 gr" d="M215 100q25 -13 62 0"/></g>'
        '<path class="s2" d="M290 122h48"/><path class="f2" d="M338 116l16 6-16 6Z"/>'
        '<g class="zn"><path class="s1" d="M370 142h56v-40h-56Z"/>'
        '<path class="s1" d="M362 102 398 78l36 24"/>'
        '<path class="s2" d="M390 142v-22h16v22"/></g>'
        '<text class="fm" x="84" y="188" text-anchor="middle">every soul</text>'
        '<text class="fx" x="84" y="206" text-anchor="middle">under your roof</text>'
        '<text class="fm" x="240" y="188" text-anchor="middle">one sa\u2019</text>'
        '<text class="fx" x="240" y="206" text-anchor="middle">a volume, about 2.5 to 3 kg</text>'
        '<text class="fm" x="398" y="188" text-anchor="middle">a neighbour</text>'
        '<text class="fx" x="398" y="206" text-anchor="middle">who has less</text>'
        '<path class="s3" d="M28 244h424"/>'
        '<circle class="f2" cx="240" cy="244" r="7"/>'
        '<text class="fm" x="240" y="274" text-anchor="middle">the Eid prayer</text>'
        '<text class="fx" x="36" y="296" text-anchor="start">before this line: zakat al-fitr'
        '</text>'
        '<text class="fx" x="444" y="296" text-anchor="end">after it: an ordinary charity</text>'
        '<text class="fs" x="240" y="326" text-anchor="middle">still a good deed on either side, '
        'but only one side is the thing itself</text>'
        "</svg>")
    legend = [
        "Zakat al-fitr means the charity of the breaking of the fast. It is a quantity of food, "
        "owed per person, not a percentage of wealth.",
        "The sa\u2019 is a measure of volume from Madinah, roughly four double handfuls of an average "
        "adult. Communities convert it to a local weight and then to a price, which is why your "
        "masjid publishes a figure and we do not.",
        "The deadline is not decoration. Ibn Abbas reported the two outcomes in one sentence: "
        "before the prayer it is zakat al-fitr, after it is one charity among charities.",
    ]
    cap = ("<b>Bukhari 1503</b> and <b>Abu Dawud 1609.</b> A purification for the fasting person "
           "and food for the poor, given before the people go out to the prayer.")
    return fig(svg, legend, cap)


def fig_thirds():
    """The thirds of the sacrifice, drawn with dotted lines because they are custom."""
    cx, cy, r = 240, 120, 78
    cuts = []
    for i in range(3):
        a = math.radians(-90 + i * 120)
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        cuts.append('<path class="s2 dsh" d="M%d %d L%.1f %.1f"/>' % (cx, cy, x, y))
    svg = (
        '<svg viewBox="0 0 480 306" role="img" aria-label="A circle divided into three parts by '
        'dotted lines, labelled your house, family and neighbours, and the poor, with a note '
        'that the lines are dotted because the thirds are custom and not law.">'
        '<circle class="s1" cx="240" cy="120" r="78"/>'
        + "".join(cuts) +
        '<text class="fm" x="332" y="86" text-anchor="start">your house</text>'
        '<text class="fx" x="332" y="104" text-anchor="start">eat of it yourself</text>'
        '<text class="fm" x="148" y="86" text-anchor="end">the poor</text>'
        '<text class="fx" x="148" y="104" text-anchor="end">the verse names them</text>'
        '<text class="fm" x="240" y="232" text-anchor="middle">family and neighbours</text>'
        '<text class="fx" x="240" y="250" text-anchor="middle">a plate carried to the door</text>'
        '<text class="fs" x="240" y="288" text-anchor="middle">the lines are dotted on purpose: '
        'the fractions are custom, not law</text>'
        "</svg>")
    legend = [
        "Udhiya, also called qurbani, is the animal offered on the days of Eid al-Adha. One sheep "
        "or goat covers a household. A cow or a camel covers seven.",
        "The Qur\u2019an gives two instructions and no fractions: eat of it, and feed. The thirds are "
        "how the early community actually divided it, and the schools recommended that shape.",
        "Nothing may be sold out of it, including the skin, and the butcher is paid in money "
        "rather than in meat.",
    ]
    cap = ("<b>Qur\u2019an 22:28 and 22:36.</b> Eat of it and feed the hard pressed poor, and feed the "
           "one who is content and the one who asks.")
    return fig(svg, legend, cap)


def fig_tashriq():
    """The takbir of Tashriq as a run of twenty three prayers."""
    days = [("9", "Arafah", 5), ("10", "Eid", 5), ("11", "Tashriq", 5),
            ("12", "Tashriq", 5), ("13", "Tashriq", 3)]
    x0, w = 40, 80
    parts, n = [], 0
    for i, (d, name, count) in enumerate(days):
        mid = x0 + i * w + w / 2
        parts.append('<text class="fm" x="%.0f" y="118" text-anchor="middle">%s</text>' % (mid, d))
        parts.append('<text class="fx" x="%.0f" y="136" text-anchor="middle">%s</text>' % (mid, name))
        first = mid - (count - 1) * 13 / 2
        for j in range(count):
            n += 1
            parts.append('<circle class="f2 tq" cx="%.1f" cy="164" r="5.5"/>' % (first + j * 13))
        if i:
            parts.append('<path class="s3" d="M%d 100v84"/>' % (x0 + i * w))
    svg = (
        '<svg viewBox="0 0 480 282" role="img" aria-label="Five days from the ninth to the '
        'thirteenth of Dhul Hijjah, with one counter for each obligatory prayer after which the '
        'takbir is said, twenty three of them in all.">'
        '<text class="fm" x="40" y="34" text-anchor="start">the takbir of Tashriq</text>'
        '<text class="fx" x="40" y="56" text-anchor="start">said aloud after every obligatory '
        'prayer, from Fajr on the ninth</text>'
        '<text class="fx" x="40" y="74" text-anchor="start">of Dhul Hijjah to Asr on the '
        'thirteenth</text>'
        '<path class="s3" d="M40 100h400v84H40Z"/>'
        + "".join(parts) +
        '<text class="fx" x="40" y="206" text-anchor="start">starts at Fajr</text>'
        '<text class="fx" x="440" y="206" text-anchor="end">ends at Asr</text>'
        '<text class="fl" x="240" y="240" text-anchor="middle">' + str(n) +
        ' prayers in all</text>'
        '<text class="fx" x="240" y="262" text-anchor="middle">and most people have never been '
        'told that it exists</text>'
        "</svg>")
    legend = [
        "Tashriq means the laying out of meat to dry in the sun, which is what the three days "
        "after the Eid were for. The name stuck.",
        "The edges differ by school. Some begin at Zuhr on the tenth, some end at the close of "
        "the thirteenth. Every school agrees the middle of it is loud.",
        "It is said after the obligatory prayer, once, before the usual remembrance. Say it with "
        "your masjid rather than arguing about the boundary.",
    ]
    cap = ("<b>Qur\u2019an 2:203.</b> And remember Allah during numbered days. Al-Bukhari cites the "
           "practice of Ali and Ibn Abbas in his chapter on these days.")
    return fig(svg, legend, cap)


# ---------------------------------------------------------------------------
# the room's own blocks
# ---------------------------------------------------------------------------

def opening_html():
    keys = "".join(
        '<div><span class="evb %s">%s</span><span>%s</span></div>' % (k, esc(v[0]), esc(v[1]))
        for k, v in (("quran", ("Qur’an", "stated in the Book itself")),
                     ("sunnah", ("Sunnah", "established in authentic hadith")),
                     ("debated", ("Scholars differ", "read differently by the scholars")),
                     ("editorial", ("Editorial", "our own counsel, never revelation"))))
    return ('<article class="card open mo">'
            '<p class="kk">How this room works</p>'
            "<p>There are two Eids and only two. Everything else a Muslim community celebrates is "
            "a custom, which is not a criticism, only an accurate description. This one room "
            "holds both of them, because most of what they ask of you is identical: the same "
            "takbir, the same washing and the same best clothes, the same two rak’ahs with no "
            "call to prayer, the same sermon afterwards, the same instruction to take a different "
            "road home, the same absolute prohibition on fasting the day itself.</p>"
            "<p>The page leads with whichever Eid is nearest. The other one stays exactly where "
            "it is, fully readable, all year, because the question of how the Eid prayer works "
            "does not only occur to people in the week it is due.</p>"
            "<p>Every claim carries its evidence in the open: a verse you can hear recited aloud, "
            "a narration named by its collection and number, and an honest badge whenever the "
            "scholars differ or a line is our own counsel rather than revelation. Where there is "
            "a real disagreement, and on these two days there are several, both sides are given "
            "properly.</p>"
            '<div class="keys">%s</div></article>' % keys)


def lead_html(lead):
    """The banner that names the near Eid. Filled in by the calendar at load."""
    def side(key, d):
        return ('<a class="ec" id="ec-%s" href="#%s">'
                '<span class="ec-k" id="ec-k-%s">Eid</span>'
                '<span class="ar notranslate" translate="no" dir="rtl" lang="ar">%s</span>'
                '<b>%s</b>'
                '<span class="ec-tr">%s</span>'
                '<span class="ec-when">%s</span>'
                '<span class="ec-cd" id="ec-cd-%s">calculated from the tabular calendar</span>'
                "</a>" % (key, key, key, d["ar"], esc(d["name"]), esc(d["tr"]),
                          esc(d["when"]), key))

    return ('<section class="rsec" id="near">'
            '<div class="sh"><span class="ar notranslate" translate="no" dir="rtl" lang="ar">'
            'العِيدَان</span><h2>The two Eids</h2></div>'
            '<p class="tr">al-eidan, the two festivals</p>'
            '<p class="sub">Two days in the year, seventy days apart, that the religion itself '
            'appointed. The one that is nearest is marked below and this page leads with it.</p>'
            + fig_wheel() +
            '<div class="ecs">' + side("fitr", lead["fitr"]) + side("adha", lead["adha"]) +
            "</div>"
            '<p class="ecn" id="ecn">These dates are calculated, not sighted. Your masjid’s '
            'announcement is the date, and the offset control in the Ramadan Room moves this '
            'page with it.</p>'
            "</section>")


def zakat_calc_html():
    return (
        '<div class="zc card mo">'
        '<p class="zc-k">A quick reckoning</p>'
        '<p class="zc-l">Prices differ by country and by staple, so this asks you for the figure '
        'rather than pretending to know it. Your local masjid publishes the amount every year and '
        'that amount is the one that counts. This is an estimate to help you hand over the right '
        'sum before the prayer, and it is nothing more.</p>'
        '<div class="zc-in">'
        '<div class="zf"><label for="z-n">People in the household</label>'
        '<input id="z-n" type="number" min="1" step="1" value="4"/></div>'
        '<div class="zf"><label for="z-a">Amount per person</label>'
        '<input id="z-a" type="number" min="0" step="0.5" value="12"/></div>'
        '<div class="zf"><label for="z-c">Currency</label>'
        '<input id="z-c" type="text" maxlength="6" value="USD"/></div>'
        "</div>"
        '<p class="zc-out" id="z-out">4 people at 12 USD is <b>48 USD</b></p>'
        '<p class="zc-n">Count every soul who lives under your roof, including a baby born before '
        'sunset on the night of Eid and a guest staying with you. It must be in the hands of the '
        'poor before the Eid prayer. Ask your masjid for this year’s figure, because they set it '
        'and we do not.</p>'
        "</div>")


def adha_links_html():
    return ('<div class="fam-links mo">'
            '<a class="fl-c" href="/hajj#days">'
            '<span class="fl-k">The day before</span>'
            '<b>The Hajj Room</b>'
            '<span>What the pilgrims are doing on the ninth while you are fasting: the standing '
            'at Arafah, hour by hour, and the whole journey around it.</span></a>'
            '<a class="fl-c" href="/hajj#ihram">'
            '<span class="fl-k">If you are going</span>'
            '<b>Ihram and the boundary</b>'
            '<span>The state a pilgrim enters, what it forbids, and where it begins. Read it '
            'before you book anything.</span></a>'
            "</div>")


def family_links_html():
    return ('<div class="fam-links mo">'
            '<a class="fl-c" href="/kids/lanterns">'
            '<span class="fl-k">For the evening</span>'
            '<b>The Lantern Sky</b>'
            '<span>A child lights a lantern for something they are grateful for and watches it '
            'go up. Quiet, and made for exactly these evenings.</span></a>'
            '<a class="fl-c" href="/kids">'
            '<span class="fl-k">For the whole day</span>'
            '<b>The Kids’ Codex</b>'
            '<span>The story of everything, told at their height: the prophets, the animals of '
            'the Qur’an, and small games that leave something behind.</span></a>'
            "</div>")


def rooms_html():
    return ('<section class="rooms mo" id="rooms">'
            '<p class="rk">The rooms either side of this one</p>'
            '<div class="rl">'
            '<a class="rc rc-ram" href="/ramadan">'
            '<span class="rc-i" aria-hidden="true">'
            '<svg viewBox="0 0 24 24"><path d="M21.3 14.7A9.2 9.2 0 0 1 9.3 2.7a9.2 9.2 0 1 0 12 12z"/>'
            "</svg></span>"
            '<span class="rc-t"><span class="ar notranslate" translate="no" dir="rtl" lang="ar">'
            'رَمَضَان</span><b>The Ramadan Room</b>'
            '<span>The thirty days that Eid al-Fitr is the end of: today’s fasting window, the '
            'reading plan for the whole Qur’an, the last ten nights, and zakat al-fitr in '
            'full.</span></span></a>'
            '<a class="rc rc-hajj" href="/hajj">'
            '<span class="rc-i" aria-hidden="true">'
            '<svg viewBox="0 0 24 24"><path d="M4 20h16v-2H4Zm2-3h12V9l-6-5-6 5Zm4-2v-4h4v4Z"/>'
            "</svg></span>"
            '<span class="rc-t"><span class="ar notranslate" translate="no" dir="rtl" lang="ar">'
            'الحَجّ</span><b>The Hajj Room</b>'
            '<span>The pilgrimage that Eid al-Adha sits inside: the three ways to perform it, '
            'ihram, and the day at Arafah that the tenth of Dhul Hijjah follows.</span>'
            "</span></a>"
            "</div></section>")


# ---------------------------------------------------------------------------
CSS = """
/* an author display rule beats the browser's own [hidden], so say it once
   and plainly: anything marked hidden on this page is hidden. */
[hidden]{display:none!important}
html{scroll-behavior:auto}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
.secnav{position:sticky;top:3.5rem;z-index:30;background:rgba(255,254,247,.93);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid rgba(44,36,22,.08)}
.secnav-in{position:relative;display:flex;gap:.38rem;align-items:center;max-width:62rem;margin:0 auto;padding:.5rem 1rem;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}
.secnav-in::-webkit-scrollbar{display:none}
.secnav a{flex:0 0 auto;font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(44,36,22,.55);text-decoration:none;border:1px solid rgba(44,36,22,.13);border-radius:999px;padding:.3rem .68rem;background:#fff;transition:color .2s,border-color .2s,background .2s,box-shadow .2s;white-space:nowrap}
.secnav a:hover{color:#2C2416;border-color:rgba(201,162,39,.5)}
.secnav a.on{color:#1A160F;background:linear-gradient(135deg,#C9A227,#E9C86A);border-color:transparent;box-shadow:0 2px 12px rgba(201,162,39,.3)}
.rsec{scroll-margin-top:6.6rem}
.rsec .sh{gap:.7rem}
.rsec .sh .ar{font-size:1.55rem;line-height:1.2}
.tr{font-size:.73rem;color:rgba(44,36,22,.48);margin:.3rem 0 0;letter-spacing:.02em}
.open{margin-top:1.7rem;border-color:rgba(201,162,39,.3);box-shadow:0 8px 30px rgba(44,36,22,.07)}
.open .kk{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .6rem}
.keys{display:grid;grid-template-columns:1fr 1fr;gap:.5rem .9rem;margin-top:.95rem;padding-top:.9rem;border-top:1px solid rgba(44,36,22,.1)}
.keys div{display:flex;align-items:center;gap:.45rem;font-size:.71rem;color:rgba(44,36,22,.55);line-height:1.5}
.keys .evb{flex:0 0 auto}
@media (max-width:560px){.keys{grid-template-columns:1fr}}
.ch{display:flex;align-items:flex-start;justify-content:space-between;gap:.7rem;margin-bottom:.5rem}
.ch h3{margin:0}
.ch .evb{flex:0 0 auto;margin-top:.12rem}
.ref{display:inline-flex;align-items:center;gap:.35rem;line-height:1.4}
.ref .rn{font-weight:600;color:rgba(44,36,22,.5)}
.ref.q{background:rgba(201,162,39,.09);border-color:rgba(201,162,39,.26);padding-inline-start:.28rem}
.vplay{transition:background .18s,color .18s}
.vplay:hover{background:rgba(244,212,106,.3)}

/* the figures share the house drawing language */
.fig svg{width:100%;max-width:33rem;height:auto;display:block;margin:0 auto}
.fig svg text{font-family:Inter,system-ui,sans-serif}
.fg{fill:#F4D46A;font-size:19px;font-weight:800;letter-spacing:.01em}
.fl{fill:#FFFEF7;fill-opacity:.82;font-size:16px;font-weight:600}
.fs{fill:#FFFEF7;fill-opacity:.5;font-size:13.5px;font-weight:500}
.fx{fill:#FFFEF7;fill-opacity:.52;font-size:11.5px;font-weight:500}
.fxg{fill:#F4D46A;fill-opacity:.9;font-size:11.5px;font-weight:800}
.fm{fill:#F4D46A;font-size:15px;font-weight:800;letter-spacing:.01em}
.fk{fill:#14100A;font-size:10px;font-weight:800}
.s1{fill:none;stroke:#E9C86A;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.s2{fill:none;stroke:#FFFEF7;stroke-opacity:.6;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.s3{fill:none;stroke:#F4D46A;stroke-opacity:.32;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.f1{fill:#F4D46A;fill-opacity:.14}
.f2{fill:#F4D46A}
.dsh{stroke-dasharray:5 6}
.arc-ram{stroke-width:5;stroke-opacity:.95}
.arc-ten{stroke-width:5;stroke:#F0B7A8;stroke-opacity:.9}
.gr{stroke-opacity:.55}
.leg{list-style:none;margin:1rem 0 0;padding:0;display:grid;gap:.45rem}
.leg li{position:relative;padding-inline-start:1rem;font-size:.75rem;line-height:1.7;color:rgba(255,254,247,.66)}
.leg li::before{content:"";position:absolute;inset-inline-start:0;top:.62rem;width:.36rem;height:.36rem;border-radius:50%;background:#E9C86A}
.fig .cap b{color:rgba(244,212,106,.85);font-weight:700}

/* the two Eid cards at the top */
.ecs{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-top:1rem}
@media (max-width:620px){.ecs{grid-template-columns:1fr}}
.ec{display:block;text-decoration:none;color:inherit;border-radius:20px;padding:1.05rem 1.1rem;background:linear-gradient(168deg,#FFFCEF,#FFF6DB);border:1px solid rgba(201,162,39,.28);transition:transform .18s,box-shadow .18s,border-color .18s}
.ec:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(44,36,22,.1)}
.ec .ar{display:block;font-family:Amiri,serif;font-size:1.6rem;line-height:1.4;color:var(--gold)}
.ec b{display:block;font-size:1.05rem;margin:.15rem 0 .2rem}
.ec-k{display:inline-block;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:#8a6d13;border:1px solid rgba(201,162,39,.35);border-radius:999px;padding:.16rem .5rem}
.ec-tr{display:block;font-size:.72rem;color:rgba(44,36,22,.5);line-height:1.6}
.ec-when{display:block;font-size:.78rem;color:rgba(44,36,22,.66);line-height:1.7;margin-top:.4rem}
.ec-cd{display:block;font-size:.75rem;font-weight:700;color:#8a6d13;margin-top:.5rem;padding-top:.5rem;border-top:1px solid rgba(201,162,39,.24);line-height:1.6}
.ec.near{border-color:rgba(201,162,39,.62);box-shadow:0 10px 30px rgba(201,162,39,.16)}
.ec.near .ec-k{background:linear-gradient(135deg,#C9A227,#E9C86A);color:#1A160F;border-color:transparent}
.ecn{font-size:.72rem;color:rgba(44,36,22,.48);line-height:1.75;margin:.85rem 0 0}

/* the two Eid sections, reordered by the calendar */
#eids{display:flex;flex-direction:column}
.eidsec{border-radius:24px;padding:2rem 1.15rem 1.2rem;margin-top:1.6rem}
.eidsec.fitr{background:linear-gradient(172deg,#14100A,#161f38 62%,#1d2947);color:#FFFEF7}
.eidsec.adha{background:linear-gradient(172deg,#1A0E22,#3C1D42 58%,#6A2F4E);color:#FFFEF7}
.eidsec h2{color:#FFFEF7}
.eidsec .sh .ar{color:#F4D46A}
.eidsec .tr{color:rgba(255,254,247,.45)}
.eidsec .sub{color:rgba(255,254,247,.74)}
.eidsec .card{background:rgba(255,254,247,.05);border-color:rgba(244,212,106,.22);box-shadow:none}
.eidsec .card h3{color:#FFFEF7}
.eidsec .card p{color:rgba(255,254,247,.79)}
.eidsec .fig{background:rgba(255,254,247,.05);border-color:rgba(244,212,106,.26)}
.eidsec .ref{background:rgba(255,254,247,.07);border-color:rgba(255,254,247,.14);color:rgba(255,254,247,.7)}
.eidsec .ref b{color:#F4D46A}
.eidsec .ref .rn{color:rgba(255,254,247,.5)}
.eidsec .ref.q{background:rgba(244,212,106,.12);border-color:rgba(244,212,106,.3)}
.eidsec .vplay{background:rgba(244,212,106,.16);border-color:rgba(244,212,106,.4);color:#F4D46A}
.eidsec .vplay:hover{background:rgba(244,212,106,.3)}
.eidsec .evb.sunnah{color:#F4D46A;border-color:rgba(244,212,106,.45);background:rgba(244,212,106,.12)}
.eidsec .evb.quran{color:#8fd6ac;border-color:rgba(143,214,172,.4);background:rgba(143,214,172,.1)}
.eidsec .evb.debated{color:#c3aae4;border-color:rgba(195,170,228,.4);background:rgba(195,170,228,.1)}
.eidsec .evb.editorial{color:rgba(255,254,247,.6);border-color:rgba(255,254,247,.24);background:rgba(255,254,247,.06)}
.eidsec .lead-k{display:inline-block;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase;font-weight:800;border-radius:999px;padding:.2rem .6rem;background:linear-gradient(135deg,#C9A227,#E9C86A);color:#1A160F;margin-bottom:.7rem}
.eidsec.adha .lead-k{background:linear-gradient(135deg,#C98A2E,#F0B7A8)}

/* du'a blocks */
.dua{margin:.85rem 0 .2rem;border-radius:16px;padding:.95rem 1rem;background:linear-gradient(168deg,#FFFCEF,#FFF4D2);border:1px solid rgba(201,162,39,.32)}
.eidsec .dua{background:rgba(244,212,106,.09);border-color:rgba(244,212,106,.3)}
.dua .ar{font-family:Amiri,serif;font-size:1.5rem;line-height:2.1;color:#2C2416;margin:0;text-align:end}
.eidsec .dua .ar{color:#F4D46A}
.dua .tl{font-size:.82rem;font-weight:700;color:rgba(44,36,22,.72);margin:.55rem 0 0;line-height:1.7}
.eidsec .dua .tl{color:rgba(255,254,247,.82)}
.dua .mn{font-size:.83rem;color:rgba(44,36,22,.66);margin:.3rem 0 0;line-height:1.8}
.eidsec .dua .mn{color:rgba(255,254,247,.7)}
.dua .dx{font-size:.72rem;color:rgba(44,36,22,.5);margin:.55rem 0 0;line-height:1.7;padding-top:.5rem;border-top:1px solid rgba(201,162,39,.25)}
.eidsec .dua .dx{color:rgba(255,254,247,.55);border-top-color:rgba(244,212,106,.22)}

/* zakat reckoning */
.zc{border-color:rgba(201,162,39,.3)}
.zc-k{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .5rem}
.eidsec .zc-k{color:#F4D46A}
.zc-l{font-size:.8rem;line-height:1.8;color:rgba(44,36,22,.66);margin:0 0 .85rem}
.zc-in{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem}
@media (max-width:520px){.zc-in{grid-template-columns:1fr}}
.zf{display:flex;flex-direction:column;gap:.25rem}
.zf label{font-size:.58rem;letter-spacing:.13em;text-transform:uppercase;font-weight:800;color:rgba(44,36,22,.45)}
.eidsec .zf label{color:rgba(255,254,247,.55)}
.zf input{font:inherit;font-size:.85rem;padding:.5rem .6rem;border-radius:10px;border:1px solid rgba(44,36,22,.18);background:#fff;color:#2C2416;width:100%;box-sizing:border-box}
.zc-out{margin:.9rem 0 0;font-size:.95rem;color:rgba(44,36,22,.7);border-radius:14px;padding:.75rem .9rem;background:linear-gradient(168deg,#FFFCEF,#FFF6DB);border:1px solid rgba(201,162,39,.3)}
.zc-out b{font-size:1.15rem;font-weight:800;color:#2C2416}
.zc-n{font-size:.72rem;color:rgba(44,36,22,.5);line-height:1.75;margin:.7rem 0 0}
.eidsec .zc-l,.eidsec .zc-n{color:rgba(255,254,247,.62)}
.eidsec .zc-out{background:rgba(244,212,106,.1);border-color:rgba(244,212,106,.3);color:rgba(255,254,247,.8)}
.eidsec .zc-out b{color:#F4D46A}

/* the cards out to other rooms */
.fam-links{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-top:.9rem}
@media (max-width:600px){.fam-links{grid-template-columns:1fr}}
.fl-c{display:block;text-decoration:none;color:inherit;border-radius:18px;padding:1rem 1.05rem;background:linear-gradient(168deg,#FFFCEF,#FFF6DB);border:1px solid rgba(201,162,39,.3);transition:transform .18s,box-shadow .18s}
.fl-c:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(44,36,22,.09)}
.eidsec .fl-c{background:rgba(255,254,247,.06);border-color:rgba(244,212,106,.28);color:#FFFEF7}
.fl-k{font-size:.55rem;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:#8a6d13;display:block}
.eidsec .fl-k{color:#F4D46A}
.fl-c b{display:block;font-size:.98rem;margin:.3rem 0 .35rem}
.fl-c span:last-child{display:block;font-size:.78rem;line-height:1.75;color:rgba(44,36,22,.62)}
.eidsec .fl-c span:last-child{color:rgba(255,254,247,.68)}

/* the rooms either side */
.rooms{margin:2.6rem 0 .5rem}
.rk{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .8rem;text-align:center}
.rl{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}
@media (max-width:680px){.rl{grid-template-columns:1fr}}
.rc{display:flex;gap:.9rem;align-items:flex-start;text-decoration:none;color:#FFFEF7;border-radius:22px;padding:1.15rem 1.2rem;border:1px solid rgba(244,212,106,.3);transition:transform .18s,box-shadow .18s}
.rc-ram{background:linear-gradient(166deg,#0D0A16,#182142 60%,#1F2C52)}
.rc-hajj{background:linear-gradient(166deg,#0B120E,#17301F 58%,#22432E)}
.rc:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(44,36,22,.18)}
.rc-i{flex:0 0 auto;width:2.6rem;height:2.6rem;border-radius:14px;background:rgba(244,212,106,.14);display:flex;align-items:center;justify-content:center}
.rc-i svg{width:1.35rem;height:1.35rem;fill:#F4D46A}
.rc-t{display:block;min-width:0}
.rc-t .ar{display:block;font-family:Amiri,serif;font-size:1.25rem;color:#F4D46A;line-height:1.5}
.rc-t b{display:block;font-size:1rem;margin:.05rem 0 .3rem}
.rc-t span:last-child{display:block;font-size:.78rem;line-height:1.75;color:rgba(255,254,247,.68)}

.band{margin:2.6rem 0 .5rem;text-align:center;background:linear-gradient(170deg,#FFFDF3,#FFF6DB);border:1px solid rgba(201,162,39,.26);border-radius:20px;padding:1.6rem 1.2rem}
.band p{font-size:.82rem;color:rgba(44,36,22,.62);line-height:1.85;margin:0 auto .95rem;max-width:32rem}
.band .bl{display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap}

@media (prefers-reduced-motion:no-preference){
.eid-mark circle.f2{animation:eidpulse 4.4s ease-in-out infinite}
@keyframes eidpulse{0%,100%{opacity:.6}50%{opacity:1}}
.tk{animation:tkfade 5s ease-in-out infinite}
@keyframes tkfade{0%,100%{opacity:.62}50%{opacity:1}}
.tq{animation:tkfade 6.2s ease-in-out infinite}
.zsa{animation:zlift 6s ease-in-out infinite}
@keyframes zlift{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
}
"""

JS = """<script>
(function(){
"use strict";
/* The calendar is deferred in the head, which means it runs after this inline
   script is parsed but before DOMContentLoaded. So the room waits for that
   event and then finds it already standing. If it never arrives, the room
   still opens, every word of it, and simply says nothing about dates. */
function boot(){
var H=window.NOOR_HIJRI, S=window.NOOR_RAMADAN;
var $=function(id){return document.getElementById(id);};

/* ---- verse audio through the shared Mushaf voice ------------------ */
document.querySelectorAll(".vplay").forEach(function(b){
  b.addEventListener("click",function(){if(window.playAyah)window.playAyah(b.getAttribute("data-ref"),b);});
});

/* ---- which Eid is near, and lead with it -------------------------- */
var MONTHNAMES=["January","February","March","April","May","June","July","August","September","October","November","December"];
var WEEK=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function gregLine(d){
  if(!d)return "";
  return WEEK[d.getDay()]+" "+d.getDate()+" "+MONTHNAMES[d.getMonth()]+" "+d.getFullYear();
}
function plural(n,a,b){return n+" "+(n===1?a:b);}

function paintNear(){
  if(!H)return;
  /* the season engine may be standing on a previewed day, and if it is, this
     room stands on the same day so the owner can inspect either Eid */
  var now;
  try{now=(S&&S.today)?S.today():new Date();}catch(e){now=new Date();}
  var today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  var h=null;try{h=H.toHijri(today);}catch(e){h=null;}
  if(!h)return;

  var nf=null,na=null;
  try{nf=H.nextEidAlFitr(today);}catch(e){}
  try{na=H.nextEidAlAdha(today);}catch(e){}
  var df=nf?H.daysBetween(today,nf.date):9999;
  var da=na?H.daysBetween(today,na.date):9999;

  /* a running Eid always leads, even though its next occurrence is a year off */
  var running="";
  if(h.hm===10&&h.hd<=3)running="fitr";
  if(h.hm===12&&h.hd>=10&&h.hd<=13)running="adha";

  var near=running||((df<=da)?"fitr":"adha");
  var info={fitr:{n:nf,d:df,name:"Eid al-Fitr"},adha:{n:na,d:da,name:"Eid al-Adha"}};

  ["fitr","adha"].forEach(function(k){
    var sec=$(k), card=$("ec-"+k), kick=$("ec-k-"+k), cd=$("ec-cd-"+k);
    var isNear=(k===near);
    if(sec)sec.style.order=isNear?"1":"2";
    if(card){if(isNear)card.classList.add("near");else card.classList.remove("near");}
    if(kick)kick.textContent=isNear?(running===k?"today":"next"):"the other one";
    var lk=sec?sec.querySelector(".lead-k"):null;
    if(lk)lk.textContent=isNear?(running===k?"happening now":"the one that is next"):"and the other one, whenever you want it";
    if(cd){
      var it=info[k];
      if(running===k){
        cd.textContent="Today. Taqabbal Allahu minna wa minkum, may Allah accept from us and from you.";
      }else if(it.n){
        cd.textContent=gregLine(it.n.date)+" · in "+plural(it.d,"day","days")+", calculated";
      }else{
        cd.textContent="calculated from the tabular calendar";
      }
    }
  });

  var note=$("ecn");
  if(note){
    var lead=info[near];
    var head=(running?("Today is "+lead.name+". "):(lead.n?(lead.name+" is "+(lead.d===0?"today":(lead.d===1?"tomorrow":"in "+plural(lead.d,"day","days")))+", on "+gregLine(lead.n.date)+". "):""));
    note.textContent=head+"These dates are calculated, not sighted. Your masjid\\u2019s announcement is the date, and the offset control in the Ramadan Room moves this page with it.";
  }
}
paintNear();
window.addEventListener("noor:hijri-offset",function(){paintNear();});
window.addEventListener("noor:season",function(){paintNear();});

/* ---- zakat al-fitr, an estimate and said so ----------------------- */
function paintZ(){
  if(!$("z-n"))return;
  var n=parseInt($("z-n").value,10), a=parseFloat($("z-a").value), c=($("z-c").value||"").trim()||"units";
  if(isNaN(n)||n<1)n=1; if(isNaN(a)||a<0)a=0;
  var total=Math.round(n*a*100)/100;
  $("z-out").innerHTML=n+" "+(n===1?"person":"people")+" at "+a+" "+c+" is <b>"+total+" "+c+"</b>";
}
["z-n","z-a","z-c"].forEach(function(id){
  var el=$(id); if(el)el.addEventListener("input",paintZ);
});
if($("z-out"))paintZ();

/* ---- the rail follows the section you are reading ------------------ */
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
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
else boot();
})();
</script>"""

EXTRA_HEAD = '<script src="assets/noor-hijri.js" defer></script>'


def build():
    data = json.load(open(SRC, encoding="utf-8"))
    S = data["sections"]

    chips = [("near", "The two Eids"), ("takbir", "The takbir"), ("prayer", "The prayer"),
             ("manners", "The morning"), ("fitr", "Eid al-Fitr"), ("adha", "Eid al-Adha"),
             ("families", "Children"), ("rooms", "Next door")]
    nav = ('<nav class="secnav" id="secnav" aria-label="The parts of this room">'
           '<div class="secnav-in">%s</div></nav>'
           % "".join('<a href="#%s">%s</a>' % (i, t) for i, t in chips))

    lead_kick = '<span class="lead-k">the one that is next</span>'

    fitr = section_html(S["fitr"], fig=fig_zakat_flow(), extra=zakat_calc_html(),
                        cls="eidsec fitr")
    adha = section_html(S["adha"], fig=fig_thirds(),
                        extra=fig_tashriq() + adha_links_html(), cls="eidsec adha")
    # the small kicker sits at the top of each of the two Eid sections
    fitr = fitr.replace('<div class="sh">', lead_kick + '<div class="sh">', 1)
    adha = adha.replace('<div class="sh">', lead_kick + '<div class="sh">', 1)

    body = (lead_html(data["lead"]) +
            section_html(S["takbir"]) +
            section_html(S["prayer"], fig=fig_takbirat()) +
            section_html(S["manners"], fig=fig_roads()) +
            '<div id="eids">' + fitr + adha + "</div>" +
            section_html(S["families"], extra=family_links_html()) +
            rooms_html())

    band = ('<section class="band mo">'
            "<p>This room stays open all year and leads with whichever Eid is nearest. If a date "
            "here does not match your masjid, move the offset in the Ramadan Room and every "
            "calculated date on the site follows you. If a line here is wrong, tell us and it "
            "gets fixed.</p>"
            '<div class="bl">'
            '<a class="ghost" href="/feedback">Send a correction</a>'
            '<a class="gpill" href="/donate">Keep the lamp lit ✦</a>'
            "</div></section>")

    main = nav + '<div class="wrap">' + opening_html() + body + band + "</div>"

    html = shell(
        slug="eid",
        title="The Eid Room",
        desc=("Both Eids in one room: the takbir with its meaning, the Eid prayer and its "
              "takbirat, zakat al-fitr with a reckoner and its deadline, the six of Shawwal, "
              "the udhiya and the days of Tashriq, and how to make the day land for children. "
              "Every claim carries its evidence."),
        ar="العِيدَان",
        kick="The Eid Room",
        h1="Two days the religion appointed",
        lead=("There are two Eids and no more: one at the end of a month of hunger, one on the "
              "morning after the pilgrims stand at Arafah. Almost everything they ask of you is "
              "the same, and the parts that differ are the parts people most often get wrong. "
              "This room leads with whichever is nearest and keeps the other one open beside it, "
              "all year, because the question of how the prayer works does not wait for the "
              "week it is due."),
        main=main,
        css=CSS,
        extra_head=EXTRA_HEAD,
        extra_js=JS,
        footline="The Eid Room is free forever, like every room in the Codex.",
    )

    open(OUT, "w", encoding="utf-8").write(html)
    figs = html.count('class="fig mo-pop mo-draw')
    cards = sum(len(v.get("cards", [])) for v in S.values())
    # the two characters are written as escapes so this guard does not itself
    # put an em dash or an en dash into a file that forbids them
    bad = [c for c in "\u2014\u2013" if c in html]
    print("eid.html written: %d bytes, %d sections, %d cards, %d figures, dashes %s"
          % (len(html.encode("utf-8")), len(S), cards, figs, "none" if not bad else bad))



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
    _synergy("eid.html")
