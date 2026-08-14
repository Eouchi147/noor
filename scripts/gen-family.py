#!/usr/bin/env python3
# NOOR v49 · The Family Room
# Builds /family.html from build/family.json through the canonical room shell.
# The shell (room.py) supplies head, menu, ink hero and footer; this file
# supplies only the room: its CSS, its <main>, its seven figures, its script.
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from room import shell  # noqa: E402

SRC = os.path.join(ROOT, "build", "family.json")
OUT = os.path.join(ROOT, "family.html")

LEVELS = {
    "quran": ("Qur’an", "Stated directly in the Qur’an"),
    "sunnah": ("Sunnah", "Established in the authentic Sunnah"),
    "debated": ("Scholars differ", "The scholars read this one differently"),
    "editorial": ("Editorial", "Our own counsel, drawn from the sources named"),
}

ORDINALS = ["One", "Two", "Three", "Four", "Five", "Six", "Seven"]


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "’"))


# ----------------------------------------------------------------------------
# figures: one animated, meaningful diagram per section
# ----------------------------------------------------------------------------

def fig(svg, legend, cap):
    leg = "".join("<li>%s</li>" % l for l in legend)
    return ('<div class="fig mo-pop mo-draw">' + svg +
            ('<ul class="leg">' + leg + "</ul>" if legend else "") +
            '<p class="cap">' + cap + "</p></div>")


def fig_marriage():
    svg = (
        '<svg viewBox="0 0 480 250" role="img" aria-label="Two arcs leaning into each other to '
        'form one dome, the keystone at the top labelled sakina, the settling calm.">'
        '<path class="s3" d="M42 216H438"/>'
        '<path class="s1" d="M96 216C96 152 138 98 228 86"/>'
        '<path class="s1" d="M384 216C384 152 342 98 252 86"/>'
        '<path class="s1 f1" d="M226 88H254L248 60H232Z"/>'
        '<path class="s2" d="M206 111l8-13l-14 4"/>'
        '<path class="s2" d="M274 111l-8-13l14 4"/>'
        '<path class="s3" d="M240 60V54"/>'
        '<text class="fg" x="240" y="26" text-anchor="middle">sakina</text>'
        '<text class="fs" x="240" y="45" text-anchor="middle">the settling calm</text>'
        '<text class="fl" x="152" y="156" text-anchor="middle">mawadda</text>'
        '<text class="fs" x="152" y="174" text-anchor="middle">tender love</text>'
        '<text class="fl" x="330" y="156" text-anchor="middle">rahma</text>'
        '<text class="fs" x="330" y="174" text-anchor="middle">mercy</text>'
        '<text class="fs" x="96" y="236" text-anchor="middle">one</text>'
        '<text class="fs" x="384" y="236" text-anchor="middle">the other</text>'
        "</svg>")
    legend = [
        "Two arcs, each leaning its whole weight into the other. Neither one stands alone, "
        "and neither one is the wall.",
        "The keystone is set last, at the place where the leaning meets: sakina, the settling "
        "calm that Allah Himself puts between two strangers.",
    ]
    cap = ("<b>Qur’an 30:21.</b> He created for you, from yourselves, mates, that you may find "
           "rest in them, and placed between you mawadda, tender love, and rahma, mercy.")
    return fig(svg, legend, cap)


