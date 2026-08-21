# NOOR v49 · heroes.html
# Two halls in one room: the Torchbearers (30 lives, 6 eras) and the Gifts
# (30 contributions, 8 fields), joined by a scrollable century ribbon.
# Reads build/heroes.json + build/contributions.json, writes /heroes.html.
#
#   python3 scripts/gen-heroes.py
#
import json, math, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from room import shell

# ----------------------------------------------------------------- helpers

def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")).strip()


def att(s):
    return esc(s).replace('"', "&quot;")


def teaser(text, n=28):
    words = esc(text).split()
    if len(words) <= n:
        return " ".join(words)
    return " ".join(words[:n]).rstrip(",;:.") + "…"


def slug(s):
    """The key a gift's figure is filed under: its own title, plainly folded."""
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")


def year_of(dates):
    """A representative year for the ribbon: the middle of the recorded life."""
    nums = [int(x) for x in re.findall(r"\b(\d{3,4})\b", dates)]
    if not nums:
        return None
    if len(nums) == 1:
        return nums[0]
    return int(round((nums[0] + nums[-1]) / 2.0))


def era_start(years):
    nums = [int(x) for x in re.findall(r"\b(\d{3,4})\b", years)]
    return nums[0] if nums else None


def she(person):
    return person.get("light", "").strip().lower().startswith("she")


LEVELS = {
    "solid": ("quran", "Documented"),
    "traced": ("sunnah", "Traced"),
    "legend": ("debated", "Beloved story"),
}

ICONS = {"tower": "minaret"}  # the house registry has no tower; a minaret is its cousin

# Short labels for the ribbon readout only. Display shorthand, never a rename.
SHORT = {
    "uwais-al-qarani": "Uwais", "hasan-al-basri": "Hasan al-Basri",
    "umar-ibn-abd-al-aziz": "Umar ibn Abd al-Aziz", "rabia-al-adawiyya": "Rabi’a",
    "abu-hanifa": "Abu Hanifa", "malik-ibn-anas": "Malik", "ash-shafii": "Ash-Shafi’i",
    "ahmad-ibn-hanbal": "Ahmad ibn Hanbal", "al-bukhari": "Al-Bukhari",
    "fatima-al-fihri": "Fatima al-Fihri", "karima-al-marwaziyya": "Karima",
    "al-ghazali": "Al-Ghazali", "nur-ad-din-zangi": "Nur ad-Din", "salah-ad-din": "Salah ad-Din",
    "an-nawawi": "An-Nawawi", "mansa-musa": "Mansa Musa", "ahmad-baba": "Ahmad Baba",
    "zaynab-bint-al-kamal": "Zaynab", "mimar-sinan": "Sinan", "shah-wali-allah": "Shah Wali Allah",
    "nana-asmau": "Nana Asma’u", "emir-abdelkader": "Abdelkader", "imam-shamil": "Shamil",
    "omar-ibn-said": "Omar ibn Said", "said-nursi": "Said Nursi", "malcolm-x": "Malcolm X",
    "abdul-sattar-edhi": "Edhi", "muhammad-ali": "Muhammad Ali",
    "fazlur-rahman-khan": "F. R. Khan", "ahmed-zewail": "Zewail",
}

# ----------------------------------------------------------------- data

eras = json.load(open(os.path.join(ROOT, "build", "heroes.json"), encoding="utf-8"))["eras"]
fields = json.load(open(os.path.join(ROOT, "build", "contributions.json"), encoding="utf-8"))["fields"]

PEOPLE = [(e, p) for e in eras for p in e["people"]]
N_PEOPLE = len(PEOPLE)
N_GIFTS = sum(len(f["gifts"]) for f in fields)

# ----------------------------------------------------------------- the ribbon

AX_MIN, AX_MAX = 640, 2000
TRACK = 2240          # px, the scrollable width of the ribbon track
PAD = 44              # px of breathing room at each end
SPAN = TRACK - PAD * 2
PPY = SPAN / float(AX_MAX - AX_MIN)
MINGAP = 29           # px, smallest distance between two dots on the same rail


def x_of(year):
    return PAD + (max(AX_MIN, min(AX_MAX, year)) - AX_MIN) * PPY


def build_ribbon():
    dots = []
    for e, p in PEOPLE:
        y = year_of(p.get("dates", ""))
        if y is None:
            continue
        dots.append({"era": e["id"], "p": p, "y": y, "x": x_of(y)})
    dots.sort(key=lambda d: d["y"])
    for i, d in enumerate(dots):
        d["rail"] = i % 2
    # keep dots on the same rail from touching: nudge right, then pull back inside
    for rail in (0, 1):
        row = [d for d in dots if d["rail"] == rail]
        for i in range(1, len(row)):
            if row[i]["x"] - row[i - 1]["x"] < MINGAP:
                row[i]["x"] = row[i - 1]["x"] + MINGAP
        for i in range(len(row) - 2, -1, -1):
            if row[i + 1]["x"] - row[i]["x"] < MINGAP:
                row[i]["x"] = row[i + 1]["x"] - MINGAP
        for d in row:
            d["x"] = max(PAD * 0.5, min(TRACK - PAD * 0.5, d["x"]))

    starts = [era_start(e["years"]) or AX_MIN for e in eras]
    bands = []
    n_eras = len(eras)
    for i, e in enumerate(eras):
        a = AX_MIN if i == 0 else max(AX_MIN, starts[i])
        b = starts[i + 1] if i + 1 < len(eras) else AX_MAX
        left = x_of(a)
        # Era names ride two alternating rows, matching the two band tints, so a
        # short era never has to write across its neighbour. Each label is also
        # capped to the clear space before the NEXT label on its own row, which
        # makes collision impossible at any width, any scroll position, and any
        # font: if a name ever outgrew its room it would clip, never overlap.
        row = i % 2
        nxt = x_of(max(AX_MIN, starts[i + 2])) if i + 2 < n_eras else float(TRACK)
        cap = max(36.0, nxt - left - 14.0)
        bands.append('<div class="rib-band b%d" style="left:%.1fpx;width:%.1fpx">'
                     '<span class="rb-t r%d" style="max-width:%.0fpx">%s</span></div>'
                     % (row, left, max(8.0, x_of(b) - left), row, cap, esc(e["title"])))

    ticks, labels = [], []
    y = 700
    while y <= AX_MAX:
        xx = x_of(y)
        ticks.append('<line x1="%.1f" y1="120" x2="%.1f" y2="129"/>' % (xx, xx))
        labels.append('<span class="rib-yr" style="left:%.1fpx">%d</span>' % (xx, y))
        y += 100

    marks = []
    for d in dots:
        p = d["p"]
        lab = "%s, %s" % (esc(p["name"]), esc(p["dates"]))
        marks.append(
            '<button type="button" class="rdot r%d" style="left:%.1fpx" data-go="%s" '
            'data-lab="%s" aria-label="%s, open this life"><span class="rd-stem"></span>'
            '<span class="rd-eye"></span></button>'
            % (d["rail"], d["x"], att(p["id"]), att(SHORT.get(p["id"], p["name"]) + ", " + p["dates"]),
               att(p["name"] + ", " + p["dates"])))

    axis = ('<svg class="rib-axis" width="%d" height="240" viewBox="0 0 %d 240" '
            'aria-hidden="true" focusable="false">'
            '<line x1="%d" y1="120" x2="%d" y2="120"/>%s</svg>'
            % (TRACK, TRACK, int(PAD * 0.6), int(TRACK - PAD * 0.6), "".join(ticks)))

    return ('<div class="ribbon mo-draw">'
            '<div class="rib-scroll" id="rib-scroll" tabindex="0" role="group" '
            'aria-label="Timeline ribbon, thirty lives from the 600s to today">'
            '<div class="rib-track" style="width:%dpx">%s%s%s%s</div></div>'
            '<span class="rib-fade rf-l" aria-hidden="true"></span>'
            '<span class="rib-fade rf-r" aria-hidden="true"></span></div>'
            % (TRACK, "".join(bands), axis, "".join(labels), "".join(marks)))


# ----------------------------------------------------------------- figures

FIG_ROAD = """<div class="fig mo-draw">
<svg viewBox="0 0 660 216" class="figsvg" role="img" aria-labelledby="figroad-t">
<title id="figroad-t">A drawn road carrying knowledge from Baghdad through Toledo and Cordoba into the universities of Europe</title>
<g class="ln">
<path d="M76 46c7-6 13-6 19-2 6-4 12-4 19 2v16c-7-6-13-6-19-2-6-4-12-4-19 2z"/>
<path d="M95 44v18"/>
<path d="M314 64V52a16 16 0 0 1 32 0v12"/>
<path d="M304 64h52"/>
<path d="M543 52l22-14 22 14"/>
<path d="M550 52v14M565 52v14M580 52v14"/>
<path d="M540 66h50"/>
</g>
<g class="rd">
<path d="M95 88C165 46 260 130 330 88"/>
<path d="M330 88C400 46 495 130 565 88"/>
</g>
<g class="ln">
<path d="M95 96v14M330 96v14M565 96v14"/>
</g>
<circle cx="95" cy="88" r="6" class="nd"/><circle cx="330" cy="88" r="6" class="nd"/>
<circle cx="565" cy="88" r="6" class="nd"/>
<text x="95" y="136" class="t1">Baghdad</text>
<text x="95" y="160" class="t2">written, 800s</text>
<text x="330" y="136" class="t1">Toledo and Cordoba</text>
<text x="330" y="160" class="t2">translated, 1100s</text>
<text x="565" y="136" class="t1">Europe</text>
<text x="565" y="160" class="t2">taught, 1200s</text>
<text x="330" y="198" class="t3">the paper road</text>
</svg>
<p class="cap">How a gift actually travels. Almost nothing in this hall was invented out of nothing, and almost nothing stayed where it was made: written or improved in one city, carried west on paper, translated at Toledo and Cordoba by mixed teams of Muslims, Jews and Christians, then taught in universities that had only just opened their doors. The road ran both ways for centuries, and hardly anyone walking it thought of it as theft.</p>
</div>"""

FIG_JABR = """<div class="fig mo-draw">
<svg viewBox="0 0 660 300" class="figsvg" role="img" aria-labelledby="figjabr-t">
<title id="figjabr-t">A balance scale showing that taking the same amount from both sides keeps the equation true</title>
<g class="ln">
<rect x="140" y="52" width="100" height="54" rx="9"/>
<rect x="420" y="52" width="100" height="54" rx="9"/>
<path d="M150 106h360"/>
<path d="M330 106v44"/>
<path d="M330 150l-22 44h44z"/>
<path d="M288 194h84"/>
</g>
<circle cx="330" cy="106" r="5" class="nd"/>
<text x="190" y="90" class="t1 big">x + 5</text>
<text x="470" y="90" class="t1 big">12</text>
<g class="rd">
<path d="M190 124v34M181 150l9 10 9-10"/>
<path d="M470 124v34M461 150l9 10 9-10"/>
</g>
<text x="330" y="232" class="t2">take five from each side</text>
<text x="190" y="282" class="t1 big gold">x</text>
<text x="330" y="282" class="t1 big gold">=</text>
<text x="470" y="282" class="t1 big gold">7</text>
</svg>
<p class="cap">Al-jabr, the restoration: whatever you take from one side you take from the other, and the scale never lies. Al-Khwarizmi lifted that habit out of single puzzles about inheritance shares and canal digging and taught it as a general method good for every problem of the same shape. That is why his book gave algebra its name, and why his own name, worn down by Latin scribes into Algoritmi, became the word algorithm.</p>
</div>"""


LAMP = ('<g class="ln"><path d="M0 46l-11 26M0 46l11 26"/><path d="M-13 72h26"/>'
        '<path d="M-13 72c1 17 6 25 13 25 7 0 12-8 13-25"/></g>')


def fig_lamps():
    stops = [("700", 42), ("900", 122), ("1100", 202), ("1300", 282),
             ("1500", 362), ("1700", 442), ("1900", 522)]
    lit = []
    for i, (yr, x) in enumerate(stops):
        lit.append(
            '<g class="lamp" transform="translate(%d 0)" style="--d:%.2fs">'
            '<circle class="halo" cx="0" cy="70" r="21"/>%s'
            '<path class="flame" d="M0 54c6 8 7 13 0 18-7-5-6-10 0-18z"/>'
            '<text x="0" y="128" class="t2">%s</text></g>' % (x, 0.25 + i * 0.22, LAMP, yr))
    off = ('<g class="lamp lamp-off" transform="translate(602 0)">'
           '<circle class="wait" cx="0" cy="70" r="23"/>%s'
           '<text x="0" y="128" class="t2">the one</text>'
           '<text x="0" y="150" class="t2">being lit</text>'
           '<text x="0" y="172" class="t2">now</text></g>' % LAMP)
    return ("""<div class="fig mo-draw" id="lampchain">
<svg viewBox="0 0 660 186" class="figsvg lamps" role="img" aria-labelledby="figlamp-t">
<title id="figlamp-t">A chain of hanging lamps lit one after another across the centuries, the last one still unlit</title>
<g class="ln"><path d="M20 46h620"/></g>
%s%s
</svg>
<p class="cap">Thirteen centuries, and not one of them dark. Every lamp here was lit from the one before it, usually by teachers who never met the students of their students. The last lamp is not an error in the drawing. It is unlit because the chain is not finished, and because somebody reading this page is the next one to carry it.</p>
</div>""" % ("".join(lit), off))

# ----------------------------------------------------------------- figure kit
# Every figure below is one idea, drawn. The motion layer draws the strokes on
# scroll (class mo-draw) and lifts the labelled parts (mo, mo-pop); nothing here
# runs its own observer, and nothing animates against a reader who asked for
# stillness.

def arr(x1, y1, x2, y2, cls="rd", head=10.0):
    """One arrow: a shaft and a head, both drawable strokes."""
    a = math.atan2(y2 - y1, x2 - x1)
    ax, ay = x2 - head * math.cos(a - 0.42), y2 - head * math.sin(a - 0.42)
    bx, by = x2 - head * math.cos(a + 0.42), y2 - head * math.sin(a + 0.42)
    return ('<path class="%s" d="M%.1f %.1fL%.1f %.1f"/>'
            '<path class="%s" d="M%.1f %.1fL%.1f %.1fL%.1f %.1f"/>'
            % (cls, x1, y1, x2, y2, cls, ax, ay, x2, y2, bx, by))


def gapline(x1, y1, x2, y2, n=6, cls="ln"):
    """A broken line, drawn as separate strokes so the gaps survive: a CSS dash
    pattern would be overwritten by the stroke-drawing animation."""
    out = []
    for i in range(n):
        t0 = i / float(n)
        t1 = t0 + 0.58 / n
        out.append('<path class="%s" d="M%.1f %.1fL%.1f %.1f"/>'
                   % (cls, x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0,
                      x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1))
    return "".join(out)


def marks(segs, cls="ln thin"):
    """Many short strokes as one drawable path: ticks, hatching, a rhythm row.
    One element means one sweep of the pen, not forty staggered ones."""
    d = "".join("M%.1f %.1fL%.1f %.1f" % s for s in segs)
    return '<path class="%s" d="%s"/>' % (cls, d)


def dots(pts, r=4, cls="nd"):
    """A scatter of filled dots as one path, for the same reason."""
    d = "".join("M%.1f %.1fa%.1f %.1f 0 1 0 %.1f 0a%.1f %.1f 0 1 0 %.1f 0Z"
                % (x - r, y, r, r, 2 * r, r, r, -2 * r) for x, y in pts)
    return '<path class="%s" d="%s"/>' % (cls, d)


def star(x, y, r=9, cls="nd"):
    """A four pointed star mark."""
    return ('<path class="%s" d="M%.1f %.1fL%.1f %.1fL%.1f %.1fL%.1f %.1fL%.1f %.1fL%.1f %.1f'
            'L%.1f %.1fL%.1f %.1fZ"/>'
            % (cls, x, y - r, x + r * 0.28, y - r * 0.28, x + r, y, x + r * 0.28, y + r * 0.28,
               x, y + r, x - r * 0.28, y + r * 0.28, x - r, y, x - r * 0.28, y - r * 0.28))


