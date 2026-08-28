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

/* ===================== the room's own motion =========================
   The kit in assets/anim.css covers bars, fields, arcs and columns. These
   nine are particular to this room, and they obey the same two rules it
   does: the still frame is already the true picture, and nothing moves for
   a reader who has asked for stillness. */
.nthree{display:grid;grid-template-columns:1fr;gap:.5rem;margin:.3rem 0 0}
@media(min-width:36rem){.nthree{grid-template-columns:repeat(3,1fr);gap:.6rem}}
.pdraw{stroke-dasharray:var(--len,340);stroke-dashoffset:0}
.yr{display:grid;grid-template-columns:repeat(26,1fr);gap:2.5px;margin:.4rem 0 0}
.yr i{aspect-ratio:1;border-radius:50%;display:block;background:rgba(255,254,247,.09)}
.yr i.on{background:rgba(244,212,106,.85)}
.yrl{font-size:.6rem;letter-spacing:.15em;text-transform:uppercase;font-weight:700;color:rgba(255,254,247,.5);margin:1rem 0 .1rem}
.yrl:first-of-type{margin-top:.2rem}
.yrn{font-size:.72rem;font-weight:800;color:rgba(244,212,106,.9);margin:.5rem 0 0}
.polish{opacity:0;transform-box:fill-box;transform-origin:center}
.gbar{transform-box:fill-box;transform-origin:bottom}
.beam{transform-origin:150px 34px;transform:rotate(-9deg)}
.svgw svg{width:100%;height:auto;display:block;overflow:visible;margin:.3rem 0 0}
.slbl{font:800 7.2px Inter,system-ui,sans-serif;letter-spacing:.1em;fill:rgba(255,254,247,.62)}
.slbl.on{fill:rgba(244,212,106,.95)}
.slbl.bad{fill:rgba(214,120,100,.92)}
.ssub{font:700 6.2px Inter,system-ui,sans-serif;letter-spacing:.05em;fill:rgba(255,254,247,.42)}

@media (prefers-reduced-motion:no-preference){
  /* paths that draw themselves, one after the other */
  .nfig.ngo .pdraw{stroke-dashoffset:var(--len,340);
    animation:npdraw 1.5s ease-out both;animation-delay:calc(var(--i,0) * .34s)}
  @keyframes npdraw{ to{stroke-dashoffset:0} }

  /* three columns, in turn, never together */
  .nfig.ngo .nthree .ncol{animation-delay:calc(var(--i,0) * .22s)}

  /* the walls of a narrow life, arriving where they already are */
  .nfig.ngo .wl{animation:nwl 2.4s cubic-bezier(.4,0,.2,1) both}
  .nfig.ngo .wr{animation:nwr 2.4s cubic-bezier(.4,0,.2,1) both}
  @keyframes nwl{ from{transform:translateX(-52px)} to{transform:translateX(0)} }
  @keyframes nwr{ from{transform:translateX(52px)} to{transform:translateX(0)} }

  /* the screen that is never off */
  .nfig.ngo .glow{animation:nflick 3.6s ease-in-out infinite}
  @keyframes nflick{0%,100%{opacity:.45}28%{opacity:.9}46%{opacity:.3}64%{opacity:.75}}

  /* the counting that keeps climbing */
  .nfig.ngo .gbar{animation:ngup .5s cubic-bezier(.16,.84,.36,1) both;
    animation-delay:calc(var(--i,0) * .12s)}
  @keyframes ngup{ from{transform:scaleY(0)} to{transform:scaleY(1)} }

  /* the supplication going up through everything in the way */
  .nfig.ngo .rise{animation:nrise2 2.6s cubic-bezier(.3,.7,.3,1) .3s both}
  @keyframes nrise2{ from{transform:translateY(74px);opacity:0} to{transform:translateY(0);opacity:1} }

  /* the climb, one named step at a time */
  .nfig.ngo .climber{animation:nclimb 3.4s cubic-bezier(.55,0,.45,1) .6s both}
  @keyframes nclimb{
    0%{transform:translate(0,0)} 33%{transform:translate(56px,-19px)}
    66%{transform:translate(112px,-38px)} 100%{transform:translate(168px,-57px)} }

  /* a year, one week at a time */
  .nfig.ngo .yr i.on{animation:nylit .45s ease-out both;animation-delay:calc(var(--i,0) * .022s)}
  @keyframes nylit{ from{opacity:0;transform:scale(.25)} to{opacity:1;transform:none} }

  /* what repentance does. The still frame is the CLEAN heart, because that is
     the true end of this figure; the marks appear only to be taken away. */
  .nfig.ngo .polish{animation:npol 3s ease-in-out both;animation-delay:calc(var(--i,0) * .09s)}
  @keyframes npol{0%{opacity:0;transform:scale(1)}14%{opacity:1}52%{opacity:1}100%{opacity:0;transform:scale(.2)}}

  /* the beam, settling where it already rests */
  .nfig.ngo .beam{animation:ntip 2.8s cubic-bezier(.3,1.3,.4,1) both}
  @keyframes ntip{0%{transform:rotate(12deg)}42%{transform:rotate(-14deg)}70%{transform:rotate(-6deg)}100%{transform:rotate(-9deg)}}
}
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
  '<svg viewBox="0 0 120 132" role="img" aria-label="A heart covered point by point, with one part left uncovered">'
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
      '<text x="60" y="120" text-anchor="middle" '
      'style="font:800 7px Inter,system-ui,sans-serif;fill:rgba(244,212,106,.95);'
      'letter-spacing:.06em">NEVER COVERED</text>'
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


