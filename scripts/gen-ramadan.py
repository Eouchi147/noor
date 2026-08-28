#!/usr/bin/env python3
# NOOR v49 · The Ramadan Room
# Builds /ramadan.html from build/ramadan-content.json through the canonical
# room shell. The shell (room.py) supplies head, menu, ink hero and footer;
# this file supplies the room: its CSS, its <main>, its six figures, its script.
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

SRC = os.path.join(ROOT, "build", "ramadan-content.json")
OUT = os.path.join(ROOT, "ramadan.html")

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
# evidence: the same badge system the Family Room uses
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


# ---------------------------------------------------------------------------
# the interactive layer, and its resting state
# ---------------------------------------------------------------------------
# Every word of knowledge in this room is visible in every phase of the year.
# What sleeps is the interactive layer: the day companion, the reading tracker,
# the zakat reckoner, the preparation checklist. Each one is marked below with
# the earliest phase that wakes it, and each one carries a small resting card
# that says plainly when it comes back. The resting card is what the server
# sends, so a reader with no JavaScript at all still gets the honest answer
# rather than a dead control.

REST_MOON = ('<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
             '<path d="M21.3 14.7A9.2 9.2 0 0 1 9.3 2.7a9.2 9.2 0 1 0 12 12z"/></svg>')


def tool(wake, name, opens, live, rest_sub="", approach_line=""):
    """Wrap an interactive block so the season engine can wake it.

    wake     the earliest phase in which this block is live
    name     what it is called, used in the resting sentence
    opens    the day it comes back, as a phrase: 1 Ramadan
    """
    ap = (' data-rest-approach="%s"' % esc(approach_line)) if approach_line else ""
    sub = rest_sub or ("Everything it teaches is still on this page. Only the controls "
                       "are resting.")
    return ('<div class="season-tool" data-wake="%s" data-tool="%s" data-opens="%s"%s>'
            '<div class="st-rest">'
            '<span class="st-i" aria-hidden="true">%s</span>'
            '<span class="st-x"><span class="st-t">%s opens %s.</span>'
            '<span class="st-s">%s</span></span>'
            "</div>"
            '<div class="st-live" hidden>%s</div>'
            "</div>"
            % (esc(wake), esc(name), esc(opens), ap, REST_MOON,
               esc(name), esc(opens), esc(sub), live))


def season_top_html():
    """The head of the room. A countdown as Ramadan approaches, the day of the
    month while it runs, and a quiet line pointing forward the rest of the year.
    What the server sends is the quiet line, because that is true for eleven
    months out of twelve."""
    return ('<section class="stop mo" id="season-top">'
            '<span class="stop-i" aria-hidden="true">%s</span>'
            '<div class="stop-x">'
            '<p class="stop-k" id="stop-k">The room stays open</p>'
            '<p class="stop-h" id="stop-h">Ramadan comes back every year, and so does this '
            'page</p>'
            '<p class="stop-l" id="stop-l">Every word below is readable today. The tools wake '
            'about two weeks before the month begins and rest again after Eid.</p>'
            '<p class="stop-b" id="stop-b" hidden></p>'
            "</div></section>" % REST_MOON)


def eid_link_html():
    """The door from this room to the Eid room, and it is meant to be seen."""
    return ('<a class="eidlink mo" href="/eid">'
            '<span class="el-i" aria-hidden="true">'
            '<svg viewBox="0 0 24 24"><path d="M12 2.2 13 5h-2zM8.6 5h6.8l1.6 3.2H7zM7 8.2h10l1.4 '
            '8.2a6.6 6.6 0 0 1-12.8 0zM9.6 21h4.8v1.2H9.6z"/></svg></span>'
            '<span class="el-x">'
            '<span class="el-k">The morning after the last night</span>'
            '<span class="ar notranslate" translate="no" dir="rtl" lang="ar">العِيدَان</span>'
            '<b>The Eid Room</b>'
            '<span class="el-s">Both Eids in one room: the takbir with its meaning, the prayer '
            'and its takbirat, zakat al-fitr and the deadline that decides whether it counted, '
            'the six of Shawwal, and the udhiya of the second Eid. Open all year.</span>'
            '<span class="el-go">Open the Eid Room</span>'
            "</span></a>")


def prepare_html():
    """The preparation checklist. It wakes two weeks out, with the countdown."""
    items = [
        ("Pay back the fasts you still owe",
         "Days missed last Ramadan for illness, travel or menstruation are a debt, and they are "
         "meant to be cleared before the next month starts. Aisha used to make hers up in "
         "Shaban for exactly this reason. If there are too many to finish now, start anyway."),
        ("Decide the reading, and decide where the Book will sit",
         "One juz a night finishes the Qur’an in thirty. Pick the copy you will actually use, "
         "put it somewhere you pass four times a day, and open the plan below so the nights are "
         "already mapped before the first one arrives."),
        ("Move your sleep now, not on the first night",
         "The single most common way a first week gets wrecked. Shift bedtime earlier by twenty "
         "minutes every couple of days starting this week and the suhoor alarm stops being a "
         "shock."),
        ("Ask your masjid for this year’s zakat al-fitr figure",
         "They publish it, they know the local staple and its price, and it is owed for every "
         "soul under your roof. Set the money aside now while it is easy, then use the reckoner "
         "below so nothing is short at the end."),
        ("Book the last ten nights if you can",
         "Leave, shifts, childcare. Whatever it is, it is booked in advance or it does not "
         "happen. The night that is better than a thousand months is somewhere in there."),
        ("Settle what you owe, and let go of what you are owed",
         "Money first, because it is concrete. Then the harder one: the person you have not "
         "spoken to. Walking into the month with that unresolved makes every night of it "
         "smaller."),
        ("Tell the children what is coming, and give each one a job",
         "Waking the house for suhoor, laying the dates out, counting the nights on a chart. A "
         "child with a job in Ramadan remembers Ramadan. A child with no job remembers being "
         "hungry and bored."),
        ("Stock for suhoor, not only for iftar",
         "Almost every household over buys for the evening and forgets the meal that actually "
         "carries the fast. Oats, eggs, dates, yoghurt, water. Boring on purpose."),
        ("Pick one thing to drop and one thing to add",
         "One only, of each. Thirty days is long enough to break a habit and short enough that "
         "a list of ten will collapse by the fourth night."),
        ("Learn the words you will say when you break it",
         "Two short lines, said thousands of times over your life. Learning them in the week "
         "before costs an hour and is paid back every single evening of the month."),
    ]
    rows = "".join(
        '<li class="pr"><label class="prl">'
        '<input type="checkbox" data-p="%d"/><span class="bx" aria-hidden="true"></span>'
        '<span class="pt"><b>%s</b><span class="px">%s</span></span></label></li>'
        % (i, esc(t), esc(x)) for i, (t, x) in enumerate(items))

    live = ('<div class="prep-top">'
            '<p class="prep-k">Your preparation</p>'
            '<p class="prep-c"><span id="pp-done">0</span> of %d done</p></div>'
            '<div class="prep-bar"><span id="pp-fill"></span></div>'
            '<ol class="prlist" id="prlist">%s</ol>'
            '<button type="button" class="kp-reset" id="pp-reset">Clear the list</button>'
            % (len(items), rows))

    knowledge = "".join(
        '<li><span class="ad-n">%d</span><div><b>%s</b><p>%s</p></div></li>'
        % (i + 1, esc(t), esc(x)) for i, (t, x) in enumerate(items))

    return ('<section class="rsec" id="prepare">'
            '<div class="sh"><span class="ar notranslate" translate="no" dir="rtl" lang="ar">'
            'الاسْتِعْدَاد</span><h2>Getting ready</h2></div>'
            '<p class="tr">al-istidad, the making ready</p>'
            '<p class="sub">Ramadan is not a month you can start well on the first morning. Ten '
            'things, none of them heavy, all of them easier now than they will be later. The '
            'checklist below wakes about two weeks before the month; the ten things themselves '
            'are readable in October, in June, and on any other day you happen to be here.</p>'
            + tool("approach", "The preparation checklist", "two weeks before Ramadan",
                   '<div class="prep card mo">' + live + "</div>",
                   rest_sub="The ten things are printed in full just below, and they are worth "
                            "reading whenever you are here.",
                   approach_line="The preparation checklist is awake. {n} days to go.")
            + '<details class="alld mo" id="prep-read"><summary>The ten, in full</summary>'
              '<ol class="ad-list">' + knowledge + "</ol></details>"
            "</section>")


def section_html(sec, fig, extra="", cls=""):
    ar = esc(sec.get("ar", ""))
    tr = esc(sec.get("tr", ""))
    return ('<section class="rsec %s" id="%s">'
            '<div class="sh"><span class="ar notranslate" translate="no" dir="rtl" lang="ar">%s</span>'
            '<h2>%s</h2></div>'
            '<p class="tr">%s</p>'
            '<p class="sub">%s</p>%s%s%s</section>'
            % (cls, esc(sec["id"]), ar, esc(sec.get("title", "")), tr,
               esc(sec.get("lead", "")), fig,
               "".join(card_html(c) for c in sec.get("cards", [])), extra))


# ---------------------------------------------------------------------------
# the six figures. Every one is drawn on, every one carries meaning.
# ---------------------------------------------------------------------------

def fig(svg, legend, cap, cls=""):
    leg = "".join("<li>%s</li>" % l for l in legend)
    return ('<div class="fig mo-pop mo-draw ' + cls + '">' + svg +
            ('<ul class="leg">' + leg + "</ul>" if legend else "") +
            '<p class="cap">' + cap + "</p></div>")