def fig(fid, alt, w, h, body, cap, cls=""):
    return ('<div class="fig mo-draw">\n'
            '<svg viewBox="0 0 %d %d" class="figsvg%s" role="img" aria-labelledby="%s-t">\n'
            '<title id="%s-t">%s</title>\n%s\n</svg>\n'
            '<p class="cap">%s</p>\n</div>'
            % (w, h, (" " + cls) if cls else "", fid, fid, alt, body, cap))


GIFT_FIGS = {}
LIFE_FIGS = {}

# --- mathematics ------------------------------------------------------------

GIFT_FIGS["algebra-and-its-very-name"] = FIG_JABR

GIFT_FIGS["the-numerals-the-world-counts-with"] = fig(
    "fnum",
    "Three boxes labelled hundreds, tens and ones holding the digits three, zero and seven, "
    "with the zero shown as the sign that keeps an empty place open",
    660, 292,
    '<text x="330" y="26" class="t3">place value</text>'
    '<g class="ln">'
    '<rect x="90" y="60" width="120" height="80" rx="12"/>'
    '<rect x="270" y="60" width="120" height="80" rx="12"/>'
    '<rect x="450" y="60" width="120" height="80" rx="12"/>'
    '</g>'
    '<g class="mo"><text x="150" y="52" class="t2">hundreds</text>'
    '<text x="330" y="52" class="t2">tens</text>'
    '<text x="510" y="52" class="t2">ones</text></g>'
    '<g class="mo-pop"><text x="150" y="114" class="t1 big gold">3</text>'
    '<text x="330" y="114" class="t1 big gold">0</text>'
    '<text x="510" y="114" class="t1 big gold">7</text></g>'
    + arr(330, 148, 330, 176, "rd") +
    '<g class="mo"><text x="330" y="198" class="t2 gold">sifr, the empty one</text>'
    '<text x="330" y="222" class="t4">a sign for nothing, so the places hold still</text></g>'
    '<text x="330" y="268" class="t1">300 + 0 + 7 = 307</text>',
    "The ten digits were born in India, where zero was already treated as a number you could "
    "calculate with, not a blank. Carried to Baghdad with Indian astronomy in the 700s, they "
    "were tested, taught and completed here: al-Uqlidisi worked decimal fractions on paper in "
    "Damascus around 952, and al-Khwarizmi wrote the handbook that crossed into Latin. Sifr, "
    "Arabic for empty, became both cipher and zero. Three civilizations hold one gift between "
    "them, which is exactly how it deserves to be told.")

GIFT_FIGS["triangles-bent-around-a-sphere"] = fig(
    "fsph",
    "A flat triangle whose angles make exactly 180 degrees beside a triangle drawn on a globe "
    "whose angles make more than 180",
    660, 320,
    '<g class="ln"><path d="M85 196L275 196L180 84Z"/>'
    '<path d="M107 196a22 22 0 0 0 8-14"/><path d="M245 182a22 22 0 0 0 8 14"/>'
    '<path d="M170 106a18 18 0 0 0 20 0"/></g>'
    '<g class="ln"><circle cx="480" cy="140" r="88"/>'
    '<path d="M392 140c40 22 136 22 176 0"/>'
    '<path d="M480 52c-34 40-34 136 0 176"/></g>'
    '<g class="rd"><path d="M480 52C444 92 424 146 420 198"/>'
    '<path d="M480 52c36 40 56 94 60 146"/>'
    '<path d="M420 198c38 14 82 14 120 0"/></g>'
    '<g class="ln"><path d="M432 182a22 22 0 0 0 12 16"/><path d="M516 198a22 22 0 0 0 12-16"/>'
    '<path d="M468 76a18 18 0 0 0 24 0"/></g>'
    '<g class="mo"><text x="180" y="250" class="t2">on a flat page</text>'
    '<text x="180" y="276" class="t2 gold">exactly 180 degrees</text>'
    '<text x="480" y="250" class="t2">on a round earth</text>'
    '<text x="480" y="276" class="t2 gold">always more than 180</text></g>'
    '<text x="330" y="310" class="t4">so the way to Makkah is an arc, not a straight line on a flat map</text>',
    "Five times a day, from any village on a round earth, a Muslim needs the direction of one "
    "city. Answering that precisely, along with prayer times and calendars, drove al-Battani at "
    "Raqqa and Abu al-Wafa at Baghdad deep into the trigonometry of the sphere, where the flat "
    "rules quietly fail. Al-Battani also measured the solar year to within a couple of minutes "
    "of the modern value, and Copernicus cites him by name.")

# --- medicine ---------------------------------------------------------------

GIFT_FIGS["telling-measles-from-smallpox"] = fig(
    "fdif",
    "One patient with fever and a rash, and a fork separating two diseases that were long "
    "treated as one, each with its own written description",
    660, 300,
    '<g class="ln"><rect x="230" y="34" width="200" height="52" rx="16"/></g>'
    '<text x="330" y="66" class="t2">one fever, one rash</text>'
    + arr(300, 88, 200, 132, "rd") + arr(360, 88, 460, 132, "rd") +
    '<g class="mo-pop"><text x="180" y="164" class="t1">smallpox</text>'
    '<text x="480" y="164" class="t1">measles</text></g>'
    '<g class="ln thin"><path d="M96 192h168M96 216h140M96 240h168M96 264h108"/>'
    '<path d="M396 192h168M396 216h168M396 240h124M396 264h150"/></g>'
    '<g class="ln"><path d="M330 150v112"/></g>'
    '<text x="330" y="292" class="t4">the same questions asked of each, and the answers written down</text>',
    "Al-Razi ran the hospitals of Rayy and Baghdad and took two fevers everyone had lumped "
    "together, then described, symptom by careful symptom, how they differ and what each means "
    "for the patient. That is the ancestor of every differential diagnosis: telling this illness "
    "from that one by evidence rather than habit. He kept notes on real patients, recorded his "
    "failures beside his cures, and wrote a book called Doubts About Galen wherever observation "
    "disagreed with the greatest authority he had.")

GIFT_FIGS["two-hundred-surgical-instruments"] = fig(
    "fzah",
    "Instruments drawn in al-Tasrif around the year 1000 beside their descendants on a modern "
    "tray, and a suture the body absorbs",
    660, 340,
    '<g class="mo"><text x="160" y="34" class="t3">drawn, about 1000</text>'
    '<text x="510" y="34" class="t3">on a tray today</text></g>'
    '<g class="ln"><path d="M70 78h96l44 12-44 12H70z"/><path d="M166 78v24"/></g>'
    '<g class="rd"><path d="M420 78h96l44 12-44 12h-96z"/><path d="M516 78v24"/></g>'
    + arr(250, 90, 380, 90, "rd", 9) +
    '<g class="ln"><path d="M84 168c34-18 70-18 104 0"/><path d="M84 200c34 18 70 18 104 0"/>'
    '<path d="M188 168c22 6 30 12 30 16 0 4-8 10-30 16"/><circle cx="126" cy="184" r="5"/></g>'
    '<g class="rd"><path d="M434 168c34-18 70-18 104 0"/><path d="M434 200c34 18 70 18 104 0"/>'
    '<path d="M538 168c22 6 30 12 30 16 0 4-8 10-30 16"/><circle cx="476" cy="184" r="5"/></g>'
    + arr(250, 184, 380, 184, "rd", 9) +
    '<g class="ln"><path d="M70 268h150"/><path d="M96 254v28M126 254v28M156 254v28M186 254v28"/></g>'
    '<g class="ln"><path d="M434 268h150"/></g>'
    + arr(250, 268, 380, 268, "rd", 9) +
    '<g class="mo"><text x="145" y="312" class="t4">stitched with thread of catgut</text>'
    '<text x="509" y="312" class="t4">the body takes the thread away</text>'
    '<text x="330" y="252" class="t4 gold">no second cut</text></g>',
    "In the palace city outside Cordoba, al-Zahrawi spent some fifty years in practice and did "
    "what almost nobody had thought to do: he drew the instruments, around two hundred of them, "
    "precisely enough that a surgeon far away could have them made. His quietest gift may be the "
    "largest: sutures of catgut, thread made from animal intestine, which the body slowly and "
    "safely absorbs, so an internal wound could be closed without reopening the patient to take "
    "the thread out. Dissolving stitches still work on his principle.")

GIFT_FIGS["the-canon-that-taught-europe"] = fig(
    "fcan",
    "The five ordered books of the Canon of Medicine, and a bar showing roughly six centuries "
    "of use in European universities",
    660, 320,
    '<text x="330" y="28" class="t3">a book you could find things in</text>'
    '<g class="ln"><rect x="170" y="44" width="320" height="32" rx="8"/>'
    '<rect x="170" y="84" width="320" height="32" rx="8"/>'
    '<rect x="170" y="124" width="320" height="32" rx="8"/>'
    '<rect x="170" y="164" width="320" height="32" rx="8"/>'
    '<rect x="170" y="204" width="320" height="32" rx="8"/></g>'
    '<g class="mo"><text x="330" y="66" class="t4">1. the principles</text>'
    '<text x="330" y="106" class="t4">2. the simple medicines</text>'
    '<text x="330" y="146" class="t4">3. diseases, head to toe</text>'
    '<text x="330" y="186" class="t4">4. illnesses of the whole body</text>'
    '<text x="330" y="226" class="t4">5. the treatments</text></g>'
    '<g class="ln"><path d="M60 276h560"/><path d="M60 270v12M220 270v12M380 270v12M540 270v12M620 270v12"/></g>'
    '<g class="rd"><path d="M180 276h400"/></g>'
    '<circle cx="180" cy="276" r="6" class="nd"/><circle cx="580" cy="276" r="6" class="nd"/>'
    '<text x="380" y="262" class="t4 gold">taught at Montpellier, Bologna and Paris</text>'
    '<g class="mo"><text x="60" y="302" class="t4 ts">1000</text>'
    '<text x="380" y="302" class="t4">1400</text><text x="620" y="302" class="t4 te">1700</text></g>',
    "Ibn Sina tried to hold his world's whole medicine in one order: principles, then medicines, "
    "then diseases from head to toe, then illnesses of the whole body, then treatments. What made "
    "the Canon beloved was not only its completeness but that a working physician could actually "
    "find things in it. Tucked inside are seven rules for testing a new drug, an early grammar of "
    "the clinical trial. Translated at Toledo, it stayed on European syllabuses from the twelfth "
    "century into the seventeenth.")

GIFT_FIGS["the-heart-s-path-through-the-lungs"] = fig(
    "fnaf",
    "The old belief that blood seeps through the wall of the heart, crossed out, beside the true "
    "loop out through the lungs and back",
    660, 340,
    '<g class="ln"><ellipse cx="276" cy="86" rx="42" ry="52"/><ellipse cx="384" cy="86" rx="42" ry="52"/>'
    '<path d="M330 60v56"/></g>'
    '<text x="330" y="34" class="t2">the lungs</text>'
    '<g class="ln"><rect x="236" y="178" width="88" height="112" rx="14"/>'
    '<rect x="336" y="178" width="88" height="112" rx="14"/></g>'
    '<g class="ln"><path d="M330 178v112"/><path d="M326 178v112"/></g>'
    '<g class="rd"><path d="M262 178C250 148 250 126 260 116"/><path d="M398 178c12-30 12-52 2-62"/></g>'
    + arr(260, 120, 268, 112, "rd", 9) + arr(396, 150, 400, 174, "rd", 9) +
    '<g class="strike"><path d="M290 234h80"/><path d="M312 216l36 36M348 216l-36 36"/></g>'
    '<g class="mo"><text x="252" y="316" class="t4">the right side</text>'
    '<text x="408" y="316" class="t4">the left side</text>'
    '<text x="150" y="196" class="t4">out with the</text><text x="150" y="218" class="t4">blood</text>'
    '<text x="520" y="196" class="t4">back, mixed</text><text x="520" y="218" class="t4">with air</text>'
    '<text x="330" y="150" class="t4 gold">the only road</text></g>'
    '<text x="330" y="336" class="t4">the wall between them is solid, and the old teaching of pores in it was wrong</text>',
    "Ancient authority taught that blood seeps from one side of the heart to the other through "
    "invisible pores. Ibn al-Nafis, a hospital chief in Cairo, weighed that against anatomy and "
    "reason and refused it: the wall is solid, and blood reaches the left side only by travelling "
    "out through the lungs, mingling with air, and returning. That is the pulmonary circulation, "
    "written in the thirteenth century, three hundred years before European anatomists reached "
    "the same truth.")

GIFT_FIGS["the-bimaristan-a-hospital-for-everyone"] = fig(
    "fbim",
    "A hospital floor plan with wards branching from a central courtyard, a pharmacy, a teaching "
    "room and an open door",
    660, 360,
    '<g class="ln"><rect x="262" y="120" width="136" height="132" rx="10"/>'
    '<circle cx="330" cy="176" r="20"/>'
    '<rect x="255" y="30" width="150" height="60" rx="10"/>'
    '<rect x="255" y="282" width="150" height="60" rx="10"/>'
    '<rect x="40" y="150" width="192" height="72" rx="10"/>'
    '<rect x="428" y="150" width="192" height="72" rx="10"/>'
    '<path d="M330 90v30M330 252v30M232 186h30M398 186h30"/></g>'
    '<g class="mo"><text x="330" y="66" class="t4">the fever ward</text>'
    '<text x="330" y="310" class="t4">the ward</text>'
    '<text x="330" y="332" class="t4">for wounds</text>'
    '<text x="136" y="184" class="t4">illnesses of</text>'
    '<text x="136" y="206" class="t4">the mind</text>'
    '<text x="524" y="184" class="t4">the pharmacy, and</text>'
    '<text x="524" y="206" class="t4">the teaching round</text>'
    '<text x="330" y="238" class="t4 gold">the court</text></g>'
    '<g class="rd"><path d="M300 342h60"/></g>'
    '<text x="330" y="356" class="t4 gold">no one turned away, and no bill at the door</text>',
    "Bimaristan is Persian for place of the sick. Funded by waqf, a charitable endowment set "
    "aside forever, the great hospitals of Baghdad, Damascus and Cairo treated rich and poor, "
    "resident and stranger, of any faith, without a bill. Separate wards, a pharmacy on site, "
    "physicians on rotation, students following their teachers from bed to bed, and records kept "
    "and taught from. Cairo's al-Mansuri, opened in 1284, offered music for the sleepless. No one "
    "claims Muslims invented care; the gift is care organized, endowed, taught, and owed to "
    "everyone.")

# --- seeing -----------------------------------------------------------------

GIFT_FIGS["how-light-enters-the-eye"] = fig(
    "fcam",
    "A candle outside a wall, its light crossing through one small hole and landing on the far "
    "wall as an image turned upside down, with the flame now pointing downward",
    660, 430,
    '<text x="330" y="26" class="t2">a wall, and one small hole</text>'
    '<g class="ln"><path d="M330 36v136M330 188v112"/></g>'
    '<g class="ln"><rect x="70" y="150" width="26" height="100" rx="3"/><path d="M83 150v-6"/></g>'
    '<path class="flame" d="M83 118c9 14 9 22 0 28c-9-6-9-14 0-28z"/>'
    '<g class="rd"><path d="M83 118L330 180L608 250"/><path d="M83 250L330 180L608 101"/></g>'
    '<circle cx="330" cy="180" r="5" class="nd"/>'
    '<g class="ln"><path d="M608 70v220"/></g>'
    '<g class="ln"><rect x="582" y="101" width="26" height="115" rx="3"/><path d="M595 216v6"/></g>'
    '<path class="flame" d="M595 250c-9-14-9-22 0-28c9 6 9 14 0 28z"/>'
    '<g class="mo"><text x="83" y="286" class="t4">a candle outside</text>'
    '<text x="570" y="284" class="t2 gold">the image arrives</text>'
    '<text x="570" y="312" class="t2 gold">upside down</text></g>'
    '<g class="ln thin"><path d="M60 336h540"/></g>'
    '<g class="ln"><path d="M120 380c12-14 36-14 48 0c-12 14-36 14-48 0z"/><circle cx="144" cy="380" r="5"/></g>'
    + arr(178, 380, 256, 380, "ln", 9) +
    '<g class="strike"><path d="M198 362l36 36M234 362l-36 36"/></g>'
    '<text x="196" y="414" class="t4">not rays out of the eye</text>'
    '<g class="ln"><path d="M392 380c12-14 36-14 48 0c-12 14-36 14-48 0z"/><circle cx="416" cy="380" r="5"/></g>'
    + star(586, 380, 12, "nd") + arr(556, 380, 452, 380, "rd", 9) +
    '<text x="478" y="414" class="t4">light comes in, and is read</text>',
    "For a thousand years the learned argued about sight by argument alone, many holding that the "
    "eye sends out rays. Ibn al-Haytham built the test instead. In a darkened room in Cairo, light "
    "through a small hole threw the bright world onto the far wall, upside down: the camera "
    "obscura, which he called al-bayt al-muzlim, the dark house. Light travels in straight lines "
    "from things into the eye, so vision is reception, not emission. The deeper gift was the "
    "method: suspect every claim, including your own, and describe your procedure so exactly that "
    "another person can repeat it.")

