# NOOR v54 · the synergy pass
# Every room ends with a small band of two to four doors into the rooms that
# genuinely stand beside it, written in the room's own voice, plus a handful of
# in-prose links where a room names a concept that has a room of its own.
#
# The band is delimited by <!--WGO--> ... <!--/WGO--> so this script is
# idempotent: run it as often as you like, it replaces its own work.
#
#   python3 scripts/synergy.py            apply everywhere
#   python3 scripts/synergy.py hajj.html  apply to one page
#
# Generators call apply_to("hajj.html") at the end of their build, so a
# regenerated room keeps its band.

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

OPEN, CLOSE = "<!--WGO-->", "<!--/WGO-->"

# ---------------------------------------------------------------------------
# the band skin: one small stylesheet, scoped to .wgo, shipped with the band
# ---------------------------------------------------------------------------

CSS_LIGHT = (
    ".wgo{max-width:%(w)s;margin:2.9rem auto 0;padding:1.75rem 1rem .4rem;"
    "border-top:1px solid rgba(44,36,22,.12)}"
    ".wgo>h2{font-size:1.06rem;font-weight:800;letter-spacing:-.01em;margin:0;"
    "color:#2C2416;font-family:Inter,system-ui,sans-serif;line-height:1.35}"
    ".wgo>.wgo-s{font-size:.8rem;line-height:1.8;color:rgba(44,36,22,.6);"
    "margin:.35rem 0 0;max-width:34rem}"
    ".wgo-g{display:grid;grid-template-columns:1fr;gap:.65rem;margin-top:1.05rem}"
    "@media(min-width:38rem){.wgo-g{grid-template-columns:1fr 1fr}}"
    ".wgo-c{display:block;text-decoration:none;background:#fff;"
    "border:1px solid rgba(44,36,22,.12);border-radius:16px;padding:.85rem .95rem;"
    "transition:border-color .18s ease,transform .18s ease,box-shadow .18s ease}"
    ".wgo-c:hover,.wgo-c:focus-visible{border-color:rgba(201,162,39,.7);"
    "transform:translateY(-1px);box-shadow:0 5px 18px rgba(44,36,22,.07)}"
    ".wgo-c b{display:block;font-size:.9rem;font-weight:800;color:#2C2416;line-height:1.45;"
    "font-family:Inter,system-ui,sans-serif}"
    ".wgo-c b::after{content:\" \\2192\";color:#C9A227}"
    ".wgo-c span{display:block;font-size:.8rem;line-height:1.8;color:rgba(44,36,22,.68);"
    "margin-top:.28rem;font-family:Inter,system-ui,sans-serif}"
)

CSS_DARK = (
    ".wgo{max-width:%(w)s;margin:2.9rem auto 0;padding:1.75rem 1rem .4rem;"
    "border-top:1px solid rgba(244,212,106,.2)}"
    ".wgo>h2{font-size:1.06rem;font-weight:800;letter-spacing:-.01em;margin:0;"
    "color:#FFFEF7;font-family:Inter,system-ui,sans-serif;line-height:1.35}"
    ".wgo>.wgo-s{font-size:.8rem;line-height:1.8;color:rgba(255,254,247,.62);"
    "margin:.35rem 0 0;max-width:34rem}"
    ".wgo-g{display:grid;grid-template-columns:1fr;gap:.65rem;margin-top:1.05rem;text-align:start}"
    "@media(min-width:38rem){.wgo-g{grid-template-columns:1fr 1fr}}"
    ".wgo-c{display:block;text-decoration:none;"
    "background:linear-gradient(165deg,rgba(255,254,247,.08),rgba(255,254,247,.03));"
    "border:1px solid rgba(244,212,106,.26);border-radius:16px;padding:.85rem .95rem;"
    "transition:border-color .18s ease,transform .18s ease,box-shadow .18s ease}"
    ".wgo-c:hover,.wgo-c:focus-visible{border-color:rgba(244,212,106,.65);"
    "transform:translateY(-1px);box-shadow:0 6px 20px rgba(4,6,15,.45)}"
    ".wgo-c b{display:block;font-size:.9rem;font-weight:800;color:#F4D46A;line-height:1.45;"
    "font-family:Inter,system-ui,sans-serif}"
    ".wgo-c b::after{content:\" \\2192\";color:#F4D46A}"
    ".wgo-c span{display:block;font-size:.8rem;line-height:1.8;color:rgba(255,254,247,.72);"
    "margin-top:.28rem;font-family:Inter,system-ui,sans-serif}"
)

WIDTHS = {"n": "46rem", "w": "62rem"}


def band(heading, lead, cards, width="n", dark=False, extra_cls=""):
    css = (CSS_DARK if dark else CSS_LIGHT) % {"w": WIDTHS[width]}
    out = [OPEN, "<style>" + css + "</style>",
           '<section class="wgo%s" aria-labelledby="wgo-h">' % (
               (" " + extra_cls) if extra_cls else "")]
    out.append('<h2 id="wgo-h">%s</h2>' % heading)
    if lead:
        out.append('<p class="wgo-s">%s</p>' % lead)
    out.append('<div class="wgo-g">')
    for href, name, why in cards:
        out.append('<a class="wgo-c" href="%s"><b>%s</b><span>%s</span></a>' % (href, name, why))
    out.append("</div>")
    out.append("</section>")
    out.append(CLOSE)
    return "\n".join(out) + "\n"


