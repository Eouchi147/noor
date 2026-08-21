#!/usr/bin/env python3
# NOOR v49 . The Golden Room: Hajj and Umrah
# Builds /hajj.html from build/hajj-content.json through the canonical room shell.
# The shell (room.py) supplies head, menu, ink hero and footer; this file supplies
# only the room: its CSS, its <main>, its ten figures, its script.
#
# Accuracy outranks beauty in this room. Every ruling carries a badge, the four
# schools are given their own words wherever they part, and nothing is stated
# with more confidence than the evidence carries.
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from room import shell  # noqa: E402

SRC = os.path.join(ROOT, "build", "hajj-content.json")
OUT = os.path.join(ROOT, "hajj.html")

LEVELS = {
    "quran": ("Qur’an", "Stated directly in the Qur’an"),
    "sunnah": ("Sunnah", "Established in the authentic Sunnah"),
    "debated": ("Scholars differ", "The four schools read this one differently"),
    "editorial": ("Editorial", "Our own counsel, drawn from the sources named"),
}

RANKS = {
    "pillar": ("Pillar", "rk-p", "A rukn: leave it and the rite is not valid"),
    "obligation": ("Obligation", "rk-o", "A wajib: leave it and a sacrifice repairs it"),
    "sunnah": ("Sunnah", "rk-s", "Better, and nothing is owed for leaving it"),
    "most common": ("Most common", "rk-c", "What most pilgrims from outside the Haram do"),
}


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "’"))


# ---------------------------------------------------------------------------
# figure kit
# ---------------------------------------------------------------------------
# Every figure is one idea, drawn. The motion layer draws the strokes on scroll
# (class mo-draw on the wrapper) and lifts the parts (mo, mo-pop); nothing here
# runs its own observer. No faces, no figurative people: a pilgrim is a mark.

FS = {"htg": 20.0, "ht1": 18.0, "ht2": 15.0, "hts": 13.5, "htn": 15.0}
FW = {"htg": 0.64, "ht1": 0.64, "ht2": 0.60, "hts": 0.58, "htn": 0.64}
TEXTS = []   # every text of the figure being built, for the overlap check
REPORT = []
DRAWN = []


def T(x, y, s, cls="ht2", anchor="middle", extra=""):
    """One text element, recorded so the geometry can be checked afterwards."""
    key = cls.split()[0]
    fs = FS.get(key, 15.0)
    w = len(s) * fs * FW.get(key, 0.60)
    if anchor == "start":
        x0, x1 = x, x + w
        cls += " ta-s"
    elif anchor == "end":
        x0, x1 = x - w, x
        cls += " ta-e"
    else:
        x0, x1 = x - w / 2.0, x + w / 2.0
    TEXTS.append({"box": (x0, y - fs * 0.82, x1, y + fs * 0.26), "s": s})
    return '<text class="%s" x="%.1f" y="%.1f"%s>%s</text>' % (cls, x, y, extra, esc(s))


def d_arr(x1, y1, x2, y2, head=11.0):
    """One arrow as a single subpath string: shaft, then head."""
    a = math.atan2(y2 - y1, x2 - x1)
    ax, ay = x2 - head * math.cos(a - 0.44), y2 - head * math.sin(a - 0.44)
    bx, by = x2 - head * math.cos(a + 0.44), y2 - head * math.sin(a + 0.44)
    return ("M%.1f %.1fL%.1f %.1fM%.1f %.1fL%.1f %.1fL%.1f %.1f"
            % (x1, y1, x2, y2, ax, ay, x2, y2, bx, by))


def d_gap(x1, y1, x2, y2, n=7):
    """A broken line as one subpath string. A CSS dash pattern would be
    overwritten by the stroke drawing animation, so the gaps are real."""
    out = []
    for i in range(n):
        t0 = i / float(n)
        t1 = t0 + 0.56 / n
        out.append("M%.1f %.1fL%.1f %.1f"
                   % (x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0,
                      x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1))
    return "".join(out)


def d_circ(cx, cy, r):
    return ("M%.1f %.1fa%.1f %.1f 0 1 0 %.1f 0a%.1f %.1f 0 1 0 %.1f 0Z"
            % (cx - r, cy, r, r, 2 * r, r, r, -2 * r))


def d_ell(cx, cy, rx, ry):
    return ("M%.1f %.1fa%.1f %.1f 0 1 0 %.1f 0a%.1f %.1f 0 1 0 %.1f 0Z"
            % (cx - rx, cy, rx, ry, 2 * rx, rx, ry, -2 * rx))


def d_rect(x, y, w, h):
    return "M%.1f %.1fh%.1fv%.1fh%.1fZ" % (x, y, w, h, -w)


def d_cube(x, y, w=30.0, h=34.0):
    """The House, drawn as a plain cube. Never anything more than a cube."""
    return d_rect(x - w / 2, y - h / 2, w, h) + "M%.1f %.1fh%.1f" % (x - w / 2, y - h / 2 + 8, w)


def P(cls, *ds):
    """One element, one sweep of the pen. The motion layer staggers every
    drawable node it finds, so forty strokes must arrive as one path or the
    figure spends ten seconds half drawn."""
    d = "".join(x for x in ds if x)
    return ('<path class="%s" d="%s"/>' % (cls, d)) if d else ""


def fig(fid, alt, w, h, body, cap, legend=None):
    """Wrap a figure, then check its own geometry before letting it out."""
    check(fid, w, h)
    leg = ""
    if legend:
        leg = '<ul class="leg">' + "".join("<li>%s</li>" % l for l in legend) + "</ul>"
    n = body.count("<path") + body.count("<circle") + body.count("<rect") + body.count("<ellipse")
    DRAWN.append((fid, n))
    return ('<div class="fig mo-pop mo-draw">\n'
            '<svg viewBox="0 0 %d %d" class="hsvg" role="img" aria-labelledby="%s-t">\n'
            '<title id="%s-t">%s</title>\n%s\n</svg>\n%s'
            '<p class="cap">%s</p>\n</div>' % (w, h, fid, fid, esc(alt), body, leg, cap))


def check(fid, w, h):
    """No text may leave the viewBox, and no two texts may overlap."""
    global TEXTS
    bad = []
    for t in TEXTS:
        x0, y0, x1, y1 = t["box"]
        if x0 < -2 or x1 > w + 2 or y0 < -2 or y1 > h + 2:
            bad.append("OUTSIDE %s: %r box=(%.0f,%.0f,%.0f,%.0f)" % (fid, t["s"], x0, y0, x1, y1))
    for i in range(len(TEXTS)):
        for j in range(i + 1, len(TEXTS)):
            a, b = TEXTS[i]["box"], TEXTS[j]["box"]
            ox = min(a[2], b[2]) - max(a[0], b[0])
            oy = min(a[3], b[3]) - max(a[1], b[1])
            if ox > 0 and oy > 0:
                bad.append("OVERLAP %s: %r x %r (%.0f by %.0f)"
                           % (fid, TEXTS[i]["s"], TEXTS[j]["s"], ox, oy))
    REPORT.append((fid, len(TEXTS), bad))
    TEXTS = []


# --- 1. the call ------------------------------------------------------------

def fig_call():
    cx, cy, rx, ry = 330.0, 180.0, 290.0, 100.0
    arcs, heads = [], []
    for k in range(8):
        t = math.radians(k * 45.0)
        sx, sy = cx + rx * math.cos(t), cy + ry * math.sin(t)
        ex, ey = cx + 66 * math.cos(t), cy + 46 * math.sin(t)
        mx = (sx + ex) / 2 + 16 * math.sin(t)
        my = (sy + ey) / 2 - 16 * math.cos(t)
        arcs.append("M%.1f %.1fQ%.1f %.1f %.1f %.1f" % (sx, sy, mx, my, ex, ey))
        heads.append(d_arr(ex + (sx - ex) * 0.2, ey + (sy - ey) * 0.2, ex, ey, 9))
    body = [
        P("hs3", *[d_ell(cx, cy, rx * f, ry * f) for f in (1.0, 0.72, 0.44)]),
        P("hs2", *arcs),
        P("hs1", *heads),
        P("hs1", d_cube(cx, cy)),
        T(330, 40, "Labbayk", "htg"),
        T(330, 64, "here I am", "hts"),
        T(330, 308, "one call, made in an empty valley, still being answered", "hts"),
    ]
    return fig("fcall", "Paths converging from every direction on a single cube at the centre, "
                        "under the word labbayk, here I am.",
               660, 320, "".join(body),
               "<b>Qur\u2019an 22:27.</b> And proclaim to the people the pilgrimage: they will "
               "come to you on foot and on every lean camel, from every distant mountain pass. "
               "One man called out in a valley with nobody in it. Every crowd since has been the "
               "echo, and the first word you say when you enter ihram is not a request but a "
               "reply.")