# ---------------------------------------------------------------------------
# the second wave of figures
# ---------------------------------------------------------------------------

# 7 · the three kinds, drawn as three roads out of one point. Every reader is
# standing at the left edge of this drawing.
FIG_THREE = (
  '<figure class="nfig svgw">'
  '<p class="nlede">Three roads out of one morning. Nobody is told which one he is on, and the '
  'surah does not describe them by how they look from outside. It describes where they arrive.</p>'
  '<svg viewBox="0 0 300 132" role="img" aria-label="Three roads leaving one point: the foremost, the right, the left">'
    '<defs>'
    '<linearGradient id="n3a" gradientUnits="userSpaceOnUse" x1="23" y1="0" x2="282" y2="0">'
    '<stop offset="0%" stop-color="rgba(201,162,39,.35)"/><stop offset="100%" stop-color="#F4D46A"/></linearGradient>'
    '<linearGradient id="n3b" gradientUnits="userSpaceOnUse" x1="23" y1="0" x2="282" y2="0">'
    '<stop offset="0%" stop-color="rgba(201,162,39,.3)"/><stop offset="100%" stop-color="rgba(233,200,106,.95)"/></linearGradient>'
    '<linearGradient id="n3c" gradientUnits="userSpaceOnUse" x1="23" y1="0" x2="282" y2="0">'
    '<stop offset="0%" stop-color="rgba(214,120,100,.25)"/><stop offset="100%" stop-color="rgba(190,80,64,.85)"/></linearGradient></defs>'
    '<circle cx="18" cy="66" r="5" fill="#FFFEF7"/>'
    '<text x="18" y="84" text-anchor="middle" class="ssub">TODAY</text>'
    '<path class="pdraw" style="--i:0;--len:300" d="M23 66 C110 66 150 30 282 20" fill="none" stroke="url(#n3a)" stroke-width="2.6" stroke-linecap="round"/>'
    '<path class="pdraw" style="--i:1;--len:270" d="M23 66 C120 66 170 66 282 66" fill="none" stroke="url(#n3b)" stroke-width="2.6" stroke-linecap="round"/>'
    '<path class="pdraw" style="--i:2;--len:300" d="M23 66 C110 66 150 102 282 114" fill="none" stroke="url(#n3c)" stroke-width="2.6" stroke-linecap="round"/>'
    '<text x="282" y="12" text-anchor="end" class="slbl on">THE FOREMOST</text>'
    '<text x="282" y="56" text-anchor="end" class="slbl on">THE RIGHT HAND</text>'
    '<text x="282" y="128" text-anchor="end" class="slbl bad">THE LEFT HAND</text>'
  '</svg>'
  '<figcaption class="ncap">Al-Waqi&rsquo;ah gives the three by name, and gives their sizes: the '
  'foremost thin to <b>a few</b> of the later peoples, the right hand stays <b>a multitude</b> of '
  'them. <b>Qur&rsquo;an 56:7-14 &middot; 56:39-40</b></figcaption>'
  '</figure>')