# ---------------------------------------------------------------------------
# every room, what stands beside it, and where the band is hung
# ---------------------------------------------------------------------------
# page: (anchor string the band is inserted BEFORE, heading, lead, cards, width, dark)

HERE_FROM = "Where to go from here"
NEXT_KIDS = "Where to go next"

PAGES = {}


def room(page, anchor, cards, heading=HERE_FROM, lead="", width="n", dark=False,
         kit=False, pre=""):
    PAGES[page] = dict(anchor=anchor, heading=heading, lead=lead, cards=cards,
                       width=width, dark=dark, kit=kit, pre=pre)


# ---- the Path and the four rooms that tell one story -----------------------

room("index.html", "<!-- ============ ABOUT ============ -->", width="w",
     lead="The Path is the whole story in order. These are the rooms readers "
          "walk into once they have reached the end of it.",
     cards=[
         ("/soul", "The Journey of the Soul",
          "The ten stations after the last breath, which is where the scale you just read ends up."),
         ("/unseen", "The Unseen and the Mysteries",
          "Angels, jinn, the signs of the Hour and the myths he ﷺ corrected, every claim badged for its evidence."),
         ("/pillars", "The Five Pillars",
          "What all of this asks of an ordinary week: the five things a Muslim life is built on."),
         ("/prophets", "The 25 Prophets",
          "The same chain told life by life instead of year by year, with every verse recited."),
     ])

room("prophets.html", "</main>",
     cards=[
         ("/muhammad", "The Seerah \u00b7 Twenty-Three Years",
          "The last of the twenty-five, at length: the whole life in twenty-one stations, then what he was like and how he handled things."),
         ("/characters", "Characters",
          "The rest of the cast in these same stories: angels, jinn, the animals of the signs, and the beings of the end."),
         ("/places", "Places",
          "The ground the stories stand on: the ark's mountain, the valley of Makkah, the cave, the two sanctuaries."),
         ("/hajj", "Hajj and Umrah",
          "Ibrahim, Hajar and Ismail built the House and ran between the hills. Every year the pilgrimage walks it again."),
         ("/companions", "Companions",
          "The men and women who heard the last of these prophets speak, each one with a full account."),
     ], width="w")

room("companions.html", "<footer",
     cards=[
         ("/muhammad", "The Seerah \u00b7 Twenty-Three Years",
          "The life they were witnesses to, station by station, with what they themselves said about his character."),
         ("/prophets", "The 25 Prophets",
          "The man they followed, told in full, at the end of the whole chain before him."),
         ("/sermon", "The Last Sermon",
          "The final thing he ﷺ said to a hundred thousand of them at once, passage by passage."),
         ("/heroes", "Heroes of Islam",
          "The generation that came directly after them, and the thirteen centuries that followed."),
         ("/places", "Places",
          "Badr, Uhud, Madinah and the roads they were sent down: the geography of their lives."),
     ], width="w")

room("characters.html", "<footer",
     cards=[
         ("/unseen", "The Unseen and the Mysteries",
          "The same beings at length, every claim badged Qur'an, Sunnah, disputed, or corrected."),
         ("/prophets", "The 25 Prophets",
          "The chain these characters keep appearing beside, told life by life."),
         ("/companions", "Companions",
          "The named men and women around the Prophet ﷺ, each with a full account."),
         ("/places", "Places",
          "Where all of it happened, from the two sanctuaries to the stations of the end of time."),
     ], width="w")

room("places.html", "<footer",
     cards=[
         ("/hajj", "Hajj and Umrah",
          "Makkah, the Kaaba, Safa and Marwah, Arafah and Zamzam, walked in the order a pilgrim walks them."),
         ("/prophets", "The 25 Prophets",
          "The lives that made these places matter, each with its verses and its sources."),
         ("/characters", "Characters",
          "Who was in them: angels, jinn, the animals of the signs, and the beings of the end."),
         ("/#timeline", "The Path of Creation",
          "The whole story in order, so the map turns back into a sequence."),
     ], width="w")

# ---- the Book, the letters, the words --------------------------------------

room("quran.html", "</main>",
     cards=[
         ("/arabic", "The Letters of Light",
          "Twenty eight letters with their sounds, so the script above stops being a picture and starts being words."),
         ("/ramadan#khatm", "The Qur'an in thirty nights",
          "A reading plan that finishes the whole Book in a month, one juz a night, kept in the Ramadan room."),
         ("/prophets", "The 25 Prophets",
          "The stories the surahs tell in pieces, gathered into one chain with their sources."),
         ("/madrasa#t-tajwid", "Tajwid, in the Classroom",
          "The science of reciting properly, taught as fifteen lessons with recitation and quizzes."),
     ], width="w")