def fig_intimacy():
    svg = (
        '<svg viewBox="0 0 480 250" role="img" aria-label="A closed room with one lamp lit '
        'inside, its light staying within the walls, and a door that does not open outward.">'
        '<path class="s1" d="M70 62H410V214H70Z"/>'
        '<path class="s1" d="M352 214V104h58"/>'
        '<circle class="s2" cx="366" cy="160" r="4"/>'
        '<path class="s3" d="M190 62v34"/>'
        '<path class="s1 f1" d="M166 120c0-18 10-24 24-24s24 6 24 24Z"/>'
        '<g class="fg-glow">'
        '<circle class="f1" cx="190" cy="130" r="16"/>'
        '<circle class="s3" cx="190" cy="130" r="26"/>'
        '<circle class="s3" cx="190" cy="130" r="44"/>'
        '<circle class="s3" cx="190" cy="130" r="62"/>'
        "</g>"
        '<circle class="f2" cx="190" cy="128" r="5"/>'
        '<path class="s2" d="M410 148c38-6 46 44 2 50"/>'
        '<path class="s2" d="M426 202l-14-4l13-7"/>'
        '<text class="fs" x="240" y="240" text-anchor="middle">whatever is said in this room comes back into it</text>'
        "</svg>")
    legend = [
        "One lamp, lit inside: what passes between spouses is warmth, counted as sadaqa, "
        "charity, when it is placed where Allah made it lawful.",
        "The light does not leave the walls. The door of that room does not open outward, not "
        "to a friend, not to a relative, not to a screen.",
    ]
    cap = ("<b>Qur’an 2:187 and Muslim 1437.</b> They are a garment for you and you are a garment "
           "for them; and among the worst before Allah is the one who spreads the secret of that room.")
    return fig(svg, legend, cap)


def fig_children():
    cx, cy, core = 240, 174, 36
    rings = []
    for n in range(1, 16):
        r = core + 8 * n
        if n == 7:
            rings.append('<circle class="s1" cx="%d" cy="%d" r="%d"/>' % (cx, cy, r))
        elif n == 10:
            rings.append('<circle class="s1" cx="%d" cy="%d" r="%d"/>' % (cx, cy, r))
        elif n == 15:
            rings.append('<g class="fg-breathe"><circle class="s3" cx="%d" cy="%d" r="%d"/></g>'
                         % (cx, cy, r))
        else:
            rings.append('<circle class="s3" cx="%d" cy="%d" r="%d"/>' % (cx, cy, r))
    r7, r10 = core + 56, core + 80
    a = math.radians(45)
    p7 = (cx + r7 * math.cos(a), cy - r7 * math.sin(a))
    p10 = (cx + r10 * math.cos(a), cy + r10 * math.sin(a))
    svg = (
        '<svg viewBox="0 0 480 350" role="img" aria-label="Tree rings, one ring for every year of '
        'a childhood, the innermost core labelled mercy, with year seven and year ten marked.">'
        + "".join(rings) +
        '<circle class="s1 f1" cx="%d" cy="%d" r="%d"/>' % (cx, cy, core) +
        '<text class="fg" x="%d" y="%d" text-anchor="middle">mercy</text>' % (cx, cy + 7) +
        '<path class="s2" d="M%.0f %.0fL%d %d h28"/>' % (p7[0], p7[1], 368, 84) +
        '<text class="fl" x="402" y="78" text-anchor="middle">year 7</text>' +
        '<path class="s2" d="M%.0f %.0fL%d %d h28"/>' % (p10[0], p10[1], 368, 266) +
        '<text class="fl" x="402" y="260" text-anchor="middle">year 10</text>' +
        '<text class="fs" x="240" y="344" text-anchor="middle">the almost-grown, consulted</text>' +
        "</svg>")
    legend = [
        "Every ring is a year, and a tree never replaces its core. Whatever you grow around it, "
        "the first ring of a childhood is mercy.",
        "Year seven: the prayer is taught, with praise for a crooked sujud, the prostration. Year "
        "ten: it is held to firmly. The firmness rests on seven years of gentleness.",
        "Out at the wide rings, the almost-grown are consulted rather than commanded, as Ibrahim, "
        "peace be upon him, turned to his son and asked what he saw.",
    ]
    cap = ("<b>Abu Dawud 495, Qur’an 37:102, Bukhari 5997.</b> Teach them the prayer at seven and "
           "hold them to it at ten; consult the one who is nearly grown; and whoever shows no "
           "mercy will not be shown mercy.")
    return fig(svg, legend, cap)


