#!/usr/bin/env python3
# NOOR v49 . The Pilgrim's Planner
# Builds /hajj-plan.html from build/hajj-plan-content.json, through the canonical
# room shell, with every ruling, rank, school difference and reference resolved
# at build time out of build/hajj-content.json. The Golden Room and this planner
# read the same file, so the two pages cannot say different things about a rite.
#
# The plan itself is written in the browser. There is no account and no server:
# the answers encode into a base64url URL hash exactly as the masjid board does,
# and once the page has loaded nothing here needs a network. That is deliberate.
# The data in Makkah is unreliable and a pilgrim should not need it.
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from room import shell  # noqa: E402

SRC = os.path.join(ROOT, "build", "hajj-plan-content.json")
RITES = os.path.join(ROOT, "build", "hajj-content.json")
OUT = os.path.join(ROOT, "hajj-plan.html")

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

PROBLEMS = []


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "’"))


# --------------------------------------------------------------------------
# the same three renderers the Golden Room uses, so the markup is identical
# --------------------------------------------------------------------------

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
    return '<div class="schools"><p class="sk">Where the schools part</p>%s</div>' % items


def rank_chip(rank):
    if not rank:
        return ""
    label, cls, hint = RANKS.get(rank, (rank, "rk-s", ""))
    return '<span class="rk %s" title="%s">%s</span>' % (cls, esc(hint), esc(label))


def level_chip(level):
    label, hint = LEVELS.get(level or "editorial", LEVELS["editorial"])
    return ('<span class="evb %s mo-pop" title="%s">%s</span>'
            % (esc(level or "editorial"), esc(hint), esc(label)))


# --------------------------------------------------------------------------
# resolution: every rite takes its rank, badge, schools and refs from the room
# --------------------------------------------------------------------------

def index_room(room):
    """Every card of the Golden Room, keyed by section and by card title."""
    idx = {}
    for s in room["sections"]:
        for c in s.get("cards", []):
            idx[(s["id"], c["t"])] = c
        for d in s.get("days", []):
            key = "days:" + d["n"].split()[0]
            for c in d.get("cards", []):
                idx[(key, c["t"])] = c
    return idx


def resolve(plan, room):
    idx = index_room(room)
    out = []
    for r in plan["rites"]:
        sec, title = r["src"]
        card = idx.get((sec, title))
        if card is None:
            PROBLEMS.append("rite %s points at a card that is not in hajj-content.json: "
                            "%s / %s" % (r["id"], sec, title))
            card = {}
        rec = dict(r)
        rec["rank"] = card.get("rank") or ""
        rec["level"] = card.get("level") or "editorial"
        rec["chip"] = rank_chip(card.get("rank"))
        rec["badge"] = level_chip(card.get("level"))
        rec["schools"] = schools_html(card.get("schools"))
        rec["refs"] = refs_html(card.get("refs"))
        rec["from"] = card.get("t", "")
        rec.pop("src", None)
        out.append(rec)
    return out


def resolve_duas(plan, room):
    """The talbiyah and the dhikr of Arafah come from the room itself, word for
    word, rather than being typed a second time here."""
    duas = dict(plan["duas"])
    for s in room["sections"]:
        for c in s.get("cards", []):
            if c.get("talbiyah"):
                duas["talbiyah"] = dict(c["talbiyah"])
                duas["talbiyah"]["label"] = "The talbiyah, said from the miqat"
                duas["talbiyah"]["src"] = "Bukhari and Muslim 1184, the wording of Ibn Umar."
        for d in s.get("days", []):
            for c in d.get("cards", []):
                if c.get("dua") and d["n"].startswith("9"):
                    duas["arafah"] = dict(c["dua"])
                    duas["arafah"]["label"] = "The best of what was said on the day of Arafah"
                    duas["arafah"]["src"] = ("Tirmidhi, the report on the du’a of the day of "
                                             "Arafah, graded variously by the scholars.")
    if "talbiyah" not in duas:
        PROBLEMS.append("the talbiyah was not found in hajj-content.json")
    if "arafah" not in duas:
        PROBLEMS.append("the dhikr of Arafah was not found in hajj-content.json")
    return duas


# --------------------------------------------------------------------------
# the page the browser is handed. Everything below the wizard is written by
# the script from the reader's own answers.
# --------------------------------------------------------------------------

GIFTS = [
    ("Your days, in order", "An itinerary for your own journey. For Hajj, the real days from "
     "the eighth to the thirteenth of Dhul Hijjah with what happens, roughly when, where you "
     "will be and what to carry that day."),
    ("Every rite in steps", "Short imperative steps a nervous person can follow while standing "
     "in a crowd, each with its du’a where one is established, and each marked pillar, "
     "obligation or sunnah, taken from the Golden Room."),
    ("A packing list that is yours", "Built from your answers, grouped, and honest about the "
     "small things people always forget."),
    ("Before you go, with real timing", "Three months out, one month out, one week out, and the "
     "night before. Debts, forgiveness and your will are on it, because they are part of the "
     "preparation."),
    ("Money, said plainly", "What money is actually for, what to arrange before you leave, and "
     "the schemes that follow pilgrims. No invented prices."),
    ("What if it goes wrong", "Separated from your group, a rite you think you missed, illness, "
     "lost documents, and the plain instruction to ask a scholar on site rather than guess."),
    ("A pocket card to carry", "One page, designed to be printed, folded and kept in the pocket "
     "you never open: your miqat, the order of the rites, the talbiyah, four du’as, and the "
     "numbers you will want when you cannot think."),
]


def main_html(plan):
    f = plan["frame"]
    frame = ('<article class="card open mo"><p class="kk">%s</p><h3>%s</h3>%s</article>'
             % (esc(f["kk"]), esc(f["title"]),
                "".join("<p>%s</p>" % esc(p) for p in f["ps"])))

    gifts = "".join('<div class="gift mo"><h3>%s</h3><p>%s</p></div>' % (esc(t), esc(d))
                    for t, d in GIFTS)

    intro = ('<section class="rsec" id="what">'
             '<div class="sh"><span class="ar notranslate" translate="no" dir="rtl" lang="ar">'
             'زَاد الطَّرِيق</span><h2>What the plan gives you</h2></div>'
             '<p class="tr">zad at-tariq, the provision for the road</p>'
             '<p class="sub">Seven things, written for your own journey rather than for a '
             'stranger’s. Answer the questions once and it is yours, on this device and inside '
             'your own link, with nothing sent anywhere.</p>'
             '<div class="gifts">%s</div></section>' % gifts)

    offline = ('<p class="offnote mo">✦ Once this page has loaded it works with no connection '
               'at all. Open it before you fly, and print it. The network in Makkah is '
               'unreliable and you should not have to depend on it.</p>')

    wiz = ('<section class="rsec noprint" id="wiz" aria-label="The planner">'
           '<div id="wizmount"></div>'
           '<noscript><p class="sub">This planner is written in your own browser, which means '
           'it needs JavaScript to run. Everything it draws on, the rites, the ranks and the '
           'evidence, is written out in full in <a href="/hajj">the Golden Room</a>, which needs '
           'nothing at all.</p></noscript></section>')

    plan_mount = '<div id="plan" aria-live="polite"></div>'

    band = ('<section class="band mo noprint"><p>The planner is corrected as pilgrims and '
            'scholars read it and write back. If a ruling is stated too confidently, or a school '
            'is given words it does not hold, tell us and it will be fixed.</p>'
            '<div class="bl"><a class="ghost" href="/hajj">Read the Golden Room</a>'
            '<a class="ghost" href="/feedback">Send a correction</a>'
            '<a class="gpill" href="/donate">Keep the lamp lit ✦</a></div></section>')

    return ('<div class="wrap">' + frame + offline + intro + wiz + plan_mount + band + '</div>')