room("arabic.html", "</main>", width="w",
     cards=[
         ("/words", "Words of the Path",
          "Short, real Arabic you can now sound out: the supplications, who first said them, and what they did."),
         ("/madrasa#t-huruf", "Reading Arabic, in the Classroom",
          "The same letters as a graded track, with quizzes and a certificate at the end of it."),
         ("/pillars", "The Five Pillars",
          "The Bismillah you just read opens al-Fatiha, which opens every unit of every prayer."),
     ])

room("words.html", "<footer", width="w",
     cards=[
         ("/arabic", "The Letters of Light",
          "Learn the twenty eight letters and read these words in their own script instead of in ours."),
         ("/prophets", "The 25 Prophets",
          "Where most of these words were first spoken, inside the life that spoke them."),
         ("/pillars", "The Five Pillars",
          "The words that sit inside the prayer itself, and the four pillars standing around it."),
     ])

# ---- the practice ----------------------------------------------------------

room("pillars.html", "</main>", width="w",
     cards=[
         ("/hajj", "Hajj and Umrah",
          "The fifth pillar opened out in full: ihram, the three ways, the five days, and what to do when something goes wrong."),
         ("/ramadan", "The Ramadan Room",
          "The fourth pillar as a whole month: today's fasting window for your own place, the last ten nights, and zakat al-fitr."),
         ("/latif", "The Story of Beauty",
          "These same five learned the gentle way, by a girl who kept a private ledger of her own failures."),
         ("/madrasa#t-arkan", "The Five Pillars, in the Classroom",
          "The same five as a graded track, with quizzes and a certificate when you finish it."),
     ])

room("hajj.html", '<section class="band mo">',
     cards=[
         ("/pillars", "The Five Pillars",
          "Hajj is the fifth. The other four are the ordinary year that the one journey sits inside."),
         ("/eid", "The Eid Room",
          "Eid al-Adha falls on the tenth of Dhul Hijjah, while the pilgrims are still at Mina: the prayer, the takbir and the udhiya."),
         ("/places", "Places",
          "Makkah, the Kaaba, Safa and Marwah, Arafah, Mina and Zamzam, each one with its own account."),
         ("/prophets", "The 25 Prophets",
          "Ibrahim, Hajar and Ismail: the building and the running between the hills that the pilgrim repeats."),
     ])

room("ramadan.html", '<section class="band mo">',
     cards=[
         ("/eid", "The Eid Room",
          "The morning this month ends in: the takbir, the prayer, zakat al-fitr, and the six days of Shawwal after it."),
         ("/quran", "The Mushaf of Light",
          "The Book that came down in this month, open, with recitation and translation on every ayah."),
         ("/pillars", "The Five Pillars",
          "Fasting is the fourth. The other four are the frame this month stands in."),
         ("/family", "The Family Room",
          "Fasting with children in the house, feeding people, and the home the month is actually lived in."),
     ])

room("family.html", '<section class="band mo">',
     cards=[
         ("/kids", "The Kids' Codex",
          "The same religion at their height: the Greatest Game, the Lantern Sky and nine small games."),
         ("/madrasa", "The Classroom",
          "One hundred and six lessons from the cradle to the academy, with progress a child can watch move."),
         ("/ramadan", "The Ramadan Room",
          "Fasting with children, who is excused and what they owe instead, and how a household keeps a month."),
         ("/health", "The Prophetic Pattern of Health",
          "How he ﷺ ate, slept and moved at home, with what modern research finds set beside it."),
     ])

room("begin.html", "</main>", width="w",
     cards=[
         ("/pillars", "The Five Pillars",
          "The five things your shahada signed you up for, in one room, with the prayer drawn out step by step."),
         ("/arabic", "The Letters of Light",
          "Twenty eight letters in order, so you can begin reading the words you are already saying."),
         ("/madrasa", "The Classroom",
          "If you would rather be taught than browse: graded tracks, quizzes, and a certificate for each one finished."),
     ])

room("health.html", '<footer class="border-t', width="w",
     cards=[
         ("/family", "The Family Room",
          "The same house from the other side: marriage, children, parents and the people next door."),
         ("/ramadan", "The Ramadan Room",
          "The oldest eating window kept for a whole month, with who is excused and what they owe instead."),
         ("/pillars", "The Five Pillars",
          "Wudu, prayer and fasting in their own room, each one carrying its evidence."),
     ])

# ---- belief, the last things -----------------------------------------------

room("theology.html", "</main>", width="w",
     cards=[
         ("/unseen", "The Unseen and the Mysteries",
          "What every school agrees the unseen contains, and where they honestly differ, each claim badged."),
         ("/heroes", "Heroes of Islam",
          "Abu Hanifa, Malik, ash-Shafi'i, Ahmad and al-Bukhari as lives rather than as labels."),
         ("/madrasa#t-fiqh", "The Law in Practice",
          "The Classroom track that takes the four schools from a map into everyday rulings."),
     ])

