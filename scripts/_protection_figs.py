# -*- coding: utf-8 -*-
"""Eight original figures for the room of Protection.
   House conventions: .s1 gold stroke, .s2 pale stroke, .s3 faint stroke,
   .f1 gold wash, .f2 solid gold, .fg heading, .fl label, .fs small.
   Every figure is wrapped in .fig .mo-pop .mo-draw so GSAP draws it on."""
import math
A = "’"


def fig(svg, legend, cap, cls=""):
    leg = "".join("<li>%s</li>" % l for l in legend)
    return ('<div class="fig mo-pop mo-draw%s">' % ((" " + cls) if cls else "") + svg +
            ('<ul class="leg">' + leg + "</ul>" if legend else "") +
            '<p class="cap">' + cap + "</p></div>")


def arrow(x1, y1, x2, y2, head=9):
    a = math.atan2(y2 - y1, x2 - x1)
    ax, ay = x2 - head * math.cos(a - .44), y2 - head * math.sin(a - .44)
    bx, by = x2 - head * math.cos(a + .44), y2 - head * math.sin(a + .44)
    return "M%.1f %.1fL%.1f %.1fM%.1f %.1fL%.1f %.1fL%.1f %.1f" % (x1, y1, x2, y2, ax, ay, x2, y2, bx, by)


# --------------------------------------------------------------- 1. permission
def fig_permission():
    """Harm arrives from every side; nothing crosses the gate unpermitted."""
    parts = []
    parts.append('<svg viewBox="0 0 480 316" role="img" aria-label="Arrows of harm arriving from '
                 'every direction toward a person at the centre, all of them stopped at a circular '
                 'gate marked by His permission, with one small arrow allowed through.">')
    cx, cy = 240, 168
    parts.append('<path class="s3" d="M%d %dm-%d 0a%d %d 0 1 0 %d 0a%d %d 0 1 0 -%d 0Z"/>'
                 % (cx, cy, 104, 104, 104, 208, 104, 104, 208))
    # the gate ring
    parts.append('<path class="s1" d="M%d %dm-%d 0a%d %d 0 1 0 %d 0a%d %d 0 1 0 -%d 0Z"/>'
                 % (cx, cy, 84, 84, 84, 168, 84, 84, 168))
    # arrows of harm, stopped at the ring
    for ang in (198, 232, 270, 308, 342, 18, 128, 160):
        th = math.radians(ang)
        x1, y1 = cx + 138 * math.cos(th), cy + 138 * math.sin(th)
        x2, y2 = cx + 92 * math.cos(th), cy + 92 * math.sin(th)
        parts.append('<path class="s2" d="%s"/>' % arrow(x1, y1, x2, y2))
        # the block mark on the ring
        bx, by = cx + 84 * math.cos(th), cy + 84 * math.sin(th)
        parts.append('<path class="s1" d="M%.1f %.1fl%.1f %.1f" />'
                     % (bx - 7 * math.sin(th), by + 7 * math.cos(th), 14 * math.sin(th), -14 * math.cos(th)))
    # the one that is allowed through, thin and small
    th = math.radians(56)
    parts.append('<path class="s2" d="%s" stroke-dasharray="4 4"/>'
                 % arrow(cx + 138 * math.cos(th), cy + 138 * math.sin(th), cx + 34 * math.cos(th), cy + 34 * math.sin(th), 7))
    # the person
    parts.append('<path class="s1 f1" d="M%d %dm-20 0a20 20 0 1 0 40 0a20 20 0 1 0 -40 0Z"/>' % (cx, cy))
    parts.append('<text class="fg" x="%d" y="%d" text-anchor="middle">you</text>' % (cx, cy + 6))
    parts.append('<text class="fg" x="%d" y="26" text-anchor="middle">بِإِذْنِ اللَّهِ</text>' % cx)
    parts.append('<text class="fl" x="%d" y="48" text-anchor="middle">by His permission</text>' % cx)
    parts.append('<text class="fs" x="%d" y="306" text-anchor="middle">nothing crosses that was not allowed to cross</text>' % cx)
    parts.append("</svg>")
    legend = [
        "Every arrow is real. The Qur"+A+"an does not pretend the harm is imaginary, and neither does this room.",
        "Not one of them decides anything. They stop at a ring they did not build and cannot argue with.",
        "The dotted one is allowed through, and it is allowed by the same Hand you are already asking. "
        "That is why the asking is the whole method.",
    ]
    cap = ("<b>Qur"+A+"an 2:102.</b> They do not harm anyone through it except by the permission of Allah. The verse "
           "confirms the thing exists in one half and fences it in the other.")
    return fig("".join(parts), legend, cap)