# --- 2. the three ways ------------------------------------------------------

def fig_ways():
    x0, x1 = 168.0, 606.0
    rows = [("Tamattu\u2019", "Umrah, out, then Hajj", 120.0, "t"),
            ("Qiran", "both in one ihram", 210.0, "q"),
            ("Ifrad", "Hajj alone", 300.0, "i")]
    stops = [(x0, "miqat"), (332.0, "release"), (436.0, "8 Dhul Hijjah"), (606.0, "10 Dhul Hijjah")]
    gaps, bands, fills, opens, gems, texts = [], [], [], [], [], []
    for x, lab in stops:
        gaps.append(d_gap(x, 74, x, 320, 9))
        texts.append(T(x, 60, lab, "hts"))
    for name, sub, y, kind in rows:
        texts.append(T(16, y - 4, name, "ht1 htgold", "start"))
        texts.append(T(16, y + 16, sub, "hts", "start"))
        if kind == "t":
            bands.append("M%.0f %.0fH%.0f" % (x0, y, 332))
            bands.append("M%.0f %.0fH%.0f" % (436, y, x1))
            gaps.append(d_gap(336, y, 432, y, 5))
            fills.append(d_circ(x0, y, 6))
            fills.append(d_circ(436, y, 6))
            opens.append(d_circ(332, y, 6))
        else:
            bands.append("M%.0f %.0fH%.0f" % (x0, y, x1))
            fills.append(d_circ(x0, y, 6))
        opens.append(d_circ(x1, y, 6))
        if kind in ("t", "q"):
            gems.append("M%.0f %.0fl11 11l-11 11l-11 -11Z" % (566, y - 11))
            texts.append(T(566, y + 34, "hady", "hts htgold"))
    body = [P("hs3", *gaps), P("hs1 hband", *bands), P("hf2", *fills),
            P("hs2 hopen", *opens), P("hs1 hf1", *gems),
            T(566, 334, "no hady due", "hts"),
            T(330, 36, "where ihram is entered, released, and where a sacrifice falls", "hts")]
    return fig("fways", "Three parallel tracks showing tamattu\u2019, qiran and ifrad, with the "
                        "bars of ihram, the break in the middle of the first, and a diamond "
                        "marking where a sacrifice falls.",
               660, 350, "".join(body + texts),
               "<b>Qur\u2019an 2:196.</b> A solid bar is time spent in ihram. Only tamattu\u2019 "
               "has a gap in it, and that gap is the whole reason most pilgrims from outside the "
               "Haram choose it: you cannot stay wrapped in two cloths for the fortnight your "
               "flight gives you. The diamond is the hady, the sacrifice, which falls on "
               "tamattu\u2019 and qiran and not on ifrad.",
               ["A filled circle is where ihram is entered. An open circle is where it is "
                "released.",
                "The choice is made before you enter ihram at the miqat, not afterwards, because "
                "the sacrifice, the hair cutting and the second sa\u2019i all follow from it."])


# --- 3. the miqats ----------------------------------------------------------

def fig_miqat():
    cx, cy, rx, ry = 330.0, 205.0, 230.0, 135.0
    gates = [(-90, "Dhul Hulayfah", "from Madinah, the north", 330, 44, 330, 26),
             (-35, "Dhat Irq", "from Iraq, the north east", 552, 92, 552, 112),
             (15, "Qarn al-Manazil", "from Najd, the east", 556, 296, 556, 316),
             (90, "Yalamlam", "from Yemen, the south", 330, 372, 330, 392),
             (-145, "Al-Juhfah", "from Sham and Egypt", 110, 76, 110, 96)]
    tri, ring, ar, texts = [], [], [], []
    for deg, name, note, nx, ny, sx_, sy_ in gates:
        t = math.radians(deg)
        gx, gy = cx + rx * math.cos(t), cy + ry * math.sin(t)
        tri.append("M%.1f %.1fl-13 -16h26Z" % (gx, gy + 8))
        ring.append(d_circ(gx, gy, 9))
        ar.append(d_arr(gx + (cx - gx) * 0.22, gy + (cy - gy) * 0.22,
                        gx + (cx - gx) * 0.56, gy + (cy - gy) * 0.56, 9))
        texts.append(T(nx, ny, name, "ht2 htgold"))
        texts.append(T(sx_, sy_, note, "hts"))
    body = [P("hs3", d_ell(cx, cy, rx, ry)), P("hs2", *ar), P("hs1", *tri, d_cube(cx, cy, 34, 38)),
            P("hf1 hring", *ring),
            T(330, 172, "Makkah", "ht1"),
            T(110, 114, "the north west", "hts"),
            T(330, 256, "no one crosses a line without ihram", "hts"),
            T(330, 276, "whoever is nearer begins where he is", "hts")]
    return fig("fmiqat", "Five gates set on a ring around Makkah, one for each direction of "
                         "arrival, each with an arrow pointing inward to the House.",
               660, 420, "".join(body + texts),
               "<b>Bukhari 1524 and Muslim 1181.</b> He \ufdfa appointed them for "
               "the people of each direction, and for whoever passes through them from anywhere "
               "else, for whoever intends Hajj or Umrah. On the reading of the hadith scholars, "
               "four are named in explicit prophetic text, while Dhat Irq is reported in Bukhari "
               "as appointed by Umar when the cities of Iraq were opened, with reports raising it "
               "to the Prophet \ufdfa that those scholars discuss and do not all grade the same "
               "way. That assessment is theirs, repeated here. In practice all four schools treat "
               "it as the miqat of that direction.",
               ["An aircraft crosses the line in the air. Enter ihram before you pass over it, "
                "which in practice means changing at your departure airport and making the "
                "intention when the crew announces the miqat.",
                "Cross it without ihram while intending the rites and you return to it, or a "
                "sacrifice is due.",
                "Whoever already lives inside the ring enters ihram from where he is, and goes "
                "out to at-Tan\u2019im or al-Ji\u2019ranah only for an Umrah."])


# --- 4. the prohibitions of ihram -------------------------------------------

