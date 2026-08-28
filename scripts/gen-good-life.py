#!/usr/bin/env python3
"""NOOR · the good life.

A reader arrives tired. Not in crisis, usually: just worn down by a life that
never stops asking, and half-suspecting that Islam is one more thing on the
list of things they are failing at. This room says the opposite. There is a
pattern given for living, it is older than every productivity system, it was
lived by a man in a desert town, and almost all of it still fits a Tuesday in
a city with a phone in your pocket.

Three rules govern the writing here.

It does not promise a life without pain. The Qur'an promises hayat tayyiba, a
GOOD life, which is a different and much harder claim than a comfortable one.
The Prophet's own life had more grief in it than most readers will ever carry.
Any page that suggests faith removes suffering is lying, and a reader in real
pain will know it is lying and close the tab.

It never dresses advice as revelation. Where the sources give something plainly
it is badged and quoted. Where this is one sensible way to apply it, the badge
says editorial and the reader is told to weigh it.

And it does not play doctor. Sadness that will not lift is not a faith problem
to be prayed harder at, and this page says so out loud and points at help.
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
.care p.k{font-family:Inter,system-ui,sans-serif;font-size:.63rem;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#7B2D26;margin:0}
.care p{font-size:.85rem;line-height:1.85;color:rgba(44,36,22,.82);margin:.55rem 0 0}
.wk{display:grid;grid-template-columns:1fr;gap:.6rem;margin-top:1rem}
@media(min-width:44rem){.wk{grid-template-columns:1fr 1fr}}
.wk .d{background:#fff;border:1px solid rgba(44,36,22,.12);border-radius:14px;padding:.85rem .95rem}
.wk .d h4{margin:0 0 .35rem;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:#8a6d13;font-weight:800}
.wk .d p{margin:0;font-size:.82rem;line-height:1.8;color:rgba(44,36,22,.78)}
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
# Each one animates the single claim its paragraph is making, and each is
# authored so that the still frame is already true. A reader who has asked for
# no motion, or whose browser never runs the observer, loses the motion and
# nothing else.
# ---------------------------------------------------------------------------

# Five fixed points in a day that otherwise has none. The bars are the hours
# awake; the marks are the prayers landing in them.
FIG_DAY = (
  '<figure class="nfig">'
  '<p class="nlede">A day left to itself has no shape: it is one long slope from the alarm to '
  'the moment you give up. The prayer does something structural before it does anything spiritual. '
  'It cuts the slope into five, and no stretch is ever long enough to get lost in.</p>'
  '<div class="narc">'
  '<svg viewBox="0 0 300 108" role="img" aria-label="A waking day divided by five prayers">'
    '<defs><linearGradient id="ngday" x1="0" y1="0" x2="1" y2="0">'
      '<stop offset="0%" stop-color="#C9A227"/><stop offset="100%" stop-color="#F4D46A"/>'
    '</linearGradient></defs>'
    '<line x1="14" y1="62" x2="286" y2="62" stroke="rgba(255,254,247,.14)" stroke-width="2.5" stroke-linecap="round"/>'
    '<line class="nspan" x1="14" y1="62" x2="286" y2="62" stroke="url(#ngday)" stroke-width="2.5" stroke-linecap="round"/>'
    + "".join(
        '<g class="nmark" style="--i:%d">'
        '<line x1="%d" y1="48" x2="%d" y2="76" stroke="#F4D46A" stroke-width="2.4" stroke-linecap="round"/>'
        '<circle cx="%d" cy="62" r="4" fill="#F4D46A"/>'
        '<text x="%d" y="40" text-anchor="middle" class="nlbl on">%s</text>'
        '<text x="%d" y="92" text-anchor="middle" class="nsub">%s</text></g>'
        % (i, x, x, x, x, name, x, when)
        for i, (x, name, when) in enumerate([
            (30, "Fajr", "before light"), (94, "Dhuhr", "midday"), (152, "Asr", "afternoon"),
            (212, "Maghrib", "sunset"), (270, "Isha", "night")]))
  + '</svg></div>'
  '<figcaption class="ncap">&ldquo;Indeed, the prayer has been decreed upon the believers a decree of '
  'specified times.&rdquo; <b>Qur&rsquo;an 4:103</b></figcaption>'
  '</figure>')

# The comparison treadmill: the bar you measure yourself against moves as fast
# as you do, so the gap never closes. The still frame shows the gap.
FIG_ENOUGH = (
  '<figure class="nfig nscale">'
  '<p class="nlede">Comparison is not a character flaw, it is arithmetic that cannot resolve. Whatever '
  'you reach, the thing you are measuring against has already moved, because the feed is refreshed '
  'from an infinite supply of other people&rsquo;s best hours. The gap is a design feature.</p>'

  '<div class="nrow">'
    '<p class="nrl">What you have</p>'
    '<div class="ntrack"><span class="nbar" style="--w:46%"></span></div>'
    '<p class="nrv">enough, measured honestly</p>'
  '</div>'

  '<div class="nrow">'
    '<p class="nrl">What the feed shows you</p>'
    '<div class="ntrack nendless"><span class="nbar" style="--w:100%"></span></div>'
    '<p class="nmore"><span>always a little more</span><i aria-hidden="true">&rarr;</i></p>'
    '<p class="nrv" style="font-weight:400;color:rgba(255,254,247,.7);font-size:.72rem">and it moves again the moment you arrive</p>'
  '</div>'

  '<figcaption class="ncap">&ldquo;Do not extend your eyes toward that by which We have given enjoyment '
  'to some categories of them.&rdquo; <b>Qur&rsquo;an 20:131</b></figcaption>'
  '</figure>')

# Two accounts of the same hard week, side by side.
FIG_HARD = (
  '<figure class="nfig">'
  '<p class="nlede">Two people lose the same job in the same week. Nothing in their circumstances '
  'differs. What differs is what the loss is allowed to mean, and that changes what happens next '
  'in a way no amount of positive thinking does.</p>'
  '<div class="ntwo">'
    '<div class="ncol"><h4>If this is all there is</h4>'
    '<p>The loss is total, because the ledger it was written in is the only ledger. Patience is '
    'just delay with better manners. There is nothing to do with the pain except wait for it to '
    'stop hurting.</p></div>'
    '<div class="ncol nright"><h4>If it is being written down</h4>'
    '<p>The loss is real and still counts as loss. What changes is that the way it is carried is '
    'itself recorded, so the hardest week is not dead time. <b>The pain is not smaller. It is no '
    'longer wasted.</b></p></div>'
  '</div>'
  '<figcaption class="ncap">&ldquo;Indeed, the patient will be given their reward without account.&rdquo; '
  '<b>Qur&rsquo;an 39:10</b></figcaption>'
  '</figure>')

# What actually fills a week, drawn as a field: most of it is ordinary, and the
# ordinary is where nearly all of the weight sits.
FIG_SMALL = (
  '<figure class="nfig">'
  '<p class="nlede">People wait for the large act of worship that will change everything. Almost the '
  'whole weight of a life is in the small repeated one. Every point below is an ordinary act in an '
  'ordinary week; the lit ones are the moments most people think count.</p>'
  '<div class="ngrid" aria-hidden="true">' + "".join(
      '<i style="--d:%.2fs;--s:%.2fs"></i>' % (2.1 + (i % 5) * 0.31, (i * 0.113) % 3.1) for i in range(56)
  ) + '</div>'
  '<figcaption class="ncap">&ldquo;The most beloved of deeds to Allah are the most consistent, even if '
  'they are few.&rdquo; <b>Bukhari 6464</b></figcaption>'
  '</figure>')


M = []

# ---- 1 · the promise, stated exactly --------------------------------------
M.append(sec("promise", "طَيِّبَة", "There is a promise, and it is not the one you were sold",
  "Islam does make a claim about happiness in this life. It is worth reading the claim slowly, because it is both better and harder than the version people repeat.",
  qv("مَنْ عَمِلَ صَالِحًا مِّن ذَكَرٍ أَوْ أُنثَىٰ وَهُوَ مُؤْمِنٌ فَلَنُحْيِيَنَّهُ حَيَاةً طَيِّبَةً",
     "&ldquo;Whoever does righteousness, whether male or female, while being a believer, We will surely cause them to live a <b>good life</b>.&rdquo;",
     "Qur'an 16:97")
  + card("The word that was chosen", "A good life, not an easy one.",
    "<p><b>Tayyiba</b> is the word used of clean water, wholesome food, a sound heart. It is not the word for comfortable, wealthy, or untroubled. The verse promises a life with something <i>good in its substance</i>, and says nothing at all about a life without difficulty in it.</p>"
    "<p>This matters more than it looks. A reader who is told that faith will make life pleasant, and then meets an ordinary bad year, concludes that either the promise was false or they are personally defective. Neither is true. They were given the wrong sentence to begin with.</p>",
    ref("quran","Qur'an","16:97"))
  + card("The proof from the life itself", "The best of creation buried six of his seven children.",
    "<p>Whatever the promise means, it cannot mean freedom from grief, because the man it was revealed to lost his father before birth, his mother at six, his grandfather at eight, the wife of twenty-five years who believed him first, and every child but one. He was driven from his home city. He was mocked, boycotted and stoned at Ta'if.</p>"
    "<p>If a good life required an untroubled one, his was not a good life. Since his was the best, the definition must be something else.</p>",
    ref("sunnah","Sunnah","the sirah, on his losses; Bukhari 1303 on the death of Ibrahim"))
  + '<div class="hon"><b>What this room is.</b>'
    '<p>A practical pattern, taken from the Qur&rsquo;an and the Sunnah, arranged against the specific pressures of the present century. Where a thing is given plainly in the sources it is quoted and badged. Where this is one reasonable way of applying it, the badge says <b>editorial</b> and you should weigh it as counsel rather than take it as ruling.</p></div>'))

# ---- 2 · the foundation ---------------------------------------------------
M.append(sec("rest", "الطُّمَأْنِينَة", "The one thing named as the resting place of the heart",
  "Before any practice, the Qur'an names the mechanism. It is worth knowing what is claimed, and what is not.",
  qv("أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",
     "&ldquo;Unquestionably, by the remembrance of Allah hearts find <b>rest</b>.&rdquo;",
     "Qur'an 13:28")
  + card("What tuma'nina actually describes", "Not elation. Settling.",
    "<p>The word is used of a bird folding its wings, of ground that has stopped shifting, of a person who has stopped bracing. It describes the nervous system standing down, not a mood going up. That is a far more achievable thing to aim at than happiness, and it turns out to be the thing most people are actually missing.</p>"
    "<p>Note what the verse does not say: it does not say hearts find <i>entertainment</i>, or <i>excitement</i>. Almost everything sold to a restless person promises one of those two, and both leave the restlessness exactly where it was.</p>",
    ref("quran","Qur'an","13:28"))
  + card("Where the modern day quietly fails", "You have not been still since you woke up.",
    "<p>The phone is picked up before the eyes have properly opened, and from that moment the day is a queue of other people's urgencies. It is not that this is sinful. It is that a heart that never once stops moving has no moment in which to settle, and then wonders in the evening why it feels frayed.</p>"
    "<p>The five prayers were already the answer to that before anyone had a word for it.</p>",
    ref("editorial","Editorial","our own counsel, never revelation"))))

# ---- 3 · the daily frame --------------------------------------------------
M.append(sec("frame", "الصَّلَاة", "Five fixed points in a day that otherwise has none",
  "The most practical thing in the religion is also the most commonly reduced to a duty. Consider first what it does to the shape of a day.",
  FIG_DAY
  + card("Why the timings are inconvenient on purpose", "It interrupts. That is the function.",
    "<p>The prayer is not scheduled around your work; your work bends slightly around it. That small friction is doing something: it prevents any block of the day from becoming long enough to disappear into. Nobody drifts for nine hours when the longest unbroken stretch is three.</p>"
    "<p>It also means the day is punctuated by the only activity in it that asks for nothing, sells nothing, and cannot be optimised.</p>",
    ref("quran","Qur'an","4:103") + ref("editorial","Editorial","our own counsel, never revelation"))
  + card("If you are starting from nothing", "One prayer, kept, beats five intended.",
    "<p>The consistent small act is explicitly the one that is loved: <i>the most beloved of deeds to Allah are the most consistent, even if they are few</i>. If five is not yet real for you, make one real. Fajr is the hardest and the most transforming; Maghrib is the easiest to keep because it interrupts nothing.</p>"
    "<p>This is not permission to settle at one. It is the order of operations.</p>",
    ref("sunnah","Sunnah","Bukhari 6464") + ref("editorial","Editorial","the ordering is our counsel"))))

# ---- 4 · the body ---------------------------------------------------------
M.append(sec("body", "الجَسَد", "Your body has a claim on you, and it is enforceable",
  "Most modern exhaustion is not spiritual. It is sleep, food and movement, and the Sunnah is unusually specific about all three.",
  card("Stated as a right, not a suggestion", "&ldquo;Your body has a right over you.&rdquo;",
    "<p>Said to a companion who was fasting every day and praying every night. The correction was not <i>do more</i>. It was: your body has a right over you, your eye has a right over you, your family has a right over you, so give each its due. Burning yourself out in worship was named, at the source, as getting it wrong.</p>"
    "<p>The same instruction lands on a person running on four hours of sleep to finish a deck.</p>",
    ref("sunnah","Sunnah","Bukhari 1975"))
  + card("Sleep", "The night was made for stopping.",
    "<p><i>And We made your sleep for rest, and made the night as covering</i>. Sleeping early and rising early is the prophetic pattern; the hours after Isha were not for talking. The modern inversion, where the best hours of quiet are spent scrolling and the morning is met at a deficit, is a straight reversal of the pattern.</p>"
    "<p>The most valuable single change most readers could make is putting the phone outside the bedroom.</p>",
    ref("quran","Qur'an","78:9-10") + ref("sunnah","Sunnah","Bukhari 568, on disliking conversation after Isha") + ref("editorial","Editorial","the phone is our own application"))
  + card("Food", "A third, a third, a third.",
    "<p>&ldquo;No human fills a vessel worse than his stomach. Sufficient for a person are a few morsels to keep his back straight. If he must, then a third for food, a third for drink, and a third for breath.&rdquo; Graded well by scholars. It is, incidentally, the most durable piece of dietary advice anyone has written down.</p>",
    ref("sunnah","Sunnah","Tirmidhi 2380; graded hasan"))))

# ---- 5 · other people -----------------------------------------------------
M.append(sec("people", "الحُقُوق", "Almost all of it is owed to other people",
  "A striking share of the practice is not between you and God at all. It is between you and whoever is nearest.",
  card("The nearest first", "Parents, then spouse, then the ones under your roof.",
    "<p>The command to be good to parents sits directly beside the command to worship none but Him, in the same breath, more than once. Not near it. Beside it.</p>"
    "<p>And of the household: <i>the best of you is the best to his family</i>. A man admired outside his home and difficult inside it has the ranking exactly inverted.</p>",
    ref("quran","Qur'an","17:23") + ref("sunnah","Sunnah","Tirmidhi 3895"))
  + card("The neighbour, defined widely", "Jibril kept pressing until I thought he would inherit.",
    "<p>&ldquo;Jibril kept advising me about the neighbour until I thought he would make him an heir.&rdquo; In a century where people can live above someone for six years without learning their name, this is a live instruction rather than a historical one.</p>",
    ref("sunnah","Sunnah","Bukhari 6014"))
  + card("The tongue, which is where most of it is lost", "Say something good, or stay quiet.",
    "<p>&ldquo;Whoever believes in Allah and the Last Day, let him speak good or remain silent.&rdquo; The rule is not complicated and it is almost never kept. Backbiting is defined precisely, and the definition is uncomfortable: mentioning your brother in a way he would dislike, <i>even if it is true</i>. If it were false, that is a separate and worse thing.</p>"
    "<p>Applied honestly, this deletes most group chats.</p>",
    ref("sunnah","Sunnah","Bukhari 6018") + ref("sunnah","Sunnah","Muslim 2589, on the definition of ghiba"))
  + FIG_SMALL))

# ---- 6 · money and enough -------------------------------------------------
M.append(sec("enough", "القَنَاعَة", "Enough is a number, and you have probably passed it",
  "Wealth is not condemned anywhere in the sources. What is diagnosed, with unusual precision, is the appetite that no amount answers.",
  FIG_ENOUGH
  + card("The diagnosis", "&ldquo;If a son of Adam had a valley of gold, he would want two.&rdquo;",
    "<p>The saying continues: <i>nothing fills the belly of the son of Adam but dust</i>. This is not a complaint about greedy people. It is a statement about the mechanism itself: the appetite scales with the supply, so it is never answered by supply. Anyone who has hit an income they once dreamed of, and felt nothing change, has already run the experiment.</p>",
    ref("sunnah","Sunnah","Bukhari 6439"))
  + card("The definition offered instead", "Richness is a property of the self.",
    "<p>&ldquo;Richness is not having many possessions; richness is the richness of the soul.&rdquo; And, plainly: <i>whoever wakes secure in his household, healthy in body, with food for the day, it is as if he has been given the whole world</i>. Read that as a definition rather than as consolation. It names three things, and most readers of this page have all three.</p>",
    ref("sunnah","Sunnah","Bukhari 6446") + ref("sunnah","Sunnah","Tirmidhi 2346; graded hasan"))
  + card("The modern mechanism, named", "The feed is not neutral about your contentment.",
    "<p><i>Do not extend your eyes toward that by which We have given enjoyment to some categories of them.</i> The verse was addressed to a man who could see, at most, the caravans of his own town. The instruction has not changed; the volume has. You are shown a thousand people's best hours a day, and none of their ordinary ones.</p>"
    "<p>The practical application is not piety, it is arithmetic: reduce the input, and the appetite falls to meet the life.</p>",
    ref("quran","Qur'an","20:131") + ref("editorial","Editorial","the application is our own counsel"))))

# ---- 7 · when it hurts ----------------------------------------------------
M.append(sec("hard", "الصَّبْر", "What this offers when the year is genuinely bad",
  "Not a technique for feeling better. Something more limited and more useful: a place to put the weight.",
  FIG_HARD
  + card("Grief is permitted, and was practised", "&ldquo;The eye sheds tears and the heart grieves.&rdquo;",
    "<p>Holding his dying son, the Prophet &#65018; wept. Asked about it, he said: <i>the eye sheds tears and the heart grieves, and we say nothing except what pleases our Lord, and we are grieved by your parting, O Ibrahim.</i></p>"
    "<p>Sabr has been mistranslated into English as a stiff upper lip. It is not that. It is holding on without collapsing into despair of God. It has nothing against tears.</p>",
    ref("sunnah","Sunnah","Bukhari 1303"))
  + card("The thing that changes", "Not the weight. Where it is recorded.",
    "<p>&ldquo;No fatigue, illness, anxiety, sorrow, harm or distress befalls a Muslim, even a thorn that pricks him, but Allah expiates some of his sins by it.&rdquo; The hardship is not made smaller and nobody pretends it is good. What is claimed is narrower: <b>it is not wasted</b>. A year that produced nothing you can point at was not empty.</p>",
    ref("sunnah","Sunnah","Bukhari 5641"))
  + card("Du'a, including the part that is rarely quoted", "Asking is itself the point.",
    "<p>&ldquo;Your Lord said: call upon Me, I will respond to you.&rdquo; The relief is not guaranteed in the form requested, and the sources are honest about that. What is guaranteed is that the asking is heard, which is why du'a is described as worship in itself rather than as a mechanism for obtaining things.</p>",
    ref("quran","Qur'an","40:60") + ref("sunnah","Sunnah","Tirmidhi 3371, du'a is worship"))
  + '<div class="care"><p class="k">Read this part carefully</p>'
    '<p><b>Sadness that will not lift is not a failure of faith, and it is not treated by praying harder.</b> Depression, anxiety disorders and trauma are conditions of the body and mind, and the same religion that told you to seek treatment for a fever told you to seek treatment for these. &ldquo;Allah has not sent down a disease except that He has sent down its cure&rdquo; (<b>Bukhari 5678</b>) is about medicine, not about substituting for it.</p>'
    '<p>If you have felt flat or hopeless for weeks, if you are not sleeping or eating, or if you have had thoughts of harming yourself, please speak to a doctor or a qualified counsellor, and to someone you trust. That is the prophetic instruction, not a departure from it. If you would like help finding the right kind of support, <a href="/feedback" style="color:#7B2D26;font-weight:700">write to us</a> and we will help you look.</p></div>'))

# ---- 8 · the modern specifics ---------------------------------------------
M.append(sec("modern", "هَذَا الزَّمَان", "The pressures that did not exist, answered by principles that did",
  "Nothing below is in the sources by name. Each is one honest application of something that is, and is badged as our own counsel throughout.",
  card("The phone", "It is not the minutes. It is the fragmentation.",
    "<p>Four hours of scrolling costs four hours. Checking every six minutes costs the ability to be anywhere fully, which is a far larger bill. The remedy that actually works is structural rather than moral: put the device in another room during the three or four hours that matter most, and let the prayer times be the natural checkpoints.</p>",
    ref("editorial","Editorial","our own counsel, never revelation"))
  + card("Loneliness", "The congregation was a social technology before it was anything else.",
    "<p>Praying in congregation carries a stated multiplier, and it also happens to place you physically beside the same people several times a week with no agenda and nothing to buy. There is no modern replacement for this and most people who feel isolated are, in practice, missing exactly this and not something more complicated.</p>",
    ref("sunnah","Sunnah","Bukhari 645, on the reward of congregation") + ref("editorial","Editorial","the social reading is ours"))
  + card("Work that will not stop asking", "Rizq is apportioned. Effort is commanded. Both are true.",
    "<p>&ldquo;Tie your camel and trust in Allah.&rdquo; Not one or the other. The instruction is to do the work properly and then to stop carrying the outcome, which is the precise opposite of the modern arrangement, where people work anxiously and then lie awake owning results that were never theirs to own.</p>",
    ref("sunnah","Sunnah","Tirmidhi 2517; graded hasan"))
  + card("Comparison inside the religion itself", "Someone will always pray more than you.",
    "<p>A particular modern misery: measuring your worship against the most visible practice of the most visible people, and concluding you are nothing. The deeds are weighed by sincerity and consistency, not volume, and yours are not being compared to anyone's. <i>Take on what you can bear, for Allah does not tire until you tire.</i></p>",
    ref("sunnah","Sunnah","Bukhari 5861") + ref("editorial","Editorial","our own counsel"))))

# ---- 9 · a week you can actually run --------------------------------------
M.append(sec("week", "العَمَل", "A week that a real person could actually keep",
  "One arrangement, offered as a starting shape and nothing more. Take a third of it and you have done well.",
  '<div class="wk">'
  '<div class="d"><h4>Every day</h4><p>The five, on time as far as you can manage. Ten minutes of Qur&rsquo;an, reading rather than finishing. The morning and evening remembrances. One deliberate kindness that costs you something small.</p></div>'
  '<div class="d"><h4>Every night</h4><p>Phone out of the room. Sleep after Isha rather than after the algorithm. Two minutes reviewing the day honestly: one thing to be grateful for, one thing to fix tomorrow.</p></div>'
  '<div class="d"><h4>Every Friday</h4><p>Jumu&rsquo;ah, and the hour of it treated as an appointment rather than an interruption. Surah al-Kahf. Contact one relative you have not spoken to.</p></div>'
  '<div class="d"><h4>Every week</h4><p>One fast if you can, Monday or Thursday. One act of charity, however small, given quietly. One walk with no device on you at all.</p></div>'
  '<div class="d"><h4>Every month</h4><p>Look at what you owe and to whom. Read something that stretches you. Visit somebody who is ill or alone, which the sources treat as far weightier than it feels.</p></div>'
  '<div class="d"><h4>When it slips</h4><p>Resume without the ceremony of starting again. The consistent small return is the whole practice; the dramatic restart, repeated and abandoned, is the thing that actually defeats people.</p></div>'
  '</div>'
  + '<div class="hon"><b>How to read this table.</b>'
    '<p>The prayers, Jumu&rsquo;ah and the fasts are established in the sources. The arrangement, the pairing and the ordering are <b>our own counsel</b>, offered because a bare list of obligations helps nobody plan a Tuesday. Change any of it to fit your life. The one line worth keeping exactly as written is the last one.</p></div>'))

# ---- where to go from here ------------------------------------------------
M.append(band(
  "Where to go from here",
  "Each of these takes one part of this room considerably further.",
  [
    ("/pillars", "The Five Pillars",
     "The frame this whole page rests on, each pillar with its evidence and its practical shape."),
    ("/three-lives", "Three Lives",
     "The same question weighed three ways: a day with every box ticked, the worst life a human being can live, and the balanced one."),
    ("/health", "Prophetic Health",
     "Sleep, food, medicine and the body's claim on you, in far more detail than one section allows."),
    ("/family", "The Family Room",
     "The people nearest to you, who carry most of the weight of whether a life feels good."),
    ("/protection", "Protection and the Light",
     "The morning and evening remembrances, with what is authentic clearly separated from what is not."),
    ("/soul", "The Journey of the Soul",
     "Where all of this is going, station by station, which is the other half of the question."),
    ("/begin", "Begin here",
     "If little of the above is yet part of your life, this is the door with nothing assumed."),
  ]))

JSONLD = """<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article",
"headline":"How to live a good life: the pattern Islam gives, for the world you actually live in",
"description":"The Qur'an promises hayat tayyiba, a good life, not an easy one. A practical guide from the Qur'an and Sunnah to daily rhythm, sleep, food, people, money, hardship and the specific pressures of modern life.",
"inLanguage":"en","isPartOf":{"@type":"WebSite","name":"NOOR Codex of Light","url":"https://noorcodex.com"},
"about":[{"@type":"Thing","name":"Hayat tayyiba"},{"@type":"Thing","name":"Islamic daily practice"},{"@type":"Thing","name":"Contentment"}]}
</script>"""

html = shell(
    slug="good-life",
    title="How to live a good life · the pattern Islam gives",
    desc="The Qur'an promises a good life, not an easy one. A practical guide from the Qur'an and Sunnah: the daily frame, sleep and food, the people you owe, money and enough, what to do when the year is genuinely bad, and the modern pressures answered honestly.",
    ar="حَيَاةً طَيِّبَة",
    kick="The pattern for living",
    h1="How to live a good life",
    lead="There is a pattern given for this, older than every system sold to you, and almost all of it still fits a Tuesday in a city with a phone in your pocket. It does not promise an easy life. It promises a good one, which is harder and worth far more.",
    extra_head='<link rel="stylesheet" href="/assets/anim.css?v=97"/>',
    css=CSS, jsonld=JSONLD, main="\n".join(M) + FIG_JS,
    footline="Every claim badged. Where it says editorial, it is our counsel and not revelation.")

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
open(os.path.join(root, "good-life.html"), "w", encoding="utf-8").write(html)
print("good-life.html written:", len(html), "bytes")