# ------------------------------------------------------------- 2. the day ring
def fig_day():
    """A twenty four hour ring: where the free protection actually sits."""
    p = []
    p.append('<svg viewBox="0 0 480 372" role="img" aria-label="A twenty four hour ring marked with the '
             'five prayers, the morning and evening remembrance, and the recitation before sleep.">')
    cx, cy, R = 240, 178, 112
    p.append('<path class="s3" d="M%d %dm-%d 0a%d %d 0 1 0 %d 0a%d %d 0 1 0 -%d 0Z"/>' % (cx, cy, R, R, R, 2*R, R, R, 2*R))
    p.append('<path class="s3" d="M%d %dm-%d 0a%d %d 0 1 0 %d 0a%d %d 0 1 0 -%d 0Z"/>' % (cx, cy, R-34, R-34, R-34, 2*(R-34), R-34, R-34, 2*(R-34)))
    # night arc (sunset to sunrise) faint band
    marks = [(-90, "fajr", ""), (-26, "dhuhr", ""), (16, "asr", ""),
             (58, "maghrib", ""), (104, "isha", ""), (215, "sleep", "")]
    for ang, lab, sub in marks:
        th = math.radians(ang)
        x1, y1 = cx + (R-34) * math.cos(th), cy + (R-34) * math.sin(th)
        x2, y2 = cx + R * math.cos(th), cy + R * math.sin(th)
        p.append('<path class="s1" d="M%.1f %.1fL%.1f %.1f"/>' % (x1, y1, x2, y2))
        lx, ly = cx + (R + 26) * math.cos(th), cy + (R + 26) * math.sin(th)
        anchor = "middle" if abs(math.cos(th)) < .35 else ("start" if math.cos(th) > 0 else "end")
        p.append('<text class="fl" x="%.1f" y="%.1f" text-anchor="%s">%s</text>' % (lx, ly + 5, anchor, lab))
    # the three duties on the ring
    for ang, txt in ((-90, "the three surahs, three times"), (100, "the three surahs, three times"),
                     (208, "Kursi, and the two verses")):
        th = math.radians(ang)
        p.append('<path class="s1 f2" d="M%.1f %.1fm-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0Z"/>'
                 % (cx + (R-34) * math.cos(th), cy + (R-34) * math.sin(th)))
    p.append('<text class="fg" x="%d" y="%d" text-anchor="middle">two minutes</text>' % (cx, cy - 4))
    p.append('<text class="fs" x="%d" y="%d" text-anchor="middle">in the whole day</text>' % (cx, cy + 18))
    p.append('<text class="fs" x="%d" y="352" text-anchor="middle">morning · after each prayer · evening · before sleep</text>' % cx)
    p.append("</svg>")
    legend = [
        "Morning: al-Ikhlas, al-Falaq and an-Nas three times, then the two sentences of refuge.",
        "After each of the five: Ayat al-Kursi, twenty seconds.",
        "Evening, before the sun goes: the same as the morning.",
        "Before sleep: Ayat al-Kursi, the last two verses of al-Baqarah, and the hands over the body three times.",
    ]
    cap = ("<b>The daily core.</b> Added together it is under two minutes, it was taught in public, and no "
           "part of it has ever cost anybody anything.")
    return fig("".join(p), legend, cap)


