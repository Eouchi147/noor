#!/usr/bin/env python3
"""The one page that says, in advance and in public, what happens to a reply."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from room import shell

MAIN = """
<section class="rsec"><div class="wrap">
<article class="card"><p class="pill">The promise</p>
<h3 style="margin-top:.5rem">Disagreement is never removed for being disagreement</h3>
<p>The journal is one man&rsquo;s opinion, published under a seal that says so. A room like that is worth nothing if the replies underneath it are curated to agree. So the rule is simple and it is not going to change: <b>you may say that the entry is wrong, that its author is wrong, that the whole Codex is wrong, and it stays up.</b> No reply is removed for its opinion, its tone, its politics, or its madhhab.</p>
<p>There is no account, no login, and nothing is collected about you. You may leave the name field blank.</p></article>

<article class="card"><p class="pill">What is actually filtered</p>
<h3 style="margin-top:.5rem">Machine noise, and only by shape</h3>
<p>An automatic filter <i>holds</i> a reply, never deletes it, when it has the shape of spam rather than speech. The tests are entirely mechanical, and each one is about form, not content:</p>
<ul style="font-size:.87rem;line-height:1.95;color:rgba(44,36,22,.8);padding-inline-start:1.15rem;margin:.4rem 0 0">
<li>two or more links, or one link with almost no words around it</li>
<li>the known selling patterns: search-ranking services, casinos, loan and investment offers, fund or wallet recovery, a phone number attached to a messaging app</li>
<li>a run of fifteen or more of the same character</li>
<li>a long message that is more than three quarters capital letters</li>
<li>more than three replies in a minute or twenty in a day from the same place, which is a flood rather than a person</li>
</ul>
<p style="margin-top:.7rem">Nothing on that list can be triggered by an argument. A furious, closely reasoned objection with no links in it passes straight through and appears immediately.</p></article>

<article class="card"><p class="pill">What happens to a held reply</p>
<h3 style="margin-top:.5rem">A person reads it, not a rule</h3>
<p>Held replies go to a queue that only the owner of the site sees. He releases the real ones and bins the machines. If yours is held you will be told so on the spot, in plain words, rather than being shown a fake success message while your words go nowhere.</p>
<p>There is one further power, used by a human and openly declared here: a reply may be removed if it is unlawful, if it publishes someone&rsquo;s private information, or if it exists to harass a named person. That is not a disagreement rule. It is the ordinary duty of anyone who keeps a public room.</p></article>

<article class="card"><p class="pill">On the difference between the two voices</p>
<h3 style="margin-top:.5rem">Why the journal does not look like the rest of the Codex</h3>
<p>Every teaching room here badges its evidence: a verse, an authentic narration, a place where scholars differ, or an editorial line marked as our own counsel. That is a promise about where the words come from.</p>
<p>The journal makes no such promise, so it does not wear the same clothes. Different paper, a different hand, a seal instead of a badge. If you ever find yourself unsure which one you are reading, look for the seal: where it appears, you are reading a person.</p></article>
</div></section>
"""

html = shell(
    slug="journal-rules",
    title="How replies are handled · The Guardian's Journal",
    desc="The comment policy of the Guardian's Journal: disagreement is never removed for being disagreement, an automatic filter holds only machine-shaped spam, and a person reads everything it holds.",
    ar="الرَّدّ",
    kick="The journal",
    h1="How replies are handled",
    lead="Written down in advance, in public, so that nobody has to guess. The short version: opinions are safe here, and spam is not.",
    main=MAIN,
    footline="The journal is opinion. The teaching rooms carry their evidence; this one carries a name.")

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
open(os.path.join(root, "journal-rules.html"), "w", encoding="utf-8").write(html)
print("journal-rules.html written:", len(html), "bytes")