# 8 · one act, two intentions, two destinations.
FIG_INTENT = (
  '<figure class="nfig svgw">'
  '<p class="nlede">The first hadith in Bukhari&rsquo;s collection is not about prayer or fasting. '
  'It is the rule that decides what everything else is worth: actions are but by intentions, and '
  'every man has only what he intended.</p>'
  '<svg viewBox="0 0 300 128" role="img" aria-label="One act splitting into two destinations by intention">'
    '<rect x="8" y="52" width="62" height="26" rx="8" fill="rgba(244,212,106,.16)" stroke="rgba(244,212,106,.6)" stroke-width="1.6"/>'
    '<text x="39" y="69" text-anchor="middle" class="slbl on">ONE ACT</text>'
    '<path class="pdraw" style="--i:0;--len:220" d="M72 62 C140 62 160 30 214 28" fill="none" stroke="#F4D46A" stroke-width="2.4" stroke-linecap="round"/>'
    '<path class="pdraw" style="--i:1;--len:220" d="M72 68 C140 68 160 100 214 102" fill="none" stroke="rgba(190,80,64,.8)" stroke-width="2.4" stroke-linecap="round"/>'
    '<text x="150" y="34" text-anchor="middle" class="ssub">FOR HIM</text>'
    '<text x="150" y="116" text-anchor="middle" class="ssub">TO BE SEEN</text>'
    '<g class="nmark" style="--i:2">'
      '<rect x="218" y="14" width="74" height="28" rx="8" fill="rgba(244,212,106,.18)" stroke="rgba(244,212,106,.65)" stroke-width="1.6"/>'
      '<text x="255" y="32" text-anchor="middle" class="slbl on">IT WEIGHS</text></g>'
    '<g class="nmark" style="--i:4">'
      '<rect x="218" y="88" width="74" height="28" rx="8" fill="rgba(190,80,64,.14)" stroke="rgba(190,80,64,.55)" stroke-width="1.6"/>'
      '<text x="255" y="106" text-anchor="middle" class="slbl bad">NOTHING</text></g>'
  '</svg>'
  '<figcaption class="ncap">&ldquo;Actions are but by intentions, and every man shall have only '
  'what he intended.&rdquo; <b>Bukhari 1</b></figcaption>'
  '</figure>')

# 9 · the three of Muslim 1905, in the order the hadith gives them.
FIG_SEEN = (
  '<figure class="nfig">'
  '<p class="nlede">He &#65018; named the first three brought forward on that Day, and the world '
  'would have called all three of them exemplary. Read what each was told.</p>'
  '<div class="nthree">'
    '<div class="ncol nright" style="--i:0"><h4>The one killed in battle</h4>'
    '<p>He is asked what he did. He says: I fought for You until I was killed. He is told: '
    '<b>you lied. You fought so it would be said he is brave.</b> And it was said.</p></div>'
    '<div class="ncol nright" style="--i:1"><h4>The scholar and reciter</h4>'
    '<p>He says: I learned knowledge, I taught it, and I recited the Qur&rsquo;an for You. He is '
    'told: <b>you lied. You learned so it would be said he is learned</b>, and you recited so it '
    'would be said he is a reciter. And it was said.</p></div>'
    '<div class="ncol nright" style="--i:2"><h4>The one who gave everything</h4>'
    '<p>He says: I left no path You love to be spent in except that I spent in it. He is told: '
    '<b>you lied. You gave so it would be said he is generous.</b> And it was said.</p></div>'
  '</div>'
  '<figcaption class="ncap">Each is then dragged on his face into the Fire. Now look again at the '
  'twenty five entry ledger: the three deeds most likely to be seen by other people are these '
  'three. <b>Muslim 1905</b></figcaption>'
  '</figure>')