# ------------------------------------------------------------ 3. the shields
def fig_shield():
    """Nested arcs: what each recitation is reported to cover."""
    p = []
    p.append('<svg viewBox="0 0 620 300" role="img" aria-label="Five nested shield outlines, each '
             'labelled with a recitation, the innermost being the opening of the Book.">')
    layers = [(0, "an-Nas", "the whisperer"), (1, "al-Falaq", "what He created, and envy"),
              (2, "al-Ikhlas", "the One He is"), (3, "Ayat al-Kursi", "the night, and sleep"),
              (4, "al-Fatiha", "the cure, the opening")]
    for i, (k, name, sub) in enumerate(layers):
        s = 1 - i * 0.155
        w, h = 176 * s, 210 * s
        cx, top = 148, 46 + (210 - h) / 2
        d = ("M%.1f %.1f h%.1f v%.1f q0 %.1f -%.1f %.1f q-%.1f -%.1f -%.1f -%.1f Z"
             % (cx - w/2, top, w, h*0.56, h*0.30, w/2, h*0.44, w/2, h*0.14, w/2, h*0.44))
        p.append('<path class="%s" d="%s"/>' % ("s1" if i == 4 else "s2", d))
        p.append('<text class="%s" x="300" y="%.0f">%s</text>' % ("fg" if i == 4 else "fl", 74 + i * 42, name))
        p.append('<text class="fs" x="300" y="%.0f">%s</text>' % (92 + i * 42, sub))
        p.append('<path class="s3" d="M%.1f %.1fL292 %.0f"/>' % (cx + w/2, top + h*0.34, 70 + i * 42))
    p.append('<text class="fs" x="310" y="288" text-anchor="middle">layered, not stacked: each one is complete on its own</text>')
    p.append("</svg>")
    legend = [
        "None of these is a component of a system. Each was given as sufficient by itself.",
        "They are drawn nested because in practice people say them together, and because the smallest of "
        "them, seven verses, is the one called a cure in the narration of the traveller.",
    ]
    cap = ("<b>Bukhari and Muslim.</b> How did you know it was a ruqya? The companion had recited nothing but the "
           "opening of the Book.")
    return fig("".join(p), legend, cap)


# ---------------------------------------------------------- 4. self ruqya
def fig_ruqya():
    """Five steps, drawn as a hand and a body, done on yourself."""
    p = []
    p.append('<svg viewBox="0 0 620 258" role="img" aria-label="Five steps: cupped hands, recitation into '
             'them, a light breath, the hands wiped over the head and body, repeated three times.">')
    xs = [88, 232, 376, 520]
    labs = [("cup", "both hands"), ("recite", "into them"), ("blow", "a light breath"), ("wipe", "head and body")]
    for i, (x, (a, b)) in enumerate(zip(xs, labs)):
        p.append('<path class="s3" d="M%d 62m-40 0a40 40 0 1 0 80 0a40 40 0 1 0 -80 0Z"/>' % x)
        if i == 0:
            # two open palms, cupped together
            p.append('<path class="s1" d="M%d 78q-26 -4 -24 -26q1 -9 8 -8q6 1 7 10M%d 78q26 -4 24 -26q-1 -9 -8 -8q-6 1 -7 10"/>' % (x, x))
            p.append('<path class="s1" d="M%d 78q-14 10 0 15q14 -5 0 -15Z"/>' % x)
        elif i == 1:
            # the same cup, with recitation arriving into it
            p.append('<path class="s1" d="M%d 80q-16 -4 -15 -20M%d 80q16 -4 15 -20"/>' % (x, x))
            p.append('<path class="s1" d="M%d 80q-14 10 0 15q14 -5 0 -15Z"/>' % x)
            for k, r in enumerate((13, 21, 29)):
                p.append('<path class="s2" d="M%d %dq%d -11 %d 0"/>' % (x - r, 54 - k * 9, r, 2 * r))
        elif i == 2:
            # the cup, and one light breath leaving the mouth
            p.append('<path class="s1" d="M%d 80q-16 -4 -15 -20M%d 80q16 -4 15 -20"/>' % (x, x))
            p.append('<path class="s1" d="M%d 80q-14 10 0 15q14 -5 0 -15Z"/>' % x)
            p.append('<path class="s2" d="%s"/>' % arrow(x, 56, x, 34, 7))
            p.append('<path class="s3" d="M%d 44q-9 -5 -15 -1M%d 44q9 -5 15 -1"/>' % (x - 2, x + 2))
        else:
            # a head and shoulders, a hand passing over
            p.append('<path class="s1" d="M%d 44m-12 0a12 12 0 1 0 24 0a12 12 0 1 0 -24 0Z"/>' % x)
            p.append('<path class="s1" d="M%d 60q-20 4 -22 26h44q-2 -22 -22 -26Z"/>' % x)
            p.append('<path class="s2" d="M%d 40q14 -14 28 -2"/>' % (x - 4))
            p.append('<path class="s2" d="%s"/>' % arrow(x + 26, 40, x + 30, 58, 6))
        p.append('<text class="fl" x="%d" y="126" text-anchor="middle">%s</text>' % (x, a))
        p.append('<text class="fs" x="%d" y="144" text-anchor="middle">%s</text>' % (x, b))
        if i < 3:
            p.append('<path class="s3" d="%s"/>' % arrow(x + 46, 62, x + 126, 62, 7))
    p.append('<path class="s3" d="%s"/>' % arrow(520, 178, 520, 196, 7))
    p.append('<path class="s3" d="M520 196H88"/>')
    p.append('<path class="s3" d="%s"/>' % arrow(88, 196, 88, 178, 7))
    p.append('<text class="fg" x="304" y="222" text-anchor="middle">three times</text>')
    p.append('<text class="fs" x="304" y="246" text-anchor="middle">ten minutes a night, for a week, before you conclude anything</text>')
    p.append("</svg>")
    legend = [
        "Recite into the hands: al-Ikhlas, al-Falaq, an-Nas. Al-Fatiha and Ayat al-Kursi belong here too.",
        "The blow is nafth, a breath with the lightest spray in it, not spitting.",
        "Begin at the head and the face, then as much of the body as you can reach.",
        "Nobody else is needed for any of this, and nobody may charge you for it.",
    ]
    cap = ("<b>Bukhari and Muslim,</b> the narration of "+"‘"+"A"+A+"isha on what he ﷺ did every night, and on what she did "
           "for him with his own hands when he was too weak to do it himself.")
    return fig("".join(p), legend, cap)