def fig_parents():
    svg = (
        '<svg viewBox="24 54 432 196" role="img" aria-label="A staircase on which the grown child '
        'steps down to put a hand under an aging parent, with the wing of humility lowered over '
        'them both.">'
        '<path class="s3" d="M400 120H300V160H220V200H140V240H44"/>'
        '<path class="s1" d="M400 90c-64-4-108 12-148 42"/>'
        '<path class="s1" d="M265 126l-13 6l6-13"/>'
        '<text class="fs" x="352" y="76" text-anchor="middle">you come down</text>'
        '<circle class="s2" cx="196" cy="164" r="11"/>'
        '<path class="s2" d="M196 175v25"/>'
        '<path class="s2" d="M196 182c-20 8-44 22-76 34"/>'
        '<circle class="s2" cx="92" cy="204" r="11"/>'
        '<path class="s2" d="M92 215c-2 9-3 17-3 25"/>'
        '<path class="s2" d="M92 219c-7 1-13 2-18 4"/>'
        '<path class="s2" d="M72 222v18"/>'
        '<path class="s2" d="M92 220c9-2 18-3 26-4"/>'
        '<path class="s1" d="M38 178c30-58 152-64 190-8"/>'
        '<path class="s3" d="M58 174c20-30 66-38 98-20M80 172c16-18 44-22 66-12"/>'
        '<text class="fl" x="136" y="112" text-anchor="middle">the wing, lowered</text>'
        "</svg>")
    legend = [
        "The stairs only run one way. They carried you up when you could not carry yourself, so "
        "now you go down the steps to reach them.",
        "Lower to them the wing of humility out of mercy, and say: My Lord, have mercy on them as "
        "they raised me when I was small.",
    ]
    cap = ("<b>Qur’an 17:23, 17:24 and Muslim 2551.</b> Excellence to parents is decreed beside "
           "His own worship, and the one who finds them in old age and does not enter Paradise "
           "through them has lost a door that was standing open.")
    return fig(svg, legend, cap)


def _n(v):
    return ("%.1f" % v).rstrip("0").rstrip(".")


def _wave(x0, x1, cy, amp, phase, wl=132.0, step=5.0):
    pts = []
    x = x0
    while x <= x1 + 0.001:
        y = cy + amp(x) * math.sin(2 * math.pi * (x - x0) / wl + phase)
        pts.append((_n(x), _n(y)))
        x += step
    return "M%s %s" % pts[0] + "".join(" L%s %s" % p for p in pts[1:])


def fig_kin():
    cy, cut = 112.0, 272.0

    def loose(x):
        return 26.0 if x < cut else 26.0 + (x - cut) * 0.13

    def tight(x):
        return 26.0

    a = _wave(44, 436, cy, loose, 0.0)
    c = _wave(44, 436, cy, loose, 4.18879)
    b = _wave(44, cut, cy, tight, 2.0944)
    yb = cy + 26.0 * math.sin(2 * math.pi * (cut - 44) / 132.0 + 2.0944)
    svg = (
        '<svg viewBox="0 0 480 220" role="img" aria-label="Three strands woven into one rope; one '
        'strand is cut and the whole weave loosens, while a gold line arcs back to rejoin it.">'
        '<path class="s3" d="%s"/>' % a +
        '<path class="s3" d="%s"/>' % c +
        '<path class="s2" d="%s"/>' % b +
        '<path class="s2" d="M%.0f %.0fl16 -10"/>' % (cut - 8, yb + 4) +
        '<path class="s3" d="M%.0f %.0fV176"/>' % (cut, yb + 14) +
        '<text class="fs" x="272" y="194" text-anchor="middle">one strand cut</text>' +
        '<path class="s1" d="M286 92C304 32 382 22 424 90"/>' +
        '<path class="s1" d="M413 84l11 8l-3 -14"/>' +
        '<text class="fl" x="356" y="18" text-anchor="middle">joined again</text>' +
        '<text class="fs" x="72" y="42" text-anchor="middle">held</text>' +
        '<text class="fs" x="392" y="204" text-anchor="middle">the weave slackens</text>' +
        "</svg>")
    legend = [
        "Three strands, one rope. Cut a single strand and the others do not stay as they were: "
        "the whole weave slackens, quietly, along its full length.",
        "The wasil, the true joiner, is not the one who repays what he is given. He is the one "
        "who reaches back over the gap to the kin who cut him off.",
    ]
    cap = ("<b>Tirmidhi 1907, Bukhari 5991, Muslim 2558.</b> Allah said of the rahim, the "
           "womb-bond: I have derived its name from My own; whoever joins it, I join him.")
    return fig(svg, legend, cap)


