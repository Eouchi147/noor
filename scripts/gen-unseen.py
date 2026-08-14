#!/usr/bin/env python3
# NOOR v49 · The Unseen and the Mysteries
# Rebuilds /unseen.html through the canonical room shell (room.py), which
# supplies the head, the house menu, the ink hero and the footer. This file
# supplies only the room: its CSS, its six drawn figures, its six category
# gates, its 35 tiles with their evidence panels, the First War feature, the
# Night Journey feature, and one small script.
#
#   python3 scripts/gen-unseen.py
#
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from room import shell  # noqa: E402

DATA = os.path.join(ROOT, "unseen-data.js")
FIRST_WAR = os.path.join(ROOT, "build", "first-war.json")
NIGHT_JOURNEY = os.path.join(ROOT, "build", "night-journey.json")
OUT = os.path.join(ROOT, "unseen.html")


# ---------------------------------------------------------------- helpers

def esc(s):
    """House escaping: safe in text and in attributes, curly apostrophes."""
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "’"))


QREF = re.compile(r"^Qur[’']an\s+(\d{1,3}:\d{1,3}(?:-\d{1,3})?)$")
COLLECTIONS = ("Sahih al-Bukhari", "Sahih Muslim", "Musnad Ahmad", "Muwatta Malik",
               "Abu Dawud", "Bukhari", "Muslim", "Tirmidhi", "Nasai", "Ibn Majah")


def ref_chip(ref):
    """Every Qur’an reference on this page carries a working play button."""
    r = str(ref).strip()
    m = QREF.match(r)
    if m:
        verse = m.group(1)
        return ('<button type="button" class="vplay" data-ref="%s" '
                'aria-label="Play the recitation of Qur’an %s">Qur’an %s ▸</button>'
                % (esc(verse), esc(verse), esc(verse)))
    for c in COLLECTIONS:
        if r == c or r.startswith(c + " "):
            rest = r[len(c):].strip()
            return ('<span class="ref"><b>%s</b>%s</span>'
                    % (esc(c), (" " + esc(rest)) if rest else ""))
    return '<span class="ref">%s</span>' % esc(r)


def refs_row(refs, cls="refs"):
    if not refs:
        return ""
    return '<span class="%s">%s</span>' % (cls, "".join(ref_chip(r) for r in refs))


# ---------------------------------------------------------------- badges