GIFT_FIGS["the-long-road-to-eyeglasses"] = fig(
    "fgla",
    "Rays bending through a curved lens to a focus, and riveted spectacles, with a broken line "
    "between them where the evidence runs out",
    660, 312,
    '<g class="ln"><path d="M150 66c26 26 26 82 0 108c-26-26-26-82 0-108z"/></g>'
    '<g class="rd"><path d="M50 92h96M50 120h96M50 148h96"/>'
    '<path d="M154 92l156 28M154 120h156M154 148l156-28"/></g>'
    '<circle cx="310" cy="120" r="6" class="nd"/>'
    + gapline(324, 120, 404, 120, 5, "ln") +
    '<g class="ln"><circle cx="455" cy="120" r="40"/><circle cx="545" cy="120" r="40"/>'
    '<path d="M455 160v14h90v-14"/><circle cx="500" cy="180" r="6"/></g>'
    '<g class="mo"><text x="180" y="248" class="t4">how light bends through curved glass</text>'
    '<text x="180" y="272" class="t4">Baghdad, 984, and then Cairo</text>'
    '<text x="500" y="248" class="t4">made by craftsmen in Italy</text>'
    '<text x="500" y="272" class="t4">about 1286</text>'
    '<text x="360" y="200" class="t4">no document</text>'
    '<text x="360" y="222" class="t4">joins these hands</text></g>'
    '<text x="330" y="304" class="t4 gold">the understanding is certain, the handshake is not</text>',
    "Ibn Sahl derived the bending law for lenses at Baghdad in 984, seven centuries before it was "
    "named for Snell, and Ibn al-Haytham’s Book of Optics taught Europe how images form. "
    "Spectacles appear in Italy around 1286, in the hands of craftsmen whose names are lost. The "
    "theory certainly travelled into the same Europe where glassworkers were grinding finer "
    "lenses, but no document shows a spectacle maker reading either book, so we hold the join "
    "lightly and claim only what we can prove.")

GIFT_FIGS["measuring-the-earth-with-a-mountain"] = fig(
    "fbir",
    "A mountain on the curve of the earth, the height taken from the plain, the dip of the "
    "horizon taken from the summit, and the formula that turns the two into the earth’s radius",
    660, 392,
    '<g class="ln"><path d="M30 295A520 520 0 0 1 630 295"/></g>'
    '<g class="ln"><path d="M268 204L330 96L392 204"/></g>'
    '<g class="ln thin"><path d="M250 96h80M250 204h18M250 96v108"/>'
    '<path d="M244 102l6-6 6 6M244 198l6 6 6-6"/></g>'
    '<g class="ln"><path d="M330 96h230"/></g>'
    '<g class="rd"><path d="M330 96L617 287"/></g>'
    '<g class="ln"><path d="M400 96A70 70 0 0 1 388 135"/></g>'
    '<circle cx="617" cy="287" r="6" class="nd"/>'
    '<g class="mo"><text x="238" y="134" class="t4 te">the height,</text>'
    '<text x="238" y="156" class="t4 te">taken from the plain</text>'
    '<text x="416" y="130" class="t4 ts">the dip</text>'
    '<text x="560" y="86" class="t4">true level</text>'
    '<text x="630" y="318" class="t4 te">the horizon, seen from the summit</text></g>'
    '<text x="330" y="356" class="t1 gold">R = h cos θ / (1 - cos θ)</text>'
    '<text x="330" y="384" class="t4">drawn large: on a real mountain the dip is a fraction of one degree</text>',
    "Al-Biruni wanted the size of the earth and had no wish to pace out a desert for it. At the "
    "fort of Nandana he measured a mountain’s height by sightings alone, climbed it, and measured "
    "the small angle by which the horizon dips below true level. Height and dip, joined by "
    "trigonometry, give the radius of the whole planet. His answer lands within about one percent "
    "of the modern figure. Two sightings, one climb, one clean equation, and the calm assumption "
    "that a person with mathematics can take the measure of the world.")

# --- engineering ------------------------------------------------------------

GIFT_FIGS["the-crankshaft-and-the-elephant-clock"] = fig(
    "fjaz",
    "A turning wheel joined by a connecting rod to a piston, converting rotation into a straight "
    "stroke, beside a barrel of pegs that sets a rhythm",
    660, 310,
    '<g class="ln"><circle cx="140" cy="150" r="62"/><circle cx="140" cy="150" r="5"/></g>'
    '<g class="rd"><path d="M140 150L188 110"/><path d="M188 110L320 150"/></g>'
    '<circle cx="188" cy="110" r="7" class="nd"/>'
    '<g class="ln"><rect x="320" y="120" width="110" height="60" rx="6"/>'
    '<rect x="320" y="126" width="30" height="48" rx="4"/></g>'
    '<g class="ln"><path d="M140 74A76 76 0 0 1 216 150"/><path d="M206 140l10 12 12-10"/></g>'
    '<g class="rd"><path d="M334 206h84"/><path d="M344 200l-10 6 10 6M408 200l10 6-10 6"/></g>'
    '<g class="ln"><circle cx="545" cy="150" r="52"/>'
    '<path d="M545 98v-14M597 150h14M545 202v14M493 150h-14M582 113l10-10M582 187l10 10"/></g>'
    '<g class="ln"><path d="M470 76h150"/><path d="M545 76v8"/></g>'
    '<g class="rd"><path d="M478 206h134"/><path d="M494 200v12M520 200v12M566 200v12M598 200v12"/></g>'
    '<g class="mo"><text x="140" y="248" class="t4">turning</text>'
    '<text x="376" y="248" class="t4">back and forth</text>'
    '<text x="545" y="248" class="t4">pegs in a barrel</text>'
    '<text x="240" y="286" class="t2 gold">rotation becomes a stroke</text>'
    '<text x="545" y="272" class="t4">set the rhythm</text></g>',
    "Al-Jazari served three generations of Artuqid princes and wrote his machines down in 1206, "
    "fifty devices with instructions exact enough to build from. Inside are mechanisms the modern "
    "world still runs on: the crankshaft joined to connecting rods, turning rotation into back "
    "and forth motion in his twin cylinder water pump; camshafts timing a sequence of actions; "
    "and float valves that regulate themselves. His drummers kept time by pegs set into a turning "
    "barrel, so moving the pegs changed the tune: a program you could touch, centuries before the "
    "word existed.")

GIFT_FIGS["water-led-kindly-through-dry-lands"] = fig(
    "fqan",
    "A cross section of a qanat: a well tapping the water table under the hills, a gently sloping "
    "tunnel with digging shafts, and water arriving in the village by gravity alone",
    660, 306,
    '<g class="ln"><path d="M30 100C150 92 250 150 380 186C470 210 560 232 630 240"/></g>'
    + gapline(40, 196, 215, 196, 8, "ln") +
    '<g class="ln"><path d="M100 99v99M180 118v86M260 152v57M340 176v38M420 196v24M500 214v11"/></g>'
    '<g class="rd"><path d="M100 198L596 232"/></g>'
    + arr(560, 230, 600, 233, "rd", 9) +
    '<g class="ln"><path d="M604 240h30M610 240v-10h18v10"/></g>'
    '<g class="mo"><text x="200" y="60" class="t4">qanat, a channel under the ground</text>'
    '<text x="128" y="186" class="t4">the water table</text>'
    '<text x="280" y="258" class="t4">shafts for digging and for air</text>'
    '<text x="630" y="266" class="t4 te">into the village fields</text></g>'
    '<text x="300" y="294" class="t4 gold">gravity does the carrying, and the sun takes nothing</text>',
    "The qanat is older than Islam, a Persian masterpiece, and Muslim engineers carried it west "
    "across North Africa into Spain, where Madrid grew up on buried channels. The wheels of Hama "
    "still groan on the Orontes. The deepest mark is social: Islamic law treats water as a shared "
    "trust, Valencia’s water court still meets at the cathedral door every Thursday, and in New "
    "Mexico farmers share water through acequias, from al-saqiya, the water channel, under rules "
    "that still carry an Arabic name.")

GIFT_FIGS["the-leap-of-abbas-ibn-firnas"] = fig(
    "ffir",
    "A winged figure gliding from a height and landing hard, with a line showing how far the "
    "written evidence sits from the event",
    660, 344,
    '<g class="ln"><rect x="62" y="96" width="52" height="156" rx="4"/><path d="M52 96h72"/></g>'
    '<g class="ln"><path d="M132 106v22"/><circle cx="132" cy="99" r="7"/>'
    '<path d="M132 112c-14-10-26-12-34-8M132 112c14-10 26-12 34-8"/></g>'
    + gapline(124, 122, 100, 136, 3, "ln") +
    '<g class="rd"><path d="M146 116C240 146 330 184 452 236"/></g>'
    '<g class="ln"><path d="M452 236l24 14M466 228l14 22"/></g>'
    '<g class="ln"><path d="M40 252h580"/></g>'
    '<g class="mo"><text x="210" y="86" class="t4">no tail, said the story</text>'
    '<text x="620" y="196" class="t4 te">the landing hurt his back</text></g>'
    '<g class="ln"><path d="M60 298h560"/><path d="M106 292v12M607 292v12"/></g>'
    '<circle cx="106" cy="298" r="6" class="nd"/><circle cx="607" cy="298" r="6" class="nd"/>'
    '<text x="60" y="284" class="t4 ts">a rival poet’s joke, in his own century</text>'
    '<text x="620" y="326" class="t4 te">the full account, about seven hundred years later</text>',
    "The story says that in ninth century Cordoba he built wings of silk and feathers, leapt "
    "before a watching crowd, glided some distance and landed hard, hurting his back, because he "
    "had given himself no tail. From his own century we have one thin, wonderful thread: a court "
    "poet mocking him for flying dressed in a vulture’s feathers. The full account comes about "
    "seven hundred years later, so we grade it traced and hold it lightly. A rival’s joke is not "
    "a flight log.")

GIFT_FIGS["domes-that-ride-earthquakes"] = fig(
    "fsin",
    "A section through one of Sinan’s mosques showing the weight of the great dome carried down "
    "through half domes, piers and buttresses along several paths",
    660, 360,
    '<g class="ln"><path d="M220 172A110 110 0 0 1 440 172"/>'
    '<path d="M140 232A80 80 0 0 1 220 172"/><path d="M440 172A80 80 0 0 1 520 232"/>'
    '<path d="M220 172v120M440 172v120M140 232v60M520 232v60"/>'
    '<path d="M90 292h480"/></g>'
    '<g class="rd"><path d="M330 70C286 76 240 118 228 168C214 214 186 258 170 288"/>'
    '<path d="M330 70c44 6 90 48 102 98c14 46 42 90 58 120"/></g>'
    + arr(180, 258, 168, 290, "rd", 9) + arr(480, 258, 492, 290, "rd", 9) +
    '<g class="mo"><text x="330" y="46" class="t4">the great dome</text>'
    '<text x="130" y="206" class="t4 te">a half dome</text>'
    '<text x="530" y="206" class="t4 ts">and another</text></g>'
    '<text x="330" y="326" class="t2 gold">the weight walks down many paths</text>'
    '<text x="330" y="352" class="t4">so the building can shudder instead of snap</text>',
    "Sinan was chief architect of the Ottoman Empire for fifty years and worked in one of the "
    "most earthquake torn corridors on earth. Foundations were left to rest and settle before the "
    "great weight went on. His domes do not sit on brute mass; they ride a cascade of half domes "
    "and hidden buttresses that carry load down flexible paths. Past eighty he finished the "
    "Selimiye at Edirne on eight slender piers, and called it his masterwork. Engineers still "
    "study his iron cramps set in lead, and his instinct for letting a building move a little so "
    "it does not move all at once.")

# --- word and page ----------------------------------------------------------

GIFT_FIGS["paper-for-everyone"] = fig(
    "fpap",
    "Four steps of papermaking: rags beaten to fibre, the vat, the screen dipped and lifted, and "
    "the pressed sheet",
    660, 300,
    '<g class="ln"><path d="M52 100l60 50M112 100l-60 50M46 128h72M82 92v66"/></g>'
    '<g class="ln"><path d="M207 96h80l-12 70h-56z"/><path d="M216 122c12-8 24 8 36 0s24-8 34 0"/>'
    '<path d="M219 142c12-8 24 8 36 0s20-6 30 0"/></g>'
    '<g class="ln"><path d="M368 100l84-8 8 56-84 8z"/>'
    '<path d="M370 114l86-8M372 130l86-8M394 96l6 62M420 93l6 62"/>'
    '<path d="M382 166v10M406 168v12M430 170v10"/></g>'
    '<g class="ln"><path d="M542 92h58l12 12v62h-70z"/><path d="M600 92v12h12"/>'
    '<path d="M552 124h44M552 140h44M552 156h30"/></g>'
    + arr(130, 130, 196, 130, "rd", 9) + arr(300, 130, 358, 130, "rd", 9)
    + arr(470, 130, 532, 130, "rd", 9) +
    '<g class="mo"><text x="82" y="212" class="t4">rags and rope</text>'
    '<text x="82" y="234" class="t4">beaten to fibre</text>'
    '<text x="247" y="212" class="t4">the vat</text>'
    '<text x="247" y="234" class="t4">fibre and water</text>'
    '<text x="412" y="212" class="t4">the screen</text>'
    '<text x="412" y="234" class="t4">dipped and lifted</text>'
    '<text x="577" y="212" class="t4">the sheet</text>'
    '<text x="577" y="234" class="t4">pressed and dried</text></g>'
    '<text x="330" y="278" class="t4 gold">Samarkand, 751 · Baghdad by the 790s · Xativa, and then all of Europe</text>',
    "Paper was China’s secret. Tradition says it walked west in 751 with captured papermakers "
    "brought to Samarkand; that prisoner tale comes from later writers, so we tell it as "
    "tradition. What followed is certain. Baghdad had mills by the 790s, the state moved its "
    "records onto paper because paper drinks ink so deeply that an erasure leaves a visible scar, "
    "and the stationers’ market held a hundred shops of copyists. When printing arrived, it found "
    "a continent already supplied with something to print on. Even the word ream comes from the "
    "Arabic rizma, a bale.")