def fig_friends():
    cx, cy, R = 240.0, 158.0, 104.0
    people, chevrons = [], []
    for k in range(5):
        th = math.radians(-90 + k * 72)
        x, y = cx + R * math.cos(th), cy + R * math.sin(th)
        people.append('<circle class="s2" cx="%.0f" cy="%.0f" r="10"/>' % (x, y))
        people.append('<path class="s2" d="M%.0f %.0fc2 -13 30 -13 32 0"/>' % (x - 16, y + 26))
        tm = math.radians(-90 + k * 72 + 36)
        px, py = cx + R * math.cos(tm), cy + R * math.sin(tm)
        dx, dy = -math.sin(tm), math.cos(tm)
        nx, ny = math.cos(tm), math.sin(tm)
        tip = (px + 7 * dx, py + 7 * dy)
        back = (px - 5 * dx, py - 5 * dy)
        w1 = (back[0] + 5 * nx, back[1] + 5 * ny)
        w2 = (back[0] - 5 * nx, back[1] - 5 * ny)
        chevrons.append('<path class="s2" d="M%.0f %.0fL%.0f %.0fL%.0f %.0f"/>'
                        % (w1[0], w1[1], tip[0], tip[1], w2[0], w2[1]))
    svg = (
        '<svg viewBox="0 0 480 310" role="img" aria-label="Five companions standing in a circle '
        'while one lit lamp travels from hand to hand around them.">'
        '<circle class="s3" cx="240" cy="158" r="104"/>'
        + "".join(chevrons) + "".join(people) +
        '<g class="fg-orbit">'
        '<circle class="f1" cx="272" cy="59" r="19"/>'
        '<circle class="f2" cx="272" cy="59" r="8"/>'
        "</g>"
        '<text class="fg" x="240" y="154" text-anchor="middle">khalil</text>'
        '<text class="fs" x="240" y="176" text-anchor="middle">the closest friend</text>'
        '<text class="fs" x="240" y="300" text-anchor="middle">one lamp, passed hand to hand</text>'
        "</svg>")
    legend = [
        "A person is upon the religion of his khalil, his closest friend. The seats nearest your "
        "heart are appointments, not accidents.",
        "The lamp does not stay with one of them. It is counsel given privately, love said out "
        "loud, and presence on the hard days, moving around the circle.",
    ]
    cap = ("<b>Tirmidhi 2378, Bukhari 660, Abu Dawud 5124.</b> Look carefully at whom you take as "
           "an intimate; two who loved for the sake of Allah stand in His shade; and when you love "
           "your brother, tell him so.")
    return fig(svg, legend, cap)


def fig_neighbors():
    svg = (
        '<svg viewBox="0 0 480 306" role="img" aria-label="A house at the centre of widening '
        'rings: the nearest door, the street, and the road where the stranger walks.">'
        '<circle class="band40" cx="240" cy="178" r="75"/>'
        '<circle class="s1" cx="240" cy="178" r="54"/>'
        '<circle class="s3" cx="240" cy="178" r="96"/>'
        '<g class="fg-breathe"><circle class="s3" cx="240" cy="178" r="138"/></g>'
        '<path class="s1" d="M212 178h56v28h-56Z"/>'
        '<path class="s1" d="M202 178l38-30l38 30"/>'
        '<path class="s2" d="M234 206v-14h12v14"/>'
        '<path class="s2" d="M304 182h24v16h-24Z"/>'
        '<path class="s2" d="M300 182l16-12l16 12"/>'
        '<path class="s2" d="M152 182h24v16h-24Z"/>'
        '<path class="s2" d="M148 182l16-12l16 12"/>'
        '<path class="s1" d="M272 190h28"/>'
        '<text class="fs" x="322" y="226" text-anchor="middle">first claim</text>'
        '<path class="s3" d="M240 114v10"/>'
        '<path class="s3" d="M240 72v10"/>'
        '<path class="s3" d="M240 30v10"/>'
        '<text class="fl" x="240" y="110" text-anchor="middle">the nearest door</text>'
        '<text class="fl" x="240" y="68" text-anchor="middle">the street</text>'
        '<text class="fl" x="240" y="26" text-anchor="middle">the road, and the stranger</text>'
        '<text class="fs" x="240" y="262" text-anchor="middle">the neighborhood</text>'
        "</svg>")
    legend = [
        "Jibril kept counseling the Prophet ﷺ about the neighbor until he thought neighbors would "
        "be written into each other’s wills.",
        "The rings widen outward: the nearest door has the first claim, then the street, then the "
        "road, where even a stranger is owed the salam, the greeting of peace.",
        "A much repeated report stretches a neighborhood to forty houses in every direction. Its "
        "chain is contested; the sound texts settle the first duty on the door closest to yours.",
    ]
    cap = ("<b>Bukhari 6015, Bukhari 6016 and Muslim 46.</b> By Allah, he does not believe: the "
           "one whose neighbor is not safe from his harms.")
    return fig(svg, legend, cap)


