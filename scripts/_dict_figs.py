# -*- coding: utf-8 -*-
"""Four plates for the encyclopedia. Not decoration: each one explains something
   a reader needs in order to use the dictionary itself."""
import math

def fig(svg, legend, cap, cls=""):
    leg = "".join("<li>%s</li>" % l for l in legend)
    return ('<figure class="fig mo-pop mo-draw%s">' % ((" " + cls) if cls else "") + svg +
            ('<ul class="leg">' + leg + "</ul>" if legend else "") +
            '<figcaption class="cap">' + cap + "</figcaption></figure>")

def arrow(x1, y1, x2, y2, head=9):
    a = math.atan2(y2 - y1, x2 - x1)
    ax, ay = x2 - head * math.cos(a - .44), y2 - head * math.sin(a - .44)
    bx, by = x2 - head * math.cos(a + .44), y2 - head * math.sin(a + .44)
    return "M%.1f %.1fL%.1f %.1fM%.1f %.1fL%.1f %.1fL%.1f %.1f" % (x1, y1, x2, y2, ax, ay, x2, y2, bx, by)


def fig_domains(counts):
    """A wheel of the seven domains, each arc sized by how many words it holds."""
    order = [("aqidah", "belief"), ("ibadah", "worship"), ("quran", "the Qur’an"),
             ("hadith", "hadith"), ("fiqh", "law"), ("tazkiyah", "the heart"), ("tarikh", "history")]
    total = sum(counts.get(k, 0) for k, _ in order) or 1
    cx, cy, R, r = 250, 214, 138, 78
    p = ['<svg viewBox="0 0 500 400" role="img" aria-label="A wheel divided into seven arcs, one for '
         'each domain of the dictionary, each arc as wide as the number of words it holds.">']
    ang = -90.0
    labels = []
    order = [(k, nm) for k, nm in order if counts.get(k, 0) > 0] or order
    for i, (k, name) in enumerate(order):
        n = counts.get(k, 0)
        if not n:
            continue
        span = 360.0 * n / total
        a0, a1 = math.radians(ang), math.radians(ang + span)
        large = 1 if span > 180 else 0
        x0, y0 = cx + R * math.cos(a0), cy + R * math.sin(a0)
        x1, y1 = cx + R * math.cos(a1), cy + R * math.sin(a1)
        xi, yi = cx + r * math.cos(a1), cy + r * math.sin(a1)
        xj, yj = cx + r * math.cos(a0), cy + r * math.sin(a0)
        d = ("M%.1f %.1fA%d %d 0 %d 1 %.1f %.1fL%.1f %.1fA%d %d 0 %d 0 %.1f %.1fZ"
             % (x0, y0, R, R, large, x1, y1, xi, yi, r, r, large, xj, yj))
        p.append('<path class="w%d" d="%s"/>' % (i % 4, d))
        mid = math.radians(ang + span / 2)
        lx, ly = cx + (R + 26) * math.cos(mid), cy + (R + 26) * math.sin(mid)
        anchor = "middle" if abs(math.cos(mid)) < .3 else ("start" if math.cos(mid) > 0 else "end")
        labels.append('<text class="fl" x="%.1f" y="%.1f" text-anchor="%s">%s</text>'
                      % (lx, ly, anchor, name))
        labels.append('<text class="fs" x="%.1f" y="%.1f" text-anchor="%s">%d</text>'
                      % (lx, ly + 16, anchor, n))
        ang += span
    p += labels
    p.append('<text class="fg" x="%d" y="%d" text-anchor="middle">%d</text>' % (cx, cy - 2, total))
    p.append('<text class="fs" x="%d" y="%d" text-anchor="middle">words of the Path</text>' % (cx, cy + 20))
    p.append("</svg>")
    return fig("".join(p),
               ["Every arc is a door. Choosing one filters the whole list below to that domain.",
                "The wheel is drawn from the dictionary itself, so it can never disagree with it."],
               "<b>The shape of the vocabulary.</b> Worship and law carry the most words because they "
               "are the parts of the religion a person meets every day.")


def fig_root():
    """How one Arabic root grows a family of words: the single most useful thing
       a non Arabic reader can learn about the vocabulary of Islam."""
    p = ['<svg viewBox="0 0 540 330" role="img" aria-label="Three Arabic letters at the centre, k t b, '
         'with five words growing out of them: kitab a book, maktab a desk, katib a writer, maktaba a '
         'library, and maktub written.">']
    cx, cy = 270, 168
    p.append('<path class="s3" d="M%d %dm-56 0a56 56 0 1 0 112 0a56 56 0 1 0 -112 0Z"/>' % (cx, cy))
    p.append('<text class="fgar" x="%d" y="%d" text-anchor="middle">ك ت ب</text>' % (cx, cy + 4))
    p.append('<text class="fs" x="%d" y="%d" text-anchor="middle">k t b, the idea of writing</text>' % (cx, cy + 30))
    words = [("kitab", "a book", 200), ("katib", "a writer", 252), ("maktab", "a desk", 308),
             ("maktaba", "a library", 20), ("maktub", "written, and so, destined", 128)]
    for name, gloss, deg in words:
        a = math.radians(deg)
        x1, y1 = cx + 58 * math.cos(a), cy + 58 * math.sin(a)
        x2, y2 = cx + 104 * math.cos(a), cy + 104 * math.sin(a)
        p.append('<path class="s3" d="%s"/>' % arrow(x1, y1, x2, y2, 7))
        lx, ly = cx + 118 * math.cos(a), cy + 118 * math.sin(a)
        anchor = "middle" if abs(math.cos(a)) < .3 else ("start" if math.cos(a) > 0 else "end")
        p.append('<text class="fl" x="%.1f" y="%.1f" text-anchor="%s">%s</text>' % (lx, ly, anchor, name))
        p.append('<text class="fs" x="%.1f" y="%.1f" text-anchor="%s">%s</text>' % (lx, ly + 16, anchor, gloss))
    p.append("</svg>")
    return fig("".join(p),
               ["Almost every Arabic word in this dictionary is three letters wearing a different coat.",
                "Learn the root and you have not learned one word, you have learned a family of them.",
                "It is also why maktub, written, came to mean destined: it is the same idea, already set down."],
               "<b>How to read an entry.</b> Where a word has a root worth knowing, the entry says what "
               "the root literally means before it says what the term came to mean.", cls="figwide")