GIFT_FIGS["the-rescue-that-argued-back"] = fig(
    "ftra",
    "An ancient book translated into Arabic, corrected in the margins, then carried into Latin "
    "with the corrections included",
    660, 292,
    '<g class="ln"><rect x="55" y="60" width="110" height="110" rx="6"/><path d="M75 60v110"/>'
    '<path d="M88 88h62M88 108h62M88 128h48"/></g>'
    '<g class="ln"><rect x="275" y="60" width="110" height="110" rx="6"/><path d="M295 60v110"/>'
    '<path d="M308 88h62M308 128h62M308 148h44"/></g>'
    '<g class="rd"><path d="M308 108h62"/><path d="M302 100l14 16M316 100l-14 16"/>'
    '<path d="M368 74c10 6 10 14 0 20"/></g>'
    '<g class="ln"><rect x="495" y="60" width="110" height="110" rx="6"/><path d="M515 60v110"/>'
    '<path d="M528 88h62M528 108h62M528 128h62M528 148h44"/></g>'
    '<g class="rd"><path d="M588 74c10 6 10 14 0 20"/></g>'
    + arr(175, 115, 265, 115, "rd", 9) + arr(395, 115, 485, 115, "rd", 9) +
    '<g class="mo"><text x="110" y="202" class="t4">Greek, Persian, Indian</text>'
    '<text x="110" y="224" class="t4">the originals</text>'
    '<text x="330" y="202" class="t4">Arabic, and measured</text>'
    '<text x="330" y="224" class="t4">against the sky again</text>'
    '<text x="550" y="202" class="t4">Latin, at Toledo,</text>'
    '<text x="550" y="224" class="t4">corrections and all</text></g>'
    '<text x="330" y="272" class="t4 gold">not a sealed box handed along, but a working library</text>',
    "Baghdad paid fortunes to move the mind of the ancient world into Arabic: Aristotle and Plato, "
    "Galen, Euclid, Ptolemy, alongside Persian statecraft and Indian mathematics. The greatest of "
    "the translators, Hunayn ibn Ishaq, was an Arab Christian who translated for meaning rather "
    "than word by word. Preservation alone would have earned the world’s thanks, but the heirs of "
    "those translators argued back: Ptolemy’s stars were remeasured, Galen was challenged from the "
    "dissection room. When Europe came to Toledo, it translated the corrections too.")

GIFT_FIGS["arabic-hiding-in-your-english"] = fig(
    "fwor",
    "Six Arabic words with their meanings, each joined by an arrow to the English word it became",
    660, 312,
    '<text x="330" y="34" class="t3">receipts</text>'
    '<g class="mo"><text x="296" y="82" class="t4 te gold">al-jabr, the restoration</text>'
    '<text x="296" y="122" class="t4 te gold">al-qali, the plant ashes</text>'
    '<text x="296" y="162" class="t4 te gold">samt al-ras, the way overhead</text>'
    '<text x="296" y="202" class="t4 te gold">qahwa, an old word for wine</text>'
    '<text x="296" y="242" class="t4 te gold">al-qutn, the cotton plant</text>'
    '<text x="296" y="282" class="t4 te gold">makhzan, a storehouse</text></g>'
    + arr(308, 76, 368, 76, "ln", 8) + arr(308, 116, 368, 116, "ln", 8)
    + arr(308, 156, 368, 156, "ln", 8) + arr(308, 196, 368, 196, "ln", 8)
    + arr(308, 236, 368, 236, "ln", 8) + arr(308, 276, 368, 276, "ln", 8) +
    '<g class="mo"><text x="382" y="82" class="t2 ts">algebra</text>'
    '<text x="382" y="122" class="t2 ts">alkali</text>'
    '<text x="382" y="162" class="t2 ts">zenith</text>'
    '<text x="382" y="202" class="t2 ts">coffee</text>'
    '<text x="382" y="242" class="t2 ts">cotton</text>'
    '<text x="382" y="282" class="t2 ts">magazine</text></g>',
    "You speak a little Arabic every day. Nadir is nazir, the opposite point beneath your feet; "
    "tariff descends from tarif, a notification, the posted list of a port’s fees; sofa began as "
    "suffa, a raised platform softened with cushions for sitting long and talking well. Words are "
    "receipts. A language borrows its vocabulary from whoever taught it the thing itself, and no "
    "conquest planted most of these in Europe’s mouth. Merchants, scholars and cooks did, one "
    "transaction and one shared table at a time.")

GIFT_FIGS["history-become-a-science"] = fig(
    "fkha",
    "A curve showing a group with strong solidarity rising to power, then softening over "
    "generations until a hungrier group replaces it",
    660, 322,
    '<text x="330" y="34" class="t3">asabiyya, the feeling that binds a group</text>'
    '<g class="rd"><path d="M60 252C150 246 210 110 320 100C430 90 480 170 600 250"/></g>'
    '<circle cx="60" cy="252" r="6" class="nd"/><circle cx="320" cy="100" r="7" class="nd"/>'
    '<circle cx="600" cy="250" r="6" class="nd"/>'
    '<g class="ln thin"><path d="M40 276h580"/><path d="M180 270v12M320 270v12M460 270v12"/></g>'
    '<g class="mo"><text x="60" y="92" class="t4 ts">a hard group, bound tightly</text>'
    '<text x="320" y="66" class="t4">power, and then comfort</text>'
    '<text x="620" y="200" class="t4 te">the binding loosens</text>'
    '<text x="620" y="300" class="t4 te">a hungrier group arrives</text>'
    '<text x="40" y="300" class="t4 ts">one generation</text></g>',
    "Ibn Khaldun had watched dynasties rise and rot from inside the courts, and then asked a new "
    "question: not what happened, but why anything happens and by what laws. Asabiyya, the "
    "solidarity of people bound together, lets a hardy folk take power; comfort dissolves it over "
    "roughly four generations until a hungrier group arrives. He also saw, centuries early, that "
    "labour is the true source of value and that taxes raised past a certain point lower the "
    "revenue, because enterprise quietly gives up. History, he insisted, is a science: doubt any "
    "report that violates the nature of society, whoever tells it.")

# --- sky and sea ------------------------------------------------------------

GIFT_FIGS["observatories-science-done-together"] = fig(
    "fobs",
    "A huge graduated arc sunk into bedrock with a person beside it for scale, the instrument "
    "that made a whole team’s observations finer",
    660, 344,
    '<text x="330" y="42" class="t4">about forty metres of radius</text>'
    '<text x="330" y="66" class="t4 gold">so one minute of arc becomes a centimetre of stone</text>'
    '<g class="ln"><path d="M150 270A180 180 0 0 1 510 270"/><path d="M150 270v30M510 270v30"/></g>'
    + marks([(330 + 180 * math.cos(math.radians(a)), 270 - 180 * math.sin(math.radians(a)),
              330 + 164 * math.cos(math.radians(a)), 270 - 164 * math.sin(math.radians(a)))
             for a in range(15, 180, 15)]) +
    '<g class="ln"><path d="M40 270h580"/></g>'
    + marks([(x, 274, x - 12, 290) for x in range(70, 620, 46)]) +
    '<g class="ln"><path d="M330 268v-18"/><circle cx="330" cy="242" r="7"/>'
    '<path d="M318 258h24"/></g>'
    '<text x="330" y="316" class="t4">a library, salaried staff, scholars from many lands</text>'
    '<text x="330" y="338" class="t2 gold">about a thousand stars, measured fresh</text>',
    "At Maragheh in 1259, al-Tusi persuaded the Mongol conqueror Hulagu to fund something new: an "
    "observatory with a library, salaried staff and scholars drawn from across Eurasia, all on "
    "one long programme. Astronomy became team science with an address. In Samarkand in the 1420s "
    "Ulugh Beg sank a sextant of some forty metres’ radius into bedrock, so vast it read the sky "
    "to fractions of a minute of arc, and his team fixed about a thousand stars from fresh "
    "observation. He was murdered in 1449 and the observatory pulled down, but the catalogue "
    "escaped and reached Oxford’s presses by 1665.")

GIFT_FIGS["the-astrolabe-a-sky-in-brass"] = fig(
    "fast",
    "An astrolabe: a graduated rim, a horizon plate, a turning star map, and a sighting bar "
    "measuring the height of a star above the horizon",
    660, 352,
    '<g class="ln"><circle cx="240" cy="170" r="140"/><circle cx="240" cy="170" r="128"/>'
    '<circle cx="240" cy="22" r="11"/><path d="M240 33v-8"/></g>'
    + marks([(240 + 140 * math.cos(math.radians(a)), 170 - 140 * math.sin(math.radians(a)),
              240 + 128 * math.cos(math.radians(a)), 170 - 128 * math.sin(math.radians(a)))
             for a in range(0, 360, 15)]) +
    '<g class="ln"><path d="M112 206h256"/><path d="M140 206A150 150 0 0 1 340 206"/>'
    '<path d="M172 206A96 96 0 0 1 308 206"/></g>'
    '<g class="rete"><g class="ln"><circle cx="240" cy="136" r="64"/>'
    '<path d="M240 72c14 8 18 18 10 26M304 136c-8 14-18 18-26 10M176 136c8-14 18-18 26-10"/>'
    '<circle cx="250" cy="98" r="4"/><circle cx="278" cy="146" r="4"/><circle cx="202" cy="146" r="4"/>'
    '</g></g>'
    '<g class="rd"><path d="M127 235L353 105"/><path d="M136 224l10 18M344 116l-10-18"/></g>'
    '<circle cx="240" cy="170" r="6" class="nd"/>'
    '<g class="rd"><path d="M380 170A140 140 0 0 0 361 100"/></g>'
    + gapline(360, 100, 424, 66, 4, "ln") + star(434, 58, 12, "nd") +
    '<g class="mo"><text x="430" y="140" class="t4 ts">the height above the</text>'
    '<text x="430" y="162" class="t4 ts">horizon, read on the rim</text>'
    '<text x="430" y="212" class="t2 ts gold">the hour of the day</text>'
    '<text x="430" y="240" class="t2 ts gold">the times of prayer</text>'
    '<text x="430" y="268" class="t2 ts gold">your latitude</text></g>'
    '<text x="330" y="336" class="t4">turn the brass sky until it matches the real one, and it answers the rest</text>',
    "An astrolabe is the sky folded into a brass plate. Sight a star along the bar, read its "
    "height on the rim, then turn the rete, the pierced star map, until the brass sky matches the "
    "one overhead. The Greeks conceived it; Muslim makers perfected it with interchangeable "
    "plates for different latitudes and kept it the working computer of educated people for a "
    "thousand years. In tenth century Aleppo one of those makers was a woman, al-Ijliya, daughter "
    "of an astrolabist, employed at court for her skill. Everything securely known of her fits in "
    "one line of a tenth century catalogue, and that single line is treasure enough.")

GIFT_FIGS["star-names-on-every-chart"] = fig(
    "fstr",
    "The constellation of Orion with Betelgeuse at the shoulder and Rigel at the foot, each "
    "labelled with the Arabic phrase its name came from",
    660, 342,
    '<text x="330" y="34" class="t3">the sky answers in Arabic</text>'
    '<g class="ln thin"><path d="M250 84L410 98M250 84L296 172M410 98L366 188"/>'
    '<path d="M296 172L331 180L366 188"/><path d="M296 172L286 272M366 188L424 262"/></g>'
    + star(250, 84, 13) + star(410, 98, 10) + star(296, 172, 8) + star(331, 180, 8)
    + star(366, 188, 8) + star(286, 272, 9) + star(424, 262, 13) +
    '<g class="mo"><text x="228" y="78" class="t2 te">Betelgeuse</text>'
    '<text x="228" y="100" class="t4 te">yad al-jawza, the hand</text>'
    '<text x="446" y="256" class="t2 ts">Rigel</text>'
    '<text x="446" y="278" class="t4 ts">rijl, the foot</text>'
    '<text x="331" y="216" class="t4">the belt</text></g>'
    '<text x="330" y="322" class="t2 gold">look up tonight, and most of the bright names are Arabic</text>',
    "Aldebaran is al-dabaran, the follower, forever trailing the Pleiades. Altair is al-nasr "
    "al-tair, the flying eagle. Deneb is a tail, Fomalhaut the mouth of the fish, Algol the head "
    "of the ghoul. Betelgeuse began as yad al-jawza until a medieval copyist misread the first "
    "letter and a B was born, an accident now printed on every chart. The names travelled because "
    "the books did: in 964 al-Sufi re-observed Ptolemy’s catalogue star by star, and noted beside "
    "Andromeda a small cloud, the first surviving record of another galaxy.")

GIFT_FIGS["reading-the-monsoon-sea"] = fig(
    "fkam",
    "A kamal, a knotted cord and a wooden tablet, measuring the height of a star above the "
    "horizon to fix latitude, and the monsoon winds that reverse with the season",
    660, 348,
    '<g class="ln"><path d="M46 170c12-14 36-14 48 0c-12 14-36 14-48 0z"/><circle cx="70" cy="170" r="5"/></g>'
    '<g class="ln"><path d="M86 170h136"/><circle cx="120" cy="170" r="4"/><circle cx="150" cy="170" r="4"/>'
    '<circle cx="180" cy="170" r="4"/><circle cx="210" cy="170" r="4"/></g>'
    '<g class="ln"><rect x="222" y="116" width="14" height="58" rx="3"/></g>'
    '<g class="rd"><path d="M76 168L229 118L340 82"/><path d="M78 170h262"/></g>'
    + star(348, 76, 12, "nd") +
    '<g class="ln"><path d="M110 170A46 46 0 0 0 106 152"/></g>'
    '<g class="mo"><text x="348" y="52" class="t4">the star</text>'
    '<text x="150" y="204" class="t4">a knot for each port</text>'
    '<text x="400" y="118" class="t4 ts">the height of the star</text>'
    '<text x="400" y="140" class="t4 ts">is your latitude</text>'
    '<text x="400" y="192" class="t4 ts">the horizon</text></g>'
    '<g class="ln thin"><path d="M60 272h540"/><path d="M84 280c14-8 28 8 42 0M168 280c14-8 28 8 42 0'
    'M252 280c14-8 28 8 42 0M336 280c14-8 28 8 42 0M420 280c14-8 28 8 42 0M504 280c14-8 28 8 42 0"/></g>'
    + arr(80, 244, 420, 244, "rd", 11) + arr(580, 310, 240, 310, "rd", 11) +
    '<text x="250" y="228" class="t4">one season carries you out</text>'
    '<text x="410" y="334" class="t4">and the other brings you home</text>',
    "Ahmad ibn Majid was born into three generations of pilots at Julfar on the Gulf, and he wrote "
    "the Indian Ocean down: monsoon calendars naming the safe sailing windows to the day, star "
    "altitudes taken with the kamal, a knotted cord and wooden tablet, compass bearings, reefs, "
    "harbours and the tempers of particular coasts. Sailors called him the lion of the sea. The "
    "legend that he piloted Vasco da Gama surfaces two generations later and sits awkwardly on a "
    "man near seventy, so we set it aside. The book is the treasure; the legend is only its shadow.")

# --- the daily table --------------------------------------------------------

GIFT_FIGS["coffee-the-night-prayer-s-drink"] = fig(
    "fcof",
    "The road coffee travelled, from the shrub across the Red Sea to Yemen, then Makkah, Cairo and "
    "Istanbul, with the word changing shape along the same road",
    660, 316,
    '<g class="rd"><path d="M90 132C140 112 170 98 210 104C260 112 290 132 330 132'
    'C380 132 415 112 455 104C510 94 555 108 595 126"/></g>'
    '<circle cx="90" cy="132" r="6" class="nd"/><circle cx="210" cy="104" r="6" class="nd"/>'
    '<circle cx="330" cy="132" r="6" class="nd"/><circle cx="455" cy="104" r="6" class="nd"/>'
    '<circle cx="595" cy="126" r="6" class="nd"/>'
    '<g class="mo"><text x="90" y="166" class="t2">Ethiopia</text>'
    '<text x="90" y="188" class="t4">the shrub’s home</text>'
    '<text x="210" y="80" class="t2">Yemen</text>'
    '<text x="210" y="58" class="t4">roasted and brewed, qahwa</text>'
    '<text x="330" y="166" class="t2">Makkah</text>'
    '<text x="330" y="188" class="t4">carried by pilgrims</text>'
    '<text x="455" y="80" class="t2">Cairo</text>'
    '<text x="650" y="166" class="t2 te">Istanbul</text>'
    '<text x="650" y="188" class="t4 te">the coffeehouses, 1550s</text></g>'
    '<g class="mo"><text x="110" y="252" class="t2 gold">qahwa</text>'
    '<text x="265" y="252" class="t2 gold">kahve</text>'
    '<text x="410" y="252" class="t2 gold">caffè</text>'
    '<text x="560" y="252" class="t2 gold">coffee</text></g>'
    + arr(152, 246, 226, 246, "ln", 8) + arr(306, 246, 372, 246, "ln", 8)
    + arr(450, 246, 520, 246, "ln", 8) +
    '<text x="330" y="296" class="t4">the word walked the same road as the drink</text>',
    "Coffee enters written history in fifteenth century Yemen, among Sufis, devotional communities whose night "
    "vigils of dhikr, the rhythmic remembrance of God, asked for wakeful hearts at hard hours. "
    "They took the berry of a shrub native to Ethiopia across the Red Sea, roasted it, and called "
    "the drink qahwa, an old word for wine given to a wine that clarifies instead of clouding. "
    "The tale of Kaldi and his dancing goats first appears in a European book in 1671, so we "
    "shelve it with the legends. Every espresso bar continues an Ottoman institution: a public "
    "room where strangers stay awake on purpose.")