room("heroes.html", '<div class="wrap">\n<section class="closeband mo">',
     cards=[
         ("/companions", "Companions",
          "The generation before this one, who heard him ﷺ speak and carried it out of Madinah."),
         ("/school#stem", "The Observatory of Signs",
          "The science in this hall taught as a curriculum: the teachers of the world, one project at a time."),
         ("/theology", "How the River Branched",
          "Five of the men in this hall gave their names to schools of law and hadith. This is how that happened."),
         ("/#timeline", "The Path of Creation",
          "Thirteen centuries placed back inside the whole story, from the Throne over the water to the last day."),
     ])

room("unseen.html", '<section class="rsec"><div class="band mo">', width="w",
     cards=[
         ("/soul", "The Journey of the Soul",
          "What happens to one person after the last breath, station by station, badged the same way."),
         ("/sermon", "The Last Sermon",
          "The other room of the last things: what he ﷺ said to everyone at once, knowing he was leaving."),
         ("/characters", "Characters",
          "The same angels, jinn and beings of the end as seals of light, each opening a short account."),
         ("/#timeline", "The Path of Creation",
          "The signs of the Hour set in order inside the whole story, from creation to the two homes."),
     ])

room("sermon.html", '<section class="band mo">',
     cards=[
         ("/hajj", "Hajj and Umrah",
          "He gave this on the ninth of Dhul Hijjah at Arafah, in the middle of the pilgrimage this room explains."),
         ("/companions", "Companions",
          "The people standing in front of him that afternoon, each one with a full account."),
         ("/soul", "The Journey of the Soul",
          "He told them he might not meet them after that year. This is the road he was speaking from."),
         ("/unseen", "The Unseen and the Mysteries",
          "What he taught about everything they could not see, every claim badged for its evidence."),
     ])

room("soul.html", '<section class="band mo">',
     cards=[
         ("/unseen", "The Unseen and the Mysteries",
          "The angels named in this room, the signs of the Hour, and every claim badged for its evidence."),
         ("/sermon", "The Last Sermon",
          "The last thing he ﷺ said to everyone at once, months before he walked this road himself."),
         ("/stories/sabur", "What the Sea Keeps",
          "A story for grief that does not end in rescue, written for people in the middle of a loss."),
         ("/#timeline", "The Path of Creation",
          "The gathering, the scales and the bridge placed in order inside the whole story."),
     ])

# ---- teaching --------------------------------------------------------------

room("madrasa.html", '<div class="wrap" style="padding-bottom:1rem">',
     cards=[
         ("/school", "The Madrasa of Light",
          "The curriculum behind this classroom: five stages, the reasoning, and what each age is for."),
         ("/quran", "The Mushaf of Light",
          "The Book itself, open, with recitation and translation on every ayah."),
         ("/arabic", "The Letters of Light",
          "Twenty eight letters before the reading track, if you have never met them."),
         ("/kids", "The Kids' Codex",
          "For the smallest students: the Greatest Game, the Lantern Sky and the Cradle."),
     ])

room("school.html", "</main>", width="w",
     cards=[
         ("/madrasa", "The Classroom",
          "Where this curriculum is actually taught: one hundred and six lessons, quizzes, and progress that remembers."),
         ("/heroes", "Heroes of Islam",
          "Thirty of the lives this school teaches from, told in full and shown with their costs."),
         ("/family", "The Family Room",
          "The home a school like this assumes: marriage, children, parents and the manners between them."),
         ("/kids", "The Kids' Codex",
          "The play end of the same building, for the years before any of this is a lesson."),
     ])

# ---- the little ones -------------------------------------------------------

room("kids.html", '</section>\n\n<section class="screen" id="scr-round">',
     heading=NEXT_KIDS, width="w", dark=True,
     cards=[
         ("/kids/cradle", "The Cradle",
          "For the littlest ones, 0 to 3: first sounds, first words, and a gentle rhythm for the day."),
         ("/madrasa#t-rawda", "The Garden",
          "Real lessons made small, with quizzes and a certificate the day you finish one."),
         ("/stories", "The Hall of Stories",
          "Nine long stories for when you can sit still, each one carrying a Name of Allah."),
     ])

room("kids/lanterns.html", "</main>", heading=NEXT_KIDS, dark=True,
     cards=[
         ("/kids", "The Greatest Game",
          "Seven questions, seven champions, and the Name that is greater than all of them."),
         ("/kids/cradle", "The Cradle",
          "For the littlest one in the house, 0 to 3, with first sounds and first words."),
         ("/ramadan#families", "Ramadan, for families",
          "The nights these lanterns were made for, and how a house keeps the month with children in it."),
     ])

room("kids/cradle.html", "</main>", heading=NEXT_KIDS, dark=True,
     cards=[
         ("/madrasa#t-mahd", "The Cradle track",
          "These same first three years as proper lessons for the parent, every claim carrying its source."),
         ("/kids", "The Kids' Codex",
          "For the day they can tap: the Greatest Game, the Lantern Sky and nine small games."),
         ("/family", "The Family Room",
          "The house around the cot: marriage, children, parents, and how he ﷺ was at home."),
     ])

# ---- the hall of stories ---------------------------------------------------

