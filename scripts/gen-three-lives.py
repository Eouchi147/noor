#!/usr/bin/env python3
"""NOOR · three lives.

A room that puts one life beside another and lets the reader place himself.

The Qur'an does the sorting itself, so this room does not invent a scheme. In
Al-Waqi'ah the people become three kinds: the foremost, the companions of the
right, and the companions of the left (56:7-10). Three sections, that order
rearranged to the order a reader needs them.

Three rules govern the writing here.

The first section is a trap, and it is meant to be. It shows a day with every
obligation and every voluntary act performed, because that is what most people
picture when they picture a good Muslim. Then it shows, from the sources and
not from opinion, that a complete ledger can still be bankrupt. If the room
stopped there it would be a lie of omission.

The second section is written without softening. The reader asked for the worst
life a human being can live described raw, and a page that flinches there is
useless: the person who needs it will smell the flinch. So it is unflinching
about what the worst life actually is, which is not the poorest or the most
painful one. It is not gratuitous, it names no group, and it does not close
the door, because the sources do not close it while a man is still breathing.

The third section has to be reachable or the whole room is cruel. So its floor
is concrete, small, and drawn from texts that were given as a floor: the three
rights of Salman's answer, the small deed that continues, and the pass of
Al-Balad, which the Qur'an itself defines and then names its people as the
companions of the right.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from room import shell
from synergy import band

CSS = """
.qv{background:linear-gradient(170deg,#14100A,#1b2440);border:1px solid rgba(244,212,106,.28);border-radius:18px;padding:1.15rem 1.2rem;margin:.95rem 0;color:#FFFEF7}
.qv .a{font-family:Amiri,serif;font-size:1.42rem;line-height:2.05;color:#F4D46A;direction:rtl;text-align:center;margin:0}
.qv .e{font-size:.86rem;line-height:1.85;color:rgba(255,254,247,.84);margin:.7rem 0 0}
.qv .r{font-size:.64rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,212,106,.7);font-weight:800;margin:.6rem 0 0}
.hon{border-inline-start:3px solid rgba(201,162,39,.55);background:rgba(201,162,39,.06);border-radius:0 14px 14px 0;padding:.9rem 1rem;margin:1rem 0}
.hon b{color:#8a6d13}
.hon p{margin:.4rem 0 0;font-size:.85rem;line-height:1.85;color:rgba(44,36,22,.8)}
.care{border:1px solid rgba(123,45,38,.3);background:rgba(123,45,38,.05);border-radius:14px;padding:1rem 1.1rem;margin:1.1rem 0}
.care p.k{font-size:.63rem;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#7B2D26;margin:0}
.care p{font-size:.85rem;line-height:1.85;color:rgba(44,36,22,.82);margin:.55rem 0 0}
.raw{font-size:.92rem;line-height:1.95;color:rgba(44,36,22,.88);margin:.9rem 0}
.raw b{color:#2C2416;font-weight:700}
.dark{background:linear-gradient(172deg,#14100A,#1a1410);color:#FFFEF7;border-radius:20px;padding:1.4rem 1.25rem;margin:1.1rem 0;border:1px solid rgba(123,45,38,.4)}
.dark p{font-size:.9rem;line-height:1.95;color:rgba(255,254,247,.86);margin:0 0 .85rem}
.dark p:last-child{margin-bottom:0}
.dark b{color:#F4D46A;font-weight:700}
.dark .k{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:rgba(214,120,100,.9);margin:0 0 .7rem}
.door{background:linear-gradient(170deg,#14100A,#1b2440);border:1px solid rgba(244,212,106,.4);border-radius:20px;padding:1.4rem 1.25rem;margin:1.1rem 0;color:#FFFEF7}
.door .k{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:rgba(244,212,106,.85);margin:0 0 .7rem}
.door p{font-size:.9rem;line-height:1.95;color:rgba(255,254,247,.88);margin:0 0 .8rem}
.door p:last-child{margin-bottom:0}
.door b{color:#F4D46A;font-weight:700}
/* the ledger: every box the day can hold, obligatory and voluntary apart */
.tick{display:grid;grid-template-columns:1fr;gap:.42rem;margin:.35rem 0 0}
@media(min-width:30rem){.tick{grid-template-columns:1fr 1fr;gap:.42rem .9rem}}
.tick span{display:flex;align-items:flex-start;gap:.55rem;font-size:.755rem;line-height:1.55;color:rgba(255,254,247,.85)}
.tick i{font-style:normal;width:1.05rem;height:1.05rem;flex:none;border-radius:5px;display:grid;place-items:center;font-size:.6rem;font-weight:800;margin-top:.1rem;
  border:1px solid rgba(244,212,106,.55);background:rgba(244,212,106,.16);color:#F4D46A}
.tick span.nf i{border-color:rgba(255,254,247,.3);background:rgba(255,254,247,.06);color:rgba(255,254,247,.75)}
.tkh{font-size:.6rem;letter-spacing:.17em;text-transform:uppercase;font-weight:800;color:rgba(244,212,106,.8);margin:1.05rem 0 .1rem}
.tkh:first-of-type{margin-top:.2rem}
.tkh.v{color:rgba(255,254,247,.5)}
/* the covering heart */
.heart svg{width:100%;max-width:15rem;height:auto;display:block;margin:.2rem auto 0;overflow:visible}
.floor{list-style:none;padding:0;margin:.9rem 0 0}
.floor li{position:relative;padding-inline-start:1.6rem;font-size:.87rem;line-height:1.9;color:rgba(44,36,22,.84);margin:0 0 .55rem}
.floor li::before{content:"";position:absolute;inset-inline-start:0;top:.72rem;width:.5rem;height:.5rem;border-radius:999px;background:#C9A227}
.floor li b{color:#2C2416}
"""

FIG_JS = """<script>
(function(){
  var figs = document.querySelectorAll(".nfig");
  if (!figs.length) return;
  if (!("IntersectionObserver" in window)) {
    figs.forEach(function(f){ f.classList.add("ngo"); });
    return;
  }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if (!e.isIntersecting) return;
      e.target.classList.add("ngo");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: .2 });
  figs.forEach(function(f){ io.observe(f); });
})();
</script>"""


def qv(ar, en, r):
    return ('<div class="qv"><p class="a notranslate" translate="no">' + ar + '</p>'
            '<p class="e">' + en + '</p><p class="r">' + r + '</p></div>')

def card(kick, h, body, refs=""):
    return ('<article class="card"><p class="pill">' + kick + '</p>'
            '<h3 style="margin-top:.5rem">' + h + '</h3>' + body +
            (('<div class="refs">' + refs + '</div>') if refs else '') + '</article>')

def ref(badge, label, note):
    return '<span class="ref"><span class="evb ' + badge + '">' + label + '</span> ' + note + '</span>'

def sec(sid, ar, h2, sub, body):
    return ('<section class="rsec" id="' + sid + '"><div class="wrap"><div class="sh">'
            '<span class="ar notranslate" translate="no">' + ar + '</span><h2>' + h2 + '</h2></div>'
            '<p class="sub">' + sub + '</p>' + body + '</div></section>')


# ---------------------------------------------------------------------------
# the animated figures
#
# Each animates the one claim its paragraph is making, and each is authored so
# that the still frame is already true. Motion is the second telling.
# ---------------------------------------------------------------------------

FARD = [
    "Fajr, on time", "Dhuhr, on time", "Asr, on time", "Maghrib, on time",
    "Isha, on time", "The fast of Ramadan", "Zakat, paid in full",
    "Hajj, once, having the means", "Both parents honoured",
    "Every dirham earned lawfully", "The tongue guarded",
]
NAFL = [
    "Tahajjud, in the last third", "Two rak&rsquo;ahs before Fajr", "Four before Dhuhr, two after",
    "Two after Maghrib", "Two after Isha", "Witr before sleeping", "Duha in the forenoon",
    "Monday and Thursday fasted", "The morning remembrance", "The evening remembrance",
    "A daily portion of the Qur&rsquo;an", "Sadaqah, however small",
    "Istighfar, past seventy", "The sleeping sunnahs kept",
]

def ticks(items, nafl=False):
    """Each box lands in its own turn. The stagger restarts for the voluntary
    block, so twenty five boxes fill in about three seconds and not seven."""
    cls = "nmark nf" if nafl else "nmark"
    return "".join(
        '<span class="%s" style="--i:%d"><i>&#10003;</i>%s</span>' % (cls, i, t)
        for i, t in enumerate(items))

# 1 · the complete ledger. Twenty five boxes, all of them ticked, which is what
# most people picture when they picture a good Muslim.
FIG_LEDGER = (
  '<figure class="nfig">'
  '<p class="nlede">Here is a single day with nothing left undone. Everything Allah has made '
  'obligatory, performed. Everything the Prophet &#65018; did voluntarily, performed too. '
  'This is the life most people picture when they picture a good Muslim, and there is nothing '
  'wrong with a word of it.</p>'
  '<p class="tkh">Obligatory &middot; what is owed</p>'
  '<div class="tick">' + ticks(FARD) + '</div>'
  '<p class="tkh v">Voluntary &middot; what is offered on top</p>'
  '<div class="tick">' + ticks(NAFL, True) + '</div>'
  '<figcaption class="ncap">Twenty five entries, every one of them real, every one of them '
  'in the sources. Hold the picture. The next figure is the same man at the scale.</figcaption>'
  '</figure>')

# 2 · and the same ledger, paid out. The still frame already shows the third
# bar empty, because that is the true picture the hadith gives.
FIG_MUFLIS = (
  '<figure class="nfig nscale">'
  '<p class="nlede">The Prophet &#65018; asked his companions who the bankrupt man is. They said: '
  'the one with no money. He said the bankrupt of his nation is the one who arrives on the Day of '
  'Judgement with prayer, fasting and zakat, and arrives having insulted this one, taken the '
  'wealth of that one, spilled the blood of another. Each is given from his good deeds. '
  'When the good deeds run out, their sins are taken and thrown onto him.</p>'
  '<div class="nrow"><p class="nrl">Brought to the scale</p>'
  '<div class="ntrack"><span class="nbar" style="--w:100%"></span></div>'
  '<p class="nrv">A full life of prayer, fasting and charity</p></div>'
  '<div class="nrow"><p class="nrl">Claimed by the people he wronged</p>'
  '<div class="ntrack"><span class="nbar" style="--w:100%"></span></div>'
  '<p class="nrv">Paid out, deed by deed, until nothing is left</p></div>'
  '<div class="nrow"><p class="nrl">Remaining to him</p>'
  '<div class="ntrack"><span class="nbar" style="--w:0%"></span></div>'
  '<p class="nrv">Nothing. And then their sins are put on him.</p></div>'
  '<figcaption class="ncap">This is the hadith of <b>al-muflis</b>, the bankrupt one. '
  '<b>Muslim 2581</b></figcaption>'
  '</figure>')

# 3 · the life that looks successful from outside, against the word the Qur'an
# uses for it. The two columns disagree, which is the whole point of the kit.
FIG_NARROW = (
  '<figure class="nfig">'
  '<p class="nlede">The worst life on this earth is not the poorest one, and any page that '
  'suggests otherwise has never met a poor man who was happy or a rich one who was not. '
  'The Qur&rsquo;an locates it somewhere else entirely, and it uses a physical word for it.</p>'
  '<div class="ntwo">'
    '<div class="ncol"><h4>What it looks like from outside</h4>'
    '<p>Property. A title. People who take his calls. Photographs in which everyone is smiling. '
    'By every measure the world publishes, a life that worked.</p></div>'
    '<div class="ncol nright"><h4>The word the Qur&rsquo;an uses</h4>'
    '<p><i>Ma&rsquo;ishatan danka</i>: a living that is <b>constricted</b>, squeezed narrow. '
    'Not poor. Narrow. The room he lives in is small and getting smaller, and the walls are '
    'made of his own choosing.</p></div>'
  '</div>'
  '<figcaption class="ncap">&ldquo;And whoever turns away from My remembrance, indeed he will have '
  'a constricted life.&rdquo; <b>Qur&rsquo;an 20:124</b></figcaption>'
  '</figure>')

# 4 · the covering of the heart, one sin at a time, with the gap the sources
# insist on leaving open.
SPOTS = [(52,26,8),(76,26,8),(93,35,7),
         (38,44,9),(60,44,9),(82,44,9),
         (46,60,9),(66,60,9),(86,57,7),
         (40,72,6),(57,74,8),(73,71,7),
         (60,87,6)]
FIG_RUST = (
  '<figure class="nfig heart">'
  '<p class="nlede">The Prophet &#65018; described what a sin does. When a servant sins, a black '
  'point is put on his heart. If he leaves it, repents and seeks forgiveness, his heart is '
  'polished clean. If he returns, it is increased, until it covers his heart. That, he said, '
  'is the rust the Qur&rsquo;an mentions.</p>'
  '<svg viewBox="0 0 120 126" role="img" aria-label="A heart covered point by point, with one part left uncovered">'
    '<defs><linearGradient id="nhrt" x1="0" y1="0" x2="0" y2="1">'
      '<stop offset="0%" stop-color="rgba(244,212,106,.42)"/>'
      '<stop offset="100%" stop-color="rgba(201,162,39,.24)"/>'
    '</linearGradient></defs>'
    '<path d="M60 100 C20 72 8 48 8 33 C8 17 20 8 32 8 C44 8 54 16 60 27 C66 16 76 8 88 8 '
    'C100 8 112 17 112 33 C112 48 100 72 60 100 Z" fill="url(#nhrt)" '
    'stroke="rgba(244,212,106,.65)" stroke-width="2"/>'
    + "".join('<circle class="nmark" style="--i:%d" cx="%d" cy="%d" r="%d" fill="rgba(16,13,8,.93)"/>'
              % (i, x, y, r) for i, (x, y, r) in enumerate(SPOTS))
    + '<circle cx="29" cy="28" r="8.5" fill="#F4D46A"/>'
      '<circle cx="29" cy="28" r="12.5" fill="none" stroke="rgba(244,212,106,.5)" stroke-width="1.2"/>'
      '<text x="60" y="119" text-anchor="middle" '
      'style="font:800 7.4px Inter,system-ui,sans-serif;fill:rgba(244,212,106,.95);'
      'letter-spacing:.14em">ONE PART NEVER COVERED</text>'
  '</svg>'
  '<figcaption class="ncap">The covering is the hadith of the black point, graded <b>hasan sahih</b> '
  'by at-Tirmidhi (<b>3334</b>), read against <b>Qur&rsquo;an 83:14</b>. The gold that will not be '
  'covered is not decoration: it is <b>Qur&rsquo;an 39:53</b>, and it stays lit until the last '
  'breath.</figcaption>'
  '</figure>')

# 5 · the three rights. None of them at nothing, none of them at everything,
# which is the shape Salman described and the Prophet confirmed.
FIG_RIGHTS = (
  '<figure class="nfig nscale">'
  '<p class="nlede">Salman visited Abu ad-Darda and found his wife in shabby clothes. She told him '
  'her husband had no need of this world. Salman made him eat when he wanted to fast, made him '
  'sleep when he wanted to stand all night, and then said: your Lord has a right over you, your '
  'body has a right over you, and your family has a right over you, so give to each one its right. '
  'They took it to the Prophet &#65018;, who said Salman had spoken the truth.</p>'
  '<div class="nrow"><p class="nrl">Your Lord&rsquo;s right</p>'
  '<div class="ntrack"><span class="nbar" style="--w:78%"></span></div>'
  '<p class="nrv">The five, kept. Then whatever you can hold, kept.</p></div>'
  '<div class="nrow"><p class="nrl">Your body&rsquo;s right</p>'
  '<div class="ntrack"><span class="nbar" style="--w:62%"></span></div>'
  '<p class="nrv">Sleep. Food. Movement. It is not yours to grind down.</p></div>'
  '<div class="nrow"><p class="nrl">Your family&rsquo;s right</p>'
  '<div class="ntrack"><span class="nbar" style="--w:70%"></span></div>'
  '<p class="nrv">Presence, not leftovers. They are not an interruption of the work.</p></div>'
  '<figcaption class="ncap">No bar here reaches the end, and that is the finding, not a failure of '
  'the drawing. A life with one bar at full and the others at nothing is the life Salman was sent '
  'to interrupt. <b>Bukhari 1968</b></figcaption>'
  '</figure>')

# 6 · the small thing that does not stop. The endless track is the point: the
# light keeps leaving the edge for as long as the figure is on the screen.
FIG_KEEP = (
  '<figure class="nfig nscale">'
  '<p class="nlede">Asked which deeds Allah loves most, he &#65018; said: the most consistent, '
  'even if they are few. It is one of the few places where the sources rank two things against '
  'each other and the smaller one wins.</p>'
  '<div class="nrow"><p class="nrl">The great effort, once</p>'
  '<div class="ntrack"><span class="nbar" style="--w:92%"></span></div>'
  '<p class="nrv">A Ramadan of standing, and then eleven months of nothing</p></div>'
  '<div class="nrow"><p class="nrl">The small act, every day</p>'
  '<div class="ntrack nendless"><span class="nbar" style="--w:34%"></span></div>'
  '<div class="nmore"><i>&rarr;</i><span>Two rak&rsquo;ahs, or one page, or one pound, '
  'and it does not stop</span></div></div>'
  '<figcaption class="ncap">&ldquo;The most beloved of deeds to Allah are the most consistent, '
  'even if they are few.&rdquo; <b>Bukhari 6464 &middot; Muslim 783</b></figcaption>'
  '</figure>')


M = []

# ---------------------------------------------------------------------------
M.append(sec("frame", "أَزْوَاجًا ثَلَاثَةً", "You become three kinds",
  "The sorting in this room is not ours. The Qur'an does it, by name, in Al-Waqi'ah, and every "
  "section below is one of the three it names.",
  qv("وَكُنتُمْ أَزْوَاجًا ثَلَاثَةً &nbsp;&#1757;&nbsp; فَأَصْحَابُ الْمَيْمَنَةِ مَا أَصْحَابُ الْمَيْمَنَةِ &nbsp;&#1757;&nbsp; "
     "وَأَصْحَابُ الْمَشْأَمَةِ مَا أَصْحَابُ الْمَشْأَمَةِ &nbsp;&#1757;&nbsp; وَالسَّابِقُونَ السَّابِقُونَ",
     "&ldquo;And you become of three kinds. The companions of the right, what are the companions "
     "of the right. And the companions of the left, what are the companions of the left. And the "
     "foremost, the foremost.&rdquo;",
     "Qur'an 56:7-10")
  + '<p class="raw">Three lives follow. The first has every box ticked and is still in danger, '
    'and it is put first because it is the one people aim at. The second is the worst life a human '
    'being can live, written without softening, because a reader in it will recognise a flinch and '
    'close the page. The third is the one the Qur&rsquo;an says a great many people reach, from '
    'the earliest generations and the later ones both, and it is the only one of the three built '
    'to be reached from where you are sitting.</p>'
  + '<div class="hon"><b>What this room will not do</b>'
    '<p>It will not tell you which of the three you are. Nobody on earth is in a position to tell '
    'you that, and the one place the sources are unanimous is that a man can look like the first '
    'and be the second, and look like the second and die as the first.</p></div>'))

# ---------------------------------------------------------------------------
M.append(sec("ledger", "الْكِتَاب", "One &middot; The full ledger",
  "A day with nothing left undone: every obligation performed, every voluntary act performed "
  "on top of it. Then the same day at the scale.",
  FIG_LEDGER
  + card("Read the two columns again", "Notice what the ledger does not contain.",
    "<p>Every one of those twenty five entries is between a man and his Lord. Not one of them "
    "is between him and another human being, except the two that slipped in: his parents, and "
    "his earnings. That is the shape of the trap. A ledger built only of worship can be complete "
    "and still say nothing at all about how he treats a waiter, a wife, a tenant, or a man who "
    "cannot afford a lawyer.</p>"
    "<p>This is not an argument against the twenty five. Keep them. It is an argument that they "
    "were never the whole accounting, and the sources say so in language far harder than ours.</p>",
    ref("editorial", "Editorial", "our reading of what the ledger leaves out"))
  + FIG_MUFLIS
  + card("The first way a full ledger fails", "It can be paid out entirely to the people you wronged.",
    "<p>The hadith of the bankrupt one is not a warning about a bad man with no prayer. It is "
    "specifically about a man who <i>arrives with prayer, fasting and zakat</i>. His worship was "
    "real. It was also, at the scale, currency, and every person he insulted, cheated or struck "
    "was standing there with an invoice.</p>"
    "<p>The practical consequence is unglamorous: a wrong done to a person is not settled on a "
    "prayer mat. It is settled with that person, while both of you are alive, in the form of the "
    "money returned, the apology made, the lie corrected in front of the people who heard it.</p>",
    ref("sunnah", "Sunnah", "Muslim 2581"))
  + card("The second way", "The three most impressive entries are the three named in the hadith.",
    "<p>The Prophet &#65018; described the first three thrown into the Fire on the Day of "
    "Judgement, and they are not the ones anyone expects. A man killed in battle, who is told he "
    "fought so it would be said he was brave, and it was said. A man who learned and taught and "
    "recited the Qur&rsquo;an, who is told he did it so it would be said he was learned, and it "
    "was said. A man who gave his wealth away, who is told he gave so it would be said he was "
    "generous, and it was said.</p>"
    "<p>Read the ledger above one more time with that in mind. The three deeds most likely to be "
    "seen are the three in the hadith. This is why <i>riya&rsquo;</i>, doing it to be seen, was "
    "called the hidden thing: nobody performs it on purpose, and nobody is safe from it.</p>",
    ref("sunnah", "Sunnah", "Muslim 1905"))
  + card("The third way", "Some of it was never asked of you.",
    "<p>Three men came to the houses of the Prophet &#65018; asking about his worship. When they "
    "were told, they thought it too little for a man already forgiven. One said he would pray all "
    "night and never stop. One said he would fast every day and never break it. One said he would "
    "never marry.</p>"
    "<p>He came to them and said: by Allah, I am the one among you with the most fear of Allah and "
    "the most awareness of Him, and yet I fast and I break my fast, I pray and I sleep, and I "
    "marry women. <b>Whoever turns away from my way is not of me.</b></p>"
    "<p>The maximal ledger is not the sunnah. The sunnah has sleep in it.</p>",
    ref("sunnah", "Sunnah", "Bukhari 5063"))))

# ---------------------------------------------------------------------------
M.append(sec("worst", "أَصْحَابُ الْمَشْأَمَة", "Two &middot; The worst life",
  "Written plainly, because the person who needs this section will recognise softening "
  "immediately and stop reading.",
  FIG_NARROW
  + '<div class="dark"><p class="k">The worst life a human being can live on this earth</p>'
    '<p>He is sixty one. He owns four properties and cannot name a single person who would sit '
    'with him for an hour without wanting something. He has not spoken to his mother in nine years '
    'over a sum of money that would not now change his week. He tells the story of that argument '
    'well; he has had a long time to shape it.</p>'
    '<p>His children learned from watching him that a person is a balance sheet, and they were '
    'quick learners, and now they treat him exactly as he taught them to. He finds this ungrateful. '
    'He has never once made the connection out loud.</p>'
    '<p>He has taken from people who could not push back. A wage held for six weeks because the man '
    'had no papers and no lawyer. A partner cut out with a clause the partner did not read. A woman '
    'who was twenty three and believed him. He does not think of himself as having done any of this. '
    'He is not lying to you; he is a man who has simply never once run the sentence with himself as '
    'the subject.</p>'
    '<p>There is no quiet in his day. Not one minute. The television is on when he eats. The phone '
    'is in his hand in the bathroom. He is not avoiding boredom, he is avoiding a question he '
    'decided at twenty two not to answer, and the machinery required to keep not answering it has '
    'been running for thirty nine years without a break.</p>'
    '<p>And here is what makes it the worst life and not a cartoon: <b>he is likeable.</b> He is '
    'funny at dinner. He is generous when people are watching. Nobody at his funeral will say a '
    'bad word, and roughly nine people will come, and they will leave early, and the thing that '
    'will be missing from that room is not respectability. It is that not one person there will '
    'have been made better by having known him for sixty one years.</p>'
    '<p>He was never poor. He was never in pain. <b>Nothing bad ever happened to him.</b> That is '
    'the point. This is the worst life available to a human being and it can be lived entirely in '
    'comfort, and it is far more common than the dramatic ruin people picture when they picture '
    'a life gone wrong.</p></div>'
  + card("Why this and not something more lurid", "The Qur'an's own charge is the one above.",
    "<p>Scripture is available to be as graphic as it wishes, and about this it is not. It says "
    "they have hearts they do not understand with, eyes they do not see with, ears they do not "
    "hear with; that they are like cattle, rather more astray; and it names the condition: "
    "<i>they are the heedless</i>. The accusation is not appetite. It is the wasting of equipment "
    "that was issued for something.</p>"
    "<p>And it names what such a life spent itself on: rivalry in increase distracted you, "
    "<i>until you visited the graves</i>. Not until you were confronted. Until you simply arrived, "
    "with the counting unfinished, the way it always is.</p>",
    ref("quran", "Qur'an", "7:179") + ref("quran", "Qur'an", "102:1-2"))
  + card("The one thing that makes it irreversible", "Not the sin. The refusal to look at it.",
    "<p>The heart in the figure below is not covered by a single catastrophe. It is covered a "
    "point at a time, and the hadith is precise about which point sticks: the one that is "
    "<i>returned to</i>. A sin repented of is polished off the heart entirely. A sin repeated "
    "without ever being named as a sin is the one that stays.</p>"
    "<p>Which is why the man above is in more danger than a drunk who weeps about it. The drunk "
    "still has the word for what he is doing. The man above has replaced the word.</p>",
    ref("debated", "Scholars differ", "Tirmidhi 3334, graded hasan sahih by at-Tirmidhi")
    + ref("quran", "Qur'an", "83:14"))
  + FIG_RUST
  + card("The three the sources single out", "Oppression, severed blood, and the orphan's money.",
    "<p>Sending Mu&rsquo;adh to Yemen, the Prophet &#65018; told him to fear the supplication of "
    "the oppressed, <b>for there is no veil between it and Allah</b>. That is a strange sentence "
    "to sit with. It means the man who held that wage for six weeks has a petition filed against "
    "him that no procedure delays.</p>"
    "<p>He also said the one who severs the ties of kinship does not enter Paradise. Nine years "
    "of not speaking to a mother is not a family disagreement in this frame; it is named.</p>"
    "<p>And the Qur&rsquo;an on those who consume the wealth of orphans unjustly: they are only "
    "consuming fire into their bellies, and they will burn in a blaze. There is no softer reading "
    "available. That is the verse.</p>",
    ref("sunnah", "Sunnah", "Bukhari 1496") + ref("sunnah", "Sunnah", "Bukhari 5984")
    + ref("quran", "Qur'an", "4:10"))
  + '<div class="door"><p class="k">And now the part that is not optional to include</p>'
    '<p>A man came to a scholar having killed ninety nine people and asked whether repentance was '
    'possible. He was told no, and he killed him too, making a hundred. He asked again, of someone '
    'with more knowledge, and was told: <b>who stands between you and repentance?</b> He was told '
    'to leave his town, because the town itself was part of it, and to go to a place where Allah '
    'is worshipped. He died on the road. He was forgiven.</p>'
    '<p>He was forgiven <i>on the road</i>, having completed nothing. That is the hadith, and it '
    'is in Bukhari and Muslim both, and it is there for exactly the reader who has got this far '
    'down the page and recognised himself.</p>'
    '<p>&ldquo;Say: O My servants who have transgressed against themselves, do not despair of the '
    'mercy of Allah. Indeed Allah forgives all sins.&rdquo; And the door stands open, the Prophet '
    '&#65018; said, until the death rattle reaches the throat. <b>Not until you deserve it. Until '
    'you die.</b></p>'
    '<div class="refs" style="margin-top:.9rem">'
    + ref("sunnah", "Sunnah", "Bukhari 3470 &middot; Muslim 2766")
    + ref("quran", "Qur'an", "39:53")
    + ref("debated", "Scholars differ", "the death-rattle hadith, Tirmidhi 3537, graded hasan")
    + '</div></div>'
  + '<div class="care"><p class="k">Before you go on</p>'
    '<p>If some of the above described you closely enough that it was unpleasant to read, that '
    'discomfort is not a verdict, and acting on it today matters far more than feeling it '
    'intensely. Pick the smallest reversible thing: the call to your mother, the money returned, '
    'the message sent to the person you cut. One. Today.</p>'
    '<p>And if what is actually holding you is not a moral failure but something with a grip of '
    'its own, an addiction, a debt spiralling past what you can see, or a stretch where you have '
    'stopped wanting to be here, that is not a matter of praying harder. Speak to a doctor and to '
    'one human being you trust, this week. Seeking treatment is not a lapse in tawakkul. The '
    'Prophet &#65018; told his companions to seek treatment.</p></div>'))

# ---------------------------------------------------------------------------
M.append(sec("balance", "أَصْحَابُ الْيَمِين", "Three &middot; The balanced life",
  "The Qur'an describes the companions of the right as a multitude from the earliest generations "
  "and a multitude from the later ones. It is a crowd. It was built to be reachable.",
  qv("ثُلَّةٌ مِّنَ الْأَوَّلِينَ &nbsp;&#1757;&nbsp; وَثُلَّةٌ مِّنَ الْآخِرِينَ",
     "&ldquo;A multitude from the former peoples, and a multitude from the later peoples.&rdquo;",
     "Qur'an 56:39-40")
  + '<p class="raw">Read that against the verses just above it, where the foremost are '
    '<i>a multitude of the former peoples and a few of the later ones</i>. The Qur&rsquo;an is '
    'making a distinction and it is not hiding it: the very front rank thins out as the '
    'generations go on, and the right hand does not. <b>Whatever else is true of the age you were '
    'born into, that door was not narrowed.</b></p>'
  + FIG_RIGHTS
  + card("The floor, stated concretely", "Not a mood. A list you could start tonight.",
    '<ul class="floor">'
    "<li><b>The five, on time.</b> Not with perfect presence of heart. On time, wherever you "
    "happen to be standing. Presence comes later and it comes from this, not before it.</li>"
    "<li><b>Something of the Qur'an daily</b>, and the amount is genuinely allowed to be small. "
    "A page. Five verses with the meaning read alongside.</li>"
    "<li><b>Your parents hear your voice.</b> If they are gone, they hear your du'a.</li>"
    "<li><b>Clean income.</b> Everything else on this list is undermined if this one is rotten.</li>"
    "<li><b>Your household experiences you as safe.</b> Not as a project to be improved, not as "
    "an audience. Safe.</li>"
    "<li><b>You give something small and regular</b>, at an amount you will not stop.</li>"
    "<li><b>You sleep, eat and move</b>, because the body's right is one of the three and it is "
    "not the one you are allowed to spend.</li>"
    "<li><b>You oppress nobody</b>, and where you already have, you go to the person and not "
    "only to the prayer mat.</li>"
    "<li><b>Istighfar, daily.</b> He &#65018; sought forgiveness more than seventy times a day, "
    "and there was nothing on his record.</li>"
    "</ul>",
    ref("sunnah", "Sunnah", "Bukhari 1968") + ref("sunnah", "Sunnah", "Bukhari 6307")
    + ref("editorial", "Editorial", "the arrangement into a floor is ours, not revelation"))
  + FIG_KEEP
  + card("Why the small consistent thing is not a consolation prize", "It is the ranked answer.",
    "<p>It would be easy to read <i>the most beloved deeds are the most consistent, even if few</i> "
    "as a kindness offered to people who cannot manage more. It is not phrased as a kindness. It "
    "is phrased as a ranking, and the small continuous thing is placed above the large "
    "discontinuous one.</p>"
    "<p>He also said that this religion is ease, and that nobody makes it hard on himself without "
    "it defeating him. Not <i>without it being difficult</i>. Without it <b>defeating</b> him. "
    "That is a prediction about what happens to the man who tries to live the twenty five entry "
    "ledger on willpower in the third week.</p>",
    ref("sunnah", "Sunnah", "Bukhari 6464 &middot; Muslim 783")
    + ref("sunnah", "Sunnah", "Bukhari 39"))
  + card("The pass, and who is on the other side of it", "The Qur'an defines it, then names them.",
    "<p>Al-Balad says a human being was shown the two ways and has not attempted the steep pass, "
    "then asks what could make you know what the steep pass is, and then, unusually, answers its "
    "own question. Freeing a neck. Feeding, on a day of hunger, an orphan who is a relative, or a "
    "poor person in the dust. And then being of those who believe, and who counsel one another to "
    "patience, and counsel one another to mercy.</p>"
    "<p>And immediately after that definition: <b>those are the companions of the right hand.</b></p>"
    "<p>Look at what is in that list and what is not. Nothing in it requires a scholar, a title, "
    "a platform or an unusual capacity. Three of the four are things done to another human being "
    "who is worse off than you, and the fourth is refusing to let the people around you face "
    "difficulty alone. It is a definition you could satisfy this month.</p>",
    ref("quran", "Qur'an", "90:10-18"))
  + '<div class="hon"><b>What none of this promises</b>'
    '<p>Not an easy life. Not a life without grief, illness, money trouble or the ordinary '
    'humiliations. The man who lived this pattern most completely buried six of his seven children. '
    'The promise attached to it is different and it is worth more: <i>whoever does righteousness, '
    'male or female, while a believer, We will surely cause him to live a good life.</i> '
    'A good one. Not a comfortable one.</p></div>'))

# ---------------------------------------------------------------------------
M.append(sec("place", "الْمِيزَان", "Where you actually are",
  "One question, asked honestly, is worth more than the whole page above.",
  '<p class="raw">Not <i>which of the three am I</i>. Nobody can answer that and the sources warn '
  'off anyone who tries. The useful question is smaller and it has an answer you already know:</p>'
  + '<div class="qv"><p class="e" style="font-size:1rem;margin:0">If a person you have wronged and '
    'a person you have helped were both asked to describe you this evening, and neither knew you '
    'would hear it, <b style="color:#F4D46A">which of the two would take longer to speak?</b></p>'
    '<p class="r">A question, not a ruling</p></div>'
  + '<p class="raw">If that question landed somewhere, it landed for a reason, and the thing to do '
    'with it is not to feel it more strongly. It is the one call, the one repayment, the one '
    'sentence of apology. Then Fajr tomorrow. Then the same again the day after, which is the only '
    'mechanism any of the three sections above actually run on.</p>'))

M.append(band(
  "Where to go from here",
  "This room sorts. These rooms are where the work of the third section is actually done.",
  [
    ("/good-life", "How to Live a Good Life",
     "The third section at full length: the daily frame, sleep, food, money, people, and what to do in a genuinely bad year."),
    ("/soul", "The Journey of the Soul",
     "What happens after the scale, station by station, which is the other half of this question."),
    ("/family", "The Family Room",
     "The people who carry most of the weight of whether your ledger is honest."),
    ("/protection", "Protection and the Light",
     "The morning and evening remembrance, with the authentic separated from the popular."),
    ("/pillars", "The Five Pillars",
     "The obligatory column of the ledger, one pillar at a time, with nothing assumed."),
    ("/begin", "Begin here",
     "If the second section described you and you want to start from zero, this is the door."),
  ]))

JSONLD = """<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article",
"headline":"Three lives: the full ledger, the worst life, and the balanced one",
"description":"The Qur'an sorts people into three kinds in Al-Waqi'ah. Three lives set side by side: a day with every obligatory and voluntary act performed, the worst life a human being can live on this earth described plainly, and the balanced life the Qur'an says a multitude reach.",
"inLanguage":"en","isPartOf":{"@type":"WebSite","name":"NOOR Codex of Light","url":"https://noorcodex.com"},
"about":[{"@type":"Thing","name":"Al-Waqi'ah"},{"@type":"Thing","name":"Repentance"},{"@type":"Thing","name":"Balance in Islam"}]}
</script>"""

html = shell(
    slug="three-lives",
    title="Three lives · the full ledger, the worst life, and the balanced one",
    desc="The Qur'an sorts people into three kinds. Three lives side by side: a day with every obligatory and voluntary act performed and why it can still fail, the worst life a human being can live described without softening, and the balanced life the Qur'an says a multitude reach.",
    ar="أَزْوَاجًا ثَلَاثَةً",
    kick="One day, weighed three ways",
    h1="Three lives",
    lead="A day with every box ticked. The worst life a human being can live on this earth, written without softening. And the one in between, which the Qur'an says a great many people reach. The sorting is not ours; it is Al-Waqi'ah's.",
    extra_head='<link rel="stylesheet" href="/assets/anim.css?v=97"/>',
    css=CSS, jsonld=JSONLD, main="\n".join(M) + FIG_JS,
    footline="Every claim badged. Where it says editorial, it is our counsel and not revelation.")

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
open(os.path.join(root, "three-lives.html"), "w", encoding="utf-8").write(html)
print("three-lives.html written:", len(html), "bytes")