# 10 · the narrowing room. An illustration, not a chart: a man, a screen, and
# two walls already close.
FIG_NARROWING = (
  '<figure class="nfig svgw">'
  '<p class="nlede">The Qur&rsquo;an&rsquo;s word for this life is physical. <i>Danka</i> is what '
  'you say about a space too small to turn around in. Here it is drawn: the room does not start '
  'small, and nothing pushes the walls except the man in it.</p>'
  '<svg viewBox="0 0 300 150" role="img" aria-label="A man seated before a screen in a room whose walls have closed in">'
    '<rect x="0" y="0" width="300" height="150" fill="none"/>'
    '<line x1="20" y1="128" x2="280" y2="128" stroke="rgba(255,254,247,.16)" stroke-width="1.6"/>'
    '<g class="wl"><rect x="86" y="16" width="7" height="112" rx="3" fill="rgba(244,212,106,.42)"/></g>'
    '<g class="wr"><rect x="207" y="16" width="7" height="112" rx="3" fill="rgba(244,212,106,.42)"/></g>'
    '<ellipse class="glow" cx="150" cy="66" rx="46" ry="30" fill="rgba(120,170,220,.5)"/>'
    '<rect x="127" y="46" width="46" height="30" rx="3" fill="rgba(180,215,245,.85)"/>'
    '<circle cx="150" cy="98" r="10" fill="rgba(255,254,247,.82)"/>'
    '<path d="M136 128 C136 112 143 106 150 106 C157 106 164 112 164 128 Z" fill="rgba(255,254,247,.82)"/>'
    '<text x="150" y="144" text-anchor="middle" class="slbl bad">MA&rsquo;ISHATAN DANKA</text>'
    '<text x="44" y="70" text-anchor="middle" class="ssub">HE BUILT</text>'
    '<text x="44" y="80" text-anchor="middle" class="ssub">THESE</text>'
    '<text x="256" y="70" text-anchor="middle" class="ssub">NOBODY</text>'
    '<text x="256" y="80" text-anchor="middle" class="ssub">ELSE DID</text>'
  '</svg>'
  '<figcaption class="ncap">&ldquo;And whoever turns away from My remembrance, indeed he will have '
  'a constricted life, and We will raise him blind on the Day of Resurrection.&rdquo; '
  '<b>Qur&rsquo;an 20:124</b></figcaption>'
  '</figure>')