CSS = """
html{scroll-behavior:auto}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
.rsec{scroll-margin-top:5rem}
.rsec .sh{gap:.7rem}
.rsec .sh .ar{font-size:1.5rem;line-height:1.25}
.tr{font-size:.73rem;color:rgba(44,36,22,.48);margin:.3rem 0 0;letter-spacing:.02em}
.open{margin-top:1.7rem;border-color:rgba(201,162,39,.34);box-shadow:0 8px 30px rgba(44,36,22,.07)}
.open .kk{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .5rem}
.open h3{font-size:1.06rem;margin:0 0 .6rem}
.offnote{font-size:.75rem;line-height:1.8;color:#8a6d13;background:rgba(201,162,39,.09);border:1px solid rgba(201,162,39,.26);border-radius:14px;padding:.62rem .8rem;margin:.85rem 0 0}
.gifts{display:grid;grid-template-columns:1fr;gap:.7rem;margin-top:1rem}
@media(min-width:40rem){.gifts{grid-template-columns:1fr 1fr}}
.gift{background:#fff;border:1px solid rgba(44,36,22,.12);border-radius:16px;padding:.85rem .95rem}
.gift h3{font-size:.9rem;font-weight:800;margin:0 0 .3rem}
.gift p{font-size:.8rem;line-height:1.78;color:rgba(44,36,22,.7);margin:0}

/* ---------------- the wizard: one question on the screen at a time -------- */
.wizc{margin-top:1.4rem;background:#fff;border:1px solid rgba(201,162,39,.32);border-radius:22px;padding:1.2rem 1.15rem 1.3rem;box-shadow:0 10px 34px rgba(44,36,22,.07)}
.wizbar{height:3px;border-radius:999px;background:rgba(44,36,22,.09);overflow:hidden;margin:0 0 1rem}
.wizbar i{display:block;height:100%;background:linear-gradient(90deg,#C9A227,#F4D46A);transition:width .45s cubic-bezier(.22,1,.36,1)}
.wizk{display:flex;align-items:baseline;justify-content:space-between;gap:.7rem;margin:0 0 .35rem}
.wizk .kk{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0}
.wizk .of{font-size:.65rem;font-weight:700;color:rgba(44,36,22,.4);white-space:nowrap}
.wizq{font-size:1.18rem;font-weight:800;line-height:1.4;letter-spacing:-.01em;margin:0}
.wizh{font-size:.8rem;line-height:1.8;color:rgba(44,36,22,.62);margin:.5rem 0 0}
.wizn{font-size:.76rem;line-height:1.78;color:#8a6d13;background:rgba(201,162,39,.09);border:1px solid rgba(201,162,39,.24);border-radius:12px;padding:.55rem .7rem;margin:.85rem 0 0}
.opts{display:grid;gap:.5rem;margin-top:1rem}
.opt{display:flex;align-items:flex-start;gap:.7rem;width:100%;text-align:start;background:#FFFDF6;border:1px solid rgba(44,36,22,.14);border-radius:15px;padding:.7rem .8rem;font:inherit;color:inherit;cursor:pointer;transition:border-color .18s,background .18s,transform .18s,box-shadow .18s}
.opt:hover{border-color:rgba(201,162,39,.6);transform:translateY(-1px);box-shadow:0 5px 16px rgba(44,36,22,.06)}
.opt:focus-visible{outline:2px solid #8a6d13;outline-offset:2px}
.opt .mk{flex:0 0 auto;width:1.05rem;height:1.05rem;margin-top:.2rem;border-radius:999px;border:1.5px solid rgba(201,162,39,.6);background:#fff;position:relative}
.opt.sq .mk{border-radius:7px}
.opt .mk::after{content:"";position:absolute;inset:.2rem;border-radius:inherit;background:linear-gradient(135deg,#C9A227,#E9C86A);opacity:0;transform:scale(.4);transition:opacity .2s,transform .2s}
.opt.on{border-color:#C9A227;background:linear-gradient(168deg,#FFFCEF,#FFF6DB)}
.opt.on .mk::after{opacity:1;transform:scale(1)}
.opt .ob{min-width:0}
.opt .ot{font-size:.9rem;font-weight:800;line-height:1.45;display:flex;align-items:baseline;gap:.45rem;flex-wrap:wrap}
.opt .oar{font-family:Amiri,serif;font-size:1.05rem;color:#8a6d13;font-weight:400}
.opt .od{font-size:.78rem;line-height:1.72;color:rgba(44,36,22,.66);margin:.16rem 0 0}
.opt .obg{font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;font-weight:800;color:#1d6b3f;border:1px solid rgba(29,107,63,.42);background:rgba(29,107,63,.1);border-radius:999px;padding:.16rem .42rem}
.nums{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-top:1rem}
@media(max-width:34rem){.nums{grid-template-columns:1fr}}
.fld label{display:block;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .3rem}
.fld input{width:100%;font:inherit;font-size:.9rem;padding:.6rem .7rem;border:1px solid rgba(44,36,22,.16);border-radius:12px;background:#FFFDF6;color:inherit}
.fld input:focus{outline:2px solid rgba(201,162,39,.55);outline-offset:1px;border-color:rgba(201,162,39,.6)}
.fld .hint{font-size:.71rem;color:rgba(44,36,22,.48);margin:.3rem 0 0;line-height:1.6}
.wizacts{display:flex;gap:.55rem;flex-wrap:wrap;align-items:center;margin-top:1.15rem}
.wizacts .sp{flex:1}
.lnk{background:none;border:0;font:inherit;font-size:.75rem;font-weight:700;color:rgba(44,36,22,.45);cursor:pointer;text-decoration:underline;padding:.4rem .3rem}
.lnk:hover{color:rgba(44,36,22,.7)}
button.gpill,button.ghost{font:inherit;cursor:pointer}
button.gpill{border:0}
.saved{font-size:.7rem;color:rgba(44,36,22,.42);margin:.75rem 0 0;line-height:1.6}

/* ---------------- the plan ----------------------------------------------- */
.plansec{margin-top:2.6rem}
.plansec>.sh{display:flex;align-items:baseline;gap:.7rem;flex-wrap:wrap}
.plansec h2{font-size:1.28rem;font-weight:800;letter-spacing:-.01em;margin:0}
.plansec>.sh .ar{font-family:Amiri,serif;font-size:1.45rem;color:var(--gold);line-height:1.25}
.plansec .sub{font-size:.85rem;color:rgba(44,36,22,.62);line-height:1.78;margin:.5rem 0 0;max-width:38rem}
#planhead{margin-top:2.2rem;border-radius:22px;padding:1.3rem 1.2rem;background:linear-gradient(168deg,#14100A,#1b2440);color:#FFFEF7;border:1px solid rgba(244,212,106,.3)}
#planhead .pk{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:rgba(244,212,106,.8);margin:0}
#planhead h2{font-size:1.5rem;font-weight:800;line-height:1.28;margin:.35rem 0 0;letter-spacing:-.015em}
#planhead .pl{font-size:.83rem;line-height:1.8;color:rgba(255,254,247,.72);margin:.55rem 0 0;max-width:36rem}
.facts{display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem;margin-top:1rem}
@media(min-width:44rem){.facts{grid-template-columns:repeat(4,1fr)}}
.fact{background:rgba(255,254,247,.06);border:1px solid rgba(244,212,106,.22);border-radius:14px;padding:.6rem .7rem;min-width:0}
.fact .fl{font-size:.55rem;letter-spacing:.15em;text-transform:uppercase;font-weight:800;color:rgba(244,212,106,.75);margin:0}
.fact .fv{font-size:.88rem;font-weight:800;margin:.2rem 0 0;line-height:1.4;overflow-wrap:anywhere}
.fact .fs{font-size:.7rem;color:rgba(255,254,247,.6);margin:.12rem 0 0;line-height:1.5}
.pacts{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1.1rem}
#planhead .ghost{border-color:rgba(244,212,106,.45);color:rgba(255,254,247,.85)}
#planhead .ghost:hover{border-color:#F4D46A}

.warn{background:rgba(143,45,45,.07);border:1px solid rgba(143,45,45,.26);border-radius:14px;padding:.7rem .82rem;margin-top:.85rem}
.warn p{font-size:.79rem;line-height:1.75;color:#8f2d2d;margin:0;font-weight:600}
.warn p+p{margin-top:.4rem}

.day{margin-top:1.3rem;border-inline-start:2px solid rgba(201,162,39,.4);padding-inline-start:.95rem}
.day.core{border-inline-start-color:#C9A227}
.day.peak{border-inline-start-width:4px}
.dh{display:flex;align-items:flex-start;gap:.85rem}
.dn{flex:0 0 auto;font-size:1.35rem;font-weight:800;color:#8a6d13;line-height:1.05;letter-spacing:-.02em;min-width:2.7rem}
.dn small{display:block;font-size:.55rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(44,36,22,.4);font-weight:800;margin-top:.2rem}
.dar{font-family:Amiri,serif;font-size:1.1rem;color:var(--gold);margin:0;line-height:1.5}
.dt h3{font-size:1rem;font-weight:800;margin:.1rem 0 0}
.dg{font-size:.72rem;color:rgba(44,36,22,.5);margin:.15rem 0 0}
.dw{font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:.35rem 0 0}
.dl{font-size:.82rem;line-height:1.8;color:rgba(44,36,22,.66);margin:.55rem 0 0}
.blk{display:grid;grid-template-columns:8.2rem 1fr;gap:.25rem .85rem;padding:.42rem 0}
.blk+.blk{border-top:1px solid rgba(44,36,22,.07)}
.blk .bw{font-size:.66rem;letter-spacing:.09em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:.12rem 0 0;line-height:1.5}
.blk .bt{font-size:.83rem;line-height:1.8;color:rgba(44,36,22,.8);margin:0}
.blk.add .bt{color:#6b4f92}
.blk.add .bw{color:#6b4f92}
@media(max-width:38rem){.blk{grid-template-columns:1fr;gap:.05rem}}
.blks{margin-top:.75rem;background:#fff;border:1px solid rgba(44,36,22,.1);border-radius:16px;padding:.55rem .85rem}
.carry{margin-top:.7rem;background:linear-gradient(168deg,#FFFCEF,#FFF6DB);border:1px solid rgba(201,162,39,.28);border-radius:14px;padding:.6rem .8rem}
.carry .ck{font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .35rem}
.carry ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.3rem}
.carry li{font-size:.73rem;line-height:1.5;color:rgba(44,36,22,.75);background:#fff;border:1px solid rgba(201,162,39,.28);border-radius:999px;padding:.24rem .58rem}

.rite{margin-top:1rem}
.rite .ch{display:flex;align-items:flex-start;justify-content:space-between;gap:.7rem;margin-bottom:.45rem}
.rite .ch h3{margin:0;font-size:1rem;font-weight:800}
.rite .chb{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.32rem;flex:0 0 auto;margin-top:.1rem}
.rite .rar{font-family:Amiri,serif;font-size:1.15rem;color:var(--gold);margin:0;line-height:1.5}
.rite .rg{font-size:.71rem;color:rgba(44,36,22,.48);margin:.1rem 0 .1rem}
.rite .rw{font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:.35rem 0 .55rem}
.rk{display:inline-block;font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;font-weight:800;border-radius:999px;padding:.24rem .5rem;border:1px solid;white-space:nowrap}
.rk-p{color:#8f2d2d;border-color:rgba(143,45,45,.42);background:rgba(143,45,45,.09)}
.rk-o{color:#8a6d13;border-color:rgba(201,162,39,.5);background:rgba(201,162,39,.13)}
.rk-s{color:rgba(44,36,22,.55);border-color:rgba(44,36,22,.22);background:rgba(44,36,22,.04)}
.rk-c{color:#1d6b3f;border-color:rgba(29,107,63,.42);background:rgba(29,107,63,.1)}
.pillarcard{border-color:rgba(143,45,45,.34);box-shadow:0 6px 24px rgba(143,45,45,.08)}
.pflag{font-size:.75rem;font-weight:700;line-height:1.65;color:#8f2d2d;background:rgba(143,45,45,.07);border:1px solid rgba(143,45,45,.22);border-radius:12px;padding:.55rem .7rem;margin:0 0 .7rem}
.stp{list-style:none;counter-reset:s;margin:.2rem 0 0;padding:0}
.stp li{counter-increment:s;position:relative;padding-block:.35rem .35rem;padding-inline:2rem 0;font-size:.85rem;line-height:1.8;color:rgba(44,36,22,.82)}
.stp li+li{border-top:1px solid rgba(44,36,22,.06)}
.stp li::before{content:counter(s);position:absolute;inset-inline-start:0;top:.5rem;width:1.35rem;height:1.35rem;border-radius:999px;background:rgba(201,162,39,.14);border:1px solid rgba(201,162,39,.35);color:#8a6d13;font-size:.66rem;font-weight:800;display:flex;align-items:center;justify-content:center}
.waynote{font-size:.79rem;line-height:1.75;color:#6b4f92;background:rgba(107,79,146,.07);border:1px solid rgba(107,79,146,.24);border-radius:12px;padding:.55rem .7rem;margin:.7rem 0 0}
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
.tal{margin:.75rem 0 0;background:linear-gradient(168deg,#FFFCEF,#FFF6DB);border:1px solid rgba(201,162,39,.32);border-radius:16px;padding:.9rem 1rem}
.tal .tl{font-size:.58rem;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .45rem;text-align:center}
.tal .ar{font-family:Amiri,serif;font-size:1.3rem;line-height:2.1;color:#2C2416;margin:0;text-align:center}
.tal .trl{font-size:.77rem;font-style:italic;color:rgba(44,36,22,.6);margin:.5rem 0 0;line-height:1.7;text-align:center}
.tal .mean{font-size:.82rem;color:rgba(44,36,22,.82);margin:.42rem 0 0;line-height:1.75;text-align:center}
.tal .src{font-size:.68rem;color:rgba(44,36,22,.45);margin:.45rem 0 0;line-height:1.6;text-align:center}
.grp{margin-top:1rem}
.grp h3{font-size:.94rem;font-weight:800;margin:0}
.grp .gs{font-size:.77rem;line-height:1.72;color:rgba(44,36,22,.55);margin:.2rem 0 .1rem}
.tick{list-style:none;margin:.45rem 0 0;padding:0}
.tick li{position:relative;padding-block:.34rem .34rem;padding-inline:1.4rem 0;font-size:.83rem;line-height:1.78;color:rgba(44,36,22,.8)}
.tick li+li{border-top:1px solid rgba(44,36,22,.06)}
.tick li::before{content:"";position:absolute;inset-inline-start:.15rem;top:.86rem;width:.42rem;height:.42rem;border-radius:999px;background:#C9A227}
.tick li.you::before{background:#6b4f92;box-shadow:0 0 0 3px rgba(107,79,146,.16)}
.tick li.you{color:#4a3f6b}
.idea{display:flex;gap:.6rem;align-items:flex-start;padding:.45rem 0}
.idea+.idea{border-top:1px solid rgba(44,36,22,.06)}
.idea .it{font-size:.85rem;font-weight:800;line-height:1.5;margin:0}
.idea .id{font-size:.79rem;line-height:1.76;color:rgba(44,36,22,.68);margin:.15rem 0 0}
.phase{margin-top:1rem;background:#fff;border:1px solid rgba(44,36,22,.12);border-radius:18px;padding:.9rem 1rem}
.phase .pk{font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0}
.phase h3{font-size:1rem;font-weight:800;margin:.22rem 0 0}
.emg{margin-top:1rem;background:linear-gradient(168deg,#FFFCEF,#FFF6DB);border:1px solid rgba(201,162,39,.34);border-radius:18px;padding:1rem 1.05rem}
.emg .ek{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .55rem}
.emgrid{display:grid;grid-template-columns:1fr;gap:.55rem}
@media(min-width:36rem){.emgrid{grid-template-columns:1fr 1fr}}
.emf{min-width:0}
.emf .el{font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:#8a6d13;margin:0 0 .2rem}
.emf .ev{font-size:.86rem;font-weight:700;color:#2C2416;line-height:1.6;border-bottom:1px solid rgba(44,36,22,.28);padding-bottom:.2rem;min-height:1.3rem;overflow-wrap:anywhere}
.emf .ev.blank{color:rgba(44,36,22,.3);font-weight:500;font-style:italic}
"""

CSS += """
/* ---------------- the figures, in the language of the Golden Room --------- */
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
.hdim{fill-opacity:.32}
.hs1{fill:none;stroke:#E9C86A;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.hs2{fill:none;stroke:#FFFEF7;stroke-opacity:.6;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.hs3{fill:none;stroke:#F4D46A;stroke-opacity:.32;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.hs4{fill:none;stroke:#FFFEF7;stroke-opacity:.22;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
.hf1{fill:rgba(244,212,106,.16)}
.hf2{fill:#F4D46A;stroke:none}
.hf3{fill:rgba(255,254,247,.14);stroke:none}
.hring{stroke:#E9C86A;stroke-width:2;fill:rgba(244,212,106,.14)}
.hgold{stroke-width:3.6}
.hopen{fill:rgba(20,16,10,.6)}
.hband{stroke-width:9;stroke-linecap:round}
.hband1{fill:rgba(143,45,45,.24);stroke:rgba(226,138,128,.7);stroke-width:2}
.hband2{fill:rgba(244,212,106,.18);stroke:rgba(233,200,106,.7);stroke-width:2}
.hband3{fill:rgba(255,254,247,.07);stroke:rgba(255,254,247,.3);stroke-width:2}
.hband0{fill:rgba(255,254,247,.03);stroke:rgba(255,254,247,.16);stroke-width:1.6}
.leg{list-style:none;margin:1rem 0 0;padding:0;display:grid;gap:.45rem}
.leg li{position:relative;padding-inline-start:1rem;font-size:.75rem;line-height:1.72;color:rgba(255,254,247,.68)}
.leg li::before{content:"";position:absolute;inset-inline-start:0;top:.62rem;width:.36rem;height:.36rem;border-radius:50%;background:#E9C86A}
.leg li b{color:rgba(244,212,106,.9);font-weight:800}
.fig .cap b{color:rgba(244,212,106,.85);font-weight:700}

/* ---------------- the pocket card ---------------------------------------
   The card is laid out in millimetres at exactly the size it prints, so what
   the browser measures on screen is what the printer puts on the page. It is
   one sheet, on A4 and on Letter alike: 186 by 242 millimetres fits inside
   both with room to spare, and the type is fitted to the card before it is
   shown. ---------------------------------------------------------------- */
#pcwrap{overflow:hidden;max-width:100%;margin-top:1rem;text-align:center}
#pcscale{display:inline-block;transform-origin:top left}
#pc{--pcf:1;width:186mm;height:242mm;margin:0 auto;padding:7mm 7mm 5mm;background:#fff;color:#1b1408;
  display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(44,36,22,.18);border-radius:2px;
  box-shadow:0 10px 34px rgba(44,36,22,.15);font-family:Inter,system-ui,-apple-system,sans-serif;
  text-align:start;-webkit-print-color-adjust:exact;print-color-adjust:exact}
#pc .pchead{flex:none;display:flex;align-items:flex-end;justify-content:space-between;gap:4mm;
  border-bottom:.7mm solid #14100A;padding-bottom:2mm}
#pc .pchead h3{font-size:calc(var(--pcf)*17pt);font-weight:900;line-height:1.08;margin:0;letter-spacing:-.01em;color:#14100A}
#pc .pchead .pcs{font-size:calc(var(--pcf)*8.4pt);color:#6b5510;font-weight:700;margin:.8mm 0 0;line-height:1.35}
#pc .pchead .pcr{text-align:end;flex:none}
#pc .pchead .pcar{font-family:Amiri,serif;font-size:calc(var(--pcf)*13pt);color:#9a7a14;line-height:1.3}
#pc .pchead .pcn{font-size:calc(var(--pcf)*7pt);letter-spacing:.16em;text-transform:uppercase;color:#7d735f;font-weight:800;margin:.6mm 0 0}
#pc .pcbody{flex:1 1 auto;min-height:0;display:flex;gap:5mm;padding-top:2.6mm}
#pc .pccol{min-width:0}
#pc .pccol.l{flex:1.32}
#pc .pccol.r{flex:1}
#pc .pcb{border:.25mm solid rgba(201,162,39,.55);border-radius:1.8mm;padding:2mm 2.4mm;margin-bottom:2.4mm;background:#FFFDF4}
#pc .pcb.plain{background:#fff;border-color:rgba(44,36,22,.3)}
#pc .pck{font-size:calc(var(--pcf)*6.6pt);letter-spacing:.17em;text-transform:uppercase;font-weight:900;color:#8a6d13;margin:0 0 1.2mm}
#pc ol.pcord{list-style:none;counter-reset:o;margin:0;padding:0}
#pc ol.pcord li{counter-increment:o;position:relative;padding-block:.7mm .7mm;padding-inline:6.2mm 0;font-size:calc(var(--pcf)*8.2pt);line-height:1.34;color:#241d10}
#pc ol.pcord li+li{border-top:.15mm solid rgba(44,36,22,.16)}
#pc ol.pcord li::before{content:counter(o);position:absolute;inset-inline-start:0;top:.75mm;width:4.4mm;height:4.4mm;border-radius:50%;
  background:#F1E3B4;color:#6b5510;font-size:calc(var(--pcf)*6.2pt);font-weight:900;display:flex;align-items:center;justify-content:center}
#pc ol.pcord li b{font-weight:800}
#pc ol.pcord li .pcw{color:#6b5510;font-weight:600}
#pc ol.pcord li .pcrk{font-size:calc(var(--pcf)*5.8pt);letter-spacing:.1em;text-transform:uppercase;font-weight:900;
  border-radius:1mm;padding:.2mm .9mm;margin-inline-start:1mm;white-space:nowrap}
#pc .rp{background:#F3DCDA;color:#8f2d2d}
#pc .ro{background:#F1E3B4;color:#6b5510}
#pc .rs{background:#E9E5DA;color:#5c5344}
#pc .pcline{font-size:calc(var(--pcf)*8.2pt);line-height:1.5;color:#241d10;margin:0}
#pc .pcline+.pcline{margin-top:.9mm}
#pc .pcline b{color:#14100A}
#pc .pcline .k{color:#6b5510;font-weight:800}
#pc .pcfld{display:flex;gap:1.6mm;align-items:baseline;font-size:calc(var(--pcf)*8pt);line-height:1.45;padding:.55mm 0}
#pc .pcfld+.pcfld{border-top:.15mm solid rgba(44,36,22,.16)}
#pc .pcfld .fk{flex:none;width:21mm;font-size:calc(var(--pcf)*6.4pt);letter-spacing:.09em;text-transform:uppercase;font-weight:900;color:#6b5510}
#pc .pcfld .fv{flex:1;min-width:0;font-weight:700;color:#14100A;overflow-wrap:anywhere}
#pc .pcfld .fv.blank{border-bottom:.2mm dotted rgba(44,36,22,.5);min-height:3.4mm}
#pc .pcmid{flex:none;display:grid;grid-template-columns:1.5fr 1fr;gap:0 4mm;align-items:start}
#pc .pcmid .pcb{margin-bottom:1.6mm}
#pc .pcduas{flex:none;border-top:.5mm solid #14100A;padding-top:2.2mm;display:grid;grid-template-columns:1fr 1fr;gap:1.6mm 4mm}
#pc .pcd{min-width:0}
#pc .pcd .dl{font-size:calc(var(--pcf)*6.4pt);letter-spacing:.13em;text-transform:uppercase;font-weight:900;color:#8a6d13;margin:0 0 .5mm}
#pc .pcd .dar{font-family:Amiri,serif;font-size:calc(var(--pcf)*11.6pt);line-height:1.5;color:#14100A;margin:0;text-align:end;direction:rtl}
#pc .pcd .dtr{font-size:calc(var(--pcf)*6.8pt);line-height:1.32;color:#5c5344;font-style:italic;margin:.4mm 0 0}
#pc .pcd .dmn{font-size:calc(var(--pcf)*6.8pt);line-height:1.32;color:#241d10;margin:.3mm 0 0}
#pc .pcfoot{flex:none;display:flex;justify-content:space-between;gap:3mm;border-top:.2mm solid rgba(44,36,22,.25);
  margin-top:2mm;padding-top:1.4mm;font-size:calc(var(--pcf)*6.4pt);color:#7d735f;line-height:1.4}
#pc .pcfoot b{color:#6b5510;font-weight:800}
#pc{position:relative}
#pc .pcfold{position:absolute;left:0;right:0;top:50%;border-top:.2mm dashed rgba(44,36,22,.32);pointer-events:none}
#pc .pcfold span{position:absolute;right:1.5mm;top:-2.4mm;background:#fff;padding:0 1.2mm;
  font-size:calc(var(--pcf)*5.8pt);letter-spacing:.2em;text-transform:uppercase;color:#a09580;font-weight:800}
#pc .pckey{margin:1.4mm 0 0;font-size:calc(var(--pcf)*6.6pt);line-height:1.6;color:#5c5344}
#pc .pckey .pcrk{margin-inline-start:0;margin-inline-end:.5mm}
#pc .pckey b{color:#c0b49a}
#pc ul.pcdont{list-style:none;margin:0;padding:0}
#pc ul.pcdont li{position:relative;padding-block:.45mm .45mm;padding-inline:3.2mm 0;font-size:calc(var(--pcf)*7.4pt);line-height:1.34;color:#241d10}
#pc ul.pcdont li::before{content:"";position:absolute;inset-inline-start:.5mm;top:2.1mm;width:1.3mm;height:1.3mm;border-radius:50%;background:#C9A227}
.pcnote{font-size:.72rem;color:rgba(44,36,22,.5);margin:.6rem 0 0;line-height:1.7}

/* ---------------- paper ------------------------------------------------- */
@media print{
  @page{margin:8mm}
  html,body{margin:0;padding:0;background:#fff}
  #site-header,#nav-sheet,#search-bar,.rhero,.rfoot,.noprint,#wiz,.band,.offnote{display:none!important}
  .wrap{max-width:none;padding:0}
  .card,.blks,.phase,.gift,.emg,.carry{box-shadow:none}
  .fig{background:#14100A!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;
    page-break-inside:avoid;break-inside:avoid}
  .day,.rite,.phase,.grp,.emg{page-break-inside:avoid;break-inside:avoid}
  .plansec{page-break-before:auto}
  #pcwrap{overflow:visible;margin:0}
  #pcscale{transform:none!important;height:auto!important;width:auto!important;display:block}
  #pc{border:.4mm solid rgba(20,16,10,.75);border-radius:0;box-shadow:none;margin:0 auto;
    page-break-inside:avoid;break-inside:avoid;page-break-after:avoid}
  body:not(.pc-only) #pocket{page-break-before:always}
  body.pc-only #planhead,body.pc-only #planwhat,body.pc-only .plansec:not(#pocket){display:none!important}
  body.pc-only #pocket{margin:0}
  body.pc-only #pocket>.sh,body.pc-only #pocket>.sub,body.pc-only #pocket .pcnote{display:none!important}
  body.pc-only #what,body.pc-only .card.open{display:none!important}
}
"""