# ------------------------------------------------------------ 5. two rooms
def fig_rooms():
    """The closed door and the open door: how to tell them apart in ten seconds."""
    p = []
    p.append('<svg viewBox="0 0 480 268" role="img" aria-label="Two rooms side by side. On the left a '
             'closed door with money, a photograph and unreadable script. On the right an open door with '
             'a Qur’an, daylight and a second person present.">')
    # left room, closed
    p.append('<path class="s2" d="M28 52h190v170H28Z"/>')
    p.append('<path class="s2" d="M96 92h54v130H96Z"/>')
    p.append('<path class="s2 f1" d="M140 158m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0Z"/>')
    p.append('<path class="s3" d="M44 176h34v30H44Z"/>')
    p.append('<text class="fs" x="61" y="196" text-anchor="middle">fee</text>')
    p.append('<path class="s3" d="M170 176h34v30h-34Z"/>')
    p.append('<path class="s3" d="M176 200l8 -10l6 7l6 -9l6 12"/>')
    p.append('<path class="s3" d="M52 82h40M52 94h30M52 106h36"/>')
    p.append('<text class="fs" x="123" y="242" text-anchor="middle">closed, alone, unreadable</text>')
    p.append('<text class="fl" x="123" y="36" text-anchor="middle">walk out</text>')
    # right room, open
    p.append('<path class="s1" d="M262 52h190v170H262Z"/>')
    p.append('<path class="s1" d="M330 92h54v130H330Z"/>')
    p.append('<path class="s1" d="M330 92l-30 -18v130l30 18"/>')
    p.append('<path class="s2" d="M400 88l22 -22M400 108l30 -30M406 128l30 -30"/>')
    p.append('<path class="s1 f1" d="M286 150h34v40h-34Z"/>')
    p.append('<path class="s1" d="M303 150v40"/>')
    p.append('<path class="s2" d="M292 202m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0Z"/>')
    p.append('<path class="s2" d="M314 202m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0Z"/>')
    p.append('<text class="fs" x="357" y="242" text-anchor="middle">open, aloud, in front of somebody</text>')
    p.append('<text class="fg" x="357" y="36" text-anchor="middle">stay</text>')
    p.append("</svg>")
    legend = [
        "The honest one recites aloud, in Arabic you can follow, with the door open and somebody present.",
        "He tells you to see a doctor, he teaches you the method so you can do it yourself, and he finishes.",
        "The other one needs the door shut, because what he is doing cannot survive being watched.",
    ]
    cap = ("<b>The three conditions, applied.</b> Speech of Allah, in words whose meaning is known, believing that "
           "Allah alone acts. Script you cannot read fails the second one before you have paid anybody.")
    return fig("".join(p), legend, cap)