# 11 · the counting that only stops at the graves.
FIG_TAKATHUR = (
  '<figure class="nfig svgw">'
  '<p class="nlede">At-Takathur is eight verses long and its first two contain the entire biography '
  'of the man above. Rivalry in increase distracted you, <i>until you visited the graves</i>. Not '
  'until you were stopped. Until you simply arrived.</p>'
  '<svg viewBox="0 0 300 124" role="img" aria-label="A rising column of increase that stops at a grave">'
    '<line x1="10" y1="104" x2="290" y2="104" stroke="rgba(255,254,247,.16)" stroke-width="1.6"/>'
    + "".join(
        '<rect class="gbar" style="--i:%d" x="%d" y="%d" width="13" height="%d" rx="2.5" '
        'fill="rgba(244,212,106,%s)"/>' % (i, 16 + i * 18, 104 - h, h, op)
        for i, (h, op) in enumerate([(9,".30"),(14,".34"),(18,".38"),(24,".42"),(29,".46"),
                                     (35,".52"),(41,".58"),(48,".64"),(55,".70"),(63,".78"),
                                     (71,".86"),(80,".95")]))
    # A Muslim grave, drawn the way the sunnah leaves it: earth raised about a
    # hand span, one plain unmarked stone so the place can be found again, and
    # nothing else at all. The Prophet forbade that graves be plastered, that
    # structures be built over them, and that they be sat upon (Muslim 970).
    # The first version of this figure carried a cross, which is a Christian
    # marker and had no business anywhere on this site.
    + '<g class="nmark" style="--i:14">'
      '<path d="M224 104 H298" stroke="rgba(255,254,247,.3)" stroke-width="1.5" stroke-linecap="round"/>'
      '<path d="M242 104 Q266 70 290 104 Z" fill="rgba(255,254,247,.15)" '
      'stroke="rgba(255,254,247,.42)" stroke-width="1.7" stroke-linejoin="round"/>'
      '<path d="M229 104 V90 q0 -5 5.5 -5 q5.5 0 5.5 5 V104 Z" fill="rgba(255,254,247,.32)"/>'
      '<text x="264" y="118" text-anchor="middle" class="slbl">THE GRAVE</text></g>'
    + '<text x="120" y="120" text-anchor="middle" class="ssub">MORE. AND THEN MORE. AND THEN MORE.</text>'
  '</svg>'
  '<figcaption class="ncap">&ldquo;Competition in increase diverted you, until you visited the '
  'graveyards.&rdquo; <b>Qur&rsquo;an 102:1-2</b>. The column never falls. It is simply still '
  'rising on the day it stops.</figcaption>'
  '</figure>')

# 12 · the supplication with nothing in the way.
FIG_VEIL = (
  '<figure class="nfig svgw">'
  '<p class="nlede">Sending Mu&rsquo;adh to Yemen, he &#65018; gave him a warning about the people '
  'he would have authority over. Fear the supplication of the wronged, <b>for there is no veil '
  'between it and Allah.</b> That sentence describes a mechanism, and the mechanism has no delay '
  'built into it.</p>'
  '<svg viewBox="0 0 300 162" role="img" aria-label="A supplication rising through seven layers with nothing stopping it">'
    + "".join(
        '<line x1="34" y1="%d" x2="266" y2="%d" stroke="rgba(255,254,247,.13)" stroke-width="1.4" '
        'stroke-dasharray="5 6"/>' % (18 + i * 17, 18 + i * 17) for i in range(7))
    + '<g class="rise">'
      '<path d="M150 140 L150 14" stroke="url(#nvg)" stroke-width="2.6" stroke-linecap="round"/>'
      '<circle cx="150" cy="14" r="5.5" fill="#F4D46A"/>'
      '</g>'
      '<defs><linearGradient id="nvg" gradientUnits="userSpaceOnUse" x1="0" y1="140" x2="0" y2="14">'
      '<stop offset="0%" stop-color="rgba(244,212,106,.2)"/><stop offset="100%" stop-color="#F4D46A"/>'
      '</linearGradient></defs>'
      '<circle cx="150" cy="142" r="4" fill="rgba(255,254,247,.7)"/>'
      '<text x="150" y="152" text-anchor="middle" class="ssub">THE ONE YOU WRONGED</text>'
      '<text x="292" y="8" text-anchor="end" class="slbl on">NO VEIL</text>'
  '</svg>'
  '<figcaption class="ncap">He held a wage for six weeks because the man had no papers. There is a '
  'petition filed against him that no procedure delays. <b>Bukhari 1496</b></figcaption>'
  '</figure>')