GIFT_FIGS["ziryab-sets-the-table"] = fig(
    "fzir",
    "A meal arranged in courses, soup then the main dish then something sweet, and an oud with a "
    "fifth string added",
    660, 300,
    '<text x="330" y="34" class="t3">dinner, in order</text>'
    '<g class="ln"><circle cx="140" cy="116" r="44"/><circle cx="140" cy="116" r="30"/>'
    '<circle cx="330" cy="116" r="44"/><circle cx="330" cy="116" r="30"/>'
    '<circle cx="520" cy="116" r="44"/><circle cx="520" cy="116" r="30"/></g>'
    '<g class="mo-pop"><text x="140" y="126" class="t1 gold">1</text>'
    '<text x="330" y="126" class="t1 gold">2</text><text x="520" y="126" class="t1 gold">3</text></g>'
    + arr(194, 116, 274, 116, "rd", 9) + arr(384, 116, 464, 116, "rd", 9) +
    '<g class="mo"><text x="140" y="192" class="t4">the soup first</text>'
    '<text x="330" y="192" class="t4">then the main dish</text>'
    '<text x="520" y="192" class="t4">and sweet things last</text></g>'
    '<g class="ln"><ellipse cx="100" cy="252" rx="30" ry="24"/><path d="M130 246h64v12h-64z"/>'
    '<path d="M194 246l24-10 8 12-24 10z"/><path d="M76 242h114M76 248h114M76 256h114M76 262h114"/></g>'
    '<g class="rd"><path d="M76 252h114"/></g>'
    '<text x="238" y="258" class="t4 ts">and a fifth string on the oud</text>',
    "In 822 the musician Ziryab arrived in Cordoba from Baghdad, and the chronicles credit him "
    "with rearranging civilized life: meals served in courses, fine glass instead of heavy metal, "
    "tablecloths, wardrobes rotated by season, a paste for cleaning teeth, and a fifth string on "
    "the oud. The detailed list reaches us mainly through a compiler writing some eight hundred "
    "years later, and the legend clearly grew in the telling, so we hold it lightly. Ziryab the "
    "court musician is solid; Ziryab the inventor of dinner is a beloved amplification of Cordoba "
    "itself, whose table Europe envied and copied.")

GIFT_FIGS["the-orchard-that-moved-west"] = fig(
    "forc",
    "Four crops carried west, each with the Arabic name it travelled under and the Spanish word "
    "it became",
    660, 306,
    '<g class="ln"><path d="M84 132c-16-24-16-44 0-62c16 18 16 38 0 62z"/><path d="M84 132V64"/>'
    '<path d="M84 84c-14-6-20-14-22-24M84 84c14-6 20-14 22-24"/></g>'
    '<g class="ln"><rect x="238" y="70" width="20" height="62" rx="4"/>'
    '<path d="M238 90h20M238 110h20"/><path d="M238 70c-16-10-24-18-26-28M258 70c16-10 24-18 26-28"/></g>'
    '<g class="ln"><circle cx="412" cy="100" r="30"/><path d="M412 70c8-16 22-22 34-20c-2 14-14 22-34 20z"/></g>'
    '<g class="ln"><circle cx="562" cy="88" r="14"/><circle cx="590" cy="98" r="14"/>'
    '<circle cx="570" cy="114" r="14"/><path d="M576 128v14"/></g>'
    '<g class="mo"><text x="84" y="166" class="t2 gold">al-ruzz</text>'
    '<text x="248" y="166" class="t2 gold">sukkar</text>'
    '<text x="412" y="166" class="t2 gold">naranj</text>'
    '<text x="576" y="166" class="t2 gold">al-qutn</text></g>'
    + arr(84, 178, 84, 200, "ln", 8) + arr(248, 178, 248, 200, "ln", 8)
    + arr(412, 178, 412, 200, "ln", 8) + arr(576, 178, 576, 200, "ln", 8) +
    '<g class="mo"><text x="84" y="228" class="t2">arroz</text>'
    '<text x="248" y="228" class="t2">azúcar</text>'
    '<text x="412" y="228" class="t2">naranja</text>'
    '<text x="576" y="228" class="t2">algodón</text>'
    '<text x="84" y="252" class="t4">rice</text><text x="248" y="252" class="t4">sugar</text>'
    '<text x="412" y="252" class="t4">orange</text><text x="576" y="252" class="t4">cotton</text></g>'
    '<text x="330" y="292" class="t4 gold">carried west and taught to grow again at every stop</text>',
    "Between the eighth and thirteenth centuries the farmers of the Muslim world moved a garden "
    "across the planet: rice, sugarcane, cotton, citrus, eggplant, spinach, artichoke, watermelon, "
    "hard wheat, acclimatized at each stop to new soils and seasons, with the craft travelling "
    "too, wheels and buried channels and terraces and the patient manuals of Ibn al-Awwam of "
    "Seville. Historians argue about how large to draw this agricultural revolution, and we note "
    "the argument honestly; the movement of the crops themselves is not in doubt.")

GIFT_FIGS["the-oud-the-guitar-s-grandmother"] = fig(
    "foud",
    "The oud, and the four European words for the lute that descend from its Arabic name, with a "
    "broken line to the guitar where the family tree is disputed",
    660, 324,
    '<g class="ln"><ellipse cx="120" cy="110" rx="46" ry="40"/><circle cx="120" cy="102" r="12"/>'
    '<path d="M166 102h74v16h-74z"/><path d="M240 102l26-12 10 14-26 12z"/>'
    '<path d="M80 104h160M80 110h160M80 116h160"/></g>'
    '<g class="rd"><path d="M276 104h44"/><path d="M320 104C352 104 358 60 386 56"/>'
    '<path d="M320 104C352 104 358 88 386 88"/><path d="M320 108C352 108 358 124 386 126"/>'
    '<path d="M320 108C352 108 358 156 386 162"/></g>'
    '<g class="mo"><text x="400" y="62" class="t2 ts">laúd, in Spanish</text>'
    '<text x="400" y="94" class="t2 ts">liuto, in Italian</text>'
    '<text x="400" y="132" class="t2 ts">luth, in French</text>'
    '<text x="400" y="168" class="t2 ts">lute, in English</text></g>'
    + gapline(330, 140, 372, 236, 4, "ln") + gapline(160, 250, 340, 250, 7, "ln") +
    '<g class="mo"><text x="146" y="256" class="t4 te">kithara, in Greek</text>'
    '<text x="400" y="256" class="t2 ts">guitar</text></g>'
    '<text x="330" y="304" class="t4">the tree is tangled here, and scholars still argue over the branches</text>',
    "The oud, from al-ud, the wood, crossed into Europe through al-Andalus and Sicily, and "
    "Europeans took the instrument and its Arabic article together: al-ud became laúd, liuto, "
    "luth, lute. The word itself is the receipt, and every lute an angel holds in a Renaissance "
    "painting began as an oud. The guitar is where we slow down: its name likely descends from "
    "the Greek kithara by a separate road, and medieval Spain knew both a guitarra latina and a "
    "guitarra morisca. Call the oud the guitar’s grandmother by marriage, and grade it traced.")

# --- our century ------------------------------------------------------------

GIFT_FIGS["watching-molecules-in-the-act"] = fig(
    "ffem",
    "Three frames of a chemical reaction, the middle one being the moment of change that laser "
    "flashes made visible for the first time",
    660, 334,
    '<g class="ln"><rect x="60" y="60" width="160" height="130" rx="12"/>'
    '<rect x="250" y="60" width="160" height="130" rx="12"/>'
    '<rect x="440" y="60" width="160" height="130" rx="12"/></g>'
    '<g class="ln"><circle cx="112" cy="132" r="20"/><circle cx="168" cy="132" r="20"/>'
    '<path d="M132 132h16"/></g>'
    '<g class="rd"><circle cx="292" cy="132" r="20"/><circle cx="368" cy="132" r="20"/></g>'
    + gapline(312, 132, 348, 132, 3, "rd") +
    '<g class="ln"><circle cx="474" cy="132" r="20"/><circle cx="566" cy="132" r="20"/></g>'
    + arr(516, 132, 496, 132, "ln", 8) + arr(524, 132, 544, 132, "ln", 8) +
    '<text x="330" y="88" class="t4 gold">the moment itself</text>'
    '<g class="mo"><text x="140" y="214" class="t2">before</text>'
    '<text x="520" y="214" class="t2">after</text></g>'
    '<g class="rd blink"><path d="M180 240v26M218 240v26M256 240v26M294 240v26M332 240v26'
    'M370 240v26M408 240v26M446 240v26M484 240v26"/></g>'
    + arr(330, 236, 330, 200, "rd", 9) +
    '<text x="330" y="300" class="t2 gold">the flash is briefer than the change</text>'
    '<text x="330" y="326" class="t4">a femtosecond is a millionth of a billionth of a second</text>',
    "A chemical reaction is over in femtoseconds, so for all of chemistry’s history the moment of "
    "change was invisible in principle: you could know the before and the after, never the during. "
    "At Caltech in the 1980s, Ahmed Zewail’s team learned to fire laser pulses brief enough to "
    "catch molecules in mid transformation. Chemistry acquired slow motion. In 1999 the Nobel "
    "committee gave him the chemistry prize alone, undivided, for founding femtochemistry, and "
    "the field has been speeding up ever since.")

GIFT_FIGS["the-skeleton-of-the-skyline"] = fig(
    "ftub",
    "Three towers: the old way with its strength stacked inside, the braced tube of 1969 with its "
    "strength at the skin, and nine tubes bundled in 1973",
    660, 344,
    '<g class="ln"><rect x="90" y="80" width="90" height="190"/>'
    '<path d="M120 80v190M150 80v190M90 120h90M90 160h90M90 200h90M90 240h90"/></g>'
    '<g class="ln"><rect x="290" y="70" width="90" height="200"/></g>'
    '<g class="rd"><path d="M290 70L380 140L290 210L380 270"/><path d="M380 70L290 140L380 210L290 270"/></g>'
    '<g class="ln thin"><path d="M300 70v200M320 70v200M350 70v200M370 70v200"/></g>'
    '<g class="ln"><path d="M460 270V190h120v80z"/><path d="M475 190v-70h90v70"/>'
    '<path d="M505 120V60h30v60"/><path d="M490 270V190M520 270V190M550 270V190'
    'M505 190v-70M535 190v-70"/></g>'
    + arr(46, 120, 84, 120, "rd", 8) + arr(46, 170, 84, 170, "rd", 8)
    + arr(246, 120, 284, 120, "rd", 8) + arr(246, 170, 284, 170, "rd", 8)
    + arr(416, 120, 454, 120, "rd", 8) +
    '<g class="ln"><path d="M40 276h580"/></g>'
    '<g class="mo"><text x="135" y="302" class="t4">the old way</text>'
    '<text x="135" y="324" class="t4">steel piled inside</text>'
    '<text x="335" y="302" class="t4">the braced tube</text>'
    '<text x="335" y="324" class="t4">1969</text>'
    '<text x="520" y="302" class="t4">nine tubes bundled</text>'
    '<text x="520" y="324" class="t4">1973</text>'
    '<text x="42" y="102" class="t4 ts gold">wind</text></g>',
    "Before Khan, a tall building was brute force: stack a dense skeleton inside and pay for it in "
    "steel, money and darkness. He saw that a tower could work as a hollow tube instead, its "
    "strength moved out to the perimeter, walls of closely spaced columns or great visible braces "
    "carrying the wind. The idea unfolded in stages: the framed tube, then the braced tube of the "
    "John Hancock Center, then the bundled tube of the Sears Tower, nine tubes clustered like "
    "reeds, tallest in the world for a quarter century and raised with far less steel than the "
    "old way demanded.")

GIFT_FIGS["the-ongoing-river"] = fig(
    "friv",
    "A brick wall left deliberately one course short, with the outline of the next brick waiting "
    "to be laid",
    660, 276,
    '<text x="330" y="60" class="t2">a wall meant to continue is left one course short</text>'
    '<g class="ln"><path d="M60 220h540M60 190h540M60 160h540M60 130h540M60 100h352"/>'
    '<path d="M104 190v30M192 190v30M280 190v30M368 190v30M456 190v30M544 190v30"/>'
    '<path d="M148 160v30M236 160v30M324 160v30M412 160v30M500 160v30"/>'
    '<path d="M104 130v30M192 130v30M280 130v30M368 130v30M456 130v30M544 130v30"/>'
    '<path d="M148 100v30M236 100v30M324 100v30"/></g>'
    + gapline(412, 100, 500, 100, 5, "rd") + gapline(412, 100, 412, 130, 3, "rd")
    + gapline(500, 100, 500, 130, 3, "rd") +
    '<text x="330" y="256" class="t4 gold">the next name is not written yet</text>',
    "This hall ends without names, on purpose. Somewhere tonight a Muslim scientist is watching a "
    "screen fill with data, a surgeon is closing a wound with dissolving thread, an engineer is "
    "checking wind loads on a tower, and a graduate student is doubting an inherited claim exactly "
    "the way Ibn al-Haytham taught. They are millions, on every continent, and history has not yet "
    "decided which of their gifts will fill halls like this one. The river that ran through "
    "Baghdad, Cordoba, Cairo and Samarkand did not end. You are standing in it.")

# --- the lives --------------------------------------------------------------

LIFE_FIGS["umar-ibn-abd-al-aziz"] = fig(
    "pumr",
    "A ledger in which seized property, a wife’s jewels and the royal stables all move back into "
    "the public treasury",
    520, 262,
    '<text x="260" y="30" class="t3">the ledger, put right</text>'
    '<g class="mo"><text x="250" y="82" class="t4 te">his own estates, first</text>'
    '<text x="250" y="122" class="t4 te">his wife’s jewels</text>'
    '<text x="250" y="162" class="t4 te">the royal stables, refused</text></g>'
    + arr(262, 76, 334, 76, "rd", 9) + arr(262, 116, 334, 116, "rd", 9)
    + arr(262, 156, 334, 156, "rd", 9) +
    '<g class="ln"><rect x="340" y="50" width="150" height="140" rx="12"/>'
    '<ellipse cx="415" cy="150" rx="34" ry="9"/><ellipse cx="415" cy="136" rx="34" ry="9"/>'
    '<ellipse cx="415" cy="122" rx="34" ry="9"/></g>'
    '<g class="mo"><text x="415" y="82" class="t4">the public</text>'
    '<text x="415" y="102" class="t4">treasury</text></g>'
    '<text x="260" y="222" class="t4">and the tax that treated converts as outsiders, ended</text>'
    '<text x="260" y="248" class="t4 gold">thirty months, from Spain to the borders of China</text>',
    "He began as the best dressed man of the Umayyad house and ruled as an act of repentance. The "
    "returning started with his own estates, which is why it was believed. Non Arab converts, long "
    "taxed as though they had never entered Islam, got the equality the faith had promised them, "
    "and he set scholars to writing down hadith, the Prophet’s ﷺ sayings. Thirty months, and then it stopped.")