# --------------------------------------------------------------- 6. seven days
def fig_days():
    p = []
    p.append('<svg viewBox="0 0 480 218" role="img" aria-label="Seven columns, one per day, each carrying '
             'the same four small marks, with the doctor on the first day and the review on the seventh.">')
    rows = ["words", "ruqya", "walk", "sleep"]
    for d in range(7):
        x = 100 + d * 54
        p.append('<path class="s3" d="M%d 48v128"/>' % x)
        p.append('<text class="fs" x="%d" y="36" text-anchor="middle">%d</text>' % (x, d + 1))
        for r in range(4):
            y = 68 + r * 28
            cls = "s1 f2" if d < 7 else "s3"
            p.append('<path class="%s" d="M%d %dm-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0Z"/>' % (cls, x, y))
    for r, name in enumerate(rows):
        p.append('<text class="fs" x="76" y="%d" text-anchor="end">%s</text>' % (72 + r * 28, name))
    p.append('<path class="s1" d="M100 190v14M100 204h30"/>')
    p.append('<text class="fl" x="136" y="209">the doctor</text>')
    p.append('<path class="s1" d="M424 190v14M424 204h-30"/>')
    p.append('<text class="fl" x="388" y="209" text-anchor="end">what changed</text>')
    p.append("</svg>")
    legend = [
        "Four small things, repeated. Not one of them is impressive on its own and that is the design.",
        "The doctor goes on day one, not day seven, because if there is a medical cause every day of "
        "waiting is a day of it untreated.",
        "On the seventh day write down what changed, not how you feel. Feelings at midnight are not data.",
    ]
    cap = ("<b>One week, then judge.</b> Most people who actually complete this do not need a healer. Some do need "
           "a doctor. That is the honest split.")
    return fig("".join(p), legend, cap)


# ---------------------------------------------------- 7. the heart, twice
def fig_heart():
    """The signature figure of the room: one heart, two trainings, one centre."""
    p = []
    p.append('<svg viewBox="0 0 680 348" role="img" aria-label="One heart at the centre. On the left the '
             'remembrance, the prayer, the Qur’an and good company feed into it. On the right walking, '
             'carrying, sleep and daylight feed into the same heart.">')
    heart = ("M340 274 C 246 214 208 178 208 134 C 208 102 232 80 262 80 C 288 80 314 96 340 128 "
             "C 366 96 392 80 418 80 C 448 80 472 102 472 134 C 472 178 434 214 340 274 Z")
    p.append('<defs><clipPath id="phl"><rect x="0" y="0" width="340" height="348"/></clipPath></defs>')
    p.append('<path class="s3" d="%s"/>' % heart)
    p.append('<g clip-path="url(#phl)"><path class="s1" d="%s"/></g>' % heart)
    p.append('<path class="s2" d="M340 82v192" stroke-dasharray="5 7"/>')
    left = [("dhikr", "morning and evening"), ("salah", "five, at their times"),
            ("Qur’an", "read in the house"), ("suhba", "one who knows you")]
    right = [("walking", "thirty minutes, outside"), ("carrying", "twice a week, heavy"),
             ("sleep", "seven hours, phone away"), ("sun", "the hour after fajr")]
    # where each connector lands on the heart, spread down its edge
    lpts = [(258, 96), (226, 132), (240, 178), (276, 218)]
    rpts = [(422, 96), (454, 132), (440, 178), (404, 218)]
    for i, (a, bsub) in enumerate(left):
        y = 104 + i * 52
        p.append('<text class="fl" x="176" y="%d" text-anchor="end">%s</text>' % (y, a))
        p.append('<text class="fs" x="176" y="%d" text-anchor="end">%s</text>' % (y + 18, bsub))
        p.append('<path class="s3" d="%s"/>' % arrow(188, y - 5, lpts[i][0] - 6, lpts[i][1], 7))
    for i, (a, bsub) in enumerate(right):
        y = 104 + i * 52
        p.append('<text class="fl" x="504" y="%d">%s</text>' % (y, a))
        p.append('<text class="fs" x="504" y="%d">%s</text>' % (y + 18, bsub))
        p.append('<path class="s3" d="%s"/>' % arrow(492, y - 5, rpts[i][0] + 6, rpts[i][1], 7))
    p.append('<text class="fg" x="108" y="46" text-anchor="middle">القَلْب</text>')
    p.append('<text class="fs" x="108" y="66" text-anchor="middle">the one that fears</text>')
    p.append('<text class="fg" x="572" y="46" text-anchor="middle">القَلْب</text>')
    p.append('<text class="fs" x="572" y="66" text-anchor="middle">the one that beats</text>')
    p.append('<text class="fl" x="340" y="306" text-anchor="middle">one word, one organ, two trainings</text>')
    p.append('<text class="fs" x="340" y="330" text-anchor="middle">and each one makes the other easier</text>')
    p.append("</svg>")
    legend = [
        "The Arabic did not separate them, and neither does the body. A steadier pulse is a steadier state "
        "to pray in, and a settled heart sleeps, which is most of what the other side needs.",
        "The left column is worship and is obligatory on its own terms. The right column is not worship, "
        "and is not being smuggled in as worship. It is maintenance of something you were lent.",
        "Neither column treats serious illness. Both of them make a person harder to frighten.",
    ]
    cap = ("<b>Muslim 2664.</b> The strong believer is better and more beloved to Allah than the weak believer, "
           "and in both there is good. The second half is not decoration; it is protection for anybody who cannot "
           "train today.")
    return fig("".join(p), legend, cap, cls="figwide")