BADGE = {
    "quran": (
        "Qur’an-confirmed",
        "Qur’an-confirmed: stated directly in the Qur’an",
        '<circle cx="6" cy="6" r="4.6" fill="currentColor"/>'
        '<circle cx="6" cy="6" r="1.7" fill="#FFFEF7"/>'),
    "sunnah": (
        "Sunnah-confirmed",
        "Sunnah-confirmed: established by authentic hadith",
        '<circle cx="6" cy="6" r="4.6" fill="currentColor"/>'),
    "debated": (
        "Scholars differ",
        "Scholars differ: the gradings or the readings are not settled",
        '<circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.8" '
        'stroke-dasharray="3 2.4"/>'),
    "corrected": (
        "Corrected",
        "Corrected: a myth the Qur’an or the Prophet ﷺ cancelled outright",
        '<circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/>'
        '<line x1="2.8" y1="9.2" x2="9.2" y2="2.8" stroke="currentColor" stroke-width="1.8"/>'),
    "mixed": (
        "Mixed evidence",
        "Mixed evidence: this entry carries claims of different strength, badged one by one",
        '<path d="M6 1.4 A4.6 4.6 0 0 1 6 10.6 Z" fill="currentColor"/>'
        '<path d="M6 1.4 A4.6 4.6 0 0 0 6 10.6 Z" fill="none" stroke="currentColor" '
        'stroke-width="1.5"/>'),
    "editorial": (
        "Editorial context",
        "Editorial context: context, not a religious claim",
        '<circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
}

LEGEND_MEANING = [
    ("quran", "stated directly in the Book, in words you can hear recited here"),
    ("sunnah", "established in the authentic hadith collections, named and numbered"),
    ("debated", "the chain or the reading is not settled, and the room says so"),
    ("corrected", "a myth the Prophet ﷺ corrected: the belief itself was cancelled"),
    ("mixed", "one entry holding claims of different strength, badged one by one"),
    ("editorial", "our own framing, drawn from the sources named, never revelation"),
]


def badge(level, small=False):
    lab, aria, shape = BADGE.get(level, BADGE["editorial"])
    return ('<span class="ev ev-%s%s" role="img" aria-label="%s">'
            '<svg viewBox="0 0 12 12" aria-hidden="true">%s</svg>%s</span>'
            % (level, " ev-sm" if small else "", esc(aria), shape, esc(lab)))


# ---------------------------------------------------------------- data

def load_entries():
    raw = open(DATA, encoding="utf-8").read().strip()
    head = "window.NOOR_UNSEEN="
    if not raw.startswith(head):
        raise SystemExit("unseen-data.js does not open with " + head)
    return json.loads(raw[len(head):].rstrip(";"))["entries"]


CATS = [
    ("angels", "Angels", "الْمَلَائِكَة", "al-mala’ika, the angels",
     "Created from light, never disobeying what they are commanded, and named in this room "
     "only where the texts name them."),
    ("jinn", "Jinn", "الْجِنّ", "al-jinn, the hidden ones",
     "A creation of smokeless fire, older than us, given free will and held to account "
     "exactly as we are."),
    ("peoples", "Previous Peoples", "الْأُمَمُ السَّابِقَة", "al-umam as-sabiqa, the nations before",
     "Nations the Qur’an names, the sign each one was given, and the ending that came only "
     "after refusal."),
    ("signs", "Signs of the Hour", "أَشْرَاطُ السَّاعَة", "ashrat as-sa’a, the signs of the Hour",
     "What was promised before the Hour, and the date that was given to no one, not even to "
     "the Prophet ﷺ."),
    ("myth", "Truth and Myth", "الْخُرَافَاتُ الْمُصَحَّحَة", "al-khurafat al-musahhaha, the corrected myths",
     "Beliefs the sources cancel outright, one they confirm, and one they leave open without "
     "settling it."),
    ("mysteries", "Mysteries Explained", "أَسْرَارٌ مُفَسَّرَة", "asrar mufassara, mysteries explained",
     "Things the texts do explain, told to the edge of what they say and not one step past it."),
]
CAT_LABEL = {c[0]: c[1] for c in CATS}


# ---------------------------------------------------------------- figures

def fig(svg, legend, cap, wide=False, extra=""):
    leg = ""
    if legend:
        leg = ('<ul class="leg%s">%s</ul>'
               % (" leg2" if len(legend) > 5 else "",
                  "".join("<li>%s</li>" % x for x in legend)))
    return ('<div class="fig mo-draw%s">%s%s%s<p class="cap">%s</p></div>'
            % (extra, svg, leg, "", cap))


def fig_angels():
    stations = [
        (548, "al-Hafaza, the guardians in succession",
         "in relays, before him and behind him · 13:11"),
        (480, "Kiraman Katibin, the noble scribes",
         "one seated at the right, one at the left · 82:10-12"),
        (412, "Malak al-Mawt, the angel of death",
         "one entrusted with taking each soul at its time · 32:11"),
        (344, "The two questioners of the grave",
         "established in the Sahih, and unnamed there · Bukhari 1338"),
        (276, "The keepers of the two gates",
         "Malik over the Fire 43:77 · the keepers of the Garden 39:73"),
        (208, "The one entrusted with the Horn",
         "already holding it, waiting for the command · 39:68"),
        (140, "Jibril at the Lote Tree of the furthest limit",
         "seen in the form he was created in, twice · 53:13-18"),
        (72, "Hamalat al-Arsh, the bearers of the Throne",
         "eight of them bearing it on that Day · 69:17"),
    ]
    rows = []
    for y, main, sub in stations:
        rows.append(
            '<path class="s3" d="M104 %d H160"/>'
            '<circle class="f2" cx="104" cy="%d" r="7"/>'
            '<text class="fl" x="178" y="%d">%s</text>'
            '<text class="fs" x="178" y="%d">%s</text>'
            % (y, y, y - 4, esc(main), y + 22, esc(sub)))
    svg = (
        '<svg viewBox="0 0 720 600" class="figsvg" role="img" aria-labelledby="fig-ang-t">'
        '<title id="fig-ang-t">A rising column of light with the stations of the angels '
        'labelled from the ground where you stand up to the Throne</title>'
        '<rect class="colglow" x="92" y="40" width="24" height="530" rx="12"/>'
        '<path class="s1" d="M104 570 V 46"/>'
        '<circle class="s2" cx="104" cy="34" r="13"/>'
        '<path class="s3" d="M104 8 V 20 M78 34 H 62 M146 34 H 130 M86 16 L 76 6 '
        'M122 16 L 132 6"/>'
        '%s'
        '<path class="s3" d="M44 580 H 170"/>'
        '<text class="fn" x="44" y="594">where you stand</text>'
        '</svg>' % "".join(rows))
    legend = [
        "Read it as placement, not promotion. The texts station the recorders over your "
        "shoulders, the questioners at the grave, the keepers at the gates, and the bearers "
        "at the Throne; they never rank one angel above another for us.",
        "Three of the names people use most are missing here on purpose: Azrail for the angel "
        "of death, Munkar and Nakir for the two questioners, and Ridwan for the keeper of the "
        "Garden. The offices are established, the names come from later reports, and the tiles "
        "below badge each one where it stands.",
    ]
    cap = ("The column of stations, drawn from the ground upward. Every rung is a duty the "
           "texts assign, and every duty is carried out by Allah’s command alone: %s %s %s "
           "%s %s %s %s"
           % (ref_chip("Qur’an 13:11"), ref_chip("Qur’an 82:10-12"), ref_chip("Qur’an 32:11"),
              ref_chip("Qur’an 43:77"), ref_chip("Qur’an 39:68"), ref_chip("Qur’an 53:13-18"),
              ref_chip("Qur’an 69:17")))
    return fig(svg, legend, cap)


def fig_jinn():
    svg = (
        '<svg viewBox="0 0 600 350" class="figsvg" role="img" aria-labelledby="fig-jinn-t">'
        '<title id="fig-jinn-t">Three vessels side by side: clay for the human, a smokeless '
        'flame for the jinn, and a lamp of light for the angels</title>'

        '<g transform="translate(100 0)">'
        '<path class="s1" d="M-30 90 H30"/>'
        '<path class="s1" d="M-22 90 C-26 110 -48 118 -48 146 C-48 180 -26 204 0 204 '
        'C26 204 48 180 48 146 C48 118 26 110 22 90 Z"/>'
        '<path class="s2" d="M-34 146 H34 M-28 168 H28"/>'
        '<path class="s3" d="M-58 226 H58"/>'
        '<text class="fl" x="0" y="258">the human</text>'
        '<text class="fs" x="0" y="284">from salsal,</text>'
        '<text class="fs" x="0" y="306">clay like pottery</text>'
        '<text class="fk" x="0" y="332">55:14 · 15:26</text>'
        '</g>'

        '<g transform="translate(300 0)">'
        '<path class="s1" d="M0 48 C22 86 36 112 36 142 C36 174 20 196 0 196 '
        'C-20 196 -36 174 -36 142 C-36 112 -18 86 0 48 Z"/>'
        '<path class="s2" d="M0 112 C11 132 17 144 17 158 C17 174 9 184 0 184 '
        'C-9 184 -17 174 -17 158 C-17 144 -11 132 0 112 Z"/>'
        '<path class="s1" d="M-44 194 H44 C38 212 22 220 0 220 C-22 220 -38 212 -44 194 Z"/>'
        '<path class="s3" d="M-58 226 H58"/>'
        '<text class="fl" x="0" y="258">the jinn</text>'
        '<text class="fs" x="0" y="284">from marij,</text>'
        '<text class="fs" x="0" y="306">a smokeless flame</text>'
        '<text class="fk" x="0" y="332">55:15 · 15:27</text>'
        '</g>'

        '<g transform="translate(500 0)">'
        '<path class="s1" d="M0 52 V 78"/>'
        '<path class="s1" d="M-32 94 H32 L18 170 H-18 Z"/>'
        '<circle class="halo" cx="0" cy="132" r="30"/>'
        '<circle class="f2" cx="0" cy="132" r="10"/>'
        '<path class="s2" d="M0 184 V 208 M-40 152 L-62 166 M40 152 L62 166 '
        'M-38 106 L-58 92 M38 106 L58 92"/>'
        '<path class="s3" d="M-58 226 H58"/>'
        '<text class="fl" x="0" y="258">the angels</text>'
        '<text class="fs" x="0" y="284">from nur,</text>'
        '<text class="fs" x="0" y="306">which is light</text>'
        '<text class="fk" x="0" y="332">Muslim 2996</text>'
        '</g>'
        '</svg>')
    cap = ("Three creations, three materials, one Maker. The human from salsal ka al-fakhkhar, "
           "clay like pottery %s, and from sounding clay of altered black mud %s; the jinn from "
           "marij min nar, a smokeless flame of fire %s, and from nar as-samum, the fire of the "
           "scorching wind %s; the angels from nur, light, in the narration of Aisha, may Allah "
           "be pleased with her %s. None of the three was made out of another, and none of it is "
           "a figure of speech for something else."
           % (ref_chip("Qur’an 55:14"), ref_chip("Qur’an 15:26"), ref_chip("Qur’an 55:15"),
              ref_chip("Qur’an 15:27"), ref_chip("Muslim 2996")))
    return fig(svg, None, cap)


def fig_peoples():
    stops = [
        (86, 1, ["The people", "of Nuh"], "the ark on dry land", "the flood"),
        (204, 0, ["’Ad"], "a cloud taken for rain", "the wind, seven nights"),
        (322, 1, ["Thamud"], "the she-camel", "the cry at morning"),
        (440, 0, ["The people", "of Lut"], "guests, and a deadline", "the cities overturned"),
        (558, 1, ["Madyan"], "give the full measure", "the earthquake"),
        (676, 0, ["Pharaoh"], "nine clear signs", "the sea closed"),
    ]
    parts = ['<path class="s1" d="M46 160 H 706"/>']
    for x, up, names, sign, end in stops:
        if up:
            parts.append('<path class="s3" d="M%d 160 V 114"/>'
                         '<circle class="f2" cx="%d" cy="114" r="7"/>' % (x, x))
            ny = 94 - (22 * (len(names) - 1))
            for i, n in enumerate(names):
                parts.append('<text class="fl" x="%d" y="%d">%s</text>'
                             % (x, ny + i * 22, esc(n)))
            parts.append('<text class="fs" x="%d" y="%d">%s</text>' % (x, ny - 24, esc(sign)))
            parts.append('<text class="fk" x="%d" y="%d">%s</text>' % (x, ny - 48, esc(end)))
        else:
            parts.append('<path class="s3" d="M%d 160 V 206"/>'
                         '<circle class="f2" cx="%d" cy="206" r="7"/>' % (x, x))
            ny = 230
            for i, n in enumerate(names):
                parts.append('<text class="fl" x="%d" y="%d">%s</text>'
                             % (x, ny + i * 22, esc(n)))
            base = ny + 22 * len(names)
            parts.append('<text class="fs" x="%d" y="%d">%s</text>' % (x, base + 4, esc(sign)))
            parts.append('<text class="fk" x="%d" y="%d">%s</text>' % (x, base + 28, esc(end)))
    svg = ('<svg viewBox="0 0 750 320" class="figsvg tl" role="img" '
           'aria-labelledby="fig-peo-t">'
           '<title id="fig-peo-t">A drawn timeline of the nations the Qur’an names, each with '
           'the sign it was given and the ending that followed refusal</title>%s</svg>'
           % "".join(parts))
    legend = [
        "The muted line under each name is the sign that people were given. The gold line is "
        "what came after they refused it, and never before.",
        "Three of the six have their own tile in this section: the people of Nuh, ’Ad, and "
        "Thamud. Madyan and Pharaoh stand here for the shape of the pattern.",
    ]
    cap = ("The order is the Qur’an’s own order of telling in Surat al-A’raf, where Nuh comes "
           "first, then Hud to ’Ad, Salih to Thamud, Lut, Shu’ayb to Madyan, and Musa before "
           "Pharaoh. It is a sequence of stories, not a calendar: the Qur’an gives no dates for "
           "any of them, and this room does not invent any. %s %s %s %s %s %s %s %s"
           % (ref_chip("Qur’an 29:14"), ref_chip("Qur’an 69:6-8"), ref_chip("Qur’an 7:73"),
              ref_chip("Qur’an 11:82"), ref_chip("Qur’an 7:85"), ref_chip("Qur’an 7:91"),
              ref_chip("Qur’an 17:101"), ref_chip("Qur’an 10:90")))
    return fig(svg, legend, cap)


def fig_signs():
    small = []
    for i in range(6):
        x = 70 + i * 42
        h = 8 + i * 2
        small.append('<path class="s2" d="M%d 230 V %d"/>' % (x, 230 - h))
    great = []
    for i in range(10):
        x = 380 + i * 32
        h = 24 + i * 4
        great.append('<path class="s1" d="M%d 230 V %d"/>'
                     '<circle class="f2" cx="%d" cy="%d" r="4"/>'
                     '<text class="fn" x="%d" y="252">%d</text>'
                     % (x, 230 - h, x, 230 - h, x, i + 1))
    svg = (
        '<svg viewBox="0 0 720 340" class="figsvg" role="img" aria-labelledby="fig-sig-t">'
        '<title id="fig-sig-t">A horizon line with the lesser signs as small marks drawing '
        'near and the ten great signs as larger marks beyond, with no date on any of '
        'them</title>'
        '<path class="s1" d="M28 230 H 692"/>'
        '%s'
        '<text class="fl" x="175" y="286">the lesser signs</text>'
        '<text class="fs" x="175" y="310">many of them already seen</text>'
        '<text class="fk" x="175" y="332">Bukhari 50 · Muslim 8</text>'
        '<path class="s3 dash" d="M330 248 V 118"/>'
        '<text class="fs" x="330" y="80">no date was given</text>'
        '<text class="fk" x="330" y="102">Qur’an 7:187 · 31:34</text>'
        '%s'
        '<text class="fl" x="524" y="132">the ten great signs</text>'
        '<text class="fk" x="524" y="156">Muslim 2901</text>'
        '</svg>' % ("".join(small), "".join(great)))
    legend = [
        "1 · the Smoke", "2 · the Dajjal", "3 · the Beast of the earth",
        "4 · the sun rising from its setting place", "5 · the descent of Isa son of Maryam ﷺ",
        "6 · Yajuj and Majuj", "7 · a sinking of the earth in the east",
        "8 · one in the west", "9 · one in the Peninsula of the Arabs",
        "10 · a fire out of Yemen driving the people to their gathering place",
    ]
    cap = ("The marks are numbered so they can be named, not so they can be ordered. The "
           "transmissions of the hadith arrange the ten differently and the report numbers no "
           "sequence, so this is a map and not a timetable. Of the day itself the Qur’an is "
           "final: none knows its time but Allah, and it comes upon you suddenly. %s %s %s"
           % (ref_chip("Qur’an 7:187"), ref_chip("Qur’an 31:34"), ref_chip("Muslim 2901")))
    return fig(svg, legend, cap)


def fig_myths():
    svg = (
        '<svg viewBox="0 0 720 340" class="figsvg" role="img" aria-labelledby="fig-myth-t">'
        '<title id="fig-myth-t">A balance scale with a popular claim on one pan and the '
        'evidence on the other, the evidence side sinking</title>'
        '<path class="s1" d="M360 268 V 96"/>'
        '<path class="s1" d="M292 286 H 428"/>'
        '<path class="s3" d="M360 268 L 316 286 M360 268 L 404 286"/>'
        '<g class="tipbeam">'
        '<path class="s1" d="M172 96 H 548"/>'
        '<circle class="f2" cx="360" cy="96" r="8"/>'
        '<path class="s2" d="M172 96 V 126 M548 96 V 126"/>'
        '<path class="s1" d="M130 126 H 214 L 198 152 H 146 Z"/>'
        '<path class="s1" d="M506 126 H 590 L 574 152 H 522 Z"/>'
        '</g>'
        '<text class="fl" x="172" y="212">what the people said</text>'
        '<text class="fs" x="172" y="238">a creature of the night desert</text>'
        '<text class="fs" x="172" y="260">that lures travellers off the road</text>'
        '<text class="fl" x="548" y="212">what the Prophet ﷺ said</text>'
        '<text class="fs" x="548" y="238">la ghula, there is no ghoul</text>'
        '<text class="fk" x="548" y="260">Muslim 2222</text>'
        '<text class="fk" x="360" y="322">the pan that holds evidence is the pan that '
        'settles</text>'
        '</svg>')
    legend = [
        "The ghoul: denied outright. A superstition that organised the night fears of a whole "
        "people was cancelled in one clause, and the jinn, established separately in the "
        "Qur’an, are untouched by that denial.",
        "The evil eye: confirmed, and the scale tips the other way. The eye is real, and the "
        "Prophet ﷺ prescribed the cure rather than a charm.",
        "Dragons: the pans stay level. No verse and no authentic hadith establishes them, and "
        "no text declares them impossible either. Silence is the finding, and silence is "
        "reported as silence.",
    ]
    cap = ("One weighing, three outcomes. A claim is not judged by how old it is or how many "
           "people repeat it, but by what stands under it: %s for the ghoul, %s and %s for the "
           "eye, and for dragons a shelf of storytelling with nothing revealed on it."
           % (ref_chip("Muslim 2222"), ref_chip("Bukhari 5740"), ref_chip("Muslim 2188")))
    return fig(svg, legend, cap)


def fig_mysteries():
    svg = (
        '<svg viewBox="0 0 720 340" class="figsvg" role="img" aria-labelledby="fig-mys-t">'
        '<title id="fig-mys-t">A lamp inside a niche throwing light on a small patch of floor '
        'and leaving the rest of the room dark</title>'
        '<rect class="s3" x="24" y="24" width="672" height="282" rx="16"/>'
        '<path class="s3" d="M44 296 H 660"/>'
        '<path class="s1" d="M44 296 V 178 A 52 52 0 0 1 148 178 V 296"/>'
        '<path class="s1" d="M96 126 V 148"/>'
        '<path class="s1" d="M72 156 H 120 L 110 198 H 82 Z"/>'
        '<circle class="halo" cx="96" cy="178" r="32"/>'
        '<circle class="f2" cx="96" cy="178" r="9"/>'
        '<path class="beam" d="M96 194 L 252 296 L 524 296 Z"/>'
        '<path class="s2" d="M96 194 L 252 296 M96 194 L 524 296"/>'
        '<path class="s1" d="M252 296 H 524"/>'
        '<ellipse class="halo" cx="388" cy="296" rx="136" ry="12"/>'
        '<text class="fk" x="388" y="326">what the texts do explain</text>'
        '<text class="fs" x="600" y="118">the how,</text>'
        '<text class="fs" x="600" y="144">the mechanism,</text>'
        '<text class="fs" x="600" y="170">the timing</text>'
        '<text class="fd" x="600" y="202">never given</text>'
        '</svg>')
    legend = [
        "Shooting stars: the heaven is guarded and whoever tries to steal a hearing finds a "
        "piercing flame. What the flame is made of, and what the guarding looks like, is not "
        "described.",
        "Sihr, sorcery: real, forbidden, and powerless except by Allah’s permission. The texts "
        "name it and outlaw it without teaching one line of it.",
        "Dreams: three kinds, from Allah, from the self, and from Shaytan. The sorting of any "
        "particular dream is not handed to us.",
        "Sleep: the souls are taken and the ones not decreed to die are sent back until an "
        "appointed term. How that happens is left in the dark.",
    ]
    cap = ("The picture is borrowed from the parable of light, a niche with a lamp inside it "
           "%s; there the parable is about Allah’s light and His guidance, and here it is "
           "borrowed only as a shape: a small lit floor inside a large dark room. Everything "
           "standing in the light is stated %s %s %s %s. Everything past its edge was simply "
           "not given, and a Muslim is not poorer for saying so."
           % (ref_chip("Qur’an 24:35"), ref_chip("Qur’an 72:8-9"), ref_chip("Qur’an 2:102"),
              ref_chip("Bukhari 7017"), ref_chip("Qur’an 39:42")))
    return fig(svg, legend, cap)


FIGS = {
    "angels": fig_angels,
    "jinn": fig_jinn,
    "peoples": fig_peoples,
    "signs": fig_signs,
    "myth": fig_myths,
    "mysteries": fig_mysteries,
}


# ---------------------------------------------------------------- entries

def evidence_panel(ev):
    rows = []
    for c in ev.get("claims", []):
        rows.append('<div class="cl">%s<span>%s%s</span></div>'
                    % (badge(c.get("level", "editorial"), small=True), esc(c.get("text", "")),
                       refs_row(c.get("refs"))))
    if ev.get("boundary"):
        rows.append('<div class="bound"><b>Boundary of the claim:</b> %s</div>'
                    % esc(ev["boundary"]))
    if ev.get("note"):
        rows.append('<div class="note">%s</div>' % esc(ev["note"]))
    return '<div class="evp"><b>What supports this?</b>%s</div>' % "".join(rows)


def entry_body(e):
    ev = e.get("evidence", {})
    ar = ""
    if e.get("ar"):
        ar = ('<span class="ub-ar font-amiri notranslate" translate="no">%s</span>'
              % esc(e["ar"]))
    paras = "".join("<p>%s</p>" % esc(p) for p in e.get("body", []))
    allrefs = ""
    if e.get("refs"):
        allrefs = ('<div class="ub-src"><b>Every source behind this entry</b>%s</div>'
                   % refs_row(e["refs"]))
    return ('<div class="ub-h">'
            '<span class="ub-top">%s<span class="ut-cat">%s</span></span>'
            '<h2 class="ub-t">%s%s</h2>'
            '<p class="ub-hook">%s</p>'
            '</div>'
            '<div class="ub-p">%s</div>%s%s'
            % (badge(ev.get("level", "editorial")), esc(CAT_LABEL.get(e["cat"], e["cat"])),
               esc(e["title"]), ar, esc(e.get("hook", "")), paras,
               evidence_panel(ev), allrefs))


def tile(e):
    ev = e.get("evidence", {})
    ar = ""
    if e.get("ar"):
        ar = ('<span class="ut-ar font-amiri notranslate" translate="no">%s</span>'
              % esc(e["ar"]))
    return ('<article class="utile mo" id="%s" data-cat="%s">'
            '<button type="button" class="ut-b" data-id="%s" data-t="%s" '
            'aria-haspopup="dialog">'
            '<span class="ut-top">%s<span class="ut-cat">%s</span></span>'
            '<b class="ut-ti">%s</b>%s'
            '<span class="ut-hook">%s</span>'
            '<span class="ut-go">Open the evidence ✦</span>'
            '</button>'
            '<div class="ubody" hidden>%s</div>'
            '</article>'
            % (esc(e["id"]), esc(e["cat"]), esc(e["id"]), esc(e["title"]),
               badge(ev.get("level", "editorial"), small=True),
               esc(CAT_LABEL.get(e["cat"], e["cat"])), esc(e["title"]), ar,
               esc(e.get("hook", "")), entry_body(e)))


def gate(cid, name, ar, translit, desc, count):
    return ('<div class="ugate g-%s mo">'
            '<div class="ug-in">'
            '<div class="ug-l">'
            '<div class="ug-ar font-amiri notranslate" translate="no">%s</div>'
            '<div class="ug-n">%s<span class="ug-tr">%s</span></div>'
            '<div class="ug-d">%s</div>'
            '</div>'
            '<span class="ug-c">%d %s</span>'
            '</div></div>'
            % (esc(cid), esc(ar), esc(name), esc(translit), esc(desc),
               count, "entry" if count == 1 else "entries"))


def category_section(cid, name, ar, translit, desc, entries):
    tiles = "".join(tile(e) for e in entries)
    return ('<section class="rsec ucat" id="sec-%s" data-sec="%s" '
            'aria-label="%s">%s%s<div class="ugrid" data-mo-stagger>%s</div></section>'
            % (esc(cid), esc(cid), esc(name), gate(cid, name, ar, translit, desc, len(entries)),
               FIGS[cid](), tiles))


# ---------------------------------------------------------------- features

def chapter(prefix, ch):
    note = ""
    if ch.get("note"):
        note = '<p class="chp-note">%s</p>' % esc(ch["note"])
    return ('<details class="chp" id="%s-%d">'
            '<summary class="chp-s"><span class="chp-n">%d</span>'
            '<b class="chp-t">%s</b>%s<span class="chp-x" aria-hidden="true"></span></summary>'
            '<div class="chp-b"><p>%s</p>%s%s</div></details>'
            % (prefix, ch["n"], ch["n"], esc(ch["title"]),
               badge(ch.get("level", "editorial"), small=True), esc(ch["body"]), note,
               refs_row(ch.get("refs"), cls="refs chp-r")))


def embers(n=16):
    out = []
    for i in range(n):
        left = (7 + (i * 37) % 88)
        dur = 7.5 + ((i * 13) % 9) * 0.8
        delay = ((i * 29) % 90) / 10.0
        size = 3 + (i % 3)
        out.append('<span class="ember" style="left:%d%%;--t:%.1fs;--d:%.1fs;'
                   'width:%dpx;height:%dpx"></span>' % (left, dur, delay, size, size))
    return '<span class="embers" aria-hidden="true">%s</span>' % "".join(out)


def first_war_section(fw):
    intro = fw["intro"]
    chs = "".join(chapter("fw", c) for c in fw["chapters"])
    return ('<section class="rsec feat" id="firstwar" data-sec="jinn" '
            'aria-label="The First War">'
            '<div class="feat-p ember-p">%s'
            '<div class="feat-in">'
            '<p class="feat-k">The feature story</p>'
            '<div class="feat-ar font-amiri notranslate" translate="no">%s</div>'
            '<h2 class="feat-t">%s</h2>'
            '<p class="feat-s">The earth before us, in six chapters</p>'
            '<p class="feat-l">%s</p>'
            '<p class="feat-h">The anchors are revelation; the battle itself reaches us '
            'through the early community, and every chapter says which is which.</p>'
            '<div class="chps">%s</div>'
            '</div></div></section>'
            % (embers(), esc(intro["ar"]), esc(intro["title"]), esc(intro["lead"]), chs))


def night_journey_section(nj):
    intro = nj["intro"]
    anchor = intro.get("anchor") or {}
    anch = ""
    if anchor:
        anch = ('<p class="feat-a">%s<span class="feat-ax">%s%s</span></p>'
                % (badge(anchor.get("level", "quran"), small=True), esc(anchor.get("text", "")),
                   refs_row(anchor.get("refs"), cls="refs feat-ar-refs")))
    chs = "".join(chapter("nj", c) for c in nj["chapters"])
    return ('<section class="rsec feat" id="nightjourney" data-sec="" '
            'aria-label="The Night Journey">'
            '<div class="feat-p night-p"><span class="stars" aria-hidden="true"></span>'
            '<div class="feat-in">'
            '<p class="feat-k">The crown of the room</p>'
            '<div class="feat-ar font-amiri notranslate" translate="no">%s</div>'
            '<h2 class="feat-t">%s</h2>'
            '<p class="feat-s">One night, twenty seven chapters</p>'
            '<p class="feat-l">%s</p>%s'
            '<p class="feat-h">The ascent through the heavens is narrated in the Sahih '
            'collections, and every chapter below carries its own grade, including the ones '
            'that rest on sira reporting rather than on hadith.</p>'
            '<div class="chps">%s</div>'
            '</div></div></section>'
            % (esc(intro["ar"]), esc(intro["title"]), esc(intro["lead"]), anch, chs))


# ---------------------------------------------------------------- openings

def legend_block():
    rows = "".join('<div class="lg-r">%s<span>%s</span></div>' % (badge(k), esc(v))
                   for k, v in LEGEND_MEANING)
    return ('<section class="rsec" id="how"><article class="card open mo">'
            '<p class="kk">How to read every badge on this page</p>'
            '<p>Nothing in this room is offered on feeling. Each entry, each chapter and each '
            'separate claim inside them carries a badge that tells you exactly what stands '
            'under it, and where the sources stop, the badge says that too. A weak report is '
            'called weak here even when it is beloved.</p>'
            '<div class="lgd">%s</div>'
            '<p class="lg-f">Tap any Qur’an reference on this page to hear the ayah recited.</p>'
            '</article></section>' % rows)


def filter_bar():
    chips = [("all", "Everything")] + [(c[0], c[1]) for c in CATS]
    out = "".join('<button type="button" class="uf%s" data-f="%s" aria-pressed="%s">%s</button>'
                  % (" on" if k == "all" else "", esc(k), "true" if k == "all" else "false",
                     esc(lab))
                  for k, lab in chips)
    return ('<nav class="ufs" id="ufs" aria-label="Filter the Unseen">'
            '<div class="ufs-in">%s</div></nav>' % out)


def closing_band():
    return ('<section class="rsec"><div class="band mo">'
            '<p>This room grows the way the rest of the Codex grows: a claim gets a better '
            'source, a grading gets tightened, a myth gets its correction printed beside it. '
            'If you find something here that the evidence does not carry, write and it will be '
            'fixed.</p>'
            '<div class="bl">'
            '<a class="ghost" href="feedback.html">Send a correction</a>'
            '<a class="gpill" href="donate.html">Keep the lamp lit ✦</a>'
            '</div></div></section>')


def modal_markup():
    return ('<div class="umodal" id="umodal" hidden>'
            '<div class="um-back" data-close></div>'
            '<div class="umw" role="dialog" aria-modal="true" aria-label="Entry">'
            '<span class="um-rule" aria-hidden="true"></span>'
            '<button type="button" class="um-x" data-close aria-label="Close this entry">'
            '<span aria-hidden="true">✕</span></button>'
            '<div class="um-body" id="um-body"></div>'
            '<div class="um-foot"><button type="button" class="um-close2" data-close>'
            'Close this entry</button></div>'
            '</div></div>')


# ---------------------------------------------------------------- css

CSS = """
[hidden]{display:none!important}
html{scroll-behavior:auto}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
.rsec{scroll-margin-top:7rem}

/* the evidence language, kept from the first build of this room */
.ev{display:inline-flex;align-items:center;gap:.38rem;font-size:.62rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;border-radius:999px;padding:.24rem .66rem;border:1px solid;white-space:nowrap}
.ev svg{width:.72rem;height:.72rem;flex:none}
.ev-sm{font-size:.56rem;padding:.2rem .5rem;letter-spacing:.07em}
.ev-quran{color:#3f6f4a;border-color:rgba(63,111,74,.45);background:rgba(122,178,134,.14)}
.ev-sunnah{color:#7a5c10;border-color:rgba(201,162,39,.5);background:rgba(233,200,106,.16)}
.ev-debated{color:#6b5510;border-color:rgba(107,85,16,.4);background:rgba(107,85,16,.07)}
.ev-corrected{color:#8a4a3a;border-color:rgba(178,102,84,.5);background:rgba(201,107,90,.12)}
.ev-mixed{color:#4a4437;border-color:rgba(74,68,55,.35);background:rgba(74,68,55,.06)}
.ev-editorial{color:#5a5f6e;border-color:rgba(90,95,110,.35);background:rgba(90,95,110,.07)}
.evp{margin-top:1rem;background:#FBF7EA;border:1px solid rgba(160,130,50,.3);border-radius:14px;padding:.85rem .95rem}
.evp>b{font-size:.62rem;letter-spacing:.18em;text-transform:uppercase;color:#8a6d1a}
.evp .cl{display:flex;gap:.55rem;align-items:flex-start;padding:.55rem 0;border-top:1px solid rgba(160,130,50,.14);font-size:.79rem;line-height:1.7;color:rgba(44,36,22,.82)}
.evp .cl:first-of-type{border-top:0;margin-top:.35rem}
.evp .cl .ev{flex:none;margin-top:.15rem}
.evp .bound{margin-top:.6rem;font-size:.74rem;line-height:1.7;color:#8a4a3a;background:rgba(201,107,90,.07);border-radius:9px;padding:.55rem .7rem}
.evp .note{margin-top:.5rem;font-size:.74rem;line-height:1.7;color:rgba(44,36,22,.6);font-style:italic}
.refs{display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.45rem}
.ref{font-size:.66rem;font-weight:600;color:rgba(44,36,22,.55);background:rgba(44,36,22,.05);border-radius:999px;padding:.22rem .55rem;border:1px solid rgba(44,36,22,.1);white-space:nowrap}
.ref b{color:#8a6d13;font-weight:800}
.vplay{cursor:pointer;border:1px solid rgba(201,162,39,.45);background:rgba(244,212,106,.14);color:#8a6d13;border-radius:999px;padding:.22rem .58rem;font-size:.66rem;font-weight:800;font-family:inherit;white-space:nowrap;transition:background .18s,color .18s,transform .15s}
.vplay:hover{background:rgba(244,212,106,.34);transform:translateY(-1px)}
.vplay.playing{background:#2C2416;color:#F4D46A;border-color:#2C2416}

/* the opening card and the legend strip */
.open{margin-top:1.6rem;border-color:rgba(201,162,39,.3);box-shadow:0 8px 30px rgba(44,36,22,.07)}
.open .kk{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .6rem}
.lgd{display:grid;grid-template-columns:1fr 1fr;gap:.55rem 1rem;margin-top:1rem;padding-top:.95rem;border-top:1px solid rgba(44,36,22,.1)}
.lg-r{display:flex;align-items:flex-start;gap:.5rem;font-size:.73rem;color:rgba(44,36,22,.6);line-height:1.6}
.lg-r .ev{flex:0 0 auto;margin-top:.05rem}
.lg-f{font-size:.71rem;color:rgba(44,36,22,.45);margin:.9rem 0 0;font-weight:600}
@media (max-width:620px){.lgd{grid-template-columns:1fr}}

/* the filter rail */
.ufs{position:sticky;top:3.5rem;z-index:30;background:rgba(255,254,247,.93);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid rgba(44,36,22,.08);margin-top:1.6rem}
.ufs-in{display:flex;gap:.38rem;align-items:center;max-width:62rem;margin:0 auto;padding:.55rem 1rem;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}
.ufs-in::-webkit-scrollbar{display:none}
.uf{flex:0 0 auto;font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(44,36,22,.55);border:1px solid rgba(44,36,22,.13);border-radius:999px;padding:.34rem .72rem;background:#fff;cursor:pointer;font-family:inherit;white-space:nowrap;transition:color .2s,border-color .2s,background .2s,box-shadow .2s}
.uf:hover{color:#2C2416;border-color:rgba(201,162,39,.5)}
.uf.on{color:#1A160F;background:linear-gradient(135deg,#C9A227,#E9C86A);border-color:transparent;box-shadow:0 2px 12px rgba(201,162,39,.3)}

/* the section gates */
.ugate{position:relative;overflow:hidden;border-radius:20px;color:#FFFEF7;padding:1.5rem 1.4rem;margin-top:1.4rem;isolation:isolate}
.ugate::after{content:"";position:absolute;inset:10px;border:1px solid rgba(255,254,247,.16);border-radius:14px;pointer-events:none}
.ug-in{position:relative;z-index:2;display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.ug-ar{font-size:1.9rem;line-height:1.35;color:#F4D46A;text-shadow:0 2px 18px rgba(0,0,0,.35)}
.ug-n{font-size:1.02rem;font-weight:800;margin-top:.1rem}
.ug-tr{display:block;font-size:.66rem;font-weight:600;letter-spacing:.02em;color:rgba(255,254,247,.5);margin-top:.15rem}
.ug-d{font-size:.79rem;color:rgba(255,254,247,.66);line-height:1.7;margin-top:.45rem;max-width:34rem}
.ug-c{background:rgba(255,254,247,.12);border:1px solid rgba(255,254,247,.24);border-radius:999px;padding:.3rem .8rem;font-size:.68rem;font-weight:800;white-space:nowrap}
.g-angels{background:radial-gradient(120% 130% at 18% 0%,rgba(233,200,106,.34),transparent 52%),linear-gradient(140deg,#2C2416,#4A3A1E 60%,#2C2416)}
.g-jinn{background:radial-gradient(120% 130% at 30% 0%,rgba(146,64,14,.44),transparent 55%),linear-gradient(140deg,#1C1917,#2E1D12 60%,#1C1917)}
.g-peoples{background:radial-gradient(120% 130% at 74% 0%,rgba(160,140,96,.32),transparent 55%),linear-gradient(140deg,#1F1B16,#382E22 62%,#1F1B16)}
.g-signs{background:radial-gradient(1.4px 1.4px at 12% 30%,rgba(255,253,242,.8),transparent 55%),radial-gradient(1.2px 1.2px at 34% 14%,rgba(255,253,242,.7),transparent 55%),radial-gradient(1.6px 1.6px at 58% 38%,rgba(255,253,242,.62),transparent 55%),radial-gradient(1.2px 1.2px at 78% 18%,rgba(255,253,242,.75),transparent 55%),radial-gradient(130% 150% at 50% -18%,rgba(124,58,237,.3),transparent 58%),linear-gradient(150deg,#0B0912,#1A1030 70%,#0B0912)}
.g-myth{background:radial-gradient(120% 130% at 22% 0%,rgba(96,132,214,.26),transparent 55%),linear-gradient(140deg,#14181F,#232C3A 62%,#14181F)}
.g-mysteries{background:radial-gradient(120% 140% at 50% -10%,rgba(96,132,214,.35),transparent 55%),linear-gradient(140deg,#141B2E,#1E3A8A 130%)}

/* the tiles */
.ugrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(15.5rem,1fr));gap:.85rem;margin-top:1.1rem}
.utile{position:relative}
.ut-b{display:flex;flex-direction:column;align-items:flex-start;gap:.1rem;width:100%;height:100%;text-align:start;background:#fff;border:1px solid rgba(44,36,22,.12);border-radius:18px;padding:1rem 1.05rem 1.05rem;cursor:pointer;font-family:inherit;color:inherit;box-shadow:0 2px 10px rgba(44,36,22,.04);transition:transform .18s,box-shadow .18s,border-color .18s}
.ut-b:hover{transform:translateY(-2px);border-color:rgba(201,162,39,.55);box-shadow:0 14px 30px rgba(60,48,20,.1)}
.ut-b:focus-visible{outline:2px solid #8a6d13;outline-offset:3px}
.ut-top{display:flex;align-items:center;justify-content:space-between;gap:.5rem;width:100%;flex-wrap:wrap}
.ut-cat{font-size:.56rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(44,36,22,.42);font-weight:800}
.ut-ti{display:block;font-size:.97rem;font-weight:800;line-height:1.4;margin-top:.6rem;letter-spacing:-.01em}
.ut-ar{display:block;color:#8a6d13;font-size:1.05rem;line-height:1.7;margin-top:.15rem}
.ut-hook{display:block;font-size:.77rem;color:rgba(44,36,22,.6);line-height:1.65;margin-top:.4rem}
.ut-go{display:block;margin-top:auto;padding-top:.85rem;font-size:.58rem;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#8a6d13}
.ubody{display:none}

/* the modal */
.umodal{position:fixed;inset:0;z-index:60;display:flex;align-items:flex-start;justify-content:center;padding:1.4rem 1rem 2rem;overflow-y:auto;overscroll-behavior:contain}
.um-back{position:fixed;inset:0;background:radial-gradient(120% 100% at 50% 0%,rgba(30,24,12,.55),rgba(12,10,6,.84));backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.umw{position:relative;width:100%;max-width:44rem;background:#FFFEF7;border-radius:22px;box-shadow:0 40px 90px rgba(20,16,10,.45);padding:1.9rem 1.6rem 1.4rem;animation:umin .3s ease}
@keyframes umin{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.umw{animation:none}}
.um-rule{position:absolute;top:0;left:0;right:0;height:8px;border-radius:22px 22px 0 0;background:repeating-linear-gradient(90deg,rgba(201,162,39,.9) 0 14px,rgba(30,58,138,.75) 14px 18px,rgba(201,162,39,.9) 18px 32px,rgba(139,168,136,.8) 32px 36px)}
.um-x{position:absolute;top:1.05rem;right:1rem;width:2.1rem;height:2.1rem;border-radius:999px;border:1px solid rgba(44,36,22,.14);background:#fff;color:rgba(44,36,22,.6);font-size:.85rem;cursor:pointer;font-family:inherit;line-height:1}
.um-x:hover{background:#2C2416;color:#F4D46A;border-color:#2C2416}
.um-foot{margin-top:1.2rem;padding-top:.9rem;border-top:1px solid rgba(44,36,22,.1);text-align:center}
.um-close2{background:none;border:0;font-family:inherit;font-size:.75rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8a6d13;cursor:pointer;padding:.35rem .6rem}
.um-close2:hover{text-decoration:underline}
body.um-open{overflow:hidden}
.ub-top{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;padding-inline-end:2.4rem}
.ub-t{font-size:1.25rem;font-weight:800;line-height:1.35;margin:.7rem 0 0;letter-spacing:-.01em}
.ub-ar{color:#8a6d13;font-size:1.25rem;margin-inline-start:.5rem}
.ub-hook{font-size:.82rem;color:rgba(44,36,22,.6);line-height:1.7;margin:.5rem 0 0}
.ub-p{margin-top:1rem}
.ub-p p{font-size:.87rem;line-height:1.95;color:rgba(44,36,22,.84);margin:0 0 .9rem}
.ub-p p:last-child{margin-bottom:0}
.ub-src{margin-top:.95rem;border-top:1px solid rgba(44,36,22,.1);padding-top:.8rem}
.ub-src>b{display:block;font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:rgba(44,36,22,.45);margin-bottom:.1rem}
@media (max-width:620px){.umodal{padding:0}.umw{border-radius:20px 20px 0 0;margin-top:3rem;min-height:calc(100vh - 3rem);padding:1.9rem 1.15rem 1.4rem}}

/* the figures */
.fig{max-width:46rem;margin-left:auto;margin-right:auto;padding:1.2rem 1.15rem}
.figsvg{width:100%;height:auto;display:block;overflow:visible}
.figsvg text{text-anchor:middle;font-family:Inter,system-ui,sans-serif}
.figsvg .fl{font-size:21px;font-weight:700;fill:#FFFEF7}
.figsvg .fs{font-size:17px;fill:rgba(255,254,247,.6)}
.figsvg .fk{font-size:16px;font-weight:700;fill:rgba(244,212,106,.82)}
.figsvg .fn{font-size:13px;font-weight:700;fill:rgba(255,254,247,.45)}
.figsvg .fd{font-size:15px;font-weight:700;fill:rgba(255,254,247,.32);letter-spacing:.14em;text-transform:uppercase}
.figsvg .s1{fill:none;stroke:#E9C86A;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.figsvg .s2{fill:none;stroke:rgba(255,254,247,.6);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.figsvg .s3{fill:none;stroke:rgba(244,212,106,.34);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.figsvg .dash{stroke-dasharray:7 7}
.figsvg .f2{fill:#F4D46A;stroke:none}
.figsvg .halo{fill:rgba(244,212,106,.14);stroke:none}
.figsvg .beam{fill:rgba(244,212,106,.1);stroke:none}
.figsvg .colglow{fill:rgba(244,212,106,.09);stroke:none}
.figsvg text.fl,.figsvg text.fs,.figsvg text.fk{paint-order:stroke}
.tl text.fl,.tl text.fs,.tl text.fk{text-anchor:middle}
.figsvg .fl,.figsvg .fs,.figsvg .fk,.figsvg .fn,.figsvg .fd{stroke:none}
#sec-angels .figsvg text{text-anchor:start}
.leg{list-style:none;margin:1.1rem 0 0;padding:0;display:grid;gap:.45rem}
.leg2{grid-template-columns:1fr 1fr}
@media (max-width:640px){.leg2{grid-template-columns:1fr}}
.leg li{position:relative;padding-inline-start:1rem;font-size:.75rem;line-height:1.7;color:rgba(255,254,247,.66)}
.leg li::before{content:"";position:absolute;inset-inline-start:0;top:.62rem;width:.36rem;height:.36rem;border-radius:50%;background:#E9C86A}
.fig .cap{font-size:.75rem;line-height:1.8;text-align:start;margin-top:1rem;color:rgba(255,254,247,.6)}
.fig .cap .vplay{background:rgba(244,212,106,.14);border-color:rgba(244,212,106,.42);color:#F4D46A;margin:.15rem .1rem}
.fig .cap .vplay:hover{background:rgba(244,212,106,.3);color:#FFF7DF}
.fig .cap .ref{background:rgba(255,254,247,.07);border-color:rgba(255,254,247,.16);color:rgba(255,254,247,.6)}
.fig .cap .ref b{color:rgba(244,212,106,.85)}
@media (prefers-reduced-motion:no-preference){
.tipbeam{transform-box:view-box;transform-origin:360px 96px;animation:utip 2.6s 1s cubic-bezier(.34,1.3,.64,1) both}
@keyframes utip{from{transform:rotate(0)}to{transform:rotate(7deg)}}
.figsvg .halo{animation:uglow 4.6s ease-in-out infinite}
@keyframes uglow{0%,100%{opacity:.55}50%{opacity:1}}
}
@media (prefers-reduced-motion:reduce){.tipbeam{transform-box:view-box;transform-origin:360px 96px;transform:rotate(7deg)}}

/* the two features */
.feat{padding-top:3rem}
.feat-p{position:relative;overflow:hidden;border-radius:24px;color:#FFFEF7;padding:2.2rem 1.3rem 1.9rem}
.ember-p{background:radial-gradient(130% 120% at 50% 110%,rgba(201,88,20,.35),transparent 58%),linear-gradient(178deg,#14100A,#2a1d10)}
.night-p{background:radial-gradient(130% 130% at 50% -10%,rgba(96,132,214,.28),transparent 58%),linear-gradient(178deg,#14100A,#151b2e 55%,#1d2a45)}
.feat-in{position:relative;z-index:2;max-width:40rem;margin:0 auto}
.feat-k{font-size:.6rem;letter-spacing:.22em;text-transform:uppercase;font-weight:800;color:rgba(244,212,106,.8);text-align:center;margin:0}
.feat-ar{font-size:1.7rem;color:#F4D46A;text-align:center;margin-top:.4rem;line-height:1.5;filter:drop-shadow(0 0 16px rgba(244,212,106,.4))}
.feat-t{font-size:1.5rem;font-weight:800;text-align:center;margin:.2rem 0 0}
.feat-s{font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:rgba(255,254,247,.45);text-align:center;margin:.4rem 0 0}
.feat-l{font-size:.83rem;line-height:1.9;color:rgba(255,254,247,.76);margin:1rem auto 0;max-width:36rem}
.feat-h{font-size:.72rem;line-height:1.75;color:rgba(255,254,247,.5);text-align:center;margin:.9rem auto 0;max-width:34rem}
.feat-a{display:flex;gap:.55rem;align-items:flex-start;justify-content:center;flex-wrap:wrap;margin:1rem auto 0;max-width:34rem;background:rgba(255,254,247,.05);border:1px solid rgba(244,212,106,.24);border-radius:14px;padding:.7rem .85rem}
.feat-ax{font-size:.74rem;line-height:1.7;color:rgba(255,254,247,.72);flex:1;min-width:14rem}
.feat-a .refs{margin-top:.4rem}
.feat-a .ref,.feat-a .vplay{background:rgba(244,212,106,.12);border-color:rgba(244,212,106,.4);color:#F4D46A}
.feat-a .ref b{color:#F4D46A}
.embers{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.ember{position:absolute;bottom:-10px;border-radius:50%;background:radial-gradient(circle,#F4D46A 0%,rgba(244,212,106,0) 70%);opacity:0}
@media (prefers-reduced-motion:no-preference){.ember{animation:uember var(--t) linear infinite;animation-delay:var(--d)}}
@keyframes uember{0%{opacity:0;transform:translateY(0) scale(.5)}14%{opacity:.85}100%{opacity:0;transform:translateY(-320px) scale(1.15)}}
.stars{position:absolute;inset:0;pointer-events:none;background:radial-gradient(1.4px 1.4px at 14% 22%,rgba(255,253,242,.75),transparent 55%),radial-gradient(1.2px 1.2px at 32% 62%,rgba(255,253,242,.6),transparent 55%),radial-gradient(1.5px 1.5px at 58% 18%,rgba(255,253,242,.7),transparent 55%),radial-gradient(1.2px 1.2px at 76% 48%,rgba(255,253,242,.55),transparent 55%),radial-gradient(1.4px 1.4px at 88% 26%,rgba(255,253,242,.65),transparent 55%)}
.chps{margin-top:1.4rem;display:grid;gap:.5rem}
.chp{background:rgba(255,254,247,.05);border:1px solid rgba(244,212,106,.24);border-radius:14px;overflow:hidden}
.chp[open]{border-color:rgba(244,212,106,.6);background:rgba(255,254,247,.07)}
.chp-s{list-style:none;cursor:pointer;padding:.75rem .9rem;display:flex;align-items:center;gap:.7rem;flex-wrap:wrap}
.chp-s::-webkit-details-marker{display:none}
.chp-n{width:1.75rem;height:1.75rem;border-radius:999px;background:linear-gradient(135deg,#C9A227,#E9C86A);color:#1A160F;font-weight:800;font-size:.72rem;display:grid;place-items:center;flex:none}
.chp-t{flex:1;font-size:.88rem;min-width:9rem;line-height:1.5}
.chp-x{width:.5rem;height:.5rem;border-inline-end:1.6px solid rgba(244,212,106,.7);border-bottom:1.6px solid rgba(244,212,106,.7);transform:rotate(45deg);transition:transform .25s;flex:none;margin-inline-start:auto}
.chp[open] .chp-x{transform:rotate(225deg)}
.chp-b{padding:0 .95rem 1rem}
.chp-b p{font-size:.83rem;line-height:1.95;color:rgba(255,254,247,.84);margin:0}
.chp-note{font-style:italic;color:rgba(255,254,247,.58)!important;font-size:.75rem!important;margin-top:.7rem!important;line-height:1.75!important;border-inline-start:2px solid rgba(244,212,106,.35);padding-inline-start:.7rem}
.chp-r{margin-top:.75rem}
.chp-r .ref{background:rgba(255,254,247,.07);border-color:rgba(255,254,247,.16);color:rgba(255,254,247,.6)}
.chp-r .ref b{color:rgba(244,212,106,.85)}
.chp-r .vplay{background:rgba(244,212,106,.14);border-color:rgba(244,212,106,.42);color:#F4D46A}
.chp-r .vplay:hover{background:rgba(244,212,106,.32);color:#FFF7DF}
.chp .ev{background:rgba(255,254,247,.06)}
.chp .ev-quran{color:#a7d3a2;border-color:rgba(167,211,162,.5)}
.chp .ev-sunnah{color:#F4D46A;border-color:rgba(244,212,106,.5)}
.chp .ev-debated{color:#d9c9a0;border-color:rgba(217,201,160,.45)}
.chp .ev-mixed{color:#cfc6b4;border-color:rgba(207,198,180,.4)}
.chp .ev-corrected{color:#e0a08e;border-color:rgba(224,160,142,.45)}
.chp .ev-editorial{color:#b9bdc7;border-color:rgba(185,189,199,.35)}
.feat-a .ev-quran{color:#a7d3a2;border-color:rgba(167,211,162,.5);background:rgba(122,178,134,.12)}

/* the closing band */
.band{margin:2.6rem 0 .5rem;text-align:center;background:linear-gradient(170deg,#FFFDF3,#FFF6DB);border:1px solid rgba(201,162,39,.26);border-radius:20px;padding:1.6rem 1.2rem}
.band p{font-size:.82rem;color:rgba(44,36,22,.62);line-height:1.85;margin:0 auto .95rem;max-width:32rem}
.band .bl{display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap}
"""


# ---------------------------------------------------------------- js

JS = """<script>
(function(){
"use strict";
var doc=document;

/* every Qur’an reference on this page, wherever it sits, plays the ayah */
doc.addEventListener("click",function(e){
  var t=e.target;
  if(!t||!t.closest)return;
  var v=t.closest(".vplay");
  if(v){e.preventDefault();if(window.playAyah)window.playAyah(v.getAttribute("data-ref"),v);return;}
  var b=t.closest(".ut-b");
  if(b){e.preventDefault();openEntry(b.getAttribute("data-id"));return;}
  if(t.closest("[data-close]")){e.preventDefault();closeEntry();return;}
});

/* the chips filter the tiles, gate by gate */
var chips=[].slice.call(doc.querySelectorAll(".uf"));
var secs=[].slice.call(doc.querySelectorAll("[data-sec]"));
var tiles=[].slice.call(doc.querySelectorAll(".utile"));
function setFilter(f){
  chips.forEach(function(c){
    var on=c.getAttribute("data-f")===f;
    if(on){c.classList.add("on");}else{c.classList.remove("on");}
    c.setAttribute("aria-pressed",on?"true":"false");
  });
  tiles.forEach(function(t){t.hidden=!(f==="all"||t.getAttribute("data-cat")===f);});
  secs.forEach(function(s){
    var own=s.getAttribute("data-sec");
    s.hidden=!(f==="all"||(own&&own===f));
  });
  /* the room just changed height: let the motion engine reveal what is now in view */
  if(window.ScrollTrigger&&window.ScrollTrigger.refresh)window.ScrollTrigger.refresh();
}
chips.forEach(function(c){
  c.addEventListener("click",function(){setFilter(c.getAttribute("data-f"));});
});

/* the tiles open into one modal, with the claim panels intact */
var um=doc.getElementById("umodal");
var umw=um?um.querySelector(".umw"):null;
var ub=doc.getElementById("um-body");
var lastFocus=null;
function openEntry(id){
  if(!um||!ub||!id)return false;
  var art=doc.getElementById(id);
  if(!art||!art.classList||!art.classList.contains("utile"))return false;
  var src=art.querySelector(".ubody");
  if(!src)return false;
  ub.innerHTML=src.innerHTML;
  var btn=art.querySelector(".ut-b");
  if(umw&&btn)umw.setAttribute("aria-label",btn.getAttribute("data-t")||"Entry");
  lastFocus=doc.activeElement;
  um.hidden=false;
  doc.body.classList.add("um-open");
  um.scrollTop=0;
  var x=um.querySelector(".um-x");
  if(x)x.focus();
  try{history.replaceState(null,"","#"+id);}catch(err){}
  return true;
}
function closeEntry(keepUrl){
  if(!um||um.hidden)return;
  um.hidden=true;
  doc.body.classList.remove("um-open");
  if(window.stopAyah)window.stopAyah();
  if(ub)ub.innerHTML="";
  if(!keepUrl){try{history.replaceState(null,"",location.pathname+location.search);}catch(err){}}
  if(lastFocus&&lastFocus.focus)lastFocus.focus();
  lastFocus=null;
}
doc.addEventListener("keydown",function(e){
  if(!um||um.hidden)return;
  if(e.key==="Escape"){e.preventDefault();closeEntry();return;}
  if(e.key!=="Tab"||!umw)return;
  var f=umw.querySelectorAll("button, [href], input, select, textarea, summary, [tabindex]:not([tabindex='-1'])");
  if(!f.length)return;
  var first=f[0], last=f[f.length-1];
  if(e.shiftKey&&doc.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first.focus();}
});

/* deep links: a hash opens its entry, or its chapter */
function fromHash(){
  var h=(location.hash||"").slice(1);
  if(!h)return;
  var el=null;
  try{el=doc.getElementById(decodeURIComponent(h));}catch(err){el=doc.getElementById(h);}
  if(!el)return;
  if(el.classList&&el.classList.contains("utile")){
    setFilter("all");
    openEntry(el.id);
    return;
  }
  if(el.tagName==="DETAILS"){
    el.open=true;
    setTimeout(function(){el.scrollIntoView({block:"center"});},260);
  }
}
window.addEventListener("hashchange",function(){
  if(um&&!um.hidden)closeEntry(true);
  fromHash();
});
fromHash();
})();
</script>"""


# ---------------------------------------------------------------- build

JSONLD = ('<script type="application/ld+json">'
          '{"@context":"https://schema.org","@type":"CollectionPage",'
          '"name":"The Unseen and the Mysteries","url":"https://noorcodex.com/unseen",'
          '"description":"An evidence first library of the unseen in Islam: angels, jinn, '
          'previous peoples, signs of the Hour, corrected myths and explained mysteries.",'
          '"isPartOf":{"@id":"https://noorcodex.com/#site"}}</script>')


def build():
    entries = load_entries()
    fw = json.load(open(FIRST_WAR, encoding="utf-8"))
    nj = json.load(open(NIGHT_JOURNEY, encoding="utf-8"))

    by_cat = {}
    for e in entries:
        by_cat.setdefault(e["cat"], []).append(e)
    missing = [c[0] for c in CATS if c[0] not in by_cat]
    if missing:
        raise SystemExit("no entries for category: " + ", ".join(missing))
    extra = [c for c in by_cat if c not in CAT_LABEL]
    if extra:
        raise SystemExit("unknown category in the data: " + ", ".join(extra))

    parts = ['<div class="wrapw">', legend_block(), '</div>', filter_bar(),
             '<div class="wrapw">']
    for cid, name, ar, translit, desc in CATS:
        parts.append(category_section(cid, name, ar, translit, desc, by_cat[cid]))
        if cid == "jinn":
            parts.append(first_war_section(fw))
    parts.append(night_journey_section(nj))
    parts.append(closing_band())
    parts.append('</div>')
    parts.append(modal_markup())
    main = "".join(parts)

    html = shell(
        slug="unseen",
        title="The Unseen &amp; the Mysteries",
        desc=("The Unseen, with evidence: angels, jinn, the previous peoples, the signs of the "
              "Hour, myths the Prophet ﷺ corrected, and mysteries explained. Every claim "
              "badged: Qur’an-confirmed, Sunnah-confirmed, scholars differ, or corrected."),
        ar="الْغَيْب",
        kick="The Unseen and the Mysteries",
        h1="Everything hidden, with its evidence in the open",
        lead=("Al-ghayb, the unseen, is what Allah kept out of sight and told us about anyway: "
              "the angels who are with you now, the jinn who were here first, the nations "
              "already judged, and the promises still ahead. Every claim in this room wears a "
              "badge that says exactly what stands under it, and where the sources stop, the "
              "room stops with them."),
        main=main,
        css=CSS,
        jsonld=JSONLD,
        extra_js=JS,
        footline="The Unseen is free forever, like every room in the Codex.",
    )

    open(OUT, "w", encoding="utf-8").write(html)

    ids = [e["id"] for e in entries]
    missing_ids = [i for i in ids if ('id="%s"' % i) not in html]
    if missing_ids:
        raise SystemExit("entries missing from the page: " + ", ".join(missing_ids))
    figs = html.count('class="fig mo-draw"')
    fwc = html.count('id="fw-')
    njc = html.count('id="nj-')
    print("unseen.html written: %d bytes" % len(html.encode("utf-8")))
    print("  entries %d · sections %d · figures %d" % (len(ids), len(CATS), figs))
    print("  first war chapters %d · night journey chapters %d" % (fwc, njc))
    print("  play buttons %d · claim panels %d"
          % (html.count('class="vplay"'), html.count('class="evp"')))
    if figs != 6 or fwc != len(fw["chapters"]) or njc != len(nj["chapters"]):
        raise SystemExit("count check failed")



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
    _synergy("unseen.html")