def fig_day():
    """The fasting day as an arc from suhoor to iftar, both ends marked."""
    svg = (
        '<svg viewBox="0 0 480 300" role="img" aria-label="An arc of daylight rising from the '
        'left where suhoor ends and setting on the right at iftar, with the night drawn as a '
        'gentle road back underneath.">'
        '<path class="s3" d="M40 196H440"/>'
        '<path class="s1" d="M76 196A164 132 0 0 1 404 196"/>'
        '<g class="rm-sun"><circle class="f1" cx="240" cy="64" r="21"/>'
        '<circle class="f2" cx="240" cy="64" r="9"/></g>'
        '<path class="s2" d="M76 196v12"/>'
        '<path class="s2" d="M404 196v12"/>'
        '<text class="fl" x="240" y="118" text-anchor="middle">the fast</text>'
        '<text class="fs" x="240" y="138" text-anchor="middle">nothing enters, on purpose</text>'
        '<text class="fg" x="52" y="228" text-anchor="start">suhoor</text>'
        '<text class="fs" x="52" y="246" text-anchor="start">the meal before dawn</text>'
        '<text class="fg" x="428" y="228" text-anchor="end">iftar</text>'
        '<text class="fs" x="428" y="246" text-anchor="end">the breaking of the fast</text>'
        '<path class="s3" d="M76 262q164 26 328 0"/>'
        '<text class="fs" x="240" y="296" text-anchor="middle">the night, when food and drink are '
        'yours again</text>'
        "</svg>")
    legend = [
        "The fast begins the moment true dawn enters, not at sunrise. That is why suhoor, the "
        "meal before dawn, is eaten late and finished close to the line.",
        "It ends the moment the sun is gone, and it is meant to be ended at once. Hastening the "
        "iftar is named as a good the community keeps.",
        "The night belongs to you. Eat, drink, sleep, and be with your family without guilt: none "
        "of that was ever asked of you.",
    ]
    cap = ("<b>Qur’an 2:187.</b> Eat and drink until the white thread of dawn becomes distinct to "
           "you from the black thread, then complete the fast until the night.")
    return fig(svg, legend, cap)


def fig_juz():
    """The thirty juz as a ring that fills. The ticks are wired to the reader's ticks."""
    cx, cy = 240, 140
    r1, r2 = 74, 100
    ticks = []
    for n in range(1, 31):
        a = math.radians(-90 + (n - 1) * 12 + 6)
        x1, y1 = cx + r1 * math.cos(a), cy + r1 * math.sin(a)
        x2, y2 = cx + r2 * math.cos(a), cy + r2 * math.sin(a)
        ticks.append('<line class="jz" data-jz="%d" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>'
                     % (n, x1, y1, x2, y2))
    marks = []
    for n, label in ((1, "1"), (10, "10"), (20, "20"), (30, "30")):
        a = math.radians(-90 + (n - 1) * 12 + 6)
        x, y = cx + (r2 + 17) * math.cos(a), cy + (r2 + 17) * math.sin(a) + 5
        marks.append('<text class="fs" x="%.1f" y="%.1f" text-anchor="middle">%s</text>'
                     % (x, y, label))
    svg = (
        '<svg viewBox="0 0 480 292" role="img" aria-label="A ring of thirty marks, one for each '
        'part of the Qur’an, lighting up as the reader ticks the nights off.">'
        '<circle class="s3" cx="240" cy="140" r="62"/>'
        '<circle class="s3" cx="240" cy="140" r="106"/>'
        + "".join(ticks) + "".join(marks) +
        '<text class="fg" x="240" y="132" text-anchor="middle">one juz</text>'
        '<text class="fs" x="240" y="152" text-anchor="middle">a thirtieth</text>'
        '<text class="fs" x="240" y="168" text-anchor="middle">of the Book</text>'
        '<text class="fs" x="240" y="264" text-anchor="middle">thirty nights, one complete '
        'reading, about twenty pages a day</text>'
        "</svg>")
    legend = [
        "Juz, the plural is ajza, means a part. The Qur’an was divided into thirty of them for "
        "exactly this: one a night, and the month closes the Book.",
        "Twenty pages sounds heavy until it is broken up. Four pages after each of the five daily "
        "prayers is the same thing, and it never takes more than a few minutes at a time.",
        "The ring above fills as you tick the nights below. Nothing leaves this browser.",
    ]
    cap = ("<b>Qur’an 2:185.</b> The month of Ramadan is the one in which the Qur’an was sent "
           "down, as guidance for the people.")
    return fig(svg, legend, cap, cls="fig-ring")


def fig_ten():
    """The last ten, with the odd nights lit."""
    parts = []
    x0 = 54
    step = 41
    for i in range(10):
        n = 21 + i
        odd = (n % 2 == 1)
        x = x0 + i * step
        cls = "lamp on" if odd else "lamp"
        h = 96 if odd else 70
        top = 196 - h
        parts.append('<g class="%s">' % cls)
        parts.append('<path class="%s" d="M%d %dh26v%dh-26Z"/>'
                     % ("s1 f1" if odd else "s3", x, top, h))
        parts.append('<path class="%s" d="M%d %dh34l-4-9h-26Z"/>'
                     % ("s1" if odd else "s3", x - 4, top, ))
        parts.append('<path class="%s" d="M%d 196h34l-4 10h-26Z"/>'
                     % ("s1" if odd else "s3", x - 4))
        if odd:
            parts.append('<circle class="f2" cx="%d" cy="%d" r="6"/>' % (x + 13, top + h / 2))
            parts.append('<circle class="s3" cx="%d" cy="%d" r="15"/>' % (x + 13, top + h / 2))
        parts.append("</g>")
        parts.append('<text class="%s" x="%d" y="224" text-anchor="middle">%d</text>'
                     % ("fl" if odd else "fs", x + 13, n))
    svg = (
        '<svg viewBox="0 0 480 288" role="img" aria-label="Ten lanterns for the last ten nights, '
        'the odd numbered ones lit and taller than the even ones.">'
        '<path class="s3" d="M30 206H450"/>' + "".join(parts) +
        '<text class="fg" x="240" y="34" text-anchor="middle">seek it in the odd nights</text>'
        '<text class="fs" x="240" y="52" text-anchor="middle">and come to all ten, because the '
        'month may run twenty nine days</text>'
        '<text class="fs" x="240" y="256" text-anchor="middle">the night of a day begins at its '
        'sunset,</text>'
        '<text class="fs" x="240" y="274" text-anchor="middle">so the night of the twenty seventh '
        'follows the twenty sixth day</text>'
        "</svg>")
    legend = [
        "The lit lanterns are the odd nights counted from the beginning: the twenty first, twenty "
        "third, twenty fifth, twenty seventh and twenty ninth.",
        "Counted backward from the end they land differently, and nobody outside knows yet "
        "whether this month has twenty nine days or thirty. That is the whole argument for giving "
        "all ten.",
        "The twenty seventh is the most reported and it is not the certain one. Treat it as the "
        "likeliest, not the only.",
    ]
    cap = ("<b>Bukhari 2017.</b> Seek the Night of Decree in the odd nights of the last ten of "
           "Ramadan.")
    return fig(svg, legend, cap, cls="fig-ten")


def fig_taraweeh():
    """One root, three honest branches, one ending."""
    cols = [
        (90, "eleven", ["Aisha’s", "description"], ["Bukhari 1147", "Muslim 738"]),
        (240, "twenty", ["the Companions", "after Umar"], ["Bukhari 2012", "the four schools"]),
        (390, "thirty six", ["the later people", "of Madinah"], ["Malik saw no harm"]),
    ]
    parts = []
    for x, big, who, srcs in cols:
        parts.append('<path class="s3" d="M240 74C240 104 %d 104 %d 128"/>' % (x, x))
        parts.append('<path class="s1 f1" d="M%d 128h112v48h-112Z"/>' % (x - 56))
        parts.append('<text class="fg" x="%d" y="153" text-anchor="middle">%s</text>' % (x, big))
        parts.append('<text class="fs" x="%d" y="170" text-anchor="middle">units</text>' % x)
        for i, w in enumerate(who):
            parts.append('<text class="fl" style="font-size:14px" x="%d" y="%d" '
                         'text-anchor="middle">%s</text>' % (x, 200 + i * 18, w))
        for i, s in enumerate(srcs):
            parts.append('<text class="fs" x="%d" y="%d" text-anchor="middle">%s</text>'
                         % (x, 244 + i * 17, s))
        parts.append('<path class="s3" d="M%d 274v14"/>' % x)
    svg = (
        '<svg viewBox="0 0 480 336" role="img" aria-label="One root splitting into three branches '
        'for eleven, twenty and thirty six units, all three arriving at the same word: accepted.">'
        '<path class="s1" d="M240 34v40"/>'
        '<text class="fg" x="240" y="26" text-anchor="middle">the night prayer of Ramadan</text>'
        + "".join(parts) +
        '<path class="s3" d="M90 288H390"/>'
        '<path class="s1" d="M240 288v16"/>'
        '<text class="fg" x="240" y="324" text-anchor="middle" style="font-size:16px">all three '
        'are prayed, and all three are accepted</text>'
        "</svg>")
    legend = [
        "No text fixes a number for the night prayer. That is why the disagreement is old, wide "
        "and calm, and why none of the three positions calls the others wrong.",
        "The strongest single description of the Prophet’s ﷺ own night prayer is Aisha’s eleven. "
        "The strongest public practice of the generation after him is twenty.",
        "Pray with the imam of the masjid you are standing in. Whoever stands with him until he "
        "leaves is written as having stood the whole night.",
    ]
    cap = ("<b>Bukhari 1147, Bukhari 2012 and Tirmidhi 806.</b> A difference of arrangement, not "
           "of religion.")
    return fig(svg, legend, cap)


def fig_fasting():
    """Who fasts, who is excused, and what each one owes."""
    svg = (
        '<svg viewBox="0 0 480 312" role="img" aria-label="One road that divides into three: the '
        'one who fasts, the one who makes the days up later, and the one who feeds a poor person '
        'instead.">'
        '<path class="s1" d="M240 28v34"/>'
        '<text class="fg" x="240" y="20" text-anchor="middle">whoever witnesses the month</text>'
        '<path class="s3" d="M240 62C240 90 84 84 84 116"/>'
        '<path class="s3" d="M240 62v54"/>'
        '<path class="s3" d="M240 62C240 90 396 84 396 116"/>'
        '<circle class="s1 f1" cx="84" cy="140" r="24"/>'
        '<circle class="s1 f1" cx="240" cy="140" r="24"/>'
        '<circle class="s1 f1" cx="396" cy="140" r="24"/>'
        '<path class="s2" d="M74 141l7 8l13 -17"/>'
        '<path class="s2" d="M229 140h20"/><path class="s2" d="M243 134l8 6l-8 6"/>'
        '<path class="s2" d="M384 136h24"/>'
        '<path class="s2" d="M386 141h20a10 10 0 0 1 -20 0Z"/>'
        '<text class="fl" x="84" y="192" text-anchor="middle">able</text>'
        '<text class="fs" x="84" y="210" text-anchor="middle">fasts the day</text>'
        '<text class="fl" x="240" y="192" text-anchor="middle">ill or travelling</text>'
        '<text class="fs" x="240" y="210" text-anchor="middle">a number of</text>'
        '<text class="fs" x="240" y="226" text-anchor="middle">other days</text>'
        '<text class="fl" x="396" y="192" text-anchor="middle">unable, for good</text>'
        '<text class="fs" x="396" y="210" text-anchor="middle">feeds a poor</text>'
        '<text class="fs" x="396" y="226" text-anchor="middle">person instead</text>'
        '<path class="s3" d="M60 250H420"/>'
        '<text class="fg" x="240" y="276" text-anchor="middle">Allah intends ease for you</text>'
        '<text class="fs" x="240" y="298" text-anchor="middle">and does not intend hardship for '
        'you</text>'
        "</svg>")
    legend = [
        "The excuses are not loopholes found by lawyers. They are written into the verse, in the "
        "same breath as the command.",
        "The one who is ill or travelling makes the days up later, one for one, at any time before "
        "the next Ramadan.",
        "The one who will never be able, through age or lasting illness, feeds a poor person for "
        "each day instead. That is fidya, the ransom.",
    ]
    cap = ("<b>Qur’an 2:184 and 2:185.</b> Whoever among you is ill or on a journey, then a number "
           "of other days. Allah intends ease for you and does not intend hardship for you.")
    return fig(svg, legend, cap)


