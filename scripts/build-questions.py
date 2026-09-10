#!/usr/bin/env python3
"""Build assets/questions.json: the questions a stranger asks, answered in the
   library's own words.

   The arrival screen is a field and a short list of real questions. Tapping one
   opens its answer in place. That answer is not written here and it is not
   written anywhere: it is lifted verbatim out of the room that already answers
   it, so it cannot drift from the room, and every one of them arrives carrying
   the evidence the room states for itself.

   Two shapes of source, because the house has two shapes of room.

     a dictionary word   /dictionary/<slug> -- 523 of them, and every one has
                         the same skeleton: p.n2-meaning is a single plain
                         sentence, p.n2-p under #meaning is three to six
                         sentences with the evidence named, and p.n2-src on that
                         section says what the evidence is. Nothing to choose:
                         the page was built this way.

     a room              a hand-written page, whose opening is prose rather than
                         a definition. Those are named by the first few words of
                         the paragraph wanted, so this script grabs that exact
                         paragraph and no other.

   The naming is the point. A room's opening is editorial and it moves. If a
   paragraph named here is no longer in its page, the question is DROPPED and
   said out loud, rather than quietly answered with whatever prose happens to sit
   at that offset now. An arrival screen that answers a stranger's first question
   about Islam with the wrong paragraph is worse than one that does not answer it.

       python3 scripts/build-questions.py           write assets/questions.json
       python3 scripts/build-questions.py --report  say what it would carry
"""
import os, re, sys, json, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "questions.json")

#  ---------------------------------------------------------------------------
#  The questions.
#
#  These are what a stranger types, not what a scholar would file it under. The
#  list is deliberately short of the whole library: a question earns its place
#  by being one somebody actually asks and by having a room that answers it in
#  its own opening words. Where the house cannot answer -- jihad, music,
#  polygamy, Maryam as a subject of her own -- there is no entry, and there is
#  no entry rather than a near-miss.
#
#     ("the question", "dictionary-slug")
#     ("the question", "/url", "the first words of the paragraph wanted")
#  ---------------------------------------------------------------------------
Q = [
    # -- the first questions, in the order a stranger arrives at them ---------
    ("What is Islam, actually?", "islam"),
    ("Is Allah the same as God?", "tawhid"),
    ("What is Allah like? Does He have a form?", "/allah", "The Prophet ﷺ was asked to describe his Lord"),
    ("What do Muslims actually believe?", "aqidah"),
    ("How do I become a Muslim?", "shahadah"),
    ("I just said the shahada. What now?", "/begin", "You said two sentences"),

    # -- the Book ------------------------------------------------------------
    ("What is the Qur'an?", "quran"),
    ("Has the Qur'an been changed?", "jam-al-quran"),
    ("Do Muslims believe in the Bible and the Torah?", "kutub"),
    ("What is a hadith?", "hadith"),
    ("What is the Sunnah?", "sunnah"),

    # -- the practice --------------------------------------------------------
    ("How do Muslims pray?", "salah"),
    ("Why do Muslims wash before praying?", "wudu"),
    ("What is that call you hear from mosques?", "adhan"),
    ("Which way do Muslims face, and why?", "qiblah"),
    ("Do Muslims worship the Kaaba?", "kabah"),
    ("What happens at Friday prayer?", "jumuah"),
    ("What is zakat?", "zakat"),
    ("Why do Muslims fast?", "sawm"),
    ("What is Ramadan?", "/ramadan", "Ramadan is the ninth month"),
    ("What is the Night of Power?", "laylat-al-qadr"),
    ("What is Eid?", "/eid", "There are two Eids and only two"),
    ("What is Hajj?", "/hajj", "Al-Hajj, the pilgrimage, is the fifth pillar"),

    # -- the questions people are nervous to ask -----------------------------
    ("What is actually forbidden in Islam?", "haram"),
    ("What does halal really mean?", "halal"),
    ("Why is alcohol forbidden?", "khamr"),
    ("Is interest really forbidden?", "riba"),
    ("Why do Muslim women wear hijab?", "hijab"),
    ("What does Islam say about women?", "/theology#women", "Spiritually, the Qur'an flattens every hierarchy"),
    ("What is sharia law?", "shariah"),
    ("What is marriage in Islam?", "/marriage", "The Qur'an calls marriage a mithaq ghaliz"),
    ("What if I have done something terrible?", "tawbah"),

    # -- God, and the shape of the world -------------------------------------
    ("What is the one sin that isn't forgiven?", "shirk"),
    ("Is everything already decided? Do I have a choice?", "qadr"),
    ("Does God actually answer prayers?", "dua"),
    ("Do Muslims believe in angels?", "malaikah"),
    ("What are jinn?", "jinn"),
    ("How much power does the devil have?", "shaytan"),
    ("Is magic real? Is the evil eye real?", "/protection", "Sihr is real, and it is smaller than you have been told"),

    # -- the end -------------------------------------------------------------
    ("What happens when you die?", "/soul", "The Qur’an and the Sunnah map this road in detail"),
    ("What is Paradise like?", "jannah"),
    ("Is Hell forever?", "jahannam"),
    ("What is the Day of Judgement?", "qiyamah"),
    ("What are the signs before the end?", "ashrat-al-saah"),

    # -- the prophets --------------------------------------------------------
    ("How many prophets are there in Islam?", "/prophets", "Twenty-five are named in the Qur'an"),
    ("Do Muslims believe in Jesus? Was he crucified?", "nuzul-isa"),
    ("What did the Prophet ﷺ say at the end of his life?", "/sermon", "On the ninth of Dhul Hijjah"),

    # -- the shape of the ummah ----------------------------------------------
    ("What is the difference between Sunni and Shia?", "/theology", "Every conversation about Islam's divisions"),
    ("What are the four schools of law?", "madhhab"),
    ("What is Sufism?", "tasawwuf"),
    ("What happens to people who never heard of Islam?", "ahl-al-fatrah"),
]