# 13 · what repentance does. The still frame is the clean heart, because that
# is where this figure ends; the marks appear only in order to be removed.
FIG_RETURN = (
  '<figure class="nfig heart">'
  '<p class="nlede">The same hadith that describes the covering describes the undoing of it, in the '
  'same sentence, and the undoing comes first: <i>if he leaves it, seeks forgiveness and repents, '
  'his heart is polished.</i> The covering is only what happens when that step is skipped.</p>'
  '<svg viewBox="0 0 120 132" role="img" aria-label="A heart being polished clean, with the marks lifting away">'
    '<defs><linearGradient id="nhr2" x1="0" y1="0" x2="0" y2="1">'
      '<stop offset="0%" stop-color="rgba(244,212,106,.55)"/>'
      '<stop offset="100%" stop-color="rgba(201,162,39,.3)"/></linearGradient></defs>'
    '<path d="M60 100 C20 72 8 48 8 33 C8 17 20 8 32 8 C44 8 54 16 60 27 C66 16 76 8 88 8 '
    'C100 8 112 17 112 33 C112 48 100 72 60 100 Z" fill="url(#nhr2)" '
    'stroke="rgba(244,212,106,.8)" stroke-width="2"/>'
    + "".join('<circle class="polish" style="--i:%d" cx="%d" cy="%d" r="%d" fill="rgba(16,13,8,.9)"/>'
              % (i, x, y, r) for i, (x, y, r) in enumerate(SPOTS))
    + '<text x="60" y="120" text-anchor="middle" '
      'style="font:800 7px Inter,system-ui,sans-serif;fill:rgba(244,212,106,.95);'
      'letter-spacing:.06em">POLISHED</text>'
  '</svg>'
  '<figcaption class="ncap">This is the same heart as the figure above it, in the other direction. '
  'Nothing was needed to reverse it except naming the thing and turning from it. '
  '<b>Tirmidhi 3334</b>, graded <b>hasan sahih</b></figcaption>'
  '</figure>')

# 14 · the pass of Al-Balad, which the Qur'an defines and then costs.
FIG_PASS = (
  '<figure class="nfig svgw">'
  '<p class="nlede">Al-Balad asks what the steep pass is, and then, unusually, answers its own '
  'question. Four steps. Not one of them requires a scholar, a title or an unusual capacity, and '
  'three of the four are done to a human being who is worse off than you.</p>'
  '<svg viewBox="0 0 300 150" role="img" aria-label="Four steps up a steep pass, each one named">'
    + "".join(
        '<g class="nmark" style="--i:%d">'
        '<rect x="%d" y="%d" width="52" height="%d" rx="4" fill="rgba(244,212,106,%s)"/>'
        '<text x="%d" y="%d" text-anchor="middle" class="slbl on">%s</text>'
        '<text x="%d" y="%d" text-anchor="middle" class="ssub">%s</text></g>'
        % (i, 14 + i*56, 128 - (i+1)*19, (i+1)*19, op,
           40 + i*56, 113 - (i+1)*19, top,
           40 + i*56, 123 - (i+1)*19, bot)
        for i, (op, top, bot) in enumerate([
            (".30", "FREE", "A NECK"), (".45", "FEED", "THE ORPHAN"),
            (".62", "FEED", "THE POOR"), (".85", "BELIEVE", "AND COUNSEL")]))
    + '<circle class="climber" cx="40" cy="119" r="6" fill="#FFFEF7" '
      'transform="translate(168,-57)"/>'
      '<text x="292" y="10" text-anchor="end" class="slbl on">THE RIGHT HAND</text>'
      '<line x1="14" y1="140" x2="286" y2="140" stroke="rgba(255,254,247,.16)" stroke-width="1.6"/>'
  '</svg>'
  '<figcaption class="ncap">&ldquo;And what can make you know what the steep pass is? The freeing '
  'of a neck, or feeding on a day of severe hunger an orphan of near relationship, or a needy '
  'person in the dust. And then being of those who believed and advised one another to patience '
  'and advised one another to compassion. <b>Those are the companions of the right.</b>&rdquo; '
  '<b>Qur&rsquo;an 90:12-18</b></figcaption>'
  '</figure>')