room("stories/index.html", "</main>", width="w",
     cards=[
         ("/latif", "The Story of Beauty",
          "Start here if you have not read one yet: the shortest of the nine, and the gentlest."),
         ("/quran", "The Mushaf of Light",
          "Every ayah quoted in this hall, in its own room, with recitation and translation."),
         ("/words", "Words of the Path",
          "The supplications these people say, with who first said each one and what it did."),
         ("/family", "The Family Room",
          "Marriage, grief, provision and parents, taught straight instead of through a story."),
     ])


# The two deep rooms. Each one is the place a reader lands after a question
# they could not answer from a definition, so the doors out of them go to the
# rooms that carry the same question further rather than to a category list.
room("allah.html", "<footer",
     cards=[
         ("/theology", "Theology \u00b7 The Branches",
          "Where the arguments about His names and attributes actually ran, and which of them the Sunnah settled."),
         ("/muhammad", "The Seerah \u00b7 Twenty-Three Years",
          "The man who was sent to say all of this, and what twenty-three years of saying it cost him."),
         ("/words", "The Words of the Path",
          "The names are for calling with. These are the du\u2019as that call by them, in Arabic and in English."),
         ("/quran", "The Mushaf",
          "Every verse quoted in this room, in its own place, with the recitation beside it."),
     ], width="w")

room("muhammad.html", "<footer",
     cards=[
         ("/prophets", "The 25 Prophets",
          "The twenty-four who came before him, and the single message all of them carried."),
         ("/companions", "The Companions",
          "The men and women who sat with him, and whose testimony most of this room is built from."),
         ("/sermon", "The Last Sermon",
          "The final khutbah, line by line: what he chose to say when he knew it was the last time."),
         ("/health", "Prophetic Health",
          "His habits at the table, in sleep and in the body, gathered as practice rather than as history."),
     ], width="w")

STORY_EXITS = {
    "latif.html": [
        ("/pillars", "The Five Pillars",
         "The five doors Beauty learned one at a time, set out plainly, each with its evidence."),
        ("/begin", "Begin, for a new Muslim",
         "Written for the same reader: the first hours, the first forty days, and the wobbles nobody warns you about."),
    ],
    "stories/sabur.html": [
        ("/soul", "The Journey of the Soul",
         "What the religion actually teaches about the dead and the waiting, station by station, with its sources."),
        ("/family", "The Family Room",
         "The house this story happens in: marriage, grief, kin, and the rights that survive a death."),
    ],
    "stories/ghaffar.html": [
        ("/words", "Words of the Path",
         "The supplications of return, with who first said each one and what it did for them."),
        ("/soul", "The Journey of the Soul",
         "What a wrong weighs on the day it is finally read out, and what erases it before then."),
    ],
    "stories/adl.html": [
        ("/soul", "The Journey of the Soul",
         "The scales and the settling of debts, for wrongs this world never got round to."),
        ("/unseen", "The Unseen and the Mysteries",
         "The Day this story is waiting for, with every claim badged for the evidence behind it."),
    ],
    "stories/wadud.html": [
        ("/family", "The Family Room",
         "Marriage taught straight: rights that flow both ways, speech, repair, and the Prophet ﷺ at home."),
        ("/latif", "The Story of Beauty",
         "The other story in this hall for a person who has quietly decided they are hard to love."),
    ],
    "stories/razzaq.html": [
        ("/pillars", "The Five Pillars",
         "Zakat is the third of them: one coin in forty, and the eight doors it is allowed to enter."),
        ("/family", "The Family Room",
         "Feeding your own house and the one next to it, with the neighbour's rights named."),
    ],
    "stories/shakur.html": [
        ("/heroes", "Heroes of Islam",
         "Thirty lives whose work outlived them, shown honestly, costs included."),
        ("/quran", "The Mushaf of Light",
         "The Book he was copying, open, with recitation and translation on every ayah."),
    ],
    "stories/hadi.html": [
        ("/family", "The Family Room",
         "Parents and children, and what is owed in both directions when one of them walks away."),
        ("/begin", "Begin, for a new Muslim",
         "For the one who is walking back: the first hours, the first forty days, said gently."),
    ],
    "stories/jabbar.html": [
        ("/heroes", "Heroes of Islam",
         "Resistance and Renewal: lives that kept working through catastrophes larger than this one."),
        ("/soul", "The Journey of the Soul",
         "What is taught about the dead, the grieving and the waiting, station by station."),
    ],
}

LATIF_FRAME = (
    "<style>"
    ".snav{max-width:34rem;margin:2.9rem auto 0;padding-top:1.5rem;"
    "border-top:1px solid rgba(44,36,22,.1);display:grid;"
    "grid-template-columns:1fr auto 1fr;gap:.6rem;align-items:stretch}"
    ".snav a,.snav span.off{display:flex;flex-direction:column;justify-content:center;"
    "text-decoration:none;background:#fff;border:1px solid rgba(44,36,22,.12);"
    "border-radius:14px;padding:.72rem .85rem;font-size:.78rem;line-height:1.55;"
    "color:rgba(44,36,22,.75);transition:border-color .18s ease,color .18s ease;"
    "font-family:Inter,system-ui,sans-serif}"
    ".snav a:hover{border-color:rgba(201,162,39,.5);color:#2C2416}"
    ".snav .k{font-size:.55rem;letter-spacing:.18em;text-transform:uppercase;"
    "font-weight:800;color:rgba(44,36,22,.4);margin-bottom:.25rem}"
    ".snav .nx{text-align:end}"
    ".snav .mid{align-items:center;text-align:center;font-weight:800;"
    "font-size:.72rem;letter-spacing:.03em}"
    ".snav span.off{border-style:dashed;color:rgba(44,36,22,.45);background:transparent}"
    "@media (max-width:36rem){.snav{grid-template-columns:1fr}.snav .nx{text-align:start}}"
    "</style>"
    '<nav class="snav" aria-label="More stories">'
    '<span class="off"><span class="k">Previous story</span>The first in the hall</span>'
    '<a class="mid" href="/stories">The Hall of Stories</a>'
    '<a class="nx" href="/stories/sabur"><span class="k">Next story</span>'
    "What the Sea Keeps</a></nav>"
)