JS_HEAD = """
var D=window.NOOR_PLAN_DATA||{};
var KEY="noor_plan_v1";
function $(i){return document.getElementById(i)}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function has(a,v){return !!a&&a.indexOf(v)>=0}
function clampInt(v,lo,hi){v=parseInt(v,10);if(isNaN(v))v=lo;return Math.max(lo,Math.min(hi,v))}
/* every drawer on this device is optional. A browser with storage switched off,
   a private window, a quota that is full: none of it may throw. */
function lsGet(k){try{return window.localStorage?localStorage.getItem(k):null}catch(e){return null}}
function lsSet(k,v){try{if(window.localStorage)localStorage.setItem(k,v)}catch(e){}}
function lsDel(k){try{if(window.localStorage)localStorage.removeItem(k)}catch(e){}}
function b64u(s){try{return btoa(unescape(encodeURIComponent(s))).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"")}catch(e){return ""}}
function unb64u(s){try{return decodeURIComponent(escape(atob(String(s).replace(/-/g,"+").replace(/_/g,"/"))))}catch(e){return ""}}
function H(){return window.NOOR_HIJRI||null}

/* ------------------------------------------------------------------ state */
function blank(){return {j:"",w:"tamattu",y:0,m:0,f:"",a:0,b:0,o:[],n:[],c:{}}}
var A=blank(), si=0, built=false;

function clean(x){
  var o=blank();
  if(!x||typeof x!=="object")return o;
  o.j=(x.j==="umrah"||x.j==="hajj")?x.j:"";
  o.w=(x.w==="tamattu"||x.w==="qiran"||x.w==="ifrad")?x.w:"tamattu";
  o.y=clampInt(x.y,0,2000); o.m=clampInt(x.m,0,12);
  o.f=""; for(var i=0;i<(D.regions||[]).length;i++){if(D.regions[i].v===x.f)o.f=x.f}
  o.a=clampInt(x.a,0,90); o.b=clampInt(x.b,0,90);
  var ok=function(list,vals){var out=[];(vals||[]).forEach(function(v){if(has(list,v)&&!has(out,v))out.push(v)});return out};
  var whoV=(stepById("who").opts||[]).map(function(z){return z.v});
  var needV=(stepById("needs").opts||[]).map(function(z){return z.v});
  o.o=ok(whoV,x.o); o.n=ok(needV,x.n);
  o.c={}; (D.pocket.fields||[]).forEach(function(fl){
    var v=(x.c&&x.c[fl.k])?String(x.c[fl.k]).slice(0,90):""; if(v)o.c[fl.k]=v;
  });
  return o;
}
function stepById(id){for(var i=0;i<D.steps.length;i++){if(D.steps[i].id===id)return D.steps[i]}return {}}
function save(){lsSet(KEY,JSON.stringify({a:A,s:si}))}
function load(){
  var raw=lsGet(KEY); if(!raw)return false;
  try{var o=JSON.parse(raw); if(!o||!o.a)return false; A=clean(o.a); si=clampInt(o.s,0,20); return true;}
  catch(e){return false}
}
function link(){
  var base=location.origin+location.pathname.replace(/\\.html$/,"");
  return base+"#"+b64u(JSON.stringify(A));
}
function fromHash(){
  var h=(location.hash||"").replace(/^#/,"");
  if(h.length<6)return false;
  var s=unb64u(h); if(!s)return false;
  try{var o=JSON.parse(s); if(!o||!o.j)return false; A=clean(o); return true;}catch(e){return false}
}

/* ------------------------------------------------- the calendar, honestly */
function hijriYears(){
  var h=H(); if(!h)return [];
  var now=new Date(), out=[], y=0;
  try{y=h.toHijri(now).hy}catch(e){return []}
  for(var k=0;k<5&&out.length<3;k++){
    var yy=y+k, end=null;
    try{end=h.toGregorian(yy,12,13)}catch(e){}
    if(end&&end.getTime()>=now.getTime()-864e5)out.push(yy);
  }
  return out;
}
function fmtG(d,long){
  if(!d)return "";
  try{return d.toLocaleDateString(undefined,long?{weekday:"long",day:"numeric",month:"long",year:"numeric"}:{weekday:"short",day:"numeric",month:"short"})}
  catch(e){return ""}
}
function monthName(m){var h=H();if(!h||!h.MONTHS[m-1])return "";return h.MONTHS[m-1].en}
function monthAr(m){var h=H();if(!h||!h.MONTHS[m-1])return "";return h.MONTHS[m-1].ar}
function nextMonthStart(m){
  var h=H(); if(!h)return null;
  var now=new Date(), t;
  try{t=h.toHijri(now)}catch(e){return null}
  for(var k=0;k<3;k++){
    var d=null; try{d=h.toGregorian(t.hy+k,m,1)}catch(e){}
    if(d&&d.getTime()>=now.getTime()-864e5)return {hy:t.hy+k,d:d};
  }
  return null;
}
function addDays(d,n){if(!d)return null;var x=new Date(d.getTime());x.setDate(x.getDate()+n);return x}
"""

JS_WIZ = """
/* ------------------------------------------------------------- the wizard
   One question on the screen at a time, never a wall of fields. Answers are
   written to this device on every change, so a closed tab loses nothing. */
function flow(){
  return D.steps.filter(function(s){
    if(!s.when)return true;
    if(has(s.when,"hajj"))return A.j==="hajj";
    if(has(s.when,"umrah"))return A.j==="umrah";
    return true;
  });
}
function optRow(v,t,d,on,sq,ar,badge){
  return '<button type="button" class="opt'+(on?" on":"")+(sq?" sq":"")+'" data-v="'+esc(v)+'">'+
    '<span class="mk"></span><span class="ob"><span class="ot">'+esc(t)+
    (ar?'<span class="oar notranslate" translate="no" dir="rtl" lang="ar">'+esc(ar)+'</span>':"")+
    (badge?'<span class="obg">'+esc(badge)+'</span>':"")+'</span>'+
    (d?'<span class="od">'+esc(d)+'</span>':"")+'</span></button>';
}
function renderWiz(){
  var mount=$("wizmount"); if(!mount)return;
  var F=flow();
  if(si>=F.length)si=F.length-1;
  if(si<0)si=0;
  var s=F[si], body="", pct=Math.round(((si)/F.length)*100);
  var head='<div class="wizbar"><i style="width:'+pct+'%"></i></div>'+
    '<div class="wizk"><p class="kk">'+esc(s.kick||"")+'</p><span class="of">Question '+(si+1)+' of '+F.length+'</span></div>'+
    '<h2 class="wizq">'+esc(s.q)+'</h2>'+(s.help?'<p class="wizh">'+esc(s.help)+'</p>':"");
  var canNext=true;

  if(s.kind==="one"&&s.id!=="from"){
    body='<div class="opts" id="wopts">'+s.opts.map(function(o){
      var cur=(s.id==="journey")?A.j:A.w;
      return optRow(o.v,o.t,o.d,cur===o.v,false,o.ar,o.badge);
    }).join("")+'</div>';
    canNext=(s.id==="journey")?!!A.j:true;
  }else if(s.id==="from"){
    body='<div class="opts" id="wopts">'+D.regions.map(function(o){
      return optRow(o.v,o.t,o.d,A.f===o.v,false,"",o.v==="unknown"?"":"");
    }).join("")+'</div>';
    canNext=!!A.f;
  }else if(s.kind==="year"){
    var ys=hijriYears();
    if(!ys.length){
      body='<p class="wizn">The calendar engine did not load, so the years cannot be offered. '+
           'Choose Umrah, or reload the page with a connection once.</p>';
      canNext=false;
    }else{
      if(!A.y)A.y=ys[0];
      body='<div class="opts" id="wopts">'+ys.map(function(y){
        var h=H(), a=null,b=null;
        try{a=h.toGregorian(y,12,8);b=h.toGregorian(y,12,13)}catch(e){}
        var line=(a&&b)?("The eighth to the thirteenth of Dhul Hijjah falls about "+fmtG(a)+" to "+fmtG(b)+", "+a.getFullYear()):"";
        return optRow(String(y),y+" AH",line,A.y===y,false,"","");
      }).join("")+'</div>'+
      '<p class="wizn">These dates are arithmetic, not the sky. The moon is sighted, and the announcement of your country and of Saudi Arabia is the date. Expect a day either way, and do not book anything on the strength of this page alone.</p>';
    }
  }else if(s.kind==="month"){
    var opts=[optRow("0","I have not decided yet","The plan will count your days instead of naming them.",A.m===0,false,"","")];
    for(var m=1;m<=12;m++){
      var st=nextMonthStart(m), line="";
      if(st)line="Next falls about "+fmtG(st.d)+" "+st.d.getFullYear()+", in "+st.hy+" AH";
      var nt=D.monthNote[String(m)];
      opts.push(optRow(String(m),monthName(m),line+(nt?" . "+nt:""),A.m===m,false,monthAr(m),""));
    }
    body='<div class="opts" id="wopts">'+opts.join("")+'</div>';
  }else if(s.kind==="days"){
    body='<div class="nums">'+
      '<div class="fld"><label for="w-a">Days in Makkah</label><input id="w-a" type="number" inputmode="numeric" min="0" max="90" value="'+(A.a||"")+'" placeholder="0"/><p class="hint">'+
        (A.j==="hajj"?"Count the days of the Hajj itself among these: the eighth to the thirteenth of Dhul Hijjah are six of them.":"Including the day you arrive and the day you leave.")+
      '</p></div>'+
      '<div class="fld"><label for="w-b">Days in Madinah</label><input id="w-b" type="number" inputmode="numeric" min="0" max="90" value="'+(A.b||"")+'" placeholder="0"/><p class="hint">Zero if you are not going. There is no rite of Hajj or Umrah in Madinah, and nothing is owed for not going.</p></div>'+
      '</div>';
  }else if(s.kind==="many"){
    body='<div class="opts" id="wopts">'+s.opts.map(function(o){
      var cur=(s.id==="who")?A.o:A.n;
      return optRow(o.v,o.t,o.d,has(cur,o.v),true,"","");
    }).join("")+'</div>'+
    '<p class="wizh">Choose as many as are true, or none.</p>';
  }else if(s.kind==="card"){
    body='<div class="nums" style="grid-template-columns:1fr">'+D.pocket.fields.map(function(f){
      return '<div class="fld"><label for="c-'+esc(f.k)+'">'+esc(f.l)+'</label>'+
        '<input id="c-'+esc(f.k)+'" data-c="'+esc(f.k)+'" type="text" maxlength="90" value="'+esc(A.c[f.k]||"")+'" placeholder="'+esc(f.p)+'"/></div>';
    }).join("")+'</div>'+
    '<p class="wizh">Leave any of them empty. The card prints an empty line for anything you have not filled in, so you can write it with a pen when you know it.</p>';
  }

  var last=(si===F.length-1);
  var acts='<div class="wizacts">'+
    (si>0?'<button type="button" class="ghost" id="w-back">Back</button>':"")+
    '<span class="sp"></span>'+
    (si>0?'<button type="button" class="lnk" id="w-reset">Start again</button>':"")+
    '<button type="button" class="gpill" id="w-next"'+(canNext?"":" disabled")+'>'+(last?"Make my plan ✦":"Next")+'</button>'+
    '</div>';
  var note=s.note?'<p class="wizn">'+esc(s.note)+'</p>':"";
  mount.innerHTML='<div class="wizc mo">'+head+body+note+acts+
    '<p class="saved">Kept on this device only, under the name noor_plan_v1. Nothing is sent anywhere.</p></div>';

  var wo=$("wopts");
  if(wo)wo.addEventListener("click",function(ev){
    var b=ev.target.closest?ev.target.closest(".opt"):null; if(!b)return;
    var v=b.getAttribute("data-v");
    if(s.kind==="many"){
      var cur=(s.id==="who")?A.o:A.n;
      var i=cur.indexOf(v); if(i>=0)cur.splice(i,1); else cur.push(v);
      b.classList.toggle("on"); save(); return;
    }
    if(s.id==="journey"){A.j=v}
    else if(s.id==="way"){A.w=v}
    else if(s.id==="from"){A.f=v}
    else if(s.kind==="year"){A.y=clampInt(v,0,2000)}
    else if(s.kind==="month"){A.m=clampInt(v,0,12)}
    save(); go(1);
  });
  var wa=$("w-a"), wb=$("w-b");
  if(wa)wa.addEventListener("input",function(){A.a=clampInt(wa.value,0,90);save()});
  if(wb)wb.addEventListener("input",function(){A.b=clampInt(wb.value,0,90);save()});
  var cin=mount.querySelectorAll("input[data-c]");
  [].forEach.call(cin,function(el){el.addEventListener("input",function(){
    var k=el.getAttribute("data-c"), v=el.value.slice(0,90);
    if(v)A.c[k]=v; else delete A.c[k];
    save();
  })});
  var nb=$("w-next"); if(nb)nb.addEventListener("click",function(){go(1)});
  var bb=$("w-back"); if(bb)bb.addEventListener("click",function(){go(-1)});
  var rb=$("w-reset"); if(rb)rb.addEventListener("click",function(){
    A=blank(); si=0; lsDel(KEY);
    if(location.hash){try{history.replaceState(null,"",location.pathname)}catch(e){location.hash=""}}
    var pl=$("plan"); if(pl)pl.innerHTML=""; built=false;
    renderWiz(); mount.scrollIntoView({block:"start"});
  });
  if(window.NOOR_MO&&window.NOOR_MO.animate){try{window.NOOR_MO.animate(mount)}catch(e){}}
}
function go(dir){
  var F=flow();
  if(dir>0&&si===F.length-1){finish();return}
  si=Math.max(0,Math.min(F.length-1,si+dir));
  save(); renderWiz();
  var m=$("wizmount"); if(m)m.scrollIntoView({block:"start",behavior:"smooth"});
}
function finish(){
  if(A.a<1)A.a=A.j==="hajj"?6:4;
  save();
  var url=link();
  try{history.replaceState(null,"",url)}catch(e){location.hash=url.slice(url.indexOf("#"))}
  draw();
  var p=$("plan"); if(p)p.scrollIntoView({block:"start",behavior:"smooth"});
}
"""