# ------------------------------------------------------------ 8. the week
def fig_week():
    """A week of movement, stacked so the total is the point."""
    p = []
    p.append('<svg viewBox="0 0 560 260" role="img" aria-label="A stacked bar for each day of the week: a '
             'walk every day, three faster sessions, and two sessions of carrying something heavy.">')
    days = [("Sat", 25, 0, 0), ("Sun", 25, 30, 0), ("Mon", 25, 0, 20), ("Tue", 25, 30, 0),
            ("Wed", 25, 0, 0), ("Thu", 25, 30, 20), ("Fri", 30, 0, 0)]
    base, unit, bw = 190, 1.55, 38
    p.append('<path class="s3" d="M52 %d H524"/>' % base)
    for g in (30, 60, 90):
        y = base - g * unit
        p.append('<path class="s3" d="M52 %.1fH524" stroke-dasharray="3 7"/>' % y)
        p.append('<text class="fs" x="44" y="%.1f" text-anchor="end">%d</text>' % (y + 5, g))
    for i, (d, walk, fast, lift) in enumerate(days):
        x = 82 + i * 62
        y = base
        for h, cls in ((walk, "b1"), (fast, "b2"), (lift, "b3")):
            if not h:
                continue
            hh = h * unit
            p.append('<path class="%s" d="M%.1f %.1fh%d v%.1f h-%d Z"/>' % (cls, x - bw / 2, y - hh, bw, hh, bw))
            y -= hh
        p.append('<text class="fs" x="%.1f" y="%d" text-anchor="middle">%s</text>' % (x, base + 20, d))
    for k, (lab, cls) in enumerate((("walk", "b1"), ("faster", "b2"), ("carry", "b3"))):
        lx = 138 + k * 130
        p.append('<path class="%s" d="M%d 236h20v13h-20Z"/>' % (cls, lx - 26))
        p.append('<text class="fs" x="%d" y="247">%s</text>' % (lx, lab))
    p.append('<text class="fs" x="52" y="26">minutes a day</text>')
    p.append('<text class="fg" x="524" y="26" text-anchor="end">about 150 in the week</text>')
    p.append("</svg>")
    legend = [
        "Almost all of it is walking, and the walk after fajr is the one that does the most.",
        "Faster means fast enough that a full sentence is work. Not running, unless you like running.",
        "Carrying is bags, stairs, a child, or weights. Twenty minutes, twice, is the whole strength target.",
        "One day of the week should be play rather than training. He ﷺ raced, and lost, and remembered it.",
    ]
    cap = ("<b>Editorial.</b> This is the ordinary public health target arranged around a day that already has five "
           "fixed points in it. Anyone with a heart condition, a pregnancy or an injury asks a doctor first.")
    return fig("".join(p), legend, cap)


FIGURES = {
    "permission": fig_permission, "day": fig_day, "shield": fig_shield, "ruqya": fig_ruqya,
    "rooms": fig_rooms, "days": fig_days, "heart": fig_heart, "week": fig_week,
}