FIGS = {
    "marriage": fig_marriage,
    "intimacy": fig_intimacy,
    "children": fig_children,
    "parents": fig_parents,
    "kin": fig_kin,
    "friends": fig_friends,
    "neighbors": fig_neighbors,
}


# ----------------------------------------------------------------------------
# blocks
# ----------------------------------------------------------------------------

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


def card_html(t):
    label, hint = LEVELS.get(t.get("level", "editorial"), LEVELS["editorial"])
    ps = "".join("<p>%s</p>" % esc(p) for p in t.get("ps", []))
    return ('<article class="card mo">'
            '<div class="ch"><h3>%s</h3>'
            '<span class="evb %s mo-pop" title="%s">%s</span></div>%s%s</article>'
            % (esc(t.get("t", "")), esc(t.get("level", "editorial")), esc(hint),
               esc(label), ps, refs_html(t.get("refs"))))


def week_html(sec):
    lines = sec.get("practice", [])
    items = []
    for i, line in enumerate(lines):
        items.append('<li><label class="wkl">'
                     '<input type="checkbox" data-k="%s:%d"/>'
                     '<span class="bx" aria-hidden="true"></span>'
                     '<span class="tx">%s</span></label></li>' % (sec["id"], i, esc(line)))
    return ('<div class="week mo">'
            '<div class="wk-top"><p class="wk-k">This week</p>'
            '<p class="wk-c"><span data-count="%s">0</span> of %d taken up</p></div>'
            '<p class="wk-l">Take one, not all of them. A small thing kept through an ordinary '
            'week outlives a great intention. Nothing here is counted against you.</p>'
            '<ul class="wk-list">%s</ul>'
            '<button type="button" class="wk-reset" data-reset="%s">Begin the week again</button>'
            "</div>" % (sec["id"], len(lines), "".join(items), sec["id"]))


def section_html(sec, idx):
    ar, gloss = (sec.get("ar", "") + ", ").split(", ", 1)
    gloss = gloss.rstrip(", ")
    return ('<section class="rsec" id="%s">'
            '<p class="sh-n">%s of seven</p>'
            '<div class="sh"><span class="ar notranslate" translate="no">%s</span>'
            '<h2>%s</h2></div>'
            '<p class="tr">%s</p>'
            '<p class="sub">%s</p>'
            "%s%s%s</section>"
            % (esc(sec["id"]), ORDINALS[idx], esc(ar), esc(sec.get("title", "")), esc(gloss),
               esc(sec.get("lead", "")), FIGS[sec["id"]](),
               "".join(card_html(t) for t in sec.get("teachings", [])), week_html(sec)))


