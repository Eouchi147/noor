#!/usr/bin/env python3
"""NOOR · the simulation room.

A reader arrives having felt, privately and for years, that this life is not
the real one. The internet gives that feeling one name, simulation theory,
and one conclusion, that nothing here matters. The Qur'an gives it a much
older name and the opposite conclusion. This room agrees with the half that
is true, corrects the half that is poison, and refuses the boast that Islam
invented the idea, because it did not, and the whole credibility of this
house rests on never overstating a claim.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from room import shell

CSS = """
.qv{background:linear-gradient(170deg,#14100A,#1b2440);border:1px solid rgba(244,212,106,.28);border-radius:18px;padding:1.15rem 1.2rem;margin:.95rem 0;color:#FFFEF7}
.qv .a{font-family:Amiri,serif;font-size:1.42rem;line-height:2.05;color:#F4D46A;direction:rtl;text-align:center;margin:0}
.qv .e{font-size:.86rem;line-height:1.85;color:rgba(255,254,247,.84);margin:.7rem 0 0}
.qv .r{font-size:.64rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,212,106,.7);font-weight:800;margin:.6rem 0 0}
.brk{display:grid;grid-template-columns:1fr;gap:.7rem;margin-top:1rem}
@media(min-width:40rem){.brk{grid-template-columns:1fr 1fr}}
.brk .b{background:#fff;border:1px solid rgba(44,36,22,.12);border-radius:16px;padding:.95rem 1rem}
.brk .b h4{margin:0 0 .3rem;font-size:.9rem;font-weight:800;color:#2C2416}
.brk .b .t{font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .45rem}
.brk .b p{margin:0;font-size:.82rem;line-height:1.8;color:rgba(44,36,22,.78)}
.hon{border-inline-start:3px solid rgba(201,162,39,.55);background:rgba(201,162,39,.06);border-radius:0 14px 14px 0;padding:.9rem 1rem;margin:1rem 0}
.hon b{color:#8a6d13}
.hon p{margin:.4rem 0 0;font-size:.85rem;line-height:1.85;color:rgba(44,36,22,.8)}
"""


# ---- the animated figures --------------------------------------------------
# Each one animates the single thing its paragraph claims, and each one is
# written so the still frame is already true: a reader who has asked for no
# motion loses nothing but the motion.

# The figures hold their finished state until they are actually looked at.
# Nothing here is required for the page to be correct: if the observer never
# runs, every figure simply stays in its true still frame.
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
      io.unobserve(e.target);      /* each figure arrives once and stays arrived */
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: .2 });
  figs.forEach(function(f){ io.observe(f); });
})();
</script>"""

FIG_SCALE = (
  '<figure class="nfig nscale">'
  '<p class="nlede">If a life of eighty years is drawn to the scale the Qur&rsquo;an gives it, the drawing fails, '
  'because one of the two lines has no end. This is the closest an honest diagram gets:</p>'

  '<div class="nrow">'
    '<p class="nrl">This life</p>'
    '<div class="ntrack"><span class="nbar" style="--w:7px"></span></div>'
    '<p class="nrv">a finger of water</p>'
  '</div>'

  '<div class="nrow">'
    '<p class="nrl">What follows</p>'
    '<div class="ntrack nendless"><span class="nbar" style="--w:100%"></span></div>'
    '<p class="nmore"><span>the sea</span><i aria-hidden="true">&rarr;</i></p>'
    '<p class="nrv" style="font-weight:400;color:rgba(255,254,247,.7);font-size:.72rem">and it does not stop at the edge of this card</p>'
  '</div>'

  '<figcaption class="ncap">Drawn from <b>Muslim 2858</b>. The second bar is cut off by the screen, not by the reality.</figcaption>'
  '</figure>')

FIG_REMADE = (
  '<figure class="nfig">'
  '<p class="nlede">If existence is not a property a thing owns but something continuously given, then nothing here '
  'coasts. Every point below leaves and is returned on its own clock, which is why the field never goes dark and is '
  'never twice the same.</p>'
  '<div class="ngrid" aria-hidden="true">' + "".join(
      '<i style="--d:%.2fs;--s:%.2fs"></i>' % (1.9 + (i % 7) * 0.28, (i * 0.137) % 3.4) for i in range(56)
  ) + '</div>'
  '<figcaption class="ncap">A picture of a claim, not of physics. Scholars differ on how far to press it; what is '
  'agreed is that nothing subsists on its own. <b>Editorial</b></figcaption>'
  '</figure>')

FIG_NIGHT = (
  '<figure class="nfig">'
  '<p class="nlede">You have rehearsed the exit every night of your life and called it going to bed. The Qur&rsquo;an '
  'uses one verb for both: souls are taken in death, and taken in sleep, and one of the two is sent back.</p>'
  '<div class="narc">'
  '<svg viewBox="0 0 300 96" role="img" aria-label="An arc from waking through sleep and back to waking">'
    '<defs>'
      '<linearGradient id="nagrad" x1="0" y1="0" x2="1" y2="0">'
        '<stop offset="0%" stop-color="#C9A227"/><stop offset="50%" stop-color="rgba(255,254,247,.35)"/>'
        '<stop offset="100%" stop-color="#F4D46A"/>'
      '</linearGradient>'
      '<path id="narcp" d="M18 74 C 70 8, 230 8, 282 74"/>'
    '</defs>'
    '<use href="#narcp" class="ntrack2"/>'
    '<use href="#narcp" class="npath" style="--len:330"/>'
    '<circle class="ndot nwalk" r="4.5" style="offset-path:path(\'M18 74 C 70 8, 230 8, 282 74\')"/>'
    '<circle class="ndot" cx="18" cy="74" r="3"/>'
    '<circle class="ndot" cx="282" cy="74" r="3"/>'
    '<text class="nlbl" x="18" y="90" text-anchor="start">Waking</text>'
    '<text class="nlbl on" x="150" y="18" text-anchor="middle">The soul is taken</text>'
    '<text class="nlbl" x="282" y="90" text-anchor="end">Waking</text>'
  '</svg>'
  '</div>'
  '<figcaption class="ncap">&ldquo;Allah takes the souls at the time of their death, and those that did not die, '
  'during their sleep.&rdquo; <b>Qur&rsquo;an 39:42</b></figcaption>'
  '</figure>')

FIG_BREAK = (
  '<figure class="nfig">'
  '<p class="nlede">The two claims are close enough to be confused and far enough apart to lead opposite lives. '
  'The whole difference sits in one word.</p>'
  '<div class="ntwo">'
    '<div class="ncol"><h4>The modern version</h4>'
    '<p>This world is <b>false</b>. Nothing in it finally counts, so nothing in it need be paid for. The correct '
    'response is contempt, and contempt is cheap.</p></div>'
    '<div class="ncol nright"><h4>What the sources say</h4>'
    '<p>This world is <b>not final</b>. It was not made in vain, an atom&rsquo;s weight is seen, and it is therefore '
    'to be held loosely and used carefully at the same time.</p></div>'
  '</div>'
  '<figcaption class="ncap">&ldquo;Our Lord, You did not create this in vain&rdquo; <b>3:191</b> &middot; '
  '&ldquo;We did not create the heavens and the earth and what is between them in play&rdquo; <b>44:38</b></figcaption>'
  '</figure>')

def qv(ar, en, ref):
    return ('<div class="qv"><p class="a notranslate" translate="no">' + ar + '</p>'
            '<p class="e">' + en + '</p><p class="r">' + ref + '</p></div>')

def card(kick, h, body, refs=""):
    # Cards on a long prose page have been held at opacity 0 by a stale scroll
    # trigger three separate times in this codebase. A paragraph is not worth
    # that risk: this room's cards simply arrive already visible.
    return ('<article class="card"><p class="pill">' + kick + '</p>'
            '<h3 style="margin-top:.5rem">' + h + '</h3>' + body +
            (('<div class="refs">' + refs + '</div>') if refs else '') + '</article>')

def ref(badge, label, note):
    return ('<span class="ref"><span class="evb ' + badge + '">' + label + '</span> ' + note + '</span>')

def sec(sid, ar, h2, sub, body):
    return ('<section class="rsec" id="' + sid + '"><div class="wrap"><div class="sh">'
            '<span class="ar notranslate" translate="no">' + ar + '</span><h2>' + h2 + '</h2></div>'
            '<p class="sub">' + sub + '</p>' + body + '</div></section>')

M = []

# ---- 1 · the feeling ------------------------------------------------------
M.append(sec("feeling", "الحَيَوَان", "The feeling has a name, and the Qur&rsquo;an gave it first",
  "Many people arrive at this on their own, usually young, usually at night: the sense that this is not the real thing, that the real thing is elsewhere, and that we were placed inside this one on purpose. That intuition is not exotic in Islam. It is close to the centre of it.",
  qv("وَمَا هَٰذِهِ الْحَيَاةُ الدُّنْيَا إِلَّا لَهْوٌ وَلَعِبٌ ۚ وَإِنَّ الدَّارَ الْآخِرَةَ لَهِيَ الْحَيَوَانُ ۚ لَوْ كَانُوا يَعْلَمُونَ",
     "This worldly life is nothing but diversion and play, and indeed the Home of the Hereafter, that is <b>al-hayawan</b>, the [real] life, if only they knew.",
     "Al-&lsquo;Ankabut 29:64")
  + card("Read the word again", "Not &ldquo;a better life&rdquo;. <i>The</i> life.",
    "<p>Arabic could have said the next life is greater, or longer, or sweeter. It says something else. <b>Al-hayawan</b> is the intensive form: life itself, life in the full sense, the thing that the word life was made to point at. Grammatically, the verse puts reality on the other side of death and leaves this side holding the diversion.</p>"
    "<p>So when the feeling arrives that you are inside something provisional, the Qur&rsquo;an does not correct the feeling. It confirms it, then spends the rest of the Book telling you what to do about it, which is the part no philosophy has ever managed.</p>",
    ref("quran","Qur'an","29:64 · the word is al-hayawan"))))

# ---- 2 · how small ---------------------------------------------------------
M.append(sec("small", "قَلِيل", "How small it actually is",
  "Islam does not ask you to take the shortness on trust. It gives you images, and the images are physical, so they survive translation into any century.",
  card("The finger and the sea", "Dip one finger in the ocean. Look at what comes back.",
    "<p>The Prophet &#65018; said: &ldquo;What is this world compared to the Hereafter except that one of you dips his finger in the sea, and let him see what it brings back.&rdquo; Not a smaller share. A film of water against every ocean on earth.</p>",
    ref("sunnah","Sunnah","Muslim 2858"))
  + card("Asked at the end", "&ldquo;A day, or part of a day.&rdquo;",
    "<p>On that Day they are asked how many years they stayed on the earth. The answer that comes back is not eighty, or a hundred. It is <i>a day, or part of a day</i>. Elsewhere: as though they had stayed no longer than an evening, or the morning that follows it. Whatever a life feels like from inside, this is what it measures from outside.</p>",
    ref("quran","Qur'an","23:112-113") + ref("quran","Qur'an","79:46"))
  + card("How to stand in it", "A stranger, or someone crossing a road.",
    "<p>&ldquo;Be in this world as though you were a stranger, or a passer-by.&rdquo; Ibn &lsquo;Umar, who narrated it, used to say: when you reach evening do not expect the morning, and when you reach morning do not expect the evening. Not gloom. Luggage discipline.</p>",
    ref("sunnah","Sunnah","Bukhari 6416"))
  + FIG_SCALE))

# ---- 3 · built as a test ---------------------------------------------------
M.append(sec("designed", "ابْتِلَاء", "It was built to be entered, and built to be a test",
  "The second half of your intuition, that we are inside this by design and had to get involved, is stated outright, and more than once.",
  qv("الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ عَمَلًا",
     "He who created death and life to test you, which of you is best in deed.",
     "Al-Mulk 67:2")
  + card("The scenery is part of the exam", "Every beautiful thing here is a question.",
    "<p>&ldquo;Indeed We have made what is upon the earth an adornment for it, that We may test which of them is best in deed.&rdquo; The wealth, the faces, the cities, the work: not distractions from the test, but the paper it is printed on. And no one is waved through: &ldquo;Do people think they will be left to say we believe, and not be tested?&rdquo;</p>",
    ref("quran","Qur'an","18:7") + ref("quran","Qur'an","29:2"))))

# ---- 4 · the correction ----------------------------------------------------
M.append(sec("notfake", "بَاطِلًا", "But it is not fake, and this is exactly where the modern version goes wrong",
  "Here the two accounts separate, and the separation matters more than everything they agree on. Simulation theory tends to arrive at a shrug: if none of this is real, nothing here weighs anything. The Qur&rsquo;an anticipates that word and refuses it by name.",
  qv("رَبَّنَا مَا خَلَقْتَ هَٰذَا بَاطِلًا سُبْحَانَكَ فَقِنَا عَذَابَ النَّارِ",
     "Our Lord, You did not create this in vain. Glory be to You, so protect us from the punishment of the Fire.",
     "Al-&lsquo;Imran 3:191")
  + card("Not in play", "The heavens and the earth were not made as a game.",
    "<p>&ldquo;We did not create the heavens and the earth and what is between them in play. We did not create them except in truth.&rdquo; The word for the opposite of truth here, <b>batil</b>, is the exact word a person reaches for when they say <i>none of this is real</i>. The Book uses it in order to deny it.</p>",
    ref("quran","Qur'an","44:38-39"))
  + card("And every atom is weighed", "Total consequence, not none.",
    "<p>&ldquo;So whoever does an atom&rsquo;s weight of good will see it, and whoever does an atom&rsquo;s weight of evil will see it.&rdquo; This is the opposite of a world without consequence. It is a world of <i>complete</i> consequence, at a resolution finer than anyone would choose for themselves.</p>",
    ref("quran","Qur'an","99:7-8"))
  + card("And the pain here is real", "He &#65018; wept when his son died.",
    "<p>When his infant son Ibrahim died in his arms, the Prophet &#65018; wept, and said: &ldquo;The eye sheds tears and the heart grieves, and we say nothing except what pleases our Lord.&rdquo; A teaching that this life is unreal would have made that grief a mistake. It was not a mistake. Grief here is not an error in the code; it is the weight of a real loss in a world that will not last.</p>"
    "<p>So the accurate sentence is not <i>this life is fake</i>. It is harder and better than that: <b>this life is short, light, and decisive.</b> Small in size. Infinite in weight. And the shortness is not an excuse to sit out; the shortness is the reason to move.</p>",
    ref("sunnah","Sunnah","Bukhari 1303") + ref("editorial","Editorial","the phrasing is ours, the ruling is not"))
  + FIG_BREAK))

# ---- 5 · continuous creation ----------------------------------------------
M.append(sec("rendered", "التَّجْدِيد", "The part that will surprise you: a world re-created moment by moment",
  "If any classical doctrine deserves to be set beside the modern picture of a rendered world, it is this one, argued in Baghdad and Nishapur roughly a thousand years before anyone owned a computer.",
  card("The Ash&lsquo;ari position", "Nothing here persists by its own strength.",
    "<p>A large body of Sunni theologians, the Ash&lsquo;aris among them, held that the accidents of the world do not endure on their own: that existence is renewed, instant by instant, by the act of the One who holds it. On this reading a thing does not continue because continuing is what things do. It continues because it is continuously given.</p>"
    "<p>Al-Ghazali pushed the same point into causation itself: fire does not burn by a power of its own. The burning is created alongside the contact, habitually and reliably, by Allah, so that the world remains perfectly regular and yet is never self-running. Not all schools agreed, and the Maturidis and the philosophers argued the point hard. It is a live disagreement, and it is presented here as one.</p>",
    ref("debated","Scholars differ","Ash'ari occasionalism, contested by others") + ref("editorial","Editorial","summary of a classical debate"))
  + qv("إِنَّ اللَّهَ يُمْسِكُ السَّمَاوَاتِ وَالْأَرْضَ أَن تَزُولَا ۚ وَلَئِن زَالَتَا إِنْ أَمْسَكَهُمَا مِنْ أَحَدٍ مِّن بَعْدِهِ",
     "Indeed Allah holds the heavens and the earth, lest they cease. And if they were to cease, no one could hold them after Him.",
     "Fatir 35:41")
  + card("Say it plainly", "Held, not left running.",
    "<p>Read that verse next to the doctrine and the picture is unmistakable: the universe is not a machine that was wound up and released. It is held. The regularity you rely on every second, that the floor stays solid and the sun returns, is in this reading not the world&rsquo;s own habit but His, kept faithfully enough that science works and no one is fooled.</p>",
    ref("quran","Qur'an","35:41"))
  + FIG_REMADE))

# ---- 6 · sleep -------------------------------------------------------------
M.append(sec("sleep", "النَّوْم", "You already leave it every night",
  "Islam builds the rehearsal into the day. The exit is not exotic; you perform a small version of it before every morning.",
  qv("اللَّهُ يَتَوَفَّى الْأَنفُسَ حِينَ مَوْتِهَا وَالَّتِي لَمْ تَمُتْ فِي مَنَامِهَا",
     "Allah takes the souls at the time of their death, and those that did not die, during their sleep.",
     "Az-Zumar 39:42")
  + card("The same verb", "Sleep and death are named with one word.",
    "<p>The verb the verse uses for both is the same. Which is why the Prophet &#65018; taught a du&rsquo;a on waking that thanks Allah for giving life back after having caused death, and a du&rsquo;a at sleeping that hands the soul over on purpose. A Muslim practises the departure nightly and calls it going to bed.</p>",
    ref("quran","Qur'an","39:42") + ref("sunnah","Sunnah","Bukhari 6312"))
  + card("A famous line, honestly labelled", "&ldquo;People are asleep, and when they die they awaken.&rdquo;",
    "<p>You will meet this sentence everywhere, usually presented as a hadith. It is not established as a statement of the Prophet &#65018;. It is widely attributed to &lsquo;Ali ibn Abi Talib, and its chain is contested. It is quoted here because it is beautiful and because you deserve to know exactly what it is, which is a saying of the pious rather than revelation.</p>",
    ref("debated","Attributed","commonly to 'Ali; chain contested, not an established hadith"))
  + FIG_NIGHT))

# ---- 7 · four breaks -------------------------------------------------------
M.append(sec("breaks", "الفَرْق", "Four places the metaphor breaks",
  "A metaphor earns its keep by being pushed until it snaps. Here is where this one snaps, and each break is the point at which Islam says something the modern version cannot.",
  '<div class="brk">'
  '<div class="b"><p class="t">Break one</p><h4>A simulation implies a copy</h4><p>Simulations are copies of a base reality, which is why they feel cheap. Islam does not say this world is a copy of a truer one. It says it is genuinely created, in truth, and simply not final. Real, and temporary, are not opposites.</p></div>'
  '<div class="b"><p class="t">Break two</p><h4>Programmers are themselves simulated</h4><p>The modern argument leads to an endless stack: simulators inside simulators, with no floor. Tawhid closes it. He is al-Awwal, the First, with nothing before Him, and nothing is like Him. He is not the top programmer in a tower of programmers; He is not in the tower at all.</p></div>'
  '<div class="b"><p class="t">Break three</p><h4>&ldquo;Nothing matters&rdquo;</h4><p>The usual conclusion is a shrug. Here the conclusion is the reverse: because the Real Life follows, this is the most consequential thing that will ever happen to you. An atom&rsquo;s weight is on the record. The shortness raises the stakes rather than lowering them.</p></div>'
  '<div class="b"><p class="t">Break four</p><h4>There is no exit, there is a return</h4><p>Simulation stories end in escape: unplug, wake, get out. Islam has no exit. It has a return, a grave that is its own stage, a body raised, a record read, and a standing. You do not log off. You are met.</p></div>'
  '</div>'
  + '<p class="sub" style="margin-top:1rem">Each of those four is a room of its own in this Codex: '
    '<a href="/theology">the Branches</a> for the first two, <a href="/#mizan">the Weighing</a> for the third, '
    'and <a href="/soul">the Journey of the Soul</a> for the fourth.</p>'))

# ---- 8 · the honesty section ----------------------------------------------
M.append(sec("older", "الإِنْصَاف", "Did Islam invent this idea? No, and we will not say it did",
  "This room exists because the question is being asked seriously by a lot of people. It would be easy, and good for traffic, to claim that Islam originated simulation theory. The claim is false, so the Codex does not make it.",
  '<div class="hon"><b>What is actually true.</b>'
  '<p>The idea that the visible world is not the final one is older than Islam and appears in several places independently. Plato&rsquo;s allegory of the cave is roughly 380 years before the common era. The Sanskrit notion of maya, the world as appearance, is older still. Zhuangzi asked in the fourth century before the common era whether he was a man who had dreamt he was a butterfly, or a butterfly dreaming he was a man. Anyone who tells you a single tradition invented this is selling something.</p></div>'
  + card("The claim worth making", "Everyone else stops at the question.",
    "<p>What is distinctive is not the intuition, it is the answer. Every version of this idea, ancient or Californian, arrives at the same place and halts: <i>perhaps none of this is real</i>. None of them can tell you who is running it, why you were placed inside, what is being measured, or what happens when it stops.</p>"
    "<p>Islam answers all four, in detail, in a text whose wording has been preserved and continuously recited for more than fourteen centuries, and it answers them without ever calling the world unreal. That is a larger claim than being first, and unlike being first, it is true.</p>",
    ref("editorial","Editorial","our own counsel, never revelation"))))

# ---- 9 · so what --------------------------------------------------------
M.append(sec("monday", "العَمَل", "So what changes on Monday morning",
  "A picture of reality that changes nothing about your week is a hobby. This one has a practical shape, and it is the opposite of withdrawal.",
  card("The seed and the field", "You are not passing time. You are planting it.",
    "<p>The maxim runs that the world is the tillage of the Hereafter, that what grows there is sown here. It is quoted so often that many take it for a hadith; it is not established as one, and the Codex says so plainly. But the idea behind it is everywhere in the Book: an atom&rsquo;s weight seen, a life asked about, deeds sent ahead. Nothing here is spent. It is deposited.</p>",
    ref("debated","Maxim, not hadith","widely quoted, not established as a statement of the Prophet &#65018;") + ref("quran","Qur'an","99:7-8"))
  + card("Take your own account", "Before it is taken from you.",
    "<p>&ldquo;The wise one is he who takes account of himself and works for what comes after death.&rdquo; The narration is graded weak by a number of scholars, and is given here with that label attached. Weigh it as counsel that agrees with the Book, not as proof standing on its own.</p>",
    ref("debated","Weak narration","Tirmidhi 2459; graded weak by a number of scholars"))
  + card("Hold it loosely, use it fully", "Both hands, one grip.",
    "<p>The practical instruction that comes out of all of this is not to despise the world. It is to hold it the way a traveller holds what he is carrying: firmly enough to use it well, loosely enough to set it down when the road turns. Work, marry, build, treat people justly, and remember where you are standing while you do.</p>",
    ref("editorial","Editorial","our own counsel, never revelation"))))

# ---- where to go -----------------------------------------------------------
# Built by synergy.band() rather than by hand. The band ships its own small
# stylesheet with its markup, so writing the HTML by hand here produced the
# right elements with none of the skin: six links collapsed into one run-on
# paragraph at the foot of the page. Calling the helper means this section can
# never drift from the same band in every other room again.
from synergy import band

M.append(band(
  "Where to go from here",
  "This room is a doorway, not a destination. Each of these takes one part of it much further.",
  [
    ("/soul", "The Journey of the Soul",
     "What actually happens after the last breath, station by station, which is the half of the question no theory answers."),
    ("/#mizan", "The Weighing",
     "The two lives drawn to true scale, and what a deed is worth when it is measured rather than remembered."),
    ("/unseen", "The Unseen and the Mysteries",
     "Angels, jinn and the signs of the Hour, every claim badged for the strength of its evidence."),
    ("/theology", "Theology and the Branches",
     "Who He is and who He is not, including why He cannot be the programmer at the top of a tower."),
    ("/begin", "Begin here",
     "If the feeling in this room is what brought you, this is the door with nothing assumed and nothing asked."),
    ("/words", "The Words of the Path",
     "Dunya, akhirah, barzakh, batil: the vocabulary this page is built from, each one explained."),
  ]))

JSONLD = """<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article",
"headline":"Are we living in a simulation? What Islam says about this life and the real one",
"description":"The Qur'an calls the Hereafter al-hayawan, the real life, and calls this world diversion. But it also denies that creation is vain. A careful look at simulation theory beside Islamic teaching, including Ash'ari continuous creation, and four places the metaphor breaks.",
"inLanguage":"en","isPartOf":{"@type":"WebSite","name":"NOOR Codex of Light","url":"https://noorcodex.com"},
"about":[{"@type":"Thing","name":"Simulation hypothesis"},{"@type":"Thing","name":"Dunya and Akhirah"},{"@type":"Thing","name":"Occasionalism"}]}
</script>"""

html = shell(
    slug="simulation",
    title="Are we living in a simulation? What Islam says",
    desc="The Qur'an calls the next life al-hayawan, the real life, and this one diversion. It also denies that creation was made in vain. Simulation theory, answered from the Qur'an and Sunnah, with the four places the metaphor breaks.",
    ar="الحَيَوَان",
    kick="The question under the question",
    h1="Are we living in a simulation?",
    lead="Modern philosophy asks whether the world is rendered. The Qur&rsquo;an asked something older and harder: whether it is <i>final</i>. It answers no, then does the thing no simulation theory has ever done, and tells you who holds it, why you were placed inside, and what happens when it stops.",
    extra_head='<link rel="stylesheet" href="/assets/anim.css?v=93"/>',
    css=CSS, jsonld=JSONLD, main="\n".join(M) + FIG_JS)

open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "simulation.html"), "w", encoding="utf-8").write(html)
print("simulation.html written:", len(html), "bytes")