for _slug, _cards in STORY_EXITS.items():
    if _slug == "latif.html":
        room(_slug, "</main>", cards=_cards, pre=LATIF_FRAME)
    else:
        room(_slug, "</div>\n</main>", cards=_cards)

# ---- the houses ------------------------------------------------------------

room("masjid/index.html", "</main>",
     cards=[
         ("/license", "For schools and organizations",
          "Whole rooms of the Codex inside your own website. Houses that teach for free embed for free."),
         ("/donate", "Keep the lamp lit",
          "These tools have no account, no advertising and no price. Gifts are the only thing holding them up."),
         ("/ramadan", "The Ramadan Room",
          "The month a masjid works hardest: fasting windows, taraweeh, the last ten nights and zakat al-fitr."),
         ("/eid", "The Eid Room",
          "The Eid prayer and its takbirat, the deadline for zakat al-fitr, and the udhiya, for the two full mornings."),
     ])

room("masjid/start.html", "</main>",
     cards=[
         ("/masjid/setup", "The prayer board",
          "Later, when a screen arrives: real astronomy on the wall, set once and then left alone."),
         ("/license", "For schools and organizations",
          "When the house has a website, whole rooms of the Codex can live inside it, free for those who teach for free."),
         ("/donate", "Keep the lamp lit",
          "Nothing in this toolbox is sold. Gifts are what keep it free for the next house with nothing."),
     ])

room("masjid/khutba.html", '<p class="kmark">', kit=True,
     cards=[
         ("/sermon", "The Last Sermon",
          "The khutba every khatib is measured against: what he ﷺ said at Arafah, passage by passage, with its chain."),
         ("/masjid/timetable", "The monthly timetable",
          "One printable sheet for the wall, with the jumu'ah time printed beside the month."),
         ("/masjid", "The masjid toolbox",
          "The rest of the free kit: the prayer board, the qibla tool and the starter guide."),
     ])

room("masjid/qibla.html", '<p class="kmark">', kit=True,
     cards=[
         ("/places", "Places",
          "The Kaaba this bearing points at, and the sanctuary around it, with their sources."),
         ("/masjid/timetable", "The monthly timetable",
          "Once the direction is fixed, the times: one printable sheet for the wall."),
         ("/masjid", "The masjid toolbox",
          "The rest of the free kit: the prayer board, the khutba builder and the starter guide."),
     ])

room("masjid/timetable.html", '<p class="kmark">', kit=True,
     cards=[
         ("/masjid/setup", "The prayer board",
          "The same astronomy on a screen, updating itself, for a hall that has a television."),
         ("/ramadan", "The Ramadan Room",
          "Suhoor and iftar for your own place, with the last ten nights and zakat al-fitr in full."),
         ("/masjid", "The masjid toolbox",
          "The rest of the free kit: the qibla tool, the khutba builder and the starter guide."),
     ])

room("masjid/setup.html", '\n\n</div>\n<script>', kit=True,
     cards=[
         ("/license", "For schools and organizations",
          "Whole rooms of the Codex inside your own website. Houses that teach for free embed for free."),
         ("/donate", "Keep the lamp lit",
          "The board has no account and no price. Gifts are the only thing holding it up."),
         ("/ramadan", "The Ramadan Room",
          "The month this board is read most: fasting windows, taraweeh and the last ten nights."),
     ])

# ---- the desk --------------------------------------------------------------

room("license.html", "<footer>", width="w",
     cards=[
         ("/masjid", "The masjid toolbox",
          "Free before any license: the prayer board, the printable timetable, the qibla tool and the khutba builder."),
         ("/school", "The Madrasa of Light",
          "The curriculum most schools embed first: five stages, cradle to adolescence, with the reasoning shown."),
         ("/legal", "Terms and Transparency",
          "The license in plain words, where the money goes, and what we know about your readers, which is almost nothing."),
         ("/donate", "Keep the lamp lit",
          "If you are a house with no budget, this is the other way in. Nobody has been turned away over money."),
     ])