# 15 · a year, two ways. Fifty two weeks in each row.
def weeks(lit):
    return "".join('<i class="%s" style="--i:%d"></i>' % ("on" if i in lit else "", i)
                   for i in range(52))

FIG_YEAR = (
  '<figure class="nfig">'
  '<p class="nlede">Two years of a life, drawn a week at a time. The first belongs to a man who '
  'gives everything he has for one month. The second belongs to a man who gives two rak&rsquo;ahs '
  'a day and does not stop. Both are real. Only one of them is the answer the sources gave.</p>'
  '<p class="yrl">A month of everything, then eleven of nothing</p>'
  '<div class="yr">' + weeks(set(range(28, 32))) + '</div>'
  '<p class="yrn">4 weeks lit &middot; 48 dark</p>'
  '<p class="yrl">The small thing, kept</p>'
  '<div class="yr">' + weeks(set(range(52))) + '</div>'
  '<p class="yrn">52 weeks lit, and it is still going next January</p>'
  '<figcaption class="ncap">This is not an argument against Ramadan. It is the reason he &#65018; '
  'ranked <b>consistency above quantity</b> when he was asked directly which deeds are most '
  'beloved. <b>Bukhari 6464 &middot; Muslim 783</b></figcaption>'
  '</figure>')

# 16 · the scale, and the mustard seed.
FIG_MIZAN = (
  '<figure class="nfig svgw">'
  '<p class="nlede">The scales are described as an instrument of exactness rather than of threat. '
  'Nothing is rounded. Nothing is lost in the noise. A thing the weight of a mustard seed is '
  'brought and put on the pan.</p>'
  '<svg viewBox="0 0 300 152" role="img" aria-label="A balance settling, weighed to the mustard seed">'
    '<line x1="150" y1="34" x2="150" y2="132" stroke="rgba(244,212,106,.6)" stroke-width="3" stroke-linecap="round"/>'
    '<path d="M118 138 L150 122 L182 138 Z" fill="rgba(244,212,106,.45)"/>'
    '<g class="beam">'
      '<line x1="48" y1="34" x2="252" y2="34" stroke="#F4D46A" stroke-width="3.4" stroke-linecap="round"/>'
      '<circle cx="150" cy="34" r="5.5" fill="#FFFEF7"/>'
      '<line x1="48" y1="34" x2="48" y2="66" stroke="rgba(244,212,106,.6)" stroke-width="1.6"/>'
      '<line x1="252" y1="34" x2="252" y2="66" stroke="rgba(244,212,106,.6)" stroke-width="1.6"/>'
      '<path d="M22 66 A26 26 0 0 0 74 66 Z" fill="rgba(244,212,106,.3)" stroke="rgba(244,212,106,.8)" stroke-width="1.6"/>'
      '<path d="M226 66 A26 26 0 0 0 278 66 Z" fill="rgba(190,80,64,.16)" stroke="rgba(190,80,64,.6)" stroke-width="1.6"/>'
      '<circle cx="40" cy="72" r="5" fill="#F4D46A"/><circle cx="54" cy="74" r="4" fill="#F4D46A"/>'
      '<circle cx="47" cy="62" r="3.4" fill="#F4D46A"/>'
      '<circle cx="250" cy="73" r="3" fill="rgba(190,80,64,.8)"/>'
    '</g>'
    '<text x="48" y="112" text-anchor="middle" class="slbl on">HEAVY</text>'
    '<text x="252" y="112" text-anchor="middle" class="slbl bad">LIGHT</text>'
    '<text x="150" y="150" text-anchor="middle" class="ssub">DOWN TO THE WEIGHT OF A MUSTARD SEED</text>'
  '</svg>'
  '<figcaption class="ncap">&ldquo;And We place the scales of justice for the Day of Resurrection, '
  'so no soul will be treated unjustly at all. And if there is the weight of a mustard seed, We '
  'will bring it forth.&rdquo; <b>Qur&rsquo;an 21:47</b></figcaption>'
  '</figure>')

