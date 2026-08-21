#!/usr/bin/env python3
"""The one page that says, in advance and in public, what happens to a reply."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from room import shell

MAIN = """
<section class="rsec"><div class="wrap">
<article class="card"><p class="pill">Why this section exists at all</p>
<h3 style="margin-top:.5rem">To be corrected, in public, by people who know more</h3>
<p>The entries in this journal are thoughts that have been turning in one man&rsquo;s head for years with nowhere to go. He is not a scholar. He holds no ijazah and no licence to rule on anything, and nothing in the journal is a fatwa, a ruling, or teaching. It is published for one reason: so that people who actually know the material can say where it is wrong.</p>
<p>So the most valuable thing you can do here is disagree well. Name the error, bring the reference, and it will be answered. Where a correction lands, the entry itself is changed rather than the objection being quietly buried underneath it.</p></article>

<article class="card"><p class="pill">The promise</p>
<h3 style="margin-top:.5rem">No reply is ever refused for disagreeing</h3>
<p>Not for its opinion, not for its tone, not for its politics, not for its madhhab. You may say that the entry is wrong, that its author is wrong, that the whole Codex is wrong. That is the section working, not failing.</p></article>

<article class="card"><p class="pill">What is different here, and why</p>
<h3 style="margin-top:.5rem">Every reply is read by a person before it appears</h3>
<p>This is a real cost to you, and it is stated here rather than hidden: a reply does not appear the second you send it. It waits until it has been read.</p>
<p>The reason is the library it hangs beside. The Codex is used by children, by new Muslims and by families, and an open comment field on the internet does not stay clean on its own. Reading everything first is the price of keeping this section open at all, and the alternative was not an unmoderated journal, it was no journal.</p></article>

<article class="card"><p class="pill">What is refused</p>
<h3 style="margin-top:.5rem">A short list, and nothing outside it</h3>
<ul style="font-size:.87rem;line-height:1.95;color:rgba(44,36,22,.8);padding-inline-start:1.15rem;margin:.4rem 0 0">
<li>spam, scams and selling of any kind</li>
<li>coarse or sexual language, because children read this library</li>
<li>anything unlawful</li>
<li>anything that publishes a private person&rsquo;s details</li>
<li>anything written to harass a named person rather than to answer an argument</li>
</ul>
<p style="margin-top:.7rem">That is the whole list. A furious, closely reasoned objection contains none of those things and will be approved.</p></article>

<article class="card"><p class="pill">Your address</p>
<h3 style="margin-top:.5rem">Required, never shown, never shared</h3>
<p>An email address is asked for with every reply, for one purpose: so that someone who takes the trouble to correct him can be told when he answers. It is never displayed on the page, never given to anyone, never sold, and never used for anything else. Your name field may be left blank; the address may not.</p></article>

<article class="card"><p class="pill">How replies are ordered</p>
<h3 style="margin-top:.5rem">Readers vote, and once a month the Lantern reads</h3>
<p>Every approved reply can be lifted by readers. There is deliberately no way to bury one: a downvote button under a religious argument is an invitation to brigade it.</p>
<p>Once a month the Codex&rsquo;s own AI reads the approved replies and scores each for how much it actually helps the author get closer to the truth, weighing evidence, precision, a real correction, a serious question, or lived experience. Agreement with no content and insult with no argument sink. <b>Disagreement is not a penalty in that scoring, and an excellent reply may disagree entirely.</b> It removes nothing, it never sees an address, and it only decides what rises.</p></article>

<article class="card"><p class="pill">The switch</p>
<h3 style="margin-top:.5rem">This section can be closed without touching the Codex</h3>
<p>The journal is separate from the library by design, in its address, its theme and its code. If it ever becomes a liability it can be closed in one click, either for replies alone or entirely, and every teaching room of the Codex carries on exactly as before. The library is the point. This is a room beside it.</p></article>

<article class="card"><p class="pill">On the two voices</p>
<h3 style="margin-top:.5rem">Why the journal does not look like the rest of the Codex</h3>
<p>Every teaching room here badges its evidence: a verse, an authentic narration, a place where scholars differ, or an editorial line marked as our own counsel. That is a promise about where the words come from.</p>
<p>The journal makes no such promise, so it does not wear the same clothes. Different paper, a different hand, a seal instead of a badge. If you are ever unsure which one you are reading, look for the seal: where it appears, you are reading a person.</p></article>
</div></section>
"""

html = shell(
    slug="journal-rules",
    title="How replies are handled · The Guardian's Journal",
    desc="The reply policy of the Guardian's Journal: the section exists to be corrected by people who know more, no reply is ever refused for disagreeing, every reply is read by a person first, and an address is required but never shown.",
    ar="الرَّدّ",
    kick="The journal",
    h1="How replies are handled",
    lead="Written down in advance, in public, so nobody has to guess. The short version: this journal exists to be corrected, disagreement is never refused, and every reply is read by a person before it appears.",
    main=MAIN,
    footline="The journal is opinion. The teaching rooms carry their evidence; this one carries a name.")

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
open(os.path.join(root, "journal-rules.html"), "w", encoding="utf-8").write(html)
print("journal-rules.html written:", len(html), "bytes")