def fig_zakat():
    """One sa' per head, from the house, through the hands, to the door."""
    people = []
    for i in range(4):
        x = 62 + i * 26
        people.append('<circle class="s2" cx="%d" cy="140" r="7"/>' % x)
        people.append('<path class="s2" d="M%d 172v-16a8 8 0 0 1 16 0v16"/>' % (x - 8))
    svg = (
        '<svg viewBox="0 0 480 306" role="img" aria-label="A household of four, one measure of '
        'food counted for each person, carried through the masjid and set down at a neighbour’s '
        'door before the Eid prayer.">'
        '<path class="s1" d="M40 100h140v84H40Z"/>'
        '<path class="s1" d="M28 100l82-42l82 42"/>'
        + "".join(people) +
        '<text class="fs" x="110" y="204" text-anchor="middle">every soul in the house</text>'
        '<path class="s1" d="M188 142h74"/>'
        '<path class="s1" d="M252 134l12 8l-12 8"/>'
        '<path class="s1 f1" d="M270 118h64l-10 52h-44Z"/>'
        '<path class="s2" d="M266 118h72"/>'
        '<text class="fs" x="302" y="188" text-anchor="middle">one sa’ each</text>'
        '<text class="fs" x="302" y="204" text-anchor="middle">about three kilograms</text>'
        '<path class="s1" d="M342 142h56"/>'
        '<path class="s1" d="M388 134l12 8l-12 8"/>'
        '<path class="s1" d="M408 96h56v88h-56Z"/>'
        '<path class="s2" d="M424 184v-34h24v34"/>'
        '<circle class="f2" cx="443" cy="166" r="3"/>'
        '<text class="fs" x="430" y="222" text-anchor="middle">the neighbour</text>'
        '<path class="s3" d="M64 248H416"/>'
        '<text class="fg" x="240" y="278" text-anchor="middle">it must arrive before the Eid '
        'prayer</text>'
        '<text class="fs" x="240" y="296" text-anchor="middle">paid after it, it is an ordinary '
        'charity and the obligation is missed</text>'
        "</svg>")
    legend = [
        "One sa’ of the staple food per person, not per family. The newborn counts. The guest "
        "sleeping in the spare room counts.",
        "A sa’ is a volume of four cupped handfuls, which lands near three kilograms depending on "
        "what is measured, which is why the figure your masjid quotes moves a little.",
        "The deadline is the prayer, not the day. Give it early if you can and stop carrying it.",
    ]
    cap = ("<b>Bukhari 1503 and Abu Dawud 1609.</b> A purification for the fasting person and food "
           "for the poor: whoever pays it before the prayer, it is accepted zakat.")
    return fig(svg, legend, cap)


def fig_eid():
    """Out by one road, back by another."""
    svg = (
        '<svg viewBox="0 0 480 292" role="img" aria-label="A house on the left, the open prayer '
        'ground in the middle under a risen sun, and two different roads: one going out and one '
        'coming back.">'
        '<g class="rm-sun"><circle class="f1" cx="240" cy="44" r="20"/>'
        '<circle class="f2" cx="240" cy="44" r="8"/></g>'
        '<path class="s3" d="M206 44h-18"/><path class="s3" d="M274 44h18"/>'
        '<path class="s3" d="M40 204H440"/>'
        '<path class="s1" d="M32 132h88v72H32Z"/>'
        '<path class="s1" d="M22 132l54-32l54 32"/>'
        '<path class="s2" d="M64 204v-30h24v30"/>'
        '<text class="fs" x="76" y="226" text-anchor="middle">the house</text>'
        '<path class="s1" d="M186 204h108v-46H186Z"/>'
        '<path class="s1" d="M178 158h124"/>'
        '<path class="s1" d="M240 158v-26"/>'
        '<path class="s1 f1" d="M228 132a12 12 0 0 1 24 0Z"/>'
        '<text class="fs" x="240" y="226" text-anchor="middle">the prayer ground</text>'
        '<path class="s1" d="M124 182q30 -30 58 -16"/>'
        '<path class="s2" d="M172 158l12 4l-8 10"/>'
        '<text class="fs" x="152" y="148" text-anchor="middle">out</text>'
        '<path class="s3" d="M298 186q54 26 106 4"/>'
        '<path class="s2" d="M394 182l12 6l-10 8"/>'
        '<text class="fs" x="352" y="166" text-anchor="middle">back</text>'
        '<path class="s1" d="M408 150h56v54h-56Z"/>'
        '<path class="s1" d="M400 150l36-26l36 26"/>'
        '<path class="s2" d="M424 204v-26h20v26"/>'
        '<text class="fs" x="436" y="226" text-anchor="middle">home</text>'
        '<text class="fg" x="240" y="264" text-anchor="middle">eat before you go, and only on '
        'this Eid</text>'
        '<text class="fs" x="240" y="284" text-anchor="middle">an odd number of dates, before you '
        'leave the house</text>'
        "</svg>")
    legend = [
        "The prayer is after the sun has risen and lifted clear, in the open where the whole "
        "community can be seen at once. No call to prayer is made for it.",
        "Dates are eaten before leaving, in an odd number, on Eid al-Fitr alone. On Eid al-Adha "
        "the order is reversed and nothing is eaten until the return.",
        "He went out by one road and came back by another. Take the long way and let the children "
        "notice.",
    ]
    cap = ("<b>Bukhari 953, Bukhari 960 and Bukhari 986.</b> Two units with no call and no "
           "iqama, dates before setting out, and a different road home.")
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
            "<p>This room is open every day of the year and every word in it stays where it is. "
            "What changes is the interactive layer. About two weeks before the first of the "
            "month the preparation tools wake up and a countdown appears at the top. On the "
            "first of Ramadan everything wakes, and today becomes the first thing you see. "
            "After Eid the tools go back to resting and the knowledge stays exactly here, so a "
            "reader who arrives in October wanting to understand fasting is never turned away "
            "at the door.</p>"
            "<p>When a tool is resting it says so plainly, in its own place, and tells you the "
            "day it comes back. Nothing is hidden and nothing is disabled without explanation. "
            "The whole Codex follows the same calendar: a slim bar appears under the header as "
            "the month approaches, the site puts on a slight Ramadan theme for the thirty days, "
            "and at Eid the theme changes again and points at the Eid Room.</p>"
            "<p>The dates here are calculated, not sighted. They come from the tabular Islamic "
            "calendar, which is arithmetic and has never once looked at the sky, so they can sit a "
            "day or two away from the day your community actually begins. Your masjid’s "
            "announcement is the date. If it differs from ours, move the calendar with the small "
            "offset control below and every time on this page follows you.</p>"
            "<p>Everything else carries its evidence in the open: a verse you can hear recited "
            "aloud, a narration named by its collection and number, and an honest badge whenever "
            "the scholars differ or a line is our own counsel rather than revelation. Where there "
            "is a real disagreement, both sides are given properly, because a reader who is told "
            "only one position has been handled rather than taught.</p>"
            '<div class="keys">%s</div></article>' % keys)