def fig_isnad():
    """The chain, and where a grading comes from."""
    p = ['<svg viewBox="0 0 540 300" role="img" aria-label="A chain of five narrators running from the '
         'Prophet to the collector, with the chain called the isnad and the text at the end called the '
         'matn, and the grading marks beneath.">']
    xs = [70, 165, 260, 355, 450]
    labs = ["the Prophet ﷺ", "a companion", "a follower", "a narrator", "the collector"]
    for i, (x, lab) in enumerate(zip(xs, labs)):
        p.append('<path class="%s" d="M%d 106m-22 0a22 22 0 1 0 44 0a22 22 0 1 0 -44 0Z"/>'
                 % ("s1 f1" if i == 0 else "s1", x))
        p.append('<text class="fs" x="%d" y="152" text-anchor="middle">%s</text>' % (x, lab))
        if i < 4:
            p.append('<path class="s3" d="%s"/>' % arrow(x + 26, 106, xs[i + 1] - 26, 106, 7))
    p.append('<path class="s2" d="M60 66h420" stroke-dasharray="4 6"/>')
    p.append('<text class="fg" x="270" y="52" text-anchor="middle">the isnad</text>')
    p.append('<text class="fs" x="270" y="86" text-anchor="middle">who heard it from whom, named one by one</text>')
    p.append('<path class="s1 f1" d="M406 186h108v46H406Z"/>')
    p.append('<text class="fl" x="460" y="214" text-anchor="middle">the matn</text>')
    p.append('<path class="s3" d="%s"/>' % arrow(450, 134, 460, 182, 7))
    p.append('<text class="fs" x="460" y="250" text-anchor="middle">the words themselves</text>')
    for i, (name, x) in enumerate((("sahih", 90), ("hasan", 190), ("da’if", 290))):
        p.append('<path class="s1" d="M%d 200m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0Z"/>' % x)
        p.append('<text class="fl" x="%d" y="228" text-anchor="middle">%s</text>' % (x, name))
    p.append('<text class="fs" x="190" y="252" text-anchor="middle">the grade is a verdict on the chain, not on the meaning</text>')
    p.append("</svg>")
    return fig("".join(p),
               ["A hadith is two things: the chain of people who carried it, and the words they carried.",
                "Sahih, hasan and da‘if grade the chain. A weak chain does not make a statement false; it "
                "means this particular route does not establish it.",
                "This is why the Codex names the collection beside every narration, and drops a number it "
                "cannot stand behind."],
               "<b>Why the badges look the way they do.</b> An entry marked Sunnah is carried by a chain "
               "the scholars accepted. One marked Editorial is carried by us, and says so.", cls="figwide")


def fig_ahkam():
    """The five rulings, as a scale rather than a list."""
    p = ['<svg viewBox="0 0 540 250" role="img" aria-label="A horizontal scale of the five rulings, from '
         'obligatory through recommended, permitted and disliked, to forbidden.">']
    steps = [("fard", "obligatory", "doing it is rewarded, leaving it is sinful"),
             ("mandub", "recommended", "rewarded, and no sin in leaving it"),
             ("mubah", "permitted", "neither, and most of life lives here"),
             ("makruh", "disliked", "better left, and no sin in doing it"),
             ("haram", "forbidden", "leaving it is rewarded, doing it is sinful")]
    p.append('<path class="s3" d="M46 138H494"/>')
    for i, (name, gloss, note) in enumerate(steps):
        x = 70 + i * 100
        cls = "f2" if i in (0, 4) else "f1"
        p.append('<path class="s1 %s" d="M%d 138m-13 0a13 13 0 1 0 26 0a13 13 0 1 0 -26 0Z"/>' % (cls, x))
        p.append('<text class="fl" x="%d" y="%d" text-anchor="middle">%s</text>' % (x, 108 if i % 2 == 0 else 186, name))
        p.append('<text class="fs" x="%d" y="%d" text-anchor="middle">%s</text>' % (x, 90 if i % 2 == 0 else 204, gloss))
    p.append('<text class="fs" x="70" y="60" text-anchor="middle">must</text>')
    p.append('<text class="fs" x="470" y="60" text-anchor="middle">must not</text>')
    p.append('<text class="fs" x="270" y="236" text-anchor="middle">most of what a person does in a day sits in the middle, and is simply allowed</text>')
    p.append("</svg>")
    return fig("".join(p),
               ["Five verdicts, not two. A great deal of argument dissolves once disliked is not confused "
                "with forbidden, and recommended is not confused with obligatory.",
                "Where the schools place a particular act differently, the entry says so and gives the "
                "Scholars differ badge rather than choosing for you."],
               "<b>The scale every fiqh entry is measured on.</b> When an entry says wajib, mandub or "
               "makruh, this is the ladder it is pointing at.")