LIFE_FIGS["ash-shafii"] = fig(
    "pshf",
    "A new question passing down four ordered sources of law and coming out as an answer with its "
    "reasons attached",
    520, 288,
    '<g class="ln"><rect x="150" y="26" width="220" height="40" rx="14"/></g>'
    '<text x="260" y="52" class="t4">a new question</text>'
    + arr(260, 66, 260, 78, "rd", 8) +
    '<g class="ln"><rect x="60" y="82" width="400" height="32" rx="8"/>'
    '<rect x="60" y="120" width="400" height="32" rx="8"/>'
    '<rect x="60" y="158" width="400" height="32" rx="8"/>'
    '<rect x="60" y="196" width="400" height="32" rx="8"/></g>'
    '<g class="mo"><text x="260" y="103" class="t4">the Qur'an</text>'
    '<text x="260" y="141" class="t4">the Sunnah, the way of the Prophet ﷺ</text>'
    '<text x="260" y="179" class="t4">ijma, what the scholars agreed</text>'
    '<text x="260" y="217" class="t4">qiyas, likeness to a case already settled</text></g>'
    '<g class="rd"><path d="M40 82v146"/><path d="M40 98h14M40 136h14M40 174h14M40 212h14"/></g>'
    + arr(260, 228, 260, 244, "rd", 8) +
    '<text x="260" y="272" class="t4 gold">an answer, and the shared rules that reached it</text>',
    "Before him, brilliant jurists disagreed. After him they disagreed by shared rules, because he "
    "had written the grammar of the argument: which sources speak, in what order, and how they "
    "interlock. He also did the thing scholars fear most and publicly revised himself in Egypt, so "
    "his school transmits an old opinion and a new opinion side by side.")

LIFE_FIGS["ahmad-ibn-hanbal"] = fig(
    "phan",
    "A row of figures bent under pressure with one standing upright, the man who would not say "
    "the words during the inquisition",
    520, 268,
    '<text x="260" y="30" class="t3">the mihna, the inquisition, from 833</text>'
    '<g class="ln"><path d="M30 196c0-24 2-44 16-48M72 196c0-24 2-44 16-48M114 196c0-24 2-44 16-48'
    'M156 196c0-24 2-44 16-48M198 196c0-24 2-44 16-48"/>'
    '<circle cx="52" cy="146" r="7"/><circle cx="94" cy="146" r="7"/><circle cx="136" cy="146" r="7"/>'
    '<circle cx="178" cy="146" r="7"/><circle cx="220" cy="146" r="7"/></g>'
    '<g class="ln"><path d="M282 196c0-24 2-44 16-48M324 196c0-24 2-44 16-48M366 196c0-24 2-44 16-48'
    'M408 196c0-24 2-44 16-48M450 196c0-24 2-44 16-48"/>'
    '<circle cx="304" cy="146" r="7"/><circle cx="346" cy="146" r="7"/><circle cx="388" cy="146" r="7"/>'
    '<circle cx="430" cy="146" r="7"/><circle cx="472" cy="146" r="7"/></g>'
    '<g class="rd"><path d="M251 196v-64"/><circle cx="251" cy="122" r="9"/></g>'
    '<circle cx="251" cy="132" r="26" class="halo2"/>'
    '<g class="ln"><path d="M20 196h480"/></g>'
    '<text x="260" y="230" class="t4">the doctrine of the state, contradicted by one man</text>'
    '<text x="260" y="256" class="t4 gold">and he never once blamed the ones who bent</text>',
    "The question was technical and the principle was not: can a ruler dictate what the community "
    "must believe? Through interrogation, prison and a public flogging that left him unconscious, "
    "he would not say the words. Most others complied under duress, and he never condemned them "
    "for it. The policy collapsed; creed is settled by evidence and conscience, not by decree, "
    "because one man absorbed the whip to prove it.")

LIFE_FIGS["al-bukhari"] = fig(
    "pbuk",
    "A sieve narrowing six hundred thousand collected reports down to the few thousand that "
    "passed every test",
    520, 336,
    '<text x="260" y="32" class="t3">the sieve</text>'
    '<text x="260" y="64" class="t4">600,000 reports, by the tradition’s own count</text>'
    '<g class="ln"><path d="M50 84L202 210v30h116v-30L470 84"/></g>'
    '<g class="rd"><path d="M64 96h392M101 126h318M137 156h246M173 186h174"/></g>'
    '<g class="mo"><text x="260" y="118" class="t4">did each one truly meet the next?</text>'
    '<text x="260" y="148" class="t4">how exact was his memory?</text>'
    '<text x="260" y="178" class="t4">and what was he like?</text></g>'
    '<g class="rd"><path d="M254 244L162 264M266 244L358 264"/></g>'
    '<g class="mo-pop"><text x="150" y="296" class="t1 gold">7,275</text>'
    '<text x="386" y="296" class="t1 gold">2,600</text></g>'
    '<g class="mo"><text x="150" y="320" class="t4">with repetitions</text>'
    '<text x="386" y="320" class="t4">counted once each</text></g>',
    "He rejected the report of a man he saw luring his horse with an empty feedbag, reasoning that "
    "someone who deceives his animal cannot be trusted with the Prophet’s ﷺ words. Every link was "
    "tested: each narrator’s memory, accuracy and character, and proof that each had truly met the "
    "next. The counts are the tradition’s own accounting, and are marked as such. The method is "
    "what this room honours: doubt made rigorous, placed wholly in the service of trust.")

LIFE_FIGS["fatima-al-fihri"] = fig(
    "pfat",
    "One endowment made in 859 still paying out along an unbroken line of years, while dynasties "
    "rise and fall above it",
    520, 268,
    '<text x="260" y="30" class="t3">one gift, still paying out</text>'
    '<g class="ln thin"><path d="M60 140A38 38 0 0 1 136 140"/><path d="M150 140A30 30 0 0 1 210 140"/>'
    '<path d="M220 140A46 46 0 0 1 312 140"/><path d="M320 140A34 34 0 0 1 388 140"/>'
    '<path d="M395 140A42 42 0 0 1 479 140"/></g>'
    '<text x="260" y="88" class="t4">dynasties rise and fall</text>'
    '<g class="rd"><path d="M50 180h410"/></g>'
    + arr(455, 180, 480, 180, "rd", 9) +
    '<circle cx="50" cy="180" r="7" class="nd"/>'
    '<g class="ln thin"><path d="M100 180v9M170 180v9M240 180v9M311 180v9M381 180v9M451 180v9"/></g>'
    '<g class="mo"><text x="50" y="166" class="t2 gold">859</text>'
    '<text x="100" y="206" class="t4">1000</text><text x="240" y="206" class="t4">1400</text>'
    '<text x="381" y="206" class="t4">1800</text>'
    '<text x="470" y="164" class="t4 te gold">still teaching</text></g>'
    '<text x="260" y="234" class="t4">waqf, an endowment held forever</text>'
    '<text x="260" y="258" class="t4">still paying out to students she would never meet</text>',
    "Two sisters inherited serious wealth in Fez and each answered it the same way: each endowed a "
    "mosque. Around Fatima’s grew teaching circles, then chairs, then a library, then degrees, and "
    "al-Qarawiyyin has never stopped teaching. Her own life is thinly documented, and the fullest "
    "account was written centuries later, which is instructive in itself: she built something so "
    "much larger than her biography that the building survived and the biography thinned.")

LIFE_FIGS["karima-al-marwaziyya"] = fig(
    "pkar",
    "A student’s copy read back line by line against her verified original, one error caught, and "
    "only then licensed",
    520, 276,
    '<g class="ln"><rect x="50" y="60" width="180" height="140" rx="6"/>'
    '<path d="M66 84h148M66 104h148M66 124h148M66 144h148M66 164h148M66 184h110"/></g>'
    '<g class="ln"><rect x="290" y="60" width="180" height="140" rx="6"/>'
    '<path d="M306 84h148M306 104h148M306 124h148M306 164h148M306 184h110"/></g>'
    '<g class="rd"><path d="M306 144h120"/><circle cx="444" cy="144" r="7"/></g>'
    '<g class="rd"><path d="M238 130h44"/><path d="M246 124l-8 6 8 6M274 124l8 6-8 6"/></g>'
    '<text x="260" y="44" class="t4">read back, line by line</text>'
    '<g class="mo"><text x="140" y="222" class="t4">her verified copy</text>'
    '<text x="380" y="222" class="t4">the student’s copy</text></g>'
    '<g class="ln"><circle cx="110" cy="248" r="15"/></g>'
    + star(110, 248, 7, "nd") +
    '<text x="136" y="254" class="t4 ts">ijazah, her licence to pass it on</text>',
    "In an age when a book lived or died by the accuracy of its copies, she did not simply let "
    "students copy: she made them collate, reading their manuscript back against her verified "
    "original, error by error, before she would license it. Scholars who had crossed the world "
    "accepted her discipline gladly. Some classical chains of the Sahih, Bukhari’s Authentic, recited in mosques "
    "still pass through her name.")

LIFE_FIGS["mansa-musa"] = fig(
    "pmus",
    "A line showing the price of gold in Cairo sagging after his caravan arrived in 1324 and "
    "taking years to recover",
    520, 280,
    '<text x="260" y="30" class="t3">the price of gold in Cairo</text>'
    '<g class="ln thin"><path d="M50 60v140h420"/></g>'
    '<g class="rd"><path d="M50 96h100C180 96 200 160 236 166C300 176 380 132 450 110"/></g>'
    '<circle cx="150" cy="96" r="7" class="nd"/><circle cx="236" cy="166" r="6" class="nd"/>'
    '<g class="mo"><text x="196" y="76" class="t4">1324, the caravan reaches Cairo</text>'
    '<text x="256" y="192" class="t4">the market sags</text>'
    '<text x="470" y="100" class="t4 te">years to come back</text></g>'
    '<text x="260" y="234" class="t4">one man’s giving bent a metal market</text>'
    '<text x="260" y="260" class="t4 gold">and he came home with scholars, jurists and an architect</text>',
    "The spectacle is not why he is here; the return journey is. He spent his treasure on "
    "institutions: the Djinguereber mosque, endowments for teachers, the patronage that helped "
    "turn a Saharan trading town into a city of books. The figures are the chroniclers’ own and "
    "medieval numbers are held loosely. Honesty must count everything in the caravan: the same "
    "chronicles count thousands of enslaved people in it, and this hall does not launder kings.")

LIFE_FIGS["ahmad-baba"] = fig(
    "pbab",
    "Five family libraries drawn as stacks of different heights, his own the smallest at sixteen "
    "hundred volumes",
    520, 274,
    '<text x="260" y="30" class="t3">his was the smaller collection</text>'
    '<g class="ln thin"><path d="M70 62h366M70 62v10M436 62v10"/></g>'
    '<text x="253" y="52" class="t4">one family, one street in Timbuktu</text>'
    '<g class="ln"><rect x="70" y="90" width="46" height="120"/><rect x="150" y="114" width="46" height="96"/>'
    '<rect x="310" y="70" width="46" height="140"/><rect x="390" y="102" width="46" height="108"/></g>'
    '<g class="rd"><rect x="230" y="140" width="46" height="70"/></g>'
    '<g class="ln"><path d="M40 210h440"/></g>'
    '<text x="253" y="234" class="t4 gold">1,600 volumes</text>'
    '<text x="260" y="260" class="t4">1593: the libraries plundered, the scholar taken in chains</text>',
    "Timbuktu had hundreds of teachers, thousands of students, and private libraries on every "
    "scholarly street. When a Moroccan army broke the Songhay state, the conquerors distrusted its "
    "independent scholars, and he crossed the Sahara in chains, asking his jailers publicly what "
    "crime a scholar and his books had committed. His most consequential pages ruled that no one "
    "may be enslaved for colour or origin, and that freedom is the default state of the children "
    "of Adam. Within his era’s categories he still accepted the institution for non Muslim "
    "captives, a limit that must be stated plainly.")

LIFE_FIGS["nana-asmau"] = fig(
    "pasm",
    "A teaching network drawn as a hub with spokes: trained women walk out to the villages, and "
    "each village sends women home as teachers themselves",
    520, 336,
    '<text x="260" y="30" class="t3">yan-taru, the associates</text>'
    '<g class="ln thin"><path d="M260 152h88M260 152l44 76M260 152l-44 76M260 152h-88'
    'M260 152l-44-76M260 152l44-76"/></g>'
    '<g class="ln"><circle cx="260" cy="152" r="24"/><circle cx="348" cy="152" r="10"/>'
    '<circle cx="304" cy="228" r="10"/><circle cx="216" cy="228" r="10"/><circle cx="172" cy="152" r="10"/>'
    '<circle cx="216" cy="76" r="10"/><circle cx="304" cy="76" r="10"/></g>'
    + dots([(260 + 116 * math.cos(math.radians(a)), 152 + 116 * math.sin(math.radians(a)))
            for a in [-13, 0, 13, 47, 60, 73, 107, 120, 133, 167, 180, 193, 227, 240, 253, 287, 300, 313]]) +
    '<g class="rd"><path d="M286 152h40"/><path d="M316 146l10 6-10 6"/>'
    '<path d="M234 152h-40"/><path d="M204 146l-10 6 10 6"/></g>'
    '<text x="260" y="300" class="t4">the centre is Sokoto, and every spoke is a village</text>'
    '<text x="260" y="324" class="t4 gold">they came to study, and walked home as teachers</text>',
    "Surveying a countryside of displaced, uneducated rural women, she built the yan-taru, the "
    "associates: trained women leaders called jajis carried her teaching poems from Sokoto to the "
    "villages and back. Verse was the technology, composed in the languages women actually spoke, "
    "easy to memorize, covering creed, law, hygiene and the lives of exemplary women. A school "
    "with no building, replicating itself along footpaths. In northern Nigeria today, learned "
    "women leaders still carry the title jaji.")

LIFE_FIGS["said-nursi"] = fig(
    "pnur",
    "One handwritten page multiplying into columns of hand copies, with the printing press denied",
    520, 280,
    '<g class="ln"><rect x="50" y="100" width="60" height="76" rx="4"/>'
    '<path d="M62 120h36M62 136h36M62 152h24"/><path d="M80 96l10-14 8 6-10 14z"/></g>'
    + arr(120, 138, 152, 138, "rd", 8) +
    '<g class="rd"><rect x="160" y="122" width="26" height="32" rx="3"/>'
    '<rect x="215" y="92" width="26" height="32" rx="3"/><rect x="215" y="132" width="26" height="32" rx="3"/>'
    '<rect x="215" y="172" width="26" height="32" rx="3"/>'
    '<rect x="270" y="72" width="26" height="32" rx="3"/><rect x="270" y="102" width="26" height="32" rx="3"/>'
    '<rect x="270" y="132" width="26" height="32" rx="3"/><rect x="270" y="162" width="26" height="32" rx="3"/>'
    '<rect x="270" y="192" width="26" height="32" rx="3"/></g>'
    '<g class="ln"><rect x="380" y="110" width="90" height="60" rx="4"/><path d="M425 110V86h-24"/>'
    '<path d="M392 130h66M392 148h66"/></g>'
    '<g class="strike"><path d="M382 106l88 68M470 106l-88 68"/></g>'
    '<g class="mo"><text x="40" y="204" class="t4 ts">one page, in exile</text>'
    '<text x="425" y="196" class="t4">no press allowed</text></g>'
    '<text x="260" y="244" class="t4">copied by hand, hundreds of thousands of times</text>'
    '<text x="260" y="268" class="t4 gold">carried in coat linings and flour sacks</text>',
    "Exiled to a remote village, then tried and imprisoned across decades, he wrote the Risale-i "
    "Nur, the Epistles of Light, some six thousand pages arguing belief from reflection: an eye, a "
    "seed, an orbit, read as a book that implies its Author. Denied presses, his students copied "
    "it by hand. He called each prison a school of Joseph, after the prophet Yusuf who was jailed "
    "unjustly and kept teaching, and he was acquitted in the end in every major trial.")