def today_html(days):
    ref = "".join(
        '<template data-day="%d"><span class="d-k">%s</span>%s<p class="d-t">%s</p>%s</template>'
        % (d["n"], esc(d["k"]),
           ('<p class="d-ar"><span class="ar notranslate" translate="no" dir="rtl" lang="ar">%s</span>'
            '<span class="d-tr">%s, %s</span></p>' % (d["ar"], esc(d["tr"]), esc(d["gloss"])))
           if d.get("ar") else "",
           esc(d["text"]), refs_html(d.get("refs")))
        for d in days)

    alld = "".join(
        '<li><span class="ad-n">%d</span><div><b>%s</b><p>%s</p></div></li>'
        % (d["n"], esc(d["k"]), esc(d["text"]))
        for d in days)

    return (
        '<section class="rsec" id="today">'
        '<div class="sh"><span class="ar notranslate" translate="no" dir="rtl" lang="ar">اليَوْم</span>'
        '<h2>Today</h2></div>'
        '<p class="tr">al-yawm, the day</p>'
        '<p class="sub">Which day of the month it is, when your fast opens and closes where you '
        'are standing, and one thing to hold on to for this day and no other.</p>'

        '<article class="card today mo" id="today-card">' +
        tool("ramadan", "The daily companion", "on 1 Ramadan",
             '<div class="t-head">'
        '<div class="t-day"><span class="t-n" id="t-n">1</span>'
        '<span class="t-of">of thirty</span></div>'
        '<div class="t-when">'
        '<p class="t-hij" id="t-hij">Ramadan</p>'
        '<p class="t-greg" id="t-greg">calculated from the tabular calendar</p>'
        '</div>'
        '<div class="t-nav">'
        '<button type="button" class="dnav" data-d="-1" aria-label="The day before">‹</button>'
        '<button type="button" class="dnav today-btn" id="t-back" hidden>today</button>'
        '<button type="button" class="dnav" data-d="1" aria-label="The day after">›</button>'
        '</div></div>'

        '<div class="t-win" id="t-win" hidden>'
        '<div class="tw"><p class="tw-k">suhoor ends</p><p class="tw-v" id="tw-fajr">··</p>'
        '<p class="tw-s">true dawn, when the fast begins</p></div>'
        '<div class="tw tw-mid"><p class="tw-k">the fast runs</p><p class="tw-v" id="tw-len">··</p>'
        '<p class="tw-s" id="tw-next">·</p></div>'
        '<div class="tw"><p class="tw-k">iftar</p><p class="tw-v" id="tw-mag">··</p>'
        '<p class="tw-s">sunset, and do not delay it</p></div>'
        '</div>'

        '<div class="t-loc" id="t-loc">'
        '<p class="t-loc-l" id="t-loc-l">No place is set, so no times are shown here. A time that '
        'is wrong is worse than no time at all.</p>'
        '<div class="t-loc-b">'
        '<button type="button" class="ghost sm" id="loc-here">Use my location</button>'
        '<button type="button" class="ghost sm" id="loc-hand">Enter it by hand</button>'
        '<button type="button" class="ghost sm" id="loc-clear" hidden>Forget this place</button>'
        '</div>'
        '<div class="t-form" id="t-form" hidden>'
        '<div class="tf"><label for="f-lat">Latitude</label>'
        '<input id="f-lat" type="number" step="0.0001" placeholder="21.4225"/></div>'
        '<div class="tf"><label for="f-lng">Longitude</label>'
        '<input id="f-lng" type="number" step="0.0001" placeholder="39.8262"/></div>'
        '<div class="tf"><label for="f-met">Method</label><select id="f-met">'
        '<option value="ISNA">ISNA · North America</option>'
        '<option value="MWL">Muslim World League</option>'
        '<option value="Egypt">Egyptian General Authority</option>'
        '<option value="Karachi">University of Karachi</option>'
        '<option value="UmmAlQura">Umm al-Qura, Makkah</option>'
        "</select></div>"
        '<div class="tf"><label for="f-asr">Asr</label><select id="f-asr">'
        '<option value="standard">Standard</option><option value="hanafi">Hanafi</option>'
        "</select></div>"
        '<button type="button" class="gpill sm" id="loc-save">Save this place</button>'
        '<p class="tf-h">On a map, a right click on your building gives the latitude and then the '
        'longitude. South is a negative latitude and west is a negative longitude. This stays in '
        'your browser and is sent nowhere.</p>'
        "</div></div>"

        '<div class="t-ref" id="t-ref"></div>',
             rest_sub="The thirty reflections it turns over are all here, in the list below, "
                      "and today's fasting window returns with the month.",
             approach_line="Day 1 opens in {n} days.") +

        '<div class="t-off">'
        '<p class="t-off-k">Calendar offset</p>'
        '<div class="t-off-b">'
        '<button type="button" class="offb" data-off="-1" aria-label="A day later">−</button>'
        '<span class="off-v" id="off-v">0</span>'
        '<button type="button" class="offb" data-off="1" aria-label="A day earlier">+</button>'
        "</div>"
        '<p class="t-off-l">These dates are calculated, not sighted, and your masjid’s '
        'announcement is the date. If your community began a day before or after this calendar, '
        'nudge it here and the whole Codex follows you. Nothing is sent anywhere.</p>'
        "</div>"
        "</article>" +

        fig_day() +

        '<details class="alld mo"><summary>All thirty, if you want to read ahead</summary>'
        '<ol class="ad-list">' + alld + "</ol></details>"
        '<div id="day-store" hidden>' + ref + "</div>"
        "</section>")


def khatm_html(juz):
    rows = "".join(
        '<li class="kr"><label class="krl">'
        '<input type="checkbox" data-j="%d"/><span class="bx" aria-hidden="true"></span>'
        '<span class="kn">%d</span>'
        '<span class="kt"><b>%s</b><span class="ks">%s</span>'
        '<span class="kx">%s</span></span></label></li>'
        % (d["n"], d["n"], esc(d["range"]), esc(d["surahs"]), esc(d["note"]))
        for d in juz)
    return (
        '<section class="rsec" id="khatm">'
        '<div class="sh"><span class="ar notranslate" translate="no" dir="rtl" lang="ar">خَتْمَة</span>'
        '<h2>The Qur’an in thirty nights</h2></div>'
        '<p class="tr">khatma, one complete reading from the first word to the last</p>'
        '<p class="sub">The Book was divided into thirty parts for exactly this month. One part a '
        'night, about twenty pages, and on the thirtieth you close it having read every word. '
        'Tick the nights as you go. Nothing leaves this browser and nobody is counting but you.</p>'

        + fig_juz() +

        tool("approach", "The reading tracker", "two weeks before Ramadan",
             '<div class="kprog card mo">'
             '<div class="kp-top"><p class="kp-k">Your reading</p>'
             '<p class="kp-c"><span id="kp-done">0</span> of 30 read</p></div>'
             '<div class="kp-bar"><span id="kp-fill"></span></div>'
             '<p class="kp-l" id="kp-line">Tick a night when you have read its part. The line '
             'here will tell you honestly where you are, and it will never scold you.</p>'
             '<button type="button" class="kp-reset" id="kp-reset">Begin the reading again'
             "</button></div>",
             rest_sub="The whole plan is below, every night of it, so it can be read and "
                      "planned at any time of year.",
             approach_line="The plan is open. {n} days until the first night.") +

        '<ol class="klist" id="klist" data-mo-stagger>' + rows + "</ol>"
        "</section>")


def zakat_calc_html():
    return tool(
        "approach", "The zakat al-fitr reckoner", "two weeks before Ramadan",
        '<div class="zc card mo">'
        '<p class="zc-k">A quick reckoning</p>'
        '<p class="zc-l">Prices differ by country and by staple, so this asks you for the figure '
        'rather than pretending to know it. Your local masjid publishes the amount every year and '
        'that amount is the one that counts. This is an estimate to help you hand over the right '
        'sum, and it is nothing more.</p>'
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
        'dawn on the night of Eid and a guest staying with you. It must be in the hands of the '
        'poor before the Eid prayer. Ask your masjid for this year’s figure, because they set it '
        'and we do not.</p>'
        "</div>",
        rest_sub="The measure, the deadline and who owes it are all explained just above, and "
                 "the Eid Room carries the same reckoner on the morning it is due.",
        approach_line="The reckoner is open. Set the money aside now, {n} days early.")