JS_MODEL = """
/* --------------------------------------------------------- the plan model
   Everything below is computed from the answers. Two different pilgrims do
   not get the same document with a different name at the top. */
function regionOf(v){for(var i=0;i<D.regions.length;i++){if(D.regions[i].v===v)return D.regions[i]}return null}
function pick(list,tags){
  return (list||[]).filter(function(it){
    if(it.u){for(var i=0;i<it.u.length;i++){if(has(tags,it.u[i]))return false}}
    if(!it.w)return true;
    for(var j=0;j<it.w.length;j++){if(has(tags,it.w[j]))return true}
    return false;
  });
}
function build(){
  var P={};
  P.kind=(A.j==="umrah")?"umrah":"hajj";
  P.way=(P.kind==="umrah")?"umrah":(A.w||"tamattu");
  P.region=regionOf(A.f);
  P.mk=P.region?P.region.m:"unknown";
  P.miqat=(P.mk!=="inside"&&P.mk!=="unknown")?D.miqats[P.mk]:null;
  P.plane=!!(P.region&&P.region.plane);
  P.dmk=clampInt(A.a,0,90); P.dmd=clampInt(A.b,0,90);
  P.who=A.o.slice(); P.needs=A.n.slice(); P.card=A.c;
  P.tags=[].concat(P.who,P.needs,[P.kind,P.way]);
  if(P.mk==="inside")P.tags.push("inside");
  if(P.mk==="unknown")P.tags.push("unknown");
  if(P.plane)P.tags.push("plane");
  if(P.region&&P.region.v==="madinah")P.tags.push("viamadinah");
  if(P.dmd>0)P.tags.push("madinah");
  P.hy=(P.kind==="hajj")?clampInt(A.y,0,2000):0;
  P.hm=(P.kind==="umrah")?clampInt(A.m,0,12):0;
  P.dates={};
  var h=H();
  if(h&&P.kind==="hajj"&&P.hy){for(var d=1;d<=16;d++){try{P.dates[d]=h.toGregorian(P.hy,12,d)}catch(e){}}}
  P.season=null;
  if(h&&P.kind==="umrah"&&P.hm){P.season=nextMonthStart(P.hm)}
  P.rites=(D.rites||[]).filter(function(r){return has(r["for"],P.way)});
  P.days=(P.kind==="hajj")?hajjDays(P):umrahDays(P);
  P.warn=warnings(P);
  P.packing=(D.packing||[]).map(function(g){
    return {g:g.g,sub:g.sub,items:pick(g.items,P.tags)};
  }).filter(function(g){return g.items.length});
  P.before=(D.before||[]).map(function(g){
    return {k:g.k,sub:g.sub,items:pick(g.items,P.tags)};
  });
  P.money=(D.money.groups||[]).map(function(g){
    return {g:g.g,items:pick(g.items,P.tags)};
  });
  P.adjust=(D.adjust||[]).filter(function(x){return has(P.tags,x.v)});
  P.counts=counts(P);
  return P;
}
function counts(P){
  var c={tawaf:0,sai:0,saiNote:""};
  if(P.kind==="umrah"){c.tawaf=1;c.sai=1;return c}
  var early=P.preN>=1;
  c.tawaf=2+(early?1:0);
  if(P.way==="tamattu"){c.sai=early?2:1}
  else{c.sai=1;c.saiNote="The Hanafis have the pilgrim of qiran perform two tawafs and two sa\\u2019is, one set for each rite. Most schools have one of each serve for both. Ask which your group follows."}
  if(P.way==="ifrad")c.saiNote="Whether the sa\\u2019i performed after your arrival tawaf stands in place of the sa\\u2019i of the Hajj is a point the schools handle differently. Ask your group\\u2019s scholar.";
  return c;
}
function dayLabel(P,hd,i){
  var g=P.dates[hd]||null;
  return {hd:hd,greg:g,g:fmtG(g),n:i};
}
function extraFor(P,n){
  var out=[];
  (D.dayadd[n]||[]).forEach(function(x){if(has(P.tags,x.tag))out.push({w:x.w,t:x.t,o:x.o,add:1})});
  return out;
}
function ideaSet(D0,start,n){
  var out=[];
  for(var i=0;i<n&&i<D0.length;i++)out.push(D0[(start+i)%D0.length]);
  return out;
}
function hajjDays(P){
  var days=[], core=6, i=0;
  var extra=Math.max(0,P.dmk-core);
  var after=Math.min(2,Math.floor(extra/3));
  var before=extra-after;
  P.preN=before; P.postN=after;
  var startHd=8-before;
  var ideaAt=0;

  if(P.dmd>0&&P.region&&P.region.v==="madinah"){
    for(i=0;i<P.dmd;i++){
      days.push(madinahDay(P,i,ideaAt)); ideaAt+=2;
    }
  }
  var pre=D.pre;
  for(i=0;i<before;i++){
    var hd=startHd+i, lab=dayLabel(P,hd,days.length+1);
    var blocks, carry, title, lead, tmpl;
    if(i===0){tmpl=pre.arrive}
    else if(i===1&&P.way==="tamattu"){tmpl=pre.umrah}
    else if(i===1&&P.way!=="tamattu"){tmpl=pre.settle}
    else{tmpl=pre.settle}
    blocks=(tmpl.blocks||[]).slice();
    carry=(tmpl.carry||[]).slice();
    title=tmpl.t; lead=tmpl.lead;
    var ideas=[];
    if(tmpl===pre.settle){
      ideas=ideaSet(D.ideas.makkah,ideaAt,3); ideaAt+=3;
    }
    if(i===0&&P.way==="tamattu"&&before===1){
      blocks=blocks.concat(pre.umrah.blocks);
      title="Arrival, and your Umrah on the same day";
      lead="Both in one day, because your plan has only one day in Makkah before the eighth. It is doable, and it is tiring.";
    }
    if(i===0&&P.way!=="tamattu"){
      blocks=blocks.concat([{w:"When you reach the Haram",o:40,t:"Many groups perform a greeting tawaf on arrival, tawaf al-qudum, and some perform the sa\\u2019i of the Hajj after it. Whether that sa\\u2019i stands in place of the one after tawaf al-ifadah is a point the schools handle differently. Ask your group\\u2019s scholar which your group follows."}]);
    }
    if(i===0&&P.mk==="inside"){
      blocks=[{w:"There is no arrival",o:5,t:"You are already inside the line. For Hajj you enter ihram from where you are on the eighth; you do not travel out to a miqat. Use these days to rest and to prepare, not to travel."},
              {w:"While you still can",o:20,t:"Walk the routes you will need while the city is still quiet: your gate at the Haram, the mas\u2019a, and the way your group leaves for Mina. The week before the eighth is the last time any of it is easy."}]
        .concat(blocks.filter(function(b){return (b.o||50)>=40}));
      carry=["Your identity papers and your Hajj permit","Your group leader\u2019s number on paper","Water","Sandals that leave the ankle open, worn in"];
      title="At home, inside the line";
    }
    if(has(P.tags,"children")&&tmpl===pre.settle){
      blocks=blocks.concat([{w:"Early afternoon",o:35,t:"A real rest, in the room, with the curtains closed. Two hours. Every day.",add:1}]);
    }
    days.push({id:"pre"+i,lab:lab,cls:"",title:title,lead:lead,where:(P.mk==="inside"&&i===0)?"Home":"Makkah",
      blocks:blocks,carry:carry,ideas:ideas,ar:"",name:"",en:""});
  }
  (D.hajjdays||[]).forEach(function(day){
    var n=day.n, hd=parseInt(n,10);
    if(hd===13&&P.hurry)return;
    var blocks=(day.blocks||[]).filter(function(b){return !b.tag||has(b.tag,P.way)});
    blocks=blocks.concat(extraFor(P,n));
    days.push({id:"hd"+n,lab:dayLabel(P,hd,days.length+1),
      cls:(hd===9)?"core peak":"core",title:day.name,lead:day.lead,where:day.where,
      blocks:blocks,carry:day.carry||[],ideas:[],ar:day.ar,name:day.name,en:day.en,hd:hd});
  });
  for(i=0;i<after;i++){
    var hdA=14+i, isLast=(i===after-1);
    var t2=isLast?D.pre.depart:D.pre.settle;
    var ide=[];
    if(!isLast){ide=ideaSet(D.ideas.makkah,ideaAt,3); ideaAt+=3}
    days.push({id:"post"+i,lab:dayLabel(P,hdA,days.length+1),cls:"",title:t2.t,lead:t2.lead,
      where:"Makkah",blocks:(t2.blocks||[]).slice(),carry:(t2.carry||[]).slice(),ideas:ide,ar:"",name:"",en:""});
  }
  if(after===0){
    days.push({id:"post0",lab:dayLabel(P,14,days.length+1),cls:"",title:D.pre.depart.t,
      lead:"Your plan leaves no spare day in Makkah after the thirteenth, so the farewell tawaf belongs to the day you travel. Do it last, after everything else is packed.",
      where:"Makkah",blocks:(D.pre.depart.blocks||[]).slice(),carry:(D.pre.depart.carry||[]).slice(),ideas:[],ar:"",name:"",en:""});
  }
  if(P.dmd>0&&!(P.region&&P.region.v==="madinah")){
    for(i=0;i<P.dmd;i++){days.push(madinahDay(P,i,ideaAt)); ideaAt+=2}
  }
  return days;
}
function madinahDay(P,i,ideaAt){
  var t=D.pre.madinah;
  return {id:"md"+i,lab:{hd:0,greg:null,g:"",n:0},cls:"md",title:"In Madinah, day "+(i+1),
    lead:(i===0)?t.lead:"",where:"Madinah",
    blocks:(i===0)?[{w:"On arrival",o:10,t:"Settle, and find the gate of the mosque nearest your hotel. Then go and pray in it."}]:[],
    carry:(i===0)?["Modest dress, since there is no ihram here","Your documents","Water"]:[],
    ideas:ideaSet(D.ideas.madinah,ideaAt,i===0?3:2),ar:"",name:"",en:""};
}
function umrahDays(P){
  var days=[], i=0, ideaAt=0, n=Math.max(1,P.dmk);
  var pre=D.pre;
  if(P.dmd>0&&P.region&&P.region.v==="madinah"){
    for(i=0;i<P.dmd;i++){days.push(madinahDay(P,i,ideaAt)); ideaAt+=2}
  }
  for(i=0;i<n;i++){
    var title,lead,blocks,carry,ideas=[];
    if(i===0){
      title=pre.arrive.t; lead=pre.arrive.lead;
      blocks=pre.arrive.blocks.slice(); carry=pre.arrive.carry.slice();
      if(n===1){
        title="Arrival, and your Umrah";
        lead="One day, so it is all of it in one day. Drink before you begin, and do not rush the sa\\u2019i.";
        blocks=blocks.concat(pre.umrah.blocks);
        carry=carry.concat(pre.umrah.carry);
      }
      if(P.mk==="inside"){
        title="Going out to the boundary";
        lead="You are already inside the sanctuary, so an Umrah begins with going out. At-Tan\\u2019im or al-Ji\\u2019ranah, ihram there, and back in.";
        blocks=[{w:"Before you go out",o:10,t:"Wash, and take the cloths or your modest dress with you."},
                {w:"At at-Tan\\u2019im or al-Ji\\u2019ranah",o:20,t:"Enter ihram, make the intention for Umrah, and begin the talbiyah."},
                {w:"Back at the Haram",o:30,t:"Tawaf, two units, Zamzam, sa\\u2019i, and cut the hair."}];
      }
    }else if(i===1&&n>1){
      title=pre.umrah.t; lead=pre.umrah.lead;
      blocks=pre.umrah.blocks.slice(); carry=pre.umrah.carry.slice();
    }else if(i===n-1&&n>2){
      title=pre.depart.t;
      lead="A last tawaf before you leave is a beautiful habit. The obligation of the farewell tawaf belongs to the Hajj; after an Umrah it is not one of the four steps, so nobody owes anything for missing it.";
      blocks=pre.depart.blocks.slice(); carry=pre.depart.carry.slice();
    }else{
      title=pre.settle.t; lead=""; blocks=[]; carry=[];
      ideas=ideaSet(D.ideas.makkah,ideaAt,3); ideaAt+=3;
    }
    if(has(P.tags,"children")&&i>1&&i<n-1){
      blocks=blocks.concat([{w:"Early afternoon",o:35,t:"A real rest, in the room, with the curtains closed. Two hours, every day, decided in advance.",add:1}]);
    }
    if(has(P.tags,"crowds")&&i===1&&n>1){
      blocks=blocks.concat([{w:"Choosing the hour",o:5,t:"There is no better hour for an Umrah in the Sunnah, so choose the calm one. The small hours after Isha, or after Fajr, are a different mosque from the middle of the evening.",add:1}]);
    }
    var seasonDate=null;
    if(P.season)seasonDate=addDays(P.season.d,i);
    days.push({id:"u"+i,lab:{hd:0,greg:seasonDate,g:seasonDate?fmtG(seasonDate):"",n:i+1},
      cls:(i===1&&n>1)||(i===0&&n===1)?"core":"",title:title,lead:lead,where:"Makkah",
      blocks:blocks,carry:carry,ideas:ideas,ar:"",name:"",en:""});
  }
  if(P.dmd>0&&!(P.region&&P.region.v==="madinah")){
    for(i=0;i<P.dmd;i++){days.push(madinahDay(P,i,ideaAt)); ideaAt+=2}
  }
  return days;
}
function warnings(P){
  var w=[];
  if(P.kind==="hajj"&&P.dmk<6){
    w.push("Your plan has "+P.dmk+" day"+(P.dmk===1?"":"s")+" in Makkah, and the Hajj itself takes six, from the eighth to the thirteenth of Dhul Hijjah. Check the number with your operator: either the days are more than you counted, or your itinerary is leaving Mina after the twelfth, which the Qur\\u2019an permits.");
  }
  if(P.kind==="hajj"&&P.way==="tamattu"&&P.preN<1){
    w.push("Tamattu\\u2019 needs a full Umrah performed before the eighth, and your plan has no day in Makkah before it. Either add days, or ask your group whether you should perform qiran instead. Decide this before the miqat, not after.");
  }
  if(P.mk==="unknown"){
    w.push("You have not settled your miqat yet. Nothing else in this plan matters more before you fly, because crossing the line without ihram while intending the rites means going back to it, or a sacrifice.");
  }
  if(has(P.tags,"wheelchair")&&has(P.tags,"children")){
    w.push("A wheelchair and young children in the same party is the hardest combination there is. Ask your operator, in writing, for a tent near the edge of the camp, for the wheelchair route to the jamarat, and for whether your group splits into smaller parties. Ask now, not on the eighth.");
  }
  return w;
}
"""