LIFE_FIGS["abdul-sattar-edhi"] = fig(
    "pedh",
    "One battered van in Karachi, and the ambulance network spreading outward from it in widening "
    "arcs across the country",
    520, 306,
    '<g class="rd"><rect x="60" y="116" width="54" height="26" rx="4"/><path d="M114 126h16l10 16h-26z"/>'
    '<circle cx="76" cy="150" r="8"/><circle cx="124" cy="150" r="8"/><path d="M87 129h10M92 124v10"/></g>'
    '<g class="ln thin"><path d="M186 64A120 120 0 0 1 186 198"/>'
    '<path d="M250 44A185 185 0 0 1 250 218"/><path d="M319 37A250 250 0 0 1 319 225"/></g>'
    + dots([(87 + r * math.cos(math.radians(a)), 131 + r * math.sin(math.radians(a)))
            for r, ang in [(120, [-30, 0, 30]), (185, [-24, -8, 8, 24]),
                           (250, [-18, -6, 6, 18])] for a in ang]) +
    '<g class="ln"><path d="M400 128c0 18 14 30 30 30s30-12 30-30z"/><path d="M400 128h60"/>'
    '<path d="M430 128v-22M418 106h24"/></g>'
    '<g class="mo"><text x="40" y="178" class="t4 ts">one battered van</text>'
    '<text x="432" y="184" class="t4">a cradle at the door</text></g>'
    '<text x="260" y="268" class="t4">the largest volunteer ambulance network in the world</text>'
    '<text x="260" y="294" class="t4 gold">and no one was asked what faith they were</text>',
    "A donation bought the van, and he drove it himself to accidents, floods and riots. Out of it "
    "grew homes for orphans, the disabled and the mentally ill, kitchens, morgues, and outside "
    "every centre a jhoola, a cradle, with a sign begging mothers to leave their infants there "
    "rather than kill them. He washed unclaimed corpses himself and buried them with prayer, by "
    "the tens of thousands. Asked why his ambulances carried Christians and Hindus, he gave the "
    "answer Pakistan still quotes: because the ambulance is more Muslim than you.")

LIFE_FIGS["fazlur-rahman-khan"] = fig(
    "pkha",
    "Two plans of the same tower: the old way with its strength stacked inside, and the tube with "
    "its strength moved out to the skin and the floor left open",
    520, 300,
    '<g class="ln"><rect x="60" y="80" width="160" height="160"/>'
    '<path d="M92 80v160M124 80v160M156 80v160M188 80v160'
    'M60 112h160M60 144h160M60 176h160M60 208h160"/></g>'
    '<g class="ln"><rect x="300" y="80" width="160" height="160"/></g>'
    '<g class="rd"><path d="M300 80v14M320 80v14M340 80v14M360 80v14M380 80v14M400 80v14M420 80v14'
    'M440 80v14M460 80v14M300 226v14M320 226v14M340 226v14M360 226v14M380 226v14M400 226v14'
    'M420 226v14M440 226v14M460 226v14"/>'
    '<path d="M300 80h14M300 100h14M300 120h14M300 140h14M300 160h14M300 180h14M300 200h14M300 220h14'
    'M446 80h14M446 100h14M446 120h14M446 140h14M446 160h14M446 180h14M446 200h14M446 220h14"/></g>'
    + arr(20, 120, 54, 120, "rd", 8) + arr(20, 160, 54, 160, "rd", 8) + arr(20, 200, 54, 200, "rd", 8)
    + arr(258, 120, 294, 120, "rd", 8) + arr(258, 160, 294, 160, "rd", 8) + arr(258, 200, 294, 200, "rd", 8) +
    '<g class="mo"><text x="20" y="104" class="t4 ts gold">wind</text>'
    '<text x="140" y="268" class="t4">the strength inside</text>'
    '<text x="140" y="290" class="t4">and a great deal of steel</text>'
    '<text x="380" y="268" class="t4">the strength at the skin</text>'
    '<text x="380" y="290" class="t4">and the floor opens up</text></g>',
    "A hollow tube grips the wind far better than a filled frame of the same steel, because the "
    "material doing the work sits as far from the centre as it can get. That one move freed the "
    "floor plan, cut the steel, and made supertall building economical again. He warned that the "
    "technical man must not be lost in his own technology, and most of the people who live inside "
    "his idea will never know his name, which he would have counted as the system working "
    "correctly.")


# ----------------------------------------------------------------- halls

def hall_torchbearers():
    out = ['<section id="torchbearers" class="hall">',
           '<div class="wrapw">',
           '<div class="hall-head mo"><p class="hall-k">Hall one</p>',
           '<h2 class="hall-t">The Torchbearers</h2>',
           '<p class="hall-l">Thirty lives, six eras, one unbroken line. None of these are plaster saints. '
           'Several were jailed, one was flogged for refusing a sentence, one walked away from the most '
           'famous chair in the Muslim world because his soul was in pieces, and more than one served '
           'rulers you would not want to serve. Where a life carries a cost or a complication, this room '
           'prints it plainly under <b>The full picture</b>. The generation before these opens in '
           '<a href="companions.html">the room of the Companions</a>, and the sciences most of them '
           'taught are laid out in <a href="school.html">the School</a>.</p></div>']
    for e in eras:
        out.append('<section class="rsec era" id="era-%s">' % att(e["id"]))
        out.append('<div class="sh"><h3 class="eh">%s</h3><span class="pill">%s</span></div>'
                   % (esc(e["title"]), esc(e["years"])))
        out.append('<p class="sub">%s</p>' % esc(e["lead"]))
        out.append('<div class="pgrid">')
        for p in e["people"]:
            her = she(p)
            out.append(person_card(p, her))
        out.append('</div></section>')
    out.append(fig_lamps())
    out.append('</div></section>')
    return "\n".join(out)


def person_card(p, her):
    ps = "".join("<p>%s</p>" % esc(x) for x in p["ps"])
    cav = ""
    if p.get("caveat"):
        cav = ('<div class="pc-cav"><span class="pc-ck">The full picture</span>'
               '<p>%s</p></div>' % esc(p["caveat"]))
    return ("""<article class="card pcard mo" id="%s">
<div class="pc-h">
<div class="pc-ar font-amiri notranslate" translate="no">%s</div>
<h4 class="pc-n">%s</h4>
<p class="pc-m">%s <span class="dotsep">·</span> %s</p>
<p class="pc-r"><span class="pill">%s</span></p>
</div>
<details class="pc-d">
<summary class="pc-s"><span class="pc-t">%s</span>
<span class="pc-btn"><span class="lb-a">Read %s life</span><span class="lb-b">Close this life</span><span class="chev" aria-hidden="true"></span></span></summary>
<div class="pc-body">%s</div>
</details>
%s<div class="pc-light"><span class="pc-lk">The light %s carried</span><p>%s</p></div>
%s</article>""" % (att(p["id"]), esc(p["ar"]), esc(p["name"]), esc(p["dates"]), esc(p["place"]),
                   esc(p["role"]), teaser(p["ps"][0]), "her" if her else "his",
                   ps, LIFE_FIGS.get(p["id"], ""), "she" if her else "he", esc(p["light"]), cav))


def hall_gifts():
    out = ['<section id="gifts" class="hall">',
           '<div class="wrapw">',
           '<div class="hall-head mo"><p class="hall-k">Hall two</p>',
           '<h2 class="hall-t">The Gifts</h2>',
           '<p class="hall-l">Thirty things this civilization handed the world, and where each one lives '
           'in your day. Read this hall honestly: almost nothing here was invented out of nothing. '
           'Numerals came from India, medicine and philosophy from Greece and Persia, paper from China. '
           'What happened in Baghdad, Cordoba, Cairo, Samarkand and Timbuktu was that scattered knowledge '
           'was gathered, tested, corrected, taught, and passed on enlarged. Carrying a thing carefully '
           'and handing it forward improved is its own glory, and it is the glory this hall claims. '
           'Where the evidence is strong we say so. Where a thread is real but thin, or loved more than '
           'it is proven, we say that too, rather than borrow credit that is not ours.</p>',
           '<div class="legend">'
           '<span class="lg"><span class="evb quran">Documented</span> firm sources, dated and traceable</span>'
           '<span class="lg"><span class="evb sunnah">Traced</span> a real thread, some links reconstructed</span>'
           '<span class="lg"><span class="evb debated">Beloved story</span> told for centuries, thin on proof</span>'
           '</div></div>',
           FIG_ROAD]
    for f in fields:
        out.append('<section class="rsec fieldsec" id="f-%s">' % att(f["id"]))
        out.append('<div class="sh"><span class="ficon" data-ic="%s" aria-hidden="true"></span>'
                   '<h3 class="eh">%s</h3></div>'
                   % (att(ICONS.get(f["icon"], f["icon"])), esc(f["title"])))
        for g in f["gifts"]:
            out.append(gift_card(g))
        out.append('</section>')
    out.append('</div></section>')
    return "\n".join(out)


def gift_card(g):
    cls, label = LEVELS.get(g.get("level", "solid"), LEVELS["solid"])
    ps = "".join("<p>%s</p>" % esc(x) for x in g["ps"])
    return ("""<article class="card gcard mo">
<div class="gc-h"><h4 class="gc-t">%s</h4><span class="evb %s">%s</span></div>
<p class="gc-m">%s <span class="dotsep">·</span> %s</p>
%s
%s
<div class="gc-now"><span class="gc-nk">Where it lives now</span><p>%s</p></div>
</article>""" % (esc(g["t"]), cls, label, esc(g["who"]), esc(g["where"]), ps,
                 GIFT_FIGS[slug(g["t"])], esc(g["today"])))


# ----------------------------------------------------------------- page

DOORS = """<div class="wrapw">
<p class="argloss"><span class="notranslate" translate="no">حَمَلَةُ الْمِشْكَاة</span> Hamalat al-Mishkah, the carriers of the niche, the small alcove in a wall where a lamp is set so one flame can light a whole room.</p>
<div class="doors" data-mo-stagger>
<a class="door mo" href="#torchbearers">
<span class="d-k">Hall one</span>
<span class="d-t">The Torchbearers</span>
<span class="d-c"><b class="mo-count" data-n="%d">%d</b> lives</span>
<span class="d-p">From the generation who only touched the hands that touched his ﷺ, to a chemist in California who filmed a molecule breaking. Six eras, told with their costs.</span>
<span class="d-go">Walk the centuries</span>
</a>
<a class="door mo" href="#gifts">
<span class="d-k">Hall two</span>
<span class="d-t">The Gifts</span>
<span class="d-c"><b class="mo-count" data-n="%d">%d</b> gifts</span>
<span class="d-p">Algebra, the hospital, the camera, the coffee in your cup. Eight fields, each gift badged for how well it is evidenced, and shown where it lives in your day.</span>
<span class="d-go">Open the hall</span>
</a>
</div>
</div>""" % (N_PEOPLE, N_PEOPLE, N_GIFTS, N_GIFTS)


RIBBON_SEC = """<div class="wrapw">
<section class="rsec ribsec">
<div class="sh"><h2 class="eh">Thirteen centuries on one line</h2></div>
<p class="sub">Every lamp on this ribbon is a life in the hall below. Drag it sideways, or use the arrows, then tap any lamp to open that life where it sits. The bands behind are the six eras; the dots are placed at the middle of each life, so a long life sits where its work was done.</p>
%s
<div class="rib-ctl">
<button type="button" class="ribarrow" data-rib="prev" aria-label="Scroll the ribbon earlier"><span class="cv l"></span></button>
<p class="rib-read" id="rib-read">Tap any lamp on the line to open that life.</p>
<button type="button" class="ribarrow" data-rib="next" aria-label="Scroll the ribbon later"><span class="cv r"></span></button>
</div>
</section>
</div>"""


CLOSE = """<div class="wrap">
<section class="closeband mo">
<p class="cb-t">This room is a first draft of a very long story.</p>
<p class="cb-p">Thirty lives out of millions, thirty gifts out of thousands. If a date is bent, a name is wronged, a caveat is missing, or someone who should be here is not, tell us and we will fix it in the open.</p>
<div class="cb-a"><a class="ghost" href="feedback.html">Send a correction</a><a class="gpill" href="donate.html">Keep the lamp lit ✦</a></div>
</section>
</div>"""