def families_extra():
    return ('<div class="fam-links mo">'
            '<a class="fl-c" href="/kids/lanterns">'
            '<span class="fl-k">For the nights</span>'
            '<b>The Lantern Sky</b>'
            '<span>A child lights a lantern for something they are grateful for and watches it '
            'go up. Quiet, and made for exactly these evenings.</span></a>'
            '<a class="fl-c" href="/kids">'
            '<span class="fl-k">For the whole month</span>'
            '<b>The Kids’ Codex</b>'
            '<span>The story of everything, told at their height: the prophets, the animals of the '
            'Qur’an, and small games that leave something behind.</span></a>'
            "</div>")


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
.s1{fill:none;stroke:#E9C86A;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.s2{fill:none;stroke:#FFFEF7;stroke-opacity:.6;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.s3{fill:none;stroke:#F4D46A;stroke-opacity:.32;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.f1{fill:#F4D46A;fill-opacity:.14}
.f2{fill:#F4D46A}
.leg{list-style:none;margin:1rem 0 0;padding:0;display:grid;gap:.45rem}
.leg li{position:relative;padding-inline-start:1rem;font-size:.75rem;line-height:1.7;color:rgba(255,254,247,.66)}
.leg li::before{content:"";position:absolute;inset-inline-start:0;top:.62rem;width:.36rem;height:.36rem;border-radius:50%;background:#E9C86A}
.fig .cap b{color:rgba(244,212,106,.85);font-weight:700}
.jz{stroke:#F4D46A;stroke-opacity:.28;stroke-width:5;stroke-linecap:round;fill:none;transition:stroke-opacity .35s,stroke-width .35s}
.jz.on{stroke-opacity:1;stroke-width:8}

/* ---- the season layer: what sleeps, and how it says so ---- */
.season-tool{display:block}
.st-rest{display:flex;gap:.85rem;align-items:flex-start;border-radius:18px;padding:.95rem 1.05rem;background:linear-gradient(168deg,#FFFCEF,#FFF7E0);border:1px solid rgba(201,162,39,.26)}
.st-i{flex:0 0 auto;width:2rem;height:2rem;border-radius:12px;background:rgba(201,162,39,.14);display:flex;align-items:center;justify-content:center}
.st-i svg{width:1rem;height:1rem;fill:#8a6d13;opacity:.85}
.st-x{display:block;min-width:0}
.st-t{display:block;font-size:.85rem;font-weight:800;color:rgba(44,36,22,.82);line-height:1.6}
.st-s{display:block;font-size:.75rem;color:rgba(44,36,22,.55);line-height:1.75;margin-top:.28rem}
.rsec.ten .st-rest{background:rgba(255,254,247,.05);border-color:rgba(244,212,106,.24)}
.rsec.ten .st-t{color:rgba(255,254,247,.86)}
.rsec.ten .st-s{color:rgba(255,254,247,.6)}
.rsec.ten .st-i{background:rgba(244,212,106,.14)}
.rsec.ten .st-i svg{fill:#F4D46A}
/* the reading plan stays fully readable when its tracker is asleep: only the
   boxes go, never a word of it */
.klist.rest .bx{display:none}
.klist.rest .krl{cursor:default;padding-inline-start:.9rem}
.klist.rest .krl:hover{border-color:rgba(44,36,22,.1)}

/* the head of the room */
.stop{display:flex;gap:.9rem;align-items:flex-start;margin-top:1.1rem;border-radius:20px;padding:1.05rem 1.1rem;background:linear-gradient(166deg,#14100A,#182142 62%,#1F2C52);color:#FFFEF7;border:1px solid rgba(244,212,106,.26)}
.stop-i{flex:0 0 auto;width:2.4rem;height:2.4rem;border-radius:14px;background:rgba(244,212,106,.14);display:flex;align-items:center;justify-content:center}
.stop-i svg{width:1.15rem;height:1.15rem;fill:#F4D46A}
.stop-x{min-width:0}
.stop-k{font-size:.55rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#F4D46A;margin:0}
.stop-h{font-size:1.08rem;font-weight:800;line-height:1.45;margin:.25rem 0 0;letter-spacing:-.01em}
.stop-l{font-size:.78rem;color:rgba(255,254,247,.66);line-height:1.8;margin:.35rem 0 0}
.stop-b{margin:.7rem 0 0}
.stop-b a{display:inline-block;font-size:.68rem;font-weight:800;letter-spacing:.04em;color:#1A160F;background:linear-gradient(135deg,#C9A227,#E9C86A);border-radius:999px;padding:.34rem .8rem;text-decoration:none}
.stop.now{background:linear-gradient(166deg,#100C1C,#25204A 60%,#33285C)}

/* the door to the Eid room */
.eidlink{display:flex;gap:1rem;align-items:flex-start;text-decoration:none;color:#FFFEF7;border-radius:22px;padding:1.2rem 1.25rem;margin-top:1rem;background:linear-gradient(166deg,#1A0E22,#3C1D42 58%,#6A2F4E);border:1px solid rgba(255,231,176,.3);transition:transform .18s,box-shadow .18s}
.eidlink:hover{transform:translateY(-2px);box-shadow:0 16px 38px rgba(58,22,52,.28)}
.el-i{flex:0 0 auto;width:2.9rem;height:2.9rem;border-radius:16px;background:rgba(255,231,176,.15);display:flex;align-items:center;justify-content:center}
.el-i svg{width:1.5rem;height:1.5rem;fill:#FFE7B0}
.el-x{display:block;min-width:0}
.el-k{display:block;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:#FFE7B0}
.el-x .ar{display:inline-block;font-family:Amiri,serif;font-size:1.3rem;color:#FFE7B0;line-height:1.6;margin-top:.2rem}
.eidlink b{display:block;font-size:1.05rem;margin:.05rem 0 .35rem}
.el-s{display:block;font-size:.79rem;line-height:1.8;color:rgba(255,254,247,.72)}
.el-go{display:inline-block;margin-top:.7rem;font-size:.68rem;font-weight:800;letter-spacing:.04em;color:#2A1330;background:linear-gradient(135deg,#FFC978,#FFE7B0 55%,#F0B7A8);border-radius:999px;padding:.34rem .8rem}

/* the preparation checklist */
.prep{border-color:rgba(201,162,39,.3)}
.prep-top{display:flex;align-items:baseline;justify-content:space-between;gap:.7rem}
.prep-k{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0}
.prep-c{font-size:.68rem;font-weight:700;color:rgba(44,36,22,.5);margin:0;white-space:nowrap}
.prep-bar{height:.42rem;border-radius:999px;background:rgba(44,36,22,.08);margin:.7rem 0 .8rem;overflow:hidden}
.prep-bar span{display:block;height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#C9A227,#F4D46A);transition:width .5s ease}
.prlist{list-style:none;margin:0;padding:0;display:grid;gap:.4rem}
.prl{display:flex;gap:.6rem;align-items:flex-start;padding:.6rem .7rem;border-radius:14px;background:#fff;border:1px solid rgba(44,36,22,.1);cursor:pointer;transition:border-color .2s}
.prl:hover{border-color:rgba(201,162,39,.45)}
.prl input{position:absolute;opacity:0;width:0;height:0}
.pt{display:block}
.pt b{font-size:.83rem;display:block;line-height:1.55}
.px{display:block;font-size:.76rem;color:rgba(44,36,22,.62);line-height:1.75;margin-top:.28rem}
.prl input:checked~.pt b{color:rgba(44,36,22,.36)}
.prl input:checked+.bx{background:linear-gradient(135deg,#C9A227,#E9C86A);border-color:transparent}
.prl input:checked+.bx::after{opacity:1;transform:rotate(42deg) scale(1)}
.prl input:focus-visible+.bx{outline:2px solid #8a6d13;outline-offset:2px}

/* today */
.today{margin-top:1.1rem;border-color:rgba(201,162,39,.34);box-shadow:0 10px 34px rgba(44,36,22,.08)}
.t-head{display:flex;align-items:center;gap:.95rem;flex-wrap:wrap}
.t-day{flex:0 0 auto;width:4.3rem;height:4.3rem;border-radius:20px;background:linear-gradient(158deg,#14100A,#20304f);color:#F4D46A;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.t-n{font-size:1.75rem;font-weight:800}
.t-of{font-size:.53rem;letter-spacing:.14em;text-transform:uppercase;opacity:.7;margin-top:.2rem}
.t-when{flex:1 1 10rem;min-width:9rem}
.t-hij{font-size:1.02rem;font-weight:800;margin:0;letter-spacing:-.01em}
.t-greg{font-size:.72rem;color:rgba(44,36,22,.5);margin:.2rem 0 0;line-height:1.6}
.t-nav{display:flex;gap:.3rem;align-items:center;flex:0 0 auto}
.dnav{font:inherit;font-weight:800;font-size:.9rem;line-height:1;width:2rem;height:2rem;border-radius:999px;border:1px solid rgba(44,36,22,.16);background:#fff;color:rgba(44,36,22,.6);cursor:pointer;transition:border-color .2s,color .2s}
.dnav:hover{border-color:rgba(201,162,39,.55);color:#2C2416}
.today-btn{width:auto;padding:0 .7rem;font-size:.63rem;letter-spacing:.1em;text-transform:uppercase}
.t-win{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-top:1rem;border-radius:16px;overflow:hidden;border:1px solid rgba(201,162,39,.26);background:linear-gradient(168deg,#FFFCEF,#FFF6DB)}
.tw{padding:.75rem .6rem;text-align:center}
.tw-mid{border-inline-start:1px solid rgba(201,162,39,.24);border-inline-end:1px solid rgba(201,162,39,.24)}
.tw-k{font-size:.55rem;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0}
.tw-v{font-size:1.05rem;font-weight:800;margin:.28rem 0 0;font-variant-numeric:tabular-nums}
.tw-s{font-size:.63rem;color:rgba(44,36,22,.5);margin:.25rem 0 0;line-height:1.5}
@media (max-width:520px){.t-win{grid-template-columns:1fr}.tw-mid{border-inline-start:0;border-inline-end:0;border-top:1px solid rgba(201,162,39,.24);border-bottom:1px solid rgba(201,162,39,.24)}}
.t-loc{margin-top:.9rem;padding-top:.85rem;border-top:1px solid rgba(44,36,22,.1)}
.t-loc-l{font-size:.75rem;color:rgba(44,36,22,.58);line-height:1.7;margin:0 0 .6rem}
.t-loc-b{display:flex;gap:.45rem;flex-wrap:wrap}
.ghost.sm,.gpill.sm{padding:.4rem .85rem;font-size:.7rem}
.t-form{margin-top:.8rem;display:grid;grid-template-columns:1fr 1fr;gap:.6rem}
.tf{display:flex;flex-direction:column;gap:.25rem}
.tf label{font-size:.58rem;letter-spacing:.13em;text-transform:uppercase;font-weight:800;color:rgba(44,36,22,.45)}
.tf input,.tf select{font:inherit;font-size:.8rem;padding:.45rem .55rem;border-radius:10px;border:1px solid rgba(44,36,22,.18);background:#fff;color:#2C2416;width:100%;box-sizing:border-box}
.tf-h,.t-form>.gpill{grid-column:1 / -1}
.tf-h{font-size:.68rem;color:rgba(44,36,22,.45);line-height:1.65;margin:0}
.t-form>.gpill{justify-self:start}
.t-ref{margin-top:1rem;padding-top:.95rem;border-top:1px solid rgba(44,36,22,.1)}
.d-k{display:inline-block;font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin-bottom:.35rem}
.d-ar{margin:.1rem 0 .35rem;display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap}
.d-ar .ar{font-family:Amiri,serif;font-size:1.25rem;color:var(--gold)}
.d-tr{font-size:.7rem;color:rgba(44,36,22,.45)}
.d-t{font-size:.9rem;line-height:1.9;color:rgba(44,36,22,.82);margin:0}
.t-off{margin-top:1rem;padding-top:.9rem;border-top:1px solid rgba(44,36,22,.1);display:grid;grid-template-columns:auto auto 1fr;gap:.4rem .8rem;align-items:center}
.t-off-k{font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:rgba(44,36,22,.45);margin:0}
.t-off-b{display:flex;align-items:center;gap:.45rem}
.offb{font:inherit;font-weight:800;width:1.7rem;height:1.7rem;line-height:1;border-radius:999px;border:1px solid rgba(201,162,39,.45);background:rgba(244,212,106,.14);color:#8a6d13;cursor:pointer}
.offb:hover{background:rgba(244,212,106,.32)}
.off-v{font-size:.85rem;font-weight:800;min-width:1.6rem;text-align:center;font-variant-numeric:tabular-nums}
.t-off-l{grid-column:1 / -1;font-size:.68rem;color:rgba(44,36,22,.45);line-height:1.65;margin:0}
.alld{margin-top:1rem;border:1px solid rgba(44,36,22,.12);border-radius:18px;background:#fff;padding:.85rem 1rem}
.alld summary{font-size:.75rem;font-weight:800;letter-spacing:.02em;color:rgba(44,36,22,.62);cursor:pointer;list-style:none}
.alld summary::-webkit-details-marker{display:none}
.alld summary::after{content:" ▾";color:var(--gold)}
.alld[open] summary::after{content:" ▴"}
.ad-list{list-style:none;margin:.85rem 0 0;padding:0;display:grid;gap:.7rem}
.ad-list li{display:flex;gap:.7rem;align-items:flex-start;padding-top:.7rem;border-top:1px solid rgba(44,36,22,.07)}
.ad-list li:first-child{border-top:0;padding-top:0}
.ad-n{flex:0 0 auto;width:1.55rem;height:1.55rem;border-radius:999px;background:rgba(201,162,39,.14);color:#8a6d13;font-size:.68rem;font-weight:800;display:flex;align-items:center;justify-content:center}
.ad-list b{font-size:.82rem;display:block}
.ad-list p{font-size:.78rem;line-height:1.75;color:rgba(44,36,22,.66);margin:.2rem 0 0}

/* the thirty nights */
.kprog{border-color:rgba(201,162,39,.3)}
.kp-top{display:flex;align-items:baseline;justify-content:space-between;gap:.7rem}
.kp-k{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0}
.kp-c{font-size:.68rem;font-weight:700;color:rgba(44,36,22,.5);margin:0;white-space:nowrap}
.kp-bar{height:.42rem;border-radius:999px;background:rgba(44,36,22,.08);margin:.7rem 0 .65rem;overflow:hidden}
.kp-bar span{display:block;height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#C9A227,#F4D46A);transition:width .5s ease}
.kp-l{font-size:.8rem;line-height:1.8;color:rgba(44,36,22,.7);margin:0}
.kp-reset{margin-top:.6rem;background:none;border:0;font:inherit;font-size:.67rem;font-weight:700;color:rgba(44,36,22,.4);cursor:pointer;text-decoration:underline;padding:.25rem .35rem}
.kp-reset:hover{color:rgba(44,36,22,.65)}
.klist{list-style:none;margin:1rem 0 0;padding:0;display:grid;gap:.4rem}
.krl{display:flex;gap:.6rem;align-items:flex-start;padding:.6rem .7rem;border-radius:14px;background:#fff;border:1px solid rgba(44,36,22,.1);cursor:pointer;transition:border-color .2s,background .2s}
.krl:hover{border-color:rgba(201,162,39,.45)}
.krl input{position:absolute;opacity:0;width:0;height:0}
.bx{flex:0 0 auto;width:1.08rem;height:1.08rem;margin-top:.16rem;border-radius:7px;border:1.5px solid rgba(201,162,39,.55);background:#fff;position:relative;transition:background .2s,border-color .2s}
.bx::after{content:"";position:absolute;inset-inline-start:.33rem;top:.13rem;width:.26rem;height:.52rem;border:solid #1A160F;border-width:0 2px 2px 0;transform:rotate(42deg) scale(.35);opacity:0;transition:opacity .2s,transform .2s}
.krl input:checked+.bx{background:linear-gradient(135deg,#C9A227,#E9C86A);border-color:transparent}
.krl input:checked+.bx::after{opacity:1;transform:rotate(42deg) scale(1)}
.krl input:focus-visible+.bx{outline:2px solid #8a6d13;outline-offset:2px}
.kn{flex:0 0 auto;width:1.5rem;font-size:.72rem;font-weight:800;color:#8a6d13;text-align:end;margin-top:.1rem;font-variant-numeric:tabular-nums}
.kt{display:block}
.kt b{font-size:.82rem;display:block;line-height:1.5}
.ks{display:block;font-size:.68rem;color:rgba(44,36,22,.45);margin-top:.1rem}
.kx{display:block;font-size:.76rem;color:rgba(44,36,22,.62);line-height:1.7;margin-top:.28rem}
.krl input:checked~.kt b,.krl input:checked~.kn{color:rgba(44,36,22,.36)}

/* the last ten: the one section that is allowed to glow */
.rsec.ten{margin-top:1.6rem;border-radius:24px;padding:2.2rem 1.15rem 1.4rem;background:linear-gradient(172deg,#14100A,#161f38 62%,#1d2947);color:#FFFEF7}
.rsec.ten h2{color:#FFFEF7}
.rsec.ten .sh .ar{color:#F4D46A}
.rsec.ten .tr{color:rgba(255,254,247,.45)}
.rsec.ten .sub{color:rgba(255,254,247,.72)}
.rsec.ten .card{background:rgba(255,254,247,.045);border-color:rgba(244,212,106,.22);box-shadow:none}
.rsec.ten .card h3{color:#FFFEF7}
.rsec.ten .card p{color:rgba(255,254,247,.78)}
.rsec.ten .fig{background:rgba(255,254,247,.05);border-color:rgba(244,212,106,.26)}
.rsec.ten .ref{background:rgba(255,254,247,.07);border-color:rgba(255,254,247,.14);color:rgba(255,254,247,.7)}
.rsec.ten .ref b{color:#F4D46A}
.rsec.ten .ref .rn{color:rgba(255,254,247,.5)}
.rsec.ten .ref.q{background:rgba(244,212,106,.12);border-color:rgba(244,212,106,.3)}
.rsec.ten .vplay{background:rgba(244,212,106,.16);border-color:rgba(244,212,106,.4);color:#F4D46A}
.rsec.ten .vplay:hover{background:rgba(244,212,106,.3)}
.rsec.ten .evb.sunnah{color:#F4D46A;border-color:rgba(244,212,106,.45);background:rgba(244,212,106,.12)}
.rsec.ten .evb.quran{color:#8fd6ac;border-color:rgba(143,214,172,.4);background:rgba(143,214,172,.1)}
.rsec.ten .evb.debated{color:#c3aae4;border-color:rgba(195,170,228,.4);background:rgba(195,170,228,.1)}
.rsec.ten .evb.editorial{color:rgba(255,254,247,.6);border-color:rgba(255,254,247,.24);background:rgba(255,254,247,.06)}

/* du'a blocks */
.dua{margin:.85rem 0 .2rem;border-radius:16px;padding:.95rem 1rem;background:linear-gradient(168deg,#FFFCEF,#FFF4D2);border:1px solid rgba(201,162,39,.32)}
.rsec.ten .dua{background:rgba(244,212,106,.09);border-color:rgba(244,212,106,.3)}
.dua .ar{font-family:Amiri,serif;font-size:1.5rem;line-height:2.1;color:#2C2416;margin:0;text-align:end}
.rsec.ten .dua .ar{color:#F4D46A}
.dua .tl{font-size:.82rem;font-weight:700;color:rgba(44,36,22,.72);margin:.55rem 0 0;line-height:1.7}
.rsec.ten .dua .tl{color:rgba(255,254,247,.82)}
.dua .mn{font-size:.83rem;color:rgba(44,36,22,.66);margin:.3rem 0 0;line-height:1.8}
.rsec.ten .dua .mn{color:rgba(255,254,247,.7)}
.dua .dx{font-size:.72rem;color:rgba(44,36,22,.5);margin:.55rem 0 0;line-height:1.7;padding-top:.5rem;border-top:1px solid rgba(201,162,39,.25)}
.rsec.ten .dua .dx{color:rgba(255,254,247,.55);border-top-color:rgba(244,212,106,.22)}

/* zakat reckoning */
.zc{border-color:rgba(201,162,39,.3)}
.zc-k{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .5rem}
.zc-l{font-size:.8rem;line-height:1.8;color:rgba(44,36,22,.66);margin:0 0 .85rem}
.zc-in{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem}
@media (max-width:520px){.zc-in{grid-template-columns:1fr}}
.zf{display:flex;flex-direction:column;gap:.25rem}
.zf label{font-size:.58rem;letter-spacing:.13em;text-transform:uppercase;font-weight:800;color:rgba(44,36,22,.45)}
.zf input{font:inherit;font-size:.85rem;padding:.5rem .6rem;border-radius:10px;border:1px solid rgba(44,36,22,.18);background:#fff;color:#2C2416;width:100%;box-sizing:border-box}
.zc-out{margin:.9rem 0 0;font-size:.95rem;color:rgba(44,36,22,.7);border-radius:14px;padding:.75rem .9rem;background:linear-gradient(168deg,#FFFCEF,#FFF6DB);border:1px solid rgba(201,162,39,.3)}
.zc-out b{font-size:1.15rem;font-weight:800;color:#2C2416}
.zc-n{font-size:.72rem;color:rgba(44,36,22,.5);line-height:1.75;margin:.7rem 0 0}

/* families */
.fam-links{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-top:.9rem}
@media (max-width:600px){.fam-links{grid-template-columns:1fr}}
.fl-c{display:block;text-decoration:none;color:inherit;border-radius:18px;padding:1rem 1.05rem;background:linear-gradient(168deg,#FFFCEF,#FFF6DB);border:1px solid rgba(201,162,39,.3);transition:transform .18s,box-shadow .18s}
.fl-c:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(44,36,22,.09)}
.fl-k{font-size:.55rem;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:#8a6d13;display:block}
.fl-c b{display:block;font-size:.98rem;margin:.3rem 0 .35rem}
.fl-c span:last-child{display:block;font-size:.78rem;line-height:1.75;color:rgba(44,36,22,.62)}

.band{margin:3rem 0 .5rem;text-align:center;background:linear-gradient(170deg,#FFFDF3,#FFF6DB);border:1px solid rgba(201,162,39,.26);border-radius:20px;padding:1.6rem 1.2rem}
.band p{font-size:.82rem;color:rgba(44,36,22,.62);line-height:1.85;margin:0 auto .95rem;max-width:32rem}
.band .bl{display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap}

@media (prefers-reduced-motion:no-preference){
.rm-sun{animation:rmsun 5.2s ease-in-out infinite}
@keyframes rmsun{0%,100%{opacity:.55}50%{opacity:1}}
.lamp.on circle.f2{animation:rmflame 3.4s ease-in-out infinite}
@keyframes rmflame{0%,100%{opacity:.6}50%{opacity:1}}
.lamp.on{animation:rmlift 6s ease-in-out infinite}
@keyframes rmlift{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
}
"""

JS = """<script>
(function(){
"use strict";
/* The calendar and the prayer engine are deferred in the head, which means
   they run after this inline script is parsed but before DOMContentLoaded.
   So the room waits for that event and then finds both already standing. If
   one of them never arrives, the room still opens and says so plainly. */
function boot(){
var H=window.NOOR_HIJRI;
var SE=window.NOOR_RAMADAN;

/* ============================================================
   the season layer: which tools are awake today
   The engine owns the phase. This room only asks it, and if the
   engine is not on the page it works the same answer out of the
   calendar with the same rules, so the room is never wrong about
   itself just because one file failed to load.
   ============================================================ */
var RANK={dormant:0,approach:1,ramadan:2,"eid-fitr":0,"dhul-hijjah":0,"eid-adha":0};
var APPROACH_DAYS=14;

function seasonNow(){
  if(SE&&SE.today){try{return SE.today();}catch(e){}}
  return new Date();
}
function daysToRamadan(){
  if(SE&&SE.daysToRamadan){try{var d=SE.daysToRamadan();if(d!==null&&d!==undefined)return d;}catch(e){}}
  if(!H)return null;
  try{
    var now=seasonNow(), t=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    var nx=H.nextRamadan(t);
    return nx?H.daysBetween(t,nx.date):null;
  }catch(e){return null;}
}
function phaseNow(){
  if(SE&&SE.phase){try{return SE.phase();}catch(e){}}
  if(!H)return "dormant";
  try{
    var now=seasonNow(), t=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    var h=H.toHijri(t);
    if(h.hm===9)return "ramadan";
    if(h.hm===10&&h.hd<=3)return "eid-fitr";
    if(h.hm===12&&h.hd<=9)return "dhul-hijjah";
    if(h.hm===12&&h.hd>=10&&h.hd<=13)return "eid-adha";
    var to=daysToRamadan();
    if(to!==null&&to>=1&&to<=APPROACH_DAYS)return "approach";
    return "dormant";
  }catch(e){return "dormant";}
}
function nextRamadanDate(){
  if(!H)return null;
  try{
    var now=seasonNow(), t=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    var nx=H.nextRamadan(t);
    return nx?nx.date:null;
  }catch(e){return null;}
}
function plural(n,a,b){return n+" "+(n===1?a:b);}

var phase="dormant";

function paintSeason(){
  phase=phaseNow();
  var rank=RANK[phase]||0;
  var to=daysToRamadan();

  /* every marked tool decides for itself, from one number */
  document.querySelectorAll(".season-tool").forEach(function(el){
    var wake=el.getAttribute("data-wake")||"ramadan";
    var live=el.querySelector(".st-live"), rest=el.querySelector(".st-rest");
    var awake=rank>=(RANK[wake]||0);
    if(live)live.hidden=!awake;
    if(rest)rest.hidden=awake;
    if(awake)return;
    var t=rest?rest.querySelector(".st-t"):null;
    if(!t)return;
    var name=el.getAttribute("data-tool")||"This tool";
    var opens=el.getAttribute("data-opens")||"1 Ramadan";
    var ap=el.getAttribute("data-rest-approach");
    /* a tool that wakes in the approach wakes fourteen days before the first
       of the month, so its own countdown is that much shorter */
    var opensIn=(to===null)?null:((wake==="approach")?Math.max(0,to-APPROACH_DAYS):to);
    if(phase==="approach"&&ap&&to!==null){
      t.textContent=ap.replace("{n}",String(to));
    }else if(opensIn!==null&&opensIn>0){
      t.textContent=name+" opens "+opens+", in "+plural(opensIn,"day","days")+".";
    }else{
      t.textContent=name+" opens "+opens+".";
    }
  });

  /* the reading plan keeps every word when its tracker is asleep */
  var kl=$("klist");
  if(kl){
    if(rank>=RANK.approach)kl.classList.remove("rest");
    else kl.classList.add("rest");
  }

  paintTop(to);
}

function paintTop(to){
  var k=$("stop-k"), hd=$("stop-h"), l=$("stop-l"), b=$("stop-b"), box=$("season-top");
  if(!k||!hd||!l)return;
  var nx=nextRamadanDate();
  var when=nx?gregLine(nx):"";
  if(box)box.classList.remove("now");
  if(b){b.hidden=true;b.innerHTML="";}

  if(phase==="ramadan"){
    var d=realDay||shown||1;
    if(SE&&SE.state){try{var stt=SE.state();if(stt&&stt.day)d=stt.day;}catch(e){}}
    if(box)box.classList.add("now");
    k.textContent="Today";
    hd.textContent="Day "+d+" of thirty";
    var hy=ramadanYear();
    l.textContent=d+" Ramadan"+(hy?" "+hy:"")+". Everything in this room is awake. Your fasting window for today is in the card just below.";
    if(b){b.hidden=false;b.innerHTML='<a href="#today">Go to today</a>';}
    return;
  }
  if(phase==="approach"){
    if(box)box.classList.add("now");
    k.textContent="Counting down";
    hd.textContent=(to===1)?"Ramadan begins tomorrow":("Ramadan begins in "+plural(to===null?0:to,"day","days"));
    l.textContent=(when?("The first day is "+when+", calculated, and your masjid\\u2019s announcement is the date. "):"")+"The preparation tools are awake: the checklist, the thirty night reading plan and the zakat al-fitr reckoner.";
    if(b){b.hidden=false;b.innerHTML='<a href="#prepare">Start getting ready</a>';}
    return;
  }
  if(phase==="eid-fitr"){
    k.textContent="Eid Mubarak";
    hd.textContent="The month is complete";
    l.textContent="Taqabbal Allahu minna wa minkum, may Allah accept from us and from you. The tools in this room are resting again"+(when?(", and the next Ramadan begins on "+when+", calculated"):"")+".";
    if(b){b.hidden=false;b.innerHTML='<a href="/eid">Open the Eid Room</a>';}
    return;
  }
  /* dormant, and the two windows of Dhul Hijjah: one quiet line forward */
  k.textContent="The room stays open";
  hd.textContent=when?("The next Ramadan begins on "+when):"Ramadan comes back every year, and so does this page";
  l.textContent=((to!==null&&to>0)?("That is "+plural(to,"day","days")+" from today, calculated, not sighted. "):"")+"Every word below is readable right now. The tools wake about two weeks before the month and rest again after Eid.";
  if(b&&(phase==="dhul-hijjah"||phase==="eid-adha")){
    b.hidden=false;b.innerHTML='<a href="/eid">The Eid Room</a>';
  }
}

/* ---- verse audio through the shared Mushaf voice ------------------ */
document.querySelectorAll(".vplay").forEach(function(b){
  b.addEventListener("click",function(){if(window.playAyah)window.playAyah(b.getAttribute("data-ref"),b);});
});

/* ---- the reader's place, kept in one small drawer ----------------- */
var PKEY="noor_place", place=null;
try{place=JSON.parse(localStorage.getItem(PKEY)||"null");}catch(e){place=null;}
function savePlace(p){place=p;try{localStorage.setItem(PKEY,JSON.stringify(p));}catch(e){}}
function dropPlace(){place=null;try{localStorage.removeItem(PKEY);}catch(e){}}

/* ---- what day of Ramadan is it, and which day are we showing ------ */
var MONTHNAMES=["January","February","March","April","May","June","July","August","September","October","November","December"];
var WEEK=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
var realDay=0, shown=1, hijriToday=null;
function readToday(){
  if(!H)return;
  try{
    hijriToday=H.toHijri(seasonNow());
    realDay=hijriToday.isRamadan?hijriToday.hd:0;
    shown=realDay||1;
  }catch(e){hijriToday=null;realDay=0;shown=1;}
}
readToday();

/* the Hijri year whose Ramadan we are showing: this one if we are inside it,
   otherwise the next one that has not happened yet */
function ramadanYear(){
  if(!H||!hijriToday)return null;
  if(hijriToday.hm===9)return hijriToday.hy;
  try{var nx=H.nextRamadan(seasonNow());return nx?nx.hy:hijriToday.hy;}catch(e){return hijriToday.hy;}
}
function dateOfDay(n){
  var hy=ramadanYear();
  if(!H||hy===null)return null;
  try{return H.toGregorian(hy,9,n);}catch(e){return null;}
}
function gregLine(d){
  if(!d)return "";
  return WEEK[d.getDay()]+" "+d.getDate()+" "+MONTHNAMES[d.getMonth()]+" "+d.getFullYear();
}

var $=function(id){return document.getElementById(id);};

/* ---- the reflection for the shown day ----------------------------- */
function paintDay(){
  var tpl=document.querySelector('#day-store template[data-day="'+shown+'"]');
  var box=$("t-ref");
  if(tpl&&box){box.innerHTML="";box.appendChild(tpl.content.cloneNode(true));
    box.querySelectorAll(".vplay").forEach(function(b){
      b.addEventListener("click",function(){if(window.playAyah)window.playAyah(b.getAttribute("data-ref"),b);});
    });
  }
  if($("t-n"))$("t-n").textContent=shown;
  var d=dateOfDay(shown);
  var hy=ramadanYear();
  if($("t-hij"))$("t-hij").textContent=shown+" Ramadan"+(hy?" "+hy:"");
  if($("t-greg")){
    var line=d?gregLine(d):"";
    if(!H){$("t-greg").textContent="The calendar engine is not loaded on this page.";}
    else if(realDay&&shown===realDay){$("t-greg").textContent=(line?line+" · ":"")+"today, calculated";}
    else if(realDay){$("t-greg").textContent=(line?line+" · ":"")+"calculated";}
    else{
      var nx=null;try{nx=H.nextRamadan(seasonNow());}catch(e){}
      $("t-greg").textContent=(line?line+" · ":"")+"calculated"+(nx?", this coming Ramadan":"");
    }
  }
  var back=$("t-back");
  if(back)back.hidden=!(realDay&&shown!==realDay);
  paintTimes();
}

document.querySelectorAll(".dnav[data-d]").forEach(function(b){
  b.addEventListener("click",function(){
    shown+= (+b.getAttribute("data-d"));
    if(shown<1)shown=30; if(shown>30)shown=1;
    paintDay();
  });
});
if($("t-back"))$("t-back").addEventListener("click",function(){shown=realDay||1;paintDay();});

/* ---- the fasting window for the shown day and this place ---------- */
function fmt(h){return window.NOOR_FMT_TIME?window.NOOR_FMT_TIME(h,false):"··";}
function paintTimes(){
  var win=$("t-win"), line=$("t-loc-l"), clr=$("loc-clear");
  if(!win)return;
  if(clr)clr.hidden=!place;
  if(!place||!window.NOOR_SALAT){
    win.hidden=true;
    if(line&&!place)line.textContent="No place is set, so no times are shown here. A time that is wrong is worse than no time at all.";
    else if(line)line.textContent="The prayer time engine has not loaded, so no times are shown. Nothing here is guessed.";
    return;
  }
  var d=dateOfDay(shown)||new Date();
  var t;
  try{t=window.NOOR_SALAT(d,place.lat,place.lng,{method:place.method||"ISNA",asr:place.asr||"standard"});}catch(e){t=null;}
  if(!t||t.fajr===null||t.maghrib===null){
    win.hidden=true;
    if(line)line.textContent="At this latitude the sun does not reach the angle these times are defined by on this day, so no honest time can be computed. Communities this far north or south follow a convention their scholars choose. Ask yours.";
    return;
  }
  win.hidden=false;
  $("tw-fajr").textContent=fmt(t.fajr);
  $("tw-mag").textContent=fmt(t.maghrib);
  var len=t.maghrib-t.fajr; if(len<0)len+=24;
  $("tw-len").textContent=Math.floor(len)+"h "+Math.round((len-Math.floor(len))*60)+"m";
  var star=t.estimated?" These are estimated by the seventh of the night, a convention rather than an observation.":"";
  if(line)line.textContent="Computed from the sun for "+place.lat.toFixed(3)+", "+place.lng.toFixed(3)+" using "+(place.method||"ISNA")+"."+star+" Your masjid's timetable is the one to follow.";
  var nxt=$("tw-next");
  if(nxt){
    if(realDay&&shown===realDay){
      var now=new Date(), h=now.getHours()+now.getMinutes()/60;
      if(h<t.fajr)nxt.textContent="suhoor ends in "+gap(t.fajr-h);
      else if(h<t.maghrib)nxt.textContent="iftar in "+gap(t.maghrib-h);
      else nxt.textContent="the fast is complete";
    }else{nxt.textContent="from dawn to sunset";}
  }
}
function gap(h){
  var m=Math.max(0,Math.round(h*60));
  return (m>=60?Math.floor(m/60)+"h ":"")+(m%60)+"m";
}

/* ---- setting the place ------------------------------------------- */
if($("loc-here"))$("loc-here").addEventListener("click",function(){
  var line=$("t-loc-l");
  if(!navigator.geolocation){if(line)line.textContent="This browser will not give a location. Enter it by hand instead.";return;}
  if(line)line.textContent="Asking your browser for a location.";
  navigator.geolocation.getCurrentPosition(function(p){
    savePlace({lat:p.coords.latitude,lng:p.coords.longitude,method:(place&&place.method)||"ISNA",asr:(place&&place.asr)||"standard"});
    paintTimes();
  },function(){
    if(line)line.textContent="Your browser did not give a location, which is your right. Enter it by hand and it stays in this browser only.";
  },{timeout:10000,maximumAge:600000});
});
if($("loc-hand"))$("loc-hand").addEventListener("click",function(){
  var f=$("t-form"); if(!f)return;
  f.hidden=!f.hidden;
  if(!f.hidden&&place){$("f-lat").value=place.lat;$("f-lng").value=place.lng;$("f-met").value=place.method||"ISNA";$("f-asr").value=place.asr||"standard";}
});
if($("loc-save"))$("loc-save").addEventListener("click",function(){
  var la=parseFloat($("f-lat").value), ln=parseFloat($("f-lng").value);
  if(isNaN(la)||isNaN(ln)||la<-90||la>90||ln<-180||ln>180){
    $("t-loc-l").textContent="That does not look like a latitude and a longitude. Latitude runs from -90 to 90 and longitude from -180 to 180.";return;
  }
  savePlace({lat:la,lng:ln,method:$("f-met").value,asr:$("f-asr").value});
  $("t-form").hidden=true; paintTimes();
});
if($("loc-clear"))$("loc-clear").addEventListener("click",function(){dropPlace();paintTimes();});

/* ---- the calendar offset ------------------------------------------ */
function paintOffset(){
  if(!H||!$("off-v"))return;
  var v=H.getOffset();
  $("off-v").textContent=(v>0?"+":"")+v;
}
document.querySelectorAll(".offb[data-off]").forEach(function(b){
  b.addEventListener("click",function(){
    if(!H)return;
    H.setOffset(H.getOffset()+(+b.getAttribute("data-off")));
    paintOffset(); readToday(); paintDay(); paintKhatm(); paintSeason();
  });
});
paintOffset();

/* ---- the reading, thirty nights ----------------------------------- */
var KKEY="noor_ramadan_khatm", kdone={};
try{kdone=JSON.parse(localStorage.getItem(KKEY)||"{}")||{};}catch(e){kdone={};}
function saveK(){try{localStorage.setItem(KKEY,JSON.stringify(kdone));}catch(e){}}
var kboxes=[].slice.call(document.querySelectorAll(".klist input[type=checkbox]"));
function paintKhatm(){
  var done=0;
  kboxes.forEach(function(b){if(b.checked)done++;});
  if($("kp-done"))$("kp-done").textContent=done;
  if($("kp-fill"))$("kp-fill").style.width=Math.round(done/30*100)+"%";
  document.querySelectorAll(".jz").forEach(function(t){
    var n=+t.getAttribute("data-jz");
    if(kdone[n])t.classList.add("on"); else t.classList.remove("on");
  });
  var line=$("kp-line"); if(!line)return;
  if(done>=30){line.textContent="You have read the whole Qur'an this month. Whatever else the month held, that happened, and it does not go away.";return;}
  if(!realDay){
    if(done===0){line.textContent="Tick a night when you have read its part. The line here will tell you honestly where you are, and it will never scold you.";}
    else{line.textContent="You have "+done+" of thirty marked. The month is not running today, so nothing is behind. Pick it up when it begins.";}
    return;
  }
  var expected=Math.min(30,realDay);
  var behind=expected-done, left=30-done, nights=Math.max(1,31-realDay);
  if(behind<=0){
    line.textContent="You are level with the month, or ahead of it. Slow down enough to understand what you are reading; the aim was never speed.";
    return;
  }
  var pace=left/nights;
  line.textContent="You are "+behind+" "+(behind===1?"part":"parts")+" behind where the calendar is, and that is a very ordinary place to be on day "+realDay+". Here is the way back: "+
    (pace<=1.35?"about one part a night from here and you still close the Book on the thirtieth."
              :"about "+(Math.round(pace*10)/10)+" parts a night closes it on the thirtieth, and if that is too much, keep one a night and finish a few days into Shawwal. A reading finished late is still a reading finished.")+
    " Nobody is marking you and nothing is lost.";
}
kboxes.forEach(function(b){
  var n=b.getAttribute("data-j");
  if(kdone[n])b.checked=true;
  b.addEventListener("change",function(){
    if(b.checked)kdone[n]=1; else delete kdone[n];
    saveK(); paintKhatm();
  });
});
if($("kp-reset"))$("kp-reset").addEventListener("click",function(){
  kdone={}; saveK(); kboxes.forEach(function(b){b.checked=false;}); paintKhatm();
});

/* ---- zakat al-fitr, an estimate and said so ----------------------- */
function paintZ(){
  var n=parseInt($("z-n").value,10), a=parseFloat($("z-a").value), c=($("z-c").value||"").trim()||"units";
  if(isNaN(n)||n<1)n=1; if(isNaN(a)||a<0)a=0;
  var total=Math.round(n*a*100)/100;
  $("z-out").innerHTML=n+" "+(n===1?"person":"people")+" at "+a+" "+c+" is <b>"+total+" "+c+"</b>";
}
["z-n","z-a","z-c"].forEach(function(id){
  var el=$(id); if(el)el.addEventListener("input",paintZ);
});
if($("z-out"))paintZ();

/* ---- the preparation checklist, ten things, kept in this browser --- */
var PKEY2="noor_ramadan_prep", pdone={};
try{pdone=JSON.parse(localStorage.getItem(PKEY2)||"{}")||{};}catch(e){pdone={};}
function saveP(){try{localStorage.setItem(PKEY2,JSON.stringify(pdone));}catch(e){}}
var pboxes=[].slice.call(document.querySelectorAll(".prlist input[type=checkbox]"));
function paintPrep(){
  var done=0;
  pboxes.forEach(function(b){if(b.checked)done++;});
  if($("pp-done"))$("pp-done").textContent=done;
  if($("pp-fill"))$("pp-fill").style.width=(pboxes.length?Math.round(done/pboxes.length*100):0)+"%";
}
pboxes.forEach(function(b){
  var n=b.getAttribute("data-p");
  if(pdone[n])b.checked=true;
  b.addEventListener("change",function(){
    if(b.checked)pdone[n]=1; else delete pdone[n];
    saveP(); paintPrep();
  });
});
if($("pp-reset"))$("pp-reset").addEventListener("click",function(){
  pdone={}; saveP(); pboxes.forEach(function(b){b.checked=false;}); paintPrep();
});
paintPrep();

paintDay(); paintKhatm(); paintSeason();
window.addEventListener("noor:season",function(){paintSeason();});
window.addEventListener("noor:hijri-offset",function(){readToday();paintDay();paintKhatm();paintSeason();});
setInterval(function(){ if(realDay&&shown===realDay) paintTimes(); },30000);

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

EXTRA_HEAD = ('<script src="assets/noor-hijri.js" defer></script>\n'
              '<script src="masjid/salat.js" defer></script>')


def build():
    data = json.load(open(SRC, encoding="utf-8"))
    days = data["days"]
    juz = data["juz"]
    S = data["sections"]

    chips = [("today", "Today"), ("prepare", "Getting ready"), ("khatm", "Thirty nights"),
             ("lastten", "The last ten"), ("taraweeh", "Taraweeh"), ("fasting", "Fasting"),
             ("zakat", "Zakat al-Fitr"), ("eid", "Eid"), ("families", "Families")]
    nav = ('<nav class="secnav" id="secnav" aria-label="The rooms of the month">'
           '<div class="secnav-in">%s</div></nav>'
           % "".join('<a href="#%s">%s</a>' % (i, t) for i, t in chips))

    body = (today_html(days) +
            prepare_html() +
            khatm_html(juz) +
            section_html(S["lastten"], fig_ten(), cls="ten") +
            section_html(S["taraweeh"], fig_taraweeh()) +
            section_html(S["fasting"], fig_fasting()) +
            section_html(S["zakat"], fig_zakat(), extra=zakat_calc_html()) +
            section_html(S["eid"], fig_eid(), extra=eid_link_html()) +
            section_html(S["families"], "", extra=families_extra()))

    band = ('<section class="band mo">'
            "<p>The tools in this room wake themselves about two weeks before Ramadan and rest "
            "again after Eid, every year, with nobody at the switch. The knowledge never rests. "
            "If a date here does not match your masjid, move the offset above and write to us so "
            "the wording gets better.</p>"
            '<div class="bl">'
            '<a class="ghost" href="/feedback">Send a correction</a>'
            '<a class="gpill" href="/donate">Keep the lamp lit ✦</a>'
            "</div></section>")

    main = (nav + '<div class="wrap">' + opening_html() + season_top_html() + body +
            band + "</div>")

    html = shell(
        slug="ramadan",
        title="The Ramadan Room",
        desc=("Ramadan day by day: today's fasting window for your own place, a thirty night "
              "reading plan for the whole Qur'an, the last ten nights and Laylat al-Qadr, "
              "taraweeh, the rules of fasting, zakat al-fitr with a reckoner, and Eid. Every "
              "claim carries its evidence."),
        ar="رَمَضَان",
        kick="The Ramadan Room",
        h1="Thirty days that rearrange a year",
        lead=("Ramadan is the ninth month, the one in which the Qur’an was sent down, and the only "
              "month named in the Book. This room is built to be worth opening on the third day "
              "and on the twenty seventh: what today asks of you, where you are in the reading, "
              "what the last ten nights are for, and the plain mechanics nobody quite explains. "
              "Every date here is calculated and your masjid’s announcement is the one that "
              "counts."),
        main=main,
        css=CSS,
        extra_head=EXTRA_HEAD,
        extra_js=JS,
        footline="The Ramadan Room is free forever, like every room in the Codex.",
    )

    open(OUT, "w", encoding="utf-8").write(html)
    figs = html.count('class="fig mo-pop mo-draw')
    print("ramadan.html written: %d bytes, %d days, %d juz, %d cards, %d figures"
          % (len(html.encode("utf-8")), len(days), len(juz),
             sum(len(v.get("cards", [])) for v in S.values()), figs))



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
    _synergy("ramadan.html")