JS_FIG = """
/* ------------------------------------------------------------- the figures
   Six drawings, and every one of them is made from this plan rather than
   picked off a shelf. Nothing figurative, no faces: a pilgrim is a mark. */
function n1(v){return (Math.round(v*10)/10)}
function dArr(x1,y1,x2,y2,head){
  head=head||11;
  var a=Math.atan2(y2-y1,x2-x1);
  var ax=x2-head*Math.cos(a-0.44), ay=y2-head*Math.sin(a-0.44);
  var bx=x2-head*Math.cos(a+0.44), by=y2-head*Math.sin(a+0.44);
  return "M"+n1(x1)+" "+n1(y1)+"L"+n1(x2)+" "+n1(y2)+"M"+n1(ax)+" "+n1(ay)+"L"+n1(x2)+" "+n1(y2)+"L"+n1(bx)+" "+n1(by);
}
function dGap(x1,y1,x2,y2,n){
  var out=[],i;n=n||7;
  for(i=0;i<n;i++){
    var t0=i/n, t1=t0+0.56/n;
    out.push("M"+n1(x1+(x2-x1)*t0)+" "+n1(y1+(y2-y1)*t0)+"L"+n1(x1+(x2-x1)*t1)+" "+n1(y1+(y2-y1)*t1));
  }
  return out.join("");
}
function dCirc(cx,cy,r){
  return "M"+n1(cx-r)+" "+n1(cy)+"a"+n1(r)+" "+n1(r)+" 0 1 0 "+n1(2*r)+" 0a"+n1(r)+" "+n1(r)+" 0 1 0 "+n1(-2*r)+" 0Z";
}
function dEll(cx,cy,rx,ry){
  return "M"+n1(cx-rx)+" "+n1(cy)+"a"+n1(rx)+" "+n1(ry)+" 0 1 0 "+n1(2*rx)+" 0a"+n1(rx)+" "+n1(ry)+" 0 1 0 "+n1(-2*rx)+" 0Z";
}
function dRect(x,y,w,h){return "M"+n1(x)+" "+n1(y)+"h"+n1(w)+"v"+n1(h)+"h"+n1(-w)+"Z"}
function dRound(x,y,w,h,r){
  return "M"+n1(x+r)+" "+n1(y)+"h"+n1(w-2*r)+"a"+n1(r)+" "+n1(r)+" 0 0 1 "+n1(r)+" "+n1(r)+
    "v"+n1(h-2*r)+"a"+n1(r)+" "+n1(r)+" 0 0 1 "+n1(-r)+" "+n1(r)+"h"+n1(-(w-2*r))+
    "a"+n1(r)+" "+n1(r)+" 0 0 1 "+n1(-r)+" "+n1(-r)+"v"+n1(-(h-2*r))+"a"+n1(r)+" "+n1(r)+" 0 0 1 "+n1(r)+" "+n1(-r)+"Z";
}
function dCube(x,y,w,h){
  w=w||30;h=h||34;
  return dRect(x-w/2,y-h/2,w,h)+"M"+n1(x-w/2)+" "+n1(y-h/2+8)+"h"+n1(w);
}
function PA(cls,ds){
  var d=(ds||[]).filter(function(x){return !!x}).join("");
  return d?'<path class="'+cls+'" d="'+d+'"/>':"";
}
function TX(x,y,s,cls,anchor){
  cls=cls||"ht2";
  var a=(anchor==="start")?" ta-s":(anchor==="end")?" ta-e":"";
  return '<text class="'+cls+a+'" x="'+n1(x)+'" y="'+n1(y)+'">'+esc(s)+'</text>';
}
function FIG(id,alt,w,h,body,cap,legend){
  var leg=legend&&legend.length?('<ul class="leg">'+legend.map(function(l){return "<li>"+l+"</li>"}).join("")+"</ul>"):"";
  return '<div class="fig mo-pop mo-draw">'+
    '<svg viewBox="0 0 '+w+' '+h+'" class="hsvg" role="img" aria-labelledby="'+id+'-t">'+
    '<title id="'+id+'-t">'+esc(alt)+'</title>'+body+'</svg>'+leg+
    '<p class="cap">'+cap+'</p></div>';
}
function cut(s,n){s=String(s);return s.length>n?s.slice(0,n-1)+"\\u2026":s}

/* --- 1. their journey, and only the places it actually visits ------------- */
function journeyNodes(P){
  var ns=[], viaMd=!!(P.region&&P.region.v==="madinah");
  ns.push({t:"Home",s:P.region?cut(P.region.t,17):"where you live",d:""});
  if(viaMd&&P.dmd>0)ns.push({t:"Madinah",s:"before Makkah",d:P.dmd});
  if(P.mk==="inside")ns.push({t:"Inside the line",s:"no miqat crossed",d:""});
  else if(P.mk==="unknown")ns.push({t:"Your miqat",s:"still to settle",d:""});
  else ns.push({t:cut(P.miqat.n,16),s:P.plane?"in the air":"on the road",d:""});
  if(P.kind==="umrah"){
    ns.push({t:"Makkah",s:"tawaf and sa\\u2019i",d:P.dmk});
  }else{
    ns.push({t:"Makkah",s:(P.way==="tamattu")?"the Umrah first":"in ihram",d:P.preN||0});
    ns.push({t:"Mina",s:"8 Dhul Hijjah",d:1});
    ns.push({t:"Arafah",s:"the ninth",d:1});
    ns.push({t:"Muzdalifah",s:"one night",d:1});
    ns.push({t:"Mina again",s:"the 10th to 12th",d:3});
    ns.push({t:"Makkah again",s:"tawaf al-ifadah",d:P.postN||0});
  }
  if(!viaMd&&P.dmd>0)ns.push({t:"Madinah",s:"no rite in it",d:P.dmd});
  ns.push({t:"Home",s:"the week after",d:""});
  return ns;
}
function figJourney(P){
  var ns=journeyNodes(P), cols=[80,240,400,560], dy=118, y0=76;
  var rows=Math.ceil(ns.length/4), H=y0+(rows-1)*dy+92;
  var line=[],fill=[],ring=[],arr=[],tx=[],hook=[];
  ns.forEach(function(nd,i){
    var r=Math.floor(i/4), c=i%4;
    if(r%2===1)c=3-c;
    var x=cols[c], y=y0+r*dy;
    ring.push(dCirc(x,y,13));
    if(nd.d)fill.push(dCirc(x,y,5));
    tx.push(TX(x,y+34,nd.t,"ht2"));
    if(nd.s)tx.push(TX(x,y+53,nd.s,"hts"));
    if(nd.d)tx.push(TX(x,y-24,nd.d+(nd.d===1?" day":" days"),"htn"));
    var last=(i===ns.length-1);
    if(last)return;
    var nr=Math.floor((i+1)/4), nc=(i+1)%4;
    if(nr%2===1)nc=3-nc;
    var nx=cols[nc], ny=y0+nr*dy;
    if(nr===r){
      var dx=(nx>x)?1:-1;
      arr.push(dArr(x+22*dx,y,nx-22*dx,y,10));
    }else{
      var edge=(c===3)?632:28, side=(c===3)?24:-24;
      hook.push("M"+n1(x+side)+" "+n1(y)+"H"+n1(edge)+"V"+n1(ny)+"H"+n1(nx+side));
      arr.push(dArr(nx+side*1.4,ny,nx+side*0.8,ny,10));
    }
  });
  var body=PA("hs3",hook)+PA("hs2",arr)+PA("hring",ring)+PA("hf2",fill)+
    TX(330,20,"the places this journey actually visits, in order","hts")+tx.join("");
  return FIG("fjourney","A chain of the places this journey visits, in order, each with the number of days spent there.",
    660,H,body,
    "<b>Your route.</b> Nothing on this map belongs to somebody else\\u2019s journey. A filled centre means you sleep there; the number above it is how many days your own answers gave it. If a number looks wrong, it is your day count that needs changing, not the map.",
    [(P.mk==="inside")?"You cross no miqat on the way in, because you are already inside the line.":
      (P.plane?"The miqat is crossed in the air. You are in ihram before the crew announces it, not after.":"The miqat is crossed on the road, and it is signposted."),
     "Distances are not drawn to scale and no distance is claimed. Ask your operator what each transfer actually takes in the year you go."]);
}

/* --- 2. their timeline, with their own dates ----------------------------- */
function figRibbon(P){
  var ds=P.days, n=ds.length, W=660, x0=54, x1=618, cw=(x1-x0)/n;
  var H=272, yb=152, hb=42;
  var cells=[],gold=[],mid=[],ticks=[],tx=[],pips=[],leads=[];
  ds.forEach(function(d,i){
    var x=x0+i*cw, cx=x+cw/2;
    var peak=(P.kind==="hajj")?(d.lab.hd===9):(d.cls&&d.cls.indexOf("core")>=0);
    if(peak)gold.push(dRect(x,yb,cw,hb));
    else if(d.cls&&d.cls.indexOf("core")>=0)mid.push(dRect(x,yb,cw,hb));
    else cells.push(dRect(x,yb,cw,hb));
    if(i)ticks.push("M"+n1(x)+" "+n1(yb)+"v"+n1(hb));
    var lab=(P.kind==="hajj")?(d.lab.hd?String(d.lab.hd):(d.where==="Madinah"?"M":String(i+1)))
                             :String(i+1);
    tx.push(TX(cx,yb+27,lab,cw>28?"ht2":"hts"));
    if(cw>=64&&d.lab&&d.lab.g)tx.push(TX(cx,yb+62,cut(d.lab.g,Math.max(6,Math.floor((cw-6)/7.83))),"hts"));
    else if(cw>=40&&d.lab&&d.lab.greg)tx.push(TX(cx,yb+62,String(d.lab.greg.getDate()),"hts"));
  });
  var marks=ribbonMarks(P);
  marks.forEach(function(m,k){
    var cx=x0+(m.i+0.5)*cw, ly=[42,68,94,120][k%4];
    pips.push(dCirc(cx,yb-8,4.5));
    leads.push("M"+n1(cx)+" "+n1(yb-12)+"V"+n1(ly+6));
    tx.push(TX(Math.max(74,Math.min(W-74,cx)),ly,cut(m.t,16),"hts htgold"));
  });
  var dated=ds.filter(function(d){return d.lab&&d.lab.greg});
  var span2=(dated.length>1)?(", about "+fmtG(dated[0].lab.greg)+" to "+fmtG(dated[dated.length-1].lab.greg)+" "+dated[dated.length-1].lab.greg.getFullYear()):"";
  var head=(P.kind==="hajj")
    ? ("Dhul Hijjah "+(P.hy||"")+span2)
    : (P.season?(monthName(P.hm)+" "+P.season.hy+", about "+fmtG(P.season.d)+" "+P.season.d.getFullYear()):"your days, in order");
  var body=PA("hband0",cells)+PA("hband3",mid)+PA("hband2",gold)+PA("hs4",ticks)+
    PA("hs3",leads)+PA("hf2",pips)+
    TX(330,22,head,"ht2")+tx.join("")+
    TX(330,H-16,(P.kind==="hajj")?"the number in each cell is the day of Dhul Hijjah":"the number in each cell is the day of your journey","hts");
  return FIG("fribbon","A ribbon of the days of this journey with each rite marked on the day it falls.",
    660,H,body,
    (P.kind==="hajj"
      ? "<b>Your days.</b> The gold cell is the ninth, the standing at Arafah, which nothing replaces. The cells beside it are the rest of the Hajj, and a cell marked M is a day in Madinah. The marks above the ribbon are the rites, each on the day your own plan puts it. The Gregorian dates are arithmetic and wait on the moon."
      : "<b>Your days.</b> The gold cell is your Umrah itself. The marks above the ribbon are what happens on each day your own plan puts it, and a cell marked M is a day in Madinah. If your month is not fixed yet, the numbers are simply the days of your journey."),
    (P.kind==="hajj")?["Every date here can move by a day. The announcement is the date, not this page."]
      :["An approximate month is enough for a plan. Fix the days with your operator, then come back and change the numbers."]);
}
function ribbonMarks(P){
  var out=[], ds=P.days;
  function at(id){for(var i=0;i<ds.length;i++){if(ds[i].id===id)return i}return -1}
  function push(id,t){var i=at(id); if(i>=0)out.push({i:i,t:t})}
  if(P.kind==="umrah"){
    ds.forEach(function(d,i){
      if(d.cls&&d.cls.indexOf("core")>=0)out.push({i:i,t:"the Umrah"});
      else if(i===0)out.push({i:i,t:"ihram"});
      else if(d.where==="Madinah"&&(i===0||ds[i-1].where!=="Madinah"))out.push({i:i,t:"Madinah"});
      else if(i===ds.length-1)out.push({i:i,t:"home"});
    });
    return out;
  }
  ds.forEach(function(d,i){
    if(d.id==="pre1"&&P.way==="tamattu")out.push({i:i,t:"Umrah"});
    if(d.id==="pre0")out.push({i:i,t:"ihram"});
  });
  push("hd8","Mina"); push("hd9","Arafah"); push("hd10","stone, shave");
  push("hd11","stone three"); push("hd12","stone, or go");
  push("hd13","last stoning");
  for(var i=ds.length-1;i>=0;i--){if(ds[i].where==="Makkah"){out.push({i:i,t:"farewell tawaf"});break}}
  for(var j=0;j<ds.length;j++){if(ds[j].where==="Madinah"){out.push({i:j,t:"Madinah"});break}}
  out.sort(function(a,b){return a.i-b.i});
  return out;
}
"""