room("donate.html", '<footer class="border-t', width="w",
     cards=[
         ("/kids/lanterns", "The Lantern Sky",
          "Every gift lights a lantern with its du'a on it, and children watch them go up."),
         ("/legal", "Terms and Transparency",
          "Where the money goes, in plain words: the zakat share, the masjid fund, and what is kept."),
         ("/masjid", "The masjid toolbox",
          "What the gifts pay for at the far end: free tools inside houses of prayer with no budget."),
         ("/license", "For schools and organizations",
          "The other lifeline. Institutions that charge tuition license the Codex so readers never have to."),
     ])

room("legal.html", '<footer class="border-t',
     cards=[
         ("/donate", "Keep the lamp lit",
          "The gifts these terms describe, and the ledger they are counted in."),
         ("/license", "For schools and organizations",
          "The license terms above, with the prices and the free path for houses that teach for free."),
         ("/feedback", "Corrections and Ideas",
          "If something on this page is wrong, or something anywhere else is, this is the door."),
     ])

room("feedback.html", "</main>",
     cards=[
         ("/legal", "Terms and Transparency",
          "What happens to a note once you send it, and what we keep, which is almost nothing."),
         ("/license", "For schools and organizations",
          "If you are writing on behalf of a masjid, a school or an app, the terms are here."),
         ("/donate", "Keep the lamp lit",
          "Corrections cost nothing and always will. Gifts are what keep the rooms they fix open."),
     ])


# ---------------------------------------------------------------------------
# the Eid room already keeps a band of its own, "The rooms either side of this
# one". It is extended rather than duplicated: two more doors, in its own skin.
# ---------------------------------------------------------------------------

XOPEN, XCLOSE = "<!--WGOX-->", "<!--/WGOX-->"

EID_ANCHOR = ("the day at Arafah that the tenth of Dhul Hijjah follows."
              "</span></span></a></div></section>")

EID_EXTRA = (
    "<style>"
    ".rc-proph{background:linear-gradient(166deg,#140F0A,#33251A 58%,#4A3524)}"
    ".rc-fam{background:linear-gradient(166deg,#120A10,#331B2A 58%,#4A2A3C)}"
    "</style>"
    '<a class="rc rc-proph" href="/prophets#ibrahim">'
    '<span class="rc-i" aria-hidden="true"><svg viewBox="0 0 24 24">'
    '<path d="M12 2l2.4 6.2L21 9.6l-4.8 4.3L17.6 21 12 17.6 6.4 21l1.4-7.1L3 9.6l6.6-1.4z"/>'
    "</svg></span>"
    '<span class="rc-t"><span class="ar notranslate" translate="no" dir="rtl" lang="ar">إِبْرَاهِيم</span>'
    "<b>Ibrahim, in the Chain of Light</b>"
    "<span>The father, the son and the ransom, told in full. It is the whole reason "
    "there is an udhiya at all.</span></span></a>"
    '<a class="rc rc-fam" href="/family">'
    '<span class="rc-i" aria-hidden="true"><svg viewBox="0 0 24 24">'
    '<path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5Z"/>'
    "</svg></span>"
    '<span class="rc-t"><span class="ar notranslate" translate="no" dir="rtl" lang="ar">الأُسْرَة</span>'
    "<b>The Family Room</b>"
    "<span>Eid lands on a household before it lands on anyone alone: children, parents, "
    "kin and neighbours, and what is owed to each.</span></span></a>"
)


def apply_eid():
    """Two more doors inside the Eid room's own band. Idempotent."""
    path = os.path.join(ROOT, "eid.html")
    html = open(path, encoding="utf-8").read()
    i = html.find(XOPEN)
    while i >= 0:
        j = html.find(XCLOSE, i)
        html = html[:i] + html[j + len(XCLOSE):]
        i = html.find(XOPEN)
    if html.count(EID_ANCHOR) != 1:
        raise SystemExit("eid.html: the rooms band moved")
    k = html.find(EID_ANCHOR) + len(EID_ANCHOR) - len("</div></section>")
    html = html[:k] + XOPEN + EID_EXTRA + XCLOSE + html[k:]
    open(path, "w", encoding="utf-8").write(html)
    return 2


# ---------------------------------------------------------------------------
# in-prose links: where a room names something that has a room of its own, and
# the sentence is better for the door being there. First mention in a section
# only, never inside a quotation from the Qur'an or a hadith.
# ---------------------------------------------------------------------------