# 17 · the two books, in the words each man says out loud.
FIG_HANDS = (
  '<figure class="nfig">'
  '<p class="nlede">Al-Haqqah does something almost cinematic here: it does not describe the two '
  'men, it lets each of them speak, and the first line out of each mouth tells you everything '
  'about the life behind it.</p>'
  '<div class="ntwo">'
    '<div class="ncol nright"><h4>The record in the right hand</h4>'
    '<p><b>&ldquo;Here, read my record!&rdquo;</b> He is not asked to hand it over. He offers it, '
    'unprompted, to anyone standing near. Whatever is in it, he wants it read aloud.</p></div>'
    '<div class="ncol"><h4>The record in the left hand</h4>'
    '<p><b>&ldquo;I wish I had not been given my record, and had not known what my account is. '
    'I wish it had been the decisive finish.&rdquo;</b> He does not argue with a single line of '
    'it. He argues with having been shown it.</p></div>'
  '</div>'
  '<figcaption class="ncap">The whole difference between the two lives on this page, said in two '
  'sentences by the men who lived them. <b>Qur&rsquo;an 69:19-27</b></figcaption>'
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
  + FIG_THREE
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
  + FIG_INTENT
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
  + FIG_SEEN
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
  + FIG_NARROWING
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
  + FIG_TAKATHUR
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
  + FIG_VEIL
  + FIG_RETURN
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
  + FIG_YEAR
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
  + FIG_PASS
  + '<div class="hon"><b>What none of this promises</b>'
    '<p>Not an easy life. Not a life without grief, illness, money trouble or the ordinary '
    'humiliations. The man who lived this pattern most completely buried six of his seven children. '
    'The promise attached to it is different and it is worth more: <i>whoever does righteousness, '
    'male or female, while a believer, We will surely cause him to live a good life.</i> '
    'A good one. Not a comfortable one.</p></div>'))

# ---------------------------------------------------------------------------
M.append(sec("scale", "الْمَوَازِين", "Where the three arrive",
  "Every road on this page ends at the same instrument, and the Qur'an describes it as a thing "
  "of exactness rather than a thing of threat.",
  FIG_MIZAN
  + card("Why the exactness is the mercy", "Nothing is rounded off, in either direction.",
    "<p>A scale accurate to the weight of a mustard seed is frightening if you are only thinking "
    "about your sins. Turn it over. It also means the two minutes you spent listening to someone "
    "who had nobody else to tell, on a Tuesday nobody remembers, was weighed. The glass of water. "
    "The debt you quietly forgave. The temper you swallowed in a car park.</p>"
    "<p>An imprecise scale would lose all of that in the noise. This one does not lose it. "
    "<i>Whoever does an atom's weight of good will see it, and whoever does an atom's weight of "
    "evil will see it.</i></p>",
    ref("quran", "Qur'an", "21:47") + ref("quran", "Qur'an", "99:7-8"))
  + FIG_HANDS
  + card("The one line that decides which sentence you say", "It is not a mystery, and it is not a lottery.",
    "<p>Al-Qari'ah puts it as plainly as it can be put: as for one whose scales are heavy, he is "
    "in a pleasant life; as for one whose scales are light, his refuge is an abyss. There is no "
    "third outcome offered and no appeal described.</p>"
    "<p>What there is, and the whole of this page has been pointing at it, is the entire span of "
    "your life before that morning, in which the pans are still being loaded, by you, in "
    "quantities as small as a seed.</p>",
    ref("quran", "Qur'an", "101:6-11"))
  + '<div class="hon"><b>And the thing nobody on this page can tell you</b>'
    '<p>Which pan your own life is currently loading. Not us, not a teacher, not a person who has '
    'watched you for thirty years. The sources are unanimous that a man can look like the first '
    'section and be the second, and look like the second and die as the first, and that certainty '
    'about your own standing is itself a warning sign rather than a good one. What is available to '
    'you is not the verdict. It is the next hour.</p></div>'))

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