JS_FIG2 = """
/* --- 3. tawaf: seven circuits, from the Stone and back to it -------------- */
function figTawaf(P){
  var cx=330, cy=178, W=660, H=414;
  var r0=38, r1=118, turns=7, step=8, pts=[];
  var total=turns*360;
  for(var a=0;a<=total;a+=step){
    var r=r0+(r1-r0)*(a/total);
    var th=-a*Math.PI/180;
    pts.push((a===0?"M":"L")+n1(cx+r*Math.cos(th))+" "+n1(cy+r*Math.sin(th)));
  }
  var spiral=pts.join("");
  var radial="M"+n1(cx+30)+" "+n1(cy)+"H"+n1(cx+148);
  var wedge="M"+n1(cx+26)+" "+n1(cy-8)+"l13 8l-13 8Z";
  var dirArrow=dArr(cx-10,cy-r1-24,cx+30,cy-r1-24,10);
  var strip=[],stripF=[],stripT=[];
  for(var k=1;k<=7;k++){
    var sx=192+(k-1)*46;
    if(k===7)stripF.push(dCirc(sx,364,13)); else strip.push(dCirc(sx,364,13));
    stripT.push(TX(sx,369,String(k),k===7?"htn":"ht2"));
  }
  var body=PA("hs3",[dCirc(cx,cy,r1+13)])+
    PA("hs1",[spiral])+
    PA("hs1 hgold",[radial])+
    PA("hf2",[wedge])+
    PA("hs2",[dirArrow])+
    PA("hs1",[dCube(cx,cy,32,36)])+
    PA("hring",strip)+PA("hf1 hring",stripF)+
    TX(cx+154,cy-2,"the Black Stone","ht2 htgold","start")+
    TX(cx+154,cy+16,"start, and finish","hts","start")+
    TX(cx,cy-r1-32,"anticlockwise, the House on your left","hts")+
    TX(cx,336,"seven circuits, counted from the Stone","hts")+
    stripT.join("")+
    TX(cx,398,"the seventh brings you back to where the first began","hts");
  var many=P.counts.tawaf;
  return FIG("ftawaf","A spiral of seven turns around a plain cube, with the corner of the Black Stone marked as the start and the finish.",
    W,H,body,
    "<b>Qur\u2019an 22:29 and Bukhari 1597.</b> One circuit is one full pass from the corner of the Black Stone back to that corner. The spiral is drawn opening outward only so that seven can be counted; on the ground you walk the same ring seven times. Lose count and you build on the lower number you are certain of.",
    ["Your plan contains <b>"+many+"</b> tawaf"+(many===1?"":"s")+" of seven circuits.",
     "Face the Stone, raise the right hand, say Allahu akbar, and keep walking. Kissing it is a sunnah; injuring someone to reach it is not."]);
}

/* --- 4. sa'i: seven traversals, and why going and returning are two ------- */
function figSai(P){
  var W=660,H=336,xs=150,xm=510,y0=64,dy=27;
  var lanes=[],heads=[],nums=[],pipsF=[];
  for(var k=1;k<=7;k++){
    var y=y0+(k-1)*dy, l2r=(k%2===1);
    var a=l2r?xs:xm, b=l2r?xm:xs;
    lanes.push("M"+n1(a)+" "+n1(y)+"H"+n1(b-(l2r?16:-16)));
    heads.push(dArr(b-(l2r?40:-40),y,b-(l2r?14:-14),y,10));
    pipsF.push(dCirc(a,y,11));
    nums.push(TX(a,y+5,String(k),k===7?"htn":"ht2"));
  }
  var hillS="M96 288q28 -46 56 0Z", hillM="M456 288q28 -46 56 0Z";
  var mk=[dGap(300,54,300,272,9),dGap(372,54,372,272,9)];
  var body=PA("hs3",mk)+PA("hs2",lanes)+PA("hs1",heads)+PA("hring",pipsF)+
    PA("hs1",[hillS,hillM,"M96 288h56","M456 288h56"])+
    TX(124,308,"as-Safa","ht2 htgold")+TX(484,308,"al-Marwah","ht2 htgold")+
    TX(124,326,"you begin here","hts")+TX(484,326,"you end here","hts")+
    TX(336,44,"the two markers, where men jog and women walk","hts")+
    TX(330,24,"seven traversals, not seven return trips","ht2")+
    nums.join("");
  var many=P.counts.sai;
  return FIG("fsai","Seven lanes between two hills, each with an arrow, showing that a traversal in one direction counts as one.",
    W,H,body,
    "<b>Qur\\u2019an 2:158 and Muslim 1218.</b> Safa to Marwah is one. Marwah back to Safa is two. Going and returning are not one trip, they are two, which is why seven ends you at Marwah and not back at Safa. This is the commonest counting mistake there is.",
    ["Your plan contains <b>"+many+"</b> sa\\u2019i"+(many===1?"":"s")+" of seven."+(P.counts.saiNote?" "+P.counts.saiNote:""),
     "Sa\\u2019i is the memory of a woman running. Hajar went up one hill and then the other, seven times, looking for water for her child."]);
}

/* --- 5. their own gate on the ring --------------------------------------- */
var GATES=[
  {k:"hulayfah",deg:-90,nx:330,ny:30,sx:330,sy:48},
  {k:"dhatirq",deg:-35,nx:552,ny:92,sx:552,sy:112},
  {k:"qarn",deg:15,nx:556,ny:296,sx:556,sy:316},
  {k:"yalamlam",deg:90,nx:330,ny:372,sx:330,sy:392},
  {k:"juhfah",deg:-145,nx:110,ny:76,sx:110,sy:96}
];
function figMiqat(P){
  var cx=330,cy=205,rx=230,ry=135,W=660,H=452;
  var dimTri=[],dimRing=[],dimArr=[],onTri=[],onRing=[],onArr=[],onArc=[],tx=[];
  GATES.forEach(function(g){
    var m=D.miqats[g.k], on=(P.mk===g.k);
    var t=g.deg*Math.PI/180;
    var gx=cx+rx*Math.cos(t), gy=cy+ry*Math.sin(t);
    var tri="M"+n1(gx)+" "+n1(gy+8)+"l-13 -16h26Z";
    var ring=dCirc(gx,gy,on?11:9);
    var ar=dArr(gx+(cx-gx)*0.22,gy+(cy-gy)*0.22,gx+(cx-gx)*0.56,gy+(cy-gy)*0.56,9);
    if(on){
      onTri.push(tri);onRing.push(ring);onArr.push(ar);
      var seg=[];
      for(var a=g.deg-26;a<=g.deg+26;a+=4){
        var u=a*Math.PI/180;
        seg.push((seg.length?"L":"M")+n1(cx+rx*Math.cos(u))+" "+n1(cy+ry*Math.sin(u)));
      }
      onArc.push(seg.join(""));
    }else{dimTri.push(tri);dimRing.push(ring);dimArr.push(ar)}
    tx.push(TX(g.nx,g.ny,m.n,on?"ht2 htgold":"ht2 hdim"));
    tx.push(TX(g.sx,g.sy,m.dir,on?"hts htgold":"hts hdim"));
  });
  var mid=[],midT=[];
  if(P.mk==="inside"){
    mid.push(dCirc(cx-104,cy+42,10));
    midT.push(TX(cx-104,cy+72,"you are here","ht2 htgold"));
    midT.push(TX(cx-104,cy+90,"inside the line","hts"));
    midT.push(TX(330,414,"no gate on this ring is yours on the way in","hts"));
    midT.push(TX(330,434,"for an Umrah you go out to at-Tan\u2019im, and come back","hts"));
  }else if(P.mk==="unknown"){
    midT.push(TX(330,414,"your gate is not settled yet, and it is a question with an answer","hts"));
    midT.push(TX(330,434,"ask your operator, and listen for the announcement on the aircraft","hts"));
  }else{
    midT.push(TX(330,414,P.plane?"you cross this line in the air, not at an airport desk":"you cross this line on the road, and it is signposted","hts"));
    midT.push(TX(330,434,"be in ihram before you reach it","hts"));
  }
  var body=PA("hs3",[dEll(cx,cy,rx,ry)])+
    PA("hs4",dimArr)+PA("hs4",dimTri)+PA("hs2",dimRing)+
    PA("hs1 hgold",onArc)+PA("hs1",onArr)+PA("hs1",onTri)+PA("hf1 hring",onRing)+
    PA("hf2",mid)+
    PA("hs1",[dCube(cx,cy,34,38)])+
    TX(cx,cy-52,"Makkah","ht1")+
    tx.join("")+midT.join("");
  var m=P.miqat;
  var cap=m
    ? ("<b>Bukhari 1524 and Muslim 1181.</b> Your gate is <b>"+esc(m.n)+"</b>, "+esc(m.dir)+
       (m.today?", "+esc(m.today):"")+". "+esc(m.note))
    : (P.mk==="inside"
      ? "<b>Bukhari 1524.</b> Whoever lives nearer than a miqat enters ihram from where he is, until the people of Makkah enter from Makkah itself. No gate on this ring is yours on the way in."
      : "<b>Bukhari 1524.</b> The rule covers everyone: the gates are for the people of those places, and for whoever comes through them from other lands. Yours is the one on your own route, and it is a question with an answer. Settle it before you fly.");
  var leg=[];
  if(m)leg.push("Whoever crosses it without ihram while intending the rites returns to it, or a sacrifice is due.");
  if(P.plane)leg.push("An aircraft crosses the line in the air. Change at your departure airport and make the intention when the crew announces it.");
  if(P.region&&P.region.alt)leg.push(esc(P.region.alt));
  if(P.mk==="inside")leg.push("For an Umrah you go out to at-Tan\u2019im or al-Ji\u2019ranah, enter ihram there, and come back in.");
  return FIG("fmiqat","Five gates on a ring around Makkah with the one on this pilgrim\u2019s own route lit and the others dimmed.",
    W,H,body,cap,leg);
}
"""