PROSE = [
    ("pillars.html",
     "Ramadan, the ninth month, begins and ends with the sighting of the new moon.",
     '<a href="/ramadan">Ramadan</a>, the ninth month, begins and ends with the sighting of the new moon.'),
    ("pillars.html",
     "The month closes with the festival of Eid al-Fitr and a small obligatory gift",
     'The month closes with the festival of <a href="/eid">Eid al-Fitr</a> and a small obligatory gift'),
    ("pillars.html",
     "Once in a lifetime, if body and wealth allow: the journey where millions dress in two white cloths",
     'Once in a lifetime, if body and wealth allow: <a href="/hajj">the journey</a> where millions dress in two white cloths'),
    ("pillars.html",
     "Seven circuits around the Kaaba, the House raised by Ibrahim and Isma'il.",
     'Seven circuits around the Kaaba, the House raised by <a href="/prophets#ibrahim">Ibrahim and Isma\'il</a>.'),

    ("hajj.html",
     "It is also the oldest invitation still open: a call Ibrahim was told to make,",
     'It is also the oldest invitation still open: a call <a href="/prophets#ibrahim">Ibrahim</a> was told to make,'),
    ("hajj.html",
     "Then drink Zamzam, the water of the well beside the House.",
     'Then drink <a href="/places">Zamzam</a>, the water of the well beside the House.'),
    ("hajj.html",
     "it is what the Prophet ﷺ himself did in the Farewell Hajj according to the strongest reading",
     'it is what the Prophet ﷺ himself did in <a href="/sermon">the Farewell Hajj</a> according to the strongest reading'),

    ("ramadan.html",
     "The festival of the breaking of the fast, on the first day of Shawwal.",
     'The festival of <a href="/eid">the breaking of the fast</a>, on the first day of Shawwal.'),

    ("family.html",
     "Revealed concerning the nights of Ramadan, the verse folds desire itself",
     'Revealed concerning the nights of <a href="/ramadan">Ramadan</a>, the verse folds desire itself'),

    ("health.html",
     "Ramadan obligatory (2:183), Mondays and Thursdays by habit",
     '<a href="/ramadan">Ramadan</a> obligatory (2:183), Mondays and Thursdays by habit'),

    ("theology.html",
     "jurists systematize how to derive law: Abu Hanifa (d. 767), Malik (d. 795), ash-Shafi'i (d. 820), Ahmad ibn Hanbal (d. 855).",
     'jurists systematize how to derive law: <a href="/heroes#abu-hanifa">Abu Hanifa</a> (d. 767), Malik (d. 795), ash-Shafi\'i (d. 820), Ahmad ibn Hanbal (d. 855).'),

    ("sermon.html",
     "Arafah is the standing that Hajj cannot be completed without:",
     'Arafah is the standing that <a href="/hajj">Hajj</a> cannot be completed without:'),

    ("soul.html",
     "The names Munkar and Nakir come in a narration Tirmidhi graded hasan gharib",
     'The names <a href="/unseen#munkar-nakir">Munkar and Nakir</a> come in a narration Tirmidhi graded hasan gharib'),

]


def apply_prose():
    """Turn a named concept into a door, once, where it helps. Idempotent:
    a replacement whose source has already gone is simply skipped."""
    done = 0
    by_page = {}
    for page, old, new in PROSE:
        by_page.setdefault(page, []).append((old, new))
    for page, subs in by_page.items():
        path = os.path.join(ROOT, page)
        if not os.path.exists(path):
            continue
        html = open(path, encoding="utf-8").read()
        for old, new in subs:
            if new in html:
                done += 1
                continue
            n = html.count(old)
            if n == 0:
                print("  prose miss in %s: %r" % (page, old[:52]))
                continue
            if n > 1:
                print("  prose ambiguous in %s (%d): %r" % (page, n, old[:52]))
                continue
            html = html.replace(old, new, 1)
            done += 1
        open(path, "w", encoding="utf-8").write(html)
    return done


# ---------------------------------------------------------------------------
# applying
# ---------------------------------------------------------------------------

def strip_band(html):
    """Remove a band this script wrote before, wherever it sits."""
    while True:
        i = html.find(OPEN)
        if i < 0:
            return html
        j = html.find(CLOSE, i)
        if j < 0:
            return html
        j += len(CLOSE)
        if j < len(html) and html[j] == "\n":   # the one newline the block adds
            j += 1
        html = html[:i] + html[j:]


def apply_to(page):
    """Hang the closing band on one page. Idempotent. Returns links added."""
    spec = PAGES.get(page)
    if not spec:
        return 0
    path = os.path.join(ROOT, page)
    if not os.path.exists(path):
        print("  missing: " + page)
        return 0
    html = strip_band(open(path, encoding="utf-8").read())

    anchor = spec["anchor"]
    n = html.count(anchor)
    if n != 1:
        raise SystemExit("anchor is not unique in %s (%d hits): %r" % (page, n, anchor))
    idx = html.find(anchor)

    if idx < 0:
        raise SystemExit("no anchor in " + page)

    blk = band(spec["heading"], spec["lead"], spec["cards"],
               width=spec["width"], dark=spec["dark"])
    if spec.get("kit"):
        blk = blk.replace('<section class="wgo', '<section class="noprint wgo')
    if spec.get("pre"):
        blk = blk.replace(OPEN + "\n", OPEN + "\n" + spec["pre"] + "\n", 1)
    html = html[:idx] + blk + html[idx:]
    open(path, "w", encoding="utf-8").write(html)
    return len(spec["cards"])


def main(only=None):
    total_pages = 0
    total_links = 0
    if not only or "eid.html" in only:
        total_pages += 1
        total_links += apply_eid()
    for page in sorted(PAGES):
        if only and page not in only:
            continue
        n = apply_to(page)
        if n:
            total_pages += 1
            total_links += n
    print("bands: %d rooms, %d links" % (total_pages, total_links))
    if not only:
        print("in-prose links: %d" % apply_prose())


if __name__ == "__main__":
    main(sys.argv[1:] or None)