def opening_html():
    keys = "".join(
        '<div><span class="evb %s">%s</span><span>%s</span></div>' % (k, esc(v[0]), esc(v[1]))
        for k, v in (("quran", ("Qur’an", "stated in the Book itself")),
                     ("sunnah", ("Sunnah", "established in authentic hadith")),
                     ("debated", ("Scholars differ", "read differently by the scholars")),
                     ("editorial", ("Editorial", "our own counsel, never revelation"))))
    return ('<article class="card open mo">'
            '<p class="kk">How this room was written</p>'
            "<p>This room began as a long private manuscript on marriage, kept for years and never "
            "meant to leave one house. It has been rewritten from the first line and widened until "
            "it could hold the whole household: the spouse, the child, the parent, the relative you "
            "did not choose, the friend you did, and the neighbor whose wall touches yours.</p>"
            "<p>Nothing here is offered on feeling alone. Every teaching carries its evidence in "
            "the open: a verse you can hear recited aloud, a narration named by its collection and "
            "number, and an honest badge when the scholars differ or when a line is our own counsel "
            "rather than revelation. Where a report is beloved but weak, that is said plainly "
            "instead of borrowed quietly.</p>"
            "<p>Read it slowly, and take one thing. A small practice kept through an ordinary week "
            "will do more for your house than a page you admired and closed.</p>"
            '<div class="keys">%s</div></article>' % keys)