JS_FIG3 = """
/* --- 6. the rhythm of the hardest day ------------------------------------ */
function figRhythm(P){
  var W=660,H=(P.kind==="hajj")?254:206,x0=54,x1=618,yb=104,hb=54,span=x1-x0;
  var segs,title,cap,legs;
  if(P.kind==="hajj"){
    segs=[
      {w:0.20,k:"dim",c:"ht2",t:"to Arafah",s:"after sunrise"},
      {w:0.12,k:"mid",c:"hts",t:"Zuhr",s:"and Asr"},
      {w:0.34,k:"gold",c:"htn",t:"THE STANDING",s:"midday to sunset"},
      {w:0.10,k:"mid",c:"hts",t:"leave",s:"calmly"},
      {w:0.17,k:"dim",c:"hts",t:"Muzdalifah",s:"sleep there"},
      {w:0.07,k:"mid",c:"hts",t:"Fajr",s:""}
    ];
    title="The ninth of Dhul Hijjah, hour by hour";
    cap="<b>Tirmidhi 889.</b> Hajj is Arafah. The gold band is the whole reason you came, and it runs from midday to sunset, which is longer than anyone can hold at full intensity. Pace it. Ask, rest, ask, rest, ask. Nobody stands the whole afternoon weeping, and nobody is asked to.";
    legs=["Do not fast today. He \ufdfa stood at Arafah not fasting and drank in full view of the people so that they would know.",
      "Do not climb anything. All of Arafah is a standing place, and there is no rite attached to the mountain.",
      "Do not pray Maghrib at Arafah. It waits until Muzdalifah, and is prayed there with Isha."];
  }else{
    segs=[
      {w:0.16,k:"mid",c:"hts",t:"enter",s:"right foot"},
      {w:0.28,k:"gold",c:"htn",t:"TAWAF",s:"seven circuits"},
      {w:0.17,k:"mid",c:"hts",t:"two units",s:"and Zamzam"},
      {w:0.26,k:"gold",c:"htn",t:"SA\u2019I",s:"seven, to Marwah"},
      {w:0.13,k:"mid",c:"hts",t:"cut hair",s:"finished"}
    ];
    title="Your Umrah, from the door to the release";
    cap="<b>Muslim 1218.</b> Four steps and a few hours. The two long bands are where the time actually goes, and where people who did not drink beforehand come unstuck. This is also the best rehearsal there is for the tenth of Dhul Hijjah, when tawaf and sa\u2019i return and you are tired.";
    legs=["Drink before you begin, not when you are already thirsty.",
      "There is no better hour for an Umrah in the Sunnah. Choose the calm one."];
  }
  var dim=[],mid=[],gold=[],tx=[],x=x0;
  segs.forEach(function(s0){
    var w=span*s0.w, inner=w-8;
    var d=dRound(x,yb,w-3,hb,7);
    if(s0.k==="gold")gold.push(d); else if(s0.k==="mid")mid.push(d); else dim.push(d);
    var cxs=x+(w-3)/2;
    var per={htn:9.6,ht1:11.5,ht2:9.0,hts:7.83}[s0.c]||7.83;
    var maxT=Math.max(3,Math.floor(inner/per));
    var maxS=Math.max(3,Math.floor(inner/7.83));
    tx.push(TX(cxs,yb+26,cut(s0.t,maxT),s0.c+((s0.k==="gold")?"":"")));
    if(s0.s&&maxS>=s0.s.length)tx.push(TX(cxs,yb+44,s0.s,"hts"));
    x+=w;
  });
  var pace=[],paceT=[];
  if(P.kind==="hajj"){
    var gx=x0+span*0.32, gw=span*0.34;
    pace.push("M"+n1(gx+6)+" "+n1(yb+hb+14)+"H"+n1(gx+gw-6));
    ["ask","rest","ask","rest","ask"].forEach(function(l,i){
      var px=gx+gw*(i+0.5)/5;
      pace.push("M"+n1(px)+" "+n1(yb+hb+10)+"v8");
      paceT.push(TX(px,yb+hb+38,l,(l==="ask")?"htn":"hts"));
    });
    paceT.push(TX(330,yb+hb+58,"the long band, paced","hts"));
  }
  var body=PA("hband0",dim)+PA("hband3",mid)+PA("hband2",gold)+
    PA("hs3",pace)+
    TX(330,28,title,"ht2")+
    TX(x0,yb-14,(P.kind==="hajj")?"sunrise":"you arrive","hts","start")+
    TX(x1,yb-14,(P.kind==="hajj")?"dawn of the tenth":"you are released","hts","end")+
    tx.join("")+paceT.join("")+
    TX(330,H-12,rhythmNote(P),"hts");
  return FIG("frhythm","A band of the hours of the hardest day, with the longest stretch marked and a pacing strip beneath it.",
    W,H,body,cap,legs);
}
function rhythmNote(P){
  var umrah=(P.kind==="umrah");
  if(has(P.tags,"children"))return umrah?"with children: rest between the tawaf and the sa\u2019i, deliberately"
    :"with children: take the long band in turns, one adult at a time";
  if(has(P.tags,"wheelchair"))return umrah?"in a chair: the upper floors are open for both, and a circuit there is a circuit"
    :"in a chair: face the qiblah, stay in the shade, and do not move about";
  if(has(P.tags,"mobility")||has(P.tags,"elderly"))return umrah?"the upper levels are longer and far calmer. Take them"
    :"sitting is a standing. Presence inside the boundary is the rite";
  if(has(P.tags,"crowds"))return umrah?"the small hours after Isha are a different mosque entirely"
    :"leave the long band late, deliberately, and let the crush go first";
  if(has(P.tags,"chronic"))return "eat and drink on your own schedule, whatever everyone around you is doing";
  return umrah?"drink before you begin, and do not rush the sa\u2019i"
    :"pace it. Nobody holds the whole afternoon at full intensity, and nobody is asked to";
}

/* --- 7. the acts of this plan, sorted by what happens if they are missed -- */
function figRanks(P){
  var cols=[{k:"pillar",t:"Pillar",s:"nothing replaces it"},
    {k:"obligation",t:"Obligation",s:"a sacrifice repairs it"},
    {k:"sunnah",t:"Sunnah",s:"nothing is owed"}];
  var lists=cols.map(function(c){return P.rites.filter(function(r){return r.rank===c.k})});
  var maxN=Math.max(1,lists[0].length,lists[1].length,lists[2].length);
  var W=660, top=64, ph=88+(maxN-1)*25+18, H=top+ph+34;
  var xs=[120,330,540], boxes=[],golds=[],tx=[],lines=[];
  cols.forEach(function(c,i){
    var list=lists[i], x=xs[i], w=194;
    if(c.k==="pillar")golds.push(dRound(x-w/2,top,w,ph,12));
    else boxes.push(dRound(x-w/2,top,w,ph,12));
    tx.push(TX(x,top+28,c.t,c.k==="pillar"?"htg":"ht1"));
    tx.push(TX(x,top+48,c.s,"hts"));
    lines.push("M"+n1(x-w/2+16)+" "+n1(top+62)+"H"+n1(x+w/2-16));
    list.forEach(function(r,k){tx.push(TX(x,top+88+k*25,cut(r["short"],24),"hts"))});
    if(!list.length)tx.push(TX(x,top+88,"none in your plan","hts hdim"));
    tx.push(TX(x,H-12,String(list.length)+(list.length===1?" act":" acts"),"htn"));
  });
  var body=PA("hband3",boxes)+PA("hband1",golds)+PA("hs3",lines)+
    TX(330,30,"every act of your own plan, and what happens if it is missed","hts")+tx.join("");
  return FIG("franks","Three panels sorting the acts of this plan into pillars, obligations and sunnahs.",
    W,H,body,
    "<b>The ranks, as the Golden Room gives them.</b> A rukn, a pillar, is part of the thing itself: omit it and there is no rite, and money cannot buy it back. A wajib, an obligation, is commanded but not of the essence: omit it and a dam, a sacrifice, repairs it. A sunnah costs nothing and loses something.",
    ["The schools do not put every act in the same rank, and where they part, the rite below says so in their own words.",
     "A dam is a sacrifice, not a fine. It is meat for the poor of the sanctuary."]);
}
"""