CSS = """
html{scroll-behavior:smooth;scroll-padding-top:4.5rem}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
main{padding-bottom:1rem}
.argloss{max-width:40rem;margin:1.6rem auto .2rem;text-align:center;font-size:.8rem;line-height:1.8;color:rgba(44,36,22,.6)}
.argloss span{font-family:Amiri,serif;font-size:1.15rem;color:var(--gold);margin-inline-end:.35rem;vertical-align:-.05em}
.dotsep{color:rgba(44,36,22,.32);padding:0 .1rem}

/* the two doors */
.doors{display:grid;gap:.9rem;grid-template-columns:1fr;margin:1.4rem 0 .4rem}
@media (min-width:40rem){.doors{grid-template-columns:1fr 1fr;gap:1.1rem}}
.door{position:relative;display:flex;flex-direction:column;align-items:flex-start;text-decoration:none;color:#FFFEF7;background:linear-gradient(168deg,#14100A,#1a2340 58%,#22305a);border:1px solid rgba(244,212,106,.26);border-radius:22px;padding:1.6rem 1.4rem 1.35rem;min-height:15.5rem;overflow:hidden;box-shadow:0 14px 34px rgba(20,16,10,.16);transition:transform .22s,box-shadow .22s,border-color .22s}
.door::before{content:"";position:absolute;inset:.6rem;border:1px solid rgba(244,212,106,.16);border-radius:999px 999px 15px 15px;pointer-events:none}
.door::after{content:"";position:absolute;top:-30%;inset-inline-start:50%;width:70%;height:70%;transform:translateX(-50%);background:radial-gradient(circle,rgba(244,212,106,.22),transparent 68%);pointer-events:none}
.door:hover{transform:translateY(-3px);border-color:rgba(244,212,106,.5);box-shadow:0 20px 44px rgba(20,16,10,.26)}
.door:focus-visible{outline:2px solid var(--gold-hi);outline-offset:3px}
.d-k{font-size:.58rem;letter-spacing:.22em;text-transform:uppercase;font-weight:800;color:rgba(244,212,106,.72);position:relative;z-index:2}
.d-t{font-size:1.42rem;font-weight:800;letter-spacing:-.01em;margin:.5rem 0 .2rem;position:relative;z-index:2;line-height:1.15}
.d-c{font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,254,247,.5);position:relative;z-index:2}
.d-c b{font-family:Amiri,serif;font-size:1.5rem;font-weight:700;color:var(--gold-hi);letter-spacing:0;margin-inline-end:.25rem;vertical-align:-.06em}
.d-p{font-size:.82rem;line-height:1.8;color:rgba(255,254,247,.7);margin:.75rem 0 0;position:relative;z-index:2}
.d-go{margin-top:auto;padding-top:1rem;font-size:.76rem;font-weight:800;color:var(--gold-hi);position:relative;z-index:2}
.d-go::after{content:"";display:inline-block;width:.4rem;height:.4rem;border-inline-end:1.6px solid currentColor;border-top:1.6px solid currentColor;transform:rotate(45deg);margin-inline-start:.45rem;vertical-align:.06em;transition:transform .2s}
.door:hover .d-go::after{transform:rotate(45deg) translate(2px,-2px)}

/* the century ribbon */
.ribsec .sub{max-width:42rem}
.ribbon{position:relative;margin:1rem 0 .2rem;border:1px solid rgba(244,212,106,.22);border-radius:18px;background:linear-gradient(170deg,#14100A,#1b2440);overflow:hidden}
.rib-scroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:thin;scrollbar-color:rgba(244,212,106,.45) transparent}
.rib-scroll::-webkit-scrollbar{height:6px}
.rib-scroll::-webkit-scrollbar-thumb{background:rgba(244,212,106,.4);border-radius:999px}
.rib-scroll:focus-visible{outline:2px solid var(--gold-hi);outline-offset:-2px}
.rib-track{position:relative;height:240px}
.rib-band{position:absolute;top:0;bottom:0;border-inline-start:1px solid rgba(244,212,106,.16)}
.rib-band.b0{background:rgba(244,212,106,.055)}
.rib-band.b1{background:rgba(255,254,247,.028)}
.rb-t{position:absolute;left:.5rem;font-size:.56rem;line-height:1.05;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:rgba(244,212,106,.62);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rb-t.r0{top:.5rem}
.rb-t.r1{top:1.6rem;color:rgba(255,254,247,.5)}
.rib-axis{position:absolute;left:0;top:0;fill:none;stroke:rgba(244,212,106,.55);stroke-width:1.4;stroke-linecap:round}
.rib-yr{position:absolute;top:202px;transform:translateX(-50%);font-size:.6rem;font-weight:700;color:rgba(255,254,247,.42);letter-spacing:.04em}
.rdot{position:absolute;transform:translateX(-50%);width:28px;height:74px;padding:0;margin:0;border:0;background:none;cursor:pointer;scroll-snap-align:center;display:flex;align-items:center}
.rdot.r0{top:46px;flex-direction:column-reverse}
.rdot.r1{top:120px;flex-direction:column}
.rd-stem{flex:1;width:1px;background:linear-gradient(to bottom,rgba(244,212,106,.15),rgba(244,212,106,.6))}
.rdot.r1 .rd-stem{background:linear-gradient(to top,rgba(244,212,106,.15),rgba(244,212,106,.6))}
.rd-eye{width:13px;height:13px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#FFF3CB,#C9A227);box-shadow:0 0 0 3px rgba(244,212,106,.14),0 0 12px rgba(244,212,106,.5);transition:transform .18s,box-shadow .18s}
.rdot:hover .rd-eye,.rdot:focus-visible .rd-eye{transform:scale(1.45);box-shadow:0 0 0 5px rgba(244,212,106,.22),0 0 18px rgba(244,212,106,.85)}
.rdot:focus-visible{outline:2px solid var(--gold-hi);outline-offset:2px;border-radius:10px}
.rib-fade{position:absolute;top:0;bottom:0;width:2.2rem;pointer-events:none}
.rf-l{left:0;background:linear-gradient(to right,rgba(20,16,10,.92),transparent)}
.rf-r{right:0;background:linear-gradient(to left,rgba(27,36,64,.92),transparent)}
.rib-ctl{display:flex;align-items:center;gap:.7rem;margin:.6rem 0 0}
.rib-read{flex:1;text-align:center;font-size:.74rem;color:rgba(44,36,22,.55);margin:0;line-height:1.6;min-height:1.2rem}
.ribarrow{flex:none;width:2.1rem;height:2.1rem;border-radius:50%;border:1px solid rgba(44,36,22,.16);background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.ribarrow:hover{border-color:rgba(201,162,39,.55);background:#FFF9E8}
.cv{width:.44rem;height:.44rem;border-inline-end:1.7px solid rgba(44,36,22,.6);border-bottom:1.7px solid rgba(44,36,22,.6)}
.cv.l{transform:rotate(135deg);margin-inline-start:.16rem}
.cv.r{transform:rotate(-45deg);margin-inline-end:.16rem}

/* halls */
.hall{padding-top:.6rem}
.hall-head{margin:2.8rem 0 .2rem;padding:1.5rem 0 0;border-top:1px solid rgba(44,36,22,.1)}
.hall-k{font-size:.58rem;letter-spacing:.22em;text-transform:uppercase;font-weight:800;color:var(--gold);margin:0}
.hall-t{font-size:clamp(1.5rem,4.4vw,2rem);font-weight:800;letter-spacing:-.015em;margin:.35rem 0 0}
.hall-l{font-size:.87rem;line-height:1.85;color:rgba(44,36,22,.72);max-width:42rem;margin:.7rem 0 0}
.hall-l a{color:#8a6d13;font-weight:700;text-decoration:underline;text-underline-offset:2px}
.legend{display:flex;flex-wrap:wrap;gap:.5rem 1.1rem;margin:.9rem 0 .2rem}
.lg{display:flex;align-items:center;gap:.4rem;font-size:.72rem;color:rgba(44,36,22,.55)}
.rsec .eh{font-size:1.32rem;font-weight:800;letter-spacing:-.01em;margin:0}
.ficon{color:var(--gold);font-size:1.2rem;display:inline-flex;align-self:center}
.fieldsec .sh{align-items:center}
.era .sh{gap:.7rem}

/* the lives */
.pgrid{display:grid;gap:.85rem;grid-template-columns:1fr;align-items:start;margin-top:.9rem}
@media (min-width:48rem){.pgrid{grid-template-columns:1fr 1fr}}
.pgrid>.card{margin-top:0}
.pcard{scroll-margin-top:5rem;transition:box-shadow .3s,border-color .3s}
.pcard.lit{border-color:rgba(201,162,39,.65);box-shadow:0 0 0 3px rgba(244,212,106,.28),0 10px 26px rgba(44,36,22,.1)}
.pc-ar{font-size:1.4rem;color:var(--gold);line-height:1.55;margin-bottom:.18rem}
.pc-n{font-size:1.02rem;font-weight:800;margin:0;letter-spacing:-.01em}
.pc-m{font-size:.72rem;color:rgba(44,36,22,.55);margin:.25rem 0 .5rem;line-height:1.6}
.pc-r{margin:0 0 .1rem}
.pc-d{margin:.55rem 0 0}
.pc-s{list-style:none;cursor:pointer;display:block;border-radius:12px;padding:.2rem 0}
.pc-s::-webkit-details-marker{display:none}
.pc-s:focus-visible{outline:2px solid rgba(201,162,39,.7);outline-offset:3px}
.pc-t{display:block;font-size:.85rem;line-height:1.8;color:rgba(44,36,22,.72)}
.pc-btn{display:inline-flex;align-items:center;gap:.4rem;margin-top:.6rem;font-size:.74rem;font-weight:800;color:#8a6d13;background:rgba(244,212,106,.16);border:1px solid rgba(201,162,39,.34);border-radius:999px;padding:.42rem .9rem;transition:background .18s,border-color .18s}
.pc-s:hover .pc-btn{background:rgba(244,212,106,.3);border-color:rgba(201,162,39,.6)}
.chev{width:.34rem;height:.34rem;border-inline-end:1.7px solid currentColor;border-bottom:1.7px solid currentColor;transform:rotate(45deg) translateY(-1px);transition:transform .25s}
.pc-d[open] .chev{transform:rotate(225deg) translateY(-1px)}
.lb-b{display:none}
.pc-d[open] .lb-a{display:none}
.pc-d[open] .lb-b{display:inline}
.pc-d[open] .pc-t{display:none}
.pc-body{padding-top:.7rem}
.pc-body p{font-size:.86rem;line-height:1.9;color:rgba(44,36,22,.8);margin:0 0 .8rem}
.pc-body p:last-child{margin-bottom:0}
.pc-light{margin-top:.9rem;background:linear-gradient(120deg,rgba(244,212,106,.2),rgba(244,212,106,.07));border:1px solid rgba(201,162,39,.3);border-radius:14px;padding:.75rem .85rem}
.pc-lk{display:block;font-size:.56rem;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin-bottom:.25rem}
.pc-light p{font-size:.85rem;line-height:1.75;color:#5c4a12;margin:0;font-weight:600}
.pc-cav{margin-top:.6rem;background:rgba(44,36,22,.035);border:1px dashed rgba(44,36,22,.18);border-radius:14px;padding:.7rem .85rem}
.pc-ck{display:block;font-size:.56rem;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:rgba(44,36,22,.45);margin-bottom:.25rem}
.pc-cav p{font-size:.79rem;line-height:1.75;color:rgba(44,36,22,.6);margin:0}

/* the gifts */
.gcard{scroll-margin-top:5rem}
.gc-h{display:flex;align-items:flex-start;justify-content:space-between;gap:.7rem;flex-wrap:wrap}
.gc-t{font-size:1.02rem;font-weight:800;margin:0;letter-spacing:-.01em;flex:1;min-width:12rem}
.gc-m{font-size:.72rem;color:rgba(44,36,22,.55);margin:.3rem 0 .7rem;line-height:1.6}
.gcard p{font-size:.86rem;line-height:1.9;color:rgba(44,36,22,.8);margin:0 0 .75rem}
.gc-now{margin-top:.2rem;background:linear-gradient(120deg,rgba(244,212,106,.2),rgba(244,212,106,.07));border:1px solid rgba(201,162,39,.3);border-radius:14px;padding:.75rem .85rem}
.gc-nk{display:block;font-size:.56rem;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin-bottom:.25rem}
.gc-now p{font-size:.85rem;line-height:1.75;color:#5c4a12;margin:0;font-weight:600}
.fieldsec .fig{margin-top:1rem}

/* figures */
.fig{max-width:46rem;margin-left:auto;margin-right:auto}
.figsvg{width:100%;height:auto;display:block;overflow:visible}
.figsvg .ln,.figsvg .rd,.figsvg .strike{fill:none;stroke-linecap:round;stroke-linejoin:round}
.figsvg .ln{stroke:rgba(255,254,247,.6);stroke-width:2.4}
.figsvg .rd{stroke:var(--gold-hi);stroke-width:3.2}
.figsvg .thin{stroke:rgba(255,254,247,.34);stroke-width:1.6}
.figsvg .strike{stroke:rgba(226,138,128,.85);stroke-width:2.6}
.figsvg .nd{fill:var(--gold-hi);stroke:none}
.figsvg .flame{fill:var(--gold-hi);stroke:none}
.figsvg .halo2{fill:rgba(244,212,106,.14);stroke:none}
.figsvg text{text-anchor:middle;font-family:Inter,system-ui,sans-serif}
.figsvg .ts{text-anchor:start}
.figsvg .te{text-anchor:end}
.figsvg .t1{font-size:26px;font-weight:800;fill:#FFFEF7}
.figsvg .t2{font-size:20px;fill:rgba(255,254,247,.62)}
.figsvg .t3{font-size:17px;letter-spacing:.2em;text-transform:uppercase;font-weight:800;fill:rgba(244,212,106,.72)}
.figsvg .t4{font-size:17px;fill:rgba(255,254,247,.55)}
.figsvg .big{font-size:34px}
.figsvg .gold{fill:var(--gold-hi)}
/* the only two figures with a life of their own, both stilled for anyone who
   asks for stillness */
.figsvg .rete{transform-box:view-box;transform-origin:240px 136px}
@media (prefers-reduced-motion:no-preference){
.figsvg .rete{animation:reteturn 48s linear infinite}
.figsvg .blink{animation:fblink 3.4s ease-in-out infinite}}
@keyframes reteturn{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes fblink{0%,64%,100%{opacity:.3}72%,84%{opacity:1}}
.gcard .fig,.pcard .fig{margin-top:1.1rem;margin-bottom:1.1rem}
.lamps .flame{fill:var(--gold-hi);stroke:none;transform-box:fill-box;transform-origin:50% 100%;filter:drop-shadow(0 0 5px rgba(244,212,106,.9))}
.lamps .halo{fill:rgba(244,212,106,.13);stroke:none}
.lamps .wait{fill:none;stroke:rgba(244,212,106,.5);stroke-width:1.2;transform-box:fill-box;transform-origin:50% 50%}
.lamp-off .ln{stroke:rgba(255,254,247,.32)}
#lampchain.armed .flame,#lampchain.armed .halo{opacity:0}
#lampchain.lit .flame{animation:lampon .55s ease forwards;animation-delay:var(--d)}
#lampchain.lit .halo{animation:halon .8s ease forwards;animation-delay:var(--d)}
@keyframes lampon{from{opacity:0;transform:scale(.35)}to{opacity:1;transform:scale(1)}}
@keyframes halon{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:no-preference){.lamps .wait{animation:waitpulse 2.6s ease-in-out infinite}}
@keyframes waitpulse{0%,100%{opacity:.35;transform:scale(.94)}50%{opacity:.9;transform:scale(1.06)}}
@media (prefers-reduced-motion:reduce){#lampchain.armed .flame,#lampchain.armed .halo{opacity:1}}

/* the closing band */
.closeband{margin:3rem 0 .5rem;padding:1.6rem 1.3rem;border:1px solid rgba(44,36,22,.12);border-radius:20px;background:linear-gradient(160deg,#FFFDF2,#FFF7DF);text-align:center}
.cb-t{font-size:1.02rem;font-weight:800;margin:0}
.cb-p{font-size:.84rem;line-height:1.8;color:rgba(44,36,22,.65);margin:.5rem auto 0;max-width:32rem}
.cb-a{display:flex;flex-wrap:wrap;gap:.6rem;justify-content:center;margin-top:1.1rem}
"""


JS = """<script>
(function(){
  "use strict";
  var sc = document.getElementById("rib-scroll");
  var read = document.getElementById("rib-read");
  var DEF = read ? read.textContent : "";
  if (sc) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-rib]"), function (b) {
      b.addEventListener("click", function () {
        var d = b.getAttribute("data-rib") === "next" ? 1 : -1;
        var step = Math.max(240, Math.round(sc.clientWidth * 0.72));
        try { sc.scrollBy({ left: d * step, behavior: "smooth" }); }
        catch (e) { sc.scrollLeft += d * step; }
      });
    });
  }
  function openLife(id) {
    var card = document.getElementById(id);
    if (!card) return;
    var d = card.querySelector("details");
    if (d) d.open = true;
    if (window.gsap) { try { window.gsap.set(card, { autoAlpha: 1, y: 0, overwrite: true }); } catch (e) {} }
    try { card.scrollIntoView({ behavior: "smooth", block: "center" }); }
    catch (e) { card.scrollIntoView(); }
    card.classList.add("lit");
    setTimeout(function () { card.classList.remove("lit"); }, 2000);
    var s = card.querySelector("summary");
    if (s) setTimeout(function () { try { s.focus({ preventScroll: true }); } catch (e) {} }, 700);
  }
  Array.prototype.forEach.call(document.querySelectorAll(".rdot"), function (b) {
    var lab = b.getAttribute("data-lab");
    b.addEventListener("click", function () { openLife(b.getAttribute("data-go")); });
    function on() { if (read) read.textContent = lab; }
    function off() { if (read) read.textContent = DEF; }
    b.addEventListener("pointerenter", on);
    b.addEventListener("focus", on);
    b.addEventListener("pointerleave", off);
    b.addEventListener("blur", off);
  });
  var chain = document.getElementById("lampchain");
  if (chain) {
    chain.classList.add("armed");
    var fire = function () { chain.classList.add("lit"); };
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (en) {
        for (var i = 0; i < en.length; i++) {
          if (en[i].isIntersecting) { fire(); io.disconnect(); break; }
        }
      }, { threshold: 0.2 });
      io.observe(chain);
    } else { fire(); }
  }
})();
</script>"""


def build():
    # every gift in the hall carries its own figure, and no figure is orphaned
    keys = [slug(g["t"]) for f in fields for g in f["gifts"]]
    missing = [k for k in keys if k not in GIFT_FIGS]
    orphan = [k for k in GIFT_FIGS if k not in keys]
    if missing or orphan:
        raise SystemExit("figures out of step: missing %s  orphan %s" % (missing, orphan))
    for pid in LIFE_FIGS:
        if pid not in {p["id"] for _, p in PEOPLE}:
            raise SystemExit("figure for an unknown life: %s" % pid)
    main = "\n".join([
        DOORS,
        RIBBON_SEC % build_ribbon(),
        hall_torchbearers(),
        hall_gifts(),
        CLOSE,
    ])
    html = shell(
        slug="heroes",
        title="Heroes of Islam",
        desc=("Thirty lives that carried the light from the generation after the Companions to our own "
              "century, and thirty gifts this civilization handed the world, each one badged for its "
              "evidence and shown with its costs."),
        ar="حَمَلَةُ الْمِشْكَاة",
        kick="Heroes of Islam",
        h1="The ones who carried the lamp after him ﷺ",
        lead=("After the Prophet ﷺ and the first generations, the light passed from hand to hand, "
              "and it has never once gone out. These are honest lives, told with their costs shown."),
        main=main,
        css=CSS,
        extra_js=JS,
        footline="Thirty lives and thirty gifts, free forever, like every room in the Codex.",
        canon="heroes",
    )
    out = os.path.join(ROOT, "heroes.html")
    open(out, "w", encoding="utf-8").write(html)
    print("wrote %s  %d bytes" % (out, len(html.encode("utf-8"))))
    print("eras %d  people %d  gifts %d" % (len(eras), N_PEOPLE, N_GIFTS))



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
    _synergy("heroes.html")