CSS = """
html{scroll-behavior:auto}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
.secnav{position:sticky;top:3.5rem;z-index:30;background:rgba(255,254,247,.93);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid rgba(44,36,22,.08)}
.secnav-in{position:relative;display:flex;gap:.38rem;align-items:center;max-width:62rem;margin:0 auto;padding:.5rem 1rem;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}
.secnav-in::-webkit-scrollbar{display:none}
.secnav a{flex:0 0 auto;font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(44,36,22,.55);text-decoration:none;border:1px solid rgba(44,36,22,.13);border-radius:999px;padding:.3rem .68rem;background:#fff;transition:color .2s,border-color .2s,background .2s,box-shadow .2s;white-space:nowrap}
.secnav a:hover{color:#2C2416;border-color:rgba(201,162,39,.5)}
.secnav a.on{color:#1A160F;background:linear-gradient(135deg,#C9A227,#E9C86A);border-color:transparent;box-shadow:0 2px 12px rgba(201,162,39,.3)}
.open{margin-top:1.7rem;border-color:rgba(201,162,39,.3);box-shadow:0 8px 30px rgba(44,36,22,.07)}
.open .kk{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .6rem}
.keys{display:grid;grid-template-columns:1fr 1fr;gap:.5rem .9rem;margin-top:.95rem;padding-top:.9rem;border-top:1px solid rgba(44,36,22,.1)}
.keys div{display:flex;align-items:center;gap:.45rem;font-size:.71rem;color:rgba(44,36,22,.55);line-height:1.5}
.keys .evb{flex:0 0 auto}
@media (max-width:560px){.keys{grid-template-columns:1fr}}
.rsec{scroll-margin-top:6.6rem}
.sh-n{font-size:.6rem;letter-spacing:.22em;text-transform:uppercase;font-weight:800;color:rgba(201,162,39,.95);margin:0 0 .35rem}
.rsec .sh{gap:.7rem}
.rsec .sh .ar{font-size:1.55rem;line-height:1.2}
.tr{font-size:.73rem;color:rgba(44,36,22,.48);margin:.3rem 0 0;letter-spacing:.02em}
.card.mo h3{letter-spacing:-.01em}
.ch{display:flex;align-items:flex-start;justify-content:space-between;gap:.7rem;margin-bottom:.5rem}
.ch h3{margin:0}
.ch .evb{flex:0 0 auto;margin-top:.12rem}
.ref{display:inline-flex;align-items:center;gap:.35rem;line-height:1.4}
.ref .rn{font-weight:600;color:rgba(44,36,22,.5)}
.ref.q{background:rgba(201,162,39,.09);border-color:rgba(201,162,39,.26);padding-inline-start:.28rem}
.vplay{transition:background .18s,color .18s}
.vplay:hover{background:rgba(244,212,106,.3)}
.fig svg{width:100%;max-width:33rem;height:auto;display:block;margin:0 auto}
.fig svg text{font-family:Inter,system-ui,sans-serif}
.fg{fill:#F4D46A;font-size:19px;font-weight:800;letter-spacing:.01em}
.fl{fill:#FFFEF7;fill-opacity:.82;font-size:16px;font-weight:600}
.fs{fill:#FFFEF7;fill-opacity:.5;font-size:13.5px;font-weight:500}
.s1{fill:none;stroke:#E9C86A;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.s2{fill:none;stroke:#FFFEF7;stroke-opacity:.6;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.s3{fill:none;stroke:#F4D46A;stroke-opacity:.32;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.f1{fill:#F4D46A;fill-opacity:.16}
.f2{fill:#F4D46A}
.band40{fill:none;stroke:#F4D46A;stroke-opacity:.1;stroke-width:42}
.leg{list-style:none;margin:1rem 0 0;padding:0;display:grid;gap:.45rem}
.leg li{position:relative;padding-inline-start:1rem;font-size:.75rem;line-height:1.7;color:rgba(255,254,247,.66)}
.leg li::before{content:"";position:absolute;inset-inline-start:0;top:.62rem;width:.36rem;height:.36rem;border-radius:50%;background:#E9C86A}
.fig .cap b{color:rgba(244,212,106,.85);font-weight:700}
.week{margin-top:1.1rem;border-radius:18px;padding:1.05rem 1.15rem 1.15rem;background:linear-gradient(168deg,#FFFCEF,#FFF6DB);border:1px solid rgba(201,162,39,.3)}
.wk-top{display:flex;align-items:baseline;justify-content:space-between;gap:.7rem}
.wk-k{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0}
.wk-c{font-size:.65rem;color:rgba(44,36,22,.45);margin:0;font-weight:700;white-space:nowrap}
.wk-l{font-size:.78rem;color:rgba(44,36,22,.6);line-height:1.75;margin:.4rem 0 .75rem}
.wk-list{list-style:none;margin:0;padding:0}
.wkl{position:relative;display:flex;gap:.62rem;align-items:flex-start;padding:.45rem .35rem;border-radius:12px;cursor:pointer;transition:background .18s}
.wkl:hover{background:rgba(201,162,39,.09)}
.wkl input{position:absolute;opacity:0;width:0;height:0}
.bx{flex:0 0 auto;width:1.08rem;height:1.08rem;margin-top:.14rem;border-radius:7px;border:1.5px solid rgba(201,162,39,.55);background:#fff;position:relative;transition:background .2s,border-color .2s,transform .2s}
.bx::after{content:"";position:absolute;inset-inline-start:.33rem;top:.13rem;width:.26rem;height:.52rem;border:solid #1A160F;border-width:0 2px 2px 0;transform:rotate(42deg) scale(.35);opacity:0;transition:opacity .2s,transform .2s}
.wkl input:checked+.bx{background:linear-gradient(135deg,#C9A227,#E9C86A);border-color:transparent}
.wkl input:checked+.bx::after{opacity:1;transform:rotate(42deg) scale(1)}
.wkl input:focus-visible+.bx{outline:2px solid #8a6d13;outline-offset:2px}
.wkl .tx{font-size:.83rem;line-height:1.7;color:rgba(44,36,22,.82)}
.wkl input:checked~.tx{color:rgba(44,36,22,.42)}
.wk-reset{margin-top:.65rem;background:none;border:0;font:inherit;font-size:.67rem;font-weight:700;color:rgba(44,36,22,.4);cursor:pointer;text-decoration:underline;padding:.25rem .35rem}
.wk-reset:hover{color:rgba(44,36,22,.65)}
.band{margin:3rem 0 .5rem;text-align:center;background:linear-gradient(170deg,#FFFDF3,#FFF6DB);border:1px solid rgba(201,162,39,.26);border-radius:20px;padding:1.6rem 1.2rem}
.band p{font-size:.82rem;color:rgba(44,36,22,.62);line-height:1.85;margin:0 auto .95rem;max-width:32rem}
.band .bl{display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap}
@media (prefers-reduced-motion:no-preference){
.fg-glow{animation:famglow 4.2s ease-in-out infinite}
@keyframes famglow{0%,100%{opacity:.5}50%{opacity:1}}
.fg-breathe{animation:fambreathe 5.4s ease-in-out infinite}
@keyframes fambreathe{0%,100%{opacity:.35}50%{opacity:.9}}
.fg-orbit{animation:famorbit 18s linear infinite;transform-origin:240px 158px;transform-box:view-box}
@keyframes famorbit{to{transform:rotate(360deg)}}
}
"""