JS_RENDER = """
/* ------------------------------------------------------------ the writing */
function secHead(id,ar,tr,h2,sub){
  return '<section class="plansec mo" id="'+id+'"><div class="sh">'+
    '<span class="ar notranslate" translate="no" dir="rtl" lang="ar">'+esc(ar)+'</span>'+
    '<h2>'+esc(h2)+'</h2></div><p class="tr">'+esc(tr)+'</p>'+
    (sub?'<p class="sub">'+esc(sub)+'</p>':"");
}
function wayName(w){return w==="tamattu"?"Tamattu\\u2019":w==="qiran"?"Qiran":w==="ifrad"?"Ifrad":"Umrah"}
function planTitle(P){
  if(P.kind==="umrah")return "Your Umrah";
  return "Your Hajj, performed as "+wayName(P.way);
}
function facts(P){
  var out=[];
  out.push({l:"The journey",v:(P.kind==="umrah")?"Umrah":("Hajj, "+wayName(P.way)),
    s:(P.kind==="umrah")?"the lesser pilgrimage":(P.way==="tamattu"?"Umrah, out, then Hajj":P.way==="qiran"?"both in one ihram":"Hajj alone")});
  out.push({l:"When",v:(P.kind==="hajj")?("Dhul Hijjah "+(P.hy||"")):(P.hm?monthName(P.hm):"not decided"),
    s:(P.kind==="hajj"&&P.dates[9])?("Arafah about "+fmtG(P.dates[9])):(P.season?("about "+fmtG(P.season.d)+" "+P.season.d.getFullYear()):"a month, when you choose it")});
  out.push({l:"Your miqat",v:P.miqat?P.miqat.n:(P.mk==="inside"?"Inside the line":"Not settled"),
    s:P.miqat?P.miqat.dir:(P.mk==="inside"?"ihram from where you are":"settle it before you fly")});
  out.push({l:"Days",v:P.dmk+" in Makkah",s:P.dmd?(P.dmd+" in Madinah"):"none in Madinah"});
  return out.map(function(f){
    return '<div class="fact"><p class="fl">'+esc(f.l)+'</p><p class="fv">'+esc(f.v)+'</p><p class="fs">'+esc(f.s)+'</p></div>';
  }).join("");
}
function dayHtml(P,d,i){
  var head='<div class="dh"><div class="dn">'+
    (d.lab.hd?esc(String(d.lab.hd)):esc(String(i+1)))+
    '<small>'+(d.lab.hd?"Dhul Hijjah":(d.where==="Madinah"?"Madinah":"Day"))+'</small></div><div class="dt">'+
    (d.ar?'<p class="dar notranslate" translate="no" dir="rtl" lang="ar">'+esc(d.ar)+'</p>':"")+
    '<h3>'+esc(d.title)+'</h3>'+
    (d.en?'<p class="dg">'+esc(d.en)+'</p>':"")+
    '<p class="dw">'+esc(d.where)+(d.lab.g?" \\u00b7 "+esc(d.lab.g):"")+'</p></div></div>';
  var lead=d.lead?'<p class="dl">'+esc(d.lead)+'</p>':"";
  var bl=d.blocks.slice().sort(function(a,b){return (a.o==null?50:a.o)-(b.o==null?50:b.o)});
  var blocks=bl.length?('<div class="blks">'+bl.map(function(b){
    return '<div class="blk'+(b.add?" add":"")+'"><p class="bw">'+esc(b.w)+'</p><p class="bt">'+esc(b.t)+'</p></div>';
  }).join("")+'</div>'):"";
  var ideas=d.ideas&&d.ideas.length?('<div class="blks">'+d.ideas.map(function(x){
    return '<div class="idea"><div><p class="it">'+esc(x.t)+'</p><p class="id">'+esc(x.d)+'</p></div></div>';
  }).join("")+'</div>'):"";
  var carry=d.carry&&d.carry.length?('<div class="carry"><p class="ck">Carry today</p><ul>'+
    d.carry.map(function(c){return "<li>"+esc(c)+"</li>"}).join("")+'</ul></div>'):"";
  return '<div class="day mo '+esc(d.cls||"")+'">'+head+lead+blocks+ideas+carry+'</div>';
}
function duaHtml(k){
  var d=D.duas[k]; if(!d)return "";
  return '<div class="tal"><p class="tl">'+esc(d.label)+'</p>'+
    '<p class="ar notranslate" translate="no" dir="rtl" lang="ar">'+esc(d.ar)+'</p>'+
    '<p class="trl">'+esc(d.tr)+'</p><p class="mean">'+esc(d.en)+'</p>'+
    (d.src?'<p class="src">'+esc(d.src)+'</p>':"")+'</div>';
}
function riteHtml(P,r){
  var pillar=!!r.pillar;
  var flag=pillar?'<p class="pflag">Pillar. Leave this out and the rite is not valid, and no sacrifice replaces it.</p>':"";
  var wn=(r.byway&&r.byway[P.way])?'<p class="waynote">'+esc(r.byway[P.way])+'</p>':"";
  var steps='<ol class="stp">'+r.steps.map(function(s){return "<li>"+esc(s)+"</li>"}).join("")+'</ol>';
  return '<article class="card mo rite'+(pillar?" pillarcard":"")+'">'+
    '<div class="ch"><h3>'+esc(r.n)+'</h3><div class="chb">'+r.chip+r.badge+'</div></div>'+
    '<p class="rar notranslate" translate="no" dir="rtl" lang="ar">'+esc(r.ar)+'</p>'+
    '<p class="rg">'+esc(r.gloss)+'</p>'+
    '<p class="rw">'+esc(r.when)+'</p>'+
    flag+steps+wn+(r.dua?duaHtml(r.dua):"")+r.schools+r.refs+'</article>';
}
function listHtml(items,cls){
  return '<ul class="tick">'+items.map(function(it){
    return '<li class="'+(it.w?"you":"")+'">'+esc(it.t)+'</li>';
  }).join("")+'</ul>';
}
function emgHtml(P){
  return '<div class="emg mo"><p class="ek">Carry these, on paper</p><div class="emgrid">'+
    cardFields(P).map(function(f){
      var v=P.card[f.k]||"";
      return '<div class="emf"><p class="el">'+esc(f.l)+'</p><p class="ev'+(v?"":" blank")+'">'+
        (v?esc(v):esc(f.p))+'</p></div>';
    }).join("")+'</div></div>';
}

function cardFields(P){
  return (D.pocket.fields||[]).filter(function(f){
    if(!f["for"])return true;
    if(P.card[f.k])return true;
    return has(P.tags,f["for"]);
  });
}
function pocketHtml(P){
  var order=P.rites.map(function(r,i){
    var cls=r.rank==="pillar"?"rp":r.rank==="obligation"?"ro":"rs";
    var lab=r.rank==="pillar"?"Pillar":r.rank==="obligation"?"Wajib":"Sunnah";
    return '<li><b>'+esc(r["short"])+'</b> <span class="pcw">'+esc(r.pcw)+'</span>'+
      '<span class="pcrk '+cls+'">'+lab+'</span></li>';
  }).join("");
  var miq=P.miqat
    ? '<p class="pcline"><b>'+esc(P.miqat.n)+'</b></p>'+
      '<p class="pcline"><span class="k">Direction</span> '+esc(P.miqat.dir)+'</p>'+
      (P.miqat.today?'<p class="pcline"><span class="k">Today</span> '+esc(P.miqat.today)+'</p>':"")+
      '<p class="pcline">'+(P.plane?"Crossed in the air. Be in ihram before the crew announces it.":"Crossed on the road, and signposted.")+'</p>'
    : (P.mk==="inside"
      ? '<p class="pcline"><b>Inside the line</b></p><p class="pcline">Ihram for Hajj from where you are. For an Umrah, out to at-Tan\\u2019im or al-Ji\\u2019ranah first.</p>'
      : '<p class="pcline"><b>Not settled yet</b></p><p class="pcline">Ask your operator which airport, and whether you go to Madinah first. Listen for the announcement on the aircraft.</p>');
  var when="";
  if(P.kind==="hajj"){
    when='<p class="pcline"><span class="k">Year</span> '+esc(String(P.hy||""))+' AH</p>';
    [[8,"Mina"],[9,"Arafah"],[10,"Stone, shave, tawaf"],[12,"Leave, or stay"]].forEach(function(r){
      var g=P.dates[r[0]];
      when+='<p class="pcline"><span class="k">'+r[0]+' Dhul Hijjah</span> '+esc(r[1])+(g?" \\u00b7 "+esc(fmtG(g)):"")+'</p>';
    });
    when+='<p class="pcline">Dates are arithmetic. The announcement is the date.</p>';
  }else{
    when='<p class="pcline"><span class="k">Month</span> '+esc(P.hm?monthName(P.hm):"not decided")+'</p>'+
      '<p class="pcline"><span class="k">Days</span> '+P.dmk+' in Makkah'+(P.dmd?", "+P.dmd+" in Madinah":"")+'</p>';
  }
  var flds=cardFields(P);
  var fields=flds.map(function(f){
    var v=P.card[f.k]||"";
    return '<div class="pcfld"><span class="fk">'+esc(f.s||f.l)+'</span><span class="fv'+(v?"":" blank")+'">'+esc(v)+'</span></div>';
  }).join("");
  var dont=pick(D.pocket.dont||[],P.tags).slice(0,6);
  var dbox=dont.length?('<div class="pcb plain"><p class="pck">In the crowd, remember</p><ul class="pcdont">'+
    dont.map(function(x){return "<li>"+esc(x.t)+"</li>"}).join("")+'</ul></div>'):"";
  var duas=["talbiyah","corners","safa","mosque"].map(function(k){
    var d=D.duas[k]; if(!d)return "";
    return '<div class="pcd"><p class="dl">'+esc(d.label)+'</p>'+
      '<p class="dar notranslate" translate="no" lang="ar">'+esc(d.ar)+'</p>'+
      '<p class="dtr">'+esc(d.tr)+'</p><p class="dmn">'+esc(d.en)+'</p></div>';
  }).join("");
  var key='<p class="pckey">'+(D.pocket.key||[]).map(function(r){
      var cls=r[0]==="Pillar"?"rp":r[0]==="Wajib"?"ro":"rs";
      return '<span class="pcrk '+cls+'">'+esc(r[0])+'</span> '+esc(r[1]);
    }).join(' <b>\u00b7</b> ')+'</p>';
  return '<div id="pcwrap"><div id="pcscale"><div id="pc">'+
    '<div class="pcfold"><span>'+esc(D.pocket.fold||"fold here")+'</span></div>'+
    '<div class="pchead"><div><h3>'+esc(planTitle(P))+'</h3>'+
      '<p class="pcs">'+esc(P.kind==="hajj"?("Dhul Hijjah "+(P.hy||"")+" \\u00b7 "+(P.miqat?P.miqat.n:(P.mk==="inside"?"inside the line":"miqat not settled"))):((P.hm?monthName(P.hm):"a month you have not fixed")+" \\u00b7 "+(P.miqat?P.miqat.n:(P.mk==="inside"?"inside the line":"miqat not settled"))))+'</p></div>'+
      '<div class="pcr"><p class="pcar notranslate" translate="no" dir="rtl" lang="ar">\\u062e\\u064f\\u0637\\u0651\\u064e\\u0629 \\u0627\\u0644\\u062d\\u064e\\u0627\\u062c\\u0651</p>'+
      '<p class="pcn">Pocket card</p></div></div>'+
    '<div class="pcbody">'+
      '<div class="pccol l"><div class="pcb plain"><p class="pck">The order of the rites</p>'+
        '<ol class="pcord">'+order+'</ol></div>'+dbox+key+'</div>'+
      '<div class="pccol r">'+
        '<div class="pcb"><p class="pck">Your miqat</p>'+miq+'</div>'+
        '<div class="pcb"><p class="pck">Your days</p>'+when+'</div>'+
        '<div class="pcb plain"><p class="pck">If something goes wrong</p>'+fields+
          '<p class="pcline" style="margin-top:1.4mm">Stand still. Go to the meeting point. Show this card.</p></div>'+
      '</div></div>'+
    '<div class="pcduas">'+duas+'</div>'+
    '<div class="pcfoot"><span><b>Not a fatwa.</b> Ask your group\\u2019s scholar on site rather than guessing.</span>'+
      '<span>noorcodex.com/hajj-plan \\u2726</span></div>'+
    '</div></div></div>';
}

function draw(){
  var P=build(), out=$("plan"); if(!out)return;
  var W=P.warn.length?('<div class="warn">'+P.warn.map(function(w){return "<p>"+esc(w)+"</p>"}).join("")+'</div>'):"";
  var head='<section id="planhead" class="mo"><p class="pk">Your plan</p><h2>'+esc(planTitle(P))+'</h2>'+
    '<p class="pl">Written from your own answers. It is a preparation aid and not a fatwa: rulings on the ground and the regulations of the year change, and your group\\u2019s scholar and the official guidance decide.</p>'+
    '<div class="facts">'+facts(P)+'</div>'+
    '<div class="pacts noprint">'+
      '<button type="button" class="gpill" id="p-print">Print the plan</button>'+
      '<button type="button" class="ghost" id="p-card">Print the pocket card</button>'+
      '<button type="button" class="ghost" id="p-copy">Copy the link</button>'+
      '<button type="button" class="ghost" id="p-again">Answer again</button>'+
    '</div></section>'+W;

  var adj=P.adjust.length?('<div class="grp">'+P.adjust.map(function(a){
    return '<article class="card mo"><div class="ch"><h3>'+esc(a.t)+'</h3><div class="chb">'+
      levelChip(a.k)+'</div></div>'+a.ps.map(function(p){return "<p>"+esc(p)+"</p>"}).join("")+'</article>';
  }).join("")+'</div>'):"";

  var s1=secHead("p-journey","\\u0631\\u0650\\u062d\\u0652\\u0644\\u064e\\u0629","rihlah, the journey","Your journey",
    "Only the places this journey actually visits, in the order it visits them, with your own days on them.")+
    figJourney(P)+figRibbon(P)+adj+'</section>';

  var mnote="";
  if(P.mk==="inside")mnote='<article class="card mo"><h3>'+esc(D.insideNote.t)+'</h3>'+
    D.insideNote.ps.map(function(p){return "<p>"+esc(p)+"</p>"}).join("")+'</article>';
  if(P.mk==="unknown")mnote='<article class="card mo"><h3>'+esc(D.unknownNote.t)+'</h3>'+
    D.unknownNote.ps.map(function(p){return "<p>"+esc(p)+"</p>"}).join("")+'</article>';
  var s2=secHead("p-miqat","\\u0627\\u0644\\u0645\\u0650\\u064a\\u0642\\u064e\\u0627\\u062a","al-miqat, the appointed boundary","Your miqat",
    "The line you may not cross without ihram, and which of the five gates is yours.")+
    figMiqat(P)+mnote+'</section>';

  var s3=secHead("p-days","\\u064a\\u064e\\u0648\\u0652\\u0645\\u064b\\u0627 \\u0628\\u0650\\u064a\\u064e\\u0648\\u0652\\u0645","yawman bi-yawm, day by day","Day by day",
    "Times are anchored to the prayers rather than to a clock, because the clock in Makkah is set by the sun and by your group\\u2019s transport. The lines in purple were added because of who is travelling with you.")+
    P.days.map(function(d,i){return dayHtml(P,d,i)}).join("")+
    figRhythm(P)+'</section>';

  var riteCards=P.rites.map(function(r){
    var pre="";
    if(r.id==="tawaf")pre=figTawaf(P);
    if(r.id==="sai")pre=figSai(P);
    return pre+riteHtml(P,r);
  }).join("");
  var s4=secHead("p-rites","\\u0627\\u0644\\u0645\\u064e\\u0646\\u064e\\u0627\\u0633\\u0650\\u0643","al-manasik, the rites","What to do at each rite",
    "Short steps, in order, for someone standing in a crowd. Every rank, every evidence badge, every school difference and every reference below is taken from the Golden Room, so the two pages cannot disagree.")+
    figRanks(P)+riteCards+'</section>';

  var s5=secHead("p-pack","\\u0627\\u0644\\u0632\\u0651\\u064e\\u0627\\u062f","az-zad, the provision","What to pack",
    "Built from your answers. Take it all, then take a quarter of it out again, because you will carry everything you brought, up stairs, in heat.")+
    P.packing.map(function(g){
      return '<div class="grp"><h3>'+esc(g.g)+'</h3><p class="gs">'+esc(g.sub)+'</p>'+listHtml(g.items)+'</div>';
    }).join("")+'</section>';

  var s6=secHead("p-before","\\u0642\\u064e\\u0628\\u0652\\u0644 \\u0627\\u0644\\u0631\\u0651\\u064e\\u062d\\u0650\\u064a\\u0644","qabl ar-rahil, before departure","Before you go",
    "With real timing. The things at the top cannot be done quickly, and the things at the bottom should not be done at all.")+
    P.before.map(function(g){
      return '<div class="phase mo"><p class="pk">'+esc(g.k)+'</p><h3>'+esc(g.sub)+'</h3>'+listHtml(g.items)+'</div>';
    }).join("")+'</section>';

  var s7=secHead("p-money","\\u0627\\u0644\\u0646\\u0651\\u064e\\u0641\\u064e\\u0642\\u064e\\u0629","an-nafaqah, the spending","Money, and the practicalities",
    D.money.lead)+
    P.money.map(function(g){
      return '<div class="grp"><h3>'+esc(g.g)+'</h3>'+listHtml(g.items)+'</div>';
    }).join("")+'</section>';

  var s8=secHead("p-wrong","\\u0625\\u0650\\u0630\\u064e\\u0627 \\u0623\\u064e\\u062e\\u0652\\u0637\\u064e\\u0623\\u0652\\u062a","idha akhta\\u2019t, if you get it wrong","If it goes wrong",
    "Read this once before you fly. You will not read it calmly on the day.")+
    D.wrong.map(function(w){
      return '<article class="card mo"><h3>'+esc(w.t)+'</h3>'+
        w.ps.map(function(p){return "<p>"+esc(p)+"</p>"}).join("")+'</article>';
    }).join("")+emgHtml(P)+'</section>';

  var s9=secHead("pocket","\\u0628\\u0650\\u0637\\u064e\\u0627\\u0642\\u064e\\u0629","bitaqah, a card","The pocket card",
    D.pocket.sub)+pocketHtml(P)+
    '<p class="pcnote noprint">'+esc(D.pocket.note)+' It is one sheet on A4 and on Letter alike. Print it, fold it once, and put it away.</p></section>';

  out.innerHTML=head+s1+s2+s3+s4+s5+s6+s7+s8+s9;
  built=true;
  wire(P);
  fitCard();
  if(window.NOOR_MO&&window.NOOR_MO.animate){try{window.NOOR_MO.animate(out)}catch(e){}}
}
function levelChip(k){
  var m={quran:["Qur\\u2019an","Stated directly in the Qur\\u2019an"],
    sunnah:["Sunnah","Established in the authentic Sunnah"],
    debated:["Scholars differ","The four schools read this one differently"],
    editorial:["Editorial","Our own counsel, drawn from the sources named"]};
  var v=m[k]||m.editorial;
  return '<span class="evb '+esc(k||"editorial")+' mo-pop" title="'+esc(v[1])+'">'+esc(v[0])+'</span>';
}
function wire(P){
  var pr=$("p-print"); if(pr)pr.addEventListener("click",function(){
    document.body.classList.remove("pc-only"); fitCard(); window.print();
  });
  var pc=$("p-card"); if(pc)pc.addEventListener("click",function(){
    document.body.classList.add("pc-only"); fitCard(); window.print();
  });
  var cp=$("p-copy"); if(cp)cp.addEventListener("click",function(){
    var t=link();
    var done=function(){cp.textContent="Copied \\u2726";setTimeout(function(){cp.textContent="Copy the link"},1600)};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done).catch(function(){cp.textContent="Copy from the address bar"})}
    else{cp.textContent="Copy from the address bar"}
  });
  var ag=$("p-again"); if(ag)ag.addEventListener("click",function(){
    var w=$("wiz"); if(w)w.scrollIntoView({block:"start",behavior:"smooth"});
  });
}
function fitCard(){
  var pc=$("pc"); if(!pc)return;
  var body=pc.querySelector(".pcbody");
  var f=1.0,i;
  for(i=0;i<32;i++){
    pc.style.setProperty("--pcf",f.toFixed(3));
    var over=(pc.scrollHeight>pc.clientHeight+1)||(body&&body.scrollHeight>body.clientHeight+1);
    if(!over)break;
    f-=0.03;
    if(f<0.5){pc.style.setProperty("--pcf","0.5");break}
  }
  scalePc();
}
function scalePc(){
  var wrap=$("pcwrap"), sc=$("pcscale"), pc=$("pc");
  if(!wrap||!sc||!pc)return;
  sc.style.transform="none";sc.style.width="";sc.style.height="";
  var w=wrap.clientWidth, sw=pc.offsetWidth, sh=pc.offsetHeight;
  if(!sw||!sh)return;
  var k=Math.min(1,w/sw);
  if(k<1){sc.style.transform="scale("+k.toFixed(4)+")";sc.style.width=Math.ceil(sw*k)+"px";sc.style.height=Math.ceil(sh*k)+"px"}
}

/* ------------------------------------------------------------------- boot */
function boot(){
  var fromLink=fromHash();
  if(!fromLink)load();
  renderWiz();
  if(fromLink||(A.j&&A.f&&A.a))draw();
  var t;
  window.addEventListener("resize",function(){clearTimeout(t);t=setTimeout(function(){if(built)fitCard()},180)},{passive:true});
  window.addEventListener("afterprint",function(){document.body.classList.remove("pc-only")});
  document.addEventListener("click",function(ev){
    var b=ev.target.closest?ev.target.closest(".vplay"):null;
    if(b&&window.playAyah)window.playAyah(b.getAttribute("data-ref"),b);
  });
  window.addEventListener("hashchange",function(){
    if(fromHash()){draw();var p=$("plan");if(p)p.scrollIntoView({block:"start"})}
  });
  window.NOOR_PLAN={draw:draw,state:function(){return A},fit:fitCard};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
else boot();
"""

JSONLD = """<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebApplication",
"name":"NOOR Pilgrim's Planner","url":"https://noorcodex.com/hajj-plan",
"applicationCategory":"ReligiousApplication",
"description":"A free planner for Umrah and Hajj: a day by day itinerary, the rites in short steps with their rank and du'as, a tailored packing list, a before you go checklist, and a one page printable pocket card. No account, no server, works offline.",
"inLanguage":"en","isAccessibleForFree":true,
"offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},
"about":["Hajj","Umrah","Ihram","Miqat","Tawaf","Arafah","Islamic pilgrimage"],
"provider":{"@type":"Organization","name":"NOOR Codex of Light","url":"https://noorcodex.com"}}
</script>"""


def build():
    plan = json.load(open(SRC, encoding="utf-8"))
    room = json.load(open(RITES, encoding="utf-8"))

    plan["rites"] = resolve(plan, room)
    plan["duas"] = resolve_duas(plan, room)

    blob = json.dumps(plan, ensure_ascii=False, separators=(",", ":"))
    blob = blob.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")

    js = ("<script>\n(function(){\n\"use strict\";\n"
          + JS_HEAD + JS_WIZ + JS_MODEL + JS_FIG + JS_FIG2 + JS_FIG3 + JS_RENDER
          + "\n})();\n</script>")
    data = "<script>window.NOOR_PLAN_DATA=" + blob + ";</script>"

    meta = plan["meta"]
    html = shell(
        slug="hajj-plan",
        title=meta["title"],
        desc=meta["desc"],
        ar=meta["ar"],
        kick=meta["kick"],
        h1=meta["h1"],
        lead=meta["lead"],
        main=main_html(plan),
        css=CSS,
        jsonld=JSONLD,
        extra_js=data + "\n" + js,
        footline="The planner is free forever, like every room in the Codex.",
    )
    open(OUT, "w", encoding="utf-8").write(html)

    ranks = {}
    for r in plan["rites"]:
        ranks[r["rank"] or "none"] = ranks.get(r["rank"] or "none", 0) + 1
    print("hajj-plan.html written: %d bytes, %d rites resolved (%s), %d regions, "
          "%d packing groups, %d wizard steps, data blob %d bytes"
          % (len(html.encode("utf-8")), len(plan["rites"]),
             ", ".join("%s %d" % (k, v) for k, v in sorted(ranks.items())),
             len(plan["regions"]), len(plan["packing"]), len(plan["steps"]),
             len(blob.encode("utf-8"))))
    for p in PROBLEMS:
        print("  PROBLEM: " + p)
    return len(PROBLEMS)


if __name__ == "__main__":
    sys.exit(1 if build() else 0)