def fig_proh():
    cells = [("hair", "Cutting hair", "or clipping nails", "fidyah"),
             ("scent", "Perfume", "including scented soap", "fidyah"),
             ("cloth", "Stitched clothing", "for men, and the head", "fidyah"),
             ("veil", "Niqab and gloves", "for women, in ihram only", "fidyah"),
             ("nikah", "A marriage contract", "made, given, or proposed", "no expiation"),
             ("desire", "Touching with desire", "and intimacy in ihram", "invalidates"),
             ("hunt", "Hunting land game", "or helping another hunt it", "a like animal"),
             ("word", "Arguing and obscenity", "the sins of the tongue", "repentance"),
             ("tree", "The sanctuary\u2019s trees", "a rule of the place", "see a scholar")]
    colx = [110.0, 330.0, 550.0]
    rowy = [66.0, 196.0, 326.0]
    g1, g2, strikes, texts = [], [], [], []
    for i, (kind, lab, sub, cost) in enumerate(cells):
        x, y = colx[i % 3], rowy[i // 3]
        a, b = glyph(kind, x, y)
        g1.append(a)
        g2.append(b)
        strikes.append("M%.0f %.0fl56 -44" % (x - 28, y + 22))
        texts.append(T(x, y + 42, lab, "ht2"))
        texts.append(T(x, y + 61, sub, "hts"))
        texts.append(T(x, y + 82, cost, "hts htgold"))
    body = [P("hs1", *g1), P("hs2", *g2), P("hx", *strikes)]
    return fig("fproh", "A grid of nine drawn marks, each struck through, naming what is "
                        "forbidden while in ihram and what it costs.",
               660, 420, "".join(body + texts),
               "<b>Qur\u2019an 2:196, 5:95 and Bukhari, the narration of Ka\u2019b ibn Ujrah.</b> "
               "The gold word under each mark is "
               "its price. A fidyah is your choice of three: fast three days, feed six poor "
               "people, or slaughter a sheep, and it is owed without sin by anyone who broke the "
               "rule out of genuine need. Only one thing in this grid invalidates the Hajj "
               "itself, and one of them belongs to the sanctuary rather than to your ihram.",
               ["The standard summary is that the Hanafis and Malikis hold the expiation due "
                "even from one who forgot or did not know, though the Maliki position carries "
                "recognised exceptions that the summary flattens. The Shafi\u2019is and Hanbalis "
                "excuse the forgetful in several of these, provided he stops the moment he "
                "realises.",
                "Washing, unscented soap, a watch, glasses, a ring, a belt with a pocket, an "
                "umbrella and sandals that leave the ankle open all stay lawful throughout."])


def glyph(kind, x, y):
    """One abstract mark per prohibition, returned as two subpath strings, one
    gold and one white. Nothing figurative, and no faces anywhere."""
    if kind == "hair":
        return ("M%.0f %.0fc0 -20 8 -28 8 -40M%.0f %.0fc0 -20 8 -28 8 -40M%.0f %.0fc0 -20 8 -28 "
                "8 -40" % (x - 22, y + 16, x - 6, y + 16, x + 10, y + 16),
                "M%.0f %.0fh44" % (x - 24, y + 20))
    if kind == "scent":
        return (d_rect(x - 14, y - 12, 28, 34) + "M%.0f %.0fh12v-10h-12Z" % (x - 6, y - 12),
                "M%.0f %.0fc6 -8 -6 -14 0 -22M%.0f %.0fc6 -8 -6 -14 0 -22"
                % (x - 10, y - 26, x + 10, y - 26))
    if kind == "cloth":
        return ("M%.0f %.0fl14 -8h20l14 8l-8 12l-6 -4v30h-20v-30l-6 4Z" % (x - 24, y - 4), "")
    if kind == "veil":
        return ("M%.0f %.0fh34v30q-17 12 -34 0Z" % (x - 34, y - 14)
                + "M%.0f %.0fh14v22h-14Zm0 -4v-8h6v8" % (x + 10, y - 6),
                "M%.0f %.0fh18" % (x - 26, y - 2))
    if kind == "nikah":
        return (d_circ(x - 11, y, 16) + d_circ(x + 11, y, 16), "")
    if kind == "desire":
        return ("M%.0f %.0fc14 -14 14 -18 0 -32M%.0f %.0fc-14 -14 -14 -18 0 -32"
                % (x - 22, y + 16, x + 22, y + 16), "M%.0f %.0fv36" % (x, y - 18))
    if kind == "hunt":
        return (d_arr(x - 26, y + 14, x + 24, y - 18, 12),
                "M%.0f %.0fc-10 -12 -10 -24 0 -34" % (x - 26, y + 12))
    if kind == "word":
        return ("M%.0f %.0fh44v28h-26l-10 12v-12h-8Z" % (x - 22, y - 18),
                "M%.0f %.0fh18M%.0f %.0fh24" % (x - 12, y - 8, x - 12, y + 2))
    return ("M%.0f %.0fv-24M%.0f %.0fc-16 -6 -18 -26 0 -30c14 -14 28 0 22 10c10 6 4 22 -8 20Z"
            % (x, y + 18, x, y - 6), "")


# --- 5. tawaf ---------------------------------------------------------------

def fig_tawaf():
    cx, cy = 330.0, 220.0
    pts, steps = [], 7 * 48
    for i in range(steps + 1):
        t = i / float(steps) * 7 * 2 * math.pi
        r = 66 + (206 - 66) * (i / float(steps))
        pts.append((cx + r * math.cos(t), cy - r * 0.6 * math.sin(t)))
    spiral = "M%.1f %.1f" % pts[0] + "".join("L%.1f %.1f" % p for p in pts[1:])
    counts = [d_circ(240.0 + i * 30, 434, 11) for i in range(7)]
    texts = [T(330, 38, "tawaf", "htg"),
             T(330, 64, "anticlockwise, the House on your left", "hts"),
             T(430, 372, "al-Hajar al-Aswad, the Black Stone", "ht2 htgold"),
             T(430, 392, "every circuit starts and ends here", "hts"),
             T(330, 466, "seven, counted from the Stone", "hts")]
    for i in range(7):
        texts.append(T(240.0 + i * 30, 439, str(i + 1), "hts htgold"))
    body = [P("hs1 hspiral", spiral),
            P("hs1", d_cube(cx, cy, 44, 46), d_arr(348, 96, 312, 96, 11)),
            P("hf2", d_circ(352, 243, 7)),
            P("hs3", "M356 246L430 344"),
            P("hs2 hopen", *counts)]
    return fig("ftawaf", "Seven loops spiralling outward around a central cube, with the corner "
                         "of the Black Stone marked as the start and the finish of every circuit.",
               660, 480, "".join(body + texts),
               "<b>Qur\u2019an 22:29.</b> The spiral is drawn open so you can count the seven. In "
               "the mosque they lie on top of each other, which is exactly why pilgrims lose "
               "count. If you do, build on the smaller number you are certain of and complete it. "
               "Nothing in tawaf has fixed words except the takbir at the Stone and the verse "
               "said between the Yamani corner and the Black Stone.",
               ["Kiss the Stone if there is space. If not, face it, raise your right hand, say "
                "Allahu akbar, and keep walking. A sunnah never sits on top of harming someone.",
                "The Hijr, the low curved wall, is part of the House. Your circuit goes outside "
                "it, not through it.",
                "Ramal, the brisk short step in the first three circuits, and idtiba\u2019, the "
                "bared right shoulder, are for men only, and both drop away in a crowd."])


# --- 6. sa\u2019i ----------------------------------------------------------------

def fig_sai():
    ys = [104, 130, 156, 182, 208, 234, 260]
    go, back, texts = [], [], []
    for i, y in enumerate(ys):
        if i % 2 == 0:
            go.append(d_arr(172, y, 488, y, 11))
        else:
            back.append(d_arr(488, y, 172, y, 11))
        texts.append(T(158, y + 5, str(i + 1), "hts htgold", "end"))
    body = [P("hs1", *go, "M56 310Q110 232 164 310", "M496 310Q550 232 604 310"),
            P("hs2", *back, "M40 310H620"),
            P("hs3", d_gap(290, 94, 290, 272), d_gap(372, 94, 372, 272)),
            T(330, 44, "sa\u2019i", "htg"),
            T(330, 68, "seven traversals, not seven round trips", "hts"),
            T(330, 290, "between the green markers, men jog", "hts"),
            T(110, 334, "as-Safa", "ht2 htgold"), T(110, 354, "begin here", "hts"),
            T(550, 334, "al-Marwah", "ht2 htgold"), T(550, 354, "end here", "hts"),
            T(330, 344, "odd numbers go, even numbers return", "hts")]
    return fig("fsai", "Two hills with seven numbered arrows between them, the odd numbers "
                       "pointing from Safa to Marwah and the even numbers pointing back.",
               660, 380, "".join(body + texts),
               "<b>Qur\u2019an 2:158 and Muslim 1218.</b> Safa to Marwah is one. Marwah back to "
               "Safa is two. That is the commonest counting mistake in the whole Hajj, and it is "
               "why seven ends you at Marwah and not back where you started. He \ufdfa began at "
               "Safa and said: I begin with what Allah began with.",
               ["Sa\u2019i is the memory of a woman running: Hajar, alone with an infant in a "
                "valley with no water, going up one hill and then the other, seven times.",
                "Purity is not a condition of sa\u2019i, by the agreement of the four schools, "
                "though it must follow a valid tawaf.",
                "Maliki, Shafi\u2019i and Hanbali count sa\u2019i a pillar. The Hanafis count it "
                "an obligation repaired by a sacrifice."])


# --- 7. the journey map -----------------------------------------------------

def fig_map():
    segs = [((100, 300), (185, 196), (270, 220), (185, 228), "8", (185, 205), "to Mina"),
            ((270, 220), (430, 30), (590, 180), (430, 116), "9", (430, 90), "to Arafah"),
            ((590, 180), (520, 290), (430, 255), (515, 254), "9", (532, 288), "at sunset"),
            ((430, 255), (350, 330), (270, 220), (338, 284), "10", (330, 316), "at dawn"),
            ((100, 300), (185, 340), (270, 220), (185, 300), "10", (185, 334), "tawaf al-ifadah"),
            ((100, 300), (185, 485), (270, 220), (185, 372), "12", (185, 406), "the farewell")]
    roads = ["M%.0f %.0fQ%.0f %.0f %.0f %.0f" % (p0[0], p0[1], c[0], c[1], p1[0], p1[1])
             for (p0, c, p1, _, _, _, _) in segs]
    discs = [d_circ(d[0], d[1], 15) for (_, _, _, d, _, _, _) in segs]
    texts = []
    for (_, _, _, dp, num, lp, lab) in segs:
        texts.append(T(dp[0], dp[1] + 5.2, num, "htn htgold"))
        texts.append(T(lp[0], lp[1], lab, "hts"))
    texts += [T(330, 36, "the road of the five days", "hts"),
              T(80, 350, "Makkah", "ht1"), T(270, 190, "Mina", "ht1"),
              T(430, 300, "Muzdalifah", "ht1"), T(590, 212, "Arafah", "ht1 htgold"),
              T(590, 232, "the standing", "hts")]
    body = [P("hs1 hroad", *roads),
            P("hs2", "M540 180H640", "M390 255H470"),
            P("hs1", "M556 180q34 -26 68 0",
              "M244 232l16 -24l16 24Zm32 0l16 -24l16 24Z", d_cube(100, 300, 32, 36)),
            P("hf2", d_circ(406, 246, 3.5), d_circ(430, 249, 3.5), d_circ(454, 245, 3.5)),
            P("hf1 hring", *discs)]
    return fig("fmap", "A map of the pilgrimage: Makkah out to Mina, on to Arafah, back through "
                       "Muzdalifah to Mina, down to Makkah and back, and home, with each leg "
                       "numbered by its day.",
               660, 460, "".join(body + texts),
               "<b>The single most useful picture in this room.</b> Four places, six legs, six "
               "dates. Learn this shape before you fly and the days stop being a blur of buses. "
               "Everything on this map can be repaired with a sacrifice or performed late, except "
               "the leg to Arafah on the ninth. Miss that one and there is no Hajj this year.",
               ["<b>8 Dhul Hijjah.</b> Ihram again for tamattu\u2019, out to Mina, five prayers "
                "there, shortened and not joined.",
                "<b>9 Dhul Hijjah.</b> To Arafah after sunrise. Zuhr and Asr joined. Stand until "
                "sunset. Then to Muzdalifah, where Maghrib and Isha are prayed on arrival.",
                "<b>10 Dhul Hijjah.</b> Back to Mina at dawn: seven pebbles at the large pillar, "
                "the sacrifice, the hair, then down to the House for tawaf al-ifadah.",
                "<b>11, 12 and 13.</b> At Mina, stoning all three pillars each afternoon. Leave "
                "after the twelfth if you hurry, then the farewell tawaf, and home."])


# --- 8. the timeline ribbon -------------------------------------------------

def fig_ribbon():
    days = [("8", "Tarwiyah", ["ihram again", "out to Mina", "five prayers"]),
            ("9", "Arafah", ["to Arafah", "until sunset", "Muzdalifah", "sleep there"]),
            ("10", "Nahr", ["stone the large", "the sacrifice", "shave or shorten",
                            "tawaf al-ifadah"]),
            ("11", "Tashriq", ["all three", "stay at Mina", "the takbir"]),
            ("12", "Tashriq", ["all three", "leave, or stay"]),
            ("13", "Tashriq", ["all three", "the farewell"])]
    rings, stems, texts, gold = [], [], [], ""
    for i, (n, name, acts) in enumerate(days):
        x = 55.0 + i * 106
        if n == "9":
            gold = d_circ(x, 150, 21)
        else:
            rings.append(d_circ(x, 150, 21))
        stems.append(d_gap(x, 174, x, 192, 3))
        texts.append(T(x, 157, n, "ht1 htgold"))
        texts.append(T(x, 110, name, "hts"))
        for k, a in enumerate(acts):
            texts.append(T(x, 208 + k * 19, a, "hts"))
    body = [P("hs3", "M38 150H626", *stems),
            P("hf1 hring", *rings),
            P("hf1 hring hgold", gold),
            P("hs1", "M118 286H204"),
            T(161, 308, "the one that cannot be missed", "hts htgold"),
            T(330, 356, "after the twelfth you may leave Mina, or stay for the thirteenth", "hts")]
    return fig("frib", "A ribbon of six days from the eighth to the thirteenth of Dhul Hijjah, "
                       "each day a disc on the line with its acts listed underneath.",
               660, 390, "".join(body + texts),
               "<b>Qur\u2019an 2:203.</b> Whoever hurries in two days, there is no sin upon him, "
               "and whoever delays, there is no sin upon him. The verse says it twice, in both "
               "directions, so neither choice is a compromise. What is not optional is the ninth: "
               "the Prophet \ufdfa said al-Hajju Arafah, Hajj is Arafah.")


# --- 9. the jamarat ---------------------------------------------------------

def fig_jam():
    names = [(150.0, "as-Sughra", "the small", "1"), (330.0, "al-Wusta", "the middle", "2"),
             (510.0, "al-Aqabah", "the large", "3")]
    peb, pillars, ridges, texts = [], [], [], []
    for x, name, gloss, order in names:
        for i in range(7):
            peb.append(d_circ(x - 60 + i * 20, 118, 5))
        pillars.append(d_rect(x - 22, 140, 44, 140))
        ridges.append("M%.0f 168h44M%.0f 208h44M%.0f 248h44" % (x - 22, x - 22, x - 22))
        texts.append(T(x, 216, order, "ht1 htgold"))
        texts.append(T(x, 306, name, "ht2 htgold"))
        texts.append(T(x, 326, gloss, "hts"))
    body = [P("hf2", *peb), P("hs1", *pillars), P("hs3", *ridges),
            P("hs2", d_arr(196, 292, 284, 292, 9), d_arr(376, 292, 464, 292, 9)),
            T(330, 44, "the Jamarat", "htg"),
            T(330, 68, "three pillars, seven pebbles at each", "hts"),
            T(330, 92, "one at a time, saying Allahu akbar with every throw", "hts"),
            T(240, 350, "on 11, 12 and 13, all three in order", "hts"),
            T(510, 350, "on the 10th, this one alone", "hts htgold"),
            T(330, 380, "stand and make du\u2019a after the first two, and not after the third",
              "hts")]
    return fig("fjam", "Three pillars, numbered one to three in the order they are stoned, each "
                       "with a row of seven pebbles above it.",
               660, 400, "".join(body + texts),
               "<b>Bukhari, the narrations of Ibn Umar on the stoning of the three pillars.</b> "
               "There is no devil standing at these pillars. The "
               "throwing is obedience and remembrance, which is why he \ufdfa held up pebbles the "
               "size of beans and said: with the like of these, throw, and warned in the same "
               "breath against exaggeration in religion. After the first pillar and after the "
               "second he stood a long time facing the qiblah with his hands raised. After the "
               "third he did not stop.")


# --- 10. the three ranks ----------------------------------------------------

def fig_scale():
    rows = [("rukn, a pillar", "leave it and there is no Hajj", 60, "hband1"),
            ("wajib, an obligation", "a sacrifice repairs it", 140, "hband2"),
            ("sunnah", "better, and nothing is owed", 220, "hband3")]
    body = [T(330, 36, "what a missing act costs you", "hts")]
    for lab, cost, y, cls in rows:
        body.append(P(cls, d_rect(60, y, 540, 60)))
        body.append(T(84, y + 36, lab, "ht1 htgold", "start"))
        body.append(T(576, y + 36, cost, "ht2", "end"))
    body.append(T(330, 312, "the schools do not all put the same act in the same band", "hts"))
    return fig("fscale", "Three stacked bands: pillar, obligation and sunnah, each with the cost "
                         "of leaving it written on the right.",
               660, 340, "".join(body),
               "<b>The whole law of repair, in three lines.</b> A dam is a sacrifice, a sheep or "
               "a goat or a seventh of a camel, slaughtered inside the sanctuary and given to its "
               "poor. It is not a fine and nobody profits from it. Only one act in the entire "
               "Hajj sits in the top band with no way back at all, and that is the standing at "
               "Arafah.")


# --- 11. the return ---------------------------------------------------------

def fig_return():
    body = [P("hs3", "M60 210H600", "M330 134V112"),
            P("hs1", "M90 210Q330 60 570 210"),
            P("hf2", d_circ(90, 210, 9)),
            P("hs1 hopen", d_circ(570, 210, 14)),
            P("hs2", d_rect(290, 176, 44, 26), "M290 185h44",
              d_rect(346, 176, 44, 26), "M346 185h44"),
            T(330, 96, "the standing at Arafah", "ht2 htgold"),
            T(330, 166, "the two white cloths", "hts"),
            T(100, 246, "you arrive", "ht2"), T(100, 266, "carrying everything", "hts"),
            T(570, 246, "you return", "ht2"), T(570, 266, "carrying none of it", "hts")]
    return fig("fret", "A single arc rising from a filled point to a peak and descending to an "
                       "empty circle, with a folded cloth drawn at each end.",
               660, 300, "".join(body),
               "<b>Bukhari 1521.</b> Whoever performs Hajj for Allah and does not speak obscenely "
               "nor act corruptly returns as the day his mother bore him. The two unstitched "
               "sheets are worn once by choice and once more by everybody, and in them there is "
               "no way to tell a surgeon from a driver. The circle at the end of the arc is drawn "
               "empty on purpose: a newborn has no history, which is the gift, and also the "
               "problem, because a clean page has to be written on.")


FIGS = {
    "call": fig_call, "ways": fig_ways, "miqat": fig_miqat, "prohibitions": fig_proh,
    "tawaf": fig_tawaf, "sai": fig_sai, "map": fig_map, "timeline": fig_ribbon,
    "jamarat": fig_jam, "scale": fig_scale, "return": fig_return,
}


# ---------------------------------------------------------------------------
# blocks
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


def schools_html(rows):
    if not rows:
        return ""
    items = "".join('<div class="sch"><p class="sn">%s</p><p class="sp">%s</p></div>'
                    % (esc(a), esc(b)) for a, b in rows)
    return ('<div class="schools"><p class="sk">Where the schools part</p>%s</div>' % items)


def rank_chip(rank):
    if not rank:
        return ""
    label, cls, hint = RANKS.get(rank, (rank, "rk-s", ""))
    return '<span class="rk %s" title="%s">%s</span>' % (cls, esc(hint), esc(label))


def talbiyah_html(t, kind="talb"):
    return ('<div class="tal %s"><p class="ar notranslate" translate="no" dir="rtl" '
            'lang="ar">%s</p><p class="trl">%s</p><p class="mean">%s</p></div>'
            % (kind, esc(t["ar"]), esc(t["tr"]), esc(t["en"])))


def card_html(c):
    label, hint = LEVELS.get(c.get("level", "editorial"), LEVELS["editorial"])
    ps = "".join("<p>%s</p>" % esc(p) for p in c.get("ps", []))
    extra = ""
    if c.get("talbiyah"):
        extra += talbiyah_html(c["talbiyah"])
    if c.get("dua"):
        extra += talbiyah_html(c["dua"], "dua")
    cls = "card mo" + (" pillarcard" if c.get("pillar") else "")
    flag = ('<p class="pflag">Pillar. Leave this out and there is no Hajj at all, and no '
            'sacrifice replaces it.</p>') if c.get("pillar") else ""
    return ('<article class="%s">'
            '<div class="ch"><h3>%s</h3><div class="chb">%s<span class="evb %s mo-pop" '
            'title="%s">%s</span></div></div>%s%s%s%s%s</article>'
            % (cls, esc(c.get("t", "")), rank_chip(c.get("rank")), esc(c.get("level", "editorial")),
               esc(hint), esc(label), flag, ps, extra, schools_html(c.get("schools")),
               refs_html(c.get("refs"))))


def day_html(d):
    cards = "".join(card_html(c) for c in d.get("cards", []))
    return ('<div class="day mo" id="day-%s">'
            '<div class="dh"><div class="dn">%s</div>'
            '<div class="dt"><p class="dar notranslate" translate="no" dir="rtl" lang="ar">%s</p>'
            '<h3>%s</h3><p class="dg">%s</p><p class="dw">%s</p></div></div>'
            '<p class="dl">%s</p>%s</div>'
            % (esc(d["n"].split()[0]), esc(d["n"]), esc(d["ar"]), esc(d["name"]), esc(d["en"]),
               esc(d["where"]), esc(d["lead"]), cards))


def counts_html(c):
    rows = "".join(
        '<tr><th scope="row">%s</th><td data-l="The pillars">%s</td>'
        '<td data-l="Everything else">%s</td></tr>' % (esc(a), esc(b), esc(d))
        for a, b, d in c["rows"])
    return ('<div class="tw mo"><p class="tcap">%s</p>'
            '<table class="tbl tbl3"><caption class="vh">%s</caption><thead><tr>'
            '<th scope="col">School</th><th scope="col">The pillars</th>'
            '<th scope="col">Everything else</th></tr></thead><tbody>%s</tbody></table>'
            '<p class="tnote">%s</p></div>'
            % (esc(c["cap"]), esc(c["cap"]), rows, esc(c["note"])))


def table_html(t):
    out = []
    for g in t["groups"]:
        rows = "".join(
            '<tr><th scope="row">%s</th><td data-l="%s">%s</td><td data-l="%s">%s</td></tr>'
            % (esc(r[0]), esc(t["cols"][1]), esc(r[1]), esc(t["cols"][2]), esc(r[2]))
            for r in g["rows"])
        out.append('<tbody><tr class="grp"><th colspan="3" scope="colgroup">%s</th></tr>%s</tbody>'
                   % (esc(g["name"]), rows))
    head = "".join('<th scope="col">%s</th>' % esc(c) for c in t["cols"])
    return ('<div class="tw mo"><p class="tcap">%s</p>'
            '<table class="tbl"><caption class="vh">%s</caption>'
            '<thead><tr>%s</tr></thead>%s</table></div>'
            % (esc(t["cap"]), esc(t["cap"]), head, "".join(out)))


def checklist_html(cl):
    total = sum(len(g["items"]) for g in cl["groups"])
    groups = []
    for gi, g in enumerate(cl["groups"]):
        items = "".join(
            '<li><label class="ckl"><input type="checkbox" data-k="%d:%d"/>'
            '<span class="bx" aria-hidden="true"></span><span class="tx">%s</span></label></li>'
            % (gi, i, esc(line)) for i, line in enumerate(g["items"]))
        groups.append('<div class="ckg"><p class="ckh">%s</p><ul class="cklist">%s</ul></div>'
                      % (esc(g["g"]), items))
    return ('<div class="check mo" id="check">'
            '<div class="ck-top"><p class="ck-k">Before you go</p>'
            '<p class="ck-c"><span id="ck-count">0</span> of %d done</p></div>'
            '<p class="ck-l">Ticked boxes are kept in this browser only, on this device, and are '
            'never sent anywhere. Nothing here is counted against you.</p>%s'
            '<button type="button" class="ck-reset" id="ck-reset">Clear the whole list</button>'
            "</div>" % (total, "".join(groups)))


def section_html(s):
    cards = "".join(card_html(c) for c in s.get("cards", []))
    days = "".join(day_html(d) for d in s.get("days", []))
    extra = ""
    if s.get("counts"):
        extra += counts_html(s["counts"])
    if s.get("table"):
        extra += table_html(s["table"])
    if s.get("checklist"):
        extra += checklist_html(s["checklist"])
    fig1 = FIGS[s["fig"]]() if s.get("fig") else ""
    fig2 = FIGS[s["fig2"]]() if s.get("fig2") else ""
    fig3 = FIGS[s["fig3"]]() if s.get("fig3") else ""
    return ('<section class="rsec" id="%s">'
            '<div class="sh"><span class="ar notranslate" translate="no" dir="rtl" lang="ar">%s'
            '</span><h2>%s</h2></div>'
            '<p class="tr">%s</p><p class="sub">%s</p>%s%s%s%s%s%s</section>'
            % (esc(s["id"]), esc(s["ar"]), esc(s["title"]), esc(s["gloss"]), esc(s["lead"]),
               fig1, cards, fig2, days, fig3, extra))


def frame_html(f):
    keys = "".join('<div><span class="evb %s">%s</span><span>%s</span></div>'
                   % (k, esc(a), esc(b)) for k, a, b in f["keys"])
    ps = "".join("<p>%s</p>" % esc(p) for p in f["ps"])
    return ('<article class="card open mo"><p class="kk">%s</p><h3>%s</h3>%s'
            '<div class="keys">%s</div></article>'
            % (esc(f["kk"]), esc(f["title"]), ps, keys))


CSS = """
html{scroll-behavior:auto}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
.secnav{position:sticky;top:3.5rem;z-index:30;background:rgba(255,254,247,.94);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid rgba(44,36,22,.08)}
.secnav-in{position:relative;display:flex;gap:.38rem;align-items:center;max-width:62rem;margin:0 auto;padding:.5rem 1rem;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}
.secnav-in::-webkit-scrollbar{display:none}
.secnav a{flex:0 0 auto;font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(44,36,22,.55);text-decoration:none;border:1px solid rgba(44,36,22,.13);border-radius:999px;padding:.3rem .68rem;background:#fff;transition:color .2s,border-color .2s,background .2s,box-shadow .2s;white-space:nowrap}
.secnav a:hover{color:#2C2416;border-color:rgba(201,162,39,.5)}
.secnav a.on{color:#1A160F;background:linear-gradient(135deg,#C9A227,#E9C86A);border-color:transparent;box-shadow:0 2px 12px rgba(201,162,39,.3)}
.open{margin-top:1.7rem;border-color:rgba(201,162,39,.34);box-shadow:0 8px 30px rgba(44,36,22,.07)}
.open .kk{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .5rem}
.open h3{font-size:1.06rem;margin:0 0 .6rem}
.keys{display:grid;grid-template-columns:1fr 1fr;gap:.5rem .9rem;margin-top:.95rem;padding-top:.9rem;border-top:1px solid rgba(44,36,22,.1)}
.keys div{display:flex;align-items:center;gap:.45rem;font-size:.71rem;color:rgba(44,36,22,.55);line-height:1.5}
.keys .evb{flex:0 0 auto}
@media (max-width:560px){.keys{grid-template-columns:1fr}}
.rsec{scroll-margin-top:6.6rem}
.rsec .sh{gap:.7rem}
.rsec .sh .ar{font-size:1.5rem;line-height:1.25}
.tr{font-size:.73rem;color:rgba(44,36,22,.48);margin:.3rem 0 0;letter-spacing:.02em}
.ch{display:flex;align-items:flex-start;justify-content:space-between;gap:.7rem;margin-bottom:.5rem}
.ch h3{margin:0}
.chb{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.32rem;flex:0 0 auto;margin-top:.1rem}
.rk{display:inline-block;font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;font-weight:800;border-radius:999px;padding:.24rem .5rem;border:1px solid;white-space:nowrap}
.rk-p{color:#8f2d2d;border-color:rgba(143,45,45,.42);background:rgba(143,45,45,.09)}
.rk-o{color:#8a6d13;border-color:rgba(201,162,39,.5);background:rgba(201,162,39,.13)}
.rk-s{color:rgba(44,36,22,.55);border-color:rgba(44,36,22,.22);background:rgba(44,36,22,.04)}
.rk-c{color:#1d6b3f;border-color:rgba(29,107,63,.42);background:rgba(29,107,63,.1)}
.pillarcard{border-color:rgba(143,45,45,.34);box-shadow:0 6px 24px rgba(143,45,45,.08)}
.pflag{font-size:.75rem;font-weight:700;line-height:1.65;color:#8f2d2d;background:rgba(143,45,45,.07);border:1px solid rgba(143,45,45,.22);border-radius:12px;padding:.55rem .7rem;margin:0 0 .7rem}
.ref{display:inline-flex;align-items:center;gap:.35rem;line-height:1.4}
.ref .rn{font-weight:600;color:rgba(44,36,22,.5)}
.ref.q{background:rgba(201,162,39,.09);border-color:rgba(201,162,39,.26);padding-inline-start:.28rem}
.vplay{transition:background .18s,color .18s}
.vplay:hover{background:rgba(244,212,106,.3)}
.schools{margin:.85rem 0 0;border-top:1px dashed rgba(107,79,146,.35);padding-top:.7rem}
.sk{font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:#6b4f92;margin:0 0 .45rem}
.sch{display:grid;grid-template-columns:8.4rem 1fr;gap:.3rem .8rem;padding:.3rem 0}
.sch+.sch{border-top:1px solid rgba(44,36,22,.06)}
.sn{font-size:.76rem;font-weight:800;color:#6b4f92;margin:0;line-height:1.55}
.sp{font-size:.79rem;color:rgba(44,36,22,.74);margin:0;line-height:1.72}
@media (max-width:560px){.sch{grid-template-columns:1fr;gap:.1rem}}
.tal{margin:.75rem 0;background:linear-gradient(168deg,#FFFCEF,#FFF6DB);border:1px solid rgba(201,162,39,.32);border-radius:16px;padding:.95rem 1rem}
.tal .ar{font-family:Amiri,serif;font-size:1.35rem;line-height:2.15;color:#2C2416;margin:0;text-align:center}
.tal .trl{font-size:.78rem;font-style:italic;color:rgba(44,36,22,.6);margin:.5rem 0 0;line-height:1.7;text-align:center}
.tal .mean{font-size:.83rem;color:rgba(44,36,22,.82);margin:.45rem 0 0;line-height:1.75;text-align:center}
.day{margin-top:1.4rem;border-inline-start:2px solid rgba(201,162,39,.4);padding-inline-start:.95rem}
.dh{display:flex;align-items:flex-start;gap:.85rem}
.dn{flex:0 0 auto;font-size:1.5rem;font-weight:800;color:#8a6d13;line-height:1.05;letter-spacing:-.02em;min-width:2.4rem}
.dar{font-family:Amiri,serif;font-size:1.15rem;color:var(--gold);margin:0;line-height:1.5}
.dt h3{font-size:1.02rem;font-weight:800;margin:.1rem 0 0}
.dg{font-size:.73rem;color:rgba(44,36,22,.5);margin:.15rem 0 0}
.dw{font-size:.63rem;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:.35rem 0 0}
.dl{font-size:.83rem;line-height:1.8;color:rgba(44,36,22,.66);margin:.6rem 0 0}
.day .card{margin-top:.75rem}
.tw{margin-top:1.1rem}
.tcap{font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .5rem}
.tnote{font-size:.78rem;line-height:1.75;color:rgba(44,36,22,.6);margin:.7rem 0 0}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.tbl{width:100%;border-collapse:collapse;background:#fff;border:1px solid rgba(44,36,22,.12);border-radius:16px;overflow:hidden}
.tbl th,.tbl td{text-align:start;vertical-align:top;padding:.62rem .7rem;font-size:.79rem;line-height:1.7}
.tbl thead th{font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:#8a6d13;background:rgba(201,162,39,.1);border-bottom:1px solid rgba(201,162,39,.25)}
.tbl tbody th{font-weight:800;color:#2C2416;width:34%}
.tbl td{color:rgba(44,36,22,.76)}
.tbl tbody tr+tr{border-top:1px solid rgba(44,36,22,.08)}
.tbl .grp th{font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;color:#8a6d13;background:rgba(201,162,39,.07);width:auto}
.tbl3 tbody th{width:22%}
@media (max-width:640px){
.tbl,.tbl thead,.tbl tbody,.tbl tr,.tbl th,.tbl td{display:block}
.tbl thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.tbl tbody th{width:auto;padding-bottom:.2rem}
.tbl tbody tr{padding:.55rem 0}
.tbl td{padding-top:.15rem;padding-bottom:.15rem}
.tbl td::before{content:attr(data-l);display:block;font-size:.55rem;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin-bottom:.1rem}
.tbl .grp th{margin-top:.2rem}
}
.check{margin-top:1.1rem;border-radius:18px;padding:1.05rem 1.15rem 1.15rem;background:linear-gradient(168deg,#FFFCEF,#FFF6DB);border:1px solid rgba(201,162,39,.3)}
.ck-top{display:flex;align-items:baseline;justify-content:space-between;gap:.7rem}
.ck-k{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0}
.ck-c{font-size:.65rem;color:rgba(44,36,22,.45);margin:0;font-weight:700;white-space:nowrap}
.ck-l{font-size:.78rem;color:rgba(44,36,22,.6);line-height:1.75;margin:.4rem 0 .8rem}
.ckg+.ckg{margin-top:.75rem;padding-top:.7rem;border-top:1px solid rgba(201,162,39,.24)}
.ckh{font-size:.7rem;font-weight:800;letter-spacing:.03em;color:#8a6d13;margin:0 0 .2rem}
.cklist{list-style:none;margin:0;padding:0}
.ckl{position:relative;display:flex;gap:.62rem;align-items:flex-start;padding:.4rem .3rem;border-radius:12px;cursor:pointer;transition:background .18s}
.ckl:hover{background:rgba(201,162,39,.09)}
.ckl input{position:absolute;opacity:0;width:0;height:0}
.bx{flex:0 0 auto;width:1.08rem;height:1.08rem;margin-top:.16rem;border-radius:7px;border:1.5px solid rgba(201,162,39,.55);background:#fff;position:relative;transition:background .2s,border-color .2s}
.bx::after{content:"";position:absolute;inset-inline-start:.33rem;top:.13rem;width:.26rem;height:.52rem;border:solid #1A160F;border-width:0 2px 2px 0;transform:rotate(42deg) scale(.35);opacity:0;transition:opacity .2s,transform .2s}
.ckl input:checked+.bx{background:linear-gradient(135deg,#C9A227,#E9C86A);border-color:transparent}
.ckl input:checked+.bx::after{opacity:1;transform:rotate(42deg) scale(1)}
.ckl input:focus-visible+.bx{outline:2px solid #8a6d13;outline-offset:2px}
.ckl .tx{font-size:.82rem;line-height:1.72;color:rgba(44,36,22,.82)}
.ckl input:checked~.tx{color:rgba(44,36,22,.42)}
.ck-reset{margin-top:.7rem;background:none;border:0;font:inherit;font-size:.67rem;font-weight:700;color:rgba(44,36,22,.4);cursor:pointer;text-decoration:underline;padding:.25rem .35rem}
.ck-reset:hover{color:rgba(44,36,22,.65)}
.fig svg{width:100%;max-width:38rem;height:auto;display:block;margin:0 auto}
.hsvg text{font-family:Inter,system-ui,sans-serif;text-anchor:middle}
.hsvg text.ta-s{text-anchor:start}
.hsvg text.ta-e{text-anchor:end}
.htg{fill:#F4D46A;font-size:20px;font-weight:800;letter-spacing:.02em}
.ht1{fill:#FFFEF7;font-size:18px;font-weight:800}
.ht2{fill:#FFFEF7;fill-opacity:.86;font-size:15px;font-weight:600}
.hts{fill:#FFFEF7;fill-opacity:.56;font-size:13.5px;font-weight:500}
.htn{fill:#F4D46A;font-size:15px;font-weight:800}
.htgold{fill:#F4D46A;fill-opacity:.95}
.hs1{fill:none;stroke:#E9C86A;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.hs2{fill:none;stroke:#FFFEF7;stroke-opacity:.6;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.hs3{fill:none;stroke:#F4D46A;stroke-opacity:.32;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.hx{fill:none;stroke:#E28A80;stroke-opacity:.9;stroke-width:2.6;stroke-linecap:round}
.hf1{fill:rgba(244,212,106,.16)}
.hf2{fill:#F4D46A;stroke:none}
.hring{stroke:#E9C86A;stroke-width:2;fill:rgba(244,212,106,.14)}
.hgold{stroke-width:3.4}
.hopen{fill:rgba(20,16,10,.6)}
.hband{stroke-width:9;stroke-linecap:round}
.hroad{stroke-width:3}
.hspiral{stroke-width:2.2;stroke-opacity:.92}
.hband1{fill:rgba(143,45,45,.24);stroke:rgba(226,138,128,.7);stroke-width:2}
.hband2{fill:rgba(244,212,106,.16);stroke:rgba(233,200,106,.65);stroke-width:2}
.hband3{fill:rgba(255,254,247,.07);stroke:rgba(255,254,247,.3);stroke-width:2}
.leg{list-style:none;margin:1rem 0 0;padding:0;display:grid;gap:.45rem}
.leg li{position:relative;padding-inline-start:1rem;font-size:.75rem;line-height:1.72;color:rgba(255,254,247,.68)}
.leg li::before{content:"";position:absolute;inset-inline-start:0;top:.62rem;width:.36rem;height:.36rem;border-radius:50%;background:#E9C86A}
.leg li b{color:rgba(244,212,106,.9);font-weight:800}
.fig .cap b{color:rgba(244,212,106,.85);font-weight:700}
.band{margin:3rem 0 .5rem;text-align:center;background:linear-gradient(170deg,#FFFDF3,#FFF6DB);border:1px solid rgba(201,162,39,.26);border-radius:20px;padding:1.6rem 1.2rem}
.band p{font-size:.82rem;color:rgba(44,36,22,.62);line-height:1.85;margin:0 auto .95rem;max-width:32rem}
.band .bl{display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap}
.door{display:flex;gap:1rem;align-items:flex-start;margin-top:1.5rem;text-decoration:none;color:inherit;
  background:linear-gradient(168deg,#FFFCEF,#FFF4D2);border:1px solid rgba(201,162,39,.5);border-radius:22px;
  padding:1.15rem 1.2rem 1.25rem;box-shadow:0 10px 34px rgba(201,162,39,.14);position:relative;overflow:hidden;
  transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.door::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 90% at 88% 8%,rgba(244,212,106,.3),transparent 62%);pointer-events:none}
.door:hover,.door:focus-visible{transform:translateY(-2px);border-color:#C9A227;box-shadow:0 16px 44px rgba(201,162,39,.24)}
.door .dm{flex:0 0 auto;width:5.4rem;height:5.4rem;position:relative;z-index:2}
.door .dm svg{width:100%;height:100%;display:block}
.door .dt{min-width:0;position:relative;z-index:2}
.door .dk,.door .dh,.door .dd{display:block}
.door .dk{font-size:.58rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0}
.door .dh{font-size:1.18rem;font-weight:800;letter-spacing:-.015em;line-height:1.28;margin:.28rem 0 0;color:#2C2416}
.door .dh .dar{font-family:Amiri,serif;font-weight:400;color:#8a6d13;font-size:1.05rem;margin-inline-start:.45rem}
.door .dd{font-size:.83rem;line-height:1.8;color:rgba(44,36,22,.72);margin:.45rem 0 0;max-width:34rem}
.door .dgo{display:inline-block;margin-top:.85rem;background:linear-gradient(135deg,#C9A227,#E9C86A);color:#1A160F;
  font-weight:800;border-radius:999px;padding:.55rem 1.1rem;font-size:.78rem}
.door .dfree{display:block;font-size:.7rem;color:rgba(44,36,22,.5);margin:.55rem 0 0;line-height:1.6}
@media(max-width:34rem){.door{flex-direction:column;gap:.5rem}.door .dm{width:4.4rem;height:4.4rem}}
.bdoor{margin-top:1.3rem;padding-top:1.25rem;border-top:1px solid rgba(201,162,39,.3)}
.bdoor .bdk{font-size:.58rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .3rem}
.bdoor .bdh{font-size:1.06rem;font-weight:800;color:#2C2416;margin:0;line-height:1.35}
.bdoor .bdd{font-size:.81rem;line-height:1.8;color:rgba(44,36,22,.66);margin:.4rem auto .9rem;max-width:30rem}
"""

JS = """<script>
(function(){
"use strict";
/* the list before you go, kept in one small drawer on this device only */
var KEY="noor_hajj_v1", state={};
try{state=JSON.parse(localStorage.getItem(KEY)||"{}")||{};}catch(e){state={};}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}
var boxes=[].slice.call(document.querySelectorAll(".cklist input[type=checkbox]"));
var out=document.getElementById("ck-count");
function tally(){
  var n=0;
  boxes.forEach(function(b){if(b.checked)n++;});
  if(out)out.textContent=n;
}
boxes.forEach(function(b){
  var k=b.getAttribute("data-k");
  if(state[k])b.checked=true;
  b.addEventListener("change",function(){
    if(b.checked){state[k]=1;}else{delete state[k];}
    save(); tally();
  });
});
var rst=document.getElementById("ck-reset");
if(rst)rst.addEventListener("click",function(){
  boxes.forEach(function(b){b.checked=false;delete state[b.getAttribute("data-k")];});
  save(); tally();
});
tally();
/* verse audio through the shared Mushaf voice */
document.querySelectorAll(".vplay").forEach(function(b){
  b.addEventListener("click",function(){if(window.playAyah)window.playAyah(b.getAttribute("data-ref"),b);});
});
/* the rail follows the section you are reading */
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

JSONLD = """<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article","headline":"Hajj and Umrah, made simple",
"description":"A first timer's guide to Hajj and Umrah: the three ways, ihram and the miqats, tawaf and sa'i, the days of Hajj from 8 to 13 Dhul Hijjah, the pillars and obligations of the four schools, and what to do when something goes wrong.",
"inLanguage":"en","isAccessibleForFree":true,
"about":["Hajj","Umrah","Ihram","Tawaf","Arafah","Islamic pilgrimage"],
"publisher":{"@type":"Organization","name":"NOOR Codex of Light","url":"https://noorcodex.com"},
"mainEntityOfPage":{"@type":"WebPage","@id":"https://noorcodex.com/hajj.html"}}
</script>"""



# ---------------------------------------------------------------------------
# the door to the planner
# ---------------------------------------------------------------------------
# The room explains. The planner turns the explanation into one pilgrim's own
# days, dates, packing list and pocket card. It is the same content, resolved
# from the same file, so the two can never say different things.

def door_mark():
    """A small compass of gates with the House at its centre, drawn on scroll."""
    import math as _m
    ring = d_circ(46, 46, 34)
    tri, arr = [], []
    for deg in (-90, 0, 90, 180):
        t = _m.radians(deg)
        gx, gy = 46 + 34 * _m.cos(t), 46 + 34 * _m.sin(t)
        tri.append("M%.1f %.1fl-6 -7h12Z" % (gx, gy + 3))
    t = _m.radians(-138)
    sx, sy = 46 + 44 * _m.cos(t), 46 + 44 * _m.sin(t)
    arr.append(d_arr(sx, sy, 46 + 20 * _m.cos(t), 46 + 20 * _m.sin(t), 7))
    return ('<span class="dm mo-draw" aria-hidden="true">'
            '<svg viewBox="0 0 92 92" role="presentation" focusable="false">'
            '<path class="dr1" d="%s"/><path class="dr2" d="%s"/>'
            '<path class="dr3" d="%s"/><path class="dr2" d="%s"/>'
            '</svg></span>'
            % (ring, "".join(tri), "".join(arr), d_cube(46, 46, 22, 25)))


DOOR_CSS = ("<style>.dr1{fill:none;stroke:#C9A227;stroke-opacity:.45;stroke-width:2;"
            "stroke-linecap:round}"
            ".dr2{fill:none;stroke:#8a6d13;stroke-width:2.4;stroke-linecap:round;"
            "stroke-linejoin:round}"
            ".dr3{fill:none;stroke:#C9A227;stroke-width:2.2;stroke-linecap:round;"
            "stroke-linejoin:round}</style>")


def door_html():
    return (DOOR_CSS +
            '<a class="door mo" href="hajj-plan.html">' + door_mark() +
            '<span class="dt">'
            '<span class="dk">A tool of this room</span>'
            '<span class="dh">The Pilgrim’s Planner'
            '<span class="dar notranslate" translate="no" dir="rtl" lang="ar">'
            'خُطَّة الحَاجّ</span></span>'
            '<span class="dd">Answer six or seven quiet questions and this room writes you your '
            'own plan: your days in order with your own dates, every rite in short steps with its '
            'du’a and its rank, a packing list built from your answers, what to settle before '
            'you fly, and a one page pocket card to print, fold and carry.</span>'
            '<span class="dgo">Make my plan ✦</span>'
            '<span class="dfree">Free, with no account and nothing sent anywhere. Once it has '
            'loaded it works with no connection, which matters in Makkah.</span>'
            '</span></a>')


def band_door():
    return ('<div class="bdoor">'
            '<p class="bdk">Before you go</p>'
            '<p class="bdh">Turn this room into your own plan</p>'
            '<p class="bdd">Your days in order, every rite in steps, a packing list from your own '
            'answers, and a pocket card to print, fold and carry. Same rulings, same ranks, same '
            'evidence, read from the same file as this page.</p>'
            '<div class="bl"><a class="gpill" href="hajj-plan.html">Open the Pilgrim’s '
            'Planner ✦</a></div></div>')


def build():
    data = json.load(open(SRC, encoding="utf-8"))
    meta, sections = data["meta"], data["sections"]

    chips = "".join('<a href="#%s">%s</a>' % (esc(s["id"]), esc(s["nav"])) for s in sections)
    nav = ('<nav class="secnav" id="secnav" aria-label="The eleven parts of this room">'
           '<div class="secnav-in">%s</div></nav>' % chips)

    body = "".join(section_html(s) for s in sections)

    band = ('<section class="band mo">'
            "<p>This room is corrected as pilgrims and scholars read it and write back. If you "
            "find a ruling stated too confidently, a narration numbered wrongly, or a school "
            "given words it does not hold, tell us and it will be fixed.</p>"
            '<div class="bl">'
            '<a class="ghost" href="feedback.html">Send a correction</a>'
            '<a class="gpill" href="donate.html">Keep the lamp lit ✦</a>'
            "</div>" + band_door() + "</section>")

    main = (nav + '<div class="wrap">' + frame_html(data["frame"]) + door_html()
            + body + band + "</div>")

    html = shell(
        slug="hajj",
        title=meta["title"],
        desc=meta["desc"],
        ar=meta["ar"],
        kick=meta["kick"],
        h1=meta["h1"],
        lead=meta["lead"],
        main=main,
        css=CSS,
        jsonld=JSONLD,
        extra_js=JS,
        footline="The Golden Room is free forever, like every room in the Codex.",
    )

    open(OUT, "w", encoding="utf-8").write(html)

    figs = html.count('class="fig mo-pop mo-draw"')
    cards = html.count('<article class="card mo"') + html.count('<article class="card mo pillarcard"')
    debated = html.count('class="evb debated mo-pop"')
    bad = [b for _, _, bb in REPORT for b in bb]
    worst = max(DRAWN, key=lambda d: d[1]) if DRAWN else ("none", 0)
    for fid, n, bb in REPORT:
        if bb:
            print("  figure %s: %d texts, %d PROBLEMS" % (fid, n, len(bb)))
            for b in bb:
                print("    " + b)
    print("hajj.html written: %d bytes, %d sections, %d figures, %d rulings marked debated, "
          "%d figure text problems, heaviest figure %s with %d drawn nodes"
          % (len(html.encode("utf-8")), len(sections), figs, debated, len(bad),
             worst[0], worst[1]))
    return len(bad)



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
    _rc = build()
    _synergy("hajj.html")
    sys.exit(1 if _rc else 0)