JS = """<script>
(function(){
"use strict";
/* the week, kept in one small drawer */
var KEY="noor_fam_v1", state={};
try{state=JSON.parse(localStorage.getItem(KEY)||"{}")||{};}catch(e){state={};}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}
var boxes=[].slice.call(document.querySelectorAll(".wk-list input[type=checkbox]"));
function tally(){
  var m={};
  boxes.forEach(function(b){
    var s=b.getAttribute("data-k").split(":")[0];
    if(!m[s])m[s]=0;
    if(b.checked)m[s]++;
  });
  Object.keys(m).forEach(function(s){
    var el=document.querySelector('[data-count="'+s+'"]');
    if(el)el.textContent=m[s];
  });
}
boxes.forEach(function(b){
  var k=b.getAttribute("data-k");
  if(state[k])b.checked=true;
  b.addEventListener("change",function(){
    if(b.checked){state[k]=1;}else{delete state[k];}
    save(); tally();
  });
});
[].slice.call(document.querySelectorAll("[data-reset]")).forEach(function(btn){
  btn.addEventListener("click",function(){
    var s=btn.getAttribute("data-reset")+":";
    boxes.forEach(function(b){
      var k=b.getAttribute("data-k");
      if(k.indexOf(s)===0){b.checked=false;delete state[k];}
    });
    save(); tally();
  });
});
tally();
/* verse audio through the shared Mushaf voice */
document.querySelectorAll(".vplay").forEach(function(b){
  b.addEventListener("click",function(){if(window.playAyah)window.playAyah(b.getAttribute("data-ref"),b);});
});
/* the rail follows the room you are reading */
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


def build():
    data = json.load(open(SRC, encoding="utf-8"))
    sections = data["sections"]

    short = {"neighbors": "Neighbors"}
    chips = "".join('<a href="#%s">%s</a>'
                    % (esc(s["id"]), esc(short.get(s["id"], s["title"])))
                    for s in sections)
    nav = ('<nav class="secnav" id="secnav" aria-label="The seven bonds of the house">'
           '<div class="secnav-in">%s</div></nav>' % chips)

    body = "".join(section_html(s, i) for i, s in enumerate(sections))

    band = ('<section class="band mo">'
            "<p>The Family Room keeps growing: sections widen, sourcing tightens, and wording "
            "softens, wave after wave, as families read it and write back.</p>"
            '<div class="bl">'
            '<a class="ghost" href="feedback.html">Send a correction</a>'
            '<a class="gpill" href="donate.html">Keep the lamp lit ✦</a>'
            "</div></section>")

    main = nav + '<div class="wrap">' + opening_html() + body + band + "</div>"

    html = shell(
        slug="family",
        title="The Family Room",
        desc=("Marriage, intimacy, children, parents, kin, friends and neighbors in Islam: every "
              "teaching anchored in the Qur’an, with recitation, and in authentic hadith, with one "
              "small practice for the week."),
        ar="الأُسْرَة",
        kick="The Family Room",
        h1="How Allah asks us to love the people He gave us",
        lead=("Al-usra, the family, is the first house Allah gave you: the spouse beside you, the "
              "child in your arms, the parent at your door, the relative you did not choose, the "
              "friend you did, the neighbor whose wall touches yours, and the stranger who knocks "
              "on it. This room is practical, so every teaching carries its evidence in the open "
              "and ends in one small thing you can do this week."),
        main=main,
        css=CSS,
        extra_js=JS,
        footline="The Family Room is free forever, like every room in the Codex.",
    )

    open(OUT, "w", encoding="utf-8").write(html)
    figs = html.count('class="fig mo-pop mo-draw"')
    teachings = sum(len(s.get("teachings", [])) for s in sections)
    print("family.html written: %d bytes, %d sections, %d teachings, %d figures"
          % (len(html.encode("utf-8")), len(sections), teachings, figs))



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
    _synergy("family.html")