TAG = re.compile(r"<[^>]+>")
WS = re.compile(r"\s+")


def text(fragment):
    """The rendered words of one element: tags gone, entities resolved, spaces
       collapsed. The house writes ﷺ and Arabic inline and both survive."""
    return WS.sub(" ", html.unescape(TAG.sub("", fragment))).strip()


def paras(src, cls=None):
    """Every <p> in the source, in order, as (class, rendered text).

       Several rooms are minified with four paragraphs on one line, so this
       cannot work by line number, and the first cut of this script quietly
       took a nav line off /eid because of it."""
    out = []
    for m in re.finditer(r"<p\b([^>]*)>([\s\S]*?)</p>", src, re.I):
        attrs, body = m.group(1), m.group(2)
        cm = re.search(r'class\s*=\s*"([^"]*)"', attrs, re.I)
        klass = cm.group(1) if cm else ""
        if cls and cls not in klass.split():
            continue
        out.append((klass, text(body)))
    return out


def section(src, sid):
    """The one <section id="…"> asked for, or the whole page if it has none."""
    m = re.search(r'<section\b[^>]*\bid\s*=\s*"%s"[^>]*>([\s\S]*?)</section>' % re.escape(sid), src, re.I)
    return m.group(1) if m else None


#  A paragraph whose text a script replaces after load cannot be quoted: the
#  words in the file are a placeholder and the reader never sees them. /quran,
#  /begin and the arrival all do this from /api/illuminations. Any paragraph
#  carrying an id that the page later writes into is refused outright.
LIVE = re.compile(r'id\s*=\s*"(vl-text|sq-a|sq-q|lt-[\w-]+|il-[\w-]+)"', re.I)


def read(path):
    with open(os.path.join(ROOT, path), encoding="utf-8", errors="ignore") as f:
        return f.read()


def from_word(slug):
    """A dictionary word: the definition, the paragraph, and the evidence."""
    p = os.path.join("dictionary", slug + ".html")
    if not os.path.exists(os.path.join(ROOT, p)):
        return None, "no such word"
    src = read(p)
    meaning = [t for k, t in paras(src) if "n2-meaning" in k.split()]
    body = section(src, "meaning")
    if not body:
        return None, "no #meaning section"
    if LIVE.search(body):
        return None, "the paragraph is replaced at runtime"
    para = [t for k, t in paras(body) if "n2-p" in k.split()]
    src_line = [t for k, t in paras(body) if "n2-src" in k.split()]
    if not para or len(para[0]) < 80:
        return None, "no paragraph"
    ev = ""
    if src_line:
        #  "Evidence · Qur'an · Stated directly in the Qur'an" -> the middle part
        bits = [b.strip() for b in src_line[0].split("·")]
        ev = bits[1] if len(bits) > 1 else ""
    return {"u": "/dictionary/" + slug, "m": meaning[0] if meaning else "",
            "p": para[0], "e": ev}, None


def from_room(url, opening):
    """A written room: the one paragraph that begins with these words."""
    path = url.split("#")[0].lstrip("/") + ".html"
    if not os.path.exists(os.path.join(ROOT, path)):
        return None, "no such room"
    src = read(path)
    if LIVE.search(src):
        #  only refuse if the *named* paragraph is the live one; a room may
        #  carry a live card elsewhere and still have a quotable opening.
        pass
    want = WS.sub(" ", opening).strip()
    for klass, t in paras(src):
        if t.startswith(want):
            if len(t) < 80:
                return None, "the named paragraph is too short to be an answer"
            return {"u": url, "m": "", "p": t, "e": ""}, None
    return None, "the named paragraph is no longer in the room"


def build():
    out, dropped = [], []
    for row in Q:
        q, ref = row[0], row[1]
        if ref.startswith("/"):
            rec, why = from_room(ref, row[2])
        else:
            rec, why = from_word(ref)
        if rec is None:
            dropped.append((q, ref, why))
            continue
        rec["q"] = q
        out.append(rec)
    return out, dropped


def main():
    out, dropped = build()
    for q, ref, why in dropped:
        print("  DROPPED  %-46s %-22s %s" % (q[:46], ref, why))
    words = sum(1 for r in out if r["u"].startswith("/dictionary/"))
    if "--report" in sys.argv:
        for r in out:
            print("  %-48s %s" % (r["q"][:48], r["u"]))
    doc = {"v": 1, "q": out}
    body = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
    if "--report" not in sys.argv:
        with open(OUT, "w", encoding="utf-8") as f:
            f.write(body)
    print("questions.json · %d questions (%d words, %d rooms) · %d dropped · %d KB"
          % (len(out), words, len(out) - words, len(dropped), len(body.encode()) / 1024))
    return 0


if __name__ == "__main__":
    sys.exit(main())
